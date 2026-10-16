// Fast & Furious: Benton Street Run, now open beyond Velocity City's east
// wall. Guests walk through a new arch in the wall into a courtyard, wind
// through the queue and board street cars inside a huge warehouse, where
// the ride is a night-time chase through a city: a nitrous launch up the
// street, a drift onto the main drag past neon storefronts, up the ramps of
// a parking garage, across a rooftop and a jump to the next roof, along an
// elevated highway, a second launch through the docks past the shipping
// containers, and back through the family garage.
//
// Like Overdrive, it is added to the park data as an ordinary ride (track,
// cars, seats, queue, crew, wait sign), so the simulation, crews, riders,
// sounds and the app all treat it the same way.
import * as THREE from 'three';
import { Sampler } from './rides.js';

export const RIDE_ID = 'FastFurious';
export const FF_SITE = { x0: 377, x1: 596, z0: -400, z1: -110 };
const GATE = { z0: -241.7, z1: -206.3 }; // between the east wall's pillars at z -244 and -204
export const WH = { x0: 412, x1: 572, z0: -372, z1: -172, H: 50 };
const COURT = { x0: 377, x1: WH.x0, z0: -366, z1: -198 };
const G = 0.1;
const FLOOR = 0.5; // top of the courtyard paving
const PLATFORM = 1.4; // the station platform, level with the cars' floors
const CARS = 3, SPACING = 11;
const STATION = { x: 426, front: -266 };
const STEEL = 0xb8bcc0, BLACK = 0x101012, WHITE = 0xf4f4f0, ORANGE = 0xff6a1a, BLUE = 0x1e6ee6, ICE = 0x9ad8ff, YELLOW = 0xf2c818;
const TRACK_COLOR = 0x2a2c30;
const G_ACC = 35;

// the circuit: x, y, z of the rails and the speed there, starting where
// the front car stops in the station
const CIRCUIT = [
  [STATION.x, 1.4, STATION.front, 2],
  // launch 1: nitrous, up the street
  [426, 1.4, -278, 8], [426, 1.6, -296, 22], [426, 2.4, -318, 30], [426, 4, -336, 30],
  // drift right onto the main drag
  [430, 5.5, -352, 27], [442, 7, -360, 26], [462, 7, -360, 26], [492, 7, -358, 27], [520, 7, -358, 27],
  // right at the end, up the parking garage ramps
  [542, 8, -354, 24], [553, 10, -342, 22], [555, 16, -324, 18], [555, 26, -306, 14], [553, 36, -292, 11],
  // right onto the rooftop
  [546, 40, -282, 11], [532, 40, -279, 13], [512, 40, -279, 15], [496, 40, -279, 16],
  // the jump to the next roof
  [486, 35, -279, 20], [477, 25, -279, 25], [468, 23, -279, 24], [461, 26, -278, 20], [454, 22, -275, 22],
  // left onto the elevated highway
  [448, 18, -266, 22], [446, 17, -252, 23], [446, 17, -236, 24], [446, 17, -218, 24],
  // down the off-ramp and left into the docks: launch 2
  [449, 13, -201, 22], [460, 7, -189, 20], [478, 5, -186, 22], [503, 5, -186, 32], [528, 5, -186, 32],
  // left past the containers
  [547, 5, -190, 27], [556, 6, -204, 25], [553, 6, -220, 22], [542, 6, -229, 20],
  // west through the family garage, under the highway, home
  [518, 6, -230, 19], [490, 6, -230, 18], [466, 6, -230, 16], [446, 5.5, -230, 14], [434, 3, -231, 10],
  [428, 1.6, -236, 7], [426, 1.4, -244, 4],
];

