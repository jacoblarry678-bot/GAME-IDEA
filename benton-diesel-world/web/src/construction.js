// The new ride beside Diesel Thunder, nearly finished. It is too big for the
// park, so a stretch of the west wall has come down and the site runs out
// onto the hills beyond. Behind the construction walls the coaster track is
// complete (a test train with water dummies runs it all day), the giant
// switchback queue is finished under its shade sails, and the ride's themed
// station has gone up: Benton Engine Works, an old brick diesel engine
// factory with a sawtooth roof and smoking chimneys.
import * as THREE from 'three';
import { buildModel } from './geom.js';
import { Sampler } from './rides.js';

// the strip inside the park, and the much bigger part beyond the wall
export const SITE = { x0: -376, x1: -357, z0: -84, z1: -4 };
export const OUT = { x0: -560, x1: -375, z0: -140, z1: 24 };
const FLOOR = 0.2;
const WALL_H = 12;
const G = 35; // gravity, studs/s²
const TRACK = 0xd2501c, SUPPORT = 0x2e3238;
const BUILDING = { x0: -426, x1: -366, z0: -82, z1: -44, h: 26 };
const QUEUE = { x0: -552, x1: -432, z0: -34, z1: 14 };

// the circuit, in the order the train runs it (x, y, z of the rails)
const CIRCUIT = [
  [-410, 4, -72], [-420, 4, -72], [-432, 5, -72], // station, out of the building
  [-442, 8, -72], [-472, 40, -72], [-503, 73, -72], [-514, 79, -72], [-524, 79, -74], // lift hill
  [-533, 73, -82], [-541, 56, -96], [-542, 33, -112], [-533, 13, -126], [-514, 6, -133], // turning first drop
  [-492, 14, -134], [-470, 48, -134], [-452, 50, -133], [-432, 22, -131], [-414, 12, -127], // camelback
  [-399, 16, -118], [-394, 22, -105], [-401, 26, -94], [-420, 28, -94], // turnaround
  [-444, 22, -97], [-466, 26, -99], [-486, 22, -95], [-496, 16, -84], [-497, 12, -72], // under the lift
  [-499, 18, -52], [-502, 30, -24], [-494, 35, 0], [-476, 30, 8], [-460, 26, 0], // over the queue
  [-456, 22, -16], [-458, 16, -34], [-452, 10, -47], [-440, 5, -52], [-426, 4, -52], // brakes
  [-404, 4, -52], [-386, 4, -52], [-377, 4, -56], [-375, 4, -62], [-377, 4, -68], [-386, 4, -72], [-398, 4, -72],
];

