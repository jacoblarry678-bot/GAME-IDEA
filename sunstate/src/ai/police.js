/**
 * Police: one ambient patrol car that can witness crimes, plus units
 * dispatched by the wanted level. Units drive the road graph to the reported
 * position, switch to direct pursuit when they can see the player, deploy
 * officers on foot near a player on foot, search the last known area when
 * they lose sight, and leave once the player has escaped.
 *
 * Officers arrest at low levels and shoot from the configured level up, and
 * only ever act on what an officer can see (line of sight) or was told.
 */
import * as THREE from 'three';
import { Character } from '../entities/character.js';
import { DriverAI, laneLine } from './driver.js';
import { ROAD_GRAPH, nearestNode, findRoute } from '../world/layout.js';
import { WANTED_CONFIG } from '../game/wanted.js';
import { WEAPONS } from '../data/weapons.js';

const COP_LOOK = () => ({
  female: Math.random() < 0.3, height: 1.72 + Math.random() * 0.12, build: 1.05, skin: [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x5c3a21][Math.floor(Math.random() * 5)],
  hair: 0x1b1410, top: 0x1f3c78, bottom: 0x1a1f2e, shoes: 0x111111, hairStyle: 'short', shorts: false, sleeveless: false, hat: 0x1a2a55, beard: false,
});

const rand = (a, b) => a + Math.random() * (b - a);

export class PoliceManager {
  constructor(game) {
    this.game = game;
    this.units = [];
    this.spawnT = 0;
    this.seeT = 0;
    this.seesPlayer = false;
    this.bustT = 0;
    this.patrolT = 5;
  }

  get wanted() { return this.game.wanted; }

  allCops() { return this.game.cops; }

  /** Line of sight from an officer to a point. */
  copSees(cop, x, y, z, range) {
    const eye = cop.vehicle ? cop.vehicle.pos.y + 1.3 : cop.pos.y + 1.6;
    const cx = cop.vehicle ? cop.vehicle.pos.x : cop.pos.x, cz = cop.vehicle ? cop.vehicle.pos.z : cop.pos.z;
    const d = Math.hypot(x - cx, z - cz);
    if (d > range) return false;
    if (d < 4) return true;
    const hit = this.game.world.collision.raycast(cx, eye, cz, x - cx, y - eye, z - cz, 1, (c) => c.tag !== 'prop');
    return !hit || hit.t > 0.97;
  }

  canSeePoint(x, z, who) {
    const y = (who?.pos?.y ?? 0) + 1.2;
    for (const c of this.game.cops) if (!c.dead && this.copSees(c, x, y, z, c.vehicle ? 60 : 50)) return true;
    return false;
  }

  canSeePlayer() { return this.seesPlayer; }

