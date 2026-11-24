// The walking map: where people can walk, and the way from anywhere to
// anywhere. The park is cut into 3-stud cells. Each cell has a floor (the
// terrain, raised by paths, plazas, decks and steps) and a cost: paved
// paths are cheap, lawns dearer, other rides' queue mazes dearer still, and
// buildings, walls, fences, water, trees and low coaster track can't be
// walked at all. Neighbouring cells join where their floors are within a
// step of each other (so the Lower Lot's cliffs are no way down - its
// escalators are, as links of their own). A* finds the cheapest way; the
// way is then pulled straight where it can be walked straight, and kept for
// the next guest going the same way.
const CELL = 3;
const STEP = 1.05; // highest step between neighbouring cells
const PATH_MATS = new Set(['Pavement', 'Concrete', 'Asphalt', 'Cobblestone', 'Brick', 'WoodPlanks', 'Slate', 'DiamondPlate', 'Granite', 'Marble', 'Sand']);
const COST = { path: 1, lawn: 3, queue: 7 };

export class NavGrid {
  constructor(data, terrain, { x0 = -840, x1 = 1275, z0 = -1012, z1 = 850, extra = [] } = {}) {
    this.x0 = x0; this.z0 = z0;
    this.nx = Math.ceil((x1 - x0) / CELL);
    this.nz = Math.ceil((z1 - z0) / CELL);
    const N = this.nx * this.nz;
    this.N = N;
    this.floor = new Float32Array(N);
    this.cost = new Uint8Array(N); // 0: can't walk here
    const ground = new Float32Array(N);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const k = j * this.nx + i;
      const g = terrain ? terrain.heightAt(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL) : 0;
      ground[k] = g;
      this.floor[k] = g;
      this.cost[k] = COST.lawn;
    }
    const hidden = new Set(data.hidden || []);
    const mats = data.materials;
    // every upright part's footprint: [part, cells]
    const parts = [];
    for (let n = 0; n < data.static.length; n++) {
      const p = data.static[n];
      // which local axis points up? (tilted parts - track pieces, ramps - are left out, as the player's collision leaves them out)
      const ax = [p[7], p[10], p[13]], ay = [p[8], p[11], p[14]], az = [p[9], p[12], p[15]];
      let up = -1;
      if (Math.abs(ay[1]) > 0.97) up = 1; else if (Math.abs(ax[1]) > 0.97) up = 0; else if (Math.abs(az[1]) > 0.97) up = 2;
      if (up < 0) continue;
      const half = [p[1] / 2, p[2] / 2, p[3] / 2];
      const axes = [ax, ay, az];
      const h = [0, 1, 2].filter((a) => a !== up);
      const u = [axes[h[0]][0], axes[h[0]][2]], v = [axes[h[1]][0], axes[h[1]][2]];
      const hu = half[h[0]], hv = half[h[1]];
      parts.push({ n, p, top: p[5] + half[up], bottom: p[5] - half[up], u, v, hu, hv, area: hu * hv * 4, collide: p[19] === 1 && !hidden.has(n) ? 1 : p[19] === 1 ? 2 : 0, path: PATH_MATS.has(mats[p[17]]) });
    }
    const cells = (q, pad, fn) => {
      const p = q.p;
      const ex = Math.abs(q.u[0]) * q.hu + Math.abs(q.v[0]) * q.hv + pad, ez = Math.abs(q.u[1]) * q.hu + Math.abs(q.v[1]) * q.hv + pad;
      const i0 = Math.max(0, Math.floor((p[4] - ex - x0) / CELL)), i1 = Math.min(this.nx - 1, Math.floor((p[4] + ex - x0) / CELL));
      const j0 = Math.max(0, Math.floor((p[6] - ez - z0) / CELL)), j1 = Math.min(this.nz - 1, Math.floor((p[6] + ez - z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = x0 + (i + 0.5) * CELL - p[4], dz = z0 + (j + 0.5) * CELL - p[6];
        const lu = dx * q.u[0] + dz * q.u[1], lv = dx * q.v[0] + dz * q.v[1];
        if (Math.abs(lu) <= q.hu + pad && Math.abs(lv) <= q.hv + pad) fn(j * this.nx + i);
      }
    };
    // 1. what you walk on: paths, plazas, decks and steps raise the floor
    //    (low ones anywhere, higher ones only when they're big enough to stand on)
    for (const q of parts) {
      if (q.p[2] > 40 || q.top - q.bottom > 40) continue;
      cells(q, 0, (k) => {
        const rise = q.top - ground[k];
        if (rise < -0.6 || rise > 3.2) return;
        if (q.collide === 1 && (rise <= 0.8 || (q.area >= 30 && rise <= 3.2)) && q.top > this.floor[k]) this.floor[k] = q.top;
        if (q.path && rise > -0.6 && rise < 0.8) this.cost[k] = COST.path;
      });
    }
    // 2. what's in the way: anything solid from knee to head height
    for (const q of parts) {
      if (q.collide !== 1) continue;
      cells(q, 0.6, (k) => {
        const f = this.floor[k];
        if (q.top > f + 0.8 && q.bottom < f + 4.5) this.cost[k] = 0;
      });
    }
    // 3. water
    for (const t of data.terrain || []) {
      if (t.material !== 'Water') continue;
      const [cx, cy, cz] = t.cf;
      const top = cy + (t.kind === 'cylinder' ? (t.height || 4) / 2 : (t.size?.[1] || 1) / 2);
      const rx = t.kind === 'cylinder' ? t.radius : t.size[0] / 2, rz = t.kind === 'cylinder' ? t.radius : t.size[2] / 2;
      this.forCells(cx - rx, cz - rz, cx + rx, cz + rz, (k, x, z) => {
        const inside = t.kind === 'cylinder' ? Math.hypot(x - cx, z - cz) <= rx : true;
        if (inside && top > this.floor[k] + 0.2) this.cost[k] = 0;
      });
    }
    // 4. tree trunks
    for (const t of data.trees || []) this.forCells(t.pos[0] - 1.4, t.pos[2] - 1.4, t.pos[0] + 1.4, t.pos[2] + 1.4, (k) => { this.cost[k] = 0; });
    // 5. coaster track down at walking height (the tram's road and the
    //    railways are crossed, at a cost, like level crossings)
    for (const r of data.rides || []) {
      const style = r.trackStyle?.style;
      if (!r.track || style === 'road') continue;
      const P = r.track.pos;
      for (let s = 0; s < P.length; s += 3) {
        const x = P[s], y = P[s + 1], z = P[s + 2];
        this.forCells(x - 2.6, z - 2.6, x + 2.6, z + 2.6, (k) => {
          if (!(y - this.floor[k] < 6.5 && y - this.floor[k] > -2)) return;
          if (style === 'rails') { if (this.cost[k]) this.cost[k] = Math.max(this.cost[k], 5); } else this.cost[k] = 0;
        });
      }
    }
    // 6. queue mazes: walkable, but out of everyone's way unless there's nothing else
    for (const r of data.rides || []) {
      const q = r.queue?.points;
      if (!q) continue;
      for (let s = 0; s + 3 < q.length; s += 2) {
        const ax = q[s], az = q[s + 1], bx = q[s + 2], bz = q[s + 3];
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
        for (let t = 0; t <= n; t++) {
          const x = ax + ((bx - ax) * t) / n, z = az + ((bz - az) * t) / n;
          this.forCells(x - 1.4, z - 1.4, x + 1.4, z + 1.4, (k) => { if (this.cost[k] && this.cost[k] < COST.queue) this.cost[k] = COST.queue; });
        }
      }
    }
    // 7. only the park: its lands (and a margin), the ground round anything
    //    standing outside them, and any extra areas (the haunt's backstage lot)
    const rects = [];
    for (const l of data.config.Lands) for (const [a, b, c, d] of l.regions) rects.push([Math.min(a, c) - 12, Math.min(b, d) - 12, Math.max(a, c) + 12, Math.max(b, d) + 12]);
    const inLands = (x, z) => rects.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
    const around = (x, z, r) => { if (!inLands(x, z)) rects.push([x - r, z - r, x + r, z + r]); };
    for (const r of data.config.Rides) for (const p of [r.entrance, r.exit]) if (p) around(p[0], p[2], 50);
    for (const v of data.config.Venues) around(v.position[0], v.position[2], 50);
    for (const e of extra) rects.push(e);
    const keep = new Uint8Array(N);
    for (const [a, b, c, d] of rects) this.forCells(a, b, c, d, (k) => { keep[k] = 1; });
    for (let k = 0; k < N; k++) if (!keep[k]) this.cost[k] = 0;
    this.inside = keep; // (the park's area, walkable or not)
    // links that aren't next door: the Lower Lot's escalators (down one lane, up the other)
    this.portals = new Map();
    this.addEscalators(data.escalators || []);
    this.components();
    // A* working space
    this.g = new Float32Array(N);
    this.came = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 0;
    this.heapI = new Int32Array(N * 3);
    this.heapF = new Float32Array(N * 3);
    this.cache = new Map();
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  cx(k) { return this.x0 + ((k % this.nx) + 0.5) * CELL; }
  cz(k) { return this.z0 + (Math.floor(k / this.nx) + 0.5) * CELL; }

  forCells(xa, za, xb, zb, fn) {
    const i0 = Math.max(0, Math.floor((xa - this.x0) / CELL)), i1 = Math.min(this.nx - 1, Math.floor((xb - this.x0) / CELL));
    const j0 = Math.max(0, Math.floor((za - this.z0) / CELL)), j1 = Math.min(this.nz - 1, Math.floor((zb - this.z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * this.nx + i, this.x0 + (i + 0.5) * CELL, this.z0 + (j + 0.5) * CELL);
  }

  // the floor under a point (for keeping walkers' feet on it)
  floorAt(x, z) {
    const k = this.idx(x, z);
    return k < 0 ? 0 : this.floor[k];
  }

  walkable(k) {
    return k >= 0 && this.cost[k] > 0;
  }

  // each flight pair (down lane, up lane) becomes one link from the top of
  // the escalators to the bottom, walked down the down lane and up the up lane
  addEscalators(list) {
    const lanes = list.map((e) => ({ ...e }));
    const downs = lanes.filter((e) => e.dir === 'down').sort((a, b) => b.ya - a.ya);
    const ups = lanes.filter((e) => e.dir === 'up').sort((a, b) => b.ya - a.ya);
    if (!downs.length || !ups.length) return;
    const chain = (ls) => {
      const pts = [];
      ls.forEach((e, i) => {
        if (i === 0) pts.push([e.x, e.ya, e.za + Math.sign(e.za - e.zb) * 5]);
        pts.push([e.x, e.ya, e.za], [e.x, e.yb, e.zb]);
        if (i === ls.length - 1) pts.push([e.x, e.yb, e.zb - Math.sign(e.za - e.zb) * 5]);
      });
      return pts;
    };
    const down = chain(downs), up = chain(ups).reverse();
    const top = this.nearest(down[0][0] + 2.4, down[0][1], down[0][2], 6), bottom = this.nearest(down[down.length - 1][0] + 2.4, down[down.length - 1][1], down[down.length - 1][2], 6);
    if (top < 0 || bottom < 0) return;
    let len = 0;
    for (let i = 1; i < down.length; i++) len += Math.hypot(down[i][0] - down[i - 1][0], down[i][1] - down[i - 1][1], down[i][2] - down[i - 1][2]);
    const link = (a, b, pts) => {
      if (!this.portals.has(a)) this.portals.set(a, []);
      this.portals.get(a).push({ to: b, cost: len, pts: pts.map(([x, y, z]) => ({ x, y, z, ride: true })) });
    };
    link(top, bottom, down);
    link(bottom, top, up);
  }

  // which cells reach which (the gate's group is the park)
  components() {
    const N = this.N, comp = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    let id = 0;
    this.sizes = [];
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0 || !this.cost[s]) continue;
      let sp = 0, count = 0;
      stack[sp++] = s; comp[s] = id;
      while (sp) {
        const k = stack[--sp];
        count++;
        this.neighbors(k, (n) => { if (comp[n] < 0) { comp[n] = id; stack[sp++] = n; } });
      }
      this.sizes.push(count);
      id++;
    }
    this.comp = comp;
  }

  // walkable neighbours of a cell (8 ways, no cutting corners, within a step), and its links
  neighbors(k, fn) {
    const nx = this.nx, i = k % nx, j = (k - i) / nx, f = this.floor[k];
    const ok = (n) => this.cost[n] > 0 && Math.abs(this.floor[n] - f) <= STEP;
    const E = i + 1 < nx && ok(k + 1), W = i > 0 && ok(k - 1), S = j + 1 < this.nz && ok(k + nx), Nn = j > 0 && ok(k - nx);
    if (E) fn(k + 1, 1); if (W) fn(k - 1, 1); if (S) fn(k + nx, 1); if (Nn) fn(k - nx, 1);
    if (E && S && ok(k + nx + 1)) fn(k + nx + 1, 1.4142);
    if (W && S && ok(k + nx - 1)) fn(k + nx - 1, 1.4142);
    if (E && Nn && ok(k - nx + 1)) fn(k - nx + 1, 1.4142);
    if (W && Nn && ok(k - nx - 1)) fn(k - nx - 1, 1.4142);
    const links = this.portals.get(k);
    if (links) for (const l of links) fn(l.to, l.cost / CELL, l);
  }

  // the nearest walkable cell to a point, at about its height (in the park's group, if one is set)
  nearest(x, y, z, radius = 15, group = -1) {
    const k0 = this.idx(x, z);
    if (k0 < 0) return -1;
    let best = -1, bd = Infinity;
    const r = Math.ceil(radius / CELL);
    const i0 = k0 % this.nx, j0 = Math.floor(k0 / this.nx);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
      const k = j * this.nx + i;
      if (!this.cost[k] || Math.abs(this.floor[k] - y) > 4.5) continue;
      if (group >= 0 && this.comp && this.comp[k] !== group) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  // ---------------------------------------------------------------- A*
  pathCells(start, goal, maxExpand = 400000) {
    const nx = this.nx, gx = goal % nx, gz = Math.floor(goal / nx);
    const gen = ++this.gen;
    const g = this.g, came = this.came, stamp = this.stamp, closed = this.closed, HI = this.heapI, HF = this.heapF, cap = HI.length;
    const links = new Map();
    let size = 0;
    const push = (k, f) => {
      if (size >= cap) return;
      let c = size++;
      while (c > 0) { const p = (c - 1) >> 1; if (HF[p] <= f) break; HI[c] = HI[p]; HF[c] = HF[p]; c = p; }
      HI[c] = k; HF[c] = f;
    };
    const pop = () => {
      const top = HI[0], last = HI[--size], lf = HF[size];
      let c = 0;
      for (;;) {
        let ch = 2 * c + 1;
        if (ch >= size) break;
        if (ch + 1 < size && HF[ch + 1] < HF[ch]) ch++;
        if (HF[ch] >= lf) break;
        HI[c] = HI[ch]; HF[c] = HF[ch]; c = ch;
      }
      HI[c] = last; HF[c] = lf;
      return top;
    };
    const h = (k) => { const dx = Math.abs((k % nx) - gx), dz = Math.abs(Math.floor(k / nx) - gz); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)) * 1.7; }; // (weighted: quick, nearly the cheapest way)
    stamp[start] = gen; g[start] = 0; came[start] = -1;
    push(start, h(start));
    let expanded = 0;
    while (size) {
      const k = pop();
      if (k === goal) break;
      if (closed[k] === gen) continue; // (a stale entry: already done)
      closed[k] = gen;
      if (++expanded > maxExpand) return null;
      const gk = g[k], ck = this.cost[k];
      this.neighbors(k, (n, step, link) => {
        const ng = gk + step * (link ? 1 : (ck + this.cost[n]) / 2);
        if (closed[n] === gen || (stamp[n] === gen && ng >= g[n])) return;
        stamp[n] = gen; g[n] = ng; came[n] = k;
        if (link) links.set(n, link); else links.delete(n);
        push(n, ng + h(n));
      });
    }
    if (stamp[goal] !== gen) return null;
    const out = [];
    for (let k = goal; k !== -1; k = came[k]) out.push(k);
    out.reverse();
    return { cells: out, links };
  }

  // can you walk straight from cell a to cell b (no worse ground than the way you found)?
  straight(a, b, worst) {
    const ax = this.cx(a), az = this.cz(a), bx = this.cx(b), bz = this.cz(b);
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2);
    let prev = this.floor[a];
    for (let t = 1; t <= n; t++) {
      const k = this.idx(ax + ((bx - ax) * t) / n, az + ((bz - az) * t) / n);
      if (k < 0 || !this.cost[k] || this.cost[k] > worst || Math.abs(this.floor[k] - prev) > STEP) return false;
      // (and not between two blocked cells corner to corner)
      prev = this.floor[k];
    }
    return true;
  }

