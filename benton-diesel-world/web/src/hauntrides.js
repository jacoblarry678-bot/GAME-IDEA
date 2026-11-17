// Benton Haunt houses inside ride buildings: three new walk-through houses
// built into the show buildings of three rides, in the floor space their
// rides don't use (the rides keep running beside them).
//   Siren's Wake: The Drowned Crew - the north side of Siren's Wake's
//     boathouse: the deck of the Benton Belle in the storm, the flooded
//     hold, the crew's quarters and the siren's grotto.
//   Neon Getaway: Dead Drop - the west side of the Port Benton Savings &
//     Loan: the night vault, the parking garage and the motel hideout where
//     the getaway crew never got away.
//   Win the Crown: The Baron's Dungeon - under the north side of Baron
//     Vex's fortress: the cells, the armory and the executioner's hall.
// Each gets new doors cut into its building's walls, a front over the way
// in, and a line outside.
import { helpers } from './wolverine.js';

const G = 0.1;
const W = 2.9; // the inside face of a house's corridor walls
const ORANGE = 0xff7a1a, BLACK = 0x101012, WHITE = 0xf4f4f0;

// ---------------------------------------------------------------- rooms
const every = (R, step, fn, from = 3) => { for (let t = from, k = 0; t < R.len - 2; t += step, k++) fn(t, k); };
const two = (R, a, b, cover, mat) => {
  R.actor(R.len * 0.38, 1, a, cover, mat);
  R.actor(R.len * 0.8, -1, b, cover, mat);
};
const barrels = (R, t, side, colors = [0x5a3a20, 0x4a3018, 0x6a4a28]) => colors.forEach((c, k) => R.wall(t + k * 1.6, side, 1.4, 2.2, 1.4, c, 'WoodPlanks', { shape: 5 }));
const chains = (R, step, color = 0x4a4c52) => every(R, step, (t, k) => {
  const s = (k % 3) - 1;
  R.put(t, s * 1.4, [0.12, 3 + (k % 2) * 2, 0.12], 9.5 - (k % 2), color, 'Metal');
});

