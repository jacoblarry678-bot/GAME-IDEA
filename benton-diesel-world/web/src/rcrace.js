// RC Race presented by Crinkle Crunch: a stand-up coaster on the RC raceway
// north of Speed Breaker (through a gate in Speed Breaker's north wall).
// The Benton RC Club's championship final: you ride the racers - trains
// built like giant remote-control buggies, standing up - up the lift, down
// the first drop, through a vertical loop, a corkscrew and an inclined
// loop, round the infield and into the pits. Crinkle Crunch (the park's own
// ridged-chip brand) sponsors the race: giant chip bags at the start line.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { carriedFrames } from './cyclone.js';

export const RIDE_ID = 'RCRace';
const SITE = { x0: -796, x1: -598, z0: 254, z1: 380 };
const GATE = { x0: -611, x1: -601 }; // in Speed Breaker's north wall (z 252)
const G = 0.1;
const CARS = 4, SPACING = 3.4;
const LIME = 0x7adc2a, ORANGE = 0xff7a1a, BLUE = 0x2a6ae8, DARK = 0x18191c, WHITE = 0xf4f4f0, CHIP = 0xf2c84a, BAG = 0x2a4ad8, STEEL = 0x8e949c;
const TRACK_COLOR = 0x7adc2a;

const CIRCUIT = [
  [-676, 2, 266, 2],
  // out of the pits, round to the north and up the lift
  [-688, 2.2, 266, 4], [-698, 2.5, 270, 4], [-702, 3, 280, 4], [-702, 4, 288, 4], [-702, 16, 304, 4], [-702, 30, 322, 4], [-702, 38.5, 336, 3.5],
  // the crest and the first drop
  [-702, 40, 342, 4], [-702.5, 36, 348, 9], [-704, 24, 356, 19], [-707, 10, 364, 25], [-712, 3, 370, 27], [-724, 3, 372, 27],
  // the vertical loop
  [-732, 3.2, 372, 26], [-744, 10, 371.5, 23], [-750, 24, 371, 16], [-744, 33, 369.5, 11], [-737, 24, 367.5, 16], [-743, 10, 366, 23], [-754, 3.2, 365, 26],
  // round to the south and the corkscrew
  [-768, 4, 364, 25], [-778, 6, 356, 23], [-782, 9, 344, 21], [-782, 11, 338, 20], [-782, 12, 323, 19], [-782, 11, 308, 20], [-780, 8, 296, 22],
  // round to the east and the inclined loop
  [-772, 5, 284, 24], [-758, 4, 278, 25], [-746, 3.5, 278, 25], [-734, 9, 279, 22], [-728, 20, 282, 16], [-733, 27, 286, 12], [-741, 20, 289, 16], [-738, 9, 292, 22], [-726, 3.5, 294, 24],
  // north up the infield, east under the drop, south down the east side
  [-718, 4, 302, 23], [-716, 6, 316, 21], [-716, 8, 334, 19], [-718, 7, 346, 19], [-708, 6, 352, 20], [-690, 6, 352, 20], [-672, 6, 352, 19], [-660, 6, 344, 18], [-656, 5, 330, 16], [-654, 4.5, 312, 12],
  // the brakes, and round into the pits
  [-650, 3.5, 298, 7], [-648, 3, 284, 5], [-652, 2.5, 272, 4], [-660, 2.2, 267, 3], [-668, 2, 266, 2.5],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildRCRace(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: the RC raceway, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x5a8a3a, 'Grass');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, 252, -798, 382);
  wallSeg(-798, 382, -596, 382);
  wallSeg(-596, 382, -596, 252);
  // the gate in Speed Breaker's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 252) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, 252, GATE.x1, 252);
  wallSeg(GATE.x0, 252, -798, 252);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.4, 15, 1.4], [x, G, 252], DARK, 'Metal');
    for (let k = 0; k < 5; k++) add([1.5, 0.8, 1.5], [x, G + 1.5 + k * 2.8, 252], [LIME, ORANGE, BLUE][k % 3], 'SmoothPlastic', { collide: 0 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.4, 1.2], [gx, G + 14, 252], DARK, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 252.7], DARK, 'Back', [['RC RACE', 0, 0, 1, 1, LIME]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 251.3], DARK, 'Front', [['RC RACE', 0, 0, 1, 1, LIME]], { glow: true });
  // the walk up the east side of the speed-trials ground to the gate
  for (const [a, b] of [[[-600, 140], [-602, 160]], [[-602, 160], [-602, 244]], [[-602, 244], [gx, 256]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.4, 0.2, len + 3.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  carriedFrames(track, {
    free: [[sk(-732, 372), sk(-754, 365)], [sk(-746, 278), sk(-726, 294)]],
    twists: [{ s0: sk(-782, 338), s1: sk(-782, 308), angle: Math.PI * 2, h: 1.6 }],
  });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3();
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
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3 && pos[1] - ey < y + 6) return false;
    }
    return true;
  };

  // ======== the pits: the station, a race garage with the sponsor's colors
  const ST = { x0: -688, x1: -656, z0: 256, z1: 276 };
  const PL = { x0: -686, x1: -660, z0: 257, z1: 266 - 2.6 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x3a3e46, 'DiamondPlate', { collide: 0 });
  add([PL.x1 - PL.x0, 0.1, 0.5], [(PL.x0 + PL.x1) / 2, G + 0.42, PL.z1 - 0.3], LIME, 'SmoothPlastic', { collide: 0 });
  for (let x = ST.x0; x <= ST.x1; x += 8) for (const z of [ST.z0, ST.z1]) box([0.5, 10, 0.5], [x, G, z], DARK, 'Metal', { collide: 0 });
  add([ST.x1 - ST.x0 + 3, 0.5, ST.z1 - ST.z0 + 3], [(ST.x0 + ST.x1) / 2, G + 10.3, (ST.z0 + ST.z1) / 2], BAG, 'Metal', { collide: 0 });
  for (let k = 0; k < 9; k++) add([(ST.x1 - ST.x0 + 3) / 9, 0.6, 0.3], [ST.x0 - 1.5 + (k + 0.5) * ((ST.x1 - ST.x0 + 3) / 9), G + 9.7, ST.z1 + 1.6], k % 2 ? WHITE : DARK, 'SmoothPlastic', { collide: 0 });
  sign([22, 2.4, 0.3], [(ST.x0 + ST.x1) / 2, G + 8.2, ST.z1 + 1.8], DARK, 'Back', [['RC RACE', 0, 0, 1, 1, LIME]], { glow: true });
  sign([22, 1.2, 0.3], [(ST.x0 + ST.x1) / 2, G + 6.4, ST.z1 + 1.8], CHIP, 'Back', [['PRESENTED BY CRINKLE CRUNCH', 0, 0, 1, 1, BAG, 'GothamBold']]);
  const con = [-662, 259];
  box([1.4, 1.2, 2.2], [con[0], G + 0.4, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });

  // ======== the infield: a raceway road with tire stacks, a start gantry,
  // giant RC buggies, the giant remote, the sponsor's chip bags
  const road = (pts) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (!clearOf([6, 0.4, len], [mx, G + 0.2, mz], 1)) continue;
      add([6, 0.12, len + 6], [mx, G + 0.08, mz], 0x3a3a3e, 'Asphalt', { yaw, collide: 0 });
    }
  };
  road([[-770, 330], [-770, 300], [-750, 300], [-750, 340], [-770, 340], [-770, 330]]);
  for (const [x, z] of [[-772, 302], [-748, 338], [-748, 302], [-772, 338]]) {
    if (!clearOf([2, 2, 2], [x, G + 1, z], 2)) continue;
    for (let k = 0; k < 3; k++) add([1.6, 0.6, 1.6], [x, G + 0.3 + k * 0.6, z], k % 2 ? WHITE : DARK, 'Rubber', { shape: 5, collide: 0 });
  }
  const buggy = (x, z, yaw, color, s = 1) => {
    if (!clearOf([6 * s, 4 * s, 9 * s], [x, G + 2 * s, z], 2)) return;
    const parts = [
      pp(0, [4, 0.8, 7], [0, 1.6, 0], color, 'SmoothPlastic'), pp(1, [3.6, 1.6, 2.8], [0, 2.6, -1], color, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]),
      pp(0, [4.4, 0.3, 1.4], [0, 3.4, 3.2], DARK, 'Metal'), pp(0, [0.1, 6, 0.1], [1.4, 5, 2.2], DARK, 'Metal'), pp(3, [0.4, 0.4, 0.4], [1.4, 8, 2.2], 0xff2020, 'Neon'),
      ...[[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([dx, dz]) => pp(2, [1.2, 2.6, 2.6], [dx, 1.3, dz], DARK, 'Rubber')),
    ];
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const q of parts) {
      const lx = q[4] * s, lz = q[6] * s, R = q.slice(7, 16);
      data.static.push([q[0], q[1] * s, q[2] * s, q[3] * s, x + c * lx + sn * lz, G + q[5] * s, z - sn * lx + c * lz,
        c * R[0] + sn * R[6], c * R[1] + sn * R[7], c * R[2] + sn * R[8], R[3], R[4], R[5], -sn * R[0] + c * R[6], -sn * R[1] + c * R[7], -sn * R[2] + c * R[8], q[16], q[17], 0, 0]);
    }
  };
  buggy(-760, 320, 0.3, ORANGE);
  buggy(-740, 312, -0.4, BLUE);
  buggy(-736, 330, 2.6, LIME, 0.8);
  // the start gantry over the infield road
  for (const x of [-774, -766]) box([0.6, 8, 0.6], [x, G, 315], DARK, 'Metal', { collide: 0 });
  add([9, 1.4, 0.6], [-770, G + 8, 315], DARK, 'Metal', { collide: 0 });
  sign([8, 1.1, 0.2], [-770, G + 8, 315.4], WHITE, 'Back', [['START / FINISH', 0, 0, 1, 1, DARK, 'GothamBold']]);
  // the giant remote control, by the gate
  const RM = [-622, 300];
  if (clearOf([12, 10, 6], [RM[0], 5, RM[1]], 3)) {
    box([10, 6, 4], [RM[0], G + 1.4, RM[1]], DARK, 'SmoothPlastic', { collide: 1 });
    box([0.5, 9, 0.5], [RM[0] + 3.5, G + 7.4, RM[1]], STEEL, 'Metal', { collide: 0 });
    add([0.9, 0.9, 0.9], [RM[0] + 3.5, G + 16.6, RM[1]], 0xff2020, 'Neon', { collide: 0, shape: 3 });
    for (const dx of [-2.6, 2.6]) { add([1.6, 0.6, 1.6], [RM[0] + dx, G + 7.7, RM[1]], STEEL, 'Metal', { collide: 0, shape: 5 }); add([0.5, 2, 0.5], [RM[0] + dx, G + 8.8, RM[1]], DARK, 'Metal', { collide: 0, rot: RZ(dx > 0 ? 0.3 : -0.2) }); add([1, 1, 1], [RM[0] + dx + (dx > 0 ? 0.3 : -0.2), G + 9.9, RM[1]], dx > 0 ? LIME : ORANGE, 'SmoothPlastic', { collide: 0, shape: 3 }); }
    sign([6, 1.2, 0.2], [RM[0], G + 4.6, RM[1] - 2.1], DARK, 'Front', [['BENTON RC CLUB', 0, 0, 1, 1, LIME, 'GothamBold']], { glow: true });
  }
  // the sponsor's giant chip bags (a ridged-chip brand of the park's own)
  const chipBag = (x, z, yaw) => {
    if (!clearOf([6, 9, 4], [x, 4.5, z], 2)) return;
    add([5, 8, 2.4], [x, G + 4.2, z], BAG, 'SmoothPlastic', { collide: 1, yaw });
    add([5.2, 0.6, 2.2], [x, G + 8.4, z], 0xe8e8ee, 'Metal', { collide: 0, yaw });
    add([5.2, 0.6, 2.2], [x, G + 0.4, z], 0xe8e8ee, 'Metal', { collide: 0, yaw });
    sign([4.2, 2.4, 0.15], [x - Math.sin(yaw) * 1.25, G + 5.4, z - Math.cos(yaw) * 1.25], CHIP, 'Front', [['CRINKLE', 0, 0.02, 1, 0.48, BAG], ['CRUNCH', 0, 0.5, 1, 0.48, ORANGE]], { yaw });
    for (let k = 0; k < 3; k++) add([1.6, 0.25, 1.2], [x + (k - 1) * 1.4, G + 2.6 + (k % 2) * 0.6, z - 1.3], CHIP, 'SmoothPlastic', { collide: 0, rot: RX(0.3 + k * 0.2) });
  };
  chipBag(-634, 314, 0);
  chipBag(-640, 360, 0);
  chipBag(-772, 270, 0.4);

  // ======== the line: switchbacks between pit-wall barriers
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [x, G, za + ((zb - za) * k) / n], DARK, 'Metal');
    add([0.14, 0.14, zb - za], [x, G + 1.1, (za + zb) / 2], LIME, 'Metal', { collide: 0 });
  };
  const LANES = [-604, -608, -612, -616, -620, -624], S = 262, N = 296;
  railZ(S - 4, N + 1, -602);
  for (let k = 0; k < LANES.length - 1; k++) {
    const x = (LANES[k] + LANES[k + 1]) / 2;
    if (k % 2 === 0) railZ(S - 1, N - 3, x); // heading north: turn at the north end
    else railZ(S + 3, N + 1, x);
  }
  railZ(S + 3, N + 1, -626);
  const fwd = [[-606, 256], [LANES[0], S - 2]];
  LANES.forEach((x, k) => {
    const north = k % 2 === 0;
    fwd.push([x, north ? N : S]);
    if (k < LANES.length - 1) fwd.push([LANES[k + 1], north ? N : S]);
  });
  fwd.push([-630, S], [-640, 259], [-656, 259.5], [-668, 262]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the entrance: an arch of tires, the wait time
  for (const x of [-612, -600]) for (let k = 0; k < 5; k++) add([1.8, 0.7, 1.8], [x, G + 0.35 + k * 0.7, 256], k % 2 ? LIME : DARK, 'Rubber', { shape: 5 });
  add([14, 1.2, 0.8], [-606, G + 4.2, 256], DARK, 'Metal', { collide: 0 });
  sign([12, 1, 0.2], [-606, G + 4.2, 256.5], DARK, 'Back', [['RC RACE  ·  STAND-BY', 0, 0, 1, 1, LIME, 'GothamBold']]);
  const waitPart = add([5, 1.4, 0.4], [-606, G + 6.4, 256], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 291, cf: cf(-610, G, 259, Math.PI) });
  for (const [x, z] of [[-600, 300], [-630, 300], [-638, 264]]) {
    box([0.4, 8, 0.4], [x, G, z], DARK, 'Metal');
    add([1.2, 1.4, 1.2], [x, G + 8.4, z], 0xfff2d0, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 8.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the exit: off the platform's west end, round to the gate
  for (const [a, b] of [[[-687, 259], [-690, 255]], [[-690, 255], [-615, 254.8]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.4, 0.2, len + 2.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([3, 0.9, 0.2], [-692, G + 3.2, 257.6], 0x1a8a3a, 'Back', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  box([0.25, 2.8, 0.25], [-693.6, G, 257.6], DARK, 'Metal', { collide: 0 });

  // ======== supports: lime columns
  let supports = 0;
  const keep = [ST, { x0: -628, x1: -598, z0: 254, z1: 300 }];
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (keep.some((r) => inRect(foot.x, foot.z, r, 1))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], 0x3a3c42, 'Metal', { shape: 5, collide: 0 });
    add([1.8, 0.5, 1.8], [foot.x, G + 0.25, foot.z], 0x9a9a94, 'Concrete', { collide: 0 });
    supports++;
  }

  // ======== the racers: stand-up trains built like giant RC buggies
  const carParts = (k) => [
    pp(0, [3.2, 0.5, 3.4], [0, 0.35, 0], [ORANGE, BLUE, LIME, ORANGE][k], 'SmoothPlastic'),
    pp(0, [3.3, 0.15, 3.2], [0, 0.15, 0], LIME, 'Neon'),
    ...[[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]].map(([dx, dz]) => pp(2, [0.6, 1.1, 1.1], [dx, 0.5, dz], DARK, 'Rubber')),
    // a back pad and frame for each rider, standing
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [0.9, 2.8, 0.3], [x, 2.0, z + 0.55], DARK, 'Fabric'),
      pp(0, [0.5, 0.5, 0.6], [x, 2.7, z + 0.2], 0x2a2a2e, 'Fabric'),
      pp(0, [0.9, 0.12, 0.8], [x, 0.66, z], STEEL, 'DiamondPlate'),
    ])),
    pp(0, [0.08, 3, 0.08], [1.4, 2.1, 1.5], DARK, 'Metal'), pp(3, [0.25, 0.25, 0.25], [1.4, 3.7, 1.5], 0xff2020, 'Neon'),
    ...(k === 0 ? [pp(1, [3, 0.9, 1.6], [0, 0.6, -2.4], ORANGE, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(0, [3.1, 0.3, 0.3], [0, 0.3, -3.1], DARK, 'Metal')] : []),
  ];
  // standing riders: the seat point is at hip height above the floor plate
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 0.72 + 2.87, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
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
    stops.push(cf(P.x, G, PL.z1 - 0.8, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0] - 1, G, con[1], -Math.PI / 2), operator: cf(con[0] - 1.6, G, con[1] - 1.4, -Math.PI / 2),
    homes: [cf(-684, G, 260, Math.PI), cf(-664, G, 260, Math.PI)],
    exit: cf(-686, G, 260, Math.PI / 2),
  };

  // ======== the ride
  const origin = [-720, 0, 320];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    noExtended: true, standing: true,
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
  // sparks off the wheels at the bottom of the drop and out of the corkscrew
  const cues = [[at(-712, 370), 'sparks', [0, 0, 2]], [at(-780, 296), 'sparks', [0, 0, 2]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'RC Race presented by Crinkle Crunch', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "A stand-up coaster on the RC raceway north of Speed Breaker. It's the Benton RC Club championship final and you ride the racers - trains built like giant remote-control buggies, standing up: up the lift, the first drop, a vertical loop, a corkscrew and an inclined loop, round the infield and into the pits. Sponsored by Crinkle Crunch ridged chips.",
    baseWait: 55, origin, entrance: [-606, 0, 257], exit: [-608, 0, 258], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, ORANGE, BLUE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'RC Race is open - the stand-up coaster, presented by Crinkle Crunch!'];
  return { ride, gate: { x: gx, z: 252 }, supports };
}

// a toast the first time you come near
export class RCRaceSite {
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
      this.hooks.toast('NEW: RC Race presented by Crinkle Crunch - a stand-up coaster! Through the gate in Speed Breaker\'s north wall.', 'reward');
    }
  }
}
