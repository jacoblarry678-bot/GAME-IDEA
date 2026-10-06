/**
 * Mission enemies (the Caldera brothers' crew in "Low Tide"): cars with a
 * driver and a gunner. Out of sight they drive the road graph toward you;
 * close and in view they pursue directly (the same feeler steering the
 * police use) and the gunner shoots from the window. If you're on foot
 * nearby, or their car is wrecked, they get out and fight on foot.
 * Every enemy is flagged `enemy`, which is what the partner shoots back at.
 */
import * as THREE from 'three';
import { Character } from '../entities/character.js';
import { attachDriver, pursuitSteer } from './driver.js';
import { WEAPONS } from '../data/weapons.js';

const rand = (a, b) => a + Math.random() * (b - a);

export const RIVAL_LOOK = () => ({
  female: false, height: 1.76 + Math.random() * 0.1, build: 1.1 + Math.random() * 0.15,
  skin: [0x8d5524, 0xc68642, 0xe0ac69, 0xa66a3f][Math.floor(Math.random() * 4)], hair: 0x111111,
  top: [0x1f1f1f, 0x7a1f24, 0x2b2b2b][Math.floor(Math.random() * 3)], bottom: 0x2a2a2a, shoes: 0x111111,
  hairStyle: Math.random() < 0.5 ? 'buzz' : 'short', shorts: false, sleeveless: Math.random() < 0.4, hat: Math.random() < 0.5 ? 0x111111 : null, beard: Math.random() < 0.6,
});

/** Spawn one enemy car with a driver and a gunner. Returns { vehicle, crew }. */
export function spawnRivalCar(game, model, x, z, yaw, color, dest) {
  const v = game.addVehicle(model, x, z, yaw, color, { plate: 'CLD ' + (100 + Math.floor(Math.random() * 899)) });
  v.engineOn = true;
  v.mission = true;
  v.enemy = true;
  v.bulletMul = 2.4; // a few magazines disable it (the engine block isn't modelled)
  const crew = [];
  for (const seat of [0, 1]) {
    const ch = new Character(game, RIVAL_LOOK(), { role: 'enemy', x, z });
    ch.enemy = true;
    ch.health = 70; ch.maxHealth = 70;
    ch.controller = new RivalController(game, ch, v, dest);
    game.extras.push(ch);
    game.seatCharacter(v, seat, ch);
    crew.push(ch);
  }
  return { vehicle: v, crew };
}

export class RivalController {
  constructor(game, ch, vehicle, dest) {
    this.game = game;
    this.ch = ch;
    this.car = vehicle;
    this.dest = dest; // where they head before they spot you
    this.mode = 'approach';
    this.ai = null;
    this.routeT = 0;
    this.u = { stuckT: 0, reverseT: 0 };
    this.fireT = rand(0.8, 1.6);
    this.burst = 0;
    this.lostT = 0;
    this.holdT = 0; // wait (engine running) before setting off, e.g. until a conversation ends
  }

  get target() {
    const p = this.game.player;
    return { ch: p, pos: p.vehicle ? p.vehicle.pos : p.pos, vehicle: p.vehicle };
  }

  sees(from, to) {
    const hit = this.game.world.collision.raycast(from.x, from.y + 1.3, from.z, to.x - from.x, to.y + 1 - (from.y + 1.3), to.z - from.z, 1, (c) => c.tag !== 'prop' && c.tag !== 'glass');
    return !hit || hit.t > 0.96;
  }

  step(dt) {
    const ch = this.ch;
    if (ch.dead) return;
    if (ch.knockT > 0) { ch.wishSpeed = 0; return; }
    if (ch.vehicle) { if (ch.seat === 0) this.drive(dt); else this.shootFromCar(dt); return; }
    this.onFoot(dt);
  }

  drive(dt) {
    const g = this.game, v = this.car, t = this.target;
    if (v.destroyed || v.sunk) { this.bail(); return; }
    if (this.holdT > 0) {
      if (!g.missions.cutscene) this.holdT -= dt;
      v.holdStill();
      return;
    }
    const d = Math.hypot(t.pos.x - v.pos.x, t.pos.z - v.pos.z);
    const sees = this.sees(v.pos, t.pos);
    if (this.mode === 'approach') {
      if ((d < 55 && sees) || this.alerted) this.mode = 'pursue';
      else {
        if (!this.ai) this.ai = attachDriver(v, g, this.dest);
        this.ai.speedScale = 1.2;
        this.ai.step(dt);
        return;
      }
    }
    // you're on foot close by (or stopped): get out and come for you
    if ((!t.vehicle && d < 22 && sees) || (t.vehicle && t.vehicle.speed < 1 && d < 14)) {
      if (v.speed < 4) { this.bail(); return; }
      v.holdStill();
      return;
    }
    if (sees) this.lostT = 0; else this.lostT += dt;
    if (d < 70 && this.lostT < 2) {
      this.ai = null;
      pursuitSteer(g, v, this.u, dt, t.pos, t.vehicle, { closeStop: 10 });
      return;
    }
    // follow the roads toward you, re-routing as you move
    this.routeT -= dt;
    if (!this.ai || this.routeT <= 0) { this.ai = attachDriver(v, g, { x: t.pos.x, z: t.pos.z }); this.ai.offroad = false; this.routeT = 3; }
    this.ai.speedScale = 1.45;
    this.ai.emergency = true;
    this.ai.step(dt);
  }

