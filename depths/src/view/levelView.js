/**
 * Level view: builds the meshes for a Level (rooms, walls with door frames,
 * floors, ceilings, light fixtures, props, doors, refuge furniture, pickups,
 * records, panels, survey stations, signage and the camera's hidden layer)
 * and keeps the dynamic pieces in sync with the simulation each frame.
 */
import * as THREE from 'three';
import { Batcher, PropBuilder, boxGeo, placement } from './geom.js';
import { mat, KITS, SURFACE_FLOOR, texScale } from './materials.js';
import { BUILD, propDims } from './propMeshes.js';
import { WALL_T } from '../sim/level.js';
import { artTexture, symbolSign, clockFace } from './art.js';
import { textTexture } from './textures.js';
import { available } from '../sim/interact.js';
import { PROP_KINDS } from '../data/props.js';

export const HIDDEN_LAYER = 1;
const SIGN_COLORS = { red: '#a83228', blue: '#2a4e88', green: '#3a7a42' };

export class LevelView {
  constructor(engine, game, opts = {}) {
    this.engine = engine;
    this.game = game;
    this.level = game.level;
    this.root = new THREE.Group();
    this.root.name = 'level';
    engine.scene.add(this.root);
    this.doors = [];
    this.items = new Map();
    this.clocks = [];
    this.panels = [];
    this.hidden = [];
    this.swaps = [];
    this.wallDoors = [];
    this.dyn = new Map();
    this.flickers = [];
    this.shadows = !!opts.shadows;
    this.build();
  }

  kitOf(room, variant) {
    const k = variant || room.kit || this.level.def.kit || 'office';
    return KITS[k] || KITS.office;
  }

  build() {
    const L = this.level, B = new Batcher();
    for (const r of L.rooms) {
      this._buildRoom(B, r, `room:${r.id}`, r.kit);
      if (r.swapKit) { this._buildRoom(B, r, `room:${r.id}:swap`, r.swapKit.kit); }
    }
    for (const p of L.props) this._buildProp(B, p);
    for (const d of L.doors) this._buildDoorFrame(B, d);
    const groups = B.build(this.root, { shadows: this.shadows });
    for (const r of L.rooms) if (r.swapKit) {
      this.swaps.push({ room: r, base: groups[`room:${r.id}`], swap: groups[`room:${r.id}:swap`], flag: r.swapKit.flag });
    }
    for (const d of L.doors) this._buildDoor(d);
    this._buildFixtures();
    this._buildRefuges();
    this._buildInteractables();
    this._buildHidden();
    this._buildSigns();
    this._buildWater();
    for (const wd of L.def.wallDoors || []) this._buildWallDoor(wd);
    this.update(0, true);
  }

  // ---------------------------------------------------------------- rooms
  _buildRoom(B, r, key, kitName) {
    const kit = this.kitOf(r, kitName);
    const wallMat = r.wall && !kitName ? r.wall : (kitName && kitName !== r.kit ? kit.wall : (r.wall || kit.wall));
    const floorMat = r.floorMat || SURFACE_FLOOR[r.surface] || 'carpet';
    const fy = r.floorY || 0;
    if (!r.noFloor) B.add(key, floorMat, boxGeo(r.x0, fy - 0.02, r.z0, r.x1, fy, r.z1, texScale(floorMat), 4));
    for (const f of r.floors || []) { if (f[6]) continue; const y = f[4] || 0; const m = f[5] ? 'grating' : floorMat; B.add(key, m, boxGeo(f[0], Math.min(0, y) - 0.06, f[1], f[2], y, f[3], texScale(m), f[5] ? 4 | 8 : (y > 0.05 ? 4 | 1 | 2 | 16 | 32 : 4))); }
    if (!r.noCeiling) B.add(key, r.ceiling || kit.ceiling, boxGeo(r.x0, fy + r.h, r.z0, r.x1, fy + r.h + 0.05, r.z1, texScale(r.ceiling || kit.ceiling), 8));
    const t = WALL_T;
    for (const w of this.level.walls) {
      if (w.room !== r.id) continue;
      const b = w.box;
      // only inward face + ends; outer faces are hidden inside the wall
      const faceIn = w.side === 'W' ? 1 : w.side === 'E' ? 2 : w.side === 'S' ? 16 : 32;
      B.add(key, wallMat, boxGeo(b.minX, fy, b.minZ, b.maxX, fy + r.h, b.maxZ, texScale(wallMat), faceIn | 1 | 2 | 16 | 32 | 4));
      // baseboard
      const bt = 0.025;
      let bb;
      if (w.side === 'W') bb = [b.maxX, b.minZ, b.maxX + bt, b.maxZ];
      else if (w.side === 'E') bb = [b.minX - bt, b.minZ, b.minX, b.maxZ];
      else if (w.side === 'S') bb = [b.minX, b.maxZ, b.maxX, b.maxZ + bt];
      else bb = [b.minX, b.minZ - bt, b.maxX, b.minZ];
      B.add(key, kit.trim, boxGeo(bb[0], fy, bb[1], bb[2], fy + 0.1, bb[3], 1));
      void t;
    }
    for (const l of this.level.lintels) {
      if (l.room !== r.id) continue;
      const b = l.box;
      B.add(key, wallMat, boxGeo(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, texScale(wallMat)));
    }
  }

