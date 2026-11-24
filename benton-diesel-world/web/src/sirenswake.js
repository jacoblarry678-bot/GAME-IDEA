// Siren's Wake: an indoor inverted water coaster, in an old harbor
// warehouse south of Neon Getaway (through a gate in Neon Getaway's south
// wall). Outside: a lighthouse, and the bow of the wrecked Benton Belle
// bursting out through the wall. The line winds through the harbor
// master's office; you board the Belle's hanging gondolas on the dock and
// sail into the storm: up through lightning and rain, down into the
// sirens' lagoon (feet first, into the water, with a wall of spray), a
// zero-g roll over the whirlpool, through the broken hull of the Belle and
// a second splashdown, up through a kelp forest, past the sea serpent and
// through a waterfall into a third splash, and home to the dock.
//
// Built like King Mamba: the track is turned over so the trains hang
// beneath it, and every support and piece of scenery is placed only where
// no train passes (the waterfall excepted: you're meant to go through it).
// The lagoons are real water surfaces; the splashes are ride cues.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'SirensWake';
const SITE = { x0: 1006, x1: 1250, z0: -236, z1: -2 };
const B = { x0: 1040, x1: 1236, z0: -228, z1: -30, H: 34 };
const DOOR_IN = 1220, DOOR_OUT = 1060;
const NGGATE = { x0: 1007, x1: 1021 }; // in Neon Getaway's south wall (z 0)
const G = 0.1, WATER = 1.0;
const CARS = 8, SPACING = 3.2;
const TEAL = 0x2ad8c8, SEA = 0x1a5a6a, WOOD = 0x5a4632, DARKWOOD = 0x3a2c20, BRASS = 0xc8a040, ROPE = 0xc8b088, STONE = 0x6a6e70, WHITE = 0xf4f4f0, RED = 0xc8322d;
const TRACK_COLOR = 0x1a6a7a;

