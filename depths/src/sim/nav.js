/**
 * Navigation grid (0.5 m cells) for creatures and escorted NPCs. A cell is
 * walkable when it lies inside a room or a door opening and no static solid
 * collider overlaps a 0.5 m agent footprint. Door cells remember their door
 * so pathing can respect locked doors, refuge doors and the time a creature
 * needs to open each type. A* uses a caller-supplied rule for which cells a
 * given creature may enter (water only, no refuges, no crawlways ...).
 */
import { WALL_T } from './level.js';

export const CELL = 0.5;
const HALF = 0.25;

export class NavGrid {
  constructor(level) {
    this.level = level;
    const b = level.rooms.reduce((acc, r) => ({ minX: Math.min(acc.minX, r.x0), minZ: Math.min(acc.minZ, r.z0), maxX: Math.max(acc.maxX, r.x1), maxZ: Math.max(acc.maxZ, r.z1) }), { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity });
    this.minX = Math.floor(b.minX) - 1; this.minZ = Math.floor(b.minZ) - 1;
    this.w = Math.ceil((b.maxX - this.minX + 1) / CELL);
    this.h = Math.ceil((b.maxZ - this.minZ + 1) / CELL);
    const n = this.w * this.h;
    this.walk = new Uint8Array(n);
    this.room = new Int16Array(n).fill(-1);
    this.door = new Int16Array(n).fill(-1);
    this.water = new Uint8Array(n);
    this.crawl = new Uint8Array(n);
    this.floorY = new Float32Array(n);
    this.wide = new Uint8Array(n); // clear of obstacles by a player-sized margin
    this._build();
  }

  idx(cx, cz) { return cz * this.w + cx; }
  cellOf(x, z) { return [Math.floor((x - this.minX) / CELL), Math.floor((z - this.minZ) / CELL)]; }
  indexAt(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return this.idx(cx, cz);
  }
  center(i) { const cx = i % this.w, cz = (i / this.w) | 0; return { x: this.minX + (cx + 0.5) * CELL, z: this.minZ + (cz + 0.5) * CELL }; }

