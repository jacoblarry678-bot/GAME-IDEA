/**
 * In-match networking. The host's browser runs the real simulation; this
 * file streams it to clients and feeds clients' movement and actions back.
 *
 *  host  → presence `ss` (all actors, storm, bus, projectiles, ~15/s)
 *        → presence `pv` (each remote human's private inventory state)
 *        → topic `fx`   (batched moments: shots, hits, builds, pickups…)
 *        → topic `sync` (periodic full lists so dropped moments heal)
 *  client→ presence `me` (own position/state, client-simulated movement)
 *        → presence `q`  (recent commands with sequence numbers)
 *
 * Everything travels through the `room` interface (claude.ai artifact room
 * or the self-hosted relay's identical shim), within its 4 KiB limits.
 */

import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { WEAPONS, PICKAXE } from '../gameplay/items.js';
import { buy, upgrade } from '../gameplay/economy.js';

export const PROTO = 1;
export const MAX_HUMANS = 4;
const ST = ['bus', 'skydive', 'glide', 'ground', 'air', 'swim', 'mantle', 'drive', 'zip'];
export const HELD = ['none', 'pickaxe', 'ar', 'smg', 'shotgun', 'pistol', 'sniper', 'launcher', 'boomball'];
const POSE = ['none', 'gun', 'pickaxe', 'build', 'heal', 'throw'];
const FL = { alive: 1, downed: 2, crouch: 4, emote: 8, ads: 16, build: 32, sprint: 64, slide: 128, holdE: 256 };
const KIND = ['weapon', 'consumable', 'throwable', 'ammo', 'mat', 'card', 'coin'];
const AMMO_K = ['light', 'medium', 'heavy', 'shells', 'rockets'];
const MAT_K = ['wood', 'brick', 'metal'];
const r10 = (v) => Math.round(v * 10);
const r100 = (v) => Math.round(v * 100);
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
const CHUNK = 3600;

function flagsOf(a) {
  let f = 0;
  if (a.alive) f |= FL.alive;
  if (a.downed) f |= FL.downed;
  if (a.crouch) f |= FL.crouch;
  if (a.emote) f |= FL.emote;
  if (a.ads) f |= FL.ads;
  if (a.building) f |= FL.build;
  if (a.sprinting) f |= FL.sprint;
  if (a.slideT > 0) f |= FL.slide;
  return f;
}

/** Splits rows into ≤CHUNK-byte arrays. */
function chunk(rows) {
  const out = [];
  let cur = [], size = 0;
  for (const r of rows) {
    const b = bytes(r) + 1;
    if (size + b > CHUNK && cur.length) { out.push(cur); cur = []; size = 0; }
    cur.push(r);
    size += b;
  }
  if (cur.length || !out.length) out.push(cur);
  return out;
}

export function tilesToBits(t) {
  return t ? t.reduce((m, v, i) => m | (v ? 1 << i : 0), 0) : -1;
}
export function bitsToTiles(bits, n) {
  return bits < 0 ? null : Array.from({ length: n }, (_, i) => !!(bits & (1 << i)));
}

export function pickupRow(pk) {
  const it = pk.it;
  const k = KIND.indexOf(it.kind);
  const pos = [r10(pk.pos.x), r10(pk.pos.y), r10(pk.pos.z)];
  if (it.kind === 'weapon') return [pk.nid, k, it.id, it.rarity, ...pos, it.mag];
  if (it.kind === 'card') return [pk.nid, k, it.id, it.team, ...pos, it.name];
  return [pk.nid, k, it.id, it.count, ...pos];
}

export function pieceRow(p) {
  const b = p.box;
  return [p.key, p.type, p.dir, p.axisX ? 1 : 0, r10(p.b), r10(b.minX), r10(b.minY), r10(b.minZ), r10(b.maxX), r10(b.maxY), r10(b.maxZ), p.material, Math.ceil(p.hp), p.maxHp, tilesToBits(p.tiles), p.team];
}

