/**
 * Battle Royale (mini): up to 10 players, everyone for themselves, no
 * respawns. Everyone drops in spread across the map with a pistol and an
 * axe, loots weapons, ammo, medkits and gear, and a shrinking safe zone
 * forces fights. Last one standing wins; if the clock runs out, the survivor
 * with the most eliminations wins.
 *
 * The rules run inside the Match, so offline play, the dedicated server and
 * the headless tests share them. State lives in `match.br` and `match.loot`.
 */
import { WEAPONS } from '../data/weapons.js';

export const START_LOADOUT = { primary: 'pistol_warden', secondary: 'melee_axe' };

/** Loot table (stable ids). Tier decides what bots prefer to pick up. */
export const LOOT_WEAPONS = [
  ['smg_vesper', 9, 2], ['smg_wasp', 7, 2], ['smg_hollow', 6, 2], ['ar_kv7', 9, 3], ['ar_tarn', 7, 3], ['ar_meridian', 5, 3], ['ar_bastion', 5, 3],
  ['sg_brakk', 5, 2], ['sg_rook', 4, 2], ['dmr_sentinel', 4, 3], ['sr_longreach', 3, 3], ['lmg_drover', 3, 3], ['lmg_anvil', 2, 3], ['pistol_grizzly', 4, 1],
];
const TIER = Object.fromEntries(LOOT_WEAPONS.map(([id, , t]) => [id, t]));
export const weaponTier = (id) => TIER[id] ?? (WEAPONS[id]?.class === 'pistol' ? 0.5 : 1);
export const LOOT_KINDS = ['weapon', 'ammo', 'medkit', 'gear'];
export const LOOT_NAMES = { ammo: 'Ammo Box', medkit: 'Medkit', gear: 'Grenade Pack' };

/** Zone phases at the default 8-minute clock (scaled to the match length). */
const PHASES = [
  { wait: 50, shrink: 35, k: 0.62, dps: 2 },
  { wait: 40, shrink: 30, k: 0.58, dps: 4 },
  { wait: 35, shrink: 25, k: 0.5, dps: 7 },
  { wait: 30, shrink: 22, k: 0.42, dps: 10 },
  { wait: 25, shrink: 20, k: 0, dps: 15 },
];
const GRACE = 30; // drop-in: weapons cold, everyone loots
const REGEN_CAP = 60; // natural regen stops here; medkits heal to full
const PICK_R = 1.5;
const MAX_LOOT = 90;

const rand = (rng, a, b) => a + rng() * (b - a);
const zoneR = (z) => z.r0 + (z.r1 - z.r0) * zoneK(z);
function zoneK(z) { return z.state === 'shrink' ? Math.min(1, 1 - z.t / z.dur) : z.state === 'wait' ? 0 : 1; }

function pickWeighted(rng, list) {
  let total = 0;
  for (const it of list) total += it[1];
  let r = rng() * total;
  for (const it of list) { r -= it[1]; if (r <= 0) return it[0]; }
  return list[0][0];
}

export function brZone(match) {
  if (match.br.cur) return match.br.cur; // client mirror of a server match
  const z = match.br.zone;
  const k = zoneK(z);
  return { x: z.x0 + (z.x1 - z.x0) * k, z: z.z0 + (z.z1 - z.z0) * k, r: zoneR(z) };
}

export function outsideZone(match, c) {
  const z = brZone(match);
  return Math.hypot(c.x - z.x, c.z - z.z) > z.r;
}

function aliveList(match) { return match.combatants.filter((c) => c.alive); }

/** New loot item (weapon items carry their own ammo). */
function addLoot(match, kind, x, y, z, wid = null, mag = 0, reserve = 0) {
  if (match.loot.length >= MAX_LOOT) {
    // drop the oldest ammo/gear first so weapons stay around
    const i = match.loot.findIndex((l) => l.kind !== 'weapon');
    match.loot.splice(i >= 0 ? i : 0, 1);
  }
  const it = { id: match.br.nextLoot++, kind, x, y, z, wid, mag, reserve };
  match.loot.push(it);
  match.br.lootVer++;
  return it;
}

