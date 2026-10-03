/**
 * SIGNAL STATION — a remote hilltop communications facility.
 *
 * Layout (X = west→east, Z = south→north), play space 100 x 76 m:
 *   West  (x<-36): WARDEN staging — motor pool with trucks and a fuel bowser.
 *   East  (x>36) : SABLE staging — helipad and an open-fronted hangar.
 *   Center       : fenced compound — Operations building (server room,
 *                  control room, hall), generator shed, relay hut and the
 *                  lattice antenna mast (landmark).
 *   North        : Ridge Road — long open sightlines, rocks, a radio shack.
 *   South        : Dish Field — three satellite dishes and a survey bunker.
 *   Approaches   : wide open ground between the staging areas and the fence.
 */
import * as THREE from 'three';
import { wallX, wallZ, door, win, building, crate, barrier, sandbags, barrel, sign, perimeter, backdrop } from './kit.js';

export const SIGNAL_STATION = {
  id: 'signal_station',
  name: 'SIGNAL STATION',
  blurb: 'Remote comms facility. Open approaches and long sightlines around a tight fenced compound.',
  bounds: { minX: -50, maxX: 50, minZ: -38, maxZ: 38 },
  sun: { dir: [-0.35, 0.7, 0.55], color: 0xe8eef8, intensity: 2.6 },
  sky: { top: 0x7d93ab, horizon: 0xc9d0d4, ground: 0x4c4a44 },
  fog: { color: 0xb8c0c4, density: 0.0085 },
  shadowExtent: 64,
  build,
  objectives: {
    dom: [
      { id: 'A', x: -27, z: 7, r: 4.2 },
      { id: 'B', x: -6, z: 7.5, r: 4.0 },
      { id: 'C', x: 27, z: -7, r: 4.2 },
    ],
    hp: [
      { name: 'Control Room', x: -1.5, z: 0, w: 6, d: 5.5 },
      { name: 'Generator Shed', x: 9.5, z: -6, w: 6.5, d: 5.5 },
      { name: 'Dish Field', x: 0, z: -24, w: 12, d: 7 },
      { name: 'Ridge Road', x: 0, z: 25, w: 12, d: 6 },
      { name: 'Server Room', x: -8.5, z: 0, w: 6.5, d: 5.5 },
      { name: 'Survey Bunker', x: 0, z: -17.5, w: 11, d: 4.5 },
    ],
  },
  minimapUnderlay(ctx, X, Y, scale) {
    ctx.fillStyle = '#3c3a34';
    ctx.fillRect(X(-50), Y(-38), 100 * scale, 76 * scale);
    ctx.fillStyle = '#4a4741'; // roads
    ctx.fillRect(X(-50), Y(-2.5), 100 * scale, 5 * scale);
    ctx.fillRect(X(-50), Y(22), 100 * scale, 6 * scale);
    ctx.fillStyle = '#45474a'; // compound slab
    ctx.fillRect(X(-16), Y(-12), 32 * scale, 24 * scale);
    ctx.strokeStyle = '#8a9096'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.strokeRect(X(-16), Y(-12), 32 * scale, 24 * scale); ctx.setLineDash([]);
  },
  minimapOverlay(ctx, X, Y, scale) {
    ctx.fillStyle = 'rgba(61,155,255,0.14)'; ctx.fillRect(X(-50), Y(-38), 14 * scale, 76 * scale);
    ctx.fillStyle = 'rgba(255,122,47,0.14)'; ctx.fillRect(X(36), Y(-38), 14 * scale, 76 * scale);
  },
};

