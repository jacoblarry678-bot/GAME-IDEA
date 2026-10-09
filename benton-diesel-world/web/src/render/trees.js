// Trees: procedurally grown broadleaf trees, pines and palms with bark,
// leafy canopies that sway in the breeze, drawn instanced. The park's
// trees come from park.json; forests fill the countryside around it.
import * as THREE from 'three';
import { rng } from './noise.js';
import { material } from './materials.js';
import { fbm2 } from './terrain.js';

export const treeTime = { value: 0 };

// ------------------------------------------------------------ textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function leafTexture() {
  return canvasTex(512, 512, (ctx, W, H) => {
    const rand = rng(5);
    // twigs
    ctx.strokeStyle = 'rgba(70,52,34,0.9)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2 + (rand() - 0.5) * W * 0.8, H / 2 + (rand() - 0.5) * H * 0.8);
      ctx.stroke();
    }
    for (let i = 0; i < 150; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * W * 0.42;
      const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
      const len = 26 + rand() * 22, wid = len * (0.38 + rand() * 0.14);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI * 2);
      const l = 22 + rand() * 22, sat = 40 + rand() * 25, hue = 82 + rand() * 38;
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      g.addColorStop(0, `hsl(${hue},${sat}%,${l * 0.8}%)`);
      g.addColorStop(1, `hsl(${hue + 6},${sat}%,${l * 1.2}%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.quadraticCurveTo(0, -wid, len / 2, 0);
      ctx.quadraticCurveTo(0, wid, -len / 2, 0);
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue},30%,${l + 18}%,0.5)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function needleTexture() {
  return canvasTex(512, 256, (ctx, W, H) => {
    const rand = rng(9);
    // a branch along the middle with needles bristling out of it
    for (let pass = 0; pass < 3; pass++) {
      const y0 = H / 2 + (pass - 1) * H * 0.22;
      ctx.strokeStyle = 'rgba(80,58,38,0.95)';
      ctx.lineWidth = pass === 1 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.quadraticCurveTo(W * 0.5, y0, W, y0);
      ctx.stroke();
      for (let i = 0; i < 520; i++) {
        const u = rand();
        const x = u * W;
        const y = H / 2 + (y0 - H / 2) * u * u + (rand() - 0.5) * 4;
        const reach = (1 - u * 0.65) * (pass === 1 ? 0.4 : 0.26) * H;
        const a = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.9);
        const l = 14 + rand() * 22, hue = 105 + rand() * 30;
        ctx.strokeStyle = `hsl(${hue},${35 + rand() * 25}%,${l}%)`;
        ctx.lineWidth = 1.6 + rand() * 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * reach * 0.6 + reach * 0.3, y + Math.sin(a) * reach);
        ctx.stroke();
      }
    }
  });
}

function frondTexture() {
  return canvasTex(512, 128, (ctx, W, H) => {
    const rand = rng(13);
    ctx.strokeStyle = 'rgb(120,130,60)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    for (let i = 0; i < 110; i++) {
      const x = 12 + (i / 110) * (W - 20);
      const reach = (Math.sin((i / 110) * Math.PI) * 0.85 + 0.15) * H * 0.48;
      for (const side of [-1, 1]) {
        const hue = 85 + rand() * 25, l = 24 + rand() * 18;
        ctx.strokeStyle = `hsl(${hue},${45 + rand() * 20}%,${l}%)`;
        ctx.lineWidth = 3 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, H / 2);
        ctx.quadraticCurveTo(x + reach * 0.3, H / 2 + side * reach * 0.6, x + reach * 0.55, H / 2 + side * reach);
        ctx.stroke();
      }
    }
  });
}

// ----------------------------------------------------------- geometry
// Accumulates triangles with position/normal/uv/color.
class Builder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(p, n, u, v, c = 1) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(c, c, c);
    return this.n - 1;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// tapered tube through points (bark: u runs along, v around)
function tube(b, pts, radii, seg, color = 1) {
  const up = new THREE.Vector3(0, 1, 0);
  let along = 0;
  const rings = [];
  for (let i = 0; i < pts.length; i++) {
    const t = (i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
    const side = Math.abs(t.dot(up)) > 0.95 ? new THREE.Vector3(1, 0, 0) : up;
    const x = new THREE.Vector3().crossVectors(t, side).normalize();
    const y = new THREE.Vector3().crossVectors(x, t).normalize();
    if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
    const ring = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const n = x.clone().multiplyScalar(Math.cos(a)).addScaledVector(y, Math.sin(a));
      const p = pts[i].clone().addScaledVector(n, radii[i]);
      ring.push(b.v(p, n, along / 2, (k / seg) * radii[i] * 2, color));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k], c = rings[i][k + 1], d = rings[i + 1][k], e = rings[i + 1][k + 1];
      b.idx.push(a, d, c, c, d, e);
    }
  }
}

// a leaf card: quad centered at c facing n; normals bend toward `out`
function card(b, c, right, up, w, h, out, shade, uv = [0, 0, 1, 1]) {
  const n = new THREE.Vector3().crossVectors(right, up).normalize();
  const nn = n.clone().multiplyScalar(0.35).addScaledVector(out, 0.65).normalize();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const ids = corners.map(([sx, sy]) => {
    const p = c.clone().addScaledVector(right, sx * w / 2).addScaledVector(up, sy * h / 2);
    return b.v(p, nn, sx < 0 ? uv[0] : uv[2], sy < 0 ? uv[1] : uv[3], shade);
  });
  b.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
}

function randomUnit(rand) {
  const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
}

function broadleaf(seed, far = false) {
  const rand = rng(seed);
  const bark = new Builder(), leaves = new Builder();
  const lean = new THREE.Vector3((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8);
  const trunkTop = 7.5 + rand() * 1.5;
  const trunk = [];
  const radii = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunk.push(new THREE.Vector3(lean.x * t * t, t * trunkTop, lean.z * t * t));
    radii.push(0.85 * (1 - t * 0.55) + (i === 0 ? 0.25 : 0));
  }
  tube(bark, trunk, radii, far ? 5 : 9, 0.85);
  const center = new THREE.Vector3(lean.x, trunkTop + 3.2, lean.z);
  const ends = [];
  const nb = far ? 0 : 5 + Math.floor(rand() * 3);
  for (let i = 0; i < nb; i++) {
    const h = trunkTop * (0.62 + rand() * 0.38);
    const start = new THREE.Vector3(lean.x * (h / trunkTop) ** 2, h, lean.z * (h / trunkTop) ** 2);
    const a = (i / nb) * Math.PI * 2 + rand() * 0.6;
    const dir = new THREE.Vector3(Math.cos(a), 0.7 + rand() * 0.6, Math.sin(a)).normalize();
    const len = 4 + rand() * 2.5;
    const mid = start.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(0, 0.4, 0));
    const end = start.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, 0.6, 0));
    tube(bark, [start, mid, end], [0.38, 0.24, 0.1], 6, 0.85);
    ends.push(end);
  }
  // canopy: leafy clusters over an irregular dome
  const R = 6 + rand() * 1.2, Ry = 4.6 + rand() * 0.8;
  const clusters = [];
  for (const e of ends) clusters.push(e.clone());
  for (let i = 0; i < (far ? 16 : 46); i++) {
    const d = randomUnit(rand);
    if (d.y < -0.55) d.y *= 0.4;
    const r = 0.55 + 0.45 * Math.cbrt(rand());
    clusters.push(new THREE.Vector3(center.x + d.x * R * r, center.y + d.y * Ry * r, center.z + d.z * R * r));
  }
  for (const c of clusters) {
    const out = c.clone().sub(center);
    const depth = Math.min(1, out.length() / R);
    out.normalize();
    const shade = 0.5 + 0.5 * depth + Math.max(0, out.y) * 0.1;
    const size = (far ? 5.2 : 3.6) + rand() * 1.6;
    for (let k = 0; k < (far ? 2 : 3); k++) {
      const n = randomUnit(rand).lerp(out, 0.4).normalize();
      const right = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const upv = new THREE.Vector3().crossVectors(right, n).normalize();
      card(leaves, c, right, upv, size, size, out, shade);
    }
  }
  return { bark: bark.geometry(), leaves: leaves.geometry(), height: center.y + Ry };
}

function pine(seed, far = false) {
  const rand = rng(seed);
  const bark = new Builder(), leaves = new Builder();
  const H = 17 + rand() * 3;
  const pts = [], radii = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector3((rand() - 0.5) * 0.2, t * H, (rand() - 0.5) * 0.2));
    radii.push(0.7 * (1 - t) + 0.06);
  }
  tube(bark, pts, radii, far ? 5 : 8, 0.8);
  const axis = new THREE.Vector3(0, 1, 0);
  for (let y = 2.6; y < H - 0.4; y += (far ? 1.7 : 0.85) + rand() * 0.3) {
    const t = (y - 2.6) / (H - 2.6);
    const len = (1 - t) * 6.5 + 0.9;
    const count = far ? 5 : 7 + Math.floor(rand() * 3);
    const shade = 0.55 + 0.45 * t;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.5 + y;
      const dir = new THREE.Vector3(Math.cos(a), -0.28 - rand() * 0.2 + t * 0.25, Math.sin(a)).normalize();
      const c = new THREE.Vector3(0, y, 0).addScaledVector(dir, len / 2);
      const side = new THREE.Vector3().crossVectors(dir, axis).normalize();
      const flatUp = new THREE.Vector3().crossVectors(side, dir).normalize();
      const out = new THREE.Vector3(Math.cos(a), 0.35, Math.sin(a)).normalize();
      // a flat spray and a tilted one give the branch some volume
      card(leaves, c, dir, side, len, len * (far ? 0.7 : 0.55), out, shade);
      if (far) continue;
      const tilt = side.clone().multiplyScalar(0.6).addScaledVector(flatUp, 0.8).normalize();
      card(leaves, c, dir, tilt, len, len * 0.42, out, shade * 0.95);
    }
  }
  // a tuft on top
  const top = new THREE.Vector3(0, H, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    card(leaves, top.clone().add(new THREE.Vector3(0, -0.6, 0)), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), axis, 1.6, 2.4, axis, 1);
  }
  return { bark: bark.geometry(), leaves: leaves.geometry(), height: H };
}

function palm(seed) {
  const rand = rng(seed);
  const bark = new Builder(), leaves = new Builder();
  const H = 16 + rand() * 2;
  const bend = new THREE.Vector3((rand() - 0.5) * 4, 0, (rand() - 0.5) * 4);
  const pts = [], radii = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(bend.x * t * t, t * H, bend.z * t * t));
    radii.push(0.62 - t * 0.2 + (i % 2) * 0.04);
  }
  tube(bark, pts, radii, 8, 0.95);
  const top = pts[pts.length - 1];
  const fronds = 9 + Math.floor(rand() * 3);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rand() * 0.3;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const L = 8 + rand() * 2.5;
    const rise = 0.6 + rand() * 0.6;
    const segs = 6;
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const p = top.clone().addScaledVector(out, t * L).add(new THREE.Vector3(0, Math.sin(t * Math.PI * 0.8) * rise * 2.4 - t * t * 4.2, 0));
      const w = (Math.sin(t * Math.PI) * 0.8 + 0.2) * 1.5;
      const nrm = new THREE.Vector3(0, 1, 0).addScaledVector(out, 0.3).normalize();
      const l = leaves.v(p.clone().addScaledVector(side, -w), nrm, t, 0, 0.9);
      const r = leaves.v(p.clone().addScaledVector(side, w), nrm, t, 1, 0.9);
      if (prev) leaves.idx.push(prev[0], l, prev[1], prev[1], l, r);
      prev = [l, r];
    }
  }
  return { bark: bark.geometry(), leaves: leaves.geometry(), height: H + 2 };
}

// ------------------------------------------------------------ the trees
function swayMaterial(map, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.55, ...opts,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = treeTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
          vec2 org = instanceMatrix[3].xz;
          #else
          vec2 org = vec2(0.0);
          #endif
          float k = max(0.0, position.y - 3.0) * 0.012;
          float t = uTime * 1.4 + org.x * 0.07 + org.y * 0.05;
          transformed.x += (sin(t) + 0.4 * sin(t * 2.7 + position.z)) * k;
          transformed.z += (cos(t * 0.8) + 0.4 * sin(t * 2.1 + position.x)) * k * 0.7;
        }`);
  };
  m.customProgramCacheKey = () => 'sway';
  return m;
}

