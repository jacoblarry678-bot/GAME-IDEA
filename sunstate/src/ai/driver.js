/**
 * DriverAI: follows lanes on the road graph. It keeps a queue of waypoints
 * (lane centre lines plus sampled turn curves), extends the queue by picking
 * the next edge at each intersection, obeys signals at stop lines, brakes for
 * anything in its path, and steers with pure pursuit.
 *
 * Right-hand traffic. Lane offset is measured to the right of the travel
 * direction; lane 0 is next to the centre line.
 */
import { ROAD_GRAPH, LANE_W, signalState, nearestRoadPoint, findRoute, roadAt } from '../world/layout.js';

const { nodes, edges } = ROAD_GRAPH;

export function edgeDir(e, fromId) {
  const a = nodes[fromId], b = nodes[e.a === fromId ? e.b : e.a];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  return { a, b, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len, len };
}

/** Start/end of a lane on edge e travelling away from node fromId. */
export function laneLine(e, fromId, lane) {
  const { a, b, dx, dz } = edgeDir(e, fromId);
  const rx = -dz, rz = dx; // right of travel
  const off = (e.median || 0) / 2 + (lane + 0.5) * LANE_W; // twin spans keep a gap between directions
  const ha = dx ? a.hx : a.hz, hb = dx ? b.hx : b.hz;
  return {
    x0: a.x + dx * (ha + 1) + rx * off, z0: a.z + dz * (ha + 1) + rz * off,
    x1: b.x - dx * (hb + 1) + rx * off, z1: b.z - dz * (hb + 1) + rz * off,
    dx, dz, a, b, axis: Math.abs(dx) > 0.5 ? 'ew' : 'ns',
  };
}

export function speedLimit(e) { return e.limit || (e.road === 'causeway' ? 19 : e.lanes === 2 ? 15 : 11.5); }

export class DriverAI {
  constructor(vehicle, game, { edge, from, lane = 0, t = 0.3, mode = 'cruise' } = {}) {
    this.v = vehicle;
    this.game = game;
    this.mode = mode; // cruise | route (follow a node list) | direct (steer to a point)
    this.wp = []; // {x, z, speed, stop?: {node, axis}}
    this.edge = edge;
    this.from = from;
    this.lane = lane;
    this.route = null;
    this.target = null;
    this.stuckT = 0;
    this.reverseT = 0;
    this.honkT = 0;
    this.speedScale = 0.9 + Math.random() * 0.2;
    this.cautious = 1;
    this.yieldT = 0;
    this.blockedBy = null;
    this.avoidPlayer = true;
    this.emergency = false; // responding police ignore signals
    this.turning = false;
    const l = laneLine(edges[edge], from, lane);
    this.wp.push({ x: l.x0 + (l.x1 - l.x0) * t, z: l.z0 + (l.z1 - l.z0) * t, speed: speedLimit(edges[edge]) });
    this.wp.push({ x: l.x1, z: l.z1, speed: speedLimit(edges[edge]), stop: { node: l.b, axis: l.axis } });
    this.lastNode = from;
  }

