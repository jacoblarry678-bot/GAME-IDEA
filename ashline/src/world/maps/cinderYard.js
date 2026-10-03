/**
 * CINDER YARD — an industrial rail depot.
 *
 * Layout (X = west→east, Z = south→north), play space 96 x 72 m:
 *   West  (x<-34): WARDEN staging — freight dock with raised loading platform.
 *   East  (x>34) : SABLE staging — fuel depot with storage tanks & pump house.
 *   North lane   : Warehouse 2 (close quarters), north service alley (flank).
 *   Middle lane  : two rail lines with boxcars, central control booth & signal gantry.
 *   South lane   : container stacks, Maintenance Bldg 4 (interior), south road (long sightline).
 */
import * as THREE from 'three';
import { worldBoxGeometry } from '../mapBuilder.js';
import { signTexture } from '../textures.js';

export const CINDER_YARD = {
  id: 'cinder_yard',
  name: 'CINDER YARD',
  blurb: 'Industrial rail depot. Warehouse close quarters, a contested rail yard and a container maze.',
  bounds: { minX: -48, maxX: 48, minZ: -36, maxZ: 36 },
  sun: { dir: [-0.55, 0.62, 0.38], color: 0xffe2bc, intensity: 3.2 },
  sky: { top: 0x5d86b5, horizon: 0xd9c6a8, ground: 0x5a5146 },
  fog: { color: 0xc4b8a4, density: 0.0065 },
  build,
  minimapUnderlay(ctx, X, Y, scale) {
    ctx.fillStyle = '#3a3a36'; // rail beds
    for (const tz of [-7, 7]) ctx.fillRect(X(-37), Y(tz - 1.7), 74 * scale, 3.4 * scale);
  },
  minimapOverlay(ctx, X, Y, scale) {
    ctx.fillStyle = 'rgba(61,155,255,0.14)'; ctx.fillRect(X(-48), Y(-36), 13 * scale, 72 * scale);
    ctx.fillStyle = 'rgba(255,122,47,0.14)'; ctx.fillRect(X(35), Y(-36), 13 * scale, 72 * scale);
  },
};

function build(b) {
  const B = CINDER_YARD.bounds;

  // ---------------- ground ----------------
  b.box(-90, -1, -80, 90, 0, 80, 'asphalt', { faces: 4, map: false });
  // painted yard lines
  for (const z of [-12.5, 12.5]) b.box(-34, 0, z - 0.06, 34, 0.004, z + 0.06, 'paint_yellow', { collide: false });
  for (const x of [-34, 34]) b.box(x - 0.08, 0, -33, x + 0.08, 0.004, 33, 'paint_white', { collide: false });
  // spawn zone markings
  b.box(-47.5, 0, -33.5, -34.3, 0.003, -33.3, 'paint_blue', { collide: false });
  b.box(34.3, 0, 33.3, 47.5, 0.003, 33.5, 'paint_orange', { collide: false });

  // ---------------- perimeter ----------------
  const wallH = 4.2;
  b.box(B.minX - 0.6, 0, B.minZ - 0.6, B.maxX + 0.6, wallH, B.minZ, 'concrete', { map: 'wall' });
  b.box(B.minX - 0.6, 0, B.maxZ, B.maxX + 0.6, wallH, B.maxZ + 0.6, 'concrete', { map: 'wall' });
  b.box(B.minX - 0.6, 0, B.minZ, B.minX, wallH, B.maxZ, 'concrete', { map: 'wall' });
  b.box(B.maxX, 0, B.minZ, B.maxX + 0.6, wallH, B.maxZ, 'concrete', { map: 'wall' });
  // wall cap + pilasters for detail
  for (let x = B.minX; x <= B.maxX; x += 6) {
    b.box(x - 0.3, 0, B.minZ + 0, x + 0.3, wallH + 0.25, B.minZ + 0.25, 'concrete_dark', { map: false });
    b.box(x - 0.3, 0, B.maxZ - 0.25, x + 0.3, wallH + 0.25, B.maxZ, 'concrete_dark', { map: false });
  }
  for (let z = B.minZ + 6; z < B.maxZ; z += 6) {
    b.box(B.minX, 0, z - 0.3, B.minX + 0.25, wallH + 0.25, z + 0.3, 'concrete_dark', { map: false });
    b.box(B.maxX - 0.25, 0, z - 0.3, B.maxX, wallH + 0.25, z + 0.3, 'concrete_dark', { map: false });
  }
  // invisible high boundary so nobody climbs out
  b.blocker(B.minX - 2, 0, B.minZ - 2, B.maxX + 2, 30, B.minZ);
  b.blocker(B.minX - 2, 0, B.maxZ, B.maxX + 2, 30, B.maxZ + 2);
  b.blocker(B.minX - 2, 0, B.minZ, B.minX, 30, B.maxZ);
  b.blocker(B.maxX, 0, B.minZ, B.maxX + 2, 30, B.maxZ);

  buildRailYard(b);
  buildWarehouse(b);
  buildMaintenance(b);
  buildContainers(b);
  buildWestDock(b);
  buildEastDepot(b);
  buildYards(b);
  buildLightPoles(b);
  buildBackdrop(b);
  buildSigns(b);

  // ---------------- spawns ----------------
  const W = [[-44, -22], [-44, 22], [-42.5, -15], [-42.5, 15], [-36.5, -5], [-36.5, 5], [-43.5, -6.5, 1.2], [-43.5, 6.5, 1.2], [-42, -30], [-42, 30], [-36, 27], [-36, -27]];
  for (const [x, z, y] of W) b.spawn(0, x, z, -Math.PI / 2, y || 0);
  const E = [[44, -22], [44, 22], [38.5, -16.5], [38.5, 16.5], [37, -4.2], [37, 4.2], [45, -2], [45, 2], [42, -30], [42, 30], [36, 27], [36, -27]];
  for (const [x, z] of E) b.spawn(1, x, z, Math.PI / 2);
  // neutral flank spawns (used when the spawn logic flips sides)
  const N = [[-28, 32], [28, 32], [-30, -32.5], [30, -32.5], [-27, 4], [27, -4]];
  for (const [x, z] of N) b.spawn(-1, x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);

  // ---------------- bot hotspots ----------------
  b.hotspot(0, -3.5, 'Control Booth', 3);
  b.hotspot(-8, 23, 'Warehouse West', 2);
  b.hotspot(8, 23, 'Warehouse East', 2);
  b.hotspot(-4.5, -23, 'Maintenance West', 2);
  b.hotspot(4.5, -23, 'Maintenance East', 2);
  b.hotspot(-21, -19, 'Containers West', 1.5);
  b.hotspot(21, -19, 'Containers East', 1.5);
  b.hotspot(0, 34, 'North Alley', 1);
  b.hotspot(0, -32.5, 'South Road', 1);
  b.hotspot(-27, 22, 'West Yard', 1);
  b.hotspot(27, 22, 'East Yard', 1);
  b.hotspot(-14, 0.5, 'Rail West', 1.5);
  b.hotspot(14, -0.5, 'Rail East', 1.5);

  b.label(0, 24, 'WAREHOUSE');
  b.label(0, -23.5, 'MAINT.');
  b.label(0, 0, 'BOOTH');
  b.label(-41, 0, 'DOCK');
  b.label(42, 0, 'DEPOT');
}