export const RIDE_ROOMS = {
  wreck: [
    { wall: [0x3a2c20, 'WoodPlanks'], floor: 0x1c140e, light: 0x40d8c8, dress: (R) => { // the deck of the Benton Belle, in the storm
      R.sign(4, 1, 'THE BENTON BELLE  ·  LOST WITH ALL HANDS', 7, 1.2, 7.5, 0x1a1a1c, 0x40d8c8, true);
      every(R, 7, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.8, [0.12, 7, 0.12], 6.5, 0xc8b088, 'Fabric', { turn: 0.35 * (k % 2 ? 1 : -1) }), 5);
      every(R, 13, (t, k) => barrels(R, t, k % 2 ? 1 : -1), 6);
      R.put(R.len * 0.55, -(W - 0.3), [0.3, 2.8, 2.8], 4, 0x5a3a20, 'Wood', { shape: 2 });
      for (let k = 0; k < 4; k++) R.spin(R.len * 0.55, -(W - 0.4), [0.2, 3.6, 0.2], 4, 0x4a3018, 'Wood', (k * Math.PI) / 4);
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      two(R, 'drownedSailor', 'drownedSailor', 0x3a2c20, 'WoodPlanks');
    } },
    { wall: [0x24343a, 'CorrodedMetal'], floor: 0x081418, light: 0x2a8aff, dress: (R) => { // the flooded hold
      R.sign(3, -1, 'CARGO HOLD  ·  KEEP DRY', 5, 1, 8, 0x1a1a1c, 0xf2c818);
      R.put(R.len / 2, 0, [W * 2, 0.05, R.len - 2], 0.14, 0x1a5a6a, 'Glass');
      every(R, 8, (t, k) => { for (let j = 0; j < 2; j++) R.wall(t, k % 2 ? 1 : -1, 1.8, 1.6, 1.6, [0x6a4a28, 0x5a3a20][j], 'WoodPlanks', { y0: j * 1.6 }); }, 4);
      chains(R, 4.5);
      every(R, 11, (t, k) => R.wall(t, k % 2 ? -1 : 1, 0.1, 0.25, 4, 0x40d8ff, 'Neon', { y0: 9.6 - (k % 3) }), 6);
      every(R, 14, (t, k) => R.fog(t, k % 2 ? -1 : 1), 7);
      two(R, 'drownedSailor', 'sirenHag', 0x24343a, 'CorrodedMetal');
    } },
    { wall: [0x4a3a2a, 'WoodPlanks'], floor: 0x2a1a10, light: 0xffa040, dress: (R) => { // the crew's quarters
      R.sign(4, 1, 'ALL HANDS LOST  ·  1904', 5, 1, 7.5, 0xf0e0b0, 0x5a1a1a);
      every(R, 6, (t, k) => { // hammocks slung over the bunks, sea chests
        R.put(t, (k % 2 ? 1 : -1) * 1.6, [1.4, 0.4, 3], 4.4, 0x8a7a5a, 'Fabric', { turn: 0.08 });
        R.wall(t + 1.5, k % 2 ? -1 : 1, 1.6, 1, 1, 0x5a3a20, 'WoodPlanks');
      }, 4);
      every(R, 12, (t) => R.put(t, 0, [1.6, 1.0, 1.6], 0.5, 0x4a3018, 'Wood'), 9);
      every(R, 9, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.2, [0.5, 0.7, 0.5], 6.4, 0xffb040, 'Neon'), 5);
      two(R, 'drownedSailor', 'drownedSailor', 0x4a3a2a, 'WoodPlanks');
    } },
    { wall: [0x22342e, 'Slate'], floor: 0x081210, light: 0x1ae0c0, dress: (R) => { // the siren's grotto
      R.sign(4, -1, 'DO NOT LISTEN TO THE SONG', 6, 1, 8, 0x0a1a18, 0x5afff0, true);
      every(R, 4.5, (t, k) => R.wall(t, k % 2 ? 1 : -1, 2.4, 1.6 + (k % 3) * 0.9, 1.8, 0x3a4a48, 'Slate', { shape: 3 }));
      every(R, 7, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.2, [1.6, 0.05, 1.6], 0.1, 0x1ae0c0, 'Neon', { shape: 5 }), 5);
      every(R, 13, (t, k) => { for (let j = 0; j < 3; j++) R.wall(t + j * 0.8, k % 2 ? -1 : 1, 0.5, 1.2 + j * 0.6, 0.5, [0xff6a8a, 0xffa060, 0xff4a6a][j], 'SmoothPlastic', { shape: 3, y0: 0.2 }); }, 8);
      every(R, 9, (t, k) => R.fog(t, k % 2 ? 1 : -1), 3);
      two(R, 'sirenHag', 'sirenHag', 0x22342e, 'Slate');
    } },
  ],
  neon: [
    { wall: [0x3a3a40, 'DiamondPlate'], floor: 0x141418, light: 0xff3a9a, dress: (R) => { // the night vault
      R.sign(4, 1, 'PORT BENTON SAVINGS & LOAN  ·  NIGHT VAULT', 8, 1.2, 8, 0x1a1a1c, 0xf0c040, true);
      every(R, 9, (t, k) => { // walls of safety deposit boxes, some hanging open
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) R.wall(t + i * 0.9, k % 2 ? 1 : -1, 0.8, 0.6, 0.15 + ((i + j + k) % 5 === 0 ? 0.5 : 0), 0x9a9ea6, 'Metal', { y0: 1 + j * 0.7 });
      }, 4);
      every(R, 15, (t, k) => { for (let j = 0; j < 4; j++) R.put(t + (j % 2) * 1.1, (k % 2 ? 1 : -1) * 1.9, [0.4, 0.25, 1], 0.2 + Math.floor(j / 2) * 0.26, 0xf0c040, 'Metal'); }, 8);
      R.wall(R.len * 0.5, -1, 5, 5, 0.7, 0x8a8e96, 'Metal', { shape: 2, y0: 0.6 });
      R.wall(R.len * 0.5, -1, 1.4, 1.4, 1.0, 0x5a5e66, 'Metal', { shape: 2, y0: 2.4 });
      every(R, 12, (t, k) => R.put(t, 0, [W * 2, 0.15, 0.15], 9.5, k % 2 ? 0xff2020 : 0x2060ff, 'Neon'), 6);
      two(R, 'neonCrook', 'neonCrook', 0x3a3a40, 'DiamondPlate');
    } },
    { wall: [0x6a6a6c, 'Concrete'], floor: 0x1a1a1c, light: 0x20e0d0, dress: (R) => { // the parking garage
      R.sign(3, -1, 'LEVEL B3  ·  NO EXIT', 5, 1.2, 8, 0x1a1a1c, 0x20e0d0, true);
      every(R, 10, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.4, 10.5, 1.4, 0x7a7a78, 'Concrete'), 5);
      every(R, 18, (t, k) => { // the getaway cars, shot up, and a squad car with its lights going
        const c = [0x8a1a3a, 0x1a1a2a, 0x2a4a6a][k % 3], sd = k % 2 ? -1 : 1;
        R.wall(t, sd, 4.4, 1.5, 2.1, c, 'Metal');
        R.wall(t, sd, 2.4, 0.9, 1.9, c, 'Metal', { y0: 1.5 });
        R.wall(t - 0.6, sd, 0.6, 0.3, 0.4, 0xff2020, 'Neon', { y0: 2.5 });
        R.wall(t + 0.6, sd, 0.6, 0.3, 0.4, 0x2060ff, 'Neon', { y0: 2.5 });
      }, 9);
      every(R, 3, (t, k) => R.put(t, 0, [0.12, 0.04, 1.4], 0.06, k % 2 ? 0xf2c818 : 0xf4f4f0, 'SmoothPlastic'));
      two(R, 'deadCop', 'neonCrook', 0x6a6a6c, 'Concrete');
    } },
    { wall: [0x4a1a3a, 'Fabric'], floor: 0x2a1a20, light: 0xff8a2a, dress: (R) => { // the motel hideout
      R.sign(4, 1, 'NO VACANCY', 4, 1.2, 8, 0x1a0a14, 0xff3a9a, true);
      every(R, 11, (t, k) => {
        const sd = k % 2 ? 1 : -1;
        R.wall(t, sd, 3.2, 0.8, 2, 0xd8c8b0, 'Fabric');
        R.wall(t, sd, 3.2, 1.2, 0.3, 0x5a2a3a, 'Wood', { y0: 0.8 });
        R.wall(t + 4, sd, 1.2, 1, 0.8, 0x2a2a2e, 'Metal', { y0: 1.2 });
        R.wall(t + 4, sd, 1.0, 0.8, 0.85, 0x8ab8ff, 'Neon', { y0: 1.3 });
      }, 4);
      every(R, 5, (t, k) => R.put(t, (k % 3 - 1) * 1.4, [0.6, 0.03, 0.3], 0.05, 0x3a8a3a, 'SmoothPlastic', { turn: k }));
      every(R, 13, (t, k) => R.fog(t, k % 2 ? 1 : -1), 6);
      two(R, 'neonCrook', 'deadCop', 0x4a1a3a, 'Fabric');
    } },
  ],
  dungeon: [
    { wall: [0x4a4a46, 'Slate'], floor: 0x1a1a18, light: 0xffa040, dress: (R) => { // the cells
      R.sign(4, 1, 'PROPERTY OF BARON VEX', 5, 1.2, 8, 0x1a1a1c, 0xf0c040, true);
      every(R, 8, (t, k) => { // a cell in each wall: a black hole behind iron bars
        const sd = k % 2 ? 1 : -1;
        R.wall(t + 1.5, sd, 4, 6, 0.05, 0x050505, 'SmoothPlastic');
        for (let i = 0; i < 6; i++) R.wall(t + i * 0.7, sd, 0.12, 6, 0.12, 0x2a2a2c, 'Metal', { y0: 0 });
        R.wall(t + 1.75, sd, 4.2, 0.2, 0.15, 0x2a2a2c, 'Metal', { y0: 5.8 });
      }, 3);
      chains(R, 3.5, 0x3a3a3c);
      every(R, 12, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.2, [1.2, 0.15, 2], 0.1, 0xb89a50, 'Fabric'), 6);
      every(R, 10, (t, k) => R.fire(t, k % 2 ? 1 : -1), 9);
      two(R, 'dungeonGuard', 'dungeonGuard', 0x4a4a46, 'Slate');
    } },
    { wall: [0x3a3a3c, 'Slate'], floor: 0x141414, light: 0xff3020, dress: (R) => { // the armory
      R.sign(3, -1, 'THE ARMORY', 4, 1.2, 8, 0x1a1a1c, 0xff3020, true);
      every(R, 7, (t, k) => { // spears in racks, shields with the Baron's crest
        const sd = k % 2 ? 1 : -1;
        for (let i = 0; i < 5; i++) R.wall(t + i * 0.5, sd, 0.1, 5, 0.1, 0x5a4a3a, 'Wood', { y0: 0.2 });
        R.wall(t + 4, sd, 1.6, 1.6, 0.2, 0x6a2a9a, 'Metal', { shape: 2, y0: 3 });
        R.wall(t + 4, sd, 0.5, 0.5, 0.3, 0xf0c040, 'Metal', { shape: 2, y0: 3.55 });
      }, 3);
      every(R, 13, (t, k) => { // suits of armor
        const sd = k % 2 ? -1 : 1;
        R.wall(t, sd, 0.9, 3.4, 0.7, 0x8a8e96, 'Metal');
        R.wall(t, sd, 0.8, 0.8, 0.8, 0x8a8e96, 'Metal', { shape: 3, y0: 3.4 });
      }, 8);
      every(R, 16, (t, k) => R.fire(t, k % 2 ? 1 : -1), 6);
      two(R, 'dungeonGuard', 'executioner', 0x3a3a3c, 'Slate');
    } },
    { wall: [0x2a1a1a, 'Brick'], floor: 0x0a0606, light: 0xc01010, dress: (R) => { // the executioner's hall
      R.sign(4, 1, 'NO ONE WINS THE CROWN', 6, 1.2, 8, 0x1a0a0a, 0xc01010, true);
      every(R, 9, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.6, 5, 0.1, 0x6a2a9a, 'Fabric', { y0: 4 }), 4);
      every(R, 9, (t, k) => R.wall(t, k % 2 ? 1 : -1, 0.3, 5, 0.12, 0xf0c040, 'Fabric', { y0: 4 }), 4);
      every(R, 14, (t, k) => { // the block, the axe in it, a guillotine
        const sd = k % 2 ? -1 : 1;
        R.wall(t, sd, 1.4, 1, 1.4, 0x5a3a20, 'Wood', { shape: 5 });
        R.wall(t, sd, 0.1, 1.2, 0.9, 0xb8bcc4, 'Metal', { y0: 1 });
        for (const dt of [-1.2, 1.2]) R.wall(t + 5 + dt, sd, 0.3, 6, 0.3, 0x3a2a1a, 'Wood');
        R.wall(t + 5, sd, 2.6, 0.3, 0.3, 0x3a2a1a, 'Wood', { y0: 6 });
        R.wall(t + 5, sd, 2.2, 0.6, 0.12, 0xb8bcc4, 'Metal', { y0: 4.6 });
      }, 6);
      every(R, 6, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.6, [0.6, 0.4, 0.6], 6.8, 0xf0c040, 'Metal', { shape: 5 }), 3);
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      two(R, 'executioner', 'executioner', 0x2a1a1a, 'Brick');
    } },
  ],
};

