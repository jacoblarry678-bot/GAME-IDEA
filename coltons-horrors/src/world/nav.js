// Navigation grid (0.5 m cells), A* pathfinding, walkability and line-of-sight tests.

export const FREE = 0, BLOCK = 1, WINDOW = 2, PALLET_DOWN = 3;

class Heap {
  constructor(cap) { this.items = new Int32Array(cap); this.keys = new Float32Array(cap); this.size = 0; }
  clear() { this.size = 0; }
  push(item, key) {
    if (this.size >= this.items.length) {
      const ni = new Int32Array(this.items.length * 2); ni.set(this.items); this.items = ni;
      const nk = new Float32Array(this.keys.length * 2); nk.set(this.keys); this.keys = nk;
    }
    let i = this.size++;
    const it = this.items, ks = this.keys;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= key) break;
      it[i] = it[p]; ks[i] = ks[p]; i = p;
    }
    it[i] = item; ks[i] = key;
  }
  pop() {
    const it = this.items, ks = this.keys;
    const top = it[0];
    const lastI = it[--this.size], lastK = ks[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && ks[c + 1] < ks[c]) c++;
      if (ks[c] >= lastK) break;
      it[i] = it[c]; ks[i] = ks[c]; i = c;
    }
    it[i] = lastI; ks[i] = lastK;
    return top;
  }
}

const SQ2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

export class NavGrid {
  constructor(half, cell = 0.5) {
    this.half = half;
    this.cell = cell;
    this.n = Math.round((half * 2) / cell);
    const N = this.n * this.n;
    this.grid = new Uint8Array(N);
    this.opaque = new Uint8Array(N);
    this.corn = new Uint8Array(N);
    this.vaultId = new Int16Array(N).fill(-1);
    this.g = new Float32Array(N);
    this.came = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.cur = 1;
    this.heap = new Heap(4096);
  }

  ix(x) { return Math.floor((x + this.half) / this.cell); }
  inb(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n; }
  idx(x, z) {
    const i = this.ix(x), j = this.ix(z);
    if (!this.inb(i, j)) return -1;
    return j * this.n + i;
  }
  cx(i) { return -this.half + (i + 0.5) * this.cell; }

  // Mark cells whose centres fall inside the (inflated) box.
  raster(minX, maxX, minZ, maxZ, inflate, fn) {
    const i0 = Math.max(0, this.ix(minX - inflate)), i1 = Math.min(this.n - 1, this.ix(maxX + inflate));
    const j0 = Math.max(0, this.ix(minZ - inflate)), j1 = Math.min(this.n - 1, this.ix(maxZ + inflate));
    for (let j = j0; j <= j1; j++) {
      const z = this.cx(j);
      if (z < minZ - inflate || z > maxZ + inflate) continue;
      for (let i = i0; i <= i1; i++) {
        const x = this.cx(i);
        if (x < minX - inflate || x > maxX + inflate) continue;
        fn(j * this.n + i);
      }
    }
  }

  rasterCircle(x, z, r, fn) {
    const i0 = Math.max(0, this.ix(x - r)), i1 = Math.min(this.n - 1, this.ix(x + r));
    const j0 = Math.max(0, this.ix(z - r)), j1 = Math.min(this.n - 1, this.ix(z + r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (Math.hypot(this.cx(i) - x, this.cx(j) - z) <= r) fn(j * this.n + i);
    }
  }

  value(x, z) {
    const k = this.idx(x, z);
    return k < 0 ? BLOCK : this.grid[k];
  }

  isFree(x, z) { return this.value(x, z) === FREE; }

  areaFree(x, z, r) {
    const i0 = this.ix(x - r), i1 = this.ix(x + r), j0 = this.ix(z - r), j1 = this.ix(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!this.inb(i, j)) return false;
      const k = j * this.n + i;
      if (this.grid[k] !== FREE) return false;
    }
    return true;
  }

  cellCost(k, role) {
    const v = this.grid[k];
    if (v === FREE) return 0;
    if (v === BLOCK) return -1;
    if (v === WINDOW) return role === 'killer' ? 9 : 2.5;
    if (v === PALLET_DOWN) return role === 'killer' ? 11 : 2.5;
    return -1;
  }

