/**
 * App: boots every system, runs the frame loop and routes simulation
 * events to the renderer, audio and interface. Owns the active Game, the
 * campaign save slot and the profile.
 */
import * as THREE from 'three';
import { Settings } from './core/settings.js';
import { Input } from './core/input.js';
import { Engine } from './view/engine.js';
import { tex, TEXTURE_NAMES, setTextureSize } from './view/textures.js';
import { LevelView } from './view/levelView.js';
import { LightRig } from './view/lights.js';
import { CreatureView } from './view/creatures.js';
import { FirstPerson } from './view/firstPerson.js';
import { PhotoRenderer } from './view/photoView.js';
import { MenuScene } from './view/menuScene.js';
import { KITS } from './view/materials.js';
import { Audio } from './audio/audio.js';
import { MenuNav } from './ui/nav.js';
import { Hud } from './ui/hud.js';
import { Overlays } from './ui/overlays.js';
import { Menus, CHAPTER_NAMES } from './ui/menus.js';
import { el } from './ui/dom.js';
import { Profile } from './game/profile.js';
import { Saves } from './game/saves.js';
import { Controller } from './game/controller.js';
import { Game } from './sim/game.js';
import { addToPouch } from './sim/equipment.js';
import { startExpedition } from './sim/expedition.js';
import { seedToText } from './core/rng.js';
import { HostSession, GuestSession } from './net/session.js';
import { connectRelay } from './net/transport.js';
import { CHAPTERS } from './data/chapters/index.js';
import { CREATURES } from './data/creatures.js';
import { FINISHES } from './data/achievements.js';

const WARN_SFX = { listener: ['extraStep', 'wallTap'], cutout: ['shutterWarn', 'paperRub'], drowned: ['wake'], tenant: ['knock3', 'handleTurn'], caretaker: ['toolClick'], unseen: ['floorDent'] };

/** Ending cards: epilogue text (June-dependent staging) and the last developed photograph. */
const ENDING_TEXT = {
  familiar: {
    title: 'A Familiar Voice',
    text: ['Evan and the crew come out into the Annex parking garage at dawn. The gate closes normally. For the first time, the radio is silent.', 'A voicemail asks why he came back to work so early. Across the garage, under a fluorescent tube, another Evan raises a hand half a second before he does. The emergency speaker repeats his words: "Evan Ward. I\'m here."', 'The Operator has crossed through a copied identity. Lena remains attached to the network.'],
    june: 'June is with the crew. She is the one who notices the other Evan first.',
    noJune: 'On the radio, a last hiss carries three knocks that nobody answers.',
    photo: 'The last photograph: the ordinary building in the morning. Nothing in it looks wrong.',
    cam: { x: 8, y: 1.7, z: 211, yaw: Math.PI, pitch: 0.04 },
  },
  door: {
    title: 'The Door We Open',
    text: ['Evan and Lena come out through an ordinary maintenance hatch. She checks the sunflower sticker on her sleeve. "Then you can buy the coffee."', '"You came back. That doesn\'t fix everything. It means we can start." Behind the wall, the last isolated machinery powers down.', 'The Operator\'s transfer ability is severed, and Lena\'s life support held long enough for her release.'],
    june: 'June walks out beside Lena, squinting at a sky she has not seen in a long time.',
    noJune: 'Evan marks the service hatch for a future search. June Ellis is still alive. She has not yet been recovered.',
    photo: 'The last photograph: the same exterior threshold, empty. No hidden person stands in it.',
    cam: { x: 57.5, y: 1.6, z: 159, yaw: -Math.PI / 2, pitch: 0.02 },
  },
  cut: {
    title: 'Cut the Line',
    text: ['The crew climbs out of an exterior utility shaft while the Annex\'s lower lights shut off, floor by floor. Lena\'s local life support ended during the purge. Her last words came through a fading speaker: "Make sure it stays shut."', 'Evan stays beside the sealed hatch until dawn. He takes off his maintenance badge and leaves it on the cover.', 'The network\'s crossing is destroyed. The Operator cannot follow.'],
    june: 'June sits nearby. When Evan sets the badge down, she picks it up and holds it.',
    noJune: 'June\'s region of the network is isolated. Her fate is unknown.',
    photo: 'The last photograph: the hatch, and an unbroken wall behind it.',
    cam: { x: -45.5, y: 1.6, z: 159, yaw: Math.PI / 2, pitch: 0.1 },
  },
};

