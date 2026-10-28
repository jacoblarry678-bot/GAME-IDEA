// Benton Boom Coaster: a steel "boom coaster" and dark ride. The real
// track is a steel coaster track, low and dark; each car's bogie rides it
// and carries a curved steel boom up and over to one side, and on the end
// of the boom hangs a rusty mine cart. Under every mine cart runs a fake
// wooden mine track (built here along the boom's offset path), so the
// carts look like a runaway mine train - and where that show track is
// broken, the carts seem to JUMP the gap: over a ravine where the bridge
// is out, and over a blown-out section in the dynamite store. Half the
// ride is outdoors (a lift hill, a drop into a big turn, the ravine jump,
// a camelback and a swerve), half is a dark ride through Boom Mountain:
// the mine shaft, a crystal cavern, the dynamite store, an underground
// river and a cave-in, then out into daylight.
//
// It stands east of Throttle Works, through a gate in its east wall.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'BentonBoom';
const G = 0.1;
const PL = 1.4; // the rails in the station
const CARS = 4, SPACING = 7.6;
const BOOM = { x: 4.9, y: 0 }; // the mine cart's center, off to the right of the rails
const PLAT = PL + 2.3;
const SITE = { x0: 810, x1: 1004, z0: -400, z1: 236 };
const MTN = { x0: 815, x1: 992, z0: -392, z1: -252, H: 30 }; // Boom Mountain
const GATE = { z0: -40, z1: -16 };
const RUST = 0x7a4a2a, IRON = 0x2a2a2a, TIMBER = 0x6a4a30, DARKWOOD = 0x4a3220, ROCK = 0x4a3a2a, ROCKD = 0x33281e, STEEL = 0x8a8e94, LAMP = 0xffc060, TNT = 0xc81e1e, CRYSTAL = 0x5ae8ff, AMETHYST = 0xb05aff, WATER = 0x3a8adc;

// the circuit: x, y, z of the steel rails and the speed there, from where
// the front car stops in the station (heading north)
const CIRCUIT = [
  [880, PL, -40, 2],
  [880, PL, -22, 4],
  // the lift hill
  [880, 3, -6, 4], [880, 20, 26, 4], [880, 36, 56, 4], [881, 38, 68, 6],
  // the drop and the big turn
  [886, 30, 82, 12], [895, 10, 102, 28], [910, 5, 122, 32], [928, 8, 146, 30], [946, 16, 164, 26], [965, 22, 172, 20],
  [978, 18, 155, 22], [981, 12, 128, 26],
  // the ravine: the bridge is out
  [978, 16, 104, 24], [974, 12, 82, 25],
  // a camelback, then a swerve
  [968, 7, 56, 28], [962, 18, 26, 18], [958, 8, -6, 26], [956, 7, -50, 26], [952, 13, -90, 20], [935, 9, -120, 22], [942, 6, -160, 20],
  // brakes, then into Boom Mountain
  [950, 4, -200, 10], [950, 3.5, -240, 6],
  [948, 3.5, -272, 4], [940, 3.5, -300, 4], // 1 the mine shaft
  [918, 3.5, -322, 4], [895, 3.5, -345, 5], // 2 the crystal cavern
  [875, 4, -362, 5], [858, 1.2, -372, 12], [840, 4, -360, 8], // 3 the dynamite store: blown-out track
  [834, 4, -335, 5], [840, 4, -305, 5], // 4 the underground river
  [858, 3.5, -288, 5], [876, 3, -272, 6], // 5 the cave-in
  // out into daylight and home
  [880, PL, -245, 7], [880, PL, -180, 8], [880, PL, -110, 6], [880, PL, -70, 3],
];

