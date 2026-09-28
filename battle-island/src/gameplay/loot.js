/**
 * Floor loot, chests, supply drops and the rules for picking up, swapping,
 * stacking and dropping items. Ammo and materials auto-collect on touch;
 * weapons and consumables need the interact key.
 */

import * as THREE from 'three';
import { itemModel } from '../entities/models.js';
import { RARITIES, rollFloor, rollChest, rollSupply, itemName } from './items.js';
import { WATER_Y } from '../world/physics.js';
import { sfx } from '../core/audio.js';
import { pickupRow } from '../net/sync.js';

export class Loot {
  constructor(game) {
    this.game = game;
    this.pickups = [];
    this.drops = [];
    this.nid = 0;
    this.beamGeo = new THREE.CylinderGeometry(0.08, 0.18, 2.6, 6, 1, true);
    this.beamGeo.translate(0, 1.3, 0);
    this.ringGeo = new THREE.RingGeometry(0.35, 0.5, 16);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.beamMats = RARITIES.map((r) => new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  }

  spawnInitial(rng) {
    for (const p of this.game.world.lootSpots) {
      if (rng() > 0.8) continue;
      const items = rollFloor(rng);
      items.forEach((it, i) => this.drop(it, p.clone().add(new THREE.Vector3(i * 0.7, 0.3, 0)), null, true));
    }
  }

  drop(it, pos, vel = null, settleNow = false) {
    if (!it || (it.count !== undefined && it.count <= 0)) return null;
    const g = new THREE.Group();
    const model = itemModel(it);
    model.scale.setScalar(it.kind === 'weapon' ? 1.3 : 1.5);
    g.add(model);
    const rar = it.kind === 'weapon' ? it.rarity : 0;
    if (it.kind === 'weapon' || it.kind === 'consumable' || it.kind === 'throwable') {
      const beam = new THREE.Mesh(it.kind === 'weapon' ? this.beamGeo : this.ringGeo, this.beamMats[rar]);
      g.add(beam);
    }
    g.position.copy(pos);
    this.game.scene.add(g);
    const pk = { nid: ++this.nid, it, pos: g.position, vel: vel || new THREE.Vector3(), g, model, t: Math.random() * 6, settled: false, age: 0 };
    if (settleNow) this._settle(pk);
    this.pickups.push(pk);
    if (settleNow) this.announce(pk);
    return pk;
  }

  /** Host: tell clients about a new or changed pickup (once it has landed). */
  announce(pk) {
    this.game.net?.push?.(['pk+', pickupRow(pk)]);
  }

  // ---- client side: pickups mirrored from the host
  netAdd(row) {
    const old = this.pickups.find((k) => k.nid === row[0]);
    if (old) this.remove(old, true);
    const it = { ...rowToItemShim(row) };
    const pk = this.drop(it, new THREE.Vector3(row[4] / 10, row[5] / 10 + 0.05, row[6] / 10), null, false);
    pk.nid = row[0];
    pk.settled = true;
    pk.age = 1;
    return pk;
  }

  netRemove(nid) {
    const pk = this.pickups.find((k) => k.nid === nid);
    if (pk) this.remove(pk, true);
  }

  netReconcile(rows) {
    const keep = new Set(rows.map((r) => r[0]));
    for (const pk of [...this.pickups]) if (!keep.has(pk.nid)) this.remove(pk, true);
    for (const r of rows) {
      const pk = this.pickups.find((k) => k.nid === r[0]);
      if (!pk || JSON.stringify(pickupRow(pk).slice(0, 4)) !== JSON.stringify(r.slice(0, 4))) this.netAdd(r);
      else pk.pos.set(r[4] / 10, r[5] / 10, r[6] / 10);
    }
  }

  openChestVisual(ch) {
    if (!ch || ch.opened) return;
    ch.opened = true;
    this.game.tweens.push({ t: 0, d: 0.3, fn: (k) => { ch.lid.rotation.x = -k * 1.6; ch.lid.position.z = -k * 0.3; ch.lid.position.y = 0.66 + k * 0.2; } });
    this.game.effects.burst(ch.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), '#ffd23f', 18, 4, 0.12, 0.8);
    sfx.play('chest', ch.pos);
  }

  _settle(pk) {
    const phys = this.game.world.physics;
    const gy = phys.groundAt(pk.pos.x, pk.pos.z, pk.pos.y + 0.5, 0.2).y;
    pk.pos.y = Math.max(gy, WATER_Y) + 0.05;
    pk.settled = true;
    pk.vel.set(0, 0, 0);
  }

