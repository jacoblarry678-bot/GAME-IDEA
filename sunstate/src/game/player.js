/**
 * Player controller: turns input into character and vehicle actions.
 * On foot: camera-relative movement, sprint/jump/crouch, aim/fire/melee,
 * reload and weapon switching, contextual interaction (E).
 * Vehicles (F): walk to the nearest reachable door, carjack an occupied
 * driver's seat, slide over from the passenger side when the driver door is
 * blocked, and exit to the first clear spot (door, other door, front, rear,
 * roof). Bailing out of a fast car hurts.
 */
import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { obbCircle } from '../world/collision.js';

const SPEED = { walk: 1.7, run: 4.1, sprint: 6.6, crouch: 1.7, aim: 2.3 };

/** Where to walk to reach a door: the door itself, or a corner first if it's on the far side of the car. */
export function doorApproachPoint(v, seat, ch) {
  let [dx, dz] = v.doorPoint(seat);
  const [plx, plz] = v.worldToLocal(ch.pos.x, ch.pos.z);
  const [dlx] = v.worldToLocal(dx, dz);
  if (Math.sign(plx) !== Math.sign(dlx) && Math.abs(plx) > 0.2) {
    const end = Math.abs(plz) > 0.3 ? Math.sign(plz) : 1;
    const ez = end * (v.hz + 0.75);
    const sideX = (Math.abs(plz) < v.hz + 0.4) ? Math.sign(plx) * (v.hx + 0.7) : Math.sign(dlx) * (v.hx + 0.7);
    [dx, dz] = v.localToWorld(sideX, ez);
    if (Math.abs(plz) >= v.hz + 0.4) [dx, dz] = v.localToWorld(Math.sign(dlx) * (v.hx + 0.7), ez);
  }
  return [dx, dz];
}

export class PlayerController {
  constructor(game, character) {
    this.game = game;
    this.ch = character;
    this.aiming = false;
    this.cooldown = 0;
    this.reloadT = 0;
    this.hipT = 0;
    this.enter = null;
    this.exit = null;
    this.prompt = null;
    this.interactTarget = null;
    this.aimTarget = null;
    this.regenT = 0;
    this.inventory = { weapons: ['fists', 'pistol'], current: 'fists', ammo: { pistol: { mag: 12, reserve: 36 } } };
    this.stats = { shotsFired: 0, distanceDriven: 0, distanceWalked: 0 };
    game.events.on('damaged', ({ victim }) => { if (victim === this.ch) this.regenT = 0; });
  }

  get weapon() { return WEAPONS[this.inventory.current]; }
  get ammo() { return this.inventory.ammo[this.inventory.current] || null; }

  giveWeapon(id, rounds = 0) {
    if (!this.inventory.weapons.includes(id)) this.inventory.weapons.push(id);
    if (!WEAPONS[id].melee) {
      const a = this.inventory.ammo[id] || (this.inventory.ammo[id] = { mag: 0, reserve: 0 });
      a.reserve = Math.min(WEAPONS[id].maxReserve, a.reserve + rounds);
      if (a.mag === 0) this.reloadInstant(id);
    }
  }

  reloadInstant(id) {
    const a = this.inventory.ammo[id], w = WEAPONS[id];
    const n = Math.min(w.mag - a.mag, a.reserve);
    a.mag += n; a.reserve -= n;
  }

  step(dt) {
    const g = this.game, ch = this.ch, input = g.input;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.hipT > 0) this.hipT -= dt;
    if (ch.dead) { this.aiming = false; ch.anim_.aim = false; return; }
    if (this.frozen) {
      ch.wishSpeed = 0; this.aiming = false; ch.anim_.aim = false; this.prompt = null;
      if (ch.vehicle && ch.seat === 0) { const v = ch.vehicle; v.input.throttle = 0; v.input.brake = 0; v.input.steer = 0; v.input.handbrake = true; }
      return;
    }
    // slow health regeneration up to half health after a quiet spell
    this.regenT += dt;
    if (this.regenT > 6 && ch.health < 50) ch.health = Math.min(50, ch.health + dt * 4);

