// Geometry helpers: CFrames, part primitives (with rounded edges), and
// merging many parts into a few vertex-colored meshes per material.
import * as THREE from 'three';
import { familyOf, material } from './render/materials.js';

// Part record layout from tools/export-web.mjs
export const P = { SHAPE: 0, SX: 1, SY: 2, SZ: 3, X: 4, Y: 5, Z: 6, R: 7, COLOR: 16, MAT: 17, TRANS: 18, COLLIDE: 19 };

// CFrame components (x, y, z, r00..r22) -> Matrix4
export function cfMatrix(c, o = 0, out = new THREE.Matrix4()) {
  return out.set(
    c[o + 3], c[o + 4], c[o + 5], c[o + 0],
    c[o + 6], c[o + 7], c[o + 8], c[o + 1],
    c[o + 9], c[o + 10], c[o + 11], c[o + 2],
    0, 0, 0, 1,
  );
}

export function partMatrix(p, out = new THREE.Matrix4()) {
  out.set(
    p[7], p[8], p[9], p[4],
    p[10], p[11], p[12], p[5],
    p[13], p[14], p[15], p[6],
    0, 0, 0, 1,
  );
  return out;
}

function wedgeGeometry() {
  // Roblox wedge: vertical face at +Z, slope down toward -Z
  const v = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
  ];
  const faces = [[0, 1, 2, 3], [3, 2, 5, 4], [0, 4, 5, 1], [0, 3, 4], [1, 5, 2]];
  const pos = [];
  for (const f of faces) {
    const tris = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [[f[0], f[1], f[2]]];
    for (const t of tris) for (const i of t) pos.push(...v[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // fix winding so normals face outward
  const n = g.getAttribute('normal');
  const p = g.getAttribute('position');
  const center = new THREE.Vector3(0, -0.15, 0.15);
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i);
    const nn = new THREE.Vector3().fromBufferAttribute(n, i);
    if (a.clone().sub(center).dot(nn) < 0) {
      // swap two vertices
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      p.setXYZ(i + 1, c.x, c.y, c.z);
      p.setXYZ(i + 2, b.x, b.y, b.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// Templates for non-box shapes; `lod` picks the tessellation.
function template(shape, lod) {
  let g;
  const seg = [8, 12, 20][lod];
  switch (shape) {
    case 1: g = wedgeGeometry(); break;
    case 2: g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg); g.rotateZ(-Math.PI / 2); break;
    case 3: case 4: g = new THREE.SphereGeometry(0.5, seg, Math.max(6, Math.round(seg * 0.7))); break;
    case 5: g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  if (!g.index) {
    // wedge is non-indexed: build a trivial index
    const idx = [];
    for (let i = 0; i < g.getAttribute('position').count; i++) idx.push(i);
    g.setIndex(idx);
  }
  return g;
}

const templates = new Map();
function getTemplate(shape, lod) {
  const key = shape * 4 + lod;
  if (!templates.has(key)) templates.set(key, template(shape, lod));
  return templates.get(key);
}

// Box with softly rounded (chamfered, smooth-shaded) edges, in local
// studs. Fills pos/nrm (flat arrays) and idx (local indices).
const BOX_AXES = [0, 1, 2];
function beveledBox(hx, hy, hz, b) {
  const h = [hx, hy, hz];
  const inner = [hx - b, hy - b, hz - b];
  const pos = [], nrm = [], idx = [];
  const vert = (p, n) => {
    pos.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
    return pos.length / 3 - 1;
  };
  const tri = (a, c, d) => {
    // wind counter-clockwise seen from outside (the box is convex)
    const A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]];
    const B = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
    const C = [pos[d * 3], pos[d * 3 + 1], pos[d * 3 + 2]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const out = n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]);
    if (out >= 0) idx.push(a, c, d); else idx.push(a, d, c);
  };
  const quad = (a, c, d, e) => { tri(a, c, d); tri(a, d, e); };
  const unit = (axis, s) => { const n = [0, 0, 0]; n[axis] = s; return n; };
  // faces
  for (const a of BOX_AXES) {
    const [u, v] = BOX_AXES.filter((x) => x !== a);
    for (const s of [-1, 1]) {
      const n = unit(a, s);
      const c = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0];
        p[a] = s * h[a]; p[u] = su * inner[u]; p[v] = sv * inner[v];
        c.push(vert(p, n));
      }
      quad(c[0], c[1], c[2], c[3]);
    }
  }
  // edges: a strip between face a and face b, running along axis c
  for (let a = 0; a < 3; a++) {
    for (let bb = a + 1; bb < 3; bb++) {
      const c = 3 - a - bb;
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const na = unit(a, sa), nb = unit(bb, sb);
          const q = [];
          for (const sc of [-1, 1]) {
            const p1 = [0, 0, 0]; p1[a] = sa * h[a]; p1[bb] = sb * inner[bb]; p1[c] = sc * inner[c];
            const p2 = [0, 0, 0]; p2[a] = sa * inner[a]; p2[bb] = sb * h[bb]; p2[c] = sc * inner[c];
            q.push(vert(p1, na), vert(p2, nb));
          }
          quad(q[0], q[1], q[3], q[2]);
        }
      }
    }
  }
  // corners
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const s = [sx, sy, sz];
        const t = [];
        for (const a of BOX_AXES) {
          const p = [sx * inner[0], sy * inner[1], sz * inner[2]];
          p[a] = s[a] * h[a];
          t.push(vert(p, unit(a, s[a])));
        }
        tri(t[0], t[1], t[2]);
      }
    }
  }
  return { pos, nrm, idx };
}

