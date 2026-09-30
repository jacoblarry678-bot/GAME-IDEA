/**
 * Owner-only admin tools. Match tools act on the simulation this device runs
 * (solo, or online as the host), never on someone else's match, and a match
 * where they're used doesn't count for XP, rank or challenges. Progression
 * tools edit this device's saved progress.
 */

import * as THREE from 'three';
import { makeWeapon, MAT_MAX } from './items.js';
import { POIS, VAULT } from '../world/island.js';
import { save, xpForLevel, levelInfo } from '../core/save.js';
import { rankState, divisionMMR, PLACEMENT_MATCHES, TOP } from '../core/ranked.js';
import { superXP, CAP_XP } from '../core/supercharge.js';
import { dailyChallenges, CHALLENGES } from '../core/challenges.js';
import { CHARACTERS } from '../entities/characters.js';
import { pass, passTier, addPassXP, TIER_XP, PASS } from '../core/season.js';
import { setAllBadges } from '../core/badges.js';
import { EVENTS } from '../core/events.js';

export const PLACES = [...POIS.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z })), { id: 'vault', name: VAULT.name, x: VAULT.x, z: VAULT.z + 12 }];

/** Can the admin tools touch the current match from this device? */
export function canAdminMatch(g) {
  return !!(g && g.world && g.role !== 'client' && g.player);
}

function mark(g) {
  if (g.adminUsed) return;
  g.adminUsed = true;
  g.notifyAll(g.role === 'host' ? 'The host is using admin tools: this match won\'t count for XP, rank or challenges.' : 'Admin tools on: this match won\'t count for XP, rank or challenges.', '#ffd23f', 4);
}

/** Runs one match tool. Returns a short message for the panel. */
export function matchOp(g, op, arg) {
  if (!canAdminMatch(g)) return 'Admin match tools work in solo matches and matches you host.';
  const P = g.player;
  const A = (g.admin = g.admin || {});
  mark(g);
  switch (op) {
    case 'god':
      A.god = !A.god;
      return `God mode ${A.god ? 'ON: you take no damage' : 'off'}`;
    case 'heal':
      if (!P.alive) return 'You are out of the match.';
      if (P.downed) { P.downed = false; P.downHp = 0; }
      P.hp = 100;
      P.shield = 100;
      if (P.overshieldMax) P.overshield = P.overshieldMax;
      return 'Health and shields full';
    case 'loadout':
      g.debugLoadout();
      P.select(0);
      return 'Loadout given (rifle, pump, sniper, shields, Boom Balls, ammo, materials)';
    case 'mythic': {
      const give = [makeWeapon('ar', 5), makeWeapon('launcher', 5)];
      for (const it of give) {
        const left = P.addItem(it);
        if (left) g.loot.drop(left, P.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 3, 0));
      }
      P.ammo.medium = Math.max(P.ammo.medium, 300);
      P.ammo.rockets = Math.max(P.ammo.rockets, 12);
      return 'Mythic rifle and launcher given (dropped at your feet if your slots are full)';
    }
    case 'bucks':
      P.bucks += 500;
      return `+500 Benton Bucks (you have ${P.bucks})`;
    case 'mats':
      P.mats = { wood: MAT_MAX, brick: MAT_MAX, metal: MAT_MAX };
      return 'Materials maxed';
    case 'keycard': {
      const left = P.addItem({ kind: 'key', id: 'vault', count: 1 });
      if (left) g.loot.drop(left, P.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 3, 0));
      return 'Vault Keycard given';
    }
    case 'tp': {
      if (!P.alive || P.state === 'bus') return 'Jump out of the bus first.';
      let to = null;
      if (arg === 'marker') {
        if (!g.marker) return 'Set a marker on the full map (M) first.';
        to = { x: g.marker.x, z: g.marker.y, name: 'your map marker' };
      } else to = PLACES.find((p) => p.id === arg);
      if (!to) return 'Unknown place';
      if (P.vehicle) g.vehicles.exit(P);
      if (P.carrying) g.dropCarried(P);
      P.zip = null;
      P.pos.set(to.x, g.world.physics.groundAt(to.x, to.z, 200).y + 0.2, to.z);
      P.vel.set(0, 0, 0);
      P.state = 'air';
      P.ep = (P.ep | 0) + 1;
      return `Teleported to ${to.name}`;
    }
    case 'supply':
      g.loot.supplyDrop(P.pos.x + 3, P.pos.z + 3);
      return 'A supply drop is on its way down next to you';
    case 'vehicle': {
      const f = new THREE.Vector3(-Math.sin(g.controller.yaw), 0, -Math.cos(g.controller.yaw));
      const free = g.vehicles.list.filter((v) => v.alive && v.type === arg && !v.seats.some(Boolean));
      if (!free.length) return `No free ${arg === 'truck' ? 'truck' : 'kart'} left on the island`;
      free.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos));
      const v = free[0];
      const x = P.pos.x + f.x * 5, z = P.pos.z + f.z * 5;
      v.pos.set(x, g.world.physics.groundAt(x, z, P.pos.y + 3).y, z);
      v.yaw = g.controller.yaw;
      v.speed = 0;
      v.fuel = 100;
      v.hp = v.def.hp;
      v.dirty = true;
      g.vehicles._sync(v, true);
      return `${v.def.name} brought in front of you`;
    }
    case 'storm-skip':
      if (g.storm.stage === 'done') return 'The storm has already closed';
      g.storm.timer = 0.01;
      return g.storm.stage === 'wait' ? 'Storm: shrinking now' : 'Storm: jumped to the next phase';
    case 'storm-pause':
      A.stormPaused = !A.stormPaused;
      return `Storm ${A.stormPaused ? 'paused (no shrinking, no storm damage)' : 'running again'}`;
    case 'freeze':
      A.freezeBots = !A.freezeBots;
      return `Bots ${A.freezeBots ? 'frozen in place' : 'moving again'}`;
    case 'clear-bots': {
      let n = 0;
      for (const a of g.actors) if (a.isBot && a.alive && a.team !== P.team) { a.state = a.state === 'bus' ? 'ground' : a.state; g.eliminate(a, null, {}); n++; }
      return `Removed ${n} opposing bots`;
    }
    case 'boss-kill':
      if (!g.boss.alive) return 'Crankbolt is already down';
      g.boss.damage(g.boss.hp + 1, P);
      return 'Crankbolt defeated: its loot dropped';
    case 'boss-reset':
      g.boss.reset();
      return 'Crankbolt is back at full health on its hilltop';
    case 'vault':
      if (!g.world.openVault()) return 'The vault is already open';
      g.net?.push?.(['vo']);
      return "Crankbolt's Vault opened";
    case 'speed': {
      if (g.role !== 'solo') return 'Game speed only changes in solo matches (it would desync online play).';
      g.engine.timeScale = +arg;
      return `Game speed ×${arg}`;
    }
    default:
      return 'Unknown tool';
  }
}