// ====================================================================== host
export class HostNet {
  constructor(game, room) {
    this.game = game;
    this.room = room;
    this.fx = [];
    this.sendT = 0;
    this.fxT = 0;
    this.syncT = 0.5;
    this.cycle = 0;
    this.seq = new Map(); // actor id -> last command seq handled
    this.gone = new Set();
  }

  push(ev) {
    this.fx.push(ev);
  }

  seatOf(peer) {
    return this.game.actors.find((a) => a.remote === peer);
  }

  update(dt) {
    const g = this.game;
    const peers = this.room.peers();
    const here = new Set(peers.map((p) => p.peer));
    for (const pr of peers) {
      if (pr.isMe) continue;
      const a = this.seatOf(pr.peer);
      if (a) this._applyClient(a, pr.presence || {});
    }
    // players who left: a bot takes over so the match stays fair
    for (const a of g.actors) {
      if (!a.remote || here.has(a.remote) || this.gone.has(a)) continue;
      this.gone.add(a);
      g.botTakeover(a);
    }
    if ((this.sendT -= dt) <= 0) {
      this.sendT = 1 / 12; // presence + emits share a ~40/s budget
      this.room.presence({ ss: this.snapshot(), pv: this.privates() }).catch(() => {});
    }
    if ((this.fxT -= dt) <= 0) {
      this.fxT = 0.1;
      this._flushFx();
    }
    if ((this.syncT -= dt) <= 0) {
      this.syncT = 1.5;
      this._fullSync();
    }
  }

  _applyClient(a, pr) {
    const me = pr.me;
    if (me && a.alive && a.state !== 'bus' && (me[10] | 0) === (a.ep | 0)) {
      const st = ST[me[8]];
      const nx = me[0] / 10, ny = me[1] / 10, nz = me[2] / 10;
      if (a.vehicle && Array.isArray(pr.mv)) this.game.vehicles.applyDriver(a, pr.mv);
      if (st === 'zip' && a.state !== 'zip') a.stats.zips++;
      // client-simulated movement, with a sanity cap on teleports (seats are placed by the host)
      if (st && st !== 'bus' && !a.vehicle && st !== 'drive' && Math.hypot(nx - a.pos.x, nz - a.pos.z) < 60) {
        a.pos.set(nx, ny, nz);
        a.vel.set(me[3] / 10, me[4] / 10, me[5] / 10);
        a.aimYaw = a.yaw = me[6] / 100;
        a.aimPitch = me[7] / 100;
        a.state = st;
        a.grounded = st === 'ground';
      }
      const f = me[9] | 0;
      a.crouch = !!(f & FL.crouch);
      a.emote = !!(f & FL.emote) && a.canAct();
      a.ads = !!(f & FL.ads) && !!a.weapon;
      a.building = !!(f & FL.build);
      a.sprinting = !!(f & FL.sprint);
      a.slideT = f & FL.slide ? 0.3 : 0;
      this._hold(a, !!(f & FL.holdE));
    }
    const q = pr.q;
    if (Array.isArray(q)) {
      let last = this.seq.get(a.id) || 0;
      for (const c of q) {
        if (!Array.isArray(c) || c[0] <= last) continue;
        last = c[0];
        try {
          this._exec(a, c);
        } catch (e) {
          console.warn('[net] bad command', c, e);
        }
      }
      this.seq.set(a.id, last);
    }
  }

  _hold(a, on) {
    const g = this.game;
    if (!on || !a.canAct()) {
      a.reviveTarget = null;
      a.rebootVan = null;
      return;
    }
    const mate = g.actors.find((o) => o !== a && o.alive && o.downed && o.team === a.team && o.pos.distanceTo(a.pos) < 2.4);
    if (mate) a.reviveTarget = mate;
    else if (a.cards.length) a.rebootVan = g.teams.nearestVan(a.pos, 3.4);
  }

