/**
 * Arcade-realistic car physics on a 2D rigid body (plus vertical motion):
 * per-axle tyre slip angles with saturating lateral grip, weight transfer,
 * a friction circle on the driven axle (wheelspin and power oversteer),
 * speed-sensitive steering, handbrake, drag and rolling resistance.
 * Suspension pitch/roll is visual and driven by the body's accelerations.
 *
 * Angles: yaw θ rotates local +z (forward) to world (sin θ, cos θ).
 * w = dθ/dt. Right vector = (-cos θ, sin θ).
 */
import * as THREE from 'three';
import { VEHICLES } from '../data/vehicles.js';
import { buildCarModel } from './vehicleModel.js';
import { obbObb } from '../world/collision.js';

const G = 9.81;
let nextId = 1;

export class Vehicle {
  constructor(game, model, { x = 0, z = 0, yaw = 0, color = null, plate = null } = {}) {
    this.id = nextId++;
    this.game = game;
    this.modelId = model;
    this.def = VEHICLES[model];
    const d = this.def;
    this.color = color ?? d.colors[Math.floor(Math.random() * d.colors.length)];
    this.police = !!d.police;
    const m = buildCarModel(d, this.color, { police: this.police, plate });
    this.mesh = m;
    this.group = m.root;
    game.engine.scene.add(this.group);

    this.pos = new THREE.Vector3(x, game.world.ground(x, z, 3), z);
    this.yaw = yaw;
    this.vel = new THREE.Vector2(); // world x, z
    this.w = 0;
    this.vy = 0;
    this.airborne = false;
    this.mass = d.mass;
    this.inertia = (d.mass * (d.length * d.length + d.width * d.width)) / 12 * 1.1;
    this.a = d.cgToFront; // CG → front axle
    this.b = d.wheelbase - d.cgToFront;
    this.hx = d.width / 2;
    this.hz = d.length / 2;
    this.steer = 0; // -1..1 visual/input
    this.steerAngle = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.ax = 0; this.ay = 0; // long / lat acceleration (for weight transfer and suspension)
    this.pitch = 0; this.roll = 0; this.pitchV = 0; this.rollV = 0;
    this.groundPitch = 0; this.groundRoll = 0;
    this.rpm = d.idleRpm; this.gear = 1;
    this.wheelSpin = 0;
    this.slip = 0; // tyre squeal amount 0..1
    this.health = 1000;
    this.engineOn = false;
    this.destroyed = false;
    this.sunk = false;
    this.seats = new Array(d.seats.length).fill(null);
    this.lightsOn = false;
    this.siren = false;
    this.sirenT = 0;
    this.horn = false;
    this.lastImpact = 0;
    this.impactCooldown = 0;
    this.braking = false;
    this.reversing = false;
    this.owner = null; // 'player' for owned cars
    this.ai = null;
    this.parked = true;
    this.persistentId = null;
    this.smoke = 0;
    this.lastDriverRole = null;
    this.updateMesh(0);
  }

  get speed() { return this.vel.length(); }
  get forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  get vLong() { const [fx, fz] = this.forward; return this.vel.x * fx + this.vel.y * fz; }
  get driver() { return this.seats[0]; }
  get occupied() { return this.seats.some(Boolean); }

