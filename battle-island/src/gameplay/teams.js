/**
 * Team rules for Duos / Trios / Squads: knocked-down (DBNO) state with a
 * bleed-out pool, reviving, reboot cards + reboot vans, pings, team wipes
 * and team placement. In Solo every actor is its own team and nobody is
 * ever downed, so the same code handles both.
 */

import * as THREE from 'three';
import { makeWeapon } from './items.js';
import { sfx } from '../core/audio.js';

export const REVIVE_TIME = 4;
export const REBOOT_TIME = 5;
const BLEED = 1.5; // downed health lost per second
const CARD_LIFE = 90;
const VAN_COOLDOWN = 60;

/** Reach to a reboot van: horizontal, with some vertical slack for slopes. */
const vanDist = (v, p) => Math.hypot(v.pos.x - p.x, v.pos.z - p.z) + Math.max(0, Math.abs(v.pos.y - p.y) - 1.5);

export class Teams {
  constructor(game, size) {
    this.game = game;
    this.size = size;
    this.pings = [];
    this.place = {}; // team -> placement when wiped
  }

  get enabled() {
    return this.size > 1;
  }

  members(team) {
    return this.game.actors.filter((a) => a.team === team);
  }

  /** Someone on the team is alive and not downed. */
  teamUp(team, except = null) {
    return this.game.actors.some((a) => a.team === team && a !== except && a.alive && !a.downed);
  }

  teamsAlive() {
    const s = new Set();
    for (const a of this.game.actors) if (a.alive) s.add(a.team);
    return s;
  }

  /** Called when an actor's health hits 0. Returns true if knocked instead of eliminated. */
  tryDown(target, by) {
    if (!this.enabled || target.downed || !this.teamUp(target.team, target)) return false;
    target.downed = true;
    target.downHp = 100;
    target.hp = 1;
    target.shield = 0;
    target.downedBy = by;
    target.cancelActions();
    target.emote = false;
    target.building = false;
    target.ads = false;
    target.reviveTarget = null;
    target.rebootVan = null;
    target.sel = -1;
    const g = this.game;
    g.feed({ a: by ? by.name : null, b: target.name, how: 'knock' });
    sfx.play('hurt', target.pos);
    if (target === g.player) {
      g.controller.building = false;
      g.building.hideGhost();
    }
    g.notify(target, "You're knocked down! Crawl to cover — a teammate can revive you.", '#ff8a8a', 4);
    return true;
  }

  revive(target, by) {
    target.downed = false;
    target.downHp = 0;
    target.hp = 30;
    target.shield = 0;
    target.downedBy = null;
    sfx.play('heal', target.pos);
    this.game.effects.burst(target.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#7ed957', 14, 3, 0.12, 0.7);
    const g = this.game;
    g.notify(target, `${by.name} revived you!`, '#7ed957', 2.5);
    g.notify(by, `You revived ${target.name}!`, '#7ed957', 2);
  }

  /** Drops a reboot card where a team member was eliminated. */
  dropCard(target) {
    if (!this.enabled) return;
    const it = { kind: 'card', id: target.id, team: target.team, name: target.name.replace(' [BOT]', ''), expires: this.game.time + CARD_LIFE };
    this.game.loot.drop(it, target.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 4, 0));
  }

