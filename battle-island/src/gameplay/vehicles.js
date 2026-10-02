/**
 * Drivable vehicles: Diesel Trucks (driver + 3 passengers) and Pickle Karts
 * (one seat, boost). Arcade handling over the real terrain and colliders:
 * they climb build ramps, bump off walls (smashing weak ones), burn fuel,
 * refuel at pumps, take damage from anything and blow up at 0 HP. Running
 * into opponents hurts them. Passengers can shoot; the driver can't.
 *
 * Solo / host simulates every vehicle except ones a remote player drives:
 * those are simulated on the driver's device (like their own movement) and
 * reported back, so driving always feels responsive.
 */

import * as THREE from 'three';
import { Collider, GRAVITY, WATER_Y } from '../world/physics.js';
import { boxGeo, mat } from '../world/island.js';
import { sfx } from '../core/audio.js';

export const VEHICLES = {
  truck: {
    name: 'Diesel Truck', seats: 4, hp: 900, max: 25, rev: 8, accel: 10, turn: 1.45, burn: 0.55, boost: 1,
    len: 5.6, wid: 2.4, segs: [[1.9, 2.9], [0, 1.8], [-1.9, 1.8]], half: 1.2,
    seatPos: [[-0.5, 1.15, 1.5], [0.55, 1.15, 1.5], [-0.6, 1.8, -1.4], [0.6, 1.8, -1.4]],
  },
  kart: {
    name: 'Pickle Kart', seats: 1, hp: 350, max: 22, rev: 6, accel: 14, turn: 2.3, burn: 0.8, boost: 1.4,
    len: 2.4, wid: 1.5, segs: [[0, 1.0]], half: 0.95,
    seatPos: [[0, 0.3, -0.1]],
  },
};
const TRUCK_COLORS = ['#ffcf3f', '#e8453c', '#3f7bff', '#ff8a3d'];
const KART_COLORS = ['#7ed957', '#ff5ca8', '#39f0ff', '#ffae1a'];
const STEP = 0.85; // what wheels roll up onto (colliders must be taller than this to block)
const REFUEL_R = 5.5;
const _f = new THREE.Vector3();

