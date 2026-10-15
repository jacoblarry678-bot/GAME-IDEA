// Backstage: a huge lot behind the Studios wall, reached through a gate
// between two of the wall's pillars. Five giant soundstages hold most of
// the Benton Haunt houses, each with a big switchback queue on turf behind
// black "Benton Haunt" barricades. Right now the crews are setting up for
// the event: house facades half built and half painted, scaffolds and
// scissor lifts, barricade lines still going in, production trailers,
// road cases, a makeup tent and pallets of pumpkins, coffins, tombstones
// and scarecrows waiting to go out.
import * as THREE from 'three';

export const BS = { x0: -250, x1: 250, z0: -700, z1: -405 };
const GATE = { x0: -81, x1: -44 }; // between the wall pillars at x -83.3 and -41.7
const G = 0.1; // top of the backstage paving
const STAGE_Z = -605; // front faces of the soundstages
const QUEUE = { z0: -597, z1: -505 }; // the turf queue areas in front of them

export const HOUSES = [
  { name: "DEAD MAN'S GARAGE", theme: 'garage', color: 0x3a3e46 },
  { name: 'THE LOST MINERS OF BACKWOODS HOLLOW', theme: 'mine', color: 0x4a3626 },
  { name: 'FINAL CUT: A HOLLYWOOD HORROR', theme: 'film', color: 0x6a1a22 },
  { name: 'CRASH TEST', theme: 'crash', color: 0x2a2a2e },
  { name: 'LIGHTS OUT AT LAKESIDE', theme: 'lodge', color: 0x5a3a24 },
];

