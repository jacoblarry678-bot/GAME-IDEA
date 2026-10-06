/**
 * The partner: whichever protagonist the player is NOT controlling.
 *
 * Modes (toggled with the partner key, or set by switching and missions):
 *   follow — stays at your shoulder on foot, gets into your car as a
 *            passenger (or takes the wheel if you sit in the passenger seat),
 *            gets out when you do, and shoots back at anyone hostile to you.
 *   wait   — stays at an anchor point (where you left them, or their home).
 *
 * As the driver with you aboard they drive to the mission target or your map
 * waypoint, or cruise if there is none. Left at the wheel without you, they
 * park. Fall too far behind on foot and they catch up off-screen.
 */
import * as THREE from 'three';
import { attachDriver } from './driver.js';
import { WEAPONS } from '../data/weapons.js';
import { doorApproachPoint } from '../game/player.js';
import { roadAt } from '../world/layout.js';

const SPEED = { walk: 1.7, run: 4.1, sprint: 6.6 };
const rand = (a, b) => a + Math.random() * (b - a);

export class PartnerController {
  constructor(game, ch) {
    this.game = game;
    this.ch = ch;
    this.mode = 'wait';
    this.anchor = { x: ch.pos.x, z: ch.pos.z, yaw: ch.yaw };
    this.boarding = null; // {vehicle, seat, t}
    this.exitT = 0;
    this.leftT = 0;
    this.fireT = rand(0.4, 0.9);
    this.ai = null; // DriverAI while they drive with you aboard
    this.aiKey = null;
    this.arrived = false;
    this.hold = false; // you asked them to pull over
    this.sideT = 0;
    this.sideDir = 1;
    this.idleT = rand(4, 10);
    this.engaging = null;
    this.wheel = null; // a car you asked them to drive
    this.wheelT = 0;
  }

  get name() { return this.ch.protagonistName; }

  setMode(mode, at = null) {
    this.mode = mode;
    if (mode === 'wait') {
      const p = at || this.ch.pos;
      const safe = this.offRoad(p.x, p.z);
      this.anchor = { x: safe.x, z: safe.z, yaw: at?.yaw ?? this.ch.yaw };
    }
    this.leftT = 0;
    this.boarding = null;
  }