/** Wall running along X at depth z (thickness t), with openings {a,b,y0,y1}. */
function wallX(b, z, x0, x1, h, t, mat, openings = [], opts = {}) {
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let cur = x0;
  const z0 = z - t / 2, z1 = z + t / 2;
  for (const o of ops) {
    if (o.a > cur) b.box(cur, 0, z0, o.a, h, z1, mat, opts);
    const y0 = o.y0 || 0, y1 = o.y1 ?? 3;
    if (y0 > 0) b.box(o.a, 0, z0, o.b, y0, z1, mat, { ...opts, map: false });
    if (y1 < h) b.box(o.a, y1, z0, o.b, h, z1, mat, { ...opts, map: false });
    cur = o.b;
  }
  if (cur < x1) b.box(cur, 0, z0, x1, h, z1, mat, opts);
}
function wallZ(b, x, z0, z1, h, t, mat, openings = [], opts = {}) {
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let cur = z0;
  const x0 = x - t / 2, x1 = x + t / 2;
  for (const o of ops) {
    if (o.a > cur) b.box(x0, 0, cur, x1, h, o.a, mat, opts);
    const y0 = o.y0 || 0, y1 = o.y1 ?? 3;
    if (y0 > 0) b.box(x0, 0, o.a, x1, y0, o.b, mat, { ...opts, map: false });
    if (y1 < h) b.box(x0, y1, o.a, x1, h, o.b, mat, { ...opts, map: false });
    cur = o.b;
  }
  if (cur < z1) b.box(x0, 0, cur, x1, h, z1, mat, opts);
}

function crate(b, x, y, z, s = 1.2, mat = 'wood') {
  b.boxC(x, y, z, s, s, s, mat);
  // frame trim
  if (!b.headless) {
    const t = 0.06;
    b.addVisual(worldBoxGeometry(x - s / 2 - 0.01, y, z - s / 2 - 0.01, x + s / 2 + 0.01, y + t, z + s / 2 + 0.01, 1), 'wood');
    b.addVisual(worldBoxGeometry(x - s / 2 - 0.01, y + s - t, z - s / 2 - 0.01, x + s / 2 + 0.01, y + s, z + s / 2 + 0.01, 1), 'wood');
  }
}
function pallet(b, x, z, stack = 1, rot = false) {
  const sx = rot ? 1.0 : 1.2, sz = rot ? 1.2 : 1.0;
  b.boxC(x, 0, z, sx, 0.14 * stack + 0.02, sz, 'wood', { map: false });
}
function barrier(b, x, z, alongX = true, len = 3) {
  // jersey barrier: wide base, narrow top
  const sx = alongX ? len : 0.62, sz = alongX ? 0.62 : len;
  b.boxC(x, 0, z, sx, 0.3, sz, 'concrete', { map: false });
  b.boxC(x, 0.3, z, alongX ? len : 0.4, 0.55, alongX ? 0.4 : len, 'concrete', { map: 'low' });
}
function barrel(b, x, z, mat = 'steel_green') {
  b.cylinder(x, 0, z, 0.3, 0.9, mat, { seg: 12 });
}