  remove(pk, quiet = false) {
    this.game.scene.remove(pk.g);
    const i = this.pickups.indexOf(pk);
    if (i >= 0) this.pickups.splice(i, 1);
    if (!quiet) this.game.net?.push?.(['pk-', pk.nid]);
  }

  /** Drops everything an eliminated actor carried. */
  dropAll(actor) {
    const out = [];
    for (const s of actor.slots) if (s) out.push(s);
    for (const [id, count] of Object.entries(actor.ammo)) if (count > 0) out.push({ kind: 'ammo', id, count });
    for (const [id, count] of Object.entries(actor.mats)) if (count > 0) out.push({ kind: 'mat', id, count: Math.min(count, 999) });
    out.forEach((it, i) => {
      const a = (i / out.length) * Math.PI * 2;
      this.drop(it, actor.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(Math.cos(a) * 3, 5, Math.sin(a) * 3));
    });
    actor.slots = [null, null, null, null, null];
  }

  nearest(actor, maxD = 2.4, filter = null) {
    let best = null, bd = maxD;
    for (const pk of this.pickups) {
      if (filter && !filter(pk)) continue;
      const d = Math.hypot(pk.pos.x - actor.pos.x, pk.pos.z - actor.pos.z) + Math.abs(pk.pos.y - actor.pos.y - 0.3) * 0.5;
      if (d < bd) { bd = d; best = pk; }
    }
    return best;
  }

