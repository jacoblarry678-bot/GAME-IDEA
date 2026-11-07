// Small shared helpers: seeded random numbers and 2D math.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = (Math.random() * 1e9) | 0) { this.seed = seed; this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.r()); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function approachAngle(cur, target, maxStep) {
  const d = angleWrap(target - cur);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

// Yaw convention: a character with yaw 0 faces +Z. Forward = (sin(yaw), cos(yaw)).
export const yawTo = (dx, dz) => Math.atan2(dx, dz);

export function damp(cur, target, lambda, dt) {
  return lerp(cur, target, 1 - Math.exp(-lambda * dt));
}

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const r1 = bx - ax, s1 = bz - az, r2 = dx - cx, s2 = dz - cz;
  const den = r1 * s2 - s1 * r2;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((cx - ax) * s2 - (cz - az) * r2) / den;
  const u = ((cx - ax) * s1 - (cz - az) * r1) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Repairs zero-length or NaN vertex normals (they make the lighting shader output NaN: black pixels
// that flicker, and with bloom spread into black blocks). Bad normals point away from the mesh centre.
export function repairNormals(root) {
  const seen = new Set();
  let fixed = 0;
  root.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || !g || seen.has(g) || !g.attributes.normal) return;
    seen.add(g);
    const n = g.attributes.normal, p = g.attributes.position;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const c = g.boundingSphere ? g.boundingSphere.center : { x: 0, y: 0, z: 0 };
    let changed = false;
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
      const l = Math.hypot(x, y, z);
      if (l > 0.01 && Number.isFinite(l)) continue;
      let dx = p.getX(i) - c.x, dy = p.getY(i) - c.y, dz = p.getZ(i) - c.z;
      let dl = Math.hypot(dx, dy, dz);
      if (!(dl > 1e-6)) { dx = 0; dy = 1; dz = 0; dl = 1; }
      n.setXYZ(i, dx / dl, dy / dl, dz / dl);
      changed = true;
      fixed++;
    }
    if (changed) n.needsUpdate = true;
  });
  return fixed;
}
