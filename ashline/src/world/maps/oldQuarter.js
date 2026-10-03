/**
 * OLD QUARTER — a historic town district.
 *
 * Layout (X = west→east, Z = south→north), play space 92 x 67 m:
 *   West  (x<-32): WARDEN staging — Tram Square with a parked tram and monument.
 *   East  (x>32) : SABLE staging — covered Market Hall.
 *   North        : Gallery Street — townhouse, chapel and café frontages.
 *   Middle       : Clock Courtyard (fountain, stalls) walled in by the Town Hall
 *                  arch passage, the Gendarmerie and the Hotel; narrow arcades.
 *   South        : the Bakery (two-room interior), garage and apartments, then
 *                  the canal-side road behind a stone balustrade.
 */
import * as THREE from 'three';
import { wallX, wallZ, door, win, building, crate, barrier, barrel, car, tree, lampPost, stall, planter, sign, perimeter, backdrop } from './kit.js';

export const OLD_QUARTER = {
  id: 'old_quarter',
  name: 'OLD QUARTER',
  blurb: 'Historic town streets. A walled clock courtyard, enterable shops and houses, and tight arcades between them.',
  bounds: { minX: -46, maxX: 46, minZ: -31, maxZ: 36 },
  sun: { dir: [0.5, 0.48, -0.42], color: 0xffd2a0, intensity: 3.0 },
  sky: { top: 0x6a8fc0, horizon: 0xe6c7a0, ground: 0x5e5246 },
  fog: { color: 0xd2bea4, density: 0.0072 },
  shadowExtent: 60,
  build,
  objectives: {
    dom: [
      { id: 'A', x: -24, z: 9, r: 4.0 },
      { id: 'B', x: 0, z: -3.5, r: 4.2 },
      { id: 'C', x: 24, z: -9, r: 4.0 },
    ],
    hp: [
      { name: 'Clock Courtyard', x: 0, z: -2.5, w: 11, d: 8 },
      { name: 'Chapel', x: 0, z: 32, w: 13, d: 5.5 },
      { name: 'Gendarmerie', x: -24, z: 0, w: 13, d: 10 },
      { name: 'Bakery', x: 0, z: -12.5, w: 17, d: 7.5 },
      { name: 'Hotel Lobby', x: 24, z: 0, w: 13, d: 10 },
      { name: 'Gallery Street', x: 0, z: 24, w: 14, d: 6 },
    ],
  },
  minimapUnderlay(ctx, X, Y, scale) {
    ctx.fillStyle = '#343a3f';
    ctx.fillRect(X(-46), Y(-31), 92 * scale, 67 * scale);
    ctx.fillStyle = '#3e454b'; // courtyard paving
    ctx.fillRect(X(-12), Y(-8), 24 * scale, 20 * scale);
  },
  minimapOverlay(ctx, X, Y, scale) {
    ctx.fillStyle = 'rgba(61,155,255,0.14)'; ctx.fillRect(X(-46), Y(-31), 14 * scale, 67 * scale);
    ctx.fillStyle = 'rgba(255,122,47,0.14)'; ctx.fillRect(X(32), Y(-31), 14 * scale, 67 * scale);
  },
};