  nearestChest(actor, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const ch of this.game.world.chests) {
      if (!ch || ch.opened) continue;
      const d = ch.pos.distanceTo(actor.pos);
      if (d < bd) { bd = d; best = ch; }
    }
    return best;
  }

  /** Interact pickup with swap rules. Returns a status string for the HUD. */
  take(actor, pk, forceSwap = false) {
    const it = pk.it;
    if (actor.hasRoomFor(it) && !(forceSwap && actor.sel >= 0)) {
      const left = actor.addItem(it);
      if (left) {
        pk.it = left;
        this.announce(pk);
      } else this.remove(pk);
      if (actor === this.game.player) sfx.play('pickup');
      return 'ok';
    }
    // full: swap with the held slot
    if (actor.sel < 0) return 'full';
    const old = actor.takeSelected();
    const slot = actor.slots.indexOf(null);
    actor.slots[slot] = { ...it };
    actor.select(slot);
    this.remove(pk);
    this.drop(old, actor.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2));
    if (actor === this.game.player) sfx.play('pickup');
    return 'swap';
  }

  dropSelected(actor) {
    const it = actor.takeSelected();
    if (!it) return false;
    const f = new THREE.Vector3(-Math.sin(actor.aimYaw), 0, -Math.cos(actor.aimYaw));
    this.drop(it, actor.pos.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(f, 0.6), f.multiplyScalar(3).add(new THREE.Vector3(0, 3, 0)));
    return true;
  }

  openChest(actor, ch) {
    if (ch.opened) return;
    ch.opened = true;
    if (actor && actor.stats) actor.stats.chests++;
    this.game.net?.push?.(['ch', this.game.world.chests.indexOf(ch)]);
    const rng = Math.random;
    let items = ch.supply ? rollSupply(rng) : rollChest(rng);
    if (ch.legendary && items[0].kind === 'weapon') items[0].rarity = 4;
    const base = ch.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    items.forEach((it, i) => {
      const a = ch.group.rotation.y + (i - (items.length - 1) / 2) * 0.6;
      this.drop(it, base.clone(), new THREE.Vector3(Math.sin(a) * 2.2, 5, Math.cos(a) * 2.2));
    });
    this.game.tweens.push({ t: 0, d: 0.3, fn: (k) => { ch.lid.rotation.x = -k * 1.6; ch.lid.position.z = -k * 0.3; ch.lid.position.y = 0.66 + k * 0.2; } });
    this.game.effects.burst(base, '#ffd23f', 18, 4, 0.12, 0.8);
    sfx.play('chest', ch.pos);
  }

  /** A crate that floats down under a balloon, then opens like a chest. */
  supplyDrop(x, z) {
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshLambertMaterial({ color: '#3f7bff', emissive: '#0b2a66' }));
    crate.position.y = 0.6;
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), new THREE.MeshLambertMaterial({ color: '#ff5ca8', emissive: '#551133' }));
    balloon.position.y = 4.2;
    balloon.scale.y = 1.2;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    line.position.y = 2.4;
    g.add(crate, balloon, line);
    g.position.set(x, 120, z);
    this.game.scene.add(g);
    this.drops.push({ g, balloon, x, z });
    this.game.net?.push?.(['sdp', Math.round(x * 10), Math.round(z * 10)]);
  }

  update(dt, t, visualOnly = false) {
    const phys = this.game.world.physics;
    for (const pk of this.pickups) {
      pk.age += dt;
      if (!pk.settled) {
        pk.vel.y -= 20 * dt;
        pk.pos.addScaledVector(pk.vel, dt);
        const gy = Math.max(phys.groundAt(pk.pos.x, pk.pos.z, pk.pos.y + 0.3, 0.2).y, WATER_Y);
        if (pk.pos.y <= gy + 0.05 && pk.vel.y <= 0) {
          pk.pos.y = gy + 0.05;
          pk.settled = true;
          pk.vel.set(0, 0, 0);
          this.announce(pk);
        }
      }
      pk.model.rotation.y = t * 1.2 + pk.t;
      pk.model.position.y = 0.25 + Math.sin(t * 2.5 + pk.t) * 0.08;
    }
    if (visualOnly) {
      // clients: falling supply crates are cosmetic; the host creates the chest
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.g.position.y -= 7 * dt;
        if (d.g.position.y <= phys.groundAt(d.x, d.z, d.g.position.y, 0.5).y) {
          this.game.scene.remove(d.g);
          this.drops.splice(i, 1);
        }
      }
      return;
    }
    // reboot cards expire if nobody grabs them
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (pk.it.kind === 'card' && this.game.time > pk.it.expires) this.remove(pk);
    }
    // auto-collect ammo, materials and teammates' reboot cards (also while swimming)
    for (const a of this.game.actors) {
      if (!a.alive || !(a.canAct() || (a.state === 'swim' && !a.downed))) continue;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        if (pk.it.kind === 'card') {
          if (pk.it.team !== a.team || pk.it.id === a.id || pk.age < 0.5) continue;
          if (Math.abs(pk.pos.x - a.pos.x) > 1.8 || Math.abs(pk.pos.z - a.pos.z) > 1.8 || Math.abs(pk.pos.y - a.pos.y) > 2.2) continue;
          if (!a.cards.includes(pk.it.id)) a.cards.push(pk.it.id);
          this.remove(pk);
          if (a === this.game.player) {
            sfx.play('pickup');
            this.game.hud?.toast(`Got ${pk.it.name}'s reboot card! Take it to a reboot van (blue van icon on the map).`, '#39f0ff', 4);
          }
          continue;
        }
        if ((pk.it.kind !== 'ammo' && pk.it.kind !== 'mat' && pk.it.kind !== 'coin') || pk.age < 0.5) continue;
        if (Math.abs(pk.pos.x - a.pos.x) > 1.5 || Math.abs(pk.pos.z - a.pos.z) > 1.5 || Math.abs(pk.pos.y - a.pos.y) > 2) continue;
        if (pk.it.kind === 'mat' && this.game.mode === 'zerobuild') continue;
        const before = pk.it.count;
        const left = a.addItem(pk.it);
        if (a === this.game.player && (!left || left.count < before)) {
          sfx.play('pickup');
          this.game.hud?.toast(`+${before - (left ? left.count : 0)} ${itemName(pk.it)}`, pk.it.kind === 'coin' ? '#ffd23f' : '#ffffff', 1.2);
          if (pk.it.kind === 'coin') sfx.play('coin');
        }
        if (left) {
          pk.it = left;
          this.announce(pk);
        } else this.remove(pk);
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.g.position.y -= 7 * dt;
      d.balloon.rotation.y += dt;
      const gy = phys.groundAt(d.x, d.z, d.g.position.y, 0.5).y;
      if (d.g.position.y <= Math.max(gy, WATER_Y)) {
        this.game.scene.remove(d.g);
        const ch = this.game.world.chest(d.x, Math.max(gy, WATER_Y), d.z, 0, true);
        ch.supply = true;
        this.game.net?.push?.(['ch+', this.game.world.chests.length - 1, Math.round(ch.pos.x * 10), Math.round(ch.pos.y * 10), Math.round(ch.pos.z * 10), 1, 1]);
        this.drops.splice(i, 1);
      }
    }
  }

  clear() {
    for (const pk of this.pickups) this.game.scene.remove(pk.g);
    for (const d of this.drops) this.game.scene.remove(d.g);
    this.pickups = [];
    this.drops = [];
  }
}

const KIND_S = ['weapon', 'consumable', 'throwable', 'ammo', 'mat', 'card', 'coin', 'key'];
function rowToItemShim(r) {
  const kind = KIND_S[r[1]];
  if (kind === 'weapon') return { kind, id: r[2], rarity: r[3], mag: r[7] };
  if (kind === 'card') return { kind, id: r[2], team: r[3], name: r[7], expires: Infinity };
  return { kind, id: r[2], count: r[3] };
}
