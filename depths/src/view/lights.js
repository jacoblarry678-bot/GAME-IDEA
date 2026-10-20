/**
 * Light rig: a fixed pool of point lights assigned each frame to the
 * nearest ceiling fixtures in the rooms you can see into, the player's
 * flashlight (a spot light with an arm's-length reserve light at zero
 * charge), and teammates' flashlights in co-op.
 */
import * as THREE from 'three';
import { KITS } from './materials.js';

const LEVEL_INTENSITY = { normal: 7, bright: 9, dim: 2.6, dark: 0 };

export class LightRig {
  constructor(engine, level, settings) {
    this.engine = engine;
    this.level = level;
    this.settings = settings;
    const q = engine.quality;
    this.pool = [];
    for (let i = 0; i < (q.lights || 8); i++) {
      const l = new THREE.PointLight(0xfff0c0, 0, 10, 1.8);
      l.userData = { cur: 0, target: 0, anchor: null };
      engine.scene.add(l);
      this.pool.push(l);
    }
    this.spot = new THREE.SpotLight(0xfff4e0, 0, 26, 0.48, 0.55, 1.5);
    this.spot.castShadow = !!(settings.data.graphics.shadows && q.shadows);
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.2;
    this.spot.shadow.bias = -0.0008;
    engine.scene.add(this.spot, this.spot.target);
    this.reserve = new THREE.PointLight(0xffe8c8, 0, 2.6, 2);
    engine.scene.add(this.reserve);
    this.mates = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.SpotLight(0xfff4e0, 0, 20, 0.45, 0.6, 1.5);
      engine.scene.add(s, s.target);
      this.mates.push(s);
    }
    this.extra = new THREE.PointLight(0xffffff, 0, 30, 1.5); // camera flash / events
    engine.scene.add(this.extra);
    this.extraT = 0;
  }

  setLevel(level) { this.level = level; for (const l of this.pool) l.userData.anchor = null; }

  flash(pos, intensity = 60, dur = 0.12) {
    this.extra.position.set(pos.x, pos.y, pos.z);
    this.extra.intensity = intensity; this.extraT = dur; this.extraDur = dur; this.extraPeak = intensity;
  }

  update(dt, game, cam, player) {
    const L = this.level;
    // ---- pool assignment
    const camRoom = L.roomAt(cam.position.x, cam.position.z);
    const near = new Set();
    if (camRoom) { near.add(camRoom.id); for (const d of camRoom.doors) if (d.open > 0.3 || d.T.open || d.type === 'shutter' || d.type === 'gate') { near.add(d.a); if (d.b) near.add(d.b); } }
    const cands = [];
    for (const a of L.lights) {
      if (a.level === 'dark') continue;
      if (game.story.has(`dark.${a.room}`)) continue;
      const d = Math.hypot(a.x - cam.position.x, a.z - cam.position.z, a.y - cam.position.y);
      const score = d + (near.has(a.room) ? 0 : 14);
      cands.push([score, a]);
    }
    cands.sort((x, y) => x[0] - y[0]);
    const chosen = cands.slice(0, this.pool.length).map((c) => c[1]);
    const free = this.pool.filter((l) => !l.userData.anchor || !chosen.includes(l.userData.anchor));
    for (const l of this.pool) if (l.userData.anchor && !chosen.includes(l.userData.anchor)) l.userData.target = 0;
    for (const a of chosen) {
      if (this.pool.some((l) => l.userData.anchor === a)) continue;
      const l = free.find((x) => x.userData.cur < 0.05) || free.find((x) => x.userData.target === 0);
      if (!l) continue;
      free.splice(free.indexOf(l), 1);
      l.userData.anchor = a;
      const room = L.room(a.room);
      const kit = KITS[room.kit || L.def.kit] || KITS.office;
      l.color.setHex(kit.light);
      l.position.set(a.x, a.y - 0.35, a.z);
      l.distance = Math.max(8, Math.min(16, room.h * 3.2));
    }
    for (const l of this.pool) {
      const a = l.userData.anchor;
      if (a && chosen.includes(a)) l.userData.target = (LEVEL_INTENSITY[a.level] ?? 7) * (a.flickerK ?? 1);
      const u = l.userData;
      u.cur += (u.target - u.cur) * Math.min(1, dt * 6);
      if (u.cur < 0.02 && u.target === 0) { u.cur = 0; u.anchor = null; }
      l.intensity = u.cur;
    }
    // ---- flashlight
    const p = player;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (p && p.hasFlashlight && p.flashOn && !p.hidden) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      this.spot.position.copy(cam.position).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.15, 0));
      this.spot.target.position.copy(cam.position).addScaledVector(fwd, 10);
      if (p.charge > 0) {
        let k = 1;
        if (p.charge < 10) k = (Math.sin(game.time * 31) > 0.3 || Math.sin(game.time * 7) > 0.9) ? 0.35 : 0.85;
        this.spot.intensity = 34 * k;
        this.reserve.intensity = 0;
      } else {
        this.spot.intensity = 0;
        this.reserve.position.copy(cam.position).addScaledVector(fwd, 0.6);
        this.reserve.intensity = 1.4;
      }
    } else { this.spot.intensity = 0; this.reserve.intensity = 0; }
    // ---- teammates
    let i = 0;
    for (const q of game.players.values()) {
      if (q === p || !q.alive || !q.flashOn || q.charge <= 0 || i >= this.mates.length) continue;
      const s = this.mates[i++];
      const e = q.eye(), f = q.forward();
      s.position.set(e.x, e.y - 0.1, e.z);
      s.target.position.set(e.x + f.x * 8, e.y + f.y * 8, e.z + f.z * 8);
      s.intensity = 26;
    }
    for (; i < this.mates.length; i++) this.mates[i].intensity = 0;
    // ---- flash decay
    if (this.extraT > 0) { this.extraT -= dt; this.extra.intensity = Math.max(0, this.extraPeak * (this.extraT / this.extraDur)); } else this.extra.intensity = 0;
  }

  dispose() {
    for (const l of [...this.pool, this.spot, this.reserve, this.extra, ...this.mates]) { this.engine.scene.remove(l); if (l.target) this.engine.scene.remove(l.target); l.dispose && l.dispose(); }
  }
}
