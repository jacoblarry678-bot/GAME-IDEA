// People: a smooth, properly proportioned human body built from lofted
// sections (torso, limbs) and shaped ellipsoids (head, hands, shoes), with
// clothing regions, hair styles and a face. The body is split into
// segments on a joint rig so it can be animated live (the player) or baked
// into poses for crowds drawn with instancing.
//
// Each vertex carries a region (skin, shirt, sleeves, pants, shoes, hair
// styles, hat, face details) that the shader colors per person, and a
// delta that morphs the body from a broader to a slimmer, curvier build.
import * as THREE from 'three';

export const R = {
  SKIN: 0, SHIRT: 1, SLEEVE: 2, PANTS: 3, LEGWEAR: 4, SHOES: 5,
  HAIR: 6, HAIR_LONG: 7, HAIR_TAIL: 8, HAT: 9, DARK: 10, WHITE: 11, LIPS: 12, BRIM: 13,
};

// ---------------------------------------------------------------- rig
// Joint rest positions (figure space: feet at y=0, facing -Z) for a body
// build f (0 broad .. 1 slim/curvy).
export const JOINTS = ['hips', 'spine', 'neck', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR'];
export const PARENT = {
  hips: null, spine: 'hips', neck: 'spine',
  shoulderL: 'spine', elbowL: 'shoulderL', shoulderR: 'spine', elbowR: 'shoulderR',
  hipL: 'hips', kneeL: 'hipL', hipR: 'hips', kneeR: 'hipR',
};
export function jointRest(f) {
  const sx = 0.71 - 0.06 * f;
  return {
    hips: [0, 2.82, 0],
    spine: [0, 3.18, 0],
    neck: [0, 4.5, 0],
    shoulderL: [-sx, 4.34, 0.02],
    elbowL: [-sx - 0.05, 3.5, 0.05],
    shoulderR: [sx, 4.34, 0.02],
    elbowR: [sx + 0.05, 3.5, 0.05],
    hipL: [-0.27, 2.7, 0],
    kneeL: [-0.25, 1.5, -0.03],
    hipR: [0.27, 2.7, 0],
    kneeR: [0.25, 1.5, -0.03],
  };
}
export const WRIST_DROP = 0.78; // elbow to wrist
export const ANKLE_DROP = 1.2; // knee to ankle

// --------------------------------------------------------- geometry kit
class Mesh {
  constructor() { this.pos = []; this.idx = []; this.reg = []; }
  get n() { return this.pos.length / 3; }
  vert(x, y, z, r) { this.pos.push(x, y, z); this.reg.push(r); return this.n - 1; }
}

// superellipse ring point
function ring(w, d, a, p = 2.4) {
  const c = Math.cos(a), s = Math.sin(a);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * w;
  const z = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * d;
  return [x, z];
}

// Loft through horizontal-ish sections along an axis from a to b.
// sections: [{t (0..1 along), w, d, cx, cz, p}] ; region(t, angle)
function loft(m, a, b, sections, seg, region, { capStart = true, capEnd = true } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const axis = B.clone().sub(A);
  const len = axis.length();
  axis.normalize();
  // frame: x = world X projected, z perpendicular
  let X = new THREE.Vector3(1, 0, 0);
  if (Math.abs(axis.dot(X)) > 0.9) X = new THREE.Vector3(0, 0, 1);
  X.sub(axis.clone().multiplyScalar(X.dot(axis))).normalize();
  const Z = new THREE.Vector3().crossVectors(X, axis).normalize();
  const rings = [];
  for (const s of sections) {
    const c = A.clone().addScaledVector(axis, s.t * len).addScaledVector(X, s.cx || 0).addScaledVector(Z, s.cz || 0);
    const r = [];
    for (let k = 0; k < seg; k++) {
      const ang = (k / seg) * Math.PI * 2;
      const [x, z] = ring(s.w, s.d, ang, s.p || 2.2);
      const p = c.clone().addScaledVector(X, x).addScaledVector(Z, z);
      r.push(m.vert(p.x, p.y, p.z, region(s.t, ang)));
    }
    rings.push({ r, c, t: s.t });
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a0 = rings[i].r[k], a1 = rings[i].r[(k + 1) % seg], b0 = rings[i + 1].r[k], b1 = rings[i + 1].r[(k + 1) % seg];
      m.idx.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const cap = (rg, flip, inset) => {
    const c = rg.c.clone().addScaledVector(axis, inset);
    const ci = m.vert(c.x, c.y, c.z, region(rg.t, 0));
    for (let k = 0; k < seg; k++) {
      const a0 = rg.r[k], a1 = rg.r[(k + 1) % seg];
      if (flip) m.idx.push(ci, a1, a0); else m.idx.push(ci, a0, a1);
    }
  };
  if (capStart) cap(rings[0], false, -0.04);
  if (capEnd) cap(rings[rings.length - 1], true, 0.04);
}

// Ellipsoid with an optional per-vertex deform(x, y, z) -> [x, y, z]
function ellipsoid(m, c, r, seg, region, deform = null) {
  const rows = Math.max(4, Math.round(seg * 0.6));
  const start = m.n;
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const phi = v * Math.PI;
    for (let k = 0; k < seg; k++) {
      const th = (k / seg) * Math.PI * 2;
      let x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      x *= r[0]; y *= r[1]; z *= r[2];
      if (deform) [x, y, z] = deform(x, y, z);
      m.vert(c[0] + x, c[1] + y, c[2] + z, region(x, y, z));
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let k = 0; k < seg; k++) {
      const a0 = start + j * seg + k, a1 = start + j * seg + ((k + 1) % seg);
      const b0 = a0 + seg, b1 = a1 + seg;
      m.idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
}

// ------------------------------------------------------------- segments
// Tessellation per level of detail: 0 far crowd, 1 near crowd, 2 close up
const LOD = [
  { S: 8, L: 5, head: 8, cap: 9, face: false, part: 5, hair: 6 },
  { S: 11, L: 7, head: 12, cap: 14, face: true, part: 5, hair: 8 },
  { S: 14, L: 9, head: 16, cap: 22, face: true, part: 7, hair: 12 },
];

// Geometry for each body segment in figure rest space, keyed by the joint
// it hangs from.
function segments(f, detail) {
  const J = jointRest(f);
  const Q = LOD[detail];
  const S = Q.S; // around the torso
  const L = Q.L; // around limbs
  const out = {};
  const lerp = (a, b) => a + (b - a) * f;

  // pelvis: hips to waist, in pants
  {
    const m = new Mesh();
    loft(m, [0, 2.5, 0], [0, 3.24, 0], [
      { t: 0, w: 0.26, d: 0.2 },
      { t: 0.12, w: lerp(0.44, 0.46), d: lerp(0.28, 0.3) },
      { t: 0.45, w: lerp(0.49, 0.54), d: lerp(0.31, 0.33), cz: 0.01 },
      { t: 0.75, w: lerp(0.47, 0.45), d: lerp(0.29, 0.28) },
      { t: 1, w: lerp(0.44, 0.38), d: lerp(0.28, 0.25) },
    ], S, () => R.PANTS);
    out.hips = m;
  }
  // chest: waist to neck
  {
    const m = new Mesh();
    loft(m, [0, 3.12, 0], [0, 4.6, 0], [
      { t: 0, w: lerp(0.44, 0.38), d: lerp(0.28, 0.25) },
      { t: 0.2, w: lerp(0.46, 0.4), d: lerp(0.29, 0.27) },
      { t: 0.45, w: lerp(0.53, 0.47), d: lerp(0.32, 0.36), cz: lerp(-0.01, -0.05) },
      { t: 0.66, w: lerp(0.6, 0.5), d: lerp(0.32, 0.31), cz: lerp(0, -0.02) },
      { t: 0.82, w: lerp(0.6, 0.5), d: lerp(0.27, 0.25) },
      { t: 0.9, w: lerp(0.52, 0.44), d: 0.24 },
      { t: 0.96, w: lerp(0.32, 0.27), d: 0.18 },
      { t: 1, w: 0.16, d: 0.14 },
    ], S, () => R.SHIRT);
    out.spine = m;
  }
  // head and neck, face, hair, hat
  {
    const m = new Mesh();
    const hc = [0, 5.06, -0.02];
    loft(m, [0, 4.42, 0.02], [0, 4.86, 0.0], [
      { t: 0, w: lerp(0.15, 0.125), d: lerp(0.15, 0.125) },
      { t: 1, w: lerp(0.135, 0.115), d: lerp(0.135, 0.115) },
    ], L, () => R.SKIN, { capStart: false, capEnd: false });
    const hr = [lerp(0.3, 0.285), 0.37, lerp(0.34, 0.325)];
    const jaw = (x, y, z) => {
      if (y < 0) {
        const t = Math.min(1, -y / hr[1]);
        x *= 1 - 0.28 * t * t;
        z = z * (1 - 0.22 * t) - 0.03 * t;
      }
      return [x, y, z];
    };
    ellipsoid(m, hc, hr, Q.head, () => R.SKIN, jaw);
    // ears and nose
    if (Q.face) for (const sx of [-1, 1]) ellipsoid(m, [sx * hr[0] * 0.98, hc[1] - 0.01, hc[2] + 0.02], [0.045, 0.085, 0.06], 6, () => R.SKIN);
    if (Q.face) ellipsoid(m, [0, hc[1] - 0.04, hc[2] - hr[2] - 0.0], [0.038, 0.065, 0.05], 6, () => R.SKIN, (x, y, z) => [x * (y > 0 ? 0.7 : 1), y, z]);
    // eyes, brows, mouth
    if (Q.face) for (const sx of [-1, 1]) {
      ellipsoid(m, [sx * 0.105, hc[1] + 0.04, hc[2] - hr[2] + 0.045], [0.046, 0.028, 0.03], 6, () => R.WHITE);
      ellipsoid(m, [sx * 0.105, hc[1] + 0.04, hc[2] - hr[2] + 0.028], [0.022, 0.022, 0.02], 5, () => R.DARK);
      ellipsoid(m, [sx * 0.11, hc[1] + 0.125, hc[2] - hr[2] + 0.055], [0.07, 0.016, 0.025], 5, () => R.HAIR);
    }
    if (Q.face) ellipsoid(m, [0, hc[1] - 0.17, hc[2] - hr[2] + 0.075], [0.075, 0.018, 0.025], 6, () => R.LIPS);
    // hair cap: points outside the hairline sink below the scalp
    const capR = [hr[0] * 1.07, hr[1] * 1.06, hr[2] * 1.08];
    ellipsoid(m, [hc[0], hc[1] + 0.02, hc[2] + 0.01], capR, Q.cap, () => R.HAIR, (x, y, z) => {
      const front = Math.max(0, -z / capR[2]); // 1 at the forehead
      const line = (-0.05 + front * 0.2 - Math.max(0, z / capR[2]) * 0.22) * capR[1] / 0.37;
      const inside = 0.86 + 0.14 * THREE.MathUtils.smoothstep(y, line - 0.03, line + 0.03);
      return jaw(x * inside, y * inside, z * inside);
    });
    // long hair down the back, ponytail
    ellipsoid(m, [0, hc[1] - 0.26, hc[2] + 0.17], [hr[0] * 1.05, 0.5, 0.17], Q.hair, () => R.HAIR_LONG, (x, y, z) => [x * (1 - Math.max(0, -y) * 0.3), y, z + Math.max(0, -y) * 0.06]);
    ellipsoid(m, [0, hc[1] - 0.12, hc[2] + 0.42], [0.09, 0.27, 0.09], Q.part, () => R.HAIR_TAIL, (x, y, z) => [x, y, z + Math.max(0, -y) * 0.25]);
    // cap with a brim
    const hatR = [hr[0] * 1.13, hr[1] * 1.08, hr[2] * 1.12];
    ellipsoid(m, [hc[0], hc[1] + 0.04, hc[2] + 0.01], hatR, Q.hair, () => R.HAT, (x, y, z) => {
      const k = y < 0.06 ? 0.8 : 1;
      return [x * k, Math.max(y, 0.04) * (y < 0.06 ? 0.8 : 1), z * k];
    });
    ellipsoid(m, [0, hc[1] + 0.08, hc[2] - hr[2] - 0.1], [0.24, 0.025, 0.2], Q.hair, () => R.BRIM);
    out.neck = m;
  }
  // arms
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? -1 : 1;
    const sh = J[`shoulder${side}`], el = J[`elbow${side}`];
    const wr = [el[0] + sx * 0.02, el[1] - WRIST_DROP, el[2] - 0.02];
    const up = new Mesh();
    ellipsoid(up, [sh[0] - sx * 0.03, sh[1] - 0.02, sh[2]], [lerp(0.175, 0.15), 0.17, lerp(0.17, 0.145)], L + 1, () => R.SHIRT);
    loft(up, sh, el, [
      { t: 0, w: lerp(0.17, 0.145), d: lerp(0.17, 0.145) },
      { t: 0.44, w: lerp(0.16, 0.13), d: lerp(0.15, 0.13) },
      { t: 0.445, w: lerp(0.158, 0.128), d: lerp(0.149, 0.129) },
      { t: 1, w: lerp(0.125, 0.11), d: lerp(0.125, 0.11) },
    ], L, (t) => (t < 0.442 ? R.SHIRT : R.SLEEVE));
    out[`shoulder${side}`] = up;
    const lo = new Mesh();
    if (detail) ellipsoid(lo, el, [0.12, 0.12, 0.12], Q.part, () => R.SLEEVE);
    loft(lo, el, wr, [
      { t: 0, w: lerp(0.12, 0.105), d: lerp(0.12, 0.105) },
      { t: 0.35, w: lerp(0.125, 0.105), d: lerp(0.11, 0.095) },
      { t: 1, w: lerp(0.085, 0.072), d: lerp(0.07, 0.06) },
    ], L, () => R.SLEEVE);
    // hand: palm and fingers in one, plus a thumb
    ellipsoid(lo, [wr[0], wr[1] - 0.16, wr[2]], [lerp(0.07, 0.06), 0.18, lerp(0.1, 0.085)], Q.part + 1, () => R.SKIN, (x, y, z) => [x * (y < 0 ? 0.8 : 1), y, z]);
    if (Q.face) ellipsoid(lo, [wr[0] - sx * 0.02, wr[1] - 0.1, wr[2] - 0.09], [0.04, 0.09, 0.04], 5, () => R.SKIN, (x, y, z) => [x, y, z - y * 0.4]);
    out[`elbow${side}`] = lo;
  }
  // legs
  for (const side of ['L', 'R']) {
    const hp = J[`hip${side}`], kn = J[`knee${side}`];
    const an = [kn[0], kn[1] - ANKLE_DROP, kn[2] + 0.05];
    const th = new Mesh();
    loft(th, [hp[0] * 0.9, hp[1] + 0.16, hp[2]], kn, [
      { t: 0, w: lerp(0.28, 0.3), d: lerp(0.28, 0.29) },
      { t: 0.35, w: lerp(0.26, 0.27), d: lerp(0.25, 0.26) },
      { t: 0.6, w: 0.228, d: 0.226 },
      { t: 0.605, w: 0.227, d: 0.225 },
      { t: 0.8, w: 0.2, d: 0.2 },
      { t: 1, w: 0.18, d: 0.185 },
    ], L, (t) => (t < 0.602 ? R.PANTS : R.LEGWEAR));
    out[`hip${side}`] = th;
    const sh = new Mesh();
    if (detail) ellipsoid(sh, kn, [0.18, 0.18, 0.18], Q.part, () => R.LEGWEAR);
    loft(sh, kn, an, [
      { t: 0, w: 0.175, d: 0.18 },
      { t: 0.3, w: lerp(0.19, 0.175), d: lerp(0.2, 0.19), cz: 0.03 },
      { t: 0.75, w: 0.13, d: 0.13 },
      { t: 1, w: 0.1, d: 0.11 },
    ], L, () => R.LEGWEAR);
    // shoe: rounded toe, flat sole at ground level
    ellipsoid(sh, [an[0], 0.17, an[2] - 0.14], [0.15, 0.17, 0.36], Q.part + 2, () => R.SHOES, (x, y, z) => [x * (z < 0 ? 1 : 0.9), Math.max(y, -0.17) * (z < -0.1 && y > 0 ? 0.75 : 1), z]);
    out[`knee${side}`] = sh;
  }
  // convert to joint-local coordinates
  for (const [joint, m] of Object.entries(out)) {
    const o = J[joint];
    for (let i = 0; i < m.pos.length; i += 3) {
      m.pos[i] -= o[0]; m.pos[i + 1] -= o[1]; m.pos[i + 2] -= o[2];
    }
  }
  return out;
}

// Both builds share topology, so the slim build is stored as a delta.
const segCache = new Map();
export function bodySegments(detail = 2) {
  if (segCache.has(detail)) return segCache.get(detail);
  const a = segments(0, detail), b = segments(1, detail);
  const out = {};
  for (const joint of Object.keys(a)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a[joint].pos, 3));
    g.setIndex(a[joint].idx);
    g.computeVertexNormals();
    const delta = new Float32Array(a[joint].pos.length);
    for (let i = 0; i < delta.length; i++) delta[i] = b[joint].pos[i] - a[joint].pos[i];
    g.setAttribute('aDelta', new THREE.BufferAttribute(delta, 3));
    g.setAttribute('aRegion', new THREE.Float32BufferAttribute(a[joint].reg, 1));
    out[joint] = g;
  }
  // joint offsets (relative to parents) for both builds
  const restA = jointRest(0), restB = jointRest(1);
  const offsets = {};
  for (const j of JOINTS) {
    const p = PARENT[j];
    const oa = restA[j].map((v, i) => v - (p ? restA[p][i] : 0));
    const ob = restB[j].map((v, i) => v - (p ? restB[p][i] : 0));
    offsets[j] = { a: oa, d: ob.map((v, i) => v - oa[i]) };
  }
  const res = { geos: out, offsets };
  segCache.set(detail, res);
  return res;
}

