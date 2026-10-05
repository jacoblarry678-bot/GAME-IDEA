/**
 * Ambient event director: occasionally stages small scenes near (but out of
 * sight of) the player — a roadside argument, a broken-down car, a beach
 * party, a street performer with a crowd. Bounded: at most two active, a
 * global cooldown, a per-type cooldown, and cleanup when the player leaves.
 */
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';
import { PedController } from './peds.js';
import { SIDEWALKS, BEACH_ZONE, PROMENADE_ZONE, DISTRICT } from '../world/district.js';

const rand = (a, b) => a + Math.random() * (b - a);
const LINES = {
  argue: [
    'You backed into my car and you\'re yelling at ME?',
    'That parking spot had my cooler in it. That\'s a reservation.',
    'Delete the video. Delete it. I\'m serious.',
    'It\'s not a scam, it\'s a "wellness opportunity"!',
  ],
  breakdown: [
    'Third time this month. Third. Time.',
    'Yeah, I\'m on Coral... no, the car\'s on fire again. Little bit.',
  ],
  party: ['Somebody get the speaker out of the sand!', 'Is this the sunset thing? Are we live?'],
  performer: ['Tips welcome, opinions are not!', 'Ocean Mile, make some noise!'],
};

export const DIRECTOR_CONFIG = { globalCooldown: 45, typeCooldown: 180, maxActive: 2, spawnMin: 45, spawnMax: 110, despawnDist: 180 };

