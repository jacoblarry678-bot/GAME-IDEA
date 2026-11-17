// Flying Fire: a wooden coaster that goes upside down, in a timber clearing
// north of the Blitz canyon (through a gate in the canyon's north wall, by
// Ravage's gate). Legend in the logging camp says a firebird nests on the
// ridge; the coaster is the Firebird's flight: up the chain lift, a steep
// wooden drop, a zero-g roll, airtime hills up the far side, a barrel roll
// at the turnaround, and an S-bend run home under the first drop - all on
// a classic timber structure.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'FlyingFire';
const SITE = { x0: -796, x1: -598, z0: -400, z1: -160 };
const GATE = { x0: -611, x1: -601 }; // in the Blitz canyon's north wall (z -402)
const G = 0.1;
const CARS = 6, SPACING = 3.4;
const FIRE = 0xff5a1a, EMBER = 0xffb020, CRIMSON = 0xb01818, TIMBER = 0x7c5638, DARKWOOD = 0x4a3222, CHAR = 0x1c1a18, CREAM = 0xf4e8d0;

const CIRCUIT = [
  [-630, 2, -350, 2],
  // out of the lodge, round to the west and up the chain lift
  [-630, 2, -336, 4], [-632, 2.2, -324, 4], [-640, 2.6, -317, 4], [-650, 3.5, -316, 3.5], [-660, 9.5, -316, 3.5], [-690, 28, -316, 3.5], [-700, 33.5, -316, 3],
  // the crest and the first drop
  [-708, 34.5, -316, 3.5], [-716, 31, -316, 8], [-728, 18, -316, 18], [-740, 6, -316, 24], [-752, 2.5, -316, 26],
  // the zero-g roll, west
  [-764, 8, -316, 24], [-774, 13, -316, 22], [-784, 13, -315, 22],
  // round to the north, two airtime hills
  [-790, 10, -304, 23], [-790, 8, -288, 24], [-786, 6, -272, 25], [-786, 16, -252, 20], [-786, 6, -232, 25], [-786, 13, -212, 22], [-784, 8, -192, 24],
  // the turnaround, and the barrel roll, east
  [-774, 10, -176, 22], [-756, 14, -170, 20], [-740, 16, -172, 19], [-722, 16, -174, 19], [-708, 12, -180, 21],
  // south: an S-bend run, under the first drop
  [-700, 8, -194, 23], [-702, 5, -214, 24], [-714, 12, -234, 21], [-716, 6, -256, 24], [-706, 10, -276, 22], [-714, 4, -296, 24], [-718, 4, -336, 24],
  // round to the east, the brakes, and north into the lodge
  [-708, 5, -360, 22], [-684, 6, -374, 20], [-660, 5, -384, 14], [-642, 3, -390, 7], [-632, 2.2, -384, 4], [-630, 2, -368, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

// the firebird (the park's own design): a long-necked bird of flame with
// swept-back wings of layered feathers, local parts facing -z, scaled by s
function firebird(pp, s = 1) {
  const P = (shape, size, pos, color, mat, rot) => pp(shape, size.map((v) => v * s), pos.map((v) => v * s), color, mat, rot);
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const parts = [
    P(3, [2.4, 2.2, 5], [0, 0, 0.4], CRIMSON, 'SmoothPlastic'),
    P(0, [1, 1, 3], [0, 1.2, -2.6], CRIMSON, 'SmoothPlastic', RX(-0.6)),
    P(3, [1.3, 1.2, 1.6], [0, 2.4, -3.8], FIRE, 'SmoothPlastic'),
    P(1, [0.5, 0.5, 1.4], [0, 2.3, -5.1], EMBER, 'SmoothPlastic', RX(Math.PI / 2)),
    P(3, [0.3, 0.3, 0.3], [-0.5, 2.7, -4.2], 0xffffff, 'Neon'), P(3, [0.3, 0.3, 0.3], [0.5, 2.7, -4.2], 0xffffff, 'Neon'),
    // the crest of flame on its head
    ...[0, 1, 2].map((k) => P(1, [0.3, 1.4 - k * 0.3, 0.8], [0, 3.4 - k * 0.2, -3.6 + k * 0.6], [EMBER, FIRE, CRIMSON][k], 'Neon', RX(-0.5))),
    // tail feathers trailing back
    ...[-1, 0, 1].map((k) => P(0, [0.6, 0.2, 6 - Math.abs(k)], [k * 0.7, -0.2, 5], [FIRE, EMBER, FIRE][k + 1], 'Neon', [Math.cos(k * 0.25), 0, Math.sin(k * 0.25), 0, 1, 0, -Math.sin(k * 0.25), 0, Math.cos(k * 0.25)])),
  ];
  // the wings: layered feathers sweeping up and back
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const a = side * (0.35 + k * 0.1);
      parts.push(P(0, [7 - k * 0.6, 0.25, 1.4], [side * (4 - k * 0.2), 1.2 + k * 0.35, -0.6 + k * 0.7], [CRIMSON, FIRE, FIRE, EMBER, EMBER, 0xfff0a0][k], k < 2 ? 'SmoothPlastic' : 'Neon', RZ(a)));
    }
  }
  return parts;
}

