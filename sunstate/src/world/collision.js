/**
 * Static world collision: oriented boxes and circles with a vertical extent,
 * stored in a uniform spatial hash. Characters are vertical capsules (circle
 * + height), vehicles are oriented rectangles, so almost every query is 2D
 * with a y-range check.
 */
const CELL = 16;

export class Collider {
  /** box: cx, cz, hx, hz, angle; circle: cx, cz, r. y0..y1 vertical extent. */
  constructor(o) {
    this.type = o.type || 'box';
    this.cx = o.cx; this.cz = o.cz;
    this.hx = o.hx || 0; this.hz = o.hz || 0; this.r = o.r || 0;
    this.angle = o.angle || 0;
    this.c = Math.cos(this.angle); this.s = Math.sin(this.angle);
    this.y0 = o.y0 ?? -10; this.y1 = o.y1 ?? 100;
    this.tag = o.tag || 'static'; // static | wall | prop | glass | railing
    this.material = o.material || 'concrete';
    this.cameraBlock = o.cameraBlock !== false;
    this.data = o.data || null;
    this.stamp = 0;
    this.bound = this.type === 'circle' ? this.r : Math.abs(this.hx * this.c) + Math.abs(this.hz * this.s);
    this.boundZ = this.type === 'circle' ? this.r : Math.abs(this.hx * this.s) + Math.abs(this.hz * this.c);
  }
  /** world → local (box frame). Rotation by -angle about y. */
  toLocal(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c];
  }
  toWorldDir(lx, lz) {
    return [lx * this.c + lz * this.s, -lx * this.s + lz * this.c];
  }
}

export class CollisionWorld {
  constructor() {
    this.grid = new Map();
    this.all = [];
    this.stamp = 1;
  }

  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  add(o) {
    const col = o instanceof Collider ? o : new Collider(o);
    this.all.push(col);
    const x0 = Math.floor((col.cx - col.bound) / CELL), x1 = Math.floor((col.cx + col.bound) / CELL);
    const z0 = Math.floor((col.cz - col.boundZ) / CELL), z1 = Math.floor((col.cz + col.boundZ) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this.key(ix, iz);
      let list = this.grid.get(k);
      if (!list) { list = []; this.grid.set(k, list); }
      list.push(col);
    }
    return col;
  }

  remove(col) {
    const i = this.all.indexOf(col);
    if (i >= 0) this.all.splice(i, 1);
    for (const list of this.grid.values()) {
      const j = list.indexOf(col);
      if (j >= 0) list.splice(j, 1);
    }
  }

