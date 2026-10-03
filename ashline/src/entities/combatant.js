/**
 * Combatant: the shared simulation for any soldier (human or bot). Input
 * arrives as a "command" each tick; the same movement, stance, weapon and
 * equipment rules apply to everyone, so bots never get special physics.
 */
import { moveBody } from '../world/collision.js';
import { WeaponState } from '../combat/weaponState.js';
import { WEAPONS, EQUIPMENT, MELEE } from '../data/weapons.js';
import { applyAttachments } from '../data/attachments.js';

export const MOVE = {
  walk: 5.0,
  sprint: 7.4,
  crouch: 2.7,
  slideSpeed: 9.6,
  slideTime: 0.75,
  slideCooldown: 0.6,
  accel: 55,
  airAccel: 9,
  friction: 11,
  jumpVel: 6.0,
  gravity: 19,
  standH: 1.8,
  crouchH: 1.2,
  slideH: 1.0,
  radius: 0.34,
  mantleTime: 0.38,
};

export const HEALTH = { max: 100, regenDelay: 4.0, regenRate: 38 };

export function newCommand() {
  return {
    moveX: 0, moveZ: 0, sprint: false, crouch: false, jump: false,
    fire: false, firePressed: false, ads: false, reload: false, swap: false,
    swapTo: -1, melee: false, lethal: false, tactical: false, support: null,
    yaw: 0, pitch: 0,
  };
}

let NEXT_ID = 1;

export class Combatant {
  constructor({ name, team, isBot = false, loadout }) {
    this.id = NEXT_ID++;
    this.name = name;
    this.team = team;
    this.isBot = isBot;
    this.loadout = loadout;
    // body (feet position)
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.radius = MOVE.radius;
    this.height = MOVE.standH;
    this.grounded = false;
    this.yaw = 0; this.pitch = 0;
    this.stance = 'stand';
    this.slideT = 0; this.slideCd = 0; this.slideDirX = 0; this.slideDirZ = 0;
    this.mantle = null;
    this.sprinting = false;
    this.sprintOutT = 0;
    this.health = HEALTH.max;
    this.alive = false;
    this.lastDamageT = -99;
    this.spawnProtectT = 0;
    this.respawnT = 0;
    this.deathT = 0;
    this.weapons = [];
    this.cur = 0;
    this.swapT = 0; this.swapDur = 0; this.swapFrom = -1;
    this.meleeT = 0; this.meleeCd = 0;
    this.throwT = 0; this.throwKind = null;
    this.adsT = 0;
    this.lethal = { id: 'frag', count: 0 };
    this.tactical = { id: 'smoke', count: 0 };
    this.stepDist = 0;
    this.kickPitch = 0; this.kickYaw = 0; // accumulated recoil to recover
    this.flinch = 0;
    this.lastKiller = null;
    this.stats = { kills: 0, deaths: 0, assists: 0, score: 0, shots: 0, hits: 0, headshots: 0, streak: 0, bestStreak: 0, damage: 0 };
    this.damageLog = new Map(); // attackerId -> {amount, t}
    this.blindT = 0; // flash effect remaining (s)
    this.blindMax = 1;
    this.supportKills = 0; // eliminations this life that count toward support abilities
    this.supportEarned = {}; // abilities already earned this life
    this.abilities = { recon: 0, supply: 0, strike: 0 }; // ready to use
    this.cmd = newCommand();
    this.prevCmd = newCommand();
    this.events = []; // per-tick events consumed by presentation (footstep, land, jump...)
    this.applyLoadout(loadout);
  }

  applyLoadout(lo) {
    this.loadout = lo;
    const b = lo.builds || {};
    this.weapons = [new WeaponState(applyAttachments(WEAPONS[lo.primary], b[lo.primary])), new WeaponState(applyAttachments(WEAPONS[lo.secondary], b[lo.secondary]))];
    this.perks = new Set(lo.perks || []);
    this.cur = 0;
    this.lethal = { id: lo.lethal, count: EQUIPMENT[lo.lethal].count };
    this.tactical = { id: lo.tactical, count: EQUIPMENT[lo.tactical].count };
  }

