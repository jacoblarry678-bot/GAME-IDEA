// Zero Space: a 4th-dimension roller coaster at the Benton Orbital Launch
// Facility, south of Fast & Furious and Stranger Things (down the walk
// between them and through the warp gate). Riders sit on wings either side
// of the track, and the seats turn head over heels on their own: lying
// back facing the sky up a 58-stud lift beside a rocket on its launch
// tower, face-first down a near-vertical drop and on round in a full
// somersault, flipping again over the raven turn through the warp ring, a
// zero-g roll through the asteroids, airtime hills across the crater
// field, a half flip in the turn, and a backflip home.
//
// The seats' angle along the track is the ride's "flip" curve (rides.js);
// every support and piece of scenery is placed outside the tube the
// turning seats sweep.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'ZeroSpace';
const SITE = { x0: 470, x1: 900, z0: -660, z1: -400 };
const GATE = { x0: 597, x1: 609 }; // in the site's north wall (the old wall south of Stranger Things)
const G = 0.1;
const CARS = 6, SPACING = 5.5;
const PURPLE = 0x8a4aff, CYAN = 0x30e0ff, WHITE = 0xf0f2f6, SILVER = 0xb8bcc4, ORANGE = 0xff7a20, DARK = 0x14161c, GOLD = 0xf0c040;
const TRACK_COLOR = 0xe8e8f0;
const TAU = Math.PI * 2;

const CIRCUIT = [
  [610, 2, -432, 2], [626, 2.5, -432, 4],
  // the lift, beside the rocket
  [642, 8, -432, 4], [656, 22, -432, 4], [670, 38, -432, 4], [684, 52, -432, 4], [694, 58, -432, 5],
  [704, 59, -432, 7], [714, 56, -433, 12],
  // the drop
  [724, 44, -434, 20], [734, 26, -435, 28], [746, 9, -437, 33], [762, 4, -440, 34], [780, 4.5, -444, 33],
  // the raven turn, through the warp ring
  [798, 18, -452, 26], [812, 32, -464, 18], [818, 39, -480, 14], [818, 28, -498, 22], [816, 9, -516, 30],
  // the zero-g roll through the asteroids
  [815, 11, -534, 28], [814, 16, -550, 24], [814, 11, -566, 28], [812, 7, -582, 31],
  // round the south-east, airtime hills over the crater field
  [804, 9, -604, 28], [786, 11, -624, 26], [760, 12, -636, 25],
  [734, 24, -638, 18], [708, 9, -638, 27], [682, 20, -637, 20], [656, 7, -634, 27],
  // round the south-west, past the dishes, and the backflip home
  [624, 8, -626, 25], [598, 11, -610, 23], [584, 14, -586, 21], [580, 16, -562, 19],
  [588, 17, -540, 18], [606, 16, -526, 18], [632, 14, -520, 18], [660, 12, -522, 18],
  [680, 10, -508, 17], [686, 9, -488, 16], [682, 8, -470, 15],
  [664, 7, -462, 14], [636, 6, -461, 13], [600, 5, -460, 12], [566, 4.5, -458, 10],
  [540, 4, -452, 8], [526, 3.5, -442, 6], [532, 3, -433, 5], [548, 2.5, -432, 4], [570, 2, -432, 3], [590, 2, -432, 2],
];