function build(b) {
  const B = SIGNAL_STATION.bounds;
  b.box(-110, -1, -90, 110, 0, 90, 'dirt', { faces: 4, map: false });
  // roads and pads (visual layers)
  b.box(-50, 0, -2.5, 50, 0.01, 2.5, 'gravel', { collide: false });
  b.box(-50, 0, 22, 50, 0.01, 28, 'gravel', { collide: false });
  b.box(-16, 0, -12, 16, 0.02, 12, 'concrete', { collide: false });
  perimeter(b, B, 2.4, 'concrete');
  if (!b.headless) for (const z of [B.minZ - 0.3, B.maxZ + 0.3]) b.box(B.minX, 2.4, z - 0.02, B.maxX, 4.2, z + 0.02, 'fence', { collide: false });
  if (!b.headless) for (const x of [B.minX - 0.3, B.maxX + 0.3]) b.box(x - 0.02, 2.4, B.minZ, x + 0.02, 4.2, B.maxZ, 'fence', { collide: false });

  buildCompound(b);
  buildMast(b);
  buildMotorPool(b);
  buildHelipad(b);
  buildRidge(b);
  buildDishField(b);
  buildApproaches(b);
  buildScenery(b);
  buildSigns(b);

  // ---------------- spawns ----------------
  const W = [[-47, -30], [-44, 30], [-45, -14], [-45, 16], [-38.5, -6], [-38.5, 6], [-47, -4], [-47, 4], [-41, -24], [-41, 25], [-38, -33], [-36.5, 35]];
  for (const [x, z] of W) b.spawn(0, x, z, -Math.PI / 2);
  const E = [[43, -31], [47, 33], [45, -14], [45.5, 9], [38.5, -6, 0.15], [38.5, 6], [47, -4, 0.15], [47, 3], [41, -20], [42, 30], [38, -33], [38, 34]];
  for (const [x, z, y] of E) b.spawn(1, x, z, Math.PI / 2, y || 0);
  const N = [[-20, 35], [20, 26], [-30, -34], [30, -34], [-28.5, 1.5], [29, -1.5]];
  for (const [x, z] of N) b.spawn(-1, x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);

  // ---------------- bot hotspots ----------------
  b.hotspot(-6, 7.5, 'Compound North', 2.5);
  b.hotspot(-1.5, 0, 'Control Room', 2);
  b.hotspot(-8.5, 0, 'Server Room', 1.5);
  b.hotspot(-5, -6, 'Ops Hall', 1.5);
  b.hotspot(9.5, 0, 'Generator Yard', 2);
  b.hotspot(0, 25, 'Ridge Road', 1.5);
  b.hotspot(20, 31.5, 'Radio Shack', 1);
  b.hotspot(-28, 26, 'Water Tower', 1);
  b.hotspot(0, -24, 'Dish Field', 2);
  b.hotspot(-22, -22, 'West Dish', 1);
  b.hotspot(22, -22, 'East Dish', 1);
  b.hotspot(0, -17.5, 'Survey Bunker', 1);
  b.hotspot(-26, 0, 'West Checkpoint', 1.5);
  b.hotspot(26, 0, 'East Fuel Point', 1.5);

  b.label(-5, -3, 'OPS');
  b.label(9.5, -6, 'GEN');
  b.label(0, 25, 'RIDGE RD');
  b.label(0, -27, 'DISHES');
  b.label(-43, 0, 'MOTOR POOL');
  b.label(43, -1, 'HELIPAD');
}

// ---------------- fenced compound ----------------
function fence(b, x0, z0, x1, z1, gaps) {
  // chain-link: blocks movement only (bullets and sight pass)
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const segs = [];
  let cur = alongX ? x0 : z0;
  const end = alongX ? x1 : z1;
  for (const [a, bb] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a > cur) segs.push([cur, a]); cur = bb; }
  if (cur < end) segs.push([cur, end]);
  for (const [a, bb] of segs) {
    if (alongX) {
      b.box(a, 0, z0 - 0.12, bb, 2.6, z0 + 0.12, null, { visual: false, bullet: false, sight: false, map: 'low' });
      b.box(a, 0, z0 - 0.015, bb, 2.6, z0 + 0.015, 'fence', { collide: false });
      for (let p = a; p <= bb + 0.01; p += 3) b.boxC(Math.min(p, bb), 0, z0, 0.08, 2.75, 0.08, 'metal', { map: false });
      b.box(a, 2.55, z0 - 0.03, bb, 2.62, z0 + 0.03, 'metal', { collide: false });
    } else {
      b.box(x0 - 0.12, 0, a, x0 + 0.12, 2.6, bb, null, { visual: false, bullet: false, sight: false, map: 'low' });
      b.box(x0 - 0.015, 0, a, x0 + 0.015, 2.6, bb, 'fence', { collide: false });
      for (let p = a; p <= bb + 0.01; p += 3) b.boxC(x0, 0, Math.min(p, bb), 0.08, 2.75, 0.08, 'metal', { map: false });
      b.box(x0 - 0.03, 2.55, a, x0 + 0.03, 2.62, bb, 'metal', { collide: false });
    }
  }
}

