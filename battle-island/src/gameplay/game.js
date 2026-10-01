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
import { Vehicles } from './vehicles.js';
import { Boss } from './boss.js';
import { dropBucks } from './economy.js';
import { Quests, QUEST_XP } from './quests.js';
import { BadgeHunt } from './badges.js';
import { IslandEvent } from './events.js';
import { EVENTS } from '../core/events.js';
import { PICKAXES, BACKBLINGS, WRAPS } from '../core/cosmetics.js';
import { BADGE_XP } from '../core/badges.js';
import { HostNet, ClientNet, NetActions, LocalActions } from '../net/sync.js';
import { mulberry32, makeWeapon, BUFFS } from './items.js';
import { superchargeXP } from '../core/supercharge.js';
import { applyChallenges } from '../core/challenges.js';
import { applyWeekly, applyAchievements, unlockReached, refreshLevel, addPassXP } from '../core/season.js';
import { sfx } from '../core/audio.js';
import { save, levelInfo } from '../core/save.js';
import { applyRanked, botSkillRange, isSupercharged, rankState } from '../core/ranked.js';

const BUS_H = 115, BUS_SPEED = 19, BUS_R = 215;
const FROZEN = { mx: 0, mz: 0, jump: false, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false }; // admin: bots hold still

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
    this.admin = {};
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
    // Benton Bus v2: a rounded school bus hanging under a striped party balloon.
    const g = new THREE.Group();
    const mat = (color, emissive) => new THREE.MeshLambertMaterial({ color, emissive: emissive || '#000000' });
    const box = (w, h, d, material, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    const yellow = mat('#ffc933'), dark = mat('#1f2329'), chrome = mat('#c9d1dc'), glass = mat('#9fe3ff', '#1b4a5a');
    box(3.4, 2.6, 9.6, yellow, 0, 0.1, -0.4); // cabin
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 9.6, 16, 1, false, -Math.PI / 2, Math.PI), yellow);
    roof.rotation.x = Math.PI / 2;
    roof.scale.set(1, 1, 0.35);
    roof.position.set(0, 1.4, -0.4);
    g.add(roof);
    box(3.1, 1.6, 2.2, yellow, 0, -0.55, 5.4); // hood
    box(2.4, 0.9, 0.12, dark, 0, -0.55, 6.52); // grille
    box(3.6, 0.35, 0.4, chrome, 0, -1.2, 6.6); // front bumper
    box(3.6, 0.35, 0.4, chrome, 0, -1.2, -5.25); // rear bumper
    for (const x of [-1.1, 1.1]) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: '#fff6c2' }));
      lamp.position.set(x, -0.3, 6.53);
      g.add(lamp);
    }
    box(3.2, 1.1, 0.1, glass, 0, 0.8, 4.36); // windshield
    box(3.45, 0.22, 9.65, dark, 0, -0.55, -0.4); // stripes
    box(3.45, 0.12, 9.65, dark, 0, -0.9, -0.4);
    for (let i = 0; i < 6; i++) box(3.46, 0.85, 1.1, glass, 0, 0.75, 3.3 - i * 1.45); // windows
    box(0.1, 1.9, 1.0, glass, 1.72, -0.1, 3.6); // door
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.0), new THREE.MeshBasicMaterial({ map: textTexture('BENTON BUS', '#222222', '#ffc933', 512) }));
    sign.position.set(1.74, -0.2, -1.2);
    sign.rotation.y = Math.PI / 2;
    const sign2 = sign.clone();
    sign2.position.x = -1.74;
    sign2.rotation.y = -Math.PI / 2;
    g.add(sign, sign2);
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 8), mat('#e5323b'));
    stop.rotation.z = Math.PI / 2;
    stop.position.set(-1.8, 0.2, 3.2);
    g.add(stop);
    // roof rack, luggage and flags
    box(2.8, 0.1, 6, dark, 0, 2.05, -0.8);
    box(1.0, 0.6, 1.3, mat('#6fd0ff'), -0.6, 2.4, 0.6);
    box(0.9, 0.5, 1.0, mat('#7ee07a'), 0.7, 2.35, -1.2);
    box(1.1, 0.7, 0.9, mat('#ff8a3c'), -0.4, 2.45, -2.6);
    for (const [z, c] of [[2.4, '#ff5ca8'], [-3.9, '#6fd0ff']]) {
      box(0.06, 1.4, 0.06, dark, 1.2, 2.7, z);
      box(0.04, 0.5, 0.8, mat(c), 1.2, 3.1, z - 0.42);
    }
    // wheels
    for (const [x, z] of [[-1.5, -3.2], [1.5, -3.2], [-1.5, 4.4], [1.5, 4.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.45, 14), dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, -1.45, z);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(w.position);
      g.add(w, hub);
    }
    // striped balloon, ropes and hoop
    const stripes = ['#ff5ca8', '#ffffff', '#ffc933', '#ffffff'];
    for (let i = 0; i < 12; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(5, 4, 14, (i / 12) * Math.PI * 2, Math.PI / 6), mat(stripes[i % 4]));
      seg.position.y = 9;
      seg.scale.set(1, 1.05, 1.35);
      g.add(seg);
    }
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 6, 20), dark);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 4.1;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mat('#ff5ca8'));
    cap.position.y = 14.2;
    g.add(hoop, cap);
    for (const [x, z] of [[-1.5, -4], [1.5, -4], [-1.5, 3], [1.5, 3]]) {
      const from = new THREE.Vector3(x, 1.6, z), to = new THREE.Vector3(Math.sign(x) * 1.5, 4.1, Math.sign(z) * 1.5);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, from.distanceTo(to), 4), new THREE.MeshBasicMaterial({ color: '#444' }));
      rope.position.copy(from).add(to).multiplyScalar(0.5);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      g.add(rope);
    }
    // rear propeller
    box(0.5, 0.5, 0.5, dark, 0, 0.2, -5.4);
    this.propeller = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 0.12), mat('#ff5ca8'));
      blade.rotation.z = r;
      this.propeller.add(blade);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 10), chrome);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.25;
    this.propeller.add(nose);
    this.propeller.position.set(0, 0.2, -5.75);
    g.add(this.propeller);
    return g;
  }

  // ------------------------------------------------------------ match setup
  startMatch(opts) {
    this.endMatch();
    this.opts = opts;
    this.role = opts.role || 'solo'; // solo | host | client
    this.ranked = !!opts.ranked;
    this.lobbyRating = opts.lobbyRating || 1000;
    this.rankSuper = this.ranked && isSupercharged(rankState(opts.mode)); // this device's rank
    this.adminUsed = false; // owner admin tools used: the match doesn't count
    this.admin = {};
    this.actions = this.role === 'client' ? new NetActions(this) : new LocalActions(this);
    this.mode = opts.mode;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const rng = (this.rng = mulberry32(this.seed));
    this.world = new World(7); // the island layout is fixed; loot and storm vary per match
    this.world.onBarrel = (c) => this.role !== 'client' && this.combat.explode(new THREE.Vector3((c.minX + c.maxX) / 2, c.minY + 0.6, (c.minZ + c.maxZ) / 2), 4.5, 65, 250, c.lastDamager || null);
    this.scene.add(this.world.root);
    this.eventFx = new IslandEvent(this, opts.event); // today's island event (null: classic)
    this.event = this.eventFx.id;
    this.combat = new Combat(this);
    this.loot = new Loot(this);
    if (this.role !== 'client') {
      this.loot.spawnInitial(rng);
      this.eventFx.spawnLoot();
    }
    this.building = new Building(this);
    this.vehicles = new Vehicles(this);
    this.boss = new Boss(this);
    this.quests = new Quests(this);
    this.badges = new BadgeHunt(this);
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
    const client = this.role === 'client';
    // humans take the first ids (the host is 0), bots fill the rest; teams are k consecutive ids
    const humans = opts.humans || [{ id: 0, local: true, name: save.data.profile.name || 'You', charId: opts.charId, outfit: opts.outfit, skin: opts.skin, emote: opts.cos?.emote, glider: opts.cos?.glider, pickaxe: opts.cos?.pickaxe, backbling: opts.cos?.backbling, wrap: opts.cos?.wrap }];
    const rr = mulberry32(this.seed + 1); // roster rng: identical on host and clients
    const names = [...BOT_NAMES].sort(() => rr() - 0.5);
    const total = humans.length + opts.botCount;
    for (let id = 0; id < total; id++) {
      const h = humans.find((x) => x.id === id);
      let a;
      if (h) {
        a = new Actor(this, { id, team: Math.floor(id / k), name: h.name || 'Player', charId: h.charId, outfit: h.outfit, skin: h.skin, cos: { emote: h.emote, glider: h.glider, pickaxe: h.pickaxe, backbling: h.backbling, wrap: h.wrap }, human: true, remote: h.local ? null : h.peer || null });
        if (h.local) this.player = a;
      } else {
        const bi = id - humans.length;
        // bots wear a random pickaxe, back bling and wrap (same roll on every machine)
        const pickCos = (list) => { const ids = Object.keys(list); return ids[Math.floor(rr() * ids.length)]; };
        const bcos = { pickaxe: pickCos(PICKAXES), backbling: pickCos(BACKBLINGS), wrap: pickCos(WRAPS) };
        a = new Actor(this, { id, team: Math.floor(id / k), name: `${names[bi % names.length]} [BOT]`, isBot: true, charId: CHARACTER_IDS[bi % 3], outfit: Math.floor(rr() * 3), skin: Math.floor(rr() * 5), cos: bcos });
        if (!client) {
          a.brain = new BotBrain(this, a, mulberry32(this.seed + bi * 977));
          a.brain.pickDrop(this.world);
        }
      }
      this.actors.push(a);
    }
    // ranked matchmaking: bot opponents are tuned to the lobby's MMR
    if (this.ranked) {
      const [lo, hi] = botSkillRange(this.lobbyRating);
      for (const b of this.actors) if (b.brain) b.brain.skill = lo + b.brain.rng() * (hi - lo);
    }
    const humanTeams = new Set(this.actors.filter((a) => a.human).map((a) => a.team));
    for (const b of this.actors) {
      if (!b.brain) continue;
      const leader = this.actors.find((a) => a.human && a.team === b.team);
      if (leader) b.brain.leader = leader;
    }
    // bot squads drop together at their captain's spot
    for (const b of this.actors) {
      if (!b.brain || humanTeams.has(b.team)) continue;
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
    if (opts.bus) {
      this.busFrom.fromArray(opts.bus, 0);
      this.busTo.fromArray(opts.bus, 3);
    }
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
      // bots on a human's squad wait for their human and jump with them
      if (humanTeams.has(a.team)) a.brain.jumpT = Infinity;
    }
    for (const a of this.actors) {
      if (!a.brain || humanTeams.has(a.team)) continue;
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
    if (this.event) this.hud.toast(`${EVENTS[this.event].icon} Island event: ${EVENTS[this.event].name} · ${EVENTS[this.event].desc}`, EVENTS[this.event].color, 6);
    // networking
    this.net = null;
    if (opts.room && this.role === 'host') {
      this.net = new HostNet(this, opts.room);
      this.effects.onFx = (e) => this.net && this.net.push(e);
      sfx.onPlay = (name, pos) => this.net && this.net.push(['sd', name, Math.round(pos.x * 10), Math.round(pos.y * 10), Math.round(pos.z * 10)]);
      this.world.onDestroyed = (wid) => this.net && this.net.push(['wd', wid]);
    } else if (opts.room && this.role === 'client') {
      this.net = new ClientNet(this, opts.room, opts.hostPeer);
    }
  }

  endMatch() {
    if (!this.world) return;
    if (this.net && this.net.dispose) this.net.dispose();
    this.net = null;
    this.effects.onFx = null;
    sfx.onPlay = null;
    if (this._pj) for (const m of this._pj) this.scene.remove(m);
    this._pj = null;
    this.netProjectiles = null;
    for (const a of this.actors) a.dispose();
    this.actors = [];
    this.combat.clear();
    this.loot.clear();
    this.building.clear();
    this.vehicles.clear();
    this.boss.dispose();
    this.quests.dispose();
    this.badges.dispose();
    this.eventFx.dispose();
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
    if (a.human) {
      a.ep = (a.ep | 0) + 1; // clients adopt host-driven teleports by epoch
      if (a === this.player) {
        sfx.play('jump');
        this.hud.toast('Skydiving! Steer with WASD, hold W to dive. SPACE opens the glider.', '#ffffff', 4);
      }
      // bot squadmates follow their human out of the bus and toward the drop marker
      let n = 0;
      for (const b of this.actors) {
        if (!b.brain || b.team !== a.team || b.state !== 'bus' || b.brain.leader !== a) continue;
        b.brain.jumpT = this.busT + 0.35 + n++ * 0.35;
        b.brain.followDrop = true;
      }
    }
    return true;
  }

  alive() {
    return this.actors.filter((a) => a.alive);
  }

  // ------------------------------------------------------------ messages
  /** A toast for one actor: the local player sees it here, remote humans over the network. */
  notify(a, text, color = '#ffffff', dur = 2) {
    if (!text || !a) return;
    if (a === this.player) this.hud.toast(text, color, dur);
    else if (a.remote && this.net && this.net.push) this.net.push(['ms', a.id, text, color, dur]);
  }

  notifyAll(text, color = '#ffffff', dur = 2.5) {
    this.hud.toast(text, color, dur);
    if (this.net && this.net.push) this.net.push(['ms', -1, text, color, dur]);
  }

  feed(msg) {
    this.hud.killfeed(msg, this.player);
    if (this.net && this.net.push) this.net.push(['kf', msg.a, msg.b, msg.how]);
  }

  /** A human left mid-match: a bot takes over their character. */
  botTakeover(a) {
    a.remote = null;
    a.human = false;
    a.name = a.name.replace(/ \(left\)$/, '') + ' (left) [BOT]';
    a.isBot = true;
    a.brain = new BotBrain(this, a, mulberry32(this.seed + a.id * 31));
    a.brain.dropTarget = a.pos.clone();
    a.brain.jumpT = 0;
    this.notifyAll(`${a.name.replace(' [BOT]', '')} disconnected — a bot took over.`, '#ffe9b0', 3);
  }

  // ------------------------------------------------------------ damage
  applyDamage(target, amount, src, opts = {}) {
    if (this.role === 'client') {
      if (target === this.player && opts.fall && this.net) this.net.cmd('x', Math.round(amount));
      return;
    }
    if (target === this.player && this.admin.god) return; // admin god mode
    if (target.isBoss) {
      if (this.state !== 'over') target.damage(amount * (src && src.buffs && src.buffs.spicy ? 1.2 : 1), src, opts);
      return;
    }
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
      if (this.net && this.net.push && ((src && src.remote) || target.remote)) this.net.push(['hm', src ? src.id : -1, target.id, d, 0, 0, Math.round(target.pos.x * 10), Math.round(target.pos.y * 10 + 5), Math.round(target.pos.z * 10)]);
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
    if (this.net && this.net.push && ((src && src.remote) || target.remote)) {
      const hp = opts.pos || target.eye;
      this.net.push(['hm', src ? src.id : -1, target.id, total, opts.head ? 1 : 0, res.shield > 0 && res.hp === 0 ? 1 : 0, Math.round(hp.x * 10), Math.round(hp.y * 10), Math.round(hp.z * 10)]);
    }
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
    if (c.vehicle) {
      this.vehicles.damage(c.vehicle, dmg, src);
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
    if (target.vehicle) this.vehicles.exit(target, true);
    if (target.carrying) this.dropCarried(target);
    if (target.carriedBy) this.dropCarried(target.carriedBy);
    target.zip = null;
    dropBucks(this, target);
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
      this.notify(killer, `You eliminated ${target.name}!`, '#ffd23f', 2);
    } else {
      msg = { a: null, b: target.name, how: opts.storm ? 'storm' : opts.fall ? 'fall' : 'out' };
    }
    this.feed(msg);
    const teamOut = !this.teams.teamsAlive().has(target.team);
    if (teamOut) this.teams.place[target.team] = teamsBefore;
    if (target === this.player) {
      const mate = this.actors.find((a) => a.alive && a.team === target.team);
      this.controller.spectate(mate || (killer && killer.alive ? killer : null));
      if (mate) this.hud.toast('Eliminated! Your squad can pick up your reboot card and bring you back.', '#39f0ff', 5);
      this.playerKiller = killer;
    } else if (target.remote && this.actors.some((a) => a.alive && a.team === target.team)) {
      this.notify(target, 'Eliminated! Your squad can pick up your reboot card and bring you back.', '#39f0ff', 5);
    }
    if (teamOut && target.team === this.player.team) this._finishPlayer(false, this.playerKiller);
    if (target.remote) target.killerName = killer ? killer.name : null;
    // remote humans whose squad is out get their result now
    if (teamOut) for (const h of this.actors) if (h.remote && h.team === target.team) this._sendResult(h, false);
    const teams = this.teams.teamsAlive();
    if (teams.size <= 1) {
      const wt = [...teams][0];
      const w = wt === undefined ? null : this.actors.find((a) => a.alive && a.team === wt);
      for (const a of this.actors) if (a.team === wt) a.place = 1;
      this.state = 'over';
      for (const h of this.actors) if (h.remote && h.team === wt) this._sendResult(h, true);
      if (this.net && this.net.push) this.net.push(['ov', w ? w.name : '', wt ?? -1, this.teamSize > 1 ? 1 : 0]);
      if (wt === this.player.team) this._finishPlayer(true, null);
      else this.hud.matchOver(w, this.teamSize > 1);
    }
  }

  /** Stats for one human's result screen (XP is computed on their own device). */
  _stats(a, won) {
    const place = won ? 1 : this.teams.place[a.team] || a.place;
    const ms = Object.fromEntries(Object.entries(a.stats).map(([k, v]) => [k, Math.round(v)]));
    return { won, place, total: Math.ceil(this.actors.length / this.teamSize), team: this.teamSize > 1, kills: a.kills, damage: Math.round(a.damageDealt), time: Math.floor(this.time), killer: a.killerName || null, ms, adm: this.adminUsed ? 1 : 0 };
  }

  _sendResult(h, won) {
    if (h.resultSent || !this.net || !this.net.push) return;
    h.resultSent = true;
    this.net.push(['res', h.id, this._stats(h, won)]);
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
    const st = this._stats(this.player, won);
    st.killer = killer ? killer.name : null;
    this.showNetResult(st);
  }

  /** Shows a result (local, or sent by the host) and saves XP on this device. */
  showNetResult(st) {
    if (this.result) return;
    const p = this.player;
    const { won, place, total: totalTeams, kills } = st;
    const survive = st.time;
    if (st.adm || this.adminUsed) {
      // admin tools were used in this match: it doesn't count for anyone
      this.result = { won, place, total: totalTeams, team: this.teamSize > 1, kills, damage: st.damage, time: survive, xp: 0, superXP: 0, chalXP: 0, levelUp: 0, killer: st.killer, admin: true };
      sfx.play(won ? 'win' : 'lose');
      if (won) p.emote = true;
      this.hud.playerResult(this.result);
      return;
    }
    const xp = 60 + kills * 75 + Math.round(st.damage / 4) + Math.floor(survive / 3) + Math.max(0, (totalTeams - place) * 8 * this.teamSize) + (won ? 400 : 0);
    const before = levelInfo(save.data.progress.xp).level;
    const pr = save.data.progress;
    const superXP = superchargeXP(xp); // daily Supercharged XP doubles it while the pool lasts
    const ch = applyChallenges(st.ms, { kills, damage: st.damage, place });
    const wk = applyWeekly(st.ms, { kills, damage: st.damage, place });
    const ach = applyAchievements(st.ms, { kills, won, team: this.teamSize > 1 });
    const questN = (st.ms && st.ms.quests) || 0;
    const questXP = questN * QUEST_XP; // story quests handed in this match
    const badgeN = this.badges.foundNow.length; // Benton Badges found on this device
    const badgeXP = badgeN * BADGE_XP;
    pr.xp += xp + superXP + ch.xp + wk.xp + ach.xp + questXP + badgeXP;
    // reaching a level can itself unlock an achievement (and its XP)
    refreshLevel();
    const ach2 = unlockReached();
    pr.xp += ach2.xp;
    pr.matches++;
    pr.kills += kills;
    if (won) pr.wins++;
    if (!pr.bestPlace || place < pr.bestPlace) pr.bestPlace = place;
    save.write();
    const after = levelInfo(pr.xp).level;
    const total = xp + superXP + ch.xp + wk.xp + ach.xp + ach2.xp + questXP + badgeXP;
    const passUp = addPassXP(total); // the Benton Pass fills with every XP point earned
    this.result = {
      won, place, total: totalTeams, team: this.teamSize > 1, kills, damage: st.damage, time: survive, xp: total, superXP, chalXP: ch.xp, challenges: ch.rows,
      questXP, quests: questN, badgeXP, badges: badgeN, weeklyXP: wk.xp, weekly: wk.rows.filter((w) => w.justDone), achXP: ach.xp + ach2.xp, achievements: [...ach.got, ...ach2.got], pass: passUp,
      levelUp: after > before ? after : 0, killer: st.killer,
    };
    if (this.ranked) this.result.ranked = applyRanked(this.mode, { won, place, total: totalTeams, kills }, this.lobbyRating);
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
    if (this.role === 'client') {
      this._clientUpdate(dt, t);
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
      if (a.brain) a.move(dt, this.admin.freezeBots ? FROZEN : a.brain.update(dt));
      a.tickTimers(dt);
    }
    this.vehicles.checkOccupants();
    this.vehicles.update(dt);
    this.boss.update(dt);
    this.quests.update(dt);
    this.eventFx.update(dt);
    this.updateCarry(dt);
    this.teams.update(dt);
    this.combat.update(dt);
    this.loot.update(dt, t);
    if (this.state !== 'over' && !this.admin.stormPaused) this.storm.update(dt, t);
    else this.storm.render(t);
    this._present(dt, t);
    if (this.net) this.net.update(dt);
  }

  /** Client: the host simulates; we move ourselves, mirror the rest and render. */
  _clientUpdate(dt, t) {
    this.time += dt;
    this.net.update(dt);
    if (this.bus.visible) {
      this.busT += dt;
      const k = Math.min(1, (this.busT * BUS_SPEED) / this.busLen);
      this.bus.position.lerpVectors(this.busFrom, this.busTo, k);
      this.bus.position.y = BUS_H + Math.sin(this.busT * 1.3) * 0.6;
      this.propeller.rotation.z += dt * 25;
    }
    for (const a of this.actors) if (a.state === 'bus') a.pos.copy(this.bus.position);
    const p = this.player;
    this.controller.update(dt);
    this.vehicles.clientUpdate(dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.equipT = Math.max(0, p.equipT - dt);
    this.net.smooth(dt);
    this.vehicles.placeOccupants();
    this.boss.smooth(dt);
    this.placeCarried();
    for (const pg of this.teams.pings) pg.t -= dt;
    this.teams.pings = this.teams.pings.filter((pg) => pg.t > 0);
    this.loot.update(dt, t, true);
    this.storm.render(t);
    this._netProjectiles();
    this._present(dt, t);
  }

  /** Client: simple visuals for rockets, grenades and sniper rounds in flight. */
  _netProjectiles() {
    const list = this.netProjectiles || [];
    if (!this._pj) this._pj = [];
    while (this._pj.length < list.length) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff5ca8' }));
      this.scene.add(m);
      this._pj.push(m);
    }
    this._pj.forEach((m, i) => {
      const r = list[i];
      m.visible = !!r;
      if (r) {
        m.position.set(r[1] / 10, r[2] / 10, r[3] / 10);
        m.material.color.set(r[0] === 0 ? '#bff3ff' : '#ff5ca8');
      }
    });
  }

  // ---- client callbacks from ClientNet
  onLocalEliminated() {
    const p = this.player;
    const mate = this.actors.find((a) => a.alive && a.team === p.team && a !== p);
    this.controller.spectate(mate || this.actors.find((a) => a.alive && a !== p) || null);
    this.controller.exitEdit();
    this.building.hideGhost();
  }

  onLocalRevived() {
    this.controller.spectating = false;
    this.controller.spec = null;
    this.menus?.hide();
    this.hud.toast("You're back in the match!", '#39f0ff', 3);
  }

  onNetOver(name, team, squads) {
    this.state = 'over';
    if (team !== this.player.team) this.hud.matchOver(name ? { name } : null, squads);
  }

  _present(dt, t) {
    this.world.update(dt, t);
    this.boss.present(dt, t);
    this.quests.present(dt, t);
    this.badges.update(dt, t);
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

  // ------------------------------------------------------------ doors, vault, carrying (host)
  /** Opens/closes door i. `a` (optional) must be next to it. */
  toggleDoor(i, a = null) {
    const d = this.world.doors[i];
    if (!d || d.broken) return false;
    if (a && (a.pos.distanceTo(d.pos) > 3.2 || !a.canAct())) return false;
    const open = !d.open;
    if (!open) {
      // don't shut a door on someone standing in it
      for (const o of this.actors) if (o.alive && Math.abs(o.pos.x - d.pos.x) < 1.3 && Math.abs(o.pos.z - d.pos.z) < 0.7 && Math.abs(o.pos.y - d.pos.y) < 2) return false;
    }
    this.world.setDoor(i, open);
    if (open && a) a.stats.doors++;
    sfx.play('door', d.pos);
    this.net?.push?.(['dr', i, open ? 1 : 0]);
    return true;
  }

  hasKey(a) {
    return a.slots.findIndex((s) => s && s.kind === 'key');
  }

  /** Opens the vault with a keycard in `a`'s inventory. Returns a message. */
  openVault(a) {
    const v = this.world.vault;
    if (!v || v.open) return null;
    if (a.pos.distanceTo(v.pos) > 3.6 || !a.canAct()) return null;
    const k = this.hasKey(a);
    if (k < 0) return { text: 'Locked. Defeat Crankbolt for the Vault Keycard.', color: '#ff8a8a' };
    a.slots[k] = null;
    if (a.sel === k) a.sel = -1;
    this.world.openVault();
    a.stats.vault++;
    sfx.play('vault', v.pos);
    this.net?.push?.(['vo']);
    this.loot.drop({ kind: 'coin', id: 'bucks', count: 200 }, v.inside.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 3, 0));
    this.notifyAll(`${a.name.replace(' [BOT]', '')} opened Crankbolt's Vault!`, '#ffd23f', 3.5);
    return { text: 'The vault is open!', color: '#ffd23f' };
  }

  /** Picks up a knocked teammate (or puts them down if already carrying). */
  carry(a, m) {
    if (a.carrying) return this.dropCarried(a);
    if (!m || !m.alive || !m.downed || m.team !== a.team || m.carriedBy || a.vehicle || !a.canAct() || m.pos.distanceTo(a.pos) > 2.8) return false;
    a.carrying = m;
    m.carriedBy = a;
    a.cancelActions();
    a.ads = a.building = false;
    a.reviveTarget = m.reviveTarget = null;
    m.ep = (m.ep | 0) + 1;
    this.notify(a, `Carrying ${m.name}. X puts them down.`, '#7ed957', 2);
    return true;
  }

  dropCarried(a) {
    const m = a.carrying;
    if (!m) return false;
    a.carrying = null;
    m.carriedBy = null;
    const f = new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
    const x = a.pos.x + f.x * 1.1, z = a.pos.z + f.z * 1.1;
    const y = this.world.physics.groundAt(x, z, a.pos.y + 1).y;
    const blocked = Math.abs(y - a.pos.y) > 1.5;
    m.pos.set(blocked ? a.pos.x : x, (blocked ? a.pos.y : y) + 0.3, blocked ? a.pos.z : z);
    m.vel.set(f.x * 2, 2, f.z * 2);
    m.state = 'air';
    m.grounded = false;
    m.ep = (m.ep | 0) + 1;
    return true;
  }

  /** Host: carried teammates ride on their carrier's shoulders. */
  updateCarry(dt) {
    for (const a of this.actors) {
      const m = a.carrying;
      if (!m) continue;
      if (!a.alive || a.downed || a.vehicle || a.state === 'zip' || !m.alive || !m.downed) {
        if (m.carriedBy === a && m.alive && m.downed) this.dropCarried(a);
        else {
          a.carrying = null;
          if (m.carriedBy === a) m.carriedBy = null;
        }
        continue;
      }
      if (a.stats) a.stats.carried = (a.stats.carried || 0) + Math.hypot(a.vel.x, a.vel.z) * dt;
    }
    this.placeCarried();
  }

  placeCarried() {
    for (const a of this.actors) {
      const m = a.carrying;
      if (!m) continue;
      m.pos.set(a.pos.x, a.pos.y + 1.15, a.pos.z);
      m.vel.set(0, 0, 0);
      m.yaw = a.yaw + Math.PI / 2;
      m.state = 'ground';
      m.grounded = true;
    }
  }

  onStormShrink(phase) {
    if (phase === 1 || phase === 3) {
      const n = this.storm.next;
      const a = this.rng() * Math.PI * 2, r = this.rng() * n.r * 0.6;
      this.loot.supplyDrop(n.c.x + Math.cos(a) * r, n.c.y + Math.sin(a) * r);
      this.notifyAll('A supply drop is floating down!', '#3f9bff');
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
