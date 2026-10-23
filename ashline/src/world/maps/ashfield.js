/**
 * ASHFIELD VALLEY — a 180 x 180 m countryside built for Battle Royale (it
 * also runs every other mode).
 *
 * Layout (X = west→east, Z = south→north):
 *   Centre (12, 12)  : Crossroads Mill — three grain silos, the mill and a barn.
 *   North-west       : Hollow Farm — farmhouse, big barn, orchard rows.
 *   South-west       : Pine Village — five houses around a cobbled square and a chapel.
 *   North-east       : Quarry — terraced rock ledges, an excavator, conveyor.
 *   South-east       : Relay Outpost — radio hut, two bunkers, sandbag lines.
 *   East edge        : Rail Siding — boxcars on a spur and a station shed.
 *   West edge        : Lumber Yard — log stacks and a sawmill shed.
 *   South            : Mill Pond — water, reeds and rocks.
 *   Two gravel roads cross the valley; woods and field cover fill the gaps.
 */
import { wallX, wallZ, door, win, building, crate, barrier, sandbags, barrel, car, tree, sign, perimeter } from './kit.js';

export const ASHFIELD = {
  id: 'ashfield',
  name: 'ASHFIELD VALLEY',
  blurb: 'Big open countryside made for Battle Royale: a mill, a farm, a village, a quarry and an outpost, with woods and fields between them.',
  brRecommended: true,
  bounds: { minX: -90, maxX: 90, minZ: -90, maxZ: 90 },
  sun: { dir: [0.55, 0.42, -0.5], color: 0xffe0b0, intensity: 2.8 },
  sky: { top: 0x6e8fb8, horizon: 0xe8cfa4, ground: 0x4a4636 },
  fog: { color: 0xd8c8a8, density: 0.0042 },
  shadowExtent: { cx: 0, cz: 0, half: 110 },
  build,
  objectives: {
    dom: [
      { id: 'A', x: -50, z: 50, r: 5 },
      { id: 'B', x: 12, z: 2, r: 5 },
      { id: 'C', x: 50, z: -50, r: 5 },
    ],
    hp: [
      { name: 'Crossroads Mill', x: 12, z: 12, w: 12, d: 10 },
      { name: 'Hollow Farm', x: -50, z: 50, w: 12, d: 10 },
      { name: 'Relay Outpost', x: 50, z: -50, w: 12, d: 10 },
      { name: 'Pine Village', x: -52, z: -50, w: 12, d: 10 },
      { name: 'Quarry', x: 50, z: 50, w: 12, d: 10 },
      { name: 'Rail Siding', x: 76, z: 0, w: 8, d: 14 },
    ],
  },
  minimapUnderlay(ctx, X, Y, scale) {
    ctx.fillStyle = '#4a4a34'; ctx.fillRect(X(-90), Y(-90), 180 * scale, 180 * scale);
    ctx.fillStyle = '#565240';
    ctx.fillRect(X(-90), Y(-3), 180 * scale, 6 * scale);
    ctx.fillRect(X(-3), Y(-90), 6 * scale, 180 * scale);
    ctx.fillStyle = '#2f4e6a'; ctx.beginPath(); ctx.ellipse(X(0), Y(-42), 14 * scale, 9 * scale, 0, 0, 7); ctx.fill();
  },
};

/** Seeded random so every build (client and server) makes the same map. */
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// areas that scenery must stay out of: [x0, z0, x1, z1]
const KEEP_OUT = [
  [-6, -6, 30, 30], [-66, 36, -30, 66], [-72, -68, -32, -32], [30, 34, 70, 70], [34, -66, 66, -34],
  [66, -26, 88, 26], [-88, -16, -66, 16], [-16, -54, 16, -30],
  [-90, -90, -79, 90], [79, -90, 90, 90], // team spawn lanes
];
const blocked = (x, z, pad = 0) => KEEP_OUT.some(([a, b, c, d]) => x > a - pad && x < c + pad && z > b - pad && z < d + pad) || Math.abs(x) < 4.5 || Math.abs(z) < 4.5;

