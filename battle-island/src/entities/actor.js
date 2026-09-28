/**
 * Actor: one competitor (player or bot). Owns movement physics, health and
 * shields, the five-slot inventory, ammo/material storage and item timers.
 * Players and bots feed the same `ActorInput`, so bots obey identical rules.
 */

import * as THREE from 'three';
import { GRAVITY, WATER_Y } from '../world/physics.js';
import { CharacterModel } from './characters.js';
import { WEAPONS, CONSUMABLES, THROWABLES, AMMO, MAT_MAX, RARITIES, BUFFS, stackMax } from '../gameplay/items.js';
import { sfx } from '../core/audio.js';

export const RADIUS = 0.38;
export const HEIGHT = 1.85;
export const CROUCH_HEIGHT = 1.3;
const WALK = 5.4, SPRINT = 7.8, CROUCH = 3.0, ADS = 3.8, USE = 3.4;
const JUMP_V = 8.4;

export function newInput() {
  return { mx: 0, mz: 0, jump: false, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false };
}

export class Actor {
  constructor(game, o) {
    this.game = game;
    this.id = o.id;
    this.name = o.name;
    this.isBot = !!o.isBot;
    this.charId = o.charId;
    this.team = o.team ?? o.id;
    this.model = new CharacterModel(o.charId, o.outfit || 0, o.skin || 0, o.cos || {});
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; // body facing (three.js camera convention: forward = -Z at yaw 0)
    this.aimYaw = 0;
    this.aimPitch = 0;
    this.state = 'bus';
    this.grounded = false;
    this.ground = null;
    this.crouch = false;
    this.sprinting = false;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.slideT = 0;
    this.mantle = null;
    this.canRedeploy = false;
    this.airTime = 0;
    this.hp = 100;
    this.shield = 0;
    this.overshield = 0;
    this.overshieldMax = 0;
    this.sinceDamage = 99;
    this.alive = true;
    this.slots = [null, null, null, null, null];
    this.sel = -1; // -1 = pickaxe
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0, rockets: 0 };
    this.mats = { wood: 0, brick: 0, metal: 0 };
    this.fireCd = 0;
    this.equipT = 0;
    this.reloadT = 0;
    this.bloom = 0;
    this.use = null; // { slot, t, total }
    this.overTime = []; // heal-over-time effects
    this.emote = false;
    this.ads = false;
    this.kills = 0;
    this.damageDealt = 0;
    this.lastHitBy = null;
    this.stormTick = 0;
    this.place = 0;
    this.lastPoi = null;
    // teams: downed state, revive/reboot interactions, carried reboot cards
    this.downed = false;
    this.downHp = 0;
    this.downedBy = null;
    this.reviveTarget = null;
    this.reviveT = 0;
    this.rebootVan = null;
    this.rebootT = 0;
    this.cards = [];
    // temporary effects: buff id -> seconds left
    this.buffs = {};
    this.auraT = 0;
    // networking
    this.remote = o.remote || null; // peer label of the human controlling this actor (host side)
    this.human = !!o.human;
    this.ep = 0; // bumps whenever the host teleports this actor
    this.netHeld = null; // client side: what a remote actor is holding
    this.reviveHold = false;
    this.stepT = 0;
    // milestone 4: vehicles, ziplines, Benton Bucks, per-match stats for challenges
    this.vehicle = null;
    this.seat = -1;
    this.zip = null; // { line, t, dir }
    this.bucks = 0;
    this.stats = { driven: 0, zips: 0, chests: 0, spent: 0, upgrades: 0, runovers: 0, bossDmg: 0, bosses: 0, vault: 0, doors: 0, carried: 0 };
    this.carrying = null; // knocked teammate on our shoulders
    this.carriedBy = null;
    this.game.scene.add(this.model.root);
  }

  get height() {
    if (this.downed) return 0.8;
    if (this.state === 'drive') return CROUCH_HEIGHT;
    return this.crouch || this.slideT > 0 ? CROUCH_HEIGHT : HEIGHT;
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + (this.state === 'swim' ? 1.2 : this.height - 0.3), this.pos.z);
  }

  get item() {
    return this.sel >= 0 ? this.slots[this.sel] : null;
  }

  get weapon() {
    const it = this.item;
    return it && it.kind === 'weapon' ? WEAPONS[it.id] : null;
  }

  canAct() {
    // passengers (not drivers) and zipline riders can shoot
    return this.alive && !this.downed && (this.state === 'ground' || this.state === 'air' || this.state === 'zip' || (this.state === 'drive' && this.seat > 0));
  }

  // ------------------------------------------------------------------ health
  heal(hp, shield, hpCap = 100, shieldCap = 100) {
    if (hp) this.hp = Math.max(this.hp, Math.min(hpCap, this.hp + hp));
    if (shield) this.shield = Math.max(this.shield, Math.min(shieldCap, this.shield + shield));
  }

  /** Applies damage through overshield → shield → health. */
  takeDamage(amount, src) {
    if (!this.alive || amount <= 0) return { shield: 0, hp: 0 };
    this.sinceDamage = 0;
    if (src && src !== this) this.lastHitBy = src;
    let rem = amount, sh = 0;
    if (this.overshield > 0) {
      const d = Math.min(this.overshield, rem);
      this.overshield -= d;
      rem -= d;
      sh += d;
    }
    if (this.shield > 0 && rem > 0) {
      const d = Math.min(this.shield, rem);
      this.shield -= d;
      rem -= d;
      sh += d;
    }
    const hpd = Math.min(this.hp, rem);
    this.hp -= hpd;
    this.model.hit();
    return { shield: sh, hp: hpd, dead: this.hp <= 0 };
  }

  // --------------------------------------------------------------- inventory
  /** Adds an item; returns the leftover (or null if fully taken). */
  addItem(it) {
    if (it.kind === 'ammo') {
      const room = AMMO[it.id].max - this.ammo[it.id];
      const take = Math.min(room, it.count);
      this.ammo[it.id] += take;
      return it.count - take > 0 ? { ...it, count: it.count - take } : null;
    }
    if (it.kind === 'coin') {
      this.bucks += it.count;
      return null;
    }
    if (it.kind === 'mat') {
      const room = MAT_MAX - this.mats[it.id];
      const take = Math.min(room, it.count);
      this.mats[it.id] += take;
      return it.count - take > 0 ? { ...it, count: it.count - take } : null;
    }
    if (it.kind === 'consumable' || it.kind === 'throwable') {
      let left = it.count;
      const max = stackMax(it);
      for (const s of this.slots) {
        if (s && s.kind === it.kind && s.id === it.id && s.count < max) {
          const take = Math.min(max - s.count, left);
          s.count += take;
          left -= take;
          if (!left) return null;
        }
      }
      const free = this.slots.indexOf(null);
      if (free >= 0) {
        this.slots[free] = { ...it, count: left };
        if (this.sel === -1 && this.isBot === false && this.slots.filter(Boolean).length === 1) this.select(free);
        return null;
      }
      return left < it.count ? { ...it, count: left } : it;
    }
    const free = this.slots.indexOf(null);
    if (free < 0) return it;
    this.slots[free] = { ...it };
    return null;
  }

  hasRoomFor(it) {
    if (it.kind === 'ammo' || it.kind === 'mat' || it.kind === 'coin') return true;
    if (this.slots.includes(null)) return true;
    if (it.kind === 'consumable' || it.kind === 'throwable') {
      return this.slots.some((s) => s && s.kind === it.kind && s.id === it.id && s.count < stackMax(it));
    }
    return false;
  }

  select(i) {
    if (i === this.sel) return;
    if (i >= 0 && !this.slots[i]) return;
    this.sel = i;
    this.cancelActions();
    this.equipT = 0.25;
    this.ads = false;
  }

  cancelActions() {
    this.reloadT = 0;
    this.use = null;
  }

  /** Removes the selected item from the inventory and returns it. */
  takeSelected() {
    if (this.sel < 0) return null;
    const it = this.slots[this.sel];
    this.slots[this.sel] = null;
    this.cancelActions();
    this.sel = -1;
    this.equipT = 0.2;
    return it;
  }

  startReload() {
    const it = this.item;
    const w = this.weapon;
    if (!w || this.reloadT > 0 || it.mag >= w.mag || this.ammo[w.ammo] <= 0) return false;
    this.reloadT = w.reload * RARITIES[it.rarity].reload;
    this.reloadTotal = this.reloadT;
    if (!this.isBot) sfx.play('reload');
    return true;
  }

  startUse() {
    const it = this.item;
    if (!it || it.kind !== 'consumable' || this.use) return false;
    const c = CONSUMABLES[it.id];
    if (c.buff) {
      this.use = { slot: this.sel, t: c.time, total: c.time };
      this.reloadT = 0;
      return true;
    }
    // refuse when it would do nothing (like the real thing)
    const needHp = c.hp && this.hp < (c.hpCap || 100);
    const needSh = c.shield && this.shield < (c.shieldCap || 100);
    if (!needHp && !needSh) return false;
    this.use = { slot: this.sel, t: c.time, total: c.time };
    this.reloadT = 0;
    return true;
  }

  _finishUse() {
    const it = this.slots[this.use.slot];
    this.use = null;
    if (!it || it.kind !== 'consumable') return;
    const c = CONSUMABLES[it.id];
    if (c.buff) {
      this.buffs[c.buff] = BUFFS[c.buff].dur;
      if (!this.isBot) sfx.play('shield');
    } else if (c.over) this.overTime.push({ hp: c.hp || 0, sh: c.shield || 0, t: c.over, total: c.over });
    else this.heal(c.hp, c.shield, c.hpCap, c.shieldCap);
    if (!this.isBot && !c.buff) sfx.play(c.shield ? 'shield' : 'heal');
    it.count--;
    if (it.count <= 0) {
      this.slots[this.sel] = null;
      this.sel = -1;
    }
  }

  // --------------------------------------------------------------- per frame
  tickTimers(dt) {
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.equipT = Math.max(0, this.equipT - dt);
    this.sinceDamage += dt;
    const w = this.weapon;
    if (w) this.bloom = Math.max(0, this.bloom - dt * (w.maxBloom * 3 + 0.02));
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        const it = this.item;
        if (it && it.kind === 'weapon') {
          const need = WEAPONS[it.id].mag - it.mag;
          const take = Math.min(need, this.ammo[WEAPONS[it.id].ammo]);
          it.mag += take;
          this.ammo[WEAPONS[it.id].ammo] -= take;
        }
      }
    }
    if (this.use) {
      if (this.sel !== this.use.slot || !this.canAct()) this.use = null;
      else if ((this.use.t -= dt) <= 0) this._finishUse();
    }
    for (let i = this.overTime.length - 1; i >= 0; i--) {
      const o = this.overTime[i];
      const k = Math.min(dt, o.t) / o.total;
      this.heal(o.hp * k, o.sh * k);
      if ((o.t -= dt) <= 0) this.overTime.splice(i, 1);
    }
    if (this.overshieldMax > 0 && this.sinceDamage > 6) this.overshield = Math.min(this.overshieldMax, this.overshield + 12 * dt);
    for (const k in this.buffs) {
      if ((this.buffs[k] -= dt) <= 0) delete this.buffs[k];
    }
    if (this.buffs.snack && !this.downed) this.shield = Math.min(100, this.shield + 4 * dt);
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(100, this.stamina + 22 * dt);
  }

  /** Movement for one frame. `inp` fields: see newInput(). */
  move(dt, inp) {
    if (!this.alive || this.state === 'bus' || this.state === 'drive' || this.carriedBy) return;
    const phys = this.game.world.physics;
    if (this.state === 'zip') {
      this._zipMove(dt, inp);
      return;
    }
    if (this.state === 'mantle') {
      const m = this.mantle;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      this.pos.lerpVectors(m.from, m.to, k);
      this.pos.y = m.from.y + (m.to.y - m.from.y) * Math.min(1, k * 1.6);
      if (k >= 1) {
        this.state = 'ground';
        this.grounded = true;
        this.vel.set(0, 0, 0);
        this.mantle = null;
      }
      return;
    }

    const len = Math.hypot(inp.mx, inp.mz);
    const dirX = len > 0.01 ? inp.mx / len : 0, dirZ = len > 0.01 ? inp.mz / len : 0;
    const mag = Math.min(1, len);

    if (this.state === 'skydive' || this.state === 'glide') {
      const gl = this.state === 'glide';
      const maxH = gl ? 13 : 17;
      const acc = gl ? 7 : 11;
      this.vel.x += (dirX * mag * maxH - this.vel.x) * Math.min(1, acc * dt / maxH * 2);
      this.vel.z += (dirZ * mag * maxH - this.vel.z) * Math.min(1, acc * dt / maxH * 2);
      let targetVy = gl ? -6.5 - inp.dive * 3 : -24 - inp.dive * 12;
      if (this.vel.y > targetVy) this.vel.y = Math.max(targetVy, this.vel.y - GRAVITY * dt);
      else this.vel.y += (targetVy - this.vel.y) * Math.min(1, 2 * dt);
      const below = phys.groundAt(this.pos.x, this.pos.z, this.pos.y, RADIUS, 0).y;
      const agl = this.pos.y - below;
      if (!gl && this.vel.y < 0 && agl < 32) this._deploy();
      else if (inp.glide) {
        if (!gl && agl > 10) this._deploy();
        else if (gl && this.canRedeploy) this.state = 'skydive';
      }
    } else if (this.state === 'swim') {
      const sp = (inp.sprint ? 5.2 : 3.8) * (this.buffs.zoom ? 1.3 : 1);
      this.vel.x = dirX * mag * sp;
      this.vel.z = dirZ * mag * sp;
      this.vel.y = 0;
      this.crouch = false;
      this.slideT = 0;
    } else {
      // ground / air
      if (this.slideT > 0) {
        this.slideT -= dt;
        const f = Math.max(0, 1 - 2.2 * dt);
        this.vel.x *= f;
        this.vel.z *= f;
        if (this.slideT <= 0 || Math.hypot(this.vel.x, this.vel.z) < 2.5 || !this.grounded) this.slideT = 0;
      } else {
        let speed = WALK;
        const wantSprint = inp.sprint && mag > 0.3 && !inp.ads && !this.use && this.stamina > 3;
        this.sprinting = wantSprint && this.grounded && !this.crouch;
        if (this.sprinting) {
          speed = SPRINT;
          this.stamina -= 11 * dt;
          this.staminaDelay = 1.1;
        }
        if (this.crouch) speed = CROUCH;
        if (inp.ads) speed = Math.min(speed, ADS);
        if (this.use) speed = Math.min(speed, USE);
        if (this.buffs.zoom) speed *= 1.3;
        if (this.carrying) speed *= 0.72;
        if (this.downed) {
          // crawling: slow, no sprint, no jumps
          speed = 1.7;
          this.sprinting = false;
          inp.jump = false;
          inp.slide = false;
        }
        const acc = this.grounded ? 60 : 14;
        const tx = dirX * mag * speed, tz = dirZ * mag * speed;
        const dx = tx - this.vel.x, dz = tz - this.vel.z;
        const dl = Math.hypot(dx, dz);
        const step = acc * dt;
        if (dl <= step) { this.vel.x = tx; this.vel.z = tz; }
        else { this.vel.x += (dx / dl) * step; this.vel.z += (dz / dl) * step; }
        if (inp.slide && this.sprinting && this.grounded) {
          this.slideT = 0.9;
          this.vel.x = dirX * 11;
          this.vel.z = dirZ * 11;
          this.crouch = false;
        } else if (!this.sprinting || !inp.crouch) {
          this.crouch = inp.crouch && this.state !== 'swim';
        }
      }
      if (inp.jump && this.grounded) {
        this.vel.y = JUMP_V * (this.buffs.bounce ? 1.4 : 1);
        this.grounded = false;
        this.crouch = false;
        this.slideT = 0;
        this.state = 'air';
        sfx.play('jump', this.pos);
      }
      this.vel.y -= GRAVITY * dt;
    }

    // integrate with substeps so fast falls never tunnel
    const dist = Math.hypot(this.vel.x, this.vel.y, this.vel.z) * dt;
    const n = Math.min(8, Math.max(1, Math.ceil(dist / 0.25)));
    const sdt = dt / n;
    const wasGrounded = this.grounded;
    let impact = 0;
    for (let s = 0; s < n; s++) {
      const r = this._step(sdt, inp, dirX, dirZ, mag);
      if (r) impact = Math.min(impact, r);
      if (this.state === 'mantle') return;
    }

    // water
    const terrain = phys.terrainY(this.pos.x, this.pos.z);
    if (this.state !== 'swim' && this.state !== 'skydive' && this.state !== 'glide') {
      if (this.pos.y < WATER_Y - 1.0 && terrain < WATER_Y - 1.0) {
        this.state = 'swim';
        this.vel.y = 0;
        this.grounded = false;
      }
    } else if (this.state === 'swim') {
      const g = phys.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2, RADIUS);
      if (g.y > WATER_Y - 1.1) {
        this.state = 'ground';
        this.pos.y = g.y;
        this.grounded = true;
      } else {
        this.pos.y = WATER_Y - 1.15;
        if (inp.jump && g.y > WATER_Y - 2.2) {
          this.vel.y = JUMP_V;
          this.state = 'air';
        }
      }
    }
    if (this.state === 'skydive' || this.state === 'glide') {
      if (this.grounded || this.pos.y < WATER_Y - 0.5) {
        if (this.pos.y < WATER_Y - 0.5) { this.state = 'swim'; this.grounded = false; }
        else this.state = 'ground';
        this.canRedeploy = false;
        sfx.play('land', this.pos);
      }
    } else if (this.state === 'air' || this.state === 'ground') {
      this.state = this.grounded ? 'ground' : 'air';
    }

    // landing: fall damage
    if (!wasGrounded && this.grounded && impact < -17.5 && !this.buffs.bounce) {
      const dmg = Math.round((-impact - 17.5) * 5);
      this.game.applyDamage(this, dmg, null, { fall: true });
      sfx.play('land', this.pos);
    }
    // launch pads
    if (this.grounded && this.ground && this.ground.kind === 'pad') {
      this.vel.y = 32;
      this.state = 'skydive';
      this.grounded = false;
      this.canRedeploy = true;
      this.crouch = false;
      sfx.play('bounce', this.pos);
    }
    if (!this.grounded) this.airTime += dt; else this.airTime = 0;
    // off the map edge
    const lim = 200;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
  }

  /** Hops onto a zipline at the end nearest to us, heading for the other end. */
  startZip(line) {
    const atA = this.pos.distanceTo(line.base[0]) < this.pos.distanceTo(line.base[1]);
    this.zip = { line, t: atA ? 0.02 : 0.98, dir: atA ? 1 : -1 };
    this.state = 'zip';
    this.grounded = false;
    this.crouch = this.emote = false;
    this.stats.zips++;
    this.vel.set(0, 0, 0);
    this._zipMove(0, { jump: false });
    sfx.play('zip', this.pos);
  }

  _zipMove(dt, inp) {
    const z = this.zip;
    if (!z) {
      this.state = 'air';
      return;
    }
    const L = z.line;
    const speed = 17 * (this.buffs.zoom ? 1.2 : 1);
    z.t += (z.dir * speed * dt) / L.len;
    const end = z.t <= 0 || z.t >= 1;
    z.t = Math.max(0, Math.min(1, z.t));
    const p = L.at(z.t);
    const fx = (L.b.x - L.a.x) / L.len * z.dir, fz = (L.b.z - L.a.z) / L.len * z.dir;
    this.vel.set(fx * speed, 0, fz * speed);
    this.pos.set(p.x, p.y - 2.2, p.z);
    if (end || inp.jump) {
      // let go: keep the momentum, a little hop
      this.zip = null;
      this.state = 'air';
      this.vel.set(fx * speed * 0.6, inp.jump ? JUMP_V * 0.7 : 2, fz * speed * 0.6);
      if (end) {
        // step off beside the tower
        this.pos.x += fx * 1.2;
        this.pos.z += fz * 1.2;
      }
    }
  }

  _deploy() {
    this.state = 'glide';
    if (!this.isBot) sfx.play('glider');
  }

  /** One collision substep. Returns landing velocity (negative) if landed. */
  _step(dt, inp, dirX, dirZ, mag) {
    const phys = this.game.world.physics;
    const p = this.pos;
    const r = RADIUS;
    const h = this.state === 'swim' ? 1.2 : this.height;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    // horizontal push-out
    const stepAllow = this.grounded ? 0.55 : 0.12;
    let wallHit = null;
    const list = phys.query(p.x - r - 0.1, p.z - r - 0.1, p.x + r + 0.1, p.z + r + 0.1);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.type !== 'box') continue;
      if (c.maxY <= p.y + stepAllow || c.minY >= p.y + h) continue;
      const cx = p.x < c.minX ? c.minX : p.x > c.maxX ? c.maxX : p.x;
      const cz = p.z < c.minZ ? c.minZ : p.z > c.maxZ ? c.maxZ : p.z;
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (r - d);
        p.z += (dz / d) * (r - d);
        dx /= d; dz /= d;
      } else {
        // centre inside the box: leave by the shallowest side
        const pen = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
        const k = pen.indexOf(Math.min(...pen));
        if (k === 0) { p.x = c.minX - r; dx = -1; dz = 0; }
        else if (k === 1) { p.x = c.maxX + r; dx = 1; dz = 0; }
        else if (k === 2) { p.z = c.minZ - r; dx = 0; dz = -1; }
        else { p.z = c.maxZ + r; dx = 0; dz = 1; }
      }
      // kill velocity into the wall
      const vn = this.vel.x * dx + this.vel.z * dz;
      if (vn < 0) { this.vel.x -= vn * dx; this.vel.z -= vn * dz; }
      if (!wallHit || c.maxY < wallHit.maxY) wallHit = c;
    }
    // mantle: pushing into a ledge we can climb while in the air or jumping
    if (wallHit && mag > 0.5 && (this.state === 'air' || inp.jump) && this.state !== 'swim') {
      const top = wallHit.maxY;
      const rel = top - p.y;
      if (rel > 0.5 && rel < 2.4) {
        const tx = p.x + dirX * 0.7, tz = p.z + dirZ * 0.7;
        const g = phys.groundAt(tx, tz, top + 0.05, r, 0.1);
        if (Math.abs(g.y - top) < 0.15 && this._clear(tx, top, tz, HEIGHT)) {
          this.state = 'mantle';
          this.mantle = { from: p.clone(), to: new THREE.Vector3(tx, top, tz), t: 0, dur: 0.32 };
          this.vel.set(0, 0, 0);
          return 0;
        }
      }
    }
    if (this.state === 'swim') return 0;
    // vertical
    const prevY = p.y;
    let ny = p.y + this.vel.y * dt;
    if (this.vel.y > 0) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.type !== 'box' || !c.alive) continue;
        if (c.minY < prevY + h - 0.05 || c.minY > ny + h) continue;
        if (!c.containsXZ(p.x, p.z, -0.05 + r * 0.6)) continue;
        ny = c.minY - h;
        this.vel.y = 0;
      }
    }
    const g = phys.groundAt(p.x, p.z, prevY, r);
    let landed = 0;
    if (this.vel.y <= 0 && ny <= g.y) {
      if (!this.grounded) landed = this.vel.y;
      ny = g.y;
      this.vel.y = 0;
      this.grounded = true;
      this.ground = g.c;
    } else if (this.grounded && this.vel.y <= 0 && prevY - g.y < 0.45) {
      ny = g.y; // stick to slopes and stairs going down
      this.vel.y = 0;
      this.ground = g.c;
    } else {
      this.grounded = false;
      this.ground = null;
    }
    p.y = ny;
    return landed;
  }

  _clear(x, y, z, h) {
    const list = this.game.world.physics.query(x - RADIUS, z - RADIUS, x + RADIUS, z + RADIUS);
    for (const c of list) {
      if (c.type !== 'box') continue;
      if (c.maxY > y + 0.1 && c.minY < y + h) return false;
    }
    return true;
  }

  /** Visual sync: model transform + animation state. */
  syncModel(dt, t) {
    const m = this.model;
    m.root.visible = this.alive && this.state !== 'bus';
    if (!m.root.visible) return;
    m.root.position.copy(this.pos);
    let target = this.yaw + Math.PI;
    let d = target - m.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.root.rotation.y += d * Math.min(1, dt * 14);
    const h = this.netHeld || this.heldInfo();
    const { pose, key: held } = h;
    const rar = h.rarity;
    m.setHeld(held, rar);
    m.animate(dt, {
      t,
      speed: this.state === 'drive' || this.state === 'zip' ? 0 : Math.hypot(this.vel.x, this.vel.z),
      state: this.state === 'ground' || this.state === 'drive' ? 'ground' : this.state === 'mantle' || this.state === 'zip' ? 'air' : this.state,
      crouch: this.crouch || this.state === 'drive',
      slide: this.slideT > 0,
      sprint: this.sprinting,
      pitch: this.aimPitch,
      pose: this.downed ? 'none' : pose,
      emote: this.emote,
      downed: this.downed,
    });
  }

  /** What the character model should hold and how it should pose. */
  heldInfo() {
    const it = this.item;
    let pose = 'none', key = 'pickaxe', rarity = 0;
    if (this.building) { pose = 'build'; key = 'none'; }
    else if (this.use) { pose = 'heal'; key = 'none'; }
    else if (it && it.kind === 'weapon') { pose = 'gun'; key = it.id; rarity = it.rarity; }
    else if (it && it.kind === 'throwable') { pose = 'throw'; key = it.id; }
    else if (it && it.kind === 'consumable') { key = 'none'; }
    else pose = 'pickaxe';
    if (this.state === 'skydive' || this.state === 'glide' || this.state === 'swim' || this.downed || (this.state === 'drive' && this.seat === 0)) key = 'none';
    return { pose, key, rarity };
  }

  dispose() {
    this.game.scene.remove(this.model.root);
    this.model.dispose();
  }
}

export { THROWABLES };
