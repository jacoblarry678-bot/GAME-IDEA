// Diesel Run: a high-tech motion-simulator dark ride, fully indoors, in a
// huge show building on the land west of Diesel District. You're a test
// driver for the Benton Diesel X-1 rig: a cabin on a six-legged motion base
// riding a wheeled chassis along a floor track. The cabin turns on its
// turntable to face each scene and pitches, rolls and bucks with the
// action: the launch bay, inside a diesel engine, a desert highway at
// night, a canyon coming down, a storm, a jump over a broken bridge, a
// tunnel of fire, a warp run and the finish line.
//
// Everything is under one roof, including a very large queue: an entrance
// corridor and seven long switchbacks through the R&D hall, past an X-1
// rig on display and the pre-run briefing screens.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'DieselRun';
const LAND = { x0: -592, x1: -375, z0: 26, z1: 278 };
const BLD = { x0: -580, x1: -390, z0: 34, z1: 272, H: 32 };
const GATE = { z0: 121.25, z1: 156.75 }; // between the west wall's pillars at z 119 and 159
const G = 0.1;
const FLOOR = 0.5; // top of the building's floor
const INNER = -438; // the wall between the queue hall and the show
const CARS = 3, SPACING = 14;
const H = 4; // cabin pivot above the chassis
const PLAT = FLOOR + H + 0.4; // the load platform, level with the cabin floor
const ORANGE = 0xff5a1a, DARK = 0x22242a, PANEL = 0x34363c, STEEL = 0x9aa0a8, BLUE = 0x2a8aff, WHITE = 0xf4f4f0, YELLOW = 0xf2c818, CYAN = 0x5adcff;

// the track (x, z and the speed there), starting where the front vehicle
// stops in the station; the slow bits are the scenes
const P = (x, z, v) => [x, FLOOR, z, v * 1.6];
const CIRCUIT = [
  P(-450, 104, 1),
  P(-450, 118, 2), P(-450, 128, 0.7), P(-450, 136, 1.2), // 1 the launch bay
  P(-454, 148, 4), P(-466, 152, 5), P(-490, 152, 2), P(-505, 152, 0.7), P(-515, 152, 1.5), // 2 inside the engine
  P(-532, 152, 4), P(-543, 158, 3), P(-546, 172, 1), P(-546, 182, 0.7), P(-546, 192, 2), // 3 the desert highway
  P(-544, 204, 4), P(-534, 210, 4), P(-515, 210, 1.2), P(-505, 210, 0.8), P(-494, 210, 2), // 4 the canyon
  P(-476, 210, 4), P(-467, 216, 3), P(-465, 228, 0.9), P(-465, 236, 1.1), // 5 the storm
  P(-467, 248, 4), P(-478, 255, 4), P(-492, 255, 1.2), P(-500, 255, 2), P(-508, 255, 6), // 6 the bridge jump
  P(-524, 255, 4), P(-540, 255, 3.5), P(-556, 255, 4), // 7 the tunnel of fire
  P(-568, 250, 5), P(-572, 236, 7), P(-572, 200, 8), P(-572, 150, 8), P(-572, 100, 7), // 8 the warp run
  P(-569, 72, 5), P(-556, 62, 3), P(-528, 62, 1.2), P(-516, 62, 0.7), P(-504, 62, 1.5), // 9 the finish
  P(-480, 62, 4), P(-462, 64, 3), P(-452, 72, 2), P(-450, 84, 1.4), P(-450, 94, 1.1),
];
// what each scene is, where the cabin faces, and how it moves
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

const ROT = (dir) => {
  // a rotation whose local Y runs along dir
  const Y = new THREE.Vector3(...dir).normalize();
  let X = new THREE.Vector3().crossVectors(Y, new THREE.Vector3(0, 0, 1));
  if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
  X.normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  return [X.x, Y.x, Z.x, X.y, Y.y, Z.y, X.z, Y.z, Z.z];
};