function build(b) {
  const B = ASHFIELD.bounds;
  b.box(-220, -1, -220, 220, 0, 220, 'dirt', { faces: 4, map: false });
  // roads
  b.box(-90, 0, -3, 90, 0.01, 3, 'gravel', { collide: false });
  b.box(-3, 0, -90, 3, 0.012, 90, 'gravel', { collide: false });
  perimeter(b, B, 3, 'rock');
  buildMill(b);
  buildFarm(b);
  buildVillage(b);
  buildQuarry(b);
  buildOutpost(b);
  buildSiding(b);
  buildLumber(b);
  buildPond(b);
  buildCountryside(b);

  // ---------------- spawns (team modes) ----------------
  for (let i = 0; i < 12; i++) b.spawn(0, -84, -66 + i * 12, -Math.PI / 2);
  for (let i = 0; i < 12; i++) b.spawn(1, 84, -66 + i * 12, Math.PI / 2);
  for (const [x, z] of [[-20, 60], [20, -60], [-30, -20], [30, 25], [-10, -75], [10, 75], [-70, 75], [70, -75]]) b.spawn(-1, x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);

  // ---------------- bot hotspots ----------------
  b.hotspot(12, 12, 'Crossroads Mill', 3);
  b.hotspot(22, 22, 'Mill Barn', 1.5);
  b.hotspot(-50, 50, 'Hollow Farm', 2.5);
  b.hotspot(-38, 58, 'Farm Barn', 1.5);
  b.hotspot(-58, 42, 'Orchard', 1);
  b.hotspot(-52, -50, 'Pine Village', 2.5);
  b.hotspot(-42, -58, 'Chapel', 1.5);
  b.hotspot(50, 52, 'Quarry', 2.5);
  b.hotspot(50, -50, 'Relay Outpost', 2.5);
  b.hotspot(76, 0, 'Rail Siding', 2);
  b.hotspot(-77, 0, 'Lumber Yard', 2);
  b.hotspot(0, -42, 'Mill Pond', 1.5);
  b.hotspot(-25, 20, 'West Woods', 1);
  b.hotspot(28, -22, 'South Fields', 1);
  b.hotspot(-20, -20, 'Crossing', 1);
  b.hotspot(0, 70, 'North Road', 1);

  b.label(12, 12, 'MILL'); b.label(-50, 50, 'FARM'); b.label(-52, -50, 'VILLAGE');
  b.label(50, 52, 'QUARRY'); b.label(50, -50, 'OUTPOST'); b.label(76, 0, 'SIDING');
  b.label(-77, 0, 'LUMBER'); b.label(0, -42, 'POND');
}

// ---------------- Crossroads Mill ----------------
function buildMill(b) {
  b.box(-4, 0, -4, 28, 0.02, 28, 'concrete', { collide: false });
  for (const [x, z] of [[2, 22], [8.5, 22], [15, 22]]) {
    b.cylinder(x, 0, z, 2.8, 15, 'tank_white', { seg: 18 });
    b.cylinder(x, 15, z, 2.95, 0.4, 'metal', { seg: 18, collide: false });
  }
  building(b, { x0: 4, x1: 20, z0: 6, z1: 15, h: 7, ceilY: 3.4, mat: 'brick', floor: 'concrete', cornice: 'stone', gable: 'x', gableH: 3, roof: 'roof',
    sides: { s: [door(8, 10.5), win(13, 15), win(16.5, 18.5)], n: [door(14, 16)], w: [door(9, 11), win(12.5, 14)], e: [door(9.5, 11.5)] } });
  wallZ(b, 12, 6.15, 14.85, 3.4, 0.2, 'brick', [door(9.5, 11.5)]);
  b.boxC(7, 0, 12.5, 2.4, 1.8, 2.4, 'metal'); // millstone housing
  crate(b, 18, 0, 8); crate(b, 18, 0, 9.3, 1.0);
  building(b, { x0: 20, x1: 28, z0: 16, z1: 28, h: 5, ceilY: 4.2, mat: 'wood', floor: 'floor_in', cornice: 'wood', gable: 'z', gableH: 3, roof: 'roof',
    sides: { w: [door(19, 23)], s: [door(22.5, 25.5)], e: [win(21, 23, 1.2, 2)] } });
  for (const [x, z] of [[24, 25], [25.5, 25], [24.7, 25, 1.2]]) crate(b, x, z === 25 && x === 24.7 ? 1.2 : 0, z, 1.2, 'wood');
  car(b, 1, 3.8, true, 'steel_yellow');
  barrier(b, 25, 3.6, true, 3); barrel(b, -1.5, 9); barrel(b, -1, 10);
  sign(b, 'ASHFIELD MILL', 12, 4.5, 5.8, 6, 0.9, Math.PI);
}

