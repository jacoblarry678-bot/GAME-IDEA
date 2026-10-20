/**
 * Static + toggleable collision world made of axis-aligned boxes with a
 * uniform XZ spatial hash. Used by player movement, creatures, line of sight
 * and photo occlusion. Pure math: runs in Node for tests and co-op hosts.
 *
 * Box flags:
 *   solid  - blocks movement (mask: 1 players, 2 creatures, 3 both)
 *   sight  - blocks line of sight and photographs
 *   active - false while a door is open, a barrier is lowered, etc.
 */
const EPS = 1e-4;

export class CollisionWorld {
  constructor(cellSize = 2) {
    this.cell = cellSize;
    this.boxes = [];
    this.grid = new Map();
    this._stamp = 1;
  }

  add(b) {
    const box = {
      minX: b.minX, minY: b.minY ?? 0, minZ: b.minZ, maxX: b.maxX, maxY: b.maxY ?? 3, maxZ: b.maxZ,
      solid: b.solid !== false,
      sight: b.sight !== false,
      mask: b.mask ?? 3,
      active: b.active !== false,
      mantle: !!b.mantle,
      tag: b.tag || null,
      id: this.boxes.length,
      _s: 0,
    };
    this.boxes.push(box);
    const c = this.cell;
    const x0 = Math.floor(box.minX / c), x1 = Math.floor(box.maxX / c);
    const z0 = Math.floor(box.minZ / c), z1 = Math.floor(box.maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = key(x, z);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(box);
      }
    }
    return box;
  }

  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const s = ++this._stamp;
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const arr = this.grid.get(key(x, z));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b._s === s) continue;
          b._s = s;
          if (!b.active) continue;
          if (b.maxX > minX && b.minX < maxX && b.maxZ > minZ && b.minZ < maxZ) out.push(b);
        }
      }
    }
    return out;
  }

  /** First solid box overlapping the AABB for the given mask, or null. */
  overlaps(minX, minY, minZ, maxX, maxY, maxZ, mask = 1) {
    const list = this.query(minX, minZ, maxX, maxZ, _tmp);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid || !(b.mask & mask)) continue;
      if (b.maxY > minY + EPS && b.minY < maxY - EPS) return b;
    }
    return null;
  }

  /**
   * Ray cast against active boxes. dir need not be normalized; t is in units
   * of |dir| (pass normalized for metres). mode: 'sight' | 'solid'.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, mode = 'sight', mask = 3) {
    const c = this.cell;
    let cx = Math.floor(ox / c), cz = Math.floor(oz / c);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) < 1e-9 ? Infinity : Math.abs(c / dx);
    const tDeltaZ = Math.abs(dz) < 1e-9 ? Infinity : Math.abs(c / dz);
    let tMaxX = Math.abs(dx) < 1e-9 ? Infinity : ((dx > 0 ? (cx + 1) * c - ox : ox - cx * c) / Math.abs(dx));
    let tMaxZ = Math.abs(dz) < 1e-9 ? Infinity : ((dz > 0 ? (cz + 1) * c - oz : oz - cz * c) / Math.abs(dz));
    const s = ++this._stamp;
    let best = null, bestT = maxDist;
    const invX = 1 / (Math.abs(dx) < 1e-12 ? 1e-12 : dx);
    const invY = 1 / (Math.abs(dy) < 1e-12 ? 1e-12 : dy);
    const invZ = 1 / (Math.abs(dz) < 1e-12 ? 1e-12 : dz);
    let tCell = 0;
    for (let iter = 0; iter < 1024; iter++) {
      const arr = this.grid.get(key(cx, cz));
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b._s === s) continue;
          b._s = s;
          if (!b.active) continue;
          if (mode === 'sight' && !b.sight) continue;
          if (mode === 'solid' && (!b.solid || !(b.mask & mask))) continue;
          const t1 = (b.minX - ox) * invX, t2 = (b.maxX - ox) * invX;
          let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
          const ty1 = (b.minY - oy) * invY, ty2 = (b.maxY - oy) * invY;
          tmin = Math.max(tmin, Math.min(ty1, ty2)); tmax = Math.min(tmax, Math.max(ty1, ty2));
          const tz1 = (b.minZ - oz) * invZ, tz2 = (b.maxZ - oz) * invZ;
          tmin = Math.max(tmin, Math.min(tz1, tz2)); tmax = Math.min(tmax, Math.max(tz1, tz2));
          if (tmax < Math.max(tmin, 0)) continue;
          if (tmin < 0) continue; // origin inside box
          if (tmin < bestT) { bestT = tmin; best = { t: tmin, box: b }; }
        }
      }
      if (tMaxX < tMaxZ) { tCell = tMaxX; tMaxX += tDeltaX; cx += stepX; } else { tCell = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      if (tCell > bestT || tCell > maxDist) break;
    }
    return best;
  }

  /** True if the straight segment a→b is unobstructed for sight. */
  clearLine(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    const hit = this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05, 'sight');
    return !hit;
  }

  groundHeight(x, z, y, radius = 0.3, mask = 1) {
    const list = this.query(x - radius, z - radius, x + radius, z + radius, _tmp);
    let h = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid || !(b.mask & mask)) continue;
      if (b.maxY <= y + 0.05 && b.maxY > h) h = b.maxY;
    }
    return h;
  }
}

