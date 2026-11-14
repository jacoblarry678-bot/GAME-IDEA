// Benton Flash: a single-rail coaster in the RMC Raptor style, west of
// Construction Runaway (through a gate in Construction Runaway's west
// wall). Riders sit single file, two to a car, on a one-rail I-beam track
// (the "single" track style). The theme is the Benton Power Co.: you board
// in the Generator Hall, climb a 51-stud lift past the substation, dive
// steeply out of the sky, hang upside down in a long zero-g stall over the
// Tesla coils, sweep through an overbanked wave turn, barrel-roll twice and
// skim the airtime hills home, with sparks and lightning all the way.
//
// The inversions are track rolls (fastfurious.js makeTrack): a full roll,
// a stall (half way, held, then the rest), and a bump (an overbank, out
// and back). Every support and piece of scenery is placed clear of the
// train's swept path.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'BentonFlash';
const SITE = { x0: 524, x1: 748, z0: 238, z1: 440 };
const CRGATE = { z0: 262, z1: 278 }; // in Construction Runaway's west wall (x 750)
const G = 0.1;
const CARS = 6, SPACING = 3.1;
const YELLOW = 0xf2d020, BLACK = 0x14161a, BLUE = 0x3ab0ff, WHITE = 0xf4f4f0, STEEL = 0x8a8e96, ORANGE = 0xff8a20;
const TRACK_COLOR = YELLOW;

