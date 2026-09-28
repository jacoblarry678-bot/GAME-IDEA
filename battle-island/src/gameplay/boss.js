/**
 * Crankbolt, the vault guardian: a giant robot that patrols the plateau in
 * front of Crankbolt's Vault. It fires rocket volleys, stomps anyone who gets
 * close, never strays far from home, and slowly repairs itself when left
 * alone. Defeating it drops the Vault Keycard, a Mythic weapon and Bucks.
 *
 * It isn't a player: it doesn't count toward players left or placement. It
 * looks enough like an actor (pos, eye, team, name…) for combat, bots and the
 * killfeed to treat it as an opponent. The host simulates it; clients mirror
 * a snapshot row.
 */

import * as THREE from 'three';
import { Collider, GRAVITY } from '../world/physics.js';
import { boxGeo, mat } from '../world/island.js';
import { makeWeapon } from './items.js';
import { sfx } from '../core/audio.js';

export const BOSS_HP = 2000;
const SIZE = 1.35; // model scale
const AGGRO = 30, LEASH = 20, TERRITORY = 34, RANGE = 16, HEIGHT = 4.4 * SIZE;
const ROCKET = { projectile: { radius: 3.5, structDmg: 160, speed: 34 }, head: 1 };
const ST = ['idle', 'walk', 'windup', 'dead'];

