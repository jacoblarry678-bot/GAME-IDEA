// Builds a playable map: layout, colliders, navigation, props, vegetation, lighting and weather.
import * as THREE from 'three';
import { RNG, clamp } from '../core/util.js';
import { NavGrid, FREE, BLOCK, WINDOW, PALLET_DOWN } from './nav.js';
import { Batch, boxGeo, cylGeo } from './batch.js';
import * as T from './textures.js';
import { mats, buildGeneratorMesh, buildHookMesh, buildPalletMesh, buildGateMesh, buildChestMesh, buildHatchMesh, buildTVMesh, glowSprite } from './props.js';

export const HALF = 44;
const ZONE = 16;
const INFLATE = 0.35;

function stdMat(tex, rough = 0.9, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap || null, roughness: rough, metalness: metal, ...extra });
}

function makeKit(kind) {
  if (kind === 'farm') return {
    wall: stdMat(T.planksTexture('#6a5440')), wall2: stdMat(T.planksTexture('#6a2a20', 'barn')), roof: stdMat(T.corrugatedTexture('#5a5048'), 0.7, 0.4),
    trim: stdMat(T.planksTexture('#3e3024', 'trim')), hay: stdMat(T.hayTexture()), wallH: 2.4, mainH: 5.0, perimeter: 'fence',
  };
  if (kind === 'camp') return {
    wall: stdMat(T.logsTexture('#5a4230')), wall2: stdMat(T.logsTexture('#4a3626')), roof: stdMat(T.planksTexture('#2e2620', 'shingle')),
    trim: stdMat(T.planksTexture('#3a2a20', 'trim2')), wallH: 2.4, mainH: 3.6, perimeter: 'logs',
  };
  if (kind === 'asylum') return {
    wall: stdMat(T.brickTexture('#6a3a2c')), wall2: stdMat(T.concreteTexture('#77736a')), roof: stdMat(T.concreteTexture('#5a5750')),
    trim: stdMat(T.concreteTexture('#8a867c')), wallH: 2.5, mainH: 3.8, perimeter: 'brick', ruined: true,
  };
  return {
    wall: stdMat(T.corrugatedTexture('#6a6a62'), 0.6, 0.5), wall2: stdMat(T.corrugatedTexture('#5a4a3a'), 0.6, 0.5), roof: stdMat(T.corrugatedTexture('#4a4a44'), 0.6, 0.5),
    trim: mats.darkMetal(), wallH: 2.6, mainH: 4.2, perimeter: 'metal',
  };
}

// Loop tiles in local coordinates (rotated in 90 degree steps when placed).
const TILES = {
  longwall: [['wall', -6, 0, -0.9, 0], ['pallet', 0, 0, 'x'], ['wall', 0.9, 0, 4.5, 0], ['wall', 4.5, 0, 4.5, -3.5], ['wall', -6, 0, -6, 2.8]],
  shack: [['wall', -3, -2.5, 3, -2.5, 0], ['wall', 3, -2.5, 3, 2.5], ['wall', 3, 2.5, 0.9, 2.5], ['pallet', 0, 2.5, 'x'], ['wall', -0.9, 2.5, -3, 2.5], ['wall', -3, 2.5, -3, -2.5], ['roof', 0, 0, 6.6, 5.6]],
  tee: [['wall', -6, 0, 6, 0, -3], ['wall', 2, 0, 2, 4.1], ['pallet', 2, 5, 'z'], ['wall', 2, 5.9, 2, 6.8]],
  ell: [['wall', -5, -4, -5, 3, -0.5], ['wall', -5, 3, -0.9, 3], ['pallet', 0, 3, 'x'], ['wall', 0.9, 3, 4, 3]],
  zigzag: [['wall', -6, -2, -1, -2], ['wall', -1, -2, -1, 2, 0], ['wall', -1, 2, 3.2, 2], ['pallet', 4.1, 2, 'x'], ['wall', 5, 2, 6.5, 2]],
  twinpallet: [['wall', -6, 0, -0.9, 0], ['pallet', 0, 0, 'x'], ['wall', 0.9, 0, 3.1, 0], ['pallet', 4, 0, 'x'], ['wall', 4.9, 0, 6.5, 0], ['wall', -2, 0, -2, -3.5, -1.8]],
};

export class World {
  constructor(scene, mapDef, opts) {
    this.scene = scene;
    this.def = mapDef;
    this.opts = opts;
    this.rng = new RNG(opts.seed);
    this.kit = makeKit(mapDef.kit);
    this.root = new THREE.Group();
    scene.add(this.root);
    this.batch = new Batch();
    this.nav = new NavGrid(HALF + 12, 0.5);
    this.colliders = [];
    this.circles = [];
    this.vaults = [];
    this.windows = [];
    this.pallets = [];
    this.gens = [];
    this.hooks = [];
    this.gates = [];
    this.chests = [];
    this.tvs = [];
    this.hatch = null;
    this.fires = [];
    this.lights = [];
    this.noGrass = [];
    this.cornPatches = [];
    this.treeSpots = { pine: [], dead: [], rock: [], corn: [] };
    this.hash = new Map();
    this.t = 0;
    this.build();
  }

  /* ---------------- collision primitives ---------------- */