// ---------------- Hollow Farm ----------------
function buildFarm(b) {
  building(b, { x0: -58, x1: -46, z0: 44, z1: 54, h: 5.8, ceilY: 3.2, mat: 'plaster_cream', floor: 'floor_in', cornice: 'wood', gable: 'x', gableH: 2.8, roof: 'tile_roof', shutters: 'paint_blue',
    sides: { s: [door(-53, -51), win(-56.5, -54.5), win(-49.5, -47.5)], n: [door(-50, -48), win(-56, -54)], e: [door(48, 50)], w: [win(47, 49)] } });
  wallZ(b, -52, 44.15, 53.85, 3.2, 0.2, 'plaster_cream', [door(48, 50)]);
  b.boxC(-56, 0, 52.5, 2.2, 0.8, 1.0, 'wood'); b.boxC(-48, 0, 46, 1.2, 0.8, 1.2, 'wood');
  building(b, { x0: -44, x1: -32, z0: 52, z1: 64, h: 6.5, ceilY: 5.6, mat: 'corrugated_green', floor: 'dirt', cornice: 'metal', gable: 'z', gableH: 3.2, roof: 'roof',
    sides: { s: [door(-41, -35, 4.2)], n: [door(-40, -36, 4.2)], w: [door(56, 58)] } });
  for (const [x, z, y] of [[-42, 62, 0], [-40.8, 62, 0], [-41.4, 62, 1.2], [-34, 54, 0], [-34, 55.2, 0]]) crate(b, x, y, z, 1.2, 'wood');
  b.boxC(-37.5, 0, 59, 3.4, 1.4, 2.0, 'steel_green'); // tractor body
  // orchard
  for (let x = -64; x <= -50; x += 5) for (let z = 36; z <= 41; z += 5) tree(b, x, z, 4.2, 1.6);
  for (const [x, z] of [[-60, 58], [-44, 40], [-30, 46]]) sandbags(b, x, z, true, 3);
  car(b, -46, 40, false, 'paint_white');
}

// ---------------- Pine Village ----------------
function buildVillage(b) {
  b.box(-62, 0, -58, -42, 0.02, -42, 'cobble', { collide: false });
  const houses = [[-68, -64, -62, -56, 'plaster_rose'], [-68, -48, -62, -40, 'plaster_ochre'], [-58, -66, -50, -60, 'plaster_grey'], [-48, -48, -40, -40, 'plaster_cream'], [-62, -38, -54, -32, 'plaster_ochre']];
  houses.forEach(([x0, z0, x1, z1, mat], i) => {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    building(b, { x0, x1, z0, z1, h: 5.4, ceilY: 3.1, mat, floor: 'floor_in', cornice: 'stone', gable: i % 2 ? 'x' : 'z', gableH: 2.6, roof: 'tile_roof', shutters: i % 2 ? 'paint_white' : 'wood',
      sides: { s: [door(mx - 1, mx + 1), win(x0 + 1, x0 + 2.4)], n: [win(mx - 0.7, mx + 0.7)], e: [door(mz - 1, mz + 1)], w: [win(mz - 0.7, mz + 0.7)] } });
    crate(b, x1 + 1, 0, z0 + 1, 1.0);
  });
  // chapel
  building(b, { x0: -46, x1: -38, z0: -66, z1: -52, h: 8, ceilY: 6.5, mat: 'stone', floor: 'floor_in', cornice: 'stone', gable: 'z', gableH: 4, roof: 'tile_roof',
    sides: { n: [door(-43, -41, 3.2)], w: [win(-62, -60, 2, 4.5), win(-57, -55, 2, 4.5)], e: [win(-62, -60, 2, 4.5), door(-56, -54)] } });
  for (let z = -63; z <= -56; z += 2.4) { b.boxC(-43.8, 0, z, 2.2, 0.5, 0.5, 'wood'); b.boxC(-40.2, 0, z, 2.2, 0.5, 0.5, 'wood'); }
  b.boxC(-42, 8, -53, 2.2, 5, 2.2, 'stone', { collide: false }); // bell tower (visual)
  b.cylinder(-52, 0, -50, 1.2, 0.9, 'stone', { seg: 14 }); // well
  for (const [x, z] of [[-56, -46], [-46, -52]]) barrier(b, x, z, true, 2.4);
  car(b, -36, -45, false, 'paint_blue');
}

