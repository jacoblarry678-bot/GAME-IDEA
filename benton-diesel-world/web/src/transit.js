// Getting around outside the gate: the free Benton Shuttle buses looping
// the Transit Center and the three hotels, traffic on the Benton Parkway,
// and your own car, which you can drive between the lot and a hotel. You
// wait at a stop for the next bus (in real time), ride it and get off at
// any stop.
import * as THREE from 'three';
import { buildModel } from './geom.js';
import { Figure } from './people/figure.js';
import { CAR_PARTS, CAR_COLORS } from './entrance.js';
import { PARKWAY, EAST_LINK, WEST_LINK } from './resort.js';
import { HAUNT_OVER, CHRISTMAS, XMAS_OVER, MARDI_GRAS } from './season.js';

const ROAD = 0.34;
const DEC = 10; // braking, studs/s²
const ALAT = 20; // how hard vehicles corner
const DWELL = 6; // seconds a bus waits at a stop

// --------------------------------------------------------------- routes
// rounded corners: each corner becomes a short curve
function rounded(pts, closed, r) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const B = pts[i];
    const first = !closed && i === 0, last = !closed && i === n - 1;
    if (first || last) { out.push(B); continue; }
    const A = pts[(i - 1 + n) % n], C = pts[(i + 1) % n];
    const d1 = Math.hypot(A[0] - B[0], A[1] - B[1]), d2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
    if (d1 < 1e-3 || d2 < 1e-3) continue;
    const t = Math.min(r, d1 / 2, d2 / 2);
    const p0 = [B[0] + ((A[0] - B[0]) / d1) * t, B[1] + ((A[1] - B[1]) / d1) * t];
    const p2 = [B[0] + ((C[0] - B[0]) / d2) * t, B[1] + ((C[1] - B[1]) / d2) * t];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      out.push([(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * B[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * B[1] + u * u * p2[1]]);
    }
  }
  return out;
}

export class Route {
  constructor(pts, { closed = false, round = 9, step = 1.5, vmax = 22 } = {}) {
    this.closed = closed;
    const P = rounded(pts, closed, round);
    if (closed) P.push(P[0]);
    // resample evenly
    const xs = [], zs = [];
    let carry = 0;
    xs.push(P[0][0]); zs.push(P[0][1]);
    for (let i = 1; i < P.length; i++) {
      const [ax, az] = P[i - 1], [bx, bz] = P[i];
      const len = Math.hypot(bx - ax, bz - az);
      let d = step - carry;
      while (d <= len) {
        xs.push(ax + ((bx - ax) * d) / len);
        zs.push(az + ((bz - az) * d) / len);
        d += step;
      }
      carry = len - (d - step);
    }
    this.step = step;
    this.n = xs.length;
    this.x = Float32Array.from(xs);
    this.z = Float32Array.from(zs);
    this.length = (this.n - 1) * step;
    // heading and a speed limit from how sharply the road bends
    this.yaw = new Float32Array(this.n);
    this.lim = new Float32Array(this.n);
    const at = (i) => (closed ? ((i % (this.n - 1)) + (this.n - 1)) % (this.n - 1) : Math.max(0, Math.min(this.n - 1, i)));
    for (let i = 0; i < this.n; i++) {
      const a = at(i - 1), b = at(i + 1);
      this.yaw[i] = Math.atan2(-(this.x[b] - this.x[a]), -(this.z[b] - this.z[a]));
    }
    for (let i = 0; i < this.n; i++) {
      const a = at(i - 3), b = at(i + 3);
      const d = Math.atan2(Math.sin(this.yaw[b] - this.yaw[a]), Math.cos(this.yaw[b] - this.yaw[a]));
      const k = Math.abs(d) / (6 * step);
      this.lim[i] = Math.max(4.5, Math.min(vmax, Math.sqrt(ALAT / Math.max(k, 1e-4))));
    }
  }

  wrap(s) {
    return this.closed ? ((s % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, s));
  }

