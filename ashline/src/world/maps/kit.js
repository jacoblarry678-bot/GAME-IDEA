/**
 * Shared map-building kit: walls with openings, enterable buildings with
 * doors and windows, pitched roofs, props (cars, trees, lamps, stalls,
 * crates, barriers) and canvas signs. Everything is axis-aligned boxes for
 * collision; extra shapes are visual only.
 */
import * as THREE from 'three';
import { worldBoxGeometry } from '../mapBuilder.js';
import { signTexture } from '../textures.js';

/** Wall running along X at depth z (thickness t), with openings {a,b,y0,y1}. */
export function wallX(b, z, x0, x1, h, t, mat, openings = [], opts = {}) {
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

export function wallZ(b, x, z0, z1, h, t, mat, openings = [], opts = {}) {
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

export const door = (a, bb, y1 = 2.6) => ({ a, b: bb, y1, door: true });
export const win = (a, bb, y0 = 1.0, y1 = 2.0) => ({ a, b: bb, y0, y1 });

/**
 * Enterable building. sides: { s, n, w, e } → arrays of openings (door()/win()).
 * Adds roof (flat slab, optional gable), interior floor, facade windows above
 * the ground floor and door frames.
 */
export function building(b, o) {
  const { x0, x1, z0, z1, h, mat } = o;
  const t = o.t ?? 0.3;
  const s = o.sides || {};
  wallX(b, z0, x0, x1, h, t, mat, s.s || [], { map: 'wall' });
  wallX(b, z1, x0, x1, h, t, mat, s.n || [], { map: 'wall' });
  wallZ(b, x0, z0 + t / 2, z1 - t / 2, h, t, mat, s.w || [], { map: 'wall' });
  wallZ(b, x1, z0 + t / 2, z1 - t / 2, h, t, mat, s.e || [], { map: 'wall' });
  // ceiling of the ground floor (blocks climbing inside) + roof
  const cy = Math.min(h, o.ceilY ?? 3.6);
  b.box(x0 + t / 2, cy, z0 + t / 2, x1 - t / 2, cy + 0.2, z1 - t / 2, o.ceil || 'concrete_dark', { map: false });
  b.box(x0 - 0.25, h, z0 - 0.25, x1 + 0.25, h + 0.25, z1 + 0.25, o.cornice || 'stone', { map: false });
  if (o.gable) gable(b, x0 - 0.35, x1 + 0.35, z0 - 0.35, z1 + 0.35, h + 0.25, o.gableH ?? 2.6, o.gable === 'x', o.roof || 'tile_roof');
  if (o.floor !== false) b.box(x0 + t / 2, 0, z0 + t / 2, x1 - t / 2, 0.015, z1 - t / 2, o.floor || 'floor_in', { collide: false });
  if (b.headless) return;
  // upper-floor windows (visual) with shutters
  if (h > 5) {
    const rows = h > 8 ? [4.4, 7.0] : [4.4];
    const facade = (along, fixed, a0, a1, outward) => {
      for (let a = a0 + 1.6; a < a1 - 1.2; a += 3) {
        for (const y of rows) {
          if (y + 1.4 > h - 0.3) continue;
          const d = outward * 0.17;
          if (along === 'x') {
            b.box(a - 0.55, y, fixed + d - 0.01, a + 0.55, y + 1.3, fixed + d + 0.01, 'window_dark', { collide: false });
            b.box(a - 0.7, y - 0.12, fixed + d - 0.06, a + 0.7, y, fixed + d + 0.06, 'stone', { collide: false });
            if (o.shutters) for (const sx of [-0.85, 0.85]) b.box(a + sx - 0.28, y, fixed + d - 0.02, a + sx + 0.28, y + 1.3, fixed + d + 0.02, o.shutters, { collide: false });
          } else {
            b.box(fixed + d - 0.01, y, a - 0.55, fixed + d + 0.01, y + 1.3, a + 0.55, 'window_dark', { collide: false });
            b.box(fixed + d - 0.06, y - 0.12, a - 0.7, fixed + d + 0.06, y, a + 0.7, 'stone', { collide: false });
            if (o.shutters) for (const sx of [-0.85, 0.85]) b.box(fixed + d - 0.02, y, a + sx - 0.28, fixed + d + 0.02, y + 1.3, a + sx + 0.28, o.shutters, { collide: false });
          }
        }
      }
    };
    facade('x', z0, x0, x1, -1);
    facade('x', z1, x0, x1, 1);
    facade('z', x0, z0, z1, -1);
    facade('z', x1, z0, z1, 1);
  }
  // door frames
  const frame = (along, fixed, op) => {
    const y1 = op.y1 ?? 2.6;
    if (along === 'x') {
      for (const a of [op.a - 0.12, op.b]) b.box(a, 0, fixed - t / 2 - 0.05, a + 0.12, y1 + 0.12, fixed + t / 2 + 0.05, 'stone', { collide: false });
      b.box(op.a - 0.12, y1, fixed - t / 2 - 0.05, op.b + 0.12, y1 + 0.18, fixed + t / 2 + 0.05, 'stone', { collide: false });
    } else {
      for (const a of [op.a - 0.12, op.b]) b.box(fixed - t / 2 - 0.05, 0, a, fixed + t / 2 + 0.05, y1 + 0.12, a + 0.12, 'stone', { collide: false });
      b.box(fixed - t / 2 - 0.05, y1, op.a - 0.12, fixed + t / 2 + 0.05, y1 + 0.18, op.b + 0.12, 'stone', { collide: false });
    }
  };
  for (const op of s.s || []) if (op.door) frame('x', z0, op);
  for (const op of s.n || []) if (op.door) frame('x', z1, op);
  for (const op of s.w || []) if (op.door) frame('z', x0, op);
  for (const op of s.e || []) if (op.door) frame('z', x1, op);
}

/** Visual pitched roof (triangular prism) over a rectangle. ridge along X if alongX. */
export function gable(b, x0, x1, z0, z1, y, rise, alongX, mat) {
  if (b.headless) return;
  const g = new THREE.BufferGeometry();
  const P = [];
  const U = [];
  const quad = (a, bb, c, d, w, hgt) => { P.push(...a, ...bb, ...c, ...a, ...c, ...d); U.push(0, 0, w, 0, w, hgt, 0, 0, w, hgt, 0, hgt); };
  const tri = (a, bb, c, w, hgt) => { P.push(...a, ...bb, ...c); U.push(0, 0, w, 0, w / 2, hgt); };
  if (alongX) {
    const zm = (z0 + z1) / 2, half = (z1 - z0) / 2, slope = Math.hypot(half, rise);
    quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], (x1 - x0) / 2, slope / 2);
    quad([x1, y, z0], [x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], (x1 - x0) / 2, slope / 2);
    tri([x0, y, z0], [x0, y, z1], [x0, y + rise, zm], half, rise / 2);
    tri([x1, y, z1], [x1, y, z0], [x1, y + rise, zm], half, rise / 2);
  } else {
    const xm = (x0 + x1) / 2, half = (x1 - x0) / 2, slope = Math.hypot(half, rise);
    quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], (z1 - z0) / 2, slope / 2);
    quad([x1, y, z1], [x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], (z1 - z0) / 2, slope / 2);
    tri([x0, y, z1], [x0, y, z0], [xm, y + rise, z0], half, rise / 2);
    tri([x1, y, z0], [x1, y, z1], [xm, y + rise, z1], half, rise / 2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  b.addVisual(g, mat);
}

