/**
 * Meshes, colliders and a surface raster for one 500 m sub-tile of the real map.
 *
 *  - ground: land use polygons (parks, beaches, parking, …) over a base land fill, with
 *    the PBR ground materials tiling in world metres
 *  - roads: ribbons at their real widths (or a width by class), with sidewalks and curbs on
 *    city streets, lane markings, and decks with parapets and piers where a road is raised
 *  - buildings: real footprints extruded to their real heights, with facades picked by
 *    use and height, Miami pastels, and flat or hipped roofs
 *  - colliders: one oriented box per building wall, parapets on raised decks
 *  - raster: a 2 m surface code grid for ground queries (water, sand, grass, road, …)
 *
 * Everything is merged per material so a sub-tile is a handful of draw calls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TILE_M = { asphalt: 8, concrete: 3, sand: 5, grass: 6, pavers: 4, lot: 8, curb: 4, roof: 6, wood: 4, flats: 5 };
export const SURF = { water: 0, land: 1, grass: 2, sand: 3, road: 4, walk: 5, building: 6, park: 7, wood: 8 };
export const RASTER = 2; // metres per surface cell

/** Collects triangles per material key; uv = world metres / tile size unless given. */
class Bins {
  constructor() { this.b = new Map(); }
  get(key) { let b = this.b.get(key); if (!b) { b = { pos: [], nrm: [], uv: [], col: [] }; this.b.set(key, b); } return b; }
  tri(key, a, b, c, n, uvs, col) {
    const B = this.get(key);
    for (const [p, uv] of [[a, uvs?.[0]], [b, uvs?.[1]], [c, uvs?.[2]]]) {
      B.pos.push(p[0], p[1], p[2]); B.nrm.push(n[0], n[1], n[2]);
      const m = TILE_M[key.split(':')[0]] || 4;
      B.uv.push(uv ? uv[0] : p[0] / m, uv ? uv[1] : -p[2] / m);
      if (col) B.col.push(col.r, col.g, col.b);
    }
  }
  /** Plain typed arrays per material key (transferable from a worker). */
  arrays() {
    const out = [];
    for (const [key, B] of this.b) {
      if (!B.pos.length) continue;
      out.push({ key, pos: new Float32Array(B.pos), nrm: new Float32Array(B.nrm), uv: new Float32Array(B.uv), col: B.col.length ? new Float32Array(B.col) : null });
    }
    return out;
  }
  build(materials) {
    const out = [];
    for (const [key, B] of this.b) {
      if (!B.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      if (B.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
      g.computeBoundingSphere();
      const mat = materials(key);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.castShadow = key.startsWith('fac:') || key === 'roof' || key === 'deck' || key === 'pier';
      m.matrixAutoUpdate = false;
      m.userData.key = key;
      out.push(m);
    }
    return out;
  }
}

const UP = [0, 1, 0];

/** Triangulate polygon rings (outer + holes, flat xz arrays) and emit them at height y. */
function fillRings(B, key, rings, y, col) {
  const contour = [], holes = [];
  rings.forEach((r, k) => {
    const pts = [];
    for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
    if (k === 0) contour.push(...pts); else holes.push(pts);
  });
  if (contour.length < 3) return;
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch { return; }
  const all = contour.concat(...holes);
  // triangulateShape winds for +y up in (x, y) space; our z is "y" so flip to face up
  for (const [a, b, c] of tris) {
    const A = all[a], Bv = all[b], C = all[c];
    const cross = (Bv.x - A.x) * (C.y - A.y) - (Bv.y - A.y) * (C.x - A.x);
    if (cross > 0) B.tri(key, [A.x, y, A.y], [C.x, y, C.y], [Bv.x, y, Bv.y], UP, null, col);
    else B.tri(key, [A.x, y, A.y], [Bv.x, y, Bv.y], [C.x, y, C.y], UP, null, col);
  }
}

// -----------------------------------------------------------------------------------
// roads

const CLASS_W = { motorway: 11, trunk: 10, primary: 11, secondary: 9, tertiary: 8, residential: 7, living_street: 6, unclassified: 6.5, service: 4.5, pedestrian: 4, footway: 2.2, steps: 2, path: 1.8, track: 3, cycleway: 2, bridleway: 2, unknown: 5 };
const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified']);

export function roadWidth(road, classes) {
  const cls = classes[road.cls];
  if (road.width > 1.5 && road.width < 40) return road.width;
  let w = CLASS_W[cls] ?? 6;
  if ((road.flags & 8) && (cls === 'motorway' || cls === 'trunk' || cls === 'primary')) w *= 0.62; // one carriageway of a dual road
  if (road.flags & 4) w = Math.min(w, 5.5); // ramps and links
  return w;
}

/** Offset a polyline sideways by d (positive = left of travel), with mitred corners. */
function offsetLine(pts, d) {
  const n = pts.length / 2, out = new Float32Array(pts.length);
  for (let i = 0; i < n; i++) {
    const px = pts[Math.max(0, i - 1) * 2], pz = pts[Math.max(0, i - 1) * 2 + 1];
    const nx = pts[Math.min(n - 1, i + 1) * 2], nz = pts[Math.min(n - 1, i + 1) * 2 + 1];
    let tx = nx - px, tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out[i * 2] = pts[i * 2] + tz * d; out[i * 2 + 1] = pts[i * 2 + 1] - tx * d;
  }
  return out;
}

/** Ribbon between two polylines (left, right) at heights hl/hr (arrays or numbers). */
function ribbon(B, key, L, R, y, n, along = null, col = null, uAcross = null) {
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const yl0 = typeof y === 'number' ? y : y[i], yl1 = typeof y === 'number' ? y : y[i + 1];
    const a = [L[i * 2], yl0, L[i * 2 + 1]], b = [R[i * 2], yl0, R[i * 2 + 1]];
    const c = [L[i * 2 + 2], yl1, L[i * 2 + 3]], d = [R[i * 2 + 2], yl1, R[i * 2 + 3]];
    const seg = Math.hypot((L[i * 2 + 2] + R[i * 2 + 2] - L[i * 2] - R[i * 2]) / 2, (L[i * 2 + 3] + R[i * 2 + 3] - L[i * 2 + 1] - R[i * 2 + 1]) / 2);
    let uv = null;
    if (along) uv = [[uAcross[0], acc / along], [uAcross[1], acc / along], [uAcross[0], (acc + seg) / along], [uAcross[1], (acc + seg) / along]];
    acc += seg;
    // a-b-c-d: left/right at i, left/right at i+1; wind so the face points up
    const cross = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
    if (cross < 0) { B.tri(key, a, b, c, UP, uv && [uv[0], uv[1], uv[2]], col); B.tri(key, b, d, c, UP, uv && [uv[1], uv[3], uv[2]], col); }
    else { B.tri(key, a, c, b, UP, uv && [uv[0], uv[2], uv[1]], col); B.tri(key, b, c, d, UP, uv && [uv[1], uv[2], uv[3]], col); }
  }
}

/** A vertical wall strip along a polyline between heights (for curbs, deck sides, parapets). */
function wallStrip(B, key, P, n, y0, y1, outward) {
  for (let i = 0; i < n - 1; i++) {
    const ax = P[i * 2], az = P[i * 2 + 1], bx = P[i * 2 + 2], bz = P[i * 2 + 3];
    const a0 = typeof y0 === 'number' ? y0 : y0[i], b0 = typeof y0 === 'number' ? y0 : y0[i + 1];
    const a1 = typeof y1 === 'number' ? y1 : y1[i], b1 = typeof y1 === 'number' ? y1 : y1[i + 1];
    let nx = bz - az, nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (outward < 0) { nx = -nx; nz = -nz; }
    const p0 = [ax, a0, az], p1 = [bx, b0, bz], p2 = [bx, b1, bz], p3 = [ax, a1, az];
    const N = [nx, 0, nz];
    // wind to face N
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * nx + cz * nz >= 0) { B.tri(key, p0, p1, p2, N); B.tri(key, p0, p2, p3, N); }
    else { B.tri(key, p0, p2, p1, N); B.tri(key, p0, p3, p2, N); }
  }
}

