/**
 * RealWorld: the real Miami, streamed. Same interface the game uses on the old World
 * (ground, isWater, surface, interiorAt, collision, update, …), backed by the packs in
 * public/map. Sub-tiles (500 m) within the detail radius are built a few per frame, with a
 * time budget, nearest first; tiles that fall out of range are dropped with their colliders.
 */
import * as THREE from 'three';
import { CollisionWorld } from '../world/collision.js';
import { makeMaterials, buildWater } from '../world/build.js';
import * as T from '../world/textures.js';
import { loadIndex, loadPack, dropPack } from './data.js';
import { buildTile, SURF, RASTER } from './tilemesh.js';

export const WATER_Y = -0.45;
const SEABED = -3.5;
const SURF_NAME = ['water', 'grass', 'grass', 'sand', 'asphalt', 'concrete', 'concrete', 'grass', 'wood'];
const DETAIL = { low: 450, medium: 600, high: 800, ultra: 1000 };

// the Art Deco district: Ocean Dr / Collins / Washington between 5th and 23rd St (game metres)
const DECO = { x0: 5600, x1: 7000, z0: -2600, z1: 300 };

const MINI = [[26, 90, 114], [217, 210, 195], [143, 179, 106], [239, 220, 174], [58, 61, 68], [232, 228, 220], [158, 148, 131], [130, 172, 96], [176, 138, 90]];
/** A minimap image of a tile: one pixel per 2 m surface cell. */
function miniCanvas(r) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(r.N, r.N) : Object.assign(document.createElement('canvas'), { width: r.N, height: r.N });
  const x = c.getContext('2d'), img = x.createImageData(r.N, r.N), d = img.data;
  for (let i = 0; i < r.codes.length; i++) { const k = MINI[r.codes[i]] || MINI[1]; d[i * 4] = k[0]; d[i * 4 + 1] = k[1]; d[i * 4 + 2] = k[2]; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}

export class RealWorld {
  static async create(engine) {
    const index = await loadIndex();
    return new RealWorld(engine, index);
  }

  constructor(engine, index) {
    this.engine = engine;
    this.index = index;
    this.real = true;
    this.collision = new CollisionWorld();
    this.mats = makeMaterials(engine);
    this.extraMats = new Map();
    this.group = new THREE.Group();
    this.group.name = 'realmap';
    engine.scene.add(this.group);
    this.tiles = new Map(); // "i_j_u_v" → { state, mesh group, colliders, raster, decks }
    this.packs = new Map(); // "i_j" → decoded pack | 'loading'
    this.queue = [];
    this.deckCells = new Map(); // 32 m cells → raised road segments
    this.waterY = WATER_Y;
    this.water = buildWater(engine, { depth: null, size: 4000 });
    this.water.position.y = WATER_Y;
    engine.scene.add(this.water);
    this.signs = [];
    this.places = {};
    this.interiors = [];
    this.signalClock = 0;
    this.clubPulse = 0;
    this.facades = Object.entries(this.mats).filter(([k]) => k.startsWith('fac:')).map(([, m]) => m);
    this.focus = new THREE.Vector3(6386, 0, -708);
    this.radius = DETAIL[engine.settings?.g?.drawDistance] || 800;
    this._t = 0;
  }

  /** Material for a bin key from the tile builder. */
  material(key) {
    if (this.extraMats.has(key)) return this.extraMats.get(key);
    const m = this.mats;
    let mat;
    switch (key) {
      case 'roof': mat = m.roof.clone(); mat.vertexColors = true; break;
      case 'grass:tint': mat = m.grass.clone(); mat.vertexColors = true; break;
      case 'deck': mat = m.curb; break;
      case 'pier': case 'wood': mat = m.wood; break;
      case 'lot': mat = m.lot; break;
      default: mat = m[key] || m.concrete;
    }
    this.extraMats.set(key, mat);
    return mat;
  }

  // ---------------------------------------------------------------------------------------
  // streaming

  subKey(x, z) {
    const S = this.index.sub, P = this.index.pack;
    const i = Math.floor(x / P), j = Math.floor(z / P);
    const u = Math.floor((x - i * P) / S), v = Math.floor((z - j * P) / S);
    return { i, j, u, v, key: `${i}_${j}_${u}_${v}` };
  }

