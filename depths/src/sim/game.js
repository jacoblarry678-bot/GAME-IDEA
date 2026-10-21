/**
 * Game: the authoritative simulation. Owns the level, players, creatures,
 * puzzles, story, director, checkpoints and the presentation event queue.
 * It has no rendering or DOM dependency, so the same code runs the solo game,
 * the co-op host, the headless tests and the scripted playthroughs.
 */
import { Level } from './level.js';
import { Player, stepMovement, tryMantle } from './player.js';
import { Story } from './story.js';
import { Director } from './director.js';
import { createCreature } from './enemies/index.js';
import { createPuzzle } from './puzzles/index.js';
import { CHAPTERS } from '../data/chapters/index.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { CREATURES } from '../data/creatures.js';
import { RECORDS } from '../data/records.js';
import { ITEMS, HEAL_ITEMS } from '../data/items.js';
import { Rng } from '../core/rng.js';
import * as act from './interact.js';
import * as eq from './equipment.js';
import { updateRefuges } from './refuge.js';
import { updateCycles } from './shutters.js';
import { updateMachines } from './machines.js';
import { buildExpeditionDef } from './expedition.js';

export const SAVE_VERSION = 1;

export class Game {
  constructor(opts = {}) {
    this.mode = opts.mode || 'campaign';
    this.difficulty = opts.difficulty || 'standard';
    this.D = DIFFICULTY[this.difficulty];
    this.assists = { noDamage: false, timer: false, reducedStartle: false, ...(opts.assists || {}) };
    this.seed = opts.seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.rng = new Rng(this.seed);
    this.time = 0;
    this.elapsed = 0;
    this.events = [];
    this.players = new Map();
    this.story = new Story(this);
    this.director = new Director(this);
    this.persist = { evidence: {}, records: {}, secrets: {}, refuges: {}, endings: {} };
    this.photos = [];
    this.photoSeq = 1;
    this.enemies = [];
    this.puzzles = new Map();
    this.pickups = {};
    this.dropped = [];
    this.marks = [];
    this.decoys = [];
    this.timers = [];
    this.soundQueue = [];
    this.chapterId = null;
    this.chapterDef = null;
    this.script = null;
    this.level = null;
    this.checkpoint = null;
    this.checkpointReason = '';
    this.pendingCheckpoint = null;
    this.paused = false;
    this.over = null; // { kind: 'death'|'ending'|'wipe', ... }
    this.scripted = false;
    this.transition = null;
    this.lastProgressAt = 0;
    this.map = { rooms: {}, doors: {} };
    this.refugeVisits = {};
    this.stats = { downs: 0, deaths: 0, photos: 0, damageInPursuit: {} };
    this.hostId = opts.hostId || 'p1';
    this.replay = !!opts.replay; // chapter select instance
    this.profile = opts.profile || null;
    this.parked = null;
  }

  // ================================================================ setup
  addPlayer(id, slot = 'evan', name = '', opts = {}) {
    const p = new Player(id, slot, name || slot);
    p.local = opts.local !== false;
    p.remote = !!opts.remote;
    this.players.set(id, p);
    if (this.level) this.placePlayer(p);
    return p;
  }

  activeCount() { let n = 0; for (const p of this.players.values()) if (p.active) n++; return Math.max(1, n); }
  livingCount() { let n = 0; for (const p of this.players.values()) if (p.alive) n++; return n; }
  anyLivingPlayer() { for (const p of this.players.values()) if (p.alive) return p; return null; }
  enemyById(id) { return this.enemies.find((e) => e.id === id); }