// -----------------------------------------------------------------------------------
// buildings

const PASTELS = [0xf6d8c8, 0xf9e5b5, 0xcfe8e0, 0xd9e4f5, 0xf5cfd9, 0xe8e0f2, 0xfaf3e3, 0xe0efd2, 0xf2e2cf, 0xffffff, 0xf3ead8, 0xdde7ea];
const NEUTRALS = [0xe9e6df, 0xd9d6ce, 0xcdd3d8, 0xeeeeea, 0xd8cfc0, 0xc9c2b6];
function hash(x, z) { let h = Math.imul((x * 73856093) ^ (z * 19349663), 0x9e3779b1); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

/** Coral Gables (game metres): Mediterranean revival is the rule there. */
const GABLES = { x0: -10700, x1: -6100, z0: 1500, z1: 8800 };

/**
 * Facade style from what the building is, how tall, where it stands and how big it is:
 * glass offices downtown, white balcony condo towers, Art Deco on South Beach, Mediterranean
 * revival in Coral Gables, houses, warehouses, shops.
 */
function facadeFor(b, classes, cx, cz, deco, area) {
  const cls = classes[b.cls] || '';
  const gables = cx > GABLES.x0 && cx < GABLES.x1 && cz > GABLES.z0 && cz < GABLES.z1;
  const homey = ['house', 'detached', 'semidetached_house', 'residential', 'apartments', ''].includes(cls);
  if (['industrial', 'warehouse', 'garage', 'garages', 'service', 'shed', 'roof'].includes(cls)) return 'warehouse';
  if (b.h > 30) return ['office', 'commercial', 'retail', 'government', 'civic', 'hotel'].includes(cls) && !(cls === 'hotel' && hash(cx, cz) < 0.5) ? 'glass' : 'tower';
  if (deco && b.h < 26) return 'deco';
  if (gables && b.h < 22) return 'medit';
  if (homey && b.h < 9 && area < 450) return 'house';
  if (['commercial', 'retail', 'office'].includes(cls)) return b.h > 16 ? 'glass' : 'shop';
  if (['civic', 'government', 'school', 'university', 'hospital', 'church', 'transportation', 'stadium', 'parking'].includes(cls)) return 'civic';
  if (cls === 'hotel') return b.h > 18 ? 'tower' : 'deco';
  if (b.h < 8) return area < 450 ? 'house' : 'shop';
  return b.h > 16 ? 'tower' : 'residential';
}

function area2(pts) { let a = 0; const n = pts.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; } return a / 2; }

