// Jungle Raid: a Mack-style coaster with a holding brake at the top - the
// train stops right on the edge, hanging you over a drop past vertical,
// before letting go - in a jungle north of Operation: Win the Crown (through
// a gate in its north wall). The Benton Explorers' Club has found the lost
// Temple of the Jaguar King (the park's own legend), and you're on the
// raid for its golden idol: up the lift beside the waterfall, the hold
// over the edge, the drop into the ravine, a loop round the stone jaguar's
// head, a heartline roll through the temple arch, airtime hills over the
// ruins, and back to camp.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';
import { carriedFrames } from './cyclone.js';

export const RIDE_ID = 'JungleRaid';
const SITE = { x0: -796, x1: -598, z0: 514, z1: 640 };
const GATE = { x0: -611, x1: -601 }; // in Win the Crown's north wall (z 512)
const G = 0.1;
const CARS = 4, SPACING = 3.6;
const HOLD = 3.2; // seconds hanging over the edge
const JUNGLE = 0x2a6a2a, LEAF = 0x3a8a3a, STONE = 0x8a8470, MOSS = 0x5a7a4a, BAMBOO = 0xc8b070, THATCH = 0xa88a4a, GOLD = 0xf0c040, KHAKI = 0xb8a070, DARK = 0x1c1d1a;
const TRACK_COLOR = 0x2a8a3a;