const bevelCache = new Map();
function getBeveled(sx, sy, sz, b) {
  const key = `${sx.toFixed(2)},${sy.toFixed(2)},${sz.toFixed(2)},${b.toFixed(3)}`;
  let g = bevelCache.get(key);
  if (!g) {
    g = beveledBox(sx / 2, sy / 2, sz / 2, b);
    if (bevelCache.size < 4000) bevelCache.set(key, g);
  }
  return g;
}

const MATERIAL_TINT = { Grass: 0.95, Wood: 0.95, WoodPlanks: 0.97 };

// rounded edges and finer curves cost triangles; low quality skips them
export const geomOptions = { bevel: true, maxLod: 2 };

// cheap hash so neighbouring parts don't line up their texture detail
function hash3(x, y, z) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _v = new THREE.Vector3();

// Accumulates parts into one indexed, vertex-colored BufferGeometry with
// world-scale box-mapped UVs (1 unit = 1 stud) for the detail textures.
export class Merger {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = []; this.count = 0; }

  // lod: 0 low .. 2 high tessellation; bevel: round off box edges
  add(part, matrix, materials, detail = false, colorOverride = null, { bevel = true } = {}) {
    const shape = part[P.SHAPE];
    const sx = part[1], sy = part[2], sz = part[3];
    const color = colorOverride ?? part[P.COLOR];
    const tint = MATERIAL_TINT[materials[part[P.MAT]]] ?? 1;
    const r = (((color >> 16) & 255) / 255) * tint, gg = (((color >> 8) & 255) / 255) * tint, b = ((color & 255) / 255) * tint;
    const ou = hash3(part[P.X], part[P.Y], part[P.Z]) * 37, ov = hash3(part[P.Z], part[P.X], part[P.Y]) * 37;
    let lpos, lnrm, lidx, scale;
    const minDim = Math.min(sx, sy, sz);
    const maxDim = Math.max(sx, sy, sz);
    if (shape === 0 && bevel && geomOptions.bevel && minDim >= 0.2 && maxDim >= 1.2) {
      const bev = Math.min(0.14, minDim * 0.18);
      const g = getBeveled(sx, sy, sz, bev);
      lpos = g.pos; lnrm = g.nrm; lidx = g.idx;
      scale = [1, 1, 1];
      _m.copy(matrix);
    } else {
      // tessellate by girth: thin rails and posts need few sides
      const girth = shape === 2 ? Math.min(sy, sz) : shape === 5 ? Math.min(sx, sz) : minDim;
      const lod = Math.min(geomOptions.maxLod, detail ? (girth > 1.2 ? 2 : 1) : girth > 4 ? 2 : girth > 0.9 ? 1 : 0);
      const g = getTemplate(shape, lod);
      lpos = g.getAttribute('position').array;
      lnrm = g.getAttribute('normal').array;
      lidx = g.index.array;
      const s = shape === 3 ? minDim : null;
      scale = [s ?? sx, s ?? sy, s ?? sz];
      _s.makeScale(scale[0], scale[1], scale[2]);
      _m.multiplyMatrices(matrix, _s);
    }
    _nm.getNormalMatrix(_m);
    const base = this.count;
    const n = lpos.length / 3;
    const e = _m.elements;
    for (let i = 0; i < n; i++) {
      const lx = lpos[i * 3], ly = lpos[i * 3 + 1], lz = lpos[i * 3 + 2];
      this.pos.push(
        e[0] * lx + e[4] * ly + e[8] * lz + e[12],
        e[1] * lx + e[5] * ly + e[9] * lz + e[13],
        e[2] * lx + e[6] * ly + e[10] * lz + e[14],
      );
      const nx = lnrm[i * 3], ny = lnrm[i * 3 + 1], nz = lnrm[i * 3 + 2];
      _v.set(nx, ny, nz).applyMatrix3(_nm).normalize();
      this.nrm.push(_v.x, _v.y, _v.z);
      this.col.push(r, gg, b);
      // box mapping in part space, in studs
      const px = lx * scale[0], py = ly * scale[1], pz = lz * scale[2];
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ax >= ay && ax >= az) this.uv.push(pz + ou, py + ov);
      else if (ay >= az) this.uv.push(px + ou, pz + ov);
      else this.uv.push(px + ou, py + ov);
    }
    for (let i = 0; i < lidx.length; i++) this.idx.push(base + lidx[i]);
    this.count += n;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Material family of a part record
