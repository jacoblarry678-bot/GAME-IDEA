/**
 * Server-side bots so the game is testable without five humans in the room.
 *
 * Bots run the same authoritative state as players — they simply produce their
 * own movement instead of receiving it from a socket. They are deliberately
 * imperfect: reaction delays, imperfect senses, and a habit of taking the
 * scenic route.
 */

import {
  MOVE,
  CENOBITE_MOVE,
  STAMINA,
  HEALTH_STATE,
  ROLES,
  DAMAGE,
  ABILITIES,
  clamp,
  dist2,
} from '../shared/constants.js';
import { groundAt, isSolidWorld, hasLineOfSight, zoneAt } from '../shared/mapdata.js';
import { findPath } from './pathfinding.js';
import { Rand } from '../shared/rng.js';

const SURVIVOR_SIGHT = 24;
const CENOBITE_SIGHT = 32;

export class BotController {
  constructor(match) {
    this.match = match;
    this.enabled = true;
    this.rand = new Rand(match.seed + ':bots');
    for (const p of match.players.values()) {
      if (p.isBot) p.bot = this.makeBrain(p);
    }
  }

  makeBrain(p) {
    return {
      path: null,
      idx: 0,
      goal: null,
      goalId: null,
      think: this.rand.float(0, 0.6),
      mode: 'idle',
      panic: 0,
      reaction: this.rand.float(0.25, 0.8),
      lastSeen: null,
      lastSeenAt: -99,
      stuck: 0,
      lastX: p.x,
      lastZ: p.z,
      wanderAt: 0,
      doorCooldown: 0,
    };
  }

  tick(dt) {
    if (!this.enabled) return;
    for (const p of this.match.players.values()) {
      if (!p.isBot) continue;
      if (!p.bot) p.bot = this.makeBrain(p);
      if (p.role === ROLES.CENOBITE) this.tickCenobite(p, dt);
      else this.tickSurvivor(p, dt);
    }
  }

  // ---------------------------------------------------------------- shared

  setGoal(p, x, z, floor, id, mode) {
    const b = p.bot;
    b.goal = { x, z, floor };
    b.goalId = id;
    b.mode = mode;
    b.path = findPath(this.match.map, p.floor, p.x, p.z, x, z);
    b.idx = 0;
    if (!b.path) {
      // unreachable on this floor: head for the nearest stair instead
      const stair = this.nearestStair(p);
      if (stair) {
        b.path = findPath(this.match.map, p.floor, p.x, p.z, stair.x, stair.z);
        b.idx = 0;
        b.mode = 'stairs';
      }
    }
  }

  nearestStair(p) {
    let best = null;
    let bd = Infinity;
    for (const s of this.match.map.stairs) {
      if (s.from !== p.floor && s.to !== p.floor) continue;
      const cx = (s.world.x0 + s.world.x1) / 2;
      const cz = (s.world.z0 + s.world.z1) / 2;
      const d = dist2(p.x, p.z, cx, cz);
      if (d < bd) {
        bd = d;
        best = { x: cx, z: cz };
      }
    }
    return best;
  }

  /** Steer along the current path. Returns true if a goal was reached. */
  move(p, dt, speed) {
    const b = p.bot;
    if (p.root > 0 || p.stun > 0) {
      p.anim = 'idle';
      p.speedFrac = 0;
      return false;
    }
    if (!b.path || b.idx >= b.path.length) {
      p.anim = p.healthState === HEALTH_STATE.DOWNED ? 'downed' : 'idle';
      p.speedFrac = 0;
      return true;
    }
    const wp = b.path[b.idx];
    let dx = wp.x - p.x;
    let dz = wp.z - p.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.8) {
      b.idx++;
      if (b.idx >= b.path.length) return true;
      return false;
    }
    dx /= d;
    dz /= d;

    const step = speed * dt;
    let nx = p.x + dx * step;
    let nz = p.z + dz * step;