  /** Load a chapter (or a return trip). entry: 'start' | 'restore' | 'return' | 'replay' */
  loadChapter(id, { entry = 'start', snapshot = null, returnTo = null } = {}) {
    const def = CHAPTERS[id] || (this.customDefs && this.customDefs[id]);
    if (!def) throw new Error(`no chapter ${id}`);
    this.chapterId = id;
    this.returnTrip = entry === 'return' ? (returnTo || true) : null;
    const levelDef = entry === 'return' && def.returnTrip ? def.returnTrip(def) : def;
    this.chapterDef = levelDef;
    this.script = def.script || {};
    this.level = new Level(levelDef);
    this.level.flagFn = (f) => this.story.has(f);
    if (this.level.errors.length) this.fx('levelErrors', { errors: this.level.errors });
    this.enemies = [];
    this.npcs = [];
    this.puzzles = new Map();
    for (const pd of levelDef.puzzles || []) this.puzzles.set(pd.id, createPuzzle(this, pd));
    this.pickups = {};
    for (const it of this.level.interactables) if (it.kind === 'pickup') this.pickups[it.id] = { taken: false, qty: this.pickupQty(it) };
    this.dropped = [];
    this.marks = [];
    this.decoys = [];
    this.timers = [];
    this.soundQueue = [];
    this.scripted = false;
    this.transition = null;
    this.alcoves = this._alcoveCells();
    this.map = { rooms: {}, doors: {} };
    this.refugeSecured = {};
    // coming back from a side trip (or the final refuge lift): the chapter resumes where it was parked
    const parked = !snapshot && this.parked && this.parked.chapter === id && levelDef.entries && levelDef.entries[entry] ? this.parked : null;
    if (snapshot) this._restoreChapterState(snapshot);
    else if (parked) {
      this.parked = null;
      this._restoreChapterState(parked);
      for (const p of this.players.values()) this.placePlayer(p, entry);
    } else {
      for (const p of this.players.values()) this.placePlayer(p, entry);
      // apply puzzle completion carried in the story (return trips, replays)
      for (const pz of this.puzzles.values()) if (this.story.has(`${pz.id}.done`)) pz.done = true;
    }
    this._syncDoorsToFlags(true);
    this.chapterLoadedAt = this.time;
    if (entry === 'start' || entry === 'replay') this.story.vars.sharedShift = this.activeCount() >= 2; // A16 needs two active players from entry to exit
    if (this.script.init) this.script.init(this, entry);
    this.fx('chapterLoaded', { id, entry, title: def.title });
    this.lastProgressAt = this.time;
    for (const p of this.players.values()) this._enterRoom(p, true);
  }

  placePlayer(p, entry = 'start') {
    const def = this.chapterDef;
    const st = (def.entries && def.entries[entry]) || (entry === 'return' && def.returnStart) || def.start;
    const idx = [...this.players.keys()].indexOf(p.id);
    const offs = [[0, 0], [0.9, 0.6], [-0.9, 0.6], [0, 1.2]][idx % 4];
    const s = Math.sin(st.yaw), c = Math.cos(st.yaw);
    p.x = st.x + offs[0] * c + offs[1] * s; p.z = st.z - offs[0] * s + offs[1] * c;
    p.y = (this.level.roomAt(p.x, p.z) || { floorY: 0 }).floorY || 0;
    p.yaw = st.yaw; p.pitch = 0;
    p.vx = p.vy = p.vz = 0;
    p.lastSafe = { x: p.x, y: p.y, z: p.z };
    p.room = null;
  }