export function buildFlyingFire(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const place = (parts, at, yaw) => {
    const R = new THREE.Matrix4().makeRotationY(yaw);
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const q of parts) {
      const Lm = new THREE.Matrix4().set(q[7], q[8], q[9], 0, q[10], q[11], q[12], 0, q[13], q[14], q[15], 0, 0, 0, 0, 1);
      m.multiplyMatrices(R, Lm);
      const e = m.elements;
      v.set(q[4], q[5], q[6]).applyMatrix4(R);
      data.static.push([q[0], q[1], q[2], q[3], at[0] + v.x, at[1] + v.y, at[2] + v.z, e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10], q[16], q[17], 0, 0]);
    }
  };

  // ======== the site: a timber clearing, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x6a5a3e, 'Ground');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, -402, -798, -158);
  wallSeg(-798, -158, -596, -158);
  // the gate in the Blitz canyon's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 402) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, -402, GATE.x1, -402);
  wallSeg(GATE.x0, -402, -798, -402);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.6, 15, 1.6], [x, G, -402], DARKWOOD, 'Wood');
    data.tags.Campfire.push([x, G + 15.6, -402, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    add([2, 0.6, 2], [x, G + 15.1, -402], CHAR, 'Metal', { collide: 0, shape: 5 });
  }
  add([GATE.x1 - GATE.x0 + 1.6, 2.4, 1.2], [gx, G + 13.4, -402], DARKWOOD, 'Wood', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 13.4, -401.3], CHAR, 'Back', [['FLYING FIRE', 0, 0, 1, 1, FIRE]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 13.4, -402.7], CHAR, 'Front', [['FLYING FIRE', 0, 0, 1, 1, FIRE]], { glow: true });
  // the walk from Ravage's gate up to it
  for (const [a, b] of [[[-596, -418], [-606, -410]], [[-606, -410], [gx, -396]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.6, 0.2, len + 3.6], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the track
  const track = makeTrack(CIRCUIT, {
    rolls: [
      { from: knot(-764, -316), to: knot(-784, -315), h: 1.3 },
      { from: knot(-756, -170), to: knot(-722, -174), h: 1.3, dir: -1 },
    ],
  });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
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
  const clearOf = (size, pos, pad = 3.6) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.8) return false;
    }
    return true;
  };

  // ======== the lodge: a timber station shed, the firebird on its roof
  const ST = { x0: -642, x1: -618, z0: -374, z1: -328 };
  const PL = { x0: -627.4, x1: -621, z0: -372, z1: -346 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x6a4a30, 'WoodPlanks', { collide: 0 });
  add([0.5, 0.1, PL.z1 - PL.z0], [PL.x0 + 0.3, G + 0.42, (PL.z0 + PL.z1) / 2], EMBER, 'SmoothPlastic', { collide: 0 });
  for (let z = ST.z0; z <= ST.z1; z += 7.6) for (const x of [ST.x0, ST.x1]) box([0.8, 9, 0.8], [x, G, z], DARKWOOD, 'Wood', { collide: 0 });
  for (const x of [ST.x0, ST.x1]) add([0.8, 0.8, ST.z1 - ST.z0], [x, G + 9, (ST.z0 + ST.z1) / 2], DARKWOOD, 'Wood', { collide: 0 });
  for (const sx of [-1, 1]) add([(ST.x1 - ST.x0) / 2 + 2.4, 0.4, ST.z1 - ST.z0 + 3], [(ST.x0 + ST.x1) / 2 + sx * ((ST.x1 - ST.x0) / 4 + 0.6), G + 10.6, (ST.z0 + ST.z1) / 2], 0x5a2a1a, 'WoodPlanks', { collide: 0, rot: RZ(sx * -0.3) });
  sign([16, 2, 0.3], [(ST.x0 + ST.x1) / 2, G + 7.8, ST.z1 + 0.4], CHAR, 'Back', [['FLYING FIRE', 0, 0, 1, 1, FIRE]], { glow: true });
  sign([0.3, 2.2, 14], [ST.x1 + 0.45, G + 7.6, -350], CHAR, 'Right', [['FIREBIRD LODGE', 0, 0.05, 1, 0.55, EMBER], ['BENTON RIDGE LOGGING CO.', 0, 0.62, 1, 0.33, CREAM, 'GothamBold']], { glow: true });
  place(firebird(pp, 1.2), [(ST.x0 + ST.x1) / 2, G + 15.2, (ST.z0 + ST.z1) / 2], Math.PI * 0.85);
  for (let k = 0; k < 6; k++) neon([0.3, 0.3, 0.3], [ST.x1 + 0.4, G + 8.9, ST.z0 + 4 + k * 7.6], EMBER, { shape: 3 });
  const con = [-622.6, -344];
  box([1.4, 1.2, 1.6], [con[0], G + 0.4, con[1]], 0x3a2a1e, 'Wood', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.4 + k * 0.4, G + 1.7, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });

  // ======== the plaza and the line: timber rails, torches
  add([24, 0.2, 14], [-610, G + 0.1, -393], 0x8a7a64, 'Cobblestone', { collide: 0 });
  const RAILC = DARKWOOD;
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.3, 1.2, 0.3], [x, G, za + ((zb - za) * k) / n], RAILC, 'Wood');
    add([0.18, 0.18, zb - za], [x, G + 1.1, (za + zb) / 2], TIMBER, 'Wood', { collide: 0 });
    add([0.14, 0.14, zb - za], [x, G + 0.6, (za + zb) / 2], TIMBER, 'Wood', { collide: 0 });
  };
  const LANES = [-605, -609, -613, -617], N = -326, S = -386;
  railZ(S - 2, N + 1, -603);
  railZ(S, N - 3, -607);
  railZ(S + 3, N + 3, -611);
  railZ(S, N - 3, -615);
  railZ(-357, N + 3, -619.5);
  railZ(S - 2, -357, -619.5);
  const fwd = [[-606, -399], [LANES[0], -390], [LANES[0], N], [LANES[1], N], [LANES[1], S], [LANES[2], S], [LANES[2], N], [LANES[3], N], [LANES[3], -360], [-624, -360], [-624.4, -356]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the entrance: a timber arch with torches, the wait time
  for (const x of [-612, -600]) {
    box([1, 7, 1], [x, G, -397], DARKWOOD, 'Wood');
    data.tags.Campfire.push([x, G + 7.6, -397, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    add([1.4, 0.5, 1.4], [x, G + 7.2, -397], CHAR, 'Metal', { collide: 0, shape: 5 });
  }
  add([13.4, 1.2, 0.8], [-606, G + 6.2, -397], DARKWOOD, 'Wood', { collide: 0 });
  sign([11, 1, 0.2], [-606, G + 6.2, -397.5], CHAR, 'Front', [['FLYING FIRE  ·  STAND-BY', 0, 0, 1, 1, EMBER, 'GothamBold']]);
  const waitPart = add([5, 1.4, 0.4], [-600.5, G + 3.4, -396], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  box([0.4, 2.8, 0.4], [-600.5, G, -396], DARKWOOD, 'Wood', { collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 211, cf: cf(-614, G, -394, 0) });
  // torches along the line
  for (const z of [-380, -360, -340]) {
    box([0.4, 3, 0.4], [-603, G, z], DARKWOOD, 'Wood', { collide: 0 });
    data.tags.Campfire.push([-603, G + 3.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the exit: off the platform's north end, down the side to the plaza
  for (const [a, b] of [[[-624, -344], [-622, -322]], [[-622, -322], [-599.5, -322]], [[-599.5, -322], [-599.5, -392]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.6, 0.2, len + 2.6], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a6a54, 'Concrete', { yaw, collide: 0 });
  }
  sign([3, 0.9, 0.2], [-599.5, G + 3.2, -323], 0x1a8a3a, 'Back', [['EXIT', 0, 0, 1, 1, CREAM, 'GothamBold']], { glow: true });
  box([0.25, 2.8, 0.25], [-601.2, G, -323], DARKWOOD, 'Wood', { collide: 0 });

  // ======== the timber structure: bents of posts, ledgers and cross braces
  // under the track every few studs (not under the rolls or the lodge, and
  // never through another stretch of track)
  const keep = [ST, { x0: -620, x1: -596, z0: -400, z1: -318 }, { x0: -612, x1: -598, z0: -404, z1: -388 }];
  let bents = 0;
  const Y = new THREE.Vector3(0, 1, 0);
  const brace = (a, b, w = 0.35) => {
    // a timber from a to b, its flat face across the bent
    const d = b.clone().sub(a), len = d.length(); d.normalize();
    const side = new THREE.Vector3().crossVectors(d, Y);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(side, d).normalize();
    const c = a.clone().add(b).multiplyScalar(0.5);
    add([len, w, w], [c.x, c.y, c.z], TIMBER, 'Wood', { collide: 0, rot: [d.x, up.x, side.x, d.y, up.y, side.y, d.z, up.z, side.z] });
  };
  for (let s = 3; s < L - 3; s += 4) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    R.setFromMatrixColumn(m4, 0);
    if (U.y < 0.78) continue;
    const foot = P.clone().addScaledVector(U, -1.6);
    if (foot.y < 1.4) continue;
    const r = new THREE.Vector3(R.x, 0, R.z).normalize();
    const a = foot.clone().addScaledVector(r, -2.2), b = foot.clone().addScaledVector(r, 2.2);
    if (keep.some((k) => inRect(a.x, a.z, k, 1) || inRect(b.x, b.z, k, 1))) continue;
    if ([a, b, foot].some((q) => near(q.x, q.z).some(([x, y, z, c]) => Math.abs(c - s) > 9 && y < foot.y + 3.2 && Math.hypot(x - q.x, z - q.z) < 3.6))) continue;
    for (const q of [a, b]) add([0.5, q.y - G, 0.5], [q.x, (q.y + G) / 2, q.z], TIMBER, 'Wood', { collide: 0 });
    add([4.9, 0.4, 0.4], [foot.x, foot.y - 0.2, foot.z], DARKWOOD, 'Wood', { collide: 0, yaw: Math.atan2(-r.z, r.x) });
    for (let y = 1.5, k = 0; y + 3.6 < foot.y; y += 4.2, k++) {
      add([4.9, 0.3, 0.3], [foot.x, y, foot.z], TIMBER, 'Wood', { collide: 0, yaw: Math.atan2(-r.z, r.x) });
      const top = Math.min(foot.y - 0.4, y + 4.2);
      if (k % 2) brace(new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(b.x, top, b.z));
      else brace(new THREE.Vector3(b.x, y, b.z), new THREE.Vector3(a.x, top, a.z));
    }
    bents++;
  }
  // the chain lift's walkway and lights, flames at the crest
  for (let s = 0; s < L; s += 1) {
    sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4);
    if (P.x > -652 || P.x < -706 || Math.abs(P.z + 316) > 2) continue;
    if (Math.round(s) % 6 === 0) neon([0.3, 0.3, 0.3], [P.x, P.y - 0.3, P.z - 2.4], EMBER, { shape: 3 });
  }
  for (const z of [-312.4, -319.6]) data.tags.Campfire.push([-708, 32.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  sign([10, 2.4, 0.3], [-690, 31.8, -313.6], CHAR, 'Back', [['FLYING FIRE', 0, 0, 1, 1, FIRE]], { glow: true });

  // ======== the clearing: a logging camp - stacked logs, a fire lookout
  // tower, burned stumps, a log flume prop and campfires
  for (const [x, z, n] of [[-660, -250, 5], [-740, -230, 4], [-650, -200, 6]]) {
    if (!clearOf([10, 4, 5], [x, G + 2, z], 4)) continue;
    for (let k = 0; k < n; k++) add([8, 1, 1], [x, G + 0.5 + Math.floor(k / 3) * 0.9, z - 1 + (k % 3) * 1 + (k >= 3 ? 0.5 : 0)], 0x7a5434, 'Wood', { collide: 1, shape: 2 });
  }
  const LO = [-650, -280];
  if (clearOf([6, 24, 6], [LO[0], 12, LO[1]], 4)) {
    for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) box([0.5, 18, 0.5], [LO[0] + dx, G, LO[1] + dz], TIMBER, 'Wood', { collide: 0 });
    box([6, 3.2, 6], [LO[0], G + 18, LO[1]], 0x8a6a48, 'WoodPlanks', { collide: 0 });
    add([7, 0.5, 7], [LO[0], G + 21.6, LO[1]], 0x5a2a1a, 'WoodPlanks', { collide: 0 });
    sign([5, 1, 0.2], [LO[0], G + 19.6, LO[1] - 3.1], CHAR, 'Front', [['FIRE LOOKOUT', 0, 0, 1, 1, EMBER, 'GothamBold']]);
  }
  for (const [x, z] of [[-680, -230], [-730, -270], [-760, -360], [-680, -340], [-750, -200], [-660, -360]]) {
    if (!clearOf([2, 2, 2], [x, G + 1, z], 3)) continue;
    add([1.6, 1.4, 1.6], [x, G + 0.7, z], CHAR, 'Wood', { shape: 5, collide: 1 });
    neon([1.2, 0.08, 1.2], [x, G + 1.42, z], FIRE, { shape: 5 });
  }
  for (const [x, z] of [[-670, -300], [-700, -240]]) {
    if (!clearOf([3, 2, 3], [x, G + 1, z], 3)) continue;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add([0.5, 0.5, 0.5], [x + Math.cos(a) * 1.3, G + 0.25, z + Math.sin(a) * 1.3], 0x6a6a64, 'Slate', { shape: 3, collide: 0 }); }
    data.tags.Campfire.push([x, G + 0.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ======== the trains: classic wooden-coaster cars, flames down the sides
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.2], [0, 0.65, 0], CRIMSON, 'SmoothPlastic'),
    pp(0, [3.3, 0.2, 3.3], [0, 1.1, 0], CREAM, 'SmoothPlastic'),
    pp(0, [3.3, 0.18, 3.1], [0, 0.22, 0], CHAR, 'Metal'),
    ...[-1, 1].map((sx) => pp(1, [0.12, 0.7, 2.4], [sx * 1.62, 0.7, 0.2], k % 2 ? EMBER : FIRE, 'Neon', [1, 0, 0, 0, 1, 0, 0, 0, 1])),
    ...[-0.8, 0.7].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x2a1a14, 'Fabric'),
      pp(0, [1.1, 0.9, 0.25], [x, 1.7, z + 0.5], CRIMSON, 'SmoothPlastic'),
    ])),
    ...(k === 0 ? [pp(1, [3, 1.2, 1.4], [0, 0.9, -2.2], CRIMSON, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(3, [0.6, 0.6, 0.2], [0, 1.1, -2.9], EMBER, 'Neon')] : []),
  ];
  const seatList = () => [-0.8, 0.7].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(-623.6, G, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2, 3], [4, 5, 6]],
    console: cf(con[0], G, con[1] + 1, Math.PI / 2), operator: cf(con[0] + 0.6, G, con[1] + 1.8, Math.PI / 2),
    homes: [cf(-622.4, G, -370, -Math.PI / 2), cf(-622.4, G, -350, -Math.PI / 2)],
    exit: cf(-624, G, -344, Math.PI),
  };

  // ======== the ride
  const origin = [-690, 0, -300];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'wood' }, extras: {}, extrasNames: [], crew,
    noExtended: true,
  };
  data.rides.push(ride);
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  // fire at the bottom of the first drop, out of the roll and the barrel roll
  const cues = [[at(-750, -316), 'fire', [-5, 0, 0]], [at(-790, -300), 'fire', [5, 0, 0]], [at(-708, -180), 'fire', [-5, 0, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Flying Fire', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'A wooden coaster that goes upside down, in a logging-camp clearing past the Blitz canyon. Legend says a firebird nests on Benton Ridge - ride its flight: up the chain lift, a steep wooden drop through fire, a zero-g roll, airtime hills, a barrel roll at the turnaround and an S-bend home under the first drop, all on a classic timber structure.',
    baseWait: 55, origin, entrance: [-606, 0, -398], exit: [-606, 0, -393], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TIMBER, CRIMSON, FIRE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Flying Fire is open - a wooden coaster that goes upside down!'];
  return { ride, gate: { x: gx, z: -402 }, bents };
}

// a toast the first time you come near
export class FlyingFireSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: Flying Fire, a wooden coaster that goes upside down! Through the gate in the Blitz canyon\'s north wall.', 'reward');
    }
  }
}
