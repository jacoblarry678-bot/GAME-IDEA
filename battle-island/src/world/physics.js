/**
 * Collision world: an exact heightmap for terrain plus axis-aligned solids
 * (boxes, ramps, cones) in a spatial hash. Everything that moves or shoots —
 * players, bots, bullets, rockets, the camera — queries this one structure, so
 * what you see is what you collide with.
 */

export const WATER_Y = 0;
export const GRAVITY = 24;
export const STEP_UP = 0.55;

export class Heightmap {
  constructor(size, n, fn) {
    this.size = size;
    this.n = n;
    this.half = size / 2;
    this.cell = size / n;
    this.h = new Float32Array((n + 1) * (n + 1));
    this.max = -Infinity;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const v = fn(-this.half + i * this.cell, -this.half + j * this.cell);
        this.h[j * (n + 1) + i] = v;
        if (v > this.max) this.max = v;
      }
    }
  }

  /** Exact height of the rendered triangles (same diagonal split as the mesh). */
  get(x, z) {
    const n = this.n;
    let fx = (x + this.half) / this.cell;
    let fz = (z + this.half) / this.cell;
    if (fx < 0) fx = 0; else if (fx > n - 1e-4) fx = n - 1e-4;
    if (fz < 0) fz = 0; else if (fz > n - 1e-4) fz = n - 1e-4;
    const i = fx | 0, j = fz | 0;
    const tx = fx - i, tz = fz - j;
    const w = n + 1, h = this.h;
    const h00 = h[j * w + i], h10 = h[j * w + i + 1], h01 = h[(j + 1) * w + i], h11 = h[(j + 1) * w + i + 1];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }
}

let nextId = 1;

export class Collider {
  constructor(o) {
    this.id = nextId++;
    this.type = 'box'; // box | ramp | cone
    this.dir = 0; // ramps: rises toward 0:+x 1:+z 2:-x 3:-z
    this.hp = Infinity;
    this.maxHp = Infinity;
    this.material = null; // wood | brick | metal (harvest + build material)
    this.kind = 'static'; // static | build | tree | rock | prop | barrel | chest | pad
    this.harvest = 0; // materials granted per pickaxe hit
    this.mesh = null;
    this.alive = true;
    this.owner = null;
    this._stamp = 0;
    this._cells = [];
    Object.assign(this, o);
  }

  surfaceY(x, z) {
    if (this.type === 'ramp') {
      let t;
      switch (this.dir) {
        case 0: t = (x - this.minX) / (this.maxX - this.minX); break;
        case 1: t = (z - this.minZ) / (this.maxZ - this.minZ); break;
        case 2: t = (this.maxX - x) / (this.maxX - this.minX); break;
        default: t = (this.maxZ - z) / (this.maxZ - this.minZ);
      }
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return this.minY + (this.maxY - this.minY) * t;
    }
    if (this.type === 'cone') {
      // pyramid over a (possibly rectangular) footprint — build cones and roofs
      const hx = (this.maxX - this.minX) / 2, hz = (this.maxZ - this.minZ) / 2;
      const cx = this.minX + hx, cz = this.minZ + hz;
      const m = Math.min(1, Math.max(Math.abs(x - cx) / hx, Math.abs(z - cz) / hz));
      return this.minY + (this.maxY - this.minY) * (1 - m);
    }
    return this.maxY;
  }

  containsXZ(x, z, pad = 0) {
    return x >= this.minX - pad && x <= this.maxX + pad && z >= this.minZ - pad && z <= this.maxZ + pad;
  }
}

const CELL = 8;
const key = (ix, iz) => (ix + 1024) * 4096 + (iz + 1024);

export class Physics {
  constructor(heightmap) {
    this.hm = heightmap;
    this.cells = new Map();
    this.colliders = new Set();
    this.stamp = 1;
    this._q = [];
    this.nextWid = 0; // creation order: identical on every machine for the fixed island
  }

  add(c) {
    if (c.wid === undefined) c.wid = this.nextWid++;
    const x0 = Math.floor(c.minX / CELL), x1 = Math.floor(c.maxX / CELL);
    const z0 = Math.floor(c.minZ / CELL), z1 = Math.floor(c.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = key(ix, iz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(c);
        c._cells.push(list);
      }
    }
    this.colliders.add(c);
    return c;
  }