// ---------------- rail yard ----------------
function buildRailYard(b) {
  const tracks = [-7, 7];
  for (const tz of tracks) {
    // ballast bed
    b.box(-37, 0, tz - 1.7, 37, 0.05, tz + 1.7, 'ballast', { collide: false });
    // rails
    for (const off of [-0.72, 0.72]) {
      b.box(-37, 0.05, tz + off - 0.04, 37, 0.2, tz + off + 0.04, 'metal', { collide: false });
    }
    // buffer stops
    b.boxC(-37.6, 0, tz, 1.0, 1.1, 2.6, 'hazard');
    b.boxC(37.6, 0, tz, 1.0, 1.1, 2.6, 'hazard');
  }
  // sleepers (instanced)
  if (!b.headless) {
    const e = b.materials.get('wood');
    const geom = worldBoxGeometry(-0.13, 0.03, -1.25, 0.13, 0.1, 1.25, 1);
    const count = tracks.length * Math.floor(74 / 0.7);
    const im = new THREE.InstancedMesh(geom, e.mat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const tz of tracks) for (let x = -36.8; x < 37 && i < count; x += 0.7) { m.makeTranslation(x, 0, tz); im.setMatrixAt(i++, m); }
    im.count = i;
    im.receiveShadow = true;
    b.addObject(im);
  }

  // boxcars: body raised on bogies (gap below lets bullets/sight through at ankle height)
  boxcar(b, -19.5, 7, 13, 'corrugated_tan');
  boxcar(b, 14.5, 7, 13, 'rust');
  boxcar(b, -14.5, -7, 13, 'rust');
  flatcar(b, 19.5, -7, 13);

  // central control booth
  const cx = 0, cz = 0, s = 3.4, h = 2.8, t = 0.2;
  const win = (a, bb) => ({ a, b: bb, y0: 1.05, y1: 2.05 });
  wallX(b, cz - s / 2, cx - s / 2, cx + s / 2, h, t, 'brick', [win(-1.0, 1.0)]);
  wallX(b, cz + s / 2, cx - s / 2, cx + s / 2, h, t, 'brick', [win(-1.0, 1.0)]);
  wallZ(b, cx - s / 2, cz - s / 2 + t / 2, cz + s / 2 - t / 2, h, t, 'brick', [{ a: -0.5, b: 0.5, y1: 2.1 }]);
  wallZ(b, cx + s / 2, cz - s / 2 + t / 2, cz + s / 2 - t / 2, h, t, 'brick', [{ a: -0.5, b: 0.5, y1: 2.1 }]);
  b.box(cx - s / 2 - 0.25, h, cz - s / 2 - 0.25, cx + s / 2 + 0.25, h + 0.22, cz + s / 2 + 0.25, 'concrete_dark');
  b.box(cx - 1.4, 0, cz - 0.5 - 0.3, cx - 0.2, 0.9, cz - 0.5 + 0.3, 'metal'); // console
  b.box(cx - s / 2 + 0.1, 0, cz - s / 2 + 0.1, cx + s / 2 - 0.1, 0.02, cz + s / 2 - 0.1, 'floor_in', { collide: false });
  // barriers around center
  barrier(b, -6.5, -2.2, false);
  barrier(b, 6.5, 2.2, false);
  barrier(b, -3.5, 3.6, true);
  barrier(b, 3.5, -3.6, true);
  barrier(b, -10.5, 2.8, true);
  barrier(b, 10.5, -2.8, true);
  barrel(b, 2.6, 2.6); barrel(b, 3.2, 2.9, 'rust');
  barrel(b, -2.6, -2.6, 'rust');
  crate(b, -9, 0, -3.2); crate(b, 9, 0, 3.2);
  crate(b, -24, 0, 0.6); crate(b, -24, 0, -0.8, 1.2, 'wood'); crate(b, -23.4, 1.2, 0, 1.0);
  crate(b, 24, 0, -0.6); crate(b, 24.8, 0, 0.8);
  barrier(b, -18, -1, true); barrier(b, 18, 1, true);
  barrier(b, -30, 2, false); barrier(b, 30, -2, false);

  // signal gantry over the tracks (landmark)
  const gx = 0;
  for (const z of [-10.6, 10.6]) b.boxC(gx, 0, z, 0.45, 7.2, 0.45, 'steel_yellow');
  b.box(gx - 0.35, 6.6, -10.9, gx + 0.35, 7.3, 10.9, 'steel_yellow', { map: false });
  for (const tz of [-7, 7]) {
    b.boxC(gx, 5.2, tz, 0.6, 1.4, 0.5, 'black', { collide: false });
    b.boxC(gx + 0.31, 5.95, tz, 0.04, 0.22, 0.22, 'lamp_red', { collide: false });
    b.boxC(gx + 0.31, 5.45, tz, 0.04, 0.22, 0.22, 'lamp_green', { collide: false });
    b.boxC(gx - 0.31, 5.95, tz, 0.04, 0.22, 0.22, 'lamp_red', { collide: false });
    b.boxC(gx - 0.31, 5.45, tz, 0.04, 0.22, 0.22, 'lamp_green', { collide: false });
    b.box(gx - 0.05, 6.6, tz - 0.05, gx + 0.05, 6.6 + 0.01, tz + 0.05, 'black', { collide: false });
    b.box(gx - 0.04, 6.0, tz - 0.04, gx + 0.04, 6.6, tz + 0.04, 'black', { collide: false });
  }
}

