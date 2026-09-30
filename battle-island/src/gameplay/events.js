/**
 * The island event for a match (see core/events.js). Everything placed in
 * the world (pumpkins, extra bounce pads) is built in the same order on the
 * host and every client, so it lines up online; loot and supply drops come
 * from the host like any other loot.
 */

import * as THREE from 'three';
import { Collider, WATER_Y } from '../world/physics.js';
import { EVENTS } from '../core/events.js';
import { rollConsumable, mulberry32 } from './items.js';

const SUPPLY_EVERY = 45;

export class IslandEvent {
  constructor(game, id) {
    this.game = game;
    this.id = EVENTS[id] ? id : null;
    this.def = this.id ? EVENTS[this.id] : null;
    this.supplyT = 30;
    this.pumpkins = [];
    this.pads = [];
    this.saved = null;
    if (!this.id) return;
    const W = game.world;
    if (this.id === 'spooky') {
      this._night();
      this._pumpkins();
    }
    if (this.id === 'playground') this._pads();
    // new world props must sync like the island's own (destroyed ids below baseWid are sent)
    W.baseWid = W.physics.nextWid;
  }

  get lowGravity() {
    return this.id === 'lowgrav';
  }

  get golden() {
    return this.id === 'golden';
  }

  // ------------------------------------------------------------ spooky night
  _night() {
    const g = this.game;
    this.saved = { bg: g.scene.background.clone(), fog: g.scene.fog.color.clone(), near: g.scene.fog.near, far: g.scene.fog.far, hemi: g.hemi.intensity, hemiC: g.hemi.color.clone(), sun: g.sun.intensity, sunC: g.sun.color.clone() };
    g.scene.background.set('#1d1540');
    g.scene.fog.color.set('#2a1d4f');
    g.scene.fog.near = 60;
    g.scene.fog.far = 320;
    g.hemi.intensity = 0.7;
    g.hemi.color.set('#9f8cff');
    g.sun.intensity = 0.9;
    g.sun.color.set('#9fb0ff');
  }

  _pumpkins() {
    const W = this.game.world;
    const rng = mulberry32(1031);
    const spots = W.lootSpots.filter((s) => s.y - W.height(s.x, s.z) < 1.5 && W.height(s.x, s.z) > WATER_Y + 0.5);
    const want = 28;
    for (let i = 0; i < spots.length && this.pumpkins.length < want; i += Math.max(1, Math.floor(spots.length / want))) {
      const s = spots[i];
      const a = rng() * Math.PI * 2;
      const x = s.x + Math.cos(a) * 2.2, z = s.z + Math.sin(a) * 2.2;
      const y = W.physics.groundAt(x, z, s.y + 2).y;
      if (Math.abs(y - s.y) > 1.2 || W.physics.query(x - 0.7, z - 0.7, x + 0.7, z + 0.7).some((c) => c.alive && c.maxY > y + 0.3 && c.minY < y + 1.2)) continue;
      this.pumpkins.push(this._pumpkin(x, y, z, rng));
    }
  }

