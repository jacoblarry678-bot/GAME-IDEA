// Park staff. Every ride has a crew: the operator at the control console
// and attendants who, while a train boards, walk the platform car by car
// and push every lap bar or harness down (riders pull most of their own
// first), give the operator a thumbs up, and wave the train off. Around
// the park there are cashiers in every shop and restaurant, greeters at the
// gate, vendors at the carts and sweepers keeping the paths clean.
import * as THREE from 'three';
import { STAFF, SWEEP_FRAMES, registerLook } from './people/crowd.js';
import { outfit } from './people/human.js';
import { LINES as WALKWAYS } from './guests.js';

const HEAD = 6.0; // speech bubble height above the feet
const NEAR = 260; // crews further than this from the camera are not drawn
const WALKWAY = 0.42;

const pos3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);
const yawOf = (c) => Math.atan2(c[5], c[11]); // from a CFrame's look vector
const pick = (list) => (list && list.length ? list[Math.floor(Math.random() * list.length)] : '');
const turn = (from, to, k) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * Math.min(1, k);
};

let nextSeed = 910000;

// a uniformed staff member's look
function uniform(landColor, cfg) {
  const seed = nextSeed++;
  const o = outfit(seed);
  Object.assign(o, {
    shirt: landColor, pants: cfg.pants, longPants: 1, sleeves: 0, staff: true,
    hatOn: seed % 5 < 2 ? 1 : 0, hat: cfg.cap, height: 0.95 + (seed % 11) / 100,
  });
  if (o.hairStyle === 1) o.hatOn = 0;
  registerLook(seed, o);
  return seed;
}

class Person {
  constructor(seed, pos, yaw) {
    this.seed = seed;
    this.pos = pos.clone();
    this.yaw = yaw;
    this.pose = null; // a STAFF stance, or null = idle
    this.idle = 0;
    this.walking = false;
    this.cycle = 0;
    this.tasks = [];
    this.head = new THREE.Vector3();
  }

  headPos() {
    return this.head.copy(this.pos).add({ x: 0, y: HEAD, z: 0 });
  }

  // run the task list: walk somewhere, check a car, hold a pose
  step(dt, onCheck) {
    this.walking = false;
    const t = this.tasks[0];
    if (!t) return;
    if (t.type === 'walk') {
      const d = new THREE.Vector3(t.to.x - this.pos.x, 0, t.to.z - this.pos.z);
      const dist = d.length();
      const move = t.speed * dt;
      if (dist <= move || dist < 0.05) {
        this.pos.copy(t.to);
        this.tasks.shift();
        if (t.yaw !== undefined) this.yaw = t.yaw;
      } else {
        d.multiplyScalar(move / dist);
        this.pos.add(d);
        this.pos.y += (t.to.y - this.pos.y) * Math.min(1, dt * 6);
        this.yaw = turn(this.yaw, Math.atan2(-d.x, -d.z), dt * 10);
        this.walking = true;
        this.cycle += move / 5.4;
      }
      this.pose = null;
    } else if (t.type === 'check') {
      t.time = (t.time || 0) + dt;
      this.pose = STAFF.CHECK;
      this.yaw = turn(this.yaw, t.yaw, dt * 10);
      if (!t.done && t.time >= t.dur * 0.55) {
        t.done = true;
        onCheck(t.stop);
      }
      if (t.time >= t.dur) this.tasks.shift();
    } else if (t.type === 'pose') {
      t.time = (t.time || 0) + dt;
      this.pose = t.pose;
      if (t.yaw !== undefined) this.yaw = turn(this.yaw, t.yaw, dt * 8);
      if (t.time >= t.dur) this.tasks.shift();
    }
  }

  draw(people, time) {
    if (this.walking) people.add('walk', this.cycle, this.pos.x, this.pos.y, this.pos.z, this.yaw, this.seed);
    else if (this.pose === STAFF.WAVE) people.add('staff', STAFF.WAVE + (Math.floor(time * 3.2) % 2), this.pos.x, this.pos.y, this.pos.z, this.yaw, this.seed);
    else if (this.pose !== null) people.add('staff', this.pose, this.pos.x, this.pos.y, this.pos.z, this.yaw, this.seed);
    else people.add('idle', this.idle, this.pos.x, this.pos.y, this.pos.z, this.yaw, this.seed);
  }
}