  _buildDoorFrame(B, d) {
    if (d.T.crawl) return;
    const L = this.level;
    const ra = L.room(d.a);
    const key = `room:${d.a}`;
    const fy = ra.floorY || 0;
    const ft = 0.07, depth = d.b ? WALL_T * 2 + 0.04 : WALL_T + 0.04;
    const n0 = d.b ? d.bnd - depth / 2 : (d.side === 'E' || d.side === 'N' ? d.bnd - depth : d.bnd);
    const n1 = n0 + depth;
    const lo = d.c - d.w / 2, hi = d.c + d.w / 2;
    const m = d.type === 'refuge' ? 'doorRefuge' : d.type === 'fire' ? 'trimDark' : (d.T.auto ? 'darkMetal' : 'trim');
    const add = (a0, a1, y0, y1) => {
      if (d.axis === 'x') B.add(key, m, boxGeo(n0, fy + y0, a0, n1, fy + y1, a1, 1));
      else B.add(key, m, boxGeo(a0, fy + y0, n0, a1, fy + y1, n1, 1));
    };
    add(lo - ft, lo, 0, d.h + ft);
    add(hi, hi + ft, 0, d.h + ft);
    add(lo, hi, d.h, d.h + ft);
  }

  // ---------------------------------------------------------------- props
  _buildProp(B, p) {
    const fn = BUILD[p.k];
    if (!fn || p.hidden) return;
    if (p.dynamic) { this._dynamicProp(p); return; }
    const [w, d, h] = propDims(p);
    const m = placement(p.x, p.y || 0, p.z, p.rot || 0);
    const key = `room:${p.room || 'none'}`;
    fn(new PropBuilder(B, key, m), w, d, h, p);
  }

  _dynamicProp(p) {
    const B = new Batcher();
    const [w, d, h] = propDims(p);
    BUILD[p.k](new PropBuilder(B, 'x', new THREE.Matrix4()), w, d, h, p);
    const grp = B.build(this.root).x;
    grp.position.set(p.x, p.y || 0, p.z);
    grp.rotation.y = -(p.rot || 0) * Math.PI / 180;
    for (const c of grp.children) { c.matrixAutoUpdate = true; }
    this.dyn.set(p.id || `${p.k}@${p.x},${p.z}`, { grp, prop: p, base: { x: p.x, y: p.y || 0, z: p.z } });
  }