export class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.uiRoot = document.getElementById('ui');
    this.settings = new Settings();
    // test harnesses run on software rendering: ?lowgfx keeps quality minimal for this session only
    if (typeof location !== 'undefined' && location.search.includes('lowgfx')) Object.assign(this.settings.data.graphics, { quality: 'low', renderScale: 0.5, shadows: false });
    this.input = new Input(this.canvas, this.settings);
    this.profile = new Profile();
    this.saves = new Saves();
    this.audio = new Audio(this.settings);
    this.nav = new MenuNav(this.input, this.audio);
    this.game = null;
    this.pid = 'p1';
    this.slot = null;
    this.coop = false;
    this.net = null; this.netRole = null;
    this.netAvailable = false;
    this.inGame = false;
    this.state = 'boot';
    this.t = 0;
    this.applyUiSettings();
    this.settings.onChange(() => this.applyUiSettings());
    window.__depths = this;
  }

  applyUiSettings() {
    const A = this.settings.data.accessibility;
    this.uiRoot.style.setProperty('--ts', A.textScale);
    if (this.levelView) this.levelView.steadyLights = A.steadyLights;
    if (this.game) this.game.assists.reducedStartle = this.game.assists.reducedStartle || false;
  }

  async boot() {
    const bar = document.querySelector('.boot-bar > div');
    const step = document.querySelector('.boot-step');
    const setP = (k, txt) => { if (bar) bar.style.width = `${Math.round(k * 100)}%`; if (step && txt) step.textContent = txt; };
    setP(0.05, 'Starting the renderer…');
    this.engine = new Engine(this.canvas, this.settings);
    setTextureSize(this.settings.data.graphics.quality === 'low' ? 256 : 512);
    const names = TEXTURE_NAMES;
    for (let i = 0; i < names.length; i++) {
      tex(names[i]);
      if (i % 3 === 0) { setP(0.1 + 0.75 * (i / names.length), 'Painting surfaces…'); await frame(); }
    }
    setP(0.9, 'Furnishing the service desk…');
    this.photos = new PhotoRenderer(this.engine);
    this.fp = new FirstPerson(this.engine, this.settings);
    this.creatures = new CreatureView(this.engine);
    this.menuScene = new MenuScene(this.engine);
    this.hud = new Hud(this.uiRoot, this);
    this.hud.show(false);
    this.overlays = new Overlays(this.uiRoot, this);
    this.menus = new Menus(this.uiRoot, this);
    this.expeditionMenu = () => this.menus.expedition();
    this.joinMenu = () => this.menus.join();
    this.controller = new Controller(this);
    this.fadeEl = el('div', { class: 'fade' });
    this.cardEl = el('div', { class: 'card-title' });
    this.uiRoot.append(this.fadeEl, this.cardEl);
    this.profile.on((kind, data) => { if (kind === 'achievement') this.hud.toast(`Achievement · ${data.name}`); if (kind === 'finish') this.hud.toast(`Camera finish unlocked · ${data.name}`); });
    this.input.on('lockchange', (locked) => { if (!locked && this.inGame && !this.overlays.open && !this._ignoreUnlock && this.state === 'game') this.overlays.pause(); });
    window.addEventListener('pointerdown', () => this.audio.init(), { capture: true });
    window.addEventListener('keydown', () => this.audio.init(), { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.inGame && !this.coop && !this.overlays.open) this.overlays.pause(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.state === 'game' && !this.overlays.open && !this.input.captureCb) this.overlays.pause(); });
    // net availability (served by the relay server)
    if (window.__DEPTHS_SERVER__) fetch('./api/status').then((r) => (r.ok ? r.json() : null)).then((j) => { this.netAvailable = !!(j && j.relay); if (this.netAvailable && this.state === 'menu' && this.menus.at === 'main') this.menus.main(); }).catch(() => {});
    setP(1, 'Ready');
    document.getElementById('boot').classList.add('gone');
    this.toMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ================================================================ menus
  toMenu() {
    this.state = 'menu';
    this.inGame = false;
    this.hud.show(false);
    this.overlays.closeAll();
    this.input.enabled = false;
    this.input.exitLock();
    this.menuBackdrop(true);
    this.menus.main();
    this.audio.stopAll();
    this.audio.setAmbience('menu');
    this.audio.music('titleDesk');
  }

  menuBackdrop(on) {
    if (on && !this.menuOn) { this._clearLevel(); this.menuScene.attach(); this.menuOn = true; }
    if (!on && this.menuOn) { this.menuScene.detach(); this.menuOn = false; }
  }

  // ================================================================ starting
  _newGame(opts) {
    const g = new Game({ mode: opts.mode || 'campaign', difficulty: opts.difficulty || 'standard', assists: opts.assists || {}, seed: opts.seed, replay: !!opts.replay });
    g.addPlayer(this.pid, opts.character || 'evan', opts.name || 'Evan');
    return g;
  }

  startCampaign(st) {
    this.slot = st.slot;
    this.saves.erase(st.slot);
    this.saves.setLastSlot(st.slot);
    this.replay = false;
    const g = this._newGame({ difficulty: st.difficulty, assists: { noDamage: st.noDamage, timer: st.timer, reducedStartle: st.reducedStartle } });
    this._enterGame(g);
    g.loadChapter(1);
    g.makeCheckpoint('chapter start');
    if (st.mode === 'host') this.startHosting();
  }

  // ================================================================ co-op
  /** Open the current campaign to guests through the relay. */
  startHosting() {
    const g = this.game;
    if (!g || this.net) return;
    this.coop = true; this.netRole = 'host';
    const tr = connectRelay({ onClose: () => { if (this.netRole === 'host') this.hud.toast('Lost the relay connection. The campaign continues solo; your save is unaffected.'); } });
    this.net = new HostSession(g, tr, { name: this.profile.data.name || 'Host', onChange: (why) => {
      if (why === 'hosted') this.hud.toast(`Hosting · invite code ${this.net.code}`, 'tip');
    } });
  }

  /** Join a session with an invite code. */
  joinGame(code, name, slot) {
    const ident = this._ident();
    this.netRole = 'guest';
    const tr = connectRelay({ onClose: () => { if (this.netRole === 'guest' && this.game) this._netEnded('Connection to the session was lost.'); } });
    this.hud.toast('Connecting…');
    this.net = new GuestSession(tr, {
      code, name, slot, ident,
      onReady: (g, pid) => {
        this.pid = pid; this.slot = null; this.replay = true; this.coop = true;
        this._enterGame(g);
        this.hud.toast(`Joined ${this.net.code}. Waiting for a safe spawn at a refuge or chapter entry.`, 'tip');
      },
      onEnd: (msg) => this._netEnded(msg),
      onResult: (r) => { if (r && r.msg) this.onInteractResult(r); },
    });
  }
  _netEnded(msg) {
    const was = this.netRole;
    this.netRole = null;
    if (this.net) { try { this.net.close(); } catch { /* closed */ } this.net = null; }
    if (was === 'guest') { this.pid = 'p1'; this.coop = false; this.quitToMenu(); this.overlays.notice(msg || 'The session ended.'); }
  }
  _ident() {
    let id = null;
    try { id = localStorage.getItem('depths.ident'); } catch { /* blocked */ }
    if (!id) { id = `id${Math.random().toString(36).slice(2, 10)}`; try { localStorage.setItem('depths.ident', id); } catch { /* blocked */ } }
    return id;
  }

  continueSlot(n) {
    const r = this.saves.read(n);
    if (!r) { this.overlays.confirm('That save could not be read, and no valid backup exists. Start a new campaign in this slot?', () => this.menus.newCampaign()); return; }
    this.slot = n; this.replay = false;
    this.saves.setLastSlot(n);
    this.photos.load(this.saves.photos(n));
    const g = this._newGame({});
    this._enterGame(g);
    g.restore(r.snap);
    g.checkpoint = r.snap;
    if (r.from === 'backup') this.hud.toast('The newest save was damaged. Loaded the previous valid checkpoint.');
  }

  /** Expedition: a seeded twelve-room run. No campaign slot; a quit leaves a suspend snapshot. */
  startExpedition(seed) {
    this.slot = null; this.replay = true; this.expedition = true;
    this.saves.clearSuspend();
    const g = this._newGame({ replay: true });
    g.mode = 'expedition';
    this._enterGame(g);
    try { startExpedition(g, seed, addToPouch); } catch (e) { console.error(e); this.quitToMenu(); this.hud.toast('That seed could not be generated.'); return; }
    this.hud.toast(`Expedition ${g.expedition.seedText} · ${g.expedition.theme}`);
  }
  resumeExpedition() {
    const snap = this.saves.suspend();
    if (!snap) return;
    this.saves.clearSuspend(); // a suspend is consumed when resumed
    this.slot = null; this.replay = true; this.expedition = true;
    const g = this._newGame({ replay: true });
    this._enterGame(g);
    g.restore(snap);
    g.checkpoint = snap;
  }
  _expeditionResult(ev) {
    const g = this.game;
    const run = { seed: g.expedition.seed, seedText: g.expedition.seedText, theme: g.expedition.theme, success: !!ev.success, time: Math.round(g.elapsed), photos: g.stats.photos, downs: g.stats.downs, at: Date.now() };
    const X = this.profile.data.expedition;
    X.runs = [run, ...(X.runs || [])].slice(0, 20);
    if (run.success) { X.completed = (X.completed || 0) + 1; this.profile.unlock('A17'); }
    this.profile.persist();
    this.saves.clearSuspend();
    this.input.exitLock();
    this.overlays.expeditionResult(run, {
      retry: () => { const seed = run.seed; this.quitToMenu(); this.startExpedition(seed); },
      fresh: () => { this.quitToMenu(); this.startExpedition((Math.random() * 32 ** 6) >>> 0); },
      menu: () => { this.quitToMenu(); this.menus.expedition(); },
    });
  }

  startReplay(ch) {
    this.slot = null; this.replay = true;
    const g = this._newGame({ replay: true });
    // previously collected proof is carried into the replay instance
    for (const e of Object.keys(this.profile.data.evidence)) { g.persist.evidence[e] = true; g.story.flags[e] = true; }
    for (const id of Object.keys(this.profile.data.records)) g.persist.records[id] = true;
    this._enterGame(g);
    const def = CHAPTERS[ch];
    if (def.replayFlags) for (const f of def.replayFlags) g.story.flags[f] = true;
    g.loadChapter(ch, { entry: 'replay' });
    const kit = def.replayKit || {};
    for (const p of g.players.values()) { p.hasFlashlight = kit.flashlight !== false; p.hasCamera = kit.camera !== false; if (kit.pouch) for (const [item, n] of kit.pouch) addToPouch(p, item, n); }
    g.makeCheckpoint('chapter start');
  }

  _enterGame(g) {
    this.menus.close();
    this.menuBackdrop(false);
    this.overlays.closeAll();
    this.game = g;
    this.state = 'game';
    this.inGame = true;
    this.hud.show(true);
    this.controller.reset();
    this.input.enabled = true;
    this.input.requestLock();
    this.fp.setCharacter(g.players.get(this.pid).slot);
    this.fp.setFinish((FINISHES.find((f) => f.id === this.profile.data.finish) || FINISHES[0]).color);
    this.audio.init();
  }

  _clearLevel() {
    if (this.levelView) { this.levelView.dispose(); this.levelView = null; }
    if (this.lights) { this.lights.dispose(); this.lights = null; }
    this.creatures.clear();
  }

  _buildLevel() {
    this._clearLevel();
    const g = this.game;
    this.levelView = new LevelView(this.engine, g, { shadows: this.engine.renderer.shadowMap.enabled });
    this.levelView.steadyLights = this.settings.data.accessibility.steadyLights;
    this.lights = new LightRig(this.engine, g.level, this.settings);
    const def = g.chapterDef;
    const kit = KITS[def.kit] || KITS.office;
    this.engine.scene.fog = new THREE.FogExp2(def.fog ? def.fog.color : kit.fog, def.fog ? def.fog.density : 0.035);
    this.engine.hemi.intensity = def.hemi ?? 0.32;
    this.audio.setAmbience(def.ambient || def.kit);
    this.decoyLoops = new Set();
  }

  // ================================================================ in-game actions
  retry() {
    this.overlays.closeAll();
    this.game.retry();
    this.input.requestLock();
  }
  quitToMenu() {
    if (this.net) { const n = this.net; this.net = null; this.netRole = null; try { n.close(); } catch { /* closed */ } }
    this.pid = 'p1'; this.coop = false;
    this.game = null; this.expedition = false; this._clearLevel(); this.toMenu();
  }
  /** Quitting an Expedition keeps a suspend snapshot (consumed when resumed). */
  suspendExpedition() {
    const g = this.game;
    if (g && g.mode === 'expedition' && !g.over) this.saves.writeSuspend(g.serialize());
    this.quitToMenu();
  }
  saveAndQuit() {
    const g = this.game;
    if (this.slot && g.checkpoint) this.saves.write(this.slot, g.checkpoint, this.photos.exportThumbs(g.checkpoint.photos.map((p) => p.id)));
    this.quitToMenu();
  }
  manualSave() {
    if (!this.slot) return false;
    const snap = this.game.serialize();
    return this.saves.manualSave(this.slot, snap) >= 0;
  }
  confirm(text, yes) { this.overlays.confirm(text, yes); }
  puzzleAction(id, a) { return this.game.puzzleAction(this.pid, id, a); }
  pouch(slot, a, arg) { return this.game.pouchAction(this.pid, slot, a, arg); }
  requestHint() { this.game.requestHint(this.pid); }
  replayRadio() { const S = this.game.story; this.hud.setObjective(S.objective.text, S.radio && S.radio.text); if (S.lastLine) this.hud.line({ ...S.lastLine, dur: 4 }); }
  onInteractResult(r) { if (r && r.msg && r.ok === false) this.hud.toast(r.msg); }
  onOverlayChange() {
    if (!this.inGame) return;
    if (this.overlays.open) { this.input.exitLock(); this._ignoreUnlock = true; } else { this._ignoreUnlock = false; this.input.requestLock(); }
  }

  // ================================================================ loop
  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.input.poll();
    this.nav.poll(dt);
    if (this.state === 'menu') {
      this.menuScene.update(dt, this.t);
      this.engine.render(dt, false);
    } else if (this.state === 'game' && this.game) {
      this._frameGame(dt);
    }
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  _frameGame(dt) {
    const g = this.game;
    const blocked = this.overlays.open;
    if (this.input.pressed('pause') && !this.overlays.open) this.overlays.pause();
    g.paused = (!this.coop && this.overlays.pausing) || !!g.sharedPause;
    this.controller.update(dt, g, this.pid, blocked);
    if (!g.paused) g.tick(dt);
    const evs = g.drainEvents();
    if (this.netRole === 'host' && this.net) this.net.update(dt, evs);
    this._handleEvents(evs);
    if (this.state !== 'game' || this.game !== g) return;
    const p = g.players.get(this.pid);
    // view
    if (this.levelView) this.levelView.update(dt);
    this.creatures.sync(g, dt);
    this.creatures.syncNpcs(g, dt);
    this.creatures.syncMates(g, this.pid, dt);
    this.creatures.updateDecals(dt);
    const cam = this.engine.camera;
    this.fp.update(dt, g, p, cam, { inspect: this.controller.inspect });
    if (this.lights) this.lights.update(dt, g, cam, p);
    this.audio.setListener(cam.position.x, cam.position.y, cam.position.z, p.yaw);
    this._effects(dt, g, p);
    // HUD
    const target = blocked ? null : g.findTarget(this.pid);
    const desc = target ? g.describe(this.pid, target) : null;
    let extra = null;
    if (!target && p.tool === 'camera' && this.controller.inspect) {
      this._aimT = (this._aimT || 0) - dt;
      if (this._aimT <= 0) { this._aimT = 0.2; this._aim = g.aimHint(this.pid); }
      if (this._aim && !this._aim.ok) extra = this._aim.text;
    }
    this.hud.update(dt, g, p, cam, { target, desc, extraPrompt: extra });
    this.overlays.update(dt);
    this.engine.render(dt, !p.hidden && !p.spectating);
  }

  _effects(dt, g, p) {
    const A = this.settings.data.accessibility, fx = this.engine.fxState;
    fx.damage = Math.max(0, fx.damage - dt * 1.5);
    fx.flash = Math.max(0, fx.flash - dt * 3);
    fx.lowHealth = A.damageVignette && p.health <= 25 && p.alive ? 1 : 0;
    const stress = A.stressEffects ? Math.max(0, (40 - p.composure) / 40) : 0;
    fx.desat += ((A.stressEffects ? (1 - p.composure / 100) * 0.35 : 0) - fx.desat) * Math.min(1, dt * 2);
    fx.extraGrain = stress * 0.05;
    const tr = g.transition;
    const fadeTarget = tr ? Math.min(1, tr.t !== undefined ? 1 : 1) : (this._fadeHold > 0 ? 1 : 0);
    if (tr) tr.t = (tr.t || 0) + dt;
    this._fadeHold = Math.max(0, (this._fadeHold || 0) - dt);
    this.fadeEl.style.opacity = String(Math.max(fadeTarget, this._fade || 0));
    this._fade = Math.max(0, (this._fade || 0) - dt * 0.6);
    // pursuit heartbeat (threat cue, independent of stress effects)
    const hunted = g.enemies.some((c) => !c.gone && c.state === 'pursue' && c.target === this.pid);
    this.audio.heartbeat(hunted ? 0.8 : (A.stressEffects && p.composure < 40 ? 0.3 : 0));
    if (hunted && !this._hunted) this.audio.music('pursuit');
    if (!hunted && this._hunted) { this.audio.music(null); }
    this._hunted = hunted;
    // low composure: occasional distant nonverbal sounds
    if (A.stressEffects && p.composure < 40 && Math.random() < dt / 18) this.audio.play(Math.random() < 0.5 ? 'distantDoor' : 'pipeKnock', { x: p.x + (Math.random() - 0.5) * 20, z: p.z + (Math.random() - 0.5) * 20 });
    // refuge clock ticking and charger hum
    const room = g.level.room(p.room);
    const ref = room && room.refugeData;
    this.audio.loop('clock', 'clock', !!(ref && ref.genuine), ref ? { x: ref.clock.x, y: ref.clock.y, z: ref.clock.z } : {});
    this.audio.loop('charger', 'chargerHum', !!(ref && ref.genuine), ref ? { x: ref.items[2].x, y: 1, z: ref.items[2].z } : {});
    // ordinary outdoor sound growing toward the exterior thresholds (chapter six)
    const outside = { '6.11F': { x: 8, z: 226 }, '6.12F': { x: 8, z: 226 }, '6.12R': { x: 66, z: 159 }, '6.12X': { x: -51, z: 159 } }[p.room];
    this.audio.loop('outdoor', 'outdoor', !!outside, outside ? { x: outside.x, y: 2, z: outside.z } : {});
    // running machines (chapter five)
    for (const m of Object.values(g.story.vars.machines || {})) this.audio.loop(`machine:${m.id}`, 'machine', !!(m.enabled && m.running), { x: m.x, y: 1.2, z: m.z });
  }

  // ================================================================ events
  _handleEvents(events) {
    const g = this.game, me = this.pid;
    const A = this.settings.data.accessibility;
    for (const ev of events) {
      const mine = !ev.pid || ev.pid === me;
      switch (ev.e) {
        case 'chapterLoaded':
          this._buildLevel();
          if (ev.entry === 'start' || ev.entry === 'replay') this.titleCard(ev.id);
          if (ev.entry === 'return') this.titleCard(ev.id, 'Return trip');
          break;
        case 'line': this.hud.line(ev); this.audio.voice(ev.sp, ev.src, ev.text, ev.dur); break;
        case 'objective': this.hud.setObjective(ev.text, g.story.radio && g.story.radio.text); break;
        case 'radioClaim': if (ev.text) this.hud.setObjective(g.story.objective.text, ev.text); break;
        case 'clue': this.hud.toast(`Journal · ${ev.text}`); break;
        case 'sfx': this.audio.play(ev.name, ev.x !== undefined ? { x: ev.x, y: ev.y, z: ev.z } : {}); break;
        case 'step': {
          const p = g.players.get(ev.pid);
          if (ev.pid === me) this.audio.play('step', { surface: ev.surface, sprint: ev.sprint, crouch: ev.crouch });
          else if (p) this.audio.play('step', { x: ev.x, y: 0.1, z: ev.z, surface: ev.surface, sprint: ev.sprint, crouch: ev.crouch });
          break;
        }
        case 'door': if (ev.type === 'shutter') this.audio.play('shutterWarn', { x: ev.x, z: ev.z }); else if (ev.type === 'gate' || ev.type === 'lift') this.audio.play('gateWheel', { x: ev.x, z: ev.z }); break;
        case 'warning': this._warning(ev); break;
        case 'creatureEmerge': this.audio.play('listenerHiss', { x: ev.x, z: ev.z }); this.audio.play('stinger', { soft: A.reducedStartle || !A.startlePeaks }); break;
        case 'hit':
          if (ev.pid === me) {
            this.fp.hit(ev.noDamage ? 0.3 : 1);
            if (!ev.noDamage) this.engine.fxState.damage = A.damageVignette ? 0.8 : 0;
            this.audio.play('hit');
            this.input.rumble(0.8, 0.4, 250);
            const p = g.players.get(me);
            if (ev.dir !== undefined) this.hud.blip(ev.dir - p.yaw, true);
          }
          break;
        case 'coopJoin': this.hud.toast(`${ev.name} joined the crew.`); break;
        case 'coopLeave': this.hud.toast(`${ev.name} ${ev.why === 'stalled' ? 'lost connection' : 'left'}. Their supplies are in a bag at the next refuge.`); break;
        case 'chat': this.hud.envCaption(`${ev.name}: ${ev.text}`, { dur: 6 }); this.audio.play('radioClick'); break;
        case 'coopSpawn': this.hud.toast(ev.pid === me ? 'You are with the crew.' : `${ev.name} is with the crew.`); break;
        case 'pauseVote': this.hud.toast(`${ev.name} asked to pause (${ev.votes} of ${ev.of}). Everyone must agree.`); break;
        case 'sharedPause': this.hud.toast(ev.on ? 'Paused by vote. Any player can resume.' : 'Resumed.', 'tip'); this.hud.cinematic(false); break;
        case 'resumeCountdown': this.hud.toast(`${ev.name} is resuming: 3 · 2 · 1`); break;
        case 'moreTime': this.hud.toast(`${ev.name || 'A crew member'} asked for more time. The final gate is held for thirty seconds.`, 'tip'); break;
        case 'death': this.audio.play('death'); this.input.exitLock(); if (g.mode === 'expedition') this._expeditionResult({ success: false, cause: ev.creature }); else this.overlays.death({ ...ev, kind: 'death' }); break;
        case 'expeditionDone': this.audio.play('success'); this._expeditionResult(ev); break;
        case 'wipe': this.audio.play('death'); this.input.exitLock(); if (g.mode === 'expedition') { this._expeditionResult({ success: false }); break; } this.overlays.death({ ...ev, kind: 'wipe', creature: 'The party', hint: 'Revive downed crew before their timer runs out, and regroup at refuges.' }); break;
        case 'photoTaken': this._photo(ev); break;
        case 'record': if (mine) { this.overlays.reader(ev.title, ev.text, { audio: ev.audio, collectedCopy: !ev.first }); if (ev.first) this.hud.toast(`Record ${ev.id} collected · ${ev.title}`); } break;
        case 'note': if (mine) this.overlays.reader(ev.title, ev.text, { kind: 'Note' }); break;
        case 'panel': if (mine) this.overlays.panel(ev.puzzle); break;
        case 'mapboard': if (mine) this.overlays.mapboard(); break;
        case 'deck': if (mine) this.overlays.deck(); break;
        case 'message': if (mine) this.hud.toast(ev.text); break;
        case 'aimHint': if (mine) this.hud.toast(ev.text); break;
        case 'tutorial': if (!this._tips) this._tips = {}; if (!this._tips[ev.id]) { this._tips[ev.id] = true; this.hud.toast(ev.text, 'tip'); } break;
        case 'checkpoint': this._checkpoint(ev); break;
        case 'verified': if (mine) { this.audio.play('verified'); this.hud.toast(ev.first ? `${ev.label || 'Refuge'} verified. The second hand is moving.` : 'Refuge verified.'); } break;
        case 'clockStopped': if (mine) { this.hud.envCaption('The second hand does not move.', { warn: true, dur: 4 }); } break;
        case 'refugeSecured': this.hud.toast('Refuge secured. Pursuit cleared.'); break;
        case 'profile': this.profile.apply(ev); break;
        case 'achievementHint': if (ev.id === 'A15') this.profile.unlock('A15'); break;
        case 'chapterComplete': this.profile.apply({ kind: 'chapter', id: ev.chapter }); break;
        case 'transition': this._fadeHold = ev.dur; this.audio.play(ev.kind === 'lift' ? 'liftHum' : 'gateWheel'); break;
        case 'decoy': this.audio.play('decoyWind', { x: ev.x, z: ev.z }); this.audio.loop(`decoy:${ev.id}`, 'decoy', true, { x: ev.x, y: 0.5, z: ev.z, bus: 'threat' }); setTimeout(() => this.audio.loop(`decoy:${ev.id}`, null, false), ev.dur * 1000); if (A.envCaptions) this.hud.envCaption('[Windup decoy ringing]', { dur: 3 }); break;
        case 'hint': if (mine) { this.hud.hint(ev.text, ev.stage, ev.of); this.audio.play('hint'); if (ev.nav && A.navAssist) { const d = g.level.door(ev.nav); if (d) this.hud.navTo(d, 'Next doorway'); } } break;
        case 'callout': this.hud.envCaption(`${g.players.get(ev.pid)?.name || ''}: ${ev.text}`, { dur: 3 }); this.audio.voice(ev.slot, 'local', ev.text, 1.2); break;
        case 'ping': this.hud.ping(ev); break;
        case 'extraStep': this.audio.play('extraStep', { x: ev.x, z: ev.z }); break;
        case 'ventShake': this.audio.play('ventShake', { x: ev.x, z: ev.z }); break;
        case 'transform': this._fade = 0.35; this.audio.play('stinger', { soft: true }); break;
        case 'network': this.hud.toast(`Network diagram · ${ev.segment} restored`); break;
        case 'toolGained': this.hud.toast(ev.tool === 'flashlight' ? 'Flashlight' : 'Instant camera · 8 exposures'); break;
        case 'pickup': if (mine) this.hud.toast(`${ev.n > 1 ? ev.n + ' × ' : ''}${ITEM_NAMES[ev.item] || ev.item}${ev.left ? ` (${ev.left} left, pouch full)` : ''}`); break;
        case 'ambientEvent': this.audio.play(ev.kind, { x: ev.x, z: ev.z }); if (A.envCaptions && ev.kind === 'wallTap') this.hud.envCaption('[Distant tapping]', { dur: 2.5 }); break;
        case 'radioInterference': this.audio.play('radioClick'); break;
        case 'radioReplay': if (mine) { this.hud.setObjective(ev.objective, ev.radio); if (ev.last) this.hud.line({ ...ev.last, dur: 4 }); } break;
        case 'puzzleDone': this.audio.play('success'); this._musicSting(); break;
        case 'downed': if (ev.pid === me) this.hud.toast('You are down. Crawl toward your crew; they can revive you.'); else this.hud.toast(`${g.players.get(ev.pid)?.name} is down.`); break;
        case 'revived': this.hud.toast(`${g.players.get(ev.pid)?.name} revived.`); break;
        case 'spectator': if (ev.pid === me) this.hud.toast('Spectating until the crew reaches a refuge.'); break;
        case 'respawn': if (ev.pid === me) this.hud.toast('Rejoined at the refuge.'); break;
        case 'locker': if (ev.pid === me) this.audio.play('doorClose'); break;
        case 'breathe': this.audio.play('breathe'); break;
        case 'restored': this.hud.toast('Checkpoint loaded.'); break;
        case 'error': console.error('[sim]', ev.message); break;
        case 'levelErrors': console.warn('[level]', ev.errors); break;
        case 'silhouettesTurn': if (this.levelView) setTimeout(() => this.levelView && this.levelView.turnSilhouettes(), 2500); if (A.envCaptions) setTimeout(() => this.hud.envCaption('[Every figure in the food court turns its head at once]', { dur: 3 }), 2600); break;
        case 'cutoutPinned': if (A.envCaptions) this.hud.envCaption('[Flash: the figure is pinned for four seconds]', { dur: 2.5 }); break;
        case 'zoneTest': this.audio.play('tone'); break;
        case 'announcement': this.audio.voice('operator', 'speaker', 'Attention shoppers. The mall is now closed. Please make your way to the nearest exit.', 12); this.hud.line({ sp: 'operator', src: 'speaker', text: 'Attention shoppers. The mall is now closed. Please make your way to the nearest exit.', dur: 6 }); break;
        case 'cycleClosed': this.audio.play('doorSlam'); break;
        case 'caption': this.hud.envCaption(ev.text, { dur: 4 }); break;
        case 'curtains': this.audio.play('paperRub', {}); break;
        case 'creatureKnock': if (A.envCaptions) this.hud.envCaption('[Three knocks]', { dur: 2.5 }); break;
        case 'stream': this.audio.play('splash', { x: ev.x, z: ev.z }); break;
        case 'tileCrack': this.audio.play('crack', { x: ev.x, z: ev.z }); break;
        case 'tileLit': this.audio.play('tone'); break;
        case 'npcArrived': break;
        case 'footprint': if (this.creatures) this.creatures.addDecal('footprint', ev.x, ev.z, this._floorAt(ev.x, ev.z), ev.yaw || 0, { wet: ev.wet, delay: ev.delay }); break;
        case 'floorDent': if (this.creatures) this.creatures.addDecal('dent', ev.x, ev.z, this._floorAt(ev.x, ev.z)); if (A.envCaptions) this.hud.envCaption(`[Floor dent ${ev.n} of 3]`, { warn: true, dur: 1.2 }); this.input.rumble(0.2, 0.3, 120); break;
        case 'countdown': this.hud.countdown(ev.left); if (ev.left <= 10) this.audio.play('tone'); break;
        case 'committed': this.hud.toast(`Route committed · ${{ familiar: 'Full transmission', door: 'Maintenance bypass', cut: 'Emergency isolation' }[ev.route]}`); break;
        case 'endingStart': this.hud.cinematic(true); this.hud.countdown(null); this.audio.music(null); break;
        case 'endingDone': this._ending(ev); break;
        case 'machine': {
          if (ev.running) this.audio.play('pressHit', { x: ev.x, z: ev.z });
          const pp = g.players.get(me);
          if (A.envCaptions && pp && Math.hypot(ev.x - pp.x, ev.z - pp.z) < 16) this.hud.envCaption(ev.running ? `[${ev.label} running: footsteps covered]` : `[${ev.label} at rest]`, { dur: 2 });
          break;
        }
        case 'caretakerNegotiates': if (A.envCaptions) this.hud.envCaption(`[Behind you, it stops at the ${ev.what}. Tools scrape]`, { dur: 3 }); break;
        case 'testLight': if (this.lights) this.lights.flash({ x: -1.2, y: 2.2, z: 81.2 }, 30, 1.2); this.audio.play('tone'); break;
        default: if (this.extraEvent) this.extraEvent(ev); break;
      }
    }
  }

  _warning(ev) {
    const A = this.settings.data.accessibility;
    const g = this.game, p = g.players.get(this.pid);
    const ang = Math.atan2(-(ev.x - p.x), -(ev.z - p.z)) - p.yaw;
    const dir = dirWord(ang);
    this.hud.envCaption(ev.text, { warn: true, dir, dur: 4 });
    this.hud.blip(ang, true);
    for (const s of WARN_SFX[ev.type] || []) this.audio.play(s, { x: ev.x, z: ev.z });
    if (ev.target === this.pid) this.input.rumble(0.3, 0.6, 300);
    void A;
  }

  _photo(ev) {
    const g = this.game;
    const ph = ev.photo;
    const local = ev.pid === this.pid;
    const extra = this.creatures.photoStandIns(ph, g);
    let res = null;
    try { res = this.photos.capture(ph, extra); } catch (e) { console.error('photo render failed', e); }
    if (!local) return;
    const A = this.settings.data.accessibility;
    if (ev.station) { this.audio.play('stationDone'); }
    else {
      this.audio.play('shutter');
      if (ph.flash) { this.audio.play('flashPop'); this.engine.fxState.flash = 0.85 * A.flashIntensity; if (this.lights) this.lights.flash(ph.cam, 60 * Math.max(0.3, A.flashIntensity)); }
    }
    if (res) this.hud.polaroidDevelop(res.url, `${ph.roomName || ''}${ev.station ? ' · survey station' : ''}`, ev.develop || 0.6);
  }

  _floorAt(x, z) { const nav = this.game.level.nav, i = nav.indexAt(x, z); const y = i >= 0 ? nav.floorY[i] : 0; return Number.isFinite(y) ? y : 0; }

  /** The ending scene has played: develop the last photograph, show the card, credits, post-credits. */
  _ending(ev) {
    const g = this.game, june = ev.june;
    const E = ENDING_TEXT[ev.ending];
    let photo = null;
    try { photo = this.photos.capture({ id: 'ending', cam: E.cam, flash: false }).url; } catch (e) { console.error('ending photo failed', e); }
    let finale = null;
    if (this.slot && !this.replay) {
      finale = this.saves.finale(this.slot);
      if (finale) this.saves.write(this.slot, finale, this.photos.exportThumbs((finale.photos || []).map((p) => p.id)));
    }
    this.input.exitLock();
    this.hud.cinematic(false);
    const info = { ending: ev.ending, slot: this.slot, finale: !!finale };
    this.overlays.ending({ title: E.title, epilogue: [...E.text, june ? E.june : E.noJune], photo, photoText: E.photo }, () => { this.quitToMenu(); this.menus.credits(() => this.menus.postCredits(info)); });
    void g;
  }

  _checkpoint(ev) {
    const g = this.game;
    if (ev.reason === 'finale' && this.slot && !this.replay) this.saves.writeFinale(this.slot, g.checkpoint);
    if (g.mode === 'expedition' && ev.reason !== 'expedition start') this.saves.writeSuspend(g.checkpoint); // a crash keeps the last refuge snapshot
    if (this.replay || !this.slot) { this.hud.saved('Checkpoint'); return; }
    const ok = this.saves.write(this.slot, g.checkpoint, this.photos.exportThumbs(g.checkpoint.photos.map((p) => p.id)));
    if (ok) { this.hud.saved('Saved'); this.audio.play('save'); }
    else this.hud.toast('Could not save. Your previous checkpoint is intact.');
    void ev;
  }

  _musicSting() {
    const cue = this.game.chapterDef.music || 'wrongCorridor';
    if (this._hunted) return;
    this.audio.music(cue);
    clearTimeout(this._mt);
    this._mt = setTimeout(() => { if (!this._hunted) this.audio.music(null); }, 80000);
  }

  titleCard(ch, kicker) {
    const n = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][ch] || ch;
    this.cardEl.innerHTML = '';
    const X = ch === 'X' && this.game && this.game.expedition;
    this.cardEl.append(el('div', { class: 'k' }, X ? `Expedition · ${X.seedText}` : kicker || `Chapter ${n}`), el('div', { class: 'n' }, X ? `${{ office: 'The Office', mall: 'The Mall', pool: 'The Pool', apartments: 'The Residences', industrial: 'The Lower Plant' }[X.theme] || ''}` : CHAPTER_NAMES[ch] || ''));
    this.cardEl.style.transition = 'none'; this.cardEl.style.opacity = 1;
    setTimeout(() => { this.cardEl.style.transition = 'opacity 2s'; this.cardEl.style.opacity = 0; }, 3500);
    this._musicSting();
  }
}

const ITEM_NAMES = { bandage: 'Bandage', firstaid: 'First aid kit', tea: 'Calming tea', battery: 'Battery cell', film: 'Film pack', decoy: 'Windup decoy', chalk: 'Chalk stick', wedge: 'Door wedge' };

function dirWord(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  const d = a * 180 / Math.PI;
  if (Math.abs(d) < 35) return 'ahead';
  if (Math.abs(d) > 145) return 'behind you';
  return d > 0 ? 'to your left' : 'to your right';
}
function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }
void CREATURES;
