// Bots for both sides. They produce the same intents as the player's controls.
import { HALF } from '../world/builder.js';

class Follower {
  constructor(m, e, role) {
    this.m = m; this.e = e; this.role = role;
    this.path = null; this.i = 0; this.goal = null; this.repathT = 0;
    this.lastPos = { x: e.pos.x, z: e.pos.z }; this.stuckT = 0; this.vaultSide = 0;
  }

  set(x, z, danger = null, every = 0.8) {
    const g = this.goal;
    this.repathT -= 1 / 60;
    if (!g || Math.hypot(g.x - x, g.z - z) > 1.2 || this.repathT <= 0 || !this.path) {
      this.goal = { x, z };
      this.path = this.m.world.nav.findPath(this.e.pos.x, this.e.pos.z, x, z, this.role, danger);
      this.i = 0;
      this.repathT = every;
    }
  }

  clear() { this.path = null; this.goal = null; }

  arrived(r = 0.7) { return this.goal && Math.hypot(this.e.pos.x - this.goal.x, this.e.pos.z - this.goal.z) < r; }

  // Returns a move vector; may ask for a vault/break action through intent.
  step(dt) {
    const e = this.e;
    const out = { mx: 0, mz: 0, act: false, target: null };
    if (!this.path || !this.path.length) return out;
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      const moved = Math.hypot(e.pos.x - this.lastPos.x, e.pos.z - this.lastPos.z);
      this.lastPos = { x: e.pos.x, z: e.pos.z };
      this.stuckT = 0;
      if (moved < 0.35 && !e.vault && (e.isSurvivor ? !e.action : e.state === 'normal')) { this.repathT = 0; this.path = this.goal ? this.m.world.nav.findPath(e.pos.x, e.pos.z, this.goal.x, this.goal.z, this.role) : null; this.i = 0; out.mx = Math.random() - 0.5; out.mz = Math.random() - 0.5; return out; }
    }
    while (this.i < this.path.length) {
      const wp = this.path[this.i];
      if (wp.vault >= 0) {
        const v = this.m.world.vaults[wp.vault];
        const passable = v.type === 'window' || v.state === 'down' || v.state === 'falling';
        if (!passable) { this.i++; continue; }
        const side = this.m.sideOf(v, e.pos.x, e.pos.z);
        if (!this.vaultSide) this.vaultSide = side;
        if (side !== this.vaultSide) { this.vaultSide = 0; this.i++; continue; }
        const lat = v.nx ? Math.max(-0.4, Math.min(0.4, e.pos.z - v.z)) : Math.max(-0.4, Math.min(0.4, e.pos.x - v.x));
        const ax = v.x + v.nx * side * 0.75 + (v.nx ? 0 : lat), az = v.z + v.nz * side * 0.75 + (v.nz ? 0 : lat);
        const d = Math.hypot(e.pos.x - ax, e.pos.z - az);
        if (d < 0.55 || Math.hypot(e.pos.x - v.x, e.pos.z - v.z) < 1.15) {
          out.act = true;
          out.target = e.isKiller ? { type: v.type === 'pallet' ? 'break' : 'vault' } : null;
          out.mx = -v.nx * side; out.mz = -v.nz * side;
          return out;
        }
        out.mx = ax - e.pos.x; out.mz = az - e.pos.z;
        return out;
      }
      const d = Math.hypot(wp.x - e.pos.x, wp.z - e.pos.z);
      if (d < 0.45 && this.i < this.path.length - 1) { this.i++; continue; }
      if (d < 0.3) return out;
      out.mx = wp.x - e.pos.x; out.mz = wp.z - e.pos.z;
      return out;
    }
    return out;
  }
}

const norm = (o) => { const l = Math.hypot(o.mx, o.mz); if (l > 1e-4) { o.mx /= l; o.mz /= l; } return o; };

/* ================================================================== */