  get weapon() { return this.weapons[this.cur]; }
  get eyeHeight() {
    if (!this.alive) return 0.4;
    if (this.stance === 'slide') return 0.85;
    if (this.stance === 'crouch') return 1.08;
    return 1.62;
  }
  get eyeY() { return this.y + this.eyeHeight; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get ads() { return this.adsT > 0.5; }
  get busy() { return this.swapT > 0 || this.meleeT > 0 || this.throwT > 0 || this.mantle; }

  spawnAt(sp) {
    this.x = sp.x; this.y = sp.y; this.z = sp.z;
    this.vx = this.vy = this.vz = 0;
    this.yaw = sp.yaw; this.pitch = 0;
    this.cmd.yaw = sp.yaw; this.cmd.pitch = 0;
    this.health = HEALTH.max;
    this.alive = true;
    this.stance = 'stand'; this.height = MOVE.standH;
    this.grounded = true;
    this.mantle = null; this.slideT = 0;
    this.swapT = 0; this.meleeT = 0; this.throwT = 0; this.adsT = 0;
    this.kickPitch = this.kickYaw = 0;
    this.cur = 0;
    for (const w of this.weapons) w.refill();
    this.lethal.count = this.loadout.noEquipment ? 0 : EQUIPMENT[this.lethal.id].count;
    this.tactical.count = this.loadout.noEquipment ? 0 : EQUIPMENT[this.tactical.id].count;
    this.damageLog.clear();
    this.lastDamageT = -99;
    this.blindT = 0;
    this.supportKills = 0; this.supportEarned = {};
    this.events.push({ type: 'spawn' });
  }

  /**
   * Hit-test a ray against this combatant's hitboxes.
   * Returns { t, zone } or null. Head = sphere, torso and legs = vertical cylinders.
   */
  rayHit(ox, oy, oz, dx, dy, dz, maxT) {
    if (!this.alive) return null;
    const crouch = this.stance !== 'stand';
    const slide = this.stance === 'slide';
    const headY = this.y + (slide ? 0.82 : crouch ? 1.08 : 1.6);
    const torso0 = this.y + (slide ? 0.3 : crouch ? 0.55 : 0.92), torso1 = this.y + (slide ? 0.72 : crouch ? 0.98 : 1.48);
    let best = null;
    // head sphere (center slightly forward of body axis)
    const hx = this.x + Math.sin(this.yaw) * -0.04, hz = this.z + Math.cos(this.yaw) * -0.04;
    const ht = raySphere(ox, oy, oz, dx, dy, dz, hx, headY, hz, 0.15);
    if (ht !== null && ht < maxT) best = { t: ht, zone: 'head' };
    const tt = rayCylinder(ox, oy, oz, dx, dy, dz, this.x, this.z, 0.26, torso0, torso1);
    if (tt !== null && tt < maxT && (!best || tt < best.t)) best = { t: tt, zone: 'torso' };
    const lt = rayCylinder(ox, oy, oz, dx, dy, dz, this.x, this.z, 0.22, this.y, torso0);
    if (lt !== null && lt < maxT && (!best || lt < best.t)) best = { t: lt, zone: 'limb' };
    // arms (approx as wider cylinder band at torso height, limb multiplier)
    if (!best) {
      const at = rayCylinder(ox, oy, oz, dx, dy, dz, this.x, this.z, 0.36, torso0 + 0.1, torso1);
      if (at !== null && at < maxT) best = { t: at, zone: 'limb' };
    }
    return best;
  }

  /** Points used for line-of-sight checks (head, chest, hip). */
  sightPoints() {
    const crouch = this.stance !== 'stand';
    return [
      [this.x, this.y + (crouch ? 1.05 : 1.58), this.z],
      [this.x, this.y + (crouch ? 0.75 : 1.2), this.z],
      [this.x, this.y + (crouch ? 0.4 : 0.6), this.z],
    ];
  }

  /**
   * Advance the simulation one tick. `ctx` is the match: world, time, and
   * callbacks for shooting/throwing/melee.
   */
  tick(dt, ctx) {
    const cmd = this.cmd, prev = this.prevCmd;
    if (!this.alive) { copyCmd(prev, cmd); return; }
    if (this.spawnProtectT > 0) this.spawnProtectT -= dt;
    if (this.meleeCd > 0) this.meleeCd -= dt;
    if (this.slideCd > 0) this.slideCd -= dt;
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt * 4);
    if (this.blindT > 0) this.blindT = Math.max(0, this.blindT - dt);
    const perks = this.perks;

    // ---- aim ----
    this.yaw = cmd.yaw;
    this.pitch = Math.max(-1.5, Math.min(1.5, cmd.pitch));

    // ---- health regen ----
    if (this.health < HEALTH.max && ctx.time - this.lastDamageT > (perks.has('pk_resolve') ? 2.5 : HEALTH.regenDelay)) {
      this.health = Math.min(HEALTH.max, this.health + HEALTH.regenRate * dt);
    }

    const w = this.weapon;
    const def = w.def;
    const moving = Math.abs(cmd.moveX) + Math.abs(cmd.moveZ) > 0.1;

    // ---- stance ----
    const crouchEdge = cmd.crouch && !prev.crouch;
    if (this.mantle) {
      // locked during mantle
    } else if (this.stance === 'slide') {
      this.slideT -= dt;
      if (this.slideT <= 0 || cmd.jump && !prev.jump) {
        this.stance = this.canStand() && !cmd.crouch ? 'stand' : 'crouch';
        this.slideCd = MOVE.slideCooldown;
      }
    } else if (crouchEdge && this.sprinting && this.grounded && this.slideCd <= 0 && this.speed > MOVE.walk) {
      this.stance = 'slide';
      this.slideT = MOVE.slideTime;
      const sp = this.speed || 1;
      this.slideDirX = this.vx / sp; this.slideDirZ = this.vz / sp;
      this.sprinting = false;
      this.events.push({ type: 'slide' });
    } else if (cmd.crouch) {
      this.stance = 'crouch';
    } else if (this.stance === 'crouch' && this.canStand()) {
      this.stance = 'stand';
    }
    const targetH = this.stance === 'slide' ? MOVE.slideH : this.stance === 'crouch' ? MOVE.crouchH : MOVE.standH;
    this.height = targetH;

    // ---- sprint ----
    const wantSprint = cmd.sprint && cmd.moveZ > 0.5 && this.stance === 'stand' && !cmd.ads && !this.busyNoSwap() && !(w.reloading && false);
    if (wantSprint && !this.sprinting && !cmd.fire) {
      this.sprinting = true;
    } else if (this.sprinting && (!wantSprint || cmd.fire)) {
      this.sprinting = false;
      this.sprintOutT = def.handling.sprintOut * (perks.has('pk_dexterity') ? 0.65 : 1);
    }
    if (this.sprintOutT > 0) this.sprintOutT -= dt;

    // ---- ADS ----
    const wantAds = cmd.ads && !def.melee && !this.sprinting && !this.mantle && this.meleeT <= 0 && this.throwT <= 0 && this.stance !== 'slide';
    const adsRate = (perks.has('pk_quickdraw') ? 1.25 : 1) / def.handling.adsTime;
    this.adsT = Math.max(0, Math.min(1, this.adsT + (wantAds ? adsRate : -adsRate * 1.3) * dt));

    // ---- movement ----
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt;
      const k = Math.min(1, m.t / MOVE.mantleTime);
      const up = Math.min(1, k * 1.6);
      const fwd = Math.max(0, (k - 0.35) / 0.65);
      this.y = m.y0 + (m.y1 - m.y0) * easeOut(up);
      this.x = m.x0 + (m.x1 - m.x0) * fwd;
      this.z = m.z0 + (m.z1 - m.z0) * fwd;
      this.vx = this.vz = this.vy = 0;
      if (k >= 1) { this.mantle = null; this.grounded = true; this.events.push({ type: 'land', v: 2 }); }
    } else {
      let speed = MOVE.walk * def.handling.move;
      if (this.sprinting) speed = MOVE.sprint * def.handling.move;
      if (this.stance === 'crouch') speed = MOVE.crouch;
      speed *= 1 - this.adsT * (1 - def.handling.adsMove);
      // desired velocity in world space
      let mx = cmd.moveX, mz = cmd.moveZ;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      let wx = -sy * mz + cy * mx;
      let wz = -cy * mz - sy * mx;
      if (this.stance === 'slide') {
        const k = Math.max(0, this.slideT / MOVE.slideTime);
        const sp = MOVE.crouch + (MOVE.slideSpeed - MOVE.crouch) * k;
        this.vx = this.slideDirX * sp + wx * 0.8;
        this.vz = this.slideDirZ * sp + wz * 0.8;
      } else if (this.grounded) {
        const tx = wx * speed, tz = wz * speed;
        const ax = tx - this.vx, az = tz - this.vz;
        const al = Math.hypot(ax, az);
        const maxA = (moving ? MOVE.accel : MOVE.friction * Math.max(2.5, this.speed)) * dt;
        if (al > maxA) { this.vx += (ax / al) * maxA; this.vz += (az / al) * maxA; } else { this.vx = tx; this.vz = tz; }
      } else {
        this.vx += wx * MOVE.airAccel * dt;
        this.vz += wz * MOVE.airAccel * dt;
        const hs = Math.hypot(this.vx, this.vz), cap = Math.max(MOVE.sprint, hs);
        if (hs > cap) { this.vx *= cap / hs; this.vz *= cap / hs; }
      }
      // jump / mantle
      const jumpEdge = cmd.jump && !prev.jump;
      if (jumpEdge && this.stance !== 'slide') {
        if (!this.tryMantle(ctx.world)) {
          if (this.grounded) {
            if (this.stance === 'crouch') { if (this.canStand()) this.stance = 'stand'; }
            else {
              this.vy = MOVE.jumpVel; this.grounded = false;
              this.events.push({ type: 'jump' });
            }
          }
        }
      } else if (cmd.jump && !this.grounded && this.vy < 1.5) {
        this.tryMantle(ctx.world);
      }
      if (!this.mantle) {
        this.vy -= MOVE.gravity * dt;
        const wasAir = !this.grounded, vyBefore = this.vy;
        moveBody(ctx.world, this, dt);
        if (wasAir && this.grounded && vyBefore < -3) this.events.push({ type: 'land', v: -vyBefore });
        if (this.y < -20) { this.health = 0; ctx.onFell?.(this); }
      }
      // footsteps
      if (this.grounded && this.speed > 1.2 && this.stance !== 'slide') {
        this.stepDist += this.speed * dt;
        const stride = this.sprinting ? 2.3 : this.stance === 'crouch' ? 1.4 : 1.9;
        if (this.stepDist > stride) { this.stepDist = 0; this.events.push({ type: 'step', sprint: this.sprinting, crouch: this.stance === 'crouch' }); }
      }
    }