const CIRCUIT = [
  [704, 1.6, 282, 2], [704, 2, 294, 5],
  // the lift, past the substation
  [704, 6, 306, 4], [704, 20, 326, 4], [704, 36, 348, 4], [704, 48, 366, 4], [704, 51, 376, 5], [704, 49, 384, 9],
  // the steep first drop, turning west
  [704, 38, 392, 18], [702, 18, 400, 28], [696, 5, 410, 33], [682, 4.5, 422, 33], [662, 6, 428, 32],
  // the zero-g stall over the Tesla coils
  [644, 14, 430, 26], [626, 20, 430, 22], [608, 20, 429, 22], [592, 13, 426, 25],
  // round to the south: the overbanked wave, then the first barrel roll
  [574, 8, 420, 30], [562, 8, 404, 30], [558, 9, 384, 29],
  [556, 17, 364, 22], [556, 22, 344, 18], [556, 15, 324, 24],
  [556, 11, 306, 26], [556, 12, 290, 25], [557, 9, 274, 27],
  // east, then north up the middle and the second barrel roll
  [564, 7, 258, 28], [580, 8, 252, 27], [596, 9, 262, 26], [600, 11, 280, 24],
  [602, 13, 298, 22], [602, 13, 320, 22], [600, 10, 336, 23],
  [608, 10, 352, 22], [624, 10, 358, 21],
  // the airtime hills south, and home
  [638, 11, 344, 20], [640, 13, 326, 19], [640, 9, 306, 21], [638, 7, 286, 21],
  [644, 6.5, 262, 20], [656, 6, 250, 19], [674, 5, 246, 17], [690, 4, 246, 13],
  [700, 3, 250, 9], [704, 2.2, 258, 6], [704, 1.6, 268, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildBentonFlash(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x3a3c40, 'Asphalt');
  // a gate in Construction Runaway's west wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 750) < 0.6 && Math.abs(p[6] - 368) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(750, 500, 750, CRGATE.z1);
  wallSeg(750, CRGATE.z0, 750, 236);
  wallSeg(SITE.x0, 236, SITE.x0, SITE.z1);
  wallSeg(SITE.x0, SITE.z1, 750, SITE.z1);
  const gz = (CRGATE.z0 + CRGATE.z1) / 2;
  // the gate: two black pylons with a lightning bolt across them
  for (const z of [CRGATE.z0 + 0.8, CRGATE.z1 - 0.8]) {
    box([1.4, 16, 1.4], [750, G, z], BLACK, 'Metal');
    neon([0.3, 15, 0.3], [749.2, G + 8, z], YELLOW);
  }
  add([1.4, 2.6, CRGATE.z1 - CRGATE.z0 + 1], [750, G + 15, gz], BLACK, 'Metal', { collide: 0 });
  for (const [x, face] of [[749.2, 'Left'], [750.8, 'Right']]) sign([0.2, 2.2, CRGATE.z1 - CRGATE.z0 - 1], [x, G + 15, gz], BLACK, face, [['BENTON FLASH', 0, 0, 1, 1, YELLOW]], { glow: true });
  // the walk: from Construction Runaway's plaza, west through the gate
  for (const [a, b] of [[[766, 262], [750, gz]], [[750, gz], [746, gz]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    W.add([8, 0.4, len + 8], [(a[0] + b[0]) / 2, 0.22, (a[1] + b[1]) / 2], 0x5a5c62, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])]);
  }

  // ======== the track
  const track = makeTrack(CIRCUIT, {
    rolls: [
      { from: knot(644, 430), to: knot(592, 426), h: 1.3, shape: 'stall', hold: 0.45 },
      { from: knot(556, 364), to: knot(556, 324), h: 1.3, shape: 'bump', angle: 2.0, dir: -1 },
      { from: knot(556, 306), to: knot(557, 274), h: 1.3 },
      { from: knot(602, 298), to: knot(600, 336), h: 1.3, dir: -1 },
    ],
  });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
  const samples = [];
  for (let s = 0; s < track.length; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
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
  // clear of the train, whichever way up it is: a tube round the rail
  const clearOf = (size, pos) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < 3.6 && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.4) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  // supports: black columns from the ground up under the I-beam
  let supports = 0;
  for (let s = 6; s < track.length - 4; s += 7) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.9) continue;
    const foot = P.clone().addScaledVector(U, -1.6);
    if (foot.y < 2.2) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.2)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], BLACK, 'Metal', { shape: 5, collide: 0 });
    supports++;
  }

  // ======== the plaza and the line
  const ROWX = [742, 736, 730, 724, 718];
  const fwd = [[766, 262], [744, gz], [ROWX[0], 296]];
  ROWX.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwd.push([x, goSouth ? 296 : 248]);
    fwd.push([x, goSouth ? 248 : 296]);
  });
  fwd.push([712, 248], [712, 270], [708.4, 276]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  const railZ = (x, za, zb) => {
    add([0.24, 0.24, zb - za], [x, G + 3, (za + zb) / 2], YELLOW, 'Metal', { collide: 0 });
    add([0.18, 0.18, zb - za], [x, G + 1.8, (za + zb) / 2], BLACK, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.3, 3.1, 0.3], [x, G, za + ((zb - za) * k) / n], BLACK, 'Metal');
  };
  for (let k = 0; k < ROWX.length - 1; k++) {
    const x = (ROWX[k] + ROWX[k + 1]) / 2;
    if (k % 2 === 0) railZ(x, 252, 299); else railZ(x, 245, 292);
  }
  railZ(715, 252, 266);
  add([36, 0.12, 56], [729, G + 0.06, 272], 0x2a2c32, 'SmoothPlastic', { collide: 0 });
  // the entrance sign and the wait time
  box([0.4, 8, 0.4], [746.6, G, 284], BLACK, 'Metal');
  sign([0.2, 3, 10], [746.4, G + 8.6, 284], BLACK, 'Left', [['BENTON FLASH', 0, 0.02, 1, 0.6, YELLOW], ['SINGLE RAIL  ·  ENTRANCE', 0, 0.62, 1, 0.36, WHITE, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [744, G, 254], 0x2e3238, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [744, G + 9, 254], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 121, cf: cf(742, G, 272, -Math.PI / 2) });

  // ======== the station: the Generator Hall
  for (let z = 260; z <= 300; z += 10) for (const x of [699, 712.8]) box([0.8, 12, 0.8], [x, G, z], BLACK, 'Metal', { collide: x < 705 ? 1 : 0 });
  add([16, 0.8, 46], [705.5, G + 12.4, 280], 0x2a2c32, 'CorrodedMetal', { collide: 0 });
  neon([16.2, 0.3, 0.3], [705.5, G + 12, 257], YELLOW);
  neon([16.2, 0.3, 0.3], [705.5, G + 12, 303], YELLOW);
  add([4.6, 0.3, 26], [708.4, G + 0.15, 273], 0x5a5c62, 'DiamondPlate', { collide: 0 });
  add([0.5, 0.1, 26], [706.4, G + 0.32, 273], YELLOW, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 3, 20], [711.6, 10, 280], BLACK, 'Left', [['GENERATOR HALL', 0, 0, 1, 0.6, YELLOW], ['BENTON POWER CO.  ·  DANGER: HIGH VOLTAGE', 0, 0.6, 1, 0.4, BLUE, 'GothamBold']], { glow: true });
  // generators humming along the back wall
  for (const z of [262, 274, 286]) {
    S([3.4, 3.4, 6], [696, G + 1.8, z], STEEL, 'Metal', { shape: 2, collide: 0 });
    SN([3.6, 0.4, 0.6], [696, G + 3.6, z], BLUE);
  }
  const con = [710.8, 262];
  box([1.4, 3, 2.4], [con[0], G, con[1]], BLACK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(705, 9, 272, 0xd8ecff);
  light(705, 9, 292, BLUE);

  // ======== the power station all round
  // a Tesla coil: a column of rings and a glowing ball, with bolts round it
  const tesla = (x, z, h = 14) => {
    if (SB([1.6, h, 1.6], [x, G, z], STEEL, 'Metal', { shape: 5, collide: 0 }) < 0) return;
    for (let k = 0; k < 6; k++) S([2.6, 0.3, 2.6], [x, G + 2 + k * (h - 3) / 6, z], 0xc88a3a, 'Metal', { shape: 5, collide: 0 });
    S([3, 1.4, 3], [x, G + h + 0.6, z], STEEL, 'Metal', { shape: 5, collide: 0 });
    SN([1.8, 1.8, 1.8], [x, G + h + 2, z], 0xc8f0ff, { shape: 3 });
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4;
      for (let j = 0; j < 3; j++) SN([0.15, 1.6, 0.15], [x + Math.cos(a) * (1.4 + j * 1.1), G + h + 2.2 + (j % 2 ? 0.7 : -0.2), z + Math.sin(a) * (1.4 + j * 1.1)], 0xd8f4ff, { rot: RZ(j % 2 ? 0.7 : -0.7) });
    }
    light(x, h + 3, z, BLUE);
  };
  for (const [x, z] of [[618, 412], [600, 400], [640, 404], [574, 440 - 14]]) tesla(x, z, 12);
  for (const [x, z] of [[580, 320], [620, 318], [670, 300], [660, 380]]) tesla(x, z, 16);
  // the substation by the lift: transformers, insulators, wires
  for (const [x, z] of [[684, 320], [684, 334], [684, 348]]) {
    SB([5, 5, 6], [x, G, z], 0x6a7a6a, 'Metal', { collide: 0 });
    for (let k = 0; k < 3; k++) SB([0.5, 3, 0.5], [x - 1.6 + k * 1.6, G + 5, z], 0xc8a87a, 'SmoothPlastic', { collide: 0 });
  }
  sign([0.2, 2.4, 10], [681.4, G + 4, 334], 0xf2d020, 'Left', [['DANGER: 10,000 VOLTS', 0, 0, 1, 1, BLACK, 'GothamBlack']]);
  for (let k = 0; k < 4; k++) S([0.6, 26, 0.6], [670 + k * 6, G + 13, 260 + (k % 2) * 4], STEEL, 'Metal', { collide: 0 });
  // the big bolt sign on a pylon
  if (SB([1.6, 30, 1.6], [740, G, 410], BLACK, 'Metal', { collide: 0 }) >= 0) {
    sign([0.4, 7, 20], [739, G + 30, 410], BLACK, 'Left', [['BENTON FLASH', 0, 0.05, 1, 0.6, YELLOW], ['SINGLE RAIL  ·  THREE INVERSIONS', 0, 0.68, 1, 0.28, WHITE, 'GothamBold']], { glow: true });
    for (let k = 0; k < 5; k++) neon([0.4, 2.6, 0.5], [738.6, G + 24 - k * 2.2, 412 + (k % 2 ? 0.8 : -0.8)], YELLOW, { rot: RZ(k % 2 ? 0.5 : -0.5) });
  }
  // lamps all round
  for (const [x, z] of [[540, 250], [540, 330], [540, 420], [600, 430], [680, 436], [744, 330], [744, 380], [620, 280], [690, 380]]) {
    if (!clearOf([1, 12, 1], [x, 6, z])) continue;
    box([0.5, 11, 0.5], [x, G, z], BLACK, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 11.4, z], [YELLOW, BLUE][Math.round(x / 10) % 2], 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 11.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (let s = 20; s < track.length - 20; s += 26) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.max(4, P.y - 4), P.z, s % 52 ? BLUE : YELLOW); }

  // ======== the train: six cars, two riders each, single file
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const carParts = (k) => [
    pp(0, [0.9, 0.5, 2.8], [0, 0.25, 0], BLACK, 'Metal'),
    pp(0, [1.9, 0.12, 0.7], [0, 0.45, -0.75], STEEL, 'DiamondPlate'),
    pp(0, [1.9, 0.12, 0.7], [0, 0.45, 0.65], STEEL, 'DiamondPlate'),
    ...[-0.75, 0.65].flatMap((z) => [
      pp(0, [1.1, 0.3, 0.9], [0, 0.75, z], BLACK, 'Fabric'),
      pp(0, [1.1, 1.4, 0.25], [0, 1.45, z + 0.5], k % 2 ? YELLOW : BLUE, 'SmoothPlastic'),
      pp(0, [1.2, 0.2, 0.3], [0, 2.2, z + 0.5], WHITE, 'SmoothPlastic'),
    ]),
    ...(k === 0 ? [pp(0, [1, 1, 0.6], [0, 0.9, -1.55], YELLOW, 'SmoothPlastic'), pp(0, [0.3, 0.9, 0.1], [0.1, 1, -1.86], BLACK, 'Neon', RZ(0.4)), pp(3, [0.3, 0.3, 0.2], [-0.3, 0.7, -1.86], 0xfff4c0, 'Neon'), pp(3, [0.3, 0.3, 0.2], [0.3, 0.7, -1.86], 0xfff4c0, 'Neon')] : []),
  ];
  const seatList = () => [-0.75, 0.65].map((z) => [0, 0.9 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }

  // ======== the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(707.2, G, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 1, routes: [[1, 2, 3, 4, 5, 6]],
    console: cf(con[0], G, con[1], -Math.PI / 2), operator: cf(con[0] - 1.4, G, con[1], -Math.PI / 2),
    homes: [cf(709, G, 280, -Math.PI / 2)],
    exit: cf(709, G, 290, 0),
  };

  // ======== the ride
  const origin = [630, 0, 340];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 2, queue: qpath, trackStyle: { style: 'single', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
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
  const cues = [[at(696, 410), 'sparks', [0, -2, 0]], [at(618, 430), 'sparks', [0, 3, 0]], [at(556, 290), 'sparks', [0, 2, 0]], [at(640, 326), 'explosion', [4, -4, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Benton Flash', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'A single-rail coaster: ride single file on a one-rail I-beam through the Benton Power Co. Climb the 51-stud lift past the substation, dive out of the sky, hang upside down in a long zero-g stall over the Tesla coils, sweep through an overbanked wave turn, barrel-roll twice and skim the airtime hills home. Three inversions, lots of sparks.',
    baseWait: 65, origin, entrance: [744, 0, 270], exit: [760, 0, 262], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, BLACK, BLUE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Benton Flash is open - single file, single rail!', 'Hang on through the stall!'];
  return { ride, gate: { x: 750, z: gz }, supports };
}

// a toast the first time you come near the new ride
export class BentonFlashSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 45) {
      this.told = true;
      this.hooks.toast('NEW: Benton Flash, a single-rail coaster - single file, a zero-g stall and two barrel rolls! Through the gate west of Construction Runaway.', 'reward');
    }
  }
}
