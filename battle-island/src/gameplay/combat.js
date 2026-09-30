/**
 * Shooting and damage. Hitscan for rifles/SMGs/pistols/shotguns, simulated
 * projectiles (with drop) for the sniper, rockets and thrown Boom Balls.
 * Recoil, bloom, ADS accuracy, magazine/reload rules and headshots live here.
 */

import * as THREE from 'three';
import { THROWABLES, PICKAXE, RARITIES, MATS } from './items.js';
import { sfx } from '../core/audio.js';
import { WATER_Y } from '../world/physics.js';

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.rocketGeo = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshBasicMaterial({ color: '#ff5ca8' });
    this.ballGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.ballMat = new THREE.MeshLambertMaterial({ color: '#ff4f7a', emissive: '#661122' });
  }

  /** Ray vs every living actor except `ignore`. */
  rayActors(o, d, maxT, ignore) {
    let best = null;
    for (const a of this.game.actors) {
      if (!a.alive || a === ignore || a.state === 'bus') continue;
      const h = a.state === 'swim' ? 1.2 : a.height;
      // head sphere
      const hy = a.pos.y + (a.state === 'swim' ? 1.0 : h - 0.22);
      let t = raySphere(o, d, a.pos.x, hy, a.pos.z, 0.3);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { actor: a, t, head: true };
      // body box
      const air = a.state === 'skydive' || a.state === 'glide';
      const top = air ? a.pos.y + 1.7 : hy - 0.3;
      const tb = rayBox(o, d, a.pos.x - 0.4, a.pos.y, a.pos.z - 0.4, a.pos.x + 0.4, top, a.pos.z + 0.4);
      if (tb !== null && tb < maxT && (!best || tb < best.t)) best = { actor: a, t: tb, head: false };
    }
    const B = this.game.boss;
    if (B && B.alive && B !== ignore) {
      const hb = B.hitbox();
      const th = raySphere(o, d, hb.head.x, hb.head.y, hb.head.z, hb.head.r);
      if (th !== null && th < maxT && (!best || th < best.t)) best = { actor: B, t: th, head: true };
      const tb = rayBox(o, d, ...hb.body);
      if (tb !== null && tb < maxT && (!best || tb < best.t)) best = { actor: B, t: tb, head: false };
    }
    return best;
  }

  /** Nearest thing along a ray: world or actor. */
  trace(o, d, maxT, ignore) {
    // occupants shoot out of their own vehicle
    const w = this.game.world.physics.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxT, ignore && ignore.vehicle);
    const lim = w ? w.t : maxT;
    const a = this.rayActors(o, d, lim, ignore);
    if (a) return { t: a.t, actor: a.actor, head: a.head };
    if (w) return { t: w.t, world: w };
    return null;
  }

  spreadDir(dir, cone) {
    if (cone <= 0) return dir.clone();
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const r = new THREE.Vector3().crossVectors(dir, up).normalize();
    const u = new THREE.Vector3().crossVectors(r, dir).normalize();
    const a = Math.random() * Math.PI * 2, m = Math.sqrt(Math.random()) * Math.tan(cone);
    return dir.clone().addScaledVector(r, Math.cos(a) * m).addScaledVector(u, Math.sin(a) * m).normalize();
  }

  /** Current accuracy cone for an actor's held weapon. */
  cone(actor) {
    const w = actor.weapon;
    if (!w) return 0;
    let c = (actor.ads ? w.ads : w.hip) + actor.bloom;
    const sp = Math.hypot(actor.vel.x, actor.vel.z);
    if (sp > 1) c += (actor.ads ? w.ads : w.hip) * 0.4;
    if (!actor.grounded && actor.state !== 'swim') c *= 1.6;
    if (actor.crouch) c *= 0.8;
    return c;
  }

  /**
   * Attempt to fire the held weapon toward `dir` from the actor's eye.
   * Returns recoil (radians) if a shot happened, else 0.
   */
  fire(actor, dir) {
    const it = actor.item;
    const w = actor.weapon;
    if (!w || actor.carrying || !actor.canAct() || actor.fireCd > 0 || actor.equipT > 0 || actor.reloadT > 0 || actor.use) return 0;
    if (it.mag <= 0) {
      if (!actor.startReload() && !actor.isBot) sfx.play('empty');
      return 0;
    }
    it.mag--;
    actor.fireCd = 1 / w.rate;
    actor.emote = false;
    const rar = RARITIES[it.rarity];
    const origin = actor.eye;
    const muzzle = origin.clone().addScaledVector(dir, 0.8).add(new THREE.Vector3(0, -0.25, 0));
    this.game.effects.muzzle(muzzle);
    sfx.play(w.sound, actor.pos);
    actor.model.kick = 1;
    const cone = this.cone(actor);
    if (w.projectile) {
      this._spawnProjectile(actor, origin, this.spreadDir(dir, cone), w, rar);
    } else {
      const pellets = w.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const d = this.spreadDir(dir, cone);
        const hit = this.trace(origin, d, w.range, actor);
        const end = hit ? origin.clone().addScaledVector(d, hit.t) : origin.clone().addScaledVector(d, w.range);
        if (i < 3) this.game.effects.tracer(muzzle, end, actor.isBot ? '#ffd0a8' : '#fff6a8');
        if (!hit) continue;
        let dmg = w.dmg * rar.mult;
        if (w.falloff && hit.t > w.falloff[0]) {
          const k = Math.min(1, (hit.t - w.falloff[0]) / Math.max(1, w.range - w.falloff[0]));
          dmg *= 1 - k * (1 - w.falloff[1]);
        }
        if (hit.actor) {
          if (hit.head) dmg *= w.head;
          this.game.applyDamage(hit.actor, dmg, actor, { head: hit.head, pos: end });
          this.game.effects.burst(end, hit.head ? '#ffd23f' : '#ffffff', 4, 3, 0.08, 0.3);
        } else {
          this._hitWorld(hit.world, dmg, actor, end);
        }
      }
    }
    actor.bloom = Math.min(w.maxBloom, actor.bloom + w.bloom);
    if (it.mag <= 0) actor.startReload();
    return w.recoil;
  }

  _hitWorld(h, dmg, src, pos) {
    this.game.effects.burst(pos, h.c ? '#d9c9a8' : '#8a7a5a', 3, 2, 0.08, 0.35);
    if (h.c) this.game.damageCollider(h.c, dmg, src);
  }

  _spawnProjectile(actor, origin, dir, w, rar) {
    const P = w.projectile;
    let mesh = null;
    if (P.radius) {
      mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      this.game.scene.add(mesh);
    }
    this.projectiles.push({
      kind: P.radius ? 'rocket' : 'bullet',
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(P.speed),
      gravity: P.gravity,
      src: actor,
      w,
      dmg: w.dmg * rar.mult,
      life: 4,
      mesh,
      trail: 0,
    });
  }

  throwItem(actor, dir) {
    const it = actor.item;
    if (!it || it.kind !== 'throwable' || actor.carrying || actor.fireCd > 0 || actor.equipT > 0 || !actor.canAct()) return false;
    const T = THROWABLES[it.id];
    actor.fireCd = 0.9;
    actor.model.kick = 1;
    const mesh = new THREE.Mesh(this.ballGeo, this.ballMat);
    this.game.scene.add(mesh);
    const v = dir.clone().multiplyScalar(19);
    v.y += 4;
    this.projectiles.push({ kind: 'grenade', pos: actor.eye.addScaledVector(dir, 0.6), vel: v, gravity: 20, src: actor, T, life: T.fuse, mesh });
    sfx.play('throw', actor.pos);
    it.count--;
    if (it.count <= 0) {
      actor.slots[actor.sel] = null;
      actor.sel = -1;
    }
    return true;
  }

  /** Pickaxe swing: melee damage and harvesting. Returns true if swung. */
  swing(actor, dir) {
    if (actor.fireCd > 0 || actor.equipT > 0 || actor.carrying || !actor.canAct()) return false;
    actor.fireCd = 1 / PICKAXE.rate;
    actor.model.swing = 1;
    actor.emote = false;
    const o = actor.eye;
    const hit = this.trace(o, dir, PICKAXE.range, actor);
    if (!hit) return true;
    const pos = o.clone().addScaledVector(dir, hit.t);
    if (hit.actor) {
      this.game.applyDamage(hit.actor, PICKAXE.dmg, actor, { pos });
      return true;
    }
    const c = hit.world.c;
    sfx.play('pickaxe', pos);
    if (!c) {
      this.game.effects.burst(pos, '#8a7a5a', 4, 2, 0.08, 0.3);
      return true;
    }
    if (c.harvest && c.material && c.hp !== Infinity && this.game.mode !== 'zerobuild') {
      const got = actor.addItem({ kind: 'mat', id: c.material, count: c.harvest });
      if (actor.stats) actor.stats.harvest += c.harvest - (got ? got.count : 0);
      if (actor === this.game.player) this.game.hud?.matGain(c.material, c.harvest - (got ? got.count : 0));
    }
    this.game.effects.burst(pos, c.material ? MATS[c.material].color : '#cccccc', 6, 3, 0.12, 0.5);
    this.game.damageCollider(c, PICKAXE.structDmg, actor);
    return true;
  }

  explode(pos, radius, dmg, structDmg, src) {
    this.game.effects.explosion(pos, radius);
    this.game.effects.shake = Math.min(1, this.game.effects.shake + 12 / (8 + pos.distanceTo(this.game.camera.position)));
    sfx.play('explosion', pos);
    for (const a of this.game.actors) {
      if (!a.alive || a.state === 'bus') continue;
      _p.set(a.pos.x, a.pos.y + 1, a.pos.z);
      const d = _p.distanceTo(pos);
      if (d > radius) continue;
      let amt = dmg * (1 - (d / radius) * 0.6);
      if (a === src) amt *= 0.5;
      this.game.applyDamage(a, amt, src, { pos: _p.clone(), explosive: true });
    }
    const B = this.game.boss;
    if (B && B.alive && B !== src) {
      const d = Math.max(0, _p.set(B.pos.x, B.pos.y + 2, B.pos.z).distanceTo(pos) - 1.2);
      if (d <= radius) this.game.applyDamage(B, dmg * (1 - (d / radius) * 0.6), src, { pos: B.eye, explosive: true });
    }
    const phys = this.game.world.physics;
    const list = [...phys.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius)];
    const hitPieces = new Set();
    for (const c of list) {
      if (!c.alive || c.hp === Infinity) continue;
      const pool = c.piece || c.vehicle;
      if (pool) {
        // an edited piece or a vehicle has several colliders but one health pool
        if (hitPieces.has(pool)) continue;
        hitPieces.add(pool);
      }
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cy = Math.max(c.minY, Math.min(pos.y, c.maxY));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const d = Math.hypot(cx - pos.x, cy - pos.y, cz - pos.z);
      if (d <= radius) this.game.damageCollider(c, structDmg * (1 - (d / radius) * 0.5), src);
    }
  }

  update(dt) {
    const phys = this.game.world.physics;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      const step = p.vel.length() * dt;
      _v.copy(p.vel).normalize();
      let done = false;
      if (p.kind === 'grenade') {
        const h = phys.raycast(p.pos.x, p.pos.y, p.pos.z, _v.x, _v.y, _v.z, step + 0.16);
        if (h) {
          p.pos.set(h.x, h.y, h.z).addScaledVector(new THREE.Vector3(h.nx, h.ny, h.nz), 0.17);
          const n = new THREE.Vector3(h.nx, h.ny, h.nz);
          p.vel.addScaledVector(n, -2 * p.vel.dot(n)).multiplyScalar(0.45);
        } else p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < WATER_Y - 0.5) p.vel.multiplyScalar(0.8);
        if (p.life <= 0) {
          this.explode(p.pos.clone(), p.T.radius, p.T.dmg, p.T.structDmg, p.src);
          done = true;
        }
      } else {
        const hit = this.trace(p.pos, _v, step, p.src);
        if (hit) {
          const at = p.pos.clone().addScaledVector(_v, hit.t);
          if (p.kind === 'rocket') {
            this.explode(at.addScaledVector(_v, -0.3), p.w.projectile.radius, p.dmg, p.w.projectile.structDmg, p.src);
          } else if (hit.actor) {
            this.game.applyDamage(hit.actor, p.dmg * (hit.head ? p.w.head : 1), p.src, { head: hit.head, pos: at });
            this.game.effects.burst(at, hit.head ? '#ffd23f' : '#ffffff', 6, 3, 0.1, 0.4);
          } else {
            this._hitWorld(hit.world, p.dmg, p.src, at);
          }
          done = true;
        } else {
          const from = p.pos.clone();
          p.pos.addScaledVector(p.vel, dt);
          if (p.kind === 'bullet') this.game.effects.tracer(from, p.pos, '#bff3ff');
          else if ((p.trail += dt) > 0.03) {
            p.trail = 0;
            this.game.effects.particle(p.pos, new THREE.Vector3(0, 0.5, 0), '#dddddd', 0.25, 0.5, 0);
          }
        }
        if (p.life <= 0) {
          if (p.kind === 'rocket') this.explode(p.pos.clone(), p.w.projectile.radius, p.dmg, p.w.projectile.structDmg, p.src);
          done = true;
        }
      }
      if (p.mesh) {
        p.mesh.position.copy(p.pos);
        if (p.kind === 'rocket') p.mesh.lookAt(_p.copy(p.pos).add(p.vel));
      }
      if (done) {
        if (p.mesh) this.game.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.projectiles) if (p.mesh) this.game.scene.remove(p.mesh);
    this.projectiles = [];
  }
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(D[a]) < 1e-9) {
      if (O[a] < mn[a] || O[a] > mx[a]) return null;
      continue;
    }
    let t0 = (mn[a] - O[a]) / D[a], t1 = (mx[a] - O[a]) / D[a];
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return null;
  }
  return tmin;
}
