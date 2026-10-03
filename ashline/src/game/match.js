/**
 * Match: owns the combatants, rules, timer, scoring, spawning, shooting and
 * damage. Runs identically with or without rendering (headless sim tests use
 * it directly). Presentation subscribes to `events`.
 */
import { Combatant } from '../entities/combatant.js';
import { BotBrain } from '../entities/bot.js';
import { Projectiles } from '../combat/projectiles.js';
import { WEAPONS, MELEE, damageAt, PRIMARY_IDS } from '../data/weapons.js';
import { MODES, DIFFICULTIES } from './modes.js';
import { chooseSpawn } from './spawns.js';
import { BOT_NAMES } from '../data/names.js';

const DEG = Math.PI / 180;

export class Match {
  /**
   * @param {object} map   { world, nav, spawns, hotspots, def }
   * @param {object} settings { mode, scoreLimit, timeLimit(min), botsAllies, botsEnemies, difficulty, friendlyFire, playerName, playerLoadout, includePlayer }
   */
  constructor(map, settings, rng = Math.random) {
    this.map = map;
    this.world = map.world;
    this.nav = map.nav;
    this.settings = settings;
    this.mode = MODES[settings.mode];
    this.difficulty = DIFFICULTIES[settings.difficulty] || DIFFICULTIES.regular;
    this.rng = rng;
    this.time = 0;
    this.state = 'countdown';
    this.countdown = settings.countdown ?? 3;
    this.timeLeft = settings.timeLimit * 60;
    this.teamScores = [0, 0];
    this.combatants = [];
    this.events = [];
    this.listeners = [];
    this.recentDeaths = [];
    this.winner = null;
    this.endReason = null;
    this.endT = 0;
    this.firstBlood = false;
    this.projectiles = new Projectiles(this);
    this.player = null;
    this._populate();
  }

