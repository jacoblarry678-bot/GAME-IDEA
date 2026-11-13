// Neon Getaway: The Port Benton Heist, an indoor spinning coaster in a big
// show building south of RV Van Run (through a gate in RV Van Run's south
// wall). The queue winds through the lobby of the Port Benton Savings &
// Loan; you board a round getaway car in the garage and the heist is on:
// past the open vault, up the parking garage with the cops' lights behind
// you, round the rooftop hairpins under a police helicopter (where the car
// is free to spin), a plunge into the swamp, Sunset Beach, through the
// roadblock (with a bang), past the marina's yacht, and back to the garage.
// Every car turns freely on its chassis the whole way round: the turns spin
// it up (each car a little differently) and it slows on its own.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'NeonGetaway';
const SITE = { x0: 1006, x1: 1250, z0: 0, z1: 234 };
const B = { x0: 1024, x1: 1236, z0: 8, z1: 198, H: 36 };
const DOOR_IN = 1034, DOOR_OUT = 1190;
const RVGATE = { x0: 1007, x1: 1023 }; // in RV Van Run's south wall (z 236)
const G = 0.1;
const CARS = 4, SPACING = 6.5;
const PINK = 0xff3a9a, TEAL = 0x20e0d0, PURPLE = 0x9a4aff, ORANGE = 0xff8a2a, SUN = 0xffc040, WHITE = 0xf4f4f0, BLACK = 0x101012;
const TRACK_COLOR = 0x1a8a9a;

// the circuit (x, y, z of the rails, and the speed there), from the station
const CIRCUIT = [
  [1112, -0.5, 178, 2], [1096, -0.5, 178, 5],
  // out of the garage, past the vault, and up the parking garage lift
  [1078, 0.5, 174, 6], [1068, 2, 160, 6], [1066, 4, 146, 5], [1066, 12, 128, 4], [1066, 20, 110, 4], [1066, 26, 94, 4],
  // the rooftops: four rows of hairpins, the cars free to spin
  [1069, 26.5, 85, 6], [1078, 26.5, 80.5, 8],
  [1100, 26, 80, 9], [1150, 25.5, 80, 10], [1185, 25, 80, 9],
  [1194, 25, 78.5, 7], [1199, 25, 74, 6], [1194, 25, 69.5, 7],
  [1185, 25, 68, 8], [1160, 23, 68, 11], [1130, 21.5, 68, 12], [1100, 22, 68, 10], [1090, 22, 68, 8],
  [1081, 22, 66.5, 6], [1076, 22, 62, 6], [1081, 22, 57.5, 6],
  [1090, 22, 56, 8], [1120, 20, 56, 11], [1160, 18.5, 56, 12], [1185, 18, 56, 9],
  [1194, 18, 54.5, 7], [1199, 18, 50, 7], [1194, 18, 45.5, 7],
  // the plunge into the swamp
  [1185, 18, 44, 9], [1165, 16, 44, 12], [1140, 7, 44, 19], [1112, 3, 44, 22],
  [1084, 3, 40, 20], [1062, 3.5, 30, 18], [1068, 4, 20, 17],
  // Sunset Beach, then north through the roadblock
  [1095, 4.5, 18, 17], [1130, 5, 20, 16], [1165, 5, 18, 16], [1198, 5.5, 22, 15], [1218, 6, 36, 14],
  [1222, 6.5, 58, 13], [1220, 7, 84, 12], [1214, 7, 100, 11],
  // the marina, and home to the garage
  [1196, 6, 110, 11], [1160, 5, 112, 12], [1124, 4.5, 110, 12], [1104, 4, 118, 11],
  [1098, 4, 132, 10], [1110, 4, 142, 10], [1140, 4, 146, 10], [1175, 4, 148, 10], [1196, 3.5, 156, 9],
  [1198, 2.5, 170, 8], [1186, 0.5, 178, 6], [1160, -0.5, 178, 4], [1140, -0.5, 178, 3],
];