    // wall slide
    if (isSolidWorld(this.match.map, p.floor, nx, nz)) {
      if (!isSolidWorld(this.match.map, p.floor, p.x + dx * step, p.z)) nz = p.z;
      else if (!isSolidWorld(this.match.map, p.floor, p.x, p.z + dz * step)) nx = p.x;
      else {
        nx = p.x;
        nz = p.z;
        b.stuck += dt;
      }
    }
    p.x = nx;
    p.z = nz;
    const g = groundAt(this.match.map, p.floor, p.x, p.z);
    p.y = g.y;
    p.floor = g.floor;
    p.yaw = Math.atan2(-dx, -dz);
    p.speedFrac = clamp(speed / MOVE.SPRINT, 0, 1);

    if (p.healthState === HEALTH_STATE.DOWNED) p.anim = 'crawl';
    else if (speed > MOVE.WALK + 0.4) p.anim = 'run';
    else if (p.crouching) p.anim = 'crouchwalk';
    else p.anim = 'walk';

    // stuck detection
    if (dist2(p.x, p.z, b.lastX, b.lastZ) < 0.0004) b.stuck += dt;
    else b.stuck = 0;
    b.lastX = p.x;
    b.lastZ = p.z;
    if (b.stuck > 1.2) {
      b.path = null;
      b.stuck = 0;
      b.think = 0;
    }