export class SurvivorAI {
  constructor(m, s, skill) {
    this.m = m; this.s = s; this.skill = skill;
    this.f = new Follower(m, s, 'survivor');
    this.thinkT = Math.random() * 0.5;
    this.task = null;
    this.fleeT = 0;
    this.killerSeenT = -99; this.killerPos = null;
    this.genCommit = null; this.genT = 0;
  }

  knowsKiller() {
    const m = this.m, s = this.s, k = m.killer;
    const d = m.dist(s, k);
    if (k.phasing) return d < 6;
    if (d < k.terror * 0.75) return true;
    return d < 30 && m.canSee(s.pos.x, s.pos.z, k.pos.x, k.pos.z);
  }

  update(dt) {
    const m = this.m, s = this.s, k = m.killer, it = s.intent;
    it.interact = false; it.act = false; it.item = false; it.target = null; it.run = false; it.mx = 0; it.mz = 0;
    if (s.state === 'hooked') {
      s.struggleT = m.time;
      if (s.hooks === 1 && s.hookProg > 0.35 && s.selfTries < 1 && Math.random() < dt * 0.1) it.interact = true;
      return;
    }
    if (s.state === 'carried' || s.state === 'mori') return;
    if (this.knowsKiller()) { this.killerSeenT = m.time; this.killerPos = { x: k.pos.x, z: k.pos.z }; }
    const kd = m.dist(s, k);
    const known = m.time - this.killerSeenT < 2.5;
    if (s.state === 'dying') {
      if (known && kd < 18) this.flee(dt, it, false);
      return;
    }
    // flashlight save
    if (s.item && s.item.id === 'flashlight' && s.item.charges > 0 && k.carrying && kd < 7.5 && kd > 2.5 && m.canSee(s.pos.x, s.pos.z, k.pos.x, k.pos.z)) {
      s.yaw = Math.atan2(k.pos.x - s.pos.x, k.pos.z - s.pos.z);
      it.item = true;
      return;
    }
    const danger = known && (s.chased || kd < 9 + this.skill * 4 || (k.ai && k.ai.chaseTarget === s));
    if (danger) { this.flee(dt, it, true); return; }
    // a teammate is healing me: hold still
    if (s.state === 'injured' && s.beingHealed && m.time - s.beingHealed < 0.3) return;
    this.thinkT -= dt;
    if (this.thinkT <= 0 || !this.task) { this.thinkT = 0.6 + Math.random() * 0.4; this.task = this.choose(known, kd); }
    this.doTask(dt, it, known, kd);
  }

