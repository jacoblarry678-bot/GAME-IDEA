// Override: a multi-launch coaster south of Jungle Run (through a gate in
// Jungle Run's south wall, down the walk along its west edge). The theme is
// a control facility where the park's ride computer has taken over: you
// board in Control Room 7 under screens flashing ACCESS DENIED, and the
// system launches you three times. Launch 1 fires you straight out of the
// station up and over a 56-stud top hat past the glowing AI core; round an
// overbanked turn and a zero-g roll, launch 2 blasts you through the
// reactor tunnel into a huge airtime hill; and launch 3 fires you into a
// heartline roll before the brakes take control back.
//
// The launches are fast stretches of track lined with red LSM fins and
// rings of light; every support and piece of scenery is placed clear of the
// train's path.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'Override';
const SITE = { x0: 900, x1: 1250, z0: -718, z1: -470 };
const JRGATE = { x0: 1005, x1: 1015 }; // in Jungle Run's south wall (z -470)
const G = 0.1;
const CARS = 5, SPACING = 3.4;
const RED = 0xff2a3a, CYAN = 0x30e0ff, BLACK = 0x0e1014, GRAPHITE = 0x2a2c32, WHITE = 0xf0f2f6, STEEL = 0x8a8e96;
const TRACK_COLOR = 0xc81e2a;