function build(b) {
  const B = OLD_QUARTER.bounds;
  // ground: cobbles everywhere, the canal beyond the south balustrade is lower
  b.box(-90, -1, -30.5, 90, 0, 80, 'cobble', { faces: 4, map: false });
  b.box(-90, -4, -80, 90, -3, -30.5, 'cobble', { faces: 4, map: false, collide: false });
  // sidewalks (raised 0.12 m curbs read as streets without blocking movement)
  for (const [x0, z0, x1, z1] of [[-32, 20, 32, 21], [-32, 27, 32, 28], [-32, -22, 32, -21]]) b.box(x0, 0, z0, x1, 0.12, z1, 'stone', { map: false });
  perimeter(b, { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ }, 6, 'stone', ['s']);

  buildNorthRow(b);
  buildMiddleRow(b);
  buildCourtyard(b);
  buildSouthRow(b);
  buildTramSquare(b);
  buildMarketHall(b);
  buildCanal(b);
  buildStreetDressing(b);
  buildSigns(b);
  backdrop(b, 11, ['backdrop', 'backdrop2', 'plaster_ochre', 'plaster_cream'], 52, 18, 28, 8, 20);

  // ---------------- spawns ----------------
  const W = [[-43, -24], [-43, 30], [-41, -12], [-41, 18], [-35, -4], [-35, 6], [-44, 1], [-44, 10], [-36, -26], [-36, 32], [-43, -4], [-39, 24]];
  for (const [x, z] of W) b.spawn(0, x, z, -Math.PI / 2);
  const E = [[43, -24], [43, 30], [41, -14], [41, 16], [35.5, -6], [35.5, 4], [44.5, -2], [45.2, 3], [36, -27], [36, 32], [42, 24], [39, -20]];
  for (const [x, z] of E) b.spawn(1, x, z, Math.PI / 2);
  const N = [[-14, 34], [14, 33], [-28, -26], [28, -26], [-27, 7.5], [28, -9]];
  for (const [x, z] of N) b.spawn(-1, x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);

  // ---------------- bot hotspots ----------------
  b.hotspot(0, -3.5, 'Fountain', 3);
  b.hotspot(0, 16, 'Town Hall Arch', 2);
  b.hotspot(0, 31.5, 'Chapel', 1.5);
  b.hotspot(-24, 2, 'Gendarmerie', 2);
  b.hotspot(24, -2, 'Hotel', 2);
  b.hotspot(-5, -12.5, 'Bakery West', 1.5);
  b.hotspot(5, -12.5, 'Bakery East', 1.5);
  b.hotspot(-24, 24, 'Gallery West', 1);
  b.hotspot(24, 24, 'Gallery East', 1);
  b.hotspot(-24, 16, 'Bookshop', 1);
  b.hotspot(24, 16, 'Pharmacy', 1);
  b.hotspot(-14, -2, 'West Arcade', 1.5);
  b.hotspot(14, 2, 'East Arcade', 1.5);
  b.hotspot(0, -26, 'Canal Road', 1);

  b.label(0, 2, 'COURTYARD');
  b.label(0, 32, 'CHAPEL');
  b.label(-24, 0, 'GENDARM.');
  b.label(24, 0, 'HOTEL');
  b.label(0, -13, 'BAKERY');
  b.label(-39, 0, 'TRAM SQ.');
  b.label(39, 0, 'MARKET');
}