  /** Pick the next edge at node `at` arriving along edge `e`. */
  chooseNext(e, at) {
    const n = nodes[at];
    let options = n.edges.filter((id) => id !== e.id);
    if (this.route && this.route.length > 1) {
      const idx = this.route.indexOf(at);
      if (idx >= 0 && idx < this.route.length - 1) {
        const next = this.route[idx + 1];
        const id = n.edges.find((eid) => { const x = edges[eid]; return (x.a === at && x.b === next) || (x.b === at && x.a === next); });
        if (id !== undefined) return id;
      }
    }
    if (!options.length) return e.id; // dead end: U-turn
    // ambient traffic avoids the dead-end causeway most of the time
    if (this.mode === 'cruise') {
      const other = (id) => nodes[edges[id].a === at ? edges[id].b : edges[id].a];
      const pref = options.filter((id) => (edges[id].road !== 'causeway' || Math.random() < 0.25) && !(other(id).deadEnd && edges[id].road !== 'causeway'));
      if (pref.length) options = pref;
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  /** Append the turn through the next intersection and the following lane. */
  extend() {
    const e = edges[this.edge];
    const cur = laneLine(e, this.from, this.lane);
    const at = cur.b.id;
    const nextId = this.chooseNext(e, at);
    const ne = edges[nextId];
    let nextLane = Math.min(this.lane, ne.lanes - 1);
    // turning: right turns use the outer lane, left turns the inner one
    const nd = edgeDir(ne, at);
    const cross = cur.dx * nd.dz - cur.dz * nd.dx; // >0 → right turn (x east, z south)
    if (cross > 0.5) nextLane = ne.lanes - 1; else if (cross < -0.5) nextLane = 0;
    const nl = laneLine(ne, at, nextLane);
    const uturn = nextId === this.edge;
    // corner control point: where the two lane lines meet
    let cx, cz;
    if (uturn) { cx = cur.x1 + cur.dx * 8; cz = cur.z1 + cur.dz * 8; }
    else if (Math.abs(cross) > 0.5) {
      if (Math.abs(cur.dx) > 0.5) { cx = nl.x0; cz = cur.z1; } else { cx = cur.x1; cz = nl.z0; }
    } else if (Math.abs(cur.dx) > 0.5) { cx = cur.x1 + (nl.x0 - cur.x1) * 0.35; cz = nl.z0; } // straight on: finish any
    else { cx = nl.x0; cz = cur.z1 + (nl.z0 - cur.z1) * 0.35; } //                              lateral shift inside the junction
    const shift = Math.abs(cur.dx) > 0.5 ? Math.abs(nl.z0 - cur.z1) : Math.abs(nl.x0 - cur.x1);
    const turnSpeed = uturn ? 4 : Math.abs(cross) > 0.5 ? (cross > 0 ? 5.5 : 7) : shift > 1 ? 10 : speedLimit(ne);
    const N = uturn ? 8 : 5;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1);
      const x = (1 - t) * (1 - t) * cur.x1 + 2 * (1 - t) * t * cx + t * t * nl.x0;
      const z = (1 - t) * (1 - t) * cur.z1 + 2 * (1 - t) * t * cz + t * t * nl.z0;
      this.wp.push({ x, z, speed: turnSpeed, inNode: at });
    }
    const lim = speedLimit(ne);
    this.wp.push({ x: nl.x0, z: nl.z0, speed: Math.min(lim, turnSpeed + 3) });
    // a point a car length into the new lane holds the line straight after the junction
    this.wp.push({ x: nl.x0 + nl.dx * 7, z: nl.z0 + nl.dz * 7, speed: Math.min(lim, turnSpeed + 5) });
    // intermediate points keep pure pursuit on long straights
    const steps = Math.max(1, Math.floor(nd.len / 25));
    for (let i = 1; i < steps; i++) if (Math.hypot(nl.x1 - nl.x0, nl.z1 - nl.z0) * (i / steps) > 9) this.wp.push({ x: nl.x0 + (nl.x1 - nl.x0) * (i / steps), z: nl.z0 + (nl.z1 - nl.z0) * (i / steps), speed: lim });
    this.wp.push({ x: nl.x1, z: nl.z1, speed: lim, stop: { node: nl.b, axis: nl.axis } });
    this.edge = nextId;
    this.from = at;
    this.lane = nextLane;
  }

  /** Remaining distance along the waypoint list to waypoint index i. */
  distTo(i) {
    let d = Math.hypot(this.wp[0].x - this.v.pos.x, this.wp[0].z - this.v.pos.z);
    for (let k = 1; k <= i && k < this.wp.length; k++) d += Math.hypot(this.wp[k].x - this.wp[k - 1].x, this.wp[k].z - this.wp[k - 1].z);
    return d;
  }