const CIRCUIT = [
  [-630, 2, 586, 2],
  // out of camp, round to the west and up the lift
  [-630, 2.2, 598, 4], [-632, 2.6, 610, 4], [-640, 3, 618, 4], [-652, 3.5, 620, 4], [-660, 6, 620, 4], [-676, 22, 620, 4], [-688, 34, 620, 3.5], [-694, 38, 620, 3],
  // over the top to the edge (the holding brake), and the drop past vertical
  [-700, 39, 620, 2.5], [-705, 38.4, 620, 2], [-707.5, 34, 620, 8], [-708, 26, 620, 16], [-707, 18, 620, 21], [-706.5, 12, 620, 24],
  // the pull-out, west
  [-709, 6, 620, 26], [-716, 3, 619, 27], [-726, 2.6, 618, 27],
  // the loop round the jaguar's head
  [-734, 3, 617.5, 27], [-746, 10, 617, 24], [-752, 24, 616.5, 17], [-746, 32, 615.5, 12], [-739, 24, 613.5, 17], [-745, 10, 611.5, 24], [-756, 3, 610, 27],
  // round to the south and the heartline roll through the temple arch
  [-772, 4, 610, 26], [-782, 6, 600, 25], [-784, 9, 588, 23], [-784, 10, 580, 22], [-784, 11, 568, 21], [-784, 10, 556, 22], [-784, 8, 548, 23],
  // round to the east and the airtime hills over the ruins
  [-780, 6, 536, 24], [-770, 5, 528, 25], [-756, 6, 526, 25], [-740, 16, 526, 21], [-724, 6, 526, 24], [-708, 12, 526, 21], [-692, 5, 526, 23],
  // round to the north and the brakes into camp
  [-672, 4, 527, 18], [-656, 3.5, 532, 12], [-642, 3, 538, 8], [-634, 2.8, 546, 5], [-630, 2.5, 558, 4], [-630, 2.2, 572, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

export function buildJungleRaid(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.terrain = data.terrain || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: a jungle clearing, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x4a6a2a, 'Grass');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x7a7a62, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0x9a9a82, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, 512, -798, 642);
  wallSeg(-798, 642, -596, 642);
  wallSeg(-596, 642, -596, 512);
  // the gate in Win the Crown's north wall: carved stone posts, vines
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] - 512) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, 512, GATE.x1, 512);
  wallSeg(GATE.x0, 512, -798, 512);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([2, 15, 2], [x, G, 512], STONE, 'Slate');
    for (let k = 0; k < 4; k++) add([2.2, 0.5, 2.2], [x, G + 3 + k * 3, 512], MOSS, 'Slate', { collide: 0 });
    data.tags.Campfire.push([x, G + 15.6, 512, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  add([GATE.x1 - GATE.x0 + 2, 2.4, 2], [gx, G + 14, 512], STONE, 'Slate', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 513.1], DARK, 'Back', [['JUNGLE RAID', 0, 0, 1, 1, GOLD]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, 510.9], DARK, 'Front', [['JUNGLE RAID', 0, 0, 1, 1, GOLD]], { glow: true });
  for (let k = 0; k < 6; k++) add([0.3, 4 + (k % 3), 0.3], [GATE.x0 + 1 + k * 1.6, G + 11, 512.6], LEAF, 'Grass', { collide: 0 });
  // the walk up the east side of the fortress courtyard to the gate
  for (const [a, b] of [[[-604, 386], [-599, 392]], [[-599, 392], [-599, 504]], [[-599, 504], [gx, 508]], [[gx, 508], [gx, 518]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.8, 0.2, len + 2.8], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the track, with the holding brake at the edge
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  carriedFrames(track, {
    free: [[sk(-694, 620), sk(-726, 618)], [sk(-734, 617.5), sk(-756, 610)]],
    twists: [{ s0: sk(-784, 580), s1: sk(-784, 556), angle: Math.PI * 2, h: 1.3 }],
  });
  // the hold: the front car stops just over the edge; then the train falls
  {
    const sStop = sk(-705, 620) + 2.5;
    const iS = track.cum.findIndex((c) => c >= sStop);
    const a = (sStop - track.cum[iS - 1]) / (track.cum[iS] - track.cum[iS - 1]);
    const lerp3 = (arr) => [0, 1, 2].map((k) => arr[(iS - 1) * 3 + k] + (arr[iS * 3 + k] - arr[(iS - 1) * 3 + k]) * a);
    const t = track.times[iS - 1] + (track.times[iS] - track.times[iS - 1]) * a;
    const p = lerp3(track.pos), tn = lerp3(track.tan), u = lerp3(track.up);
    for (let i = iS; i < track.times.length; i++) track.times[i] += HOLD;
    track.pos.splice(iS * 3, 0, ...p, ...p);
    track.tan.splice(iS * 3, 0, ...tn, ...tn);
    track.up.splice(iS * 3, 0, ...u, ...u);
    track.cum.splice(iS, 0, sStop, sStop);
    track.times.splice(iS, 0, t, t + HOLD);
    // let go: speed from the height fallen, down to the bottom of the drop
    const yStop = p[1], oldT = track.times.slice();
    let vPrev = 0.8;
    for (let i = iS + 2; i < track.times.length; i++) {
      const y = track.pos[i * 3 + 1];
      if (y < 3.2 && track.pos[i * 3] < -712) { for (let j = i; j < track.times.length; j++) track.times[j] = track.times[j - 1] + (oldT[j] - oldT[j - 1]); break; }
      const v = Math.sqrt(0.64 + 2 * 9.8 * Math.max(0, yStop - y));
      track.times[i] = track.times[i - 1] + (track.cum[i] - track.cum[i - 1]) / ((v + vPrev) / 2);
      vPrev = v;
    }
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

  // ======== the camp: a bamboo-and-thatch station
  const ST = { x0: -640, x1: -620, z0: 566, z1: 594 };
  const PL = { x0: -627.4, x1: -622.6, z0: 570, z1: 592 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x7a5a3a, 'WoodPlanks', { collide: 0 });
  add([0.4, 0.1, PL.z1 - PL.z0], [PL.x0 + 0.3, G + 0.42, (PL.z0 + PL.z1) / 2], GOLD, 'SmoothPlastic', { collide: 0 });
  for (let z = ST.z0; z <= ST.z1; z += 7) for (const x of [ST.x0, ST.x1]) box([0.7, 8, 0.7], [x, G, z], BAMBOO, 'Wood', { collide: 0 });
  for (const sx of [-1, 1]) add([(ST.x1 - ST.x0) / 2 + 2.4, 0.6, ST.z1 - ST.z0 + 3], [(ST.x0 + ST.x1) / 2 + sx * ((ST.x1 - ST.x0) / 4 + 0.5), G + 9.4, (ST.z0 + ST.z1) / 2], THATCH, 'Fabric', { collide: 0, rot: RZ(sx * -0.45) });
  sign([14, 2, 0.3], [(ST.x0 + ST.x1) / 2, G + 7.4, ST.z0 - 0.4], DARK, 'Front', [['JUNGLE RAID', 0, 0, 1, 1, GOLD]], { glow: true });
  sign([0.3, 1.8, 12], [ST.x1 + 0.45, G + 6.6, 580], KHAKI, 'Right', [['BENTON EXPLORERS\' CLUB  ·  BASE CAMP', 0, 0, 1, 1, DARK, 'GothamBold']]);
  const con = [-623.4, 591];
  box([1.2, 1.2, 1.2], [con[0], G + 0.4, con[1]], 0x5a3a24, 'Wood', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] - 0.4 + k * 0.4], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  for (const z of [568, 592]) data.tags.Campfire.push([-619, G + 3.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);

  // ======== the line: switchbacks between bamboo rails, under palms
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.3, 1.2, 0.3], [x, G, za + ((zb - za) * k) / n], BAMBOO, 'Wood');
    add([0.16, 0.16, zb - za], [x, G + 1.1, (za + zb) / 2], BAMBOO, 'Wood', { collide: 0 });
    add([0.14, 0.14, zb - za], [x, G + 0.6, (za + zb) / 2], BAMBOO, 'Wood', { collide: 0 });
  };
  const LANES = [-603, -607, -611, -615, -619], QS = 530, QN = 600;
  railZ(QS - 4, QN + 2, -601);
  for (let k = 0; k < LANES.length - 1; k++) {
    const x = (LANES[k] + LANES[k + 1]) / 2;
    if (k % 2 === 0) railZ(QS - 2, QN - 3, x); // heading north: turn at the north end
    else railZ(QS + 3, QN + 2, x);
  }
  add([16, 0.2, 10], [-608, G + 0.1, 519], 0x8a7a5a, 'Cobblestone', { collide: 0 });
  for (const x of [-614, -602]) { box([1.4, 6, 1.4], [x, G, 524], STONE, 'Slate'); data.tags.Campfire.push([x, G + 6.5, 524, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
  add([13.4, 1.4, 1], [-608, G + 6, 524], STONE, 'Slate', { collide: 0 });
  sign([11, 1, 0.2], [-608, G + 6, 523.4], DARK, 'Front', [['JUNGLE RAID  ·  EXPEDITION LINE', 0, 0, 1, 1, GOLD, 'GothamBold']]);
  const waitPart = add([4, 1.2, 0.3], [-599.8, G + 3.4, 520], 0x101624, 'SmoothPlastic', { collide: 0, yaw: -Math.PI / 2 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 351, cf: cf(-612, G, 520, Math.PI) });
  const fwd = [[-606, 518], [LANES[0], QS - 2]];
  LANES.forEach((x, k) => {
    const north = k % 2 === 0;
    fwd.push([x, north ? QN : QS]);
    if (k < LANES.length - 1) fwd.push([LANES[k + 1], north ? QN : QS]);
  });
  fwd.push([-621.4, QN + 4], [-624.6, 586]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the exit: off the platform's south end, down to the plaza
  for (const [a, b] of [[[-625, 568], [-623, 528]], [[-623, 528], [-615, 518]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.2, 0.2, len + 2.2], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a6a54, 'Concrete', { yaw, collide: 0 });
  }

  // ======== the jungle: the waterfall by the lift, the ravine, the jaguar,
  // the temple arch, ruins, palms
  // the waterfall beside the lift: a rock cliff with water pouring down
  const WF = [-680, 632];
  if (clearOf([16, 30, 6], [WF[0], 15, WF[1]], 2)) {
    box([20, 30, 6], [WF[0], G, WF[1] + 2], STONE, 'Slate', { collide: 0 });
    add([6, 28, 0.6], [WF[0], G + 15, WF[1] - 1.2], 0x8ad0f0, 'Glass', { trans: 0.35, collide: 0 });
    data.tags.SteamVent.push([WF[0], G + 0.6, WF[1] - 3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  data.terrain.push({ kind: 'block', material: 'Water', cf: [-700, G + 0.6 + 0.2, 628, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [40, 1, 10] });
  for (const [w, d, x, z] of [[42, 0.8, -700, 622.6], [42, 0.8, -700, 633.4], [0.8, 10, -721, 628], [0.8, 10, -679, 628]]) add([w, 1.1, d], [x, G + 0.55, z], STONE, 'Slate', { collide: 0 });
  // the stone jaguar's head inside the loop (the park's own guardian)
  const JX = [-745, 0, 600];
  if (clearOf([12, 14, 10], [JX[0], 7, JX[2]], 2)) {
    box([12, 4, 10], [JX[0], G, JX[2]], STONE, 'Slate', { collide: 0 });
    add([10, 9, 9], [JX[0], G + 8, JX[2]], STONE, 'Slate', { shape: 3, collide: 0 });
    for (const dx of [-4, 4]) add([2.6, 3.4, 2.4], [JX[0] + dx, G + 12.4, JX[2]], STONE, 'Slate', { shape: 1, collide: 0 });
    add([6, 3.6, 4], [JX[0], G + 6.2, JX[2] + 4.4], STONE, 'Slate', { collide: 0 });
    for (const dx of [-2.2, 2.2]) neon([1.4, 0.8, 0.4], [JX[0] + dx, G + 9.4, JX[2] + 4.3], GOLD);
    for (const dx of [-1.6, 1.6]) add([0.5, 1.6, 0.5], [JX[0] + dx, G + 4.6, JX[2] + 6.2], 0xf0ead8, 'SmoothPlastic', { collide: 0, shape: 1, rot: [1, 0, 0, 0, -1, 0, 0, 0, -1] });
    for (let k = 0; k < 4; k++) add([1.4, 0.6, 0.6], [JX[0] - 3 + k * 2, G + 13.5, JX[2] - 2], MOSS, 'Grass', { collide: 0 });
  }
  // the temple arch the heartline roll runs through
  for (const z of [574, 562]) {
    if (!clearOf([3, 18, 3], [-776, 9, z], 2)) continue;
    box([3, 18, 3], [-776, G, z], STONE, 'Slate', { collide: 0 });
  }
  for (const [x, z] of [[-776, 568]]) if (clearOf([3, 3, 16], [x, 19, z], 2)) add([3, 3, 16], [x, G + 19.5, z], STONE, 'Slate', { collide: 0 });
  // ruins: tumbled blocks, broken columns, a stepped temple base with the
  // golden idol at the top
  for (const [x, z, h] of [[-760, 548, 6], [-740, 552, 4], [-720, 545, 7], [-700, 552, 3], [-690, 590, 5], [-712, 596, 4]]) {
    if (!clearOf([3, h, 3], [x, h / 2, z], 3)) continue;
    box([2.4, h, 2.4], [x, G, z], STONE, 'Slate', { shape: 5, collide: 0 });
    add([2.8, 0.8, 2.8], [x, G + h + 0.4, z], MOSS, 'Slate', { collide: 0 });
  }
  const TP = [-700, 572];
  if (clearOf([18, 12, 18], [TP[0], 6, TP[1]], 2)) {
    for (let k = 0; k < 4; k++) box([18 - k * 4, 2.6, 18 - k * 4], [TP[0], G + k * 2.6, TP[1]], k % 2 ? STONE : 0x7a7462, 'Slate');
    box([1.6, 2.6, 1.6], [TP[0], G + 10.4, TP[1]], GOLD, 'Metal', { collide: 0 });
    neon([1.2, 1.2, 1.2], [TP[0], G + 13.6, TP[1]], GOLD, { shape: 3 });
  }
  // palms and jungle trees round the clearing (clear of the track)
  const kinds = ['palm', 'round', 'palm', 'round', 'palm'];
  for (let k = 0; k < 28; k++) {
    const x = -790 + ((k * 61) % 186), z = 520 + ((k * 37) % 116);
    if (!clearOf([8, 22, 8], [x, 11, z], 4) || inRect(x, z, { x0: -630, x1: -598, z0: 514, z1: 604 }, 3) || inRect(x, z, ST, 4)) continue;
    data.trees.push({ leaf: [0x2a6a2a, 0x3a7a2a, 0x4a8a3a][k % 3], kind: kinds[k % 5], s: 0.9 + (k % 4) * 0.15, pos: [x, G, z] });
  }

  // ======== supports: dark green columns; a lattice tower under the top
  let supports = 0;
  const keep = [ST, { x0: -630, x1: -598, z0: 514, z1: 604 }];
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (keep.some((r) => inRect(foot.x, foot.z, r, 1))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([1, foot.y - G, 1], [foot.x, (foot.y + G) / 2, foot.z], 0x2a3a2a, 'Metal', { shape: 5, collide: 0 });
    supports++;
  }
  // the tower holding the top and the edge (behind the drop)
  for (const [dx, dz] of [[-2, -4.4], [2, -4.4], [-2, 4.4], [2, 4.4]]) box([0.6, 36, 0.6], [-700 + dx, G, 620 + dz], 0x2a3a2a, 'Metal', { collide: 0 });
  for (let y = 4; y < 36; y += 6) for (const dz of [-4.4, 4.4]) add([4, 0.3, 0.3], [-700, y, 620 + dz], 0x2a3a2a, 'Metal', { collide: 0 });

  // ======== the cars: explorers' jeeps, khaki and green, a spare tire on the back
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.4], [0, 0.65, 0], [JUNGLE, KHAKI, JUNGLE, KHAKI][k], 'SmoothPlastic'),
    pp(0, [3.3, 0.2, 3.5], [0, 1.1, 0], DARK, 'Metal'),
    pp(0, [3.4, 0.15, 3.2], [0, 0.2, 0], GOLD, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x3a2a1a, 'Fabric'),
      pp(0, [1.1, 1.2, 0.25], [x, 1.85, z + 0.5], KHAKI, 'Fabric'),
    ])),
    ...(k === 0 ? [pp(0, [3, 1.2, 1.2], [0, 0.9, -2.2], JUNGLE, 'SmoothPlastic'), pp(0, [2.8, 0.7, 0.12], [0, 1.1, -2.85], 0x9a9ea6, 'Metal'), pp(3, [0.5, 0.5, 0.2], [-1.1, 1.3, -2.9], 0xfff4c0, 'Neon'), pp(3, [0.5, 0.5, 0.2], [1.1, 1.3, -2.9], 0xfff4c0, 'Neon')] : []),
    ...(k === CARS - 1 ? [pp(2, [0.6, 1.6, 1.6], [0, 1.4, 2.1], DARK, 'Rubber', [0, 0, 1, 0, 1, 0, -1, 0, 0])] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
    P.setFromMatrixPosition(m4);
    stops.push(cf(PL.x0 + 0.8, G, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0], G, con[1] - 1, Math.PI / 2), operator: cf(con[0] + 0.4, G, con[1] - 2, Math.PI / 2),
    homes: [cf(-624, G, 574, Math.PI / 2), cf(-624, G, 588, Math.PI / 2)],
    exit: cf(-625, G, 570, Math.PI),
  };

  // ======== the ride
  const origin = [-700, 0, 580];
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
  // a splash at the bottom of the ravine, torches flaring through the arch
  const cues = [[at(-716, 619), 'splash', [0, 0, 4]], [at(-784, 568), 'fire', [-5, 0, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Jungle Raid', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "A Mack-style coaster in the jungle north of Operation: Win the Crown. The Benton Explorers' Club has found the lost Temple of the Jaguar King, and you're on the raid for its golden idol: up the lift beside the waterfall, a holding brake that stops you hanging over the edge, a drop past vertical into the ravine, a loop round the stone jaguar's head, a heartline roll through the temple arch, airtime hills over the ruins and back to camp.",
    baseWait: 60, origin, entrance: [-606, 0, 520], exit: [-610, 0, 522], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, KHAKI, GOLD], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Jungle Raid is open - it stops you right on the edge before the drop!'];
  return { ride, gate: { x: gx, z: 512 }, supports };
}

// a toast the first time you come near
export class JungleRaidSite {
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
      this.hooks.toast('NEW: Jungle Raid - it stops you hanging over the edge before a drop past vertical! Through the gate in Win the Crown\'s north wall.', 'reward');
    }
  }
}
