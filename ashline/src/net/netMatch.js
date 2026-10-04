/**
 * Client-side mirror of a server match. The Game drives it exactly like a
 * local Match, but:
 *  - the local player is predicted (same Combatant simulation, same inputs
 *    that are streamed to the server) and smoothly corrected towards the
 *    server's authoritative position;
 *  - everyone else is interpolated INTERP_DELAY behind the server clock;
 *  - shots, damage, kills, objectives and equipment are replayed from server
 *    events, so the HUD, audio and effects code is shared with offline play.
 * Nothing here decides a hit, a kill or a score.
 */
import { Match } from '../game/match.js';
import { Combatant } from '../entities/combatant.js';
import { EQUIPMENT } from '../data/weapons.js';
import { packCmd, unpackEntity, deserEvent, INTERP_DELAY } from './protocol.js';

const SNAP_DIST = 2.5; // larger prediction errors snap instead of blending

export class NetMatch extends Match {
  constructor(map, setup, net, info) {
    super(map, { ...setup, botsAllies: 0, botsEnemies: 0, includePlayer: false, countdown: 0 });
    this.online = true;
    this.net = net;
    this.mid = info.mid;
    this.byId = new Map();
    this.inbox = [];
    this.seq = 0;
    this.pending = []; // predicted inputs not yet acknowledged: { seq, x, y, z }
    this.corr = { x: 0, y: 0, z: 0 };
    this.sendBuf = [];
    this.respawnAskT = 0;
    this.lastLocal = { shot: -9, throw: -9, support: -9 };
    this.projPrev = null; this.projCur = null;
    this.unsub = [net.on('snap', (m) => { if (m.mid === this.mid) this.inbox.push(m); }), net.on('roster', (m) => { if (m.mid === this.mid) this.inbox.push(m); })];
    this.applyRoster(info.roster, info.you);
    this.time = net.serverNow();
  }

  dispose() { for (const u of this.unsub) u(); }

  // ---------------------------------------------------------------- roster
  applyRoster(list, youId) {
    const keep = new Set();
    const added = [], removed = [];
    for (const r of list) {
      keep.add(r.id);
      let c = this.byId.get(r.id);
      if (!c) {
        c = new Combatant({ name: r.name, team: r.team, isBot: r.isBot, loadout: r.loadout });
        c.id = r.id;
        c.alive = false;
        c.netBuf = [];
        this.byId.set(r.id, c);
        this.add(c);
        added.push(c);
      } else {
        c.team = r.team;
        if (r.loadout.primary !== c.loadout.primary || r.loadout.secondary !== c.loadout.secondary) c.applyLoadout({ ...c.loadout, ...r.loadout });
      }
      c.human = r.human;
      c.look = r.look;
      c.netPing = r.ping;
      if (youId !== undefined && youId !== null && r.id === youId) this.player = c;
    }
    for (const [id, c] of this.byId) {
      if (keep.has(id)) continue;
      this.byId.delete(id);
      const i = this.combatants.indexOf(c);
      if (i >= 0) this.combatants.splice(i, 1);
      removed.push(c);
    }
    if (this.teamScores.length < this.combatants.length + 1) this.teamScores = new Array(Math.max(2, this.combatants.length + 1)).fill(0);
    if (added.length || removed.length) this.onRoster?.(added, removed);
  }

  find(id) { return this.byId.get(id) || null; }

  // ---------------------------------------------------------------- lifecycle
  start() {
    this.mode.setup?.(this);
    if (this.mode.id === 'gun') for (const c of this.combatants) c.gunLevel = c.gunLevel || 0;
    this.emit({ type: 'matchStart' });
  }

  /** Ask the server to respawn us (it decides where and when). */
  respawn(c) {
    if (c !== this.player || this.time - this.respawnAskT < 0.4) return;
    this.respawnAskT = this.time;
    this.net.send({ t: 'respawn' });
  }

