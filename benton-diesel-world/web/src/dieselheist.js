// The Diesel Heist: Diesel Run's replacement, an indoor coaster in its old
// building west of Diesel District. Benton Diesel Works keeps its new
// prototype - the gold-plated Diesel X-2 engine - in the R&D vault, and
// tonight you're the crew that breaks in for it: the launch trips the
// alarms, a hill up past the open vault, a vertical loop, a heartline roll
// past the security drones, a helix round the X-2 itself, a zero-g roll and
// out past the getaway truck.
//
// The line: chain-rope lanes outside, along the building's east side, then
// the hall inside (the old R&D hall), to the platform.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { carriedFrames } from './cyclone.js';

export const RIDE_ID = 'DieselHeist';
const G = 0.1;
const CARS = 4, SPACING = 3.6;
const ORANGE = 0xff5a1a, DARK = 0x1c1d22, GOLD = 0xf0c040, RED = 0xe0202a, WHITE = 0xf4f4f0, STEEL = 0x8e949c, PANEL = 0x34363c;
const TRACK_COLOR = 0xff5a1a;

const CIRCUIT = [
  [-452, 2.4, 72, 2],
  // the launch, north up the east side of the show floor
  [-452, 2.5, 84, 4], [-452, 2.6, 100, 6], [-452, 2.7, 130, 22], [-452, 2.8, 160, 30], [-452, 3.2, 186, 30],
  // up past the vault and round to the west
  [-455, 12, 206, 26], [-462, 22, 222, 21], [-472, 24, 236, 19], [-488, 17, 248, 22], [-504, 4, 256, 27],
  // the vertical loop
  [-514, 3.5, 258, 27], [-525, 9.5, 258.5, 24], [-531, 18.5, 259, 17], [-525, 24.5, 257.5, 12], [-518, 18.5, 255.5, 17], [-524, 9.5, 253.5, 24], [-535, 3.5, 252, 27],
  // round to the south and the heartline roll
  [-556, 4, 248, 26], [-568, 6, 236, 25], [-572, 8, 222, 24], [-572, 10, 210, 22], [-572, 11, 195, 21], [-572, 10, 180, 22], [-572, 8, 166, 23], [-570, 6, 150, 24],
  // the helix round the X-2
  [-568, 6, 136, 23], [-563, 6.5, 110, 22], [-545, 8.5, 92, 21], [-527, 11, 110, 19], [-545, 13.5, 128, 17], [-563, 15, 110, 16],
  // down, east, the zero-g roll
  [-560, 14, 92, 17], [-552, 7, 72, 22], [-540, 6, 58, 23], [-528, 9, 53, 21], [-514, 11, 52, 19], [-500, 10, 52, 19], [-488, 6, 51, 20],
  // the brakes, and round into the station
  [-476, 4, 48, 14], [-466, 3.4, 43, 8], [-458, 3, 42, 5], [-453, 2.7, 48, 4], [-452, 2.5, 58, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildDieselHeist(data, shell) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Searchlight = data.tags.Searchlight || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const { B, FLOOR, doorIn, doorOut } = shell;
  const F = FLOOR;
  const IW = -440; // the wall between the hall (east) and the show (west)
  const QDOOR = 78, XDOOR = 46; // its doors: from the line to the platform, and the exit

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  carriedFrames(track, {
    free: [[sk(-514, 258), sk(-535, 252)]],
    twists: [
      { s0: sk(-572, 210), s1: sk(-572, 180), angle: Math.PI * 2, h: 1.3 },
      { s0: sk(-528, 53), s1: sk(-488, 51), angle: -Math.PI * 2, h: 1.3 },
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
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.8) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });

  // ======== inside: the wall between the hall and the show floor
  const T = 1.2;
  const wz = (za, zb, h = B.H, base = G) => { if (zb - za > 0.1) box([T, h, zb - za], [IW, base, (za + zb) / 2], DARK, 'Metal'); };
  wz(B.z0 + 1.5, XDOOR - 3);
  wz(XDOOR + 3, QDOOR - 3);
  wz(QDOOR + 3, B.z1 - 1.5);
  wz(XDOOR - 3, XDOOR + 3, B.H - 6, G + 6);
  wz(QDOOR - 3, QDOOR + 3, B.H - 6, G + 6);

  // ======== the hall: the indoor line, six long rows under the old R&D
  // gantries, posters of the X-2, guard-post lights
  const LANES = [-396, -402, -408, -414, -420, -426], QS = 90, QN = 262;
  const rail = (x, za, zb) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.2, 1.2, 0.2], [x, F, za + ((zb - za) * k) / n], STEEL, 'Metal');
    add([0.12, 0.12, zb - za], [x, F + 1.1, (za + zb) / 2], ORANGE, 'Metal', { collide: 0 });
  };
  rail(-399, doorIn + 6, QN - 3);
  rail(-405, QS + 3, QN + 3);
  rail(-411, QS - 3, QN - 3);
  rail(-417, QS + 3, QN + 3);
  rail(-423, QS - 3, QN - 3);
  rail(-429, QS + 3, QN + 3);
  for (let z = 100; z < 260; z += 20) add([40, 0.2, 0.5], [-412, F + 8, z], 0xe8f0ff, 'Neon', { collide: 0 });
  [['TOP SECRET', RED], ['THE DIESEL X-2', GOLD], ['GOLD-PLATED  ·  ONE OF ONE', GOLD], ['R&D VAULT  ·  NO ENTRY', RED], ['SECURITY LEVEL: MAXIMUM', ORANGE], ['TONIGHT: SHIFT CHANGE AT MIDNIGHT', WHITE]].forEach(([text, c], k) => {
    sign([0.3, 3.2, 14], [IW + 0.7, F + 6, 104 + k * 26], DARK, 'Right', [[text, 0, 0, 1, 1, c, 'GothamBold']], { glow: true });
  });
  sign([0.3, 4, 18], [B.x1 - 1.6, F + 9, 200], DARK, 'Left', [['THE PLAN', 0, 0.04, 1, 0.3, GOLD], ['1 TRIP THE ALARM  ·  2 GRAB THE X-2  ·  3 DRIVE OUT', 0, 0.42, 1, 0.24, WHITE, 'GothamBold'], ['(STEP 1 IS NOT PART OF THE PLAN)', 0, 0.72, 1, 0.2, RED, 'GothamBold']], { glow: true });
  for (const z of [120, 180, 240]) { neon([0.6, 0.6, 0.6], [-412, F + 9.6, z], RED, { shape: 3 }); light(-412, 9, z, z === 180 ? GOLD : RED); }
  // the exit corridor along the south of the hall
  box([IW - B.x1 - 2, 6, 0.4], [(IW + B.x1) / 2 - 1, F, XDOOR + 6], DARK, 'Metal');
  for (let x = IW + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, F + 5.6, XDOOR], 0x5adc6e);

  // ======== the station: the platform between the track and the wall
  const PL = { x0: -449.4, x1: IW - 0.6, z0: 56, z1: 82 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, F + 0.2, (PL.z0 + PL.z1) / 2], 0x2a2a30, 'DiamondPlate', { collide: 0 });
  add([0.4, 0.1, PL.z1 - PL.z0], [PL.x0 + 0.3, F + 0.42, (PL.z0 + PL.z1) / 2], ORANGE, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 3, 16], [IW - 0.7, F + 7, 68], DARK, 'Left', [['THE DIESEL HEIST', 0, 0.04, 1, 0.6, ORANGE], ['LOAD UP  ·  NO ALARMS (YET)', 0, 0.64, 1, 0.32, WHITE, 'GothamBold']], { glow: true });
  const con = [-442.4, 79];
  box([1.4, 1.2, 1.4], [con[0], F + 0.4, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], F + 1.7, con[1] - 0.4 + k * 0.4], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(-446, 8, 68, 0xffe0c0);

  // ======== the show: the alarm, the vault, the drones, the X-2, the truck
  // the launch trips the alarm: red beacons, laser beams across, a siren sign
  for (let z = 104; z < 186; z += 12) {
    SN([0.6, 0.6, 0.6], [-446, F + 6, z], RED, { shape: 3 });
    SN([10, 0.12, 0.12], [-452, F + 5.4 + ((z / 12) % 2) * 1.6, z + 6], RED, { rot: RY(0.3) });
  }
  sign([0.3, 3, 20], [-445.4, F + 12, 150], RED, 'Right', [['SECURITY BREACH', 0, 0, 1, 1, WHITE, 'GothamBlack']], { glow: true });
  light(-452, 10, 140, RED);
  light(-452, 10, 180, RED);
  // the vault on the north wall, its round door swung open, gold light
  if (clearOf([18, 18, 3], [-480, 10, B.z1 - 3])) {
    add([1.6, 18, 18], [-480, F + 10, B.z1 - 2.4], 0x8a8e96, 'Metal', { shape: 2, collide: 0, rot: RY(Math.PI / 2) });
    add([1.8, 14, 14], [-480, F + 10, B.z1 - 2.6], 0xffd060, 'Neon', { shape: 2, collide: 0, rot: RY(Math.PI / 2) });
  }
  if (clearOf([3, 16, 16], [-492, 10, B.z1 - 10])) add([16, 16, 1.4], [-494, F + 10, B.z1 - 9], 0x9a9ea6, 'Metal', { shape: 2, collide: 0, rot: RZ(Math.PI / 2) });
  sign([22, 2.4, 0.3], [-480, F + 21, B.z1 - 1.8], DARK, 'Front', [['BENTON DIESEL WORKS  ·  R&D VAULT', 0, 0, 1, 1, GOLD, 'GothamBold']], { glow: true });
  light(-480, 12, 266, GOLD);
  // the getaway truck, waiting by the brakes, engine running
  const TR = [-505, 76];
  if (clearOf([5, 4, 12], [TR[0], 2, TR[1]], 2)) {
    box([4.4, 3.4, 4], [TR[0], F + 0.8, TR[1] - 5], 0x1a1a1e, 'Metal');
    box([4.6, 4.2, 8], [TR[0], F + 0.8, TR[1] + 1.4], 0x2a2c30, 'Metal');
    add([4.2, 1, 0.1], [TR[0], F + 3.2, TR[1] - 7.05], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
    for (const dz of [-5.4, 3.6]) for (const dx of [-2.2, 2.2]) add([0.8, 1.6, 1.6], [TR[0] + dx, F + 0.8, TR[1] + dz], 0x111111, 'Rubber', { shape: 2, collide: 0 });
    for (const dx of [-1.4, 1.4]) neon([0.6, 0.4, 0.2], [TR[0] + dx, F + 1.8, TR[1] - 7.1], 0xfff4c0);
    data.tags.SteamVent.push([TR[0] + 1.6, F + 0.6, TR[1] + 5.6, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // searchlights sweeping the show floor
  for (const [x, z] of [[-560, 260], [-560, 60], [-500, 160]]) {
    if (!clearOf([2, 3, 2], [x, 1.5, z], 2)) continue;
    box([1.6, 2.4, 1.6], [x, F, z], DARK, 'Metal', { collide: 0 });
    data.tags.Searchlight.push([x, F + 3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the props: security drones hovering, the X-2 turning on its pedestal
  const extras = {}, extrasNames = [], props = [];
  const drone = () => [pp(0, [2.4, 0.5, 2.4], [0, 0, 0], DARK, 'Metal'), pp(3, [0.6, 0.6, 0.6], [0, -0.4, -1], RED, 'Neon'),
    ...[[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].map(([dx, dz]) => pp(5, [1.6, 0.1, 1.6], [dx, 0.3, dz], 0x5a5e66, 'Metal'))];
  for (const [k, at] of [[1, [-560, F + 14, 202]], [2, [-584 + 22, F + 12, 172]], [3, [-520, F + 20, 236]]]) {
    if (!clearOf([4, 3, 4], at)) continue;
    extras[`Drone${k}`] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: drone() };
    props.push({ name: `Drone${k}`, at, kind: 'piston', amp: 0.8, freq: 1.4 + k * 0.3, phase: k });
  }
  const X2 = [-545, F + 2.4, 110];
  box([8, 1.6, 8], [X2[0], F, X2[2]], DARK, 'Metal', { shape: 5 });
  neon([8.4, 0.2, 8.4], [X2[0], F + 1.7, X2[2]], GOLD, { shape: 5 });
  extras.X2 = { pivot: [...X2, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [
    pp(0, [3.6, 2.6, 5], [0, 1.3, 0], GOLD, 'Metal'), pp(0, [3, 1, 4.4], [0, 3, 0], 0xd8a830, 'Metal'),
    ...[-1.2, 0, 1.2].map((z) => pp(5, [0.8, 1.2, 0.8], [0, 4, z], GOLD, 'Metal')),
    pp(2, [1, 1.6, 1.6], [0, 1, -2.8], 0xd8a830, 'Metal'), pp(0, [4, 0.3, 0.3], [0, 2.6, 2.6], 0xfff0a0, 'Neon'),
  ] };
  props.push({ name: 'X2', at: X2, kind: 'turn', speed: 0.6 });
  extrasNames.push(...props.map((p) => p.name));
  sign([0.3, 2, 12], [-527 + 9, F + 18, 110], DARK, 'Right', [['THE DIESEL X-2', 0, 0, 1, 1, GOLD]], { glow: true });
  light(-545, 14, 110, GOLD);
  light(-572, 12, 195, 0x6a8aff);
  light(-514, 10, 52, ORANGE);

  // ======== supports: dark columns from the floor
  let supports = 0;
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < F + 2.4) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([0.9, foot.y - F, 0.9], [foot.x, (foot.y + F) / 2, foot.z], 0x2a2c32, 'Metal', { shape: 5, collide: 0 });
    supports++;
  }

  // ======== outside: the line extended along chain-rope lanes up the
  // building's east side (between it and the land wall)
  const chainZ = (x, za, zb) => {
    const n = Math.max(1, Math.round((zb - za) / 3));
    for (let k = 0; k <= n; k++) {
      const z = za + ((zb - za) * k) / n;
      box([0.18, 1.1, 0.18], [x, G, z], 0xc8ccd4, 'Metal');
      add([0.45, 0.12, 0.45], [x, G + 0.06, z], 0x2a2c30, 'Metal', { collide: 0, shape: 5 });
      add([0.24, 0.24, 0.24], [x, G + 1.15, z], 0xc8ccd4, 'Metal', { collide: 0, shape: 3 });
    }
    for (let k = 0; k < n; k++) {
      const zc = za + ((zb - za) * (k + 0.5)) / n, span = (zb - za) / n;
      for (let j = 0; j < 3; j++) add([0.08, 0.08, span / 3 + 0.05], [x, G + 1.0 - (j === 1 ? 0.2 : 0.08), za + ((zb - za) * (k + (j + 0.5) / 3)) / n], 0x8a1a1a, 'Fabric', { collide: 0 });
      void zc;
    }
  };
  const OL = [-378.6, -381.4, -384.2, -387], ON = 266, OS = 160;
  add([13, 0.4, ON - OS + 8], [-382.6, F - 0.2, (ON + OS) / 2], 0x3a3c42, 'Pavement', { collide: 0 });
  chainZ(-380, OS, ON - 3);
  chainZ(-382.8, OS + 3, ON);
  chainZ(-385.6, OS, ON - 3);
  // posters and lamps along the outdoor lanes
  for (let z = 180; z < 266; z += 28) {
    sign([0.3, 4, 3], [B.x1 + 0.3, G + 4, z], DARK, 'Right', [['WANTED', 0, 0.04, 1, 0.24, RED, 'GothamBold'], ['THE DIESEL', 0, 0.36, 1, 0.24, ORANGE], ['X-2 CREW', 0, 0.64, 1, 0.24, WHITE, 'GothamBold']]);
  }
  for (const z of [172, 214, 256]) { box([0.3, 6, 0.3], [-376.6, G, z], 0x2a2c30, 'Metal', { collide: 0 }); add([1, 1, 1], [-376.6, G + 6.3, z], 0xffecbe, 'Neon', { shape: 3, collide: 0 }); data.tags.ParkLamp.push([-376.6, G + 6.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }

  // ======== the line's path
  const fwd = [[-372, 139], [-378.6, 152], [OL[0], ON], [OL[1], ON], [OL[1], OS], [OL[2], OS], [OL[2], ON], [OL[3], ON], [OL[3], 150], [-389, 141], [-394, doorIn], [-396, doorIn]];
  LANES.forEach((x, k) => {
    const north = k % 2 === 0;
    fwd.push([x, north ? QN : QS]);
    if (k < LANES.length - 1) fwd.push([LANES[k + 1], north ? QN : QS]);
  });
  fwd.push([-432, QS - 4], [-436, QDOOR], [IW - 2, QDOOR], [-446, 74]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 3, [1, 0], F);
  // the exit: from the platform through the corridor and out the east door
  sign([0.2, 1, 3], [B.x1 + 0.3, G + 6.4, doorOut], 0x1a8a3a, 'Right', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });

  // ======== the cars: black getaway cars, orange stripes, a truck grille up front
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.4], [0, 0.65, 0], 0x18181c, 'Metal'),
    pp(0, [3.3, 0.2, 3.5], [0, 1.1, 0], ORANGE, 'SmoothPlastic'),
    pp(0, [3.4, 0.15, 3.2], [0, 0.2, 0], ORANGE, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x1a1a1c, 'Fabric'),
      pp(0, [1.1, 1.2, 0.25], [x, 1.85, z + 0.5], 0x18181c, 'Metal'),
    ])),
    ...(k === 0 ? [pp(0, [3.2, 1.4, 1.4], [0, 0.9, -2.3], 0x18181c, 'Metal'), pp(0, [2.8, 0.9, 0.12], [0, 1, -3.02], 0xc8ccd4, 'Metal'), pp(3, [0.5, 0.4, 0.2], [-1.2, 1.3, -3.05], 0xfff4c0, 'Neon'), pp(3, [0.5, 0.4, 0.2], [1.2, 1.3, -3.05], 0xfff4c0, 'Neon')] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
    P.setFromMatrixPosition(m4);
    stops.push(cf(PL.x0 + 0.8, F, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0], F, con[1] - 1, Math.PI / 2), operator: cf(con[0] + 0.4, F, con[1] - 2, Math.PI / 2),
    homes: [cf(-447, F, 60, Math.PI / 2), cf(-447, F, 78, Math.PI / 2)],
    exit: cf(-446, F, 57, Math.PI),
  };

  // ======== the ride
  const origin = [-500, 0, 150];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras, extrasNames, props, crew,
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
  // sparks as the launch trips the alarm, an explosion as the vault blows,
  // fire out of the roll
  const cues = [[at(-452, 110), 'sparks', [0, 2, 3]], [at(-472, 236), 'explosion', [0, 0, -10]], [at(-500, 52), 'fire', [-5, 0, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Diesel') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'The Diesel Heist', land: 'Diesel', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "Diesel Run's replacement: an indoor launched coaster in its old building. Benton Diesel Works keeps its gold-plated Diesel X-2 prototype in the R&D vault, and tonight you're the crew breaking in for it - the launch trips the alarm, then a hill past the open vault, a vertical loop, a heartline roll past the security drones, a helix round the X-2 itself, a zero-g roll and out past the getaway truck. The line runs outside along chain-rope lanes, then through the old R&D hall.",
    baseWait: 70, origin, entrance: [-370, 0, 145], exit: [-386, 0, 100], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, 0x18181c, GOLD], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'The Diesel Heist is open - the line starts at the chain-rope lanes!'];
  return { ride, gate: shell.gate, indoor: shell.indoor, supports };
}

// a toast the first time you come near
export class DieselHeistSite {
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
      this.hooks.toast("NEW: The Diesel Heist, an indoor coaster in Diesel Run's old building! The line starts at the chain-rope lanes by the gate.", 'reward');
    }
  }
}
