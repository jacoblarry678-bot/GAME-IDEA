/**
 * Game modes. Each mode supplies defaults and rule hooks used by Match:
 *   setup(match)               initialise objective/round state
 *   update(match, dt)          per-tick objective logic
 *   onKill(match, killer, victim, info)
 *   onTimeUp(match)
 *   canRespawn(match, c)       false = wait for the next round
 *   spawnScore(match, c, sp)   extra spawn preference
 *   botGoal(match, bot)        objective destination for bots ({ x, z, name, hold })
 *   loadoutFor(match, c)       forced loadout (Gun Game, Battle Royale)
 *   spawnAt(match, c, initial) custom spawn point (Battle Royale drop-in)
 *   botUrgent(match, bot)      goal that overrides roaming (BR: run for the zone)
 *   goalStale(match, bot, name) true when a bot's objective goal is gone
 * Only modes whose rules are implemented here are offered as playable.
 */
import { WEAPONS, GUN_LADDER } from '../data/weapons.js';
import { BATTLE_ROYALE } from './battleRoyale.js';

export const TEAMS = [
  { id: 0, name: 'WARDEN', full: 'Warden Security Directorate' },
  { id: 1, name: 'SABLE', full: 'Sable Front' },
];

const inZone = (c, z) => (z.r ? Math.hypot(c.x - z.x, c.z - z.z) <= z.r : Math.abs(c.x - z.x) <= z.w / 2 && Math.abs(c.z - z.z) <= z.d / 2) && Math.abs(c.y - (z.y || 0)) < 3;

/** Count living players per team inside a zone. */
function presence(match, zone) {
  const n = [0, 0];
  for (const c of match.combatants) if (c.alive && c.team < 2 && inZone(c, zone)) n[c.team]++;
  return n;
}

function teamWinCheck(match) {
  const lim = match.settings.scoreLimit;
  for (const t of [0, 1]) if (match.teamScores[t] >= lim) { match.end(t, 'score'); return true; }
  return false;
}

function timeUpTeams(match) {
  const [a, b] = match.teamScores;
  match.end(a === b ? -1 : a > b ? 0 : 1, 'time');
}

function timeUpFfa(match) {
  let best = -1, bestScore = -1, tie = false;
  match.teamScores.forEach((s, t) => { if (s > bestScore) { bestScore = s; best = t; tie = false; } else if (s === bestScore) tie = true; });
  match.end(tie ? -1 : best, 'time');
}

const randIn = (z, k = 0.7) => z.r
  ? { x: z.x + (Math.random() - 0.5) * z.r * k * 1.4, z: z.z + (Math.random() - 0.5) * z.r * k * 1.4 }
  : { x: z.x + (Math.random() - 0.5) * z.w * k, z: z.z + (Math.random() - 0.5) * z.d * k };

