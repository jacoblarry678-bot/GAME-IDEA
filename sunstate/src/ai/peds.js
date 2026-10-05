/**
 * Pedestrians: population around the player (sidewalks, promenade, beach),
 * simple activities (walking the sidewalk graph, chatting, phone calls,
 * sitting on the sand, wandering the beach) and reactions (dodging cars,
 * fleeing gunfire, cowering, hands up at gunpoint, fighting back, getting up
 * after being knocked down, and calling 911 as witnesses).
 */
import * as THREE from 'three';
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';
import { SIDEWALKS, BEACH_ZONE, PROMENADE_ZONE } from '../world/district.js';
import { CRIMES } from '../game/wanted.js';

const SW = SIDEWALKS.nodes;
const rand = (a, b) => a + Math.random() * (b - a);

export class PedController {
  constructor(game, ch, kind = 'walker') {
    this.game = game;
    this.ch = ch;
    this.kind = kind;
    this.state = kind === 'driver' ? 'drive' : 'idle';
    this.t = 0;
    this.stateT = rand(2, 6);
    this.target = null;
    this.node = null;
    this.prevNode = null;
    this.offset = rand(-0.9, 0.9);
    this.walkSpeed = rand(1.15, 1.6);
    this.threat = null;
    this.brave = Math.random() < 0.18;
    this.waitT = 0;
    this.call = null;
    this.hostile = false;
    this.wasKnocked = false;
  }

  setState(s, dur = 0) { this.state = s; this.stateT = dur; const a = this.ch.anim_; a.phone = s === 'call' || (s === 'idle' && this.phoneIdle); a.cower = s === 'cower'; a.surrender = s === 'surrender'; a.talk = s === 'talk' || s === 'argue' || s === 'dance'; a.sitGround = s === 'sit'; }

  /** Run away from a point (or character). */
  panic(source, reason) {
    if (this.ch.dead || this.ch.vehicle) return;
    const p = source?.pos || source;
    this.threat = p ? { x: p.x, z: p.z } : null;
    if (this.brave && reason === 'assaulted' && source?.role === 'player') { this.hostile = true; this.setState('fight', rand(6, 10)); return; }
    this.setState('flee', rand(7, 12));
  }

  /** Seen a crime: flee, then stop somewhere and call it in. */
  witnessed(crimeId, x, z) {
    if (this.ch.dead || this.ch.vehicle || this.call || this.state === 'call') return;
    this.pendingCall = { crimeId, x, z, delay: rand(1, 2.5) };
    if (this.state !== 'cower' && this.state !== 'fight') this.panic({ x, z }, 'witness');
  }

  callDone() { this.call = null; this.setState('flee', rand(4, 8)); }

