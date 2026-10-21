/**
 * Co-op sessions over the relay.
 *
 * HostSession wraps the host's authoritative Game: it admits guests at a
 * safe spawn (a genuine refuge or a chapter entry), validates their
 * reported movement, executes their intended actions through the same
 * public Game API the local player uses, and streams compact snapshots,
 * story events and full chapter snapshots back.
 *
 * GuestSession keeps a mirror Game built from the host's snapshot. It
 * predicts its own movement locally against the mirrored collision world,
 * reports position, footsteps and intended actions, and applies the host's
 * state to everything else. Creature decisions, puzzles, story and
 * inventory transactions never run on a guest.
 */
import { Game } from '../sim/game.js';
import { stepMovement } from '../sim/player.js';
import * as act from '../sim/interact.js';
import { SNAP_HZ, INPUT_HZ } from './protocol.js';
import { SLOT_ORDER } from '../data/characters.js';

/** Game methods a guest may ask the host to run on its behalf (first argument is always the guest's pid). */
export const ACTIONS = ['chat', 'pauseVote', 'resumeShared', 'beginInteract', 'endInteract', 'cancelAction', 'useTool', 'reload', 'equip', 'toggleFlashlight', 'toggleCameraFlash', 'puzzleAction', 'pouchAction', 'breathe', 'callout', 'ping', 'requestHint', 'returnToSafe', 'mantle', 'requestMoreTime'];
const MAX_SPEED = 6.5; // m/s with tolerance (sprint is 4.4)

const r2 = (v) => Math.round(v * 100) / 100;

function playerState(p) {
  return [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch),
    (p.crouched ? 1 : 0) | (p.hidden ? 2 : 0) | (p.downed ? 4 : 0) | (p.spectating ? 8 : 0) | (p.flashOn ? 16 : 0) | (p.sprinting ? 32 : 0) | (p.connected ? 64 : 0) | (p.moving ? 128 : 0) | (p.cameraFlash ? 256 : 0),
    Math.round(p.health), Math.round(p.stamina), Math.round(p.composure), p.tool, Math.round(p.charge * 10) / 10, p.film, p.room,
    p.action ? [p.action.kind, r2(p.action.t || 0), p.action.dur || 0] : null, p.pouch, p.slot, p.name, p.selected, p.lean || 0];
}

// ====================================================================== host
export class HostSession {
  constructor(game, transport, opts = {}) {
    this.g = game; this.tr = transport;
    this.code = null;
    this.guests = new Map(); // relay id -> { pid, name, slot, ident, lastSeen, last: {x,z,t}, waiting }
    this.snapT = 0;
    this.cache = {};
    this.onChange = opts.onChange || (() => {});
    this.hostName = opts.name || 'Host';
    transport.onMessage = (m) => this.onMessage(m);
    transport.send({ t: 'host', name: this.hostName });
    game.coopHost = this;
  }

  get pids() { return [...this.guests.values()].map((x) => x.pid); }
  send(id, d) { this.tr.send({ t: 'to', id, d }); }
  all(d) { if (this.guests.size) this.tr.send({ t: 'all', d }); }

  onMessage(m) {
    if (m.t === 'hosted') { this.code = m.code; this.onChange('hosted'); return; }
    if (m.t === 'peer') { this.admit(m); return; }
    if (m.t === 'left') { this.drop(m.id, 'left'); return; }
    if (m.t === 'from') this.onPayload(m.id, m.d);
  }

  /** A guest connects: reuse their identity's player if they were here before, otherwise create one. */
  admit(m) {
    const g = this.g, S = g.story;
    S.vars.coopIdents = S.vars.coopIdents || {};
    let pid = S.vars.coopIdents[m.ident];
    let p = pid ? g.players.get(pid) : null;
    const used = new Set([...g.players.values()].filter((q) => q.connected).map((q) => q.slot));
    const slot = SLOT_ORDER.includes(m.slot) && !used.has(m.slot) ? m.slot : SLOT_ORDER.find((s) => !used.has(s)) || 'mara';
    if (!p) {
      pid = `g${Object.keys(S.vars.coopIdents).length + 2}`;
      S.vars.coopIdents[m.ident] = pid;
      p = g.addPlayer(pid, slot, m.name || slot, { remote: true });
    } else { p.connected = true; p.remote = true; p.name = m.name || p.name; }
    p.spectating = true; // waits in a spectator view until a safe spawn is available
    this.guests.set(m.id, { pid, name: m.name, slot: p.slot, ident: m.ident, lastSeen: performance.now(), last: null, waiting: true });
    g.fx('coopJoin', { pid, name: p.name });
    this.send(m.id, { k: 'welcome', pid, code: this.code, snap: g.serialize() });
    this.onChange('join');
  }