  nearestWalkable(x, z, maxR = 6) {
    const k = this.idx(x, z);
    if (k >= 0 && this.grid[k] === FREE) return [x, z];
    const ci = this.ix(x), cj = this.ix(z);
    const steps = Math.ceil(maxR / this.cell);
    for (let r = 1; r <= steps; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (!this.inb(i, j)) continue;
        if (this.grid[j * this.n + i] === FREE) return [this.cx(i), this.cx(j)];
      }
    }
    return null;
  }

  // A*; returns [{x, z, vault}] where vault >= 0 marks a vault crossing waypoint.
  findPath(sx, sz, tx, tz, role = 'survivor', danger = null, maxNodes = 14000) {
    const n = this.n;
    let s = this.nearestWalkable(sx, sz, 3);
    let t = this.nearestWalkable(tx, tz, 6);
    if (!s || !t) return null;
    const si = this.ix(s[0]), sj = this.ix(s[1]), ti = this.ix(t[0]), tj = this.ix(t[1]);
    const start = sj * n + si, goal = tj * n + ti;
    const cur = ++this.cur;
    const heap = this.heap; heap.clear();
    this.g[start] = 0; this.stamp[start] = cur; this.came[start] = -1;
    heap.push(start, 0);
    let found = false, expanded = 0, best = start, bestH = Infinity;
    while (heap.size) {
      const k = heap.pop();
      if (this.closed[k] === cur) continue;
      this.closed[k] = cur;
      if (k === goal) { found = true; break; }
      if (++expanded > maxNodes) break;
      const i = k % n, j = (k / n) | 0;
      const h0 = Math.hypot(i - ti, j - tj);
      if (h0 < bestH) { bestH = h0; best = k; }
      for (const [di, dj, w] of DIRS) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni;
        const c = this.cellCost(nk, role);
        if (c < 0) continue;
        if (di && dj) {
          // no corner cutting
          if (this.grid[j * n + ni] === BLOCK || this.grid[nj * n + i] === BLOCK) continue;
          if (this.grid[nk] !== FREE) continue;
        }
        let ng = this.g[k] + w + c;
        if (danger) ng += danger(this.cx(ni), this.cx(nj));
        if (this.stamp[nk] !== cur || ng < this.g[nk]) {
          if (this.stamp[nk] === cur && this.closed[nk] === cur) continue;
          this.stamp[nk] = cur; this.g[nk] = ng; this.came[nk] = k;
          const dx = Math.abs(ni - ti), dz = Math.abs(nj - tj);
          const h = (dx + dz) + (SQ2 - 2) * Math.min(dx, dz);
          heap.push(nk, ng + h);
        }
      }
    }
    const end = found ? goal : best;
    if (end === start) return [{ x: t[0], z: t[1], vault: -1 }];
    // reconstruct
    const cells = [];
    for (let k = end; k !== -1; k = this.came[k]) cells.push(k);
    cells.reverse();
    // compress vault runs into single waypoints
    const raw = [];
    for (let q = 0; q < cells.length; q++) {
      const k = cells[q];
      const v = this.grid[k];
      const x = this.cx(k % n), z = this.cx((k / n) | 0);
      if (v === WINDOW || v === PALLET_DOWN) {
        const id = this.vaultId[k];
        const last = raw[raw.length - 1];
        if (last && last.vault === id) continue;
        raw.push({ x, z, vault: id });
      } else raw.push({ x, z, vault: -1 });
    }
    // string pulling between vault waypoints
    const out = [];
    let a = { x: sx, z: sz };
    let q = 0;
    while (q < raw.length) {
      if (raw[q].vault >= 0) { out.push(raw[q]); a = raw[q]; q++; continue; }
      let far = q;
      for (let r = q + 1; r < raw.length && r < q + 40; r++) {
        if (raw[r].vault >= 0) break;
        if (this.walkableLine(a.x, a.z, raw[r].x, raw[r].z)) far = r;
      }
      out.push(raw[far]);
      a = raw[far];
      q = far + 1;
    }
    if (found) out[out.length - 1] = { x: t[0], z: t[1], vault: out[out.length - 1].vault };
    return out;
  }

  walkableLine(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const k = this.idx(ax + (bx - ax) * t, az + (bz - az) * t);
      if (k < 0 || this.grid[k] !== FREE) return false;
    }
    return true;
  }

  // Sight line: blocked by opaque cells; dense corn limits it to ~5 m.
  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.6));
    let corn = 0;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const k = this.idx(ax + (bx - ax) * t, az + (bz - az) * t);
      if (k < 0) return false;
      if (this.opaque[k]) return false;
      if (this.corn[k]) { corn += d / steps; if (corn > 5) return false; }
    }
    return true;
  }
}