// ---------------------------------------------------------------- poses
// A pose: joint rotations [x, y, z] (radians) and the hips' offset and
// rotation. Figures face -Z; +x on a hip/shoulder swings the limb forward.
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function bump(phi, center, width) {
  const d = wrap(phi - center) / width;
  return Math.abs(d) < 1 ? Math.cos(d * Math.PI / 2) ** 2 : 0;
}

export function poseWalk(phi, run = 0) {
  const A = 0.5 + 0.3 * run;
  const legs = {};
  for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
    const p = phi + off;
    legs[`hip${side}`] = [A * Math.sin(p) + 0.06 * run, 0, 0];
    legs[`knee${side}`] = [-(0.1 + (1.05 + 0.75 * run) * bump(p, -0.95, 1.25) + 0.15 * bump(p, 1.9, 0.9)), 0, 0];
  }
  const s = Math.sin(phi);
  const arm = 0.36 + 0.3 * run;
  return {
    hips: { pos: [0, 0, 0], rot: [-0.04 - 0.12 * run, -0.08 * s, 0.03 * Math.cos(phi)] },
    spine: [0.02 + 0.03 * run, 0.1 * s, -0.02 * Math.cos(phi)],
    neck: [0.03 + 0.08 * run, -0.03 * s, 0],
    shoulderL: [-arm * s, 0, -0.07],
    elbowL: [0.25 + 1.0 * run + 0.18 * Math.max(0, -s), 0, 0],
    shoulderR: [arm * s, 0, 0.07],
    elbowR: [0.25 + 1.0 * run + 0.18 * Math.max(0, s), 0, 0],
    ...legs,
    ground: true,
  };
}

