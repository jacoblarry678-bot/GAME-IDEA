/**
 * Demonstration item shop catalog and rotation. Prices are in TEST credits.
 * Rotation is generated locally from the date (featured items change daily,
 * bundles weekly) — this is a demo rotation, not a live service.
 */
import { COSMETICS, RARITY, COSMETIC_LIST } from './cosmetics.js';
import { periodKeys, pickChallenges } from './challenges.js';

export const BUNDLES = [
  { id: 'bd_rustbelt', name: 'Rust Belt Bundle', desc: 'Marek in Rust Belt, Copper Patina finish and the Brass Star charm.', items: ['of_marek_rust', 'fn_copper', 'ch_star'], discount: 0.3 },
  { id: 'bd_tiger', name: 'Tigerstripe Bundle', desc: 'Kestrel in Tigerstripe, Cobalt finish and the Watcher emblem.', items: ['of_kestrel_tiger', 'fn_cobalt', 'em_eye'], discount: 0.3 },
  { id: 'bd_signal', name: 'Signal Bundle', desc: 'Signal Red outfit, Circuit finish and the Signal Lost card.', items: ['of_kestrel_signal', 'fn_circuit', 'cd_signal'], discount: 0.25 },
  { id: 'bd_whiteout', name: 'Whiteout Bundle', desc: 'Sol in Whiteout, Aurora finish and the Royal banner.', items: ['of_sol_snow', 'fn_aurora', 'bn_royal'], discount: 0.25 },
  { id: 'bd_morale', name: 'Morale Pack', desc: 'Rubber Duck charm, Iron Helm emblem and Prismatic finish.', items: ['ch_duck', 'em_skullcap', 'fn_prism'], discount: 0.3 },
];

export const SHOP_CONFIG = { featuredSlots: 4, bundleSlots: 2, demoLabel: 'Demo rotation, generated on this device from the date. Not a live service.' };

/** Base price for a single item, by rarity. */
export function itemPrice(id) {
  const it = COSMETICS[id];
  return it ? RARITY[it.rarity].value : 0;
}

/** Bundle price after discount, reduced by the value of items already owned. */
export function bundlePrice(b, owned) {
  const full = b.items.reduce((s, id) => s + itemPrice(id), 0);
  const ownedValue = b.items.filter((id) => owned[id]).reduce((s, id) => s + itemPrice(id), 0);
  const base = Math.round(((full - ownedValue) * (1 - b.discount)) / 10) * 10;
  return { full, price: Math.max(0, base), ownedCount: b.items.filter((id) => owned[id]).length };
}

export const SHOP_ITEMS = COSMETIC_LIST.filter((i) => i.unlock.type === 'shop').map((i) => i.id);

/** Current demo rotation: featured items (daily) and bundles (weekly). */
export function currentRotation(now = Date.now()) {
  const { day, week } = periodKeys(now);
  const featured = pickChallenges(SHOP_ITEMS, SHOP_CONFIG.featuredSlots, day + 101);
  const bundles = pickChallenges(BUNDLES, SHOP_CONFIG.bundleSlots, week + 707);
  return { featured, bundles, day, week };
}