function buildCompound(b) {
  fence(b, -16, -12, 16, -12, [[-9, -4], [6, 10]]);
  fence(b, -16, 12, 16, 12, [[3, 8]]);
  fence(b, -16, -12, -16, 12, [[-3, 3]]);
  fence(b, 16, -12, 16, 12, [[-3, 3]]);
  // gate posts
  for (const [x, z] of [[-16, -3], [-16, 3], [16, -3], [16, 3], [-9, -12], [-4, -12], [6, -12], [10, -12], [3, 12], [8, 12]]) b.boxC(x, 0, z, 0.3, 2.9, 0.3, 'steel_yellow', { map: false });

  // operations building: hall (south), server room (NW), control room (NE)
  building(b, { x0: -12, x1: 2, z0: -9, z1: 3, h: 4.4, ceilY: 3.4, mat: 'concrete', floor: 'concrete', cornice: 'concrete_dark',
    sides: { w: [door(-5, -3), win(0, 2, 1.2, 1.9)], n: [door(-8, -6), win(-3.5, -1.5, 1.2, 1.9)], e: [door(-1, 1), win(-7, -5, 1.2, 1.9)], s: [door(-3, -1), win(-10, -8, 1.2, 1.9), win(-0.5, 1.5, 1.2, 1.9)] } });
  wallX(b, -3, -12 + 0.15, 2 - 0.15, 3.4, 0.2, 'concrete', [door(-10, -8), door(-2, 0)]);
  wallZ(b, -5, -3, 3 - 0.15, 3.4, 0.2, 'concrete', [door(0, 2)]);
  // server racks
  b.boxC(-11.35, 0, -0.4, 0.6, 2.0, 3.6, 'black');
  b.boxC(-8.6, 0, -2.3, 2.4, 2.0, 0.6, 'black');
  b.boxC(-11, 0, 2.4, 1.2, 1.0, 0.7, 'metal'); // UPS
  // control room consoles
  b.boxC(-1.5, 0, 2.2, 4.4, 1.0, 0.8, 'metal');
  b.boxC(1.2, 0, -1.2, 0.8, 1.0, 2.4, 'metal');
  if (!b.headless) for (const x of [-3, -1.5, 0]) b.box(x - 0.5, 1.0, 2.35, x + 0.5, 1.6, 2.4, 'window_dark', { collide: false });
  // hall: desks and lockers
  b.boxC(-9, 0, -6.5, 2.2, 0.8, 1.1, 'wood'); b.boxC(-5, 0, -7.2, 2.2, 0.8, 1.1, 'wood');
  b.boxC(1.5, 0, -6, 0.6, 1.9, 3, 'steel_green');
  crate(b, -11.2, 0, -8.2, 1.0);

  // generator shed
  building(b, { x0: 6, x1: 13, z0: -9, z1: -3, h: 3.6, ceilY: 3.2, mat: 'corrugated_green', floor: 'diamondplate', cornice: 'metal',
    sides: { w: [door(-7, -5)], n: [door(8, 10)], s: [win(10, 12, 1.2, 1.9)] } });
  b.boxC(11.6, 0, -8, 2.4, 1.6, 1.4, 'steel_yellow');
  barrel(b, 6.6, -8.5, 'steel_yellow');

  // relay hut
  building(b, { x0: 1, x1: 6.5, z0: 6.5, z1: 10.5, h: 3.2, ceilY: 2.9, mat: 'corrugated_tan', floor: 'concrete', cornice: 'metal',
    sides: { s: [door(2.5, 4.5)], w: [door(7.5, 9.5)] } });
  b.boxC(5, 0, 9.4, 1.6, 1.8, 0.8, 'black');

  // compound cover
  crate(b, -14.2, 0, 8.5); crate(b, -14.2, 1.2, 8.5, 1.0); crate(b, -13, 0, 9.4, 1.0);
  b.cylinder(-9, 0, 9.6, 1.0, 1.3, 'wood', { seg: 14 }); // cable spool
  barrier(b, -2.5, 10.4, true, 2.4);
  barrier(b, 6, 2.5, true, 2.4);
  sandbags(b, 13.5, -1, false, 2.4);
  crate(b, 14.4, 0, 8, 1.0); barrel(b, 13.8, 10.2);
  b.boxC(4.6, 0, -1.5, 1.2, 1.5, 0.7, 'metal'); // electrical cabinet
}