  /** A guest leaves: their supplies go into a labeled bag at the next genuine refuge, once. */
  drop(id, why) {
    const gs = this.guests.get(id);
    if (!gs) return;
    this.guests.delete(id);
    const g = this.g, p = g.players.get(gs.pid);
    if (p) {
      act.cancelAction(g, p);
      for (const pz of g.puzzles.values()) if (pz.reservedBy === p.id) pz.reservedBy = null; // disconnecting releases a panel reservation
      if (p.hidden) g.forceExitLocker(p);
      const items = p.pouch.filter(Boolean);
      const room = nextRefuge(g, p);
      if (items.length && room) {
        for (const it of items) g.dropped.push({ id: `bag_${p.id}_${g.dropped.length}`, x: room.cx + (Math.random() - 0.5), z: room.cz + (Math.random() - 0.5), y: room.floorY + 0.05, drop: { ...it, label: `${p.name}'s bag · ${it.item}`, owner: gs.ident } });
        p.pouch = p.pouch.map(() => null);
      }
      p.connected = false;
      g.fx('coopLeave', { pid: p.id, name: p.name, why });
    }
    this.onChange('leave');
  }

  /** Called by the app every frame after game.tick. */
  update(dt, events) {
    const g = this.g;
    const now = performance.now();
    // stalled guests: noninteractive after 3 s, gone after 10 s
    for (const [id, gs] of this.guests) {
      const p = g.players.get(gs.pid);
      if (!p) continue;
      const quiet = (now - gs.lastSeen) / 1000;
      p.stalled = quiet > 3;
      if (p.stalled && p.action) act.cancelAction(g, p);
      if (quiet > 10) this.drop(id, 'stalled');
    }
    // safe spawn for waiting guests: a genuine refuge with the party, or a fresh chapter entry
    for (const [id, gs] of this.guests) {
      if (!gs.waiting) continue;
      const spot = safeSpawn(g);
      if (!spot) continue;
      const p = g.players.get(gs.pid);
      gs.waiting = false;
      p.spectating = false; p.downed = false; if (p.health <= 0) p.health = 40;
      p.x = spot.x; p.z = spot.z; p.y = spot.y || 0; p.vx = p.vz = 0;
      const key = `${gs.ident}:${g.chapterId}`;
      g.story.vars.joinAllowance = g.story.vars.joinAllowance || {};
      if (!g.story.vars.joinAllowance[key]) {
        g.story.vars.joinAllowance[key] = true;
        p.hasFlashlight = true; p.hasCamera = true; p.charge = Math.max(p.charge, 40); p.film = Math.max(p.film, 4);
      }
      // the bag a disconnect left behind comes back with its owner
      for (const d of g.dropped.filter((x) => x.drop && x.drop.owner === gs.ident)) { const slot = p.pouch.findIndex((s) => !s); if (slot < 0) break; p.pouch[slot] = { item: d.drop.item, n: d.drop.n, sub: d.drop.sub }; g.dropped = g.dropped.filter((x) => x !== d); }
      gs.last = { x: p.x, z: p.z, t: now };
      g.fx('coopSpawn', { pid: p.id, name: p.name });
      this.send(id, { k: 'correct', x: p.x, y: p.y, z: p.z });
    }
    // a shared pause resumes after its visible three second countdown
    if (g.resumeAt && now >= g.resumeAt) { g.resumeAt = 0; g.sharedPause = false; g.pauseVotes = new Set(); g.fx('sharedPause', { on: false }); }
    if (!this.guests.size) return;
    // forward presentation events (guests generate their own footsteps)
    const fwd = events.filter((e) => !(e.e === 'step' && this.pids.includes(e.pid)) && e.e !== 'levelErrors');
    if (fwd.some((e) => e.e === 'chapterLoaded' || e.e === 'restored')) { this.cache = {}; this.all({ k: 'chapter', snap: g.serialize() }); for (const gs of this.guests.values()) { const p = g.players.get(gs.pid); if (p) gs.last = { x: p.x, z: p.z, t: now }; } }
    if (fwd.length) this.all({ k: 'ev', list: fwd.filter((e) => e.e !== 'chapterLoaded' && e.e !== 'restored') });
    // teleports the host applied to a remote player (respawn, tile reset ...) correct the guest
    for (const [id, gs] of this.guests) {
      const p = g.players.get(gs.pid);
      if (p && gs.last && Math.hypot(p.x - gs.last.x, p.z - gs.last.z) > 0.75) { gs.last = { x: p.x, z: p.z, t: now }; this.send(id, { k: 'correct', x: p.x, y: p.y, z: p.z }); }
    }
    this.snapT -= dt;
    if (this.snapT > 0) return;
    this.snapT = 1 / SNAP_HZ;
    this.all({ k: 'snap', s: this.snapshot() });
  }

