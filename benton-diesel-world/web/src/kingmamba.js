// King Mamba: an outdoor inverted roller coaster north of RV Van Run,
// through a gate in RV Van Run's north wall. You walk in through the open
// jaws of a giant stone king mamba, wind through a jungle temple's ruins
// and board in the temple, where the trains hang below the track, feet
// dangling. Up a 47-stud lift, a twisting first drop, a zero-g roll, a
// corkscrew down the far side, a roll over the temple pool, then low
// through the ruins and home.
//
// The track is built like any coaster and then turned over: its "up"
// points down, so the rails' spine runs on top and the cars hang beneath.
// Rolls turn round the riders' heartline, below the rails. The supports
// are C-shaped (a column beside the train and an arm over the top), or
// straight up from the ground where the track is upside down, and each is
// placed only where no train ever passes.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'KingMamba';
const SITE = { x0: 820, x1: 1250, z0: 502, z1: 740 };
const RVGATE = { x0: 1006, x1: 1022 }; // in RV Van Run's north wall (z 500)
const G = 0.1;
const CARS = 8, SPACING = 3.2;
const GREEN = 0x2a7a2a, BLACK = 0x101210, YELLOW = 0xf2d020, STONE = 0x8a8678, MOSS = 0x5a7a3a, GOLD = 0xd8a830, WHITE = 0xf4f4f0;
const TRACK_COLOR = 0x2a8a3a;

