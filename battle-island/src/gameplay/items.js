/** Item, weapon, rarity and loot-table definitions. Pure data + tiny helpers. */

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#aab4be', mult: 1.0, reload: 1.0 },
  { id: 'uncommon', name: 'Uncommon', color: '#4fcf4a', mult: 1.05, reload: 0.95 },
  { id: 'rare', name: 'Rare', color: '#3f9bff', mult: 1.1, reload: 0.9 },
  { id: 'epic', name: 'Epic', color: '#b35cff', mult: 1.16, reload: 0.85 },
  { id: 'legendary', name: 'Legendary', color: '#ffae1a', mult: 1.22, reload: 0.8 },
  { id: 'mythic', name: 'Mythic', color: '#ffe45c', mult: 1.32, reload: 0.72 }, // only from Crankbolt
];

export const AMMO = {
  light: { name: 'Light Ammo', color: '#9fd0ff', max: 999, drop: 30 },
  medium: { name: 'Medium Ammo', color: '#7be36f', max: 999, drop: 30 },
  heavy: { name: 'Heavy Ammo', color: '#ff8a5c', max: 999, drop: 6 },
  shells: { name: 'Shells', color: '#ffd84d', max: 999, drop: 8 },
  rockets: { name: 'Rockets', color: '#ff5ca8', max: 99, drop: 3 },
};

export const MATS = {
  wood: { name: 'Wood', color: '#c98a4b' },
  brick: { name: 'Brick', color: '#c4533f' },
  metal: { name: 'Metal', color: '#8fa3b8' },
};
export const MAT_MAX = 999;

/**
 * spread values are radians of cone half-angle. bloom grows per shot and decays.
 * hitscan weapons resolve instantly; `projectile` weapons fly with gravity.
 */
export const WEAPONS = {
  ar: {
    name: 'Thunder Rifle', cls: 'Assault Rifle', ammo: 'medium', mag: 30, dmg: 30, rate: 5.5, reload: 2.3,
    hip: 0.03, ads: 0.006, bloom: 0.008, maxBloom: 0.05, recoil: 0.014, auto: true, zoom: 1.45,
    head: 1.5, range: 220, falloff: [60, 0.7], sound: 'ar',
  },
  smg: {
    name: 'Zip SMG', cls: 'SMG', ammo: 'light', mag: 30, dmg: 17, rate: 12, reload: 2.0,
    hip: 0.04, ads: 0.022, bloom: 0.005, maxBloom: 0.05, recoil: 0.008, auto: true, zoom: 1.25,
    head: 1.5, range: 120, falloff: [25, 0.6], sound: 'smg',
  },
  shotgun: {
    name: 'Night Pump', cls: 'Shotgun', ammo: 'shells', mag: 5, dmg: 10, pellets: 10, rate: 1.0, reload: 4.2,
    hip: 0.085, ads: 0.065, bloom: 0, maxBloom: 0, recoil: 0.06, auto: false, zoom: 1.2,
    head: 1.8, range: 50, falloff: [8, 0.2], sound: 'shotgun',
  },
  pistol: {
    name: 'Hand Cannon', cls: 'Pistol', ammo: 'light', mag: 8, dmg: 40, rate: 2.6, reload: 1.8,
    hip: 0.022, ads: 0.006, bloom: 0.02, maxBloom: 0.06, recoil: 0.045, auto: false, zoom: 1.25,
    head: 2.0, range: 130, falloff: [30, 0.6], sound: 'pistol',
  },
  sniper: {
    name: 'Long Shot', cls: 'Sniper Rifle', ammo: 'heavy', mag: 1, dmg: 105, rate: 0.6, reload: 2.4,
    hip: 0.09, ads: 0.0, bloom: 0, maxBloom: 0, recoil: 0.09, auto: false, zoom: 4.5, scope: true,
    head: 2.5, range: 600, projectile: { speed: 320, gravity: 9, radius: 0 }, sound: 'sniper',
  },
  pumpkin: {
    // Halloween: lobs exploding jack-o'-lanterns in an arc
    name: 'Pumpkin Launcher', cls: 'Launcher', ammo: 'rockets', mag: 2, dmg: 70, rate: 1.1, reload: 2.6,
    hip: 0.012, ads: 0.005, bloom: 0, maxBloom: 0, recoil: 0.06, auto: false, zoom: 1.25,
    head: 1, range: 300, projectile: { speed: 42, gravity: 14, radius: 4.5, structDmg: 300, pumpkin: true }, sound: 'rocket',
  },
  launcher: {
    name: 'Boom Launcher', cls: 'Launcher', ammo: 'rockets', mag: 1, dmg: 95, rate: 0.9, reload: 2.8,
    hip: 0.01, ads: 0.004, bloom: 0, maxBloom: 0, recoil: 0.07, auto: false, zoom: 1.3,
    head: 1, range: 400, projectile: { speed: 60, gravity: 0, radius: 5, structDmg: 450 }, sound: 'rocket',
  },
};