// ---------------- Quarry ----------------
function buildQuarry(b) {
  b.box(32, 0, 34, 70, 0.02, 70, 'gravel', { collide: false });
  const R = rng(91);
  // terraced ledges you can climb (mantle) and fight over
  for (const [x0, z0, x1, z1, h] of [[34, 62, 70, 70, 6], [62, 36, 70, 62, 6], [40, 56, 58, 62, 3.2], [56, 42, 62, 56, 3.2], [44, 38, 50, 44, 1.6]]) b.box(x0, 0, z0, x1, h, z1, 'rock', { map: 'wall' });
  for (let i = 0; i < 9; i++) { const s = 1.4 + R() * 2.2; b.boxC(38 + R() * 20, 0, 38 + R() * 16, s, s * (0.6 + R() * 0.5), s * (0.8 + R() * 0.4), 'rock', { map: 'low' }); }
  // excavator
  b.boxC(48, 0, 48, 4.4, 1.0, 3.0, 'black');
  b.boxC(48, 1.0, 48, 3.4, 1.9, 2.6, 'steel_yellow');
  b.boxC(50.6, 1.6, 48, 2.6, 0.5, 0.6, 'steel_yellow', { collide: false });
  // conveyor up to the top ledge
  for (let i = 0; i < 6; i++) b.boxC(36 + i * 1.6, 1 + i * 0.9, 58, 1.6, 0.25, 1.2, 'metal', { map: false });
  building(b, { x0: 34, x1: 40, z0: 36, z1: 41, h: 3.2, ceilY: 2.9, mat: 'corrugated_tan', floor: 'concrete', cornice: 'metal', sides: { e: [door(37.5, 39.5)], n: [win(36, 38)] } });
  barrel(b, 41, 39); barrel(b, 41.6, 37.8, 'steel_yellow');
}

// ---------------- Relay Outpost ----------------
function buildOutpost(b) {
  b.box(34, 0, -66, 66, 0.02, -34, 'concrete', { collide: false });
  building(b, { x0: 44, x1: 56, z0: -56, z1: -46, h: 4.2, ceilY: 3.4, mat: 'concrete', floor: 'concrete', cornice: 'concrete_dark',
    sides: { n: [door(49, 51), win(45, 47)], s: [door(52, 54)], w: [door(-52, -50)], e: [win(-53, -51)] } });
  b.boxC(46, 0, -48, 2.4, 1.0, 0.8, 'metal'); b.boxC(54.5, 0, -53, 0.6, 2, 3, 'black');
  b.cylinder(58, 0, -40, 0.25, 26, 'steel_yellow', { seg: 6, collide: false });
  b.boxC(58, 0, -40, 1.4, 1.2, 1.4, 'concrete');
  // bunkers with firing slits
  for (const [x, z] of [[38, -40], [62, -62]]) {
    wallX(b, z - 3, x - 4, x + 4, 2.2, 0.6, 'concrete_dark', [win(x - 1, x + 1, 1.2, 1.6)]);
    wallX(b, z + 3, x - 4, x + 4, 2.2, 0.6, 'concrete_dark', [door(x - 1, x + 1, 2.0)]);
    wallZ(b, x - 4, z - 2.7, z + 2.7, 2.2, 0.6, 'concrete_dark', [win(z - 0.8, z + 0.8, 1.2, 1.6)]);
    wallZ(b, x + 4, z - 2.7, z + 2.7, 2.2, 0.6, 'concrete_dark', []);
    b.box(x - 4.3, 2.2, z - 3.3, x + 4.3, 2.6, z + 3.3, 'concrete_dark', { map: false });
  }
  for (const [x, z, ax] of [[44, -62, true], [56, -38, true], [36, -52, false], [64, -46, false]]) sandbags(b, x, z, ax, 3);
  b.container(48, 0, -38, 6, true, 'blue');
}

