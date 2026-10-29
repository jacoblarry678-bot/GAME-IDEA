// Construction Runaway: a robot-arm dark ride. Benton Construction's new
// RIG 3 - a bench of four seats on the end of a giant robotic arm, riding a
// track - is supposed to give visitors a gentle tour of the Benton Tower
// site. It doesn't. It runs away with you through the site: the jackhammers
// and the concrete mixer, the wrecking ball (the arm rolls you right over
// onto your side to duck it), the excavation pit (it tips you halfway
// upside down, flat on your back, as a steel beam swings over), the welding
// bay, the scaffolding as it collapses and the fuel tanker going up. Then
// the whole rig rides the construction elevator up to the top floor, out
// under the sky on the 40th floor, flips you onto your back to watch the
// tower crane swing overhead, and drops back down the elevator shaft to the
// inspector's office.
//
// Everything is dressed: hoarding, scaffolding, pipes, signs and work
// lights on every wall, trusses overhead, and the floor between the scenes
// piled with cones, rebar, cement bags, I-beams, cable drums and barriers.
//
// It stands north of Throttle Works, through a gate in its north wall. Its
// show building uses Diesel Run's floor plan, laid out in Diesel Run's
// frame and turned a quarter turn into place here.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'ConstructionRunaway';
// Diesel Run's frame -> the world: a quarter turn
const MX = (x, z) => z + 726;
const MZ = (x) => -100 - x;
const TURN = Math.PI / 2;
const rotTurn = (r) => [r[6], r[7], r[8], r[3], r[4], r[5], -r[0], -r[1], -r[2]];
const G = 0.1;
const FLOOR = 0.5;
const DECK = 13; // the top floor
const CARS = 3, SPACING = 14, H = 4.5;
const PLAT = FLOOR + H - 1.95;
const BLD = { x0: -580, x1: -390, z0: 34, z1: 272, H: 32 };
const INNER = -438;
const ORANGE = 0xff7a10, AMBER = 0xffb020, BLACK = 0x141414, STEEL = 0x5a5e66, DARK = 0x24262a, RUST = 0x7a4a2a, HAZARD = 0xf2c818, FUEL = 0x3adc6e, HOT = 0xff4a1a, WHITE = 0xf4f4f0, SKY = 0x6ab4ff;
const PLY = 0xc8a46a, CONCRETE = 0x8a8680, SAFETY = 0x7adc3a;
const GATE = { x0: 785, x1: 805 };

const P = (x, z, v, y = FLOOR) => [MX(x, z), y, MZ(x), v * 1.6];
const CIRCUIT = [
  P(-450, 104, 1),
  P(-450, 118, 2), P(-450, 128, 0.7), P(-450, 136, 1.2), // 1 the site office
  P(-454, 148, 4), P(-466, 152, 5), P(-490, 152, 2), P(-505, 152, 0.7), P(-515, 152, 1.5), // 2 jackhammers and the mixer
  P(-532, 152, 4), P(-543, 158, 3), P(-546, 172, 1), P(-546, 182, 0.7), P(-546, 192, 2), // 3 the wrecking ball
  P(-544, 204, 4), P(-534, 210, 4), P(-515, 210, 1.2), P(-505, 210, 0.8), P(-494, 210, 2), // 4 the excavation pit
  P(-476, 210, 4), P(-467, 216, 3), P(-465, 228, 0.9), P(-465, 236, 1.1), // 5 the welding bay
  P(-467, 248, 4), P(-478, 255, 4), P(-492, 255, 1.2), P(-500, 255, 2), P(-508, 255, 6), // 6 the scaffolding
  P(-524, 255, 4), P(-540, 255, 3.5), P(-556, 255, 3), // 7 the tanker
  P(-566, 251, 2.4), P(-571, 246, 1.6),
  // 8 up the construction elevator to the top floor, and back down
  P(-572, 242, 1.1), P(-572.4, 239, 1, 4), P(-572.7, 236, 1, 9), P(-572.4, 233, 1.1, DECK), P(-572, 226, 1.8, DECK),
  P(-572, 200, 2.4, DECK), P(-572, 170, 0.9, DECK), P(-572, 150, 2.4, DECK), P(-572, 120, 1.8, DECK), P(-572, 113, 1.1, DECK),
  P(-572.4, 110, 1, 9), P(-572.7, 107, 1.3, 4), P(-572.4, 104, 1.6), P(-572, 96, 3),
  P(-569, 72, 5), P(-556, 62, 3), P(-528, 62, 1.2), P(-516, 62, 0.7), P(-504, 62, 1.5), // 9 the inspector
  P(-480, 62, 4), P(-462, 64, 3), P(-452, 72, 2), P(-450, 84, 1.4), P(-450, 94, 1.1),
];
// each scene: where the rig stops, what it turns to face, and the
// wrap-around screen in front of it (radius from the stop, height)
const SCENES = [
  { stop: [-450, 128], face: [-438, 128], style: 'launch', back: 14, fwd: 12, R: 8.0, h: 16, art: 'office' },
  { stop: [-505, 152], face: [-505, 180], style: 'engine', back: 16, fwd: 12, R: 24, h: 18, art: 'mixer' },
  { stop: [-546, 182], face: [-560, 182], style: 'sideways', back: 18, fwd: 14, R: 8.6, h: 16, art: 'wrecking' },
  { stop: [-505, 210], face: [-505, 232], style: 'flip', back: 16, fwd: 14, R: 18.4, h: 18, art: 'pit' },
  { stop: [-465, 232], face: [-438, 232], style: 'storm', back: 14, fwd: 12, R: 23, h: 20, art: 'welding' },
  { stop: [-496, 255], face: [-496, 272], style: 'bridge', back: 10, fwd: 14, R: 12.4, h: 18, art: 'scaffold' },
  { stop: [-540, 255], face: [-540, 230], style: 'fire', back: 18, fwd: 14, R: 19, h: 18, art: 'tanker' },
  { stop: [-572.4, 238], face: null, style: 'lift', back: 8, fwd: 8 },
  { stop: [-572, 170], face: null, style: 'flip', back: 34, fwd: 26 },
  { stop: [-572.4, 108], face: null, style: 'lift', back: 8, fwd: 10 },
  { stop: [-516, 62], face: [-516, 34], style: 'finish', back: 16, fwd: 12, R: 23, h: 18, art: 'inspector' },
];