  _populate() {
    const s = this.settings;
    const names = [...BOT_NAMES].sort(() => this.rng() - 0.5);
    let ni = 0;
    if (s.includePlayer !== false) {
      this.player = this.add(new Combatant({ name: s.playerName || 'You', team: 0, isBot: false, loadout: s.playerLoadout }));
    }
    const mk = (team) => {
      const lo = randomBotLoadout(this.rng);
      const c = new Combatant({ name: names[ni++ % names.length], team, isBot: true, loadout: lo });
      c.brain = new BotBrain(c, this);
      this.add(c);
    };
    if (this.mode.range) {
      // training targets: static or strafing, standing or crouched; they never shoot back
      for (const t of this.map.def.targets || []) {
        const c = new Combatant({ name: `TARGET ${t.d}m`, team: 1, isBot: true, loadout: { primary: 'pistol_warden', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' } });
        c.dummy = { ...t, baseX: t.x, phase: Math.random() * Math.PI * 2 };
        c.lethal.count = 0; c.tactical.count = 0;
        this.add(c);
      }
      return;
    }
    if (!this.mode.teams) {
      // free-for-all: everyone is their own team (player = team 0)
      const n = Math.min(9, s.botsEnemies + (s.botsAllies || 0) * 0);
      for (let i = 0; i < n; i++) mk(i + 1);
      this.teamScores = new Array(n + 1).fill(0);
      return;
    }
    for (let i = 0; i < s.botsAllies; i++) mk(0);
    for (let i = 0; i < s.botsEnemies; i++) mk(1);
  }

  /** Number of score slots (2 for team modes, one per combatant in FFA modes). */
  get teamCount() { return this.teamScores.length; }

  add(c) {
    c._world = this.world;
    this.combatants.push(c);
    return c;
  }

  on(fn) { this.listeners.push(fn); }
  emit(e) {
    e.time = this.time;
    this.events.push(e);
    for (const l of this.listeners) l(e);
  }

  /** Initial spawn of everyone. */
  start() {
    this.mode.setup?.(this);
    for (const c of this.combatants) this.respawn(c, true);
    this.emit({ type: 'matchStart' });
  }

  respawn(c, initial = false) {
    const sp = c.dummy ? { x: c.dummy.baseX, y: 0, z: c.dummy.z, yaw: Math.PI } : chooseSpawn(this, c, initial);
    if (this.mode.loadoutFor) c.applyLoadout(this.mode.loadoutFor(this, c));
    c.spawnAt(sp);
    c.spawnProtectT = initial ? 0 : 2.0;
    if (c.brain) c.brain.onSpawn();
    this.emit({ type: 'spawn', c });
  }

  enemiesOf(c) { return this.combatants.filter((o) => o.team !== c.team); }

  tick(dt) {
    this.events.length = 0;
    if (!this.presenter) for (const c of this.combatants) c.events.length = 0;
    // substep for stability
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this._step(h);
  }

  _step(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      // allow looking but not moving
      for (const c of this.combatants) {
        c.cmd.moveX = c.cmd.moveZ = 0; c.cmd.fire = false; c.cmd.jump = false;
        if (c.brain) c.brain.idleLook(dt);
        c.tick(dt, this);
      }
      if (this.countdown <= 0) { this.state = 'live'; this.emit({ type: 'live' }); }
      return;
    }
    if (this.state === 'ended') {
      this.endT += dt;
      return;
    }
    this.time += dt;
    this.timeLeft -= dt;
    // rotate update order every tick so no team systematically acts first
    const n = this.combatants.length;
    this._order = (this._order || 0) + 1;
    for (let k = 0; k < n; k++) {
      const c = this.combatants[(k + this._order) % n];
      if (c.brain && c.alive) c.brain.update(dt);
      if (c.dummy) { c.cmd.crouch = !!c.dummy.crouch; c.cmd.yaw = Math.PI; c.cmd.pitch = 0; }
      c.tick(dt, this);
      if (c.dummy) this._dummy(c, dt);
      if (!c.alive) {
        c.respawnT -= dt;
        if (c.isBot && c.respawnT <= 0 && this.canRespawn(c)) this.respawn(c);
      }
    }
    this.projectiles.update(dt);
    this.mode.update?.(this, dt);
    if (this.timeLeft <= 0 && this.state === 'live') {
      this.timeLeft = 0;
      this.mode.onTimeUp(this);
    }
    // prune recent deaths
    while (this.recentDeaths.length && this.time - this.recentDeaths[0].t > 12) this.recentDeaths.shift();
  }

  _dummy(c, dt) {
    const d = c.dummy;
    if (d.move && c.alive && this.movingTargets !== false) {
      d.phase += dt * d.move.speed;
      const nx = d.baseX + Math.sin(d.phase) * d.move.amp;
      c.vx = Math.max(-8, Math.min(8, (nx - c.x) / Math.max(dt, 1e-4))); // real velocity for animation/readouts
      c.x = nx;
    } else if (c.alive) { c.vx = 0; c.vz = 0; }
    if (this.infiniteAmmo !== false && this.player) {
      for (const w of this.player.weapons) if (w.reserve < w.def.mag) w.reserve = w.def.reserve;
    }
  }

  canRespawn(c) { return this.state !== 'ended' && (this.mode.canRespawn ? this.mode.canRespawn(this, c) : true); }

  end(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.winner = winner;
    this.endReason = reason;
    this.endT = 0;
    for (const c of this.combatants) { c.cmd.fire = false; c.vx = c.vz = 0; }
    this.emit({ type: 'matchEnd', winner, reason });
  }

  // ---------------- combat callbacks (ctx for Combatant.tick) ----------------

  fireWeapon(c, wpn) {
    const def = wpn.def;
    const ox = c.x, oy = c.eyeY, oz = c.z;
    const spread = c.spreadDeg() * DEG;
    const pellets = def.pellets || 1;
    const pelletSpread = (def.pelletSpread || 0) * DEG * (1 - c.adsT * 0.2);
    const yaw = c.yaw, pitch = c.pitch;
    // base direction with spread
    const base = coneDir(yaw, pitch, spread, this.rng);
    const hitsByVictim = new Map();
    const ends = [];
    let anyHit = false;
    for (let p = 0; p < pellets; p++) {
      let d = base;
      if (pellets > 1) {
        const by = Math.atan2(-base[0], -base[2]);
        const bp = Math.asin(Math.max(-1, Math.min(1, base[1])));
        d = coneDir(by, bp, pelletSpread, this.rng);
      }
      const res = this.trace(c, ox, oy, oz, d[0], d[1], d[2], def.range);
      ends.push(res);
      if (res.victim) {
        anyHit = true;
        const dmg = damageAt(def, res.t) * def.mult[res.zone];
        const prev = hitsByVictim.get(res.victim);
        if (prev) { prev.dmg += dmg; if (res.zone === 'head') prev.zone = 'head'; } else hitsByVictim.set(res.victim, { dmg, zone: res.zone, t: res.t });
      }
    }
    if (anyHit) c.stats.hits++;
    this.emit({ type: 'shot', c, weapon: def.id, ox, oy, oz, ends, tracer: pellets > 1 || (c.stats.shots % def.tracerEvery === 0) });
    for (const [victim, h] of hitsByVictim) {
      this.applyDamage(victim, c, h.dmg, { weapon: def.id, zone: h.zone, kind: 'bullet', fromX: c.x, fromZ: c.z, dist: h.t });
    }
    this.noise(c.x, c.z, def.class === 'sniper' || def.class === 'shotgun' ? 60 : 48, c);
  }

  /** Trace a bullet: nearest of world geometry and combatant hitboxes. */
  trace(shooter, ox, oy, oz, dx, dy, dz, range) {
    const wh = this.world.raycast(ox, oy, oz, dx, dy, dz, range, 'bullet');
    let maxT = wh ? wh.t : range;
    let victim = null, zone = null;
    for (const o of this.combatants) {
      if (o === shooter || !o.alive) continue;
      // cheap reject
      const lx = o.x - ox, lz = o.z - oz;
      const along = lx * dx + lz * dz;
      if (along < -1 || along > maxT + 1) continue;
      const hit = o.rayHit(ox, oy, oz, dx, dy, dz, maxT);
      if (hit && hit.t < maxT) { maxT = hit.t; victim = o; zone = hit.zone; }
    }
    return {
      t: maxT, victim, zone,
      x: ox + dx * maxT, y: oy + dy * maxT, z: oz + dz * maxT,
      world: !victim && wh ? { nx: wh.nx, ny: wh.ny, nz: wh.nz, mat: wh.box.mat } : null,
    };
  }

  doMelee(c) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    let best = null, bd = Infinity;
    for (const o of this.combatants) {
      if (o === c || !o.alive) continue;
      const dx = o.x - c.x, dz = o.z - c.z, dy = o.y - c.y;
      const d = Math.hypot(dx, dz);
      if (d > MELEE.range + 0.3 || Math.abs(dy) > 1.2) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
      if (ang > MELEE.arcDeg * DEG && d > 0.6) continue;
      if (!this.canSee(c.x, c.eyeY, c.z, o.x, o.y + 1.1, o.z)) continue;
      if (d < bd) { bd = d; best = o; }
    }
    this.emit({ type: 'melee', c, hit: !!best });
    if (best) this.applyDamage(best, c, MELEE.damage, { weapon: 'melee', zone: 'torso', kind: 'melee', fromX: c.x, fromZ: c.z });
  }

  throwEquipment(c, kind) { this.projectiles.throw(c, kind); }

  onFell(c) { this.applyDamage(c, null, 999, { weapon: 'fall', kind: 'fall' }); }

  /** Sight test that respects geometry and smoke. */
  canSee(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-3) return true;
    const hit = this.world.raycast(ax, ay, az, dx / L, dy / L, dz / L, L, 'sight');
    if (hit) return false;
    return !this.projectiles.smokeBlocks(ax, ay, az, bx, by, bz);
  }