  addCollider(minX, maxX, minZ, maxZ, h, kind = 'solid', ref = null) {
    const c = { minX, maxX, minZ, maxZ, h, kind, ref, active: true, id: this.colliders.length };
    this.colliders.push(c);
    const i0 = Math.floor(minX / 4), i1 = Math.floor(maxX / 4), j0 = Math.floor(minZ / 4), j1 = Math.floor(maxZ / 4);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 1000 + j;
      if (!this.hash.has(k)) this.hash.set(k, []);
      this.hash.get(k).push(c);
    }
    if (kind === 'solid' || kind === 'gate') {
      this.nav.raster(minX, maxX, minZ, maxZ, INFLATE, (k) => { this.nav.grid[k] = BLOCK; });
      if (h > 1.5) this.nav.raster(minX, maxX, minZ, maxZ, 0.05, (k) => { this.nav.opaque[k] = 1; });
    }
    return c;
  }

  solidBox(x, z, w, d, h) { return this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h); }

  addCircle(x, z, r, h = 3, opaque = false) {
    const c = { x, z, r, h };
    this.circles.push(c);
    const k = Math.floor(x / 4) * 1000 + Math.floor(z / 4);
    if (!this.hash.has(k)) this.hash.set(k, []);
    this.hash.get(k).push(c);
    this.nav.rasterCircle(x, z, r + INFLATE, (k2) => { this.nav.grid[k2] = BLOCK; });
    if (opaque) this.nav.rasterCircle(x, z, r * 0.8, (k2) => { this.nav.opaque[k2] = 1; });
  }

  nearby(x, z, r) {
    const out = [];
    const seen = new Set();
    const i0 = Math.floor((x - r) / 4), i1 = Math.floor((x + r) / 4), j0 = Math.floor((z - r) / 4), j1 = Math.floor((z + r) / 4);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = this.hash.get(i * 1000 + j);
      if (!list) continue;
      for (const c of list) if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  // Push a circle out of everything solid. skip(c) lets vaulting entities ignore a collider.
  resolve(p, r, skip = null) {
    for (let iter = 0; iter < 3; iter++) {
      const list = this.nearby(p.x, p.z, r + 1);
      let moved = false;
      for (const c of list) {
        if (c.r !== undefined) {
          const dx = p.x - c.x, dz = p.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + r;
          if (d < min && d > 1e-6) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); moved = true; }
          continue;
        }
        if (!c.active) continue;
        if (skip && skip(c)) continue;
        const qx = clamp(p.x, c.minX, c.maxX), qz = clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - qx, dz = p.z - qz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-6) { p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); }
          else {
            const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z;
            const m = Math.min(l, rr, t, b);
            if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    const lim = HALF + 11;
    p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
  }

  // Ray against tall colliders (for the third-person camera).
  rayBlock(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.ceil(d / 0.15);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      for (const c of this.nearby(x, z, 0.3)) {
        if (c.r !== undefined) { if (y < c.h && Math.hypot(x - c.x, z - c.z) < c.r + 0.15) return (s - 1) / steps; continue; }
        if (!c.active || c.h < y) continue;
        if (x > c.minX - 0.15 && x < c.maxX + 0.15 && z > c.minZ - 0.15 && z < c.maxZ + 0.15) return (s - 1) / steps;
      }
    }
    return 1;
  }

  /* ---------------- structure pieces ---------------- */

  wall(x1, z1, x2, z2, win = null, o = {}) {
    const k = this.kit;
    const h = o.h || k.wallH, t = o.t || 0.35;
    const mat = o.mat || k.wall;
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const a0 = alongX ? Math.min(x1, x2) : Math.min(z1, z2);
    const a1 = alongX ? Math.max(x1, x2) : Math.max(z1, z2);
    const c = alongX ? z1 : x1;
    const pieces = win == null ? [[a0, a1]] : [[a0, win - 0.8], [win + 0.8, a1]];
    const useHay = o.hay;
    for (const [p0, p1] of pieces) {
      const len = p1 - p0;
      if (len < 0.05) continue;
      const mid = (p0 + p1) / 2;
      const [cx, cz] = alongX ? [mid, c] : [c, mid];
      const [w, d] = alongX ? [len, t] : [t, len];
      if (useHay) {
        const n = Math.max(1, Math.round(len / 1.1));
        for (let i = 0; i < n; i++) for (let row = 0; row < 4; row++) {
          const m = p0 + (i + 0.5) * (len / n) + (row % 2 ? 0.08 : -0.08);
          const [bx, bz] = alongX ? [m, c] : [c, m];
          this.batch.add(boxGeo(len / n - 0.04, 0.44, 0.55, 1.2), k.hay, bx, 0.23 + row * 0.45, bz, 0, alongX ? 0 : Math.PI / 2, 0);
        }
        this.addCollider(cx - Math.max(w, 0.55) / 2, cx + Math.max(w, 0.55) / 2, cz - Math.max(d, 0.55) / 2, cz + Math.max(d, 0.55) / 2, 1.8);
        continue;
      }
      if (k.ruined && !o.noRuin) {
        const n = Math.max(1, Math.round(len / 1.0));
        for (let i = 0; i < n; i++) {
          const hh = h - this.rng.range(0, 0.6);
          const m = p0 + (i + 0.5) * (len / n);
          const [bx, bz] = alongX ? [m, c] : [c, m];
          const [bw, bd] = alongX ? [len / n + 0.01, t] : [t, len / n + 0.01];
          this.batch.box(mat, bx, hh / 2, bz, bw, hh, bd, 0, 1.6);
        }
      } else {
        this.batch.box(mat, cx, h / 2, cz, w, h, d, 0, mat === k.wall && this.def.kit === 'asylum' ? 1.6 : 2);
      }
      this.addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
    }
    if (win != null) this.windowAt(alongX ? win : c, alongX ? c : win, alongX ? 'x' : 'z', h, t, mat);
  }

  windowAt(x, z, axis, h, t, mat) {
    const k = this.kit;
    const alongX = axis === 'x';
    const W = 1.6;
    const [w, d] = alongX ? [W, t] : [t, W];
    this.batch.box(mat, x, 0.45, z, w, 0.9, d, 0, 2);
    if (h > 2.05) this.batch.box(mat, x, (2.0 + h) / 2, z, w, h - 2.0, d, 0, 2);
    // frame boards
    const fw = alongX ? [W + 0.2, 0.1, t + 0.1] : [t + 0.1, 0.1, W + 0.2];
    this.batch.box(k.trim, x, 0.92, z, fw[0], fw[1], fw[2], 0, 1);
    this.batch.box(k.trim, x, 2.0, z, fw[0], fw[1], fw[2], 0, 1);
    const id = this.vaults.length;
    const v = { id, type: 'window', x, z, axis, nx: alongX ? 0 : 1, nz: alongX ? 1 : 0, halfW: 0.8 };
    v.collider = this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.9, 'window', v);
    this.nav.raster(x - (alongX ? 0.45 : t / 2 + 0.4), x + (alongX ? 0.45 : t / 2 + 0.4), z - (alongX ? t / 2 + 0.4 : 0.45), z + (alongX ? t / 2 + 0.4 : 0.45), 0, (kk) => { this.nav.grid[kk] = WINDOW; this.nav.vaultId[kk] = id; });
    this.vaults.push(v);
    this.windows.push(v);
    return v;
  }

  pallet(x, z, axis) {
    const alongX = axis === 'x';
    const id = this.vaults.length;
    const mesh = buildPalletMesh();
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = alongX ? 0 : Math.PI / 2;
    this.root.add(mesh.group);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const standPos = new THREE.Vector3(side * 1.9, 0.63, 0.32);
    const standQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, 0, 0));
    const downPos = new THREE.Vector3(0, 0.33, 0);
    const downQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.32, 0, 0));
    mesh.board.position.copy(standPos);
    mesh.board.quaternion.copy(standQ);
    const p = { id, type: 'pallet', x, z, axis, nx: alongX ? 0 : 1, nz: alongX ? 1 : 0, halfW: 0.9, state: 'up', anim: 0, mesh, standPos, standQ, downPos, downQ };
    const [w, d] = alongX ? [1.9, 0.8] : [0.8, 1.9];
    p.collider = this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.8, 'pallet', p);
    p.collider.active = false;
    p.cells = [];
    this.nav.raster(x - (alongX ? 0.5 : 0.6), x + (alongX ? 0.5 : 0.6), z - (alongX ? 0.6 : 0.5), z + (alongX ? 0.6 : 0.5), 0, (kk) => { if (this.nav.grid[kk] === FREE) p.cells.push(kk); });
    this.vaults.push(p);
    this.pallets.push(p);
    return p;
  }

  dropPallet(p) {
    if (p.state !== 'up') return;
    p.state = 'falling';
    p.anim = 0;
    p.collider.active = true;
    for (const k of p.cells) { this.nav.grid[k] = PALLET_DOWN; this.nav.vaultId[k] = p.id; }
  }

  breakPallet(p) {
    p.state = 'broken';
    p.collider.active = false;
    for (const k of p.cells) { this.nav.grid[k] = FREE; this.nav.vaultId[k] = -1; }
    p.mesh.group.visible = false;
    this.debris(p.x, p.z);
  }

  debris(x, z) {
    const wood = mats.palletWood();
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(boxGeo(this.rng.range(0.3, 0.9), 0.03, 0.12, 1), wood);
      b.position.set(x + this.rng.range(-0.8, 0.8), 0.03, z + this.rng.range(-0.8, 0.8));
      b.rotation.set(0, this.rng.range(0, 3), this.rng.range(-0.2, 0.2));
      b.receiveShadow = true;
      g.add(b);
    }
    this.root.add(g);
  }

  roof(x, z, w, d, y) {
    const k = this.kit;
    if (this.def.kit === 'asylum') {
      // collapsed: only part of the slab remains
      this.batch.box(k.roof, x - w * 0.2, y, z, w * 0.6, 0.18, d, 0, 2);
      return;
    }
    if (this.def.kit === 'junk') { this.batch.box(k.roof, x, y + 0.05, z, w + 0.4, 0.08, d + 0.4, 0, 2); return; }
    const pitch = 0.42;
    const halfD = (d + 0.6) / 2;
    const slope = halfD / Math.cos(pitch);
    for (const s of [-1, 1]) {
      this.batch.add(boxGeo(w + 0.6, 0.08, slope, 2), k.roof, x, y + Math.tan(pitch) * halfD / 2, z + s * halfD / 2, s * pitch, 0, 0);
    }
    // gable ends
    const tri = new THREE.BufferGeometry();
    const hh = Math.tan(pitch) * halfD;
    const v = new Float32Array([-halfD, 0, 0, halfD, 0, 0, 0, hh, 0]);
    tri.setAttribute('position', new THREE.BufferAttribute(v, 3));
    tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, halfD, 0, halfD / 2, hh / 2]), 2));
    tri.setIndex([0, 1, 2, 2, 1, 0]);
    tri.computeVertexNormals();
    for (const s of [-1, 1]) this.batch.add(tri, k.wall2 || k.wall, x + s * w / 2, y, z, 0, Math.PI / 2, 0);
  }

  // Place a list of tile parts with rotation r (0..3) around (cx, cz).
  placeParts(parts, cx, cz, r, o = {}) {
    const tr = (lx, lz) => {
      if (r === 0) return [cx + lx, cz + lz];
      if (r === 1) return [cx - lz, cz + lx];
      if (r === 2) return [cx - lx, cz - lz];
      return [cx + lz, cz - lx];
    };
    const swapAxis = (a) => (r % 2 ? (a === 'x' ? 'z' : 'x') : a);
    const hay = o.hay;
    for (const part of parts) {
      const [type] = part;
      if (type === 'wall') {
        const [, x1, z1, x2, z2, win] = part;
        const [ax, az] = tr(x1, z1), [bx, bz] = tr(x2, z2);
        let w = null;
        if (win != null) {
          const alongXLocal = Math.abs(z2 - z1) < 1e-6;
          const [wx, wz] = alongXLocal ? tr(win, z1) : tr(x1, win);
          const alongXWorld = Math.abs(bz - az) < 1e-6;
          w = alongXWorld ? wx : wz;
        }
        this.wall(ax, az, bx, bz, w, { hay: hay && win == null && this.rng.chance(0.6), mat: o.mat });
      } else if (type === 'pallet') {
        const [, x, z, axis] = part;
        const [px, pz] = tr(x, z);
        this.pallet(px, pz, swapAxis(axis));
      } else if (type === 'roof') {
        const [, x, z, w, d] = part;
        const [px, pz] = tr(x, z);
        const [rw, rd] = r % 2 ? [d, w] : [w, d];
        this.roof(px, pz, rw, rd, this.kit.wallH);
        this.noGrass.push([px - rw / 2, px + rw / 2, pz - rd / 2, pz + rd / 2]);
      }
    }
  }

  /* ---------------- main building ---------------- */

  mainBuilding(cx, cz, r) {
    const k = this.kit;
    const H = k.mainH;
    const mat = this.def.kit === 'farm' ? k.wall2 : this.def.kit === 'asylum' ? k.wall2 : k.wall;
    const parts = [
      ['wall', -8, -5.5, 2, -5.5, -4], ['wall', 4.2, -5.5, 8, -5.5],
      ['wall', -8, 5.5, -4.2, 5.5], ['wall', -2, 5.5, 8, 5.5, 4],
      ['wall', -8, -5.5, -8, 5.5, 0],
      ['wall', 8, -5.5, 8, -1], ['wall', 8, 2.2, 8, 5.5],
      ['wall', 0, -5.5, 0, 1.2], ['pallet', 0, 2.1, 'z'], ['wall', 0, 3.0, 0, 5.5],
    ];
    const tr = (lx, lz) => {
      if (r === 0) return [cx + lx, cz + lz];
      if (r === 1) return [cx - lz, cz + lx];
      if (r === 2) return [cx - lx, cz - lz];
      return [cx + lz, cz - lx];
    };
    const swapAxis = (a) => (r % 2 ? (a === 'x' ? 'z' : 'x') : a);
    for (const part of parts) {
      if (part[0] === 'wall') {
        const [, x1, z1, x2, z2, win] = part;
        const [ax, az] = tr(x1, z1), [bx, bz] = tr(x2, z2);
        let w = null;
        if (win != null) {
          const alongXLocal = Math.abs(z2 - z1) < 1e-6;
          const [wx, wz] = alongXLocal ? tr(win, z1) : tr(x1, win);
          w = Math.abs(bz - az) < 1e-6 ? wx : wz;
        }
        const interior = x1 === 0 && x2 === 0;
        this.wall(ax, az, bx, bz, w, { h: interior ? Math.min(H, 2.8) : H, mat, noRuin: !interior });
      } else {
        const [, x, z, axis] = part;
        const [px, pz] = tr(x, z);
        this.pallet(px, pz, swapAxis(axis));
      }
    }
    const [w, d] = r % 2 ? [11, 16] : [16, 11];
    this.roof(cx, cz, w + 0.3, d + 0.3, H);
    // floor
    const floorMat = this.def.kit === 'asylum' ? mats.concrete() : this.def.kit === 'junk' ? mats.concrete() : k.trim;
    this.batch.box(floorMat, cx, 0.02, cz, w, 0.04, d, 0, 2);
    this.noGrass.push([cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2]);
    // interior lamp
    const lampPos = tr(4, -1.5);
    this.addLamp(lampPos[0], Math.min(H - 0.4, 3.2), lampPos[1], 0xffc070, 2.2);
    // interior clutter
    const [ix, iz] = tr(5, 3.6);
    if (this.def.kit === 'farm') { this.hayBale(ix, iz, 0); this.hayBale(ix + 0.1, iz, 0, 0.9); }
    else this.crate(ix, iz, 0.9);
    const genSpot = tr(-4.5, -2.6);
    const chestSpot = tr(4.5, 4.4);
    return { genSpot, chestSpot };
  }

  addLamp(x, y, z, color, intensity) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mats.bulbOn());
    bulb.position.set(x, y, z);
    this.root.add(bulb);
    const glow = glowSprite(color, 2.4, 0.7);
    glow.position.set(x, y, z);
    this.root.add(glow);
    this.batch.add(cylGeo(0.01, 0.01, 1.2, 4, 1), mats.wire(), x, y + 0.6, z);
    if (this.lights.length < 3) {
      const l = new THREE.PointLight(color, intensity, 14, 1.6);
      l.position.set(x, y - 0.1, z);
      this.root.add(l);
      this.fires.push({ light: l, base: intensity, glow, flicker: 0.15 });
      this.lights.push(l);
    }
  }

  addFire(x, z, kind = 'barrel') {
    const y = kind === 'barrel' ? 1.0 : 0.25;
    if (kind === 'barrel') {
      this.batch.add(cylGeo(0.3, 0.3, 0.95, 14, 1, true), mats.rust(), x, 0.475, z);
      this.solidBox(x, z, 0.62, 0.62, 1.0);
    } else {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.batch.add(new THREE.DodecahedronGeometry(0.22, 0), mats.concrete(), x + Math.cos(a) * 0.8, 0.12, z + Math.sin(a) * 0.8, i, i, 0);
      }
      for (let i = 0; i < 4; i++) this.batch.add(cylGeo(0.07, 0.07, 1.0, 6, 1), mats.oldWood(), x, 0.15, z, Math.PI / 2 - 0.3, i * 0.8, 0);
      this.solidBox(x, z, 1.6, 1.6, 0.4);
    }
    const flameMat = new THREE.SpriteMaterial({ map: T.glowSpriteTexture(), color: 0xff8a30, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(flameMat.clone());
      s.position.set(x, y + 0.2 + i * 0.15, z);
      s.scale.set(0.7 - i * 0.15, 0.9 - i * 0.2, 1);
      this.root.add(s);
      flames.push(s);
    }
    const glow = glowSprite(0xff7a20, 5, 0.5);
    glow.position.set(x, y + 0.4, z);
    this.root.add(glow);
    let light = null;
    if (this.lights.length < 3) {
      light = new THREE.PointLight(0xff8a3a, 3.2, 16, 1.5);
      light.position.set(x, y + 0.7, z);
      this.root.add(light);
      this.lights.push(light);
    }
    this.fires.push({ light, base: 3.2, glow, flames, flicker: 0.45, fire: true, x, z });
  }

  /* ---------------- props ---------------- */

  hayBale(x, z, ry = 0, y0 = 0) {
    const k = this.kit;
    const hay = k.hay || stdMat(T.hayTexture());
    this.batch.add(cylGeo(0.6, 0.6, 1.2, 16, 1.2), hay, x, 0.6 + y0 * 1.2, z, 0, ry, Math.PI / 2);
    if (!y0) this.solidBox(x, z, 1.3, 1.3, 1.2);
  }

  crate(x, z, s = 1) {
    this.batch.box(mats.oldWood(), x, s / 2, z, s, s, s, this.rng.range(-0.3, 0.3), 1);
    this.solidBox(x, z, s, s, s);
  }

  rock(x, z, s) {
    this.treeSpots.rock.push([x, z, s]);
    this.solidBox(x, z, s * 1.4, s * 1.4, s * 1.1);
  }

  pine(x, z, s = 1) { this.treeSpots.pine.push([x, z, s]); this.addCircle(x, z, 0.28 * s, 8, true); }
  deadTree(x, z, s = 1) { this.treeSpots.dead.push([x, z, s]); this.addCircle(x, z, 0.24 * s, 6, true); }

  car(x, z, ry, color, stackY = 0, collide = true) {
    const body = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6, map: T.metalTexture(color, 'car').map, normalMap: T.metalTexture(color, 'car').normalMap });
    const y = stackY;
    this.batch.add(boxGeo(4.2, 0.7, 1.8, 2), body, x, y + 0.6, z, 0, ry, 0);
    this.batch.add(boxGeo(2.2, 0.55, 1.6, 2), body, x - Math.sin(ry) * 0 + Math.cos(ry) * -0.2, y + 1.22, z + Math.sin(ry) * 0.2, 0, ry, 0);
    const glass = mats.black();
    this.batch.add(boxGeo(2.0, 0.45, 1.62, 2), glass, x + Math.cos(ry) * -0.2, y + 1.22, z - Math.sin(ry) * -0.2, 0, ry, 0);
    for (const [ox, oz] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) {
      const wx = x + Math.cos(ry) * ox + Math.sin(ry) * oz, wz = z - Math.sin(ry) * ox + Math.cos(ry) * oz;
      this.batch.add(cylGeo(0.34, 0.34, 0.24, 12, 1), mats.rubber(), wx, y + 0.34, wz, Math.PI / 2, ry, 0);
    }
    if (collide && !stackY) {
      const c = Math.abs(Math.cos(ry)) > 0.7;
      this.solidBox(x, z, c ? 4.2 : 1.8, c ? 1.8 : 4.2, 1.6);
    }
  }

  carStack(x, z, ry, n) {
    const cols = ['#5a2a22', '#2a3a4a', '#4a4a3a', '#6a5a3a', '#3a3a3a', '#2a4a3a'];
    for (let i = 0; i < n; i++) this.car(x + this.rng.range(-0.15, 0.15), z + this.rng.range(-0.15, 0.15), ry + this.rng.range(-0.08, 0.08), this.rng.pick(cols), i * 1.45, false);
    const c = Math.abs(Math.cos(ry)) > 0.7;
    this.solidBox(x, z, c ? 4.3 : 1.9, c ? 1.9 : 4.3, n * 1.45);
  }

  container(x, z, ry, color) {
    const t = T.corrugatedTexture(color);
    const mat = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.6, metalness: 0.5 });
    const c = Math.abs(Math.cos(ry)) > 0.7;
    this.batch.box(mat, x, 1.3, z, c ? 6 : 2.4, 2.6, c ? 2.4 : 6, 0, 2);
    this.solidBox(x, z, c ? 6 : 2.4, c ? 2.4 : 6, 2.6);
  }

  tires(x, z) {
    for (let i = 0; i < 4; i++) this.batch.add(new THREE.TorusGeometry(0.35, 0.14, 8, 16), mats.rubber(), x, 0.14 + i * 0.27, z, Math.PI / 2, 0, 0);
    this.addCircle(x, z, 0.5, 1.1);
  }

  // obstacle used on either side of a free-standing pallet
  obstacle(x, z, axis, len) {
    const kit = this.def.kit;
    const alongX = axis === 'x';
    if (kit === 'farm') {
      const n = Math.max(1, Math.round(len / 1.3));
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 1.3;
        const [bx, bz] = alongX ? [x + o, z] : [x, z + o];
        this.batch.add(cylGeo(0.6, 0.6, 1.2, 16, 1.2), this.kit.hay, bx, 0.6, bz, 0, alongX ? Math.PI / 2 : 0, Math.PI / 2);
        this.batch.add(cylGeo(0.6, 0.6, 1.2, 16, 1.2), this.kit.hay, bx, 1.8, bz, 0, alongX ? Math.PI / 2 : 0, Math.PI / 2);
      }
      this.solidBox(x, z, alongX ? len : 1.3, alongX ? 1.3 : len, 2.4);
    } else if (kit === 'camp') {
      const s = len / 2;
      this.treeSpots.rock.push([x, z, s * 1.1]);
      this.solidBox(x, z, alongX ? len : 1.6, alongX ? 1.6 : len, 2.2);
    } else if (kit === 'asylum') {
      this.batch.box(mats.concrete(), x, 1.1, z, alongX ? len : 1.0, 2.2, alongX ? 1.0 : len, 0, 2);
      this.solidBox(x, z, alongX ? len : 1.0, alongX ? 1.0 : len, 2.2);
    } else {
      this.carStack(x, z, alongX ? 0 : Math.PI / 2, 2);
    }
  }

  palletPair(cx, cz, axis) {
    const alongX = axis === 'x';
    const len = 3.4;
    const off = 0.9 + len / 2;
    if (alongX) { this.obstacle(cx - off, cz, 'x', len); this.obstacle(cx + off, cz, 'x', len); }
    else { this.obstacle(cx, cz - off, 'z', len); this.obstacle(cx, cz + off, 'z', len); }
    this.pallet(cx, cz, axis);
  }

  /* ---------------- zones ---------------- */

  filler(cx, cz) {
    const kit = this.def.kit;
    const R = this.rng;
    const roll = R.next();
    if (kit === 'farm') {
      if (roll < 0.4) {
        this.cornPatches.push([cx - 6, cx + 6, cz - 6, cz + 6]);
        this.nav.raster(cx - 6, cx + 6, cz - 6, cz + 6, 0, (k) => { this.nav.corn[k] = 1; });
        if (R.chance(0.6)) this.palletPair(cx + R.range(-2, 2), cz + R.range(-2, 2), R.pick(['x', 'z']));
      } else if (roll < 0.7) {
        this.palletPair(cx, cz, R.pick(['x', 'z']));
        for (let i = 0; i < 3; i++) this.hayBale(cx + R.range(-6, 6), cz + R.range(-6, 6), R.range(0, 3));
      } else {
        // silo and tractor
        const sx = cx + R.range(-3, 3), sz = cz + R.range(-3, 3);
        const silo = stdMat(T.corrugatedTexture('#7a7870'), 0.6, 0.5);
        this.batch.add(cylGeo(2.2, 2.2, 11, 20, 2), silo, sx, 5.5, sz);
        this.batch.add(new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), silo, sx, 11, sz);
        this.addCircle(sx, sz, 2.2, 12, true);
        this.tractor(sx + 5, sz + R.range(-2, 2));
      }
    } else if (kit === 'camp') {
      if (roll < 0.45) {
        for (let i = 0; i < 9; i++) this.pine(cx + R.range(-6.5, 6.5), cz + R.range(-6.5, 6.5), R.range(0.8, 1.3));
        this.rock(cx + R.range(-3, 3), cz + R.range(-3, 3), R.range(0.8, 1.6));
      } else if (roll < 0.75) {
        this.palletPair(cx, cz, R.pick(['x', 'z']));
        for (let i = 0; i < 4; i++) this.pine(cx + R.range(-6.5, 6.5), cz + R.range(-6.5, 6.5), R.range(0.9, 1.3));
      } else {
        // RV trailer
        const rot = R.chance(0.5) ? 0 : Math.PI / 2;
        const c = rot === 0;
        const rvMat = stdMat(T.metalTexture('#c8c0a8', 'rv'), 0.5, 0.3);
        this.batch.box(rvMat, cx, 1.55, cz, c ? 7 : 2.5, 2.4, c ? 2.5 : 7, 0, 2);
        this.batch.box(mats.black(), cx, 1.9, cz, c ? 5 : 2.55, 0.5, c ? 2.55 : 5, 0, 2);
        for (const o of [-1.8, 1.8]) this.batch.add(cylGeo(0.4, 0.4, 2.6, 12, 1), mats.rubber(), cx + (c ? o : 0), 0.4, cz + (c ? 0 : o), c ? Math.PI / 2 : 0, 0, c ? 0 : Math.PI / 2);
        this.solidBox(cx, cz, c ? 7 : 2.5, c ? 2.5 : 7, 2.8);
        this.pallet(cx + (c ? 0 : 2.15), cz + (c ? 2.15 : 0), c ? 'z' : 'x');
      }
    } else if (kit === 'asylum') {
      if (roll < 0.4) {
        for (let i = 0; i < 5; i++) this.deadTree(cx + R.range(-6, 6), cz + R.range(-6, 6), R.range(0.8, 1.3));
        for (let i = 0; i < 4; i++) this.rubble(cx + R.range(-6, 6), cz + R.range(-6, 6));
      } else if (roll < 0.75) {
        this.palletPair(cx, cz, R.pick(['x', 'z']));
        this.deadTree(cx + R.range(-6, 6), cz + R.range(-6, 6));
      } else {
        // ambulance wreck
        this.car(cx, cz, R.pick([0, Math.PI / 2]), '#d8d4c8');
        this.gurney(cx + 3.5, cz + R.range(-2, 2));
        this.rubble(cx - 4, cz + 3);
      }
    } else {
      if (roll < 0.4) {
        this.carStack(cx - 3, cz - 2, 0, 3);
        this.carStack(cx + 3, cz + 3, Math.PI / 2, 2);
        this.tires(cx + 4, cz - 4);
      } else if (roll < 0.75) {
        this.palletPair(cx, cz, R.pick(['x', 'z']));
        this.tires(cx + R.range(-6, 6), cz + R.range(-6, 6));
      } else {
        const rot = R.pick([0, Math.PI / 2]);
        this.container(cx, cz - (rot ? 0 : 2), rot, R.pick(['#6a2a1a', '#2a4a6a', '#3a5a3a']));
        this.container(cx + (rot ? 3 : 0), cz + (rot ? 0 : 2), rot, R.pick(['#7a5a1a', '#4a4a4a']));
        this.addFire(cx + R.range(-5, 5), cz + 5.5);
      }
    }
  }

  open(cx, cz) {
    const kit = this.def.kit;
    const R = this.rng;
    const n = R.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = cx + R.range(-6, 6), z = cz + R.range(-6, 6);
      if (kit === 'farm') R.chance(0.5) ? this.hayBale(x, z, R.range(0, 3)) : this.deadTree(x, z, R.range(0.9, 1.4));
      else if (kit === 'camp') R.chance(0.6) ? this.pine(x, z, R.range(0.9, 1.4)) : this.picnicTable(x, z);
      else if (kit === 'asylum') R.chance(0.5) ? this.rubble(x, z) : this.bench(x, z);
      else R.chance(0.5) ? this.tires(x, z) : this.crate(x, z, R.range(0.8, 1.2));
    }
  }

  tractor(x, z) {
    const red = stdMat(T.metalTexture('#7a2218', 'tractor'), 0.6, 0.4);
    this.batch.box(red, x, 1.0, z, 1.2, 0.9, 2.8, 0, 1);
    this.batch.box(red, x, 1.7, z - 0.7, 1.1, 0.9, 1.0, 0, 1);
    this.batch.add(cylGeo(0.8, 0.8, 0.4, 16, 1), mats.rubber(), x - 0.8, 0.8, z - 0.8, 0, 0, Math.PI / 2);
    this.batch.add(cylGeo(0.8, 0.8, 0.4, 16, 1), mats.rubber(), x + 0.8, 0.8, z - 0.8, 0, 0, Math.PI / 2);
    this.batch.add(cylGeo(0.45, 0.45, 0.3, 14, 1), mats.rubber(), x - 0.7, 0.45, z + 1.0, 0, 0, Math.PI / 2);
    this.batch.add(cylGeo(0.45, 0.45, 0.3, 14, 1), mats.rubber(), x + 0.7, 0.45, z + 1.0, 0, 0, Math.PI / 2);
    this.solidBox(x, z, 2.2, 3.2, 2.2);
  }

  rubble(x, z) {
    for (let i = 0; i < 5; i++) this.batch.add(new THREE.DodecahedronGeometry(this.rng.range(0.2, 0.5), 0), mats.concrete(), x + this.rng.range(-0.8, 0.8), 0.15, z + this.rng.range(-0.8, 0.8), i, i * 3, 0);
    this.batch.box(this.kit.wall, x, 0.6, z, 1.4, 1.2, 0.35, this.rng.range(0, 3), 1.6);
    this.solidBox(x, z, 1.6, 1.6, 1.2);
  }

  bench(x, z) {
    this.batch.box(mats.oldWood(), x, 0.45, z, 1.8, 0.08, 0.5, 0, 1);
    this.batch.box(mats.darkMetal(), x - 0.8, 0.22, z, 0.06, 0.45, 0.5, 0, 1);
    this.batch.box(mats.darkMetal(), x + 0.8, 0.22, z, 0.06, 0.45, 0.5, 0, 1);
    this.solidBox(x, z, 1.8, 0.6, 0.5);
  }

  gurney(x, z) {
    this.batch.box(mats.darkMetal(), x, 0.8, z, 0.7, 0.06, 1.9, 0, 1);
    this.batch.box(new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 1 }), x, 0.88, z, 0.65, 0.1, 1.8, 0, 1);
    for (const [dx, dz] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) this.batch.add(cylGeo(0.02, 0.02, 0.8, 4, 1), mats.darkMetal(), x + dx, 0.4, z + dz);
    this.solidBox(x, z, 0.8, 2.0, 1.0);
  }

  picnicTable(x, z) {
    this.batch.box(mats.oldWood(), x, 0.75, z, 1.9, 0.06, 0.8, 0, 1);
    for (const s of [-0.65, 0.65]) this.batch.box(mats.oldWood(), x, 0.45, z + s, 1.9, 0.05, 0.3, 0, 1);
    for (const s of [-0.7, 0.7]) this.batch.box(mats.oldWood(), x + s, 0.38, z, 0.08, 0.75, 1.5, 0, 1);
    this.solidBox(x, z, 2.0, 1.8, 0.8);
  }

  /* ---------------- perimeter + gates ---------------- */

  perimeter(gateDefs) {
    const kind = this.kit.perimeter;
    const sides = [
      { side: 'N', fixed: -HALF, along: 'x' }, { side: 'S', fixed: HALF, along: 'x' },
      { side: 'W', fixed: -HALF, along: 'z' }, { side: 'E', fixed: HALF, along: 'z' },
    ];
    const pMat = kind === 'brick' ? this.kit.wall : kind === 'metal' ? this.kit.wall : kind === 'logs' ? this.kit.wall : this.kit.trim;
    for (const s of sides) {
      const gate = gateDefs.find((g) => g.side === s.side);
      const segs = gate ? [[-HALF - 0.5, gate.lat - 4.2], [gate.lat + 4.2, HALF + 0.5]] : [[-HALF - 0.5, HALF + 0.5]];
      for (const [a, b] of segs) {
        const len = b - a, mid = (a + b) / 2;
        const [x, z] = s.along === 'x' ? [mid, s.fixed] : [s.fixed, mid];
        const [w, d] = s.along === 'x' ? [len, 0.5] : [0.5, len];
        const h = kind === 'fence' ? 1.5 : kind === 'logs' ? 2.2 : kind === 'brick' ? 3.4 : 3.6;
        if (kind === 'fence') {
          // split-rail fence with posts
          const n = Math.ceil(len / 2.5);
          for (let i = 0; i <= n; i++) {
            const o = a + (i / n) * len;
            const [px, pz] = s.along === 'x' ? [o, s.fixed] : [s.fixed, o];
            this.batch.box(this.kit.trim, px, 0.75, pz, 0.15, 1.5, 0.15, 0, 1);
          }
          for (const y of [0.5, 1.0, 1.4]) this.batch.box(this.kit.trim, x, y, z, s.along === 'x' ? len : 0.08, 0.1, s.along === 'x' ? 0.08 : len, 0, 2);
        } else if (kind === 'brick') {
          this.batch.box(pMat, x, h / 2, z, w, h, d, 0, 1.6);
          const n = Math.ceil(len / 6);
          for (let i = 0; i <= n; i++) {
            const o = a + (i / n) * len;
            const [px, pz] = s.along === 'x' ? [o, s.fixed] : [s.fixed, o];
            this.batch.box(mats.concrete(), px, h / 2 + 0.2, pz, 0.8, h + 0.4, 0.8, 0, 1.5);
          }
        } else {
          this.batch.box(pMat, x, h / 2, z, w, h, d, 0, 2);
        }
        this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, Math.max(h, 3));
      }
    }
    for (const g of gateDefs) this.gate(g);
  }

  gate(g) {
    const width = 6;
    const mesh = buildGateMesh(width, this.def.kit === 'asylum' ? this.kit.wall : mats.concrete());
    let x, z, nx, nz, ry;
    if (g.side === 'N') { x = g.lat; z = -HALF; nx = 0; nz = 1; ry = 0; }
    else if (g.side === 'S') { x = g.lat; z = HALF; nx = 0; nz = -1; ry = Math.PI; }
    else if (g.side === 'W') { x = -HALF; z = g.lat; nx = 1; nz = 0; ry = Math.PI / 2; }
    else { x = HALF; z = g.lat; nx = -1; nz = 0; ry = -Math.PI / 2; }
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = ry;
    this.root.add(mesh.group);
    mesh.group.updateMatrixWorld(true);
    const sw = new THREE.Vector3(width / 2 + 0.55, 0, 1.25).applyMatrix4(mesh.group.matrixWorld);
    const alongX = g.side === 'N' || g.side === 'S';
    const gate = { id: this.gates.length, side: g.side, x, z, nx, nz, alongX, width, mesh, switchX: sw.x, switchZ: sw.z, progress: 0, powered: false, open: false, openAnim: 0 };
    // pillars
    for (const s of [-1, 1]) {
      const px = alongX ? x + s * (width / 2 + 0.55) : x, pz = alongX ? z : z + s * (width / 2 + 0.55);
      this.solidBox(px, pz, 1.1, 1.1, 5);
    }
    // switch box
    const swp = new THREE.Vector3(width / 2 + 0.55, 0, 0.75).applyMatrix4(mesh.group.matrixWorld);
    this.solidBox(swp.x, swp.z, alongX ? 0.7 : 0.3, alongX ? 0.3 : 0.7, 1.7);
    gate.door = this.addCollider(alongX ? x - width / 2 : x - 0.3, alongX ? x + width / 2 : x + 0.3, alongX ? z - 0.3 : z - width / 2, alongX ? z + 0.3 : z + width / 2, 4.5, 'gate', gate);
    // exit corridor walls outside the gate
    for (const s of [-1, 1]) {
      const cx = alongX ? x + s * (width / 2 + 0.8) : x - nx * 6, cz = alongX ? z - nz * 6 : z + s * (width / 2 + 0.8);
      const w = alongX ? 0.5 : 11, d = alongX ? 11 : 0.5;
      this.batch.box(this.def.kit === 'asylum' ? this.kit.wall : mats.concrete(), cx, 2, cz, w, 4, d, 0, 2);
      this.addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 4);
    }
    // the far end of the corridor fades into a glow
    const glow = glowSprite(0xd8e0ff, 9, 0.0);
    glow.position.set(x - nx * 10, 2, z - nz * 10);
    this.root.add(glow);
    gate.exitGlow = glow;
    // killers may not leave through the gate corridor past this line
    const kx = x - nx * 5, kz = z - nz * 5;
    gate.killerWall = this.addCollider(alongX ? kx - width / 2 : kx - 0.2, alongX ? kx + width / 2 : kx + 0.2, alongX ? kz - 0.2 : kz - width / 2, alongX ? kz + 0.2 : kz + width / 2, 4, 'killerOnly', gate);
    this.gates.push(gate);
  }

  /* ---------------- interactables ---------------- */

  placeGen(x, z) {
    const mesh = buildGeneratorMesh();
    const ry = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = ry;
    this.root.add(mesh.group);
    const c = Math.abs(Math.cos(ry)) > 0.7;
    this.solidBox(x, z, c ? 1.3 : 0.9, c ? 0.9 : 1.3, 1.2);
    const gen = { id: this.gens.length, x, z, progress: 0, done: false, regressing: false, mesh, blocked: false, kickCooldown: 0, flywheel: 0 };
    this.gens.push(gen);
    return gen;
  }

  placeHook(x, z) {
    const mesh = buildHookMesh();
    const ry = this.rng.range(0, Math.PI * 2);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = ry;
    this.root.add(mesh.group);
    this.addCircle(x, z, 0.18, 3);
    const hang = new THREE.Vector3(0, 0, 0.86).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    const hook = { id: this.hooks.length, x, z, ry, hangX: x + hang.x, hangZ: z + hang.z, occupant: null, mesh, broken: false };
    this.hooks.push(hook);
    return hook;
  }

  placeChest(x, z) {
    const mesh = buildChestMesh();
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = this.rng.range(0, Math.PI * 2);
    this.root.add(mesh.group);
    this.solidBox(x, z, 0.9, 0.9, 0.6);
    const ch = { id: this.chests.length, x, z, opened: false, progress: 0, mesh, lidAnim: 0 };
    this.chests.push(ch);
    return ch;
  }

  placeTV(x, z, staticCanvas) {
    const mesh = buildTVMesh(staticCanvas);
    const ry = this.rng.range(0, Math.PI * 2);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = ry;
    this.root.add(mesh.group);
    this.solidBox(x, z, 0.75, 0.75, 1.1);
    const tv = { id: this.tvs.length, x, z, ry, mesh, disabledUntil: 0, unplug: 0 };
    this.tvs.push(tv);
    return tv;
  }

  findSpot(cands, existing, minDist, clear = 1.4) {
    let best = null, bestScore = -Infinity;
    for (const [x, z] of cands) {
      if (!this.nav.areaFree(x, z, clear)) continue;
      if (this.nav.corn[this.nav.idx(x, z)]) continue;
      let dmin = 999;
      for (const e of existing) dmin = Math.min(dmin, Math.hypot(e[0] - x, e[1] - z));
      if (dmin < minDist) continue;
      const score = Math.min(dmin, 40) + this.rng.range(0, 6);
      if (score > bestScore) { bestScore = score; best = [x, z]; }
    }
    return best;
  }

  candidates(n = 600, margin = 4) {
    const out = [];
    for (let i = 0; i < n; i++) out.push([this.rng.range(-HALF + margin, HALF - margin), this.rng.range(-HALF + margin, HALF - margin)]);
    return out;
  }

  /* ---------------- main build ---------------- */

  build() {
    const R = this.rng;
    const def = this.def;
    const o = this.opts;

    // gates on opposite sides
    const ns = R.chance(0.5);
    const gateDefs = ns
      ? [{ side: 'N', lat: R.range(-26, 26) }, { side: 'S', lat: R.range(-26, 26) }]
      : [{ side: 'W', lat: R.range(-26, 26) }, { side: 'E', lat: R.range(-26, 26) }];
    this.perimeter(gateDefs);

    // zones
    const zones = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) zones.push({ i, j, x: -32 + i * ZONE, z: -32 + j * ZONE });
    const central = zones.filter((z) => z.i >= 1 && z.i <= 3 && z.j >= 1 && z.j <= 3);
    const mainZone = R.pick(central);
    const rest = R.shuffle(zones.filter((z) => z !== mainZone));
    const main = this.mainBuilding(mainZone.x + R.range(-1, 1), mainZone.z + R.range(-1, 1), R.int(0, 3));
    const tileKeys = Object.keys(TILES);
    rest.forEach((zn, n) => {
      const x = zn.x + R.range(-1.5, 1.5), z = zn.z + R.range(-1.5, 1.5);
      if (n < 10) this.placeParts(TILES[tileKeys[n % tileKeys.length]], x, z, R.int(0, 3), { hay: def.kit === 'farm' });
      else if (n < 17) this.filler(x, z);
      else this.open(x, z);
    });

    // generators
    const genSpots = [main.genSpot];
    this.placeGen(main.genSpot[0], main.genSpot[1]);
    const cands = this.candidates(900, 5);
    for (let i = 0; i < 6; i++) {
      const s = this.findSpot(cands, genSpots, 14) || this.findSpot(cands, genSpots, 8);
      if (!s) break;
      genSpots.push(s);
      this.placeGen(s[0], s[1]);
    }
    // hooks
    const hookSpots = [];
    for (let i = 0; i < 11; i++) {
      const s = this.findSpot(cands, [...hookSpots, ...genSpots.map((g) => [g[0], g[1]])], 9, 1.2) || this.findSpot(cands, hookSpots, 6, 1.2);
      if (!s) break;
      hookSpots.push(s);
      this.placeHook(s[0], s[1]);
    }
    // chests
    const chestSpots = [];
    if (this.nav.areaFree(main.chestSpot[0], main.chestSpot[1], 0.7)) { chestSpots.push(main.chestSpot); this.placeChest(main.chestSpot[0], main.chestSpot[1]); }
    const nChests = 3 + (o.extraChests || 0);
    while (chestSpots.length < nChests) {
      const s = this.findSpot(cands, [...chestSpots, ...genSpots], 10, 1.0);
      if (!s) break;
      chestSpots.push(s);
      this.placeChest(s[0], s[1]);
    }
    // CRT screens for The EXE
    if (o.tvCount) {
      this.tvStatic = T.makeStaticCanvas(64, 48);
      const tvSpots = [];
      for (let i = 0; i < o.tvCount; i++) {
        const s = this.findSpot(cands, [...tvSpots, ...genSpots], 12, 1.1) || this.findSpot(cands, tvSpots, 6, 1.1);
        if (!s) break;
        tvSpots.push(s);
        this.placeTV(s[0], s[1], this.tvStatic);
      }
    }

    // spawns
    const spawnC = this.candidates(300, 8).filter(([x, z]) => this.nav.areaFree(x, z, 2.5));
    const sSpawn = spawnC[0] || [0, 0];
    let kSpawn = spawnC[1] || [20, 20], bd = 0;
    for (const c of spawnC) { const d = Math.hypot(c[0] - sSpawn[0], c[1] - sSpawn[1]); if (d > bd) { bd = d; kSpawn = c; } }
    this.spawns = { survivors: [], killer: kSpawn };
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const p = this.nav.nearestWalkable(sSpawn[0] + Math.cos(a) * 1.6, sSpawn[1] + Math.sin(a) * 1.6, 4) || sSpawn;
      this.spawns.survivors.push(p);
    }
    // hatch
    const hatchC = this.candidates(300, 6).filter(([x, z]) => this.nav.areaFree(x, z, 1.0));
    let hs = hatchC[0] || [0, 10];
    if (o.hatchNear) { let b = 1e9; for (const c of hatchC) { const d = Math.hypot(c[0] - sSpawn[0], c[1] - sSpawn[1]); if (d > 8 && d < b) { b = d; hs = c; } } }
    const hm = buildHatchMesh();
    hm.group.position.set(hs[0], 0, hs[1]);
    hm.group.visible = false;
    this.root.add(hm.group);
    this.hatch = { x: hs[0], z: hs[1], mesh: hm, open: false, closed: false, lidAnim: 0 };

    // build everything static
    this.ground();
    this.vegetation();
    this.batch.build(this.root);
    this.sky();
    this.lighting();
    if (o.weather === 'rain' || o.weather === 'storm') this.rain(o.weather === 'storm');
  }

  ground() {
    const g = T.groundTexture(this.def.groundTex);
    const mat = new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, roughnessMap: g.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) });
    const size = 220;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 6, uv.getY(i) * size / 6);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    this.root.add(m);
    if (this.def.kit === 'camp') {
      // the lake beyond the north edge
      const w = T.waterTexture();
      const water = new THREE.Mesh(new THREE.PlaneGeometry(140, 50), new THREE.MeshStandardMaterial({ color: '#0a1214', roughness: 0.05, metalness: 0.9, normalMap: w.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.03, -HALF - 30);
      this.root.add(water);
      this.water = water;
    }
  }

  vegetation() {
    const q = this.opts.quality;
    const kit = this.def.kit;
    const R = this.rng;
    const insideNoGrass = (x, z) => this.noGrass.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);

    // outside the perimeter: dense backdrop
    const ring = (n, r0, r1, fn) => {
      for (let i = 0; i < n; i++) {
        const side = R.int(0, 3);
        const lat = R.range(-r1, r1), dep = R.range(r0, r1);
        const [x, z] = side === 0 ? [lat, -dep] : side === 1 ? [lat, dep] : side === 2 ? [-dep, lat] : [dep, lat];
        if (this.gates.some((g) => Math.hypot(g.x - x, g.z - z) < 13)) continue;
        fn(x, z);
      }
    };
    if (kit === 'farm') {
      ring(q === 'low' ? 1500 : 4200, HALF + 1.2, HALF + 13, (x, z) => this.treeSpots.corn.push([x, z, R.range(0.85, 1.15)]));
      ring(90, HALF + 14, HALF + 32, (x, z) => this.treeSpots.dead.push([x, z, R.range(1.2, 2)]));
      for (const [a, b, c, d] of this.cornPatches) {
        for (let x = a; x < b; x += 0.85) for (let z = c; z < d; z += 0.85) {
          const px = x + R.range(-0.25, 0.25), pz = z + R.range(-0.25, 0.25);
          if (this.nav.isFree(px, pz)) this.treeSpots.corn.push([px, pz, R.range(0.85, 1.15)]);
        }
      }
    } else if (kit === 'camp') {
      ring(q === 'low' ? 260 : 520, HALF + 1.5, HALF + 34, (x, z) => { if (z > -HALF - 2) this.treeSpots.pine.push([x, z, R.range(1.0, 1.8)]); });
    } else if (kit === 'asylum') {
      ring(140, HALF + 2, HALF + 30, (x, z) => this.treeSpots.dead.push([x, z, R.range(1.0, 1.8)]));
      // distant hospital wing silhouette
      const conc = this.kit.wall2;
      this.batch.box(conc, 0, 7, -HALF - 22, 60, 14, 10, 0, 3);
      for (let i = 0; i < 12; i++) this.batch.box(mats.black(), -27 + i * 5, 8, -HALF - 16.9, 1.4, 2, 0.2, 0, 1);
    } else {
      ring(60, HALF + 2, HALF + 20, (x, z) => this.carStack(x, z, R.pick([0, Math.PI / 2]), R.int(2, 4)));
      // crane silhouette
      const steel = stdMat(T.metalTexture('#8a6a1a', 'crane'), 0.6, 0.6);
      this.batch.box(steel, HALF + 14, 14, 10, 1.2, 28, 1.2, 0, 2);
      this.batch.box(steel, HALF + 6, 27.5, 10, 20, 1.0, 1.0, 0, 2);
    }

    // instanced trees
    const pineN = this.treeSpots.pine.length, deadN = this.treeSpots.dead.length;
    if (pineN) {
      const bark = T.barkTexture();
      const trunk = new THREE.InstancedMesh(cylGeo(0.16, 0.3, 9, 8, 2), new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 1 }), pineN);
      const fol = new THREE.MeshStandardMaterial({ map: T.needlesTexture().map, normalMap: T.needlesTexture().normalMap, roughness: 1, color: '#9aa890' });
      const cones = [];
      for (let i = 0; i < 5; i++) {
        const cg = new THREE.ConeGeometry(2.4 - i * 0.42, 2.6, 9, 3);
        const p = cg.attributes.position;
        for (let v = 0; v < p.count; v++) { p.setX(v, p.getX(v) * (0.85 + Math.random() * 0.3)); p.setZ(v, p.getZ(v) * (0.85 + Math.random() * 0.3)); p.setY(v, p.getY(v) + (Math.random() - 0.5) * 0.25); }
        cg.computeVertexNormals();
        cg.translate(0, 2.6 + i * 1.45, 0);
        cones.push(cg);
      }
      const b = new Batch();
      for (const cg of cones) b.add(cg, fol);
      const merged = b.build(new THREE.Group())[0].geometry;
      const foliage = new THREE.InstancedMesh(merged, fol, pineN);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
      this.treeSpots.pine.forEach(([x, z, s], i) => {
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
        m4.compose(p4.set(x, 4.5 * s, z), q4, s4.set(s, s, s));
        trunk.setMatrixAt(i, m4);
        m4.compose(p4.set(x, 0, z), q4, s4.set(s, s * (0.9 + Math.random() * 0.25), s));
        foliage.setMatrixAt(i, m4);
      });
      trunk.castShadow = foliage.castShadow = true;
      trunk.receiveShadow = foliage.receiveShadow = true;
      this.root.add(trunk, foliage);
    }
    if (deadN) {
      const bark = T.barkTexture();
      const mat = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 1, color: '#8a8070' });
      const b = new Batch();
      b.add(cylGeo(0.08, 0.28, 7, 8, 2), mat, 0, 3.5, 0);
      const rr = new RNG(77);
      for (let i = 0; i < 7; i++) {
        const y = 2.5 + i * 0.6, a = rr.range(0, 6.28), len = rr.range(1.2, 2.6) * (1 - i * 0.08);
        const g = cylGeo(0.02, 0.08, len, 5, 1);
        g.translate(0, len / 2, 0);
        b.add(g, mat, 0, y, 0, 0, a, rr.range(0.7, 1.2));
        const g2 = cylGeo(0.01, 0.03, len * 0.5, 4, 1);
        g2.translate(0, len * 0.25, 0);
        b.add(g2, mat, Math.cos(-a) * 0, y + 0.3, 0, 0, a + 0.8, rr.range(0.4, 0.9));
      }
      const geo = b.build(new THREE.Group())[0].geometry;
      const inst = new THREE.InstancedMesh(geo, mat, deadN);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
      this.treeSpots.dead.forEach(([x, z, s], i) => {
        q4.setFromEuler(new THREE.Euler(Math.random() * 0.1, Math.random() * 6.28, Math.random() * 0.1));
        m4.compose(p4.set(x, 0, z), q4, s4.set(s, s, s));
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = true;
      this.root.add(inst);
    }
    if (this.treeSpots.rock.length) {
      const rt = T.rockTexture();
      const geo = new THREE.IcosahedronGeometry(1, 2);
      const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
        const n = 0.75 + 0.35 * Math.sin(x * 3.1 + z * 1.7) * Math.cos(y * 2.3 + x);
        p.setXYZ(v, x * n, y * n * 0.8, z * n);
      }
      geo.computeVertexNormals();
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughness: 0.95 }), this.treeSpots.rock.length);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
      this.treeSpots.rock.forEach(([x, z, s], i) => {
        q4.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6.28, Math.random()));
        m4.compose(p4.set(x, s * 0.45, z), q4, s4.set(s, s, s));
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = inst.receiveShadow = true;
      this.root.add(inst);
    }

    // corn
    if (this.treeSpots.corn.length) {
      const tex = T.cornCardTexture();
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: '#c8c0a0' });
      this.windMat(mat, 0.12);
      const card = new THREE.PlaneGeometry(1.1, 2.5);
      card.translate(0, 1.25, 0);
      const b = new Batch();
      b.add(card, mat); b.add(card, mat, 0, 0, 0, 0, Math.PI / 2, 0);
      const geo = b.build(new THREE.Group())[0].geometry;
      const inst = new THREE.InstancedMesh(geo, mat, this.treeSpots.corn.length);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
      this.treeSpots.corn.forEach(([x, z, s], i) => {
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
        m4.compose(p4.set(x, 0, z), q4, s4.set(s, s * (0.9 + Math.random() * 0.25), s));
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = q !== 'low';
      this.root.add(inst);
    }

    // grass clumps
    const grassN = kit === 'junk' ? 0 : q === 'low' ? 1500 : q === 'medium' ? 4500 : 9000;
    if (grassN) {
      const pal = kit === 'farm' ? ['#4a4a22', '#6a6232', '#5a5a2a', '#3a3a1a'] : kit === 'asylum' ? ['#3a4426', '#4a5430', '#2e3a1e', '#55603a'] : ['#2e3a20', '#3e4a28', '#26301a', '#4a5030'];
      const tex = T.grassCardTexture(pal);
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
      this.windMat(mat, 0.08);
      const b = new Batch();
      const card = new THREE.PlaneGeometry(1.0, 0.55);
      card.translate(0, 0.27, 0);
      for (let i = 0; i < 3; i++) b.add(card, mat, 0, 0, 0, 0, (i * Math.PI) / 3, 0);
      const geo = b.build(new THREE.Group())[0].geometry;
      const inst = new THREE.InstancedMesh(geo, mat, grassN);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
      let n = 0;
      for (let tries = 0; tries < grassN * 3 && n < grassN; tries++) {
        const x = R.range(-HALF - 6, HALF + 6), z = R.range(-HALF - 6, HALF + 6);
        if (insideNoGrass(x, z)) continue;
        const v = this.nav.value(x, z);
        if (v !== FREE && Math.abs(x) < HALF && Math.abs(z) < HALF) continue;
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R.range(0, 6.28));
        const s = R.range(0.7, 1.5);
        m4.compose(p4.set(x, 0, z), q4, s4.set(s, s * R.range(0.7, 1.3), s));
        inst.setMatrixAt(n++, m4);
      }
      inst.count = n;
      inst.receiveShadow = true;
      this.root.add(inst);
    }
  }

  windMat(mat, amt) {
    const u = { uTime: { value: 0 } };
    this.windUniforms = this.windUniforms || [];
    this.windUniforms.push(u.uTime);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec4 ip = instanceMatrix[3];
          #else
          vec4 ip = vec4(0.0);
          #endif
          float sway = sin(uTime * 1.6 + ip.x * 0.35 + ip.z * 0.27) + 0.5 * sin(uTime * 3.1 + ip.x * 0.9);
          transformed.x += sway * ${amt.toFixed(3)} * position.y;
          transformed.z += sway * ${(amt * 0.6).toFixed(3)} * position.y;`);
    };
  }

  sky() {
    const def = this.def;
    const geo = new THREE.SphereGeometry(300, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(def.sky[0]) }, bottom: { value: new THREE.Color(def.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.5, h)), 1.0); }',
    });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.skyMesh.renderOrder = -10;
    this.scene.add(this.skyMesh);
    // stars
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.12;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 280; pos[i * 3 + 1] = Math.sin(e) * 280; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 280;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xc8d0e0, size: 1.2, sizeAttenuation: false, fog: false, transparent: true, opacity: def.weather === 'rain' ? 0.15 : 0.7 }));
    this.scene.add(this.stars);
    const blood = this.opts.bloodMoon;
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.moonTexture(blood), fog: false, depthWrite: false, transparent: true }));
    this.moonSprite.scale.set(70, 70, 1);
    this.moonSprite.position.set(-120, 150, -170);
    this.scene.add(this.moonSprite);
  }

  lighting() {
    const def = this.def;
    const fogMul = this.opts.fogMul || 1;
    this.scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity * fogMul);
    this.scene.background = new THREE.Color(def.fogColor);
    const blood = this.opts.bloodMoon;
    this.hemi = new THREE.HemisphereLight(blood ? 0x7a3a3a : def.hemi[0], def.hemi[1], def.hemi[2]);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(blood ? 0xd86a5a : def.moonColor, def.moonIntensity);
    this.moon.position.set(-24, 40, -34);
    const q = this.opts.quality;
    if (q !== 'low') {
      this.moon.castShadow = true;
      const s = q === 'high' ? 2048 : 1024;
      this.moon.shadow.mapSize.set(s, s);
      const c = this.moon.shadow.camera;
      c.left = -34; c.right = 34; c.top = 34; c.bottom = -34; c.near = 1; c.far = 140;
      this.moon.shadow.bias = -0.0006;
      this.moon.shadow.normalBias = 0.04;
    }
    this.scene.add(this.moon, this.moon.target);
    this.baseHemi = this.hemi.intensity;
  }

  rain(storm) {
    const n = this.opts.quality === 'low' ? 900 : 2200;
    const pos = new Float32Array(n * 6);
    this.rainData = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.rainData[i * 3] = (Math.random() - 0.5) * 50;
      this.rainData[i * 3 + 1] = Math.random() * 22;
      this.rainData[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9aa4b0, transparent: true, opacity: 0.35, fog: true }));
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
    this.storm = storm || this.def.id === 'stivo';
    this.nextLightning = 8 + Math.random() * 10;
    this.raining = true;
  }

  update(dt, camPos, cb) {
    this.t += dt;
    const t = this.t;
    if (this.windUniforms) for (const u of this.windUniforms) u.value = t;
    // flickering fires and lamps
    for (const f of this.fires) {
      const fl = 1 - f.flicker * 0.5 + f.flicker * (Math.sin(t * 13 + f.base) * 0.3 + Math.sin(t * 29) * 0.2 + Math.random() * 0.5);
      if (f.light) f.light.intensity = f.base * fl;
      if (f.glow) f.glow.material.opacity = 0.35 + fl * 0.25;
      if (f.flames) f.flames.forEach((s, i) => { s.scale.y = (0.9 - i * 0.2) * (0.8 + Math.random() * 0.4); s.material.opacity = 0.6 + Math.random() * 0.4; });
    }
    // pallets falling
    for (const p of this.pallets) {
      if (p.state === 'falling') {
        p.anim = Math.min(1, p.anim + dt / 0.32);
        const e = p.anim * p.anim;
        p.mesh.board.position.lerpVectors(p.standPos, p.downPos, e);
        p.mesh.board.quaternion.slerpQuaternions(p.standQ, p.downQ, e);
        if (p.anim >= 1) p.state = 'down';
      }
    }
    // gates
    for (const g of this.gates) {
      if (g.open && g.openAnim < 1) {
        g.openAnim = Math.min(1, g.openAnim + dt / 2.5);
        g.mesh.door.position.y = g.openAnim * 4.2;
        g.exitGlow.material.opacity = g.openAnim * 0.6;
      }
      g.mesh.lever.rotation.x = 0.6 - g.progress * 1.2;
      g.mesh.lamps.forEach((l, i) => { l.material = g.progress > (i + 1) / 3.2 || g.open ? mats.greenOn() : g.powered ? mats.redOn() : mats.bulbOff(); });
      if (g.powered) {
        const blink = g.open ? 0.5 : (Math.sin(t * 6) > 0 ? 1 : 0.2);
        g.mesh.alarm.material = g.open ? mats.greenOn() : mats.redOn();
        g.mesh.glow.material.color.set(g.open ? 0x40ff60 : 0xff2010);
        g.mesh.glow.material.opacity = blink * 0.9;
      }
    }
    for (const c of this.chests) if (c.opened && c.lidAnim < 1) { c.lidAnim = Math.min(1, c.lidAnim + dt * 2); c.mesh.lid.rotation.x = -c.lidAnim * 1.9; }
    if (this.hatch.open && !this.hatch.closed) {
      this.hatch.lidAnim = Math.min(1, this.hatch.lidAnim + dt * 1.5);
      this.hatch.mesh.lid.rotation.x = -this.hatch.lidAnim * 1.8;
      this.hatch.mesh.glow.material.opacity = 0.4 + Math.sin(t * 2) * 0.15;
    } else if (this.hatch.closed) { this.hatch.mesh.lid.rotation.x = 0; this.hatch.mesh.glow.material.opacity = 0; }
    // CRT static
    if (this.tvStatic && Math.floor(t * 15) !== this.tvFrame) {
      this.tvFrame = Math.floor(t * 15);
      this.tvStatic.noise(0.9, [0.75, 0.85, 1]);
      this.tvStatic.tex.needsUpdate = true;
    }
    // shadows follow the camera
    if (this.moon.castShadow && camPos) {
      const sx = Math.round(camPos.x / 2) * 2, sz = Math.round(camPos.z / 2) * 2;
      this.moon.target.position.set(sx, 0, sz);
      this.moon.position.set(sx - 24, 40, sz - 34);
    }
    if (this.skyMesh && camPos) { this.skyMesh.position.copy(camPos); this.stars.position.copy(camPos); this.moonSprite.position.set(camPos.x - 120, 150, camPos.z - 170); }
    // rain
    if (this.raining && camPos) {
      const pos = this.rainLines.geometry.attributes.position.array;
      const d = this.rainData;
      for (let i = 0; i < d.length / 3; i++) {
        d[i * 3 + 1] -= dt * 18;
        if (d[i * 3 + 1] < 0) { d[i * 3 + 1] += 22; d[i * 3] = (Math.random() - 0.5) * 50; d[i * 3 + 2] = (Math.random() - 0.5) * 50; }
        const x = camPos.x + d[i * 3], y = d[i * 3 + 1], z = camPos.z + d[i * 3 + 2];
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + 0.05; pos[i * 6 + 4] = y + 0.6; pos[i * 6 + 5] = z + 0.02;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      if (this.storm) {
        this.nextLightning -= dt;
        if (this.nextLightning < 0) {
          this.nextLightning = 10 + Math.random() * 18;
          this.flash = 0.35;
          if (cb && cb.thunder) setTimeout(() => cb.thunder(), 400 + Math.random() * 1200);
        }
      }
    }
    if (this.flash > 0) {
      this.flash -= dt;
      const on = this.flash > 0.25 || (this.flash > 0.05 && this.flash < 0.15);
      this.hemi.intensity = this.baseHemi * (on ? 6 : 1);
    } else if (this.hemi) this.hemi.intensity = this.baseHemi;
    if (this.water && this.water.material.normalMap) this.water.material.normalMap.offset.set(t * 0.01, t * 0.006);
  }

  dispose() {
    const kill = (o) => {
      o.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
      });
      this.scene.remove(o);
    };
    kill(this.root);
    for (const o of [this.skyMesh, this.stars, this.moonSprite, this.rainLines, this.hemi, this.moon, this.moon && this.moon.target]) if (o) this.scene.remove(o);
    this.scene.fog = null;
  }
}