  // ---------------------------------------------------------------- doors
  _buildDoor(d) {
    const L = this.level;
    if (d.T.open) return;
    const ra = L.room(d.a);
    const fy = ra.floorY || 0;
    const g = new THREE.Group();
    const pivot = new THREE.Group();
    g.add(pivot);
    const leafMat = d.type === 'refuge' ? 'doorRefuge' : d.type === 'fire' ? 'doorFire' : d.type === 'pressure' || d.type === 'sealed' ? 'doorMetal' : 'doorWood';
    let kind = 'hinged';
    if (d.type === 'shutter') kind = 'shutter';
    else if (d.type === 'gate') kind = 'gate';
    else if (d.type === 'lift') kind = 'lift';
    else if (d.type === 'hidden') kind = 'hidden';
    else if (d.type === 'sealed') kind = 'sealed';
    const W = d.w, H = d.h;
    const mk = (geo, m) => { const mesh = new THREE.Mesh(geo, mat(m)); mesh.castShadow = this.shadows; mesh.receiveShadow = true; return mesh; };
    // local frame: x along the opening, z across it (normal), origin at opening centre on the floor
    if (kind === 'hinged') {
      const leaf = mk(new THREE.BoxGeometry(W - 0.04, H - 0.02, 0.05), leafMat);
      leaf.position.set(W / 2 - 0.02, (H - 0.02) / 2, 0);
      pivot.add(leaf);
      const handle = mk(new THREE.BoxGeometry(0.12, 0.03, 0.12), 'chrome');
      handle.position.set(W - 0.15, 1.0, 0);
      pivot.add(handle);
      if (d.type === 'fire' || d.type === 'pressure') { const bar = mk(new THREE.BoxGeometry(W * 0.7, 0.05, 0.16), 'darkMetal'); bar.position.set(W / 2, 1.0, 0); pivot.add(bar); }
      if (d.type === 'refuge') {
        const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: refugeIcon(), transparent: true }));
        icon.position.set(W / 2, 1.6, 0.03); pivot.add(icon);
        const icon2 = icon.clone(); icon2.position.z = -0.03; icon2.rotation.y = Math.PI; pivot.add(icon2);
      }
      pivot.position.set(-W / 2, 0, 0);
    } else if (kind === 'shutter') {
      const slats = new THREE.Group();
      const n = Math.round(H / 0.12);
      for (let i = 0; i < n; i++) { const s = mk(new THREE.BoxGeometry(W, 0.11, 0.04), 'metal'); s.position.set(0, 0.06 + i * 0.12, 0); slats.add(s); }
      pivot.add(slats);
    } else if (kind === 'gate') {
      const n = Math.round(W / 0.15);
      for (let i = 0; i <= n; i++) { const bar = mk(new THREE.BoxGeometry(0.035, H, 0.035), 'darkMetal'); bar.position.set(-W / 2 + i * W / n, H / 2, 0); pivot.add(bar); }
      for (const y of [0.1, H / 2, H - 0.1]) { const bar = mk(new THREE.BoxGeometry(W, 0.06, 0.05), 'darkMetal'); bar.position.set(0, y, 0); pivot.add(bar); }
      const wheel = mk(new THREE.TorusGeometry(0.22, 0.03, 6, 16), 'redPaint'); wheel.position.set(W / 2 - 0.35, 1.15, 0.08); pivot.add(wheel);
    } else if (kind === 'lift') {
      const l = mk(new THREE.BoxGeometry(W / 2, H, 0.05), 'chrome'); l.position.set(-W / 4, H / 2, 0); l.name = 'l';
      const r = mk(new THREE.BoxGeometry(W / 2, H, 0.05), 'chrome'); r.position.set(W / 4, H / 2, 0); r.name = 'r';
      pivot.add(l, r);
    } else {
      const panel = mk(new THREE.BoxGeometry(W, H, 0.06), kind === 'hidden' ? (this.kitOf(ra).wall) : 'doorMetal');
      panel.position.set(0, H / 2, 0); pivot.add(panel);
    }
    // place the group: rotate so local x runs along the wall
    g.position.set(d.x, fy, d.z);
    g.rotation.y = d.axis === 'x' ? Math.PI / 2 : 0;
    this.root.add(g);
    this.doors.push({ d, g, pivot, kind });
  }

  // ---------------------------------------------------------------- lights
  _buildFixtures() {
    const L = this.level;
    const geoT = new THREE.BoxGeometry(1.2, 0.04, 0.6);
    const byMat = new Map();
    for (const l of L.lights) {
      const r = L.room(l.room);
      const kit = this.kitOf(r);
      const m = r.light === 'dark' ? 'lampOff' : r.light === 'dim' ? 'lampDim' : kit.lamp;
      if (l.flicker) {
        const mesh = new THREE.Mesh(geoT, mat(m).clone());
        mesh.position.set(l.x, l.y - 0.02, l.z);
        this.root.add(mesh);
        this.flickers.push({ mesh, base: mesh.material.emissiveIntensity, light: l });
        continue;
      }
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(l);
    }
    for (const [m, list] of byMat) {
      const inst = new THREE.InstancedMesh(geoT, mat(m), list.length);
      const M = new THREE.Matrix4();
      list.forEach((l, i) => { M.makeTranslation(l.x, l.y - 0.02, l.z); inst.setMatrixAt(i, M); });
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      // pendant cables for fixtures hung below the ceiling
      for (const l of list) {
        const r = L.room(l.room);
        const top = (r.floorY || 0) + r.h;
        if (top - l.y > 0.3) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.015, top - l.y, 0.015), mat('darkMetal')); c.position.set(l.x, (top + l.y) / 2, l.z); this.root.add(c); }
      }
    }
  }

  // ---------------------------------------------------------------- refuges
  _buildRefuges() {
    for (const ref of this.level.refuges) {
      const c = ref.clock;
      const grp = new THREE.Group();
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 }));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.02, 6, 32), mat('darkMetal'));
      grp.add(face, rim);
      const hand = (len, wid, m, z) => { const h = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.006), mat(m)); b.position.y = len / 2 - 0.02; h.add(b); h.position.z = z; grp.add(h); return h; };
      const hh = hand(0.11, 0.018, 'black', 0.01), mh = hand(0.17, 0.012, 'black', 0.015), sh = hand(0.19, 0.005, 'redPaint', 0.02);
      orient(grp, c.face);
      grp.position.set(c.x, c.y, c.z);
      this.root.add(grp);
      this.clocks.push({ grp, hh, mh, sh, genuine: ref.genuine, frozen: 0.37 + (c.x * 7 % 1) * 0.3 });
      for (const it of ref.items) this._refugeItem(it);
    }
  }

  _refugeItem(it) {
    const g = new THREE.Group();
    const add = (geo, m, x, y, z) => { const ms = new THREE.Mesh(geo, mat(m)); ms.position.set(x, y, z); g.add(ms); return ms; };
    if (it.kind === 'mapboard') { add(new THREE.BoxGeometry(1.0, 0.7, 0.03), 'cardboard', 0, 0, 0); add(new THREE.BoxGeometry(0.8, 0.5, 0.01), 'paper', 0, 0, 0.02); }
    if (it.kind === 'cabinet') { add(new THREE.BoxGeometry(0.85, 1.5, 0.85), 'doorMetal', 0, -0.15, 0); add(new THREE.BoxGeometry(0.3, 0.08, 0.01), 'ledGreen', 0, 0.35, 0.43); add(new THREE.BoxGeometry(0.08, 0.3, 0.01), 'ledGreen', 0, 0.35, 0.43); }
    if (it.kind === 'charger') { add(new THREE.BoxGeometry(0.4, 0.25, 0.12), 'darkMetal', 0, 0, 0); add(new THREE.BoxGeometry(0.06, 0.03, 0.01), 'ledGreen', 0.12, 0.06, 0.065); }
    if (it.kind === 'deck') { add(new THREE.BoxGeometry(0.9, 0.04, 0.7), 'laminate', 0, -0.06, 0); add(new THREE.BoxGeometry(0.04, 0.72, 0.04), 'darkMetal', -0.4, -0.44, 0); add(new THREE.BoxGeometry(0.04, 0.72, 0.04), 'darkMetal', 0.4, -0.44, 0); add(new THREE.BoxGeometry(0.36, 0.1, 0.22), 'darkMetal', 0, 0.0, 0); add(new THREE.BoxGeometry(0.12, 0.06, 0.01), 'black', -0.05, 0.02, 0.11); }
    orient(g, it.face);
    g.position.set(it.x, it.y, it.z);
    this.root.add(g);
  }

  // ---------------------------------------------------------------- interactables
  _buildInteractables() {
    const L = this.level;
    for (const it of L.interactables) {
      let obj = null;
      if (it.kind === 'pickup') obj = it.tool ? toolMesh(it.tool) : itemMesh(it.item);
      else if (it.kind === 'record') obj = recordMesh(it);
      else if (it.kind === 'note') obj = noteMesh();
      else if (it.kind === 'panel') { obj = panelMesh(this.game.puzzles.get(it.puzzle)); this.panels.push({ obj, puzzle: it.puzzle }); }
      else if (it.kind === 'station') obj = stationMesh();
      else if (it.kind === 'gateWheel') obj = null;
      else if (it.kind === 'drawer') obj = drawerMesh();
      else if (it.kind === 'practiceDecoy') obj = itemMesh('decoy');
      else if (it.kind === 'lift') obj = null;
      else if (it.mesh) obj = genericMesh(it.mesh);
      if (!obj) continue;
      obj.position.set(it.x, it.y ?? 1, it.z);
      if (it.face) orient(obj, it.face);
      this.root.add(obj);
      this.items.set(it.id, { obj, it });
    }
  }

  // ---------------------------------------------------------------- hidden layer
  _buildHidden() {
    for (const h of this.level.hidden) {
      const tex = artTexture(h.art || `text:${h.text || '?'}`, 512, Math.round(512 * (h.h / h.w)) || 512);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.h), m);
      orient(mesh, h.face);
      const n = h.normal;
      mesh.position.set(h.x + n[0] * 0.012, h.y + n[1] * 0.012, h.z + n[2] * 0.012);
      mesh.layers.set(HIDDEN_LAYER);
      mesh.renderOrder = 5;
      this.root.add(mesh);
      this.hidden.push({ mesh, h });
    }
  }

  // ---------------------------------------------------------------- signs
  _buildSigns() {
    const L = this.level;
    for (const p of L.props) {
      if (p.k === 'sign') {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: symbolSign(p.sym, SIGN_COLORS[p.tint]), roughness: 0.7, side: THREE.DoubleSide }));
        m.position.set(p.x, (p.y || 2.2) + 0.45, p.z);
        const m2 = m.clone(); m2.rotation.y = Math.PI / 2;
        this.root.add(m, m2);
        const wire = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.3, 0.01), mat('darkMetal')); wire.position.set(p.x, (p.y || 2.2) + 1.05, p.z); this.root.add(wire);
      }
      if (p.k === 'directory') {
        const tex = textTexture(p.lines || ['HAZELBANK FACILITIES', 'ANNEX · LEVEL B', '', 'RECEPTION ............ B01', 'RECORDS ................ B08', 'MAINTENANCE ........ B07'], { w: 512, h: 640, size: 30, bg: '#14181a', fg: '#e8e2cc', spacing: 1.5 });
        const [w, d, h] = propDims(p);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.75), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0x111111 }));
        m.position.set(p.x, 0.6 + (h - 0.75) / 2, p.z - d / 2 - 0.012);
        m.rotation.y = Math.PI;
        if (p.tilt) m.rotation.z = p.tilt;
        this.root.add(m);
      }
    }
    for (const p of L.props) {
      if (p.k === 'storefront' && p.name) {
        const [w, , h] = propDims(p);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.4), new THREE.MeshStandardMaterial({ map: textTexture([p.name], { w: 512, h: 96, size: 46, bg: '#e6d8d8', fg: '#3a2a30', spacing: 6 }), roughness: 0.6, emissive: 0x222222 }));
        const r = (p.rot || 0) * Math.PI / 180;
        m.rotation.y = -r;
        m.position.set(p.x - Math.sin(r) * 0.14, h - 0.28, p.z + Math.cos(r) * 0.14);
        this.root.add(m);
      }
      if (p.k === 'labelPlate' && p.text) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), new THREE.MeshStandardMaterial({ map: textTexture([p.text], { w: 512, h: 90, size: 38, bg: '#f2ead8', fg: '#2a2620', spacing: 2 }), roughness: 0.7 }));
        m.position.set(p.x, p.y || 1.5, p.z); m.rotation.y = Math.PI;
        this.root.add(m);
      }
      if (p.k === 'toyShelf' && p.toys) {
        const [w] = propDims(p);
        p.toys.forEach(([n], i) => {
          const x = p.x - w / 2 + 0.45 + i * (w - 0.9) / 2;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ map: textTexture([String(n)], { w: 128, h: 96, size: 70, bg: '#ffffff', fg: '#111' }) }));
          m.position.set(x, 0.6, p.z - 0.26); m.rotation.y = Math.PI;
          this.root.add(m);
        });
      }
    }
    this._buildSilhouettes();
    // room plates beside each door: the name of the room on the other side
    const plates = new Map();
    const plate = (name) => { if (!plates.has(name)) plates.set(name, textTexture([name.toUpperCase()], { w: 512, h: 96, size: 34, bg: '#20262a', fg: '#e8e2cc', spacing: 3 })); return plates.get(name); };
    for (const d of L.doors) {
      if (!d.b || d.T.crawl || d.noPlate) continue;
      for (const [from, to] of [[d.a, d.b], [d.b, d.a]]) {
        const rt = L.room(to), rf = L.room(from);
        if (!rt || !rf) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), new THREE.MeshStandardMaterial({ map: plate(rt.name), roughness: 0.5 }));
        const sideSign = from === d.a ? (d.side === 'E' || d.side === 'N' ? -1 : 1) : (d.side === 'E' || d.side === 'N' ? 1 : -1);
        const off = WALL_T * (d.b ? 1 : 1) + 0.012;
        const y = (rf.floorY || 0) + Math.min(d.h + 0.25, rf.h - 0.15);
        if (d.axis === 'x') { m.position.set(d.bnd + sideSign * off, y, d.c); m.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2; } else { m.position.set(d.c, y, d.bnd + sideSign * off); m.rotation.y = sideSign > 0 ? 0 : Math.PI; }
        this.root.add(m);
      }
    }
  }

  _buildSilhouettes() {
    const sil = this.level.props.filter((p) => p.k === 'silhouette');
    if (!sil.length) return;
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.95 });
    const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.95, 4, 8), bodyM, sil.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.15, 1.1).translate(0, 0, 0.03), bodyM, sil.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    this.silData = sil.map((p, i) => {
      const yaw = Math.atan2(-(p.faceX - p.x), -(p.faceZ - p.z)) + Math.PI;
      M.compose(V.set(p.x, 0.78, p.z), Q.setFromEuler(E.set(0, yaw, 0)), S1); bodies.setMatrixAt(i, M);
      return { p, yaw, head: 0, target: 0 };
    });
    this.silHeads = heads; this.silBodies = bodies;
    this._updateSil(0);
    this.root.add(bodies, heads);
  }
  _updateSil(dt) {
    if (!this.silData) return;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    this.silData.forEach((s, i) => {
      s.head += (s.target - s.head) * Math.min(1, dt * 6);
      M.compose(V.set(s.p.x, 1.62, s.p.z), Q.setFromEuler(E.set(0, s.yaw + s.head, 0)), S1);
      this.silHeads.setMatrixAt(i, M);
    });
    this.silHeads.instanceMatrix.needsUpdate = true;
  }
  turnSilhouettes() { if (this.silData) for (const s of this.silData) s.target = 1.2; setTimeout(() => { if (this.silData) for (const s of this.silData) s.target = 0; }, 1600); }

  _buildWater() {
    this.waterMeshes = [];
    for (const w of this.level.water) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.z1 - w.z0), mat('water'));
      m.rotation.x = -Math.PI / 2;
      m.position.set((w.x0 + w.x1) / 2, (w.y || 0) + w.depth, (w.z0 + w.z1) / 2);
      m.renderOrder = 2;
      this.root.add(m);
      this.waterMeshes.push({ m, w });
    }
  }

  _buildWallDoor(wd) {
    const r = this.level.room(wd.room);
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(wd.lift ? 1.6 : 1.0, 2.1, 0.06), mat(wd.lift ? 'chrome' : 'doorMetal'));
    leaf.position.y = 1.05;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 2.2, 0.04), mat('trimDark'));
    frame.position.y = 1.1; frame.position.z = -0.012;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.12), mat('darkMetal')); bar.position.set(0, 1.0, 0.05);
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ map: textTexture(['EXIT'], { w: 256, h: 96, bg: '#0c2a14', fg: '#5aff8a', size: 60 }) }));
    exit.position.set(0, 2.45, 0.02);
    g.add(frame, leaf, bar, exit);
    const t = WALL_T + 0.005;
    const pos = { N: [r.x0 + (r.w / 2) + (wd.pos || 0), r.z1 - t], S: [r.x0 + r.w / 2 + (wd.pos || 0), r.z0 + t], E: [r.x1 - t, r.z0 + r.d / 2 + (wd.pos || 0)], W: [r.x0 + t, r.z0 + r.d / 2 + (wd.pos || 0)] }[wd.side];
    g.position.set(pos[0], 0, pos[1]);
    orient(g, { N: 'S', S: 'N', E: 'W', W: 'E' }[wd.side]);
    this.root.add(g);
    this.wallDoors.push({ g, wd });
  }

  // ---------------------------------------------------------------- per frame
  update(dt, force = false) {
    const g = this.game, S = g.story;
    for (const o of this.doors) {
      const d = o.d, k = o.kind, v = d.open;
      if (k === 'hinged') o.pivot.rotation.y = -v * Math.PI * 0.52 * (d.swing || 1);
      else if (k === 'shutter') o.pivot.position.y = v * (d.h - 0.15);
      else if (k === 'gate') o.pivot.position.x = v * (d.w - 0.1);
      else if (k === 'lift') { const l = o.pivot.children[0], r = o.pivot.children[1]; l.position.x = -d.w / 4 - v * d.w * 0.45; r.position.x = d.w / 4 + v * d.w * 0.45; }
      else if (k === 'hidden') { o.pivot.position.y = -v * (d.h + 0.1); o.g.visible = v < 0.99; }
      else if (k === 'sealed') o.pivot.visible = true;
    }
    for (const [id, o] of this.items) {
      const vis = available(g, o.it) || (o.it.kind === 'record');
      o.obj.visible = vis;
      if (o.it.kind === 'record') o.obj.userData.collected = !!g.persist.records[o.it.record];
    }
    const now = g.time;
    for (const c of this.clocks) {
      const t = c.genuine ? Math.floor(now) : 0;
      const sec = c.genuine ? (t % 60) / 60 : c.frozen;
      c.sh.rotation.z = -sec * Math.PI * 2;
      c.mh.rotation.z = -((c.genuine ? now / 3600 : c.frozen * 0.3) + 0.12) * Math.PI * 2;
      c.hh.rotation.z = -((c.genuine ? now / 43200 : c.frozen * 0.1) + 0.7) * Math.PI * 2;
    }
    for (const p of this.panels) {
      const pz = g.puzzles.get(p.puzzle);
      if (!pz) continue;
      const v = pz.view();
      const leds = p.obj.userData.leds || [];
      const on = v.controls.filter((c) => c.state === 'on').length;
      leds.forEach((l, i) => { l.material = mat(pz.done ? 'ledGreen' : i < on ? 'ledGreen' : 'ledRed'); });
    }
    for (const s of this.swaps) {
      const on = S.has(s.flag);
      if (s.base) s.base.visible = !on;
      if (s.swap) s.swap.visible = on;
    }
    for (const w of this.wallDoors) w.g.visible = !(w.wd.hideFlag && S.has(w.wd.hideFlag));
    for (const h of this.hidden) h.mesh.visible = !(h.h.flag && !S.has(h.h.flag)) && !(h.h.until && S.has(h.h.until));
    // flickering tubes
    const A = this.steadyLights;
    for (const f of this.flickers) {
      const k = A ? 0.45 : (Math.sin(now * 23) > 0.6 || Math.sin(now * 3.1) > 0.92 ? 0.15 : 1);
      f.mesh.material.emissiveIntensity = f.base * k;
      f.light.flickerK = k;
    }
    // dynamic props driven by the simulation
    for (const [id, o] of this.dyn) {
      const pr = o.prop;
      if (pr.showIf || pr.hideIf) o.grp.visible = (!pr.showIf || S.has(pr.showIf)) && (!pr.hideIf || !S.has(pr.hideIf));
      const st = g.propState && g.propState[id];
      if (st) { o.grp.position.set(st.x ?? o.base.x, st.y ?? o.base.y, st.z ?? o.base.z); if (st.rot !== undefined) o.grp.rotation.y = -st.rot * Math.PI / 180; o.grp.visible = st.visible !== false; }
    }
    this._updateSil(dt);
    for (const o of this.waterMeshes || []) o.m.visible = !(o.w.until && S.has(o.w.until)) && !(o.w.after && !S.has(o.w.after));
    void force;
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.engine.scene.remove(this.root);
  }
}