export function poseIdle(kind = 0, t = 0) {
  const breathe = Math.sin(t * 1.6) * 0.012;
  const base = {
    hips: { pos: [0, 0, 0], rot: [0, 0, 0.03] },
    spine: [breathe, 0, -0.02],
    neck: [0.02, 0, 0.02],
    shoulderL: [0.04, 0, -0.07], elbowL: [0.18, 0, 0],
    shoulderR: [0.04, 0, 0.07], elbowR: [0.18, 0, 0],
    hipL: [0.02, 0, -0.03], kneeL: [-0.04, 0, 0],
    hipR: [-0.04, 0, 0.01], kneeR: [-0.14, 0, 0],
    ground: true,
  };
  if (kind === 1) {
    // checking a phone
    Object.assign(base, { neck: [0.38, 0, 0], shoulderR: [0.45, 0, 0.12], elbowR: [1.65, -0.5, 0], shoulderL: [0.25, 0, -0.08], elbowL: [1.3, 0.5, 0] });
  } else if (kind === 2) {
    // hands on hips
    Object.assign(base, { shoulderL: [-0.15, 0, -0.55], elbowL: [1.5, 0.9, 0], shoulderR: [-0.15, 0, 0.55], elbowR: [1.5, -0.9, 0], hipL: [0.05, 0, -0.08], hipR: [0, 0, 0.06], kneeR: [-0.06, 0, 0] });
  } else if (kind === 3) {
    // looking around, arms folded behind
    Object.assign(base, { neck: [-0.08, 0.45, 0], shoulderL: [-0.3, 0, -0.1], elbowL: [0.5, 0, 0], shoulderR: [-0.3, 0, 0.1], elbowR: [0.5, 0, 0] });
  }
  return base;
}

