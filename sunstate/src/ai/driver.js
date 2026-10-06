/**
 * DriverAI: follows lanes on the road graph. It keeps a queue of waypoints
 * (lane centre lines plus sampled turn curves), extends the queue by picking
 * the next edge at each intersection, obeys signals at stop lines, brakes for
 * anything in its path, and steers with pure pursuit.
 *
 * Right-hand traffic. Lane offset is measured to the right of the travel
 * direction; lane 0 is next to the centre line.
 */
import { ROAD_GRAPH, LANE_W, signalState } from '../world/layout.js';

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
  const off = (lane + 0.5) * LANE_W;
  const ha = dx ? a.hx : a.hz, hb = dx ? b.hx : b.hz;
  return {
    x0: a.x + dx * (ha + 1) + rx * off, z0: a.z + dz * (ha + 1) + rz * off,
    x1: b.x - dx * (hb + 1) + rx * off, z1: b.z - dz * (hb + 1) + rz * off,
    dx, dz, a, b, axis: Math.abs(dx) > 0.5 ? 'ew' : 'ns',
  };
}

export function speedLimit(e) { return e.road === 'causeway' ? 19 : e.lanes === 2 ? 15 : 11.5; }

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
      const pref = options.filter((id) => edges[id].road !== 'causeway' || Math.random() < 0.25);
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
    } else { cx = (cur.x1 + nl.x0) / 2; cz = (cur.z1 + nl.z0) / 2; }
    const turnSpeed = uturn ? 4 : Math.abs(cross) > 0.5 ? (cross > 0 ? 5.5 : 7) : speedLimit(ne);
    const N = uturn ? 8 : 5;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1);
      const x = (1 - t) * (1 - t) * cur.x1 + 2 * (1 - t) * t * cx + t * t * nl.x0;
      const z = (1 - t) * (1 - t) * cur.z1 + 2 * (1 - t) * t * cz + t * t * nl.z0;
      this.wp.push({ x, z, speed: turnSpeed, inNode: at });
    }
    const lim = speedLimit(ne);
    this.wp.push({ x: nl.x0, z: nl.z0, speed: Math.min(lim, turnSpeed + 3) });
    // intermediate points keep pure pursuit on long straights
    const steps = Math.max(1, Math.floor(nd.len / 25));
    for (let i = 1; i < steps; i++) this.wp.push({ x: nl.x0 + (nl.x1 - nl.x0) * (i / steps), z: nl.z0 + (nl.z1 - nl.z0) * (i / steps), speed: lim });
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
    if (!v.driver || v.driver.dead) { v.input.throttle = 0; v.input.brake = 1; return; }
    if (v.sunk || v.destroyed) { v.input.throttle = 0; return; }
    // drop waypoints we've reached or passed (measured along the path, so a car
    // facing the wrong way keeps its route and turns around instead)
    while (this.wp.length > 1) {
      const a = this.wp[0], b = this.wp[1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = ((v.pos.x - a.x) * dx + (v.pos.z - a.z) * dz) / (dx * dx + dz * dz || 1);
      if (Math.hypot(v.pos.x - a.x, v.pos.z - a.z) < 3.5 || t > 0.02) this.wp.shift(); else break;
    }
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
    if (this.waitT > 5) { this.ignore = obs.who; this.ignoreT = 5; this.waitT = 0; this.reverseT = 1.0; }
    if (obs) target = Math.min(target, Math.max(0, Math.sqrt(2 * 5 * Math.max(0, obs.dist - 3)) - 0.5));

    // recover from being stuck (blocked by something static, pushed off the lane)
    if (speed < 0.6 && target > 3 && !obs) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.stuckT > 2.5) { this.reverseT = 1.6; this.stuckT = 0; this.ignore = null; this.ignoreT = 3; } // back up, then take a line offset to the side
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
