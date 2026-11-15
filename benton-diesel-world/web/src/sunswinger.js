// Summer at Benton Diesel World: the summer parades join the show schedule,
// and a new flat ride, Sun Swinger - a wave swinger: 24 swings on chains
// from a canopy crowned with a giant smiling sun, which spins up, rises up
// the tower and tilts like a wave - on the speed-trials ground north of
// Speed Breaker's camelback.
import * as THREE from 'three';
import { queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';

export const RIDE_ID = 'SunSwinger';
const C = [-700, 222]; // the tower
const G = 0.1;
const CHAIRS = 24, R = 9, CHAIN = 6, LOW = 7, HIGH = 15;
const SUN = 0xffc020, ORANGE = 0xff7a1a, SKY = 0x40b8f0, WHITE = 0xf4f4f0, DARK = 0x1a1c20, STEEL = 0x8e949c;

export function buildSummer(data) {
  // ======== the summer parades: the Summer Splash Parade at 10 AM and 3 PM
  // (by day), the Summer Lights Parade at 7:30 PM (dusk); the Big Rig Parade
  // keeps its midday run
  const shows = data.config.Shows;
  const rig = shows.find((s) => s.id === 'BigRigParade');
  if (rig) rig.times = [750];
  shows.push(
    { id: 'SummerSplash', name: 'Summer Splash Parade', venue: 'Main Street & the Hub', land: 'Plaza', times: [600, 900], duration: 140, viewRadius: 130, viewing: [0, 0, 80], center: [0, 0, 80],
      description: 'Beach party, ice cream, surf and sun floats roll down Main Street - and you WILL get splashed.' },
    { id: 'SummerLights', name: 'Summer Lights Parade', venue: 'Main Street & the Hub', land: 'Plaza', times: [1170], duration: 100, viewRadius: 130, viewing: [0, 0, 80], center: [0, 0, 80],
      description: 'The summer floats lit up in neon at dusk, with confetti cannons all the way down Main Street.' },
  );

  // ======== Sun Swinger
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const [cx, cz] = C;
  // the round deck, a fence round it, the tower
  add([38, 0.4, 38], [cx, G + 0.2, cz], 0x6aa8d8, 'Pavement', { shape: 5, collide: 0 });
  add([30, 0.06, 30], [cx, G + 0.42, cz], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 });
  add([26, 0.08, 26], [cx, G + 0.46, cz], 0x6aa8d8, 'SmoothPlastic', { shape: 5, collide: 0 });
  const gap = (a) => Math.min(Math.abs(a), Math.abs(a - Math.PI * 2)) < 0.25; // the gate, east toward the line
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2, b = ((k + 0.5) / 36) * Math.PI * 2;
    if (!gap(a)) box([0.2, 1.2, 0.2], [cx + Math.cos(a) * 19, G, cz + Math.sin(a) * 19], STEEL, 'Metal');
    if (!gap(b)) add([3.4, 0.12, 0.12], [cx + Math.cos(b) * 19, G + 1.1, cz + Math.sin(b) * 19], SUN, 'Metal', { collide: 0, yaw: -Math.PI / 2 - b });
  }
  box([2.4, HIGH + 4, 2.4], [cx, G, cz], WHITE, 'Metal', { shape: 5 });
  for (let k = 0; k < 6; k++) neon([2.6, 0.4, 2.6], [cx, G + 3 + k * 3.2, cz], [SUN, ORANGE, SKY][k % 3], { shape: 5 });
  add([3.4, 1.6, 3.4], [cx, G + HIGH + 4.8, cz], SUN, 'SmoothPlastic', { shape: 3, collide: 0 });
  // the canopy (it spins, rises and tilts): a disc, a skirt of scallops,
  // lights, the sun on top
  const canopy = [pp(5, [22, 0.8, 22], [0, 0, 0], SKY, 'SmoothPlastic'), pp(5, [22.4, 0.3, 22.4], [0, -0.5, 0], WHITE, 'SmoothPlastic'), pp(5, [3.4, 3, 3.4], [0, 0.6, 0], DARK, 'Metal')];
  const RYm = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    canopy.push(pp(0, [2.8, 1.2, 0.2], [Math.cos(a) * 11, -1.0, Math.sin(a) * 11], k % 2 ? SUN : ORANGE, 'SmoothPlastic', RYm(-Math.PI / 2 - a)));
    canopy.push(pp(3, [0.5, 0.5, 0.5], [Math.cos(a + 0.13) * 10.8, -0.4, Math.sin(a + 0.13) * 10.8], 0xfff4c0, 'Neon'));
  }
  canopy.push(pp(3, [7, 7, 7], [0, 4.4, 0], SUN, 'SmoothPlastic'));
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    canopy.push(pp(0, [2.4, 0.6, 0.6], [Math.cos(a) * 4.8, 4.4, Math.sin(a) * 4.8], ORANGE, 'Neon', RYm(-a)));
  }
  for (const sx of [-1.2, 1.2]) canopy.push(pp(3, [0.8, 0.8, 0.6], [sx, 5.2, -3.2], DARK, 'SmoothPlastic'));
  canopy.push(pp(0, [2.6, 0.5, 0.5], [0, 3.4, -3.3], 0xd83a1a, 'SmoothPlastic'));
  // the chairs: a seat on two chains, a footrest, a lap bar
  const chair = (k) => [
    pp(0, [1.2, 0.3, 1.1], [0, 0.4, 0], [SUN, ORANGE, SKY, WHITE][k % 4], 'SmoothPlastic'),
    pp(0, [1.2, 1.1, 0.2], [0, 0.95, 0.5], [SUN, ORANGE, SKY, WHITE][k % 4], 'SmoothPlastic'),
    pp(0, [0.9, 0.12, 0.5], [0, -0.4, -0.5], STEEL, 'Metal'),
    pp(0, [0.06, CHAIN, 0.06], [-0.55, CHAIN / 2 + 0.5, 0], STEEL, 'Metal'),
    pp(0, [0.06, CHAIN, 0.06], [0.55, CHAIN / 2 + 0.5, 0], STEEL, 'Metal'),
  ];
  const origin = [cx, 0, cz];
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CHAIRS; k++) {
    const a = (k / CHAIRS) * Math.PI * 2;
    // RY(a): +x goes to (cos a, 0, -sin a)
    const x = cx + Math.cos(a) * R, z = cz - Math.sin(a) * R;
    const c = Math.cos(a), s = Math.sin(a);
    cars.push({ pivot: [x, LOW - CHAIN, z, c, 0, s, 0, 1, 0, -s, 0, c], parts: chair(k) });
    seats.push([[0, 0.55 + 1.3, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]]);
    stops.push(cf(cx + Math.cos(a) * (R + 1.6), G, cz - Math.sin(a) * (R + 1.6), Math.atan2(Math.cos(a), -Math.sin(a))));
    stopCars.push(k + 1);
  }
  const extras = { Canopy: { pivot: [cx, LOW, cz, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: canopy } };
  // the line: a small switchback pen east of the ride, under sun sails
  const railX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.2, 1.2, 0.2], [xa + ((xb - xa) * k) / n, G, z], STEEL, 'Metal');
    add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1.1, z], SUN, 'Metal', { collide: 0 });
  };
  const QX = { w: -676, e: -652 }, rz = (k) => 212 + 5 * k;
  railX(QX.w, QX.e + 3, rz(0) - 2.5);
  railX(QX.w + 3, QX.e + 3, rz(0) + 2.5);
  railX(QX.w - 3, QX.e - 3, rz(1) + 2.5);
  railX(QX.w + 3, QX.e + 3, rz(2) + 2.5);
  railX(QX.w - 3, QX.e + 3, rz(3) + 2.5);
  for (const [x, z] of [[-670, 219], [-658, 219]]) {
    box([0.25, 5, 0.25], [x, G, z], STEEL, 'Metal', { collide: 0 });
    add([9, 0.12, 9], [x, G + 5.1, z], [SUN, SKY][Math.round(x) % 2 ? 0 : 1], 'Fabric', { collide: 0, rot: RZ(0.08) });
  }
  const fwd = [[-646, 210], [QX.e, rz(0)], [QX.w, rz(0)], [QX.w, rz(1)], [QX.e, rz(1)], [QX.e, rz(2)], [QX.w, rz(2)], [QX.w, rz(3)], [-680, rz(3)], [-683, 222]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the entrance: a sign with the sun, the wait time; the walk from the
  // speed-trials ground's east walk
  box([0.4, 6, 0.4], [-645, G, 206], STEEL, 'Metal', { collide: 0 });
  sign([7, 1.6, 0.2], [-645, G + 5.4, 206.2], SKY, 'Back', [['SUN SWINGER', 0, 0, 1, 1, SUN]], { glow: true });
  const waitPart = add([4, 1.2, 0.3], [-645, G + 3.6, 206.2], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  for (const [a, b] of [[[-602, 206], [-646, 206]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.4, 0.2, len + 3.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  const con = [-684, 230];
  box([1.2, 1.2, 1.6], [con[0], G + 0.4, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] - 0.4 + k * 0.4], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 311, cf: cf(-648, G, 209, Math.PI / 2) });
  for (const [x, z] of [[-640, 214], [-700, 246]]) {
    box([0.4, 8, 0.4], [x, G, z], STEEL, 'Metal');
    add([1.2, 1.4, 1.2], [x, G + 8.4, z], 0xfff2d0, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 8.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  const ride = {
    id: RIDE_ID, kind: 'swinger', duration: 60, origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CHAIRS, carSpacing: 0,
    cars, seats, capacity: CHAIRS, queue: qpath, trackStyle: null, extras, extrasNames: ['Canopy'],
    swing: { radius: R, chain: CHAIN, low: LOW, high: HIGH },
    crew: {
      stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [stopCars.slice(0, 12), stopCars.slice(12)],
      console: cf(con[0], G, con[1], Math.PI / 2), operator: cf(con[0] + 1.2, G, con[1], Math.PI / 2),
      homes: [cf(-682, G, 216, Math.PI / 2), cf(-682, G, 228, Math.PI / 2)], exit: cf(-681, G, 214, -Math.PI / 2),
    },
    noExtended: true,
  };
  data.rides.push(ride);
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Sun Swinger', land: 'Backwoods', category: 'Family', thrill: 3, kind: 'swinger',
    description: "NEW for summer: a wave swinger on the speed-trials ground. 24 swings hang from a canopy crowned with a giant smiling sun - it spins up, rises up the tower and tilts like a wave, and you fly out over the deck.",
    baseWait: 25, origin, entrance: [-646, 0, 210], exit: [-644, 0, 214], yaw: 0, layout: RIDE_ID,
    cars: CHAIRS, carSpacing: 0, colors: [SUN, ORANGE, SKY], duration: 60,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Happy summer! Catch the Summer Splash Parade on Main Street!', 'Sun Swinger is new this summer - fly with the sun!'];
  return { ride, gate: { x: -646, z: 210 } };
}

// a toast the first time you come near Sun Swinger
export class SunSwingerSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    if (Math.hypot(pos.x - C[0], pos.z - C[1]) < 60) {
      this.told = true;
      this.hooks.toast('NEW for summer: Sun Swinger, a wave swinger - fly round under the giant sun!', 'reward');
    }
  }
}