  // ---------------------------------------------------------------- frame
  tick(dt) {
    this.events.length = 0;
    for (const m of this.inbox.splice(0)) {
      if (m.t === 'roster') this.applyRoster(m.list, m.you);
      else this.applySnapshot(m);
    }
    this.time = this.net.serverNow();
    if (this.state === 'countdown') this.countdown = Math.max(0, this.countdown - dt);
    else if (this.state === 'live') this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.predict(dt);
    this.interpolate();
  }

  predict(dt) {
    const p = this.player;
    if (!p) return;
    if (!p.alive || this.state === 'ended') { p.cmd.fire = false; return; }
    const cmd = p.cmd;
    if (this.state === 'countdown') { cmd.moveX = cmd.moveZ = 0; cmd.fire = cmd.jump = cmd.melee = cmd.lethal = cmd.tactical = false; cmd.support = null; }
    const seq = ++this.seq;
    const vt = this.net.serverNow() - INTERP_DELAY; // what we are drawing other players at
    this.sendBuf.push(packCmd(seq, Math.min(dt, 0.05), cmd, vt));
    if (cmd.support) this.lastLocal.support = this.time;
    if (cmd.lethal || cmd.tactical) this.lastLocal.throw = this.time;
    p.tick(Math.min(dt, 0.05), this);
    // blend out prediction error
    const k = Math.min(1, dt * 10);
    const cx = this.corr.x * k, cy = this.corr.y * k, cz = this.corr.z * k;
    p.x += cx; p.y += cy; p.z += cz;
    this.corr.x -= cx; this.corr.y -= cy; this.corr.z -= cz;
    this.pending.push({ seq, x: p.x + this.corr.x, y: p.y + this.corr.y, z: p.z + this.corr.z });
    if (this.pending.length > 240) this.pending.shift();
    // send inputs at up to ~60 Hz in small batches
    if (this.sendBuf.length >= 2 || dt > 1 / 45) { this.net.send({ t: 'cmd', c: this.sendBuf }); this.sendBuf = []; }
  }

