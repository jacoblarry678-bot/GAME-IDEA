// Wolverine is finished and open beyond Backwoods' west wall. A path from
// the Backwoods plaza leads round the Rapids to a new gate in the wall,
// where guests wind through the queue beside the launch and board inside a
// "Weapon X" bunker. The ride: a launch out of the bunker, an 80-stud top
// hat, an overbanked turn, a camelback, a swooping turn and home.
//
// Like Fast & Furious it is added to the park data as an ordinary ride
// (track, cars, seats, queue, crew, wait sign), so the simulation, crews,
// riders, sounds and the app all treat it the same way.
import * as THREE from 'three';
import { Sampler } from './rides.js';
import { makeTrack, queuePath } from './fastfurious.js';
import { LINES } from './guests.js';

export const RIDE_ID = 'Wolverine';
export const WV_SITE = { x0: -592, x1: -380, z0: -402, z1: -148 };
const LAND = { x0: -596, x1: -375, z0: -405, z1: -140 };
const GATE = { z0: -201.75, z1: -165.25 }; // between the west wall's pillars at z -204 and -163
const G = 0.1;
const FLOOR = 0.5; // top of the queue paving
const PLATFORM = 1.4;
const CARS = 4, SPACING = 7.5;
const TRACK_X = -400, FRONT = -200;
const BUNKER = { x0: -412, x1: -386, z0: -216, z1: -162, h: 16 };
const YELLOW = 0xf2c818, BLUE = 0x1e3a8a, BLACK = 0x101012, WHITE = 0xf4f4f0, CLAW = 0xe8eef4, LAB = 0x5aa8ff;
const CONCRETE = 0x8e8c88;
// the path from the Backwoods plaza, south round the Rapids, to the gate
const ROUTE = [[-244, -168], [-264, -153], [-310, -154], [-330, -176], [-372, -183.5]];

// the circuit: x, y, z of the rails and the speed there, starting where
// the front car stops in the station
const CIRCUIT = [
  [TRACK_X, PLATFORM, FRONT, 2],
  // out of the bunker and the launch
  [TRACK_X, PLATFORM, -222, 7], [TRACK_X, 1.6, -245, 22], [-401, 2.4, -285, 38],
  // the top hat
  [-405, 22, -318, 32], [-414, 62, -338, 17], [-425, 80, -351, 9], [-438, 66, -362, 16], [-452, 26, -373, 34], [-470, 7, -381, 38],
  // the overbanked turn
  [-500, 9, -388, 36], [-532, 16, -386, 32], [-562, 30, -370, 24], [-576, 34, -340, 22], [-570, 28, -310, 25],
  // the camelback
  [-560, 12, -290, 32], [-555, 44, -264, 14], [-550, 14, -238, 30],
  // the swooping turn and home
  [-546, 10, -205, 31], [-532, 24, -176, 22], [-502, 28, -162, 20], [-470, 16, -166, 26], [-444, 8, -160, 22],
  [-425, 3, -152, 12], [-407, PLATFORM, -156, 6], [TRACK_X, PLATFORM, -168, 4], [TRACK_X, PLATFORM, -184, 3],
];

