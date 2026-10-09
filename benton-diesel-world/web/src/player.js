// The guest you play: an animated person, walking and running physics with
// collisions against the park, and an orbit camera that keeps out of walls.
import * as THREE from 'three';
import { P, buildModel } from './geom.js';
import { Figure } from './people/figure.js';

const GRAVITY = 110;
const JUMP_SPEED = 25;
const WALK_FRACTION = 0.45; // walking pace as a share of running speed
const STEP = 1.8;
const RADIUS = 1.1;
const HEIGHT = 5;
const CELL = 16;

// ------------------------------------------------------------- collisions
export class Collision {
  constructor(staticParts, terrain) {
    this.cells = new Map();
    this.terrain = terrain;
    let id = 0;
    for (const p of staticParts) {
      if (p[P.COLLIDE] !== 1) continue;
      const sx = p[P.SX], sy = p[P.SY], sz = p[P.SZ];
      if (Math.max(sx, sy, sz) < 0.7) continue;
      // rotation columns = local axes
      const ax = [p[7], p[10], p[13]], ay = [p[8], p[11], p[14]], az = [p[9], p[12], p[15]];
      // which local axis points up?
      let upAxis = -1;
      if (Math.abs(ay[1]) > 0.97) upAxis = 1;
      else if (Math.abs(ax[1]) > 0.97) upAxis = 0;
      else if (Math.abs(az[1]) > 0.97) upAxis = 2;
      if (upAxis < 0) continue; // tilted parts (track pieces) are skipped
      const halves = [sx / 2, sy / 2, sz / 2];
      const half = { up: halves[upAxis] };
      const horiz = [0, 1, 2].filter((a) => a !== upAxis);
      const axes = [ax, ay, az];
      const c = {
        id: id++,
        x: p[P.X], y: p[P.Y], z: p[P.Z],
        top: p[P.Y] + half.up,
        bottom: p[P.Y] - half.up,
        // 2D footprint axes (x/z components) and half sizes
        u: [axes[horiz[0]][0], axes[horiz[0]][2]],
        v: [axes[horiz[1]][0], axes[horiz[1]][2]],
        hu: halves[horiz[0]],
        hv: halves[horiz[1]],
      };
      if (c.bottom > 16) continue;
      const ext = Math.abs(c.u[0]) * c.hu + Math.abs(c.v[0]) * c.hv;
      const ezx = Math.abs(c.u[1]) * c.hu + Math.abs(c.v[1]) * c.hv;
      const x0 = Math.floor((c.x - ext) / CELL), x1 = Math.floor((c.x + ext) / CELL);
      const z0 = Math.floor((c.z - ezx) / CELL), z1 = Math.floor((c.z + ezx) / CELL);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = gx * 100000 + gz;
          let list = this.cells.get(key);
          if (!list) this.cells.set(key, (list = []));
          list.push(c);
        }
      }
    }
  }

  near(x, z) {
    const out = new Set();
    const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = this.cells.get((gx + i) * 100000 + gz + j);
        if (list) for (const c of list) out.add(c);
      }
    }
    return out;
  }

  // local footprint coords of a point
  static local(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    return [dx * c.u[0] + dz * c.u[1], dx * c.v[0] + dz * c.v[1]];
  }

  // Is a point inside a wall-sized box? (for keeping the camera out of
  // buildings; small props like lamps, benches and fences are ignored)
  blocked(x, y, z) {
    const list = this.cells.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL));
    if (!list) return false;
    for (const c of list) {
      if (y < c.bottom || y > c.top || c.top - c.bottom < 3 || c.hu + c.hv < 2.5) continue;
      const [lu, lv] = Collision.local(c, x, z);
      if (Math.abs(lu) <= c.hu + 0.3 && Math.abs(lv) <= c.hv + 0.3) return true;
    }
    return false;
  }

  groundHeight(x, z) {
    return this.terrain ? this.terrain.heightAt(x, z) : 0;
  }

  // Resolve one step for a cylinder at (pos) with feet at pos.y
  resolve(pos, vel, dt) {
    let ground = this.groundHeight(pos.x, pos.z);
    const list = this.near(pos.x, pos.z);
    for (const c of list) {
      const [lu, lv] = Collision.local(c, pos.x, pos.z);
      const inside = Math.abs(lu) <= c.hu + 0.2 && Math.abs(lv) <= c.hv + 0.2;
      if (inside && c.top <= pos.y + STEP && c.top > ground) ground = c.top;
    }
    // walls
    for (const c of list) {
      if (c.top <= Math.max(pos.y, ground) + STEP || c.bottom >= pos.y + HEIGHT) continue;
      const [lu, lv] = Collision.local(c, pos.x, pos.z);
      const cu = Math.max(-c.hu, Math.min(c.hu, lu));
      const cv = Math.max(-c.hv, Math.min(c.hv, lv));
      let du = lu - cu, dv = lv - cv;
      let dist = Math.hypot(du, dv);
      if (dist >= RADIUS) continue;
      if (dist < 1e-4) {
        // center inside the box: push out along the shallowest side
        const pu = c.hu - Math.abs(lu), pv = c.hv - Math.abs(lv);
        if (pu < pv) { du = Math.sign(lu) || 1; dv = 0; dist = 0; } else { dv = Math.sign(lv) || 1; du = 0; dist = 0; }
        const push = (pu < pv ? pu : pv) + RADIUS;
        const wx = (du * c.u[0] + dv * c.v[0]) * push;
        const wz = (du * c.u[1] + dv * c.v[1]) * push;
        pos.x += wx; pos.z += wz;
        continue;
      }
      const push = RADIUS - dist;
      const nu = du / dist, nv = dv / dist;
      const wx = nu * c.u[0] + nv * c.v[0];
      const wz = nu * c.u[1] + nv * c.v[1];
      pos.x += wx * push;
      pos.z += wz * push;
      const vn = vel.x * wx + vel.z * wz;
      if (vn < 0) { vel.x -= vn * wx; vel.z -= vn * wz; }
    }
    return ground;
  }
}

