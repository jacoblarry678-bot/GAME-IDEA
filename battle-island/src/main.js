/**
 * Benton Kids: Battle Island — boot + app flow (lobby preview ↔ match).
 */

import * as THREE from 'three';
import './ui/styles.css';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { save } from './core/save.js';
import { sfx } from './core/audio.js';
import { Game } from './gameplay/game.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { CharacterModel } from './entities/characters.js';

const canvas = document.getElementById('scene');
const engine = new Engine(canvas);
const input = new Input(canvas);

// ---------------------------------------------------------------- lobby preview
const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color('#7cc8ff');
menuScene.fog = new THREE.Fog('#7cc8ff', 20, 60);
const menuCam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
menuCam.position.set(0, 1.6, 6.2);
menuCam.lookAt(0, 1.1, 0);
menuScene.add(new THREE.HemisphereLight('#ffffff', '#7ed957', 1.6));
const key = new THREE.DirectionalLight('#fff1d6', 2.4);
key.position.set(3, 6, 5);
menuScene.add(key);
const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.4, 40), new THREE.MeshLambertMaterial({ color: '#ffcf3f' }));
stage.position.y = -0.2;
menuScene.add(stage);
const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.08, 8, 48), new THREE.MeshLambertMaterial({ color: '#ff5ca8', emissive: '#551133' }));
ring.rotation.x = Math.PI / 2;
menuScene.add(ring);
const grass = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshLambertMaterial({ color: '#6cc24a' }));
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.4;
menuScene.add(grass);
for (let i = 0; i < 14; i++) {
  const t = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + (i % 3) * 0.4, 1), new THREE.MeshLambertMaterial({ color: ['#57c84d', '#3fb24a', '#8ad957'][i % 3], flatShading: true }));
  const a = (i / 14) * Math.PI * 2;
  t.position.set(Math.cos(a) * (14 + (i % 4) * 3), 1.5, Math.sin(a) * (14 + (i % 4) * 3) - 8);
  menuScene.add(t);
}
let previewModel = null;
let previewEmoteT = 0;
const menuView = { scene: menuScene, camera: menuCam };

function preview() {
  if (previewModel) {
    menuScene.remove(previewModel.root);
    previewModel.dispose();
  }
  const P = save.data.profile;
  previewModel = new CharacterModel(P.character, P.outfits[P.character], P.skin);
  previewModel.root.position.x = document.querySelector('#menus.right') ? -2.1 : -0.2;
  menuScene.add(previewModel.root);
  previewEmoteT = 2.5;
}

// ---------------------------------------------------------------- app
let game;
const menus = new Menus(document.getElementById('menus'), {
  play,
  preview,
  previewEmote: () => (previewEmoteT = 4),
  previewSide: (right) => {
    if (previewModel) previewModel.root.position.x = right ? -2.1 : -0.2;
    menuCam.position.x = right ? -0.6 : 0;
  },
  menuView: () => {
    engine.view = menuView;
    engine.resize();
  },
  resume,
  toLobby,
  applySettings,
  matchRunning: () => game && game.world && game.state !== 'over',
  releaseLock: () => input.releaseLock(),
  lockIfPlaying: () => input.requestLock(),
});
const hud = new Hud(document.getElementById('hud'), menus);
game = new Game(engine, input, hud);
game.menus = menus;

function applySettings() {
  const S = save.data.settings;
  sfx.setVolume(S.volume);
  if (game.sun.castShadow !== S.shadows) game.setShadows(S.shadows);
}

function play() {
  sfx.init();
  const P = save.data.profile;
  menus.hide();
  engine.view = { scene: engine.scene, camera: engine.camera };
  engine.resize();
  game.paused = false;
  game.startMatch({ charId: P.character, outfit: P.outfits[P.character], skin: P.skin, mode: P.mode, botCount: save.data.settings.botCount });
  input.enabled = true;
  input.requestLock();
}

function pause() {
  if (!game.world || game.state === 'over' || !game.player.alive || !menus.overlayHidden) return;
  game.paused = true;
  menus.showPause();
  input.releaseLock();
}

function resume() {
  game.paused = false;
  menus.hide();
  input.requestLock();
}

function toLobby() {
  game.endMatch();
  game.paused = false;
  hud.show(false);
  input.enabled = false;
  input.releaseLock();
  menus.showMain();
}

input.onLockChange = (locked) => {
  // losing pointer lock mid-match (Esc) opens the pause menu
  if (!locked && game.world && !hud.mapOpen) pause();
};
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !game.world) return;
  if (hud.mapOpen) {
    hud.toggleMap(false);
    return;
  }
  if (game.paused) resume();
  else if (!input.locked) pause();
});
canvas.addEventListener('mousedown', () => {
  if (hud.mapOpen) hud.toggleMap(false);
});

engine.add((dt, t) => {
  if (engine.view === menuView) {
    if (previewModel) {
      previewEmoteT -= dt;
      previewModel.root.rotation.y = Math.sin(t * 0.4) * 0.5;
      previewModel.animate(dt, { t, speed: 0, state: 'ground', pose: 'none', emote: previewEmoteT > 0 && previewEmoteT < 3.5 });
      if (previewEmoteT < -6) previewEmoteT = 4;
    }
    ring.rotation.z = t * 0.3;
    return;
  }
  game.update(dt, t);
});
engine.afterStep = () => input.endFrame();

applySettings();
preview();
menus.showMain();
engine.start();

// test / debugging handle (used by the automated playtest)
window.__bi = { engine, game, input, menus, hud, save, play, toLobby, resume };