  /** Seat or door position in world space. side -1 = left (driver in LHD). */
  localToWorld(lx, lz) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c];
  }
  worldToLocal(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  /** Door positions for a seat (outside the body). */
  doorPoint(seat) {
    const [sx, , sz] = this.def.seats[seat];
    const side = Math.sign(sx) || -1;
    return this.localToWorld(side * (this.hx + 0.55), sz + 0.25);
  }

  /** Place an occupant's group at the seat. */
  seatTransform(seat, group) {
    const [sx, sy, sz] = this.def.seats[seat];
    const occ = this.seats[seat];
    const sc = occ ? occ.model.scale : 1;
    const v = new THREE.Vector3(sx, sy - 0.95 * sc + 0.48, sz);
    this.mesh.body.localToWorld(v);
    group.position.copy(v);
    group.quaternion.copy(this.mesh.body.getWorldQuaternion(new THREE.Quaternion()));
  }

  /** Fixed-step physics. */
  step(dt) {
    const d = this.def;
    const world = this.game.world;
    if (this.impactCooldown > 0) this.impactCooldown -= dt;
    let { throttle, brake, steer, handbrake } = this.input;
    const parked = !this.driver && !this.ai;
    if (parked) { throttle = 0; brake = 0; steer = 0; handbrake = true; }
    if (this.destroyed || this.sunk) { throttle = 0; }
    const [fx, fz] = this.forward;
    const rx = -fz, rz = fx; // right
    let vLong = this.vel.x * fx + this.vel.y * fz;
    let vLat = this.vel.x * rx + this.vel.y * rz;
    const speed = Math.hypot(vLong, vLat);

    // steering eases toward the input; less lock at speed
    const lock = d.steerMax / (1 + (speed / d.steerSpeedRef) ** 2);
    const target = steer * lock;
    const rate = (Math.abs(target) < Math.abs(this.steerAngle) ? 4.5 : 3.0) * dt;
    this.steerAngle += THREE.MathUtils.clamp(target - this.steerAngle, -rate, rate);
    this.steer = this.steerAngle / Math.max(0.01, d.steerMax);
    const delta = this.steerAngle;

    // drive / brake / reverse logic
    let drive = 0, brakeF = 0;
    this.reversing = false;
    if (throttle > 0) {
      if (vLong < -1) brakeF = d.brakeForce * throttle;
      else drive = throttle * this.engineForce(vLong);
    }
    if (brake > 0) {
      if (vLong > 1) brakeF = d.brakeForce * brake;
      else if (throttle === 0) { this.reversing = true; drive = vLong > -d.reverseSpeed ? -brake * d.engineForce * 0.55 : 0; }
    }
    if (parked && Math.abs(vLong) > 0.05) brakeF = d.brakeForce * 0.7;
    this.braking = brakeF > 0 && vLong > 0.5 && !parked;

    // vertical loads with longitudinal weight transfer
    const L = d.wheelbase;
    const shift = (d.cgHeight / L) * this.mass * this.ax;
    let Nf = (this.mass * G * this.b) / L - shift;
    let Nr = (this.mass * G * this.a) / L + shift;
    Nf = Math.max(Nf, this.mass * G * 0.15); Nr = Math.max(Nr, this.mass * G * 0.15);
    const healthGrip = this.sunk ? 0.1 : 1;
    const muF = d.grip * healthGrip;
    const muR = d.grip * d.rearGripScale * healthGrip * (handbrake ? d.handbrakeGrip / d.grip : 1);

    // longitudinal tyre forces split by drive layout, limited by traction
    let FxF = 0, FxR = 0;
    if (d.drive === 'fwd') FxF += drive; else FxR += drive;
    const bdir = -Math.sign(vLong || 0);
    FxF += bdir * brakeF * 0.62;
    FxR += bdir * brakeF * 0.38;
    if (handbrake && Math.abs(vLong) > 0.5) FxR += -Math.sign(vLong) * muR * Nr * 0.6;
    const capF = muF * Nf, capR = muR * Nr;
    let spin = 0;
    if (Math.abs(FxF) > capF) { spin = Math.max(spin, (Math.abs(FxF) - capF) / capF); FxF = Math.sign(FxF) * capF; }
    if (Math.abs(FxR) > capR) { spin = Math.max(spin, (Math.abs(FxR) - capR) / capR); FxR = Math.sign(FxR) * capR; }

    // lateral tyre forces from slip angles (saturating), friction circle
    const absV = Math.max(Math.abs(vLong), 0.5);
    const vLatF = vLat - this.w * this.a;
    const vLatR = vLat + this.w * this.b;
    const sgn = vLong >= 0 ? 1 : -1;
    const alphaF = Math.atan2(vLatF, absV) - delta * sgn;
    const alphaR = Math.atan2(vLatR, absV);
    const latCapF = Math.sqrt(Math.max(0, capF * capF - FxF * FxF));
    const latCapR = Math.sqrt(Math.max(0, capR * capR - FxR * FxR)) * (spin > 0.2 && d.drive === 'rwd' ? 0.6 : 1);
    let FyF = THREE.MathUtils.clamp(-d.cornerStiffF * alphaF, -latCapF, latCapF);
    let FyR = THREE.MathUtils.clamp(-d.cornerStiffR * alphaR, -latCapR, latCapR);
    this.slip = THREE.MathUtils.clamp(Math.max(Math.abs(alphaR) - 0.09, Math.abs(alphaF) - 0.12, 0) * 3 + spin * 0.6 + (handbrake && speed > 4 ? 0.4 : 0), 0, 1) * (speed > 2 || spin > 0.3 ? 1 : 0);

    // resistances
    const drag = d.drag * speed;
    const Flong = FxF * Math.cos(delta) - FyF * Math.sin(delta) + FxR - drag * vLong - d.rollRes * vLong;
    const Flat = FyF * Math.cos(delta) + FxF * Math.sin(delta) + FyR - drag * vLat - d.rollRes * vLat;
    const torque = -this.a * (FyF * Math.cos(delta) + FxF * Math.sin(delta)) + this.b * FyR;

    if (!this.airborne) {
      let al = Flong / this.mass, at = Flat / this.mass;
      // low speed: blend toward a kinematic bicycle model to avoid jitter
      const kin = THREE.MathUtils.clamp(1 - (speed - 1.5) / 2.5, 0, 1);
      let wTarget = this.w + (torque / this.inertia) * dt;
      if (kin > 0) {
        const wKin = -(vLong * Math.tan(delta)) / L;
        wTarget = wTarget * (1 - kin) + wKin * kin;
        at = at * (1 - kin) + (-vLat / dt) * kin * 0.5;
      }
      // mild yaw damping (tyre scrub / aero) keeps saturated slides recoverable
      if (!handbrake) wTarget *= Math.exp(-0.5 * dt);
      this.w = wTarget;
      const before = vLong;
      vLong += al * dt;
      // brakes stop the car; they never push it backwards
      if (drive === 0 && (brakeF > 0 || handbrake) && Math.sign(vLong) !== Math.sign(before)) vLong = 0;
      if (parked && Math.abs(vLong) < 0.3) vLong *= 0.5;
      vLat += at * dt;
      // stop creeping when idle
      if (throttle === 0 && Math.abs(vLong) < 0.25 && (brake > 0 ? false : true) && Math.abs(vLat) < 0.3) { vLong *= 0.8; vLat *= 0.8; if (Math.abs(vLong) < 0.05) vLong = 0; }
      if (Math.abs(this.w) < 0.002 && speed < 0.3) this.w = 0;
      this.ax = this.ax + (al - this.ax) * Math.min(1, dt * 8);
      this.ay = this.ay + (at + vLong * -this.w - this.ay) * Math.min(1, dt * 8);
      this.vel.set(vLong * fx + vLat * rx, vLong * fz + vLat * rz);
    } else {
      this.w *= 0.995;
    }
    this.wheelSpin += ((vLong + (spin > 0.1 ? Math.sign(drive) * 12 * spin : 0)) / d.wheelR) * dt;

    // integrate
    this.yaw += this.w * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    this.collideStatic();
    this.vertical(dt, world);
    this.updateEngine(dt, vLong, throttle, spin);
    this.suspension(dt);
  }

  /** Spring-damper body pitch/roll from accelerations (fixed step keeps it stable). */
  suspension(dt) {
    const d = this.def;
    const k = 60, c = 9 / d.suspension;
    const tp = THREE.MathUtils.clamp(-this.ax * 0.012 * d.suspension, -0.12, 0.12);
    const tr = THREE.MathUtils.clamp(this.ay * 0.016 * d.suspension, -0.14, 0.14);
    this.pitchV += ((tp - this.pitch) * k - this.pitchV * c) * dt;
    this.rollV += ((tr - this.roll) * k - this.rollV * c) * dt;
    this.pitch = THREE.MathUtils.clamp(this.pitch + this.pitchV * dt, -0.2, 0.2);
    this.roll = THREE.MathUtils.clamp(this.roll + this.rollV * dt, -0.2, 0.2);
  }

  engineForce(v) {
    const d = this.def;
    const r = Math.max(0, v) / d.topSpeed;
    let f = d.engineForce * Math.max(0, 1 - r ** 2.2);
    if (this.health < 300) f *= 0.5;
    if (this.destroyed || this.sunk) f = 0;
    return f;
  }

  updateEngine(dt, vLong, throttle, spin) {
    const d = this.def;
    const v = Math.abs(vLong);
    // pick a gear from road speed; rpm from wheel speed and ratio
    const n = d.gears.length;
    const band = d.topSpeed / n;
    const g = Math.min(n, Math.floor(v / band) + 1);
    this.gear = this.reversing ? -1 : g;
    const within = (v - (g - 1) * band) / band;
    let rpm = d.idleRpm + within * (d.redline - d.idleRpm) * 0.85 + (g > 1 ? d.idleRpm * 1.2 : 0);
    if (spin > 0.1) rpm = Math.max(rpm, d.redline * (0.6 + spin * 0.3));
    if (v < 0.5 && throttle > 0) rpm = d.idleRpm + throttle * (d.redline - d.idleRpm) * 0.5;
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 10);
    this.throttleAmt = throttle;
  }

  /** Ground following at the four wheels, falling off ledges, water. */
  vertical(dt, world) {
    const d = this.def;
    const hy = this.pos.y + 0.6;
    const [flx, flz] = this.localToWorld(-d.track / 2, this.a);
    const [frx, frz] = this.localToWorld(d.track / 2, this.a);
    const [rlx, rlz] = this.localToWorld(-d.track / 2, -this.b);
    const [rrx, rrz] = this.localToWorld(d.track / 2, -this.b);
    const gfl = world.ground(flx, flz, hy), gfr = world.ground(frx, frz, hy), grl = world.ground(rlx, rlz, hy), grr = world.ground(rrx, rrz, hy);
    const gAvg = (gfl + gfr + grl + grr) / 4;
    if (this.pos.y > gAvg + 0.25 || this.vy > 0.5) {
      this.airborne = true;
      this.vy -= G * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gAvg) {
        if (this.vy < -6) this.applyDamage((-this.vy - 6) * 30, 'landing');
        this.pos.y = gAvg; this.vy = 0; this.airborne = false;
        this.pitchV -= 0.6;
      }
    } else {
      // follow the ground, keeping a little vertical velocity for ramps
      const prev = this.pos.y;
      this.pos.y = gAvg;
      this.vy = (gAvg - prev) / dt;
      this.vy = Math.min(this.vy, 3);
      this.airborne = false;
    }
    this.groundPitch = Math.atan2((gfl + gfr) / 2 - (grl + grr) / 2, d.wheelbase);
    this.groundRoll = Math.atan2((gfl + grl) / 2 - (gfr + grr) / 2, d.track);
    // water: the car floods and sinks; occupants must swim out
    const wy = world.waterY;
    if (gAvg < wy - 0.5 && this.pos.y < wy - 0.3) {
      if (!this.sunk) { this.sunk = true; this.engineOn = false; this.game.events?.emit('vehicleSunk', this); }
      this.vel.multiplyScalar(Math.exp(-2.5 * dt));
      this.w *= Math.exp(-2 * dt);
    }
  }

  /** Static world contacts: push out and bounce. */
  collideStatic() {
    const coll = this.game.world.collision;
    const contacts = coll.boxContacts(this.pos.x, this.pos.z, this.hx, this.hz, this.yaw, this.pos.y + 0.15, this.def.height - 0.1, this._contacts || (this._contacts = []));
    for (const c of contacts) {
      if (c.collider.tag === 'prop' && c.collider.data?.breakable) continue;
      this.pos.x += c.nx * c.depth;
      this.pos.z += c.nz * c.depth;
      this.applyImpulse(c.px, c.pz, c.nx, c.nz, null, 0.25);
    }
  }

  /** Collision impulse at a contact point against an immovable object (other = null) or another vehicle. */
  applyImpulse(px, pz, nx, nz, other, restitution = 0.2) {
    const rax = px - this.pos.x, raz = pz - this.pos.z;
    // point velocity: v + w × r  (w about +y): (w*rz, -w*rx)
    let vax = this.vel.x + this.w * raz, vaz = this.vel.y - this.w * rax;
    let vbx = 0, vbz = 0, rbx = 0, rbz = 0;
    if (other) { rbx = px - other.pos.x; rbz = pz - other.pos.z; vbx = other.vel.x + other.w * rbz; vbz = other.vel.y - other.w * rbx; }
    const rvx = vax - vbx, rvz = vaz - vbz;
    const vn = rvx * nx + rvz * nz;
    if (vn >= 0) return 0;
    const raCn = raz * nx - rax * nz; // (r × n).y
    const rbCn = rbz * nx - rbx * nz;
    let inv = 1 / this.mass + (raCn * raCn) / this.inertia;
    if (other) inv += 1 / other.mass + (rbCn * rbCn) / other.inertia;
    const j = (-(1 + restitution) * vn) / inv;
    this.vel.x += (j * nx) / this.mass; this.vel.y += (j * nz) / this.mass;
    this.w += (raCn * j) / this.inertia;
    if (other) { other.vel.x -= (j * nx) / other.mass; other.vel.y -= (j * nz) / other.mass; other.w -= (rbCn * j) / other.inertia; }
    // tangential friction
    const tx = -nz, tz = nx;
    const vt = rvx * tx + rvz * tz;
    const raCt = raz * tx - rax * tz;
    let invT = 1 / this.mass + (raCt * raCt) / this.inertia;
    if (other) { const rbCt = rbz * tx - rbx * tz; invT += 1 / other.mass + (rbCt * rbCt) / other.inertia; }
    const jt = THREE.MathUtils.clamp(-vt / invT, -0.35 * j, 0.35 * j);
    this.vel.x += (jt * tx) / this.mass; this.vel.y += (jt * tz) / this.mass;
    this.w += (raCt * jt) / this.inertia;
    if (other) { const rbCt = rbz * tx - rbx * tz; other.vel.x -= (jt * tx) / other.mass; other.vel.y -= (jt * tz) / other.mass; other.w -= (rbCt * jt) / other.inertia; }
    const dv = j / this.mass;
    if (dv > 2.5) {
      this.applyDamage((dv - 2.5) * 22 * this.def.fragility, 'impact');
      if (other) other.applyDamage((j / other.mass - 2.5) * 22 * other.def.fragility, 'impact');
      if (this.impactCooldown <= 0) {
        this.impactCooldown = 0.25;
        this.game.events?.emit('vehicleImpact', { vehicle: this, other, strength: dv, x: px, z: pz, y: this.pos.y + 0.6 });
      }
    }
    return j;
  }

  applyDamage(amount, kind) {
    if (amount <= 0 || this.destroyed) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.destroyed = true;
      this.engineOn = false;
      this.game.events?.emit('vehicleDestroyed', { vehicle: this, kind });
    }
  }

  /** Vehicle-vehicle contact resolution for a pair. */
  static collidePair(a, b) {
    if (Math.abs(a.pos.y - b.pos.y) > 2) return;
    const r = obbObb(a.pos.x, a.pos.z, a.hx, a.hz, a.yaw, b.pos.x, b.pos.z, b.hx, b.hz, b.yaw);
    if (!r) return;
    const ma = a.mass, mb = b.mass, tot = ma + mb;
    a.pos.x += r.nx * r.depth * (mb / tot); a.pos.z += r.nz * r.depth * (mb / tot);
    b.pos.x -= r.nx * r.depth * (ma / tot); b.pos.z -= r.nz * r.depth * (ma / tot);
    a.applyImpulse(r.px, r.pz, r.nx, r.nz, b, 0.2);
  }

  /** Render-rate visual update: transforms, wheels, suspension, lights. */
  updateMesh(dt) {
    const d = this.def;
    const m = this.mesh;
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.set(0, 0, 0);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.yaw;
    this.group.rotation.x = -this.groundPitch;
    this.group.rotation.z = this.groundRoll;
    m.body.rotation.set(this.pitch, 0, this.roll);
    m.body.position.y = 0.02 - Math.abs(this.pitch) * 0.4;
    for (const wh of m.wheels) {
      if (wh.front) wh.pivot.rotation.y = -this.steerAngle; // local +x is the car's left
      wh.spin.rotation.x = this.wheelSpin;
    }
    const night = this.game.engine.time.night;
    const lights = this.lightsOn || night > 0.4 || (this.ai && night > 0.3);
    m.parts.head.emissiveIntensity = (this.destroyed ? 0 : lights ? 2.6 : 0.15);
    m.parts.tail.emissiveIntensity = this.braking ? 3 : lights ? 1.2 : 0.25;
    m.parts.reverse.emissiveIntensity = this.reversing && this.vLong < -0.2 ? 2 : 0;
    this.headlightsVisible = lights && !this.destroyed;
    if (this.police) {
      this.sirenT += dt;
      const on = this.siren;
      const ph = Math.floor(this.sirenT * 6) % 2;
      m.parts.sirenRed.emissiveIntensity = on ? (ph ? 5 : 0.3) : 0;
      m.parts.sirenBlue.emissiveIntensity = on ? (ph ? 0.3 : 5) : 0;
    }
    // damage darkens the paint a little
    if (dt > 0 && this._shownHealth !== Math.round(this.health / 50)) {
      this._shownHealth = Math.round(this.health / 50);
      const f = 0.55 + 0.45 * (this.health / 1000);
      m.parts.paint.color.setHex(this.color).multiplyScalar(f);
    }
  }

  dispose() {
    this.game.engine.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
  }
}
