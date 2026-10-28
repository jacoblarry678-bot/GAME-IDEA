// Stranger Things: Escape the Upside Down. A second motion-simulator dark
// ride, built like Diesel Run but themed to Hawkins: fully indoors, in a
// "Hawkins National Laboratory" show building on the land east of Fast &
// Furious, reached from Velocity City through a new gate and a path through
// Mirkwood. A very large indoor queue winds through the lab (monitors, the
// Byers' Christmas lights, Eleven's tank), then lab "containment pods" (a
// cabin on a six-legged motion base on a wheeled chassis) ride through the
// Gate into the Upside Down: the Byers' alphabet wall, Mirkwood at night,
// the Upside Down itself, the Mind Flayer, Starcourt Mall, Vecna's clock,
// back through the Gate and home.
//
// The building is the mirror image of Diesel Run's, so most of it is laid
// out in Diesel Run's frame (x running from its east wall at -390 to its
// west wall at -580) and mirrored into place here.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'StrangerThings';
const X = (x) => 220 - x; // Diesel Run's frame -> the world (mirrored)
const Z = (z) => z - 426;
const LANDS = [{ x0: 377, x1: 600, z0: -110, z1: -40 }, { x0: 598, x1: 808, z0: -400, z1: -110 }];
const GATE = { z0: -80.75, z1: -44.25 }; // between the east wall's pillars at z -83 and -42
const G = 0.1;
const FLOOR = 0.5;
const CARS = 3, SPACING = 14, H = 4;
const PLAT = FLOOR + H + 0.4;
// in Diesel Run's frame
const BLD = { x0: -580, x1: -390, z0: 34, z1: 272, H: 32 };
const INNER = -438;
const RED = 0xe02020, DEEP = 0x5a0a0a, VINE = 0x3a1414, LAB = 0xc8ccc8, LABDARK = 0x3a3e44, WHITE = 0xf4f4f0, BLUE = 0x3a6aff, FLUO = 0xe8f4ff, YELLOW = 0xf2c818;
const BULBS = [0xff2a2a, 0x2aff4a, 0x3a6aff, 0xffd030, 0xff8a20];

const P = (x, z, v) => [X(x), FLOOR, Z(z), v * 1.6];
const CIRCUIT = [
  P(-450, 104, 1),
  P(-450, 118, 2), P(-450, 128, 0.7), P(-450, 136, 1.2), // 1 the Gate
  P(-454, 148, 4), P(-466, 152, 5), P(-490, 152, 2), P(-505, 152, 0.7), P(-515, 152, 1.5), // 2 the Byers' wall
  P(-532, 152, 4), P(-543, 158, 3), P(-546, 172, 1), P(-546, 182, 0.7), P(-546, 192, 2), // 3 Mirkwood
  P(-544, 204, 4), P(-534, 210, 4), P(-515, 210, 1.2), P(-505, 210, 0.8), P(-494, 210, 2), // 4 the Upside Down
  P(-476, 210, 4), P(-467, 216, 3), P(-465, 228, 0.9), P(-465, 236, 1.1), // 5 the Mind Flayer
  P(-467, 248, 4), P(-478, 255, 4), P(-492, 255, 1.2), P(-500, 255, 2), P(-508, 255, 6), // 6 Starcourt
  P(-524, 255, 4), P(-540, 255, 3.5), P(-556, 255, 4), // 7 Vecna's lair
  P(-568, 250, 5), P(-572, 236, 7), P(-572, 200, 8), P(-572, 150, 8), P(-572, 100, 7), // 8 back through the Gate
  P(-569, 72, 5), P(-556, 62, 3), P(-528, 62, 1.2), P(-516, 62, 0.7), P(-504, 62, 1.5), // 9 home
  P(-480, 62, 4), P(-462, 64, 3), P(-452, 72, 2), P(-450, 84, 1.4), P(-450, 94, 1.1),
];
const SCENES = [
  { stop: [-450, 128], face: [-438, 128], style: 'launch', back: 14, fwd: 12 },
  { stop: [-505, 152], face: [-505, 180], style: 'engine', back: 16, fwd: 12 },
  { stop: [-546, 182], face: [-560, 182], style: 'highway', back: 18, fwd: 12 },
  { stop: [-505, 210], face: [-505, 232], style: 'canyon', back: 16, fwd: 12 },
  { stop: [-465, 232], face: [-438, 232], style: 'storm', back: 14, fwd: 12 },
  { stop: [-496, 255], face: [-496, 272], style: 'bridge', back: 10, fwd: 14 },
  { stop: [-540, 255], face: [-540, 230], style: 'fire', back: 18, fwd: 16 },
  { stop: [-572, 160], face: null, style: 'warp', back: 60, fwd: 60 },
  { stop: [-516, 62], face: [-516, 34], style: 'finish', back: 16, fwd: 12 },
];

// mirror a rotation (row-major) across x: negate the entries that mix x
const mirrorRot = (r) => [r[0], -r[1], -r[2], -r[3], r[4], r[5], -r[6], r[7], r[8]];
const swapFace = (f) => (f === 'Right' ? 'Left' : f === 'Left' ? 'Right' : f);