export const fwdOf = (yaw, out = _f) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.destroyed = [];
    const spots = game.world.vehicleSpots;
    spots.forEach((s, i) => this.list.push(this._make(i, s, spots.filter((o, j) => j < i && o.type === s.type).length)));
  }

  _make(id, s, n) {
    const def = VEHICLES[s.type];
    const world = this.game.world;
    const color = (s.type === 'truck' ? TRUCK_COLORS : KART_COLORS)[n % 4];
    const mesh = s.type === 'truck' ? truckMesh(color) : kartMesh(color);
    mesh.rotation.order = 'YXZ';
    this.game.scene.add(mesh);
    const v = {
      id, type: s.type, def, color, mesh, alive: true,
      pos: new THREE.Vector3(s.x, world.physics.groundAt(s.x, s.z, 50, 0.4, 0).y, s.z),
      yaw: s.yaw, speed: 0, vy: 0, pitch: 0, hp: def.hp, fuel: 100,
      seats: new Array(def.seats).fill(null), cols: [], dirty: false, lastHit: null, net: null, wheelT: 0,
    };
    for (const [, h] of def.segs) {
      const c = new Collider({ kind: 'vehicle', hp: 1, material: 'metal', harvest: 0, minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: h });
      c.wid = -1; // not part of the fixed island
      c.vehicle = v;
      c.segH = h;
      v.cols.push(c);
    }
    this._sync(v, true);
    return v;
  }

  /** Moves the colliders and mesh to the vehicle's pose. */
  _sync(v, force = false) {
    const phys = this.game.world.physics;
    const f = fwdOf(v.yaw);
    v.def.segs.forEach(([off], i) => {
      const c = v.cols[i];
      const cx = v.pos.x + f.x * off, cz = v.pos.z + f.z * off, h = v.def.half;
      if (!force && Math.abs(c.minX - (cx - h)) < 0.005 && Math.abs(c.minZ - (cz - h)) < 0.005 && Math.abs(c.minY - v.pos.y) < 0.005) return;
      if (c._cells.length) phys.remove(c);
      Object.assign(c, { minX: cx - h, maxX: cx + h, minZ: cz - h, maxZ: cz + h, minY: v.pos.y, maxY: v.pos.y + c.segH });
      phys.add(c);
      c.alive = true;
    });
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    v.mesh.rotation.x = v.pitch;
  }

  seatWorld(v, i, out = new THREE.Vector3()) {
    const [r, u, fw] = v.def.seatPos[i];
    const f = fwdOf(v.yaw);
    return out.set(v.pos.x + f.x * fw - f.z * r, v.pos.y + u + Math.sin(v.pitch) * fw, v.pos.z + f.z * fw + f.x * r);
  }

  driver(v) {
    return v.seats[0];
  }

  /** Nearest usable vehicle within reach of an actor. */
  nearest(a, reach = 1.6) {
    let best = null, bd = Infinity;
    for (const v of this.list) {
      if (!v.alive) continue;
      const f = fwdOf(v.yaw);
      const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z;
      const along = Math.max(-v.def.len / 2, Math.min(v.def.len / 2, dx * f.x + dz * f.z));
      const d = Math.hypot(dx - f.x * along, dz - f.z * along) - v.def.wid / 2;
      if (d < reach && Math.abs(a.pos.y - v.pos.y) < 3 && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  enter(a, v) {
    if (!v || !v.alive || a.vehicle || a.downed || !a.alive) return false;
    const seat = v.seats.indexOf(null);
    if (seat < 0) return false;
    v.seats[seat] = a;
    a.vehicle = v;
    a.seat = seat;
    a.state = 'drive';
    a.vel.set(0, 0, 0);
    a.crouch = a.emote = a.building = a.ads = false;
    a.cancelActions();
    a.reviveTarget = a.rebootVan = null;
    if (seat === 0) a.sel = a.sel; // keep the held item for when they hop out
    a.ep = (a.ep | 0) + 1; // remote players adopt the seat by epoch
    this.seatWorld(v, seat, a.pos);
    v.dirty = true;
    sfx.play(seat === 0 ? 'engine' : 'ui', v.pos);
    return true;
  }

  exit(a, eject = false) {
    const v = a.vehicle;
    if (!v) return;
    v.seats[a.seat] = null;
    a.vehicle = null;
    a.seat = -1;
    v.dirty = true;
    const f = fwdOf(v.yaw).clone();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const phys = this.game.world.physics;
    const side = v.def.wid / 2 + 0.8;
    let spot = null;
    for (const off of [r.clone().multiplyScalar(-side), r.clone().multiplyScalar(side), f.clone().multiplyScalar(-(v.def.len / 2 + 0.9)), f.clone().multiplyScalar(v.def.len / 2 + 0.9)]) {
      const x = v.pos.x + off.x, z = v.pos.z + off.z;
      const y = phys.groundAt(x, z, v.pos.y + 1.5, 0.38).y;
      if (this._clear(x, y, z) && Math.abs(y - v.pos.y) < 3) {
        spot = new THREE.Vector3(x, y + 0.05, z);
        break;
      }
    }
    if (!spot) spot = new THREE.Vector3(v.pos.x, v.pos.y + 3.2, v.pos.z); // hop out on top
    a.pos.copy(spot);
    a.vel.copy(f).multiplyScalar(v.speed * 0.4);
    a.vel.y = eject ? 7 : 2;
    a.state = a.pos.y < WATER_Y - 1 ? 'swim' : 'air';
    a.grounded = false;
    a.ep = (a.ep | 0) + 1;
  }

  _clear(x, y, z) {
    for (const c of this.game.world.physics.query(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) {
      if (c.type === 'box' && c.maxY > y + 0.3 && c.minY < y + 1.85) return false;
    }
    return true;
  }

  damage(v, amount, src) {
    if (!v.alive || amount <= 0 || this.game.role === 'client') return;
    v.hp -= amount;
    v.lastHit = src || v.lastHit;
    v.dirty = true;
    if (src === this.game.player) this.game.hud.hitmarker(false, true);
    if (v.hp <= 0) this.destroy(v);
  }

  destroy(v) {
    if (!v.alive) return;
    v.alive = false;
    v.hp = 0;
    this.destroyed.push(v.id);
    for (const a of [...v.seats]) if (a) this.exit(a, true);
    this._remove(v);
    const at = v.pos.clone().add(new THREE.Vector3(0, 1, 0));
    if (this.game.role !== 'client') this.game.combat.explode(at, 5.5, 70, 220, v.lastHit);
  }

  _remove(v) {
    for (const c of v.cols) if (c._cells.length) this.game.world.physics.remove(c);
    this.game.scene.remove(v.mesh);
  }

  /** Arcade handling for one step. ctl: { thr -1..1, steer -1..1, boost } or null (coasting). */
  drive(v, dt, ctl) {
    const d = v.def;
    let thr = ctl ? ctl.thr : 0;
    if (v.fuel <= 0) thr = Math.min(0, thr) * 0.3; // out of fuel: only a slow reverse crawl
    const boost = ctl && ctl.boost && thr > 0.1 && v.fuel > 0 ? d.boost : 1;
    const top = d.max * boost;
    if (thr > 0.05) v.speed += (v.speed < -0.5 ? d.accel * 2.2 : d.accel * (boost > 1 ? 1.5 : 1)) * thr * dt;
    else if (thr < -0.05) v.speed += (v.speed > 0.5 ? d.accel * 2.2 : d.accel * 0.7) * thr * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (2.5 + Math.abs(v.speed) * 0.2) * dt);
    if (v.speed > top) v.speed = Math.max(top, v.speed - 9 * dt);
    v.speed = Math.max(-d.rev, v.speed);
    const steer = ctl ? ctl.steer : 0;
    const k = Math.min(1, Math.abs(v.speed) / 5) * (1 - Math.min(0.35, Math.abs(v.speed) / 90));
    v.yaw -= steer * d.turn * k * Math.sign(v.speed || 1) * dt;
    if (ctl) v.fuel = Math.max(0, v.fuel - d.burn * (Math.abs(v.speed) / d.max) * boost * boost * dt);
    this._integrate(v, dt);
  }

  _integrate(v, dt) {
    const phys = this.game.world.physics;
    const d = v.def;
    const f = fwdOf(v.yaw).clone();
    const ox = v.pos.x, oz = v.pos.z, oy = v.pos.y;
    const steps = Math.max(1, Math.ceil((Math.abs(v.speed) * dt) / 0.5));
    for (let s = 0; s < steps; s++) {
      const px = v.pos.x, pz = v.pos.z;
      v.pos.x += (f.x * v.speed * dt) / steps;
      v.pos.z += (f.z * v.speed * dt) / steps;
      const hit = this._blocked(v);
      if (hit) {
        v.pos.x = px;
        v.pos.z = pz;
        this._crash(v, hit);
        break;
      }
    }
    // ground: highest surface under the front and back wheels
    const half = d.len / 2 - 0.4;
    const gf = phys.groundAt(v.pos.x + f.x * half, v.pos.z + f.z * half, v.pos.y, 0.5, STEP).y;
    const gb = phys.groundAt(v.pos.x - f.x * half, v.pos.z - f.z * half, v.pos.y, 0.5, STEP).y;
    const gy = Math.max(gf, gb, WATER_Y - 1.2);
    if (v.pos.y > gy + 0.05 || v.vy > 0) {
      v.vy -= GRAVITY * dt;
      v.pos.y += v.vy * dt;
      if (v.pos.y <= gy) {
        if (v.vy < -16) this.damage(v, (-v.vy - 16) * 8, null);
        v.pos.y = gy;
        v.vy = 0;
      }
    } else {
      // leaving a crest at speed: carry some upward speed into a hop
      if (gy < oy - 0.6 && Math.abs(v.speed) > 12) v.vy = Math.min(4, (oy - gy) * 3);
      else v.pos.y = gy;
    }
    const target = Math.atan2(gf - gb, half * 2);
    v.pitch += (Math.max(-0.6, Math.min(0.6, target)) - v.pitch) * Math.min(1, dt * 10);
    // shoreline: trucks and karts don't float
    if (phys.terrainY(v.pos.x, v.pos.z) < WATER_Y - 1.1 && gy <= WATER_Y - 1.1 + 0.01) {
      v.pos.x = ox;
      v.pos.z = oz;
      v.speed = 0;
    }
    const lim = 195;
    v.pos.x = Math.max(-lim, Math.min(lim, v.pos.x));
    v.pos.z = Math.max(-lim, Math.min(lim, v.pos.z));
    v.wheelT += (v.speed * dt) / 0.5;
    this._sync(v);
    if (Math.abs(v.speed) > 0.05 || v.vy) v.dirty = true;
  }

  /** The first solid thing the vehicle's body overlaps (or a too-steep hill). */
  _blocked(v) {
    const phys = this.game.world.physics;
    const d = v.def;
    const f = fwdOf(v.yaw);
    for (const [off, h] of d.segs) {
      const cx = v.pos.x + f.x * off, cz = v.pos.z + f.z * off, r = d.half * 0.92;
      for (const c of phys.query(cx - r, cz - r, cx + r, cz + r)) {
        if (c.vehicle === v || !c.alive || c.type !== 'box') continue;
        if (c.maxY <= v.pos.y + STEP || c.minY >= v.pos.y + h) continue;
        const nx = Math.max(c.minX, Math.min(cx, c.maxX)), nz = Math.max(c.minZ, Math.min(cz, c.maxZ));
        if ((nx - cx) ** 2 + (nz - cz) ** 2 < r * r) return c;
      }
    }
    const nose = d.len / 2;
    const ahead = Math.sign(v.speed || 1) * nose;
    if (phys.terrainY(v.pos.x + f.x * ahead, v.pos.z + f.z * ahead) > v.pos.y + 1.6) return { terrain: true };
    return null;
  }

  _crash(v, hit) {
    const impact = Math.abs(v.speed);
    const g = this.game;
    const drv = v.seats[0];
    if (g.role !== 'client') {
      if (hit.vehicle && impact > 6) this.damage(hit.vehicle, impact * 5, drv);
      else if (hit.kind === 'boss' && impact > 6) g.boss.damage(impact * 6, drv);
      else if (!hit.terrain && hit.hp !== Infinity && impact > 8) g.damageCollider(hit, impact * 9, drv);
      if (impact > 13) this.damage(v, (impact - 13) * 7, null);
    }
    if (impact > 7) {
      sfx.play('crash', v.pos);
      g.effects.shake = Math.min(1, g.effects.shake + impact / 60);
    }
    v.speed = -v.speed * 0.25;
  }

  /** Host/solo per-frame: drive, refuel, run-over hits, and place occupants. */
  update(dt) {
    const g = this.game;
    for (const v of this.list) {
      if (!v.alive) continue;
      const drv = v.seats[0];
      const before = v.pos.clone();
      if (drv && drv.remote) {
        // simulated on the driver's device; the host burns fuel from the reported speed
        v.fuel = Math.max(0, v.fuel - v.def.burn * (Math.abs(v.speed) / v.def.max) * dt);
      } else if (drv && drv === g.player) this.drive(v, dt, g.controller.drive);
      else this.drive(v, dt, drv && drv.brain && !g.admin?.freezeBots ? drv.brain.driveCtl : null);
      if (drv) {
        const moved = Math.hypot(v.pos.x - before.x, v.pos.z - before.z);
        if (moved < 10) drv.stats.driven += moved;
      }
      this._refuel(v, dt);
      if (Math.abs(v.speed) > 7) this._runOver(v);
      if (v.pos.y < WATER_Y - 3) this.destroy(v);
    }
    this.placeOccupants();
  }

  _refuel(v, dt) {
    if (v.fuel >= 100 || Math.abs(v.speed) > 3) return;
    for (const p of this.game.world.pumps) {
      if (Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < REFUEL_R) {
        v.fuel = Math.min(100, v.fuel + 25 * dt);
        v.dirty = true;
        v.refueling = 0.3;
        return;
      }
    }
  }

  _runOver(v) {
    const g = this.game;
    const drv = v.seats[0];
    const f = fwdOf(v.yaw);
    const now = g.time;
    for (const a of g.actors) {
      if (!a.alive || a.vehicle || a.state === 'bus' || (a.hitByVehT || 0) > now) continue;
      if (drv && a.team === drv.team) continue;
      if (a.pos.y > v.pos.y + 2.2 || a.pos.y < v.pos.y - 1.5) continue;
      let hit = false;
      for (const [off] of v.def.segs) {
        const cx = v.pos.x + f.x * off, cz = v.pos.z + f.z * off;
        if (Math.hypot(a.pos.x - cx, a.pos.z - cz) < v.def.half + 0.45) hit = true;
      }
      if (!hit) continue;
      a.hitByVehT = now + 0.8;
      const dmg = Math.round(Math.abs(v.speed) * 3.2);
      if (drv) drv.stats.runovers++;
      g.applyDamage(a, dmg, drv || null, { pos: a.eye, runover: true });
      if (!a.remote && a.alive) {
        a.vel.set(f.x * v.speed * 0.7, 6, f.z * v.speed * 0.7);
        if (a.state === 'ground') a.state = 'air';
        a.grounded = false;
      }
      sfx.play('crash', a.pos);
      v.speed *= 0.8;
    }
  }

  /** Seats the occupants at their seat positions (all machines). */
  placeOccupants() {
    for (const v of this.list) {
      if (!v.alive) continue;
      v.seats.forEach((a, i) => {
        if (!a) return;
        this.seatWorld(v, i, a.pos);
        a.vel.set(0, 0, 0);
        if (i === 0) a.yaw = v.yaw;
        a.grounded = true;
      });
      // wheels spin with speed
      for (const w of v.mesh.userData.wheels || []) w.rotation.x = -v.wheelT;
    }
  }

  /** Occupants who can't stay seated (knocked, eliminated) get out. */
  checkOccupants() {
    for (const v of this.list) {
      for (const a of v.seats) if (a && (!a.alive || a.downed)) this.exit(a, true);
    }
    for (const a of this.game.actors) {
      if (a.state === 'zip' && (a.downed || !a.alive)) {
        a.zip = null;
        a.state = 'air';
      }
    }
  }

  // ------------------------------------------------------------ network
  /** Host snapshot rows: vehicles that ever moved or changed, destroyed ids and seats. */
  rows() {
    const r10 = (x) => Math.round(x * 10);
    const v = this.list.filter((x) => x.alive && x.dirty).map((x) => [x.id, r10(x.pos.x), r10(x.pos.y), r10(x.pos.z), Math.round(x.yaw * 100), r10(x.speed), Math.ceil(x.hp), Math.round(x.fuel), Math.round(x.pitch * 100)]);
    const vs = [];
    for (const x of this.list) x.seats.forEach((a, i) => a && vs.push([a.id, x.id, i]));
    return { v, vd: this.destroyed, vs };
  }

  /** Client: mirror the host's vehicles. The vehicle this player drives stays client-simulated. */
  applyRows(data, me) {
    const now = performance.now();
    for (const id of data.vd || []) {
      const v = this.list[id];
      if (v && v.alive) {
        v.alive = false;
        for (let i = 0; i < v.seats.length; i++) v.seats[i] = null;
        this._remove(v);
      }
    }
    for (const r of data.v || []) {
      const v = this.list[r[0]];
      if (!v || !v.alive) continue;
      v.hp = r[6];
      v.fuel = r[7];
      if (v.seats[0] === me) continue;
      v.net = { x: r[1] / 10, y: r[2] / 10, z: r[3] / 10, yaw: r[4] / 100, sp: r[5] / 10, pitch: r[8] / 100, at: now };
    }
    // seats
    const seated = new Map((data.vs || []).map((s) => [s[0], s]));
    for (const v of this.list) for (let i = 0; i < v.seats.length; i++) v.seats[i] = null;
    for (const a of this.game.actors) {
      const s = seated.get(a.id);
      const v = s && this.list[s[1]];
      if (v && v.alive && a.alive) {
        v.seats[s[2]] = a;
        a.vehicle = v;
        a.seat = s[2];
        if (a === me) a.state = 'drive';
      } else {
        a.vehicle = null;
        a.seat = -1;
      }
    }
  }

  /** Client per-frame: drive our own vehicle, ease the rest toward the host's view. */
  clientUpdate(dt) {
    const g = this.game;
    const me = g.player;
    const now = performance.now();
    for (const v of this.list) {
      if (!v.alive) continue;
      if (v.seats[0] === me) {
        this.drive(v, dt, g.controller.drive);
        this._refuel(v, dt);
        continue;
      }
      const n = v.net;
      if (!n) continue;
      const age = Math.min(0.25, (now - n.at) / 1000);
      const tx = n.x - Math.sin(n.yaw) * n.sp * age, tz = n.z - Math.cos(n.yaw) * n.sp * age;
      const k = Math.min(1, dt * 12);
      if (Math.hypot(tx - v.pos.x, tz - v.pos.z) > 10) v.pos.set(tx, n.y, tz);
      else {
        v.pos.x += (tx - v.pos.x) * k;
        v.pos.z += (tz - v.pos.z) * k;
        v.pos.y += (n.y - v.pos.y) * k;
      }
      let dy = n.yaw - v.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      v.yaw += dy * k;
      v.pitch += (n.pitch - v.pitch) * k;
      v.speed = n.sp;
      v.wheelT += (v.speed * dt) / 0.5;
      this._sync(v);
    }
  }

  /** Host: a remote driver's reported pose for their vehicle. */
  applyDriver(a, mv) {
    const v = a.vehicle;
    if (!v || !v.alive || a.seat !== 0 || mv[0] !== v.id) return;
    const x = mv[1] / 10, y = mv[2] / 10, z = mv[3] / 10;
    if (Math.hypot(x - v.pos.x, z - v.pos.z) > 40) return;
    const moved = Math.hypot(x - v.pos.x, z - v.pos.z);
    if (moved < 10) a.stats.driven += moved;
    // the driver's device handles collisions; a sudden stop at speed is a crash the host charges for
    const before = Math.abs(v.speed), after = Math.abs(mv[5] / 10);
    if (before > 13 && after < before * 0.4) this.damage(v, (before - 13) * 7, null);
    v.pos.set(x, y, z);
    v.yaw = mv[4] / 100;
    v.speed = mv[5] / 10;
    v.pitch = mv[6] / 100;
    v.dirty = true;
    this._sync(v);
  }

  /** Client: our vehicle's pose for the host. */
  driverRow(me) {
    const v = me.vehicle;
    if (!v || me.seat !== 0 || !v.alive) return null;
    return [v.id, Math.round(v.pos.x * 10), Math.round(v.pos.y * 10), Math.round(v.pos.z * 10), Math.round(v.yaw * 100), Math.round(v.speed * 10), Math.round(v.pitch * 100)];
  }

  clear() {
    for (const v of this.list) this._remove(v);
    this.list = [];
  }
}

// ------------------------------------------------------------------ models
function wheel(g, x, y, z, r, w) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), mat('#222222'));
  m.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.02, 8), mat('#cccccc'));
  hub.rotation.z = Math.PI / 2;
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.add(m, hub);
  g.add(holder);
  g.userData.wheels.push(holder);
}