  /** Colliders whose cells overlap the square around (x, z). */
  query(x, z, r, out = []) {
    out.length = 0;
    const st = ++this.stamp;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const list = this.grid.get(this.key(ix, iz));
      if (!list) continue;
      for (const c of list) if (c.stamp !== st) { c.stamp = st; out.push(c); }
    }
    return out;
  }

  /**
   * Push a vertical capsule (circle radius r, from y to y+h) out of colliders.
   * Returns {x, z, hit, normals} with the corrected position.
   */
  resolveCircle(x, z, r, y, h, filter) {
    let hit = false;
    let nx = 0, nz = 0;
    const list = this.query(x, z, r + 2, this._q || (this._q = []));
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of list) {
        if (y + h <= c.y0 || y >= c.y1 - 0.01) continue;
        if (filter && !filter(c)) continue;
        if (c.type === 'circle') {
          const dx = x - c.cx, dz = z - c.cz;
          const d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-6) {
            const p = m - d; x += (dx / d) * p; z += (dz / d) * p;
            nx += dx / d; nz += dz / d; hit = moved = true;
          }
        } else {
          const [lx, lz] = c.toLocal(x, z);
          const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
          let dx = lx - qx, dz = lz - qz;
          let d = Math.hypot(dx, dz);
          let pnx, pnz, p;
          if (d > 1e-6) {
            if (d >= r) continue;
            pnx = dx / d; pnz = dz / d; p = r - d;
          } else {
            // centre inside the box: push out along the shallowest axis
            const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
            if (px < pz) { pnx = Math.sign(lx) || 1; pnz = 0; p = px + r; } else { pnx = 0; pnz = Math.sign(lz) || 1; p = pz + r; }
          }
          const [wx, wz] = c.toWorldDir(pnx, pnz);
          x += wx * p; z += wz * p;
          nx += wx; nz += wz; hit = moved = true;
        }
      }
      if (!moved) break;
    }
    return { x, z, hit, nx, nz };
  }

  /** Does a capsule overlap anything? */
  overlapsCircle(x, z, r, y, h, filter) {
    const list = this.query(x, z, r + 2, this._q2 || (this._q2 = []));
    for (const c of list) {
      if (y + h <= c.y0 || y >= c.y1) continue;
      if (filter && !filter(c)) continue;
      if (c.type === 'circle') { if (Math.hypot(x - c.cx, z - c.cz) < r + c.r) return c; continue; }
      const [lx, lz] = c.toLocal(x, z);
      const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
      if (Math.hypot(lx - qx, lz - qz) < r) return c;
    }
    return null;
  }

  /**
   * 3D ray against colliders. Returns {t, x, y, z, nx, nz, collider} or null.
   * dir need not be normalised; t is in units of dir.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT, filter) {
    const len = Math.hypot(dx, dz) * maxT;
    const mx = ox + dx * maxT * 0.5, mz = oz + dz * maxT * 0.5;
    const list = this.query(mx, mz, len * 0.5 + 1, this._q3 || (this._q3 = []));
    let best = null;
    for (const c of list) {
      if (filter && !filter(c)) continue;
      const r = rayCollider(c, ox, oy, oz, dx, dy, dz, best ? best.t : maxT);
      if (r) best = r;
    }
    return best;
  }

  /** Oriented rectangle overlaps (vehicles). Returns contacts with static colliders. */
  boxContacts(cx, cz, hx, hz, angle, y, h, out = []) {
    out.length = 0;
    const R = Math.hypot(hx, hz);
    const list = this.query(cx, cz, R + 1, this._q4 || (this._q4 = []));
    for (const c of list) {
      if (y + h <= c.y0 || y >= c.y1) continue;
      const res = c.type === 'circle' ? obbCircle(cx, cz, hx, hz, angle, c.cx, c.cz, c.r) : obbObb(cx, cz, hx, hz, angle, c.cx, c.cz, c.hx, c.hz, c.angle);
      if (res) { res.collider = c; out.push(res); }
    }
    return out;
  }
}