export class Boss {
  constructor(game) {
    this.game = game;
    const V = game.world.vault;
    this.home = V.home.clone();
    this.pos = this.home.clone();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.hp = BOSS_HP;
    this.maxHp = BOSS_HP;
    this.alive = true;
    this.isBoss = true;
    this.name = 'Crankbolt [BOSS]';
    this.team = -99;
    this.state = 'ground';
    this.downed = false;
    this.buffs = {};
    this.kills = 0;
    this.damageDealt = 0;
    this.stats = {};
    this.height = HEIGHT;
    this.mode = 'idle';
    this.target = null;
    this.aggro = new Map(); // actor -> seconds of anger left
    this.fireCd = 3;
    this.shots = 0;
    this.volley = 0;
    this.volleyT = 0;
    this.stompCd = 2;
    this.windup = 0;
    this.calmT = 0;
    this.walkT = 0;
    this.hitT = 0;
    this.lastHitBy = null;
    this.net = null;
    this.model = bossModel();
    game.scene.add(this.model.root);
    this.col = new Collider({ kind: 'boss', minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 });
    this.col.wid = -1;
    this.col.noRay = true; // bullets use the boss's own hitbox (head + body), not this wall
    this._sync();
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 3.9 * SIZE, this.pos.z);
  }

  get enraged() {
    return this.hp < this.maxHp / 2;
  }

  /** Head sphere and body box for hit tests. */
  hitbox() {
    const p = this.pos;
    return { head: { x: p.x, y: p.y + 3.95 * SIZE, z: p.z, r: 0.75 * SIZE }, body: [p.x - 1.25 * SIZE, p.y, p.z - 1.0 * SIZE, p.x + 1.25 * SIZE, p.y + 3.4 * SIZE, p.z + 1.0 * SIZE] };
  }

  _sync() {
    const phys = this.game.world.physics;
    const c = this.col;
    if (c._cells.length) phys.remove(c);
    if (!this.alive) return;
    Object.assign(c, { minX: this.pos.x - 1.2 * SIZE, maxX: this.pos.x + 1.2 * SIZE, minZ: this.pos.z - 1.0 * SIZE, maxZ: this.pos.z + 1.0 * SIZE, minY: this.pos.y, maxY: this.pos.y + 3.4 * SIZE });
    phys.add(c);
    c.alive = true;
  }

  // ------------------------------------------------------------ host
  damage(amount, src, opts = {}) {
    const g = this.game;
    if (!this.alive || amount <= 0 || g.role === 'client') return;
    amount = Math.round(amount);
    this.hp -= amount;
    this.hitT = 0.12;
    this.calmT = 0;
    if (src && src.stats) {
      src.stats.bossDmg = (src.stats.bossDmg || 0) + amount;
      src.damageDealt += amount;
      this.aggro.set(src, 12);
    }
    const at = opts.pos || this.eye;
    if (src === g.player) {
      g.hud.hitmarker(!!opts.head, false);
      g.hud.damageNumber(at, amount, !!opts.head, false);
      sfx.play(opts.head ? 'head' : 'hit');
    } else if (src && src.remote && g.net && g.net.push) {
      g.net.push(['hm', src.id, -2, amount, opts.head ? 1 : 0, 0, Math.round(at.x * 10), Math.round(at.y * 10), Math.round(at.z * 10)]);
    }
    if (this.hp <= 0) this.die(src);
  }

  die(killer) {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    this.mode = 'dead';
    this._sync();
    const at = this.pos.clone().add(new THREE.Vector3(0, 2, 0));
    g.effects.explosion(at, 6);
    g.effects.confetti(at);
    sfx.play('explosion', at);
    g.feed({ a: killer ? killer.name : null, b: this.name, how: 'boss' });
    g.notifyAll(`${killer ? killer.name.replace(' [BOT]', '') : 'Someone'} took down Crankbolt! The Vault Keycard dropped.`, '#ffd23f', 4);
    if (killer && killer.stats) killer.stats.bosses = (killer.stats.bosses || 0) + 1;
    const drop = (it, a) => g.loot.drop(it, at.clone(), new THREE.Vector3(Math.cos(a) * 3, 6, Math.sin(a) * 3));
    drop({ kind: 'key', id: 'vault', count: 1 }, 0);
    drop(makeWeapon('ar', 5), 2.1);
    drop({ kind: 'ammo', id: 'medium', count: 90 }, 2.6);
    drop({ kind: 'coin', id: 'bucks', count: 150 }, 4.2);
    drop({ kind: 'consumable', id: 'bigshield', count: 2 }, 5.2);
  }

  /** Who Crankbolt goes after: whoever hurt it recently, else the nearest visible player. */
  _pickTarget() {
    const g = this.game;
    const phys = g.world.physics;
    const eye = this.eye;
    let best = null, bd = Infinity;
    for (const a of g.actors) {
      if (!a.alive || a.state === 'bus' || a.state === 'skydive' || a.state === 'glide') continue;
      const home = Math.hypot(a.pos.x - this.home.x, a.pos.z - this.home.z);
      const d = a.pos.distanceTo(this.pos);
      const angry = (this.aggro.get(a) || 0) > 0;
      if (home > TERRITORY || (!angry && d > AGGRO)) continue; // it guards its hilltop, not the whole island
      const t = a.eye;
      if (!phys.lineOfSight(eye.x, eye.y, eye.z, t.x, t.y - 0.3, t.z)) continue;
      const score = d - (angry ? 25 : 0) - (a.downed ? -30 : 0);
      if (score < bd) { bd = score; best = a; }
    }
    return best;
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) return;
    for (const [a, t] of this.aggro) {
      if (t - dt <= 0 || !a.alive) this.aggro.delete(a);
      else this.aggro.set(a, t - dt);
    }
    this.hitT = Math.max(0, this.hitT - dt);
    if ((this.walkT -= dt) <= 0) {
      this.walkT = 0.4;
      this.target = this._pickTarget();
    }
    const T = this.target && this.target.alive ? this.target : null;
    let goal = this.home;
    let speed = 3.2;
    if (T) {
      this.calmT = 0;
      const d = Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
      goal = d > RANGE ? T.pos : this.pos;
      speed = this.enraged ? 4.6 : 3.6;
      this._face(T.pos, dt);
      this._attack(T, d, dt);
    } else {
      this.calmT += dt;
      // left alone at home: slowly repairs itself
      if (this.calmT > 6 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 60 * dt);
    }
    if (this.windup > 0) speed = 0;
    // walk (never far from home)
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.vel.set(0, this.vel.y, 0);
    if (dist > 1.5) {
      const k = Math.min(speed, dist) / dist;
      this.vel.x = dx * k;
      this.vel.z = dz * k;
      const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
      if (Math.hypot(nx - this.home.x, nz - this.home.z) < LEASH) {
        this.pos.x = nx;
        this.pos.z = nz;
      }
      if (!T) this._face(goal, dt);
    }
    const gy = g.world.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 1).y;
    if (this.pos.y > gy + 0.05) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y = Math.max(gy, this.pos.y + this.vel.y * dt);
    } else {
      this.pos.y = gy;
      this.vel.y = 0;
    }
    this.mode = this.windup > 0 ? 'windup' : Math.hypot(this.vel.x, this.vel.z) > 0.3 ? 'walk' : 'idle';
    this._sync();
  }

  _face(p, dt) {
    const want = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z));
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 4);
  }

  _attack(T, d, dt) {
    const g = this.game;
    // stomp: anyone too close gets a shockwave after a short wind-up
    this.stompCd -= dt;
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this._stomp();
      return;
    }
    if (d < 6.5 && this.stompCd <= 0) {
      this.windup = this.enraged ? 0.7 : 1.0;
      this.stompCd = this.enraged ? 3.5 : 5;
      sfx.play('boss', this.pos);
      return;
    }
    // rocket volleys
    this.fireCd -= dt;
    if (this.fireCd <= 0 && this.volley === 0) {
      this.volley = this.enraged ? 4 : 3;
      this.volleyT = 0;
      this.fireCd = this.enraged ? 2.4 : 3.6;
    }
    if (this.volley > 0 && (this.volleyT -= dt) <= 0) {
      this.volley--;
      this.volleyT = 0.18;
      const side = this.volley % 2 ? 1 : -1;
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const from = this.pos.clone().add(new THREE.Vector3(0, 3.3 * SIZE, 0)).addScaledVector(r, side * 1.2 * SIZE).addScaledVector(f, 1.0 * SIZE);
      // aim where they're heading, with a little scatter
      const lead = Math.min(1, d / 34);
      const to = T.pos.clone().addScaledVector(T.vel, lead * 0.8).add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 1 + (Math.random() - 0.5), (Math.random() - 0.5) * 2.4));
      const dir = to.sub(from).normalize();
      const mesh = new THREE.Mesh(g.combat.rocketGeo, g.combat.rocketMat);
      g.scene.add(mesh);
      g.combat.projectiles.push({ kind: 'rocket', pos: from, vel: dir.multiplyScalar(ROCKET.projectile.speed), gravity: 0, src: this, w: ROCKET, dmg: 32, life: 3, mesh, trail: 0 });
      sfx.play('rocket', from);
      this.shots++;
    }
  }

  _stomp() {
    const g = this.game;
    const at = this.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    g.effects.explosion(at, 7);
    g.effects.shake = Math.min(1, g.effects.shake + 0.5);
    for (const a of g.actors) {
      if (!a.alive || a.state === 'bus' || a.vehicle) continue;
      const d = Math.hypot(a.pos.x - at.x, a.pos.z - at.z);
      if (d > 7.5 || Math.abs(a.pos.y - at.y) > 3) continue;
      g.applyDamage(a, 45 * (1 - d / 15), this, { pos: a.eye, explosive: true });
      if (!a.remote && a.alive) {
        const k = 9 / Math.max(1, d);
        a.vel.set(((a.pos.x - at.x) / Math.max(0.1, d)) * k, 8, ((a.pos.z - at.z) / Math.max(0.1, d)) * k);
        if (a.state === 'ground') a.state = 'air';
        a.grounded = false;
      }
    }
  }

  // ------------------------------------------------------------ network
  row() {
    return [Math.round(this.pos.x * 10), Math.round(this.pos.y * 10), Math.round(this.pos.z * 10), Math.round(this.yaw * 100), Math.max(0, Math.ceil(this.hp)), ST.indexOf(this.mode)];
  }

  applyRow(r) {
    const wasAlive = this.alive;
    this.hp = r[4];
    this.mode = ST[r[5]] || 'idle';
    this.alive = this.mode !== 'dead';
    this.net = { x: r[0] / 10, y: r[1] / 10, z: r[2] / 10, yaw: r[3] / 100 };
    if (wasAlive && !this.alive) this._sync();
  }

  /** Client: ease toward the host's copy. */
  smooth(dt) {
    const n = this.net;
    if (!n || !this.alive) return;
    const k = Math.min(1, dt * 10);
    this.pos.x += (n.x - this.pos.x) * k;
    this.pos.y += (n.y - this.pos.y) * k;
    this.pos.z += (n.z - this.pos.z) * k;
    let d = n.yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * k;
    this._sync();
  }

  // ------------------------------------------------------------ visuals
  present(dt, t) {
    const m = this.model;
    m.root.visible = this.alive;
    if (!this.alive) return;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    const walking = this.mode === 'walk';
    const s = walking ? Math.sin(t * 5) : 0;
    m.legL.rotation.x = s * 0.5;
    m.legR.rotation.x = -s * 0.5;
    m.armL.rotation.x = -s * 0.35;
    m.body.position.y = 2.25 + (walking ? Math.abs(s) * 0.12 : 0) - (this.mode === 'windup' ? 0.35 : 0);
    m.armR.rotation.x = this.mode === 'windup' ? -2.4 : 0.2 + s * 0.3;
    m.visor.material.color.set(this.hitT > 0 ? '#ffffff' : this.enraged ? '#ff4b4b' : '#39f0ff');
  }

  /** Admin: back to full health at home. */
  reset() {
    this.alive = true;
    this.hp = this.maxHp;
    this.pos.copy(this.home);
    this.vel.set(0, 0, 0);
    this.mode = 'idle';
    this.target = null;
    this.aggro.clear();
    this.windup = 0;
    this.volley = 0;
    this._sync();
  }

  dispose() {
    this.alive = false;
    this._sync();
    this.game.scene.remove(this.model.root);
  }
}

function bossModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2.25;
  const torso = new THREE.Mesh(boxGeo(2.4, 1.9, 1.6), mat('#ff8a3d', 'metal'));
  const belly = new THREE.Mesh(boxGeo(1.4, 0.8, 0.1), mat('#1d2a3a', null, { emissive: '#0b2a33' }));
  belly.position.set(0, -0.2, -0.82);
  const head = new THREE.Mesh(boxGeo(1.3, 1.0, 1.2), mat('#9fb2c4', 'metal'));
  head.position.y = 1.6;
  const visor = new THREE.Mesh(boxGeo(1.1, 0.3, 0.06), new THREE.MeshBasicMaterial({ color: '#39f0ff' }));
  visor.position.set(0, 1.65, -0.62);
  const jaw = new THREE.Mesh(boxGeo(0.9, 0.2, 0.1), mat('#5a5a62', 'metal'));
  jaw.position.set(0, 1.25, -0.62);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), mat('#dddddd'));
  ant.position.set(0.4, 2.4, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4b4b' }));
  tip.position.set(0.4, 2.8, 0);
  // shoulder rocket pods
  for (const x of [-1.2, 1.2]) {
    const pod = new THREE.Mesh(boxGeo(0.7, 0.6, 1.0), mat('#3a3f4a', 'metal'));
    pod.position.set(x, 1.05, 0.1);
    body.add(pod);
    for (const dx of [-0.15, 0.15]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), mat('#ff4b4b'));
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x + dx, 1.05, -0.42);
      body.add(tube);
    }
  }
  const arm = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.55, 0);
    const upper = new THREE.Mesh(boxGeo(0.55, 1.5, 0.55), mat('#5a5a62', 'metal'));
    upper.position.y = -0.75;
    const fist = new THREE.Mesh(boxGeo(0.8, 0.7, 0.8), mat('#ff8a3d', 'metal'));
    fist.position.y = -1.7;
    g.add(upper, fist);
    return g;
  };
  const armL = arm(-1.55), armR = arm(1.55);
  body.add(torso, belly, head, visor, jaw, ant, tip, armL, armR);
  const leg = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 1.45, 0);
    const l = new THREE.Mesh(boxGeo(0.7, 1.45, 0.8), mat('#5a5a62', 'metal'));
    l.position.y = -0.72;
    const foot = new THREE.Mesh(boxGeo(0.9, 0.3, 1.2), mat('#3a3f4a', 'metal'));
    foot.position.set(0, -1.3, -0.15);
    g.add(l, foot);
    return g;
  };
  const legL = leg(-0.65), legR = leg(0.65);
  const scaled = new THREE.Group();
  scaled.scale.setScalar(SIZE);
  scaled.add(body, legL, legR);
  root.add(scaled);
  root.traverse((o) => (o.castShadow = true));
  return { root, body, legL, legR, armL, armR, visor };
}
