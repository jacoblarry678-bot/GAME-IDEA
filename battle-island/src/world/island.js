/**
 * Battle Island: terrain, water, sky, the five Benton Kids locations, roads,
 * trees, rocks and every loot/chest spot. All geometry is procedural.
 *
 * Every solid thing registers a Collider in Physics, so buildings have real
 * walk-in interiors, stairs, roofs you can stand on, and harvestable walls.
 */

import * as THREE from 'three';
import { Heightmap, Physics, Collider, WATER_Y } from './physics.js';
import { mulberry32 } from '../gameplay/items.js';

export const ISLAND_SIZE = 320;
const STORY = 3.3;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const POIS = [
  { id: 'clubhouse', name: 'Benton Kids Clubhouse', x: 5, z: 0, r: 16, h: 16, color: '#ffcf3f' },
  { id: 'garage', name: 'Benton Diesel Garage', x: -78, z: 55, r: 30, h: 5, color: '#ff8a3d' },
  { id: 'park', name: 'Pickles Park', x: 72, z: 68, r: 32, h: 4, color: '#7ed957' },
  { id: 'hollow', name: 'Haunt Hollow', x: -70, z: -70, r: 30, h: 7, color: '#b07cff' },
  { id: 'depot', name: 'Boom Co. Depot', x: 78, z: -62, r: 30, h: 5, color: '#ff5c7a' },
];
const MINOR = [
  { name: 'Lookout Cabin', x: -12, z: 98, h: 6 },
  { name: 'Fishing Shack', x: 24, z: -104, h: 3 },
  { name: 'Farm House', x: -112, z: -6, h: 6 },
  { name: 'Snack Shack', x: 116, z: 4, h: 5 },
];
const POND = { x: 90, z: 84, r: 10 };

function coastRadius(a) {
  return 132 + 11 * Math.sin(3 * a + 1) + 7 * Math.sin(5 * a + 2) + 4 * Math.sin(9 * a + 0.5);
}

function rawHeight(x, z) {
  const d = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const inland = coastRadius(a) - d;
  const land = smooth(-6, 22, inland);
  let hills = 4.5 + 3.2 * Math.sin(x * 0.031 + 1.3) * Math.cos(z * 0.027 - 0.4) + 1.6 * Math.sin(x * 0.071 + z * 0.052) + 1.1 * Math.cos(x * 0.11 - z * 0.09);
  hills += 9 * Math.exp(-((x - 40) ** 2 + (z + 28) ** 2) / 900) + 7 * Math.exp(-((x + 30) ** 2 + (z - 40) ** 2) / 700);
  // clubhouse hill
  hills += 12 * Math.exp(-((x - 5) ** 2 + z ** 2) / 1400);
  let h = -7 + (hills + 7) * land;
  for (const p of POIS) {
    const w = smooth(p.r + 20, p.r, Math.hypot(x - p.x, z - p.z));
    h += (p.h - h) * w;
  }
  for (const m of MINOR) {
    const w = smooth(16, 8, Math.hypot(x - m.x, z - m.z));
    h += (m.h - h) * w;
  }
  const pd = Math.hypot(x - POND.x, z - POND.z);
  h -= 6.5 * smooth(POND.r + 4, POND.r - 3, pd);
  return h;
}

// ---------- procedural textures ----------
const texCache = new Map();
function canvasTex(kind) {
  if (texCache.has(kind)) return texCache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 3;
  if (kind === 'brick') {
    for (let y = 0; y < 8; y++) {
      g.beginPath(); g.moveTo(0, y * 16); g.lineTo(128, y * 16); g.stroke();
      for (let x = 0; x < 4; x++) {
        const xx = x * 32 + (y % 2) * 16;
        g.beginPath(); g.moveTo(xx, y * 16); g.lineTo(xx, y * 16 + 16); g.stroke();
      }
    }
  } else if (kind === 'wood') {
    for (let x = 0; x < 6; x++) { g.beginPath(); g.moveTo(x * 22, 0); g.lineTo(x * 22, 128); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 20; i++) { g.beginPath(); const y = (i * 37) % 128; g.moveTo((i * 13) % 128, y); g.lineTo(((i * 13) % 128) + 14, y + 2); g.stroke(); }
  } else if (kind === 'metal') {
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < 8; x++) { g.beginPath(); g.moveTo(x * 16 + 8, 0); g.lineTo(x * 16 + 8, 128); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) g.fillRect(4 + i * 32, 6, 4, 4);
  } else if (kind === 'roof') {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.beginPath(); g.arc(x * 16 + (y % 2) * 8, y * 16 + 16, 8, Math.PI, 0); g.stroke();
      }
    }
  } else if (kind === 'crate') {
    g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(124, 124); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(kind, t);
  return t;
}

const matCache = new Map();
export function mat(color, tex = null, extra = null) {
  const k = color + '|' + tex + '|' + (extra ? JSON.stringify(extra) : '');
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshLambertMaterial({ color, map: tex ? canvasTex(tex) : null, ...(extra || {}) });
  matCache.set(k, m);
  return m;
}

