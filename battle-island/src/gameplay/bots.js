/**
 * Bot brains. Bots drive the same Actor/Combat/Loot/Building APIs as the
 * player: they pick a drop spot, skydive, loot chests and floor items,
 * harvest, fight with range-appropriate weapons, wall up under fire, heal,
 * and rotate ahead of the storm. They are always labelled as bots.
 */

import * as THREE from 'three';
import { newInput } from '../entities/actor.js';
import { WEAPONS, CONSUMABLES, stackMax } from './items.js';

export const BOT_NAMES = ['Sprocket', 'Pixel', 'Nugget', 'Biscuit', 'Waffles', 'Turbo', 'Zippy', 'Noodle', 'Gizmo', 'Rocket', 'Dash', 'Bubbles', 'Scooter', 'Muffin', 'Tater', 'Blaze', 'Jellybean', 'Pogo', 'Comet', 'Sparky', 'Taco', 'Ziggy', 'Fuzzy', 'Doodle', 'Marble', 'Chip', 'Rascal', 'Pebble', 'Mango', 'Bolt', 'Nacho', 'Zoom'];

const tmp = new THREE.Vector3();

export class BotBrain {
  constructor(game, actor, rng) {
    this.game = game;
    this.a = actor;
    this.rng = rng;
    this.skill = 0.3 + rng() * 0.45;
    this.inp = newInput();
    this.mode = 'roam';
    this.goal = null;
    this.goalObj = null;
    this.enemy = null;
    this.seenT = 0;
    this.react = 0;
    this.think = rng() * 0.3;
    this.side = rng() < 0.5 ? 1 : -1;
    this.sideT = 0;
    this.stuck = { x: 0, z: 0, t: 0, n: 0 };
    this.avoid = 0;
    this.avoidDir = 1;
    this.burst = 0;
    this.pause = 0;
    this.wallCd = 0;
    this.blacklist = new Set();
    this.dropTarget = null;
    this.jumpT = 0;
    this.lastHp = 200;
    this.hurtT = 99;
    this.emoteT = 0;
  }

  pickDrop(world) {
    const r = this.rng();
    let p;
    if (r < 0.6) {
      const poi = [...world.pois, ...world.minor][Math.floor(this.rng() * (world.pois.length + world.minor.length))];
      p = new THREE.Vector3(poi.x + (this.rng() - 0.5) * 30, 0, poi.z + (this.rng() - 0.5) * 30);
    } else {
      const s = world.lootSpots[Math.floor(this.rng() * world.lootSpots.length)];
      p = new THREE.Vector3(s.x, 0, s.z);
    }
    this.dropTarget = p;
  }