const CIRCUIT = [
  [1100, 6, -88, 2], [1084, 6, -88, 5], [1068, 7, -90, 6], [1056, 8, -98, 6],
  // the lift, up into the storm
  [1051, 10, -110, 5], [1050, 16, -122, 4], [1050, 24, -138, 4], [1050, 29, -152, 4],
  [1052, 30, -162, 6], [1062, 29.5, -170, 8], [1076, 27, -173, 12],
  // the drop into the sirens' lagoon: splash!
  [1092, 20, -174, 18], [1108, 11, -174, 24], [1124, 5.4, -174, 26], [1140, 6.4, -175, 25],
  // the zero-g roll over the whirlpool
  [1156, 10, -176, 22], [1172, 13, -176, 20], [1188, 10, -176, 22], [1202, 8, -180, 24],
  // round into the wreck of the Belle, and the second splash
  [1214, 9, -192, 22], [1210, 10, -206, 21], [1196, 11, -214, 21],
  [1176, 12, -215, 20], [1156, 12.5, -215, 19], [1138, 11, -215, 20],
  [1120, 5.4, -214, 24], [1104, 6, -213, 24],
  // north through the kelp, under the lift's crest
  [1084, 8, -210, 22], [1068, 10, -200, 20], [1062, 11, -184, 19],
  [1063, 11, -166, 18], [1064, 10, -148, 18], [1066, 9, -136, 18],
  // past the sea serpent, through the waterfall into the third splash
  [1078, 8, -129, 18], [1096, 7, -128, 19], [1114, 5.4, -128, 21], [1130, 5.4, -128, 21], [1146, 6.5, -128, 20],
  [1166, 8, -128, 18], [1186, 9, -127, 16],
  // home to the dock
  [1206, 9.5, -122, 15], [1214, 9, -110, 13], [1212, 8, -98, 11],
  [1200, 7, -90, 9], [1184, 6.5, -88, 7], [1166, 6, -88, 5], [1148, 6, -88, 3], [1124, 6, -88, 2],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildSirensWake(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Lighthouse = data.tags.Lighthouse || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.terrain = data.terrain || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x6a6658, 'Pavement');
  // a gate in Neon Getaway's south wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6]) < 0.6 && Math.abs(p[4] - 1127) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(1004, 0, NGGATE.x0, 0);
  wallSeg(NGGATE.x1, 0, 1250, 0);
  wallSeg(1250, 0, 1250, SITE.z0);
  wallSeg(1250, SITE.z0, 1004, SITE.z0);
  const gx = (NGGATE.x0 + NGGATE.x1) / 2;
  for (const x of [NGGATE.x0 + 0.8, NGGATE.x1 - 0.8]) {
    box([1.4, 15, 1.4], [x, G, 0], DARKWOOD, 'Wood');
    for (let k = 0; k < 4; k++) add([1.7, 0.3, 1.7], [x, G + 3 + k * 3.4, 0], ROPE, 'Fabric', { collide: 0 });
  }
  add([NGGATE.x1 - NGGATE.x0 + 1, 1.4, 1.4], [gx, G + 15.2, 0], DARKWOOD, 'Wood', { collide: 0 });
  sign([NGGATE.x1 - NGGATE.x0 - 1, 2.2, 0.2], [gx, G + 13.6, -0.9], 0x0e2a30, 'Front', [["SIREN'S WAKE", 0, 0, 1, 1, TEAL]], { glow: true });
  sign([NGGATE.x1 - NGGATE.x0 - 1, 2.2, 0.2], [gx, G + 13.6, 0.9], 0x0e2a30, 'Back', [["SIREN'S WAKE  ·  THIS WAY", 0, 0, 1, 1, TEAL]], { glow: true });
  // the walks: from Neon Getaway's path, down the side and along the harbor front
  const route = [[1014, 212], [1014, 0], [1014, -16], [DOOR_IN, -16], [DOOR_IN, B.z1 + 2]];
  const exitRoute = [[DOOR_OUT, B.z1 + 2], [DOOR_OUT, -16]];
  for (const r of [route, exitRoute]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.22, (za + zb) / 2], r === route && i === 0 ? 0xd8c8b0 : 0x8a7a62, r === route && i === 0 ? 'Pavement' : 'WoodPlanks', { yaw, collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }

  // ======== the harbor warehouse
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], WOOD, 'WoodPlanks');
  box([T, B.H, B.z1 - B.z0], [B.x1 - T / 2, G, cz], WOOD, 'WoodPlanks');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], WOOD, 'WoodPlanks');
  let xa = B.x0;
  for (const d of [DOOR_OUT, DOOR_IN]) {
    box([d - 3.5 - xa, B.H, T], [(xa + d - 3.5) / 2, G, B.z1 - T / 2], WOOD, 'WoodPlanks');
    box([7, B.H - 10, T], [d, G + 10, B.z1 - T / 2], WOOD, 'WoodPlanks');
    xa = d + 3.5;
  }
  box([B.x1 - xa, B.H, T], [(xa + B.x1) / 2, G, B.z1 - T / 2], WOOD, 'WoodPlanks');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0x3a4a4a, 'CorrodedMetal', { collide: 0 });
  // a stone base, rope trim, and a row of round windows glowing sea-green
  for (const [w, d, x, z] of [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz], [0.3, B.z1 - B.z0, B.x1 + 0.2, cz], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2]]) {
    add([w, 4, d], [x, G + 2, z], STONE, 'Slate', { collide: 0 });
    add([w + 0.2, 0.5, d + 0.2], [x, G + 29, z], ROPE, 'Fabric', { collide: 0 });
  }
  for (let x = B.x0 + 8; x < B.x1 - 6; x += 12) {
    if (Math.abs(x - DOOR_IN) < 8 || Math.abs(x - DOOR_OUT) < 8 || (x > 1100 && x < 1140)) continue;
    add([2.4, 2.4, 0.3], [x, G + 20, B.z1 + 0.3], TEAL, 'Neon', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
    add([3, 3, 0.2], [x, G + 20, B.z1 + 0.25], BRASS, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  }
  // the big sign
  sign([70, 8, 0.4], [1160, G + 26, B.z1 + 0.6], 0x0e2a30, 'Back', [["SIREN'S WAKE", 0, 0.02, 1, 0.64, TEAL], ['THE FLOODED COASTER  ·  YOU WILL GET WET', 0, 0.7, 1, 0.26, 0xf0e0b0, 'GothamBold']], { glow: true });
  // the bow of the Benton Belle, burst out through the wall
  const bx = 1120;
  for (let k = 0; k < 6; k++) {
    const w = 10 - k * 1.6, z = B.z1 + 0.5 + k * 1.3;
    box([w, 9 - k * 0.6, 1.4], [bx, G + 1 + k * 0.3, z], [DARKWOOD, WOOD][k % 2], 'WoodPlanks');
  }
  add([0.8, 0.8, 14], [bx, G + 9.4, B.z1 + 9], DARKWOOD, 'Wood', { collide: 0, rot: RX(-0.35) });
  add([0.3, 7, 6], [bx + 0.3, G + 15, B.z1 + 3], 0xe8dcc0, 'Fabric', { collide: 0, rot: RZ(0.12) });
  // the figurehead: a carved siren leaning out from the prow
  add([1.4, 3, 1.2], [bx, G + 7.4, B.z1 + 8.4], 0xd8c8a8, 'Wood', { collide: 0, rot: RX(-0.5) });
  add([1.2, 1.2, 1.2], [bx, G + 9.4, B.z1 + 9.4], 0xd8c8a8, 'Wood', { shape: 3, collide: 0 });
  add([2.2, 2, 0.6], [bx, G + 9.8, B.z1 + 8.8], 0x2a8a8a, 'Fabric', { collide: 0, rot: RX(-0.5) });
  add([1.6, 0.6, 3.4], [bx, G + 5.4, B.z1 + 7.6], TEAL, 'SmoothPlastic', { collide: 0, rot: RX(0.6) });
  light(bx, 6, B.z1 + 8, TEAL);
  // a lighthouse on the corner of the yard (its beam sweeps after dark)
  const lh = [1032, -8];
  for (let k = 0; k < 8; k++) box([4.6 - k * 0.25, 3, 4.6 - k * 0.25], [lh[0], G + k * 3, lh[1]], k % 2 ? RED : WHITE, 'Concrete', { shape: 5 });
  add([3.6, 3, 3.6], [lh[0], G + 25.5, lh[1]], 0xfff0c0, 'Neon', { shape: 5, collide: 0 });
  add([4.4, 1.6, 4.4], [lh[0], G + 27.8, lh[1]], RED, 'Metal', { shape: 5, collide: 0 });
  data.tags.Lighthouse.push([lh[0], G + 25.5, lh[1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(lh[0], 24, lh[1], 0xfff0c0);
  // pilings, crates, nets, barrels and lanterns along the harbor front
  for (let x = 1036; x < 1240; x += 18) {
    if (Math.abs(x - DOOR_IN) < 9 || Math.abs(x - DOOR_OUT) < 9 || Math.abs(x - bx) < 10) continue;
    box([0.9, 4, 0.9], [x, G, -6], DARKWOOD, 'Wood', { shape: 5 });
    add([1.1, 0.3, 1.1], [x, G + 2.6, -6], ROPE, 'Fabric', { shape: 5, collide: 0 });
    box([2.4, 2.4, 2.4], [x + 5, G, -26], 0x8a6a3a, 'WoodPlanks');
    box([1.4, 2, 1.4], [x + 8.4, G, -26.4], 0x6a4a2a, 'Wood', { shape: 5 });
    box([0.3, 6, 0.3], [x + 2, G, -26], 0x1a1a1c, 'Metal', { collide: 0 });
    add([0.8, 1, 0.8], [x + 2, G + 6.4, -26], 0xffc070, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x + 2, G + 6.4, -26, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (const x of [1050, 1150, 1200]) data.tags.SteamVent.push([x, G + 0.3, -4, 1, 0, 0, 0, 1, 0, 0, 0, 1]); // harbor fog
  // the wait time and a greeter
  box([0.6, 6, 0.6], [DOOR_IN - 9, G, -21], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [DOOR_IN - 9, G + 9, -21], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 91, cf: cf(DOOR_IN - 5, G, -22, Math.PI) });

  // ======== the water: the sirens' lagoon, and the waterfall pool
  const pond = (x0, x1, z0, z1) => data.terrain.push({ kind: 'block', material: 'Water', cf: [(x0 + x1) / 2, WATER + 0.2, (z0 + z1) / 2, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [x1 - x0, 1, z1 - z0] });
  pond(1080, 1226, -226, -150);
  pond(1084, 1172, -142, -114);
  for (const [x0, x1, z0, z1] of [[1080, 1226, -226, -150], [1084, 1172, -142, -114]]) {
    for (const [w, d, x, z] of [[x1 - x0 + 1, 1, (x0 + x1) / 2, z0], [x1 - x0 + 1, 1, (x0 + x1) / 2, z1], [1, z1 - z0, x0, (z0 + z1) / 2], [1, z1 - z0, x1, (z0 + z1) / 2]]) {
      add([w, 1, d], [x, G + 0.5, z], STONE, 'Slate', { collide: 0 }); // (just above the water)
    }
  }

  // ======== the track, turned over (see King Mamba)
  const ROLL_H = -2.6;
  const track = makeTrack(CIRCUIT, { rolls: [{ from: knot(1156, -176), to: knot(1202, -180), h: ROLL_H }] });
  track.up = track.up.map((v) => -v);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), Uf = new THREE.Vector3(), R = new THREE.Vector3();
  const frames = [];
  for (let s = 0; s < track.length; s += 0.5) {
    sampler.matrixAt(s, m4);
    const e = m4.elements;
    frames.push([e[12], e[13], e[14], e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], s]);
  }
  const grid = new Map();
  for (const f of frames) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  // the hanging trains' envelope: 3.7 to either side, from the rails to 6.4 below
  const clearPt = (x, y, z, skipS = null) => {
    for (const f of near(x, z)) {
      if (skipS !== null && Math.abs(f[12] - skipS) < 2.5) continue;
      const dx = x - f[0], dy = y - f[1], dz = z - f[2];
      if (Math.abs(dy) > 12) continue;
      const lz = f[9] * dx + f[10] * dy + f[11] * dz;
      if (Math.abs(lz) > 0.3) continue;
      const lx = f[3] * dx + f[4] * dy + f[5] * dz, ly = f[6] * dx + f[7] * dy + f[8] * dz;
      if (Math.abs(lx) < 3.7 && ly > -0.4 && ly < 6.4) return false;
    }
    return true;
  };
  const clearSeg = (a, b, skipS = null) => {
    const n = Math.ceil(a.distanceTo(b) / 0.5);
    for (let k = 0; k <= n; k++) { const q = a.clone().lerp(b, k / n); if (!clearPt(q.x, q.y, q.z, skipS)) return false; }
    return true;
  };
  const clearBox = (size, pos) => {
    for (let x = -size[0] / 2; x <= size[0] / 2 + 0.01; x += Math.max(0.5, size[0] / 6)) for (let y = -size[1] / 2; y <= size[1] / 2 + 0.01; y += Math.max(0.5, size[1] / 6)) for (let z = -size[2] / 2; z <= size[2] / 2 + 0.01; z += Math.max(0.5, size[2] / 6)) {
      if (!clearPt(pos[0] + x, pos[1] + y, pos[2] + z)) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearBox(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  const strut = (a, b, w, color) => {
    const d = b.clone().sub(a), len = d.length();
    const yaw = Math.atan2(d.x, d.z), pitch = Math.asin(THREE.MathUtils.clamp(d.y / len, -1, 1));
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    add([w, w, len], [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], color, 'Metal', { collide: 0, rot: [c, -s * sp, s * cp, 0, cp, sp, -s, -c * sp, c * cp] });
  };
  // supports: indoors the track hangs from the roof trusses; where it's
  // upside down a column comes up from the floor; else a C from the side
  const SUP = 0x2a3034, ROOF = G + B.H - 0.4;
  let supports = 0;
  for (let s = 6; s < track.length - 6; s += 8) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    Uf.setFromMatrixColumn(m4, 1);
    R.setFromMatrixColumn(m4, 0);
    const spine = P.clone().addScaledVector(Uf, -1.5);
    const roof = new THREE.Vector3(spine.x, ROOF, spine.z), floor = new THREE.Vector3(spine.x, G, spine.z);
    if (Uf.y < -0.4 && clearSeg(spine, roof, s)) { strut(spine, roof, 0.7, SUP); supports++; continue; }
    if (Uf.y > 0.4 && clearSeg(floor, spine, s)) { strut(floor, spine, 1.1, SUP); supports++; continue; }
    for (const side of [1, -1]) {
      const h = new THREE.Vector3(R.x, 0, R.z).normalize().multiplyScalar(side * 6);
      const top = new THREE.Vector3(spine.x, Math.max(spine.y, P.y) + 1.6, spine.z);
      const colTop = top.clone().add(h), colFoot = new THREE.Vector3(colTop.x, G, colTop.z);
      if (clearSeg(colFoot, colTop) && clearSeg(colTop, top) && clearSeg(top, spine, s)) {
        strut(colFoot, colTop, 1.1, SUP); strut(colTop, top, 0.9, SUP); strut(top, spine, 0.8, SUP);
        supports++; break;
      }
    }
  }
  // roof trusses the hangers meet
  for (let x = B.x0 + 14; x < B.x1 - 6; x += 24) add([1, 1.2, B.z1 - B.z0 - 2.4], [x, ROOF + 0.2, cz], SUP, 'Metal', { collide: 0 });

  // ======== inside: the line through the harbor master's office
  add([B.x1 - B.x0 - 2.4, 0.15, B.z1 - B.z0 - 2.4], [cx, G + 0.08, cz], 0x2a2620, 'WoodPlanks', { collide: 0 });
  const ROWZ = [-40, -46, -52, -58, -64];
  const XL = 1152, XR = 1228;
  const fwd = [[1180, -16], [DOOR_IN, -18], [DOOR_IN, B.z1 - 2], [DOOR_IN, ROWZ[0]]];
  ROWZ.forEach((z, k) => {
    const [a, b] = k % 2 === 0 ? [XR, XL] : [XL, XR];
    if (k > 0) fwd.push([a, z]);
    fwd.push([b, z]);
  });
  fwd.push([XL - 2, -71], [1136, -79.5]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [-1, 0], G);
  const railX = (a, b, z) => {
    add([b - a, 0.35, 0.35], [(a + b) / 2, G + 3, z], ROPE, 'Fabric', { collide: 0 });
    add([b - a, 0.25, 0.25], [(a + b) / 2, G + 1.8, z], ROPE, 'Fabric', { collide: 0 });
    const n = Math.max(1, Math.round((b - a) / 5));
    for (let k = 0; k <= n; k++) box([0.5, 3.3, 0.5], [a + ((b - a) * k) / n, G, z], DARKWOOD, 'Wood', { shape: 5 });
  };
  for (let k = 0; k < ROWZ.length - 1; k++) {
    const z = (ROWZ[k] + ROWZ[k + 1]) / 2;
    if (k % 2 === 0) railX(XL + 4, XR + 3, z); else railX(XL - 3, XR - 4, z);
  }
  railX(XL - 3, DOOR_IN - 4, ROWZ[0] + 3);
  // the office: maps, a ship's wheel, portholes, barrels, nets, lanterns
  [['SIREN SIGHTED', 'OFF BENTON POINT  ·  ALL SHIPS KEEP CLEAR'], ['THE BENTON BELLE', 'LAST VOYAGE  ·  NEVER CAME HOME'], ['STORM WARNING', 'GALE FORCE  ·  HIGH SEAS  ·  YOU WILL GET WET'], ['HARBOR MASTER', 'DOCK 7  ·  BOARDING THE BELLE']].forEach(([a, b], k) => {
    sign([14, 6, 0.3], [XL + 10 + k * 18, 12, B.z1 - T - 0.3], 0x1a2a2a, 'Front', [[a, 0, 0.1, 1, 0.5, [TEAL, 0xf0e0b0, 0xff6a5a, BRASS][k]], [b, 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  });
  add([0.4, 6, 6], [B.x1 - T - 0.4, 12, -52], BRASS, 'Metal', { shape: 2, collide: 0 });
  for (let k = 0; k < 8; k++) add([0.3, 3.6, 0.3], [B.x1 - T - 0.8, 12, -52], DARKWOOD, 'Wood', { collide: 0, rot: [1, 0, 0, 0, Math.cos(k * 0.785), -Math.sin(k * 0.785), 0, Math.sin(k * 0.785), Math.cos(k * 0.785)] });
  for (let x = XL + 4; x < XR; x += 12) add([2.2, 2.2, 0.2], [x, 6, B.z1 - T - 0.2], 0x2aa8c8, 'Neon', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (const [x, z] of [[XR + 3, -44], [XR + 3, -56], [XL - 5, -48], [XL - 5, -60]]) box([1.6, 2.4, 1.6], [x, G, z], 0x6a4a2a, 'Wood', { shape: 5, collide: 0 });
  for (let k = 0; k < 6; k++) { add([0.6, 0.9, 0.6], [XL + 6 + k * 13, 9, (ROWZ[0] + ROWZ[4]) / 2], 0xffc070, 'Neon', { collide: 0 }); light(XL + 6 + k * 13, 8, -52, 0xffb060); }

  // ======== the station: the Belle's dock, masts and sails overhead
  const PLAT = { x0: 1096, x1: 1152, z0: -83.4, z1: -75 };
  add([PLAT.x1 - PLAT.x0, 0.3, PLAT.z1 - PLAT.z0], [(PLAT.x0 + PLAT.x1) / 2, G + 0.15, (PLAT.z0 + PLAT.z1) / 2], 0x8a6a4a, 'WoodPlanks', { collide: 0 });
  add([PLAT.x1 - PLAT.x0, 0.12, 0.5], [(PLAT.x0 + PLAT.x1) / 2, G + 0.32, PLAT.z0 + 0.4], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  for (const x of [1104, 1128, 1150]) {
    box([0.9, 24, 0.9], [x, G, -73], DARKWOOD, 'Wood', { shape: 5, collide: 0 });
    add([10, 0.4, 0.4], [x, G + 18, -73], DARKWOOD, 'Wood', { collide: 0 });
    add([9, 8, 0.2], [x, G + 13.6, -72.6], 0xe8dcc0, 'Fabric', { collide: 0 });
  }
  sign([30, 3, 0.4], [1124, 14, -72.2], 0x1a2a2a, 'Front', [['DOCK 7  ·  THE BENTON BELLE', 0, 0, 1, 0.62, BRASS], ['HOLD ON TIGHT  ·  FEET UP FOR THE SPLASHDOWNS', 0, 0.62, 1, 0.38, TEAL, 'GothamBold']], { glow: true });
  add([1.2, 1.4, 1.2], [1142, G + 7, -74], BRASS, 'Metal', { shape: 3, collide: 0 }); // the ship's bell
  const con = [1098, -78];
  box([1.4, 3, 2.4], [con[0], G, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(1124, 10, -80, 0xffc080);

  // ======== the scenes
  // the storm over the lift: storm clouds under the roof, lightning, rain
  for (let k = 0; k < 7; k++) S([12, 3, 10], [1040 + 8 + (k % 2) * 10, 28 + (k % 3), -100 - k * 10], 0x3a4048, 'Fabric', { collide: 0, shape: 3 });
  for (const [x, z] of [[1066, -118], [1034 + 30, -146]]) {
    for (let k = 0; k < 5; k++) SN([0.25, 3, 0.25], [x + (k % 2 ? 0.8 : -0.8), 26 - k * 2.6, z], 0xe8f0ff, { rot: RZ(k % 2 ? 0.4 : -0.4) });
    light(x, 22, z, 0xd8e0ff);
  }
  // the sirens' lagoon: rocks, a carved stone siren with her harp, glowing crystals
  for (const [x, z, w, h] of [[1100, -160, 6, 4], [1146, -158, 5, 3], [1104, -190, 7, 5], [1150, -192, 6, 4], [1216, -160, 6, 5]]) SB([w, h, w * 0.8], [x, G, z], STONE, 'Slate', { collide: 0, yaw: x * 0.2 });
  const siren = [1128, -192];
  SB([8, 4, 6], [siren[0], G, siren[1]], STONE, 'Slate', { collide: 0 });
  S([2.4, 4.4, 1.6], [siren[0], G + 6.4, siren[1]], 0x7a8a8a, 'Slate', { collide: 0, rot: RZ(0.1) });
  S([1.8, 1.8, 1.8], [siren[0] + 0.3, G + 9.4, siren[1]], 0x7a8a8a, 'Slate', { shape: 3, collide: 0 });
  S([2.6, 3, 0.6], [siren[0], G + 9.8, siren[1] + 0.8], 0x2a6a6a, 'Fabric', { collide: 0 });
  S([3.6, 1.4, 2.4], [siren[0] + 1, G + 4.6, siren[1] - 1.4], 0x4a8a8a, 'Slate', { collide: 0, rot: RX(0.5) });
  S([0.3, 3.4, 2.4], [siren[0] - 1.6, G + 6.8, siren[1]], BRASS, 'Metal', { collide: 0 }); // the harp
  for (let k = 0; k < 5; k++) S([0.06, 2.8, 0.06], [siren[0] - 1.6, G + 6.8, siren[1] - 0.9 + k * 0.45], 0xfff0c0, 'Neon', { collide: 0 });
  light(siren[0], 10, siren[1], TEAL);
  for (let k = 0; k < 16; k++) {
    const x = 1086 + (k * 23) % 130, z = -152 - ((k * 37) % 68);
    SN([0.8, 2.6 + (k % 3), 0.8], [x, G + 1.6 + (k % 3) * 0.5, z], [TEAL, 0x6ad8ff, 0xb08aff][k % 3], { rot: RZ((k % 5) * 0.2 - 0.4) });
  }
  // the whirlpool under the roll: rings of light on the water
  for (let r = 3; r <= 15; r += 3) for (let k = 0; k < Math.round(r * 3); k++) {
    const a = (k / Math.round(r * 3)) * Math.PI * 2 + r;
    SN([0.4, 0.15, 0.4], [1172 + Math.cos(a) * r, WATER + 0.1, -176 + Math.sin(a) * r], r % 6 ? TEAL : 0x8af0ff, { shape: 3 });
  }
  light(1172, 6, -176, 0x2ad8ff);
  // the wreck of the Belle: hull planks either side, ribs, cannons, treasure
  for (const z of [-222.4, -207.6]) {
    for (let k = 0; k < 5; k++) SB([42, 1.2, 0.8], [1157, G + 1 + k * 1.3, z + (z < -215 ? -k * 0.2 : k * 0.2)], [DARKWOOD, WOOD][k % 2], 'WoodPlanks', { collide: 0 });
  }
  for (let x = 1140; x <= 1174; x += 6) {
    for (const z of [-223, -207]) SB([0.8, 7 + (x % 3), 0.8], [x, G, z], DARKWOOD, 'Wood', { collide: 0, rot: RX(z < -215 ? -0.25 : 0.25) });
  }
  for (const x of [1146, 1162]) { SB([1, 1, 3], [x, G + 2.6, -224], 0x2a2a2e, 'Metal', { collide: 0 }); }
  for (let k = 0; k < 4; k++) {
    const x = 1144 + k * 9;
    SB([2.4, 1.6, 1.6], [x, G + 1, -205], 0x6a4a2a, 'Wood', { collide: 0 });
    SN([2, 0.5, 1.2], [x, G + 2.8, -205], 0xffc030);
  }
  light(1156, 8, -206, 0xffc040);
  light(1170, 6, -222, 0x2a8aaa);
  // the kelp forest under the crest: tall strands and glowing jellyfish
  for (let k = 0; k < 40; k++) {
    const x = 1044 + (k * 7) % 34, z = -150 - ((k * 13) % 70), h = 6 + (k % 5) * 2;
    SB([0.4, h, 0.4], [x, G, z], 0x2a6a3a, 'Grass', { collide: 0, rot: RZ(((k % 7) - 3) * 0.05) });
  }
  for (let k = 0; k < 12; k++) {
    const x = 1046 + (k * 11) % 30, z = -146 - ((k * 17) % 64), y = 14 + (k % 4) * 3;
    SN([1.4, 1, 1.4], [x, y, z], [0xff6ad8, 0xb08aff, 0x6ad8ff][k % 3], { shape: 3 });
    for (let j = 0; j < 3; j++) S([0.08, 2.4, 0.08], [x - 0.4 + j * 0.4, y - 1.6, z], 0xffb0e8, 'Neon', { collide: 0 });
  }
  light(1055, 10, -170, 0x8a6aff);
  light(1055, 10, -195, 0x6ad8ff);
  // the sea serpent, rising out of the waterfall pool
  for (let k = 0; k < 6; k++) {
    const x = 1100 + k * 12, r = 2.4 - k * 0.12;
    for (let j = 0; j < 7; j++) {
      const a = (j / 6) * Math.PI;
      S([r * 2, r * 2, r * 2], [x + Math.cos(a) * 4, WATER + Math.sin(a) * 6, -116.5], k % 2 ? 0x2a6a4a : 0x1a4a3a, 'Slate', { shape: 3, collide: 0 });
    }
  }
  const head = [1172, 14, -118];
  S([4, 3.4, 7], head, 0x2a6a4a, 'Slate', { collide: 0, rot: RX(0.3) });
  for (const sx of [-1, 1]) SN([0.8, 0.8, 0.8], [head[0] + sx * 1.4, head[1] + 1, head[2] - 2.6], 0xf2e020, { shape: 3 });
  for (const sx of [-1, 1]) S([0.4, 1.8, 0.4], [head[0] + sx * 0.8, head[1] - 2, head[2] - 3.4], WHITE, 'SmoothPlastic', { collide: 0 });
  light(head[0], head[1] + 3, head[2], 0x40ff9a);
  // the waterfall: a curtain of falling water the train dives straight through
  add([0.3, B.H - 4, 16], [1122, G + (B.H - 4) / 2 + 1, -128], 0x9ad8ff, 'Glass', { collide: 0, trans: 0.55 });
  for (let z = -136; z <= -120; z += 4) data.tags.SteamVent.push([1122, WATER + 0.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  SN([0.4, 0.4, 16.4], [1122, B.H - 3, -128], 0x9ad8ff);
  light(1122, 10, -128, 0x9ad8ff);
  // the harbor at dusk over the dock: a backdrop on the east wall
  sign([0.3, 12, 40], [B.x1 - T - 0.3, 18, -104], 0xff8a5a, 'Left', [['HOME PORT', 0, 0.12, 1, 0.5, WHITE], ['BENTON HARBOR', 0, 0.66, 1, 0.26, 0x1a2a3a, 'GothamBold']], { glow: true });
  // sea-blue light along the whole run
  for (let s = 10; s < track.length - 10; s += 16) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.max(4, P.y - 7), P.z, s % 32 ? 0x2a9ac8 : TEAL); }

  // ======== the trains: the Belle's hanging gondolas (+y is down, away from the rails)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const UPRIGHT = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  const carParts = (k) => [
    pp(0, [3.4, 0.7, 2.6], [0, 0.4, 0], 0x2a2c30, 'Metal'),
    pp(0, [0.5, 1.2, 0.5], [0, 1.3, 0.3], 0x2a2c30, 'Metal'),
    pp(0, [5.4, 0.6, 0.9], [0, 2.0, 0.6], WOOD, 'WoodPlanks'),
    pp(0, [5.5, 0.2, 1], [0, 2.35, 0.6], BRASS, 'Metal'),
    ...(k === 0 ? [
      pp(0, [5.6, 1.6, 0.4], [0, 1.6, -1.3], DARKWOOD, 'WoodPlanks'),
      pp(0, [1, 1.6, 0.8], [0, 1.6, -1.9], 0xd8c8a8, 'Wood'),
      pp(3, [0.9, 0.9, 0.9], [0, 0.6, -2.0], 0xd8c8a8, 'Wood'),
      pp(3, [0.6, 0.6, 0.3], [-2, 1.6, -1.55], 0xffc070, 'Neon'), pp(3, [0.6, 0.6, 0.3], [2, 1.6, -1.55], 0xffc070, 'Neon'),
    ] : []),
    ...[-2.1, -0.7, 0.7, 2.1].flatMap((x) => [
      pp(0, [1.1, 2.2, 0.35], [x, 2.6, 0.75], 0x1a3a3a, 'Fabric'),
      pp(0, [1.1, 0.35, 1.0], [x, 3.75, 0.2], 0x1a3a3a, 'Fabric'),
      pp(0, [0.3, 0.3, 0.6], [x, 1.7, 0.4], k % 2 ? BRASS : TEAL, 'SmoothPlastic'),
    ]),
  ];
  const seatList = () => [-2.1, -0.7, 0.7, 2.1].map((x) => [x, 3.55 - 1.3, 0.15, ...UPRIGHT]);
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
    stops.push(cf(P.x, G, -82.6, 0));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2, 3, 4], [5, 6, 7, 8]],
    console: cf(con[0], G, con[1], 0), operator: cf(con[0], G, con[1] + 1.4, 0),
    homes: [cf(1112, G, -78, 0), cf(1132, G, -78, 0)],
    exit: cf(1100, G, -77, Math.PI / 2),
  };

  // ======== the ride
  const origin = [1140, 0, -150];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
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
  // the splashes (where the front car hits the water), rain on the lift,
  // and the waterfall pouring over you
  const cues = [
    [at(1050, -132), 'flood', [0, -6, 0]], [at(1122, -174), 'splash', [0, 4.6, -2]], [at(1118, -214), 'splash', [0, 4.6, -2]],
    [at(1118, -128), 'flood', [0, -8, 0]], [at(1126, -128), 'splash', [0, 4.6, -2]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: "Siren's Wake", land: 'Velocity', category: 'Thrill', thrill: 4, kind: 'coaster', carStyle: 'coaster',
    description: "An indoor inverted water coaster: board the Benton Belle's hanging gondolas and sail into the storm - lightning on the lift, a plunge feet-first into the sirens' lagoon, a zero-g roll over the whirlpool, through the wreck of the Belle, past the sea serpent and straight through the waterfall. Three splashdowns. You will get wet.",
    baseWait: 55, origin, entrance: [DOOR_IN, 0, -18], exit: [DOOR_OUT, 0, -22], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, TEAL, BRASS], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), "Siren's Wake is open - you will get wet!", 'Feet up for the splashdowns!'];
  return { ride, gate: { x: gx, z: 0 }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, supports };
}

// a toast the first time you come near the new ride
export class SirensWakeSite {
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
      this.hooks.toast("NEW: Siren's Wake, an indoor inverted water coaster - three splashdowns and a waterfall! Through the gate past Neon Getaway.", 'reward');
    }
  }
}
