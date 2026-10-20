/**
 * Shared creature behaviour. Every roaming creature runs the same six
 * states: patrol, investigate, warn, pursue, search and withdraw (plus
 * dormant/scripted/cooldown helpers). Creatures react to defined stimuli:
 * sound events reach them through the room graph, sight needs an
 * unobstructed line and the creature's own field of view. They never know an
 * unseen player's position unless an encounter rule grants it with a warning.
 */
import { CREATURES } from '../../data/creatures.js';
import { WALL_T } from '../level.js';

let NEXT = 1;

export class Creature {
  constructor(game, type, opts = {}) {
    this.game = game;
    this.type = type;
    this.S = CREATURES[type];
    this.id = opts.id || `${type}${NEXT++}`;
    this.x = opts.x ?? 0; this.z = opts.z ?? 0; this.y = 0;
    this.yaw = opts.yaw ?? 0;
    this.state = opts.state || 'patrol';
    this.stateT = 0;
    this.anchors = opts.anchors || [{ x: this.x, z: this.z }];
    this.anchorIx = 0;
    this.home = opts.home || this.anchors[0];
    this.withdrawTo = opts.withdrawTo || this.home;
    this.path = null; this.pathIx = 0; this.pathGoal = null; this.repathT = 0;
    this.target = null;
    this.lastKnown = null;
    this.lastSeenT = -99;
    this.suspect = null;
    this.searchList = [];
    this.searchUntil = 0;
    this.cooldownUntil = 0;
    this.recoverUntil = 0;
    this.doorWait = null;
    this.speed = 0;
    this.moving = false;
    this.encounter = opts.encounter || null;
    this.onWithdrawn = opts.onWithdrawn || null;
    this.despawnOnWithdraw = !!opts.despawnOnWithdraw;
    this.noPursueUntil = 0;
    this.stuckT = 0;
    this.lastProgress = { x: this.x, z: this.z, t: game.time };
    this.pursuitDamaged = false;
    this.warnTarget = null;
    this.data = {};
    this.gone = false;
    this.investigateCount = 0;
    this.extraSearch = 0;
    this.region = opts.region || null;
  }

  get active() { return ['warn', 'pursue', 'investigate', 'search'].includes(this.state); }
  get hostile() { return this.state === 'pursue' || this.state === 'warn'; }

  setState(s) {
    if (this.state === s) return;
    const prev = this.state;
    this.state = s; this.stateT = 0;
    this.path = null;
    this.stuckT = 0;
    this.lastProgress = { x: this.x, z: this.z, t: this.game.time };
    this.game.fx('creatureState', { id: this.id, type: this.type, state: s, prev, x: this.x, z: this.z });
    if (s === 'pursue') this.game.director.onPursuitStart(this);
    if (prev === 'pursue' && s !== 'pursue') this.game.director.onPursuitEnd(this);
  }

  // ---------------------------------------------------------------- navigation
  /** Which nav cells this creature may enter. */
  okCell(i) {
    const nav = this.game.level.nav;
    if (this.region) {
      const c = nav.center(i);
      if (c.x < this.region[0] || c.x > this.region[2] || c.z < this.region[1] || c.z > this.region[3]) return false;
    }
    const r = nav.room[i];
    if (r >= 0) {
      const room = this.game.level.rooms[r];
      if (room.refuge && room.refuge !== 'imitation') return false;
      if (room.noCreatures) return false;
    }
    if (this.game.blockedForCreatures(i)) return false;
    return true;
  }

  doorCost(di) {
    const d = this.game.level.doors[di];
    if (d.T.open) return d.T.crawl && !this.canCrawl() ? Infinity : 0;
    if (this.game.isDoorLocked(d)) return Infinity;
    if (!d.T.hinged) return d.open > 0.6 ? 0 : Infinity;
    if (d.T.creatureOpen === Infinity) return d.open > 0.6 ? 0 : Infinity;
    return d.open > 0.6 ? 0 : 2 + this.doorOpenTime(d) * 3;
  }
  canCrawl() { return true; }
  doorOpenTime(d) { return d.T.creatureOpen; }