export const MODES = {
  tdm: {
    id: 'tdm', name: 'Team Deathmatch', short: 'TDM', teams: true, playable: true, scoreLabel: 'kills',
    blurb: 'Two teams. First to the score limit, or the highest score when time runs out, wins.',
    defaults: { scoreLimit: 75, timeLimit: 10 },
    limits: { scoreLimit: [10, 200, 5], timeLimit: [3, 30, 1] },
    respawnDelay: 3.2,
    onKill(match, killer, victim) {
      if (!killer || killer === victim || killer.team === victim.team) return;
      match.teamScores[killer.team] += 1;
      teamWinCheck(match);
    },
    onTimeUp: timeUpTeams,
  },

  ffa: {
    id: 'ffa', name: 'Free-for-All', short: 'FFA', teams: false, playable: true, scoreLabel: 'kills',
    blurb: 'Everyone for themselves. First to the elimination limit wins.',
    defaults: { scoreLimit: 30, timeLimit: 10 },
    limits: { scoreLimit: [5, 60, 5], timeLimit: [3, 30, 1] },
    respawnDelay: 2.5,
    onKill(match, killer, victim) {
      if (!killer || killer === victim) return;
      match.teamScores[killer.team] += 1;
      if (match.teamScores[killer.team] >= match.settings.scoreLimit) match.end(killer.team, 'score');
    },
    onTimeUp: timeUpFfa,
    spawnScore() { return 0; },
  },

  dom: {
    id: 'dom', name: 'Domination', short: 'DOM', teams: true, playable: true, scoreLabel: 'points', objective: 'dom',
    blurb: 'Capture and hold three flags. Each flag held scores a point every two seconds.',
    defaults: { scoreLimit: 150, timeLimit: 10 },
    limits: { scoreLimit: [50, 300, 25], timeLimit: [3, 30, 1] },
    respawnDelay: 3.2,
    setup(match) {
      match.flags = (match.map.def.objectives?.dom || []).map((f) => ({ ...f, owner: -1, progress: 0, contested: false, capturing: -1 }));
      match.domT = 0;
    },
    update(match, dt) {
      for (const f of match.flags) {
        const n = presence(match, f);
        f.contested = n[0] > 0 && n[1] > 0;
        f.capturing = -1;
        if (f.contested || (n[0] === 0 && n[1] === 0)) continue;
        const t = n[0] > 0 ? 0 : 1;
        if (f.owner === t && f.progress === (t === 0 ? 1 : -1)) continue;
        const dir = t === 0 ? 1 : -1;
        const rate = (1 / 8) * (1 + Math.min(2, n[t] - 1) * 0.5); // 8 s alone, faster with help
        f.capturing = t;
        const before = f.progress;
        f.progress = Math.max(-1, Math.min(1, f.progress + dir * rate * dt));
        // crossing neutral: the old owner loses the flag
        if (f.owner !== -1 && f.owner !== t && Math.sign(f.progress) !== Math.sign(before) && before !== 0) {
          match.emit({ type: 'objective', kind: 'flagLost', flag: f.id, team: f.owner });
          f.owner = -1;
        }
        if (Math.abs(f.progress) >= 1 && f.owner !== t) {
          f.owner = t;
          for (const c of match.combatants) if (c.alive && c.team === t && inZone(c, f)) { c.stats.score += 150; c.stats.captures = (c.stats.captures || 0) + 1; match.emit({ type: 'objective', kind: 'capture', flag: f.id, team: t, c }); }
          match.emit({ type: 'objective', kind: 'flagCaptured', flag: f.id, team: t });
        }
      }
      match.domT += dt;
      if (match.domT >= 2) {
        match.domT -= 2;
        for (const f of match.flags) if (f.owner >= 0) match.teamScores[f.owner] += 1;
        teamWinCheck(match);
      }
    },
    onKill(match, killer, victim) {
      if (!killer || killer === victim || killer.team === victim.team) return;
      // defend bonus: kill near a flag your team owns
      for (const f of match.flags) if (f.owner === killer.team && Math.hypot(victim.x - f.x, victim.z - f.z) < f.r + 6) { killer.stats.score += 50; match.emit({ type: 'objective', kind: 'defend', c: killer, flag: f.id }); break; }
    },
    onTimeUp: timeUpTeams,
    spawnScore(match, c, sp) {
      let s = 0;
      for (const f of match.flags) {
        const d = Math.hypot(sp.x - f.x, sp.z - f.z);
        if (f.owner === c.team && d < 30) s += 60;
        if (f.owner !== -1 && f.owner !== c.team && d < 18) s -= 200;
      }
      return s;
    },
    botGoal(match, bot) {
      const c = bot.c;
      let best = null, bs = -Infinity;
      for (const f of match.flags) {
        const d = Math.hypot(c.x - f.x, c.z - f.z);
        let s = -d * 0.6 + Math.random() * 12;
        if (f.owner !== c.team) s += 30;
        if (f.owner === c.team && f.contested) s += 45; // help defend
        if (f.owner === c.team && !f.contested) s -= 25;
        // avoid the whole team stacking one flag
        const mates = match.combatants.filter((o) => o.brain && o !== c && o.team === c.team && o.brain.goalName === 'flag ' + f.id).length;
        s -= mates * 12;
        if (s > bs) { bs = s; best = f; }
      }
      if (!best) return null;
      const p = randIn(best, 0.6);
      return { ...p, name: 'flag ' + best.id, hold: best.owner === c.team ? 4 : 10, zone: best };
    },
    holding(match, c) { return match.flags.some((f) => inZone(c, f) && (f.owner !== c.team || f.contested)); },
    zoneOf(match, c) { return match.flags.find((f) => inZone(c, f)); },
  },

  hp: {
    id: 'hp', name: 'Hardpoint', short: 'HP', teams: true, playable: true, scoreLabel: 'points', objective: 'hp',
    blurb: 'Hold the active zone to score a point per second. The zone moves every minute.',
    defaults: { scoreLimit: 150, timeLimit: 10 },
    limits: { scoreLimit: [50, 300, 25], timeLimit: [3, 30, 1] },
    respawnDelay: 3.2,
    zoneTime: 60,
    setup(match) {
      match.zones = match.map.def.objectives?.hp || [];
      match.hp = { idx: 0, t: this.zoneTime, owner: -1, contested: false, acc: 0 };
      match.emit({ type: 'objective', kind: 'zoneMoved', idx: 0 });
    },
    update(match, dt) {
      const h = match.hp;
      if (!match.zones.length) return;
      h.t -= dt;
      if (h.t <= 0) {
        h.idx = (h.idx + 1) % match.zones.length;
        h.t = this.zoneTime; h.owner = -1;
        match.emit({ type: 'objective', kind: 'zoneMoved', idx: h.idx });
      }
      const n = presence(match, match.zones[h.idx]);
      h.contested = n[0] > 0 && n[1] > 0;
      const prev = h.owner;
      h.owner = h.contested ? -1 : n[0] > 0 ? 0 : n[1] > 0 ? 1 : -1;
      if (h.owner !== prev && h.owner >= 0) match.emit({ type: 'objective', kind: 'zoneHeld', team: h.owner });
      h.acc += dt;
      while (h.acc >= 1) {
        h.acc -= 1;
        if (h.owner >= 0) {
          match.teamScores[h.owner] += 1;
          for (const c of match.combatants) if (c.alive && c.team === h.owner && inZone(c, match.zones[h.idx])) { c.stats.score += 10; c.stats.objTime = (c.stats.objTime || 0) + 1; }
        }
      }
      teamWinCheck(match);
    },
    onKill() {},
    onTimeUp: timeUpTeams,
    spawnScore(match, c, sp) {
      const z = match.zones[match.hp.idx];
      if (!z) return 0;
      const d = Math.hypot(sp.x - z.x, sp.z - z.z);
      return d < 14 ? -150 : d < 40 ? 40 : 0;
    },
    botGoal(match, bot) {
      const z = match.zones[match.hp.idx];
      if (!z) return null;
      if (Math.random() < 0.15) return null; // some bots roam to intercept
      const p = randIn(z, 0.6);
      return { ...p, name: 'hp ' + match.hp.idx, hold: 8, zone: z };
    },
    holding(match, c) { const z = match.zones[match.hp.idx]; return !!z && inZone(c, z); },
    zoneOf(match, c) { const z = match.zones[match.hp.idx]; return z && inZone(c, z) ? z : null; },
  },

  elim: {
    id: 'elim', name: 'Elimination', short: 'ELIM', teams: true, playable: true, scoreLabel: 'rounds', rounds: true,
    blurb: 'Rounds with no respawns. Eliminate the other team, or have more players alive when the round clock ends.',
    defaults: { scoreLimit: 4, timeLimit: 2 },
    limits: { scoreLimit: [2, 8, 1], timeLimit: [1, 4, 0.5] },
    respawnDelay: 9999,
    setup(match) {
      match.round = { n: 1, phase: 'live', t: 0, lastWinner: null };
      match.roundTime = match.settings.timeLimit * 60;
    },
    update(match, dt) {
      const r = match.round;
      if (r.phase === 'post') {
        r.t -= dt;
        if (r.t <= 0) {
          r.n++;
          r.phase = 'live';
          match.timeLeft = match.roundTime;
          match._spawnUse = new Map();
          match.projectiles.list.length = 0; match.projectiles.smokes.length = 0;
          for (const c of match.combatants) match.respawn(c, true);
          match.state = 'countdown';
          match.countdown = 3;
          match.emit({ type: 'roundStart', n: r.n });
        }
      }
    },
    onKill(match, killer, victim) {
      if (match.round.phase !== 'live') return;
      const alive = [0, 1].map((t) => match.combatants.filter((c) => c.team === t && c.alive).length);
      if (alive[victim.team] === 0) endRound(match, 1 - victim.team, 'elimination');
    },
    onTimeUp(match) {
      if (match.round.phase !== 'live') return;
      const alive = [0, 1].map((t) => match.combatants.filter((c) => c.team === t && c.alive).length);
      endRound(match, alive[0] === alive[1] ? -1 : alive[0] > alive[1] ? 0 : 1, 'time');
      match.timeLeft = 0.001;
    },
    canRespawn() { return false; },
  },

  gun: {
    id: 'gun', name: 'Gun Game', short: 'GUN', teams: false, playable: true, scoreLabel: 'level',
    blurb: 'Free-for-all. Every elimination moves you to the next weapon; a melee kill sets the victim back. Finish the ladder to win.',
    defaults: { scoreLimit: 0, timeLimit: 10 },
    limits: { timeLimit: [3, 20, 1] },
    respawnDelay: 2,
    ladder: GUN_LADDER,
    setup(match) {
      match.ladder = (match.map.def.gunLadder || this.ladder).filter((id) => id === 'melee' || WEAPONS[id]);
      for (const c of match.combatants) { c.gunLevel = 0; c.applyLoadout(this.loadoutFor(match, c)); }
    },
    loadoutFor(match, c) {
      const id = match.ladder[Math.min(c.gunLevel || 0, match.ladder.length - 1)];
      const sec = WEAPONS.melee_axe ? 'melee_axe' : 'pistol_warden';
      const w = id === 'melee' ? sec : id;
      return { primary: w, secondary: sec, lethal: c.loadout.lethal, tactical: c.loadout.tactical, noEquipment: true };
    },
    onKill(match, killer, victim, info) {
      if (!killer || killer === victim) return;
      if (info.kind === 'melee' && match.ladder[killer.gunLevel] !== 'melee') {
        if (victim.gunLevel > 0) { victim.gunLevel--; match.emit({ type: 'objective', kind: 'setBack', c: victim, by: killer }); }
        return;
      }
      killer.gunLevel++;
      match.teamScores[killer.team] = killer.gunLevel;
      if (killer.gunLevel >= match.ladder.length) { match.end(killer.team, 'score'); return; }
      const lo = this.loadoutFor(match, killer);
      killer.applyLoadout(lo);
      for (const w of killer.weapons) w.refill();
      killer.lethal.count = 0; killer.tactical.count = 0;
      killer.swapT = 0; killer.cur = 0; killer.adsT = 0;
      match.emit({ type: 'objective', kind: 'gunUp', c: killer, level: killer.gunLevel, weapon: lo.primary });
    },
    onTimeUp: timeUpFfa,
    spawnScore() { return 0; },
  },

  br: BATTLE_ROYALE,

  range: {
    id: 'range', name: 'Firing Range', short: 'RANGE', teams: true, range: true, playable: false,
    blurb: 'Training targets at marked distances. No score, no time limit.',
    defaults: { scoreLimit: 9999, timeLimit: 999 },
    respawnDelay: 1.2,
    onKill() {},
    onTimeUp() {},
  },
};