    // open doors we bump into
    b.doorCooldown -= dt;
    if (b.doorCooldown <= 0) {
      for (const door of this.match.map.doors) {
        if (door.f !== p.floor) continue;
        if (dist2(p.x, p.z, door.x, door.z) > 6) continue;
        const st = this.match.doors.get(door.id);
        if (st && !st.open && !st.jammedUntil) {
          if (st.locked && !this.match.canUnlock(p, door)) continue;
          st.locked = false;
          st.open = true;
          this.match.emit('door', { id: door.id, open: true, by: p.id });
          b.doorCooldown = 2;
        }
      }
    }
    return false;
  }

  wander(p) {
    const map = this.match.map;
    for (let i = 0; i < 20; i++) {
      const a = this.rand.float(0, Math.PI * 2);
      const r = this.rand.float(10, 34);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (!isSolidWorld(map, p.floor, x, z)) {
        this.setGoal(p, x, z, p.floor, null, 'wander');
        return;
      }
    }
  }

  canSee(a, b, range) {
    if (a.floor !== b.floor) return false;
    if (b.hiding) return false;
    if (dist2(a.x, a.z, b.x, b.z) > range * range) return false;
    return hasLineOfSight(this.match.map, a.floor, a.x, a.z, b.x, b.z);
  }

  // -------------------------------------------------------------- survivor

  tickSurvivor(p, dt) {
    const m = this.match;
    const b = p.bot;
    if (!p.alive || p.escaped) return;

    if (p.healthState === HEALTH_STATE.DOWNED) {
      // crawl toward the nearest standing teammate
      b.think -= dt;
      if (b.think <= 0) {
        b.think = 2;
        const helper = m.activeSurvivors
          .filter((s) => s !== p && s.healthState !== HEALTH_STATE.DOWNED)
          .sort((x, y) => dist2(x.x, x.z, p.x, p.z) - dist2(y.x, y.z, p.x, p.z))[0];
        if (helper) this.setGoal(p, helper.x, helper.z, helper.floor, helper.id, 'crawl');
      }
      this.move(p, dt, MOVE.DOWNED_CRAWL);
      p.anim = 'crawl';
      return;
    }

    // --- threat assessment ---
    let threat = null;
    let threatD = Infinity;
    for (const c of m.cenobites) {
      if (!this.canSee(p, c, SURVIVOR_SIGHT)) continue;
      const d = Math.sqrt(dist2(p.x, p.z, c.x, c.z));
      if (d < threatD) {
        threatD = d;
        threat = c;
      }
    }
    if (threat) {
      b.lastSeen = { x: threat.x, z: threat.z, floor: threat.floor };
      b.lastSeenAt = m.time;
      b.panic = Math.max(b.panic, threatD < 12 ? 1 : 0.55);
      p.chased = Math.max(p.chased, 2.5);
    } else {
      b.panic = Math.max(0, b.panic - dt * 0.35);
    }

    b.think -= dt;

    // --- flee ---
    if (b.panic > 0.5 && b.lastSeen && m.time - b.lastSeenAt < 5) {
      if (p.interaction) p.interaction = null;
      if (b.mode !== 'flee' || b.think <= 0) {
        b.think = 0.8;
        const away = this.fleePoint(p, b.lastSeen);
        if (away) this.setGoal(p, away.x, away.z, p.floor, null, 'flee');
        else b.mode = 'flee';
      }
      const canSprint = p.stamina > 8;
      p.sprinting = canSprint;
      let sp = canSprint ? MOVE.SPRINT : MOVE.WALK;
      if (p.healthState === HEALTH_STATE.INJURED) sp *= MOVE.INJURED_MULT;
      this.move(p, dt, sp);
      return;
    }
    p.sprinting = false;

    // --- already channelling something ---
    if (p.interaction) {
      p.anim = 'interact';
      p.speedFrac = 0;
      return;
    }

    if (b.think > 0) {
      const arrived = this.move(p, dt, this.survivorSpeed(p));
      if (arrived) this.tryInteractAtGoal(p);
      return;
    }
    b.think = this.rand.float(0.5, 1.4);

    // --- pick a job ---
    const job = this.chooseSurvivorJob(p);
    if (job) this.setGoal(p, job.x, job.z, job.floor, job.id, job.mode);
    else if (m.time > b.wanderAt) {
      b.wanderAt = m.time + 5;
      this.wander(p);
    }
    const arrived = this.move(p, dt, this.survivorSpeed(p));
    if (arrived) this.tryInteractAtGoal(p);
  }

  survivorSpeed(p) {
    let s = MOVE.WALK * 1.12;
    if (p.healthState === HEALTH_STATE.INJURED) s *= MOVE.INJURED_MULT;
    if (p.carrying) s *= 0.92;
    return s;
  }

  fleePoint(p, from) {
    const map = this.match.map;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 18; i++) {
      const a = this.rand.float(0, Math.PI * 2);
      const r = this.rand.float(14, 34);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (isSolidWorld(map, p.floor, x, z)) continue;
      const away = dist2(x, z, from.x, from.z);
      const near = dist2(x, z, p.x, p.z);
      const score = away - near * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = { x, z };
      }
    }
    return best;
  }

  chooseSurvivorJob(p) {
    const m = this.match;
    const o = m.obj;

    // 1. a downed teammate close by outranks everything
    const downed = m.survivors
      .filter((s) => s.alive && s.healthState === HEALTH_STATE.DOWNED && s.floor === p.floor)
      .sort((a, c) => dist2(a.x, a.z, p.x, p.z) - dist2(c.x, c.z, p.x, p.z))[0];
    if (downed && dist2(downed.x, downed.z, p.x, p.z) < 3600) {
      return { x: downed.x, z: downed.z, floor: downed.floor, id: downed.id, mode: 'revive' };
    }

    // 2. patch yourself up if it's quiet
    if (p.healthState === HEALTH_STATE.INJURED && p.inventory.includes('medkit') && p.bot.panic < 0.2) {
      m.useItem(p.id, 'medkit');
      return null;
    }

    // 3. carrying something? take it to the altar
    if (p.carrying) {
      return { x: m.map.altar.x, z: m.map.altar.z, floor: m.map.altar.floor, id: 'altar', mode: 'deliver' };
    }

    // 4. loot a container that is genuinely on the way, rather than sprinting
    //    the length of the map empty-handed
    if (!p.inventory.includes('medkit') && this.rand.chance(0.35)) {
      const unsearched = m.map.containers.filter((c) => c.floor === p.floor && !m.containers.get(c.id).searched);
      const c = this.closest(p, unsearched);
      if (c && dist2(c.x, c.z, p.x, p.z) < 900) {
        return { x: c.x, z: c.z, floor: c.floor, id: c.id, mode: 'container' };
      }
    }

    // 5. the current ritual phase
    switch (o.phase) {
      case 'seals': {
        const s = this.closest(p, o.seals.filter((x) => !x.broken));
        if (s) return { x: s.x, z: s.z, floor: s.floor, id: s.id, mode: 'seal' };
        break;
      }
      case 'relics': {
        const s = this.closest(p, o.relics.filter((x) => !x.taken && !x.delivered));
        if (s) return { x: s.x, z: s.z, floor: s.floor, id: s.id, mode: 'relic' };
        break;
      }
      case 'pieces': {
        const s = this.closest(p, o.pieces.filter((x) => !x.taken && !x.delivered));
        if (s) return { x: s.x, z: s.z, floor: s.floor, id: s.id, mode: 'piece' };
        break;
      }
      case 'box': {
        // one volunteer at a time — nobody wants this job
        if (!o.box.solver || o.box.solver === p.id) {
          return { x: m.map.altar.x, z: m.map.altar.z, floor: m.map.altar.floor, id: 'altar', mode: 'box' };
        }
        break;
      }
      case 'escape': {
        return { x: m.map.gate.x, z: m.map.gate.z, floor: m.map.gate.floor, id: 'gate', mode: 'gate' };
      }
    }

    // 6. nothing pressing — loot whatever is nearest
    const spare = m.map.containers.filter((c) => c.floor === p.floor && !m.containers.get(c.id).searched);
    const c2 = this.closest(p, spare);
    if (c2 && dist2(c2.x, c2.z, p.x, p.z) < 2500) {
      return { x: c2.x, z: c2.z, floor: c2.floor, id: c2.id, mode: 'container' };
    }
    return null;
  }

  closest(p, list) {
    let best = null;
    let bd = Infinity;
    for (const s of list) {
      const bias = s.floor === p.floor ? 1 : 3.2; // prefer this floor
      const d = dist2(s.x, s.z, p.x, p.z) * bias;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  tryInteractAtGoal(p) {
    const b = p.bot;
    if (!b.goalId) return;
    if (b.mode === 'box') {
      this.solveBoxLikeAHuman(p);
      return;
    }
    this.match.startInteraction(p.id, b.goalId);
    if (!p.interaction) {
      b.path = null;
      b.goalId = null;
      b.think = 0.4;
    }
  }

  /** Bots fumble the box: a few random turns before the correct one. */
  solveBoxLikeAHuman(p) {
    const m = this.match;
    const box = m.obj.box;
    if (!box.assembled || box.solved) return;
    if (box.solver !== p.id) {
      m.startInteraction(p.id, 'altar');
      return;
    }
    const b = p.bot;
    b.boxTimer = (b.boxTimer || 0) - 1;
    if (b.boxTimer > 0) return;
    b.boxTimer = 14 + Math.floor(this.rand.float(0, 16));
    const wrong = [];
    for (let i = 0; i < box.config.length; i++) if (box.config[i] !== box.target[i]) wrong.push(i);
    if (!wrong.length) return;
    const seg = this.rand.pick(wrong);
    m.rotateBox(p.id, seg, this.rand.chance(0.75) ? 1 : -1);
  }

  // -------------------------------------------------------------- cenobite

  tickCenobite(p, dt) {
    const m = this.match;
    const b = p.bot;
    if (p.executing) {
      p.anim = 'execute';
      p.speedFrac = 0;
      return;
    }

    // finish the wounded first
    const downed = m.activeSurvivors.find(
      (s) => s.healthState === HEALTH_STATE.DOWNED && s.floor === p.floor && dist2(p.x, p.z, s.x, s.z) < ABILITIES.EXECUTION.range ** 2
    );
    if (downed) {
      m.execute(p.id);
      return;
    }

    // acquire
    let target = null;
    let td = Infinity;
    for (const s of m.activeSurvivors) {
      if (!this.canSee(p, s, CENOBITE_SIGHT)) continue;
      const d = dist2(p.x, p.z, s.x, s.z);
      if (d < td) {
        td = d;
        target = s;
      }
    }
    if (target) {
      b.lastSeen = { x: target.x, z: target.z, floor: target.floor };
      b.lastSeenAt = m.time;
      target.chased = 3;
    }

    b.think -= dt;

    if (target) {
      const d = Math.sqrt(td);
      // melee
      if (d < DAMAGE.MELEE_RANGE * 0.85) {
        p.yaw = Math.atan2(-(target.x - p.x), -(target.z - p.z));
        p.anim = 'attack';
        p.speedFrac = 0;
        m.attack(p.id);
        return;
      }
      // chain
      if (d > 6 && d < ABILITIES.CHAIN_SUMMON.range * 0.8 && !(p.cooldowns[ABILITIES.CHAIN_SUMMON.id] > 0)) {
        const yaw = Math.atan2(-(target.x - p.x), -(target.z - p.z));
        // lead the target a little, and miss sometimes
        const jitter = this.rand.float(-0.09, 0.09);
        p.yaw = yaw + jitter;
        m.useAbility(p.id, ABILITIES.CHAIN_SUMMON.id, { yaw: p.yaw, pitch: 0 });
      }
      // drop a trap behind while chasing
      if (this.rand.chance(0.004) && !(p.cooldowns[ABILITIES.CHAIN_TRAP.id] > 0)) {
        m.useAbility(p.id, ABILITIES.CHAIN_TRAP.id);
      }
      if (b.think <= 0 || b.mode !== 'chase') {
        b.think = 0.55;
        this.setGoal(p, target.x, target.z, target.floor, target.id, 'chase');
      }
      this.move(p, dt, CENOBITE_MOVE.SPRINT + CENOBITE_MOVE.CHASE_BONUS * 0.6);
      return;
    }

    // lost them — search the last known spot, then patrol objectives
    if (b.think <= 0) {
      b.think = this.rand.float(1.4, 3.0);
      if (!(p.cooldowns[ABILITIES.PAIN_SENSE.id] > 0) && m.activeSurvivors.some((s) => s.bleeding || s.fear > 45)) {
        m.useAbility(p.id, ABILITIES.PAIN_SENSE.id);
        const revealed = m.activeSurvivors.filter((s) => s.revealUntil > m.time);
        if (revealed.length) {
          const t = this.closest(p, revealed);
          this.setGoal(p, t.x, t.z, t.floor, t.id, 'hunt');
          this.move(p, dt, CENOBITE_MOVE.SPRINT);
          return;
        }
      }
      // the box is a beacon
      const box = m.obj.box;
      if (box.assembled && !box.solved && box.heat > 0.3) {
        this.setGoal(p, m.map.altar.x, m.map.altar.z, m.map.altar.floor, 'altar', 'patrol');
      } else if (b.lastSeen && m.time - b.lastSeenAt < 12) {
        this.setGoal(p, b.lastSeen.x, b.lastSeen.z, b.lastSeen.floor, null, 'search');
      } else {
        const sites = this.patrolSites();
        const site = sites.length ? sites[Math.floor(this.rand.next() * sites.length)] : null;
        if (site) this.setGoal(p, site.x, site.z, site.floor, null, 'patrol');
        else this.wander(p);
      }
    }
    this.move(p, dt, CENOBITE_MOVE.WALK * 1.15);
  }

  patrolSites() {
    const o = this.match.obj;
    const sites = [];
    if (o.phase === 'seals') sites.push(...o.seals.filter((s) => !s.broken));
    if (o.phase === 'relics') sites.push(...o.relics.filter((s) => !s.delivered));
    if (o.phase === 'pieces') sites.push(...o.pieces.filter((s) => !s.delivered));
    if (o.phase === 'box' || o.phase === 'escape') sites.push(this.match.map.altar, this.match.map.gate);
    if (!sites.length) sites.push(this.match.map.altar, this.match.map.gate, ...this.match.map.seals);
    return sites;
  }
}
