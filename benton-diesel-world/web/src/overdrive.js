// Overdrive: the new coaster beside Diesel Thunder, now open. It is too big
// for the park, so a stretch of the west wall came down and the ride runs
// out onto the hills beyond. Guests come in through a brick arch, wind
// through the biggest queue in the park (with overflow rows chained off
// for busy days) and board in Benton Engine Works, an old brick diesel
// engine factory with a sawtooth roof and smoking chimneys. The train
// climbs the lift, takes a turning first drop, a camelback, a turnaround
// and a swoop over the queue before braking back into the station.
//
// The ride is added to the park data like any other ride (track, cars,
// seats, queue path, crew, wait sign), so the simulation, crews, riders,
// sounds and the app all treat it the same way.
import * as THREE from 'three';
import { Sampler } from './rides.js';

export const RIDE_ID = 'Overdrive';
// the strip inside the park, and the much bigger part beyond the wall
export const SITE = { x0: -376, x1: -357, z0: -84, z1: -4 };
export const OUT = { x0: -560, x1: -375, z0: -140, z1: 24 };
const FLOOR = 0.2;
const PLATFORM = 4.6; // top of the station platform
const G = 35; // gravity, studs/s²
const TRACK = 0xc23c12, SUPPORT = 0x2e3238;
const BUILDING = { x0: -426, x1: -366, z0: -82, z1: -42, h: 26 };
const QUEUE = { x0: -552, x1: -432, z0: -34, z1: 14 };
const STATION_Z = -54;
const CARS = 4, SPACING = 7.5;

// the circuit, in the order the train runs it (x, y, z of the rails),
// starting where the front car stops in the station
const CIRCUIT = [
  [-392, 4, -54], [-384, 4, -54], [-377, 4, -57], [-375, 4, -63], [-377, 4, -69], [-386, 4, -72], // round the end of the shed
  [-398, 4, -72], [-410, 4, -72], [-420, 4, -72], [-432, 5, -72], // out of the building
  [-442, 8, -72], [-472, 40, -72], [-503, 73, -72], [-514, 79, -72], [-524, 79, -74], // lift hill
  [-533, 73, -82], [-541, 56, -96], [-542, 33, -112], [-533, 13, -126], [-514, 6, -133], // turning first drop
  [-492, 14, -134], [-470, 48, -134], [-452, 50, -133], [-432, 22, -131], [-414, 12, -127], // camelback
  [-399, 16, -118], [-394, 22, -105], [-401, 26, -94], [-420, 28, -94], // turnaround
  [-444, 22, -97], [-466, 26, -99], [-486, 22, -95], [-496, 16, -84], [-497, 12, -72], // under the lift
  [-499, 18, -52], [-502, 30, -24], [-494, 35, 0], [-476, 30, 8], [-460, 26, 0], // over the queue
  [-456, 22, -16], [-458, 16, -34], [-452, 10, -48], [-440, 5, -54], [-426, 4, -54], // brakes
  [-412, 4, -54], [-400, 4, -54],
];

