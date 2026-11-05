/**
 * App: top-level state machine.
 *   boot → title → playing ⇄ paused
 *   playing → overlay (WASTED / BUSTED) → playing (respawned)
 * Owns the Game, audio, HUD and menus; handles saving/loading, restarts,
 * pointer lock and the title-screen flyover.
 */
import * as THREE from 'three';
import { Game, REAL_SPAWN, REAL_PLACES } from './game/game.js';
import { REAL_SAFEHOUSE } from './realmap/spots.js';
import { Audio } from './audio/audio.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { loadSave, applySave } from './game/save.js';
import { Input } from './core/input.js';
import { Weather, WeatherFX } from './core/weather.js';
import { PLACES } from './world/district.js';
import { World } from './world/world.js';
import { RealWorld } from './realmap/realworld.js';
import './ui/styles.css';

export class App {
  constructor({ engine, world, input, settings, canvas }) {
    this.engine = engine;
    this.world = world;
    this.input = input;
    this.settings = settings;
    this.canvas = canvas;
    this.state = 'boot';
    this.game = null;
    this.externalClock = false;
    this.overlay = null;
    this.timeScale = 1;
    this.titleT = 0;
  }

  async init() {
    const ui = document.getElementById('ui');
    this.audio = new Audio(this.settings);
    this.weather = new Weather(this.settings);
    const M = this.world.mats;
    this.weatherFX = new WeatherFX(this.engine, [M.asphalt, M.lot, M.concrete, M.pavers, M.curb, M.marking_w, M.marking_y, M.roof], this.world.water);
    this.weather.onThunder = (delay) => this.audio.thunder?.(delay);
    this.hud = new HUD(this, ui);
    this.menus = new Menus(this, ui);
    this.hud.setVisible(false);
    this.input.onEscape = () => this.onEscape();
    this.input.onAnyKey = (code) => {
      this.audio.unlock();
      if (this.state !== 'playing') return;
      if (code === this.settings.c.bindings.map && !this.menus.isOpen) this.pause('map');
      if (code === this.settings.c.bindings.skip && this.game?.missions.failed && this.hud.failInfo) this.retryMission();
    };
    this.canvas.addEventListener('mousedown', () => { this.audio.unlock(); if (this.state === 'playing') this.input.requestLock(); });
    document.addEventListener('pointerlockchange', () => {
      // losing pointer lock while playing (Esc in most browsers) pauses the game
      if (!document.pointerLockElement && this.state === 'playing' && !this.overlay && this.input.wantLock && !this.externalClock) this.pause();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    // warm up: one frame of the world before revealing it
    this.engine.time.hour = 18.4;
    this.engine.render();
    this.menus.hideLoading();
    const params = new URLSearchParams(location.search);
    if (params.has('autostart')) this.startNew(true);
    else this.toTitle();
  }

  get simulating() { return this.state === 'playing' && !!this.game; }

  hasSave() { return !!loadSave(); }

  /**
   * Switch between the classic South Beach and the real Miami without reloading the page
   * (the artifact viewer may block reloads and storage). Each world is built once and kept.
   */
  async switchMap(to) {
    const cur = this.world;
    if ((to === 'real') === !!cur.real || this.switching) return;
    this.switching = true;
    try {
      try { localStorage.setItem('sunstate.map', to); } catch {}
      this.worlds = this.worlds || {};
      this.worlds[cur.real ? 'real' : 'classic'] = cur;
      let next = this.worlds[to];
      if (!next) next = to === 'real' ? await RealWorld.create(this.engine, { mats: cur.mats }) : new World(this.engine);
      cur.setVisible?.(false);
      next.setVisible?.(true);
      this.world = next;
      this.weatherFX.water = next.water;
    } finally { this.switching = false; }
    if (this.state === 'title') this.menus.showTitle(this.hasSave());
  }
  keyLabel(action) { return Input.label(this.settings.c.bindings[action]); }
  saveInfo() { return loadSave(); }

  // ------------------------------------------------------------ transitions
  toTitle() {
    this.state = 'title';
    this.hud.setVisible(false);
    this.menus.showTitle(this.hasSave());
    this.input.releaseLock();
    this.engine.time.hour = 18.4;
    this.engine.time.paused = false;
    this.engine.time.scale = 25;
  }

  createGame() {
    if (this.game) this.game.dispose();
    this.world.restoreProps();
    this.game = new Game({ engine: this.engine, world: this.world, input: this.input, settings: this.settings, audio: this.audio });
    this.game.hud = this.hud;
    this.game.app = this;
    this.game.weather = this.weather;
    this.hud.bind(this.game);
    this.bindGame(this.game);
    this.engine.time.scale = 60;
    this.engine.time.paused = false;
    return this.game;
  }

  async startNew(quick = false) {
    if (this.world.real) await this.world.ready(REAL_SPAWN.x, REAL_SPAWN.z); // stream the streets around the spawn first
    const g = this.createGame();
    this.engine.time.hour = 17.6;
    this.begin();
    if (!quick) {
      this.menus.showCard('South Beach', 'Miami Beach', 3.5);
      setTimeout(() => this.game === g && g.events.emit('phoneMessage', { from: 'sol', text: 'You up? I\'m out by the motel lot — blue marker by your door. We need to talk about Teo.' }), 2500);
      setTimeout(() => this.game === g && this.hud.notify(`<span class="key">${this.keyLabel('switchCharacter')}</span> switches between Cal and Sol · <span class="key">${this.keyLabel('partner')}</span> tells your partner to follow or wait.`, 'Tip', '', 10), 9000);
    }
    g.hud.setObjective(this.world.real ? 'Free roam: the real Miami, 1:1. Walk up to any shop and press E. Your apartment (⌂) is across Ocean Drive.' : 'Explore South Beach, or start the mission at the blue <span class="hl">S</span> marker by the motel.');
  }

  async continueGame() {
    const s = loadSave();
    if (!s) return this.startNew();
    if (this.world.real) await this.world.ready(REAL_SAFEHOUSE.spawn.x, REAL_SAFEHOUSE.spawn.z);
    const g = this.createGame();
    applySave(g, s);
    this.begin();
    this.menus.showCard('South Beach', 'Welcome back', 2.5);
    g.hud.setObjective(g.missions.available.length ? 'Start the next mission at the blue <span class="hl">S</span> marker.' : 'Free roam.');
  }

  begin() {
    this.menus.hideTitle();
    this.menus.pause.classList.remove('show');
    this.hud.setVisible(true);
    this.state = 'playing';
    this.overlay = null;
    this.timeScale = 1;
    this.input.requestLock();
  }

  bindGame(g) {
    // the safehouse door: save and rest
    g.interactables.push({
      id: 'safehouse', x: PLACES.safehouse.door.x + 1.2, z: PLACES.safehouse.door.z, radius: 2.2,
      label: () => (g.wanted.level > 0 ? null : g.missions.active ? null : 'Save game and rest (6 hours)'),
      onInteract: () => this.restAtSafehouse(),
    });
    g.events.on('playerDied', () => this.onPlayerDown('wasted'));
    g.events.on('busted', () => this.onPlayerDown('busted'));
  }

  restAtSafehouse() {
    const g = this.game;
    g.engine.time.hour = (g.engine.time.hour + 6) % 24;
    g.player.health = 100;
    if (g.crew.partnerWithPlayer()) g.partner.health = 100;
    g.saveGame('safehouse');
    this.fade(0.8);
  }

  fade(sec) {
    let f = document.querySelector('#ui .fade');
    if (!f) { f = document.createElement('div'); f.className = 'fade'; document.getElementById('ui').appendChild(f); }
    f.classList.add('show');
    setTimeout(() => f.classList.remove('show'), sec * 1000);
  }

  /** WASTED / BUSTED: slow motion, banner, then respawn with a penalty. */
  onPlayerDown(kind) {
    if (this.overlay) return;
    const g = this.game;
    this.overlay = kind;
    this.timeScale = kind === 'wasted' ? 0.35 : 0.6;
    this.canvas.classList.add('grayscale');
    this.hud.big(kind === 'wasted' ? 'WASTED' : 'BUSTED', kind === 'wasted' ? 'Ocean Mercy Medical patched you up.' : 'You spent the night at Precinct 3.', kind, 4.2);
    g.player.controller.frozen = true;
    if (kind === 'busted') g.player.anim_.surrender = true;
    const myGame = g;
    setTimeout(() => {
      if (this.game !== myGame) return;
      this.fade(1.2);
      setTimeout(() => { if (this.game === myGame) this.respawnAfter(kind); }, 600);
    }, 3600);
  }

  respawnAfter(kind) {
    const g = this.game;
    const real = g.world.real ? REAL_PLACES : null;
    const place = kind === 'wasted' ? (real?.hospital || PLACES.hospital) : (real?.police || PLACES.police);
    const partnerWasWith = g.crew.partnerWithPlayer();
    g.wanted.clear(true);
    g.police.clearAll();
    const fee = kind === 'wasted' ? Math.min(500, Math.round(g.economy.money * 0.1)) : Math.min(1000, Math.round(g.economy.money * 0.15));
    g.economy.take(fee, kind === 'wasted' ? 'Hospital bill' : 'Bail and fines');
    if (kind === 'busted') {
      const a = g.player.controller.inventory.ammo.pistol;
      if (a) { a.reserve = 0; a.mag = Math.min(a.mag, 12); }
    }
    g.respawnPlayer(place.x, place.z, place.rot, { health: 100 });
    g.crew.regroupAt(place.x, place.z, place.rot, partnerWasWith);
    g.engine.time.hour = (g.engine.time.hour + (kind === 'wasted' ? 4 : 8)) % 24;
    this.canvas.classList.remove('grayscale');
    this.overlay = null;
    this.timeScale = 1;
    this.hud.notify(kind === 'wasted' ? `Hospital bill: $${fee}.` : `Bail and fines: $${fee}. Your spare ammo was confiscated.`, kind === 'wasted' ? 'Ocean Mercy' : 'Police', 'warn', 7);
  }

  retryMission() {
    const g = this.game;
    if (!g?.missions.failed) return;
    this.overlay = null;
    this.timeScale = 1;
    this.canvas.classList.remove('grayscale');
    this.hud.failInfo = null;
    this.hud.bigEl.className = 'big';
    g.missions.retry();
    this.fade(0.6);
  }

  respawnAtSafehouse() {
    const g = this.game;
    if (g.missions.active) g.missions.abandon();
    g.wanted.clear(true);
    g.police.clearAll();
    const s = PLACES.safehouse.spawn;
    g.respawnPlayer(s.x, s.z, s.rot, { health: Math.max(g.player.health, 60) });
    this.fade(0.6);
  }

  quitToTitle() {
    this.menus.pause.classList.remove('show');
    if (this.game) { this.game.dispose(); this.game = null; }
    this.toTitle();
  }

  onEscape() {
    if (this.state === 'playing' && !this.overlay) this.pause();
    else if (this.state === 'paused') this.menus.closePause();
    else if (this.state === 'title' && this.menus.isOpen) this.menus.closePause();
  }

  pause(tab = 'game') {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.menus.openPause(tab);
  }

  resume() {
    if (!this.game) return this.toTitle();
    this.state = 'playing';
    this.input.requestLock();
  }

  // ------------------------------------------------------------ loop
  step(dt) {
    this.game.step(dt * this.timeScale);
  }

  frame(dt) {
    if (this.state === 'title') {
      this.titleT += dt;
      this.titleCamera(dt);
      this.weather.step(dt);
    } else if (this.game) {
      this.game.frame(this.state === 'playing' ? dt * this.timeScale : 0);
      this.hud.update(dt);
    }
    this.weatherFX.update(this.state === 'paused' ? 0 : dt, this.weather);
    this.engine.render();
    this.governQuality(dt);
  }

  /**
   * Automatic quality: if the frame rate stays under 40 for five seconds of real play, step
   * down — render scale first (to 70%), then ambient occlusion, then shadows — and say so.
   * Never in the headless tests (their clock isn't real time).
   */
  governQuality(dt) {
    const g = this.settings.g;
    if (!g.autoQuality || this.externalClock || this.state !== 'playing' || document.hidden) { this.slowT = 0; return; }
    if (this.engine.fps < 40) this.slowT = (this.slowT || 0) + dt; else this.slowT = Math.max(0, (this.slowT || 0) - dt * 2);
    if (this.slowT < 3) return;
    this.slowT = 0;
    let what = null;
    const S = this.settings, down = { ultra: 'high', high: 'medium', medium: 'low' };
    if (g.renderScale > 0.65) { S.set('graphics', 'renderScale', Math.max(0.6, +(g.renderScale - 0.1).toFixed(2))); what = `render scale ${Math.round(S.g.renderScale * 100)}%`; }
    else if (g.ao) { S.set('graphics', 'ao', false); what = 'ambient occlusion off'; }
    else if (g.shadows === 'ultra' || g.shadows === 'high') { S.set('graphics', 'shadows', 'low'); what = 'shadows low'; }
    else if (g.bloom) { S.set('graphics', 'bloom', false); what = 'bloom off'; }
    else if (g.postfx) { S.set('graphics', 'postfx', false); what = 'post effects off'; }
    else if (down[g.drawDistance]) { S.set('graphics', 'drawDistance', down[g.drawDistance]); what = `draw distance ${S.g.drawDistance}`; }
    else if (g.shadows === 'low') { S.set('graphics', 'shadows', 'off'); what = 'shadows off'; }
    if (what) this.hud?.notify(`Frame rate was low, so: ${what}. (Settings → Graphics)`, 'Quality', '', 4);
  }

  /** Slow flyover along Ocean Dr for the title screen. */
  titleCamera(dt) {
    const t = this.titleT * 0.035;
    const cam = this.engine.camera;
    if (this.world.real) {
      // the real map: up Ocean Drive over Lummus Park, Miami Beach
      const z = -400 - ((t * 60) % 1400);
      cam.position.set(6420 + Math.sin(t) * 15, 45 + Math.sin(t * 0.7) * 8, z);
      cam.lookAt(6300, 10, z - 90);
    } else {
      const z = -170 + ((t * 60) % 340);
      cam.position.set(205 + Math.sin(t) * 12, 34 + Math.sin(t * 0.7) * 6, z);
      cam.lookAt(130, 12, z + 60);
    }
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
    this.world.update(dt);
    this.engine.updateLighting(dt, new THREE.Vector3(cam.position.x - 40, 0, cam.position.z + 40));
  }
}