  /** Critical pickups scale with the party; optional ones with difficulty. */
  pickupQty(it) {
    const n = this.activeCount();
    if (it.perPlayer) return it.perPlayer * n;
    if (it.perTwo) return Math.ceil(n / 2) * it.perTwo;
    const base = it.qty || 1;
    if (it.route === 'optional') {
      const s = this.D.supply;
      if (s === 1) return base;
      // deterministic: hash of the pickup id decides who rounds up or down
      let h = 0; for (const ch of it.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const frac = (h % 100) / 100;
      const v = base * s;
      return Math.floor(v) + (frac < v - Math.floor(v) ? 1 : 0);
    }
    return base;
  }

  _alcoveCells() {
    const nav = this.level.nav, out = new Map();
    for (const s of this.level.stations) {
      if (!s.alcove) continue;
      const [x0, z0, x1, z1] = s.alcove;
      for (let x = x0; x <= x1; x += 0.25) for (let z = z0; z <= z1; z += 0.25) { const i = nav.indexAt(x, z); if (i >= 0) out.set(i, s); }
    }
    return out;
  }

  blockedForCreatures(i) {
    const s = this.alcoves.get(i);
    if (s && s.puzzle && !this.isPuzzleDone(s.puzzle)) return true;
    for (const b of this.creatureBlocks || []) if (b(i)) return true;
    return false;
  }
  isPuzzleDone(id) { const p = this.puzzles.get(id); return p ? p.done : this.story.has(`${id}.done`); }

  // ================================================================ events
  fx(e, data = {}) { this.events.push({ ...data, e, t: this.time }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  progress() { this.lastProgressAt = this.time; }

  after(seconds, key, data = null) { this.timers.push({ at: this.time + seconds, key, data }); }
  cancelTimer(key) { this.timers = this.timers.filter((t) => t.key !== key); }

  emitSound(ev) {
    if (!this.level) return;
    this.soundQueue.push({ ...ev, t: this.time });
    if (ev.kind !== 'step' && ev.kind !== 'ambient' && ev.kind !== 'machineLoop') this.fx('noise', { x: ev.x, z: ev.z, r: ev.r, kind: ev.kind, player: ev.player || null });
  }

  // ================================================================ tick
  tick(dt) {
    if (!this.level || this.paused) return;
    dt = Math.min(dt, 0.05);
    if (this.over && this.over.kind !== 'endingPlay') return;
    this.time += dt;
    if (!this.transition) this.elapsed += dt;
    const L = this.level;
    L.updateDoors(dt);
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time);
        for (const t of due) this._timer(t);
      }
    }
    // players
    for (const p of this.players.values()) {
      if (!p.active) continue;
      if (!p.remote && !this.over) {
        const step = stepMovement(this, p, dt);
        if (step) this._footstep(p, step);
      }
      eq.updatePlayer(this, p, dt);
      act.updateAction(this, p, dt);
      this._enterRoom(p);
      if (p.downed) this._updateDowned(p, dt);
    }
    updateRefuges(this, dt);
    if (this.story.vars.sharedShift && this.activeCount() < 2) this.story.vars.sharedShift = false;
    if (this.story.vars.cycles) updateCycles(this, dt);
    if (this.story.vars.machines) updateMachines(this, dt);
    // decoys
    for (const d of this.decoys) {
      if (d.until > this.time) {
        d.acc = (d.acc || 0) + dt;
        if (d.acc >= 1) { d.acc = 0; this.emitSound({ x: d.x, z: d.z, r: d.kind === 'stream' ? 30 : ITEMS.decoy.decoy.r, kind: d.kind || 'decoy', source: d.id }); }
      }
    }
    this.decoys = this.decoys.filter((d) => d.until > this.time - 1);
    // sound → creatures
    const sounds = this.soundQueue; this.soundQueue = [];
    for (const ev of sounds) {
      for (const c of this.enemies) {
        if (c.gone) continue;
        const reach = L.sound.reach(ev.x, ev.z, ev.r * c.hearingMult(), c.x, c.z);
        if (reach.remain > 0) c.hear(ev, reach);
      }
      if (this.script.onSound) this.script.onSound(this, ev);
    }
    for (const c of this.enemies) {
      if (c.gone) continue;
      c.update(dt);
      if (c.data.leaveAt && this.time > c.data.leaveAt && c.state === 'patrol') c.beginWithdraw();
    }
    this.enemies = this.enemies.filter((c) => !c.gone || c.keep);
    for (const pz of this.puzzles.values()) pz.update(dt);
    for (const n of this.npcs) updateNpc(this, n, dt);
    this.story.update(dt);
    this.director.update(dt);
    if (this.script.update) this.script.update(this, dt);
    // an ending scene finishes once its lines have played out
    const ov = this.over;
    if (ov && ov.kind === 'endingPlay' && !ov.done && !this.story.busy && this.time - ov.t > 4) { ov.done = true; this.fx('endingDone', { ending: ov.ending, june: ov.june }); }
    // a waiting checkpoint commits once nothing is half-done
    if (this.pendingCheckpoint && this._safeToSave()) { const r = this.pendingCheckpoint; this.pendingCheckpoint = null; this.makeCheckpoint(r); }
  }

  _timer(t) {
    if (t.key.startsWith('scene:')) { this.story.play(t.key.slice(6)); return; }
    if (t.key.startsWith('flag:')) { this.story.set(t.key.slice(5)); return; }
    if (this.script.onTimer) this.script.onTimer(this, t.key, t.data);
  }

  _footstep(p, step) {
    this.emitSound({ x: p.x, z: p.z, r: step.r, kind: 'step', player: p.id, surface: step.surface, crouch: p.crouched, sprint: p.sprinting });
    this.fx('step', { pid: p.id, x: p.x, z: p.z, surface: step.surface, sprint: p.sprinting, crouch: p.crouched });
  }

  _enterRoom(p, force = false) {
    const r = this.level.roomAt(p.x, p.z);
    const id = r ? r.id : null;
    if (!force && id === p.room) return;
    const prev = p.room;
    p.room = id;
    if (!r) return;
    const first = !p.visited.has(id);
    p.visited.add(id);
    this.map.rooms[id] = true;
    for (const d of r.doors) this.map.doors[d.id] = true;
    if (this.script.onEnterRoom) this.script.onEnterRoom(this, p, r, prev, first);
    this.fx('room', { pid: p.id, room: id, name: r.name, first });
  }

  // ================================================================ players
  setInput(pid, input) {
    const p = this.players.get(pid);
    if (!p) return;
    Object.assign(p.input, input);
    if (input.yaw !== undefined) p.yaw = input.yaw;
    if (input.pitch !== undefined) p.pitch = Math.max(-1.45, Math.min(1.45, input.pitch));
  }

  mantle(pid) { const p = this.players.get(pid); return p ? tryMantle(this, p) : false; }

