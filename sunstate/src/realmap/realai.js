/**
 * Traffic, pedestrians and police on the real map's streets. They reuse the classic AI
 * (DriverAI's pure-pursuit driving, PedController's behaviours, PoliceManager's dispatch and
 * pursuit) and replace only what was tied to the old grid: lanes come from the real road
 * polylines (RoadNet), people walk the sidewalks alongside them.
 */
import { DriverAI } from '../ai/driver.js';
import { TrafficManager } from '../ai/traffic.js';
import { PedController, PedManager } from '../ai/peds.js';
import { PoliceManager, CopController, COP_LOOK } from '../ai/police.js';
import { Character } from '../entities/character.js';
import { randomLook } from '../entities/humanModel.js';
import { SURF } from './tilemesh.js';
import { along, polyLen, offsetPts, F_DRIVEWAY, CLS } from './roadnet.js';

const rand = (a, b) => a + Math.random() * (b - a);
const MODELS = [['kestrel', 0.34], ['sprite', 0.2], ['tarpon', 0.18], ['pickup', 0.16], ['ironhorse', 0.12]];
// how much traffic each road class draws (motorway … service)
const CLASS_TRAFFIC = [3, 3, 4, 3, 2.2, 1, 0.4, 0.8, 0];
const MAX_AI_SPEED = 24;

/** Can a car drive along e? (not tunnels — the map has no tunnel geometry — nor driveways) */
const drivable = (e) => !e.tunnel && !(e.flags & F_DRIVEWAY) && e.cls <= CLS.service;

/** Follows lanes on the real road polylines. Shares DriverAI's driving (speed planning, obstacles, recovery). */
export class RealDriverAI extends DriverAI {
  /** opts: { edge (RoadNet edge), from (node id), lane, s (metres along the lane) } */
  constructor(v, game, { edge, from, lane = 0, s = 0, mode = 'cruise' }) {
    super(v, game, { edge, from, lane, t: s, mode });
  }

  get net() { return this.game.world.roads; }

  seed(edge, from, lane, s) {
    this.cur = edge; this.from = from; this.lane = lane;
    this.edge = 'r' + edge.id; // (not an index into the classic graph)
    const pts = this.net.lanePts(edge, from, lane);
    this.curPts = pts;
    this.pushLane(pts, edge, s, this.trimAt(this.endNode(edge, from), edge));
  }

  endNode(e, from) { return from === e.a ? e.b : e.a; }

  /** How far back from a node a lane stops (the junction box): the widest other road's half width. */
  trimAt(nodeId, e) {
    const n = this.net.nodes.get(nodeId);
    if (!n || n.edges.length < 2) return 0;
    let w = 0;
    for (const o of n.edges) if (o !== e) w = Math.max(w, o.w / 2);
    return Math.min(e.len * 0.4, w + 1.5);
  }

  limit(e) { return Math.min(MAX_AI_SPEED, e.speed * (e.cls >= CLS.residential ? 0.95 : 1)); }

