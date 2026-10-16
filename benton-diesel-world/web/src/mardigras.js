// Mardi Gras at the Grand: a temporary bar beside the Benton Diesel Grand
// Hotel's drive. A purple, green and gold striped tent over a long bar, bead
// strands strung between the poles, a giant mask over the front, high-top
// tables, and a limited-time menu (king cake, beignets, po'boys and
// zero-proof Hurricane punch). It is an ordinary restaurant venue, so the
// app's Dining tab and the walk-up counter work as usual.
import { helpers } from './wolverine.js';

export const BAR_ID = 'MardiGrasBar';
const X = 523, Z = 522, W = 16, D = 16, H = 10; // the tent, its open side facing west
const BASE = 0.34; // the hotel's ground
const PURPLE = 0x6a2a9a, GREEN = 0x1e8a3a, GOLD = 0xf0c030, WHITE = 0xf4f4f0, BLACK = 0x101012;
const BEADS = [PURPLE, GREEN, GOLD];

const MENU = [
  { id: 'KingCake', base: 'CinnamonRoll', name: 'King Cake Slice', description: 'Cinnamon cake with purple, green and gold sugar. Find the baby, get your next slice free!', price: 16, hunger: 35, bites: 3, colors: [0xf0c030, 0x6a2a9a, 0x1e8a3a] },
  { id: 'Beignets', base: 'GearDonut', name: 'Beignets', description: 'Three hot French doughnuts buried in powdered sugar.', price: 12, hunger: 25, bites: 3, colors: [0xe8c890, 0xfaf8f2] },
  { id: 'PoBoy', base: 'BrisketSandwich', name: "Shrimp Po'Boy", description: 'Fried shrimp, lettuce and remoulade on a crusty roll. Fills you right up.', price: 30, hunger: 60, bites: 4, colors: [0xd8a860, 0xe87a5a] },
  { id: 'HurricanePunch', base: 'TurboShake', name: 'Hurricane Punch', description: 'Zero-proof passion fruit and orange punch with a cherry. Speed boost!', price: 14, hunger: 12, bites: 2, colors: [0xe83a3a, 0xff9a2a], buff: { kind: 'speed', duration: 45, amount: 5 } },
  { id: 'PurpleLemonade', base: 'Lemonade', name: 'Krewe Purple Lemonade', description: 'Lavender lemonade with gold sugar on the rim. Jump boost!', price: 10, hunger: 10, bites: 2, colors: [0x8a3ac8, 0xf0c030], buff: { kind: 'jump', duration: 45, amount: 14 } },
  { id: 'GoldenFizz', base: 'NitroSoda', name: 'Golden Fizz', description: 'Sparkling ginger and pineapple, gold as a doubloon.', price: 9, hunger: 8, bites: 2, colors: [0xf0c030, 0xfff4c8] },
];