const CIRCUIT = [
  [1100, 6, 540, 2], [1114, 6, 540, 5], [1127, 6.8, 546, 6], [1135, 8.4, 558, 5],
  // the lift
  [1138, 12, 572, 4], [1140, 24, 596, 4], [1140, 36, 620, 4], [1140, 45, 640, 4],
  [1138, 47, 652, 6], [1132, 46.5, 662, 8],
  // the first drop, twisting to the west
  [1120, 40, 672, 14], [1100, 26, 680, 22], [1080, 12, 684, 28], [1060, 9, 686, 30],
  // the zero-g roll
  [1040, 13, 688, 27], [1020, 17, 689, 24], [1000, 13, 690, 27],
  [980, 10, 690, 29], [950, 11, 688, 28],
  // round the west end and the corkscrew south
  [915, 13, 682, 26], [884, 15, 666, 24], [866, 16, 640, 23],
  [862, 18, 620, 21], [861, 18, 600, 21], [858, 15, 582, 23],
  // east, and the roll over the temple pool
  [866, 12, 562, 25], [886, 11, 552, 25], [910, 12, 550, 24],
  [930, 15, 551, 22], [950, 17, 552, 21], [970, 15, 553, 22],
  [990, 12, 556, 24],
  // low through the ruins and home
  [1004, 12, 570, 23], [1008, 13, 598, 21], [1010, 14, 620, 20],
  [1022, 14, 634, 19], [1048, 13, 638, 19], [1076, 12, 636, 18], [1094, 12, 626, 17],
  [1100, 11, 606, 16], [1098, 10, 588, 15],
  [1086, 9.5, 572, 14], [1062, 9, 566, 12], [1044, 8.5, 564, 10],
  [1030, 8, 558, 8], [1028, 7.2, 546, 6], [1040, 6.4, 540, 4], [1060, 6, 540, 3], [1080, 6, 540, 2],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildKingMamba(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  W.add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x4a7a34, 'Grass');
  // a gate in RV Van Run's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 500) < 0.6 && Math.abs(p[4] - 1127) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    W.add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(1004, 500, RVGATE.x0, 500);
  wallSeg(RVGATE.x1, 500, 1250, 500);
  wallSeg(SITE.x0, 500, SITE.x0, SITE.z1);
  wallSeg(SITE.x0, SITE.z1, SITE.x1, SITE.z1);
  wallSeg(SITE.x1, 500, SITE.x1, SITE.z1);
  const gx = (RVGATE.x0 + RVGATE.x1) / 2;
  for (const x of [RVGATE.x0 + 0.8, RVGATE.x1 - 0.8]) box([1.6, 16, 1.6], [x, G, 500], STONE, 'Slate');
  add([RVGATE.x1 - RVGATE.x0 + 1, 2.4, 1.6], [gx, G + 16.6, 500], STONE, 'Slate', { collide: 0 });
  sign([RVGATE.x1 - RVGATE.x0 - 1, 2, 0.2], [gx, G + 16.6, 500.9], 0x1a2a14, 'Back', [['KING MAMBA', 0, 0, 1, 1, YELLOW]], { glow: true });
  sign([RVGATE.x1 - RVGATE.x0 - 1, 2, 0.2], [gx, G + 16.6, 499.1], 0x1a2a14, 'Front', [['KING MAMBA  ·  THIS WAY', 0, 0, 1, 1, YELLOW]], { glow: true });
  // the walk: on from RV Van Run's path, north through the gate
  const route = [[1014, 355], [1014, 500], [1014, 506], [1030, 506]];
  for (let i = 0; i < route.length - 1; i++) {
    const [xa, za] = route[i], [xb, zb] = route[i + 1];
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    W.add([8, 0.4, len + 8], [(xa + xb) / 2, 0.22, (za + zb) / 2], 0x9a8a6a, 'Pavement', { yaw, collide: 0 });
    LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
  }

  // ======== the track, turned over
  const ROLL_H = -2.6; // the heartline, below the rails
  const track = makeTrack(CIRCUIT, {
    rolls: [
      { from: knot(1040, 688), to: knot(980, 690), h: ROLL_H },
      { from: knot(866, 640), to: knot(858, 582), h: ROLL_H, dir: -1 },
      { from: knot(910, 550), to: knot(990, 556), h: ROLL_H },
    ],
  });
  track.up = track.up.map((v) => -v);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), Uf = new THREE.Vector3(), R = new THREE.Vector3();
  // the hanging trains' envelope, sampled along the whole track: in each
  // frame (whose up points down, to the cars), anything within 3.7 to the
  // side and from just above the rails to 6.4 below is in their way
  const frames = [];
  for (let s = 0; s < track.length; s += 0.5) {
    sampler.matrixAt(s, m4);
    const e = m4.elements;
    frames.push([e[12], e[13], e[14], e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], s]);
  }
  const grid = new Map();
  for (const f of frames) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  const clearPt = (x, y, z, skipS = null) => {
    for (const f of near(x, z)) {
      if (skipS !== null && Math.abs(f[12] - skipS) < 2.5) continue;
      const dx = x - f[0], dy = y - f[1], dz = z - f[2];
      if (Math.abs(dx) > 9 || Math.abs(dz) > 9 || Math.abs(dy) > 12) continue;
      const lz = f[9] * dx + f[10] * dy + f[11] * dz;
      if (Math.abs(lz) > 0.3) continue;
      const lx = f[3] * dx + f[4] * dy + f[5] * dz, ly = f[6] * dx + f[7] * dy + f[8] * dz;
      if (Math.abs(lx) < 3.7 && ly > -0.4 && ly < 6.4) return false;
    }
    return true;
  };
  const clearSeg = (a, b, skipS = null) => {
    const n = Math.ceil(a.distanceTo(b) / 0.5);
    for (let k = 0; k <= n; k++) { const q = a.clone().lerp(b, k / n); if (!clearPt(q.x, q.y, q.z, skipS)) return false; }
    return true;
  };
  const clearBox = (size, pos) => {
    for (let x = -size[0] / 2; x <= size[0] / 2 + 0.01; x += Math.max(0.5, size[0] / 6)) for (let y = -size[1] / 2; y <= size[1] / 2 + 0.01; y += Math.max(0.5, size[1] / 6)) for (let z = -size[2] / 2; z <= size[2] / 2 + 0.01; z += Math.max(0.5, size[2] / 6)) {
      if (!clearPt(pos[0] + x, pos[1] + y, pos[2] + z)) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearBox(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const strut = (a, b, w, color) => {
    const d = b.clone().sub(a), len = d.length();
    const yaw = Math.atan2(d.x, d.z), pitch = Math.asin(THREE.MathUtils.clamp(d.y / len, -1, 1));
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    add([w, w, len], [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], color, 'Metal', { collide: 0, rot: [c, -s * sp, s * cp, 0, cp, sp, -s, -c * sp, c * cp] });
  };
  // the supports
  const SUP = 0x1a1c1a;
  let supports = 0;
  for (let s = 30; s < track.length - 40; s += 10) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    Uf.setFromMatrixColumn(m4, 1); // points to the cars
    R.setFromMatrixColumn(m4, 0);
    const spine = P.clone().addScaledVector(Uf, -1.5); // the spine, away from the cars
    if (spine.y < 3) continue;
    const ground = new THREE.Vector3(spine.x, G, spine.z);
    if (Uf.y > 0.3 && clearSeg(spine, ground, s)) { strut(ground, spine, 1.3, SUP); supports++; continue; }
    // a C: a column off to one side, an arm over the top of the spine
    let done = false;
    for (const side of [1, -1]) {
      const h = new THREE.Vector3(R.x, 0, R.z).normalize().multiplyScalar(side * 6);
      const top = new THREE.Vector3(spine.x, Math.max(spine.y, P.y) + 1.6, spine.z);
      const colTop = top.clone().add(h), colFoot = new THREE.Vector3(colTop.x, G, colTop.z);
      if (clearSeg(colFoot, colTop) && clearSeg(colTop, top) && clearSeg(top, spine, s)) {
        strut(colFoot, colTop, 1.3, SUP); strut(colTop, top, 1, SUP); strut(top, spine, 0.9, SUP);
        supports++; done = true; break;
      }
    }
    if (done) continue;
  }

  // ======== the entrance: through the jaws of a giant stone mamba
  const ex = 1030, ez = 506;
  const head = [1046, 0, 516];
  // the head, mouth open over the path, fangs, gold eyes, a flared hood
  add([16, 0.3, 14], [head[0], G + 0.15, head[2]], 0x7a5a5a, 'Slate', { collide: 0 }); // the lower jaw, walked over
  add([16, 3, 14], [head[0], G + 12, head[2]], STONE, 'Slate', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.25), -Math.sin(-0.25), 0, Math.sin(-0.25), Math.cos(-0.25)] });
  for (const sx of [-1, 1]) {
    box([1.4, 12, 12], [head[0] + sx * 7.3, G, head[2]], STONE, 'Slate');
    add([0.8, 3.2, 0.8], [head[0] + sx * 4, G + 9.4, head[2] - 6], WHITE, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.15), -Math.sin(0.15), 0, Math.sin(0.15), Math.cos(0.15)] });
    neon([2.4, 1.6, 1], [head[0] + sx * 5, G + 15.4, head[2] - 4.6], YELLOW);
    add([3, 14, 1.2], [head[0] + sx * 10, G + 13, head[2] + 4], MOSS, 'Slate', { collide: 0, rot: [Math.cos(sx * 0.4), -Math.sin(sx * 0.4), 0, Math.sin(sx * 0.4), Math.cos(sx * 0.4), 0, 0, 0, 1] });
  }
  add([3, 0.4, 5], [head[0], G + 3.2, head[2] - 8], 0xc8322d, 'SmoothPlastic', { collide: 0 }); // the forked tongue
  sign([20, 3, 0.4], [head[0], G + 20.4, head[2] - 4], 0x1a2a14, 'Front', [['KING MAMBA', 0, 0, 1, 0.66, YELLOW], ['THE INVERTED COASTER', 0, 0.66, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  light(head[0], 8, head[2] - 4, 0x9aff6a);
  // its body coils away behind it, to the west
  for (let k = 0; k < 26; k++) {
    const t = k / 25, x = head[0] - 9 - t * 36, z = head[2] + 6 + Math.sin(t * Math.PI * 3) * 4, r = 3.2 - t * 1.8;
    S([r * 2, r * 2, r * 2], [x, G + r * 0.8, z], k % 3 ? GREEN : BLACK, 'Slate', { shape: 3, collide: 0 });
  }
  // the wait time, the greeter
  box([0.6, 6, 0.6], [ex + 6, G, 503], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [ex + 6, G + 9, 503], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 81, cf: cf(ex + 2, G, 509, 0) });

  // ======== the queue: switchbacks through the ruins, then the temple
  const ROWZ = [526, 520, 514];
  const XL = 1064, XR = 1116;
  const fwd = [[1014, 506], [ex, 506], [head[0], 506], [head[0], ROWZ[0]], [XR, ROWZ[0]], [XR, ROWZ[1]], [XL, ROWZ[1]], [XL, ROWZ[2]], [1120, ROWZ[2]], [1120, 535.6], [1100, 535.6]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [-1, 0], G);
  const railX = (xa, xb, z) => {
    add([xb - xa, 0.3, 0.3], [(xa + xb) / 2, G + 2.8, z], 0x6a4a2a, 'Wood', { collide: 0 });
    const n = Math.max(1, Math.round((xb - xa) / 5));
    for (let k = 0; k <= n; k++) box([0.6, 3, 0.6], [xa + ((xb - xa) * k) / n, G, z], STONE, 'Slate');
  };
  railX(XL - 2, XR - 4, (ROWZ[0] + ROWZ[1]) / 2);
  railX(XL + 4, XR + 2, (ROWZ[1] + ROWZ[2]) / 2);
  // torches along the line
  for (const x of [XL + 2, XL + 22, XL + 42, XR + 8]) {
    box([0.5, 4, 0.5], [x, G, 509], 0x4a3a2a, 'Wood', { collide: 0 });
    data.tags.Campfire.push([x, G + 4.4, 509, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    light(x, 5, 509, 0xffa040);
  }

  // ======== the station: a jungle temple over the platform
  const st = { x0: 1062, x1: 1124, z0: 533, z1: 548 };
  add([st.x1 - st.x0, 0.3, st.z1 - st.z0], [(st.x0 + st.x1) / 2, G + 0.15, (st.z0 + st.z1) / 2], 0x9a9488, 'Slate', { collide: 0 });
  for (let x = st.x0; x <= st.x1; x += 10.3) for (const z of [st.z0 - 0.5, st.z1 + 0.5]) {
    if (z < 540 && x > 1090 && x < 1110) continue; // the way onto the platform
    box([1.6, 14, 1.6], [x, G, z], STONE, 'Slate', { shape: 5 });
  }
  add([st.x1 - st.x0 + 4, 1.4, st.z1 - st.z0 + 4], [(st.x0 + st.x1) / 2, G + 14.7, (st.z0 + st.z1) / 2], STONE, 'Slate', { collide: 0 });
  add([st.x1 - st.x0 - 6, 1.4, st.z1 - st.z0 - 4], [(st.x0 + st.x1) / 2, G + 16.1, (st.z0 + st.z1) / 2], MOSS, 'Slate', { collide: 0 });
  add([st.x1 - st.x0 - 18, 1.4, st.z1 - st.z0 - 8], [(st.x0 + st.x1) / 2, G + 17.5, (st.z0 + st.z1) / 2], STONE, 'Slate', { collide: 0 });
  sign([28, 2.6, 0.3], [1093, G + 12.4, st.z0 - 1.4], 0x1a2a14, 'Front', [['TEMPLE OF THE KING', 0, 0, 1, 1, GOLD]], { glow: true });
  add([st.x1 - st.x0, 0.12, 0.5], [(st.x0 + st.x1) / 2, G + 0.32, 535.8], YELLOW, 'SmoothPlastic', { collide: 0 });
  const con = [1068, 535];
  box([1.4, 3, 2.4], [con[0], G, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  for (const x of [st.x0 + 4, st.x1 - 4]) light(x, 10, 540, 0xffb060);

  // ======== scenery: ruins, snake statues, a temple pool, jungle
  const ruin = (x, z, h, w = 3) => {
    SB([w, h, w], [x, G, z], STONE, 'Slate', { collide: 0 });
    S([w + 0.8, 0.8, w + 0.8], [x, G + h + 0.4, z], MOSS, 'Slate', { collide: 0 });
  };
  for (const [x, z, h] of [[960, 610, 9], [968, 622, 6], [925, 610, 12], [900, 630, 8], [1040, 600, 10], [1060, 610, 7], [1180, 600, 11], [1200, 640, 8], [1170, 680, 14], [930, 720, 9], [1060, 720, 12], [1200, 720, 10]]) ruin(x, z, h);
  // a giant snake statue coiled round a pillar by the lift
  SB([4, 22, 4], [1170, G, 620], STONE, 'Slate', { collide: 0 });
  for (let k = 0; k < 40; k++) {
    const a = k * 0.5, y = 2 + k * 0.5;
    S([2.4, 2.4, 2.4], [1170 + Math.cos(a) * 3, G + y, 620 + Math.sin(a) * 3], k % 4 ? GREEN : YELLOW, 'Slate', { shape: 3, collide: 0 });
  }
  S([4, 3, 6], [1170, G + 24.5, 617], GREEN, 'Slate', { collide: 0 });
  for (const sx of [-1, 1]) S([0.8, 0.8, 0.4], [1170 + sx * 1.2, G + 25.4, 613.9], YELLOW, 'Neon', { collide: 0 });
  // the temple pool under the last roll, with mist
  S([90, 0.3, 30], [940, G + 0.2, 552], 0x2a6a6a, 'Glass', { collide: 0, trans: 0.2 });
  for (let x = 900; x <= 980; x += 20) data.tags.SteamVent.push([x, G + 0.4, 552, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // jungle: trees all round the edges, clear of the trains
  let trees = 0;
  for (let k = 0; k < 140 && trees < 60; k++) {
    const x = SITE.x0 + 8 + ((k * 37) % 100) / 100 * (SITE.x1 - SITE.x0 - 16), z = SITE.z0 + 12 + ((k * 61) % 100) / 100 * (SITE.z1 - SITE.z0 - 20);
    if (z < 552 && x > 1000) continue; // the entrance, queue and station
    if (!clearPt(x, 6, z) || !clearPt(x, 12, z) || !clearPt(x, 2, z)) continue;
    if (near(x, z).some((f) => Math.hypot(f[0] - x, f[2] - z) < 9)) continue;
    data.trees.push({ leaf: 0x2a6a2a, kind: 'pine', s: 1 + ((k * 7) % 6) / 10, pos: [x, 0, z] });
    trees++;
  }
  // lamps and lights round the ride
  for (const [x, z] of [[1020, 520], [1010, 560], [1130, 520], [1180, 540], [960, 530], [880, 600], [900, 700], [1000, 720], [1100, 720], [1230, 600]]) {
    if (!clearPt(x, 6, z) || !clearPt(x, 11, z)) continue;
    box([0.5, 11, 0.5], [x, G, z], 0x1a1c1a, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 11.4, z], 0xd8ff9a, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 11.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (let s = 20; s < track.length - 20; s += 30) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); light(P.x, Math.max(4, P.y - 6), P.z, 0x9aff6a); }

  // ======== the trains: floorless seats hanging under the track
  // (in the car's frame +y points down, away from the rails)
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const UPRIGHT = [-1, 0, 0, 0, -1, 0, 0, 0, 1]; // a half turn about z: riders' heads toward the rails
  const carParts = (k) => [
    pp(0, [3.4, 0.7, 2.6], [0, 0.4, 0], 0x2a2c30, 'Metal'),
    pp(0, [0.5, 1.2, 0.5], [0, 1.3, 0.3], 0x2a2c30, 'Metal'),
    pp(0, [5.4, 0.5, 0.8], [0, 2.0, 0.6], k === 0 ? YELLOW : GREEN, 'SmoothPlastic'),
    ...(k === 0 ? [pp(0, [5.6, 1.4, 0.3], [0, 1.6, -1.3], GREEN, 'SmoothPlastic'), pp(3, [0.7, 0.7, 0.3], [-1.4, 1.5, -1.5], YELLOW, 'Neon'), pp(3, [0.7, 0.7, 0.3], [1.4, 1.5, -1.5], YELLOW, 'Neon')] : []),
    ...[-2.1, -0.7, 0.7, 2.1].flatMap((x) => [
      pp(0, [1.1, 2.2, 0.35], [x, 2.6, 0.75], BLACK, 'Fabric'),
      pp(0, [1.1, 0.35, 1.0], [x, 3.75, 0.2], BLACK, 'Fabric'),
      pp(0, [0.3, 0.3, 0.6], [x, 1.7, 0.4], k % 2 ? YELLOW : GREEN, 'SmoothPlastic'),
    ]),
  ];
  const seatList = () => [-2.1, -0.7, 0.7, 2.1].map((x) => [x, 3.55 - 1.3, 0.15, ...UPRIGHT]);
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }

  // ======== the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, G, 536.2, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2, 3, 4], [5, 6, 7, 8]],
    console: cf(con[0], G, con[1], Math.PI), operator: cf(con[0], G, con[1] - 1.4, Math.PI),
    homes: [cf(1090, G, 535, Math.PI), cf(1070, G, 535, Math.PI)],
    exit: cf(1120, G, 546, 0),
  };

  // ======== the ride
  const origin = [1000, 0, 620];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
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
  const cues = [[at(1080, 684), 'fire', [-6, 6, 0]], [at(950, 552), 'flood', [0, 4, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'King Mamba', land: 'Velocity', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'An inverted coaster: your feet dangle as the train hangs beneath the track. Walk in through the jaws of a giant stone mamba, board in the temple, climb a 47-stud lift and strike - a twisting first drop, a zero-g roll, a corkscrew, a roll over the temple pool and a low, fast run through the ruins.',
    baseWait: 60, origin, entrance: [ex, 0, ez], exit: [1128, 0, 552], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, GREEN, YELLOW], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'King Mamba is open - feet dangling, three inversions!', 'Mind the fangs on your way in!'];
  return { ride, gate: { x: gx, z: 500 }, supports };
}

// a toast the first time you come near the new ride
export class KingMambaSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 45) {
      this.told = true;
      this.hooks.toast('NEW: King Mamba, an inverted coaster - feet dangling, three inversions! Through the stone gate past RV Van Run.', 'reward');
    }
  }
}