// ---------------- Rail Siding ----------------
function buildSiding(b) {
  b.box(72, 0, -26, 80, 0.03, 26, 'ballast', { collide: false });
  for (const z of [-20, -7, 7, 20]) b.container(76, 0, z, 9, false, z % 2 ? 'orange' : 'red');
  building(b, { x0: 82, x1: 88, z0: -8, z1: 8, h: 4, ceilY: 3.4, mat: 'brick', floor: 'floor_in', cornice: 'stone', sides: { w: [door(-1, 1), win(-6, -4), win(4, 6)] } });
  crate(b, 70, 0, 14); crate(b, 70, 0, -14, 1.0);
}

// ---------------- Lumber Yard ----------------
function buildLumber(b) {
  b.box(-88, 0, -16, -66, 0.02, 16, 'gravel', { collide: false });
  for (const [x, z] of [[-84, -10], [-84, 2], [-72, -10], [-72, 9]]) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) b.hcylinder(x + (k - (2 - r) / 2) * 0.9, 0.42 + r * 0.8, z, 0.42, 6, false, 'wood', { seg: 10, map: r === 0 ? 'low' : false });
  }
  building(b, { x0: -82, x1: -74, z0: 6, z1: 14, h: 4.6, ceilY: 4, mat: 'corrugated_tan', floor: 'wood', cornice: 'metal', gable: 'x', gableH: 2, roof: 'roof', sides: { e: [door(8, 12, 3.6)], s: [win(-80, -78)] } });
  b.boxC(-78, 0, 10, 3, 0.9, 1.2, 'metal'); // saw bench
  car(b, -70, -2, false, 'rust');
}

// ---------------- Mill Pond ----------------
function buildPond(b) {
  if (!b.headless) b.box(-14, 0.03, -51, 14, 0.05, -33, 'water', { collide: false });
  // the pond itself is shallow: walkable, but ringed with rocks and reeds for cover
  const R = rng(17);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, rx = 15 + R() * 2, rz = 10 + R() * 2;
    const s = 0.9 + R() * 1.3;
    b.boxC(Math.cos(a) * rx, 0, -42 + Math.sin(a) * rz, s, s * 0.8, s, 'rock', { map: 'low' });
  }
  b.boxC(-6, 0, -36, 3, 0.4, 1.2, 'wood'); // jetty
}

// ---------------- woods, fields and roadside cover ----------------
function buildCountryside(b) {
  const R = rng(4242);
  // woods: clusters of trees
  for (const [cx, cz, n] of [[-25, 20, 9], [-22, -70, 7], [25, 72, 8], [74, 42, 6], [-74, 40, 7], [30, -18, 5], [-30, -20, 6], [70, -76, 5], [-76, -76, 5], [0, 58, 6]]) {
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * 22, z = cz + (R() - 0.5) * 22;
      if (blocked(x, z, 2) || Math.abs(x) > 86 || Math.abs(z) > 86) continue;
      tree(b, x, z, 6 + R() * 3, 2 + R() * 0.8);
    }
  }
  // hay bales, rocks and walls in the open fields
  for (let i = 0; i < 70; i++) {
    const x = (R() - 0.5) * 170, z = (R() - 0.5) * 170;
    if (blocked(x, z, 3)) continue;
    const k = R();
    if (k < 0.35) b.cylinder(x, 0, z, 0.8, 1.2, 'paint_yellow', { seg: 12 });
    else if (k < 0.6) b.boxC(x, 0, z, 1.2 + R(), 0.9 + R() * 0.6, 1.2 + R(), 'rock', { map: 'low' });
    else if (k < 0.8) { const ax = R() < 0.5; b.boxC(x, 0, z, ax ? 6 : 0.6, 1.1, ax ? 0.6 : 6, 'stone', { map: 'low' }); }
    else crate(b, x, 0, z, 1.2);
  }
  // abandoned cars along the roads
  for (const [x, z, ax, m] of [[-40, 4.5, true, 'paint_white'], [35, -4.5, true, 'rust'], [60, 4.5, true, 'paint_blue'], [-62, -4.5, true, 'steel_green'], [4.5, 40, false, 'rust'], [-4.5, -62, false, 'paint_white'], [4.5, 64, false, 'steel_yellow']]) car(b, x, z, ax, m);
  for (const [x, z] of [[-18, 4.6], [18, -4.6], [4.6, -20], [-4.6, 30]]) barrier(b, x, z, Math.abs(z) < 5, 3);
}