  _exec(a, c) {
    const g = this.game;
    const dir = () => new THREE.Vector3(c[2], c[3], c[4]).normalize();
    switch (c[1]) {
      case 'j': g.jumpFromBus(a); break;
      case 'f': g.combat.fire(a, dir()); break;
      case 'w': g.combat.swing(a, dir()); break;
      case 't': g.combat.throwItem(a, dir()); break;
      case 's': if (c[2] >= -1 && c[2] < 5) a.select(c[2]); break;
      case 'r': a.startReload(); break;
      case 'u': if (a.canAct() && !a.startUse()) g.notify(a, "You don't need that right now."); break;
      case 'd': if (a.canAct()) g.loot.dropSelected(a); break;
      case 'o': {
        const ch = g.world.chests[c[2]];
        if (ch && !ch.opened && a.canAct() && ch.pos.distanceTo(a.pos) < 4) g.loot.openChest(a, ch);
        break;
      }
      case 'k': {
        const pk = g.loot.pickups.find((k) => k.nid === c[2]);
        if (pk && a.canAct() && pk.pos.distanceTo(a.pos) < 4.5 && g.loot.take(a, pk) === 'full') g.notify(a, 'Inventory full: select a slot (1-5) to swap it out.', '#ff8a8a');
        break;
      }
      case 'b': {
        if (!a.canAct() || g.mode === 'zerobuild') break;
        const s = g.building.spot(a, c[2], c[3] / 100, c[4] / 100);
        if (c[2] === 'ramp') s.dir = (s.dir + (c[5] | 0)) % 4;
        if (!g.building.place(a, s, c[6]) && a.mats[c[6]] < 10) g.notify(a, `Not enough ${c[6]}! Harvest with the pickaxe.`, '#ff8a8a');
        break;
      }
      case 'e': {
        const p = g.building.occupied.get(c[2]);
        if (p && p.team === a.team && g.building.editable(p)) g.building.applyEdit(p, bitsToTiles(c[3], p.type === 'wall' ? 9 : 4));
        break;
      }
      case 'p': {
        const p = g.building.occupied.get(c[2]);
        if (p && a.canAct()) g.notify(a, g.building.repairOrUpgrade(a, p), '#ffe9b0');
        break;
      }
      case 'g': g.teams.ping(a, new THREE.Vector3(c[2] / 10, c[3] / 10, c[4] / 10)); break;
      case 'x': g.applyDamage(a, Math.min(200, Math.max(0, c[2])), null, { fall: true }); break;
      case 've': {
        const v = g.vehicles.list[c[2]];
        if (v && a.canAct() && !a.vehicle && v.pos.distanceTo(a.pos) < 7) g.vehicles.enter(a, v);
        break;
      }
      case 'vx': if (a.vehicle) g.vehicles.exit(a); break;
      case 'by': {
        const r = buy(g, a, c[2] | 0, c[3] | 0);
        if (r) g.notify(a, r.text, r.color);
        break;
      }
      case 'ug': {
        const r = upgrade(g, a, c[2] | 0);
        if (r) g.notify(a, r.text, r.color);
        break;
      }
      default: break;
    }
  }

  snapshot() {
    const g = this.game;
    const st = g.storm;
    return {
      t: r10(g.time),
      b: g.bus.visible ? r10(g.busT) : -1,
      gs: g.state === 'over' ? 2 : g.state === 'bus' ? 0 : 1,
      a: g.actors.map((a) => {
        if (!a.alive) return [a.id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, a.kills, a.ep | 0];
        const h = a.heldInfo();
        return [a.id, r10(a.pos.x), r10(a.pos.y), r10(a.pos.z), r100(a.yaw), r100(a.aimPitch), r10(a.vel.x), r10(a.vel.y), r10(a.vel.z), ST.indexOf(a.state), flagsOf(a), HELD.indexOf(h.key) * 100 + POSE.indexOf(h.pose) * 10 + (h.rarity | 0), Math.ceil(a.hp), Math.ceil(a.shield), Math.ceil(a.overshield), a.kills, a.ep | 0];
      }),
      s: [r10(st.center.x), r10(st.center.y), r10(st.radius), r10(st.next.c.x), r10(st.next.c.y), r10(st.next.r), ['wait', 'shrink', 'done'].indexOf(st.stage), r10(st.timer), st.phase],
      pj: g.combat.projectiles.slice(0, 12).map((p) => [p.kind === 'grenade' ? 2 : p.kind === 'rocket' ? 1 : 0, r10(p.pos.x), r10(p.pos.y), r10(p.pos.z)]),
      vh: g.vehicles.rows(),
    };
  }

