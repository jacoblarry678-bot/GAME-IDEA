// UNDER THE SEAS: an indoor launched coaster in Natural Kingdom's Coral
// Coast, the way Benton Roll is in Velocity: a great dark hall, and inside
// it the ocean. Board a submarine car in the sub pen, and the launch fires
// you down a tube of light into the deep - up into a barrel roll through a
// school of fish, a dive over the coral reef past a sunken galleon, a
// helix round a giant octopus, a corkscrew through the kelp, and home -
// with a whale gliding overhead, jellyfish glowing in the dark and an
// anglerfish's lure in the trench.
import * as THREE from 'three';
import { helpers } from './wolverine.js';
import { trackRide } from './nkrides.js';

export const RIDE_ID = 'UnderTheSeas';
const B = { x0: -80, x1: 96, z0: 1184, z1: 1292, H: 30 }; // the hall
const T = 1.6; // wall thickness
const G = 0.02;
const DEEP = 0x0a2a4a, SEA = 0x1a5a8a, TEAL = 0x2ad0c8, FOAM = 0xe8f6fa, CORAL = 0xff6a5a, SAND = 0xd8c8a0, GOLD = 0xf0c040, PINK = 0xff5aa8, VIOLET = 0x8a5aff, KELP = 0x3a7a3a, INK = 0x081420;