export function poseCheer(t = 0) {
  const wave = Math.sin(t * 7) * 0.25;
  return {
    hips: { pos: [0, 0, 0], rot: [0, 0, 0] },
    spine: [-0.04, 0, 0], neck: [-0.18, 0, 0],
    shoulderL: [0.1, 0, -2.6 + wave], elbowL: [0.35, 0, 0],
    shoulderR: [0.1, 0, 2.6 - wave], elbowR: [0.35, 0, 0],
    hipL: [0, 0, -0.06], kneeL: [-0.05, 0, 0], hipR: [0, 0, 0.06], kneeR: [-0.05, 0, 0],
    ground: true,
  };
}

// Seated: the hips sit at the seat origin used by rides (y = -1.5 is the
// hip joint below the seat pivot).
export function poseSit(cheer = false) {
  return {
    hips: { pos: [0, -1.5 - 2.82, 0.15], rot: [0.08, 0, 0], abs: true },
    spine: [-0.1, 0, 0], neck: [0.02, 0, 0],
    shoulderL: cheer ? [0.2, 0, -2.5] : [0.55, 0, -0.12], elbowL: cheer ? [0.3, 0, 0] : [0.75, 0, 0],
    shoulderR: cheer ? [0.2, 0, 2.5] : [0.55, 0, 0.12], elbowR: cheer ? [0.3, 0, 0] : [0.75, 0, 0],
    hipL: [1.5, 0, -0.06], kneeL: [-1.45, 0, 0],
    hipR: [1.5, 0, 0.06], kneeR: [-1.45, 0, 0],
  };
}