export function crate(b, x, y, z, s = 1.2, mat = 'wood') {
  b.boxC(x, y, z, s, s, s, mat);
  if (!b.headless) {
    const t = 0.06;
    b.addVisual(worldBoxGeometry(x - s / 2 - 0.01, y, z - s / 2 - 0.01, x + s / 2 + 0.01, y + t, z + s / 2 + 0.01, 1), 'wood');
    b.addVisual(worldBoxGeometry(x - s / 2 - 0.01, y + s - t, z - s / 2 - 0.01, x + s / 2 + 0.01, y + s, z + s / 2 + 0.01, 1), 'wood');
  }
}

export function barrier(b, x, z, alongX = true, len = 3) {
  const sx = alongX ? len : 0.62, sz = alongX ? 0.62 : len;
  b.boxC(x, 0, z, sx, 0.3, sz, 'concrete', { map: false });
  b.boxC(x, 0.3, z, alongX ? len : 0.4, 0.55, alongX ? 0.4 : len, 'concrete', { map: 'low' });
}

export function sandbags(b, x, z, alongX = true, len = 2.4) {
  const sx = alongX ? len : 0.8, sz = alongX ? 0.8 : len;
  b.boxC(x, 0, z, sx, 0.95, sz, 'dirt', { map: 'low' });
}

export function barrel(b, x, z, mat = 'steel_green') { b.cylinder(x, 0, z, 0.3, 0.9, mat, { seg: 12 }); }

/** Parked car: solid body, bullets pass the cabin glass only above the doors. */
export function car(b, x, z, alongX, mat = 'steel_green') {
  const L = 4.3, W = 1.8;
  const sx = alongX ? L : W, sz = alongX ? W : L;
  b.boxC(x, 0.25, z, sx, 0.85, sz, mat, { map: 'low' });
  b.boxC(x, 0, z, sx - 0.6, 0.25, sz - 0.6, 'black', { map: false, bullet: false, sight: false });
  const cx = alongX ? 2.2 : W - 0.1, cz = alongX ? W - 0.1 : 2.2;
  b.boxC(x + (alongX ? -0.2 : 0), 1.1, z + (alongX ? 0 : -0.2), cx, 0.55, cz, 'window_dark', { map: false });
  b.boxC(x + (alongX ? -0.2 : 0), 1.65, z + (alongX ? 0 : -0.2), cx, 0.06, cz, mat, { map: false, collide: false });
  for (const a of [-1.35, 1.35]) for (const s of [-0.92, 0.92]) {
    const wx = x + (alongX ? a : s), wz = z + (alongX ? s : a);
    b.hcylinder(wx, 0.33, wz, 0.33, 0.22, !alongX, 'rubber', { collide: false, caps: false, seg: 12 });
  }
}