// ---------------- north row: townhouse, chapel, café ----------------
function buildNorthRow(b) {
  building(b, { x0: -32, x1: -19, z0: 28, z1: 35.6, h: 8.5, mat: 'plaster_ochre', floor: 'wood', shutters: 'steel_green', gable: 'x',
    sides: { s: [win(-31, -29), door(-27, -25), win(-23, -21)], e: [door(31, 33)] } });
  crate(b, -30.5, 0, 34.5, 1.0); b.boxC(-22, 0, 33.5, 2.0, 0.8, 1.0, 'wood'); // table
  b.boxC(-27, 0, 34.6, 2.4, 1.9, 0.6, 'wood', { map: false }); // dresser

  // chapel: tall stone hall, pews inside, side door into the garden
  building(b, { x0: -8, x1: 8, z0: 29, z1: 35.6, h: 10, ceilY: 6.5, mat: 'stone', gable: 'z', gableH: 3.4, roof: 'roof', floor: 'stone',
    sides: { s: [win(-6.5, -4.5, 1.2, 2.8), door(-1.5, 1.5, 3.2), win(4.5, 6.5, 1.2, 2.8)], w: [door(31, 33)], e: [door(31, 33)] } });
  for (const x of [-4.5, 4.5]) for (const z of [30.6, 32.2]) b.boxC(x, 0, z, 4.2, 0.5, 0.55, 'wood', { map: false });
  b.boxC(0, 0, 34.7, 3.0, 1.0, 1.0, 'stone', { map: false }); // altar
  // chapel bell gable (landmark)
  b.box(-1.4, 10, 33.6, 1.4, 14.5, 35.6, 'stone', { collide: false });
  b.box(-0.6, 11.5, 33.55, 0.6, 13, 33.6, 'black', { collide: false });

  // café: two doors, tables outside
  building(b, { x0: 19, x1: 32, z0: 28, z1: 35.6, h: 8, mat: 'plaster_rose', floor: 'wood', shutters: 'wood', gable: 'x',
    sides: { s: [door(21, 23), win(24.5, 27.5, 0.9, 2.2), door(29, 31)], w: [door(31, 33)] } });
  b.boxC(25.5, 0, 34.3, 6, 1.1, 0.8, 'wood'); // bar counter
  for (const [x, z] of [[22, 31], [27.5, 31.5]]) b.boxC(x, 0, z, 1.0, 0.75, 1.0, 'wood', { map: false });
  if (!b.headless) b.box(20.5, 2.9, 26.6, 31.5, 2.96, 28, 'awning_red', { collide: false });

  // gardens between buildings
  planter(b, -14, 31, false, 3); planter(b, -11, 34.5, true, 3);
  tree(b, -16, 34, 6);
  b.boxC(17.5, 0, 34.6, 2.2, 1.5, 1.4, 'steel_green'); // dumpster
  crate(b, 10.5, 0, 33.8); crate(b, 16.5, 0, 30.5, 1.0);
  barrel(b, 11, 30.5, 'rust');
}

// ---------------- middle row: bookshop, town hall wings, pharmacy ----------------
function buildMiddleRow(b) {
  building(b, { x0: -32, x1: -17, z0: 12, z1: 20, h: 7.5, mat: 'plaster_cream', floor: 'wood', shutters: 'wood', gable: 'x',
    sides: { n: [door(-26, -24), win(-22, -20)], s: [win(-30, -28), door(-22, -20)], w: [door(15, 17)] } });
  // shelves (bookshop)
  for (const x of [-29, -25.5]) b.boxC(x, 0, 16, 0.6, 1.9, 4, 'wood');
  b.boxC(-20.5, 0, 17.6, 2.2, 1.0, 0.7, 'wood'); // counter

  // town hall: two wings linked over an arch passage (x -2..2)
  building(b, { x0: -10, x1: -2, z0: 12, z1: 20, h: 10, ceilY: 4.0, mat: 'stone', floor: 'stone',
    sides: { n: [door(-7, -5)], e: [door(15, 17)], s: [win(-8.5, -6.5, 1.1, 2.3), win(-4.5, -3, 1.1, 2.3)] } });
  building(b, { x0: 2, x1: 10, z0: 12, z1: 20, h: 10, ceilY: 4.0, mat: 'stone', floor: 'stone',
    sides: { s: [door(5, 7)], w: [door(15, 17)], n: [win(3.5, 5.5, 1.1, 2.3), win(7, 9, 1.1, 2.3)] } });
  b.box(-2.3, 4.2, 12, 2.3, 10, 20, 'stone', { map: false }); // bridge over the arch
  b.box(-2, 0, 12, 2, 0.015, 20, 'stone', { collide: false });
  b.boxC(-6, 0, 16, 3.0, 0.8, 1.2, 'wood'); // council table
  b.boxC(6, 0, 18.3, 2.4, 1.1, 0.7, 'wood');
  crate(b, 8.8, 0, 13.2, 1.0);

  building(b, { x0: 17, x1: 32, z0: 12, z1: 20, h: 7.5, mat: 'plaster_grey', floor: 'concrete', shutters: 'steel_green', gable: 'x',
    sides: { n: [door(20, 22), win(26, 28)], s: [door(26, 28), win(20, 22)], e: [door(15, 17)] } });
  b.boxC(24, 0, 16, 5, 1.05, 0.8, 'wood'); // pharmacy counter
  b.boxC(30.6, 0, 16, 0.6, 1.9, 4, 'wood');
}

