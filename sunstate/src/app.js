/**
 * App: top-level state machine.
 *   boot → title → playing ⇄ paused
 *   playing → overlay (WASTED / BUSTED) → playing (respawned)
 * Owns the Game, audio, HUD and menus; handles saving/loading, restarts,
 * pointer lock and the title-screen flyover.
 */
import * as THREE from 'three';
import { Game } from './game/game.js';
import { Audio } from './audio/audio.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { loadSave, applySave } from './game/save.js';
import { Input } from './core/input.js';
import { PLACES } from './world/district.js';
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
    this.hud.bind(this.game);
    this.bindGame(this.game);
    this.engine.time.scale = 60;
    this.engine.time.paused = false;
    return this.game;
  }

  startNew(quick = false) {
    const g = this.createGame();
    this.engine.time.hour = 17.6;
    this.begin();
    if (!quick) {
      this.menus.showCard('Ocean Mile', 'Costa Vela', 3.5);
      setTimeout(() => this.game === g && g.events.emit('phoneMessage', { from: 'sol', text: 'You up? I\'m out by the motel lot — blue marker by your door. We need to talk about Teo.' }), 2500);
      setTimeout(() => this.game === g && this.hud.notify(`<span class="key">${this.keyLabel('switchCharacter')}</span> switches between Cal and Sol · <span class="key">${this.keyLabel('partner')}</span> tells your partner to follow or wait.`, 'Tip', '', 10), 9000);
    }
    g.hud.setObjective('Explore Ocean Mile, or start the mission at the blue <span class="hl">S</span> marker by the motel.');
  }

  continueGame() {
    const s = loadSave();
    if (!s) return this.startNew();
    const g = this.createGame();
    applySave(g, s);
    this.begin();
    this.menus.showCard('Ocean Mile', 'Welcome back', 2.5);
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
    this.hud.big(kind === 'wasted' ? 'WASTED' : 'BUSTED', kind === 'wasted' ? 'Ocean Mercy Medical patched you up.' : 'You spent the night at OMPD Precinct 3.', kind, 4.2);
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
    const place = kind === 'wasted' ? PLACES.hospital : PLACES.police;
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
    this.hud.notify(kind === 'wasted' ? `Hospital bill: $${fee}.` : `Bail and fines: $${fee}. Your spare ammo was confiscated.`, kind === 'wasted' ? 'Ocean Mercy' : 'OMPD', 'warn', 7);
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
    } else if (this.game) {
      this.game.frame(this.state === 'playing' ? dt * this.timeScale : 0);
      this.hud.update(dt);
    }
    this.engine.render();
  }

  /** Slow flyover along Ocean Blvd for the title screen. */
  titleCamera(dt) {
    const t = this.titleT * 0.035;
    const cam = this.engine.camera;
    const z = -170 + ((t * 60) % 340);
    cam.position.set(205 + Math.sin(t) * 12, 34 + Math.sin(t * 0.7) * 6, z);
    cam.lookAt(130, 12, z + 60);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
    this.world.update(dt);
    this.engine.updateLighting(dt, new THREE.Vector3(cam.position.x - 40, 0, z + 40));
  }
}
