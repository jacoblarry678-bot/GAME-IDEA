// Neon Gliders: an indoor suspended family coaster in Neon District, down in
// the Lower Lot. A black box of a building on the south side of Neon Square;
// inside, in the dark, hang gliders hang from a track under the roof - two
// riders each, feet dangling beneath a wing edged in neon. Up the lift along
// the north wall under the stars, a hairpin at the top, a swoop through the
// middle and through a spinning ring of light, a U-turn, back east through a
// second ring, and home along the south wall through a tunnel of neon arches.
//
// The track is built like any coaster and then turned over (as King Mamba's
// is): its "up" points down, so the spine runs on top and the gliders hang
// beneath. Hangers drop from the roof trusses wherever no glider passes.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { FLOOR } from './lowerlot.js';

export const RIDE_ID = 'NeonGliders';
const FL = FLOOR + 0.02;
const B = { x0: 532, x1: 638, z0: -995, z1: -945 }; // the building
const HALL = { x0: 554, x1: 636, z0: -993, z1: -947 }; // the ride hall inside
const QH = { x0: 534, x1: 552 }; // the queue hall, west of the ride hall
const TOP = 30; // walls this tall, roof on top
const DECK = 3; // the queue hall, the platform and the way out, raised
const CARS = 8, SPACING = 3.4;
const INK = 0x0c0c12, SHELL = 0x16141e, PINK = 0xff3a9a, CYAN = 0x2ae0f0, VIOLET = 0x9a4aff, AMBER = 0xffb040, WHITE = 0xf4f4f0, TRACK = 0x3a2a6a;
const Y = (h) => FLOOR + h;

// the circuit: x, height above the floor, z, and the speed there
const C = (x, h, z, v) => [x, Y(h), z, v];
const CIRCUIT = [
  // the station, heading north along the west side
  C(562, 9, -959, 2),
  // out round the north-west corner
  C(562, 9.2, -955.5, 3), C(564.5, 9.6, -953.2, 3.5), C(569, 10.2, -952.6, 3.6),
  // the lift east along the north wall
  C(578, 12.5, -952.6, 3.6), C(592, 17.5, -952.6, 3.5), C(606, 23, -952.6, 3.3),
  // the hairpin at the top, back west
  C(615, 24.6, -953.4, 3.2), C(621.5, 24.6, -957.6, 3.6), C(620, 24.2, -962.6, 5), C(612, 23, -963.6, 7),
  // the swoop through the middle, a hill, round the U-turn
  C(602, 17, -963.6, 12), C(592, 14.5, -963.6, 13.5), C(584, 17, -963.6, 11.5), C(577, 16, -964.5, 11),
  C(572, 15, -968.5, 11), C(572, 14, -973, 11.5), C(576.5, 13.2, -976.5, 12),
  // back east, through the second ring
  C(586, 11, -977, 13.5), C(596, 12.5, -977, 13), C(606, 14, -977, 12.5), C(616, 11.5, -977, 11.5),
  // round the south-east corner and west along the south wall, the tunnel of arches
  C(625.5, 10.6, -980.2, 10), C(626, 10.2, -985, 10), C(618.5, 10, -987.6, 11.5), C(606, 12.5, -987.6, 12), C(594, 10, -987.6, 13),
  C(582, 10.4, -987.6, 11),
  // round the south-west corner and into the station
  C(570, 9.8, -987.4, 7), C(564, 9.4, -985, 4), C(562, 9.1, -980, 2.5), C(562, 9, -970, 2),
];

