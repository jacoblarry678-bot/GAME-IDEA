/**
 * Halloween in a match (see core/halloween.js): smashable candy pumpkins in
 * Grimstone Manor's patch and around Haunt Hollow, glowing jack-o'-lanterns,
 * floating ghosts, and Halloween loot (Candy Corn, Candy Bars, Ghost Potions,
 * the Pumpkin Launcher). The host's choice is used online; every prop is
 * built in the same order everywhere so world ids line up.
 */

import * as THREE from 'three';
import { WATER_Y } from '../world/physics.js';
import { rollHalloween, mulberry32 } from './items.js';

export class HalloweenFx {
  constructor(game, on) {
    this.game = game;
    this.on = !!on;
    this.pumpkins = [];
    this.ghosts = [];
    this.root = new THREE.Group();
    game.scene.add(this.root);
    if (!this.on) return;
    const W = game.world;
    const rng = mulberry32(3110);
    // the pumpkin patch at Grimstone Manor
    const P = W.pumpkinPatch;
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 6; i++) {
        const x = P.x - P.w / 2 + 1.2 + i * 2.3, z = P.z - P.d / 2 + 0.5 + r * 2;
        this.pumpkins.push(game.eventFx._pumpkin(x, W.physics.groundAt(x, z, P.y + 2).y, z, rng));
      }
    }
    // a ring of candy pumpkins around Haunt Hollow
    const H = W.pois.find((p) => p.id === 'hollow');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2, rr = 18 + (i % 3) * 5;
      const x = H.x + Math.cos(a) * rr, z = H.z + Math.sin(a) * rr;
      const y = W.physics.groundAt(x, z, H.h + 6).y;
      if (y < WATER_Y + 0.5 || W.physics.query(x - 0.8, z - 0.8, x + 0.8, z + 0.8).some((c) => c.alive && c.maxY > y + 0.3)) continue;
      this.pumpkins.push(game.eventFx._pumpkin(x, y, z, rng));
    }
    // glowing jack-o'-lanterns at every named place (decoration only)
    for (const p of [...W.pois, ...W.minor]) {
      for (let k = 0; k < 3; k++) {
        const a = rng() * Math.PI * 2, rr = (p.r || 10) * 0.7 + rng() * 6;
        const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
        const y = W.physics.groundAt(x, z, (p.h || 5) + 6).y;
        if (y < WATER_Y + 0.5) continue;
        const j = jack();
        j.position.set(x, y, z);
        j.rotation.y = Math.atan2(p.x - x, p.z - z);
        this.root.add(j);
      }
    }
    // friendly ghosts drifting around the Hollow and the Manor
    const M = W.pois.find((p) => p.id === 'manor');
    for (let i = 0; i < 6; i++) {
      const c = i < 3 ? H : M;
      const g = ghost();
      this.root.add(g);
      this.ghosts.push({ g, c, a: rng() * 6, r: 10 + rng() * 10, y: c.h + 4 + rng() * 4, s: 0.3 + rng() * 0.3 });
    }
    W.baseWid = W.physics.nextWid; // new props sync like the island's own
  }

  /** Host: extra Halloween loot on top of the normal floor loot. */
  spawnLoot(rng) {
    if (!this.on) return;
    const W = this.game.world;
    for (const p of W.lootSpots) {
      if (rng() > 0.3) continue;
      rollHalloween(rng).forEach((it, i) => this.game.loot.drop(it, p.clone().add(new THREE.Vector3(-0.8 - i * 0.6, 0.3, 0.6)), null, true));
    }
  }

  /** Host: chests sometimes hold a Halloween treat too. */
  chestBonus(items) {
    if (this.on && Math.random() < 0.4) items.push(...rollHalloween(Math.random));
    return items;
  }

  update(dt, t) {
    for (const h of this.ghosts) {
      const a = h.a + t * h.s;
      h.g.position.set(h.c.x + Math.cos(a) * h.r, h.y + Math.sin(t * 1.5 + h.a) * 0.6, h.c.z + Math.sin(a) * h.r);
      h.g.rotation.y = -a;
    }
  }

  dispose() {
    this.game.scene.remove(this.root);
  }
}

const mats = {};
const lm = (c, e) => mats[c + e] || (mats[c + e] = new THREE.MeshLambertMaterial({ color: c, emissive: e || '#000000' }));

function jack() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), lm('#ff8a1a', '#7a3000'));
  body.scale.y = 0.8;
  body.position.y = 0.32;
  g.add(body);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 3), lm('#ffe45c', '#ffb23f'));
    eye.position.set(0.13 * s, 0.4, 0.36);
    eye.rotation.x = Math.PI / 2;
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.04), lm('#ffe45c', '#ffb23f'));
  mouth.position.set(0, 0.24, 0.37);
  g.add(mouth);
  return g;
}

function ghost() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#f4f8ff', emissive: '#556070', transparent: true, opacity: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 1.0, 14, 1, true), m);
  skirt.position.y = -0.5;
  g.add(head, skirt);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lm('#1d1d24'));
    eye.position.set(0.2 * s, 0.2, 0.52);
    g.add(eye);
  }
  return g;
}