export const THROWABLES = {
  boomball: { name: 'Boom Ball', max: 6, dmg: 90, radius: 4.5, structDmg: 350, fuse: 2.4, color: '#ff4f7a' },
};

/** use time (s), heal, shield, caps and stack size. `over` = applied over time. */
export const CONSUMABLES = {
  bandage: { name: 'Band-Aids', time: 3.5, hp: 15, hpCap: 75, max: 15, color: '#ffd7c2' },
  medkit: { name: 'First Aid Kit', time: 10, hp: 100, hpCap: 100, max: 3, color: '#ff4b4b' },
  minishield: { name: 'Shield Juice Box', time: 2, shield: 25, shieldCap: 50, max: 6, color: '#5ac8ff' },
  bigshield: { name: 'Big Shield Potion', time: 5, shield: 50, shieldCap: 100, max: 3, color: '#2f6bff' },
  pickle: { name: 'Pickle Fizz', time: 1.5, hp: 15, shield: 15, hpCap: 100, shieldCap: 100, over: 3, max: 4, color: '#7ed957' },
  // buffs: temporary effects (see BUFFS)
  zoom: { name: 'Zoom Juice', time: 1.2, buff: 'zoom', max: 3, color: '#ffb23f' },
  bounce: { name: 'Bouncy Soda', time: 1.2, buff: 'bounce', max: 3, color: '#ff7ac8' },
  spicy: { name: 'Spicy Pickle', time: 1.2, buff: 'spicy', max: 3, color: '#ff4b2b' },
  snack: { name: 'Shield Snack', time: 1.2, buff: 'snack', max: 3, color: '#39f0ff' },
  // Halloween
  ghost: { name: 'Ghost Potion', time: 1.2, buff: 'ghost', max: 2, color: '#bff3ff' },
  candybar: { name: 'Candy Bar', time: 1.0, hp: 20, hpCap: 100, max: 6, color: '#8a4a2a' },
};

/** Temporary effects granted by buff consumables. */
export const BUFFS = {
  zoom: { name: 'Zoom', dur: 12, color: '#ffb23f', desc: '+30% move speed' },
  bounce: { name: 'Bounce', dur: 20, color: '#ff7ac8', desc: 'Higher jumps, no fall damage' },
  spicy: { name: 'Spicy', dur: 12, color: '#ff4b2b', desc: '+20% damage' },
  snack: { name: 'Snack', dur: 15, color: '#39f0ff', desc: 'Regenerate 4 shield/s' },
  ghost: { name: 'Ghost', dur: 10, color: '#d9f6ff', desc: 'See-through and 25% faster; bots lose you from afar' },
};

/**
 * Weapon attachments ("mods"): loot that snaps onto a gun. One per slot
 * (optic, under, mag, barrel); a new one in a taken slot swaps the old one out.
 * `apply` returns the stats it changes.
 */
