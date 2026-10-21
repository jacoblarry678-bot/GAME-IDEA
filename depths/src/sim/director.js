/**
 * Pressure director. Each active area has a pressure value 0..100 that
 * schedules optional events; it never secretly changes damage, speed or
 * hearing. Rules: one active pursuing archetype at a time; 45 s without
 * another optional pursuit after one ends; 20 s without a new attacker after
 * damage; optional spawns only in unoccupied rooms with two routes, out of
 * every player's view and at least 20 m of walking from the nearest player.
 */
import { createCreature } from './enemies/index.js';

export class Director {
  constructor(game) {
    this.game = game;
    this.pressure = 0;
    this.lastPursuitEnd = -999;
    this.lastDamage = -999;
    this.nextEvent = 40;
    this.pursuers = new Set();
    this.optional = null; // id of the optional creature currently spawned
    this.damagedThisPursuit = false;
    this.log = [];
  }

  add(v, why) {
    this.pressure = Math.max(0, Math.min(100, this.pressure + v));
    this.log.push({ t: this.game.time, v, why, p: this.pressure });
    if (this.log.length > 60) this.log.shift();
  }
  onMajorObjective() { this.add(10, 'objective'); }
  onFlash() { this.add(5, 'flash'); }
  onRefuge() { this.add(-30, 'refuge'); }
  onDamage() { this.lastDamage = this.game.time; this.damagedThisPursuit = true; }
  onPursuitStart(c) { this.pursuers.add(c.id); this.damagedThisPursuit = false; }
  onPursuitEnd(c) {
    this.pursuers.delete(c.id);
    this.lastPursuitEnd = this.game.time;
    // A14 Quiet Shift: a Listener pursuit that ends with its target alive and untouched
    const t = c.target ? this.game.players.get(c.target) : null;
    if (c.type === 'listener' && !c.pursuitDamaged && (!t || (t.alive && !t.downed))) this.game.fx('profile', { kind: 'achievement', id: 'A14' });
    if (this.damagedThisPursuit) this.add(-20, 'damaging encounter');
  }

  /** May this creature start a new attack right now? */
  blocksNewAttacker(c) {
    const g = this.game;
    for (const id of this.pursuers) if (id !== c.id) { const o = g.enemyById(id); if (o && o.state === 'pursue' && o.type !== c.type) return true; }
    if (g.time - this.lastDamage < 20 && !this.pursuers.has(c.id)) return true;
    if (!c.encounter && g.time - this.lastPursuitEnd < 45) return true;
    return false;
  }

  update(dt) {
    const g = this.game;
    const outside = [...g.players.values()].some((p) => p.alive && !g.inRefugeVolume(p));
    if (outside) this.add(dt / 60, null);
    if (this.log.length && this.log[this.log.length - 1].why === null) this.log.pop();
    if (g.scripted || g.paused) return;
    const D = g.chapterDef && g.chapterDef.director;
    if (!D) return;
    this.nextEvent -= dt;
    if (this.nextEvent > 0) return;
    this.nextEvent = 25 + g.rng.range(0, 25);
    const tier = this.pressure < 25 ? 0 : this.pressure < 50 ? 1 : this.pressure < 75 ? 2 : 3;
    const roamOk = D.roamer && (!D.roamer.after || g.story.has(D.roamer.after)) && (!D.roamer.until || !g.story.has(D.roamer.until));
    if (tier >= 2 && roamOk) { if (this.spawnRoamer(D.roamer, 'patrol')) { if (tier === 3) this.ambient(D); return; } }
    if (tier === 1 && roamOk && g.rng.next() < 0.6) { if (this.spawnRoamer(D.roamer, 'investigate')) return; }
    this.ambient(D);
  }

  ambient(D) {
    const g = this.game;
    const p = g.anyLivingPlayer();
    if (!p) return;
    const r = g.rng.next();
    if (r < 0.5) g.fx('ambientEvent', { kind: g.rng.pick(D.ambient || ['distantDoor', 'pipeKnock', 'tubeBuzz']), x: p.x + g.rng.range(-15, 15), z: p.z + g.rng.range(-15, 15) });
    else if (r < 0.75) g.fx('radioInterference', {});
    else {
      const room = this.pickRoom(D.roamer ? D.roamer.rooms : null, 14);
      if (room) g.fx('silhouette', { type: D.roamer ? D.roamer.type : 'listener', x: room.cx, z: room.cz, room: room.id });
    }
  }

  /** A room suitable for an optional spawn. */
  pickRoom(rooms, minDist = 20) {
    const g = this.game, L = g.level;
    const cand = [];
    for (const r of L.rooms) {
      if (rooms && !rooms.includes(r.id)) continue;
      if (r.refuge || r.noSpawn) continue;
      if (r.doors.filter((d) => !g.isDoorLocked(d)).length < 2) continue;
      let ok = true;
      for (const p of g.players.values()) {
        if (!p.active) continue;
        if (p.room === r.id) { ok = false; break; }
        const path = L.nav.path(p.x, p.z, r.cx, r.cz, null, null, 8000);
        const len = path ? L.nav.pathLength(path, p.x, p.z) : 0;
        if (path && len < minDist) { ok = false; break; }
        if (g.playerCanSeePoint(p, r.cx, 1.0, r.cz)) { ok = false; break; }
      }
      if (ok) cand.push(r);
    }
    return cand.length ? g.rng.pick(cand) : null;
  }

  spawnRoamer(R, mode) {
    const g = this.game;
    if (this.optional && g.enemyById(this.optional) && !g.enemyById(this.optional).gone) return false;
    if (g.time - this.lastPursuitEnd < 45 || g.time - this.lastDamage < 20) return false;
    if ([...g.enemies].some((e) => !e.gone && e.state === 'pursue')) return false;
    const room = this.pickRoom(R.rooms, 20);
    if (!room) return false;
    const pt = g.level.nav.nearest(room.cx, room.cz, null, 8);
    if (pt < 0) return false;
    const c0 = g.level.nav.center(pt);
    const anchors = (R.rooms || []).map((id) => g.level.room(id)).filter(Boolean).map((r) => ({ x: r.cx, z: r.cz }));
    const c = createCreature(g, R.type, { x: c0.x, z: c0.z, anchors: anchors.length ? anchors : [c0], withdrawTo: c0, despawnOnWithdraw: true });
    c.optional = true;
    g.addEnemy(c);
    this.optional = c.id;
    if (mode === 'investigate') {
      const p = g.anyLivingPlayer();
      // investigate a point near (not at) the party, with an audible cue
      c.suspect = { x: p.x + g.rng.range(-6, 6), z: p.z + g.rng.range(-6, 6), t: g.time };
      c.setState('investigate');
    }
    g.fx('roamer', { id: c.id, type: R.type, room: room.id, mode });
    // optional threats leave after a while if nothing happens
    c.data.leaveAt = g.time + 90;
    return true;
  }

  serialize() { return { pressure: this.pressure, nextEvent: this.nextEvent }; }
  restore(s) { this.pressure = s.pressure || 0; this.nextEvent = s.nextEvent || 40; this.pursuers.clear(); this.optional = null; this.lastPursuitEnd = -999; this.lastDamage = -999; }
}