function boxcar(b, cx, cz, len, mat) {
  const w = 2.9, x0 = cx - len / 2, x1 = cx + len / 2;
  // bogies + wheels
  for (const bx of [x0 + 2, x1 - 2]) {
    b.box(bx - 1.3, 0.2, cz - 1.1, bx + 1.3, 0.95, cz + 1.1, 'rust', { map: false });
    for (const ox of [-0.8, 0.8]) for (const oz of [-1.12, 1.12]) b.hcylinder(bx + ox, 0.45, cz + oz, 0.42, 0.12, false, 'metal', { collide: false, caps: false, seg: 12 });
  }
  // underframe
  b.box(x0, 0.95, cz - w / 2 + 0.1, x1, 1.15, cz + w / 2 - 0.1, 'metal', { map: false });
  // body
  b.box(x0, 1.15, cz - w / 2, x1, 4.1, cz + w / 2, mat, { map: 'container' });
  // roof
  b.box(x0 - 0.05, 4.1, cz - w / 2 - 0.05, x1 + 0.05, 4.25, cz + w / 2 + 0.05, 'roof', { map: false });
  // sliding doors & ladders (visual)
  for (const side of [-1, 1]) {
    const z = cz + side * (w / 2 + 0.03);
    b.box(cx - 1.6, 1.25, z - 0.03, cx + 1.6, 3.9, z + 0.03, 'steel_green', { collide: false });
    b.box(cx - 1.8, 3.9, z - 0.06, cx + 1.8, 4.0, z + 0.06, 'metal', { collide: false });
    for (let k = 0; k < 6; k++) b.box(x0 + 0.3, 1.4 + k * 0.45, z - 0.05, x0 + 0.8, 1.44 + k * 0.45, z + 0.05, 'metal', { collide: false });
  }
  // couplers
  b.box(x0 - 0.6, 0.8, cz - 0.15, x0, 1.05, cz + 0.15, 'metal', { map: false });
  b.box(x1, 0.8, cz - 0.15, x1 + 0.6, 1.05, cz + 0.15, 'metal', { map: false });
}

function flatcar(b, cx, cz, len) {
  const w = 2.9, x0 = cx - len / 2, x1 = cx + len / 2;
  for (const bx of [x0 + 2, x1 - 2]) b.box(bx - 1.3, 0.2, cz - 1.1, bx + 1.3, 0.95, cz + 1.1, 'rust', { map: false });
  b.box(x0, 0.95, cz - w / 2, x1, 1.25, cz + w / 2, 'wood', { map: 'low' });
  // lumber/steel load with gaps to climb between
  b.box(x0 + 0.5, 1.25, cz - 1.25, x0 + 4.5, 2.45, cz + 1.25, 'wood', { map: 'container' });
  b.box(x1 - 4.5, 1.25, cz - 1.25, x1 - 0.5, 2.15, cz + 1.25, 'metal', { map: 'container' });
  b.box(cx - 1.2, 1.25, cz - 0.9, cx + 1.2, 2.0, cz + 0.9, 'wood', { map: 'low' });
}

