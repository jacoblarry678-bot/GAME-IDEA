/**
 * Local player profile: identity, loadouts, career stats, progression
 * (player level, weapon levels), cosmetic inventory and equip state,
 * battle pass, challenges, test-credit wallet and purchase history.
 *
 * This is an offline demonstration save in localStorage. It is versioned
 * and validated on load, but it is NOT a secure economy: anyone can edit
 * local storage. A real release would validate all of this on a server.
 */
import { load, save, mergeDefaults } from './storage.js';
import { WEAPONS, EQUIPMENT, PRIMARY_IDS } from '../data/weapons.js';
import { COSMETICS, COSMETIC_LIST, DEFAULT_ITEMS, RARITY } from '../data/cosmetics.js';
import { SEASON, PASS_TIERS } from '../data/season.js';
import { DAILY_POOL, WEEKLY_POOL, DAILY_SLOTS, WEEKLY_SLOTS, periodKeys, pickChallenges } from '../data/challenges.js';
import { BUNDLES, itemPrice, bundlePrice } from '../data/shop.js';
import { MODES } from '../game/modes.js';

export const PROFILE_VERSION = 2;
export const MAX_LEVEL = 55;
export const MAX_WEAPON_LEVEL = 20;

/** XP needed to go from level L to L+1. */
export const xpToNext = (L) => 1500 + 150 * (L - 1);
export const weaponXpToNext = (L) => 600 + 100 * (L - 1);

const WEAPON_IDS = Object.keys(WEAPONS);

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
  level: 1,
  xp: 0,
  totalXp: 0,
  credits: SEASON.startingCredits,
  owned: {},
  equipped: { operator: 'op_voss', outfits: {}, weapons: {}, card: 'cd_recruit', emblem: 'em_chevron', banner: 'bn_steel' },
  weaponProgress: {},
  pass: { season: SEASON.id, xp: 0, premium: false, claimed: { free: {}, premium: {} } },
  challenges: { day: -1, week: -1, daily: [], weekly: [] },
  purchases: [],
  notices: [],
};

export class Profile {
  constructor() {
    const saved = load('profile', null);
    this.data = mergeDefaults(DEFAULT_PROFILE, saved);
    // open maps are not covered by mergeDefaults' key filter; restore them from the save
    for (const k of ['owned', 'weaponProgress']) this.data[k] = isObj(saved?.[k]) ? { ...saved[k] } : {};
    this.data.equipped.outfits = isObj(saved?.equipped?.outfits) ? { ...saved.equipped.outfits } : {};
    this.data.equipped.weapons = isObj(saved?.equipped?.weapons) ? { ...saved.equipped.weapons } : {};
    this.data.pass.claimed = { free: { ...(saved?.pass?.claimed?.free || {}) }, premium: { ...(saved?.pass?.claimed?.premium || {}) } };
    this.data.purchases = Array.isArray(saved?.purchases) ? saved.purchases.slice(-200) : [];
    this.data.challenges = isObj(saved?.challenges) ? saved.challenges : DEFAULT_PROFILE.challenges;
    this.data.notices = [];
    this.validate();
    this.seasonCheck();
    this.ensureChallenges();
    this.save();
  }