  _build() {
    const L = this.level, W = L.world;
    // door cells
    const doorRects = L.doors.map((d) => {
      const lat0 = d.c - d.w / 2 + 0.2, lat1 = d.c + d.w / 2 - 0.2;
      const n0 = d.bnd - WALL_T - 0.3, n1 = d.bnd + WALL_T + 0.3;
      return d.axis === 'x' ? [n0, lat0, n1, lat1] : [lat0, n0, lat1, n1];
    });
    const list = [];
    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const x = this.minX + (cx + 0.5) * CELL, z = this.minZ + (cz + 0.5) * CELL;
        const i = this.idx(cx, cz);
        let doorIx = -1;
        for (let k = 0; k < doorRects.length; k++) {
          const r = doorRects[k];
          if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) { doorIx = k; break; }
        }
        const room = L.roomAt(x, z);
        if (!room && doorIx < 0) continue;
        // floor under this cell (floors only: furniture tops are not floor)
        W.query(x - HALF, z - HALF, x + HALF, z + HALF, list);
        let fy = -Infinity;
        for (const bx of list) if (bx.tag === 'floor' && bx.minX <= x && bx.maxX >= x && bx.minZ <= z && bx.maxZ >= z && bx.maxY > fy) fy = bx.maxY;
        if (fy === -Infinity) continue;
        let blocked = false;
        for (const bx of list) {
          if (!bx.solid || !(bx.mask & 2)) continue;
          if (bx.tag === 'door' || bx.tag === 'floor') continue;
          if (bx.prop && (bx.prop.until || bx.prop.after)) continue; // flag-driven props move away later
          if (bx.maxY <= fy + 0.35 || bx.minY >= fy + 1.6) continue;
          blocked = true; break;
        }
        if (blocked) continue;
        this.walk[i] = 1;
        let wide = 1;
        W.query(x - 0.42, z - 0.42, x + 0.42, z + 0.42, list);
        for (const bx of list) {
          if (!bx.solid || !(bx.mask & 1) || bx.tag === 'floor' || bx.tag === 'door') continue;
          if (bx.maxY <= fy + 0.35 || bx.minY >= fy + 1.6) continue;
          wide = 0; break;
        }
        this.wide[i] = wide;
        this.floorY[i] = fy;
        this.room[i] = room ? room.index : -1;
        if (doorIx >= 0) this.door[i] = doorIx;
        if (L.waterAt(x, z)) this.water[i] = 1;
        if (L.inCrawl(x, z)) this.crawl[i] = 1;
      }
    }
  }

  /** Nearest walkable cell (spiral search) accepted by `ok`. */
  nearest(x, z, ok = null, maxR = 12) {
    const [cx, cz] = this.cellOf(x, z);
    for (let r = 0; r <= maxR; r++) {
      let best = -1, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const i = this.idx(nx, nz);
          if (!this.walk[i] || (ok && !ok(i))) continue;
          const c = this.center(i);
          const d = (c.x - x) ** 2 + (c.z - z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /**
   * A* from (sx,sz) to (tx,tz). `ok(i)` decides if a cell may be entered,
   * `doorCost(doorIndex)` returns extra seconds-as-metres (Infinity = impassable).
   * Returns an array of {x,z} waypoints (string-pulled) or null.
   */
  path(sx, sz, tx, tz, ok = null, doorCost = null, maxNodes = 40000) {
    const s = this.nearest(sx, sz, ok, 4), t = this.nearest(tx, tz, ok, 14);
    if (s < 0 || t < 0) return null;
    if (s === t) return [this.center(t)];
    const n = this.w * this.h;
    if (!this._g || this._g.length !== n) { this._g = new Float32Array(n); this._from = new Int32Array(n); this._seen = new Uint32Array(n); this._stamp = 0; }
    const g = this._g, from = this._from, seen = this._seen;
    const stamp = ++this._stamp;
    const heap = new Heap();
    const tc = this.center(t);
    g[s] = 0; from[s] = -1; seen[s] = stamp * 2;
    heap.push(s, this._h(s, tc));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === t) break;
      if (seen[cur] === stamp * 2 + 1) continue;
      seen[cur] = stamp * 2 + 1;
      if (++expanded > maxNodes) return null;
      const cx = cur % this.w, cz = (cur / this.w) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DX[k], dz = DZ[k];
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const ni = this.idx(nx, nz);
        if (!this.walk[ni] || (ok && !ok(ni))) continue;
        if (dx && dz && (!this.walk[this.idx(cx + dx, cz)] || !this.walk[this.idx(cx, cz + dz)])) continue;
        let cost = (dx && dz ? 1.4142 : 1) * CELL;
        if (!this.wide[ni] && this.door[ni] < 0) cost += 0.35;
        const di = this.door[ni];
        if (di >= 0 && this.door[cur] !== di && doorCost) {
          const c = doorCost(di);
          if (c === Infinity) continue;
          cost += c;
        }
        const ng = g[cur] + cost;
        if ((seen[ni] >> 1) === stamp && (seen[ni] & 1)) continue;
        if ((seen[ni] >> 1) !== stamp || ng < g[ni]) {
          g[ni] = ng; from[ni] = cur; seen[ni] = stamp * 2;
          heap.push(ni, ng + this._h(ni, tc));
        }
      }
    }
    if ((seen[t] >> 1) !== stamp) return null;
    const cells = [];
    for (let c = t; c >= 0; c = from[c]) { cells.push(c); if (c === s) break; }
    cells.reverse();
    return this._smooth(cells, ok);
  }

  pathLength(pts, sx, sz) {
    let len = 0, px = sx, pz = sz;
    for (const p of pts) { len += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
    return len;
  }

  _h(i, tc) { const c = this.center(i); return Math.hypot(c.x - tc.x, c.z - tc.z); }

  /**
   * Keep waypoints where straight walks would leave walkable cells, and route
   * every door crossing through the door's centre line (in, centre, out) so
   * agents never clip a jamb.
   */
  _smooth(cells, ok) {
    const out = [];
    const doors = this.level.doors;
    let anchor = 0;
    let i = 1;
    while (i < cells.length) {
      const di = this.door[cells[i]];
      if (di >= 0) {
        // emit the approach / centre / exit points for this door
        const d = doors[di];
        const prev = this.center(cells[anchor]);
        let j = i;
        while (j + 1 < cells.length && this.door[cells[j + 1]] === di) j++;
        const next = this.center(cells[Math.min(cells.length - 1, j + 1)]);
        const dir = d.axis === 'x' ? Math.sign(next.x - prev.x) || 1 : Math.sign(next.z - prev.z) || 1;
        const lat = Math.max(d.c - d.w / 2 + 0.38, Math.min(d.c + d.w / 2 - 0.38, d.c));
        const pt = (n) => (d.axis === 'x' ? { x: d.bnd + n * dir, z: lat } : { x: lat, z: d.bnd + n * dir });
        out.push(pt(-0.65), pt(0), pt(0.65));
        anchor = Math.min(cells.length - 1, j + 1);
        i = anchor + 1;
        continue;
      }
      if (!this._lineWalkable(cells[anchor], cells[i], ok)) {
        const keep = i - 1 > anchor ? i - 1 : i;
        out.push(this.center(cells[keep]));
        anchor = keep;
      }
      i++;
    }
    out.push(this.center(cells[cells.length - 1]));
    return out.filter((p, k) => k === 0 || Math.abs(p.x - out[k - 1].x) > 1e-6 || Math.abs(p.z - out[k - 1].z) > 1e-6);
  }

  _lineWalkable(a, b, ok) {
    const A = this.center(a), B = this.center(b);
    const d = Math.hypot(B.x - A.x, B.z - A.z);
    const n = Math.ceil(d / (CELL * 0.5));
    for (let k = 1; k < n; k++) {
      const x = A.x + (B.x - A.x) * k / n, z = A.z + (B.z - A.z) * k / n;
      const i0 = this.indexAt(x, z);
      if (i0 < 0 || !this.walk[i0] || !this.wide[i0] || (ok && !ok(i0)) || this.door[i0] >= 0) return false;
      for (const [ox, oz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
        const i = this.indexAt(x + ox, z + oz);
        if (i < 0 || !this.walk[i] || (ok && !ok(i)) || this.door[i] >= 0) return false;
      }
    }
    return true;
  }

  /** Flood fill from a cell: set of reachable cell indices under `ok` and `doorCost`. */
  reachable(x, z, ok = null, doorCost = null) {
    const s = this.nearest(x, z, ok, 4);
    const seen = new Uint8Array(this.w * this.h);
    if (s < 0) return seen;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const cur = stack.pop();
      const cx = cur % this.w, cz = (cur / this.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], nz = cz + DZ[k];
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const ni = this.idx(nx, nz);
        if (seen[ni] || !this.walk[ni] || (ok && !ok(ni))) continue;
        const di = this.door[ni];
        if (di >= 0 && this.door[cur] !== di && doorCost && doorCost(di) === Infinity) continue;
        seen[ni] = 1; stack.push(ni);
      }
    }
    return seen;
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];

class Heap {
  constructor() { this.items = []; this.pri = []; }
  get size() { return this.items.length; }
  push(it, p) {
    const a = this.items, q = this.pri;
    a.push(it); q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (q[pa] <= q[i]) break;
      [a[pa], a[i]] = [a[i], a[pa]]; [q[pa], q[i]] = [q[i], q[pa]];
      i = pa;
    }
  }
  pop() {
    const a = this.items, q = this.pri;
    const top = a[0];
    const la = a.pop(), lq = q.pop();
    if (a.length) {
      a[0] = la; q[0] = lq;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [q[m], q[i]] = [q[i], q[m]];
        i = m;
      }
    }
    return top;
  }
}