// ---------------------------------------------------------------- houses
// the three houses: their corridors, doors, fronts and lines
export const RIDE_HOUSES = [
  {
    id: 'HauntWreck', name: "Siren's Wake: The Drowned Crew", land: 'Velocity', theme: 'wreck', glow: 0x2ad8c8, ride: "Siren's Wake",
    description: "A Benton Haunt house inside Siren's Wake's boathouse. The Benton Belle went down with all hands - and the crew is still aboard. Walk her storm-lashed deck, the flooded hold and the crew's quarters, down to the grotto where the siren sings.",
    interior: [[1048, -31.6], [1048, -78], [1056, -78], [1056, -40], [1064, -40], [1064, -78], [1072, -78], [1072, -40], [1080, -40], [1080, -78], [1088, -78], [1088, -40], [1096, -40], [1096, -78], [1104, -78], [1104, -31.6]],
    outsideIn: [[1048, -24], [1048, -29]], outsideOut: [[1104, -24], [1104, -18]],
    queueFwd: [[1088, -18.6], [1088, -22.4], [1052, -22.4], [1048, -24]], entrance: [1088, -18.6], origin: [1076, 0, -58],
    doors: [{ x: 1048, z: -30.6, along: 'x' }, { x: 1104, z: -30.6, along: 'x' }],
    front: { at: [1048, -29.4], face: 'Back', exitAt: [1104, -29.4] }, baseWait: 75, speed: 0.85,
  },
  {
    id: 'HauntNeon', name: 'Neon Getaway: Dead Drop', land: 'Velocity', theme: 'neon', glow: 0xff3a9a, ride: 'Neon Getaway',
    description: 'A Benton Haunt house inside the Port Benton Savings & Loan. The getaway crew from Neon Getaway never got away. Break into the night vault, run the parking garage and hide out at the motel - but the crew and the cops who chased them are still here.',
    interior: [[1025.8, 106], [1030, 106], [1030, 14], [1038, 14], [1038, 106], [1046, 106], [1046, 9.8]],
    outsideIn: [[1019.5, 106], [1023, 106]], outsideOut: [[1046, 4.2], [1030, 4], [1016, 4]],
    queueFwd: [[1019.5, 168], [1019.5, 106]], entrance: [1019.5, 168], origin: [1038, 0, 60],
    doors: [{ x: 1024.6, z: 106, along: 'z' }, { x: 1046, z: 8.6, along: 'x' }],
    front: { at: [1023.4, 106], face: 'Left', exitAt: [1046, 7.4] }, baseWait: 65, speed: 0.85,
  },
  {
    id: 'HauntDungeon', name: "Win the Crown: The Baron's Dungeon", land: 'Backwoods', theme: 'dungeon', glow: 0x9a4aff, ride: 'Operation: Win the Crown',
    description: "A Benton Haunt house under Baron Vex's fortress, where Operation: Win the Crown races overhead. The agents who didn't win the crown ended up down here: the cells, the armory and the executioner's hall.",
    interior: [[-649.4, 478], [-706, 478], [-706, 485], [-656, 485], [-656, 492], [-700, 492], [-700, 498.6]],
    outsideIn: [[-640, 478], [-646, 478]], outsideOut: [[-700, 504], [-680, 506], [-640, 506], [-606, 506]],
    queueFwd: [[-606, 468], [-616, 468], [-616, 494], [-622, 494], [-622, 462], [-628, 462], [-628, 494], [-634, 494], [-634, 462], [-640, 462], [-640, 478]],
    entrance: [-606, 468], origin: [-681, 0, 485],
    doors: [{ x: -648.6, z: 478, along: 'z' }, { x: -700, z: 499.4, along: 'x' }],
    front: { at: [-647.4, 478], face: 'Right', exitAt: [-700, 500.6] }, baseWait: 55, speed: 0.7,
  },
];