export function helpers(data) {
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

// distance from (x, z) to a polyline
function distTo(route, x, z) {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const [xa, za] = route[i], [xb, zb] = route[i + 1];
    const dx = xb - xa, dz = zb - za;
    const t = Math.max(0, Math.min(1, ((x - xa) * dx + (z - za) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - xa - dx * t, z - za - dz * t));
  }
  return best;
}

export function buildWolverine(data) {
  const { add, box, sign, cf, mi } = helpers(data);
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const lamp = (x, z, color = 0xfff0c8) => {
    box([0.5, 12, 0.5], [x, G, z], 0x2e3238, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 12.6, z], color, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 12.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };
  // three neon claw slashes across a face whose normal is along x
  const claws = (x, y, z, len = 10, color = CLAW) => {
    const a = -0.55, rot = [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
    for (let k = 0; k < 3; k++) add([0.25, 0.5, len], [x, y + (k - 1) * 1.8, z + (k - 1) * 1.1], color, 'Neon', { rot, collide: 0 });
  };

  // ---- the land: level it, clear its trees, it is part of Backwoods now
  data.flatZones = [...(data.flatZones || []), { ...LAND, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], LAND, 8) && distTo(ROUTE, t.pos[0], t.pos[2]) > 8);
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [LAND.x0, LAND.z0, LAND.x1, LAND.z1]];

  // ---- clear the props (rocks, part-built pines, a barrel) off the path,
  // and open the west wall between two pillars for the gate
  data.static.forEach((p, i) => {
    if (!p[19] || data.hidden.includes(i)) return;
    const ex = (Math.abs(p[7]) * p[1] + Math.abs(p[9]) * p[3]) / 2, ez = (Math.abs(p[13]) * p[1] + Math.abs(p[15]) * p[3]) / 2;
    const top = p[5] + p[2] / 2, mat = data.materials[p[17]];
    const kind = mat === 'Slate' || mat === 'Grass' || (mat === 'Wood' && p[0] === 2);
    const onPath = ex < 7 && ez < 7 && top > 0.8 && top < 26 && distTo(ROUTE, p[4], p[6]) < 5.5 + Math.max(ex, ez);
    const fixture = top < 16 && [[-271, -157], [-304.5, -154.5], [-299.5, -156], [-314.5, -160]].some(([x, z]) => Math.hypot(p[4] - x, p[6] - z) < 1.8);
    const prop = (kind && onPath) || fixture;
    const wall = Math.abs(p[4] + 375) < 0.5 && p[3] > 300 && p[6] - p[3] / 2 < GATE.z0 && p[6] + p[3] / 2 > GATE.z1;
    if (prop || wall) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(-375, -405, -375, GATE.z0);
  wallSeg(-375, GATE.z1, -375, -81.5); // down to the Overdrive building
  wallSeg(-375, -405, LAND.x0, -405);
  wallSeg(LAND.x0, -405, LAND.x0, LAND.z1);
  wallSeg(LAND.x0, LAND.z1, -560, LAND.z1); // meets Overdrive's land wall
  const gz = (GATE.z0 + GATE.z1) / 2;

  // ---- the path, with a signpost where it leaves the plaza and lamps
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [xa, za] = ROUTE[i], [xb, zb] = ROUTE[i + 1];
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([9, 0.4, len + 9], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x8a7a62, 'Pavement', { yaw, collide: 0 });
    add([10, 0.36, len + 10], [(xa + xb) / 2, 0.19, (za + zb) / 2], 0x5a4e3e, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
  }
  box([0.6, 9, 0.6], [-252, G, -178], 0x3a2a1e, 'Wood');
  for (const face of ['Right', 'Left']) {
    sign([0.3, 3.4, 10], [-252 + (face === 'Right' ? 0.4 : -0.4), G + 9.4, -178], 0x14161c, face, [['WOLVERINE', 0, 0, 1, 0.66, YELLOW], ['NOW OPEN  ·  THIS WAY', 0, 0.66, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  }
  for (const [x, z] of [[-276, -146], [-314, -147], [-352, -189]]) lamp(x, z, YELLOW);

  // ---- the gate: an arch in the wall, claw marks across the sign
  const ax = -376;
  for (const z of [GATE.z0 + 1.6, GATE.z1 - 1.6]) {
    box([3.2, 20, 3.2], [ax, G, z], 0x1a1c22, 'Metal');
    add([0.4, 18, 0.4], [ax + 1.7, G + 10, z], YELLOW, 'Neon', { collide: 0 });
  }
  add([4, 6, GATE.z1 - GATE.z0 + 2], [ax, G + 23, gz], 0x1a1c22, 'Metal', { collide: 0 });
  for (const [dx, face] of [[2.2, 'Right'], [-2.2, 'Left']]) {
    sign([0.3, 4.2, 30], [ax + dx, G + 23.6, gz], 0x1a1c22, face, [['WOLVERINE', 0, 0, 1, 0.64, YELLOW], ['NOW OPEN', 0, 0.64, 1, 0.36, WHITE, 'GothamBold']], { glow: true });
    claws(ax + dx * 1.1, G + 23.6, gz + 8, 8);
  }
  // hazard stripes across the ground under the arch
  for (let k = 0; k < 12; k++) add([3, 0.05, 2.9], [ax, FLOOR + 0.02, GATE.z0 + 1.5 + k * 2.95], k % 2 ? YELLOW : BLACK, 'SmoothPlastic', { collide: 0 });
  // the live wait sign in the park, and a greeter
  box([0.6, 6, 0.6], [-368, G, GATE.z0 - 6], 0x2e3238, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [-368, G + 9, GATE.z0 - 6], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 23, cf: cf(-370, G, gz + 6, -Math.PI / 2) });
  for (const z of [GATE.z0 - 2, GATE.z1 + 2]) lamp(-366, z, YELLOW);

  // ---- the forecourt and queue paving
  const QROWS = [-394, -389.4, -384.8, -380.2];
  const north = -296, south = -222;
  add([11, 0.4, BUNKER.z1 - BUNKER.z0], [-380.5, FLOOR - 0.2, (BUNKER.z0 + BUNKER.z1) / 2], 0x3e4046, 'Pavement');
  add([21, 0.4, BUNKER.z0 - (north - 6)], [-385.5, FLOOR - 0.2, (north - 6 + BUNKER.z0) / 2], 0x3e4046, 'Pavement');
  add([14, 0.4, GATE.z1 - GATE.z0], [-370, FLOOR - 0.2, gz], 0x3e4046, 'Pavement');

  // ---- the track and its supports
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4();
  const P = new THREE.Vector3(), U = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < track.cum.length; i++) pts.push([track.pos[i * 3], track.pos[i * 3 + 1], track.pos[i * 3 + 2], track.cum[i]]);
  for (let s = 8; s < track.length - 6; s += 10) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    const foot = P.clone().addScaledVector(U, -1.6);
    if (foot.y < 3) continue;
    const blocked = pts.some(([x, y, z, c]) => Math.abs(c - s) > 14 && y < foot.y - 1 && Math.hypot(x - foot.x, z - foot.z) < 5);
    if (blocked) continue;
    const h = foot.y - G;
    add([1.4, h, 1.4], [foot.x, G + h / 2, foot.z], BLUE, 'Metal', { shape: 5, collide: 0 });
    box([3, 0.8, 3], [foot.x, G, foot.z], 0xa8a49c, 'Concrete', { collide: 0 });
  }
  // the launch: yellow and grey fins between the rails, blue gantries
  for (let z = -226, k = 0; z > -290; z -= 4, k++) add([1, 0.3, 2.4], [TRACK_X, 0.9, z], k % 2 ? YELLOW : 0x3a3e46, 'Metal', { collide: 0 });
  for (let z = -232; z > -290; z -= 16) {
    for (const dx of [-5.5, 5.5]) box([0.4, 8, 0.4], [TRACK_X + dx, G, z], 0x2e3238, 'Metal', { collide: 0 });
    add([11.4, 0.5, 0.5], [TRACK_X, G + 8, z], 0x2e3238, 'Metal', { collide: 0 });
    add([9, 0.3, 0.3], [TRACK_X, G + 7.6, z], LAB, 'Neon', { collide: 0 });
  }
  light(TRACK_X, 6, -260, LAB);

  // ---- the bunker: the Weapon X station
  const B = BUNKER, T = 1.2, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  const doorQ = -394, doorX = -176; // queue door (north wall, at x) and exit door (east wall, at z)
  box([B.x1 - B.x0, 0.6, B.z1 - B.z0], [bx, G, bz], 0x2a2a2e, 'Concrete', { collide: 0 });
  box([T, B.h, B.z1 - B.z0], [B.x0 + T / 2, G, bz], CONCRETE, 'Concrete');
  for (const [za, zb] of [[B.z0, doorX - 3.5], [doorX + 3.5, B.z1]]) box([T, B.h, zb - za], [B.x1 - T / 2, G, (za + zb) / 2], CONCRETE, 'Concrete');
  box([T, B.h - 8, 7], [B.x1 - T / 2, G + 8, doorX], CONCRETE, 'Concrete');
  // north wall: open for the track and the queue door; south: for the track
  const xa = TRACK_X - 4.5, xb = doorQ + 2;
  box([xa - B.x0, B.h, T], [(B.x0 + xa) / 2, G, B.z0 + T / 2], CONCRETE, 'Concrete');
  box([B.x1 - xb, B.h, T], [(xb + B.x1) / 2, G, B.z0 + T / 2], CONCRETE, 'Concrete');
  box([xb - xa, B.h - 8, T], [(xa + xb) / 2, G + 8, B.z0 + T / 2], CONCRETE, 'Concrete');
  const sa = TRACK_X - 6.5, sb = TRACK_X + 4.5;
  box([sa - B.x0, B.h, T], [(B.x0 + sa) / 2, G, B.z1 - T / 2], CONCRETE, 'Concrete');
  box([B.x1 - sb, B.h, T], [(sb + B.x1) / 2, G, B.z1 - T / 2], CONCRETE, 'Concrete');
  box([sb - sa, B.h - 8, T], [(sa + sb) / 2, G + 8, B.z1 - T / 2], CONCRETE, 'Concrete');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [bx, G + B.h + 0.7, bz], 0x5a5c60, 'Concrete', { collide: 0 });
  // hazard stripes round the top, and WEAPON X over the track portals
  for (let z = B.z0 + 1, k = 0; z < B.z1; z += 4, k++) add([0.3, 1.4, 2], [B.x1 + 0.2, G + B.h - 1, z], k % 2 ? YELLOW : BLACK, 'SmoothPlastic', { collide: 0 });
  for (const [z, face] of [[B.z0 - 0.3, 'Front'], [B.z1 + 0.3, 'Back']]) {
    const cx = face === 'Front' ? (xa + TRACK_X + 2) / 2 : TRACK_X - 1;
    add([7, 0.6, 0.3], [cx, G + 7.6, z], YELLOW, 'Neon', { collide: 0 });
    sign([7, 1.6, 0.3], [cx, G + 10, z], BLACK, face, [['WEAPON X', 0, 0, 1, 1, YELLOW, 'GothamBold']], { glow: true });
  }
  // the big sign on the east face, claw slashes through it
  sign([0.3, 6, 30], [B.x1 + 0.3, G + 11.4, -198], BLACK, 'Right', [['WOLVERINE', 0, 0.04, 1, 0.66, YELLOW], ['WEAPON X FACILITY', 0, 0.7, 1, 0.28, WHITE, 'GothamBold']], { glow: true });
  claws(B.x1 + 0.5, G + 11.4, -186, 10);
  add([5, 0.5, 9], [B.x1 + 2.5, G + 8.6, doorX], 0x1a1c22, 'Metal', { collide: 0 });
  sign([0.2, 1.4, 6], [B.x1 + 5.1, G + 8.6, doorX], 0x1a1c22, 'Right', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  sign([6, 1.4, 0.2], [doorQ, G + 9, B.z0 - 0.8], 0x1a1c22, 'Front', [['TO THE CARS', 0, 0, 1, 1, YELLOW, 'GothamBold']], { glow: true });
  light(-380, 10, -196, YELLOW);

  // ---- inside: the platform beside the track, a lab along the far wall
  const px0 = TRACK_X + 3.4, px1 = B.x1 - T;
  box([px1 - px0, PLATFORM - G, B.z1 - B.z0 - 2 * T - 0.2], [(px0 + px1) / 2, G, bz], 0x4a4a4e, 'Concrete');
  add([0.6, 0.06, B.z1 - B.z0 - 3], [px0 + 0.4, PLATFORM + 0.03, bz], YELLOW, 'SmoothPlastic', { collide: 0 });
  box([4, PLATFORM - FLOOR, 4], [doorQ, FLOOR, B.z0 - 2], 0x4a4a4e, 'Concrete'); // a step up into the station
  box([4, PLATFORM - FLOOR, 4], [B.x1 + 2, FLOOR, doorX], 0x4a4a4e, 'Concrete'); // and down at the exit
  sign([0.3, 3, 20], [B.x0 + T + 0.2, 9, -192], 0x0a1020, 'Right', [['ADAMANTIUM BONDING', 0, 0, 1, 0.6, LAB], ['SUBJECT: LOGAN', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  for (const z of [-208, -176]) {
    box([3.4, 7, 3.4], [B.x0 + 3, G, z], 0x3a3e46, 'Metal', { shape: 5, collide: 0 });
    add([2.6, 5, 2.6], [B.x0 + 3, G + 4, z], LAB, 'Glass', { shape: 5, collide: 0, trans: 0.3 });
  }
  for (let z = B.z0 + 6; z < B.z1 - 4; z += 12) add([0.4, 0.4, 6], [bx, B.h - 1, z], 0xcfe4ff, 'Neon', { collide: 0 });
  light(-398, 12, -190, LAB);
  light(-398, 12, -172, 0xffecbe);
  const con = [px1 - 1.6, FRONT - 6];
  box([1.4, 3, 2.4], [con[0], PLATFORM, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLATFORM + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });

  // ---- the queue: four switchback rows beside the launch
  const entrance = [QROWS[3], -214];
  const pathPts = [[px0 + 2.4, FRONT], [px0 + 2.4, B.z0 + 3], [doorQ, B.z0 - 3], [QROWS[0], south]];
  QROWS.forEach((x, k) => {
    if (k === 0) { pathPts.push([x, north]); return; }
    const goingSouth = k % 2 === 1;
    pathPts.push([x, goingSouth ? north : south]);
    pathPts.push([x, goingSouth ? south : north]);
  });
  pathPts.push(entrance, [-380.2, gz], [-368, gz]);
  const qpath = queuePath(pathPts, pathPts.length - 3, [1, 0], FLOOR);
  const RAIL = 0x2e3238, TOP = YELLOW;
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
  for (let k = 0; k < QROWS.length - 1; k++) {
    const x = (QROWS[k] + QROWS[k + 1]) / 2;
    // the gap is at the end where the line turns between these two rows
    if (k % 2 === 0) railZ(x, north + 3.4, k === 0 ? B.z0 : south + 3.5); else railZ(x, north - 2, south - 3.4);
  }
  railZ(QROWS[0] - 2.75, north - 2, B.z0); // between the line and the launch
  railZ(QROWS[3] + 2.75, north - 2, -210);
  railX(QROWS[0] - 2.75, QROWS[3] + 2.75, north - 2);
  railX(QROWS[0] + 2.3, QROWS[3] - 2.3, south + 3.5);
  // shade canopies and lamps over the rows
  for (let z = north + 10, k = 0; z < south; z += 22, k++) {
    add([18, 0.2, 12], [-387, 12, z], k % 2 ? YELLOW : BLUE, 'Fabric', { collide: 0, rot: [1, 0, 0, 0, 0.99, -0.12, 0, 0.12, 0.99] });
    lamp(-377.2, z);
  }
  // posters on the wall along the line
  [['SUBJECT: LOGAN', YELLOW], ['WEAPON X', LAB], ['THE CLAWS ARE OUT', YELLOW], ['80 STUDS UP', WHITE]].forEach(([text, c], k) => {
    sign([0.3, 3, 8], [-376.6, 7, -284 + k * 16], BLACK, 'Left', [[text, 0, 0, 1, 1, c]], { glow: true });
  });
  // the entrance sign at the start of the line
  box([0.4, 7, 0.4], [entrance[0] + 2.4, FLOOR, entrance[1] - 1.2], BLACK, 'Metal');
  sign([0.2, 2, 9], [entrance[0] + 2.2, FLOOR + 6.4, entrance[1] - 1.2], BLACK, 'Right', [['ENTRANCE', 0, 0, 1, 1, YELLOW]], { glow: true });

  // ---- out in the land: claw-slashed boulders, pines, lamps
  for (const [x, z, r] of [[-470, -300, 9], [-520, -262, 7], [-452, -226, 6], [-500, -344, 8]]) {
    add([r * 2, r * 1.4, r * 2], [x, r * 0.5, z], 0x4a4640, 'Slate', { shape: 3 });
    claws(x + r * 0.95, r * 0.9, z, r * 0.9, 0xbfe0ff);
  }
  const occupied = (x, z) => pts.some(([px, , pz]) => Math.hypot(px - x, pz - z) < 9) || inRect(x, z, { x0: -420, x1: -375, z0: -302, z1: -150 });
  for (let k = 0; k < 34; k++) {
    const x = LAND.x0 + 10 + ((k * 53) % 200), z = LAND.z0 + 10 + ((k * 89) % 250);
    if (occupied(x, z)) continue;
    data.trees.push({ leaf: 0x2f5a2a, kind: 'pine', s: 1 + ((k * 13) % 7) / 10, pos: [x, 0, z] });
  }
  for (const [x, z] of [[-430, -230], [-520, -330], [-470, -190], [-560, -220]]) {
    box([0.6, 16, 0.6], [x, G, z], 0x5a5e66, 'Metal');
    for (const dx of [-1.2, 1.2]) add([2, 1.4, 0.8], [x + dx, G + 16.4, z], 0xfff6d8, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x, G + 16, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  light(-425, 76, -351, YELLOW);
  light(-555, 40, -264, LAB);

  // ---- the train: four cars, yellow and blue, claws on the front
  const thunder = data.rides.find((r) => r.id === 'DieselThunder');
  const paints = [{ body: YELLOW, stripe: BLUE }, { body: BLUE, stripe: YELLOW }];
  const pp = (shape, size, pos, color, mat) => [shape, ...size, ...pos, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
  const carParts = (k) => {
    const paint = paints[k % 2];
    const body = thunder.cars[0].parts.map((p) => {
      const q = p.slice();
      if (p[16] === 0xc42828) q[16] = paint.body;
      else if (p[16] === 0xf0c440) q[16] = paint.stripe;
      return q;
    });
    const extra = [pp(0, [5.4, 0.12, 8], [0, -0.3, -1.4], LAB, 'Neon')];
    if (k === 0) for (const dx of [-0.8, 0, 0.8]) extra.push(pp(0, [0.2, 0.2, 2.6], [dx, 1.6, -7.2], 0xd8dee6, 'Metal'));
    return [...body, ...extra];
  };
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(thunder.seats[0].map((s) => s.slice()));
  }

  // ---- the crew: an operator at the console and an attendant on the bars
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(px0 + 1.2, PLATFORM, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 1, routes: [[1, 2, 3, 4]],
    console: cf(con[0], PLATFORM, con[1], Math.PI / 2),
    operator: cf(con[0] + 1.4, PLATFORM, con[1], Math.PI / 2),
    homes: [cf(px0 + 2, PLATFORM, -168, Math.PI / 2)],
    exit: cf(px1 - 2, PLATFORM, doorX, -Math.PI / 2),
  };

  // ---- the ride
  const origin = [-480, 0, -270];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: YELLOW }, extras: {}, extrasNames: [], crew,
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
  // sparks off the claws at the launch, over the top hat and the camelback
  const cues = [
    [at(-400, -250), 'sparks', [-3, -1, 2]], [at(-425, -351), 'sparks', [3, 0, 0]],
    [at(-555, -264), 'sparks', [-3, 0, 0]], [at(-532, -176), 'explosion', [8, -14, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Wolverine', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'Break out of the Weapon X facility: a launch out of the bunker, straight up and over an 80-stud top hat, an overbanked turn, camelback airtime and a swooping turn home. The claws are out.',
    baseWait: 80, origin, entrance: [entrance[0], 0, entrance[1]], exit: [-381, 0, doorX], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [YELLOW, YELLOW, BLUE], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Wolverine is open! Snikt!', 'The claws are out - go ride Wolverine!'];
  return { ride, gate: { x: -368, z: gz }, site: WV_SITE };
}

// a toast the first time you walk up to the new ride
export class WolverineSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 60) {
      this.told = true;
      this.hooks.toast('WOLVERINE is now open! Through the gate and into the Weapon X bunker: an 80-stud top hat is waiting.', 'reward');
    }
  }
}
