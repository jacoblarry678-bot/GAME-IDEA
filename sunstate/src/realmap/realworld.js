/**
 * RealWorld: the real Miami, streamed. Same interface the game uses on the old World
 * (ground, isWater, surface, interiorAt, collision, update, …), backed by the packs in
 * public/map.
 *
 * Sub-tiles (500 m) are built in a Web Worker (tileworker.js): fetching, decoding, geometry,
 * rasters and minimap images all happen off the main thread. The main thread only uploads
 * the finished arrays, a little each frame. Colliders exist only near the player and only
 * nearby tiles cast shadows, so the far city costs draw calls and nothing else.
 */
import * as THREE from 'three';
import { CollisionWorld } from '../world/collision.js';
import { makeMaterials, buildWater, facadeMaterial } from '../world/build.js';
import * as T from '../world/textures.js';
import { loadIndex, loadPack, mapBase } from './data.js';
import { buildTileData, meshesFromArrays, SURF, RASTER } from './tilemesh.js';
import TileWorker from './tileworker.js?worker&inline';
import { RoadNet } from './roadnet.js';

export const WATER_Y = -0.45;
const SEABED = -3.5;
const SURF_NAME = ['water', 'grass', 'grass', 'sand', 'asphalt', 'concrete', 'concrete', 'grass', 'wood'];
const DETAIL = { low: 380, medium: 500, high: 650, ultra: 850 };
const COLLIDE_R = 260, SHADOW_R = 220, IN_FLIGHT = 3;
const COLLIDERS_PER_FRAME = 700; // walls added per frame as tiles come into range (no spikes)

// the Art Deco district: Ocean Dr / Collins / Washington between 5th and 23rd St (game metres)
const DECO = { x0: 5600, x1: 7000, z0: -2600, z1: 300 };

export class RealWorld {
  /** Create the world; `mats` can be shared with the classic world (no second texture bake). */
  static async create(engine, { mats = null } = {}) {
    const w = new RealWorld(engine, mats);
    await w.start();
    return w;
  }

  constructor(engine, mats) {
    this.engine = engine;
    this.real = true;
    this.collision = new CollisionWorld();
    this.mats = mats || makeMaterials(engine);
    this.extraMats = new Map();
    this.group = new THREE.Group();
    this.group.name = 'realmap';
    engine.scene.add(this.group);
    this.tiles = new Map(); // key → tile record (see integrate)
    this.pending = new Map(); // key → requested at
    this.results = [];
    this.deckCells = new Map();
    this.waterY = WATER_Y;
    this.water = buildWater(engine, { depth: null, size: 4000 });
    this.water.position.y = WATER_Y;
    engine.scene.add(this.water);
    this.signs = []; this.places = {}; this.interiors = [];
    this.signalClock = 0; this.clubPulse = 0;
    this.facades = Object.entries(this.mats).filter(([k]) => k.startsWith('fac:')).map(([, m]) => m);
    this.roads = new RoadNet(this); // the drivable network around you (traffic, police, GPS)
    this.focus = new THREE.Vector3(6330, 0, -700);
    this.radius = DETAIL[engine.settings?.g?.drawDistance] || 750;
    this._lod = 0;
  }

  async start() {
    try {
      this.worker = new TileWorker();
      this.worker.onmessage = (e) => this.onWorker(e.data);
      this.worker.onerror = (e) => { console.warn('map worker failed, building on the main thread', e.message); this.worker = null; };
      this.index = await new Promise((res, rej) => {
        this._ready = (m) => (m.error ? rej(new Error(m.error)) : res(m.index));
        this.worker.postMessage({ type: 'init', base: mapBase(), deco: DECO, facadeTile: T.FACADE_TILE });
      });
    } catch (err) {
      console.warn('map worker unavailable:', err.message || err);
      this.worker = null;
      this.index = await loadIndex();
    }
    this.roads.start(this.index, mapBase()); // (loads in the background)
  }

