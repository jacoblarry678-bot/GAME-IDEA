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
import { Online, MAX_HUMANS } from './net/online.js';
import * as ranked from './core/ranked.js';
import * as supercharge from './core/supercharge.js';
import * as challenges from './core/challenges.js';
const { rankState } = ranked;
import { TouchControls, isTouchDevice } from './ui/touch.js';

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
  online: openOnline,
  onlineInfo: () => ({ kind: online.kind, games: online.openGames() }),
  hostGame,
  joinGame,
  startOnline,
  leaveSession,
  releaseLock: () => input.releaseLock(),
  lockIfPlaying: () => input.requestLock(),
});
const hud = new Hud(document.getElementById('hud'), menus);
const touchRoot = document.createElement('div');
touchRoot.id = 'touch';
document.getElementById('app').appendChild(touchRoot);
const touch = new TouchControls(touchRoot, input, { pause: () => pause(), map: () => hud.toggleMap() });
// phones: lighter defaults the first time the game runs there
if (isTouchDevice() && !save.data.settings.mobileTuned) {
  save.data.settings.mobileTuned = true;
  save.data.settings.shadows = false;
  save.write();
}
if (isTouchDevice()) engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
game = new Game(engine, input, hud);
game.menus = menus;

function applySettings() {
  const S = save.data.settings;
  touch.refresh();
  sfx.setVolume(S.volume);
  if (game.sun.castShadow !== S.shadows) game.setShadows(S.shadows);
}

// ---------------------------------------------------------------- online
const online = new Online();
let session = null;
let rerenderT = null;
const rerender = () => {
  if (rerenderT) return;
  rerenderT = setTimeout(() => {
    rerenderT = null;
    if (document.activeElement && document.activeElement.id === 'join-code') return; // don't wipe typing
    if (menus.current === 'online') menus.showOnline();
    else if (menus.current === 'session' && session) menus.showSession(session);
  }, 250);
};
online.onChange = rerender;

function profileInfo() {
  const P = save.data.profile;
  const b = rankState('build'), z = rankState('zerobuild');
  return { name: P.name || 'Player', charId: P.character, outfit: P.outfits[P.character], skin: P.skin, rk: [[b.mmr, b.d], [z.mmr, z.d]] };
}

async function openOnline() {
  sfx.init();
  menus.showOnline({ status: 'connecting' });
  await online.connect();
  if (menus.current === 'online') menus.showOnline();
}

async function hostGame() {
  const P = save.data.profile;
  session = await online.host(profileInfo(), { mode: P.mode, team: P.teamSize || 1, bots: save.data.settings.botCount, ranked: !!P.ranked });
  bindSession();
  menus.showSession(session);
}

async function joinGame(code) {
  try {
    session = await online.join(code, profileInfo());
    bindSession();
    menus.showSession(session);
  } catch (e) {
    menus.showOnline({ error: e.message || 'Could not join that game.' });
  }
}

async function leaveSession() {
  if (game.world) {
    game.forfeit();
    game.endMatch();
    hud.show(false);
    input.enabled = false;
  }
  await online.leave();
  session = null;
  menus.showOnline();
}

function bindSession() {
  const s = session;
  s.onChange = () => {
    if (s !== session) return;
    rerender();
    if (s.role !== 'client') return;
    const hp = s.hostPresence();
    if (hp && hp.st === 'play' && hp.start && hp.start.mid !== s.lastMid) {
      const me = hp.start.humans.find((h) => h.p === s.myPeer);
      if (me) {
        s.lastMid = hp.start.mid;
        startClient(hp.start);
      }
    }
    if (hp && hp.st === 'lobby' && game.world && game.role === 'client') {
      game.endMatch();
      enterMenus();
      menus.showSession(s);
    }
  };
}

function enterGame() {
  touch.show(true);
  menus.hide();
  engine.view = { scene: engine.scene, camera: engine.camera };
  engine.resize();
  game.paused = false;
  input.enabled = true;
  input.requestLock();
}

function enterMenus() {
  touch.show(false);
  hud.show(false);
  input.enabled = false;
  input.releaseLock();
}

function startOnline() {
  const s = session;
  if (!s || s.role !== 'host') return;
  const players = s.players().slice(0, MAX_HUMANS);
  const humans = players.map((p, i) => ({ id: i, local: p.me, peer: p.peer, name: p.name, charId: p.charId, outfit: p.outfit, skin: p.skin }));
  // ranked lobbies are matched at the average MMR of the humans in them
  const mi = s.cfg.mode === 'zerobuild' ? 1 : 0;
  const rating = Math.round(players.reduce((sum, p) => sum + (p.rk ? p.rk[mi][0] : 1000), 0) / players.length);
  const cfg = { ...s.cfg, bots: Math.max(0, s.cfg.bots + 1 - humans.length), rating };
  enterGame();
  game.startMatch({ role: 'host', room: s.room, humans, mode: cfg.mode, teamSize: cfg.team, botCount: cfg.bots, ranked: !!cfg.ranked, lobbyRating: rating });
  s.announceStart(game, humans, cfg);
}

function startClient(start) {
  const s = session;
  const humans = start.humans.map((h) => ({ id: h.id, local: h.p === s.myPeer, peer: h.p, name: h.n, charId: h.c, outfit: h.o, skin: h.s }));
  enterGame();
  game.startMatch({ role: 'client', room: s.room, hostPeer: s.hostPeer(), seed: start.seed, mode: start.cfg.mode, teamSize: start.cfg.team, botCount: start.cfg.bots, humans, bus: start.bus, ranked: !!start.cfg.ranked, lobbyRating: start.cfg.rating || 1000 });
}

game.onHostLeft = () => {
  if (!session || game.role !== 'client') return;
  game.endMatch();
  enterMenus();
  menus.showSession(session, 'The host left the match.');
};

function play() {
  sfx.init();
  if (session) {
    // online "Play again": back to the game room; the host starts the next match
    if (game.world) game.endMatch();
    enterMenus();
    session.setProfile(profileInfo()); // updated rank for the room roster
    if (session.role === 'host') session.backToLobby();
    menus.showSession(session);
    return;
  }
  const P = save.data.profile;
  menus.hide();
  engine.view = { scene: engine.scene, camera: engine.camera };
  engine.resize();
  game.paused = false;
  game.startMatch({ charId: P.character, outfit: P.outfits[P.character], skin: P.skin, mode: P.mode, teamSize: P.teamSize || 1, botCount: save.data.settings.botCount, ranked: !!P.ranked, lobbyRating: rankState(P.mode).mmr });
  input.enabled = true;
  touch.show(true);
  input.requestLock();
}

function pause() {
  if (!game.world || game.state === 'over' || !game.player.alive || !menus.overlayHidden) return;
  game.paused = game.role === 'solo'; // online matches keep running
  menus.showPause();
  input.releaseLock();
}

function resume() {
  game.paused = false;
  menus.hide();
  input.requestLock();
}

function toLobby() {
  if (session) {
    leaveSession().then(() => menus.showMain());
    return;
  }
  game.forfeit();
  game.endMatch();
  game.paused = false;
  touch.show(false);
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
  touch.update(game);
});
engine.afterStep = () => input.endFrame();

applySettings();
preview();
menus.showMain();
engine.start();

// test / debugging handle (used by the automated playtest)
window.__bi = { engine, game, input, menus, hud, save, play, toLobby, resume, online, touch, ranked, supercharge, challenges, get session() { return session; } };
