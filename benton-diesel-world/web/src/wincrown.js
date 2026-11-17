// Operation: Win the Crown - an indoor RMC-style coaster on T-Rex-style
// track (flat topper rails on a deep T-shaped steel girder), in a fortress
// north of RC Race (through a gate in RC Race's north wall).
// Baron Vex (the park's own villain) has stolen the Benton Crown and locked
// it in his fortress. You're the agents sent to win it back: the mission
// briefing, a lift through the laser grid, a twisting first drop past the
// guard towers, a zero-g stall over the vault, an airtime hill, a barrel
// roll, a helix round the throne room, a zero-g roll and the crown itself
// at the end.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { carriedFrames } from './cyclone.js';

export const RIDE_ID = 'WinTheCrown';
const SITE = { x0: -796, x1: -598, z0: 384, z1: 510 };
const B = { x0: -790, x1: -648, z0: 392, z1: 500, H: 34 }; // the fortress
const GATE = { x0: -611, x1: -601 }; // in RC Race's north wall (z 382)
const G = 0.1;
const CARS = 4, SPACING = 3.4;
const NAVY = 0x10162a, GOLD = 0xf0c040, RED = 0xe0202a, PURPLE = 0x5a2a8a, STONE = 0x6a6660, WHITE = 0xf2f2ee, STEEL = 0x8e949c, DARK = 0x16181c;
const TRACK_COLOR = 0x2a4ad8;