  /** Walk toward (tx,tz) along the nav grid. Returns true when arrived. */
  moveTo(tx, tz, speed, dt) {
    const g = this.game, nav = g.level.nav;
    if (this.doorWait) {
      const dw = this.doorWait;
      const d = dw.door;
      if (d.open > 0.6) { this.doorWait = null; } else {
        if (g.time < d.wedgeUntil) { this.moving = false; this.speed = 0; dw.t = 0; return false; }
        dw.t += dt;
        this.moving = false; this.speed = 0;
        if (dw.t >= dw.need) { d.target = 1; d.fast = true; g.emitSound({ x: d.x, z: d.z, r: 10, kind: 'doorForced', source: this.id }); g.fx('sfx', { name: 'doorBang', x: d.x, z: d.z }); this.doorWait = null; }
        return false;
      }
    }
    const goalMoved = !this.pathGoal || Math.hypot(this.pathGoal.x - tx, this.pathGoal.z - tz) > 1.0;
    this.repathT -= dt;
    if (!this.path || goalMoved || this.repathT <= 0) {
      this.path = nav.path(this.x, this.z, tx, tz, (i) => this.okCell(i), (di) => this.doorCost(di));
      this.pathIx = 0; this.pathGoal = { x: tx, z: tz }; this.repathT = 1.0;
      if (!this.path) { this.moving = false; this.speed = 0; this.stuckT += dt; return Math.hypot(tx - this.x, tz - this.z) < 1.0; }
    }
    let wp = this.path[this.pathIx];
    while (wp && Math.hypot(wp.x - this.x, wp.z - this.z) < 0.15) { this.pathIx++; wp = this.path[this.pathIx]; }
    if (!wp) { this.moving = false; this.speed = 0; return true; }
    // closed door ahead?
    const di = nav.door[nav.indexAt(wp.x, wp.z)];
    if (di >= 0) {
      const d = g.level.doors[di];
      if (!d.T.open && d.open < 0.6 && Math.hypot(d.x - this.x, d.z - this.z) < 1.2) {
        if (g.isDoorLocked(d) || d.T.creatureOpen === Infinity || !d.T.hinged) { this.path = null; this.stuckT += dt; return false; }
        this.doorWait = { door: d, t: 0, need: this.doorOpenTime(d) + (d.wedge ? 8 : 0) };
        if (d.wedge) { d.wedge = false; g.fx('wedgeHeld', { door: d.id }); }
        g.fx('sfx', { name: 'doorRattle', x: d.x, z: d.z });
        return false;
      }
    }
    const dx = wp.x - this.x, dz = wp.z - this.z;
    const dist = Math.hypot(dx, dz);
    const step = Math.min(dist, speed * dt);
    this.x += dx / dist * step; this.z += dz / dist * step;
    const want = Math.atan2(-dx, -dz);
    this.yaw = turn(this.yaw, want, dt * 7);
    this.moving = step > 1e-4; this.speed = speed;
    const fy = nav.floorY[nav.indexAt(this.x, this.z)];
    if (Number.isFinite(fy)) this.y = fy;
    if (Math.hypot(tx - this.x, tz - this.z) < 0.6) return true;
    // stuck detection
    if (g.time - this.lastProgress.t > 1) {
      if (Math.hypot(this.x - this.lastProgress.x, this.z - this.lastProgress.z) < 0.3) this.stuckT += g.time - this.lastProgress.t; else this.stuckT = 0;
      this.lastProgress = { x: this.x, z: this.z, t: g.time };
    }
    return false;
  }

  // ---------------------------------------------------------------- perception
  eye() { return { x: this.x, y: this.y + 1.6, z: this.z }; }

