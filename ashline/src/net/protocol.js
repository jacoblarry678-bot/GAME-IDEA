/**
 * Online protocol shared by the dedicated server and the browser client.
 *
 * Transport: one WebSocket per player, JSON messages { t: type, ... }.
 *   client → server: hello, ready, cmd (batched inputs), respawn, ping, leave
 *   server → client: welcome, reject, roster, snap, newMatch, pong, bye
 *
 * The server is authoritative: clients send only inputs (movement, aim,
 * buttons). Positions, hits, damage, scores and objectives come from the
 * server simulation. Events that reference combatants are sent with ids.
 */
import { WEAPONS, EQUIPMENT } from '../data/weapons.js';
import { sanitizeBuild } from '../data/attachments.js';
import { PERKS, DEFAULT_PERKS } from '../data/perks.js';

export const PROTOCOL_VERSION = 2; // 2: Battle Royale state, loot, interact bit, weather
export const DEFAULT_PORT = 4190;
export const TICK_HZ = 60;
export const SNAP_HZ = 20;
export const INTERP_DELAY = 0.1; // remote players are drawn this far in the past (s)
export const MAX_CMD_DT = 0.05;

/** Command fields carried per input frame. */
export const CMD_KEYS = ['moveX', 'moveZ', 'sprint', 'crouch', 'jump', 'fire', 'ads', 'reload', 'swap', 'swapTo', 'melee', 'lethal', 'tactical', 'support', 'yaw', 'pitch'];
const BOOL = new Set(['sprint', 'crouch', 'jump', 'fire', 'ads', 'reload', 'swap', 'melee', 'lethal', 'tactical']);
const SUPPORT_IDS = new Set(['recon', 'supply', 'strike']);

export function packCmd(seq, dt, cmd, vt) {
  return [seq, r3(dt), r3(cmd.moveX), r3(cmd.moveZ), bits(cmd), cmd.swapTo, cmd.support || 0, r4(cmd.yaw), r4(cmd.pitch), r3(vt)];
}
function bits(c) {
  return (c.sprint ? 1 : 0) | (c.crouch ? 2 : 0) | (c.jump ? 4 : 0) | (c.fire ? 8 : 0) | (c.ads ? 16 : 0) | (c.reload ? 32 : 0) | (c.swap ? 64 : 0) | (c.melee ? 128 : 0) | (c.lethal ? 256 : 0) | (c.tactical ? 512 : 0) | (c.interact ? 1024 : 0);
}

/** Validate and decode one packed command (server side). Returns null when malformed. */
export function unpackCmd(a) {
  if (!Array.isArray(a) || a.length < 10) return null;
  const [seq, dt, mx, mz, b, swapTo, support, yaw, pitch, vt] = a;
  if (![seq, dt, mx, mz, b, swapTo, yaw, pitch, vt].every(Number.isFinite)) return null;
  return {
    seq: seq | 0,
    dt: clamp(dt, 0, MAX_CMD_DT),
    vt,
    cmd: {
      moveX: clamp(mx, -1, 1), moveZ: clamp(mz, -1, 1),
      sprint: !!(b & 1), crouch: !!(b & 2), jump: !!(b & 4), fire: !!(b & 8), ads: !!(b & 16), reload: !!(b & 32), swap: !!(b & 64), melee: !!(b & 128), lethal: !!(b & 256), tactical: !!(b & 512), interact: !!(b & 1024),
      swapTo: swapTo === 0 || swapTo === 1 ? swapTo : -1,
      support: SUPPORT_IDS.has(support) ? support : null,
      yaw: wrapAngle(yaw), pitch: clamp(pitch, -1.5, 1.5),
    },
  };
}

// ------------------------------------------------------------------ entities
const STANCES = ['stand', 'crouch', 'slide'];

/** Compact per-combatant state for snapshots. */
export function packEntity(c) {
  const f = (c.alive ? 1 : 0) | (c.grounded ? 2 : 0) | (c.sprinting ? 4 : 0) | (c.mantle ? 8 : 0) | (c.weapon?.reloading ? 16 : 0) | (c.spawnProtectT > 0 ? 32 : 0);
  return [c.id, r3(c.x), r3(c.y), r3(c.z), r4(c.yaw), r4(c.pitch), r2(c.vx), r2(c.vy), r2(c.vz), f, STANCES.indexOf(c.stance), Math.max(0, Math.ceil(c.health)), c.cur, r2(c.adsT), r2(c.swapT), r2(c.meleeT), r2(c.throwT), c.throwKind || 0, c.loadout.primary, c.loadout.secondary, c.gunLevel || 0];
}