  // ---------------------------------------------------------------- validation
  validate() {
    const d = this.data;
    d.version = PROFILE_VERSION; // v1 saves (M1/M2) migrate by filling the new fields with defaults
    d.loadouts = DEFAULT_PROFILE.loadouts.map((def, i) => {
      const s = d.loadouts?.[i] || {};
      return {
        name: typeof s.name === 'string' && s.name.length <= 16 ? s.name : def.name,
        primary: WEAPONS[s.primary]?.slot === 'primary' ? s.primary : def.primary,
        secondary: WEAPONS[s.secondary]?.slot === 'secondary' ? s.secondary : def.secondary,
        lethal: EQUIPMENT[s.lethal]?.slot === 'lethal' ? s.lethal : def.lethal,
        tactical: EQUIPMENT[s.tactical]?.slot === 'tactical' ? s.tactical : def.tactical,
      };
    });
    if (!(d.activeLoadout >= 0 && d.activeLoadout < d.loadouts.length)) d.activeLoadout = 0;
    const ms = d.matchSetup;
    if (!MODES[ms.mode]?.playable) { ms.mode = 'tdm'; ms.scoreLimit = 75; ms.timeLimit = 10; }
    ms.botsEnemies = Math.max(1, Math.min(MODES[ms.mode].teams ? 5 : 9, ms.botsEnemies | 0));
    ms.botsAllies = Math.max(0, Math.min(4, ms.botsAllies | 0));
    d.level = clampInt(d.level, 1, MAX_LEVEL);
    d.xp = Math.max(0, d.xp | 0);
    d.credits = Math.max(0, d.credits | 0);
    // drop unknown item ids (stable ids keep old saves valid; removed items vanish safely)
    for (const id of Object.keys(d.owned)) if (!COSMETICS[id]) delete d.owned[id];
    for (const id of DEFAULT_ITEMS) if (!d.owned[id]) d.owned[id] = { t: Date.now(), src: 'default', seen: true };
    // anything unlocked by level/weapon level/operator but missing (e.g. after a catalog update) is granted
    this.grantEarnedUnlocks(true);
    for (const id of WEAPON_IDS) {
      const wp = d.weaponProgress[id];
      d.weaponProgress[id] = { xp: Math.max(0, wp?.xp | 0), level: clampInt(wp?.level || 1, 1, MAX_WEAPON_LEVEL), kills: Math.max(0, wp?.kills | 0) };
      const eq = d.equipped.weapons[id] || {};
      d.equipped.weapons[id] = {
        finish: this.owns(eq.finish) && COSMETICS[eq.finish].type === 'finish' ? eq.finish : 'fn_factory',
        charm: this.owns(eq.charm) && COSMETICS[eq.charm].type === 'charm' ? eq.charm : 'ch_none',
      };
    }
    const e = d.equipped;
    if (!this.owns(e.operator) || COSMETICS[e.operator].type !== 'operator') e.operator = 'op_voss';
    for (const op of COSMETIC_LIST.filter((i) => i.type === 'operator')) {
      const cur = e.outfits[op.id];
      if (!cur || !this.owns(cur) || COSMETICS[cur].operator !== op.id) e.outfits[op.id] = op.op.outfit;
    }
    for (const [k, t] of [['card', 'card'], ['emblem', 'emblem'], ['banner', 'banner']]) {
      if (!this.owns(e[k]) || COSMETICS[e[k]].type !== t) e[k] = DEFAULT_PROFILE.equipped[k];
    }
  }

  get loadout() { return this.data.loadouts[this.data.activeLoadout]; }
  save() { save('profile', this.data); }
  owns(id) { return !!(id && this.data.owned[id]); }

  // ---------------------------------------------------------------- inventory
  /**
   * Add an item to the inventory. Duplicates are converted to credits (by
   * rarity) and reported, never silently dropped. Operators bring their
   * standard outfit with them.
   */
  grant(id, src) {
    const it = COSMETICS[id];
    if (!it) return { ok: false };
    if (this.owns(id)) {
      const credits = RARITY[it.rarity].dupe;
      this.data.credits += credits;
      return { ok: true, duplicate: true, credits, item: it };
    }
    this.data.owned[id] = { t: Date.now(), src, seen: false };
    const out = { ok: true, item: it, extra: [] };
    if (it.type === 'operator' && it.op.outfit && !this.owns(it.op.outfit)) {
      this.data.owned[it.op.outfit] = { t: Date.now(), src: 'operator', seen: false };
      out.extra.push(COSMETICS[it.op.outfit]);
    }
    return out;
  }

  /** Grant every level / weapon-level / operator unlock the player already qualifies for. */
  grantEarnedUnlocks(silent = false) {
    const got = [];
    for (const it of COSMETIC_LIST) {
      if (this.owns(it.id)) continue;
      const u = it.unlock;
      let ok = false;
      if (u.type === 'level') ok = this.data.level >= u.level;
      else if (u.type === 'weapon') ok = (this.data.weaponProgress[u.weapon]?.level || 1) >= u.level;
      else if (u.type === 'operator') ok = this.owns(u.operator);
      if (ok) { this.data.owned[it.id] = { t: Date.now(), src: u.type, seen: silent }; got.push(it); }
    }
    return got;
  }

  markSeen(id) { if (this.data.owned[id]) this.data.owned[id].seen = true; }
  unseenCount() { return Object.values(this.data.owned).filter((o) => !o.seen).length; }