  privates() {
    const out = {};
    for (const a of this.game.actors) {
      if (!a.remote) continue;
      out['a' + a.id] = {
        sl: a.slots.map((s) => (s ? [KIND.indexOf(s.kind), s.id, s.rarity | 0, s.kind === 'weapon' ? s.mag : s.count] : 0)),
        se: a.sel,
        am: AMMO_K.map((k) => a.ammo[k]),
        mt: MAT_K.map((k) => a.mats[k]),
        bf: Object.entries(a.buffs).map(([k, v]) => [k, r10(v)]),
        cd: a.cards,
        us: a.use ? [a.use.slot, r10(a.use.t), r10(a.use.total)] : 0,
        rl: a.reloadT > 0 ? [r10(a.reloadT), r10(a.reloadTotal)] : 0,
        dh: r10(a.downHp),
        rv: r10(a.reviveT),
        rb: r10(a.rebootT),
        rd: a.canRedeploy ? 1 : 0,
        bk: a.bucks,
      };
    }
    return out;
  }

  _flushFx() {
    if (!this.fx.length) return;
    let ev = this.fx;
    this.fx = [];
    // cosmetic events go first if a burst of action would blow the budget
    if (bytes(ev) > CHUNK * 2) ev = ev.filter((e) => e[0] !== 'bu' && e[0] !== 'sd');
    if (bytes(ev) > CHUNK * 2) ev = ev.filter((e) => e[0] !== 'tr' && e[0] !== 'mz');
    for (const part of chunk(ev).slice(0, 2)) this.room.emit('fx', { e: part }).catch((e) => this._denied(e));
  }

  /** Viewers without contribute access can join but not host (their broadcasts are refused). */
  _denied(e) {
    if (!e || e.code !== 'not_permitted' || this.warned) return;
    this.warned = true;
    this.game.hud.toast('Hosting needs contribute (or edit) access to this game link. Ask the person who shared it to host, then join.', '#ff8a8a', 8);
  }

  _fullSync() {
    const g = this.game;
    const c = ++this.cycle;
    const send = (k, rows) => {
      const parts = chunk(rows);
      parts.forEach((d, i) => this.room.emit('sync', { k, c, i, n: parts.length, d }).catch((e) => this._denied(e)));
    };
    send('pk', g.loot.pickups.map(pickupRow));
    send('pc', [...g.building.pieces].map(pieceRow));
    const extra = g.world.chests.slice(g.world.baseChests).map((ch, i) => [g.world.baseChests + i, r10(ch.pos.x), r10(ch.pos.y), r10(ch.pos.z), ch.legendary ? 1 : 0, ch.supply ? 1 : 0]);
    send('ch', [g.world.chests.map((ch, i) => (ch.opened ? i : -1)).filter((i) => i >= 0), extra, g.world.destroyed]);
  }
}

// ==================================================================== client
export class ClientNet {
  constructor(game, room, hostPeer) {
    this.game = game;
    this.room = room;
    this.hostPeer = hostPeer;
    this.q = [];
    this.seq = 0;
    this.sendT = 0;
    this.lastSS = null;
    this.selHold = 0;
    this.parts = {};
    this.hostMissing = 0;
    this.unsub = [
      room.on('fx', (m) => m.peer === hostPeer && this._fx(m.data)),
      room.on('sync', (m) => m.peer === hostPeer && this._sync(m.data)),
    ];
  }

