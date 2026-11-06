// Static geometry batching: everything that never moves is merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Box with UVs scaled to world units so textures tile at a constant density.
export function boxGeo(w, h, d, ts = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / ts, uv.getY(k) * dims[f][1] / ts);
    }
  }
  return g;
}

export function cylGeo(rt, rb, h, seg = 12, ts = 2, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / ts, uv.getY(i) * h / ts);
  return g;
}

export class Batch {
  constructor() { this.buckets = new Map(); }

  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return this.addMatrix(geo, mat, _m);
  }

  addMatrix(geo, mat, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(matrix);
    let b = this.buckets.get(mat);
    if (!b) { b = []; this.buckets.set(mat, b); }
    b.push(g);
    return g;
  }

  box(mat, x, y, z, w, h, d, ry = 0, ts = 2) {
    return this.add(boxGeo(w, h, d, ts), mat, x, y, z, 0, ry, 0);
  }

  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [mat, list] of this.buckets) {
      // keep each merged mesh at a reasonable size
      for (let i = 0; i < list.length; i += 400) {
        const merged = mergeGeometries(list.slice(i, i + 400), false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const m = new THREE.Mesh(merged, mat);
        m.castShadow = cast && !mat.userData.noShadow;
        m.receiveShadow = receive;
        parent.add(m);
        meshes.push(m);
      }
    }
    for (const list of this.buckets.values()) for (const g of list) g.dispose();
    this.buckets.clear();
    return meshes;
  }
}
