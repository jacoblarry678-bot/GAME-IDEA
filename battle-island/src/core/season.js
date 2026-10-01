/**
 * Seasons & Style: 8-week seasons, the free Benton Pass (20 tiers earned with
 * XP), weekly challenges, permanent achievements, and the cosmetics they
 * unlock (emotes, gliders, pass outfits). Everything is saved on this device.
 *
 * At a new season: pass progress starts over (unlocked cosmetics are kept),
 * each ranked mode records its peak and soft-resets two tiers down.
 */

import { save, levelInfo } from './save.js';
import { today } from './supercharge.js';
import { superXP, CAP_XP } from './supercharge.js';
import { rankState, divName, divisionMMR } from './ranked.js';
import { CHALLENGES } from './challenges.js';
import { mulberry32 } from '../gameplay/items.js';
import { badgeCount } from './badges.js';
import { LOCKER, DEFAULTS } from './cosmetics.js';

// ------------------------------------------------------------ cosmetics
export const EMOTES = {
  sig: { name: 'Signature move', desc: "Your character's own dance" },
  wave: { name: 'Big Wave', desc: 'A huge two-handed hello' },
  hop: { name: 'Pickle Hop', desc: 'Bouncy side-to-side hops' },
  robo: { name: 'Robo Shuffle', desc: "Stiff robot steps, Crankbolt style" },
  guitar: { name: 'Air Guitar', desc: 'Shred the biggest solo on the island' },
  lap: { name: 'Victory Lap', desc: 'Arms up, running on the spot' },
};

export const GLIDERS = {
  classic: { name: 'Outfit Stripes', colors: null },
  pickle: { name: 'Pickle Parachute', colors: ['#5bbf3a', '#3f9a2a'], pattern: 'dots' },
  storm: { name: 'Storm Sail', colors: ['#6a3fd0', '#39f0ff'], pattern: 'bolt' },
  night: { name: 'Night Sky', colors: ['#1d2a5a', '#ffe45c'], pattern: 'stars' },
  crankbolt: { name: 'Crankbolt Canopy', colors: ['#ff8a3d', '#4a5566'], pattern: 'stripes' },
  golden: { name: 'Golden Wing', colors: ['#ffcf3f', '#ffae1a'], pattern: 'stripes' },
  champion: { name: 'Champion Rainbow', colors: ['#ff5c7a', '#ffcf3f', '#7ed957', '#39f0ff', '#b35cff'], pattern: 'rainbow' },
  treasure: { name: 'Treasure Map', colors: ['#e8d3a0', '#b0472f'], pattern: 'map', badges: 6 },
  medal: { name: 'Badge Collector', colors: ['#1d2a5a', '#ffcf3f'], pattern: 'medals', badges: 12 },
};

// ------------------------------------------------------------ seasons
const DAY = 86400000;
const SEASON_EPOCH = Date.UTC(2026, 8, 1); // Season 1 starts 1 Sept 2026
const SEASON_DAYS = 56;
export const SEASON_NAMES = ['Crankbolt Rising', 'Haunted Harvest', 'Frost Fort', 'Pickle Parade'];

export function seasonAt(now = Date.now()) {
  const n = Math.max(0, Math.floor((now - SEASON_EPOCH) / (SEASON_DAYS * DAY)));
  const start = SEASON_EPOCH + n * SEASON_DAYS * DAY;
  return { n: n + 1, name: SEASON_NAMES[n % SEASON_NAMES.length], start, end: start + SEASON_DAYS * DAY };
}

export function daysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((seasonAt(now).end - now) / DAY));
}

// ------------------------------------------------------------ the Benton Pass
export const TIER_XP = 2000;
export const TIERS = 20;
/** Reward per tier (1-based). kind: emote | glider | outfit | super */
export const PASS = [
  null,
  { kind: 'glider', id: 'pickle' }, { kind: 'emote', id: 'wave' }, { kind: 'super' }, { kind: 'emote', id: 'hop' },
  { kind: 'glider', id: 'storm' }, { kind: 'super' }, { kind: 'emote', id: 'robo' }, { kind: 'glider', id: 'night' },
  { kind: 'super' }, { kind: 'outfit', id: 'colton:3' }, { kind: 'emote', id: 'guitar' }, { kind: 'glider', id: 'crankbolt' },
  { kind: 'super' }, { kind: 'outfit', id: 'emerson:3' }, { kind: 'emote', id: 'lap' }, { kind: 'super' },
  { kind: 'outfit', id: 'waylon:3' }, { kind: 'glider', id: 'golden' }, { kind: 'super' }, { kind: 'glider', id: 'champion' },
];

export function rewardName(r, CHARACTERS) {
  if (!r) return '';
  if (r.kind === 'emote') return `${EMOTES[r.id].name} emote`;
  if (r.kind === 'glider') return `${GLIDERS[r.id].name} glider`;
  if (r.kind === 'super') return `+${(CAP_XP / 3).toLocaleString()} Supercharged XP`;
  const [c, i] = r.id.split(':');
  return `${CHARACTERS[c].outfits[+i].name} outfit (${CHARACTERS[c].name})`;
}