// ------------------------------------------------------------------ avatar
const SKIN_TONES = [0xf3d2bd, 0xe8b996, 0xd29e78, 0xb07a55, 0x8a5a3c, 0x62402b];

// the saved look (colors and styles) as a full outfit for the body
export function playerOutfit(look) {
  const skin = look.skin < SKIN_TONES.length ? SKIN_TONES[look.skin] : look.skin;
  return {
    skin, shirt: look.shirt, pants: look.pants, hair: look.hair ?? 0x2e2018, shoes: look.shoes ?? 0xf5f5f2, hat: 0x1f2a38,
    sleeves: 0, longPants: look.shorts ? 0 : 1, hairStyle: look.hairStyle ?? 0, hatOn: 0, fem: look.build ?? 0, height: 1, width: 1,
  };
}

export class Player {
  constructor(scene, data, collision, look) {
    this.scene = scene;
    this.data = data;
    this.collision = collision;
    this.pos = new THREE.Vector3(...data.config.Spawn);
    this.pos.y = 0.5;
    this.vel = new THREE.Vector3();
    this.yaw = 0; // facing north (-Z)
    this.onGround = true;
    this.speed = 18;
    this.jumpBoost = 0;
    this.autopilot = null; // { x, z, final } point to walk to while in a queue line
    this.faceDir = null; // { fx, fz } direction to face when standing in line
    this.riding = null; // { cf: Matrix4 } while on a ride
    this.figure = new Figure(playerOutfit(look));
    this.holder = new THREE.Group();
    this.holder.add(this.figure.root);
    scene.add(this.holder);
    this.wear = { hat: null, face: null, balloon: null, held: null };
    this.balloon = null;
    // camera
    this.camYaw = 0;
    this.camPitch = -0.22;
    this.camDist = 16;
    this.camEff = 16; // distance after pulling in front of walls
    this.camTarget = new THREE.Vector3();
  }