function key(x, z) { return x * 73856093 ^ z * 19349663; }
const _tmp = [];

export const STEP_HEIGHT = 0.32;

/**
 * Kinematic body movement with step-up, ground snapping and wall sliding.
 * body: { x,y,z (feet), vx,vy,vz, radius, height, grounded, mask }
 */
export function moveBody(world, body, dt) {
  const maxStep = 0.15;
  const dist = Math.max(Math.abs(body.vx), Math.abs(body.vz), Math.abs(body.vy)) * dt;
  const n = Math.min(12, Math.max(1, Math.ceil(dist / maxStep)));
  const sdt = dt / n;
  const wasGrounded = body.grounded;
  let hit = false;
  for (let i = 0; i < n; i++) {
    if (moveAxis(world, body, 0, body.vx * sdt)) hit = true;
    if (moveAxis(world, body, 2, body.vz * sdt)) hit = true;
    moveVertical(world, body, body.vy * sdt);
  }
  if (wasGrounded && !body.grounded && body.vy <= 0) {
    const r = body.radius;
    const g = world.groundHeight(body.x, body.z, body.y, r - 0.02, body.mask || 1);
    if (g > -Infinity && body.y - g <= STEP_HEIGHT + 0.05 && body.y - g >= 0) {
      if (!world.overlaps(body.x - r, g + 0.01, body.z - r, body.x + r, g + body.height, body.z + r, body.mask || 1)) {
        body.y = g; body.grounded = true; body.vy = 0;
      }
    }
  }
  return hit;
}

function moveAxis(world, body, axis, d) {
  if (d === 0) return false;
  const r = body.radius, mask = body.mask || 1;
  const nx = axis === 0 ? body.x + d : body.x;
  const nz = axis === 2 ? body.z + d : body.z;
  const minY = body.y + 0.01, maxY = body.y + body.height;
  const list = world.query(nx - r, nz - r, nx + r, nz + r, _move);
  let blocked = null, stepTo = -Infinity;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!b.solid || !(b.mask & mask)) continue;
    if (b.maxY <= minY || b.minY >= maxY) continue;
    const rise = b.maxY - body.y;
    if (body.grounded && rise > 0 && rise <= STEP_HEIGHT) { if (b.maxY > stepTo) stepTo = b.maxY; continue; }
    if (!blocked) blocked = b;
    else if (axis === 0 ? (d > 0 ? b.minX < blocked.minX : b.maxX > blocked.maxX) : (d > 0 ? b.minZ < blocked.minZ : b.maxZ > blocked.maxZ)) blocked = b;
  }
  if (!blocked && stepTo > -Infinity) {
    if (!world.overlaps(nx - r, stepTo + 0.01, nz - r, nx + r, stepTo + body.height, nz + r, mask)) {
      body.y = stepTo;
      if (axis === 0) body.x = nx; else body.z = nz;
      return false;
    }
    blocked = list.find((bb) => bb.solid && (bb.mask & mask) && bb.maxY > minY && bb.minY < maxY);
  }
  if (!blocked) { if (axis === 0) body.x = nx; else body.z = nz; return false; }
  if (axis === 0) {
    if (d > 0) body.x = Math.min(body.x, blocked.minX - r - 0.001); else body.x = Math.max(body.x, blocked.maxX + r + 0.001);
    body.vx = 0;
  } else {
    if (d > 0) body.z = Math.min(body.z, blocked.minZ - r - 0.001); else body.z = Math.max(body.z, blocked.maxZ + r + 0.001);
    body.vz = 0;
  }
  body.lastBlock = blocked;
  return true;
}

function moveVertical(world, body, d) {
  const r = body.radius, mask = body.mask || 1;
  const ny = body.y + d;
  const list = world.query(body.x - r, body.z - r, body.x + r, body.z + r, _move);
  if (d <= 0) {
    let top = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid || !(b.mask & mask)) continue;
      if (b.maxY <= body.y + 0.001 && b.maxY >= ny - 0.001 && b.maxY > top) top = b.maxY;
    }
    if (top > -Infinity) { body.y = top; body.vy = 0; body.grounded = true; } else { body.y = ny; body.grounded = false; }
  } else {
    const head = body.y + body.height;
    let ceil = Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid || !(b.mask & mask)) continue;
      if (b.minY >= head - 0.001 && b.minY <= head + d + 0.001 && b.minY < ceil) ceil = b.minY;
    }
    if (ceil < Infinity) { body.y = ceil - body.height - 0.001; body.vy = 0; } else body.y = ny;
    body.grounded = false;
  }
}
const _move = [];