function inPoly(pts, x, z) {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Minimum-area bounding rectangle of a footprint (by trying each edge direction). */
function obb(pts) {
  const n = pts.length / 2;
  let best = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = pts[j * 2] - pts[i * 2], dz = pts[j * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(dx, dz);
    if (l < 0.5) continue;
    const ux = dx / l, uz = dz / l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < n; k++) { const x = pts[k * 2], z = pts[k * 2 + 1], a = x * ux + z * uz, bb = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, bb); b1 = Math.max(b1, bb); }
    const ar = (a1 - a0) * (b1 - b0);
    if (!best || ar < best.ar) best = { ar, ux, uz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  const { ux, uz, a0, a1, b0, b1 } = best, P = (a, bb) => [a * ux - bb * uz, a * uz + bb * ux];
  return { corners: [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], fill: (area2(pts) < 0 ? -area2(pts) : area2(pts)) / best.ar };
}

const ROOF_TILE = [0xb5603c, 0xa95a3a, 0xc0714a, 0x9a5236], ROOF_SHINGLE = [0x6f6a64, 0x5d5a57, 0x8a8178, 0x4f5358], ROOF_FLAT = [0xd9d6cf, 0xc9c6bf, 0xe4e1da];

/** A face (a, b, c) wound to face away from `below` (the centre underneath it). */
function roofTri(B, key, a, b, c, col) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let N = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (N[1] < 0) { [b, c] = [c, b]; N = N.map((v) => -v); }
  const l = Math.hypot(...N) || 1;
  B.tri(key, a, b, c, N.map((v) => v / l), null, col);
}

/** Hipped roof over a rectangle (4 corners [x, z]), eaves at y, with an overhang. */
function hipRoof(B, corners, y, col, pitch = 0.42, over = 0.45) {
  const c = corners.map(([x, z]) => [x, z]);
  const cx = (c[0][0] + c[2][0]) / 2, cz = (c[0][1] + c[2][1]) / 2;
  const P = c.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + (dx / l) * over * 1.41, z + (dz / l) * over * 1.41]; });
  const e0 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), e1 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
  const short = Math.min(e0, e1), rise = short * 0.5 * pitch;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [ra, rb] = e0 > e1 ? [mid(P[3], P[0]), mid(P[1], P[2])] : [mid(P[0], P[1]), mid(P[2], P[3])];
  const k = (short / 2) / Math.max(e0, e1);
  const R1 = [ra[0] + (rb[0] - ra[0]) * k, ra[1] + (rb[1] - ra[1]) * k], R2 = [rb[0] + (ra[0] - rb[0]) * k, rb[1] + (ra[1] - rb[1]) * k];
  const near = (p) => (Math.hypot(p[0] - R1[0], p[1] - R1[1]) < Math.hypot(p[0] - R2[0], p[1] - R2[1]) ? R1 : R2);
  const top = y + rise;
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], na = near(a), nb = near(b);
    const A = [a[0], y - 0.15, a[1]], Bp = [b[0], y - 0.15, b[1]];
    if (na === nb) roofTri(B, 'roof', A, Bp, [na[0], top, na[1]], col);
    else { roofTri(B, 'roof', A, Bp, [nb[0], top, nb[1]], col); roofTri(B, 'roof', A, [nb[0], top, nb[1]], [na[0], top, na[1]], col); }
  }
  // soffit: the underside of the overhang, so the eaves don't look paper-thin
  for (const [p, q] of [[P[0], P[1]], [P[1], P[2]], [P[2], P[3]], [P[3], P[0]]]) {
    const a = [p[0], y - 0.15, p[1]], b = [q[0], y - 0.15, q[1]], c = [q[0], y - 0.3, q[1]], d = [p[0], y - 0.3, p[1]];
    const nx = (q[1] - p[1]), nz = -(q[0] - p[0]), l = Math.hypot(nx, nz) || 1;
    const out = (p[0] + q[0]) / 2 - cx, outz = (p[1] + q[1]) / 2 - cz, s = out * nx + outz * nz >= 0 ? 1 : -1;
    const N = [s * nx / l, 0, s * nz / l];
    if (s > 0) { B.tri('roof', a, b, c, N, null, col); B.tri('roof', a, c, d, N, null, col); } else { B.tri('roof', a, c, b, N, null, col); B.tri('roof', a, d, c, N, null, col); }
  }
}