  ensurePack(i, j) {
    const k = `${i}_${j}`;
    if (this.packs.has(k)) return this.packs.get(k);
    if (!this.index.packs[k]) { this.packs.set(k, null); return null; }
    this.packs.set(k, 'loading');
    loadPack(this.index, i, j).then((p) => { this.packs.set(k, p); }, (e) => { console.warn('map pack', k, e); this.packs.set(k, null); });
    return 'loading';
  }

  /** Which sub-tiles should be built around the focus, nearest first. */
  wanted(fx, fz, R) {
    const S = this.index.sub, out = [];
    const s0x = Math.floor((fx - R) / S), s1x = Math.floor((fx + R) / S), s0z = Math.floor((fz - R) / S), s1z = Math.floor((fz + R) / S);
    for (let sx = s0x; sx <= s1x; sx++) for (let sz = s0z; sz <= s1z; sz++) {
      const cx = (sx + 0.5) * S, cz = (sz + 0.5) * S;
      const d = Math.max(0, Math.hypot(cx - fx, cz - fz) - S * 0.71);
      if (d > R) continue;
      const k = this.subKey(cx, cz);
      out.push({ ...k, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  buildOne(w) {
    const pack = this.packs.get(`${w.i}_${w.j}`);
    const tileData = pack?.tiles.get(`${w.u}_${w.v}`);
    const rec = { state: 'built', group: null, colliders: [], raster: null, decks: [], places: [], roads: [] };
    if (tileData) {
      const deco = (x, z) => x > DECO.x0 && x < DECO.x1 && z > DECO.z0 && z < DECO.z1;
      const built = buildTile(tileData, this.index, (k) => this.material(k), { deco, FACADE_TILE: T.FACADE_TILE });
      const g = new THREE.Group();
      g.name = 'tile ' + w.key;
      for (const m of built.meshes) g.add(m);
      this.group.add(g);
      rec.group = g;
      for (const c of built.colliders) rec.colliders.push(this.collision.add(c));
      rec.raster = built.raster;
      rec.mini = miniCanvas(built.raster);
      rec.decks = built.decks;
      rec.places = built.places;
      rec.roads = built.roads;
      for (const d of rec.decks) this.indexDeck(d, w.key);
    }
    this.tiles.set(w.key, rec);
  }

  dropTile(key) {
    const rec = this.tiles.get(key);
    if (!rec) return;
    if (rec.group) {
      this.group.remove(rec.group);
      rec.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    for (const c of rec.colliders) this.collision.remove(c);
    for (const [ck, list] of this.deckCells) {
      const keep = list.filter((s) => s.tile !== key);
      if (keep.length !== list.length) { if (keep.length) this.deckCells.set(ck, keep); else this.deckCells.delete(ck); }
    }
    this.tiles.delete(key);
  }

  indexDeck(d, tile) {
    const n = d.pts.length / 2;
    for (let i = 0; i < n - 1; i++) {
      const s = { ax: d.pts[i * 2], az: d.pts[i * 2 + 1], bx: d.pts[i * 2 + 2], bz: d.pts[i * 2 + 3], ha: d.hts[i], hb: d.hts[i + 1], half: d.half, tile };
      const x0 = Math.floor((Math.min(s.ax, s.bx) - s.half) / 32), x1 = Math.floor((Math.max(s.ax, s.bx) + s.half) / 32);
      const z0 = Math.floor((Math.min(s.az, s.bz) - s.half) / 32), z1 = Math.floor((Math.max(s.az, s.bz) + s.half) / 32);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const k = cx * 100003 + cz;
        let l = this.deckCells.get(k);
        if (!l) { l = []; this.deckCells.set(k, l); }
        l.push(s);
      }
    }
  }

  /** Step the streamer: request packs, build within a time budget, drop far tiles. */
  stream(budgetMs = 6) {
    const f = this.focus, R = this.radius;
    const want = this.wanted(f.x, f.z, R);
    const t0 = performance.now();
    for (const w of want) {
      if (this.tiles.has(w.key)) continue;
      const p = this.ensurePack(w.i, w.j);
      if (p === 'loading') continue;
      this.buildOne(w);
      if (performance.now() - t0 > budgetMs) break;
    }
    // drop tiles well outside the radius, and packs nobody needs
    const keepR = R + 350, S = this.index.sub;
    for (const key of [...this.tiles.keys()]) {
      const [i, j, u, v] = key.split('_').map(Number);
      const cx = i * this.index.pack + (u + 0.5) * S, cz = j * this.index.pack + (v + 0.5) * S;
      if (Math.hypot(cx - f.x, cz - f.z) - S * 0.71 > keepR) this.dropTile(key);
    }
    for (const [k, p] of this.packs) {
      if (p === 'loading' || p === null) continue;
      const [i, j] = k.split('_').map(Number);
      const cx = (i + 0.5) * this.index.pack, cz = (j + 0.5) * this.index.pack;
      if (Math.hypot(cx - f.x, cz - f.z) > keepR + this.index.pack) { this.packs.delete(k); dropPack(i, j); }
    }
  }

  /** Load and build everything near (x, z) before play starts there. */
  async ready(x, z, r = 350) {
    this.focus.set(x, 0, z);
    for (let guard = 0; guard < 400; guard++) {
      const want = this.wanted(x, z, r);
      const missing = want.filter((w) => !this.tiles.has(w.key));
      if (!missing.length) return;
      for (const w of missing) this.ensurePack(w.i, w.j);
      if (missing.some((w) => this.packs.get(`${w.i}_${w.j}`) === 'loading')) await new Promise((res) => setTimeout(res, 30));
      for (const w of missing) if (this.packs.get(`${w.i}_${w.j}`) !== 'loading' && !this.tiles.has(w.key)) this.buildOne(w);
    }
  }

  // ---------------------------------------------------------------------------------------
  // queries

  rasterAt(x, z) {
    const k = this.subKey(x, z);
    const rec = this.tiles.get(k.key);
    if (!rec || !rec.raster) return rec ? SURF.water : -1; // -1: not built yet
    const r = rec.raster;
    const cx = Math.floor((x - r.x0) / RASTER), cz = Math.floor((z - r.z0) / RASTER);
    if (cx < 0 || cz < 0 || cx >= r.N || cz >= r.N) return SURF.land;
    return r.codes[cz * r.N + cx];
  }

  deckAt(x, z, y) {
    const l = this.deckCells.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32));
    if (!l) return null;
    let best = null;
    for (const s of l) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
      const px = s.ax + dx * t - x, pz = s.az + dz * t - z;
      if (px * px + pz * pz > s.half * s.half) continue;
      const h = s.ha + (s.hb - s.ha) * t + 0.03;
      if (y >= h - 1.2 && (best === null || h > best)) best = h;
    }
    return best;
  }

  terrain(x, z) {
    const c = this.rasterAt(x, z);
    if (c === SURF.water) return SEABED;
    if (c === SURF.walk) return 0.16;
    if (c === SURF.wood) return 0.6;
    if (c === SURF.road) return 0.03;
    return 0;
  }

  ground(x, z, y = 100) {
    const t = this.terrain(x, z);
    const d = this.deckAt(x, z, y);
    return d !== null ? Math.max(d, t) : t;
  }

  isWater(x, z) { return this.rasterAt(x, z) === SURF.water && this.deckAt(x, z, 100) === null; }

  surface(x, z, y = 100) {
    const d = this.deckAt(x, z, y);
    if (d !== null && y > d - 0.5) return 'asphalt';
    const c = this.rasterAt(x, z);
    return c < 0 ? 'concrete' : SURF_NAME[c] || 'concrete';
  }

  /** The named road at a point, if any (for the HUD). */
  roadAt(x, z) {
    const k = this.subKey(x, z);
    const keys = [k.key];
    let best = null, bd = 1e9;
    for (const key of keys) {
      const rec = this.tiles.get(key);
      if (!rec) continue;
      for (const r of rec.roads) {
        const n = r.pts.length / 2;
        for (let i = 0; i < n - 1; i++) {
          const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], dx = r.pts[i * 2 + 2] - ax, dz = r.pts[i * 2 + 3] - az;
          const L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
          const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
          if (d < r.half + 3 && d < bd) { bd = d; best = r; }
        }
      }
    }
    return best;
  }

  interiorAt() { return null; }
  get signalTime() { return this.signalClock; }
  breakProp() {}
  restoreProps() {}
  placeInteriorLight() {}

  update(dt) {
    this.signalClock += dt;
    const cam = this.engine.camera.position;
    this.focus.copy(cam);
    this._t += dt;
    this.stream(this.engine.externalClock ? 50 : 6);
    // the sea follows the camera (its shader works in world space, so it never swims)
    this.water.position.x = Math.round(cam.x / 64) * 64;
    this.water.position.z = Math.round(cam.z / 64) * 64;
    this.water.userData.update(dt);
    const night = this.engine.time.night;
    for (const m of this.facades) m.emissiveIntensity = night * 1.15;
  }
}
