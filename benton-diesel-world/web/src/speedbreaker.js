// Speed Breaker: a strata coaster - a hydraulic launch to 190 km/h, straight
// up a 128 m top hat that turns round at the crest, straight down, over a
// 50 m camelback and into the brakes - on the speed-trials ground north of
// Harbor Run (through a gate in Harbor Run's north wall). Benton Motor
// Works is out to break the land speed record with SB-1, a jet-powered
// record car, and the record run ends at the top of the Breaker tower.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { carriedFrames } from './cyclone.js';

export const RIDE_ID = 'SpeedBreaker';
const SITE = { x0: -796, x1: -598, z0: 114, z1: 250 };
const GATE = { x0: -611, x1: -601 }; // in Harbor Run's north wall (z 112)
const G = 0.1;
const CARS = 4, SPACING = 3.6;
const ZL = 160, ZD = 176; // the launch line and the drop line
const RED = 0xe0201a, CHECK = 0x101012, WHITE = 0xf4f4f0, SILVER = 0xc8ccd4, YELLOW = 0xffd21e, DARK = 0x18191c, STEEL = 0x8e949c;
const TRACK_COLOR = 0xe0201a;

const CIRCUIT = [
  [-652, 2, ZL, 2],
  // the hydraulic launch, west
  [-662, 2, ZL, 4], [-680, 2, ZL, 22], [-710, 2, ZL, 40], [-740, 2, ZL, 50], [-760, 2.2, ZL, 52],
  // straight up the Breaker tower
  [-768, 6, ZL, 51], [-773.5, 20, ZL, 48], [-776, 45, ZL, 43], [-777, 80, ZL, 35], [-777.6, 108, ZL, 26],
  // over the top, turning round
  [-778.6, 121, ZL + 1.5, 19], [-780.6, 127, ZL + 4.5, 16], [-781.6, 128.6, ZL + 8, 15], [-780.6, 127, ZL + 11.5, 16], [-778.6, 121, ZD - 1.5, 19],
  // straight down
  [-777.6, 108, ZD, 26], [-777, 80, ZD, 35], [-776, 45, ZD, 43], [-773.5, 20, ZD, 48], [-768, 6, ZD, 51], [-758, 2.5, ZD, 50],
  // the camelback
  [-746, 12, ZD, 47], [-731, 36, ZD, 41], [-716, 50, ZD, 38], [-701, 36, ZD, 41], [-686, 12, ZD, 47], [-674, 4, ZD, 48],
  // the brakes, and round to the station
  [-662, 3, ZD, 30], [-646, 3, ZD, 10], [-630, 3, ZD, 6], [-620, 2.8, ZD - 2, 5], [-616, 2.5, ZD - 8, 5], [-620, 2.2, ZL + 1.5, 4], [-630, 2, ZL, 3], [-642, 2, ZL, 2.5],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildSpeedBreaker(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: the speed-trials ground, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0xd8d0c0, 'Pavement');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, 112, -798, 252);
  wallSeg(-798, 252, -596, 252);
  wallSeg(-596, 252, -596, 112);
  // the gate in Harbor Run's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 112) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, 112, GATE.x1, 112);
  wallSeg(GATE.x0, 112, -798, 112);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.4, 15, 1.4], [x, G, 112], CHECK, 'Metal');
    for (let k = 0; k < 7; k++) add([1.5, 1, 1.5], [x, G + 1 + k * 2, 112], k % 2 ? WHITE : CHECK, 'SmoothPlastic', { collide: 0 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.4, 1.2], [gx, G + 14, 112], CHECK, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 112.7], CHECK, 'Back', [['SPEED BREAKER', 0, 0, 1, 1, RED]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 111.3], CHECK, 'Front', [['SPEED BREAKER', 0, 0, 1, 1, RED]], { glow: true });
  // the walk from Harbor Run's exit path to the gate
  for (const [a, b] of [[[-601, 100], [-604, 108]], [[-604, 108], [gx, 118]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.4, 0.2, len + 3.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  // a quarter twist on the way up (so you go over the crest the right way
  // up) and a quarter back on the way down
  carriedFrames(track, {
    free: [[sk(-760, ZL), sk(-758, ZD)]],
    twists: [{ s0: sk(-773.5, ZL), s1: sk(-777.6, ZL), angle: Math.PI / 2, h: 0 }, { s0: sk(-777.6, ZD), s1: sk(-773.5, ZD), angle: -Math.PI / 2, h: 0 }],
  });
  // the speeds: creep out, the hydraulic launch to 52 m/s, then whatever
  // height leaves you with, the magnetic brakes and the ease into the garage
  {
    const { cum, pos, times } = track, n = cum.length, Lt = cum[n - 1];
    const sL0 = sk(-662, ZL), sL1 = sk(-760, ZL), sB0 = sk(-662, ZD), sB1 = sk(-630, ZD), V = 52;
    const A = (V * V - 2.5 * 2.5) / (2 * (sL1 - sL0));
    const vAt = (i) => {
      const c = cum[i], y = pos[i * 3 + 1];
      let v;
      if (c < sL0) v = 2.5;
      else if (c < sL1) v = Math.sqrt(2.5 * 2.5 + 2 * A * (c - sL0));
      else if (c < sB0) v = Math.sqrt(Math.max(16, V * V * 0.985 - 2 * 9.8 * (y - 2.2)));
      else { const vB = Math.sqrt(Math.max(16, V * V * 0.985 - 2 * 9.8 * 1)); v = c < sB1 ? vB + (6 - vB) * ((c - sB0) / (sB1 - sB0)) : 5; }
      return Math.max(0.8, c > sB1 ? Math.min(v, Math.sqrt(4 * (Lt - c)) + 0.8) : v);
    };
    let vp = vAt(0);
    for (let i = 1; i < n; i++) { const v = vAt(i); times[i] = times[i - 1] + (cum[i] - cum[i - 1]) / ((v + vp) / 2); vp = v; }
  }
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3();
  const L = track.length;
  const samples = [];
  for (let s = 0; s < L; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  const grid = new Map();
  for (const f of samples) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  const clearOf = (size, pos, pad = 3.6) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.8) return false;
    }
    return true;
  };

  // ======== the Breaker tower: a huge lattice tower between the climb and
  // the drop, aircraft lights and a checkered crown
  const TW = { x: -781, z: (ZL + ZD) / 2, w: 6, top: 125 };
  for (const dx of [-TW.w / 2, TW.w / 2]) for (const dz of [-TW.w / 2, TW.w / 2]) box([0.9, TW.top - G, 0.9], [TW.x + dx, G, TW.z + dz], WHITE, 'Metal', { collide: 0 });
  for (let y = 6; y < TW.top; y += 6) {
    for (const dz of [-TW.w / 2, TW.w / 2]) add([TW.w, 0.35, 0.35], [TW.x, y, TW.z + dz], WHITE, 'Metal', { collide: 0 });
    for (const dx of [-TW.w / 2, TW.w / 2]) add([0.35, 0.35, TW.w], [TW.x + dx, y, TW.z], WHITE, 'Metal', { collide: 0 });
    for (const dz of [-TW.w / 2, TW.w / 2]) add([Math.hypot(TW.w, 6), 0.25, 0.25], [TW.x, y + 3, TW.z + dz], WHITE, 'Metal', { collide: 0, rot: RZ(((y / 6) % 2 ? 1 : -1) * Math.atan2(6, TW.w)) });
  }
  // arms out to the climb and the drop, every 12 m
  for (let y = 14; y < 118; y += 12) for (const z of [ZL, ZD]) {
    let best = null, bd = Infinity;
    for (const [x, yy, zz] of near(-777, z)) { const d = Math.abs(yy - y) + Math.abs(zz - z) * 4; if (d < bd) { bd = d; best = [x, yy, zz]; } }
    if (!best) continue;
    const sz = Math.abs(best[2] - TW.z) - TW.w / 2 - 1.2;
    if (sz > 0.5) add([1.6, 0.6, sz], [best[0] - 1.6, best[1], TW.z + Math.sign(best[2] - TW.z) * (TW.w / 2 + sz / 2)], WHITE, 'Metal', { collide: 0 });
  }
  for (let k = 0; k < 8; k++) add([TW.w + 0.4, 1.2, 0.3], [TW.x, TW.top - 5 - (k % 2) * 1.2, TW.z + (k < 4 ? -1 : 1) * (TW.w / 2 + 0.2)], k % 2 ? WHITE : CHECK, 'SmoothPlastic', { collide: 0 });
  for (const [dx, dz] of [[-TW.w / 2, -TW.w / 2], [TW.w / 2, TW.w / 2], [-TW.w / 2, TW.w / 2], [TW.w / 2, -TW.w / 2]]) for (const y of [40, 80, TW.top + 0.6]) neon([0.7, 0.7, 0.7], [TW.x + dx, y, TW.z + dz], RED, { shape: 3 });
  sign([0.3, 6, 16], [TW.x + TW.w / 2 + 0.6, 60, TW.z], CHECK, 'Right', [['SPEED', 0, 0, 1, 0.48, WHITE], ['BREAKER', 0, 0.52, 1, 0.48, RED]], { glow: true });

  // ======== the launch: a drag-racing start, flames and speed stripes
  for (let x = -664; x > -760; x -= 3) add([0.3, 0.1, 3.6], [x, G + 0.06, ZL], (Math.round(x / 3) % 2) ? RED : WHITE, 'Neon', { collide: 0 });
  // the "Christmas tree" start lights on a gantry over the launch
  box([0.5, 9, 0.5], [-668, G, ZL - 5], CHECK, 'Metal', { collide: 0 });
  add([0.5, 0.5, 6], [-668, G + 9, ZL - 2.2], CHECK, 'Metal', { collide: 0 });
  for (let k = 0; k < 5; k++) neon([0.6, 0.6, 0.6], [-668, G + 8.3 - k * 0.8, ZL - 4.4], [RED, YELLOW, YELLOW, YELLOW, 0x30ff60][k], { shape: 3 });
  // a speed trap with a giant readout
  for (const z of [ZL - 5, ZL + 5]) box([0.5, 10, 0.5], [-746, G, z], CHECK, 'Metal', { collide: 0 });
  add([0.5, 0.5, 10.5], [-746, G + 10, ZL], CHECK, 'Metal', { collide: 0 });
  sign([0.3, 3, 12], [-735, G + 6, ZL - 9], CHECK, 'Right', [['TRAP SPEED', 0, 0.04, 1, 0.3, WHITE, 'GothamBold'], ['190 KM/H', 0, 0.38, 1, 0.58, RED]], { glow: true });
  box([0.3, 4.6, 0.3], [-735, G, ZL - 9], CHECK, 'Metal', { collide: 0 });

  // ======== the garage: the station, a sleek glass-and-steel pit garage
  const ST = { x0: -664, x1: -626, z0: 146, z1: 166 };
  const PL = { x0: -662, x1: -628, z0: 149.6, z1: ZL - 2.6 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x3a3e46, 'DiamondPlate', { collide: 0 });
  add([PL.x1 - PL.x0, 0.1, 0.5], [(PL.x0 + PL.x1) / 2, G + 0.42, PL.z1 - 0.3], YELLOW, 'SmoothPlastic', { collide: 0 });
  for (let x = ST.x0; x <= ST.x1; x += 9.5) for (const z of [ST.z0, ST.z1]) box([0.5, 9, 0.5], [x, G, z], SILVER, 'Metal', { collide: 0 });
  add([ST.x1 - ST.x0 + 4, 0.5, ST.z1 - ST.z0 + 4], [(ST.x0 + ST.x1) / 2, G + 9.3, (ST.z0 + ST.z1) / 2], 0x2a2c30, 'Metal', { collide: 0 });
  add([ST.x1 - ST.x0 + 4, 0.6, 0.3], [(ST.x0 + ST.x1) / 2, G + 8.8, ST.z0 - 2], RED, 'Neon', { collide: 0 });
  sign([24, 2.6, 0.3], [(ST.x0 + ST.x1) / 2, G + 7.4, ST.z0 - 2.2], CHECK, 'Front', [['SPEED BREAKER', 0, 0, 1, 1, RED]], { glow: true });
  sign([16, 1.4, 0.3], [(ST.x0 + ST.x1) / 2, G + 5.4, ST.z0 - 2.2], WHITE, 'Front', [['BENTON MOTOR WORKS  ·  SB-1 RECORD ATTEMPT', 0, 0, 1, 1, CHECK, 'GothamBold']]);
  const con = [-630, 152];
  box([1.4, 1.2, 2.2], [con[0], G + 0.4, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });

  // ======== the line: switchbacks under checkered flags, the grandstand
  const QX = { w: -700, e: -632 }, rz = (k) => 122 + 6 * k, ROWS = 4;
  const railX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [xa + ((xb - xa) * k) / n, G, z], CHECK, 'Metal');
    add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1.1, z], RED, 'Metal', { collide: 0 });
  };
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [x, G, za + ((zb - za) * k) / n], CHECK, 'Metal');
    add([0.12, 0.12, zb - za], [x, G + 1.1, (za + zb) / 2], RED, 'Metal', { collide: 0 });
  };
  railX(QX.w - 3, QX.e - 3, rz(0) - 3);
  for (let k = 0; k < ROWS - 1; k++) {
    if (k % 2 === 0) railX(QX.w + 3, QX.e + 3, rz(k) + 3); // west turn
    else railX(QX.w - 3, QX.e - 3, rz(k) + 3);
  }
  railX(QX.w - 3, QX.e - 3, rz(ROWS - 1) + 3);
  railZ(rz(0) - 3, rz(ROWS - 1) + 3, QX.w - 3);
  // checkered flags on poles along the line
  for (let x = QX.w; x <= QX.e; x += 17) {
    box([0.2, 6, 0.2], [x, G, rz(0) - 3.5], STEEL, 'Metal', { collide: 0 });
    for (let k = 0; k < 4; k++) add([0.6, 0.6, 0.05], [x + 0.4 + (k % 2) * 0.6, G + 5.6 - Math.floor(k / 2) * 0.6, rz(0) - 3.5], k % 3 ? WHITE : CHECK, 'Fabric', { collide: 0 });
  }
  const fwd = [[-606, 118], [-620, 122], [QX.e, rz(0)]];
  for (let k = 0; k < ROWS; k++) {
    const west = k % 2 === 0;
    fwd.push([west ? QX.w : QX.e, rz(k)]);
    if (k < ROWS - 1) fwd.push([west ? QX.w : QX.e, rz(k + 1)]);
  }
  fwd.push([-626, rz(ROWS - 1)], [-626, 146], [-640, 151], [-645, 154]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the entrance: a checkered arch, the wait time
  for (const x of [-614, -600]) { box([1, 7, 1], [x, G, 118], CHECK, 'Metal'); for (let k = 0; k < 6; k++) add([1.1, 1, 1.1], [x, G + 0.6 + k * 1.1, 118], k % 2 ? WHITE : CHECK, 'SmoothPlastic', { collide: 0 }); }
  add([15, 1.2, 0.8], [-607, G + 7.2, 118], CHECK, 'Metal', { collide: 0 });
  sign([13, 1, 0.2], [-607, G + 7.2, 118.5], CHECK, 'Back', [['SPEED BREAKER  ·  STAND-BY', 0, 0, 1, 1, RED, 'GothamBold']]);
  const waitPart = add([5, 1.4, 0.4], [-599.5, G + 3.4, 121], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  box([0.4, 2.8, 0.4], [-599.5, G, 121], CHECK, 'Metal', { collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 271, cf: cf(-610, G, 121, 0) });
  // a grandstand facing the launch, west of the line
  for (let k = 0; k < 5; k++) box([40, 0.8 + k * 0.9, 2], [-745, G, 128 + k * 2], [0x8a8e96, 0x9a9ea6][k % 2], 'Concrete', { collide: 0 });
  sign([30, 3, 0.3], [-745, G + 9, 137.4], CHECK, 'Back', [['SB-1  ·  LAND SPEED RECORD ATTEMPT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  for (const x of [-762, -728]) box([0.5, 10.5, 0.5], [x, G, 137.6], STEEL, 'Metal', { collide: 0 });
  // the exit: off the platform's east end, round to the gate
  for (const [a, b] of [[[-627, 152], [-614, 150]], [[-614, 150], [-600, 140]], [[-600, 140], [-600, 120]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.6, 0.2, len + 2.6], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([3, 0.9, 0.2], [-612, G + 3.2, 148.4], 0x1a8a3a, 'Front', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  box([0.25, 2.8, 0.25], [-613.6, G, 148.4], CHECK, 'Metal', { collide: 0 });

  // ======== supports: red columns where the track is near level
  let supports = 0;
  const keep = [ST, { x0: -620, x1: -596, z0: 112, z1: 152 }, { x0: TW.x - TW.w, x1: TW.x + TW.w, z0: TW.z - TW.w, z1: TW.z + TW.w }];
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (keep.some((r) => inRect(foot.x, foot.z, r, 1))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([1.1, foot.y - G, 1.1], [foot.x, (foot.y + G) / 2, foot.z], WHITE, 'Metal', { shape: 5, collide: 0 });
    add([2, 0.6, 2], [foot.x, G + 0.3, foot.z], 0x9a9a94, 'Concrete', { collide: 0 });
    supports++;
  }

  // ======== the train: SB-1, a silver jet car with red stripes
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.4], [0, 0.65, 0], SILVER, 'Metal'),
    pp(0, [3.3, 0.2, 3.5], [0, 1.1, 0], RED, 'SmoothPlastic'),
    pp(0, [3.4, 0.15, 3.2], [0, 0.2, 0], RED, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x1a1a1c, 'Fabric'),
      pp(0, [1.1, 1.3, 0.25], [x, 1.9, z + 0.5], SILVER, 'Metal'),
    ])),
    ...(k === 0 ? [pp(1, [3, 1.1, 2.4], [0, 0.85, -2.8], SILVER, 'Metal', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(0, [0.3, 0.3, 2.4], [0, 1.2, -2.8], RED, 'SmoothPlastic')] : []),
    ...(k === CARS - 1 ? [pp(2, [1.4, 1.2, 1.2], [0, 0.9, 2.3], 0x3a3c40, 'Metal', [0, 0, 1, 0, 1, 0, -1, 0, 0]), pp(3, [1, 1, 0.3], [0, 0.9, 3], 0xff8a20, 'Neon')] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, G, PL.z1 - 0.8, 0));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0] - 1, G, con[1], -Math.PI / 2), operator: cf(con[0] - 1.6, G, con[1] + 1.4, -Math.PI / 2),
    homes: [cf(-660, G, 152, 0), cf(-636, G, 152, 0)],
    exit: cf(-628, G, 153, -Math.PI / 2),
  };

  // ======== the ride
  const origin = [-700, 0, 170];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    noExtended: true,
  };
  data.rides.push(ride);
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  // the jet fires as the launch begins; sparks at the crest; fire at the bottom
  const cues = [[at(-664, ZL), 'explosion', [0, 0, 8]], [at(-680, ZL), 'fire', [0, 0, 10]], [at(-758, ZD), 'sparks', [0, 2, 3]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Speed Breaker', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'A strata coaster on the speed-trials ground north of Harbor Run. Benton Motor Works is out to break the land speed record in SB-1, a jet-powered record car: a hydraulic launch to 190 km/h through the speed trap, straight up the 128 m Breaker tower, round over the top, straight down, over a 50 m camelback and into the brakes.',
    baseWait: 65, origin, entrance: [-606, 0, 118], exit: [-608, 0, 122], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, SILVER, CHECK], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Speed Breaker is open - 190 km/h and 128 metres up!'];
  return { ride, gate: { x: gx, z: 112 }, supports };
}

// a toast the first time you come near
export class SpeedBreakerSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: Speed Breaker, a strata coaster - 190 km/h and 128 m up! Through the gate in Harbor Run\'s north wall.', 'reward');
    }
  }
}