  step(dt) {
    const ch = this.ch, g = this.game;
    if (ch.dead || ch.vehicle) return;
    this.t += dt;
    this.stateT -= dt;
    // just got back up from being knocked down: angry or scared
    if (ch.knockT > 0) { this.wasKnocked = true; ch.wishSpeed = 0; return; }
    if (this.wasKnocked) { this.wasKnocked = false; this.panic(ch.lastDamager || g.player, 'assaulted'); }

    // pending witness call: once out of immediate danger, stop and phone it in
    if (this.pendingCall) {
      this.pendingCall.delay -= dt;
      if (this.pendingCall.delay <= 0 && this.state !== 'cower') {
        const pc = this.pendingCall; this.pendingCall = null;
        this.call = g.wanted?.startCall(ch, pc.crimeId, pc.x, pc.z);
        if (this.call) this.setState('call', 99);
      }
    }
    // dodge cars heading straight at us
    if (this.state !== 'call' && this.state !== 'sit') this.dodge();

    const a = ch.anim_;
    switch (this.state) {
      case 'idle':
        ch.wishSpeed = 0;
        if (this.stateT <= 0) this.pickActivity();
        break;
      case 'talk':
        ch.wishSpeed = 0;
        if (this.partner && !this.partner.dead) ch.faceYaw = Math.atan2(this.partner.pos.x - ch.pos.x, this.partner.pos.z - ch.pos.z);
        if (this.stateT <= 0) { ch.faceYaw = null; this.pickActivity(); }
        break;
      case 'sit':
        ch.wishSpeed = 0;
        if (this.stateT <= 0) { this.setState('idle', 1); }
        break;
      case 'walk': this.walk(dt); break;
      case 'wander': this.wander(dt); break;
      case 'flee': {
        ch.faceYaw = null;
        const th = this.threat || g.player.pos;
        let dx = ch.pos.x - th.x, dz = ch.pos.z - th.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        // slide along walls when blocked
        if (ch.blockedT > 0.4) { const t = dx; dx = -dz; dz = t; }
        ch.wish.set(dx, dz);
        ch.wishSpeed = 5.6;
        if (this.stateT <= 0) { this.threat = null; this.setState('walk'); this.node = null; }
        break;
      }
      case 'cower':
        ch.wishSpeed = 0;
        if (this.stateT <= 0) this.setState('flee', rand(5, 9));
        break;
      case 'surrender':
        ch.wishSpeed = 0;
        ch.faceYaw = Math.atan2(g.player.pos.x - ch.pos.x, g.player.pos.z - ch.pos.z);
        if (this.stateT <= 0 && !(g.player.controller.aimTarget === ch)) { ch.faceYaw = null; this.setState('flee', rand(5, 9)); }
        break;
      case 'call':
        ch.wishSpeed = 0;
        if (this.threat) ch.faceYaw = Math.atan2(ch.pos.x - this.threat.x, ch.pos.z - this.threat.z);
        // a gun pointed at a caller makes them drop the call and run
        if (g.player.controller.aimTarget === ch) { g.wanted?.cancelCall(ch, 'scared off'); this.call = null; this.setState('flee', 8); }
        break;
      case 'fight': {
        const p = g.player;
        const d = ch.distanceTo(p.pos.x, p.pos.z);
        ch.faceYaw = Math.atan2(p.pos.x - ch.pos.x, p.pos.z - ch.pos.z);
        if (p.vehicle || p.dead || this.stateT <= 0 || d > 25) { this.hostile = false; ch.faceYaw = null; this.setState('flee', 6); break; }
        if (d > 1.2) { ch.wish.set((p.pos.x - ch.pos.x) / d, (p.pos.z - ch.pos.z) / d); ch.wishSpeed = 4.5; }
        else {
          ch.wishSpeed = 0;
          this.punchT = (this.punchT || 0) - dt;
          if (this.punchT <= 0) { this.punchT = 1.1; a.punch = 1; if (Math.random() < 0.6) p.damage(7, ch, 'melee'); g.audio?.punch(p.pos); }
        }
        break;
      }
      case 'argue': {
        ch.wishSpeed = 0;
        a.talk = true;
        if (this.partner && !this.partner.dead) ch.faceYaw = Math.atan2(this.partner.pos.x - ch.pos.x, this.partner.pos.z - ch.pos.z);
        this.shoveT = (this.shoveT ?? rand(2, 5)) - dt;
        if (this.shoveT <= 0) { this.shoveT = rand(3, 7); a.punch = 1; }
        if (this.stateT <= 0) { a.talk = false; this.setState('walk'); }
        break;
      }
      case 'dance': {
        ch.wishSpeed = 0;
        a.talk = true;
        this.hopT = (this.hopT ?? 0) - dt;
        if (this.hopT <= 0) { this.hopT = rand(0.5, 0.9); ch.jumpReq = Math.random() < 0.5; }
        ch.faceYaw = (ch.faceYaw ?? ch.yaw) + dt * (this.spin ?? 0.8);
        if (this.stateT <= 0) { a.talk = false; ch.faceYaw = null; this.setState('walk'); }
        break;
      }
      case 'watch': {
        ch.wishSpeed = 0;
        if (this.focus) ch.faceYaw = Math.atan2(this.focus.x - ch.pos.x, this.focus.z - ch.pos.z);
        if (this.stateT <= 0) { ch.faceYaw = null; this.setState('walk'); }
        break;
      }
      default: ch.wishSpeed = 0;
    }
    a.phone = this.state === 'call' || (this.state === 'idle' && !!this.phoneIdle) || (this.state === 'walk' && !!this.phoneIdle);
  }

  pickActivity() {
    const r = Math.random();
    if (this.kind === 'beach') {
      if (r < 0.35) this.setState('sit', rand(15, 40));
      else if (r < 0.75) { this.target = randomIn(BEACH_ZONE); this.setState('wander', 30); }
      else { this.phoneIdle = Math.random() < 0.5; this.setState('idle', rand(4, 10)); }
      return;
    }
    if (r < 0.7) { this.phoneIdle = Math.random() < 0.15; this.setState('walk'); }
    else { this.phoneIdle = Math.random() < 0.5; this.setState('idle', rand(3, 8)); }
  }