function buildMast(b) {
  const cx = 11, cz = 7;
  b.boxC(cx, 0, cz, 3.2, 0.35, 3.2, 'concrete', { map: false });
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.boxC(cx + ox, 0.35, cz + oz, 0.3, 3, 0.3, 'steel_yellow', { map: false });
  b.box(cx - 1.2, 0, cz - 1.2, cx + 1.2, 3, cz + 1.2, null, { visual: false, bullet: false, sight: false, map: 'solid' });
  if (b.headless) return;
  // tapering lattice (visual)
  const H = 42;
  const leg = (sx, sz) => {
    const g = new THREE.CylinderGeometry(0.07, 0.11, H, 6);
    const top = 0.25, bot = 1.0;
    g.translate(0, H / 2, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), k = bot + (top - bot) * (y / H);
      pos.setX(i, pos.getX(i) + sx * k); pos.setZ(i, pos.getZ(i) + sz * k);
    }
    g.computeVertexNormals();
    g.translate(cx, 0.35, cz);
    b.addVisual(g, 'steel_yellow');
  };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) leg(sx, sz);
  for (let y = 3; y < H; y += 3) {
    const k = 1.0 + (0.25 - 1.0) * (y / H);
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      const x0 = cx + ax * k, z0 = cz + az * k, x1 = cx + bx * k, z1 = cz + bz * k;
      b.box(Math.min(x0, x1) - 0.03, y, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, y + 0.06, Math.max(z0, z1) + 0.03, 'steel_yellow', { collide: false });
    }
  }
  // antennas and beacon
  b.box(cx - 0.05, H, cz - 0.05, cx + 0.05, H + 6, cz + 0.05, 'metal', { collide: false });
  for (const y of [30, 36]) for (const [ox, oz] of [[0.6, 0], [-0.6, 0]]) b.box(cx + ox - 0.25, y, cz + oz - 0.4, cx + ox + 0.25, y + 1.6, cz + oz + 0.4, 'tank_white', { collide: false });
  b.box(cx - 0.18, H + 6, cz - 0.18, cx + 0.18, H + 6.4, cz + 0.18, 'lamp_red', { collide: false });
  // guy-wire anchors
  for (const [x, z] of [[cx - 14, cz + 9], [cx + 3, cz - 16], [cx + 14, cz + 10]]) {
    if (Math.abs(x) > 48 || Math.abs(z) > 36) continue;
    b.boxC(x, 0, z, 0.8, 0.5, 0.8, 'concrete', { map: false, collide: false });
    const len = Math.hypot(x - cx, 30, z - cz);
    const g = new THREE.CylinderGeometry(0.02, 0.02, len, 4);
    g.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(cx - x, 30, cz - z).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(x, 0.5, z);
    b.addVisual(g, 'metal');
  }
}

// ---------------- west: motor pool ----------------
function truck(b, x, z, alongX, mat = 'steel_green') {
  const L = 7, W = 2.5;
  const sx = alongX ? L : W, sz = alongX ? W : L;
  b.boxC(x, 0.5, z, sx, 0.6, sz, 'black', { map: false }); // chassis
  const off = (d) => (alongX ? [x + d, z] : [x, z + d]);
  const [cx, cz] = off(-2.4);
  b.boxC(cx, 1.1, cz, alongX ? 2.0 : W, 1.9, alongX ? W : 2.0, mat, { map: 'container' }); // cab
  const [bx, bz] = off(1.0);
  b.boxC(bx, 1.1, bz, alongX ? 4.6 : W, 1.3, alongX ? W : 4.6, mat, { map: 'container' }); // bed sides
  if (!b.headless) {
    b.boxC(bx, 2.4, bz, alongX ? 4.6 : W, 0.08, alongX ? W : 4.6, 'awning_green', { collide: false }); // canvas top
    for (const d of [-2.4, 0.4, 2.2]) for (const s of [-1.1, 1.1]) {
      const [wx, wz] = alongX ? [x + d, z + s] : [x + s, z + d];
      b.hcylinder(wx, 0.5, wz, 0.5, 0.35, !alongX, 'rubber', { collide: false, caps: false, seg: 12 });
    }
  }
}

