/**
 * The main thread's view of the real road network: the drivable edges within ~800 m of the
 * camera (refreshed from graphworker.js as you move), with lane geometry helpers for traffic,
 * sidewalk lines for pedestrians, and async GPS routes over the whole map.
 */
import GraphWorker from './graphworker.js?worker&inline';
import { RoadGraph, F_TUNNEL, F_ONEWAY, F_LINK, F_DRIVEWAY, segDist } from './roadgraph.js';

export { F_TUNNEL, F_ONEWAY, F_LINK, F_DRIVEWAY };
const CLASS_W = [11, 10, 11, 9, 8, 7, 6, 6.5, 4.5, 4, 2.2, 2, 1.8, 3, 2, 2, 5];
export const CLS = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, residential: 5, living_street: 6, unclassified: 7, service: 8 };
const NEAR_R = 800, REFRESH = 220;

/** Offset a polyline sideways by d (positive = right of travel, x east / z south). */
export function offsetPts(pts, d) {
  const n = pts.length / 2, out = new Float32Array(pts.length);
  for (let i = 0; i < n; i++) {
    const px = pts[Math.max(0, i - 1) * 2], pz = pts[Math.max(0, i - 1) * 2 + 1];
    const nx = pts[Math.min(n - 1, i + 1) * 2], nz = pts[Math.min(n - 1, i + 1) * 2 + 1];
    let tx = nx - px, tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out[i * 2] = pts[i * 2] - tz * d; out[i * 2 + 1] = pts[i * 2 + 1] + tx * d;
  }
  return out;
}

export class RoadNet {
  constructor(world) {
    this.world = world;
    this.edges = new Map(); // id → edge
    this.nodes = new Map(); // id → { x, z, edges: [edge] }
    this.list = []; // edges as an array (for random picks)
    this.ready = false;
    this.center = null;
    this.pendingNear = false;
    this.reqs = new Map();
    this.nextId = 1;
    this.names = [];
  }

  start(index, base) {
    const meta = index.graphBin;
    if (!meta) return;
    const url = base + meta.f;
    try {
      this.worker = new GraphWorker();
      this.worker.onmessage = (e) => this.onMsg(e.data);
      this.worker.onerror = (e) => { console.warn('road graph worker failed', e.message); this.fallback(url, index.enc); };
      this.worker.postMessage({ type: 'init', url, enc: index.enc });
    } catch { this.fallback(url, index.enc); }
  }

  /** No worker: hold the graph on the main thread instead. */
  async fallback(url, enc) {
    this.worker = null;
    try {
      this.G = await RoadGraph.load(url, enc);
      this.names = this.G.names; this.ready = true;
    } catch (err) { console.warn('road graph unavailable', err); }
  }

  onMsg(m) {
    if (m.type === 'ready') { if (m.error) { console.warn('road graph:', m.error); return; } this.names = m.names; this.ready = true; return; }
    if (m.type === 'near') { this.pendingNear = false; this.absorb(m); return; }
    if (m.type === 'route' || m.type === 'render') { const r = this.reqs.get(m.id); this.reqs.delete(m.id); r?.(m.none ? null : m); }
  }

  /** Keep the nearby edge set fresh around (x, z). */
  update(x, z) {
    if (!this.ready || this.pendingNear) return;
    if (this.center && Math.hypot(x - this.center.x, z - this.center.z) < REFRESH) return;
    this.center = { x, z };
    if (this.worker) { this.pendingNear = true; this.worker.postMessage({ type: 'near', x, z, r: NEAR_R }); }
    else if (this.G) this.absorb({ x, z, ...this.G.pack(this.G.near(x, z, NEAR_R)) });
  }

