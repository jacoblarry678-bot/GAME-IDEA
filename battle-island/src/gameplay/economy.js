/**
 * Benton Bucks: a match currency. Found in chests, on the floor and dropped by
 * eliminated players; spent at vending bots (items) and upgrade benches
 * (weapon rarity). Everything is validated on the host.
 */

import * as THREE from 'three';
import { RARITIES, WEAPONS, makeWeapon, itemName } from './items.js';
import { sfx } from '../core/audio.js';

export const VENDOR_STOCK = [
  // Snack-O-Bot (Clubhouse): healing
  [
    { it: { kind: 'consumable', id: 'bigshield', count: 1 }, price: 100 },
    { it: { kind: 'consumable', id: 'medkit', count: 1 }, price: 90 },
    { it: { kind: 'consumable', id: 'pickle', count: 2 }, price: 60 },
  ],
  // Pickle-O-Bot (Pickles Park): buffs
  [
    { it: { kind: 'consumable', id: 'zoom', count: 1 }, price: 50 },
    { it: { kind: 'consumable', id: 'spicy', count: 1 }, price: 60 },
    { it: { kind: 'consumable', id: 'snack', count: 1 }, price: 60 },
  ],
  // Boom-O-Bot (Boom Co. Depot): big stuff
  [
    { it: { kind: 'throwable', id: 'boomball', count: 3 }, price: 80 },
    { it: makeWeapon('sniper', 3), ammo: 8, price: 200 },
    { it: makeWeapon('launcher', 2), ammo: 4, price: 250 },
  ],
];

/** Cost to raise a weapon from rarity r to r + 1. */
export const UPGRADE_COST = [50, 100, 175, 250];
export const SHOP_RANGE = 3.6;
export const BENCH_RANGE = 3.2;

export function stockName(s) {
  const it = s.it;
  const rar = it.kind === 'weapon' ? RARITIES[it.rarity].name + ' ' : '';
  return `${rar}${itemName(it)}${it.count > 1 ? ' x' + it.count : ''}`;
}

export function nearVendor(game, a) {
  return game.world.vendors.find((v) => Math.hypot(v.stand.x - a.pos.x, v.stand.z - a.pos.z) < SHOP_RANGE && Math.abs(v.stand.y - a.pos.y) < 3) || null;
}

export function nearBench(game, a) {
  return game.world.benches.find((b) => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < BENCH_RANGE && Math.abs(b.pos.y - a.pos.y) < 3) || null;
}

/** What the upgrade bench would do for the held item (or why it can't). */
export function upgradeInfo(a) {
  const it = a.item;
  if (!it || it.kind !== 'weapon') return { ok: false, text: 'Hold a weapon to upgrade it' };
  if (it.rarity >= 4) return { ok: false, text: `${itemName(it)} is already ${RARITIES[it.rarity].name}` };
  const cost = UPGRADE_COST[it.rarity];
  return { ok: a.bucks >= cost, cost, text: `Upgrade to ${RARITIES[it.rarity + 1].name} · ${cost} Bucks`, color: RARITIES[it.rarity + 1].color };
}

/** Host: buy item `k` from vendor `vi`. Returns a message for the buyer. */
export function buy(game, a, vi, k) {
  const v = game.world.vendors[vi];
  const s = VENDOR_STOCK[vi] && VENDOR_STOCK[vi][k];
  if (!v || !s || !a.canAct() || Math.hypot(v.stand.x - a.pos.x, v.stand.z - a.pos.z) > SHOP_RANGE + 1) return null;
  if (a.bucks < s.price) return { text: `Not enough Benton Bucks (${s.price} needed).`, color: '#ff8a8a' };
  a.bucks -= s.price;
  a.stats.spent += s.price;
  const it = JSON.parse(JSON.stringify(s.it));
  const left = a.addItem(it);
  if (left) game.loot.drop(left, a.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 3, 0));
  if (s.ammo) a.addItem({ kind: 'ammo', id: WEAPONS[it.id].ammo, count: s.ammo });
  sfx.play('buy', a.pos);
  return { text: `Bought ${stockName(s)}${left ? ' (inventory full: dropped at your feet)' : ''}`, color: '#ffd23f' };
}

/** Host: upgrade the held weapon at bench `bi`. */
export function upgrade(game, a, bi) {
  const b = game.world.benches[bi];
  if (!b || !a.canAct() || Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > BENCH_RANGE + 1) return null;
  const info = upgradeInfo(a);
  if (!info.ok) return { text: info.cost ? `Not enough Benton Bucks (${info.cost} needed).` : info.text, color: '#ff8a8a' };
  a.bucks -= info.cost;
  a.stats.spent += info.cost;
  a.stats.upgrades++;
  a.item.rarity++;
  game.effects.burst(b.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), RARITIES[a.item.rarity].color, 22, 4, 0.12, 0.8);
  sfx.play('buy', a.pos);
  return { text: `Upgraded to ${RARITIES[a.item.rarity].name} ${itemName(a.item)}!`, color: RARITIES[a.item.rarity].color };
}

/** Eliminated players drop their Bucks (plus a bounty). */
export function dropBucks(game, a) {
  const n = (a.bucks | 0) + 25;
  a.bucks = 0;
  if (game.role === 'client') return;
  game.loot.drop({ kind: 'coin', id: 'bucks', count: n }, a.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 5, 0));
}