function removeLoot(match, it) {
  const i = match.loot.indexOf(it);
  if (i >= 0) { match.loot.splice(i, 1); match.br.lootVer++; }
}

function scatterLoot(match) {
  const rng = match.rng, nav = match.nav;
  const placed = [];
  const spot = () => {
    for (let tries = 0; tries < 40; tries++) {
      const c = nav.center(nav.randomCell(rng));
      if (!Number.isFinite(c.y)) continue;
      if (placed.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 5)) continue;
      placed.push(c);
      return c;
    }
    return nav.center(nav.randomCell(rng));
  };
  const counts = { weapon: 18, ammo: 10, medkit: 6, gear: 4 };
  for (const [kind, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      const p = spot();
      if (kind === 'weapon') {
        const wid = pickWeighted(rng, LOOT_WEAPONS), d = WEAPONS[wid];
        addLoot(match, kind, p.x, p.y, p.z, wid, d.mag, d.mag * 2);
      } else addLoot(match, kind, p.x, p.y, p.z);
    }
  }
}

/** Give a combatant a new primary weapon (its ammo comes with it). */
export function equipPrimary(match, c, wid, mag, reserve) {
  const old = c.weapons[0];
  c.loadout = { ...c.loadout, primary: wid };
  c.applyLoadoutWeapon(0, wid);
  const w = c.weapons[0];
  w.mag = Math.min(w.def.mag, mag);
  w.reserve = Math.min(w.def.reserve, reserve);
  c.cur = 0;
  c.swapT = 0.45; c.adsT = 0;
  return old;
}

function pickUp(match, c, it) {
  if (it.kind === 'weapon') {
    const old = equipPrimary(match, c, it.wid, it.mag, it.reserve);
    removeLoot(match, it);
    if (old && !old.def.melee) addLoot(match, 'weapon', c.x + 0.6, c.y, c.z + 0.3, old.def.id, old.mag, old.reserve);
  } else if (it.kind === 'ammo') {
    for (const w of c.weapons) if (!w.def.melee) w.reserve = Math.min(w.def.reserve, w.reserve + w.def.mag * 2);
    removeLoot(match, it);
  } else if (it.kind === 'medkit') {
    c.health = 100;
    removeLoot(match, it);
  } else if (it.kind === 'gear') {
    c.lethal.count = Math.min(2, c.lethal.count + 1);
    c.tactical.count = Math.min(2, c.tactical.count + 1);
    removeLoot(match, it);
  }
  match.emit({ type: 'loot', c, kind: it.kind, wid: it.wid });
}

/** Does this item help this combatant right now (auto-pickups)? */
function wants(c, it) {
  if (it.kind === 'ammo') return c.weapons.some((w) => !w.def.melee && w.reserve < w.def.reserve * 0.8);
  if (it.kind === 'medkit') return c.health < 100;
  if (it.kind === 'gear') return c.lethal.count < 2 || c.tactical.count < 2;
  return false;
}

/** Nearest weapon on the ground a combatant could swap to (for the prompt). */
export function nearbyWeapon(match, c) {
  let best = null, bd = PICK_R;
  for (const it of match.loot || []) {
    if (it.kind !== 'weapon') continue;
    const d = Math.hypot(it.x - c.x, it.z - c.z);
    if (d < bd && Math.abs(it.y - c.y) < 1.6) { bd = d; best = it; }
  }
  return best;
}

function place(match, c, at) {
  if (match.br.place.has(c.team)) return;
  match.br.place.set(c.team, at);
}

function finish(match, winner, reason) {
  if (winner) place(match, winner, 1);
  // anyone still unplaced (time-up) ranks by kills, then health
  const rest = aliveList(match).filter((c) => !match.br.place.has(c.team)).sort((a, b) => b.stats.kills - a.stats.kills || b.health - a.health);
  let next = 1 + (winner ? 1 : 0);
  for (const c of rest) place(match, c, next++);
  match.end(winner ? winner.team : -1, reason);
}