/** A horizontal slab along a wall edge (balconies, eyebrows): top, bottom and front faces. */
function slab(B, key, ax, az, bx, bz, nx, nz, y, depth, thick, col) {
  const ox = nx * depth, oz = nz * depth;
  const p = [[ax, az], [bx, bz], [bx + ox, bz + oz], [ax + ox, az + oz]];
  const top = p.map(([x, z]) => [x, y, z]), bot = p.map(([x, z]) => [x, y - thick, z]);
  B.tri(key, top[0], top[2], top[1], UP, null, col); B.tri(key, top[0], top[3], top[2], UP, null, col);
  B.tri(key, bot[0], bot[1], bot[2], [0, -1, 0], null, col); B.tri(key, bot[0], bot[2], bot[3], [0, -1, 0], null, col);
  const N = [nx, 0, nz];
  const f0 = [p[3][0], y - thick, p[3][1]], f1 = [p[2][0], y - thick, p[2][1]], f2 = [p[2][0], y, p[2][1]], f3 = [p[3][0], y, p[3][1]];
  const e1 = [f1[0] - f0[0], 0, f1[2] - f0[2]], e2 = [0, thick, 0], cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * nx + cz * nz >= 0) { B.tri(key, f0, f1, f2, N, null, col); B.tri(key, f0, f2, f3, N, null, col); } else { B.tri(key, f0, f2, f1, N, null, col); B.tri(key, f0, f3, f2, N, null, col); }
}

/** A small box (rooftop AC units, water tanks). */
function box(B, key, x, z, y, w, d, h, col) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
  B.tri(key, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], UP, null, col); B.tri(key, [x0, y1, z0], [x1, y1, z1], [x1, y1, z0], UP, null, col);
  const sides = [[[x0, z1], [x1, z1], [0, 1]], [[x1, z1], [x1, z0], [1, 0]], [[x1, z0], [x0, z0], [0, -1]], [[x0, z0], [x0, z1], [-1, 0]]];
  for (const [[ax, az], [bx2, bz], [nx, nz]] of sides) {
    const N = [nx, 0, nz];
    B.tri(key, [ax, y, az], [bx2, y, bz], [bx2, y1, bz], N, null, col); B.tri(key, [ax, y, az], [bx2, y1, bz], [ax, y1, az], N, null, col);
  }
}