  snapshot() {
    const g = this.g, c = this.cache;
    const s = {
      t: r2(g.time),
      pl: [...g.players.values()].map(playerState),
      en: g.enemies.filter((e) => !e.gone).map((e) => [e.id, e.type, r2(e.x), r2(e.y || 0), r2(e.z), r2(e.yaw), e.state, r2(e.awake || 0), e.moving ? 1 : 0, e.encounter || null, r2(e.wake || 0), e.inDrain ? 1 : 0]),
      dr: g.level.doors.map((d) => d.target),
      np: g.npcs.map((n) => [n.id, r2(n.x), r2(n.z), r2(n.yaw || 0), n.seated ? 1 : 0, n.hidden ? 1 : 0, n.moving ? 1 : 0, n.model, n.name]),
      over: g.over ? { kind: g.over.kind, ending: g.over.ending, done: g.over.done } : null,
      paused: !!g.sharedPause,
    };
    // slower-changing state only when it changed
    const diff = (key, val) => { const j = JSON.stringify(val); if (c[key] !== j) { c[key] = j; s[key] = val; } };
    const pz = {};
    for (const [id, p] of g.puzzles) pz[id] = { ...p.serialize(), message: p.message, reservedBy: p.reservedBy };
    diff('pz', pz);
    diff('pk', g.pickups);
    diff('dp', g.dropped);
    diff('vars', { machines: g.story.vars.machines, cycles: g.story.vars.cycles, purgeLeft: g.story.vars.purgeLeft });
    diff('ps', g.propState || {});
    diff('rs', g.refugeSecured);
    diff('obj', [g.story.objective, g.story.radio]);
    return s;
  }

  onPayload(id, d) {
    const gs = this.guests.get(id);
    if (!gs || !d) return;
    gs.lastSeen = performance.now();
    const g = this.g, p = g.players.get(gs.pid);
    if (!p) return;
    if (d.k === 'input') {
      if (gs.waiting || p.spectating || g.over) return;
      const now = performance.now();
      const last = gs.last || { x: p.x, z: p.z, t: now - 100 };
      const dist = Math.hypot(d.x - last.x, d.z - last.z), el = Math.max(0.05, (now - last.t) / 1000);
      if (dist > MAX_SPEED * el + 1.0) { this.send(id, { k: 'correct', x: p.x, y: p.y, z: p.z }); gs.last = { x: p.x, z: p.z, t: now }; return; }
      if (!p.hidden) { p.vx = (d.x - p.x) / el; p.vz = (d.z - p.z) / el; p.x = d.x; p.y = d.y; p.z = d.z; }
      p.yaw = d.yaw; p.pitch = d.pitch; p.crouched = !!d.crouch; p.sprinting = !!d.sprint; p.lean = d.lean || 0; p.moving = !!d.moving;
      p.input.mx = d.mx || 0; p.input.mz = d.mz || 0;
      gs.last = { x: p.x, z: p.z, t: now };
      for (const st of (d.steps || []).slice(0, 6)) g._footstep(p, { r: Math.min(30, +st.r || 6), surface: String(st.surface || 'concrete') });
      g._enterRoom(p);
      return;
    }
    if (d.k === 'act') {
      if (!ACTIONS.includes(d.m) || p.stalled || gs.waiting) return;
      const fn = g[d.m];
      if (typeof fn !== 'function') return;
      let r = null;
      try { r = fn.call(g, gs.pid, ...(Array.isArray(d.a) ? d.a.slice(0, 4) : [])); } catch (e) { r = { ok: false, msg: 'Action failed.' }; }
      if (d.rid) this.send(id, { k: 'res', rid: d.rid, r: r && typeof r === 'object' ? { ok: !!r.ok, msg: r.msg || null } : null });
    }
  }

  close() { this.tr.close(); this.g.coopHost = null; }
}

function nextRefuge(g, p) {
  const refs = g.level.refuges.filter((r) => r.genuine).map((r) => g.level.room(r.room));
  if (!refs.length) return null;
  return refs.reduce((a, b) => (Math.hypot(b.cx - p.x, b.cz - p.z) < Math.hypot(a.cx - p.x, a.cz - p.z) ? b : a));
}