export const BATTLE_ROYALE = {
  id: 'br', name: 'Battle Royale (mini)', short: 'BR', teams: false, playable: true, scoreLabel: 'kills', br: true,
  blurb: 'Up to 10 players, no respawns. Drop in with a pistol, loot during a 30-second weapons-cold phase, then stay inside the shrinking zone. Last one standing wins.',
  defaults: { scoreLimit: 0, timeLimit: 8 },
  limits: { timeLimit: [5, 12, 1] },
  maxPlayers: 10,
  respawnDelay: 9999,

  setup(match) {
    const B = match.map.def.bounds, rng = match.rng;
    const cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2;
    const r0 = Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ) / 2 + 4;
    const scale = Math.max(0.6, (match.settings.timeLimit * 60) / 480);
    match.regenCap = REGEN_CAP;
    match.ceasefireT = GRACE;
    match.loot = [];
    match.br = {
      phase: 0, scale, nextLoot: 1, lootVer: 0, place: new Map(), total: match.combatants.length,
      zone: { state: 'wait', t: PHASES[0].wait * scale, dur: PHASES[0].wait * scale, x0: cx, z0: cz, r0, x1: cx, z1: cz, r1: r0 },
      dmgT: 0,
    };
    this.planNext(match);
    for (const c of match.combatants) c.applyLoadout(this.loadoutFor(match, c));
    scatterLoot(match);
  },

  /** Choose the next circle inside the current one, centred on walkable ground. */
  planNext(match) {
    const br = match.br, z = br.zone, ph = PHASES[br.phase], rng = match.rng, nav = match.nav;
    const cur = { x: z.x1, z: z.z1, r: z.r1 };
    const r1 = Math.max(0, cur.r * ph.k);
    let nx = cur.x, nz = cur.z;
    for (let tries = 0; tries < 30; tries++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * Math.max(0, cur.r - r1) * (br.phase === 0 ? 0.35 : 0.8);
      const px = cur.x + Math.cos(a) * d, pz = cur.z + Math.sin(a) * d;
      const i = nav.nearest(px, pz, null, 4);
      if (i < 0) continue;
      const c = nav.center(i);
      if (Math.hypot(c.x - cur.x, c.z - cur.z) + r1 <= cur.r + 0.01) { nx = c.x; nz = c.z; break; }
    }
    br.next = { x: nx, z: nz, r: r1 };
  },

  loadoutFor(match, c) {
    return { ...c.loadout, ...START_LOADOUT, builds: {}, noEquipment: true };
  },

  /** Dispersed drop-in: as far as possible from everyone already placed. */
  spawnAt(match, c) {
    const nav = match.nav, rng = match.rng;
    let best = null, bs = -1;
    for (let i = 0; i < 60; i++) {
      const p = nav.center(nav.randomCell(rng));
      if (!Number.isFinite(p.y)) continue;
      let minD = 60;
      for (const o of match.combatants) if (o !== c && o.alive && o._placedBR) minD = Math.min(minD, Math.hypot(o.x - p.x, o.z - p.z));
      if (minD > bs) { bs = minD; best = p; }
    }
    c._placedBR = true;
    const B = match.map.def.bounds;
    const yaw = Math.atan2(-((B.minX + B.maxX) / 2 - best.x), -((B.minZ + B.maxZ) / 2 - best.z));
    return { x: best.x, y: best.y, z: best.z, yaw };
  },

  update(match, dt) {
    const br = match.br, z = br.zone;
    if (match.ceasefireT > 0) {
      match.ceasefireT -= dt;
      if (match.ceasefireT <= 0) { match.ceasefireT = 0; match.emit({ type: 'objective', kind: 'weaponsHot' }); }
    }
    // zone clock
    z.t -= dt;
    if (z.t <= 0) {
      if (z.state === 'wait') {
        const ph = PHASES[br.phase];
        z.state = 'shrink'; z.dur = z.t = ph.shrink * br.scale;
        z.x1 = br.next.x; z.z1 = br.next.z; z.r1 = br.next.r;
        match.emit({ type: 'objective', kind: 'zoneShrink', phase: br.phase });
      } else if (z.state === 'shrink') {
        z.x0 = z.x1; z.z0 = z.z1; z.r0 = z.r1;
        br.phase++;
        if (br.phase < PHASES.length) {
          z.state = 'wait'; z.dur = z.t = PHASES[br.phase].wait * br.scale;
          this.planNext(match);
          match.emit({ type: 'objective', kind: 'zoneNext', phase: br.phase });
        } else { z.state = 'final'; z.t = Infinity; br.next = { x: z.x0, z: z.z0, r: 0 }; }
      }
    }
    // zone damage, once per second
    br.dmgT += dt;
    if (br.dmgT >= 1) {
      br.dmgT -= 1;
      const dps = PHASES[Math.min(br.phase, PHASES.length - 1)].dps;
      const zone = brZone(match);
      for (const c of match.combatants) {
        if (!c.alive || Math.hypot(c.x - zone.x, c.z - zone.z) <= zone.r) continue;
        match.applyDamage(c, null, dps, { weapon: 'zone', kind: 'zone', zone: 'torso' });
        if (match.state !== 'live') return;
      }
    }
    // pickups
    for (const c of match.combatants) {
      if (!c.alive) continue;
      const wantSwap = c.interactReq != null && match.time - c.interactReq < 0.35 && !(c.pickupT > match.time);
      for (const it of match.loot) {
        if (Math.abs(it.x - c.x) > PICK_R || Math.abs(it.z - c.z) > PICK_R || Math.abs(it.y - c.y) > 1.6) continue;
        if (Math.hypot(it.x - c.x, it.z - c.z) > PICK_R) continue;
        if (it.kind === 'weapon') {
          const botWants = c.brain && weaponTier(it.wid) > weaponTier(c.weapons[0].def.id) && !c.busy;
          if (wantSwap || botWants) { c.interactReq = null; c.pickupT = match.time + 0.5; pickUp(match, c, it); break; }
        } else if (wants(c, it)) { pickUp(match, c, it); break; }
      }
    }
  },

  onKill(match, killer, victim) {
    if (killer && killer !== victim) match.teamScores[killer.team] = killer.stats.kills;
    const alive = aliveList(match);
    place(match, victim, alive.length + 1);
    // the victim's gun and some ammo hit the ground
    const w = victim.weapons[0];
    if (w && !w.def.melee) addLoot(match, 'weapon', victim.x, victim.y, victim.z, w.def.id, w.mag, w.reserve);
    if (match.rng() < 0.5) addLoot(match, 'ammo', victim.x + 0.8, victim.y, victim.z - 0.4);
    match.emit({ type: 'objective', kind: 'eliminated', c: victim, place: alive.length + 1, alive: alive.length });
    if (alive.length <= 1) finish(match, alive[0] || null, 'last');
  },

  onTimeUp(match) {
    const alive = aliveList(match).sort((a, b) => b.stats.kills - a.stats.kills || b.health - a.health);
    finish(match, alive[0] || null, 'time');
  },

  canRespawn() { return false; },
  spawnScore() { return 0; },

  /** Where bots go when nothing is urgent: loot they need, else into the zone. */
  botGoal(match, bot) {
    const c = bot.c;
    let best = null, bs = -Infinity;
    for (const it of match.loot) {
      const d = Math.hypot(it.x - c.x, it.z - c.z);
      if (d > 45) continue;
      let s = -d;
      if (it.kind === 'weapon') { const gain = weaponTier(it.wid) - weaponTier(c.weapons[0].def.id); if (gain <= 0) continue; s += gain * 18; }
      else if (wants(c, it)) s += it.kind === 'medkit' && c.health < 60 ? 25 : 6;
      else continue;
      // skip loot another bot is already heading for
      if (match.combatants.some((o) => o !== c && o.brain && o.alive && o.brain.goalName === 'loot ' + it.id)) s -= 30;
      if (s > bs) { bs = s; best = it; }
    }
    if (best && !outsidePoint(match, best.x, best.z)) return { x: best.x, z: best.z, name: 'loot ' + best.id, hold: 0.3 };
    // hold a spot inside the (next) circle, away from everyone else
    const n = match.br.next, zz = brZone(match);
    const tgt = n.r > 4 ? n : zz;
    let bp = null, bd = -1;
    for (let i = 0; i < 10; i++) {
      const a = match.rng() * Math.PI * 2, d = Math.sqrt(match.rng()) * Math.max(2, tgt.r * 0.85);
      const x = tgt.x + Math.cos(a) * d, z = tgt.z + Math.sin(a) * d;
      let minD = 80;
      for (const o of match.combatants) if (o !== c && o.alive) minD = Math.min(minD, Math.hypot(o.x - x, o.z - z));
      const moveCost = Math.hypot(x - c.x, z - c.z) * 0.15;
      if (minD - moveCost > bd) { bd = minD - moveCost; bp = { x, z }; }
    }
    return { x: bp.x, z: bp.z, name: 'zone', hold: 6 + match.rng() * 8 };
  },

  /** Out of the zone (or about to be): run for the circle. */
  botUrgent(match, bot) {
    const c = bot.c, z = match.br.zone;
    const cur = brZone(match);
    const dCur = Math.hypot(c.x - cur.x, c.z - cur.z);
    let tgt = null;
    if (dCur > cur.r - 2) tgt = cur;
    else if (z.state === 'wait' && z.t < 15 && match.br.next.r > 0 && Math.hypot(c.x - match.br.next.x, c.z - match.br.next.z) > match.br.next.r - 2) tgt = match.br.next;
    if (!tgt) return null;
    const dx = c.x - tgt.x, dz = c.z - tgt.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, Math.min(tgt.r * 0.5, d - 1)) / d;
    return { x: tgt.x + dx * k, z: tgt.z + dz * k, name: 'zone run', sprint: true };
  },

  goalStale(match, bot, name) {
    if (name.startsWith('loot ')) { const id = Number(name.slice(5)); return !match.loot.some((l) => l.id === id); }
    return false;
  },
};