    // ---- weapon swap ----
    for (const ws of this.weapons) ws.update(dt);
    if (this.swapT > 0) {
      this.swapT -= dt;
      if (this.swapT <= this.swapDur / 2 && this.swapFrom === this.cur) {
        // halfway: switch the active weapon
        this.cur = this.swapTarget;
        this.swapFrom = -1;
        this.events.push({ type: 'swapIn' });
      }
      if (this.swapT < 0) this.swapT = 0;
    }
    const swapReq = (cmd.swap && !prev.swap) ? 1 - this.cur : (cmd.swapTo >= 0 && cmd.swapTo !== this.cur ? cmd.swapTo : -1);
    if (swapReq >= 0 && this.swapT <= 0 && this.meleeT <= 0 && this.throwT <= 0 && !this.mantle) {
      this.weapon.cancelReload();
      this.swapTarget = swapReq;
      this.swapFrom = this.cur;
      this.swapDur = (def.handling.swap * 0.5 + WEAPONS[this.loadout[swapReq === 0 ? 'primary' : 'secondary']].handling.swap * 0.5) * 1.6 * (perks.has('pk_dexterity') ? 0.65 : 1);
      this.swapT = this.swapDur;
      this.events.push({ type: 'swapOut' });
    }
    cmd.swapTo = -1;