  step(dt) {
    const v = this.v;
    if (!v.driver || v.driver.dead) { v.holdStill(); return; }
    if (v.sunk || v.destroyed) { v.input.throttle = 0; return; }
    // drop waypoints we've reached or passed (measured along the path, so a car
    // facing the wrong way keeps its route and turns around instead)
    while (this.wp.length > 1) {
      const a = this.wp[0], b = this.wp[1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = ((v.pos.x - a.x) * dx + (v.pos.z - a.z) * dz) / (dx * dx + dz * dz || 1);
      if (Math.hypot(v.pos.x - a.x, v.pos.z - a.z) < 3.5 || t > 0.02) this.wp.shift(); else break;
    }
    if (this.offroad && this.stepOffroad(dt)) return;
    this.progT = (this.progT || 0) + dt; // (progress watchdog, below)
    if (this.progX === undefined) { this.progX = v.pos.x; this.progZ = v.pos.z; }
    let total = 0;
    for (let i = 1; i < this.wp.length; i++) total += Math.hypot(this.wp[i].x - this.wp[i - 1].x, this.wp[i].z - this.wp[i - 1].z);
    if (total < 60 || this.wp.length < 4) this.extend();

    const speed = v.speed;
    // pure pursuit on a look-ahead point
    const look = 5 + speed * 0.55;
    let tx = this.wp[this.wp.length - 1].x, tz = this.wp[this.wp.length - 1].z;
    let acc = Math.hypot(this.wp[0].x - v.pos.x, this.wp[0].z - v.pos.z);
    if (acc >= look) { tx = this.wp[0].x; tz = this.wp[0].z; }
    else for (let i = 1; i < this.wp.length; i++) {
      const seg = Math.hypot(this.wp[i].x - this.wp[i - 1].x, this.wp[i].z - this.wp[i - 1].z);
      if (acc + seg >= look) { const t = (look - acc) / seg; tx = this.wp[i - 1].x + (this.wp[i].x - this.wp[i - 1].x) * t; tz = this.wp[i - 1].z + (this.wp[i].z - this.wp[i - 1].z) * t; break; }
      acc += seg;
    }
    let [lx, lz] = v.worldToLocal(tx, tz);
    // passing a stationary blocker: aim a little to the left of the path
    if (this.ignoreT > 0) { this.ignoreT -= dt; lx += 2.4; }
    const ld2 = lx * lx + lz * lz;
    const curv = (2 * lx) / Math.max(1, ld2);
    let steer = -Math.atan(curv * v.def.wheelbase) / v.def.steerMax; // local +x is left
    if (lz < 0) steer = lx > 0 ? -1 : 1; // target behind: full lock
    // target well behind at low speed (parked nose-in, wrong way): gentle three-point turn,
    // switching direction as soon as the car stalls against something; at most three cycles
    const behind = Math.abs(Math.atan2(lx, lz)) > 1.9;
    if (!behind) this.turnCycles = 0;
    if (this.turning || (behind && speed < 3 && this.reverseT <= 0 && (this.turnCycles || 0) < 3)) {
      if (!this.turning) { this.turning = true; this.turnPhase = 'back'; this.phaseT = 0; this.turnSide = lx >= 0 ? 1 : -1; this.turnCycles = (this.turnCycles || 0) + 1; }
      this.phaseT += dt;
      const stalled = this.phaseT > 0.6 && speed < 0.3;
      if (this.turnPhase === 'back' && (this.phaseT > 1.8 || stalled)) { this.turnPhase = 'fwd'; this.phaseT = 0; }
      else if (this.turnPhase === 'fwd' && (this.phaseT > 1.8 || stalled || !behind)) { this.turning = false; }
      const back = this.turnPhase === 'back';
      v.input.throttle = back ? 0 : 0.35;
      v.input.brake = back ? 0.35 : 0;
      v.input.handbrake = false;
      // backing up with the wheels turned away from the target swings the nose toward it
      v.input.steer = back ? this.turnSide : -this.turnSide;
      this.wantT = (this.wantT || 0) + dt;
      if (this.turning) return;
    }

    // target speed: path speed, upcoming turns, signals, obstacles
    let target = this.wp[0].speed;
    let d = 0;
    for (let i = 0; i < this.wp.length && d < 60; i++) {
      d = this.distTo(i);
      const w = this.wp[i];
      target = Math.min(target, Math.sqrt(w.speed * w.speed + 2 * 3.5 * Math.max(0, d - 4)));
      if (w.stop && w.stop.node.signal && !this.emergency) {
        const s = signalState(w.stop.node, w.stop.axis, this.game.world.signalTime);
        const stopD = d - 3.5;
        if (s === 'red' || (s === 'yellow' && stopD > speed * speed / (2 * 4.5) + 2)) {
          if (stopD > -1.5) target = Math.min(target, stopD < 0.5 ? 0 : Math.sqrt(2 * 3.8 * stopD));
        }
      }
    }
    target *= this.speedScale * this.cautious;
    const obs = this.obstacleAhead(speed);
    this.blockedBy = obs ? obs.who : null;
    // stuck behind something that isn't moving (parked car, broken-down car): back up and go around
    const still = obs && (obs.who.vel ? Math.hypot(obs.who.vel.x, obs.who.vel.y ?? obs.who.vel.z) < 0.4 : true);
    const pedPlayer = obs && obs.who === this.game.player;
    if (obs && still && !pedPlayer && speed < 0.5) this.waitT = (this.waitT || 0) + dt; else this.waitT = 0;
    // ...except on a bridge deck, where "around" is the parapet or the gap: wait it out
    const onBridge = edges[this.edge] && (edges[this.edge].road === 'twinspan' || edges[this.edge].road === 'causeway');
    if (this.waitT > (this.emergency ? 1.5 : 5) && !onBridge) { this.ignore = obs.who; this.ignoreT = 5; this.waitT = 0; this.reverseT = 1.0; }
    if (obs) target = Math.min(target, Math.max(0, Math.sqrt(2 * 5 * Math.max(0, obs.dist - 3)) - 0.5));

    // recover from being stuck (blocked by something static, pushed off the lane)
    if (speed < 0.6 && target > 3 && !obs) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.stuckT > 2.5) { this.reverseT = 1.6; this.stuckT = 0; this.ignore = null; this.ignoreT = 3; } // back up, then take a line offset to the side
    // watchdog: wanting to drive for most of 12 s but still within 5 m of where we were (wedged
    // off the lane after a crash, rocking between "back up" and "go"): feel the way out instead
    if (target > 3 && !obs) this.wantT = (this.wantT || 0) + dt;
    if (this.progT > 12) {
      const moved = Math.hypot(v.pos.x - this.progX, v.pos.z - this.progZ);
      if (moved < 5 && this.wantT > 8 && !onBridge) { this.offroad = true; this.offT = 0; this.failed = []; this.reverseT = 0; this.turning = false; this.unwedged = (this.unwedged || 0) + 1; }
      this.progT = 0; this.wantT = 0; this.progX = v.pos.x; this.progZ = v.pos.z;
    }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.input.throttle = 0; v.input.brake = 0.7; v.input.steer = -steer; v.input.handbrake = false;
      return;
    }
    // honk at a blocker that doesn't move
    if (obs && obs.who === this.game.player && speed < 0.5) { this.honkT += dt; v.horn = this.honkT > 3 && this.honkT % 4 < 0.5; } else { this.honkT = 0; v.horn = false; }

