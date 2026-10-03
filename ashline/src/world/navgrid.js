/**
 * Navigation grid built from the collision world. Each cell stores a single
 * walkable floor height (the map is designed with no overlapping walkable
 * floors). A* with octile heuristic and string-pulling path smoothing.
 */

const AGENT_RADIUS = 0.42;
const AGENT_HEIGHT = 1.75;
const MAX_FLOOR = 2.2; // surfaces above this are not considered floor (roofs, container tops)
const MAX_RISE = 0.55;

export class NavGrid {
  constructor(world, bounds, cellSize = 1) {
    this.world = world;
    this.cs = cellSize;
    this.minX = bounds.minX; this.minZ = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
    const n = this.w * this.h;
    this.height = new Float32Array(n).fill(NaN);
    this.walk = new Uint8Array(n);
    this.cover = new Uint8Array(n); // number of adjacent tall blockers (cover value)
    this.region = new Int32Array(n).fill(-1);
    this._build();
  }

  idx(cx, cz) { return cz * this.w + cx; }
  cellOf(x, z) {
    return [Math.floor((x - this.minX) / this.cs), Math.floor((z - this.minZ) / this.cs)];
  }
  center(i) {
    const cx = i % this.w, cz = (i / this.w) | 0;
    return { x: this.minX + (cx + 0.5) * this.cs, y: this.height[i], z: this.minZ + (cz + 0.5) * this.cs };
  }