  dispose() {
    for (const u of this.unsub) u();
    this.room.presence({ me: null, q: null }).catch(() => {});
  }

  cmd(type, ...args) {
    this.q.push([++this.seq, type, ...args]);
    if (this.q.length > 16) this.q.shift();
    this.sendT = 0; // flush soon
  }

  update(dt) {
    const g = this.game;
    const host = this.room.peers().find((p) => p.peer === this.hostPeer);
    if (!host) {
      if ((this.hostMissing += dt) > 4) g.onHostLeft?.();
    } else {
      this.hostMissing = 0;
      const ss = host.presence && host.presence.ss;
      if (ss && ss !== this.lastSS) {
        this.lastSS = ss;
        this._snapshot(ss, host.presence.pv || {});
      }
    }
    this.selHold -= dt;
    if ((this.sendT -= dt) <= 0) {
      this.sendT = 1 / 15;
      const p = g.player;
      const f = flagsOf(p) | (p.reviveHold ? FL.holdE : 0);
      this.room.presence({
        me: [r10(p.pos.x), r10(p.pos.y), r10(p.pos.z), r10(p.vel.x), r10(p.vel.y), r10(p.vel.z), r100(p.yaw), r100(p.aimPitch), ST.indexOf(p.state), f, p.ep | 0],
        mv: g.vehicles.driverRow(p),
        q: this.q,
      }).catch(() => {});
    }
  }

  /** Remote actors ease toward their last reported position (+velocity). */
  smooth(dt) {
    const now = performance.now();
    for (const a of this.game.actors) {
      if (a === this.game.player || !a.net) continue;
      const n = a.net;
      const age = Math.min(0.25, (now - n.at) / 1000);
      const tx = n.x + n.vx * age, ty = n.y + n.vy * age, tz = n.z + n.vz * age;
      if (Math.hypot(tx - a.pos.x, ty - a.pos.y, tz - a.pos.z) > 8) a.pos.set(tx, ty, tz);
      else {
        const k = Math.min(1, dt * 14);
        a.pos.x += (tx - a.pos.x) * k;
        a.pos.y += (ty - a.pos.y) * k;
        a.pos.z += (tz - a.pos.z) * k;
      }
    }
  }

  _snapshot(ss, pv) {
    const g = this.game;
    const me = g.player;
    const now = performance.now();
    g.time = ss.t / 10;
    if (ss.b >= 0) {
      g.busT = ss.b / 10;
      g.bus.visible = true;
    } else g.bus.visible = false;
    if (ss.gs === 1 && g.state === 'bus') g.state = 'playing';
    for (const r of ss.a) {
      const a = g.actors[r[0]];
      if (!a) continue;
      const wasAlive = a.alive;
      const f = r[10];
      a.alive = !!(f & FL.alive);
      a.kills = r[15];
      if (!a.alive) {
        a.downed = false;
        if (a === me && wasAlive) g.onLocalEliminated();
        continue;
      }
      a.downed = !!(f & FL.downed);
      a.hp = r[12];
      a.shield = r[13];
      a.overshield = r[14];
      const ep = r[16] | 0;
      if (a === me) {
        // the host moved us (bus jump, reboot): adopt its position once
        if (ep !== (me.ep | 0) || (!wasAlive && a.alive)) {
          me.ep = ep;
          me.pos.set(r[1] / 10, r[2] / 10, r[3] / 10);
          me.vel.set(r[6] / 10, r[7] / 10, r[8] / 10);
          me.state = ST[r[9]] || 'air';
          me.grounded = false;
          if (!wasAlive) g.onLocalRevived();
        } else if (ST[r[9]] === 'bus' && me.state !== 'bus') me.state = 'bus';
        continue;
      }
      a.net = { x: r[1] / 10, y: r[2] / 10, z: r[3] / 10, vx: r[6] / 10, vy: r[7] / 10, vz: r[8] / 10, at: now };
      if (!wasAlive || a.state === 'bus') a.pos.set(a.net.x, a.net.y, a.net.z);
      a.vel.set(a.net.vx, a.net.vy, a.net.vz);
      a.yaw = a.aimYaw = r[4] / 100;
      a.aimPitch = r[5] / 100;
      a.state = ST[r[9]] || 'ground';
      a.grounded = a.state === 'ground';
      a.crouch = !!(f & FL.crouch);
      a.emote = !!(f & FL.emote);
      a.ads = !!(f & FL.ads);
      a.building = !!(f & FL.build);
      a.sprinting = !!(f & FL.sprint);
      a.slideT = f & FL.slide ? 0.3 : 0;
      a.netHeld = { key: HELD[Math.floor(r[11] / 100)] || 'none', pose: POSE[Math.floor(r[11] / 10) % 10] || 'none', rarity: r[11] % 10 };
    }
    if (ss.vh) g.vehicles.applyRows(ss.vh, me);
    const s = ss.s;
    g.storm.applyNet(s);
    const P = pv['a' + me.id];
    if (P) this._private(me, P);
    g.netProjectiles = ss.pj;
  }

