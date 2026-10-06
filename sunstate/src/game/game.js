/**
 * Game: owns the simulation. Fixed-step update order:
 *   player input → AI (traffic, peds, police) → vehicles → contacts →
 *   characters → wanted level → missions → ambient director.
 * Rendering-only work (camera, animation, effects, HUD) runs in frame().
 */
import * as THREE from 'three';
import { Events } from '../core/events.js';
import { Vehicle } from '../entities/vehicle.js';
import { randomLook } from '../entities/humanModel.js';
import { CameraRig } from './camera.js';
import { Combat } from './combat.js';
import { Crew, PROTAGONISTS } from './crew.js';
import { DISTRICT, PLACES } from '../world/district.js';
import { obbCircle } from '../world/collision.js';
import { TrafficManager } from '../ai/traffic.js';
import { PedManager } from '../ai/peds.js';
import { PoliceManager } from '../ai/police.js';
import { Wanted } from './wanted.js';
import { Economy } from './economy.js';
import { Store } from './store.js';
import { MissionManager, Markers } from './missions.js';
import { Director } from '../ai/director.js';
import { snapshot, writeSave } from './save.js';
import { Social } from './social.js';

export const PROTAGONIST_LOOK = PROTAGONISTS.cal.look;

export class Game {
  constructor({ engine, world, input, settings, audio }) {
    this.engine = engine;
    this.world = world;
    this.input = input;
    this.settings = settings;
    this.audio = audio;
    this.events = new Events();
    this.time = 0;
    this.paused = false;
    this.vehicles = [];
    this.peds = [];
    this.cops = [];
    this.extras = []; // mission actors
    this.interactables = [];
    this.combat = new Combat(this);
    this.cameraRig = new CameraRig(this);
    const sp = PLACES.safehouse.spawn;
    this.player = null; // the protagonist you control (set by the crew)
    this.partner = null; // the other one
    this.crew = new Crew(this);
    this.cameraRig.snapBehind(sp.rot);
    this.stats = { robberies: 0, escapes: 0, busted: 0, wasted: 0, distanceDriven: 0 };
    this.economy = new Economy(this);
    this.wanted = new Wanted(this);
    this.traffic = new TrafficManager(this);
    this.peds_ = new PedManager(this);
    this.police = new PoliceManager(this);
    this.store = new Store(this);
    this.missions = new MissionManager(this);
    this.markers = new Markers(this);
    this.director = new Director(this);
    this.social = new Social(this);
    this.spawnParked();
    this.bindEvents();
  }

  bindEvents() {
    const ev = this.events;
    ev.on('killed', ({ victim }) => { if (victim === this.player) { this.stats.wasted++; ev.emit('playerDied'); } });
    ev.on('busted', () => { this.stats.busted++; });
    ev.on('wantedCleared', () => { this.stats.escapes++; });
    ev.on('vehicleImpact', ({ strength, x, y, z, vehicle }) => {
      this.audio?.impact({ x, y, z }, strength);
      if (vehicle === this.player.vehicle || (vehicle && vehicle.seats.includes(this.player))) this.cameraRig.addShake(Math.min(1, strength / 8));
    });
    ev.on('splash', (ch) => this.audio?.splash(ch.pos));
    ev.on('propBroken', (p) => { this.audio?.impact(p, 2.5); this.combat.puff(new THREE.Vector3(p.x, p.y, p.z), 0xb8b0a0, 0.6); });
  }

  /** Put the player back on their feet somewhere (respawn, checkpoint). */
  respawnPlayer(x, z, yaw, { health = 100 } = {}) {
    const p = this.player;
    if (p.vehicle) this.unseatCharacter(p.vehicle, p, { x, y: this.world.ground(x, z, 2), z });
    p.dead = false; p.deadT = 0; p.knockT = 0; p.climbT = 0; p.swim = false; p.crouch = false;
    p.health = health;
    p.pos.set(x, this.world.ground(x, z, 2), z);
    p.vel.set(0, 0, 0);
    p.yaw = yaw;
    p.controller.enter = null; p.controller.exit = null; p.controller.reloadT = 0; p.controller.frozen = false;
    p.anim_.surrender = false; p.anim_.aim = false;
    this.cameraRig.snapBehind(yaw);
    // police sight is re-evaluated from the new position (no stale "seen" for one tick)
    if (this.police) { this.police.seesPlayer = false; this.police.seeT = 0; }
  }