function endRound(match, winner, reason) {
  const r = match.round;
  r.phase = 'post';
  r.t = 4.5;
  r.lastWinner = winner;
  if (winner >= 0) match.teamScores[winner] += 1;
  match.emit({ type: 'roundEnd', winner, reason, n: r.n, scores: [...match.teamScores] });
  if (winner >= 0 && match.teamScores[winner] >= match.settings.scoreLimit) match.end(winner, 'score');
}

export const PLAYABLE_MODES = Object.values(MODES).filter((m) => m.playable);

/** Modes on the roadmap (shown as unavailable, never as playable). */
export const ROADMAP_MODES = [
  { id: 'surv', name: 'Survival (co-op)' },
];

export const DIFFICULTIES = {
  recruit: { id: 'recruit', name: 'Recruit', hold: [3, 8], reaction: 0.85, turn: 3.0, aimErr: 8.0, aimErrMin: 3.4, settle: 1.6, fovDeg: 100, hs: 0.04, nade: 0.06, strafe: 0.4, burst: 0.5, fireAngle: 2.6 },
  regular: { id: 'regular', name: 'Regular', hold: [2.5, 7], reaction: 0.55, turn: 4.6, aimErr: 5.6, aimErrMin: 2.3, settle: 1.1, fovDeg: 110, hs: 0.1, nade: 0.12, strafe: 0.65, burst: 0.7, fireAngle: 2.0 },
  hardened: { id: 'hardened', name: 'Hardened', hold: [2, 6], reaction: 0.36, turn: 6.5, aimErr: 4.0, aimErrMin: 1.4, settle: 0.8, fovDeg: 120, hs: 0.18, nade: 0.2, strafe: 0.85, burst: 0.85, fireAngle: 1.6 },
  veteran: { id: 'veteran', name: 'Veteran', hold: [1.5, 5], reaction: 0.22, turn: 9.0, aimErr: 2.8, aimErrMin: 0.8, settle: 0.55, fovDeg: 130, hs: 0.28, nade: 0.3, strafe: 1.0, burst: 1.0, fireAngle: 1.3 },
};

export { inZone };