/** A genuine refuge some living local player stands in, or the chapter entry shortly after a load. */
function safeSpawn(g) {
  for (const q of g.players.values()) {
    if (q.remote || !q.alive) continue;
    const room = g.level.room(q.room);
    if (room && room.refuge && room.refuge !== 'imitation') return { x: room.cx, z: room.cz, y: room.floorY };
  }
  if (g.time - (g.chapterLoadedAt || 0) < 30) { const st = g.chapterDef.start; return { x: st.x + 0.8, z: st.z + 0.8, y: 0 }; }
  return null;
}

// ====================================================================== guest
export class GuestSession {
  constructor(transport, opts = {}) {
    this.tr = transport;
    this.g = null; this.pid = null;
    this.onReady = opts.onReady || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.onResult = opts.onResult || (() => {});
    this.inputT = 0;
    this.steps = [];
    this.rid = 1;
    this.targets = new Map();
    transport.onMessage = (m) => this.onMessage(m);
    transport.send({ t: 'join', code: opts.code, name: opts.name, slot: opts.slot, ident: opts.ident });
  }

  onMessage(m) {
    if (m.t === 'error') { this.onEnd(m.msg); return; }
    if (m.t === 'hostLeft') { this.onEnd('The host ended the session. Your collected records and unlocks are kept.'); return; }
    if (m.t === 'joined') { this.code = m.code; return; }
    if (m.t !== 'from' || !m.d) return;
    const d = m.d;
    if (d.k === 'welcome') { this.pid = d.pid; this.build(d.snap); this.onReady(this.g, this.pid); return; }
    if (!this.g) return;
    if (d.k === 'chapter') { this.build(d.snap); return; }
    if (d.k === 'snap') { this.apply(d.s); return; }
    if (d.k === 'ev') { this.events(d.list); return; }
    if (d.k === 'correct') { const p = this.me; if (p) { p.x = d.x; p.y = d.y; p.z = d.z; p.vx = p.vz = 0; } return; }
    if (d.k === 'res') { this.onResult(d.r); }
  }

  get me() { return this.g && this.g.players.get(this.pid); }

  /** (Re)build the mirror from a full host snapshot. */
  build(snap) {
    if (!this.g) {
      this.g = new Game({ mode: snap.mode, difficulty: snap.difficulty, seed: snap.seed });
      this.patch(this.g);
    }
    const g = this.g;
    g.restore(snap);
    g.mirror = true;
    for (const p of g.players.values()) p.remote = p.id !== this.pid;
    // creatures on a guest are plain views driven by snapshots
    g.enemies = g.enemies.map((c) => this.mirrorEnemy({ id: c.id, type: c.type, x: c.x, z: c.z, yaw: c.yaw, state: c.state, encounter: c.encounter }));
    this.targets.clear();
  }

  mirrorEnemy(o) { return { ...o, y: 0, awake: 0, moving: false, gone: false, game: this.g, data: {}, wake: 0 }; }

  /** Replace the mirror's action methods with requests to the host. */
  patch(g) {
    const self = this;
    for (const m of ACTIONS) {
      g[m] = function (pid, ...a) {
        if (m === 'beginInteract' && a[0] == null) { const t = act.findTarget(g, g.players.get(pid)); if (!t) return null; a[0] = t.id; }
        if (m === 'mantle') return false;
        self.tr.send({ t: 'to', id: 'host', d: { k: 'act', m, a, rid: self.rid++ } });
        return m === 'beginInteract' ? { ok: true, pending: true } : { ok: true, pending: true };
      };
    }
    g.tick = (dt) => this.tick(dt);
    g.retry = () => false;
    g.makeCheckpoint = () => {};
    g.requestCheckpoint = () => {};
  }

