// THE LION'S BREATH: a drop-tower thrill ride in Savanna Reach, by Kingdom
// Walk. An old stone tower stands at the edge of the savanna with a great
// carved lion's head near its top, and the story goes that the stone lion
// still breathes. Walk the forecourt, into the torchlit antechamber, and
// board a brass-and-timber lift cab. It glides forward into the shaft,
// climbs past a pair of eyes watching in the dark, and stops behind the
// lion's mouth. The doors in the mouth open on the whole park - the lion
// breathes out - and the cab drops, is hauled back up, drops again, peeks
// out once more... and falls all the way down.
import { queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';

export const RIDE_ID = 'LionsBreath';
const G = 0.02;
const TW = { x0: 282, x1: 318, z0: 767, z1: 803, H: 100 }; // the tower
const SH = { z0: 793, z1: 801 }; // its shaft, along the front wall
const MOUTH = { x0: 295, x1: 305, y0: 78, y1: 86.5 }; // the window: the lion's open mouth
const ORIGIN = [300, 0, 788]; // the cab at rest in the antechamber (it faces +z: the mouth)
const STONE = 0xc89a60, STONE2 = 0xb08450, DARK = 0x6a4a2a, MANE = 0xb8783a, GOLD = 0xf0b030, INK = 0x1a1410, AMBER = 0xffb020, WOOD = 0x6a4a2a;
const RY_PI = [-1, 0, 0, 0, 1, 0, 0, 0, -1];

// the cab's run: [t, x, y, z, shape] in the ride's frame (its -z is the world's +z, toward the mouth)
const KEYS = [
  [0, 0, 0.6, 0], [4, 0, 0.6, 0],
  [9, 0, 0.6, -9, 'ease'], [11, 0, 0.6, -9], // into the shaft
  [19, 0, 40, -9, 'ease'], [24, 0, 40, -9], // up to the eyes in the dark
  [32, 0, 78.6, -9, 'ease'], [39, 0, 78.6, -9], // behind the mouth: the doors open
  [40.8, 0, 22, -9, 'drop'], [42.4, 0, 62, -9, 'drop'], [43.2, 0, 62, -9], // drop! and hauled back up
  [44.8, 0, 32, -9, 'drop'], [46.6, 0, 78.6, -9, 'drop'], [48.4, 0, 78.6, -9], // drop, and up to peek out again
  [50.4, 0, 6, -9, 'drop'], [53, 0, 0.6, -9, 'ease'], // all the way down
  [58, 0, 0.6, 0, 'ease'], [62, 0, 0.6, 0], // and back out to unload
];
const DOORS_OPEN = [[32.2, 39.6], [46.8, 48.6]];

export function buildLionsBreath(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.hauntLights = data.hauntLights || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  const light = (x, y, z, c) => data.hauntLights.push([x, y, z, c]);
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const path = (pts, w) => { for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); add([w, 0.2, len + w * 0.6], [(a[0] + b[0]) / 2, G + 0.1, (a[1] + b[1]) / 2], 0xc8b08a, 'Pavement', { collide: 0, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }); } };

  // ======== the tower: walls with doors (west in, east out), the antechamber's ceiling, the shaft's back wall
  const wall = (x0, x1, z0, z1, y0, y1, c = STONE) => box([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, G + y0, (z0 + z1) / 2], c, 'Slate');
  const T = 2, DOOR = [776, 784];
  for (const [x0, x1] of [[TW.x0, TW.x0 + T], [TW.x1 - T, TW.x1]]) {
    wall(x0, x1, TW.z0, DOOR[0], 0, TW.H); wall(x0, x1, DOOR[1], TW.z1, 0, TW.H); wall(x0, x1, DOOR[0], DOOR[1], 10, TW.H);
  }
  wall(TW.x0, TW.x1, TW.z0, TW.z0 + T, 0, TW.H);
  // the front, round the mouth
  wall(TW.x0, TW.x1, SH.z1, TW.z1, 0, MOUTH.y0);
  wall(TW.x0, TW.x1, SH.z1, TW.z1, MOUTH.y1, TW.H);
  wall(TW.x0, MOUTH.x0, SH.z1, TW.z1, MOUTH.y0, MOUTH.y1);
  wall(MOUTH.x1, TW.x1, SH.z1, TW.z1, MOUTH.y0, MOUTH.y1);
  wall(TW.x0 + T, TW.x1 - T, TW.z0 + T, SH.z0 - 1, 12, 13, STONE2); // the antechamber's ceiling
  wall(TW.x0 + T, TW.x1 - T, SH.z0 - 1, SH.z0, 13, TW.H, STONE2); // the shaft's back wall
  add([TW.x1 - TW.x0, 1, TW.z1 - TW.z0], [(TW.x0 + TW.x1) / 2, G + TW.H + 0.5, (TW.z0 + TW.z1) / 2], STONE2, 'Slate');
  // banding, corner pilasters, a parapet and a golden sun on top
  for (let y = 12; y < TW.H; y += 14) {
    add([TW.x1 - TW.x0 + 0.6, 0.8, 0.3], [(TW.x0 + TW.x1) / 2, G + y, TW.z1 + 0.15], DARK, 'Slate', { collide: 0 });
    add([TW.x1 - TW.x0 + 0.6, 0.8, 0.3], [(TW.x0 + TW.x1) / 2, G + y, TW.z0 - 0.15], DARK, 'Slate', { collide: 0 });
    for (const x of [TW.x0 - 0.15, TW.x1 + 0.15]) add([0.3, 0.8, TW.z1 - TW.z0 + 0.6], [x, G + y, (TW.z0 + TW.z1) / 2], DARK, 'Slate', { collide: 0 });
  }
  for (const x of [TW.x0, TW.x1]) for (const z of [TW.z0, TW.z1]) box([3.4, TW.H + 4, 3.4], [x, G, z], STONE2, 'Slate', { collide: 0 });
  for (let k = 0; k < 9; k++) for (const [z, c] of [[TW.z0, STONE], [TW.z1, STONE]]) add([2.4, 3, 2.4], [TW.x0 + 2 + k * 4, G + TW.H + 2.5, z], c, 'Slate', { collide: 0 });
  for (let k = 1; k < 8; k++) for (const x of [TW.x0, TW.x1]) add([2.4, 3, 2.4], [x, G + TW.H + 2.5, TW.z0 + k * 4.5], STONE, 'Slate', { collide: 0 });
  add([12, 12, 0.8], [300, G + TW.H + 10, (TW.z0 + TW.z1) / 2], GOLD, 'Metal', { collide: 0, shape: 2, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; add([0.8, 4, 0.6], [300 + Math.cos(a) * 8.5, G + TW.H + 10 + Math.sin(a) * 8.5, (TW.z0 + TW.z1) / 2], GOLD, 'Metal', { collide: 0, rot: RZ(a - Math.PI / 2) }); }
  box([2, 4, 2], [300, G + TW.H + 1, (TW.z0 + TW.z1) / 2], STONE2, 'Slate', { collide: 0 });
  // vines down the walls
  for (const [x, z, h] of [[285, TW.z1 + 0.25, 46], [314, TW.z1 + 0.25, 30], [TW.x0 - 0.25, 772, 60], [TW.x1 + 0.25, 796, 38]]) for (let y = 4; y < h; y += 3) add([1.6, 2.6, 0.2], [x + Math.sin(y) * 1.2, G + TW.H - 10 - y, z], 0x3a7a2a, 'Grass', { collide: 0, rot: z > TW.z0 && z < TW.z1 ? [0, 0, 1, 0, 1, 0, -1, 0, 0] : undefined });

  // ======== the lion's head round the mouth
  const F = TW.z1; // the front face
  const head = (size, pos, color, mat = 'Slate', o = {}) => add(size, pos, color, mat, { collide: 0, ...o });
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    if (a > Math.PI * 1.2 && a < Math.PI * 1.8) continue; // (the lower arc is the beard, below the jaw)
    head([7, 6.5, 3], [300 + Math.cos(a) * 15.5, G + 89 + Math.sin(a) * 15.5, F + 1.5], k % 2 ? MANE : 0xa86a30, 'Slate', { rot: RZ(a + Math.PI / 2) });
  }
  for (let k = 0; k < 5; k++) head([4.6, 5, 2.6], [292 + k * 4, G + 72 - (k % 2) * 1.5, F + 1.3], k % 2 ? MANE : 0xa86a30);
  head([20, 14, 4], [300, G + MOUTH.y1 + 7, F + 2], 0xd8a860); // the upper face
  head([4, MOUTH.y1 - MOUTH.y0, 4], [MOUTH.x0 - 2, G + (MOUTH.y0 + MOUTH.y1) / 2, F + 2], 0xd8a860); // cheeks
  head([4, MOUTH.y1 - MOUTH.y0, 4], [MOUTH.x1 + 2, G + (MOUTH.y0 + MOUTH.y1) / 2, F + 2], 0xd8a860);
  head([16, 3, 5.5], [300, G + MOUTH.y0 - 1.5, F + 2.75], 0xc89a50); // the jaw
  head([7, 6, 3], [300, G + 93, F + 5], 0xd0a058); // the muzzle
  head([5, 3.4, 2.4], [300, G + 90.5, F + 6.6], 0x4a2a1a); // the nose
  head([22, 2, 2.4], [300, G + 97.6, F + 4.6], 0xc08a48); // the brow
  for (const sx of [-1, 1]) {
    head([3.4, 1.6, 0.4], [300 + sx * 5.4, G + 95.2, F + 4.1], AMBER, 'Neon'); // the eyes, glowing
    head([4, 4.4, 2], [300 + sx * 9.5, G + 102, F + 1.4], MANE); // ears
    head([0.8, 2.4, 0.8], [300 + sx * 3.6, G + MOUTH.y1 - 1.1, F + 3.4], 0xf4ecd8); // fangs
    head([0.8, 2, 0.8], [300 + sx * 2.4, G + MOUTH.y0 + 1, F + 3.6], 0xf4ecd8);
    for (let j = 0; j < 3; j++) head([3.2, 0.15, 0.15], [300 + sx * 7, G + 89 + j * 0.8, F + 5.5], 0x3a2a1a); // whiskers
  }
  light(300, 82, F + 8, AMBER);
  // its breath: a haze always curling out of the mouth
  data.tags.SteamVent.push([300, G + MOUTH.y0 + 0.5, F + 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);

  // ======== the antechamber: torches, lion statues, the legend
  add([TW.x1 - TW.x0 - 2 * T, 0.2, TW.z1 - TW.z0 - 2 * T], [(TW.x0 + TW.x1) / 2, G + 0.1, (TW.z0 + TW.z1) / 2], 0x9a7a58, 'Pavement', { collide: 0 }); // (a stone floor)
  for (const z of [DOOR[0] + 4]) for (const x of [TW.x0 + 1, TW.x1 - 1]) add([T + 0.4, 0.2, DOOR[1] - DOOR[0]], [x, G + 0.1, z], 0x9a7a58, 'Pavement', { collide: 0 });
  for (const [x, z] of [[285, 771], [285, 791], [315, 771], [315, 791]]) { box([0.6, 5, 0.6], [x, G, z], WOOD, 'Wood', { collide: 0 }); data.tags.Campfire.push([x, G + 5.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
  for (const x of [289, 311]) {
    box([3, 2, 4], [x, G, 771], STONE2, 'Slate');
    add([2.4, 3, 3.4], [x, G + 3.5, 771.2], STONE, 'Slate', { collide: 0 });
    add([2.2, 2.2, 2], [x, G + 6, 772.6], MANE, 'Slate', { collide: 0, shape: 3 });
    add([1.4, 1.4, 1.2], [x, G + 6, 773.6], 0xd8a860, 'Slate', { collide: 0 });
  }
  sign([16, 3, 0.3], [300, G + 8.4, TW.z0 + T + 0.2], INK, 'Back', [["THEY SAY THE STONE LION", 0, 0, 1, 0.5, GOLD], ['STILL BREATHES', 0, 0.5, 1, 0.5, AMBER]], { glow: true });
  for (let k = 0; k < 6; k++) add([0.15, 1.2, 0.6 + (k % 3) * 0.4], [TW.x0 + T + 0.1, G + 7, 770 + k * 1.6 + (k > 2 ? 15 : 0)], GOLD, 'Neon', { collide: 0 });
  light(292, 8, 780, 0xffa040); light(308, 8, 780, 0xffa040);
  // the shaft: glyphs glowing up its walls, lamps for the climb
  for (let y = 16; y < TW.H - 6; y += 12) for (const x of [TW.x0 + T + 0.1, TW.x1 - T - 0.1]) add([0.15, 2.4, 1.2], [x, G + y + (x > 300 ? 6 : 0), 797], (y / 12) % 2 ? GOLD : AMBER, 'Neon', { collide: 0 });
  for (const y of [10, 30, 46, 62, 80]) light(300, y, 797, y === 46 ? 0x8a4a20 : 0xffa860);

  // ======== the boarding platform beside the cab, its guard, the crew's posts
  const PX = [TW.x0 + T, 294.5], PZ = [781, 795], PY = 0.6;
  add([PX[1] - PX[0], PY, PZ[1] - PZ[0]], [(PX[0] + PX[1]) / 2, PY / 2, (PZ[0] + PZ[1]) / 2], 0x8a7050, 'Slate');
  add([0.3, 0.06, PZ[1] - PZ[0]], [PX[1] - 0.3, PY + 0.03, (PZ[0] + PZ[1]) / 2], 0xf2c418, 'SmoothPlastic', { collide: 0 });
  data.hidden.push(add([0.3, 5, PZ[1] - PZ[0] - 2], [294.3, PY + 2.5, (PZ[0] + PZ[1]) / 2], INK, 'SmoothPlastic'));
  const face = -Math.PI / 2; // (facing +x, the cab)
  const stops = [cf(293.2, PY, 786, face), cf(293.2, PY, 790, face)];
  box([1.4, 1.2, 1.4], [286.5, PY, 793], 0x2a2a30, 'Metal', { collide: 0 });
  const crew = {
    stopCars: [1, 1], stops, restraint: 'lapbar', attendants: 1, routes: [[1, 2]],
    console: cf(287.5, PY, 793, face), operator: cf(286.5, PY, 791.6, face),
    homes: [cf(288, PY, 785, face), cf(288, PY, 789, face)],
    exit: cf(312, G, 780, -Math.PI / 2),
  };

  // ======== the cab: brass and timber, two rows facing the mouth
  const cab = [
    pp(0, [10, 0.6, 7], [0, 0.3, 0], 0x3a2418, 'WoodPlanks'),
    pp(0, [10, 8, 0.4], [0, 4.6, 3.3], 0x5a3a22, 'WoodPlanks'),
    pp(0, [10.4, 0.4, 7.4], [0, 8.8, 0], 0x2a1a10, 'WoodPlanks'),
    pp(0, [10, 0.8, 0.25], [0, 8.2, -3.45], GOLD, 'Metal'),
    pp(0, [9.4, 0.5, 1.4], [0, 1.75, -1.3], 0x6a3a22, 'WoodPlanks'), pp(0, [9.4, 1.5, 0.25], [0, 2.75, -0.5], 0x6a3a22, 'WoodPlanks'),
    pp(0, [9.4, 2.4, 1.8], [0, 1.8, 1.6], 0x4a2a18, 'WoodPlanks'), pp(0, [9.4, 1.5, 0.25], [0, 3.75, 2.5], 0x6a3a22, 'WoodPlanks'),
    pp(0, [9, 0.3, 0.3], [0, 2.9, -2.1], GOLD, 'Metal'), pp(0, [9, 0.3, 0.3], [0, 3.9, 0.85], GOLD, 'Metal'),
    pp(0, [10, 0.3, 0.3], [0, 2.6, -3.3], GOLD, 'Metal'),
    pp(3, [0.8, 1.2, 0.8], [0, 9.6, 0], 0xffb040, 'Neon'),
  ];
  for (const x of [-4.8, 4.8]) {
    for (const z of [-3.3, 3.3]) cab.push(pp(0, [0.4, 8, 0.4], [x, 4.6, z], GOLD, 'Metal'));
    cab.push(pp(0, [0.3, 0.3, 7], [x, 2.6, 0], GOLD, 'Metal'));
  }
  const seats = [[-1.4, 3.3], [1.6, 4.3]].flatMap(([z, y]) => [-3.6, -1.8, 0, 1.8, 3.6].map((x) => [x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]));

  // the doors in the mouth (open while the cab's at the top), the eyes in the shaft
  const extras = {}, extrasNames = [], props = [];
  const doorAt = [300, G + (MOUTH.y0 + MOUTH.y1) / 2, SH.z1 + 0.8];
  extras.MouthDoors = { pivot: [...doorAt, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [-1, 1].map((sx) => pp(0, [5, MOUTH.y1 - MOUTH.y0, 0.4], [sx * 2.5, 0, 0], 0x4a3020, 'WoodPlanks')).concat([pp(0, [0.3, MOUTH.y1 - MOUTH.y0, 0.5], [0, 0, 0], GOLD, 'Metal')]) };
  props.push({ name: 'MouthDoors', at: doorAt, kind: 'show', windows: DOORS_OPEN, invert: true });
  const eyesAt = [300, G + 46.4, SH.z1 - 0.15];
  extras.ShaftEyes = { pivot: [...eyesAt, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: [-1, 1].map((sx) => pp(3, [2.6, 1.2, 0.2], [sx * 3, 0, 0], AMBER, 'Neon')) };
  props.push({ name: 'ShaftEyes', at: eyesAt, kind: 'blink', period: 1, duty: 1, phase: 0, only: [[19.4, 24.6]] });
  extrasNames.push('MouthDoors', 'ShaftEyes');

  // ======== the queue: the forecourt west of the tower, in through the west door to the platform
  const fwd = [[270, 850], [270, 808], [266, 808], [266, 772], [270, 772], [270, 804], [274, 804], [274, 772], [278, 772], [278, 780], [287, 780], [291, 786], [293, 788]];
  const outside = 10; // (the rails stop at the door)
  for (let k = 0; k < outside; k++) {
    const [a, b] = [fwd[k], fwd[k + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    for (const sd of [-1, 1]) {
      const n = Math.max(1, Math.round(len / 3.2));
      for (let j = 0; j <= n; j++) box([0.25, 1.1, 0.25], [a[0] + ux * len * j / n - uz * sd * 1.5, G, a[1] + uz * len * j / n + ux * sd * 1.5], WOOD, 'Wood');
      add([0.12, 0.12, len], [(a[0] + b[0]) / 2 - uz * sd * 1.5, G + 1, (a[1] + b[1]) / 2 + ux * sd * 1.5], 0xc8a878, 'Fabric', { collide: 0, yaw: Math.atan2(ux, uz) });
    }
  }
  add([18, 0.2, 44], [272, G + 0.1, 789], 0xc8b08a, 'Pavement', { collide: 0 });
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], G);
  const [ex, ez] = fwd[0];
  // the forecourt's gateway, the ride's name over it
  for (const x of [ex - 5, ex + 5]) { box([2, 9, 2], [x, G, ez - 4], STONE, 'Slate'); add([2.6, 2.6, 2.6], [x, G + 10.2, ez - 4], MANE, 'Slate', { collide: 0, shape: 3 }); }
  add([14, 1.6, 2], [ex, G + 9.8, ez - 4], STONE2, 'Slate', { collide: 0 });
  sign([13, 2.6, 0.3], [ex, G + 12, ez - 4 + 1.2], INK, 'Back', [["THE LION'S BREATH", 0, 0, 1, 1, GOLD]], { glow: true });
  box([0.35, 4, 0.35], [ex + 2.6, G, ez], WOOD, 'Wood', { collide: 0 });
  const waitPart = add([0.3, 1.1, 3.6], [ex + 2.9, G + 3.3, ez], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'SavannaReach', seed: RIDE_ID.length * 7, cf: cf(ex - 2.4, G, ez, 0) });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), "The Lion's Breath is boarding - they say the stone lion still breathes!"];
  // paths: to the forecourt from Kingdom Walk's path to Savanna Reach, and from the exit down to the Savanna Reach plaza
  path([[ex, 872], [ex, ez]], 8);
  path([[TW.x1, 780], [326, 780], [334, 812], [338, 834]], 6);

  // ======== the ride
  const ride = {
    id: RIDE_ID, kind: 'droptower', keys: KEYS, duration: KEYS[KEYS.length - 1][0],
    origin: [...ORIGIN, ...RY_PI], carCount: 1, carSpacing: 0,
    cars: [{ pivot: [ORIGIN[0], 0.6, ORIGIN[2], ...RY_PI], parts: cab }], seats: [seats], capacity: seats.length,
    queue: qpath, extras, extrasNames, props, crew, noExtended: true,
  };
  data.rides.push(ride);
  data.config.Rides.push({
    id: RIDE_ID, name: "The Lion's Breath", land: 'SavannaReach', category: 'Thrill', thrill: 4, kind: 'droptower',
    description: "An old stone tower at the edge of the savanna, with a great carved lion's head near the top - and they say the stone lion still breathes. Board the lift in the torchlit antechamber and ride up the dark shaft, past the eyes watching you, to the lion's mouth. The doors open on the whole park... the lion breathes out... and you drop. And drop again. Nobody knows how many times.",
    baseWait: 50, origin: ORIGIN, entrance: [ex, 0, ez], exit: [326, 0, 780], yaw: 0, layout: RIDE_ID,
    cars: 1, carSpacing: 0, colors: [STONE, GOLD, MANE], cues: [[32.4 / ride.duration, 'breath', [0, 5.5, -9]], [46.9 / ride.duration, 'breath', [0, 5.5, -9]]],
  });
  return { ride, indoor: { x0: TW.x0, x1: TW.x1, z0: TW.z0, z1: TW.z1 }, entrance: [ex, ez] };
}

// a toast the first time you come near
export class LionsBreathSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const [x, z] = this.layout.entrance;
    if (Math.hypot(pos.x - x, pos.z - z) < 70) {
      this.told = true;
      this.hooks.toast("NEW: The Lion's Breath - ride up the old stone tower to the lion's mouth... then drop. In Savanna Reach, by Kingdom Walk.", 'reward');
    }
  }
}

