/**
 * Player state and first-person movement. Values follow the design's
 * movement table: walk 2.6 m/s, crouch 1.25, sprint 4.4, backward 85%,
 * stamina 18/s drain, 25/s recovery after one second, exhaustion until 20.
 * Movement speed never drops with health.
 */
import { moveBody } from './collision.js';
import { EQUIP, POUCH_SLOTS } from '../data/items.js';

export const MOVE = {
  walk: 2.6, crouch: 1.25, sprint: 4.4, back: 0.85, crawl: 0.4,
  accel: 16, radius: 0.35, height: 1.8, crouchHeight: 1.1, eye: 1.62, crouchEye: 1.0,
  mantleMax: 0.8, mantleTime: 0.8, reach: 1.8,
};
export const STAMINA = { drain: 18, regen: 25, delay: 1.0, exhaustedUntil: 20 };
export const SOUND = { walk: 6, crouch: 2, sprint: 18, surfaceMult: { metal: 1.5, water: 1.5, grate: 1.5, tile: 1.0, carpet: 1.0, concrete: 1.0, wood: 1.0 } };

export class Player {
  constructor(id, slot = 'evan', name = '') {
    this.id = id;
    this.slot = slot;
    this.name = name || slot;
    this.x = 0; this.y = 0; this.z = 0;
    this.yaw = 0; this.pitch = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.grounded = true;
    this.radius = MOVE.radius;
    this.height = MOVE.height;
    this.mask = 1;
    this.crouched = false;
    this.eyeH = MOVE.eye;
    this.lean = 0;
    this.sprinting = false;
    this.moving = false;
    this.speed = 0;
    this.health = 100;
    this.stamina = 100;
    this.staminaWait = 0;
    this.exhausted = false;
    this.composure = 100;
    this.exposure = 0; // composure drained during the current uninterrupted exposure
    this.darkTime = 0;
    this.breatheCooldown = 0;
    this.protectUntil = 0;
    this.lastHitAt = -99;
    this.lastHitDir = null;
    // equipment
    this.tool = 'flashlight';
    this.flashOn = false;
    this.charge = EQUIP.flashlightMax;
    this.chargeAcc = 0;
    this.film = EQUIP.filmMax;
    this.hasCamera = true;
    this.hasFlashlight = true;
    this.cameraFlash = false;
    this.flashReadyAt = 0;
    this.developUntil = 0;
    this.pouch = new Array(POUCH_SLOTS).fill(null);
    this.selected = 0;
    // state
    this.action = null;
    this.input = { mx: 0, mz: 0, sprint: false, crouch: false, lean: 0, inspect: false };
    this.stepAcc = 0;
    this.room = null;
    this.visited = new Set();
    this.hidden = null; // locker interactable id
    this.hiddenWitnessed = false;
    this.mantle = null;
    this.downed = false;
    this.downedAt = 0;
    this.revivedOnce = false;
    this.spectating = false;
    this.avoidUntil = 0;
    this.clockGaze = 0;
    this.clockTarget = null;
    this.refugeT = 0;
    this.connected = true;
    this.local = true;
    this.lastSafe = null; // last validated floor point
  }

  get alive() { return !this.downed && !this.spectating && this.health > 0; }
  get active() { return !this.spectating && this.connected; }
  eye() { return { x: this.x, y: this.y + this.eyeH, z: this.z }; }
  forward() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  pouchCount(item) {
    let n = 0;
    for (const s of this.pouch) if (s && s.item === item) n += s.n;
    return n;
  }

  serialize() {
    return {
      id: this.id, slot: this.slot, name: this.name, x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch,
      crouched: this.crouched, health: this.health, stamina: this.stamina, composure: this.composure,
      tool: this.tool, flashOn: this.flashOn, charge: this.charge, film: this.film, hasCamera: this.hasCamera, hasFlashlight: this.hasFlashlight,
      cameraFlash: this.cameraFlash, pouch: this.pouch.map((s) => (s ? { item: s.item, n: s.n, sub: s.sub ? s.sub.slice() : undefined } : null)),
      selected: this.selected, downed: this.downed, revivedOnce: this.revivedOnce, spectating: this.spectating,
      visited: [...this.visited],
    };
  }

