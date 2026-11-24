// Snowball: a mine train coaster in Frostbite Base, down in the Lower Lot.
// The base's crew dig blue ice out of the old Snowball Mine, and the ore
// trains still run: out of the depot, up the lift along the edge of the
// base, a drop down the west side, bunny hops along the foot of the cliffs,
// a second lift, then round the mountain - over the brake run, past the
// mine, through the ice cave - and, as the train runs along the mountain's
// foot, the giant snowball breaks loose and comes rolling down at you.
// Timber trestles, steel rails on wooden ties, rusty ore carts behind a
// little green locomotive.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { FLOOR, SNOW_SITE } from './lowerlot.js';

export const RIDE_ID = 'Snowball';
const FL = FLOOR + 0.02;
const S = SNOW_SITE;
const CARS = 5, SPACING = 3.4;
const SNOW = 0xf2f6fa, ICE = 0x9ad8f8, TIMBER = 0x6a4a2a, DARKWOOD = 0x4a3220, RUST = 0x8a4a2a, IRON = 0x3a3a3e, LOCO = 0x1e5a3a, BRASS = 0xc8a040, INK = 0x14141a;
const Y = (h) => FLOOR + h;

// the circuit: x, y, z of the track, and the speed there (y as height above the floor)
const C = (x, h, z, v) => [x, Y(h), z, v];
const CIRCUIT = [
  C(990, 2, -918, 2),
  // out of the depot, west, up lift 1 along the edge of the base
  C(978, 2.1, -918, 4), C(966, 2.4, -918, 4), C(958, 3, -918, 3.6), C(946, 9, -918, 3.6), C(934, 15, -918, 3.4), C(926, 17, -918, 3.2),
  // round to the south and the drop down the west side
  C(916, 17.3, -920, 3.2), C(907, 16.9, -927, 3.6), C(902, 15.8, -936, 5), C(900, 12, -945, 10), C(900, 6.5, -954, 14), C(900, 3.2, -964, 16.5),
  // round to the east, bunny hops along the foot of the cliffs
  C(903, 3.4, -976, 16.5), C(912, 3.8, -985, 16), C(925, 4.2, -987, 15.5), C(938, 8, -987, 13), C(950, 3.6, -987, 15.5), C(962, 8, -987, 13), C(974, 3.6, -987, 15.5), C(988, 7, -987, 13.5), C(1002, 4, -987, 15),
  // round to the north, lift 2 up the east side
  C(1018, 4.5, -985, 14.8), C(1033, 5, -979, 14.5), C(1044, 5.5, -967, 12), C(1047, 6, -958, 4), C(1047, 9.5, -950, 3.6), C(1047, 13, -942, 3.4),
  // round to the west over the brake run, the hills along the mountain's north side
  C(1045, 13.4, -934, 3.4), C(1038, 13.3, -929, 4), C(1028, 12.8, -929, 7), C(1014, 10, -930, 10), C(1000, 6.5, -931, 13), C(986, 9.5, -931, 11), C(972, 6, -931, 13.5), C(958, 8.5, -931, 12), C(944, 5.5, -932, 14),
  // round to the south through the ice cave
  C(932, 5, -936, 14), C(922, 4.8, -945, 14), C(918, 4.6, -956, 14), C(920, 4.4, -966, 14),
  // round to the east along the mountain's foot: the avalanche
  C(928, 4.2, -972, 14), C(942, 4, -974, 14), C(960, 4.5, -974, 13.8), C(978, 4.2, -974, 13.8), C(996, 4, -974, 14), C(1012, 3.8, -973, 14),
  // round to the north, under lift 2's top, the brakes into the depot
  C(1024, 3.6, -969, 12), C(1031, 3.2, -960, 9), C(1033, 2.8, -948, 7), C(1033, 2.5, -936, 5), C(1031, 2.3, -926, 4), C(1023, 2.1, -919.5, 3), C(1010, 2, -918, 2.5),
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildSnowball(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // snow over the whole site
  add([S.x1 - S.x0, 0.06, S.z1 - S.z0], [(S.x0 + S.x1) / 2, FL + 0.03, (S.z0 + S.z1) / 2], SNOW, 'SmoothPlastic', { collide: 0 });

  // ======== the track
  const track = makeTrack(CIRCUIT);
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
  // clear of the trains (they're about 3.4 wide and ride 3.6 over the track)
  const clearOf = (size, pos, pad = 3.2) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 2.2 && pos[1] - ey < y + 4.6) return false;
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

  // ======== timber trestles under the track: two posts under the ties,
  // a cap beam and a brace in every bent
  let bents = 0;
  for (let s = 2; s < L - 2; s += 4) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    R.setFromMatrixColumn(m4, 0);
    R.y = 0; R.normalize();
    const top = P.y - 1.6;
    if (top - FL < 1.2) continue;
    const posts = [-1.7, 1.7].map((o) => [P.x + R.x * o, P.z + R.z * o]);
    if (posts.some(([x, z]) => near(x, z).some(([tx, ty, tz, c]) => Math.abs(c - s) > 12 && ty < top + 4 && Math.hypot(tx - x, tz - z) < 3.4))) continue;
    for (const [x, z] of posts) add([0.5, top - FL, 0.5], [x, (top + FL) / 2, z], TIMBER, 'Wood', { collide: 0 });
    // (the cap beam and the brace lie across the track: local x along R)
    const yaw = Math.atan2(-R.z, R.x), c = Math.cos(yaw), sn = Math.sin(yaw);
    add([4, 0.5, 0.6], [P.x, top - 0.2, P.z], DARKWOOD, 'Wood', { collide: 0, yaw });
    if (top - FL > 4) {
      const h = top - FL, len = Math.hypot(3.4, h), a = Math.atan2(h, 3.4), ca = Math.cos(a), sa = Math.sin(a);
      add([len, 0.3, 0.3], [P.x, FL + h / 2, P.z], DARKWOOD, 'Wood', { collide: 0, rot: [c * ca, -c * sa, sn, sa, ca, 0, -sn * ca, sn * sa, c] });
    }
    bents++;
  }

  // ======== the depot: a timber shed over the track, snow on the roof,
  // the SNOWBALL sign with a giant snowball on top
  const PL = { x0: 970, x1: 996, z0: -916, z1: -911.6 };
  add([PL.x1 - PL.x0, 0.5, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, FL + 0.25, (PL.z0 + PL.z1) / 2], 0x7a5a3a, 'WoodPlanks', { collide: 0 });
  add([PL.x1 - PL.x0, 0.08, 0.4], [(PL.x0 + PL.x1) / 2, FL + 0.52, PL.z0 + 0.25], 0xf2c418, 'SmoothPlastic', { collide: 0 });
  const SH = { x0: 968, x1: 998, z0: -924, z1: -910 };
  for (const x of [SH.x0, (SH.x0 + SH.x1) / 2, SH.x1]) for (const z of [SH.z0, SH.z1]) box([0.8, 8, 0.8], [x, FL, z], TIMBER, 'Wood');
  add([SH.x1 - SH.x0 + 3, 0.6, SH.z1 - SH.z0 + 3], [(SH.x0 + SH.x1) / 2, FL + 8.3, (SH.z0 + SH.z1) / 2], DARKWOOD, 'WoodPlanks', { collide: 0 });
  add([SH.x1 - SH.x0 + 3.4, 0.8, SH.z1 - SH.z0 + 3.4], [(SH.x0 + SH.x1) / 2, FL + 8.9, (SH.z0 + SH.z1) / 2], SNOW, 'SmoothPlastic', { collide: 0 });
  for (let k = 0; k < 8; k++) add([0.3, 0.9 + (k % 3) * 0.4, 0.3], [SH.x0 + 2 + k * 3.6, FL + 7.6 - (k % 3) * 0.2, SH.z1 + 1.4], ICE, 'Glass', { collide: 0, shape: 1, rot: RX(Math.PI), trans: 0.2 });
  sign([20, 3.2, 0.3], [(SH.x0 + SH.x1) / 2, FL + 11.2, SH.z1 + 1.2], INK, 'Back', [['SNOWBALL', 0, 0, 1, 0.66, 0x9ad8ff], ['SNOWBALL MINE  ·  ORE DEPOT', 0, 0.66, 1, 0.34, 0xf0c060, 'GothamBold']], { glow: true });
  add([7, 7, 7], [(SH.x0 + SH.x1) / 2, FL + 16.4, (SH.z0 + SH.z1) / 2 + 2], SNOW, 'SmoothPlastic', { collide: 0, shape: 3 });
  for (const [dx, dy] of [[-1.6, 0.6], [1.6, 0.6]]) add([0.6, 0.6, 0.4], [(SH.x0 + SH.x1) / 2 + dx, FL + 17 + dy, (SH.z0 + SH.z1) / 2 + 5.4], INK, 'SmoothPlastic', { collide: 0, shape: 3 });
  for (const x of [SH.x0 + 2, SH.x1 - 2]) { neon([0.6, 0.8, 0.6], [x, FL + 6.4, SH.z1 + 0.6], 0xffc070); data.hauntLights.push([x, FL + 6, SH.z1 + 1, 0xffc070]); }
  // the operator's booth, ore buckets on the platform
  const con = [995, -913];
  box([1.4, 1.4, 1.4], [con[0], FL + 0.5, con[1]], TIMBER, 'WoodPlanks', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.4 + k * 0.4, FL + 2, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  for (const x of [972.5, 975]) { box([1.2, 1, 1.2], [x, FL + 0.5, -912.2], RUST, 'CorrodedMetal', { collide: 0, shape: 5 }); add([1, 0.3, 1], [x, FL + 1.6, -912.2], ICE, 'Neon', { collide: 0, shape: 3 }); }

  // ======== the mountain inside the loop: snowy rock, blue ice, the mine
  // entrance, the giant snowball's slope
  const mound = (x, z, r, h, color = SNOW) => {
    if (!clearOf([r * 2, h, r * 2], [x, FL + h / 2, z])) return false;
    add([r * 2, h * 2, r * 2], [x, FL, z], color, color === SNOW ? 'SmoothPlastic' : 'Slate', { shape: 3, collide: 0 });
    return true;
  };
  for (const [x, z, r, h] of [[950, -952, 9, 9], [962, -950, 8, 12], [1010, -952, 8, 10], [1020, -955, 6, 7], [940, -958, 6, 6], [1000, -945, 6, 6], [968, -960, 5, 5], [1008, -962, 5, 5]]) {
    if (mound(x, z, r, h, 0x7a7068)) mound(x, z, r * 0.85, h + 1.2);
  }
  for (const [x, z, h] of [[955, -946, 8], [970, -955, 6], [1015, -948, 7], [945, -962, 5], [1005, -958, 6], [960, -940, 4]]) {
    if (!clearOf([2, h, 2], [x, FL + h / 2, z])) continue;
    for (let k = 0; k < 3; k++) add([1.2, h - k * 1.6, 1.2], [x + (k - 1) * 1.4, FL + (h - k * 1.6) / 2, z + (k % 2) * 1.2], ICE, 'Glass', { shape: 1, collide: 0, trans: 0.2, rot: RZ((k - 1) * 0.2) });
    neon([0.8, 0.8, 0.8], [x, FL + 1.2, z], 0x6ac8ff, { shape: 3 });
    data.hauntLights.push([x, FL + 3, z, 0x6ac8ff]);
  }
  // the mine entrance on the south face: a timber frame, a black mouth, a lantern
  const ME = [948, -966];
  if (clearOf([8, 7, 3], [ME[0], FL + 3.5, ME[1]])) {
    add([6, 5.6, 0.4], [ME[0], FL + 2.8, ME[1]], 0x050505, 'SmoothPlastic', { collide: 0 });
    for (const dx of [-3.2, 3.2]) add([0.6, 6, 0.6], [ME[0] + dx, FL + 3, ME[1] + 0.3], TIMBER, 'Wood', { collide: 0 });
    add([7.4, 0.7, 0.7], [ME[0], FL + 6.1, ME[1] + 0.3], TIMBER, 'Wood', { collide: 0 });
    sign([5, 0.9, 0.12], [ME[0], FL + 7, ME[1] + 0.7], 0xe8d8b0, 'Back', [['SNOWBALL MINE  ·  SHAFT 3', 0, 0, 1, 1, DARKWOOD, 'GothamBold']]);
    neon([0.5, 0.7, 0.5], [ME[0] + 3.2, FL + 4.4, ME[1] + 0.9], 0xffc070);
  }
  // the giant snowball, poised on its slope above the mountain's foot
  const SB = [985, -950], RAD = 5;
  add([16, 7, 12], [SB[0], FL + 3, SB[1] - 2], SNOW, 'SmoothPlastic', { shape: 1, collide: 0, rot: RY(0) });
  const extras = {}, extrasNames = [], props = [];
  const ball = [pp(3, [RAD * 2, RAD * 2, RAD * 2], [0, 0, 0], SNOW, 'SmoothPlastic')];
  for (const [x, y, z, c] of [[0, RAD, 0, IRON], [RAD * 0.7, 0, RAD * 0.7, TIMBER], [-RAD * 0.8, -RAD * 0.5, 0.4, IRON], [0.2, -RAD, -0.3, TIMBER], [-0.4, 0.3, -RAD, DARKWOOD]]) ball.push(pp(0, [1.4, 0.6, 2.2], [x, y, z], c, 'Wood'));
  extras.GiantSnowball = { pivot: [SB[0], FL + RAD, SB[1], 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: ball };
  const tRoll = tAt(960, -974);
  props.push({ name: 'GiantSnowball', at: [SB[0], FL + RAD, SB[1]], kind: 'roll', dir: [0, -1], reach: 12, radius: RAD, t0: tRoll, t1: tRoll + 2.2 });
  extrasNames.push('GiantSnowball');
  if (clearOf([6, 2, 3], [SB[0] + 9, FL + 1.5, -962])) {
    box([0.3, 2.6, 0.3], [SB[0] + 9, FL, -962], TIMBER, 'Wood', { collide: 0 });
    sign([3.6, 1.2, 0.12], [SB[0] + 9, FL + 2.6, -962.1], 0xf2c418, 'Front', [['DANGER  ·  AVALANCHE AREA', 0, 0, 1, 1, INK, 'GothamBold']]);
  }
  // the ice cave the train runs through on the west side
  for (let s = 0; s < L; s += 3) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    if (!(Math.abs(P.x - 918) < 6 && P.z < -944 && P.z > -967)) continue;
    // (each piece of the cave square to the track there)
    R.setFromMatrixColumn(m4, 0);
    R.y = 0; R.normalize();
    const yaw = Math.atan2(-R.z, R.x) + Math.PI / 2;
    for (const sd of [-1, 1]) add([1.4, 9, 3.4], [P.x + R.x * sd * 5.2, FL + 4.5, P.z + R.z * sd * 5.2], sd < 0 ? 0x5a6670 : 0x6a7680, 'Slate', { collide: 0, yaw });
    add([12, 1.6, 3.4], [P.x, P.y + 6.6, P.z], 0x8aa0b0, 'Slate', { collide: 0, yaw });
    add([9.6, 0.4, 3.2], [P.x, P.y + 5.6, P.z], ICE, 'Glass', { collide: 0, trans: 0.3, yaw });
    if (Math.round(s / 3) % 2) neon([0.3, 1.6, 0.3], [P.x + R.x * 4.3, P.y + 4, P.z + R.z * 4.3], 0x6ac8ff);
  }
  data.hauntLights.push([918, FL + 6, -956, 0x6ac8ff]);

  // ======== the line: from the base's east-west walk, timber rails, three rows
  const rail = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.3, 1.2, 0.3], [xa + ((xb - xa) * k) / n, FL, z], TIMBER, 'Wood');
    add([xb - xa, 0.2, 0.2], [(xa + xb) / 2, FL + 1.1, z], DARKWOOD, 'Wood', { collide: 0 });
  };
  rail(1000, 1043, -906.5);
  rail(1003, 1048, -909.5);
  rail(1000, 1048, -912.6);
  const fwd = [[1046, -902], [1046, -905], [1001, -905], [1001, -908], [1046, -908], [1046, -911], [998, -911], [996, -913.2]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], FL);
  sign([0.3, 1.8, 8], [1050, FL + 3.4, -906], INK, 'Right', [['SNOWBALL  ·  MINE TRAIN', 0, 0, 1, 1, 0x9ad8ff, 'GothamBold']], { glow: true });
  box([0.3, 3, 0.3], [1050, FL, -909], TIMBER, 'Wood', { collide: 0 });
  const waitPart = add([0.3, 1.2, 4], [1050.2, FL + 5.4, -906], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'FrostbiteBase', seed: 433, cf: cf(1049, FL, -900, Math.PI / 2) });
  // the exit: off the platform's west end, north to the walk
  add([3, 0.2, 12], [965, FL + 0.12, -908], 0xc8d4dc, 'Concrete', { collide: 0 });
  for (const z of [-920, -940, -960]) {
    if (!clearOf([1, 7, 1], [1052, FL + 3.5, z], 2)) continue;
    box([0.3, 6, 0.3], [1052, FL, z], TIMBER, 'Wood', { collide: 0 });
    add([0.8, 0.8, 0.8], [1052, FL + 6.3, z], 0xffd890, 'Neon', { collide: 0, shape: 3 });
    data.tags.ParkLamp.push([1052, FL + 6.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ======== the cars: a little green locomotive and four rusty ore carts
  const carParts = (k) => {
    const out = [
      pp(0, [3, 0.4, 3.2], [0, 0.35, 0], IRON, 'Metal'),
      ...[-1.6, 1.6].flatMap((z) => [-1.3, 1.3].map((x) => pp(2, [0.3, 0.9, 0.9], [x, 0.2, z * 0.7], INK, 'Metal'))),
    ];
    if (k === 0) {
      out.push(pp(2, [2.2, 2.2, 3], [0, 1.6, -0.4], LOCO, 'Metal', [0, 0, 1, 0, 1, 0, -1, 0, 0]));
      out.push(pp(5, [0.8, 1.6, 0.8], [0, 3.2, -1.2], INK, 'Metal'));
      out.push(pp(5, [1.2, 0.3, 1.2], [0, 4, -1.2], INK, 'Metal'));
      out.push(pp(3, [0.6, 0.6, 0.3], [0, 1.8, -1.95], 0xfff0c0, 'Neon'));
      out.push(pp(0, [2.6, 0.5, 0.4], [0, 0.6, -1.9], BRASS, 'Metal'));
      out.push(pp(0, [2.6, 1.8, 1.4], [0, 1.4, 1], LOCO, 'Metal'));
      out.push(pp(0, [2.8, 0.2, 1.6], [0, 2.4, 1], BRASS, 'Metal'));
      for (const x of [-0.6, 0.6]) {
        out.push(pp(0, [1.1, 0.3, 0.9], [x, 1.25, 1.1], DARKWOOD, 'Fabric'));
      }
    } else {
      out.push(pp(0, [3, 1.4, 3.2], [0, 1.2, 0], RUST, 'CorrodedMetal'));
      out.push(pp(0, [3.1, 0.25, 3.3], [0, 1.9, 0], IRON, 'Metal'));
      out.push(pp(0, [3.05, 0.2, 0.2], [0, 1.2, -1.6], IRON, 'Metal'));
      for (const z of [-0.85, 0.75]) for (const x of [-0.75, 0.75]) {
        out.push(pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], DARKWOOD, 'Fabric'));
        out.push(pp(0, [1.1, 1, 0.2], [x, 1.8, z + 0.5], DARKWOOD, 'Fabric'));
      }
      out.push(pp(0, [0.6, 0.3, 0.6], [1.3, 1.95, 1.4], ICE, 'Neon'));
    }
    return out;
  };
  const seatList = (k) => (k === 0
    ? [-0.6, 0.6].map((x) => [x, 1.4 + 1.3, 1.05, 1, 0, 0, 0, 1, 0, 0, 0, 1])
    : [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1])));
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList(k));
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, FL, PL.z0 + 0.9, 0));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2, 3], [4, 5]],
    console: cf(con[0], FL, con[1] - 0.9, 0), operator: cf(con[0] - 1, FL, con[1] - 0.6, 0),
    homes: [cf(985, FL, -913, 0), cf(975, FL, -913, 0)],
    exit: cf(965, FL, -913, Math.PI),
  };

  // ======== the ride
  const origin = [968, FLOOR, -952];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: 2 + (CARS - 1) * 4, queue: qpath, trackStyle: { style: 'wood' }, extras, extrasNames, props, crew,
    noExtended: true,
  };
  data.rides.push(ride);
  const at = (x, z) => tAt(x, z) / ride.duration;
  // a burst of snow where the snowball stops, a puff of snow off the first drop
  const cues = [[at(978, -974), 'snow', [0, 1, -7]], [at(900, -954), 'snow', [0, 0, 0]]];
  const rides = data.config.Rides;
  rides.push({
    id: RIDE_ID, name: 'Snowball', land: 'FrostbiteBase', category: 'Family', thrill: 3, kind: 'coaster', carStyle: 'coaster',
    description: "A mine train coaster in Frostbite Base, down in the Lower Lot. Ride the ore trains of the old Snowball Mine: up the lift along the edge of the base, a drop down the west side, bunny hops along the foot of the cliffs, a second lift, then round the mountain - over the brake run, past the mine and through the ice cave - until the giant snowball breaks loose and comes rolling down at you.",
    baseWait: 45, origin, entrance: [1046, FLOOR, -902], exit: [965, FLOOR, -903], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TIMBER, RUST, LOCO], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), "Snowball is open in Frostbite Base - watch out for the avalanche!"];
  return { ride, entrance: [1046, -902], bents };
}

// a toast the first time you come near
export class SnowballSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const [x, z] = this.layout.entrance;
    if (pos.y < FLOOR + 10 && Math.hypot(pos.x - x, pos.z - z) < 60) {
      this.told = true;
      this.hooks.toast('NEW: Snowball - a mine train through Frostbite Base! Two lifts, an ice cave... and watch out for the avalanche.', 'reward');
    }
  }
}