  /** Waypoints along lane polyline pts from s0 to (length − trimEnd), slowing for bends. */
  pushLane(pts, e, s0, trimEnd) {
    const lim = this.limit(e);
    const L = polyLen(pts), s1 = Math.max(s0 + 1, L - trimEnd);
    let acc = 0;
    let lastS = s0;
    const n = pts.length / 2;
    const bendCap = (i) => {
      if (i <= 0 || i >= n - 1) return lim;
      const ax = pts[i * 2] - pts[i * 2 - 2], az = pts[i * 2 + 1] - pts[i * 2 - 1];
      const bx = pts[i * 2 + 2] - pts[i * 2], bz = pts[i * 2 + 3] - pts[i * 2 + 1];
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      const th = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / ((la * lb) || 1))));
      if (th < 0.08) return lim;
      return Math.max(4.5, Math.min(lim, Math.sqrt(3.2 * Math.min(la, lb, 40) / th)));
    };
    const first = along(pts, s0);
    this.wp.push({ x: first.x, z: first.z, speed: lim });
    for (let i = 1; i < n; i++) {
      const sl = Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      const sv = acc + sl;
      if (sv > s0 + 0.5) {
        // long straights get intermediate points (pure pursuit and the speed planner like them)
        const from = Math.max(lastS, s0);
        const end = Math.min(sv, s1);
        for (let s = from + 18; s < end - 6; s += 18) { const p = along(pts, s); this.wp.push({ x: p.x, z: p.z, speed: lim }); }
        if (sv >= s1) { const p = along(pts, s1); this.wp.push({ x: p.x, z: p.z, speed: lim, laneEnd: true }); return; }
        this.wp.push({ x: pts[i * 2], z: pts[i * 2 + 1], speed: bendCap(i) });
        lastS = sv;
      }
      acc = sv;
    }
    const p = along(pts, s1);
    this.wp.push({ x: p.x, z: p.z, speed: lim, laneEnd: true });
  }

  /** Pick the edge to take at node `at`, arriving along e (null: nowhere to go). */
  chooseNext(e, at) {
    const net = this.net, n = net.nodes.get(at);
    if (!n) return e.oneway ? null : e;
    let opts = n.edges.filter((o) => o !== e && drivable(o) && net.canDrive(o, at));
    if (!opts.length) return e.oneway ? null : e; // dead end: turn around
    // keep off service roads (parking aisles, alleys) unless that's all there is
    const streets = opts.filter((o) => o.cls !== CLS.service);
    if (streets.length && (e.cls !== CLS.service || Math.random() < 0.9)) opts = streets;
    const inDir = this.endDir();
    const turnCos = (o) => { const p = net.dirPts(o, at); const dx = p[2] - p[0], dz = p[3] - p[1], l = Math.hypot(dx, dz) || 1; return (inDir.dx * dx + inDir.dz * dz) / l; };
    if (this.mode === 'route' && this.goal) {
      // head for the goal: the option whose far end is closest to it
      let best = null, bd = Infinity;
      for (const o of opts) {
        const far = net.nodes.get(this.endNode(o, at));
        const d = (far ? Math.hypot(far.x - this.goal.x, far.z - this.goal.z) : 1e6) + (o.cls === CLS.service ? 80 : 0) + Math.random() * 25 - turnCos(o) * 10;
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    let total = 0;
    const w = opts.map((o) => { const c = turnCos(o); const v = (CLASS_TRAFFIC[o.cls] || 0.3) * (c > 0.7 ? 2.4 : c > -0.5 ? 1 : 0.15) * (o.cls < e.cls ? 1.4 : 1); total += v; return v; });
    let r = Math.random() * total;
    for (let i = 0; i < opts.length; i++) if ((r -= w[i]) <= 0) return opts[i];
    return opts[opts.length - 1];
  }

  /** Direction at the end of the current lane. */
  endDir() {
    const p = this.curPts, k = p.length;
    const dx = p[k - 2] - p[k - 4], dz = p[k - 1] - p[k - 3], l = Math.hypot(dx, dz) || 1;
    return { dx: dx / l, dz: dz / l, x: p[k - 2], z: p[k - 1] };
  }

  /** Append the way through the next junction and the following lane. */
  extend() {
    const net = this.net, e = this.cur;
    const at = this.endNode(e, this.from);
    const next = this.chooseNext(e, at);
    if (!next) {
      // a one-way dead end (the edge of the loaded area): stop at the end and wait to be tidied away
      const last = this.wp[this.wp.length - 1];
      if (!last.hold) this.wp.push({ x: last.x + (this.endDir().dx * 0.5), z: last.z + this.endDir().dz * 0.5, speed: 0, hold: true });
      return;
    }
    const inD = this.endDir();
    const nd0 = net.dirPts(next, at);
    let odx = nd0[2] - nd0[0], odz = nd0[3] - nd0[1];
    const ol = Math.hypot(odx, odz) || 1; odx /= ol; odz /= ol;
    const cross = inD.dx * odz - inD.dz * odx; // > 0: right turn (x east, z south)
    const dot = inD.dx * odx + inD.dz * odz;
    const uturn = next === e;
    let lane = Math.min(this.lane, next.lanes - 1);
    if (!uturn && dot < 0.8) lane = cross > 0 ? next.lanes - 1 : 0;
    const nPts = net.lanePts(next, at, lane);
    const tIn = this.trimAt(at, e), tOut = Math.min(next.len * 0.4, this.trimAt(at, next));
    const L = polyLen(this.curPts);
    const p0 = along(this.curPts, Math.max(0, L - tIn)), p1 = along(nPts, tOut);
    // corner control point: where the two lane lines would meet
    let cx = (p0.x + p1.x) / 2, cz = (p0.z + p1.z) / 2;
    if (uturn) { cx = p0.x + inD.dx * 7; cz = p0.z + inD.dz * 7; }
    else {
      const den = inD.dx * odz - inD.dz * odx;
      if (Math.abs(den) > 0.15) {
        const t = ((p1.x - p0.x) * odz - (p1.z - p0.z) * odx) / den;
        if (t > 0 && t < 25) { cx = p0.x + inD.dx * t; cz = p0.z + inD.dz * t; }
      }
    }
    const th = Math.acos(Math.max(-1, Math.min(1, dot)));
    const lim = this.limit(next);
    let turnSpeed = uturn ? 3.5 : th < 0.35 ? Math.min(lim, this.limit(e)) : th < 0.9 ? 9 : cross > 0 ? 5.5 : 7;
    // a side street meeting a bigger road gives way: slow right down at the line
    const n = net.nodes.get(at);
    const major = n ? Math.min(...n.edges.filter((o) => o !== e && o !== next).map((o) => o.cls), 99) : 99;
    const give = major < e.cls && major < 99 && e.cls >= CLS.tertiary;
    if (give) this.wp.push({ x: p0.x, z: p0.z, speed: 2.5 });
    const N = uturn ? 7 : th < 0.35 ? 2 : 5;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1);
      this.wp.push({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * cx + t * t * p1.x, z: (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * cz + t * t * p1.z, speed: turnSpeed, inNode: at });
    }
    this.cur = next; this.from = at; this.lane = lane; this.edge = 'r' + next.id;
    this.curPts = nPts;
    this.pushLane(nPts, next, tOut, this.trimAt(this.endNode(next, at), next));
  }
}