  wander() {
    const ch = this.ch;
    if (!this.target) this.target = randomIn(this.kind === 'beach' ? BEACH_ZONE : PROMENADE_ZONE);
    const dx = this.target.x - ch.pos.x, dz = this.target.z - ch.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1 || this.stateT <= 0 || ch.blockedT > 1.5) { this.target = null; this.pickActivity(); return; }
    ch.wish.set(dx / d, dz / d);
    ch.wishSpeed = this.walkSpeed * 0.85;
  }

  walk(dt) {
    const ch = this.ch, g = this.game;
    if (this.node === null) {
      // join the sidewalk graph at the nearest node
      let best = 0, bd = Infinity;
      for (const n of SW) { const d = (n.x - ch.pos.x) ** 2 + (n.z - ch.pos.z) ** 2; if (d < bd) { bd = d; best = n.id; } }
      this.node = best; this.prevNode = null;
    }
    const n = SW[this.node];
    // walk with a sideways offset so people don't march in single file
    const prev = this.prevNode !== null ? SW[this.prevNode] : null;
    let tx = n.x, tz = n.z;
    if (prev) {
      const dx = n.x - prev.x, dz = n.z - prev.z, l = Math.hypot(dx, dz) || 1;
      tx += (-dz / l) * this.offset; tz += (dx / l) * this.offset;
    }
    const dx = tx - ch.pos.x, dz = tz - ch.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      const links = n.links.filter((l) => l.to !== this.prevNode);
      const pick = (links.length ? links : n.links)[Math.floor(Math.random() * (links.length || n.links.length))];
      if (pick.crossing && !this.safeToCross(n, SW[pick.to])) {
        this.waitT += dt;
        ch.wishSpeed = 0;
        if (this.waitT > 6) { this.waitT = 0; this.prevNode = pick.to; }
        return;
      }
      this.waitT = 0;
      this.prevNode = this.node;
      this.node = pick.to;
      if (Math.random() < 0.08) { this.setState('idle', rand(2, 6)); }
      return;
    }
    ch.wish.set(dx / d, dz / d);
    ch.wishSpeed = this.walkSpeed;
    if (ch.blockedT > 2) { this.node = null; ch.blockedT = 0; }
    void g;
  }

  safeToCross(a, b) {
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    for (const v of this.game.vehicles) {
      const d = Math.hypot(v.pos.x - mx, v.pos.z - mz);
      if (d < 9) return false;
      if (d < 35 && v.speed > 2) {
        const [fx, fz] = v.forward;
        if ((mx - v.pos.x) * fx + (mz - v.pos.z) * fz > 0) return false;
      }
    }
    return true;
  }

  dodge() {
    const ch = this.ch;
    for (const v of this.game.vehicles) {
      if (v.speed < 5) continue;
      const [lx, lz] = v.worldToLocal(ch.pos.x, ch.pos.z);
      if (lz > 0 && lz < 4 + v.speed * 0.6 && Math.abs(lx) < v.hx + 0.8) {
        // jump to whichever side is closer
        const side = lx >= 0 ? 1 : -1;
        const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
        ch.wish.set(side * c, -side * s);
        ch.wishSpeed = 6;
        if (this.state !== 'flee') { this.threat = { x: v.pos.x, z: v.pos.z }; this.setState('flee', rand(2, 4)); }
        return;
      }
    }
  }
}

function randomIn(z) { return { x: rand(z.x0, z.x1), z: rand(z.z0, z.z1) }; }

export class PedManager {
  constructor(game) {
    this.game = game;
    this.timer = 0;
    this.enabled = true;
    const ev = game.events;
    ev.on('gunshot', (e) => this.onGunshot(e));
    ev.on('damaged', ({ victim, source, kind }) => {
      if (victim.controller instanceof PedController && !victim.dead && kind !== 'fall') victim.controller.panic(source || victim.pos, kind === 'melee' ? 'assaulted' : 'shot');
    });
    ev.on('killed', ({ victim }) => { if (victim.controller?.call) game.wanted?.cancelCall(victim); });
  }

  get target() {
    const night = this.game.engine.time.night;
    return Math.round(30 * this.game.settings.gp.peds * (1 - night * 0.45));
  }

  makeController(ch, kind) { return new PedController(this.game, ch, kind); }

  get list() { return this.game.peds; }

  step(dt) {
    const g = this.game;
    for (const ch of g.peds) ch.controller?.step(dt);
    this.aimReactions();
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.6;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const tr = g.traffic;
    // despawn far walkers (drivers belong to their cars)
    for (const ch of [...g.peds]) {
      if (ch.vehicle || ch.missionActor) continue;
      const d = ch.distanceTo(p.x, p.z);
      const vis = tr ? tr.visible(ch.pos.x, ch.pos.y, ch.pos.z, 1.5) : false;
      if ((d > 150 && !vis) || d > 300 || (ch.dead && ch.deadT > 40 && !vis)) g.removeCharacter(ch);
    }
    if (!this.enabled) return;
    const walkers = g.peds.filter((c) => !c.vehicle && c.role === 'ped').length;
    if (walkers < this.target) this.spawnSome(p, Math.min(3, this.target - walkers));
  }