  /** Line of sight from this creature to a player's head, ignoring FOV. */
  lineTo(p) {
    const e = this.eye();
    const tgt = { x: p.x, y: p.y + Math.max(0.5, p.eyeH - 0.1), z: p.z };
    return this.game.level.world.clearLine(e.x, e.y, e.z, tgt.x, tgt.y, tgt.z);
  }

  inFov(p, fovDeg) {
    const dx = p.x - this.x, dz = p.z - this.z;
    const ang = Math.atan2(-dx, -dz);
    return Math.abs(angDiff(ang, this.yaw)) <= (fovDeg * Math.PI / 180) / 2;
  }

  /** Default sight: range + fov + line, hidden players invisible unless their entry was witnessed. */
  canSee(p) {
    if (!p.alive || p.spectating) return false;
    if (p.hidden && !p.hiddenWitnessed) return false;
    if (p.hidden) return false;
    const range = this.sightRange();
    if (range <= 0) return false;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (d > range) return false;
    if (d > 1.2 && !this.inFov(p, this.S.fov || 110)) return false;
    return this.lineTo(p);
  }
  sightRange() { return this.S.sightRange || 0; }

  hearingMult() { return (this.S.hearing || 1) * this.game.D.hearing; }

  /** Called by the game for each sound event. */
  hear(ev, reach) {
    if (this.state === 'dormant' || this.state === 'scripted' || this.gone) return;
    if (ev.source === this.id) return;
    this.onHeard(ev, reach);
  }

  onHeard(ev, reach) {
    const pos = { x: reach.x, z: reach.z };
    const strong = reach.remain;
    if (this.state === 'pursue') {
      if (ev.player && ev.player === this.target) { this.lastKnown = { x: ev.x, z: ev.z, t: this.game.time }; this.lastSeenT = this.game.time; }
      return;
    }
    if (this.state === 'withdraw' || this.state === 'cooldown') return;
    if (this.state === 'warn') return;
    this.suspect = { x: pos.x, z: pos.z, t: this.game.time, strong, player: ev.player || null, kind: ev.kind };
    if (this.state !== 'investigate') { this.investigateCount = 0; this.setState('investigate'); }
    this.game.fx('creatureHeard', { id: this.id, type: this.type, x: pos.x, z: pos.z });
  }

  // ---------------------------------------------------------------- core update
  update(dt) {
    if (this.gone) return;
    this.stateT += dt;
    const g = this.game;
    const fn = this['st_' + this.state];
    if (fn) fn.call(this, dt); else this.st_patrol(dt);
    if (this.hostile && g.time >= this.recoverUntil) this.tryContact();
  }

  st_dormant() { this.moving = false; this.speed = 0; }
  st_scripted() { this.moving = false; }

  st_patrol(dt) {
    if (!this.anchors.length) { this.moving = false; return; }
    const a = this.anchors[this.anchorIx % this.anchors.length];
    if (this.moveTo(a.x, a.z, this.patrolSpeed(), dt) || this.stuckT > 5) {
      this.stuckT = 0;
      this.data.pause = (this.data.pause || 0) + dt;
      if (this.data.pause > 1.5) { this.data.pause = 0; this.anchorIx = (this.anchorIx + 1) % this.anchors.length; this.path = null; }
    }
    this.lookForTargets();
  }

  patrolSpeed() { return this.S.patrol; }
  pursueSpeed() { return this.S.pursue * this.game.D.pursuit; }

  lookForTargets() {
    if (this.game.time < this.noPursueUntil || this.game.time < this.cooldownUntil) return;
    if (!this.sightAllowed()) return;
    for (const p of this.game.players.values()) {
      if (this.canSee(p) && !this.game.inSafeRefuge(p)) { this.beginWarn(p); return; }
    }
  }
  sightAllowed() { return !this.S.sightPursuitOnly; }

