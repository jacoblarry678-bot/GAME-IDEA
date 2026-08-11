/**
 * HELLRAISER: THE GAME — client entry point.
 *
 * Boots the renderer, the menu backdrop and the UI, then hands control to
 * Game once a match starts. Everything else lives in its own module.
 */

import './ui/styles.css';
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { settings } from './core/settings.js';
import { TextureLibrary } from './core/textures.js';
import { MenuScene } from './ui/menuscene.js';
import { UI } from './ui/ui.js';
import { Game } from './gameplay/game.js';
import { audio } from './audio/audio.js';
import { net } from './net/client.js';
import { Character } from './entities/character.js';
import { ROLES } from '../../shared/constants.js';

const TEX_SIZE = { low: 256, medium: 512, high: 1024 };
const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');
const setBoot = (t) => {
  const e = boot && boot.querySelector('.boot-sub');
  if (e) e.textContent = t;
};
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function main() {
  // ---------------------------------------------------------------- engine
  const engine = new Engine(canvas, settings.get('graphics.preset', 'high'));
  engine.camera.fov = settings.get('graphics.fov', 72);
  engine.camera.updateProjectionMatrix();
  window.__engine = engine;
  window.__THREE = THREE;

  setBoot('forging surfaces…');
  await frame();
  const textures = new TextureLibrary(
    TEX_SIZE[settings.get('graphics.textureQuality', 'high')] || 512,
    engine.quality.anisotropy
  );

  setBoot('setting the table…');
  await frame();
  const menuScene = new MenuScene(engine, textures);
  menuScene.activate();

  const input = new Input(canvas);
  input.enabled = false;

  // ------------------------------------------------------------------- UI
  const ui = new UI(document.getElementById('ui'), {
    sound: (n) => audio.play(n, {}),
    host: (name, mode) => {
      audio.init();
      net.host(name, mode);
    },
    join: (code, name) => {
      audio.init();
      net.join(code, name);
    },
    leave: () => {
      net.leave();
      game.stop();
      ui.lobby = null;
      ui.show('menu');
      menuScene.activate();
    },
    setRole: (r) => net.setRole(r),
    setCharacter: (id) => net.setCharacter(id),
    setMode: (m) => net.setMode(m),
    addBot: (r) => net.addBot(r),
    removeBot: (id) => net.removeBot(id),
    kick: (id) => net.kick(id),
    start: () => net.start(),
    chat: (t) => net.chat(t),
    chatClosed: () => input.requestLock(),
    debug: (cmd, args) => net.debug(cmd, args),
    boxRotate: (seg, dir) => net.action('box_rotate', { segment: seg, dir }),
    boxSubmit: () => net.action('box_submit'),
    toggleNoclip: () => {
      game.noclip = !game.noclip;
      net.debug('noclip');
    },
    toggleFirstPerson: () => {
      game.firstPerson = !game.firstPerson;
    },
    rebind: (action, cb) => input.beginRebind(action, cb),
    setQuality: (q) => {
      engine.applyQuality(q);
      ui.showToast(`Quality: ${q}. Some changes apply next match.`, '');
    },
    setResolution: (v) => {
      engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * engine.quality.pixelRatio * v);
      engine.resize();
    },
    setFov: (v) => {
      engine.camera.fov = v;
      engine.camera.updateProjectionMatrix();
    },
    refreshGraphics: () => {
      engine.renderer.shadowMap.enabled = settings.get('graphics.shadows', true) && engine.quality.shadows;
      if (engine.dread) engine.dread.uniforms.uGrain.value = settings.get('graphics.filmGrain', true) ? 1 : 0;
      if (engine.bloom) engine.bloom.enabled = settings.get('graphics.bloom', true);
    },
    screenChanged: (name) => {
      if (name === 'game') {
        menuScene.deactivate();
      } else if (name !== 'end') {
        menuScene.activate();
        input.releaseLock();
        input.enabled = false;
      }
    },
  });
  ui.initBoxPuzzle(audio);

  // ---------------------------------------------------------------- game
  const game = new Game({ engine, textures, input, audio, ui, net });
  window.__game = game;
  window.__ui = ui;

  // --------------------------------------------------------------- network
  net.on('welcome', (d) => {
    ui.populateCharacters(d.survivors, d.cenobites, (def, isCeno) => makePortrait(def, isCeno, engine));
    ui.setLanHint(d.lan);
  });
  net.on('lobby', (d) => {
    ui.updateLobby(d, net.id);
    if (ui.screen !== 'lobby' && ui.screen !== 'characters' && ui.screen !== 'settings' && ui.screen !== 'howto') {
      ui.show('lobby');
    }
  });
  net.on('error', (d) => ui.showError(d.message));
  net.on('chat', (d) => ui.addChat(d.from, d.text));
  net.on('matchStart', (d) => {
    ui.show('game');
    game.start(d);
  });
  net.on('event', (e) => game.onEvent(e));
  net.on('correction', (d) => {
    if (game.controller) game.controller.warp(d.x, d.y, d.z, d.floor);
  });
  net.on('matchEnd', (d) => {
    game.stop();
    ui.showEnd(d, net.id);
  });
  net.on('returnLobby', (d) => {
    ui.updateLobby(d, net.id);
    ui.show('lobby');
  });
  net.on('disconnect', () => {
    ui.showError('Lost the connection to the game server.');
    game.stop();
    ui.show('menu');
  });

  setBoot('reaching the server…');
  try {
    await net.connect();
  } catch (e) {
    ui.showError('No game server. Run `npm run dev` and reload.');
  }

  // ------------------------------------------------------------ global keys
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      ui.toggleDebug();
      return;
    }
    if (ui.chatOpen) return;
    if (e.code === 'Enter' && ui.screen === 'game' && !game.boxOpen) {
      e.preventDefault();
      input.releaseLock();
      ui.openChat();
      return;
    }
    if (e.code === 'Escape') {
      if (game.boxOpen) {
        game.closeBox();
        net.action('interact_cancel');
      } else if (ui.screen === 'game') {
        if (input.locked) input.releaseLock();
        else input.requestLock();
      }
    }
    if (e.code === 'KeyP' && ui.screen === 'game' && e.shiftKey) {
      game.firstPerson = !game.firstPerson;
    }
  });

  // resume audio on the first real click anywhere
  const kick = () => {
    audio.init();
    audio.resume();
    window.removeEventListener('pointerdown', kick);
  };
  window.addEventListener('pointerdown', kick);

  // ----------------------------------------------------------------- loop
  engine.add((dt, elapsed) => {
    if (ui.screen === 'game') {
      game.update(dt);
      ui.updateHUD(game.hudState());
      ui.setDamageFlash(game.hurt * 0.55);
      ui.updateDebug(game.debugInfo(), net.lobby ? net.lobby.hostId === net.id : false);
    } else {
      menuScene.update(dt, elapsed);
      if (ui.debugVisible) {
        ui.updateDebug(
          {
            fps: Math.round(engine.fps), ping: net.ping, pos: '—', floor: '—', zone: 'Main menu',
            role: '—', health: '—', healthState: '—', fear: '—', stamina: '—', power: '—',
            players: net.lobby ? net.lobby.players.length : 0, snapshots: 0,
            draws: engine.info.calls, tris: engine.info.triangles, phase: '—',
            noclip: false, connected: net.connected,
          },
          false
        );
      }
    }
    ui.puzzle?.update(dt);
    input.endFrame();
  });

  engine.start();
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 900);
  console.log('[hellraiser] ready');
  document.dispatchEvent(new CustomEvent('hellraiser:ready'));
}