function building(B, b, classes, colliders, deco, FACADE_TILE, shop) {
  let pts = b.pts;
  const n = pts.length / 2;
  if (n < 3) return;
  // make the ring counter-clockwise in (x, -z) i.e. outward normals = (dz, -dx) consistently
  if (area2(pts) > 0) { const r = new Float32Array(pts.length); for (let i = 0; i < n; i++) { r[i * 2] = pts[(n - 1 - i) * 2]; r[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1]; } pts = r; }
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; }
  cx /= n; cz /= n;
  const area = Math.abs(area2(pts));
  const r = hash(Math.round(cx), Math.round(cz));
  const style = facadeFor(b, classes, cx, cz, deco, area);
  const palette = style === 'glass' || style === 'civic' || style === 'warehouse' ? NEUTRALS : style === 'tower' ? [0xf6f6f2, 0xf2efe6, 0xeceff0, 0xf4eee4] : PASTELS;
  const col = new THREE.Color(b.colour >= 0 ? b.colour : palette[Math.floor(r * palette.length)]);
  const key = 'fac:' + style;
  const y0 = b.minh, y1 = Math.max(b.minh + 2.6, b.h);
  // shops at street level: a storefront band on the ground floor
  const front = (shop || style === 'shop' || (style === 'deco' && r < 0.7)) && y0 < 0.5 && y1 > 5;
  const yF = front ? 4 : y0;
  const [tw, th] = FACADE_TILE;
  let perim = 0;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const nx = (bz - az) / len, nz = -(bx - ax) / len;
    const out = (ax + bx) / 2 - cx, outz = (az + bz) / 2 - cz;
    const s = out * nx + outz * nz >= 0 ? 1 : -1;
    const N = [nx * s, 0, nz * s];
    edges.push({ ax, az, bx, bz, len, nx: N[0], nz: N[2] });
    const wall = (k, ya, yb, u0, u1, v0, v1) => {
      const p0 = [ax, ya, az], p1 = [bx, ya, bz], p2 = [bx, yb, bz], p3 = [ax, yb, az];
      if (s > 0) { B.tri(k, p0, p1, p2, N, [[u0, v0], [u1, v0], [u1, v1]], col); B.tri(k, p0, p2, p3, N, [[u0, v0], [u1, v1], [u0, v1]], col); }
      else { B.tri(k, p0, p2, p1, N, [[u0, v0], [u1, v1], [u1, v0]], col); B.tri(k, p0, p3, p2, N, [[u0, v0], [u0, v1], [u1, v1]], col); }
    };
    if (front) wall(style === 'deco' ? 'front:deco' : 'front:shop', y0, yF, perim / 6, (perim + len) / 6, 0, 1);
    wall(key, yF, y1, perim / tw, (perim + len) / tw, (yF - (front ? 0.6 : 0)) / th, (y1 - (front ? 0.6 : 0)) / th);
    perim += len;
    if (colliders && y0 < 3) colliders.push({ type: 'box', cx: (ax + bx) / 2 - N[0] * 0.25, cz: (az + bz) / 2 - N[2] * 0.25, hx: len / 2 + 0.2, hz: 0.3, angle: Math.atan2(-(bz - az), bx - ax), y0: -2, y1: y1 + 0.5, material: 'concrete', tag: 'building' });
  }
  const white = new THREE.Color(0xf6f4ee);
  // condo towers: a balcony slab with a glass rail line on every floor
  if (style === 'tower' && y1 > 18 && edges.length <= 14) {
    for (let fy = 6.8; fy < y1 - 2; fy += 3.4) for (const e of edges) if (e.len > 4) slab(B, 'slab', e.ax, e.az, e.bx, e.bz, e.nx, e.nz, fy, 1.4, 0.22, white);
  }
  // Art Deco: an "eyebrow" over each floor's windows and a stepped parapet on the longest side
  if (style === 'deco') {
    for (let fy = 4 + 3.0; fy < y1 - 0.5; fy += 3.4) for (const e of edges) if (e.len > 3) slab(B, 'slab', e.ax, e.az, e.bx, e.bz, e.nx, e.nz, fy, 0.55, 0.12, white);
    const L = edges.reduce((a, e) => (e.len > (a?.len || 0) ? e : a), null);
    if (L && L.len > 8) {
      const mx = (L.ax + L.bx) / 2, mz = (L.az + L.bz) / 2, ux = (L.bx - L.ax) / L.len, uz = (L.bz - L.az) / L.len, w = Math.min(6, L.len * 0.35);
      const P = [[mx - ux * w / 2, mz - uz * w / 2], [mx + ux * w / 2, mz + uz * w / 2]];
      const tcol = new THREE.Color(PASTELS[Math.floor(hash(Math.round(mx), Math.round(mz)) * PASTELS.length)]);
      for (const [h0, ww] of [[y1, w], [y1 + 1.2, w * 0.55]]) {
        const a = [mx - ux * ww / 2 - L.nx * 0.05, mz - uz * ww / 2 - L.nz * 0.05], b2 = [mx + ux * ww / 2 - L.nx * 0.05, mz + uz * ww / 2 - L.nz * 0.05];
        const N = [L.nx, 0, L.nz];
        B.tri('trim', [a[0], h0, a[1]], [b2[0], h0, b2[1]], [b2[0], h0 + 1.2, b2[1]], N, null, tcol);
        B.tri('trim', [a[0], h0, a[1]], [b2[0], h0 + 1.2, b2[1]], [a[0], h0 + 1.2, a[1]], N, null, tcol);
      }
      void P;
    }
  }
  // roof: hipped tile or shingle roofs on houses and Mediterranean buildings, flat (with
  // rooftop plant) on everything else
  const box0 = (style === 'house' || style === 'medit') && y1 < 14 ? obb(pts) : null;
  if (box0 && box0.fill > 0.6) {
    const tile = style === 'medit' || hash(Math.round(cz), Math.round(cx)) < 0.55;
    const roofCol = new THREE.Color((tile ? ROOF_TILE : ROOF_SHINGLE)[Math.floor(r * 4) % 4]);
    // close the top of the walls under the eaves
    fillRings(B, 'roof', [new Float32Array(pts)], y1 - 0.02, roofCol);
    hipRoof(B, box0.corners, y1, roofCol, style === 'medit' ? 0.36 : 0.45);
  } else {
    const roofCol = new THREE.Color(ROOF_FLAT[Math.floor(r * 3) % 3]);
    fillRings(B, 'roof', [new Float32Array(pts)], y1, roofCol);
    // rooftop plant: AC units (and a water tank on some older mid-rises)
    if (area > 120) {
      const gray = new THREE.Color(0xb9bcbf);
      const k = Math.min(4, 1 + Math.floor(area / 400));
      for (let i = 0; i < k; i++) {
        const h1 = hash(Math.round(cx) + i * 7, Math.round(cz) - i * 3), h2 = hash(Math.round(cz) + i * 5, Math.round(cx) + i);
        const px = cx + (h1 - 0.5) * Math.sqrt(area) * 0.45, pz = cz + (h2 - 0.5) * Math.sqrt(area) * 0.45;
        if (!inPoly(pts, px, pz)) continue;
        box(B, 'metal', px, pz, y1, 1.6, 1.2, 1.1, gray);
      }
    }
  }
}
// -----------------------------------------------------------------------------------

