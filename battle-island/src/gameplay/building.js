/**
 * Building: walls, floors, ramps and cones on a world-aligned 4m grid with a
 * 0.8m vertical quantum (so pieces stack cleanly from any terrain height).
 * Pieces cost 10 materials, have per-material health, can be destroyed, and
 * remember their owner. Walls (3x3) and floors (2x2) can be edited by cutting
 * tiles, ramps by picking the side they climb to, and cones by raising corners; pieces
 * can be repaired and upgraded (wood → brick → metal); anything no longer
 * connected to the ground collapses.
 */

import * as THREE from 'three';
import { Collider, coneLift } from '../world/physics.js';
import { boxGeo, mat } from '../world/island.js';
import { sfx } from '../core/audio.js';
import { pieceRow, bitsToTiles } from '../net/sync.js';

export const TILE = 4;
export const LEVEL = 3.2;
const VQ = 0.8;
export const PIECES = ['wall', 'floor', 'ramp', 'cone'];
export const PIECE_NAMES = { wall: 'Wall', floor: 'Floor', ramp: 'Ramp', cone: 'Cone' };
export const BUILD_HP = { wood: 150, brick: 260, metal: 400 };
export const BUILD_COST = 10;
const LOOK = { wood: ['#e0a76a', 'wood'], brick: ['#cf6a4f', 'brick'], metal: ['#a9bccc', 'metal'] };
const RAMP_LEN = Math.hypot(TILE, LEVEL);
const RAMP_ANG = Math.atan2(LEVEL, TILE);
const CONE_H = 1.6;
let coneGeo = null;
/** Ramp edits: the two tiles picked (cut) on one side set the side it climbs to. */
const RAMP_SIDES = [[[1, 3], 0], [[2, 3], 1], [[0, 2], 2], [[0, 1], 3]];

/** Surface mesh for an edited cone (corners raised by the cut tiles). */
function editedConeGeo(w, d, raise) {
  const geo = new THREE.PlaneGeometry(w, d, 8, 8);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5, v = pos.getZ(i) / d + 0.5;
    const m = Math.min(1, Math.max(Math.abs(u - 0.5) * 2, Math.abs(v - 0.5) * 2));
    pos.setY(i, CONE_H * coneLift(1 - m, raise, u, v));
  }
  geo.computeVertexNormals();
  return geo;
}

