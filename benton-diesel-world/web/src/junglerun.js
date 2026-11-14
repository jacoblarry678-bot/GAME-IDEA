// Jungle Run: a river rapids ride south of Siren's Wake (through a gate in
// Siren's Wake's south wall, down the walk past the harbor). Round
// six-seat rafts float a winding river through the jungle and the ruins of
// a lost temple: up the log ramp, down the rapids past the rocks and the
// geysers, round the whirlpool, under a waterfall, through the temple
// cave, over the big drop, past the crocodiles and the stone idol, and home
// to the boathouse. The rafts turn freely as they go (each its own way)
// and bob on the water; you will get splashed.
//
// The river is a flume channel (its water drawn by the track renderer);
// the rafts' spin is the coaster spin (rides.js) and their bobbing the
// ride's "bob". Every rock, statue and tree is placed clear of the rafts.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'JungleRun';
const SITE = { x0: 1006, x1: 1250, z0: -470, z1: -238 };
const SWGATE = { x0: 1007, x1: 1021 }; // in Siren's Wake's south wall (z -236)
const G = 0.1;
const RAFTS = 6, SPACING = 7.5;
const BAMBOO = 0xc8b060, THATCH = 0xc8a050, WOOD = 0x6a4a2a, STONE = 0x8a8a78, MOSS = 0x5a7a3a, LEAF = 0x2a7a2a, WATER = 0x2a8aa0, ORANGE = 0xff8a2a, RED = 0xd83a2a, YELLOW = 0xf8d030, BLUE = 0x2a8ad8;

// the river (x, y of the water's floor, z, speed), from the boathouse
const CIRCUIT = [
  [1072, 0.2, -262, 1.5], [1088, 0.2, -262, 3],
  // up the log ramp
  [1104, 0.6, -264, 3], [1120, 4, -266, 2.5], [1140, 8, -268, 2.5], [1156, 9.6, -270, 3],
  // the rapids, south
  [1172, 9.6, -272, 4], [1190, 9.4, -280, 4.5], [1200, 9.2, -296, 4.5],
  [1206, 8.8, -314, 5], [1200, 8.4, -330, 5], [1208, 8, -346, 5.5], [1202, 7.6, -362, 5],
  // the whirlpool
  [1210, 7.4, -380, 4.5], [1222, 7.2, -396, 4], [1214, 7, -414, 4], [1196, 6.8, -420, 4.5],
  // under the waterfall, and through the temple cave
  [1176, 6.6, -430, 5], [1150, 6.2, -436, 5.5], [1124, 5.8, -440, 5.5],
  [1100, 5.4, -446, 5], [1076, 5, -446, 5],
  // the big drop
  [1060, 4.6, -444, 6], [1046, 1.2, -440, 9], [1036, 0.6, -430, 7],
  // north past the geysers, then east through the crocodiles' backwater
  [1028, 0.5, -414, 6], [1032, 0.5, -396, 5.5], [1026, 0.45, -378, 5],
  [1034, 0.45, -360, 5], [1052, 0.45, -352, 5], [1078, 0.45, -350, 5], [1104, 0.4, -342, 5], [1130, 0.4, -336, 5],
  // round past the stone idol, and home
  [1150, 0.35, -322, 4.5], [1152, 0.35, -304, 4.5], [1140, 0.3, -290, 4], [1116, 0.25, -284, 3.5], [1090, 0.2, -284, 3],
  [1050, 0.2, -284, 3], [1026, 0.2, -278, 2.5], [1020, 0.2, -268, 2], [1032, 0.2, -262, 1.5], [1052, 0.2, -262, 1.5],
];

