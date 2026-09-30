/**
 * Daily challenges: three a day (the same three for everyone on a given
 * date), progressed by what you do in matches, each worth bonus XP.
 * Progress is stored on this device and resets at local midnight.
 */

import { save } from './save.js';
import { today } from './supercharge.js';
import { mulberry32 } from '../gameplay/items.js';

export const CHALLENGE_XP = 1000;

/** stat(ms, r): this match's progress from its stats (ms) and result (r). */
export const CHALLENGES = {
  drive: { text: 'Drive 500 m in vehicles', goal: 500, stat: (m) => m.driven, unit: 'm' },
  zip: { text: 'Ride ziplines 2 times', goal: 2, stat: (m) => m.zips },
  chests: { text: 'Open 5 chests', goal: 5, stat: (m) => m.chests },
  elims: { text: 'Eliminate 4 opponents', goal: 4, stat: (m, r) => r.kills },
  bucks: { text: 'Spend 150 Benton Bucks', goal: 150, stat: (m) => m.spent },
  upgrade: { text: 'Upgrade a weapon at an upgrade bench', goal: 1, stat: (m) => m.upgrades },
  damage: { text: 'Deal 800 damage to opponents', goal: 800, stat: (m, r) => r.damage },
  runover: { text: 'Hit an opponent with a vehicle', goal: 1, stat: (m) => m.runovers },
  top10: { text: 'Finish in the top 10', goal: 1, stat: (m, r) => (r.place <= 10 ? 1 : 0) },
  play: { text: 'Play 3 matches', goal: 3, stat: () => 1 },
  boss: { text: 'Deal 500 damage to Crankbolt', goal: 500, stat: (m) => m.bossDmg },
  vault: { text: "Open Crankbolt's Vault", goal: 1, stat: (m) => m.vault },
  doors: { text: 'Open 8 doors', goal: 8, stat: (m) => m.doors },
  quest: { text: 'Complete a story quest', goal: 1, stat: (m) => m.quests },
  builder: { text: 'Build 20 pieces', goal: 20, stat: (m) => m.built },
};

/** Today's three challenges (rolled from the date, so every device agrees). */
export function dailyChallenges(now = Date.now()) {
  const d = today(now);
  let c = save.data.challenges;
  if (!c || c.day !== d || !Array.isArray(c.list)) {
    const rng = mulberry32(d * 7919 + 13);
    const ids = Object.keys(CHALLENGES);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    c = save.data.challenges = { day: d, list: ids.slice(0, 3).map((id) => ({ id, prog: 0, done: false })) };
    save.write();
  }
  return c;
}

/** Adds one match to today's challenges. Returns rows for the result screen and the XP earned. */
export function applyChallenges(ms, r) {
  const c = dailyChallenges();
  let xp = 0;
  const rows = c.list.map((ch) => {
    const def = CHALLENGES[ch.id];
    const before = ch.prog;
    if (!ch.done) ch.prog = Math.min(def.goal, ch.prog + Math.max(0, Math.round(def.stat(ms || {}, r) || 0)));
    const justDone = !ch.done && ch.prog >= def.goal;
    if (justDone) {
      ch.done = true;
      xp += CHALLENGE_XP;
    }
    return { id: ch.id, text: def.text, goal: def.goal, before, prog: ch.prog, done: ch.done, justDone };
  });
  save.write();
  return { rows, xp };
}