export function buildBackstage(data) {
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
  const sign = (text, size, center, bg, fg, face, font = 'GothamBlack', glow = false) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0 });
    data.signs.push({ part: i, face, glow, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const STONE = 0x96928c, CAP = 0xc4beb4, BLACK = 0x101012, ORANGE = 0xff7a1a, PUMPKIN = 0xd85400, WHITE = 0xf4f4f0;
  const STEEL = 0xb8bcc0, PLY = 0xc8a878;
  const crew = [];

  // ---- open the gate in the south wall, clear the lot and level it
  data.hidden = data.hidden || [];
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 405) < 0.5 && p[3] > 600; // the south wall and its cap
    const scenery = p[6] < -407 && inRect(p[4], p[6], BS, 4);
    if (wall || scenery) { p[19] = 0; data.hidden.push(i); }
  });
  const parkWall = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  parkWall(-375, -405, GATE.x0, -405);
  parkWall(GATE.x1, -405, 375, -405);
  parkWall(BS.x0, BS.z1, BS.x0, BS.z0);
  parkWall(BS.x0, BS.z0, BS.x1, BS.z0);
  parkWall(BS.x1, BS.z0, BS.x1, BS.z1);
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], BS, 8));
  data.flatZones = [...(data.flatZones || []), { ...BS, margin: 26 }];
  // the whole lot is paved
  add([BS.x1 - BS.x0, 1, BS.z1 - BS.z0], [(BS.x0 + BS.x1) / 2, G - 0.5, (BS.z0 + BS.z1) / 2], 0x3e3f44, 'Asphalt');
  // a yellow line down the service avenue
  for (let x = BS.x0 + 6; x < BS.x1 - 6; x += 12) add([6, 0.04, 0.4], [x, G + 0.02, -476], 0xe8c040, 'SmoothPlastic', { collide: 0 });

  // ---- the gate: a black arch with the event's name, searchlights, fog
  const gx = (GATE.x0 + GATE.x1) / 2, gw = GATE.x1 - GATE.x0;
  for (const x of [GATE.x0 + 1.5, GATE.x1 - 1.5]) {
    box([3, 19, 3], [x, G, -409], BLACK, 'Metal');
    for (let k = 0; k < 3; k++) add([1.6, 1.4, 1.6], [x + (k - 1) * 1.8, G + 0.7, -406.9], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
  }
  add([gw, 3.4, 2], [gx, G + 20.6, -409], BLACK, 'Metal', { collide: 0 });
  sign('BENTON HAUNT  ·  BACKSTAGE', [gw - 2, 2.6, 0.2], [gx, G + 20.6, -407.9], BLACK, ORANGE, 'Back', 'GothamBlack', true);
  sign('BENTON HAUNT  ·  BACKSTAGE', [gw - 2, 2.6, 0.2], [gx, G + 20.6, -410.1], BLACK, ORANGE, 'Front', 'GothamBlack', true);
  sign('NOW SETTING UP  ·  6 HOUSES  ·  6 SCARE ZONES  ·  THROUGH NOV 2', [gw - 4, 1.2, 0.2], [gx, G + 17.9, -407.9], BLACK, WHITE, 'Back', 'GothamBold');
  data.tags.Searchlight = data.tags.Searchlight || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  for (const x of [GATE.x0 - 4, GATE.x1 + 4]) {
    box([2.4, 1.6, 2.4], [x, G, -412], 0x2a2a2e, 'Metal');
    data.tags.Searchlight.push([x, G + 2.2, -412, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  for (const x of [GATE.x0 + 5, GATE.x1 - 5]) {
    box([1.4, 1, 2], [x, G, -414], 0x2a2a2e, 'Metal');
    data.tags.SteamVent.push([x, G + 1, -414, 1, 0, 0, 0, 1, 0, 0, 0, 1]); // fog machines being tested
  }

  // ---- bike-rack barricades: steel rails on posts, with black covers
  const barricade = (xa, xb, z, { covers = false, unfinished = false } = {}) => {
    const len = xb - xa, n = Math.max(1, Math.round(len / 7));
    for (let k = 0; k <= n; k++) box([0.18, 3.4, 0.18], [xa + (len * k) / n, G, z], STEEL, 'Metal');
    if (unfinished) return; // posts only, rails still on the cart
    add([len, 0.14, 0.14], [(xa + xb) / 2, G + 3.3, z], STEEL, 'Metal', { collide: 0 });
    add([len, 0.14, 0.14], [(xa + xb) / 2, G + 0.6, z], STEEL, 'Metal', { collide: 0 });
    for (let k = 0; k < n; k++) {
      const x = xa + (len * (k + 0.5)) / n;
      add([0.06, 2.6, 0.06], [x - 1.6, G + 1.95, z], STEEL, 'Metal', { collide: 0 });
      add([0.06, 2.6, 0.06], [x + 1.6, G + 1.95, z], STEEL, 'Metal', { collide: 0 });
      if (covers) sign('BENTON HAUNT', [len / n - 0.6, 2.4, 0.08], [x, G + 1.95, z + 0.12], BLACK, WHITE, 'Back', 'GothamBold');
    }
  };
  const barricadeZ = (x, za, zb) => {
    const len = zb - za, n = Math.max(1, Math.round(len / 7));
    for (let k = 0; k <= n; k++) box([0.18, 3.4, 0.18], [x, G, za + (len * k) / n], STEEL, 'Metal');
    add([0.14, 0.14, len], [x, G + 3.3, (za + zb) / 2], STEEL, 'Metal', { collide: 0 });
    add([0.14, 0.14, len], [x, G + 0.6, (za + zb) / 2], STEEL, 'Metal', { collide: 0 });
  };
  // a cart of barricades waiting to go in
  const cart = (x, z) => {
    box([7, 0.6, 2.4], [x, G + 0.3, z], 0x3a3a3e, 'Metal');
    for (let k = 0; k < 8; k++) add([6.6, 3.2, 0.1], [x, G + 2.5, z - 0.9 + k * 0.25], k % 3 ? STEEL : BLACK, 'Metal', { collide: 0 });
    for (const dx of [-3, 3]) add([0.5, 0.6, 0.6], [x + dx, G + 0.3, z], 0x1a1a1a, 'Rubber', { shape: 2, collide: 0 });
  };

  // ---- the soundstages, their houses and queues
  const TAN = 0xe6cc94, ROSE = 0xc07a76, MAROON = 0x8e4656;
  HOUSES.forEach((house, i) => {
    const x = -200 + i * 100;
    const W = 76, D = 90, Hs = 40, cz = STAGE_Z - D / 2;
    box([W, Hs, D], [x, G, cz], TAN, 'Concrete');
    add([W + 0.6, 5, D + 0.6], [x, G + 2.5, cz], ROSE, 'Concrete', { collide: 0 });
    add([W + 1, 1, D + 1], [x, G + Hs + 0.5, cz], 0xd8bc84, 'Concrete', { collide: 0 });
    // stepped art deco parapet over the front, and maroon pilasters
    add([46, 4, 2], [x, G + Hs + 2, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    add([26, 4, 2], [x, G + Hs + 6, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    add([10, 3, 2], [x, G + Hs + 9.5, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    for (const dx of [-34, -23, 23, 34]) box([3, Hs, 1.2], [x + dx, G, STAGE_Z + 0.5], MAROON, 'Concrete', { collide: 0 });
    sign(`STAGE ${21 + i}`, [7, 2, 0.2], [x - 28.5, G + 33, STAGE_Z + 1.2], MAROON, WHITE, 'Back', 'GothamBold');
    // the big roll-up door, half open
    add([18, 20, 0.3], [x, G + 10, STAGE_Z + 0.2], 0x3a3a3e, 'Metal', { collide: 0 });
    add([18, 10, 0.4], [x, G + 5, STAGE_Z + 0.3], 0x0c0c0e, 'SmoothPlastic', { collide: 0 });
    // the house name hangs high on the stage (the middle stage carries the
    // big Benton Haunt banner instead)
    if (i === 2) {
      sign('BENTON HAUNT', [54, 9, 0.3], [x, G + 29, STAGE_Z + 0.4], BLACK, ORANGE, 'Back', 'GothamBlack');
      sign('6 HOUSES  ·  6 SCARE ZONES  ·  THROUGH NOVEMBER 2', [54, 2.6, 0.3], [x, G + 22.6, STAGE_Z + 0.4], BLACK, WHITE, 'Back', 'GothamBold');
    } else {
      sign(house.name, [44, 4.4, 0.3], [x, G + 27, STAGE_Z + 0.4], BLACK, ORANGE, 'Back', 'GothamBlack');
    }

    // the house facade in front of the door: half built, half painted
    const fz = STAGE_Z + 4;
    box([30, 16, 1.2], [x, G, fz], PLY, 'WoodPlanks');
    box([15, 16, 1.3], [x - 7.5, G, fz + 0.05], house.color, 'SmoothPlastic');
    add([6, 9, 0.3], [x, G + 4.5, fz + 0.7], 0x0a0a0c, 'SmoothPlastic', { collide: 0 });
    sign(house.name, [26, 2, 0.2], [x, G + 14, fz + 0.75], BLACK, house.theme === 'garage' ? 0xff3030 : ORANGE, 'Back', 'GothamBlack', house.theme === 'garage');
    // scaffold on the unpainted half, a painter on top
    for (const [dx, dz] of [[2, 1.4], [14, 1.4], [2, 4], [14, 4]]) box([0.25, 15, 0.25], [x + dx, G, fz + dz], 0xb8b8b4, 'Metal', { collide: 0 });
    for (const y of [7, 14]) box([12.4, 0.25, 2.8], [x + 8, G + y, fz + 2.7], 0x8a6a44, 'WoodPlanks', { collide: 0 });
    crew.push(['work', x + 8, G + 14.25, fz + 2, 0], ['work', x - 9, G, fz + 3, 0]);
    // theme props
    const T = house.theme;
    if (T === 'garage') {
      box([10, 3, 5], [x - 18, G + 0.8, fz + 6], 0x6a2a20, 'CorrodedMetal');
      box([6, 2.2, 4.6], [x - 18.5, G + 3.8, fz + 6], 0x5a2a20, 'CorrodedMetal');
      for (const dx of [-3.4, 3.4]) for (const dz of [-2.6, 2.6]) add([1.6, 1.6, 0.8], [x - 18 + dx, G + 0.8, fz + 6 + dz], 0x1a1a1a, 'Rubber', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
      for (let k = 0; k < 4; k++) add([2.4, 0.8, 2.4], [x + 18, G + 0.4 + k * 0.8, fz + 4], 0x1a1a1a, 'Rubber', { shape: 5 });
    } else if (T === 'mine') {
      for (const dx of [-4, 4]) box([1.2, 11, 1.2], [x + dx, G, fz + 1.2], 0x3a2a1c, 'Wood');
      add([10, 1.4, 1.4], [x, G + 11.7, fz + 1.2], 0x3a2a1c, 'Wood');
      box([4, 2.4, 3], [x - 12, G + 0.6, fz + 6], 0x5a5e66, 'CorrodedMetal');
      for (const dx of [-6, 6]) add([0.6, 0.9, 0.6], [x + dx, G + 9, fz + 1], 0xffb040, 'Neon', { collide: 0 });
    } else if (T === 'film') {
      add([22, 3, 3], [x, G + 18.5, fz + 1.6], 0x1a1a1c, 'Metal', { collide: 0 });
      for (let k = 0; k < 16; k++) add([0.4, 0.4, 0.4], [x - 10.5 + k * 1.4, G + 17, fz + 3.2], 0xfff2c0, 'Neon', { shape: 3, collide: 0 });
      sign('NOW SHOWING', [12, 1.6, 0.2], [x, G + 18.5, fz + 3.15], 0xfaf3e0, 0x8a1c22, 'Back', 'GothamBold');
      add([0.6, 5, 5], [x + 18, G + 2.6, fz + 5], 0x2a2a2e, 'Metal', { shape: 2, collide: 0 });
    } else if (T === 'crash') {
      for (let k = 0; k < 6; k++) box([2.5, 6, 1.4], [x - 21 + k * 2.5, G, fz + 4], k % 2 ? 0xf2c818 : 0x1a1a1c, 'SmoothPlastic');
      box([1.4, 2.6, 1], [x + 18, G + 1, fz + 5], 0xf2c818, 'SmoothPlastic');
      add([1, 1, 1], [x + 18, G + 4.3, fz + 5], 0xf2c818, 'SmoothPlastic', { shape: 3 });
      box([1.6, 1, 1.2], [x + 18, G, fz + 5], 0x2a2a2e, 'SmoothPlastic');
    } else {
      for (let k = 0; k < 6; k++) add([20, 1.2, 1.2], [x - 9, G + 0.6 + k * 1.3, fz + 1.8], 0x6a4428, 'Wood', { shape: 2, collide: 0 });
      add([2, 0.8, 9], [x + 18, G + 0.4, fz + 6], 0x8a3a22, 'Wood', { collide: 0 });
    }

    // the queue: turf, a switchback of barricades, black covers out front
    const qx0 = x - 35, qx1 = x + 35;
    add([qx1 - qx0 + 2, 0.15, QUEUE.z1 - QUEUE.z0], [x, G + 0.08, (QUEUE.z0 + QUEUE.z1) / 2], 0x2f6a2a, 'SmoothPlastic', { collide: 0 });
    for (let z = QUEUE.z0 + 10; z < QUEUE.z1; z += 20) add([qx1 - qx0 + 2, 0.02, 3], [x, G + 0.17, z], 0x9a9a96, 'SmoothPlastic', { collide: 0 });
    barricade(qx0 + 8, qx1, QUEUE.z1, { covers: true }); // the way in is at the west end
    barricadeZ(qx0, QUEUE.z0, QUEUE.z1);
    barricadeZ(qx1, QUEUE.z0, QUEUE.z1);
    const rows = Math.floor((QUEUE.z1 - QUEUE.z0) / 7);
    const done = 6 + ((i * 3) % 5); // the crews are partway down each maze
    for (let k = 1; k < rows; k++) {
      const z = QUEUE.z1 - k * 7;
      const xa = k % 2 ? qx0 : qx0 + 7, xb = k % 2 ? qx1 - 7 : qx1;
      barricade(xa, xb, z, { unfinished: k > done });
    }
    cart(x + 26, QUEUE.z1 - (done + 1.5) * 7);
    crew.push(['work', x + 20, G, QUEUE.z1 - (done + 1) * 7 - 1, Math.PI], ['work', x - 10, G, QUEUE.z1 - (done + 1) * 7 + 1, 0]);
  });

  // ---- the middle stage gets a scissor lift for the banner crew
  const lx = 0, lz = STAGE_Z + 9;
  box([4, 1.2, 7], [lx + 14, G, lz], 0xf2c818, 'SmoothPlastic');
  box([3.4, 18, 5], [lx + 14, G + 1.2, lz], 0x3a3f46, 'Metal', { collide: 0 });
  box([4.6, 0.4, 7.4], [lx + 14, G + 19.2, lz], 0xf2c818, 'SmoothPlastic', { collide: 0 });
  add([4.4, 0.15, 0.15], [lx + 14, G + 20.6, lz + 3.6], 0xf2c818, 'Metal', { collide: 0 });
  crew.push(['work', lx + 14, G + 19.6, lz - 1.5, 0]);

  // ---- the production yard along the wall
  // trailers
  for (const [x, label] of [[-220, 'BENTON HAUNT PRODUCTIONS'], [-180, 'SCENIC & PROPS'], [-140, 'LIGHTING & SOUND']]) {
    box([26, 10, 8], [x, G + 1.6, -432], 0xf0f0ec, 'SmoothPlastic');
    sign(label, [22, 2, 0.2], [x, G + 8, -436.1], 0xf0f0ec, 0x16223a, 'Front', 'GothamBlack');
    box([6, 7, 7.6], [x + 16.5, G + 1, -432], 0x2a3a5a, 'SmoothPlastic');
    for (const dx of [-9, -6, 9, 14, 18]) for (const dz of [-3.6, 3.6]) add([2, 2, 0.8], [x + dx, G + 1, -432 + dz], 0x1a1a1a, 'Rubber', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  }
  // road cases and a generator
  for (let k = 0; k < 9; k++) box([3, 2.6, 4], [-240 + (k % 3) * 3.4, G + Math.floor(k / 3) * 2.6, -446], 0x1a1a1c, 'Metal');
  box([10, 6, 5], [-108, G, -444], 0x5a5e66, 'Metal');
  sign('GENERATOR', [6, 1, 0.2], [-108, G + 4.6, -446.6], 0x5a5e66, 0xf2c818, 'Front', 'GothamBold');
  // the scare actors' check-in and makeup tent
  const tx = 40, tz = -428;
  for (const z of [tz - 8, tz + 8]) box([30, 7, 0.3], [tx, G, z], WHITE, 'Fabric');
  for (const x of [tx - 15, tx + 15]) box([0.3, 7, 6], [x, G, tz + (x < tx ? -5 : 5)], WHITE, 'Fabric');
  add([30.4, 4, 8.2], [tx, G + 9, tz - 4.1], WHITE, 'Fabric', { shape: 1, collide: 0, yaw: Math.PI });
  add([30.4, 4, 8.2], [tx, G + 9, tz + 4.1], WHITE, 'Fabric', { shape: 1, collide: 0 });
  sign('SCARE ACTOR CHECK-IN & MAKEUP', [20, 1.6, 0.2], [tx, G + 5.4, tz - 8.2], BLACK, ORANGE, 'Front', 'GothamBold');
  for (let k = 0; k < 4; k++) {
    box([4, 2.6, 1.4], [tx - 9 + k * 6, G, tz + 5], 0xf4f0e8, 'SmoothPlastic', { collide: 0 });
    add([3, 2, 0.1], [tx - 9 + k * 6, G + 4.2, tz + 5.8], 0xfff2d8, 'Neon', { collide: 0 });
  }
  // props waiting to go out: pumpkins, coffins, tombstones, scarecrows, hay
  for (let k = 0; k < 14; k++) add([1.6, 1.4, 1.6], [80 + (k % 5) * 1.8, G + 0.7 + Math.floor(k / 5) * 1.3, -440 + (k % 2) * 0.8], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
  for (let k = 0; k < 6; k++) box([2.6, 1.2, 6.2], [98 + (k % 2) * 3, G + Math.floor(k / 2) * 1.2, -440], 0x3a2418, 'Wood');
  for (let k = 0; k < 8; k++) {
    const x = 112 + (k % 4) * 3.2, z = -442 + Math.floor(k / 4) * 3;
    box([2, 2.8, 0.6], [x, G, z], 0x8a8a86, 'Concrete');
    add([2, 0.6, 0.6], [x, G + 3.1, z], 0x8a8a86, 'Concrete', { shape: 2, collide: 0 });
  }
  for (let k = 0; k < 3; k++) {
    const x = 132 + k * 4;
    box([0.3, 6, 0.3], [x, G, -440], 0x6a4a30, 'Wood', { collide: 0 });
    add([3.6, 0.3, 0.3], [x, G + 4.6, -440], 0x6a4a30, 'Wood', { collide: 0 });
    add([1.2, 1.2, 1.2], [x, G + 6.2, -440], 0xd8b060, 'Fabric', { shape: 3, collide: 0 });
    add([2, 0.3, 2], [x, G + 6.9, -440], 0x3a2a1c, 'Fabric', { collide: 0 });
    box([1.6, 2.4, 0.9], [x, G + 3.4, -440], [0x8a3a22, 0x3a5a8a, 0x5a6a2a][k], 'Fabric', { collide: 0 });
  }
  for (let k = 0; k < 8; k++) box([3.6, 1.6, 2], [152 + (k % 4) * 3.8, G + Math.floor(k / 4) * 1.6, -438], 0xd8b850, 'Fabric');
  for (const [x, z] of [[176, -446], [184, -446], [-30, -446], [-22, -446]]) cart(x, z);
  // a forklift with a coffin on its forks
  box([4, 2.6, 6], [190, G + 0.6, -430], 0xf2c818, 'SmoothPlastic');
  box([3.4, 3, 3], [190, G + 3.2, -429], 0x2a2a2e, 'Metal', { collide: 0 });
  box([0.4, 8, 3], [190, G, -434], 0x2a2a2e, 'Metal', { collide: 0 });
  box([2.6, 1.2, 6.2], [190, G + 1, -437.4], 0x3a2418, 'Wood', { collide: 0 });
  // a lighting truss being raised over the queues
  for (const x of [-14, 14]) box([1.2, 16, 1.2], [x, G, -500], 0x8a8e96, 'Metal', { collide: 0 });
  add([30, 1.2, 1.2], [0, G + 16.6, -500], 0x8a8e96, 'Metal', { collide: 0 });
  for (let k = 0; k < 6; k++) add([0.9, 1.2, 0.9], [-10 + k * 4, G + 15.4, -500], 0x1a1a1c, 'Metal', { shape: 5, collide: 0 });
  // lamps along the avenue
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  for (let x = BS.x0 + 25; x < BS.x1; x += 50) {
    box([0.5, 10, 0.5], [x, G, -488], 0x1e222c, 'Metal');
    add([1.4, 1.4, 1.4], [x, G + 10.4, -488], 0xffecbe, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 10.4, -488, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // more crew around the yard
  crew.push(
    ['work', -200, G, -440, 0], ['idle', -150, G, -440, Math.PI / 2], ['work', 90, G, -437, Math.PI],
    ['work', 120, G, -446, 0], ['idle', gx + 8, G, -416, 0], ['work', 184, G, -449, 0], ['idle', 34, G, -437, 0],
  );
  for (const [kind, x, y, z, yaw] of crew) data.staffSpots.push({ role: 'haunt', kind, land: 'Studios', seed: 0, cf: cf(x, y, z, yaw) });
  data.staff.lines.haunt = [
    'Backstage is where the magic happens!', 'Benton Haunt is almost ready!', 'Mind the barricades, still setting up!',
    "You didn't see anything back here...", 'Five houses in these stages - wait till you see them!', 'Six scare zones, six houses. Through November 2!',
  ];
  return { gate: { x: gx, z: -405 } };
}

// Welcome guests who wander backstage, with the sound of the crews at work.
export class Backstage {
  constructor(hooks) {
    this.hooks = hooks;
    this.told = false;
    this.next = 3;
  }

  update(dt, playerPos, started) {
    if (!started) return;
    const inside = playerPos.x > BS.x0 && playerPos.x < BS.x1 && playerPos.z > BS.z0 && playerPos.z < BS.z1;
    if (inside && !this.told) {
      this.told = true;
      this.hooks.toast("You're backstage! Crews are setting up Benton Haunt: five of the six houses are in these soundstages. Benton Haunt runs through November 2.", 'info');
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 1.5 + Math.random() * 4;
      if (inside) this.hooks.sound('clank');
    }
  }
}
