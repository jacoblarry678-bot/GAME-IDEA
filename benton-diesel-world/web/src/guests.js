// Simulated guest figures (exported from the Roblox Props.guest builder)
// and the crowd strolling the walkways.
import * as THREE from 'three';
import * as Clock from './clock.js';
import { buildModel } from './geom.js';

export class GuestFactory {
  constructor(data) {
    this.data = data;
    this.byPose = { sit: [], stand: [], cheer: [] };
    for (const g of data.guests) (this.byPose[g.pose] ||= []).push(g);
    this.cache = new Map();
  }

  // A guest model whose origin is the figure's pivot (about hip height).
  make(seed, pose = 'stand') {
    const list = this.byPose[pose] || this.byPose.stand;
    const h = Math.abs(Math.imul(seed | 0, 2654435761)) >>> 0;
    const def = list[h % list.length];
    const key = `${def.seed}:${def.pose}`;
    if (!this.cache.has(key)) this.cache.set(key, buildModel(def.parts, this.data.materials, { detail: false }));
    return this.cache.get(key).clone();
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Walkway lines guests stroll back and forth on.
const LINES = [
  [V(-14, 0, 222), V(-14, 0, 6)],
  [V(14, 0, 6), V(14, 0, 222)],
  [V(-6, 0, 210), V(-6, 0, 20)],
  [V(-45, 0, 252), V(45, 0, 252)],
  [V(-30, 0, 15), V(-158, 0, 15)],
  [V(-62, 0, 240), V(-150, 0, 232)],
  [V(-38, 0, -100), V(-160, 0, -184)],
  [V(0, 0, -118), V(0, 0, -290)],
  [V(38, 0, -100), V(126, 0, -150)],
  [V(130, 0, -120), V(215, 0, -180)],
  [V(26, 0, 60), V(112, 0, 60)],
  [V(112, 0, 60), V(112, 0, 246)],
  [V(112, 0, 246), V(300, 0, 246)],
  [V(300, 0, 60), V(300, 0, 246)],
  [V(112, 0, 60), V(300, 0, 60)],
  [V(-152, 0, 50), V(-152, 0, 190)],
  [V(-200, 0, -20), V(-180, 0, 40)],
  [V(-240, 0, -200), V(-160, 0, -175)],
];

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Crowd {
  constructor(scene, factory, count) {
    const rng = mulberry(77);
    this.walkers = [];
    for (let i = 1; i <= count; i++) {
      const model = factory.make(500 + i * 13, 'stand');
      scene.add(model);
      this.walkers.push({
        model,
        line: LINES[(i - 1) % LINES.length],
        hub: i % 6 === 0,
        s: rng(),
        speed: 4.5 + rng() * 2,
        dir: rng() < 0.5 ? 1 : -1,
        offset: -4 + rng() * 8,
        phase: rng() * 6,
      });
    }
    this.tmp = new THREE.Vector3();
  }

  update(dt, time) {
    const crowd = Clock.crowd(Clock.minutes());
    const visible = Math.floor(this.walkers.length * Math.min(1, Math.max(0.1, crowd)));
    this.walkers.forEach((w, i) => {
      w.model.visible = i < visible;
      if (!w.model.visible) return;
      let x, z, fx, fz;
      if (w.hub) {
        w.s = (w.s + dt * w.speed / (2 * Math.PI * 50) * w.dir + 1) % 1;
        const a = w.s * Math.PI * 2;
        const r = 46 + w.offset;
        x = Math.cos(a) * r;
        z = -60 + Math.sin(a) * r;
        fx = -Math.sin(a) * w.dir;
        fz = Math.cos(a) * w.dir;
      } else {
        const [a, b] = w.line;
        const len = a.distanceTo(b);
        w.s += dt * w.speed / len * w.dir;
        if (w.s > 1) { w.s = 1; w.dir = -1; } else if (w.s < 0) { w.s = 0; w.dir = 1; }
        const ax = (b.x - a.x) / len, az = (b.z - a.z) / len;
        // side = along x up
        const sx = -az, sz = ax;
        x = a.x + (b.x - a.x) * w.s + sx * w.offset;
        z = a.z + (b.z - a.z) * w.s + sz * w.offset;
        fx = ax * w.dir;
        fz = az * w.dir;
      }
      const bob = Math.abs(Math.sin(time * 7 + w.phase)) * 0.35;
      w.model.position.set(x, 3.3 + bob, z);
      w.model.rotation.set(0, Math.atan2(-fx, -fz), 0);
    });
  }
}