// Cut a doorway into whatever walls stand across (x, z): every thin, long,
// axis-aligned part there is split into the pieces either side and the
// piece above.
function cutDoor(data, add, { x, z, along }, w = 7, h = 9) {
  const hidden = new Set(data.hidden);
  const out = [];
  data.static.forEach((p, i) => {
    if (hidden.has(i)) return;
    const axisX = Math.abs(p[7]) > 0.99 && Math.abs(p[11]) > 0.99, axisZ = Math.abs(p[9]) > 0.99 && Math.abs(p[11]) > 0.99;
    if (!axisX && !axisZ) return;
    // its extent in world x, y, z
    const ex = axisX ? p[1] / 2 : p[3] / 2, ez = axisX ? p[3] / 2 : p[1] / 2, ey = p[2] / 2;
    const longX = along === 'x';
    const len = longX ? ex : ez, thin = longX ? ez : ex;
    if (thin > 1.6 || len * 2 < w + 1) return;
    if (Math.abs((longX ? p[6] : p[4]) - (longX ? z : x)) > 1.6) return;
    if (Math.abs((longX ? p[4] : p[6]) - (longX ? x : z)) > len - 0.01) return;
    const y0 = p[5] - ey, y1 = p[5] + ey;
    if (y0 > G + h - 0.01 || y1 < G + 1) return;
    out.push(i);
  });
  for (const i of out) {
    const p = data.static[i];
    const axisX = Math.abs(p[7]) > 0.99;
    const longX = along === 'x';
    const ex = axisX ? p[1] / 2 : p[3] / 2, ez = axisX ? p[3] / 2 : p[1] / 2, ey = p[2] / 2;
    const c = longX ? p[4] : p[6], half = longX ? ex : ez, d = longX ? x : z;
    const a0 = c - half, a1 = c + half, g0 = d - w / 2, g1 = d + w / 2;
    const y0 = p[5] - ey, y1 = p[5] + ey;
    const solid = p[19];
    p[19] = 0;
    data.hidden.push(i);
    const piece = (b0, b1, yy0, yy1) => {
      if (b1 - b0 < 0.05 || yy1 - yy0 < 0.05) return;
      const thinW = longX ? ez * 2 : ex * 2, mid = (b0 + b1) / 2;
      const size = longX ? [b1 - b0, yy1 - yy0, thinW] : [thinW, yy1 - yy0, b1 - b0];
      const pos = longX ? [mid, (yy0 + yy1) / 2, p[6]] : [p[4], (yy0 + yy1) / 2, mid];
      const k = add(size, pos, p[16], data.materials[p[17]], { collide: solid });
      data.static[k][18] = p[18];
    };
    piece(a0, g0, y0, y1);
    piece(g1, a1, y0, y1);
    piece(Math.max(a0, g0), Math.min(a1, g1), Math.max(y0, G + h), y1);
  }
  return out.length;
}