    const err = target - v.vLong;
    // smooth and speed-limit steering: pure pursuit oscillates at highway speeds otherwise
    const maxSteer = 1 / (1 + speed / 14);
    const want = Math.max(-maxSteer, Math.min(maxSteer, steer));
    this.steerS = (this.steerS ?? want) + (want - (this.steerS ?? want)) * Math.min(1, dt * 8);
    v.input.steer = speed < 4 ? Math.max(-1, Math.min(1, steer)) : this.steerS;
    v.input.handbrake = false;
    if (err > 0.3) {
      // AI "traction control": ease off when steering hard or when the tyres are sliding
      const tc = (1 - 0.65 * Math.min(1, Math.abs(v.input.steer))) * (v.slip > 0.25 ? 0.3 : 1);
      v.input.throttle = Math.min(1, err * 0.35 + 0.15) * Math.max(0.2, tc);
      v.input.brake = 0;
    }
    else if (err < -1.2 || target < 0.3) { v.input.throttle = 0; v.input.brake = target < 0.3 && v.vLong < 0.5 ? 0 : Math.min(1, -err * 0.3 + 0.2); if (target < 0.3 && v.vLong < 0.4) { v.input.handbrake = true; } }
    else { v.input.throttle = 0; v.input.brake = 0; }
  }

  /**
   * Off the road (pulling out of a parking lot): steer toward the road with
   * feelers that look for a heading clear of walls and parked cars, at walking
   * pace, backing up when boxed in. Returns false once the car reaches the road.
   */
  stepOffroad(dt) {
    const v = this.v, g = this.game, w = this.wp[0];
    const onRoad = roadAt(v.pos.x, v.pos.z) && Math.hypot(w.x - v.pos.x, w.z - v.pos.z) < 9;
    this.offT = (this.offT || 0) + dt;
    if (onRoad || this.offT > 25) { this.offroad = false; return false; }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.input.throttle = 0; v.input.brake = 0.6; v.input.handbrake = false; v.input.steer = this.backSteer || 0;
      return true;
    }
    // nosed into a dead end with the way out behind us: back out toward it while the rear is clear,
    // swinging the tail toward it (the forward feelers only look ahead)
    const [wlx, wlz] = v.worldToLocal(w.x, w.z);
    const offBack = Math.PI - Math.abs(Math.atan2(wlx, wlz)); // 0 = straight behind
    if (wlz < 0 && offBack < 1.1 && Math.hypot(wlx, wlz) > 4) {
      let rear = 6;
      for (const side of [-1, 0, 1]) {
        const [sx, sz] = v.localToWorld(side * (v.hx - 0.1), -v.hz + 0.3);
        const [bx, bz] = [sx - Math.sin(v.yaw) * 1, sz - Math.cos(v.yaw) * 1];
        const hit = g.world.collision.raycast(sx, v.pos.y + 0.5, sz, bx - sx, 0, bz - sz, 6, (c) => c.tag !== 'glass');
        if (hit) rear = Math.min(rear, hit.t);
      }
      if (rear > 1.6) {
        v.input.throttle = 0; v.input.handbrake = false;
        v.input.brake = v.vLong < -2.5 ? 0 : 0.6;
        // backing with the wheels turned away from the tail's target swings the tail toward it
        v.input.steer = Math.max(-1, Math.min(1, -Math.sign(wlx) * offBack * 1.5));
        return true;
      }
    }
    const desired = Math.atan2(w.x - v.pos.x, w.z - v.pos.z);
    const range = 9;
    const [fx, fz] = v.localToWorld(0, v.hz);
    const freeAlong = (h) => {
      const dx = Math.sin(h), dz = Math.cos(h);
      // side rays from both front corners too, so the car's width fits through
      let free = range;
      for (const side of [-1, 0, 1]) {
        const [sx, sz] = v.localToWorld(side * (v.hx + 0.3), v.hz - 0.3);
        const hit = g.world.collision.raycast(sx, v.pos.y + 0.5, sz, dx, 0, dz, range, (c) => c.tag !== 'glass');
        if (hit) free = Math.min(free, hit.t);
      }
      // water is a wall too (the edge of a key, a canal)
      for (let s2 = 1; s2 < free; s2 += 1) if (g.world.isWater(fx + dx * s2, fz + dz * s2)) { free = s2; break; }
      for (const o of g.vehicles) {
        if (o === v || Math.abs(o.pos.x - v.pos.x) > range + 8 || Math.abs(o.pos.z - v.pos.z) > range + 8) continue;
        for (let s = 0.5; s < free; s += 0.75) {
          const [lx, lz] = o.worldToLocal(fx + dx * s, fz + dz * s);
          if (Math.abs(lx) < o.hx + v.hx * 0.9 && Math.abs(lz) < o.hz + 0.4) { free = s; break; }
        }
      }
      return free;
    };
    let best = desired, bestScore = -Infinity, bestFree = 0;
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
      const h = desired + off;
      // only headings the car can reach from where it points
      let rel = h - v.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) > 2.2) continue;
      const free = freeAlong(h);
      let score = Math.min(free, 7) / 7 * 2 - Math.abs(off) * 0.5 - Math.abs(rel) * 0.15;
      // a line that just got us boxed in is avoided for a while
      for (const f of this.failed || []) { const df = Math.atan2(Math.sin(h - f.h), Math.cos(h - f.h)); if (Math.abs(df) < 0.4) score -= 1.2; }
      if (score > bestScore) { bestScore = score; best = h; bestFree = free; }
    }
    let dy = best - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const steer = Math.max(-1, Math.min(1, -dy * 2));
    // boxed in, or pushing against something the feelers missed: back up and try another line
    if ((bestFree < 2.2 && v.speed < 1.5) || (v.speed < 0.25 && v.input.throttle > 0)) this.boxedT = (this.boxedT || 0) + dt; else this.boxedT = 0;
    if (this.failed) this.failed = this.failed.filter((f) => this.offT - f.t < 6);
    if (bestScore === -Infinity || this.boxedT > 0.6) {
      (this.failed || (this.failed = [])).push({ h: best, t: this.offT });
      this.reverseT = 1.3; this.backSteer = -steer || 1; this.boxedT = 0;
      return true;
    }
    const target = Math.min(5, 1 + bestFree * 0.5);
    v.input.steer = steer;
    v.input.handbrake = false;
    if (v.vLong < target) { v.input.throttle = 0.45; v.input.brake = 0; } else { v.input.throttle = 0; v.input.brake = 0.3; }
    return true;
  }

  /** Closest vehicle or person in the lane band ahead. */
  obstacleAhead(speed) {
    const v = this.v, g = this.game;
    const range = 8 + speed * 1.6;
    let best = null;
    const test = (x, z, halfW, who) => {
      const [lx, lz] = v.worldToLocal(x, z);
      if (lz <= v.hz * 0.5 || lz > range + v.hz) return;
      // widen the band slightly in the direction we are steering
      const bend = -v.steer * lz * 0.25;
      if (Math.abs(lx - bend) > v.hx + halfW + 0.35) return;
      const dist = lz - v.hz - halfW;
      if (!best || dist < best.dist) best = { dist, who };
    };
    for (const o of g.vehicles) {
      if (o === v || (this.ignoreT > 0 && o === this.ignore) || Math.abs(o.pos.x - v.pos.x) > range + 6 || Math.abs(o.pos.z - v.pos.z) > range + 6) continue;
      if (Math.abs(o.pos.y - v.pos.y) > 2.5) continue;
      test(o.pos.x, o.pos.z, Math.max(o.hx, o.hz * 0.6), o);
    }
    for (const c of g.allCharacters()) {
      if (c.vehicle || (c.dead && c.deadT > 8)) continue;
      if (Math.abs(c.pos.x - v.pos.x) > range + 2 || Math.abs(c.pos.z - v.pos.z) > range + 2) continue;
      test(c.pos.x, c.pos.z, 0.4, c);
    }
    return best;
  }
}