  step(dt) {
    const g = this.game, W = this.wanted;
    // who can see the player (throttled)
    this.seeT -= dt;
    if (this.seeT <= 0) {
      this.seeT = 0.2;
      const p = g.player;
      const pp = p.vehicle ? p.vehicle.pos : p.pos;
      this.seesPlayer = !p.dead && this.game.cops.some((c) => !c.dead && this.copSees(c, pp.x, pp.y + 1.1, pp.z, c.vehicle ? 75 : 55));
    }
    // dispatch to match the wanted level
    const want = W.level > 0 ? WANTED_CONFIG.units[W.level] : 0;
    const active = this.units.filter((u) => u.mode !== 'leave' && !u.patrol);
    this.spawnT -= dt;
    if (active.length < want && this.spawnT <= 0) { this.spawnT = 2.5; this.spawnUnit(false); }
    if (W.level === 0) for (const u of this.units) if (!u.patrol && u.mode !== 'leave') this.setLeave(u);
    if (active.length > want) for (const u of active.slice(want)) this.setLeave(u);
    // one ambient patrol car when calm
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      this.patrolT = 6;
      if (W.level === 0 && !this.units.some((u) => u.patrol)) this.spawnUnit(true);
    }
    for (const u of [...this.units]) this.stepUnit(u, dt);
    for (const c of this.game.cops) if (!c.vehicle) c.controller?.step(dt);
    this.checkArrest(dt);
  }

  /** Spawn a car (with two officers) on a lane out of sight, 110–220 m away. */
  spawnUnit(patrol) {
    const g = this.game;
    const tr = g.traffic;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const { edges } = ROAD_GRAPH;
    for (let attempt = 0; attempt < 25; attempt++) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      if (e.road === 'causeway' && Math.random() < 0.8) continue;
      const from = Math.random() < 0.5 ? e.a : e.b;
      const lane = e.lanes - 1;
      const t = rand(0.2, 0.8);
      const l = laneLine(e, from, lane);
      const x = l.x0 + (l.x1 - l.x0) * t, z = l.z0 + (l.z1 - l.z0) * t;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < (patrol ? 120 : 100) || d > 230) continue;
      if (tr && tr.visible(x, 1, z, 5)) continue;
      if (g.vehicles.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 12)) continue;
      const v = g.addVehicle('police', x, z, Math.atan2(l.dx, l.dz), 0x101318, { plate: 'OMPD ' + (10 + Math.floor(Math.random() * 89)) });
      v.engineOn = true;
      const unit = { vehicle: v, cops: [], mode: patrol ? 'patrol' : 'respond', patrol, t: 0, stuckT: 0, reverseT: 0, lostT: 0, routeT: 0 };
      for (const seat of [0, 1]) {
        const cop = new Character(g, COP_LOOK(), { role: 'cop', x, z });
        cop.controller = new CopController(g, cop, unit);
        cop.armor = 30;
        g.cops.push(cop);
        g.seatCharacter(v, seat, cop);
        unit.cops.push(cop);
      }
      v.ai = new DriverAI(v, g, { edge: e.id, from, lane, t });
      v.policeUnit = unit;
      this.units.push(unit);
      return unit;
    }
    return null;
  }

  setLeave(u) {
    u.mode = 'leave';
    u.vehicle.siren = false;
    for (const c of u.cops) if (c.controller) c.controller.mode = 'return';
  }

  removeUnit(u) {
    const g = this.game;
    for (const c of u.cops) if (!c.removed) g.removeCharacter(c);
    u.vehicle.policeUnit = null; // a car left behind (e.g. stolen) becomes an ordinary abandoned vehicle
    u.vehicle.siren = false;
    if (g.vehicles.includes(u.vehicle) && !u.vehicle.seats.includes(g.player)) g.removeVehicle(u.vehicle);
    this.units.splice(this.units.indexOf(u), 1);
  }

  /** Point the unit's DriverAI at a road route toward (x, z). */
  routeTo(u, x, z) {
    const v = u.vehicle;
    const ai = v.ai;
    const start = nearestNode(v.pos.x, v.pos.z), goal = nearestNode(x, z);
    const route = findRoute(start.id, goal.id);
    ai.route = route;
    ai.mode = 'route';
    u.routeT = 6;
  }

  stepUnit(u, dt) {
    const g = this.game, W = this.wanted, v = u.vehicle;
    u.t += dt;
    const p = g.player;
    const pp = p.vehicle ? p.vehicle.pos : p.pos;
    const living = u.cops.filter((c) => !c.dead && !c.removed);
    const inCar = living.filter((c) => c.vehicle === v);
    const d = Math.hypot(pp.x - v.pos.x, pp.z - v.pos.z);
    const tr = g.traffic;
    // despawn units that left (or were wiped out) once nobody is looking
    if (u.mode === 'leave' || living.length === 0 || !g.vehicles.includes(v)) {
      const far = d > 160 && (!tr || !tr.visible(v.pos.x, v.pos.y, v.pos.z));
      if (far || !g.vehicles.includes(v)) { this.removeUnit(u); return; }
    }
    if (!v.driver || v.driver.role !== 'cop') { v.siren = false; return; } // car empty or stolen
    v.siren = !u.patrol && u.mode !== 'leave';
    if (u.patrol) {
      // patrols cruise like traffic; if a level appears, they join in
      if (W.level > 0) { u.patrol = false; u.mode = 'respond'; } else { v.ai.mode = 'cruise'; v.ai.cautious = 1; v.ai.step(dt); return; }
    }
    if (u.mode === 'leave') { v.ai.route = null; v.ai.mode = 'cruise'; v.ai.speedScale = 1; v.ai.step(dt); return; }

    const sees = living.some((c) => this.copSees(c, pp.x, pp.y + 1, pp.z, 75));
    if (sees) u.lostT = 0; else u.lostT += dt;
    const target = sees ? pp : W.lastKnown || pp;

    if (u.mode === 'deploy') {
      // officers are out; drive again if the player escapes in a vehicle
      v.input.throttle = 0; v.input.brake = 0; v.input.handbrake = true;
      return;
    }
    if (sees && d < 60) u.mode = 'pursue';
    else if (u.mode === 'pursue' && u.lostT > 3) u.mode = W.state === 'search' ? 'search' : 'respond';
    if (u.mode === 'pursue' && !p.vehicle && d < 16 && v.speed < 6) { this.deploy(u); return; }
    // the suspect is sitting in a stopped vehicle nearby: get out and move in
    if (u.mode === 'pursue' && p.vehicle && p.vehicle.speed < 1.5 && d < 25 && sees) u.stillT = (u.stillT || 0) + dt; else u.stillT = 0;
    if (u.stillT > 3 && v.speed < 6) { u.stillT = 0; this.deploy(u); return; }

    // failsafe: a unit wedged somewhere for a long time, out of the player's view, is replaced
    if (v.speed < 1 && u.mode !== 'deploy') u.wedgedT = (u.wedgedT || 0) + dt; else u.wedgedT = 0;
    if (u.wedgedT > 12 && d > 60 && !(tr && tr.visible(v.pos.x, v.pos.y, v.pos.z))) { this.removeUnit(u); return; }
    if (u.mode === 'pursue') this.drivePursuit(u, dt, target, p.vehicle);
    else {
      // follow roads toward the report / last known area; search wanders inside it
      u.routeT -= dt;
      if (u.mode === 'search' && u.routeT <= 0 && W.lastKnown) {
        const r = W.searchRadius * 0.8;
        this.routeTo(u, W.lastKnown.x + rand(-r, r), W.lastKnown.z + rand(-r, r));
        u.routeT = 12;
      } else if (u.routeT <= 0) this.routeTo(u, target.x, target.z);
      v.ai.speedScale = 1.45;
      v.ai.emergency = true;
      v.ai.step(dt);
      const dt2 = Math.hypot(target.x - v.pos.x, target.z - v.pos.z);
      if (u.mode === 'respond' && dt2 < 35 && !sees) u.mode = 'search';
    }
  }

  /** Direct pursuit: steer at the player's predicted position, avoiding walls with feelers. */
  drivePursuit(u, dt, target, targetVehicle) {
    const v = u.vehicle;
    const g = this.game;
    let tx = target.x, tz = target.z;
    if (targetVehicle) {
      const lead = Math.min(1.5, Math.hypot(tx - v.pos.x, tz - v.pos.z) / (v.speed + 8));
      tx += targetVehicle.vel.x * lead; tz += targetVehicle.vel.y * lead;
    }
    const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
    // feelers: pick the heading closest to the target that isn't blocked
    const coll = g.world.collision;
    const range = 8 + v.speed * 0.8;
    let best = desired, bestScore = -Infinity;
    for (const off of [0, 0.3, -0.3, 0.65, -0.65, 1.1, -1.1]) {
      const h = desired + off;
      const dx = Math.sin(h), dz = Math.cos(h);
      const [fx, fz] = v.localToWorld(0, v.hz);
      const hit = coll.raycast(fx, v.pos.y + 0.7, fz, dx, 0, dz, range, (c) => c.tag !== 'prop' || c.r > 0.2);
      const free = hit ? hit.t / range : 1;
      const score = free * 2 - Math.abs(off) * 0.8;
      if (score > bestScore) { bestScore = score; best = h; }
    }
    let dy = best - v.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dist = Math.hypot(tx - v.pos.x, tz - v.pos.z);
    v.input.steer = THREE.MathUtils.clamp(-dy * 2.2, -1, 1);
    v.input.handbrake = Math.abs(dy) > 1.3 && v.speed > 10;
    const close = !targetVehicle && dist < 18;
    const tooFast = Math.abs(dy) > 0.9 && v.speed > 14;
    v.input.throttle = close || tooFast ? 0 : 1;
    v.input.brake = close && v.speed > 3 ? 1 : tooFast ? 0.6 : 0;
    // stuck recovery
    if (v.speed < 1 && v.input.throttle > 0) u.stuckT += dt; else u.stuckT = Math.max(0, u.stuckT - dt);
    if (u.stuckT > 1.6) { u.reverseT = 1.4; u.stuckT = 0; }
    if (u.reverseT > 0) { u.reverseT -= dt; v.input.throttle = 0; v.input.brake = 1; v.input.steer = -v.input.steer; v.input.handbrake = false; }
  }

  deploy(u) {
    u.mode = 'deploy';
    const g = this.game;
    const v = u.vehicle;
    for (const c of [...u.cops]) {
      if (c.vehicle !== v) continue;
      const seat = c.seat;
      const spot = g.player.controller.findExitSpot(v, seat);
      g.unseatCharacter(v, c, spot.roof ? null : spot);
      c.controller.mode = 'chase';
    }
    v.input.throttle = 0; v.input.handbrake = true;
  }

  /** Called by an officer on foot wanting to get back in. */
  reenter(cop) {
    const u = cop.controller.unit;
    const v = u.vehicle;
    if (!this.game.vehicles.includes(v) || v.destroyed || v.sunk) return false;
    const seat = v.seats[0] === null ? 0 : v.seats[1] === null ? 1 : -1;
    if (seat < 0) return false;
    this.game.seatCharacter(v, seat, cop);
    if (seat === 0 && u.mode === 'deploy') u.mode = 'pursue';
    return true;
  }

  /** BUSTED: an officer stays next to a player who isn't getting away. */
  checkArrest(dt) {
    const g = this.game, p = g.player, W = this.wanted;
    if (W.level === 0 || p.dead || W.level >= 3) { this.bustT = 0; return; }
    const pv = p.vehicle;
    const slow = pv ? pv.speed < 0.8 : Math.hypot(p.vel.x, p.vel.z) < 2.2;
    const near = g.cops.some((c) => !c.dead && !c.vehicle && c.knockT <= 0 && c.distanceTo((pv || p).pos.x, (pv || p).pos.z) < (pv ? pv.hx + 1.6 : 1.8));
    if (near && slow) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
    this.arrestProgress = Math.min(1, this.bustT / 2.2);
    if (this.bustT > 2.2) { this.bustT = 0; g.events.emit('busted'); }
  }

  clearAll() { for (const u of [...this.units]) this.removeUnit(u); }
}

