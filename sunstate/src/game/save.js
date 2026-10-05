/**
 * Versioned save game in localStorage, with a backup of the previous save,
 * validation of every field (bad data falls back to safe defaults instead of
 * breaking the game), and migration hooks for future versions.
 *
 * Owned vehicles are saved by persistent id, so loading moves the existing
 * starting cars instead of spawning duplicates.
 */
import { storage } from '../core/storage.js';
import { VEHICLES } from '../data/vehicles.js';
import { WEAPONS } from '../data/weapons.js';
import { MISSIONS } from './missions.js';

export const SAVE_KEY = 'sunstate.save';
export const SAVE_VERSION = 1;

const num = (v, def, min = -Infinity, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def);

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    savedAt: null,
    money: 350,
    hour: 17.6,
    player: { health: 100, armor: 0, weapons: ['fists', 'pistol'], current: 'fists', ammo: { pistol: { mag: 12, reserve: 36 } } },
    missions: { completed: [] },
    vehicles: [],
    stats: { robberies: 0, escapes: 0, busted: 0, wasted: 0, distanceDriven: 0 },
  };
}

/** Clean arbitrary parsed JSON into a valid save. */
export function sanitizeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const migrated = migrate(raw);
  if (!migrated) return d;
  d.savedAt = typeof migrated.savedAt === 'string' ? migrated.savedAt : null;
  d.money = Math.round(num(migrated.money, d.money, 0, 1e9));
  d.hour = num(migrated.hour, d.hour, 0, 23.99);
  const p = migrated.player || {};
  d.player.health = num(p.health, 100, 1, 100);
  d.player.armor = num(p.armor, 0, 0, 100);
  if (Array.isArray(p.weapons)) {
    const w = p.weapons.filter((id) => WEAPONS[id]);
    d.player.weapons = [...new Set(['fists', ...w])];
  }
  d.player.current = d.player.weapons.includes(p.current) ? p.current : 'fists';
  d.player.ammo = {};
  for (const id of d.player.weapons) {
    if (WEAPONS[id].melee) continue;
    const a = p.ammo?.[id] || {};
    d.player.ammo[id] = { mag: Math.round(num(a.mag, WEAPONS[id].mag, 0, WEAPONS[id].mag)), reserve: Math.round(num(a.reserve, 24, 0, WEAPONS[id].maxReserve)) };
  }
  if (Array.isArray(migrated.missions?.completed)) d.missions.completed = [...new Set(migrated.missions.completed.filter((id) => MISSIONS[id]))];
  if (Array.isArray(migrated.vehicles)) {
    const seen = new Set();
    for (const v of migrated.vehicles) {
      if (!v || typeof v.id !== 'string' || seen.has(v.id) || !VEHICLES[v.model]) continue;
      seen.add(v.id);
      d.vehicles.push({ id: v.id, model: v.model, color: Math.round(num(v.color, 0xffffff, 0, 0xffffff)), health: num(v.health, 1000, 0, 1000), x: num(v.x, null), z: num(v.z, null), yaw: num(v.yaw, 0) });
    }
  }
  for (const k of Object.keys(d.stats)) d.stats[k] = num(migrated.stats?.[k], 0, 0);
  return d;
}

function migrate(raw) {
  if (raw.version === SAVE_VERSION) return raw;
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION) return null; // from a newer build: ignore
  return raw; // v0 → v1: same shape
}

export function loadSave() {
  const raw = storage.get(SAVE_KEY);
  if (!raw) return null;
  const s = sanitizeSave(raw);
  return s.savedAt ? s : null;
}

export function hasSave() { return !!loadSave(); }

export function writeSave(data) {
  const prev = storage.get(SAVE_KEY);
  if (prev) storage.set(SAVE_KEY + '.backup', prev);
  const s = sanitizeSave({ ...data, version: SAVE_VERSION, savedAt: new Date().toISOString() });
  return storage.set(SAVE_KEY, s) ? s : null;
}

export function deleteSave() { storage.remove(SAVE_KEY); }

/** Snapshot the live game into save data. */
export function snapshot(game) {
  const p = game.player, inv = p.controller.inventory;
  return {
    money: game.economy.money,
    hour: game.engine.time.hour,
    player: { health: Math.max(50, p.health), armor: p.armor, weapons: inv.weapons, current: inv.current, ammo: JSON.parse(JSON.stringify(inv.ammo)) },
    missions: { completed: [...game.missions.completed] },
    vehicles: game.vehicles.filter((v) => v.owner === 'player' && v.persistentId && !v.sunk).map((v) => ({ id: v.persistentId, model: v.modelId, color: v.color, health: Math.max(300, v.health), x: v.pos.x, z: v.pos.z, yaw: v.yaw })),
    stats: { ...game.stats, distanceDriven: Math.round(game.stats.distanceDriven + p.controller.stats.distanceDriven) },
  };
}

/** Apply save data to a freshly created game (player stands at the safehouse). */
export function applySave(game, s) {
  game.economy.money = s.money;
  game.engine.time.hour = s.hour;
  const p = game.player;
  p.health = s.player.health; p.armor = s.player.armor;
  const inv = p.controller.inventory;
  inv.weapons = [...s.player.weapons]; inv.current = s.player.current; inv.ammo = JSON.parse(JSON.stringify(s.player.ammo));
  game.missions.completed = new Set(s.missions.completed);
  Object.assign(game.stats, s.stats);
  for (const sv of s.vehicles) {
    let v = game.vehicles.find((x) => x.persistentId === sv.id);
    const inWorld = sv.x !== null && sv.z !== null && !game.world.isWater(sv.x, sv.z);
    if (!v) {
      v = game.addVehicle(sv.model, inWorld ? sv.x : 0, inWorld ? sv.z : 0, sv.yaw, sv.color);
      v.owner = 'player'; v.persistentId = sv.id;
    }
    if (inWorld) { v.pos.set(sv.x, game.world.ground(sv.x, sv.z, 3), sv.z); v.yaw = sv.yaw; }
    v.health = sv.health;
    v.color = sv.color;
    v.mesh.parts.paint.color.setHex(sv.color);
  }
}