export function poseJump(fall = 0) {
  return {
    hips: { pos: [0, 0, 0], rot: [-0.05, 0, 0] },
    spine: [0.05, 0, 0], neck: [-0.05, 0, 0],
    shoulderL: [0.4 - fall * 0.9, 0, -0.35 - fall * 0.5], elbowL: [0.6, 0, 0],
    shoulderR: [0.4 - fall * 0.9, 0, 0.35 + fall * 0.5], elbowR: [0.6, 0, 0],
    hipL: [0.9 - fall * 0.5, 0, -0.05], kneeL: [-1.1 + fall * 0.6, 0, 0],
    hipR: [0.2, 0, 0.05], kneeR: [-0.5, 0, 0],
  };
}

// Blend two poses (same joints) by k.
export function blendPose(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const out = { ground: a.ground && b.ground };
  for (const j of JOINTS) {
    if (j === 'hips') {
      out.hips = {
        pos: a.hips.pos.map((v, i) => v + (b.hips.pos[i] - v) * k),
        rot: a.hips.rot.map((v, i) => v + (b.hips.rot[i] - v) * k),
        abs: a.hips.abs,
      };
    } else {
      out[j] = a[j].map((v, i) => v + (b[j][i] - v) * k);
    }
  }
  return out;
}

// ------------------------------------------------------------ matrices
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

