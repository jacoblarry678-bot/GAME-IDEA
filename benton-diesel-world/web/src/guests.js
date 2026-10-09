// Park guests: single figures for ride riders and show performers, and
// the crowd strolling the walkways (walking, and stopping now and then to
// look around).
import * as THREE from 'three';
import * as Clock from './clock.js';
import { bakePose, poseIdle, poseCheer, poseSit, singleFigure, SEAT_HIPS } from './people/human.js';
import { lookFor, strideLength } from './people/crowd.js';

// Height of the standing pivot above the feet (rides and shows place
// figures by this point, about hip height).
const PIVOT = 2.87;

export class GuestFactory {
  constructor() {
    this.geos = new Map();
  }

  geo(pose) {
    if (!this.geos.has(pose)) {
      const p = pose === 'sit' ? poseSit(false) : pose === 'sitcheer' ? poseSit(true) : pose === 'cheer' ? poseCheer(0) : poseIdle(0);
      this.geos.set(pose, bakePose(p, 1));
    }
    return this.geos.get(pose);
  }

  // A guest whose origin is the figure's pivot (seat point when sitting,
  // about hip height when standing).
  make(seed, pose = 'stand') {
    const look = lookFor(seed).o;
    const mesh = singleFigure(this.geo(pose), look);
    const sitting = pose === 'sit' || pose === 'sitcheer';
    if (sitting) {
      // scale about the hips so smaller riders still sit on the seat
      const m = new THREE.Matrix4().makeTranslation(0, SEAT_HIPS, 0)
        .multiply(new THREE.Matrix4().makeScale(look.width, look.height, look.width))
        .multiply(new THREE.Matrix4().makeTranslation(0, -SEAT_HIPS, 0));
      mesh.setMatrixAt(0, m);
    } else {
      mesh.position.y = -PIVOT;
    }
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Walkway lines guests stroll back and forth on.
export const LINES = [
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

const WALKWAY = 0.42; // top of the paths

export class Crowd {
  constructor(people, count) {
    this.people = people;
    const rng = mulberry(77);
    this.walkers = [];
    for (let i = 1; i <= count; i++) {
      const seed = 500 + i * 13;
      this.walkers.push({
        seed,
        line: LINES[(i - 1) % LINES.length],
        hub: i % 6 === 0,
        s: rng(),
        speed: (3.6 + rng() * 1.8) * lookFor(seed).o.height,
        dir: rng() < 0.5 ? 1 : -1,
        offset: -4 + rng() * 8,
        cycle: rng(),
        stride: strideLength(seed),
        nextStop: 8 + rng() * 30,
        stopFor: 0,
        idle: Math.floor(rng() * 4),
        yaw: 0,
      });
    }
  }

  update(dt, time) {
    const crowd = Clock.crowd(Clock.minutes());
    const visible = Math.floor(this.walkers.length * Math.min(1, Math.max(0.1, crowd)));
    for (let i = 0; i < visible; i++) {
      const w = this.walkers[i];
      // stop for a few seconds now and then
      let moving = true;
      if (w.stopFor > 0) {
        w.stopFor -= dt;
        moving = false;
      } else {
        w.nextStop -= dt;
        if (w.nextStop <= 0) {
          w.stopFor = 2 + ((w.seed * 7) % 5);
          w.nextStop = 15 + ((w.seed * 13) % 30);
        }
      }
      const step = moving ? dt * w.speed : 0;
      let x, z, fx, fz;
      if (w.hub) {
        w.s = (w.s + step / (2 * Math.PI * 50) * w.dir + 1) % 1;
        const a = w.s * Math.PI * 2;
        const r = 46 + w.offset;
        x = Math.cos(a) * r;
        z = -60 + Math.sin(a) * r;
        fx = -Math.sin(a) * w.dir;
        fz = Math.cos(a) * w.dir;
      } else {
        const [a, b] = w.line;
        const len = a.distanceTo(b);
        w.s += step / len * w.dir;
        if (w.s > 1) { w.s = 1; w.dir = -1; } else if (w.s < 0) { w.s = 0; w.dir = 1; }
        const ax = (b.x - a.x) / len, az = (b.z - a.z) / len;
        const sx = -az, sz = ax;
        x = a.x + (b.x - a.x) * w.s + sx * w.offset;
        z = a.z + (b.z - a.z) * w.s + sz * w.offset;
        fx = ax * w.dir;
        fz = az * w.dir;
      }
      w.cycle += step / w.stride;
      let yaw = Math.atan2(-fx, -fz);
      if (!moving) yaw += Math.sin(time * 0.7 + w.seed) * 0.6; // look around
      let d = yaw - w.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      w.yaw += d * Math.min(1, dt * 6);
      if (moving) this.people.add('walk', w.cycle, x, WALKWAY, z, w.yaw, w.seed);
      else this.people.add('idle', w.idle, x, WALKWAY, z, w.yaw, w.seed);
    }
  }
}
