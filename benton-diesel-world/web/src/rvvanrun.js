// RV Van Run: an indoor motion-simulator ride. The Benton family's retro
// motorhome (with you in it) slips its handbrake at the Benton RV Park and
// runs away on the road trip of a lifetime: the desert highway past the
// giant roadside dinosaur, a red-rock canyon with rocks coming down, a
// forest where Bigfoot steps out, a thunderstorm on the mountain pass, a
// wobbly wooden bridge over a gorge, a campsite with a bear in the cooler,
// a runaway plunge down the switchbacks and, somehow, back to the RV park.
//
// Its lodge-style show building stands east of Construction Runaway,
// through a gate in that site's east wall. Inside it uses Diesel Run's
// floor plan, laid out in Diesel Run's frame and mirrored into place.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'RVVanRun';
const X = (x) => 660 - x; // Diesel Run's frame -> the world (mirrored)
const Z = (z) => z + 216;
const SITE = { x0: 1006, x1: 1250, z0: 236, z1: 500 };
const GATE = { z0: 254, z1: 276 }; // in Construction Runaway's east wall (x 1004)
const G = 0.1;
const FLOOR = 0.5;
const CARS = 3, SPACING = 14, H = 4;
const PLAT = FLOOR + H + 0.4;
// in Diesel Run's frame
const BLD = { x0: -580, x1: -390, z0: 34, z1: 272, H: 32 };
const INNER = -438;
// the colors: cream and 70s stripes, dark wood, warm lights
const RED = 0xd8641e, LAB = 0xf0e6d0, LABDARK = 0x4a3a2a, WHITE = 0xf4f4f0, BLUE = 0x2a6a8a, FLUO = 0xfff0c8, YELLOW = 0xf2c818;
const BROWN = 0x6a4428, RUST = 0xb85a1e, MUSTARD = 0xe8a820, PINE = 0x1e3a22, ROCK = 0x9a4a2a, SKY = 0x6ab4ff;
const BULBS = [0xffd890, 0xffb060, 0xfff0c8];

const P = (x, z, v) => [X(x), FLOOR, Z(z), v * 1.6];