export function pass() {
  seasonCheck();
  return save.data.pass;
}

export function passTier(p = pass()) {
  return Math.min(TIERS, Math.floor(p.xp / TIER_XP));
}

/** Cosmetics this device owns. */
export function owned() {
  const p = pass();
  // gliders earned by finding Benton Badges
  const n = badgeCount();
  const byBadges = Object.entries(GLIDERS).filter(([, g]) => g.badges && n >= g.badges).map(([id]) => `glider:${id}`);
  const set = new Set(['emote:sig', 'glider:classic', ...p.owned, ...byBadges]);
  // pickaxes, back blings and wraps unlock by level, achievement or badges
  const level = levelInfo(save.data.progress.xp).level;
  for (const [kind, list] of Object.entries(LOCKER)) {
    for (const [id, c] of Object.entries(list)) {
      const u = c.unlock;
      if (!u || (u.level && level >= u.level) || (u.badges && n >= u.badges) || (u.ach && achDone(u.ach))) set.add(`${kind}:${id}`);
    }
  }
  return set;
}

export function owns(kind, id) {
  return owned().has(`${kind}:${id}`);
}

/** Adds pass XP; returns the rewards for any tiers reached. */
export function addPassXP(xp) {
  const p = pass();
  const before = passTier(p);
  p.xp += Math.max(0, xp | 0);
  const after = passTier(p);
  const got = [];
  for (let t = before + 1; t <= after; t++) {
    const r = PASS[t];
    if (!r) continue;
    if (r.kind === 'super') superXP().pool = Math.min(CAP_XP, superXP().pool + CAP_XP / 3);
    else if (!p.owned.includes(`${r.kind}:${r.id}`)) p.owned.push(`${r.kind}:${r.id}`);
    got.push({ tier: t, ...r });
  }
  save.write();
  return { before, after, got };
}

// ------------------------------------------------------------ season rollover
/** Starts a new season if the date moved on: records peaks, soft-resets ranks, restarts the pass. */
export function seasonCheck(now = Date.now()) {
  const s = seasonAt(now);
  const d = save.data;
  if (!d.pass || typeof d.pass.xp !== 'number') d.pass = { season: s.n, xp: 0, owned: [], equipped: {} };
  if (!Array.isArray(d.pass.owned)) d.pass.owned = [];
  if (!d.pass.equipped) d.pass.equipped = {};
  if (!Array.isArray(d.seasons)) d.seasons = [];
  if (d.pass.season === s.n) return null;
  const ended = d.pass.season;
  const record = { season: ended, pass: passTier(d.pass), ranks: {} };
  for (const mode of ['build', 'zerobuild']) {
    const r = rankState(mode);
    record.ranks[mode] = r.peak;
    if (r.d >= 0) {
      // soft reset: two tiers (six divisions) down, MMR eased toward the middle
      r.d = Math.max(0, r.d - 6);
      r.rp = 0;
      r.mmr = Math.round(r.mmr * 0.75 + divisionMMR(r.d) * 0.25);
      r.peak = r.d;
    }
  }
  d.seasons.unshift(record);
  d.seasons.length = Math.min(d.seasons.length, 8);
  d.pass.season = s.n;
  d.pass.xp = 0;
  save.write();
  return record;
}

// ------------------------------------------------------------ weekly challenges
export const WEEKLY_XP = 3000;
const WEEKLY = [
  ['elims', 15, 'Eliminate 15 opponents'], ['chests', 20, 'Open 20 chests'], ['drive', 2000, 'Drive 2 km in vehicles'],
  ['boss', 1500, 'Deal 1,500 damage to Crankbolt'], ['top10', 5, 'Finish in the top 10 five times'], ['play', 10, 'Play 10 matches'],
  ['bucks', 600, 'Spend 600 Benton Bucks'], ['doors', 25, 'Open 25 doors'], ['upgrade', 3, 'Upgrade 3 weapons'], ['zip', 6, 'Ride ziplines 6 times'],
  ['damage', 3000, 'Deal 3,000 damage to opponents'], ['vault', 1, "Open Crankbolt's Vault"],
];

export const weekOf = (now = Date.now()) => Math.floor((today(now) + 3) / 7);