// ---------------- warehouse ----------------
function buildWarehouse(b) {
  const x0 = -20, x1 = 20, z0 = 16, z1 = 32, H = 7, t = 0.3;
  const door = (a, bb, y1 = 3.6) => ({ a, b: bb, y1 });
  wallX(b, z0, x0, x1, H, t, 'corrugated_blue', [door(-14, -10), door(-2, 2, 3.2), door(10, 14)]);
  wallX(b, z1, x0, x1, H, t, 'corrugated_blue', [door(-2, 2, 3.0)]);
  wallZ(b, x0, z0 + t / 2, z1 - t / 2, H, t, 'corrugated_blue', [door(22, 26, 3.4)]);
  wallZ(b, x1, z0 + t / 2, z1 - t / 2, H, t, 'corrugated_blue', [door(22, 26, 3.4)]);
  // concrete plinth
  b.box(x0 - 0.2, 0, z0 - 0.2, x0 + 0.2, 0.6, z0 + 0.0, 'concrete', { collide: false });
  // roof
  b.box(x0 - 0.4, H, z0 - 0.4, x1 + 0.4, H + 0.3, z1 + 0.4, 'roof', { map: false });
  // floor
  b.box(x0 + t / 2, 0, z0 + t / 2, x1 - t / 2, 0.015, z1 - t / 2, 'floor_in', { collide: false });
  // roll-up door housings
  for (const dx of [-12, 12]) b.box(dx - 2.2, 3.6, z0 - 0.6, dx + 2.2, 4.2, z0 - 0.15, 'metal', { map: false });
  // windows high on south wall (visual)
  for (let x = -18; x <= 18; x += 4) {
    if (Math.abs(x) < 3 || Math.abs(Math.abs(x) - 12) < 3) continue;
    b.box(x - 1.2, 4.6, z0 - 0.17, x + 1.2, 5.6, z0 - 0.16, 'window_dark', { collide: false });
  }
  // ceiling beams
  for (let x = -16; x <= 16; x += 8) b.box(x - 0.15, H - 0.6, z0, x + 0.15, H, z1, 'steel_yellow', { collide: false });

  // racks (pallet racking) — solid for collision, detailed visually
  rack(b, -15.5, 19.2, 26.8, 'z');
  rack(b, -6.2, 18.8, 24.6, 'z');
  rack(b, 6.2, 18.8, 24.6, 'z');
  rack(b, 16.0, 17.6, 22.0, 'z');
  // crates
  crate(b, -10.2, 0, 29.6); crate(b, -9.0, 0, 29.6); crate(b, -9.6, 1.2, 29.6);
  crate(b, -1.5, 0, 20.6, 1.0); crate(b, 1.4, 0, 21.6, 1.2);
  crate(b, 10.8, 0, 29.8); crate(b, 9.6, 0, 30.2, 1.0);
  crate(b, -18.4, 0, 30.4); crate(b, -18.4, 0, 17.8);
  pallet(b, -3.2, 29.5, 2); pallet(b, 3.4, 18.6, 3);
  // forklift
  b.boxC(-1.6, 0, 26.8, 1.3, 1.25, 2.3, 'steel_yellow');
  b.boxC(-1.6, 1.25, 27.3, 1.2, 1.0, 1.0, 'black', { collide: false });
  b.box(-2.15, 0, 25.4, -2.05, 2.3, 25.5, 'metal', { collide: false });
  b.box(-1.15, 0, 25.4, -1.05, 2.3, 25.5, 'metal', { collide: false });
  b.box(-2.2, 0.08, 24.4, -1.0, 0.14, 25.4, 'metal', { collide: false });
  // office (NE corner)
  const oz = 26, ox = 13, oh = 3.0;
  wallX(b, oz, ox, x1 - t / 2, oh, 0.2, 'concrete', [{ a: 15, b: 18, y0: 1.0, y1: 2.1 }]);
  wallZ(b, ox, oz + 0.1, z1 - t / 2, oh, 0.2, 'concrete', [{ a: 27.2, b: 28.6, y1: 2.2 }]);
  b.box(ox - 0.1, oh, oz - 0.1, x1 - t / 2, oh + 0.15, z1 - t / 2, 'concrete_dark', { map: false });
  b.boxC(16.5, 0, 30.6, 2.0, 0.78, 0.9, 'wood'); // desk
  b.boxC(19.2, 0, 28.0, 0.6, 1.4, 0.9, 'steel_green'); // cabinet
  // lights
  for (const [x, z] of [[-10, 20], [-10, 28], [0, 24], [10, 20], [10, 28]]) {
    b.box(x - 0.8, H - 0.75, z - 0.15, x + 0.8, H - 0.7, z + 0.15, 'lamp', { collide: false });
  }
  b.pointLight(-9, 5.8, 24, 0xffd9a0, 18, 18);
  b.pointLight(9, 5.8, 24, 0xffd9a0, 18, 18);
}

function rack(b, x, za, zb, axis) {
  const depth = 1.1, h = 2.7;
  // collision: lower solid part + upper shelf (gap in the middle shelf lets you see through at chest height? keep solid for fairness)
  b.box(x - depth / 2, 0, za, x + depth / 2, h, zb, null, { visual: false, map: 'solid' });
  if (b.headless) return;
  // posts
  for (let z = za; z <= zb + 0.01; z += (zb - za) / 3) {
    for (const ox of [-depth / 2, depth / 2 - 0.08]) b.addVisual(worldBoxGeometry(x + ox, 0, z - 0.04, x + ox + 0.08, h, z + 0.04, 1), 'steel_yellow');
  }
  // shelves
  for (const y of [0.1, 1.35, 2.55]) b.addVisual(worldBoxGeometry(x - depth / 2, y, za, x + depth / 2, y + 0.1, zb, 1), 'steel_green');
  // goods
  let seed = Math.abs(Math.floor(x * 13 + za * 7));
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const y of [0.2, 1.45]) {
    for (let z = za + 0.1; z < zb - 0.9; z += 1.15) {
      const hh = 0.6 + r() * 0.5;
      b.addVisual(worldBoxGeometry(x - depth / 2 + 0.05, y, z, x + depth / 2 - 0.05, y + hh, z + 1.0, 1.2), r() > 0.4 ? 'wood' : 'corrugated_tan');
    }
  }
}