  /** Write the save file (at the safehouse or after a mission). */
  saveGame(reason = 'manual') {
    const s = writeSave(snapshot(this));
    if (s) this.events.emit('saved', { reason, at: s.savedAt });
    return !!s;
  }

  allCharacters() {
    const out = [this.player, this.partner];
    for (const p of this.peds) out.push(p);
    for (const c of this.cops) out.push(c);
    for (const e of this.extras) out.push(e);
    return out;
  }

  /** Parked cars from the district plan (owned starting cars are flagged). */
  spawnParked() {
    for (const p of DISTRICT.parking) {
      if (p.police) continue;
      const v = this.addVehicle(p.model, p.x, p.z, p.rot, p.color);
      v.parkedSpot = p;
      if (p.owned) { v.owner = 'player'; v.persistentId = p.id; }
    }
  }

  addVehicle(model, x, z, yaw, color, opts = {}) {
    const v = new Vehicle(this, model, { x, z, yaw, color, plate: opts.plate });
    this.vehicles.push(v);
    return v;
  }

  removeVehicle(v) {
    for (let i = 0; i < v.seats.length; i++) {
      const o = v.seats[i];
      if (!o) continue;
      if (o === this.player) return false;
      if (o === this.partner) { this.unseatCharacter(v, o, null); continue; }
      this.unseatCharacter(v, o, null);
      this.removeCharacter(o);
    }
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    v.dispose();
    return true;
  }

  removeCharacter(ch) {
    for (const list of [this.peds, this.cops, this.extras]) {
      const i = list.indexOf(ch);
      if (i >= 0) list.splice(i, 1);
    }
    if (ch.vehicle) this.unseatCharacter(ch.vehicle, ch, null);
    ch.removed = true;
    ch.dispose();
  }

  seatCharacter(v, seat, ch) {
    v.seats[seat] = ch;
    ch.vehicle = v;
    ch.seat = seat;
    ch.vel.set(0, 0, 0);
    ch.swim = false;
    if (seat === 0) { v.prevDriverRole = v.lastDriverRole; v.lastDriverRole = ch.role; v.parked = false; }
    if (ch === this.player) { v.engineOn = true; this.events.emit('playerEnteredVehicle', v); }
  }

  /** Remove from the seat and place at spot (or the driver door). */
  unseatCharacter(v, ch, spot) {
    const s = v.seats.indexOf(ch);
    if (s >= 0) v.seats[s] = null;
    ch.vehicle = null;
    ch.seat = -1;
    if (!spot) {
      const [x, z] = v.doorPoint(Math.max(0, s));
      spot = { x, z, y: this.world.ground(x, z, v.pos.y + 1) };
    }
    ch.pos.set(spot.x, spot.y, spot.z);
    ch.vel.set(0, 0, 0);
    ch.yaw = v.yaw;
    ch.grounded = !spot.roof;
    ch.group.position.copy(ch.pos);
    ch.group.quaternion.identity();
    ch.group.rotation.set(0, ch.yaw, 0);
    if (s === 0) { v.input.throttle = 0; v.input.brake = 0; v.input.steer = 0; }
    if (ch === this.player) this.events.emit('playerExitedVehicle', v);
  }