// Closed centripetal Catmull-Rom spline through the circuit, with banking
// from the speed a train would carry and the time it takes to get there.
function makeTrack(pts) {
  const n = pts.length;
  const V = pts.map((p) => new THREE.Vector3(...p));
  const pos = [];
  for (let i = 0; i < n; i++) {
    const p0 = V[(i - 1 + n) % n], p1 = V[i], p2 = V[(i + 1) % n], p3 = V[(i + 2) % n];
    const t1 = Math.sqrt(p0.distanceTo(p1)), t2 = t1 + Math.sqrt(p1.distanceTo(p2)), t3 = t2 + Math.sqrt(p2.distanceTo(p3));
    const steps = Math.max(6, Math.ceil(p1.distanceTo(p2) / 0.8));
    for (let k = 0; k < steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps;
      const a1 = p0.clone().multiplyScalar((t1 - t) / t1).addScaledVector(p1, t / t1);
      const a2 = p1.clone().multiplyScalar((t2 - t) / (t2 - t1)).addScaledVector(p2, (t - t1) / (t2 - t1));
      const a3 = p2.clone().multiplyScalar((t3 - t) / (t3 - t2)).addScaledVector(p3, (t - t2) / (t3 - t2));
      const b1 = a1.multiplyScalar((t2 - t) / t2).addScaledVector(a2, t / t2);
      const b2 = a2.clone().multiplyScalar((t3 - t) / (t3 - t1)).addScaledVector(a3, (t - t1) / (t3 - t1));
      pos.push(b1.multiplyScalar((t2 - t) / (t2 - t1)).addScaledVector(b2, (t - t1) / (t2 - t1)));
    }
  }
  pos.push(pos[0].clone());
  const m = pos.length;
  const cum = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + pos[i].distanceTo(pos[i - 1]));
  const L = cum[m - 1];
  const tan = pos.map((_, i) => {
    const a = pos[i === 0 ? m - 2 : i - 1], b = pos[i === m - 1 ? 1 : i + 1];
    return b.clone().sub(a).normalize();
  });

  // speeds: rolling out of the station, up the chain, then free running
  // with a little friction until the brakes, then easing into the station
  let crest = 0;
  for (let i = 0; i < m; i++) if (pos[i].y > pos[crest].y) crest = i;
  let liftStart = 0;
  while (pos[liftStart].x > -436) liftStart++;
  let brake = crest;
  while (brake < m - 2 && !(pos[brake].x > -446 && pos[brake].z < -46 && pos[brake].z > -58)) brake++;
  const yC = pos[crest].y, sC = cum[crest];
  const v0 = 81 + 2 * G * (yC - pos[brake].y);
  const mu = (v0 - 26 * 26) / (cum[brake] - sC);
  const v = cum.map((s, i) => {
    if (i < liftStart) return Math.min(7, Math.max(2, Math.sqrt(4 * s + 4)));
    if (i <= crest) return 9;
    if (i < brake) return Math.sqrt(Math.max(36, 81 + 2 * G * (yC - pos[i].y) - mu * (s - sC)));
    const after = s - cum[brake];
    const slowed = Math.max(8, 26 - after * 1.6);
    return Math.max(0.8, Math.min(slowed, Math.sqrt(2 * 1.1 * (L - s))));
  });
  const times = [0];
  for (let i = 1; i < m; i++) times.push(times[i - 1] + (cum[i] - cum[i - 1]) / ((v[i] + v[i - 1]) / 2));

  // bank into the turns: tan(phi) = v² kappa / g, smoothed along the track
  const Y = new THREE.Vector3(0, 1, 0);
  const phi = pos.map((_, i) => {
    if (i < liftStart) return 0;
    const a = tan[i === 0 ? m - 2 : i - 1], b = tan[i === m - 1 ? 1 : i + 1];
    const ds = (cum[i === m - 1 ? 1 : i + 1] - cum[i === 0 ? m - 2 : i - 1] + (i === 0 || i === m - 1 ? L : 0)) || 1;
    const ha = Math.atan2(a.x, a.z), hb = Math.atan2(b.x, b.z);
    let dh = hb - ha;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const flat = Math.hypot(tan[i].x, tan[i].z);
    const kappa = (-dh / ds) * flat; // turning right is positive
    return THREE.MathUtils.clamp(Math.atan((v[i] * v[i] * kappa) / G), -1.25, 1.25);
  });
  const W = 14;
  const smooth = phi.map((_, i) => {
    let s = 0;
    for (let k = -W; k <= W; k++) s += phi[(i + k + (m - 1)) % (m - 1)];
    return s / (2 * W + 1);
  });
  const up = pos.map((_, i) => {
    const t = tan[i];
    const u0 = Y.clone().addScaledVector(t, -t.dot(Y)).normalize();
    const r0 = new THREE.Vector3().crossVectors(t, u0);
    return u0.multiplyScalar(Math.cos(smooth[i])).addScaledVector(r0, Math.sin(smooth[i]));
  });
  const flatArr = (vs) => vs.flatMap((p) => [p.x, p.y, p.z]);
  return { length: L, cum, pos: flatArr(pos), tan: flatArr(tan), up: flatArr(up), times, liftStart: cum[liftStart], crest: sC };
}