export class Building {
  constructor(game) {
    this.game = game;
    this.occupied = new Map();
    this.pieces = new Set();
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.38, depthWrite: false });
    this.ghostBad = new THREE.MeshBasicMaterial({ color: '#ff4f4f', transparent: true, opacity: 0.32, depthWrite: false });
    this.ghost = new THREE.Mesh(boxGeo(1, 1, 1), this.ghostMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 5;
    game.scene.add(this.ghost);
  }

  /** Works out where `piece` would go for an actor looking along yaw/pitch. */
  spot(actor, piece, yaw, pitch) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const axisX = Math.abs(fx) > Math.abs(fz);
    const sign = axisX ? Math.sign(fx) : Math.sign(fz);
    const p = actor.pos;
    let b = Math.ceil((p.y - 0.05) / VQ) * VQ;
    const up = pitch > 0.45;
    const own = { ix: Math.floor(p.x / TILE), iz: Math.floor(p.z / TILE) };
    const ahead = { ix: Math.floor((p.x + fx * 2.8) / TILE), iz: Math.floor((p.z + fz * 2.8) / TILE) };
    if (axisX) { ahead.ix = own.ix + sign; ahead.iz = own.iz; } else { ahead.iz = own.iz + sign; ahead.ix = own.ix; }
    const s = { piece, dir: 0, b };
    if (piece === 'wall') {
      if (up) b += LEVEL;
      const coord = axisX ? p.x : p.z;
      const gl = sign > 0 ? Math.ceil((coord + 0.45) / TILE) : Math.floor((coord - 0.45) / TILE);
      const other = axisX ? own.iz : own.ix;
      s.b = b;
      s.axisX = axisX;
      if (axisX) Object.assign(s, { minX: gl * TILE - 0.12, maxX: gl * TILE + 0.12, minZ: other * TILE, maxZ: other * TILE + TILE });
      else Object.assign(s, { minZ: gl * TILE - 0.12, maxZ: gl * TILE + 0.12, minX: other * TILE, maxX: other * TILE + TILE });
      s.minY = b - 0.4;
      s.maxY = b + LEVEL;
      s.key = `w:${axisX ? 'x' : 'z'}:${gl}:${other}:${Math.round(b / VQ)}`;
    } else {
      let cell = ahead;
      if (piece === 'floor' && (up || pitch < -0.6)) cell = own;
      if (piece === 'cone' && up) cell = own;
      if (up && piece !== 'ramp') b += LEVEL;
      if (piece === 'ramp' && pitch > 0.8) b += LEVEL;
      s.b = b;
      Object.assign(s, { minX: cell.ix * TILE, maxX: cell.ix * TILE + TILE, minZ: cell.iz * TILE, maxZ: cell.iz * TILE + TILE });
      if (piece === 'floor') { s.minY = b - 0.2; s.maxY = b; }
      else if (piece === 'ramp') {
        s.minY = b; s.maxY = b + LEVEL;
        s.dir = axisX ? (sign > 0 ? 0 : 2) : sign > 0 ? 1 : 3;
      } else { s.minY = b; s.maxY = b + CONE_H; }
      s.key = `${piece[0]}:${cell.ix}:${cell.iz}:${Math.round(b / VQ)}`;
    }
    s.free = !this.occupied.has(s.key);
    return s;
  }

  _meshFor(s, material) {
    let m;
    if (s.piece === 'ramp') {
      const along = s.dir === 0 || s.dir === 2;
      m = new THREE.Mesh(along ? boxGeo(RAMP_LEN, 0.2, TILE) : boxGeo(TILE, 0.2, RAMP_LEN), material);
      if (s.dir === 0) m.rotation.z = RAMP_ANG;
      else if (s.dir === 2) m.rotation.z = -RAMP_ANG;
      else if (s.dir === 1) m.rotation.x = -RAMP_ANG;
      else m.rotation.x = RAMP_ANG;
      m.position.set((s.minX + s.maxX) / 2, s.b + LEVEL / 2, (s.minZ + s.maxZ) / 2);
    } else if (s.piece === 'cone') {
      if (!coneGeo) {
        coneGeo = new THREE.ConeGeometry(TILE / 2 / 0.7071, 1.6, 4);
        coneGeo.rotateY(Math.PI / 4);
      }
      m = new THREE.Mesh(coneGeo, material);
      m.position.set((s.minX + s.maxX) / 2, s.b + CONE_H / 2, (s.minZ + s.maxZ) / 2);
    } else {
      m = new THREE.Mesh(boxGeo(s.maxX - s.minX, s.maxY - s.minY, s.maxZ - s.minZ), material);
      m.position.set((s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2, (s.minZ + s.maxZ) / 2);
    }
    return m;
  }

  showGhost(s, ok) {
    const g = this._meshFor(s, ok ? this.ghostMat : this.ghostBad);
    this.ghost.geometry = g.geometry;
    this.ghost.material = g.material;
    this.ghost.position.copy(g.position);
    this.ghost.rotation.copy(g.rotation);
    this.ghost.visible = true;
  }

  hideGhost() {
    this.ghost.visible = false;
  }

  canPlace(actor, s, material) {
    // check the grid live: `s.free` can be stale if something was placed since the spot was computed
    return !this.occupied.has(s.key) && actor.mats[material] >= BUILD_COST && this.supported(s);
  }

  place(actor, s, material) {
    if (!this.canPlace(actor, s, material)) return null;
    actor.mats[material] -= BUILD_COST;
    if (actor.stats) actor.stats.built++;
    const p = {
      type: s.piece, key: s.key, dir: s.dir, axisX: s.axisX, b: s.b,
      box: { minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY, minZ: s.minZ, maxZ: s.maxZ },
      material, hp: BUILD_HP[material], maxHp: BUILD_HP[material], owner: actor, team: actor.team,
      tiles: null, colliders: [], meshes: [], alive: true,
    };
    p.maxY = s.maxY;
    this._rebuild(p);
    this.occupied.set(s.key, p);
    this.pieces.add(p);
    // pop-in
    for (const m of p.meshes) {
      m.scale.setScalar(0.6);
      this.game.tweens.push({ t: 0, d: 0.12, fn: (k) => m.scale.setScalar(0.6 + 0.4 * k) });
    }
    sfx.play('build', p.meshes[0].position);
    this._net(p);
    return p;
  }

  _net(p) {
    this.game.net?.push?.(['pc+', pieceRow(p)]);
  }

  // ---- client side: pieces mirrored from the host
  applyRow(r) {
    const [key, type, dir, axisX, b, x0, y0, z0, x1, y1, z1, material, hp, maxHp, bits, team] = r;
    let p = this.occupied.get(key);
    const tiles = bitsToTiles(bits, type === 'wall' ? 9 : 4);
    if (p && p.material === material && p.dir === dir && JSON.stringify(p.tiles) === JSON.stringify(tiles)) {
      p.hp = hp;
      p.maxHp = maxHp;
      return p;
    }
    if (!p) {
      p = { type, key, dir, axisX: !!axisX, b: b / 10, box: { minX: x0 / 10, minY: y0 / 10, minZ: z0 / 10, maxX: x1 / 10, maxY: y1 / 10, maxZ: z1 / 10 }, owner: null, team, colliders: [], meshes: [], alive: true };
      p.maxY = p.box.maxY;
      this.occupied.set(key, p);
      this.pieces.add(p);
      sfx.play('build', new THREE.Vector3(x0 / 10, y0 / 10, z0 / 10));
    }
    Object.assign(p, { material, hp, maxHp, tiles, dir });
    this._rebuild(p);
    return p;
  }

  removeKey(key) {
    const p = this.occupied.get(key);
    if (p) this.destroy(p, true);
  }

  reconcile(rows) {
    const keys = new Set(rows.map((r) => r[0]));
    for (const p of [...this.pieces]) if (!keys.has(p.key)) this.destroy(p, true);
    for (const r of rows) this.applyRow(r);
  }

  /** Grid tiles of an editable piece: walls 3x3 (row-major from the bottom), floors 2x2. */
  tileBoxes(p) {
    const b = p.box, out = [];
    if (p.type === 'wall') {
      const ys = [b.minY, p.b + LEVEL / 3, p.b + (2 * LEVEL) / 3, b.maxY];
      const a0 = p.axisX ? b.minZ : b.minX, w = TILE / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const a = a0 + c * w;
          out.push(p.axisX
            ? { minX: b.minX, maxX: b.maxX, minZ: a, maxZ: a + w, minY: ys[r], maxY: ys[r + 1] }
            : { minX: a, maxX: a + w, minZ: b.minZ, maxZ: b.maxZ, minY: ys[r], maxY: ys[r + 1] });
        }
      }
    } else {
      // floors: the slab itself; ramps and cones: thin pads on the surface over each quarter
      const h = TILE / 2;
      const probe = p.type === 'floor' ? null : p.colliders.find((c) => c.type !== 'box') || null;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const t = { minX: b.minX + c * h, maxX: b.minX + (c + 1) * h, minZ: b.minZ + r * h, maxZ: b.minZ + (r + 1) * h, minY: b.minY, maxY: b.maxY };
          if (probe) {
            const y = probe.surfaceY((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2);
            t.minY = y - 0.25;
            t.maxY = y + 0.25;
          }
          out.push(t);
        }
      }
    }
    return out;
  }

  editable(p) {
    return PIECES.includes(p.type);
  }

  /** Why an edit can't be confirmed (null when it can). `tiles` null = nothing cut. */
  editProblem(p, tiles) {
    if (!tiles) return null; // nothing cut: confirming changes nothing
    if (p.type === 'ramp') return rampDir(tiles) === undefined ? 'Pick the 2 tiles on the side the ramp should climb to.' : null;
    if (!tiles.some(Boolean)) return p.type === 'cone' ? 'Leave at least one corner down!' : 'Keep at least one tile!';
    return null;
  }

  /** (Re)creates a piece's meshes and colliders from its shape, material and edit tiles. */
  _rebuild(p) {
    const phys = this.game.world.physics;
    for (const c of p.colliders) phys.remove(c);
    for (const m of p.meshes) this.game.scene.remove(m);
    p.colliders = [];
    p.meshes = [];
    const [color, tex] = LOOK[p.material];
    const material = mat(color, tex);
    const addBox = (bx, type = 'box') => {
      const c = new Collider({ type, dir: p.dir, ...bx, hp: p.maxHp, maxHp: p.maxHp, material: p.material, kind: 'build', owner: p.owner });
      c.piece = p;
      phys.add(c);
      p.colliders.push(c);
      return c;
    };
    if (p.tiles && p.type === 'cone') {
      const raise = p.tiles.map((t) => !t);
      const b = p.box;
      const m = new THREE.Mesh(editedConeGeo(b.maxX - b.minX, b.maxZ - b.minZ, raise), mat(color, tex, { side: THREE.DoubleSide }));
      m.position.set((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2);
      m.castShadow = m.receiveShadow = true;
      this.game.scene.add(m);
      p.meshes.push(m);
      const c = addBox(p.box, 'cone');
      c.raise = raise;
      c.mesh = m;
      return;
    }
    if (!p.tiles) {
      const s = { piece: p.type, dir: p.dir, b: p.b, ...p.box };
      const m = this._meshFor(s, material);
      m.castShadow = m.receiveShadow = true;
      this.game.scene.add(m);
      p.meshes.push(m);
      addBox(p.box, p.type === 'ramp' ? 'ramp' : p.type === 'cone' ? 'cone' : 'box').mesh = m;
      return;
    }
    // edited: merge each row's kept tiles into runs
    const tiles = this.tileBoxes(p);
    const n = p.type === 'wall' ? 3 : 2;
    for (let r = 0; r < n; r++) {
      let run = null;
      const flush = () => {
        if (!run) return;
        const m = new THREE.Mesh(boxGeo(run.maxX - run.minX, run.maxY - run.minY, run.maxZ - run.minZ), material);
        m.position.set((run.minX + run.maxX) / 2, (run.minY + run.maxY) / 2, (run.minZ + run.maxZ) / 2);
        m.castShadow = m.receiveShadow = true;
        this.game.scene.add(m);
        p.meshes.push(m);
        addBox(run).mesh = m;
        run = null;
      };
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        if (!p.tiles[i]) { flush(); continue; }
        const t = tiles[i];
        if (!run) run = { ...t };
        else { run.minX = Math.min(run.minX, t.minX); run.maxX = Math.max(run.maxX, t.maxX); run.minZ = Math.min(run.minZ, t.minZ); run.maxZ = Math.max(run.maxZ, t.maxZ); }
      }
      flush();
    }
  }

  /** Confirms an edit. Returns false if the edit isn't allowed (see editProblem). */
  applyEdit(p, tiles) {
    if (tiles && tiles.every(Boolean)) tiles = null;
    if (!p.alive || this.editProblem(p, tiles)) return false;
    if (p.type === 'ramp') {
      if (!tiles) return true; // nothing picked: unchanged
      p.dir = rampDir(tiles);
      p.tiles = null;
    } else p.tiles = tiles ? [...tiles] : null;
    this._rebuild(p);
    this._net(p);
    sfx.play('build', p.meshes[0]?.position);
    return true;
  }

  damage(p, dmg, src) {
    if (!p.alive) return;
    p.hp -= dmg;
    for (const m of p.meshes) {
      const base = m.userData.baseScale || (m.userData.baseScale = m.scale.clone());
      this.game.tweens.push({ t: 0, d: 0.12, fn: (k) => m.scale.copy(base).multiplyScalar(1 - Math.sin(k * Math.PI) * 0.04) });
    }
    if (p.hp <= 0) this.destroy(p);
  }

  destroy(p, collapse = false) {
    if (!p.alive) return;
    p.alive = false;
    for (const c of p.colliders) this.game.world.physics.remove(c);
    for (const m of p.meshes) this.game.scene.remove(m);
    this.occupied.delete(p.key);
    this.pieces.delete(p);
    this.game.net?.push?.(['pc-', p.key]);
    const b = p.box;
    const center = new THREE.Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    this.game.effects.burst(center, LOOK[p.material][0], collapse ? 10 : 16, collapse ? 3 : 5, 0.25, 0.9);
    sfx.play('break', center);
    if (!collapse) this.checkIntegrity();
  }

  // ---------------------------------------------------------- integrity
  _grounded(b) {
    const hm = this.game.world.hm;
    let top = -Infinity;
    for (const [x, z] of [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ], [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]]) top = Math.max(top, hm.get(x, z));
    if (b.minY <= top + 0.7) return true;
    // resting on or attached to the world (buildings, rocks, trees)
    const e = 0.2;
    return this.game.world.physics.query(b.minX - e, b.minZ - e, b.maxX + e, b.maxZ + e).some((c) => c.alive && c.kind !== 'build' && c.kind !== 'vehicle' && touch(c, b, e));
  }

  supported(box) {
    if (this._grounded(box)) return true;
    for (const p of this.pieces) if (touch(p.box, box, 0.15)) return true;
    return false;
  }

  /** Pieces no longer connected to the ground collapse. */
  checkIntegrity() {
    const list = [...this.pieces];
    const ok = new Set();
    const queue = [];
    for (const p of list) if (this._grounded(p.box)) { ok.add(p); queue.push(p); }
    while (queue.length) {
      const p = queue.pop();
      for (const q of list) if (!ok.has(q) && touch(p.box, q.box, 0.15)) { ok.add(q); queue.push(q); }
    }
    for (const p of list) if (!ok.has(p)) this.destroy(p, true);
  }

  // ---------------------------------------------------------- repair / upgrade
  /** What pressing the repair/upgrade key would do. */
  repairInfo(actor, p) {
    if (p.team !== actor.team) return null;
    if (p.hp < p.maxHp - 0.5) {
      const cost = Math.max(1, Math.ceil((1 - p.hp / p.maxHp) * BUILD_COST));
      return { kind: 'repair', mat: p.material, cost, text: `Repair (${cost} ${p.material})` };
    }
    const next = { wood: 'brick', brick: 'metal' }[p.material];
    if (!next) return { kind: 'max', text: 'Fully upgraded' };
    return { kind: 'upgrade', mat: next, cost: BUILD_COST, text: `Upgrade to ${next} (${BUILD_COST})` };
  }

  repairOrUpgrade(actor, p) {
    const info = this.repairInfo(actor, p);
    if (!info || info.kind === 'max') return info ? info.text : 'Not your build';
    if (actor.mats[info.mat] < info.cost) return `Need ${info.cost} ${info.mat}`;
    actor.mats[info.mat] -= info.cost;
    if (info.kind === 'repair') p.hp = p.maxHp;
    else {
      p.material = info.mat;
      p.maxHp = p.hp = BUILD_HP[info.mat];
      this._rebuild(p);
    }
    this._net(p);
    sfx.play('build', p.meshes[0]?.position);
    return info.kind === 'repair' ? 'Repaired!' : `Upgraded to ${info.mat}!`;
  }

  clear() {
    for (const p of this.pieces) for (const m of p.meshes) this.game.scene.remove(m);
    this.pieces.clear();
    this.occupied.clear();
    this.hideGhost();
  }
}

/** Ramp direction from the tiles picked on a ramp (exactly two, on one side), or undefined. */
export function rampDir(tiles) {
  const cut = tiles.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
  if (cut.length !== 2) return undefined;
  return RAMP_SIDES.find(([pair]) => pair[0] === cut[0] && pair[1] === cut[1])?.[1];
}

export function touch(a, b, e = 0.15) {
  return a.minX <= b.maxX + e && a.maxX >= b.minX - e && a.minY <= b.maxY + e && a.maxY >= b.minY - e && a.minZ <= b.maxZ + e && a.maxZ >= b.minZ - e;
}
