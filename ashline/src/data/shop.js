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
  { id: 'bd_party', name: 'Party Pack', desc: 'Rail Shuffle, Flex and Facepalm emotes.', items: ['ex_shuffle', 'ex_flex', 'ex_facepalm'], discount: 0.3 },
  { id: 'bd_morale', name: 'Morale Pack', desc: 'Rubber Duck charm, Iron Helm emblem and Prismatic finish.', items: ['ch_duck', 'em_skullcap', 'fn_prism'], discount: 0.3 },
];

/** Collaborations: always listed in their own Store section (not part of the rotation). */
export const COLLABS = [
  { id: 'waspinator', name: 'Waspinator Collab', bundle: 'bd_waspinator', items: ['ch_waspinator', 'bn_waspinator'], blurb: 'Limited collaboration set. Cosmetic only — never affects gameplay.' },
];
BUNDLES.push({ id: 'bd_waspinator', name: 'Waspinator Collab Bundle', desc: 'The Waspinator keychain charm and the Waspinator banner.', items: ['ch_waspinator', 'bn_waspinator'], discount: 0.2, collab: 'waspinator' });

/** Event Store sections (listed only while their event runs). */
export const EVENT_SHOPS = [
  { event: 'hollow_night', name: 'Hollow Night', bundle: 'bd_hollow', items: ['of_kestrel_wraith', 'fn_bone', 'ch_skull', 'ch_ghost', 'em_bat', 'cd_patch', 'bn_cobweb', 'ex_scare'], blurb: 'Halloween event items for test credits. Cosmetic only; what you buy stays yours after the event.' },
];
BUNDLES.push({ id: 'bd_hollow', name: 'Hollow Night Bundle', desc: 'Every Hollow Night Store item: Wraith outfit, Ossuary finish, Rattle Skull and Little Ghost charms, Night Wing emblem, Pumpkin Patch card and Cobweb banner.', items: ['of_kestrel_wraith', 'fn_bone', 'ch_skull', 'ch_ghost', 'em_bat', 'cd_patch', 'bn_cobweb'], discount: 0.25, event: 'hollow_night' });

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

export const SHOP_ITEMS = COSMETIC_LIST.filter((i) => i.unlock.type === 'shop' && !i.collab && !i.unlock.event).map((i) => i.id);

/** Current demo rotation: featured items (daily) and bundles (weekly). */
export function currentRotation(now = Date.now()) {
  const { day, week } = periodKeys(now);
  const featured = pickChallenges(SHOP_ITEMS, SHOP_CONFIG.featuredSlots, day + 101);
  const bundles = pickChallenges(BUNDLES.filter((b) => !b.collab && !b.event), SHOP_CONFIG.bundleSlots, week + 707);
  return { featured, bundles, day, week };
}