  // the way from one point to another, as points to walk through (cached)
  // (with compute false, only a way already found: undefined means "ask again later")
  route(from, to, compute = true) {
    const group = this.gateGroup ?? -1;
    const a = this.nearest(from.x, from.y, from.z, 15, group), b = this.nearest(to.x, to.y, to.z, 15, group);
    if (a < 0 || b < 0) return null;
    const key = a * this.N + b;
    if (this.cache.has(key)) return this.cache.get(key);
    if (!compute) return undefined;
    const res = this.pathCells(a, b);
    let pts = null;
    if (res) {
      pts = [];
      // runs between links, each pulled straight
      const cells = res.cells;
      let runStart = 0;
      const flush = (end) => {
        const run = cells.slice(runStart, end + 1);
        let i = 0;
        pts.push(this.pt(run[0]));
        while (i < run.length - 1) {
          // on as far as you can walk straight (no worse ground than the way between)
          let j = i + 1, w = Math.max(this.cost[run[i]], this.cost[run[j]]);
          for (let m = i + 2; m < run.length && m - i <= 80; m++) {
            const wm = Math.max(w, this.cost[run[m]]);
            if (!this.straight(run[i], run[m], wm)) break;
            j = m; w = wm;
          }
          pts.push(this.pt(run[j]));
          i = j;
        }
      };
      for (let m = 1; m < cells.length; m++) {
        const link = res.links.get(cells[m]);
        if (!link) continue;
        flush(m - 1);
        pts.push(...link.pts);
        runStart = m;
      }
      flush(cells.length - 1);
    }
    if (this.cache.size > 600) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, pts);
    return pts;
  }

  pt(k) {
    return { x: this.cx(k), y: this.floor[k], z: this.cz(k) };
  }
}
