/**
 * Building: walls, floors, ramps and cones on a world-aligned 4m grid with a
 * 0.8m vertical quantum (so pieces stack cleanly from any terrain height).
 * Pieces cost 10 materials, have per-material health, can be destroyed, and
 * remember their owner. Editing / structural integrity are on the roadmap.
 */

import * as THREE from 'three';
import { Collider } from '../world/physics.js';
import { boxGeo, mat } from '../world/island.js';
import { sfx } from '../core/audio.js';

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
let coneGeo = null;

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
      } else { s.minY = b; s.maxY = b + 1.6; }
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
      m.position.set((s.minX + s.maxX) / 2, s.b + 0.8, (s.minZ + s.maxZ) / 2);
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
    return s.free && actor.mats[material] >= BUILD_COST;
  }

  place(actor, s, material) {
    if (!this.canPlace(actor, s, material)) return null;
    actor.mats[material] -= BUILD_COST;
    const [color, tex] = LOOK[material];
    const mesh = this._meshFor(s, mat(color, tex));
    mesh.castShadow = mesh.receiveShadow = true;
    this.game.scene.add(mesh);
    const hp = BUILD_HP[material];
    const c = new Collider({
      type: s.piece === 'ramp' ? 'ramp' : s.piece === 'cone' ? 'cone' : 'box',
      dir: s.dir,
      minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY, minZ: s.minZ, maxZ: s.maxZ,
      hp, maxHp: hp, material, kind: 'build', owner: actor, mesh,
    });
    c.key = s.key;
    c.onDestroy = () => {
      this.occupied.delete(c.key);
      this.pieces.delete(c);
    };
    this.game.world.physics.add(c);
    this.occupied.set(s.key, c);
    this.pieces.add(c);
    // pop-in
    mesh.scale.setScalar(0.6);
    this.game.tweens.push({ t: 0, d: 0.12, fn: (k) => mesh.scale.setScalar(0.6 + 0.4 * k) });
    sfx.play('build', mesh.position);
    return c;
  }

  clear() {
    for (const c of this.pieces) this.game.scene.remove(c.mesh);
    this.pieces.clear();
    this.occupied.clear();
    this.hideGhost();
  }
}
