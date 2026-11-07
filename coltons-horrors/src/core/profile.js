// Player profile: currency, unlocks, inventory, loadouts and settings, saved in localStorage.
import { SURVIVORS, KILLERS, SURVIVOR_PERKS, KILLER_PERKS } from '../data.js';

const KEY = 'coltons-horrors-profile-v1';

function defaultProfile() {
  const equipped = {};
  for (const c of [...SURVIVORS, ...KILLERS]) equipped[c.id] = c.outfits[0].id;
  const ownedOutfits = [...SURVIVORS, ...KILLERS].map((c) => c.outfits[0].id);
  return {
    marrow: 12000,
    role: 'survivor',
    survivor: 'colton',
    killer: 'specter',
    opponent: 'random',
    ownedPerks: [
      ...SURVIVORS.map((s) => s.signature),
      ...KILLERS.flatMap((k) => k.signature),
      'lockbreaker', 'relentless',
    ],
    ownedOutfits,
    equipped,
    inventory: {
      flashlight: 2, medkit: 2, toolbox: 2, map: 1,
      wide_lens: 1, sterile_gauze: 1, socket_set: 1, creased_corner: 1,
      ring_fragment: 2, lake_silt: 1, cracked_glass: 2, dusty_cartridge: 1,
      off_rite: 1, whetstone: 1, iron_wedge: 1,
      off_ashgrove: 1, off_hollowpines: 1, off_stivo: 1, off_gravelpit: 1, off_lantern: 1, off_bonecharm: 1,
    },
    loadout: {
      survivor: { perks: ['adrenal_surge', 'steady_hands', null, null], item: 'flashlight', addons: [null, null], offering: null },
      killer: { perks: ['whispers', 'hook_rot', 'relentless', null], addons: { specter: [null, null], exe: [null, null], woodsman: [null, null] }, offering: null },
    },
    settings: {
      quality: 'auto', sensitivity: 1.0, invertY: false, volume: 0.8, music: 0.7,
      difficulty: 'normal', hints: true, fov: 80, showFps: false,
    },
    stats: { matches: 0, escapes: 0, sacrifices: 0, gens: 0, hooks: 0, kills: 0 },
    seenIntro: false,
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    const b = base[k];
    const s = saved[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) out[k] = merge(b, s);
    else if (s !== undefined) out[k] = s;
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaultProfile(), JSON.parse(raw));
  } catch (e) { /* storage unavailable */ }
  return defaultProfile();
}

export const profile = load();
// new characters and their signature perks are unlocked for older saves too
for (const k of KILLERS) for (const id of k.signature) if (!profile.ownedPerks.includes(id)) profile.ownedPerks.push(id);
for (const c of [...SURVIVORS, ...KILLERS]) if (!profile.ownedOutfits.includes(c.outfits[0].id)) profile.ownedOutfits.push(c.outfits[0].id);

export function saveProfile() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}

export function resetProfile() {
  const fresh = defaultProfile();
  for (const k of Object.keys(profile)) delete profile[k];
  Object.assign(profile, fresh);
  saveProfile();
}

export const ownsPerk = (id) => profile.ownedPerks.includes(id);
export const ownsOutfit = (id) => profile.ownedOutfits.includes(id);
export const countOf = (id) => profile.inventory[id] || 0;

export function addItem(id, n = 1) {
  profile.inventory[id] = Math.max(0, (profile.inventory[id] || 0) + n);
}

export function consume(id) {
  if (!id || !countOf(id)) return false;
  profile.inventory[id] -= 1;
  return true;
}

export function buy(kind, def) {
  if (profile.marrow < def.price) return false;
  if (kind === 'perk') {
    if (ownsPerk(def.id)) return false;
    profile.ownedPerks.push(def.id);
  } else if (kind === 'outfit') {
    if (ownsOutfit(def.id)) return false;
    profile.ownedOutfits.push(def.id);
  } else {
    addItem(def.id, 1);
  }
  profile.marrow -= def.price;
  saveProfile();
  return true;
}

export const ALL_SURVIVOR_PERK_IDS = SURVIVOR_PERKS.map((p) => p.id);
export const ALL_KILLER_PERK_IDS = KILLER_PERKS.map((p) => p.id);