// ------------------------------------------------------------- ride crew
class Crew {
  constructor(sys, ride, rideCfg, landColor) {
    this.sys = sys;
    this.id = ride.id;
    const c = ride.crew;
    this.c = c;
    this.restraint = c.restraint;
    this.flat = !ride.track;
    this.stops = c.stops.map((cf) => ({ pos: pos3(cf), yaw: yawOf(cf) }));
    this.stopCars = c.stopCars;
    // seats each stop covers (one big car checked from several stops)
    this.stopSeats = this.stops.map((_, i) => {
      const car = c.stopCars[i];
      const same = c.stopCars.map((cc, j) => [cc, j]).filter(([cc]) => cc === car).map(([, j]) => j);
      const nSeats = ride.seats[car - 1].length;
      if (same.length === 1) return Array.from({ length: nSeats }, (_, s) => s + 1);
      const k = same.indexOf(i), per = Math.ceil(nSeats / same.length);
      const out = [];
      for (let s = k * per + 1; s <= Math.min(nSeats, (k + 1) * per); s++) out.push(s);
      return out;
    });
    this.operator = new Person(uniform(landColor, sys.cfg), pos3(c.operator), yawOf(c.operator));
    this.operator.pose = STAFF.OPERATE;
    this.attendants = [];
    for (let k = 0; k < c.attendants; k++) {
      const home = { pos: pos3(c.homes[k]), yaw: yawOf(c.homes[k]) };
      const a = new Person(uniform(landColor, sys.cfg), home.pos, home.yaw);
      a.home = home;
      a.route = c.routes[k].map((i) => i - 1);
      a.idle = k % 2 ? 3 : 0;
      this.attendants.push(a);
    }
    this.center = this.stops.reduce((acc, s) => acc.add(s.pos), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, this.stops.length));
    this.cycleId = -1;
    this.status = '';
    this.said = new Set();
    this.chatter = 10 + Math.random() * 20;
  }

  line(kind) {
    const L = this.sys.lines;
    if (kind === 'pull') return pick(this.restraint === 'harness' ? L.pullHarness : this.restraint === 'belt' ? L.belt : this.restraint === 'lapbar' ? L.pull : L.checkNone);
    return pick(L[kind]);
  }

  say(who, text, once) {
    if (once) {
      if (this.said.has(once)) return;
      this.said.add(once);
    }
    this.sys.say(who, text);
  }

  // Plan an attendant's walk down the train for this boarding.
  planBoarding(a, e) {
    const S = this.sys.timing;
    const B = this.sys.boarding;
    const start = Math.max(e, S.checkFrom);
    const avail = Math.max(1.2, B - S.allClear - start - 0.2);
    const pts = [a.pos.clone(), ...a.route.map((i) => this.stops[i].pos)];
    if (this.flat) pts.push(a.home.pos); // step off before the ride moves
    let dist = 0;
    for (let i = 1; i < pts.length; i++) dist += pts[i].distanceTo(pts[i - 1]);
    const n = a.route.length;
    let dwell = S.checkTime, speed = S.walk;
    if (dist / speed + n * dwell > avail) {
      dwell = Math.max(0.3, Math.min(S.checkTime, (avail * 0.3) / Math.max(1, n)));
      speed = Math.min(18, dist / Math.max(0.4, avail - n * dwell));
    }
    a.tasks = [];
    if (e < S.checkFrom) a.tasks.push({ type: 'pose', pose: null, dur: S.checkFrom - e });
    for (const i of a.route) {
      a.tasks.push({ type: 'walk', to: this.stops[i].pos, speed });
      a.tasks.push({ type: 'check', stop: i, dur: dwell, yaw: this.stops[i].yaw });
    }
    if (this.flat) a.tasks.push({ type: 'walk', to: a.home.pos, yaw: a.home.yaw, speed });
  }

  // an attendant reaches a car: every restraint there gets pushed down
  check(a, i) {
    const sys = this.sys;
    const st = sys.sim.rides.get(this.id);
    const car = this.stopCars[i];
    let closedRider = false, playerHere = false, playerWasClosed = false;
    for (const seat of this.stopSeats[i]) {
      const rider = st.riders.find((r) => r.car === car && r.seat === seat);
      const isPlayer = rider && rider.player;
      if (isPlayer) {
        playerHere = true;
        playerWasClosed = sys.rideVis.restraintClosed(this.id, car, seat);
      }
      if (sys.rideVis.setRestraint(this.id, car, seat, true)) {
        if (rider) closedRider = true;
        sys.latch(this.stops[i].pos);
      }
    }
    const near = sys.isNear(a.pos);
    if (playerHere && (this.restraint === 'lapbar' || this.restraint === 'harness')) {
      if (playerWasClosed) {
        this.sys.say(a, pick(sys.lines.check));
      } else {
        this.sys.say(a, 'Let me get that for you!');
        sys.hooks.toast(`A ride attendant locked your ${this.restraint === 'harness' ? 'harness' : 'lap bar'} - you're all set!`, 'info');
      }
      sys.hooks.sound('click');
    } else if (playerHere) {
      this.sys.say(a, this.restraint === 'belt' ? 'Belt on? Great!' : pick(sys.lines.checkNone));
    } else if (near && Math.random() < 0.3) {
      this.sys.say(a, closedRider ? 'There we go - nice and snug!' : this.line(this.restraint === 'none' ? 'checkNone' : 'check'));
    }
  }

  // fast-forward an attendant's remaining tasks (when frames are slow)
  finish(a) {
    for (const t of a.tasks) {
      if (t.type === 'check' && !t.done) { t.done = true; this.check(a, t.stop); }
      if (t.type === 'walk') { a.pos.copy(t.to); if (t.yaw !== undefined) a.yaw = t.yaw; }
    }
    a.tasks = [];
    a.walking = false;
  }

  update(dt, now, time, near) {
    const sys = this.sys;
    const st = sys.sim.rides.get(this.id);
    if (!st) return;
    const B = sys.boarding;
    const S = sys.timing;
    const status = st.status;
    const newCycle = st.cycleId !== this.cycleId;
    if (status === 'Boarding') {
      const e = Math.min(B, Math.max(0, now - (st.cycleStart - B)));
      if (newCycle || this.status !== 'Boarding') {
        this.cycleId = st.cycleId;
        this.said.clear();
        sys.rideVis.setAllRestraints(this.id, false, !near);
        // most riders pull their own restraint down; a few wait for help
        this.pulls = st.riders.filter((r) => !r.player && r.car).map((r) => ({ car: r.car, seat: r.seat, at: 0.6 + Math.random() * (S.pullBy - 0.6), skip: Math.random() < 0.18 }));
        for (const a of this.attendants) this.planBoarding(a, e);
      }
      for (const p of this.pulls) {
        if (p.done || p.skip || e < p.at) continue;
        p.done = true;
        if (sys.rideVis.setRestraint(this.id, p.car, p.seat, true)) sys.latch(this.center);
      }
      if (near) {
        if (e < 2.5) this.say(this.operator, this.line('pull'), 'pull');
        if (e >= B - S.allClear && this.attendants.length) this.say(this.attendants[0], pick(sys.lines.clear), 'clear');
        if (e >= B - S.dispatch) this.say(this.operator, pick(sys.lines.dispatch), 'dispatch');
      }
      this.operator.pose = e >= B - S.dispatch ? STAFF.DISPATCH : STAFF.OPERATE;
      for (const a of this.attendants) {
        a.step(dt, (i) => this.check(a, i));
        if (e >= B - S.allClear && a.tasks.length) this.finish(a);
        if (!a.tasks.length) {
          // done: thumbs up toward the operator when it's time
          const toOp = Math.atan2(-(this.operator.pos.x - a.pos.x), -(this.operator.pos.z - a.pos.z));
          a.pose = e >= B - S.allClear ? STAFF.THUMBS : null;
          if (a.pose !== null) a.yaw = turn(a.yaw, toOp, dt * 6);
        }
      }
    } else if (status === 'Running') {
      if (this.status !== 'Running') {
        // anything left unchecked gets locked as the train leaves
        sys.rideVis.setAllRestraints(this.id, true, !near);
        for (const a of this.attendants) {
          a.tasks = [
            { type: 'pose', pose: STAFF.WAVE, dur: 2.4 },
            { type: 'walk', to: a.home.pos, yaw: a.home.yaw, speed: S.walk * 0.7 },
          ];
        }
        this.runSince = time;
      }
      this.operator.pose = time - this.runSince < 1.2 ? STAFF.DISPATCH : STAFF.OPERATE;
      for (const a of this.attendants) a.step(dt, () => {});
    } else {
      if (status === 'Unloading' && this.status !== 'Unloading') {
        sys.rideVis.setAllRestraints(this.id, false, !near);
        if (near) this.say(this.operator, pick(sys.lines.unload));
      }
      if ((status === 'Open' || status === 'Closed') && this.status !== status) sys.rideVis.setAllRestraints(this.id, false, !near);
      this.operator.pose = STAFF.OPERATE;
      for (const a of this.attendants) {
        a.step(dt, () => {});
        if (!a.tasks.length) a.pose = null;
      }
      // a little chatter while the line waits
      this.chatter -= dt;
      if (this.chatter <= 0) {
        this.chatter = 20 + Math.random() * 25;
        if (status === 'Open' && sys.playerNear(this.operator.pos, 30)) this.say(this.operator, pick(sys.lines.wait));
      }
    }
    this.status = status;
    if (!near) return;
    this.operator.draw(sys.people, time);
    for (const a of this.attendants) a.draw(sys.people, time);
    sys.bubbles.follow(this.operator, this.operator.headPos());
    for (const a of this.attendants) sys.bubbles.follow(a, a.headPos());
  }
}