function buildMotorPool(b) {
  truck(b, -43, -9, false, 'steel_green');
  truck(b, -40, 11, true, 'corrugated_tan');
  truck(b, -44, 21, false, 'steel_green');
  b.hcylinder(-40, 1.2, -20, 1.1, 5, true, 'tank_white'); // fuel bowser
  b.box(-42.6, 0, -20.9, -37.4, 0.4, -19.1, 'black', { map: false });
  // vehicle shed (open east side)
  b.box(-49.4, 0, 26, -38, 3.6, 26.3, 'corrugated_green', { map: 'wall' });
  b.box(-49.4, 0, 33.7, -38, 3.6, 34, 'corrugated_green', { map: 'wall' });
  b.box(-49.6, 3.6, 25.8, -37.8, 3.8, 34.2, 'roof', { map: false });
  for (const z of [26.15, 33.85]) b.boxC(-38.2, 0, z, 0.3, 3.6, 0.3, 'metal', { map: false });
  crate(b, -47.6, 0, 28); crate(b, -47.6, 0, 29.2, 1.0); barrel(b, -46.5, 32.6);
  sandbags(b, -36.5, -2.5, false, 2.4); sandbags(b, -36.5, 2.5, false, 2.4);
  crate(b, -46.5, 0, -28); crate(b, -45.3, 0, -28.2, 1.0);
  barrel(b, -44, -34); barrel(b, -43.3, -34.4, 'rust');
}

// ---------------- east: helipad ----------------
function buildHelipad(b) {
  b.cylinder(43, 0, -8, 6.5, 0.15, 'concrete', { seg: 32 });
  if (!b.headless) {
    const ring = new THREE.RingGeometry(5.6, 6.0, 40); ring.rotateX(-Math.PI / 2); ring.translate(43, 0.16, -8);
    b.addVisual(ring, 'paint_yellow');
    b.box(41.2, 0.15, -10.2, 41.8, 0.16, -5.8, 'paint_white', { collide: false });
    b.box(44.2, 0.15, -10.2, 44.8, 0.16, -5.8, 'paint_white', { collide: false });
    b.box(41.8, 0.15, -8.3, 44.2, 0.16, -7.7, 'paint_white', { collide: false });
  }
  // hangar (open west side)
  b.box(39, 0, 14, 49.4, 6, 14.3, 'corrugated_blue', { map: 'wall' });
  b.box(39, 0, 25.7, 49.4, 6, 26, 'corrugated_blue', { map: 'wall' });
  b.box(49.1, 0, 14, 49.4, 6, 26, 'corrugated_blue', { map: 'wall' });
  b.box(38.8, 6, 13.8, 49.6, 6.3, 26.2, 'roof', { map: false });
  b.box(39, 0, 14.3, 49.1, 0.015, 25.7, 'floorpaint', { collide: false });
  b.boxC(44.5, 0, 20, 3.4, 1.4, 2.0, 'steel_yellow'); // tug
  crate(b, 48, 0, 15.5); crate(b, 48, 1.2, 15.5, 1.0); crate(b, 48.2, 0, 24.5);
  b.container(41.5, 0, -24, 6.1, true, 'white');
  b.container(46.5, 0, -30, 6.1, false, 'blue');
  sandbags(b, 36.5, -2.5, false, 2.4); sandbags(b, 36.5, 2.5, false, 2.4);
  barrel(b, 46, 34.5); barrel(b, 46.7, 34.2, 'rust');
}

// ---------------- north: ridge road ----------------
function rock(b, x, z, sx, sy, sz) {
  b.boxC(x, 0, z, sx, sy, sz, 'rock', { map: 'low' });
  if (!b.headless && sy > 0.8) b.boxC(x + sx * 0.15, sy, z - sz * 0.1, sx * 0.6, sy * 0.35, sz * 0.6, 'rock', { collide: false });
}