export function tree(b, x, z, h = 5.5, r = 2.2) {
  b.cylinder(x, 0, z, 0.2, h * 0.55, 'wood', { seg: 8 });
  if (b.headless) return;
  for (const [ox, oy, oz, s] of [[0, h * 0.75, 0, 1], [0.6, h * 0.62, 0.3, 0.7], [-0.5, h * 0.66, -0.4, 0.75]]) {
    const g = new THREE.IcosahedronGeometry(r * s, 1);
    g.translate(x + ox, oy, z + oz);
    b.addVisual(g, 'hedge');
  }
}

export function lampPost(b, x, z, h = 4.2) {
  b.boxC(x, 0, z, 0.16, h, 0.16, 'black', { map: false });
  b.boxC(x, h, z, 0.42, 0.42, 0.42, 'black', { collide: false });
  b.box(x - 0.16, h + 0.04, z - 0.16, x + 0.16, h + 0.36, z + 0.16, 'lamp', { collide: false });
}

/** Market stall: table with crates and a striped awning. */
export function stall(b, x, z, alongX = true, awning = 'awning_red') {
  const sx = alongX ? 2.4 : 1.1, sz = alongX ? 1.1 : 2.4;
  b.boxC(x, 0, z, sx, 0.95, sz, 'wood', { map: 'low' });
  if (b.headless) return;
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.boxC(x + px * (sx / 2 - 0.05), 0.95, z + pz * (sz / 2 - 0.05), 0.07, 1.35, 0.07, 'wood', { collide: false });
  b.box(x - sx / 2 - 0.25, 2.3, z - sz / 2 - 0.25, x + sx / 2 + 0.25, 2.36, z + sz / 2 + 0.25, awning, { collide: false });
  for (let i = 0; i < 3; i++) b.boxC(x + (alongX ? -0.7 + i * 0.7 : 0), 0.95, z + (alongX ? 0 : -0.7 + i * 0.7), 0.5, 0.25, 0.4, i % 2 ? 'wood' : 'hazard', { collide: false });
}

export function planter(b, x, z, alongX = true, len = 2.4) {
  const sx = alongX ? len : 0.9, sz = alongX ? 0.9 : len;
  b.boxC(x, 0, z, sx, 0.7, sz, 'stone', { map: 'low' });
  b.boxC(x, 0.7, z, sx - 0.2, 0.45, sz - 0.2, 'hedge', { map: false, bullet: false });
}

/** Canvas sign plane. */
export function sign(b, text, x, y, z, w, h, rotY, opts = {}) {
  if (b.headless) return;
  const tex = signTexture(text, { w: 512, h: Math.round(512 * h / w), ...opts });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  m.position.set(x, y, z); m.rotation.y = rotY;
  m.receiveShadow = true;
  b.addObject(m);
}

/** Perimeter walls + invisible high boundary. */
export function perimeter(b, B, h, mat, skip = []) {
  if (!skip.includes('s')) b.box(B.minX - 0.6, 0, B.minZ - 0.6, B.maxX + 0.6, h, B.minZ, mat, { map: 'wall' });
  if (!skip.includes('n')) b.box(B.minX - 0.6, 0, B.maxZ, B.maxX + 0.6, h, B.maxZ + 0.6, mat, { map: 'wall' });
  if (!skip.includes('w')) b.box(B.minX - 0.6, 0, B.minZ, B.minX, h, B.maxZ, mat, { map: 'wall' });
  if (!skip.includes('e')) b.box(B.maxX, 0, B.minZ, B.maxX + 0.6, h, B.maxZ, mat, { map: 'wall' });
  b.blocker(B.minX - 2, 0, B.minZ - 2, B.maxX + 2, 30, B.minZ);
  b.blocker(B.minX - 2, 0, B.maxZ, B.maxX + 2, 30, B.maxZ + 2);
  b.blocker(B.minX - 2, 0, B.minZ, B.minX, 30, B.maxZ);
  b.blocker(B.maxX, 0, B.minZ, B.maxX + 2, 30, B.maxZ);
}

/** Distant silhouettes around the map (visual only). */
export function backdrop(b, seed, mats, minDist = 56, spread = 22, count = 26, hMin = 6, hMax = 22) {
  if (b.headless) return;
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const along = -70 + r() * 140;
    const dist = minDist + r() * spread;
    const w = 8 + r() * 16, d = 8 + r() * 12, h = hMin + r() * (hMax - hMin);
    let x, z;
    if (side === 0) { x = along; z = dist; } else if (side === 1) { x = along; z = -dist; } else if (side === 2) { x = dist + 4; z = along * 0.7; } else { x = -dist - 4; z = along * 0.7; }
    b.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, mats[i % mats.length], { collide: false });
  }
}