  /** Everybody out. */
  bail() {
    const g = this.game, v = this.car;
    for (const o of [...v.seats]) {
      if (!o || !o.enemy || o.dead) continue;
      const spot = g.player.controller.findExitSpot(v, o.seat);
      g.unseatCharacter(v, o, spot.roof ? null : spot);
      o.controller.mode = 'foot';
    }
    v.holdStill();
  }

  shootFromCar(dt) {
    const g = this.game, ch = this.ch, v = ch.vehicle, t = this.target, a = ch.anim_;
    if (v.destroyed || v.sunk || !v.driver || v.driver.dead) { if (v.speed < 3) this.bail(); a.aim = false; return; }
    if (this.mode === 'approach' && v.driver.controller?.mode === 'pursue') this.mode = 'pursue';
    const d = Math.hypot(t.pos.x - v.pos.x, t.pos.z - v.pos.z);
    if (this.mode === 'approach' || d > 40 || !this.sees(v.pos, t.pos) || t.ch.dead) { a.aim = false; return; }
    const yawTo = Math.atan2(t.pos.x - v.pos.x, t.pos.z - v.pos.z);
    a.aim = true; a.armed = true; a.aimPitch = 0;
    a.carAimYaw = Math.atan2(Math.sin(yawTo - v.yaw), Math.cos(yawTo - v.yaw));
    this.fire(dt, new THREE.Vector3(v.pos.x + Math.sin(yawTo) * 1.1, v.pos.y + 1.15, v.pos.z + Math.cos(yawTo) * 1.1), t, d, v.speed);
  }

  onFoot(dt) {
    const g = this.game, ch = this.ch, t = this.target, a = ch.anim_;
    const d = ch.distanceTo(t.pos.x, t.pos.z);
    const sees = this.sees(ch.pos, t.pos);
    a.armed = true;
    if (sees && d < 34 && !t.ch.dead) {
      ch.faceYaw = Math.atan2(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      a.aim = true; a.aimPitch = 0;
      ch.wishSpeed = d > 22 ? 3.4 : 0;
      if (ch.wishSpeed) ch.wish.set((t.pos.x - ch.pos.x) / d, (t.pos.z - ch.pos.z) / d);
      const yaw = ch.faceYaw;
      this.fire(dt, new THREE.Vector3(ch.pos.x + Math.sin(yaw) * 0.5, ch.pos.y + 1.4, ch.pos.z + Math.cos(yaw) * 0.5), t, d, Math.hypot(ch.vel.x, ch.vel.z));
      return;
    }
    a.aim = false;
    if (d < 2) { ch.wishSpeed = 0; return; }
    let wx = (t.pos.x - ch.pos.x) / d, wz = (t.pos.z - ch.pos.z) / d;
    if (ch.blockedT > 0.4) { const k = wx; wx = -wz; wz = k; }
    ch.wish.set(wx, wz);
    ch.wishSpeed = d > 60 ? 0 : 5;
    ch.faceYaw = null;
  }

  /** Short bursts with spread that grows with distance and speed. */
  fire(dt, from, t, d, ownSpeed) {
    const g = this.game, ch = this.ch;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    if (this.burst <= 0) this.burst = 2 + Math.floor(Math.random() * 3);
    this.burst--;
    this.fireT = this.burst > 0 ? rand(0.28, 0.45) : rand(1.2, 2.2);
    const aimY = t.vehicle ? 0.95 : 1.2;
    const to = new THREE.Vector3(t.pos.x, t.pos.y + aimY, t.pos.z);
    const tSpeed = t.vehicle ? t.vehicle.speed : Math.hypot(t.ch.vel.x, t.ch.vel.z);
    const spread = (t.vehicle ? 0.035 : 0.06) + d * 0.0024 + (tSpeed + ownSpeed) * 0.003;
    g.combat.fire(ch, from, to.sub(from).normalize(), { ...WEAPONS.pistol, damage: 9 }, spread);
  }
}