// ---------------- clock courtyard ----------------
function buildCourtyard(b) {
  b.box(-12, 0, -8, 12, 0.012, 12, 'stone', { collide: false }); // paving
  // arcade walls with arched openings
  wallZ(b, -12, -8, 12, 4.2, 0.4, 'stone', [{ a: -1, b: 4, y1: 3.4 }, { a: -6.5, b: -4.5, y0: 1.0, y1: 2.6 }, { a: 7, b: 9, y0: 1.0, y1: 2.6 }], { map: 'wall' });
  wallZ(b, 12, -8, 8.5, 4.2, 0.4, 'stone', [{ a: -4, b: 1, y1: 3.4 }, { a: 3.5, b: 5.5, y0: 1.0, y1: 2.6 }, { a: -7, b: -5.5, y0: 1.0, y1: 2.6 }], { map: 'wall' });
  for (const x of [-12, 12]) b.box(x - 0.35, 4.2, -8, x + 0.35, 4.5, 12, 'stone', { collide: false, map: false });
  // fountain
  b.cylinder(0, 0, 3, 2.5, 0.6, 'stone', { seg: 24 });
  b.cylinder(0, 0.6, 3, 0.45, 1.6, 'stone', { seg: 12 });
  if (!b.headless) {
    const g = new THREE.CircleGeometry(2.25, 24); g.rotateX(-Math.PI / 2); g.translate(0, 0.62, 3);
    b.addVisual(g, 'water');
    const bowl = new THREE.CylinderGeometry(1.1, 0.5, 0.35, 16); bowl.translate(0, 2.25, 3);
    b.addVisual(bowl, 'stone');
  }
  // clock tower (landmark), NE corner
  b.box(8.5, 0, 8.5, 12, 19, 12, 'stone', { map: 'wall' });
  b.box(8.2, 19, 8.2, 12.3, 19.4, 12.3, 'stone', { collide: false });
  if (!b.headless) {
    for (const [x, z, ry] of [[10.25, 8.45, Math.PI], [8.45, 10.25, -Math.PI / 2]]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.6 }));
      face.position.set(x, 15.5, z); face.rotation.y = ry; b.addObject(face);
      for (const [len, ang] of [[0.9, 0.5], [0.65, 2.1]]) {
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.02), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        hand.geometry.translate(0, len / 2, 0);
        hand.position.set(x, 15.5, z); hand.rotation.set(0, ry, ang); hand.translateZ(0.03); b.addObject(hand);
      }
    }
  }
  // market stalls and cover
  stall(b, -6, -5.5, true, 'awning_red');
  stall(b, 6, -1.5, false, 'awning_green');
  stall(b, -7, 7.5, false, 'awning_green');
  planter(b, 4.5, 8.5, true, 3);
  planter(b, -3, -6.8, true, 2.4);
  crate(b, 9.6, 0, -6.4); crate(b, 10.6, 0, -6.6, 1.0); crate(b, 10.1, 1.2, -6.5, 1.0);
  barrel(b, -10.8, 10.6, 'rust'); barrel(b, -10.9, 9.8);
  b.boxC(3.6, 0, -4.6, 1.8, 0.45, 0.6, 'wood', { map: false }); // benches
  b.boxC(-3.6, 0, 1.2, 0.6, 0.45, 1.8, 'wood', { map: false });
}

