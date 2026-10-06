/**
 * Third-person camera: orbit around the player with wall/ceiling collision,
 * an over-the-shoulder aim mode, and a chase camera for vehicles that
 * re-centres behind the direction of travel when the mouse is idle.
 * Mode changes blend the pivot and distance so vehicle entry doesn't jump.
 */
import * as THREE from 'three';

const tmp = new THREE.Vector3();

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.cam = game.engine.camera;
    this.yaw = Math.PI; // camera looks along (sin yaw, cos yaw)
    this.pitch = -0.12;
    this.dist = 3.8;
    this.curDist = 3.8;
    this.pivot = new THREE.Vector3();
    this.smoothPivot = new THREE.Vector3();
    this.idleLook = 0;
    this.shake = 0;
    this.fovKick = 0;
    this.mode = 'foot';
    this.blend = 1;
    this.lookBehind = false;
    this.override = null; // {pos, target} for scripted shots
    this.initialized = false;
  }

  /** Forward vector on the ground plane. */
  get flatForward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a * this.game.settings.i.cameraShake); }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const input = g.input;
    const s = g.settings.c;
    const look = input.takeLook(dt);
    const aiming = !!p.controller?.aiming;
    const sens = 0.0024 * s.sensitivity * (aiming ? s.aimSensitivity : 1);
    if (!g.paused && !this.override) {
      this.yaw -= look.x * sens;
      this.pitch -= look.y * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.25, 0.95);
    }
    if (Math.abs(look.x) + Math.abs(look.y) > 0.5) this.idleLook = 0; else this.idleLook += dt;

    const veh = p.vehicle;
    const mode = veh ? 'vehicle' : aiming ? 'aim' : 'foot';
    if (mode !== this.mode) {
      if ((mode === 'vehicle') !== (this.mode === 'vehicle')) this.blend = 0;
      this.mode = mode;
    }
    this.blend = Math.min(1, this.blend + dt * 2.2);

    let desiredDist, shoulder, height, fovAdd = 0;
    const pivot = tmp;
    if (veh) {
      const d = veh.def;
      pivot.set(veh.pos.x, veh.pos.y + d.height * 0.8 + 0.45, veh.pos.z);
      const sp = veh.speed;
      desiredDist = d.length * 1.15 + 2.6 + Math.min(2.2, sp * 0.05);
      shoulder = 0; height = 0;
      fovAdd = Math.min(12, Math.max(0, sp - 15) * 0.35);
      if (aiming) { desiredDist = d.length * 0.55 + 1.6; shoulder = 0.7; height = 0.25; fovAdd = -10; }
      // auto-centre behind the car when the player isn't steering the camera
      if (this.idleLook > 1.0 && sp > 3 && !g.paused && !aiming) {
        const vl = veh.vLong;
        const head = vl >= -0.5 ? veh.yaw : veh.yaw + Math.PI;
        let dy = head - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * (1 - Math.exp(-2.2 * dt));
        this.pitch += (-0.2 - this.pitch) * (1 - Math.exp(-1.5 * dt));
      }
    } else {
      const crouch = p.crouch ? -0.45 : 0;
      pivot.set(p.pos.x, p.pos.y + (p.swim ? 0.6 : 1.55) + crouch, p.pos.z);
      if (p.dead) pivot.y = p.pos.y + 0.6;
      desiredDist = aiming ? 1.75 : 3.6;
      shoulder = aiming ? 0.62 : 0.42;
      height = aiming ? 0.08 : 0.15;
      if (aiming) fovAdd = -14;
    }
    if (!this.initialized) { this.smoothPivot.copy(pivot); this.curDist = desiredDist; this.initialized = true; }
    // blend pivot: fast normally, slower right after entering/exiting a vehicle
    const pk = this.blend < 1 ? 6 : veh ? 30 : 25;
    this.smoothPivot.lerp(pivot, 1 - Math.exp(-pk * dt));

    const yaw = this.yaw + (this.lookBehind && veh ? Math.PI : 0);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(yaw) * cp, fy = sp, fz = Math.cos(yaw) * cp;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);

    const piv = this.smoothPivot;
    // shoulder offset (checked for walls too)
    let sx = piv.x + rx * shoulder, sy = piv.y + height, sz = piv.z + rz * shoulder;
    const coll = g.world.collision;
    const filt = (c) => c.cameraBlock;
    const sideHit = shoulder > 0 ? coll.raycast(piv.x, piv.y, piv.z, sx - piv.x, 0, sz - piv.z, 1, filt) : null;
    if (sideHit) { const t = Math.max(0, sideHit.t - 0.25 / shoulder); sx = piv.x + (sx - piv.x) * t; sz = piv.z + (sz - piv.z) * t; }

    // pull in on collision; extend back out more slowly
    const hit = coll.raycast(sx, sy, sz, -fx, -fy, -fz, desiredDist + 0.3, filt);
    let allowed = hit ? Math.max(0.4, hit.t - 0.3) : desiredDist;
    // never go below the ground or above an interior ceiling
    const interior = g.world.interiorAt(piv.x, piv.z, piv.y);
    if (this.curDist > allowed) this.curDist = allowed;
    else this.curDist += (Math.min(allowed, desiredDist) - this.curDist) * (1 - Math.exp(-4 * dt));
    let cx = sx - fx * this.curDist, cy = sy - fy * this.curDist, cz = sz - fz * this.curDist;
    const gy = g.world.ground(cx, cz, cy + 1) + 0.25;
    if (cy < gy && !p.swim) cy = gy;
    if (p.swim) cy = Math.max(cy, g.world.waterY + 0.25);
    if (interior) cy = Math.min(cy, interior.ceiling - 0.3);

    // shake
    if (this.shake > 0) {
      const a = this.shake * 0.08;
      cx += (Math.random() - 0.5) * a; cy += (Math.random() - 0.5) * a; cz += (Math.random() - 0.5) * a;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    if (this.override) {
      this.cam.position.copy(this.override.pos);
      this.cam.lookAt(this.override.target);
    } else {
      this.cam.position.set(cx, cy, cz);
      this.cam.lookAt(sx + fx * 10, sy + fy * 10, sz + fz * 10);
      // a few drinks in: the world sways a little
      const tipsy = g.club?.tipsy || 0;
      if (tipsy > 0.02) {
        const t = g.time;
        this.cam.rotateZ(Math.sin(t * 0.7) * 0.06 * tipsy);
        this.cam.rotateY(Math.sin(t * 0.43) * 0.035 * tipsy);
        this.cam.rotateX(Math.sin(t * 0.9 + 1) * 0.02 * tipsy);
      }
    }
    const fov = g.settings.g.fov + fovAdd + this.fovKick;
    this.fovKick *= Math.exp(-6 * dt);
    if (Math.abs(this.cam.fov - fov) > 0.05) {
      this.cam.fov += (fov - this.cam.fov) * (1 - Math.exp(-8 * dt));
      this.cam.updateProjectionMatrix();
    }
  }

  /** Point the camera behind a yaw immediately (spawn, respawn). */
  snapBehind(yaw) {
    this.yaw = yaw;
    this.pitch = -0.15;
    this.initialized = false;
  }

  /** World-space ray through the screen centre. */
  centerRay() {
    const dir = new THREE.Vector3();
    this.cam.getWorldDirection(dir);
    return { origin: this.cam.position.clone(), dir };
  }
}