  st_investigate(dt) {
    const s = this.suspect;
    if (!s) { this.setState('patrol'); return; }
    const arrived = this.moveTo(s.x, s.z, this.patrolSpeed() * 1.35, dt);
    if (this.stuckT > 5) { this.stuckT = 0; this.beginWithdraw(); return; }
    if (arrived) {
      this.data.look = (this.data.look || 0) + dt;
      this.yaw += dt * 1.2;
      if (this.data.look > 3) { this.data.look = 0; this.suspect = null; this.beginSearch(s, false); }
    }
    this.lookForTargets();
    if (this.stateT > 25) this.beginWithdraw();
  }

  beginWarn(p) {
    if (this.game.director.blocksNewAttacker(this)) return;
    this.target = p.id;
    this.lastKnown = { x: p.x, z: p.z, t: this.game.time };
    this.lastSeenT = this.game.time;
    this.warnTarget = p.id;
    this.setState('warn');
    this.data.warnDur = this.warnDuration();
    this.game.fx('warning', { id: this.id, type: this.type, x: this.x, z: this.z, text: this.S.warning, target: p.id });
  }
  warnDuration() { return this.S.warn + (this.game.assists.reducedStartle ? 1 : 0); }

  st_warn() {
    this.moving = false; this.speed = 0;
    const p = this.game.players.get(this.target);
    if (p) this.faceToward(p.x, p.z, 0.05);
    if (this.stateT >= this.data.warnDur) {
      if (!p || !p.alive) { this.beginSearch(this.lastKnown, false); return; }
      this.pursuitDamaged = false;
      this.setState('pursue');
    }
  }

  st_pursue(dt) {
    const g = this.game;
    const p = g.players.get(this.target);
    if (!p || !p.alive || p.downed) { this.beginSearch(this.lastKnown || { x: this.x, z: this.z }, false); return; }
    if (g.inSafeRefuge(p)) { this.beginSearch(this.lastKnown, false); return; }
    if (this.canTrack(p)) { this.lastKnown = { x: p.x, z: p.z, t: g.time }; this.lastSeenT = g.time; }
    const lk = this.lastKnown;
    const arrived = this.moveTo(lk.x, lk.z, this.pursueSpeed(), dt);
    if (this.stuckT > 5) { this.stuckT = 0; this.beginWithdraw(); return; }
    if ((arrived && g.time - this.lastSeenT > 1.5) || g.time - this.lastSeenT > 8) this.beginSearch(lk, true);
  }

  /** Can the creature keep tracking its pursued target right now? */
  canTrack(p) { return this.canSee(p); }

