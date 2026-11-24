// Natural Kingdom's rides: the Savanna Trek Safari (open-air trucks on a
// dirt road through the savanna and its herds), Cheetah Chase (a fast
// family coaster along the savanna's edge), the River Safari (launches up a
// jungle river past crocodiles, gorillas, a tiger and a temple) and Raptor
// Run (a coaster round Primeval Valley's volcano, with a tyrant waiting at
// the bottom of the valley). Each is built by trackRide(): the track, the
// station (platform, canopy, crew), the queue and the ride's entry.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { animalKit } from './nkanimals.js';

const G = 0.02;
const GOLD = 0xf0b030, WOOD = 0x6a4a2a, THATCH = 0xc8a050, INK = 0x1a1410;
const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];

// ------------------------------------------------------------ the builder
export function trackRide(data, spec) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.dynamicSigns = data.dynamicSigns || [];
  data.staffSpots = data.staffSpots || [];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const track = makeTrack(spec.circuit);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), R = new THREE.Vector3(), F = new THREE.Vector3();
  const L = track.length;
  const samples = [];
  for (let s = 0; s < L; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  const grid = new Map();
  for (const f of samples) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  const env = spec.env || { half: 2.2, below: 2, above: 5 };
  // clear of the cars (env: their half width, and how far below and above the track they reach)
  const clearOf = (size, pos, pad = 1.2) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < env.half + pad && pos[1] + ey > y - env.below && pos[1] - ey < y + env.above) return false;
    }
    return true;
  };
  const tAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best];
  };

  // ---- steel supports: a column under the track and a cap across it, where nothing else passes
  let supports = 0;
  if (spec.supports) {
    const col = spec.supports.color ?? 0x5a5a60;
    for (let s = 3; s < L - 3; s += 5) {
      sampler.matrixAt(s, m4);
      P.setFromMatrixPosition(m4);
      R.setFromMatrixColumn(m4, 0); R.y = 0; R.normalize();
      const top = P.y - 1.9;
      if (top - G < 2.2) continue;
      if (near(P.x, P.z).some(([tx, ty, tz, c]) => Math.abs(c - s) > 14 && ty < top + 6 && ty > G - 2 && Math.hypot(tx - P.x, tz - P.z) < 3.8)) continue;
      add([0.9, top - G, 0.9], [P.x, (top + G) / 2, P.z], col, 'Metal', { collide: 1, shape: 5 });
      add([3.2, 0.5, 0.7], [P.x, top - 0.2, P.z], col, 'Metal', { collide: 0, yaw: Math.atan2(-R.z, R.x) });
      supports++;
    }
  }

  // ---- the station: a platform beside the train at rest, a canopy, the crew's posts
  const st = spec.station;
  const rest = [];
  for (let k = 0; k < spec.cars; k++) {
    sampler.matrixAt(-k * spec.spacing, m4);
    P.setFromMatrixPosition(m4);
    R.setFromMatrixColumn(m4, 0); R.y = 0; R.normalize();
    F.setFromMatrixColumn(m4, 2).multiplyScalar(-1); F.y = 0; F.normalize();
    rest.push({ p: P.clone(), r: R.clone(), f: F.clone() });
  }
  const front = rest[0], back = rest[rest.length - 1];
  const side = st.side; // +1: on the cars' right
  const off = st.carHalf + st.width / 2;
  const along = front.f.clone();
  const p0 = front.p.clone().addScaledVector(along, spec.spacing * 0.6 + (st.lead || 0)), p1 = back.p.clone().addScaledVector(along, -spec.spacing * 0.6);
  const mid = p0.clone().lerp(p1, 0.5).addScaledVector(front.r, side * off);
  const plen = p0.distanceTo(p1);
  const yaw = Math.atan2(along.x, along.z);
  const PY = st.y ?? 0.6; // the platform's top
  add([st.width, PY, plen], [mid.x, PY / 2, mid.z], st.color ?? 0xb8a888, 'Concrete', { yaw });
  add([0.3, 0.06, plen], [mid.x - front.r.x * side * (st.width / 2 - 0.3), PY + 0.03, mid.z - front.r.z * side * (st.width / 2 - 0.3)], 0xf2c418, 'SmoothPlastic', { collide: 0, yaw });
  // (an unseen rail along the platform's track edge: no stepping off in front of a train)
  data.hidden = data.hidden || [];
  if (st.guard !== false) data.hidden.push(add([0.3, 5, plen - 3], [mid.x - front.r.x * side * (st.width / 2 + 0.2), PY + 2.5, mid.z - front.r.z * side * (st.width / 2 + 0.2)], INK, 'SmoothPlastic', { yaw }));
  // the canopy over platform and train
  const cw = st.width + st.carHalf * 2 + 3, roofH = st.roof ?? 9;
  const cmid = p0.clone().lerp(p1, 0.5).addScaledVector(front.r, side * (st.width / 2 + 0.5));
  for (const t of [0.05, 0.5, 0.95]) {
    const q = p0.clone().lerp(p1, t).addScaledVector(front.r, side * (off + st.width / 2 - 0.3));
    box([0.6, roofH, 0.6], [q.x, G, q.z], WOOD, 'Wood', { collide: 0 });
  }
  add([cw, 0.6, plen + 2], [cmid.x, G + roofH + 0.3, cmid.z], spec.roofColor ?? THATCH, 'Fabric', { collide: 0, yaw });
  const signAt = p0.clone().lerp(p1, 0.5).addScaledVector(front.r, side * (off + st.width / 2 + 0.2));
  const face = (() => { const n = front.r.clone().multiplyScalar(side); return Math.abs(n.x) > Math.abs(n.z) ? (n.x > 0 ? 'Right' : 'Left') : (n.z > 0 ? 'Back' : 'Front'); })();
  sign(Math.abs(front.r.x * side) > 0.5 ? [0.3, 2.4, Math.min(plen, 22)] : [Math.min(plen, 22), 2.4, 0.3], [signAt.x, G + roofH + 2, signAt.z], INK, face, [[spec.name.toUpperCase(), 0, 0, 1, 1, spec.signColor ?? GOLD]], { glow: true });
  const stopYaw = Math.atan2(-front.r.x * side, -front.r.z * side) + Math.PI; // facing the train
  const post = (p, d) => p.clone().addScaledVector(front.r, side * (st.carHalf + 1.1 + (d || 0)));
  const stops = rest.map((c) => { const q = post(c.p); return cf(q.x, PY, q.z, stopYaw); });
  const stopCars = rest.map((_, k) => k + 1);
  const conP = post(p0, 1.4);
  const crew = {
    stopCars, stops, restraint: spec.restraint || 'lapbar', attendants: spec.cars > 2 ? 2 : 1,
    routes: spec.cars > 2 ? [stopCars.slice(0, Math.ceil(spec.cars / 2)), stopCars.slice(Math.ceil(spec.cars / 2))] : [stopCars],
    console: cf(conP.x, PY, conP.z, stopYaw), operator: cf(conP.x + along.x * 1.2, PY, conP.z + along.z * 1.2, stopYaw),
    homes: [post(p0.clone().lerp(p1, 0.3), 1.6), post(p0.clone().lerp(p1, 0.75), 1.6)].map((q) => cf(q.x, PY, q.z, stopYaw)),
    exit: (() => { const q = post(p1, 1); return cf(q.x, PY, q.z, yaw + Math.PI); })(),
  };
  box([1.4, 1.2, 1.4], [conP.x - along.x * 0.8, PY, conP.z - along.z * 0.8], 0x2a2a30, 'Metal', { collide: 0 });

  // ---- the queue: posts and rope rails both sides, the ride's sign and wait at its start
  const fwd = spec.queue;
  for (let k = 0; k < fwd.length - 1; k++) {
    const [a, b] = [fwd[k], fwd[k + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    const qy = spec.queueY ?? G;
    for (const sd of [-1, 1]) {
      const n = Math.max(1, Math.round(len / 3.2));
      for (let j = 0; j <= n; j++) box([0.25, 1.1, 0.25], [a[0] + ux * len * j / n - uz * sd * 1.5, qy, a[1] + uz * len * j / n + ux * sd * 1.5], WOOD, 'Wood');
      add([0.12, 0.12, len], [(a[0] + b[0]) / 2 - uz * sd * 1.5, qy + 1, (a[1] + b[1]) / 2 + ux * sd * 1.5], 0xc8a878, 'Fabric', { collide: 0, yaw: Math.atan2(ux, uz) });
    }
  }
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], spec.queueY ?? G);
  const [ex, ez] = fwd[0];
  box([0.35, 4, 0.35], [ex + 2.6, G, ez], WOOD, 'Wood', { collide: 0 });
  sign([0.3, 1.4, 6], [ex + 2.7, G + 4.6, ez], INK, 'Right', [[spec.name.toUpperCase(), 0, 0, 1, 1, spec.signColor ?? GOLD, 'GothamBold']], { glow: true });
  const waitPart = add([0.3, 1.1, 3.6], [ex + 2.9, G + 3.3, ez], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: spec.id });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: spec.land, seed: spec.id.length * 7, cf: cf(ex - 2.4, G, ez, 0) });

  // ---- the cars
  const cars = [], seats = [];
  for (let k = 0; k < spec.cars; k++) {
    sampler.matrixAt(-k * spec.spacing, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: spec.carParts(k, pp) });
    seats.push(spec.seatList(k));
  }
  const origin = spec.origin;
  const ride = {
    id: spec.id, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: spec.cars, carSpacing: spec.spacing, cars, seats,
    capacity: seats.reduce((n, l) => n + l.length, 0), queue: qpath, trackStyle: spec.style, extras: spec.extras || {}, extrasNames: spec.extrasNames || [], props: spec.props || [], crew,
    noExtended: true, ...(spec.rideExtra || {}),
  };
  data.rides.push(ride);
  const at = (x, z) => tAt(x, z) / ride.duration;
  data.config.Rides.push({
    id: spec.id, name: spec.name, land: spec.land, category: spec.category, thrill: spec.thrill, kind: spec.kind, carStyle: spec.carStyle,
    description: spec.description, baseWait: spec.baseWait, origin, entrance: [ex, 0, ez], exit: spec.exit, yaw: 0, layout: spec.id,
    cars: spec.cars, carSpacing: spec.spacing, colors: spec.colors, cues: spec.cues ? spec.cues(at) : [],
  });
  if (spec.line) data.staff.lines.greeter = [...(data.staff.lines.greeter || []), spec.line];
  return { ride, track, sampler, near, clearOf, tAt, at, supports, samples };
}