// ---------------- south row: gendarmerie, hotel, bakery, garage, apartments ----------------
function buildSouthRow(b) {
  // gendarmerie: two rooms split by a partition with a doorway
  building(b, { x0: -32, x1: -16, z0: -6, z1: 6, h: 7.5, mat: 'plaster_grey', floor: 'concrete', shutters: 'corrugated_blue', gable: 'z',
    sides: { e: [door(-1, 1), win(3, 5)], w: [door(1, 3), win(-4, -2)], n: [door(-21, -19)], s: [win(-29, -27), win(-20, -18)] } });
  wallZ(b, -24, -6, 6, 3.6, 0.2, 'plaster_grey', [door(-3, -1), door(2, 4)]);
  b.boxC(-20, 0, 3.8, 2.4, 0.8, 1.1, 'wood'); // desk
  b.boxC(-29.5, 0, -4, 1.0, 1.9, 3.0, 'steel_green'); // lockers
  b.boxC(-27.5, 0, 3, 2.0, 0.8, 1.0, 'wood');

  // hotel lobby
  building(b, { x0: 16, x1: 32, z0: -6, z1: 6, h: 9.5, mat: 'plaster_rose', floor: 'wood', shutters: 'wood', gable: 'z', gableH: 3,
    sides: { w: [door(0, 2), win(-4, -2)], e: [door(-2, 0)], s: [door(22, 24)], n: [win(19, 21), win(27, 29)] } });
  wallX(b, 0.5, 24, 32 - 0.15, 3.6, 0.2, 'plaster_rose', [door(26, 28)]);
  b.boxC(20.5, 0, 4, 3.2, 1.1, 0.8, 'wood'); // reception
  b.boxC(28, 0, 3.3, 2.2, 0.5, 0.8, 'wood'); b.boxC(28, 0, -3.5, 0.8, 0.5, 2.0, 'wood'); // sofas

  // bakery: courtyard door north, two shop doors south, oven room
  building(b, { x0: -10, x1: 10, z0: -17, z1: -8, h: 7, mat: 'plaster_cream', floor: 'wood', shutters: 'awning_red', gable: 'x',
    sides: { n: [door(-1, 1, 2.8)], s: [door(-6, -4), win(-1.5, 1.5, 0.9, 2.2), door(4, 6)], w: [win(-14, -12)], e: [win(-14, -12)] } });
  wallZ(b, 0, -16.85, -12, 3.6, 0.2, 'plaster_cream', [door(-15, -13)]);
  b.boxC(-6, 0, -11, 3.5, 1.05, 0.8, 'wood'); // counter
  b.boxC(6.5, 0, -15.6, 2.4, 1.6, 1.4, 'brick'); // oven
  b.boxC(3, 0, -10.2, 1.2, 0.9, 0.8, 'steel_green');
  crate(b, -9, 0, -16, 0.9);

  // garage (roll-up door north)
  building(b, { x0: -32, x1: -16, z0: -21, z1: -12, h: 6, mat: 'brick', floor: 'concrete', sides: { n: [door(-26, -22, 3.2)], e: [door(-18, -16)], s: [win(-30, -27, 1.1, 2.0)] } });
  car(b, -28.5, -16, true, 'rust');
  b.boxC(-18.5, 0, -19.6, 2.4, 1.0, 1.0, 'steel_yellow'); // workbench
  barrel(b, -21, -20, 'rust');

  // apartments
  building(b, { x0: 16, x1: 32, z0: -21, z1: -12, h: 10.5, mat: 'plaster_ochre', floor: 'wood', shutters: 'steel_green', gable: 'x',
    sides: { n: [door(20, 22)], w: [door(-17, -15)], s: [door(27, 29), win(22, 24)] } });
  wallZ(b, 25, -20.85, -12.15, 3.6, 0.2, 'plaster_ochre', [door(-19, -17)]);
  b.boxC(28.5, 0, -14, 2.0, 0.8, 1.0, 'wood');
  b.boxC(18.6, 0, -19.3, 1.0, 1.9, 2.2, 'wood');
}

