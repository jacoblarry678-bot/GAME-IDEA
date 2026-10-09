// Ride motion (ported from RideMotion.luau / Track.luau) and the ride
// visuals: vehicles, moving platforms, and guests riding along.
import * as THREE from 'three';
import { buildModel, cfMatrix } from './geom.js';
import { material } from './render/materials.js';

const TAU = Math.PI * 2;

function smoothstep(x) {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

export function rampAngle(t, T, ramp, omega) {
  if (t <= 0) return 0;
  const total = omega * (T - ramp);
  if (t >= T) return total;
  if (t < ramp) return 0.5 * omega / ramp * t * t;
  if (t < T - ramp) return 0.5 * omega * ramp + omega * (t - ramp);
  const r = T - t;
  return total - 0.5 * omega / ramp * r * r;
}

const tmpV = new THREE.Vector3();
const RY = (a) => new THREE.Matrix4().makeRotationY(a);
const RZ = (a) => new THREE.Matrix4().makeRotationZ(a);
const TR = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const mul = (...ms) => ms.reduce((acc, m) => acc.multiply(m), new THREE.Matrix4());

export class Sampler {
  constructor(tr) {
    this.length = tr.length;
    this.cum = tr.cum;
    this.pos = tr.pos;
    this.tan = tr.tan;
    this.up = tr.up;
    this.times = tr.times;
    this.n = tr.cum.length;
  }
  locate(s) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const cum = this.cum;
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo];
    return [lo, seg > 0 ? (s - cum[lo]) / seg : 0];
  }
  matrixAt(s, out = new THREE.Matrix4()) {
    const [i, a] = this.locate(s);
    const j = i + 1;
    const p = this.pos, t = this.tan, u = this.up;
    const pos = new THREE.Vector3(
      p[i * 3] + (p[j * 3] - p[i * 3]) * a,
      p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * a,
      p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * a,
    );
    const tan = new THREE.Vector3(
      t[i * 3] + (t[j * 3] - t[i * 3]) * a,
      t[i * 3 + 1] + (t[j * 3 + 1] - t[i * 3 + 1]) * a,
      t[i * 3 + 2] + (t[j * 3 + 2] - t[i * 3 + 2]) * a,
    ).normalize();
    const hint = new THREE.Vector3(
      u[i * 3] + (u[j * 3] - u[i * 3]) * a,
      u[i * 3 + 1] + (u[j * 3 + 1] - u[i * 3 + 1]) * a,
      u[i * 3 + 2] + (u[j * 3 + 2] - u[i * 3 + 2]) * a,
    );
    const up = hint.sub(tmpV.copy(tan).multiplyScalar(hint.dot(tan)));
    if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
    up.normalize();
    const right = new THREE.Vector3().crossVectors(tan, up);
    const back = new THREE.Vector3().crossVectors(right, up);
    out.makeBasis(right, up, back);
    out.setPosition(pos);
    return out;
  }
  distanceAt(t) {
    const times = this.times;
    if (t <= 0) return 0;
    if (t >= times[this.n - 1]) return this.length;
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid; else hi = mid;
    }
    const dt = times[hi] - times[lo];
    const a = dt > 0 ? (t - times[lo]) / dt : 0;
    return this.cum[lo] + (this.cum[hi] - this.cum[lo]) * a;
  }
}