  setLook(look) {
    this.figure.setLook(playerOutfit(look));
  }

  // Put an item model on the avatar (hat/face/held), or clear it.
  setWear(slot, item, items) {
    const prev = this.wear[slot];
    if (prev) prev.parent?.remove(prev);
    this.wear[slot] = null;
    if (!item) return;
    const def = items.find((i) => i.id === item);
    if (!def || !def.wear) return;
    const model = buildModel(def.wear, this.data.materials, { detail: true });
    model.userData.item = item;
    model.userData.items = items;
    // souvenirs were made for a bigger, rounder head: scale them to fit
    if (slot === 'hat' || slot === 'face') {
      model.scale.setScalar(0.6);
      this.figure.headTop.add(model);
    } else if (slot === 'held') {
      model.rotation.set(-Math.PI / 2, 0, 0);
      model.scale.setScalar(0.75);
      this.figure.handR.add(model);
    }
    this.wear[slot] = model;
  }

  setBalloon(item, items) {
    if (this.balloon) {
      this.scene.remove(this.balloon.model);
      this.scene.remove(this.balloon.line);
      this.balloon = null;
    }
    if (!item) return;
    const def = items.find((i) => i.id === item);
    if (!def || !def.wear) return;
    const model = buildModel(def.wear, this.data.materials, { detail: true });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.scene.add(model);
    this.scene.add(line);
    this.balloon = { model, line, pos: this.pos.clone().add(new THREE.Vector3(-2, 9, 1)), vel: new THREE.Vector3() };
  }