function truckMesh(color) {
  const g = new THREE.Group();
  g.userData.wheels = [];
  const body = new THREE.Mesh(boxGeo(2.4, 1.3, 5.6), mat(color, 'metal'));
  body.position.y = 1.15;
  const bed = new THREE.Mesh(boxGeo(2.2, 0.1, 3.2), mat('#5a5a62', 'metal'));
  bed.position.set(0, 1.81, 1.1);
  const cab = new THREE.Mesh(boxGeo(2.3, 1.2, 2.0), mat(color, 'metal'));
  cab.position.set(0, 2.3, -1.6);
  const glass = new THREE.Mesh(boxGeo(2.2, 0.7, 0.05), mat('#9fe3ff', null, { emissive: '#1b4a5a' }));
  glass.position.set(0, 2.45, -2.62);
  const grille = new THREE.Mesh(boxGeo(2.0, 0.5, 0.06), mat('#dddddd', 'metal'));
  grille.position.set(0, 1.1, -2.82);
  for (const x of [-0.8, 0.8]) {
    const lamp = new THREE.Mesh(boxGeo(0.4, 0.25, 0.06), new THREE.MeshBasicMaterial({ color: '#fff6c8' }));
    lamp.position.set(x, 1.45, -2.83);
    g.add(lamp);
  }
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), mat('#aaaaaa', 'metal'));
  stack.position.set(1.05, 2.9, -0.7);
  g.add(body, bed, cab, glass, grille, stack);
  for (const [x, z] of [[-1.25, -1.8], [1.25, -1.8], [-1.25, 1.8], [1.25, 1.8]]) wheel(g, x, 0.5, z, 0.5, 0.4);
  g.traverse((m) => (m.castShadow = true));
  return g;
}