export function buildStrangerThings(data) {
  const W = helpers(data); // world helpers
  const { cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

  // Diesel Run-frame helpers: positions mirrored, yaws flipped, faces swapped
  const add = (size, pos, color, mat, o = {}) => W.add(size, [X(pos[0]), pos[1], Z(pos[2])], color, mat, { ...o, yaw: -(o.yaw || 0), rot: o.rot ? mirrorRot(o.rot) : null });
  const box = (size, base, color, mat, o) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const sign = (size, c, bg, face, labels, o = {}) => W.sign(size, [X(c[0]), c[1], Z(c[2])], bg, swapFace(face), labels, { ...o, yaw: -(o.yaw || 0) });
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const light = (x, y, z, color) => data.hauntLights.push([X(x), y, Z(z), color]);
  const tag = (list, x, y, z) => list.push([X(x), y, Z(z), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const cfm = (x, y, z, yaw = 0) => cf(X(x), y, Z(z), -yaw);
  const lampW = (x, z, color) => {
    W.box([0.5, 12, 0.5], [x, G, z], 0x2e3238, 'Metal');
    W.add([1.4, 1.4, 1.4], [x, G + 12.6, z], color, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 12.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };

  // ======== the site (world coordinates)
  data.flatZones = [...(data.flatZones || []), ...LANDS.map((l) => ({ ...l, margin: 24 }))];
  data.trees = (data.trees || []).filter((t) => !LANDS.some((l) => inRect(t.pos[0], t.pos[2], l, 6)));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, ...LANDS.map((l) => [l.x0, l.z0, l.x1, l.z1])];
  // the east wall: open between two pillars for the gate
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 375) < 0.5 && p[3] > 300 && p[6] - p[3] / 2 < GATE.z0 && p[6] + p[3] / 2 > GATE.z1;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(375, -206.3, 375, GATE.z0);
  wallSeg(375, GATE.z1, 375, 161.4);
  wallSeg(375, -40, 808, -40);
  wallSeg(808, -40, 808, -400);
  wallSeg(808, -400, 598, -400);
  const gz = (GATE.z0 + GATE.z1) / 2;
  W.add([210, 1, 290], [703, G - 0.5, -255], 0x3a3c40, 'Asphalt');
  W.add([223, 1, 70], [488.5, G - 0.5, -75], 0x2a3a22, 'Grass');

  // ---- through Mirkwood: the path from Velocity City to the lab
  const route = [[300, -50], [373, gz], [430, -80], [588, -96], [603, -112], [603, -283]];
  for (let i = 0; i < route.length - 1; i++) {
    const [xa, za] = route[i], [xb, zb] = route[i + 1];
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x6a5a48, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
  }
  // pines crowd the path, and a Hawkins road sign
  for (let k = 0; k < 46; k++) {
    const x = 384 + ((k * 53) % 210), z = -106 + ((k * 31) % 64);
    const near = route.some(([xa, za], i) => {
      if (i === route.length - 1) return false;
      const [xb, zb] = route[i + 1], dx = xb - xa, dz = zb - za;
      const u = Math.max(0, Math.min(1, ((x - xa) * dx + (z - za) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - xa - dx * u, z - za - dz * u) < 9;
    });
    if (!near) data.trees.push({ leaf: 0x1e3a22, kind: 'pine', s: 1.1 + ((k * 7) % 6) / 10, pos: [x, 0, z] });
  }
  W.box([0.4, 7, 0.4], [455, G, -90], 0x5a5e66, 'Metal');
  W.sign([7, 3.6, 0.2], [455, G + 7.6, -90], 0x1e5a2a, 'Back', [['HAWKINS', 0, 0.05, 1, 0.5, WHITE], ['POP. 30,000', 0, 0.58, 1, 0.36, WHITE, 'GothamBold']]);
  W.box([0.4, 6, 0.4], [520, G, -102], 0x5a4a3a, 'Wood');
  W.sign([6, 1.6, 0.2], [520, G + 6.4, -102], 0x2a1a10, 'Back', [['MIRKWOOD', 0, 0, 1, 1, 0xd8c8a0, 'GothamBold']]);
  for (const [x, z] of [[400, -60], [480, -76], [560, -86], [606, -150], [606, -220]]) lampW(x, z, RED);
  // a bike dropped in the woods, its light still on
  W.add([0.2, 1.6, 1.6], [470, G + 0.8, -70], 0x111111, 'Rubber', { shape: 2, yaw: 0.6 });
  W.add([0.2, 1.6, 1.6], [471.5, G + 0.8, -71.6], 0x111111, 'Rubber', { shape: 2, yaw: 0.6 });
  W.add([0.25, 0.25, 2.4], [470.7, G + 1.4, -70.8], 0xc81e1e, 'Metal', { yaw: 0.6, collide: 0 });
  W.add([0.4, 0.4, 0.4], [469.9, G + 1.6, -69.9], 0xfff4c0, 'Neon', { shape: 3, collide: 0 });
  // the gate in the wall: a chain-link gate and KEEP OUT signs
  for (const z of [GATE.z0 + 1.6, GATE.z1 - 1.6]) {
    W.box([2, 16, 2], [376, G, z], 0x5a5e66, 'Metal');
    W.add([0.4, 14, 0.4], [374.6, G + 8, z], RED, 'Neon', { collide: 0 });
  }
  W.add([3, 4, GATE.z1 - GATE.z0 + 2], [376, G + 18, gz], 0x2a2c30, 'Metal', { collide: 0 });
  for (const [dx, face] of [[-1.6, 'Left'], [1.6, 'Right']]) {
    W.sign([0.3, 3.4, 30], [376 + dx, G + 18.4, gz], 0x0a0a0c, face, [['STRANGER THINGS', 0, 0, 1, 0.62, RED], ['ESCAPE THE UPSIDE DOWN', 0, 0.62, 1, 0.38, WHITE, 'GothamBold']], { glow: true });
  }
  for (const z of [GATE.z0 - 3, GATE.z1 + 3]) {
    W.box([0.3, 3, 0.3], [370, G, z], 0x5a5e66, 'Metal');
    W.sign([0.2, 1.8, 3.2], [369.8, G + 3.6, z], WHITE, 'Left', [['KEEP OUT', 0, 0, 1, 0.55, RED], ['U.S. DEPT. OF ENERGY', 0, 0.55, 1, 0.45, 0x1a1a1a, 'GothamBold']]);
  }
  W.box([0.6, 6, 0.6], [368, G, GATE.z0 - 8], 0x2e3238, 'Metal');
  const waitPart = W.add([0.8, 6, 9.6], [368, G + 9, GATE.z0 - 8], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 41, cf: cf(369, G, gz + 7, Math.PI / 2) });
  W.box([0.6, 9, 0.6], [300, G, -58], 0x2a2c30, 'Metal');
  for (const face of ['Right', 'Left']) W.sign([0.3, 3.4, 10], [300 + (face === 'Right' ? 0.4 : -0.4), G + 9.4, -58], 0x0a0a0c, face, [['STRANGER THINGS', 0, 0, 1, 0.62, RED], ['NEW  ·  THIS WAY', 0, 0.62, 1, 0.38, WHITE, 'GothamBold']], { glow: true });

  // ======== the building, in Diesel Run's frame
  const B = BLD, T = 1.5, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const dIn = -287 + 426, dOut = 40; // the entrance at world z -287
  box([B.x1 - B.x0, FLOOR - G, B.z1 - B.z0], [cx, G, cz], 0x141518, 'Concrete');
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], LAB, 'Concrete');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], LAB, 'Concrete');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z1 - T / 2], LAB, 'Concrete');
  for (const [za, zb] of [[B.z0, dOut - 3.5], [dOut + 3.5, dIn - 5], [dIn + 5, B.z1]]) box([T, B.H, zb - za], [B.x1 - T / 2, G, (za + zb) / 2], LAB, 'Concrete');
  box([T, B.H - 10, 10], [B.x1 - T / 2, G + 10, dIn], LAB, 'Concrete');
  box([T, B.H - 8, 7], [B.x1 - T / 2, G + 8, dOut], LAB, 'Concrete');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0x8a8e94, 'Concrete', { collide: 0 });
  // the lab's look: a dark base band, red stripes, rows of small windows
  for (const [w, d, x, z] of [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2]]) {
    add([w, 4, d], [x, G + 2, z], LABDARK, 'Concrete', { collide: 0 });
    neon([w, 0.6, d], [x, G + 26, z], RED);
  }
  for (const [za, zb] of [[B.z0, dIn - 20], [dIn + 20, B.z1]]) {
    add([0.3, 4, zb - za], [B.x1 + 0.2, G + 2, (za + zb) / 2], LABDARK, 'Concrete', { collide: 0 });
    neon([0.3, 0.6, zb - za], [B.x1 + 0.2, G + 26, (za + zb) / 2], RED);
    for (let z = za + 6; z < zb - 4; z += 9) for (const y of [12, 18]) add([0.3, 2.4, 4], [B.x1 + 0.2, G + y, z], 0x1a2028, 'Glass', { collide: 0 });
  }
  // vines creeping up the walls from a red glowing crack by the door
  for (let k = 0; k < 14; k++) {
    const a = -0.9 + (k % 7) * 0.3, len = 6 + (k % 4) * 3;
    add([0.3, len, 0.5], [B.x1 + 0.35, G + len / 2 * Math.cos(a) + (k % 3), dIn + (k < 7 ? -14 - k * 1.5 : 14 + (k - 7) * 1.5)], VINE, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)] });
  }
  for (let k = 0; k < 5; k++) neon([0.3, 3 + k, 0.4], [B.x1 + 0.3, G + 4 + k * 2.2, dIn - 9 + (k % 2) * 0.8], RED, { rot: [1, 0, 0, 0, Math.cos(0.4 - k * 0.2), -Math.sin(0.4 - k * 0.2), 0, Math.sin(0.4 - k * 0.2), Math.cos(0.4 - k * 0.2)] });
  light(B.x1 + 4, 6, dIn - 9, RED);
  // the big sign: STRANGER THINGS in red over the entrance
  sign([0.4, 10, 50], [B.x1 + 0.4, G + 18.5, dIn], 0x050506, 'Right', [['STRANGER THINGS', 0, 0.04, 1, 0.6, RED], ['ESCAPE THE UPSIDE DOWN  ·  HAWKINS NATIONAL LABORATORY', 0, 0.68, 1, 0.26, WHITE, 'GothamBold']], { glow: true });
  neon([0.3, 0.3, 50], [B.x1 + 0.6, G + 13.2, dIn], RED);
  neon([0.3, 0.3, 50], [B.x1 + 0.6, G + 23.8, dIn], RED);
  add([7, 0.6, 16], [B.x1 + 3.5, G + 10.3, dIn], LABDARK, 'Metal', { collide: 0 });
  sign([0.2, 1.4, 12], [B.x1 + 6.9, G + 10.3, dIn], LABDARK, 'Right', [['HAWKINS LAB  ·  LEVEL 4 ACCESS', 0, 0, 1, 1, FLUO, 'GothamBold']], { glow: true });
  sign([0.2, 1.4, 6], [B.x1 + 6.8, G + 10.3, dOut], LABDARK, 'Right', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  add([6, 0.5, 9], [B.x1 + 3, G + 8.4, dOut], LABDARK, 'Metal', { collide: 0 });
  add([12, 0.4, dIn - dOut + 10], [B.x1 + 6, FLOOR - 0.2, (dIn + dOut) / 2], 0x3a3c42, 'Pavement');
  // a chain-link fence along the front, with security lights
  for (const z of [dIn - 30, dIn - 50, dIn + 30, dIn + 50]) {
    box([0.3, 9, 0.3], [B.x1 + 9, G, z], 0x8a9096, 'Metal');
    add([0.15, 8, 20], [B.x1 + 9, G + 4.5, z + (z < dIn ? -10 : 10)], 0x8a9096, 'Metal', { collide: 0, trans: 0.6 });
  }

  // ---- inside: the lab wall between the queue and the show
  const doorQ = 52;
  box([T, B.H, B.z1 - (doorQ + 4) - T], [INNER, G, (doorQ + 4 + B.z1 - T) / 2], LABDARK, 'Metal');
  box([T, B.H, doorQ - 4 - (B.z0 + T)], [INNER, G, (B.z0 + T + doorQ - 4) / 2], LABDARK, 'Metal');
  box([T, B.H - 10, 8], [INNER, G + 10, doorQ], LABDARK, 'Metal');
  const EXZ = 45;
  box([B.x1 - INNER - T, 12, 0.6], [(INNER + B.x1) / 2, G, EXZ], LABDARK, 'Metal');
  for (let x = INNER + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, G + 11, 40], 0x5adc6e);

  // ---- the queue: Hawkins Lab corridors, then seven long rows
  const ROWS = [-401, -406, -411, -416, -421, -426, -431];
  const south = 50, north = 248;
  add([B.x1 - INNER - 3, 0.2, north + 8 - EXZ], [(INNER + B.x1) / 2, FLOOR + 0.1, (EXZ + north + 8) / 2], 0xb8bcb4, 'SmoothPlastic', { collide: 0 });
  const fwdDR = [[B.x1 - 4, dIn], [-395, dIn], [-395, north + 4], [ROWS[0], north + 4]];
  ROWS.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwdDR.push([x, goSouth ? north : south]);
    fwdDR.push([x, goSouth ? south : north]);
  });
  fwdDR.push([INNER + 4, doorQ], [INNER - 2, doorQ]);
  const fwd = [[603, -200], [603, -283], [X(B.x1 + 3), Z(dIn)], ...fwdDR.map(([x, z]) => [X(x), Z(z)])];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 5, [-1, 0], FLOOR + 0.2);
  const railZ = (x, za, zb) => {
    add([0.22, 0.22, zb - za], [x, FLOOR + 3.2, (za + zb) / 2], RED, 'SmoothPlastic', { collide: 0 });
    add([0.16, 0.16, zb - za], [x, FLOOR + 1.9, (za + zb) / 2], 0x5a5e66, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [x, FLOOR, za + ((zb - za) * k) / n], 0x5a5e66, 'Metal');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    if (k % 2 === 0) railZ(x, north + 2, south + 3.6); else railZ(x, north - 3.6, south - 2);
  }
  railZ(-398.5, south - 2, north + 1.5);
  railZ(ROWS[6] - 2.5, south + 4, north + 6);
  // flickering fluorescent tubes over the rows (every few is out)
  for (const x of ROWS) for (let z = south + 8; z < north; z += 14) if ((Math.round(z) + Math.round(-x)) % 5) neon([0.5, 0.15, 7], [x, 14, z], FLUO);
  for (let z = 60; z < 250; z += 30) { light(-412, 13, z, 0xd8ecff); light(-396, 10, z + 15, RED); }
  // the Byers' Christmas lights strung all the way up the entrance corridor
  for (let z = dIn - 3; z < north + 2; z += 1.6) {
    const k = Math.round(z / 1.6);
    neon([0.35, 0.35, 0.35], [-393, 11 + Math.sin(z * 0.8) * 0.4, z], BULBS[((k % 5) + 5) % 5], { shape: 3 });
  }
  // lab monitors on the inner wall, posters up the corridor
  const brief = [['SUBJECT 011', 'TELEKINESIS  ·  REMOTE VIEWING  ·  CLASSIFIED'], ['GATE STATUS: OPEN', 'BREACH CONTAINMENT  ·  LEVEL 4'], ['DO NOT ENTER', 'THE UPSIDE DOWN  ·  HAZMAT REQUIRED'], ['HAWKINS POWER & LIGHT', 'OUTAGES REPORTED  ·  ALL OF HAWKINS']];
  brief.forEach(([title, sub], k) => {
    const z = 75 + k * 48;
    add([0.4, 8.4, 16.4], [INNER + 1, 9, z], 0x0a0c10, 'Metal', { collide: 0 });
    sign([0.2, 8, 16], [INNER + 1.25, 9, z], 0x1a0404, 'Right', [[title, 0, 0.18, 1, 0.34, RED], [sub, 0, 0.58, 1, 0.2, WHITE, 'GothamBold']], { glow: true });
  });
  [['HAWKINS NATIONAL LABORATORY', FLUO], ['AUTHORIZED PERSONNEL ONLY', RED], ['U.S. DEPARTMENT OF ENERGY', FLUO], ['FRIENDS DON\'T LIE', YELLOW]].forEach(([text, c], k) => {
    sign([0.3, 3, 11], [B.x1 - T - 0.2, 7, 70 + k * 40 + (k > 1 ? 30 : 0)], 0x101114, 'Left', [[text, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
  });
  // vines creeping across the hall ceiling
  for (let k = 0; k < 24; k++) add([0.35, 0.35, 10 + (k % 4) * 4], [-400 - (k % 7) * 5, 16 + (k % 3) * 0.6, 60 + k * 8], VINE, 'SmoothPlastic', { collide: 0, yaw: (k % 5) * 0.4 });
  // the north end of the hall: Eleven's sensory deprivation tank under a big screen
  box([9, 1, 9], [-414, FLOOR, 262], 0x5a5e66, 'Metal', { shape: 5 });
  add([8, 5, 8], [-414, FLOOR + 3.5, 262], 0x2a4a5a, 'Glass', { shape: 5, collide: 0, trans: 0.35 });
  box([0.3, 6, 0.3], [-414, FLOOR + 6, 262], 0x5a5e66, 'Metal', { collide: 0 });
  sign([30, 9, 0.4], [-414, 20, B.z1 - T - 0.4], 0x1a0404, 'Front', [['WELCOME TO HAWKINS LAB', 0, 0.1, 1, 0.4, RED], ['THE GATE IS OPEN.  WE NEED VOLUNTEERS.', 0, 0.55, 1, 0.3, WHITE]], { glow: true });
  light(-414, 10, 258, 0x5ab8ff);
  box([0.4, 7, 0.4], [-392.5, FLOOR, dIn + 7], 0x101114, 'Metal');
  sign([0.2, 2, 9], [-392.3, FLOOR + 6.4, dIn + 7], 0x101114, 'Left', [['ENTRANCE', 0, 0, 1, 1, RED]], { glow: true });

  // ---- the track: a black rail in the floor
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), Pv = new THREE.Vector3();
  for (let s = 0; s < track.length; s += 2) {
    sampler.matrixAt(s, m4);
    Pv.setFromMatrixPosition(m4);
    const e = m4.elements;
    W.add([1.6, 0.05, 2.2], [Pv.x, FLOOR + 0.03, Pv.z], 0x0a0a0c, 'Metal', { collide: 0, yaw: Math.atan2(-e[8], -e[10]) });
  }
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const scenes = SCENES.map((sc) => { const s = sAt(X(sc.stop[0]), Z(sc.stop[1])); return { s0: s - sc.back, s1: s + sc.fwd, target: sc.face ? [X(sc.face[0]), Z(sc.face[1])] : null, style: sc.style }; });

  // ---- the station
  const px0 = -445.8, px1 = INNER - T / 2;
  box([px1 - px0, PLAT - FLOOR, 46], [(px0 + px1) / 2, FLOOR, 88], 0x5a5e66, 'Concrete');
  neon([0.3, 0.06, 46], [px0 + 0.3, PLAT + 0.03, 88], YELLOW);
  const con = [px1 - 1.6, 108];
  box([1.4, 3, 2.4], [con[0], PLAT, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  sign([16, 3, 0.4], [-450, 14, 112], 0x101114, 'Back', [['CONTAINMENT PODS', 0, 0, 1, 0.6, RED], ['HAWKINS LAB  ·  BAY 4', 0, 0.6, 1, 0.4, FLUO, 'GothamBold']], { glow: true });
  light(-446, 12, 90, 0xd8ecff);

  // ---- the scenes
  const wall = (xa, za, xb, zb, h = 24, color = 0x1a1416) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([1, h, len], [(xa + xb) / 2, G + h / 2, (za + zb) / 2], color, 'Metal', { yaw });
  };
  wall(-462, 118, -565, 118);
  wall(-468, 182, -538, 182);
  wall(-474, 232, -560, 232);
  wall(-558, 126, -558, 238);
  const screen = (center, size, face, labels, bg = 0x1a0404) => {
    const [x, y, z] = center;
    add([size[0] + 0.6, size[1] + 0.6, size[2] + 0.6], [x, y, z], 0x050506, 'Metal', { collide: 0 });
    sign(size, [x + (face === 'Right' ? 0.35 : face === 'Left' ? -0.35 : 0), y, z + (face === 'Back' ? 0.35 : face === 'Front' ? -0.35 : 0)], bg, face, labels, { glow: true });
  };
  const vines = (x0, x1, z0, z1, n, y0 = 1, y1 = 20) => {
    for (let k = 0; k < n; k++) {
      const a = (k * 1.7) % 3 - 1.5;
      add([0.4, 6 + (k % 4) * 2, 0.4], [x0 + ((x1 - x0) * ((k * 37) % 100)) / 100, y0 + ((y1 - y0) * ((k * 53) % 100)) / 100, z0 + ((z1 - z0) * ((k * 71) % 100)) / 100], VINE, 'SmoothPlastic', { collide: 0, rot: [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1] });
    }
  };
  // 1 the Gate: a red, pulsing rift torn in the lab wall
  screen([INNER - 1.2, 13, 128], [0.3, 14, 26], 'Left', [['HAWKINS LAB  ·  LEVEL 4', 0, 0.04, 1, 0.16, FLUO, 'GothamBold'], ['THE GATE', 0, 0.78, 1, 0.2, RED]], 0x0a0204);
  for (let k = 0; k < 9; k++) {
    const a = (k - 4) * 0.28, len = 4 + (4 - Math.abs(k - 4)) * 1.6;
    neon([0.4, len, 0.6], [INNER - 1.8, 12 + (k % 2) * 0.8, 120 + k * 2], RED, { rot: [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)] });
  }
  vines(-446, -440, 112, 144, 14, 1, 22);
  for (const z of [114, 142]) { box([1, 6, 1], [-441, G, z], 0x2a2c30, 'Metal', { collide: 0 }); neon([1.2, 1.2, 1.2], [-441, G + 6.6, z], RED, { shape: 3 }); light(-442, 7, z, RED); }
  light(-445, 12, 128, RED);
  // 2 the Byers' house: the alphabet wall, the lights spelling R-U-N
  box([40, 18, 1.2], [-505, G, 178.5], 0x6a5a3a, 'WoodPlanks');
  add([40, 18, 0.2], [-505, G + 9, 177.8], 0x8a7a54, 'Fabric', { collide: 0 });
  const rows = ['ABCDEFGH', 'IJKLMNOPQ', 'RSTUVWXYZ'];
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const x = -505 + (c - (row.length - 1) / 2) * 4, y = G + 13 - r * 4.2;
    sign([2.6, 2.4, 0.2], [x, y, 177.6], 0x8a7a54, 'Front', [[ch, 0, 0, 1, 1, 0x1a1a1a]]);
    const on = 'RUN'.includes(ch);
    neon([on ? 0.9 : 0.5, on ? 0.9 : 0.5, on ? 0.9 : 0.5], [x, y + 1.8, 177.4], on ? 0xff2a2a : BULBS[(r * 3 + c) % 5], { shape: 3 });
  }));
  for (let k = 0; k < 24; k++) add([0.12, 0.12, 1.8], [-523 + k * 1.6, G + 15 + Math.sin(k) * 0.3, 177.4], 0x1a1a1a, 'Rubber', { collide: 0, yaw: Math.PI / 2 });
  box([12, 2.4, 3.4], [-505, G, 172], 0x5a3a24, 'Fabric', { collide: 0 }); // the couch
  box([0.4, 6, 0.4], [-490, G, 172], 0x2a2a2a, 'Metal', { collide: 0 });
  add([2, 1.6, 2], [-490, G + 6.6, 172], 0xffe8a0, 'Neon', { shape: 5, collide: 0 });
  light(-505, 10, 168, 0xffd8a0);
  light(-490, 7, 170, 0xff4a4a);
  // 3 Mirkwood at night: a dark forest, bikes, and the woods flipping upside down
  const hx = -557.2;
  add([0.3, 20, 52], [hx, G + 13, 182], 0x050a14, 'SmoothPlastic', { collide: 0 });
  for (let k = 0; k < 9; k++) add([0.3, 18, 1.4 + (k % 3) * 0.5], [hx + 0.1, G + 9, 160 + k * 5.5], 0x14100c, 'Wood', { collide: 0 });
  for (let k = 0; k < 8; k++) add([0.3, 5, 4 + (k % 2) * 2], [hx + 0.15, G + 15 + (k % 3), 162 + k * 6], 0x0c1a10, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 2.4, 14], [hx + 0.25, G + 21, 182], 0x050a14, 'Right', [['MIRKWOOD  ·  NOV 6, 1983', 0, 0, 1, 1, FLUO, 'GothamBold']], { glow: true });
  for (let k = 0; k < 7; k++) { const z = 168 + k * 4.5; add([0.6, 9, 0.6 + (k % 2) * 0.3], [-552 + (k % 2) * 2, G + 4.5, z], 0x1a140e, 'Wood', { shape: 5, collide: 0 }); }
  for (const z of [174, 192]) { // the boys' bikes, headlights on
    add([0.2, 1.6, 1.6], [-551, G + 0.8, z], 0x111111, 'Rubber', { shape: 2, collide: 0 });
    add([0.2, 1.6, 1.6], [-551, G + 0.8, z + 1.8], 0x111111, 'Rubber', { shape: 2, collide: 0 });
    add([0.3, 0.3, 2.4], [-551, G + 1.4, z + 0.9], [0xc81e1e, 0x2a6ae0][z > 180 ? 1 : 0], 'Metal', { collide: 0 });
    neon([0.4, 0.4, 0.4], [-551, G + 1.6, z - 0.4], 0xfff4c0, { shape: 3 });
  }
  data.tags.SteamVent.push([X(-552), G + 0.5, Z(176), 1, 0, 0, 0, 1, 0, 0, 0, 1], [X(-552), G + 0.5, Z(190), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-552, 8, 182, 0x5a8aff);
  // 4 the Upside Down: Hawkins grey and dead, vines everywhere, spores drifting
  for (let k = 0; k < 10; k++) {
    const x = -534 + k * 6.5, h1 = 8 + (k % 4) * 3, h2 = 10 + ((k + 2) % 4) * 3;
    add([5, h1, 4], [x, G + h1 / 2, 200 - (k % 2)], 0x2a2a30, 'Slate', { collide: 0, yaw: 0.3 * ((k % 3) - 1) });
    add([5, h2, 4], [x + 3, G + h2 / 2, 221 + (k % 2)], 0x24242a, 'Slate', { collide: 0, yaw: 0.25 * ((k % 3) - 1) });
  }
  vines(-538, -472, 196, 226, 40, 1, 18);
  screen([-505, 13, 230.8], [40, 16, 0.3], 'Front', [['THE UPSIDE DOWN', 0, 0.1, 1, 0.38, RED], ['IT KNOWS YOU\'RE HERE', 0, 0.6, 1, 0.22, WHITE, 'GothamBold']], 0x0c0a14);
  data.tags.SteamVent.push([X(-505), G + 0.5, Z(218), 1, 0, 0, 0, 1, 0, 0, 0, 1], [X(-520), G + 0.5, Z(203), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-505, 9, 212, 0x8a3aff);
  light(-520, 6, 222, RED);
  // 5 the Mind Flayer: a towering shadow against a red storm
  screen([INNER - 1.2, 12, 232], [0.3, 14, 26], 'Left', [['THE MIND FLAYER', 0, 0.06, 1, 0.24, 0xffd0d0], ['', 0, 0.3, 1, 0.4, RED], ['HAWKINS IS NEXT', 0, 0.8, 1, 0.16, 0xffd0d0, 'GothamBold']], 0x5a0808);
  box([1, 16, 4], [-441, G + 2, 232], 0x050505, 'SmoothPlastic', { collide: 0 });
  for (const [dz, a, len] of [[-6, 0.7, 12], [-3, 0.4, 14], [3, -0.4, 14], [6, -0.7, 12], [-9, 1.1, 10], [9, -1.1, 10]]) {
    add([0.8, len, 1.2], [-441.5, G + 16, 232 + dz], 0x050505, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)] });
  }
  for (let k = 0; k < 6; k++) neon([0.08, 3 + (k % 3), 0.08], [-458 + (k % 3) * 3, G + 15 + (k % 2) * 2, 222 + k * 4], 0xff6060);
  light(-450, 14, 232, RED);
  // 6 Starcourt Mall: neon storefronts, SCOOPS AHOY!, the floor giving way
  [['SCOOPS AHOY!', 0x5ac8ff], ['STARCOURT', 0xff4aa0], ['THE GAP', WHITE], ['JCPENNEY', 0xff6a3a]].forEach(([name, c], k) => {
    const x = -484 - k * 9;
    box([8.5, 12, 3], [x, G, 266], 0x2a2a34, 'SmoothPlastic', { collide: 0 });
    sign([7.6, 1.6, 0.2], [x, G + 10, 264.4], 0x101014, 'Front', [[name, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
    add([7, 6, 0.2], [x, G + 4, 264.4], 0x1a2a3a, 'Glass', { collide: 0 });
  });
  neon([40, 0.4, 0.4], [-496, G + 13.5, 264.4], 0xff4aa0);
  screen([-496, 22, 268.8], [36, 6, 0.3], 'Front', [['STARCOURT MALL  ·  JULY 4, 1985', 0, 0, 1, 1, 0xff9ad0, 'GothamBold']], 0x0a0614);
  light(-496, 10, 258, 0xff4aa0);
  light(-505, 8, 260, 0x5ac8ff);
  // 7 Vecna's lair: red light, vines, and the grandfather clock
  vines(-560, -522, 246, 264, 30, 1, 18);
  box([3.6, 12, 2.4], [-540, G, 266], 0x3a2214, 'Wood', { collide: 0 });
  add([3, 3, 0.3], [-540, G + 9.5, 264.7], 0xe8dcc0, 'SmoothPlastic', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  sign([2.4, 1, 0.1], [-540, G + 12.6, 264.6], 0x3a2214, 'Front', [['VECNA', 0, 0, 1, 1, RED, 'GothamBold']], { glow: true });
  for (let x = -526; x > -556; x -= 6) for (const z of [249, 261]) neon([0.6, 6, 0.6], [x, G + 3, z], RED);
  light(-540, 8, 255, RED);
  light(-528, 8, 255, 0xff3a3a);
  // 8 back through the Gate: rings of red and blue
  for (let z = 236; z > 92; z -= 8) {
    const c = Math.round(z / 8) % 2 ? RED : BLUE;
    add([12, 0.3, 0.3], [-572, G + 11.5, z], c, 'Neon', { collide: 0 });
    for (const dx of [-6, 6]) add([0.3, 11.5, 0.3], [-572 + dx, G + 5.75, z], c, 'Neon', { collide: 0 });
  }
  light(-572, 10, 200, RED);
  light(-572, 10, 140, BLUE);
  // 9 home: Hawkins, safe (for now)
  screen([-516, 12, B.z0 + T + 0.4], [36, 12, 0.3], 'Back', [['THE GATE IS CLOSED', 0, 0.08, 1, 0.3, 0x5adc6e], ['WELCOME BACK TO HAWKINS', 0, 0.45, 1, 0.3, WHITE], ['FRIENDS DON\'T LIE', 0, 0.8, 1, 0.14, YELLOW, 'GothamBold']]);
  for (let k = 0; k < 20; k++) neon([0.4, 0.4, 0.4], [-534 + k * 1.9, 20 + Math.sin(k * 0.9) * 0.4, B.z0 + T + 1], BULBS[k % 5], { shape: 3 });
  light(-516, 10, 70, 0x5adc6e);
  for (const [x, y, z, c] of [[-450, 16, 120, RED], [-498, 16, 160, 0xffd8a0], [-520, 16, 160, 0xffb070], [-552, 16, 172, 0x5a8aff], [-490, 16, 205, 0x8a3aff],
    [-525, 16, 215, RED], [-455, 16, 225, RED], [-485, 16, 250, 0xff4aa0], [-540, 16, 250, RED], [-540, 16, 62, WHITE]]) light(x, y, z, c);

  // ---- the vehicles: Hawkins Lab containment pods (built in the car's own frame)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const cabinParts = () => {
    const p = [];
    p.push(pp(0, [4.8, 0.4, 4.8], [0, -0.75, 0], 0x2a2c30, 'Metal'));
    p.push(pp(5, [5.6, 0.5, 5.6], [0, -0.3, 0], 0x1a1b1f, 'Metal'));
    p.push(pp(0, [7, 0.4, 8], [0, 0.2, 0], 0x6a6e74, 'Metal'));
    p.push(pp(0, [7, 0.6, 3.6], [0, 0.7, 2.2], 0x6a6e74, 'Metal'));
    for (const sd of [-1, 1]) {
      p.push(pp(0, [0.4, 5, 8], [sd * 3.5, 2.7, 0], LAB, 'SmoothPlastic'));
      for (let k = 0; k < 5; k++) p.push(pp(0, [0.1, 0.8, 1.05], [sd * 3.73, 4.0, -2.6 + k * 1.3], 0x0a0c10, 'Glass'));
      p.push(pp(0, [0.12, 0.6, 7], [sd * 3.72, 2.2, 0], RED, 'SmoothPlastic')); // the red lab stripe
      for (const z of [-4.05, 4.05]) p.push(pp(0, [0.5, 5.4, 0.5], [sd * 3.55, 2.7, z], 0x2a2c30, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 5.3, 0], 0x2a2c30, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 0.15, 0], 0x2a2c30, 'SmoothPlastic'));
    }
    p.push(pp(0, [7.6, 0.5, 8.6], [0, 5.3, 0], LAB, 'SmoothPlastic'));
    p.push(pp(0, [1.2, 0.4, 1.2], [0, 5.75, 2.5], 0x2a2c30, 'Metal')); // a roof beacon
    p.push(pp(3, [0.8, 0.8, 0.8], [0, 6.2, 2.5], RED, 'Neon'));
    p.push(pp(0, [7.6, 0.5, 0.5], [0, 5.3, -4.05], 0x2a2c30, 'SmoothPlastic'));
    p.push(pp(0, [7, 5, 0.4], [0, 2.7, 3.9], LAB, 'SmoothPlastic'));
    p.push(pp(1, [7, 1.6, 1.4], [0, 0.6, -4.6], LAB, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]));
    p.push(pp(0, [6.6, 0.8, 0.4], [0, 1.2, -3.85], 0x2a2c30, 'Metal'));
    p.push(pp(0, [5.6, 0.12, 0.1], [0, 1.65, -4.06], RED, 'Neon'));
    p.push(pp(0, [7.2, 0.12, 8.2], [0, -0.05, 0], RED, 'Neon'));
    for (const [z, y] of [[-1.5, 0.4], [1.8, 1.0]]) {
      for (const x of [-2.4, -0.8, 0.8, 2.4]) {
        p.push(pp(0, [1.4, 0.5, 1.5], [x, y + 0.25, z], 0x2a3a4a, 'Fabric'));
        p.push(pp(0, [1.4, 2.0, 0.4], [x, y + 1.4, z + 0.9], 0x2a3a4a, 'Fabric'));
      }
    }
    return p;
  };
  const seatList = () => {
    const seats = [];
    for (const [z, y] of [[-1.5, 0.4], [1.8, 1.0]]) for (const x of [-2.4, -0.8, 0.8, 2.4]) seats.push([x, y + 0.5 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return seats;
  };
  const ROT = (dir) => {
    const Yv = new THREE.Vector3(...dir).normalize();
    let Xv = new THREE.Vector3().crossVectors(Yv, new THREE.Vector3(0, 0, 1));
    if (Xv.lengthSq() < 1e-6) Xv.set(1, 0, 0);
    Xv.normalize();
    const Zv = new THREE.Vector3().crossVectors(Xv, Yv);
    return [Xv.x, Yv.x, Zv.x, Xv.y, Yv.y, Zv.y, Xv.z, Yv.z, Zv.z];
  };
  const baseParts = () => {
    const p = [];
    p.push(pp(0, [7, 0.5, 9], [0, 1.15, 0], 0x2a2c30, 'Metal'));
    for (const [x, z] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) {
      p.push(pp(0, [0.3, 0.6, 0.9], [x, 0.7, z], 0x3a3c42, 'Metal'));
      p.push(pp(2, [0.4, 0.8, 0.8], [x, 0.4, z], 0x111111, 'Rubber'));
    }
    p.push(pp(0, [2.4, 0.9, 3], [0, 1.8, 2], 0x1a1b1f, 'Metal'));
    p.push(pp(0, [4.6, 0.3, 4.6], [0, 1.55, 0], 0x1a1b1f, 'Metal'));
    for (let k = 0; k < 3; k++) {
      for (const sd of [-1, 1]) {
        const ab = (k / 3) * Math.PI * 2 + sd * 0.25, at = (k / 3) * Math.PI * 2 + Math.PI / 3 - sd * 0.9;
        const b = [Math.cos(ab) * 2.3, 1.75, Math.sin(ab) * 2.3], t = [Math.cos(at) * 1.9, H - 0.95, Math.sin(at) * 1.9];
        const d = [t[0] - b[0], t[1] - b[1], t[2] - b[2]], len = Math.hypot(...d), rot = ROT(d);
        const mid = (u) => [b[0] + d[0] * u, b[1] + d[1] * u, b[2] + d[2] * u];
        p.push(pp(5, [0.42, len * 0.55, 0.42], mid(0.3), 0x5a5e66, 'Metal', rot));
        p.push(pp(5, [0.22, len * 0.5, 0.22], mid(0.72), 0x9aa0a8, 'Metal', rot));
      }
    }
    return p;
  };
  const cars = [], seats = [], extras = {}, extrasNames = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13] + H, e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: cabinParts() });
    seats.push(seatList());
    extras[`Base${k + 1}`] = { pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: baseParts() };
    extrasNames.push(`Base${k + 1}`);
  }
  // animated scenery: the Demogorgon bursting out of the Byers' wall, the
  // Demodogs in the Upside Down, Vecna's clock pendulum, spores falling
  const props = [];
  const demo = () => [
    pp(0, [1.6, 3.2, 1], [0, 0, 0], 0x6a5a54, 'SmoothPlastic'), pp(0, [0.5, 3.2, 0.5], [-0.6, -3.2, 0], 0x5a4a44, 'SmoothPlastic'), pp(0, [0.5, 3.2, 0.5], [0.6, -3.2, 0], 0x5a4a44, 'SmoothPlastic'),
    pp(0, [0.4, 3.4, 0.4], [-1.1, 0.2, -0.8], 0x5a4a44, 'SmoothPlastic', [1, 0, 0, 0, 0.6, -0.8, 0, 0.8, 0.6]), pp(0, [0.4, 3.4, 0.4], [1.1, 0.2, -0.8], 0x5a4a44, 'SmoothPlastic', [1, 0, 0, 0, 0.6, -0.8, 0, 0.8, 0.6]),
    // the head opening like a flower, red inside
    ...[0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2; return pp(0, [0.9, 1.8, 0.2], [Math.cos(a) * 0.6, 2.6 + Math.sin(a) * 0.6, -0.4], 0x8a6a62, 'SmoothPlastic', [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1]); }),
    pp(3, [1, 1, 1], [0, 2.6, -0.2], 0xc81e1e, 'Neon'),
  ];
  const addProp = (name, parts, at, prop) => {
    const w = [X(at[0]), at[1], Z(at[2])];
    extras[name] = { pivot: [...w, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at: w, ...prop });
  };
  addProp('Demogorgon', demo(), [-497, G + 6.5, 175], { kind: 'lunge', dir: [0, -1], reach: 6, period: 5 });
  addProp('Demodog1', demo(), [-520, G + 6.5, 222], { kind: 'lunge', dir: [0, -1], reach: 4, period: 3.2 });
  addProp('Demodog2', demo(), [-488, G + 6.5, 199], { kind: 'lunge', dir: [0, 1], reach: 4, period: 2.7 });
  addProp('Pendulum', [pp(0, [0.15, 4, 0.15], [0, -2, 0], 0xc8a040, 'Metal'), pp(5, [1.2, 0.2, 1.2], [0, -4.2, 0], 0xc8a040, 'Metal', [1, 0, 0, 0, 0, -1, 0, 1, 0])], [-540, G + 7.5, 264.7], { kind: 'swing', amp: 0.5, freq: 2.2 });
  for (let k = 0; k < 4; k++) addProp(`Spore${k + 1}`, [pp(3, [0.6, 0.6, 0.6], [0, 0, 0], 0xd8d0c0, 'Neon')], [-528 + k * 11, G + 18, 207 + (k % 2) * 8], { kind: 'fall', drop: 16, period: 6 + k, phase: k * 0.31 });
  extrasNames.push(...props.map((p) => p.name));

  // ---- the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    Pv.setFromMatrixPosition(m4);
    stops.push(cf(X(px0 + 1), PLAT, Pv.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3]],
    console: cfm(con[0], PLAT, con[1], Math.PI / 2),
    operator: cfm(con[0] + 1.4, PLAT, con[1], Math.PI / 2),
    homes: [cfm(px0 + 2, PLAT, 78, Math.PI / 2), cfm(px0 + 2, PLAT, 70, Math.PI / 2)],
    exit: cfm(px1 - 2, PLAT, 104, -Math.PI / 2),
  };

  // ---- the ride
  const origin = [X(-500), 0, Z(160)];
  const ride = {
    id: RIDE_ID, kind: 'motionsim', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 8, party: 12, noExtended: true, queue: qpath, trackStyle: null, extras, extrasNames, crew,
    motionsim: { H, scenes, props },
  };
  data.rides.push(ride);
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - X(x)) ** 2 + (track.pos[i * 3 + 2] - Z(z)) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  const cues = [
    [at(-450, 130), 'sparks', [0, 3, -6]], [at(-505, 152), 'sparks', [0, 4, -8]], [at(-505, 210), 'sparks', [-4, 6, -10]],
    [at(-465, 232), 'sparks', [3, 7, -6]], [at(-496, 255), 'explosion', [0, 8, -12]], [at(-500, 255), 'explosion', [-8, 10, -10]],
    [at(-540, 255), 'fire', [-5, 0, 0]], [at(-532, 255), 'fire', [5, 0, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Stranger Things: Escape the Upside Down', land: 'Velocity', category: 'Thrill', thrill: 4, kind: 'darkride', carStyle: 'coaster',
    description: "Volunteer at Hawkins National Laboratory and ride a containment pod through the Gate: the Byers' alphabet wall, Mirkwood, the Upside Down, the Mind Flayer, Starcourt Mall and Vecna's clock. The pod turns, tilts and drops on its motion base, fully indoors.",
    baseWait: 75, origin, entrance: [X(-392.5), 0, Z(dIn + 7)], exit: [X(-382), 0, Z(dOut)], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [RED, LAB, BLUE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Stranger Things is open - mind the Demogorgon!', 'Friends don\'t lie: the Upside Down is that way.'];
  return { ride, gate: { x: 368, z: gz }, indoor: { x0: X(B.x1), x1: X(B.x0), z0: Z(B.z0), z1: Z(B.z1) } };
}

// a toast the first time you walk up to the new ride
export class StrangerThingsSite {
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
      this.hooks.toast('STRANGER THINGS: ESCAPE THE UPSIDE DOWN is now open! Follow the path through Mirkwood to Hawkins Lab. The Gate is open...', 'reward');
    }
  }
}