// World (figure-space) matrix for every joint of a pose; f = build.
export function poseMatrices(pose, f, offsets, out = {}) {
  for (const j of JOINTS) {
    const o = offsets[j];
    _p.set(o.a[0] + o.d[0] * f, o.a[1] + o.d[1] * f, o.a[2] + o.d[2] * f);
    let rot;
    if (j === 'hips') {
      const h = pose.hips;
      if (h.abs) _p.set(h.pos[0], h.pos[1] + o.a[1] + o.d[1] * f, h.pos[2]);
      else _p.add(_one.set(h.pos[0], h.pos[1], h.pos[2]));
      _one.set(1, 1, 1);
      rot = h.rot;
    } else rot = pose[j];
    _e.set(rot[0], rot[1], rot[2], 'YXZ');
    _q.setFromEuler(_e);
    const m = (out[j] ||= new THREE.Matrix4());
    m.compose(_p, _q, _one);
    const parent = PARENT[j];
    if (parent) m.premultiply(out[parent]);
  }
  if (pose.ground) {
    // plant the lower foot on the ground
    const ankleY = (side) => {
      const v = new THREE.Vector3(0, -ANKLE_DROP, 0.05).applyMatrix4(out[`knee${side}`]);
      return v.y;
    };
    const low = Math.min(ankleY('L'), ankleY('R'));
    const lift = new THREE.Matrix4().makeTranslation(0, 0.3 - low, 0);
    for (const j of JOINTS) out[j].premultiply(lift);
  }
  return out;
}

