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

/** Facade style for a building: towers, deco hotels on the beach, shops, houses. */
function facadeFor(b, classes, cx, cz, deco) {
  const cls = classes[b.cls] || '';
  if (b.h > 38) return 'tower';
  if (deco && b.h < 26) return 'deco';
  if (cls === 'hotel') return b.h > 18 ? 'tower' : 'deco';
  if (['commercial', 'retail', 'office'].includes(cls)) return b.h > 16 ? 'tower' : 'shop';
  if (['civic', 'government', 'school', 'university', 'hospital', 'church', 'transportation', 'stadium'].includes(cls)) return 'civic';
  if (['industrial', 'warehouse', 'garage', 'garages', 'service', 'parking'].includes(cls)) return 'civic';
  if (b.h < 8) return 'motel';
  return 'residential';
}

function area2(pts) { let a = 0; const n = pts.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; } return a / 2; }

function building(B, b, classes, colliders, deco, FACADE_TILE) {
  let pts = b.pts;
  const n = pts.length / 2;
  if (n < 3) return;
  // make the ring counter-clockwise in (x, -z) i.e. outward normals = (dz, -dx) consistently
  if (area2(pts) > 0) { const r = new Float32Array(pts.length); for (let i = 0; i < n; i++) { r[i * 2] = pts[(n - 1 - i) * 2]; r[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1]; } pts = r; }
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; }
  cx /= n; cz /= n;
  const r = hash(Math.round(cx), Math.round(cz));
  const style = facadeFor(b, classes, cx, cz, deco);
  const palette = style === 'tower' || style === 'civic' ? NEUTRALS : PASTELS;
  const col = new THREE.Color(b.colour >= 0 ? b.colour : palette[Math.floor(r * palette.length)]);
  const key = 'fac:' + style;
  const y0 = b.minh, y1 = Math.max(b.minh + 2.4, b.h);
  const [tw, th] = FACADE_TILE;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const nx = (bz - az) / len, nz = -(bx - ax) / len;
    // outward normal check against the centroid
    const out = (ax + bx) / 2 - cx, outz = (az + bz) / 2 - cz;
    const s = out * nx + outz * nz >= 0 ? 1 : -1;
    const N = [nx * s, 0, nz * s];
    const u0 = perim / tw, u1 = (perim + len) / tw, v0 = y0 / th, v1 = y1 / th;
    const p0 = [ax, y0, az], p1 = [bx, y0, bz], p2 = [bx, y1, bz], p3 = [ax, y1, az];
    if (s > 0) { B.tri(key, p0, p1, p2, N, [[u0, v0], [u1, v0], [u1, v1]], col); B.tri(key, p0, p2, p3, N, [[u0, v0], [u1, v1], [u0, v1]], col); }
    else { B.tri(key, p0, p2, p1, N, [[u0, v0], [u1, v1], [u1, v0]], col); B.tri(key, p0, p3, p2, N, [[u0, v0], [u0, v1], [u1, v1]], col); }
    perim += len;
    if (colliders && y0 < 3) colliders.push({ type: 'box', cx: (ax + bx) / 2 - N[0] * 0.25, cz: (az + bz) / 2 - N[2] * 0.25, hx: len / 2 + 0.2, hz: 0.3, angle: Math.atan2(-(bz - az), bx - ax), y0: -2, y1: y1 + 0.5, material: 'concrete', tag: 'building' });
  }
  // roof: hipped for small four-sided houses, otherwise flat with a parapet look from the facade top
  const roofCol = new THREE.Color(style === 'motel' && r > 0.5 ? 0xb8775a : 0xd9d6cf);
  const roofShape = b.roof;
  if (n === 4 && y1 < 10 && (roofShape === 2 || roofShape === 3 || (roofShape === 0 && style === 'motel' && r > 0.35))) {
    // hip: ridge along the longer axis, inset by a quarter of the short side
    const P = [0, 1, 2, 3].map((i) => [pts[i * 2], pts[i * 2 + 1]]);
    const e0 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), e1 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
    const rh = Math.min(e0, e1) * 0.35;
    const m01 = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], m23 = [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2];
    const m12 = [(P[1][0] + P[2][0]) / 2, (P[1][1] + P[2][1]) / 2], m30 = [(P[3][0] + P[0][0]) / 2, (P[3][1] + P[0][1]) / 2];
    const [ra, rb] = e0 > e1 ? [m30, m12] : [m01, m23];
    const k = 0.25 * Math.min(e0, e1) / Math.max(e0, e1);
    const R1 = [ra[0] + (rb[0] - ra[0]) * k, ra[1] + (rb[1] - ra[1]) * k], R2 = [rb[0] + (ra[0] - rb[0]) * k, rb[1] + (ra[1] - rb[1]) * k];
    const top = y1 + rh;
    const face = (a, b, c) => {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let N = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (N[1] < 0) { [b, c] = [c, b]; N = N.map((v) => -v); }
      const l = Math.hypot(...N) || 1;
      B.tri('roof', a, b, c, N.map((v) => v / l), null, roofCol);
    };
    const near = (p) => (Math.hypot(p[0] - R1[0], p[1] - R1[1]) < Math.hypot(p[0] - R2[0], p[1] - R2[1]) ? R1 : R2);
    for (let i = 0; i < 4; i++) {
      const a = P[i], b2 = P[(i + 1) % 4], ra_ = near(a), rb_ = near(b2);
      const A = [a[0], y1, a[1]], Bp = [b2[0], y1, b2[1]], RA = [ra_[0], top, ra_[1]], RB = [rb_[0], top, rb_[1]];
      if (ra_ === rb_) face(A, Bp, RA); else { face(A, Bp, RB); face(A, RB, RA); }
    }
  } else {
    const ring = new Float32Array(pts);
    fillRings(B, 'roof', [ring], y1, roofCol);
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
export function buildTile(tile, index, materials, { deco = () => false, FACADE_TILE = [12, 13.6] } = {}) {
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
  for (const b of tile.buildings) {
    building(B, b, index.buildingClasses, colliders, deco(b.pts[0], b.pts[1]), FACADE_TILE);
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
  return { meshes: B.build(materials), colliders, raster: { codes, N, x0: tile.x0, z0: tile.z0 }, decks, places: tile.places, roads };
}