export function buildBoomCoaster(data) {
  const { add, box, sign, cf, mi } = helpers(data);
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const tag = (list, x, y, z) => list.push([x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const showRails = new Set(); // show-track parts (the carts' fake wheels sit on these)
  const yawOf = (dx, dz) => Math.atan2(dx, dz);
  const seg = (a, b, size, color, mat, o = {}) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    const Y = new THREE.Vector3(dx, dy, dz).normalize();
    let X = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), Y);
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
    X.normalize();
    // a part whose local Z runs from a to b
    const Zl = Y, Xl = X, Yl = new THREE.Vector3().crossVectors(Zl, Xl);
    return add([size[0], size[1], len + (o.extra || 0)], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color, mat,
      { collide: 0, ...o, rot: [Xl.x, Yl.x, Zl.x, Xl.y, Yl.y, Zl.y, Xl.z, Yl.z, Zl.z] });
  };

  // ======== the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 24 }];
  data.trees = (data.trees || []).filter((t) => !(t.pos[0] > SITE.x0 - 6 && t.pos[0] < SITE.x1 + 6 && t.pos[2] > SITE.z0 - 6 && t.pos[2] < SITE.z1 + 6));
  const vel = data.config.Lands.find((l) => l.id === 'Velocity');
  if (vel) vel.regions = [...vel.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x3e5a2c, 'Grass');
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  wallSeg(808, -400, 1004, -400);
  wallSeg(1004, -400, 1004, 236);
  wallSeg(1004, 236, 808, 236);
  // the gate from Throttle Works: a timber mine portal in the wall
  const gz = (GATE.z0 + GATE.z1) / 2;
  for (const z of [GATE.z0 + 1.4, GATE.z1 - 1.4]) box([2.2, 17, 2.2], [808, G, z], TIMBER, 'Wood');
  add([3, 2.4, GATE.z1 - GATE.z0 + 3], [808, G + 18, gz], DARKWOOD, 'Wood', { collide: 0 });
  for (const [dx, face] of [[-1.6, 'Left'], [1.6, 'Right']]) {
    sign([0.3, 3.4, 22], [808 + dx, G + 21.4, gz], 0x2a1a10, face, [['BENTON BOOM COASTER', 0, 0.02, 1, 0.6, LAMP], ['BOOM MOUNTAIN MINE  ·  EST. 1886', 0, 0.62, 1, 0.36, 0xf4ecd8, 'GothamBold']], { glow: true });
  }
  for (const z of [GATE.z0 + 1.4, GATE.z1 - 1.4]) { add([0.8, 1.2, 0.8], [806.4, G + 12, z], LAMP, 'Neon', { collide: 0 }); light(805, 12, z, LAMP); }
  // the walk from the Throttle Works plaza
  const walk = [[566, -28], [808, -28]];
  const inside = [[808, -28], [818, -28]];
  for (const r of [walk, inside]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      const len = Math.hypot(xb - xa, zb - za);
      add([9, 0.4, len + 9], [(xa + xb) / 2, 0.24, (za + zb) / 2], 0x8a8478, 'Pavement', { yaw: yawOf(xb - xa, zb - za), collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }
  // mine-car rails set into the walk, a wooden sign post
  for (let x = 580; x < 800; x += 2) add([0.25, 0.05, 1.6], [x, 0.46, -28], DARKWOOD, 'Wood', { collide: 0 });
  for (const dz of [-0.6, 0.6]) add([220, 0.08, 0.12], [690, 0.5, -28 + dz], STEEL, 'Metal', { collide: 0 });
  box([0.5, 8, 0.5], [796, G, -34], TIMBER, 'Wood');
  sign([9, 2.6, 0.3], [796, G + 8.6, -34], 0x2a1a10, 'Front', [['BENTON BOOM COASTER  →', 0, 0, 1, 1, LAMP]], { glow: true });
  sign([9, 2.6, 0.3], [796, G + 8.6, -34], 0x2a1a10, 'Back', [['← THROTTLE WORKS', 0, 0, 1, 1, LAMP]], { glow: true });
  // wait times
  box([0.6, 6, 0.6], [818, G, -36], 0x2e3238, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [818, G + 9, -36], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Left', ride: RIDE_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Velocity', seed: 53, cf: cf(814, G, -20, Math.PI / 2) });

  // ======== the track
  const track = makeTrack(CIRCUIT);
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), F = new THREE.Vector3();
  const frame = (s) => {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4); R.setFromMatrixColumn(m4, 0); U.setFromMatrixColumn(m4, 1); F.setFromMatrixColumn(m4, 2).negate();
    return { p: P.clone(), r: R.clone(), u: U.clone(), f: F.clone() };
  };
  const local = (fr, x, y) => fr.p.clone().addScaledVector(fr.r, x).addScaledVector(fr.u, y);
  const sAt = (x, z, y) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2 + (y === undefined ? 0 : (track.pos[i * 3 + 1] - y) ** 2);
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const L = track.length;
  // the gaps in the show track, where the carts "jump"
  const gaps = [[sAt(978, 104, 16) - 9, sAt(978, 104, 16) + 9], [sAt(858, -372) - 8, sAt(858, -372) + 8]];
  const inGap = (s) => gaps.some(([a, b]) => s > a && s < b);
  const dist = (a, b) => ((b - a) % L + L) % L;

  // ---- the steel track's supports: dark columns
  const pts = [];
  for (let i = 0; i < track.cum.length; i += 2) pts.push([track.pos[i * 3], track.pos[i * 3 + 1], track.pos[i * 3 + 2], track.cum[i]]);
  for (let s = 6; s < L - 6; s += 9) {
    const fr = frame(s);
    const foot = fr.p.clone().addScaledVector(fr.u, -1.4);
    if (foot.y < 3) continue;
    if (pts.some(([x, y, z, c]) => Math.abs(c - s) > 14 && y < foot.y - 1 && Math.hypot(x - foot.x, z - foot.z) < 5)) continue;
    const h = foot.y - G;
    add([1.2, h, 1.2], [foot.x, G + h / 2, foot.z], 0x3a3430, 'Metal', { shape: 5, collide: 0 });
    box([2.6, 0.7, 2.6], [foot.x, G, foot.z], 0xa8a49c, 'Concrete', { collide: 0 });
  }

  // ---- the show track: a wooden mine track under every cart, on timber
  // trestles, broken where the carts jump
  const STEP = 1.6;
  let lastL = null, lastR = null;
  const trestles = [];
  for (let s = 0; s <= L; s += STEP) {
    const fr = frame(s % L);
    const c = local(fr, BOOM.x, 1.0);
    if (inGap(s % L)) { lastL = lastR = null; continue; }
    showRails.add(add([5.4, 0.35, 0.8], [c.x, c.y, c.z], DARKWOOD, 'Wood', { collide: 0, rot: [fr.r.x, fr.u.x, -fr.f.x, fr.r.y, fr.u.y, -fr.f.y, fr.r.z, fr.u.z, -fr.f.z] }));
    const l = local(fr, BOOM.x - 1.8, 1.35), r = local(fr, BOOM.x + 1.8, 1.35);
    if (lastL) { showRails.add(seg(lastL, l, [0.3, 0.3], 0x4a4644, 'Metal', { extra: 0.1 })); showRails.add(seg(lastR, r, [0.3, 0.3], 0x4a4644, 'Metal', { extra: 0.1 })); }
    lastL = l; lastR = r;
    if (Math.round(s / STEP) % 4 === 0 && c.y > 2.6) trestles.push([c.clone(), fr.r.clone(), s % L, Math.sqrt(Math.max(0, 1 - fr.u.y * fr.u.y))]);
  }
  // broken rail ends twisted down at each gap, and the trestles
  for (const [a, b] of gaps) {
    for (const [s, dir] of [[a, 1], [b, -1]]) {
      const fr = frame(s);
      for (const dx of [-1.8, 1.8]) {
        const p0 = local(fr, BOOM.x + dx, 1.35), p1 = p0.clone().addScaledVector(fr.f, dir * 2.4).add(new THREE.Vector3(0, -1.6 + dx * 0.3, 0));
        seg(p0, p1, [0.3, 0.3], 0x4a4644, 'Metal');
      }
      const t = local(fr, BOOM.x, 1.0).addScaledVector(fr.f, dir * 1.2);
      add([5.4, 0.35, 0.8], [t.x, t.y - 1.8, t.z], DARKWOOD, 'Wood', { collide: 0, yaw: yawOf(fr.f.x, fr.f.z) + 0.4 });
    }
  }
  // (no trestle where another pass of the steel track or the carts goes by)
  const bodies = [];
  for (let s = 0; s < L; s += 1.5) { const fr = frame(s); bodies.push([local(fr, BOOM.x, 3), s]); }
  const clearOf = (p, s, topY) => !track.pos.some((_, i) => i % 3 === 0 && Math.hypot(track.pos[i] - p.x, track.pos[i + 2] - p.z) < 2.4 && track.pos[i + 1] > G + 0.5)
    && !bodies.some(([b, bs]) => dist(bs, s) > 8 && dist(s, bs) > 8 && Math.hypot(b.x - p.x, b.z - p.z) < 3.6 && b.y - 2.2 < topY);
  for (const [c, r, s, bank] of trestles) {
    for (const dx of [-2.2, 2.2]) {
      const top = c.clone().addScaledVector(r, dx).add(new THREE.Vector3(0, -0.3 - 3 * bank, 0));
      if (top.y < 1 || !clearOf(top, s, top.y)) continue;
      add([0.5, top.y - G, 0.5], [top.x, G + (top.y - G) / 2, top.z], TIMBER, 'Wood', { collide: 0 });
    }
    if (c.y > 6 && clearOf(c.clone().addScaledVector(r, -2.2), s, c.y) && clearOf(c.clone().addScaledVector(r, 2.2), s, c.y)) {
      const a = c.clone().addScaledVector(r, -2.2), b = c.clone().addScaledVector(r, 2.2);
      seg(new THREE.Vector3(a.x, G + 1, a.z), new THREE.Vector3(b.x, c.y - 1, b.z), [0.3, 0.3], TIMBER, 'Wood');
    }
  }

  // ---- the station: a timber mine-loading shed
  const px0 = 864, px1 = 872.6, sz0 = -72, sz1 = -32;
  box([px1 - px0, PLAT - G, sz1 - sz0], [(px0 + px1) / 2, G, (sz0 + sz1) / 2], 0x6a5038, 'WoodPlanks');
  add([0.4, 0.06, sz1 - sz0], [px1 - 0.3, PLAT + 0.03, (sz0 + sz1) / 2], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  for (let k = 0; k < 3; k++) box([px1 - px0, PLAT - G - k * 1.2, 1.4], [(px0 + px1) / 2, G, sz1 + 0.7 + k * 1.4], 0x6a5038, 'WoodPlanks');
  for (const x of [861, 891]) for (let z = -76; z <= -26; z += 10) box([0.8, 14, 0.8], [x, G, z], TIMBER, 'Wood');
  add([34, 0.6, 54], [876, G + 14.3, -51], 0x5a5048, 'Metal', { collide: 0 });
  for (const x of [861, 891]) add([0.6, 1, 54], [x, G + 13.6, -51], DARKWOOD, 'Wood', { collide: 0 });
  sign([20, 3, 0.4], [876, G + 12.2, -26], 0x2a1a10, 'Back', [['BOOM MOUNTAIN MINE  ·  LOADING', 0, 0, 1, 0.6, LAMP], ['ALL CARTS RUN AT THE RIDER\'S OWN RISK', 0, 0.6, 1, 0.4, 0xf4ecd8, 'GothamBold']], { glow: true });
  for (let z = -70; z <= -34; z += 9) { add([0.6, 0.9, 0.6], [868, G + 12.6, z], LAMP, 'Neon', { collide: 0 }); light(868, 10, z, LAMP); }
  const con = [865.4, -68];
  box([1.4, 3, 2.4], [con[0], PLAT, con[1]], 0x3a3e44, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 3.25, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  add([1, 1.6, 1], [865, PLAT + 0.8, -60], TNT, 'SmoothPlastic', { collide: 0 }); // a TNT plunger by the console
  add([0.15, 1, 0.15], [865, PLAT + 2.1, -60], IRON, 'Metal', { collide: 0 });

  // ---- the queue: a switchback under a timber shed, then down to the platform
  const ROWZ = [-22, -16, -10, -4, 2, 8, 14, 20];
  const fwd = [[812, -28], [822, -28], [822, ROWZ[0]]];
  ROWZ.forEach((z, k) => {
    const east = k % 2 === 0;
    if (k > 0) fwd.push([east ? 824 : 856, z]);
    fwd.push([east ? 856 : 824, z]);
  });
  fwd.push([859, ROWZ[ROWZ.length - 1]], [859, -29], [866, -29]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 3, [-1, 0], G + 0.2);
  for (let k = 0; k < ROWZ.length - 1; k++) {
    const z = (ROWZ[k] + ROWZ[k + 1]) / 2, xa = k % 2 === 0 ? 821 : 827, xb = k % 2 === 0 ? 853 : 857;
    add([xb - xa, 0.3, 0.3], [(xa + xb) / 2, G + 3, z], TIMBER, 'Wood', { collide: 0 });
    for (let x = xa; x <= xb; x += 4) box([0.4, 3.2, 0.4], [x, G, z], DARKWOOD, 'Wood');
  }
  add([40, 0.3, 50], [840, G + 0.1, -1], 0x7a6a54, 'WoodPlanks', { collide: 0 });
  for (const x of [819, 861]) for (let z = -24; z <= 24; z += 12) box([0.7, 12, 0.7], [x, G, z], TIMBER, 'Wood');
  add([44, 0.5, 52], [840, G + 12.2, 0], 0x5a5048, 'Metal', { collide: 0 });
  // mining props along the queue: carts, ore, lanterns, TNT crates
  for (const [x, z] of [[818, 8], [818, -8], [862, 6], [830, 26]]) {
    box([3.6, 2, 2.4], [x, G + 0.6, z], RUST, 'Metal', { collide: 0 });
    for (let k = 0; k < 4; k++) add([1, 1, 1], [x - 1.2 + (k % 2) * 2.4, G + 2.9, z - 0.4 + Math.floor(k / 2) * 0.8], [0x8a7a5a, 0xc8a040][k % 2], 'Slate', { shape: 3, collide: 0 });
  }
  for (let x = 826; x < 856; x += 10) for (const z of [-19, 17]) { add([0.5, 0.8, 0.5], [x, G + 11, z], LAMP, 'Neon', { collide: 0 }); }
  light(840, 10, 0, LAMP);
  for (const [x, z] of [[835, 27], [845, 27]]) { box([2.2, 1.6, 1.6], [x, G, z], TNT, 'Wood', { collide: 0 }); sign([2, 0.8, 0.1], [x, G + 0.8, z - 0.85], TNT, 'Front', [['TNT', 0, 0, 1, 1, 0xffffff, 'GothamBold']]); }
  sign([16, 3, 0.3], [840, G + 10, 25], 0x2a1a10, 'Front', [['BOOM MOUNTAIN MINE', 0, 0, 1, 0.6, LAMP], ['THE TRACK AHEAD IS... MOSTLY THERE', 0, 0.6, 1, 0.4, 0xf4ecd8, 'GothamBold']], { glow: true });

  // ======== Boom Mountain: the dark ride, inside a rocky mountain
  const M = MTN, mcx = (M.x0 + M.x1) / 2, mcz = (M.z0 + M.z1) / 2;
  add([M.x1 - M.x0, 0.4, M.z1 - M.z0], [mcx, G + 0.2, mcz], 0x2a2018, 'Slate');
  const portals = [[953, 9], [877, 9]];
  const rockWall = (xa, za, xb, zb) => add([2, M.H, Math.hypot(xb - xa, zb - za)], [(xa + xb) / 2, G + M.H / 2, (za + zb) / 2], ROCKD, 'Slate', { yaw: yawOf(xb - xa, zb - za) });
  rockWall(M.x0, M.z0, M.x0, M.z1);
  rockWall(M.x1, M.z0, M.x1, M.z1);
  rockWall(M.x0, M.z0, M.x1, M.z0);
  // the north face, open at the two portals
  const cuts = portals.map(([x, w]) => [x - w, x + w]).sort((a, b) => a[0] - b[0]);
  let x0 = M.x0;
  for (const [a, b] of cuts) { add([b - x0 > 0 ? a - x0 : 0, M.H, 2], [(x0 + a) / 2, G + M.H / 2, M.z1], ROCKD, 'Slate'); x0 = b; }
  add([M.x1 - x0, M.H, 2], [(x0 + M.x1) / 2, G + M.H / 2, M.z1], ROCKD, 'Slate');
  for (const [x, w] of portals) add([2 * w, M.H - 15, 2], [x, G + 15 + (M.H - 15) / 2, M.z1], ROCKD, 'Slate');
  add([M.x1 - M.x0 + 2, 1, M.z1 - M.z0 + 2], [mcx, G + M.H + 0.5, mcz], ROCKD, 'Slate', { collide: 0 });
  // the mountain itself: boulders heaped over the building, a few peaks
  for (let k = 0; k < 70; k++) {
    const x = M.x0 + ((k * 37) % 100) / 100 * (M.x1 - M.x0), z = M.z0 + ((k * 61) % 100) / 100 * (M.z1 - M.z0), s = 10 + (k % 5) * 4;
    add([s, s * 0.7, s * 0.9], [x, G + M.H + s * 0.2, z], [ROCK, ROCKD, 0x5a4634][k % 3], 'Slate', { collide: 0, yaw: k * 0.7 });
  }
  for (const [x, z, h] of [[870, -330, 30], [930, -300, 24], [960, -360, 20]]) for (let k = 0; k < 4; k++) add([22 - k * 5, 8, 20 - k * 5], [x, G + M.H + 4 + k * 7, z], [ROCK, ROCKD][k % 2], 'Slate', { collide: 0, yaw: k * 0.5 + h });
  for (let k = 0; k < 30; k++) { // rock skin on the north face
    const x = M.x0 + 4 + (k * 6.1) % (M.x1 - M.x0 - 8);
    if (portals.some(([px, w]) => Math.abs(x - px) < w + 3)) continue;
    add([7, 6 + (k % 4) * 3, 2.4], [x, G + 4 + (k % 5) * 5, M.z1 + 1.4], [ROCK, ROCKD, 0x5a4634][k % 3], 'Slate', { collide: 0, yaw: (k % 3) * 0.3 - 0.3 });
  }
  // the portals: timber frames, lanterns, BOOM MOUNTAIN on a board
  for (const [x, w] of portals) {
    for (const dx of [-w + 0.6, w - 0.6]) box([1.2, 15, 1.2], [x + dx, G, M.z1 + 1.6], TIMBER, 'Wood', { collide: 0 });
    add([2 * w + 2, 1.4, 1.4], [x, G + 15.6, M.z1 + 1.6], TIMBER, 'Wood', { collide: 0 });
    for (const dx of [-w - 1, w + 1]) { add([0.7, 1, 0.7], [x + dx, G + 11, M.z1 + 2.6], LAMP, 'Neon', { collide: 0 }); light(x + dx, 10, M.z1 + 4, LAMP); }
  }
  sign([30, 6, 0.4], [915, G + 21, M.z1 + 2.6], 0x2a1a10, 'Back', [['BOOM MOUNTAIN', 0, 0.05, 1, 0.6, LAMP], ['DANGER  ·  BLASTING IN PROGRESS', 0, 0.68, 1, 0.3, TNT, 'GothamBold']], { glow: true });
  // inside: timber shoring along the track all the way through
  const inMtn = (p, pad = 0) => p.x > M.x0 + pad && p.x < M.x1 - pad && p.z > M.z0 + pad && p.z < M.z1 - pad;
  const sIn = [];
  for (let s = 0; s < L; s += 7) { const fr = frame(s); if (inMtn(fr.p, 4) && !inGap(s)) sIn.push([s, fr]); }
  for (const [s, fr] of sIn) {
    const a = local(fr, -2.8, 0), b = local(fr, BOOM.x + 3.9, 0);
    const near = (p) => pts.some(([x, y, z, c]) => dist(c, s) > 20 && dist(s, c) > 20 && Math.hypot(x - p.x, z - p.z) < 9);
    if (near(a) || near(b)) continue;
    for (const p of [a, b]) add([1, 12, 1], [p.x, G + 6, p.z], TIMBER, 'Wood', { collide: 0 });
    seg(new THREE.Vector3(a.x, G + 12.4, a.z), new THREE.Vector3(b.x, G + 12.4, b.z), [1, 1], TIMBER, 'Wood', { extra: 1 });
    if (Math.round(s / 7) % 3 === 0) { add([0.5, 0.8, 0.5], [a.x, G + 10.5, a.z], LAMP, 'Neon', { collide: 0 }); }
  }
  // 1 the mine shaft: lanterns, a miner's lift cage, ore carts
  const sc = (x, z) => frame(sAt(x, z));
  const beside = (x, z, dx, dy = 0) => local(sc(x, z), dx, dy);
  { const p = beside(948, -275, -7); box([5, 14, 5], [p.x, G, p.z], IRON, 'Metal', { collide: 0 }); add([4.4, 4, 4.4], [p.x, G + 6, p.z], RUST, 'Metal', { collide: 0, trans: 0.3 }); light(p.x, 8, p.z, LAMP); }
  { const p = beside(948, -285, BOOM.x + 7); box([4, 2.2, 2.6], [p.x, G + 0.4, p.z], RUST, 'Metal', { collide: 0 }); for (let k = 0; k < 4; k++) add([1, 1, 1], [p.x - 1 + (k % 2) * 2, G + 3, p.z - 0.4 + Math.floor(k / 2) * 0.8], 0xc8a040, 'Slate', { shape: 3, collide: 0 }); }
  sign([0.3, 2.4, 9], [MTN.x1 - 1.4, G + 9, -280], 0x2a1a10, 'Left', [['SHAFT 7  ·  1,000 FT', 0, 0, 1, 1, LAMP, 'GothamBold']], { glow: true });
  // 2 the crystal cavern: glowing crystals in clusters
  for (let k = 0; k < 26; k++) {
    const side = k % 2 ? -6.5 : BOOM.x + 7, along = -12 + (k % 13) * 2;
    const fr = frame(sAt(918, -322) + along), p = local(fr, side + ((k * 7) % 3) - 1, 0);
    const h = 3 + (k % 5) * 1.6, a = ((k * 37) % 10) / 10 - 0.5;
    add([0.9 + (k % 3) * 0.3, h, 0.9 + (k % 3) * 0.3], [p.x, G + h / 2, p.z], k % 3 ? CRYSTAL : AMETHYST, 'Neon', { collide: 0, rot: [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1] });
  }
  light(918, 10, -322, CRYSTAL);
  light(900, 8, -338, AMETHYST);
  // 3 the dynamite store: TNT crates, a plunger, and the blown-out track
  for (let k = 0; k < 10; k++) {
    const fr = frame(sAt(875, -362) - 6 + k * 1.2), p = local(fr, k % 2 ? -5 : BOOM.x + 5.5, 0);
    box([2.2, 1.6, 1.6], [p.x, G + Math.floor(k / 4) * 0.2, p.z], TNT, 'Wood', { collide: 0 });
  }
  { const p = beside(858, -372, 0, 0); add([18, 0.3, 14], [p.x + 2, G + 0.2, p.z], 0xff6a10, 'Neon', { collide: 0 }); light(p.x, 3, p.z, 0xff6a10); tag(data.tags.SteamVent, p.x, G + 0.5, p.z); }
  for (let k = 0; k < 12; k++) { const fr = frame(sAt(858, -372) - 6 + k), p = local(fr, k % 2 ? -6.5 - (k % 3) : BOOM.x + 5 + (k % 3), 0); add([1.6, 1.2, 1.4], [p.x, G + 0.8, p.z], ROCKD, 'Slate', { collide: 0, yaw: k }); }
  sign([0.3, 3, 12], [MTN.x0 + 1.4, G + 10, -366], 0x2a1a10, 'Right', [['DYNAMITE STORE', 0, 0, 1, 0.55, TNT], ['NO SMOKING  ·  NO SPARKS  ·  NO KIDDING', 0, 0.58, 1, 0.42, 0xf4ecd8, 'GothamBold']], { glow: true });
  // 4 the underground river: water, a waterfall, mist
  { const p = beside(834, -335, -6, 0); add([8, 0.3, 40], [p.x, G + 0.3, -330], WATER, 'Neon', { collide: 0, trans: 0.2 }); add([0.6, 14, 8], [M.x0 + 1.6, G + 7, -330], 0x8ac8ff, 'Neon', { collide: 0, trans: 0.3 }); tag(data.tags.SteamVent, p.x, G + 0.5, -330); light(p.x, 8, -330, WATER); }
  // 5 the cave-in: rubble heaps, a toppled support, falling rocks
  for (let k = 0; k < 8; k++) { const p = beside(866, -280, k % 2 ? -6 : BOOM.x + 6, 0); add([3 - (k % 3) * 0.5, 2 + (k % 3), 3], [p.x + ((k * 7) % 5) - 2, G + 1, p.z + ((k * 3) % 7) - 3], ROCK, 'Slate', { collide: 0, yaw: k * 0.9 }); }
  { const p = beside(866, -280, -5, 0); add([1, 12, 1], [p.x, G + 3, p.z], TIMBER, 'Wood', { collide: 0, rot: [Math.cos(1.1), -Math.sin(1.1), 0, Math.sin(1.1), Math.cos(1.1), 0, 0, 0, 1] }); }
  light(866, 9, -280, 0xff8a40);
  light(880, 12, -262, 0xfff4d0);

  // ======== outside: the ravine where the bridge is out, pines, a water tower
  const jf = frame(sAt(978, 104, 16));
  {
    const c = local(jf, BOOM.x / 2, 0);
    const yaw = yawOf(jf.f.x, jf.f.z);
    add([22, 0.3, 20], [c.x, G + 0.25, c.z], 0x0a0806, 'Slate', { collide: 0, yaw });
    add([20, 0.2, 4], [c.x, G + 0.45, c.z], WATER, 'Neon', { collide: 0, yaw: yaw + Math.PI / 2, trans: 0.3 });
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
      const p = local(jf, BOOM.x / 2 + side * (13 + (k % 2) * 2), 0).addScaledVector(jf.f, -8 + k * 4);
      add([4, 7 + (k % 3) * 3, 5], [p.x, G + 3.5 + (k % 3) * 1.5, p.z], [ROCK, ROCKD][k % 2], 'Slate', { collide: 0, yaw: yaw + k * 0.4 });
    }
    // a wrecked mine cart at the bottom, on its side
    const w = local(jf, BOOM.x + 3, 0);
    add([4, 2.4, 3], [w.x, G + 1.2, w.z], RUST, 'Metal', { collide: 0, rot: [Math.cos(1.3), -Math.sin(1.3), 0, Math.sin(1.3), Math.cos(1.3), 0, 0, 0, 1] });
    const bs = local(frame(gaps[0][0] - 6), BOOM.x + 6, 0);
    box([0.4, 6, 0.4], [bs.x, G, bs.z], TIMBER, 'Wood', { collide: 0 });
    add([5, 2.4, 0.3], [bs.x, G + 6.4, bs.z], 0xf2c818, 'SmoothPlastic', { collide: 0, yaw: yawOf(jf.f.x, jf.f.z) + Math.PI / 2 });
    sign([4.6, 2, 0.1], [bs.x, G + 6.4, bs.z], 0xf2c818, 'Front', [['BRIDGE OUT!', 0, 0, 1, 1, TNT, 'GothamBold']], { yaw: yawOf(jf.f.x, jf.f.z) + Math.PI / 2 });
    sign([4.6, 2, 0.1], [bs.x, G + 6.4, bs.z], 0xf2c818, 'Back', [['BRIDGE OUT!', 0, 0, 1, 1, TNT, 'GothamBold']], { yaw: yawOf(jf.f.x, jf.f.z) + Math.PI / 2 });
  }
  // a water tower and an ore crusher by the lift hill
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box([0.6, 16, 0.6], [845 + dx, G, 60 + dz], TIMBER, 'Wood', { collide: 0 });
  add([9, 7, 9], [845, G + 19.5, 60], 0x7a5a3a, 'WoodPlanks', { shape: 5, collide: 0 });
  add([10, 1.2, 10], [845, G + 23.6, 60], 0x5a3a24, 'Wood', { shape: 5, collide: 0 });
  box([12, 10, 10], [930, G, 60], 0x6a5038, 'WoodPlanks', { collide: 0 });
  add([13, 1, 11], [930, G + 10.5, 60], 0x5a5048, 'Metal', { collide: 0, rot: [Math.cos(0.15), -Math.sin(0.15), 0, Math.sin(0.15), Math.cos(0.15), 0, 0, 0, 1] });
  sign([10, 2, 0.2], [930, G + 7, 54.9], 0x2a1a10, 'Front', [['ORE CRUSHER No. 2', 0, 0, 1, 1, LAMP, 'GothamBold']]);
  // pines wherever there's room
  const nearAny = (x, z, r) => pts.some(([px, , pz]) => Math.hypot(px - x, pz - z) < r);
  for (let k = 0; k < 90; k++) {
    const x = SITE.x0 + 6 + ((k * 53) % 100) / 100 * (SITE.x1 - SITE.x0 - 12), z = SITE.z0 + 6 + ((k * 71) % 100) / 100 * (SITE.z1 - SITE.z0 - 12);
    if (z < M.z1 + 10 || nearAny(x, z, 15)) continue;
    if (x < 864 && z > -40 && z < 32) continue; // the queue
    if (x > 840 && x < 896 && z > -80 && z < -24) continue; // the station
    if (Math.hypot(x - 845, z - 60) < 9 || Math.hypot(x - 930, z - 60) < 10) continue;
    data.trees.push({ leaf: 0x2a4a26, kind: 'pine', s: 1 + ((k * 13) % 7) / 10, pos: [x, 0, z] });
  }
  for (const [x, z] of [[830, -45], [900, -10], [900, -100], [845, -150], [915, -220]]) {
    box([0.5, 10, 0.5], [x, G, z], TIMBER, 'Wood');
    add([1.2, 1.2, 1.2], [x, G + 10.6, z], LAMP, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 10.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ======== the cars: a bogie on the steel track, a curved boom, a mine cart
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const bx = BOOM.x;
  const carParts = (k) => {
    const p = [];
    // the bogie and its wheels, on the real rails
    p.push(pp(0, [2.6, 0.9, 5], [0, -0.2, 0], 0x3a3e44, 'Metal'));
    for (const [x, z] of [[-1.3, -1.8], [1.3, -1.8], [-1.3, 1.8], [1.3, 1.8]]) p.push(pp(2, [0.4, 0.9, 0.9], [x, -0.5, z], 0xb8bcc4, 'Metal'));
    // the boom: up from the bogie, curving over and down to the cart's side
    p.push(pp(0, [1, 3.6, 1.6], [1.2, 1.9, 0.4], STEEL, 'Metal'));
    p.push(pp(0, [1, 1.6, 1.6], [1.55, 4.1, 0.4], STEEL, 'Metal', rz(-0.5)));
    p.push(pp(0, [1.4, 1, 1.6], [2.3, 4.75, 0.4], STEEL, 'Metal', rz(-0.15)));
    p.push(pp(0, [1, 1.4, 1.6], [2.9, 4.2, 0.4], STEEL, 'Metal', rz(0.45)));
    p.push(pp(0, [0.3, 1.6, 2.4], [2.95, 3.4, 0.4], IRON, 'Metal'));
    // the mine cart: a rusty iron tub with iron bands, wooden seats
    p.push(pp(0, [4.4, 0.4, 6.2], [bx, 2.2, 0], RUST, 'Metal'));
    for (const sd of [-1, 1]) {
      p.push(pp(0, [0.35, 2.3, 6.2], [bx + sd * 2.05, 3.45, 0], RUST, 'Metal'));
      for (const y of [2.6, 4.45]) p.push(pp(0, [0.4, 0.25, 6.3], [bx + sd * 2.07, y, 0], IRON, 'Metal'));
      for (const z of [-2.2, 2.2]) {
        p.push(pp(2, [0.45, 1.5, 1.5], [bx + sd * 2.45, 1.95, z], 0x1a1a1a, 'Metal')); // fake wheels on the show rails
        p.push(pp(2, [0.5, 0.5, 0.5], [bx + sd * 2.5, 1.95, z], 0xb8a060, 'Metal'));
      }
    }
    for (const sd of [-1, 1]) p.push(pp(0, [4.4, 2.3, 0.35], [bx, 3.45, sd * 3.05], RUST, 'Metal'));
    p.push(pp(0, [4.5, 0.25, 0.4], [bx, 4.45, -3.07], IRON, 'Metal'));
    // headlamps (the cart's "eyes")
    for (const dx of [-1, 1]) {
      p.push(pp(2, [0.3, 1.1, 1.1], [bx + dx * 1.05, 3.6, -3.3], IRON, 'Metal', [0, 0, 1, 0, 1, 0, -1, 0, 0]));
      p.push(pp(2, [0.1, 0.8, 0.8], [bx + dx * 1.05, 3.6, -3.46], k === 0 ? 0xffe070 : LAMP, 'Neon', [0, 0, 1, 0, 1, 0, -1, 0, 0]));
    }
    for (const [z, y] of [[-1.3, 2.6], [1.3, 2.9]]) {
      for (const x of [bx - 0.95, bx + 0.95]) {
        p.push(pp(0, [1.6, 0.4, 1.4], [x, y, z], 0x6a4a30, 'WoodPlanks'));
        p.push(pp(0, [1.6, 1.6, 0.3], [x, y + 0.95, z + 0.8], 0x6a4a30, 'WoodPlanks'));
      }
    }
    return p;
  };
  const seatList = () => {
    const seats = [];
    for (const [z, y] of [[-1.3, 2.6], [1.3, 2.9]]) for (const x of [bx - 0.95, bx + 0.95]) seats.push([x, y + 0.2 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return seats;
  };
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }

  // ---- the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(px1 - 1.2, PLAT, P.z, -Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 1, routes: [[1, 2, 3, 4]],
    console: cf(con[0], PLAT, con[1], -Math.PI / 2),
    operator: cf(con[0] + 1.4, PLAT, con[1], -Math.PI / 2),
    homes: [cf(px0 + 2.4, PLAT, -64, -Math.PI / 2)],
    exit: cf(px0 + 1.4, PLAT, -40, Math.PI / 2),
  };

  // ---- the ride
  const origin = [915, 0, -100];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: 0x3a3430 }, extras: {}, extrasNames: [], crew,
  };
  data.rides.push(ride);
  const at = (x, z, y) => {
    const s = sAt(x, z, y);
    const i = track.cum.findIndex((c) => c >= s);
    return track.times[Math.max(0, i)] / ride.duration;
  };
  // sparks as the carts "land" each jump, the dynamite going off, the cave-in
  const cues = [
    [at(978, 104, 16), 'sparks', [bx, 1.5, 2]], [at(974, 82), 'sparks', [bx, 1.5, -2]],
    [at(875, -362), 'explosion', [bx + 4, 6, -14]], [at(858, -372), 'fire', [bx, 0, 0]], [at(840, -360), 'sparks', [bx, 1.5, -2]],
    [at(858, -288), 'explosion', [-6, 8, -10]], [at(881, 68, 38), 'sparks', [bx, 1.5, 0]],
  ];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Velocity') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Benton Boom Coaster', land: 'Velocity', category: 'Thrill', thrill: 4, kind: 'coaster', carStyle: 'coaster',
    description: 'A runaway mine train on a steel boom coaster: each mine cart hangs off a curved boom beside the real track, riding a rickety wooden mine track - until the track runs out and the carts jump the gap. Up the lift hill, over the ravine where the bridge is out, then into Boom Mountain: the mine shaft, the crystal cavern, the dynamite store, the underground river and the cave-in.',
    baseWait: 70, origin, entrance: [816, 0, -28], exit: [845, 0, -45], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [RUST, IRON, LAMP], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Benton Boom Coaster is open - mind the gaps!', 'The bridge is out at Boom Mountain. Ride anyway!'];
  return { ride, showRails, gate: { x: 808, z: gz }, indoor: { x0: M.x0, x1: M.x1, z0: M.z0, z1: M.z1 } };
}

// a toast the first time you walk up to the new ride
export class BoomCoasterSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 40) {
      this.told = true;
      this.hooks.toast('BENTON BOOM COASTER is now open! A runaway mine train on a steel boom coaster - the carts jump the gaps where the track is out. Through the gate past Throttle Works.', 'reward');
    }
  }
}