  choose(known, kd) {
    const m = this.m, s = this.s, w = m.world;
    const near = (x, z) => Math.hypot(s.pos.x - x, s.pos.z - z);
    const killerNear = (x, z, r) => this.killerPos && m.time - this.killerSeenT < 8 && Math.hypot(this.killerPos.x - x, this.killerPos.z - z) < r;
    // exit
    const open = w.gates.filter((g) => g.open);
    if (open.length) {
      const g = open.sort((a, b) => near(a.x, a.z) - near(b.x, b.z))[0];
      const hooked = m.survivors.find((o) => o.state === 'hooked' && o !== s);
      if (!(hooked && this.isRescuer(hooked) && m.endgameT > 40 && !killerNear(hooked.pos.x, hooked.pos.z, 14))) return { type: 'exit', g };
    }
    if (w.hatch.open && !w.hatch.closed && m.aliveSurvivors().length === 1) return { type: 'hatch' };
    // rescue
    for (const o of m.survivors) {
      if (o === s || o.state !== 'hooked') continue;
      if (!this.isRescuer(o)) continue;
      if (killerNear(o.hook.x, o.hook.z, 11) && o.hookProg < 0.85) continue;
      if (o.hookProg > 0.08 || m.dist(m.killer, o) > 20) return { type: 'unhook', o };
    }
    for (const o of m.survivors) {
      if (o === s || o.state !== 'dying') continue;
      if (killerNear(o.pos.x, o.pos.z, 14) || near(o.pos.x, o.pos.z) > 35) continue;
      return { type: 'recover', o };
    }
    if (s.state === 'injured' && s.item && s.item.id === 'medkit' && s.item.charges > 1) return { type: 'selfheal' };
    if (s.state === 'healthy') {
      for (const o of m.survivors) {
        if (o === s || o.state !== 'injured' || o.chased || near(o.pos.x, o.pos.z) > 18) continue;
        if (m.survivors.some((x) => x !== s && x.ai && x.ai.task && x.ai.task.type === 'heal' && x.ai.task.o === o)) continue;
        if (!o.isPlayer || Math.hypot(o.intent.mx, o.intent.mz) < 0.1) return { type: 'heal', o };
      }
    }
    if (m.gatesPowered) {
      const g = w.gates.filter((x) => !x.open).sort((a, b) => near(a.switchX, a.switchZ) - near(b.switchX, b.switchZ))[0];
      if (g) return { type: 'gate', g };
    }
    if (!s.item) {
      const c = w.chests.find((c2) => !c2.opened && near(c2.x, c2.z) < 14);
      if (c) return { type: 'chest', c };
    }
    // generator
    let best = null, bs = Infinity;
    for (const g of w.gens) {
      if (g.done || g.blocked) continue;
      let sc = near(g.x, g.z) - g.progress * 25;
      const others = m.survivors.filter((o) => o !== s && o.ai && o.ai.task && o.ai.task.type === 'gen' && o.ai.task.g === g).length;
      sc += others * 22;
      if (killerNear(g.x, g.z, 16)) sc += 60;
      if (g === this.genCommit) sc -= 12;
      if (sc < bs) { bs = sc; best = g; }
    }
    if (best) { this.genCommit = best; return { type: 'gen', g: best }; }
    return { type: 'wander' };
  }

  isRescuer(o) {
    const m = this.m;
    let best = null, bd = Infinity;
    for (const x of m.survivors) {
      if (x === o || !x.free || x.isPlayer) continue;
      const d = m.dist(x, o);
      if (d < bd) { bd = d; best = x; }
    }
    return best === this.s;
  }

  doTask(dt, it, known, kd) {
    const m = this.m, s = this.s, t = this.task;
    const go = (x, z, r = 1.2) => {
      this.f.set(x, z);
      if (Math.hypot(s.pos.x - x, s.pos.z - z) < r) return true;
      const o = norm(this.f.step(dt));
      it.mx = o.mx; it.mz = o.mz;
      if (o.act) it.act = true;
      // sneak when the killer is close but not chasing
      if (known && kd < 20) { s.crouch = kd < 14 && this.skill > 0.4; }
      else { s.crouch = false; it.run = Math.hypot(s.pos.x - x, s.pos.z - z) > 3; }
      return false;
    };
    switch (t.type) {
      case 'exit': {
        const g = t.g;
        if (go(g.x - g.nx * 4, g.z - g.nz * 4, 0.6)) { it.mx = -g.nx; it.mz = -g.nz; }
        it.run = true; s.crouch = false;
        break;
      }
      case 'hatch': if (go(m.world.hatch.x, m.world.hatch.z, 1.4)) it.act = true; break;
      case 'unhook': if (t.o.state !== 'hooked') { this.task = null; break; } if (go(t.o.hook.hangX, t.o.hook.hangZ, 1.5)) { it.interact = true; it.target = { type: 'unhook', target: t.o }; } break;
      case 'recover': if (t.o.state !== 'dying') { this.task = null; break; } if (go(t.o.pos.x, t.o.pos.z, 1.2)) { it.interact = true; it.target = { type: 'recover', target: t.o }; } break;
      case 'heal': if (t.o.state !== 'injured' || t.o.chased) { this.task = null; break; } if (go(t.o.pos.x, t.o.pos.z, 1.2)) { it.interact = true; it.target = { type: 'heal', target: t.o }; } break;
      case 'selfheal': if (s.state !== 'injured') { this.task = null; break; } it.item = true; break;
      case 'gate': if (t.g.open) { this.task = null; break; } if (go(t.g.switchX, t.g.switchZ, 1.1)) { it.interact = true; it.target = { type: 'gate', target: t.g }; } break;
      case 'chest': if (t.c.opened) { this.task = null; break; } if (go(t.c.x, t.c.z, 1.2)) { it.interact = true; it.target = { type: 'chest', target: t.c }; } break;
      case 'gen': {
        const g = t.g;
        if (g.done || g.blocked) { this.task = null; break; }
        if (!t.spot) {
          const a = Math.random() * Math.PI * 2;
          const p = m.world.nav.nearestWalkable(g.x + Math.cos(a) * 1.15, g.z + Math.sin(a) * 1.15, 2) || [g.x + 1.1, g.z];
          t.spot = p;
        }
        const dg = Math.hypot(s.pos.x - g.x, s.pos.z - g.z);
        if (dg < 1.6 || go(t.spot[0], t.spot[1], 0.5)) {
          it.mx = 0; it.mz = 0;
          it.interact = true; it.target = { type: 'repair', target: g };
          s.crouch = false;
        }
        break;
      }
      default: {
        if (!t.x) { t.x = (Math.random() - 0.5) * 60; t.z = (Math.random() - 0.5) * 60; }
        if (go(t.x, t.z, 2)) this.task = null;
      }
    }
  }

