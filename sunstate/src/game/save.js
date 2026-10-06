/**
 * Versioned save game in localStorage, with a backup of the previous save,
 * validation of every field (bad data falls back to safe defaults instead of
 * breaking the game), and migration hooks for future versions.
 *
 * Owned vehicles are saved by persistent id, so loading moves the existing
 * starting cars instead of spawning duplicates.
 *
 * v2 (Milestone 3): two protagonists, each with their own health, armour,
 * weapons/ammo, position and partner mode; money stays shared. v1 saves
 * migrate by giving their player data to Cal and defaults to Sol.
 */
import { storage } from '../core/storage.js';
import { VEHICLES } from '../data/vehicles.js';
import { WEAPONS } from '../data/weapons.js';
import { MISSIONS } from './missions.js';
import { PLACES } from '../world/district.js';
import { sanitizeMemory, defaultMemory } from './memory.js';

export const SAVE_KEY = 'sunstate.save';
export const SAVE_VERSION = 2;
export const CREW_IDS = ['cal', 'sol'];

const num = (v, def, min = -Infinity, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def);

function defaultMember() {
  return { health: 100, armor: 0, weapons: ['fists', 'pistol'], current: 'fists', ammo: { pistol: { mag: 12, reserve: 36 } }, x: null, z: null, yaw: 0, mode: 'wait' };
}

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    savedAt: null,
    money: 350,
    hour: 17.6,
    active: 'cal',
    crew: { cal: defaultMember(), sol: defaultMember() },
    missions: { completed: [] },
    memory: defaultMemory(),
    vehicles: [],
    stats: { robberies: 0, escapes: 0, busted: 0, wasted: 0, distanceDriven: 0 },
  };
}

function sanitizeMember(p) {
  const d = defaultMember();
  if (!p || typeof p !== 'object') return d;
  d.health = num(p.health, 100, 1, 100);
  d.armor = num(p.armor, 0, 0, 100);
  if (Array.isArray(p.weapons)) {
    const w = p.weapons.filter((id) => WEAPONS[id]);
    d.weapons = [...new Set(['fists', ...w])];
  }
  d.current = d.weapons.includes(p.current) ? p.current : 'fists';
  d.ammo = {};
  for (const id of d.weapons) {
    if (WEAPONS[id].melee) continue;
    const a = p.ammo?.[id] || {};
    d.ammo[id] = { mag: Math.round(num(a.mag, WEAPONS[id].mag, 0, WEAPONS[id].mag)), reserve: Math.round(num(a.reserve, 24, 0, WEAPONS[id].maxReserve)) };
  }
  d.x = num(p.x, null, -2000, 2000);
  d.z = num(p.z, null, -2000, 2000);
  if (d.x === null || d.z === null) { d.x = null; d.z = null; }
  d.yaw = num(p.yaw, 0, -100, 100);
  d.mode = ['follow', 'wait', 'player'].includes(p.mode) ? p.mode : 'wait';
  return d;
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
  d.active = CREW_IDS.includes(migrated.active) ? migrated.active : 'cal';
  for (const id of CREW_IDS) d.crew[id] = sanitizeMember(migrated.crew?.[id]);
  d.memory = sanitizeMemory(migrated.memory);
  if (Array.isArray(migrated.missions?.completed)) d.missions.completed = [...new Set(migrated.missions.completed.filter((id) => MISSIONS[id]))];
  if (Array.isArray(migrated.vehicles)) {
    const seen = new Set();
    for (const v of migrated.vehicles) {
      if (!v || typeof v.id !== 'string' || seen.has(v.id) || !VEHICLES[v.model]) continue;
      seen.add(v.id);
      d.vehicles.push({ id: v.id, model: v.model, plate: typeof v.plate === 'string' ? v.plate.slice(0, 10) : null, color: Math.round(num(v.color, 0xffffff, 0, 0xffffff)), health: num(v.health, 1000, 0, 1000), x: num(v.x, null), z: num(v.z, null), yaw: num(v.yaw, 0) });
    }
  }
  for (const k of Object.keys(d.stats)) d.stats[k] = num(migrated.stats?.[k], 0, 0);
  return d;
}

/** Bring older saves up to the current shape (or null if the save is from a newer build). */
export function migrate(raw) {
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION) return null; // from a newer build: ignore
  let out = raw;
  if (out.version < 2) {
    // v0/v1 → v2: the single player becomes Cal; Sol starts fresh at home
    out = { ...out, version: 2, active: 'cal', crew: { cal: { ...(out.player || {}), mode: 'player' }, sol: null } };
    delete out.player;
  }
  return out;
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
  const crew = game.crew;
  const members = {};
  for (const id of CREW_IDS) members[id] = crew.snapshotMember(crew.members[id]);
  const walked = crew.list.reduce((a, ch) => a + ch.pc.stats.distanceDriven, 0);
  return {
    money: game.economy.money,
    hour: game.engine.time.hour,
    active: crew.activeId,
    crew: members,
    missions: { completed: [...game.missions.completed] },
    memory: game.memory.snapshot(),
    vehicles: game.vehicles.filter((v) => v.owner === 'player' && v.persistentId && !v.sunk).map((v) => ({ id: v.persistentId, model: v.modelId, color: v.color, plate: v.plate, health: Math.max(300, v.health), x: v.pos.x, z: v.pos.z, yaw: v.yaw })),
    stats: { ...game.stats, distanceDriven: Math.round(game.stats.distanceDriven + walked) },
  };
}

/** A saved spot is usable if it's dry, reachable land and not inside anything. */
function usableSpot(game, x, z) {
  if (x === null || z === null) return false;
  const w = game.world;
  if (w.isWater(x, z)) return false;
  const y = w.ground(x, z, 3);
  return !w.collision.overlapsCircle(x, z, 0.35, y + 0.2, 1.5);
}

/** Apply save data to a freshly created game (the active protagonist stands at the safehouse). */
export function applySave(game, s) {
  game.economy.money = s.money;
  game.engine.time.hour = s.hour;
  const crew = game.crew;
  crew.setActive(s.active);
  const sp = PLACES.safehouse.spawn;
  for (const id of CREW_IDS) {
    const ch = crew.members[id], m = s.crew[id];
    let place = null;
    if (ch === game.player) place = { x: sp.x, z: sp.z, yaw: sp.rot };
    else if (m.mode === 'follow') place = { x: sp.x - Math.sin(sp.rot) * 1.6 + 1.0, z: sp.z - Math.cos(sp.rot) * 1.6, yaw: sp.rot };
    else if (usableSpot(game, m.x, m.z)) place = { x: m.x, z: m.z, yaw: m.yaw };
    crew.applyMember(ch, m, place);
    if (ch !== game.player) ch.partnerAI.setMode(m.mode === 'follow' ? 'follow' : 'wait');
  }
  game.cameraRig.snapBehind(sp.rot);
  game.missions.completed = new Set(s.missions.completed);
  game.memory.apply(s.memory);
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
    if (sv.plate) v.setPlate(sv.plate);
  }
}