const geoCache = new Map();
/** Box geometry with world-scaled UVs so textures tile instead of stretching. */
export function boxGeo(w, h, d, uvScale = 2.5) {
  const k = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}|${uvScale}`;
  if (geoCache.has(k)) return geoCache.get(k);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / uvScale, uv.getY(i) * dims[f][1] / uvScale);
    }
  }
  geoCache.set(k, g);
  return g;
}

const MAT_HP = { wood: 220, brick: 320, metal: 420 };

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.root = new THREE.Group();
    this.hm = new Heightmap(ISLAND_SIZE + 80, 200, rawHeight);
    this.physics = new Physics(this.hm);
    this.pois = POIS;
    this.minor = MINOR;
    this.chests = [];
    this.lootSpots = [];
    this.footprints = []; // for the map
    this.roads = [];
    this.animated = [];
    this.exclude = []; // circles where trees/rocks may not spawn
    this.onBarrel = null; // set by the match: explosion callback
    this._buildTerrain();
    this._buildWater();
    this._buildSky();
    this._buildRoads();
    this._buildClubhouse();
    this._buildGarage();
    this._buildPark();
    this._buildHollow();
    this._buildDepot();
    for (const m of MINOR) this._cabin(m);
    this._scatterNature();
    this.mapCanvas = this._renderMap();
  }

  height(x, z) {
    return this.hm.get(x, z);
  }

  poiAt(x, z) {
    for (const p of POIS) if (Math.hypot(x - p.x, z - p.z) < p.r + 6) return p;
    for (const m of MINOR) if (Math.hypot(x - m.x, z - m.z) < 14) return m;
    return null;
  }

  isLand(x, z) {
    return this.hm.get(x, z) > WATER_Y + 0.6;
  }

  // ---------------------------------------------------------------- terrain
  _buildTerrain() {
    const hm = this.hm;
    const n = hm.n, w = n + 1;
    const pos = new Float32Array(w * w * 3);
    const col = new Float32Array(w * w * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color('#f2dc9b'), grass = new THREE.Color('#6cc24a'), grass2 = new THREE.Color('#4fae3f');
    const rock = new THREE.Color('#9a9a8a'), dirt = new THREE.Color('#b8925a'), haunt = new THREE.Color('#5b5a78');
    const park = new THREE.Color('#86e05b'), lot = new THREE.Color('#a6a095'), sea = new THREE.Color('#e6cf8a');
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const k = j * w + i;
        const x = -hm.half + i * hm.cell, z = -hm.half + j * hm.cell;
        const y = hm.h[k];
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        const sl = Math.abs(hm.get(x + 1, z) - hm.get(x - 1, z)) + Math.abs(hm.get(x, z + 1) - hm.get(x, z - 1));
        if (y < 0.2) c.copy(sea);
        else if (y < 1.4) c.copy(sand);
        else c.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.13) * Math.cos(z * 0.11));
        if (y > 1.4 && sl > 2.2) c.lerp(rock, Math.min(1, (sl - 2.2) / 2));
        const hol = smooth(40, 22, Math.hypot(x - POIS[3].x, z - POIS[3].z));
        c.lerp(haunt, hol * 0.85);
        const pk = smooth(38, 26, Math.hypot(x - POIS[2].x, z - POIS[2].z));
        if (y > 1.4) c.lerp(park, pk * 0.6);
        for (const p of [POIS[1], POIS[4]]) {
          const lt = smooth(p.r - 2, p.r - 10, Math.hypot(x - p.x, z - p.z));
          c.lerp(lot, lt * 0.85);
        }
        if (y > 1.4 && y < 2.2) c.lerp(dirt, 0.3);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    const idx = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * w + i, b = a + 1, cc = a + w, d = cc + 1;
        // split along the (i+1,j)–(i,j+1) diagonal to match Heightmap.get
        idx.push(a, cc, b, cc, d, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    this.terrainMesh = m;
    this.root.add(m);
  }

  _buildWater() {
    const g = new THREE.PlaneGeometry(1600, 1600, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: '#35b6ea', transparent: true, opacity: 0.82, shininess: 90, specular: '#bfefff' }));
    m.position.y = WATER_Y;
    this.water = m;
    this.root.add(m);
  }

  _buildSky() {
    const g = new THREE.SphereGeometry(700, 24, 12);
    const top = new THREE.Color('#4aa8ff'), bot = new THREE.Color('#dff4ff');
    const cols = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / 700);
      const c = bot.clone().lerp(top, Math.pow(t, 0.6));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    this.sky = sky;
    this.root.add(sky);
    // puffy clouds
    const cg = new THREE.IcosahedronGeometry(1, 1);
    const cm = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#8fa9c0', flatShading: true });
    const clouds = new THREE.InstancedMesh(cg, cm, 90);
    const o = new THREE.Object3D();
    let k = 0;
    for (let c = 0; c < 18; c++) {
      const cx = (this.rng() - 0.5) * 520, cz = (this.rng() - 0.5) * 520, cy = 95 + this.rng() * 40;
      for (let b = 0; b < 5; b++) {
        o.position.set(cx + (b - 2) * 7 + this.rng() * 3, cy + this.rng() * 3, cz + this.rng() * 6);
        const s = 5 + this.rng() * 5;
        o.scale.set(s * 1.3, s * 0.8, s);
        o.updateMatrix();
        clouds.setMatrixAt(k++, o.matrix);
      }
    }
    this.root.add(clouds);
  }

  // ---------------------------------------------------------------- helpers
  /** Solid textured box with a collider. Coordinates are min/max corners. */
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const mesh = new THREE.Mesh(boxGeo(w, h, d), o.m || mat(o.color || '#dddddd', o.tex || null));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (o.solid === false) return { mesh };
    const hp = o.hp !== undefined ? o.hp : o.material ? MAT_HP[o.material] : Infinity;
    const c = new Collider({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, mesh, hp, maxHp: hp, material: o.material || null, kind: o.kind || 'static', harvest: o.harvest || (o.material && hp !== Infinity ? 6 : 0) });
    mesh.userData.collider = c;
    this.physics.add(c);
    return c;
  }

  /** Walkable stairs: a ramp collider with stepped visuals. dir as Collider.dir. */
  stairs(x0, z0, x1, z1, y0, y1, dir, color = '#b98a5a') {
    const steps = 9;
    const m = mat(color, 'wood');
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const top = y0 + (y1 - y0) * t1;
      let a, b, c2, d;
      if (dir === 0) { a = x0 + (x1 - x0) * t0; b = x0 + (x1 - x0) * t1; c2 = z0; d = z1; }
      else if (dir === 2) { a = x1 - (x1 - x0) * t1; b = x1 - (x1 - x0) * t0; c2 = z0; d = z1; }
      else if (dir === 1) { a = x0; b = x1; c2 = z0 + (z1 - z0) * t0; d = z0 + (z1 - z0) * t1; }
      else { a = x0; b = x1; c2 = z1 - (z1 - z0) * t1; d = z1 - (z1 - z0) * t0; }
      const mesh = new THREE.Mesh(boxGeo(b - a, top - y0 + 0.02, d - c2), m);
      mesh.position.set((a + b) / 2, (y0 + top) / 2, (c2 + d) / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    this.physics.add(new Collider({ type: 'ramp', dir, minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1 }));
  }

  /**
   * Wall along X (thin in Z) from x0..x1 at z, with openings [{a,b,bottom,top}]
   * given in absolute X. `alongZ` flips axes: wall along Z at x.
   */
  wall(alongZ, fixed, from, to, y0, h, openings, o) {
    const t = o.thick || 0.3;
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.05 || yb - ya < 0.05) return;
      if (alongZ) this.box(fixed - t / 2, ya, a, fixed + t / 2, yb, b, o);
      else this.box(a, ya, fixed - t / 2, b, yb, fixed + t / 2, o);
    };
    let cur = from;
    for (const op of [...openings].sort((p, q) => p.a - q.a)) {
      seg(cur, op.a, y0, y0 + h);
      if (op.bottom > 0) seg(op.a, op.b, y0, y0 + op.bottom);
      if (op.top < h) seg(op.a, op.b, y0 + op.top, y0 + h);
      cur = op.b;
    }
    seg(cur, to, y0, y0 + h);
  }

  /** Pyramid roof: visual cone + matching cone collider (walkable). */
  roof(x0, z0, x1, z1, y, h, color) {
    const g = new THREE.ConeGeometry(1, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(g, mat(color, 'roof', { flatShading: true }));
    m.scale.set((x1 - x0) / 2 / 0.7071, h, (z1 - z0) / 2 / 0.7071);
    m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
    m.castShadow = true;
    this.root.add(m);
    this.physics.add(new Collider({ type: 'cone', minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y, maxY: y + h }));
  }

  /**
   * A walk-in house: doors on the south and north walls, windows east/west,
   * interior stairs against the east wall, an optional pyramid roof.
   */
  house(cx, cz, w, d, stories, o) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const y0 = o.y;
    const wallO = { color: o.wall, tex: o.tex, material: o.material };
    this.footprints.push({ x0, z0, x1, z1, color: o.roof || o.wall });
    this.exclude.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 3 });
    // foundation (indestructible)
    this.box(x0 - 0.3, y0 - 3, z0 - 0.3, x1 + 0.3, y0 + 0.15, z1 + 0.3, { color: o.floor || '#c9b79a', tex: 'wood' });
    const doorA = cx - 0.9, doorB = cx + 0.9;
    for (let s = 0; s < stories; s++) {
      const fy = y0 + 0.15 + s * STORY;
      const door = s === 0 ? [{ a: doorA, b: doorB, bottom: 0, top: 2.4 }] : [{ a: cx - 0.8, b: cx + 0.8, bottom: 1, top: 2.2 }];
      const win = (a0, a1) => [{ a: (a0 + a1) / 2 - 0.8, b: (a0 + a1) / 2 + 0.8, bottom: 1.0, top: 2.2 }];
      this.wall(false, z0, x0, x1, fy, STORY, door, wallO);
      this.wall(false, z1, x0, x1, fy, STORY, s === 0 && o.backDoor !== false ? door : win(x0, x1), wallO);
      this.wall(true, x0, z0 + 0.15, z1 - 0.15, fy, STORY, win(z0, z1), wallO);
      this.wall(true, x1, z0 + 0.15, z1 - 0.15, fy, STORY, s === stories - 1 ? win(z0, z1) : [], wallO);
      if (s < stories - 1) {
        // upper floor with a stair hole along the east wall
        const top = fy + STORY;
        const sx0 = x1 - 1.9, sx1 = x1 - 0.15, sz0 = z0 + 1.1, sz1 = sz0 + 4.6;
        this.stairs(sx0, sz0, sx1, sz1, fy, top, 1);
        const fo = { color: o.floor || '#c9b79a', tex: 'wood', material: 'wood', hp: 400 };
        this.box(x0 + 0.15, top - 0.25, z0 + 0.15, sx0, top, z1 - 0.15, fo);
        this.box(sx0, top - 0.25, sz1, x1 - 0.15, top, z1 - 0.15, fo);
        this.box(sx0, top - 0.25, z0 + 0.15, x1 - 0.15, top, sz0 - 0.9, fo);
        this.lootSpots.push(new THREE.Vector3(cx - w / 4, top + 0.1, cz + d / 4));
      }
      this.lootSpots.push(new THREE.Vector3(cx - w / 4, fy + 0.1, cz - d / 5));
    }
    const ry = y0 + 0.15 + stories * STORY;
    this.box(x0 - 0.4, ry - 0.25, z0 - 0.4, x1 + 0.4, ry + 0.05, z1 + 0.4, { color: o.floor || '#c9b79a', tex: 'wood', material: 'wood', hp: 400 });
    if (o.roof) this.roof(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, ry + 0.05, Math.min(w, d) * 0.38, o.roof);
    // some furniture for cover
    this.box(x0 + 0.6, y0 + 0.15, z1 - 1.6, x0 + 2.8, y0 + 1.0, z1 - 0.5, { color: o.furniture || '#6b8fd6', material: 'wood', hp: 120, harvest: 5 });
    if (o.chest !== false) this.chest(x0 + 1.2, y0 + 0.15, z0 + 1.2, 0);
    if (stories > 1 && o.chest !== false) this.chest(x0 + 1.2, y0 + 0.15 + STORY, z1 - 1.2, Math.PI);
    return { x0, x1, z0, z1, top: ry };
  }

  chest(x, y, z, rot = 0, legendary = false) {
    const g = new THREE.Group();
    const gold = mat(legendary ? '#ffd23f' : '#e7a93a', 'wood', { emissive: legendary ? '#7a5a00' : '#3a2600' });
    const base = new THREE.Mesh(boxGeo(1.1, 0.55, 0.7), gold);
    base.position.y = 0.28;
    const lid = new THREE.Mesh(boxGeo(1.12, 0.22, 0.72), mat('#ffcf4d', null, { emissive: '#5a3c00' }));
    lid.position.set(0, 0.66, 0);
    const lock = new THREE.Mesh(boxGeo(0.2, 0.22, 0.06), mat('#fff3b0', null, { emissive: '#aa8800' }));
    lock.position.set(0, 0.5, 0.37);
    g.add(base, lid, lock);
    g.position.set(x, y, z);
    g.rotation.y = rot;
    g.traverse((m) => (m.castShadow = true));
    this.root.add(g);
    const ch = { pos: new THREE.Vector3(x, y, z), group: g, lid, opened: false, legendary, t: this.rng() * 6 };
    this.chests.push(ch);
    return ch;
  }

  tree(x, z, kind, scale = 1) {
    this._trees = this._trees || [];
    this._trees.push({ x, z, kind, scale, y: this.hm.get(x, z) });
  }

  // ---------------------------------------------------------------- POIs
  _buildClubhouse() {
    const p = POIS[0];
    const y = p.h;
    // giant trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, 16, 10), mat('#8a5a33', 'wood'));
    trunk.position.set(p.x, y + 8, p.z);
    trunk.castShadow = true;
    this.root.add(trunk);
    this.physics.add(new Collider({ minX: p.x - 1.6, maxX: p.x + 1.6, minZ: p.z - 1.6, maxZ: p.z + 1.6, minY: y, maxY: y + 16, mesh: trunk }));
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 1), mat('#58c24a', null, { flatShading: true }));
    canopy.position.set(p.x, y + 18, p.z);
    canopy.scale.set(1.2, 0.7, 1.2);
    canopy.castShadow = true;
    this.root.add(canopy);
    this.physics.add(new Collider({ minX: p.x - 7, maxX: p.x + 7, minZ: p.z - 7, maxZ: p.z + 7, minY: y + 15, maxY: y + 21, mesh: canopy }));
    // deck
    const dy = y + 4.5;
    const W = 7;
    const plank = { color: '#d9a066', tex: 'wood', material: 'wood', hp: 500 };
    this.box(p.x - W, dy - 0.3, p.z - W, p.x + W, dy, p.z + W, plank);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this.box(p.x + sx * (W - 0.4) - 0.3, y - 1, p.z + sz * (W - 0.4) - 0.3, p.x + sx * (W - 0.4) + 0.3, dy - 0.3, p.z + sz * (W - 0.4) + 0.3, { color: '#8a5a33', tex: 'wood' });
    }
    // railings with gaps at the stairs
    const rail = { color: '#ff6b6b', tex: 'wood', material: 'wood', hp: 150, thick: 0.2 };
    this.wall(false, p.z - W, p.x - W, p.x + W, dy, 1.1, [{ a: p.x - 1.5, b: p.x + 1.5, bottom: 0, top: 1.1 }], rail);
    this.wall(false, p.z + W, p.x - W, p.x + W, dy, 1.1, [], rail);
    this.wall(true, p.x - W, p.z - W, p.z + W, dy, 1.1, [{ a: p.z - 1.5, b: p.z + 1.5, bottom: 0, top: 1.1 }], rail);
    this.wall(true, p.x + W, p.z - W, p.z + W, dy, 1.1, [], rail);
    // two staircases: south and west
    this.stairs(p.x - 1.5, p.z - W - 7, p.x + 1.5, p.z - W, y, dy, 1, '#c98a4b');
    this.stairs(p.x - W - 7, p.z - 1.5, p.x - W, p.z + 1.5, y, dy, 0, '#c98a4b');
    // clubhouse hut on the deck (east half)
    const hx0 = p.x + 1.8, hx1 = p.x + 6.6, hz0 = p.z - 3.2, hz1 = p.z + 3.2;
    const hut = { color: '#4fb3ff', tex: 'wood', material: 'wood' };
    this.wall(true, hx0, hz0, hz1, dy, 3, [{ a: p.z - 0.8, b: p.z + 0.8, bottom: 0, top: 2.3 }], hut);
    this.wall(true, hx1, hz0, hz1, dy, 3, [{ a: p.z - 0.8, b: p.z + 0.8, bottom: 1, top: 2 }], hut);
    this.wall(false, hz0, hx0, hx1, dy, 3, [], hut);
    this.wall(false, hz1, hx0, hx1, dy, 3, [], hut);
    this.box(hx0 - 0.3, dy + 3, hz0 - 0.3, hx1 + 0.3, dy + 3.25, hz1 + 0.3, { color: '#ffcf3f', tex: 'wood', material: 'wood' });
    this.roof(hx0 - 0.3, hz0 - 0.3, hx1 + 0.3, hz1 + 0.3, dy + 3.25, 2.2, '#ff5b5b');
    this.chest(p.x + 4.2, dy, p.z + 2, Math.PI);
    // "BK" flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), mat('#eeeeee'));
    pole.position.set(p.x - 5.5, dy + 2.5, p.z + 5.5);
    this.root.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshLambertMaterial({ map: textTexture('BK', '#ffcf3f', '#e8453c'), side: THREE.DoubleSide }));
    flag.position.set(p.x - 4.3, dy + 4.3, p.z + 5.5);
    this.root.add(flag);
    this.animated.push((t) => (flag.rotation.y = Math.sin(t * 2) * 0.25));
    // bounce pad next to the tree (launch + glider redeploy)
    this.pad(p.x + 10, y, p.z + 8);
    this.lootSpots.push(new THREE.Vector3(p.x - 4, dy + 0.05, p.z - 3), new THREE.Vector3(p.x + 3, y + 0.1, p.z - 12), new THREE.Vector3(p.x - 12, y + 0.1, p.z + 4));
    this.exclude.push({ x: p.x, z: p.z, r: 20 });
  }

  pad(x, y, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.35, 16), mat('#333a4a'));
    base.position.y = 0.17;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 16), mat('#39f0ff', null, { emissive: '#119fb0' }));
    top.position.y = 0.38;
    g.add(base, top);
    g.position.set(x, y, z);
    this.root.add(g);
    this.animated.push((t) => (top.position.y = 0.38 + Math.abs(Math.sin(t * 3)) * 0.08));
    this.physics.add(new Collider({ kind: 'pad', minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.3, maxZ: z + 1.3, minY: y - 0.5, maxY: y + 0.42, mesh: g }));
  }

  _buildGarage() {
    const p = POIS[1];
    const y = p.h;
    const x0 = p.x - 13, x1 = p.x + 13, z0 = p.z - 9, z1 = p.z + 9;
    const H = 7;
    this.footprints.push({ x0, z0, x1, z1, color: '#ff8a3d' });
    this.exclude.push({ x: p.x, z: p.z, r: 26 });
    const metal = { color: '#8fa3b8', tex: 'metal', material: 'metal' };
    const stripe = { color: '#ff8a3d', tex: 'metal', material: 'metal' };
    this.box(x0 - 0.3, y - 3, z0 - 0.3, x1 + 0.3, y + 0.1, z1 + 0.3, { color: '#9a9a9a' });
    // south face: two bay doors
    this.wall(false, z0, x0, x1, y + 0.1, H, [{ a: x0 + 3, b: x0 + 9, bottom: 0, top: 5 }, { a: x1 - 9, b: x1 - 3, bottom: 0, top: 5 }], metal);
    this.wall(false, z1, x0, x1, y + 0.1, H, [{ a: p.x - 1, b: p.x + 1, bottom: 0, top: 2.5 }], metal);
    this.wall(true, x0, z0, z1, y + 0.1, H, [{ a: p.z - 1, b: p.z + 1, bottom: 0, top: 2.5 }], metal);
    this.wall(true, x1, z0, z1, y + 0.1, H, [{ a: p.z - 2, b: p.z + 2, bottom: 1.2, top: 2.6 }], metal);
    this.box(x0 - 0.2, y + 5.2, z0 - 0.5, x1 + 0.2, y + 6, z0 - 0.15, { ...stripe, solid: false });
    this.box(x0 - 0.5, y + H + 0.1, z0 - 0.5, x1 + 0.5, y + H + 0.45, z1 + 0.5, { color: '#6d7c8c', tex: 'metal', material: 'metal', hp: 600 });
    // sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshLambertMaterial({ map: textTexture('BENTON DIESEL', '#1d2a3a', '#ffb23f', 1024), transparent: true }));
    sign.position.set(p.x, y + H + 1.7, z0 - 0.3);
    sign.rotation.y = Math.PI;
    this.root.add(sign);
    this.box(p.x - 7, y + H + 0.45, z0 - 0.25, p.x + 7, y + H + 3, z0 - 0.15, { color: '#1d2a3a', solid: false });
    // mezzanine along the north wall + stairs
    const my = y + 0.1 + 3.4;
    this.box(x0 + 0.15, my - 0.25, z1 - 5, x1 - 0.15, my, z1 - 0.15, { color: '#6d7c8c', tex: 'metal', material: 'metal', hp: 500 });
    this.stairs(x1 - 2, z1 - 5 - 5, x1 - 0.15, z1 - 5, y + 0.1, my, 1, '#8fa3b8');
    this.wall(false, z1 - 5, x0 + 0.15, x1 - 2, my, 1.0, [], { ...stripe, thick: 0.15, hp: 150 });
    this.chest(p.x - 6, my, z1 - 2, Math.PI);
    this.chest(x0 + 1.5, y + 0.1, z0 + 2, 0);
    // trucks inside and out
    this.truck(p.x - 6.5, y + 0.1, p.z - 2, '#e8453c');
    this.truck(p.x + 6.5, y + 0.1, p.z - 3, '#3f7bff');
    this.truck(p.x + 2, y, z0 - 10, '#ffcf3f');
    // fuel pumps, tires
    for (let i = 0; i < 3; i++) {
      this.box(p.x - 8 + i * 5, y, z0 - 16, p.x - 7 + i * 5, y + 1.8, z0 - 15.2, { color: '#ff5b5b', material: 'metal', hp: 150, harvest: 8 });
    }
    for (const [tx, tz] of [[x0 - 3, z0 + 2], [x1 + 3, z1 - 3], [x0 - 4, z1 + 2]]) {
      for (let k = 0; k < 3; k++) {
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.25, 6, 12), mat('#2a2a2a'));
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tx, y + 0.25 + k * 0.45, tz);
        tire.castShadow = true;
        this.root.add(tire);
      }
      this.physics.add(new Collider({ minX: tx - 0.75, maxX: tx + 0.75, minZ: tz - 0.75, maxZ: tz + 0.75, minY: y, maxY: y + 1.4 }));
    }
    // office next door (2 stories)
    this.house(p.x - 2, p.z + 20, 9, 8, 2, { y, wall: '#f0e6d2', tex: 'brick', material: 'brick', roof: '#3f7bff', floor: '#b0916b' });
    for (let i = 0; i < 4; i++) this.lootSpots.push(new THREE.Vector3(p.x - 9 + i * 6, y + 0.15, p.z + 2));
    this.lootSpots.push(new THREE.Vector3(p.x + 4, my + 0.05, z1 - 2.5));
  }

  truck(x, y, z, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(2.4, 1.3, 5.6), mat(color, 'metal'));
    body.position.y = 1.15;
    const cab = new THREE.Mesh(boxGeo(2.3, 1.2, 2.0), mat(color, 'metal'));
    cab.position.set(0, 2.3, -1.6);
    const glass = new THREE.Mesh(boxGeo(2.2, 0.7, 0.05), mat('#9fe3ff', null, { emissive: '#1b4a5a' }));
    glass.position.set(0, 2.45, -2.62);
    g.add(body, cab, glass);
    for (const [wx, wz] of [[-1.25, -1.8], [1.25, -1.8], [-1.25, 1.8], [1.25, 1.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mat('#222222'));
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.5, wz);
      g.add(w);
    }
    g.position.set(x, y, z);
    g.traverse((m) => (m.castShadow = true));
    this.root.add(g);
    const c = new Collider({ minX: x - 1.25, maxX: x + 1.25, minZ: z - 2.8, maxZ: z + 2.8, minY: y, maxY: y + 1.8, mesh: g, hp: 500, maxHp: 500, material: 'metal', kind: 'prop', harvest: 12 });
    this.physics.add(c);
    const c2 = new Collider({ minX: x - 1.15, maxX: x + 1.15, minZ: z - 2.6, maxZ: z - 0.6, minY: y + 1.8, maxY: y + 2.9, mesh: null, hp: Infinity, kind: 'prop' });
    c.linked = [c2];
    this.physics.add(c2);
  }

  _buildPark() {
    const p = POIS[2];
    const y = p.h;
    this.exclude.push({ x: p.x - 8, z: p.z - 6, r: 16 });
    // giant pickle statue with a secret legendary chest on top
    const pk = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 8, 6, 12), mat('#5bbf3a', null, { flatShading: true }));
    body.position.y = 6.4;
    pk.add(body);
    for (let i = 0; i < 14; i++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), mat('#3f9a2a'));
      const a = i * 2.4, hh = 3 + (i % 7) * 1.1;
      bump.position.set(Math.cos(a) * 2.35, hh, Math.sin(a) * 2.35);
      pk.add(bump);
    }
    for (const sx of [-0.8, 0.8]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat('#ffffff'));
      eye.position.set(sx, 8.4, 2.2);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat('#111111'));
      pup.position.set(sx, 8.4, 2.6);
      pk.add(eye, pup);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 6, 12, Math.PI), mat('#1d3a12'));
    smile.rotation.z = Math.PI;
    smile.position.set(0, 7.4, 2.35);
    pk.add(smile);
    const px = p.x - 8, pz = p.z - 6;
    pk.position.set(px, y, pz);
    pk.traverse((m) => (m.castShadow = true));
    this.root.add(pk);
    this.physics.add(new Collider({ minX: px - 2, maxX: px + 2, minZ: pz - 2, maxZ: pz + 2, minY: y, maxY: y + 12.2, mesh: pk }));
    this.box(px - 1.6, y + 12.2, pz - 1.6, px + 1.6, y + 12.5, pz + 1.6, { color: '#3f9a2a' });
    this.chest(px, y + 12.5, pz, 0, true);
    // trampoline launch pad beside it
    this.pad(px + 6, y, pz + 4);
    // slide: platform + ramp
    const sx = p.x + 8, sz = p.z - 10;
    this.box(sx - 1.2, y, sz - 1.2, sx + 1.2, y + 3, sz + 1.2, { color: '#ff5ca8', tex: 'wood', material: 'wood', hp: 250 });
    this.stairs(sx - 1, sz + 1.2, sx + 1, sz + 7, y, y + 3, 3, '#3fd0ff');
    this.stairs(sx - 1.2 - 3, sz - 0.8, sx - 1.2, sz + 0.8, y, y + 3, 0, '#ffcf3f');
    // jungle gym
    const jx = p.x + 16, jz = p.z + 4;
    this.box(jx - 3, y + 2.2, jz - 3, jx + 3, y + 2.5, jz + 3, { color: '#ffcf3f', tex: 'wood', material: 'wood', hp: 300 });
    for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) this.box(jx + a - 0.15, y, jz + b - 0.15, jx + a + 0.15, y + 2.2, jz + b + 0.15, { color: '#e8453c' });
    this.stairs(jx - 1, jz - 3 - 3.5, jx + 1, jz - 3, y, y + 2.5, 1, '#e8453c');
    this.lootSpots.push(new THREE.Vector3(jx, y + 2.55, jz));
    // swings frame (visual + light cover)
    const swx = p.x - 4, swz = p.z + 12;
    this.box(swx - 4, y + 3, swz - 0.15, swx + 4, y + 3.3, swz + 0.15, { color: '#3f7bff' });
    for (const a of [-4, 4]) this.box(swx + a - 0.15, y, swz - 0.15, swx + a + 0.15, y + 3, swz + 0.15, { color: '#3f7bff' });
    for (const a of [-2, 1.5]) {
      const seat = new THREE.Mesh(boxGeo(0.8, 0.1, 0.4), mat('#e8453c'));
      const ropes = new THREE.Group();
      ropes.add(seat);
      seat.position.y = -2.2;
      ropes.position.set(swx + a, y + 3, swz);
      this.root.add(ropes);
      this.animated.push((t) => (ropes.rotation.x = Math.sin(t * 1.8 + a) * 0.35));
    }
    // restroom + pavilion
    this.house(p.x + 2, p.z + 24, 7, 6, 1, { y, wall: '#ffd6a5', tex: 'brick', material: 'brick', roof: '#7ed957' });
    const pvx = p.x - 18, pvz = p.z + 4;
    for (const [a, b] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) this.box(pvx + a - 0.2, y, pvz + b - 0.2, pvx + a + 0.2, y + 3, pvz + b + 0.2, { color: '#8a5a33', tex: 'wood', material: 'wood', hp: 200 });
    this.box(pvx - 4.6, y + 3, pvz - 3.6, pvx + 4.6, y + 3.3, pvz + 3.6, { color: '#d9a066', tex: 'wood', material: 'wood', hp: 300 });
    this.roof(pvx - 4.6, pvz - 3.6, pvx + 4.6, pvz + 3.6, y + 3.3, 2, '#e8453c');
    this.box(pvx - 2.5, y, pvz - 0.8, pvx + 2.5, y + 0.9, pvz + 0.8, { color: '#b5773b', tex: 'wood', material: 'wood', hp: 120, harvest: 6 });
    this.chest(pvx, y, pvz + 2.2, Math.PI);
    this.exclude.push({ x: pvx, z: pvz, r: 7 }, { x: jx, z: jz, r: 6 }, { x: sx, z: sz + 3, r: 6 }, { x: swx, z: swz, r: 6 }, { x: POND.x, z: POND.z, r: POND.r + 2 });
    for (let i = 0; i < 5; i++) this.lootSpots.push(new THREE.Vector3(p.x - 12 + i * 6, y + 0.1, p.z - 2 + (i % 2) * 6));
  }

  _buildHollow() {
    const p = POIS[3];
    const y = p.h;
    this.house(p.x, p.z + 4, 11, 10, 2, { y, wall: '#6d5a8a', tex: 'wood', material: 'wood', roof: '#2e2a45', floor: '#5a4a3a', furniture: '#8a3b5a' });
    // glowing windows / pumpkins
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 0.3, r = 14 + (i % 3) * 3;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r - 6;
      const pum = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), mat('#ff8a1a', null, { emissive: '#b04a00' }));
      pum.scale.y = 0.8;
      pum.position.set(x, this.hm.get(x, z) + 0.35, z);
      this.root.add(pum);
    }
    // graveyard with fence
    const gx = p.x - 4, gz = p.z - 14;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const x = gx - 6 + i * 4, z = gz - 3 + j * 3.5;
        this.box(x - 0.45, y, z - 0.15, x + 0.45, y + 1.1 + (i + j) % 2 * 0.3, z + 0.15, { color: '#9aa0b0', tex: 'brick', material: 'brick', hp: 100, harvest: 5 });
      }
    }
    this.wall(false, gz - 6, gx - 9, gx + 9, y, 1.1, [{ a: gx - 1, b: gx + 1, bottom: 0, top: 1.1 }], { color: '#3a3548', material: 'metal', hp: 120, thick: 0.12 });
    // the crypt: a hidden entrance on its north side, legendary chest inside
    const cx = p.x + 14, cz = p.z - 16;
    const stone = { color: '#7d7f95', tex: 'brick', material: 'brick', hp: 700 };
    this.box(cx - 3.5, y - 0.5, cz - 3, cx + 3.5, y + 0.1, cz + 3, { color: '#55566a' });
    this.wall(false, cz - 3, cx - 3.5, cx + 3.5, y + 0.1, 3, [], stone);
    this.wall(false, cz + 3, cx - 3.5, cx + 3.5, y + 0.1, 3, [{ a: cx + 1.8, b: cx + 3.0, bottom: 0, top: 2 }], stone);
    this.wall(true, cx - 3.5, cz - 3, cz + 3, y + 0.1, 3, [], stone);
    this.wall(true, cx + 3.5, cz - 3, cz + 3, y + 0.1, 3, [], stone);
    this.box(cx - 3.8, y + 3.1, cz - 3.3, cx + 3.8, y + 3.5, cz + 3.3, stone);
    this.chest(cx - 1.5, y + 0.1, cz - 1.5, 0, true);
    this.footprints.push({ x0: cx - 3.5, z0: cz - 3, x1: cx + 3.5, z1: cz + 3, color: '#55566a' });
    this.exclude.push({ x: cx, z: cz, r: 7 }, { x: gx, z: gz, r: 10 });
    // spooky dead trees
    for (let i = 0; i < 16; i++) {
      const a = this.rng() * Math.PI * 2, r = 10 + this.rng() * 22;
      this.tree(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 'dead', 0.9 + this.rng() * 0.5);
    }
    this.lootSpots.push(new THREE.Vector3(gx, y + 0.1, gz), new THREE.Vector3(p.x - 10, y + 0.1, p.z + 12));
  }

  _buildDepot() {
    const p = POIS[4];
    const y = p.h;
    const x0 = p.x - 10, x1 = p.x + 10, z0 = p.z - 7, z1 = p.z + 7;
    const H = 7.5;
    this.footprints.push({ x0, z0, x1, z1, color: '#ff5c7a' });
    this.exclude.push({ x: p.x, z: p.z, r: 28 });
    const m = { color: '#e9e3d6', tex: 'metal', material: 'metal' };
    this.box(x0 - 0.3, y - 3, z0 - 0.3, x1 + 0.3, y + 0.1, z1 + 0.3, { color: '#8d8d8d' });
    this.wall(false, z0, x0, x1, y + 0.1, H, [{ a: p.x - 3, b: p.x + 3, bottom: 0, top: 5 }], m);
    this.wall(false, z1, x0, x1, y + 0.1, H, [{ a: p.x - 1, b: p.x + 1, bottom: 0, top: 2.5 }], m);
    this.wall(true, x0, z0, z1, y + 0.1, H, [{ a: p.z - 1, b: p.z + 1, bottom: 0, top: 2.5 }], m);
    this.wall(true, x1, z0, z1, y + 0.1, H, [{ a: p.z - 2.5, b: p.z + 2.5, bottom: 1.5, top: 3 }], m);
    this.box(x0 - 0.5, y + H + 0.1, z0 - 0.5, x1 + 0.5, y + H + 0.45, z1 + 0.5, { color: '#ff5c7a', tex: 'metal', material: 'metal', hp: 600 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), new THREE.MeshLambertMaterial({ map: textTexture('BOOM CO.', '#ff5c7a', '#fff3d6', 1024) }));
    sign.position.set(p.x, y + 6, z0 - 0.2);
    sign.rotation.y = Math.PI;
    this.root.add(sign);
    // catwalk + stairs
    const cy = y + 0.1 + 3.6;
    this.box(x0 + 0.15, cy - 0.25, z0 + 0.15, x0 + 4, cy, z1 - 0.15, { color: '#8fa3b8', tex: 'metal', material: 'metal', hp: 450 });
    this.stairs(x0 + 4, z1 - 5.5, x0 + 6.2, z1 - 0.15, y + 0.1, cy, 2, '#8fa3b8');
    this.chest(x0 + 2, cy, p.z - 3, Math.PI / 2);
    this.chest(x1 - 2, y + 0.1, z1 - 2, Math.PI);
    // crate stacks inside
    for (const [a, b, s] of [[2, -2, 2], [5, 2, 1], [-2, 3, 1]]) {
      for (let k = 0; k < s; k++) this.box(p.x + a - 1, y + 0.1 + k * 2, p.z + b - 1, p.x + a + 1, y + 2.1 + k * 2, p.z + b + 1, { color: '#d9a066', tex: 'crate', material: 'wood', hp: 150, harvest: 10 });
    }
    // shipping containers yard
    const cols = ['#e8453c', '#3f7bff', '#ffcf3f', '#4fcf4a', '#b35cff'];
    for (let i = 0; i < 6; i++) {
      const cx = p.x - 14 + (i % 3) * 7.5, cz = z0 - 10 - Math.floor(i / 3) * 6;
      this.box(cx - 3, y, cz - 1.3, cx + 3, y + 2.6, cz + 1.3, { color: cols[i % 5], tex: 'metal', material: 'metal', hp: 600, harvest: 10 });
      if (i % 2 === 0) this.box(cx - 3, y + 2.6, cz - 1.3, cx + 3, y + 5.2, cz + 1.3, { color: cols[(i + 2) % 5], tex: 'metal', material: 'metal', hp: 600, harvest: 10 });
    }
    this.chest(p.x - 14, y + 5.2, z0 - 10, 0);
    // explosive Boom barrels
    for (const [a, b] of [[12, -9], [13, -8], [-13, 9], [0, 11], [14, 6]]) this.barrel(p.x + a, this.hm.get(p.x + a, p.z + b), p.z + b);
    this.house(p.x + 18, p.z + 16, 8, 6, 1, { y, wall: '#ffe066', tex: 'metal', material: 'metal', roof: '#ff5c7a' });
    for (let i = 0; i < 4; i++) this.lootSpots.push(new THREE.Vector3(p.x - 6 + i * 4, y + 0.15, p.z - 1));
    this.lootSpots.push(new THREE.Vector3(x0 + 2, cy + 0.05, p.z + 3));
  }

  barrel(x, y, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), mat('#e8453c'));
    b.position.y = 0.6;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.2, 12), mat('#ffcf3f', null, { emissive: '#553300' }));
    band.position.y = 0.7;
    g.add(b, band);
    g.position.set(x, y, z);
    g.traverse((m) => (m.castShadow = true));
    this.root.add(g);
    this.physics.add(new Collider({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, minY: y, maxY: y + 1.2, mesh: g, hp: 60, maxHp: 60, kind: 'barrel' }));
  }

  _cabin(m) {
    this.house(m.x, m.z, 8, 7, 1, { y: m.h, wall: ['#ffb4a2', '#a0d8ff', '#fff1a8', '#c8f7c5'][MINOR.indexOf(m)], tex: 'wood', material: 'wood', roof: '#e8453c' });
  }

  // ---------------------------------------------------------------- roads
  _buildRoads() {
    const P = Object.fromEntries(POIS.map((p) => [p.id, p]));
    const paths = [
      [P.garage, { x: -10, z: 92 }, P.park],
      [P.park, { x: 110, z: 8 }, P.depot],
      [P.depot, { x: 22, z: -100 }, P.hollow],
      [P.hollow, { x: -108, z: -6 }, P.garage],
      [{ x: 5, z: -24 }, { x: 22, z: -100 }],
      [{ x: -24, z: 4 }, { x: -108, z: -6 }],
      [{ x: 18, z: 18 }, P.park],
    ];
    const mRoad = new THREE.MeshLambertMaterial({ color: '#56565e', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const mLine = new THREE.MeshLambertMaterial({ color: '#ffe066', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    for (const path of paths) {
      // Catmull-Rom through the control points, sampled every ~2m
      const curve = new THREE.CatmullRomCurve3(path.map((q) => new THREE.Vector3(q.x, 0, q.z)));
      const len = curve.getLength();
      const pts = curve.getSpacedPoints(Math.ceil(len / 2));
      this.roads.push(pts);
      const make = (width, lift, material, dash) => {
        const pos = [], idx = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
          const nx = -tz / l, nz = tx / l;
          for (let s = -1; s <= 1; s++) {
            const x = pts[i].x + nx * s * width, z = pts[i].z + nz * s * width;
            pos.push(x, Math.max(this.hm.get(x, z), WATER_Y + 0.05) + lift, z);
          }
          if (i > 0 && (!dash || i % 3 !== 0)) {
            const o = (i - 1) * 3;
            idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, material);
        mesh.receiveShadow = true;
        this.root.add(mesh);
      };
      make(3, 0.08, mRoad, false);
      make(0.18, 0.1, mLine, true);
    }
  }

  onRoad(x, z, pad = 4) {
    for (const pts of this.roads) {
      for (let i = 0; i < pts.length; i += 2) if (Math.abs(pts[i].x - x) < pad && Math.abs(pts[i].z - z) < pad) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- nature
  _scatterNature() {
    const rng = this.rng;
    const blocked = (x, z, extra = 0) => this.exclude.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + extra) || this.onRoad(x, z);
    let tries = 0;
    while ((this._trees?.length || 0) < 230 && tries++ < 5000) {
      const x = (rng() - 0.5) * 290, z = (rng() - 0.5) * 290;
      const h = this.hm.get(x, z);
      if (h < 1.8 || blocked(x, z, 2)) continue;
      const hol = Math.hypot(x - POIS[3].x, z - POIS[3].z) < 45;
      this.tree(x, z, hol ? 'dead' : rng() < 0.45 ? 'pine' : 'round', 0.8 + rng() * 0.6);
    }
    this._placeTrees();
    const rocks = [];
    tries = 0;
    while (rocks.length < 55 && tries++ < 3000) {
      const x = (rng() - 0.5) * 290, z = (rng() - 0.5) * 290;
      const h = this.hm.get(x, z);
      if (h < 0.5 || blocked(x, z, 2)) continue;
      rocks.push({ x, z, y: h, s: 0.8 + rng() * 1.6 });
    }
    const rg = new THREE.IcosahedronGeometry(1, 0);
    const rm = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial({ color: '#a7a9b4', flatShading: true }), rocks.length);
    const o = new THREE.Object3D();
    rocks.forEach((r, i) => {
      o.position.set(r.x, r.y + r.s * 0.4, r.z);
      o.rotation.set(rng(), rng() * 6, rng());
      o.scale.set(r.s * 1.3, r.s, r.s * 1.1);
      o.updateMatrix();
      rm.setMatrixAt(i, o.matrix);
      const c = new Collider({ minX: r.x - r.s, maxX: r.x + r.s, minZ: r.z - r.s * 0.9, maxZ: r.z + r.s * 0.9, minY: r.y - 0.5, maxY: r.y + r.s * 1.2, hp: 200 + r.s * 100, kind: 'rock', material: 'brick', harvest: 12 });
      c.maxHp = c.hp;
      c.inst = [{ mesh: rm, index: i }];
      this.physics.add(c);
    });
    rm.castShadow = rm.receiveShadow = true;
    this.root.add(rm);
    // loose floor loot around the island
    for (let i = 0; i < 16; i++) {
      const x = (rng() - 0.5) * 240, z = (rng() - 0.5) * 240;
      const h = this.hm.get(x, z);
      if (h > 1.5) this.lootSpots.push(new THREE.Vector3(x, h + 0.1, z));
    }
  }

  _placeTrees() {
    const T = this._trees;
    const kinds = { round: [], pine: [], dead: [] };
    for (const t of T) kinds[t.kind].push(t);
    const o = new THREE.Object3D();
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#8a5a33' });
    const deadMat = new THREE.MeshLambertMaterial({ color: '#4a3b4f' });
    const foliage = {
      round: [new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true })],
      pine: [new THREE.ConeGeometry(2.4, 5.5, 7), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true })],
      dead: [new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true })],
    };
    const palette = { round: ['#57c84d', '#6fd35a', '#3fb24a', '#8ad957'], pine: ['#2f9a5a', '#3aa865', '#248a4e'], dead: ['#7a4fa0', '#5d3f80', '#9b5fc0'] };
    const col = new THREE.Color();
    for (const kind of Object.keys(kinds)) {
      const list = kinds[kind];
      if (!list.length) continue;
      const trunks = new THREE.InstancedMesh(trunkGeo, kind === 'dead' ? deadMat : trunkMat, list.length);
      const leaves = new THREE.InstancedMesh(foliage[kind][0], foliage[kind][1], list.length);
      list.forEach((t, i) => {
        const th = (kind === 'pine' ? 3 : kind === 'dead' ? 5 : 3.6) * t.scale;
        o.position.set(t.x, t.y - 0.2, t.z);
        o.rotation.set(0, this.rng() * 6, kind === 'dead' ? (this.rng() - 0.5) * 0.3 : 0);
        o.scale.set(t.scale, th, t.scale);
        o.updateMatrix();
        trunks.setMatrixAt(i, o.matrix);
        o.position.y = t.y + th + (kind === 'pine' ? 2.2 : 1.2) * t.scale;
        o.scale.setScalar(t.scale);
        o.updateMatrix();
        leaves.setMatrixAt(i, o.matrix);
        col.set(palette[kind][i % palette[kind].length]);
        leaves.setColorAt(i, col);
        const r = 0.45 * t.scale;
        const c = new Collider({ minX: t.x - r, maxX: t.x + r, minZ: t.z - r, maxZ: t.z + r, minY: t.y - 0.5, maxY: t.y + th + 3 * t.scale, hp: 250 * t.scale, kind: 'tree', material: 'wood', harvest: 12 });
        c.maxHp = c.hp;
        c.inst = [{ mesh: trunks, index: i }, { mesh: leaves, index: i }];
        this.physics.add(c);
      });
      trunks.castShadow = leaves.castShadow = true;
      trunks.receiveShadow = leaves.receiveShadow = true;
      this.root.add(trunks, leaves);
    }
  }

  // ---------------------------------------------------------------- runtime
  /** Removes a destroyed collider's visuals. Returns the collider for chaining. */
  destroyCollider(c) {
    if (!c.alive) return c;
    this.physics.remove(c);
    if (c.linked) for (const l of c.linked) this.physics.remove(l);
    if (c.inst) {
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const { mesh, index } of c.inst) {
        mesh.setMatrixAt(index, zero);
        mesh.instanceMatrix.needsUpdate = true;
      }
    } else if (c.mesh) {
      c.mesh.parent?.remove(c.mesh);
    }
    if (c.kind === 'barrel') this.onBarrel?.(c);
    return c;
  }

  update(dt, t) {
    for (const fn of this.animated) fn(t);
    for (const ch of this.chests) {
      if (ch.opened) continue;
      ch.lid.position.y = 0.66 + Math.sin(t * 4 + ch.t) * 0.03;
    }
  }

  _renderMap() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const half = ISLAND_SIZE / 2;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = -half + (i / S) * ISLAND_SIZE, z = -half + (j / S) * ISLAND_SIZE;
        const h = this.hm.get(x, z);
        let r, gg, b;
        if (h < WATER_Y) { const d = Math.min(1, -h / 6); r = 70 - d * 30; gg = 190 - d * 50; b = 235 - d * 20; }
        else if (h < 1.4) { r = 240; gg = 220; b = 160; }
        else { const s = Math.min(1, h / 28); r = 100 - s * 20 + 0; gg = 190 - s * 40; b = 80 - s * 20; }
        if (h >= WATER_Y && Math.hypot(x - POIS[3].x, z - POIS[3].z) < 36) { r = r * 0.6 + 50; gg = gg * 0.5 + 30; b = b * 0.6 + 70; }
        const k = (j * S + i) * 4;
        img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tm = (x) => ((x + half) / ISLAND_SIZE) * S;
    g.strokeStyle = '#5a5a62';
    g.lineWidth = 3;
    for (const pts of this.roads) {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(tm(p.x), tm(p.z)) : g.moveTo(tm(p.x), tm(p.z))));
      g.stroke();
    }
    for (const f of this.footprints) {
      g.fillStyle = f.color;
      g.fillRect(tm(f.x0), tm(f.z0), tm(f.x1) - tm(f.x0), tm(f.z1) - tm(f.z0));
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.strokeRect(tm(f.x0), tm(f.z0), tm(f.x1) - tm(f.x0), tm(f.z1) - tm(f.z0));
    }
    return c;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    this.terrainMesh.geometry.dispose();
  }
}

export function textTexture(text, bg, fg, w = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round(w / 5.5);
  if (text.length <= 3) c.height = Math.round(w * 0.58);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.font = `900 ${Math.round(c.height * 0.62)}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