// Closed centripetal Catmull-Rom spline through the circuit, with banking
// from the speed a train carries and the time it takes to get there.
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
  while (pos[liftStart].x > -436 || pos[liftStart].z > -60) liftStart++;
  let brake = crest;
  while (brake < m - 2 && !(pos[brake].x > -446 && pos[brake].z < -48 && pos[brake].z > -60)) brake++;
  const yC = pos[crest].y, sC = cum[crest];
  const v0 = 169 + 2 * G * (yC - pos[brake].y);
  const mu = (v0 - 26 * 26) / (cum[brake] - sC);
  const v = cum.map((s, i) => {
    if (i < liftStart) return Math.min(11, Math.max(2, Math.sqrt(10 * s + 4)));
    if (i <= crest) return 13;
    if (i < brake) return Math.sqrt(Math.max(36, 169 + 2 * G * (yC - pos[i].y) - mu * (s - sC)));
    const after = s - cum[brake];
    const slowed = Math.max(8, 26 - after * 1.6);
    return Math.max(0.8, Math.min(slowed, Math.sqrt(2 * 2 * (L - s))));
  });
  const times = [0];
  for (let i = 1; i < m; i++) times.push(times[i - 1] + (cum[i] - cum[i - 1]) / ((v[i] + v[i - 1]) / 2));

  // bank into the turns: tan(phi) = v² kappa / g, smoothed along the track
  const Y = new THREE.Vector3(0, 1, 0);
  const phi = pos.map((_, i) => {
    if (i < liftStart || i > brake) return 0;
    const a = tan[i === 0 ? m - 2 : i - 1], b = tan[i === m - 1 ? 1 : i + 1];
    const ds = (cum[i === m - 1 ? 1 : i + 1] - cum[i === 0 ? m - 2 : i - 1] + (i === 0 || i === m - 1 ? L : 0)) || 1;
    let dh = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
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
  return { length: L, cum, pos: flatArr(pos), tan: flatArr(tan), up: flatArr(up), times };
}

// A queue path from the boarding gate (s = 0) back out past the entrance
// sign, in the export's format.
function queuePath(points, signIndex, outward) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const [gx, gz] = points[0], [nx, nz] = points[1];
  const gl = Math.hypot(nx - gx, nz - gz) || 1;
  return {
    points: points.flat(), cum, length: cum[cum.length - 1], signAt: cum[signIndex],
    gate: points[0], gateDir: [(gx - nx) / gl, (gz - nz) / gl], outward,
  };
}