  _build() {
    const W = this.world, cs = this.cs, r = AGENT_RADIUS;
    const list = [];
    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const x = this.minX + (cx + 0.5) * cs, z = this.minZ + (cz + 0.5) * cs;
        W.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2, list);
        let floor = -Infinity;
        for (const b of list) if (b.solid && b.maxY <= MAX_FLOOR && b.maxY > floor) floor = b.maxY;
        if (floor === -Infinity) continue;
        const i = this.idx(cx, cz);
        this.height[i] = floor;
        if (!W.overlaps(x - r, floor + 0.05, z - r, x + r, floor + AGENT_HEIGHT, z + r)) this.walk[i] = 1;
      }
    }
    // cover estimate: tall solid boxes in 4 directions within 1.2m
    for (let i = 0; i < this.walk.length; i++) {
      if (!this.walk[i]) continue;
      const c = this.center(i);
      let n = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const hit = W.raycast(c.x, c.y + 1.1, c.z, dx, 0, dz, 1.3, 'sight');
        if (hit) n++;
      }
      this.cover[i] = n;
    }
    // connected regions (to discard unreachable islands for random destinations)
    let rid = 0;
    const stack = [];
    for (let i = 0; i < this.walk.length; i++) {
      if (!this.walk[i] || this.region[i] >= 0) continue;
      this.region[i] = rid; stack.push(i);
      while (stack.length) {
        const k = stack.pop();
        for (const nb of this.neighbors(k)) {
          if (this.region[nb.i] < 0) { this.region[nb.i] = rid; stack.push(nb.i); }
        }
      }
      rid++;
    }
    // main region = largest
    const counts = new Map();
    for (let i = 0; i < this.region.length; i++) if (this.region[i] >= 0) counts.set(this.region[i], (counts.get(this.region[i]) || 0) + 1);
    let best = -1, bc = 0;
    for (const [k, v] of counts) if (v > bc) { bc = v; best = k; }
    this.mainRegion = best;
    this.mainCells = [];
    for (let i = 0; i < this.region.length; i++) if (this.region[i] === best) this.mainCells.push(i);
  }

  *neighbors(i) {
    const cx = i % this.w, cz = (i / this.w) | 0;
    const h0 = this.height[i];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const j = this.idx(nx, nz);
        if (!this.walk[j]) continue;
        if (Math.abs(this.height[j] - h0) > MAX_RISE) continue;
        if (dx && dz) {
          const a = this.idx(cx + dx, cz), b = this.idx(cx, cz + dz);
          if (!this.walk[a] || !this.walk[b]) continue;
          if (Math.abs(this.height[a] - h0) > MAX_RISE || Math.abs(this.height[b] - h0) > MAX_RISE) continue;
        }
        yield { i: j, cost: dx && dz ? 1.4142 : 1 };
      }
    }
  }

  /** Nearest walkable cell to a world position (searches outward). */
  nearest(x, z, y = null, maxR = 6) {
    const [cx, cz] = this.cellOf(x, z);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const i = this.idx(nx, nz);
          if (!this.walk[i] || this.region[i] !== this.mainRegion) continue;
          const c = this.center(i);
          let d = (c.x - x) ** 2 + (c.z - z) ** 2;
          if (y !== null) d += ((c.y - y) * 3) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
      if (best >= 0) return best;
    }
    return best;
  }

  /** A* path between world positions; returns array of {x,y,z} waypoints (smoothed) or null. */
  findPath(sx, sy, sz, tx, ty, tz) {
    const start = this.nearest(sx, sz, sy), goal = this.nearest(tx, tz, ty);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [this.center(goal)];
    const n = this.walk.length;
    if (!this._g || this._g.length !== n) {
      this._g = new Float32Array(n);
      this._from = new Int32Array(n);
      this._seen = new Uint32Array(n);
      this._closed = new Uint32Array(n);
      this._gen = 0;
    }
    const gen = ++this._gen;
    const g = this._g, from = this._from, seen = this._seen, closed = this._closed;
    const gx = goal % this.w, gz = (goal / this.w) | 0;
    const hfn = (i) => {
      const dx = Math.abs((i % this.w) - gx), dz = Math.abs(((i / this.w) | 0) - gz);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    };
    const heap = new MinHeap();
    g[start] = 0; seen[start] = gen; from[start] = -1;
    heap.push(start, hfn(start));
    let found = false, iter = 0;
    while (heap.size && iter++ < 20000) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal) { found = true; break; }
      for (const nb of this.neighbors(cur)) {
        if (closed[nb.i] === gen) continue;
        // prefer cells away from walls slightly (cover cells cost a bit more to avoid hugging)
        const ng = g[cur] + nb.cost;
        if (seen[nb.i] !== gen || ng < g[nb.i]) {
          seen[nb.i] = gen; g[nb.i] = ng; from[nb.i] = cur;
          heap.push(nb.i, ng + hfn(nb.i));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = from[c]) cells.push(c);
    cells.reverse();
    return this.smooth(cells);
  }

  /** Walkable straight line between two cells (grid supercover walk). */
  lineClear(a, b) {
    const ax = a % this.w, az = (a / this.w) | 0, bx = b % this.w, bz = (b / this.w) | 0;
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 2;
    if (steps === 0) return true;
    let prevH = this.height[a];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      // check the cells overlapped by an agent-width band
      for (const [ox, oz] of [[0, 0], [0.35, 0.35], [-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35]]) {
        const cx = Math.floor(x + 0.5 + ox), cz = Math.floor(z + 0.5 + oz);
        if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return false;
        const i = this.idx(cx, cz);
        if (!this.walk[i]) return false;
        if (Math.abs(this.height[i] - prevH) > MAX_RISE) return false;
      }
      prevH = this.height[this.idx(Math.floor(x + 0.5), Math.floor(z + 0.5))];
    }
    return true;
  }

  smooth(cells) {
    const out = [];
    let anchor = 0;
    out.push(cells[0]);
    for (let i = 2; i < cells.length; i++) {
      if (!this.lineClear(cells[anchor], cells[i])) {
        out.push(cells[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(cells[cells.length - 1]);
    return out.slice(1).map((c) => this.center(c));
  }

  randomCell(rng = Math.random) {
    return this.mainCells[(rng() * this.mainCells.length) | 0];
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]]; [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}