/** An officer on foot. */
export class CopController {
  constructor(game, ch, unit) {
    this.game = game;
    this.ch = ch;
    this.unit = unit;
    this.mode = 'chase';
    this.fireT = rand(0.5, 1.2);
    this.burst = 0;
    this.searchPt = null;
    this.weapon = WEAPONS.pistol;
    this.ch.anim_.armed = true;
  }

  step(dt) {
    const g = this.game, ch = this.ch, W = g.wanted, p = g.player;
    if (ch.dead || ch.knockT > 0) { ch.wishSpeed = 0; return; }
    const target = p.vehicle ? p.vehicle.pos : p.pos;
    const d = ch.distanceTo(target.x, target.z);
    const sees = g.police.copSees(ch, target.x, target.y + 1, target.z, 55);
    const a = ch.anim_;
    a.armed = W.level >= WANTED_CONFIG.shootAtLevel;
    const car = this.unit.vehicle;
    if (this.mode === 'return' || (p.vehicle && p.vehicle.speed > 6 && d > 25) || W.level === 0) {
      // back to the car
      a.aim = false;
      if (!g.vehicles.includes(car)) { ch.wishSpeed = 0; return; }
      const seat = car.seats[0] === null ? 0 : 1;
      const [dx, dz] = car.doorPoint(seat);
      const dd = ch.distanceTo(dx, dz);
      if (dd < 1.2) { if (g.police.reenter(ch)) return; }
      ch.wish.set((dx - ch.pos.x) / (dd || 1), (dz - ch.pos.z) / (dd || 1));
      ch.wishSpeed = 4.5; ch.faceYaw = null;
      return;
    }
    const shoot = W.level >= WANTED_CONFIG.shootAtLevel && sees && d < 38 && !p.dead;
    if (shoot) {
      // stop, aim, fire short bursts
      ch.faceYaw = Math.atan2(target.x - ch.pos.x, target.z - ch.pos.z);
      a.aim = true; a.aimPitch = 0;
      this.fireT -= dt;
      if (d > 14 && this.burst <= 0 && this.fireT < -1.5) { this.fireT = rand(0.6, 1.2); }
      ch.wishSpeed = d > 26 ? 3.5 : 0;
      if (ch.wishSpeed > 0) ch.wish.set((target.x - ch.pos.x) / d, (target.z - ch.pos.z) / d);
      if (this.fireT <= 0) {
        this.fireT = rand(0.45, 0.8);
        const from = new THREE.Vector3(ch.pos.x + Math.sin(ch.yaw) * 0.5, ch.pos.y + 1.4, ch.pos.z + Math.cos(ch.yaw) * 0.5);
        const aimAt = new THREE.Vector3(target.x, target.y + (p.vehicle ? 0.9 : 1.2), target.z);
        const dir = aimAt.sub(from).normalize();
        const pSpeed = p.vehicle ? p.vehicle.speed : Math.hypot(p.vel.x, p.vel.z);
        const spread = 0.025 + d * 0.0016 + pSpeed * 0.004 + (p.crouch ? 0.01 : 0);
        g.combat.fire(ch, from, dir, { ...this.weapon, damage: 14 }, spread);
      }
      return;
    }
    a.aim = false;
    // chase toward the player when visible, otherwise sweep the last known area
    let gx = target.x, gz = target.z;
    if (!sees) {
      if (!this.searchPt || ch.distanceTo(this.searchPt.x, this.searchPt.z) < 2 || Math.random() < 0.003) {
        const lk = W.lastKnown || target;
        this.searchPt = { x: lk.x + rand(-15, 15), z: lk.z + rand(-15, 15) };
      }
      gx = this.searchPt.x; gz = this.searchPt.z;
    }
    const dd = ch.distanceTo(gx, gz);
    if (dd < (sees ? 1.2 : 1.5)) { ch.wishSpeed = 0; ch.faceYaw = Math.atan2(target.x - ch.pos.x, target.z - ch.pos.z); return; }
    let wx = (gx - ch.pos.x) / dd, wz = (gz - ch.pos.z) / dd;
    if (ch.blockedT > 0.4) { const t = wx; wx = -wz; wz = t; }
    ch.wish.set(wx, wz);
    ch.wishSpeed = sees ? 5.3 : 3.2;
    ch.faceYaw = null;
  }
}