  remove(c) {
    c.alive = false;
    for (const list of c._cells) {
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    c._cells.length = 0;
    this.colliders.delete(c);
  }

  /** Colliders whose XZ bounds overlap the rectangle. Returned array is reused. */
  query(minX, minZ, maxX, maxZ) {
    const out = this._q;
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(key(ix, iz));
        if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const c = list[n];
          if (c._stamp === s) continue;
          c._stamp = s;
          if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
          out.push(c);
        }
      }
    }
    return out;
  }

  terrainY(x, z) {
    return this.hm.get(x, z);
  }

  /**
   * Highest walkable surface under (x,z) at or below feetY + step.
   * Returns { y, c } where c is the supporting collider (null = terrain).
   */
  groundAt(x, z, feetY, radius = 0.35, step = STEP_UP) {
    let best = this.hm.get(x, z);
    let bestC = null;
    const r = radius * 0.7;
    const list = this.query(x - r, z - r, x + r, z + r);
    const lim = feetY + step;
    for (let n = 0; n < list.length; n++) {
      const c = list[n];
      let top;
      if (c.type === 'box') {
        top = c.maxY;
      } else {
        if (!c.containsXZ(x, z)) continue;
        // ramps and cones are thin shells: you stand on them only from above
        top = c.surfaceY(x, z);
      }
      // build heights snap to a grid, so a ramp's low end can sit a little above the
      // ground: let walkers step onto it there
      const reach = step > 0 && c.type === 'ramp' && top - c.minY < 1 ? lim + 0.8 : lim;
      if (top <= reach && top > best) {
        best = top;
        bestC = c;
      }
    }
    return { y: best, c: bestC };
  }

  /** Ray vs world. dir must be normalized. Returns null or {t, x,y,z, nx,ny,nz, c, terrain}. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, ignore = null) {
    let best = maxDist;
    let hit = null;
    // --- colliders via 2D DDA over the hash grid
    let ix = Math.floor(ox / CELL), iz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tdx = adx > 1e-9 ? CELL / adx : Infinity;
    const tdz = adz > 1e-9 ? CELL / adz : Infinity;
    let tmx = adx > 1e-9 ? (dx > 0 ? (ix + 1) * CELL - ox : ox - ix * CELL) / adx : Infinity;
    let tmz = adz > 1e-9 ? (dz > 0 ? (iz + 1) * CELL - oz : oz - iz * CELL) / adz : Infinity;
    const s = ++this.stamp;
    let guard = 0;
    for (;;) {
      const list = this.cells.get(key(ix, iz));
      if (list) {
        for (let n = 0; n < list.length; n++) {
          const c = list[n];
          if (c._stamp === s || c === ignore) continue;
          c._stamp = s;
          const r = intersect(c, ox, oy, oz, dx, dy, dz, best);
          if (r) {
            best = r.t;
            hit = r;
            hit.c = c;
          }
        }
      }
      let t;
      if (tmx < tmz) { t = tmx; tmx += tdx; ix += stepX; } else { t = tmz; tmz += tdz; iz += stepZ; }
      if (t > best || ++guard > 200) break;
    }
    // --- terrain by marching then bisecting
    const hm = this.hm;
    if (!(dy >= 0 && oy > hm.max)) {
      const step = 0.9;
      let prevT = 0;
      let prevAbove = oy - hm.get(ox, oz) >= 0;
      if (prevAbove) {
        for (let t = step; t <= best + step; t += step) {
          const tt = Math.min(t, best);
          const py = oy + dy * tt;
          if (dy >= 0 && py > hm.max) break;
          const px = ox + dx * tt, pz = oz + dz * tt;
          const above = py - hm.get(px, pz) >= 0;
          if (!above) {
            let a = prevT, b = tt;
            for (let k = 0; k < 8; k++) {
              const m = (a + b) / 2;
              if (oy + dy * m - hm.get(ox + dx * m, oz + dz * m) >= 0) a = m; else b = m;
            }
            if (b < best) {
              best = b;
              hit = { t: b, nx: 0, ny: 1, nz: 0, c: null, terrain: true };
            }
            break;
          }
          prevT = tt;
          if (tt >= best) break;
        }
      }
    }
    if (hit) {
      hit.x = ox + dx * hit.t;
      hit.y = oy + dy * hit.t;
      hit.z = oz + dz * hit.t;
    }
    return hit;
  }

  /** True if nothing solid between two points. */
  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.05);
  }
}

/** Slab test; returns entry/exit t or null. */
function slab(minX, minY, minZ, maxX, maxY, maxZ, ox, oy, oz, dx, dy, dz) {
  let t0 = -Infinity, t1 = Infinity, axis = -1, sign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < mn[a] || o[a] > mx[a]) return null;
      continue;
    }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
    let sg = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; sg = 1; }
    if (ta > t0) { t0 = ta; axis = a; sign = sg; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return { t0, t1, axis, sign };
}

function intersect(c, ox, oy, oz, dx, dy, dz, maxT) {
  const r = slab(c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ, ox, oy, oz, dx, dy, dz);
  if (!r || r.t1 < 0 || r.t0 > maxT) return null;
  if (c.type === 'box') {
    if (r.t0 < 0) return null; // started inside — ignore (no self-hits)
    const n = [0, 0, 0];
    n[r.axis] = r.sign;
    return { t: r.t0, nx: n[0], ny: n[1], nz: n[2] };
  }
  // ramps / cones: thin surface, find the sign change along the in-box segment
  const a = Math.max(0, r.t0), b = Math.min(maxT, r.t1);
  const f = (t) => oy + dy * t - c.surfaceY(ox + dx * t, oz + dz * t);
  const N = 10;
  let pt = a, pf = f(a);
  for (let k = 1; k <= N; k++) {
    const t = a + ((b - a) * k) / N;
    const v = f(t);
    if ((pf > 0) !== (v > 0)) {
      let lo = pt, hi = t, flo = pf;
      for (let it = 0; it < 7; it++) {
        const m = (lo + hi) / 2, fm = f(m);
        if ((flo > 0) === (fm > 0)) { lo = m; flo = fm; } else hi = m;
      }
      return { t: hi, nx: 0, ny: pf > 0 ? 1 : -1, nz: 0 };
    }
    pt = t;
    pf = v;
  }
  return null;
}