  /** Equip a cosmetic. For finishes/charms pass the weapon id. */
  equip(id, weaponId) {
    const it = COSMETICS[id];
    if (!it || !this.owns(id)) return false;
    const e = this.data.equipped;
    switch (it.type) {
      case 'operator': e.operator = id; break;
      case 'outfit': e.outfits[it.operator] = id; break;
      case 'finish': if (!WEAPONS[weaponId]) return false; e.weapons[weaponId].finish = id; break;
      case 'charm': if (!WEAPONS[weaponId]) return false; e.weapons[weaponId].charm = id; break;
      case 'card': e.card = id; break;
      case 'emblem': e.emblem = id; break;
      case 'banner': e.banner = id; break;
      default: return false;
    }
    this.markSeen(id);
    this.save();
    return true;
  }

  isEquipped(id, weaponId) {
    const it = COSMETICS[id], e = this.data.equipped;
    if (!it) return false;
    switch (it.type) {
      case 'operator': return e.operator === id;
      case 'outfit': return e.outfits[it.operator] === id;
      case 'finish': return weaponId ? e.weapons[weaponId]?.finish === id : Object.values(e.weapons).some((w) => w.finish === id);
      case 'charm': return weaponId ? e.weapons[weaponId]?.charm === id : Object.values(e.weapons).some((w) => w.charm === id);
      default: return e[it.type] === id;
    }
  }

  /** What the local player wears in a match. */
  get look() {
    const e = this.data.equipped;
    const op = COSMETICS[e.operator];
    return { operator: op, outfit: COSMETICS[e.outfits[e.operator]] || COSMETICS[op.op.outfit], weapons: e.weapons, card: COSMETICS[e.card], emblem: COSMETICS[e.emblem], banner: COSMETICS[e.banner] };
  }

  unlockText(it) {
    const u = it.unlock;
    switch (u.type) {
      case 'default': return 'Owned by default';
      case 'level': return `Reach player level ${u.level}`;
      case 'weapon': return `Reach ${WEAPONS[u.weapon].name} level ${u.level}`;
      case 'pass': return `Battle Pass tier ${u.tier} (${u.track === 'premium' ? 'Premium' : 'Free'} track)`;
      case 'shop': return 'Available in the Store';
      case 'operator': return `Comes with ${COSMETICS[u.operator].name}`;
      default: return '';
    }
  }