  _pumpkin(x, y, z, rng) {
    const W = this.game.world;
    const g = new THREE.Group();
    const r = 0.55 + rng() * 0.2;
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshLambertMaterial({ color: '#ff8a1a', emissive: '#5a2400' }));
    body.scale.y = 0.8;
    body.position.y = r * 0.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.25, 6), new THREE.MeshLambertMaterial({ color: '#4f7a3a' }));
    stem.position.y = r * 1.6 + 0.08;
    // a glowing face
    const face = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.1, r * 0.8), new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true }));
    face.position.set(0, r * 0.85, r * 0.97);
    g.add(body, stem, face);
    g.position.set(x, y, z);
    g.rotation.y = rng() * Math.PI * 2;
    W.root.add(g);
    const c = new Collider({ kind: 'prop', hp: 30, maxHp: 30, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: y, maxY: y + r * 1.6, mesh: g });
    c.pumpkin = true;
    c.onDestroy = () => this._smash(c);
    W.physics.add(c);
    return c;
  }

  /** Host: a smashed pumpkin spills Benton Bucks and a treat. */
  _smash(c) {
    const g = this.game;
    if (g.role === 'client') return;
    const at = new THREE.Vector3((c.minX + c.maxX) / 2, c.minY + 0.6, (c.minZ + c.maxZ) / 2);
    g.effects.burst(at, '#ff8a1a', 20, 4, 0.12, 0.8);
    g.loot.drop({ kind: 'coin', id: 'bucks', count: 20 }, at.clone(), new THREE.Vector3(1.5, 4, 0));
    if (Math.random() < 0.6) g.loot.drop(rollConsumable(Math.random), at.clone(), new THREE.Vector3(-1.5, 4, 0.5));
    if (c.lastDamager && c.lastDamager.stats) c.lastDamager.stats.pumpkins = (c.lastDamager.stats.pumpkins || 0) + 1;
  }

  // ------------------------------------------------------------ playground party
  _pads() {
    const W = this.game.world;
    const places = [...W.pois.flatMap((p) => [[p.x, p.z, 10], [p.x, p.z, 17]]), ...W.minor.map((p) => [p.x, p.z, 9])];
    for (const [x, z, r] of places) {
      const s = this._open(x, z, r);
      if (!s) continue;
      W.pad(s.x, s.y, s.z);
      this.pads.push(s);
    }
  }

  /** Host: a Bouncy Soda next to every event pad. */
  spawnLoot() {
    if (this.id !== 'playground') return;
    for (const s of this.pads) this.game.loot.drop({ kind: 'consumable', id: 'bounce', count: 1 }, new THREE.Vector3(s.x + 2.2, s.y + 0.4, s.z), null, true);
  }

  _open(x, z, r) {
    const W = this.game.world;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + r;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const h = W.height(px, pz);
      if (h < WATER_Y + 0.6) continue;
      if (Math.abs(W.height(px + 2, pz) - h) > 0.6 || Math.abs(W.height(px, pz + 2) - h) > 0.6) continue;
      if (W.physics.query(px - 3, pz - 3, px + 3.5, pz + 3).some((c) => c.alive && c.maxY > h + 0.3)) continue;
      if (this.pads.some((p) => Math.hypot(p.x - px, p.z - pz) < 6)) continue;
      return new THREE.Vector3(px, h, pz);
    }
    return null;
  }

  // ------------------------------------------------------------ per frame (host)
  update(dt) {
    const g = this.game;
    if (this.id !== 'supply' || g.state !== 'playing') return;
    if ((this.supplyT -= dt) > 0) return;
    this.supplyT = SUPPLY_EVERY;
    const n = g.storm.stage === 'wait' ? g.storm.next : { c: g.storm.center, r: g.storm.radius };
    const a = Math.random() * Math.PI * 2, r = Math.random() * Math.max(10, n.r) * 0.6;
    g.loot.supplyDrop(n.c.x + Math.cos(a) * r, n.c.y + Math.sin(a) * r);
    g.notifyAll('Supply Frenzy: another supply drop is floating down!', '#3f9bff');
  }

  dispose() {
    const g = this.game;
    if (this.saved) {
      const s = this.saved;
      g.scene.background.copy(s.bg);
      g.scene.fog.color.copy(s.fog);
      g.scene.fog.near = s.near;
      g.scene.fog.far = s.far;
      g.hemi.intensity = s.hemi;
      g.hemi.color.copy(s.hemiC);
      g.sun.intensity = s.sun;
      g.sun.color.copy(s.sunC);
      this.saved = null;
    }
  }
}

let faceTex = null;
function faceTexture() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#ffe45c';
  x.beginPath(); x.moveTo(12, 18); x.lineTo(22, 6); x.lineTo(28, 20); x.fill();
  x.beginPath(); x.moveTo(52, 18); x.lineTo(42, 6); x.lineTo(36, 20); x.fill();
  x.beginPath(); x.moveTo(10, 28); x.lineTo(54, 28); x.lineTo(46, 42); x.lineTo(38, 36); x.lineTo(32, 42); x.lineTo(26, 36); x.lineTo(18, 42); x.fill();
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}