  // camera-relative movement + physics
  update(dt, input, camera) {
    // camera controls
    this.camYaw -= input.look.dx * 0.006;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch - input.look.dy * 0.005, -1.35, 0.6);
    this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + input.zoom * 0.12), 0.5, 90);

    if (this.riding) {
      this.updateRiding(dt);
    } else {
      const mv = input.move();
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const wish = fwd.multiplyScalar(mv.y).add(right.multiplyScalar(mv.x));
      if (wish.lengthSq() > 1) wish.normalize();
      // walk by default, run with Shift (or the stick pushed all the way)
      this.running = input.wantsRun();
      let speed = this.running ? this.speed : this.speed * WALK_FRACTION;
      // in a queue line: with no input, walk the switchbacks to our spot
      const ap = this.autopilot;
      if (wish.lengthSq() < 0.001 && ap) {
        const dx = ap.x - this.pos.x, dz = ap.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.2) {
          wish.set(dx / dist, 0, dz / dist);
          speed = this.speed * WALK_FRACTION * (ap.final ? Math.min(1, 0.25 + dist / 1.5) : 1);
        }
      }
      const moving = wish.lengthSq() > 0.001;
      const target = wish.multiplyScalar(speed);
      const accel = this.onGround ? (moving ? 8 : 11) : 2.5;
      this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);
      const face = moving ? wish : this.faceDir ? new THREE.Vector3(this.faceDir.fx, 0, this.faceDir.fz) : null;
      if (face) {
        const desired = Math.atan2(-face.x, -face.z);
        let d = desired - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, (moving ? 9 : 4) * dt);
      }
      if (this.onGround && input.wantsJump()) {
        this.vel.y = JUMP_SPEED + this.jumpBoost * 0.6;
        this.onGround = false;
      }
      this.vel.y -= GRAVITY * dt;
      // sub-step for fast movement
      const steps = Math.max(1, Math.ceil(this.vel.length() * dt / 0.8));
      for (let i = 0; i < steps; i++) {
        this.pos.x += this.vel.x * dt / steps;
        this.pos.z += this.vel.z * dt / steps;
        this.pos.y += this.vel.y * dt / steps;
        const ground = this.collision.resolve(this.pos, this.vel, dt / steps);
        if (this.pos.y <= ground) {
          this.pos.y = ground;
          if (this.vel.y < 0) this.vel.y = 0;
          this.onGround = true;
        } else if (this.pos.y > ground + 0.3) {
          this.onGround = false;
        }
      }
      // keep inside the world
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -560, 560);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -600, 520);
      this.holder.position.copy(this.pos);
      this.holder.rotation.set(0, this.yaw, 0);
      this.figure.update(dt, { speed: Math.hypot(this.vel.x, this.vel.z), onGround: this.onGround, vy: this.vel.y, holding: !!this.wear.held });
    }
    this.updateBalloon(dt);
    this.updateCamera(camera, dt);
  }

  // jump the camera straight to the player (after teleports and rides)
  snapCamera() {
    this.camTarget.set(this.pos.x, this.pos.y + 5.4, this.pos.z);
  }

  updateRiding() {
    // holder follows the ride seat; the seated pose puts the hips on it
    this.holder.matrixAutoUpdate = false;
    this.holder.matrix.copy(this.riding.matrix);
    this.holder.matrixWorldNeedsUpdate = true;
    this.holder.updateMatrixWorld(true);
    this.pos.setFromMatrixPosition(this.riding.matrix);
    this.figure.update(0, { sitting: true });
  }

  stopRiding(exit) {
    this.riding = null;
    this.holder.matrixAutoUpdate = true;
    if (exit) {
      this.pos.copy(exit.pos);
      this.yaw = exit.yaw;
      this.vel.set(0, 0, 0);
    }
    this.holder.position.copy(this.pos);
    this.holder.rotation.set(0, this.yaw, 0);
  }

  updateBalloon(dt) {
    const b = this.balloon;
    if (!b) return;
    const hand = new THREE.Vector3();
    this.figure.handL.getWorldPosition(hand);
    const target = hand.clone().add(new THREE.Vector3(0, 7.5, 0));
    const toTarget = target.sub(b.pos);
    b.vel.addScaledVector(toTarget, dt * 9);
    b.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
    b.pos.addScaledVector(b.vel, dt);
    // keep the string length
    const d = b.pos.clone().sub(hand);
    if (d.length() > 8.5) b.pos.copy(hand).addScaledVector(d.normalize(), 8.5);
    b.model.position.copy(b.pos);
    b.model.rotation.y += dt * 0.4;
    const attr = b.line.geometry.getAttribute('position');
    attr.setXYZ(0, hand.x, hand.y, hand.z);
    attr.setXYZ(1, b.pos.x, b.pos.y - 1.4, b.pos.z);
    attr.needsUpdate = true;
  }

  headPosition(out = new THREE.Vector3()) {
    this.figure.headTop.getWorldPosition(out);
    return out.add(new THREE.Vector3(0, -0.3, 0));
  }

  updateCamera(camera, dt = 1 / 60) {
    const head = this.headPosition(new THREE.Vector3());
    this.camTarget.lerp(head, this.riding ? 1 : 1 - Math.pow(0.6, dt * 60));
    if (this.riding) this.camTarget.copy(head);
    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      -Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    );
    // pull the camera in front of walls between it and the player
    let dist = this.camDist;
    if (dist >= 2.5) {
      const t = this.camTarget;
      for (let d = 1.5; d < dist; d += 0.75) {
        if (this.collision.blocked(t.x + dir.x * d, t.y + dir.y * d, t.z + dir.z * d)) {
          dist = Math.max(1.2, d - 0.8);
          break;
        }
      }
    }
    this.camEff = dist < this.camEff ? dist : this.camEff + (dist - this.camEff) * (1 - Math.pow(0.85, dt * 60));
    const firstPerson = this.camEff < 2.5;
    this.figure.root.visible = !firstPerson;
    if (firstPerson) {
      camera.position.copy(this.camTarget);
      camera.lookAt(this.camTarget.clone().sub(dir));
    } else {
      camera.position.copy(this.camTarget).addScaledVector(dir, this.camEff);
      if (camera.position.y < 0.6) camera.position.y = 0.6;
      camera.lookAt(this.camTarget);
    }
  }
}