  _private(me, P) {
    const kinds = KIND;
    me.slots = P.sl.map((s) => (s ? (kinds[s[0]] === 'weapon' ? { kind: 'weapon', id: s[1], rarity: s[2], mag: s[3] } : { kind: kinds[s[0]], id: s[1], count: s[3] }) : null));
    if (this.selHold <= 0) me.sel = P.se;
    AMMO_K.forEach((k, i) => (me.ammo[k] = P.am[i]));
    MAT_K.forEach((k, i) => (me.mats[k] = P.mt[i]));
    me.buffs = Object.fromEntries(P.bf.map(([k, v]) => [k, v / 10]));
    me.cards = P.cd || [];
    me.use = P.us ? { slot: P.us[0], t: P.us[1] / 10, total: P.us[2] / 10 } : null;
    me.reloadT = P.rl ? P.rl[0] / 10 : 0;
    me.reloadTotal = P.rl ? P.rl[1] / 10 : 1;
    me.downHp = P.dh / 10;
    me.reviveT = P.rv / 10;
    me.rebootT = P.rb / 10;
    me.canRedeploy = !!P.rd;
    me.bucks = P.bk | 0;
    me.reviveTarget = me.reviveT > 0 ? { name: 'teammate' } : null;
    me.rebootVan = me.rebootT > 0 ? {} : null;
  }