  damagePlayer(p, amount, src = null, opts = {}) {
    if (!p.alive || this.time < p.protectUntil) return false;
    const creature = src && src.type ? src : null;
    const dmg = creature ? amount * this.D.damage : amount;
    p.protectUntil = this.time + 1.2;
    p.lastHitAt = this.time;
    const dir = src ? Math.atan2(-(src.x - p.x), -(src.z - p.z)) : 0;
    // separation: push the player away from the source
    if (src) {
      const dx = p.x - src.x, dz = p.z - src.z, l = Math.hypot(dx, dz) || 1;
      p.vx = dx / l * 5; p.vz = dz / l * 5;
    }
    if (creature) {
      this.stats.damageInPursuit[creature.id] = true;
      this.director.onDamage();
    }
    if (this.assists.noDamage) {
      this.fx('hit', { pid: p.id, amount: 0, dir, src: creature ? creature.type : opts.kind || 'hazard', noDamage: true });
      if (opts.capture) this.fx('fadeReset', { pid: p.id });
      return true;
    }
    p.health = Math.max(0, p.health - dmg);
    p.composure = Math.max(0, p.composure - 15);
    this.fx('hit', { pid: p.id, amount: dmg, dir, src: creature ? creature.type : opts.kind || 'hazard' });
    if (p.health <= 0) this.playerDown(p, creature, opts);
    return true;
  }

  playerDown(p, creature, opts = {}) {
    const coop = this.activeCount() > 1;
    act.cancelAction(this, p);
    if (p.hidden) this.forceExitLocker(p);
    const S = creature ? CREATURES[creature.type] : null;
    const info = { creature: S ? S.name : (opts.name || 'The building'), hint: S ? S.hint : (opts.hint || 'Watch for the warning and move away from it.') };
    if (!coop) {
      this.stats.deaths++;
      this.over = { kind: 'death', ...info };
      this.fx('death', { pid: p.id, ...info });
      return;
    }
    if (p.revivedOnce || p.downed) { this._toSpectator(p); return; }
    p.downed = true; p.downedAt = this.time; p.crouched = true;
    this.stats.downs++;
    this.fx('downed', { pid: p.id, ...info });
    for (const c of this.enemies) if (c.target === p.id && c.state === 'pursue') c.beginSearch({ x: p.x + (c.x - p.x) * 0.3, z: p.z + (c.z - p.z) * 0.3 }, false);
    this._checkWipe();
  }

  _updateDowned(p, dt) {
    if (this.time - p.downedAt >= this.D.downed) this._toSpectator(p);
  }
  _toSpectator(p) {
    p.downed = false; p.spectating = true; p.health = 0;
    this.fx('spectator', { pid: p.id });
    this._checkWipe();
  }
  _checkWipe() {
    if (this.livingCount() === 0) {
      this.over = { kind: 'wipe', creature: 'The party', hint: 'Stay together near refuges, and revive downed crew before their timer runs out.' };
      this.fx('wipe', {});
    }
  }

  revive(reviver, target) {
    if (!target.downed || target.spectating) return false;
    target.downed = false; target.revivedOnce = true; target.health = 30; target.crouched = false;
    target.avoidUntil = this.time + 3;
    this.fx('revived', { pid: target.id, by: reviver.id });
    return true;
  }

  // ================================================================ doors
  isDoorLocked(d) {
    if (d.lock && !this.story.has(d.lock)) return true;
    if (d.lockAfter && this.story.has(d.lockAfter)) return true;
    if (d.unlockFrom && !this.story.has(`door.${d.id}.unlocked`)) return true;
    return false;
  }
  setDoor(id, open, { fast = false, sound = true } = {}) {
    const d = this.level.door(id);
    if (!d) return;
    if (d.target === (open ? 1 : 0)) return;
    d.target = open ? 1 : 0;
    d.fast = fast;
    if (sound) this.fx('door', { id: d.id, open, fast, type: d.type, x: d.x, z: d.z });
  }
  _syncDoorsToFlags(instant = false) {
    for (const d of this.level.doors) {
      if (!d.T.auto || d.manual) continue;
      const unlocked = !this.isDoorLocked(d) && d.type !== 'sealed';
      const want = unlocked && !d.stayClosed ? 1 : 0;
      if (d.reveal && !this.story.has(d.reveal)) { d.target = 0; if (instant) d.open = 0; continue; }
      if (d.target !== want) { d.target = want; if (instant) d.open = want; else this.fx('door', { id: d.id, open: !!want, type: d.type, x: d.x, z: d.z }); }
      if (instant && d.box) d.box.active = d.open < 0.6;
    }
    for (const b of this.level.blocks) {
      let active = true;
      if (b.until && this.story.has(b.until)) active = false;
      if (b.after && !this.story.has(b.after)) active = false;
      b.box.active = active;
    }
    for (const f of this.level.flagFloors || []) {
      let active = true;
      if (f.until && this.story.has(f.until)) active = false;
      if (f.after && !this.story.has(f.after)) active = false;
      f.box.active = active;
    }
    for (const pr of this.level.props) {
      if (!pr.box) continue;
      if (pr.until) pr.box.active = !this.story.has(pr.until);
      if (pr.after) pr.box.active = this.story.has(pr.after);
    }
  }