// Closed centripetal Catmull-Rom spline through the circuit, with the
// speeds given at each point (launches and all), banking from the speed,
// and the time to get round.
export function makeTrack(pts) {
  const n = pts.length;
  const V = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const pos = [], knotSpeed = [];
  for (let i = 0; i < n; i++) {
    const p0 = V[(i - 1 + n) % n], p1 = V[i], p2 = V[(i + 1) % n], p3 = V[(i + 2) % n];
    const t1 = Math.sqrt(p0.distanceTo(p1)), t2 = t1 + Math.sqrt(p1.distanceTo(p2)), t3 = t2 + Math.sqrt(p2.distanceTo(p3));
    const steps = Math.max(6, Math.ceil(p1.distanceTo(p2) / 0.8));
    for (let k = 0; k < steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps;
      const a1 = p0.clone().multiplyScalar((t1 - t) / t1).addScaledVector(p1, t / t1);
      const a2 = p1.clone().multiplyScalar((t2 - t) / (t2 - t1)).addScaledVector(p2, (t - t1) / (t2 - t1));
      const a3 = p2.clone().multiplyScalar((t3 - t) / (t3 - t2)).addScaledVector(p3, (t - t2) / (t3 - t2));
      const b1 = a1.multiplyScalar((t2 - t) / t2).addScaledVector(a2, t / t2);
      const b2 = a2.clone().multiplyScalar((t3 - t) / (t3 - t1)).addScaledVector(a3, (t - t1) / (t3 - t1));
      pos.push(b1.multiplyScalar((t2 - t) / (t2 - t1)).addScaledVector(b2, (t - t1) / (t2 - t1)));
      const u = k / steps;
      knotSpeed.push(pts[i][3] + (pts[(i + 1) % n][3] - pts[i][3]) * u);
    }
  }
  pos.push(pos[0].clone());
  knotSpeed.push(knotSpeed[0]);
  const m = pos.length;
  const cum = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + pos[i].distanceTo(pos[i - 1]));
  const L = cum[m - 1];
  const tan = pos.map((_, i) => {
    const a = pos[i === 0 ? m - 2 : i - 1], b = pos[i === m - 1 ? 1 : i + 1];
    return b.clone().sub(a).normalize();
  });
  // pull away gently and ease into the station at the end
  const v = cum.map((s, i) => Math.max(0.8, Math.min(knotSpeed[i], Math.sqrt(10 * s + 4), Math.sqrt(4 * (L - s)) + 0.8)));
  const times = [0];
  for (let i = 1; i < m; i++) times.push(times[i - 1] + (cum[i] - cum[i - 1]) / ((v[i] + v[i - 1]) / 2));
  // bank into the turns (not in the station)
  const Y = new THREE.Vector3(0, 1, 0);
  const phi = pos.map((_, i) => {
    if (cum[i] < 12 || cum[i] > L - 24) return 0;
    const a = tan[i === 0 ? m - 2 : i - 1], b = tan[i === m - 1 ? 1 : i + 1];
    const ds = (cum[i === m - 1 ? 1 : i + 1] - cum[i === 0 ? m - 2 : i - 1] + (i === 0 || i === m - 1 ? L : 0)) || 1;
    let dh = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const flat = Math.hypot(tan[i].x, tan[i].z);
    return THREE.MathUtils.clamp(Math.atan((v[i] * v[i] * (-dh / ds) * flat) / G_ACC), -1.1, 1.1);
  });
  const W = 12;
  const smooth = phi.map((_, i) => {
    let s = 0;
    for (let k = -W; k <= W; k++) s += phi[(i + k + (m - 1)) % (m - 1)];
    return s / (2 * W + 1);
  });
  const up = pos.map((_, i) => {
    const t = tan[i];
    const u0 = Y.clone().addScaledVector(t, -t.dot(Y)).normalize();
    const r0 = new THREE.Vector3().crossVectors(t, u0);
    return u0.multiplyScalar(Math.cos(smooth[i])).addScaledVector(r0, Math.sin(smooth[i]));
  });
  const flatArr = (vs) => vs.flatMap((p) => [p.x, p.y, p.z]);
  return { length: L, cum, pos: flatArr(pos), tan: flatArr(tan), up: flatArr(up), times };
}

// A queue path from the boarding gate (s = 0) back out past the entrance sign.
export function queuePath(points, signIndex, outward, floor) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const [gx, gz] = points[0], [nx, nz] = points[1];
  const gl = Math.hypot(nx - gx, nz - gz) || 1;
  return {
    points: points.flat(), cum, length: cum[cum.length - 1], signAt: cum[signIndex],
    gate: points[0], gateDir: [(gx - nx) / gl, (gz - nz) / gl], outward, floor,
  };
}

function helpers(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null, trans = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), trans, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (size, center, bg, face, labels, { glow = false, yaw = 0 } = {}) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({
      part: i, face, glow,
      labels: labels.map(([text, x, y, w, h, color, font = 'GothamBlack']) => ({ text, x, y, w, h, color, font, align: 'Center', stroke: false, pad: 0.1 })),
    });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  return { add, box, sign, cf, mi };
}