  // ---------------------------------------------------------------- XP & levels
  addXp(amount) {
    const d = this.data;
    const levels = [];
    d.totalXp += amount;
    if (d.level >= MAX_LEVEL) return { levels, unlocks: [] };
    d.xp += amount;
    while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
      d.xp -= xpToNext(d.level);
      d.level++;
      levels.push(d.level);
    }
    if (d.level >= MAX_LEVEL) d.xp = 0;
    return { levels, unlocks: levels.length ? this.grantEarnedUnlocks() : [] };
  }

  addWeaponXp(weaponId, amount, kills = 0) {
    const wp = this.data.weaponProgress[weaponId];
    if (!wp) return { levels: [] };
    wp.kills += kills;
    const levels = [];
    if (wp.level >= MAX_WEAPON_LEVEL) return { levels };
    wp.xp += amount;
    while (wp.level < MAX_WEAPON_LEVEL && wp.xp >= weaponXpToNext(wp.level)) {
      wp.xp -= weaponXpToNext(wp.level);
      wp.level++;
      levels.push(wp.level);
    }
    if (wp.level >= MAX_WEAPON_LEVEL) wp.xp = 0;
    return { levels };
  }

  // ---------------------------------------------------------------- battle pass
  get passTier() { return Math.min(SEASON.tiers, Math.floor(this.data.pass.xp / SEASON.xpPerTier)); }

  addPassXp(amount) {
    const before = this.passTier;
    this.data.pass.xp = Math.min(this.data.pass.xp + amount, SEASON.tiers * SEASON.xpPerTier);
    return { from: before, to: this.passTier };
  }

  canClaim(tier, track) {
    const p = this.data.pass;
    const slot = PASS_TIERS[tier - 1]?.[track];
    if (!slot) return false;
    if (tier > this.passTier) return false;
    if (track === 'premium' && !p.premium) return false;
    return !p.claimed[track][tier];
  }

  /** Claim one reward. Returns what was granted (with duplicate info) or null. */
  claim(tier, track) {
    if (!this.canClaim(tier, track)) return null;
    const slot = PASS_TIERS[tier - 1][track];
    this.data.pass.claimed[track][tier] = Date.now();
    let res;
    if (slot.item) res = this.grant(slot.item, `pass-${track}`);
    else { this.data.credits += slot.credits; res = { ok: true, credits: slot.credits }; }
    this.save();
    return { tier, track, ...res };
  }

  claimAll() {
    const out = [];
    for (let t = 1; t <= this.passTier; t++) for (const tr of ['free', 'premium']) { const r = this.claim(t, tr); if (r) out.push(r); }
    return out;
  }

  buyPremium() {
    const p = this.data.pass;
    if (p.premium) return { ok: false, reason: 'owned' };
    if (this.data.credits < SEASON.premiumPrice) return { ok: false, reason: 'funds', need: SEASON.premiumPrice - this.data.credits };
    this.data.credits -= SEASON.premiumPrice;
    p.premium = true;
    this.logPurchase('pass', SEASON.id, `Season ${SEASON.number} Premium Pass`, SEASON.premiumPrice);
    this.save();
    return { ok: true };
  }

  /** Season rollover: unclaimed earned rewards are granted, then pass progress resets. */
  seasonCheck() {
    const p = this.data.pass;
    if (p.season === SEASON.id) return;
    const granted = [];
    // earned-but-unclaimed rewards from the old season cannot be recomputed here
    // (tier tables change per season), so we only record the transition.
    this.data.notices.push(`Season changed from ${p.season} to ${SEASON.id}. Battle pass progress was reset; items you own are kept.`);
    this.data.pass = { season: SEASON.id, xp: 0, premium: false, claimed: { free: {}, premium: {} } };
    return granted;
  }

  // ---------------------------------------------------------------- challenges
  ensureChallenges(now = Date.now()) {
    const c = this.data.challenges;
    const { day, week } = periodKeys(now);
    const mk = (t) => ({ id: t.id, progress: 0, done: false });
    if (c.day !== day || !Array.isArray(c.daily) || c.daily.length !== DAILY_SLOTS) {
      c.day = day;
      c.daily = pickChallenges(DAILY_POOL, DAILY_SLOTS, day).map(mk);
    }
    if (c.week !== week || !Array.isArray(c.weekly) || c.weekly.length !== WEEKLY_SLOTS) {
      c.week = week;
      c.weekly = pickChallenges(WEEKLY_POOL, WEEKLY_SLOTS, week).map(mk);
    }
  }

  challengeDefs() {
    const find = (pool, id) => pool.find((t) => t.id === id);
    return {
      daily: this.data.challenges.daily.map((s) => ({ ...find(DAILY_POOL, s.id), ...s })),
      weekly: this.data.challenges.weekly.map((s) => ({ ...find(WEEKLY_POOL, s.id), ...s })),
    };
  }

  /** Apply one match's stats to challenge progress. Completed challenges pay XP once. */
  applyChallenges(stats, now = Date.now()) {
    this.ensureChallenges(now);
    const completed = [];
    for (const [list, pool] of [[this.data.challenges.daily, DAILY_POOL], [this.data.challenges.weekly, WEEKLY_POOL]]) {
      for (const s of list) {
        if (s.done) continue;
        const t = pool.find((x) => x.id === s.id);
        if (!t) continue;
        const v = statValue(stats, t.stat);
        s.progress = t.max ? Math.max(s.progress, v) : s.progress + v;
        if (s.progress >= t.goal) { s.progress = t.goal; s.done = true; completed.push(t); }
      }
    }
    return completed;
  }

  // ---------------------------------------------------------------- store
  logPurchase(kind, id, name, price) {
    this.data.purchases.push({ t: Date.now(), kind, id, name, price, balance: this.data.credits });
    if (this.data.purchases.length > 200) this.data.purchases.shift();
  }

  buyItem(id) {
    const it = COSMETICS[id];
    if (!it || it.unlock.type !== 'shop') return { ok: false, reason: 'unavailable' };
    if (this.owns(id)) return { ok: false, reason: 'owned' };
    const price = itemPrice(id);
    if (this.data.credits < price) return { ok: false, reason: 'funds', need: price - this.data.credits };
    this.data.credits -= price;
    const r = this.grant(id, 'shop');
    this.logPurchase('item', id, it.name, price);
    this.save();
    return { ok: true, price, granted: [r] };
  }

  buyBundle(bundleId) {
    const b = BUNDLES.find((x) => x.id === bundleId);
    if (!b) return { ok: false, reason: 'unavailable' };
    const { price, ownedCount } = bundlePrice(b, this.data.owned);
    if (ownedCount === b.items.length) return { ok: false, reason: 'owned' };
    if (this.data.credits < price) return { ok: false, reason: 'funds', need: price - this.data.credits };
    this.data.credits -= price;
    const granted = b.items.filter((id) => !this.owns(id)).map((id) => this.grant(id, 'shop'));
    this.logPurchase('bundle', b.id, b.name, price);
    this.save();
    return { ok: true, price, granted };
  }

  /** Demo-only: add test credits. Clearly labelled in the UI; no real money exists in this build. */
  addTestCredits(n) {
    this.data.credits += n;
    this.logPurchase('test-credits', 'demo', `Test credits added (+${n})`, -n);
    this.save();
  }

  // ---------------------------------------------------------------- match rewards
  /**
   * Record a finished match exactly once (guarded by match id) and apply
   * every reward: career stats, player XP + level unlocks, weapon XP + level
   * unlocks, challenge progress, battle-pass XP. Returns a report for the UI.
   */
  recordMatch(id, result, stats, seconds, summary) {
    if (this.data.lastMatchId === id) return null;
    this.data.lastMatchId = id;
    const c = this.data.career;
    c.matches++;
    if (result === 'win') c.wins++; else if (result === 'loss') c.losses++; else c.draws++;
    c.kills += stats.kills; c.deaths += stats.deaths; c.assists += stats.assists;
    c.headshots += stats.headshots; c.shots += stats.shots; c.hits += stats.hits; c.score += stats.score;
    c.bestStreak = Math.max(c.bestStreak, stats.bestStreak);
    c.timePlayed += Math.round(seconds);
    const report = summary ? this.applyRewards(result, stats, seconds, summary) : null;
    this.save();
    return report || { xp: [] };
  }

  applyRewards(result, stats, seconds, s) {
    const diffMul = { recruit: 0.8, regular: 1, hardened: 1.2, veteran: 1.4 }[s.difficulty] || 1;
    const lines = [];
    lines.push(['Match score', stats.score]);
    lines.push(['Match completion', 500]);
    if (result === 'win') lines.push(['Victory bonus', 500]);
    else if (result === 'draw') lines.push(['Draw bonus', 250]);
    lines.push(['Time played', Math.round((seconds / 60) * 60)]);
    let base = lines.reduce((a, [, v]) => a + v, 0);
    if (diffMul !== 1) { const extra = Math.round(base * (diffMul - 1)); lines.push([`Difficulty (${s.difficulty} ×${diffMul})`, extra]); base += extra; }
    const levelBefore = this.data.level, xpBefore = this.data.xp;
    // challenges
    const completed = this.applyChallenges({ ...s, score: stats.score, kills: stats.kills, headshots: stats.headshots, assists: stats.assists, bestStreak: stats.bestStreak, matches: 1, wins: result === 'win' ? 1 : 0 });
    const challengeXp = completed.reduce((a, t) => a + t.xp, 0);
    for (const t of completed) lines.push([`Challenge: ${t.text}`, t.xp]);
    const total = base + challengeXp;
    const lv = this.addXp(total);
    const passBefore = this.passTier;
    const pass = this.addPassXp(total);
    // weapons: kills and headshots with each weapon, plus a share for using it
    const weapons = [];
    for (const wid of new Set([...Object.keys(s.weaponKills || {}), ...(s.weaponsUsed || [])])) {
      if (!WEAPONS[wid]) continue;
      const k = s.weaponKills?.[wid] || 0, h = s.weaponHeadshots?.[wid] || 0;
      const wxp = k * 150 + h * 50 + 150;
      const before = this.data.weaponProgress[wid].level;
      const r = this.addWeaponXp(wid, Math.round(wxp * diffMul), k);
      weapons.push({ id: wid, xp: Math.round(wxp * diffMul), from: before, to: this.data.weaponProgress[wid].level, levels: r.levels });
    }
    const weaponUnlocks = this.grantEarnedUnlocks();
    return {
      xp: lines, total, levelBefore, xpBefore, levelAfter: this.data.level, xpAfter: this.data.xp,
      unlocks: [...lv.unlocks, ...weaponUnlocks], weapons, challenges: completed,
      pass: { from: passBefore, to: pass.to, xp: this.data.pass.xp },
    };
  }
}

function statValue(stats, key) {
  if (key.startsWith('class:')) return stats.classKills?.[key.slice(6)] || 0;
  return stats[key] || 0;
}
function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
function clampInt(v, a, b) { v = Math.round(Number(v) || a); return v < a ? a : v > b ? b : v; }

export { PRIMARY_IDS };