  at(s, out) {
    s = this.wrap(s);
    const f = s / this.step;
    const i = Math.min(this.n - 2, Math.floor(f));
    const u = f - i;
    out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * u;
    out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * u;
    const y0 = this.yaw[i], y1 = this.yaw[i + 1];
    out.yaw = y0 + Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)) * u;
    return out;
  }

  // the fastest you can go now and still make every bend ahead
  allowed(s, horizon = 60) {
    const i0 = Math.floor(this.wrap(s) / this.step);
    let best = Infinity;
    for (let k = 0; k * this.step < horizon; k++) {
      let j = i0 + k;
      if (j >= this.n) {
        if (!this.closed) break;
        j %= this.n - 1;
      }
      const d = Math.max(0, k * this.step - (this.wrap(s) - i0 * this.step));
      best = Math.min(best, Math.sqrt(this.lim[j] ** 2 + 2 * DEC * d));
    }
    return best;
  }

  nearestS(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best * this.step;
  }
}

// ---------------------------------------------------------------- models
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// the Benton Haunt wrap on the side of every shuttle
function wrapTexture() {
  return canvasTexture(1024, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#120a1c');
    grad.addColorStop(1, '#2a0e2e');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4ecc8';
    g.beginPath();
    g.arc(w - 70, 64, 44, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#120a1c';
    g.beginPath();
    g.arc(w - 52, 52, 40, 0, Math.PI * 2);
    g.fill();
    g.textBaseline = 'middle';
    g.fillStyle = '#ff7a1a';
    g.font = `900 ${HAUNT_OVER ? 52 : 64}px "Arial Black", Arial, sans-serif`;
    g.fillText(XMAS_OVER ? 'WOLVERINE' : CHRISTMAS ? 'HAPPY HOLIDAYS!' : HAUNT_OVER ? 'THANKS FOR SCREAMING!' : 'BENTON HAUNT', 24, 50);
    g.fillStyle = '#f2f2ee';
    g.font = '700 28px Arial, sans-serif';
    g.fillText(MARDI_GRAS ? 'THE CLAWS ARE OUT · NOW OPEN' : XMAS_OVER ? 'THE CLAWS ARE OUT · COMING SOON' : CHRISTMAS ? 'MEET SANTA · BENTON HOLIDAYS THROUGH JAN 1' : HAUNT_OVER ? 'BENTON HAUNT RETURNS NEXT FALL' : '7 HOUSES · 7 SCARE ZONES · THROUGH NOV 2', 26, 104);
  });
}