  reboot(van, by) {
    const g = this.game;
    const back = [];
    for (const id of by.cards) {
      const a = g.actors[id];
      if (!a || a.alive) continue;
      a.alive = true;
      a.downed = false;
      a.hp = 100;
      a.shield = 0;
      a.overshield = a.overshieldMax;
      a.slots = [makeWeapon('pistol', 0), null, null, null, null];
      a.sel = -1;
      a.ammo = { light: 36, medium: 0, heavy: 0, shells: 0, rockets: 0 };
      a.mats = { wood: g.mode === 'zerobuild' ? 0 : 100, brick: 0, metal: 0 };
      a.buffs = {};
      a.cards = [];
      a.lastHitBy = null;
      a.pos.set(van.pos.x + (Math.random() - 0.5) * 4, van.pos.y + 60, van.pos.z + (Math.random() - 0.5) * 4);
      a.vel.set(0, 0, 0);
      a.state = 'skydive';
      a.canRedeploy = false;
      a.place = 0;
      a.ep = (a.ep | 0) + 1;
      a.resultSent = false;
      back.push(a);
      if (a === g.player) {
        g.controller.spectating = false;
        g.controller.spec = null;
        g.menus.hide();
      }
      g.notify(a, `${by.name} rebooted you! Glide back into the fight.`, '#39f0ff', 4);
    }
    by.cards = [];
    van.cd = VAN_COOLDOWN;
    g.effects.burst(van.pos.clone().add(new THREE.Vector3(0, 2, 0)), '#39f0ff', 30, 6, 0.2, 1.2);
    sfx.play('chest', van.pos);
    if (back.length) g.feed({ a: by.name, b: back.map((a) => a.name).join(', '), how: 'reboot' });
  }

  nearestVan(pos, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const v of this.game.world.vans) {
      const d = vanDist(v, pos);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  vansOnline() {
    return this.game.storm.phase < 4;
  }

  ping(by, pos) {
    const g = this.game;
    let label = 'Going here', color = '#ffd23f';
    const enemy = g.actors.find((a) => a.alive && a.team !== by.team && a.state !== 'bus' && a.pos.distanceTo(pos) < 5);
    if (enemy) { label = 'Enemy spotted!'; color = '#ff5c5c'; }
    else if (g.world.chests.some((c) => !c.opened && c.pos.distanceTo(pos) < 3)) { label = 'Chest here'; color = '#ffcf3f'; }
    else {
      const pk = g.loot.pickups.find((k) => k.pos.distanceTo(pos) < 2.5 && k.it.kind !== 'card');
      if (pk && pk.it.kind === 'weapon') label = 'Weapon here';
      else if (pk) label = 'Loot here';
    }
    this.pings = this.pings.filter((p) => p.by !== by);
    this.pings.push({ pos: pos.clone(), t: 12, team: by.team, by, label, color, enemy });
    g.net?.push?.(['pg', by.team, Math.round(pos.x * 10), Math.round(pos.y * 10), Math.round(pos.z * 10), label, color, by.id]);
    for (const a of g.actors) if (a.brain && a.team === by.team && a !== by) a.brain.onPing(pos, enemy);
    if (by === g.player) sfx.play('ui');
  }

  update(dt) {
    const g = this.game;
    for (const p of this.pings) p.t -= dt;
    this.pings = this.pings.filter((p) => p.t > 0);
    for (const v of g.world.vans) v.cd = Math.max(0, v.cd - dt);
    for (const a of g.actors) {
      if (!a.alive) continue;
      if (a.downed) {
        a.downHp -= BLEED * dt;
        if (a.downHp <= 0) g.eliminate(a, a.downedBy, {});
        continue;
      }
      // revives (held interaction; the caller refreshes reviveTarget every frame)
      const t = a.reviveTarget;
      if (t) {
        if (!t.alive || !t.downed || t.team !== a.team || t.pos.distanceTo(a.pos) > 2.6 || !a.canAct()) {
          a.reviveTarget = null;
          a.reviveT = 0;
        } else if ((a.reviveT += dt) >= REVIVE_TIME) {
          this.revive(t, a);
          a.reviveTarget = null;
          a.reviveT = 0;
        }
      } else a.reviveT = 0;
      const v = a.rebootVan;
      if (v) {
        if (!a.cards.length || v.cd > 0 || !this.vansOnline() || vanDist(v, a.pos) > 3.2 || !a.canAct()) {
          a.rebootVan = null;
          a.rebootT = 0;
        } else if ((a.rebootT += dt) >= REBOOT_TIME) {
          this.reboot(v, a);
          a.rebootVan = null;
          a.rebootT = 0;
        }
      } else a.rebootT = 0;
    }
    // a team with nobody standing is wiped: knocked members are eliminated
    if (this.enabled) {
      for (const a of g.actors) {
        if (a.alive && a.downed && !this.teamUp(a.team)) g.eliminate(a, a.downedBy, { wiped: true });
      }
    }
  }
}
