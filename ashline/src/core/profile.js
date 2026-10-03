/**
 * Local player profile: name, loadout presets, last match setup and career
 * stats. Stored locally (offline demo) — not a secure or server-validated save.
 */
import { load, save, mergeDefaults } from './storage.js';
import { WEAPONS, EQUIPMENT, PRIMARY_IDS } from '../data/weapons.js';

export const PROFILE_VERSION = 1;

const DEFAULT_PROFILE = {
  version: PROFILE_VERSION,
  name: 'Operator',
  activeLoadout: 0,
  loadouts: [
    { name: 'RIFLEMAN', primary: 'ar_kv7', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' },
    { name: 'BREACHER', primary: 'smg_vesper', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' },
    { name: 'POINTMAN', primary: 'sg_brakk', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' },
    { name: 'OVERWATCH', primary: 'sr_longreach', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' },
    { name: 'CUSTOM 5', primary: 'ar_kv7', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' },
  ],
  matchSetup: { mode: 'tdm', map: 'cinder_yard', botsAllies: 4, botsEnemies: 5, difficulty: 'regular', scoreLimit: 75, timeLimit: 10, friendlyFire: false },
  career: { matches: 0, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, shots: 0, hits: 0, score: 0, bestStreak: 0, timePlayed: 0 },
  lastMatchId: null,
};

export class Profile {
  constructor() {
    const saved = load('profile', null);
    this.data = mergeDefaults(DEFAULT_PROFILE, saved);
    // validate loadouts against known ids (recovers from stale/invalid saves)
    this.data.loadouts = DEFAULT_PROFILE.loadouts.map((d, i) => {
      const s = (saved && Array.isArray(saved.loadouts) && saved.loadouts[i]) || {};
      return {
        name: typeof s.name === 'string' && s.name.length <= 16 ? s.name : d.name,
        primary: WEAPONS[s.primary]?.slot === 'primary' ? s.primary : d.primary,
        secondary: WEAPONS[s.secondary]?.slot === 'secondary' ? s.secondary : d.secondary,
        lethal: EQUIPMENT[s.lethal]?.slot === 'lethal' ? s.lethal : d.lethal,
        tactical: EQUIPMENT[s.tactical]?.slot === 'tactical' ? s.tactical : d.tactical,
      };
    });
    if (!(this.data.activeLoadout >= 0 && this.data.activeLoadout < this.data.loadouts.length)) this.data.activeLoadout = 0;
    this.save();
  }

  get loadout() { return this.data.loadouts[this.data.activeLoadout]; }
  save() { save('profile', this.data); }

  /** Record a finished match exactly once (guarded by match id). */
  recordMatch(id, result, stats, seconds) {
    if (this.data.lastMatchId === id) return false;
    this.data.lastMatchId = id;
    const c = this.data.career;
    c.matches++;
    if (result === 'win') c.wins++; else if (result === 'loss') c.losses++; else c.draws++;
    c.kills += stats.kills; c.deaths += stats.deaths; c.assists += stats.assists;
    c.headshots += stats.headshots; c.shots += stats.shots; c.hits += stats.hits; c.score += stats.score;
    c.bestStreak = Math.max(c.bestStreak, stats.bestStreak);
    c.timePlayed += Math.round(seconds);
    this.save();
    return true;
  }
}

export { PRIMARY_IDS };