  /** Nobody waits in the traffic lane: the nearest clear spot off the road. */
  offRoad(x, z) {
    if (!roadAt(x, z)) return { x, z };
    const w = this.game.world;
    const y0 = w.ground(x, z, this.ch.pos.y + 1);
    for (let r = 1.5; r <= 14; r += 1) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        if (roadAt(px, pz) || w.isWater(px, pz)) continue;
        const y = w.ground(px, pz, y0 + 1);
        if (Math.abs(y - y0) > 0.6 || w.collision.overlapsCircle(px, pz, 0.4, y + 0.2, 1.5)) continue;
        return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  /** A car bearing down on them: step aside (perpendicular to its path). */
  dodge() {
    const ch = this.ch;
    for (const v of this.game.vehicles) {
      if (v.speed < 3 || v.seats.includes(ch)) continue;
      const dx = ch.pos.x - v.pos.x, dz = ch.pos.z - v.pos.z;
      if (Math.abs(dx) > 25 || Math.abs(dz) > 25) continue;
      const vx = v.vel.x / v.speed, vz = v.vel.y / v.speed;
      const along = dx * vx + dz * vz;
      const across = dx * vz - dz * vx;
      if (along < 0 || along > 4 + v.speed * 1.4 || Math.abs(across) > v.hx + 1.4) continue;
      const side = across >= 0 ? 1 : -1;
      ch.wish.set(vz * side, -vx * side);
      ch.wishSpeed = 6.6;
      ch.faceYaw = null;
      return true;
    }
    return false;
  }

  /** Forget transient state (called when this character becomes the partner or the player). */
  reset() {
    this.boarding = null;
    this.exitT = 0;
    this.leftT = 0;
    this.releaseDriving();
    this.hold = false;
    this.engaging = null;
    this.wheel = null;
    const a = this.ch.anim_;
    a.aim = false; a.phone = false; a.talk = false;
    this.ch.wishSpeed = 0;
    this.ch.faceYaw = null;
  }

  releaseDriving() {
    this.ai = null; this.aiKey = null; this.arrived = false;
  }

  step(dt) {
    const ch = this.ch;
    if (ch.dead) { this.releaseDriving(); return; }
    if (ch.knockT > 0) { ch.wishSpeed = 0; return; }
    if (ch.vehicle) { this.stepVehicle(dt); return; }
    this.stepFoot(dt);
  }

  // ------------------------------------------------------------ on foot
  stepFoot(dt) {
    const g = this.game, ch = this.ch, p = g.player, a = ch.anim_;
    this.exitT = 0;
    a.talk = false;
    if (this.dodge()) { a.phone = false; return; }
    if (this.engage(dt, false)) return;
    a.aim = false;
    a.armed = false;
    if (this.wheel && this.takeWheel(dt)) return;
    if (this.mode === 'follow' && !p.dead) {
      a.phone = false;
      const pv = p.vehicle;
      if (pv) { this.followVehicle(dt, pv); return; }
      this.leftT = 0;
      this.boarding = null;
      this.followOnFoot(dt);
      return;
    }
    // waiting: walk back to the anchor, then idle (sometimes on the phone)
    const d = ch.distanceTo(this.anchor.x, this.anchor.z);
    if (d > 2.5) { this.moveTo(this.anchor.x, this.anchor.z, d > 12 ? SPEED.run : SPEED.walk + 0.4, dt); a.phone = false; return; }
    ch.wishSpeed = 0;
    ch.faceYaw = this.anchor.yaw;
    this.idleT -= dt;
    if (this.idleT <= 0) { a.phone = !a.phone; this.idleT = a.phone ? rand(6, 12) : rand(8, 20); }
  }

  followOnFoot(dt) {
    const g = this.game, ch = this.ch, p = g.player;
    const dP = ch.distanceTo(p.pos.x, p.pos.z);
    if (dP > 80 && !this.onScreen()) { this.warpNear(p.pos.x, p.pos.z, p.yaw); return; }
    // a spot just behind and to the right of the player — or straight behind, or right on their
    // heels, when the side spot would be off a pier, over water or down a level
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -fz, rz = fx;
    const w = g.world;
    const ok = (x, z) => !w.isWater(x, z) && Math.abs(w.ground(x, z, p.pos.y + 0.5) - p.pos.y) < 0.4;
    let tx = p.pos.x - fx * 1.5 + rx * 1.1, tz = p.pos.z - fz * 1.5 + rz * 1.1;
    if (!ok(tx, tz)) { tx = p.pos.x - fx * 1.6; tz = p.pos.z - fz * 1.6; }
    if (!ok(tx, tz)) { tx = p.pos.x; tz = p.pos.z; }
    const d = ch.distanceTo(tx, tz);
    const pSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (d < 0.8 || (dP < 2.4 && pSpeed < 0.5)) {
      ch.wishSpeed = 0;
      if (dP < 6) ch.faceYaw = Math.atan2(p.pos.x - ch.pos.x, p.pos.z - ch.pos.z);
      ch.crouch = p.crouch;
      return;
    }
    ch.crouch = p.crouch && dP < 6;
    const speed = dP > 9 ? SPEED.sprint : dP > 4 ? SPEED.run : Math.max(SPEED.walk, Math.min(SPEED.run, pSpeed + 0.6));
    this.moveTo(tx, tz, speed, dt);
  }

  /** You're in a car: get in (passenger, or driver if you took the passenger seat). */
  followVehicle(dt, pv) {
    const g = this.game, ch = this.ch, p = g.player;
    const dCar = ch.distanceTo(pv.pos.x, pv.pos.z);
    if (pv.speed > 4 && dCar > 12) {
      this.boarding = null;
      this.leftT += dt;
      if (this.leftT > 4 && dCar > 45) {
        this.setMode('wait');
        g.hud?.subtitle(this.name, 'Guess I\'m walking. I\'ll wait here — come back for me.', 4);
        return;
      }
      this.moveTo(pv.pos.x, pv.pos.z, SPEED.sprint, dt);
      return;
    }
    this.leftT = 0;
    const seat = this.pickSeat(pv, p);
    if (seat < 0) { this.followOnFoot(dt); return; }
    const [dx, dz] = pv.doorPoint(seat);
    const dd = ch.distanceTo(dx, dz);
    if (dd < 0.7 && pv.speed < 1.5) {
      ch.wishSpeed = 0;
      g.seatCharacter(pv, seat, ch);
      g.audio?.door(pv.pos);
      this.boarding = null;
      return;
    }
    if (dCar > 70 && !this.onScreen()) { this.warpNear(dx, dz, pv.yaw); return; }
    const [ax, az] = doorApproachPoint(pv, seat, ch);
    this.moveTo(ax, az, dd > 3 ? SPEED.run : 2.2, dt);
  }

  /** Walk round to the driver's door of the car you pointed at and get behind the wheel. */
  takeWheel(dt) {
    const g = this.game, ch = this.ch, v = this.wheel;
    this.wheelT += dt;
    if (!g.vehicles.includes(v) || v.seats[0] || v.sunk || v.destroyed || this.wheelT > 15) { this.wheel = null; return false; }
    const [dx, dz] = v.doorPoint(0);
    const dd = ch.distanceTo(dx, dz);
    if (dd < 0.7 && v.speed < 1) {
      ch.wishSpeed = 0;
      g.seatCharacter(v, 0, ch);
      g.audio?.door(v.pos);
      v.engineOn = true;
      this.wheelT = 0; // now waiting for you to get in
      return true;
    }
    const [ax, az] = doorApproachPoint(v, 0, ch);
    this.moveTo(ax, az, dd > 3 ? SPEED.run : 2.2, dt);
    return true;
  }

  pickSeat(v, p) {
    if (v.sunk || v.destroyed) return -1;
    if (p.seat > 0 && !v.seats[0]) return 0;
    for (let s = 1; s < v.seats.length; s++) if (!v.seats[s]) return s;
    return -1;
  }

  moveTo(x, z, speed, dt) {
    const ch = this.ch;
    const d = ch.distanceTo(x, z) || 1;
    let wx = (x - ch.pos.x) / d, wz = (z - ch.pos.z) / d;
    // blocked (a wall, a car): sidestep for a moment
    if (ch.blockedT > 0.5 && this.sideT <= 0) { this.sideT = 0.8; this.sideDir = -this.sideDir; }
    if (this.sideT > 0) { this.sideT -= dt; const t = wx; wx = -wz * this.sideDir * 0.8 + wx * 0.2; wz = t * this.sideDir * 0.8 + wz * 0.2; }
    ch.wish.set(wx, wz);
    ch.wishSpeed = speed;
    ch.faceYaw = null;
  }

  onScreen() {
    const tr = this.game.traffic;
    const ch = this.ch;
    return tr ? tr.visible(ch.pos.x, ch.pos.y + 1, ch.pos.z, 1) : true;
  }

  /** Catch up off-screen: appear on clear ground behind the player. */
  warpNear(x, z, yaw) {
    const g = this.game, ch = this.ch, w = g.world;
    for (const [back, side] of [[3, 1.5], [3, -1.5], [5, 0], [2, 2.5], [2, -2.5], [6, 2], [0, 3], [0, -3]]) {
      const px = x - Math.sin(yaw) * back - Math.cos(yaw) * side, pz = z - Math.cos(yaw) * back + Math.sin(yaw) * side;
      const y = w.ground(px, pz, (g.player.pos.y || 0) + 1.5);
      if (w.isWater(px, pz) || Math.abs(y - g.player.pos.y) > 1.2) continue;
      if (w.collision.overlapsCircle(px, pz, 0.35, y + 0.2, 1.5)) continue;
      if (g.vehicles.some((v) => Math.hypot(v.pos.x - px, v.pos.z - pz) < v.hz + 0.5)) continue;
      ch.pos.set(px, y, pz); ch.vel.set(0, 0, 0); ch.swim = false; ch.grounded = true; ch.yaw = yaw;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ in a vehicle
  stepVehicle(dt) {
    const g = this.game, ch = this.ch, p = g.player, v = ch.vehicle;
    const together = v.seats.includes(p) && !p.dead;
    ch.anim_.phone = false;
    if (ch.seat === 0) {
      if (together) { this.wheel = null; this.engage(dt, true); this.drive(dt, v); return; }
      this.releaseDriving();
      this.park(v);
      // behind the wheel because you asked: wait a while for you to get in
      if (this.wheel === v) {
        this.wheelT += dt;
        const dP = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z);
        if (this.wheelT < 20 && dP < 25 && !p.vehicle) return;
        this.wheel = null;
      }
      // you walked off or took another car: they get out and follow
      const leave = this.mode === 'follow' && (!p.vehicle || p.vehicle !== v) && v.speed < 1;
      this.exitT = leave ? this.exitT + dt : 0;
      if (this.exitT > 0.7) this.getOut(v);
      return;
    }
    // passenger: shoot back at hostiles; get out when you do
    if (together) { this.exitT = 0; this.engage(dt, true); return; }
    ch.anim_.aim = false;
    this.exitT = v.speed < 2 ? this.exitT + dt : 0;
    if (this.exitT > 0.5) this.getOut(v);
  }

  park(v) {
    v.input.throttle = 0; v.input.steer = 0;
    v.input.brake = v.vLong > 0.3 ? 1 : 0;
    v.input.handbrake = v.speed < 0.5;
    v.horn = false;
  }

  getOut(v) {
    const g = this.game, ch = this.ch;
    const spot = g.player.controller.findExitSpot ? g.player.controller.findExitSpot(v, ch.seat) : null;
    g.unseatCharacter(v, ch, spot && !spot.roof ? spot : null);
    g.audio?.door(v.pos);
    this.exitT = 0;
  }

  /** Where to drive: the mission's destination, else your map waypoint, else cruise. */
  driveTarget() {
    const g = this.game;
    return g.missions?.partnerDriveTarget?.() || g.hud?.waypoint || null;
  }

  drive(dt, v) {
    const g = this.game;
    if (this.hold) { this.park(v); return; }
    const dest = this.driveTarget();
    const key = dest ? `${Math.round(dest.x)},${Math.round(dest.z)}` : 'cruise';
    if (!this.ai || key !== this.aiKey) {
      this.ai = attachDriver(v, g, dest);
      this.ai.speedScale = dest?.urgent ? 1.25 : 1.05;
      this.ai.emergency = !!dest?.urgent; // in a getaway they don't wait at red lights
      this.aiKey = key;
      this.arrived = false;
    }
    if (dest && Math.hypot(v.pos.x - dest.x, v.pos.z - dest.z) < (dest.arrive || 18)) {
      if (!this.arrived) { this.arrived = true; g.hud?.subtitle(this.name, dest.line || 'We\'re here.', 2.5); }
      this.park(v);
      return;
    }
    this.ai.step(dt);
  }

  // ------------------------------------------------------------ combat
  /** Anyone hostile to the crew (mission enemies; they leave brawling civilians to you). */
  findEnemy(range) {
    const g = this.game, ch = this.ch;
    let best = null, bd = range;
    for (const c of g.allCharacters()) {
      if (c === ch || c.dead || c === g.player) continue;
      if (!c.enemy) continue;
      const cp = c.vehicle ? c.vehicle.pos : c.pos;
      const d = Math.hypot(cp.x - ch.pos.x, cp.z - ch.pos.z);
      if (d < bd && this.canSee(cp)) { bd = d; best = c; }
    }
    return best;
  }

  canSee(tp) {
    const ch = this.ch, src = ch.vehicle ? ch.vehicle.pos : ch.pos;
    const hit = this.game.world.collision.raycast(src.x, src.y + 1.4, src.z, tp.x - src.x, tp.y + 1.1 - (src.y + 1.4), tp.z - src.z, 1, (c) => c.tag !== 'prop' && c.tag !== 'glass');
    return !hit || hit.t > 0.96;
  }

  /** Shoot back at hostiles (using their own pistol and ammo). Returns true while engaged on foot. */
  engage(dt, inVehicle) {
    const g = this.game, ch = this.ch, a = ch.anim_;
    const inv = ch.pc?.inventory;
    const ammo = inv?.ammo?.pistol;
    if (!inv || !inv.weapons.includes('pistol') || !ammo || ammo.mag + ammo.reserve <= 0) { a.aim = false; return false; }
    if (inVehicle && ch.seat === 0 && ch.vehicle.speed > 2) { a.aim = false; return false; } // drivers keep both hands on the wheel
    const enemy = this.findEnemy(inVehicle ? 45 : 38);
    this.engaging = enemy;
    if (!enemy) { a.aim = false; return false; }
    const tp = enemy.vehicle ? enemy.vehicle.pos : enemy.pos;
    const base = ch.vehicle ? ch.vehicle.pos : ch.pos;
    const yawTo = Math.atan2(tp.x - base.x, tp.z - base.z);
    a.armed = true; a.aim = true; a.aimPitch = 0;
    if (!inVehicle) { ch.wishSpeed = 0; ch.faceYaw = yawTo; }
    else a.carAimYaw = Math.atan2(Math.sin(yawTo - ch.vehicle.yaw), Math.cos(yawTo - ch.vehicle.yaw));
    this.fireT -= dt;
    if (this.fireT > 0) return true;
    this.fireT = rand(0.55, 1.0);
    if (ammo.mag <= 0) { const n = Math.min(WEAPONS.pistol.mag, ammo.reserve); ammo.mag += n; ammo.reserve -= n; this.fireT = WEAPONS.pistol.reload; return true; }
    ammo.mag--;
    const from = new THREE.Vector3(base.x + Math.sin(yawTo) * (inVehicle ? 1.1 : 0.5), base.y + (inVehicle ? 1.15 : 1.4), base.z + Math.cos(yawTo) * (inVehicle ? 1.1 : 0.5));
    const at = new THREE.Vector3(tp.x, tp.y + (enemy.vehicle ? 0.9 : 1.2), tp.z);
    const d = from.distanceTo(at);
    const moving = (ch.vehicle ? ch.vehicle.speed : 0) + (enemy.vehicle ? enemy.vehicle.speed : 0);
    g.combat.fire(ch, from, at.sub(from).normalize(), { ...WEAPONS.pistol, damage: 16 }, 0.03 + d * 0.0014 + moving * 0.002);
    return true;
  }
}
