/**
 * Match orchestrator: world, actors, bus flight, storm, damage routing,
 * eliminations, placement, victory and results. One Game instance lives for
 * the whole session; startMatch() rebuilds everything for a fresh match.
 */

import * as THREE from 'three';
import { World, textTexture } from '../world/island.js';
import { Actor } from '../entities/actor.js';
import { CHARACTER_IDS } from '../entities/characters.js';
import { Combat } from './combat.js';
import { Loot } from './loot.js';
import { Building } from './building.js';
import { Storm } from './storm.js';
import { Effects } from './effects.js';
import { BotBrain, BOT_NAMES } from './bots.js';
import { PlayerController } from './player.js';
import { Teams } from './teams.js';
import { mulberry32, makeWeapon, BUFFS } from './items.js';
import { sfx } from '../core/audio.js';
import { save, levelInfo } from '../core/save.js';

const BUS_H = 115, BUS_SPEED = 19, BUS_R = 215;

export class Game {
  constructor(engine, input, hud) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.input = input;
    this.hud = hud;
    this.state = 'menu';
    this.actors = [];
    this.tweens = [];
    this.time = 0;
    this.paused = false;
    this.world = null;
    this._setupLights();
    this.effects = new Effects(this.scene);
    this.controller = new PlayerController(this);
    this.bus = this._busModel();
    this.scene.add(this.bus);
    this.bus.visible = false;
    this.marker = null;
    this.markerBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 300, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.35, depthWrite: false }));
    this.markerBeam.visible = false;
    this.scene.add(this.markerBeam);
  }

  _setupLights() {
    this.scene.background = new THREE.Color('#9fd8ff');
    this.scene.fog = new THREE.Fog('#bfe6ff', 160, 560);
    this.hemi = new THREE.HemisphereLight('#dff3ff', '#6a8a4a', 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    this.sun.position.set(60, 120, 40);
    this.sun.castShadow = save.data.settings.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -70;
    s.right = s.top = 70;
    s.near = 10;
    s.far = 320;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
  }

  setShadows(on) {
    this.sun.castShadow = on;
    this.engine.renderer.shadowMap.enabled = on;
    this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
  }

  _busModel() {
    const g = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: '#ffcf3f' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 10), yellow);
    body.position.y = 0;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2), yellow);
    hood.position.set(0, -0.6, 6);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.25, 10.05), new THREE.MeshLambertMaterial({ color: '#222' }));
    stripe.position.y = -0.4;
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.9, 8.5), new THREE.MeshLambertMaterial({ color: '#9fe3ff', emissive: '#1b4a5a' }));
    win.position.set(0, 0.6, 0.3);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: textTexture('BENTON BUS', '#222222', '#ffcf3f', 512) }));
    sign.position.set(1.66, -0.5, 0);
    sign.rotation.y = Math.PI / 2;
    const sign2 = sign.clone();
    sign2.position.x = -1.66;
    sign2.rotation.y = -Math.PI / 2;
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 14), new THREE.MeshLambertMaterial({ color: '#ff5ca8' }));
    balloon.position.y = 8;
    balloon.scale.set(1, 1.1, 1.4);
    const band = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.3, 6, 24), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    band.position.y = 8;
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1.4, 1);
    g.add(body, hood, stripe, win, sign, sign2, balloon, band);
    for (const [x, z] of [[-1.4, -3], [1.4, -3], [-1.4, 3], [1.4, 3]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), new THREE.MeshLambertMaterial({ color: '#222' }));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, -1.6, z);
      g.add(w);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 4), new THREE.MeshBasicMaterial({ color: '#444' }));
      line.position.set(x * 0.9, 4.2, z * 0.5);
      g.add(line);
    }
    this.propeller = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: '#666' }));
    this.propeller.position.set(0, 0, -5.3);
    g.add(this.propeller);
    return g;
  }

  // ------------------------------------------------------------ match setup
  startMatch(opts) {
    this.endMatch();
    this.opts = opts;
    this.mode = opts.mode;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const rng = (this.rng = mulberry32(this.seed));
    this.world = new World(7); // the island layout is fixed; loot and storm vary per match
    this.world.onBarrel = (c) => this.combat.explode(new THREE.Vector3((c.minX + c.maxX) / 2, c.minY + 0.6, (c.minZ + c.maxZ) / 2), 4.5, 65, 250, c.lastDamager || null);
    this.scene.add(this.world.root);
    this.combat = new Combat(this);
    this.loot = new Loot(this);
    this.loot.spawnInitial(rng);
    this.building = new Building(this);
    this.storm = new Storm(this, rng);
    this.teamSize = opts.teamSize || 1;
    this.teams = new Teams(this, this.teamSize);
    this.time = 0;
    this.tweens = [];
    this.killfeed = [];
    this.result = null;
    this.playerKiller = null;
    this.actors = [];
    const k = this.teamSize;
    const p = new Actor(this, { id: 0, team: 0, name: save.data.profile.name || 'You', charId: opts.charId, outfit: opts.outfit, skin: opts.skin });
    this.player = p;
    this.actors.push(p);
    const names = [...BOT_NAMES].sort(() => rng() - 0.5);
    for (let i = 0; i < opts.botCount; i++) {
      const id = i + 1;
      const cid = CHARACTER_IDS[i % 3];
      // actors are grouped into teams of k in id order; the player's squad is team 0
      const b = new Actor(this, { id, team: Math.floor(id / k), name: `${names[i % names.length]} [BOT]`, isBot: true, charId: cid, outfit: Math.floor(rng() * 3), skin: Math.floor(rng() * 5) });
      b.brain = new BotBrain(this, b, mulberry32(this.seed + i * 977));
      if (b.team === 0) b.brain.leader = p;
      b.brain.pickDrop(this.world);
      this.actors.push(b);
    }
    // bot squads drop together at their captain's spot
    for (const b of this.actors) {
      if (!b.brain || b.team === 0) continue;
      const cap = this.actors.find((a) => a.team === b.team && a.brain);
      if (cap !== b) b.brain.dropTarget = cap.brain.dropTarget.clone().add(new THREE.Vector3((rng() - 0.5) * 10, 0, (rng() - 0.5) * 10));
    }
    for (const a of this.actors) {
      if (this.mode === 'zerobuild') {
        a.overshieldMax = 50;
        a.overshield = 50;
      }
      a.state = 'bus';
    }
    // bus route across the island
    const ang = rng() * Math.PI * 2;
    const off = (rng() - 0.5) * 80;
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    this.busFrom = new THREE.Vector3(Math.cos(ang) * BUS_R + nx * off, BUS_H, Math.sin(ang) * BUS_R + nz * off);
    this.busTo = new THREE.Vector3(-Math.cos(ang) * BUS_R + nx * off, BUS_H, -Math.sin(ang) * BUS_R + nz * off);
    this.busLen = this.busFrom.distanceTo(this.busTo);
    this.busT = 0;
    this.bus.visible = true;
    this.bus.position.copy(this.busFrom);
    this.bus.lookAt(this.busTo);
    for (const a of this.actors) {
      if (!a.brain) continue;
      // jump roughly when the bus passes closest to the chosen drop spot
      const d = a.brain.dropTarget;
      const dir = new THREE.Vector3().subVectors(this.busTo, this.busFrom).normalize();
      const along = new THREE.Vector3(d.x - this.busFrom.x, 0, d.z - this.busFrom.z).dot(dir);
      a.brain.jumpT = Math.max(2.5, Math.min(this.busLen / BUS_SPEED - 1, (along - 40) / BUS_SPEED + rng() * 4));
      // the player's teammates wait for the player and jump with them
      if (a.team === 0) a.brain.jumpT = Infinity;
    }
    for (const a of this.actors) {
      if (!a.brain || a.team === 0) continue;
      const cap = this.actors.find((b) => b.team === a.team && b.brain);
      a.brain.jumpT = cap.brain.jumpT + (a === cap ? 0 : 0.2 + rng() * 0.6);
    }
    this.state = 'bus';
    this.marker = null;
    this.markerBeam.visible = false;
    this.controller.reset();
    this.hud.show(true);
    this.hud.onMatchStart(this);
    this.hud.toast('Welcome aboard the Benton Bus! Press SPACE to jump.', '#ffd23f', 4);
  }

  endMatch() {
    if (!this.world) return;
    for (const a of this.actors) a.dispose();
    this.actors = [];
    this.combat.clear();
    this.loot.clear();
    this.building.clear();
    this.storm.dispose();
    this.effects.clear();
    this.scene.remove(this.world.root);
    this.world.dispose();
    this.world = null;
    this.bus.visible = false;
    this.state = 'menu';
  }

  setMarker(x, z) {
    this.marker = x === null ? null : new THREE.Vector2(x, z);
    this.markerBeam.visible = !!this.marker;
    if (this.marker) this.markerBeam.position.set(x, 150, z);
  }

  jumpFromBus(a) {
    if (a.state !== 'bus' || this.busT < 1.5) return false;
    a.state = 'skydive';
    a.pos.copy(this.bus.position).add(new THREE.Vector3(0, -3, 0));
    const dir = new THREE.Vector3().subVectors(this.busTo, this.busFrom).normalize();
    a.vel.copy(dir).multiplyScalar(8);
    a.vel.y = -2;
    a.yaw = a.aimYaw = Math.atan2(-dir.x, -dir.z);
    if (a === this.player) {
      sfx.play('jump');
      this.hud.toast('Skydiving! Steer with WASD, hold W to dive. SPACE opens the glider.', '#ffffff', 4);
      // squadmates follow the player out of the bus and toward the drop marker
      let n = 0;
      for (const b of this.actors) {
        if (!b.brain || b.team !== 0 || b.state !== 'bus') continue;
        b.brain.jumpT = this.busT + 0.35 + n++ * 0.35;
        b.brain.followDrop = true;
      }
    }
    return true;
  }

  alive() {
    return this.actors.filter((a) => a.alive);
  }

  // ------------------------------------------------------------ damage
  applyDamage(target, amount, src, opts = {}) {
    if (!target.alive || target.state === 'bus' || amount <= 0 || this.state === 'over') return;
    const env = opts.storm || opts.fall;
    if (src && src !== target && src.team === target.team && !env) return; // no friendly fire
    if (src && src.buffs.spicy && !env) amount *= 1.2;
    amount = Math.round(amount);
    if (target.downed) {
      const d = Math.min(target.downHp, amount);
      target.downHp -= d;
      target.model.hit();
      if (src && src !== target) src.damageDealt += d;
      if (src === this.player) {
        this.hud.hitmarker(!!opts.head, false);
        this.hud.damageNumber(opts.pos || target.eye, d, !!opts.head, false);
        sfx.play('hit');
      }
      if (target === this.player) this.hud.hurt(src ? src.pos : null, opts.storm);
      if (target.downHp <= 0) this.eliminate(target, src && src !== target ? src : target.downedBy, opts);
      return;
    }
    let res;
    if (opts.storm || opts.fall) {
      const d = Math.min(target.hp, amount);
      target.hp -= d;
      target.sinceDamage = 0;
      target.model.hit();
      res = { shield: 0, hp: d };
    } else {
      res = target.takeDamage(amount, src);
    }
    const total = res.shield + res.hp;
    if (src && src !== target) src.damageDealt += total;
    if (src === this.player && target !== this.player) {
      this.hud.hitmarker(!!opts.head, res.shield > 0 && res.hp === 0);
      this.hud.damageNumber(opts.pos || target.eye, total, !!opts.head, res.shield > 0);
      sfx.play(opts.head ? 'head' : res.shield > 0 ? 'shieldhit' : 'hit');
    }
    if (target === this.player) {
      this.hud.hurt(src ? src.pos : null, opts.storm);
      if (!opts.storm) sfx.play('hurt');
      else sfx.play('storm');
    }
    if (target.brain && src && src !== target && src.alive) {
      const b = target.brain;
      if (!b.enemy || b.enemy.pos.distanceTo(target.pos) > src.pos.distanceTo(target.pos)) {
        b.enemy = src;
        b.seenT = 0;
        b.react = Math.min(b.react || 0.6, 0.6);
      }
    }
    if (target.hp <= 0) {
      const killer = src && src !== target ? src : env ? null : target.lastHitBy;
      if (!this.teams.tryDown(target, killer)) this.eliminate(target, killer, opts);
    }
  }

  damageCollider(c, dmg, src) {
    if (!c.alive || c.hp === Infinity) return;
    if (src && src.buffs && src.buffs.spicy) dmg *= 1.2;
    if (c.piece) {
      this.building.damage(c.piece, dmg, src);
      return;
    }
    c.hp -= dmg;
    c.lastDamager = src;
    if (c.mesh && !c.inst) {
      const m = c.mesh;
      const base = m.userData.baseScale || (m.userData.baseScale = m.scale.clone());
      this.tweens.push({ t: 0, d: 0.12, fn: (k) => m.scale.copy(base).multiplyScalar(1 - Math.sin(k * Math.PI) * 0.04) });
    }
    if (c.hp <= 0) {
      const center = new THREE.Vector3((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, (c.minZ + c.maxZ) / 2);
      this.world.destroyCollider(c);
      c.onDestroy?.();
      const col = c.material === 'wood' ? '#c98a4b' : c.material === 'brick' ? '#c4533f' : c.material === 'metal' ? '#9fb2c4' : '#bbbbbb';
      this.effects.burst(center, col, 16, 5, 0.25, 0.9);
      sfx.play('break', center);
    }
  }

  eliminate(target, killer, opts = {}) {
    if (!target.alive) return;
    const teamsBefore = this.teams.teamsAlive().size;
    target.alive = false;
    target.downed = false;
    target.place = teamsBefore;
    target.use = null;
    target.emote = false;
    target.reviveTarget = target.rebootVan = null;
    // carried reboot cards fall to the ground with everything else
    for (const id of target.cards) this.teams.dropCard(this.actors[id]);
    target.cards = [];
    this.loot.dropAll(target);
    this.teams.dropCard(target);
    this.effects.confetti(target.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    sfx.play('elim', target.pos);
    let msg;
    if (killer && killer !== target) {
      killer.kills++;
      msg = { a: killer.name, b: target.name, how: opts.head ? 'headshot' : opts.explosive ? 'boom' : 'elim' };
      if (killer === this.player) this.hud.toast(`You eliminated ${target.name}!`, '#ffd23f', 2);
    } else {
      msg = { a: null, b: target.name, how: opts.storm ? 'storm' : opts.fall ? 'fall' : 'out' };
    }
    this.hud.killfeed(msg, this.player);
    const teamOut = !this.teams.teamsAlive().has(target.team);
    if (teamOut) this.teams.place[target.team] = teamsBefore;
    if (target === this.player) {
      const mate = this.actors.find((a) => a.alive && a.team === target.team);
      this.controller.spectate(mate || (killer && killer.alive ? killer : null));
      if (mate) this.hud.toast('Eliminated! Your squad can pick up your reboot card and bring you back.', '#39f0ff', 5);
      this.playerKiller = killer;
    }
    if (teamOut && target.team === this.player.team) this._finishPlayer(false, this.playerKiller);
    const teams = this.teams.teamsAlive();
    if (teams.size <= 1) {
      const wt = [...teams][0];
      const w = wt === undefined ? null : this.actors.find((a) => a.alive && a.team === wt);
      for (const a of this.actors) if (a.team === wt) a.place = 1;
      this.state = 'over';
      if (wt === this.player.team) this._finishPlayer(true, null);
      else this.hud.matchOver(w, this.teamSize > 1);
    }
  }

  /** Leaving mid-match: record the result at the current standing. */
  forfeit() {
    if (!this.world || this.result || this.state === 'over') return;
    this.teams.place[this.player.team] = this.teams.teamsAlive().size;
    this._finishPlayer(false, this.playerKiller || null);
  }

  /** Computes XP, saves progression and shows the right screen. */
  _finishPlayer(won, killer) {
    if (this.result) return;
    const p = this.player;
    const place = won ? 1 : this.teams.place[p.team] || p.place;
    const totalTeams = Math.ceil(this.actors.length / this.teamSize);
    const survive = Math.floor(this.time);
    const xp = 60 + p.kills * 75 + Math.round(p.damageDealt / 4) + Math.floor(survive / 3) + Math.max(0, (totalTeams - place) * 8 * this.teamSize) + (won ? 400 : 0);
    const before = levelInfo(save.data.progress.xp).level;
    const pr = save.data.progress;
    pr.xp += xp;
    pr.matches++;
    pr.kills += p.kills;
    if (won) pr.wins++;
    if (!pr.bestPlace || place < pr.bestPlace) pr.bestPlace = place;
    save.write();
    const after = levelInfo(pr.xp).level;
    this.result = { won, place, total: totalTeams, team: this.teamSize > 1, kills: p.kills, damage: Math.round(p.damageDealt), time: survive, xp, levelUp: after > before ? after : 0, killer: killer ? killer.name : null };
    if (won) {
      sfx.play('win');
      p.emote = true;
    } else sfx.play('lose');
    this.hud.playerResult(this.result);
  }

  // ------------------------------------------------------------ frame
  update(dt, t) {
    if (!this.world) return;
    if (this.paused) {
      this.controller.updateCamera(0);
      return;
    }
    this.time += dt;
    // bus
    if (this.busT !== null && this.bus.visible) {
      this.busT += dt;
      const k = Math.min(1, (this.busT * BUS_SPEED) / this.busLen);
      this.bus.position.lerpVectors(this.busFrom, this.busTo, k);
      this.bus.position.y = BUS_H + Math.sin(this.busT * 1.3) * 0.6;
      this.propeller.rotation.z += dt * 25;
      for (const a of this.actors) {
        if (a.state !== 'bus') continue;
        a.pos.copy(this.bus.position);
        if (a.brain && this.busT >= a.brain.jumpT) this.jumpFromBus(a);
      }
      if (k >= 1) {
        for (const a of this.actors) if (a.state === 'bus') { this.busT = Math.max(this.busT, 1.6); this.jumpFromBus(a); }
        this.bus.visible = false;
      }
      if (this.state === 'bus' && this.player.state !== 'bus') this.state = 'playing';
    }
    this.controller.update(dt);
    for (const a of this.actors) {
      if (!a.alive) continue;
      if (a.brain) a.move(dt, a.brain.update(dt));
      a.tickTimers(dt);
    }
    this.teams.update(dt);
    this.combat.update(dt);
    this.loot.update(dt, t);
    if (this.state !== 'over') this.storm.update(dt, t);
    this.world.update(dt, t);
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      tw.fn(Math.min(1, tw.t / tw.d));
      if (tw.t >= tw.d) this.tweens.splice(i, 1);
    }
    const cam = this.camera.position;
    for (const a of this.actors) {
      const far = a.pos.distanceToSquared(cam) > 170 * 170;
      if (far) a.model.root.visible = false;
      else {
        a.syncModel(dt, t);
        // buff aura sparkles
        if (a.alive && a.state !== 'bus' && (a.auraT -= dt) <= 0) {
          const ids = Object.keys(a.buffs);
          if (ids.length) {
            a.auraT = 0.12;
            const id = ids[Math.floor(Math.random() * ids.length)];
            const pp = a.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.9));
            this.effects.particle(pp, new THREE.Vector3(0, 1.2, 0), BUFFS[id].color, 0.09, 0.6, 0);
          }
        }
      }
    }
    this.controller.updateCamera(dt);
    this.effects.update(dt, cam);
    sfx.listener = cam;
    // sun follows the action so shadows stay crisp
    const f = this.controller.focus();
    this.sun.position.set(f.x + 60, f.y + 120, f.z + 40);
    this.sun.target.position.copy(f);
    // POI toasts
    const p = this.player;
    if (p.alive && p.state !== 'bus') {
      const poi = this.world.poiAt(p.pos.x, p.pos.z);
      if (poi && poi !== p.lastPoi) this.hud.banner(poi.name);
      p.lastPoi = poi;
    }
    this.hud.update(this, dt);
  }

  onStormShrink(phase) {
    if (phase === 1 || phase === 3) {
      const n = this.storm.next;
      const a = this.rng() * Math.PI * 2, r = this.rng() * n.r * 0.6;
      this.loot.supplyDrop(n.c.x + Math.cos(a) * r, n.c.y + Math.sin(a) * r);
    }
  }

  /** Debug/test helper: give the player a sample loadout. */
  debugLoadout() {
    const p = this.player;
    p.slots = [makeWeapon('ar', 2), makeWeapon('shotgun', 1), makeWeapon('sniper', 3), { kind: 'consumable', id: 'minishield', count: 3 }, { kind: 'throwable', id: 'boomball', count: 3 }];
    p.ammo = { light: 60, medium: 120, heavy: 12, shells: 20, rockets: 3 };
    p.mats = { wood: 200, brick: 100, metal: 60 };
  }
}
