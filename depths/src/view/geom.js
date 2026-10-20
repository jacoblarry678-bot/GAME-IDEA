/**
 * Geometry helpers: boxes and quads with world-space UVs (metres / scale),
 * and a batcher that merges static geometry per room and material so a
 * chapter draws in a few dozen calls and still frustum-culls by room.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, texScale } from './materials.js';

/** Axis-aligned box from min/max corners with UVs in world metres divided by `s`. */
export function boxGeo(x0, y0, z0, x1, y1, z1, s = 1, faces = 63) {
  const pos = [], nor = [], uv = [], idx = [];
  const face = (bit, n, verts, uvs) => {
    if (!(faces & bit)) return;
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(...verts[i]); nor.push(...n); uv.push(uvs[i][0] / s, uvs[i][1] / s); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // +x
  face(1, [1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]);
  // -x
  face(2, [-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
  // +y
  face(4, [0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]);
  // -y
  face(8, [0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  // +z
  face(16, [0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  // -z
  face(32, [0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Ensure a geometry has position/normal/uv and an index (so merges succeed). */
export function normalize(g) {
  if (!g.index) { const n = g.attributes.position.count; const a = []; for (let i = 0; i < n; i++) a.push(i); g.setIndex(a); }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

export class Batcher {
  constructor() { this.groups = new Map(); }
  add(key, matName, geo, matrix = null) {
    if (matrix) geo.applyMatrix4(matrix);
    normalize(geo);
    let g = this.groups.get(key);
    if (!g) { g = new Map(); this.groups.set(key, g); }
    let list = g.get(matName);
    if (!list) { list = []; g.set(matName, list); }
    list.push(geo);
  }
  /** Merge into meshes under `parent`. Returns { key: Group }. */
  build(parent, opts = {}) {
    const out = {};
    for (const [key, g] of this.groups) {
      const grp = new THREE.Group();
      grp.name = key;
      for (const [matName, list] of g) {
        const merged = mergeGeometries(list, false);
        for (const l of list) l.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        const m = new THREE.Mesh(merged, mat(matName));
        m.receiveShadow = true;
        m.castShadow = !!opts.shadows && !['carpet', 'ceilingTile'].includes(matName);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        grp.add(m);
      }
      parent.add(grp);
      out[key] = grp;
    }
    this.groups.clear();
    return out;
  }
}

/** Local-space builder for one prop; geometry is transformed by the prop's placement. */
export class PropBuilder {
  constructor(batcher, key, matrix) { this.b = batcher; this.key = key; this.m = matrix; }
  /** Box centred on (x,z) with bottom at y. */
  box(x, y, z, w, h, d, matName, s = 1) {
    this.b.add(this.key, matName, boxGeo(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, s * texScale(matName)), this.m);
  }
  cyl(x, y, z, r, h, matName, seg = 10, r2 = null) {
    const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg);
    g.translate(x, y + h / 2, z);
    this.b.add(this.key, matName, g, this.m);
  }
  cylX(x, y, z, r, len, matName, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2); g.translate(x, y, z);
    this.b.add(this.key, matName, g, this.m);
  }
  cylZ(x, y, z, r, len, matName, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2); g.translate(x, y, z);
    this.b.add(this.key, matName, g, this.m);
  }
  sphere(x, y, z, r, matName, seg = 8) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1));
    g.translate(x, y, z);
    this.b.add(this.key, matName, g, this.m);
  }
  geo(g, matName) { this.b.add(this.key, matName, g, this.m); }
}

export function placement(x, y, z, rotDeg) {
  const m = new THREE.Matrix4();
  m.makeRotationY(-(rotDeg || 0) * Math.PI / 180);
  m.setPosition(x, y, z);
  return m;
}