// ---------------- maintenance building ----------------
function buildMaintenance(b) {
  const x0 = -9, x1 = 9, z0 = -28, z1 = -19, H = 4.6, t = 0.3;
  const win = (a, bb) => ({ a, b: bb, y0: 1.0, y1: 2.1 });
  const door = (a, bb) => ({ a, b: bb, y1: 2.4 });
  wallX(b, z1, x0, x1, H, t, 'brick', [door(-6, -4.4), win(-2.6, -1.0), win(1.0, 2.6), door(4.4, 6)]);
  wallX(b, z0, x0, x1, H, t, 'brick', [win(-6.2, -4.2), door(-1.2, 0.4), win(3.4, 5.4), door(6.4, 8)]);
  wallZ(b, x0, z0 + t / 2, z1 - t / 2, H, t, 'brick', [door(-24.4, -22.8)]);
  wallZ(b, x1, z0 + t / 2, z1 - t / 2, H, t, 'brick', [door(-25.6, -24)]);
  // interior dividing wall with doorway
  wallZ(b, 1.6, z0 + t / 2, z1 - t / 2, H, 0.24, 'concrete', [door(-23.8, -22.2)]);
  b.box(x0 - 0.3, H, z0 - 0.3, x1 + 0.3, H + 0.3, z1 + 0.3, 'concrete_dark', { map: false });
  b.box(x0 - 0.35, H + 0.3, z0 - 0.35, x1 + 0.35, H + 0.5, z1 + 0.35, 'roof', { collide: false });
  b.box(x0 + t / 2, 0, z0 + t / 2, x1 - t / 2, 0.015, z1 - t / 2, 'floor_in', { collide: false });
  // workbenches & equipment
  b.boxC(-6.5, 0, -27.1, 3.0, 0.9, 0.9, 'metal');
  b.boxC(-8.2, 0, -21.5, 0.8, 1.9, 2.2, 'steel_green'); // tool cabinet
  b.boxC(-3.2, 0, -23.6, 1.4, 1.0, 1.2, 'rust'); // engine block
  b.boxC(5.0, 0, -22.0, 2.2, 1.0, 1.4, 'steel_yellow'); // rail cart
  b.boxC(7.9, 0, -27.0, 1.6, 1.8, 1.0, 'steel_green');
  b.boxC(3.4, 0, -27.2, 2.2, 0.9, 0.8, 'metal');
  barrel(b, -0.4, -20.0, 'rust'); barrel(b, 0.3, -20.3);
  for (const [x, z] of [[-4, -23.5], [5, -23.5]]) b.box(x - 0.7, H - 0.12, z - 0.12, x + 0.7, H - 0.06, z + 0.12, 'lamp', { collide: false });
  b.pointLight(-4, 3.8, -23.5, 0xffe6c0, 9, 10);
  b.pointLight(5, 3.8, -23.5, 0xffe6c0, 9, 10);
}

// ---------------- containers ----------------
function buildContainers(b) {
  const H = 2.59;
  // west block
  b.container(-24, 0, -15.6, 12.2, true, 'blue');
  b.container(-26.5, H, -15.6, 6.1, true, 'red');
  b.container(-14.2, 0, -22.3, 6.1, false, 'green');
  b.container(-22.5, 0, -21.6, 6.1, true, 'orange');
  b.container(-30.2, 0, -23.0, 12.2, false, 'grey');
  b.container(-30.2, H, -20.0, 6.1, false, 'white');
  b.container(-21.0, 0, -27.0, 12.2, true, 'red');
  b.container(-19.0, H, -27.0, 6.1, true, 'blue');
  // east block
  b.container(24, 0, -15.6, 12.2, true, 'green');
  b.container(14.2, 0, -22.4, 6.1, false, 'red');
  b.container(22.5, 0, -21.2, 6.1, true, 'blue');
  b.container(22.5, H, -21.2, 6.1, true, 'grey');
  b.container(30.2, 0, -23.2, 12.2, false, 'orange');
  b.container(21.0, 0, -27.0, 12.2, true, 'grey');
  b.container(24.0, H, -27.0, 6.1, true, 'green');
  // south road cover (long sightline broken up a little)
  barrier(b, -15, -32.6, true); barrier(b, 13, -33.3, true);
  barrier(b, -34, -31.8, false); barrier(b, 34, -31.8, false);
  crate(b, -27, 0, -19.4); crate(b, -26.2, 0, -18.2, 1.0);
  crate(b, 27, 0, -18.8); crate(b, 18.2, 0, -18.4, 1.0);
  barrel(b, 0.2, -31.0); barrel(b, 0.9, -31.4, 'rust'); barrel(b, 0.4, -32.0, 'steel_yellow');
  pallet(b, -6.5, -34.4, 4); pallet(b, 7.8, -34.6, 3);
  // concrete pads under container stacks
  b.box(-34, 0, -30, -11, 0.025, -13, 'concrete', { collide: false, map: false });
  b.box(11, 0, -30, 34, 0.025, -13, 'concrete', { collide: false, map: false });
}