  _onFlag(f, v) {
    if (!this.level) return;
    this._syncDoorsToFlags();
    if (this.script.onFlag) this.script.onFlag(this, f, v);
    this.fx('flag', { flag: f, value: v });
  }

  // ================================================================ puzzles
  puzzleAction(pid, puzzleId, a) {
    const p = this.players.get(pid), pz = this.puzzles.get(puzzleId);
    if (!p || !pz) return { ok: false };
    const panel = pz.def.panel;
    if (panel && Math.hypot(panel.x - p.x, panel.z - p.z) > 3.2 && !pz.def.remote) return { ok: false, msg: 'Too far from the panel.' };
    return pz.input(p, a);
  }

  puzzleCompleted(pz, p) {
    this.story.set(`${pz.id}.done`);
    this.director.onMajorObjective();
    this.fx('puzzleDone', { id: pz.id, pid: p ? p.id : null });
    if (pz.usedStation) this.fx('achievementHint', { id: 'A15' });
    if (this.script.onPuzzle) this.script.onPuzzle(this, pz, p);
    this.progress();
  }

  // ================================================================ creatures
  addEnemy(c) { this.enemies.push(c); this.fx('creatureSpawn', { id: c.id, type: c.type, x: c.x, z: c.z }); return c; }
  spawn(type, opts) { return this.addEnemy(createCreature(this, type, opts)); }
  removeEnemy(id) { const c = this.enemyById(id); if (c) { c.gone = true; this.fx('creatureGone', { id }); } }