  onWorker(m) {
    if (m.type === 'ready') return this._ready?.(m);
    if (m.type === 'tile') { this.pending.delete(m.key); this.results.push(m); }
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
      case 'slab': mat = m.curb.clone(); mat.vertexColors = true; break;
      case 'trim': mat = m.trim; break;
      case 'metal': mat = m.metal; break;
      default:
        if (key.startsWith('fac:') && !m[key]) { mat = facadeMaterial(key.slice(4)); this.facades.push(mat); }
        else mat = m[key] || m.concrete;
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

  tileCenter(key) {
    const [i, j, u, v] = key.split('_').map(Number), S = this.index.sub;
    return [i * this.index.pack + (u + 0.5) * S, j * this.index.pack + (v + 0.5) * S];
  }

  /** Sub-tiles to have built around (fx, fz), nearest first; skips tiles with no pack. */
  wanted(fx, fz, R) {
    const S = this.index.sub, out = [];
    const s0x = Math.floor((fx - R) / S), s1x = Math.floor((fx + R) / S), s0z = Math.floor((fz - R) / S), s1z = Math.floor((fz + R) / S);
    for (let sx = s0x; sx <= s1x; sx++) for (let sz = s0z; sz <= s1z; sz++) {
      const cx = (sx + 0.5) * S, cz = (sz + 0.5) * S;
      const d = Math.max(0, Math.hypot(cx - fx, cz - fz) - S * 0.71);
      if (d > R) continue;
      const k = this.subKey(cx, cz);
      if (!this.index.packs[`${k.i}_${k.j}`]) continue;
      out.push({ ...k, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  request(w) {
    this.pending.set(w.key, performance.now());
    if (this.worker) { this.worker.postMessage({ type: 'build', key: w.key, i: w.i, j: w.j, u: w.u, v: w.v }); return; }
    // no worker: build here (slower, but still nearest first and one at a time)
    loadPack(this.index, w.i, w.j).then((pack) => {
      const tile = pack?.tiles.get(`${w.u}_${w.v}`);
      this.pending.delete(w.key);
      if (!tile) { this.results.push({ key: w.key, empty: true }); return; }
      const deco = (x, z) => x > DECO.x0 && x < DECO.x1 && z > DECO.z0 && z < DECO.z1;
      this.results.push({ key: w.key, ...buildTileData(tile, this.index, { deco, FACADE_TILE: T.FACADE_TILE }) });
    });
  }

  /** Put a finished tile into the scene (geometry upload, deck index; colliders come later). */
  integrate(m) {
    const [cx, cz] = this.tileCenter(m.key);
    const f = this.focus;
    // dropped while it was being built
    if (Math.hypot(cx - f.x, cz - f.z) - this.index.sub * 0.71 > this.radius + 350) return;
    const rec = { key: m.key, cx, cz, group: null, colliderDefs: m.colliders || [], colliders: null, raster: m.raster || null, decks: m.decks || [], places: m.places || [], roads: m.roads || [], mini: m.mini || null, shadows: false };
    if (m.error) console.warn('map tile', m.key, m.error);
    if (m.bins && m.bins.length) {
      const g = new THREE.Group();
      g.name = 'tile ' + m.key;
      const near = Math.hypot(cx - f.x, cz - f.z) < SHADOW_R;
      for (const mesh of meshesFromArrays(m.bins, (k) => this.material(k), near)) g.add(mesh);
      rec.shadows = near;
      this.group.add(g);
      rec.group = g;
    }
    for (const d of rec.decks) this.indexDeck(d, m.key);
    this.tiles.set(m.key, rec);
  }

  dropTile(key) {
    const rec = this.tiles.get(key);
    if (!rec) return;
    if (rec.group) {
      this.group.remove(rec.group);
      rec.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    this.setColliders(rec, false);
    rec.mini?.close?.();
    for (const [ck, list] of this.deckCells) {
      const keep = list.filter((s) => s.tile !== key);
      if (keep.length !== list.length) { if (keep.length) this.deckCells.set(ck, keep); else this.deckCells.delete(ck); }
    }
    this.tiles.delete(key);
  }

  /** Add (a budgeted slice of) a tile's colliders, or remove them all. Returns colliders added. */
  setColliders(rec, on, budget = Infinity) {
    if (on) {
      if (!rec.colliders) rec.colliders = [];
      const defs = rec.colliderDefs;
      let n = 0;
      while (rec.colliders.length < defs.length && n < budget) { rec.colliders.push(this.collision.add(defs[rec.colliders.length])); n++; }
      return n;
    }
    if (rec.colliders) { for (const c of rec.colliders) this.collision.remove(c); rec.colliders = null; }
    return 0;
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

  /** One streaming step: request nearby tiles, integrate finished ones within a budget, drop far ones. */
  stream(budgetMs = 4) {
    const f = this.focus, R = this.radius;
    const want = this.wanted(f.x, f.z, R);
    for (const w of want) {
      if (this.pending.size >= IN_FLIGHT) break;
      if (!this.tiles.has(w.key) && !this.pending.has(w.key)) this.request(w);
    }
    const t0 = performance.now();
    while (this.results.length && performance.now() - t0 < budgetMs) {
      // integrate the nearest finished tile first
      let bi = 0, bd = Infinity;
      this.results.forEach((r, i) => { const [cx, cz] = this.tileCenter(r.key); const d = Math.hypot(cx - f.x, cz - f.z); if (d < bd) { bd = d; bi = i; } });
      this.integrate(this.results.splice(bi, 1)[0]);
    }
    // colliders near the player (nearest tiles first, a slice per frame), shadows from nearby
    // tiles; drop what is far behind
    const keepR = R + 350;
    let budget = COLLIDERS_PER_FRAME;
    const recs = [...this.tiles.values()].map((rec) => [rec, Math.hypot(rec.cx - f.x, rec.cz - f.z) - this.index.sub * 0.71]).sort((a, b) => a[1] - b[1]);
    for (const [rec, d] of recs) {
      if (d > keepR) { this.dropTile(rec.key); continue; }
      if (d < COLLIDE_R) budget -= this.setColliders(rec, true, Math.max(0, budget));
      else if (d > COLLIDE_R + 120) this.setColliders(rec, false);
      const sh = d < SHADOW_R - this.index.sub * 0.3;
      if (rec.group && sh !== rec.shadows) { rec.shadows = sh; for (const m of rec.group.children) m.castShadow = sh && m.userData.caster; }
    }
  }

  /** Stream everything near (x, z) before play starts there (async: the page stays responsive). */
  async ready(x, z, r = 300, onProgress = null) {
    this.focus.set(x, 0, z);
    for (let guard = 0; guard < 3000; guard++) {
      this.stream(30);
      const want = this.wanted(x, z, r);
      const missing = want.filter((w) => !this.tiles.has(w.key)).length;
      onProgress?.(1 - missing / Math.max(1, want.length));
      if (!missing) { for (const rec of this.tiles.values()) this.setColliders(rec, Math.hypot(rec.cx - x, rec.cz - z) - this.index.sub * 0.71 < COLLIDE_R); return; }
      await new Promise((res) => setTimeout(res, 16));
    }
  }

  // ---------------------------------------------------------------------------------------
  // queries

  rasterAt(x, z) {
    const k = this.subKey(x, z);
    const rec = this.tiles.get(k.key);
    if (!rec) return -1; // not built yet
    const r = rec.raster;
    if (!r) return SURF.water; // a tile with no data at all is open water
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
    const rec = this.tiles.get(this.subKey(x, z).key);
    if (!rec) return null;
    let best = null, bd = 1e9;
    for (const r of rec.roads) {
      const n = r.pts.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], dx = r.pts[i * 2 + 2] - ax, dz = r.pts[i * 2 + 3] - az;
        const L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (d < r.half + 3 && d < bd) { bd = d; best = r; }
      }
    }
    return best;
  }

  interiorAt() { return null; }
  get signalTime() { return this.signalClock; }
  breakProp() {}
  restoreProps() {}
  placeInteriorLight() {}

  /** Show or hide everything this world put in the scene (when switching maps). */
  setVisible(v) { this.group.visible = v; this.water.visible = v; }

  update(dt) {
    this.signalClock += dt;
    const cam = this.engine.camera.position;
    this.focus.copy(cam);
    this.radius = DETAIL[this.engine.settings?.g?.drawDistance] || this.radius;
    this.stream(this.engine.externalClock ? 50 : 4);
    this.roads.update(cam.x, cam.z);
    // the sea follows the camera (its shader works in world space, so it never swims)
    this.water.position.x = Math.round(cam.x / 64) * 64;
    this.water.position.z = Math.round(cam.z / 64) * 64;
    this.water.userData.update(dt);
    const night = this.engine.time.night;
    for (const m of this.facades) m.emissiveIntensity = night * 1.15;
  }
}