    // ---- melee ----
    const wm = def.melee; // dedicated melee weapon: fire swings it
    if (this.meleeT > 0) {
      const before = this.meleeT;
      this.meleeT -= dt;
      const hitAt = this.meleeDur * 0.6;
      if (before > hitAt && this.meleeT <= hitAt) ctx.doMelee(this, this.meleeWeapon);
    } else if (((cmd.melee && !prev.melee) || (wm && cmd.fire && this.swapT <= 0)) && this.meleeCd <= 0 && !this.mantle && this.throwT <= 0) {
      this.weapon.cancelReload();
      this.meleeWeapon = wm ? def : null;
      this.meleeDur = wm ? wm.swing : 0.42;
      this.meleeT = this.meleeDur; this.meleeCd = wm ? wm.swing + 0.05 : MELEE.cooldown;
      this.sprinting = false;
      this.events.push({ type: 'melee', heavy: !!wm });
    }

    // ---- equipment ----
    const throwDur = perks.has('pk_sleight') ? 0.38 : 0.5;
    if (this.throwT > 0) {
      const before = this.throwT;
      this.throwT -= dt;
      const at = 0.18 * (throwDur / 0.5);
      if (before > at && this.throwT <= at) ctx.throwEquipment(this, this.throwKind);
    } else if (!this.busy && this.stance !== 'slide') {
      if (cmd.lethal && !prev.lethal && this.lethal.count > 0) {
        this.lethal.count--; this.throwKind = this.lethal.id; this.throwT = throwDur;
        this.weapon.cancelReload(); this.sprinting = false;
        this.events.push({ type: 'throw', kind: this.throwKind });
      } else if (cmd.tactical && !prev.tactical && this.tactical.count > 0 && (!EQUIPMENT[this.tactical.id].deploy || ctx.canDeploy?.(this, this.tactical.id))) {
        this.tactical.count--; this.throwKind = this.tactical.id; this.throwT = throwDur;
        this.weapon.cancelReload(); this.sprinting = false;
        this.events.push({ type: 'throw', kind: this.throwKind });
      }
    }