// ---------------- west dock (WARDEN staging) ----------------
function buildWestDock(b) {
  const x0 = -48, x1 = -41.2, z0 = -10, z1 = 10, h = 1.2;
  b.box(x0, 0, z0, x1, h, z1, 'concrete', { map: 'low' });
  b.box(x1 - 0.02, h - 0.2, z0, x1 + 0.02, h, z1, 'hazard', { collide: false });
  // dock bumpers
  for (let z = z0 + 2; z < z1; z += 4) b.box(x1, 0.3, z - 0.3, x1 + 0.15, 0.9, z + 0.3, 'rubber', { map: false });
  // side stairs (north and south ends) — 4 x 0.24 m rise, 0.5 m run
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const za = sz > 0 ? z1 + i * 0.5 : z0 - (i + 1) * 0.5;
      b.box(x1 - 2.6, 0, za, x1 - 0.2, h - (i + 1) * 0.24, za + 0.5, 'concrete', { map: false });
    }
  }
  // front stairs (east side)
  for (let i = 0; i < 4; i++) {
    b.box(x1 + i * 0.5, 0, -1.4, x1 + (i + 1) * 0.5, h - i * 0.24 - 0.24, 1.4, 'concrete', { map: false });
  }
  // railing posts
  for (let z = z0; z <= z1; z += 2.5) {
    if (Math.abs(z) < 2) continue;
    b.box(x1 - 0.1, h, z - 0.04, x1 - 0.02, h + 1.0, z + 0.04, 'steel_yellow', { collide: false });
  }
  // freight office on dock (back), canopy
  b.box(x0, h, -4, x0 + 3.2, h + 3.0, 4, 'corrugated_green', { map: 'solid' });
  b.box(x0, 4.6, z0, x1 + 1.6, 4.8, z1, 'roof', { map: false });
  for (const z of [z0 + 0.2, -2.3, 2.3, z1 - 0.2]) b.box(x1 + 1.3, 0, z - 0.12, x1 + 1.55, 4.6, z + 0.12, 'steel_yellow', { map: false });
  b.pointLight(-44, 4.2, 0, 0xffe8c8, 6, 12);
  // crates on dock
  crate(b, -46.8, h, -8.2); crate(b, -45.6, h, -8.2, 1.0); crate(b, -46.8, h, 8.4);
  // trailer backed into the yard
  trailer(b, -38.8, 17.6, 'z');
  trailer(b, -38.8, -17.6, 'z');
  barrier(b, -36.2, -10.5, false); barrier(b, -36.2, 10.5, false);
}

function trailer(b, cx, cz, axis) {
  const len = 11, w = 2.5, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - len / 2, z1 = cz + len / 2;
  b.box(x0, 1.15, z0, x1, 4.0, z1, 'corrugated_tan', { map: 'container' });
  b.box(x0 + 0.1, 0.25, z0 + 0.6, x1 - 0.1, 1.15, z0 + 2.6, 'black', { map: false }); // wheels block
  b.box(x0 + 0.3, 0, z1 - 2.6, x0 + 0.5, 1.15, z1 - 2.4, 'metal', { map: false }); // landing legs
  b.box(x1 - 0.5, 0, z1 - 2.6, x1 - 0.3, 1.15, z1 - 2.4, 'metal', { map: false });
}

// ---------------- east depot (SABLE staging) ----------------
function buildEastDepot(b) {
  for (const tz of [-12, 12]) {
    // saddles
    for (const dz of [-3, 0, 3]) b.boxC(42.5, 0, tz + dz, 3.0, 0.9, 0.6, 'concrete');
    b.hcylinder(42.5, 2.35, tz, 1.55, 9.0, false, 'tank_white');
    // bund wall
    b.box(39.6, 0, tz - 6, 39.9, 0.8, tz + 6, 'concrete', { map: 'low' });
    b.box(39.6, 0, tz + (tz > 0 ? 6 : -6) - 0.15, 46, 0.8, tz + (tz > 0 ? 6 : -6) + 0.15, 'concrete', { map: 'low' });
    // pipe
    b.box(40.0, 0.4, tz - 0.08, 47.9, 0.56, tz + 0.08, 'metal', { collide: false });
  }
  // pump house
  const x0 = 38.5, x1 = 42.5, z0 = -3.2, z1 = 3.2, H = 3.2, t = 0.25;
  wallZ(b, x0, z0, z1, H, t, 'corrugated_green', [{ a: -0.8, b: 0.8, y1: 2.3 }]);
  wallZ(b, x1, z0, z1, H, t, 'corrugated_green', [{ a: -0.8, b: 0.8, y1: 2.3 }]);
  wallX(b, z0, x0, x1, H, t, 'corrugated_green', [{ a: 39.6, b: 41.4, y0: 1.1, y1: 2.0 }]);
  wallX(b, z1, x0, x1, H, t, 'corrugated_green', [{ a: 39.6, b: 41.4, y0: 1.1, y1: 2.0 }]);
  b.box(x0 - 0.3, H, z0 - 0.3, x1 + 0.3, H + 0.2, z1 + 0.3, 'roof', { map: false });
  b.boxC(40.5, 0, 1.9, 1.6, 1.1, 0.9, 'steel_yellow');
  // fuel island & barriers
  barrier(b, 36.2, -10.5, false); barrier(b, 36.2, 10.5, false);
  barrel(b, 36.8, -1.0, 'steel_yellow'); barrel(b, 36.9, -0.2, 'steel_yellow');
  crate(b, 45.8, 0, 6.2); crate(b, 45.8, 0, -6.4); crate(b, 46.4, 1.2, -6.4, 1.0);
}

