// The Lower Lot: a whole new level of the park, dug 36 studs down into the
// mountains south of Zero Space and Override. A terrace off Velocity City
// (south of the walk to Zero Space) looks out over it; escalators run down
// from the terrace in two long flights, past a landing halfway, into a pit
// walled in concrete, which opens out into a great basin with rock cliffs
// all round. Three new lands down there:
//   Neon District - a city block that never sleeps: towers lit with neon,
//     holographic billboards, an arcade and a night-market noodle bar.
//   Lost Lagoon - a tropical lagoon under a waterfall pouring off the
//     cliffs: palms, tiki huts, a dock, a wreck, a beach shack.
//   Frostbite Base - a polar research outpost: snowfields and ice, the
//     station huts, a radar dome, a snowcat, the cargo plane that crashed
//     here, penguins, hot cocoa.
import * as THREE from 'three';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';

export const FLOOR = -36; // the Lower Lot's ground
const FL = FLOOR + 0.02;
const G = 0.1;
const TER = { x0: 372, x1: 458, z0: -468, z1: -404 }; // the terrace, upstairs
const ARM = { x0: 380, x1: 446, z0: -742, z1: -470 }; // the pit the escalators come down into
const ND = { x0: 384, x1: 640, z0: -996, z1: -702 }; // Neon District (and the pit)
const LL = { x0: 640, x1: 900, z0: -996, z1: -702 }; // Lost Lagoon
const FB = { x0: 900, x1: 1226, z0: -996, z1: -748 }; // Frostbite Base
const AVE = -770; // the avenue east across the lot
const CUT = 874; // the basin runs further north west of here (under Zero Space) than east (under Override)
const ESC = { top: -469, mid1: -500.18, mid2: -512, bot: -543.18, xd: 408.6, xu: 413.4, w: 2.4, speed: 4.2 };
const LAGOON = { x0: 690, x1: 860, z0: -935, z1: -825 };
const WHITE = 0xf4f4f0, INK = 0x111114, STEEL = 0x9aa0a8, CONC = 0x8a8a86, PINK = 0xff3a9a, CYAN = 0x2ae0f0, VIOLET = 0x9a4aff, AMBER = 0xffb040;
const SAND = 0xe6d6a6, SNOW = 0xf2f6fa, ICE = 0xb8e4f4, ROCK = 0x6a6058, THATCH = 0xb8944a, WOOD = 0x6a4a2a;

// new items for the new venues, each a recolored copy of one the park has
const NEW_ITEMS = [
  { id: 'NeonShades', base: 'StarShades', name: 'Neon Shades', description: 'Glowing pink shades from the Pixel Palace.', price: 95, colors: [PINK, 0x101014] },
  { id: 'NeonBalloon', base: 'GearBalloon', name: 'Neon District Balloon', description: 'A glowing cyan balloon with a pink gear.', price: 85, colors: [CYAN, PINK] },
  { id: 'GlowLantern', base: 'Lantern', name: 'Glow Lantern', description: 'A cyan glow lantern for the lower lot after dark.', price: 90, colors: [0x2a2a3a, CYAN] },
  { id: 'RamenBowl', base: 'Nachos', name: 'Night Market Ramen', description: 'A steaming bowl of ramen with a soft egg. Fills you up.', price: 26, hunger: 55, bites: 4, colors: [0xf0d8a0, 0x8a4a1a], food: true },
  { id: 'BubbleTea', base: 'TurboShake', name: 'Neon Bubble Tea', description: 'Glowing purple tea with tapioca pearls. Speed boost!', price: 14, hunger: 10, bites: 2, colors: [VIOLET, 0x1a1a1a], buff: { kind: 'speed', duration: 50, amount: 6 }, food: true },
  { id: 'Dumplings', base: 'Pretzel', name: 'Lantern Dumplings', description: 'Six pan-fried dumplings with chili oil.', price: 16, hunger: 30, bites: 3, colors: [0xf0e0c0, 0xc8321a], food: true },
  { id: 'CoconutCooler', base: 'Lemonade', name: 'Coconut Cooler', description: 'Ice-cold coconut and lime in the shell. Speed boost!', price: 12, hunger: 10, bites: 2, colors: [0x8a5a2a, 0xf4f4f0], buff: { kind: 'speed', duration: 50, amount: 5 }, food: true },
  { id: 'FishTaco', base: 'StuntTaco', name: 'Lagoon Fish Taco', description: 'Crispy fish, mango salsa and lime.', price: 18, hunger: 35, bites: 3, colors: [0xe8c060, 0x3aa83a], food: true },
  { id: 'PineappleWhip', base: 'TurboShake', name: 'Pineapple Whip', description: 'A swirl of frozen pineapple. Super jump boost!', price: 14, hunger: 15, bites: 2, colors: [0xf8e070, 0xffffff], buff: { kind: 'jump', duration: 45, amount: 16 }, food: true },
  { id: 'PolarCocoa', base: 'Coffee', name: 'Polar Hot Cocoa', description: 'Thick hot cocoa with a marshmallow iceberg. Speed boost!', price: 12, hunger: 12, bites: 2, colors: [0xf4f4f0, 0x5a3420], buff: { kind: 'speed', duration: 60, amount: 5 }, food: true },
  { id: 'IcicleSlush', base: 'NitroSoda', name: 'Icicle Slush', description: 'Blue ice slush, cold enough to make you leap. Jump boost!', price: 12, hunger: 8, bites: 2, colors: [ICE, 0xffffff], buff: { kind: 'jump', duration: 45, amount: 15 }, food: true },
  { id: 'SnowballCookie', base: 'GearDonut', name: 'Snowball Cookie', description: 'A powdered-sugar cookie the size of a snowball.', price: 9, hunger: 18, bites: 2, colors: [0xf8f8f4, 0xd8c8a8], food: true },
  { id: 'SnowGoggles', base: 'StarShades', name: 'Snow Goggles', description: 'Mirrored expedition goggles from Frostbite Base.', price: 95, colors: [0x4ab8ff, 0x1a1a2a] },
  { id: 'ExpeditionCap', base: 'TruckerCap', name: 'Expedition Cap', description: 'Frostbite Base crew cap, white and ice blue.', price: 110, colors: [WHITE, 0x4ab8ff] },
  { id: 'PenguinBalloon', base: 'DuckBalloon', name: 'Penguin Balloon', description: 'A penguin from Frostbite Base, on a string.', price: 85, colors: [0x14141a, 0xffa020] },
];