const C = (x, y, z, v) => [x, y, z, v];
const CIRCUIT = [
  // the sub pen, heading west along the north wall
  C(20, 2, 1198, 2),
  // the launch down the tube, west
  C(8, 2, 1198, 6), C(-8, 2.1, 1198, 18), C(-26, 2.4, 1198, 26), C(-42, 3, 1198, 27),
  // up and round to the south, the barrel roll down the west side
  C(-58, 7, 1202, 24), C(-66, 13, 1212, 21), C(-68, 18, 1226, 19), C(-68, 20, 1240, 18), C(-68, 20, 1256, 18), C(-66, 18, 1268, 20),
  // the dive east along the south wall, over the reef and the wreck
  C(-56, 14, 1278, 23), C(-38, 9, 1282, 25), C(-16, 5, 1282, 26), C(8, 4, 1280, 26), C(30, 4.5, 1278, 25), C(52, 6, 1272, 24),
  // the helix round the octopus
  C(72, 9, 1262, 22), C(82, 12, 1246, 20), C(78, 15, 1230, 18), C(62, 17, 1224, 17), C(48, 17, 1232, 17), C(44, 16, 1248, 18),
  // west over the middle, the corkscrew through the kelp
  C(28, 14, 1250, 19), C(8, 12, 1246, 20), C(-14, 11, 1242, 21), C(-30, 10.5, 1240, 22), C(-44, 10, 1238, 22),
  // round to the north and back east, low, to the pen
  C(-52, 8, 1228, 21), C(-46, 6, 1216, 20), C(-28, 5, 1215, 19), C(0, 4, 1214, 17), C(30, 3.5, 1212, 13), C(58, 3, 1210, 9),
  C(76, 2.6, 1206, 6), C(74, 2.2, 1199, 4), C(60, 2, 1198, 3), C(42, 2, 1198, 2.5),
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildUnderTheSeas(data) {
  const W = helpers(data);
  const { add, box, sign, mi } = W;
  data.hauntLights = data.hauntLights || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hidden = data.hidden || [];
  const light = (x, y, z, c) => data.hauntLights.push([x, y, z, c]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // clear the corner: the jungle's trees stop at the hall and its line
  data.trees = (data.trees || []).filter((t) => !(t.pos[0] > B.x0 - 8 && t.pos[0] < 130 && t.pos[2] > 1160 && t.pos[2] < B.z1 + 8));

  // ======== the way there: from Primeval Valley's plaza, west then south between the river and Raptor Run
  const path = (pts, w, color = 0xc8b08a) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([w, 0.2, len + w * 0.6], [(a[0] + b[0]) / 2, G + 0.1, (a[1] + b[1]) / 2], color, 'Pavement', { yaw, collide: 0 });
    }
  };
  path([[172, 1010], [116, 1010], [116, 1172], [100, 1172]], 10);
  add([46, 0.2, 18], [86, G + 0.1, 1172], 0xd8c8a0, 'Pavement', { collide: 0 });
  for (const z of [1040, 1080, 1120, 1160]) {
    box([0.35, 7, 0.35], [124, G, z], 0x2a3a4a, 'Metal', { collide: 0 });
    add([1.2, 0.9, 1.2], [124, G + 7.3, z], 0x9ae8ff, 'Neon', { collide: 0, shape: 3 });
  }
  box([0.5, 6, 0.5], [122, G, 1014], 0x2a3a4a, 'Metal', { collide: 0 });
  sign([0.3, 1.8, 10], [122.3, G + 6.6, 1014], INK, 'Right', [['CORAL COAST  ·  UNDER THE SEAS  v', 0, 0, 1, 1, TEAL, 'GothamBold']], { glow: true });

  // ======== the hall: deep blue walls, a breaking wave over the front, portholes, the name
  const wall = (x0, x1, z0, z1, h0 = 0, h1 = B.H) => box([x1 - x0, h1 - h0, z1 - z0], [(x0 + x1) / 2, G + h0, (z0 + z1) / 2], SEA, 'Concrete');
  wall(B.x0, B.x0 + T, B.z0, B.z1);
  wall(B.x1 - T, B.x1, B.z0, B.z1);
  wall(B.x0, B.x1, B.z1 - T, B.z1);
  // the north (front) wall, with the door at x 58..64
  wall(B.x0, 58, B.z0, B.z0 + T);
  wall(64, B.x1, B.z0, B.z0 + T);
  wall(58, 64, B.z0, B.z0 + T, 8, B.H);
  add([B.x1 - B.x0, 1, B.z1 - B.z0], [(B.x0 + B.x1) / 2, G + B.H + 0.5, (B.z0 + B.z1) / 2], DEEP, 'Concrete');
  // the wave: curling crests along the front, foam on top
  for (let k = 0; k < 9; k++) {
    const x = B.x0 + 10 + k * 19;
    add([20, 9, 8], [x, G + B.H - 1, B.z0 - 3], k % 2 ? SEA : 0x2a7aaa, 'SmoothPlastic', { collide: 0, rot: RX(0.5) });
    add([20, 2.4, 4], [x, G + B.H + 3.6, B.z0 - 5.5], FOAM, 'SmoothPlastic', { collide: 0, rot: RX(-0.4) });
    add([3, 3, 3], [x + 6, G + B.H + 4.4, B.z0 - 7.4], FOAM, 'SmoothPlastic', { collide: 0, shape: 3 });
  }
  sign([70, 7, 0.4], [8, G + 19, B.z0 - 0.35], INK, 'Front', [['UNDER THE SEAS', 0, 0, 1, 0.68, TEAL], ['A LAUNCH INTO THE DEEP  ·  CORAL COAST', 0, 0.68, 1, 0.32, FOAM, 'GothamBold']], { glow: true });
  for (let k = 0; k < 6; k++) {
    const x = B.x0 + 14 + k * 26;
    if (x > 50 && x < 72) continue;
    add([5, 5, 0.4], [x, G + 9, B.z0 - 0.3], 0x3a3a40, 'Metal', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
    neon([3.8, 3.8, 0.2], [x, G + 9, B.z0 - 0.5], [TEAL, 0x4aa8ff, VIOLET][k % 3], { shape: 2, rot: RY(Math.PI / 2) });
  }
  // the anchor by the door, the sub on the roof
  box([1.2, 10, 1.2], [72, G, B.z0 - 4], 0x3a3a40, 'Metal', { collide: 0 });
  add([7, 1.2, 1.2], [72, G + 9, B.z0 - 4], 0x3a3a40, 'Metal', { collide: 0 });
  for (const sd of [-1, 1]) add([1.2, 4, 1.2], [72 + sd * 2.6, G + 1.6, B.z0 - 4], 0x3a3a40, 'Metal', { collide: 0, rot: RZ(sd * 0.9) });
  add([2.6, 2.6, 1], [72, G + 10.4, B.z0 - 4], 0x3a3a40, 'Metal', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
  add([24, 7, 7], [0, G + B.H + 4.5, 1210], GOLD, 'Metal', { collide: 0, shape: 2 });
  add([6, 4, 4], [0, G + B.H + 8.5, 1210], GOLD, 'Metal', { collide: 0 });
  for (const dx of [-8, 0, 8]) add([2.6, 2.6, 0.3], [dx, G + B.H + 4.5, 1206.4], 0x9ae8ff, 'Neon', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
  sign([6, 1.4, 0.3], [61, G + 9.6, B.z0 - 0.35], INK, 'Front', [['ENTRANCE', 0, 0, 1, 1, GOLD, 'GothamBold']], { glow: true });
  light(61, 8, B.z0 - 3, TEAL);

  // ======== the ride
  const extras = {}, extrasNames = [], props = [];
  const car = (k, pp2) => {
    const hull = k === 0 ? GOLD : 0xe0b030;
    const parts = [pp2(0, [3, 0.8, 3.4], [0, 0.6, 0], 0x2a2a2a, 'Metal'), pp2(0, [3.1, 1.3, 3.4], [0, 1.55, 0], hull, 'Metal')];
    for (const sx of [-1.55, 1.55]) parts.push(pp2(2, [0.25, 0.9, 0.9], [sx, 1.6, 0], 0x9ae8ff, 'Neon', RY(Math.PI / 2)));
    if (k === 0) {
      parts.push(pp2(1, [2.8, 1.8, 1.8], [0, 2.1, -2.3], hull, 'Metal', [-1, 0, 0, 0, 1, 0, 0, 0, -1]));
      parts.push(pp2(5, [0.4, 1.6, 0.4], [0, 3.2, -1.6], 0x3a3a40, 'Metal'));
      parts.push(pp2(3, [0.6, 0.6, 0.3], [0, 2.4, -3.2], 0xfff0c0, 'Neon'));
    }
    for (const z of [-0.6, 0.9]) for (const x of [-0.7, 0.7]) { parts.push(pp2(0, [1.1, 0.3, 0.9], [x, 1.95, z], 0x1a2a3a, 'Fabric')); parts.push(pp2(0, [1.1, 1.1, 0.22], [x, 2.5, z + 0.45], 0x1a2a3a, 'Fabric')); }
    return parts;
  };
  const r = trackRide(data, {
    id: RIDE_ID, name: 'Under the Seas', land: 'CoralCoast', category: 'Thrill', thrill: 4, kind: 'coaster', carStyle: 'coaster',
    description: 'An indoor launched coaster into the deep. Board a submarine car in the sub pen and the launch fires you down a tube of light - up into a barrel roll through a school of fish, a dive over the coral reef past a sunken galleon, a helix round a giant octopus and a corkscrew through the kelp, with a whale gliding overhead and jellyfish glowing in the dark.',
    baseWait: 55, circuit: CIRCUIT,
    trackOpts: { rolls: [{ from: knot(-68, 1226), to: knot(-68, 1256), h: 1.3 }, { from: knot(8, 1246), to: knot(-30, 1240), h: 1.3, dir: -1 }] },
    style: { style: 'steel', color: 0x1a8aaa }, cars: 5, spacing: 3.6, supports: { color: 0x1a3a5a },
    carParts: car, seatList: () => [-0.6, 0.9].flatMap((z) => [-0.7, 0.7].map((x) => [x, 1.95 + 0.15 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1])),
    env: { half: 2.2, below: 4.2, above: 5.2 }, restraint: 'harness',
    station: { side: 1, carHalf: 1.8, width: 4, y: 0.6, roof: 9, lead: 1 }, origin: [8, 0, 1240], extras, extrasNames, props, roofColor: 0x1a3a5a,
    queue: [[112, 1166], [62, 1166], [62, 1170], [108, 1170], [108, 1174], [62, 1174], [62, 1178], [104, 1178], [104, 1181], [61, 1181], [61, 1189], [50, 1190], [40, 1193.6]],
    exit: [-6, 0, 1176], colors: [0x1a8aaa, GOLD, 0x0a2a4a], signColor: TEAL, line: 'Under the Seas is open - hold your breath!',
    cues: (at) => [[at(-26, 1198), 'splash', [0, 0.5, 0]], [at(-16, 1282), 'splash', [0, 0.5, 0]], [at(8, 1246), 'flood', [0, -2, 0]]],
  });
  const { clearOf, near } = r;
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos, 1.6) ? add(size, pos, color, mat, o) : -1);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });

  // ======== inside: the sea floor, the deep blue, the caustic light
  add([B.x1 - B.x0 - 2 * T, 0.1, B.z1 - B.z0 - 2 * T], [(B.x0 + B.x1) / 2, G + 0.05, (B.z0 + B.z1) / 2], SAND, 'Sand', { collide: 0 });
  for (let k = 0; k < 40; k++) {
    const x = B.x0 + 6 + ((k * 37.7) % (B.x1 - B.x0 - 12)), z = B.z0 + 6 + ((k * 53.3) % (B.z1 - B.z0 - 12));
    add([6 + (k % 4), 0.15, 0.25], [x, G + B.H - 0.4, z], [TEAL, 0x4aa8ff, 0x9ae8ff][k % 3], 'Neon', { collide: 0, rot: RY(k * 0.7) });
  }
  for (const [x, z] of [[-40, 1220], [20, 1230], [60, 1270], [-60, 1280], [-10, 1260], [70, 1200]]) light(x, 14, z, [TEAL, 0x2a6aff, 0x4ad8a8][Math.abs(x) % 3]);
  // the launch tube: rings of light down the launch
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
  for (let s = 14; s < 58; s += 6) {
    r.sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
    const c = P.clone().addScaledVector(U, 1.6);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      const q = c.clone().addScaledVector(R, Math.cos(a) * 4.8).addScaledVector(U, Math.sin(a) * 4.8);
      if (q.y > G + 0.4) SN([0.45, 0.45, 0.45], [q.x, q.y, q.z], k % 2 ? TEAL : 0x4aa8ff, { shape: 3 });
    }
  }
  // kelp: tall swaying strands, west and middle
  for (let k = 0; k < 46; k++) {
    const x = -74 + ((k * 41) % 100) / 100 * 120, z = 1190 + ((k * 67) % 100) / 100 * 96;
    const h = 8 + (k % 5) * 3;
    if (S([1.2, h, 1.2], [x, G + h / 2, z], KELP, 'Grass', { collide: 0, rot: RZ(((k % 7) - 3) * 0.05) }) < 0) continue;
    S([2, 0.3, 1.2], [x + 0.6, G + h * 0.6, z], 0x4a9a4a, 'Grass', { collide: 0, rot: RZ(0.6) });
  }
  // the coral reef along the dive, in every color
  for (let k = 0; k < 60; k++) {
    const x = -60 + ((k * 29) % 100) / 100 * 130, z = 1255 + ((k * 43) % 100) / 100 * 33;
    const c = [CORAL, PINK, GOLD, VIOLET, 0xff9a3a, 0x3ad8c8][k % 6], s = 1.2 + (k % 4) * 0.6;
    if (k % 3 === 0) S([s, s * 2.2, s], [x, G + s, z], c, 'SmoothPlastic', { collide: 0, shape: 5 });
    else if (k % 3 === 1) S([s * 1.6, s * 1.2, s * 1.6], [x, G + s * 0.5, z], c, 'SmoothPlastic', { collide: 0, shape: 3 });
    else S([0.4, s * 2, s * 1.4], [x, G + s, z], c, 'SmoothPlastic', { collide: 0, rot: RY(k) });
  }
  // the sunken galleon, on its side by the reef
  if (S([30, 14, 12], [-4, G + 6, 1266], 0x5a3a20, 'WoodPlanks', { collide: 0, rot: RZ(0.35) }) >= 0) {
    S([4, 22, 1.2], [-2, G + 14, 1266], 0x4a3020, 'Wood', { collide: 0, rot: RZ(0.9) });
    S([12, 8, 0.3], [4, G + 18, 1266], 0xd8d0b8, 'Fabric', { collide: 0, rot: RZ(0.9) });
    for (const dx of [-8, 0, 8]) S([1.6, 1.6, 0.4], [dx, G + 5.4 + dx * 0.34, 1259.7], GOLD, 'Neon', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
    S([4, 3, 3], [8, G + 1.6, 1256], 0x6a4a1a, 'WoodPlanks', { collide: 0 });
    SN([3.6, 0.6, 2.6], [8, G + 3.4, 1256], GOLD);
  }
  // the anglerfish's lure in the trench by the east wall
  if (S([10, 8, 10], [88, G + 6, 1278], 0x1a1a2a, 'SmoothPlastic', { collide: 0, shape: 3 }) >= 0) {
    S([0.3, 6, 0.3], [86, G + 11, 1272], 0x2a2a3a, 'Metal', { collide: 0, rot: RX(0.6) });
    SN([1.4, 1.4, 1.4], [86, G + 13.6, 1269], 0xe8ff9a, { shape: 3 });
    for (let k = 0; k < 6; k++) S([0.3, 1.2, 0.3], [83 + k * 1.2, G + 3.6, 1273.6], FOAM, 'SmoothPlastic', { collide: 0 });
    light(86, 13, 1268, 0xd8ff8a);
  }
  // treasure, bubbles rising, and a giant clam
  for (let k = 0; k < 30; k++) { const x = -70 + ((k * 23) % 100) * 1.6, z = 1192 + ((k * 31) % 100) * 0.95, y = 2 + (k % 10) * 2.4; SN([0.5, 0.5, 0.5], [x, G + y, z], FOAM, { shape: 3 }); }
  if (S([10, 4, 8], [-50, G + 2, 1260], 0xe8d8e8, 'SmoothPlastic', { collide: 0, shape: 3 }) >= 0) SN([2, 2, 2], [-50, G + 4.2, 1260], 0xfff8f0, { shape: 3 });

  // ======== the moving sea: a whale gliding overhead, the octopus, schools of fish, jellyfish
  const moving = (name, at, parts, prop) => { extras[name] = { pivot: [at[0], at[1], at[2], 1, 0, 0, 0, 1, 0, 0, 0, 1], parts }; props.push({ name, at, ...prop }); extrasNames.push(name); };
  // the whale: a slow swing about its middle, high over the reef
  {
    const at = [8, G + 25.5, 1262];
    const ok = [[-18, 0], [0, 0], [18, 0]].every(([dx]) => clearOf([12, 5, 8], [at[0] + dx, at[1], at[2]], 1.6));
    if (ok) {
      const W2 = 0x3a5a7a, BELLY = 0xd8e0e8;
      moving('Whale', at, [
        pp(0, [26, 5, 8], [0, 0, 0], W2, 'SmoothPlastic'), pp(0, [10, 4, 7], [-16, -0.4, 0], W2, 'SmoothPlastic'),
        pp(0, [24, 1.6, 7], [-1, -2.8, 0], BELLY, 'SmoothPlastic'), pp(0, [8, 1, 6], [17, 0.6, 0], W2, 'SmoothPlastic'),
        pp(0, [3, 0.5, 9], [21, 0.8, 0], W2, 'SmoothPlastic'), pp(0, [6, 0.4, 2], [-4, -2.4, 5], W2, 'SmoothPlastic', RX(0.4)), pp(0, [6, 0.4, 2], [-4, -2.4, -5], W2, 'SmoothPlastic', RX(-0.4)),
        pp(3, [0.7, 0.7, 0.4], [-18, 0.6, 3.5], 0x0a0a0a, 'SmoothPlastic'), pp(3, [0.7, 0.7, 0.4], [-18, 0.6, -3.5], 0x0a0a0a, 'SmoothPlastic'),
      ], { kind: 'swing', axis: 'x', amp: 0.08, freq: 0.6 });
    }
  }
  // the octopus in the helix: turning slowly, tentacles out
  {
    const at = [64, G, 1244];
    const parts = [pp(3, [8, 9, 8], [0, 7, 0], 0xc84a6a, 'SmoothPlastic'), pp(3, [1.6, 1.6, 1], [-1.6, 7, -3.8], 0xfff0c0, 'Neon'), pp(3, [1.6, 1.6, 1], [1.6, 7, -3.8], 0xfff0c0, 'Neon')];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(pp(0, [1.2, 1, 7], [Math.cos(a) * 4.5, 2.2, Math.sin(a) * 4.5], 0xb83a5a, 'SmoothPlastic', RY(Math.PI / 2 - a)));
      parts.push(pp(0, [0.9, 3, 0.9], [Math.cos(a) * 8, 3, Math.sin(a) * 8], 0xb83a5a, 'SmoothPlastic', RZ(0.3)));
    }
    if (clearOf([18, 12, 18], [at[0], 6, at[2]], 1)) moving('Octopus', at, parts, { kind: 'turn', speed: 0.25 });
  }
  // schools of fish circling: rings of little fish turning about a centre
  // (round the barrel roll, a ring of fish standing on edge: the train rolls through the middle of it)
  {
    const [x, y, z, n, rad] = [-68, 21.3, 1241, 22, 8];
    const parts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, dz = ((k * 7) % 5) * 0.8 - 1.6;
      parts.push(pp(0, [1.3, 0.5, 0.6], [Math.cos(a) * rad, Math.sin(a) * rad, dz], GOLD, 'SmoothPlastic', RZ(a + Math.PI / 2)));
      parts.push(pp(0, [0.5, 0.5, 0.5], [Math.cos(a) * rad + Math.sin(a) * 0.9, Math.sin(a) * rad - Math.cos(a) * 0.9, dz], GOLD, 'SmoothPlastic', RZ(a)));
    }
    const ok = Array.from({ length: 16 }, (_, k) => k).every((k) => { const a = (k / 16) * Math.PI * 2; return clearOf([1, 1, 3.6], [x + Math.cos(a) * rad, y + Math.sin(a) * rad, z], 0.2); });
    if (ok) moving('FishRing', [x, y, z], parts, { kind: 'spin', axis: 'z', speed: 0.8 });
  }
  for (const [name, x, y, z, n, rad, c] of [['FishB', 30, 24, 1205, 14, 6, 0xff8a3a], ['FishC', -30, 16, 1268, 16, 6, 0x9ae8ff]]) {
    const parts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, yy = ((k * 7) % 5) * 0.6 - 1.2;
      parts.push(pp(0, [0.6, 0.5, 1.3], [Math.cos(a) * rad, yy, Math.sin(a) * rad], c, 'SmoothPlastic', RY(-a)));
      parts.push(pp(1, [0.6, 0.5, 0.5], [Math.cos(a) * rad - Math.sin(a) * 0.9, yy, Math.sin(a) * rad + Math.cos(a) * 0.9], c, 'SmoothPlastic', RY(-a)));
    }
    // (only where the school's ring clears the train - or rings the barrel roll's heartline from a safe distance)
    const ringClear = Array.from({ length: 12 }, (_, k) => k).every((k) => { const a = (k / 12) * Math.PI * 2; return clearOf([1.4, 1.4, 1.4], [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad], 0.6); });
    if (ringClear) moving(name, [x, y, z], parts, { kind: 'turn', speed: 0.9 });
  }
  // jellyfish: glowing bells with trailing tentacles, pulsing
  let jelly = 0;
  for (const [x, y, z, c] of [[-20, 20, 1206], [36, 22, 1262, PINK], [-56, 24, 1212], [70, 22, 1214], [-24, 22, 1230, VIOLET], [50, 24, 1282]].map(([x, y, z, c]) => [x, y, z, c || [TEAL, PINK, VIOLET][Math.abs(x) % 3]])) {
    if (!clearOf([4, 8, 4], [x, y - 2, z], 1.4)) continue;
    const name = `Jelly${jelly++}`;
    const parts = [pp(3, [3.2, 2.2, 3.2], [0, 0, 0], c, 'Neon')];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; parts.push(pp(0, [0.15, 4, 0.15], [Math.cos(a) * 1, -2.6, Math.sin(a) * 1], c, 'Neon')); }
    moving(name, [x, y, z], parts, { kind: 'piston', amp: 1, freq: 1.2, phase: jelly });
    light(x, y, z, c);
  }
  void near; void T;
  return { ride: r.ride, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, entrance: [112, 1166], supports: r.supports };
}

// a toast the first time you come near
export class UnderTheSeasSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const [x, z] = this.layout.entrance;
    if (Math.hypot(pos.x - x, pos.z - z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: Under the Seas - a launched coaster into the deep, in Natural Kingdom\'s Coral Coast!', 'reward');
    }
  }
}
