// Backstage: a huge lot behind the Studios wall, reached through a gate
// between two of the wall's pillars. Five giant soundstages hold most of
// the Benton Haunt houses, each with a big switchback queue on turf behind
// black "Benton Haunt" barricades and a themed, lit facade with fog at the
// door. The stages are hollow: the walk-through mazes inside them are
// built in houses.js. A production yard (trailers, a generator, the makeup
// tent, pallets of props) runs along the wall.
import * as THREE from 'three';
import { HAUNT_OVER, CHRISTMAS, XMAS_OVER, MARDI_GRAS, FD_OPEN } from './season.js';
// the soundstages are clear of the haunt by the holidays
const STAGES_CLEAR = CHRISTMAS || XMAS_OVER;

// (the lot runs further east once Stage 6 is built for Final Destination)
export const BS = { x0: -250, x1: FD_OPEN ? 350 : 250, z0: -700, z1: -405 };
const GATE = { x0: -81, x1: -44 }; // between the wall pillars at x -83.3 and -41.7
const G = 0.1; // top of the backstage paving
export const STAGE_Z = -605; // front faces of the soundstages
export const QUEUE = { z0: -597, z1: -505 }; // the turf queue areas in front of them
export const STAGE = { W: 76, D: 90, H: 40 };
export const stageX = (i) => -200 + i * 100;

export const HOUSES = [
  { name: "DEAD MAN'S GARAGE", title: "Dead Man's Garage", theme: 'garage', color: 0x4a4e56, glow: 0xff3030 },
  { name: 'THE LOST MINERS OF BACKWOODS HOLLOW', title: 'The Lost Miners of Backwoods Hollow', theme: 'mine', color: 0x4a4440, glow: 0xffb040 },
  { name: 'FINAL CUT: A HOLLYWOOD HORROR', title: 'Final Cut: A Hollywood Horror', theme: 'film', color: 0x6a1a22, glow: 0xffd27a },
  { name: 'CRASH TEST', title: 'Crash Test', theme: 'crash', color: 0x2a2a2e, glow: 0xf2c818 },
  { name: 'ENGINE WORKS: MELTDOWN', title: 'Engine Works: Meltdown', theme: 'engine', color: 0x2c2e32, glow: 0xff6a10 },
  ...(FD_OPEN ? [{ name: "FINAL DESTINATION: DEATH'S DESIGN", title: "Final Destination: Death's Design", theme: 'destination', color: 0x1a1c22, glow: 0xe02020 }] : []),
];
const HOUSE_COUNT = HOUSES.length + 1; // and the tent at Family Landing