export function buildNeonGliders(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.hidden = data.hidden || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const unseen = (size, pos) => data.hidden.push(add(size, pos, INK, 'SmoothPlastic'));

  // ======== the track, turned over
  const track = makeTrack(CIRCUIT);
  track.up = track.up.map((v) => -v);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), Uf = new THREE.Vector3(), R = new THREE.Vector3();
  const L = track.length;
  // the gliders' envelope along the whole track: in each frame (whose up
  // points down, to the gliders) anything within 3.7 to the side and from
  // just above the spine to 8.6 below the rails is in their way
  const frames = [];
  for (let s = 0; s < L; s += 0.5) {
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
  const clearPt = (x, y, z, skipS = null) => {
    for (const f of near(x, z)) {
      if (skipS !== null && Math.abs(f[12] - skipS) < 2.5) continue;
      const dx = x - f[0], dy = y - f[1], dz = z - f[2];
      if (Math.abs(dx) > 10 || Math.abs(dz) > 10 || Math.abs(dy) > 14) continue;
      const lz = f[9] * dx + f[10] * dy + f[11] * dz;
      if (Math.abs(lz) > 0.3) continue;
      const lx = f[3] * dx + f[4] * dy + f[5] * dz, ly = f[6] * dx + f[7] * dy + f[8] * dz;
      if (Math.abs(lx) < 3.9 && ly > -2.3 && ly < 8.8) return false;
    }
    return true;
  };
  const clearBox = (size, pos) => {
    for (let x = -size[0] / 2; x <= size[0] / 2 + 0.01; x += Math.max(0.5, size[0] / 6)) for (let y = -size[1] / 2; y <= size[1] / 2 + 0.01; y += Math.max(0.5, size[1] / 6)) for (let z = -size[2] / 2; z <= size[2] / 2 + 0.01; z += Math.max(0.5, size[2] / 6)) {
      if (!clearPt(pos[0] + x, pos[1] + y, pos[2] + z)) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearBox(size, pos) ? add(size, pos, color, mat, o) : -1);
  const tAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best];
  };

  // ======== the building: black walls, a roof, neon round the top
  // (the rocks at the foot of the cliff behind it go: the back wall is there now)
  for (let i = 0; i < data.static.length; i++) {
    const p = data.static[i];
    if (p[4] > B.x0 && p[4] < B.x1 && p[6] > B.z0 - 3 && p[6] < B.z1 && data.materials[p[17]] === 'Slate' && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  }
  const wall = (x0, x1, z0, z1, h0 = 0, h1 = TOP) => box([x1 - x0, h1 - h0, z1 - z0], [(x0 + x1) / 2, FL + h0, (z0 + z1) / 2], SHELL, 'Concrete');
  // west wall, with the entrance door (z -953..-949) at the top of the steps
  wall(B.x0, QH.x0, B.z0, -953);
  wall(B.x0, QH.x0, -949, B.z1);
  wall(B.x0, QH.x0, -953, -949, DECK + 6, TOP);
  // north wall, with the exit door (x 554..558.4) onto the steps down to the square
  wall(B.x0, 554, HALL.z1, B.z1);
  wall(558.4, B.x1, HALL.z1, B.z1);
  wall(554, 558.4, HALL.z1, B.z1, DECK + 6, TOP);
  // east and south walls
  wall(HALL.x1, B.x1, B.z0, HALL.z1);
  wall(QH.x0, HALL.x1, B.z0, HALL.z0);
  // between the queue hall and the ride hall, a doorway (z -988..-984) onto the platform
  wall(QH.x1, 554, HALL.z0, -988);
  wall(QH.x1, 554, -984, HALL.z1);
  wall(QH.x1, 554, -988, -984, DECK + 6, TOP);
  add([B.x1 - B.x0, 1, B.z1 - B.z0], [(B.x0 + B.x1) / 2, FL + TOP + 0.5, (B.z0 + B.z1) / 2], SHELL, 'Concrete');
  for (const [a, b, z] of [[B.x0, B.x1, B.z1 + 0.2], [B.x0, B.x1, B.z0 - 0.2]]) neon([b - a, 0.4, 0.3], [(a + b) / 2, FL + TOP + 0.6, z], PINK);
  for (const [a, b, x] of [[B.z0, B.z1, B.x0 - 0.2], [B.z0, B.z1, B.x1 + 0.2]]) neon([0.3, 0.4, b - a], [x, FL + TOP + 0.6, (a + b) / 2], CYAN);
  for (const [x, z] of [[B.x0 - 0.2, B.z1 + 0.2], [B.x1 + 0.2, B.z1 + 0.2], [B.x0 - 0.2, B.z0 - 0.2], [B.x1 + 0.2, B.z0 - 0.2]]) neon([0.4, TOP, 0.4], [x, FL + TOP / 2, z], VIOLET);
  // the north front, over Neon Square: the name, and a glider drawn in neon
  sign([44, 6, 0.4], [600, FL + 24, B.z1 + 0.35], INK, 'Back', [['NEON GLIDERS', 0, 0, 1, 0.72, PINK], ['FLY THE NIGHT  ·  NEON DISTRICT', 0, 0.72, 1, 0.28, CYAN, 'GothamBold']], { glow: true });
  const gx = 600, gy = FL + 13;
  for (const sd of [-1, 1]) {
    const a = -sd * 0.41; // the wings sweep back from the nose
    neon([16, 0.5, 0.3], [gx + sd * 7.4, gy - 3.2, B.z1 + 0.35], CYAN, { rot: RZ(a) });
  }
  neon([29.6, 0.5, 0.3], [gx, gy - 6.4, B.z1 + 0.35], PINK);
  neon([0.5, 6.4, 0.3], [gx, gy - 3.2, B.z1 + 0.35], WHITE);
  // over the exit door
  sign([6, 1.4, 0.3], [556.2, FL + DECK + 7.4, B.z1 + 0.35], INK, 'Back', [['EXIT', 0, 0, 1, 1, AMBER, 'GothamBold']], { glow: true });
  // the west front, over the walkway: the entrance
  sign([0.4, 5, 40], [B.x0 - 0.35, FL + 21, -970], INK, 'Left', [['NEON GLIDERS', 0, 0, 1, 0.7, PINK], ['ENTRANCE  >', 0, 0.7, 1, 0.3, CYAN, 'GothamBold']], { glow: true });
  add([7, 0.4, 8], [B.x0 - 3.5, FL + DECK + 7.2, -951], INK, 'Metal', { collide: 0 });
  neon([7.2, 0.3, 0.3], [B.x0 - 3.5, FL + DECK + 7.2, -947], PINK);
  neon([7.2, 0.3, 0.3], [B.x0 - 3.5, FL + DECK + 7.2, -955], CYAN);
  // steps up from the walkway to the door, and down from the exit to the square
  for (let k = 0; k < 5; k++) {
    box([7 - k * 1.3, (k + 1) * 0.6, 6], [B.x0 - (7 - k * 1.3) / 2, FL, -951], 0x2a2a32, 'Concrete');
    box([4.4, (k + 1) * 0.6, 6.5 - k * 1.3], [556.2, FL, B.z1 + (6.5 - k * 1.3) / 2], 0x2a2a32, 'Concrete');
  }
  // the ride's wait time by the door
  box([0.3, 8, 0.3], [B.x0 - 6.5, FL, -956.5], INK, 'Metal', { collide: 0 });
  sign([0.3, 1.6, 6], [B.x0 - 6.5, FL + 8.6, -956.5], INK, 'Left', [['NEON GLIDERS', 0, 0, 1, 1, PINK, 'GothamBold']], { glow: true });
  const waitPart = add([0.3, 1.2, 4], [B.x0 - 6.7, FL + 6.8, -956.5], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'NeonDistrict', seed: 517, cf: cf(B.x0 - 8.5, FL, -949, Math.PI / 2) });

  // ======== inside: the raised deck (queue hall, platform, the way out), the floor
  box([QH.x1 - QH.x0 + 2, DECK, HALL.z1 - HALL.z0], [(QH.x0 + QH.x1) / 2 + 1, FL, (HALL.z0 + HALL.z1) / 2], 0x1a1a22, 'Concrete');
  box([4.4, DECK, -949 + 953], [B.x0 + 1, FL, -951], 0x1a1a22, 'Concrete'); // (the doorway)
  const PL = { x0: 554, x1: 558.4, z0: -988, z1: HALL.z1 };
  box([PL.x1 - PL.x0, DECK, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, FL, (PL.z0 + PL.z1) / 2], 0x1e1e28, 'Concrete');
  box([PL.x1 - PL.x0, DECK, 2], [(PL.x0 + PL.x1) / 2, FL, B.z1 - 1], 0x1e1e28, 'Concrete'); // (the exit door)
  neon([0.3, 0.06, PL.z1 - PL.z0], [PL.x1 - 0.3, FL + DECK + 0.03, (PL.z0 + PL.z1) / 2], AMBER);
  // (an unseen wall along the platform's edge: nobody steps off into the ride hall)
  unseen([0.4, 6, PL.z1 - PL.z0], [PL.x1 + 0.2, FL + DECK + 3, (PL.z0 + PL.z1) / 2]);
  // the ride hall's floor, black, with neon lines on it
  add([HALL.x1 - PL.x1, 0.1, HALL.z1 - HALL.z0], [(PL.x1 + HALL.x1) / 2, FL + 0.05, (HALL.z0 + HALL.z1) / 2], 0x08080c, 'SmoothPlastic', { collide: 0 });
  for (let x = 566; x < HALL.x1 - 4; x += 12) neon([0.2, 0.05, HALL.z1 - HALL.z0 - 6], [x, FL + 0.12, (HALL.z0 + HALL.z1) / 2], VIOLET);
  for (let z = HALL.z0 + 7; z < HALL.z1 - 4; z += 12) neon([HALL.x1 - PL.x1 - 8, 0.05, 0.2], [(PL.x1 + HALL.x1) / 2 + 2, FL + 0.12, z], VIOLET);

  // ======== the queue hall: switchbacks on the deck, posters, a dim glow
  const D = FL + DECK;
  const fwd = [[536, -951], [549, -951], [549, -955], [537, -955], [537, -959], [549, -959], [549, -963], [537, -963], [537, -967], [549, -967], [549, -971], [537, -971], [537, -975], [549, -975], [549, -979], [537, -979], [537, -983], [549, -983], [549, -986], [553, -986], [556, -984]];
  const qrail = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 3));
    for (let k = 0; k <= n; k++) box([0.25, 1.2, 0.25], [xa + ((xb - xa) * k) / n, D, z], 0x2a2a34, 'Metal');
    neon([xb - xa, 0.12, 0.12], [(xa + xb) / 2, D + 1.15, z], [PINK, CYAN, VIOLET][Math.abs(Math.round(z)) % 3]);
  };
  for (let z = -953, k = 0; z > -985; z -= 4, k++) qrail(k % 2 ? 539.5 : 535, k % 2 ? QH.x1 : 546.5, z);
  qrail(535, 546.5, -985);
  for (const [z, t, c] of [[-960, 'TAKE OFF AFTER DARK', PINK], [-972, 'KEEP YOUR FEET UP', CYAN], [-984, 'HOLD ON TO YOUR GLIDER', VIOLET]]) {
    sign([0.3, 3.4, 8], [QH.x0 + 0.2, D + 4.6, z], INK, 'Right', [[t, 0, 0.1, 1, 0.5, c], ['NEON GLIDERS', 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  }
  for (let z = -950; z > -990; z -= 9) neon([0.2, 0.2, 5], [QH.x1 - 0.2, D + 7, z], [PINK, CYAN, VIOLET][Math.abs(z) % 3]);
  for (const [z, c] of [[-955, PINK], [-970, CYAN], [-985, VIOLET]]) data.hauntLights.push([543, D + 7, z, c]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [-1, 0], D);

  // ======== the station: the platform along the west side, the operator's
  // booth at its north end, the NEON GLIDERS sign over it
  const con = [556.2, -956.5];
  box([1.6, 1.3, 1.4], [con[0], D, con[1]], 0x2a2a34, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] + 0.5, D + 1.4, con[1] - 0.4 + k * 0.4], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  S([0.4, 3, 22], [HALL.x0 + 0.4, D + 11, -972], INK, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 3, 22], [HALL.x0 + 0.6, D + 11, -972], INK, 'Right', [['NEON GLIDERS  ·  BOARDING', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });
  for (const z of [-962, -982]) data.hauntLights.push([556, D + 6, z, z > -970 ? CYAN : PINK]);

  // ======== the ride hall: hangers from the roof trusses, stars on the
  // ceiling, a skyline in neon on the walls, spinning rings, the tunnel
  const ROOF = FL + TOP;
  for (let x = HALL.x0 + 8; x < HALL.x1; x += 12) S([1, 1.2, HALL.z1 - HALL.z0], [x, ROOF - 0.6, (HALL.z0 + HALL.z1) / 2], 0x1a1a22, 'Metal', { collide: 0 });
  const strut = (a, b, w, color) => {
    const d = b.clone().sub(a), len = d.length();
    const yaw = Math.atan2(d.x, d.z), pitch = Math.asin(THREE.MathUtils.clamp(d.y / len, -1, 1));
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    add([w, w, len], [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], color, 'Metal', { collide: 0, rot: [c, -s * sp, s * cp, 0, cp, sp, -s, -c * sp, c * cp] });
  };
  const clearSeg = (a, b, skipS = null) => {
    const n = Math.ceil(a.distanceTo(b) / 0.5);
    for (let k = 0; k <= n; k++) { const q = a.clone().lerp(b, k / n); if (!clearPt(q.x, q.y, q.z, skipS)) return false; }
    return true;
  };
  let hangers = 0;
  for (let s = 4; s < L - 2; s += 6) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    Uf.setFromMatrixColumn(m4, 1); // toward the gliders
    if (Uf.y > -0.6) continue;
    const spine = P.clone().addScaledVector(Uf, -1.6);
    const top = new THREE.Vector3(spine.x, ROOF - 1.2, spine.z);
    if (top.y - spine.y < 0.6) continue;
    if (!clearSeg(spine.clone().addScaledVector(Uf, -0.6), top, s)) continue;
    strut(spine, top, 0.5, 0x2a2a34);
    hangers++;
  }
  // stars on the ceiling
  for (let k = 0; k < 90; k++) {
    const x = HALL.x0 + 3 + ((k * 37.3) % (HALL.x1 - HALL.x0 - 6)), z = HALL.z0 + 3 + ((k * 53.7) % (HALL.z1 - HALL.z0 - 6));
    add([0.35, 0.35, 0.35], [x, ROOF - 0.3, z], [WHITE, CYAN, PINK, 0xfff0b0][k % 4], 'Neon', { collide: 0, shape: 3 });
  }
  // a skyline in neon along the south and east walls
  let bx = HALL.x0 + 8;
  for (let k = 0; bx < HALL.x1 - 6; k++) {
    const w = 6 + ((k * 7) % 5), h = 8 + ((k * 11) % 12), c = [PINK, CYAN, VIOLET, AMBER][k % 4];
    neon([w, 0.25, 0.2], [bx + w / 2, FL + h, HALL.z0 + 0.15], c);
    for (const sx of [bx, bx + w]) neon([0.25, h, 0.2], [sx, FL + h / 2, HALL.z0 + 0.15], c);
    for (let y = 3; y < h - 1; y += 3) for (let x = bx + 1.5; x < bx + w - 1; x += 2.5) if ((x * 3 + y) % 5 < 2) neon([0.8, 0.8, 0.1], [x, FL + y, HALL.z0 + 0.1], 0xfff0c0);
    bx += w + 2;
  }
  for (let z = HALL.z0 + 6; z < HALL.z1 - 6; z += 10) neon([0.2, 0.4, 6], [HALL.x1 - 0.15, FL + 16 + ((z * 7) % 6), z], [CYAN, PINK, VIOLET][Math.abs(Math.round(z)) % 3]);
  // chevrons up the lift, on the north wall
  for (let x = 574; x < 606; x += 5) {
    const h = 10 + (x - 574) * 0.4;
    for (const sd of [-1, 1]) neon([1.6, 0.25, 0.15], [x + 0.6, FL + h + sd * 0.55, HALL.z1 - 0.15], AMBER, { rot: RZ(-sd * 0.7) });
  }
  // the tunnel of arches along the south wall: frames round the gliders
  for (let x = 574; x <= 614; x += 4) {
    // (each arch at the track's height there)
    let h = 10;
    for (const f of near(x, -987.6)) if (Math.abs(f[0] - x) < 0.6 && Math.abs(f[2] + 987.6) < 1) h = f[1] - FL;
    const c = [PINK, CYAN, VIOLET][((x - 574) / 4) % 3];
    const top = FL + h + 2.6;
    S([0.3, top - FL, 0.3], [x, (top + FL) / 2, -987.6 - 4.4], c, 'Neon', { collide: 0 });
    S([0.3, top - FL, 0.3], [x, (top + FL) / 2, -987.6 + 4.4], c, 'Neon', { collide: 0 });
    S([0.3, 0.3, 9.1], [x, top, -987.6], c, 'Neon', { collide: 0 });
  }
  // spinning rings round the track, one on the swoop and one on the way back
  const extras = {}, extrasNames = [], props = [];
  const ring = (name, x, z, color, other) => {
    let h = 14;
    for (const f of near(x, z)) if (Math.abs(f[0] - x) < 0.6 && Math.abs(f[2] - z) < 1) h = f[1] - FL;
    const cy = FL + h - 3.6, r = 6.2, parts = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      parts.push(pp(0, [0.5, 0.5, 1.5], [0, Math.cos(a) * r, Math.sin(a) * r], k % 2 ? color : other, 'Neon', RX(a)));
    }
    extras[name] = { pivot: [x, cy, z, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at: [x, cy, z], kind: 'spin', speed: 1.6 });
    extrasNames.push(name);
    data.hauntLights.push([x, cy, z, color]);
  };
  ring('RingOne', 593, -963.6, CYAN, PINK);
  ring('RingTwo', 606, -977, PINK, VIOLET);
  for (const [x, z, c] of [[580, -958, PINK], [612, -958, CYAN], [596, -970, VIOLET], [620, -984, PINK], [584, -988, CYAN], [570, -980, VIOLET], [626, -968, CYAN]]) data.hauntLights.push([x, FL + 14, z, c]);

  // ======== the gliders: a bogie under the rails, a delta wing edged in
  // neon, two riders hanging beneath, side by side
  // (in the car's frame +y points down, away from the rails)
  const UPRIGHT = [-1, 0, 0, 0, -1, 0, 0, 0, 1]; // a half turn about z: riders' heads toward the rails
  const WING = [PINK, CYAN, VIOLET, AMBER];
  const carParts = (k) => {
    const c = WING[k % 4];
    const out = [
      pp(0, [2.6, 0.6, 2.2], [0, 0.35, 0], 0x1e1e26, 'Metal'),
      pp(0, [0.4, 0.5, 0.4], [0, 0.85, 0], 0x1e1e26, 'Metal'),
      // the wing, its leading edge, its nose, lights on the tips
      pp(0, [6.6, 0.16, 1.7], [0, 1.08, 0.2], 0x14141c, 'SmoothPlastic'),
      pp(0, [6.8, 0.14, 0.18], [0, 1.02, -0.66], c, 'Neon'),
      pp(0, [6.6, 0.1, 0.12], [0, 1.0, 1.04], WHITE, 'Neon'),
      pp(1, [1.2, 0.3, 1.2], [0, 1.08, -1.2], c, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]),
      pp(3, [0.5, 0.5, 0.5], [-3.4, 1.05, 0.2], 0xff3030, 'Neon'),
      pp(3, [0.5, 0.5, 0.5], [3.4, 1.05, 0.2], 0x30ff60, 'Neon'),
      // the frame down to the seats, a foot bar
      pp(0, [0.15, 2.6, 0.15], [-1.4, 2.4, 0.5], 0x8a8a96, 'Metal'),
      pp(0, [0.15, 2.6, 0.15], [1.4, 2.4, 0.5], 0x8a8a96, 'Metal'),
      pp(0, [2.95, 0.15, 0.15], [0, 3.7, 0.5], 0x8a8a96, 'Metal'),
      pp(0, [2.6, 0.15, 0.3], [0, 7.6, -0.7], 0x8a8a96, 'Metal'),
      pp(0, [2.7, 0.08, 0.08], [0, 7.5, -0.7], c, 'Neon'),
    ];
    for (const x of [-0.7, 0.7]) {
      out.push(pp(0, [1.0, 2.2, 0.3], [x, 4.6, 0.6], INK, 'Fabric'));
      out.push(pp(0, [1.0, 0.3, 0.9], [x, 5.85, 0.15], INK, 'Fabric'));
      out.push(pp(0, [0.9, 0.12, 0.08], [x, 3.6, 0.42], c, 'Neon'));
    }
    return out;
  };
  const seatList = () => [-0.7, 0.7].map((x) => [x, 4.4, 0.15, ...UPRIGHT]);
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
    P.setFromMatrixPosition(m4);
    stops.push(cf(556.6, D, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2, 3, 4], [5, 6, 7, 8]],
    console: cf(con[0] - 0.9, D, con[1], -Math.PI / 2), operator: cf(con[0] - 1.2, D, con[1] + 1.2, -Math.PI / 2),
    homes: [cf(555.5, D, -968, -Math.PI / 2), cf(555.5, D, -980, -Math.PI / 2)],
    exit: cf(556.2, D, -951, Math.PI),
  };

  // ======== the ride
  const origin = [596, FLOOR, -970];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 2, queue: qpath, trackStyle: { style: 'steel', color: TRACK }, extras, extrasNames, props, crew,
    noExtended: true,
  };
  data.rides.push(ride);
  const at = (x, z) => tAt(x, z) / ride.duration;
  data.config.Rides.push({
    id: RIDE_ID, name: 'Neon Gliders', land: 'NeonDistrict', category: 'Family', thrill: 2, kind: 'coaster', carStyle: 'coaster',
    description: 'An indoor suspended coaster in Neon District, down in the Lower Lot. Hang beneath a glider edged in neon, feet dangling, and fly the dark: up the lift under the stars, a hairpin at the roof, a swoop through a spinning ring of light, a U-turn, and home through a tunnel of neon arches.',
    baseWait: 30, origin, entrance: [B.x0 - 7, FLOOR, -951], exit: [556.2, FLOOR, B.z1 + 9], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [PINK, CYAN, VIOLET], cues: [[at(600, -964), 'sparks', [0, 2, 0]]],
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Neon Gliders is open in Neon District - fly the dark!'];
  return { ride, entrance: [B.x0 - 7, -951], indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, hangers };
}

// a toast the first time you come near
export class NeonGlidersSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const [x, z] = this.layout.entrance;
    if (pos.y < FLOOR + 10 && Math.hypot(pos.x - x, pos.z - z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: Neon Gliders - hang beneath a glider and fly the dark, in Neon District!', 'reward');
    }
  }
}