function kartMesh(color) {
  const g = new THREE.Group();
  g.userData.wheels = [];
  const chassis = new THREE.Mesh(boxGeo(1.3, 0.25, 2.3), mat(color));
  chassis.position.y = 0.35;
  const nose = new THREE.Mesh(boxGeo(1.0, 0.3, 0.6), mat(color));
  nose.position.set(0, 0.45, -1.1);
  const seat = new THREE.Mesh(boxGeo(0.7, 0.6, 0.25), mat('#2a2a2a'));
  seat.position.set(0, 0.7, 0.35);
  const engine = new THREE.Mesh(boxGeo(0.8, 0.45, 0.5), mat('#5a5a62', 'metal'));
  engine.position.set(0, 0.6, 0.95);
  const wheelBar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 5, 12), mat('#222222'));
  wheelBar.position.set(0, 0.85, -0.55);
  wheelBar.rotation.x = -0.9;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), mat('#dddddd'));
  pole.position.set(0.5, 1.2, 1.0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshLambertMaterial({ color: '#ffcf3f', side: THREE.DoubleSide }));
  flag.position.set(0.75, 1.75, 1.0);
  g.add(chassis, nose, seat, engine, wheelBar, pole, flag);
  for (const [x, z, r] of [[-0.72, -0.8, 0.26], [0.72, -0.8, 0.26], [-0.75, 0.8, 0.32], [0.75, 0.8, 0.32]]) wheel(g, x, r, z, r, 0.28);
  g.traverse((m) => (m.castShadow = true));
  return g;
}