// ------------------------------------------------------------ the rides
export function buildNKRides(data, site) {
  const W = helpers(data);
  const { add } = W;
  const A = animalKit(data);
  data.trees = data.trees || [];
  data.terrain = data.terrain || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  const placeIf = (r, size, pos) => r.clearOf(size, pos, 2);
  const out = {};

  // ================================================================ Savanna Trek Safari
  {
    const C = (x, z, v) => [x, 1.0, z, v];
    const circuit = [
      C(445, 805, 2), C(465, 805, 5), C(490, 812, 9), C(520, 826, 11), C(548, 838, 11), C(578, 840, 11), C(610, 835, 11), C(645, 831, 11),
      C(680, 838, 11), C(715, 855, 11), C(740, 885, 11), C(752, 925, 11), C(748, 970, 11), C(730, 1010, 9), C(735, 1060, 9), C(755, 1105, 11),
      C(760, 1155, 11), C(745, 1205, 11), C(715, 1240, 11), C(670, 1258, 9), C(620, 1262, 9), C(570, 1250, 11), C(520, 1258, 11), C(470, 1250, 11),
      C(430, 1225, 11), C(405, 1185, 11), C(400, 1140, 11), C(410, 1095, 11), C(400, 1050, 11), C(385, 1010, 9), C(380, 965, 11), C(392, 920, 11),
      C(400, 880, 11), C(395, 845, 8), C(392, 822, 4), C(402, 810, 3), C(415, 805, 2.5), C(428, 805, 2.2),
    ];
    const truck = (k, pp) => {
      const parts = [
        pp(0, [5.2, 1.2, 11], [0, 1.4, 0], 0x6a7a3a, 'Metal'),
        pp(0, [5.4, 0.3, 11.2], [0, 0.75, 0], 0x2a2a2a, 'Metal'),
        ...[-4, 3.8].flatMap((z) => [-2.5, 2.5].map((x) => pp(2, [0.8, 1.6, 1.6], [x, 0.6, z], 0x1a1a1a, 'Rubber', [0, 0, 1, 0, 1, 0, -1, 0, 0]))),
        pp(0, [5, 2.2, 2.6], [0, 3, -4.2], 0x6a7a3a, 'Metal'),
        pp(0, [4.6, 1.2, 0.1], [0, 3.4, -5.52], 0x2a3a4a, 'Glass'),
        pp(0, [5.6, 0.25, 11.6], [0, 6.4, 0.2], 0xc8b07a, 'Fabric'),
        ...[-5, -1.6, 1.8, 5.2].flatMap((z) => [-2.6, 2.6].map((x) => pp(0, [0.2, 4.2, 0.2], [x, 4.3, z], 0x3a3a2a, 'Metal'))),
        pp(0, [5.2, 0.6, 0.2], [0, 2.4, -5.55], 0x1a1a1a, 'Metal'),
        pp(3, [0.6, 0.6, 0.2], [-1.8, 2.6, -5.6], 0xfff0c0, 'Neon'), pp(3, [0.6, 0.6, 0.2], [1.8, 2.6, -5.6], 0xfff0c0, 'Neon'),
      ];
      for (const z of [-1.6, 0.9, 3.4]) {
        parts.push(pp(0, [4.6, 0.3, 1], [0, 2.25, z], 0x8a5a2a, 'WoodPlanks'));
        parts.push(pp(0, [4.6, 1.1, 0.25], [0, 2.9, z + 0.6], 0x8a5a2a, 'WoodPlanks'));
      }
      return parts;
    };
    const seatList = () => [-1.6, 0.9, 3.4].flatMap((z) => [-1.5, 0, 1.5].map((x) => [x, 2.4 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
    // the hippos bob, an elephant swings its trunk, a lion turns its head (all while the truck's out)
    const extras = {}, extrasNames = [], props = [];
    const r = trackRide(data, {
      id: 'SavannaSafari', name: 'Savanna Trek Safari', land: 'SavannaReach', category: 'Family', thrill: 1, kind: 'tram', carStyle: 'tram',
      description: 'Climb aboard an open-air safari truck and ride out across Savanna Reach: past the ostriches and the giraffes on the plains, the elephants at the watering hole, a pride of lions on their rock, the wildebeest herd, the rhinos and the hippo pool - with your guide spotting all the way.',
      baseWait: 35, circuit, style: { style: 'road', width: 10, drop: 1.55, color: 0xa8865a, curbs: false }, cars: 2, spacing: 15,
      carParts: truck, seatList, env: { half: 3.4, below: 1, above: 7 }, restraint: 'none',
      station: { side: 1, carHalf: 2.9, width: 4.2, y: 0.6, roof: 9 }, origin: [580, 0, 1040],
      queue: [[372, 830], [372, 818], [392, 818], [392, 822], [376, 822], [376, 826], [404, 826], [424, 815]],
      exit: [462, 0, 815], colors: [0x6a7a3a, 0xc8b07a, 0xa8865a], line: 'The Savanna Trek Safari is boarding - the lions are up early!', extras, extrasNames, props,
    });
    out.safari = r;
    // the savanna's animals and trees, wherever the truck doesn't pass
    const herd = (fn, cx, cz, n, spread, s = 1, yawBase = 0) => {
      for (let k = 0; k < n; k++) {
        const x = cx + Math.cos(k * 2.4) * spread * ((k % 3) + 1) / 3, z = cz + Math.sin(k * 2.4) * spread * ((k % 3) + 1) / 3;
        if (!placeIf(r, [6, 6, 6], [x, 3, z])) continue;
        fn(x, G, z, yawBase + k * 0.9, s);
      }
    };
    herd(A.giraffe, 690, 900, 4, 18);
    herd(A.ostrich, 560, 875, 3, 12);
    herd(A.zebra, 620, 1000, 8, 30);
    herd(A.wildebeest, 560, 1200, 7, 28);
    herd(A.rhino, 455, 1150, 2, 10);
    herd(A.flamingo, 470, 975, 10, 10, 1, 1.2);
    // the watering hole, its elephants
    data.terrain.push({ kind: 'block', material: 'Water', cf: [690, -0.4, 1045, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [40, 1, 30] });
    for (const [x, z, yw] of [[668, 1030, 1.2], [700, 1068, -2.4]]) if (placeIf(r, [8, 8, 9], [x, 4, z])) A.elephant(x, G, z, yw);
    const tr = { name: 'ElephantTrunk' };
    if (placeIf(r, [8, 8, 9], [712, 4, 1028])) {
      A.elephant(712, G, 1028, Math.PI * 0.6, 1, undefined, false);
      // (its trunk is a moving part of its own)
      const trunk = [];
      const P2 = (lp, size, color) => trunk.push([0, ...size, ...lp, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, W.mi('SmoothPlastic'), 0, 0]);
      P2([0, -1.6, 0], [0.8, 3.2, 0.8], 0x6a6a68);
      P2([0, -3.4, -0.2], [0.6, 1.2, 0.6], 0x6a6a68);
      const c = Math.cos(Math.PI * 0.6), sn = Math.sin(Math.PI * 0.6);
      extras[tr.name] = { pivot: [712 + -5.1 * sn, G + 6, 1028 - 5.1 * c, c, 0, sn, 0, 1, 0, -sn, 0, c], parts: trunk };
      props.push({ name: tr.name, at: [712 + -5.1 * sn, G + 6, 1028 - 5.1 * c], kind: 'swing', axis: 'x', amp: 0.6, freq: 1.3 });
      extrasNames.push(tr.name);
    }
    // the hippo pool
    data.terrain.push({ kind: 'block', material: 'Water', cf: [448, -0.4, 1000, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [34, 1, 26] });
    for (const [x, z, yw] of [[440, 995, 0.6], [456, 1006, 2.4], [446, 1010, -1]]) A.hippo(x, -1.2, z, yw);
    // the lions' rock (a kopje) and its pride
    if (placeIf(r, [22, 10, 18], [640, 5, 1205])) {
      for (const [x, z, s] of [[640, 1205, 9], [652, 1200, 7], [632, 1214, 6]]) add([s * 2, s * 1.3, s * 1.8], [x, G + s * 0.4, z], 0x9a8a70, 'Slate', { shape: 3 });
      A.lion(640, G + 9.6, 1203, 0.8, 1, undefined, true);
      A.lioness(651, G + 7.6, 1197, 2.2);
      A.lion(628, G + 6.2, 1214, -0.6, 0.9, undefined, true);
    }
    // acacias, a baobab, termite mounds, grass tufts
    let n = 0;
    for (let k = 0; k < 80 && n < 26; k++) {
      const x = 420 + ((k * 53) % 100) / 100 * 340, z = 830 + ((k * 31) % 100) / 100 * 420;
      if (!placeIf(r, [14, 12, 12], [x, 6, z])) continue;
      if (Math.hypot(x - 690, z - 1045) < 30 || Math.hypot(x - 448, z - 1000) < 24) continue;
      site.placed.acacia(x, z, 0.9 + (k % 4) * 0.12);
      n++;
    }
    for (const [x, z] of [[520, 1050], [600, 930]]) if (placeIf(r, [8, 16, 8], [x, 8, z])) {
      add([5, 12, 5], [x, G + 6, z], 0x8a7058, 'Wood', { collide: 1, shape: 5 });
      add([12, 3, 12], [x, G + 13, z], 0x6a8a2a, 'Grass', { collide: 0, shape: 3 });
    }
    for (const [x, z] of [[480, 900], [700, 1150], [580, 1110], [650, 960]]) if (placeIf(r, [4, 8, 4], [x, 3, z])) {
      add([3.4, 6, 3.4], [x, G + 2.4, z], 0xb87a48, 'Slate', { collide: 0, shape: 3 });
      add([1.6, 4, 1.6], [x + 0.4, G + 6, z], 0xa86a38, 'Slate', { collide: 0, shape: 3 });
    }
  }

  // ================================================================ Cheetah Chase
  {
    const C = (x, h, z, v) => [x, h, z, v];
    const circuit = [
      C(486, 1.5, 730, 2), C(496, 1.6, 730, 3), C(504, 2.2, 730, 3.6), C(516, 6.5, 730, 3.5), C(530, 12, 730, 3.3), C(538, 12.6, 730, 3.4),
      C(548, 9, 730, 9), C(560, 2.5, 730, 15), C(574, 3, 731, 16.5), C(590, 7.5, 732, 14), C(606, 2.8, 731, 16.5), C(622, 6, 730, 15),
      C(638, 2.6, 730, 16.5), C(656, 3.2, 731, 16), C(672, 6.5, 733, 14), C(686, 3.4, 734, 15), C(700, 3.6, 740, 14), C(708, 4.2, 749, 13),
      C(706, 4.8, 759, 12.5), C(696, 5, 765, 12.5), C(682, 5, 767, 13), C(666, 2.5, 767, 16), C(650, 6.5, 767, 14.5), C(634, 2.5, 767, 16),
      C(618, 5.5, 766, 15), C(600, 2.4, 764, 16), C(584, 3.2, 760, 15), C(568, 2.6, 758, 14), C(552, 2.4, 760, 11), C(534, 2, 762, 7),
      C(512, 1.8, 762, 5), C(484, 1.6, 760, 4), C(466, 1.6, 754, 3.5), C(460, 1.5, 743, 3), C(466, 1.5, 733, 2.5), C(476, 1.5, 730, 2.2),
    ];
    const car = (k, pp) => {
      const body = k === 0 ? 0xe0a030 : 0xd89a28;
      const parts = [pp(0, [3, 0.8, 3.2], [0, 0.6, 0], 0x2a2a2a, 'Metal'), pp(0, [3, 1.2, 3.2], [0, 1.5, 0], body, 'SmoothPlastic')];
      for (const [x, z] of [[-0.9, -0.6], [0.8, 0.5], [-0.3, 1.1], [0.9, -1.2]]) parts.push(pp(3, [0.5, 0.2, 0.5], [x, 2.12, z], 0x2a1a0a, 'SmoothPlastic'));
      if (k === 0) { parts.push(pp(0, [2.2, 1.4, 1], [0, 2, -1.9], body, 'SmoothPlastic')); for (const sx of [-0.5, 0.5]) parts.push(pp(3, [0.4, 0.4, 0.2], [sx, 2.4, -2.45], 0x1a1a1a, 'SmoothPlastic')); }
      for (const x of [-0.7, 0.7]) { parts.push(pp(0, [1.1, 0.3, 1], [x, 1.9, 0.3], 0x1a1a1a, 'Fabric')); parts.push(pp(0, [1.1, 1.2, 0.25], [x, 2.5, 0.85], 0x1a1a1a, 'Fabric')); }
      return parts;
    };
    const r = trackRide(data, {
      id: 'CheetahChase', name: 'Cheetah Chase', land: 'SavannaReach', category: 'Family', thrill: 3, kind: 'coaster', carStyle: 'coaster',
      description: 'Run with the fastest animal on the savanna: a quick climb, then a low, fast chase along the edge of Savanna Reach - hills, a hairpin at the far end, and back flat out through the grass.',
      baseWait: 30, circuit, style: { style: 'steel', color: 0xd89a28 }, cars: 4, spacing: 3.4, supports: { color: 0x4a3a2a },
      carParts: car, seatList: () => [-0.7, 0.7].map((x) => [x, 1.9 + 1.3, 0.3, 1, 0, 0, 0, 1, 0, 0, 0, 1]), env: { half: 2, below: 2.2, above: 4.8 },
      station: { side: -1, carHalf: 1.8, width: 4, y: 0.6, roof: 8 }, origin: [600, 0, 748], restraint: 'lapbar',
      queue: [[440, 772], [440, 722], [452, 722], [452, 718], [442, 718], [442, 714], [466, 714], [466, 718], [458, 718], [458, 722], [476, 724]],
      exit: [500, 0, 716], colors: [0xd89a28, 0x2a1a0a, 0x4a3a2a], line: 'Cheetah Chase is open - can you keep up?',
      cues: (at) => [[at(560, 730), 'sparks', [0, 0.5, 0]]],
    });
    out.cheetah = r;
  }

  // ================================================================ River Safari
  {
    const C = (x, z, v) => [x, 1.0, z, v];
    const circuit = [
      C(-10, 920, 2), C(-30, 920, 4), C(-50, 930, 5.5), C(-62, 955, 5.5), C(-62, 990, 5.5), C(-68, 1030, 5.5), C(-62, 1072, 5.5), C(-44, 1105, 5.5),
      C(-14, 1122, 5.5), C(18, 1138, 5.5), C(50, 1152, 5.5), C(78, 1144, 5.5), C(92, 1115, 5.5), C(88, 1080, 5.5), C(96, 1046, 5.5), C(88, 1008, 5.5),
      C(70, 982, 5.5), C(60, 955, 5), C(50, 930, 4), C(38, 921, 3), C(22, 920, 2.5),
    ];
    const BOATS = 3;
    const boat = (k, pp) => {
      const hull = [0x2a6a8a, 0x8a3a2a, 0x3a7a3a][k % 3];
      const parts = [
        pp(0, [4.4, 1.4, 9], [0, 0.9, 0], hull, 'WoodPlanks'),
        pp(1, [4.4, 1.4, 2], [0, 0.9, -5.5], hull, 'WoodPlanks', [-1, 0, 0, 0, 1, 0, 0, 0, -1]),
        pp(0, [4.6, 0.25, 9.4], [0, 1.7, 0], 0xd8c8a0, 'WoodPlanks'),
        pp(0, [4.2, 0.2, 9.6], [0, 5, 0.3], 0xe8dcc0, 'Fabric'),
        ...[-3.8, 4.2].flatMap((z) => [-2, 2].map((x) => pp(0, [0.18, 3.3, 0.18], [x, 3.4, z], 0x3a2a1a, 'Wood'))),
      ];
      for (const z of [-2.4, 0, 2.4]) { parts.push(pp(0, [3.6, 0.3, 0.9], [0, 2.05, z], 0x6a4a2a, 'WoodPlanks')); parts.push(pp(0, [3.6, 0.9, 0.2], [0, 2.5, z + 0.5], 0x6a4a2a, 'WoodPlanks')); }
      return parts;
    };
    const seatList = () => [-2.4, 0, 2.4].flatMap((z) => [-1.1, 1.1].map((x) => [x, 2.2 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
    const r = trackRide(data, {
      id: 'RiverSafari', name: 'River Safari', land: 'RainforestHollow', category: 'Family', thrill: 1, kind: 'flume', carStyle: 'boat',
      description: 'Take a safari launch up the river into Rainforest Hollow: crocodiles sunning on the bank, monkeys in the trees, a waterfall, the ruins of an old temple, a tiger watching from its rock and a family of gorillas in the clearing.',
      baseWait: 30, circuit, style: { style: 'flume' }, cars: BOATS, spacing: 11, carParts: boat, seatList, env: { half: 3.4, below: 1.6, above: 6 }, restraint: 'none',
      station: { side: 1, carHalf: 3.7, width: 4, y: 0.6, roof: 9 }, origin: [10, 0, 1030], rideExtra: { bob: 0.12 },
      queue: [[30, 902], [30, 906], [6, 906], [6, 909.5], [40, 909.5], [24, 913]],
      exit: [-30, 0, 905], colors: [0x2a6a8a, 0xe8dcc0, 0x3a7a3a], line: 'The River Safari is boarding - keep an eye out for crocodiles!',
    });
    out.river = r;
    // the jungle: crocodiles on the bank, monkeys, a waterfall, the temple, a tiger, gorillas
    for (const [x, z, yw] of [[-48, 990, 1.4], [-50, 1012, 1.7], [-74, 1050, -1.5]]) if (placeIf(r, [3, 2, 7], [x, 1, z])) A.crocodile(x, G, z, yw);
    if (placeIf(r, [16, 18, 10], [-84, 9, 1072])) {
      add([10, 18, 14], [-86, G + 9, 1072], 0x6a6a60, 'Slate');
      add([0.4, 16, 6], [-80.6, G + 9, 1072], 0x9ad0e8, 'Glass', { collide: 0, trans: 0.4 });
    }
    for (const [x, z] of [[-20, 1100], [6, 1112]]) if (placeIf(r, [8, 12, 8], [x, 6, z])) {
      add([7, 9, 7], [x, G + 4.5, z], 0x8a8a70, 'Slate');
      add([8, 2, 8], [x, G + 10, z], 0x6a7a50, 'Slate', { collide: 0 });
      add([3, 3, 0.4], [x, G + 4, z + 3.6], 0x2a2a20, 'Slate', { collide: 0 });
    }
    if (placeIf(r, [12, 8, 10], [66, 4, 1178])) {
      add([12, 6, 10], [66, G + 3, 1178], 0x7a7a6a, 'Slate', { shape: 3 });
      A.tiger(66, G + 5.2, 1176, Math.PI * 1.1);
    }
    for (const [x, z, yw] of [[60, 1080, -1.6], [56, 1066, -1.2], [64, 1094, -2]]) if (placeIf(r, [4, 6, 4], [x, 3, z])) A.gorilla(x, G, z, yw, x === 56 ? 0.7 : 1);
    // the jungle's trees, wherever the boats don't pass
    let n = 0;
    for (let k = 0; k < 260 && n < 80; k++) {
      const x = -82 + ((k * 37) % 100) / 100 * 192, z = 862 + ((k * 61) % 100) / 100 * 420;
      if (z < 935 && x > -35) continue; // (the plaza, the queue and the station)
      if (!placeIf(r, [8, 12, 8], [x, 6, z])) continue;
      data.trees.push({ leaf: k % 3 ? 0x2a7a2a : 0x3a8a3a, kind: k % 3 ? 'palm' : 'round', s: 1 + ((k * 7) % 6) / 10, pos: [x, 0, z] });
      if (k % 9 === 0) A.monkey(x + 1.5, G + 7 + (k % 4), z, k);
      n++;
    }
    add([200, 0.08, 400], [10, G + 0.04, 1080], 0x3a6a2a, 'Grass', { collide: 0 });
  }

  // ================================================================ Raptor Run
  {
    const C = (x, h, z, v) => [x, h, z, v];
    const circuit = [
      C(200, 1.5, 1035, 2), C(212, 1.6, 1035, 3), C(226, 2, 1040, 3.5), C(234, 3, 1050, 3.6), C(236, 10, 1066, 3.5), C(236, 20, 1084, 3.4),
      C(236, 30, 1102, 3.2), C(236, 31.5, 1112, 3.4), C(236, 28, 1120, 8), C(238, 14, 1135, 17), C(242, 4, 1150, 22), C(256, 3.5, 1168, 22),
      C(280, 8, 1178, 19), C(305, 14, 1178, 15), C(322, 14, 1192, 14), C(325, 10, 1215, 16), C(315, 6, 1240, 18), C(295, 4, 1262, 19),
      C(265, 6, 1276, 18), C(235, 12, 1278, 15), C(205, 6, 1275, 18), C(175, 4, 1265, 19), C(150, 6, 1245, 18), C(138, 10, 1220, 16),
      C(136, 14, 1195, 14), C(138, 8, 1160, 17), C(146, 4, 1120, 19), C(150, 6, 1090, 17), C(160, 3, 1065, 12), C(168, 2.2, 1052, 6),
      C(172, 1.8, 1041, 3), C(180, 1.6, 1036, 2.5),
    ];
    const car = (k, pp) => {
      const parts = [pp(0, [3, 0.8, 3.2], [0, 0.6, 0], 0x2a2a2a, 'Metal'), pp(0, [3, 1.3, 3.2], [0, 1.55, 0], 0x3a6a2a, 'SmoothPlastic')];
      if (k === 0) { parts.push(pp(1, [2.6, 1.6, 1.6], [0, 2.1, -2.1], 0x3a6a2a, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1])); parts.push(pp(3, [0.4, 0.4, 0.2], [-0.6, 2.6, -2.9], 0xf0c020, 'Neon')); parts.push(pp(3, [0.4, 0.4, 0.2], [0.6, 2.6, -2.9], 0xf0c020, 'Neon')); }
      for (let j = -1; j <= 1; j++) parts.push(pp(0, [0.15, 0.4, 0.4], [0, 2.3, j * 1], 0x2a4a1a, 'SmoothPlastic'));
      for (const z of [-0.6, 0.9]) for (const x of [-0.7, 0.7]) { parts.push(pp(0, [1.1, 0.3, 0.9], [x, 1.95, z], 0x1a1a1a, 'Fabric')); parts.push(pp(0, [1.1, 1.1, 0.22], [x, 2.5, z + 0.45], 0x1a1a1a, 'Fabric')); }
      return parts;
    };
    const seatList = () => [-0.6, 0.9].flatMap((z) => [-0.7, 0.7].map((x) => [x, 1.95 + 0.15 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
    const extras = {}, extrasNames = [], props = [];
    const r = trackRide(data, {
      id: 'RaptorRun', name: 'Raptor Run', land: 'PrimevalValley', category: 'Thrill', thrill: 4, kind: 'coaster', carStyle: 'coaster',
      description: 'The volcano is rumbling and the dinosaurs are loose. Climb 31 studs above Primeval Valley, dive past the raptors, race round the far side of the volcano - and look out for the tyrant at the bottom of the valley.',
      baseWait: 50, circuit, style: { style: 'steel', color: 0x3a6a2a }, cars: 5, spacing: 3.4, supports: { color: 0x5a4a3a },
      carParts: car, seatList, env: { half: 2, below: 2.2, above: 4.8 }, restraint: 'lapbar',
      station: { side: -1, carHalf: 1.8, width: 4, y: 0.6, roof: 8, lead: 2 }, origin: [230, 0, 1160], extras, extrasNames, props,
      queue: [[190, 1020], [190, 1024], [176, 1024], [176, 1027], [204, 1027], [204, 1029], [196, 1030]],
      exit: [218, 0, 1026], colors: [0x3a6a2a, 0xf0c020, 0xc8501e], line: 'Raptor Run is open - the tyrant is hungry!',
      cues: (at) => [[at(242, 1150), 'sparks', [0, 0.5, 0]]],
    });
    out.raptor = r;
    // the tyrant: lunges at the train at the bottom of the valley
    const parts = [];
    A.tyrant(0, 0, 0, 0, 1, parts);
    extras.Tyrant = { pivot: [292, G, 1240, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name: 'Tyrant', at: [292, G, 1240], kind: 'lunge', dir: [0.45, 0.89], reach: 5, period: 6 });
    extrasNames.push('Tyrant');
    // the volcano, glowing at the top, smoking
    const V = [190, 1192];
    for (const [r0, h, c] of [[30, 14, 0x5a4a40], [22, 26, 0x4a3a32], [14, 36, 0x3a2e28]]) add([r0 * 2, h, r0 * 2], [V[0], G + h / 2, V[1]], c, 'Slate', { shape: 5 });
    add([10, 1, 10], [V[0], G + 36.4, V[1]], 0xff5a10, 'Neon', { collide: 0, shape: 5 });
    for (let k = 0; k < 6; k++) { const a = k * 1.05; add([1.2, 14, 1.2], [V[0] + Math.cos(a) * 15, G + 26, V[1] + Math.sin(a) * 15], 0xff6a20, 'Neon', { collide: 0, rot: RY(a) }); }
    data.tags.SteamVent.push([V[0], G + 37, V[1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    data.hauntLights.push([V[0], G + 30, V[1], 0xff6020]);
    // dinosaurs wherever the train doesn't pass
    for (const [fn, x, z, yw, s] of [[A.longneck, 290, 1120, 2.6, 1], [A.triceratops, 160, 1140, 1.2, 1], [A.raptor, 260, 1215, -0.6, 1.2], [A.raptor, 270, 1228, -0.2, 1.1], [A.raptor, 150, 1185, 1.6, 1.2], [A.triceratops, 300, 1095, -2.2, 0.9], [A.longneck, 125, 1270, 0.6, 0.8]]) {
      if (placeIf(r, [8 * s, 10 * s, 12 * s], [x, 5 * s, z])) fn(x, G, z, yw, s);
    }
    // ferns and cycads, fossils by the path
    for (let k = 0; k < 60; k++) {
      const x = 126 + ((k * 41) % 100) / 100 * 205, z = 1045 + ((k * 67) % 100) / 100 * 240;
      if (Math.hypot(x - V[0], z - V[1]) < 34 || !placeIf(r, [6, 8, 6], [x, 4, z])) continue;
      if (k % 2) data.trees.push({ leaf: 0x4a7a2a, kind: 'palm', s: 0.7 + (k % 3) * 0.2, pos: [x, 0, z] });
      else for (let j = 0; j < 5; j++) add([0.3, 2.6, 1.6], [x, G + 1.2, z], 0x3a7a2a, 'Grass', { collide: 0, rot: RY(j * 1.25 + k) });
    }
    add([210, 0.08, 255], [230, G + 0.04, 1168], 0x6a5a40, 'Ground', { collide: 0 });
  }
  return out;
}
