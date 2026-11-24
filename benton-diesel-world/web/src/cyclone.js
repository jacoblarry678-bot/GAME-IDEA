// Cyclone: a compact "El Loco"-style coaster - a vertical lift, a
// beyond-vertical (111 degree) drop, a vertical loop, a zero-g roll and
// tight turns - in a storm-wrecked farm clearing north of Flying Fire
// (through a gate in Flying Fire's north wall). A tornado tore through the
// Benton Ridge farm and left its funnel spinning over the fields; the
// coaster rides it.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'Cyclone';
const SITE = { x0: -796, x1: -598, z0: -156, z1: -24 };
const GATE = { x0: -611, x1: -601 }; // in Flying Fire's north wall (z -158)
const G = 0.1;
const CARS = 2, SPACING = 3.3;
const CYAN = 0x2ec4d8, BARN = 0xa8281e, WHITE = 0xf2f2ee, STORM = 0x3a4450, HAY = 0xd8b450, DARK = 0x1a1c20, STEEL = 0x8e949c, WOOD = 0x7c5638;
const TRACK_COLOR = 0x2ec4d8;

const CIRCUIT = [
  [-630, 2, -112, 2],
  // out of the barn, round to the west
  [-630, 2, -98, 4], [-632, 2.2, -84, 4], [-638, 2.3, -72, 4], [-646, 2.4, -65, 4], [-652, 2.4, -64, 4], [-664, 3, -64, 3.5],
  // the vertical lift
  [-671, 7, -64, 3], [-674.5, 15, -64, 3], [-675.8, 25, -64, 3],
  // over the top and the beyond-vertical drop (tucking back under the crest)
  [-676.3, 31, -64, 3], [-678.5, 33.8, -64, 3.2], [-682, 34, -64, 3.5], [-685.5, 32.5, -64, 5], [-686.8, 28, -64, 9], [-686, 22, -64, 14], [-684.5, 16, -64, 18],
  // the pull-out, west
  [-685.5, 9, -64, 21], [-690, 4, -64, 23], [-697, 2.5, -64, 24],
  // the vertical loop
  [-705, 2.6, -64.5, 24], [-716, 8, -65, 21], [-722, 18, -66, 15], [-716, 25, -67.5, 11], [-709, 18, -69.8, 15], [-715, 7, -72, 21], [-726, 2.8, -73, 23],
  // west, round to the south over a camelback, round to the east
  [-740, 3, -74, 23], [-754, 8, -80, 21], [-764, 12, -94, 19], [-768, 15, -108, 17], [-768, 8, -122, 21], [-762, 6, -138, 22], [-748, 8, -145, 21],
  // the zero-g roll, east
  [-734, 12, -146, 19], [-720, 14, -146.5, 18], [-706, 12, -147, 19],
  // home along the south side and north into the barn
  [-692, 7, -148, 20], [-676, 4, -150, 18], [-660, 4, -151, 14], [-646, 3, -148, 8], [-635, 2.4, -138, 5], [-630, 2, -126, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

// The track's frames: carried along the track (so the vertical lift, the
// beyond-vertical drop and the loop keep the riders the right way round),
// pulled toward the usual banked "up" wherever the track is near level,
// with twists (rolls about the heartline) added on top.
export function carriedFrames(track, { free = [], twists = [] }) {
  const n = track.cum.length;
  const V = (arr, i) => new THREE.Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
  const pos = [], tan = [];
  for (let i = 0; i < n; i++) { pos.push(V(track.pos, i)); tan.push(V(track.tan, i).normalize()); }
  const cum = track.cum, L = cum[n - 1];
  // speed from the timing, for banking
  const v = cum.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); return (cum[b] - cum[a]) / Math.max(1e-3, track.times[b] - track.times[a]); });
  const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  // a twist's angle part way through: all the way round (eased), a zero-g
  // stall (round to upside down, held, then the rest), or a bump (out to
  // the angle and back - an outward-banked hill)
  const shapeAt = (T, u) => {
    if (T.shape === 'stall') { const p = (1 - (T.hold ?? 0.4)) / 2; return T.angle * 0.5 * (u < p ? ease(u / p) : u < 1 - p ? 1 : 1 + ease((u - (1 - p)) / p)); }
    if (T.shape === 'bump') return T.angle * Math.sin(Math.PI * u) ** 2;
    return T.angle * ease(u);
  };
  const twistAt = (s) => {
    let a = 0;
    for (const T of twists) a += s <= T.s0 ? 0 : s >= T.s1 ? (T.shape === 'bump' ? 0 : T.angle) : shapeAt(T, (s - T.s0) / (T.s1 - T.s0));
    return a;
  };
  const freeW = (s) => {
    let w = 1;
    for (const [a, b] of free) {
      const d = s < a ? a - s : s > b ? s - b : 0;
      w = Math.min(w, THREE.MathUtils.smoothstep(d, 0, 10));
    }
    return w;
  };
  // the banked "up" the track would have on the level
  const Y = new THREE.Vector3(0, 1, 0);
  const phi = pos.map((_, i) => {
    const a = tan[Math.max(0, i - 2)], b = tan[Math.min(n - 1, i + 2)];
    const ds = cum[Math.min(n - 1, i + 2)] - cum[Math.max(0, i - 2)] || 1;
    let dh = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const flat = Math.hypot(tan[i].x, tan[i].z);
    if (flat < 0.6) return 0;
    return THREE.MathUtils.clamp(Math.atan((v[i] * v[i] * (-dh / ds) * flat) / 9.8), -1.15, 1.15);
  });
  const sm = phi.map((_, i) => { let s = 0, c = 0; for (let k = -10; k <= 10; k++) { const j = i + k; if (j >= 0 && j < n) { s += phi[j]; c++; } } return s / c; });
  const banked = (i) => {
    const t = tan[i];
    const u0 = Y.clone().addScaledVector(t, -t.dot(Y)).normalize();
    const r0 = new THREE.Vector3().crossVectors(t, u0);
    return u0.multiplyScalar(Math.cos(sm[i])).addScaledVector(r0, Math.sin(sm[i]));
  };
  const up = [banked(0)];
  const q = new THREE.Quaternion();
  for (let i = 1; i < n; i++) {
    q.setFromUnitVectors(tan[i - 1], tan[i]);
    const u = up[i - 1].clone().applyQuaternion(q);
    u.applyAxisAngle(tan[i], twistAt(cum[i]) - twistAt(cum[i - 1]));
    const level = 1 - THREE.MathUtils.smoothstep(Math.abs(tan[i].y), 0.45, 0.75);
    const w = level * freeW(cum[i]) * (twistAt(cum[i]) % (Math.PI * 2) === 0 ? 1 : 0);
    if (w > 0) {
      const d = banked(i);
      const cross = new THREE.Vector3().crossVectors(u, d);
      const ang = Math.atan2(cross.dot(tan[i]), u.dot(d));
      u.applyAxisAngle(tan[i], ang * Math.min(1, 0.2 * w));
    }
    u.addScaledVector(tan[i], -u.dot(tan[i])).normalize();
    up.push(u);
  }
  // the heartline: the rails swing round the riders' heads in the twists
  for (let i = 0; i < n; i++) {
    for (const T of twists) {
      if (cum[i] <= T.s0 || cum[i] >= T.s1) continue;
      const a = shapeAt(T, (cum[i] - T.s0) / (T.s1 - T.s0));
      const u0 = up[i].clone().applyAxisAngle(tan[i], -a);
      pos[i].addScaledVector(u0, T.h).addScaledVector(up[i], -T.h);
    }
  }
  // measure again
  const oldCum = cum.slice(), oldT = track.times.slice();
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + pos[i].distanceTo(pos[i - 1]);
    const d0 = oldCum[i] - oldCum[i - 1];
    track.times[i] = track.times[i - 1] + (d0 > 1e-6 ? (oldT[i] - oldT[i - 1]) * ((cum[i] - cum[i - 1]) / d0) : 0);
  }
  for (let i = 0; i < n; i++) tan[i].copy(pos[i === n - 1 ? 1 : i + 1]).sub(pos[i === 0 ? n - 2 : i - 1]).normalize();
  track.length = cum[n - 1];
  track.pos = pos.flatMap((p) => [p.x, p.y, p.z]);
  track.tan = tan.flatMap((p) => [p.x, p.y, p.z]);
  track.up = up.flatMap((p) => [p.x, p.y, p.z]);
  return L;
}