export const MODS = {
  dot: { name: 'Red Dot Sight', slot: 'optic', color: '#ff5c5c', fits: ['ar', 'smg', 'pistol', 'shotgun'], desc: 'Steadier aim, 1.6x zoom', apply: (w) => ({ zoom: Math.max(w.zoom, 1.6), ads: w.ads * 0.7 }) },
  scope: { name: '4x Scope', slot: 'optic', color: '#39f0ff', fits: ['ar', 'smg', 'pistol'], desc: 'Scoped 3x zoom, pinpoint aim', apply: (w) => ({ zoom: 3, scope: true, ads: w.ads * 0.45 }) },
  grip: { name: 'Steady Grip', slot: 'under', color: '#7ed957', fits: ['ar', 'smg', 'shotgun', 'sniper'], desc: 'Less recoil and bloom', apply: (w) => ({ recoil: w.recoil * 0.55, bloom: w.bloom * 0.6, hip: w.hip * 0.85 }) },
  drum: { name: 'Drum Mag', slot: 'mag', color: '#ffae1a', fits: ['ar', 'smg', 'pistol', 'sniper'], desc: '+50% magazine', apply: (w) => ({ mag: Math.max(w.mag + 1, Math.round(w.mag * 1.5)) }) },
  choke: { name: 'Tight Choke', slot: 'barrel', color: '#b35cff', fits: ['shotgun'], desc: 'Tighter spread, longer reach', apply: (w) => ({ hip: w.hip * 0.7, ads: w.ads * 0.7, falloff: [w.falloff[0] * 1.4, w.falloff[1]] }) },
};
export const MOD_IDS = Object.keys(MODS);

export const modBits = (mods) => (mods || []).reduce((m, id) => m | (1 << MOD_IDS.indexOf(id)), 0);
export const bitsToMods = (bits) => MOD_IDS.filter((_, i) => bits & (1 << i));

const statCache = new Map();
/** A weapon item's stats with its attachments applied (cached per combination). */
export function weaponStats(it) {
  const base = WEAPONS[it.id];
  if (!it.mods || !it.mods.length) return base;
  const k = it.id + ':' + modBits(it.mods);
  let w = statCache.get(k);
  if (!w) {
    w = { ...base };
    for (const id of MOD_IDS) if (it.mods.includes(id)) Object.assign(w, MODS[id].apply(w));
    statCache.set(k, w);
  }
  return w;
}

/** The weapon slot an attachment would go on: the held gun if it fits, else the first gun that does. */
export function modTarget(actor, modId) {
  const fits = (s) => s && s.kind === 'weapon' && MODS[modId].fits.includes(s.id);
  if (fits(actor.slots[actor.sel])) return actor.sel;
  const i = actor.slots.findIndex(fits);
  return i >= 0 ? i : -1;
}

/** Puts an attachment on a slot's weapon. Returns the attachment it replaced (or null). */
export function attachMod(actor, slot, modId) {
  const w = actor.slots[slot];
  const old = (w.mods || []).find((m) => MODS[m].slot === MODS[modId].slot) || null;
  w.mods = [...(w.mods || []).filter((m) => m !== old), modId];
  return old;
}

export const PICKAXE = { name: 'Pickaxe', dmg: 20, structDmg: 50, rate: 1.9, range: 2.9 };

export function itemName(it) {
  if (!it) return '';
  if (it.kind === 'weapon') return WEAPONS[it.id].name;
  if (it.kind === 'throwable') return THROWABLES[it.id].name;
  if (it.kind === 'consumable') return CONSUMABLES[it.id].name;
  if (it.kind === 'ammo') return AMMO[it.id].name;
  if (it.kind === 'mat') return MATS[it.id].name;
  if (it.kind === 'card') return `${it.name}'s Reboot Card`;
  if (it.kind === 'coin') return it.id === 'candy' ? 'Candy Corn' : 'Benton Bucks';
  if (it.kind === 'key') return 'Vault Keycard';
  if (it.kind === 'mod') return MODS[it.id].name;
  return '?';
}

export function stackMax(it) {
  if (it.kind === 'consumable') return CONSUMABLES[it.id].max;
  if (it.kind === 'throwable') return THROWABLES[it.id].max;
  return 1;
}

export function makeWeapon(id, rarity) {
  return { kind: 'weapon', id, rarity, mag: WEAPONS[id].mag };
}