/**
 * Hand a vehicle to a DriverAI starting from wherever it is: join the nearest
 * road point the car can actually see, heading the way the car faces, and
 * (with a destination) route along the road segment nearest that point so the
 * car drives past it. Used by the partner when they drive, and by test tools.
 */
export function attachDriver(v, game, dest = null) {
  let rp = null;
  for (const e of edges) {
    const A = nodes[e.a], B = nodes[e.b];
    const dx = B.x - A.x, dz = B.z - A.z;
    const t = Math.max(0.05, Math.min(0.95, ((v.pos.x - A.x) * dx + (v.pos.z - A.z) * dz) / (dx * dx + dz * dz)));
    const px = A.x + dx * t, pz = A.z + dz * t;
    const dist = Math.hypot(px - v.pos.x, pz - v.pos.z);
    if (rp && dist >= rp.dist) continue;
    // (bridge railings and median planters are part of the road: they don't hide it)
    const hit = game.world.collision.raycast(v.pos.x, v.pos.y + 0.8, v.pos.z, px - v.pos.x, 0, pz - v.pos.z, 1, (c) => c.tag !== 'prop' && c.tag !== 'railing');
    if (hit && hit.t < 0.98) continue;
    rp = { edge: e, t, x: px, z: pz, dist };
  }
  if (!rp) rp = nearestRoadPoint(v.pos.x, v.pos.z);
  const e = rp.edge, a = nodes[e.a], b = nodes[e.b];
  const [fx, fz] = v.forward;
  const from = ((b.x - a.x) * fx + (b.z - a.z) * fz) >= 0 ? e.a : e.b;
  const to = from === e.a ? e.b : e.a;
  const t = Math.max(0.05, Math.min(0.95, from === e.a ? rp.t : 1 - rp.t));
  const ai = new DriverAI(v, game, { edge: e.id, from, lane: 0, t: Math.min(0.95, t + 0.15) });
  ai.mode = dest ? 'route' : 'cruise';
  ai.offroad = !roadAt(v.pos.x, v.pos.z) || rp.dist > 6; // in a lot: feel the way out first
  if (dest) {
    const tp = nearestRoadPoint(dest.x, dest.z);
    const [A, B] = [tp.edge.a, tp.edge.b];
    const viaA = findRoute(to, A), viaB = findRoute(to, B);
    const len = (r) => (r ? r.length : 1e9);
    ai.route = len(viaA) <= len(viaB) ? [...(viaA || [to]), B] : [...(viaB || [to]), A];
  }
  return ai;
}