/** Progression tools (this device's saved progress). */
export function progressOp(op, arg, mode) {
  const pr = save.data.progress;
  switch (op) {
    case 'level': {
      const n = +arg || 1;
      for (let i = 0; i < n; i++) {
        const L = levelInfo(pr.xp);
        pr.xp += L.need - L.into;
      }
      save.write();
      return `Now level ${levelInfo(pr.xp).level}`;
    }
    case 'outfits': {
      const need = Math.max(...Object.values(CHARACTERS).flatMap((c) => c.outfits.map((o) => o.level)));
      while (levelInfo(pr.xp).level < need) pr.xp += xpForLevel(levelInfo(pr.xp).level);
      save.write();
      return `Every outfit unlocked (level ${levelInfo(pr.xp).level})`;
    }
    case 'pass': {
      const p = pass();
      const up = addPassXP((passTier(p) + 1) * TIER_XP - p.xp);
      return `Benton Pass tier ${up.after}${up.got.length ? ' (unlocked a reward)' : ''}`;
    }
    case 'event': {
      const P = save.data.profile;
      P.eventPick = EVENTS[arg] ? arg : null;
      P.event = true;
      save.write();
      return P.eventPick ? `Island event pinned: ${EVENTS[arg].name}` : "Island event back to today's rotation";
    }
    case 'badges':
      setAllBadges(+arg === 1);
      return +arg === 1 ? 'Every Benton Badge found (and their gliders unlocked)' : 'Found badges forgotten: hunt them again';
    case 'cosmetics': {
      const p = pass();
      for (const r of PASS) if (r && r.kind !== 'super' && !p.owned.includes(`${r.kind}:${r.id}`)) p.owned.push(`${r.kind}:${r.id}`);
      save.write();
      return 'Every emote, glider and pass outfit unlocked';
    }
    case 'super':
      superXP().pool = CAP_XP;
      save.write();
      return `Supercharged XP refilled to ${CAP_XP.toLocaleString()}`;
    case 'rank': {
      const s = rankState(mode);
      const d = Math.max(-1, Math.min(TOP, +arg));
      if (d < 0) Object.assign(s, { d: -1, rp: 0, mmr: 1000, matches: 0, peak: -1, history: [] });
      else Object.assign(s, { d, rp: 0, mmr: divisionMMR(d), matches: Math.max(s.matches, PLACEMENT_MATCHES), peak: Math.max(s.peak, d) });
      save.write();
      return d < 0 ? 'Rank reset to Unranked (placement matches again)' : 'Rank set';
    }
    case 'rp': {
      const s = rankState(mode);
      if (s.d < 0) return 'Set a rank first';
      s.rp = Math.max(0, Math.min(99, +arg));
      save.write();
      return `Rank progress set to ${s.rp}%`;
    }
    case 'chal-done': {
      const c = dailyChallenges();
      for (const ch of c.list) { ch.prog = CHALLENGES[ch.id].goal; ch.done = true; }
      save.write();
      return "Today's challenges marked complete (no XP awarded)";
    }
    case 'chal-reset': {
      const c = dailyChallenges();
      for (const ch of c.list) { ch.prog = 0; ch.done = false; }
      save.write();
      return "Today's challenge progress reset";
    }
    default:
      return 'Unknown tool';
  }
}
