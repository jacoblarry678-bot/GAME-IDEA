/**
 * Sunny Stop convenience store: the clerk and customers exist while the
 * player is nearby. A hold-up works the same in the mission and in free roam:
 * aim at the clerk to make them bag the register; looking away for too long
 * makes them hit the silent alarm early. The alarm reports an armed robbery a
 * few seconds after it is tripped, whether or not anyone else saw it.
 */
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';
import { PedController } from '../ai/peds.js';
import { PLACES } from '../world/district.js';

const CLERK_LOOK = { female: true, height: 1.66, build: 1.0, skin: 0xa66a3f, hair: 0x2e1f14, top: 0xffd23f, bottom: 0x2b2b2b, shoes: 0x222222, hairStyle: 'bun', shorts: false, sleeveless: false, hat: null, beard: false };

export class Store {
  constructor(game) {
    this.game = game;
    this.place = PLACES.store;
    this.clerk = null;
    this.customers = [];
    this.holdup = null; // {progress, lookAway, alarm, done}
    this.alarmT = -1;
    this.cooldownUntil = -1; // game time when the register is worth robbing again
    this.bag = null; // {x, z, amount}
    this.register = 1800; // cash in the register
    game.interactables.push({
      id: 'cashbag', get x() { return game.store.bag?.x ?? 0; }, get z() { return game.store.bag?.z ?? 0; }, radius: 1.8,
      label: () => (this.bag ? `Grab the cash ($${this.bag.amount.toLocaleString()})` : null),
      onInteract: () => this.takeBag(),
    });
  }

  get inside() { const b = this.place.bounds; const p = this.game.player.pos; return p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1; }