/** Ambient traffic on the real streets. */
export class RealTraffic extends TrafficManager {
  get net() { return this.game.world.roads; }

  step(dt) {
    for (const v of this.cars) if (v.ai) v.ai.step(dt);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    this.updateFrustum();
    const p = this.game.player;
    const ppos = p.vehicle ? p.vehicle.pos : p.pos;
    for (const v of [...this.cars]) {
      const d = Math.hypot(v.pos.x - ppos.x, v.pos.z - ppos.z);
      const stuck = v.ai?.wp?.[0]?.hold && !this.visible(v.pos.x, v.pos.y, v.pos.z);
      if ((d > 230 && !this.visible(v.pos.x, v.pos.y, v.pos.z)) || d > 420 || stuck) this.remove(v);
    }
    this.cleanupAbandoned(ppos);
    if (!this.enabled || !this.net?.list.length) return;
    let n = 0;
    while (this.cars.size < this.target && n++ < 2) this.trySpawn(ppos);
  }

  /** A random spot in a lane, weighted toward big roads: { e, from, lane, s, x, z, y, yaw } or null. */
  pickLaneSpot(ppos, { dMin = 70, dMax = 220, hidden = 160, ok = null, outer = false } = {}) {
    const net = this.net, w = this.game.world;
    if (this._ver !== net.version) {
      this._ver = net.version;
      this._pool = net.list.filter((e) => drivable(e) && CLASS_TRAFFIC[e.cls] > 0 && e.lvl >= 0 && e.len > 25);
      let t = 0;
      this._cum = this._pool.map((e) => (t += CLASS_TRAFFIC[e.cls] * Math.min(e.len, 300)));
    }
    const pool = this._pool, cum = this._cum;
    if (!pool.length) return null;
    for (let attempt = 0; attempt < 16; attempt++) {
      const r = Math.random() * cum[cum.length - 1];
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
      const e = pool[lo];
      if (ok && !ok(e)) continue;
      const from = e.oneway || Math.random() < 0.5 ? e.a : e.b;
      const lane = outer ? e.lanes - 1 : Math.floor(Math.random() * e.lanes);
      const pts = net.lanePts(e, from, lane);
      const L = polyLen(pts);
      const s = rand(6, L - 10);
      const p = along(pts, s);
      const d = Math.hypot(p.x - ppos.x, p.z - ppos.z);
      if (d < dMin || d > dMax) continue;
      if (w.rasterAt(p.x, p.z) < 0) continue; // tile not built yet
      const raised = e.lvl > 0 || (e.flags & 1);
      const y = w.ground(p.x, p.z, raised ? e.lvl * 6.5 + 5 : 2);
      if (e.lvl > 0 && y < 2) continue; // the deck isn't there (yet)
      if (!raised && w.isWater(p.x, p.z)) continue;
      if (this.visible(p.x, y, p.z, 5) && d < hidden) continue;
      if (this.game.vehicles.some((o) => Math.abs(o.pos.x - p.x) < 14 && Math.abs(o.pos.z - p.z) < 14)) continue;
      return { e, from, lane, s, x: p.x, z: p.z, y, yaw: Math.atan2(p.dx, p.dz) };
    }
    return null;
  }

