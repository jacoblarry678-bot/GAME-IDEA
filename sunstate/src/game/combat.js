/**
 * Hitscan firing and melee shared by the player and police: ray tests against
 * the static world, characters (vertical cylinders) and vehicles (oriented
 * boxes), damage, gunshot events for witnesses, and simple visual effects.
 */
import * as THREE from 'three';
import { Collider, rayCollider } from '../world/collision.js';
import { radial } from '../world/textures.js';

export class Combat {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.tracers = [];
    const tmat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = new THREE.Line(g, tmat.clone());
      l.visible = false; l.frustumCulled = false;
      scene.add(l);
      this.tracers.push({ line: l, t: 0 });
    }
    this.flashes = [];
    const fmat = new THREE.SpriteMaterial({ map: radial(), color: 0xffc860, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(fmat.clone());
      s.visible = false; s.scale.setScalar(0.5);
      scene.add(s);
      this.flashes.push({ s, t: 0 });
    }
    this.puffs = [];
    const pmat = new THREE.SpriteMaterial({ map: radial(), color: 0xb8b0a0, transparent: true, depthWrite: false });
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(pmat.clone());
      s.visible = false;
      scene.add(s);
      this.puffs.push({ s, t: 0, life: 0.5, vy: 0 });
    }
    this.ti = 0; this.fi = 0; this.pi = 0;
  }

  dispose() {
    const scene = this.game.engine.scene;
    for (const t of this.tracers) scene.remove(t.line);
    for (const f of this.flashes) scene.remove(f.s);
    for (const f of this.puffs) scene.remove(f.s);
  }

  /** Nearest hit along a ray. ignore = character or vehicle to skip. */
  raycast(ox, oy, oz, dx, dy, dz, maxT, ignore = null) {
    let best = this.game.world.collision.raycast(ox, oy, oz, dx, dy, dz, maxT, (c) => c.tag !== 'glass');
    if (best) best.kind = 'world';
    let bestT = best ? best.t : maxT;
    for (const ch of this.game.allCharacters()) {
      if (ch === ignore || ch.dead || ch.vehicle) continue;
      const t = rayCylinder(ox, oy, oz, dx, dy, dz, ch.pos.x, ch.pos.z, 0.32, ch.pos.y + (ch.knockT > 0 ? 0 : 0), ch.pos.y + (ch.knockT > 0 ? 0.5 : ch.crouch ? 1.2 : ch.height), bestT);
      if (t !== null && t < bestT) { bestT = t; best = { t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, kind: 'character', character: ch }; }
    }
    for (const v of this.game.vehicles) {
      if (v === ignore) continue;
      if (Math.hypot(v.pos.x - ox, v.pos.z - oz) > maxT * Math.hypot(dx, dz) + 6) continue;
      const col = new Collider({ type: 'box', cx: v.pos.x, cz: v.pos.z, hx: v.hx, hz: v.hz, angle: v.yaw, y0: v.pos.y + 0.2, y1: v.pos.y + v.def.height });
      const r = rayCollider(col, ox, oy, oz, dx, dy, dz, bestT);
      if (r && r.t < bestT) {
        bestT = r.t; best = { ...r, kind: 'vehicle', vehicle: v };
        // shots through the glass can hit occupants
        const occ = v.seats.find(Boolean);
        if (occ && r.y > v.pos.y + v.def.height * 0.62 && occ !== ignore && Math.random() < 0.5) best = { ...r, kind: 'character', character: occ };
      }
    }
    return best;
  }

  /** Fire a hitscan weapon. Returns the hit (or null). */
  fire(shooter, from, dir, weapon, spread = 0) {
    const d = dir.clone();
    if (spread > 0) {
      d.x += (Math.random() - 0.5) * 2 * spread;
      d.y += (Math.random() - 0.5) * 2 * spread;
      d.z += (Math.random() - 0.5) * 2 * spread;
      d.normalize();
    }
    const hit = this.raycast(from.x, from.y, from.z, d.x, d.y, d.z, weapon.range, shooter.vehicle || shooter);
    const end = hit ? new THREE.Vector3(hit.x, hit.y, hit.z) : from.clone().addScaledVector(d, weapon.range);
    this.tracer(from, end);
    this.flash(from);
    if (hit) {
      if (hit.kind === 'character') hit.character.damage(weapon.damage * (0.9 + Math.random() * 0.2), shooter, 'bullet');
      else if (hit.kind === 'vehicle') { hit.vehicle.applyDamage(weapon.damage * 0.9 * (hit.vehicle.bulletMul || 1), 'bullet'); this.puff(end, 0x999999, 0.2); }
      else this.puff(end, 0xc8bfae, 0.35);
    }
    this.game.events.emit('gunshot', { shooter, x: from.x, y: from.y, z: from.z, hit, loudness: weapon.loudness });
    this.game.audio?.gunshot(from, shooter === this.game.player);
    return hit;
  }

  /** Melee: the closest living character in front of the attacker. */
  melee(attacker, weapon) {
    const fx = Math.sin(attacker.yaw), fz = Math.cos(attacker.yaw);
    let best = null, bd = weapon.range + 0.4;
    for (const ch of this.game.allCharacters()) {
      if (ch === attacker || ch.dead || ch.vehicle) continue;
      const dx = ch.pos.x - attacker.pos.x, dz = ch.pos.z - attacker.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bd || Math.abs(ch.pos.y - attacker.pos.y) > 1) continue;
      if ((dx * fx + dz * fz) / (dist || 1) < 0.5) continue;
      best = ch; bd = dist;
    }
    this.game.audio?.whoosh(attacker.pos);
    if (best) {
      best.damage(weapon.damage, attacker, 'melee');
      best.vel.x += fx * 2.5; best.vel.z += fz * 2.5;
      this.game.audio?.punch(best.pos);
      this.game.events.emit('assault', { attacker, victim: best });
    }
    return best;
  }

  tracer(a, b) {
    const t = this.tracers[this.ti++ % this.tracers.length];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    t.line.geometry.computeBoundingSphere();
    t.line.visible = true; t.t = 0.06;
    t.line.material.opacity = 0.9;
  }

  flash(p) {
    const f = this.flashes[this.fi++ % this.flashes.length];
    f.s.position.copy(p); f.s.visible = true; f.t = 0.05;
    f.s.scale.setScalar(0.35 + Math.random() * 0.25);
  }

  puff(p, color, size = 0.4) {
    const f = this.puffs[this.pi++ % this.puffs.length];
    f.s.position.copy(p); f.s.visible = true; f.t = 0; f.life = 0.6; f.vy = 0.6;
    f.s.material.color.setHex(color); f.s.material.opacity = 0.8;
    f.s.scale.setScalar(size); f.size = size;
  }

  update(dt) {
    for (const t of this.tracers) if (t.line.visible) { t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.06); if (t.t <= 0) t.line.visible = false; }
    for (const f of this.flashes) if (f.s.visible) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    for (const f of this.puffs) if (f.s.visible) {
      f.t += dt;
      const k = f.t / f.life;
      f.s.position.y += f.vy * dt;
      f.s.scale.setScalar(f.size * (1 + k * 2));
      f.s.material.opacity = 0.8 * (1 - k);
      if (k >= 1) f.s.visible = false;
    }
  }
}

/** Ray vs vertical cylinder; returns t or null. */
export function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, maxT) {
  const fx = ox - cx, fz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0 || t > maxT) return null;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return null;
  return t;
}