// ------------------------------------------------------------------ helpers
export function orient(obj, face) {
  switch (face) {
    case 'N': obj.rotation.y = 0; break; // faces +z
    case 'S': obj.rotation.y = Math.PI; break;
    case 'E': obj.rotation.y = Math.PI / 2; break;
    case 'W': obj.rotation.y = -Math.PI / 2; break;
    case 'up': obj.rotation.x = -Math.PI / 2; break;
    case 'down': obj.rotation.x = Math.PI / 2; break;
    default: break;
  }
}

let _refugeIcon = null;
function refugeIcon() {
  if (_refugeIcon) return _refugeIcon;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#e8efe4'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
  c.strokeStyle = '#1f3a30'; c.lineWidth = 8; c.stroke();
  c.lineWidth = 7; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke();
  _refugeIcon = new THREE.CanvasTexture(cv); _refugeIcon.colorSpace = THREE.SRGBColorSpace;
  return _refugeIcon;
}

function group(...meshes) { const g = new THREE.Group(); for (const m of meshes) g.add(m); return g; }
function m(geo, name, x = 0, y = 0, z = 0) { const ms = new THREE.Mesh(geo, mat(name)); ms.position.set(x, y, z); return ms; }

export function itemMesh(item) {
  switch (item) {
    case 'battery': return group(m(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), 'bluePaint'), m(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), 'chrome', 0, 0.055, 0));
    case 'film': return group(m(new THREE.BoxGeometry(0.11, 0.025, 0.09), 'black'), m(new THREE.BoxGeometry(0.07, 0.003, 0.05), 'paper', 0, 0.014, 0));
    case 'bandage': return group(m(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), 'white'));
    case 'firstaid': return group(m(new THREE.BoxGeometry(0.22, 0.1, 0.15), 'white'), m(new THREE.BoxGeometry(0.1, 0.004, 0.03), 'redPaint', 0, 0.052, 0), m(new THREE.BoxGeometry(0.03, 0.004, 0.1), 'redPaint', 0, 0.052, 0));
    case 'tea': return group(m(new THREE.CylinderGeometry(0.04, 0.032, 0.09, 12), 'white'), m(new THREE.BoxGeometry(0.02, 0.03, 0.002), 'greenPaint', 0.03, 0.02, 0.03));
    case 'decoy': return group(m(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 10), 'redPaint'), m(new THREE.BoxGeometry(0.06, 0.02, 0.005), 'chrome', 0, 0.06, 0));
    case 'chalk': return group(m(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), 'white'));
    case 'wedge': return group(m(wedgeGeo(), 'rubber'));
    default: return group(m(new THREE.BoxGeometry(0.08, 0.08, 0.08), 'cardboard'));
  }
}
function wedgeGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.14, 0); s.lineTo(0, 0.04); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); g.translate(-0.07, 0, -0.025); return g;
}
export function toolMesh(tool) {
  if (tool === 'flashlight') { const g = group(m(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 10), 'darkMetal'), m(new THREE.CylinderGeometry(0.032, 0.024, 0.05, 10), 'darkMetal', 0, 0.11, 0)); g.rotation.z = Math.PI / 2; return group(g); }
  if (tool === 'camera') return group(m(new THREE.BoxGeometry(0.3, 0.16, 0.2), 'cardboard'), m(new THREE.BoxGeometry(0.12, 0.03, 0.02), 'darkMetal', 0, 0.09, 0));
  return group(m(new THREE.BoxGeometry(0.1, 0.1, 0.1), 'cardboard'));
}
function recordMesh(it) {
  const R = it.audio;
  if (R) return group(m(new THREE.BoxGeometry(0.1, 0.012, 0.065), 'black'));
  const g = group(m(new THREE.BoxGeometry(0.21, 0.003, 0.29), 'paper'));
  if (it.y > 0.95) g.rotation.x = -0.2;
  return g;
}
function noteMesh() { return group(m(new THREE.BoxGeometry(0.3, 0.42, 0.005), 'paper')); }
function drawerMesh() { return group(m(new THREE.BoxGeometry(0.06, 0.02, 0.02), 'chrome')); }
function stationMesh() {
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(0.5, 1.1, 0.35), 'darkMetal', 0, -0.55, 0));
  g.add(m(new THREE.BoxGeometry(0.34, 0.22, 0.03), 'screenGreen', 0, 0.12, 0.18));
  g.add(m(new THREE.BoxGeometry(0.24, 0.18, 0.3), 'black', 0, 0.42, 0));
  g.add(m(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), 'darkMetal', 0, 0.42, 0.2)).rotation.x = Math.PI / 2;
  return g;
}
function panelMesh(pz) {
  const n = pz ? Math.max(2, pz.view().controls.length) : 3;
  const w = Math.max(0.6, n * 0.16 + 0.2);
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(w, 0.7, 0.12), 'darkMetal', 0, 0, -0.06));
  const leds = [];
  for (let i = 0; i < n; i++) { const l = m(new THREE.BoxGeometry(0.06, 0.06, 0.02), 'ledRed', -w / 2 + 0.18 + i * 0.16, 0.2, 0.01); g.add(l); leds.push(l); }
  for (let i = 0; i < n; i++) g.add(m(new THREE.BoxGeometry(0.08, 0.16, 0.04), 'chrome', -w / 2 + 0.18 + i * 0.16, -0.08, 0.02));
  g.userData.leds = leds;
  return g;
}
function genericMesh(kind) {
  if (kind === 'mug') return group(m(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), 'lampWarm'));
  if (kind === 'paper') return group(m(new THREE.BoxGeometry(0.21, 0.003, 0.29), 'paper'));
  if (kind === 'button') return group(m(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), 'redPaint'));
  if (kind === 'lever') return group(m(new THREE.BoxGeometry(0.06, 0.4, 0.06), 'redPaint', 0, 0.2, 0));
  if (kind === 'handset') return group(m(new THREE.BoxGeometry(0.06, 0.2, 0.05), 'black'));
  return group(m(new THREE.BoxGeometry(0.15, 0.15, 0.15), 'cardboard'));
}
void PROP_KINDS;