// ---------------- open yards (NW / NE) ----------------
function buildYards(b) {
  // NW yard
  crate(b, -30, 0, 14.6); crate(b, -28.8, 0, 14.6); crate(b, -29.4, 1.2, 14.6);
  b.cylinder(-26, 0, 27, 1.0, 1.4, 'wood', { seg: 14 }); // cable reel
  b.cylinder(-24.2, 0, 29.4, 0.8, 1.2, 'wood', { seg: 14 });
  barrier(b, -30, 21.5, true); barrier(b, -23, 18.5, false);
  b.boxC(-33, 0, 33.6, 2.2, 1.5, 1.4, 'steel_green'); // dumpster
  // shed
  b.box(-34, 0, 25, -30.5, 2.8, 29, 'corrugated_tan', { map: 'solid' });
  b.box(-34.2, 2.8, 24.8, -30.3, 3.0, 29.2, 'roof', { map: false });
  // NE yard
  crate(b, 30, 0, 14.4); crate(b, 31.2, 0, 14.4, 1.0);
  b.cylinder(26.4, 0, 26.0, 1.0, 1.4, 'wood', { seg: 14 });
  barrier(b, 30, 21.0, true); barrier(b, 23.2, 18.0, false);
  b.boxC(33.0, 0, 33.6, 2.2, 1.5, 1.4, 'steel_green');
  b.box(30.5, 0, 25, 34, 2.8, 29.5, 'corrugated_green', { map: 'solid' });
  b.box(30.3, 2.8, 24.8, 34.2, 3.0, 29.7, 'roof', { map: false });
  // north alley clutter
  b.boxC(-10, 0, 34.4, 2.2, 1.5, 1.4, 'steel_green');
  pallet(b, 7.2, 34.6, 5); crate(b, 13.5, 0, 34.8, 1.0);
  b.box(-48, 3.2, 35.6, 48, 3.45, 35.85, 'metal', { collide: false }); // pipe along wall
}

function buildLightPoles(b) {
  const poles = [[-34, 12.5], [34, -12.5], [-34, -12.5], [34, 12.5], [0, 13], [0, -15], [-22, 35], [22, 35], [-24, -34.5], [24, -34.5]];
  for (const [x, z] of poles) {
    b.boxC(x, 0, z, 0.3, 9, 0.3, 'metal', { map: false });
    b.boxC(x, 9, z, 1.4, 0.25, 0.5, 'metal', { collide: false });
    b.box(x - 0.6, 8.94, z - 0.2, x + 0.6, 8.98, z + 0.2, 'lamp', { collide: false });
  }
}

function buildBackdrop(b) {
  if (b.headless) return;
  // distant industrial silhouettes beyond the walls
  const R = (s) => { let x = s; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
  const r = R(7);
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    const along = -70 + r() * 140;
    const dist = 58 + r() * 22;
    const w = 8 + r() * 18, d = 8 + r() * 14, h = 6 + r() * 16;
    let x, z;
    if (side === 0) { x = along; z = dist; } else if (side === 1) { x = along; z = -dist; } else if (side === 2) { x = dist + 4; z = along * 0.7; } else { x = -dist - 4; z = along * 0.7; }
    b.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, i % 3 ? 'backdrop' : 'backdrop2', { collide: false });
  }
  // gantry cranes (far north)
  for (const cx of [-30, 18]) {
    for (const ox of [-6, 6]) b.box(cx + ox - 0.5, 0, 62, cx + ox + 0.5, 22, 63, 'steel_yellow', { collide: false });
    b.box(cx - 14, 20, 61.5, cx + 14, 22.5, 63.5, 'steel_yellow', { collide: false });
  }
  // water tower (east)
  b.cylinder(72, 0, -20, 0.6, 14, 'metal', { collide: false });
  b.cylinder(72, 14, -20, 4.0, 5, 'tank_white', { collide: false, seg: 20 });
  // chimney stack
  b.cylinder(-74, 0, 30, 2.4, 34, 'brick', { collide: false, rTop: 1.8, seg: 18 });
}

function buildSigns(b) {
  if (b.headless) return;
  const sign = (text, x, y, z, w, h, rotY, opts) => {
    const tex = signTexture(text, { w: 512, h: Math.round(512 * h / w), ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    m.receiveShadow = true;
    b.addObject(m);
  };
  sign('WAREHOUSE 2', 0, 5.2, 15.83, 6, 1.1, Math.PI, { bg: '#1f3446' });
  sign('BAY 1', -12, 4.6, 15.36, 2, 0.6, Math.PI, { bg: '#c9a227', fg: '#111', size: 0.6 });
  sign('BAY 3', 12, 4.6, 15.36, 2, 0.6, Math.PI, { bg: '#c9a227', fg: '#111', size: 0.6 });
  sign('MAINTENANCE · BLDG 4', 0, 3.4, -18.83, 5.6, 0.8, 0, { bg: '#2a2a2a', size: 0.45 });
  sign('CINDER YARD — DEPOT 7', -44.78, 3.0, 0, 5.2, 0.8, Math.PI / 2, { bg: '#22313b', size: 0.42 });
  sign('NO NAKED FLAMES', 38.36, 1.7, 2.0, 1.6, 0.45, -Math.PI / 2, { bg: '#b02a1a', size: 0.42 });
  sign('PUMP HOUSE', 38.36, 2.7, 0, 2.4, 0.5, -Math.PI / 2, { bg: '#1e3a28', size: 0.5 });
  sign('CONTROL', 0, 2.45, -1.82, 1.4, 0.32, Math.PI, { bg: '#283037', size: 0.55 });
  sign('CONTROL', 0, 2.45, 1.82, 1.4, 0.32, 0, { bg: '#283037', size: 0.55 });
  sign('LINE 1', -37.08, 0.8, 7, 1.2, 0.4, Math.PI / 2, { bg: '#ddd', fg: '#222', size: 0.55 });
  sign('LINE 2', -37.08, 0.8, -7, 1.2, 0.4, Math.PI / 2, { bg: '#ddd', fg: '#222', size: 0.55 });
}