  step(dt) {
    const g = this.game, p = g.player;
    const d = p.distanceTo(this.place.x, this.place.z);
    if (d < 110 && !this.clerk) this.spawnStaff();
    if (d > 170 && this.clerk && !this.holdup) this.despawnStaff();
    if (this.clerk && !this.clerk.dead && !this.holdup) {
      // the clerk keeps an eye on the door; someone pointing a gun starts a hold-up
      const c = this.place.clerk;
      this.clerk.pos.x = c.x; this.clerk.pos.z = c.z;
      this.clerk.faceYaw = c.rot;
      if (this.aimingAtClerk() && this.inside && g.time > this.cooldownUntil) this.startHoldup();
      else if (this.aimingAtClerk() && this.inside) this.clerk.controller.setState('cower', 3);
    }
    // walking back in: the clerk remembers you
    const inside = this.inside;
    if (inside && !this.wasInside && this.clerk && !this.clerk.dead && !this.holdup && g.memory) {
      const m = g.memory.person('clerk');
      if (m.robbed > 0) {
        g.hud?.subtitle('Clerk', m.robbed > 1 ? 'No. No no no. Not AGAIN.' : 'You... you\'re the one who— please, I don\'t want any trouble.', 3.5);
        this.clerk.controller.setState('cower', 4);
        if (!this.postedBack) { this.postedBack = true; g.social?.post({ local: true, text: 'the guy who robbed the Sunny Stop just walked back IN. like nothing happened. the audacity', about: true, likes: 6, clip: true }); }
      } else if (m.visits > 2) g.hud?.subtitle('Clerk', `Hey, ${g.player.protagonistName}. The usual?`, 2.5);
      if (!m.robbed) g.memory.visit('clerk');
    }
    this.wasInside = inside;
    if (this.holdup) this.stepHoldup(dt);
    if (this.alarmT > 0) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) {
        this.alarmT = -1;
        g.wanted.report('robbery', this.place.x, this.place.z, 'alarm');
        g.events.emit('storeAlarm');
      }
    }
  }

  spawnStaff() {
    const g = this.game, c = this.place.clerk;
    this.clerk = new Character(g, CLERK_LOOK, { role: 'ped', x: c.x, z: c.z, yaw: c.rot });
    this.clerk.controller = new PedController(g, this.clerk, 'clerk');
    this.clerk.controller.setState('idle', 1e9);
    this.clerk.missionActor = true;
    this.clerk.name = 'Clerk';
    g.extras.push(this.clerk);
    const b = this.place.bounds;
    for (let i = 0; i < 2; i++) {
      const ch = new Character(g, randomLook(), { role: 'ped', x: b.x0 + 2 + i * 3.6, z: b.z0 + 8 + i * 3, yaw: Math.random() * 6 });
      ch.controller = new PedController(g, ch, 'customer');
      ch.controller.setState('idle', 1e9);
      ch.missionActor = true;
      g.extras.push(ch);
      this.customers.push(ch);
    }
  }

  despawnStaff() {
    const g = this.game;
    for (const ch of [this.clerk, ...this.customers]) if (ch && !ch.removed) g.removeCharacter(ch);
    this.clerk = null;
    this.customers = [];
  }

  /** Gun raised and the crosshair within ~12° of the clerk (the counter can't block it). */
  aimingAtClerk() {
    const p = this.game.player, c = this.clerk;
    if (!c || c.dead || !p.controller.aiming || !this.inside) return false;
    if (p.controller.aimTarget === c) return true;
    const cam = this.game.engine.camera;
    const dx = c.pos.x - cam.position.x, dy = c.pos.y + 1.3 - cam.position.y, dz = c.pos.z - cam.position.z;
    const l = Math.hypot(dx, dy, dz);
    const f = this.game.cameraRig.centerRay().dir;
    return (dx * f.x + dy * f.y + dz * f.z) / l > Math.cos(0.21);
  }

  startHoldup() {
    const g = this.game;
    this.holdup = { progress: 0, lookAway: 0, alarm: false, total: this.register };
    this.clerk.controller.setState('surrender', 1e9);
    for (const c of this.customers) if (!c.dead) { c.controller.setState('cower', 1e9); }
    g.events.emit('holdupStarted');
    g.memory?.person('clerk') && g.memory.person('clerk').robbed++;
    g.hud?.subtitle('Clerk', 'Okay, okay! Take it — just don\'t shoot!', 3);
  }

  stepHoldup(dt) {
    const g = this.game, h = this.holdup, p = g.player;
    if (this.clerk.dead) { this.endHoldup(true); return; }
    const aimed = this.aimingAtClerk();
    if (aimed) { h.lookAway = 0; h.progress = Math.min(1, h.progress + dt / 7); }
    else {
      h.lookAway += dt;
      if (h.lookAway > 3.5 && !h.alarm) {
        // the clerk ducks and hits the silent alarm
        h.alarm = true;
        this.alarmT = 4;
        this.clerk.controller.setState('cower', 1e9);
        g.hud?.subtitle('Clerk', '(hits a button under the counter)', 2.5);
        this.finishBagging();
        return;
      }
    }
    if (h.progress >= 1) this.finishBagging();
  }

  finishBagging() {
    const h = this.holdup;
    const amount = Math.round((h.total * h.progress) / 10) * 10;
    if (!h.alarm) { h.alarm = true; this.alarmT = 4; } // the alarm goes off once you have the money
    if (amount > 0) {
      const r = this.place.register;
      this.bag = { x: r.x - 0.3, z: r.z, amount };
      this.game.events.emit('cashBagged', this.bag);
    }
    this.endHoldup(false);
  }

  endHoldup(clerkDead) {
    this.holdup = null;
    this.cooldownUntil = this.game.time + 600;
    if (clerkDead) this.game.events.emit('clerkDown');
    for (const c of this.customers) if (!c.dead) c.controller.setState('flee', 12);
  }

  takeBag() {
    if (!this.bag) return;
    const amt = this.bag.amount;
    this.bag = null;
    this.register = Math.max(300, this.register - amt);
    this.game.economy.add(amt, 'Sunny Stop register');
    this.game.audio?.ui('money');
    this.game.events.emit('cashTaken', amt);
  }

  reset() {
    this.holdup = null; this.alarmT = -1; this.bag = null; this.register = 1800; this.cooldownUntil = -1;
    this.despawnStaff();
  }
}