const CIRCUIT = [
  [1050, 1.6, -492, 2],
  // LAUNCH 1, straight out of the station, and up over the top hat
  [1066, 1.6, -492, 6], [1090, 1.7, -492, 20], [1114, 2, -492, 30], [1136, 3, -492, 33],
  [1150, 14, -492, 26], [1158, 34, -492, 18], [1166, 52, -492, 9], [1176, 56, -492, 7],
  [1186, 50, -492, 12], [1194, 30, -492, 26], [1202, 10, -494, 34], [1214, 4, -504, 35],
  // down the east side and round the overbanked turn
  [1228, 6, -524, 33], [1234, 14, -550, 28], [1232, 18, -600, 26], [1228, 24, -640, 22], [1210, 22, -666, 22], [1184, 16, -676, 26],
  // the zero-g roll
  [1164, 14, -680, 27], [1144, 18, -681, 24], [1124, 14, -682, 27], [1104, 6, -686, 32],
  // LAUNCH 2, through the reactor tunnel, into the big airtime hill
  [1084, 3, -690, 28], [1060, 3, -692, 30], [1036, 3.2, -692, 34], [1012, 4, -690, 36],
  [990, 24, -688, 28], [972, 34, -684, 22], [954, 26, -678, 26], [938, 8, -668, 34],
  // north up the west side over a camelback
  [924, 6, -646, 33], [920, 12, -620, 30], [920, 26, -596, 22], [920, 12, -572, 30], [928, 8, -552, 31], [948, 6, -546, 30],
  // LAUNCH 3, into the heartline roll
  [970, 5, -556, 28], [1000, 5, -560, 31], [1030, 5.4, -562, 35], [1056, 14, -564, 30], [1080, 22, -566, 26], [1104, 16, -568, 28],
  // the brakes take control back: round, and home
  [1130, 10, -572, 30], [1150, 12, -556, 27], [1156, 14, -534, 25], [1146, 12, -516, 24], [1120, 10, -514, 22],
  [1090, 8, -514, 20], [1070, 6, -516, 18], [1040, 5, -516, 14], [1020, 4, -510, 10], [1012, 3, -500, 8], [1018, 2, -493, 6],
  [1030, 1.6, -492, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);
// the launches: [from knot, to knot]
const LAUNCHES = [[[1050, -492], [1136, -492]], [[1084, -690], [1012, -690]], [[970, -556], [1030, -562]]];

export function buildOverride(data) {
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

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6) && !(t.pos[0] > 1004 && t.pos[0] < 1020 && t.pos[2] < -240 && t.pos[2] > -472));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x2e3036, 'Asphalt');
  // a gate in Jungle Run's south wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 470) < 0.6 && Math.abs(p[4] - 1127) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(JRGATE.x1, SITE.z1, 1250, SITE.z1);
  wallSeg(SITE.x0, SITE.z1, 1004, SITE.z1);
  wallSeg(1250, SITE.z1, 1250, SITE.z0);
  wallSeg(1250, SITE.z0, SITE.x0, SITE.z0);
  wallSeg(SITE.x0, SITE.z0, SITE.x0, -660);
  // the gate: black pillars, a red scan bar, OVERRIDE
  const gx = (JRGATE.x0 + JRGATE.x1) / 2;
  for (const x of [JRGATE.x0 - 0.2, JRGATE.x1 + 0.2]) {
    box([1.4, 16, 1.4], [x, G, SITE.z1], BLACK, 'Metal');
    neon([0.3, 14, 0.3], [x, G + 8, SITE.z1 - 0.8], RED);
  }
  add([JRGATE.x1 - JRGATE.x0 + 3, 2.6, 1.2], [gx, G + 15, SITE.z1], BLACK, 'Metal', { collide: 0 });
  sign([JRGATE.x1 - JRGATE.x0 + 2, 2.2, 0.2], [gx, G + 15, SITE.z1 + 0.7], BLACK, 'Back', [['OVERRIDE', 0, 0, 1, 1, RED]], { glow: true });
  sign([JRGATE.x1 - JRGATE.x0 + 2, 2.2, 0.2], [gx, G + 15, SITE.z1 - 0.7], BLACK, 'Front', [['OVERRIDE', 0, 0, 1, 1, RED]], { glow: true });
  // the walk: on from Jungle Run's plaza, down its west edge
  for (const [a, b] of [[[1014, -240], [1010, -248]], [[1010, -248], [1010, SITE.z1]], [[1010, SITE.z1], [1010, -478]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    W.add([7, 0.4, len + 7], [(a[0] + b[0]) / 2, 0.22, (a[1] + b[1]) / 2], 0x6a6658, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])]);
  }

  // ======== the track
  const track = makeTrack(CIRCUIT, {
    rolls: [
      { from: knot(1184, -676), to: knot(1104, -686), h: 1.3 },
      { from: knot(1030, -562), to: knot(1104, -568), h: 1.3, dir: -1 },
      { from: knot(1234, -550), to: knot(1228, -640), h: 1.3, shape: 'bump', angle: 1.9, dir: -1 },
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
  const clearOf = (size, pos) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < 4 && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.6) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  // supports: graphite columns from the ground up under the spine
  let supports = 0;
  for (let s = 6; s < track.length - 4; s += 8) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.9) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.6)) continue;
    add([1.1, foot.y - G, 1.1], [foot.x, (foot.y + G) / 2, foot.z], GRAPHITE, 'Metal', { shape: 5, collide: 0 });
    supports++;
  }
  // the launches: red LSM fins down the middle, rings of light round the train
  const launchRanges = LAUNCHES.map(([[ax, az], [bx, bz]]) => [sAt(ax, az), sAt(bx, bz)]);
  for (const [s0, s1] of launchRanges) {
    for (let s = s0 + 2; s < s1; s += 1.6) {
      sampler.matrixAt(s, m4);
      P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 2);
      neon([0.25, 0.5, 1.2], [P.x - U.x * 0.45, P.y - U.y * 0.45, P.z - U.z * 0.45], RED, { yaw: Math.atan2(R.x, R.z) });
    }
    for (let s = s0 + 8; s < s1; s += 9) {
      sampler.matrixAt(s, m4);
      P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
      const C = P.clone().addScaledVector(U, 1.6);
      for (let k = 0; k < 30; k++) {
        const a = (k / 30) * Math.PI * 2;
        const q = C.clone().addScaledVector(R, Math.cos(a) * 5.4).addScaledVector(U, Math.sin(a) * 5.4);
        if (q.y > G + 0.4) SN([0.5, 0.5, 0.5], [q.x, q.y, q.z], k % 2 ? RED : CYAN, { shape: 3 });
      }
      light(C.x, C.y + 3, C.z, RED);
    }
  }

  // ======== the plaza and the line
  const ROWZ = [-476, -481, -486];
  const fwd = [[1010, -462], [1010, -474], [1020, ROWZ[0]], [1100, ROWZ[0]], [1100, ROWZ[1]], [1024, ROWZ[1]], [1024, ROWZ[2]], [1062, ROWZ[2]], [1062, -489.4], [1046, -489.4]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], G);
  const railX = (a, b, z) => {
    add([b - a, 0.22, 0.22], [(a + b) / 2, G + 3, z], RED, 'Neon', { collide: 0 });
    add([b - a, 0.16, 0.16], [(a + b) / 2, G + 1.8, z], STEEL, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((b - a) / 6));
    for (let k = 0; k <= n; k++) box([0.3, 3.1, 0.3], [a + ((b - a) * k) / n, G, z], BLACK, 'Metal');
  };
  railX(1016, 1096, -478.5);
  railX(1028, 1104, -483.5);
  railX(1028, 1058, -487.8);
  add([96, 0.12, 22], [1058, G + 0.06, -482], 0x1a1c22, 'SmoothPlastic', { collide: 0 });
  // the entrance sign and the wait time
  box([0.4, 8, 0.4], [1016, G, -473], BLACK, 'Metal');
  sign([9, 3, 0.2], [1016, G + 8.6, -473], BLACK, 'Back', [['OVERRIDE', 0, 0.02, 1, 0.6, RED], ['MULTI LAUNCH  ·  ENTRANCE', 0, 0.62, 1, 0.36, WHITE, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [1034, G, -473], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [1034, G + 9, -473], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 131, cf: cf(1014, G, -478, Math.PI) });

  // ======== the station: Control Room 7
  for (let x = 1026; x <= 1062; x += 9) for (const z of [-487.4, -497]) box([0.8, 11, 0.8], [x, G, z], BLACK, 'Metal', { collide: z < -492 ? 1 : 0 });
  add([42, 0.8, 13], [1044, G + 11.4, -492], GRAPHITE, 'Metal', { collide: 0 });
  neon([42.2, 0.3, 0.3], [1044, G + 11, -485.5], RED);
  neon([42.2, 0.3, 0.3], [1044, G + 11, -498.5], CYAN);
  add([40, 0.3, 3.6], [1044, G + 0.15, -489.2], 0x3a3c44, 'DiamondPlate', { collide: 0 });
  add([40, 0.1, 0.5], [1044, G + 0.32, -490.6], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  sign([26, 3, 0.3], [1044, 9, -487.2], BLACK, 'Back', [['CONTROL ROOM 7', 0, 0, 1, 0.58, RED], ['ACCESS DENIED  ·  SYSTEM OVERRIDE IN PROGRESS', 0, 0.6, 1, 0.4, CYAN, 'GothamBold']], { glow: true });
  // screens on the back wall: the system talking
  [['ACCESS DENIED', RED], ['OVERRIDE ACCEPTED', CYAN], ['LAUNCH SEQUENCE: 3', RED], ['DO NOT RESIST', WHITE]].forEach(([text, c], k) => {
    sign([7, 2.4, 0.2], [1029 + k * 10, 6, -498.2], BLACK, 'Front', [[text, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
  });
  const con = [1024, -488];
  box([1.4, 3, 2.4], [con[0], G, con[1]], BLACK, 'Metal', { collide: 0 });
  for (let k = 0; k < 6; k++) neon([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 1 + k * 0.4], [RED, CYAN][k % 2]);
  light(1044, 9, -490, 0xff6a6a);
  light(1030, 7, -494, CYAN);

  // ======== the facility
  // server towers with blinking lights
  for (const [x, z] of [[1080, -530], [1100, -530], [1120, -540], [960, -520], [980, -520], [1180, -540], [1200, -560], [1160, -620], [1080, -640], [1000, -620]]) {
    if (SB([4, 12, 2.4], [x, G, z], BLACK, 'Metal', { collide: 0 }) < 0) continue;
    for (let k = 0; k < 10; k++) SN([0.3, 0.25, 0.1], [x - 1.2 + (k % 3) * 1.2, G + 1.5 + k, z + 1.25], [RED, CYAN, 0x5adc6e][k % 3]);
  }
  // the AI core: a glowing red sphere on a pylon by the top hat, with a ring round it
  const core = [1176, -470 - 40];
  if (SB([3, 34, 3], [core[0], G, core[1]], GRAPHITE, 'Metal', { collide: 0 }) >= 0) {
    S([7, 7, 7], [core[0], G + 38, core[1]], RED, 'Neon', { shape: 3, collide: 0 });
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; S([0.6, 0.6, 0.6], [core[0] + Math.cos(a) * 6.4, G + 38, core[1] + Math.sin(a) * 6.4], CYAN, 'Neon', { shape: 3, collide: 0 }); }
    light(core[0], 34, core[1], RED);
  }
  // the reactor tunnel over launch 2: walls, a roof, red rings inside
  for (let x = 1016; x <= 1080; x += 8) {
    for (const dz of [-6.5, 6.5]) SB([3, 11, 1.2], [x, G, -691 + dz], GRAPHITE, 'Metal', { collide: 0 });
    S([3.2, 1, 14], [x, G + 11.5, -691], GRAPHITE, 'Metal', { collide: 0 });
  }
  S([70, 0.6, 14], [1048, G + 12.3, -691], BLACK, 'Metal', { collide: 0 });
  sign([0.3, 3, 12], [1084, 9, -691], BLACK, 'Right', [['REACTOR 2', 0, 0, 1, 0.6, RED], ['LAUNCH 2  ·  DO NOT RESIST', 0, 0.6, 1, 0.4, CYAN, 'GothamBold']], { glow: true });
  for (const z of [-676, -706]) data.tags.SteamVent.push([1048, G + 0.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // cables snaking across the ground, glowing
  for (let k = 0; k < 6; k++) S([60, 0.3, 0.5], [1000 + k * 30, G + 0.15, -600 - (k % 3) * 20], k % 2 ? RED : CYAN, 'Neon', { collide: 0 });
  // lamps all round
  for (const [x, z] of [[940, -500], [1000, -500], [1240, -480], [1240, -700], [1100, -712], [960, -712], [910, -700], [1060, -600], [1140, -600]]) {
    if (!clearOf([1, 12, 1], [x, 6, z])) continue;
    box([0.5, 11, 0.5], [x, G, z], BLACK, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 11.4, z], [RED, CYAN][Math.round(x / 10) % 2], 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 11.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (let s = 20; s < track.length - 20; s += 28) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.max(4, P.y - 4), P.z, s % 56 ? RED : CYAN); }

  // ======== the train: five cars of four, sleek and black with red stripes
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const carParts = (k) => [
    pp(0, [3.4, 0.9, 3.2], [0, 0.6, 0], BLACK, 'SmoothPlastic'),
    pp(0, [3.5, 0.25, 3.3], [0, 1.0, 0], RED, 'Neon'),
    ...[-0.8, 0.7].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.2, z], GRAPHITE, 'Fabric'),
      pp(0, [1.1, 1.5, 0.25], [x, 1.95, z + 0.5], BLACK, 'SmoothPlastic'),
    ])),
    ...(k === 0 ? [pp(0, [3.2, 1.2, 0.8], [0, 1.0, -1.9], BLACK, 'SmoothPlastic'), pp(0, [2.4, 0.2, 0.2], [0, 1.4, -2.32], RED, 'Neon'), pp(3, [0.5, 0.5, 0.2], [-1, 1, -2.32], CYAN, 'Neon'), pp(3, [0.5, 0.5, 0.2], [1, 1, -2.32], CYAN, 'Neon')] : []),
  ];
  const seatList = () => [-0.8, 0.7].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.35 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
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
    stops.push(cf(P.x, G, -489.6, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2, 3], [4, 5]],
    console: cf(con[0], G, con[1], Math.PI), operator: cf(con[0] - 1.4, G, con[1], Math.PI),
    homes: [cf(1036, G, -488.6, Math.PI), cf(1052, G, -488.6, Math.PI)],
    exit: cf(1058, G, -488, -Math.PI / 2),
  };

  // ======== the ride
  const origin = [1080, 0, -600];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    noExtended: true, // (there's no room for an overflow maze by the gate)
  };
  data.rides.push(ride);
  const at = (x, z) => track.times[track.cum.indexOf(sAt(x, z))] / ride.duration;
  // each launch fires with a burst of sparks; fire at the reactor's end
  const cues = [[at(1070, -492), 'sparks', [0, 1, 4]], [at(1080, -690), 'sparks', [0, 1, 4]], [at(1016, -690), 'fire', [0, -1, 6]], [at(975, -556), 'sparks', [0, 1, 4]], [at(1176, -492), 'explosion', [0, 6, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Override', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "A multi-launch coaster: the park's ride computer has taken over Control Room 7, and it launches you three times. Launch 1 fires you out of the station over a 56-stud top hat past the glowing AI core; launch 2 blasts you through the reactor tunnel into a huge airtime hill; launch 3 throws you into a heartline roll. Plus an overbanked turn and a zero-g roll. Do not resist.",
    baseWait: 70, origin, entrance: [1016, 0, -472], exit: [1010, 0, -466], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, BLACK, CYAN], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Override is open - three launches, do not resist!', 'Control Room 7 is that way. The system is expecting you.'];
  return { ride, gate: { x: gx, z: SITE.z1 }, supports };
}

// a toast the first time you come near the new ride
export class OverrideSite {
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
      this.hooks.toast('NEW: Override, a multi-launch coaster - three launches, a top hat and two inversions! Through the gate south of Jungle Run.', 'reward');
    }
  }
}