  spawnSome(p, n) {
    const tr = this.game.traffic;
    for (let k = 0; k < n; k++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        let x, z, kind;
        const r = Math.random();
        if (r < 0.3) { const q = randomIn(BEACH_ZONE); x = q.x; z = q.z; kind = 'beach'; }
        else if (r < 0.45) { const q = randomIn(PROMENADE_ZONE); x = q.x; z = q.z; kind = 'walker'; }
        else { const node = SW[Math.floor(Math.random() * SW.length)]; x = node.x + rand(-1, 1); z = node.z + rand(-1, 1); kind = 'walker'; }
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 45 || d > 130) continue;
        const y = this.game.world.ground(x, z, 2);
        if (tr && tr.visible(x, y, z, 1.5) && d < 90) continue;
        if (this.game.world.collision.overlapsCircle(x, z, 0.35, y + 0.2, 1.5)) continue;
        if (this.game.world.isWater(x, z)) continue;
        const group = kind !== 'beach' && Math.random() < 0.22 ? 2 : 1;
        let first = null;
        for (let i = 0; i < group; i++) {
          const look = randomLook(Math.random, kind === 'beach' ? { shorts: Math.random() < 0.85, sleeveless: Math.random() < 0.6 } : {});
          const ch = new Character(this.game, look, { role: 'ped', x: x + i * 1.1, z, yaw: Math.random() * 6.28 });
          ch.controller = new PedController(this.game, ch, kind);
          this.game.peds.push(ch);
          if (group > 1) {
            if (!first) first = ch;
            else { ch.controller.partner = first; first.controller.partner = ch; }
            ch.controller.setState('talk', rand(15, 40));
          } else ch.controller.pickActivity();
        }
        break;
      }
    }
  }

  onGunshot({ shooter, x, z }) {
    const g = this.game;
    for (const ch of g.peds) {
      if (ch.dead || ch.vehicle || ch === shooter || !(ch.controller instanceof PedController)) continue;
      const d = ch.distanceTo(x, z);
      if (d > 70) continue;
      const c = ch.controller;
      if (c.state === 'call') continue;
      if (d < 14 && Math.random() < 0.5) c.setState('cower', rand(3, 6));
      else c.panic({ x, z }, 'gunfire');
    }
  }

  /** Civilians who can see the crime scene become witnesses (some will call 911). */
  witness(crimeId, x, z, perpetrator, victim) {
    const g = this.game;
    let n = 0;
    for (const ch of g.peds) {
      if (ch.dead || ch.vehicle || ch === victim || !(ch.controller instanceof PedController)) continue;
      const d = ch.distanceTo(x, z);
      if (d > 45) continue;
      if (!this.canSee(ch, x, z)) continue;
      if (Math.random() < (d < 20 ? 0.8 : 0.45) && n < 3) { ch.controller.witnessed(crimeId, x, z); n++; }
      else ch.controller.panic({ x, z }, 'witness');
    }
    // the victim of a carjacking / assault calls it in themselves
    if (victim && victim.controller instanceof PedController && !victim.dead && CRIMES[crimeId]) victim.controller.witnessed(crimeId, x, z);
    void perpetrator;
  }

  canSee(ch, x, z) {
    const eye = ch.pos.y + 1.6;
    const hit = this.game.world.collision.raycast(ch.pos.x, eye, ch.pos.z, x - ch.pos.x, 0, z - ch.pos.z, 1, (c) => c.tag !== 'prop');
    return !hit || hit.t > 0.97;
  }

  /** Being aimed at: hands up or run. Pointing a gun at people is a crime only officers act on. */
  aimReactions() {
    const g = this.game;
    const t = g.player.controller.aimTarget;
    if (!t || !(t.controller instanceof PedController) || t.dead) return;
    const c = t.controller;
    if (['surrender', 'flee', 'cower', 'call', 'fight'].includes(c.state)) { if (c.state === 'surrender') c.stateT = Math.max(c.stateT, 1.5); return; }
    if (c.kind === 'clerk') return;
    if (Math.random() < 0.6) c.setState('surrender', 3); else c.panic(g.player, 'aimed');
    g.wanted?.crime('brandish', g.player.pos.x, g.player.pos.z);
  }
}

export { THREE };