export function buildFastFurious(data) {
  const { add, box, sign, cf } = helpers(data);
  const S = FF_SITE;
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);

  // level the land, clear its trees; it is part of Velocity City now
  data.flatZones = [...(data.flatZones || []), { ...S, margin: 34 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], S, 10));
  const land = data.config.Lands.find((l) => l.id === 'Velocity');
  if (land) land.regions = [...land.regions, [S.x0 - 2, S.z0, S.x1, S.z1]];

  // ---- the east wall: open between two pillars for the entrance
  data.hidden = data.hidden || [];
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 375) < 0.5 && p[3] > 400 && p[6] - p[3] / 2 < GATE.z0 && p[6] + p[3] / 2 > GATE.z1;
    if (wall) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(375, -405, 375, GATE.z0);
  wallSeg(375, GATE.z1, 375, 161.4); // up to the Family Landing backstage gate
  // the courtyard is walled to the warehouse
  wallSeg(375, COURT.z0, WH.x0, COURT.z0);
  wallSeg(375, COURT.z1, WH.x0, COURT.z1);
  const gz = (GATE.z0 + GATE.z1) / 2;

  // ---- ground: gravel round the warehouse, paving in the courtyard
  add([S.x1 - S.x0, 1, S.z1 - S.z0], [(S.x0 + S.x1) / 2, G - 0.5, (S.z0 + S.z1) / 2], 0x5a5a5e, 'Asphalt');
  add([COURT.x1 - COURT.x0, 0.4, COURT.z1 - COURT.z0], [(COURT.x0 + COURT.x1) / 2, FLOOR - 0.2, (COURT.z0 + COURT.z1) / 2], 0x3a3c42, 'Pavement');
  // the way in from the park
  add([12, 0.4, GATE.z1 - GATE.z0], [372, FLOOR - 0.2, gz], 0x3a3c42, 'Pavement');

  // ---- the entrance arch in the wall
  const ax = 376;
  for (const z of [GATE.z0 + 1.6, GATE.z1 - 1.6]) {
    box([3.2, 20, 3.2], [ax, G, z], 0x1a1a1c, 'Metal');
    add([0.4, 18, 0.4], [ax - 1.7, G + 10, z], ORANGE, 'Neon', { collide: 0 });
  }
  add([4, 6, GATE.z1 - GATE.z0 + 2], [ax, G + 23, gz], 0x1a1a1c, 'Metal', { collide: 0 });
  sign([0.3, 4.2, 30], [ax - 2.2, G + 23.6, gz], 0x1a1a1c, 'Left', [['FAST & FURIOUS', 0, 0, 1, 0.62, ORANGE], ['BENTON STREET RUN', 0, 0.62, 1, 0.38, ICE, 'GothamBold']], { glow: true });
  sign([0.3, 4.2, 30], [ax + 2.2, G + 23.6, gz], 0x1a1a1c, 'Right', [['FAST & FURIOUS', 0, 0, 1, 0.62, ORANGE], ['BENTON STREET RUN', 0, 0.62, 1, 0.38, ICE, 'GothamBold']], { glow: true });
  // a checkered strip under the arch
  for (let k = 0; k < 12; k++) for (let j = 0; j < 2; j++) add([1.4, 0.05, 2.9], [ax - 0.7 + j * 1.4, FLOOR + 0.02, GATE.z0 + 1.5 + k * 2.95], (k + j) % 2 ? WHITE : BLACK, 'SmoothPlastic', { collide: 0 });
  // the live wait sign in the park, and a greeter
  box([0.6, 6, 0.6], [368, G, GATE.z0 - 6], 0x2e3238, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [368, G + 9, GATE.z0 - 6], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 11, cf: cf(370, FLOOR, gz + 6, Math.PI / 2) });
  for (const z of [GATE.z0 - 2, GATE.z1 + 2]) {
    box([0.5, 12, 0.5], [366, G, z], 0x2e3238, 'Metal');
    add([1.6, 1.6, 1.6], [366, G + 12.6, z], ORANGE, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([366, G + 12.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ---- the warehouse
  const W = WH, T = 1.2, CLAD = 0x2e3238, H = W.H;
  const doorQ = -262, doorX = -244; // queue door and exit door in the west wall
  box([W.x1 - W.x0, 0.6, W.z1 - W.z0], [(W.x0 + W.x1) / 2, G, (W.z0 + W.z1) / 2], 0x2a2a2e, 'Concrete', { collide: 0 });
  box([T, H, W.z1 - W.z0], [W.x1 - T / 2, G, (W.z0 + W.z1) / 2], CLAD, 'CorrodedMetal');
  box([W.x1 - W.x0, H, T], [(W.x0 + W.x1) / 2, G, W.z0 + T / 2], CLAD, 'CorrodedMetal');
  box([W.x1 - W.x0, H, T], [(W.x0 + W.x1) / 2, G, W.z1 - T / 2], CLAD, 'CorrodedMetal');
  const spans = [[W.z0, doorQ - 3.5], [doorQ + 3.5, doorX - 3.5], [doorX + 3.5, W.z1]];
  for (const [za, zb] of spans) box([T, H, zb - za], [W.x0 + T / 2, G, (za + zb) / 2], CLAD, 'CorrodedMetal');
  for (const z of [doorQ, doorX]) box([T, H - 9, 7], [W.x0 + T / 2, G + 9, z], CLAD, 'CorrodedMetal');
  add([W.x1 - W.x0 + 2, 1.4, W.z1 - W.z0 + 2], [(W.x0 + W.x1) / 2, G + H + 0.7, (W.z0 + W.z1) / 2], 0x3a3e46, 'Metal', { collide: 0 });
  for (let z = W.z0 + 4; z < W.z1; z += 4) if (Math.abs(z - doorQ) > 4 && Math.abs(z - doorX) > 4) add([0.4, H, 0.5], [W.x0 - 0.5, G + H / 2, z], 0x3a3e46, 'Metal', { collide: 0 });
  // the banner and a neon stripe along the top
  sign([0.3, 22, 120], [W.x0 - 1, G + 32, (W.z0 + W.z1) / 2], BLACK, 'Left', [
    ['FAST & FURIOUS', 0, 0.04, 1, 0.52, ORANGE], ['BENTON STREET RUN', 0, 0.56, 1, 0.24, WHITE], ['NOW OPEN', 0, 0.8, 1, 0.16, ICE, 'GothamBold'],
  ], { glow: true });
  add([0.3, 0.6, W.z1 - W.z0], [W.x0 - 0.9, G + H - 1.5, (W.z0 + W.z1) / 2], ORANGE, 'Neon', { collide: 0 });
  add([0.3, 0.6, W.z1 - W.z0], [W.x0 - 0.9, G + 18.5, (W.z0 + W.z1) / 2], ICE, 'Neon', { collide: 0 });
  // canopies over the doors
  for (const [z, text] of [[doorQ, 'TO THE CARS'], [doorX, 'EXIT']]) {
    add([5, 0.5, 9], [W.x0 - 2.5, G + 9.6, z], 0x1a1a1c, 'Metal', { collide: 0 });
    add([0.3, 9, 7], [W.x0 + 0.2, G + 4.5, z], 0x08080a, 'SmoothPlastic', { collide: 0 });
    sign([0.2, 1.4, 6], [W.x0 - 5.1, G + 9.6, z], 0x1a1a1c, 'Left', [[text, 0, 0, 1, 1, text === 'EXIT' ? 0x5adc6e : ORANGE, 'GothamBold']], { glow: true });
  }
  // the hero car on a turntable by the exit
  const hx = 396, hz = -214;
  box([12, 1, 12], [hx, FLOOR, hz], 0x1a1a1c, 'Metal', { shape: 5 });
  add([12.4, 0.2, 12.4], [hx, FLOOR + 1.05, hz], ORANGE, 'Neon', { shape: 5, collide: 0 });
  heroCar(hx, FLOOR + 1.2, hz, ORANGE, 0.6);

  // ---- the track and its supports
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4();
  const P = new THREE.Vector3(), U = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < track.cum.length; i++) pts.push([track.pos[i * 3], track.pos[i * 3 + 1], track.pos[i * 3 + 2], track.cum[i]]);
  const decks = [
    { x0: 488, x1: 540, z0: -292, z1: -266, top: 38.6 }, // the first rooftop
    { x0: 456, x1: 476, z0: -292, z1: -266, top: 20.6 }, // the next roof, over the gap
    { x0: 438, x1: 454, z0: -270, z1: -216, top: 15.6 }, // the highway
  ];
  for (let s = 8; s < track.length - 6; s += 12) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    const foot = P.clone().addScaledVector(U, -1.6);
    if (foot.y < 3) continue;
    if (decks.some((d) => inRect(foot.x, foot.z, d) && foot.y > d.top - 1)) continue;
    const blocked = pts.some(([x, y, z, c]) => Math.abs(c - s) > 14 && y < foot.y - 1 && Math.hypot(x - foot.x, z - foot.z) < 5);
    if (blocked) continue;
    const h = foot.y - G;
    add([1.2, h, 1.2], [foot.x, G + h / 2, foot.z], 0x3a3e46, 'Metal', { shape: 5, collide: 0 });
  }

  // ---- inside: the station (the family garage)
  const px0 = W.x0 + T / 2 + 0.2, px1 = STATION.x - 3.4;
  box([px1 - px0, PLATFORM - G, 36], [(px0 + px1) / 2, G, -254], 0x4a4a4e, 'Concrete');
  add([px1 - px0, 0.06, 0.6], [px1 - 0.4, PLATFORM + 0.03, -254], YELLOW, 'SmoothPlastic', { collide: 0, rot: [0, 0, -1, 0, 1, 0, 1, 0, 0] });
  add([0.6, 0.06, 36], [px1 - 0.4, PLATFORM + 0.03, -254], YELLOW, 'SmoothPlastic', { collide: 0 });
  sign([30, 3.4, 0.4], [STATION.x - 2, 16, STATION.front - 12], 0x1a1a1c, 'Back', [['BENTON STREET RUN', 0, 0, 1, 0.66, ORANGE], ['RIDE OR DIE', 0, 0.66, 1, 0.34, ICE, 'GothamBold']], { glow: true });
  for (const x of [414, STATION.x + 12]) add([0.4, 14, 0.4], [x, 9, STATION.front - 12], 0x2e3238, 'Metal', { collide: 0 });
  // the start light tree and a checkered start line
  box([0.6, 8, 0.6], [STATION.x + 5, G, -276], 0x2e3238, 'Metal', { collide: 0 });
  [0xe03030, 0xf0c040, 0xf0c040, 0x40d060].forEach((c, k) => add([1, 1, 0.6], [STATION.x + 5, G + 4 + k * 1.2, -275.6], c, 'Neon', { shape: 3, collide: 0 }));
  for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) add([1.6, 0.05, 1.2], [STATION.x - 4 + k * 1.6, G + 0.62, -278 + j * 1.2], (k + j) % 2 ? WHITE : BLACK, 'SmoothPlastic', { collide: 0 });
  // tool chests, tire stacks and a car on a lift along the garage wall
  for (let k = 0; k < 4; k++) box([3, 4, 1.6], [px0 + 2 + k * 2.2, PLATFORM, -238.5], 0xc8322d, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([2.4, 0.8, 2.4], [STATION.x + 9, G + 0.8 + k * 0.8, -248], 0x1a1a1a, 'Rubber', { shape: 5, collide: 0 });
  heroCar(STATION.x + 8, G + 6, -258, 0x1e6ee6);
  for (const dz of [-4, 4]) box([0.6, 6, 0.6], [STATION.x + 11.6, G, -258 + dz], 0x5a5e66, 'Metal', { collide: 0 });
  // the console and the crew
  const con = [px0 + 3.6, STATION.front - 2];
  box([1.4, 3, 2.4], [con[0], PLATFORM, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLATFORM + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(STATION.x - 4, 12, -256, 0xffb070);
  light(STATION.x + 6, 10, -282, ORANGE);

  // ---- launch 1: up the street, a NOS banner overhead
  for (let z = -286; z > -336; z -= 14) {
    for (const dx of [-7, 7]) {
      box([0.4, 9, 0.4], [STATION.x + dx, G, z], 0x2e3238, 'Metal', { collide: 0 });
      add([1, 0.6, 1], [STATION.x + dx * 0.8, G + 9, z], 0xfff0c8, 'Neon', { collide: 0 });
    }
  }
  add([24, 0.4, 0.4], [STATION.x, 13, -306], 0x2e3238, 'Metal', { collide: 0 });
  sign([16, 3, 0.3], [STATION.x, 11.4, -306], 0x0a1830, 'Back', [['NOS', 0, 0, 0.35, 1, ICE], ['NITROUS OXIDE SYSTEMS', 0.35, 0, 0.65, 1, WHITE, 'GothamBold']], { glow: true });
  light(STATION.x, 10, -310, BLUE);

  // ---- the main drag: neon storefronts both sides
  const fronts = [
    ['FAMILY MARKET', 0xff3a20], ['TUNER SHOP', ICE], ['24 HR DINER', 0xff4aa0], ['RACE WARS TONIGHT', YELLOW], ['BODY & PAINT', 0x40ff80], ['NO LIMITS', ORANGE],
  ];
  fronts.forEach(([name, glow], k) => {
    const x = 444 + k * 16, hgt = 16 + (k % 3) * 7;
    box([15, hgt, 6], [x, G, -369 + 3], [0x3a3436, 0x2e3440, 0x40342e][k % 3], 'Brick', { collide: 0 });
    for (let f = 0; f < 3; f++) for (let j = 0; j < 3; j++) if ((k + f + j) % 3) add([2, 1.6, 0.2], [x - 4.5 + j * 4.5, G + 8 + f * 4, -362.9], 0xffd890, 'Neon', { collide: 0 });
    sign([12, 2, 0.3], [x, G + 5.4, -362.8], 0x101012, 'Back', [[name, 0, 0, 1, 1, glow, 'GothamBold']], { glow: true });
    if (k % 2 === 0) light(x, 6, -362, glow);
    // lower shops across the street
    const sx = 450 + k * 15;
    box([13, 9, 5], [sx, G, -348.5], [0x2e2e34, 0x3a2e2a][k % 2], 'Brick', { collide: 0 });
    add([10, 3, 0.2], [sx, G + 3, -351.1], 0x1a2a3a, 'Glass', { collide: 0 });
    add([11, 0.5, 0.2], [sx, G + 6.8, -351.2], [ICE, 0xff4aa0, YELLOW][k % 3], 'Neon', { collide: 0 });
  });

  // ---- the parking garage ramps, then the rooftops and the skyline
  for (let lvl = 1; lvl <= 3; lvl++) {
    box([12, 0.8, 56], [564, G + lvl * 10 - 0.8, -320], 0x8a8884, 'Concrete', { collide: 0 });
    sign([0.2, 1.6, 8], [557.9, G + lvl * 10 + 2, -310], 0x1a1a1c, 'Left', [[lvl === 3 ? 'ROOF' : `LEVEL ${lvl + 1}`, 0, 0, 1, 1, YELLOW, 'GothamBold']]);
  }
  for (const z of [-346, -320, -294]) box([1.4, 30, 1.4], [559, G, z], 0x8a8884, 'Concrete', { collide: 0 });
  heroCar(565, G + 10, -332, 0x78828c, 0, true);
  heroCar(565, G + 20, -308, 0x1e1e22, Math.PI, true);
  light(556, 20, -320, 0xfff0c8);
  for (const d of decks.slice(0, 2)) {
    box([d.x1 - d.x0, 1.2, d.z1 - d.z0], [(d.x0 + d.x1) / 2, d.top - 1.2, (d.z0 + d.z1) / 2], 0x5a5a5e, 'Concrete', { collide: 0 });
    for (const [x, z] of [[d.x0, d.z0], [d.x1, d.z0], [d.x0, d.z1], [d.x1, d.z1]]) box([1.6, d.top - 1.2, 1.6], [x, G, z], 0x4a4a4e, 'Concrete', { collide: 0 });
  }
  box([4, 3, 3], [500, 38.6, -288], 0x9a9ea6, 'Metal', { collide: 0 });
  box([3, 2.4, 4], [540, 38.6, -270], 0x9a9ea6, 'Metal', { collide: 0 });
  add([6, 6, 6], [520, 43, -289], 0x6a4a34, 'WoodPlanks', { shape: 5, collide: 0 });
  sign([30, 5, 0.4], [520, 46, -292.5], 0x101012, 'Back', [['FAST & FURIOUS', 0, 0, 1, 1, ORANGE]], { glow: true });
  // the skyline on the far side of the roofs
  for (let k = 0; k < 9; k++) {
    const x = 448 + k * 13, h = 14 + ((k * 7) % 5) * 4;
    box([12, h, 1], [x, 38, -300], 0x14161c, 'SmoothPlastic', { collide: 0 });
    for (let f = 0; f < 4; f++) if ((k + f) % 2) add([1.6, 1.2, 0.2], [x - 3 + (f % 2) * 6, 40 + f * 3, -299.4], 0xffd890, 'Neon', { collide: 0 });
  }
  light(520, 44, -282, 0xff6a3a);
  light(470, 26, -280, ICE);

  // ---- the elevated highway
  const hw = decks[2];
  box([hw.x1 - hw.x0, 1.2, hw.z1 - hw.z0], [(hw.x0 + hw.x1) / 2, hw.top - 1.2, (hw.z0 + hw.z1) / 2], 0x8a8884, 'Concrete', { collide: 0 });
  for (const x of [hw.x0 + 0.4, hw.x1 - 0.4]) box([0.8, 1.4, hw.z1 - hw.z0], [x, hw.top, (hw.z0 + hw.z1) / 2], 0xb8b4ac, 'Concrete', { collide: 0 });
  for (const z of [-262, -248, -220]) for (const x of [hw.x0 + 2, hw.x1 - 2]) box([1.6, hw.top - 1.2, 1.6], [x, G, z], 0x8a8884, 'Concrete', { collide: 0 });
  for (let z = hw.z0 + 4; z < hw.z1; z += 10) add([0.3, 0.04, 4], [446, hw.top + 0.02, z], WHITE, 'SmoothPlastic', { collide: 0 });
  add([22, 0.6, 0.6], [446, hw.top + 11, -246], 0x5a5e66, 'Metal', { collide: 0 });
  for (const x of [438.6, 453.4]) box([0.6, 11, 0.6], [x, hw.top, -246], 0x5a5e66, 'Metal', { collide: 0 });
  sign([10, 3, 0.3], [446, hw.top + 9, -245.6], 0x1e6a3a, 'Front', [['BENTON ST', 0, 0, 1, 0.55, WHITE], ['EXIT 7  ·  DOCKS', 0, 0.55, 1, 0.45, WHITE, 'GothamBold']]);
  // police cars waiting under the highway, lights going
  for (const [x, z, yaw] of [[462, -214, 0.3], [478, -214, -0.2]]) {
    heroCar(x, G, z, 0x101012, yaw, true);
    add([1.4, 0.5, 0.8], [x - 0.8, G + 5.9, z], 0xff2020, 'Neon', { collide: 0 });
    add([1.4, 0.5, 0.8], [x + 0.8, G + 5.9, z], 0x2060ff, 'Neon', { collide: 0 });
  }
  light(470, 8, -212, 0xff2020);
  light(446, 20, -236, 0xffecbe);

  // ---- the docks: containers stacked both sides, fire barrels
  const CONT = [0xc8322d, 0x2a5a9a, 0x2a7a4a, 0xd88a20, 0x6a6e76];
  for (let k = 0; k < 7; k++) {
    const x = 478 + k * 11;
    for (let lvl = 0; lvl < 1 + (k % 2); lvl++) {
      box([10, 5.4, 4.6], [x, G + lvl * 5.4, -177], CONT[(k + lvl) % 5], 'CorrodedMetal', { collide: 0 });
      box([10, 5.4, 4.6], [x, G + lvl * 5.4, -200], CONT[(k + lvl + 2) % 5], 'CorrodedMetal', { collide: 0 });
    }
  }
  for (const x of [490, 520]) {
    box([1.6, 2, 1.6], [x, G, -195], 0x3a2a20, 'CorrodedMetal', { shape: 5, collide: 0 });
    data.tags.Campfire.push([x, G + 2.4, -195, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  sign([0.3, 4, 22], [571, 12, -190], 0x101012, 'Left', [['BENTON DOCKS', 0, 0, 1, 0.6, YELLOW], ['PIER 7', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  light(505, 10, -192, ORANGE);
  light(545, 10, -205, 0xff3a20);

  // ---- the family garage: roll-up doors, a barbecue, and FAMILY in neon
  for (let k = 0; k < 4; k++) {
    const x = 470 + k * 20;
    box([18, 14, 4], [x, G, -248], 0x3a3436, 'Brick', { collide: 0 });
    add([12, 9, 0.3], [x, G + 4.5, -245.8], [0x8a8e96, 0x6a6e76][k % 2], 'Metal', { collide: 0 });
    for (let j = 0; j < 8; j++) add([12, 0.15, 0.4], [x, G + 1 + j * 1.1, -245.6], 0x5a5e66, 'Metal', { collide: 0 });
  }
  box([6, 3, 3], [500, G, -240], 0x6a4a30, 'Wood', { collide: 0 });
  box([2, 3.4, 2], [508, G, -240], 0x1a1a1a, 'Metal', { shape: 5, collide: 0 });
  data.tags.Campfire.push([508, G + 3.6, -240, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  add([0.4, 0.4, 30], [480, 15.5, -230], 0x2e3238, 'Metal', { collide: 0 });
  sign([0.4, 4, 18], [480, 13, -230], 0x101012, 'Right', [['FAMILY', 0, 0, 1, 1, ORANGE]], { glow: true });
  light(480, 12, -232, ORANGE);
  light(520, 10, -232, 0xffb070);

  // ---- the courtyard queue: five switchback rows on a dark pavement
  const ROWS = [405, 399.5, 394, 388.5];
  const north = COURT.z0 + 12, south = -250;
  const entrance = [ROWS[3], -240];
  const pathPts = [[px0 + 2, doorQ], [W.x0 - 2, doorQ], [ROWS[0], doorQ]];
  ROWS.forEach((x, k) => {
    if (k === 0) { pathPts.push([x, north]); return; }
    const goingSouth = k % 2 === 1;
    pathPts.push([x, goingSouth ? north : south]);
    pathPts.push([x, goingSouth ? south : north]);
  });
  // (rows alternate: the last row ends at the south end, by the entrance)
  pathPts.push(entrance, [380, gz], [370, gz]);
  const qpath = queuePath(pathPts, pathPts.length - 3, [-1, 0], FLOOR);
  const RAIL = 0x2e3238, TOP = ORANGE;
  const railZ = (x, za, zb) => {
    add([0.22, 0.22, zb - za], [x, FLOOR + 3.2, (za + zb) / 2], TOP, 'SmoothPlastic', { collide: 0 });
    add([0.16, 0.16, zb - za], [x, FLOOR + 1.9, (za + zb) / 2], RAIL, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [x, FLOOR, za + ((zb - za) * k) / n], RAIL, 'Metal');
  };
  const railX = (xa, xb, z) => {
    add([xb - xa, 0.22, 0.22], [(xa + xb) / 2, FLOOR + 3.2, z], TOP, 'SmoothPlastic', { collide: 0 });
    const n = Math.max(1, Math.round((xb - xa) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [xa + ((xb - xa) * k) / n, FLOOR, z], RAIL, 'Metal');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    // the gap is at the end where the path turns between these two rows
    const turnNorth = k % 2 === 0;
    if (turnNorth) railZ(x, north + 3.4, south + 2); else railZ(x, north - 2, south - 3.4);
  }
  railZ(ROWS[3] - 2.75, north - 2, -244);
  railZ(ROWS[0] + 2.75, north - 2, doorQ - 3.5);
  railZ(ROWS[0] + 2.75, doorQ + 3.5, south + 3.5);
  railX(ROWS[3] - 2.75, ROWS[0] + 2.75, north - 2);
  railX(ROWS[3] + 2.75, ROWS[0] + 2.75, south + 3.5);
  // shade sails and lamps over the queue
  for (let z = north + 10; z < south; z += 26) {
    add([24, 0.2, 14], [396, 13, z], [ORANGE, 0x1a1a1c][Math.round(z / 26) % 2 ? 0 : 1], 'Fabric', { collide: 0, rot: [1, 0, 0, 0, 0.99, -0.12, 0, 0.12, 0.99] });
    box([0.4, 13, 0.4], [383.4, G, z], RAIL, 'Metal', { collide: 0 });
    add([1.2, 1.2, 1.2], [383.4, G + 13.4, z], 0xffecbe, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([383.4, G + 13.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // posters along the courtyard wall
  [['RIDE OR DIE', ORANGE], ['FAMILY', ICE], ['QUARTER MILE', YELLOW], ['NO LIMITS', 0xff4aa0]].forEach(([text, c], k) => {
    sign([7, 3, 0.3], [381.5 + k * 8, 8, COURT.z0 + 1.6], BLACK, 'Back', [[text, 0, 0, 1, 1, c]], { glow: true });
  });
  // the entrance sign at the start of the line
  box([0.4, 7, 0.4], [entrance[0] - 2.4, FLOOR, entrance[1] + 1.2], BLACK, 'Metal');
  sign([0.2, 2, 9], [entrance[0] - 2.2, FLOOR + 6.4, entrance[1] + 1.2], BLACK, 'Left', [['ENTRANCE', 0, 0, 1, 1, ORANGE]], { glow: true });

  // ---- the train: three street cars, each its own color with underglow
  const thunder = data.rides.find((r) => r.id === 'DieselThunder');
  const paints = [
    { body: ORANGE, stripe: BLACK, glow: 0x40ff80 },
    { body: BLUE, stripe: WHITE, glow: ICE },
    { body: 0x1e1e22, stripe: 0xb08aff, glow: 0xb08aff },
  ];
  const mi = (name) => {
    let i = data.materials.indexOf(name);
    if (i < 0) { data.materials.push(name); i = data.materials.length - 1; }
    return i;
  };
  const pp = (shape, size, pos, color, mat) => [shape, ...size, ...pos, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
  const carParts = (k) => {
    const paint = paints[k];
    const body = thunder.cars[0].parts.map((p) => {
      const q = p.slice();
      if (p[16] === 0xc42828) q[16] = paint.body;
      else if (p[16] === 0xf0c440) q[16] = paint.stripe;
      return q;
    });
    return [
      ...body,
      ...[[-2.95, -4.2], [2.95, -4.2], [-2.95, 1.9], [2.95, 1.9]].map(([x, z]) => pp(2, [0.9, 2.2, 2.2], [x, 0.6, z], 0x111111, 'Rubber')),
      ...[[-2.98, -4.2], [2.98, -4.2], [-2.98, 1.9], [2.98, 1.9]].map(([x, z]) => pp(2, [0.92, 1.1, 1.1], [x, 0.6, z], 0xc8ccd4, 'Metal')),
      pp(0, [5.6, 0.25, 1.3], [0, 3.5, 3.0], paint.stripe, 'SmoothPlastic'),
      pp(0, [0.3, 0.9, 0.3], [-2, 3, 3.0], 0x111111, 'Metal'),
      pp(0, [0.3, 0.9, 0.3], [2, 3, 3.0], 0x111111, 'Metal'),
      pp(0, [4.8, 0.12, 8.4], [0, -0.3, -1.4], paint.glow, 'Neon'),
      pp(0, [1.2, 0.5, 0.2], [-2, 1.6, 3.35], 0xff2020, 'Neon'),
      pp(0, [1.2, 0.5, 0.2], [2, 1.6, 3.35], 0xff2020, 'Neon'),
    ];
  };
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(thunder.seats[0].map((s) => s.slice()));
  }

  // ---- the crew: an operator at the console and an attendant who checks
  // every lap bar
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(px1 - 1.2, PLATFORM, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 1, routes: [[1, 2, 3]],
    console: cf(con[0], PLATFORM, con[1], -Math.PI / 2),
    operator: cf(con[0] - 1.4, PLATFORM, con[1], -Math.PI / 2),
    homes: [cf(px1 - 2, PLATFORM, -244, -Math.PI / 2)],
    exit: cf(px0 + 3, PLATFORM, -240, Math.PI),
  };

  // ---- the ride
  const origin = [492, 0, -272];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
  };
  data.rides.push(ride);
  // effects timed along the run: fire at each launch, sparks on the drift,
  // an explosion as you jump the roofs, fire at the docks
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  const cues = [
    [at(426, -290), 'fire', [-7, -2, 4]], [at(436, -357), 'sparks', [3, 0, 0]], [at(477, -279), 'explosion', [0, -18, 0]],
    [at(490, -186), 'fire', [0, -2, -8]], [at(540, -188), 'explosion', [6, -2, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Fast & Furious: Benton Street Run', land: 'Velocity', category: 'Thrill', thrill: 4, kind: 'coaster', carStyle: 'coaster',
    description: 'Jump in a street car for a night-time chase: a nitrous launch, a drift onto the main drag, up a parking garage, a jump between rooftops, the highway and a second launch through the docks. It\'s all about family.',
    baseWait: 75, origin, entrance: [entrance[0], 0, entrance[1]], exit: [400, 0, -232], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, ORANGE, BLUE], cues,
  });
  return { ride, gate: { x: 370, z: gz }, indoor: { x0: W.x0, x1: W.x1, z0: W.z0, z1: W.z1 } };

  // a street car prop: body, cabin, glass, wheels (and lights)
  function heroCar(x, y, z, color, yaw = 0, plain = false) {
    const c = color;
    const ux = Math.sin(yaw), uz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const P2 = (dx, dz) => [x + rx * dx + ux * dz, z + rz * dx + uz * dz];
    add([6.6, 2.2, 11.5], [x, y + 1.9, z], c, 'SmoothPlastic', { yaw, collide: 0 });
    let [qx, qz] = P2(0, 0.8);
    add([5.8, 1.9, 5.4], [qx, y + 3.95, qz], 0x14181e, 'Glass', { yaw, collide: 0 });
    [qx, qz] = P2(0, 4.6);
    add([6.2, 0.25, 1.3], [qx, y + 4.1, qz], c, 'SmoothPlastic', { yaw, collide: 0 });
    for (const [dx, dz] of [[-3.2, -3.8], [3.2, -3.8], [-3.2, 3.6], [3.2, 3.6]]) {
      [qx, qz] = P2(dx, dz);
      add([0.9, 2.5, 2.5], [qx, y + 1.25, qz], 0x111111, 'Rubber', { shape: 2, yaw, collide: 0 });
    }
    if (plain) return;
    [qx, qz] = P2(0, 0);
    add([5.4, 0.12, 9.6], [qx, y + 0.5, qz], 0x40ff80, 'Neon', { yaw, collide: 0 });
    for (const dx of [-2.2, 2.2]) { [qx, qz] = P2(dx, -5.8); add([1.4, 0.6, 0.2], [qx, y + 2.3, qz], 0xfff4d8, 'Neon', { yaw, collide: 0 }); }
  }
}

// a toast the first time you walk up to the new ride
export class FastFuriousSite {
  constructor(hooks, layout) {
    this.hooks = hooks; // { toast, sound }
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 50) {
      this.told = true;
      this.hooks.toast('Fast & Furious: Benton Street Run is now open! Walk through the arch, grab a car and ride with the family.', 'reward');
    }
  }
}
