/**
 * Map construction API. A map definition calls these helpers; each one adds
 * collision boxes (always) and visuals (unless headless). Static visuals are
 * merged per material at finish() to keep draw calls low.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';

/** Box geometry with world-space UVs so textures tile at a constant density. */
export function worldBoxGeometry(x0, y0, z0, x1, y1, z1, scale, faces = 63) {
  const pos = [], nor = [], uv = [], idx = [];
  const s = scale > 0 ? 1 / scale : 1;
  const quad = (p, n, uvs) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(...p[i]); nor.push(...n); uv.push(...uvs[i]); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // +X
  if (faces & 1) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0],
    [[-z1 * s, y0 * s], [-z0 * s, y0 * s], [-z0 * s, y1 * s], [-z1 * s, y1 * s]]);
  // -X
  if (faces & 2) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0],
    [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]]);
  // +Y
  if (faces & 4) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0],
    [[x0 * s, -z1 * s], [x1 * s, -z1 * s], [x1 * s, -z0 * s], [x0 * s, -z0 * s]]);
  // -Y
  if (faces & 8) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0],
    [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]]);
  // +Z
  if (faces & 16) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1],
    [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]]);
  // -Z
  if (faces & 32) quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1],
    [[-x1 * s, y0 * s], [-x0 * s, y0 * s], [-x0 * s, y1 * s], [-x1 * s, y1 * s]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Container geometry mapping onto the container atlas texture. */
function containerGeometry(x0, y0, z0, x1, y1, z1, alongX) {
  const pos = [], nor = [], uv = [], idx = [];
  const quad = (p, n, uvs) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(...p[i]); nor.push(...n); uv.push(...uvs[i]); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // atlas regions (v=1 is top of canvas because flipY): side = v 0.5..1, end = u0..0.5 v0..0.5, roof = u0.5..1 v0..0.5
  const side = [[0, 0.5], [1, 0.5], [1, 1], [0, 1]];
  const end = [[0.02, 0.02], [0.48, 0.02], [0.48, 0.48], [0.02, 0.48]];
  const roof = [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]];
  if (alongX) {
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], side);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], side);
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], end);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], end);
  } else {
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], side);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], side);
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], end);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], end);
  }
  quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], roof);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class MapBuilder {
  constructor({ headless = false, materials = null } = {}) {
    this.headless = headless;
    this.materials = materials;
    this.world = new CollisionWorld(4);
    this.root = headless ? null : new THREE.Group();
    this.buckets = new Map(); // matKey -> geometries[]
    this.spawns = [];
    this.hotspots = [];
    this.lights = [];
    this.minimapRects = []; // {x0,z0,x1,z1,h,kind}
    this.labels = [];
    this.castShadowKeys = new Set();
  }

  _addGeom(key, geom) {
    if (this.headless) return;
    // merging needs every geometry in a bucket to be indexed (or none)
    if (!geom.index) { const n = geom.attributes.position.count; const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = i; geom.setIndex(idx); }
    let arr = this.buckets.get(key);
    if (!arr) { arr = []; this.buckets.set(key, arr); }
    arr.push(geom);
  }

  /**
   * Axis-aligned box from min/max corners.
   * opts: collide (true), visual (true), bullet, sight, faces bitmask, map (minimap kind), solid
   */
  box(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (opts.collide !== false) {
      this.world.add({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, mat: matCategory(mat), bullet: opts.bullet, sight: opts.sight, solid: opts.solid });
    }
    if (opts.visual !== false && !this.headless && mat) {
      const e = this.materials.get(mat);
      this._addGeom(mat, worldBoxGeometry(x0, y0, z0, x1, y1, z1, opts.uvScale || e.scale, opts.faces ?? 63));
    }
    if (opts.map !== false && opts.collide !== false && y1 > 0.9 && y1 - y0 > 0.5) {
      this.minimapRects.push({ x0, z0, x1, z1, h: y1, kind: opts.map || 'solid' });
    }
  }

  /** Box by center x/z, bottom y and size. */
  boxC(cx, y, cz, sx, sy, sz, mat, opts) {
    this.box(cx - sx / 2, y, cz - sz / 2, cx + sx / 2, y + sy, cz + sz / 2, mat, opts);
  }

  /** Invisible blocker (movement only by default). */
  blocker(x0, y0, z0, x1, y1, z1, opts = {}) {
    this.box(x0, y0, z0, x1, y1, z1, null, { visual: false, bullet: opts.bullet ?? false, sight: opts.sight ?? false, map: false, ...opts });
  }

  /** Shipping container. len along X if alongX. Standard 2.44w x 2.59h. */
  container(cx, y, cz, len, alongX, color) {
    const w = 2.44, h = 2.59;
    const sx = alongX ? len : w, sz = alongX ? w : len;
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.world.add({ minX: x0, minY: y, minZ: z0, maxX: x1, maxY: y + h, maxZ: z1, mat: 'metal' });
    this.minimapRects.push({ x0, z0, x1, z1, h: y + h, kind: 'container' });
    if (this.headless) return;
    const key = 'container_' + color;
    this.materials.get(key);
    this._addGeom(key, containerGeometry(x0, y, z0, x1, y + h, z1, alongX));
    // corner castings / bottom rails (dark)
    const t = 0.12;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const ix = px === x0 ? x0 : x1 - t, iz = pz === z0 ? z0 : z1 - t;
      this._addGeom('rust', worldBoxGeometry(ix - 0.01, y, iz - 0.01, ix + t + 0.01, y + h + 0.01, iz + t + 0.01, 2));
    }
  }

  /** Cylinder visual with an approximating box collider (vertical axis). */
  cylinder(cx, y, cz, r, h, mat, opts = {}) {
    const seg = opts.seg || 16;
    if (opts.collide !== false) {
      const k = r * 0.86;
      this.world.add({ minX: cx - k, minY: y, minZ: cz - k, maxX: cx + k, maxY: y + h, maxZ: cz + k, mat: matCategory(mat) });
      if (h > 0.9) this.minimapRects.push({ x0: cx - k, z0: cz - k, x1: cx + k, z1: cz + k, h: y + h, kind: 'solid' });
    }
    if (this.headless) return;
    const g = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, seg, 1, false);
    scaleUV(g, (2 * Math.PI * r) / (this.materials.get(mat).scale || 1), h / (this.materials.get(mat).scale || 1));
    g.translate(cx, y + h / 2, cz);
    this._addGeom(mat, g);
  }

  /** Horizontal cylinder (tanks, pipes) along X or Z. Collider = box. */
  hcylinder(cx, cy, cz, r, len, alongX, mat, opts = {}) {
    if (opts.collide !== false) {
      const k = r * 0.9;
      if (alongX) this.world.add({ minX: cx - len / 2, minY: cy - k, minZ: cz - k, maxX: cx + len / 2, maxY: cy + k, maxZ: cz + k, mat: 'metal' });
      else this.world.add({ minX: cx - k, minY: cy - k, minZ: cz - len / 2, maxX: cx + k, maxY: cy + k, maxZ: cz + len / 2, mat: 'metal' });
      if (cy + r > 1) this.minimapRects.push(alongX
        ? { x0: cx - len / 2, z0: cz - k, x1: cx + len / 2, z1: cz + k, h: cy + r, kind: 'solid' }
        : { x0: cx - k, z0: cz - len / 2, x1: cx + k, z1: cz + len / 2, h: cy + r, kind: 'solid' });
    }
    if (this.headless) return;
    const e = this.materials.get(mat);
    const g = new THREE.CylinderGeometry(r, r, len, opts.seg || 20, 1, false);
    scaleUV(g, (2 * Math.PI * r) / (e.scale || 1), len / (e.scale || 1));
    if (alongX) g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
    g.translate(cx, cy, cz);
    this._addGeom(mat, g);
    if (opts.caps !== false) {
      const cap = new THREE.SphereGeometry(r, opts.seg || 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.35, 1);
      const c1 = cap.clone(), c2 = cap.clone();
      if (alongX) {
        c1.rotateZ(-Math.PI / 2); c1.translate(cx + len / 2, cy, cz);
        c2.rotateZ(Math.PI / 2); c2.translate(cx - len / 2, cy, cz);
      } else {
        c1.rotateX(Math.PI / 2); c1.translate(cx, cy, cz + len / 2);
        c2.rotateX(-Math.PI / 2); c2.translate(cx, cy, cz - len / 2);
      }
      this._addGeom(mat, c1); this._addGeom(mat, c2);
    }
  }

  /** Visual-only geometry (already positioned) with given material key. */
  addVisual(geom, mat) { if (!this.headless) this._addGeom(mat, geom); }

  /** Add a pre-built Object3D (not merged). */
  addObject(obj) { if (!this.headless) this.root.add(obj); }

  spawn(team, x, z, yaw, y = 0) { this.spawns.push({ team, x, y, z, yaw }); }
  hotspot(x, z, name, weight = 1) { this.hotspots.push({ x, z, name, weight }); }
  label(x, z, text) { this.labels.push({ x, z, text }); }
  pointLight(x, y, z, color, intensity, distance) { this.lights.push({ x, y, z, color, intensity, distance }); }

  /** Merge buckets into meshes. */
  finish({ shadows = true } = {}) {
    if (this.headless) return;
    for (const [key, geoms] of this.buckets) {
      const e = this.materials.get(key);
      const merged = mergeGeometries(geoms, false);
      for (const g of geoms) g.dispose();
      const mesh = new THREE.Mesh(merged, e.mat);
      mesh.name = 'static:' + key;
      mesh.matrixAutoUpdate = false;
      const emissive = key.startsWith('lamp') || key === 'window_dark';
      mesh.castShadow = shadows && !emissive && key !== 'asphalt' && key !== 'gravel';
      mesh.receiveShadow = shadows && !key.startsWith('lamp');
      this.root.add(mesh);
    }
    this.buckets.clear();
  }
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

export function matCategory(mat) {
  if (!mat) return 'concrete';
  if (mat.includes('wood')) return 'wood';
  if (mat.includes('metal') || mat.includes('corrugated') || mat.includes('rust') || mat.includes('steel') || mat.includes('container') || mat.includes('diamond') || mat.includes('tank') || mat.includes('roof')) return 'metal';
  if (mat.includes('gravel')) return 'gravel';
  if (mat.includes('brick')) return 'brick';
  if (mat.includes('dirt') || mat.includes('hedge')) return 'gravel';
  if (mat.includes('fence') || mat.includes('dish')) return 'metal';
  return 'concrete';
}