  /** Pull an NPC out of the seat: they stumble away and flee (a witnessed crime). */
  carjack(v, seat, thief) {
    const victim = v.seats[seat];
    if (!victim) return;
    this.unseatCharacter(v, victim, null);
    const [dx, dz] = v.doorPoint(seat);
    victim.pos.set(dx, this.world.ground(dx, dz, v.pos.y + 1), dz);
    victim.knockDown(-Math.cos(v.yaw) * (seat === 0 ? -1 : 1) * 3, Math.sin(v.yaw) * 3, 0.5, thief);
    victim.knockT = 1.2;
    if (v.ai) { v.ai = null; }
    this.traffic?.release(v);
    this.events.emit('carjack', { vehicle: v, victim, thief });
    if (victim.controller?.panic) victim.controller.panic(thief, 'carjacked');
  }

  ejectOccupant(v, seat) {
    const o = v.seats[seat];
    if (o) this.unseatCharacter(v, o, null);
  }

  /** Fixed simulation step. */
  step(dt) {
    this.time += dt;
    this.crew.step(dt); // switching / partner commands, then the partner's AI
    const p = this.player;
    p.controller.step(dt);
    this.traffic?.step(dt);
    this.peds_?.step(dt);
    for (const e of this.extras) e.controller?.step?.(dt);
    this.store?.step(dt);
    this.police?.step(dt);
    this.debugHook?.(dt);
    this.missions?.step(dt);

    for (const v of this.vehicles) {
      v.step(dt);
      // a car that has filled with water: everyone swims out
      if (v.sunk) {
        v.sunkT = (v.sunkT || 0) + dt;
        if (v.sunkT > 2.5 && v.occupied) for (const o of [...v.seats]) if (o) {
          this.unseatCharacter(v, o, { x: o === this.player ? v.pos.x : v.pos.x + (Math.random() - 0.5) * 3, y: this.world.waterY - 1.3, z: v.pos.z });
          o.swim = true; o.grounded = false;
          if (o.controller?.panic) o.controller.panic(v.pos, 'sinking');
        }
      }
    }
    // vehicle–vehicle contacts (broad phase by distance)
    const vs = this.vehicles;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i], b = vs[j];
      const r = a.hz + b.hz;
      if (Math.abs(a.pos.x - b.pos.x) < r && Math.abs(a.pos.z - b.pos.z) < r) Vehicle.collidePair(a, b);
    }
    for (const ch of this.allCharacters()) ch.step(dt);
    this.characterContacts();
    this.wanted?.step(dt);
    this.director?.step(dt);
    this.weather?.step(dt);
    this.social.step(dt);
    if (this.input.pressed('phone')) { this.social.toggle(); this.audio?.ui('select'); }
    this.input.endStep();
  }

  /** Characters vs vehicles (push or knock down) and vs each other. */
  characterContacts() {
    const chars = this.allCharacters();
    for (const ch of chars) {
      if (ch.vehicle || ch.removed) continue;
      for (const v of this.vehicles) {
        const dx = ch.pos.x - v.pos.x, dz = ch.pos.z - v.pos.z;
        if (Math.abs(dx) > v.hz + 1 || Math.abs(dz) > v.hz + 1) continue;
        if (ch.pos.y > v.pos.y + v.def.height - 0.2 || ch.pos.y + ch.height < v.pos.y) continue;
        const r = obbCircle(v.pos.x, v.pos.z, v.hx, v.hz, v.yaw, ch.pos.x, ch.pos.z, ch.radius);
        if (!r) continue;
        // r.n points circle→box; push the character the other way. Only the car's own speed
        // toward the person counts as an impact (running into a parked car doesn't knock you down)
        const pv = v.vel.x * -r.nx + v.vel.y * -r.nz;
        if (pv > 4.5 && !ch.dead && ch.knockT <= 0) {
          ch.knockDown(v.vel.x, v.vel.y, pv, v.driver || null);
          this.events.emit('pedHit', { victim: ch, vehicle: v, speed: pv });
          this.audio?.thud(ch.pos);
          v.vel.multiplyScalar(0.96);
        }
        ch.pos.x -= r.nx * r.depth;
        ch.pos.z -= r.nz * r.depth;
        if (r.depth > 0.01 && Math.hypot(ch.wish.x, ch.wish.y) > 0.3) ch.carBlockT = 0.12; // walking into a car: "blocked
      }
    }
    // keep people from standing inside each other
    for (let i = 0; i < chars.length; i++) {
      const a = chars[i];
      if (a.vehicle || a.dead) continue;
      for (let j = i + 1; j < chars.length; j++) {
        const b = chars[j];
        if (b.vehicle || b.dead) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        if (Math.abs(dx) > 0.7 || Math.abs(dz) > 0.7 || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
        const d = Math.hypot(dx, dz), m = a.radius + b.radius;
        if (d < m && d > 1e-4) {
          const push = (m - d) / 2;
          a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
        }
      }
    }
  }

  /** Per rendered frame: visuals only. */
  frame(dt) {
    for (const v of this.vehicles) v.updateMesh(dt);
    for (const ch of this.allCharacters()) ch.updateVisual(dt);
    this.cameraRig.update(dt);
    this.combat.update(dt);
    this.world.update(dt);
    const focus = this.player.vehicle ? this.player.vehicle.pos : this.player.pos;
    this.engine.updateLighting(dt, focus);
    this.updateHeadlights();
    this.markers.update(dt);
    if (dt > 0) this.smoke(dt);
    this.footsteps();
    this.audio?.update(dt, this);
  }

  /** The two real spotlights follow the player's car when its lights are on. */
  updateHeadlights() {
    const e = this.engine;
    const v = this.player.vehicle;
    if (!v || !v.headlightsVisible) { e.headL.intensity = 0; e.headR.intensity = 0; return; }
    for (const [l, s] of [[e.headL, -1], [e.headR, 1]]) {
      const [x, z] = v.localToWorld(s * (v.hx - 0.3), v.hz - 0.1);
      const [tx, tz] = v.localToWorld(s * 1.5, v.hz + 20);
      l.position.set(x, v.pos.y + 0.75, z);
      l.target.position.set(tx, v.pos.y - 1.2, tz);
      l.intensity = 60 * e.time.night + 4;
    }
  }

  /** Remove everything this game created from the scene (quit / new game). */
  dispose() {
    this.director.clearAll();
    this.police.clearAll();
    this.missions.cleanup();
    for (const v of [...this.vehicles]) { for (let i = 0; i < v.seats.length; i++) v.seats[i] = null; this.vehicles.splice(this.vehicles.indexOf(v), 1); v.dispose(); }
    for (const ch of [...this.peds, ...this.cops, ...this.extras, ...this.crew.list]) ch.dispose();
    this.peds.length = 0; this.cops.length = 0; this.extras.length = 0;
    this.markers.dispose();
    this.combat.dispose();
    this.events = { on() {}, emit() {} };
    this.disposed = true;
  }

  /** Smoke from badly damaged engines. */
  smoke(dt) {
    this._smokeT = (this._smokeT || 0) - dt;
    if (this._smokeT > 0) return;
    this._smokeT = 0.12;
    for (const v of this.vehicles) {
      if (v.health > 350 && !v.smoking) continue;
      if (Math.hypot(v.pos.x - this.engine.camera.position.x, v.pos.z - this.engine.camera.position.z) > 90) continue;
      const [x, z] = v.localToWorld(0, v.hz - 0.9);
      const dark = v.health < 150 ? 0x2a2a2a : 0x9a9a9a;
      this.combat.puff(new THREE.Vector3(x, v.pos.y + v.def.height * 0.75, z), dark, 0.5 + Math.random() * 0.4);
    }
  }

  /** Footstep sounds from the walk cycle phase. */
  footsteps() {
    const p = this.player;
    if (p.vehicle || p.dead || !p.grounded || p.swim) return;
    const step = Math.floor(p.anim.phase / Math.PI);
    if (step !== this._lastStep) {
      this._lastStep = step;
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp > 0.6) this.audio?.footstep(p.pos, this.world.interiorAt(p.pos.x, p.pos.z) ? 'tile' : this.world.surface(p.pos.x, p.pos.z, p.pos.y), sp > 5);
    }
  }

  get playerVehicle() { return this.player.vehicle; }
}

export { THREE, randomLook };