export function buildDieselRun(data) {
  const { add, box, sign, cf, mi } = helpers(data);
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const lamp = (x, z, color = 0xfff0c8) => {
    box([0.5, 12, 0.5], [x, G, z], 0x2e3238, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 12.6, z], color, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 12.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };
  const neon = (size, pos, color, opts = {}) => add(size, pos, color, 'Neon', { collide: 0, ...opts });

  // ---- the land: level it, clear it, wall it in; it's part of Diesel District
  data.flatZones = [...(data.flatZones || []), { ...LAND, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], LAND, 8));
  const dd = data.config.Lands.find((l) => l.id === 'Diesel');
  if (dd) dd.regions = [...dd.regions, [LAND.x0, LAND.z0 - 2, LAND.x1, LAND.z1 + 2]];
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] + 375) < 0.5 && p[3] > 250 && p[6] - p[3] / 2 < GATE.z0 && p[6] + p[3] / 2 > GATE.z1;
    if (wall) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(-375, -2.5, -375, GATE.z0);
  wallSeg(-375, GATE.z1, -375, 280.5);
  wallSeg(-560, 24, LAND.x0, 24);
  wallSeg(LAND.x0, 24, LAND.x0, 280);
  wallSeg(LAND.x0, 280, -375, 280);
  const gz = (GATE.z0 + GATE.z1) / 2;
  add([LAND.x1 - LAND.x0, 1, LAND.z1 - LAND.z0], [(LAND.x0 + LAND.x1) / 2, G - 0.5, (LAND.z0 + LAND.z1) / 2], 0x4a4c50, 'Asphalt');

  // ---- the walk in from Diesel District: a path, lamps, the gate arch
  const route = [[-152, 139], [-250, 139], [-372, gz]];
  for (let i = 0; i < route.length - 1; i++) {
    const [xa, za] = route[i], [xb, zb] = route[i + 1];
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([9, 0.4, len + 9], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x8a8a86, 'Pavement', { yaw, collide: 0 });
    add([10, 0.36, len + 10], [(xa + xb) / 2, 0.19, (za + zb) / 2], 0x4a4c50, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
  }
  data.trees = data.trees.filter((t) => !(t.pos[0] < -145 && t.pos[0] > -380 && Math.abs(t.pos[2] - 139) < 9));
  for (const x of [-190, -240, -290, -340]) lamp(x, 146, ORANGE);
  // a signpost where the path leaves the walkway
  box([0.6, 9, 0.6], [-160, G, 130], 0x2a2c30, 'Metal');
  for (const face of ['Right', 'Left']) sign([0.3, 3.4, 10], [-160 + (face === 'Right' ? 0.4 : -0.4), G + 9.4, 130], DARK, face, [['DIESEL RUN', 0, 0, 1, 0.62, ORANGE], ['NEW  ·  THIS WAY', 0, 0.62, 1, 0.38, WHITE, 'GothamBold']], { glow: true });
  // the gate arch: two black pylons with orange light bars
  const ax = -376;
  for (const z of [GATE.z0 + 1.6, GATE.z1 - 1.6]) {
    box([3.2, 20, 3.2], [ax, G, z], DARK, 'Metal');
    neon([0.4, 18, 0.4], [ax + 1.7, G + 10, z], ORANGE);
  }
  add([4, 6, GATE.z1 - GATE.z0 + 2], [ax, G + 23, gz], DARK, 'Metal', { collide: 0 });
  for (const [dx, face] of [[2.2, 'Right'], [-2.2, 'Left']]) {
    sign([0.3, 4.2, 30], [ax + dx, G + 23.6, gz], DARK, face, [['DIESEL RUN', 0, 0, 1, 0.64, ORANGE], ['THE ULTIMATE TEST DRIVE', 0, 0.64, 1, 0.36, WHITE, 'GothamBold']], { glow: true });
  }
  add([12, 0.4, GATE.z1 - GATE.z0], [-382, FLOOR - 0.2, gz], 0x3a3c42, 'Pavement');
  box([0.6, 6, 0.6], [-368, G, GATE.z0 - 6], 0x2e3238, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [-368, G + 9, GATE.z0 - 6], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Diesel', seed: 31, cf: cf(-370, G, gz + 7, -Math.PI / 2) });
  for (const z of [GATE.z0 - 2, GATE.z1 + 2]) lamp(-366, z, ORANGE);

  // ---- the show building
  const B = BLD, T = 1.5, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const doorIn = gz, doorOut = 40; // the entrance and the exit, both in the east wall
  box([B.x1 - B.x0, FLOOR - G, B.z1 - B.z0], [cx, G, cz], 0x16171b, 'Concrete'); // the floor
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], PANEL, 'Metal');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z0 + T / 2], PANEL, 'Metal');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z1 - T / 2], PANEL, 'Metal');
  const eastSpans = [[B.z0, doorOut - 3.5], [doorOut + 3.5, doorIn - 5], [doorIn + 5, B.z1]];
  for (const [za, zb] of eastSpans) box([T, B.H, zb - za], [B.x1 - T / 2, G, (za + zb) / 2], PANEL, 'Metal');
  box([T, B.H - 10, 10], [B.x1 - T / 2, G + 10, doorIn], PANEL, 'Metal');
  box([T, B.H - 8, 7], [B.x1 - T / 2, G + 8, doorOut], PANEL, 'Metal');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0x2a2c30, 'Metal', { collide: 0 });
  // orange stripes round the outside, and light bars up the corners
  for (const y of [6, 24]) {
    neon([0.3, 0.8, B.z1 - B.z0], [B.x0 - 0.2, G + y, cz], ORANGE);
    neon([B.x1 - B.x0, 0.8, 0.3], [cx, G + y, B.z0 - 0.2], ORANGE);
    neon([B.x1 - B.x0, 0.8, 0.3], [cx, G + y, B.z1 + 0.2], ORANGE);
  }
  for (const [za, zb] of [[B.z0, doorIn - 18], [doorIn + 18, B.z1]]) neon([0.3, 0.8, zb - za], [B.x1 + 0.2, G + 24, (za + zb) / 2], ORANGE);
  for (const [x, z] of [[B.x1 + 0.3, B.z0 + 0.3], [B.x1 + 0.3, B.z1 - 0.3], [B.x0 - 0.3, B.z0 + 0.3], [B.x0 - 0.3, B.z1 - 0.3]]) neon([0.5, B.H, 0.5], [x, G + B.H / 2, z], CYAN);
  // the facade: a huge DIESEL RUN sign over the entrance, chevrons, a canopy
  sign([0.4, 9, 46], [B.x1 + 0.4, G + 18, doorIn], 0x101114, 'Right', [['DIESEL RUN', 0, 0.02, 1, 0.66, ORANGE], ['THE ULTIMATE TEST DRIVE  ·  BENTON DIESEL X-1', 0, 0.68, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  for (let k = 0; k < 6; k++) {
    const rot = [1, 0, 0, 0, Math.cos(0.7), -Math.sin(0.7), 0, Math.sin(0.7), Math.cos(0.7)];
    neon([0.3, 0.6, 5], [B.x1 + 0.4, G + 11.5, doorIn - 20 + k * 1.6], ORANGE, { rot });
    neon([0.3, 0.6, 5], [B.x1 + 0.4, G + 11.5, doorIn + 12 + k * 1.6], ORANGE, { rot: [1, 0, 0, 0, Math.cos(-0.7), -Math.sin(-0.7), 0, Math.sin(-0.7), Math.cos(-0.7)] });
  }
  add([7, 0.6, 16], [B.x1 + 3.5, G + 10.3, doorIn], DARK, 'Metal', { collide: 0 });
  neon([7, 0.2, 0.3], [B.x1 + 3.5, G + 10, doorIn - 8], CYAN);
  neon([7, 0.2, 0.3], [B.x1 + 3.5, G + 10, doorIn + 8], CYAN);
  sign([0.2, 1.4, 6], [B.x1 + 6.8, G + 10.3, doorOut], DARK, 'Right', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  add([6, 0.5, 9], [B.x1 + 3, G + 8.4, doorOut], DARK, 'Metal', { collide: 0 });
  light(B.x1 + 6, 12, doorIn, ORANGE);
  // the walk from the gate to the doors
  add([B.x1 - -375 + 2, 0.4, 26], [(B.x1 - 375) / 2, FLOOR - 0.2, doorIn], 0x3a3c42, 'Pavement');
  add([12, 0.4, doorIn - doorOut], [-383, FLOOR - 0.2, (doorIn + doorOut) / 2], 0x3a3c42, 'Pavement');

  // ---- inside: the wall between the queue hall and the show (a door to the
  // load platform near the south end), a drop ceiling of light over the hall
  const doorQ = 52; // the queue's door through to the platform
  box([T, B.H, B.z1 - (doorQ + 4) - T], [INNER, G, (doorQ + 4 + B.z1 - T) / 2], DARK, 'Metal');
  box([T, B.H, doorQ - 4 - (B.z0 + T)], [INNER, G, (B.z0 + T + doorQ - 4) / 2], DARK, 'Metal');
  box([T, B.H - 10, 8], [INNER, G + 10, doorQ], DARK, 'Metal');
  // the exit corridor along the south wall of the hall
  const EXZ = 45;
  box([B.x1 - INNER - T, 12, 0.6], [(INNER + B.x1) / 2, G, EXZ], DARK, 'Metal');
  for (let x = INNER + 6; x < B.x1 - 4; x += 10) neon([4, 0.15, 0.3], [x, G + 11, 40], 0x5adc6e);

  // ---- the queue: the corridor up the east wall, then seven long rows
  const ROWS = [-401, -406, -411, -416, -421, -426, -431];
  const south = 50, north = 248;
  const hallFloor = add([B.x1 - INNER - 3, 0.2, north + 8 - EXZ], [(INNER + B.x1) / 2, FLOOR + 0.1, (EXZ + north + 8) / 2], 0x23252b, 'SmoothPlastic', { collide: 0 });
  void hallFloor;
  const fwd = [[-368, gz], [B.x1 + 3, doorIn], [B.x1 - 4, doorIn], [-395, doorIn], [-395, north + 4], [ROWS[0], north + 4]];
  ROWS.forEach((x, k) => {
    const goSouth = k % 2 === 0;
    if (k > 0) fwd.push([x, goSouth ? north : south]);
    fwd.push([x, goSouth ? south : north]);
  });
  // (the last row ends at the south end, by the door through to the platform)
  fwd.push([INNER + 4, doorQ], [INNER - 2, doorQ]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 4, [1, 0], FLOOR + 0.2);
  const RAIL = 0x2e3238, TOP = ORANGE;
  const railZ = (x, za, zb) => {
    add([0.22, 0.22, zb - za], [x, FLOOR + 3.2, (za + zb) / 2], TOP, 'SmoothPlastic', { collide: 0 });
    add([0.16, 0.16, zb - za], [x, FLOOR + 1.9, (za + zb) / 2], RAIL, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [x, FLOOR, za + ((zb - za) * k) / n], RAIL, 'Metal');
  };
  for (let k = 0; k < ROWS.length - 1; k++) {
    const x = (ROWS[k] + ROWS[k + 1]) / 2;
    // the gap is where the line turns between these two rows
    if (k % 2 === 0) railZ(x, north + 2, south + 3.6); else railZ(x, north - 3.6, south - 2);
  }
  railZ(-398.5, south - 2, north + 1.5); // between the corridor and the first row
  railZ(ROWS[6] - 2.5, south + 4, north + 6); // along the last row
  // overhead light strips along the rows, and blue light all through the hall
  for (const x of ROWS) neon([0.25, 0.15, north - south], [x, 15, (north + south) / 2], k2c(x));
  function k2c(x) { return Math.round(-x) % 2 ? CYAN : ORANGE; }
  for (let z = 60; z < 250; z += 30) { light(-412, 13, z, BLUE); light(-396, 10, z + 15, ORANGE); }
  // briefing screens on the inner wall, posters up the corridor
  const brief = [['PRE-RUN BRIEFING', 'X-1 MOTION RIG  ·  6 AXES  ·  360° TURNTABLE'], ['TEST ROUTE', 'ENGINE · HIGHWAY · CANYON · STORM · BRIDGE · FIRE'], ['SAFETY FIRST', 'KEEP ARMS IN THE CABIN  ·  LAP BARS DOWN'], ['YOUR CO-PILOT', '"DIESEL" AI  ·  TOP SPEED: CLASSIFIED']];
  brief.forEach(([title, sub], k) => {
    const z = 75 + k * 48;
    add([0.4, 8.4, 16.4], [INNER + 1, 9, z], 0x0a0c10, 'Metal', { collide: 0 });
    sign([0.2, 8, 16], [INNER + 1.25, 9, z], 0x061220, 'Right', [[title, 0, 0.18, 1, 0.34, CYAN], [sub, 0, 0.58, 1, 0.2, WHITE, 'GothamBold']], { glow: true });
  });
  [['DIESEL RUN', ORANGE], ['TEST DRIVERS WANTED', WHITE], ['BENTON DIESEL X-1', CYAN], ['HOLD ON TIGHT', ORANGE]].forEach(([text, c], k) => {
    sign([0.3, 3, 9], [B.x1 - T - 0.2, 7, 70 + k * 40 + (k > 1 ? 30 : 0)], 0x101114, 'Left', [[text, 0, 0, 1, 1, c]], { glow: true });
  });
  // the north end of the hall: an X-1 rig on a turntable, under a big screen
  box([10, 0.8, 10], [-414, FLOOR, 262], 0x101114, 'Metal', { shape: 5 });
  neon([10.4, 0.2, 10.4], [-414, FLOOR + 0.85, 262], ORANGE, { shape: 5 });
  sign([30, 9, 0.4], [-414, 20, B.z1 - T - 0.4], 0x061220, 'Front', [['WELCOME, TEST DRIVERS', 0, 0.1, 1, 0.4, CYAN], ['DIESEL RUN  ·  THE ULTIMATE TEST DRIVE', 0, 0.55, 1, 0.3, ORANGE]], { glow: true });
  light(-414, 12, 258, ORANGE);
  // the entrance sign at the start of the line, inside the door
  box([0.4, 7, 0.4], [-392.5, FLOOR, doorIn + 7], 0x101114, 'Metal');
  sign([0.2, 2, 9], [-392.3, FLOOR + 6.4, doorIn + 7], 0x101114, 'Left', [['ENTRANCE', 0, 0, 1, 1, ORANGE]], { glow: true });

  // ---- the track: a black rail set in the floor
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), Pv = new THREE.Vector3();
  for (let s = 0; s < track.length; s += 2) {
    sampler.matrixAt(s, m4);
    Pv.setFromMatrixPosition(m4);
    const e = m4.elements;
    add([1.6, 0.05, 2.2], [Pv.x, FLOOR + 0.03, Pv.z], 0x0a0a0c, 'Metal', { collide: 0, yaw: Math.atan2(-e[8], -e[10]) });
  }
  // where along the track each scene is
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const scenes = SCENES.map((sc) => { const s = sAt(...sc.stop); return { s0: s - sc.back, s1: s + sc.fwd, target: sc.face, style: sc.style }; });

  // ---- the station: the load platform beside the track, a ramp up from
  // the queue's door, the operator's console
  const px0 = -445.8, px1 = INNER - T / 2;
  box([px1 - px0, PLAT - FLOOR, 46], [(px0 + px1) / 2, FLOOR, 88], 0x3a3c42, 'Concrete');
  neon([0.3, 0.06, 46], [px0 + 0.3, PLAT + 0.03, 88], YELLOW);
  add([px1 - px0, PLAT - FLOOR, 10], [(px0 + px1) / 2, (PLAT + FLOOR) / 2, 60], 0x3a3c42, 'Concrete', { shape: 1, rot: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
  const con = [px1 - 1.6, 108];
  box([1.4, 3, 2.4], [con[0], PLAT, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  sign([16, 3, 0.4], [-450, 14, 112], 0x101114, 'Back', [['DIESEL RUN', 0, 0, 1, 0.6, ORANGE], ['LOAD STATION  ·  BAY 1', 0, 0.6, 1, 0.4, CYAN, 'GothamBold']], { glow: true });
  light(-446, 12, 90, 0xfff0d8);

  // ---- the scenes
  // walls between the show rows
  const wall = (xa, za, xb, zb, h = 24, color = DARK) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([1, h, len], [(xa + xb) / 2, G + h / 2, (za + zb) / 2], color, 'Metal', { yaw });
  };
  wall(-462, 118, -565, 118); // finish row | the first scenes
  wall(-468, 182, -538, 182); // engine | canyon
  wall(-474, 232, -560, 232); // canyon | bridge (the screen wall)
  wall(-558, 126, -558, 238); // the highway screen wall | the warp run
  const screen = (center, size, face, labels, bg = 0x061220) => {
    const [x, y, z] = center;
    add([size[0] + 0.6, size[1] + 0.6, size[2] + 0.6], [x, y, z], 0x050506, 'Metal', { collide: 0 });
    sign(size, [x + (face === 'Right' ? 0.35 : face === 'Left' ? -0.35 : 0), y, z + (face === 'Back' ? 0.35 : face === 'Front' ? -0.35 : 0)], bg, face, labels, { glow: true });
  };
  // 1 the launch bay: a countdown on the wall, beacons spinning
  screen([INNER - 1.2, 12, 128], [0.3, 12, 26], 'Left', [['SYSTEMS CHECK', 0, 0.06, 1, 0.22, CYAN], ['3 · 2 · 1', 0, 0.3, 1, 0.42, ORANGE], ['X-1 RIG READY  ·  LAUNCH', 0, 0.76, 1, 0.18, WHITE, 'GothamBold']]);
  for (const z of [114, 142]) { box([1, 6, 1], [-441, G, z], DARK, 'Metal', { collide: 0 }); neon([1.2, 1.2, 1.2], [-441, G + 6.6, z], ORANGE, { shape: 3 }); light(-442, 7, z, ORANGE); }
  for (let z = 120; z < 140; z += 4) neon([4, 0.06, 0.4], [-450, FLOOR + 0.06, z], YELLOW);
  // 2 inside the engine: a giant engine block, pistons pumping, a crankshaft
  box([34, 10, 10], [-505, G, 172], 0x3a3c42, 'CorrodedMetal');
  for (let k = 0; k < 4; k++) box([5.6, 3, 5.6], [-517 + k * 8, G + 10, 172], 0x2a2c30, 'Metal', { shape: 5 });
  screen([-505, 15, 181.2], [36, 14, 0.3], 'Front', [['INSIDE THE DIESEL', 0, 0.08, 1, 0.3, ORANGE], ['20,000 RPM  ·  REDLINE', 0, 0.5, 1, 0.22, WHITE, 'GothamBold']], 0x200a04);
  light(-505, 8, 165, 0xff6a20);
  for (const x of [-492, -518]) { box([1.6, 2, 1.6], [x, G, 162], 0x3a2a20, 'CorrodedMetal', { shape: 5 }); data.tags.Campfire.push([x, G + 2.4, 162, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
  data.tags.SteamVent.push([-500, G + 1, 160, 1, 0, 0, 0, 1, 0, 0, 0, 1], [-512, G + 1, 160, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // 3 the desert highway at night: a panorama on the screen wall
  const hx = -557.2;
  add([0.3, 20, 52], [hx, G + 13, 182], 0x0a1430, 'SmoothPlastic', { collide: 0 });
  add([0.3, 3, 52], [hx + 0.05, G + 8, 182], 0xff7a30, 'Neon', { collide: 0 });
  for (let k = 0; k < 6; k++) add([0.3, 4 + (k % 3) * 2.5, 6 + (k % 2) * 4], [hx + 0.1, G + 9 + (k % 3) * 1.25, 160 + k * 9], 0x241418, 'SmoothPlastic', { collide: 0 });
  add([0.3, 6, 18], [hx + 0.15, G + 3, 182], 0x2a2a2e, 'SmoothPlastic', { collide: 0, shape: 1, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (let k = 0; k < 4; k++) add([0.3, 0.8, 0.4 + k * 0.25], [hx + 0.2, G + 5.5 - k * 1.3, 182], YELLOW, 'Neon', { collide: 0 });
  sign([0.3, 2.4, 14], [hx + 0.25, G + 19, 182], 0x0a1430, 'Right', [['ROUTE 9  ·  NIGHT RUN', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });
  for (const z of [168, 196]) { box([3, 2.2, 7], [-552, G, z], [0x8a2a22, 0x2a4a8a][z > 180 ? 1 : 0], 'Metal', { collide: 0 }); neon([0.2, 0.5, 1.2], [-550.4, G + 1.4, z - 2.5], 0xff2020); }
  light(-552, 10, 182, 0xff8a40);
  // 4 the canyon: rock walls close in, boulders fall, the screen cracks
  for (let k = 0; k < 10; k++) {
    const x = -534 + k * 6.5;
    const h1 = 10 + (k % 4) * 3, h2 = 12 + ((k + 2) % 4) * 3;
    add([5 + (k % 3) * 2, h1, 4], [x, G + h1 / 2, 200 - (k % 2)], 0x6a4a36, 'Slate', { collide: 0, yaw: 0.3 * ((k % 3) - 1) });
    add([5 + ((k + 1) % 3) * 2, h2, 4], [x + 3, G + h2 / 2, 221 + (k % 2)], 0x5a3e2e, 'Slate', { collide: 0, yaw: 0.25 * ((k % 3) - 1) });
  }
  screen([-505, 13, 230.8], [40, 16, 0.3], 'Front', [['ROCKSLIDE!', 0, 0.1, 1, 0.42, ORANGE], ['CANYON CLOSING  ·  FLOOR IT', 0, 0.6, 1, 0.22, WHITE, 'GothamBold']], 0x1a0c06);
  light(-505, 9, 212, 0xffa060);
  // 5 the storm: lightning on the screen, rain lights, wind
  screen([INNER - 1.2, 12, 232], [0.3, 14, 26], 'Left', [['STORM WARNING', 0, 0.08, 1, 0.3, CYAN], ['⚡  HOLD ON  ⚡', 0, 0.48, 1, 0.3, WHITE], ['WIND 90 MPH', 0, 0.82, 1, 0.14, CYAN, 'GothamBold']], 0x04081a);
  for (let k = 0; k < 12; k++) neon([0.08, 2 + (k % 3), 0.08], [-458 + (k % 4) * 2, G + 14 + (k % 3), 220 + k * 2], 0xb0d8ff);
  light(-450, 14, 232, 0xb0d8ff);
  // 6 the bridge jump: a broken bridge deck rising in front, the far side on screen
  add([14, 1.2, 9], [-496, G + 4, 264.5], 0x6a6e76, 'Concrete', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.25), -Math.sin(-0.25), 0, Math.sin(-0.25), Math.cos(-0.25)] });
  for (const dx of [-6, 6]) box([1, 4, 1], [-496 + dx, G, 262], 0x6a6e76, 'Concrete', { collide: 0 });
  screen([-496, 14, 268.8], [36, 14, 0.3], 'Front', [['THE BRIDGE IS OUT', 0, 0.08, 1, 0.3, ORANGE], ['JUMP IT!', 0, 0.45, 1, 0.42, WHITE]], 0x061220);
  light(-496, 10, 262, 0xff6a20);
  // 7 the tunnel of fire: flame bars both sides, orange everywhere
  for (let x = -526; x > -556; x -= 6) {
    for (const z of [249, 261]) { box([1.4, 1.8, 1.4], [x, G, z], 0x2a1a14, 'CorrodedMetal', { shape: 5, collide: 0 }); data.tags.Campfire.push([x, G + 2.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
    add([0.6, 10, 0.6], [x - 3, G + 10, 248], 0x3a2a20, 'Metal', { collide: 0 });
    add([0.6, 10, 0.6], [x - 3, G + 10, 262], 0x3a2a20, 'Metal', { collide: 0 });
    add([0.6, 0.6, 15], [x - 3, G + 15, 255], 0x3a2a20, 'Metal', { collide: 0 });
  }
  light(-540, 8, 255, 0xff5a10);
  light(-528, 8, 255, 0xff8a20);
  // 8 the warp run: neon rings flying past down the long west corridor
  for (let z = 236; z > 92; z -= 8) {
    const c = Math.round(z / 8) % 2 ? CYAN : ORANGE;
    neon([0.3, 0.3, 0.3], [-572, G + 12, z], c);
    add([12, 0.3, 0.3], [-572, G + 11.5, z], c, 'Neon', { collide: 0 });
    for (const dx of [-6, 6]) add([0.3, 11.5, 0.3], [-572 + dx, G + 5.75, z], c, 'Neon', { collide: 0 });
  }
  light(-572, 10, 200, CYAN);
  light(-572, 10, 140, ORANGE);
  // 9 the finish: a checkered banner and the time on screen
  screen([-516, 12, B.z0 + T + 0.4], [36, 12, 0.3], 'Back', [['RUN COMPLETE', 0, 0.08, 1, 0.3, 0x5adc6e], ['00:59.8  ·  NEW RECORD', 0, 0.45, 1, 0.3, WHITE], ['WELCOME BACK, TEST DRIVERS', 0, 0.8, 1, 0.14, CYAN, 'GothamBold']]);
  for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) add([1.6, 1.2, 0.2], [-524 + k * 1.6, 20.6 - j * 1.2, B.z0 + T + 1], (k + j) % 2 ? WHITE : 0x101010, 'SmoothPlastic', { collide: 0 });
  light(-516, 10, 70, 0x5adc6e);

  // more light on every set, so the scenes read in the dark
  for (const [x, y, z, c] of [[-450, 16, 120, CYAN], [-498, 16, 160, 0xffb070], [-520, 16, 160, 0xff6a20], [-552, 16, 172, 0xff9a50], [-552, 16, 194, 0x5a8aff],
    [-490, 16, 205, 0xffc080], [-525, 16, 215, 0xff8a50], [-455, 16, 225, CYAN], [-485, 16, 250, ORANGE], [-505, 16, 260, 0xffd0a0], [-516, 16, 55, 0x5adc6e], [-540, 16, 62, WHITE]]) light(x, y, z, c);
  // ---- the vehicles: a cabin on a turntable (the car, riders and all) on
  // a hexapod motion base on a wheeled chassis (its own animated part)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const cabinParts = () => {
    const p = [];
    p.push(pp(0, [4.8, 0.4, 4.8], [0, -0.75, 0], 0x2a2c30, 'Metal')); // the top frame of the legs
    p.push(pp(5, [5.6, 0.5, 5.6], [0, -0.3, 0], 0x1a1b1f, 'Metal')); // the turntable
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; p.push(pp(5, [0.35, 0.52, 0.35], [Math.cos(a) * 2.6, -0.3, Math.sin(a) * 2.6], 0x5a5e66, 'Metal')); }
    p.push(pp(0, [7, 0.4, 8], [0, 0.2, 0], PANEL, 'Metal')); // floor
    p.push(pp(0, [7, 0.6, 3.6], [0, 0.7, 2.2], PANEL, 'Metal')); // the raised back row
    for (const sd of [-1, 1]) {
      p.push(pp(0, [0.4, 5, 8], [sd * 3.5, 2.7, 0], PANEL, 'SmoothPlastic')); // the sides
      for (let k = 0; k < 5; k++) p.push(pp(0, [0.1, 0.8, 1.05], [sd * 3.73, 4.0, -2.6 + k * 1.3], 0x0a0c10, 'Glass')); // window slots
      p.push(pp(0, [0.5, 5.4, 0.5], [sd * 3.55, 2.7, -4.05], ORANGE, 'SmoothPlastic')); // orange edges
      p.push(pp(0, [0.5, 5.4, 0.5], [sd * 3.55, 2.7, 4.05], ORANGE, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 5.3, 0], ORANGE, 'SmoothPlastic'));
      p.push(pp(0, [0.5, 0.5, 8.6], [sd * 3.55, 0.15, 0], ORANGE, 'SmoothPlastic'));
    }
    p.push(pp(0, [7.6, 0.5, 8.6], [0, 5.3, 0], PANEL, 'SmoothPlastic')); // roof
    p.push(pp(0, [7.6, 0.5, 0.5], [0, 5.3, -4.05], ORANGE, 'SmoothPlastic'));
    p.push(pp(0, [7, 5, 0.4], [0, 2.7, 3.9], PANEL, 'SmoothPlastic')); // back
    p.push(pp(1, [7, 1.6, 1.4], [0, 0.6, -4.6], PANEL, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1])); // the front skirt
    for (const sd of [-1, 1]) p.push(pp(0, [0.15, 1.6, 0.15], [sd * 1.6, 0.7, -4.75], 0x5a5e66, 'Metal', [Math.cos(0.7 * sd), -Math.sin(0.7 * sd), 0, Math.sin(0.7 * sd), Math.cos(0.7 * sd), 0, 0, 0, 1]));
    p.push(pp(0, [6.6, 0.8, 0.4], [0, 1.2, -3.85], PANEL, 'Metal')); // the dash
    p.push(pp(0, [5.6, 0.12, 0.1], [0, 1.65, -4.06], CYAN, 'Neon'));
    p.push(pp(0, [7.2, 0.12, 8.2], [0, -0.05, 0], ORANGE, 'Neon')); // the glow under the cabin
    // two rows of four seats
    for (const [z, y] of [[-1.5, 0.4], [1.8, 1.0]]) {
      for (const x of [-2.4, -0.8, 0.8, 2.4]) {
        p.push(pp(0, [1.4, 0.5, 1.5], [x, y + 0.25, z], 0x1a1b1f, 'Fabric'));
        p.push(pp(0, [1.4, 2.0, 0.4], [x, y + 1.4, z + 0.9], 0x1a1b1f, 'Fabric'));
        p.push(pp(0, [1.2, 0.12, 0.08], [x, y + 2.3, z + 1.11], ORANGE, 'Neon'));
      }
    }
    return p;
  };
  const seatList = () => {
    const seats = [];
    for (const [z, y] of [[-1.5, 0.4], [1.8, 1.0]]) for (const x of [-2.4, -0.8, 0.8, 2.4]) seats.push([x, y + 0.5 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return seats;
  };
  const baseParts = () => {
    const p = [];
    p.push(pp(0, [7, 0.5, 9], [0, 1.15, 0], 0x2a2c30, 'Metal')); // the chassis
    for (let k = 0; k < 7; k++) p.push(pp(2, [0.1, 0.5, 0.5], [3.52, 1.15, -3.6 + k * 1.2], 0x5a5e66, 'Metal'));
    for (let k = 0; k < 7; k++) p.push(pp(2, [0.1, 0.5, 0.5], [-3.52, 1.15, -3.6 + k * 1.2], 0x5a5e66, 'Metal'));
    for (const [x, z] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) {
      p.push(pp(0, [0.3, 0.6, 0.9], [x, 0.7, z], 0x3a3c42, 'Metal'));
      p.push(pp(2, [0.4, 0.8, 0.8], [x, 0.4, z], 0x111111, 'Rubber'));
    }
    p.push(pp(0, [2.4, 0.9, 3], [0, 1.8, 2], 0x1a1b1f, 'Metal')); // the drive unit
    p.push(pp(0, [4.6, 0.3, 4.6], [0, 1.55, 0], 0x1a1b1f, 'Metal')); // the base plate
    // six legs, paired, from three points on the base to three on the top
    for (let k = 0; k < 3; k++) {
      for (const sd of [-1, 1]) {
        const ab = (k / 3) * Math.PI * 2 + sd * 0.25, at = (k / 3) * Math.PI * 2 + Math.PI / 3 - sd * 0.9;
        const b = [Math.cos(ab) * 2.3, 1.75, Math.sin(ab) * 2.3], t = [Math.cos(at) * 1.9, H - 0.95, Math.sin(at) * 1.9];
        const d = [t[0] - b[0], t[1] - b[1], t[2] - b[2]], len = Math.hypot(...d), rot = ROT(d);
        const mid = (u) => [b[0] + d[0] * u, b[1] + d[1] * u, b[2] + d[2] * u];
        p.push(pp(5, [0.42, len * 0.55, 0.42], mid(0.3), 0x5a5e66, 'Metal', rot)); // the cylinder
        p.push(pp(5, [0.22, len * 0.5, 0.22], mid(0.72), STEEL, 'Metal', rot)); // the rod
        p.push(pp(3, [0.5, 0.5, 0.5], b, 0x1a1b1f, 'Metal'));
        p.push(pp(3, [0.4, 0.4, 0.4], t, 0x1a1b1f, 'Metal'));
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
  // animated scenery: the engine's pistons and crankshaft, falling boulders
  const props = [];
  for (let k = 0; k < 4; k++) {
    const name = `Piston${k + 1}`, x = -517 + k * 8;
    extras[name] = { pivot: [x, G + 15, 172, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [pp(5, [5, 4, 5], [0, 0, 0], 0xb8bcc4, 'Metal'), pp(5, [1.2, 6, 1.2], [0, -4, 0], 0x5a5e66, 'Metal'), pp(5, [5.2, 0.3, 5.2], [0, 1.6, 0], 0x8a8e96, 'Metal')] };
    props.push({ name, kind: 'piston', at: [x, G + 15, 172], amp: 2.4, freq: 7, phase: k * Math.PI / 2 });
  }
  extras.Crank = { pivot: [-505, G + 4, 166.6, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [pp(2, [34, 1.2, 1.2], [0, 0, 0], 0x8a8e96, 'Metal'), ...[0, 1, 2, 3].map((k) => pp(0, [1, 3, 0.8], [-12 + k * 8, k % 2 ? 1.2 : -1.2, 0], 0x5a5e66, 'Metal'))] };
  props.push({ name: 'Crank', kind: 'spin', at: [-505, G + 4, 166.6], speed: 7 });
  for (let k = 0; k < 3; k++) {
    const name = `Boulder${k + 1}`, at = [-522 + k * 15, G + 26, k % 2 ? 221 : 199];
    extras[name] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [pp(3, [4 + k, 4 + k, 4 + k], [0, 0, 0], 0x6a4a36, 'Slate')] };
    props.push({ name, kind: 'fall', at, drop: 21, period: 2.6 + k * 0.7, phase: k * 0.37 });
  }
  extrasNames.push(...props.map((p) => p.name));

  // ---- the crew: an operator at the console and attendants on the bars
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    Pv.setFromMatrixPosition(m4);
    stops.push(cf(px0 + 1, PLAT, Pv.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3]],
    console: cf(con[0], PLAT, con[1], Math.PI / 2),
    operator: cf(con[0] + 1.4, PLAT, con[1], Math.PI / 2),
    homes: [cf(px0 + 2, PLAT, 78, Math.PI / 2), cf(px0 + 2, PLAT, 70, Math.PI / 2)],
    exit: cf(px1 - 2, PLAT, 104, -Math.PI / 2),
  };

  // ---- the ride
  const origin = [-500, 0, 160];
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
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  // effects: sparks at the launch, fire in the engine, an explosion as the
  // canyon comes down, sparks in the storm, fire on the bridge and tunnel
  const cues = [
    [at(-450, 130), 'sparks', [0, 2, -6]], [at(-505, 152), 'fire', [-6, 0, -8]], [at(-505, 152) + 0.01, 'fire', [6, 0, -8]],
    [at(-505, 210), 'explosion', [0, 6, -12]], [at(-465, 232), 'sparks', [3, 6, -6]], [at(-496, 255), 'fire', [0, -2, -10]],
    [at(-540, 255), 'fire', [-5, 0, 0]], [at(-532, 255), 'fire', [5, 0, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Diesel') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Diesel Run', land: 'Diesel', category: 'Thrill', thrill: 4, kind: 'darkride', carStyle: 'coaster',
    description: 'The ultimate test drive, fully indoors: ride the Benton Diesel X-1, a cabin on a six-legged motion base, through the inside of a diesel engine, a desert highway, a collapsing canyon, a storm, a bridge jump and a tunnel of fire. The cabin turns, tilts and drops with every scene.',
    baseWait: 70, origin, entrance: [-392.5, 0, doorIn + 7], exit: [-382, 0, doorOut], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [ORANGE, PANEL, CYAN], cues,
  });
  return { ride, gate: { x: -368, z: gz }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 } };
}


// a toast the first time you walk up to the new ride
export class DieselRunSite {
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
      this.hooks.toast('DIESEL RUN is now open! A high-tech motion-simulator dark ride, fully indoors: take the X-1 rig through the engine, the canyon and a tunnel of fire.', 'reward');
    }
  }
}