export function weeklyChallenges(now = Date.now()) {
  const w = weekOf(now);
  let c = save.data.weekly;
  if (!c || c.week !== w || !Array.isArray(c.list)) {
    const rng = mulberry32(w * 104729 + 7);
    const pool = WEEKLY.map((x) => x[0]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    c = save.data.weekly = { week: w, list: pool.slice(0, 5).map((id) => ({ id, prog: 0, done: false })) };
    save.write();
  }
  return c;
}

export function weeklyDef(id) {
  const w = WEEKLY.find((x) => x[0] === id);
  return { id, goal: w[1], text: w[2], stat: CHALLENGES[id].stat };
}

export function applyWeekly(ms, r) {
  const c = weeklyChallenges();
  let xp = 0;
  const rows = c.list.map((ch) => {
    const def = weeklyDef(ch.id);
    if (!ch.done) ch.prog = Math.min(def.goal, ch.prog + Math.max(0, Math.round(def.stat(ms || {}, r) || 0)));
    const justDone = !ch.done && ch.prog >= def.goal;
    if (justDone) {
      ch.done = true;
      xp += WEEKLY_XP;
    }
    return { id: ch.id, text: def.text, goal: def.goal, prog: ch.prog, done: ch.done, justDone };
  });
  save.write();
  return { rows, xp };
}

// ------------------------------------------------------------ achievements
export const ACH_XP = 1000;
/** total: which running total it tracks; goal: how much. */
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Benton Champion', desc: 'Win a match', total: 'wins', goal: 1 },
  { id: 'wins10', name: 'Serial Winner', desc: 'Win 10 matches', total: 'wins', goal: 10 },
  { id: 'squad_win', name: 'Squad Goals', desc: 'Win in Duos, Trios or Squads', total: 'squadWins', goal: 1 },
  { id: 'elims50', name: 'Sharpshooter', desc: 'Eliminate 50 opponents', total: 'kills', goal: 50 },
  { id: 'boss1', name: 'Bolt Breaker', desc: 'Take down Crankbolt', total: 'bosses', goal: 1 },
  { id: 'vault1', name: 'Safecracker', desc: "Open Crankbolt's Vault", total: 'vault', goal: 1 },
  { id: 'drive5k', name: 'Road Tripper', desc: 'Drive 5 km in vehicles', total: 'driven', goal: 5000 },
  { id: 'zip20', name: 'Zip Zapper', desc: 'Ride ziplines 20 times', total: 'zips', goal: 20 },
  { id: 'chests100', name: 'Treasure Hunter', desc: 'Open 100 chests', total: 'chests', goal: 100 },
  { id: 'bucks2k', name: 'Big Spender', desc: 'Spend 2,000 Benton Bucks', total: 'spent', goal: 2000 },
  { id: 'upgrade10', name: 'Tinkerer', desc: 'Upgrade 10 weapons', total: 'upgrades', goal: 10 },
  { id: 'runover10', name: 'Road Hazard', desc: 'Hit 10 opponents with vehicles', total: 'runovers', goal: 10 },
  { id: 'doors100', name: 'Knock Knock', desc: 'Open 100 doors', total: 'doors', goal: 100 },
  { id: 'carry100', name: 'Good Teammate', desc: 'Carry knocked teammates 100 m', total: 'carried', goal: 100 },
  { id: 'quest1', name: 'Helping Hand', desc: 'Complete a story quest', total: 'quests', goal: 1 },
  { id: 'quest15', name: 'Island Hero', desc: 'Complete 15 story quests', total: 'quests', goal: 15 },
  { id: 'gold', name: 'Going for Gold', desc: 'Reach Gold in either ranked mode', total: 'rankPeak', goal: 6 },
  { id: 'level20', name: 'Veteran', desc: 'Reach level 20', total: 'level', goal: 20 },
];

function achState() {
  const d = save.data;
  if (!d.ach || typeof d.ach !== 'object') d.ach = { totals: {}, done: {} };
  d.ach.totals = d.ach.totals || {};
  d.ach.done = d.ach.done || {};
  return d.ach;
}

export function achProgress(a) {
  const A = achState();
  return Math.min(a.goal, Math.floor(A.totals[a.total] || 0));
}

export function achDone(id) {
  return !!achState().done[id];
}

/** Adds one match's stats to the running totals; returns newly unlocked achievements and their XP. */
export function applyAchievements(ms, r) {
  const A = achState();
  const T = A.totals;
  const add = (k, v) => (T[k] = (T[k] || 0) + Math.max(0, v || 0));
  for (const k of ['driven', 'zips', 'chests', 'spent', 'upgrades', 'runovers', 'doors', 'carried', 'bosses', 'vault', 'quests']) add(k, (ms || {})[k]);
  add('kills', r.kills);
  if (r.won) {
    add('wins', 1);
    if (r.team) add('squadWins', 1);
  }
  T.rankPeak = Math.max(T.rankPeak || 0, rankState('build').peak, rankState('zerobuild').peak);
  T.level = levelInfo(save.data.progress.xp).level;
  return unlockReached();
}

/** Marks any achievement whose goal is met (also used after XP changes the level). */
export function unlockReached() {
  const A = achState();
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (A.done[a.id] || (A.totals[a.total] || 0) < a.goal) continue;
    A.done[a.id] = Date.now();
    got.push(a);
  }
  save.write();
  return { got, xp: got.length * ACH_XP };
}

export function refreshLevel() {
  achState().totals.level = levelInfo(save.data.progress.xp).level;
}

// ------------------------------------------------------------ equipping
export function equipped(charId) {
  const e = pass().equipped;
  const out = { emote: owns('emote', e.emote) ? e.emote : 'sig', glider: owns('glider', e.glider) ? e.glider : 'classic' };
  for (const kind of Object.keys(LOCKER)) out[kind] = e[kind] && owns(kind, e[kind]) ? e[kind] : DEFAULTS[kind];
  return out;
}

export function equip(kind, id) {
  if (!owns(kind, id)) return false;
  pass().equipped[kind] = id;
  save.write();
  return true;
}

export { divName };
