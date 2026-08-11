/**
 * Grid A* over the map's floor arrays. Used by bots and by the Cenobite AI.
 * Paths are returned as world-space waypoints, already smoothed with a
 * line-of-sight string-pull so bots don't walk the staircase pattern.
 */

import {
  GRID_W,
  GRID_H,
  isSolid,
  gridToWorldX,
  gridToWorldZ,
  worldToGridX,
  worldToGridZ,
  hasLineOfSight,
} from '../shared/mapdata.js';

const NEIGHBOURS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Nearest walkable cell to (gx,gz) within `radius`, or null. */
export function nearestOpen(map, floor, gx, gz, radius = 6) {
  if (!isSolid(map, floor, gx, gz)) return [gx, gz];
  for (let r = 1; r <= radius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = gx + dx;
        const z = gz + dz;
        if (!isSolid(map, floor, x, z)) return [x, z];
      }
    }
  }
  return null;
}

/**
 * @returns {Array<{x:number,z:number}>|null} world-space waypoints, or null.
 */
export function findPath(map, floor, sx, sz, tx, tz, maxNodes = 6000) {
  const startG = nearestOpen(map, floor, worldToGridX(sx), worldToGridZ(sz));
  const goalG = nearestOpen(map, floor, worldToGridX(tx), worldToGridZ(tz));
  if (!startG || !goalG) return null;
  const [gx0, gz0] = startG;
  const [gx1, gz1] = goalG;
  if (gx0 === gx1 && gz0 === gz1) return [{ x: tx, z: tz }];

  const startIdx = gz0 * GRID_W + gx0;
  const goalIdx = gz1 * GRID_W + gx1;
  const gScore = new Float32Array(GRID_W * GRID_H).fill(Infinity);
  const cameFrom = new Int32Array(GRID_W * GRID_H).fill(-1);
  const closed = new Uint8Array(GRID_W * GRID_H);
  const h = (x, z) => {
    const dx = Math.abs(x - gx1);
    const dz = Math.abs(z - gz1);
    return (dx + dz) + (1.414 - 2) * Math.min(dx, dz);
  };

  const open = new MinHeap();
  gScore[startIdx] = 0;
  open.push({ i: startIdx, f: h(gx0, gz0) });

  let expanded = 0;
  let found = false;
  while (open.size && expanded < maxNodes) {
    const cur = open.pop();
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    expanded++;
    if (cur.i === goalIdx) {
      found = true;
      break;
    }
    const cx = cur.i % GRID_W;
    const cz = (cur.i / GRID_W) | 0;
    for (const [dx, dz, cost] of NEIGHBOURS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GRID_W || nz >= GRID_H) continue;
      if (isSolid(map, floor, nx, nz)) continue;
      // no cutting diagonal corners through walls
      if (dx && dz && (isSolid(map, floor, cx + dx, cz) || isSolid(map, floor, cx, cz + dz))) continue;
      const ni = nz * GRID_W + nx;
      if (closed[ni]) continue;
      const tentative = gScore[cur.i] + cost;
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        cameFrom[ni] = cur.i;
        open.push({ i: ni, f: tentative + h(nx, nz) });
      }
    }
  }
  if (!found) return null;

  // reconstruct
  const cells = [];
  let i = goalIdx;
  while (i !== -1 && i !== startIdx) {
    cells.push([i % GRID_W, (i / GRID_W) | 0]);
    i = cameFrom[i];
  }
  cells.push([gx0, gz0]);
  cells.reverse();

  // string-pull: drop waypoints we can see past
  const pts = cells.map(([x, z]) => ({ x: gridToWorldX(x), z: gridToWorldZ(z) }));
  const out = [pts[0]];
  let anchor = 0;
  for (let k = 2; k < pts.length; k++) {
    if (!hasLineOfSight(map, floor, pts[anchor].x, pts[anchor].z, pts[k].x, pts[k].z)) {
      out.push(pts[k - 1]);
      anchor = k - 1;
    }
  }
  out.push({ x: tx, z: tz });
  out.shift();
  return out;
}

/** Cheap flood-based "how far by walking", for bot target scoring. */
export function walkDistance(map, floor, sx, sz, tx, tz) {
  const p = findPath(map, floor, sx, sz, tx, tz, 2500);
  if (!p) return Infinity;
  let d = 0;
  let px = sx;
  let pz = sz;
  for (const w of p) {
    d += Math.hypot(w.x - px, w.z - pz);
    px = w.x;
    pz = w.z;
  }
  return d;
}