  flee(dt, it, canRun) {
    const m = this.m, s = this.s, k = m.killer, w = m.world;
    s.crouch = false;
    it.run = canRun;
    const kp = this.killerPos || { x: k.pos.x, z: k.pos.z };
    // drop a pallet on the killer when it is right behind us on the other side
    for (const p of w.pallets) {
      if (p.state !== 'up') continue;
      const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
      if (d > 1.6) continue;
      const ss = m.sideOf(p, s.pos.x, s.pos.z), ks = m.sideOf(p, k.pos.x, k.pos.z);
      const kdist = Math.hypot(k.pos.x - p.x, k.pos.z - p.z);
      if (ss !== ks && kdist < 2.6 + this.skill * 1.5) { it.act = true; return; }
    }
    this.fleeT -= dt;
    if (this.fleeT <= 0 || !this.f.path) {
      this.fleeT = 0.35 + (1 - this.skill) * 0.3;
      let best = null, bs = -Infinity;
      const tryPt = (x, z, bonus = 0) => {
        if (Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) return;
        if (!w.nav.isFree(x, z)) return;
        const dk = Math.hypot(x - kp.x, z - kp.z), ds = Math.hypot(x - s.pos.x, z - s.pos.z);
        const ax = x - s.pos.x, az = z - s.pos.z, bx = s.pos.x - kp.x, bz = s.pos.z - kp.z;
        const away = (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) + 1e-4);
        if (away < -0.3) return;
        const sc = dk - ds * 0.3 + away * 4 + bonus + Math.random() * 2;
        if (sc > bs) { bs = sc; best = [x, z]; }
      };
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        tryPt(s.pos.x + Math.cos(a) * 7, s.pos.z + Math.sin(a) * 7);
        tryPt(s.pos.x + Math.cos(a) * 13, s.pos.z + Math.sin(a) * 13);
      }
      for (const v of w.vaults) {
        if (Math.hypot(v.x - s.pos.x, v.z - s.pos.z) > 16) continue;
        const pass = v.type === 'window' || v.state === 'up' || v.state === 'down';
        if (!pass) continue;
        const ks = m.sideOf(v, kp.x, kp.z);
        tryPt(v.x - v.nx * ks * 2.2, v.z - v.nz * ks * 2.2, 5 * this.skill);
      }
      const open = w.gates.find((g) => g.open);
      if (open) tryPt(open.x - open.nx * 4, open.z - open.nz * 4, 30);
      if (best) {
        const danger = (x, z) => { const d = Math.hypot(x - kp.x, z - kp.z); return d < 5 ? (5 - d) * 1.6 : 0; };
        this.f.goal = null;
        this.f.set(best[0], best[1], danger, 0.3);
      }
    }
    const o = norm(this.f.step(dt));
    it.mx = o.mx; it.mz = o.mz;
    if (o.act) it.act = true;
    if (Math.hypot(it.mx, it.mz) < 0.1) { const dx = s.pos.x - kp.x, dz = s.pos.z - kp.z, l = Math.hypot(dx, dz) || 1; it.mx = dx / l; it.mz = dz / l; }
  }
}