export function buildLowerLot(data) {
  const W = helpers(data);
  const { add, box, sign, cf } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.trees = data.trees || [];
  data.terrain = data.terrain || [];
  data.escalators = data.escalators || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const lamp = (x, y, z, color = 0xffe8c0, h = 7) => {
    box([0.3, h, 0.3], [x, y, z], 0x2a2a2e, 'Metal', { shape: 5 });
    add([0.9, 0.9, 0.9], [x, y + h + 0.3, z], color, 'Neon', { collide: 0, shape: 3 });
    data.tags.ParkLamp.push([x, y + h + 0.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };
  const line = (pts, y, opt) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const ya = Array.isArray(y) ? y[k] : y, yb = Array.isArray(y) ? y[k + 1] : y;
      LINES.push(opt ? [new THREE.Vector3(a[0], ya, a[1]), new THREE.Vector3(b[0], yb, b[1]), opt] : [new THREE.Vector3(a[0], ya, a[1]), new THREE.Vector3(b[0], yb, b[1])]);
    }
  };
  const path = (pts, w, y, color, mat = 'Pavement') => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([w, 0.2, len + w], [(a[0] + b[0]) / 2, y + 0.1, (a[1] + b[1]) / 2], color, mat, { yaw, collide: 0 });
    }
  };

  // ======== the ground: dig the basin, level the terrace and the pit's rim
  data.flatZones = [...(data.flatZones || []), { x0: 360, x1: 470, z0: -742, z1: -400, margin: 14 }];
  data.basins = [
    // the pit (walled in concrete: the floor runs on under the thick walls, so
    // the ground's edge is hidden inside them)
    { x0: ARM.x0 - 8, x1: ARM.x1 + 8, z0: ARM.z0, z1: ARM.z1, floor: FLOOR, margin: 3 },
    // (under Zero Space as far as x 874, so the cliffs keep clear of Override's site)
    { x0: ND.x0, x1: CUT, z0: ND.z0, z1: ND.z1, floor: FLOOR, margin: 26, rock: true },
    { x0: CUT, x1: FB.x1, z0: FB.z0, z1: FB.z1, floor: FLOOR, margin: 26, rock: true },
  ];
  data.trees = data.trees.filter((t) => !(t.pos[0] > 340 && t.pos[0] < 1250 && t.pos[2] < -400 && t.pos[2] > -1030 && !(t.pos[0] > 470 && t.pos[2] > -676)));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [TER.x0, TER.z0, TER.x1, TER.z1 + 6]];
  data.config.Lands.push(
    { id: 'NeonDistrict', name: 'Neon District', center: [512, FLOOR, -850], color: PINK, tagline: 'The Lower Lot never sleeps.', regions: [[ARM.x0, ARM.z0, ARM.x1, ARM.z1], [ND.x0, ND.z0, ND.x1, ND.z1]] },
    { id: 'LostLagoon', name: 'Lost Lagoon', center: [770, FLOOR, -850], color: 0x2ad8a8, tagline: 'Paradise at the bottom of the cliffs.', regions: [[LL.x0, LL.z0, LL.x1, LL.z1]] },
    { id: 'FrostbiteBase', name: 'Frostbite Base', center: [1063, FLOOR, -872], color: 0x8ad0ff, tagline: 'Expedition outpost: keep moving to stay warm.', regions: [[FB.x0, FB.z0, FB.x1, FB.z1]] },
  );

  // ======== upstairs: the walk from Zero Space's gate, the terrace
  path([[603, -394], [411, -394], [411, -404]], 6, G, 0x6a6a6c);
  line([[603, -394], [411, -394], [411, -460]], 0);
  add([TER.x1 - TER.x0, 0.24, TER.z1 - TER.z0], [(TER.x0 + TER.x1) / 2, G + 0.12, (TER.z0 + TER.z1) / 2], 0x7a7a7e, 'Pavement', { collide: 0 });
  for (let x = TER.x0 + 4; x < TER.x1; x += 8) add([0.3, 0.26, TER.z1 - TER.z0], [x, G + 0.13, (TER.z0 + TER.z1) / 2], 0x5a5a5e, 'Pavement', { collide: 0 });
  // the railing along the edge, glass between steel posts, open at the escalators
  const rail = (xa, xb, z, y, h = 1.3) => {
    if (xb - xa < 0.2) return;
    const n = Math.max(1, Math.round((xb - xa) / 3));
    for (let k = 0; k <= n; k++) box([0.2, h, 0.2], [xa + ((xb - xa) * k) / n, y, z], STEEL, 'Metal');
    add([xb - xa, h - 0.2, 0.08], [(xa + xb) / 2, y + (h - 0.2) / 2 + 0.05, z], 0xb8d8e8, 'Glass', { trans: 0.6 });
    add([xb - xa, 0.12, 0.2], [(xa + xb) / 2, y + h, z], STEEL, 'Metal', { collide: 0 });
  };
  const gap0 = ESC.xd - ESC.w / 2 - 0.6, gap1 = ESC.xu + ESC.w / 2 + 0.6;
  rail(TER.x0, gap0, TER.z0, G);
  rail(gap1, TER.x1, TER.z0, G);
  for (const x of [TER.x0, TER.x1]) {
    const n = 8;
    for (let k = 0; k <= n; k++) box([0.2, 1.3, 0.2], [x, G, TER.z0 + ((TER.z1 - 8 - TER.z0) * k) / n], STEEL, 'Metal');
  }
  // the gateway over the escalators: LOWER LOT, the three lands
  const gx = (ESC.xd + ESC.xu) / 2;
  for (const x of [gx - 9, gx + 9]) {
    box([1.6, 15, 1.6], [x, G, TER.z0 + 1.2], INK, 'Metal');
    neon([0.3, 14, 0.3], [x + (x < gx ? 0.9 : -0.9), G + 7.6, TER.z0 + 1.2], CYAN);
  }
  add([20, 3.6, 1.4], [gx, G + 13.4, TER.z0 + 1.2], INK, 'Metal', { collide: 0 });
  sign([19, 2.4, 0.2], [gx, G + 13.8, TER.z0 + 2], INK, 'Back', [['THE LOWER LOT', 0, 0, 1, 1, WHITE]], { glow: true });
  sign([19, 1.1, 0.2], [gx, G + 12, TER.z0 + 2], INK, 'Back', [['NEON DISTRICT  ·  LOST LAGOON  ·  FROSTBITE BASE', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });
  sign([19, 2.4, 0.2], [gx, G + 13.8, TER.z0 + 0.4], INK, 'Front', [['THE LOWER LOT', 0, 0, 1, 1, WHITE]], { glow: true });
  for (const [x, c] of [[gx - 6, PINK], [gx, 0x2ad8a8], [gx + 6, 0x8ad0ff]]) neon([1.2, 1.2, 0.3], [x, G + 15.8, TER.z0 + 1.2], c, { shape: 3 });
  // benches, coin binoculars at the rail, lamps, a sign from the walk
  for (const x of [380, 392, 432, 448]) {
    box([0.5, 1.2, 0.5], [x, G, TER.z0 + 1.6], STEEL, 'Metal', { shape: 5, collide: 0 });
    add([0.7, 0.6, 1.2], [x, G + 1.5, TER.z0 + 1.5], 0x3a6ad8, 'Metal', { collide: 0, rot: RX(-0.3) });
  }
  for (const [x, z] of [[384, -430], [448, -430], [384, -414], [448, -414]]) box([4, 0.5, 1.2], [x, G + 0.6, z], 0x5a3a24, 'WoodPlanks', { collide: 0 });
  for (const [x, z] of [[376, -440], [454, -440], [376, -410], [454, -410]]) lamp(x, G, z, 0xe8f8ff);
  box([0.3, 5, 0.3], [600, G, -398], INK, 'Metal', { collide: 0 });
  sign([5.4, 1.3, 0.2], [600, G + 4.5, -398.2], INK, 'Front', [['<  THE LOWER LOT', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });
  sign([5.4, 1.3, 0.2], [600, G + 4.5, -397.8], INK, 'Back', [['THE LOWER LOT  >', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });

  // ======== the pit: concrete walls, the landing deck, the escalators
  const PW = 37; // the pit walls, floor to rim
  const wall = (x0, x1, z0, z1) => box([x1 - x0, PW, z1 - z0], [(x0 + x1) / 2, FLOOR - 0.4, (z0 + z1) / 2], CONC, 'Concrete');
  wall(ARM.x0 - 9, ARM.x0 - 0.5, ARM.z0, ARM.z1 + 8);
  wall(ARM.x1 + 0.5, ARM.x1 + 9, -704, ARM.z1 + 8);
  // (the north wall, under the terrace's edge, is flush with the terrace)
  box([ARM.x1 - ARM.x0 + 18, 0.34 - (FLOOR - 0.4), 8], [(ARM.x0 + ARM.x1) / 2, FLOOR - 0.4, ARM.z1 + 4], CONC, 'Concrete');
  // a concrete rim along the top of the side walls
  add([ARM.x0 - 0.5 - 362, 0.3, ARM.z1 - 2 - ARM.z0], [(362 + ARM.x0 - 0.5) / 2, 0.42, (ARM.z0 + ARM.z1 - 2) / 2], 0x9a9a96, 'Concrete', { collide: 0 });
  add([464 - ARM.x1 - 0.5, 0.3, ARM.z1 - 2 + 704], [(464 + ARM.x1 + 0.5) / 2, 0.42, (-704 + ARM.z1 - 2) / 2], 0x9a9a96, 'Concrete', { collide: 0 });
  // ribs down the walls, and neon down the ribs
  for (let z = ARM.z1 - 12; z > -700; z -= 16) for (const [x, sd] of [[ARM.x0 - 0.2, 1], [ARM.x1 + 0.2, -1]]) {
    add([0.8, PW - 1, 1.4], [x + sd * 0.4, FLOOR + PW / 2 - 0.9, z], 0x7a7a76, 'Concrete', { collide: 0 });
    neon([0.2, PW - 6, 0.3], [x + sd * 0.85, FLOOR + PW / 2, z], [PINK, CYAN, VIOLET][Math.floor(-z / 16) % 3]);
  }
  sign([0.3, 9, 40], [ARM.x0 + 0.6, FLOOR + 22, -620], INK, 'Right', [['WELCOME TO', 0, 0, 1, 0.3, CYAN, 'GothamBold'], ['THE LOWER LOT', 0, 0.3, 1, 0.45, WHITE], ['36 STUDS DOWN  ·  3 NEW LANDS', 0, 0.76, 1, 0.22, PINK, 'GothamBold']], { glow: true });
  sign([0.3, 6, 30], [ARM.x1 - 0.6, FLOOR + 14, -640], INK, 'Left', [['NEON DISTRICT  ·  LOST LAGOON  ·  FROSTBITE BASE', 0, 0, 1, 0.5, CYAN, 'GothamBold'], ['THIS WAY  v', 0, 0.55, 1, 0.42, WHITE, 'GothamBold']], { glow: true });
  // the landing halfway down: a deck across the pit on columns
  const DY = -18;
  box([ARM.x1 - ARM.x0, 1.2, ESC.mid2 - ESC.mid1 > 0 ? 0 : ESC.mid1 - ESC.mid2], [(ARM.x0 + ARM.x1) / 2, DY - 1.2, (ESC.mid1 + ESC.mid2) / 2], 0x6a6a6e, 'Concrete');
  for (const x of [386, 398, 428, 440]) box([1, DY - 1.2 - FLOOR, 1], [x, FLOOR, (ESC.mid1 + ESC.mid2) / 2], 0x6a6a6e, 'Concrete', { shape: 5 });
  rail(ARM.x0, gap0, ESC.mid1 + 0.2, DY);
  rail(gap1, ARM.x1, ESC.mid1 + 0.2, DY);
  rail(ARM.x0, gap0, ESC.mid2 - 0.2, DY);
  rail(gap1, ARM.x1, ESC.mid2 - 0.2, DY);
  sign([12, 1.4, 0.2], [(ARM.x0 + gap0) / 2, DY + 3.2, ESC.mid2 + 0.2], INK, 'Front', [['HALFWAY DOWN  ·  KEEP RIGHT', 0, 0, 1, 1, CYAN, 'GothamBold']], { glow: true });
  for (const x of [ARM.x0 + 3, ARM.x1 - 3]) lamp(x, DY, (ESC.mid1 + ESC.mid2) / 2, 0xe8f8ff, 4);
  // the escalators: two lanes in each flight (down on the left as you look
  // down, up on the right), steps, glass balustrades, black handrails, LED
  // skirts, newel ends, support columns
  const flight = (za, zb, ya, yb) => {
    const run = za - zb, drop = ya - yb, len = Math.hypot(run, drop), th = Math.atan2(drop, run);
    const c = Math.cos(th), s = Math.sin(th);
    const R = [1, 0, 0, 0, c, s, 0, -s, c]; // local z along the slope, local y square to it
    const at = (u, up) => [0, ya + (yb - ya) * u + c * up, za + (zb - za) * u - s * up]; // [_, y, z] at u along, `up` off the slope
    for (const [x, dir] of [[ESC.xd, 'down'], [ESC.xu, 'up']]) {
      data.escalators.push({ x, za, zb, ya, yb, dir, w: ESC.w, speed: ESC.speed });
      // the truss, under the steps
      const [, ty, tz] = at(0.5, -1);
      add([3.4, 1.6, len + 1], [x, ty, tz], 0x3a3a3e, 'Metal', { collide: 0, rot: R });
      // steps: a block every 0.42 down the slope
      const n = Math.floor(run / 0.42);
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const y = ya + (yb - ya) * u, z = za + (zb - za) * u;
        add([ESC.w, 0.22, 0.4], [x, y - 0.11, z], k % 2 ? 0x5a5e66 : 0x6a6e76, 'DiamondPlate', { collide: 0 });
      }
      for (const sd of [-1, 1]) {
        const [, gy, gz] = at(0.5, 0.75);
        add([0.07, 1.1, len], [x + sd * 1.5, gy, gz], 0xc8e4f0, 'Glass', { collide: 0, rot: R, trans: 0.55 });
        const [, hy, hz] = at(0.5, 1.35);
        add([0.16, 0.14, len + 0.6], [x + sd * 1.5, hy, hz], INK, 'Rubber', { collide: 0, rot: R });
        const [, ky, kz] = at(0.5, 0.12);
        add([0.05, 0.06, len], [x + sd * 1.28, ky, kz], dir === 'down' ? CYAN : AMBER, 'Neon', { collide: 0, rot: R });
        add([0.12, 0.3, len], [x + sd * 1.4, ky, kz], STEEL, 'Metal', { collide: 0, rot: R });
      }
      // the ends: comb plates, newels, a sign over the way on
      for (const [z, y, out] of [[za, ya, 1], [zb, yb, -1]]) {
        add([ESC.w + 0.2, 0.06, 1.2], [x, y + 0.03, z + out * 0.6], STEEL, 'DiamondPlate', { collide: 0 });
        for (const sd of [-1, 1]) add([0.3, 1.4, 1.6], [x + sd * 1.5, y + 0.7, z + out * 0.8], INK, 'Metal', { collide: 0 });
      }
      const onZ = dir === 'down' ? za : zb, onY = dir === 'down' ? ya : yb, out = dir === 'down' ? 1 : -1;
      sign([2.4, 0.7, 0.12], [x, onY + 3.4, onZ + out * 1.2], INK, out > 0 ? 'Back' : 'Front', [[dir === 'down' ? 'v  DOWN' : '^  UP', 0, 0, 1, 1, dir === 'down' ? CYAN : AMBER, 'GothamBold']], { glow: true });
    }
    // columns under the flight, down to the pit floor
    for (const u of [0.35, 0.75]) {
      const y = ya + (yb - ya) * u - 1.8, z = za + (zb - za) * u;
      if (y - FLOOR > 2) box([1, y - FLOOR, 1], [gx, FLOOR, z], 0x5a5a5e, 'Metal', { shape: 5, collide: 0 });
    }
  };
  flight(ESC.top, ESC.mid1, 0, DY);
  flight(ESC.mid2, ESC.bot, DY, FLOOR);
  // the guests' line down (and up) the escalators
  for (const x of [ESC.xd, ESC.xu]) line([[x, -460], [x, ESC.top], [x, ESC.mid1], [x, ESC.mid2], [x, ESC.bot], [x, ESC.bot - 6]], [0, 0, DY, DY, FLOOR, FLOOR], { narrow: 0.5 });

  // ======== the floor: paving down the pit, the avenue, the rock walls
  const ground = (x0, x1, z0, z1, color, mat) => add([x1 - x0, 1, z1 - z0], [(x0 + x1) / 2, FL - 0.5, (z0 + z1) / 2], color, mat);
  ground(ARM.x0, ARM.x1, -704, ARM.z1, 0x2a2a30, 'Asphalt');
  ground(ND.x0, ND.x1, ND.z0, -704, 0x26262c, 'Asphalt');
  ground(ARM.x0, ND.x0, -742, -704, 0x26262c, 'Asphalt');
  // (Lost Lagoon: sand round the lagoon, not under it)
  ground(LL.x0, LL.x1, LL.z0, LAGOON.z0, SAND, 'Concrete');
  ground(LL.x0, LL.x1, LAGOON.z1, LL.z1, SAND, 'Concrete');
  ground(LL.x0, LAGOON.x0, LAGOON.z0, LAGOON.z1, SAND, 'Concrete');
  ground(LAGOON.x1, LL.x1, LAGOON.z0, LAGOON.z1, SAND, 'Concrete');
  ground(FB.x0, FB.x1, FB.z0, FB.z1, SNOW, 'SmoothPlastic');
  // the walls of rock at the foot of the cliffs all the way round
  const rockWall = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 14));
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, h = 9 + ((k * 7) % 5);
      const cx = xa + (xb - xa) * (u0 + u1) / 2, cz = za + (zb - za) * (u0 + u1) / 2;
      add([4, h, len / n + 1.4], [cx, FLOOR + h / 2 - 1, cz], [ROCK, 0x7a6e62, 0x5a524a][k % 3], 'Slate', { yaw: Math.atan2(xb - xa, zb - za) + ((k % 3) - 1) * 0.04 });
      add([5, 3, 4], [cx, FLOOR + h - 1.2, cz + ((k % 2) * 2 - 1) * 2], 0x6a6258, 'Slate', { collide: 0, shape: 3, rot: RY(k) });
    }
  };
  rockWall(ARM.x0 - 1.5, -742, ND.x0 + 1, -742);
  rockWall(ND.x0 + 1, -742, ND.x0 + 1, ND.z0 + 1);
  rockWall(ND.x0 + 1, ND.z0 + 1, FB.x1 - 1, FB.z0 + 1);
  rockWall(FB.x1 - 1, FB.z0 + 1, FB.x1 - 1, FB.z1 - 1);
  rockWall(FB.x1 - 1, FB.z1 - 1, CUT + 1, FB.z1 - 1);
  rockWall(CUT + 1, FB.z1 - 1, CUT + 1, -704);
  rockWall(CUT + 1, -704, ARM.x1 + 2, -704);
  // the paths: down the pit, the avenue east across all three lands, and
  // the streets off it
  path([[gx, ESC.bot - 1], [gx, AVE]], 10, FL, 0x3a3a42);
  path([[392, AVE], [1214, AVE]], 10, FL, 0x3a3a42);
  line([[gx, ESC.bot - 6], [gx, AVE]], FLOOR);
  line([[392, AVE], [520, AVE], [680, AVE], [880, AVE], [1060, AVE], [1212, AVE]], FLOOR);
  for (let x = 400; x < 1214; x += 34) {
    if (x > LL.x0 - 6 && x < LL.x1 + 6) continue;
    lamp(x, FL, AVE - 6.4, x < LL.x0 ? 0xff9ad8 : 0xd8f0ff);
  }

  // ======== Neon District
  {
    // towers along the avenue, windows lit in neon, names on the roofs
    const tower = (x0, x1, z0, z1, h, color, name, glow, face) => {
      box([x1 - x0, h, z1 - z0], [(x0 + x1) / 2, FL, (z0 + z1) / 2], color, 'Concrete');
      const fz = face === 'Back' ? z1 + 0.1 : z0 - 0.1;
      for (let y = 4; y < h - 2; y += 4) for (let x = x0 + 2.5; x < x1 - 2; x += 3.2) {
        const k = Math.floor(x * 7 + y * 13) % 7;
        if (k > 3) continue;
        neon([1.8, 1.4, 0.1], [x, FL + y, fz], [0xffe8b0, 0x8ae8ff, 0xffb0e0, 0xb0b0ff][k]);
      }
      neon([x1 - x0, 0.3, 0.3], [(x0 + x1) / 2, FL + h, face === 'Back' ? z1 : z0], glow);
      sign([Math.min(x1 - x0 - 2, 26), 3, 0.3], [(x0 + x1) / 2, FL + h + 2, face === 'Back' ? z1 - 1 : z0 + 1], INK, face, [[name, 0, 0, 1, 1, glow]], { glow: true });
      // a blade sign down the corner
      sign([0.3, Math.min(14, h - 6), 2.4], [x1 + 0.4, FL + Math.min(14, h - 6) / 2 + 4, face === 'Back' ? z1 - 2 : z0 + 2], INK, 'Right', [[name.split(' ')[0], 0, 0, 1, 1, glow]], { glow: true });
    };
    // north of the avenue
    tower(452, 500, -756, -712, 30, 0x2a2a36, 'HOTEL NOVA', CYAN, 'Front');
    tower(506, 560, -756, -716, 18, 0x302838, 'KARAOKE ZONE', PINK, 'Front');
    tower(566, 634, -756, -720, 14, 0x28303a, 'NIGHT MARKET', AMBER, 'Front');
    // south of the avenue
    tower(392, 440, -830, -784, 16, 0x26262e, '24H NOODLES', 0xff6a3a, 'Back');
    tower(540, 590, -836, -784, 24, 0x2c2a38, 'CYBER CAFE', VIOLET, 'Back');
    tower(596, 636, -826, -784, 12, 0x2a3030, 'SYNTH RECORDS', CYAN, 'Back');
    tower(398, 470, -990, -880, 44, 0x22222c, 'THE GRID TOWER', PINK, 'Back');
    // the Pixel Palace (an arcade shop) and Night Market Noodles (food)
    const venue = (id, name, kind, land, x, z, w, d, h, facing, color, glow, items, description) => {
      box([w, h, d], [x, FL, z], color, 'Concrete');
      const fz = facing === 'S' ? z + d / 2 : z - d / 2;
      const out = facing === 'S' ? 1 : -1;
      add([w - 6, h - 4, 0.4], [x, FL + (h - 4) / 2 + 0.2, fz + out * 0.1], 0x0a0a0e, 'SmoothPlastic', { collide: 0 });
      box([w - 8, 1.2, 2], [x, FL, fz - out * 1.2], color, 'WoodPlanks');
      add([w + 2, 0.4, 4], [x, FL + h - 3, fz + out * 2], glow, 'Neon', { collide: 0 });
      sign([w - 4, 2.6, 0.3], [x, FL + h - 0.6, fz + out * 0.3], INK, facing === 'S' ? 'Back' : 'Front', [[name.toUpperCase(), 0, 0, 1, 1, glow]], { glow: true });
      data.config.Venues.push({ id, name, kind, land, facing, description, items, color: glow, position: [x, FLOOR, z], size: [w, h, d] });
      if (kind === 'restaurant') data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: id, land, seed: id.length, cf: cf(x, FL, fz - out * 3.4, out > 0 ? Math.PI : 0) });
    };
    venue('PixelPalace', 'Pixel Palace', 'shop', 'NeonDistrict', 474, -806, 50, 40, 16, 'S', 0x241e34, PINK, ['NeonShades', 'NeonBalloon', 'GlowLantern', 'ExpressPass'], 'An arcade full of glowing souvenirs: neon shades, glow lanterns and balloons.');
    venue('NightMarketNoodles', 'Night Market Noodles', 'restaurant', 'NeonDistrict', 600, -880, 40, 30, 12, 'N', 0x2a2428, AMBER, ['RamenBowl', 'BubbleTea', 'Dumplings'], 'Steaming ramen, bubble tea and dumplings under the lanterns.');
    // Neon Square: a giant neon ring, holo billboards, food carts, puddles
    const SQ = [560, -935];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      neon([0.8, 0.8, 2.8], [SQ[0] + Math.cos(a) * 9, FL + 12 + Math.sin(a) * 9, SQ[1]], k % 2 ? PINK : CYAN, { rot: RZ(a) });
    }
    for (const x of [SQ[0] - 9.5, SQ[0] + 9.5]) box([1, 12, 1], [x, FL, SQ[1]], INK, 'Metal');
    for (const [x, z, t, c] of [[500, -985, 'BENTON DIESEL ZERO  ·  0% DIESEL  100% SPEED', CYAN], [632, -935, 'TONIGHT ONLY  ·  ALWAYS', PINK]]) {
      const yawFace = x > 600 ? 'Left' : 'Back';
      const sz = x > 600 ? [0.3, 9, 30] : [30, 9, 0.3];
      box(x > 600 ? [0.8, 4, 0.8] : [0.8, 4, 0.8], [x, FL, z], INK, 'Metal');
      sign(sz, [x + (x > 600 ? -0.5 : 0), FL + 10, z + (x > 600 ? 0 : 0.5)], 0x0a0a14, yawFace, [[t, 0, 0, 1, 1, c]], { glow: true });
    }
    for (const [x, z, c] of [[530, -905, PINK], [590, -905, CYAN], [545, -960, VIOLET]]) {
      box([6, 3, 3], [x, FL, z], 0x2a2a30, 'Metal');
      add([7, 0.4, 4], [x, FL + 4.2, z], c, 'Neon', { collide: 0 });
      box([0.2, 1.2, 0.2], [x - 3, FL + 3, z + 1.4], STEEL, 'Metal', { collide: 0 });
    }
    for (const [x, z] of [[515, -790], [455, -775], [620, -800], [560, -890], [505, -930]]) add([4 + (x % 3), 0.03, 3], [x, FL + 0.05, z], 0x0a0a1a, 'Glass', { collide: 0, rot: RY(x) });
    // a yellow cab, vending machines, steam from the grates
    box([4.4, 1.6, 2.2], [520, FL + 0.6, AVE + 3.4], 0xf2c418, 'Metal', { collide: 0 });
    box([2.6, 1, 2], [520, FL + 2.2, AVE + 3.4], 0xf2c418, 'Metal', { collide: 0 });
    for (const x of [442, 446, 450]) { box([1.6, 3.2, 1], [x, FL, -782], [PINK, CYAN, 0xf2c418][(x - 442) / 4], 'SmoothPlastic'); neon([1.2, 1.6, 0.1], [x, FL + 1.9, -781.45], WHITE); }
    for (const [x, z] of [[470, AVE + 6], [560, AVE - 7], [530, -850], [580, -960]]) data.tags.SteamVent.push([x, FL + 0.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    path([[520, AVE], [520, -990]], 8, FL, 0x34343c);
    line([[520, AVE], [520, -935], [542, -935], [520, -935], [520, -985]], FLOOR);
    for (const [x, z, c] of [[470, -780, PINK], [560, -800, CYAN], [520, -900, VIOLET], [560, -950, PINK], [430, -870, CYAN]]) data.hauntLights.push([x, FL + 6, z, c]);
    for (let z = -790; z > -990; z -= 30) lamp(526, FL, z, 0xff9ad8);
  }

  // ======== Lost Lagoon
  {
    const L = LAGOON, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, level = FLOOR + 0.55;
    data.terrain.push({ kind: 'block', material: 'Water', cf: [cx, level - 0.5 + 0.7, cz, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [L.x1 - L.x0, 1, L.z1 - L.z0] });
    // the waterfall off the cliffs into a pool at the south end
    const WF = [770, -986];
    data.terrain.push({ kind: 'block', material: 'Water', cf: [WF[0], level - 0.5 + 0.7, WF[1], 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [34, 1, 16] });
    for (const [dx, w, a] of [[0, 12, 0.12], [-7, 4, 0.06], [6, 5, 0.18]]) add([w, 46, 0.5], [WF[0] + dx, FLOOR + 21, WF[1] - 6], 0x9ad8f0, 'Glass', { collide: 0, trans: 0.35, rot: RX(a) });
    for (const dx of [-8, 0, 8]) data.tags.SteamVent.push([WF[0] + dx, FL + 0.6, WF[1] - 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const [dx, dz, s] of [[-14, 4, 5], [13, 5, 4], [-18, -2, 6], [17, -3, 5]]) add([s * 1.4, s, s * 1.2], [WF[0] + dx, FL + s / 2 - 0.6, WF[1] + dz], ROCK, 'Slate', { shape: 3, rot: RY(dx) });
    // palms round the shore and along the paths
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2, rx = (L.x1 - L.x0) / 2 + 12, rz = (L.z1 - L.z0) / 2 + 12;
      const x = cx + Math.cos(a) * rx + ((k * 13) % 7) - 3, z = cz + Math.sin(a) * rz + ((k * 7) % 5) - 2;
      if (Math.abs(z - AVE) < 10 || Math.abs(x - 680) < 5 || Math.abs(x - 880) < 5 || (x > 690 && x < 734 && z > -815)) continue;
      data.trees.push({ leaf: 0x3a8a3a, kind: 'palm', s: 0.9 + (k % 4) * 0.12, pos: [x, FLOOR, z] });
    }
    // tiki huts on the shore
    const hut = (x, z, w = 8) => {
      for (const [dx, dz] of [[-w / 2 + 0.4, -w / 2 + 0.4], [w / 2 - 0.4, -w / 2 + 0.4], [-w / 2 + 0.4, w / 2 - 0.4], [w / 2 - 0.4, w / 2 - 0.4]]) box([0.5, 5, 0.5], [x + dx, FL, z + dz], WOOD, 'Wood');
      add([w + 2, 0.4, w + 2], [x, FL + 5.2, z], THATCH, 'Fabric', { collide: 0 });
      for (let k = 0; k < 3; k++) add([w + 1.6 - k * 2.8, 1.2, w + 1.6 - k * 2.8], [x, FL + 5.9 + k * 1.1, z], THATCH, 'Fabric', { collide: 0 });
      box([w - 2, 1.1, 1], [x, FL, z + w / 2 - 1], 0x8a6a3a, 'WoodPlanks', { collide: 0 });
      data.tags.Campfire.push([x + w / 2 + 1.5, FL + 3.4, z + w / 2 + 1.5, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      box([0.3, 3, 0.3], [x + w / 2 + 1.5, FL, z + w / 2 + 1.5], WOOD, 'Wood', { collide: 0 });
    };
    hut(664, -860); hut(664, -905); hut(888, -880, 7);
    // the dock out into the lagoon, a boat at the end of it
    box([4, 0.4, 28], [750, FL + 0.3, L.z1 - 12], 0x8a6a42, 'WoodPlanks');
    for (let z = L.z1 - 2; z > L.z1 - 26; z -= 5) for (const dx of [-2, 2]) box([0.4, 2.4, 0.4], [750 + dx, FL - 1, z], WOOD, 'Wood', { collide: 0 });
    box([3, 1.2, 8], [755, FL + 0.2, L.z1 - 22], 0xf4f4f0, 'WoodPlanks', { collide: 0 });
    add([3.1, 0.3, 8.1], [755, FL + 1.1, L.z1 - 22], 0x2ad8a8, 'SmoothPlastic', { collide: 0 });
    // the wreck: a ship's hull on its side in the shallows
    add([6, 4, 22], [820, FL + 1.2, -905], 0x5a3a20, 'WoodPlanks', { collide: 0, rot: RZ(0.9) });
    add([0.6, 12, 0.6], [823, FL + 5, -900], 0x4a3018, 'Wood', { collide: 0, rot: RZ(0.9) });
    add([0.2, 6, 5], [826, FL + 7, -900], 0xd8c8a8, 'Fabric', { collide: 0, rot: RZ(0.9) });
    // Lagoon Shack: the beach food stand
    const sx = 712, sz = -800;
    box([30, 6, 18], [sx, FL, sz], 0x8a6a42, 'WoodPlanks');
    for (let k = 0; k < 3; k++) add([34 - k * 6, 1.4, 22 - k * 5], [sx, FL + 7 + k * 1.2, sz], THATCH, 'Fabric', { collide: 0 });
    box([26, 1.2, 2], [sx, FL, sz + 10], 0xb88a4a, 'WoodPlanks');
    sign([20, 2.4, 0.3], [sx, FL + 4.8, sz + 9.2], 0x1a3a3a, 'Back', [['LAGOON SHACK', 0, 0, 1, 1, 0x7af0c8]], { glow: true });
    data.config.Venues.push({ id: 'LagoonShack', name: 'Lagoon Shack', kind: 'restaurant', land: 'LostLagoon', facing: 'S', description: 'Fish tacos, coconut coolers and pineapple whip by the water.', items: ['FishTaco', 'CoconutCooler', 'PineappleWhip'], color: 0x2ad8a8, position: [sx, FLOOR, sz], size: [30, 6, 18] });
    data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: 'LagoonShack', land: 'LostLagoon', seed: 9, cf: cf(sx, FL, sz + 5.6, Math.PI) });
    for (const [x, z] of [[700, -785], [726, -785]]) { box([4, 0.3, 2.4], [x, FL + 2.4, z], WOOD, 'Wood'); box([0.2, 5, 0.2], [x, FL + 2.7, z], WHITE, 'Metal', { collide: 0 }); add([5, 0.3, 5], [x, FL + 7.8, z], [0xff6a3a, 0x2ad8a8][x % 2], 'Fabric', { collide: 0, shape: 5 }); }
    // the boardwalk round the lagoon
    path([[680, AVE], [680, -955], [880, -955], [880, AVE]], 6, FL, 0x9a7a4a, 'WoodPlanks');
    line([[680, AVE], [680, -955], [770, -955], [770, -970], [770, -955], [880, -955], [880, AVE]], FLOOR);
    for (const [x, z] of [[680, -800], [680, -860], [680, -920], [730, -955], [810, -955], [880, -920], [880, -860], [880, -800]]) {
      box([0.3, 3, 0.3], [x + 3.6, FL, z], WOOD, 'Wood', { collide: 0 });
      data.tags.Campfire.push([x + 3.6, FL + 3.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    sign([18, 3, 0.3], [770, FL + 9, AVE - 5.6], 0x1a3a3a, 'Back', [['LOST LAGOON', 0, 0, 1, 0.7, 0x7af0c8], ['PARADISE AT THE BOTTOM OF THE CLIFFS', 0, 0.7, 1, 0.3, SAND, 'GothamBold']], { glow: true });
    for (const x of [760, 780]) box([0.8, 9, 0.8], [x, FL, AVE - 5.6], WOOD, 'Wood');
    data.hauntLights.push([770, FL + 8, -880, 0x40e0c0], [770, FL + 6, -975, 0x9ad8f0]);
  }

  // ======== Frostbite Base
  {
    // snowbanks and ice along the edges, ice spikes, a frozen pond
    for (let k = 0; k < 30; k++) {
      const edge = k % 4, u = ((k * 37) % 100) / 100;
      const x = edge === 0 ? FB.x0 + 14 + u * (FB.x1 - FB.x0 - 28) : edge === 1 ? FB.x1 - 8 : edge === 2 ? FB.x0 + 14 + u * (FB.x1 - FB.x0 - 28) : FB.x0 + 8;
      const z = edge === 0 ? FB.z0 + 8 : edge === 2 ? -756 : FB.z0 + 14 + u * (FB.z1 - FB.z0 - 28);
      if (Math.abs(z - AVE) < 9) continue;
      add([10 + (k % 4) * 3, 4 + (k % 3), 8 + (k % 5) * 2], [x, FL + 0.6, z], SNOW, 'SmoothPlastic', { shape: 3, rot: RY(k) });
    }
    for (const [x, z] of [[960, -960], [1180, -950], [1200, -800], [940, -830], [1150, -985]]) {
      for (let k = 0; k < 4; k++) add([1.6, 6 + k * 2, 1.6], [x + (k % 2) * 2.4 - 1.2, FL + 3 + k, z + Math.floor(k / 2) * 2 - 1], ICE, 'Glass', { shape: 1, trans: 0.25, rot: RZ((k - 1.5) * 0.15) });
    }
    add([46, 0.12, 30], [1130, FL + 0.08, -920], 0xa8d8f0, 'Glass', { collide: 0 });
    // the research station: huts with round roofs, walkways, an antenna
    const hut = (x, z, w, d, color, label) => {
      box([w, 5, d], [x, FL, z], color, 'Metal');
      add([w + 0.4, d, d], [x, FL + 5, z], WHITE, 'Metal', { collide: 0, shape: 2 });
      sign([w - 2, 1.4, 0.2], [x, FL + 3.6, z + d / 2 + 0.12], WHITE, 'Back', [[label, 0, 0, 1, 1, 0x1a2a3a, 'GothamBold']]);
      neon([1.4, 1.4, 0.1], [x - w / 2 + 2, FL + 2.6, z + d / 2 + 0.1], 0xfff0c0);
    };
    hut(1000, -820, 18, 10, 0xe86a1a, 'STATION 7  ·  LAB');
    hut(1028, -820, 14, 10, 0xe86a1a, 'BUNKHOUSE');
    hut(1000, -846, 16, 10, 0xd84a1a, 'GARAGE');
    box([0.5, 28, 0.5], [1046, FL, -834], 0x8a8e96, 'Metal');
    for (const y of [10, 18, 26]) neon([0.6, 0.6, 0.6], [1046, FL + y, -834], 0xff2020, { shape: 3 });
    // the radar dome on its tower
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box([0.6, 16, 0.6], [1120 + dx, FL, -830 + dz], 0x8a8e96, 'Metal');
    add([12, 12, 12], [1120, FL + 21, -830], WHITE, 'SmoothPlastic', { shape: 3 });
    // a snowcat, parked
    box([8, 3, 4.4], [1082, FL + 1.4, -862], 0xe86a1a, 'Metal', { collide: 0 });
    box([4, 2.4, 4], [1084, FL + 4.4, -862], 0xe86a1a, 'Metal', { collide: 0 });
    for (const dz of [-2.6, 2.6]) add([9, 1.6, 1.4], [1082, FL + 0.8, -862 + dz], 0x1a1a1a, 'Rubber', { collide: 0 });
    // the cargo plane that crashed here, half buried, still smoking
    const PL = [1150, -940];
    add([30, 6, 6], [PL[0], FL + 2.2, PL[1]], 0x9aa0a8, 'Metal', { shape: 2, rot: RY(0.4) });
    add([5.6, 5.6, 5.6], [PL[0] - 14, FL + 2.4, PL[1] - 6], 0x9aa0a8, 'Metal', { shape: 3 });
    add([20, 0.8, 5], [PL[0] + 2, FL + 1, PL[1] + 9], 0x8a9098, 'Metal', { collide: 0, rot: RZ(0.2) });
    add([1, 7, 5], [PL[0] + 13, FL + 6, PL[1] + 5], 0xd82a2a, 'Metal', { collide: 0 });
    data.tags.SteamVent.push([PL[0] - 10, FL + 3, PL[1] - 2, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (let k = 0; k < 5; k++) box([2, 1.6, 2], [PL[0] - 6 + k * 3.4, FL, PL[1] + 14 + (k % 2) * 2], 0x8a6a3a, 'WoodPlanks', { collide: 0 });
    // penguins (they came for the cocoa)
    for (const [x, z, s] of [[1088, -914, 1], [1092, -917, 0.8], [1096, -913, 0.9], [970, -914, 1.1], [1160, -880, 0.9]]) {
      add([1.6 * s, 2.4 * s, 1.4 * s], [x, FL + 1.2 * s, z], 0x14141a, 'SmoothPlastic', { shape: 3 });
      add([1.1 * s, 1.8 * s, 0.6 * s], [x, FL + 1.2 * s, z + 0.5 * s], WHITE, 'SmoothPlastic', { collide: 0, shape: 3 });
      add([0.9 * s, 0.9 * s, 0.9 * s], [x, FL + 2.7 * s, z], 0x14141a, 'SmoothPlastic', { collide: 0, shape: 3 });
      add([0.3 * s, 0.2 * s, 0.5 * s], [x, FL + 2.6 * s, z + 0.6 * s], 0xffa020, 'SmoothPlastic', { collide: 0 });
    }
    // snowy pines round the edges
    for (let k = 0; k < 18; k++) {
      const x = FB.x0 + 20 + ((k * 61) % (FB.x1 - FB.x0 - 40)), z = FB.z0 + 18 + ((k * 43) % (FB.z1 - FB.z0 - 40));
      if (Math.abs(z - AVE) < 10 || Math.abs(x - 1060) < 8 || (x > 980 && x < 1140 && z > -870 && z < -800) || (x > 1100 && x < 1200 && z > -960 && z < -900)) continue;
      data.trees.push({ leaf: 0xdfe8ec, kind: 'pine', s: 0.9 + (k % 3) * 0.15, pos: [x, FLOOR, z] });
    }
    // Cocoa Camp (food) and Expedition Outfitters (a shop)
    const camp = (id, name, kind, x, z, items, description, color) => {
      box([26, 7, 16], [x, FL, z], color, 'Metal');
      add([27, 3, 17], [x, FL + 7, z], WHITE, 'SmoothPlastic', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
      box([22, 1.2, 2], [x, FL, z + 9], 0xd8e8f0, 'WoodPlanks');
      sign([18, 2.2, 0.3], [x, FL + 5.4, z + 8.2], 0x14283a, 'Back', [[name.toUpperCase(), 0, 0, 1, 1, 0x8ad0ff]], { glow: true });
      data.config.Venues.push({ id, name, kind, land: 'FrostbiteBase', facing: 'S', description, items, color: 0x8ad0ff, position: [x, FLOOR, z], size: [26, 7, 16] });
      if (kind === 'restaurant') data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: id, land: 'FrostbiteBase', seed: 11, cf: cf(x, FL, z + 4.6, Math.PI) });
    };
    camp('CocoaCamp', 'Cocoa Camp', 'restaurant', 1150, -800, ['PolarCocoa', 'IcicleSlush', 'SnowballCookie'], 'Hot cocoa, icicle slushes and snowball cookies to warm up the expedition.', 0x2a5a8a);
    camp('ExpeditionOutfitters', 'Expedition Outfitters', 'shop', 960, -800, ['SnowGoggles', 'ExpeditionCap', 'PenguinBalloon', 'ExpressPass'], 'Gear for the expedition: snow goggles, crew caps and penguin balloons.', 0x3a4a5a);
    path([[1060, AVE], [1060, -972]], 8, FL, 0xc8d4dc, 'Concrete');
    path([[960, -900], [1200, -900]], 6, FL, 0xc8d4dc, 'Concrete');
    line([[1060, AVE], [1060, -900], [960, -900], [1060, -900], [1200, -900], [1060, -900], [1060, -972]], FLOOR);
    sign([20, 3, 0.3], [1060, FL + 9, AVE - 5.6], 0x14283a, 'Back', [['FROSTBITE BASE', 0, 0, 1, 0.7, 0x8ad0ff], ['EXPEDITION OUTPOST  ·  KEEP MOVING TO STAY WARM', 0, 0.7, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
    for (const x of [1049, 1071]) box([0.8, 9, 0.8], [x, FL, AVE - 5.6], 0x8a8e96, 'Metal');
    for (const [x, z] of [[1000, -880], [1120, -880], [1060, -950], [960, -840], [1180, -840]]) data.hauntLights.push([x, FL + 6, z, 0xb8e4ff]);
  }
  // Neon District's sign at the foot of the escalators
  sign([16, 3, 0.3], [gx, FL + 9, ESC.bot - 14], INK, 'Back', [['NEON DISTRICT', 0, 0, 1, 0.7, PINK], ['THE LOWER LOT NEVER SLEEPS', 0, 0.7, 1, 0.3, CYAN, 'GothamBold']], { glow: true });
  sign([16, 3, 0.3], [gx, FL + 9, ESC.bot - 14.4], INK, 'Front', [['NEON DISTRICT', 0, 0, 1, 1, PINK]], { glow: true });
  for (const x of [gx - 9, gx + 9]) box([0.8, 9, 0.8], [x, FL, ESC.bot - 14.2], INK, 'Metal');

  // ======== the new items
  addItems(data);
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Have you been down to the Lower Lot? Take the escalators from the terrace by Zero Space!'];
  return { terrace: [gx, TER.z0 + 20], lands: ['NeonDistrict', 'LostLagoon', 'FrostbiteBase'] };
}

// the new venues' items: recolored copies of items the park already has
function addItems(data) {
  const cfgItems = data.config.Items;
  for (const m of NEW_ITEMS) {
    const base = cfgItems.find((i) => i.id === m.base);
    const model = data.items.find((i) => i.id === m.base);
    if (!base || !model || cfgItems.some((i) => i.id === m.id)) continue;
    const seen = [];
    for (const p of model.preview || []) if (!seen.includes(p[16])) seen.push(p[16]);
    const from = seen.some((c) => base.colors.includes(c)) ? base.colors : seen;
    const recolor = (parts) => parts.map((p) => {
      const q = p.slice();
      const k = from.indexOf(p[16]);
      if (k >= 0 && m.colors[k] !== undefined) q[16] = m.colors[k];
      return q;
    });
    const { base: _b, food, ...item } = m;
    cfgItems.push({ ...base, ...item, ...(food ? { kind: 'food' } : {}), shape: base.shape });
    data.items.push({ id: m.id, preview: recolor(model.preview || []), wear: recolor(model.wear || model.preview || []) });
  }
}

// a toast the first time you come near the terrace
export class LowerLotSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
    this.toldDown = false;
  }

  update(dt, pos, started) {
    if (!started) return;
    const [tx, tz] = this.layout.terrace;
    if (!this.told && Math.hypot(pos.x - tx, pos.z - tz) < 60) {
      this.told = true;
      this.hooks.toast('NEW: THE LOWER LOT! Ride the escalators down from this terrace to three new lands: Neon District, Lost Lagoon and Frostbite Base.', 'reward');
    }
    if (!this.toldDown && pos.y < FLOOR + 3) {
      this.toldDown = true;
      this.hooks.toast('Welcome to the Lower Lot - 36 studs down! The avenue runs east through Neon District, Lost Lagoon and Frostbite Base.', 'info');
    }
  }
}
