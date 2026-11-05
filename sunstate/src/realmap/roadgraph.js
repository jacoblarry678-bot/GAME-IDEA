/**
 * The real map's drivable road graph (graph.bin.gz, see tools/mapdata/graph_bin.mjs):
 * typed arrays, a spatial grid of edges, nearest-road lookup and A* routing. It is loaded in
 * a worker (graphworker.js) so neither the download nor a long route stalls the game.
 *
 * Coordinates are game metres (x east, z south). An edge runs from node a to node b along its
 * polyline; a one-way edge (flag 8) may only be driven a → b.
 */
export const F_BRIDGE = 1, F_TUNNEL = 2, F_LINK = 4, F_ONEWAY = 8, F_DRIVEWAY = 16;
const CELL = 250;
// cruising speed by class (m/s) when the data has no limit
const CLASS_SPEED = [29, 24, 17, 15, 13, 11, 7, 11, 6, 3, 2, 2, 2, 4, 3, 2, 8];

export class RoadGraph {
  /** Fetch and decode (enc 'b64gz' when the host serves base64 text). */
  static async load(url, enc) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    let buf;
    if (enc === 'b64gz') {
      const bin = atob((await r.text()).trim());
      buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    } else buf = new Uint8Array(await r.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return new RoadGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }

  constructor(ab) {
    const h = new Uint32Array(ab, 0, 8);
    if (h[0] !== 0x31304752) throw new Error('road graph: bad header');
    const N = h[1], E = h[2], P = h[3], NB = h[4];
    let o = 32;
    const take = (T, n) => { const a = new T(ab, o, n); o += n * T.BYTES_PER_ELEMENT; return a; };
    const nodesDm = take(Int32Array, 2 * N);
    this.eA = take(Uint32Array, E); this.eB = take(Uint32Array, E); this.eOff = take(Uint32Array, E + 1); this.eName = take(Uint32Array, E);
    const ptsDm = take(Int32Array, 2 * P);
    this.cls = take(Uint8Array, E); this.flags = take(Uint8Array, E); this.lvl = take(Int8Array, E); this.kmh = take(Uint8Array, E);
    this.names = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, o, NB)));
    this.N = N; this.E = E;
    this.nodes = new Float32Array(2 * N);
    for (let i = 0; i < 2 * N; i++) this.nodes[i] = nodesDm[i] / 10;
    // polylines back to absolute metres
    this.pts = new Float32Array(2 * P);
    this.len = new Float32Array(E);
    for (let e = 0; e < E; e++) {
      let x = 0, z = 0, L = 0;
      for (let p = this.eOff[e]; p < this.eOff[e + 1]; p++) {
        const first = p === this.eOff[e];
        const nx = first ? ptsDm[p * 2] : x + ptsDm[p * 2], nz = first ? ptsDm[p * 2 + 1] : z + ptsDm[p * 2 + 1];
        if (!first) L += Math.hypot(nx - x, nz - z);
        x = nx; z = nz;
        this.pts[p * 2] = x / 10; this.pts[p * 2 + 1] = z / 10;
      }
      this.len[e] = L / 10;
    }
    // adjacency (every edge at both its nodes)
    const deg = new Uint32Array(N + 1);
    for (let e = 0; e < E; e++) { deg[this.eA[e]]++; deg[this.eB[e]]++; }
    this.adjOff = new Uint32Array(N + 1);
    for (let i = 0; i < N; i++) this.adjOff[i + 1] = this.adjOff[i] + deg[i];
    this.adj = new Uint32Array(this.adjOff[N]);
    const fill = this.adjOff.slice(0, N);
    for (let e = 0; e < E; e++) { this.adj[fill[this.eA[e]]++] = e; this.adj[fill[this.eB[e]]++] = e; }
    // spatial grid of edges by the cells their bounding boxes touch
    this.grid = new Map();
    for (let e = 0; e < E; e++) {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let p = this.eOff[e]; p < this.eOff[e + 1]; p++) {
        const x = this.pts[p * 2], z = this.pts[p * 2 + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      // (very long edges, like the Seven Mile Bridge, are listed in every cell along their line)
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
        for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
          if ((x1 - x0) > CELL * 2 && (z1 - z0) > CELL * 2 && !this.edgeNearCell(e, i, j)) continue;
          const k = i * 65536 + j;
          let l = this.grid.get(k);
          if (!l) this.grid.set(k, (l = []));
          l.push(e);
        }
      }
    }
    this.g = null; // A* scratch, allocated on first route
  }

  edgeNearCell(e, i, j) {
    const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
    for (let p = this.eOff[e]; p < this.eOff[e + 1] - 1; p++) {
      if (segDist(cx, cz, this.pts[p * 2], this.pts[p * 2 + 1], this.pts[p * 2 + 2], this.pts[p * 2 + 3]).d < CELL) return true;
    }
    return false;
  }

  speed(e) {
    const k = this.kmh[e];
    return k ? k / 3.6 : CLASS_SPEED[this.cls[e]] || 8;
  }

  canDrive(e, fromNode) { return !(this.flags[e] & F_ONEWAY) || this.eA[e] === fromNode; }

  /** Edge ids whose cells are within r of (x, z). */
  near(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const l = this.grid.get(i * 65536 + j);
        if (l) for (const e of l) out.add(e);
      }
    }
    return [...out];
  }

  /** Nearest point on a drivable edge: { e, x, z, d, s (distance along from a) }. */
  nearest(x, z, maxR = 400, ok = null) {
    let best = null;
    for (let r = 120; r <= maxR && !best; r *= 2) {
      for (const e of this.near(x, z, r)) {
        if ((this.flags[e] & F_TUNNEL) || (ok && !ok(e))) continue;
        let s = 0;
        for (let p = this.eOff[e]; p < this.eOff[e + 1] - 1; p++) {
          const ax = this.pts[p * 2], az = this.pts[p * 2 + 1], bx = this.pts[p * 2 + 2], bz = this.pts[p * 2 + 3];
          const q = segDist(x, z, ax, az, bx, bz);
          const sl = Math.hypot(bx - ax, bz - az);
          if (!best || q.d < best.d) best = { e, x: q.x, z: q.z, d: q.d, s: s + q.t * sl };
          s += sl;
        }
      }
    }
    return best;
  }

  /**
   * Draw the road map of a view (centre cx, cz; mpp metres per pixel; W×H pixels) into a 2D
   * context: GPS-style, minor streets only when zoomed in.
   */
  drawTo(ctx, cx, cz, mpp, W, H) {
    const x0 = cx - (W / 2) * mpp, z0 = cz - (H / 2) * mpp;
    ctx.fillStyle = '#122130'; ctx.fillRect(0, 0, W, H);
    const ids = this.near(cx, cz, (Math.max(W, H) / 2) * mpp + 50);
    // [classes, colour, width px, show below this many metres per pixel]
    const STYLE = [
      [[8], '#2c3b4a', 1, 1.6], [[5, 6, 7], '#3f5263', 1.2, 9], [[4], '#5c7183', 1.4, 30],
      [[3], '#8a9bab', 1.6, 80], [[2], '#e2cd84', 2, 1e9], [[1], '#f2b35a', 2.4, 1e9], [[0], '#ff9a3c', 2.8, 1e9],
    ];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [classes, col, w, maxMpp] of STYLE) {
      if (mpp > maxMpp) continue;
      ctx.strokeStyle = col; ctx.lineWidth = w * Math.max(1, Math.min(3, 2 / mpp));
      ctx.beginPath();
      for (const e of ids) {
        if (!classes.includes(this.cls[e]) || (this.flags[e] & F_DRIVEWAY)) continue;
        const a = this.eOff[e], b = this.eOff[e + 1];
        let px = -1e9, pz = -1e9;
        for (let p = a; p < b; p++) {
          const x = (this.pts[p * 2] - x0) / mpp, z = (this.pts[p * 2 + 1] - z0) / mpp;
          if (p === a) ctx.moveTo(x, z);
          else if (Math.abs(x - px) + Math.abs(z - pz) > 0.8 || p === b - 1) ctx.lineTo(x, z); else continue;
          px = x; pz = z;
        }
      }
      ctx.stroke();
    }
  }

  /** A subset of edges packed for transfer to the main thread. */
  pack(ids) {
    const n = ids.length;
    let P = 0;
    for (const e of ids) P += this.eOff[e + 1] - this.eOff[e];
    const out = {
      ids: Uint32Array.from(ids), a: new Uint32Array(n), b: new Uint32Array(n), cls: new Uint8Array(n), flags: new Uint8Array(n), lvl: new Int8Array(n),
      speed: new Float32Array(n), name: new Uint32Array(n), off: new Uint32Array(n + 1), pts: new Float32Array(2 * P), nodes: new Float32Array(4 * n),
    };
    let p = 0;
    ids.forEach((e, k) => {
      out.a[k] = this.eA[e]; out.b[k] = this.eB[e]; out.cls[k] = this.cls[e]; out.flags[k] = this.flags[e]; out.lvl[k] = this.lvl[e];
      out.speed[k] = this.speed(e); out.name[k] = this.eName[e]; out.off[k] = p;
      const a0 = this.eOff[e], a1 = this.eOff[e + 1];
      out.pts.set(this.pts.subarray(a0 * 2, a1 * 2), p * 2);
      p += a1 - a0;
      out.nodes[k * 4] = this.nodes[this.eA[e] * 2]; out.nodes[k * 4 + 1] = this.nodes[this.eA[e] * 2 + 1];
      out.nodes[k * 4 + 2] = this.nodes[this.eB[e] * 2]; out.nodes[k * 4 + 3] = this.nodes[this.eB[e] * 2 + 1];
    });
    out.off[n] = p;
    return out;
  }

  /** The polyline of edge e from distance s0 to s1 along it (s1 < s0 runs backwards). */
  slice(e, s0, s1, out) {
    const a = this.eOff[e], b = this.eOff[e + 1];
    const fwd = s1 >= s0;
    const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
    const seg = [];
    let s = 0;
    for (let p = a; p < b - 1; p++) {
      const ax = this.pts[p * 2], az = this.pts[p * 2 + 1], bx = this.pts[p * 2 + 2], bz = this.pts[p * 2 + 3];
      const l = Math.hypot(bx - ax, bz - az);
      if (s + l >= lo && s <= hi) {
        const t0 = Math.max(0, (lo - s) / (l || 1)), t1 = Math.min(1, (hi - s) / (l || 1));
        if (!seg.length) seg.push(ax + (bx - ax) * t0, az + (bz - az) * t0);
        seg.push(ax + (bx - ax) * t1, az + (bz - az) * t1);
      }
      s += l;
    }
    if (!fwd) for (let i = seg.length - 2; i >= 0; i -= 2) out.push(seg[i], seg[i + 1]);
    else for (const v of seg) out.push(v);
  }

  /**
   * Fastest drive from (x0, z0) to (x1, z1): { pts: [x, z, ...], len (m), eta (s), names } or null.
   * Service roads and parking aisles cost extra so routes keep to streets.
   */
  route(x0, z0, x1, z1) {
    const drivable = (e) => !(this.flags[e] & F_DRIVEWAY);
    const A = this.nearest(x0, z0, 800, drivable), B = this.nearest(x1, z1, 1600, drivable);
    if (!A || !B) return null;
    const N = this.N;
    if (!this.g) { this.g = new Float64Array(N); this.via = new Int32Array(N); this.closed = new Uint8Array(N); this.heap = new Heap(); }
    const g = this.g, via = this.via, closed = this.closed, heap = this.heap;
    g.fill(Infinity); via.fill(-1); closed.fill(0); heap.clear();
    const vmax = 30;
    const cost = (e) => this.len[e] / this.speed(e) * (this.cls[e] === 8 ? 1.6 : 1);
    const h = (n) => Math.hypot(this.nodes[n * 2] - x1, this.nodes[n * 2 + 1] - z1) / vmax;
    if (A.e === B.e && (B.s >= A.s || !(this.flags[A.e] & F_ONEWAY))) {
      const pts = []; this.slice(A.e, A.s, B.s, pts);
      return this.result(pts, [A.e]);
    }
    // leave the start edge toward either end it may be driven to
    const ta = A.s / this.speed(A.e), tb = (this.len[A.e] - A.s) / this.speed(A.e);
    if (!(this.flags[A.e] & F_ONEWAY)) { g[this.eA[A.e]] = ta; via[this.eA[A.e]] = -2; heap.push(ta + h(this.eA[A.e]), this.eA[A.e]); }
    g[this.eB[A.e]] = tb; via[this.eB[A.e]] = -3; heap.push(tb + h(this.eB[A.e]), this.eB[A.e]);
    // arriving: the goal edge entered from a (always) or from b (two-way only)
    const goalA = this.eA[B.e], goalB = this.eB[B.e];
    const finA = B.s / this.speed(B.e), finB = this.flags[B.e] & F_ONEWAY ? Infinity : (this.len[B.e] - B.s) / this.speed(B.e);
    let best = Infinity, bestNode = -1, iter = 0;
    while (heap.size && iter++ < 600000) {
      const [f, n] = heap.pop();
      if (closed[n]) continue;
      if (f >= best) break;
      closed[n] = 1;
      if (n === goalA && g[n] + finA < best) { best = g[n] + finA; bestNode = n; }
      if (n === goalB && g[n] + finB < best) { best = g[n] + finB; bestNode = n; }
      for (let k = this.adjOff[n]; k < this.adjOff[n + 1]; k++) {
        const e = this.adj[k];
        if (!this.canDrive(e, n) || (this.flags[e] & F_DRIVEWAY)) continue;
        const m = this.eA[e] === n ? this.eB[e] : this.eA[e];
        if (closed[m]) continue;
        const ng = g[n] + cost(e);
        if (ng < g[m]) { g[m] = ng; via[m] = e; heap.push(ng + h(m), m); }
      }
    }
    if (bestNode < 0) return null;
    // walk back from the goal node
    const chain = [];
    let n = bestNode;
    while (via[n] >= 0) { const e = via[n]; chain.push([e, n]); n = this.eA[e] === n ? this.eB[e] : this.eA[e]; }
    chain.reverse();
    const pts = [];
    // start edge: from the start point to the node we left by
    this.slice(A.e, A.s, via[n] === -2 ? 0 : this.len[A.e], pts);
    const edges = [A.e];
    for (const [e, to] of chain) { this.slice(e, this.eA[e] === to ? this.len[e] : 0, this.eA[e] === to ? 0 : this.len[e], pts); edges.push(e); }
    this.slice(B.e, bestNode === goalA ? 0 : this.len[B.e], B.s, pts);
    edges.push(B.e);
    return this.result(pts, edges, best);
  }

  result(pts, edges, eta = null) {
    let len = 0;
    for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    // the streets to follow, in order, without repeats
    const names = [];
    for (const e of edges) { const s = this.names[this.eName[e]]; if (s && names[names.length - 1] !== s) names.push(s); }
    return { pts: Float32Array.from(pts), len, eta: eta ?? len / 12, names: names.slice(0, 12), edges: Int32Array.from(edges) };
  }
}

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const x = ax + dx * t, z = az + dz * t;
  return { x, z, t, d: Math.hypot(px - x, pz - z) };
}

/** Binary min-heap of (priority, value) pairs. */
class Heap {
  constructor() { this.p = new Float64Array(1024); this.v = new Int32Array(1024); this.size = 0; }
  clear() { this.size = 0; }
  push(p, v) {
    if (this.size === this.p.length) { const np = new Float64Array(this.size * 2), nv = new Int32Array(this.size * 2); np.set(this.p); nv.set(this.v); this.p = np; this.v = nv; }
    let i = this.size++;
    while (i > 0) { const j = (i - 1) >> 1; if (this.p[j] <= p) break; this.p[i] = this.p[j]; this.v[i] = this.v[j]; i = j; }
    this.p[i] = p; this.v[i] = v;
  }
  pop() {
    const rp = this.p[0], rv = this.v[0];
    const p = this.p[--this.size], v = this.v[this.size];
    let i = 0;
    for (;;) {
      let c = i * 2 + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.p[c + 1] < this.p[c]) c++;
      if (this.p[c] >= p) break;
      this.p[i] = this.p[c]; this.v[i] = this.v[c]; i = c;
    }
    this.p[i] = p; this.v[i] = v;
    return [rp, rv];
  }
}
