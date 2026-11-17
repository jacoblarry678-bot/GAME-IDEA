// Benton Roll: an indoor launched coaster in the dark, north of Benton Flash
// (through a gate in Benton Flash's north wall). Benton Records' house band,
// the Diesel Kings, are playing a sold-out show across town tonight and
// you're on the guest list - if you can get there in time.
//
// Outside: a big pink-and-teal hall with a giant guitar on its front, and an
// open-air line - a steel-truss stand-by gateway with the wait time and a
// giant record on top, chain-stanchion switchbacks, black umbrellas and a
// wall of band posters. Inside: the pre-show in Studio B (the band's
// recording session, and the news that you're late), a short backstage
// corridor, and the loading dock, where the tour cars wait at the light.
// Then the launch - zero to fast in the dark - up into a heartline roll, a
// dive down the far side, a low run under the helix, back over the top of
// it, and a corkscrew home, past speaker stacks, neon and spotlights.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'BentonRoll';
const SITE = { x0: 560, x1: 748, z0: 442, z1: 628 };
const B = { x0: 580, x1: 740, z0: 472, z1: 620, H: 34 };
const BFGATE = { x0: 738, x1: 748 }; // in Benton Flash's north wall (z 440)
const DOOR = 720; // the hall's door, on its south face
const G = 0.1;
const CARS = 5, SPACING = 3.6;
const PINK = 0xff4aa0, TEAL = 0x2ad0c8, GOLD = 0xf0c040, RED = 0xd8283a, BLACK = 0x101014, WHITE = 0xf4f4f0, CHROME = 0xc8ccd4, PURPLE = 0x8a4aff;
const TRACK_COLOR = 0x6a2ad8;