// -------------------------------------------------------------- the staff
export class StaffSystem {
  constructor({ data, people, rideVis, sim, bubbles, hooks }) {
    this.data = data;
    this.people = people;
    this.rideVis = rideVis;
    this.sim = sim;
    this.bubbles = bubbles;
    this.hooks = hooks; // { toast, sound, latch }
    this.cfg = data.staff;
    this.lines = data.staff.lines;
    this.timing = data.staff;
    this.boarding = data.config.BoardingTime;
    const lands = new Map(data.config.Lands.map((l) => [l.id, l.color]));
    const rideCfg = new Map(data.config.Rides.map((r) => [r.id, r]));
    this.crews = data.rides.filter((r) => r.crew).map((r) => new Crew(this, r, rideCfg.get(r.id), lands.get(rideCfg.get(r.id).land) ?? 0xc42828));
    // cashiers, greeters and vendors where the park builder put them
    this.spots = (data.staffSpots || []).filter((s) => s.role !== 'operator').map((s) => {
      const p = new Person(uniform(lands.get(s.land) ?? 0xc42828, this.cfg), pos3(s.cf), yawOf(s.cf));
      p.role = s.role;
      p.kind = s.kind;
      p.home = { pos: p.pos.clone(), yaw: p.yaw };
      p.idle = p.seed % 3 === 0 ? 3 : 0;
      p.greeted = false;
      p.waveFor = 0;
      p.nextWave = 3 + Math.random() * 6;
      return p;
    });
    // sweepers on the main walkways
    this.sweepers = [0, 4, 7, 11, 15].map((li, k) => {
      const line = WALKWAYS[li % WALKWAYS.length];
      const p = new Person(uniform(0x6a7f96, this.cfg), line[0], 0);
      p.line = line;
      p.s = 0.2 + k * 0.15;
      p.dir = k % 2 ? 1 : -1;
      p.offset = (k % 2 ? 1 : -1) * 6;
      p.pause = 0;
      p.chat = 0;
      return p;
    });
    this.cam = new THREE.Vector3();
    this.player = new THREE.Vector3();
    this.lastLatch = 0;
    this.time = 0;
  }

