// Guests with somewhere to be. Each comes in through the front gate, picks
// a ride, a restaurant or a shop (the popular rides more often, somewhere
// close by more often than across the park), and walks there the way the
// walking map finds - along the paths, down the Lower Lot's escalators. At
// a ride they join its line and are gone a while (riding), at a shop or a
// restaurant they go in; then they come back out (from the ride's exit) and
// pick the next place. After a few they head home. The park fills through
// the morning (early entry brings a few), and at closing time every guest
// makes for the gate - the park empties out.
import * as Clock from './clock.js';
import { phaseAt } from './parkhours.js';
import { lookFor, strideLength } from './people/crowd.js';

const GATE = { x: 0, y: 0.42, z: 279 }; // just inside the front gate
const DRAW = 280; // drawn this close to the camera
const ROUTES_PER_FRAME = 1; // new ways worked out per frame (ways already found are free)

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GuestFlow {
  // (each park has its own: its gate, and its lands - or every land but another park's)
  constructor(people, nav, data, sim, max, { gate = GATE, lands = null, exclude = null } = {}) {
    this.gate = gate;
    this.people = people;
    this.nav = nav;
    this.sim = sim;
    this.max = max;
    this.rng = mulberry(4242);
    const cfg = data.config;
    const P = (p) => ({ x: p[0], y: p[1] || 0, z: p[2] });
    this.places = [];
    const ours = (land) => (lands ? lands.includes(land) : !(exclude || []).includes(land));
    for (const r of cfg.Rides) {
      if (!r.entrance || r.refurb || r.shutdown || !ours(r.land)) continue;
      this.places.push({ kind: 'ride', id: r.id, name: r.name, in: P(r.entrance), out: P(r.exit || r.entrance), weight: 0.6 + (r.baseWait ?? 20) / 20, stay: [40, 110] });
    }
    for (const v of cfg.Venues) {
      if (!ours(v.land)) continue;
      const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[v.facing] || [0, 1];
      const d = v.size[2] / 2 + 4;
      const front = { x: v.position[0] + f[0] * d, y: v.position[1] || 0, z: v.position[2] + f[1] * d };
      this.places.push({ kind: v.kind, id: v.id, name: v.name, in: front, out: front, weight: v.kind === 'restaurant' ? 1.3 : 0.7, stay: v.kind === 'restaurant' ? [35, 80] : [20, 50] });
    }
    // only places the walking map reaches from the gate
    const g = nav.comp[nav.nearest(gate.x, gate.y, gate.z, 15)] ?? nav.gateGroup;
    this.group = g;
    this.places = this.places.filter((p) => nav.nearest(p.in.x, p.in.y, p.in.z, 15, g) >= 0 && nav.nearest(p.out.x, p.out.y, p.out.z, 15, g) >= 0);
    this.guests = [];
    this.nextSpawn = 0;
    this.nextSeed = 60000;
    this.routes = 0;
    this.out = 0; // guests who've gone home today
  }

  setMax(n) { this.max = n; }

  // how many guests the park should hold now
  target(m) {
    const ph = phaseAt(m);
    if (ph === 'early') return Math.round(this.max * 0.22);
    if (ph === 'open') return Math.round(this.max * Math.min(1, Clock.crowd(m)));
    return 0;
  }

  // is a place taking guests?
  open(p, ph) {
    if (p.kind === 'ride') {
      const s = this.sim.rideState(p.id);
      return !s.hours && s.status !== 'Closed' && !s.refurb;
    }
    return ph === 'open' || (ph === 'early' && p.kind === 'restaurant');
  }

  newGuest(at, state) {
    const seed = this.nextSeed++;
    const r = this.rng;
    const look = lookFor(seed).o;
    const g = {
      seed, pos: { ...at }, yaw: Math.PI, cycle: r(), speed: (3.8 + r() * 1.6) * look.height, stride: strideLength(seed),
      path: null, seg: 0, segT: 0, state: 'think', place: null, last: null, until: 0, visits: 0, maxVisits: 3 + Math.floor(r() * 6),
      offset: (r() - 0.5) * 2.2, stopFor: 0, nextStop: 10 + r() * 25, idle: Math.floor(r() * 4), leaving: false, wait: 0,
    };
    this.guests.push(g);
    return g;
  }

  // pick where to go next (or home), and ask the way
  decide(g, now, ph) {
    const home = g.leaving || g.visits >= g.maxVisits || ph === 'closing' || ph === 'night' || ph === 'setup';
    let dest = null, place = null;
    if (home) {
      g.leaving = true;
      dest = this.gate;
    } else {
      const open = this.places.filter((p) => p !== g.last && this.open(p, ph));
      if (!open.length) { g.leaving = true; return; }
      let total = 0;
      const w = open.map((p) => { const d = Math.hypot(p.in.x - g.pos.x, p.in.z - g.pos.z); const v = p.weight / (1 + d / 350); total += v; return v; });
      let pick = this.rng() * total, i = 0;
      while (i < open.length - 1 && (pick -= w[i]) > 0) i++;
      place = open[i];
      dest = place.in;
    }
    let path = this.nav.route(g.pos, dest, false, this.group);
    if (path === undefined) {
      if (this.routes >= ROUTES_PER_FRAME) return; // (asked again next frame)
      this.routes++;
      path = this.nav.route(g.pos, dest, true, this.group);
    }
    if (!path || path.length < 1) {
      g.fails = (g.fails || 0) + 1;
      if (g.fails > 3) g.leaving = true;
      if (g.fails > 6) g.state = 'gone';
      return;
    }
    g.fails = 0;
    g.path = path;
    g.seg = 0;
    g.segT = 0;
    g.place = place;
    g.state = 'walk';
  }

  update(dt, cam) {
    const now = Clock.now(), m = Clock.minutes(), ph = phaseAt(m);
    this.routes = 0;
    // arrivals at the gate, filling the park toward the target
    const want = this.target(m);
    const here = this.guests.length;
    if (here < want && now >= this.nextSpawn) {
      // (a day in the park passes in minutes, so most guests come in out of
      // sight - already at a ride or a shop somewhere - and the rest come
      // through the gate where you can watch them arrive)
      const p = this.places[Math.floor(this.rng() * this.places.length)];
      const unseen = p && Math.hypot(p.out.x - cam.x, p.out.z - cam.z) > DRAW + 30;
      if (unseen && this.open(p, ph) && this.rng() < 0.7) {
        const g = this.newGuest(p.out);
        Object.assign(g, { state: 'inside', place: p, until: now + this.rng() * 25, visits: 1 });
      } else this.newGuest(this.gate);
      this.nextSpawn = now + (want - here > 20 ? 0.15 : 0.45) + this.rng() * 0.5;
    } else if (here > want + 6 && this.rng() < dt * 0.5) {
      // the evening thins out: someone decides it's time to go
      const g = this.guests[Math.floor(this.rng() * here)];
      if (!g.leaving) g.maxVisits = g.visits;
    }
    // at closing, those inside come out soon and everyone heads for the gate
    if (ph === 'closing' || ph === 'night') for (const g of this.guests) {
      if (g.state === 'inside' && g.until > now + 20) g.until = now + this.rng() * 20;
      g.leaving = true;
    }
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      if (g.leaving && g.state === 'think' && (g.pos.x - cam.x) ** 2 + (g.pos.z - cam.z) ** 2 > (DRAW + 30) ** 2) { this.guests.splice(i, 1); this.out++; continue; }
      if (g.state === 'think') this.decide(g, now, ph);
      if (g.state === 'inside') {
        if (now < g.until) continue;
        // out of the ride's exit (or the shop's door)
        Object.assign(g.pos, g.place.out);
        g.last = g.place;
        g.place = null;
        g.state = 'think';
        this.decide(g, now, ph);
      }
      if (g.state === 'gone') { this.guests.splice(i, 1); this.out++; continue; }
      // out of sight, a guest heading home is as good as gone
      const seen = (g.pos.x - cam.x) ** 2 + (g.pos.z - cam.z) ** 2 < (DRAW + 30) ** 2;
      if (g.leaving && !seen && g.state !== 'inside') { this.guests.splice(i, 1); this.out++; continue; }
      if (g.state !== 'walk') { this.draw(g, cam, false); continue; }
      this.walk(g, dt, now, ph, seen);
      if (g.state === 'gone') { this.guests.splice(i, 1); this.out++; continue; }
      this.draw(g, cam, g.state === 'walk' && g.stopFor <= 0);
    }
  }

  walk(g, dt, now, ph, seen) {
    // stop now and then to look around (not on an escalator)
    const P = g.path;
    let a = P[g.seg], b = P[g.seg + 1];
    const riding = a?.ride && b?.ride;
    if (g.stopFor > 0) { g.stopFor -= dt; return; }
    if (!riding) {
      g.nextStop -= dt;
      if (g.nextStop <= 0) { g.stopFor = 1.5 + this.rng() * 3; g.nextStop = 15 + this.rng() * 30; }
    }
    let step = g.speed * dt * (seen ? 1 : 4); // (out of sight they get there quicker)
    while (step > 0 && b) {
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
      const left = len * (1 - g.segT);
      if (step < left) { g.segT += step / len; step = 0; } else { step -= left; g.seg++; g.segT = 0; a = P[g.seg]; b = P[g.seg + 1]; }
    }
    if (!b) {
      // there
      Object.assign(g.pos, P[P.length - 1]);
      if (g.leaving && !g.place) { g.state = 'gone'; return; }
      const p = g.place;
      if (p && this.open(p, ph)) {
        g.state = 'inside';
        g.visits++;
        g.until = now + p.stay[0] + this.rng() * (p.stay[1] - p.stay[0]);
      } else {
        g.last = p;
        g.state = 'think';
      }
      return;
    }
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    const fx = (b.x - a.x) / len, fz = (b.z - a.z) / len;
    const t = g.segT;
    // (a little to one side of the line, so they don't walk in single file - not on an escalator)
    const off = a.ride || b.ride ? 0 : g.offset;
    const x = a.x + (b.x - a.x) * t - fz * off, z = a.z + (b.z - a.z) * t + fx * off;
    g.pos.x = x; g.pos.z = z;
    g.pos.y = a.ride && b.ride ? a.y + (b.y - a.y) * t : this.nav.floorAt(x, z);
    g.cycle += (g.speed * dt) / g.stride;
    const yaw = Math.atan2(-fx, -fz);
    const d = Math.atan2(Math.sin(yaw - g.yaw), Math.cos(yaw - g.yaw));
    g.yaw += d * Math.min(1, dt * 8);
  }

  draw(g, cam, moving) {
    const dx = g.pos.x - cam.x, dz = g.pos.z - cam.z;
    if (dx * dx + dz * dz > DRAW * DRAW) return;
    const y = g.pos.y + 0.02;
    if (moving) this.people.add('walk', g.cycle, g.pos.x, y, g.pos.z, g.yaw, g.seed);
    else this.people.add('idle', g.idle, g.pos.x, y, g.pos.z, g.yaw + (g.stopFor > 0 ? Math.sin(Clock.now() * 0.7 + g.seed) * 0.5 : 0), g.seed);
  }

  // how the park's doing, for the HUD
  count() {
    return this.guests.length;
  }
}
