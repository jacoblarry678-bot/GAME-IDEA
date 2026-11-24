// NATURAL KINGDOM: a second park, across the Benton Parkway from the main
// lot, in a valley levelled out of the hills south of the road. Walk over
// on the Kingdom Bridge, in through the gate and up Kingdom Walk to the
// Sunstone - a great sandstone arch with a waterfall, carved with the
// animals of the park - and out to its lands: Savanna Reach (the Savanna
// Trek Safari and Cheetah Chase), Rainforest Hollow (the River Safari) and
// Primeval Valley (Raptor Run). This file is the ground, the lands, the
// gate and the bridge, the paths, the Sunstone, the shops and restaurants
// and the trees; the rides are in nkrides.js and the animals in nkanimals.js.
import { helpers } from './wolverine.js';
import { addItems } from './lowerlot.js';

export const NK = { x0: -90, x1: 800, z0: 690, z1: 1300 }; // the levelled valley
export const NK_GATE = { id: 'nk', x0: 170, x1: 210, z: 718, outside: -1, out: [190, 3, 704], forecourt: [120, 686, 262, 717.5], area: [-130, 690, 830, 1340] };
export const NK_DOOR = { x: 245, y: 0.42, z: 724 }; // the cast members' door, in the wall east of the gate
export const NK_INSIDE = [190, 0.42, 732]; // just inside the gate
export const HUB = [190, 880];
export const NK_LANDS = ['KingdomGate', 'SavannaReach', 'RainforestHollow', 'PrimevalValley'];
const G = 0.02;
const SAND = 0xd8b880, STONE = 0xc89a60, DARKSTONE = 0x8a6440, PATH = 0xc8b08a, WOOD = 0x6a4a2a, THATCH = 0xc8a050, GOLD = 0xf0b030, LEAF = 0x5a8a2a, INK = 0x1a1410, WHITE = 0xf4f0e8, WATER = 0x3a8aa8;

const NEW_ITEMS = [
  { id: 'SafariHat', base: 'CowboyHat', name: 'Safari Hat', description: 'A wide-brimmed explorer hat from Kingdom Outfitters.', price: 120, colors: [0xc8b07a, 0x6a4a2a] },
  { id: 'LionEars', base: 'GearEars', name: 'Lion Mane Ears', description: 'A golden lion mane headband. Roar!', price: 110, colors: [0xd89a30, 0x8a5020] },
  { id: 'DinoBalloon', base: 'DuckBalloon', name: 'Raptor Balloon', description: 'A green raptor on a string, from Primeval Valley.', price: 85, colors: [0x3a9a3a, 0xf0c040] },
  { id: 'GiraffeBalloon', base: 'GlobeBalloon', name: 'Giraffe Balloon', description: 'A spotted giraffe balloon, tall as they come.', price: 85, colors: [0xf0c040, 0x8a5020] },
  { id: 'JungleJuice', base: 'Lemonade', name: 'Jungle Juice', description: 'Mango, passion fruit and lime over ice. Speed boost!', price: 12, hunger: 10, bites: 2, colors: [0xffa030, 0x3aa83a], buff: { kind: 'speed', duration: 50, amount: 5 }, food: true },
  { id: 'SafariSkewers', base: 'Pretzel', name: 'Savanna Skewers', description: 'Grilled chicken skewers with peanut sauce.', price: 18, hunger: 40, bites: 3, colors: [0xc87a3a, 0x6a3a1a], food: true },
  { id: 'DinoNuggets', base: 'Nachos', name: 'Dino Nuggets', description: 'Dinosaur-shaped nuggets and fries. Fills you up.', price: 16, hunger: 45, bites: 4, colors: [0xe0a040, 0xf0d060], food: true },
  { id: 'SunstoneSmoothie', base: 'TurboShake', name: 'Sunstone Smoothie', description: 'Orange and peach, the color of the Sunstone. Jump boost!', price: 13, hunger: 12, bites: 2, colors: [0xffa040, 0xffffff], buff: { kind: 'jump', duration: 45, amount: 15 }, food: true },
];