/**
 * Direct pursuit (police, mission enemies): steer at a target's predicted
 * position, picking the clearest heading with feelers, backing off when stuck.
 * `st` holds stuckT/reverseT between calls.
 */
export function pursuitSteer(g, v, u, dt, target, targetVehicle, { closeStop = 18 } = {}) {
  let tx = target.x, tz = target.z;
  if (targetVehicle) {
    const lead = Math.min(1.5, Math.hypot(tx - v.pos.x, tz - v.pos.z) / (v.speed + 8));
    tx += targetVehicle.vel.x * lead; tz += targetVehicle.vel.y * lead;
  }
  const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
  // feelers: pick the heading closest to the target that isn't blocked
  const coll = g.world.collision;
  const range = 8 + v.speed * 0.8;
  let best = desired, bestScore = -Infinity;
  for (const off of [0, 0.3, -0.3, 0.65, -0.65, 1.1, -1.1]) {
    const h = desired + off;
    const dx = Math.sin(h), dz = Math.cos(h);
    const [fx, fz] = v.localToWorld(0, v.hz);
    const hit = coll.raycast(fx, v.pos.y + 0.7, fz, dx, 0, dz, range, (c) => c.tag !== 'prop' || c.r > 0.2);
    let freeT = hit ? hit.t : range;
    for (let s = 2; s < freeT; s += 2) if (g.world.isWater(fx + dx * s, fz + dz * s) && v.pos.y < 2) { freeT = s; break; } // don't chase anyone into the sea
    const free = freeT / range;
    const score = free * 2 - Math.abs(off) * 0.8;
    if (score > bestScore) { bestScore = score; best = h; }
  }
  let dy = best - v.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const dist = Math.hypot(tx - v.pos.x, tz - v.pos.z);
  v.input.steer = Math.max(-1, Math.min(1, -dy * 2.2));
  v.input.handbrake = Math.abs(dy) > 1.3 && v.speed > 10;
  const close = !targetVehicle && dist < closeStop;
  const tooFast = Math.abs(dy) > 0.9 && v.speed > 14;
  v.input.throttle = close || tooFast ? 0 : 1;
  v.input.brake = close && v.speed > 3 ? 1 : tooFast ? 0.6 : 0;
  // stuck recovery
  if (v.speed < 1 && v.input.throttle > 0) u.stuckT += dt; else u.stuckT = Math.max(0, u.stuckT - dt);
  if (u.stuckT > 1.6) { u.reverseT = 1.4; u.stuckT = 0; }
  if (u.reverseT > 0) { u.reverseT -= dt; v.input.throttle = 0; v.input.brake = 1; v.input.steer = -v.input.steer; v.input.handbrake = false; }
}
