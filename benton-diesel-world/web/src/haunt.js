// Benton Haunt, part two: the small backstage behind Benton Family Landing,
// where the sixth house (Lights Out at Lakeside) is open in a big white
// clear-span tent with a rope-and-stanchion queue in front; the six scare
// zones around the park, finished and open, each with its lit sign, fog
// machines, colored lights, props and scare actors; and Graveyard Grub,
// the event's food stand on the backstage avenue with a Halloween menu.

import { LINES as WALKWAYS } from './guests.js';
import { HAUNT_OVER } from './season.js';

export const FB = { x0: 375, x1: 500, z0: 128, z1: 236 };
const GATE = { z0: 161.4, z1: 197.1 }; // between the east wall pillars at z 159.1 and 199.4
const G = 0.1;
// the sixth house's rope queue in front of its tent
export const FAMILY_QUEUE = { x0: 384, x1: 414, z0: 196, z1: 232, step: 6, rows: 6 };
const BLACK = 0x101012, ORANGE = 0xff7a1a, PUMPKIN = 0xd85400, WHITE = 0xf4f4f0, CANVAS = 0xf2f2ee;

function helpers(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), 0, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, face, font = 'GothamBlack', glow = false, yaw = 0) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({ part: i, face, glow, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const spot = (role, kind, land, x, y, z, yaw) => data.staffSpots.push({ role, kind, land, seed: 0, cf: cf(x, y, z, yaw) });
  return { add, box, sign, cf, spot };
}

// ---------------------------------------------------- Family Landing backstage
export function buildFamilyBackstage(data) {
  const { add, box, sign, spot } = helpers(data);
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const STONE = 0x96928c, CAP = 0xc4beb4;
  // open the east wall between two pillars, clear the way to it and the lot
  data.hidden = data.hidden || [];
  const way = { x0: 350, x1: 374, z0: GATE.z0 - 2, z1: GATE.z1 + 2 };
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 375) < 0.5 && p[3] > 600; // the east wall and its cap
    const scenery = (p[4] > 377 && inRect(p[4], p[6], FB, 4)) || inRect(p[4], p[6], way);
    if (wall || scenery) { p[19] = 0; data.hidden.push(i); }
  });
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], FB, 8) && !inRect(t.pos[0], t.pos[2], way, 4));
  const parkWall = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  parkWall(375, -405, 375, GATE.z0);
  parkWall(375, GATE.z1, 375, 280);
  parkWall(375, FB.z0, FB.x1, FB.z0);
  parkWall(FB.x1, FB.z0, FB.x1, FB.z1);
  parkWall(FB.x1, FB.z1, 375, FB.z1);
  data.flatZones = [...(data.flatZones || []), { ...FB, margin: 26 }];
  add([FB.x1 - FB.x0, 1, FB.z1 - FB.z0], [(FB.x0 + FB.x1) / 2, G - 0.5, (FB.z0 + FB.z1) / 2], 0x2e2f34, 'Asphalt');

  // the gate arch, facing the park
  const gz = (GATE.z0 + GATE.z1) / 2, gw = GATE.z1 - GATE.z0;
  if (HAUNT_OVER) return familyTeardown();
  for (const z of [GATE.z0 + 1.5, GATE.z1 - 1.5]) {
    box([2.6, 16, 2.6], [379, G, z], BLACK, 'Metal');
    for (let k = 0; k < 3; k++) add([1.6, 1.4, 1.6], [376.9, G + 0.7, z + (k - 1) * 1.8], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
  }
  add([2, 3, gw], [379, G + 17.5, gz], BLACK, 'Metal', { collide: 0 });
  sign('BENTON HAUNT  ·  BACKSTAGE', [0.2, 2.2, gw - 3], [377.9, G + 17.6, gz], BLACK, ORANGE, 'Left', 'GothamBlack', true);
  sign('HOUSE 6: LIGHTS OUT AT LAKESIDE  ·  NOW OPEN', [0.2, 1, gw - 6], [377.9, G + 15.3, gz], BLACK, WHITE, 'Left', 'GothamBold');

  // the clear-span tent for the sixth house: straight walls under a
  // rounded white roof, ribbed every few studs (hollow, with a way in at
  // the west end and out at the east)
  const tent = (x0, x1, zc, W, wallH, doors = null) => {
    const L = x1 - x0, xc = (x0 + x1) / 2;
    if (!doors) box([L, wallH, W], [xc, G, zc], CANVAS, 'Fabric');
    else {
      const T = 0.6;
      box([L, wallH, T], [xc, G, zc - W / 2 + T / 2], CANVAS, 'Fabric');
      box([L, wallH, T], [xc, G, zc + W / 2 - T / 2], CANVAS, 'Fabric');
      for (const [x, dz] of [[x0, doors.in], [x1, doors.out]]) {
        const z0 = zc - W / 2, z1 = zc + W / 2, d = zc + dz;
        box([T, wallH, d - 3.5 - z0], [x, G, (z0 + d - 3.5) / 2], CANVAS, 'Fabric');
        box([T, wallH, z1 - d - 3.5], [x, G, (z1 + d + 3.5) / 2], CANVAS, 'Fabric');
      }
      add([L, 0.4, W], [xc, G + wallH + 4, zc], 0x101012, 'SmoothPlastic', { collide: 0 }); // blackout ceiling inside
    }
    if (!doors) {
      add([L, W, W], [xc, G + wallH, zc], CANVAS, 'Fabric', { shape: 2, collide: 0 });
      for (let x = x0; x <= x1 + 0.01; x += L / Math.round(L / 6)) add([0.3, W + 0.3, W + 0.3], [x, G + wallH, zc], 0xd2d2ce, 'Metal', { shape: 2, collide: 0 });
      return;
    }
    // a walk-in tent: the rounded roof is built from curved panels, so the
    // inside stays open, with ribs over it every few studs
    const R = W / 2, N = 12, chord = 2 * R * Math.sin(Math.PI / (2 * N)) + 0.15;
    for (let k = 0; k < N; k++) {
      const th = (Math.PI * (k + 0.5)) / N, phi = Math.PI / 2 - th;
      const rot = [1, 0, 0, 0, Math.cos(phi), -Math.sin(phi), 0, Math.sin(phi), Math.cos(phi)];
      const y = G + wallH + R * Math.sin(th) * Math.cos(Math.PI / (2 * N)), z = zc + R * Math.cos(th) * Math.cos(Math.PI / (2 * N));
      add([L, 0.3, chord], [xc, y, z], CANVAS, 'Fabric', { collide: 0, rot });
      for (let x = x0; x <= x1 + 0.01; x += L / Math.round(L / 6)) add([0.35, 0.45, chord], [x, y + 0.2 * Math.sin(th), z + 0.2 * Math.cos(th)], 0xd2d2ce, 'Metal', { collide: 0, rot });
    }
    // and the round ends, closed with canvas above the walls
    for (const x of [x0, x1]) {
      for (let k = 0; k < 6; k++) {
        const y0 = G + wallH + (R * k) / 6, half = Math.sqrt(Math.max(0, R * R - ((R * (k + 0.5)) / 6) ** 2));
        add([0.4, R / 6 + 0.05, half * 2], [x, y0 + R / 12, zc], CANVAS, 'Fabric', { collide: 0 });
      }
    }
  };
  const HX0 = 420, HX1 = 482, HZ = 212, HW = 28;
  tent(HX0, HX1, HZ, HW, 7, { in: 2, out: -6 });
  // the finished facade at the tent's west end: a lakeside lodge with its
  // sign lit, lanterns either side and fog rolling out of the door
  const fx = HX0 - 0.8;
  for (const [za, zb] of [[HZ - 12, HZ - 1.5], [HZ + 5.5, HZ + 12]]) box([1.2, 15, zb - za], [fx, G, (za + zb) / 2], 0x2a1c14, 'WoodPlanks');
  box([1.2, 5.6, 7], [fx, G + 9.4, HZ + 2], 0x2a1c14, 'WoodPlanks');
  for (const sz of [-1, 1]) box([4, 10, 0.6], [fx + 2, G, HZ + 2 + sz * 3.8], 0x101012, 'SmoothPlastic');
  for (let k = 0; k < 7; k++) {
    add([1.2, 1.2, 10.5], [fx - 0.8, G + 0.6 + k * 1.25, HZ - 6.75], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
    add([1.2, 1.2, 6.5], [fx - 0.8, G + 0.6 + k * 1.25, HZ + 8.75], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  }
  add([26, 3, 8], [fx - 2.2, G + 16.4, HZ], 0x3a2418, 'Wood', { shape: 1, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  sign('LIGHTS OUT AT LAKESIDE', [0.3, 2.4, 20], [fx - 0.9, G + 12.6, HZ], BLACK, 0xffb040, 'Left', 'GothamBlack', true);
  for (const dz of [-9, 9]) add([1.2, 2.4, 0.8], [fx - 0.8, G + 7, HZ + 2 + dz * 0.8], 0xffb040, 'Neon', { collide: 0 });
  for (let k = 0; k < 5; k++) add([0.8, 0.5, 0.6], [fx - 1.2, G + 0.25, HZ - 9 + k * 4.5], 0xffb040, 'Neon', { collide: 0 });
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.SteamVent.push([fx - 1.5, G + 0.6, HZ + 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  sign('EXIT', [0.2, 1.2, 4], [HX1 + 0.4, G + 8, HZ - 6], BLACK, 0x5adc6e, 'Right', 'GothamBold', true);

  // a smaller tent for the scare actors and props
  tent(440, 472, 148, 18, 6);
  sign('SCARE ACTORS ONLY', [0.2, 1.4, 8], [439.8, G + 4.4, 148], BLACK, ORANGE, 'Left', 'GothamBold');

  // the queue: posts and white rope on the asphalt, all roped now
  const Q = FAMILY_QUEUE;
  const post = (x, z) => {
    box([0.9, 0.12, 0.9], [x, G, z], 0x8a6a30, 'Metal', { collide: 0 });
    box([0.22, 3.2, 0.22], [x, G, z], 0x9a9ea6, 'Metal');
  };
  const ropeX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 5));
    for (let k = 0; k <= n; k++) post(xa + ((xb - xa) * k) / n, z);
    add([xb - xa, 0.16, 0.16], [(xa + xb) / 2, G + 2.7, z], WHITE, 'Fabric', { collide: 0 });
  };
  const ropeZ = (x, za, zb) => {
    const n = Math.max(1, Math.round((zb - za) / 5));
    for (let k = 0; k <= n; k++) post(x, za + ((zb - za) * k) / n);
    add([0.16, 0.16, zb - za], [x, G + 2.7, (za + zb) / 2], WHITE, 'Fabric', { collide: 0 });
  };
  ropeZ(Q.x0, Q.z0, Q.z1);
  ropeZ(Q.x1, Q.z0, Q.z1 - 6);
  ropeX(Q.x0 + 6, Q.x1, Q.z0); // the way in at the south-west corner
  ropeX(Q.x0, Q.x1, Q.z1);
  for (let k = 1; k < Q.rows; k++) {
    const z = Q.z0 + k * Q.step;
    if (k % 2) ropeX(Q.x0, Q.x1 - 6, z); else ropeX(Q.x0 + 6, Q.x1, z);
  }
  box([0.4, 6, 0.4], [Q.x0 - 3, G, Q.z0 - 2], BLACK, 'Metal');
  sign('LIGHTS OUT AT LAKESIDE', [9, 1.8, 0.2], [Q.x0 - 3, G + 5.6, Q.z0 - 2.2], BLACK, 0xffb040, 'Front', 'GothamBlack', true);
  spot('haunt', 'idle', 'Family', Q.x0 + 3, G, Q.z0 - 4, 0);

  // lodge props by the door, the generator and lighting
  for (let k = 0; k < 3; k++) box([2, 0.9, 10], [452 + k * 2.4, G, 180], [0x8a3a22, 0x3a5a2a, 0x2a4a6a][k], 'Wood');
  for (let k = 0; k < 6; k++) box([3, 2.6, 4], [490 + (k % 2) * 3.4, G + Math.floor(k / 2) * 2.6, 140], 0x1a1a1c, 'Metal');
  box([9, 5.5, 4.5], [400, G, 140], 0x5a5e66, 'Metal');
  sign('GENERATOR', [5, 1, 0.2], [400, G + 4.2, 142.3], 0x5a5e66, 0xf2c818, 'Back', 'GothamBold');
  box([1, 14, 1], [408, G, 170], 0x8a8e96, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([1, 1, 0.4], [406.5 + (k % 2) * 3, G + 14.5 + Math.floor(k / 2) * 1.2, 170.4], 0xfff6d8, 'Neon', { collide: 0 });
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.ParkLamp.push([408, G + 15, 170.4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  spot('haunt', 'idle', 'Family', 384, G, gz + 6, -Math.PI / 2);
  return { tent: { x0: HX0, x1: HX1, z: HZ, door: [fx - 2, HZ + 2], exit: [HX1 + 4, HZ - 6] } };

  // after the event: the gate locked, the tent coming down to its frame,
  // the lodge facade in a pile and the rope queue packed away
  function familyTeardown() {
    const STEEL = 0xb8bcc0;
    const x = 377;
    for (const z of [GATE.z0 + 0.8, gz, GATE.z1 - 0.8]) box([1, 14, 1], [x, G, z], STEEL, 'Metal', { shape: 5 });
    data.static.push([0, 0.3, 13.4, gw, x, G + 6.7, gz, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0x8a9096, data.materials.indexOf('Metal'), 0.55, 1]);
    for (const y of [0.4, 6.8, 13.2]) add([0.4, 0.3, gw], [x, G + y, gz], STEEL, 'Metal', { collide: 0 });
    add([0.6, 1.6, 1.2], [x - 0.5, G + 6.2, gz], 0xb08a30, 'Metal', { collide: 0 });
    sign('BACKSTAGE CLOSED', [0.2, 3, 18], [x - 0.4, G + 10.2, gz], 0xc8322d, WHITE, 'Left', 'GothamBlack');
    sign('CAST MEMBERS ONLY  ·  NO ENTRY', [0.2, 1.4, 18], [x - 0.4, G + 7.9, gz], WHITE, 0xc8322d, 'Left', 'GothamBold');
    sign('THANKS FOR SCREAMING!  SEE YOU NEXT FALL', [0.2, 1.2, gw - 6], [x - 0.4, G + 2.6, gz], BLACK, ORANGE, 'Left', 'GothamBold');
    // the tent: the west half is down to its steel frame, the east half
    // still has its walls; the canvas is folded on pallets
    const HX0 = 420, HX1 = 482, HZ = 212, HW = 28, R = HW / 2, wallH = 7;
    for (let xx = HX0; xx <= HX1 + 0.01; xx += 6.2) {
      for (const sz of [-1, 1]) box([0.4, wallH, 0.4], [xx, G, HZ + sz * R], 0xd2d2ce, 'Metal');
      for (let k = 0; k < 10; k++) {
        const th = (Math.PI * (k + 0.5)) / 10, phi = Math.PI / 2 - th;
        const rot = [1, 0, 0, 0, Math.cos(phi), -Math.sin(phi), 0, Math.sin(phi), Math.cos(phi)];
        add([0.35, 0.45, 2 * R * Math.sin(Math.PI / 20) + 0.1], [xx, G + wallH + R * Math.sin(th), HZ + R * Math.cos(th)], 0xd2d2ce, 'Metal', { collide: 0, rot });
      }
    }
    for (const sz of [-1, 1]) box([HX1 - 452, wallH, 0.6], [(452 + HX1) / 2, G, HZ + sz * (R - 0.3)], CANVAS, 'Fabric');
    for (let k = 0; k < 6; k++) box([5, 1.2, 4], [400 + (k % 3) * 6, G + Math.floor(k / 3) * 1.2, 236 - 8], CANVAS, 'Fabric');
    // the lodge facade, in a pile of logs and boards
    for (let k = 0; k < 9; k++) add([1.2, 1.2, 9 + (k % 3)], [412 + (k % 3) * 1.3, G + 0.6 + Math.floor(k / 3) * 1.15, HZ + 2], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
    for (let k = 0; k < 4; k++) add([6, 0.4, 10], [404, G + 0.3 + k * 0.4, HZ - 10], 0x2a1c14, 'WoodPlanks', { collide: 0 });
    sign('LIGHTS OUT AT LAKESIDE', [20, 0.3, 2.4], [404, G + 0.2, HZ + 14], BLACK, 0xffb040, 'Top', 'GothamBlack');
    // the rope queue: posts in a bin, ropes coiled
    box([6, 3, 4], [396, G, 196], 0x3a3a3e, 'Metal');
    for (let k = 0; k < 12; k++) box([0.22, 3.2, 0.22], [394 + (k % 6) * 0.8, G + 2.6, 195 + Math.floor(k / 6) * 1.6], 0x9a9ea6, 'Metal', { collide: 0 });
    for (let k = 0; k < 3; k++) add([2.2, 0.6, 2.2], [402 + k * 2.6, G + 0.3, 196], WHITE, 'Fabric', { shape: 5, collide: 0 });
    // a box truck being loaded, and the generator
    box([10, 9, 22], [455, G + 1.2, 150], 0xf0f0ec, 'SmoothPlastic');
    box([8, 7, 7], [455, G + 1, 165], 0x2a3a5a, 'SmoothPlastic');
    sign('BENTON HAUNT PRODUCTIONS', [0.2, 2, 18], [449.9, G + 7, 150], 0xf0f0ec, 0x16223a, 'Left', 'GothamBlack');
    box([9, 5.5, 4.5], [400, G, 140], 0x5a5e66, 'Metal');
    spot('construction', 'work', 'Family', 414, G, HZ + 6, Math.PI / 2);
    spot('construction', 'work', 'Family', 436, G, HZ + 2, 0);
    spot('construction', 'idle', 'Family', 384, G, gz + 6, -Math.PI / 2);
    spot('construction', 'work', 'Family', 452, G, 138, 0);
    return { tent: { x0: HX0, x1: HX1, z: HZ, door: [HX0 - 3, HZ + 2], exit: [HX1 + 4, HZ - 6] } };
  }
}

// ------------------------------------------------------------- scare zones
// Find a clear patch of ground near (x, z): no buildings, props or trees,
// away from ride tracks, queues, shops and water.
export function makeFinder(data) {
  const CELL = 2;
  const blocked = new Set();
  const key = (i, j) => i * 100003 + j;
  const hidden = new Set(data.hidden || []);
  data.static.forEach((p, idx) => {
    if (hidden.has(idx)) return;
    const top = p[5] + p[2] / 2, bottom = p[5] - p[2] / 2;
    if (top < 0.7 || bottom > 10) return;
    if (p[1] * p[3] > 30000) return;
    // lamps, benches, bins and signs can stand inside a zone; buildings,
    // walls and big set pieces can't
    if (p[1] * p[3] < 6 && top < 8) return;
    const ax = [p[7], p[13]], az = [p[9], p[15]];
    const ex = (Math.abs(ax[0]) * p[1] + Math.abs(az[0]) * p[3]) / 2 + 1, ez = (Math.abs(ax[1]) * p[1] + Math.abs(az[1]) * p[3]) / 2 + 1;
    for (let i = Math.floor((p[4] - ex) / CELL); i <= Math.floor((p[4] + ex) / CELL); i++) {
      for (let j = Math.floor((p[6] - ez) / CELL); j <= Math.floor((p[6] + ez) / CELL); j++) blocked.add(key(i, j));
    }
  });
  // the top of whatever paving is underfoot
  const groundAt = (x, z) => {
    let g = 0;
    data.static.forEach((p, idx) => {
      const top = p[5] + p[2] / 2;
      if (hidden.has(idx) || top > 1.3 || top < g) return;
      const ex = (Math.abs(p[7]) * p[1] + Math.abs(p[9]) * p[3]) / 2, ez = (Math.abs(p[13]) * p[1] + Math.abs(p[15]) * p[3]) / 2;
      if (Math.abs(x - p[4]) < ex && Math.abs(z - p[6]) < ez) g = top;
    });
    return g;
  };
  const avoid = [];
  for (const t of data.trees || []) avoid.push([t.pos[0], t.pos[2], 3.5]);
  for (const r of data.rides) {
    if (r.track) for (let i = 0; i < r.track.pos.length; i += 9) if (r.track.pos[i + 1] < 16) avoid.push([r.track.pos[i], r.track.pos[i + 2], 9]);
    if (r.queue) for (let i = 0; i < r.queue.points.length; i += 2) avoid.push([r.queue.points[i], r.queue.points[i + 1], 5]);
    avoid.push([r.origin[0], r.origin[2], 18]);
  }
  for (const v of data.config.Venues) avoid.push([v.position[0], v.position[2], Math.max(v.size[0], v.size[2]) / 2 + 6]);
  for (const t of data.terrain) {
    if (t.kind === 'ball') avoid.push([t.center[0], t.center[2], Math.max(0, Math.sqrt(Math.max(0, t.radius ** 2 - (0.7 - t.center[1]) ** 2))) + 3]);
    if (t.kind === 'cylinder') avoid.push([t.cf[0], t.cf[2], t.radius + 14]);
    // the big grass tiles are the ground itself; only water blocks count
    if (t.kind === 'block' && t.material === 'Water') avoid.push([t.cf[0], t.cf[2], Math.max(t.size[0], t.size[2]) / 2 + 8]);
  }
  const clear = (x, z, r) => {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) if (blocked.has(key(i, j))) return false;
    }
    return !avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar + r);
  };
  const B = data.config.Bounds;
  const finder = (x0, z0, r, region) => {
    for (let d = 0; d < 200; d += 3) {
      const n = Math.max(1, Math.round((d * Math.PI * 2) / 6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
        if (x < B.minX + r + 6 || x > B.maxX - r - 6 || z < B.minZ + r + 6 || z > B.maxZ - r - 6) continue;
        if (region && !region.some(([rx0, rz0, rx1, rz1]) => x > rx0 + r && x < rx1 - r && z > rz0 + r && z < rz1 - r)) continue;
        if (clear(x, z, r)) return [x, z, groundAt(x, z)];
      }
    }
    return null;
  };
  finder.clear = clear;
  finder.groundAt = groundAt;
  return finder;
}

export const SCARE_ZONES = [
  { name: 'MIDNIGHT AT THE GATE', land: 'Plaza', theme: 'graveyard', path: [-45, 252, 45, 252], len: 200, glow: 0x9a6aff, gaps: [[0, 252, 20]], ground: 0x2a2420,
    actors: ['reaper', 'ghoul', 'ghoul', 'reaper', 'ghoul', 'ghoul', 'reaper'] },
  { name: 'SMOKESTACK ALLEY', land: 'Diesel', theme: 'smokestacks', path: [-30, 15, -158, 15], len: 200, glow: 0xff3a10, ground: 0x26262a,
    actors: ['gasMask', 'gasMask', 'gasMask', 'gasMask', 'gasMask', 'gasMask'] },
  { name: 'SCARECROW CROSSING', land: 'Haulers', theme: 'cornfield', path: [-62, 240, -150, 232], len: 200, glow: 0xff8a10, ground: 0x6a5a30,
    actors: ['scarecrow', 'pumpkinHead', 'scarecrow', 'scarecrow', 'pumpkinHead', 'scarecrow'] },
  { name: 'THE HOLLOW WOODS', land: 'Backwoods', theme: 'woods', path: [-240, -200, -160, -175], len: 200, glow: 0x40ff80, ground: 0x3a2e1c,
    actors: ['wendigo', 'lanternWraith', 'lanternWraith', 'wendigo', 'lanternWraith', 'lanternWraith'] },
  { name: 'BACKLOT BLOODBATH', land: 'Studios', theme: 'filmset', path: [0, -118, 0, -290], len: 150, glow: 0xff2030, ground: 0x2a1a1a,
    actors: ['slasher', 'zombieExtra', 'director', 'slasher', 'zombieExtra', 'slasher', 'zombieExtra'] },
  { name: 'BURNOUT BOULEVARD', land: 'Velocity', theme: 'wrecks', path: [130, -120, 215, -180], len: 200, glow: 0xff5a00, ground: 0x1c1a18,
    actors: ['racer', 'pitCrew', 'racer', 'pitCrew', 'racer', 'pitCrew'] },
  { name: 'FORTNITEMARES', land: 'Family', theme: 'storm', path: [112, 246, 300, 246], len: 170, glow: 0xb04aff, ground: 0x1e1428,
    actors: ['cubeMonster', 'husk', 'cubeMonster', 'husk', 'cubeMonster', 'husk', 'cubeMonster', 'cubeQueen', 'husk', 'cubeMonster', 'husk', 'cubeMonster', 'husk', 'cubeMonster', 'husk', 'cubeMonster'] },
];

// Each zone takes over a stretch of one of the land's main walkways: an
// arch at each end, its own colored ground, lights and fog down both
// edges, the theme's props wherever the ground beside the path is free,
// one big set piece, and scare actors prowling up and down.
export function buildScareZones(data) {
  const { add, box, sign } = helpers(data);
  const find = makeFinder(data);
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.scareActors = data.scareActors || [];
  data.hauntLights = data.hauntLights || [];
  const placed = [];
  for (const zone of SCARE_ZONES) {
    const [ax0, az0, ax1, az1] = zone.path;
    const full = Math.hypot(ax1 - ax0, az1 - az0);
    const d = [(ax1 - ax0) / full, (az1 - az0) / full], n = [-d[1], d[0]];
    const L = Math.min(zone.len || 60, full - 4);
    const t0 = (full - L) / 2;
    const at = (t, s) => [ax0 + d[0] * (t0 + t) + n[0] * s, az0 + d[1] * (t0 + t) + n[1] * s];
    const yaw = Math.atan2(d[0], d[1]); // local +Z runs along the zone
    const [cx, cz] = at(L / 2, 0);
    const G = find.groundAt(cx, cz);
    placed.push({ ...zone, x: cx, z: cz, len: L });
    const put = (size, px, pz, y, color, mat, opts = {}) => add(size, [px, G + y, pz], color, mat, { collide: 0, ...opts });
    // keep other walkways (and any crossing the zone leaves open) clear
    const others = WALKWAYS.filter(([a, b]) => Math.hypot(a.x - ax0, a.z - az0) + Math.hypot(b.x - ax1, b.z - az1) > 1);
    const offPath = (px, pz, r) => !others.some(([a, b]) => {
      const ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz;
      const u = Math.max(0, Math.min(1, ((px - a.x) * ux + (pz - a.z) * uz) / l2));
      return Math.hypot(a.x + ux * u - px, a.z + uz * u - pz) < 6 + r;
    }) && !(zone.gaps || []).some(([gx, gz, gr]) => Math.hypot(gx - px, gz - pz) < gr + r);
    const free = (px, pz, r) => offPath(px, pz, r) && find.clear(px, pz, r);
    // a prop beside the path on either side, wherever there is room; a
    // band of props (not a single row like a fence) gets a second, deeper
    // band behind it so the zone spills out over the land around the path
    const beside = (step, s0, s1, fn) => {
      let k = 0;
      const bands = s1 > s0 ? [[s0, s1, 0], [s1 + 3, s1 + 14, step / 2]] : [[s0, s1, 0]];
      for (const [b0, b1, shift] of bands) {
        for (let t = 2 + shift; t < L - 2; t += step) {
          for (const side of [-1, 1]) {
            for (let s = b0; s <= b1; s += 1.5) {
              const [px, pz] = at(t, side * s);
              if (free(px, pz, 1.4)) { fn(px, pz, side, k++, t); break; }
            }
          }
        }
      }
    };
    // the zone's ground, arches at both ends
    put([zone.width || 12, 0.04, L], cx, cz, 0.05, zone.ground, 'Ground', { yaw });
    for (const t of [0, L]) {
      const [gx, gz] = at(t, 0);
      for (const sd of [-1, 1]) {
        const [px, pz] = at(t, sd * 7);
        box([0.9, 12, 0.9], [px, G, pz], 0x101012, 'Metal', { yaw });
        put([1.4, 1.4, 1.4], px, pz, 12.6, zone.glow, 'Neon', { shape: 3 });
      }
      add([15, 2.8, 0.6], [gx, G + 10.6, gz], 0x101012, 'Metal', { yaw, collide: 0 });
      // the name faces the way people arrive
      const f = t === 0 ? -1 : 1;
      sign(zone.name, [14.2, 1.9, 0.2], [gx + d[0] * f * 0.35, G + 10.8, gz + d[1] * f * 0.35], 0x101012, zone.glow, f < 0 ? 'Front' : 'Back', 'GothamBlack', true, yaw);
      sign('BENTON HAUNT SCARE ZONE', [12, 0.6, 0.2], [gx + d[0] * f * 0.35, G + 9.5, gz + d[1] * f * 0.35], 0x101012, WHITE, f < 0 ? 'Front' : 'Back', 'GothamBold', false, yaw);
    }
    // lights and fog down both edges
    for (let t = 4; t < L - 2; t += 8) {
      for (const sd of [-1, 1]) {
        const [px, pz] = at(t + (sd > 0 ? 4 : 0), sd * 6.3);
        if (!free(px, pz, 0.6)) continue;
        if ((Math.round(t / 8) + (sd > 0 ? 1 : 0)) % 2) {
          box([0.25, 6, 0.25], [px, G, pz], 0x1a1a1c, 'Metal', { collide: 0 });
          put([1, 1, 1], px, pz, 6.3, zone.glow, 'Neon', { shape: 3 });
          data.hauntLights.push([px, G + 5.5, pz, zone.glow]);
        } else {
          box([1.2, 0.8, 1.6], [px, G, pz], 0x2a2a2e, 'Metal', { collide: 0 });
          data.tags.SteamVent.push([px, G + 0.9, pz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
        }
      }
    }
    const fireAt = (px, pz) => { box([1.6, 2, 1.6], [px, G, pz], 0x3a2a20, 'CorrodedMetal', { shape: 5 }); data.tags.Campfire.push([px, G + 2.4, pz, 1, 0, 0, 0, 1, 0, 0, 0, 1]); };
    // the big set piece: the best clear spot beside the middle of the zone
    const piece = (r) => {
      for (const s of [14, 17, 20, 11]) for (const sd of [1, -1]) for (const t of [L / 2, L * 0.35, L * 0.65]) {
        const [px, pz] = at(t, sd * s);
        if (free(px, pz, r)) return [px, pz, sd];
      }
      return null;
    };
    const T = zone.theme;
    if (T === 'graveyard') {
      beside(2.6, 7.5, 12, (px, pz, sd, k) => {
        if (k % 5 === 4) { box([0.9, 9, 0.9], [px, G, pz], 0x2a2018, 'Wood', { collide: 0 }); put([0.4, 0.4, 5], px, pz, 7.5, 0x2a2018, 'Wood', { yaw: yaw + k }); put([4, 0.4, 0.4], px, pz, 6, 0x2a2018, 'Wood', { yaw: yaw - k }); return; }
        box([0.6, 2.6 + (k % 3) * 0.6, 2], [px, G, pz], [0x8a8a86, 0x6a6a66, 0x9a9a92][k % 3], 'Concrete', { yaw: yaw + (k % 2 ? 0.15 : -0.1) });
        put([0.7, 0.5, 2.2], px, pz, 2.85 + (k % 3) * 0.6, 0x7a7a76, 'Slate', { yaw });
      });
      beside(1.6, 6.8, 6.8, (px, pz) => { box([0.16, 4, 0.16], [px, G, pz], 0x101012, 'Metal', { collide: 0 }); put([0.36, 0.36, 0.36], px, pz, 4.2, 0x101012, 'Metal', { shape: 3 }); });
      const m = piece(7);
      if (m) {
        const [mx, mz, sd] = m;
        box([7, 8, 10], [mx, G, mz], 0x6a6a66, 'Concrete', { yaw });
        put([8, 1, 11], mx, mz, 8.5, 0x5a5a56, 'Concrete', { yaw });
        put([5, 1.4, 8], mx, mz, 9.6, 0x5a5a56, 'Concrete', { yaw });
        const fx = mx - n[0] * sd * 3.6, fz = mz - n[1] * sd * 3.6; // the face toward the path
        put([0.2, 5, 3], fx, fz, 2.5, 0x050505, 'SmoothPlastic', { yaw });
        for (const u of [-3.4, 3.4]) box([1, 8, 1], [fx + d[0] * u - n[0] * sd * 0.6, G, fz + d[1] * u - n[1] * sd * 0.6], 0xd8d4c8, 'Concrete', { shape: 5, collide: 0 });
        put([0.6, 0.6, 0.6], fx - n[0] * sd * 0.4, fz - n[1] * sd * 0.4, 6, zone.glow, 'Neon', { shape: 3 });
        const k = piece(2.5);
        if (k) { box([3, 18, 3], [k[0], G, k[1]], 0x2a2a2e, 'Brick', { yaw }); put([0.3, 2.6, 2.6], k[0] - n[0] * k[2] * 1.6, k[1] - n[1] * k[2] * 1.6, 15, 0xf4f0e0, 'Neon', { shape: 2, yaw }); }
      }
    } else if (T === 'smokestacks') {
      beside(5, 7.5, 13, (px, pz, sd, k) => {
        if (k % 3 === 0) { const h = 14 + (k % 4) * 4; box([2.6, h, 2.6], [px, G, pz], 0x5a3a2a, 'CorrodedMetal', { shape: 5 }); put([3, 1, 3], px, pz, h - 1, 0x2a2a2e, 'Metal', { shape: 5 }); data.tags.SteamVent.push([px, G + h + 0.4, pz, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
        else if (k % 3 === 1) fireAt(px, pz);
        else for (let j = 0; j < 3; j++) box([1.4, 2.2, 1.4], [px + d[0] * j * 1.5, G, pz + d[1] * j * 1.5], j % 2 ? 0xc8322d : 0x3a3a3e, 'CorrodedMetal', { shape: 5 });
      });
      for (let t = 6; t < L - 4; t += 14) { const [px, pz] = at(t, 0); put([16, 0.9, 0.9], px, pz, 10.5, 0x6a4a3a, 'CorrodedMetal', { yaw, shape: 2 }); }
      beside(2.8, 6.8, 6.8, (px, pz, sd) => box([0.1, 7, 2.6], [px, G, pz], 0x8a8e96, 'Metal', { yaw }));
    } else if (T === 'cornfield') {
      beside(2.4, 7, 11, (px, pz, sd, k) => {
        if (k % 6 === 5) {
          box([0.3, 7, 0.3], [px, G, pz], 0x6a4a30, 'Wood', { collide: 0 });
          put([0.3, 0.3, 3.8], px, pz, 5.4, 0x6a4a30, 'Wood', { yaw });
          put([1.2, 1.3, 1.2], px, pz, 7, k % 4 ? 0xc8a868 : PUMPKIN, 'Fabric', { shape: 3 });
          put([0.9, 2.6, 1.7], px, pz, 4.4, [0x8a3a22, 0x3a5a8a, 0x5a6a2a][k % 3], 'Fabric', { yaw });
          return;
        }
        for (let j = 0; j < 2; j++) box([1.4, 6.5 + ((k + j) % 3) * 0.7, 2.2], [px + n[0] * sd * j * 1.5, G, pz + n[1] * sd * j * 1.5], [0x9a9a3a, 0x8a8a32, 0xa8a042][(k + j) % 3], 'Grass', { yaw, collide: 0 });
      });
      beside(7, 6.6, 6.6, (px, pz, sd, k) => (k % 2 ? box([3.6, 1.6, 2], [px, G, pz], 0xd8b850, 'Fabric', { yaw }) : [0, 1, 2].forEach((j) => put([1.4, 1.2, 1.4], px + d[0] * j * 1.4, pz + d[1] * j * 1.4, 0.6, PUMPKIN, 'SmoothPlastic', { shape: 3 }))));
      const w = piece(4);
      if (w) {
        box([4, 1.6, 7], [w[0], G + 1, w[1]], 0x6a4428, 'WoodPlanks', { yaw });
        for (const [du, dv] of [[-2.2, -2.4], [2.2, -2.4], [-2.2, 2.4], [2.2, 2.4]]) put([0.4, 2.2, 2.2], w[0] + n[0] * du + d[0] * dv, w[1] + n[1] * du + d[1] * dv, 1.1, 0x3a2a1a, 'Wood', { yaw, shape: 2 });
        for (let j = 0; j < 6; j++) put([1.3, 1.1, 1.3], w[0] + d[0] * (j - 2.5) * 1.1, w[1] + d[1] * (j - 2.5) * 1.1, 3.2, PUMPKIN, 'SmoothPlastic', { shape: 3 });
      }
    } else if (T === 'woods') {
      beside(3.4, 7, 13, (px, pz, sd, k) => {
        if (k % 3 === 2) { box([0.2, 6, 0.2], [px, G, pz], 0x1a1a1c, 'Metal', { collide: 0 }); put([0.7, 1, 0.7], px, pz, 6.3, zone.glow, 'Neon'); return; }
        const h = 10 + (k % 3) * 3;
        box([1.1, h, 1.1], [px, G, pz], 0x2a2018, 'Wood', { shape: 5, collide: 0 });
        put([0.4, 0.4, 5], px, pz, h - 2, 0x2a2018, 'Wood', { yaw: k });
        put([4.5, 0.35, 0.35], px, pz, h - 4, 0x2a2018, 'Wood', { yaw: k * 1.7 });
        put([0.35, 3.5, 0.35], px, pz, h - 1, 0x2a2018, 'Wood', { yaw: k, rot: [Math.cos(0.6), -Math.sin(0.6), 0, Math.sin(0.6), Math.cos(0.6), 0, 0, 0, 1] });
      });
      const a = piece(4);
      if (a) {
        box([5, 1.4, 3], [a[0], G, a[1]], 0x5a5a56, 'Slate', { yaw });
        for (const u of [-3, 3]) { const tx = a[0] + d[0] * u, tz = a[1] + d[1] * u; box([1.4, 6, 1.4], [tx, G, tz], 0x4a4440, 'Slate', { yaw }); put([1.6, 1.4, 1.4], tx, tz, 6.5, 0xd8d0bc, 'SmoothPlastic', { shape: 3 }); }
        put([0.6, 0.6, 0.6], a[0], a[1], 2, zone.glow, 'Neon', { shape: 3 });
      }
    } else if (T === 'filmset') {
      beside(4.5, 7, 11, (px, pz, sd, k) => {
        if (k % 3 === 0) { box([0.2, 6, 0.2], [px, G, pz], 0x2a2a2e, 'Metal', { collide: 0 }); put([1.4, 2, 2], px, pz, 6.6, 0x2a2a2e, 'Metal', { yaw }); put([0.1, 1.8, 1.8], px - n[0] * sd * 1.05, pz - n[1] * sd * 1.05, 6.6, 0xfff6d8, 'Neon', { yaw }); }
        else if (k % 3 === 1) box([1.6, 2.2, 1.6], [px, G, pz], 0x8a0a0a, 'CorrodedMetal', { shape: 5 });
        else { box([1.8, 1.6, 1.6], [px, G, pz], 0x6a4a30, 'Wood', { collide: 0 }); put([1.8, 1.4, 0.15], px, pz, 2.4, 0x101012, 'Fabric', { yaw }); }
      });
      beside(3, 6.4, 6.4, (px, pz) => put([0.1, 0.2, 3], px, pz, 2.8, 0xf2c818, 'SmoothPlastic', { yaw }));
      const m = piece(6);
      if (m) {
        const [mx, mz, sd] = m;
        box([2, 9, 16], [mx, G, mz], 0x8a7a5a, 'WoodPlanks', { yaw });
        const fx = mx - n[0] * sd * 1.05, fz = mz - n[1] * sd * 1.05;
        for (const u of [-5, 0, 5]) put([0.1, 5, 2.4], fx + d[0] * u, fz + d[1] * u, 2.5, 0x2a1a14, 'Wood', { yaw });
        sign('VACANCY', [0.2, 1.4, 6], [fx, G + 7.4, fz], 0x101012, 0xff2030, sd > 0 ? 'Right' : 'Left', 'GothamBlack', true, yaw);
      }
    } else if (T === 'storm') {
      // Fortnitemares: supply drops, loot llamas, half-built walls and
      // ramps, purple cubes, the Storm closing in, a crashed Battle Bus
      const PURP = 0xb04aff, BLUE = 0x2a6ae0, ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      const tilt = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a) * Math.cos(a), Math.cos(a) * Math.cos(a), -Math.sin(a), Math.sin(a) * Math.sin(a), Math.cos(a) * Math.sin(a), Math.cos(a)];
      const llama = (px, pz, k) => {
        const L2 = (u, v) => [px + d[0] * u + n[0] * v, pz + d[1] * u + n[1] * v];
        box([1.6, 1.6, 2.6], [px, G + 1.8, pz], 0x8a4ad8, 'SmoothPlastic', { yaw });
        put([1.7, 0.3, 1.2], px, pz, 3.45, 0xf2c818, 'SmoothPlastic', { yaw });
        for (const [u, v] of [[-0.9, -0.5], [-0.9, 0.5], [0.9, -0.5], [0.9, 0.5]]) { const [lx, lz] = L2(u, v); put([0.4, 1.9, 0.4], lx, lz, 0.95, 0x6a2ab8, 'SmoothPlastic', { yaw }); }
        let [hx, hz] = L2(1.2, 0); put([0.7, 1.8, 0.7], hx, hz, 4, 0x8a4ad8, 'SmoothPlastic', { yaw });
        [hx, hz] = L2(1.5, 0); put([0.9, 0.9, 1.5], hx, hz, 5.1, 0x8a4ad8, 'SmoothPlastic', { yaw });
        for (const v of [-0.3, 0.3]) { const [ex, ez] = L2(1.3, v); put([0.2, 0.7, 0.2], ex, ez, 5.9, 0x6a2ab8, 'SmoothPlastic', { yaw }); }
        // one llama in three is not a pinata
        for (const v of [-0.3, 0.3]) { const [ex, ez] = L2(2.2, v); put([0.18, 0.18, 0.1], ex, ez, 5.3, k % 3 === 1 ? 0xff1a1a : 0x101012, k % 3 === 1 ? 'Neon' : 'SmoothPlastic', { yaw }); }
      };
      beside(5, 7.5, 13, (px, pz, sd, k) => {
        const j = k % 4;
        if (j === 0) { // a supply drop, torn open, still smoking blue
          box([3, 2.6, 3], [px, G, pz], BLUE, 'Metal', { yaw: yaw + k });
          put([0.2, 2.7, 3.1], px, pz, 1.3, 0xf2c818, 'SmoothPlastic', { yaw: yaw + k });
          put([3.2, 0.3, 3.2], px + 0.6, pz, 3.2, 0xe8e8f0, 'Metal', { rot: tilt(0.5) });
          data.tags.SteamVent.push([px, G + 3, pz, ...ID]);
        } else if (j === 1) llama(px, pz, k);
        else if (j === 2) { // half-built walls and a ramp
          box([0.4, 4, 4], [px, G, pz], 0x9a6a3a, 'WoodPlanks', { yaw: yaw + Math.PI / 2 });
          put([4, 4, 4], px + d[0] * 4, pz + d[1] * 4, 2, 0x8a5a30, 'WoodPlanks', { shape: 1, yaw: yaw + (k % 2 ? 0 : Math.PI) });
        } else { // a purple cube hovering over its rune
          put([2.4, 2.4, 2.4], px, pz, 3.6 + (k % 3), PURP, 'Neon', { rot: tilt(0.6 + k) });
          put([3.6, 0.06, 3.6], px, pz, 0.08, PURP, 'Neon', { yaw: yaw + 0.78 });
          data.hauntLights.push([px, G + 3, pz, PURP]);
        }
      });
      // the Storm: a wall of purple closing in along the far edge
      beside(4, 16, 16, (px, pz) => put([0.3, 18, 4.2], px, pz, 9, 0x7a2ad8, 'Glass', { yaw, trans: 0.55 }));
      // big cubes floating over the path
      for (let t = 12; t < L - 6; t += 28) { const [px, pz] = at(t, 0); put([4, 4, 4], px, pz, 17, PURP, 'Neon', { rot: tilt(0.4 + t) }); data.hauntLights.push([px, G + 14, pz, PURP]); }
      // the crashed Battle Bus and its torn balloon
      const qpts = data.rides.flatMap((rd) => { const q = rd.queue?.points || []; const o = []; for (let i = 0; i + 1 < q.length; i += 2) o.push([q[i], q[i + 1]]); return o; });
      const offQueue = (px, pz, r) => !qpts.some(([qx, qz]) => Math.hypot(qx - px, qz - pz) < r + 10);
      const near = (r) => { const f = find(cx, cz, r, [[70, -60, 375, 280]]); if (!f || Math.hypot(f[0] - cx, f[1] - cz) > 45 || !offPath(f[0], f[1], r) || !offQueue(f[0], f[1], r)) return null; return [f[0], f[1], Math.sign((f[0] - cx) * n[0] + (f[1] - cz) * n[1]) || 1]; };
      const b = piece(9) || near(9) || near(7);
      if (b) {
        const [bx, bz, sd] = b, cy = Math.cos(yaw), sy = Math.sin(yaw), r = 0.35 * sd, cr = Math.cos(r), sr = Math.sin(r);
        const M = [cy * cr, -cy * sr, sy, sr, cr, 0, -sy * cr, sy * sr, cy];
        const off = (u, v) => [bx + M[0] * u + M[1] * v, G + 3.8 + M[3] * u + M[4] * v, bz + M[6] * u + M[7] * v];
        add([7, 7, 20], [bx, G + 3.8, bz], BLUE, 'SmoothPlastic', { rot: M });
        add([7.1, 1.8, 18], off(0, 1.4), 0x10141c, 'Glass', { rot: M, collide: 0 });
        add([7.2, 0.5, 20.2], off(0, -1.6), 0xf2c818, 'SmoothPlastic', { rot: M, collide: 0 });
        for (const w of [-7, 7]) for (const u of [-3.6, 3.6]) { const p = off(u, -3.4); add([1, 2.6, 2.6], [p[0] + d[0] * w, p[1], p[2] + d[1] * w], 0x111111, 'Rubber', { shape: 2, rot: M, collide: 0 }); }
        const [gx, gz] = [bx + d[0] * 15, bz + d[1] * 15];
        put([9, 9, 9], gx, gz, 1.5, BLUE, 'Fabric', { shape: 3 });
        put([9.4, 1, 9.4], gx, gz, 2.2, 0xe8e8f0, 'Fabric', { shape: 5 });
        for (const v of [-2, 2]) { const p = off(v, 3.6); put([0.12, 0.12, 12], (p[0] + gx) / 2, (p[2] + gz) / 2, 4, 0x2a2a2e, 'Metal', { yaw }); }
        data.tags.SteamVent.push([bx - d[0] * 10, G + 4, bz - d[1] * 10, ...ID]);
        fireAt(bx - d[0] * 12 - n[0] * sd * 2, bz - d[1] * 12 - n[1] * sd * 2);
        data.hauntLights.push([bx, G + 6, bz, 0xff6a20]);
      }
      // a torn, burning Victory Royale banner: nobody won this one
      let v = null;
      for (const s of [11, 14, 9, 17]) for (const sd of [-1, 1]) for (let f = 0.9; f > 0.05; f -= 0.1) {
        const [px, pz] = at(L * f, sd * s);
        if (!v && free(px, pz, 3) && offQueue(px, pz, 3) && (!b || Math.hypot(px - b[0], pz - b[1]) > 16)) v = [px, pz, sd];
      }
      if (v) {
        const [vx, vz, sd] = v;
        for (const u of [-4.5, 4.5]) box([0.4, 8, 0.4], [vx + d[0] * u, G, vz + d[1] * u], 0x1a1a1c, 'Metal', { collide: 0 });
        sign('VICTORY ROYALE', [0.2, 2.2, 9], [vx, G + 6.4, vz], 0x1a0a2a, 0xf2c818, sd > 0 ? 'Right' : 'Left', 'GothamBlack', true, yaw);
        put([0.25, 1.2, 3], vx + d[0] * 2.6, vz + d[1] * 2.6, 5.4, 0x0a0a0a, 'SmoothPlastic', { yaw });
        fireAt(vx + d[0] * 3, vz + d[1] * 3);
      }
    } else {
      beside(4.5, 7, 12, (px, pz, sd, k) => {
        if (k % 3 === 0) { box([4.6, 2.4, 9], [px, G + 0.5, pz], 0x2a2420, 'CorrodedMetal', { yaw: yaw + k * 0.4 }); box([4, 1.8, 4.6], [px, G + 2.9, pz], 0x1a1612, 'CorrodedMetal', { yaw: yaw + k * 0.4 }); }
        else if (k % 3 === 1) fireAt(px, pz);
        else for (let j = 0; j < 4; j++) put([2.4, 0.8, 2.4], px, pz, 0.4 + j * 0.8, 0x1a1a1a, 'Rubber', { shape: 5 });
      });
      beside(2.8, 6.4, 6.4, (px, pz, sd, k) => box([0.8, 1.4, 0.8], [px, G, pz], 0xff6a10, 'SmoothPlastic', { collide: 0 }));
      beside(3, 7.6, 7.6, (px, pz, sd, k) => box([0.8, 1.6, 2.8], [px, G, pz], k % 2 ? 0xf2c818 : 0x1a1a1a, 'SmoothPlastic', { yaw }));
    }
    // the scare actors, prowling up and down the zone
    // about one actor every 11 studs, cycling through the zone's cast
    const cast = Array.from({ length: Math.max(zone.actors.length, Math.round(L / 11)) }, (_, k) => zone.actors[k % zone.actors.length]);
    cast.forEach((costume, k) => {
      const [px, pz] = at(((k + 0.5) / cast.length) * L, (k % 2 ? 1 : -1) * 2.5);
      data.scareActors.push({ costume, x: px, z: pz, y: G, mode: 'roam', radius: 9, land: zone.land });
    });
  }
  return placed;
}

// ------------------------------------------------------------------ food
// Graveyard Grub: the Benton Haunt food stand on the backstage avenue,
// with a seasonal menu (each treat is modeled on one of the park's own
// and painted for Halloween).
const MENU = [
  { id: 'PumpkinChurro', base: 'DieselDog', name: 'Pumpkin Spice Churro', description: 'A foot of fried dough rolled in pumpkin spice sugar.', price: 14, hunger: 25, bites: 3, colors: [0xd87a20, 0x8a4a1a] },
  { id: 'MonsterBurger', base: 'DepotBurger', name: 'Monster Burger', description: 'Two patties on a green monster bun. Fills you right up.', price: 34, hunger: 65, bites: 4, colors: [0x6aa83a, 0x3a2010] },
  { id: 'WitchsBrew', base: 'TurboShake', name: "Witch's Brew Slushie", description: 'Purple, fizzy and bubbling. Levitation (jump) boost!', price: 16, hunger: 15, bites: 2, colors: [0x7a3ab8, 0x6aff6a], buff: { kind: 'jump', duration: 45, amount: 14 } },
  { id: 'DirtCup', base: 'Popcorn', name: 'Graveyard Dirt Cup', description: 'Chocolate pudding, cookie "dirt" and gummy worms.', price: 12, hunger: 20, bites: 3, colors: [0x1a1a1c, 0x4a2a14] },
  { id: 'FunnelCake', base: 'CinnamonRoll', name: 'Bloody Funnel Cake', description: 'Powdered sugar and a splash of strawberry "blood".', price: 18, hunger: 35, bites: 3, colors: [0xe8d8a0, 0xc01a1a] },
  { id: 'HauntedCocoa', base: 'Coffee', name: 'Haunted Hot Cocoa', description: 'Spooky-strong cocoa with ghost marshmallows. Speed boost!', price: 10, hunger: 10, bites: 2, colors: [0xf4f4f0, 0x5a3420], buff: { kind: 'speed', duration: 45, amount: 5 } },
];

export function buildHauntFood(data) {
  const { add, box, sign, spot } = helpers(data);
  const cfgItems = data.config.Items;
  for (const m of MENU) {
    const base = cfgItems.find((i) => i.id === m.base);
    const model = data.items.find((i) => i.id === m.base);
    if (!base || !model) continue;
    // repaint: the base item's own colors map to the new ones; failing
    // that, its model's distinct colors in order
    const seen = [];
    for (const p of model.preview || []) if (!seen.includes(p[16])) seen.push(p[16]);
    const matched = seen.some((c) => base.colors.includes(c));
    const from = matched ? base.colors : seen;
    const recolor = (parts) => parts.map((p) => {
      const q = p.slice();
      const k = from.indexOf(p[16]);
      if (k >= 0 && m.colors[k] !== undefined) q[16] = m.colors[k];
      return q;
    });
    const { base: _b, ...item } = m;
    cfgItems.push({ ...item, kind: 'food', shape: base.shape });
    data.items.push({ id: m.id, preview: recolor(model.preview || []), wear: recolor(model.wear || model.preview || []) });
  }
  // the stand: open counter facing the avenue, a pumpkin-orange awning,
  // a lit sign, a menu board and tables out front
  const X = -10, Z = -428, W = 36, D = 22, H = 12, front = Z - D / 2;
  const WALL = 0x2a2226;
  box([W, H, 1], [X, G, Z + D / 2 - 0.5], WALL, 'WoodPlanks');
  for (const sx of [-1, 1]) box([1, H, D], [X + sx * (W / 2 - 0.5), G, Z], WALL, 'WoodPlanks');
  for (const sx of [-1, 1]) box([7, H, 1], [X + sx * (W / 2 - 3.5), G, front + 0.5], WALL, 'WoodPlanks');
  box([W - 14, 4, 1], [X, G + H - 4, front + 0.5], WALL, 'WoodPlanks');
  box([W - 14, 3.4, 2], [X, G, front + 1.2], 0x3a2a24, 'Wood'); // the counter
  add([W - 14, 0.3, 2.4], [X, G + 3.55, front + 1.2], 0xd8c8a8, 'Concrete', { collide: 0 });
  add([W + 1, 1, D + 1], [X, G + H + 0.5, Z], 0x1a1a1c, 'Concrete', { collide: 0 });
  for (let k = 0; k < 8; k++) add([(W - 14) / 8, 0.3, 4], [X - (W - 14) / 2 + (k + 0.5) * ((W - 14) / 8), G + H - 4.4, front - 1.8], k % 2 ? 0x1a1a1c : 0xff7a1a, 'Fabric', { collide: 0, rot: [1, 0, 0, 0, 0.96, 0.28, 0, -0.28, 0.96] });
  sign('GRAVEYARD GRUB', [W - 6, 2.8, 0.2], [X, G + H + 2.2, front - 0.2], BLACK, ORANGE, 'Front', 'GothamBlack', true);
  add([W - 6, 3.4, 0.4], [X, G + H + 2.2, front + 0.1], BLACK, 'Metal', { collide: 0 });
  sign('MONSTER BURGERS  ·  WITCH\'S BREW  ·  DIRT CUPS  ·  FUNNEL CAKES', [W - 16, 1.2, 0.2], [X, G + H - 2.2, front - 0.1], BLACK, WHITE, 'Front', 'GothamBold', true);
  // jack-o'-lanterns along the counter and tombstones at the corners
  for (let k = 0; k < 5; k++) {
    add([1.4, 1.2, 1.4], [X - 8 + k * 4, G + 4.3, front + 1.2], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
    add([0.5, 0.3, 0.1], [X - 8 + k * 4, G + 4.4, front + 0.48], 0xffd27a, 'Neon', { collide: 0 });
  }
  for (const sx of [-1, 1]) {
    box([2, 3, 0.6], [X + sx * (W / 2 + 2), G, front + 2], 0x8a8a86, 'Concrete');
    add([2, 0.6, 0.6], [X + sx * (W / 2 + 2), G + 3.3, front + 2], 0x8a8a86, 'Concrete', { shape: 2, collide: 0 });
  }
  // picnic tables with orange umbrellas
  for (const [tx, tz] of [[X - 14, front - 12], [X, front - 14], [X + 14, front - 12]]) {
    box([6, 0.3, 3], [tx, G + 2.6, tz], 0x3a2a24, 'Wood');
    box([0.4, 2.6, 0.4], [tx, G, tz], 0x3a2a24, 'Wood', { collide: 0 });
    for (const dz of [-2.4, 2.4]) box([6, 0.3, 1], [tx, G + 1.6, tz + dz], 0x3a2a24, 'Wood', { collide: 0 });
    box([0.2, 6, 0.2], [tx, G + 2.9, tz], 0x2a2a2e, 'Metal', { collide: 0 });
    add([7, 0.4, 7], [tx, G + 8.9, tz], 0xff7a1a, 'Fabric', { shape: 3, collide: 0 });
  }
  data.config.Venues.push({
    id: 'GraveyardGrub', name: 'Graveyard Grub', kind: 'restaurant', land: 'Studios', facing: 'N',
    description: "Benton Haunt eats: monster burgers, witch's brew, dirt cups and bloody funnel cakes.",
    items: MENU.map((m) => m.id), color: 0xff7a1a, position: [X, 0, Z], size: [W, H, D],
  });
  data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: 'GraveyardGrub', land: 'Studios', seed: 0, cf: [X, G, front + 3.4, 1, 0, 0, 0, 1, 0, 0, 0, 1] });
}