  trySpawn(ppos) {
    const q = this.pickLaneSpot(ppos);
    if (!q) return false;
    this.spawnCar(q);
    return true;
  }

  spawnCar(q, model = null) {
    const g = this.game;
    if (!model) { let r = Math.random(); model = MODELS.find(([, w]) => (r -= w) < 0)?.[0] || 'kestrel'; }
    const v = g.addVehicle(model, q.x, q.z, q.yaw);
    v.pos.y = q.y;
    const startSpeed = Math.min(12, q.e.speed * 0.6);
    v.vel.set(Math.sin(q.yaw) * startSpeed, Math.cos(q.yaw) * startSpeed);
    const driver = new Character(g, randomLook(), { role: 'driver', x: q.x, z: q.z });
    g.peds.push(driver);
    driver.controller = g.peds_?.makeController(driver, 'driver');
    g.seatCharacter(v, 0, driver);
    v.ai = new RealDriverAI(v, g, { edge: q.e, from: q.from, lane: q.lane, s: q.s });
    v.engineOn = true;
    this.cars.add(v);
    return v;
  }
}

/** Streets people walk along (not motorways, ramps, bridges or alleys). */
const walkable = (e) => e.cls >= CLS.primary && e.cls <= CLS.unclassified && !e.tunnel && e.lvl === 0 && !(e.flags & 1) && !(e.flags & 4);

export class RealPedController extends PedController {
  get net() { return this.game.world.roads; }

  walk(dt) {
    const ch = this.ch;
    if (this.kind === 'keys' || this.kind === 'beach') { this.setState('wander', 30); this.wander(); return; }
    if (!this.path && !this.joinSidewalk()) { this.setState('idle', rand(3, 8)); return; }
    const n = this.path.length / 2;
    const tx = this.path[this.pi * 2], tz = this.path[this.pi * 2 + 1];
    const dx = tx - ch.pos.x, dz = tz - ch.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.3) {
      this.pi++;
      if (this.pi >= n) this.nextStreet();
      if (Math.random() < 0.03) this.setState('idle', rand(2, 6));
      return;
    }
    ch.wish.set(dx / d, dz / d);
    ch.wishSpeed = this.walkSpeed * this.hurry;
    // walked into something (a wall that sits on the sidewalk, a parked car): turn back
    if (ch.blockedT > 1.6) { ch.blockedT = 0; this.turnAround(); }
    void dt;
  }

  /** Join the sidewalk of the nearest street, on whichever side we're on. */
  joinSidewalk() {
    const ch = this.ch, net = this.net;
    const q = net?.nearest(ch.pos.x, ch.pos.z, walkable, 45);
    if (!q) return false;
    const e = q.e, p = e.pts, i = q.seg * 2;
    const tx = p[i + 2] - p[i], tz = p[i + 3] - p[i + 1];
    const right = (ch.pos.x - q.x) * -tz + (ch.pos.z - q.z) * tx > 0; // right of the a → b direction
    const fwd = Math.random() < 0.5;
    this.street = e; this.from = fwd ? e.a : e.b;
    this.side = (right === fwd ? 1 : -1); // + = right of travel
    this.makePath();
    // start at the point nearest us that lies ahead
    const s = fwd ? q.s : e.len - q.s;
    let acc = 0; this.pi = 0;
    for (let k = 1; k < this.path.length / 2; k++) { acc += Math.hypot(this.path[k * 2] - this.path[k * 2 - 2], this.path[k * 2 + 1] - this.path[k * 2 - 1]); if (acc > s) { this.pi = k; break; } this.pi = k; }
    return true;
  }

  makePath() {
    const e = this.street;
    this.path = offsetPts(this.net.dirPts(e, this.from), this.side * (e.w / 2 + 1.5 + this.offset * 0.35));
  }

  nextStreet() {
    const net = this.net, e = this.street;
    const at = this.from === e.a ? e.b : e.a;
    const n = net.nodes.get(at);
    const opts = n ? n.edges.filter((o) => o !== e && walkable(o)) : [];
    if (!opts.length) { this.turnAround(); return; }
    this.street = opts[Math.floor(Math.random() * opts.length)];
    this.from = at;
    this.makePath();
    this.pi = 1;
  }

  turnAround() {
    if (!this.street) { this.path = null; return; }
    const e = this.street;
    this.from = this.from === e.a ? e.b : e.a;
    this.side = -this.side; // same kerb, walking the other way
    const k = this.path.length / 2 - 1 - this.pi;
    this.makePath();
    this.pi = Math.max(1, Math.min(this.path.length / 2 - 1, k + 1));
  }
}