export function buildOverdrive(data) {
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
  const sign = (text, size, center, bg, fg, face, font = 'GothamBlack', glow = false) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0 });
    data.signs.push({ part: i, face, glow, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const { z0, z1 } = SITE;

  // open the west wall where the ride crosses it, and clear the scenery
  // (part-built trees) and trees beyond it
  data.hidden = data.hidden || [];
  const hide = (i) => { data.static[i][19] = 0; data.hidden.push(i); };
  data.static.forEach((p, i) => {
    const onWall = Math.abs(p[4] + 375) < 0.5;
    const isWall = onWall && p[3] > 600; // the west wall and its cap
    const pillar = onWall && Math.abs(p[1] - 4.5) < 0.01 && p[6] > z0 - 1 && p[6] < z1 - 2.5;
    const scenery = (p[4] < -377 && inRect(p[4], p[6], OUT, 6)) || (!onWall && inRect(p[4], p[6], SITE));
    if (isWall || pillar || scenery) hide(i);
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const parkWall = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    const cx = (xa + xb) / 2, cz = (za + zb) / 2;
    add([2.5, 14, len], [cx, 7, cz], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [cx, 14.5, cz], CAP, 'Concrete', { yaw });
  };
  // the old wall either side of the gap, and new park wall around the
  // ride's land beyond it
  parkWall(-375, -405, -375, BUILDING.z0 + 0.5);
  parkWall(-375, z1 + 1, -375, 280);
  parkWall(-375, OUT.z0, OUT.x0, OUT.z0);
  parkWall(OUT.x0, OUT.z0, OUT.x0, OUT.z1);
  parkWall(OUT.x0, OUT.z1, -375, OUT.z1);
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 6) && !inRect(t.pos[0], t.pos[2], OUT, 8));
  // the terrain is leveled under the ride
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 26 }, { ...OUT, margin: 26 }];
  // the land beyond the wall is part of Diesel District now
  const land = data.config.Lands.find((l) => l.id === 'Diesel');
  if (land) land.regions = [...land.regions, [OUT.x0, OUT.z0, OUT.x1, OUT.z1]];

  // paving in the park strip in front of the works
  add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, FLOOR - 0.5, (SITE.z0 + SITE.z1) / 2], 0xc8bfae, 'Pavement');

  // ---- the track and its supports
  const track = makeTrack(CIRCUIT);
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
    add([d + 0.6, 0.8, 1.6], [foot.x, foot.y + 0.1, foot.z], SUPPORT, 'SmoothPlastic', { yaw: Math.atan2(back.x, back.z), collide: 0 });
  }

  // ---- the queue: approach path, four active switchback rows, six
  // overflow rows chained off for busy days, and a walkway to the station
  const Q = QUEUE;
  const rowZ = (k) => Q.z0 + 3 + k * 4.6;
  const RX0 = Q.x0 + 5, RX1 = Q.x1 - 5; // where the path turns at each end
  const gate = [-404, BUILDING.z1 + 2.5];
  const walkZ = BUILDING.z1 + 4.5;
  const entrance = [-362, rowZ(3)];
  const path = queuePath([
    gate, [gate[0], walkZ], [RX1, walkZ],
    [RX1, rowZ(0)], [RX0, rowZ(0)], [RX0, rowZ(1)], [RX1, rowZ(1)], [RX1, rowZ(2)], [RX0, rowZ(2)], [RX0, rowZ(3)],
    [Q.x1 + 2, rowZ(3)], entrance, [entrance[0] + 30, rowZ(3)],
  ], 11, [1, 0]);
  const PAVE = 0xbdb4a6;
  add([Q.x1 - Q.x0, 0.4, Q.z1 - Q.z0], [(Q.x0 + Q.x1) / 2, FLOOR + 0.2, (Q.z0 + Q.z1) / 2], PAVE, 'Concrete');
  add([entrance[0] + 6 - Q.x1, 0.4, 6], [(Q.x1 + entrance[0] + 6) / 2, FLOOR + 0.2, rowZ(3)], PAVE, 'Concrete'); // path in from the park
  add([gate[0] + 4 - (RX1 - 4), 0.4, 8], [(gate[0] + 4 + RX1 - 4) / 2, FLOOR + 0.2, walkZ - 1], PAVE, 'Concrete'); // walkway to the station
  const RAIL = 0x3a3f46, TOP = 0xd66e2c;
  const railX = (xa, xb, z) => {
    add([xb - xa, 0.22, 0.22], [(xa + xb) / 2, FLOOR + 3.2, z], TOP, 'SmoothPlastic', { collide: 0 });
    add([xb - xa, 0.16, 0.16], [(xa + xb) / 2, FLOOR + 1.9, z], RAIL, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((xb - xa) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [xa + ((xb - xa) * k) / n, FLOOR + 0.4, z], RAIL, 'Metal');
  };
  const railZ = (x, za, zb) => {
    add([0.22, 0.22, zb - za], [x, FLOOR + 3.2, (za + zb) / 2], TOP, 'SmoothPlastic', { collide: 0 });
    add([0.16, 0.16, zb - za], [x, FLOOR + 1.9, (za + zb) / 2], RAIL, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((zb - za) / 6));
    for (let k = 0; k <= n; k++) box([0.32, 3.1, 0.32], [x, FLOOR + 0.4, za + ((zb - za) * k) / n], RAIL, 'Metal');
  };
  // rails between rows, open at alternate ends where the path turns
  const rows = [];
  for (let k = 0; rowZ(k) < Q.z1 - 1; k++) rows.push(rowZ(k));
  for (let k = 1; k < rows.length; k++) {
    const z = rows[k] - 2.3;
    if (k % 2) railX(Q.x0 + 9, Q.x1 - 1, z); else railX(Q.x0 + 1, Q.x1 - 9, z);
  }
  railX(Q.x0 + 1, Q.x1 - 1, Q.z1 - 0.4);
  railX(Q.x0 + 1, RX1 - 3, Q.z0 + 0.4);
  railZ(Q.x0 + 0.6, Q.z0 + 0.4, Q.z1 - 0.4);
  railZ(Q.x1 - 0.6, Q.z0 + 0.4, rowZ(3) - 2.3);
  railZ(Q.x1 - 0.6, rowZ(3) + 2.3, Q.z1 - 0.4);
  // the approach path from the park, and the walkway
  railX(Q.x1, -378, rowZ(3) - 3);
  railX(Q.x1, -378, rowZ(3) + 3);
  railX(RX1 + 3, gate[0] - 2.5, walkZ + 2.5);
  // the overflow rows are chained off (a chain across the gap and a sign)
  const chainZ = rows[4] - 2.3;
  for (let k = 0; k < 4; k++) add([2, 0.2, 0.2], [Q.x1 - 8 + k * 2, FLOOR + 2.2 - (k % 2) * 0.3, chainZ], k % 2 ? 0xffffff : 0xc8322d, 'SmoothPlastic', { collide: 0 });
  box([0.6, 3, 0.6], [Q.x1 - 1, FLOOR, chainZ], RAIL, 'Metal');
  sign('OVERFLOW QUEUE - OPENS ON BUSY DAYS', [10, 1.4, 0.2], [Q.x1 - 6, FLOOR + 4.4, chainZ + 0.2], 0x16223a, 0xf0c440, 'Back', 'GothamBold');
  // a fence keeps guests out of the ride area
  for (let x = OUT.x0 + 1; x < BUILDING.x0 - 0.5; x += 12) {
    const xb = Math.min(BUILDING.x0, x + 12);
    add([xb - x, 0.3, 0.3], [(x + xb) / 2, FLOOR + 5.6, BUILDING.z1], 0x1e222c, 'Metal', { collide: 0 });
    box([xb - x, 5.6, 0.15], [(x + xb) / 2, FLOOR, BUILDING.z1], 0x2a2e36, 'Metal', { collide: 1 });
    box([0.4, 6, 0.4], [x, FLOOR, BUILDING.z1], 0x1e222c, 'Metal');
  }
  // shade sails on tall posts over the active rows
  const sails = [0xd66e2c, 0x2c6a86];
  for (let k = 0; k < rows.length; k += 2) {
    const z = rows[k] + 2.3;
    for (let x = Q.x0 + 2; x < Q.x1; x += 24) box([0.5, 11, 0.5], [x, FLOOR, z], RAIL, 'Metal');
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
    const x = Q.x0 + 3 + (k % 4) * 2.6, z = Q.z1 + 3 + Math.floor(k / 4) * 2.6;
    box([2.2, 3, 2.2], [x, FLOOR, z], [0x2f6fbf, 0xc8322d, 0x3a7a3a, 0xd8a020][k % 4], 'SmoothPlastic', { shape: 5 });
  }
  for (let k = 0; k < 5; k++) box([4, 3, 4], [Q.x1 - 6 - (k % 3) * 4.4, FLOOR + Math.floor(k / 3) * 3, Q.z1 + 4.5], 0x8a6a44, 'WoodPlanks');
  const ex = -404, ez = -4;
  box([10, 1, 6], [ex, FLOOR, ez], 0x8c8780, 'Concrete');
  box([7, 4, 4], [ex, FLOOR + 1, ez], 0x2c4a3a, 'Metal');
  for (let k = 0; k < 6; k++) add([1.4, 2.2, 1.4], [ex - 2.8 + (k % 3) * 2.8, FLOOR + 6.1, ez - 1 + Math.floor(k / 3) * 2], 0x58605a, 'Metal', { shape: 5 });
  add([2.6, 2.6, 0.6], [ex + 4, FLOOR + 3.4, ez], 0x1e2024, 'Metal', { shape: 2 });
  sign('1952 BENTON B-12 DIESEL', [8, 1.2, 0.2], [ex, FLOOR + 1.6, ez - 3.05], 0x16223a, 0xf0c440, 'Front', 'GothamBold');
  // the entrance arch, its name sign and the live wait sign
  const [ax, az] = entrance;
  for (const dz of [-6, 6]) box([2.4, 13, 2.4], [ax, FLOOR, az + dz], 0x8a3b2a, 'Brick');
  add([2.6, 3.4, 14.4], [ax, FLOOR + 14.6, az], 0x8a3b2a, 'Brick');
  sign('OVERDRIVE', [0.2, 2.4, 12], [ax - 1.4, FLOOR + 14.6, az], 0x16223a, 0xf0c440, 'Left', 'GothamBlack', true);
  sign('OVERDRIVE', [0.2, 2.4, 12], [ax + 1.4, FLOOR + 14.6, az], 0x16223a, 0xf0c440, 'Right', 'GothamBlack', true);
  box([0.6, 6, 0.6], [ax + 3, FLOOR, az - 9], RAIL, 'Metal');
  const waitPart = add([0.8, 6, 9.6], [ax + 3, FLOOR + 9, az - 9], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });

  // ---- Benton Engine Works: the station building, hollow so the trains
  // and riders are inside it, lit by lamps under the roof
  const B = BUILDING, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  const BW = B.x1 - B.x0, BD = B.z1 - B.z0, T = 1.2;
  const BRICK = 0x8a3b2a, DARK = 0x5e2a20, TRIM = 0xc4b8a4, VOID = 0x14110f;
  box([BW + 0.8, 1, BD + 0.8], [bx, FLOOR - 0.6, bz], 0x8c8780, 'Concrete');
  box([BW - 2 * T, 0.4, BD - 2 * T], [bx, FLOOR, bz], 0x9a958c, 'Concrete'); // shed floor
  box([BW, B.h, T], [bx, FLOOR, B.z0 + T / 2], BRICK, 'Brick');
  box([BW, B.h, T], [bx, FLOOR, B.z1 - T / 2], BRICK, 'Brick');
  box([T, B.h, BD], [B.x1 - T / 2, FLOOR, bz], BRICK, 'Brick');
  // the west wall, with openings where the trains go out and come home
  const doors = [-72, STATION_Z];
  const spans = [[B.z0, doors[0] - 4.5], [doors[0] + 4.5, doors[1] - 4.5], [doors[1] + 4.5, B.z1]];
  for (const [za, zb] of spans) box([T, B.h, zb - za], [B.x0 + T / 2, FLOOR, (za + zb) / 2], BRICK, 'Brick');
  for (const z of doors) {
    box([T, B.h - 10, 9], [B.x0 + T / 2, FLOOR + 10, z], BRICK, 'Brick');
    add([0.8, 1.2, 10.4], [B.x0 - 0.4, FLOOR + 10.6, z], TRIM, 'Concrete', { collide: 0 });
  }
  add([BW, 1, BD], [bx, FLOOR + B.h + 0.5, bz], 0x5a5f66, 'Concrete'); // roof deck
  box([BW + 1.2, 1.2, BD + 1.2], [bx, FLOOR + B.h, bz], TRIM, 'Concrete', { collide: 0 });
  // sawtooth roof, the glazing facing north
  const teeth = 5, tw = BD / teeth;
  for (let k = 0; k < teeth; k++) {
    const z = B.z0 + tw * (k + 0.5);
    add([BW - 1, 5.5, tw], [bx, FLOOR + B.h + 1.2 + 2.75, z], 0x5a5f66, 'CorrodedMetal', { shape: 1, rot: [-1, 0, 0, 0, 1, 0, 0, 0, -1], collide: 0 });
    add([BW - 1.4, 4.8, 0.3], [bx, FLOOR + B.h + 1.2 + 2.6, z - tw / 2 + 0.2], 0x3a5060, 'Glass', { collide: 0 });
  }
  // brick piers and tall factory windows down the long sides
  for (const [z, face] of [[B.z0, -1], [B.z1, 1]]) {
    for (let x = B.x0 + 2; x <= B.x1 - 1.9; x += 6.4) box([1.8, B.h, 1], [x, FLOOR, z + face * 0.4], DARK, 'Brick', { collide: 0 });
    for (let x = B.x0 + 5.2; x < B.x1 - 3; x += 6.4) {
      add([3.6, 11, 0.3], [x, FLOOR + 13, z + face * 0.08], 0x2a3a46, 'Glass', { collide: 0 });
      add([4.4, 0.6, 0.8], [x, FLOOR + 7.2, z + face * 0.3], TRIM, 'Concrete', { collide: 0 });
      add([4.2, 1.2, 0.6], [x, FLOOR + 19, z + face * 0.25], TRIM, 'Concrete', { collide: 0 });
    }
    add([BW, 0.8, 0.6], [bx, FLOOR + 22.6, z + face * 0.3], TRIM, 'Concrete', { collide: 0 });
  }
  sign('NO. 2 ERECTING SHOP', [0.2, 2, 20], [B.x0 - 0.2, FLOOR + 17, bz], 0x1a1a1c, 0xe8dcc0, 'Left', 'GothamBold');
  // the facade facing the park: name, gear emblem and big doors
  sign('BENTON ENGINE WORKS', [0.2, 3.2, 34], [B.x1 + 0.2, FLOOR + 23.2, bz], 0x1a1a1c, 0xf0c440, 'Right');
  sign('HOME OF OVERDRIVE', [0.2, 1.4, 14], [B.x1 + 0.2, FLOOR + 8.4, bz], 0x1a1a1c, 0xe8dcc0, 'Right', 'GothamBold');
  add([0.8, 10, 10], [B.x1 + 0.5, FLOOR + 15.2, bz], 0x9a8a6a, 'Metal', { shape: 2, collide: 0 });
  add([1, 4.4, 4.4], [B.x1 + 0.7, FLOOR + 15.2, bz], DARK, 'Metal', { shape: 2, collide: 0 });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    add([0.8, 2, 1.8], [B.x1 + 0.5, FLOOR + 15.2 + c * 5.4, bz + s * 5.4], 0x9a8a6a, 'Metal', { collide: 0, rot: [1, 0, 0, 0, c, -s, 0, s, c] });
  }
  for (const dz of [-14, 14]) {
    add([0.3, 10, 9], [B.x1 + 0.1, FLOOR + 5, bz + dz], VOID, 'SmoothPlastic', { collide: 0 });
    add([0.9, 1.4, 10.6], [B.x1 + 0.4, FLOOR + 10.4, bz + dz], TRIM, 'Concrete', { collide: 0 });
    add([3, 0.4, 11], [B.x1 + 1.6, FLOOR + 11.4, bz + dz], 0x2e3238, 'Metal', { collide: 0 });
  }
  const exitDoor = [B.x1 + 3, bz + 14];
  sign('RIDE EXIT', [0.2, 1.2, 6], [B.x1 + 0.3, FLOOR + 12.4, bz + 14], 0x1a1a1c, 0x5adc6e, 'Right', 'GothamBold', true);
  // the queue door on the south side
  add([7, 9, 0.3], [gate[0], FLOOR + 4.5, B.z1 + 0.1], VOID, 'SmoothPlastic', { collide: 0 });
  add([9, 0.4, 3.4], [gate[0], FLOOR + 9.6, B.z1 + 1.7], 0x2e3238, 'Metal', { collide: 0 });
  sign('BOARDING', [6, 1.4, 0.2], [gate[0], FLOOR + 11, B.z1 + 0.3], 0x1a1a1c, 0xf0c440, 'Back', 'GothamBold');
  // inside: the boarding platform, an island platform, the operator's
  // console, a big sign over the tracks and work lamps under the roof
  const px0 = B.x0 + T, px1 = -380;
  box([px1 - px0, PLATFORM - FLOOR, B.z1 - T - (STATION_Z + 2.8)], [(px0 + px1) / 2, FLOOR, (B.z1 - T + STATION_Z + 2.8) / 2], 0xa8a298, 'Concrete');
  add([px1 - px0, 0.1, 0.6], [(px0 + px1) / 2, PLATFORM + 0.05, STATION_Z + 3.2], 0xf2c818, 'SmoothPlastic', { collide: 0 }); // edge line
  box([-392 - px0, PLATFORM - FLOOR, 10.6], [(px0 - 392) / 2, FLOOR, (STATION_Z - 72) / 2], 0xa8a298, 'Concrete');
  const con = [-384, STATION_Z + 5.4];
  box([2.4, 3, 1.2], [con[0], PLATFORM, con[1]], 0x2e3238, 'Metal');
  add([2, 0.2, 0.9], [con[0], PLATFORM + 3.1, con[1]], 0x101418, 'SmoothPlastic', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.6 + k * 0.6, PLATFORM + 3.25, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  sign('OVERDRIVE  ·  ENGINE WORKS STATION', [30, 3, 0.3], [-404, FLOOR + 14, STATION_Z - 5.5], 0x1a1a1c, 0xf0c440, 'Back', 'GothamBlack', true);
  add([0.3, 6, 0.3], [-416, FLOOR + 18.5, STATION_Z - 5.5], 0x2e3238, 'Metal', { collide: 0 });
  add([0.3, 6, 0.3], [-392, FLOOR + 18.5, STATION_Z - 5.5], 0x2e3238, 'Metal', { collide: 0 });
  for (let x = B.x0 + 6; x < B.x1 - 3; x += 12) {
    for (const z of [STATION_Z + 4, -63, -72]) add([3, 0.4, 1], [x, FLOOR + B.h - 1.4, z], 0xfff2d8, 'Neon', { collide: 0 });
  }
  // two tall chimneys at the park end, gently smoking
  data.tags.SteamVent = data.tags.SteamVent || [];
  for (const z of [B.z0 + 4, B.z1 - 4]) {
    const x = B.x1 - 4;
    add([5, 58, 5], [x, FLOOR + 29, z], DARK, 'Brick', { shape: 5, collide: 0 });
    add([5.8, 2, 5.8], [x, FLOOR + 57, z], TRIM, 'Concrete', { shape: 5, collide: 0 });
    add([5.4, 1, 5.4], [x, FLOOR + 50, z], 0xe8e2d4, 'SmoothPlastic', { shape: 5, collide: 0 });
    data.tags.SteamVent.push([x, FLOOR + 58, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // a water tower on stilts beside the works
  const wx = -446, wz = -108;
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) box([0.8, 30, 0.8], [wx + dx, FLOOR, wz + dz], 0x4a3a2c, 'Wood');
  add([12, 10, 12], [wx, FLOOR + 35, wz], 0x6a4a34, 'WoodPlanks', { shape: 5 });
  add([13, 7, 13], [wx, FLOOR + 40.2, wz], 0x3a3f46, 'Metal', { shape: 3, collide: 0 });

  // ---- the train: four cars in Engine Works orange with lap bars
  const thunder = data.rides.find((r) => r.id === 'DieselThunder');
  const recolor = { 0xc42828: 0x9a2808, 0xf0c440: 0xf2c818, 0x1e1e22: 0x1e2024 };
  const carParts = (k) => thunder.cars[k === 0 ? 0 : 1].parts.map((p) => {
    const q = p.slice();
    q[16] = recolor[p[16]] ?? p[16];
    return q;
  });
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(thunder.seats[0].map((s) => s.slice()));
  }

  // ---- the crew: an operator at the console and two attendants who
  // check the lap bars, two cars each
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, PLATFORM, STATION_Z + 5.6));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0], PLATFORM, con[1] - 0.2, Math.PI),
    operator: cf(con[0], PLATFORM, con[1] + 1.4),
    homes: [cf(-389, PLATFORM, STATION_Z + 7.5), cf(-418, PLATFORM, STATION_Z + 7.5)],
    exit: cf(-382, PLATFORM, STATION_Z + 7.5, Math.PI),
  };

  // ---- the ride itself
  const origin = [-400, 0, -62];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: path, trackStyle: { style: 'steel', color: TRACK }, extras: {}, extrasNames: [], crew,
  };
  data.rides.push(ride);
  data.config.Rides.push({
    id: RIDE_ID, name: 'Overdrive', land: 'Diesel', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: 'Ride a runaway test train out of the old Benton Engine Works: an 80-stud lift, a turning first drop, a camelback and a swoop right over the biggest queue in the park.',
    baseWait: 90, origin, entrance: [entrance[0], 0, entrance[1]], exit: [exitDoor[0], 0, exitDoor[1]], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK, 0x1e2024, 0xf2c818],
  });
  // an employee at the entrance welcomes guests
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Diesel', seed: 7, cf: cf(ax + 2.5, FLOOR, az + 4, -Math.PI / 2) });
  return { ride };
}