export function buildNeonGetaway(data) {
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
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x4a6a34, 'Grass');
  // a gate in RV Van Run's south wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 236) < 0.6 && Math.abs(p[4] - 1127) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(1004, 236, RVGATE.x0, 236);
  wallSeg(RVGATE.x1, 236, 1250, 236);
  wallSeg(1004, SITE.z0, SITE.x1, SITE.z0);
  wallSeg(SITE.x1, SITE.z0, SITE.x1, 236);
  const gx = (RVGATE.x0 + RVGATE.x1) / 2;
  // the gate: two neon pylons and a sign each way
  for (const x of [RVGATE.x0 + 0.8, RVGATE.x1 - 0.8]) {
    box([1.4, 16, 1.4], [x, G, 236], 0x1a1a1c, 'Metal');
    neon([0.3, 15, 0.3], [x, G + 8, 236 - 0.8], PINK);
    neon([0.3, 15, 0.3], [x, G + 8, 236 + 0.8], TEAL);
  }
  add([RVGATE.x1 - RVGATE.x0, 2.6, 1], [gx, G + 15, 236], 0x1a1a1c, 'Metal', { collide: 0 });
  sign([RVGATE.x1 - RVGATE.x0 - 1, 2.2, 0.2], [gx, G + 15, 236.6], 0x1a1a1c, 'Back', [['NEON GETAWAY', 0, 0, 1, 1, PINK]], { glow: true });
  sign([RVGATE.x1 - RVGATE.x0 - 1, 2.2, 0.2], [gx, G + 15, 235.4], 0x1a1a1c, 'Front', [['RV VAN RUN', 0, 0, 1, 1, SUN]], { glow: true });
  // the walks: from RV Van Run's path, through the gate, along the front
  const route = [[1014, 265], [1014, 236], [1014, 212], [DOOR_IN, 212], [DOOR_IN, B.z1 + 2]];
  const exitRoute = [[DOOR_OUT, B.z1 + 2], [DOOR_OUT, 212], [DOOR_IN, 212]];
  for (const r of [route, exitRoute]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0xd8c8b0, 'Pavement', { yaw, collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }

  // ======== the show building: pink stucco, teal trim, neon on the roofline
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, STUCCO = 0xf0b8c8;
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], STUCCO, 'Concrete');
  box([T, B.H, B.z1 - B.z0], [B.x1 - T / 2, G, cz], STUCCO, 'Concrete');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], STUCCO, 'Concrete');
  const doors = [DOOR_IN, DOOR_OUT];
  let xa = B.x0;
  for (const d of doors) {
    box([d - 3.5 - xa, B.H, T], [(xa + d - 3.5) / 2, G, B.z1 - T / 2], STUCCO, 'Concrete');
    box([7, B.H - 10, T], [d, G + 10, B.z1 - T / 2], STUCCO, 'Concrete');
    xa = d + 3.5;
  }
  box([B.x1 - xa, B.H, T], [(xa + B.x1) / 2, G, B.z1 - T / 2], STUCCO, 'Concrete');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0xe8e4dc, 'Concrete', { collide: 0 });
  // teal base, a white band, and pink and teal neon under the roofline
  for (const [w, d, x, z] of [[0.3, B.z1 - B.z0, B.x0 - 0.2, cz], [0.3, B.z1 - B.z0, B.x1 + 0.2, cz], [B.x1 - B.x0, 0.3, cx, B.z0 - 0.2], [B.x1 - B.x0, 0.3, cx, B.z1 + 0.2]]) {
    add([w, 3, d], [x, G + 1.5, z], 0x2aa8a0, 'Concrete', { collide: 0 });
    add([w, 1.2, d], [x, G + 28, z], WHITE, 'Concrete', { collide: 0 });
    neon([w + 0.1, 0.5, d + 0.1], [x, G + 33.4, z], PINK);
    neon([w + 0.1, 0.5, d + 0.1], [x, G + 32.2, z], TEAL);
  }
  // the front: the big sign
  const F = B.z1 + 0.5;
  sign([86, 9, 0.4], [1120, G + 21, F], 0x14101c, 'Back', [['NEON GETAWAY', 0, 0.02, 1, 0.62, PINK], ['THE PORT BENTON HEIST  ·  A SPINNING COASTER', 0, 0.68, 1, 0.28, TEAL, 'GothamBold']], { glow: true });
  for (const [y, c] of [[16, TEAL], [26, PINK]]) neon([86, 0.4, 0.3], [1120, G + y, F + 0.2], c);
  // the bank front round the entrance: columns, a pediment, steps
  for (let k = 0; k < 6; k++) {
    const x = DOOR_IN - 10 + k * 4;
    if (Math.abs(x - DOOR_IN) < 4) continue;
    box([1.4, 13, 1.4], [x, G, B.z1 + 2.2], WHITE, 'Concrete', { shape: 5 });
  }
  add([24, 1.4, 4], [DOOR_IN, G + 13.7, B.z1 + 2], WHITE, 'Concrete', { collide: 0 });
  add([24, 3, 3.6], [DOOR_IN, G + 15.9, B.z1 + 2], WHITE, 'Concrete', { shape: 1, collide: 0, rot: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  sign([20, 1.6, 0.2], [DOOR_IN, G + 11.6, B.z1 + 0.9], 0x1a3a4a, 'Back', [['PORT BENTON SAVINGS & LOAN', 0, 0, 1, 1, SUN, 'GothamBold']], { glow: true });
  for (let k = 0; k < 3; k++) box([22 - k * 2, 0.3, 2 - k * 0.5], [DOOR_IN, G + k * 0.3, B.z1 + 4.4 - k * 0.5], 0xe8e4dc, 'Concrete', { collide: 0 });
  // the exit, and a canopy
  add([9, 0.5, 6], [DOOR_OUT, G + 10.4, B.z1 + 3], 0x1a1a1c, 'Metal', { collide: 0 });
  sign([6, 1.2, 0.2], [DOOR_OUT, G + 11.4, B.z1 + 0.8], 0x1a1a1c, 'Back', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  // palms along the front, a getaway car, a cruiser on its tail, lamps
  const palm = (x, z, h = 12, lean = 0.08) => {
    for (let k = 0; k < 6; k++) add([0.9 - k * 0.06, h / 6 + 0.1, 0.9 - k * 0.06], [x + lean * k * h / 6, G + (k + 0.5) * h / 6, z], 0x8a6a4a, 'Wood', { shape: 5, collide: k === 0 ? 1 : 0 });
    const tx = x + lean * h, ty = G + h;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      add([0.3, 0.4, 4.4], [tx + c * 1.9, ty - 0.6, z + s * 1.9], 0x3a8a3a, 'Grass', { collide: 0, yaw: Math.atan2(c, s), rot: null });
    }
    add([1, 1, 1], [tx, ty, z], 0x5a4a2a, 'Wood', { shape: 3, collide: 0 });
  };
  for (const x of [1012, 1060, 1090, 1150, 1170, 1214, 1230]) palm(x, 226 - (x % 3) * 2, 11 + (x % 4));
  const sportsCar = (x, z, color, yaw = 0, police = false) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (dx, dz) => [x + c * dx + s * dz, z - s * dx + c * dz];
    const bx = (size, dx, y, dz, col, mat, o = {}) => { const [px, pz] = at(dx, dz); add(size, [px, G + y, pz], col, mat, { yaw, ...o }); };
    bx([4.6, 1.3, 10], 0, 1.25, 0, color, 'SmoothPlastic');
    bx([4, 1.2, 4.6], 0, 2.5, 0.6, police ? WHITE : 0x1a2a3a, police ? 'SmoothPlastic' : 'Glass', { collide: 0 });
    for (const [dx, dz] of [[-2.3, -3.2], [2.3, -3.2], [-2.3, 3.2], [2.3, 3.2]]) bx([0.7, 1.6, 1.6], dx, 0.8, dz, 0x111111, 'Rubber', { shape: 2, collide: 0 });
    if (police) { bx([1.4, 0.4, 0.6], -0.8, 3.3, 0.6, 0xff2020, 'Neon', { collide: 0 }); bx([1.4, 0.4, 0.6], 0.8, 3.3, 0.6, 0x2060ff, 'Neon', { collide: 0 }); }
    else bx([4.7, 0.2, 9.6], 0, 0.5, 0, TEAL, 'Neon', { collide: 0 });
  };
  sportsCar(1112, 216, PINK, Math.PI / 2);
  sportsCar(1132, 218, BLACK, Math.PI / 2 + 0.15, true);
  light(1122, 5, 214, 0xff2060);
  for (const [x, z] of [[1008, 206], [1060, 206], [1120, 206], [1180, 206], [1228, 206], [1008, 230]]) {
    box([0.5, 11, 0.5], [x, G, z], 0x1a1a1c, 'Metal');
    neon([1.3, 1.3, 1.3], [x, G + 11.4, z], [PINK, TEAL][Math.round(x / 10) % 2], { shape: 3 });
    data.tags.ParkLamp.push([x, G + 11.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the wait time and a greeter
  box([0.6, 6, 0.6], [DOOR_IN + 8, G, 216], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [DOOR_IN + 8, G + 9, 216], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 71, cf: cf(DOOR_IN + 4, G, 210, Math.PI) });

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
  const samples = [];
  for (let s = 0; s < track.length; s += 1) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  // is a piece of scenery clear of the cars (round tubs, 2.6 across the
  // middle, riders' heads about 4.6 up)?
  const clearOf = (size, pos, o = {}) => {
    let ex = size[0] / 2, ez = size[2] / 2, ey = size[1] / 2;
    const r = o.rot;
    if (r) {
      ex = (Math.abs(r[0]) * size[0] + Math.abs(r[1]) * size[1] + Math.abs(r[2]) * size[2]) / 2;
      ey = (Math.abs(r[3]) * size[0] + Math.abs(r[4]) * size[1] + Math.abs(r[5]) * size[2]) / 2;
      ez = (Math.abs(r[6]) * size[0] + Math.abs(r[7]) * size[1] + Math.abs(r[8]) * size[2]) / 2;
    } else if (o.yaw) {
      const c = Math.abs(Math.cos(o.yaw)), s = Math.abs(Math.sin(o.yaw));
      [ex, ez] = [(c * size[0] + s * size[2]) / 2, (s * size[0] + c * size[2]) / 2];
    }
    for (const [x, y, z] of samples) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < 3.6 && pos[1] + ey > y - 1.2 && pos[1] - ey < y + 5.2) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos, o) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  // supports: steel columns from the ground to under the rails, wherever
  // nothing runs below
  for (let s = 6; s < track.length - 4; s += 9) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    const foot = P.clone().addScaledVector(U, -1.5);
    if (foot.y < 2.5 || U.y < 0.8) continue;
    if (samples.some(([x, y, z, c]) => Math.abs(c - s) > 12 && y < foot.y + 1 && Math.hypot(x - foot.x, z - foot.z) < 5.5)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], 0x2a2c34, 'Metal', { shape: 5, collide: 0 });
    if (foot.y > 14) add([0.3, 0.3, Math.min(9, foot.y * 0.6)], [foot.x, foot.y * 0.55, foot.z], 0x2a2c34, 'Metal', { collide: 0, rot: RX(0.7) });
  }

  // ======== inside: the queue, the lobby of the Port Benton Savings & Loan
  add([B.x1 - B.x0 - 2.4, 0.15, B.z1 - B.z0 - 2.4], [cx, G + 0.08, cz], 0x1c1824, 'SmoothPlastic', { collide: 0 });
  add([30, 0.16, 86], [1040, G + 0.1, 151], 0xe8e0d0, 'Concrete', { collide: 0 });
  const ROWS = [1030, 1036, 1042, 1048];
  const north = 188, south = 116;
  const fwd = [[1014, 232], [1014, 214], [DOOR_IN, 214], [DOOR_IN, B.z1 - 2], [ROWS[0], 192]];
  ROWS.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwd.push([x, goSouth ? north : south]);
    fwd.push([x, goSouth ? south : north]);
  });
  fwd.push([ROWS[3], 192], [1106, 192], [1116, 186]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 3, [0, 1], G); // (a long line runs on out through the gate)
  const brass = 0xc8a040;
  const railZ = (x, za, zb) => {
    add([0.2, 0.2, zb - za], [x, G + 3.2, (za + zb) / 2], brass, 'Metal', { collide: 0 });
    add([0.12, 1.4, zb - za], [x, G + 2.3, (za + zb) / 2], 0x8a1a3a, 'Fabric', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.3, 3.2, 0.3], [x, G, za + ((zb - za) * k) / n], brass, 'Metal');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    if (k % 2 === 0) railZ(x, north - 3.6, south - 3); else railZ(x, north + 2, south + 3.6);
  }
  railZ(ROWS[0] - 3, south - 3, north - 1);
  railZ(ROWS[3] + 3, south - 3, north - 2);
  // the lobby: teller windows on the west wall, a vault door, posters
  for (let k = 0; k < 6; k++) {
    const z = 122 + k * 11;
    box([2, 3.4, 6], [B.x0 + 2.2, G, z], 0x5a3a2a, 'Wood', { collide: 0 });
    add([0.2, 2.4, 5], [B.x0 + 3.3, G + 4.8, z], 0x9ad8ff, 'Glass', { collide: 0, trans: 0.4 });
    sign([0.2, 0.8, 4], [B.x0 + 3.3, G + 7, z], 0x1a3a4a, 'Right', [[`TELLER ${k + 1}`, 0, 0, 1, 1, SUN, 'GothamBold']], { glow: true });
  }
  [['PORT BENTON SAVINGS & LOAN', 'SINCE 1926  ·  YOUR MONEY IS SAFE WITH US'], ['NEW! THE VAULT', 'GOLD  ·  CASH  ·  AND A VERY BIG DOOR'], ['WANTED', 'THE NEON GETAWAY CREW  ·  REWARD'], ['SUNSET BEACH', 'PORT BENTON  ·  WISH YOU WERE HERE']].forEach(([a, b], k) => {
    sign([0.3, 6, 14], [B.x0 + T + 0.3, 13, 128 + k * 18], 0x14101c, 'Right', [[a, 0, 0.1, 1, 0.5, [PINK, SUN, 0xff4040, TEAL][k]], [b, 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  });
  sign([24, 4, 0.3], [1040, 13, B.z1 - T - 0.3], 0x14101c, 'Front', [['THE LINE STARTS AT TELLER 1', 0, 0, 1, 1, TEAL, 'GothamBold']], { glow: true });
  // palms in pots and neon over the rows
  for (const z of [118, 152, 186]) for (const x of [ROWS[0] - 3, ROWS[3] + 3]) {
    box([1.6, 1.2, 1.6], [x, G, z], 0x2aa8a0, 'Concrete', { shape: 5, collide: 0 });
  }
  for (let z = south; z <= north; z += 12) neon([22, 0.25, 0.25], [1039, 10, z], z % 24 ? PINK : TEAL);
  for (let z = south; z <= north; z += 24) light(1039, 8, z, 0xffd0e0);

  // ======== the station: the getaway garage
  sign([30, 3.4, 0.4], [1124, 13, 190], 0x14101c, 'Front', [['GETAWAY GARAGE', 0, 0, 1, 0.62, PINK], ['ONE CAR PER CREW  ·  KEEP YOUR HANDS INSIDE', 0, 0.62, 1, 0.38, TEAL, 'GothamBold']], { glow: true });
  for (const x of [1108, 1140]) box([0.4, 14, 0.4], [x, G, 190], 0x2e3238, 'Metal', { collide: 0 });
  add([36, 0.2, 0.6], [1124, G + 0.12, 181.4], SUN, 'SmoothPlastic', { collide: 0 });
  const con = [1102, 186];
  box([1.4, 3, 2.4], [con[0], G, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  for (let k = 0; k < 4; k++) SB([3, 4, 1.6], [1150 + k * 3.4, G, 193], 0xc8322d, 'Metal', { collide: 0 });
  light(1124, 10, 184, 0xff80c0);
  light(1100, 8, 186, TEAL);

  // ======== the scenes
  // the vault, door standing open, gold stacked high, laser grid
  SB([1, 12, 12], [1100, G, 158], 0x6a6e76, 'DiamondPlate');
  S([1.2, 9, 9], [1094, G + 5.5, 152], 0x9a9ea6, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (let k = 0; k < 18; k++) SB([1.6, 0.6, 0.8], [1086 + (k % 3) * 1.8, G + Math.floor(k / 3) * 0.6, 164 + (k % 2) * 0.4], 0xf0c040, 'Neon', { collide: 0 });
  for (let k = 0; k < 6; k++) SN([0.1, 0.1, 12], [1099.4, G + 1.2 + k * 1.6, 158], 0xff2020);
  light(1090, 6, 160, SUN);
  // the lift: the parking garage, police lights chasing you up
  for (let s = track.cum.find((c, i) => i > 0 && track.pos[i * 3 + 2] < 150 && track.pos[i * 3] < 1070) || 60, k = 0; k < 6; k++, s += 9) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
    const C = P.clone().addScaledVector(U, 2.2);
    for (let j = 0; j < 22; j++) {
      const a = (j / 22) * Math.PI * 2;
      const q = C.clone().addScaledVector(R, Math.cos(a) * 5.2).addScaledVector(U, Math.sin(a) * 5.2);
      if (q.y > G + 0.4) SN([0.4, 0.4, 0.4], [q.x, q.y, q.z], j < 11 ? 0xff2020 : 0x2060ff, { shape: 3 });
    }
    light(C.x, C.y + 4, C.z, k % 2 ? 0xff2020 : 0x2060ff);
  }
  // the rooftops: a skyline on the south and east walls, neon signs, and a
  // police helicopter hanging over the swamp
  for (let k = 0; k < 14; k++) {
    const x = B.x0 + 8 + k * 14.5, h = 16 + ((k * 7) % 5) * 3;
    SB([13, h, 0.6], [x, G + 6, B.z0 + T + 0.4], [0x20283a, 0x2a2034, 0x1a2a34][k % 3], 'SmoothPlastic', { collide: 0 });
    for (let f = 0; f < 5; f++) for (let j = 0; j < 3; j++) if ((k + f + j) % 3) SN([1.6, 1.2, 0.2], [x - 4 + j * 4, G + 9 + f * 3, B.z0 + T + 0.8], (k + f) % 4 ? 0xffd890 : TEAL);
  }
  [['CORAL MOTEL', PINK, 1080], ['SUNSET PALMS', SUN, 1130], ['PORT BENTON', TEAL, 1180]].forEach(([text, c, x]) => {
    sign([20, 3, 0.3], [x, 30, B.z0 + T + 1], 0x14101c, 'Back', [[text, 0, 0, 1, 1, c]], { glow: true });
  });
  const heli = [1090, 24, 26];
  S([4, 3, 8], heli, 0x1a2a4a, 'Metal', { collide: 0 });
  S([2, 1.2, 6], [heli[0], heli[1] - 0.4, heli[2] + 6], 0x1a2a4a, 'Metal', { collide: 0 });
  S([16, 0.2, 0.6], [heli[0], heli[1] + 2, heli[2]], 0x2a2a2e, 'Metal', { collide: 0, yaw: 0.6 });
  S([16, 0.2, 0.6], [heli[0], heli[1] + 2, heli[2]], 0x2a2a2e, 'Metal', { collide: 0, yaw: -0.9 });
  SN([1, 1, 1], [heli[0], heli[1] - 1.8, heli[2] - 3], 0xffffff, { shape: 3 });
  SN([1.2, 0.5, 0.5], [heli[0] - 0.8, heli[1] + 1.8, heli[2] - 1], 0xff2020);
  SN([1.2, 0.5, 0.5], [heli[0] + 0.8, heli[1] + 1.8, heli[2] - 1], 0x2060ff);
  light(heli[0], heli[1] - 6, heli[2], 0xe8f0ff);
  // the swamp: dark water, mangroves, an airboat, gators, mist
  add([60, 0.2, 34], [1080, G + 0.2, 28], 0x1a3a2a, 'Glass', { collide: 0, trans: 0.2 });
  for (let k = 0; k < 9; k++) {
    const x = 1056 + (k % 3) * 22 + (k % 2) * 4, z = 16 + Math.floor(k / 3) * 12;
    for (let r = 0; r < 4; r++) SB([0.3, 3, 0.3], [x + Math.cos(r * 1.6) * 1.2, G, z + Math.sin(r * 1.6) * 1.2], 0x4a3a2a, 'Wood', { collide: 0 });
    SB([0.6, 5, 0.6], [x, G + 2, z], 0x4a3a2a, 'Wood', { collide: 0 });
    S([5, 2.6, 5], [x, G + 8, z], 0x2a5a2a, 'Grass', { shape: 3, collide: 0 });
  }
  SB([3.4, 0.8, 7], [1100, G + 0.2, 30], 0x8a8e96, 'Metal', { collide: 0 });
  S([3.4, 3.4, 0.4], [1100, G + 2.8, 34], 0x2a2a2e, 'Metal', { collide: 0 });
  for (const [x, z, a] of [[1072, 36, 0.3], [1088, 14, -0.8], [1114, 34, 1.4]]) {
    S([1.4, 0.7, 5], [x, G + 0.6, z], 0x3a5a2a, 'SmoothPlastic', { collide: 0, yaw: a });
    S([0.4, 0.4, 0.4], [x - 0.4, G + 1.1, z], 0xf2e020, 'Neon', { collide: 0, shape: 3 });
  }
  for (const [x, z] of [[1070, 24], [1094, 36], [1106, 16]]) data.tags.SteamVent.push([x, G + 0.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(1080, 6, 28, 0x40c080);
  light(1100, 8, 20, 0x40c080);
  // Sunset Beach: sand, palms, a lifeguard tower, the sunset on the wall
  add([100, 0.2, 18], [1160, G + 0.15, 22], 0xe8d4a0, 'Ground', { collide: 0 });
  for (const x of [1118, 1146, 1176, 1206]) {
    for (let k = 0; k < 5; k++) S([0.8, 2.4, 0.8], [x, G + 1.2 + k * 2.3, B.z0 + T + 3], 0x8a6a4a, 'Wood', { shape: 5, collide: 0 });
    S([5, 0.4, 5], [x, G + 12, B.z0 + T + 3], 0x3a8a3a, 'Grass', { collide: 0, rot: RZ(0.2) });
  }
  SB([3, 5, 3], [1160, G, B.z0 + T + 3.4], 0xf0f0ec, 'Wood', { collide: 0 });
  S([4, 0.6, 4], [1160, G + 5.4, B.z0 + T + 3.4], 0xff4040, 'SmoothPlastic', { collide: 0 });
  sign([40, 8, 0.3], [1160, 28.5, B.z0 + T + 0.9], 0xff6a3a, 'Back', [['SUNSET BEACH', 0, 0.15, 1, 0.5, SUN], ['PORT BENTON', 0, 0.68, 1, 0.26, PINK, 'GothamBold']], { glow: true });
  light(1150, 8, 20, 0xff8a40);
  light(1190, 8, 22, 0xff6a6a);
  // the roadblock: cruisers across the east side, lights going, a spike strip
  for (const z of [44, 62, 80]) {
    SB([3, 2, 7], [1230, G, z], [BLACK, WHITE][Math.round(z / 18) % 2], 'SmoothPlastic', { collide: 0 });
    SB([2.6, 1.2, 3.4], [1230, G + 2, z + 0.4], 0x1a2a3a, 'Glass', { collide: 0 });
    SN([1.2, 0.4, 0.6], [1230, G + 3.5, z - 0.6], 0xff2020);
    SN([1.2, 0.4, 0.6], [1230, G + 3.5, z + 0.6], 0x2060ff);
    light(1229, 5, z, z % 36 ? 0xff2020 : 0x2060ff);
  }
  sign([0.3, 3, 16], [B.x1 - T - 0.3, 18, 60], 0x14101c, 'Left', [['ROADBLOCK', 0, 0, 1, 0.6, 0xff4040], ['PORT BENTON PD', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  // the marina: water, a white yacht, money bags on the deck
  add([70, 0.2, 22], [1150, G + 0.2, 129], 0x1a4a6a, 'Glass', { collide: 0, trans: 0.2 });
  SB([32, 3, 8], [1150, G + 0.3, 129], WHITE, 'SmoothPlastic', { collide: 0 });
  SB([18, 2.6, 6], [1146, G + 3.3, 129], 0xe8e8e8, 'SmoothPlastic', { collide: 0 });
  SB([10, 2.2, 5], [1144, G + 5.9, 129], 0x1a2a3a, 'Glass', { collide: 0 });
  SN([32.2, 0.3, 8.2], [1150, G + 1.2, 129], TEAL);
  for (let k = 0; k < 5; k++) S([1.2, 1.4, 1.2], [1158 + (k % 3) * 1.4, G + 4, 127.5 + Math.floor(k / 3) * 2.2], 0xd8c890, 'Fabric', { shape: 3, collide: 0 });
  sign([20, 3, 0.3], [1150, 12, 129], 0x14101c, 'Back', [['PORT BENTON MARINA', 0, 0, 1, 1, TEAL]], { glow: true });
  light(1150, 10, 124, TEAL);
  light(1120, 8, 130, 0x40a0ff);
  // the sunset over the garage, on the north wall
  sign([60, 10, 0.3], [1180, 24, B.z1 - T - 0.3], 0xff6a3a, 'Front', [['GOT AWAY CLEAN?', 0, 0.12, 1, 0.5, 0xffffff], ['NOT FOR LONG...', 0, 0.68, 1, 0.26, 0x2a1a3a, 'GothamBold']], { glow: true });

  // ======== new lights: LED strips along the track, and show lights all round
  const CM = new THREE.Matrix4(), CP = new THREE.Vector3(), CX = new THREE.Vector3(), CY = new THREE.Vector3(), CZ = new THREE.Vector3();
  const carClear = (q, s0) => {
    for (let ds = -6; ds <= 6; ds += 0.5) {
      sampler.matrixAt(s0 + ds, CM);
      CP.setFromMatrixPosition(CM);
      CX.setFromMatrixColumn(CM, 0); CY.setFromMatrixColumn(CM, 1); CZ.setFromMatrixColumn(CM, 2);
      const dx = q.x - CP.x, dy = q.y - CP.y, dz = q.z - CP.z;
      const lx = CX.x * dx + CX.y * dy + CX.z * dz, ly = CY.x * dx + CY.y * dy + CY.z * dz, lz = CZ.x * dx + CZ.y * dy + CZ.z * dz;
      if (Math.hypot(lx, lz) < 2.9 && ly > -0.4 && ly < 4.8) return false;
    }
    return true;
  };
  for (let s = 12; s < track.length - 10; s += 2.5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
    const c = P.y > 15 ? [PINK, TEAL, PURPLE][Math.floor(s / 2.5) % 3] : P.z < 50 ? SUN : P.x > 1210 ? 0xff3030 : TEAL;
    for (const side of [-1, 1]) {
      const q = P.clone().addScaledVector(R, side * 1.5).addScaledVector(U, -1.0);
      if (q.y > G + 0.2 && carClear(q, s)) neon([0.32, 0.32, 0.32], [q.x, q.y, q.z], c, { shape: 3 });
    }
  }
  for (let s = 8; s < track.length - 8; s += 18) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    light(P.x, Math.min(B.H - 3, P.y + 7), P.z, P.y > 15 ? PURPLE : P.z < 50 ? 0xffa060 : PINK);
  }

  // ======== the cars: round getaway tubs that spin on their chassis
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const BACK = [-1, 0, 0, 0, 1, 0, 0, 0, -1];
  const paints = [[PINK, TEAL], [TEAL, PINK], [PURPLE, SUN], [ORANGE, PURPLE]];
  const carParts = (k) => {
    const [body, trim] = paints[k];
    return [
      pp(5, [4.2, 0.6, 4.2], [0, 0.3, 0], 0x2a2c34, 'Metal'),
      pp(5, [5.1, 0.12, 5.1], [0, 0.36, 0], trim, 'Neon'),
      pp(5, [4.9, 1.5, 4.9], [0, 1.2, 0], body, 'SmoothPlastic'),
      pp(5, [5.1, 0.25, 5.1], [0, 2.0, 0], 0xd8dce2, 'Metal'),
      pp(0, [4.2, 1.8, 0.35], [0, 2.4, 0], 0x1a1a1c, 'SmoothPlastic'),
      pp(0, [4.3, 0.2, 0.45], [0, 3.35, 0], trim, 'Neon'),
      ...[-1, 1].map((sz) => pp(0, [4, 0.4, 1.4], [0, 1.0, sz * 1.0], 0x1a1a1c, 'Fabric')),
      ...[-1.6, 1.6].flatMap((x) => [pp(3, [0.5, 0.5, 0.3], [x, 1.5, -2.4], 0xfff4c0, 'Neon'), pp(3, [0.5, 0.5, 0.3], [x, 1.5, 2.4], 0xff2020, 'Neon')]),
    ];
  };
  const seatList = () => {
    const out = [];
    for (const x of [-1, 1]) out.push([x, 2.5, -0.9, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const x of [-1, 1]) out.push([x, 2.5, 0.9, ...BACK]);
    return out;
  };
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
    stops.push(cf(P.x, G, 182.6, 0));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0], G, con[1], 0), operator: cf(con[0], G, con[1] + 1.4, 0),
    homes: [cf(1118, G, 187, 0), cf(1132, G, 187, 0)],
    exit: cf(1150, G, 188, -Math.PI / 2),
  };

  // ======== the ride
  // the cars spin free from the top of the lift to the brakes
  const nearS = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const origin = [1130, 0, 100];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    spin: { from: nearS(1069, 85), to: nearS(1186, 178), gain: 0.085, drag: 0.22 },
  };
  data.rides.push(ride);
  const at = (x, z) => track.times[track.cum.indexOf(nearS(x, z))] / ride.duration;
  const cues = [
    [at(1080, 172), 'sparks', [0, 2, 0]], [at(1140, 44), 'fire', [0, -3, 0]], [at(1222, 58), 'explosion', [5, 0, 0]],
    [at(1222, 80), 'sparks', [4, 0, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Neon Getaway: The Port Benton Heist', land: 'Velocity', category: 'Thrill', thrill: 3, kind: 'coaster', carStyle: 'coaster',
    description: 'A spinning coaster, fully indoors: crack the vault at the Port Benton Savings & Loan, climb the parking garage with the cops\' lights behind you, spin round the rooftop hairpins under a police helicopter, plunge into the swamp, race along Sunset Beach, crash the roadblock and slip away past the marina. Your round getaway car turns freely the whole way - no two rides spin the same!',
    baseWait: 50, origin, entrance: [DOOR_IN, 0, 214], exit: [DOOR_OUT, 0, B.z1 + 8], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, PINK, TEAL], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Neon Getaway is open - pick a car and hold on, it spins!', 'The bank job starts at Teller 1!'];
  return { ride, gate: { x: gx, z: 236 }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 } };
}

// a toast the first time you come near the new ride
export class NeonGetawaySite {
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
      this.hooks.toast('NEW: Neon Getaway, an indoor spinning coaster heist! Through the gate past RV Van Run - your car spins freely the whole way round.', 'reward');
    }
  }
}