export class RealPeds extends PedManager {
  makeController(ch, kind) { return new RealPedController(this.game, ch, kind); }

  spawnSome(p, n) {
    const g = this.game, w = g.world, net = w.roads, tr = g.traffic;
    if (!net?.list.length) return;
    if (this._ver !== net.version) { this._ver = net.version; this._streets = net.list.filter(walkable); }
    const streets = this._streets;
    for (let k = 0; k < n; k++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        let x, z, kind = 'walker', zone = null;
        const dry = (g.weather?.rain || 0) < 0.3;
        if (Math.random() < 0.28 && dry) {
          // the beach and the parks: people amble about, sit, chat
          const a = Math.random() * Math.PI * 2, r = rand(50, 120);
          x = p.x + Math.cos(a) * r; z = p.z + Math.sin(a) * r;
          const c = w.rasterAt(x, z);
          if (c !== SURF.sand && c !== SURF.park && c !== SURF.grass) continue;
          kind = c === SURF.sand ? 'beach' : 'keys';
          zone = { x0: x - 30, x1: x + 30, z0: z - 30, z1: z + 30 };
        } else {
          if (!streets.length) return;
          const e = streets[Math.floor(Math.random() * streets.length)];
          const side = Math.random() < 0.5 ? 1 : -1;
          const pts = offsetPts(e.pts, side * (e.w / 2 + 1.5));
          const q = along(pts, rand(3, Math.max(4, e.len - 3)));
          x = q.x; z = q.z;
        }
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 45 || d > 130) continue;
        if (w.rasterAt(x, z) < 0) continue;
        const y = w.ground(x, z, 2);
        if (tr && tr.visible(x, y, z, 1.5) && d < 90) continue;
        if (w.collision.overlapsCircle(x, z, 0.35, y + 0.2, 1.5)) continue;
        if (w.isWater(x, z)) continue;
        const group = kind !== 'beach' && Math.random() < 0.22 ? 2 : 1;
        let first = null;
        for (let i = 0; i < group; i++) {
          const look = randomLook(Math.random, kind === 'beach' ? { shorts: Math.random() < 0.85, sleeveless: Math.random() < 0.6 } : {});
          const ch = new Character(g, look, { role: 'ped', x: x + i * 1.1, z, yaw: Math.random() * 6.28 });
          ch.controller = new RealPedController(g, ch, kind);
          ch.controller.zone = zone;
          g.peds.push(ch);
          if (group > 1) {
            if (!first) first = ch;
            else { ch.controller.partner = first; first.controller.partner = ch; }
            ch.controller.setState('talk', rand(15, 40));
          } else ch.controller.pickActivity();
        }
        break;
      }
    }
  }
}

/** Police on the real streets: units spawn in real lanes and head for the report along the roads. */
export class RealPolice extends PoliceManager {
  spawnUnit(patrol) {
    const g = this.game, tr = g.traffic;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    if (!tr?.pickLaneSpot) return null;
    const q = tr.pickLaneSpot(p, { dMin: patrol ? 120 : 100, dMax: 230, hidden: 1e9, ok: (e) => e.cls <= CLS.residential, outer: true });
    if (!q) return null;
    const v = g.addVehicle('police', q.x, q.z, q.yaw, 0x101318, { plate: 'PD ' + (10 + Math.floor(Math.random() * 89)) });
    v.pos.y = q.y;
    v.engineOn = true;
    const unit = { vehicle: v, cops: [], mode: patrol ? 'patrol' : 'respond', patrol, t: 0, stuckT: 0, reverseT: 0, lostT: 0, routeT: 0 };
    for (const seat of [0, 1]) {
      const cop = new Character(g, COP_LOOK(), { role: 'cop', x: q.x, z: q.z });
      cop.controller = new CopController(g, cop, unit);
      cop.armor = 30;
      g.cops.push(cop);
      g.seatCharacter(v, seat, cop);
      unit.cops.push(cop);
    }
    v.ai = new RealDriverAI(v, g, { edge: q.e, from: q.from, lane: q.lane, s: q.s });
    v.policeUnit = unit;
    this.units.push(unit);
    return unit;
  }

  /** Head along the streets toward (x, z): at each junction, the way that closes the distance. */
  routeTo(u, x, z) {
    const ai = u.vehicle.ai;
    if (!ai) return;
    ai.goal = { x, z };
    ai.mode = 'route';
    u.routeT = 6;
  }
}