export function partFamily(p, materials) {
  const matName = materials[p[P.MAT]];
  if (matName === 'Neon') return 'neon';
  if (p[P.TRANS] > 0.05 || matName === 'Glass') return 'glass';
  return familyOf(matName);
}

// Build a Group from a list of parts in local space (vehicles, figures,
// items): one mesh per material family.
export function buildModel(parts, materials, { detail = true, shadows = false } = {}) {
  const groups = new Map();
  const m = new THREE.Matrix4();
  for (const p of parts) {
    const fam = partFamily(p, materials);
    let merger = groups.get(fam);
    if (!merger) groups.set(fam, (merger = new Merger()));
    merger.add(p, partMatrix(p, m), materials, detail);
  }
  const root = new THREE.Group();
  for (const [fam, merger] of groups) {
    const mesh = new THREE.Mesh(merger.build(), material(fam));
    mesh.castShadow = shadows && fam !== 'glass' && fam !== 'neon';
    mesh.receiveShadow = shadows && fam !== 'neon';
    if (fam === 'glass') mesh.renderOrder = 2;
    root.add(mesh);
  }
  return root;
}

// Roblox CFrame helpers in plain arrays (for ride math) -------------------
export function setFromBasis(obj, pos, right, up) {
  // look = -(right x up) ... back = right x up
  const back = new THREE.Vector3().crossVectors(right, up);
  const m = new THREE.Matrix4().makeBasis(right, up, back);
  m.setPosition(pos);
  obj.matrix.copy(m);
  obj.matrixWorldNeedsUpdate = true;
}