export function buildJungleRun(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RYm = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x4a7a34, 'Grass');
  // a gate in Siren's Wake's south wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 236) < 0.6 && Math.abs(p[4] - 1127) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(1004, -236, SWGATE.x0, -236);
  wallSeg(SWGATE.x1, -236, 1250, -236);
  wallSeg(1250, -236, 1250, SITE.z0);
  wallSeg(1250, SITE.z0, 1004, SITE.z0);
  wallSeg(1004, SITE.z0, 1004, -400);
  // the gate: bamboo posts, a carved board, torches
  const gx = (SWGATE.x0 + SWGATE.x1) / 2;
  for (const x of [SWGATE.x0 + 0.8, SWGATE.x1 - 0.8]) {
    for (const dx of [-0.4, 0.4]) box([0.5, 16, 0.5], [x + dx, G, -236], BAMBOO, 'Wood', { shape: 5 });
    data.tags.Campfire.push([x, G + 16.4, -236, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  add([SWGATE.x1 - SWGATE.x0 + 2, 2.6, 0.8], [gx, G + 13.4, -236], WOOD, 'WoodPlanks', { collide: 0 });
  sign([SWGATE.x1 - SWGATE.x0, 2, 0.2], [gx, G + 13.4, -236.6], WOOD, 'Front', [['JUNGLE RUN', 0, 0, 1, 1, YELLOW]], { glow: true });
  sign([SWGATE.x1 - SWGATE.x0, 2, 0.2], [gx, G + 13.4, -235.4], WOOD, 'Back', [['JUNGLE RUN  ·  THIS WAY', 0, 0, 1, 1, YELLOW]], { glow: true });
  // the walk: on from Siren's Wake's harbor front, down the west side
  for (const [a, b] of [[[1014, -16], [1014, -236]], [[1014, -236], [1014, -240]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    W.add([8, 0.4, len + 8], [(a[0] + b[0]) / 2, 0.22, (a[1] + b[1]) / 2], 0x8a7a5a, 'Pavement', { collide: 0 });
    LINES.push([new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])]);
  }

  // ======== the river
  const track = makeTrack(CIRCUIT);
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
  // clear of the river: the channel's walls (3.7 out) and the rafts and
  // their riders (up to 5 above the water's floor)
  const clearOf = (size, pos, rot = null) => {
    let ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    if (rot) {
      ex = (Math.abs(rot[0]) * size[0] + Math.abs(rot[1]) * size[1] + Math.abs(rot[2]) * size[2]) / 2;
      ey = (Math.abs(rot[3]) * size[0] + Math.abs(rot[4]) * size[1] + Math.abs(rot[5]) * size[2]) / 2;
      ez = (Math.abs(rot[6]) * size[0] + Math.abs(rot[7]) * size[1] + Math.abs(rot[8]) * size[2]) / 2;
    }
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < 3.9 && pos[1] + ey > y - 2 && pos[1] - ey < y + 5.2) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos, o.rot || (o.yaw ? RYm(o.yaw) : null)) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  // the raised channel stands on timber trestles
  for (let s = 6; s < track.length - 6; s += 6) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    if (P.y < 1.6) continue;
    const top = P.y - 1.7;
    if (near(P.x, P.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < top && Math.hypot(x - P.x, z - P.z) < 5)) continue;
    R.setFromMatrixColumn(m4, 0);
    for (const side of [-1, 1]) add([0.8, top - G, 0.8], [P.x + R.x * side * 2.6, (top + G) / 2, P.z + R.z * side * 2.6], WOOD, 'Wood', { collide: 0 });
    add([6.4, 0.6, 0.8], [P.x, top - 0.3, P.z], WOOD, 'Wood', { collide: 0, yaw: Math.atan2(R.x, R.z) - Math.PI / 2 });
  }

  // ======== the plaza and the line
  const fwd = [[1014, -228], [1014, -238], [1018, -241], [1100, -241], [1100, -246], [1030, -246], [1030, -251], [1086, -251], [1086, -255.6], [1062, -255.6]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], G);
  const railX = (a, b, z) => {
    add([b - a, 0.3, 0.3], [(a + b) / 2, G + 2.6, z], BAMBOO, 'Wood', { collide: 0, shape: 2 });
    add([b - a, 0.22, 0.22], [(a + b) / 2, G + 1.5, z], BAMBOO, 'Wood', { collide: 0, shape: 2 });
    const n = Math.max(1, Math.round((b - a) / 4));
    for (let k = 0; k <= n; k++) box([0.4, 2.9, 0.4], [a + ((b - a) * k) / n, G, z], BAMBOO, 'Wood', { shape: 5 });
  };
  // (each rail leaves a gap at the end where the line turns)
  railX(1022, 1096, -243.5);
  railX(1034, 1104, -248.5);
  railX(1034, 1082, -253.3);
  add([92, 0.12, 22], [1062, G + 0.06, -248], 0x9a8460, 'Ground', { collide: 0 });
  // the entrance sign and the wait time
  box([0.5, 7, 0.5], [1022, G, -238.6], WOOD, 'Wood');
  sign([9, 2.6, 0.3], [1022, G + 7.6, -238.6], WOOD, 'Back', [['JUNGLE RUN', 0, 0, 1, 0.6, YELLOW], ['RIVER RAPIDS  ·  YOU WILL GET WET', 0, 0.6, 1, 0.4, 0xf4ecd8, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [1034, G, -238.6], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [1040, G + 9, -238.6], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 111, cf: cf(1018, G, -244, Math.PI) });
  for (const x of [1024, 1060, 1096]) { box([0.4, 4, 0.4], [x, G, -239], BAMBOO, 'Wood', { collide: 0 }); data.tags.Campfire.push([x, G + 4.3, -239, 1, 0, 0, 0, 1, 0, 0, 0, 1]); light(x, 5, -240, 0xffa040); }

  // ======== the boathouse: a thatched roof over the dock
  add([60, 0.3, 4.4], [1056, G + 0.15, -255.8], 0x8a6a4a, 'WoodPlanks', { collide: 0 });
  for (let x = 1028; x <= 1086; x += 9.6) for (const z of [-253.4, -270.4]) box([0.7, 9, 0.7], [x, G, z], WOOD, 'Wood', { shape: 5, collide: z < -260 ? 1 : 0 });
  add([62, 0.4, 10], [1057, G + 10.6, -257.4], THATCH, 'Fabric', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.35), -Math.sin(0.35), 0, Math.sin(0.35), Math.cos(0.35)] });
  add([62, 0.4, 10], [1057, G + 10.6, -266.6], THATCH, 'Fabric', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.35), -Math.sin(-0.35), 0, Math.sin(-0.35), Math.cos(-0.35)] });
  sign([24, 2.6, 0.3], [1056, G + 6.6, -253.2], WOOD, 'Back', [['JUNGLE RUN  ·  RIVER EXPEDITIONS', 0, 0, 1, 0.6, YELLOW], ['ONE RAFT PER CREW  ·  STOW YOUR HATS', 0, 0.6, 1, 0.4, 0xf4ecd8, 'GothamBold']], { glow: true });
  for (const x of [1032, 1050, 1078]) add([1.2, 1.2, 0.3], [x, G + 4, -253.6], ORANGE, 'Rubber', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  const con = [1088, -254.6];
  box([1.4, 3, 2.4], [con[0], G, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(1056, 8, -258, 0xffd890);

  // ======== the jungle and the ruins
  // a waterwheel by the log ramp
  for (let k = 0; k < 8; k++) S([0.4, 9, 1.2], [1132, G + 5.4, -276], WOOD, 'WoodPlanks', { collide: 0, rot: RZ(k * Math.PI / 8) });
  S([1.4, 1.4, 1.6], [1132, G + 5.4, -276], 0x3a2a1a, 'Wood', { shape: 2, collide: 0 });
  // rocks along the rapids, geysers, spray
  for (let k = 0; k < 18; k++) {
    const s = 60 + k * 9;
    sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); R.setFromMatrixColumn(m4, 0);
    const side = k % 2 ? 1 : -1, d = 4.6 + (k % 3) * 0.8;
    SB([2 + (k % 3), 1.6 + (k % 2) * 1.4, 2 + ((k + 1) % 3)], [P.x + R.x * side * d, Math.max(G, P.y - 1.8), P.z + R.z * side * d], STONE, 'Slate', { collide: 0, yaw: k * 0.7 });
  }
  for (const [x, z] of [[1196, -320], [1214, -350], [1020, -404], [1040, -386]]) data.tags.SteamVent.push([x, G + 0.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // the whirlpool: a mossy rock island inside the swirl, a broken statue on it
  SB([9, 6, 8], [1208, G, -398], STONE, 'Slate', { collide: 0 });
  SB([4, 1, 4], [1208, G + 6, -398], MOSS, 'Slate', { collide: 0 });
  SB([1.4, 5, 1.4], [1208, G + 7, -398], 0x9a9a88, 'Slate', { collide: 0, rot: RZ(0.2) });
  // the waterfall: a cliff, and a curtain of water over the river (you go under)
  SB([10, 20, 6], [1150, G, -448], STONE, 'Slate', { collide: 0 });
  add([10, 0.3, 8], [1150, G + 19.8, -443], MOSS, 'Grass', { collide: 0 });
  add([6, 13, 0.3], [1150, G + 13.5, -436], 0x9ad8ff, 'Glass', { collide: 0, trans: 0.55 });
  data.tags.SteamVent.push([1150, G + 0.4, -441, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(1150, 8, -432, 0x9ad8ff);
  // the temple cave: stone walls either side, a lintel overhead, carvings
  for (let x = 1078; x <= 1100; x += 7.3) {
    for (const dz of [-5.4, 5.4]) SB([2, 12, 2], [x, G, -446 + dz], STONE, 'Slate', { collide: 0 });
    S([3, 2, 13], [x, G + 13, -446], STONE, 'Slate', { collide: 0 });
  }
  S([28, 1.4, 14], [1089, G + 14.7, -446], MOSS, 'Slate', { collide: 0 });
  for (const x of [1082, 1096]) S([0.3, 3, 2.4], [x, G + 7, -451.6], 0xd8b040, 'Neon', { collide: 0 });
  light(1089, 9, -446, 0xff9a40);
  // the stone idol: a giant face in the jungle, eyes glowing
  const idol = [1172, -318];
  SB([10, 14, 6], [idol[0], G, idol[1]], STONE, 'Slate', { collide: 0 });
  S([10.4, 2, 6.4], [idol[0], G + 14.4, idol[1]], MOSS, 'Slate', { collide: 0 });
  for (const dx of [-2.2, 2.2]) S([1.8, 1.2, 0.4], [idol[0] + dx, G + 10, idol[1] - 3.1], 0xff6a20, 'Neon', { collide: 0 });
  S([1.4, 3, 1.2], [idol[0], G + 7.4, idol[1] - 3.2], STONE, 'Slate', { collide: 0 });
  S([5, 1.2, 0.5], [idol[0], G + 4.4, idol[1] - 3.1], 0x2a2a20, 'Slate', { collide: 0 });
  light(idol[0], 8, idol[1] - 6, 0xff8a40);
  // crocodiles basking on the banks of the backwater
  const croc = (x, z, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (d) => [x + s * d, z + c * d];
    for (const [d, w, h, y] of [[0, 1.8, 0.9, 0.5], [2, 1.4, 0.7, 0.4], [-2, 1.4, 0.7, 0.45], [-3.6, 0.9, 0.5, 0.35], [3.6, 1, 0.5, 0.35]]) {
      const [px, pz] = at(d);
      S([w, h, 2.2], [px, G + y, pz], 0x3a5a2a, 'Slate', { collide: 0, yaw });
    }
    const [ex, ez] = at(3.2);
    for (const sx of [-0.5, 0.5]) S([0.25, 0.25, 0.25], [ex + c * sx, G + 0.9, ez - s * sx], YELLOW, 'Neon', { collide: 0, shape: 3 });
  };
  croc(1060, -362, 1.2); croc(1100, -330, -0.6); croc(1120, -356, 2.4);
  // parrots on perches
  for (const [x, z, col] of [[1046, -330, RED], [1090, -366, BLUE], [1160, -300, YELLOW], [1190, -440, RED]]) {
    if (SB([0.3, 7, 0.3], [x, G, z], WOOD, 'Wood', { collide: 0 }) < 0) continue;
    S([0.8, 1.2, 0.8], [x, G + 7.6, z], col, 'SmoothPlastic', { shape: 3, collide: 0 });
    S([0.3, 1.6, 0.4], [x, G + 6.8, z + 0.3], col === RED ? BLUE : RED, 'SmoothPlastic', { collide: 0 });
  }
  // ruins: broken columns and fallen blocks all round
  for (const [x, z, h] of [[1040, -300], [1070, -310], [1120, -300], [1180, -360], [1230, -330], [1236, -440], [1100, -400], [1060, -400], [1140, -390], [1020, -330]].map(([x, z], k) => [x, z, 4 + (k % 4) * 2])) {
    SB([2.4, h, 2.4], [x, G, z], STONE, 'Slate', { shape: 5, collide: 0 });
    S([3, 0.8, 3], [x, G + h + 0.4, z], MOSS, 'Slate', { collide: 0 });
  }
  // the jungle: palms and broadleaf trees wherever they're clear of the river
  let trees = 0;
  for (let k = 0; k < 220 && trees < 70; k++) {
    const x = SITE.x0 + 6 + ((k * 37) % 100) / 100 * (SITE.x1 - SITE.x0 - 12), z = SITE.z0 + 6 + ((k * 61) % 100) / 100 * (SITE.z1 - SITE.z0 - 30);
    if (z > -262) continue; // the plaza and boathouse
    if (near(x, z).some(([sx, , sz]) => Math.hypot(sx - x, sz - z) < 8)) continue;
    data.trees.push({ leaf: k % 3 ? 0x2a7a2a : 0x3a8a3a, kind: k % 3 ? 'palm' : 'round', s: 1 + ((k * 7) % 6) / 10, pos: [x, 0, z] });
    trees++;
  }
  // lamps: torches on poles
  for (const [x, z] of [[1030, -300], [1080, -320], [1140, -350], [1240, -300], [1240, -400], [1120, -460], [1050, -460], [1010, -440]]) {
    if (!clearOf([1, 6, 1], [x, 3, z])) continue;
    box([0.4, 5, 0.4], [x, G, z], WOOD, 'Wood', { collide: 0 });
    data.tags.Campfire.push([x, G + 5.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    light(x, 6, z, 0xffa040);
  }
  for (let s = 20; s < track.length - 20; s += 30) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, P.y + 6, P.z, 0xd8ffb0); }

  // ======== the rafts: round, six seats facing in, a bright tube round the edge
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const tubes = [YELLOW, ORANGE, BLUE, RED, 0x3ad87a, 0xb05aff];
  const raftParts = (k) => {
    const parts = [
      pp(5, [5, 0.9, 5], [0, 0.45, 0], 0x3a3a3e, 'Rubber'),
      pp(5, [5.6, 1, 5.6], [0, 1.1, 0], tubes[k % tubes.length], 'Rubber'),
      pp(5, [5.2, 0.2, 5.2], [0, 1.62, 0], 0x2a2a2e, 'Rubber'),
      pp(5, [1.2, 1.6, 1.2], [0, 1.3, 0], 0x2a2a2e, 'Metal'),
      pp(5, [1.4, 0.2, 1.4], [0, 2.1, 0], 0xd8b040, 'Metal'),
    ];
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2, th = Math.PI / 2 - a, rot = RYm(th);
      parts.push(pp(0, [1.1, 0.35, 1.0], [Math.cos(a) * 1.7, 0.95, Math.sin(a) * 1.7], 0x1a2a3a, 'Fabric', rot));
      parts.push(pp(0, [1.2, 1.3, 0.3], [Math.cos(a) * 2.3, 1.6, Math.sin(a) * 2.3], tubes[(k + 3) % tubes.length], 'SmoothPlastic', rot));
    }
    return parts;
  };
  const seatList = () => Array.from({ length: 6 }, (_, j) => {
    const a = (j / 6) * Math.PI * 2;
    return [Math.cos(a) * 1.7, 1.125 + 1.3, Math.sin(a) * 1.7, ...RYm(Math.PI / 2 - a)];
  });
  const cars = [], seats = [];
  for (let k = 0; k < RAFTS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: raftParts(k) });
    seats.push(seatList());
  }

  // ======== the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < RAFTS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, G, -256.2, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'none', attendants: 2, routes: [[1, 2, 3], [4, 5, 6]],
    console: cf(con[0], G, con[1], Math.PI), operator: cf(con[0], G, con[1] + 1.4, Math.PI),
    homes: [cf(1040, G, -255, Math.PI), cf(1070, G, -255, Math.PI)],
    exit: cf(1030, G, -255, 0),
  };

  // ======== the ride
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const origin = [1130, 0, -360];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: RAFTS, carSpacing: SPACING, cars, seats,
    capacity: RAFTS * 6, queue: qpath, trackStyle: { style: 'flume' }, extras: {}, extrasNames: [], crew,
    spin: { from: sAt(1172, -272), to: sAt(1090, -284), gain: 0.06, drag: 0.4 }, bob: 0.22,
  };
  data.rides.push(ride);
  const at = (x, z) => track.times[track.cum.indexOf(sAt(x, z))] / ride.duration;
  // splashes at the rapids, the falls, the big drop and the geysers
  const cues = [
    [at(1206, -314), 'splash', [0, 0.6, 0]], [at(1208, -346), 'splash', [0, 0.6, 0]], [at(1150, -436), 'flood', [0, -10, 0]],
    [at(1046, -440), 'splash', [0, 0.6, 0]], [at(1036, -430), 'splash', [0, 0.6, 0]], [at(1030, -396), 'splash', [3, 0.6, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Jungle Run', land: 'Velocity', category: 'Family', thrill: 3, kind: 'flume', carStyle: 'log',
    description: 'River rapids through the jungle and the ruins of a lost temple: six to a round raft, up the log ramp, down the rapids past the geysers, round the whirlpool, under the waterfall, through the temple cave, over the big drop and past the crocodiles and the stone idol. Your raft spins its own way - someone always gets soaked.',
    baseWait: 40, origin, entrance: [1022, 0, -238], exit: [1014, 0, -230], yaw: 0, layout: RIDE_ID,
    cars: RAFTS, carSpacing: SPACING, colors: [WATER, YELLOW, ORANGE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Jungle Run is open - you will get wet!', 'Six to a raft, hold on to your hats!'];
  return { ride, gate: { x: gx, z: -236 } };
}

// a toast the first time you come near the new ride
export class JungleRunSite {
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
      this.hooks.toast('NEW: Jungle Run, river rapids through the jungle! Through the bamboo gate south of Siren\'s Wake - you will get wet.', 'reward');
    }
  }
}