export function buildMardiGras(data) {
  const { add, box, sign, cf } = helpers(data);
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);

  // ---- the menu: recolored from the park's own treats
  const cfgItems = data.config.Items;
  for (const m of MENU) {
    const base = cfgItems.find((i) => i.id === m.base);
    const model = data.items.find((i) => i.id === m.base);
    if (!base || !model) continue;
    const seen = [];
    for (const p of model.preview || []) if (!seen.includes(p[16])) seen.push(p[16]);
    const from = seen.some((c) => base.colors.includes(c)) ? base.colors : seen;
    const recolor = (parts) => parts.map((p) => {
      const q = p.slice();
      const k = from.indexOf(p[16]);
      if (k >= 0 && m.colors[k] !== undefined) q[16] = m.colors[k];
      return q;
    });
    const { base: _b, ...item } = m;
    cfgItems.push({ ...item, kind: 'food', shape: base.shape });
    data.items.push({ id: m.id, preview: recolor(model.preview || []), wear: recolor(model.wear || model.preview || []) });
  }

  // ---- the deck and the tent: four gold poles, a striped roof
  const x0 = X - W / 2, x1 = X + W / 2, z0 = Z - D / 2, z1 = Z + D / 2;
  box([W + 14, 0.4, D + 4], [X - 6, BASE, Z], 0x6a4a34, 'WoodPlanks');
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box([0.8, H, 0.8], [px, BASE + 0.4, pz], GOLD, 'Metal', { shape: 5 });
  const stripes = 8;
  for (let k = 0; k < stripes; k++) {
    const z = z0 + (k + 0.5) * (D / stripes);
    const tilt = 0.32 * (k < stripes / 2 ? 1 : -1), y = BASE + H + 0.6 + (D / 2 - Math.abs(z - Z)) * 0.33;
    add([W + 1.4, 0.25, D / stripes + 0.05], [X, y, z], [PURPLE, GREEN, GOLD, GREEN][k % 4], 'Fabric', { collide: 0, rot: [1, 0, 0, 0, Math.cos(tilt), -Math.sin(tilt), 0, Math.sin(tilt), Math.cos(tilt)] });
  }
  add([1, 1, 1], [X, BASE + H + 3.6, Z], GOLD, 'Neon', { shape: 3, collide: 0 });
  // a scalloped valance of pennants round the edge
  for (let k = 0; k < 8; k++) {
    for (const [px, pz, yaw] of [[x0 - 0.3, z0 + 1 + k * 2, Math.PI / 2], [x1 + 0.3, z0 + 1 + k * 2, Math.PI / 2], [x0 + 1 + k * 2, z0 - 0.3, 0], [x0 + 1 + k * 2, z1 + 0.3, 0]]) {
      add([0.1, 1.6, 1.6], [px, BASE + H - 0.2, pz], BEADS[k % 3], 'Fabric', { shape: 1, collide: 0, rot: yaw ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : [0, 0, 1, 0, -1, 0, 1, 0, 0] });
    }
  }
  // the back and sides are closed in purple and green
  box([0.4, H, D], [x1 - 0.2, BASE + 0.4, Z], PURPLE, 'Fabric');
  for (const pz of [z0 + 0.2, z1 - 0.2]) box([W, H * 0.5, 0.4], [X, BASE + 0.4, pz], GREEN, 'Fabric');

  // ---- the bar: a long counter facing the drive, the back bar behind it
  const cx = X - (D / 2 - 3) - 0.2; // where the app's walk-up counter is
  box([1.8, 3.4, D - 4], [cx - 0.6, BASE + 0.4, Z], 0x3a2418, 'Wood');
  add([2.6, 0.3, D - 3.4], [cx - 0.6, BASE + 3.95, Z], GOLD, 'Metal', { collide: 0 });
  add([0.1, 0.4, D - 4], [cx - 1.55, BASE + 2, Z], PURPLE, 'Neon', { collide: 0 });
  box([1.6, 6, D - 4], [x1 - 1.6, BASE + 0.4, Z], 0x2a1a12, 'Wood', { collide: 0 });
  for (let row = 0; row < 3; row++) {
    add([0.2, 0.2, D - 4.4], [x1 - 2.5, BASE + 2.6 + row * 1.6, Z], 0x8a6a4a, 'Wood', { collide: 0 });
    for (let k = 0; k < 7; k++) add([0.5, 1.1, 0.5], [x1 - 2.6, BASE + 3.3 + row * 1.6, Z - 5.4 + k * 1.8], [GOLD, PURPLE, GREEN, 0xe83a3a][(k + row) % 4], 'Glass', { shape: 5, collide: 0, trans: 0.2 });
  }
  // bar stools in front of the counter
  for (let k = 0; k < 4; k++) {
    const sz = Z - 4.5 + k * 3;
    box([0.3, 2.4, 0.3], [cx - 3.2, BASE + 0.4, sz], 0x2a2a2e, 'Metal', { collide: 0 });
    add([1.4, 0.4, 1.4], [cx - 3.2, BASE + 3, sz], BEADS[k % 3], 'Fabric', { shape: 5, collide: 0 });
  }

  // ---- the giant mask over the front, feathers and all
  const mx = x0 - 0.6, my = BASE + H + 2.6;
  add([0.5, 3, 9], [mx, my, Z], PURPLE, 'SmoothPlastic', { collide: 0 });
  for (const dz of [-1, 1]) add([0.5, 2, 2.4], [mx, my - 1.6, Z + dz * 3.4], PURPLE, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, Math.cos(dz * 0.5), -Math.sin(dz * 0.5), 0, Math.sin(dz * 0.5), Math.cos(dz * 0.5)] });
  for (const dz of [-2.1, 2.1]) add([0.3, 1.1, 2.2], [mx - 0.2, my + 0.2, Z + dz], BLACK, 'SmoothPlastic', { collide: 0 });
  add([0.6, 0.4, 9.4], [mx - 0.05, my + 1.6, Z], GOLD, 'Neon', { collide: 0 });
  add([0.6, 0.4, 9.4], [mx - 0.05, my - 1.6, Z], GOLD, 'Neon', { collide: 0 });
  box([0.3, my - BASE - H, 0.3], [mx + 0.3, BASE + H, Z], GOLD, 'Metal', { collide: 0 });
  for (let k = -2; k <= 2; k++) {
    const a = k * 0.28;
    add([0.2, 6, 1], [mx + 0.3, my + 4.2, Z + 4.6 + k * 0.6], BEADS[(k + 3) % 3], 'Fabric', { collide: 0, rot: [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)] });
  }
  sign([0.3, 2.6, 15], [x0 - 0.5, BASE + H - 2.2, Z], 0x1a0a24, 'Left', [['MARDI GRAS AT THE GRAND', 0, 0, 1, 0.6, GOLD], ['LIMITED TIME  ·  ALL AGES', 0, 0.6, 1, 0.4, WHITE, 'GothamBold']], { glow: true });
  // the menu board on a stand by the counter
  box([0.3, 7, 0.3], [x0 - 8, BASE + 0.4, z0 - 1], 0x2a2a2e, 'Metal');
  sign([0.3, 4.4, 6], [x0 - 8, BASE + 5.4, z0 - 1], 0x1a0a24, 'Left', [
    ['KING CAKE', 0, 0.02, 1, 0.2, GOLD], ['BEIGNETS  ·  PO\'BOYS', 0, 0.26, 1, 0.22, WHITE, 'GothamBold'],
    ['HURRICANE PUNCH', 0, 0.52, 1, 0.2, 0xff6a5a, 'GothamBold'], ['ZERO-PROOF', 0, 0.76, 1, 0.18, GREEN, 'GothamBold'],
  ], { glow: true });

  // ---- bead strands strung pole to pole, sagging, in the three colors
  const strand = (ax, az, bx, bz, y, sag, color) => {
    const n = Math.max(6, Math.round(Math.hypot(bx - ax, bz - az) / 0.8));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      add([0.5, 0.5, 0.5], [ax + (bx - ax) * t, y - sag * 4 * t * (1 - t), az + (bz - az) * t], color, 'Neon', { shape: 3, collide: 0 });
    }
  };
  const top = BASE + H - 1.4;
  strand(x0, z0, x0, z1, top, 1.6, GOLD);
  strand(x0, z0, x0, z1, top - 0.8, 2.2, PURPLE);
  strand(x0, z0, x1, z0, top, 1.4, GREEN);
  strand(x0, z1, x1, z1, top, 1.4, GREEN);
  strand(x0, z0, x1, z1, top + 0.4, 2.4, PURPLE);
  strand(x0, z1, x1, z0, top + 0.4, 2.4, GOLD);

  // ---- high-top tables out front, each with a bowl of beads, and lamps
  for (const [tx, tz] of [[x0 - 6, z0 + 2], [x0 - 6, z1 - 2], [x0 - 11, Z]]) {
    box([0.5, 3.6, 0.5], [tx, BASE + 0.4, tz], 0x2a2a2e, 'Metal');
    add([3, 0.3, 3], [tx, BASE + 4.1, tz], 0x3a2418, 'Wood', { shape: 5, collide: 0 });
    for (let k = 0; k < 3; k++) add([0.6, 0.6, 0.6], [tx - 0.5 + k * 0.5, BASE + 4.5, tz + (k - 1) * 0.3], BEADS[k], 'Neon', { shape: 3, collide: 0 });
  }
  for (const [lx, lz, c] of [[x0 - 13, z0 - 2, PURPLE], [x0 - 13, z1 + 2, GREEN]]) {
    box([0.4, 10, 0.4], [lx, BASE + 0.4, lz], 0x2a2a2e, 'Metal');
    add([1.4, 1.4, 1.4], [lx, BASE + 10.9, lz], c, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([lx, BASE + 10.9, lz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  light(X - 2, BASE + 8, Z, PURPLE);
  light(x0 - 6, BASE + 6, Z, GOLD);
  light(x0 - 2, BASE + 12, Z, GREEN);

  data.config.Venues.push({
    id: BAR_ID, name: 'Mardi Gras Bar at the Grand', kind: 'restaurant', land: 'Plaza', facing: 'W',
    description: "Limited time at the Benton Diesel Grand: king cake, beignets, shrimp po'boys and zero-proof Hurricane punch under the beads.",
    items: MENU.map((m) => m.id), color: PURPLE, position: [X, 0, Z], size: [W, H, D],
  });
  data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: BAR_ID, land: 'Plaza', seed: 4, cf: cf(cx + 1.6, BASE + 0.4, Z, Math.PI / 2) });
  data.staff.lines.hotel = [...(data.staff.lines.hotel || []), 'Happy Mardi Gras! The bar is by the drive!', 'Laissez les bons temps rouler!'];
  return { x: X, z: Z };
}