// ---------- loot tables ----------
const pick = (rng, table) => {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [v, w] of table) if ((r -= w) <= 0) return v;
  return table[table.length - 1][0];
};

const WEAPON_TABLE = [['ar', 30], ['smg', 22], ['shotgun', 24], ['pistol', 16], ['sniper', 6], ['launcher', 3]];
const FLOOR_RARITY = [[0, 45], [1, 32], [2, 17], [3, 5], [4, 1]];
const CHEST_RARITY = [[1, 35], [2, 38], [3, 20], [4, 7]];
const CONSUMABLE_TABLE = [['bandage', 30], ['minishield', 30], ['bigshield', 14], ['medkit', 10], ['pickle', 16], ['zoom', 9], ['bounce', 8], ['spicy', 8], ['snack', 9]];

export function rollWeapon(rng, chest) {
  const id = pick(rng, WEAPON_TABLE);
  let rarity = pick(rng, chest ? CHEST_RARITY : FLOOR_RARITY);
  if (id === 'launcher' || id === 'sniper') rarity = Math.max(2, rarity);
  return makeWeapon(id, rarity);
}

/** Halloween floor loot (added on top of the normal roll while the event runs). */
export function rollHalloween(rng) {
  const r = rng();
  if (r < 0.45) return [{ kind: 'coin', id: 'candy', count: 5 + Math.floor(rng() * 3) * 5 }];
  if (r < 0.65) return [{ kind: 'consumable', id: 'candybar', count: 2 }];
  if (r < 0.82) return [{ kind: 'consumable', id: 'ghost', count: 1 }];
  const w = makeWeapon('pumpkin', rng() < 0.6 ? 2 : 3);
  return [w, { kind: 'ammo', id: 'rockets', count: 4 }];
}

export function rollMod(rng) {
  return { kind: 'mod', id: pick(rng, [['dot', 30], ['scope', 16], ['grip', 26], ['drum', 20], ['choke', 12]]), count: 1 };
}

export function rollConsumable(rng) {
  if (rng() < 0.18) return { kind: 'throwable', id: 'boomball', count: 2 };
  const id = pick(rng, CONSUMABLE_TABLE);
  const count = id === 'bandage' ? 5 : id === 'minishield' ? 3 : 1;
  return { kind: 'consumable', id, count };
}

export function ammoFor(weaponId, mult = 1) {
  const a = WEAPONS[weaponId].ammo;
  return { kind: 'ammo', id: a, count: Math.round(AMMO[a].drop * mult) };
}

/** Floor loot spawn: one or two items. */
export function rollFloor(rng) {
  const r = rng();
  if (r < 0.45) {
    const w = rollWeapon(rng, false);
    return [w, ammoFor(w.id)];
  }
  if (r < 0.72) return [rollConsumable(rng)];
  if (r < 0.8) return [rollMod(rng)];
  if (r < 0.88) return [{ kind: 'coin', id: 'bucks', count: 15 + Math.floor(rng() * 4) * 5 }];
  const ids = Object.keys(AMMO);
  const id = ids[Math.floor(rng() * ids.length)];
  return [{ kind: 'ammo', id, count: AMMO[id].drop }];
}

export function rollChest(rng) {
  const w = rollWeapon(rng, true);
  const out = [w, ammoFor(w.id, 1.5), rollConsumable(rng)];
  const mats = ['wood', 'brick', 'metal'];
  out.push({ kind: 'mat', id: mats[Math.floor(rng() * 3)], count: 30 });
  out.push({ kind: 'coin', id: 'bucks', count: 20 + Math.floor(rng() * 5) * 5 });
  if (rng() < 0.35) out.push(rollMod(rng));
  return out;
}

export function rollSupply(rng) {
  const w = makeWeapon(pick(rng, [['ar', 3], ['sniper', 2], ['launcher', 2], ['shotgun', 2]]), rng() < 0.5 ? 3 : 4);
  return [w, ammoFor(w.id, 2), { kind: 'consumable', id: 'bigshield', count: 2 }, { kind: 'mat', id: 'metal', count: 80 }, { kind: 'coin', id: 'bucks', count: 100 }, rollMod(rng)];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