  absorb(m) {
    const edges = new Map(), nodes = new Map();
    const node = (id, x, z) => { let n = nodes.get(id); if (!n) nodes.set(id, (n = { id, x, z, edges: [] })); return n; };
    for (let k = 0; k < m.ids.length; k++) {
      const id = m.ids[k];
      // an edge we already had keeps its object (drivers hold references to it)
      let e = this.edges.get(id);
      if (!e) {
        const pts = m.pts.slice(m.off[k] * 2, m.off[k + 1] * 2);
        let len = 0;
        for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
        const cls = m.cls[k], flags = m.flags[k];
        let w = CLASS_W[cls] ?? 6;
        if ((flags & F_ONEWAY) && cls <= 2) w *= 0.62;
        if (flags & F_LINK) w = Math.min(w, 5.5);
        const oneway = !!(flags & F_ONEWAY);
        const lanes = oneway ? Math.max(1, Math.round(w / 3.4)) : Math.max(1, Math.floor(w / 2 / 3.2));
        e = { id, a: m.a[k], b: m.b[k], cls, flags, lvl: m.lvl[k], speed: m.speed[k], name: this.names[m.name[k]] || '', pts, len, w, oneway, lanes, tunnel: !!(flags & F_TUNNEL) };
      }
      edges.set(id, e);
      const na = node(e.a, m.nodes[k * 4], m.nodes[k * 4 + 1]), nb = node(e.b, m.nodes[k * 4 + 2], m.nodes[k * 4 + 3]);
      na.edges.push(e); if (nb !== na) nb.edges.push(e);
    }
    this.edges = edges; this.nodes = nodes; this.list = [...edges.values()];
    this.version = (this.version || 0) + 1;
  }

  /** GPS: fastest route → Promise<{pts, len, eta, names} | null>. */
  route(x0, z0, x1, z1) {
    if (!this.ready) return Promise.resolve(null);
    if (!this.worker) return Promise.resolve(this.G?.route(x0, z0, x1, z1) || null);
    const id = this.nextId++;
    return new Promise((res) => { this.reqs.set(id, res); this.worker.postMessage({ type: 'route', id, x0, z0, x1, z1 }); });
  }

  /** The road map of a view as an image (CanvasImageSource) → Promise, or null before the graph loads. */
  render(cx, cz, mpp, w, h) {
    if (!this.ready) return Promise.resolve(null);
    if (!this.worker) {
      if (!this.G) return Promise.resolve(null);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      this.G.drawTo(c.getContext('2d'), cx, cz, mpp, w, h);
      return Promise.resolve(c);
    }
    const id = this.nextId++;
    return new Promise((res) => { this.reqs.set(id, (m) => res(m?.bmp || null)); this.worker.postMessage({ type: 'render', id, cx, cz, mpp, w, h }); });
  }

  /** The polyline of edge e in the direction leaving node `from` (a copy, x/z pairs). */
  dirPts(e, from) {
    if (from === e.a) return e.pts;
    const n = e.pts.length / 2, out = new Float32Array(e.pts.length);
    for (let i = 0; i < n; i++) { out[i * 2] = e.pts[(n - 1 - i) * 2]; out[i * 2 + 1] = e.pts[(n - 1 - i) * 2 + 1]; }
    return out;
  }

  /** Lane centre line on edge e leaving node `from`, lane 0 nearest the centre (two-way) or the left (one-way). */
  laneOffset(e, lane) {
    const lw = e.oneway ? e.w / e.lanes : (e.w / 2) / e.lanes;
    return e.oneway ? -e.w / 2 + (lane + 0.5) * lw : (lane + 0.5) * lw;
  }

  lanePts(e, from, lane) { return offsetPts(this.dirPts(e, from), this.laneOffset(e, lane)); }

  canDrive(e, from) { return !e.oneway || e.a === from; }

  /** Nearest point on a loaded edge (optionally filtered): { e, x, z, d, s, seg }. */
  nearest(x, z, ok = null, maxD = 60) {
    let best = null;
    for (const e of this.list) {
      if (ok && !ok(e)) continue;
      const p = e.pts;
      // quick reject on the end points and length
      if (Math.abs(p[0] - x) > e.len + maxD || Math.abs(p[1] - z) > e.len + maxD) continue;
      let s = 0;
      for (let i = 0; i < p.length - 2; i += 2) {
        const q = segDist(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]);
        const sl = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
        if (q.d < maxD && (!best || q.d < best.d)) best = { e, x: q.x, z: q.z, d: q.d, s: s + q.t * sl, seg: i / 2 };
        s += sl;
      }
    }
    return best;
  }
}

/** A point and direction at distance s along a polyline. */
export function along(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const dx = pts[i + 2] - pts[i], dz = pts[i + 3] - pts[i + 1], l = Math.hypot(dx, dz);
    if (acc + l >= s || i >= pts.length - 4) {
      const t = l ? Math.max(0, Math.min(1, (s - acc) / l)) : 0;
      return { x: pts[i] + dx * t, z: pts[i + 1] + dz * t, dx: dx / (l || 1), dz: dz / (l || 1), i: i / 2 };
    }
    acc += l;
  }
  return { x: pts[0], z: pts[1], dx: 0, dz: 1, i: 0 };
}

export function polyLen(pts) {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return L;
}