  interpolate() {
    const rt = this.net.serverNow() - INTERP_DELAY;
    for (const c of this.combatants) {
      if (c === this.player || !c.netBuf.length) continue;
      const buf = c.netBuf;
      while (buf.length > 2 && buf[1].t <= rt) buf.shift();
      const a = buf[0], b = buf[1] || a;
      const k = b.t > a.t ? Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t))) : 1;
      const s = k < 0.5 ? a : b;
      c.x = a.x + (b.x - a.x) * k; c.y = a.y + (b.y - a.y) * k; c.z = a.z + (b.z - a.z) * k;
      c.yaw = lerpAngle(a.yaw, b.yaw, k); c.pitch = a.pitch + (b.pitch - a.pitch) * k;
      c.vx = a.vx + (b.vx - a.vx) * k; c.vz = a.vz + (b.vz - a.vz) * k; c.vy = b.vy;
      c.stance = s.stance; c.grounded = s.grounded; c.sprinting = s.sprinting; c.mantle = s.mantle ? {} : null;
      c.adsT = a.adsT + (b.adsT - a.adsT) * k; c.swapT = s.swapT; c.meleeT = s.meleeT; c.throwT = s.throwT; c.throwKind = s.throwKind;
      if (c.cur !== s.cur && c.weapons[s.cur]) c.cur = s.cur;
      if (c.weapon) c.weapon.reloading = s.reloading;
    }
    // grenades between the last two snapshots
    if (this.projCur) {
      const span = this.projCur.t - (this.projPrev?.t ?? this.projCur.t);
      // ease from the previous to the latest snapshot over one snapshot interval
      const k = span > 0 ? Math.max(0, Math.min(1, (rt + INTERP_DELAY - this.projCur.t) / span)) : 1;
      const prev = new Map((this.projPrev?.list || []).map((g) => [g.id, g]));
      for (const g of this.projectiles.list) {
        const a = prev.get(g.id);
        if (!a) continue;
        const kk = Math.min(1, k);
        g.x = a.tx + (g.tx - a.tx) * kk; g.y = a.ty + (g.ty - a.ty) * kk; g.z = a.tz + (g.tz - a.tz) * kk;
      }
    }
  }

  // ---------------------------------------------------------------- snapshots
  applySnapshot(s) {
    // match / objective state
    const m = s.m;
    this.state = m.state;
    this.countdown = m.cd;
    this.timeLeft = m.tl;
    this.teamScores = m.ts;
    this.winner = m.w;
    this.endReason = m.er;
    if (m.fl && this.flags) m.fl.forEach((f, i) => { const F = this.flags[i]; if (F) { F.owner = f[0]; F.progress = f[1]; F.contested = !!f[2]; F.capturing = f[3]; } });
    if (m.hp && this.hp) { this.hp.idx = m.hp[0]; this.hp.owner = m.hp[1]; this.hp.contested = !!m.hp[2]; this.hp.t = m.hp[3]; }
    if (m.rd && this.round) { this.round.n = m.rd[0]; this.round.phase = m.rd[1]; }

    // combatants
    const p = this.player;
    for (const a of s.e) {
      const c = this.byId.get(a[0]);
      if (!c) continue;
      const u = unpackEntity(a);
      if (u.primary !== c.loadout.primary || u.secondary !== c.loadout.secondary) {
        c.applyLoadout({ ...c.loadout, primary: u.primary, secondary: u.secondary });
        if (c === p) this.onLoadoutChange?.(c);
      }
      c.gunLevel = u.gunLevel;
      if (c === p) { this.reconcile(u, s); continue; }
      if (u.alive && !c.alive) { c.netBuf.length = 0; c.x = u.x; c.y = u.y; c.z = u.z; c.events.push({ type: 'spawn' }); }
      if (!u.alive && c.alive) c.deathT = this.time;
      c.alive = u.alive;
      c.health = u.health;
      c.spawnProtectT = u.protect ? 1 : 0;
      c.netBuf.push({ t: s.time, ...u });
      if (c.netBuf.length > 30) c.netBuf.shift();
    }
    // scoreboard
    for (const r of s.sb) {
      const c = this.byId.get(r[0]);
      if (!c) continue;
      Object.assign(c.stats, { kills: r[1], deaths: r[2], assists: r[3], score: r[4], streak: r[5], captures: r[6] });
      c.netPing = r[7] >= 0 ? r[7] : null;
    }
    // events (shared HUD/audio/effects handlers)
    const find = (id) => this.byId.get(id) || null;
    for (const raw of s.ev) {
      const e = deserEvent(raw, find);
      if (e.type === 'shot' && e.c === p) continue; // already shown locally
      if (e.type === 'melee' && e.c === p && !e.hit) continue;
      if (e.type === 'spawn' || e.type === 'matchStart') continue;
      if ((e.type === 'kill' || e.type === 'damage') && !e.victim) continue;
      if (e.type === 'kill' && e.victim === p) p.lastKiller = e.killer;
      this.emit(e);
    }
    for (const [id, list] of Object.entries(s.ce || {})) {
      const c = this.byId.get(Number(id));
      if (!c || c === p) continue;
      for (const e of list) c.events.push(e);
    }
    // grenades
    this.projPrev = this.projCur;
    this.projCur = { t: s.time, list: s.p.map((g) => ({ id: g[0], kind: g[1], tx: g[2], ty: g[3], tz: g[4], rest: !!g[5], spin: g[6] })) };
    const old = new Map(this.projectiles.list.map((g) => [g.id, g]));
    this.projectiles.list = this.projCur.list.map((g) => Object.assign(old.get(g.id) || { x: g.tx, y: g.ty, z: g.tz, fuse: 1 }, g));
    // deployables
    this.syncDeployables(s.d);
  }

  reconcile(u, s) {
    const p = this.player, you = s.you;
    if (!you) return;
    if (!u.alive) {
      if (p.alive) { p.alive = false; p.health = 0; p.deathT = this.time; p.adsT = 0; p.sprinting = false; }
      p.respawnT = you.rt;
      this.pending.length = 0;
      this.corr = { x: 0, y: 0, z: 0 };
      return;
    }
    if (!p.alive) {
      // the server respawned us
      p.spawnAt({ x: u.x, y: u.y, z: u.z, yaw: u.yaw });
      p.spawnProtectT = you.sp;
      this.pending.length = 0;
      this.corr = { x: 0, y: 0, z: 0 };
    } else {
      // position error at the acknowledged input
      while (this.pending.length && this.pending[0].seq < s.ack) this.pending.shift();
      const h = this.pending[0];
      if (h && h.seq === s.ack) {
        const ex = u.x - h.x, ey = u.y - h.y, ez = u.z - h.z;
        const err = Math.hypot(ex, ey, ez);
        for (const q of this.pending) { q.x += ex; q.y += ey; q.z += ez; }
        if (err > SNAP_DIST) { p.x += ex + this.corr.x; p.y += ey + this.corr.y; p.z += ez + this.corr.z; this.corr = { x: 0, y: 0, z: 0 }; p.vx = u.vx; p.vz = u.vz; }
        else if (err > 0.01) { this.corr.x += ex; this.corr.y += ey; this.corr.z += ez; }
        this.pending.shift();
      }
    }
    // authoritative values
    p.health = you.hp;
    p.spawnProtectT = you.sp;
    if (you.bl > p.blindT + 0.05 || you.bl === 0) { p.blindT = you.bl; p.blindMax = you.bm; }
    p.supportKills = you.sk;
    if (this.time - this.lastLocal.support > 0.6) Object.assign(p.abilities, you.ab);
    if (this.time - this.lastLocal.throw > 0.8 && p.throwT <= 0) { p.lethal.count = you.le; p.tactical.count = you.ta; }
    p.weapons.forEach((w, i) => {
      if (w.reloading) return;
      if (this.time - w.lastShot > 0.5 && you.mag[i] !== undefined) w.mag = you.mag[i];
      if (you.res[i] !== undefined) w.reserve = you.res[i];
    });
  }

  syncDeployables(d) {
    const dep = this.deployables;
    const def = EQUIPMENT.shield;
    const seen = new Set();
    for (const a of d.sh) {
      const [id, ownerId, team, x, y, z, alongX, hp, hitT] = a;
      seen.add(id);
      let s = dep.shields.find((q) => q.id === id);
      if (!s) {
        s = { id, owner: this.byId.get(ownerId) || { x, z }, team, x, y, z, alongX: !!alongX, hp, maxHp: def.hp, w: def.width, h: def.height, d: def.depth };
        const hw = def.width / 2, hd = def.depth / 2;
        const box = alongX ? { minX: x - hd, maxX: x + hd, minZ: z - hw, maxZ: z + hw } : { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
        s.box = this.world.add({ ...box, minY: y, maxY: y + def.height, mat: 'metal', shield: s }, true);
        dep.shields.push(s);
      }
      s.hp = hp; s.hitT = hitT || s.hitT;
    }
    for (const s of [...dep.shields]) if (!seen.has(s.id)) { this.world.remove(s.box); dep.shields.splice(dep.shields.indexOf(s), 1); }
    dep.drops = d.dr.map(([id, team, x, y, z, fall, life]) => ({ id, team, x, y, z, fall, life, used: new Set() }));
    dep.strikes = d.st.map(([id, team, x, y, z, t]) => ({ id, team, x, y, z, t }));
    dep.recon = d.rc;
  }

  // ---------------------------------------------------------------- local-only callbacks (ctx for the predicted player)
  /** Predicted shot: tracer and muzzle effects only. Hits are decided by the server. */
  fireWeapon(c, wpn) {
    const def = wpn.def;
    const ox = c.x, oy = c.eyeY, oz = c.z;
    const ends = [];
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const cp = Math.cos(c.pitch);
      const res = this.trace(c, ox, oy, oz, -Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp, def.range);
      res.victim = null;
      ends.push(res);
    }
    this.lastLocal.shot = this.time;
    this.emit({ type: 'shot', c, weapon: def.id, ox, oy, oz, ends, tracer: pellets > 1 || (c.stats.shots % def.tracerEvery === 0), predicted: true });
  }
  doMelee() {}
  throwEquipment() {}
  useSupport() { return true; }
  applyDamage() {}
  onFell() {}
  noise() {}
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