const GROUND_KEY = { land: 'grass', park: 'grass', grass: 'grass', beach: 'sand', sand: 'sand', golf: 'grass', forest: 'grass', wetland: 'grass', parking: 'lot', pedestrian: 'pavers', cemetery: 'grass', airport: 'lot', sports: 'grass', industrial: 'concrete', residential: null, commercial: null, farmland: 'grass', construction: 'sand', rock: 'concrete', pier: 'wood' };
const GROUND_Y = { land: 0, residential: 0.002, commercial: 0.002, park: 0.004, grass: 0.004, golf: 0.004, forest: 0.004, wetland: 0.004, farmland: 0.004, cemetery: 0.004, sports: 0.006, beach: 0.006, sand: 0.006, construction: 0.006, rock: 0.006, parking: 0.008, pedestrian: 0.01, industrial: 0.006, airport: 0.008, pier: 0.6 };
const GROUND_SURF = { land: SURF.grass, park: SURF.park, grass: SURF.grass, beach: SURF.sand, sand: SURF.sand, golf: SURF.grass, forest: SURF.grass, wetland: SURF.grass, parking: SURF.road, pedestrian: SURF.walk, cemetery: SURF.grass, airport: SURF.road, sports: SURF.grass, industrial: SURF.walk, residential: null, commercial: null, farmland: SURF.grass, construction: SURF.sand, rock: SURF.walk, pier: SURF.wood };
const GREENS = { park: 0xb8d8a0, grass: 0xc4dca8, golf: 0xa8d890, forest: 0x8fb878, wetland: 0x9cb88a, cemetery: 0xbcd4a4, farmland: 0xc8d49c, sports: 0xb0d898, land: 0xd8d4b8 };

/**
 * Build everything for one sub-tile. `index` gives the class tables, `materials(key)` the
 * shared materials, `deco(x, z)` says whether a point is in the Art Deco district.
 * Returns { meshes, colliders, raster, decks, places, roads }.
 */
export function buildTile(tile, index, materials, opts = {}) {
  const r = buildTileData(tile, index, opts);
  return { ...r, meshes: meshesFromArrays(r.bins, materials) };
}

/** Meshes (one per material key) from the typed arrays a tile build produced. */
export function meshesFromArrays(bins, materials, castShadow = true) {
  const out = [];
  for (const b of bins) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b.nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2));
    if (b.col) g.setAttribute('color', new THREE.BufferAttribute(b.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, materials(b.key));
    m.receiveShadow = true;
    m.userData.caster = b.key.startsWith('fac:') || b.key === 'roof' || b.key === 'deck' || b.key === 'pier';
    m.castShadow = castShadow && m.userData.caster;
    m.matrixAutoUpdate = false;
    m.userData.key = b.key;
    out.push(m);
  }
  return out;
}