  /** Gunfire / explosions alert nearby bots. */
  noise(x, z, radius, source) {
    for (const c of this.combatants) {
      if (!c.brain || !c.alive || c === source) continue;
      if (source && c.team === source.team) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < radius) c.brain.hear(source, x, z, d / radius);
    }
    this.emit({ type: 'noise', x, z, source });
  }

  applyDamage(victim, attacker, amount, info) {
    if (!victim.alive || this.state !== 'live') return;
    if (victim.spawnProtectT > 0 && info.kind !== 'fall') return;
    if (attacker && attacker !== victim && attacker.team === victim.team && !this.settings.friendlyFire) return;
    amount = Math.max(1, Math.round(amount));
    victim.health -= amount;
    victim.lastDamageT = this.time;
    victim.flinch = Math.min(1, victim.flinch + amount / 60);
    if (attacker && attacker !== victim) {
      const log = victim.damageLog.get(attacker.id) || { amount: 0, t: 0, c: attacker };
      log.amount += amount; log.t = this.time;
      victim.damageLog.set(attacker.id, log);
      attacker.stats.damage += amount;
    }
    const kill = victim.health <= 0;
    this.emit({ type: 'damage', victim, attacker, amount, zone: info.zone, kill, kind: info.kind, fromX: info.fromX, fromZ: info.fromZ, weapon: info.weapon });
    if (victim.brain && attacker) victim.brain.onDamaged(attacker, info);
    if (kill) this.kill(victim, attacker, info);
  }

  kill(victim, attacker, info) {
    const victimStreak = victim.stats.streak;
    victim.alive = false;
    victim.health = 0;
    victim.stats.deaths++;
    victim.stats.streak = 0;
    victim.respawnT = this.mode.respawnDelay;
    victim.deathT = this.time;
    victim.adsT = 0;
    victim.lastKiller = attacker;
    victim.sprinting = false;
    this.recentDeaths.push({ x: victim.x, z: victim.z, t: this.time, team: victim.team });
    const medals = [];
    const enemyKill = attacker && attacker !== victim && attacker.team !== victim.team;
    if (enemyKill) {
      const st = attacker.stats;
      st.kills++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
      let score = 100;
      if (info.zone === 'head' && info.kind === 'bullet') { st.headshots++; medals.push({ id: 'headshot', name: 'Headshot', xp: 25 }); }
      if (!this.firstBlood) { this.firstBlood = true; medals.push({ id: 'first', name: 'First Blood', xp: 50 }); }
      const now = this.time;
      attacker._killTimes = (attacker._killTimes || []).filter((t) => now - t < 4.5);
      attacker._killTimes.push(now);
      const multi = attacker._killTimes.length;
      if (multi === 2) medals.push({ id: 'double', name: 'Double Kill', xp: 50 });
      else if (multi === 3) medals.push({ id: 'triple', name: 'Triple Kill', xp: 75 });
      else if (multi >= 4) medals.push({ id: 'fury', name: 'Fury Kill', xp: 100 });
      if (attacker.lastKiller === victim) { medals.push({ id: 'revenge', name: 'Revenge', xp: 50 }); attacker.lastKiller = null; }
      if (info.dist && info.dist > 40) medals.push({ id: 'longshot', name: 'Longshot', xp: 50 });
      if (info.kind === 'melee') medals.push({ id: 'melee', name: 'Close Quarters', xp: 25 });
      if (info.kind === 'explosive') medals.push({ id: 'frag', name: 'Grenade Kill', xp: 25 });
      if (victimStreak >= 3) medals.push({ id: 'buzzkill', name: 'Buzzkill', xp: 50 });
      if ([5, 10, 15, 20].includes(st.streak)) medals.push({ id: 'streak' + st.streak, name: `${st.streak} Kill Streak`, xp: 100 });
      for (const m of medals) score += m.xp;
      st.score += score;
      attacker._lastScore = score;
    }
    // assists
    const assisters = [];
    for (const [, log] of victim.damageLog) {
      if (log.c === attacker || log.c.team === victim.team) continue;
      if (this.time - log.t > 10) continue;
      log.c.stats.assists++;
      log.c.stats.score += 25;
      assisters.push(log.c);
    }
    victim.damageLog.clear();
    this.emit({ type: 'kill', killer: attacker, victim, weapon: info.weapon, headshot: info.zone === 'head' && info.kind === 'bullet', kind: info.kind, medals, assisters, score: attacker?._lastScore || 0, dist: info.dist || 0 });
    if (victim.brain) victim.brain.onDeath();
    this.mode.onKill(this, attacker, victim, info);
  }

  /** Sorted scoreboard rows per team. */
  /** Sorted rows: [team0, team1] for team modes, [everyone] for free-for-all modes. */
  scoreboard() {
    const rows = this.combatants.map((c) => ({ c, ...c.stats, level: c.gunLevel || 0 }));
    if (!this.mode.teams) {
      rows.sort((a, b) => (b.level - a.level) || b.kills - a.kills || b.score - a.score);
      return [rows];
    }
    rows.sort((a, b) => b.score - a.score || b.kills - a.kills);
    return [rows.filter((r) => r.c.team === 0), rows.filter((r) => r.c.team === 1)];
  }
}

function randomBotLoadout(rng) {
  const roll = rng();
  const primary = roll < 0.42 ? 'ar_kv7' : roll < 0.72 ? 'smg_vesper' : roll < 0.86 ? 'sg_brakk' : 'sr_longreach';
  return { primary, secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' };
}

/** Random direction inside a cone around yaw/pitch (uniform on disk). */
export function coneDir(yaw, pitch, half, rng) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fx = -Math.sin(yaw) * cp, fy = sp, fz = -Math.cos(yaw) * cp;
  if (half <= 0) return [fx, fy, fz];
  // basis
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // right
  const ux = Math.sin(yaw) * sp, uy = cp, uz = Math.cos(yaw) * sp; // up
  const r = Math.sqrt(rng()) * Math.tan(half);
  const a = rng() * Math.PI * 2;
  const ox = Math.cos(a) * r, oy = Math.sin(a) * r;
  let dx = fx + rx * ox + ux * oy, dy = fy + uy * oy, dz = fz + rz * ox + uz * oy;
  const l = Math.hypot(dx, dy, dz);
  return [dx / l, dy / l, dz / l];
}

export { PRIMARY_IDS };