export function buildCyclone(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: the farm clearing, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x6a7a3e, 'Grass');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, -158, -798, -22);
  wallSeg(-798, -22, -596, -22);
  wallSeg(-596, -22, -596, -158);
  // the gate in Flying Fire's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 158) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, -158, GATE.x1, -158);
  wallSeg(GATE.x0, -158, -798, -158);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.4, 15, 1.4], [x, G, -158], STORM, 'Metal');
    for (let k = 0; k < 5; k++) add([1.5, 0.5, 1.5], [x, G + 2 + k * 2.6, -158], k % 2 ? CYAN : WHITE, 'SmoothPlastic', { collide: 0 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.4, 1.2], [gx, G + 14, -158], STORM, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, -157.3], STORM, 'Back', [['CYCLONE', 0, 0, 1, 1, CYAN]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, -158.7], STORM, 'Front', [['CYCLONE', 0, 0, 1, 1, CYAN]], { glow: true });
  // the walk up the east side of Flying Fire's clearing to the gate
  for (const [a, b] of [[[-599.5, -322], [-604, -300]], [[-604, -300], [-604, -166]], [[-604, -166], [gx, -154]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.4, 0.2, len + 3.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a6a54, 'Concrete', { yaw, collide: 0 });
  }
  box([0.3, 4.4, 0.3], [-601, G, -306], WOOD, 'Wood', { collide: 0 });
  sign([5, 1.2, 0.2], [-601, G + 3.8, -305.8], STORM, 'Back', [['CYCLONE  ·  THIS WAY  ^', 0, 0, 1, 1, CYAN, 'GothamBold']]);

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const k = knot(x, z); let best = 0, bd = Infinity; const p = CIRCUIT[k]; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  carriedFrames(track, {
    // carried, not banked: the lift, the drop and the loop
    free: [[sk(-664, -64), sk(-697, -64)], [sk(-705, -64.5), sk(-726, -73)]],
    twists: [{ s0: sk(-748, -145), s1: sk(-706, -147), angle: Math.PI * 2, h: 1.3 }],
  });
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

  // ======== the barn: the station
  const ST = { x0: -640, x1: -620, z0: -128, z1: -96 };
  const PL = { x0: -627.4, x1: -621.4, z0: -122, z1: -102 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x6a4a30, 'WoodPlanks', { collide: 0 });
  add([0.5, 0.1, PL.z1 - PL.z0], [PL.x0 + 0.3, G + 0.42, (PL.z0 + PL.z1) / 2], CYAN, 'SmoothPlastic', { collide: 0 });
  for (let z = ST.z0; z <= ST.z1; z += 8) box([0.7, 8, 0.7], [ST.x0, G, z], WHITE, 'Wood', { collide: 0 });
  for (let z = ST.z0; z <= ST.z1; z += 8) box([0.7, 8, 0.7], [ST.x1 + 0.4, G, z], WHITE, 'Wood', { collide: 0 });
  for (const sx of [-1, 1]) add([(ST.x1 - ST.x0) / 2 + 2, 0.4, ST.z1 - ST.z0 + 3], [(ST.x0 + ST.x1) / 2 + sx * ((ST.x1 - ST.x0) / 4 + 0.5), G + 10, (ST.z0 + ST.z1) / 2], 0x3a3a3e, 'Metal', { collide: 0, rot: RZ(sx * -0.5) });
  for (const z of [ST.z0 - 0.2, ST.z1 + 0.2]) add([ST.x1 - ST.x0, 2.2, 0.3], [(ST.x0 + ST.x1) / 2, G + 9, z], BARN, 'WoodPlanks', { collide: 0 });
  sign([14, 2, 0.3], [(ST.x0 + ST.x1) / 2, G + 6.8, ST.z1 + 0.5], DARK, 'Back', [['CYCLONE', 0, 0, 1, 1, CYAN]], { glow: true });
  sign([0.3, 2, 14], [ST.x1 + 0.5, G + 6.4, -112], BARN, 'Right', [['BENTON RIDGE FARM', 0, 0.05, 1, 0.6, WHITE], ['STORM SHELTER  ->', 0, 0.66, 1, 0.3, HAY, 'GothamBold']]);
  // the weathervane, bent by the wind
  box([0.2, 3, 0.2], [-630, G + 10.8, -112], DARK, 'Metal', { collide: 0 });
  add([2.4, 0.1, 0.1], [-630, G + 13.6, -112], DARK, 'Metal', { collide: 0, rot: RZ(0.5) });
  add([0.6, 0.6, 0.1], [-628.9, G + 14.2, -112], DARK, 'Metal', { collide: 0, shape: 1, rot: RZ(0.5) });
  const con = [-622.6, -100.4];
  box([1.4, 1.2, 1.4], [con[0], G + 0.4, con[1]], 0x3a2a1e, 'Wood', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.4 + k * 0.4, G + 1.7, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });

  // ======== the plaza and the line: fence-rail switchbacks, hay bales
  add([22, 0.2, 8], [-610, G + 0.1, -152], 0x8a7a64, 'Cobblestone', { collide: 0 });
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.25, 1.2, 0.25], [x, G, za + ((zb - za) * k) / n], WHITE, 'Wood');
    add([0.14, 0.14, zb - za], [x, G + 1.1, (za + zb) / 2], WHITE, 'Wood', { collide: 0 });
    add([0.12, 0.12, zb - za], [x, G + 0.6, (za + zb) / 2], WHITE, 'Wood', { collide: 0 });
  };
  const LANES = [-603, -607, -611, -615, -619], N = -92, S = -146;
  railZ(S - 3, N + 1, -601);
  railZ(S, N - 3, -605);
  railZ(S + 3, N + 3, -609);
  railZ(S, N - 3, -613);
  railZ(S + 3, N + 3, -617);
  const fwd = [[-606, -154], [LANES[0], -149], [LANES[0], N], [LANES[1], N], [LANES[1], S], [LANES[2], S], [LANES[2], N], [LANES[3], N], [LANES[3], S], [LANES[4], S], [LANES[4], -110], [-624, -110], [-624.6, -114]];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  for (const x of [-612, -600]) box([0.9, 6, 0.9], [x, G, -154], STORM, 'Metal');
  add([13, 1.2, 0.8], [-606, G + 6, -154], STORM, 'Metal', { collide: 0 });
  sign([11, 1, 0.2], [-606, G + 6, -153.5], DARK, 'Back', [['CYCLONE  ·  STAND-BY', 0, 0, 1, 1, CYAN, 'GothamBold']]);
  const waitPart = add([5, 1.4, 0.4], [-600.5, G + 3.4, -151], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
  box([0.4, 2.8, 0.4], [-600.5, G, -151], STORM, 'Metal', { collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 231, cf: cf(-614, G, -150, Math.PI) });
  for (const [x, z] of [[-614, -152], [-598.5, -120], [-598.5, -100]]) add([1.6, 1.2, 1.2], [x, G + 0.6, z], HAY, 'Fabric', { collide: 0 });
  // the exit: off the platform's north end, down the east side
  for (const [a, b] of [[[-624, -100], [-624, -84]], [[-624, -84], [-599, -84]], [[-599, -84], [-599, -150]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([2.4, 0.2, len + 2.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a6a54, 'Concrete', { yaw, collide: 0 });
  }
  sign([3, 0.9, 0.2], [-621, G + 3.2, -85.5], 0x1a8a3a, 'Front', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  box([0.25, 2.8, 0.25], [-622.6, G, -85.5], STORM, 'Metal', { collide: 0 });

  // ======== supports: white columns; a tower behind the lift
  let supports = 0;
  const keep = [ST, { x0: -620, x1: -597, z0: -156, z1: -86 }];
  for (let s = 4; s < L - 4; s += 5) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (keep.some((r) => inRect(foot.x, foot.z, r, 1))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([0.9, foot.y - G, 0.9], [foot.x, (foot.y + G) / 2, foot.z], 0xe8e8e8, 'Metal', { shape: 5, collide: 0 });
    add([1.8, 0.5, 1.8], [foot.x, G + 0.25, foot.z], 0x9a9a94, 'Concrete', { collide: 0 });
    supports++;
  }
  // the lift tower: a white lattice column behind the vertical lift, and
  // a column with arms holding the drop
  const tower = (x, z, top, w = 2.2) => {
    for (const [dx, dz] of [[-w / 2, -w / 2], [w / 2, -w / 2], [-w / 2, w / 2], [w / 2, w / 2]]) box([0.35, top - G, 0.35], [x + dx, G, z + dz], 0xe8e8e8, 'Metal', { collide: 0 });
    for (let y = 3; y < top; y += 3) { add([w, 0.2, 0.2], [x, y, z - w / 2], 0xe8e8e8, 'Metal', { collide: 0 }); add([w, 0.2, 0.2], [x, y, z + w / 2], 0xe8e8e8, 'Metal', { collide: 0 }); }
    supports++;
  };
  tower(-680, -64, 30, 3.6);

  // ======== the tornado: a funnel of wind spinning over the field, with
  // the farm's things caught up in it (it turns while the ride runs)
  const TZ = [-706, G, -112];
  const funnel = [];
  for (let k = 0; k < 12; k++) {
    const y = 1 + k * 2.4, r = 1.2 + k * 0.75;
    funnel.push(pp(5, [r * 2, 2.6, r * 2], [Math.sin(k * 0.9) * 0.6, y, Math.cos(k * 0.7) * 0.6], k % 2 ? 0x8a929c : 0x6a727c, 'Glass'));
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, r = 4 + k * 0.9, y = 6 + k * 3;
    funnel.push(pp(0, [1.6, 0.3, 0.8], [Math.cos(a) * r, y, Math.sin(a) * r], [WOOD, BARN, HAY, WHITE][k % 4], 'Wood', RY(a)));
  }
  funnel.push(pp(0, [2.2, 1.4, 1.4], [6, 14, 0], 0xc8a020, 'SmoothPlastic'), pp(2, [0.9, 1.1, 1.1], [5.2, 13.3, 0.8], DARK, 'Rubber'));
  const extras = { Tornado: { pivot: [...TZ, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: funnel } };
  const props = [{ name: 'Tornado', at: TZ, kind: 'turn', speed: 1.6 }];
  for (let k = 0; k < 4; k++) data.tags.SteamVent.push([TZ[0] + Math.cos(k * 1.6) * 3, G + 0.4, TZ[2] + Math.sin(k * 1.6) * 3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // the wrecked farm: a barn torn open, a windmill bent over, an
  // overturned tractor, hay bales and fence boards everywhere
  const WB = [-760, -50];
  if (clearOf([16, 10, 12], [WB[0], 5, WB[1]], 4)) {
    box([16, 7, 0.4], [WB[0], G, WB[1] - 6], BARN, 'WoodPlanks');
    box([0.4, 7, 12], [WB[0] - 8, G, WB[1]], BARN, 'WoodPlanks');
    box([0.4, 4, 7], [WB[0] + 8, G, WB[1] - 2.5], BARN, 'WoodPlanks', { rot: RZ(0.3) });
    add([9, 0.3, 13], [WB[0] - 4, G + 8, WB[1]], 0x3a3a3e, 'Metal', { collide: 0, rot: RZ(-0.5) });
    sign([8, 1.4, 0.2], [WB[0], G + 5.6, WB[1] - 5.7], BARN, 'Back', [['BENTON RIDGE FARM', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  }
  const WM = [-640, -40];
  if (clearOf([4, 20, 4], [WM[0], 10, WM[1]], 4)) {
    box([0.6, 14, 0.6], [WM[0], G, WM[1]], STEEL, 'Metal', { collide: 0, rot: RZ(0.12) });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; add([0.2, 3.4, 0.6], [WM[0] + 1.7 + Math.cos(a) * 1.7, G + 14 + Math.sin(a) * 1.7, WM[1]], WHITE, 'Metal', { collide: 0, rot: RZ(a + Math.PI / 2) }); }
  }
  for (const [x, z, a] of [[-740, -128, 0.4], [-690, -134, 2.1], [-728, -96, 1.2], [-656, -88, 0.7], [-780, -140, 2.6], [-660, -128, 1.9]]) {
    if (!clearOf([2, 1.4, 2], [x, G + 0.7, z], 3)) continue;
    add([1.8, 1.2, 1.2], [x, G + 0.6, z], HAY, 'Fabric', { collide: 1, rot: RY(a) });
  }
  if (clearOf([6, 3, 4], [-744, 1.5, -40], 4)) {
    add([3.6, 2.2, 2.6], [-744, G + 1.4, -40], 0xc8a020, 'SmoothPlastic', { collide: 1, rot: RZ(Math.PI * 0.9) });
    for (const [dx, d] of [[-1.4, 2.6], [1.6, 1.6]]) add([0.8, d, d], [-744 + dx, G + 2.6, -40], DARK, 'Rubber', { shape: 2, collide: 0 });
  }
  for (let k = 0; k < 10; k++) {
    const x = -780 + (k * 37) % 150, z = -150 + (k * 53) % 120;
    if (!clearOf([3, 1, 3], [x, G + 0.3, z], 3) || inRect(x, z, { x0: -622, x1: -596, z0: -158, z1: -86 })) continue;
    add([2.6, 0.12, 0.3], [x, G + 0.1, z], 0xd8d0c0, 'Wood', { collide: 0, rot: RY(k) });
  }

  // ======== the cars: two little cars coupled, storm-grey with cyan
  const carParts = (k) => [
    pp(0, [3.2, 0.9, 3.2], [0, 0.65, 0], STORM, 'SmoothPlastic'),
    pp(0, [3.3, 0.2, 3.3], [0, 1.1, 0], CYAN, 'SmoothPlastic'),
    pp(0, [3.4, 0.15, 3.1], [0, 0.2, 0], CYAN, 'Neon'),
    ...[-0.8, 0.7].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x1a1a24, 'Fabric'),
      pp(0, [1.1, 1.3, 0.25], [x, 1.9, z + 0.5], STORM, 'SmoothPlastic'),
    ])),
    ...(k === 0 ? [pp(1, [3, 1.1, 1.3], [0, 0.85, -2.1], STORM, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(0, [3.1, 0.2, 0.2], [0, 0.4, -2.75], CYAN, 'Neon')] : []),
  ];
  const seatList = () => [-0.8, 0.7].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
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
    stops.push(cf(-623.6, G, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 1, routes: [[1, 2]],
    console: cf(con[0], G, con[1] - 1, Math.PI / 2), operator: cf(con[0] + 0.6, G, con[1] - 1.8, Math.PI / 2),
    homes: [cf(-622.6, G, -106, -Math.PI / 2)],
    exit: cf(-624, G, -100, Math.PI),
  };

  // ======== the ride
  const origin = [-690, 0, -120];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras, extrasNames: ['Tornado'], props, crew,
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
  // a cloudburst at the bottom of the drop, sparks out of the roll
  const cues = [[at(-692, -64), 'flood', [0, 0, -6]], [at(-700, -147), 'sparks', [0, 2, 2]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Cyclone', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'A compact "El Loco"-style coaster in a storm-wrecked farm north of Flying Fire. A tornado tore through Benton Ridge Farm and its funnel is still spinning over the fields. Climb the vertical lift, go over the top and drop past vertical - 111 degrees, tucked back under yourself - then a vertical loop, a camelback, a zero-g roll and tight turns home to the barn.',
    baseWait: 45, origin, entrance: [-606, 0, -153], exit: [-608, 0, -150], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, STORM, CYAN], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Cyclone is open - a vertical lift and a drop past vertical!'];
  return { ride, gate: { x: gx, z: -158 }, supports };
}

// a toast the first time you come near
export class CycloneSite {
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
      this.hooks.toast('NEW: Cyclone - a vertical lift and a drop past vertical! Through the gate in Flying Fire\'s north wall.', 'reward');
    }
  }
}