  restore(s) {
    Object.assign(this, {
      x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, crouched: !!s.crouched, health: s.health, stamina: s.stamina,
      composure: s.composure, tool: s.tool, flashOn: s.flashOn, charge: s.charge, film: s.film,
      hasCamera: s.hasCamera !== false, hasFlashlight: s.hasFlashlight !== false, cameraFlash: !!s.cameraFlash,
      selected: s.selected || 0, downed: !!s.downed, revivedOnce: !!s.revivedOnce, spectating: !!s.spectating,
    });
    this.pouch = (s.pouch || []).map((x) => (x ? { item: x.item, n: x.n, sub: x.sub ? x.sub.slice() : undefined } : null));
    while (this.pouch.length < POUCH_SLOTS) this.pouch.push(null);
    this.visited = new Set(s.visited || []);
    this.vx = this.vy = this.vz = 0;
    this.action = null; this.hidden = null; this.mantle = null; this.exhausted = false;
    this.protectUntil = 0; this.developUntil = 0; this.flashReadyAt = 0; this.exposure = 0;
    this.height = this.crouched ? MOVE.crouchHeight : MOVE.height;
    this.eyeH = this.crouched ? MOVE.crouchEye : MOVE.eye;
  }
}

/**
 * Advance one player's movement for dt. Returns footstep info when a step
 * lands ({ r, surface }) so the game can emit the sound event.
 */
export function stepMovement(game, p, dt) {
  const L = game.level, inp = p.input;
  if (p.spectating) return null;
  if (p.hidden) { p.vx = p.vz = 0; p.moving = false; p.sprinting = false; regenStamina(p, dt); return null; }
  if (p.mantle) {
    const m = p.mantle;
    m.t += dt;
    const k = Math.min(1, m.t / MOVE.mantleTime);
    const fw = Math.max(0, Math.min(1, (k - 0.25) / 0.75));
    p.x = m.x0 + (m.x1 - m.x0) * fw; p.z = m.z0 + (m.z1 - m.z0) * fw;
    const yLine = m.y0 + (m.ytop - m.y0) * Math.min(1, k / 0.6);
    p.y = yLine + Math.max(0, m.peak + 0.06 - yLine) * Math.sin(Math.PI * k);
    if (k >= 1) { p.y = m.ytop; p.mantle = null; p.grounded = false; p.vy = 0; }
    return null;
  }
  // crouch / stand
  const wantCrouch = !!inp.crouch || p.downed;
  if (wantCrouch !== p.crouched) {
    if (wantCrouch) { p.crouched = true; p.height = MOVE.crouchHeight; } else {
      const r = p.radius;
      if (!L.world.overlaps(p.x - r, p.y + 0.05, p.z - r, p.x + r, p.y + MOVE.height, p.z + r, 1)) { p.crouched = false; p.height = MOVE.height; }
    }
  }
  const eyeT = p.downed ? 0.45 : p.crouched ? MOVE.crouchEye : MOVE.eye;
  p.eyeH += (eyeT - p.eyeH) * Math.min(1, dt * 10);

  // desired velocity
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const usingItem = p.action && p.action.slows;
  let speed = p.downed ? MOVE.crawl : p.crouched ? MOVE.crouch : MOVE.walk;
  const canSprint = !p.downed && !p.crouched && !p.exhausted && p.stamina > 0 && ml > 0.1 && !usingItem;
  p.sprinting = !!inp.sprint && canSprint;
  if (p.sprinting) speed = MOVE.sprint;
  if (mz < -0.1) speed *= MOVE.back;
  if (usingItem) speed = Math.min(speed, MOVE.crouch);
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  // forward is -z in local space; mz>0 means forward
  const tx = (-s * mz + c * mx) * speed, tz = (-c * mz - s * mx) * speed;
  const a = MOVE.accel * dt;
  p.vx += clamp(tx - p.vx, -a, a);
  p.vz += clamp(tz - p.vz, -a, a);
  p.vy -= 18 * dt;
  moveBody(L.world, p, dt);
  if (p.y < -20) { // fell out of the world: return to last safe point
    if (p.lastSafe) { p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.z = p.lastSafe.z; }
    p.vy = 0;
  }
  p.speed = Math.hypot(p.vx, p.vz);
  p.moving = p.speed > 0.3;

  // stamina
  if (p.sprinting && p.moving) {
    p.stamina = Math.max(0, p.stamina - STAMINA.drain * dt);
    p.staminaWait = STAMINA.delay;
    if (p.stamina <= 0) p.exhausted = true;
  } else regenStamina(p, dt);

  // lean
  const lt = p.downed ? 0 : (inp.lean || 0);
  p.lean += (lt - p.lean) * Math.min(1, dt * 9);

  // footsteps
  if (p.moving && p.grounded) {
    const stride = p.downed ? 0.5 : p.sprinting ? 1.05 : p.crouched ? 0.55 : 0.78;
    p.stepAcc += p.speed * dt;
    if (p.stepAcc >= stride) {
      p.stepAcc -= stride;
      const surface = L.surfaceAt(p.x, p.z);
      const base = p.downed ? 1.5 : p.sprinting ? SOUND.sprint : p.crouched ? SOUND.crouch : SOUND.walk;
      return { r: base * (SOUND.surfaceMult[surface] || 1), surface };
    }
  } else p.stepAcc = Math.min(p.stepAcc, 0.4);
  if (p.grounded && !p.downed) p.lastSafe = { x: p.x, y: p.y, z: p.z };
  return null;
}