  isNear(p) {
    return p.distanceToSquared(this.cam) < 70 * 70;
  }

  playerNear(p, r) {
    return p.distanceToSquared(this.player) < r * r;
  }

  say(person, text) {
    const at = person.headPos();
    if (!this.bubbles.near(at, this.cam)) return;
    this.bubbles.say(person, text, at);
  }

  // the clunk of a lap bar locking (close by, not too often)
  latch(at) {
    if (at.distanceToSquared(this.cam) > 45 * 45 || this.time - this.lastLatch < 0.12) return;
    this.lastLatch = this.time;
    this.hooks.latch();
  }

  // the player pulls their own restraint down
  playerPull() {
    const id = this.sim.ridingRide;
    const st = id && this.sim.rides.get(id);
    if (!st || st.status !== 'Boarding' || !st.player) return false;
    const crew = this.crews.find((c) => c.id === id);
    if (!crew || (crew.restraint !== 'lapbar' && crew.restraint !== 'harness')) return false;
    if (!this.rideVis.setRestraint(id, st.player.car, st.player.seat, true)) return false;
    this.hooks.latch();
    this.hooks.toast(crew.restraint === 'harness' ? 'Harness down and locked. An attendant will check it.' : 'Lap bar down and locked. An attendant will check it.', 'info');
    return true;
  }

