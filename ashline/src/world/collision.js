/**
 * Static collision world made of axis-aligned boxes, with a uniform XZ
 * spatial hash for broadphase. Used by player movement, bots, hitscan,
 * grenades and the nav grid builder. Pure math — runs in Node too.
 */

const EPS = 1e-4;

export class CollisionWorld {
  constructor(cellSize = 4) {
    this.cell = cellSize;
    this.boxes = [];
    this.grid = new Map();
    this._stamp = 1;
    this.bounds = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  }

  /**
   * box: { minX,minY,minZ,maxX,maxY,maxZ, mat, bullet (blocks bullets), walk (can stand on), sight (blocks LOS) }
   */
  add(b) {
    const box = {
      minX: b.minX, minY: b.minY, minZ: b.minZ, maxX: b.maxX, maxY: b.maxY, maxZ: b.maxZ,
      mat: b.mat || 'concrete',
      bullet: b.bullet !== false,
      sight: b.sight !== false,
      solid: b.solid !== false,
      id: this.boxes.length,
      _s: 0,
    };
    this.boxes.push(box);
    const c = this.cell;
    const x0 = Math.floor(box.minX / c), x1 = Math.floor(box.maxX / c);
    const z0 = Math.floor(box.minZ / c), z1 = Math.floor(box.maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = x * 73856093 ^ z * 19349663;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(box);
      }
    }
    if (box.maxX - box.minX < 400) {
      this.bounds.minX = Math.min(this.bounds.minX, box.minX);
      this.bounds.maxX = Math.max(this.bounds.maxX, box.maxX);
      this.bounds.minZ = Math.min(this.bounds.minZ, box.minZ);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, box.maxZ);
    }
    return box;
  }

  _cellList(x, z) {
    return this.grid.get(x * 73856093 ^ z * 19349663);
  }

  /** Collect boxes overlapping an XZ rectangle (deduplicated). */
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const s = ++this._stamp;
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const arr = this._cellList(x, z);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b._s === s) continue;
          b._s = s;
          if (b.maxX > minX && b.minX < maxX && b.maxZ > minZ && b.minZ < maxZ) out.push(b);
        }
      }
    }
    return out;
  }

  /** True if the AABB overlaps any solid box. */
  overlaps(minX, minY, minZ, maxX, maxY, maxZ) {
    const list = this.query(minX, minZ, maxX, maxZ, _tmpList);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid) continue;
      if (b.maxY > minY + EPS && b.minY < maxY - EPS) return b;
    }
    return null;
  }

  /**
   * Ray cast. dir must be normalized. Returns { t, box, nx, ny, nz } or null.
   * mode: 'bullet' | 'sight' | 'solid'
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, mode = 'bullet') {
    // March through grid cells with 2D DDA on XZ.
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
    for (let iter = 0; iter < 512; iter++) {
      const arr = this._cellList(cx, cz);
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b._s === s) continue;
          b._s = s;
          if (mode === 'bullet' && !b.bullet) continue;
          if (mode === 'sight' && !b.sight) continue;
          if (mode === 'solid' && !b.solid) continue;
          // slab test
          let t1 = (b.minX - ox) * invX, t2 = (b.maxX - ox) * invX;
          let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
          let axis = 0;
          let ty1 = (b.minY - oy) * invY, ty2 = (b.maxY - oy) * invY;
          let tymin = Math.min(ty1, ty2), tymax = Math.max(ty1, ty2);
          if (tymin > tmin) { tmin = tymin; axis = 1; }
          tmax = Math.min(tmax, tymax);
          let tz1 = (b.minZ - oz) * invZ, tz2 = (b.maxZ - oz) * invZ;
          let tzmin = Math.min(tz1, tz2), tzmax = Math.max(tz1, tz2);
          if (tzmin > tmin) { tmin = tzmin; axis = 2; }
          tmax = Math.min(tmax, tzmax);
          if (tmax < Math.max(tmin, 0)) continue;
          if (tmin < 0) continue; // origin inside box: ignore (prevents self-blocking)
          if (tmin < bestT) {
            bestT = tmin;
            best = { t: tmin, box: b, nx: 0, ny: 0, nz: 0 };
            if (axis === 0) best.nx = dx > 0 ? -1 : 1;
            else if (axis === 1) best.ny = dy > 0 ? -1 : 1;
            else best.nz = dz > 0 ? -1 : 1;
          }
        }
      }
      // Advance to next cell
      if (tMaxX < tMaxZ) { tCell = tMaxX; tMaxX += tDeltaX; cx += stepX; }
      else { tCell = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      if (tCell > bestT || tCell > maxDist) break;
    }
    return best;
  }

  /** Highest walkable surface under (x,z) at or below y (+step). */
  groundHeight(x, z, y, radius = 0.3) {
    const list = this.query(x - radius, z - radius, x + radius, z + radius, _tmpList);
    let h = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid) continue;
      if (b.maxY <= y + 0.05 && b.maxY > h) h = b.maxY;
    }
    return h;
  }
}