// ---------------- west: tram square ----------------
function buildTramSquare(b) {
  // parked tram on bogies (gap underneath)
  const cx = -38.5, z0 = -14, z1 = -2;
  for (const bz of [z0 + 2, z1 - 2]) b.box(cx - 1.0, 0.2, bz - 1.2, cx + 1.0, 0.85, bz + 1.2, 'rust', { map: false });
  b.box(cx - 1.3, 0.85, z0, cx + 1.3, 1.25, z1, 'steel_yellow', { map: false });
  b.box(cx - 1.3, 1.25, z0, cx + 1.3, 2.05, z1, 'steel_yellow', { map: 'container' });
  b.box(cx - 1.3, 2.05, z0, cx + 1.3, 3.1, z1, 'window_dark', { map: false });
  b.box(cx - 1.35, 3.1, z0 - 0.05, cx + 1.35, 3.4, z1 + 0.05, 'tank_white', { map: false });
  b.box(cx - 0.05, 3.4, (z0 + z1) / 2 - 0.6, cx + 0.05, 4.6, (z0 + z1) / 2 + 0.6, 'black', { collide: false });
  // overhead wire posts
  for (const z of [-20, -6, 8, 22]) { b.boxC(-44.6, 0, z, 0.2, 6, 0.2, 'black', { map: false }); b.box(-44.6, 5.8, z - 0.04, -36, 5.86, z + 0.04, 'black', { collide: false }); }
  // monument
  b.boxC(-39, 0, 14, 2.6, 1.6, 2.6, 'stone');
  b.boxC(-39, 1.6, 14, 1.0, 2.6, 1.0, 'metal', { collide: false });
  // tram shelter
  b.box(-45.4, 0, -24, -44.9, 2.4, -19, 'window_dark', { map: false });
  b.box(-45.6, 2.4, -24.2, -43.6, 2.55, -18.8, 'roof', { collide: false });
  b.boxC(-44.7, 0, -21.5, 0.5, 0.5, 3, 'wood', { map: false });
  barrier(b, -35, 4, false); barrier(b, -35, -20, false);
  planter(b, -42, 26, true, 3); planter(b, -36, 24, false, 2.4);
  tree(b, -43, 18, 6); tree(b, -36, -28, 5.5);
  car(b, -42, -27.5, true, 'tank_white');
  crate(b, -34, 30, 1.0); crate(b, -33.6, 31.2, 1.0);
}

// ---------------- east: market hall ----------------
function buildMarketHall(b) {
  for (let z = -12; z <= 12; z += 6) for (const x of [34, 44]) b.boxC(x, 0, z, 0.6, 5.6, 0.6, 'stone', { map: false });
  b.box(33.4, 5.6, -12.6, 44.6, 6.0, 12.6, 'stone', { map: false });
  lantern();
  stall(b, 37, -8, true, 'awning_green'); stall(b, 41, -3, true, 'awning_red');
  stall(b, 37, 3, true, 'awning_red'); stall(b, 41, 8, true, 'awning_green');
  crate(b, 39, 0, -11); crate(b, 40.2, 0, -11, 1.0);
  b.boxC(43, 0, 0, 0.8, 1.1, 4, 'wood'); // weighing counter
  car(b, 40, 22, true, 'corrugated_blue');
  car(b, 38.5, -22, true, 'steel_green');
  barrier(b, 35, 18, false); barrier(b, 35, -18, false);
  tree(b, 44, 31, 6); planter(b, 38, 28, true, 3);
  crate(b, 34.5, 0, -28, 1.0); barrel(b, 36, -29.5);

  function lantern() {
    if (b.headless) return;
    // glazed lantern roof over the hall (visual)
    b.box(36, 6.0, -12, 42, 7.2, 12, 'window_dark', { collide: false });
    b.box(35.8, 7.2, -12.2, 42.2, 7.4, 12.2, 'roof', { collide: false });
  }
}

// ---------------- south: canal side ----------------
function buildCanal(b) {
  // stone balustrade (low cover) with an invisible blocker above it
  b.box(-46, 0, -31, 46, 1.05, -30.4, 'stone', { map: 'low' });
  b.blocker(-46, 1.05, -31, 46, 30, -30.4);
  if (!b.headless) {
    for (let x = -45; x <= 45; x += 1.5) b.boxC(x, 1.05, -30.7, 0.25, 0.12, 0.35, 'stone', { collide: false });
    const water = new THREE.PlaneGeometry(200, 22); water.rotateX(-Math.PI / 2); water.translate(0, -2.2, -42);
    b.addVisual(water, 'water');
    b.box(-90, -4, -31.2, 90, 0, -30.5, 'stone', { collide: false }); // quay wall
    b.box(-90, -4, -53, 90, 0.6, -52, 'stone', { collide: false }); // far quay
  }
  car(b, -20, -27, true, 'steel_yellow');
  car(b, 13, -23.4, true, 'tank_white');
  barrier(b, -6, -26, true); barrier(b, 6, -27.5, true);
  crate(b, 24, 0, -28.6); crate(b, 25.2, 0, -28.6, 1.0);
  lampPost(b, -26, -29.6); lampPost(b, 0, -29.6); lampPost(b, 26, -29.6);
}