    // ---- reload ----
    const wpn = this.weapon;
    if (cmd.reload && !prev.reload && !this.busy && wpn.canReload) {
      if (wpn.startReload(perks.has('pk_sleight') ? 1.25 : 1)) { this.sprinting = this.sprinting && true; }
    }
    // ---- fire ----
    let trigger = def.auto ? cmd.fire : (cmd.fire && !prev.fire);
    if (def.burst) {
      // a trigger pull queues a burst; the burst finishes on its own
      if (trigger && !wpn.burstLeft && wpn.ready()) wpn.burstLeft = Math.min(def.burst.count, wpn.mag);
      trigger = wpn.burstLeft > 0;
    }
    const canShoot = !this.busy && this.sprintOutT <= 0 && !this.sprinting && this.stance !== 'slide' && !def.melee;
    if (def.melee) trigger = false;
    if (trigger && canShoot) {
      if (wpn.mag <= 0) {
        if (cmd.fire && !prev.fire) this.events.push({ type: 'dry' });
        if (wpn.canReload) wpn.startReload(perks.has('pk_sleight') ? 1.25 : 1);
      } else if (wpn.fire(ctx.time)) {
        if (def.burst) { wpn.burstLeft--; if (wpn.burstLeft <= 0 || wpn.mag <= 0) { wpn.burstLeft = 0; wpn.cool = def.burst.delay; } }
        this.stats.shots++;
        ctx.fireWeapon(this, wpn);
        // recoil kick
        const r = def.recoil;
        const adsMul = 1 - this.adsT * (1 - r.ads);
        const crouchMul = this.stance === 'crouch' ? 0.85 : 1;
        const kv = r.v * adsMul * crouchMul * (0.85 + Math.random() * 0.3) * (Math.PI / 180);
        const kh = (Math.random() * 2 - 1) * r.h * adsMul * (Math.PI / 180);
        this.kickPitch += kv; this.kickYaw += kh;
        this.recoilImpulse = { v: kv, h: kh };
        if (wpn.mag === 0 && wpn.canReload && !this.isBot) wpn.startReload(perks.has('pk_sleight') ? 1.25 : 1);
      }
    } else if (def.burst && wpn.burstLeft && !canShoot) {
      wpn.burstLeft = 0;
    } else if (cmd.fire && !prev.fire && wpn.mag <= 0 && !this.busy && !def.melee) {
      this.events.push({ type: 'dry' });
      if (wpn.canReload) wpn.startReload();
    }
    // ---- support abilities ----
    if (cmd.support) {
      if (this.abilities[cmd.support] > 0 && ctx.useSupport?.(this, cmd.support)) this.abilities[cmd.support]--;
      cmd.support = null;
    }
    // reload events -> presentation
    for (const ws of this.weapons) {
      if (ws.events.length) {
        for (const e of ws.events) if (e !== 'fire') this.events.push({ type: e, weapon: ws.def.id, active: ws === wpn });
        ws.events.length = 0;
      }
    }
    copyCmd(prev, cmd);
  }

  busyNoSwap() { return this.meleeT > 0 || this.throwT > 0 || !!this.mantle; }

  canStand() {
    return !this._world || !this._world.overlaps(this.x - this.radius, this.y + 0.05, this.z - this.radius, this.x + this.radius, this.y + MOVE.standH, this.z + this.radius);
  }

  /** Current spread cone half-angle in degrees. */
  spreadDeg() {
    const def = this.weapon.def, sp = def.spread;
    let s = sp.hip + (sp.ads - sp.hip) * this.adsT;
    const mv = Math.min(1, this.speed / MOVE.walk);
    s += sp.move * mv * (1 - this.adsT * 0.75);
    if (!this.grounded && !this.mantle) s += sp.air;
    if (this.stance === 'crouch') s *= sp.crouch;
    s += this.weapon.bloom * (1 - this.adsT * 0.6);
    if (this.stance === 'slide') s += sp.move;
    return s;
  }

  /** Detect a ledge in front that can be mantled; starts the mantle. */
  tryMantle(world) {
    if (this.stance === 'slide') return false;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const r = this.radius;
    // probe at chest height for an obstacle within reach
    for (const h of [0.55, 1.0, 1.45]) {
      const hit = world.raycast(this.x, this.y + h, this.z, fx, 0, fz, 0.9, 'solid');
      if (!hit) continue;
      const top = hit.box.maxY;
      const rise = top - this.y;
      if (rise < 0.45 || rise > 1.75) continue;
      // landing spot slightly past the ledge edge
      const d = hit.t + r + 0.12;
      const lx = this.x + fx * d, lz = this.z + fz * d;
      const g = world.groundHeight(lx, lz, top + 0.05, r * 0.6);
      if (g < top - 0.05) {
        // thin wall/barrier: land on far side instead
        const d2 = hit.t + (Math.abs(fx) > Math.abs(fz) ? (hit.box.maxX - hit.box.minX) : (hit.box.maxZ - hit.box.minZ)) + r + 0.15;
        if (d2 > 2.4 || rise > 1.25) continue;
        const fx2 = this.x + fx * d2, fz2 = this.z + fz * d2;
        const g2 = world.groundHeight(fx2, fz2, this.y + 0.5, r);
        if (g2 === -Infinity) continue;
        if (world.overlaps(fx2 - r, g2 + 0.05, fz2 - r, fx2 + r, g2 + MOVE.crouchH, fz2 + r)) continue;
        this.mantle = { t: 0, x0: this.x, y0: this.y, z0: this.z, x1: fx2, y1: g2, z1: fz2, vault: true, top };
        this.stance = 'stand';
        this.events.push({ type: 'mantle' });
        return true;
      }
      if (world.overlaps(lx - r, g + 0.05, lz - r, lx + r, g + MOVE.crouchH, lz + r)) continue;
      // check head clearance above current spot
      if (world.overlaps(this.x - r * 0.5, this.y + 0.5, this.z - r * 0.5, this.x + r * 0.5, top + MOVE.crouchH, this.z + r * 0.5)) continue;
      this.mantle = { t: 0, x0: this.x, y0: this.y, z0: this.z, x1: lx, y1: g, z1: lz };
      // choose crouch if no standing room
      this.stance = world.overlaps(lx - r, g + 0.05, lz - r, lx + r, g + MOVE.standH, lz + r) ? 'crouch' : 'stand';
      this.events.push({ type: 'mantle' });
      return true;
    }
    return false;
  }
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }

function copyCmd(dst, src) {
  for (const k in src) dst[k] = src[k];
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

export function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
  const lx = ox - cx, lz = oz - cz;
  const a = dx * dx + dz * dz;
  let t = null;
  if (a > 1e-8) {
    const b = lx * dx + lz * dz;
    const c = lx * lx + lz * lz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const tt = (-b - Math.sqrt(disc)) / a;
      if (tt >= 0) {
        const y = oy + dy * tt;
        if (y >= y0 && y <= y1) t = tt;
      }
    }
  }
  // caps (shots from above/below)
  if (Math.abs(dy) > 1e-6) {
    for (const yc of [y1, y0]) {
      const tc = (yc - oy) / dy;
      if (tc < 0 || (t !== null && tc >= t)) continue;
      const px = lx + dx * tc, pz = lz + dz * tc;
      if (px * px + pz * pz <= r * r) t = tc;
    }
  }
  return t;
}