  _fx(data) {
    const g = this.game;
    const E = g.effects;
    const me = g.player;
    const v = (a, i) => new THREE.Vector3(a[i] / 10, a[i + 1] / 10, a[i + 2] / 10);
    for (const e of data.e || []) {
      switch (e[0]) {
        case 'tr': E.tracer(v(e, 1), v(e, 4), e[7]); break;
        case 'mz': E.muzzle(v(e, 1)); break;
        case 'ex': E.explosion(v(e, 1), e[4]); E.shake = Math.min(1, E.shake + 12 / (8 + v(e, 1).distanceTo(g.camera.position))); break;
        case 'cf': E.confetti(v(e, 1)); break;
        case 'bu': E.burst(v(e, 1), e[4], e[5], e[6] / 10, e[7] / 100, e[8] / 10); break;
        case 'sd': {
          const pos = v(e, 2);
          if (pos.distanceTo(me.pos) > 1.8 || !me.alive) sfx.play(e[1], pos);
          break;
        }
        case 'hm':
          if (e[1] === me.id) {
            g.hud.hitmarker(!!e[4], !!e[5]);
            g.hud.damageNumber(v(e, 6), e[3], !!e[4], !!e[5]);
            sfx.play(e[4] ? 'head' : e[5] ? 'shieldhit' : 'hit');
          }
          if (e[2] === me.id) {
            const src = g.actors[e[1]];
            g.hud.hurt(src ? src.pos : null, e[1] < 0);
            sfx.play(e[1] < 0 ? 'storm' : 'hurt');
          }
          break;
        case 'kf': g.hud.killfeed({ a: e[1], b: e[2], how: e[3] }, me); break;
        case 'ms': if (e[1] === me.id || e[1] === -1) g.hud.toast(e[2], e[3] || '#fff', e[4] || 2); break;
        case 'pc+': g.building.applyRow(e[1]); break;
        case 'pc-': g.building.removeKey(e[1]); break;
        case 'pk+': g.loot.netAdd(e[1]); break;
        case 'pk-': g.loot.netRemove(e[1]); break;
        case 'ch': g.loot.openChestVisual(g.world.chests[e[1]]); break;
        case 'ch+': g.world.netChest(e[1], e[2] / 10, e[3] / 10, e[4] / 10, !!e[5], !!e[6]); break;
        case 'wd': g.world.destroyWid(e[1]); break;
        case 'pg': g.teams.pings.push({ pos: v(e, 2), t: 12, team: e[1], label: e[5], color: e[6], by: g.actors[e[7]] }); break;
        case 'sdp': g.loot.supplyDrop(e[1] / 10, e[2] / 10); break;
        case 'res': if (e[1] === me.id) g.showNetResult(e[2]); break;
        case 'ov': g.onNetOver(e[1], e[2], !!e[3]); break;
        default: break;
      }
    }
  }

  _sync(d) {
    const key = d.k + ':' + d.c;
    const buf = (this.parts[key] = this.parts[key] || []);
    buf[d.i] = d.d;
    if (buf.filter(Boolean).length < d.n) return;
    delete this.parts[key];
    for (const k of Object.keys(this.parts)) if (k.startsWith(d.k + ':') && +k.split(':')[1] < d.c) delete this.parts[k];
    const rows = buf.flat();
    const g = this.game;
    if (d.k === 'pk') g.loot.netReconcile(rows);
    else if (d.k === 'pc') g.building.reconcile(rows);
    else if (d.k === 'ch') {
      const [opened, extra, destroyed] = rows;
      for (const x of extra || []) g.world.netChest(x[0], x[1] / 10, x[2] / 10, x[3] / 10, !!x[4], !!x[5]);
      for (const i of opened || []) if (g.world.chests[i] && !g.world.chests[i].opened) g.loot.openChestVisual(g.world.chests[i]);
      for (const w of destroyed || []) g.world.destroyWid(w);
    }
  }
}