// ---------------- street dressing ----------------
function buildStreetDressing(b) {
  // Gallery Street
  car(b, -22, 26.4, true, 'steel_green');
  car(b, 12, 23.2, true, 'rust');
  barrier(b, -5, 24, true, 2.4);
  planter(b, 4, 25.8, true, 2.4);
  for (const x of [-30, -10, 10, 30]) lampPost(b, x, 27.6);
  crate(b, 27, 0, 21.5); crate(b, 27, 1.2, 21.5, 1.0);
  b.boxC(24, 0, 26.6, 1.0, 0.75, 1.0, 'wood', { map: false }); b.boxC(20.8, 0, 26.2, 1.0, 0.75, 1.0, 'wood', { map: false }); // café tables
  // Rue Neuve (z 6..12)
  car(b, -29, 10.8, true, 'corrugated_blue');
  barrier(b, -19.5, 8, false, 2.4);
  barrel(b, -14.6, 11.2); barrel(b, -15.2, 10.6, 'rust');
  // arcades (x ±12..16)
  crate(b, -14.2, 0, -4.5, 1.0); crate(b, 14.2, 0, 5.2, 1.0);
  planter(b, 14.2, -7, false, 2);
  // Rue Sud (z -12..-6)
  car(b, 22, -9.2, true, 'steel_green');
  barrier(b, -20, -9, true, 2.4);
  crate(b, -12.8, 0, -18); crate(b, 12.8, 0, -16, 1.0);
  barrel(b, 13.2, -19.5); barrel(b, -13.4, -10.5, 'rust');
  for (const x of [-24, 24]) lampPost(b, x, -11.6);
}

function buildSigns(b) {
  if (b.headless) return;
  sign(b, 'GENDARMERIE', -15.82, 3.0, 0, 3.6, 0.6, Math.PI / 2, { bg: '#1f3446', size: 0.5 });
  sign(b, 'HÔTEL DES ARCADES', 15.82, 3.1, 0, 4.4, 0.6, -Math.PI / 2, { bg: '#4a1f2a', size: 0.42 });
  sign(b, 'BOULANGERIE', 0, 3.1, -17.17, 3.6, 0.6, Math.PI, { bg: '#7a3f1a', size: 0.5 });
  sign(b, 'CAFÉ LUMIÈRE', 26, 3.4, 27.82, 4, 0.6, Math.PI, { bg: '#2a2a2a', fg: '#f2d48a', size: 0.5 });
  sign(b, 'LIBRAIRIE', -24.5, 3.0, 20.18, 3, 0.55, 0, { bg: '#24402c', size: 0.5 });
  sign(b, 'PHARMACIE', 24.5, 3.0, 20.18, 3, 0.55, 0, { bg: '#1f6a3a', size: 0.5 });
  sign(b, 'HÔTEL DE VILLE', 0, 5.0, 11.78, 4.2, 0.6, Math.PI, { bg: '#2b2f33', size: 0.45 });
  sign(b, 'MARCHÉ COUVERT', 33.9, 4.6, 0, 4.6, 0.7, -Math.PI / 2, { bg: '#5a3a1e', size: 0.45 });
  sign(b, 'PLACE DU TRAM', -45.38, 3.2, 0, 4.4, 0.7, Math.PI / 2, { bg: '#22313b', size: 0.42 });
  sign(b, 'GARAGE', -24, 3.5, -11.82, 2.6, 0.5, 0, { bg: '#c9a227', fg: '#111', size: 0.5 });
}