export class Trees {
  constructor(scene, data, terrain, quality) {
    this.scene = scene;
    const variants = { round: [], pine: [], palm: [], farround: [], farpine: [] };
    for (let i = 0; i < 3; i++) {
      variants.round.push(broadleaf(101 + i * 17));
      variants.pine.push(pine(201 + i * 17));
      variants.palm.push(palm(301 + i * 17));
      // simpler trees for the distant woods
      variants.farround.push(broadleaf(401 + i * 17, true));
      variants.farpine.push(pine(501 + i * 17, true));
    }
    const leafMat = swayMaterial(leafTexture());
    const needleMat = swayMaterial(needleTexture());
    const frondMat = swayMaterial(frondTexture());
    const barkMat = material('wood');
    const mats = { round: leafMat, pine: needleMat, palm: frondMat, farround: leafMat, farpine: needleMat };

    // instances: park trees, then countryside forest
    const lists = new Map();
    const add = (kind, x, y, z, s, tint) => {
      const h = Math.abs(Math.sin(x * 12.99 + z * 78.23) * 43758.5) % 1;
      const v = Math.floor(h * 3);
      const key = `${kind}:${v}`;
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key).push({ x, y, z, s, rot: h * 40, tint });
    };
    const tint = new THREE.Color();
    for (const t of data.trees || []) {
      const [x, , z] = t.pos;
      const leaf = new THREE.Color(t.leaf || 0x3a7d34);
      const m = Math.max(leaf.r, leaf.g, leaf.b) || 1;
      tint.setRGB(1, 1, 1).lerp(new THREE.Color(leaf.r / m, leaf.g / m, leaf.b / m), 0.3);
      add(t.kind, x, terrain.heightAt(x, z), z, (t.s || 1) * 1.12, tint.clone());
    }
    const forest = quality.name === 'low' ? 160 : 700;
    const rand = rng(77);
    let placed = 0, tries = 0;
    while (placed < forest && tries < forest * 30) {
      tries++;
      const x = (rand() - 0.5) * 2400, z = (rand() - 0.5) * 2400;
      const out = terrain.outside(x, z);
      if (out < 40) continue;
      // clumps of woodland
      if (fbm2(x * 0.006, z * 0.006, 3) < 0.48) continue;
      const kind = fbm2(x * 0.01 + 50, z * 0.01, 2) > 0.5 ? 'farpine' : 'farround';
      const shade = 0.75 + rand() * 0.35;
      add(kind, x, terrain.heightAt(x, z) - 0.3, z, 1.2 + rand() * 0.9, new THREE.Color(shade, shade * (0.95 + rand() * 0.1), shade * 0.9));
      placed++;
    }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    this.meshes = [];
    for (const [key, list] of lists) {
      const [kind, v] = key.split(':');
      const geo = variants[kind][+v];
      const bark = new THREE.InstancedMesh(geo.bark, barkMat, list.length);
      const leaves = new THREE.InstancedMesh(geo.leaves, mats[kind], list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot);
        p.set(t.x, t.y, t.z);
        sc.setScalar(t.s);
        m4.compose(p, q, sc);
        bark.setMatrixAt(i, m4);
        leaves.setMatrixAt(i, m4);
        leaves.setColorAt(i, t.tint);
        bark.setColorAt(i, new THREE.Color(0.55, 0.42, 0.32));
      });
      for (const mesh of [bark, leaves]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        scene.add(mesh);
        this.meshes.push(mesh);
      }
    }
  }

  update(t) {
    treeTime.value = t;
  }
}