/** Client-side stand-ins for the player's actions: predict what's cosmetic, send the rest. */
export class NetActions {
  constructor(game) {
    this.g = game;
  }
  get p() {
    return this.g.player;
  }
  get net() {
    return this.g.net;
  }
  _d(dir) {
    return [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)];
  }
  jumpBus() {
    if (this.g.busT < 1.5) return false;
    this.net.cmd('j');
    return true;
  }
  fire(dir) {
    const p = this.p, w = p.weapon, it = p.item;
    if (!w || !p.canAct() || p.fireCd > 0 || p.equipT > 0 || p.reloadT > 0 || p.use) return 0;
    if (it.mag <= 0) {
      this.net.cmd('r');
      sfx.play('empty');
      p.fireCd = 0.4;
      return 0;
    }
    p.fireCd = 1 / w.rate;
    it.mag--;
    p.model.kick = 1;
    this.g.effects.muzzle(p.eye.addScaledVector(dir, 0.8).add(new THREE.Vector3(0, -0.25, 0)));
    sfx.play(w.sound, p.pos);
    this.net.cmd('f', ...this._d(dir));
    return w.recoil;
  }
  swing(dir) {
    const p = this.p;
    if (p.fireCd > 0 || p.equipT > 0 || !p.canAct()) return false;
    p.fireCd = 1 / PICKAXE.rate;
    p.model.swing = 1;
    this.net.cmd('w', ...this._d(dir));
    return true;
  }
  throwItem(dir) {
    const p = this.p;
    if (p.fireCd > 0 || !p.canAct()) return false;
    p.fireCd = 0.9;
    p.model.kick = 1;
    this.net.cmd('t', ...this._d(dir));
    return true;
  }
  select(i) {
    const p = this.p;
    if (i === p.sel || (i >= 0 && !p.slots[i])) return;
    p.sel = i;
    p.equipT = 0.25;
    this.net.selHold = 0.6;
    this.net.cmd('s', i);
  }
  reload() {
    this.net.cmd('r');
    return true;
  }
  use() {
    const it = this.p.item;
    if (!it || it.kind !== 'consumable') return false;
    this.net.cmd('u');
    return true;
  }
  drop() {
    if (this.p.sel < 0) return false;
    this.net.cmd('d');
    return true;
  }
  openChest(ch) {
    this.net.cmd('o', this.g.world.chests.indexOf(ch));
  }
  take(pk) {
    this.net.cmd('k', pk.nid);
    return 'ok';
  }
  build(s, mat, spec) {
    if (!this.g.building.canPlace(this.p, s, mat)) return null;
    this.net.cmd('b', spec.piece, r100(spec.yaw), r100(spec.pitch), spec.rot | 0, mat);
    sfx.play('build');
    return true;
  }
  edit(piece, tiles) {
    if (!tiles.some(Boolean)) return false;
    this.net.cmd('e', piece.key, tilesToBits(tiles.every(Boolean) ? null : tiles));
    return true;
  }
  repair(piece) {
    this.net.cmd('p', piece.key);
    return null;
  }
  ping(pos) {
    this.net.cmd('g', r10(pos.x), r10(pos.y), r10(pos.z));
    sfx.play('ui');
  }
  enterVehicle(v) {
    this.net.cmd('ve', v.id);
    return true;
  }
  exitVehicle() {
    this.net.cmd('vx');
  }
  buy(vi, k) {
    this.net.cmd('by', vi, k);
  }
  upgrade(bi) {
    this.net.cmd('ug', bi);
  }
}

/** Solo / host: actions run directly on the simulation. */
export class LocalActions {
  constructor(game) {
    this.g = game;
  }
  get p() {
    return this.g.player;
  }
  jumpBus() { return this.g.jumpFromBus(this.p); }
  fire(dir) { return this.g.combat.fire(this.p, dir); }
  swing(dir) { return this.g.combat.swing(this.p, dir); }
  throwItem(dir) { return this.g.combat.throwItem(this.p, dir); }
  select(i) { this.p.select(i); }
  reload() { return this.p.startReload(); }
  use() { return this.p.startUse(); }
  drop() { return this.g.loot.dropSelected(this.p); }
  openChest(ch) { this.g.loot.openChest(this.p, ch); }
  take(pk) { return this.g.loot.take(this.p, pk); }
  build(s, mat) { return this.g.building.place(this.p, s, mat); }
  edit(piece, tiles) { return this.g.building.applyEdit(piece, tiles); }
  repair(piece) { return this.g.building.repairOrUpgrade(this.p, piece); }
  ping(pos) { this.g.teams.ping(this.p, pos); }
  enterVehicle(v) { return this.g.vehicles.enter(this.p, v); }
  exitVehicle() { this.g.vehicles.exit(this.p); }
  buy(vi, k) {
    const r = buy(this.g, this.p, vi, k);
    if (r) this.g.hud.toast(r.text, r.color, 2);
  }
  upgrade(bi) {
    const r = upgrade(this.g, this.p, bi);
    if (r) this.g.hud.toast(r.text, r.color, 2);
  }
}

export { ST, FL, WEAPONS };