function regenStamina(p, dt) {
  if (p.staminaWait > 0) p.staminaWait -= dt;
  else p.stamina = Math.min(100, p.stamina + STAMINA.regen * dt);
  if (p.exhausted && p.stamina >= STAMINA.exhaustedUntil) p.exhausted = false;
}

/** Try to mantle a marked obstacle directly ahead. */
export function tryMantle(game, p) {
  if (p.mantle || p.downed || p.hidden) return false;
  const W = game.level.world;
  const f = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
  const probe = 0.75;
  const list = W.query(p.x + f.x * probe - 0.3, p.z + f.z * probe - 0.3, p.x + f.x * probe + 0.3, p.z + f.z * probe + 0.3, []);
  let best = null;
  for (const b of list) {
    if (!b.solid || !b.mantle) continue;
    const rise = b.maxY - p.y;
    if (rise < 0.2 || rise > MOVE.mantleMax + 0.01) continue;
    if (!best || b.maxY > best.maxY) best = b;
  }
  if (!best) return false;
  // land on the far side of the obstacle (or on top if the far side is blocked)
  const depth = Math.abs(f.x) > Math.abs(f.z) ? best.maxX - best.minX : best.maxZ - best.minZ;
  const dist = depth + p.radius * 2 + 0.25;
  const r = p.radius;
  let x1 = p.x + f.x * (0.4 + dist), z1 = p.z + f.z * (0.4 + dist), ytop = p.y;
  const clearFar = !W.overlaps(x1 - r, p.y + 0.05, z1 - r, x1 + r, p.y + MOVE.crouchHeight, z1 + r, 1);
  if (!clearFar) {
    x1 = (best.minX + best.maxX) / 2; z1 = (best.minZ + best.maxZ) / 2; ytop = best.maxY;
    if (W.overlaps(x1 - r, ytop + 0.05, z1 - r, x1 + r, ytop + MOVE.crouchHeight, z1 + r, 1)) return false;
  }
  p.mantle = { t: 0, x0: p.x, z0: p.z, y0: p.y, x1, z1, ytop: Math.max(ytop, p.y), peak: best.maxY };
  p.vx = p.vz = 0;
  return true;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