const CIRCUIT = [
  P(-450, 104, 1),
  P(-450, 118, 2), P(-450, 128, 0.7), P(-450, 136, 1.2), // 1 the RV park
  P(-454, 148, 4), P(-466, 152, 5), P(-490, 152, 2), P(-505, 152, 0.7), P(-515, 152, 1.5), // 2 the desert highway
  P(-532, 152, 4), P(-543, 158, 3), P(-546, 172, 1), P(-546, 182, 0.7), P(-546, 192, 2), // 3 the red-rock canyon
  P(-544, 204, 4), P(-534, 210, 4), P(-515, 210, 1.2), P(-505, 210, 0.8), P(-494, 210, 2), // 4 Bigfoot's forest
  P(-476, 210, 4), P(-467, 216, 3), P(-465, 228, 0.9), P(-465, 236, 1.1), // 5 the storm on the pass
  P(-467, 248, 4), P(-478, 255, 4), P(-492, 255, 1.2), P(-500, 255, 2), P(-508, 255, 6), // 6 the wobbly bridge
  P(-524, 255, 4), P(-540, 255, 3.5), P(-556, 255, 4), // 7 the bear at the campsite
  P(-568, 250, 5), P(-572, 236, 7), P(-572, 200, 8), P(-572, 150, 8), P(-572, 100, 7), // 8 down the switchbacks
  P(-569, 72, 5), P(-556, 62, 3), P(-528, 62, 1.2), P(-516, 62, 0.7), P(-504, 62, 1.5), // 9 back at the RV park
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

export function buildRVVanRun(data) {
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


  // ======== the site (world coordinates), east of Construction Runaway
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x4a6a34, 'Grass');
  // a gate in Construction Runaway's east wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 1004) < 0.6 && Math.abs(p[6] - 368) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(1004, 500, 1004, GATE.z1);
  wallSeg(1004, GATE.z0, 1004, 236);
  wallSeg(1004, 236, SITE.x1, 236);
  wallSeg(SITE.x1, 236, SITE.x1, SITE.z1);
  wallSeg(SITE.x1, SITE.z1, 1004, SITE.z1);
  const gz = (GATE.z0 + GATE.z1) / 2;
  // the gate: a log arch like a campground entrance
  for (const z of [GATE.z0 + 1.2, GATE.z1 - 1.2]) W.add([2, 18, 2], [1004, G + 9, z], BROWN, 'Wood', { shape: 5 });
  W.add([2.4, 2.4, GATE.z1 - GATE.z0 + 4], [1004, G + 17, gz], BROWN, 'Wood', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  for (const [dx, face] of [[-1.4, 'Left'], [1.4, 'Right']]) {
    W.sign([0.3, 3.6, 20], [1004 + dx, G + 13.6, gz], 0x3a2414, face, [['RV VAN RUN', 0, 0.02, 1, 0.6, MUSTARD], ['BENTON RV PARK & CAMPGROUND', 0, 0.64, 1, 0.34, 0xf4ecd8, 'GothamBold']], { glow: true });
  }
  // the walk: on from Construction Runaway's plaza, through the gate, up to the lodge
  const route = [[865, 262], [870, 265], [1004, 265], [1014, 265], [1014, Z(139)], [X(-387), Z(139)]];
  const exitRoute = [[X(-387), Z(40)], [1014, Z(40)], [1014, 265]];
  for (const r of [route, exitRoute]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x8a7a5a, 'Pavement', { yaw, collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }
  // the campground: pines, a parked retro RV, picnic tables, a trail sign
  const rvModel = (x, z, yaw) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (dx, dz) => [x + c * dx + s * dz, z - s * dx + c * dz];
    const bx = (size, dx, y, dz, color, mat) => { const [px, pz] = at(dx, dz); W.add(size, [px, y, pz], color, mat, { yaw }); };
    bx([8, 7, 22], 0, G + 4.6, 0, LAB, 'SmoothPlastic');
    for (const [y, c2] of [[3.6, RUST], [4.4, MUSTARD], [5.2, BROWN]]) bx([8.1, 0.5, 22.1], 0, G + y, 0, c2, 'SmoothPlastic');
    bx([7.6, 2.2, 0.2], 0, G + 6.2, -11.05, 0x2a3a4a, 'Glass');
    bx([2.4, 1.2, 3], 0, G + 8.7, 2, 0xd8d8d8, 'Metal');
    for (const dz of [-7, 7]) for (const dx of [-4, 4]) { const [px, pz] = at(dx, dz); W.add([0.8, 2.4, 2.4], [px, G + 1.2, pz], 0x111111, 'Rubber', { shape: 2, yaw }); }
  };
  rvModel(1030, 300, 0.12);
  for (let k = 0; k < 28; k++) {
    const x = SITE.x0 + 8 + ((k * 53) % 100) / 100 * (SITE.x1 - SITE.x0 - 16), z = SITE.z0 + 8 + ((k * 71) % 100) / 100 * (SITE.z1 - SITE.z0 - 16);
    if (x > X(-390) - 14 && x < X(-580) + 8 && z > Z(34) - 8 && z < Z(272) + 8) continue; // the building
    if (Math.abs(x - 1014) < 9 || Math.abs(z - 265) < 9 || Math.abs(z - Z(139)) < 9 || Math.abs(z - Z(40)) < 9 || Math.hypot(x - 1030, z - 300) < 16 || (x > 1022 && x < 1046 && z > 425 && z < 452)) continue; // the walks, the RV, the tables
    data.trees.push({ leaf: PINE, kind: 'pine', s: 1.1 + ((k * 7) % 6) / 10, pos: [x, 0, z] });
  }
  for (const [x, z] of [[1032, 432], [1032, 446]]) {
    W.box([5, 0.4, 2], [x, G + 2.4, z], BROWN, 'WoodPlanks');
    for (const dz of [-1.6, 1.6]) W.box([5, 0.3, 0.8], [x, G + 1.4, z + dz], BROWN, 'WoodPlanks');
    for (const dx of [-2, 2]) W.box([0.4, 2.4, 0.4], [x + dx, G, z], BROWN, 'Wood', { collide: 0 });
  }
  W.box([0.5, 6, 0.5], [1020, G, 296], BROWN, 'Wood');
  W.sign([6, 3.2, 0.2], [1020, G + 7, 296], 0x2a4a2a, 'Front', [['RV VAN RUN', 0, 0.05, 1, 0.5, MUSTARD], ['LINE STARTS HERE', 0, 0.6, 1, 0.34, 0xf4ecd8, 'GothamBold']]);
  for (const [x, z] of [[1010, 250], [1010, 330], [1010, 420], [1040, 498 - 6]]) lampW(x, z, 0xffd890);
  // wait times, a greeter
  W.box([0.6, 6, 0.6], [998, G, 278], 0x2e3238, 'Metal');
  const waitPart = W.add([0.8, 6, 9.6], [998, G + 9, 278], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 61, cf: cf(1010, G, 272, -Math.PI / 2) });

  // ======== the building, in Diesel Run's frame
  const B = BLD, T = 1.5, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const dIn = 139, dOut = 40; // the entrance and exit doors (world z 355 and 256)
  box([B.x1 - B.x0, FLOOR - G, B.z1 - B.z0], [cx, G, cz], 0x141518, 'Concrete');
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], BROWN, 'WoodPlanks');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], BROWN, 'WoodPlanks');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z1 - T / 2], BROWN, 'WoodPlanks');
  for (const [za, zb] of [[B.z0, dOut - 3.5], [dOut + 3.5, dIn - 5], [dIn + 5, B.z1]]) box([T, B.H, zb - za], [B.x1 - T / 2, G, (za + zb) / 2], BROWN, 'WoodPlanks');
  box([T, B.H - 10, 10], [B.x1 - T / 2, G + 10, dIn], BROWN, 'WoodPlanks');
  box([T, B.H - 8, 7], [B.x1 - T / 2, G + 8, dOut], BROWN, 'WoodPlanks');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0x2a4a2a, 'Metal', { collide: 0 });
  // the lodge look: a fieldstone base, log trim, a green roof edge, a
  // retro stripe of orange, mustard and brown, and rows of cabin windows
  for (const [w, d, x, z] of [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2]]) {
    add([w, 5, d], [x, G + 2.5, z], 0x6a665e, 'Slate', { collide: 0 });
    for (const [y, c] of [[24.4, RUST], [25.4, MUSTARD], [26.4, BROWN]]) add([w, 1, d], [x, G + y, z], c, 'SmoothPlastic', { collide: 0 });
    add([w + 0.6, 1.4, d + 0.6], [x, G + B.H - 0.4, z], 0x2a4a2a, 'Metal', { collide: 0 });
  }
  for (const [za, zb] of [[B.z0, dIn - 26], [dIn + 26, B.z1]]) {
    add([0.3, 5, zb - za], [B.x1 + 0.2, G + 2.5, (za + zb) / 2], 0x6a665e, 'Slate', { collide: 0 });
    for (const [y, c] of [[24.4, RUST], [25.4, MUSTARD], [26.4, BROWN]]) add([0.3, 1, zb - za], [B.x1 + 0.2, G + y, (za + zb) / 2], c, 'SmoothPlastic', { collide: 0 });
    for (let z = za + 6; z < zb - 4; z += 10) for (const y of [11, 17]) { add([0.3, 3, 4], [B.x1 + 0.25, G + y, z], 0x1a2028, 'Glass', { collide: 0 }); add([0.35, 3.4, 0.3], [B.x1 + 0.3, G + y, z - 2.1], BROWN, 'Wood', { collide: 0 }); add([0.35, 3.4, 0.3], [B.x1 + 0.3, G + y, z + 2.1], BROWN, 'Wood', { collide: 0 }); }
  }
  // the front: a timber porch under a big retro sign, log posts, lanterns
  sign([0.4, 10, 54], [B.x1 + 0.4, G + 18.5, dIn], 0x2a1a10, 'Right', [['RV VAN RUN', 0, 0.04, 1, 0.58, MUSTARD], ['THE ROAD TRIP OF A LIFETIME  ·  BENTON RV PARK & CAMPGROUND', 0, 0.68, 1, 0.24, 0xf4ecd8, 'GothamBold']], { glow: true });
  for (const [y, c] of [[12.8, RUST], [13.4, MUSTARD], [24.2, MUSTARD], [24.8, RUST]]) add([0.3, 0.5, 54], [B.x1 + 0.6, G + y, dIn], c, 'SmoothPlastic', { collide: 0 });
  add([8, 0.6, 22], [B.x1 + 4, G + 10.3, dIn], 0x2a4a2a, 'Metal', { collide: 0 });
  for (const dz of [-10, 10]) box([0.9, 10, 0.9], [B.x1 + 7.6, G, dIn + dz], BROWN, 'Wood', { shape: 5 });
  for (const dz of [-6, 6]) { neon([0.8, 1.2, 0.8], [B.x1 + 7.6, G + 8.4, dIn + dz], 0xffd890); light(B.x1 + 6, 8, dIn + dz, 0xffd890); }
  sign([0.2, 1.4, 12], [B.x1 + 8, G + 9.4, dIn], 0x2a1a10, 'Right', [['CHECK IN  ·  ALL ABOARD', 0, 0, 1, 1, MUSTARD, 'GothamBold']], { glow: true });
  sign([0.2, 1.4, 6], [B.x1 + 6.8, G + 10.3, dOut], 0x2a1a10, 'Right', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  add([6, 0.5, 9], [B.x1 + 3, G + 8.4, dOut], 0x2a4a2a, 'Metal', { collide: 0 });
  add([12, 0.4, dIn - dOut + 10], [B.x1 + 6, FLOOR - 0.2, (dIn + dOut) / 2], 0x8a7a5a, 'Pavement');
  // a split-rail fence along the front
  for (const z of [dIn - 30, dIn - 50, dIn + 30, dIn + 50]) {
    for (let k = 0; k <= 4; k++) box([0.4, 3.4, 0.4], [B.x1 + 10, G, z + (z < dIn ? -k * 5 : k * 5)], BROWN, 'Wood');
    for (const y of [1.4, 2.8]) add([0.3, 0.3, 20], [B.x1 + 10, G + y, z + (z < dIn ? -10 : 10)], BROWN, 'Wood', { collide: 0 });
  }


  // ---- inside: the wall between the queue and the show
  const doorQ = 52;
  box([T, B.H, B.z1 - (doorQ + 4) - T], [INNER, G, (doorQ + 4 + B.z1 - T) / 2], LABDARK, 'Metal');
  box([T, B.H, doorQ - 4 - (B.z0 + T)], [INNER, G, (B.z0 + T + doorQ - 4) / 2], LABDARK, 'Metal');
  box([T, B.H - 10, 8], [INNER, G + 10, doorQ], LABDARK, 'Metal');
  const EXZ = 45;
  box([B.x1 - INNER - T, 12, 0.6], [(INNER + B.x1) / 2, G, EXZ], LABDARK, 'Metal');
  for (let x = INNER + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, G + 11, 40], 0x5adc6e);


  // ---- the queue: the ranger station and the RV showroom, seven long rows
  const ROWS = [-401, -406, -411, -416, -421, -426, -431];
  const south = 50, north = 248;
  add([B.x1 - INNER - 3, 0.2, north + 8 - EXZ], [(INNER + B.x1) / 2, FLOOR + 0.1, (EXZ + north + 8) / 2], 0x7a5a3a, 'WoodPlanks', { collide: 0 });
  const fwdDR = [[B.x1 - 4, dIn], [-395, dIn], [-395, north + 4], [ROWS[0], north + 4]];
  ROWS.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwdDR.push([x, goSouth ? north : south]);
    fwdDR.push([x, goSouth ? south : north]);
  });
  fwdDR.push([INNER + 4, doorQ], [INNER - 2, doorQ]);
  const fwd = [[1014, 300], [1014, Z(dIn)], [X(B.x1 + 3), Z(dIn)], ...fwdDR.map(([x, z]) => [X(x), Z(z)])];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 5, [-1, 0], FLOOR + 0.2);
  const railZ = (x, za, zb) => {
    add([0.3, 0.3, zb - za], [x, FLOOR + 3.2, (za + zb) / 2], BROWN, 'Wood', { collide: 0 });
    add([0.22, 0.22, zb - za], [x, FLOOR + 1.9, (za + zb) / 2], BROWN, 'Wood', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.4, 3.1, 0.4], [x, FLOOR, za + ((zb - za) * k) / n], BROWN, 'Wood');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    if (k % 2 === 0) railZ(x, north + 2, south + 3.6); else railZ(x, north - 3.6, south - 2);
  }
  railZ(-398.5, south - 2, north + 1.5);
  railZ(ROWS[6] - 2.5, south + 4, north + 6);
  // string lights and lanterns over the rows
  for (const x of ROWS) for (let z = south + 2; z < north; z += 1.8) neon([0.3, 0.3, 0.3], [x, 12.6 + Math.sin(z * 0.5) * 0.4, z], BULBS[Math.round(z) % 3], { shape: 3 });
  for (let z = 60; z < 250; z += 30) { light(-412, 12, z, 0xffd890); light(-396, 9, z + 15, 0xffb060); }
  // the ranger station: posters and maps on the inner wall
  const brief = [['BENTON RV PARK', 'CHECK-OUT 11 AM  ·  SET YOUR HANDBRAKE'], ['ROAD CONDITIONS', 'CANYON: FALLING ROCKS  ·  PASS: STORMS'], ['WILDLIFE ADVISORY', 'BEARS ACTIVE  ·  BIGFOOT SIGHTED (PROBABLY)'], ['YOUR RV', '1974 BENTON CRUISER  ·  SLEEPS 8  ·  BRAKES: ?']];
  brief.forEach(([title, sub], k) => {
    const z = 75 + k * 48;
    add([0.4, 8.4, 16.4], [INNER + 1, 9, z], BROWN, 'Wood', { collide: 0 });
    sign([0.2, 8, 16], [INNER + 1.25, 9, z], 0x2a4a2a, 'Right', [[title, 0, 0.18, 1, 0.34, MUSTARD], [sub, 0, 0.58, 1, 0.2, 0xf4ecd8, 'GothamBold']]);
  });
  [['LEAVE NO TRACE', 0xf4ecd8], ['DO NOT FEED THE BEARS', MUSTARD], ['FIRE DANGER: HIGH', RUST], ['SPEED LIMIT 15 (RVs: PLEASE)', 0xf4ecd8]].forEach(([text, c], k) => {
    sign([0.3, 3, 11], [B.x1 - T - 0.2, 7, 70 + k * 40 + (k > 1 ? 30 : 0)], 0x2a4a2a, 'Left', [[text, 0, 0, 1, 1, c, 'GothamBold']]);
  });
  // license plates from every state, along the corridor
  for (let k = 0; k < 30; k++) sign([0.1, 0.9, 1.8], [B.x1 - T - 0.15, 3 + (k % 3) * 1.2, 150 + Math.floor(k / 3) * 2.2], [0xf4ecd8, 0xf2c818, 0x2a6a8a, 0xd8641e][k % 4], 'Left', [[`${['TX', 'CA', 'MI', 'OR', 'NV', 'AZ', 'CO', 'UT'][k % 8]} ${100 + k * 37}`, 0, 0, 1, 1, 0x1a1a1a, 'GothamBold']]);
  // the north end of the hall: a 1974 Benton Cruiser on display, under a big sign
  box([26, 0.6, 11], [-414, FLOOR, 263.5], 0x3a3a3a, 'Concrete');
  box([22, 6.4, 7], [-414, FLOOR + 1.8, 263.5], LAB, 'SmoothPlastic');
  for (const [y, c] of [[4.2, RUST], [5, MUSTARD], [5.8, BROWN]]) add([22.1, 0.5, 7.1], [-414, FLOOR + y, 263.5], c, 'SmoothPlastic', { collide: 0 });
  for (const dx of [-7, 7]) for (const dz of [-3.5, 3.5]) add([0.8, 2.4, 2.4], [-414 + dx, FLOOR + 1.8, 263.5 + dz], 0x111111, 'Rubber', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  add([0.2, 2.2, 6.6], [-425.1, FLOOR + 6.2, 263.5], 0x2a3a4a, 'Glass', { collide: 0 });
  add([1.2, 0.2, 8], [-414 + 9.5, FLOOR + 1.6, 263.5], 0x8a8e94, 'Metal', { collide: 0 });
  sign([30, 9, 0.4], [-414, 20, B.z1 - T - 0.4], 0x2a1a10, 'Front', [['MEET THE CRUISER', 0, 0.1, 1, 0.4, MUSTARD], ['SLEEPS 8  ·  SEATS 8  ·  HANDBRAKE: NEEDS WORK', 0, 0.55, 1, 0.3, 0xf4ecd8]], { glow: true });
  light(-414, 10, 258, 0xffd890);
  box([0.4, 7, 0.4], [-392.5, FLOOR, dIn + 7], BROWN, 'Wood');
  sign([0.2, 2, 9], [-392.3, FLOOR + 6.4, dIn + 7], 0x2a1a10, 'Left', [['ENTRANCE', 0, 0, 1, 1, MUSTARD]], { glow: true });


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
  sign([16, 3, 0.4], [-450, 14, 112], 0x2a1a10, 'Back', [['SITE 4  ·  BOARDING', 0, 0, 1, 0.6, MUSTARD], ['BUCKLE UP, HAPPY CAMPERS', 0, 0.6, 1, 0.4, 0xf4ecd8, 'GothamBold']], { glow: true });
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
  const pine = (x, z, h = 14) => {
    add([1, h * 0.4, 1], [x, G + h * 0.2, z], 0x4a3020, 'Wood', { shape: 5, collide: 0 });
    for (let k = 0; k < 3; k++) add([h * 0.42 - k * h * 0.1, h * 0.3, h * 0.42 - k * h * 0.1], [x, G + h * 0.4 + k * h * 0.2, z], PINE, 'Grass', { shape: 5, collide: 0 });
  };
  const rockTower = (x, z, h, w = 4) => {
    add([w, h, w * 0.9], [x, G + h / 2, z], ROCK, 'Slate', { collide: 0, yaw: x * 0.3 });
    add([w * 1.2, h * 0.12, w * 1.1], [x, G + h * 0.7, z], 0x8a3a1e, 'Slate', { collide: 0, yaw: x * 0.5 });
  };
  // 1 the RV park: the camp office and a SLOW sign, the handbrake slipping
  screen([INNER - 1.2, 13, 128], [0.3, 14, 26], 'Left', [['BENTON RV PARK', 0, 0.04, 1, 0.18, MUSTARD], ['CHECK-OUT 11 AM', 0, 0.3, 1, 0.12, 0xf4ecd8, 'GothamBold'], ['HANDBRAKE?', 0, 0.78, 1, 0.18, RUST]], 0x2a3a4a);
  for (const z of [114, 142]) { box([0.4, 6, 0.4], [-441, G, z], BROWN, 'Wood', { collide: 0 }); neon([1.2, 1.2, 1.2], [-441, G + 6.6, z], 0xffd890, { shape: 3 }); light(-442, 7, z, 0xffd890); }
  sign([0.2, 2.4, 2.4], [-442, G + 4, 120], YELLOW, 'Left', [['SLOW', 0, 0, 1, 1, 0x1a1a1a]]);
  for (let k = 0; k < 3; k++) add([1.2, 2.6, 1.2], [-443, G + 1.3, 136 + k * 1.5], 0xd8d8d8, 'Metal', { shape: 5, collide: 0 }); // propane tanks
  light(-445, 12, 128, 0xffd890);
  // 2 the desert highway: a giant roadside dinosaur and a gas station sign
  box([40, 18, 1.2], [-505, G, 178.5], 0xe8b878, 'SmoothPlastic');
  add([40, 18, 0.2], [-505, G + 9, 177.8], 0xffc890, 'Neon', { collide: 0 });
  screen([-505, 13, 177.4], [38, 14, 0.3], 'Front', [['ROUTE 74', 0, 0.06, 1, 0.16, 0x1a1a1a], ['NEXT GAS 200 MILES', 0, 0.8, 1, 0.14, RUST, 'GothamBold']], 0xf0b878);
  const dino = [-492, 170];
  box([5, 6, 12], [dino[0], G + 3, dino[1]], 0x3a8a3a, 'SmoothPlastic', { collide: 0 });
  add([2.4, 9, 2.4], [dino[0], G + 12, dino[1] - 6], 0x3a8a3a, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.3), -Math.sin(0.3), 0, Math.sin(0.3), Math.cos(0.3)] });
  box([3.2, 2.6, 4.4], [dino[0], G + 15.4, dino[1] - 8.5], 0x3a8a3a, 'SmoothPlastic', { collide: 0 });
  for (const [dx, dz] of [[-2, -4], [2, -4], [-2, 4], [2, 4]]) box([1.4, 3.4, 1.4], [dino[0] + dx, G, dino[1] + dz], 0x2a7a2a, 'SmoothPlastic', { collide: 0 });
  add([1.6, 1.6, 8], [dino[0], G + 4, dino[1] + 9], 0x3a8a3a, 'SmoothPlastic', { collide: 0 });
  box([0.5, 12, 0.5], [-520, G, 172], 0x5a5e66, 'Metal', { collide: 0 });
  sign([6, 3, 0.3], [-520, G + 13.5, 172], 0xd8641e, 'Front', [['BENTON GAS', 0, 0, 1, 0.55, WHITE], ['99¢', 0, 0.55, 1, 0.45, YELLOW]], { glow: true });
  for (const x of [-534, -478]) { add([1, 6, 1], [x, G + 3, 172], 0x3a6a2a, 'Grass', { collide: 0 }); add([2.6, 0.8, 0.8], [x, G + 4, 172], 0x3a6a2a, 'Grass', { collide: 0 }); }
  light(-505, 10, 168, 0xffd8a0);
  light(-490, 8, 170, 0xffc070);
  // 3 the red-rock canyon: towers of red rock all around, rocks coming down
  const hx = -557.2;
  add([0.3, 20, 52], [hx, G + 13, 182], 0xd88a4a, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 2.4, 14], [hx + 0.25, G + 21, 182], 0xd88a4a, 'Right', [['CANYON ROAD  ·  FALLING ROCKS', 0, 0, 1, 1, 0x3a1a0a, 'GothamBold']]);
  for (const [z, h] of [[162, 16], [170, 22], [196, 18], [204, 24]]) rockTower(-555.4, z, h, 2);
  for (let k = 0; k < 6; k++) rockTower(-555.6, 166 + k * 6, 2 + (k % 3), 1.2);
  light(-552, 10, 182, 0xffa060);
  // 4 Bigfoot's forest: tall pines, ferns, a SASQUATCH CROSSING sign
  for (let k = 0; k < 8; k++) {
    pine(-534 + k * 6.5, 200 - (k % 2) * 2, 12 + (k % 3) * 3);
    pine(-531 + k * 6.5, 222 + (k % 2) * 2, 14 + ((k + 1) % 3) * 3);
  }
  screen([-505, 13, 230.8], [40, 16, 0.3], 'Front', [['SASQUATCH CROSSING', 0, 0.1, 1, 0.3, MUSTARD], ['NEXT 5 MILES  ·  DO NOT STOP', 0, 0.6, 1, 0.2, WHITE, 'GothamBold']], 0x0e1a10);
  data.tags.SteamVent.push([X(-505), G + 0.5, Z(218), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-505, 9, 212, 0x9ad890);
  light(-520, 6, 222, 0xffd890);
  // 5 the storm on the pass: lightning on the screen, rain, a swinging sign
  screen([INNER - 1.2, 12, 232], [0.3, 14, 26], 'Left', [['MOUNTAIN PASS', 0, 0.06, 1, 0.16, WHITE], ['', 0, 0.3, 1, 0.4, WHITE], ['ROAD CLOSED (TOO LATE)', 0, 0.8, 1, 0.14, YELLOW, 'GothamBold']], 0x1a2030);
  for (let k = 0; k < 6; k++) neon([0.1, 3 + (k % 3), 0.1], [-458 + (k % 3) * 3, G + 15 + (k % 2) * 2, 222 + k * 4], 0xe8f0ff);
  for (const z of [222, 242]) data.tags.SteamVent.push([X(-452), G + 0.5, Z(z), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-450, 14, 232, 0x9ab8ff);
  // 6 the wobbly bridge: rope rails, a gorge below, planks coming loose
  for (const sz of [-7.5, 7.5]) add([40, 0.3, 0.3], [-496, G + 3.4, 255 + sz], 0xc8a878, 'Fabric', { collide: 0 });
  for (let x = -515; x < -477; x += 4) for (const sz of [-7.5, 7.5]) box([0.4, 3.6, 0.4], [x, G, 255 + sz], BROWN, 'Wood', { collide: 0 });
  add([36, 0.3, 4], [-496, G + 0.2, 266], 0x3a8ad8, 'Neon', { collide: 0 });
  screen([-496, 22, 268.8], [36, 6, 0.3], 'Front', [["DEVIL'S GORGE  ·  DON'T LOOK DOWN", 0, 0, 1, 1, 0xf4ecd8, 'GothamBold']], 0x2a3a4a);
  light(-496, 10, 258, 0x9ad8ff);
  // 7 the bear at the campsite: tents, a campfire, a cooler, marshmallows
  for (const [x, c] of [[-528, 0x3a8a3a], [-552, RUST]]) {
    add([6, 4, 6], [x, G + 2, 264], c, 'Fabric', { shape: 1, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  }
  box([1.6, 0.6, 1.6], [-540, G, 248], 0x3a2a20, 'Slate', { collide: 0 });
  data.tags.Campfire.push([X(-540), G + 0.8, Z(248), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  box([2.4, 1.6, 1.6], [-546, G, 262], 0x2a6ad8, 'SmoothPlastic', { collide: 0 });
  for (let x = -526; x > -556; x -= 6) neon([0.5, 0.5, 0.5], [x, G + 9, 262], 0xffd890, { shape: 3 });
  light(-540, 6, 250, 0xff8a30);
  light(-528, 8, 255, 0xffd890);
  // 8 down the switchbacks: road reflectors and headlight beams racing past
  for (let z = 236; z > 92; z -= 8) {
    add([12, 0.3, 0.3], [-572, G + 11.5, z], Math.round(z / 8) % 2 ? YELLOW : WHITE, 'Neon', { collide: 0 });
    for (const dx of [-6, 6]) add([0.4, 0.8, 0.4], [-572 + dx, G + 1, z], RUST, 'Neon', { collide: 0 });
    add([0.4, 0.05, 3], [-572, FLOOR + 0.06, z], YELLOW, 'SmoothPlastic', { collide: 0 });
  }
  light(-572, 10, 200, YELLOW);
  light(-572, 10, 140, 0xffd890);
  // 9 back at the RV park: sunset, and strings of camp lights
  screen([-516, 12, B.z0 + T + 0.4], [36, 12, 0.3], 'Back', [['WELCOME BACK, HAPPY CAMPERS', 0, 0.12, 1, 0.3, MUSTARD], ['BENTON RV PARK', 0, 0.5, 1, 0.26, WHITE], ['PLEASE SET YOUR HANDBRAKE', 0, 0.82, 1, 0.12, RUST, 'GothamBold']], 0x6a3a5a);
  for (let k = 0; k < 20; k++) neon([0.4, 0.4, 0.4], [-534 + k * 1.9, 20 + Math.sin(k * 0.9) * 0.4, B.z0 + T + 1], BULBS[k % 3], { shape: 3 });
  light(-516, 10, 70, 0xffb070);
  for (const [x, y, z, c] of [[-450, 16, 120, 0xffd890], [-498, 16, 160, 0xffd8a0], [-520, 16, 160, 0xffb070], [-552, 16, 172, 0xffa060], [-490, 16, 205, 0x9ad890],
    [-525, 16, 215, 0xffd890], [-455, 16, 225, 0x9ab8ff], [-485, 16, 250, 0x9ad8ff], [-540, 16, 250, 0xff8a30], [-540, 16, 62, 0xffb070]]) light(x, y, z, c);

  // ---- the vehicles: 1974 Benton Cruiser motorhomes, cut open so you can see out (built in the car's own frame)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const cabinParts = () => {
    const p = [];
    p.push(pp(0, [4.8, 0.4, 4.8], [0, -0.75, 0], 0x2a2c30, 'Metal'));
    p.push(pp(5, [5.6, 0.5, 5.6], [0, -0.3, 0], 0x1a1b1f, 'Metal'));
    p.push(pp(0, [7, 0.4, 8], [0, 0.2, 0], 0x6a6e74, 'Metal'));
    p.push(pp(0, [7, 0.6, 3.6], [0, 0.7, 2.2], 0x6a6e74, 'Metal'));
    for (const sd of [-1, 1]) {
      p.push(pp(0, [0.4, 5, 8], [sd * 3.5, 2.7, 0], LAB, 'SmoothPlastic'));
      for (const [y, c] of [[1.4, RUST], [1.9, MUSTARD], [2.4, BROWN]]) p.push(pp(0, [0.12, 0.45, 8], [sd * 3.72, y, 0], c, 'SmoothPlastic'));
      for (let k = 0; k < 5; k++) p.push(pp(0, [0.1, 0.8, 1.05], [sd * 3.73, 4.0, -2.6 + k * 1.3], 0x0a0c10, 'Glass'));
      for (const z of [-4.05, 4.05]) p.push(pp(0, [0.5, 5.4, 0.5], [sd * 3.55, 2.7, z], 0x2a2c30, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 5.3, 0], 0x2a2c30, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 0.15, 0], 0x2a2c30, 'SmoothPlastic'));
    }
    p.push(pp(0, [7.6, 0.5, 8.6], [0, 5.3, 0], LAB, 'SmoothPlastic'));
    p.push(pp(0, [2.4, 1, 2.4], [0, 6, 1.5], 0xd8d8d8, 'Metal')); // the roof air conditioner
    for (const k of [0, 1, 2, 3]) p.push(pp(0, [0.3, 0.12, 0.3], [-3.2, 5.7 + k * 0.5, 4.1], 0x8a8e94, 'Metal')); // the ladder
    p.push(pp(0, [7.6, 0.5, 0.5], [0, 5.3, -4.05], 0x2a2c30, 'SmoothPlastic'));
    p.push(pp(0, [7, 5, 0.4], [0, 2.7, 3.9], LAB, 'SmoothPlastic'));
    p.push(pp(1, [7, 1.6, 1.4], [0, 0.6, -4.6], LAB, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]));
    p.push(pp(0, [6.6, 0.8, 0.4], [0, 1.2, -3.85], 0x2a2c30, 'Metal'));
    for (const x of [-2.6, 2.6]) p.push(pp(2, [0.2, 0.9, 0.9], [x, 1.2, -4.1], 0xfff4c0, 'Neon', [0, 0, 1, 0, 1, 0, -1, 0, 0])); // headlights
    p.push(pp(2, [0.5, 2.2, 2.2], [0, 2.6, 4.35], 0x111111, 'Rubber', [0, 0, 1, 0, 1, 0, -1, 0, 0])); // the spare tire
    p.push(pp(0, [7.2, 0.12, 8.2], [0, -0.05, 0], 0xffb060, 'Neon'));
    for (const [z, y] of [[-1.5, 0.4], [1.8, 1.0]]) {
      for (const x of [-2.4, -0.8, 0.8, 2.4]) {
        p.push(pp(0, [1.4, 0.5, 1.5], [x, y + 0.25, z], 0x8a5a2a, 'Fabric'));
        p.push(pp(0, [1.4, 2.0, 0.4], [x, y + 1.4, z + 0.9], 0x8a5a2a, 'Fabric'));
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
  // animated scenery: a tumbleweed, rocks coming down the canyon, Bigfoot
  // stepping out, a storm-tossed road sign, bridge planks, the bear
  const props = [];
  const addProp = (name, parts, at, prop) => {
    const w = [X(at[0]), at[1], Z(at[2])];
    extras[name] = { pivot: [...w, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at: w, ...prop });
  };
  const furry = (color, s = 1) => [
    pp(0, [1.8 * s, 3.4 * s, 1.2 * s], [0, 0, 0], color, 'Fabric'), pp(0, [0.6 * s, 3.2 * s, 0.6 * s], [-0.6 * s, -3.2 * s, 0], color, 'Fabric'), pp(0, [0.6 * s, 3.2 * s, 0.6 * s], [0.6 * s, -3.2 * s, 0], color, 'Fabric'),
    pp(0, [0.5 * s, 3.2 * s, 0.5 * s], [-1.3 * s, 0, -0.3 * s], color, 'Fabric'), pp(0, [0.5 * s, 3.2 * s, 0.5 * s], [1.3 * s, 0, -0.3 * s], color, 'Fabric'),
    pp(3, [1.3 * s, 1.3 * s, 1.3 * s], [0, 2.4 * s, 0], color, 'Fabric'),
  ];
  addProp('Tumbleweed', [pp(3, [1.8, 1.8, 1.8], [0, 0, 0], 0x9a7a4a, 'Fabric'), pp(3, [1.4, 1.4, 1.4], [0.3, 0.2, 0.2], 0x8a6a3a, 'Fabric')], [-505, G + 1, 166], { kind: 'lunge', dir: [1, 0], reach: 16, period: 4 });
  for (let k = 0; k < 3; k++) addProp(`Rock${k + 1}`, [pp(3, [2, 1.6, 1.8], [0, 0, 0], ROCK, 'Slate')], [-555, G + 22, 168 + k * 10], { kind: 'fall', drop: 20, period: 2.4 + k * 0.7, phase: k * 0.37 });
  addProp('Bigfoot', furry(0x4a3020, 1.2), [-512, G + 4.4, 222], { kind: 'lunge', dir: [0, -1], reach: 5, period: 5 });
  addProp('RoadSign', [pp(0, [0.15, 4, 0.15], [0, -2, 0], 0x5a5e66, 'Metal'), pp(0, [0.2, 2.6, 2.6], [0, -5, 0], YELLOW, 'SmoothPlastic', [Math.cos(0.785), -Math.sin(0.785), 0, Math.sin(0.785), Math.cos(0.785), 0, 0, 0, 1])], [-452, G + 16, 232], { kind: 'swing', amp: 0.6, freq: 3 });
  for (let k = 0; k < 3; k++) addProp(`Plank${k + 1}`, [pp(0, [1, 0.3, 4], [0, 0, 0], BROWN, 'WoodPlanks')], [-499 + k * 3, G + 22, 263], { kind: 'fall', drop: 19, period: 2.4 + k * 0.6, phase: k * 0.33 });
  addProp('Bear', furry(0x2a1a10, 1.1), [-546, G + 4, 264], { kind: 'lunge', dir: [0, 1], reach: 4, period: 3.4 });
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
    id: RIDE_ID, name: 'RV Van Run', land: 'Velocity', category: 'Thrill', thrill: 3, kind: 'darkride', carStyle: 'coaster',
    description: "The Benton family's 1974 motorhome slips its handbrake at the RV park, and you're along for the ride: the desert highway past the giant dinosaur, a red-rock canyon with rocks coming down, Bigfoot's forest, a storm on the mountain pass, a wobbly bridge, a bear at the campsite and a runaway plunge down the switchbacks. Your RV turns, tilts and bounces on its motion base, fully indoors.",
    baseWait: 60, origin, entrance: [X(-392.5), 0, Z(dIn + 7)], exit: [X(-382), 0, Z(dOut)], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [LAB, RUST, MUSTARD], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'RV Van Run is open - all aboard the Cruiser!', 'Check the handbrake on your way in!'];
  return { ride, gate: { x: 1004, z: gz }, indoor: { x0: X(B.x1), x1: X(B.x0), z0: Z(B.z0), z1: Z(B.z1) } };
}


// a toast the first time you walk up to the new ride
export class RVVanRunSite {
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
      this.hooks.toast('RV VAN RUN is now open! A runaway road trip in a 1974 motorhome on a motion base - through the campground gate past Construction Runaway.', 'reward');
    }
  }
}