/** The pure part of a tile build: geometry arrays, colliders, raster — no THREE objects, worker-safe. */
export function buildTileData(tile, index, { deco = () => false, FACADE_TILE = [12, 13.6] } = {}) {
  const B = new Bins();
  const groundKinds = index.ground, classes = index.roadClasses;
  const colliders = [];
  const decks = []; // raised road pieces for height queries: { pts, hts, half }
  // raster for surface queries (2 m cells), drawn on a canvas: colour = surface code
  const N = Math.round(tile.size / RASTER);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(N, N) : Object.assign(document.createElement('canvas'), { width: N, height: N });
  const cx2 = cv.getContext('2d', { willReadFrequently: true });
  cx2.imageSmoothingEnabled = false;
  cx2.fillStyle = `rgb(${SURF.water * 30},0,0)`; cx2.fillRect(0, 0, N, N);
  const toR = (x, z) => [(x - tile.x0) / RASTER, (z - tile.z0) / RASTER];
  const fillPoly = (rings, code) => {
    cx2.fillStyle = `rgb(${code * 30},0,0)`; cx2.beginPath();
    for (const r of rings) { for (let i = 0; i < r.length; i += 2) { const [px, pz] = toR(r[i], r[i + 1]); if (i) cx2.lineTo(px, pz); else cx2.moveTo(px, pz); } cx2.closePath(); }
    cx2.fill('evenodd');
  };

  // --- ground: land first, then uses on top, water last ---------------------------------
  const order = (g) => GROUND_Y[groundKinds[g.kind]] ?? 0;
  const ground = tile.ground.slice().sort((a, b) => order(a) - order(b));
  for (const g of ground) {
    const kind = groundKinds[g.kind];
    if (kind === 'water') continue;
    const key = GROUND_KEY[kind];
    const surf = GROUND_SURF[kind];
    if (surf != null) fillPoly(g.rings, surf);
    if (!key) continue;
    const col = key === 'grass' ? new THREE.Color(GREENS[kind] ?? 0xc4dca8) : null;
    fillRings(B, key + (col ? ':tint' : ''), g.rings, GROUND_Y[kind] ?? 0, col);
    if (kind === 'pier') fillRings(B, 'pier', g.rings, 0.6);
  }
  for (const g of ground) if (groundKinds[g.kind] === 'water') fillPoly(g.rings, SURF.water);

  // --- roads ------------------------------------------------------------------------------
  const roads = [];
  for (const r of tile.roads) {
    const cls = classes[r.cls];
    const n = r.pts.length / 2;
    if (n < 2) continue;
    const foot = cls === 'footway' || cls === 'path' || cls === 'steps' || cls === 'cycleway' || cls === 'pedestrian' || cls === 'bridleway' || (r.flags & 32);
    const w = roadWidth(r, classes);
    const raised = !!r.hts;
    const y = raised ? Array.from(r.hts, (h) => h + 0.03) : (foot ? 0.05 : 0.03);
    const L = offsetLine(r.pts, w / 2), R = offsetLine(r.pts, -w / 2);
    if (foot) {
      ribbon(B, cls === 'cycleway' ? 'asphalt' : 'concrete', L, R, y, n);
    } else {
      ribbon(B, 'asphalt', L, R, y, n);
      // centre line on two-way streets, lane edge lines on bigger roads
      const twoWay = !(r.flags & 8);
      if (twoWay && ['primary', 'secondary', 'tertiary', 'trunk'].includes(cls)) {
        const yy = typeof y === 'number' ? y + 0.012 : y.map((v) => v + 0.012);
        ribbon(B, 'marking_y', offsetLine(r.pts, 0.18), offsetLine(r.pts, 0.06), yy, n);
        ribbon(B, 'marking_y', offsetLine(r.pts, -0.06), offsetLine(r.pts, -0.18), yy, n);
      }
      if (['motorway', 'trunk', 'primary'].includes(cls) && w > 7) {
        const yy = typeof y === 'number' ? y + 0.012 : y.map((v) => v + 0.012);
        ribbon(B, 'marking_w', offsetLine(r.pts, w / 2 - 0.35), offsetLine(r.pts, w / 2 - 0.5), yy, n);
        ribbon(B, 'marking_w', offsetLine(r.pts, -w / 2 + 0.5), offsetLine(r.pts, -w / 2 + 0.35), yy, n);
      }
      // sidewalks and curbs on city streets at grade
      if (URBAN.has(cls) && !raised && !(r.flags & 4)) {
        const sw = cls === 'residential' ? 1.8 : 2.6;
        const Lo = offsetLine(r.pts, w / 2 + sw), Ro = offsetLine(r.pts, -w / 2 - sw);
        ribbon(B, 'concrete', Lo, L, 0.16, n);
        ribbon(B, 'concrete', R, Ro, 0.16, n);
        wallStrip(B, 'curb', L, n, 0.03, 0.16, -1);
        wallStrip(B, 'curb', R, n, 0.03, 0.16, 1);
        cx2.strokeStyle = `rgb(${SURF.walk * 30},0,0)`; cx2.lineWidth = (w + sw * 2) / RASTER; cx2.lineCap = 'butt'; cx2.lineJoin = 'round';
        cx2.beginPath(); for (let i = 0; i < n; i++) { const [px, pz] = toR(r.pts[i * 2], r.pts[i * 2 + 1]); if (i) cx2.lineTo(px, pz); else cx2.moveTo(px, pz); } cx2.stroke();
      }
    }
    if (raised) {
      // deck underside, sides, parapets and piers
      const yb = r.hts.map((h) => h - 0.9);
      if (r.hts.some((h) => h > 1.2)) {
        wallStrip(B, 'deck', L, n, yb, y.map((v) => v + 0.9), 1);
        wallStrip(B, 'deck', R, n, yb, y.map((v) => v + 0.9), -1);
        let acc = 0;
        for (let i = 0; i < n - 1; i++) {
          const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
          const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
          const hm = Math.max(r.hts[i], r.hts[i + 1]);
          for (const s of [1, -1]) {
            const ox = (bz - az) / (len || 1) * s * (w / 2 + 0.15), oz = -(bx - ax) / (len || 1) * s * (w / 2 + 0.15);
            colliders.push({ type: 'box', cx: (ax + bx) / 2 + ox, cz: (az + bz) / 2 + oz, hx: len / 2, hz: 0.2, angle: ang, y0: Math.min(r.hts[i], r.hts[i + 1]) - 1, y1: hm + 1.0, material: 'concrete', tag: 'parapet' });
          }
          // a pier every ~35 m where the deck is high enough to need one
          for (let d = (35 - acc % 35) % 35; d < len; d += 35) {
            const t = d / len, px = ax + (bx - ax) * t, pz = az + (bz - az) * t, ph = r.hts[i] + (r.hts[i + 1] - r.hts[i]) * t;
            if (ph < 3) continue;
            const s0 = Math.min(w * 0.35, 2.5);
            for (const [qx, qz] of [[px + (bz - az) / len * s0, pz - (bx - ax) / len * s0], [px - (bz - az) / len * s0, pz + (bx - ax) / len * s0]]) {
              const sq = [qx - 0.6, qz - 0.6, qx + 0.6, qz - 0.6, qx + 0.6, qz + 0.6, qx - 0.6, qz + 0.6, qx - 0.6, qz - 0.6];
              wallStrip(B, 'deck', new Float32Array(sq), 5, -1.5, ph - 0.9, 1);
              colliders.push({ type: 'box', cx: qx, cz: qz, hx: 0.6, hz: 0.6, angle: 0, y0: -2, y1: ph - 0.9, material: 'concrete', tag: 'pier' });
            }
          }
          acc += len;
        }
      }
      decks.push({ pts: r.pts, hts: r.hts, half: w / 2 + 0.3 });
    } else {
      cx2.strokeStyle = `rgb(${(foot ? SURF.walk : SURF.road) * 30},0,0)`; cx2.lineWidth = w / RASTER; cx2.lineCap = 'round'; cx2.lineJoin = 'round';
      cx2.beginPath(); for (let i = 0; i < n; i++) { const [px, pz] = toR(r.pts[i * 2], r.pts[i * 2 + 1]); if (i) cx2.lineTo(px, pz); else cx2.moveTo(px, pz); } cx2.stroke();
    }
    if (!foot && r.name) roads.push({ name: r.name, cls, pts: r.pts, half: w / 2, raised });
  }

  // --- buildings ----------------------------------------------------------------------------
  const storeKinds = index.stores || [];
  const shopPts = tile.places.filter((p) => { const k = storeKinds[p.kind]; return k && !['other', 'office', 'school', 'worship', 'park', 'beach', 'marina', 'hospital', 'police', 'fire', 'museum', 'bank', 'atm'].includes(k); });
  for (const b of tile.buildings) {
    let shop = false;
    if (shopPts.length && b.h < 60) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < b.pts.length; i += 2) { x0 = Math.min(x0, b.pts[i]); x1 = Math.max(x1, b.pts[i]); z0 = Math.min(z0, b.pts[i + 1]); z1 = Math.max(z1, b.pts[i + 1]); }
      shop = shopPts.some((p) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1 && inPoly(b.pts, p.x, p.z));
    }
    building(B, b, index.buildingClasses, colliders, deco(b.pts[0], b.pts[1]), FACADE_TILE, shop);
    fillPoly([b.pts], SURF.building);
  }

  // --- piers and boardwalks ----------------------------------------------------------------
  for (const f of tile.infra) {
    if (f.line && (f.kind === 0 || f.kind === 1 || f.kind === 2)) {
      const n = f.pts.length / 2;
      ribbon(B, 'wood', offsetLine(f.pts, 1.6), offsetLine(f.pts, -1.6), 0.6, n);
      decks.push({ pts: f.pts, hts: new Float32Array(n).fill(0.6), half: 1.7 });
    } else if (!f.line && f.kind <= 2) {
      fillRings(B, 'wood', [f.pts], 0.6);
      fillPoly([f.pts], SURF.wood);
    }
  }

  const raster = cx2.getImageData(0, 0, N, N).data;
  const codes = new Uint8Array(N * N);
  // codes are drawn ×30 so an anti-aliased edge rounds to one side or the other
  for (let i = 0; i < N * N; i++) codes[i] = Math.round(raster[i * 4] / 30);
  return { bins: B.arrays(), colliders, raster: { codes, N, x0: tile.x0, z0: tile.z0 }, decks, places: tile.places, roads };
}