/* ================================================================== */

export class KillerAI {
  constructor(m, k, skill) {
    this.m = m; this.k = k; this.skill = skill;
    this.f = new Follower(m, k, 'killer');
    this.chaseTarget = null;
    this.lastSeen = null; this.lastSeenT = -99;
    this.aware = new Map();
    this.patrol = null; this.visited = new Map();
    this.investigate = null;
    this.powerT = 0; this.powerHold = 0;
    this.leaveHookT = 0; this.lastHook = null;
  }

  sees(s) {
    const m = this.m, k = this.k;
    if (!s.free) return false;
    const d = m.dist(s, k);
    if (s.revealUntil > m.time) return true;
    if (d < 2.6) return true;
    const fog = m.scene.fog ? m.scene.fog.density : 0.03;
    let range = (0.9 / fog) * (0.75 + this.skill * 0.35);
    if (s.crouch) range *= 0.55;
    if (s.has('soft_step')) range *= 0.7;
    if (d > range) return false;
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    const dot = ((s.pos.x - k.pos.x) * fx + (s.pos.z - k.pos.z) * fz) / d;
    if (dot < 0.25 && d > 6) return false;
    return m.canSee(k.pos.x, k.pos.z, s.pos.x, s.pos.z);
  }

  update(dt) {
    const m = this.m, k = this.k, it = k.intent;
    it.mx = 0; it.mz = 0; it.attack = false; it.act = false; it.target = null; it.look = null;
    if (this.powerHold > 0) { this.powerHold -= dt; it.power = true; } else if (!k.phasing) it.power = false;
    if (k.state !== 'normal' && k.state !== 'lunge') return;
    // awareness with a reaction delay
    const react = 0.85 - this.skill * 0.6;
    for (const s of m.survivors) {
      if (this.sees(s)) {
        const a = (this.aware.get(s) || 0) + dt;
        this.aware.set(s, a);
        if (a > react && !k.carrying && !(this.ignore && this.ignore.s === s && m.time < this.ignore.until && m.dist(s, k) > 4)) {
          if (!this.chaseTarget || (this.chaseTarget !== s && m.dist(s, k) < m.dist(this.chaseTarget, k) - 6)) this.chaseTarget = s;
        }
        if (s === this.chaseTarget) { this.lastSeen = { x: s.pos.x, z: s.pos.z }; this.lastSeenT = m.time; }
      } else this.aware.set(s, Math.max(0, (this.aware.get(s) || 0) - dt * 0.5));
    }
    if (this.chaseTarget && !this.chaseTarget.free) this.chaseTarget = null;
    // give up on very long chases and go pressure generators instead
    if (this.chaseTarget) {
      this.chaseStart = this.chaseStart || m.time;
      if (m.time - this.chaseStart > 30 + this.skill * 40) { this.ignore = { s: this.chaseTarget, until: m.time + 18 }; this.chaseTarget = null; this.chaseStart = 0; }
    } else this.chaseStart = 0;
    if (k.carrying) { this.chaseTarget = null; return this.carry(dt, it); }
    // hatch
    const h = m.world.hatch;
    if (h.open && !h.closed && Math.hypot(k.pos.x - h.x, k.pos.z - h.z) < 22 && !this.chaseTarget) {
      this.move(dt, it, h.x, h.z);
      if (Math.hypot(k.pos.x - h.x, k.pos.z - h.z) < 1.8) { it.act = true; it.target = { type: 'hatch' }; }
      return;
    }
    // pick up a downed survivor when nobody else is in reach
    const downed = m.survivors.filter((s) => s.state === 'dying').sort((a, b) => m.dist(a, k) - m.dist(b, k))[0];
    if (downed && (!this.chaseTarget || m.dist(downed, k) < 8 || m.dist(this.chaseTarget, k) > 10)) {
      this.chaseTarget = null;
      this.move(dt, it, downed.pos.x, downed.pos.z, 0.3);
      if (m.dist(downed, k) < 1.6) {
        if (m.moriKind(downed) && k.state === 'normal') it.mori = true;
        else { it.act = true; it.target = { type: 'pickup' }; }
      }
      return;
    }
    if (this.chaseTarget) return this.chase(dt, it);
    // investigate fresh noises
    const noise = m.noises.filter((n) => m.time - n.t < 7 && Math.hypot(n.x - k.pos.x, n.z - k.pos.z) < 30 + n.loud * 60).sort((a, b) => b.t - a.t)[0];
    if (noise && (!this.investigate || noise.t > this.investigate.t)) this.investigate = { x: noise.x, z: noise.z, t: noise.t };
    if (this.investigate) {
      if (m.time - this.investigate.t > 14 || Math.hypot(k.pos.x - this.investigate.x, k.pos.z - this.investigate.z) < 2.5) this.investigate = null;
      else { this.move(dt, it, this.investigate.x, this.investigate.z); this.usePowerTravel(this.investigate.x, this.investigate.z); return; }
    }
    // track fresh scratch marks
    const marks = m.decals.scratch.items;
    const fresh = marks.length ? marks[marks.length - 1] : null;
    if (fresh && m.time - fresh.t < 3 && Math.hypot(fresh.x - k.pos.x, fresh.z - k.pos.z) < 14) {
      this.move(dt, it, fresh.x, fresh.z);
      return;
    }
    this.patrolGens(dt, it);
  }