function signTexture(text, color = '#ffb020') {
  return canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#0a0a0c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 40px "Courier New", monospace';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function busParts(mi) {
  const P = (sx, sy, sz, x, y, z, color, mat, shape = 0) => [shape, sx, sy, sz, x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
  const W = 0xf2f2ee;
  return [
    P(8.4, 3.6, 36, 0, 2.7, 0, W, 'SmoothPlastic'),
    P(8.5, 0.9, 36.1, 0, 1.35, 0, 0x16223a, 'SmoothPlastic'),
    P(8.55, 0.5, 36.1, 0, 4.3, 0, 0xff7a1a, 'SmoothPlastic'),
    P(8.5, 3.6, 31, 0, 6.3, 0.5, 0x22303c, 'Glass'),
    ...[-12, -6, 0, 6, 12].map((z) => P(8.6, 3.6, 0.5, 0, 6.3, z, W, 'SmoothPlastic')),
    P(8.4, 3.6, 2, 0, 6.3, 17, W, 'SmoothPlastic'),
    P(7.8, 4.4, 0.3, 0, 6, -17.95, 0x22303c, 'Glass'),
    P(8.4, 1.8, 36, 0, 9, 0, W, 'SmoothPlastic'),
    P(5, 1, 9, 0, 10.4, 4, 0xb8bcc4, 'Metal'),
    P(0.25, 6, 3, 4.2, 4.2, -14, 0x1a2228, 'Glass'),
    ...[-3, 3].map((x) => P(1.4, 0.7, 0.2, x, 2.4, -18.1, 0xfff4d8, 'Neon')),
    ...[-3, 3].map((x) => P(1.2, 1, 0.2, x, 2.6, 18.1, 0xff2020, 'Neon')),
    ...[[-3.9, -11], [3.9, -11], [-3.9, 11.5], [3.9, 11.5]].map(([x, z]) => P(1, 3.2, 3.2, x, 1.6, z, 0x191919, 'Rubber', 2)),
  ];
}

// -------------------------------------------------------------- transit
export class Transit {
  constructor({ scene, data, layout, people, entrance, player, hooks }) {
    this.scene = scene;
    this.data = data;
    this.people = people;
    this.entrance = entrance;
    this.player = player;
    this.hooks = hooks; // { toast, sound, voice }
    this.layout = layout;
    this.tmp = { x: 0, z: 0, yaw: 0 };
    const mi = (name) => {
      let i = data.materials.indexOf(name);
      if (i < 0) { data.materials.push(name); i = data.materials.length - 1; }
      return i;
    };
    this.mi = mi;

    // the shuttle loop and its stops
    this.loop = new Route(layout.loop, { closed: true, vmax: 34 });
    // in the order the bus reaches them
    this.stops = layout.stops.map((st) => ({ ...st, s: this.loop.nearestS(st.at[0], st.at[1]), waiting: 2 + Math.floor(Math.random() * 4), nextGuest: 5 + Math.random() * 10 })).sort((a, b) => a.s - b.s);
    const wrap = wrapTexture(), dest = signTexture('BENTON SHUTTLE  FREE');
    const wrapMat = new THREE.MeshStandardMaterial({ map: wrap, roughness: 0.5 });
    const destMat = new THREE.MeshBasicMaterial({ map: dest });
    this.buses = [];
    const COUNT = 3;
    for (let k = 0; k < COUNT; k++) {
      const group = new THREE.Group();
      const body = buildModel(busParts(mi), data.materials, { detail: true, shadows: true });
      group.add(body);
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(27, 3.1), wrapMat);
        m.position.set(side * 4.29, 2.75, 1.5);
        m.rotation.y = side * Math.PI / 2;
        if (side < 0) m.scale.x = 1;
        group.add(m);
      }
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.9), destMat);
      d.position.set(0, 8.95, -18.12);
      d.rotation.y = Math.PI;
      group.add(d);
      // the driver
      const driver = new Figure({ skin: [0x8d5524, 0xe0ac69, 0xc68642, 0xf1c27d][k % 4], shirt: 0x16223a, pants: 0x1c1c20, hair: 0x1a1a1a, shoes: 0x111111, hat: 0x16223a, sleeves: 0, longPants: 1, hairStyle: 0, hatOn: 1, fem: k % 2, height: 1, width: 1 });
      driver.update(0, { sitting: true });
      driver.root.position.set(-2.2, 3.3, -14.5);
      group.add(driver.root);
      // a seat for the player, by the door
      const seat = new THREE.Object3D();
      seat.position.set(2.2, 3.4, -8);
      group.add(seat);
      scene.add(group);
      const s = (k / COUNT) * this.loop.length;
      this.buses.push({ kind: 'bus', group, seat, route: this.loop, s, v: 0, vmax: 34, half: 18, dwell: 0, next: this.nextStopIndex(s), passengers: 4 + k * 2, x: 0, z: 0, yaw: 0, stuck: 0, ghost: 0 });
    }

    // traffic on the parkway: instanced cars
    const model = buildModel(CAR_PARTS(0xffffff)(mi), data.materials, { detail: true });
    this.carCap = 16;
    this.carMeshes = model.children.map((c) => {
      const m = new THREE.InstancedMesh(c.geometry, c.material, this.carCap);
      m.count = 0;
      m.castShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    this.bodyMesh = this.carMeshes.find((m) => m.material.name === 'paint') || this.carMeshes[0];
    const P = PARKWAY;
    this.lanes = [
      new Route([[P.x1 + 40, P.wb], [P.x0 - 40, P.wb]], { vmax: 40 }),
      new Route([[P.x0 - 40, P.eb], [P.x1 + 40, P.eb]], { vmax: 40 }),
    ];
    this.traffic = [];
    for (let k = 0; k < 12; k++) {
      const route = this.lanes[k % 2];
      this.traffic.push({ kind: 'car', route, s: ((k >> 1) / 6) * route.length + Math.random() * 40, v: 18, vmax: 32 + Math.random() * 8, half: 5.5, color: CAR_COLORS[k % CAR_COLORS.length], x: 0, z: 0, yaw: 0, stuck: 0, ghost: 0, wait: 0 });
    }

    // your car: parked in the lot (drawn by the entrance) or at a hotel
    this.myCar = null; // { group, seat, x, z, yaw, at: hotel id }
    this.carColor = 0x1e6ee6;
    this.destIndex = 0;
    this.trip = null; // { vehicle, dest }
    this.onBus = null;
    this.waitingAt = null;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.color = new THREE.Color();
  }

  nextStopIndex(s) {
    let best = 0, bd = Infinity;
    this.stops.forEach((st, i) => {
      const d = (st.s - s + this.loop.length) % this.loop.length;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ------------------------------------------------------------ vehicles
  obstacles() {
    const list = [];
    for (const b of this.buses) list.push(b);
    for (const c of this.traffic) if (!c.wait) list.push(c);
    if (this.trip) list.push(this.trip.vehicle);
    for (const c of this.entrance.cars) if (c.state === 'drive') list.push({ x: c.pos.x, z: c.pos.z, half: 5.5 });
    if (!this.player.riding) list.push({ x: this.player.pos.x, z: this.player.pos.z, half: 1.2, person: true });
    return list;
  }

  drive(veh, dt, obstacles) {
    const route = veh.route;
    let want = Math.min(veh.vmax, route.allowed(veh.s));
    // buses brake for their next stop
    if (veh.kind === 'bus') {
      const st = this.stops[veh.next];
      const d = (st.s - veh.s + route.length) % route.length;
      want = Math.min(want, Math.sqrt(2 * DEC * Math.max(0, d - 0.3)));
      if (d < 0.8 && veh.v < 1.2) {
        veh.s = st.s;
        veh.v = 0;
        veh.dwell = DWELL;
        this.arrive(veh, st);
        return;
      }
    }
    if (!route.closed) want = Math.min(want, Math.sqrt(2 * DEC * Math.max(0, route.length - veh.s - 0.5)));
    // keep back from whatever is ahead (other vehicles, people)
    let blocked = false;
    if (veh.ghost > 0) veh.ghost -= dt;
    else {
      const fx = -Math.sin(veh.yaw), fz = -Math.cos(veh.yaw);
      for (const o of obstacles) {
        if (o === veh) continue;
        const rx = o.x - veh.x, rz = o.z - veh.z;
        const along = rx * fx + rz * fz;
        if (along <= 0 || along > 45) continue;
        const lat = Math.abs(rx * fz - rz * fx);
        if (lat > (o.person ? 4.6 : 4.4)) continue;
        const gap = along - veh.half - o.half - 2.5;
        const v = Math.max(0, gap) * 0.9;
        if (v < want) { want = v; blocked = true; }
      }
    }
    if (blocked && veh.v < 0.3) {
      veh.stuck += dt;
      if (veh.stuck > 6) { veh.ghost = 2.5; veh.stuck = 0; }
    } else veh.stuck = 0;
    // accelerate gently, brake as hard as needed
    veh.v = want > veh.v ? Math.min(want, veh.v + 9 * dt) : Math.max(want, veh.v - 14 * dt);
    veh.s += veh.v * dt;
    if (route.closed) veh.s = route.wrap(veh.s);
  }

  place(veh) {
    veh.route.at(veh.s, this.tmp);
    veh.x = this.tmp.x;
    veh.z = this.tmp.z;
    veh.yaw = this.tmp.yaw;
    if (veh.group) {
      veh.group.position.set(veh.x, ROAD, veh.z);
      veh.group.rotation.set(0, veh.yaw, 0);
    }
  }

  // a bus pulls in: riders get off and on
  arrive(bus, st) {
    const off = st.id === 'transit' ? bus.passengers : Math.floor(bus.passengers * (0.3 + Math.random() * 0.4));
    bus.passengers -= off;
    if (st.id === 'transit') for (let k = 0; k < Math.min(4, off); k++) this.entrance.addWalkerFrom(st.wait[0] - 20 + k * 3, st.wait[1] + 2);
    bus.passengers = Math.min(14, bus.passengers + st.waiting);
    st.waiting = 0;
    // the player waiting here climbs aboard
    const p = this.player.pos;
    if (this.waitingAt === st && !this.player.riding && Math.hypot(p.x - st.wait[0], p.z - st.wait[1]) < 18) {
      this.waitingAt = null;
      this.onBus = bus;
      bus.group.updateMatrixWorld(true);
      this.player.riding = { transit: true, matrix: bus.seat.matrixWorld.clone() };
      this.hooks.sound('join');
      const next = this.stops[(this.stops.indexOf(st) + 1) % this.stops.length];
      this.hooks.toast(`All aboard the Benton Shuttle! Next stop: ${next.name}. Press E at any stop to get off.`, 'info');
    } else if (this.onBus === bus) {
      this.hooks.voice?.(`Now arriving at ${st.name}.`);
    }
  }

  // seconds until the next bus pulls in at a stop
  etaTo(st) {
    let best = Infinity;
    const L = this.loop.length;
    for (const b of this.buses) {
      if (b.dwell > 0 && this.stops[b.next] === st) return 0;
      const d = (st.s - b.s + L) % L;
      let between = 0;
      for (const o of this.stops) if (o !== st && (o.s - b.s + L) % L < d) between++;
      best = Math.min(best, d / 22 + between * DWELL + Math.max(0, b.dwell));
    }
    return best;
  }

  etaText(sec) {
    if (sec < 20) return 'arriving now';
    return `in about ${Math.max(1, Math.round(sec / 60))} min`;
  }

  // ------------------------------------------------------------- your car
  hotel(id) {
    return this.layout.hotels.find((h) => h.id === id);
  }

  carDestinations() {
    const at = this.myCar ? this.myCar.at : 'lot';
    const list = [];
    if (at !== 'lot') list.push({ id: 'lot', name: 'Benton Diesel World parking' });
    for (const h of this.layout.hotels) if (h.id !== at) list.push({ id: h.id, name: h.name });
    return list;
  }

  // points from where your car is to the parkway, and from the parkway in
  carOut() {
    if (this.myCar) {
      const h = this.hotel(this.myCar.at);
      const [x, z] = h.spot;
      if (!h.north) return [[x, z], [x + 6, z - 14], [h.x + 6, z - 16], [h.x + 6, PARKWAY.eb + 8]];
      const lane = h.x - 6; // southbound: keep right
      return [[x, z], [x, z - 11], [x + (lane - x) * 0.5, z - 14], [lane, z - 4], [lane, PARKWAY.wb - 8]];
    }
    const st = this.entrance.myCar;
    const az = this.entrance.aisle(st);
    const side = Math.sign(st.x) || 1;
    const lane = side > 0 ? EAST_LINK.sb : WEST_LINK.sb;
    return [[st.x, st.z], [st.x, az], [lane - side * 10, az], [lane, az + 8], [lane, PARKWAY.wb - 8]];
  }

  carIn(dest) {
    if (dest === 'lot') {
      const stall = this.entrance.freeStall('Regular', true) || this.entrance.freeStall('Preferred', true);
      if (!stall) return null;
      stall.taken = true;
      this.pendingStall = stall;
      const pts = this.entrance.routeIn(stall);
      return [[pts[0][0], PARKWAY.wb - 8], ...pts];
    }
    const h = this.hotel(dest);
    const [x, z] = h.spot;
    if (!h.north) return [[h.x - 6, PARKWAY.eb + 8], [h.x - 6, z - 12], [x + 10, z - 12], [x, z - 6], [x, z]];
    const lane = h.x + 6; // northbound: keep right
    return [[lane, PARKWAY.wb - 8], [lane, z - 6], [x + (lane - x) * 0.4, z - 14], [x, z - 10], [x, z]];
  }

  startDrive(dest) {
    const out = this.carOut();
    const inn = this.carIn(dest.id);
    if (!out || !inn) { this.hooks.toast('There is no space to park there right now.', 'warn'); return; }
    const [x0] = out[out.length - 1], [x1] = inn[0];
    const lane = x1 < x0 ? PARKWAY.wb : PARKWAY.eb;
    const dir = Math.sign(x1 - x0) || 1;
    const pts = [...out, [x0, lane], [x0 + dir * 12, lane], [x1 - dir * 12, lane], [x1, lane], ...inn];
    // leaving the lot: the parked car becomes the one you drive
    if (!this.myCar) {
      const st = this.entrance.myCar;
      const parked = this.entrance.cars.find((c) => c.state === 'parked' && c.stall === st);
      if (parked) this.carColor = parked.color;
      this.entrance.cars = this.entrance.cars.filter((c) => !(c.state === 'parked' && c.stall === st));
      st.taken = false;
      this.entrance.myCar = null;
      this.myCar = this.makeCar(st.x, st.z, 0);
    }
    const car = this.myCar;
    car.at = null;
    const route = new Route(pts, { vmax: 32, round: 7 });
    const veh = { kind: 'mine', group: car.group, route, s: 0, v: 0, vmax: 32, half: 5.5, x: car.x, z: car.z, yaw: car.yaw, stuck: 0, ghost: 0 };
    this.trip = { vehicle: veh, dest };
    car.group.updateMatrixWorld(true);
    this.player.riding = { transit: true, matrix: car.seat.matrixWorld.clone() };
    this.waitingAt = null;
    this.hooks.sound('join');
    this.hooks.toast(`Buckle up! Driving to ${dest.name}...`, 'info');
  }

  // your car has a glass cabin, so you can be seen driving
  makeCar(x, z, yaw) {
    const group = new THREE.Group();
    const mi = this.mi, c = this.carColor;
    const P = (sx, sy, sz, px, py, pz, color, mat, shape = 0) => [shape, sx, sy, sz, px, py, pz, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
    const parts = [
      P(6.5, 2.4, 11, 0, 2.1, 0, c, 'SmoothPlastic'),
      P(6, 0.35, 5.6, 0, 5.45, 0.6, c, 'SmoothPlastic'),
      ...[[-2.85, -2.1], [2.85, -2.1], [-2.85, 3.2], [2.85, 3.2]].map(([px, pz]) => P(0.35, 2.1, 0.35, px, 4.35, pz, c, 'SmoothPlastic')),
      P(5.4, 2, 0.15, 0, 4.35, -2.15, 0xa0c8e6, 'Glass'),
      P(5.4, 2, 0.15, 0, 4.35, 3.25, 0xa0c8e6, 'Glass'),
      P(1.6, 0.6, 0.2, -2.1, 2.6, -5.55, 0xfff4d8, 'Neon'), P(1.6, 0.6, 0.2, 2.1, 2.6, -5.55, 0xfff4d8, 'Neon'),
      ...[[-3.2, -3.6], [-3.2, 3.6], [3.2, -3.6], [3.2, 3.6]].map(([px, pz]) => P(0.8, 2.6, 2.6, px, 1.3, pz, 0x191919, 'Rubber', 2)),
    ];
    group.add(buildModel(parts, this.data.materials, { detail: true, shadows: true }));
    const seat = new THREE.Object3D();
    seat.position.set(-1.4, 2.2, 0.6);
    group.add(seat);
    group.position.set(x, ROAD - 0.3, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    return { group, seat, x, z, yaw, at: null };
  }

  finishDrive() {
    const { vehicle, dest } = this.trip;
    this.trip = null;
    const car = this.myCar;
    const p = this.player;
    if (dest.id === 'lot') {
      this.scene.remove(car.group);
      this.myCar = null;
      const stall = this.pendingStall;
      this.entrance.park(stall, this.carColor);
      this.entrance.myCar = stall;
      p.stopRiding({ pos: new THREE.Vector3(stall.x - Math.sign(stall.x) * 5, 1, stall.z), yaw: 0 });
      this.hooks.toast('Parked in Regular Parking. Head through security to the gate!', 'info');
    } else {
      car.at = dest.id;
      car.x = vehicle.x; car.z = vehicle.z; car.yaw = vehicle.yaw;
      const h = this.hotel(dest.id);
      const side = Math.sign(h.x - car.x) || 1;
      p.stopRiding({ pos: new THREE.Vector3(car.x + side * 4.6, 1, car.z), yaw: car.yaw });
      this.hooks.toast(`Welcome to the ${dest.name}! The shuttle stop is out front, or take your car back to the park.`, 'info');
    }
    p.snapCamera();
  }

  // --------------------------------------------------------- prompts, UI
  prompt(pos) {
    if (this.trip) return null;
    if (this.onBus) {
      const bus = this.onBus;
      if (bus.dwell <= 0) return null;
      const st = this.stops[bus.next];
      return { key: `off:${st.id}`, title: `🚌 ${st.name}`, sub: 'The shuttle is stopped here.', color: 0x1e6ee6, actions: [{ label: 'Get off here', run: () => this.getOff() }] };
    }
    if (this.player.riding) return null;
    // a bus stop
    for (const st of this.stops) {
      if (Math.hypot(pos.x - st.wait[0], pos.z - st.wait[1]) > 9) continue;
      const waiting = this.waitingAt === st;
      const eta = this.etaText(this.etaTo(st));
      return {
        key: `stop:${st.id}:${waiting}`, title: `🚏 ${st.name}`, color: 0x1e6ee6,
        sub: `Free Benton Shuttle · next bus ${eta}${waiting ? ' · stay close to the stop' : ''}`,
        actions: waiting
          ? [{ label: 'Waiting for the bus...', disabled: true }, { label: 'Stop waiting', run: () => { this.waitingAt = null; } }]
          : [{ label: 'Wait for the shuttle', run: () => { this.waitingAt = st; this.hooks.toast(`Waiting for the Benton Shuttle at ${st.short}. Next bus ${eta}.`, 'info'); } }],
      };
    }
    // your car
    const carPos = this.myCar ? [this.myCar.x, this.myCar.z] : this.entrance.myCar ? [this.entrance.myCar.x, this.entrance.myCar.z] : null;
    if (carPos && Math.hypot(pos.x - carPos[0], pos.z - carPos[1]) < 8.5) {
      const dests = this.carDestinations();
      const dest = dests[this.destIndex % dests.length];
      return {
        key: `car:${dest.id}`, title: '🚗 Your car', color: this.carColor, sub: `Drive to ${dest.name}`,
        actions: [{ label: 'Drive there', run: () => this.startDrive(dest) }, { label: 'Change destination', run: () => { this.destIndex++; } }],
      };
    }
    return null;
  }

  pill() {
    if (this.trip) return `🚗 Driving to ${this.trip.dest.name}...`;
    if (this.onBus) {
      const st = this.stops[this.onBus.next];
      return this.onBus.dwell > 0 ? `🚌 Stopped at ${st.name} · press E to get off` : `🚌 Benton Shuttle · next stop: ${st.name}`;
    }
    if (this.waitingAt) return `🚏 Waiting at ${this.waitingAt.short} · next bus ${this.etaText(this.etaTo(this.waitingAt))}`;
    return null;
  }

  getOff() {
    const bus = this.onBus;
    if (!bus || bus.dwell <= 0) return;
    const st = this.stops[bus.next];
    this.onBus = null;
    this.player.stopRiding({ pos: new THREE.Vector3(st.wait[0], 1.2, st.wait[1]), yaw: st.id === 'BackwoodsLodge' ? Math.PI : 0 });
    this.player.snapCamera();
    this.hooks.toast(st.id === 'transit' ? 'Welcome back! Security and the front gate are just west of the platform.' : `Welcome to the ${st.name}!`, 'info');
  }

  // "back to my car": wherever it is parked
  toCar(player) {
    this.waitingAt = null;
    if (!this.myCar) { this.entrance.toCar(player); return; }
    const h = this.hotel(this.myCar.at);
    const side = Math.sign(h.x - this.myCar.x) || 1;
    player.pos.set(this.myCar.x + side * 4.6, 1, this.myCar.z);
    player.vel.set(0, 0, 0);
    player.snapCamera();
  }

  seatMatrix() {
    const g = this.trip ? this.myCar : this.onBus;
    if (!g) return null;
    g.group.updateMatrixWorld(true);
    return g.seat.matrixWorld;
  }

  // ------------------------------------------------------------- update
  // vehicles run on real time (not the frame clock, which slows down when
  // frames are slow), in small steps
  update(dt, cam) {
    const now = performance.now() / 1000;
    const real = Math.min(2, this.lastT ? now - this.lastT : dt);
    this.lastT = now;
    const steps = Math.max(1, Math.ceil(real / 0.08));
    for (let k = 0; k < steps; k++) this.step(real / steps);
    this.draw(cam);
  }

  step(dt) {
    const obstacles = this.obstacles();
    for (const b of this.buses) {
      if (b.dwell > 0) {
        b.dwell -= dt;
        if (b.dwell <= 0) {
          b.next = (b.next + 1) % this.stops.length;
          if (this.onBus === b) this.hooks.toast(`Next stop: ${this.stops[b.next].name}`, 'info');
        }
      } else this.drive(b, dt, obstacles);
      this.place(b);
    }
    for (const c of this.traffic) {
      if (c.wait > 0) {
        c.wait -= dt;
        if (c.wait <= 0) {
          // only pull out when the start of the lane is clear
          if (this.traffic.some((o) => o !== c && o.route === c.route && !o.wait && o.s < 30)) c.wait = 1;
          else { c.s = 0; c.v = 16; c.wait = 0; }
        }
        continue;
      }
      this.drive(c, dt, obstacles);
      if (c.s >= c.route.length - 1) { c.wait = 2 + Math.random() * 8; c.color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]; }
      this.place(c);
    }
    if (this.trip) {
      const veh = this.trip.vehicle;
      this.drive(veh, dt, obstacles);
      this.place(veh);
      this.myCar.x = veh.x; this.myCar.z = veh.z; this.myCar.yaw = veh.yaw;
      this.myCar.group.position.y = ROAD - 0.3;
      if (veh.s >= veh.route.length - 0.6) this.finishDrive();
    }
    // waiting at a stop: walk away and you stop waiting
    if (this.waitingAt) {
      const p = this.player.pos;
      if (Math.hypot(p.x - this.waitingAt.wait[0], p.z - this.waitingAt.wait[1]) > 22) {
        this.hooks.toast('You left the bus stop.', 'warn');
        this.waitingAt = null;
      }
    }
    // guests turn up at the stops
    for (const st of this.stops) {
      st.nextGuest -= dt;
      if (st.nextGuest <= 0) {
        st.nextGuest = 6 + Math.random() * 14;
        st.waiting = Math.min(8, st.waiting + 1);
      }
    }
  }

  draw(cam) {
    // parkway cars
    let n = 0;
    for (const c of this.traffic) {
      if (c.wait || n >= this.carCap) continue;
      this.q.setFromAxisAngle(this.up, c.yaw);
      this.p.set(c.x, ROAD - 0.3, c.z);
      this.m.compose(this.p, this.q, this.one);
      for (const mesh of this.carMeshes) mesh.setMatrixAt(n, this.m);
      this.bodyMesh.setColorAt(n, this.color.setHex(c.color));
      n++;
    }
    for (const mesh of this.carMeshes) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    // people waiting at the stops, and riders standing in the buses
    for (const st of this.stops) {
      const [x, z] = st.wait;
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 260 * 260) continue;
      const facing = st.id === 'BackwoodsLodge' ? 0 : Math.PI;
      for (let k = 0; k < st.waiting; k++) {
        const u = (k - (st.waiting - 1) / 2) * 2.4;
        const seed = 51000 + this.stops.indexOf(st) * 100 + k;
        this.people.add('idle', k % 3, x + u + (k % 2) * 0.4, st.id === 'transit' ? 0.8 : ROAD + 0.5, z + (k % 2) * 1.6 - 0.8, facing + Math.sin(k * 2.1) * 0.4, seed);
      }
    }
    for (const b of this.buses) {
      if ((b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 > 200 * 200) continue;
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      for (let k = 0; k < b.passengers; k++) {
        const lx = (k % 2 ? 2 : -2), lz = -6 + Math.floor(k / 2) * 3.2;
        if (this.onBus === b && k === 0) continue;
        const wx = b.x + c * lx + s * lz, wz = b.z - s * lx + c * lz;
        this.people.add('idle', k % 4, wx, ROAD + 2.4, wz, b.yaw + (k % 2 ? -1.2 : 1.2), 52000 + k * 7 + this.buses.indexOf(b) * 100);
      }
    }
  }
}