// Returns pose(t) -> { cars: Matrix4[], extras: {name: Matrix4} }
export function makeMotion(r, cfg) {
  const origin = cfMatrix(r.origin);
  const n = r.carCount;
  if (r.track) {
    const sampler = new Sampler(r.track);
    if (r.kind === 'karts') {
      const T = cfg.duration ?? 34;
      const L = sampler.length;
      const amp = [], freq = [], phase = [];
      let seed = 42;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        amp.push(5 + rnd() * 10);
        freq.push(1 + Math.floor(rnd() * 3));
        phase.push(rnd() * TAU);
      }
      return {
        duration: T,
        sampler,
        pose(t) {
          const u = Math.min(1, Math.max(0, t / T));
          const base = 2 * L * (u - Math.sin(TAU * u) / TAU);
          const env = Math.sin(Math.PI * u) ** 2;
          const cars = [];
          for (let i = 0; i < n; i++) {
            const s = -i * r.carSpacing + base + amp[i] * env * Math.sin(TAU * freq[i] * u + phase[i]) - amp[i] * env * Math.sin(phase[i]);
            const lane = ((i + 1) % 2 === 0 ? 3 : -3) + 1.2 * env * Math.sin(TAU * 3 * u + i + 1);
            cars.push(sampler.matrixAt(s).multiply(TR(lane, 0, 0)));
          }
          return { cars, extras: {} };
        },
      };
    }
    return {
      duration: r.duration,
      sampler,
      pose(t) {
        const s = sampler.distanceAt(t);
        const cars = [];
        for (let i = 0; i < n; i++) cars.push(sampler.matrixAt(s - i * r.carSpacing));
        return { cars, extras: {} };
      },
    };
  }
  if (r.kind === 'droptower') {
    const T = r.duration, H = 150, g = 45, fallTo = 60;
    const tFall = Math.sqrt(2 * (H - fallTo) / g);
    const vFall = g * tFall;
    const decel = vFall * vFall / (2 * (fallTo - 3));
    const tBrake = vFall / decel;
    const tTop = 30, tHold = 34, tLand = tHold + tFall + tBrake;
    const height = (t) => {
      if (t < 3) return 0;
      if (t < tTop) return H * smoothstep((t - 3) / (tTop - 3));
      if (t < tHold) return H;
      if (t < tHold + tFall) { const k = t - tHold; return H - 0.5 * g * k * k; }
      if (t < tLand) { const k = t - tHold - tFall; return fallTo - (vFall * k - 0.5 * decel * k * k); }
      if (t < tLand + 3) return 3 * (1 - smoothstep((t - tLand) / 3));
      return 0;
    };
    return {
      duration: T,
      pose(t) {
        const rot = TAU * smoothstep((t - 3) / (tTop - 3));
        return { cars: [mul(origin.clone(), TR(0, 4 + height(t), 0), RY(rot))], extras: {} };
      },
    };
  }
  if (r.kind === 'carousel') {
    const T = r.duration, ramp = 6, omega = TAU * 3 / (T - ramp);
    return {
      duration: T,
      pose(t) {
        const th = rampAngle(t, T, ramp, omega);
        const cars = [];
        for (let i = 1; i <= n; i++) {
          const phi = TAU * (i - 1) / n;
          const bob = 1.1 * Math.sin(3 * th + i * 1.7);
          const rad = i % 2 === 0 ? 10 : 14;
          cars.push(mul(origin.clone(), RY(th + phi), TR(rad, 4.6 + bob, 0)));
        }
        return { cars, extras: { Platform: mul(origin.clone(), RY(th)) } };
      },
    };
  }
  if (r.kind === 'spinner') {
    const T = r.duration, ramp = 5, wP = TAU * 2 / (T - ramp), wC = TAU * 9 / (T - ramp);
    return {
      duration: T,
      pose(t) {
        const th = rampAngle(t, T, ramp, wP);
        const spin = rampAngle(t, T, ramp, wC);
        const cars = [];
        for (let i = 1; i <= n; i++) {
          const phi = TAU * (i - 1) / n;
          const dir = i % 2 === 0 ? 1 : -1;
          cars.push(mul(origin.clone(), RY(th + phi), TR(11, 2, 0), RY(spin * dir)));
        }
        return { cars, extras: { Platform: mul(origin.clone(), RY(th)) } };
      },
    };
  }
  // pendulum
  const T = r.duration, period = 6.4, maxA = 115 * Math.PI / 180;
  const pivot = mul(origin.clone(), TR(0, 34, 0));
  const spinOmega = TAU * 3 / (T - 2 - 6);
  return {
    duration: T,
    pose(t) {
      let env;
      if (t < 2) env = 0;
      else if (t < 20) env = (t - 2) / 18;
      else if (t < 34) env = 1;
      else if (t < 44) env = 1 - (t - 34) / 10;
      else env = 0;
      const phi = maxA * env * Math.sin(TAU * Math.max(t - 2, 0) / period);
      const spin = rampAngle(t - 2, T - 2, 6, spinOmega);
      const arm = mul(pivot.clone(), RZ(phi));
      return { cars: [mul(arm.clone(), TR(0, -28, 0), RY(spin))], extras: { Arm: arm } };
    },
  };
}