  move(dt, it, x, z, every = 0.6) {
    const k = this.k, m = this.m;
    const direct = Math.hypot(x - k.pos.x, z - k.pos.z) < 12 && m.world.nav.walkableLine(k.pos.x, k.pos.z, x, z);
    if (direct) { it.mx = x - k.pos.x; it.mz = z - k.pos.z; norm(it); this.f.clear(); return; }
    this.f.set(x, z, null, every);
    const o = norm(this.f.step(dt));
    it.mx = o.mx; it.mz = o.mz;
    if (o.act) { it.act = true; it.target = o.target; }
  }

  chase(dt, it) {
    const m = this.m, k = this.k, s = this.chaseTarget;
    const visible = this.sees(s);
    const d = m.dist(s, k);
    if (!visible && m.time - this.lastSeenT > 4 + this.skill * 5) { this.investigate = this.lastSeen ? { ...this.lastSeen, t: m.time } : null; this.chaseTarget = null; return; }
    let tx, tz;
    if (visible) {
      const lead = Math.min(0.6, d / 8);
      tx = s.pos.x + s.moveDir.x * lead * 3.5; tz = s.pos.z + s.moveDir.z * lead * 3.5;
    } else {
      // follow the newest scratch mark near the last sighting
      const marks = m.decals.scratch.items;
      let best = null;
      for (let i = marks.length - 1; i >= 0 && i > marks.length - 40; i--) {
        const mk = marks[i];
        if (mk.t < this.lastSeenT - 1) break;
        if (Math.hypot(mk.x - k.pos.x, mk.z - k.pos.z) < 16) { best = mk; break; }
      }
      tx = best ? best.x : this.lastSeen.x; tz = best ? best.z : this.lastSeen.z;
    }
    this.move(dt, it, tx, tz, 0.25);
    // attack
    if (visible && d < 2.5 + (k.has('long_reach') ? 0.4 : 0) && !k.phasing) {
      const want = Math.atan2(s.pos.x - k.pos.x, s.pos.z - k.pos.z);
      const diff = Math.abs(((want - k.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      it.mx = Math.sin(want); it.mz = Math.cos(want);
      if (diff < 0.45) it.attack = true;
    }
    // powers
    if (k.power.kind === 'chop') {
      const p = k.power;
      if (!p.raising && visible && d > 3.2 && d < 7.5 && this.skill > 0.25 && Math.random() < dt * 3) this.powerHold = p.chargeTime * (0.55 + this.skill * 0.45);
      if (p.raising && (d > 10 || !visible)) this.powerHold = 0;
      if (p.raising) it.attack = false;
    } else if (k.power.kind === 'veil') {
      if (k.phasing) { this.powerHold = d > 2.6 ? 0.2 : 0; if (d < 2.6) it.power = false; }
      else if (k.power.charge >= 1 && d > 7 && d < 22 && this.skill > 0.3 && Math.random() < dt * 2) this.powerHold = 0.5;
    } else if (k.power.kind === 'exe' && k.power.cooldown <= 0 && d > 18) this.usePowerTravel(s.pos.x, s.pos.z);
  }

  carry(dt, it) {
    const m = this.m, k = this.k;
    let best = null, bd = Infinity;
    for (const h of m.world.hooks) {
      if (h.occupant || h.broken) continue;
      const d = Math.hypot(h.x - k.pos.x, h.z - k.pos.z);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) return;
    this.move(dt, it, best.x, best.z);
    if (bd < 2.2) { it.act = true; this.lastHook = best; this.leaveHookT = m.time; }
  }

  patrolGens(dt, it) {
    const m = this.m, k = this.k;
    if (!this.patrol || this.patrol.done || m.time - (this.patrolStart || 0) > 40) {
      let best = null, bs = -Infinity;
      for (const g of m.world.gens) {
        if (g.done) continue;
        const vis = this.visited.get(g) || -99;
        if (m.time - vis < 25) continue;
        let sc = g.progress * 60 - Math.hypot(g.x - k.pos.x, g.z - k.pos.z) * 0.6 + Math.random() * 12;
        if (this.lastHook && m.time - this.leaveHookT < 30 && Math.hypot(g.x - this.lastHook.x, g.z - this.lastHook.z) < 15) sc -= 30;
        if (sc > bs) { bs = sc; best = g; }
      }
      this.patrol = best || m.world.gens[Math.floor(Math.random() * m.world.gens.length)];
      this.patrolStart = m.time;
      this.patrolDone = false;
    }
    const g = this.patrol;
    const d = Math.hypot(g.x - k.pos.x, g.z - k.pos.z);
    this.usePowerTravel(g.x, g.z);
    if (d < 1.8) {
      if (!g.regressing && g.progress > 0.12) { it.act = true; it.target = { type: 'kick' }; }
      this.visited.set(g, m.time);
      this.patrol = null;
      return;
    }
    this.move(dt, it, g.x, g.z);
  }

  usePowerTravel(x, z) {
    const m = this.m, k = this.k;
    const d = Math.hypot(x - k.pos.x, z - k.pos.z);
    if (k.power.kind === 'veil') {
      if (!k.phasing && k.power.charge >= 1 && d > 22 && Math.random() < 0.02) this.powerHold = 4;
    } else if (k.power.cooldown <= 0 && d > 26 && this.skill > 0.25) {
      let best = null, bd = 14;
      for (const tv of m.world.tvs) {
        if (tv.disabledUntil > m.time) continue;
        const dd = Math.hypot(tv.x - x, tv.z - z);
        if (dd < bd) { bd = dd; best = tv; }
      }
      if (best && Math.hypot(best.x - k.pos.x, best.z - k.pos.z) > 18) { k.intent.tv = best; this.powerHold = 0.25; }
    }
  }
}