  // ---------------------------------------------------------------- helpers
  _steer(goal, dt) {
    const a = this.a;
    let dx = goal.x - a.pos.x, dz = goal.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) return 0;
    dx /= dist;
    dz /= dist;
    const phys = this.game.world.physics;
    if (this.avoid > 0) {
      this.avoid -= dt;
      const c = Math.cos(1.2 * this.avoidDir), s = Math.sin(1.2 * this.avoidDir);
      const nx = dx * c - dz * s, nz = dx * s + dz * c;
      dx = nx;
      dz = nz;
    } else if (a.grounded) {
      const low = phys.raycast(a.pos.x, a.pos.y + 0.6, a.pos.z, dx, 0, dz, 1.3);
      if (low) {
        const high = phys.raycast(a.pos.x, a.pos.y + 2.2, a.pos.z, dx, 0, dz, 1.3);
        if (!high) this.inp.jump = true;
        else {
          // try the side with more room
          const c = 0.9;
          const lx = dx * Math.cos(c) - dz * Math.sin(c), lz = dx * Math.sin(c) + dz * Math.cos(c);
          const left = phys.raycast(a.pos.x, a.pos.y + 0.6, a.pos.z, lx, 0, lz, 3);
          this.avoidDir = left ? -1 : 1;
          this.avoid = 0.7;
        }
      }
    }
    this.inp.mx = dx;
    this.inp.mz = dz;
    return dist;
  }

  _face(x, y, z, dt, rate = 6) {
    const a = this.a;
    const e = a.eye;
    const dx = x - e.x, dy = y - e.y, dz = z - e.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let d = yaw - a.aimYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.aimYaw += d * Math.min(1, dt * rate);
    a.aimPitch += (pitch - a.aimPitch) * Math.min(1, dt * rate);
    a.yaw = a.aimYaw;
    return Math.abs(d);
  }

  _aimDir() {
    const a = this.a;
    const cp = Math.cos(a.aimPitch);
    return new THREE.Vector3(-Math.sin(a.aimYaw) * cp, Math.sin(a.aimPitch), -Math.cos(a.aimYaw) * cp);
  }

  _bestWeaponFor(dist) {
    const a = this.a;
    let best = -1, score = -1;
    a.slots.forEach((s, i) => {
      if (!s || s.kind !== 'weapon') return;
      const w = WEAPONS[s.id];
      if (s.mag <= 0 && a.ammo[w.ammo] <= 0) return;
      let sc = 1 + s.rarity * 0.3;
      if (s.id === 'shotgun') sc += dist < 12 ? 4 : dist < 20 ? 1 : -2;
      if (s.id === 'smg') sc += dist < 25 ? 2.5 : 0.5;
      if (s.id === 'ar') sc += dist < 70 ? 2 : 1;
      if (s.id === 'pistol') sc += 0.8;
      if (s.id === 'sniper') sc += dist > 45 ? 3.5 : -1;
      if (s.id === 'launcher') sc += dist > 12 && dist < 60 ? 2.2 : -3;
      if (sc > score) { score = sc; best = i; }
    });
    return best;
  }

  _hasGun() {
    return this.a.slots.some((s) => s && s.kind === 'weapon' && (s.mag > 0 || this.a.ammo[WEAPONS[s.id].ammo] > 0));
  }

  _wantItem(it) {
    const a = this.a;
    if (it.kind === 'ammo' || it.kind === 'mat') return false; // auto
    if (it.kind === 'weapon') {
      const same = a.slots.find((s) => s && s.kind === 'weapon' && s.id === it.id);
      if (same) return it.rarity > same.rarity;
      return a.slots.includes(null) || a.slots.some((s) => s && s.kind === 'weapon' && s.rarity < it.rarity);
    }
    if (it.kind === 'consumable' || it.kind === 'throwable') return a.hasRoomFor(it);
    return false;
  }

  _perceive() {
    const g = this.game;
    const a = this.a;
    const e = a.eye;
    let best = null, bd = this._hasGun() ? 70 : 30;
    const cands = [];
    for (const o of g.actors) {
      if (o === a || !o.alive || o.state === 'bus' || o.team === a.team) continue;
      const d = o.pos.distanceTo(a.pos);
      if (d < bd) cands.push([d, o]);
    }
    cands.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const [d, o] = cands[i];
      // field of view: ~220° unless very close or they shot us
      const fx = -Math.sin(a.aimYaw), fz = -Math.cos(a.aimYaw);
      const dot = ((o.pos.x - a.pos.x) * fx + (o.pos.z - a.pos.z) * fz) / Math.max(0.01, d);
      if (dot < -0.35 && d > 8 && a.lastHitBy !== o) continue;
      const t = o.eye;
      if (g.world.physics.lineOfSight(e.x, e.y, e.z, t.x, t.y - 0.4, t.z)) {
        best = o;
        break;
      }
    }
    if (best && best !== this.enemy) this.react = 0.6 + (1 - this.skill) * 0.7 + this.rng() * 0.3;
    if (best) {
      this.enemy = best;
      this.seenT = 0;
      this.lastSeen = best.pos.clone();
    }
  }

  _pickLootGoal() {
    const g = this.game;
    const a = this.a;
    let best = null, bd = 55;
    for (const ch of g.world.chests) {
      if (ch.opened || this.blacklist.has(ch)) continue;
      if (ch.pos.y - g.world.height(ch.pos.x, ch.pos.z) > 5) continue;
      const d = ch.pos.distanceTo(a.pos);
      if (d < bd) { bd = d; best = { kind: 'chest', obj: ch, pos: ch.pos }; }
    }
    for (const pk of g.loot.pickups) {
      if (this.blacklist.has(pk) || !this._wantItem(pk.it)) continue;
      const d = pk.pos.distanceTo(a.pos) * (pk.it.kind === 'weapon' && !this._hasGun() ? 0.5 : 1);
      if (d < bd) { bd = d; best = { kind: 'pickup', obj: pk, pos: pk.pos }; }
    }
    return best;
  }

  _safePoint() {
    const s = this.game.storm;
    const n = s.stage === 'wait' ? s.next : { c: s.center, r: s.radius };
    const r = Math.max(0, n.r) * 0.55 * Math.sqrt(this.rng());
    const ang = this.rng() * Math.PI * 2;
    return new THREE.Vector3(n.c.x + Math.cos(ang) * r, 0, n.c.y + Math.sin(ang) * r);
  }

  _inSafe(x, z, margin = 0) {
    const s = this.game.storm;
    const n = s.stage === 'wait' ? s.next : { c: s.center, r: s.radius };
    return Math.hypot(x - n.c.x, z - n.c.y) < n.r - margin;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const a = this.a;
    const g = this.game;
    const inp = this.inp;
    inp.jump = false;
    inp.slide = false;
    inp.glide = false;
    inp.sprint = false;
    inp.ads = false;
    inp.dive = 0;
    inp.mx = inp.mz = 0;
    if (!a.alive || a.state === 'bus') return inp;

    if (a.state === 'skydive' || a.state === 'glide') {
      if (this.dropTarget) {
        const d = this._steer(this.dropTarget, dt);
        const agl = a.pos.y - g.world.height(a.pos.x, a.pos.z);
        inp.dive = d < agl * 0.6 ? 1 : 0;
        if (d < 3) inp.mx = inp.mz = 0;
      }
      a.yaw = Math.atan2(-inp.mx, -inp.mz) || a.yaw;
      a.aimYaw = a.yaw;
      return inp;
    }

    // hurt tracking
    const tot = a.hp + a.shield;
    if (tot < this.lastHp) this.hurtT = 0;
    this.lastHp = tot;
    this.hurtT += dt;
    this.wallCd -= dt;
    this.seenT += dt;
    if (this.react > 0) this.react -= dt;

    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.22 + this.rng() * 0.12;
      this._perceive();
      if (this.enemy && (!this.enemy.alive || this.seenT > 4)) this.enemy = null;
      this._decide();
    }

    if (this.emoteT > 0) {
      // victory dance after an elimination, cancelled by danger
      this.emoteT -= dt;
      a.emote = this.emoteT > 0 && !this.enemy && this.hurtT > 1;
      if (a.emote) return inp;
      this.emoteT = 0;
    }
    switch (this.mode) {
      case 'fight': this._fight(dt); break;
      case 'heal': this._heal(dt); break;
      case 'loot': this._loot(dt); break;
      case 'harvest': this._harvest(dt); break;
      default: this._roam(dt);
    }
    if (a.state === 'swim') inp.sprint = true;
    this._stuckCheck(dt);
    // facing when not aiming at something: movement direction
    if (this.mode !== 'fight' && this.mode !== 'harvest' && (inp.mx || inp.mz)) {
      const yaw = Math.atan2(-inp.mx, -inp.mz);
      let d = yaw - a.aimYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.aimYaw += d * Math.min(1, dt * 8);
      a.aimPitch *= 0.9;
      a.yaw = a.aimYaw;
    }
    return inp;
  }

  _decide() {
    const a = this.a;
    const g = this.game;
    const storm = g.storm;
    const outside = storm.outside(a.pos.x, a.pos.z);
    const needRotate = outside || (!this._inSafe(a.pos.x, a.pos.z, 4) && (storm.stage === 'shrink' || storm.timer < 25));
    const hasHeal = a.slots.some((s) => s && s.kind === 'consumable' && ((CONSUMABLES[s.id].hp && a.hp < (CONSUMABLES[s.id].hpCap || 100)) || (CONSUMABLES[s.id].shield && a.shield < (CONSUMABLES[s.id].shieldCap || 100))));
    if (this.enemy && this._hasGun() && !(outside && a.hp < 40)) {
      this.mode = 'fight';
      return;
    }
    if (this.enemy && !this._hasGun() && this.enemy.pos.distanceTo(a.pos) < 4) {
      this.mode = 'fight'; // pickaxe it out
      return;
    }
    if (needRotate) {
      if (this.mode !== 'rotate' || !this.goal || !this._inSafe(this.goal.x, this.goal.z)) this.goal = this._safePoint();
      this.mode = 'rotate';
      return;
    }
    if (hasHeal && a.hp + a.shield < 150 && this.hurtT > 2.5 && this.seenT > 2) {
      this.mode = 'heal';
      return;
    }
    if (this.mode === 'loot' && this.goalObj && !this._goalValid()) this.goalObj = null;
    if (this.mode !== 'loot' || !this.goalObj) {
      const lg = this._pickLootGoal();
      if (lg && (!this._hasGun() || lg.pos.distanceTo(a.pos) < 35 || a.slots.includes(null))) {
        this.mode = 'loot';
        this.goalObj = lg;
        this.goal = lg.pos;
        this.stuck.n = 0;
        return;
      }
    } else return;
    if (g.mode !== 'zerobuild' && a.mats.wood < 60 && this.rng() < 0.3) {
      const tree = this._nearTree();
      if (tree) {
        this.mode = 'harvest';
        this.goalObj = { kind: 'tree', obj: tree };
        return;
      }
    }
    if (this.mode === 'harvest' && this.goalObj?.obj?.alive && a.mats.wood < 120) return;
    if (this.mode !== 'roam' || !this.goal || Math.hypot(this.goal.x - a.pos.x, this.goal.z - a.pos.z) < 4) this.goal = this._safePoint();
    this.mode = 'roam';
  }

  _goalValid() {
    const o = this.goalObj;
    if (!o) return false;
    if (o.kind === 'chest') return !o.obj.opened;
    if (o.kind === 'pickup') return this.game.loot.pickups.includes(o.obj) && this._wantItem(o.obj.it);
    return true;
  }

  _nearTree() {
    const a = this.a;
    const list = this.game.world.physics.query(a.pos.x - 25, a.pos.z - 25, a.pos.x + 25, a.pos.z + 25);
    let best = null, bd = 1e9;
    for (const c of list) {
      if (c.kind !== 'tree' || !c.alive) continue;
      const d = Math.hypot((c.minX + c.maxX) / 2 - a.pos.x, (c.minZ + c.maxZ) / 2 - a.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _roam(dt) {
    if (!this.goal) this.goal = this._safePoint();
    const d = this._steer(this.goal, dt);
    this.inp.sprint = d > 12 && this.a.stamina > 30;
    if (d < 3) this.goal = this._safePoint();
    if (this.mode === 'rotate') this.inp.sprint = true;
  }

  _loot(dt) {
    const a = this.a;
    const g = this.game;
    const o = this.goalObj;
    if (!o || !this._goalValid()) {
      this.goalObj = null;
      this.mode = 'roam';
      return;
    }
    const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
    if (d > 1.6) {
      this._steer(o.pos, dt);
      this.inp.sprint = d > 8 && a.stamina > 25;
      if (d < 20 && this.stuck.n >= 2) this._breakThrough(dt, o.pos);
      return;
    }
    if (Math.abs(o.pos.y - a.pos.y) > 2.5) {
      this.blacklist.add(o.obj);
      this.goalObj = null;
      return;
    }
    if (o.kind === 'chest') g.loot.openChest(a, o.obj);
    else {
      const it = o.obj.it;
      const same = it.kind === 'weapon' ? a.slots.findIndex((s) => s && s.kind === 'weapon' && s.id === it.id) : -1;
      if (same >= 0) {
        a.select(same);
        g.loot.take(a, o.obj, true);
        this.goalObj = null;
        this.mode = 'roam';
        this.think = 0;
        return;
      }
      if (it.kind === 'weapon' && !a.hasRoomFor(it)) {
        // swap out the worst weapon
        let worst = -1, wr = 99;
        a.slots.forEach((s, i) => { if (s && s.kind === 'weapon' && s.rarity < wr) { wr = s.rarity; worst = i; } });
        if (worst >= 0) a.select(worst);
      }
      if (g.loot.take(a, o.obj) === 'full') this.blacklist.add(o.obj);
    }
    this.goalObj = null;
    this.mode = 'roam';
    this.think = 0;
  }

  /** Pickaxe through a destructible wall between us and a loot goal. */
  _breakThrough(dt, target) {
    const a = this.a;
    const dx = target.x - a.pos.x, dz = target.z - a.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    const h = this.game.world.physics.raycast(a.pos.x, a.pos.y + 1.2, a.pos.z, dx / l, 0, dz / l, 2.6);
    if (h && h.c && h.c.hp !== Infinity) {
      if (a.sel !== -1) a.select(-1);
      this._face(h.x, h.y, h.z, dt, 12);
      this.inp.mx = this.inp.mz = 0;
      this.game.combat.swing(a, this._aimDir());
    }
  }

  _harvest(dt) {
    const a = this.a;
    const c = this.goalObj?.obj;
    if (!c || !c.alive) {
      this.mode = 'roam';
      return;
    }
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const d = Math.hypot(cx - a.pos.x, cz - a.pos.z);
    if (d > 1.9) {
      this._steer(new THREE.Vector3(cx, 0, cz), dt);
      this.inp.sprint = d > 10;
      return;
    }
    if (a.sel !== -1) a.select(-1);
    this._face(cx, a.pos.y + 1.2, cz, dt, 12);
    this.game.combat.swing(a, this._aimDir());
  }

  _heal(dt) {
    const a = this.a;
    if (!a.use) {
      let pick = -1;
      a.slots.forEach((s, i) => {
        if (!s || s.kind !== 'consumable' || pick >= 0) return;
        const c = CONSUMABLES[s.id];
        if ((c.shield && a.shield < (c.shieldCap || 100)) || (c.hp && a.hp < (c.hpCap || 100))) pick = i;
      });
      if (pick < 0) {
        this.mode = 'roam';
        return;
      }
      a.select(pick);
      if (a.equipT <= 0 && !a.startUse()) this.mode = 'roam';
    }
    this.inp.crouch = true;
  }

  _fight(dt) {
    const a = this.a;
    const g = this.game;
    const e = this.enemy;
    if (!e || !e.alive) {
      this.mode = 'roam';
      this.inp.crouch = false;
      if (e && !e.alive && this.rng() < 0.4) this.emoteT = 1.5;
      return;
    }
    this.inp.crouch = false;
    const dist = e.pos.distanceTo(a.pos);
    // weapon choice
    const best = this._bestWeaponFor(dist);
    if (best >= 0 && best !== a.sel && a.reloadT <= 0) a.select(best);
    if (best < 0 && a.sel !== -1) a.select(-1);
    const w = a.weapon;
    // aim with human-ish error that shrinks with skill, grows with range and target speed
    const head = this.rng() < 0.12 * this.skill;
    const ty = e.pos.y + (e.state === 'swim' ? 0.9 : head ? e.height - 0.22 : e.height * 0.55);
    const off = this.game.time * 1.7 + a.id;
    const tv = Math.hypot(e.vel.x, e.vel.z);
    const err = (1.2 - this.skill) * (0.45 + dist * 0.032 + tv * 0.1);
    const ang = this._face(e.pos.x + Math.sin(off) * err, ty + Math.cos(off * 1.3) * err * 0.6, e.pos.z + Math.cos(off) * err, dt, 4 + this.skill * 5);
    // movement: keep a preferred distance and strafe
    const ideal = !w ? 1.5 : w.cls === 'Shotgun' ? 5 : w.cls === 'SMG' ? 12 : w.cls === 'Sniper Rifle' ? 60 : 25;
    this.sideT -= dt;
    if (this.sideT <= 0) {
      this.side *= -1;
      this.sideT = 0.8 + this.rng() * 1.4;
    }
    const tx = (e.pos.x - a.pos.x) / Math.max(0.1, dist), tz = (e.pos.z - a.pos.z) / Math.max(0.1, dist);
    const fwd = dist > ideal + 4 ? 1 : dist < ideal - 3 ? -0.7 : 0;
    const goal = tmp.set(a.pos.x + tx * fwd * 3 - tz * this.side * 3, 0, a.pos.z + tz * fwd * 3 + tx * this.side * 3);
    this._steer(goal, dt);
    if (this.rng() < dt * 0.4 && a.grounded) this.inp.jump = true;
    if (w && dist > 15 && dist < 80) this.inp.ads = true;
    a.ads = this.inp.ads;
    // wall up when hurt or reloading
    if (g.mode !== 'zerobuild' && this.wallCd <= 0 && (this.hurtT < 0.4 || a.reloadT > 0) && dist > 5) {
      const mat = ['wood', 'brick', 'metal'].sort((p, q) => a.mats[q] - a.mats[p])[0];
      const s = g.building.spot(a, 'wall', Math.atan2(-tx, -tz), 0);
      if (g.building.place(a, s, mat)) this.wallCd = 3 + this.rng() * 3;
      else this.wallCd = 1;
    }
    // shoot
    if (this.react > 0) return;
    const dir = this._aimDir();
    if (!w) {
      if (dist < 3) g.combat.swing(a, dir);
      return;
    }
    if (ang > 0.25) return;
    if (w.auto) {
      if (this.pause > 0) { this.pause -= dt; return; }
      this.burst += dt;
      if (this.burst > 0.5 + this.skill * 0.6) {
        this.burst = 0;
        this.pause = 0.35 + (1 - this.skill) * 0.5;
      }
    }
    // don't waste launcher/sniper shots without a clear line
    g.combat.fire(a, dir);
    if (a.item && a.item.kind === 'weapon' && a.item.mag === 0) a.startReload();
  }

  _stuckCheck(dt) {
    const a = this.a;
    const s = this.stuck;
    s.t += dt;
    if (s.t < 1.2) return;
    const moved = Math.hypot(a.pos.x - s.x, a.pos.z - s.z);
    const wants = Math.hypot(this.inp.mx, this.inp.mz) > 0.2;
    if (wants && moved < 0.7 && a.grounded) {
      s.n++;
      this.inp.jump = true;
      this.avoidDir = this.rng() < 0.5 ? -1 : 1;
      this.avoid = 0.9;
      if (s.n > 4) {
        if (this.goalObj) this.blacklist.add(this.goalObj.obj);
        this.goalObj = null;
        this.goal = this._safePoint();
        this.mode = 'roam';
        s.n = 0;
      }
    } else if (moved > 2) s.n = 0;
    s.t = 0;
    s.x = a.pos.x;
    s.z = a.pos.z;
  }
}

export { stackMax };