// Bake a pose into one geometry (position, normal, aRegion, aDelta).
export function bakePose(pose, detail = 2) {
  const { geos, offsets } = bodySegments(detail);
  const mA = poseMatrices(pose, 0, offsets, {});
  const mB = poseMatrices(pose, 1, offsets, {});
  const pos = [], nrm = [], reg = [], del = [], idx = [];
  const v = new THREE.Vector3(), w = new THREE.Vector3(), n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const [joint, g] of Object.entries(geos)) {
    const base = pos.length / 3;
    const pa = g.getAttribute('position'), na = g.getAttribute('normal'), da = g.getAttribute('aDelta'), ra = g.getAttribute('aRegion');
    nm.getNormalMatrix(mA[joint]);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(mA[joint]);
      w.fromBufferAttribute(pa, i).add(n.fromBufferAttribute(da, i)).applyMatrix4(mB[joint]);
      pos.push(v.x, v.y, v.z);
      del.push(w.x - v.x, w.y - v.y, w.z - v.z);
      n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nrm.push(n.x, n.y, n.z);
      reg.push(ra.getX(i));
    }
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i++) idx.push(ia[i] + base);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('aRegion', new THREE.Float32BufferAttribute(reg, 1));
  out.setAttribute('aDelta', new THREE.Float32BufferAttribute(del, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------- outfits
// Colors are packed as 0xRRGGBB integers in floats (exact up to 2^24).
const SKIN_TONES = [0xf3d2bd, 0xe8b996, 0xd29e78, 0xb07a55, 0x8a5a3c, 0x62402b, 0xf0c8a8, 0xc58c64];
const HAIR_COLORS = [0x1d1612, 0x2e2018, 0x4a3020, 0x6b4a2e, 0x9a6f42, 0xc9a46a, 0x8c8a86, 0x3a2416, 0xa04a24];
const SHIRTS = [0xd8433b, 0x2f6fbf, 0xf2f2ee, 0x1f2a38, 0x3c8c5a, 0xf0b429, 0x8a4fb0, 0xe57b2f, 0x6fb7d9, 0xc93d6e, 0x9aa3ad, 0x2a2a2e, 0xf4a6b8, 0x587a3a];
const PANTS = [0x2b3a55, 0x3b4f7a, 0x1e1e22, 0x6b6b70, 0xc2b28c, 0x4a3b2c, 0x8f9aa6, 0x2f4a6b];
const SHOES = [0xf5f5f2, 0x1d1d20, 0x6b4a32, 0x9a9da3, 0xd14a3c, 0x2f5fa8];
const HATS = [0xd8433b, 0x1f2a38, 0xf0b429, 0x2f6fbf, 0xf2f2ee, 0x3c8c5a];

export function hashSeed(seed) {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const pick = (list, r) => list[Math.floor(r() * list.length) % list.length];

// A person's look: colors, styles, build and size.
export function outfit(seed) {
  const r = hashSeed(seed);
  const fem = r() < 0.5 ? 1 : 0;
  const child = r() < 0.18;
  const hairStyle = fem ? (r() < 0.55 ? 1 : r() < 0.6 ? 2 : 0) : (r() < 0.12 ? 3 : 0);
  return {
    skin: pick(SKIN_TONES, r),
    shirt: pick(SHIRTS, r),
    pants: pick(PANTS, r),
    hair: pick(HAIR_COLORS, r),
    shoes: pick(SHOES, r),
    hat: pick(HATS, r),
    sleeves: r() < 0.3 ? 1 : 0,
    longPants: r() < 0.55 ? 1 : 0,
    hairStyle,
    hatOn: r() < 0.22 ? 1 : 0,
    fem: fem * (0.75 + r() * 0.25),
    height: child ? 0.62 + r() * 0.14 : (fem ? 0.93 : 0.98) + r() * 0.1,
    width: 0.94 + r() * 0.14,
  };
}

// Pack an outfit into the two per-instance vec4s the shader reads.
export function packOutfit(o, outA = [0, 0, 0, 0], outB = [0, 0, 0, 0]) {
  outA[0] = o.skin; outA[1] = o.shirt; outA[2] = o.pants; outA[3] = o.hair;
  outB[0] = o.shoes; outB[1] = o.hat;
  outB[2] = o.sleeves + 2 * o.longPants + 4 * o.hairStyle + 16 * o.hatOn;
  outB[3] = o.fem;
  return [outA, outB];
}

// ------------------------------------------------------------ material
// Shared material: colors each region from the person's packed outfit.
let sharedMaterial = null;
export function humanMaterial() {
  if (sharedMaterial) return sharedMaterial;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, envMapIntensity: 0.6 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRegion;
        attribute vec3 aDelta;
        attribute vec4 iColA;
        attribute vec4 iColB;
        varying vec3 vTint;
        varying float vRough;
        vec3 unpackRGB(float c) {
          vec3 v = vec3(floor(c / 65536.0), mod(floor(c / 256.0), 256.0), mod(c, 256.0)) / 255.0;
          return pow(v, vec3(2.2));
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float style = iColB.z;
          float sleeves = mod(style, 2.0);
          float longPants = mod(floor(style / 2.0), 2.0);
          float hairStyle = mod(floor(style / 4.0), 4.0);
          float hat = mod(floor(style / 16.0), 2.0);
          transformed += aDelta * iColB.w;
          int r = int(aRegion + 0.5);
          vec3 skin = unpackRGB(iColA.x);
          vec3 c = skin;
          float rough = 0.55;
          float hide = 0.0;
          if (r == 1) { c = unpackRGB(iColA.y); rough = 0.85; }
          else if (r == 2) { if (sleeves > 0.5) { c = unpackRGB(iColA.y); rough = 0.85; } }
          else if (r == 3) { c = unpackRGB(iColA.z); rough = 0.9; }
          else if (r == 4) { if (longPants > 0.5) { c = unpackRGB(iColA.z); rough = 0.9; } }
          else if (r == 5) { c = unpackRGB(iColB.x); rough = 0.6; }
          else if (r == 6) { c = unpackRGB(iColA.w); rough = 0.7; if (hairStyle > 2.5) { c = skin * 0.92; } }
          else if (r == 7) { c = unpackRGB(iColA.w); rough = 0.7; hide = (abs(hairStyle - 1.0) < 0.5 && hat < 0.5) ? 0.0 : 1.0; }
          else if (r == 8) { c = unpackRGB(iColA.w); rough = 0.7; hide = abs(hairStyle - 2.0) < 0.5 ? 0.0 : 1.0; }
          else if (r == 9 || r == 13) { c = unpackRGB(iColB.y); rough = 0.8; hide = hat > 0.5 ? 0.0 : 1.0; }
          else if (r == 10) { c = vec3(0.025, 0.02, 0.018); rough = 0.3; }
          else if (r == 11) { c = vec3(0.85); rough = 0.25; }
          else if (r == 12) { c = skin * vec3(0.78, 0.5, 0.5); rough = 0.45; }
          if (hide > 0.5) transformed = vec3(0.0);
          vTint = c;
          vRough = rough;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;\nvarying float vRough;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vTint, opacity );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRough;');
  };
  m.customProgramCacheKey = () => 'human';
  sharedMaterial = m;
  return m;
}

// Per-instance outfit attributes for a geometry (shares the body buffers).
export function withOutfitAttributes(base, count) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'aRegion', 'aDelta']) g.setAttribute(name, base.getAttribute(name));
  g.setIndex(base.index);
  g.boundingSphere = base.boundingSphere;
  const a = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const b = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  a.setUsage(THREE.DynamicDrawUsage);
  b.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iColA', a);
  g.setAttribute('iColB', b);
  return g;
}

// One person as an ordinary object (riders, performers): an instanced
// mesh of one, so it shares the crowd's material.
export function singleFigure(baseGeo, look) {
  const g = withOutfitAttributes(baseGeo, 1);
  const [A, B] = packOutfit(look);
  g.getAttribute('iColA').array.set(A);
  g.getAttribute('iColB').array.set(B);
  const mesh = new THREE.InstancedMesh(g, humanMaterial(), 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(look.width, look.height, look.width));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
