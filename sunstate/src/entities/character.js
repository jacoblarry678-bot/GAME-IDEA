/**
 * Character physics and state shared by the player, pedestrians and police:
 * capsule movement with acceleration, gravity, curbs and drops, static
 * collision, swimming and climbing out of the water, health and death.
 * Controllers (player input, ped AI, cop AI) only set wish direction/speed.
 */
import * as THREE from 'three';
import { HumanModel, HumanAnimator } from './humanModel.js';
import { isClimbable } from '../world/layout.js';

const GRAV = 15.5;
let nextId = 1;

export class Character {
  constructor(game, look, { role = 'ped', x = 0, z = 0, yaw = 0 } = {}) {
    this.id = nextId++;
    this.game = game;
    this.role = role;
    this.look = look;
    this.model = new HumanModel(look);
    this.anim = new HumanAnimator(this.model);
    this.pos = new THREE.Vector3(x, game.world.ground(x, z, 2), z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.radius = 0.3;
    this.height = look.height;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.grounded = true;
    this.swim = false;
    this.dead = false;
    this.deadT = 0;
    this.vehicle = null;
    this.seat = -1;
    this.wish = new THREE.Vector2();
    this.wishSpeed = 0;
    this.jumpReq = false;
    this.crouch = false;
    this.faceYaw = null; // when set, turn to this instead of the movement direction
    this.turnRate = 10;
    this.anim_ = { aim: false, aimPitch: 0, armed: false, surrender: false, cower: false, phone: false, talk: false, punch: 0, flinch: 0, lookYaw: 0, sitGround: false };
    this.climbT = 0;
    this.knockT = 0; // knocked down by a vehicle: lies briefly, then gets up
    this.lastDamager = null;
    this.blockedT = 0;
    this.group = this.model.group;
    this.group.position.copy(this.pos);
    game.engine.scene.add(this.group);
  }

  get alive() { return !this.dead; }

  /** One fixed physics step. */
  step(dt) {
    if (this.vehicle) {
      // occupants ride along: everything that reads pos (missions, AI, HUD) sees the car's position
      this.pos.set(this.vehicle.pos.x, this.vehicle.pos.y, this.vehicle.pos.z);
      this.vel.set(this.vehicle.vel.x, 0, this.vehicle.vel.y);
      return;
    }
    const world = this.game.world;
    if (this.dead || this.knockT > 0) {
      if (this.knockT > 0) this.knockT -= dt;
      this.vel.x *= 0.9; this.vel.z *= 0.9;
      this.vel.y -= GRAV * dt;
      this.pos.addScaledVector(this.vel, dt);
      const g = world.ground(this.pos.x, this.pos.z, this.pos.y + 0.5);
      if (this.pos.y <= g) { this.pos.y = g; this.vel.y = 0; }
      const r = world.collision.resolveCircle(this.pos.x, this.pos.z, this.radius, this.pos.y + 0.2, 0.5);
      this.pos.x = r.x; this.pos.z = r.z;
      return;
    }
    if (this.climbT > 0) { this.climbT -= dt; return; }

    // horizontal velocity toward the wish velocity
    const sp = this.swim ? Math.min(this.wishSpeed, 2.4) : this.wishSpeed;
    const wx = this.wish.x * sp, wz = this.wish.y * sp;
    const accel = this.swim ? 3 : this.grounded ? 13 : 2.2;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx - this.vel.x) * k;
    this.vel.z += (wz - this.vel.z) * k;

    if (this.jumpReq && this.grounded && !this.swim) { this.vel.y = 5.0; this.grounded = false; }
    this.jumpReq = false;

    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    let ny = this.pos.y;
    // a ledge more than knee height above us blocks like a wall
    const gAhead = world.ground(nx, nz, this.pos.y + 0.5);
    let px = nx, pz = nz;
    if (gAhead - this.pos.y > 0.5 && !this.swim) { px = this.pos.x; pz = this.pos.z; this.vel.x *= 0.2; this.vel.z *= 0.2; }
    const res = world.collision.resolveCircle(px, pz, this.radius, this.pos.y + 0.3, this.height - 0.3);
    if (res.hit) {
      // remove the velocity component into the obstacle
      const l = Math.hypot(res.nx, res.nz) || 1;
      const nxn = res.nx / l, nzn = res.nz / l;
      const vn = this.vel.x * nxn + this.vel.z * nzn;
      if (vn < 0) { this.vel.x -= vn * nxn; this.vel.z -= vn * nzn; }
      this.blockedT += dt;
    } else this.blockedT = this.carBlockT > 0 ? this.blockedT + dt : 0; // leaning on a car counts too
    if (this.carBlockT > 0) this.carBlockT -= dt;
    this.pos.x = res.x; this.pos.z = res.z;

    // vertical
    const g = world.ground(this.pos.x, this.pos.z, this.pos.y + 0.5);
    const wy = world.waterY;
    const deepWater = wy - g > 1.25;
    if (this.swim) {
      ny = wy - 1.3;
      this.vel.y = 0;
      if (!deepWater) { this.swim = false; ny = Math.max(g, ny); }
      else if (this.tryClimbOut(world)) ny = this.pos.y;
    } else {
      this.vel.y -= GRAV * dt;
      ny = this.pos.y + this.vel.y * dt;
      const snap = this.grounded && this.vel.y <= 0 && ny - g < 0.35 && ny - g > -0.6; // walk down curbs
      if (ny <= g || snap) {
        if (!this.grounded && this.vel.y < -13) this.damage(Math.round((-this.vel.y - 13) * 9), null, 'fall');
        ny = g; this.vel.y = 0; this.grounded = true;
      } else this.grounded = false;
      if (deepWater && ny < wy - 1.1) { this.swim = true; this.grounded = false; this.vel.y = 0; this.game.events?.emit('splash', this); }
    }
    this.pos.y = ny;
  }

