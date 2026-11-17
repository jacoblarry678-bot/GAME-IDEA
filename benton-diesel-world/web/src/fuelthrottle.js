// Escape Fuel Throttle: a robot-arm dark ride. Benton Diesel's experimental
// THROTTLE engine, deep inside the Throttle Works refinery, has jammed wide
// open, and you're strapped into a test rig: a bench of four seats held out
// on the end of an industrial robot arm, riding a track through the plant.
// The arm lifts you, tilts you on your back and swings you right up to
// huge wrap-around screens as you escape: the Throttle core, the pump room,
// the pipeline, the tank farm, the flare stacks in a storm, a collapsing
// catwalk, the fireball, the exhaust tunnel and out into daylight.
//
// Everything is dressed: every wall carries panels, pipes, gauges and light
// strips, the ceiling is trusses and pipe runs, and the floor between the
// scenes is filled with drums, tanks, manifolds and control cabinets.
//
// It stands north of Stranger Things, reached through a gate in that land's
// north wall. Its show building uses Diesel Run's floor plan, laid out in
// Diesel Run's frame and turned a quarter turn into place here.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'FuelThrottle';
// Diesel Run's frame -> the world: a quarter turn
const MX = (x, z) => z + 486;
const MZ = (x) => -370 - x;
const TURN = Math.PI / 2;
const rotTurn = (r) => [r[6], r[7], r[8], r[3], r[4], r[5], -r[0], -r[1], -r[2]];
const G = 0.1;
const FLOOR = 0.5;
const CARS = 3, SPACING = 14, H = 4.5;
const PLAT = FLOOR + H - 1.95;
const BLD = { x0: -580, x1: -390, z0: 34, z1: 272, H: 32 };
const INNER = -438;
const ORANGE = 0xf07818, AMBER = 0xffb020, BLACK = 0x141414, STEEL = 0x5a5e66, DARK = 0x24262a, RUST = 0x7a4a2a, HAZARD = 0xf2c818, FUEL = 0x3adc6e, HOT = 0xff4a1a, WHITE = 0xf4f4f0, SKY = 0x5aa8ff;
const GATE = { x0: 554, x1: 578 };

const P = (x, z, v) => [MX(x, z), FLOOR, MZ(x), v * 1.6];
const CIRCUIT = [
  P(-450, 104, 1),
  P(-450, 118, 2), P(-450, 128, 0.7), P(-450, 136, 1.2), // 1 the Throttle core
  P(-454, 148, 4), P(-466, 152, 5), P(-490, 152, 2), P(-505, 152, 0.7), P(-515, 152, 1.5), // 2 the pump room
  P(-532, 152, 4), P(-543, 158, 3), P(-546, 172, 1), P(-546, 182, 0.7), P(-546, 192, 2), // 3 the pipeline
  P(-544, 204, 4), P(-534, 210, 4), P(-515, 210, 1.2), P(-505, 210, 0.8), P(-494, 210, 2), // 4 the tank farm
  P(-476, 210, 4), P(-467, 216, 3), P(-465, 228, 0.9), P(-465, 236, 1.1), // 5 the flare stacks
  P(-467, 248, 4), P(-478, 255, 4), P(-492, 255, 1.2), P(-500, 255, 2), P(-508, 255, 6), // 6 the catwalk
  P(-524, 255, 4), P(-540, 255, 3.5), P(-556, 255, 4), // 7 the fireball
  P(-568, 250, 5), P(-572, 236, 7), P(-572, 200, 8), P(-572, 150, 8), P(-572, 100, 7), // 8 the exhaust tunnel
  P(-569, 72, 5), P(-556, 62, 3), P(-528, 62, 1.2), P(-516, 62, 0.7), P(-504, 62, 1.5), // 9 daylight
  P(-480, 62, 4), P(-462, 64, 3), P(-452, 72, 2), P(-450, 84, 1.4), P(-450, 94, 1.1),
];
// each scene: where the rig stops, what it turns to face, and the
// wrap-around screen in front of it (radius from the stop, height)
const SCENES = [
  { stop: [-450, 128], face: [-438, 128], style: 'launch', back: 14, fwd: 12, R: 8.0, h: 16, art: 'core' },
  { stop: [-505, 152], face: [-505, 180], style: 'engine', back: 16, fwd: 12, R: 24, h: 18, art: 'pumps' },
  { stop: [-546, 182], face: [-560, 182], style: 'highway', back: 18, fwd: 12, R: 8.6, h: 16, art: 'pipeline' },
  { stop: [-505, 210], face: [-505, 232], style: 'canyon', back: 16, fwd: 12, R: 18.4, h: 18, art: 'tanks' },
  { stop: [-465, 232], face: [-438, 232], style: 'storm', back: 14, fwd: 12, R: 23, h: 20, art: 'storm' },
  { stop: [-496, 255], face: [-496, 272], style: 'bridge', back: 10, fwd: 14, R: 12.4, h: 18, art: 'catwalk' },
  { stop: [-540, 255], face: [-540, 230], style: 'fire', back: 18, fwd: 16, R: 19, h: 18, art: 'fire' },
  { stop: [-572, 160], face: null, style: 'warp', back: 60, fwd: 60 },
  { stop: [-516, 62], face: [-516, 34], style: 'finish', back: 16, fwd: 12, R: 23, h: 18, art: 'daylight' },
];

