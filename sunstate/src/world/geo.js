/**
 * Geometry batcher: accumulates world-space quads and boxes per material key
 * and emits one merged mesh per key, so the whole district renders in a few
 * dozen draw calls.
 */
import * as THREE from 'three';

export class Batcher {
  constructor() { this.buckets = new Map(); }

  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) { b = { pos: [], nrm: [], uv: [], col: [], idx: [] }; this.buckets.set(key, b); }
    return b;
  }

  /** Quad from 4 corners (counter-clockwise seen from the front) with uvs. */
  quad(key, p, uv, color) {
    const b = this.bucket(key);
    const base = b.pos.length / 3;
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[3][0] - p[0][0], by = p[3][1] - p[0][1], bz = p[3][2] - p[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let i = 0; i < 4; i++) {
      b.pos.push(p[i][0], p[i][1], p[i][2]);
      b.nrm.push(nx, ny, nz);
      b.uv.push(uv[i][0], uv[i][1]);
      if (color) b.col.push(color.r, color.g, color.b);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Axis-aligned box. opts: { sides: {top, bottom, n, s, e, w} booleans
   * (default all but bottom), tile: [u metres, v metres], top tile, vBase, color }
   * Walls get uvs in metres / tile so textures keep a constant world scale.
   */
  box(key, x0, x1, y0, y1, z0, z1, opts = {}) {
    const s = { top: true, bottom: false, n: true, s: true, e: true, w: true, ...(opts.sides || {}) };
    const [tu, tv] = opts.tile || [1, 1];
    const tt = opts.topTile || tu;
    const vb = opts.vBase ?? y0;
    const keyOf = (face) => (opts.keys && opts.keys[face]) || key;
    const c = opts.color;
    const v0 = (y0 - vb) / tv, v1 = (y1 - vb) / tv;
    if (s.n) this.quad(keyOf('n'), [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[0, v0], [(x1 - x0) / tu, v0], [(x1 - x0) / tu, v1], [0, v1]], c);
    if (s.s) this.quad(keyOf('s'), [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[0, v0], [(x1 - x0) / tu, v0], [(x1 - x0) / tu, v1], [0, v1]], c);
    if (s.e) this.quad(keyOf('e'), [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[0, v0], [(z1 - z0) / tu, v0], [(z1 - z0) / tu, v1], [0, v1]], c);
    if (s.w) this.quad(keyOf('w'), [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[0, v0], [(z1 - z0) / tu, v0], [(z1 - z0) / tu, v1], [0, v1]], c);
    if (s.top) this.quad(keyOf('top'), [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0 / tt, -z1 / tt], [x1 / tt, -z1 / tt], [x1 / tt, -z0 / tt], [x0 / tt, -z0 / tt]], c);
    if (s.bottom) this.quad(keyOf('bottom'), [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
  }

  /** Horizontal rectangle (facing up) with world-scaled uvs. */
  flat(key, x0, x1, z0, z1, y, tile = 1, color) {
    this.quad(key, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [[x0 / tile, -z1 / tile], [x1 / tile, -z1 / tile], [x1 / tile, -z0 / tile], [x0 / tile, -z0 / tile]], color);
  }

  /** Append an arbitrary transformed BufferGeometry (non-indexed or indexed). */
  geometry(key, geo, matrix, color) {
    const b = this.bucket(key);
    const g = geo.index ? geo : geo;
    const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const base = b.pos.length / 3;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      b.pos.push(v.x, v.y, v.z); b.nrm.push(n.x, n.y, n.z);
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      if (color) b.col.push(color.r, color.g, color.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) b.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }

  /** Build meshes. materials: key → THREE.Material (or fn(key) → material). */
  build(materials, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = [];
    for (const [key, b] of this.buckets) {
      if (!b.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      if (b.col.length === b.pos.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      geo.computeBoundingSphere();
      const mat = typeof materials === 'function' ? materials(key) : materials[key];
      if (!mat) { console.warn('no material for', key); continue; }
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = castShadow && !mat.transparent && !mat.userData?.noShadow;
      m.receiveShadow = receiveShadow;
      m.matrixAutoUpdate = false;
      m.name = key;
      meshes.push(m);
    }
    return meshes;
  }
}