const CIRCUIT = [
  [-684, 2, 404, 2],
  // out of the briefing room, round to the north and up the lift
  [-698, 2.2, 404, 4], [-710, 2.6, 406, 4], [-718, 3, 414, 4], [-720, 4, 426, 4], [-720, 6, 432, 4], [-720, 17, 448, 4], [-720, 26, 462, 3.5],
  // the crest and the twisting first drop
  [-720, 28, 470, 4], [-721, 25, 476, 9], [-724, 14, 482, 18], [-730, 4, 486, 24], [-742, 2.5, 488, 25],
  // the zero-g stall, west
  [-750, 9, 488, 23], [-760, 14, 487.5, 20], [-770, 14, 487, 20], [-780, 9, 486, 23],
  // round to the south, the airtime hill, the barrel roll
  [-782, 6, 476, 24], [-782, 5, 462, 25], [-782, 14, 448, 20], [-782, 6, 436, 24], [-782, 8, 426, 23], [-782, 9, 416, 22], [-780, 8, 406, 22],
  // round to the east, an outward-banked hill, north into the helix
  [-772, 5, 399, 23], [-762, 4, 398, 23], [-752, 8, 399, 21], [-746, 8, 402, 21], [-740, 6, 414, 20],
  [-739, 7, 440, 19], [-752, 9.5, 453, 18], [-765, 12, 440, 17], [-752, 14, 427, 16], [-739, 15, 440, 16],
  // out of the helix, under the lift, the zero-g roll east
  [-736, 15, 454, 16], [-728, 12, 464, 18], [-712, 7, 467, 20], [-702, 10, 467, 19], [-690, 11, 467, 18], [-678, 10, 467, 19], [-668, 6, 465, 20],
  // round to the south, the brakes, and into the station
  [-658, 4, 458, 16], [-656, 3.5, 444, 10], [-656, 3, 430, 6], [-656, 2.6, 418, 4], [-659, 2.3, 408, 3], [-666, 2, 404.5, 2.5], [-674, 2, 404, 2],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildWinTheCrown(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Searchlight = data.tags.Searchlight || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x5a5a56, 'Cobblestone');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, 382, -798, 512);
  wallSeg(-798, 512, -596, 512);
  wallSeg(-596, 512, -596, 382);
  // the gate in RC Race's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 382) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, 382, GATE.x1, 382);
  wallSeg(GATE.x0, 382, -798, 382);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.6, 16, 1.6], [x, G, 382], NAVY, 'Metal');
    add([1.8, 1.4, 1.8], [x, G + 16.6, 382], GOLD, 'Metal', { collide: 0, shape: 3 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.4, 1.2], [gx, G + 14, 382], NAVY, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 382.7], NAVY, 'Back', [['WIN THE CROWN', 0, 0, 1, 1, GOLD]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 381.3], NAVY, 'Front', [['OPERATION: WIN THE CROWN', 0, 0, 1, 1, GOLD]], { glow: true });
  // the walk up the east side of the raceway to the gate
  for (const [a, b] of [[[-599, 296], [-604, 304]], [[-604, 304], [-604, 376]], [[-604, 376], [gx, 388]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3, 0.2, len + 3], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  carriedFrames(track, {
    free: [[sk(-720, 470), sk(-742, 488)]],
    twists: [
      { s0: sk(-750, 488), s1: sk(-780, 486), angle: Math.PI * 2, h: 1.4, shape: 'stall', hold: 0.45 },
      { s0: sk(-782, 426), s1: sk(-780, 406), angle: -Math.PI * 2, h: 1.4 },
      { s0: sk(-762, 398), s1: sk(-746, 402), angle: -1.0, h: 0, shape: 'bump' },
      { s0: sk(-712, 467), s1: sk(-668, 465), angle: Math.PI * 2, h: 1.4 },
    ],
  });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3();
  const L = track.length;
  const samples = [];
  for (let s = 0; s < L; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  const grid = new Map();
  for (const f of samples) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  const clearOf = (size, pos, pad = 3.6) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3.5 && pos[1] - ey < y + 5) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });

  // ======== the fortress: dark stone walls, battlements, gold crests
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const wallX = (x, za, zb, h = B.H, color = STONE, base = G) => { if (zb - za > 0.1) box([T, h, zb - za], [x, base, (za + zb) / 2], color, 'Slate'); };
  const wallZ = (z, xa, xb, h = B.H, color = STONE, base = G) => { if (xb - xa > 0.1) box([xb - xa, h, T], [(xa + xb) / 2, base, z], color, 'Slate'); };
  const DOOR = 420; // the agents' door, east wall
  wallX(B.x1 - T / 2, B.z0, DOOR - 3);
  wallX(B.x1 - T / 2, DOOR + 3, B.z1);
  wallX(B.x1 - T / 2, DOOR - 3, DOOR + 3, B.H - 6, STONE, G + 6);
  wallX(B.x0 + T / 2, B.z0, B.z1);
  wallZ(B.z0 + T / 2, B.x0, -691);
  wallZ(B.z0 + T / 2, -687, B.x1);
  wallZ(B.z0 + T / 2, -691, -687, B.H - 5.6, STONE, G + 5.6);
  wallZ(B.z1 - T / 2, B.x0, B.x1);
  add([B.x1 - B.x0 + 2, 1.2, B.z1 - B.z0 + 2], [cx, G + B.H + 0.6, cz], 0x3a3a3e, 'Slate', { collide: 0 });
  // battlements round the top, turrets on the corners
  for (let x = B.x0; x <= B.x1; x += 6) for (const z of [B.z0, B.z1]) add([3, 3, 1.6], [x, G + B.H + 2.6, z], STONE, 'Slate', { collide: 0 });
  for (let z = B.z0; z <= B.z1; z += 6) for (const x of [B.x0, B.x1]) add([1.6, 3, 3], [x, G + B.H + 2.6, z], STONE, 'Slate', { collide: 0 });
  for (const [x, z] of [[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]) {
    box([9, B.H + 10, 9], [x, G, z], 0x5a5650, 'Slate', { shape: 5 });
    add([10, 7, 10], [x, G + B.H + 13.5, z], PURPLE, 'SmoothPlastic', { shape: 1, collide: 0 });
    neon([1, 1, 1], [x, G + B.H + 17.5, z], RED, { shape: 3 });
  }
  // the facade: the operation's crest, the crown, banners
  sign([0.4, 6, 40], [B.x1 + 0.4, G + 22, cz], NAVY, 'Right', [['OPERATION:', 0, 0.02, 1, 0.34, WHITE, 'GothamBold'], ['WIN THE CROWN', 0, 0.38, 1, 0.6, GOLD]], { glow: true });
  for (const z of [402, 440, 478]) { add([0.3, 12, 5], [B.x1 + 0.3, G + 12, z], PURPLE, 'Fabric', { collide: 0 }); add([0.32, 2, 2], [B.x1 + 0.4, G + 14, z], GOLD, 'Neon', { collide: 0, shape: 3 }); }
  // a giant crown over the door
  for (let k = 0; k < 7; k++) add([0.5, 3 + (k % 2) * 1.4, 1.4], [B.x1 + 0.6, G + 9 + (k % 2) * 0.7, DOOR - 6 + k * 2], GOLD, 'Metal', { collide: 0, shape: 1 });
  add([0.6, 1.4, 14], [B.x1 + 0.6, G + 7.4, DOOR], GOLD, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([0.4, 0.8, 0.8], [B.x1 + 0.9, G + 7.4, DOOR - 4.5 + k * 3], [RED, 0x2a8a4a, 0x2a6ae8, RED][k], 'Neon', { collide: 0, shape: 3 });

  // ======== the outdoor line: a courtyard of switchbacks between hedges,
  // searchlights sweeping it
  const QX = { w: -642, e: -606 }, rz = (k) => 392 + 6 * k, ROWS = 5;
  const hedge = (xa, xb, z) => {
    add([xb - xa, 1.3, 0.8], [(xa + xb) / 2, G + 0.65, z], 0x2a5a2a, 'Grass');
  };
  hedge(QX.w - 3, QX.e - 1, rz(0) - 3);
  for (let k = 0; k < ROWS - 1; k++) {
    if (k % 2 === 0) hedge(QX.w + 3, QX.e + 3, rz(k) + 3); // heading west: turn at the west end
    else hedge(QX.w - 3, QX.e - 3, rz(k) + 3);
  }
  hedge(QX.w, QX.e + 3, rz(ROWS - 1) + 3);
  for (const [x, z] of [[-602, 396], [-602, 424], [-644, 428]]) {
    box([1, 6, 1], [x, G, z], NAVY, 'Metal', { collide: 0 });
    add([1.6, 1.2, 1.6], [x, G + 6.4, z], 0xfff4dc, 'Neon', { collide: 0 });
    data.tags.Searchlight.push([x, G + 7, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  box([0.4, 5, 0.4], [-604, G, 386], NAVY, 'Metal', { collide: 0 });
  sign([6, 1.4, 0.2], [-604, G + 4.4, 386.2], NAVY, 'Back', [['AGENTS: ENTER HERE', 0, 0, 1, 1, GOLD, 'GothamBold']]);
  const waitPart = add([4.4, 1.2, 0.3], [-604, G + 2.8, 386.2], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 331, cf: cf(-608, G, 388, 0) });

  // ======== inside: the briefing corridor, the station
  const PL = { x0: -686, x1: -660, z0: 397, z1: 404 - 2.6 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x2a2a30, 'DiamondPlate', { collide: 0 });
  add([PL.x1 - PL.x0, 0.1, 0.4], [(PL.x0 + PL.x1) / 2, G + 0.42, PL.z1 - 0.25], GOLD, 'SmoothPlastic', { collide: 0 });
  // the briefing corridor along the south wall from the door to the platform
  sign([16, 3.4, 0.3], [-668, G + 7, B.z0 + T + 0.3], NAVY, 'Back', [['MISSION BRIEFING', 0, 0.04, 1, 0.3, GOLD, 'GothamBold'], ['BARON VEX HAS STOLEN THE BENTON CROWN.', 0, 0.38, 1, 0.26, WHITE, 'GothamBold'], ['YOUR MISSION: WIN IT BACK.', 0, 0.68, 1, 0.28, RED, 'GothamBold']], { glow: true });
  for (let k = 0; k < 5; k++) neon([0.12, 0.12, 6], [-652 - k * 1.2, G + 2.6, 401], RED, { rot: RY(0.4 + k * 0.1) });
  const con = [-662, 398.2];
  box([1.4, 1.2, 1.4], [con[0], G + 0.4, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.4 + k * 0.4, G + 1.7, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(-672, 9, 400, 0xffe8c0);
  light(-652, 5, 402, RED);

  // ======== the scenes in the fortress
  // the laser grid over the lift
  for (let k = 0; k < 10; k++) {
    const z = 434 + k * 3.6, y = 8 + k * 2.1;
    for (const s of [-1, 1]) SN([12, 0.15, 0.15], [-720, y + 4.6, z], RED, { rot: RZ(s * 0.35) });
  }
  light(-720, 20, 450, RED);
  // the guard towers by the drop, searchlights sweeping
  for (const [x, z] of [[-736, 494], [-708, 480]]) {
    if (!clearOf([4, 18, 4], [x, 9, z])) continue;
    box([3.4, 16, 3.4], [x, G, z], 0x4a4640, 'Slate', { collide: 0 });
    add([4.6, 2.4, 4.6], [x, G + 17, z], DARK, 'Metal', { collide: 0 });
    neon([1.4, 1, 1.4], [x, G + 18.6, z], 0xfff4dc);
    data.tags.Searchlight.push([x, G + 19, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  light(-730, 16, 490, 0xfff0d0);
  // the vault under the zero-g stall: a giant round door, gold bars
  if (clearOf([2, 16, 16], [-765, 9, B.z1 - 3])) {
    add([1.6, 16, 16], [-765, G + 9, B.z1 - T - 1.4], 0x8a8e96, 'Metal', { shape: 2, collide: 0, rot: RY(Math.PI / 2) });
    add([1.8, 4, 4], [-765, G + 9, B.z1 - T - 2.2], GOLD, 'Metal', { shape: 2, collide: 0, rot: RY(Math.PI / 2) });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add([0.6, 1.4, 0.8], [-765 + Math.cos(a) * 6, G + 9 + Math.sin(a) * 6, B.z1 - T - 2.4], DARK, 'Metal', { collide: 0 }); }
  }
  for (let k = 0; k < 12; k++) if (clearOf([1.2, 0.6, 0.6], [-756 + (k % 4) * 1.3, G + 0.3 + Math.floor(k / 4) * 0.6, 497])) add([1.2, 0.6, 0.6], [-756 + (k % 4) * 1.3, G + 0.3 + Math.floor(k / 4) * 0.6, 497], GOLD, 'Metal', { collide: 0, shape: 1 });
  light(-765, 12, 494, GOLD);
  // the throne room in the middle of the helix: a dais, Baron Vex's
  // empty throne, purple banners
  if (clearOf([8, 8, 8], [-752, 4, 440], 2)) {
    box([10, 1.2, 10], [-752, G, 440], PURPLE, 'Fabric', { shape: 5 });
    box([3, 1.4, 3], [-752, G + 1.2, 440], 0x4a2a6a, 'Fabric');
    add([3, 6, 0.6], [-752, G + 5.6, 441.6], 0x4a2a6a, 'Fabric', { collide: 0 });
    for (let k = 0; k < 5; k++) add([0.6, 1.6, 0.4], [-753.6 + k * 0.8, G + 9.4, 441.6], GOLD, 'Metal', { collide: 0, shape: 1 });
  }
  for (const [x, z] of [[-730, 420], [-774, 460], [-774, 420]]) if (clearOf([1, 14, 4], [x, 10, z])) { add([0.3, 14, 4], [x, G + 12, z], PURPLE, 'Fabric', { collide: 0 }); add([0.32, 2, 2], [x, G + 16, z], GOLD, 'Neon', { collide: 0, shape: 3 }); }
  light(-752, 14, 440, PURPLE);
  data.tags.SteamVent.push([-752, G + 0.5, 432, 1, 0, 0, 0, 1, 0, 0, 0, 1], [-786, G + 0.5, 470, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // the crown at the end: on a pedestal under a spotlight by the brakes
  const CR = [-646.5, 436];
  box([2.4, 3, 2.4], [-651, G, 436], WHITE, 'Concrete', { collide: 0 });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; add([0.3, 1.4, 0.5], [-651 + Math.cos(a) * 0.8, G + 3.9, 436 + Math.sin(a) * 0.8], GOLD, 'Neon', { collide: 0, shape: 1 }); }
  add([1.8, 0.5, 1.8], [-651, G + 3.3, 436], GOLD, 'Metal', { collide: 0, shape: 5 });
  sign([0.3, 3, 14], [B.x1 - T - 0.3, G + 8, 438], NAVY, 'Left', [['MISSION COMPLETE', 0, 0.04, 1, 0.5, GOLD], ['YOU WON THE CROWN', 0, 0.6, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  light(-651, 8, 436, GOLD);
  void CR;

  // ======== supports: navy columns from the floor
  let supports = 0;
  const keep = [{ x0: PL.x0 - 2, x1: B.x1, z0: B.z0, z1: 410 }];
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -2.3);
    if (foot.y < 2.4) continue;
    if (keep.some((r) => inRect(foot.x, foot.z, r, 1))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3.5 && Math.hypot(x - foot.x, z - foot.z) < 4.6)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], 0x2a2e44, 'Metal', { collide: 0 });
    supports++;
  }

  // ======== the trains: black agents' cars with gold trim
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.4], [0, 0.65, 0], 0x1a1a20, 'Metal'),
    pp(0, [3.3, 0.18, 3.5], [0, 1.1, 0], GOLD, 'Metal'),
    pp(0, [3.4, 0.15, 3.2], [0, 0.2, 0], 0x2a4ad8, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x2a1a2a, 'Fabric'),
      pp(0, [1.1, 1.2, 0.25], [x, 1.85, z + 0.5], 0x1a1a20, 'Metal'),
    ])),
    ...(k === 0 ? [pp(1, [3, 1.1, 1.4], [0, 0.85, -2.3], 0x1a1a20, 'Metal', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(0, [1.6, 0.6, 0.3], [0, 1.2, -2.9], GOLD, 'Neon')] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, G, PL.z1 - 0.8, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0], G, con[1] + 0.8, Math.PI), operator: cf(con[0] + 1.2, G, con[1] + 0.8, Math.PI),
    homes: [cf(-684, G, 399, Math.PI), cf(-664, G, 399, Math.PI)],
    exit: cf(-688, G, 399, Math.PI / 2),
  };

  // ======== the line's path, and the exit
  const fwd = [[-604, 386], [-604, rz(0)], [QX.e, rz(0)]];
  for (let k = 0; k < ROWS; k++) {
    const west = k % 2 === 0;
    fwd.push([west ? QX.w : QX.e, rz(k)]);
    if (k < ROWS - 1) fwd.push([west ? QX.w : QX.e, rz(k + 1)]);
  }
  fwd.push([-645, rz(ROWS - 1)], [-645, DOOR], [B.x1 - 2, DOOR], [-652, 412], [-652, 405], [-656, 400.4], [-670, 400.4]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the exit: off the platform's west end, out a side door in the south
  // wall, and east along the courtyard's south side to the gate
  for (const [a, b] of [[[-689, 396], [-689, 386.2]], [[-689, 386.2], [-606, 386.2]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.4, 0.2, len + 2.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([3, 0.9, 0.2], [-689, G + 5.6, B.z0 - 0.2], 0x1a8a3a, 'Front', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });

  // ======== the ride
  const origin = [-720, 0, 446];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'trex', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    noExtended: true,
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
  // an explosion as the guard towers spot you, sparks off the vault, the
  // crown's gold confetti at the end
  const cues = [[at(-730, 486), 'explosion', [0, 0, 10]], [at(-765, 487), 'sparks', [0, 4, 0]], [at(-656, 436), 'mardi', [3, 2, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Operation: Win the Crown', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "An indoor RMC-style coaster on T-Rex-style track, in Baron Vex's fortress north of RC Race. He's stolen the Benton Crown and you're the agents sent to win it back: a lift through the laser grid, a twisting first drop past the guard towers, a zero-g stall over the vault, an airtime hill, a barrel roll, an outward-banked hill, a helix round the throne room, a zero-g roll - and the crown.",
    baseWait: 65, origin, entrance: [-604, 0, 386], exit: [-606, 0, 388], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, 0x1a1a20, GOLD], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Operation: Win the Crown is a go, agent - the line starts in the courtyard!'];
  return { ride, gate: { x: gx, z: 382 }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, supports };
}

// a toast the first time you come near
export class WinTheCrownSite {
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
      this.hooks.toast('NEW: Operation: Win the Crown - an indoor RMC coaster! Through the gate in RC Race\'s north wall.', 'reward');
    }
  }
}
