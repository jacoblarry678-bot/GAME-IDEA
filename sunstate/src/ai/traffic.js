/**
 * Ambient traffic population: spawns cars on lanes out of the player's view,
 * keeps a bounded count around the player, and despawns distant ones.
 * Also cleans up abandoned vehicles nobody owns.
 */
import * as THREE from 'three';
import { ROAD_GRAPH, ISLAND } from '../world/layout.js';
import { DriverAI, laneLine } from './driver.js';
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';

const MODELS = [['kestrel', 0.58], ['pickup', 0.24], ['ironhorse', 0.18]];

export class TrafficManager {
  constructor(game) {
    this.game = game;
    this.cars = new Set();
    this.timer = 0;
    this.frustum = new THREE.Frustum();
    this.mat = new THREE.Matrix4();
    this.enabled = true;
  }

  get target() {
    const night = this.game.engine.time.night;
    return Math.round(16 * this.game.settings.gp.traffic * (1 - night * 0.35));
  }

  updateFrustum() {
    const cam = this.game.engine.camera;
    cam.updateMatrixWorld();
    this.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.mat);
  }

  visible(x, y, z, r = 4) {
    const d = Math.hypot(x - this.game.engine.camera.position.x, z - this.game.engine.camera.position.z);
    if (d > 260) return false;
    return this.frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3(x, y + 1, z), r));
  }

  step(dt) {
    for (const v of this.cars) if (v.ai) v.ai.step(dt);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    this.updateFrustum();
    const p = this.game.player;
    const ppos = p.vehicle ? p.vehicle.pos : p.pos;
    // despawn far cars that nobody can see
    for (const v of [...this.cars]) {
      const d = Math.hypot(v.pos.x - ppos.x, v.pos.z - ppos.z);
      if ((d > 220 && !this.visible(v.pos.x, v.pos.y, v.pos.z)) || d > 420) this.remove(v);
    }
    this.cleanupAbandoned(ppos);
    if (!this.enabled) return;
    // out on the twin span and Cayo Lento every spawn lands on the key's few short roads: keep it to a handful
    const target = ppos.z > ISLAND.south + 30 ? Math.min(this.target, 7) : this.target;
    let n = 0;
    while (this.cars.size < target && n++ < 2) this.trySpawn(ppos);
  }

  trySpawn(ppos) {
    const { edges } = ROAD_GRAPH;
    for (let attempt = 0; attempt < 12; attempt++) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      if (e.road === 'causeway' && Math.random() < 0.7) continue;
      if (['keyhwy', 'marina', 'shore', 'point', 'twinspan'].includes(e.road) && Math.random() < 0.6) continue; // quieter out on the key
      const from = Math.random() < 0.5 ? e.a : e.b;
      const lane = Math.floor(Math.random() * e.lanes);
      const t = 0.15 + Math.random() * 0.6;
      const l = laneLine(e, from, lane);
      const x = l.x0 + (l.x1 - l.x0) * t, z = l.z0 + (l.z1 - l.z0) * t;
      const d = Math.hypot(x - ppos.x, z - ppos.z);
      if (d < 70 || d > 190) continue;
      const y = this.game.world.ground(x, z, 20);
      if (this.visible(x, y, z, 5) && d < 160) continue;
      if (this.game.vehicles.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 12)) continue;
      this.spawnAt(e, from, lane, t, x, z, Math.atan2(l.dx, l.dz));
      return true;
    }
    return false;
  }

  spawnAt(e, from, lane, t, x, z, yaw, model = null) {
    const g = this.game;
    if (!model) { let r = Math.random(); model = MODELS.find(([, w]) => (r -= w) < 0)?.[0] || 'kestrel'; }
    const v = g.addVehicle(model, x, z, yaw);
    const startSpeed = 6 + Math.random() * 4;
    v.vel.set(Math.sin(yaw) * startSpeed, Math.cos(yaw) * startSpeed);
    const driver = new Character(g, randomLook(), { role: 'driver', x, z });
    g.peds.push(driver);
    driver.controller = g.peds_?.makeController(driver, 'driver');
    g.seatCharacter(v, 0, driver);
    v.ai = new DriverAI(v, g, { edge: e.id, from, lane, t });
    v.engineOn = true;
    this.cars.add(v);
    return v;
  }

  /** A car stops being traffic (carjacked, driver killed). */
  release(v) { this.cars.delete(v); }

  remove(v) {
    if (v.seats.includes(this.game.player)) return;
    this.cars.delete(v);
    this.game.removeVehicle(v);
  }

  cleanupAbandoned(ppos) {
    const g = this.game;
    for (const v of [...g.vehicles]) {
      if (this.cars.has(v) || v.owner || v.mission || v.policeUnit || v.occupied) continue;
      const d = Math.hypot(v.pos.x - ppos.x, v.pos.z - ppos.z);
      const moved = v.parkedSpot ? Math.hypot(v.pos.x - v.parkedSpot.x, v.pos.z - v.parkedSpot.z) > 15 : true;
      if (moved && d > 200 && !this.visible(v.pos.x, v.pos.y, v.pos.z)) g.removeVehicle(v);
    }
  }
}