  /** Up to n hiding candidates (lockers, cover spots) near a point, nearest first. */
  hidingCandidates(x, z, n, creature) {
    const out = [];
    for (const it of this.level.interactables) {
      if (it.kind !== 'locker') continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < 14) out.push({ x: it.x + faceOff(it.face).x * 0.8, z: it.z + faceOff(it.face).z * 0.8, locker: it.id, d });
    }
    out.sort((a, b) => a.d - b.d);
    const lockers = [];
    let unwitnessedTaken = false;
    for (const c of out) {
      const occ = this.lockerOccupant(c.locker);
      const unwitnessed = !(occ && occ.hiddenWitnessed);
      if (unwitnessed) { if (unwitnessedTaken) continue; unwitnessedTaken = true; }
      lockers.push(c);
      if (lockers.length >= n) break;
    }
    // fill with nearby walkable points
    const nav = this.level.nav;
    let tries = 0;
    while (lockers.length < n && tries++ < 20) {
      const i = nav.nearest(x + this.rng.range(-5, 5), z + this.rng.range(-5, 5), creature ? (k) => creature.okCell(k) : null, 6);
      if (i >= 0) lockers.push(nav.center(i));
    }
    return lockers;
  }

  lockerOccupant(lockerId) {
    for (const p of this.players.values()) if (p.hidden === lockerId) return p;
    return null;
  }
  forceExitLocker(p) { act.exitLocker(this, p, true); }

  playerCanSeePoint(p, x, y, z) {
    const e = p.eye();
    const dx = x - e.x, dz = z - e.z;
    const ang = Math.atan2(-dx, -dz);
    let d = ang - p.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > 1.0) return false;
    return this.level.world.clearLine(e.x, e.y, e.z, x, y, z);
  }

  // ================================================================ refuge helpers
  inRefugeVolume(p) {
    const r = this.level.roomAt(p.x, p.z);
    if (!r || !r.refuge || r.refuge === 'imitation') return false;
    const t = 0.35;
    return p.x > r.x0 + t && p.x < r.x1 - t && p.z > r.z0 + t && p.z < r.z1 - t;
  }
  /** Inside a genuine refuge whose pursuit has been cleared. */
  inSafeRefuge(p) { return this.inRefugeVolume(p) && !!this.refugeSecured[p.room]; }

  // ================================================================ persistence
  collectRecord(p, id) {
    const first = !this.persist.records[id];
    this.persist.records[id] = true;
    const R = RECORDS[id];
    this.fx('record', { id, pid: p ? p.id : null, first, title: R.title, text: R.text, audio: !!R.audio });
    if (R.audio && first) this.story.say('rook', 'recording', R.text);
    if (first) this.fx('profile', { kind: 'record', id, ch: this.chapterId, room: p ? p.room : null });
    if (this.script.onRecord) this.script.onRecord(this, p, id);
    return first;
  }

  collectEvidence(id, p) {
    const first = !this.persist.evidence[id];
    this.persist.evidence[id] = true;
    this.story.set(id);
    this.fx('evidence', { id, pid: p ? p.id : null, first });
    if (first) this.fx('profile', { kind: 'evidence', id });
    this.progress();
  }

  partyHasHealing() {
    for (const p of this.players.values()) for (const s of p.pouch) if (s && HEAL_ITEMS.includes(s.item)) return true;
    for (const d of this.dropped) if (HEAL_ITEMS.includes(d.item)) return true;
    return false;
  }

  // ================================================================ checkpoints
  requestCheckpoint(reason) { this.pendingCheckpoint = reason; }
  _safeToSave() {
    for (const p of this.players.values()) if (p.action && p.action.kind !== 'station') return false;
    if (this.transition) return false;
    return true;
  }
  makeCheckpoint(reason) {
    this.checkpoint = this.serialize();
    this.checkpointReason = reason;
    this.fx('checkpoint', { reason, chapter: this.chapterId, room: this.anyLivingPlayer()?.room || null });
  }

  serialize() {
    const L = this.level;
    return {
      v: SAVE_VERSION,
      mode: this.mode, difficulty: this.difficulty, assists: { ...this.assists }, seed: this.seed, rng: this.rng.state,
      time: this.time, elapsed: this.elapsed, chapter: this.chapterId, returnTrip: this.returnTrip || null,
      players: [...this.players.values()].map((p) => p.serialize()),
      story: this.story.serialize(),
      persist: JSON.parse(JSON.stringify(this.persist)),
      photos: this.photos.map((ph) => ({ ...ph })),
      photoSeq: this.photoSeq,
      doors: L.doors.map((d) => [d.id, d.target]),
      pickups: JSON.parse(JSON.stringify(this.pickups)),
      dropped: this.dropped.map((d) => ({ ...d })),
      marks: this.marks.map((m) => ({ ...m })),
      puzzles: Object.fromEntries([...this.puzzles.entries()].map(([k, v]) => [k, v.serialize()])),
      enemies: this.enemies.filter((e) => !e.gone && !e.optional).map((e) => e.serialize()),
      npcs: this.npcs.map((n) => ({ ...n, path: n.path ? n.path.slice() : null })),
      director: this.director.serialize(),
      map: JSON.parse(JSON.stringify(this.map)),
      refuges: { ...this.refugeSecured },
      stats: JSON.parse(JSON.stringify(this.stats)),
      timers: this.timers.map((t) => ({ in: t.at - this.time, key: t.key, data: t.data })),
      parked: this.parked || null,
      expedition: this.expedition || null,
    };
  }

  /** Park the current chapter's state (doors, pickups, puzzles, creatures ...) before a side trip. */
  parkChapter() {
    const s = this.serialize();
    this.parked = { chapter: this.chapterId, doors: s.doors, pickups: s.pickups, dropped: s.dropped, marks: s.marks, puzzles: s.puzzles, enemies: s.enemies, npcs: s.npcs, director: s.director, map: s.map, refuges: s.refuges, timers: s.timers };
  }

  /** Restore a full snapshot (retry, continue, load). */
  restore(snap) {
    this.mode = snap.mode; this.difficulty = snap.difficulty; this.D = DIFFICULTY[this.difficulty];
    this.assists = { ...this.assists, ...snap.assists };
    this.seed = snap.seed; this.rng.state = snap.rng;
    this.time = snap.time; this.elapsed = snap.elapsed;
    // permanent evidence and records survive the reload (monotonic merge)
    const keep = this.persist;
    this.story.restore(snap.story);
    this.persist = JSON.parse(JSON.stringify(snap.persist));
    for (const k of ['evidence', 'records', 'secrets', 'refuges', 'endings']) Object.assign(this.persist[k], keep[k] || {});
    for (const e of Object.keys(this.persist.evidence)) this.story.flags[e] = true;
    this.photos = (snap.photos || []).map((p) => ({ ...p }));
    this.photoSeq = snap.photoSeq || this.photos.length + 1;
    for (const ps of snap.players) {
      let p = this.players.get(ps.id);
      if (!p) { p = new Player(ps.id, ps.slot, ps.name); this.players.set(ps.id, p); }
      p.restore(ps);
    }
    this.stats = JSON.parse(JSON.stringify(snap.stats || this.stats));
    this.parked = snap.parked || null;
    if (snap.expedition) { this.expedition = snap.expedition; this.customDefs = { X: buildExpeditionDef(snap.expedition) }; }
    this.over = null;
    this.paused = false;
    this.loadChapter(snap.chapter, { entry: snap.returnTrip ? 'return' : 'restore', snapshot: snap, returnTo: snap.returnTrip });
    this.fx('restored', { chapter: snap.chapter });
  }

  _restoreChapterState(snap) {
    const L = this.level;
    const doors = new Map(snap.doors);
    for (const d of L.doors) if (doors.has(d.id)) { d.target = doors.get(d.id); d.open = d.target; if (d.box) d.box.active = d.open < 0.6; }
    this.pickups = JSON.parse(JSON.stringify(snap.pickups));
    this.dropped = (snap.dropped || []).map((d) => ({ ...d }));
    this.marks = (snap.marks || []).map((m) => ({ ...m }));
    for (const [id, s] of Object.entries(snap.puzzles || {})) { const pz = this.puzzles.get(id); if (pz) pz.restore(s); }
    for (const e of snap.enemies || []) {
      const c = createCreature(this, e.type, { id: e.id, x: e.x, z: e.z, yaw: e.yaw, anchors: e.anchors, home: e.home, withdrawTo: e.withdrawTo, state: e.state, despawnOnWithdraw: e.despawnOnWithdraw, encounter: e.encounter, region: e.region || null });
      c.cooldownUntil = this.time + (e.cooldownLeft || 0);
      c.gone = !!e.gone;
      c.loadData(e.data || {});
      this.enemies.push(c);
    }
 this.npcs = (snap.npcs || []).map((n) => ({ ...n }));
    this.director.restore(snap.director || {});
    this.map = JSON.parse(JSON.stringify(snap.map || { rooms: {}, doors: {} }));
    this.refugeSecured = { ...(snap.refuges || {}) };
    this.timers = (snap.timers || []).map((t) => ({ at: this.time + t.in, key: t.key, data: t.data }));
  }

  retry() {
    if (!this.checkpoint) return false;
    this.restore(this.checkpoint);
    this.fx('retry', {});
    return true;
  }

  // ================================================================ chapter flow
  /** Begin a chapter transition (lift, escalator, stairwell...). */
  beginTransition(kind, toChapter, opts = {}) {
    if (this.transition) return;
    this.transition = { kind, to: toChapter, t: 0, dur: opts.dur || 6, scene: opts.scene || null, entry: opts.entry || 'start', returnTo: opts.returnTo || null };
    this.scripted = true;
    for (const p of this.players.values()) act.cancelAction(this, p);
    if (opts.scene) this.story.play(opts.scene);
    this.fx('transition', { kind, to: toChapter, dur: this.transition.dur });
    this.after(this.transition.dur, '__transition');
  }

  _finishTransition() {
    const tr = this.transition;
    this.transition = null;
    this.scripted = false;
    if (tr.to === 'ending') { this.fx('endingStart', { ending: this.story.flags.ending }); return; }
    const fromCh = this.chapterId;
    if (!this.returnTrip && tr.entry === 'start' && typeof tr.to === 'number' && tr.to > fromCh) {
      this.fx('chapterComplete', { chapter: fromCh });
      if (this.story.vars.sharedShift && this.activeCount() >= 2) this.fx('profile', { kind: 'achievement', id: 'A16' });
    }
    this.loadChapter(tr.to, { entry: tr.entry, returnTo: tr.returnTo });
    this.makeCheckpoint('chapter');
  }

  /** Co-op pause: the shared game pauses only once every connected player has voted. */
  pauseVote(pid) {
    this.pauseVotes = this.pauseVotes || new Set();
    this.pauseVotes.add(pid);
    const connected = [...this.players.values()].filter((p) => p.connected);
    const p = this.players.get(pid);
    this.fx('pauseVote', { pid, name: p ? p.name : '', votes: this.pauseVotes.size, of: connected.length });
    if (connected.every((q) => this.pauseVotes.has(q.id))) { this.sharedPause = true; this.resumeAt = 0; this.fx('sharedPause', { on: true }); }
    return { ok: true };
  }
  /** Any player can resume a shared pause; it lifts after a visible three second countdown. */
  resumeShared(pid) {
    if (!this.sharedPause || this.resumeAt) return { ok: false };
    this.resumeAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 3000;
    const p = this.players.get(pid);
    this.fx('resumeCountdown', { pid, name: p ? p.name : '' });
    return { ok: true };
  }

  /** Co-op: a guest asks the host to hold the final choice for thirty seconds. */
  requestMoreTime(pid) {
    const S = this.story;
    if (S.has('P12.committed') || this.chapterId !== 6) return { ok: false };
    S.vars.holdUntil = this.time + 30;
    const p = this.players.get(pid);
    this.fx('moreTime', { pid, name: p ? p.name : '' });
    return { ok: true, msg: 'The final gate is held for thirty seconds.' };
  }

  /**
   * A branch reached its exterior threshold. Ending selection uses explicit
   * branch state only; JUNE_SAFE changes the staging. Every completed ending
   * is stored in the profile independently of the campaign slot.
   */
  beginEnding(kind) {
    if (this.over) return;
    const S = this.story;
    const june = S.has('JUNE_SAFE');
    S.flags.ending = kind;
    S.set(`ending.${kind}`);
    this.persist.endings[kind] = true;
    for (const p of this.players.values()) { act.cancelAction(this, p); p.vx = p.vz = 0; }
    this.over = { kind: 'endingPlay', ending: kind, june, t: this.time };
    this.fx('profile', { kind: 'ending', id: kind });
    this.fx('endingStart', { ending: kind, june });
    const scene = { familiar: 'endingFamiliar', door: 'endingDoor', cut: 'endingCut' }[kind];
    S.play(scene, { force: true });
    if (kind === 'familiar') S.play(june ? 'endingFamiliarJune' : 'endingFamiliarNoJune', { force: true });
  }

  attempt(fn) { try { return fn(); } catch (e) { this.fx('error', { message: String(e && e.stack || e) }); return null; } }
}