  tryClimbOut(world) {
    const l = Math.hypot(this.wish.x, this.wish.y);
    if (l < 0.3) return false;
    const dx = this.wish.x / l, dz = this.wish.y / l;
    const px = this.pos.x + dx * 0.9, pz = this.pos.z + dz * 0.9;
    const g2 = world.ground(px, pz, 2);
    if (g2 > world.waterY - 0.3 && isClimbable(px, pz) && !world.collision.overlapsCircle(px, pz, this.radius, g2 + 0.1, this.height - 0.2)) {
      this.pos.set(px, g2, pz);
      this.swim = false; this.grounded = true; this.vel.set(0, 0, 0);
      this.climbT = 0.35;
      return true;
    }
    return false;
  }

  /** Visual update (every rendered frame). */
  updateVisual(dt) {
    if (this.vehicle) {
      this.vehicle.seatTransform(this.seat, this.group);
    } else {
      // face movement or a requested yaw
      let target = this.faceYaw;
      if (target === null && !this.dead && Math.hypot(this.vel.x, this.vel.z) > 0.3) target = Math.atan2(this.vel.x, this.vel.z);
      if (target !== null && !this.dead && this.knockT <= 0) {
        let d = target - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-this.turnRate * dt));
      }
      this.group.position.copy(this.pos);
      this.group.rotation.set(0, this.yaw, 0);
    }
    if (this.dead) this.deadT += dt;
    // distance LOD: no shadow far away, and animate distant people less often
    const cam = this.game.engine.camera.position;
    const dc = Math.abs(this.pos.x - cam.x) + Math.abs(this.pos.z - cam.z);
    this.model.mesh.castShadow = dc < 60 || !!this.protagonist;
    if (dc > 80 && !this.protagonist) {
      this._lodAcc = (this._lodAcc || 0) + dt;
      if (this._lodAcc < 0.1) return;
      dt = this._lodAcc;
    }
    this._lodAcc = 0;
    const a = this.anim_;
    if (a.punch > 0) a.punch = Math.max(0, a.punch - dt * 3.5);
    if (a.flinch > 0) a.flinch = Math.max(0, a.flinch - dt * 4);
    const knocked = this.knockT > 0;
    this.anim.update(dt, {
      speed: this.vehicle ? 0 : Math.hypot(this.vel.x, this.vel.z),
      grounded: this.grounded || this.swim,
      crouch: this.crouch,
      aim: a.aim, aimPitch: a.aimPitch, armed: a.armed, carAimYaw: a.carAimYaw,
      sitting: !!this.vehicle, passenger: this.seat > 0, steer: this.vehicle ? this.vehicle.steer : 0,
      surrender: a.surrender, cower: a.cower, phone: a.phone, talk: a.talk,
      swim: this.swim, punch: a.punch, flinch: a.flinch, lookYaw: a.lookYaw, sitGround: a.sitGround && !this.dead,
      dead: this.dead ? Math.min(1, this.deadT * 1.8) : knocked ? 1 : 0,
    });
  }

  damage(amount, source, kind = 'bullet') {
    if (this.dead || amount <= 0) return;
    if (this.armor > 0 && kind !== 'fall') {
      const a = Math.min(this.armor, amount * 0.7);
      this.armor -= a; amount -= a;
    }
    this.health -= amount;
    this.lastDamager = source;
    this.anim_.flinch = 1;
    this.game.events?.emit('damaged', { victim: this, source, amount, kind });
    if (this.health <= 0) this.kill(source, kind);
  }

  kill(source, kind) {
    if (this.dead) return;
    this.health = 0;
    this.dead = true;
    this.deadT = 0;
    this.anim_.aim = false; this.anim_.phone = false; this.anim_.surrender = false;
    this.game.events?.emit('killed', { victim: this, source, kind });
  }

  /** Knock down (hit by a vehicle). */
  knockDown(vx, vz, impact, source) {
    if (this.dead) return;
    this.vel.set(vx * 0.6, Math.min(4, impact * 0.25), vz * 0.6);
    this.grounded = false;
    this.knockT = 2.2;
    this.damage(Math.round(impact * 4), source, 'vehicle');
  }

  distanceTo(x, z) { return Math.hypot(this.pos.x - x, this.pos.z - z); }

  dispose() {
    this.game.engine.scene.remove(this.group);
    this.model.dispose();
  }
}
