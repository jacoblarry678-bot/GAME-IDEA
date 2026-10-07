// Geometry helpers: Roblox-style CFrames, part primitives, and merging many
// parts into a few vertex-colored meshes.
import * as THREE from 'three';

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

function template(shape, detail) {
  let g;
  switch (shape) {
    case 1: g = wedgeGeometry(); break;
    case 2: g = new THREE.CylinderGeometry(0.5, 0.5, 1, detail ? 16 : 10); g.rotateZ(-Math.PI / 2); break;
    case 3: case 4: g = new THREE.SphereGeometry(0.5, detail ? 14 : 9, detail ? 10 : 6); break;
    case 5: g = new THREE.CylinderGeometry(0.5, 0.5, 1, detail ? 16 : 10); break;
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
function getTemplate(shape, detail) {
  const key = shape * 2 + (detail ? 1 : 0);
  if (!templates.has(key)) templates.set(key, template(shape, detail));
  return templates.get(key);
}

const MATERIAL_TINT = {
  Neon: 1.25, Glass: 1.0, Metal: 0.92, DiamondPlate: 0.9, Grass: 0.95, Wood: 0.95, WoodPlanks: 0.97,
};

// Accumulates parts into one indexed, vertex-colored BufferGeometry.
export class Merger {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.count = 0; }
  add(part, matrix, materials, detail = false, colorOverride = null) {
    const shape = part[P.SHAPE];
    const g = getTemplate(shape, detail);
    const s = shape === 3 ? Math.min(part[1], part[2], part[3]) : null;
    const scale = new THREE.Matrix4().makeScale(s ?? part[1], s ?? part[2], s ?? part[3]);
    const m = new THREE.Matrix4().multiplyMatrices(matrix, scale);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    const color = colorOverride ?? part[P.COLOR];
    const tint = MATERIAL_TINT[materials[part[P.MAT]]] ?? 1;
    const r = ((color >> 16) & 255) / 255 * tint, gg = ((color >> 8) & 255) / 255 * tint, b = (color & 255) / 255 * tint;
    const base = this.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      this.nrm.push(v.x, v.y, v.z);
      this.col.push(r, gg, b);
    }
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i++) this.idx.push(base + ia[i]);
    this.count += pa.count;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export const Materials = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  neon: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }),
};

// Build a Group from a list of parts in local space (vehicles, figures,
// items). Solid/neon/glass become up to three meshes.
export function buildModel(parts, materials, { detail = true, shadows = false } = {}) {
  const groups = { solid: new Merger(), neon: new Merger(), glass: new Merger() };
  const m = new THREE.Matrix4();
  for (const p of parts) {
    const matName = materials[p[P.MAT]];
    const key = matName === 'Neon' ? 'neon' : (p[P.TRANS] > 0.05 || matName === 'Glass') ? 'glass' : 'solid';
    groups[key].add(p, partMatrix(p, m), materials, detail);
  }
  const root = new THREE.Group();
  for (const [key, merger] of Object.entries(groups)) {
    if (merger.count === 0) continue;
    const mesh = new THREE.Mesh(merger.build(), Materials[key]);
    mesh.castShadow = shadows && key === 'solid';
    mesh.receiveShadow = false;
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