/**
 * Non-player characters (June, Lena). They follow scripted waypoints, cannot
 * be targeted or harmed, and wait when `waitFor` says so.
 */
export function updateNpc(game, n, dt) {
  if (!n.path || !n.path.length) { n.moving = false; return; }
  if (game.script.npcWait && game.script.npcWait(game, n)) { n.moving = false; return; }
  const wp = n.path[0];
  const dx = wp.x - n.x, dz = wp.z - n.z, d = Math.hypot(dx, dz);
  if (d < 0.1) { n.path.shift(); if (!n.path.length) { n.moving = false; game.fx('npcArrived', { id: n.id }); if (game.script.onNpcArrived) game.script.onNpcArrived(game, n); } return; }
  // doors along the way open for escorted characters
  const di = game.level.nav.door[game.level.nav.indexAt(n.x + dx / d * 0.8, n.z + dz / d * 0.8)];
  if (di >= 0) { const door = game.level.doors[di]; if (door.T.hinged && door.target < 0.5 && !game.isDoorLocked(door)) game.setDoor(door.id, true); if (door.open < 0.6) { n.moving = false; return; } }
  const s = Math.min(d, (n.speed || 1.3) * dt);
  n.x += dx / d * s; n.z += dz / d * s; n.yaw = Math.atan2(-dx, -dz); n.moving = true;
}