export function buildConstructionRunaway(data) {
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
  const dIn = 139, dOut = 40; // the entrance and exit doors (world x 865 and 766)

  // ======== the site (world coordinates), north of Throttle Works
  const SITE = { x0: 750, x1: 1004, z0: 236, z1: 500 };
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 24 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6) && !(Math.abs(t.pos[0] - 795) < 8 && t.pos[2] > -30 && t.pos[2] < 240));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x3a3228, 'Asphalt');
  // a gate in Throttle Works' north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 236) < 0.6 && Math.abs(p[4] - 654) < 0.6 && p[3] > 300;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(500, 236, GATE.x0, 236);
  wallSeg(GATE.x1, 236, 808, 236);
  wallSeg(SITE.x0, 236, SITE.x0, SITE.z1);
  wallSeg(SITE.x0, SITE.z1, SITE.x1, SITE.z1);
  wallSeg(SITE.x1, SITE.z1, SITE.x1, 236);
  const gx = (GATE.x0 + GATE.x1) / 2;
  // the gate: a steel I-beam frame, yellow and black, a hard-hat sign
  for (const x of [GATE.x0 + 1, GATE.x1 - 1]) {
    W.box([1.6, 18, 1.2], [x, G, 236], HAZARD, 'Metal');
    for (let k = 0; k < 9; k++) W.add([1.7, 1, 1.3], [x, G + 1.5 + k * 2, 236], BLACK, 'Metal', { collide: 0, rot: [Math.cos(0.5), -Math.sin(0.5), 0, Math.sin(0.5), Math.cos(0.5), 0, 0, 0, 1] });
    W.add([1, 1, 1], [x, G + 18.6, 236], ORANGE, 'Neon', { shape: 3, collide: 0 });
  }
  W.add([GATE.x1 - GATE.x0 + 2, 1.6, 1.2], [gx, G + 18.8, 236], HAZARD, 'Metal', { collide: 0 });
  for (const face of ['Front', 'Back']) {
    W.sign([GATE.x1 - GATE.x0 + 4, 4, 0.3], [gx, G + 22, 236 + (face === 'Front' ? -0.8 : 0.8)], HAZARD, face, [['CONSTRUCTION RUNAWAY', 0, 0.04, 1, 0.56, BLACK], ['HARD HAT AREA  ·  BENTON TOWER  ·  RIG 3', 0, 0.64, 1, 0.32, BLACK, 'GothamBold']], { glow: true });
  }
  // cones and a barrier arm, swung open
  for (const x of [GATE.x0 - 2, GATE.x1 + 2]) for (const z of [232, 240]) { W.add([0.9, 1.4, 0.9], [x, G + 0.7, z], ORANGE, 'SmoothPlastic', { shape: 5, collide: 0 }); W.add([0.95, 0.25, 0.95], [x, G + 0.9, z], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 }); }
  W.box([0.8, 3.2, 0.8], [GATE.x0 + 3, G, 232], HAZARD, 'Metal');
  for (let k = 0; k < 5; k++) W.add([0.4, 1.6, 0.4], [GATE.x0 + 3, G + 4 + k * 1.6, 232], k % 2 ? BLACK : WHITE, 'SmoothPlastic', { collide: 0 });
  // the walk: up the side of Throttle Works from the Boom Coaster walk, then
  // through the gate to the doors
  const route = [[795, -28], [795, 236], [795, 262], [865, 262], [865, 287]];
  const exitRoute = [[766, 287], [766, 262], [795, 262]];
  for (const r of [route, exitRoute]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.23, (za + zb) / 2], 0x8a8478, 'Pavement', { yaw, collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }
  for (let z = -18; z < 230; z += 30) { W.add([0.9, 1.4, 0.9], [790, G + 0.7, z], ORANGE, 'SmoothPlastic', { shape: 5, collide: 0 }); W.add([0.95, 0.25, 0.95], [790, G + 0.9, z], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 }); }
  W.box([0.5, 8, 0.5], [800, G, 40], 0x2e3238, 'Metal');
  W.sign([7, 2.4, 0.2], [800, G + 8.4, 40], HAZARD, 'Front', [['CONSTRUCTION RUNAWAY  ↑', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  W.sign([7, 2.4, 0.2], [800, G + 8.4, 40], HAZARD, 'Back', [['↓ THROTTLE WORKS', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  for (const [x, z] of [[800, 100], [800, 180], [780, 270], [830, 270], [900, 270], [960, 272]]) lampW(x, z, AMBER);
  // wait times
  W.box([0.6, 6, 0.6], [gx - 9, G, 226], 0x2e3238, 'Metal');
  const waitPart = W.add([9.6, 6, 0.8], [gx - 9, G + 9, 226], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 59, cf: cf(gx + 6, G, 228, Math.PI) });
  // the site yard: hoarding, a tower crane, the site office, a mixer truck,
  // an excavator, porta-potties, pallets and pipes
  for (const [xa, xb] of [[752, 790], [800, 1002]]) {
    for (let x = xa; x < xb - 1; x += 4) W.add([4, 7, 0.4], [x + 2, G + 3.5, 239], PLY, 'WoodPlanks', { collide: 0 });
  }
  [['BENTON TOWER', '40 FLOORS  ·  COMING SOON(ISH)'], ['RIG 3', 'THE SAFEST WAY TO TOUR A BUILDING SITE*'], ['* NOT VERIFIED', 'BENTON CONSTRUCTION CO.']].forEach(([a, b], k) => {
    W.sign([14, 5, 0.2], [830 + k * 50, G + 4, 238.7], 0x1a1a1a, 'Front', [[a, 0, 0.08, 1, 0.5, HAZARD], [b, 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
    W.sign([14, 5, 0.2], [830 + k * 50, G + 4, 239.3], 0x1a1a1a, 'Back', [[a, 0, 0.08, 1, 0.5, HAZARD], [b, 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  });
  // the tower crane: a lattice mast, the cab, and the jib swinging round (a prop)
  const CR = [988, 258];
  W.box([7, 2, 7], [CR[0], G, CR[1]], CONCRETE, 'Concrete');
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) W.add([0.5, 70, 0.5], [CR[0] + dx, G + 37, CR[1] + dz], HAZARD, 'Metal', { collide: 0 });
  for (let y = 4; y < 72; y += 4) {
    for (const [a, b] of [[[-1.5, -1.5], [1.5, -1.5]], [[1.5, -1.5], [1.5, 1.5]], [[1.5, 1.5], [-1.5, 1.5]], [[-1.5, 1.5], [-1.5, -1.5]]]) {
      W.add([0.25, 0.25, 3], [CR[0] + (a[0] + b[0]) / 2, G + y, CR[1] + (a[1] + b[1]) / 2], HAZARD, 'Metal', { collide: 0, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
    }
  }
  W.box([3.6, 1, 3.6], [CR[0], G + 72, CR[1]], HAZARD, 'Metal', { collide: 0 });
  // the site office, porta-potties
  W.box([18, 7, 7], [930, G + 0.6, 252], 0xe8e4dc, 'Metal');
  for (let k = 0; k < 4; k++) W.add([2.4, 1.6, 0.2], [924 + k * 4, G + 5, 248.4], 0x2a3a4a, 'Glass', { collide: 0 });
  W.sign([10, 1.6, 0.2], [930, G + 9.1, 248.4], 0x1a3a6a, 'Front', [['SITE OFFICE', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  for (const x of [950, 953.2, 956.4]) { W.box([3, 7.4, 3], [x, G, 250], 0x3a6ab8, 'SmoothPlastic'); W.add([3.2, 0.4, 3.2], [x, G + 7.6, 250], WHITE, 'SmoothPlastic', { collide: 0 }); }
  // a concrete mixer truck
  W.box([5, 5, 6], [826, G + 1.2, 249], 0xe8e4dc, 'Metal');
  W.box([5.2, 1.2, 16], [826, G + 1.2, 256], 0x2a2a2a, 'Metal', { collide: 0 });
  W.add([5.4, 5.4, 9], [826, G + 6, 258], ORANGE, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2, rot: null });
  for (const z of [251, 256, 261]) for (const dx of [-2.7, 2.7]) W.add([0.8, 2.4, 2.4], [826 + dx, G + 1.2, z], 0x111111, 'Rubber', { shape: 2, collide: 0 });
  // an excavator by the doors
  {
    const ex = 940, ez = 275;
    W.box([6, 1.4, 8], [ex, G, ez], 0x2a2a2a, 'Metal', { collide: 0 });
    W.box([6.4, 3.4, 6], [ex, G + 1.4, ez], HAZARD, 'Metal');
    W.box([3, 3, 3], [ex - 1.4, G + 4.8, ez - 1], HAZARD, 'Metal', { collide: 0 });
    W.add([2.8, 2.2, 0.2], [ex - 1.4, G + 6.4, ez - 2.55], 0x2a3a4a, 'Glass', { collide: 0 });
    W.add([1.2, 1.2, 9], [ex + 1.2, G + 8, ez - 6.4], HAZARD, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.6), -Math.sin(0.6), 0, Math.sin(0.6), Math.cos(0.6)] });
    W.add([1, 1, 6], [ex + 1.2, G + 6.6, ez - 12.4], HAZARD, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.9), -Math.sin(-0.9), 0, Math.sin(-0.9), Math.cos(-0.9)] });
    W.box([3, 2, 2.4], [ex + 1.2, G, ez - 15], 0x2a2a2a, 'Metal', { collide: 0 });
  }
  // pallets of blocks, pipes and a dumpster
  for (const [x, z] of [[880, 250], [887, 250], [990, 285], [756, 250]]) { W.box([4, 0.6, 4], [x, G, z], 0x8a6a40, 'Wood', { collide: 0 }); W.box([3.4, 2.4, 3.4], [x, G + 0.6, z], CONCRETE, 'Concrete', { collide: 0 }); }
  for (let k = 0; k < 6; k++) W.add([12, 1.2, 1.2], [905, G + 0.7 + Math.floor(k / 3) * 1.1, 280 + (k % 3) * 1.3 + Math.floor(k / 3) * 0.65], 0x5a5e66, 'Metal', { shape: 2, collide: 0 });
  W.box([10, 4, 5], [770, G, 250], 0x2a6a3a, 'Metal');

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
  // the construction look outside: scaffolding all over the walls, a yellow
  // and black base band, debris netting, an orange stripe
  const outside = [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz, 'z'], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2, 'x'], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2, 'x']];
  for (const [za, zb] of [[B.z0, dIn - 26], [dIn + 26, B.z1]]) outside.push([0.3, zb - za, B.x1 + 0.2, (za + zb) / 2, 'z']);
  for (const [w, d, x, z, ax] of outside) {
    const len = ax === 'z' ? d : w;
    for (let k = -len / 2; k < len / 2 - 0.5; k += 3) add(ax === 'z' ? [w, 2.4, 3] : [3, 2.4, d], ax === 'z' ? [x, G + 1.2, z + k + 1.5] : [x + k + 1.5, G + 1.2, z], Math.round(k / 3) % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0 });
    neon([w, 0.6, d], [x, G + 27, z], ORANGE);
    add([w, 14, d], [x, G + 16, z], 0x3a6a4a, 'Fabric', { collide: 0, trans: 0.25 }); // debris netting
  }
  // scaffolding across the front (clear of the doors)
  for (const [za, zb] of [[B.z0 + 2, dOut - 6], [dOut + 6, dIn - 12], [dIn + 12, B.z1 - 2]]) {
    for (let z = za; z <= zb; z += 6) for (const dx of [1.4, 4.4]) box([0.3, 28, 0.3], [B.x1 + dx, G, z], 0x9aa0a8, 'Metal', { collide: 0 });
    for (let y = 6; y <= 26; y += 5) {
      for (const dx of [1.4, 4.4]) add([0.25, 0.25, zb - za], [B.x1 + dx, G + y, (za + zb) / 2], 0x9aa0a8, 'Metal', { collide: 0 });
      add([2.8, 0.3, zb - za], [B.x1 + 2.9, G + y - 0.2, (za + zb) / 2], 0x8a6a40, 'WoodPlanks', { collide: 0 });
      add([0.2, 0.6, zb - za], [B.x1 + 4.5, G + y + 1, (za + zb) / 2], ORANGE, 'SmoothPlastic', { collide: 0 });
    }
  }
  // the front: CONSTRUCTION RUNAWAY on a hoarding over the doors, with a
  // hard hat, warning beacons and a big RIG 3 board
  sign([0.4, 11, 62], [B.x1 + 5, G + 19, dIn], HAZARD, 'Right', [['CONSTRUCTION', 0, 0.04, 1, 0.32, BLACK], ['RUNAWAY', 0, 0.36, 1, 0.42, 0xc81e1e], ['BENTON TOWER  ·  RIG 3 SITE TOURS  ·  HARD HATS REQUIRED', 0, 0.82, 1, 0.14, BLACK, 'GothamBold']], { glow: true });
  for (const dz of [-34, 34]) {
    add([4, 2, 4], [B.x1 + 5.6, G + 20, dIn + dz], HAZARD, 'SmoothPlastic', { shape: 3, collide: 0 });
    add([5.4, 0.4, 5.4], [B.x1 + 5.6, G + 19, dIn + dz], HAZARD, 'SmoothPlastic', { shape: 5, collide: 0 });
    neon([1, 1, 1], [B.x1 + 5.6, G + 25, dIn + dz], ORANGE, { shape: 3 });
    light(B.x1 + 7, 22, dIn + dz, ORANGE);
  }
  add([8, 0.6, 20], [B.x1 + 4, G + 10.3, dIn], DARK, 'Metal', { collide: 0 });
  for (const dz of [-9.4, 9.4]) box([0.6, 10, 0.6], [B.x1 + 7.6, G, dIn + dz], HAZARD, 'Metal');
  sign([0.2, 1.4, 14], [B.x1 + 8, G + 9.6, dIn], BLACK, 'Right', [['RIG 3 SITE TOURS  ·  THIS WAY', 0, 0, 1, 1, HAZARD, 'GothamBold']], { glow: true });
  for (const dz of [-11, 11]) { neon([1.2, 1.2, 1.2], [B.x1 + 0.9, G + 11.5, dIn + dz], ORANGE, { shape: 3 }); light(B.x1 + 3, 10, dIn + dz, ORANGE); }
  sign([0.2, 1.4, 6], [B.x1 + 6.8, G + 10.3, dOut], BLACK, 'Right', [['EXIT', 0, 0, 1, 1, SAFETY, 'GothamBold']], { glow: true });
  add([6, 0.5, 9], [B.x1 + 3, G + 8.4, dOut], DARK, 'Metal', { collide: 0 });

  // ---- inside: the wall between the queue hall and the show
  const doorQ = 52;
  box([T, B.H, B.z1 - (doorQ + 4) - T], [INNER, G, (doorQ + 4 + B.z1 - T) / 2], SKIN, 'Metal');
  box([T, B.H, doorQ - 4 - (B.z0 + T)], [INNER, G, (B.z0 + T + doorQ - 4) / 2], SKIN, 'Metal');
  box([T, B.H - 10, 8], [INNER, G + 10, doorQ], SKIN, 'Metal');
  const EXZ = 45;
  box([B.x1 - INNER - T, 12, 0.6], [(INNER + B.x1) / 2, G, EXZ], DARK, 'Metal');
  for (let x = INNER + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, G + 11, 40], FUEL);

  // ---- dressing: every wall gets panels, ribs, pipes, gauges, a light strip
  // and a hazard band, so no wall is ever bare (plywood hoarding colors)
  const dress = (xa, za, xb, zb, side, h = 22, opts = {}) => {
    const len = Math.hypot(xb - xa, zb - za);
    if (len < 2) return;
    const ux = (xb - xa) / len, uz = (zb - za) / len;
    const nx = -uz * side, nz = ux * side; // into the room
    const yaw = Math.atan2(ux, uz);
    const at = (s, off) => [xa + ux * s + nx * off, za + uz * s + nz * off];
    const mid = at(len / 2, 0.85);
    if (!opts.bare) {
      add([0.2, h, len], [mid[0], G + h / 2, mid[1]], opts.panel ?? PLY, 'WoodPlanks', { collide: 0, yaw });
      for (let s = 2; s < len - 1; s += 4) { const [x, z] = at(s, 1.0); add([0.3, h, 0.4], [x, G + h / 2, z], 0x9aa0a8, 'Metal', { collide: 0, yaw }); }
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
  // (the elevator shafts and the top floor run close by this wall: there it's bare)
  const tunnelWall = { pipes: [[24, ORANGE, 1.1], [19, FUEL, 1.2]], pipeOff: 1.3, gauges: false };
  dress(B.x0 + T, B.z0 + T, B.x0 + T, 90, -1, 22, tunnelWall);
  dress(B.x0 + T, 250, B.x0 + T, B.z1 - T, -1, 22, tunnelWall);
  dress(B.x0 + T, 118, B.x0 + T, 228, -1, 11, { pipes: [[4, ORANGE, 0.8], [8, FUEL, 0.8]], gauges: false }); // under the top floor
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


  // ---- the queue: the Benton Tower site hall, seven long rows
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
  const fwd = [[830, 262], [865, 262], [MX(B.x1 + 3, dIn), MZ(B.x1 + 3)], ...fwdDR.map(([x, z]) => [MX(x, z), MZ(x)])];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 5, [-1, 0], FLOOR + 0.2);
  // scaffold-pipe railings on hazard-striped posts
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
  // screens all down the hall: the site briefing, blueprints and the news
  const brief = [['RIG 3', 'ROBOTIC SITE TOUR VEHICLE  ·  SAFETY RATING: PENDING'], ['TODAY ON SITE', 'JACKHAMMERS  ·  WRECKING BALL  ·  EXCAVATION  ·  WELDING'], ['YOUR TOUR', 'HOLD ON  ·  KEEP FEET FREE  ·  IT GOES UPSIDE DOWN (A BIT)'], ['BENTON NEWS 7', 'TOWER "AHEAD OF SCHEDULE", SAYS NOBODY']];
  brief.forEach(([title, sub], k) => {
    const z = 75 + k * 48;
    add([0.4, 8.4, 16.4], [INNER + 3.1, 12, z], 0x0a0a0c, 'Metal', { collide: 0 });
    sign([0.2, 8, 16], [INNER + 3.35, 12, z], 0x0c1a2e, 'Right', [[title, 0, 0.16, 1, 0.36, HAZARD], [sub, 0, 0.6, 1, 0.2, WHITE, 'GothamBold']], { glow: true });
  });
  [['HARD HAT AREA', HAZARD], ['SAFETY FIRST (THIRD, ACTUALLY)', ORANGE], ['DANGER: OVERHEAD WORK', HOT], ['DAYS WITHOUT AN INCIDENT: 0', ORANGE], ['RIG 3 TOURS: THIS WAY', SAFETY]].forEach(([text, c], k) => {
    sign([0.3, 3, 12], [B.x1 - T - 2.2, 15, 62 + k * 40 + (k > 1 ? 12 : 0)], 0x101010, 'Left', [[text, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
  });
  // hard hats on a rack, blueprints on tables, cones down the hall
  for (let k = 0; k < 10; k++) add([1, 0.6, 1.2], [B.x1 - T - 2.4, 8, 70 + k * 1.6], [HAZARD, WHITE, ORANGE][k % 3], 'SmoothPlastic', { shape: 3, collide: 0 });
  add([0.3, 0.3, 17], [B.x1 - T - 2.2, 7.6, 77], STEEL, 'Metal', { collide: 0 });
  for (const z of [100, 180]) { box([3, 3, 6], [-394.5, FLOOR, z], 0x6a5038, 'Wood', { collide: 0 }); add([2.6, 0.1, 5.4], [-394.5, FLOOR + 3.06, z], 0x2a5aa8, 'SmoothPlastic', { collide: 0 }); }
  // the north end of the hall: RIG 3 itself on display, beacon spinning
  box([30, 2, 10], [-414, FLOOR, 262], DARK, 'Metal');
  box([6, 1.4, 9], [-414, FLOOR + 2, 262], 0x24262a, 'Metal');
  box([3, 2, 3], [-414, FLOOR + 3.4, 264], HAZARD, 'Metal', { shape: 5 });
  add([1.4, 7, 1.4], [-414, FLOOR + 8, 263], HAZARD, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.5), -Math.sin(0.5), 0, Math.sin(0.5), Math.cos(0.5)] });
  add([1.2, 6, 1.2], [-414, FLOOR + 12, 258.5], HAZARD, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.8), -Math.sin(-0.8), 0, Math.sin(-0.8), Math.cos(-0.8)] });
  box([8.4, 0.5, 2.2], [-414, FLOOR + 12.6, 255], BLACK, 'Metal', { collide: 0 });
  for (const x of [-2.4, -0.8, 0.8, 2.4]) box([1.45, 2.6, 0.45], [-414 + x, FLOOR + 13.1, 255.8], 0x2a2a2e, 'Fabric', { collide: 0 });
  for (const dx of [-12, 12]) { box([3, 14, 3], [-414 + dx, FLOOR, 264], STEEL, 'Metal'); neon([3.2, 1, 3.2], [-414 + dx, FLOOR + 10, 264], ORANGE); }
  sign([34, 8, 0.4], [-414, 23, B.z1 - T - 3.2], 0x0c1a2e, 'Front', [['MEET RIG 3', 0, 0.06, 1, 0.42, HAZARD], ['IT LIFTS  ·  IT TILTS  ·  IT ROLLS  ·  IT TAKES THE ELEVATOR', 0, 0.6, 1, 0.28, WHITE, 'GothamBold']], { glow: true });
  light(-414, 10, 254, AMBER);
  light(-414, 18, 262, ORANGE);
  box([0.4, 7, 0.4], [-392.5, FLOOR, dIn + 7], 0x101114, 'Metal');
  sign([0.2, 2, 9], [-392.3, FLOOR + 6.4, dIn + 7], BLACK, 'Left', [['ENTRANCE', 0, 0, 1, 1, HAZARD]], { glow: true });
  // the exit corridor: lockers and an INSPECTION PASSED board
  for (let x = INNER + 4; x < B.x1 - 6; x += 3) box([2.6, 7, 1.6], [x, FLOOR, B.z0 + T + 1], [0x3a5a7a, 0x4a6a8a][Math.round(x) % 2], 'Metal', { collide: 0 });
  sign([16, 3, 0.3], [(INNER + B.x1) / 2, 9, B.z0 + T + 2.2], BLACK, 'Back', [['TOUR OVER  ·  HARD HATS IN THE BIN', 0, 0, 1, 1, SAFETY, 'GothamBold']], { glow: true });

  // ---- the track: a steel guide rail in the floor (and on the top floor)
  const track = makeTrack(CIRCUIT);
  // (the spline overshoots a little at the elevators: keep it on the floors)
  for (let i = 1; i < track.pos.length; i += 3) {
    if (track.pos[i] < FLOOR) track.pos[i] = FLOOR;
    else if (track.pos[i] > DECK && track.pos[i] < DECK + 0.8) track.pos[i] = DECK;
  }
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), Pv = new THREE.Vector3();
  for (let s = 0; s < track.length; s += 2) {
    sampler.matrixAt(s, m4);
    Pv.setFromMatrixPosition(m4);
    const e = m4.elements;
    if (Pv.y > FLOOR + 0.3 && Pv.y < DECK - 0.3) continue; // in an elevator shaft
    const ry = Math.atan2(e[8], e[10]) + Math.PI;
    W.add([2.4, 0.05, 2.2], [Pv.x, Pv.y + 0.03, Pv.z], 0x1a1a1c, 'Metal', { collide: 0, yaw: ry });
    if (s % 6 === 0) W.add([0.3, 0.06, 2.2], [Pv.x, Pv.y + 0.05, Pv.z], HAZARD, 'SmoothPlastic', { collide: 0, yaw: ry });
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
  for (let s = 0; s < track.length; s += 1.5) { sampler.matrixAt(s, m4); Pv.setFromMatrixPosition(m4); trackDR.push([-100 - Pv.z, Pv.x - 726]); }
  const nearTrack = (x, z, r) => trackDR.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < r * r);


  // ---- the station: RIG 3's loading bay
  const px0 = -445.4, px1 = INNER - T / 2;
  box([px1 - px0, PLAT - FLOOR, 46], [(px0 + px1) / 2, FLOOR, 88], 0x4a4844, 'Concrete');
  for (let z = 66; z < 111; z += 2) add([0.4, 0.06, 1], [px0 + 0.4, PLAT + 0.03, z], (z / 2) % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0 });
  const con = [px1 - 1.6, 108];
  box([1.4, 3, 2.4], [con[0], PLAT, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  sign([16, 3, 0.4], [-450, 15, 112], BLACK, 'Back', [['RIG 3 LOADING', 0, 0, 1, 0.6, HAZARD], ['HARD HATS ON  ·  ARMS ARE LIVE', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  sign([0.3, 5, 14], [INNER - T / 2 - 0.3, PLAT + 6, 88], 0x1a0c04, 'Left', [['RIG CHECK', 0, 0.08, 1, 0.36, HAZARD], ['ARM 1 OK  ·  ARM 2 OK  ·  ARM 3 ???', 0, 0.56, 1, 0.26, SAFETY, 'GothamBold']], { glow: true });
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
    // 1 the site office: the pre-shift check goes wrong
    office(k, panel, art, w, h) {
      if (k === 0) {
        panel([['RIG 3  ·  PRE-SHIFT CHECK', 0, 0.03, 1, 0.1, WHITE, 'GothamBold'], ['MALFUNCTION', 0, 0.8, 1, 0.16, HOT]], 0x0c1a2e);
        for (let j = 0; j < 4; j++) art(-w * 0.3 + j * w * 0.2, h * 0.05, [w * 0.14, h * 0.4, 0.1], j === 3 ? HOT : SAFETY);
        return;
      }
      panel([[k < 0 ? 'ARM' : 'TRACK', 0, 0.04, 1, 0.1, HAZARD, 'GothamBold'], [k < 0 ? 'UNLOCKED' : 'OVERRIDE', 0, 0.86, 1, 0.1, HOT, 'GothamBold']], 0x0c1a2e);
      for (let j = 0; j < 6; j++) art(0, -h * 0.3 + j * h * 0.11, [w * 0.6, h * 0.05, 0.1], 0x2a5aa8);
    },
    // 2 the jackhammers and the concrete mixer
    mixer(k, panel, art, w, h) {
      panel(k === 0 ? [['POUR No. 7', 0, 0.03, 1, 0.12, HAZARD, 'GothamBold'], ['MIXER: RUNAWAY', 0, 0.86, 1, 0.1, HOT, 'GothamBold']] : [], 0x2a2a30);
      art(0, h * 0.05, [0.2, h * 0.46, h * 0.46], ORANGE, { shape: 2 });
      art(0, h * 0.05, [0.2, h * 0.3, h * 0.3], 0x3a3a3a, { shape: 2, lift: 0.05 });
      art(0, -h * 0.42, [w, h * 0.06, 0.1], HAZARD);
    },
    // 3 the wrecking ball coming in
    wrecking(k, panel, art, w, h) {
      panel(k === 0 ? [['DEMOLITION', 0, 0.03, 1, 0.12, WHITE, 'GothamBold'], ['STAND CLEAR!', 0, 0.86, 1, 0.1, HOT, 'GothamBold']] : [], 0x3a4a5a);
      for (let j = 0; j < 4; j++) art(-w * 0.35 + j * w * 0.23, -h * 0.2, [w * 0.16, h * 0.5, 0.1], 0x8a5a4a, { mat: 'Brick' });
      art(w * 0.1 * k, h * 0.3, [0.15, h * 0.4, 0.1], 0x111111, { mat: 'Metal' });
      if (k === 0) art(0, h * 0.05, [0.2, h * 0.3, h * 0.3], 0x1a1a1a, { shape: 2, mat: 'Metal', lift: 0.05 });
    },
    // 4 the excavation pit
    pit(k, panel, art, w, h) {
      panel(k === 0 ? [['EXCAVATION', 0, 0.03, 1, 0.12, WHITE, 'GothamBold'], ['LOOK UP!', 0, 0.86, 1, 0.1, HAZARD, 'GothamBold']] : [], 0x4a3a2a);
      art(0, -h * 0.35, [w, h * 0.3, 0.1], 0x2a1e14, { mat: 'Slate' });
      art(w * 0.2 * (k || 1), -h * 0.05, [w * 0.5, h * 0.08, 0.1], HAZARD, { lift: 0.05 });
    },
    // 5 the welding bay: arcs and sparks
    welding(k, panel, art, w, h) {
      panel(k === 0 ? [['WELDING BAY', 0, 0.03, 1, 0.12, WHITE, 'GothamBold'], ['DO NOT LOOK AT THE ARC', 0, 0.86, 1, 0.1, SKY, 'GothamBold']] : [], 0x0c0c1a);
      for (let j = 0; j < 3; j++) art(-w * 0.3 + j * w * 0.3, h * 0.1 - j * h * 0.1, [w * 0.12, w * 0.12, 0.1], 0xd8ecff);
      for (let j = 0; j < 6; j++) art(-w * 0.35 + j * w * 0.14, -h * 0.2 + ((j * 37) % 10) * h * 0.03, [0.2, 0.2, 0.1], AMBER, { lift: 0.05 });
    },
    // 6 the scaffolding coming down
    scaffold(k, panel, art, w, h) {
      panel(k === 0 ? [['SCAFFOLD C', 0, 0.03, 1, 0.1, WHITE, 'GothamBold'], ['STRUCTURAL FAILURE', 0, 0.86, 1, 0.1, HOT, 'GothamBold']] : [], 0x2a3a4a);
      for (let j = 0; j < 5; j++) art(-w * 0.4 + j * w * 0.2, 0, [0.25, h * 0.8, 0.1], 0x9aa0a8, { mat: 'Metal' });
      for (let j = 0; j < 4; j++) art(0, -h * 0.35 + j * h * 0.22, [w, 0.3, 0.1], 0x8a6a40, { mat: 'WoodPlanks', lift: 0.03 });
    },
    // 7 the fuel tanker going up
    tanker(k, panel, art, w, h) {
      panel(k === 0 ? [['FUEL TANKER', 0, 0.03, 1, 0.12, WHITE, 'GothamBold']] : [], 0x3a0800);
      for (let j = 0; j < 5; j++) {
        const hh = h * (0.3 + ((j * 7 + k * 3 + 10) % 5) * 0.1);
        art(-w * 0.4 + j * w * 0.2, -h / 2 + hh / 2, [w * 0.16, hh, 0.1], [HOT, ORANGE, AMBER][(j + k + 6) % 3]);
      }
      if (k === 0) art(0, 0, [0.2, h * 0.6, h * 0.6], 0xfff0a0, { shape: 2, lift: 0.1 });
    },
    // 9 the inspector: passed, barely
    inspector(k, panel, art, w, h) {
      panel(k === 0 ? [['SITE INSPECTION', 0, 0.05, 1, 0.12, WHITE, 'GothamBold'], ['PASSED (BARELY)', 0, 0.82, 1, 0.12, SAFETY, 'GothamBold']] : [], 0x0c1a2e);
      if (k === 0) art(0, 0, [0.2, h * 0.4, h * 0.4], SAFETY, { shape: 2 });
      else for (let j = 0; j < 5; j++) art(0, -h * 0.3 + j * h * 0.14, [w * 0.6, h * 0.04, 0.1], 0x2a5aa8);
    },
  };
  for (const sc of SCENES) if (sc.art) dome(sc);
  // a sky screen across the ceiling (for riders flat on their backs)
  const sky = (x, z, w, d, y = G + 25.4) => {
    add([w + 1, 0.6, d + 1], [x, y + 0.4, z], 0x050505, 'Metal', { collide: 0 });
    add([w, 0.2, d], [x, y, z], SKY, 'Neon', { collide: 0 });
    for (let k = 0; k < 5; k++) add([w * 0.3, 0.1, 1.2], [x - w * 0.3 + ((k * 7) % 5) * w * 0.15, y - 0.12, z - d * 0.4 + k * d * 0.2], 0xf4f8ff, 'Neon', { collide: 0 });
  };


  // 1 the site office: a desk, plans, a hard-hat rack, the tour sign
  for (const z of [114, 142]) { box([1.6, 9, 1.6], [-441, G, z], HAZARD, 'Metal', { collide: 0 }); neon([1.6, 1.6, 1.6], [-441, G + 9.8, z], ORANGE, { shape: 3 }); light(-442, 8, z, ORANGE); }
  box([3, 3, 6], [-441.5, G, 120], 0x6a5038, 'Wood', { collide: 0 });
  add([2.6, 0.1, 5.4], [-441.5, G + 3.06, 120], 0x2a5aa8, 'SmoothPlastic', { collide: 0 });
  light(-444, 13, 128, 0xffe8c0);
  // 2 jackhammers and the concrete mixer: hammers pounding (props), the drum turning
  for (let k = 0; k < 4; k++) {
    const x = -514 + k * 6;
    box([4.4, 1, 4.4], [x, G, 166], CONCRETE, 'Concrete', { collide: 0 });
    occupied.push([x, 166, 3]);
  }
  box([8, 3, 6], [-505, G, 176], 0x2a2a2a, 'Metal', { collide: 0 });
  light(-505, 12, 160, AMBER);
  light(-520, 6, 168, ORANGE);
  // 3 the wrecking ball: a brick wall half down, rubble
  for (let k = 0; k < 8; k++) add([3, 2 + (k % 3) * 2, 3], [-554.5, G + 1 + (k % 3), 162 + k * 2.6 + (k > 3 ? 24 : 0)], 0x8a5a4a, 'Brick', { collide: 0, yaw: k * 0.3 });
  tagAt(data.tags.SteamVent, -552, G + 0.5, 172); tagAt(data.tags.SteamVent, -552, G + 0.5, 196);
  light(-550, 10, 182, AMBER);
  // 4 the excavation pit: a dark hole, shoring, a dump truck; a sky screen
  // overhead for when the rig tips you on your back
  add([28, 0.3, 14], [-505, G + 0.2, 224], 0x1a120c, 'Slate', { collide: 0 });
  for (const [x, z] of [[-531, 223], [-479, 223]]) { box([6, 4, 6], [x, G, z], HAZARD, 'Metal', { collide: 0 }); box([5, 3, 4], [x, G + 4, z + 1], 0x8a7a5a, 'Slate', { collide: 0 }); occupied.push([x, z, 5]); }
  sky(-505, 210, 18, 22);
  light(-505, 10, 214, AMBER);
  light(-505, 22, 210, SKY);
  // 5 the welding bay: steel frames, welders' arcs flickering
  for (const [x, z] of [[-455, 215], [-455, 249]]) {
    box([1.2, 18, 1.2], [x, G, z], STEEL, 'Metal', { collide: 0 });
    add([1, 1, 10], [x, G + 12, z + (z < 232 ? 5 : -5)], STEEL, 'Metal', { collide: 0 });
    neon([0.8, 0.8, 0.8], [x, G + 11.2, z + (z < 232 ? 3 : -3)], 0xd8ecff, { shape: 3 });
    tagAt(data.tags.Campfire, x, G + 11, z + (z < 232 ? 3 : -3));
    occupied.push([x, z, 3]);
  }
  light(-450, 16, 232, 0x8ab8ff);
  light(-452, 8, 232, 0xd8ecff);
  // 6 the scaffolding: tubes overhead, a plank hanging, planks falling (props)
  for (let k = 0; k < 5; k++) add([0.4, 0.4, 22], [-504 + k * 4, G + 21, 262], 0x9aa0a8, 'Metal', { collide: 0 });
  add([10, 0.5, 2], [-496, G + 15, 266], 0x8a6a40, 'WoodPlanks', { collide: 0, rot: [Math.cos(0.5), -Math.sin(0.5), 0, Math.sin(0.5), Math.cos(0.5), 0, 0, 0, 1] });
  light(-496, 12, 262, AMBER);
  // 7 the fuel tanker: the tank on its side, burning
  box([1.4, 1, 1.4], [-540, G, 244], DARK, 'Metal', { collide: 0 });
  add([16, 4.4, 4.4], [-540, G + 2.4, 264.5], 0xd8d4c8, 'Metal', { shape: 2, collide: 0 });
  for (const [x, z] of [[-546, 244], [-540, 243], [-534, 244], [-526, 264], [-532, 264], [-550, 264], [-556, 264]]) { box([1.4, 1, 1.4], [x, G, z], DARK, 'Metal', { collide: 0 }); neon([0.9, 4, 0.9], [x, G + 3, z], HOT); occupied.push([x, z, 2]); }
  light(-540, 8, 245, HOT);
  light(-528, 8, 255, ORANGE);
  // 8 the construction elevator and the top floor
  const shaft = (zc) => {
    for (const [dx, dz] of [[-6.2, -7], [5.8, -7], [-6.2, 7], [5.8, 7]]) box([0.8, 27, 0.8], [-572 + dx, G, zc + dz], HAZARD, 'Metal', { collide: 0 });
    for (const y of [6, 12.6, 20, 26]) {
      for (const dz of [-7, 7]) add([12, 0.5, 0.5], [-572.2, G + y, zc + dz], HAZARD, 'Metal', { collide: 0 });
      for (const dx of [-6.2, 5.8]) add([0.5, 0.5, 14], [-572 + dx, G + y, zc], HAZARD, 'Metal', { collide: 0 });
    }
    for (const dx of [-6.4, 6]) add([0.1, 24, 13], [-572 + dx, G + 13, zc], 0x8a9096, 'Metal', { collide: 0, trans: 0.7 }); // the cage mesh
    neon([0.8, 0.8, 0.8], [-565.8, G + 26.8, zc], ORANGE, { shape: 3 });
    light(-566, 20, zc, ORANGE);
    sign([0.2, 2.4, 6], [-565.6, G + 16, zc], HAZARD, 'Right', [['HOIST', 0, 0, 1, 0.55, BLACK], ['MAX LOAD: 1 RIG', 0, 0.58, 1, 0.42, BLACK, 'GothamBold']]);
  };
  shaft(238);
  shaft(108);
  // the top floor: a concrete deck on columns, unfinished steel, the sky
  add([19.4, 1, 116], [-569, DECK - 0.5, 172.5], CONCRETE, 'Concrete', { collide: 0 });
  for (let z = 120; z <= 226; z += 16) for (const x of [-578, -560.4]) box([1.4, DECK - 1 - G, 1.4], [x, G, z], CONCRETE, 'Concrete', { collide: 0 });
  for (let z = 118; z <= 226; z += 12) {
    box([0.6, 11, 0.6], [-560.6, DECK, z], 0x7a4a2a, 'Metal', { collide: 0 });
    add([0.4, 0.4, 12], [-560.6, DECK + 11, z + 6], 0x7a4a2a, 'Metal', { collide: 0 });
  }
  for (let z = 118; z < 228; z += 3) add([0.2, 0.06, 1.4], [-560.2, DECK + 0.03, z], (z / 3) % 2 ? BLACK : HAZARD, 'SmoothPlastic', { collide: 0 });
  add([0.15, 0.15, 110], [-559.8, DECK + 3.2, 172], ORANGE, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 3, 12], [B.x0 + T + 0.3, DECK + 4, 214], HAZARD, 'Right', [['FLOOR 40', 0, 0, 1, 0.6, BLACK], ['BENTON TOWER  ·  TOP OUT', 0, 0.6, 1, 0.4, BLACK, 'GothamBold']]);
  for (let z = 100; z < 246; z += 17) {
    sign([0.2, 11, 16.4], [B.x0 + T + 0.3, DECK + 6.5, z + 8], SKY, 'Right', [['', 0, 0, 1, 1, WHITE]], { glow: true });
    add([0.1, 3 + ((z * 7) % 5), 2.4], [B.x0 + T + 0.45, DECK + 2.5 + ((z * 7) % 5) / 2, z + 4], 0x2a3a4a, 'Metal', { collide: 0 });
    add([0.1, 5 + ((z * 3) % 4), 3], [B.x0 + T + 0.45, DECK + 3.5 + ((z * 3) % 4) / 2, z + 10], 0x3a4a5a, 'Metal', { collide: 0 });
  }
  for (let z = 128; z < 222; z += 17) sign([0.2, 9, 16.4], [-561.2, DECK + 6.5, z + 8], SKY, 'Left', [['', 0, 0, 1, 1, WHITE]], { glow: true });
  sky(-569, 172, 14, 70);
  // the floor below the top floor: site storage between the columns
  for (let z = 124; z < 224; z += 8) {
    const k = Math.round(z / 8) % 3;
    if (k === 0) { box([3.4, 0.5, 3.4], [-569, G, z], 0x8a6a40, 'Wood', { collide: 0 }); box([3, 2, 3], [-569, G + 0.5, z], 0xd8ccb0, 'Fabric', { collide: 0 }); }
    else if (k === 1) for (let j = 0; j < 6; j++) add([6, 0.25, 0.25], [-569, G + 0.3 + Math.floor(j / 3) * 0.3, z - 0.6 + (j % 3) * 0.6], 0x7a4a2a, 'Metal', { shape: 2, collide: 0, yaw: Math.PI / 2 });
    else { box([3, 2.6, 2], [-569, G, z], HAZARD, 'Metal', { collide: 0 }); neon([0.3, 0.3, 0.3], [-569, G + 2, z - 1.05], SAFETY, { shape: 3 }); }
  }
  for (let z = 124; z < 224; z += 25) neon([1.6, 0.4, 1.6], [-569, DECK - 1.2, z], 0xffd8a0, { shape: 5 });
  tagAt(data.tags.SteamVent, -563, DECK + 0.5, 150); tagAt(data.tags.SteamVent, -563, DECK + 0.5, 196);
  light(-572, DECK + 10, 200, 0xd8ecff);
  light(-572, DECK + 10, 140, 0xd8ecff);
  light(-572, 10, 172, AMBER);
  // 9 the inspector's office
  light(-516, 12, 50, 0xfff4d0);
  for (const [x, y, z, c] of [[-450, 16, 120, AMBER], [-498, 16, 160, AMBER], [-520, 16, 160, ORANGE], [-552, 16, 172, AMBER], [-490, 16, 205, AMBER],
    [-525, 16, 215, ORANGE], [-455, 16, 225, 0x8ab8ff], [-485, 16, 250, AMBER], [-540, 16, 250, HOT], [-540, 16, 62, 0xfff4d0]]) light(x, y, z, c);


  // ---- fill every empty bit of floor with the building site: cones,
  // rebar, cement bags, I-beams, cable drums, barriers and generators
  const free = (x, z, r) => !nearTrack(x, z, 10.5 + r) && !occupied.some(([ox, oz, or]) => (ox - x) ** 2 + (oz - z) ** 2 < (or + r) ** 2)
    && !(x > -449 && z > 60 && z < 116) && x < INNER - 2.5 && x > B.x0 + 4 && z > B.z0 + 4 && z < B.z1 - 4
    && ![[118, -565, -462], [182, -538, -468], [232, -560, -474]].some(([wz, xa, xb]) => Math.abs(z - wz) < r + 2.6 && x > xa - r - 2 && x < xb + r + 2)
    && !(Math.abs(x + 558) < r + 2.6 && z > 124 && z < 240)
    && !(x < -557 && z > 95 && z < 252 && (Math.abs(x + 578) < r + 1.5 || Math.abs(x + 560.4) < r + 1.5 || z > 228 || z < 118));
  const cone = (x, z) => { add([0.9, 1.4, 0.9], [x, G + 0.7, z], ORANGE, 'SmoothPlastic', { shape: 5, collide: 0 }); add([0.95, 0.25, 0.95], [x, G + 0.9, z], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 }); };
  const pieces = [
    (x, z) => { for (let k = 0; k < 5; k++) cone(x - 1.6 + k * 0.8, z + ((k * 7) % 3) - 1); },
    (x, z) => { box([4.6, 0.5, 1], [x, G, z - 1], 0x6a5038, 'Wood', { collide: 0 }); box([4.6, 0.5, 1], [x, G, z + 1], 0x6a5038, 'Wood', { collide: 0 }); for (let k = 0; k < 9; k++) add([5, 0.25, 0.25], [x, G + 0.65 + Math.floor(k / 3) * 0.3, z - 0.6 + (k % 3) * 0.6], 0x7a4a2a, 'Metal', { shape: 2, collide: 0 }); },
    (x, z) => { box([3.4, 0.5, 3.4], [x, G, z], 0x8a6a40, 'Wood', { collide: 0 }); for (let k = 0; k < 8; k++) box([1.5, 0.5, 0.9], [x - 0.8 + (k % 2) * 1.6, G + 0.5 + Math.floor(k / 4) * 0.5, z - 1.1 + (Math.floor(k / 2) % 2) * 1.1], 0xd8ccb0, 'Fabric', { collide: 0 }); },
    (x, z) => { for (let k = 0; k < 3; k++) { box([5, 0.3, 1.4], [x, G + k * 1.4, z + (k % 2) * 0.3], 0x7a4a2a, 'Metal', { collide: 0 }); box([5, 1.1, 0.3], [x, G + 0.3 + k * 1.4, z + (k % 2) * 0.3], 0x7a4a2a, 'Metal', { collide: 0 }); } },
    (x, z) => { add([1.6, 3, 3], [x, G + 1.5, z], 0x8a6a40, 'Wood', { shape: 2, collide: 0 }); add([1.4, 2.2, 2.2], [x, G + 1.5, z], 0x2a2a2a, 'Rubber', { shape: 2, collide: 0 }); },
    (x, z) => { for (let k = 0; k < 3; k++) { box([2.2, 1, 0.4], [x - 2.4 + k * 2.4, G + 0.6, z], k % 2 ? WHITE : ORANGE, 'SmoothPlastic', { collide: 0 }); box([0.3, 1.1, 0.3], [x - 2.4 + k * 2.4, G, z], 0x2a2a2a, 'Metal', { collide: 0 }); } },
    (x, z) => { box([3, 2.6, 2], [x, G, z], HAZARD, 'Metal', { collide: 0 }); for (let k = 0; k < 3; k++) neon([0.3, 0.3, 0.3], [x - 0.8 + k * 0.8, G + 2, z - 1.05], [SAFETY, AMBER, HOT][k], { shape: 3 }); },
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

  // ---- the vehicles: RIG 3, a four-seat bench on the end of a yellow robot arm
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
    p.push(pp(5, [3, 0.8, 3], [0, 1.8, 3.0], HAZARD, 'Metal')); // the turret
    p.push(pp(0, [2, 1.6, 2.4], [0, 2.2, 3.4], DARK, 'Metal'));
    p.push(pp(0, [2.6, 1.4, 3], [0, 1.9, -2.6], 0x3a3e44, 'Metal')); // the control pack
    p.push(pp(3, [0.5, 0.5, 0.5], [1.2, 2.7, -2.6], AMBER, 'Neon'));
    p.push(pp(3, [0.5, 0.5, 0.5], [-1.2, 2.7, -2.6], FUEL, 'Neon'));
    return p;
  };
  const L1 = 4.2, L2 = 4.2;
  const armA = () => [pp(2, [1.9, 1.9, 1.9], [0, 0, 0], DARK, 'Metal'), pp(0, [1.4, L1, 1.4], [0, L1 / 2, 0], HAZARD, 'Metal'), pp(0, [1.45, 0.3, 1.45], [0, L1 * 0.75, 0], BLACK, 'Metal')];
  const armB = () => [pp(2, [1.7, 1.6, 1.6], [0, 0, 0], DARK, 'Metal'), pp(0, [1.1, L2, 1.1], [0, L2 / 2, 0], HAZARD, 'Metal'), pp(3, [1.3, 1.3, 1.3], [0, L2, 0], DARK, 'Metal')];
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
  // the jackhammers, pounding, and the mixer drum turning
  for (let k = 0; k < 4; k++) addProp(`Hammer${k + 1}`, [pp(0, [0.5, 4, 0.5], [0, 0, 0], 0xb8bcc4, 'Metal'), pp(0, [1.6, 1.4, 1.6], [0, 2.4, 0], HAZARD, 'Metal'), pp(0, [2.4, 0.3, 0.3], [0, 3.4, 0], BLACK, 'Metal')], [-514 + k * 6, G + 3.4, 166], { kind: 'piston', amp: 0.5, freq: 22, phase: k * 1.3 });
  addProp('Mixer', [pp(2, [7, 5, 5], [0, 0, 0], ORANGE, 'Metal'), pp(0, [7.2, 0.5, 5.2], [0, 0, 0], 0x3a3a3a, 'Metal')], [-505, G + 5.6, 176], { kind: 'spin', speed: 2 });
  // the wrecking ball, swinging across in front of you
  addProp('WreckingBall', [pp(0, [0.3, 11, 0.3], [0, -5.5, 0], 0x2a2a2a, 'Metal'), pp(3, [2, 2, 2], [0, -11.6, 0], 0x1a1a1a, 'Metal')], [-551.8, G + 24.4, 182], { kind: 'swing', amp: 0.5, freq: 1.6 });
  // a steel beam swinging over the excavation pit on a crane hook, and the
  // excavator's bucket lunging
  addProp('Beam', [pp(0, [0.2, 6, 0.2], [0, -3, 0], 0x2a2a2a, 'Metal'), pp(0, [12, 1, 1], [0, -6.4, 0], 0x7a4a2a, 'Metal'), pp(3, [0.8, 0.8, 0.8], [0, -5.6, 0], HAZARD, 'Metal')], [-505, G + 24.6, 214], { kind: 'swing', axis: 'x', amp: 0.35, freq: 0.9 });
  addProp('Bucket', [pp(0, [3, 2.4, 2.4], [0, 0, 0], HAZARD, 'Metal'), pp(0, [3, 0.4, 0.8], [0, -1.2, -1.4], 0x2a2a2a, 'Metal')], [-505, G + 4, 228], { kind: 'lunge', dir: [-1, 0], reach: 4, period: 4.2 });
  // planks falling from the scaffolding, embers from the tanker
  for (let k = 0; k < 3; k++) addProp(`Plank${k + 1}`, [pp(0, [1, 0.3, 4], [0, 0, 0], 0x8a6a40, 'WoodPlanks')], [-499 + k * 3, G + 22, 263], { kind: 'fall', drop: 19, period: 2.4 + k * 0.6, phase: k * 0.33 });
  for (let k = 0; k < 3; k++) addProp(`Ember${k + 1}`, [pp(3, [0.8, 0.8, 0.8], [0, 0, 0], AMBER, 'Neon')], [-548 + k * 8, G + 20, k % 2 ? 266 : 242], { kind: 'fall', drop: 18, period: 1.8 + k * 0.4, phase: k * 0.27 });
  // the hall's beacon on RIG 3, and the tower crane's jib outside
  addProp('Beacon', [pp(0, [0.6, 0.6, 1.6], [0, 0, 0], ORANGE, 'Neon'), pp(5, [1, 0.4, 1], [0, -0.4, 0], DARK, 'Metal')], [-414, FLOOR + 16, 255], { kind: 'turn', speed: 6 });
  extras.CraneJib = { pivot: [988, G + 73, 258, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [
    pp(0, [3.4, 4, 3.4], [0, 1.6, 0], HAZARD, 'Metal'), pp(0, [3, 2.6, 3], [2.6, 0.6, 0], WHITE, 'Metal'), pp(0, [2.2, 1.6, 0.1], [2.6, 0.9, -1.55], 0x2a3a4a, 'Glass'),
    pp(0, [56, 1.6, 1.6], [30, 3, 0], HAZARD, 'Metal'), pp(0, [56, 0.3, 0.3], [30, 4.6, 0], HAZARD, 'Metal'),
    pp(0, [16, 1.4, 1.4], [-8, 3, 0], HAZARD, 'Metal'), pp(0, [4, 3, 3], [-14, 1.6, 0], CONCRETE, 'Concrete'),
    pp(0, [1.6, 8, 1.6], [0, 8, 0], HAZARD, 'Metal'), pp(0, [2, 1, 1.6], [40, 1.6, 0], DARK, 'Metal'), pp(0, [0.15, 14, 0.15], [40, -6, 0], 0x2a2a2a, 'Metal'),
    pp(0, [1.2, 1.2, 1.2], [40, -13.6, 0], HAZARD, 'Metal'), pp(0, [10, 0.8, 0.8], [40, -15, 0], 0x7a4a2a, 'Metal'),
  ] };
  props.push({ name: 'CraneJib', at: [988, G + 73, 258], kind: 'turn', speed: 0.12 });
  extrasNames.push(...props.map((p) => p.name));


  // ---- the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    Pv.setFromMatrixPosition(m4);
    stops.push(cfm(px0 + 1, PLAT, Pv.x - 726, -Math.PI / 2));
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
    motionsim: { H, scenes, props, level: true, arm: { shoulder: [0, 2.2, 3.0], wrist: [0, 1.0, 2.7], l1: L1, l2: L2, lift: 2.6, reach: 2.2, gain: 1.7 } },
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
    [at(-450, 128), 'sparks', [0, 3, -6]], [at(-505, 152), 'sparks', [0, 2, -8]], [at(-546, 182), 'sparks', [-3, 6, -6]],
    [at(-505, 210), 'sparks', [0, 6, -10]], [at(-465, 232), 'sparks', [3, 7, -6]], [at(-465, 236), 'sparks', [-3, 7, -6]], [at(-496, 255), 'sparks', [0, 8, -8]],
    [at(-540, 255), 'explosion', [0, 6, -12]], [at(-540, 255), 'fire', [-5, 0, 0]], [at(-532, 255), 'fire', [5, 0, 0]], [at(-572, 113), 'sparks', [0, -2, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Construction Runaway', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'darkride', carStyle: 'coaster',
    description: "Take a 'gentle' tour of the Benton Tower site on RIG 3 - a bench on a giant robot arm - and hold on as it runs away with you: jackhammers, the mixer, a wrecking ball (it rolls you onto your side), the excavation pit (it tips you halfway upside down), the welding bay, collapsing scaffolding and a burning tanker. Then the whole rig rides the elevator up to the 40th floor, flips you under the sky, and drops back down. Fully indoors.",
    baseWait: 85, origin, entrance: [MX(-392.5, dIn + 7), 0, MZ(-392.5)], exit: [MX(-382, dOut), 0, MZ(-382)], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [HAZARD, BLACK, ORANGE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Construction Runaway is open - hard hats on!', 'RIG 3 goes upside down and up the elevator. Enjoy!'];
  return { ride, placed, gate: { x: gx, z: 226 }, indoor: { x0: MX(0, B.z0), x1: MX(0, B.z1), z0: MZ(B.x1), z1: MZ(B.x0) } };
}

// a toast the first time you walk up to the new ride
export class ConstructionRunawaySite {
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
      this.hooks.toast('CONSTRUCTION RUNAWAY is now open! RIG 3 rolls you sideways, tips you upside down and takes you up the elevator to the 40th floor. Hard hats on - through the gate behind Throttle Works.', 'reward');
    }
  }
}