function buildRidge(b) {
  rock(b, -36, 18, 3, 1.4, 2.2); rock(b, -18, 19, 2.2, 1.1, 1.8);
  rock(b, -6, 30, 3.4, 1.6, 2.4); rock(b, 6, 19.5, 2.6, 1.2, 2.0);
  rock(b, 32, 18.5, 3, 1.3, 2.4); rock(b, 28, 33, 2.4, 1.8, 2.0);
  rock(b, -32, 35.5, 4, 2.2, 2.6); rock(b, 12, 35.6, 3.2, 1.5, 2.2);
  truck(b, -10, 25.2, true, 'rust'); // broken-down truck
  barrier(b, 14, 24, true, 3); barrier(b, -24, 27, true, 3);
  // radio shack
  building(b, { x0: 16, x1: 24, z0: 29, z1: 35, h: 3.3, ceilY: 3.0, mat: 'corrugated_tan', floor: 'concrete', cornice: 'metal',
    sides: { s: [door(17, 19), win(21, 23, 1.2, 1.9)], w: [door(31, 33)], e: [win(31, 33, 1.2, 1.9)] } });
  b.boxC(21.6, 0, 34, 3, 1.0, 0.8, 'metal'); b.boxC(17.2, 0, 34.2, 1.2, 1.9, 0.6, 'black');
  // water tower
  for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) b.boxC(-28 + ox, 0, 28 + oz, 0.35, 8, 0.35, 'steel_green', { map: false });
  b.cylinder(-28, 8, 28, 2.8, 4, 'tank_white', { collide: false, seg: 20 });
  if (!b.headless) b.cylinder(-28, 12, 28, 2.9, 0.8, 'roof', { collide: false, rTop: 0.4, seg: 20 });
  b.box(-29.6, 3, 26.4, -26.4, 3.12, 29.6, 'metal', { collide: false });
}

// ---------------- south: dish field ----------------
function dish(b, x, z, r, face) {
  b.boxC(x, 0, z, 3, 1.2, 3, 'concrete');
  b.boxC(x, 1.2, z, 0.9, 2.6, 0.9, 'metal');
  if (b.headless) return;
  const g = new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, 0.62);
  g.rotateX(Math.PI); // open side up
  g.translate(0, r * 0.95, 0);
  const m = new THREE.Mesh(g, b.materials.get('dish').mat);
  m.position.set(x, 3.2, z);
  m.rotation.set(face[0], face[1], 0);
  m.castShadow = true; m.receiveShadow = true;
  b.addObject(m);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, r * 1.1, 6), b.materials.get('metal').mat);
  feed.geometry.translate(0, r * 0.55, 0);
  feed.position.set(x, 3.2, z); feed.rotation.copy(m.rotation);
  b.addObject(feed);
}

function buildDishField(b) {
  dish(b, -22, -27, 4.5, [-0.7, 0.4]);
  dish(b, 0, -29, 5.5, [-0.8, 0]);
  dish(b, 22, -27, 4.5, [-0.7, -0.4]);
  // survey bunker (slit windows)
  building(b, { x0: -6, x1: 6, z0: -20, z1: -15, h: 2.8, ceilY: 2.5, mat: 'concrete_dark', floor: 'concrete', cornice: 'concrete',
    sides: { w: [door(-18.5, -16.5)], e: [door(-18.5, -16.5)], n: [win(-4, -1, 1.3, 1.7), win(1, 4, 1.3, 1.7)], s: [win(-4, -1, 1.3, 1.7), win(1, 4, 1.3, 1.7)] } });
  b.boxC(0, 0, -17.5, 3, 0.8, 0.9, 'metal');
  // equipment cabinets & cover
  for (const [x, z] of [[-13, -22], [-11.6, -22], [12, -31], [13.4, -31], [-30, -30], [31, -21]]) b.boxC(x, 0, z, 1.2, 1.6, 0.7, 'tank_white');
  sandbags(b, -8, -26, true, 2.4); sandbags(b, 8, -25, true, 2.4);
  sandbags(b, -16, -33, true, 2.4); sandbags(b, 16, -33.5, true, 2.4);
  rock(b, -34, -17, 2.6, 1.2, 2); rock(b, 34, -16, 2.4, 1.3, 2.2);
  crate(b, 6.5, 0, -33); crate(b, 7.7, 0, -33.2, 1.0);
}