  tryContact() {
    const g = this.game;
    for (const p of g.players.values()) {
      if (!p.alive || p.hidden) continue;
      if (Math.abs(p.y - this.y) > 1.2) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d > this.reach()) continue;
      if (g.inRefugeVolume(p)) continue;
      if (g.time < p.protectUntil || g.time < p.avoidUntil) continue;
      if (this.state === 'warn' && p.id !== this.target) continue;
      if (this.state === 'warn') continue; // warnings never hurt
      this.attack(p);
      return;
    }
  }
  reach() { return 1.0; }

  attack(p) {
    const g = this.game;
    this.recoverUntil = g.time + 1.3;
    this.pursuitDamaged = true;
    g.damagePlayer(p, this.S.damage, this);
  }

  beginSearch(at, fromPursuit) {
    const g = this.game;
    at = at || { x: this.x, z: this.z };
    this.searchList = g.hidingCandidates(at.x, at.z, 3, this);
    this.searchCenter = at;
    this.searchUntil = g.time + this.searchDuration();
    this.data.searchedLocker = false;
    this.setState('search');
    if (fromPursuit) g.fx('creatureLost', { id: this.id, type: this.type });
  }
  searchDuration() {
    return this.S.search + (this.game.activeCount() >= 3 ? 5 : 0) + this.extraSearch;
  }

  st_search(dt) {
    const g = this.game;
    if (g.time > this.searchUntil) { this.beginWithdraw(); return; }
    const c = this.searchList[0];
    if (!c) {
      // wander near the search centre
      if (!this.data.wander || this.moveTo(this.data.wander.x, this.data.wander.z, this.patrolSpeed(), dt)) {
        const sc = this.searchCenter;
        const i = g.level.nav.nearest(sc.x + g.rng.range(-4, 4), sc.z + g.rng.range(-4, 4), (k) => this.okCell(k), 6);
        this.data.wander = i >= 0 ? g.level.nav.center(i) : { x: sc.x, z: sc.z };
      }
    } else if (this.moveTo(c.x, c.z, this.patrolSpeed() * 1.2, dt) || this.stuckT > 4) {
      this.stuckT = 0;
      if (c.locker) {
        const occupant = g.lockerOccupant(c.locker);
        if (occupant && occupant.hiddenWitnessed && !this.data.rattle) {
          this.data.rattle = { t: 0, p: occupant.id };
          g.fx('warning', { id: this.id, type: this.type, x: c.x, z: c.z, text: 'The locker handle rattles.', target: occupant.id, rattle: true });
          g.fx('sfx', { name: 'lockerRattle', x: c.x, z: c.z });
        }
        if (this.data.rattle) {
          this.data.rattle.t += dt;
          if (this.data.rattle.t >= 4) {
            const p = g.players.get(this.data.rattle.p);
            this.data.rattle = null;
            if (p && p.hidden === c.locker) { g.forceExitLocker(p); this.target = p.id; this.lastKnown = { x: p.x, z: p.z, t: g.time }; this.lastSeenT = g.time; this.setState('pursue'); this.attack(p); return; }
            this.searchList.shift();
          }
          return;
        }
        this.data.searchedLocker = true;
      }
      this.data.lookT = (this.data.lookT || 0) + dt;
      this.yaw += dt * 1.5;
      if (this.data.lookT > 1.5) { this.data.lookT = 0; this.searchList.shift(); }
    }
    this.lookForTargets();
  }

  beginWithdraw(to) {
    this.target = null; this.suspect = null; this.doorWait = null;
    this.withdrawPoint = to || this.withdrawTo;
    this.setState('withdraw');
  }

  st_withdraw(dt) {
    const w = this.withdrawPoint || this.withdrawTo;
    const arrived = this.moveTo(w.x, w.z, this.patrolSpeed() * 1.5, dt);
    if (arrived || this.stateT > 15 || this.stuckT > 5) {
      if (!arrived) { this.x = w.x; this.z = w.z; } // withdraw never fails: it slips back into the walls
      this.stuckT = 0;
      this.cooldownUntil = this.game.time + (this.S.cooldown || 30);
      if (this.onWithdrawn) this.onWithdrawn(this);
      if (this.despawnOnWithdraw) { this.gone = true; this.game.fx('creatureGone', { id: this.id }); return; }
      this.setState('patrol');
    }
  }

  faceToward(x, z, k = 1) { this.yaw = turn(this.yaw, Math.atan2(-(x - this.x), -(z - this.z)), k * 10); }

  /** Force a withdraw (refuge secured, director, script). */
  forceWithdraw() { if (this.state !== 'withdraw' && !this.gone && this.state !== 'dormant') this.beginWithdraw(); }

  serialize() {
    return { type: this.type, id: this.id, x: this.x, z: this.z, yaw: this.yaw, state: ['pursue', 'warn', 'search', 'investigate'].includes(this.state) ? 'patrol' : this.state, anchors: this.anchors, home: this.home, withdrawTo: this.withdrawTo, cooldownLeft: Math.max(0, this.cooldownUntil - this.game.time), data: this.saveData(), gone: this.gone, despawnOnWithdraw: this.despawnOnWithdraw, encounter: this.encounter };
  }
  saveData() { return {}; }
  loadData() {}
}

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turn(cur, want, maxStep) {
  const d = angDiff(want, cur);
  if (Math.abs(d) <= maxStep) return want;
  return cur + Math.sign(d) * maxStep;
}
export { WALL_T };