function outsidePoint(match, x, z) {
  const zz = brZone(match);
  return Math.hypot(x - zz.x, z - zz.z) > zz.r - 1;
}

/** Network form of the BR state: zone + next circle + phase + placements. */
export function packBR(match) {
  const br = match.br, z = brZone(match), r2 = (v) => Math.round(v * 100) / 100;
  return [br.phase, r2(z.x), r2(z.z), r2(z.r), r2(br.next.x), r2(br.next.z), r2(br.next.r), br.zone.state === 'final' ? -1 : r2(br.zone.t), br.zone.state === 'shrink' ? 1 : br.zone.state === 'final' ? 2 : 0, br.lootVer, [...br.place], r2(match.ceasefireT || 0)];
}
export function packLoot(match) {
  const r2 = (v) => Math.round(v * 100) / 100;
  return match.loot.map((l) => [l.id, LOOT_KINDS.indexOf(l.kind), l.wid || 0, r2(l.x), r2(l.y), r2(l.z)]);
}

/** Client side: apply packBR / packLoot output to a NetMatch. */
export function unpackBR(match, b, lo) {
  if (Array.isArray(b)) {
    const br = match.br || (match.br = { zone: {}, place: new Map(), next: {} });
    br.phase = b[0];
    br.cur = { x: b[1], z: b[2], r: b[3] };
    br.next = { x: b[4], z: b[5], r: b[6] };
    br.zone = { state: ['wait', 'shrink', 'final'][b[8]] || 'wait', t: b[7] < 0 ? Infinity : b[7] };
    br.lootVer = b[9];
    br.place = new Map(Array.isArray(b[10]) ? b[10] : []);
    match.ceasefireT = b[11] || 0;
  }
  if (Array.isArray(lo)) match.loot = lo.map(([id, k, wid, x, y, z]) => ({ id, kind: LOOT_KINDS[k] || 'ammo', wid: wid || null, x, y, z }));
}