// ---------------- open approaches ----------------
function buildApproaches(b) {
  // west checkpoint on the access road
  b.box(-27.5, 0, 3.5, -24.5, 2.6, 6, 'concrete', { map: 'wall' });
  b.box(-27.7, 2.6, 3.3, -24.3, 2.8, 6.2, 'roof', { collide: false });
  if (!b.headless) { b.boxC(-26, 1.0, 2.8, 0.15, 0.15, 5.4, 'hazard', { collide: false }); }
  sandbags(b, -30, -4.5, true, 3); barrier(b, -22, -6, false, 3);
  rock(b, -24, -14, 2.4, 1.2, 1.8); rock(b, -30, 14.5, 2.2, 1.0, 1.8);
  crate(b, -20, 0, 9); crate(b, -20, 1.2, 9, 1.0);
  // east fuel point
  b.hcylinder(26, 1.1, 5, 1.0, 4.5, true, 'tank_white');
  b.box(23.5, 0, 4.2, 28.5, 0.5, 5.8, 'concrete', { map: false });
  sandbags(b, 30, 4.5, true, 3); barrier(b, 22, 6, false, 3);
  rock(b, 24, 14, 2.4, 1.2, 1.8); rock(b, 30, -14.5, 2.2, 1.0, 1.8);
  crate(b, 20, 0, -9); crate(b, 20, 1.2, -9, 1.0);
  barrel(b, 27.5, -3.6, 'steel_yellow');
}

function buildScenery(b) {
  if (b.headless) return;
  // surrounding ridgelines
  let s = 29;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // rolling hills: flattened, noise-displaced spheres ringing the station
  for (let i = 0; i < 30; i++) {
    const ang = (i / 30) * Math.PI * 2 + r() * 0.1;
    const d = 95 + r() * 35;
    const rad = 28 + r() * 22, h = 10 + r() * 18;
    const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const n = 1 + (Math.sin(x * 5.1 + i) * Math.cos(z * 4.3 + i * 2) * 0.12 + Math.sin(x * 11 + z * 9) * 0.05) * (y > 0.05 ? 1 : 0);
      pos.setXYZ(k, x * rad * n, y * h * n, z * rad * n);
    }
    g.computeVertexNormals();
    g.translate(Math.cos(ang) * d, -1.5, Math.sin(ang) * d);
    b.addVisual(g, i % 3 ? 'dirt' : 'rock');
  }
  backdrop(b, 5, ['backdrop2'], 70, 10, 6, 4, 8);
  // light poles
  for (const [x, z] of [[-16, -12], [16, 12], [-16, 12], [16, -12], [0, 22], [0, -14]]) {
    b.boxC(x, 0, z, 0.25, 8, 0.25, 'metal', { map: false, collide: false });
    b.boxC(x, 8, z, 1.2, 0.22, 0.45, 'metal', { collide: false });
    b.box(x - 0.5, 7.94, z - 0.18, x + 0.5, 7.98, z + 0.18, 'lamp', { collide: false });
  }
}

function buildSigns(b) {
  if (b.headless) return;
  sign(b, 'OPERATIONS', -5, 3.2, 3.17, 3.4, 0.55, 0, { bg: '#1f3446', size: 0.5 });
  sign(b, 'RESTRICTED AREA', -16.1, 2.0, -6, 2.8, 0.5, -Math.PI / 2, { bg: '#b02a1a', size: 0.4 });
  sign(b, 'RESTRICTED AREA', 16.1, 2.0, 6, 2.8, 0.5, Math.PI / 2, { bg: '#b02a1a', size: 0.4 });
  sign(b, 'GENERATOR', 9.5, 2.6, -2.83, 2.4, 0.45, 0, { bg: '#c9a227', fg: '#111', size: 0.5 });
  sign(b, 'SIGNAL STATION 14', -49.38, 1.6, 0, 4.4, 0.7, Math.PI / 2, { bg: '#22313b', size: 0.42 });
  sign(b, 'HANGAR B', 44, 4.6, 14.0, 3, 0.6, Math.PI, { bg: '#2b2f33', size: 0.5 });
  sign(b, 'RADIO', 20, 2.6, 28.83, 1.8, 0.45, Math.PI, { bg: '#2a2a2a', size: 0.55 });
}
