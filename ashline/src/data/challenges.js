/**
 * Challenge templates and deterministic rotation. Daily challenges (5 slots)
 * reset at 00:00 UTC; weekly challenges (3 slots) reset Monday 00:00 UTC.
 * Selection is seeded from the period number, so it is stable for the whole
 * period and the same for everyone on this build.
 *
 * stat keys come from the per-match summary built in progression.js:
 *   kills, headshots, assists, score, matches, wins, grenadeKills, meleeKills,
 *   longshots, multikills, bestStreak (max), class:<assault|smg|shotgun|sniper|pistol>
 */
export const DAILY_POOL = [
  { id: 'd_kills15', text: 'Get 15 eliminations', stat: 'kills', goal: 15, xp: 1500 },
  { id: 'd_heads5', text: 'Get 5 headshots', stat: 'headshots', goal: 5, xp: 1500 },
  { id: 'd_ar8', text: 'Get 8 eliminations with an Assault Rifle', stat: 'class:assault', goal: 8, xp: 1500 },
  { id: 'd_smg8', text: 'Get 8 eliminations with an SMG', stat: 'class:smg', goal: 8, xp: 1500 },
  { id: 'd_sg3', text: 'Get 3 eliminations with a Shotgun', stat: 'class:shotgun', goal: 3, xp: 1500 },
  { id: 'd_sr3', text: 'Get 3 eliminations with a Sniper Rifle', stat: 'class:sniper', goal: 3, xp: 1500 },
  { id: 'd_pistol3', text: 'Get 3 eliminations with a Pistol', stat: 'class:pistol', goal: 3, xp: 1500 },
  { id: 'd_frag2', text: 'Get 2 grenade eliminations', stat: 'grenadeKills', goal: 2, xp: 2000 },
  { id: 'd_melee1', text: 'Get 1 melee elimination', stat: 'meleeKills', goal: 1, xp: 2000 },
  { id: 'd_assist6', text: 'Earn 6 assists', stat: 'assists', goal: 6, xp: 1500 },
  { id: 'd_win1', text: 'Win a match', stat: 'wins', goal: 1, xp: 2000 },
  { id: 'd_play2', text: 'Complete 2 matches', stat: 'matches', goal: 2, xp: 1500 },
  { id: 'd_score3k', text: 'Earn 3,000 score', stat: 'score', goal: 3000, xp: 1500 },
  { id: 'd_long2', text: 'Earn 2 Longshot medals', stat: 'longshots', goal: 2, xp: 2000 },
  { id: 'd_multi1', text: 'Earn a multi-kill medal', stat: 'multikills', goal: 1, xp: 2000 },
];

export const WEEKLY_POOL = [
  { id: 'w_kills100', text: 'Get 100 eliminations', stat: 'kills', goal: 100, xp: 6000 },
  { id: 'w_heads30', text: 'Get 30 headshots', stat: 'headshots', goal: 30, xp: 6000 },
  { id: 'w_win5', text: 'Win 5 matches', stat: 'wins', goal: 5, xp: 7000 },
  { id: 'w_play10', text: 'Complete 10 matches', stat: 'matches', goal: 10, xp: 6000 },
  { id: 'w_multi10', text: 'Earn 10 multi-kill medals', stat: 'multikills', goal: 10, xp: 7000 },
  { id: 'w_smg40', text: 'Get 40 eliminations with an SMG', stat: 'class:smg', goal: 40, xp: 6000 },
  { id: 'w_ar40', text: 'Get 40 eliminations with an Assault Rifle', stat: 'class:assault', goal: 40, xp: 6000 },
  { id: 'w_sr15', text: 'Get 15 eliminations with a Sniper Rifle', stat: 'class:sniper', goal: 15, xp: 7000 },
  { id: 'w_score25k', text: 'Earn 25,000 score', stat: 'score', goal: 25000, xp: 6000 },
  { id: 'w_streak10', text: 'Reach a 10-elimination streak in one match', stat: 'bestStreak', goal: 10, xp: 8000, max: true },
];

export const DAILY_SLOTS = 5;
export const WEEKLY_SLOTS = 3;

const DAY = 86400000;
/** Day number (UTC) and ISO-week number (weeks start Monday 00:00 UTC). */
export function periodKeys(now = Date.now()) {
  const day = Math.floor(now / DAY);
  const week = Math.floor((day + 3) / 7); // 1970-01-01 was a Thursday; +3 aligns weeks to Monday
  return { day, week };
}

export function nextReset(now = Date.now()) {
  const { day, week } = periodKeys(now);
  return { daily: (day + 1) * DAY, weekly: (week + 1) * 7 * DAY - 3 * DAY };
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Pick `n` distinct templates from a pool, deterministically for a period. */
export function pickChallenges(pool, n, periodSeed) {
  const r = seeded(periodSeed * 2654435761);
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).map((i) => pool[i]);
}
