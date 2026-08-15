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
import { net as onlineNet } from './net/client.js';
import { LocalNet } from './net/localserver.js';
import { Character } from './entities/character.js';
import { ROLES } from '../../shared/constants.js';

// Offline builds run the authoritative simulation in the browser (see
// net/localserver.js) so the game can be a single shareable file.
const OFFLINE =
  window.__HELLRAISER_OFFLINE__ === true ||
  new URLSearchParams(location.search).has('solo');
const net = OFFLINE ? new LocalNet() : onlineNet;

const TEX_SIZE = { low: 256, medium: 512, high: 1024 };
const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');
const setBoot = (t) => {
  const e = boot && boot.querySelector('.boot-sub');
  if (e) e.textContent = t;
};
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function showFatal(title, html) {
  if (!boot) return;
  boot.classList.remove('gone');
  boot.innerHTML =
    `<div class="boot-mark">${title}</div>` +
    `<div class="boot-sub" style="max-width:44rem;text-align:center;line-height:1.7;` +
    `letter-spacing:0.08em;text-transform:none;font-size:0.9rem">${html}</div>`;
}

async function main() {
  // ---------------------------------------------------------------- engine
  const caps = checkWebGL();
  if (!caps.ok) {
    showFatal(
      'WebGL unavailable',
      `${caps.reason}<br><br>` +
        'Try enabling hardware acceleration in your browser settings, updating your ' +
        'graphics drivers, or opening this in Chrome, Edge, Firefox or Safari on a desktop. ' +
        'Some browsers also disable WebGL in private/incognito windows.'
    );
    return;
  }
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
  const portraits = new PortraitStudio(engine);
  input.onLockBlocked = () => {
    ui.showToast('Mouse capture is blocked here — hold the left mouse button to look, or use the arrow keys.', '', 9);
  };

  // ------------------------------------------------------------------- UI
  const ui = new UI(document.getElementById('ui'), {
    sound: (n) => audio.play(n, {}),
    host: (name, mode) => {
      audio.init();
      net.host(name, mode);
      if (OFFLINE) {
        // solo: fill the other side so you can start immediately
        for (let i = 0; i < 4; i++) net.addBot(ROLES.SURVIVOR);
      }
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
    ui.populateCharacters(d.survivors, d.cenobites, (def, isCeno) => portraits.add(def, isCeno));
    if (d.offline) ui.setOffline();
    else ui.setLanHint(d.lan);
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

  setBoot(OFFLINE ? 'opening the configuration…' : 'reaching the server…');
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
    if (ui.screen === 'characters') portraits.update(dt, performance.now());
    input.endFrame();
  });

  engine.start();
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 900);
  console.log('[hellraiser] ready');
  document.dispatchEvent(new CustomEvent('hellraiser:ready'));
}

/**
 * Character-select portraits.
 *
 * These used to get a WebGLRenderer each. With ten cards that meant twelve
 * live contexts (ten portraits + the game + the box puzzle); browsers cap
 * active contexts and evict the OLDEST, which is the main game renderer —
 * producing "Error creating WebGL context" and a dead scene. One shared
 * offscreen renderer draws every portrait and blits into a plain 2D canvas
 * per card, so the whole grid costs a single context.
 */
class PortraitStudio {
  constructor(engine) {
    this.engine = engine;
    this.size = 220;
    this.entries = [];
    this.cursor = 0;
    this.last = 0;
    this.ok = false;
    try {
      this.surface = document.createElement('canvas');
      this.surface.width = this.surface.height = this.size;
      this.renderer = new THREE.WebGLRenderer({ canvas: this.surface, antialias: true, alpha: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.size, this.size, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.3;
      this.ok = true;
    } catch {
      this.ok = false; // no spare context: cards simply show no portrait
    }
  }

  add(def, isCeno) {
    const card = document.createElement('canvas');
    card.width = card.height = this.size;
    if (!this.ok) return card;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    const character = new Character({
      build: def.build, role: isCeno ? ROLES.CENOBITE : ROLES.SURVIVOR, name: def.name,
      quality: this.engine.quality,
    });
    scene.add(character.group);
    cam.position.set(0.5, def.build.height * 0.95, -2.15);
    cam.lookAt(0, def.build.height * 0.84, 0);

    const key = new THREE.PointLight(0xffd7a8, 30, 8);
    key.position.set(1.2, 2.3, -1.6);
    scene.add(key);
    const rim = new THREE.PointLight(isCeno ? 0xd42a1c : 0x5a7cff, 22, 8);
    rim.position.set(-1.4, 1.7, 1.3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x40465c, 8));

    this.entries.push({
      card, ctx: card.getContext('2d'), scene, cam, character, t: Math.random() * 6,
    });
    return card;
  }

  /** Draw a couple of visible portraits per frame — 15fps is plenty. */
  update(dt, now) {
    if (!this.ok || !this.entries.length) return;
    if (now - this.last < 66) return;
    this.last = now;
    for (let n = 0; n < 2; n++) {
      const e = this.entries[this.cursor];
      this.cursor = (this.cursor + 1) % this.entries.length;
      if (!e || !e.card.isConnected || !e.card.offsetParent) continue;
      e.t += 0.05;
      e.character.group.rotation.y = Math.sin(e.t) * 0.5;
      this.renderer.render(e.scene, e.cam);
      e.ctx.clearRect(0, 0, this.size, this.size);
      e.ctx.drawImage(this.surface, 0, 0);
    }
  }
}

/**
 * three.js needs WebGL2. Fail with something a person can act on rather than
 * a raw renderer exception.
 */
function checkWebGL() {
  const probe = document.createElement('canvas');
  let gl = null;
  try {
    gl = probe.getContext('webgl2');
  } catch { /* ignore */ }
  if (gl) {
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: true };
  }
  let gl1 = null;
  try {
    gl1 = probe.getContext('webgl') || probe.getContext('experimental-webgl');
  } catch { /* ignore */ }
  return {
    ok: false,
    reason: gl1
      ? 'This browser only supports WebGL 1, and the renderer needs WebGL 2.'
      : 'This browser could not create a WebGL context at all.',
  };
}

main().catch((err) => {
  console.error(err);
  const msg = String(err && err.message ? err.message : err);
  if (/webgl/i.test(msg)) {
    showFatal(
      'WebGL unavailable',
      `${msg}<br><br>Enable hardware acceleration in your browser settings, or try another browser.`
    );
  } else {
    showFatal('Something broke', msg);
  }
});