export function buildBackstage(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null, trans = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), trans, collide]);
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
  const STEEL = 0xb8bcc0;
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
  // (now the event is over: a locked chain-link gate)
  const gx = (GATE.x0 + GATE.x1) / 2, gw = GATE.x1 - GATE.x0;
  data.tags.Searchlight = data.tags.Searchlight || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  if (HAUNT_OVER && !CHRISTMAS) closedGate(); // (at Christmas the gate is open: christmas.js)
  else for (const x of [GATE.x0 + 1.5, GATE.x1 - 1.5]) {
    box([3, 19, 3], [x, G, -409], BLACK, 'Metal');
    for (let k = 0; k < 3; k++) add([1.6, 1.4, 1.6], [x + (k - 1) * 1.8, G + 0.7, -406.9], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
  }
  if (!HAUNT_OVER) {
    add([gw, 3.4, 2], [gx, G + 20.6, -409], BLACK, 'Metal', { collide: 0 });
    sign('BENTON HAUNT  ·  BACKSTAGE', [gw - 2, 2.6, 0.2], [gx, G + 20.6, -407.9], BLACK, ORANGE, 'Back', 'GothamBlack', true);
    sign('BENTON HAUNT  ·  BACKSTAGE', [gw - 2, 2.6, 0.2], [gx, G + 20.6, -410.1], BLACK, ORANGE, 'Front', 'GothamBlack', true);
    sign(`NOW OPEN  ·  ${HOUSE_COUNT} HOUSES  ·  7 SCARE ZONES  ·  THROUGH NOV 2`, [gw - 4, 1.2, 0.2], [gx, G + 17.9, -407.9], BLACK, WHITE, 'Back', 'GothamBold');
    for (const x of [GATE.x0 - 4, GATE.x1 + 4]) {
      box([2.4, 1.6, 2.4], [x, G, -412], 0x2a2a2e, 'Metal');
      data.tags.Searchlight.push([x, G + 2.2, -412, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    for (const x of [GATE.x0 + 5, GATE.x1 - 5]) {
      box([1.4, 1, 2], [x, G, -414], 0x2a2a2e, 'Metal');
      data.tags.SteamVent.push([x, G + 1, -414, 1, 0, 0, 0, 1, 0, 0, 0, 1]); // fog machines being tested
    }
  }
  // a locked gate: chain-link panels between steel posts, closed signs
  function closedGate() {
    const z = -406;
    for (const x of [GATE.x0 + 0.8, gx, GATE.x1 - 0.8]) box([1, 14, 1], [x, G, z], STEEL, 'Metal', { shape: 5 });
    box([gw, 13.4, 0.3], [gx, G, z], 0x8a9096, 'Metal', { trans: 0.55 });
    for (const y of [0.4, 6.8, 13.2]) add([gw, 0.3, 0.4], [gx, G + y, z], STEEL, 'Metal', { collide: 0 });
    add([1.2, 1.6, 0.6], [gx, G + 6.2, z + 0.5], 0xb08a30, 'Metal', { collide: 0 }); // the padlock
    add([0.2, 2.6, 0.2], [gx, G + 6.8, z + 0.3], 0x8a8e96, 'Metal', { collide: 0 });
    sign('BACKSTAGE CLOSED', [18, 3, 0.2], [gx, G + 10.2, z + 0.4], 0xc8322d, WHITE, 'Back', 'GothamBlack');
    sign('CAST MEMBERS ONLY  ·  NO ENTRY', [18, 1.4, 0.2], [gx, G + 7.9, z + 0.4], WHITE, 0xc8322d, 'Back', 'GothamBold');
    sign(MARDI_GRAS ? 'BACKSTAGE CLOSED  ·  CAST MEMBERS ONLY' : XMAS_OVER ? 'HAPPY NEW YEAR!  ·  SEE YOU NEXT HOLIDAY SEASON' : 'BENTON HAUNT HAS ENDED  ·  THANKS FOR SCREAMING!', [gw - 6, 1.2, 0.2], [gx, G + 2.6, z + 0.4], BLACK, ORANGE, 'Back', 'GothamBold');
    sign('TEARDOWN IN PROGRESS  ·  HARD HATS REQUIRED', [gw - 6, 1.2, 0.2], [gx, G + 2.6, z - 0.4], 0xf2c818, BLACK, 'Front', 'GothamBold');
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
    const x = stageX(i);
    const { W, D, H: Hs } = STAGE;
    const cz = STAGE_Z - D / 2;
    // hollow, so the house can be walked inside: a door in the front, an
    // exit in the east wall a little way in
    const Tw = 1.2, exz = STAGE_Z - 6;
    box([W, Hs, Tw], [x, G, STAGE_Z - D + Tw / 2], TAN, 'Concrete');
    box([Tw, Hs, D], [x - W / 2 + Tw / 2, G, cz], TAN, 'Concrete');
    box([Tw, Hs, 2.5], [x + W / 2 - Tw / 2, G, STAGE_Z - 1.25], TAN, 'Concrete');
    box([Tw, Hs, exz - 3.5 - (STAGE_Z - D)], [x + W / 2 - Tw / 2, G, (exz - 3.5 + STAGE_Z - D) / 2], TAN, 'Concrete');
    box([Tw, Hs - 10, 7], [x + W / 2 - Tw / 2, G + 10, exz], TAN, 'Concrete');
    for (const sx of [-1, 1]) box([W / 2 - 3.5, Hs, Tw], [x + sx * (W / 4 + 1.75), G, STAGE_Z - Tw / 2], TAN, 'Concrete');
    box([7, Hs - 10, Tw], [x, G + 10, STAGE_Z - Tw / 2], TAN, 'Concrete');
    add([W, 1, D], [x, G + Hs - 0.5, cz], TAN, 'Concrete', { collide: 0 });
    sign('EXIT', [0.2, 1.4, 4], [x + W / 2 + 0.15, G + 11.2, exz], 0x101012, 0x5adc6e, 'Right', 'GothamBold', true);
    // the rose base band, as trim on the outside of the walls
    const band = (sx, sz, px, pz) => add([sx, 5, sz], [px, G + 2.5, pz], ROSE, 'Concrete', { collide: 0 });
    band(W + 0.6, 0.3, x, STAGE_Z - D - 0.15);
    band(0.3, D + 0.6, x - W / 2 - 0.15, cz);
    band(0.3, exz - 3.5 - (STAGE_Z - D), x + W / 2 + 0.15, (exz - 3.5 + STAGE_Z - D) / 2);
    band(0.3, 2.5, x + W / 2 + 0.15, STAGE_Z - 1.25);
    for (const sx of [-1, 1]) band(W / 2 - 3.5, 0.3, x + sx * (W / 4 + 1.75), STAGE_Z + 0.15);
    add([W + 1, 1, D + 1], [x, G + Hs + 0.5, cz], 0xd8bc84, 'Concrete', { collide: 0 });
    // stepped art deco parapet over the front, and maroon pilasters
    add([46, 4, 2], [x, G + Hs + 2, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    add([26, 4, 2], [x, G + Hs + 6, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    add([10, 3, 2], [x, G + Hs + 9.5, STAGE_Z - 1], TAN, 'Concrete', { collide: 0 });
    for (const dx of [-34, -23, 23, 34]) box([3, Hs, 1.2], [x + dx, G, STAGE_Z + 0.5], MAROON, 'Concrete', { collide: 0 });
    sign(i === 5 ? 'STAGE 6' : `STAGE ${21 + i}`, [7, 2, 0.2], [x - 28.5, G + 33, STAGE_Z + 1.2], MAROON, WHITE, 'Back', 'GothamBold');
    // the house name hangs high on the stage (the middle stage carries the
    // big Benton Haunt banner instead)
    if (HAUNT_OVER) {
      // the banners are down; the house's facade and maze are coming out
      // (and by Christmas they are long gone)
      if (!STAGES_CLEAR) teardown(house, i, x);
      return;
    }
    if (i === 2) {
      sign('BENTON HAUNT', [54, 9, 0.3], [x, G + 29, STAGE_Z + 0.4], BLACK, ORANGE, 'Back', 'GothamBlack');
      sign(`${HOUSE_COUNT} HOUSES  ·  7 SCARE ZONES  ·  THROUGH NOVEMBER 2`, [54, 2.6, 0.3], [x, G + 22.6, STAGE_Z + 0.4], BLACK, WHITE, 'Back', 'GothamBold');
    } else {
      sign(house.name, [44, 4.4, 0.3], [x, G + 27, STAGE_Z + 0.4], BLACK, ORANGE, 'Back', 'GothamBlack');
    }

    // the finished house facade in front of the door, lit and fogged
    const fz = STAGE_Z + 4;
    const T = house.theme;
    const wallMat = { garage: 'CorrodedMetal', mine: 'Slate', film: 'SmoothPlastic', crash: 'SmoothPlastic', engine: 'DiamondPlate', destination: 'SmoothPlastic' }[T];
    for (const sx of [-1, 1]) box([12.5, 18, 1.2], [x + sx * 9.75, G, fz], house.color, wallMat);
    box([7, 8.6, 1.2], [x, G + 9.4, fz], house.color, wallMat);
    for (const sx of [-1, 1]) box([0.6, 10, 4], [x + sx * 3.8, G, fz - 2], 0x101012, 'SmoothPlastic');
    add([33, 1, 1.6], [x, G + 18.3, fz], 0x1a1a1c, 'Metal', { collide: 0 });
    sign(house.name, [28, 2.4, 0.2], [x, G + 15.4, fz + 0.75], BLACK, house.glow, 'Back', 'GothamBlack', true);
    // uplights along the foot of the facade and a fog machine at the door
    for (let k = 0; k < 6; k++) add([0.8, 0.5, 0.6], [x - 14 + k * 5.6, G + 0.25, fz + 1.2], house.glow, 'Neon', { collide: 0 });
    data.tags.SteamVent.push([x - 5, G + 0.6, fz + 1.4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    box([1.2, 0.8, 1.6], [x - 5, G, fz + 1.4], 0x2a2a2e, 'Metal', { collide: 0 });
    const disk = [0, 0, -1, 0, 1, 0, 1, 0, 0]; // a cylinder facing out of the facade
    if (T === 'garage') {
      box([10, 3, 5], [x - 20, G + 0.8, fz + 6], 0x6a2a20, 'CorrodedMetal');
      box([6, 2.2, 4.6], [x - 20.5, G + 3.8, fz + 6], 0x5a2a20, 'CorrodedMetal');
      for (const dx of [-3.4, 3.4]) for (const dz of [-2.6, 2.6]) add([1.6, 1.6, 0.8], [x - 20 + dx, G + 0.8, fz + 6 + dz], 0x1a1a1a, 'Rubber', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
      for (let k = 0; k < 4; k++) add([2.4, 0.8, 2.4], [x + 19, G + 0.4 + k * 0.8, fz + 4], 0x1a1a1a, 'Rubber', { shape: 5 });
      for (let k = 0; k < 3; k++) box([2.2, 3, 2.2], [x + 13 + k * 2.4, G, fz + 3], [0xc8322d, 0x3a3a3e, 0xc8322d][k], 'CorrodedMetal', { shape: 5 });
    } else if (T === 'mine') {
      for (const dx of [-5, 5]) box([1.4, 12, 1.4], [x + dx, G, fz + 1.2], 0x3a2a1c, 'Wood');
      add([12.4, 1.6, 1.6], [x, G + 12.6, fz + 1.2], 0x3a2a1c, 'Wood');
      for (const dx of [-1.6, 1.6]) add([0.3, 0.2, 9], [x + dx, G + 0.1, fz + 5], 0x5a5e66, 'Metal', { collide: 0 });
      box([4, 2.4, 3], [x - 14, G + 0.6, fz + 6], 0x5a5e66, 'CorrodedMetal');
      for (const dx of [-7, 7]) add([0.7, 1, 0.7], [x + dx, G + 9, fz + 1], 0xffb040, 'Neon', { collide: 0 });
      for (let k = 0; k < 5; k++) add([3, 3, 3], [x + 12 + (k % 3) * 2.6, G + 1.2 + Math.floor(k / 3) * 2, fz + 2.4], 0x5a524a, 'Slate', { shape: 3, collide: 0 });
    } else if (T === 'film') {
      add([24, 3.2, 3], [x, G + 20.6, fz + 1.6], 0x1a1a1c, 'Metal', { collide: 0 });
      for (let k = 0; k < 18; k++) add([0.4, 0.4, 0.4], [x - 11.9 + k * 1.4, G + 19, fz + 3.2], 0xfff2c0, 'Neon', { shape: 3, collide: 0 });
      sign('NOW SHOWING', [12, 1.8, 0.2], [x, G + 20.6, fz + 3.15], 0xfaf3e0, 0x8a1c22, 'Back', 'GothamBold', true);
      for (const dx of [-11, 11]) {
        add([6, 8, 0.3], [x + dx, G + 7, fz + 0.8], 0xd8b060, 'Metal', { collide: 0 });
        sign('FINAL CUT', [5.2, 7.2, 0.1], [x + dx, G + 7, fz + 1], 0x1a0a0c, 0xe03030, 'Back', 'GothamBlack');
      }
      add([0.6, 5, 5], [x + 19, G + 2.6, fz + 5], 0x2a2a2e, 'Metal', { shape: 2, collide: 0 });
    } else if (T === 'crash') {
      for (let k = 0; k < 8; k++) add([4, 1.6, 0.2], [x - 14 + k * 4, G + 12.6, fz + 0.75], k % 2 ? 0xf2c818 : 0x1a1a1c, 'SmoothPlastic', { collide: 0 });
      for (let k = 0; k < 6; k++) box([2.5, 3, 1.4], [x - 22 + k * 2.5, G, fz + 5], k % 2 ? 0xf2c818 : 0xe8e8e4, 'SmoothPlastic');
      add([9, 4, 5], [x + 14, G + 2.2, fz + 3.4], 0x3a5a8a, 'Metal', { collide: 0, rot: [0.97, 0, 0.24, 0, 1, 0, -0.24, 0, 0.97] });
      box([1.4, 2.6, 1], [x + 21, G + 1, fz + 6], 0xf2c818, 'SmoothPlastic');
      add([1, 1, 1], [x + 21, G + 4.3, fz + 6], 0xf2c818, 'SmoothPlastic', { shape: 3 });
      add([0.8, 0.8, 0.8], [x, G + 10.2, fz + 0.9], 0xff2020, 'Neon', { shape: 3, collide: 0 });
    } else if (T === 'engine') {
      for (const [dx, d] of [[-10, 9], [11, 6]]) {
        add([0.8, d, d], [x + dx, G + 8, fz + 1], 0x8a5a2a, 'CorrodedMetal', { shape: 2, collide: 0, rot: disk });
        add([1, d * 0.4, d * 0.4], [x + dx, G + 8, fz + 1.2], 0x2a2a2e, 'Metal', { shape: 2, collide: 0, rot: disk });
      }
      for (const dx of [-15, -13.4, 13.4, 15]) box([1, 18, 1], [x + dx, G, fz + 1.2], 0x5a5e66, 'Metal', { shape: 5, collide: 0 });
      for (const sx of [-1, 1]) add([0.4, 9.4, 0.3], [x + sx * 3.7, G + 4.7, fz + 0.75], 0xff6a10, 'Neon', { collide: 0 });
      add([7.8, 0.4, 0.3], [x, G + 9.6, fz + 0.75], 0xff6a10, 'Neon', { collide: 0 });
    } else if (T === 'destination') {
      // the way in is Gate 47: a departures board over the door, Flight
      // 180's tail fin and an engine in the wreckage, a log from Route 23
      const board = add([15, 5.6, 0.3], [x, G + 12.2, fz + 0.9], BLACK, 'SmoothPlastic', { collide: 0 });
      data.signs.push({ part: board, face: 'Back', glow: true, labels: [
        ['DEPARTURES  ·  GATE 47', 0.02, 0xffc040], ['180   PARIS   DELAYED', 0.27, 0xe02020], ['23   ROUTE 23   CANCELLED', 0.51, 0xe02020], ['13   YOUR NAME   ON TIME', 0.75, WHITE],
      ].map(([text, y, color]) => ({ text, x: 0, y, w: 1, h: 0.22, color, font: 'GothamBold', align: 'Center', stroke: false, pad: 0.1 })) });
      add([1.2, 14, 16], [x - 22, G + 7, fz + 9], 0xe8e8e4, 'SmoothPlastic', { shape: 1, collide: 1, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
      sign('180', [5, 3, 0.2], [x - 24, G + 5, fz + 9.75], 0xe8e8e4, 0xc81e1e, 'Back', 'GothamBlack');
      add([15, 1.2, 0.3], [x - 22, G + 1.6, fz + 9.7], 0x1a2a5a, 'SmoothPlastic', { collide: 0 });
      add([7, 6, 6], [x + 20, G + 3.2, fz + 7], 0xb8bcc4, 'Metal', { shape: 2, rot: disk });
      add([0.4, 4.6, 4.6], [x + 20, G + 3.2, fz + 10.6], 0x101012, 'Metal', { shape: 2, rot: disk, collide: 0 });
      add([1.6, 1.6, 1.6], [x + 20, G + 3.2, fz + 10.2], 0xff6a20, 'Neon', { shape: 3, collide: 0 });
      data.tags.SteamVent.push([x + 20, G + 6.4, fz + 9, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      add([14, 2.4, 2.4], [x + 12, G + 1.2, fz + 14], 0x7a5434, 'Wood', { shape: 2, rot: [0.95, 0, 0.3, 0, 1, 0, -0.3, 0, 0.95] });
      for (let k = 0; k < 9; k++) add([3.4, 0.3, 0.1], [x - 14 + k * 3.5, G + 3 + (k % 2) * 0.4, fz + 0.8], k % 2 ? BLACK : 0xf2c818, 'SmoothPlastic', { collide: 0 });
      for (const dx of [-12.5, 12.5]) add([0.8, 0.8, 0.8], [x + dx, G + 18.4, fz + 1], 0xe02020, 'Neon', { shape: 3, collide: 0 });
    }

    // the queue: turf, a finished switchback of barricades, black covers out
    // front and the house's name at the way in
    const qx0 = x - 35, qx1 = x + 35;
    add([qx1 - qx0 + 2, 0.15, QUEUE.z1 - QUEUE.z0], [x, G + 0.08, (QUEUE.z0 + QUEUE.z1) / 2], 0x2f6a2a, 'SmoothPlastic', { collide: 0 });
    for (let z = QUEUE.z0 + 10; z < QUEUE.z1; z += 20) add([qx1 - qx0 + 2, 0.02, 3], [x, G + 0.17, z], 0x9a9a96, 'SmoothPlastic', { collide: 0 });
    barricade(qx0 + 8, qx1, QUEUE.z1, { covers: true }); // the way in is at the west end
    barricadeZ(qx0, QUEUE.z0, QUEUE.z1);
    barricadeZ(qx1, QUEUE.z0, QUEUE.z1);
    const rows = Math.floor((QUEUE.z1 - QUEUE.z0) / 7);
    for (let k = 1; k < rows; k++) {
      const z = QUEUE.z1 - k * 7;
      const xa = k % 2 ? qx0 : qx0 + 7, xb = k % 2 ? qx1 - 7 : qx1;
      barricade(xa, xb, z);
    }
    box([0.4, 7, 0.4], [qx0 - 2, G, QUEUE.z1 + 2], BLACK, 'Metal');
    sign(house.name, [12, 2.4, 0.2], [qx0 - 2, G + 6.4, QUEUE.z1 + 2.2], BLACK, house.glow, 'Back', 'GothamBlack', true);
    crew.push(['idle', qx0 + 1, G, QUEUE.z1 + 3, 0]);
  });

  // ---- teardown: a stub of the facade, debris and a dumpster out front,
  // the maze gutted inside, the turf half rolled up and the barricades
  // stacked on carts
  function teardown(house, i, x) {
    const fz = STAGE_Z + 4;
    const wallMat = { garage: 'CorrodedMetal', mine: 'Slate', film: 'SmoothPlastic', crash: 'SmoothPlastic', engine: 'DiamondPlate' }[house.theme];
    const r = (k) => ((i * 7 + k * 13) % 10) / 10;
    // what is left of the facade: one jagged stub and its frame
    box([12.5, 5 + (i % 3) * 2.5, 1.2], [x - 9.75, G, fz], house.color, wallMat);
    box([4, 3, 1.2], [x - 13, G + 5 + (i % 3) * 2.5, fz], house.color, wallMat);
    for (const dx of [-15, 0, 15]) box([0.5, 18, 0.5], [x + dx, G, fz - 1.4], 0x8a8e96, 'Metal', { collide: 0 });
    add([31, 0.5, 0.5], [x, G + 18, fz - 1.4], 0x8a8e96, 'Metal', { collide: 0 });
    // the old sign, face up on the ground
    sign(house.name, [26, 0.3, 2.4], [x - 4, G + 0.15, fz + 12], BLACK, house.glow, 'Top', 'GothamBlack');
    // a debris pile of facade pieces
    for (let k = 0; k < 8; k++) {
      const a = r(k) * 1.4 - 0.7;
      add([3 + r(k + 1) * 4, 0.8 + r(k + 2), 2 + r(k + 3) * 3], [x + 2 + (k % 4) * 2.6 - 4, G + 0.5 + Math.floor(k / 4) * 0.9, fz + 6 + (k % 3)], k % 3 ? house.color : 0x2a2a2e, wallMat, { collide: 0, rot: [Math.cos(a), -Math.sin(a) * 0.3, Math.sin(a), 0.1, 0.99, 0, -Math.sin(a), 0, Math.cos(a)] });
    }
    // a roll-off dumpster, full
    const dx = x + 22, dz = fz + 10;
    box([7, 5, 16], [dx, G, dz], [0x2a6a3a, 0x2a4a8a, 0x8a2a22][i % 3], 'CorrodedMetal');
    for (let k = 0; k < 5; k++) add([2.4 + r(k) * 2, 1.2, 3 + r(k + 4) * 3], [dx - 1.6 + (k % 2) * 3, G + 5.3 + r(k + 2) * 0.6, dz - 6 + k * 3], k % 2 ? house.color : 0x5a4a3a, wallMat, { collide: 0, rot: [1, 0, 0, 0, Math.cos(r(k) - 0.5), -Math.sin(r(k) - 0.5), 0, Math.sin(r(k) - 0.5), Math.cos(r(k) - 0.5)] });
    sign('BENTON WASTE', [0.2, 1.2, 8], [dx + 3.6, G + 3, dz], [0x2a6a3a, 0x2a4a8a, 0x8a2a22][i % 3], WHITE, 'Right', 'GothamBold');
    // a scissor lift taking down the lights
    const lx = x + 10;
    box([4, 1.2, 7], [lx, G + 0.4, fz + 2], 0xf2c818, 'SmoothPlastic');
    for (const s of [-1, 1]) add([0.3, 9.6, 0.3], [lx, G + 6.2, fz + 2], 0x2a2a2e, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(s * 0.55), -Math.sin(s * 0.55), 0, Math.sin(s * 0.55), Math.cos(s * 0.55)] });
    box([4.4, 0.4, 7.4], [lx, G + 10.4, fz + 2], 0xf2c818, 'SmoothPlastic', { collide: 0 });
    add([4.4, 1.2, 0.1], [lx, G + 11.4, fz - 1.6], 0xf2c818, 'Metal', { collide: 0 });
    crew.push(['work', lx, G + 10.8, fz + 2, Math.PI], ['work', x - 2, G, fz + 9, 0], ['idle', dx - 5, G, dz + 4, -Math.PI / 2]);
    // inside: the maze walls down in stacks, piles and a forklift
    const cz = STAGE_Z - STAGE.D / 2;
    for (let k = 0; k < 6; k++) box([12, 0.6, 7], [x - 20, G + k * 0.6, cz + 10], [0x2a2a2e, house.color, 0x5a4a3a][k % 3], 'WoodPlanks', { collide: 0 });
    for (let k = 0; k < 4; k++) add([10, 8, 0.4], [x + 14, G + 4, cz - 20 + k * 1.2], house.color, wallMat, { collide: 0, rot: [1, 0, 0, 0, 0.97, -0.24, 0, 0.24, 0.97] });
    box([4, 2.6, 6], [x, G + 0.6, cz + 20], 0xf2c818, 'SmoothPlastic', { collide: 0 });
    box([0.4, 8, 3], [x, G, cz + 16.6], 0x2a2a2e, 'Metal', { collide: 0 });
    crew.push(['work', x - 14, G, cz + 10, Math.PI / 2], ['work', x + 8, G, cz - 18, 0]);
    // the queue: turf half rolled up, rolls waiting, barricades on carts
    const qx0 = x - 35, qx1 = x + 35, mid = (QUEUE.z0 + QUEUE.z1) / 2;
    add([qx1 - qx0 + 2, 0.15, mid - QUEUE.z0], [x, G + 0.08, (QUEUE.z0 + mid) / 2], 0x2f6a2a, 'SmoothPlastic', { collide: 0 });
    for (let k = 0; k < 5; k++) add([16, 2.6, 2.6], [x - 24 + (k % 3) * 18, G + 1.3 + Math.floor(k / 3) * 2.4, mid + 6 + Math.floor(k / 3) * 0.2], 0x2f6a2a, 'Fabric', { shape: 2, collide: 0 });
    cart(x - 18, QUEUE.z1 - 8);
    cart(x + 4, QUEUE.z1 - 8);
    for (let k = 0; k < 10; k++) box([0.18, 3.4, 0.18], [x + 20 + (k % 5) * 0.5, G, QUEUE.z1 - 9 + Math.floor(k / 5) * 0.6], STEEL, 'Metal', { collide: 0 });
    crew.push(['work', x - 14, G, mid + 9, 0]);
  }

  // ---- the production yard along the wall
  // trailers
  for (const [x, label] of [[-220, STAGES_CLEAR ? 'BENTON HOLIDAY PRODUCTIONS' : 'BENTON HAUNT PRODUCTIONS'], [-180, 'SCENIC & PROPS'], [-140, 'LIGHTING & SOUND']]) {
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
  sign(CHRISTMAS ? "SANTA'S MAILROOM" : MARDI_GRAS ? 'PARADE FLOAT STORAGE' : XMAS_OVER ? 'HOLIDAY DECOR STORAGE' : HAUNT_OVER ? 'COSTUME & PROP RETURNS' : 'SCARE ACTOR CHECK-IN & MAKEUP', [20, 1.6, 0.2], [tx, G + 5.4, tz - 8.2], BLACK, ORANGE, 'Front', 'GothamBold');
  for (let k = 0; k < 4; k++) {
    box([4, 2.6, 1.4], [tx - 9 + k * 6, G, tz + 5], 0xf4f0e8, 'SmoothPlastic', { collide: 0 });
    add([3, 2, 0.1], [tx - 9 + k * 6, G + 4.2, tz + 5.8], 0xfff2d8, 'Neon', { collide: 0 });
  }
  // props waiting to go out: pumpkins, coffins, tombstones, scarecrows, hay
  if (!STAGES_CLEAR) {
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
  for (const [x, z] of [[176, -446], [184, -446]]) cart(x, z);
  // a forklift with a coffin on its forks
  box([4, 2.6, 6], [190, G + 0.6, -430], 0xf2c818, 'SmoothPlastic');
  box([3.4, 3, 3], [190, G + 3.2, -429], 0x2a2a2e, 'Metal', { collide: 0 });
  box([0.4, 8, 3], [190, G, -434], 0x2a2a2e, 'Metal', { collide: 0 });
  box([2.6, 1.2, 6.2], [190, G + 1, -437.4], 0x3a2418, 'Wood', { collide: 0 });
  }
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
  for (const [kind, x, y, z, yaw] of crew) data.staffSpots.push({ role: CHRISTMAS ? 'elf' : HAUNT_OVER ? 'construction' : 'haunt', kind, land: 'Studios', seed: 0, cf: cf(x, y, z, yaw) });
  if (HAUNT_OVER && !STAGES_CLEAR) {
    data.staff.lines.construction = [
      'Sorry, backstage is closed!', 'Benton Haunt is over - thanks for screaming!', 'Watch your step, we are tearing it all down.',
      'See you next fall!', 'Hard hats only back here!', 'That facade took weeks to build... and a day to tear down.',
    ];
  }
  data.staff.lines.haunt = [
    'Welcome to Benton Haunt!', `All ${HOUSE_COUNT === 7 ? 'seven' : 'six'} houses are open tonight!`, 'Check the app for house wait times!',
    "You didn't see anything back here...", FD_OPEN ? "Final Destination is open on Stage 6 - you can't cheat Death!" : 'Five houses in these stages, one more in a tent at Family Landing!', 'Seven scare zones - try Fortnitemares at Family Landing!',
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
    const R = this.hooks.family;
    const family = R && playerPos.x > R.x0 && playerPos.x < R.x1 && playerPos.z > R.z0 && playerPos.z < R.z1;
    if (family && !this.toldFamily && HAUNT_OVER) {
      this.toldFamily = true;
      this.hooks.toast('Backstage is closed: the crews are taking down the Lights Out at Lakeside tent. Benton Haunt returns next fall!', 'info');
    }
    if (family && !this.toldFamily) {
      this.toldFamily = true;
      this.hooks.toast("Family Landing backstage: Benton Haunt's sixth house, Lights Out at Lakeside, is open in this tent. Lights out...", 'info');
    }
    const inside = family || (playerPos.x > BS.x0 && playerPos.x < BS.x1 && playerPos.z > BS.z0 && playerPos.z < BS.z1);
    if (inside && !family && !this.told && CHRISTMAS) {
      this.told = true;
      this.hooks.toast("Welcome to Santa's Workshop! Join the line by the porch and press E to meet Santa. Ho ho ho!", 'reward');
    }
    if (inside && !family && !this.told && HAUNT_OVER) {
      this.told = true;
      this.hooks.toast('Backstage is closed: Benton Haunt has ended and the crews are tearing down the houses. Thanks for screaming!', 'info');
    }
    if (inside && !family && !this.told) {
      this.told = true;
      this.hooks.toast(FD_OPEN ? "Welcome to Benton Haunt! Six of the seven houses are open in these soundstages, including the brand-new Final Destination: Death's Design on Stage 6 at the east end. You can't cheat Death..." : "Welcome to Benton Haunt! Five of the six houses are open in these soundstages - join a line and walk through if you dare. Through November 2.", 'info');
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 1.5 + Math.random() * 4;
      if (inside) this.hooks.sound('clank');
    }
  }
}
