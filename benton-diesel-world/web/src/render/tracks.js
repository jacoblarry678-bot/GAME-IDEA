// Ride tracks swept smoothly along each ride's spline: tubular steel
// coaster rails with a spine and brackets, the mine coaster's timber track,
// the log flume channel with its water, roads for the trucks, tram and
// karts, and the railway for the train.
import * as THREE from 'three';
import { Sampler } from '../rides.js';
import { Merger } from '../geom.js';
import { material } from './materials.js';
import { waterMaterial } from './water.js';

const UP = new THREE.Vector3(0, 1, 0);

// Frames along the track, closer together through curves and loops.
// flat: keep roads level (no banking).
function frames(sampler, maxStep, flat, minStep = 0.75) {
  const L = sampler.length;
  const out = [];
  const m = new THREE.Matrix4();
  const at = (s) => {
    sampler.matrixAt(((s % L) + L) % L, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    const right = new THREE.Vector3().setFromMatrixColumn(m, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(m, 1);
    const back = new THREE.Vector3().setFromMatrixColumn(m, 2);
    if (flat) {
      right.crossVectors(UP, back).normalize();
      up.copy(UP);
    }
    return { s, pos, right, up, back };
  };
  let cur = at(0);
  out.push(cur);
  const cosMax = Math.cos((5 * Math.PI) / 180);
  while (cur.s < L - 1e-3) {
    let step = Math.min(maxStep, L - cur.s);
    let next = at(cur.s + step);
    while (step > minStep && (next.back.dot(cur.back) < cosMax || next.up.dot(cur.up) < cosMax)) {
      step = Math.max(minStep, step / 2);
      next = at(cur.s + step);
    }
    out.push(next);
    cur = next;
  }
  // close the loop exactly
  const last = out[out.length - 1];
  const first = out[0];
  last.pos.copy(first.pos);
  last.right.copy(first.right);
  last.up.copy(first.up);
  return out;
}

// Sweep a 2D profile (in the right/up plane) along frames. Profile points
// are [x, y, nx, ny]; `strips` lists runs of points joined edge to edge.
function sweep(fr, profile, color, { offY = 0, uScale = 1 } = {}) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const c = new THREE.Color(color);
  const np = profile.length;
  // distance around the profile for the texture's v
  const around = [0];
  for (let k = 1; k < np; k++) around.push(around[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  fr.forEach((f) => {
    for (let k = 0; k < np; k++) {
      const [x, y, nx, ny] = profile[k];
      pos.push(
        f.pos.x + f.right.x * x + f.up.x * (y + offY),
        f.pos.y + f.right.y * x + f.up.y * (y + offY),
        f.pos.z + f.right.z * x + f.up.z * (y + offY),
      );
      const n = new THREE.Vector3().addScaledVector(f.right, nx).addScaledVector(f.up, ny).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(f.s * uScale, around[k]);
      col.push(c.r, c.g, c.b);
    }
  });
  for (let i = 0; i < fr.length - 1; i++) {
    for (let k = 0; k < np - 1; k++) {
      if (profile[k][4] === 'break') continue; // hard edge: next point starts a new face
      const a = i * np + k, b = a + 1, d = a + np, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  return { pos, nrm, uv, col, idx };
}

// call fn(frame, n) at every `spacing` studs along the frames
function every(fr, spacing, fn) {
  let next = 0, n = 0;
  for (let i = 0; i < fr.length - 1; i++) {
    const a = fr[i], b = fr[i + 1];
    while (next <= b.s && next < fr[fr.length - 1].s - 0.5) {
      const t = b.s > a.s ? (next - a.s) / (b.s - a.s) : 0;
      fn({
        s: next,
        pos: a.pos.clone().lerp(b.pos, t),
        right: a.right.clone().lerp(b.right, t).normalize(),
        up: a.up.clone().lerp(b.up, t).normalize(),
      }, n++);
      next += spacing;
    }
  }
}

function circle(cx, cy, r, seg) {
  const out = [];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
  }
  return out;
}

// closed polygon with flat faces (each edge gets its own pair of points)
function polygon(pts) {
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len = Math.hypot(ex, ey) || 1;
    // outward normal for counter-clockwise polygons
    const nx = ey / len, ny = -ex / len;
    out.push([a[0], a[1], nx, ny], [b[0], b[1], nx, ny, 'break']);
  }
  return out;
}

function merge(parts) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  for (const p of parts) {
    const base = pos.length / 3;
    pos.push(...p.pos); nrm.push(...p.nrm); uv.push(...p.uv); col.push(...p.col);
    for (const i of p.idx) idx.push(i + base);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Boxes placed along the track (ties, brackets, dashes).
class Boxes {
  constructor(materials) {
    this.materials = materials;
    this.mergers = new Map();
    this.m = new THREE.Matrix4();
  }
  // a box at `offset` in the frame f (right, up, back), optionally tilted
  // so its own up axis points along `dir` (given in the frame's right/up)
  add(family, matName, f, size, offset, color, dir = null) {
    let mg = this.mergers.get(family);
    if (!mg) this.mergers.set(family, (mg = new Merger()));
    const back = new THREE.Vector3().crossVectors(f.right, f.up);
    const p = f.pos.clone().addScaledVector(f.right, offset[0]).addScaledVector(f.up, offset[1]).addScaledVector(back, offset[2] || 0);
    let right = f.right, up = f.up;
    if (dir) {
      up = new THREE.Vector3().addScaledVector(f.right, dir[0]).addScaledVector(f.up, dir[1]).normalize();
      right = new THREE.Vector3().crossVectors(up, back).normalize();
    }
    this.m.makeBasis(right, up, back).setPosition(p);
    const mat = Math.max(0, this.materials.indexOf(matName));
    const part = [0, size[0], size[1], size[2], p.x, p.y, p.z, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mat, 0, 0];
    mg.add(part, this.m, this.materials, true);
  }
  meshes() {
    const out = [];
    for (const [fam, mg] of this.mergers) {
      if (!mg.count) continue;
      const mesh = new THREE.Mesh(mg.build(), material(fam));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }
}

function steel(fr, color, boxes) {
  const parts = [];
  for (const x of [-1.6, 1.6]) parts.push(sweep(fr, circle(x, -0.25, 0.36, 8), color));
  parts.push(sweep(fr, circle(0, -1.4, 0.62, 10), color));
  const grey = 0x8e949c;
  every(fr, 4, (f) => {
    boxes.add('metal', 'Metal', f, [3.5, 0.28, 0.42], [0, -0.55, 0], color);
    // struts from the spine up to each rail
    for (const x of [-1, 1]) boxes.add('metal', 'Metal', f, [0.28, 1.9, 0.3], [x * 0.8, -0.82, 0], grey, [x * 1.6, 1.15]);
  });
  return parts;
}

function wooden(fr, boxes) {
  const parts = [];
  const steelGrey = 0x6a6d74;
  for (const x of [-1.6, 1.6]) parts.push(sweep(fr, polygon([[x - 0.25, -0.42], [x + 0.25, -0.42], [x + 0.25, -0.08], [x - 0.25, -0.08]]), steelGrey));
  const timber = 0x7c5638;
  // stringers under the ties
  for (const x of [-1.9, 1.9]) parts.push(sweep(fr, polygon([[x - 0.3, -1.55], [x + 0.3, -1.55], [x + 0.3, -0.95], [x - 0.3, -0.95]]), timber));
  every(fr, 2, (f) => {
    boxes.add('wood', 'Wood', f, [4.6, 0.45, 1.0], [0, -0.7, 0], timber);
  });
  return parts;
}

function flume(fr) {
  const wood = 0x7a5536;
  const channel = polygon([
    [-3.65, 1.85], [-3.65, -1.65], [3.65, -1.65], [3.65, 1.85], [3.0, 1.85], [3.0, -1.0], [-3.0, -1.0], [-3.0, 1.85],
  ]);
  return sweep(fr, channel, wood, { uScale: 1 });
}

function road(fr, cfg, boxes) {
  const w = cfg.width || 8, drop = cfg.drop || 1;
  const parts = [];
  // asphalt with slightly rounded shoulders
  parts.push(sweep(fr, polygon([[-w / 2, -0.5], [w / 2, -0.5], [w / 2, 0.45], [w / 2 - 0.15, 0.5], [-w / 2 + 0.15, 0.5], [-w / 2, 0.45]]), cfg.color || 0x505056, { offY: -drop }));
  // curbs alternate colors every few studs, dashes down the middle
  every(fr, 4, (f, i) => {
    if (cfg.dash && i % 2 === 0) boxes.add('paint', 'SmoothPlastic', f, [0.35, 0.06, 2.2], [0, -drop + 0.52, 0], cfg.dash);
    if (cfg.curbs) {
      const red = i % 2 === 0;
      for (const sx of [-1, 1]) boxes.add('paint', 'SmoothPlastic', f, [1.1, 0.5, 4.05], [sx * (w / 2 + 0.55), -drop + 0.3, -2], red ? 0xc8322d : 0xf2f2f2);
    }
  });
  return parts;
}

function railway(fr, boxes) {
  const parts = [];
  // ballast bed (level with the ground)
  const bed = fr.map((f) => ({ ...f, pos: new THREE.Vector3(f.pos.x, -0.1, f.pos.z) }));
  parts.push(sweep(bed, polygon([[-3.6, -0.5], [3.6, -0.5], [2.6, 0.5], [-2.6, 0.5]]), 0x7d7870));
  const steelC = 0x8a8c92;
  for (const x of [-2, 2]) {
    parts.push(sweep(fr, polygon([
      [x - 0.32, -1.68], [x + 0.32, -1.68], [x + 0.32, -1.6], [x + 0.08, -1.55], [x + 0.08, -1.3], [x + 0.2, -1.27], [x + 0.2, -1.12], [x - 0.2, -1.12], [x - 0.2, -1.27], [x - 0.08, -1.3], [x - 0.08, -1.55], [x - 0.32, -1.6],
    ]), steelC));
  }
  every(fr, 3, (f) => {
    boxes.add('wood', 'Wood', f, [6.0, 0.32, 0.9], [0, -1.86, 0], 0x5e4430);
  });
  return parts;
}

export function buildTracks(scene, data) {
  const group = new THREE.Group();
  group.name = 'tracks';
  for (const r of data.rides) {
    const cfg = r.trackStyle;
    if (!cfg || !r.track) continue;
    const sampler = new Sampler(r.track);
    const flat = cfg.style === 'road' || cfg.style === 'rails';
    const fr = frames(sampler, flat ? 6 : 4, flat);
    const boxes = new Boxes(data.materials);
    let parts = [];
    let fam = 'metal';
    if (cfg.style === 'steel') parts = steel(fr, cfg.color || 0xc04040, boxes);
    else if (cfg.style === 'wood') parts = wooden(fr, boxes);
    else if (cfg.style === 'flume') { parts = [flume(fr)]; fam = 'planks'; }
    else if (cfg.style === 'road') { parts = road(fr, cfg, boxes); fam = 'stone'; }
    else if (cfg.style === 'rails') parts = railway(fr, boxes);
    if (cfg.style === 'rails') {
      // ballast is stone, the rails steel
      const [bed, ...rails] = parts;
      const bedMesh = new THREE.Mesh(merge([bed]), material('stone'));
      bedMesh.receiveShadow = true;
      group.add(bedMesh);
      parts = rails;
    }
    if (parts.length) {
      const mesh = new THREE.Mesh(merge(parts), material(fam));
      mesh.castShadow = cfg.style !== 'road';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const m of boxes.meshes()) group.add(m);
    if (cfg.style === 'flume') {
      const water = new THREE.Mesh(merge([sweep(fr, [[3.0, 0, 0, 1], [-3.0, 0, 0, 1]], 0xffffff, { offY: 0.3 })]), waterMaterial({ color: 0x2a6070, opacity: 0.82, scale: 1.6 }));
      water.renderOrder = 1;
      group.add(water);
    }
  }
  scene.add(group);
  return group;
}