export function buildConstruction(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const rec = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), 0, collide];
  };
  const add = (...a) => { data.static.push(rec(...a)); return data.static.length - 1; };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, face, font = 'GothamBlack') => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0 });
    data.signs.push({ part: i, face, glow: false, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
  };
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const { x0, x1, z0, z1 } = SITE;
  const cz = (z0 + z1) / 2;

  // open the west wall where the site crosses it, and clear the scenery
  // (part-built trees) and trees beyond it
  data.hidden = data.hidden || [];
  const hide = (i) => { data.static[i][19] = 0; data.hidden.push(i); };
  data.static.forEach((p, i) => {
    const onWall = Math.abs(p[4] + 375) < 0.5;
    const isWall = onWall && p[3] > 600; // the west wall and its cap
    const pillar = onWall && Math.abs(p[1] - 4.5) < 0.01 && p[6] > z0 - 1 && p[6] < z1 - 2.5;
    const scenery = p[4] < -377 && inRect(p[4], p[6], OUT, 6);
    if (isWall || pillar || scenery) hide(i);
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  for (const [za, zb] of [[-405, z0 - 1], [z1 + 1, 280]]) {
    add([2.5, 14, zb - za], [-375, 7, (za + zb) / 2], STONE, 'Concrete');
    add([3.4, 1, zb - za + 1], [-375, 14.5, (za + zb) / 2], CAP, 'Concrete');
  }
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6) && !inRect(t.pos[0], t.pos[2], OUT, 8));
  // the terrain is leveled under the site
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 26 }, { ...OUT, margin: 26 }];

  // graded ground, now mostly finished: packed dirt with paved areas
  for (const r of [SITE, OUT]) add([r.x1 - r.x0, 1, r.z1 - r.z0], [(r.x0 + r.x1) / 2, FLOOR - 0.5, (r.z0 + r.z1) / 2], 0x7d6448, 'Ground');

  // construction walls: painted panels on posts, with art facing out
  const PANEL = 0x2c6a86, POST = 0x5a5e66;
  const wallRun = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za);
    const yaw = Math.atan2(xb - xa, zb - za);
    add([0.4, WALL_H, len], [(xa + xb) / 2, WALL_H / 2, (za + zb) / 2], PANEL, 'WoodPlanks', { yaw });
    add([0.6, 0.5, len], [(xa + xb) / 2, WALL_H + 0.25, (za + zb) / 2], 0xf0c440, 'SmoothPlastic', { yaw, collide: 0 });
    const n = Math.max(1, Math.round(len / 10));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      box([0.7, WALL_H + 0.6, 0.7], [xa + (xb - xa) * t, 0, za + (zb - za) * t], POST, 'Metal');
    }
  };
  wallRun(x1, z0, x1, z1); // facing the park
  wallRun(-375, z0, x1, z0);
  wallRun(-375, z1, x1, z1);
  // beyond the park wall
  wallRun(-375, OUT.z1, OUT.x0, OUT.z1);
  wallRun(OUT.x0, OUT.z1, OUT.x0, OUT.z0);
  wallRun(OUT.x0, OUT.z0, -375, OUT.z0);
  // the art on the park side (east face) and along Diesel District
  sign('COMING 2027  ·  A BRAND NEW THRILL FOR DIESEL DISTRICT', [0.2, 6, 62], [x1 + 0.35, 6.4, cz], 0x16223a, 0xf0c440, 'Right');
  sign('TRACK COMPLETE', [0.2, 2.4, 30], [x1 + 0.35, 10.6, cz - 22], 0xd66e2c, 0xffffff, 'Right');
  sign('TEST RUNS UNDERWAY', [0.2, 2.4, 30], [x1 + 0.35, 10.6, cz + 22], 0xd66e2c, 0xffffff, 'Right');
  sign('NEW RIDE - BIGGEST QUEUE IN THE PARK', [16, 3.4, 0.2], [x1 - 9, 7.5, z1 + 0.35], 0x16223a, 0xfaf3e0, 'Back');
  sign('HARD HAT AREA - AUTHORIZED PERSONNEL ONLY', [16, 3.4, 0.2], [x1 - 9, 7.5, z0 - 0.35], 0xf0c440, 0x16223a, 'Front');

  // ---- the track, its supports and the test train's circuit
  const track = makeTrack(CIRCUIT);
  data.extraTracks = [...(data.extraTracks || []), { trackStyle: { style: 'steel', color: TRACK }, track }];
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4();
  const P = new THREE.Vector3(), U = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < track.cum.length; i++) pts.push([track.pos[i * 3], track.pos[i * 3 + 1], track.pos[i * 3 + 2], track.cum[i]]);
  for (let s = 6; s < track.length - 4; s += 15) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    const foot = P.clone().addScaledVector(U, -2.1); // under the spine
    if (foot.y < 4 || inRect(foot.x, foot.z, BUILDING, 2)) continue;
    // keep clear of track running underneath
    const blocked = pts.some(([x, y, z, c]) => Math.abs(c - s) > 14 && y < foot.y - 1 && Math.hypot(x - foot.x, z - foot.z) < 4);
    if (blocked) continue;
    const h = foot.y - FLOOR + 0.6;
    const d = h > 45 ? 2.2 : h > 20 ? 1.7 : 1.3;
    add([d, h, d], [foot.x, FLOOR + h / 2, foot.z], SUPPORT, 'SmoothPlastic', { shape: 5, collide: 0 });
    box([d + 1.6, 0.6, d + 1.6], [foot.x, FLOOR, foot.z], 0xbdb8b0, 'Concrete', { collide: 0 });
    // a saddle that grips the spine
    const back = new THREE.Vector3().setFromMatrixColumn(m4, 2);
    const yaw = Math.atan2(back.x, back.z);
    add([d + 0.6, 0.8, 1.6], [foot.x, foot.y + 0.1, foot.z], SUPPORT, 'SmoothPlastic', { yaw, collide: 0 });
  }

  // ---- the finished queue: a huge switchback maze under shade sails,
  // reached by a path from the park and ending at the station's door
  const Q = QUEUE;
  add([Q.x1 - Q.x0, 0.4, Q.z1 - Q.z0], [(Q.x0 + Q.x1) / 2, FLOOR + 0.2, (Q.z0 + Q.z1) / 2], 0xbdb4a6, 'Concrete');
  add([72, 0.4, 16], [-396, FLOOR + 0.2, -22], 0xbdb4a6, 'Concrete'); // path in from the park
  add([40, 0.4, 8], [-420, FLOOR + 0.2, -39], 0xbdb4a6, 'Concrete'); // out to the station
  const RAIL = 0x3a3f46, TOP = 0xd66e2c;
  const railLine = (xa, xb, z) => {
    add([xb - xa, 0.22, 0.22], [(xa + xb) / 2, FLOOR + 3.2, z], TOP, 'SmoothPlastic', { collide: 0 });
    add([xb - xa, 0.16, 0.16], [(xa + xb) / 2, FLOOR + 1.9, z], RAIL, 'Metal', { collide: 0 });
    for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.max(1, Math.round((xb - xa) / 6))) box([0.32, 3.1, 0.32], [x, FLOOR + 0.4, z], RAIL, 'Metal');
  };
  const rows = [];
  for (let z = Q.z0 + 2.3; z < Q.z1 - 1; z += 4.6) rows.push(z);
  rows.forEach((z, k) => {
    if (k === 0) return;
    const gapEast = k % 2 === 1;
    railLine(gapEast ? Q.x0 + 1 : Q.x0 + 6, gapEast ? Q.x1 - 6 : Q.x1 - 1, z - 2.3);
  });
  railLine(Q.x0 + 1, Q.x1 - 1, Q.z1 - 0.4);
  railLine(Q.x0 + 1, Q.x1 - 8, Q.z0 + 0.4);
  // shade sails on tall posts, every other pair of rows
  const sails = [0xd66e2c, 0x2c6a86];
  for (let k = 0; k < rows.length; k += 2) {
    const z = rows[k] + 2.3;
    for (let x = Q.x0 + 2; x < Q.x1; x += 24) box([0.5, 11, 0.5], [x, FLOOR, z - 2.3], RAIL, 'Metal');
    add([Q.x1 - Q.x0 - 2, 0.3, 5], [(Q.x0 + Q.x1) / 2, FLOOR + 11, z], sails[(k / 2) % 2], 'Fabric', { collide: 0, rot: [1, 0, 0, 0, 0.995, -0.1, 0, 0.1, 0.995] });
  }
  // lamps along the queue
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  for (let x = Q.x0 + 14; x < Q.x1; x += 30) {
    for (const z of [Q.z0 - 1.2, Q.z1 + 1.2]) {
      box([0.5, 9, 0.5], [x, FLOOR, z], 0x1e222c, 'Metal');
      add([1.4, 1.4, 1.4], [x, FLOOR + 9.4, z], 0xffecbe, 'Neon', { shape: 3, collide: 0 });
      data.tags.ParkLamp.push([x, FLOOR + 9.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
  }
  // themed props: oil drums, crates and an old engine on display
  for (let k = 0; k < 8; k++) {
    const x = Q.x0 + 3 + (k % 4) * 2.6, z = Q.z1 + 4 + Math.floor(k / 4) * 2.6;
    box([2.2, 3, 2.2], [x, FLOOR, z], [0x2f6fbf, 0xc8322d, 0x3a7a3a, 0xd8a020][k % 4], 'SmoothPlastic', { shape: 5 });
  }
  for (let k = 0; k < 5; k++) box([4, 3, 4], [Q.x1 - 6 - (k % 3) * 4.4, FLOOR + Math.floor(k / 3) * 3, Q.z1 + 4.5], 0x8a6a44, 'WoodPlanks');
  const ex = -418, ez = -6;
  box([10, 1, 6], [ex, FLOOR, ez], 0x8c8780, 'Concrete');
  box([7, 4, 4], [ex, FLOOR + 1, ez], 0x2c4a3a, 'Metal');
  for (let k = 0; k < 6; k++) add([1.4, 2.2, 1.4], [ex - 2.8 + (k % 3) * 2.8, FLOOR + 6.1, ez - 1 + Math.floor(k / 3) * 2], 0x58605a, 'Metal', { shape: 5 });
  add([2.6, 2.6, 0.6], [ex + 4, FLOOR + 3.4, ez], 0x1e2024, 'Metal', { shape: 2 });
  sign('1952 BENTON B-12 DIESEL', [8, 1.2, 0.2], [ex, FLOOR + 1.6, ez + 3.05], 0x16223a, 0xf0c440, 'Back', 'GothamBold');
  // the entrance arch in the park strip
  const ax = -364, az = -22;
  for (const dz of [-7, 7]) box([2.4, 13, 2.4], [ax, FLOOR, az + dz], 0x8a3b2a, 'Brick');
  add([2.6, 3.4, 17], [ax, FLOOR + 14.6, az], 0x8a3b2a, 'Brick');
  sign('ENTRANCE  ·  OPENING 2027', [0.2, 2.2, 14], [ax - 1.4, FLOOR + 14.6, az], 0x16223a, 0xf0c440, 'Left');
  sign('ENTRANCE  ·  OPENING 2027', [0.2, 2.2, 14], [ax + 1.4, FLOOR + 14.6, az], 0x16223a, 0xf0c440, 'Right');
  sign('WAIT TIME: ---', [0.2, 2.4, 5], [ax - 2, FLOOR + 6, az - 5], 0x101418, 0xff9a30, 'Left', 'GothamBold');
  box([0.4, 5, 0.4], [ax - 2, FLOOR, az - 5], RAIL, 'Metal');

  // ---- Benton Engine Works: the themed station building
  const B = BUILDING, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  const BW = B.x1 - B.x0, BD = B.z1 - B.z0;
  const BRICK = 0x8a3b2a, DARK = 0x5e2a20, TRIM = 0xc4b8a4, VOID = 0x14110f;
  box([BW + 0.8, 2, BD + 0.8], [bx, FLOOR, bz], 0x8c8780, 'Concrete');
  box([BW, B.h, BD], [bx, FLOOR, bz], BRICK, 'Brick');
  box([BW + 1.2, 1.2, BD + 1.2], [bx, FLOOR + B.h, bz], TRIM, 'Concrete');
  // sawtooth roof, the glazing facing north
  const teeth = 5, tw = BD / teeth;
  for (let k = 0; k < teeth; k++) {
    const z = B.z0 + tw * (k + 0.5);
    add([BW - 1, 5.5, tw], [bx, FLOOR + B.h + 1.2 + 2.75, z], 0x5a5f66, 'CorrodedMetal', { shape: 1, rot: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
    add([BW - 1.4, 4.8, 0.3], [bx, FLOOR + B.h + 1.2 + 2.6, z - tw / 2 + 0.2], 0x3a5060, 'Glass', { collide: 0 });
  }
  // brick piers and tall factory windows down the long sides
  for (const [z, face] of [[B.z0, -1], [B.z1, 1]]) {
    for (let x = B.x0 + 2; x <= B.x1 - 1.9; x += 6.4) box([1.8, B.h, 1], [x, FLOOR, z + face * 0.4], DARK, 'Brick');
    for (let x = B.x0 + 5.2; x < B.x1 - 3; x += 6.4) {
      add([3.6, 11, 0.3], [x, FLOOR + 13, z + face * 0.08], 0x2a3a46, 'Glass', { collide: 0 });
      add([4.4, 0.6, 0.8], [x, FLOOR + 7.2, z + face * 0.3], TRIM, 'Concrete', { collide: 0 });
      add([4.2, 1.2, 0.6], [x, FLOOR + 19, z + face * 0.25], TRIM, 'Concrete', { collide: 0 });
    }
    add([BW, 0.8, 0.6], [bx, FLOOR + 22.6, z + face * 0.3], TRIM, 'Concrete', { collide: 0 });
  }
  // the west end: where the train rolls out to the lift and comes home
  for (const z of [-72, -52]) {
    add([0.3, 9, 8], [B.x0 - 0.1, FLOOR + 4.7, z], VOID, 'SmoothPlastic', { collide: 0 });
    add([0.8, 1.2, 9.4], [B.x0 - 0.4, FLOOR + 9.6, z], TRIM, 'Concrete', { collide: 0 });
  }
  sign('NO. 2 ERECTING SHOP', [0.2, 2, 20], [B.x0 - 0.2, FLOOR + 17, bz], 0x1a1a1c, 0xe8dcc0, 'Left', 'GothamBold');
  // the facade facing the park: name, gear emblem, clock and big doors
  sign('BENTON ENGINE WORKS', [0.2, 3.2, 46], [B.x1 + 0.2, FLOOR + 23.2, bz], 0x1a1a1c, 0xf0c440, 'Right');
  sign('EST. 1952', [0.2, 1.4, 10], [B.x1 + 0.2, FLOOR + 8.4, bz], 0x1a1a1c, 0xe8dcc0, 'Right', 'GothamBold');
  add([0.8, 10, 10], [B.x1 + 0.5, FLOOR + 15.2, bz], 0x9a8a6a, 'Metal', { shape: 2 });
  add([1, 4.4, 4.4], [B.x1 + 0.7, FLOOR + 15.2, bz], DARK, 'Metal', { shape: 2 });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    add([0.8, 2, 1.8], [B.x1 + 0.5, FLOOR + 15.2 + c * 5.4, bz + s * 5.4], 0x9a8a6a, 'Metal', { collide: 0, rot: [1, 0, 0, 0, c, -s, 0, s, c] });
  }
  for (const dz of [-14, 14]) {
    add([0.3, 10, 9], [B.x1 + 0.1, FLOOR + 5, bz + dz], VOID, 'SmoothPlastic', { collide: 0 });
    add([0.9, 1.4, 10.6], [B.x1 + 0.4, FLOOR + 10.4, bz + dz], TRIM, 'Concrete', { collide: 0 });
    add([3, 0.4, 11], [B.x1 + 1.6, FLOOR + 11.4, bz + dz], 0x2e3238, 'Metal', { collide: 0 });
  }
  // queue door on the south side
  add([7, 9, 0.3], [-406, FLOOR + 4.5, B.z1 + 0.1], VOID, 'SmoothPlastic', { collide: 0 });
  add([9, 0.4, 3.4], [-406, FLOOR + 9.6, B.z1 + 1.7], 0x2e3238, 'Metal', { collide: 0 });
  sign('QUEUE', [6, 1.4, 0.2], [-406, FLOOR + 11, B.z1 + 0.3], 0x1a1a1c, 0xf0c440, 'Back', 'GothamBold');
  // two tall chimneys at the park end, gently smoking
  data.tags.SteamVent = data.tags.SteamVent || [];
  for (const z of [B.z0 + 4, B.z1 - 4]) {
    const x = B.x1 - 4;
    add([5, 58, 5], [x, FLOOR + 29, z], DARK, 'Brick', { shape: 5 });
    add([5.8, 2, 5.8], [x, FLOOR + 57, z], TRIM, 'Concrete', { shape: 5, collide: 0 });
    add([5.4, 1, 5.4], [x, FLOOR + 50, z], 0xe8e2d4, 'SmoothPlastic', { shape: 5, collide: 0 });
    data.tags.SteamVent.push([x, FLOOR + 58, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // a water tower on stilts beside the works
  const wx = -446, wz = -108;
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) box([0.8, 30, 0.8], [wx + dx, FLOOR, wz + dz], 0x4a3a2c, 'Wood');
  add([12, 10, 12], [wx, FLOOR + 35, wz], 0x6a4a34, 'WoodPlanks', { shape: 5 });
  add([13, 7, 13], [wx, FLOOR + 40.2, wz], 0x3a3f46, 'Metal', { shape: 3, collide: 0 });

  // ---- what's left of the building work
  const yellow = 0xf2c818;
  // site office trailer, portable toilets, spare rail and a scissor lift
  box([24, 6, 10], [-536, FLOOR + 1, -58], 0xeeeeea, 'SmoothPlastic');
  sign('SITE OFFICE', [8, 1.6, 0.2], [-536, FLOOR + 5.2, -52.9], 0x16223a, 0xffffff, 'Back', 'GothamBold');
  for (let k = 0; k < 3; k++) box([3.4, 7, 3.4], [-548 + k * 4, FLOOR, -44], 0x2f6fbf, 'SmoothPlastic');
  for (let k = 0; k < 3; k++) add([1, 1, 18], [-520, FLOOR + 0.5 + k, -46], TRACK, 'SmoothPlastic');
  box([3, 1.2, 6], [-440, FLOOR, -84], yellow, 'SmoothPlastic');
  box([2.6, 9, 5], [-440, FLOOR + 1.2, -84], 0x3a3f46, 'Metal', { collide: 0 });
  box([3.4, 0.4, 6.4], [-440, FLOOR + 10.2, -84], yellow, 'SmoothPlastic');
  // barrels
  for (let k = 0; k < 6; k++) add([3, 2.4, 2.4], [-528 + (k % 3) * 3, FLOOR + 1.5, -36 - Math.floor(k / 3) * 3], k % 2 ? 0xffffff : 0xff6a10, 'SmoothPlastic', { shape: 2, rot: [0, -1, 0, 1, 0, 0, 0, 0, 1] });

  // the crew, in hard hats and orange vests, on the finishing touches
  const spots = [
    ['work', -446, -66, Math.PI / 2], ['work', -435, -88, 0], ['work', Q.x0 + 30, Q.z0 + 6, 0],
    ['work', Q.x0 + 70, Q.z0 + 24, Math.PI], ['idle', -536, -50, 0], ['work', -368, -30, -Math.PI / 2],
    ['idle', -418, -32, Math.PI], ['work', Q.x0 + 96, Q.z1 - 4, 0.6], ['work', -360, -40, Math.PI / 2],
  ];
  for (const [kind, x, z, yaw] of spots) {
    data.staffSpots.push({ role: 'construction', kind, land: 'Diesel', seed: 0, cf: [x, FLOOR, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)] });
  }
  Object.assign(data.staff.lines, {
    construction: ['Hard hat area, folks!', 'Test runs all day long!', "Can't tell you the name yet!", 'The queue is done - room for 2+ hours!', 'Those are water dummies riding!'],
  });
  return { track };
}

// The test train: four cars with water dummies in the seats, cycling the
// circuit all day. The lift chain clanks when you're close.
export class Construction {
  constructor(scene, data, layout, hooks) {
    this.hooks = hooks;
    const mi = (name) => data.materials.indexOf(name);
    const P = (sx, sy, sz, x, y, z, color, mat) => [0, sx, sy, sz, x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
    this.sampler = new Sampler(layout.track);
    this.track = layout.track;
    this.runTime = layout.track.times[layout.track.times.length - 1];
    this.dwell = 22;
    this.clock = 8;
    this.cars = [];
    this.spacing = 6.4;
    for (let k = 0; k < 4; k++) {
      const parts = [
        P(0.5, 0.9, 4.8, -1.3, 0.25, 0, 0x2a2a2e, 'Metal'), P(0.5, 0.9, 4.8, 1.3, 0.25, 0, 0x2a2a2e, 'Metal'),
        P(3.9, 1.5, 5.6, 0, 1.3, 0, 0x1e2024, 'SmoothPlastic'),
        P(4.0, 0.35, 5.7, 0, 1.9, 0, 0xf2c818, 'SmoothPlastic'),
        P(3.4, 1.8, 0.5, 0, 2.6, 0.9, 0x1e2024, 'SmoothPlastic'), P(3.4, 1.8, 0.5, 0, 2.6, -1.9, 0x1e2024, 'SmoothPlastic'),
      ];
      // water dummies: yellow tanks strapped into the seats
      for (const z of [1.6, -1.2]) for (const x of [-0.85, 0.85]) parts.push(P(1, 1.9, 1, x, 2.95, z - 0.5, 0xf0b020, 'SmoothPlastic'));
      if (k === 0) parts.push(P(3.9, 1.4, 1.6, 0, 1.6, -3.4, TRACK, 'SmoothPlastic'), P(1, 0.5, 0.3, 0, 1.4, -4.25, 0xfff2c0, 'Neon'));
      const car = buildModel(parts, data.materials, { shadows: true });
      car.matrixAutoUpdate = false;
      scene.add(car);
      this.cars.push(car);
    }
    this.m = new THREE.Matrix4();
    this.site = new THREE.Vector3(-440, 0, -60);
    this.lift = new THREE.Vector3(-472, 48, -72);
    this.told = false;
    this.nextClank = 2;
    this.place(0);
  }

  place(s) {
    const L = this.track.length;
    this.cars.forEach((car, k) => {
      this.sampler.matrixAt(s - 2.8 - k * this.spacing + L, this.m);
      car.matrix.copy(this.m);
      car.matrixWorldNeedsUpdate = true;
    });
    this.s = s;
  }

  update(dt, time, playerPos, started) {
    // dwell in the station, then one run around the circuit
    this.clock = (this.clock + Math.min(dt, 0.25)) % (this.dwell + this.runTime);
    const t = this.clock - this.dwell;
    this.place(t > 0 ? this.sampler.distanceAt(t) : 0);
    if (!started) return;
    const d = Math.hypot(playerPos.x - this.site.x, playerPos.z - this.site.z);
    if (d < 140 && !this.told) {
      this.told = true;
      this.hooks.toast('The new ride is almost here: the track is complete, the giant queue is finished and Benton Engine Works is built. Watch the test train run!', 'info');
    }
    // the lift chain clanks while the train climbs
    this.nextClank -= dt;
    if (this.nextClank <= 0) {
      const onLift = this.s > this.track.liftStart && this.s < this.track.crest;
      this.nextClank = onLift ? 0.35 : 3 + Math.random() * 3;
      const near = playerPos.distanceTo(this.lift) < 150;
      if (near && (onLift || d < 90)) this.hooks.sound('clank');
    }
  }
}