  apply(s) {
    const g = this.g;
    if (Math.abs(g.time - s.t) > 0.5) g.time = s.t;
    for (const row of s.pl) {
      const [id, x, y, z, yaw, pitch, fl, health, stamina, composure, tool, charge, film, room, action, pouch, slot, name, selected, lean] = row;
      let p = g.players.get(id);
      if (!p) { p = g.addPlayer(id, slot, name, { remote: true, local: false }); p.remote = true; }
      const mine = id === this.pid;
      if (!mine) { this.targets.set(id, { x, y, z, yaw }); p.pitch = pitch; p.lean = lean; p.room = room; }
      p.crouched = mine ? p.crouched : !!(fl & 1);
      p.hidden = (fl & 2) ? (p.hidden || 'locker') : null;
      p.downed = !!(fl & 4); p.spectating = !!(fl & 8); p.flashOn = !!(fl & 16); p.sprinting = mine ? p.sprinting : !!(fl & 32);
      p.connected = !!(fl & 64); if (!mine) p.moving = !!(fl & 128); p.cameraFlash = !!(fl & 256);
      p.health = health; p.composure = composure; if (!mine) p.stamina = stamina; else p.staminaHost = stamina;
      p.tool = tool; p.charge = charge; p.film = film; p.pouch = pouch; p.selected = selected;
      p.action = action ? { kind: action[0], t: action[1], dur: action[2] } : null;
    }
    // creatures
    const seen = new Set();
    for (const [id, type, x, y, z, yaw, state, awake, moving, encounter, wake, inDrain] of s.en) {
      seen.add(id);
      let c = g.enemies.find((e) => e.id === id);
      if (!c) { c = this.mirrorEnemy({ id, type, x, z, yaw, state, encounter }); g.enemies.push(c); }
      Object.assign(c, { state, awake, moving: !!moving, encounter, wake, inDrain: !!inDrain, y });
      this.targets.set(`e:${id}`, { x, y, z, yaw });
    }
    for (const c of g.enemies) if (!seen.has(c.id)) c.gone = true;
    g.enemies = g.enemies.filter((c) => !c.gone);
    s.dr.forEach((t, i) => { const d = g.level.doors[i]; if (d) d.target = t; });
    g.npcs = s.np.map(([id, x, z, yaw, seated, hidden, moving, model, name]) => ({ id, x, z, yaw, seated: !!seated, hidden: !!hidden, moving: !!moving, model, name, path: null }));
    if (s.pz) for (const [id, st] of Object.entries(s.pz)) { const pz = g.puzzles.get(id); if (pz) { pz.restore(st); pz.message = st.message || pz.message; pz.reservedBy = st.reservedBy; } }
    if (s.pk) g.pickups = s.pk;
    if (s.dp) g.dropped = s.dp;
    if (s.vars) Object.assign(g.story.vars, s.vars);
    if (s.ps) g.propState = s.ps;
    if (s.rs) g.refugeSecured = s.rs;
    if (s.obj) { g.story.objective = s.obj[0]; g.story.radio = s.obj[1]; }
    g.over = s.over && s.over.kind ? s.over : null;
    g.sharedPause = !!s.paused;
  }

  /** Host events: mirror the story state they describe, then hand them to the app. */
  events(list) {
    const g = this.g, S = g.story;
    for (const e of list) {
      if (e.e === 'flag') S.flags[e.flag] = e.value;
      if (e.e === 'clue' && e.id) S.clues[e.id] = { text: e.text, source: e.source || 'observed', t: g.time, ch: g.chapterId };
      if (e.e === 'photoTaken' && e.photo && !g.photos.some((ph) => ph.id === e.photo.id)) g.photos.push(e.photo);
      if (e.e === 'record' && e.id) g.persist.records[e.id] = true;
      if (e.e === 'evidence' && e.id) { g.persist.evidence[e.id] = true; S.flags[e.id] = true; }
      if (e.e === 'step' && e.pid === this.pid) continue;
      g.events.push(e);
    }
  }

  /** Local frame: doors animate, the guest's own body moves, everything else eases toward the host state. */
  tick(dt) {
    const g = this.g;
    if (!g || !g.level) return;
    dt = Math.min(dt, 0.05);
    g.time += dt;
    g.level.updateDoors(dt);
    const p = this.me;
    if (p && !p.spectating && !p.hidden && !g.over && !g.sharedPause) {
      const step = stepMovement(g, p, dt);
      if (step) { this.steps.push({ r: step.r, surface: step.surface }); g.fx('step', { pid: p.id, x: p.x, z: p.z, surface: step.surface, sprint: p.sprinting, crouch: p.crouched }); }
      g._enterRoom(p);
    }
    const k = Math.min(1, dt * 12);
    for (const [key, t] of this.targets) {
      const o = key.startsWith('e:') ? g.enemies.find((e) => e.id === key.slice(2)) : g.players.get(key);
      if (!o) continue;
      if (Math.hypot(t.x - o.x, t.z - o.z) > 4) { o.x = t.x; o.z = t.z; } else { o.x += (t.x - o.x) * k; o.z += (t.z - o.z) * k; }
      o.y = t.y; o.yaw = lerpAngle(o.yaw, t.yaw, k);
    }
    this.inputT -= dt;
    if (p && this.inputT <= 0) {
      this.inputT = 1 / INPUT_HZ;
      this.tr.send({ t: 'to', id: 'host', d: { k: 'input', x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), pitch: r2(p.pitch), crouch: p.crouched, sprint: p.sprinting, lean: p.input.lean || 0, moving: p.moving, mx: p.input.mx, mz: p.input.mz, steps: this.steps.splice(0) } });
    }
  }

  close() { this.tr.close(); }
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