/**
 * Render a small rotating portrait of a character into its own canvas for the
 * character-select grid.
 */
function makePortrait(def, isCeno, engine) {
  const cv = document.createElement('canvas');
  cv.width = 220;
  cv.height = 220;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  } catch {
    return cv; // out of WebGL contexts — the card still works, just no portrait
  }
  renderer.setPixelRatio(1);
  renderer.setSize(220, 220, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const character = new Character({
    build: def.build, role: isCeno ? ROLES.CENOBITE : ROLES.SURVIVOR, name: def.name,
    quality: engine.quality,
  });
  scene.add(character.group);
  cam.position.set(0.55, def.build.height * 0.88, 1.9);
  cam.lookAt(0, def.build.height * 0.72, 0);

  const key = new THREE.PointLight(0xffd7a8, 26, 8);
  key.position.set(1.4, 2.2, 1.8);
  scene.add(key);
  const rim = new THREE.PointLight(isCeno ? 0xd42a1c : 0x5a7cff, 18, 8);
  rim.position.set(-1.5, 1.6, -1.2);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x40465c, 8));

  // Ten portraits each running a full rAF render loop would cost more than the
  // game does. Render only while the card is actually on screen, at ~15fps.
  let t = Math.random() * 6;
  let raf;
  let last = 0;
  const draw = (now) => {
    if (!cv.isConnected) {
      cancelAnimationFrame(raf);
      renderer.dispose();
      return;
    }
    raf = requestAnimationFrame(draw);
    if (!cv.offsetParent) return;          // hidden tab / hidden screen
    if (now - last < 66) return;           // ~15fps is plenty for a portrait
    last = now;
    t += 0.05;
    character.group.rotation.y = Math.sin(t) * 0.55;
    renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(draw);
  return cv;
}

main().catch((err) => {
  console.error(err);
  if (boot) {
    boot.innerHTML = `<div class="boot-mark">ERROR</div><div class="boot-sub">${err.message}</div>`;
  }
});