// ------------------------------------------------------------ restraints
// Lap bars hinge at the floor in front of the seat; shoulder harnesses
// hinge above the seat back. Angle 0 = closed over the rider.
export const RESTRAINT = {
  lapbar: { hinge: [0, -2.1, -1.5], open: -0.95 },
  harness: { hinge: [0, 1.25, 0.6], open: 1.9 },
};

function colored(g, rgb) {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
}

function joinGeos(list) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const arrays = list.map((g) => g.getAttribute(name).array);
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const buf = new Float32Array(total);
    let o = 0;
    for (const a of arrays) { buf.set(a, o); o += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(buf, name === 'uv' ? 2 : 3));
  }
  out.computeBoundingSphere();
  return out;
}

// a tube from a to b (hinge-local)
function rod(a, b, r, rgb) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 8);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return colored(g, rgb);
}

const restraintGeos = {};
export function restraintGeometry(kind) {
  if (restraintGeos[kind]) return restraintGeos[kind];
  const steel = [0.72, 0.74, 0.78], pad = [0.05, 0.05, 0.06], yellow = [0.95, 0.72, 0.1];
  let parts;
  if (kind === 'lapbar') {
    // two arms up from the floor hinge to a padded bar across the lap
    const top = [0, 1.48, 0.88];
    const padG = new THREE.CylinderGeometry(0.17, 0.17, 1.55, 12);
    padG.rotateZ(Math.PI / 2);
    padG.translate(...top);
    parts = [
      rod([-0.72, 0, 0], [-0.72, top[1], top[2]], 0.075, steel),
      rod([0.72, 0, 0], [0.72, top[1], top[2]], 0.075, steel),
      rod([-0.72, 0, 0], [0.72, 0, 0], 0.09, steel),
      colored(padG, pad),
    ];
  } else {
    // two padded shoulder bars down to a chest plate, on a yellow yoke
    const mid = [0, -0.5, -0.5], low = [0, -1.6, -0.97];
    parts = [];
    for (const x of [-0.32, 0.32]) {
      parts.push(rod([x, 0, 0], [x, mid[1], mid[2]], 0.13, pad));
      parts.push(rod([x, mid[1], mid[2]], [x, low[1], low[2]], 0.13, pad));
    }
    parts.push(rod([-0.55, 0.05, 0.05], [0.55, 0.05, 0.05], 0.12, yellow));
    const plate = new THREE.BoxGeometry(0.95, 0.55, 0.26);
    plate.rotateX(0.35);
    plate.translate(0, low[1] + 0.05, low[2] - 0.02);
    parts.push(colored(plate, pad));
  }
  restraintGeos[kind] = joinGeos(parts);
  return restraintGeos[kind];
}

// --------------------------------------------------------------- visuals
export class RideVisuals {
  constructor(scene, data, guestFactory) {
    this.scene = scene;
    this.data = data;
    this.guestFactory = guestFactory;
    this.rides = new Map();
    for (const r of data.rides) {
      const cfg = data.config.Rides.find((c) => c.id === r.id);
      const motion = makeMotion(r, cfg);
      const cars = r.cars.map((car) => {
        const g = new THREE.Group();
        g.matrixAutoUpdate = false;
        g.add(buildModel(car.parts, data.materials, { detail: false }));
        g.matrix.copy(cfMatrix(car.pivot));
        scene.add(g);
        return g;
      });
      const extras = {};
      for (const [name, ex] of Object.entries(r.extras)) {
        const g = new THREE.Group();
        g.matrixAutoUpdate = false;
        g.add(buildModel(ex.parts, data.materials, { detail: false }));
        g.matrix.copy(cfMatrix(ex.pivot));
        scene.add(g);
        extras[name] = g;
      }
      const seats = r.seats.map((list) => list.map((c) => cfMatrix(c)));
      // lap bars / harnesses on every seat, starting open
      const kind = r.crew?.restraint;
      const restraints = [];
      if (RESTRAINT[kind]) {
        const spec = RESTRAINT[kind];
        const geo = restraintGeometry(kind);
        const mat = material('metal');
        seats.forEach((list, ci) => {
          restraints[ci] = list.map((seat) => {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.matrixAutoUpdate = false;
            mesh.castShadow = true;
            const base = seat.clone().multiply(new THREE.Matrix4().makeTranslation(...spec.hinge));
            cars[ci].add(mesh);
            const b = { mesh, base, angle: spec.open, target: spec.open, open: spec.open, closed: false };
            this.poseRestraint(b);
            return b;
          });
        });
      }
      this.rides.set(r.id, { r, cfg, motion, cars, extras, seats, restraints, restraint: kind || 'none', guests: [], ridersKey: '', lastT: -1, poses: null });
    }
  }