const _tmpList = [];

/**
 * Kinematic body movement with step-up, ground snapping and wall sliding.
 * body: { x,y,z (feet), vx,vy,vz, radius, height, grounded }
 */
export const STEP_HEIGHT = 0.5;

export function moveBody(world, body, dt) {
  const maxStep = 0.2;
  const dist = Math.max(Math.abs(body.vx), Math.abs(body.vz), Math.abs(body.vy)) * dt;
  const n = Math.min(8, Math.max(1, Math.ceil(dist / maxStep)));
  const sdt = dt / n;
  const wasGrounded = body.grounded;
  let hitWall = false;
  for (let i = 0; i < n; i++) {
    if (moveAxis(world, body, 0, body.vx * sdt)) { hitWall = true; }
    if (moveAxis(world, body, 2, body.vz * sdt)) { hitWall = true; }
    moveVertical(world, body, body.vy * sdt);
  }
  // Ground snap when walking down small steps / slopes made of stairs.
  if (wasGrounded && !body.grounded && body.vy <= 0) {
    const r = body.radius;
    const g = world.groundHeight(body.x, body.z, body.y, r - 0.02);
    if (g > -Infinity && body.y - g <= STEP_HEIGHT + 0.05 && body.y - g >= 0) {
      if (!world.overlaps(body.x - r, g + 0.01, body.z - r, body.x + r, g + body.height, body.z + r)) {
        body.y = g;
        body.grounded = true;
        body.vy = 0;
      }
    }
  }
  return hitWall;
}

function moveAxis(world, body, axis, d) {
  if (d === 0) return false;
  const r = body.radius;
  const nx = axis === 0 ? body.x + d : body.x;
  const nz = axis === 2 ? body.z + d : body.z;
  const minY = body.y + 0.01, maxY = body.y + body.height;
  const list = world.query(nx - r, nz - r, nx + r, nz + r, _moveList);
  let blocked = null;
  let stepTo = -Infinity;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!b.solid) continue;
    if (b.maxY <= minY || b.minY >= maxY) continue;
    // Can we step up onto it?
    const rise = b.maxY - body.y;
    if (body.grounded && rise > 0 && rise <= STEP_HEIGHT) {
      if (b.maxY > stepTo) stepTo = b.maxY;
      continue;
    }
    if (!blocked) blocked = b;
    else {
      // choose the box that clamps the most
      if (axis === 0) {
        if (d > 0 ? b.minX < blocked.minX : b.maxX > blocked.maxX) blocked = b;
      } else if (d > 0 ? b.minZ < blocked.minZ : b.maxZ > blocked.maxZ) blocked = b;
    }
  }
  if (!blocked && stepTo > -Infinity) {
    // verify the stepped-up position is clear
    if (!world.overlaps(nx - r, stepTo + 0.01, nz - r, nx + r, stepTo + body.height, nz + r)) {
      body.y = stepTo;
      if (axis === 0) body.x = nx; else body.z = nz;
      body.stepped = (body.stepped || 0) + (stepTo - body.y);
      return false;
    }
    // can't step: treat as wall
    const b = list.find((bb) => bb.solid && bb.maxY > minY && bb.minY < maxY);
    blocked = b;
  }
  if (!blocked) {
    if (axis === 0) body.x = nx; else body.z = nz;
    return false;
  }
  if (axis === 0) {
    if (d > 0) body.x = Math.min(body.x, blocked.minX - r - 0.001);
    else body.x = Math.max(body.x, blocked.maxX + r + 0.001);
    body.vx = 0;
  } else {
    if (d > 0) body.z = Math.min(body.z, blocked.minZ - r - 0.001);
    else body.z = Math.max(body.z, blocked.maxZ + r + 0.001);
    body.vz = 0;
  }
  return true;
}

function moveVertical(world, body, d) {
  const r = body.radius;
  const ny = body.y + d;
  const list = world.query(body.x - r, body.z - r, body.x + r, body.z + r, _moveList);
  if (d <= 0) {
    let top = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid) continue;
      if (b.maxY <= body.y + 0.001 && b.maxY >= ny - 0.001 && b.maxY > top) {
        // must be horizontally overlapping (query guarantees) and below current feet
        top = b.maxY;
      }
    }
    if (top > -Infinity) {
      body.y = top;
      body.vy = 0;
      body.grounded = true;
    } else {
      body.y = ny;
      body.grounded = false;
    }
  } else {
    const head = body.y + body.height;
    let ceil = Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.solid) continue;
      if (b.minY >= head - 0.001 && b.minY <= head + d + 0.001 && b.minY < ceil) ceil = b.minY;
    }
    if (ceil < Infinity) {
      body.y = ceil - body.height - 0.001;
      body.vy = 0;
    } else {
      body.y = ny;
    }
    body.grounded = false;
  }
}

const _moveList = [];