  // what the player can do right now (for the hint): 'pull' or null
  playerAction() {
    const id = this.sim.ridingRide;
    const st = id && this.sim.rides.get(id);
    if (!st || st.status !== 'Boarding' || !st.player) return null;
    const crew = this.crews.find((c) => c.id === id);
    if (!crew || (crew.restraint !== 'lapbar' && crew.restraint !== 'harness')) return null;
    return this.rideVis.restraintClosed(id, st.player.car, st.player.seat) ? null : crew.restraint;
  }

  update(dt, now, time, cam, playerPos) {
    // crews keep to the park clock even when frames are slow
    const clockDt = this.lastNow === undefined ? dt : Math.min(1, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    this.time = time;
    this.cam.copy(cam);
    this.player.copy(playerPos);
    for (const crew of this.crews) {
      const near = crew.center.distanceToSquared(cam) < NEAR * NEAR || this.sim.ridingRide === crew.id;
      crew.update(clockDt, now, time, near);
    }
    // shop, gate and cart staff: wave and say hello when you come by
    for (const p of this.spots) {
      if (p.pos.distanceToSquared(cam) > 220 * 220) continue;
      const close = this.playerNear(p.pos, p.role === 'greeter' ? 22 : 15);
      if (close && !p.greeted) {
        p.greeted = true;
        p.waveFor = 2.2;
        const kind = p.role === 'cashier' ? (p.kind === 'restaurant' ? 'food' : 'shop') : p.role === 'vendor' ? p.kind : p.role;
        this.say(p, pick(this.lines[kind]));
      } else if (!this.playerNear(p.pos, 30)) {
        p.greeted = false;
      }
      if (p.role === 'greeter') {
        p.nextWave -= dt;
        if (p.nextWave <= 0) { p.waveFor = 2; p.nextWave = 5 + Math.random() * 6; }
      }
      p.waveFor -= dt;
      p.pose = p.waveFor > 0 ? STAFF.WAVE : null;
      // face the player while greeting, otherwise their post
      const want = close ? Math.atan2(-(this.player.x - p.pos.x), -(this.player.z - p.pos.z)) : p.home.yaw;
      p.yaw = turn(p.yaw, want, dt * 4);
      p.draw(this.people, time);
      this.bubbles.follow(p, p.headPos());
    }
    // sweepers work their way along the walkways
    for (const p of this.sweepers) {
      const [a, b] = p.line;
      const len = a.distanceTo(b);
      if (p.pause > 0) p.pause -= dt;
      else {
        p.s += (dt * 0.9 * p.dir) / len;
        if (p.s > 1 || p.s < 0) { p.dir *= -1; p.s = Math.min(1, Math.max(0, p.s)); p.pause = 3; }
        if (Math.random() < dt * 0.02) p.pause = 2 + Math.random() * 3;
      }
      const ax = (b.x - a.x) / len, az = (b.z - a.z) / len;
      p.pos.set(a.x + (b.x - a.x) * p.s - az * p.offset, WALKWAY, a.z + (b.z - a.z) * p.s + ax * p.offset);
      p.yaw = Math.atan2(-ax * p.dir, -az * p.dir);
      if (p.pos.distanceToSquared(cam) > 200 * 200) continue;
      p.chat -= dt;
      if (p.chat <= 0 && this.playerNear(p.pos, 9)) {
        p.chat = 40;
        this.say(p, pick(this.lines.sweeper));
      }
      const frame = p.pause > 0 ? 0 : Math.floor(time * 2.4 + p.seed) % SWEEP_FRAMES;
      this.people.add('staff', STAFF.SWEEP + frame, p.pos.x, p.pos.y, p.pos.z, p.yaw, p.seed);
      this.bubbles.follow(p, p.headPos());
    }
  }
}
