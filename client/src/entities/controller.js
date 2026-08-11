/**
 * Third-person character controller: capsule-vs-grid collision, acceleration,
 * stair handling, and an over-the-shoulder camera that collides with walls.
 */

import * as THREE from 'three';
import { MOVE, CENOBITE_MOVE, STAMINA, clamp } from '../../../shared/constants.js';
import { CELL, GRID_W, isSolid, groundAt, worldToGridX, worldToGridZ, FLOOR_Y } from '../../../shared/mapdata.js';

const CAM = {
  distance: 3.5,
  crouchDistance: 2.9,
  height: 1.58,
  shoulder: 0.62,
  minPitch: -1.15,
  maxPitch: 0.95,
  collideRadius: 0.34,
};

export class CharacterController {
  constructor(map, character, { isCenobite = false } = {}) {
    this.map = map;
    this.character = character;
    this.isCenobite = isCenobite;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.floor = 0;
    this.yaw = 0;
    this.pitch = -0.08;
    this.bodyYaw = 0;
    this.speedFrac = 0;
    this.crouching = false;
    this.sprinting = false;
    this.stamina = STAMINA.MAX;
    this.staminaDelay = 0;
    this.radius = MOVE.PLAYER_RADIUS;
    this.locked = 0; // seconds of movement lockout (vault, hit, execute)
    this.frozen = false;
    this.camDist = CAM.distance;
    this.shake = 0;
    this._tmp = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this.animState = 'idle';
  }

  spawn(x, y, z, floor, yaw = 0) {
    this.pos.set(x, y, z);
    this.floor = floor;
    this.yaw = yaw;
    this.bodyYaw = yaw;
    this.vel.set(0, 0, 0);
  }

  get eyeHeight() {
    return this.crouching ? MOVE.CROUCH_HEIGHT : MOVE.PLAYER_HEIGHT;
  }

  maxSpeed() {
    if (this.isCenobite) return this.sprinting ? CENOBITE_MOVE.SPRINT : CENOBITE_MOVE.WALK;
    if (this.crouching) return MOVE.CROUCH;
    if (this.sprinting && this.stamina > 0) return MOVE.SPRINT;
    return MOVE.WALK;
  }

  /** Solid test that also accounts for closed doors. */
  blocked(x, z, doors) {
    if (isSolid(this.map, this.floor, worldToGridX(x), worldToGridZ(z))) return true;
    if (doors) {
      for (const d of this.map.doors) {
        if (d.f !== this.floor) continue;
        const st = doors.get(d.id);
        if (!st || st.open) continue;
        // a closed door fills its cell along the blocking axis
        const dx = Math.abs(x - d.x);
        const dz = Math.abs(z - d.z);
        if (d.dir === 'z' ? dx < CELL / 2 && dz < 0.5 : dz < CELL / 2 && dx < 0.5) return true;
      }
    }
    return false;
  }

  /** Move with wall sliding; radius-aware so you can't clip corners. */
  tryMove(dx, dz, doors) {
    const r = this.radius;
    const probe = (x, z) =>
      this.blocked(x + r, z, doors) || this.blocked(x - r, z, doors) ||
      this.blocked(x, z + r, doors) || this.blocked(x, z - r, doors) ||
      this.blocked(x + r * 0.7, z + r * 0.7, doors) || this.blocked(x - r * 0.7, z - r * 0.7, doors) ||
      this.blocked(x + r * 0.7, z - r * 0.7, doors) || this.blocked(x - r * 0.7, z + r * 0.7, doors);

    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    if (!probe(nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
      return;
    }
    if (!probe(nx, this.pos.z)) {
      this.pos.x = nx;
      return;
    }
    if (!probe(this.pos.x, nz)) {
      this.pos.z = nz;
      return;
    }
    // fully blocked — bleed the velocity so we don't buzz against the wall
    this.vel.x *= 0.2;
    this.vel.z *= 0.2;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,magnitude:number}} move  input vector
   * @param {{x:number,y:number}} look                   look delta
   */
  update(dt, move, look, opts = {}) {
    const { doors, allowSprint = true, downed = false, canMove = true } = opts;

    // ---- look ----
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, CAM.minPitch, CAM.maxPitch);

    this.locked = Math.max(0, this.locked - dt);
    const canAct = canMove && this.locked <= 0 && !this.frozen;