export function buildFuelThrottle(data) {
  const W = helpers(data); // world helpers
  const { cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];

  // Diesel Run-frame helpers: positions and turns mapped into the world
  const add = (size, pos, color, mat, o = {}) => W.add(size, [MX(pos[0], pos[2]), pos[1], MZ(pos[0])], color, mat, { ...o, yaw: (o.yaw || 0) + TURN, rot: o.rot ? rotTurn(o.rot) : null });
  const box = (size, base, color, mat, o) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const sign = (size, c, bg, face, labels, o = {}) => W.sign(size, [MX(c[0], c[2]), c[1], MZ(c[0])], bg, face, labels, { ...o, yaw: (o.yaw || 0) + TURN });
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const light = (x, y, z, color) => data.hauntLights.push([MX(x, z), y, MZ(x), color]);
  const tagAt = (list, x, y, z) => list.push([MX(x, z), y, MZ(x), 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const cfm = (x, y, z, yaw = 0) => cf(MX(x, z), y, MZ(x), yaw + TURN);
  const lampW = (x, z, color) => {
    W.box([0.5, 12, 0.5], [x, G, z], 0x2e3238, 'Metal');
    W.add([1.4, 1.4, 1.4], [x, G + 12.6, z], color, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 12.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };
  const B = BLD, T = 1.5, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const dIn = 139, dOut = 40; // the entrance and exit doors (world x 625 and 526)

  // ======== the site (world coordinates), north of Stranger Things
  const SITE = [{ x0: 500, x1: 808, z0: -40, z1: 236 }, { x0: 376, x1: 500, z0: -40, z1: 128 }];
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.flatZones = [...(data.flatZones || []), ...SITE.map((l) => ({ ...l, margin: 24 }))];
  data.trees = (data.trees || []).filter((t) => !SITE.some((l) => inRect(t.pos[0], t.pos[2], l, 6)));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, ...SITE.map((l) => [l.x0, l.z0, l.x1, l.z1])];
  for (const l of SITE) W.add([l.x1 - l.x0, 1, l.z1 - l.z0], [(l.x0 + l.x1) / 2, G - 0.5, (l.z0 + l.z1) / 2], 0x3a3c40, 'Asphalt');
  // a gate in Stranger Things' north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 40) < 0.6 && Math.abs(p[4] - 591.5) < 0.6 && p[3] > 400;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(375, -40, GATE.x0, -40);
  wallSeg(GATE.x1, -40, 808, -40);
  wallSeg(808, -16, 808, 236); // (open at the south end: the gate to Benton Boom Coaster)
  wallSeg(808, 236, 500, 236);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 1.4, GATE.x1 - 1.4]) {
    W.box([2.4, 18, 2.4], [x, G, -40], DARK, 'Metal');
    W.add([0.5, 16, 0.5], [x, G + 9, -41.4], ORANGE, 'Neon', { collide: 0 });
    W.add([1.6, 1.6, 1.6], [x, G + 19, -40], AMBER, 'Neon', { shape: 3, collide: 0 });
  }
  W.add([GATE.x1 - GATE.x0 + 2, 4.4, 2.4], [gx, G + 20.2, -40], DARK, 'Metal', { collide: 0 });
  for (const face of ['Front', 'Back']) {
    W.sign([GATE.x1 - GATE.x0 - 2, 3.6, 0.3], [gx, G + 20.2, -40 + (face === 'Front' ? -1.3 : 1.3)], BLACK, face, [['ESCAPE FUEL THROTTLE', 0, 0.02, 1, 0.6, ORANGE], ['THROTTLE WORKS  ·  REFINERY 7', 0, 0.62, 1, 0.36, WHITE, 'GothamBold']], { glow: true });
  }
  // the hazard-striped barrier arms, raised
  for (const [x, s] of [[GATE.x0 + 3, 1], [GATE.x1 - 3, -1]]) {
    W.box([0.8, 3.4, 0.8], [x, G, -42.5], HAZARD, 'Metal');
    for (let k = 0; k < 5; k++) W.add([0.4, 1.6, 0.4], [x, G + 4.2 + k * 1.6, -42.5], k % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0, rot: [Math.cos(s * 0.2), -Math.sin(s * 0.2), 0, Math.sin(s * 0.2), Math.cos(s * 0.2), 0, 0, 0, 1] });
  }
  // the walk from the Mirkwood path, and the plaza
  const route = [[gx, -93.8], [gx, -40], [gx, -12], [625, -12], [625, 17]];
  const exitRoute = [[526, 17], [526, -12], [gx, -12]];
  for (const r of [route, exitRoute]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      W.add([9, 0.4, len + 9], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x8a8478, 'Pavement', { yaw, collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }
  data.trees = data.trees.filter((t) => !(Math.abs(t.pos[0] - gx) < 9 && t.pos[2] > -100 && t.pos[2] < -38));
  // hazard stripes painted down the walk
  for (let z = -86; z < -14; z += 6) W.add([0.5, 0.05, 3], [gx - 4, 0.45, z], HAZARD, 'SmoothPlastic', { collide: 0 });
  for (let z = -86; z < -14; z += 6) W.add([0.5, 0.05, 3], [gx + 4, 0.45, z], HAZARD, 'SmoothPlastic', { collide: 0 });
  for (const [x, z] of [[gx - 7, -70], [gx + 7, -20], [600, -18], [660, -18], [700, -18], [500, -18], [460, 40], [420, 90]]) lampW(x, z, AMBER);
  // the refinery yard: fuel tanks, a flare stack, pipe racks, drums
  const tank = (x, z, r, h, color, label) => {
    W.add([r * 2, h, r * 2], [x, G + h / 2, z], color, 'Metal', { shape: 5 });
    W.add([r * 2 + 0.4, 0.6, r * 2 + 0.4], [x, G + h + 0.3, z], STEEL, 'Metal', { shape: 5, collide: 0 });
    W.add([r * 2 + 0.2, 1.2, r * 2 + 0.2], [x, G + h * 0.62, z], ORANGE, 'Metal', { shape: 5, collide: 0 });
    for (let k = 0; k < 8; k++) W.add([0.2, h, 0.2], [x + Math.cos(k * 0.6 - 1.2) * (r + 0.6), G + h / 2, z + Math.sin(k * 0.6 - 1.2) * (r + 0.6)], STEEL, 'Metal', { collide: 0 });
    if (label) W.sign([r * 1.6, 2.4, 0.2], [x, G + h * 0.4, z - r - 0.15], color, 'Front', [[label, 0, 0, 1, 1, BLACK, 'GothamBold']]);
  };
  tank(420, 0, 9, 18, 0xd8d4c8, 'DIESEL No. 2');
  tank(455, 40, 7, 14, 0xd8d4c8, 'THROTTLE FUEL');
  tank(420, 70, 8, 16, 0xc8c0b0, 'TANK 7');
  tank(770, -10, 8, 15, 0xd8d4c8, 'RESERVE');
  tank(780, 60, 6, 12, 0xc8c0b0, 'TANK 9');
  // the flare stack, burning
  W.add([3, 46, 3], [740, G + 23, 225], STEEL, 'Metal', { shape: 5 });
  for (let k = 0; k < 4; k++) W.add([0.3, 46, 0.3], [740 + Math.cos(k * 1.57) * 3, G + 23, 225 + Math.sin(k * 1.57) * 3], DARK, 'Metal', { collide: 0 });
  W.add([3.6, 1, 3.6], [740, G + 46.5, 225], DARK, 'Metal', { shape: 5, collide: 0 });
  data.tags.Campfire.push([740, G + 47, 225, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  W.add([1.6, 3, 1.6], [740, G + 48.5, 225], HOT, 'Neon', { shape: 3, collide: 0 });
  // a pipe rack along the plaza
  for (let x = 650; x < 760; x += 12) { W.box([0.6, 9, 0.6], [x, G, 8], STEEL, 'Metal'); W.add([0.6, 0.6, 5], [x, G + 9, 8], STEEL, 'Metal', { collide: 0 }); }
  for (const [y, z, c, d] of [[9.6, 6.6, ORANGE, 1.2], [9.6, 8.4, 0x8a9096, 1], [9.6, 9.8, FUEL, 0.9]]) W.add([110, d, d], [705, G + y, z], c, 'Metal', { shape: 2, collide: 0 });
  // fuel drums by the doors
  for (let k = 0; k < 10; k++) {
    const x = 640 + (k % 5) * 2.4, z = 4 + Math.floor(k / 5) * 2.4;
    W.add([2, 3, 2], [x, G + 1.5, z], [ORANGE, 0x2a5aa0, 0xc81e1e, ORANGE, BLACK][k % 5], 'Metal', { shape: 5 });
  }
  W.add([2, 3, 2], [646, G + 4.5, 5.2], ORANGE, 'Metal', { shape: 5, collide: 0 });
  // a giant throttle lever on the plaza, jammed WIDE OPEN
  W.box([6, 3, 6], [600, G, 4], DARK, 'Metal');
  W.add([1, 14, 1], [600, G + 9, 6.5], STEEL, 'Metal', { rot: [1, 0, 0, 0, Math.cos(0.5), -Math.sin(0.5), 0, Math.sin(0.5), Math.cos(0.5)] });
  W.add([3, 3, 3], [600, G + 15.2, 9.9], HOT, 'Neon', { shape: 3, collide: 0 });
  W.sign([5.6, 1.6, 0.2], [600, G + 2.2, 0.9], BLACK, 'Front', [['THROTTLE  ·  WIDE OPEN', 0, 0, 1, 1, ORANGE, 'GothamBold']], { glow: true });
  W.add([5, 0.4, 0.4], [600, G + 3.2, 4], 0xff2020, 'Neon', { collide: 0 });
  // wait times
  W.box([0.6, 6, 0.6], [gx - 9, G, -50], 0x2e3238, 'Metal');
  const waitPart = W.add([9.6, 6, 0.8], [gx - 9, G + 9, -50], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 47, cf: cf(gx + 6, G, -46, Math.PI) });
  W.box([0.6, 9, 0.6], [540, G, -102], 0x2a2c30, 'Metal');
  for (const face of ['Front', 'Back']) W.sign([12, 3.4, 0.3], [540, G + 9.4, -102 + (face === 'Front' ? -0.4 : 0.4)], BLACK, face, [['ESCAPE FUEL THROTTLE', 0, 0, 1, 0.62, ORANGE], ['NEW  ·  THROUGH THE GATE', 0, 0.62, 1, 0.38, WHITE, 'GothamBold']], { glow: true });

  // ======== the show building, in Diesel Run's frame
  box([B.x1 - B.x0, FLOOR - G, B.z1 - B.z0], [cx, G, cz], 0x1a1816, 'Concrete');
  const SKIN = 0x6a6660;
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], SKIN, 'Metal');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], SKIN, 'Metal');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z1 - T / 2], SKIN, 'Metal');
  for (const [za, zb] of [[B.z0, dOut - 3.5], [dOut + 3.5, dIn - 5], [dIn + 5, B.z1]]) box([T, B.H, zb - za], [B.x1 - T / 2, G, (za + zb) / 2], SKIN, 'Metal');
  box([T, B.H - 10, 10], [B.x1 - T / 2, G + 10, dIn], SKIN, 'Metal');
  box([T, B.H - 8, 7], [B.x1 - T / 2, G + 8, dOut], SKIN, 'Metal');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0x3a3836, 'Metal', { collide: 0 });
  // the refinery look outside: corrugated ribs, a black base, orange bands,
  // pipe runs and stacks along the top
  const outside = [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz, 'z'], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2, 'x'], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2, 'x']];
  for (const [za, zb] of [[B.z0, dIn - 26], [dIn + 26, B.z1]]) outside.push([0.3, zb - za, B.x1 + 0.2, (za + zb) / 2, 'z']);
  for (const [w, d, x, z, ax] of outside) {
    add([w, 4, d], [x, G + 2, z], BLACK, 'Metal', { collide: 0 });
    neon([w, 0.7, d], [x, G + 27, z], ORANGE);
    add([w, 1.6, d], [x, G + 22, z], ORANGE, 'Metal', { collide: 0 });
    const len = ax === 'z' ? d : w;
    for (let k = -len / 2 + 2; k < len / 2 - 1; k += 3) add(ax === 'z' ? [0.5, 17, 0.4] : [0.4, 17, 0.5], ax === 'z' ? [x, G + 12.5, z + k] : [x + k, G + 12.5, z], 0x5a5650, 'Metal', { collide: 0 });
  }
  for (let z = B.z0 + 10; z < B.z1; z += 34) {
    box([3, 10, 3], [B.x0 + 20 + ((z * 7) % 120), G + B.H, z], STEEL, 'Metal', { shape: 5, collide: 0 });
    tagAt(data.tags.SteamVent, B.x0 + 20 + ((z * 7) % 120), G + B.H + 10, z);
  }
  // the front: a huge ESCAPE FUEL THROTTLE sign over the doors, a canopy
  // of pipes, warning beacons and a big THROTTLE gauge
  sign([0.4, 11, 60], [B.x1 + 0.5, G + 19, dIn], BLACK, 'Right', [['ESCAPE', 0, 0.02, 1, 0.24, WHITE], ['FUEL THROTTLE', 0, 0.26, 1, 0.5, ORANGE], ['THROTTLE WORKS  ·  REFINERY 7  ·  AUTHORIZED TEST RIDERS ONLY', 0, 0.8, 1, 0.16, AMBER, 'GothamBold']], { glow: true });
  neon([0.3, 0.4, 60], [B.x1 + 0.7, G + 13.3, dIn], ORANGE);
  neon([0.3, 0.4, 60], [B.x1 + 0.7, G + 24.7, dIn], ORANGE);
  for (const dz of [-33, 33]) {
    add([3.2, 3.2, 3.2], [B.x1 + 1.8, G + 19, dIn + dz], DARK, 'Metal', { shape: 2, collide: 0 });
    add([0.4, 9, 9], [B.x1 + 3.6, G + 19, dIn + dz], 0x101010, 'Metal', { shape: 2, collide: 0 });
    add([0.3, 7.6, 7.6], [B.x1 + 3.9, G + 19, dIn + dz], 0xf4ecd8, 'SmoothPlastic', { shape: 2, collide: 0 });
    add([0.2, 3.4, 0.4], [B.x1 + 4.1, G + 20.3, dIn + dz + 0.8], 0xe02020, 'Neon', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.7), -Math.sin(-0.7), 0, Math.sin(-0.7), Math.cos(-0.7)] });
    add([0.25, 1.4, 3], [B.x1 + 4.05, G + 21.6, dIn + dz + 2.4], 0xe02020, 'Neon', { collide: 0 });
  }
  add([8, 0.6, 20], [B.x1 + 4, G + 10.3, dIn], DARK, 'Metal', { collide: 0 });
  for (const dz of [-9.4, 9.4]) box([0.6, 10, 0.6], [B.x1 + 7.6, G, dIn + dz], STEEL, 'Metal');
  for (const [y, c] of [[11, ORANGE], [11.8, 0x8a9096]]) add([20, 0.7, 0.7], [B.x1 + 7.6, G + y, dIn], c, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  sign([0.2, 1.4, 14], [B.x1 + 8, G + 9.6, dIn], BLACK, 'Right', [['TEST RIG LOADING  ·  THIS WAY', 0, 0, 1, 1, AMBER, 'GothamBold']], { glow: true });
  for (const dz of [-11, 11]) { neon([1.2, 1.2, 1.2], [B.x1 + 0.9, G + 11.5, dIn + dz], 0xff6a10, { shape: 3 }); light(B.x1 + 3, 10, dIn + dz, ORANGE); }
  sign([0.2, 1.4, 6], [B.x1 + 6.8, G + 10.3, dOut], BLACK, 'Right', [['EXIT', 0, 0, 1, 1, FUEL, 'GothamBold']], { glow: true });
  add([6, 0.5, 9], [B.x1 + 3, G + 8.4, dOut], DARK, 'Metal', { collide: 0 });
  // pipes running along the whole front
  for (const [y, c, d] of [[5, ORANGE, 1.2], [6.6, 0x8a9096, 1], [29.5, FUEL, 1.4]]) {
    for (const [za, zb] of [[B.z0 + 2, dOut - 6], [dOut + 6, dIn - 12], [dIn + 12, B.z1 - 2]]) add([zb - za, d, d], [B.x1 + 1.2, G + y, (za + zb) / 2], c, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  }

  // ---- inside: the wall between the queue hall and the show
  const doorQ = 52;
  box([T, B.H, B.z1 - (doorQ + 4) - T], [INNER, G, (doorQ + 4 + B.z1 - T) / 2], SKIN, 'Metal');
  box([T, B.H, doorQ - 4 - (B.z0 + T)], [INNER, G, (B.z0 + T + doorQ - 4) / 2], SKIN, 'Metal');
  box([T, B.H - 10, 8], [INNER, G + 10, doorQ], SKIN, 'Metal');
  const EXZ = 45;
  box([B.x1 - INNER - T, 12, 0.6], [(INNER + B.x1) / 2, G, EXZ], DARK, 'Metal');
  for (let x = INNER + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, G + 11, 40], FUEL);

  // ---- dressing: every wall gets panels, ribs, pipes, gauges, a light strip
  // and a hazard band, so no wall is ever bare
  const dress = (xa, za, xb, zb, side, h = 22, opts = {}) => {
    const len = Math.hypot(xb - xa, zb - za);
    if (len < 2) return;
    const ux = (xb - xa) / len, uz = (zb - za) / len;
    const nx = -uz * side, nz = ux * side; // into the room
    const yaw = Math.atan2(ux, uz);
    const at = (s, off) => [xa + ux * s + nx * off, za + uz * s + nz * off];
    const mid = at(len / 2, 0.85);
    if (!opts.bare) {
      add([0.2, h, len], [mid[0], G + h / 2, mid[1]], opts.panel ?? 0x3a3632, 'Metal', { collide: 0, yaw });
      for (let s = 2; s < len - 1; s += 4) { const [x, z] = at(s, 1.0); add([0.3, h, 0.4], [x, G + h / 2, z], 0x4a4640, 'Metal', { collide: 0, yaw }); }
      for (let s = 0; s < len - 0.5; s += 4) { const [x, z] = at(s + 1, 1.05); add([0.2, 1.3, 2], [x, G + 0.65, z], (s / 4) % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0, yaw }); }
    }
    const pipes = opts.pipes ?? [[4.5, ORANGE, 1.1], [7.6, 0x8a9096, 0.9], [h - 3, FUEL, 1.2]];
    for (const [y, c, d] of pipes) { const [x, z] = at(len / 2, opts.pipeOff ?? 1.9); add([len, d, d], [x, G + y, z], c, 'Metal', { shape: 2, collide: 0, yaw: yaw + Math.PI / 2 }); }
    for (let s = 3; s < len - 1 && !opts.bare; s += 9) {
      const [x, z] = at(s, (opts.pipeOff ?? 1.9) - 0.3);
      add([0.4, h - 1, 0.4], [x, G + (h - 1) / 2, z], 0x2a2a2a, 'Metal', { collide: 0, yaw });
    }
    if (opts.strip !== false && !opts.bare) { const [x, z] = at(len / 2, 1.2); neon([0.2, 0.3, len], [x, G + 12, z], opts.strip ?? AMBER, { yaw }); }
    if (opts.gauges !== false) {
      for (let s = 6; s < len - 3; s += 13) {
        const [x, z] = at(s, 1.25), [x2, z2] = at(s, 1.35);
        add([0.25, 2.2, 2.2], [x, G + 10, z], 0xf4ecd8, 'SmoothPlastic', { shape: 2, collide: 0, yaw });
        const a = 0.6 + ((s * 37) % 10) / 10;
        add([0.12, 0.95, 0.12], [x2 + ux * Math.sin(a) * 0.4, G + 10 + Math.cos(a) * 0.4, z2 + uz * Math.sin(a) * 0.4], 0xe02020, 'Neon', { collide: 0, rot: yawRot(yaw, a) });
        const [vx, vz] = at(s + 4.5, 1.7);
        add([0.5, 1.6, 1.6], [vx, G + 6.05, vz], 0xc81e1e, 'Metal', { shape: 2, collide: 0, yaw });
      }
    }
  };
  // a yaw, then a tilt in the wall's plane (for gauge needles)
  function yawRot(yaw, a) {
    const c = Math.cos(yaw), s = Math.sin(yaw), ca = Math.cos(a), sa = Math.sin(a);
    // Ry(yaw) * Rz... about the wall's normal: the normal is local x after the yaw
    const Ry = [c, 0, s, 0, 1, 0, -s, 0, c], Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca];
    const m = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) m[i * 3 + j] += Ry[i * 3 + k] * Rx[k * 3 + j];
    return m;
  }
  // the show's outer walls, inside
  // (the exhaust tunnel runs close by this wall: there it's screens, flush)
  const tunnelWall = { pipes: [[24, ORANGE, 1.1], [19, FUEL, 1.2]], pipeOff: 1.3, gauges: false };
  dress(B.x0 + T, B.z0 + T, B.x0 + T, 98, -1, 22, tunnelWall);
  dress(B.x0 + T, 98, B.x0 + T, 246, -1, 22, { ...tunnelWall, bare: true });
  dress(B.x0 + T, 246, B.x0 + T, B.z1 - T, -1, 22, tunnelWall);
  dress(B.x0 + T, B.z0 + T, INNER - T / 2, B.z0 + T, 1);
  dress(B.x0 + T, B.z1 - T, INNER - T / 2, B.z1 - T, -1);
  dress(INNER - T / 2, B.z0 + T, INNER - T / 2, doorQ - 4, 1);
  dress(INNER - T / 2, doorQ + 4, INNER - T / 2, B.z1 - T, 1);
  // the queue hall's walls
  dress(B.x1 - T, EXZ + 1, B.x1 - T, dIn - 5, 1, 22, { strip: ORANGE });
  dress(B.x1 - T, dIn + 5, B.x1 - T, B.z1 - T, 1, 22, { strip: ORANGE });
  dress(INNER + T / 2, doorQ + 4, INNER + T / 2, B.z1 - T, -1, 22, { strip: ORANGE });
  dress(INNER + T / 2, B.z1 - T, B.x1 - T, B.z1 - T, -1, 22, { strip: ORANGE, gauges: false });
  // the exit corridor
  dress(INNER + T / 2, B.z0 + T, INNER + T / 2, EXZ - 1, -1, 11, { pipes: [[4, ORANGE, 0.8], [8, FUEL, 0.8]], gauges: false });
  dress(INNER + T / 2, B.z0 + T, B.x1 - T, B.z0 + T, 1, 11, { pipes: [[4, ORANGE, 0.8], [8, FUEL, 0.8]], gauges: false, strip: FUEL });
  // the ceiling: trusses, catwalks and pipe runs everywhere
  for (let z = B.z0 + 8; z < B.z1 - 4; z += 12) {
    add([B.x1 - B.x0 - 4, 1, 1], [cx, G + 28, z], DARK, 'Metal', { collide: 0 });
    add([B.x1 - B.x0 - 4, 0.4, 0.4], [cx, G + 26.4, z], DARK, 'Metal', { collide: 0 });
    for (let x = B.x0 + 6; x < B.x1 - 4; x += 8) add([0.3, 2, 0.3], [x, G + 27.2, z], DARK, 'Metal', { collide: 0, rot: [Math.cos(0.6), -Math.sin(0.6), 0, Math.sin(0.6), Math.cos(0.6), 0, 0, 0, 1] });
  }
  for (const [x, c, d] of [[-560, ORANGE, 1.6], [-520, 0x8a9096, 1.2], [-485, FUEL, 1.4], [-455, ORANGE, 1], [-414, 0x8a9096, 1.4], [-400, FUEL, 1]]) add([B.z1 - B.z0 - 4, d, d], [x, G + 25.4, cz], c, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
  for (let x = B.x0 + 10; x < B.x1; x += 22) for (let z = B.z0 + 14; z < B.z1; z += 24) {
    add([0.15, 3, 0.15], [x, G + 26, z], 0x1a1a1a, 'Metal', { collide: 0 });
    neon([1.6, 0.4, 1.6], [x, G + 24.4, z], 0xffd8a0, { shape: 5 });
  }

  // ---- the queue: the Throttle Works test hall, seven long rows
  const ROWS = [-401, -406, -411, -416, -421, -426, -431];
  const south = 50, north = 248;
  add([B.x1 - INNER - 3, 0.2, north + 8 - EXZ], [(INNER + B.x1) / 2, FLOOR + 0.1, (EXZ + north + 8) / 2], 0x4a4844, 'Concrete', { collide: 0 });
  for (let z = EXZ + 4; z < north + 6; z += 8) add([B.x1 - INNER - 4, 0.05, 0.3], [(INNER + B.x1) / 2, FLOOR + 0.22, z], 0x2a2826, 'SmoothPlastic', { collide: 0 });
  const fwdDR = [[B.x1 - 4, dIn], [-395, dIn], [-395, north + 4], [ROWS[0], north + 4]];
  ROWS.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwdDR.push([x, goSouth ? north : south]);
    fwdDR.push([x, goSouth ? south : north]);
  });
  fwdDR.push([INNER + 4, doorQ], [INNER - 2, doorQ]);
  const fwd = [[600, -12], [625, -12], [MX(B.x1 + 3, dIn), MZ(B.x1 + 3)], ...fwdDR.map(([x, z]) => [MX(x, z), MZ(x)])];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 5, [-1, 0], FLOOR + 0.2);
  // pipe railings: orange pipe on hazard-striped posts
  const railZ = (x, za, zb) => {
    add([zb - za, 0.3, 0.3], [x, FLOOR + 3.2, (za + zb) / 2], ORANGE, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
    add([zb - za, 0.2, 0.2], [x, FLOOR + 1.9, (za + zb) / 2], STEEL, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.34, 3.1, 0.34], [x, FLOOR, za + ((zb - za) * k) / n], k % 2 ? HAZARD : DARK, 'Metal');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    if (k % 2 === 0) railZ(x, north + 2, south + 3.6); else railZ(x, north - 3.6, south - 2);
  }
  railZ(-398.5, south - 2, north + 1.5);
  railZ(ROWS[6] - 2.5, south + 4, north + 6);
  // work lights over the rows, beacons on the rails
  for (const x of ROWS) for (let z = south + 8; z < north; z += 14) neon([0.5, 0.15, 6], [x, 15, z], 0xfff0d0);
  for (let z = 60; z < 250; z += 30) { light(-412, 14, z, 0xffe0b0); light(-396, 10, z + 15, ORANGE); }
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    for (const z of [south + 30, north - 30]) neon([0.5, 0.5, 0.5], [x, FLOOR + 3.7, z], k % 2 ? 0xff6a10 : AMBER, { shape: 3 });
  }
  // screens all down the hall: the safety briefing, gauges and the news
  const brief = [['THE THROTTLE', 'EXPERIMENTAL FUEL ENGINE  ·  OUTPUT: 900%'], ['STATUS: JAMMED OPEN', 'ALL TEST RIDERS TO THE RIGS'], ['YOUR TEST RIG', 'HOLD ON  ·  KEEP FEET FREE  ·  IT MOVES'], ['BENTON NEWS 7', 'REFINERY 7: "EVERYTHING IS FINE"']];
  brief.forEach(([title, sub], k) => {
    const z = 75 + k * 48;
    add([0.4, 8.4, 16.4], [INNER + 3.1, 12, z], 0x0a0a0c, 'Metal', { collide: 0 });
    sign([0.2, 8, 16], [INNER + 3.35, 12, z], 0x1a0c04, 'Right', [[title, 0, 0.16, 1, 0.36, ORANGE], [sub, 0, 0.6, 1, 0.2, WHITE, 'GothamBold']], { glow: true });
  });
  [['THROTTLE WORKS  ·  REFINERY 7', AMBER], ['DANGER: FLAMMABLE', HOT], ['NO OPEN FLAMES', HAZARD], ['DAYS WITHOUT AN INCIDENT: 0', ORANGE], ['TEST RIDERS: THIS WAY', FUEL]].forEach(([text, c], k) => {
    sign([0.3, 3, 12], [B.x1 - T - 2.2, 15, 62 + k * 40 + (k > 1 ? 12 : 0)], 0x101010, 'Left', [[text, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
  });
  // the north end of the hall: the THROTTLE engine itself, glowing, under a
  // big screen, its intake fan spinning
  box([30, 2, 10], [-414, FLOOR, 262], DARK, 'Metal');
  add([22, 9, 9], [-414, FLOOR + 8, 262], 0x4a4a4e, 'Metal', { shape: 2, yaw: Math.PI / 2, collide: 0 });
  for (let k = 0; k < 6; k++) add([0.6, 10, 10], [-414, FLOOR + 8, 252 + k * 4], k % 2 ? ORANGE : DARK, 'Metal', { shape: 2, yaw: Math.PI / 2, collide: 0 });
  add([0.4, 7, 7], [-414, FLOOR + 8, 250.6], HOT, 'Neon', { shape: 2, yaw: Math.PI / 2, collide: 0 });
  for (const dx of [-12, 12]) { box([3, 14, 3], [-414 + dx, FLOOR, 264], STEEL, 'Metal', { shape: 5 }); neon([3.2, 1, 3.2], [-414 + dx, FLOOR + 10, 264], ORANGE, { shape: 5 }); }
  sign([34, 8, 0.4], [-414, 23, B.z1 - T - 3.2], 0x1a0c04, 'Front', [['THE THROTTLE', 0, 0.06, 1, 0.42, ORANGE], ['DO NOT TOUCH  ·  DO NOT LOOK DIRECTLY INTO  ·  DO NOT PANIC', 0, 0.6, 1, 0.28, WHITE, 'GothamBold']], { glow: true });
  light(-414, 10, 254, HOT);
  light(-414, 18, 262, ORANGE);
  box([0.4, 7, 0.4], [-392.5, FLOOR, dIn + 7], 0x101114, 'Metal');
  sign([0.2, 2, 9], [-392.3, FLOOR + 6.4, dIn + 7], BLACK, 'Left', [['ENTRANCE', 0, 0, 1, 1, ORANGE]], { glow: true });
  // the exit corridor: lockers and a SHIFT OVER board
  for (let x = INNER + 4; x < B.x1 - 6; x += 3) box([2.6, 7, 1.6], [x, FLOOR, B.z0 + T + 1], [0x3a5a7a, 0x4a6a8a][Math.round(x) % 2], 'Metal', { collide: 0 });
  sign([16, 3, 0.3], [(INNER + B.x1) / 2, 9, B.z0 + T + 2.2], BLACK, 'Back', [['SHIFT OVER  ·  YOU MADE IT OUT', 0, 0, 1, 1, FUEL, 'GothamBold']], { glow: true });

  // ---- the track: a steel guide rail in the floor
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), Pv = new THREE.Vector3();
  for (let s = 0; s < track.length; s += 2) {
    sampler.matrixAt(s, m4);
    Pv.setFromMatrixPosition(m4);
    const e = m4.elements;
    W.add([2.4, 0.05, 2.2], [Pv.x, FLOOR + 0.03, Pv.z], 0x1a1a1c, 'Metal', { collide: 0, yaw: Math.atan2(-e[8], -e[10]) });
    if (s % 6 === 0) W.add([0.3, 0.06, 2.2], [Pv.x, FLOOR + 0.05, Pv.z], HAZARD, 'SmoothPlastic', { collide: 0, yaw: Math.atan2(-e[8], -e[10]) });
  }
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const scenes = SCENES.map((sc) => { const s = sAt(MX(...sc.stop), MZ(sc.stop[0])); return { s0: s - sc.back, s1: s + sc.fwd, target: sc.face ? [MX(...sc.face), MZ(sc.face[0])] : null, style: sc.style }; });
  // the track in Diesel Run's frame (for keeping scenery clear of the rigs)
  const trackDR = [];
  for (let s = 0; s < track.length; s += 1.5) { sampler.matrixAt(s, m4); Pv.setFromMatrixPosition(m4); trackDR.push([-370 - Pv.z, Pv.x - 486]); }
  const nearTrack = (x, z, r) => trackDR.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < r * r);

  // ---- the station: the test rig loading bay
  const px0 = -445.4, px1 = INNER - T / 2;
  box([px1 - px0, PLAT - FLOOR, 46], [(px0 + px1) / 2, FLOOR, 88], 0x4a4844, 'Concrete');
  for (let z = 66; z < 111; z += 2) add([0.4, 0.06, 1], [px0 + 0.4, PLAT + 0.03, z], (z / 2) % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0 });
  const con = [px1 - 1.6, 108];
  box([1.4, 3, 2.4], [con[0], PLAT, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  sign([16, 3, 0.4], [-450, 15, 112], BLACK, 'Back', [['TEST RIG LOADING', 0, 0, 1, 0.6, ORANGE], ['BAY 2  ·  ARMS ARE LIVE', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  sign([0.3, 5, 14], [INNER - T / 2 - 0.3, PLAT + 6, 88], 0x1a0c04, 'Left', [['RIG CHECK', 0, 0.08, 1, 0.36, ORANGE], ['ARM 1 OK  ·  ARM 2 OK  ·  ARM 3 OK', 0, 0.56, 1, 0.26, FUEL, 'GothamBold']], { glow: true });
  light(-446, 13, 90, 0xffe8c0);
  light(-446, 13, 72, ORANGE);

  // ---- the scenes' sets
  const occupied = []; // [x, z, r] the filler keeps clear of
  const wall = (xa, za, xb, zb, h = 24) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([1, h, len], [(xa + xb) / 2, G + h / 2, (za + zb) / 2], 0x2a2826, 'Metal', { yaw });
    dress(xa, za, xb, zb, 1, h - 2);
    dress(xa, za, xb, zb, -1, h - 2);
  };
  wall(-462, 118, -565, 118);
  wall(-468, 182, -538, 182);
  wall(-474, 232, -560, 232);
  wall(-558, 126, -558, 238);

  // the wrap-around screens: five glowing panels in an arc around the stop,
  // each one carrying a picture built from silhouettes and light
  const dome = (sc) => {
    const [sx, sz] = sc.stop, [fx, fz] = sc.face;
    const base = Math.atan2(fx - sx, fz - sz), R = sc.R, h = sc.h, step = 0.4;
    const pw = 2 * R * Math.tan(step / 2) + 0.15;
    const ok = (k) => {
      const a = base + k * step, x = sx + Math.sin(a) * R, z = sz + Math.cos(a) * R, ex = Math.cos(a) * (pw / 2 + 0.5), ez = -Math.sin(a) * (pw / 2 + 0.5);
      return ![[x, z], [x + ex, z + ez], [x - ex, z - ez]].some(([px, pz]) => nearTrack(px, pz, 7.4));
    };
    for (let k = -2; k <= 2; k++) {
      if (!ok(k)) continue;
      const a = base + k * step;
      const dx = Math.sin(a), dz = Math.cos(a);
      const x = sx + dx * R, z = sz + dz * R, y = G + 1 + h / 2;
      const yaw = Math.atan2(-dx, -dz) + Math.PI; // the panel's -z (Front) faces the rider
      occupied.push([x, z, pw / 2 + 2]);
      add([pw + 0.3, h + 0.6, 0.6], [x + dx * 0.4, y, z + dz * 0.4], 0x050505, 'Metal', { collide: 0, yaw });
      const panel = (labels, bg) => sign([pw, h, 0.2], [x, y, z], bg, 'Front', labels, { glow: true, yaw });
      // the panel's own frame: right (as the rider sees it), up, toward the rider
      const rx = -Math.cos(yaw), rz = Math.sin(yaw), tx = -dx, tz = -dz;
      const art = (u, v, size, color, o = {}) => add(size, [x + rx * u + tx * (0.2 + (o.lift || 0)), y + v, z + rz * u + tz * (0.2 + (o.lift || 0))], color, o.mat || 'Neon', { collide: 0, yaw: yaw + (o.shape === 2 ? Math.PI / 2 : 0), shape: o.shape || 0 });
      ART[sc.art](k, panel, art, pw, h);
    }
    // a black surround above and below, so the screen fills the view
    for (const [y, hh] of [[G + 0.5, 1], [G + h + 1.5, 6]]) {
      for (let k = -2; k <= 2; k++) {
        if (!ok(k)) continue;
        const a = base + k * 0.4, dx = Math.sin(a), dz = Math.cos(a);
        add([2 * R * Math.tan(0.2) + 0.4, hh, 0.6], [sx + dx * (R + 0.4), y + hh / 2, sz + dz * (R + 0.4)], 0x0a0a0a, 'Metal', { collide: 0, yaw: Math.atan2(-dx, -dz) + Math.PI });
      }
    }
    // the sector between the rider and the screen stays clear
    for (let r = 4; r < R; r += 3) for (let k = -2; k <= 2; k++) { const a = base + k * 0.36; occupied.push([sx + Math.sin(a) * r, sz + Math.cos(a) * r, 3]); }
  };
  const ART = {
    // 1 the Throttle core, overloading
    core(k, panel, art, w, h) {
      if (k === 0) {
        panel([['THROTTLE CORE', 0, 0.03, 1, 0.12, WHITE, 'GothamBold'], ['900%', 0, 0.76, 1, 0.2, HOT]], 0x2a0800);
        art(0, h * 0.05, [0.2, h * 0.5, h * 0.5], 0xff6a10, { shape: 2 });
        art(0, h * 0.05, [0.2, h * 0.34, h * 0.34], AMBER, { shape: 2, lift: 0.05 });
        art(0, h * 0.05, [0.2, h * 0.16, h * 0.16], WHITE, { shape: 2, lift: 0.1 });
        return;
      }
      panel([[k < 0 ? 'PRESSURE' : 'HEAT', 0, 0.04, 1, 0.1, AMBER, 'GothamBold'], ['CRITICAL', 0, 0.86, 1, 0.1, HOT, 'GothamBold']], 0x140804);
      for (let j = 0; j < 8; j++) art(0, -h * 0.34 + j * h * 0.085, [w * 0.6, h * 0.06, 0.1], j < 6 - Math.abs(k) ? FUEL : j < 7 ? AMBER : HOT);
    },
    // 2 the pump room: pistons pounding against a wall of pumps
    pumps(k, panel, art, w, h) {
      panel(k === 0 ? [['PUMP ROOM B', 0, 0.03, 1, 0.12, AMBER, 'GothamBold'], ['FLOW: MAXIMUM', 0, 0.86, 1, 0.1, HOT, 'GothamBold']] : [], 0x1a1008);
      for (let j = -1; j <= 1; j++) {
        const u = j * w * 0.28, top = ((k * 3 + j) % 3) * h * 0.08;
        art(u, -h * 0.1 + top, [w * 0.16, h * 0.5, 0.1], 0x2a2a2a, { mat: 'Metal' });
        art(u, h * 0.2 + top, [w * 0.24, h * 0.08, 0.1], ORANGE, { lift: 0.05 });
      }
      art(0, -h * 0.42, [w, h * 0.06, 0.1], HAZARD);
    },
    // 3 the pipeline: racing down a pipe tunnel
    pipeline(k, panel, art, w, h) {
      panel(k === 0 ? [['PIPELINE 7', 0, 0.03, 1, 0.1, WHITE, 'GothamBold']] : [], 0x081008);
      for (let j = 0; j < 4; j++) {
        const s = 1 - j * 0.22, cu = -k * w * 0.35 * j * 0.2;
        art(cu, -h * 0.4 * s, [w * s, 0.25, 0.1], j % 2 ? FUEL : AMBER, { lift: j * 0.02 });
        art(cu, h * 0.4 * s, [w * s, 0.25, 0.1], j % 2 ? FUEL : AMBER, { lift: j * 0.02 });
      }
      art(0, 0, [w * 0.5, h * 0.06, 0.1], 0xfff4c0);
    },
    // 4 the tank farm: a leaking tank, fuel spraying
    tanks(k, panel, art, w, h) {
      panel(k === 0 ? [['TANK FARM', 0, 0.03, 1, 0.1, WHITE, 'GothamBold'], ['LEAK DETECTED', 0, 0.86, 1, 0.1, FUEL, 'GothamBold']] : [], 0x2a1a10);
      art(0, -h * 0.12, [w * 0.6, h * 0.6, 0.1], 0x101010, { mat: 'Metal' });
      art(0, h * 0.2, [w * 0.86, h * 0.04, 0.1], STEEL, { mat: 'Metal', lift: 0.05 });
      if (k % 2 === 0) for (let j = 0; j < 4; j++) art(-w * 0.1 + j * w * 0.08, -h * 0.05 - j * h * 0.08, [0.4, 0.4, 0.1], FUEL, { lift: 0.08 });
    },
    // 5 the flare stacks in a storm, lightning
    storm(k, panel, art, w, h) {
      panel(k === 0 ? [['FLARE STACKS', 0, 0.03, 1, 0.1, WHITE, 'GothamBold'], ['STORM WARNING', 0, 0.86, 1, 0.1, SKY, 'GothamBold']] : [], 0x10081a);
      art(k * w * 0.1, -h * 0.15, [w * 0.12, h * 0.6, 0.1], 0x050505, { mat: 'Metal' });
      art(k * w * 0.1, h * 0.2, [w * 0.16, h * 0.1, 0.1], HOT, { lift: 0.05 });
      if (k !== 0) for (let j = 0; j < 4; j++) art(-w * 0.2 + (j % 2) * w * 0.2, h * 0.42 - j * h * 0.11, [0.25, h * 0.13, 0.1], 0xe8f0ff, { lift: 0.05 });
    },
    // 6 the catwalk: looking down a long drop
    catwalk(k, panel, art, w, h) {
      panel(k === 0 ? [['CATWALK 9', 0, 0.03, 1, 0.1, WHITE, 'GothamBold'], ['STRUCTURAL FAILURE', 0, 0.86, 1, 0.1, HOT, 'GothamBold']] : [], 0x0c0c10);
      for (let j = 0; j < 5; j++) art(0, -h * 0.4 + j * h * 0.18, [w, 0.3, 0.1], j % 2 ? STEEL : ORANGE, { mat: j % 2 ? 'Metal' : 'Neon' });
      art(w * 0.25 * (k % 2 ? 1 : -1), 0, [0.3, h * 0.8, 0.1], HAZARD);
    },
    // 7 the fireball
    fire(k, panel, art, w, h) {
      panel(k === 0 ? [['IGNITION', 0, 0.03, 1, 0.12, WHITE, 'GothamBold']] : [], 0x3a0800);
      for (let j = 0; j < 5; j++) {
        const hh = h * (0.3 + ((j * 7 + k * 3 + 10) % 5) * 0.1);
        art(-w * 0.4 + j * w * 0.2, -h / 2 + hh / 2, [w * 0.16, hh, 0.1], [HOT, ORANGE, AMBER][(j + k + 6) % 3]);
      }
      if (k === 0) art(0, 0, [0.2, h * 0.6, h * 0.6], 0xfff0a0, { shape: 2, lift: 0.1 });
    },
    // 9 daylight: out of the plant, the sky, the sun and the road home
    daylight(k, panel, art, w, h) {
      panel(k === 0 ? [['YOU ESCAPED', 0, 0.05, 1, 0.16, WHITE], ['THROTTLE SHUT DOWN  ·  REFINERY 7 SAFE', 0, 0.84, 1, 0.08, BLACK, 'GothamBold']] : [], SKY);
      art(0, -h * 0.4, [w, h * 0.2, 0.1], 0x5a8a3a, { mat: 'SmoothPlastic' });
      art(0, -h * 0.38, [w * 0.2, h * 0.16, 0.1], 0x3a3a3a, { mat: 'SmoothPlastic', lift: 0.05 });
      if (k === 1) art(0, h * 0.25, [0.2, h * 0.22, h * 0.22], 0xfff4a0, { shape: 2 });
      if (k === -2) for (let j = 0; j < 3; j++) art(-w * 0.2 + j * w * 0.2, -h * 0.18, [w * 0.12, h * 0.2, 0.1], 0x4a4a4e, { mat: 'Metal', lift: 0.03 });
    },
  };
  for (const sc of SCENES) if (sc.art) dome(sc);

  // 1 the Throttle core: a lever swings, the core housing glows
  for (const z of [114, 142]) { box([1.6, 9, 1.6], [-441, G, z], DARK, 'Metal', { collide: 0 }); neon([1.8, 1.8, 1.8], [-441, G + 9.8, z], HOT, { shape: 3 }); light(-442, 8, z, ORANGE); }
  light(-444, 13, 128, HOT);
  // 2 the pump room: four giant pistons pounding
  for (let k = 0; k < 4; k++) {
    const x = -514 + k * 6;
    box([4.4, 3, 4.4], [x, G, 166], DARK, 'Metal', { collide: 0 });
    box([3.2, 8, 3.2], [x, G + 3, 166], STEEL, 'Metal', { shape: 5, collide: 0 });
    occupied.push([x, 166, 3]);
  }
  light(-505, 12, 160, AMBER);
  light(-520, 6, 168, ORANGE);
  // 3 the pipeline: pipes all around the rig
  for (let k = 0; k < 6; k++) {
    const z = 160 + k * 8;
    for (const [x, y] of [[-540, 18], [-552, 19.5], [-540, 2.5]]) if (y > 5 || (z >= 176 && z <= 192)) add([6, 1.6, 1.6], [x, G + y, z], [ORANGE, FUEL, STEEL][k % 3], 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
    add([14, 1.2, 1.2], [-546, G + 19.5, z], DARK, 'Metal', { collide: 0 });
    neon([12, 0.3, 0.3], [-546, G + 18.5, z + 4], k % 2 ? FUEL : AMBER);
  }
  tagAt(data.tags.SteamVent, -552, G + 0.5, 176); tagAt(data.tags.SteamVent, -552, G + 0.5, 190);
  light(-550, 10, 182, FUEL);
  // 4 the tank farm: tanks, catwalk rails, a valve wheel spinning
  for (const [x, z, r] of [[-531, 223, 4], [-479, 223, 4], [-526, 198, 3.4], [-484, 198, 3.4]]) {
    add([r * 2, 14, r * 2], [x, G + 7, z], 0xc8c0b0, 'Metal', { shape: 5, collide: 0 });
    add([r * 2 + 0.3, 1, r * 2 + 0.3], [x, G + 9, z], ORANGE, 'Metal', { shape: 5, collide: 0 });
    occupied.push([x, z, r + 1]);
  }
  tagAt(data.tags.SteamVent, -505, G + 0.5, 222);
  light(-505, 10, 214, FUEL);
  light(-520, 7, 222, AMBER);
  // 5 the flare stacks: towers either side, burning
  for (const [x, z] of [[-455, 215], [-455, 249]]) {
    box([2.4, 22, 2.4], [x, G, z], STEEL, 'Metal', { shape: 5, collide: 0 });
    neon([2, 3, 2], [x, G + 23.5, z], HOT, { shape: 3 });
    tagAt(data.tags.Campfire, x, G + 22, z);
    occupied.push([x, z, 3]);
  }
  light(-450, 16, 232, 0x8a6aff);
  light(-452, 8, 232, HOT);
  // 6 the catwalk: girders overhead, a broken walkway hanging down
  for (let k = 0; k < 5; k++) add([1, 1, 22], [-504 + k * 4, G + 21, 262], DARK, 'Metal', { collide: 0 });
  add([10, 0.5, 3], [-496, G + 15, 266], STEEL, 'Metal', { collide: 0, rot: [Math.cos(0.5), -Math.sin(0.5), 0, Math.sin(0.5), Math.cos(0.5), 0, 0, 0, 1] });
  for (let k = 0; k < 6; k++) neon([0.15, 0.15, 3], [-500 + k * 1.6, G + 15.8 + k * 0.8, 266], HAZARD);
  light(-496, 12, 262, AMBER);
  // 7 the fireball: burners all around
  for (const [x, z] of [[-546, 244], [-540, 243], [-534, 244], [-526, 264], [-532, 264], [-538, 264], [-544, 264], [-550, 264], [-556, 264]]) { box([1.4, 1, 1.4], [x, G, z], DARK, 'Metal', { collide: 0 }); neon([0.9, 4, 0.9], [x, G + 3, z], HOT); occupied.push([x, z, 2]); }
  light(-540, 8, 245, HOT);
  light(-528, 8, 255, ORANGE);
  // 8 the exhaust tunnel: rings of fire and cold blue, screens down both sides
  for (let z = 236; z > 92; z -= 8) {
    const c = Math.round(z / 8) % 2 ? HOT : SKY;
    add([12, 0.4, 0.4], [-572, G + 12, z], c, 'Neon', { collide: 0 });
    for (const dx of [-6, 6]) add([0.4, 12, 0.4], [-572 + dx, G + 6, z], c, 'Neon', { collide: 0 });
  }
  for (const [x, face] of [[B.x0 + T + 0.3, 'Right'], [-561.2, 'Left']]) {
    for (let z = face === 'Left' ? 126 : 98; z < (face === 'Left' ? 222 : 236); z += 17) {
      sign([0.2, 14, 16.4], [x, G + 8.5, z + 8], 0x2a0a00, face, [['EXHAUST', 0, 0.06, 1, 0.12, AMBER, 'GothamBold'], ['>>>', 0, 0.4, 1, 0.24, HOT], ['VENT 7', 0, 0.84, 1, 0.1, AMBER, 'GothamBold']], { glow: true });
    }
  }
  light(-572, 10, 200, HOT);
  light(-572, 10, 140, SKY);
  // 9 daylight: the station's way home lit like morning
  light(-516, 12, 50, 0xfff4d0);
  for (const [x, y, z, c] of [[-450, 16, 120, HOT], [-498, 16, 160, AMBER], [-520, 16, 160, ORANGE], [-552, 16, 172, FUEL], [-490, 16, 205, AMBER],
    [-525, 16, 215, FUEL], [-455, 16, 225, 0x8a6aff], [-485, 16, 250, AMBER], [-540, 16, 250, HOT], [-540, 16, 62, 0xfff4d0]]) light(x, y, z, c);

  // ---- fill every empty bit of floor with refinery: drums, tanks, pipe
  // manifolds, crates and control cabinets (clear of the rigs and screens)
  const free = (x, z, r) => !nearTrack(x, z, 10.5 + r) && !occupied.some(([ox, oz, or]) => (ox - x) ** 2 + (oz - z) ** 2 < (or + r) ** 2)
    && !(x > -449 && z > 60 && z < 116) && x < INNER - 2.5 && x > B.x0 + 4 && z > B.z0 + 4 && z < B.z1 - 4
    && ![[118, -565, -462], [182, -538, -468], [232, -560, -474]].some(([wz, xa, xb]) => Math.abs(z - wz) < r + 2.6 && x > xa - r - 2 && x < xb + r + 2)
    && !(Math.abs(x + 558) < r + 2.6 && z > 124 && z < 240);
  const pieces = [
    (x, z) => { for (let k = 0; k < 4; k++) box([1.8, 2.8, 1.8], [x + (k % 2) * 2.1 - 1, G, z + Math.floor(k / 2) * 2.1 - 1], [ORANGE, 0x2a5aa0, 0xc81e1e, BLACK][(k + Math.round(x)) & 3], 'Metal', { shape: 5, collide: 0 }); },
    (x, z) => { box([4, 9, 4], [x, G, z], 0xc8c0b0, 'Metal', { shape: 5, collide: 0 }); box([4.3, 0.8, 4.3], [x, G + 6, z], ORANGE, 'Metal', { shape: 5, collide: 0 }); },
    (x, z) => { for (const dz of [-1.5, 1.5]) box([0.4, 3, 0.4], [x, G, z + dz], DARK, 'Metal', { collide: 0 }); add([5, 1.1, 1.1], [x, G + 3.4, z], FUEL, 'Metal', { shape: 2, collide: 0 }); add([5, 0.9, 0.9], [x, G + 2.2, z], ORANGE, 'Metal', { shape: 2, collide: 0 }); add([0.8, 1.6, 1.6], [x + 2.6, G + 3.4, z], 0xc81e1e, 'Metal', { shape: 2, collide: 0 }); },
    (x, z) => { box([3, 3, 3], [x, G, z], 0x6a5038, 'Wood', { collide: 0 }); box([2.4, 2.4, 2.4], [x + 0.3, G + 3, z - 0.2], 0x7a6048, 'Wood', { collide: 0 }); },
    (x, z) => { box([2.6, 6, 1.6], [x, G, z], 0x3a3e44, 'Metal', { collide: 0 }); for (let k = 0; k < 6; k++) neon([0.3, 0.3, 0.3], [x - 0.8 + (k % 3) * 0.8, G + 4 + Math.floor(k / 3) * 0.8, z - 0.85], [FUEL, AMBER, HOT][k % 3], { shape: 3 }); },
    (x, z) => { box([3.4, 1.2, 3.4], [x, G, z], DARK, 'Metal', { collide: 0 }); box([1.6, 5, 1.6], [x, G + 1.2, z], STEEL, 'Metal', { shape: 5, collide: 0 }); add([2.6, 0.3, 2.6], [x, G + 6.4, z], 0xc81e1e, 'Metal', { shape: 5, collide: 0 }); },
  ];
  let placed = 0;
  for (let x = B.x0 + 5; x < INNER - 3; x += 6.5) {
    for (let z = B.z0 + 5; z < B.z1 - 4; z += 6.5) {
      const jx = x + (((x * 13 + z * 7) % 5) - 2) * 0.4, jz = z + (((x * 5 + z * 11) % 5) - 2) * 0.4;
      if (!free(jx, jz, 2.6)) continue;
      pieces[Math.abs(Math.round(jx * 3 + jz * 5)) % pieces.length](jx, jz);
      placed++;
    }
  }

  // ---- the vehicles: a four-seat bench on the end of a robot arm
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const cabinParts = () => {
    const p = [];
    p.push(pp(0, [8.4, 0.5, 2.2], [0, 0, 0], BLACK, 'Metal'));
    p.push(pp(0, [8.6, 0.25, 2.3], [0, -0.3, 0], ORANGE, 'Metal'));
    for (const x of [-2.4, -0.8, 0.8, 2.4]) {
      p.push(pp(0, [1.45, 0.5, 1.6], [x, 0.35, -0.05], 0x2a2a2e, 'Fabric'));
      p.push(pp(0, [1.45, 2.6, 0.45], [x, 1.7, 0.8], 0x2a2a2e, 'Fabric'));
      p.push(pp(0, [0.25, 1.4, 0.9], [x - 0.75, 2.6, 0.5], 0x3a3a3e, 'Fabric'));
    }
    p.push(pp(0, [8.8, 3.4, 0.4], [0, 1.6, 1.2], BLACK, 'Metal'));
    p.push(pp(0, [8.8, 0.3, 0.42], [0, 2.4, 1.2], ORANGE, 'Neon'));
    for (const sd of [-1, 1]) {
      p.push(pp(0, [0.4, 3.8, 2.6], [sd * 4.3, 1.4, 0.2], ORANGE, 'Metal'));
      p.push(pp(0, [0.42, 0.25, 2.2], [sd * 4.3, 2.8, 0.1], AMBER, 'Neon'));
    }
    p.push(pp(0, [9, 0.4, 2.8], [0, 3.6, 0.2], BLACK, 'Metal')); // the hood
    p.push(pp(0, [9, 0.15, 0.2], [0, 3.38, -1.1], AMBER, 'Neon'));
    p.push(pp(0, [8, 0.3, 1.1], [0, -1.6, -1.1], STEEL, 'Metal')); // the footrest
    for (const x of [-3.6, 3.6]) p.push(pp(0, [0.3, 1.4, 0.3], [x, -0.9, -0.9], STEEL, 'Metal'));
    p.push(pp(0, [2.4, 2.4, 1.4], [0, 1.0, 2.0], DARK, 'Metal')); // the wrist mount
    p.push(pp(2, [1, 1.8, 1.8], [0, 1.0, 2.7], ORANGE, 'Metal'));
    return p;
  };
  const seatList = () => [-2.4, -0.8, 0.8, 2.4].map((x) => [x, 0.6 + 1.3, -0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const baseParts = () => {
    const p = [];
    p.push(pp(0, [5.6, 0.7, 9.4], [0, 1.0, 0.4], DARK, 'Metal'));
    p.push(pp(0, [5.8, 0.25, 9.6], [0, 1.4, 0.4], HAZARD, 'SmoothPlastic'));
    for (const [x, z] of [[-2.6, -3.6], [2.6, -3.6], [-2.6, 4.4], [2.6, 4.4]]) {
      p.push(pp(0, [0.3, 0.6, 0.9], [x, 0.7, z], 0x3a3c42, 'Metal'));
      p.push(pp(2, [0.4, 0.8, 0.8], [x, 0.4, z], 0x111111, 'Rubber'));
    }
    p.push(pp(5, [3, 0.8, 3], [0, 1.8, 3.0], ORANGE, 'Metal')); // the turret
    p.push(pp(0, [2, 1.6, 2.4], [0, 2.2, 3.4], DARK, 'Metal'));
    p.push(pp(0, [2.6, 1.4, 3], [0, 1.9, -2.6], 0x3a3e44, 'Metal')); // the control pack
    p.push(pp(3, [0.5, 0.5, 0.5], [1.2, 2.7, -2.6], AMBER, 'Neon'));
    p.push(pp(3, [0.5, 0.5, 0.5], [-1.2, 2.7, -2.6], FUEL, 'Neon'));
    return p;
  };
  const L1 = 4.2, L2 = 4.2;
  const armA = () => [pp(2, [1.9, 1.9, 1.9], [0, 0, 0], DARK, 'Metal'), pp(0, [1.4, L1, 1.4], [0, L1 / 2, 0], ORANGE, 'Metal'), pp(0, [1.45, 0.3, 1.45], [0, L1 * 0.75, 0], BLACK, 'Metal')];
  const armB = () => [pp(2, [1.7, 1.6, 1.6], [0, 0, 0], DARK, 'Metal'), pp(0, [1.1, L2, 1.1], [0, L2 / 2, 0], ORANGE, 'Metal'), pp(3, [1.3, 1.3, 1.3], [0, L2, 0], DARK, 'Metal')];
  const cars = [], seats = [], extras = {}, extrasNames = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13] + H, e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: cabinParts() });
    seats.push(seatList());
    const piv = [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
    extras[`Base${k + 1}`] = { pivot: piv, parts: baseParts() };
    extras[`ArmA${k + 1}`] = { pivot: piv, parts: armA() };
    extras[`ArmB${k + 1}`] = { pivot: piv, parts: armB() };
    extrasNames.push(`Base${k + 1}`, `ArmA${k + 1}`, `ArmB${k + 1}`);
  }
  // animated scenery (built in world axes)
  const props = [];
  const addProp = (name, parts, at, prop) => {
    const w = [MX(at[0], at[2]), at[1], MZ(at[0])];
    extras[name] = { pivot: [...w, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at: w, ...prop });
  };
  // the Throttle lever, slamming back and forth on the core's wall
  addProp('Lever', [pp(0, [0.8, 7, 0.8], [0, 3.5, 0], STEEL, 'Metal'), pp(3, [1.8, 1.8, 1.8], [0, 7.2, 0], HOT, 'Neon'), pp(2, [1.2, 1.6, 1.6], [0, 0, 0], DARK, 'Metal')], [-441.5, G + 5, 116], { kind: 'swing', amp: 0.7, freq: 3.4 });
  // the pump room's pistons
  for (let k = 0; k < 4; k++) addProp(`Piston${k + 1}`, [pp(5, [2.4, 6, 2.4], [0, 0, 0], 0xb8bcc4, 'Metal'), pp(5, [3.2, 0.8, 3.2], [0, 3.2, 0], ORANGE, 'Metal')], [-514 + k * 6, G + 14, 166], { kind: 'piston', amp: 2.6, freq: 6, phase: k * Math.PI / 2 });
  // the tank farm's valve wheel, spinning
  addProp('Valve', [pp(2, [0.4, 5, 5], [0, 0, 0], 0xc81e1e, 'Metal'), pp(0, [0.5, 5.4, 0.5], [0, 0, 0], 0xc81e1e, 'Metal'), pp(0, [0.5, 0.5, 5.4], [0, 0, 0], 0xc81e1e, 'Metal')], [-505, G + 8, 226], { kind: 'spin', speed: 5 });
  // falling debris over the catwalk and the fireball
  for (let k = 0; k < 3; k++) addProp(`Debris${k + 1}`, [pp(0, [1.6, 0.4, 3], [0, 0, 0], STEEL, 'Metal')], [-499 + k * 3, G + 22, 263], { kind: 'fall', drop: 19, period: 2.4 + k * 0.6, phase: k * 0.33 });
  for (let k = 0; k < 3; k++) addProp(`Ember${k + 1}`, [pp(3, [0.8, 0.8, 0.8], [0, 0, 0], AMBER, 'Neon')], [-548 + k * 8, G + 20, k % 2 ? 266 : 242], { kind: 'fall', drop: 18, period: 1.8 + k * 0.4, phase: k * 0.27 });
  // the queue hall's THROTTLE intake fan
  addProp('Fan', [pp(2, [0.6, 6.4, 6.4], [0, 0, 0], 0x2a2a2e, 'Metal'), pp(0, [0.5, 6.4, 0.9], [0, 0, 0], 0xb8bcc4, 'Metal'), pp(0, [0.5, 0.9, 6.4], [0, 0, 0], 0xb8bcc4, 'Metal')], [-414, FLOOR + 8, 250.2], { kind: 'spin', speed: 9 });
  extrasNames.push(...props.map((p) => p.name));

  // ---- the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    Pv.setFromMatrixPosition(m4);
    stops.push(cfm(px0 + 1, PLAT, Pv.x - 486, -Math.PI / 2));
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
  const origin = [MX(-500, 160), 0, MZ(-500)];
  const ride = {
    id: RIDE_ID, kind: 'motionsim', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, party: 12, noExtended: true, queue: qpath, trackStyle: null, extras, extrasNames, crew,
    motionsim: { H, scenes, props, arm: { shoulder: [0, 2.2, 3.0], wrist: [0, 1.0, 2.7], l1: L1, l2: L2, lift: 2.6, reach: 2.2, gain: 1.9 } },
  };
  data.rides.push(ride);
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - MX(x, z)) ** 2 + (track.pos[i * 3 + 2] - MZ(x)) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  const cues = [
    [at(-450, 128), 'sparks', [0, 3, -6]], [at(-505, 152), 'sparks', [0, 4, -8]], [at(-546, 182), 'sparks', [-3, 6, -6]],
    [at(-505, 210), 'sparks', [0, 6, -10]], [at(-465, 232), 'explosion', [0, 9, -12]], [at(-496, 255), 'sparks', [0, 8, -8]],
    [at(-540, 255), 'explosion', [0, 6, -12]], [at(-540, 255), 'fire', [-5, 0, 0]], [at(-532, 255), 'fire', [5, 0, 0]], [at(-572, 200), 'fire', [0, 2, -10]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Escape Fuel Throttle', land: 'Velocity', category: 'Thrill', thrill: 4, kind: 'darkride', carStyle: 'coaster',
    description: "The THROTTLE engine at Throttle Works is jammed wide open. Strap into a test rig - a bench held out on a giant robot arm - and escape the refinery: the core, the pump room, the pipeline, the tank farm, the flare stacks, a collapsing catwalk, the fireball and the exhaust tunnel. The arm lifts, tilts and swings you right into the screens, fully indoors.",
    baseWait: 80, origin, entrance: [MX(-392.5, dIn + 7), 0, MZ(-392.5)], exit: [MX(-382, dOut), 0, MZ(-382)], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [ORANGE, BLACK, AMBER], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Escape Fuel Throttle is open - the arms are live!', 'Throttle Works is through the gate. Hold on tight!'];
  return { ride, placed, gate: { x: gx, z: -46 }, indoor: { x0: MX(0, B.z0), x1: MX(0, B.z1), z0: MZ(B.x1), z1: MZ(B.x0) } };
}

// a toast the first time you walk up to the new ride
export class FuelThrottleSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 40) {
      this.told = true;
      this.hooks.toast('ESCAPE FUEL THROTTLE is now open! Through the gate to Throttle Works: strap into a robot-arm test rig and get out before the THROTTLE blows.', 'reward');
    }
  }
}