function faceOff(face) {
  switch (face) { case 'N': return { x: 0, z: 1 }; case 'S': return { x: 0, z: -1 }; case 'E': return { x: 1, z: 0 }; case 'W': return { x: -1, z: 0 }; default: return { x: 0, z: 0 }; }
}

// transition timer hook
const _origTimer = Game.prototype._timer;
Game.prototype._timer = function (t) {
  if (t.key === '__transition') { if (this.transition) this._finishTransition(); return; }
  if (t.key === 'photoDev') { this.fx('photoDeveloped', t.data || {}); return; }
  _origTimer.call(this, t);
};

// convenience wrappers so callers use one object
Object.assign(Game.prototype, {
  beginInteract(pid, id, opts) { const p = this.players.get(pid); return p ? act.beginInteract(this, p, id, opts) : null; },
  endInteract(pid) { const p = this.players.get(pid); if (p) act.endInteract(this, p); },
  cancelAction(pid) { const p = this.players.get(pid); if (p) act.cancelAction(this, p); },
  findTarget(pid) { const p = this.players.get(pid); return p ? act.findTarget(this, p) : null; },
  describe(pid, it) { const p = this.players.get(pid); return p ? act.describe(this, p, it) : null; },
  useTool(pid) { const p = this.players.get(pid); return p ? eq.useTool(this, p) : null; },
  reload(pid) { const p = this.players.get(pid); return p ? eq.reload(this, p) : null; },
  equip(pid, tool) { const p = this.players.get(pid); return p ? eq.equip(this, p, tool) : null; },
  toggleFlashlight(pid) { const p = this.players.get(pid); return p ? eq.toggleFlashlight(this, p) : null; },
  toggleCameraFlash(pid) { const p = this.players.get(pid); return p ? eq.toggleCameraFlash(this, p) : null; },
  takePhoto(pid, opts) { const p = this.players.get(pid); return p ? eq.takePhoto(this, p, opts) : null; },
  aimHint(pid) { const p = this.players.get(pid); return p ? eq.cameraAimHint(this, p) : null; },
  pouchAction(pid, slot, a, arg) { const p = this.players.get(pid); return p ? eq.pouchAction(this, p, slot, a, arg) : null; },
  breathe(pid) { const p = this.players.get(pid); return p ? eq.breathe(this, p) : null; },
  callout(pid, kind) { const p = this.players.get(pid); return p ? eq.callout(this, p, kind) : null; },
  ping(pid, pos, label) { const p = this.players.get(pid); return p ? eq.ping(this, p, pos, label) : null; },
  requestHint(pid) { const p = this.players.get(pid); return p ? eq.requestHint(this, p) : null; },
  returnToSafe(pid) { const p = this.players.get(pid); return p ? eq.returnToSafe(this, p) : null; },
});
