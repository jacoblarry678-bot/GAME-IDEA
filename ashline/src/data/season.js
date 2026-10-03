/**
 * Season & battle pass configuration (demonstration). Tier rewards are built
 * from the cosmetic catalog (items whose unlock is { type: 'pass' }) plus
 * test-currency rewards on the remaining tiers. All premium functionality uses
 * clearly labelled TEST credits — there are no real payments.
 */
import { COSMETIC_LIST } from './cosmetics.js';

export const CURRENCY = { name: 'Ash Credits', short: 'AC', test: true, label: 'TEST CREDITS' };

export const SEASON = {
  id: 's1',
  number: 1,
  name: 'ASHFALL',
  start: '2026-09-01T00:00:00Z',
  end: '2026-12-01T00:00:00Z',
  tiers: 50,
  xpPerTier: 1000,
  premiumPrice: 950,
  startingCredits: 1500,
};

function buildTiers() {
  const tiers = [];
  for (let t = 1; t <= SEASON.tiers; t++) tiers.push({ tier: t, free: null, premium: null });
  for (const it of COSMETIC_LIST) {
    if (it.unlock.type !== 'pass') continue;
    const slot = tiers[it.unlock.tier - 1];
    if (slot[it.unlock.track]) throw new Error(`pass slot taken: tier ${it.unlock.tier} ${it.unlock.track}`);
    slot[it.unlock.track] = { item: it.id };
  }
  for (const s of tiers) {
    if (!s.premium) s.premium = { credits: s.tier % 10 === 0 ? 300 : 100 };
    if (!s.free && s.tier % 5 === 0) s.free = { credits: 150 };
    else if (!s.free && s.tier % 2 === 1) s.free = { credits: 50 };
  }
  return tiers;
}

export const PASS_TIERS = buildTiers();

/** Season currently active for a given time, or the configured one if outside its window. */
export function activeSeason(now = Date.now()) {
  return SEASON;
}

export function seasonDaysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(SEASON.end) - now) / 86400000));
}