export function buildNaturalKingdom(data) {
  const W = helpers(data);
  const { add, box, sign, cf } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.trees = data.trees || [];
  data.hidden = data.hidden || [];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const unseen = (size, pos) => data.hidden.push(add(size, pos, INK, 'SmoothPlastic'));
  const path = (pts, w, color = PATH, mat = 'Pavement') => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([w, 0.2, len + w * 0.6], [(a[0] + b[0]) / 2, G + 0.1, (a[1] + b[1]) / 2], color, mat, { yaw, collide: 0 });
    }
  };
  const disc = (x, z, r, color = PATH, mat = 'Pavement', y = G + 0.1) => add([r * 2, 0.2, r * 2], [x, y, z], color, mat, { shape: 5, collide: 0 });
  const lamp = (x, z, color = 0xffd890) => {
    box([0.35, 7, 0.35], [x, G, z], 0x3a2a1a, 'Wood', { collide: 0 });
    add([1.2, 0.9, 1.2], [x, G + 7.3, z], color, 'Neon', { collide: 0, shape: 3 });
    add([1.8, 0.4, 1.8], [x, G + 7.9, z], THATCH, 'Fabric', { collide: 0, shape: 1, rot: RX(0) });
    data.tags.ParkLamp.push([x, G + 7.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  };

  // ======== the ground: the valley levelled out of the hills, the old trees cleared
  data.flatZones = [...(data.flatZones || []), { x0: NK.x0, x1: NK.x1, z0: NK.z0, z1: NK.z1, margin: 45 }];
  data.trees = data.trees.filter((t) => !(t.pos[0] > NK.x0 - 20 && t.pos[0] < NK.x1 + 20 && t.pos[2] > 676 && t.pos[2] < NK.z1 + 20));

  // ======== the lands
  data.config.Lands.push(
    { id: 'KingdomGate', name: 'Kingdom Gate', center: [HUB[0], 0, 790], color: 0xd89a3a, tagline: 'Natural Kingdom: where every path leads to the wild.', regions: [[120, 718, 262, 960]] },
    { id: 'SavannaReach', name: 'Savanna Reach', center: [520, 0, 980], color: 0xe0b040, tagline: 'Golden grass, wide skies and the herds on the move.', regions: [[262, 700, 800, 980], [340, 980, 800, 1300]] },
    { id: 'RainforestHollow', name: 'Rainforest Hollow', center: [20, 0, 1000], color: 0x2a9a5a, tagline: 'Deep green, warm rain and eyes in the leaves.', regions: [[-90, 760, 120, 1300]] },
    { id: 'PrimevalValley', name: 'Primeval Valley', center: [230, 0, 1120], color: 0xc8501e, tagline: 'The volcano is rumbling. The dinosaurs are back.', regions: [[120, 960, 340, 1300]] },
  );

  // ======== the Kingdom Bridge: over the parkway from the main lot
  const BX = 190, BW = 8, DECK = 9;
  const steps = (zStart, dir) => { for (let k = 0; k < 15; k++) box([BW, (k + 1) * 0.6, 1.2], [BX, G, zStart + dir * (k * 1.2 + 0.6)], 0xa89a88, 'Concrete'); };
  steps(593, 1); // up from the lot (z 593..611)
  steps(707, -1); // down to the forecourt (z 707..689)
  box([BW, 1, 689 - 611], [BX, DECK - 1, 650], 0xb0a490, 'Concrete');
  for (const z of [622, 632, 678]) box([BW - 2, DECK - 1, 1.6], [BX, 0, z], 0x9a8e7c, 'Concrete');
  for (const sd of [-1, 1]) {
    add([0.3, 1.2, 96], [BX + sd * (BW / 2 - 0.15), DECK + 0.6, 650], WOOD, 'Wood', { collide: 0 });
    add([0.4, 0.3, 96], [BX + sd * (BW / 2 - 0.15), DECK + 1.3, 650], 0x4a3420, 'Wood', { collide: 0 });
    unseen([0.4, 6, 96], [BX + sd * (BW / 2 + 0.2), DECK + 3, 650]);
    for (let z = 604; z <= 696; z += 4) add([0.25, 1.4, 0.25], [BX + sd * (BW / 2 - 0.15), DECK + 0.7, z], 0x4a3420, 'Wood', { collide: 0 });
  }
  for (const [z, face, t] of [[592.5, 'Front', 'NATURAL KINGDOM  >  OVER THE BRIDGE'], [649, 'Back', 'NATURAL KINGDOM  ·  STRAIGHT AHEAD']]) {
    box([0.4, z < 600 ? 6 : 4, 0.4], [BX - 3.6, z < 600 ? G : DECK, z], WOOD, 'Wood', { collide: 0 });
    box([0.4, z < 600 ? 6 : 4, 0.4], [BX + 3.6, z < 600 ? G : DECK, z], WOOD, 'Wood', { collide: 0 });
    sign([8, 1.6, 0.25], [BX, (z < 600 ? G : DECK) + (z < 600 ? 6.6 : 4.6), z], 0x2a4a1a, face, [[t, 0, 0, 1, 1, GOLD, 'GothamBold']], { glow: true });
  }
  // the paths to it: from the lot's south aisle, and from the bridge to the gate
  path([[BX, 560], [BX, 593]], 10, 0x8a8478);
  add([80, 0.2, 18], [BX, G + 0.1, 709], SAND, 'Pavement', { collide: 0 });

  // ======== the gate: two carved stone towers, a timber beam with the name, walls of rough stone
  for (const [x0, x1] of [[152, 170], [210, 228]]) {
    const cx = (x0 + x1) / 2;
    box([x1 - x0, 20, 12], [cx, G, 718], STONE, 'Slate');
    box([x1 - x0 + 2, 2, 14], [cx, G + 20, 718], DARKSTONE, 'Slate');
    for (const [dy, c] of [[6, DARKSTONE], [12, 0xa87a48]]) add([x1 - x0 + 0.4, 1.2, 12.4], [cx, G + dy, 718], c, 'Slate', { collide: 0 });
    sign([x1 - x0 - 4, 1.6, 0.2], [cx, G + 9, 711.85], 0x2a1a0a, 'Front', [['TICKETS', 0, 0, 1, 1, GOLD, 'GothamBold']], { glow: true });
    lamp(cx, 708);
  }
  add([44, 3.6, 2], [190, G + 17.5, 718], WOOD, 'Wood', { collide: 0 });
  sign([40, 3.2, 0.3], [190, G + 17.5, 716.8], 0x2a1a0a, 'Front', [['NATURAL KINGDOM', 0, 0, 1, 1, GOLD]], { glow: true });
  sign([40, 3.2, 0.3], [190, G + 17.5, 719.2], 0x2a1a0a, 'Back', [['NATURAL KINGDOM', 0, 0, 1, 1, GOLD]], { glow: true });
  for (const x of [176, 190, 204]) add([1.4, 1.4, 1.4], [x, G + 21, 718], [0xe0b040, 0x2a9a5a, 0xc8501e][(x - 176) / 14], 'Neon', { collide: 0, shape: 3 });
  for (const [x0, x1] of [[110, 152], [228, 270]]) box([x1 - x0, 8, 2.4], [(x0 + x1) / 2, G, 718], 0xa8865a, 'Slate');
  // the cast members' door, in the east wall
  for (const z of [716.7, 719.3]) {
    add([4, 6.6, 0.15], [NK_DOOR.x, G + 3.3, z], 0x4a3a2a, 'Wood', { collide: 0 });
    sign([4.2, 0.9, 0.1], [NK_DOOR.x, G + 7.2, z + (z < 718 ? -0.1 : 0.1)], 0x16223a, z < 718 ? 'Front' : 'Back', [['CAST MEMBERS ONLY', 0, 0, 1, 1, GOLD, 'GothamBold']]);
  }

  // ======== Kingdom Walk: from the gate to the Sunstone, shops either side
  path([[190, 718], [190, 828]], 26);
  for (const z of [730, 755, 780, 805]) for (const x of [174, 206]) lamp(x, z);
  const venue = (id, name, kind, land, x, z, w, d, h, facing, color, items, description) => {
    box([w, h, d], [x, G, z], color, 'Slate');
    const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[facing];
    const ax = Math.abs(f[0]) > 0;
    const fx = x + f[0] * ((ax ? w : d) / 2 + 0.2), fz = z + f[1] * ((ax ? w : d) / 2 + 0.2);
    const across = ax ? d : w;
    add(ax ? [0.4, h - 4, across - 6] : [across - 6, h - 4, 0.4], [fx, G + (h - 4) / 2 + 0.3, fz], 0x1a1208, 'SmoothPlastic', { collide: 0 });
    // a thatched awning over the counter
    add(ax ? [5, 0.6, across + 2] : [across + 2, 0.6, 5], [fx + f[0] * 2.4, G + h - 2.5, fz + f[1] * 2.4], THATCH, 'Fabric', { collide: 0 });
    sign(ax ? [0.3, 2.4, across - 4] : [across - 4, 2.4, 0.3], [fx + f[0] * 0.2, G + h + 0.8, fz + f[1] * 0.2], 0x2a1a0a, { N: 'Front', S: 'Back', E: 'Right', W: 'Left' }[facing], [[name.toUpperCase(), 0, 0, 1, 1, GOLD]], { glow: true });
    data.config.Venues.push({ id, name, kind, land, facing, description, items, color, position: [x, 0, z], size: [w, h, d] });
    if (kind === 'restaurant') data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: id, land, seed: id.length * 3, cf: cf(fx - f[0] * 3, G, fz - f[1] * 3, Math.atan2(f[0], f[1]) + Math.PI) });
  };
  venue('KingdomOutfitters', 'Kingdom Outfitters', 'shop', 'KingdomGate', 147, 772, 30, 24, 12, 'E', 0xb08050, ['SafariHat', 'LionEars', 'GiraffeBalloon', 'ExpressPass'], 'Safari hats, lion manes and giraffe balloons for the trip into the wild.');
  venue('SunstoneSweets', 'Sunstone Sweets', 'restaurant', 'KingdomGate', 233, 772, 30, 24, 12, 'W', 0xc08a50, ['SunstoneSmoothie', 'JungleJuice', 'GearDonut'], 'Smoothies the color of the Sunstone, juice from the rainforest and a donut for the road.');

  // ======== the Sunstone: a great sandstone arch over a pool, a waterfall
  // from its crown, the park's animals carved into its legs, a gold sun on top
  const [hx, hz] = HUB;
  // the ring path round it, and the pool
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
    path([[hx + Math.cos(a0) * 52, hz + Math.sin(a0) * 52], [hx + Math.cos(a1) * 52, hz + Math.sin(a1) * 52]], 14);
  }
  add([82, 1.2, 82], [hx, G + 0.6, hz], DARKSTONE, 'Slate', { shape: 5, collide: 0 });
  add([76, 0.3, 76], [hx, G + 1.3, hz], WATER, 'Glass', { shape: 5, trans: 0.25, collide: 0 });
  // (an unseen wall round the pool: you walk round it, not across it)
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; unseen([13.4, 5, 0.6], [hx + Math.cos(a) * 41, G + 2.5, hz + Math.sin(a) * 41]); data.static[data.static.length - 1].splice(7, 9, ...[Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2), 0, 1, 0, -Math.sin(a + Math.PI / 2), 0, Math.cos(a + Math.PI / 2)]); }
  for (const sx of [-1, 1]) {
    // a leg of the arch, leaning in, with a carved animal on its face
    const lx = hx + sx * 14;
    add([9, 30, 11], [lx, G + 15, hz], STONE, 'Slate', { rot: RZ(-sx * 0.12) });
    add([10, 4, 12], [lx + sx * 0.6, G + 2, hz], DARKSTONE, 'Slate');
    for (const [dy, dz, s] of [[8, 0, 2.6], [14, 1.6, 2.2], [20, -1.4, 2.4]]) add([0.6, s, s * 1.6], [lx + sx * (5.2 - dy * 0.12), G + dy, hz + dz], 0x8a5a30, 'Slate', { collide: 0, rot: RZ(-sx * 0.12) });
  }
  add([40, 7, 12], [hx, G + 31, hz], STONE, 'Slate');
  add([30, 3, 13], [hx, G + 35.5, hz], 0xb88a50, 'Slate');
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    add([0.6, 1.6, 0.4], [hx + Math.cos(a) * 4.2, G + 43 + Math.sin(a) * 4.2, hz], GOLD, 'Neon', { collide: 0, rot: RZ(a) });
  }
  add([6, 6, 0.6], [hx, G + 43, hz], 0xffc040, 'Neon', { collide: 0, shape: 3 });
  box([1, 4, 1], [hx, G + 37, hz], DARKSTONE, 'Slate', { collide: 0 });
  // the waterfall: sheets of falling water from the crown into the pool
  for (const [dz, w] of [[-6.2, 10], [6.2, 10]]) {
    add([w, 26, 0.4], [hx, G + 16, hz + dz], 0x9ad0e8, 'Glass', { collide: 0, trans: 0.45 });
    add([w + 2, 1.2, 3], [hx, G + 1.8, hz + dz * 1.3], 0xe8f4f8, 'SmoothPlastic', { collide: 0, trans: 0.3 });
  }
  data.tags.SteamVent = data.tags.SteamVent || [];
  for (const dz of [-8, 8]) data.tags.SteamVent.push([hx, G + 1.5, hz + dz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  sign([14, 2, 0.3], [hx, G + 2.6, hz - 41.5], 0x2a1a0a, 'Front', [['THE SUNSTONE', 0, 0, 1, 1, GOLD]], { glow: true });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; lamp(hx + Math.cos(a) * 62, hz + Math.sin(a) * 62); }
  data.hauntLights.push([hx, G + 20, hz, 0xffc060], [hx, G + 40, hz, 0xffb030]);

  // ======== the spokes: out to each land's plaza
  const plaza = (x, z, r, color) => { disc(x, z, r); add([r * 2 + 1, 0.12, r * 2 + 1], [x, G + 0.05, z], color, 'Slate', { shape: 5, collide: 0 }); };
  path([[hx - 52, hz], [40, hz]], 14); plaza(30, hz, 22, 0x3a7a4a); // Rainforest Hollow
  path([[hx + 52, hz], [330, 860]], 14); plaza(340, 852, 22, 0xc89a50); // Savanna Reach
  path([[340, 852], [392, 812]], 12); path([[340, 852], [440, 772]], 10); // to the safari, to Cheetah Chase
  path([[hx, hz + 52], [hx, 990]], 14); plaza(hx, 1000, 20, 0x8a4a2a); // Primeval Valley
  for (const [x, z] of [[100, 874], [270, 866], [184, 950], [366, 830], [410, 790]]) lamp(x, z);
  // land signs at each plaza
  for (const [x, z, face, t, c] of [[30, 857, 'Back', 'RAINFOREST HOLLOW', 0x2a9a5a], [340, 829, 'Back', 'SAVANNA REACH', 0xe0b040], [hx, 1021, 'Front', 'PRIMEVAL VALLEY', 0xc8501e]]) {
    box([0.5, 7, 0.5], [x - 6, G, z], WOOD, 'Wood', { collide: 0 });
    box([0.5, 7, 0.5], [x + 6, G, z], WOOD, 'Wood', { collide: 0 });
    sign([13, 2.2, 0.3], [x, G + 7.4, z], 0x2a1a0a, face, [[t, 0, 0, 1, 1, c]], { glow: true });
  }
  venue('CanopyKitchen', 'Canopy Kitchen', 'restaurant', 'RainforestHollow', -8, 846, 30, 22, 12, 'E', 0x6a8a4a, ['JungleJuice', 'SafariSkewers', 'Lemonade'], 'Skewers off the grill and jungle juice under the canopy.');
  venue('WateringHoleGrill', 'Watering Hole Grill', 'restaurant', 'SavannaReach', 300, 918, 30, 22, 12, 'N', 0xb88a50, ['SafariSkewers', 'JungleJuice', 'PorkChopPlatter'], 'Savanna skewers and big platters on a deck by the plains.');
  venue('DigSiteSnacks', 'Dig Site Snacks', 'restaurant', 'PrimevalValley', 250, 992, 26, 20, 10, 'W', 0xa86a3a, ['DinoNuggets', 'SunstoneSmoothie', 'CrinkleFries'], "Dino nuggets and fries from the excavation crew's kitchen.");
  venue('AmberTradingPost', 'Amber Trading Post', 'shop', 'PrimevalValley', 130, 992, 26, 20, 10, 'E', 0x9a5a2a, ['DinoBalloon', 'SafariHat', 'ExpressPass'], 'Raptor balloons and fossils in amber, fresh from the dig.');

  // ======== trees: acacias on the savanna (built), the rainforest thick with palms and broadleaves
  const acacia = (x, z, s = 1) => {
    add([0.8 * s, 9 * s, 0.8 * s], [x, G + 4.5 * s, z], 0x5a4030, 'Wood', { collide: 0 });
    add([0.5 * s, 4 * s, 0.5 * s], [x + 1.6 * s, G + 8.5 * s, z], 0x5a4030, 'Wood', { collide: 0, rot: RZ(-0.6) });
    add([0.5 * s, 4 * s, 0.5 * s], [x - 1.5 * s, G + 8.3 * s, z + 0.5], 0x5a4030, 'Wood', { collide: 0, rot: RZ(0.6) });
    add([14 * s, 1.8 * s, 11 * s], [x, G + 10.6 * s, z], 0x6a8a2a, 'Grass', { collide: 0, shape: 5 });
    add([10 * s, 1.2 * s, 8 * s], [x + 1, G + 11.8 * s, z - 0.5], 0x7a9a3a, 'Grass', { collide: 0, shape: 5 });
    data.hidden.push(add([1.2 * s, 6, 1.2 * s], [x, G + 3, z], INK, 'SmoothPlastic'));
  };
  const placed = { acacia };
  return { placed, lamp, path, venue, addItems: () => addItems(data, NEW_ITEMS) };
}