const CIRCUIT = [
  [600, 2, 546, 2],
  // the launch, north up the west side
  [600, 2, 558, 6], [600, 2.1, 572, 18], [600, 2.4, 588, 26], [601, 3, 600, 27],
  // up and east into the heartline roll
  [606, 10, 610, 24], [618, 18, 614, 20], [634, 22, 614, 18], [652, 22, 614, 18], [670, 20, 613, 20],
  // the dive, south down the east side
  [692, 14, 610, 24], [714, 10, 600, 26], [728, 7, 584, 27], [730, 5, 566, 27],
  // low, west under the helix
  [722, 4, 556, 26], [704, 4, 554, 26], [680, 4.2, 554, 25], [660, 4.5, 556, 24],
  // up round the helix and back over the top of the low run
  [646, 8, 566, 22], [642, 12, 580, 19], [646, 15, 592, 17], [660, 16, 596, 16], [676, 16, 596, 16],
  [688, 15, 584, 18], [690, 13, 566, 20], [690, 12, 550, 21], [688, 10, 530, 23],
  // the corkscrew, west, and home to the dock
  [680, 8, 512, 24], [664, 7, 504, 24], [648, 8, 502, 22], [632, 9, 501, 21], [618, 7, 502, 22],
  [606, 4, 506, 16], [600, 2.6, 518, 10], [600, 2, 530, 4],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildBentonRoll(data) {
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
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0xc87a6a, 'Pavement');
  // a gate in Benton Flash's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 440) < 0.6 && Math.abs(p[4] - 637) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(524, 440, BFGATE.x0, 440);
  wallSeg(750, 500, 750, SITE.z1);
  wallSeg(750, SITE.z1, SITE.x0, SITE.z1);
  wallSeg(SITE.x0, SITE.z1, SITE.x0, 440);
  const gx = (BFGATE.x0 + BFGATE.x1) / 2;
  for (const x of [BFGATE.x0 + 0.6, BFGATE.x1 - 0.6]) box([1.2, 15, 1.2], [x, G, 440], CHROME, 'Metal');
  add([BFGATE.x1 - BFGATE.x0 + 1, 2.4, 1], [gx, G + 15, 440], BLACK, 'Metal', { collide: 0 });
  sign([BFGATE.x1 - BFGATE.x0, 2, 0.2], [gx, G + 15, 440.6], BLACK, 'Back', [['BENTON ROLL', 0, 0, 1, 1, PINK]], { glow: true });
  sign([BFGATE.x1 - BFGATE.x0, 2, 0.2], [gx, G + 15, 439.4], BLACK, 'Front', [['BENTON ROLL', 0, 0, 1, 1, PINK]], { glow: true });
  // the walk: from Benton Flash's gate, up its east side, through the gate
  for (const [a, b] of [[[746, 270], [746.6, 290]], [[746.6, 290], [746.6, 432]], [[746.6, 432], [743, 440]], [[743, 440], [743, 442]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    W.add([4.6, 0.4, len + 4.6], [(a[0] + b[0]) / 2, 0.22, (a[1] + b[1]) / 2], 0x6a6c72, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(a[0], 0, a[1]), new THREE.Vector3(b[0], 0, b[1])]);
  }

  // ======== the hall: pink and teal stucco, a giant guitar on the front
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const STUCCO = 0xe8c0a8, TEALW = 0x6ac8c0;
  box([T, B.H, B.z1 - B.z0], [B.x0 + T / 2, G, cz], TEALW, 'Concrete');
  box([T, B.H, B.z1 - B.z0], [B.x1 - T / 2, G, cz], TEALW, 'Concrete');
  box([B.x1 - B.x0, B.H, T], [cx, G, B.z1 - T / 2], TEALW, 'Concrete');
  box([DOOR - 3.5 - B.x0, B.H, T], [(B.x0 + DOOR - 3.5) / 2, G, B.z0 + T / 2], STUCCO, 'Concrete');
  box([B.x1 - DOOR - 3.5, B.H, T], [(DOOR + 3.5 + B.x1) / 2, G, B.z0 + T / 2], STUCCO, 'Concrete');
  box([7, B.H - 10, T], [DOOR, G + 10, B.z0 + T / 2], STUCCO, 'Concrete');
  add([B.x1 - B.x0 + 2, 1.4, B.z1 - B.z0 + 2], [cx, G + B.H + 0.7, cz], 0xd8d4cc, 'Concrete', { collide: 0 });
  for (const [w, d, x, z] of [[B.x1 - B.x0, 0.3, cx, B.z0 - 0.2]]) {
    add([w, 3, d], [x, G + 1.5, z], 0xb86a5a, 'Concrete', { collide: 0 });
    add([w, 0.6, d], [x, G + 26, z], PINK, 'SmoothPlastic', { collide: 0 });
    add([w, 0.6, d], [x, G + 27.2, z], TEAL, 'SmoothPlastic', { collide: 0 });
  }
  // the giant guitar: a teal body with a gold pickguard, its neck reaching
  // up over the roofline (the park's own design)
  const gb = [660, 13, B.z0 - 2.4];
  add([22, 12, 2.2], [gb[0], gb[1], gb[2]], TEAL, 'SmoothPlastic', { collide: 0, shape: 3, rot: RZ(0.35) });
  add([15, 9, 2.4], [gb[0] - 9, gb[1] + 3.6, gb[2]], TEAL, 'SmoothPlastic', { collide: 0, shape: 3, rot: RZ(0.35) });
  add([12, 6, 0.3], [gb[0] + 1, gb[1] + 1, gb[2] - 1.2], GOLD, 'SmoothPlastic', { collide: 0, shape: 3, rot: RZ(0.35) });
  for (const k of [0, 1, 2]) add([1.2, 1.2, 0.4], [gb[0] + 4 + k * 1.8, gb[1] - 1.6 - k * 0.6, gb[2] - 1.3], WHITE, 'SmoothPlastic', { collide: 0, shape: 2, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  add([3.2, 1.2, 0.4], [gb[0] - 2, gb[1] - 2.2, gb[2] - 1.3], 0x2a2a2e, 'Metal', { collide: 0, rot: RZ(0.35) });
  add([38, 2.6, 1.2], [gb[0] - 23, gb[1] + 15, gb[2] - 0.6], 0x5a3a24, 'Wood', { collide: 0, rot: RZ(-0.62) });
  for (let k = 0; k < 6; k++) add([38, 0.12, 0.1], [gb[0] - 23, gb[1] + 15 - 1 + k * 0.4, gb[2] - 1.3], CHROME, 'Metal', { collide: 0, rot: RZ(-0.62) });
  add([6, 3.4, 1.4], [gb[0] - 40, gb[1] + 27, gb[2] - 0.6], 0x5a3a24, 'Wood', { collide: 0, rot: RZ(-0.62) });
  sign([22, 3.6, 0.3], [gb[0] + 2, gb[1] - 6.6, gb[2] - 1.4], BLACK, 'Back', [['BENTON ROLL', 0, 0, 1, 0.62, PINK], ['THE DIESEL KINGS  ·  LIVE TONIGHT', 0, 0.64, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  // a giant record on the corner
  add([16, 16, 0.6], [604, 22, B.z0 - 0.6], BLACK, 'SmoothPlastic', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  add([5, 5, 0.7], [604, 22, B.z0 - 0.7], RED, 'SmoothPlastic', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (const r of [6, 7]) for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; neon([0.3, 0.3, 0.2], [604 + Math.cos(a) * r, 22 + Math.sin(a) * r, B.z0 - 1], r === 6 ? PINK : TEAL, { shape: 3 }); }

  // ======== the outdoor line: the stand-by gateway, switchbacks, umbrellas, posters
  // the gateway: a steel truss frame over the way in, with a red header
  for (const [x, z] of [[724, 444], [724, 456], [741, 444], [741, 456]]) box([0.8, 10, 0.8], [x, G, z], CHROME, 'Metal');
  for (const z of [444, 456]) { add([18, 0.5, 0.5], [732.5, G + 10, z], CHROME, 'Metal', { collide: 0 }); add([18, 0.5, 0.5], [732.5, G + 8.4, z], CHROME, 'Metal', { collide: 0 }); }
  for (let x = 725; x < 742; x += 2) add([0.15, 1.8, 0.15], [x, G + 9.2, 444], CHROME, 'Metal', { collide: 0, rot: RZ(x % 4 ? 0.7 : -0.7) });
  add([19, 1.6, 0.6], [733, G + 7.4, 444.2], RED, 'SmoothPlastic', { collide: 0 });
  sign([16, 1.4, 0.2], [733, G + 7.4, 443.8], BLACK, 'Front', [['BENTON RECORDS', 0, 0, 1, 1, WHITE, 'GothamBlack']], { glow: true });
  add([6, 6, 0.4], [733, G + 13.4, 450], 0x9a9ea6, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  add([1.6, 1.6, 0.5], [733, G + 13.4, 450], RED, 'SmoothPlastic', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  sign([5, 1.2, 0.2], [727, G + 11.4, 443.8], 0xd8dce2, 'Front', [['STAND-BY ENTRANCE', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  sign([5, 1.2, 0.2], [739, G + 11.4, 443.8], 0xd8dce2, 'Front', [['SINGLE RIDER', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  const waitPart = add([7, 1.6, 0.6], [727, G + 5.6, 443.6], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  // the switchbacks: chrome posts with sagging chains
  const ROWZ = [448, 453, 458, 463];
  const chainX = (a, b, z) => {
    const n = Math.max(1, Math.round((b - a) / 3));
    for (let k = 0; k <= n; k++) box([0.2, 1.4, 0.2], [a + ((b - a) * k) / n, G, z], CHROME, 'Metal');
    for (let k = 0; k < n; k++) for (let j = 0; j < 3; j++) add([((b - a) / n) / 3 + 0.05, 0.08, 0.08], [a + ((b - a) * (k + (j + 0.5) / 3)) / n, G + 1.15 - (j === 1 ? 0.18 : 0.08), z], 0x9a9ea6, 'Metal', { collide: 0 });
  };
  chainX(608, 720, 450.5);
  chainX(600, 712, 455.5);
  chainX(608, 720, 460.5);
  chainX(600, 716, 465.5);
  // black umbrellas over the line, and the posters on the front wall
  for (const [x, z] of [[620, 456], [660, 456], [700, 456]]) {
    box([0.2, 4.2, 0.2], [x, G, z], BLACK, 'Metal', { collide: 0 });
    add([6, 0.5, 6], [x, G + 4.4, z], BLACK, 'Fabric', { shape: 5, collide: 0 });
    add([2.4, 0.6, 2.4], [x, G + 4.75, z], BLACK, 'Fabric', { shape: 5, collide: 0 });
  }
  [['TURN IT UP', PINK, 0xf0c040], ['ONE NIGHT ONLY', GOLD, 0xff6a2a], ['THE DIESEL KINGS', TEAL, 0xffffff], ['BACKSTAGE PASS', PURPLE, 0xf0c040], ['SOLD OUT', RED, 0xffffff], ['ENCORE!', 0x40c870, 0xffffff]].forEach(([text, bg, fg], k) => {
    sign([6, 4.4, 0.2], [592 + k * 7, 3.6, B.z0 - 0.15], bg, 'Front', [[text, 0, 0.3, 1, 0.4, fg]]);
  });
  // lamps on the plaza
  for (const x of [590, 640, 690, 744]) {
    box([0.4, 8, 0.4], [x, G, 468], 0x1e3a2a, 'Metal');
    add([1.2, 1.4, 1.2], [x, G + 8.4, 468], 0xffecbe, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 8.4, 468, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 141, cf: cf(744, G, 450, 0) });

  // ======== inside: the pre-show in Studio B, then the backstage corridor
  const PS = { x0: B.x0 + 120, x1: B.x1 - T, z0: B.z0 + T, z1: 500 }; // x 700..738.8
  box([0.8, 14, 523.4 - PS.z0], [PS.x0 - 0.4, G, (PS.z0 + 523.4) / 2], 0x2a2a30, 'Concrete'); // the studio's west wall (open at the corridor)
  box([PS.x1 - PS.x0, 14, 0.8], [(PS.x0 + PS.x1) / 2, G, 531.4], 0x2a2a30, 'Concrete');
  add([PS.x1 - PS.x0, 0.6, 531 - PS.z0], [(PS.x0 + PS.x1) / 2, G + 14.3, (PS.z0 + 531) / 2], 0x1a1a1e, 'Metal', { collide: 0 });
  add([PS.x1 - PS.x0, 0.12, 531 - PS.z0], [(PS.x0 + PS.x1) / 2, G + 0.06, (PS.z0 + 531) / 2], 0x3a2a3a, 'Fabric', { collide: 0 });
  // Studio B: the stage on the east wall, the band, the console, the screen
  box([5, 1, 24], [PS.x1 - 2.5, G, 487], BLACK, 'WoodPlanks');
  sign([0.3, 4, 18], [PS.x1 - 0.2, 8.6, 487], BLACK, 'Left', [['STUDIO B  ·  BENTON RECORDS', 0, 0.06, 1, 0.4, PINK], ['THE DIESEL KINGS  ·  RECORDING NOW', 0, 0.5, 1, 0.24, TEAL, 'GothamBold'], ["SHOW'S ACROSS TOWN IN 10 MINUTES!", 0, 0.78, 1, 0.2, GOLD, 'GothamBold']], { glow: true });
  for (const [z, inst] of [[479, 'guitar'], [485, 'drums'], [491, 'keys'], [497, 'bass']]) {
    data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 150 + z, cf: cf(PS.x1 - 2.6, G + 1, z, Math.PI / 2) });
    if (inst === 'drums') { for (const dz of [-1, 0, 1]) add([1, 0.8, 1], [PS.x1 - 1.4, G + 1.5, z + dz * 1.1], [RED, CHROME, RED][dz + 1], 'Metal', { shape: 5, collide: 0 }); }
    else if (inst === 'keys') add([1, 0.3, 2.6], [PS.x1 - 4, G + 2.1, z], BLACK, 'SmoothPlastic', { collide: 0 });
    else add([0.2, 0.6, 2], [PS.x1 - 3.6, G + 2.4, z], inst === 'guitar' ? TEAL : PINK, 'SmoothPlastic', { collide: 0, rot: RX(0.5) });
  }
  for (const z of [476, 498]) { box([2.2, 6, 2], [PS.x1 - 1.6, G + 1, z], BLACK, 'Metal', { collide: 0 }); add([1.6, 1.6, 0.1], [PS.x1 - 2.75, G + 5, z], 0x3a3a3e, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] }); }
  box([2, 2.4, 9], [710, G, 486], 0x2a2a2e, 'Metal', { collide: 0 });
  for (let k = 0; k < 12; k++) neon([0.3, 0.15, 0.3], [710.6, G + 2.5, 482 + k * 0.7], [PINK, TEAL, GOLD][k % 3]);
  light(728, 10, 487, PINK);
  light(712, 9, 482, TEAL);
  // the inside line: two short rows, then the corridor west to the dock
  const corridor = { x0: 606, x1: PS.x0, z0: 524, z1: 531 };
  add([corridor.x1 - corridor.x0, 0.12, corridor.z1 - corridor.z0], [(corridor.x0 + corridor.x1) / 2, G + 0.06, (corridor.z0 + corridor.z1) / 2], 0x2a2230, 'Fabric', { collide: 0 });
  for (const z of [corridor.z0, corridor.z1]) {
    const n = Math.round((corridor.x1 - corridor.x0) / 4);
    for (let k = 0; k <= n; k++) box([0.2, 1.4, 0.2], [corridor.x0 + ((corridor.x1 - corridor.x0) * k) / n, G, z], CHROME, 'Metal', { collide: 0 });
    add([corridor.x1 - corridor.x0, 0.1, 0.1], [(corridor.x0 + corridor.x1) / 2, G + 1.15, z], 0x9a9ea6, 'Metal', { collide: 0 });
    neon([corridor.x1 - corridor.x0, 0.12, 0.12], [(corridor.x0 + corridor.x1) / 2, G + 0.2, z], z === corridor.z0 ? PINK : TEAL);
  }
  for (let x = corridor.x0 + 8; x < corridor.x1; x += 16) sign([4.4, 2.4, 0.2], [x, 4, corridor.z1 + 0.3], [PINK, TEAL, GOLD, PURPLE][Math.round(x / 16) % 4], 'Front', [[['BACKSTAGE', 'ALL ACCESS', 'NO FLASH', 'CREW ONLY'][Math.round(x / 16) % 4], 0, 0, 1, 1, BLACK, 'GothamBold']]);

  const fwd = [[743, 446], [736, 449], [716, ROWZ[0]], [604, ROWZ[0]], [604, ROWZ[1]], [716, ROWZ[1]], [716, ROWZ[2]], [604, ROWZ[2]], [604, ROWZ[3]], [DOOR, ROWZ[3]],
    [DOOR, B.z0 + 3], [DOOR, 486], [DOOR - 6, 486], [DOOR - 6, 506], [732, 506], [732, 514], [704, 514], [704, 527.5], [608, 527.5], [604.6, 536]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, -0.4], G);
  // (the two short inside rows have chains too)
  chainX(704, 728, 510);
  chainX(708, 736, 518);

  // ======== the track
  const track = makeTrack(CIRCUIT, {
    rolls: [
      { from: knot(634, 614), to: knot(670, 613), h: 1.3 },
      { from: knot(664, 504), to: knot(618, 502), h: 1.3, dir: -1 },
    ],
  });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
  const samples = [];
  for (let s = 0; s < track.length; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
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
  const clearOf = (size, pos) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < 3.6 && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.6) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  // supports: from the floor up under the spine (never in the corridor or studio)
  let supports = 0;
  for (let s = 6; s < track.length - 4; s += 7) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.9) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (inRect(foot.x, foot.z, { x0: corridor.x0, x1: B.x1, z0: B.z0, z1: corridor.z1 }, 2)) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], 0x2a2a30, 'Metal', { shape: 5, collide: 0 });
    supports++;
  }
  // ======== the loading dock: the tour cars wait at the light
  add([5.4, 0.3, 22], [605.3, G + 0.15, 538], 0x3a3a40, 'DiamondPlate', { collide: 0 });
  add([0.5, 0.1, 22], [602.9, G + 0.32, 538], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  sign([0.3, 3, 16], [B.x0 + T + 0.3, 9, 540], BLACK, 'Right', [['LOADING DOCK', 0, 0, 1, 0.6, PINK], ['BENTON RECORDS  ·  TOUR CARS', 0, 0.6, 1, 0.4, TEAL, 'GothamBold']], { glow: true });
  // the launch light: a gantry over the track, red-red-red... green
  box([0.6, 8, 0.6], [595.6, G, 552], 0x2a2a30, 'Metal', { collide: 0 });
  add([8.6, 0.6, 0.6], [599.6, G + 8, 552], 0x2a2a30, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([0.9, 0.9, 0.5], [598 + k * 1.1, G + 7.2, 552.2], k < 3 ? 0xff2020 : 0x30ff60, 'Neon', { shape: 3, collide: 0 });
  const con = [607.6, 548];
  box([1.4, 3, 2.4], [con[0], G, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(605, 9, 538, 0xffd0e8);
  // rings of light down the launch
  for (let s = 14; s < 58; s += 7) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); U.setFromMatrixColumn(m4, 1); R.setFromMatrixColumn(m4, 0);
    const C = P.clone().addScaledVector(U, 1.6);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const q = C.clone().addScaledVector(R, Math.cos(a) * 4.6).addScaledVector(U, Math.sin(a) * 4.6);
      if (q.y > G + 0.4) SN([0.45, 0.45, 0.45], [q.x, q.y, q.z], k % 2 ? PINK : TEAL, { shape: 3 });
    }
  }

  // ======== the show in the dark: speaker stacks, neon, records, spotlights
  for (const [x, z] of [[612, 590], [626, 560], [718, 620 - 8], [736, 540], [660, 530], [640, 600], [700, 600], [620, 520]]) {
    if (SB([4, 9, 3], [x, G, z], BLACK, 'Metal', { collide: 0 }) < 0) continue;
    for (let k = 0; k < 3; k++) S([2.6, 2.6, 0.2], [x, G + 1.6 + k * 2.8, z - 1.55], 0x3a3a40, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
    SN([4.1, 0.2, 3.1], [x, G + 9, z], PINK);
  }
  [['ON AIR', RED, [B.x0 + T + 0.3, 16, 580], 'Right'], ['TURN IT UP', PINK, [B.x1 - T - 0.3, 18, 580], 'Left'], ['ENCORE', TEAL, [660, 24, B.z1 - T - 0.3], 'Front'], ['SOLD OUT', GOLD, [700, 20, B.z1 - T - 0.3], 'Front'],
    ['ALL ACCESS', PURPLE, [B.x1 - T - 0.3, 14, 600], 'Left'], ['LIVE TONIGHT', PINK, [620, 26, B.z1 - T - 0.3], 'Front']].forEach(([text, c, pos, face]) => {
    sign(face === 'Front' ? [16, 3, 0.3] : [0.3, 3, 16], pos, BLACK, face, [[text, 0, 0, 1, 1, c]], { glow: true });
  });
  // giant records hanging on the walls, and music notes in neon
  for (const [x, y, z] of [[B.x0 + T + 0.5, 22, 600], [B.x1 - T - 0.5, 24, 560], [B.x0 + T + 0.5, 10, 510]]) {
    add([0.4, 10, 10], [x, y, z], BLACK, 'SmoothPlastic', { shape: 2, collide: 0 });
    add([0.5, 3, 3], [x, y, z], [PINK, TEAL, GOLD][Math.round(z / 50) % 3], 'Neon', { shape: 2, collide: 0 });
  }
  for (let k = 0; k < 10; k++) {
    const x = 620 + (k * 37) % 110, y = 14 + (k % 4) * 4, z = 520 + (k * 53) % 90;
    if (SN([0.8, 0.8, 0.3], [x, y, z], [PINK, TEAL, GOLD, PURPLE][k % 4], { shape: 3 }) < 0) continue;
    SN([0.15, 2, 0.15], [x + 0.35, y + 1, z], [PINK, TEAL, GOLD, PURPLE][k % 4]);
  }
  // spotlights sweeping colors along the run
  for (let s = 20; s < track.length - 10; s += 20) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.min(B.H - 3, P.y + 6), P.z, [PINK, TEAL, PURPLE, GOLD][Math.round(s / 20) % 4]); }

  // ======== the tour cars: long, black and chrome, speakers in every headrest
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const carParts = (k) => [
    pp(0, [3.4, 0.9, 3.4], [0, 0.65, 0], BLACK, 'SmoothPlastic'),
    pp(0, [3.5, 0.2, 3.5], [0, 1.1, 0], CHROME, 'Metal'),
    pp(0, [3.6, 0.15, 3.3], [0, 0.18, 0], [PINK, TEAL, PURPLE, GOLD, PINK][k], 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x2a1a2a, 'Fabric'),
      pp(0, [1.1, 1.5, 0.25], [x, 2.0, z + 0.5], BLACK, 'SmoothPlastic'),
      pp(2, [0.5, 0.6, 0.6], [x, 2.55, z + 0.66], 0x3a3a40, 'Metal', [0, 0, 1, 0, 1, 0, -1, 0, 0]),
    ])),
    ...(k === 0 ? [pp(0, [3.2, 1.1, 1], [0, 1, -2.1], BLACK, 'SmoothPlastic'), pp(0, [3.3, 0.2, 0.2], [0, 1.5, -2.62], CHROME, 'Metal'), pp(3, [0.5, 0.5, 0.2], [-1.1, 1, -2.62], 0xfff4c0, 'Neon'), pp(3, [0.5, 0.5, 0.2], [1.1, 1, -2.62], 0xfff4c0, 'Neon')] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
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
    stops.push(cf(603.6, G, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2, 3], [4, 5]],
    console: cf(con[0], G, con[1], Math.PI / 2), operator: cf(con[0] + 1.4, G, con[1], Math.PI / 2),
    homes: [cf(606, G, 534, Math.PI / 2), cf(606, G, 544, Math.PI / 2)],
    exit: cf(607, G, 530, Math.PI),
  };

  // ======== the ride
  const origin = [660, 0, 560];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
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
  // the launch fires with sparks; flames at the dive; a burst at the corkscrew
  const cues = [[at(600, 562), 'sparks', [0, 1, 3]], [at(714, 600), 'fire', [-4, 0, 0]], [at(648, 502), 'sparks', [0, 4, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Benton Roll', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "An indoor launched coaster in the dark. The Diesel Kings are playing a sold-out show across town and you're on the list - if you make it in time. Line up under the giant guitar, catch the band's recording session in Studio B, then the tour car launches you from the loading dock into a heartline roll, a dive, a helix and a corkscrew, past speaker stacks, neon and spotlights.",
    baseWait: 60, origin, entrance: [736, 0, 449], exit: [743, 0, 440], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, BLACK, PINK], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), "Benton Roll is open - the show's across town, better hurry!", 'Stand-by line starts at the gateway!'];
  return { ride, gate: { x: gx, z: 440 }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, supports };
}

// a toast the first time you come near the new ride
export class BentonRollSite {
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
      this.hooks.toast('NEW: Benton Roll, a launched coaster in the dark! The stand-by line is through the gate north of Benton Flash.', 'reward');
    }
  }
}