export function buildZeroSpace(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
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
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x3a3c44, 'Pavement');
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  // the north side: a new wall west of the gate; east of it the old wall
  // south of Stranger Things (and Throttle Works beyond) gets the gate
  data.hidden = data.hidden || [];
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - SITE.z1) < 0.6 && Math.abs(p[4] - 703) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(SITE.x0, SITE.z1, GATE.x0, SITE.z1);
  wallSeg(GATE.x1, SITE.z1, 808, SITE.z1);
  wallSeg(SITE.x1, SITE.z1, SITE.x1, SITE.z0);
  wallSeg(SITE.x1, SITE.z0, SITE.x0, SITE.z0);
  wallSeg(SITE.x0, SITE.z0, SITE.x0, SITE.z1);
  // the warp gate: a ring of light round the way in
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * TAU, y = 9 + Math.sin(a) * 9;
    if (y < 0.6) continue;
    neon([0.7, 0.7, 0.7], [gx + Math.cos(a) * 9, G + y, SITE.z1], k % 2 ? CYAN : PURPLE, { shape: 3 });
  }
  for (const x of [GATE.x0 - 0.8, GATE.x1 + 0.8]) box([1.6, 16, 1.6], [x, G, SITE.z1], SILVER, 'Metal');
  add([GATE.x1 - GATE.x0 + 3, 2.4, 1.2], [gx, G + 16.2, SITE.z1], DARK, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 + 2, 2, 0.2], [gx, G + 16.2, SITE.z1 + 0.7], DARK, 'Back', [['ZERO SPACE', 0, 0, 1, 1, CYAN]], { glow: true });
  // the walk: on down the path between Fast & Furious and Stranger Things
  for (const [a, b] of [[[603, -283], [603, SITE.z1]], [[603, SITE.z1], [603, SITE.z1 - 6]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    W.add([8, 0.4, len + 8], [(a[0] + b[0]) / 2, 0.22, (a[1] + b[1]) / 2], 0x5a5c66, 'Pavement', { collide: 0 });
    LINES.push([new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])]);
  }

  // ======== the track, and the tube the turning seats sweep
  const track = makeTrack(CIRCUIT, { rolls: [{ from: CIRCUIT.findIndex((p) => p[0] === 815 && p[2] === -534), to: CIRCUIT.findIndex((p) => p[0] === 812 && p[2] === -582), h: 0.6 }] });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
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
  // the wings reach 1.9 to 4.9 out on either side and turn all the way
  // round (a radius of 3); the car's hub runs on the rails between them
  const clearPt = (x, y, z, skipS = null) => {
    for (const f of near(x, z)) {
      if (skipS !== null && Math.abs(f[12] - skipS) < 1.5) continue;
      const dx = x - f[0], dy = y - f[1], dz = z - f[2];
      if (Math.abs(dy) > 8) continue;
      const lz = f[9] * dx + f[10] * dy + f[11] * dz;
      if (Math.abs(lz) > 3.1) continue;
      const lx = f[3] * dx + f[4] * dy + f[5] * dz, ly = f[6] * dx + f[7] * dy + f[8] * dz;
      const ax = Math.abs(lx);
      if (ax >= 1.8 && ax < 5 && Math.hypot(ly, lz) < 3.1) return false;
      if (ax < 1.8 && ly > -0.6 && ly < 1.4 && Math.abs(lz) < 3) return false;
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
  // supports: white columns from the ground up under the spine
  let supports = 0;
  for (let s = 8; s < track.length - 6; s += 8) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.88) continue;
    const foot = P.clone().addScaledVector(U, -1.6);
    if (foot.y < 2.4) continue;
    const ground = new THREE.Vector3(foot.x, G, foot.z);
    if (!clearSeg(ground, foot, s)) continue;
    add([1.2, foot.y - G, 1.2], [foot.x, (foot.y + G) / 2, foot.z], WHITE, 'Metal', { shape: 5, collide: 0 });
    if (foot.y > 20) add([2.4, 0.6, 2.4], [foot.x, G + 0.3, foot.z], SILVER, 'Concrete', { collide: 0 });
    supports++;
  }

  // ======== the plaza and the line: the launch facility
  const ROWZ = [-409, -414, -419];
  const XL = 534, XR = 622;
  const fwd = [[603, SITE.z1 + 8], [603, -406], [XR, ROWZ[0]], [XL, ROWZ[0]], [XL, ROWZ[1]], [XR, ROWZ[1]], [XR, ROWZ[2]], [XL, ROWZ[2]], [XL, -424], [596, -424]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], G);
  const railX = (a, b, z) => {
    add([b - a, 0.22, 0.22], [(a + b) / 2, G + 3.1, z], CYAN, 'Neon', { collide: 0 });
    add([b - a, 0.16, 0.16], [(a + b) / 2, G + 1.8, z], SILVER, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((b - a) / 6));
    for (let k = 0; k <= n; k++) box([0.3, 3.2, 0.3], [a + ((b - a) * k) / n, G, z], SILVER, 'Metal');
  };
  railX(XL + 4, XR + 3, (ROWZ[0] + ROWZ[1]) / 2);
  railX(XL - 3, XR - 4, (ROWZ[1] + ROWZ[2]) / 2);
  railX(XL + 4, XR + 3, (ROWZ[2] - 424) / 2);
  add([XR - XL + 10, 0.12, 22], [(XL + XR) / 2, G + 0.06, -415], 0x2a2c3a, 'SmoothPlastic', { collide: 0 });
  // the entrance sign and the wait time
  box([0.4, 7, 0.4], [612, G, -406], SILVER, 'Metal');
  sign([9, 2.6, 0.2], [612, G + 7.6, -406], DARK, 'Back', [['ZERO SPACE', 0, 0, 1, 0.6, CYAN], ['4TH DIMENSION COASTER  ·  ENTRANCE', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [588, G, -406], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [588, G + 9, -406], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 101, cf: cf(598, G, -408, Math.PI) });
  // an astronaut on a plinth by the line (an original Benton suit)
  const ax = 634, az = -412;
  box([4, 2, 4], [ax, G, az], SILVER, 'Concrete');
  box([1.6, 2.4, 1.2], [ax, G + 4.4, az], WHITE, 'SmoothPlastic', { collide: 0 });
  for (const sx of [-1, 1]) {
    box([0.7, 2.4, 0.7], [ax + sx * 0.5, G + 2, az], WHITE, 'SmoothPlastic', { collide: 0 });
    add([0.6, 2, 0.6], [ax + sx * 1.15, G + 5.6, az], WHITE, 'SmoothPlastic', { collide: 0, rot: RZ(sx * 0.3) });
  }
  add([1.8, 1.8, 1.8], [ax, G + 7.6, az], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 });
  add([1.3, 0.9, 0.3], [ax, G + 7.7, az + 0.85], GOLD, 'Glass', { collide: 0 });
  add([1.4, 1.8, 0.8], [ax, G + 5, az - 0.9], SILVER, 'Metal', { collide: 0 });
  add([0.3, 4, 0.3], [ax + 1.5, G + 8.2, az], SILVER, 'Metal', { collide: 0 });
  add([1.8, 1.1, 0.1], [ax + 2.4, G + 9.6, az], PURPLE, 'SmoothPlastic', { collide: 0 });
  light(ax, 6, az + 2, CYAN);

  // ======== the station: the launch hangar
  for (let x = 540; x <= 616; x += 12) for (const z of [-420.6, -443.4]) box([0.8, 12, 0.8], [x, G, z], WHITE, 'Metal', { collide: z < -430 ? 1 : 0 });
  add([80, 0.8, 25], [578, G + 12.4, -432], WHITE, 'Metal', { collide: 0 });
  neon([80, 0.3, 0.3], [578, G + 12, -419.6], CYAN);
  neon([80, 0.3, 0.3], [578, G + 12, -444.4], PURPLE);
  add([76, 0.3, 4.6], [578, G + 0.15, -424.4], 0x5a5c66, 'DiamondPlate', { collide: 0 });
  add([76, 0.1, 0.5], [578, G + 0.32, -426.5], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  sign([30, 3, 0.3], [576, 10, -420.2], DARK, 'Back', [['LAUNCH BAY 4', 0, 0, 1, 0.6, CYAN], ['T-MINUS 10  ·  ARMS ON THE HARNESS', 0, 0.6, 1, 0.4, ORANGE, 'GothamBold']], { glow: true });
  const con = [540, -423.5];
  box([1.4, 3, 2.4], [con[0], G, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 6; k++) neon([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 1 + k * 0.4], [CYAN, ORANGE, PURPLE][k % 3]);
  sign([10, 2, 0.2], [546, 6, -420.2], DARK, 'Back', [['MISSION CONTROL', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  light(578, 10, -430, 0xd8e8ff);
  light(600, 8, -428, CYAN);

  // ======== the rocket on its launch tower, beside the lift
  const rk = [664, -414];
  SB([1.2, 62, 1.2], [rk[0] - 6, G, rk[1]], 0x8a2a2a, 'Metal', { collide: 0 });
  SB([1.2, 62, 1.2], [rk[0] - 6, G, rk[1] - 5], 0x8a2a2a, 'Metal', { collide: 0 });
  for (let y = 6; y < 62; y += 6) S([1, 0.6, 6], [rk[0] - 6, G + y, rk[1] - 2.5], 0x8a2a2a, 'Metal', { collide: 0 });
  for (const y of [20, 40]) S([5, 0.6, 1], [rk[0] - 3.5, G + y, rk[1]], 0x8a2a2a, 'Metal', { collide: 0 });
  SB([6, 48, 6], [rk[0], G + 4, rk[1]], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 });
  for (const y of [14, 30, 46]) S([6.2, 1, 6.2], [rk[0], G + y, rk[1]], DARK, 'Metal', { shape: 5, collide: 0 });
  S([4.4, 4, 4.4], [rk[0], G + 54, rk[1]], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 });
  S([2.6, 4, 2.6], [rk[0], G + 58, rk[1]], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 });
  S([1.2, 3, 1.2], [rk[0], G + 61.5, rk[1]], ORANGE, 'SmoothPlastic', { shape: 5, collide: 0 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    S([0.5, 8, 3.4], [rk[0] + Math.cos(a) * 3.6, G + 6, rk[1] + Math.sin(a) * 3.6], ORANGE, 'SmoothPlastic', { collide: 0, yaw: a });
  }
  S([3.6, 3, 3.6], [rk[0], G + 2.5, rk[1]], 0x2a2a2e, 'Metal', { shape: 5, collide: 0 });
  SN([3, 0.8, 3], [rk[0], G + 0.9, rk[1]], ORANGE, { shape: 5 });
  sign([0.2, 16, 3], [rk[0] + 3.05, G + 28, rk[1]], WHITE, 'Right', [['BENTON', 0, 0, 1, 1, 0x1a2a6a]], { glow: false });
  data.tags.SteamVent.push([rk[0], G + 0.6, rk[1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(rk[0], 3, rk[1] + 3, ORANGE);

  // ======== rings of light up the lift, and the warp ring over the raven
  const ring = (s, radius, color, n = 34) => {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const q = P.clone().addScaledVector(R, Math.cos(a) * radius).addScaledVector(U, Math.sin(a) * radius);
      if (q.y > G + 0.4) SN([0.55, 0.55, 0.55], [q.x, q.y, q.z], typeof color === 'function' ? color(k) : color, { shape: 3 });
    }
  };
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  for (const x of [646, 662, 678, 692]) ring(sAt(x, -432), 7.4, (k) => (k % 2 ? CYAN : PURPLE));
  for (const ds of [-4, 0, 4]) ring(sAt(818, -480) + ds, 8, (k) => [PURPLE, CYAN, WHITE][k % 3], 44);
  light(818, 44, -480, PURPLE);

  // ======== the worlds: planets, a ringed giant, asteroids, craters, dishes
  const planet = (x, y, z, r, color, ringColor = null) => {
    SB([2, y - r, 2], [x, G, z], SILVER, 'Metal', { shape: 5, collide: 0 });
    if (S([r * 2, r * 2, r * 2], [x, y, z], color, 'SmoothPlastic', { shape: 3, collide: 0 }) < 0) return;
    if (ringColor) for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; S([1.2, 0.3, 1.2], [x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 0.25, z + Math.sin(a) * r * 1.7 * 0.4], ringColor, 'Neon', { collide: 0 }); }
  };
  planet(760, 26, -500, 9, 0xd8a860, 0xf0d8a0);
  planet(720, 14, -560, 6, 0x3a8ad8);
  planet(640, 10, -590, 5, 0xc84a2a);
  planet(860, 10, -640, 4, 0xd8d8d8);
  planet(520, 12, -520, 6, 0x6a4ac8, CYAN);
  // asteroids round the zero-g roll
  for (let k = 0; k < 14; k++) {
    const x = 790 + (k % 2) * 52 - 12 + ((k * 7) % 9), z = -530 - k * 3.4, y = 8 + ((k * 5) % 12);
    if (SB([0.3, y - 1, 0.3], [x, G, z], SILVER, 'Metal', { collide: 0 }) < 0) continue;
    S([2.2 + (k % 3), 1.8 + (k % 2), 2 + (k % 3) * 0.6], [x, G + y, z], 0x6a6258, 'Slate', { collide: 0, rot: RZ(k * 0.7) });
  }
  // the crater field under the airtime hills
  for (const [x, z, r] of [[720, -620, 7], [690, -650, 5], [650, -615, 6], [770, -650, 5], [610, -640, 4]]) {
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; SB([2.2, 1.2, 2.2], [x + Math.cos(a) * r, G, z + Math.sin(a) * r], 0x6a6a70, 'Slate', { collide: 0 }); }
    S([r * 1.6, 0.1, r * 1.6], [x, G + 0.05, z], 0x2a2c34, 'Slate', { collide: 0 });
  }
  // a satellite dish array in the south-west
  for (const [x, z] of [[540, -600], [556, -626], [520, -640], [620, -560]]) {
    SB([0.8, 6, 0.8], [x, G, z], SILVER, 'Metal', { collide: 0 });
    S([7, 7, 0.6], [x, G + 9, z], WHITE, 'Metal', { shape: 2, collide: 0, rot: [0, 0.5, 0.866, 0, 0.866, -0.5, -1, 0, 0] });
    SN([0.5, 0.5, 0.5], [x, G + 10.5, z - 1.4], 0xff3030, { shape: 3 });
  }
  // lamps and colored floods all round
  for (const [x, z] of [[500, -420], [660, -404 - 6], [740, -420], [880, -430], [880, -540], [880, -620], [760, -600], [600, -650], [490, -560], [500, -640]]) {
    if (!clearPt(x, 6, z) || !clearPt(x, 11, z)) continue;
    box([0.5, 11, 0.5], [x, G, z], DARK, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 11.4, z], [CYAN, PURPLE][Math.round(x / 10) % 2], 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 11.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (let s = 20; s < track.length - 20; s += 28) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.max(4, P.y - 5), P.z, s % 56 ? PURPLE : CYAN); }

  // ======== the cars: a hub on the rails and a wing of two seats each side
  // (the hub and wings are round about the axle, so they look the same
  // however the seats are turned)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const carParts = (k) => {
    const c = [PURPLE, CYAN, ORANGE][k % 3];
    return [
      pp(2, [2.8, 1.3, 1.3], [0, 0.6, 0], SILVER, 'Metal'),
      pp(2, [3.2, 0.5, 0.5], [0, 0.6, 0], c, 'Neon'),
      ...[-1, 1].flatMap((sx) => [
        pp(2, [3.4, 0.7, 0.7], [sx * 3.1, 0.6, 0], DARK, 'Metal'),
        ...[2.7, 3.9].flatMap((ox) => [
          pp(0, [1.1, 0.35, 1.1], [sx * ox, -0.2, -0.05], DARK, 'Fabric'),
          pp(0, [1.1, 2.6, 0.35], [sx * ox, 0.9, 0.55], c, 'SmoothPlastic'),
          pp(0, [1.2, 0.3, 0.4], [sx * ox, 2.25, 0.55], WHITE, 'SmoothPlastic'),
        ]),
      ]),
    ];
  };
  const seatList = () => [-3.9, -2.7, 2.7, 3.9].map((x) => [x, -0.025 + 1.3, -0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]); // 1.3 above the cushion
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
    stops.push(cf(P.x, G, -425.6, 0));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2, 3], [4, 5, 6]],
    console: cf(con[0], G, con[1], 0), operator: cf(con[0], G, con[1] + 1.4, 0),
    homes: [cf(570, G, -423, 0), cf(600, G, -423, 0)],
    exit: cf(612, G, -423, -Math.PI / 2),
  };

  // ======== the ride, and the seats' flip curve
  const origin = [700, 0, -540];
  // anchors: [where on the track, the seats' angle] (+ lies back, - pitches forward)
  const F = [
    [610, -432, 0], [642, -432, 0], [670, -432, 1.1], [694, -432, 1.1], [714, -433, 0],
    [734, -435, -1.5], [762, -440, -3.3], [780, -444, -TAU],
    [812, -464, -TAU - Math.PI], [818, -498, -2 * TAU], [804, -604, -2 * TAU],
    [734, -638, -2 * TAU + 0.9], [708, -638, -2 * TAU - 0.6], [682, -637, -2 * TAU + 0.9], [656, -634, -2 * TAU],
    [598, -610, -2 * TAU - Math.PI], [580, -562, -3 * TAU], [632, -520, -3 * TAU], [660, -522, -3 * TAU + Math.PI], [686, -488, -2 * TAU],
    [600, -460, -2 * TAU],
  ];
  const flip = F.map(([x, z, a]) => [sAt(x, z), a]);
  flip[0][0] = 0;
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    flip,
  };
  data.rides.push(ride);
  const at = (x, z) => track.times[track.cum.indexOf(sAt(x, z))] / ride.duration;
  const cues = [[at(746, -437), 'fire', [0, -3, 0]], [at(816, -516), 'sparks', [0, 4, 0]], [at(708, -638), 'explosion', [0, -6, 4]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Zero Space', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'A 4th-dimension coaster at the Benton Orbital Launch Facility: your seat hangs on a wing beside the track and turns head over heels on its own. Lie back facing the sky up the 58-stud lift beside the rocket, go face-first down the drop and all the way round, flip through the warp ring at the top of the raven turn, roll through the asteroids, float over the crater field and backflip home.',
    baseWait: 70, origin, entrance: [612, 0, -406], exit: [596, 0, SITE.z1 + 6], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, PURPLE, CYAN], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Zero Space is open - your seat flips on its own!', 'T-minus ten... keep your arms on the harness!'];
  return { ride, gate: { x: gx, z: SITE.z1 }, supports };
}

// a toast the first time you come near the new ride
export class ZeroSpaceSite {
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
      this.hooks.toast('NEW: Zero Space, a 4th-dimension coaster - your seat flips head over heels! Through the warp gate, south of Fast & Furious.', 'reward');
    }
  }
}