  get(id) {
    return this.rides.get(id);
  }

  // riders: [{ car, seat, npc: seed } | { car, seat, player: true }]
  setRiders(id, riders) {
    const v = this.rides.get(id);
    const key = riders.map((x) => `${x.car}:${x.seat}:${x.npc ?? 'p'}`).join(',');
    if (key === v.ridersKey) return;
    v.ridersKey = key;
    for (const g of v.guests) g.parent?.remove(g);
    v.guests = [];
    const thrill = v.cfg.thrill >= 4;
    for (const x of riders) {
      if (x.player) continue;
      const seat = v.seats[x.car - 1]?.[x.seat - 1];
      const car = v.cars[x.car - 1];
      if (!seat || !car) continue;
      const g = this.guestFactory(x.npc, thrill && x.npc % 2 === 0 ? 'sitcheer' : 'sit');
      g.matrixAutoUpdate = false;
      g.matrix.copy(seat);
      car.add(g);
      v.guests.push(g);
    }
  }

  // Pose a ride at time t (0 = resting in the station).
  pose(id, t, far) {
    const v = this.rides.get(id);
    if (t === 0 && v.lastT === 0) return v.poses;
    if (far && t !== 0 && (this.frame % 3) !== 0 && v.poses) return v.poses;
    const p = v.motion.pose(t);
    p.cars.forEach((m, i) => {
      const car = v.cars[i];
      if (car) {
        car.matrix.copy(m);
        car.matrixWorldNeedsUpdate = true;
      }
    });
    for (const [name, m] of Object.entries(p.extras)) {
      const g = v.extras[name];
      if (g) {
        g.matrix.copy(m);
        g.matrixWorldNeedsUpdate = true;
      }
    }
    v.lastT = t;
    v.poses = p;
    return p;
  }

  poseRestraint(b) {
    b.mesh.matrix.copy(b.base).multiply(new THREE.Matrix4().makeRotationX(b.angle));
    b.mesh.matrixWorldNeedsUpdate = true;
  }

  // close (true) or open (false) one seat's restraint; returns whether it changed
  setRestraint(id, car, seat, closed) {
    const b = this.rides.get(id)?.restraints[car - 1]?.[seat - 1];
    if (!b || b.closed === closed) return false;
    b.closed = closed;
    b.target = closed ? 0 : b.open;
    return true;
  }

  restraintClosed(id, car, seat) {
    const b = this.rides.get(id)?.restraints[car - 1]?.[seat - 1];
    return b ? b.closed : true;
  }

  // set every restraint on a ride at once (snap: no animation)
  setAllRestraints(id, closed, snap = false) {
    const v = this.rides.get(id);
    for (const list of v.restraints) {
      for (const b of list || []) {
        b.closed = closed;
        b.target = closed ? 0 : b.open;
        if (snap) { b.angle = b.target; this.poseRestraint(b); }
      }
    }
  }

  // swing restraints toward their targets
  animateRestraints(dt) {
    for (const v of this.rides.values()) {
      for (const list of v.restraints) {
        for (const b of list || []) {
          if (b.angle === b.target) continue;
          const step = dt * 3.2;
          const d = b.target - b.angle;
          b.angle = Math.abs(d) <= step ? b.target : b.angle + Math.sign(d) * step;
          this.poseRestraint(b);
        }
      }
    }
  }

  seatMatrix(id, car, seat) {
    const v = this.rides.get(id);
    const carM = v.cars[car - 1]?.matrix;
    const s = v.seats[car - 1]?.[seat - 1];
    if (!carM || !s) return null;
    return carM.clone().multiply(s);
  }
}