    if (this.enter) return this.stepEnter(dt);
    if (this.exit) return this.stepExit(dt);
    if (ch.vehicle) return this.stepDriving(dt);
    this.stepOnFoot(dt);
  }

  stepOnFoot(dt) {
    const g = this.game, ch = this.ch, input = g.input, cam = g.cameraRig;
    const mv = input.move();
    const [fx, fz] = cam.flatForward;
    const rx = -fz, rz = fx;
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const knocked = ch.knockT > 0;
    this.aiming = input.down('aim') && !ch.swim && !knocked && this.weapon && !this.weapon.melee;
    if (input.pressed('crouch') && !ch.swim) ch.crouch = !ch.crouch;
    const sprint = input.down('sprint') && !this.aiming && !ch.crouch;
    if (sprint && ch.crouch) ch.crouch = false;
    let speed = this.aiming ? SPEED.aim : ch.crouch ? SPEED.crouch : sprint ? SPEED.sprint : SPEED.run;
    if (mag < 0.6 && input.lastDevice === 'gamepad') speed = SPEED.walk;
    ch.wish.set(wx * mag, wz * mag);
    ch.wishSpeed = knocked ? 0 : speed;
    if (input.pressed('jump') && !ch.crouch) ch.jumpReq = true;
    ch.faceYaw = this.aiming || this.hipT > 0 ? cam.yaw : null;
    ch.turnRate = this.aiming ? 18 : 10;
    ch.anim_.aim = this.aiming || this.hipT > 0;
    ch.anim_.aimPitch = cam.pitch;
    ch.anim_.armed = !this.weapon.melee;
    this.stats.distanceWalked += Math.hypot(ch.vel.x, ch.vel.z) * dt;

    // weapons
    if (input.pressed('nextWeapon') || g.input.takeWheel() !== 0) this.cycleWeapon();
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.reloadInstant(this.inventory.current);
    } else if (input.pressed('reload')) this.startReload();
    if (input.down('fire') && this.cooldown <= 0 && !ch.swim && !knocked) this.attack();

    this.updateAimTarget();
    this.updatePrompt();
    if (input.pressed('enterVehicle')) this.tryEnterVehicle();
    else if (input.pressed('interact') && this.interactTarget) this.interactTarget.onInteract(this);
  }

  cycleWeapon() {
    const inv = this.inventory;
    const i = inv.weapons.indexOf(inv.current);
    inv.current = inv.weapons[(i + 1) % inv.weapons.length];
    this.reloadT = 0;
    this.game.audio?.ui('switch');
  }

  startReload() {
    const a = this.ammo, w = this.weapon;
    if (!a || w.melee || a.mag >= w.mag || a.reserve <= 0) return;
    this.reloadT = w.reload;
    this.game.audio?.reload(this.ch.pos);
  }

  attack() {
    const g = this.game, ch = this.ch, w = this.weapon;
    if (w.melee) {
      this.cooldown = w.cooldown;
      ch.anim_.punch = 1;
      ch.yaw = g.cameraRig.yaw;
      g.combat.melee(ch, w);
      return;
    }
    if (this.reloadT > 0) return;
    const a = this.ammo;
    if (a.mag <= 0) { if (a.reserve > 0) this.startReload(); else { this.cooldown = 0.3; g.audio?.ui('empty'); } return; }
    a.mag--;
    this.cooldown = w.cooldown;
    this.stats.shotsFired++;
    if (!this.aiming) this.hipT = 0.6;
    // aim point: what's under the crosshair, then shoot from the muzzle toward it
    const { origin, dir } = g.cameraRig.centerRay();
    const skip = 2.2; // start the camera ray past the player
    const aimHit = g.combat.raycast(origin.x + dir.x * skip, origin.y + dir.y * skip, origin.z + dir.z * skip, dir.x, dir.y, dir.z, w.range, ch);
    const target = aimHit ? new THREE.Vector3(aimHit.x, aimHit.y, aimHit.z) : origin.clone().addScaledVector(dir, w.range);
    const muzzle = new THREE.Vector3();
    ch.model.gun.userData.muzzle.getWorldPosition(muzzle);
    if (ch.vehicle) {
      // out of the side window, toward the aim point
      const v = ch.vehicle, [sx, sy, sz] = v.def.seats[ch.seat];
      const [wx, wz] = v.localToWorld(sx, sz);
      const hd = Math.hypot(target.x - wx, target.z - wz) || 1;
      muzzle.set(wx + (target.x - wx) / hd * 0.9, v.pos.y + sy + 0.75, wz + (target.z - wz) / hd * 0.9);
    } else if (!this.aiming || muzzle.distanceTo(ch.pos) > 2) muzzle.set(ch.pos.x + Math.sin(ch.yaw) * 0.5, ch.pos.y + 1.35, ch.pos.z + Math.cos(ch.yaw) * 0.5);
    const d = target.clone().sub(muzzle).normalize();
    const moving = Math.min(1, Math.hypot(ch.vel.x, ch.vel.z) / 4);
    const spread = (this.aiming ? w.spread : w.hipSpread) + w.moveSpread * moving;
    g.combat.fire(ch, muzzle, d, w, spread);
    g.cameraRig.pitch += w.recoil;
    g.cameraRig.yaw += (Math.random() - 0.5) * w.recoil * 0.6;
    g.cameraRig.addShake(0.12);
    if (a.mag === 0 && a.reserve > 0) this.startReload();
  }

  updateAimTarget() {
    this.aimTarget = null;
    if (!this.aiming) return;
    const { origin, dir } = this.game.cameraRig.centerRay();
    const hit = this.game.combat.raycast(origin.x + dir.x * 2, origin.y + dir.y * 2, origin.z + dir.z * 2, dir.x, dir.y, dir.z, 45, this.ch);
    if (hit && hit.kind === 'character') this.aimTarget = hit.character;
  }

  /** Nearest usable interactable in front of the player with a clear line to it. */
  updatePrompt() {
    const g = this.game, ch = this.ch;
    this.interactTarget = null;
    this.prompt = null;
    let best = null, bd = Infinity;
    for (const it of g.interactables) {
      const dx = it.x - ch.pos.x, dz = it.z - ch.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius || Math.abs((it.y ?? ch.pos.y) - ch.pos.y) > 2) continue;
      const label = it.label(this);
      if (!label) continue;
      if (d < bd && this.lineClear(it.x, it.z)) { bd = d; best = { it, label }; }
    }
    if (best) { this.interactTarget = best.it; this.prompt = { key: 'interact', text: best.label }; }
    const v = this.findVehicle();
    if (v && !best) this.prompt = { key: 'enterVehicle', text: v.ride ? `Ride with ${g.partner.protagonistName}` : v.vehicle.seats[0] && !v.vehicle.seats[0].dead && v.seat === 0 ? `Take the ${v.vehicle.def.name}` : `Enter the ${v.vehicle.def.name}` };
  }

  lineClear(x, z) {
    const ch = this.ch;
    const y = ch.pos.y + 1.1;
    const hit = this.game.world.collision.raycast(ch.pos.x, y, ch.pos.z, x - ch.pos.x, 0, z - ch.pos.z, 1, (c) => c.tag !== 'prop');
    return !hit || hit.t > 0.97;
  }

  doorClear(v, seat) {
    const [dx, dz] = v.doorPoint(seat);
    const y = this.game.world.ground(dx, dz, v.pos.y + 1);
    if (Math.abs(y - v.pos.y) > 1.2) return null;
    if (this.game.world.collision.overlapsCircle(dx, dz, 0.28, y + 0.2, 1.4)) return null;
    for (const o of this.game.vehicles) if (o !== v && obbCircle(o.pos.x, o.pos.z, o.hx, o.hz, o.yaw, dx, dz, 0.3)) return null;
    return { x: dx, z: dz, y };
  }

  /** Pick a vehicle within reach and the seat/door to use. Your partner is never carjacked: you ride with them. */
  findVehicle() {
    const ch = this.ch, partner = this.game.partner;
    let best = null, bd = 6.5;
    for (const v of this.game.vehicles) {
      if (v.sunk || v.speed > 5) continue;
      const d = Math.hypot(v.pos.x - ch.pos.x, v.pos.z - ch.pos.z) - v.hz * 0.6;
      if (d > bd || Math.abs(v.pos.y - ch.pos.y) > 1.6) continue;
      // driver door if it is clear; else passenger door (then slide across)
      const ride = !!partner && v.seats[0] === partner && !partner.dead;
      let seat = -1, door = null;
      for (const s of ride ? [1, 2, 3] : [0, 1]) {
        if (s >= v.seats.length) continue;
        const occ = v.seats[s];
        if (occ && (occ === ch || occ === partner || (s >= 1 && !occ.dead))) continue;
        const dp = this.doorClear(v, s);
        if (dp && this.lineClear(dp.x, dp.z)) { seat = s; door = dp; break; }
      }
      if (seat < 0) continue;
      if (!ride && seat === 1 && v.seats[0] && !v.seats[0].dead) continue;
      best = { vehicle: v, seat, door, ride }; bd = d;
    }
    return best;
  }

  tryEnterVehicle() {
    const f = this.findVehicle();
    if (!f) return;
    this.enter = { ...f, phase: 'approach', t: 0, start: this.ch.pos.clone() };
    this.ch.crouch = false;
  }

  stepEnter(dt) {
    const g = this.game, ch = this.ch, e = this.enter, v = e.vehicle;
    e.t += dt;
    if (e.phase === 'approach') {
      const [dx, dz] = doorApproachPoint(v, e.seat, ch);
      const ddx = dx - ch.pos.x, ddz = dz - ch.pos.z;
      const dist = Math.hypot(ddx, ddz);
      const mv = g.input.move();
      if ((Math.hypot(mv.x, mv.y) > 0.5 && e.t > 0.3) || e.t > 6 || v.speed > 5 || v.sunk) { this.enter = null; ch.wishSpeed = 0; return; }
      const [fdx, fdz] = v.doorPoint(e.seat);
      if (dist > 0.45 || Math.hypot(fdx - ch.pos.x, fdz - ch.pos.z) > 0.6) {
        ch.wish.set(ddx / Math.max(dist, 0.01), ddz / Math.max(dist, 0.01));
        ch.wishSpeed = dist > 2 ? SPEED.run : 2.2;
        ch.faceYaw = null;
        return;
      }
      // at the door
      ch.wishSpeed = 0; ch.vel.set(0, 0, 0);
      const occ = v.seats[e.seat];
      if (occ && occ !== ch) {
        if (occ.dead) { this.game.ejectOccupant(v, e.seat, true); }
        else { this.game.carjack(v, e.seat, ch); }
      }
      e.phase = 'getin'; e.t = 0;
      e.from = ch.pos.clone();
      e.fromYaw = ch.yaw;
      g.audio?.door(v.pos);
      return;
    }
    if (e.phase === 'getin') {
      const k = Math.min(1, e.t / 0.45);
      // slide toward the seat, then sit
      const [sx, , sz] = v.def.seats[e.seat];
      const [wx, wz] = v.localToWorld(sx, sz);
      ch.pos.set(e.from.x + (wx - e.from.x) * k, e.from.y + (v.pos.y - e.from.y) * k, e.from.z + (wz - e.from.z) * k);
      let dy = v.yaw - e.fromYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ch.yaw = e.fromYaw + dy * k;
      if (k >= 1) {
        this.game.seatCharacter(v, e.seat, ch);
        // slide over from the passenger seat when the driver door was blocked
        if (e.seat === 1 && !v.seats[0]) { v.seats[1] = null; v.seats[0] = ch; ch.seat = 0; }
        v.engineOn = !v.destroyed && !v.sunk;
        this.enter = null;
      }
    }
  }

  stepDriving(dt) {
    const g = this.game, ch = this.ch, v = ch.vehicle, input = g.input;
    ch.anim_.aim = false;
    if (ch.seat === 0) {
      this.aiming = false;
      const d = input.drive();
      v.input.throttle = d.throttle; v.input.brake = d.brake; v.input.steer = d.steer;
      v.input.handbrake = input.down('handbrake');
      v.horn = input.down('horn');
      if (input.pressed('headlights')) v.lightsOn = !v.lightsOn;
      this.stats.distanceDriven += v.speed * dt;
    }
    else this.stepPassenger(dt);
    if (input.pressed('radio')) g.audio?.nextStation();
    g.cameraRig.lookBehind = input.down('lookBehind') && !this.aiming;
    this.prompt = { key: 'enterVehicle', text: v.speed > 3 ? 'Bail out' : 'Exit vehicle' };
    if (ch.seat > 0 && v.driver === g.partner && !this.aiming) this.prompt = { key: 'partner', text: g.partner.partnerAI.hold ? `Tell ${g.partner.protagonistName} to drive` : `Tell ${g.partner.protagonistName} to pull over` };
    if (input.pressed('enterVehicle')) this.tryExit();
  }

  /** Riding as a passenger: aim out of the window and shoot (drive-by). */
  stepPassenger(dt) {
    const g = this.game, ch = this.ch, v = ch.vehicle, input = g.input, cam = g.cameraRig;
    if (input.pressed('nextWeapon') || input.takeWheel() !== 0) this.cycleWeapon();
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.reloadInstant(this.inventory.current);
    } else if (input.pressed('reload')) this.startReload();
    this.aiming = input.down('aim') && !this.weapon.melee && !v.sunk;
    const a = ch.anim_;
    a.aim = this.aiming; a.armed = this.aiming; a.aimPitch = cam.pitch;
    a.carAimYaw = Math.atan2(Math.sin(cam.yaw - v.yaw), Math.cos(cam.yaw - v.yaw));
    if (this.aiming && input.down('fire') && this.cooldown <= 0) this.attack();
    this.updateAimTarget();
  }

  tryExit() {
    const v = this.ch.vehicle;
    const spot = this.findExitSpot(v, this.ch.seat);
    this.exit = { vehicle: v, spot, t: 0, bail: v.speed > 3 };
    v.input.throttle = 0; v.input.brake = 0; v.input.steer = 0;
    v.input.handbrake = !this.exit.bail;
  }

  /** Clear spot to stand after leaving a vehicle (never inside walls). */
  findExitSpot(v, seat) {
    const w = this.game.world;
    const cands = [];
    const add = (lx, lz) => { const [x, z] = v.localToWorld(lx, lz); cands.push([x, z]); };
    const side = Math.sign(v.def.seats[seat][0]) || -1;
    add(side * (v.hx + 0.55), v.def.seats[seat][2] + 0.25);
    add(-side * (v.hx + 0.55), v.def.seats[seat][2] + 0.25);
    add(0, v.hz + 0.7); add(0, -v.hz - 0.7);
    add(side * (v.hx + 0.6), v.hz - 0.4); add(-side * (v.hx + 0.6), -v.hz + 0.4);
    for (const [x, z] of cands) {
      const y = w.ground(x, z, v.pos.y + 1);
      if (Math.abs(y - v.pos.y) > 1.3 || w.isWater(x, z) && !v.sunk) continue;
      if (w.collision.overlapsCircle(x, z, 0.3, y + 0.2, 1.5)) continue;
      if (this.game.vehicles.some((o) => o !== v && obbCircle(o.pos.x, o.pos.z, o.hx, o.hz, o.yaw, x, z, 0.32))) continue;
      return { x, y, z };
    }
    // fallback: climb out onto the roof
    return { x: v.pos.x, y: v.pos.y + v.def.height + 0.05, z: v.pos.z, roof: true };
  }

  stepExit(dt) {
    const ex = this.exit, ch = this.ch, v = ex.vehicle;
    ex.t += dt;
    if (!ex.bail && v.speed > 0.8 && ex.t < 1.5) return; // wait for the car to stop
    const spot = ex.bail ? this.findExitSpot(v, ch.seat) : ex.spot.roof ? this.findExitSpot(v, ch.seat) : ex.spot;
    this.game.unseatCharacter(v, ch, spot);
    this.aiming = false; ch.anim_.aim = false;
    if (ex.bail) {
      const side = Math.sign(v.def.seats[0][0]) || -1;
      const [lx, lz] = [side * 3, 0];
      const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
      ch.knockDown(v.vel.x * 0.7 + (lx * c + lz * s), v.vel.y * 0.7 + (-lx * s + lz * c), Math.min(6, v.speed * 0.3), null);
      ch.knockT = 1.1;
    }
    v.input.handbrake = false;
    this.game.audio?.door(v.pos);
    this.exit = null;
    this.game.cameraRig.lookBehind = false;
  }
}