export function unpackEntity(a) {
  return {
    id: a[0], x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5], vx: a[6], vy: a[7], vz: a[8],
    alive: !!(a[9] & 1), grounded: !!(a[9] & 2), sprinting: !!(a[9] & 4), mantle: !!(a[9] & 8), reloading: !!(a[9] & 16), protect: !!(a[9] & 32),
    stance: STANCES[a[10]] || 'stand', health: a[11], cur: a[12], adsT: a[13], swapT: a[14], meleeT: a[15], throwT: a[16], throwKind: a[17] || null,
    primary: a[18], secondary: a[19], gunLevel: a[20],
  };
}

/** Roster entry: identity and loadout (sent when someone joins/leaves or loadouts change). */
export function rosterEntry(c) {
  return { id: c.id, name: c.name, team: c.team, isBot: c.isBot, human: !!c.net, loadout: { ...c.loadout, builds: c.loadout.builds || {} }, look: c.look || null, ping: c.net?.ping ?? null };
}

// ------------------------------------------------------------------ events
const SKIP_KEYS = new Set(['box', 'brain', 'used', 'time']);

function isCombatant(v) { return v && typeof v === 'object' && v.stats && v.cmd && typeof v.team === 'number'; }

/** Serialize a match event: combatants become { $c: id }, definitions become their id. */
export function serEvent(e, depth = 0) {
  if (e === null || e === undefined) return e;
  if (typeof e === 'number') return Number.isFinite(e) ? r3(e) : 0;
  if (typeof e !== 'object') return typeof e === 'function' ? undefined : e;
  if (isCombatant(e)) return { $c: e.id };
  if (depth > 4) return undefined;
  if (Array.isArray(e)) return e.map((v) => serEvent(v, depth + 1));
  if (e instanceof Set || e instanceof Map) return undefined;
  const out = {};
  for (const k of Object.keys(e)) {
    if (SKIP_KEYS.has(k)) continue;
    const v = e[k];
    if (k === 'def' && v && typeof v === 'object') { out.def = v.id ? { id: v.id } : undefined; continue; }
    const s = serEvent(v, depth + 1);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

/** Rebuild references on the client. `find(id)` returns the local combatant or null. */
export function deserEvent(e, find) {
  if (e === null || typeof e !== 'object') return e;
  if (Array.isArray(e)) return e.map((v) => deserEvent(v, find));
  if ('$c' in e && Object.keys(e).length === 1) return find(e.$c);
  const out = {};
  for (const k of Object.keys(e)) out[k] = deserEvent(e[k], find);
  return out;
}

// ------------------------------------------------------------------ validation
/** Clean a player name: printable, trimmed, 2–16 chars. */
export function sanitizeName(n) {
  const s = String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  return s.length >= 2 ? s : 'Player';
}

/**
 * Validate a client loadout. Progression lives on each player's device, so the
 * server cannot verify unlocks; it only enforces that every id exists, fits
 * its slot and that attachment builds are legal for the weapon.
 */
export function sanitizeLoadout(lo) {
  lo = lo && typeof lo === 'object' ? lo : {};
  const primary = WEAPONS[lo.primary]?.slot === 'primary' ? lo.primary : 'ar_kv7';
  const secondary = WEAPONS[lo.secondary]?.slot === 'secondary' ? lo.secondary : 'pistol_warden';
  const lethal = EQUIPMENT[lo.lethal]?.slot === 'lethal' ? lo.lethal : 'frag';
  const tactical = EQUIPMENT[lo.tactical]?.slot === 'tactical' ? lo.tactical : 'smoke';
  const perks = DEFAULT_PERKS.map((d, i) => (PERKS[lo.perks?.[i]]?.slot === i + 1 ? lo.perks[i] : d));
  const builds = {};
  for (const id of [primary, secondary]) builds[id] = sanitizeBuild(WEAPONS[id], lo.builds?.[id]);
  return { primary, secondary, lethal, tactical, perks, builds };
}

/** Cosmetic look ids only (visual). Unknown ids are dropped by the client renderer. */
export function sanitizeLook(l) {
  if (!l || typeof l !== 'object') return null;
  const str = (v) => (typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v) ? v : null);
  return { operator: str(l.operator), outfit: str(l.outfit), finish: str(l.finish), emblem: str(l.emblem) };
}

export function r2(v) { return Math.round(v * 100) / 100; }
export function r3(v) { return Math.round(v * 1000) / 1000; }
export function r4(v) { return Math.round(v * 10000) / 10000; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function wrapAngle(a) { a %= Math.PI * 2; return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a; }