    // ---- desired velocity in camera space ----
    let wishX = 0;
    let wishZ = 0;
    let mag = 0;
    if (canAct) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // move.y is -1 forward
      wishX = move.x * cos - move.y * sin;
      wishZ = -move.x * sin - move.y * cos;
      mag = Math.min(1, Math.hypot(wishX, wishZ));
      if (mag > 0.001) {
        wishX /= Math.hypot(wishX, wishZ) || 1;
        wishZ /= Math.hypot(wishX, wishZ) || 1;
      }
    }

    // ---- stamina ----
    const wantsSprint = allowSprint && this.sprintHeld && mag > 0.3 && !this.crouching && !downed;
    if (wantsSprint && this.stamina > 0) {
      this.sprinting = true;
      this.stamina = clamp(this.stamina - STAMINA.DRAIN * dt, 0, STAMINA.MAX);
      this.staminaDelay = STAMINA.REGEN_DELAY;
    } else {
      this.sprinting = false;
      this.staminaDelay = Math.max(0, this.staminaDelay - dt);
      if (this.staminaDelay <= 0) this.stamina = clamp(this.stamina + STAMINA.REGEN * dt, 0, STAMINA.MAX);
    }

    // ---- accelerate ----
    let target = this.maxSpeed() * mag;
    if (downed) target = Math.min(target, MOVE.DOWNED_CRAWL);
    if (opts.injured) target *= MOVE.INJURED_MULT;
    if (opts.speedMult) target *= opts.speedMult;

    const accel = this.isCenobite ? CENOBITE_MOVE.ACCEL : MOVE.ACCEL;
    const desiredX = wishX * target;
    const desiredZ = wishZ * target;
    const rate = mag > 0.01 ? accel : MOVE.FRICTION;
    this.vel.x += (desiredX - this.vel.x) * Math.min(1, rate * dt);
    this.vel.z += (desiredZ - this.vel.z) * Math.min(1, rate * dt);
    if (Math.abs(this.vel.x) < 0.004) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 0.004) this.vel.z = 0;

    // ---- integrate ----
    if (canAct || this.vel.lengthSq() > 0.0001) {
      this.tryMove(this.vel.x * dt, this.vel.z * dt, doors);
    }

    // ---- ground / stairs ----
    const g = groundAt(this.map, this.floor, this.pos.x, this.pos.z);
    this.floor = g.floor;
    this.pos.y += (g.y - this.pos.y) * Math.min(1, dt * 14);
    if (Math.abs(g.y - this.pos.y) < 0.01) this.pos.y = g.y;

    // ---- facing: body turns toward movement, snaps to camera when still ----
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.speedFrac = clamp(speed / MOVE.SPRINT, 0, 1);
    if (speed > 0.25) {
      const moveYaw = Math.atan2(-this.vel.x, -this.vel.z);
      let diff = moveYaw - this.bodyYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.bodyYaw += diff * Math.min(1, dt * 11);
    } else {
      let diff = this.yaw - this.bodyYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.1) this.bodyYaw += diff * Math.min(1, dt * 4);
    }

    // ---- animation state ----
    if (downed) this.animState = speed > 0.15 ? 'crawl' : 'downed';
    else if (this.frozen) this.animState = 'interact';
    else if (speed > 0.2) {
      this.animState = this.crouching ? 'crouchwalk' : this.sprinting && speed > MOVE.WALK + 0.3 ? 'run' : 'walk';
    } else this.animState = 'idle';

    // ---- apply to the character model ----
    if (this.character) {
      this.character.group.position.copy(this.pos);
      this.character.group.rotation.y = this.bodyYaw;
    }
  }

  /** Position the camera behind the shoulder, pulling in when it hits a wall. */
  updateCamera(camera, dt, opts = {}) {
    const firstPerson = opts.firstPerson;
    const headY = this.pos.y + (this.crouching ? CAM.height * 0.68 : CAM.height);

    if (firstPerson) {
      camera.position.set(this.pos.x, headY + 0.06, this.pos.z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(this.yaw);
      camera.rotateX(this.pitch);
      return;
    }

    const wantDist = (this.crouching ? CAM.crouchDistance : CAM.distance) * (opts.distanceMult || 1);
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const shoulderX = cosY * CAM.shoulder;
    const shoulderZ = -sinY * CAM.shoulder;

    const targetX = this.pos.x + shoulderX;
    const targetZ = this.pos.z + shoulderZ;
    this._camTarget.set(targetX, headY, targetZ);

    // ray from head backwards along the look direction
    const dirX = sinY * Math.cos(this.pitch);
    const dirZ = cosY * Math.cos(this.pitch);
    const dirY = -Math.sin(this.pitch);

    let dist = wantDist;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * wantDist;
      const px = targetX + dirX * t;
      const pz = targetZ + dirZ * t;
      if (isSolid(this.map, this.floor, worldToGridX(px), worldToGridZ(pz))) {
        dist = Math.max(0.55, (i - 1) / steps * wantDist - CAM.collideRadius);
        break;
      }
    }
    // ease outward, snap inward — never let a wall clip the view
    this.camDist += (dist - this.camDist) * Math.min(1, dt * (dist < this.camDist ? 30 : 6));

    let cx = targetX + dirX * this.camDist;
    let cy = headY + dirY * this.camDist;
    let cz = targetZ + dirZ * this.camDist;

    if (this.shake > 0.001) {
      const s = this.shake;
      cx += (Math.random() - 0.5) * s * 0.32;
      cy += (Math.random() - 0.5) * s * 0.32;
      cz += (Math.random() - 0.5) * s * 0.32;
      this.shake = Math.max(0, this.shake - dt * 2.4);
    }

    camera.position.set(cx, cy, cz);
    camera.lookAt(this._camTarget);
  }

  addShake(v) {
    this.shake = Math.min(1.2, this.shake + v);
  }

  /** Teleport (server correction, gateway, execution). */
  warp(x, y, z, floor) {
    this.pos.set(x, y, z);
    this.floor = floor;
    this.vel.set(0, 0, 0);
    this.camDist = 0.6;
  }
}

export { CAM };