/** Ray vs one collider. */
export function rayCollider(c, ox, oy, oz, dx, dy, dz, maxT) {
  let t0 = 0, t1 = maxT, nx = 0, nz = 0;
  if (c.type === 'circle') {
    const fx = ox - c.cx, fz = oz - c.cz;
    const a = dx * dx + dz * dz;
    if (a < 1e-12) return null;
    const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const ta = (-b - sq) / (2 * a), tb = (-b + sq) / (2 * a);
    if (tb < 0 || ta > maxT) return null;
    t0 = Math.max(0, ta); t1 = Math.min(maxT, tb);
    const hx = ox + dx * t0 - c.cx, hz = oz + dz * t0 - c.cz, hl = Math.hypot(hx, hz) || 1;
    nx = hx / hl; nz = hz / hl;
  } else {
    const [lx, lz] = c.toLocal(ox, oz);
    const ldx = dx * c.c - dz * c.s, ldz = dx * c.s + dz * c.c;
    let enterAxis = -1, enterSign = 0;
    for (let ax = 0; ax < 2; ax++) {
      const o = ax ? lz : lx, d = ax ? ldz : ldx, h = ax ? c.hz : c.hx;
      if (Math.abs(d) < 1e-9) { if (o < -h || o > h) return null; continue; }
      let ta = (-h - o) / d, tb = (h - o) / d;
      let sign = -1;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; sign = 1; }
      if (ta > t0) { t0 = ta; enterAxis = ax; enterSign = sign; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
    if (enterAxis >= 0) {
      const [wx, wz] = c.toWorldDir(enterAxis === 0 ? enterSign : 0, enterAxis === 1 ? enterSign : 0);
      nx = wx; nz = wz;
    }
  }
  // vertical slab
  if (Math.abs(dy) < 1e-9) {
    if (oy < c.y0 || oy > c.y1) return null;
  } else {
    let ya = (c.y0 - oy) / dy, yb = (c.y1 - oy) / dy;
    if (ya > yb) { const tmp = ya; ya = yb; yb = tmp; }
    if (ya > t0) { t0 = ya; nx = 0; nz = 0; }
    t1 = Math.min(t1, yb);
    if (t0 > t1) return null;
  }
  if (t0 > maxT || t0 < 0) return null;
  return { t: t0, x: ox + dx * t0, y: oy + dy * t0, z: oz + dz * t0, nx, nz, collider: c };
}

/**
 * SAT between two oriented rectangles A and B. Returns the minimum
 * translation to push A out of B: {nx, nz, depth, px, pz} (normal points B→A,
 * p is an approximate contact point) or null.
 */
export function obbObb(ax, az, ahx, ahz, aa, bx, bz, bhx, bhz, ba) {
  const ac = Math.cos(aa), as = Math.sin(aa), bc = Math.cos(ba), bs = Math.sin(ba);
  // local x axis in world = (cos a, -sin a); local z = (sin a, cos a)  (matches Collider.toWorldDir)
  const axes = [[ac, -as], [as, ac], [bc, -bs], [bs, bc]];
  const dx = ax - bx, dz = az - bz;
  let best = Infinity, bnx = 0, bnz = 0;
  for (const [ux, uz] of axes) {
    const ra = ahx * Math.abs(ac * ux - as * uz) + ahz * Math.abs(as * ux + ac * uz);
    const rb = bhx * Math.abs(bc * ux - bs * uz) + bhz * Math.abs(bs * ux + bc * uz);
    const dist = dx * ux + dz * uz;
    const o = ra + rb - Math.abs(dist);
    if (o <= 0) return null;
    if (o < best) { best = o; const sg = dist >= 0 ? 1 : -1; bnx = ux * sg; bnz = uz * sg; }
  }
  // contact point: deepest corner of A along -n, averaged with B's deepest corner
  const corner = (cx, cz, hx, hz, c, s, sx, sz) => [cx + (hx * c) * sx + (hz * s) * sz, cz + (-hx * s) * sx + (hz * c) * sz];
  let pa = null, pd = Infinity;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const p = corner(ax, az, ahx, ahz, ac, as, sx, sz);
    const d = p[0] * bnx + p[1] * bnz;
    if (d < pd) { pd = d; pa = p; }
  }
  let pb = null, pbd = -Infinity;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const p = corner(bx, bz, bhx, bhz, bc, bs, sx, sz);
    const d = p[0] * bnx + p[1] * bnz;
    if (d > pbd) { pbd = d; pb = p; }
  }
  // the contact is whichever corner actually lies inside the other box
  const inside = (p, cx, cz, hx, hz, c, s) => {
    const lx = (p[0] - cx) * c - (p[1] - cz) * s, lz = (p[0] - cx) * s + (p[1] - cz) * c;
    return Math.abs(lx) <= hx + 0.05 && Math.abs(lz) <= hz + 0.05;
  };
  const aIn = inside(pa, bx, bz, bhx, bhz, bc, bs), bIn = inside(pb, ax, az, ahx, ahz, ac, as);
  const p = aIn && !bIn ? pa : bIn && !aIn ? pb : [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  return { nx: bnx, nz: bnz, depth: best, px: p[0], pz: p[1] };
}

/** Oriented rectangle A vs circle. Normal points circle→A. */
export function obbCircle(ax, az, ahx, ahz, aa, cx, cz, r) {
  const c = Math.cos(aa), s = Math.sin(aa);
  const dx = cx - ax, dz = cz - az;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = Math.max(-ahx, Math.min(ahx, lx)), qz = Math.max(-ahz, Math.min(ahz, lz));
  const ex = lx - qx, ez = lz - qz;
  const d = Math.hypot(ex, ez);
  if (d >= r) return null;
  let nlx, nlz, depth;
  if (d > 1e-6) { nlx = -ex / d; nlz = -ez / d; depth = r - d; }
  else {
    const px = ahx - Math.abs(lx), pz = ahz - Math.abs(lz);
    if (px < pz) { nlx = -Math.sign(lx) || -1; nlz = 0; depth = px + r; } else { nlx = 0; nlz = -Math.sign(lz) || -1; depth = pz + r; }
  }
  const nx = nlx * c + nlz * s, nz = -nlx * s + nlz * c;
  const wx = ax + qx * c + qz * s, wz = az - qx * s + qz * c;
  return { nx, nz, depth, px: wx, pz: wz };
}