export class Director {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.globalT = 20;
    this.typeT = {};
    this.enabled = true;
    this.history = [];
  }

  step(dt) {
    const g = this.game;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    this.globalT -= dt;
    for (const k in this.typeT) this.typeT[k] -= dt;
    for (const ev of [...this.active]) {
      ev.t += dt;
      const d = Math.hypot(ev.x - p.x, ev.z - p.z);
      if (d < 7 && !ev.spoke && ev.lines) { ev.spoke = true; g.hud?.subtitle(ev.speaker || 'Passer-by', ev.lines[Math.floor(Math.random() * ev.lines.length)], 3.5); }
      if (d > DIRECTOR_CONFIG.despawnDist || ev.t > ev.life) this.end(ev);
    }
    if (!this.enabled || g.wanted.level > 0 || g.missions.active) return;
    if (this.globalT > 0 || this.active.length >= DIRECTOR_CONFIG.maxActive) return;
    const types = ['argue', 'breakdown', 'party', 'performer'].filter((t) => !(this.typeT[t] > 0));
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)];
    if (this.spawn(type, p)) { this.globalT = DIRECTOR_CONFIG.globalCooldown; this.typeT[type] = DIRECTOR_CONFIG.typeCooldown; }
    else this.globalT = 5;
  }

  /** A spot out of view at a reasonable distance. */
  findSpot(p, pickFn) {
    const tr = this.game.traffic;
    for (let i = 0; i < 20; i++) {
      const q = pickFn();
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < DIRECTOR_CONFIG.spawnMin || d > DIRECTOR_CONFIG.spawnMax) continue;
      if (tr && tr.visible(q.x, 0, q.z, 3)) continue;
      if (this.game.world.collision.overlapsCircle(q.x, q.z, 1.2, 0.2, 1.5)) continue;
      return q;
    }
    return null;
  }

  ped(x, z, state, dur, look = {}) {
    const g = this.game;
    const ch = new Character(g, randomLook(Math.random, look), { role: 'ped', x, z, yaw: Math.random() * 6.28 });
    ch.controller = new PedController(g, ch, 'walker');
    ch.controller.setState(state, dur);
    ch.missionActor = true;
    g.extras.push(ch);
    return ch;
  }

  spawn(type, p) {
    const g = this.game;
    let ev = null;
    if (type === 'argue') {
      const q = this.findSpot(p, () => { const n = SIDEWALKS.nodes[Math.floor(Math.random() * SIDEWALKS.nodes.length)]; return { x: n.x + rand(-6, 6), z: n.z + rand(-6, 6) }; });
      if (!q) return false;
      const a = this.ped(q.x, q.z, 'argue', rand(40, 70)), b = this.ped(q.x + 1.3, q.z + 0.4, 'argue', rand(40, 70));
      a.controller.partner = b; b.controller.partner = a;
      ev = { type, x: q.x, z: q.z, actors: [a, b], life: 90, lines: LINES.argue };
    } else if (type === 'breakdown') {
      const lots = DISTRICT.lots.filter((l) => l.x1 - l.x0 > 8 && l.z1 - l.z0 > 8);
      const q = this.findSpot(p, () => { const l = lots[Math.floor(Math.random() * lots.length)]; return { x: rand(l.x0 + 3, l.x1 - 3), z: rand(l.z0 + 3, l.z1 - 3) }; });
      if (!q) return false;
      if (g.vehicles.some((v) => Math.hypot(v.pos.x - q.x, v.pos.z - q.z) < 7)) return false;
      const v = g.addVehicle(Math.random() < 0.5 ? 'kestrel' : 'pickup', q.x, q.z, Math.random() * 6.28);
      v.health = 260; v.smoking = true; v.mission = true;
      const [dx, dz] = v.doorPoint(0);
      const d = this.ped(dx + 0.8, dz, 'idle', 999);
      d.controller.phoneIdle = true; d.anim_.phone = true;
      ev = { type, x: q.x, z: q.z, actors: [d], vehicles: [v], life: 140, lines: LINES.breakdown, speaker: 'Driver' };
    } else if (type === 'party') {
      const q = this.findSpot(p, () => ({ x: rand(BEACH_ZONE.x0 + 5, BEACH_ZONE.x1 - 5), z: rand(BEACH_ZONE.z0, BEACH_ZONE.z1) }));
      if (!q) return false;
      const n = 4 + Math.floor(Math.random() * 3);
      const actors = [];
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const a = this.ped(q.x + Math.cos(ang) * 2.2, q.z + Math.sin(ang) * 2.2, Math.random() < 0.6 ? 'dance' : 'watch', 120, { shorts: true, sleeveless: Math.random() < 0.7 });
        a.controller.focus = q; a.controller.spin = rand(-1.2, 1.2);
        actors.push(a);
      }
      ev = { type, x: q.x, z: q.z, actors, life: 150, lines: LINES.party };
    } else if (type === 'performer') {
      const q = this.findSpot(p, () => ({ x: rand(PROMENADE_ZONE.x0 + 1, PROMENADE_ZONE.x1 - 1), z: rand(PROMENADE_ZONE.z0, PROMENADE_ZONE.z1) }));
      if (!q) return false;
      const perf = this.ped(q.x, q.z, 'dance', 140, { top: 0xff3fa4, hat: 0x111111 });
      perf.controller.spin = 1.6;
      const actors = [perf];
      for (let i = 0; i < 3; i++) {
        const ang = rand(0, 6.28);
        const a = this.ped(q.x + Math.cos(ang) * 3.2, q.z + Math.sin(ang) * 3.2, 'watch', 140);
        a.controller.focus = q;
        actors.push(a);
      }
      ev = { type, x: q.x, z: q.z, actors, life: 150, lines: LINES.performer, speaker: 'Performer' };
    }
    if (!ev) return false;
    ev.t = 0;
    this.active.push(ev);
    this.history.unshift({ type, t: g.time });
    g.events.emit('ambientEvent', ev);
    return true;
  }

  end(ev) {
    const g = this.game;
    for (const a of ev.actors || []) if (!a.removed) g.removeCharacter(a);
    for (const v of ev.vehicles || []) if (g.vehicles.includes(v) && !v.seats.includes(g.player)) g.removeVehicle(v);
    this.active.splice(this.active.indexOf(ev), 1);
  }

  clearAll() { for (const ev of [...this.active]) this.end(ev); }
}