// Before the corridors go in: the doorways into the buildings (call once,
// on the parts as the ride builders left them)
export function cutRideHouseDoors(data) {
  const { add } = helpers(data);
  data.hidden = data.hidden || [];
  let n = 0;
  for (const hs of RIDE_HOUSES) for (const d of hs.doors) n += cutDoor(data, add, d);
  return n;
}

// The fronts over the doors, fog, pumpkins, ropes along the lines, the
// wait-time boards and the greeters
export function buildRideHouseFronts(data) {
  const { add, box, sign, cf } = helpers(data);
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.staffSpots = data.staffSpots || [];
  const light = (x, y, z, color) => (data.hauntLights = data.hauntLights || []).push([x, y, z, color]);
  for (const hs of RIDE_HOUSES) {
    const [fx, fz] = hs.front.at;
    const alongX = hs.front.face === 'Back' || hs.front.face === 'Front';
    const sz = alongX ? [14, 3.2, 0.3] : [0.3, 3.2, 14];
    sign(sz, [fx, G + 11.2, fz], BLACK, hs.front.face, [[hs.name.split(': ')[1].toUpperCase(), 0, 0, 1, 0.62, hs.glow], [`BENTON HAUNT  ·  INSIDE ${hs.ride.toUpperCase()}`, 0, 0.64, 1, 0.34, ORANGE, 'GothamBold']], { glow: true });
    const [ex, ez] = hs.front.exitAt;
    sign(alongX ? [5, 1.2, 0.3] : [0.3, 1.2, 5], [ex, G + 10, ez], BLACK, hs.front.face, [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
    // the doorway: a glowing frame, fog, a pumpkin either side, a lamp
    const [ox, oz] = hs.outsideIn[hs.outsideIn.length - 1];
    for (const s of [-1, 1]) {
      const px = alongX ? fx + s * 4.2 : fx, pz = alongX ? fz : fz + s * 4.2;
      add([0.4, 9, 0.4], [px, G + 4.5, pz], hs.glow, 'Neon', { collide: 0 });
      add([1.4, 1.2, 1.4], [px + (alongX ? s * 1.3 : (ox > fx ? 1.4 : -1.4)), G + 0.6, pz + (alongX ? (oz > fz ? 1.4 : -1.4) : s * 1.3)], ORANGE, 'SmoothPlastic', { collide: 0, shape: 3 });
    }
    add(alongX ? [8.8, 0.4, 0.4] : [0.4, 0.4, 8.8], [fx, G + 9.2, fz], hs.glow, 'Neon', { collide: 0 });
    data.tags.SteamVent.push([ox, G + 0.4, oz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    light(ox, 5, oz, hs.glow);
    // black barricades with orange rope along the line
    const q = hs.queueFwd;
    for (let k = 0; k < q.length - 1; k++) {
      const [ax, az] = q[k], [bx, bz] = q[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 3) continue;
      const nx = -(bz - az) / len, nz = (bx - ax) / len, yaw = Math.atan2(bx - ax, bz - az);
      for (const s of [-1.5, 1.5]) {
        const n = Math.max(1, Math.round(len / 4));
        for (let j = 0; j <= n; j++) box([0.2, 1.1, 0.2], [ax + ((bx - ax) * j) / n + nx * s, G, az + ((bz - az) * j) / n + nz * s], BLACK, 'Metal', { collide: 0 });
        add([0.1, 0.1, len], [(ax + bx) / 2 + nx * s, G + 1, (az + bz) / 2 + nz * s], ORANGE, 'Fabric', { collide: 0, yaw });
      }
    }
    // the wait board at the entrance, and a greeter in costume
    const [enx, enz] = hs.entrance, [n1x, n1z] = q[1];
    const dl = Math.hypot(n1x - enx, n1z - enz) || 1, dx = (n1x - enx) / dl, dz = (n1z - enz) / dl;
    const bx = enx - dz * 3.2, bz = enz + dx * 3.2;
    box([0.25, 3.6, 0.25], [bx, G, bz], BLACK, 'Metal', { collide: 0 });
    const wp = add([3.2, 1.1, 0.25], [bx, G + 3.9, bz], 0x101624, 'SmoothPlastic', { collide: 0, yaw: Math.atan2(-dx, -dz) });
    data.dynamicSigns.push({ part: wp, kind: 'wait', face: 'Front', ride: hs.id });
    data.staffSpots.push({ role: 'haunt', kind: 'idle', land: hs.land, seed: 400 + hs.id.length, cf: cf(enx + dz * 3.4, G, enz - dx * 3.4, Math.atan2(dx, dz)) });
  }
}
