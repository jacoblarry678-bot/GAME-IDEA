// Benton Holidays, through January 1: a giant tree in the Plaza, decorated
// trees, presents, candy canes and snowmen along the walkways, light strands
// over Main Street, twinkling Christmas lights along every coaster's track
// and round the flat rides, falling snow, Santa himself roaming the park,
// and the backstage reopened as Santa's Workshop, where you can wait in line
// to meet him.
import * as THREE from 'three';
import { makeFinder } from './haunt.js';
import { LINES as WALKWAYS } from './guests.js';
import { BS, STAGE_Z, QUEUE, stageX } from './backstage.js';
import { Figure } from './people/figure.js';
import { buildModel } from './geom.js';

const G = 0.1;
const RED = 0xc8102e, GREEN = 0x1e5a2a, GOLD = 0xf0c040, WHITE = 0xf4f4f0, SNOW = 0xf2f6fa, BROWN = 0x5a3a20;
const BULBS = [0xff2a2a, 0x2aff4a, 0xffc030, 0x3a6aff, 0xfff4e0];
// Santa's Workshop, in the backstage yard, facing the gate
export const WORKSHOP = { x: 0, front: -463, throne: [0, -460.6], meet: [3.6, -458.4], line: [[-26, -436], [-4, -436], [-4, -442], [-22, -442], [-22, -448], [-4, -448], [-1, -455]] };
const GATE = { x0: -81, x1: -44 };

function helpers(data) {
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
  const sign = (size, center, bg, face, labels, { glow = false, yaw = 0 } = {}) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({
      part: i, face, glow,
      labels: labels.map(([text, x, y, w, h, color, font = 'GothamBlack']) => ({ text, x, y, w, h, color, font, align: 'Center', stroke: false, pad: 0.1 })),
    });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  return { add, box, sign, cf, mi };
}

export function buildChristmas(data) {
  const { add, box, sign, cf } = helpers(data);
  const find = makeFinder(data);
  const lights = []; // [x, y, z, pattern] for the twinkling bulbs (0 chase, 1 twinkle)
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];

  // ---- decorations
  const tree = (x, z, scale = 1, ground = 0) => {
    const y0 = ground + G;
    box([0.8 * scale, 1.4 * scale, 0.8 * scale], [x, y0, z], BROWN, 'Wood', { collide: 0 });
    const tiers = [[5, 2.4, 2.2], [3.9, 2.2, 4.1], [2.8, 2, 5.8], [1.6, 1.7, 7.3]];
    for (const [d, h, y] of tiers) add([d * scale, h * scale, d * scale], [x, y0 + y * scale, z], GREEN, 'Grass', { shape: 5, collide: 0 });
    add([0.9 * scale, 0.9 * scale, 0.9 * scale], [x, y0 + 8.6 * scale, z], GOLD, 'Neon', { shape: 3, collide: 0 });
    // ornaments and a spiral of lights
    for (let k = 0; k < 8; k++) {
      const a = k * 2.4, t = k / 8, r = (2.4 - t * 1.6) * scale;
      add([0.45 * scale, 0.45 * scale, 0.45 * scale], [x + Math.cos(a) * r, y0 + (2 + t * 5.5) * scale, z + Math.sin(a) * r], [RED, GOLD, 0x3a6aff, WHITE][k % 4], 'SmoothPlastic', { shape: 3, collide: 0 });
    }
    const nb = Math.round(22 * Math.max(1, scale) ** 1.7), turns = 7 + Math.max(0, scale - 1) * 3;
    for (let k = 0; k < nb; k++) {
      const t = k / nb, a = t * Math.PI * turns, r = (2.6 - t * 1.9) * scale;
      lights.push([x + Math.cos(a) * r, y0 + (1.6 + t * 6.6) * scale, z + Math.sin(a) * r, 1]);
    }
    if (scale > 0.9) box([1 * scale, 1 * scale, 1 * scale], [x, y0, z], G, 'Grass', { collide: 1 });
  };
  const presents = (x, z, k = 0) => {
    const cols = [[RED, GOLD], [GREEN, WHITE], [0x3a6aff, WHITE], [GOLD, RED]];
    [[2.2, 1.6, 0, 0], [1.6, 1.3, 1.6, 0.8], [1.2, 1, -0.6, 1.6]].forEach(([s, h, dx, dz], j) => {
      const [c, r] = cols[(k + j) % 4];
      box([s, h, s], [x + dx, G, z + dz], c, 'SmoothPlastic', { collide: j === 0 ? 1 : 0, yaw: j * 0.4 });
      add([s + 0.05, h + 0.05, 0.25], [x + dx, G + h / 2, z + dz], r, 'Fabric', { collide: 0, yaw: j * 0.4 });
      add([0.25, h + 0.05, s + 0.05], [x + dx, G + h / 2, z + dz], r, 'Fabric', { collide: 0, yaw: j * 0.4 });
    });
  };
  const candyCane = (x, z, yaw = 0) => {
    for (let k = 0; k < 6; k++) add([0.6, 1, 0.6], [x, G + 0.5 + k, z], k % 2 ? WHITE : RED, 'SmoothPlastic', { shape: 5, collide: 0 });
    const ux = Math.sin(yaw), uz = Math.cos(yaw);
    add([0.6, 0.6, 1.8], [x + ux * 0.6, G + 6.2, z + uz * 0.6], RED, 'SmoothPlastic', { collide: 0, yaw });
    add([0.6, 1.2, 0.6], [x + ux * 1.4, G + 5.6, z + uz * 1.4], WHITE, 'SmoothPlastic', { shape: 5, collide: 0 });
    box([0.7, 0.4, 0.7], [x, G, z], RED, 'SmoothPlastic', { collide: 1 });
  };
  const snowman = (x, z, yaw = 0) => {
    add([3.2, 3.2, 3.2], [x, G + 1.5, z], SNOW, 'SmoothPlastic', { shape: 3 });
    add([2.4, 2.4, 2.4], [x, G + 3.9, z], SNOW, 'SmoothPlastic', { shape: 3, collide: 0 });
    add([1.7, 1.7, 1.7], [x, G + 5.7, z], SNOW, 'SmoothPlastic', { shape: 3, collide: 0 });
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    add([0.25, 0.25, 0.9], [x + fx * 0.9, G + 5.7, z + fz * 0.9], 0xff7a1a, 'SmoothPlastic', { collide: 0, yaw });
    add([1.2, 0.9, 1.2], [x, G + 6.9, z], 0x101012, 'SmoothPlastic', { shape: 5, collide: 0 });
    add([1.8, 0.12, 1.8], [x, G + 6.5, z], 0x101012, 'SmoothPlastic', { shape: 5, collide: 0 });
    add([2, 0.4, 2], [x, G + 5, z], RED, 'Fabric', { shape: 5, collide: 0 });
    for (const s of [-0.3, 0.3]) add([0.18, 0.18, 0.18], [x + fx * 0.75 + Math.cos(yaw) * s, G + 6, z + fz * 0.75 - Math.sin(yaw) * s], 0x101012, 'SmoothPlastic', { shape: 3, collide: 0 });
  };

  // ---- along every walkway: something festive every so often, either side
  const lineDist = (px, pz, skip) => Math.min(...WALKWAYS.filter((l) => l !== skip).map(([a, b]) => {
    const ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz;
    const u = Math.max(0, Math.min(1, ((px - a.x) * ux + (pz - a.z) * uz) / l2));
    return Math.hypot(a.x + ux * u - px, a.z + uz * u - pz);
  }));
  let k = 0;
  for (const line of WALKWAYS) {
    const [a, b] = line;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len, nx = -dz, nz = dx;
    for (let t = 10; t < len - 6; t += 26) {
      const side = (Math.round(t / 26) + k) % 2 ? 1 : -1;
      for (let s = 7.5; s <= 12; s += 1.5) {
        const px = a.x + dx * t + nx * side * s, pz = a.z + dz * t + nz * side * s;
        if (!find.clear(px, pz, 2.6) || lineDist(px, pz, line) < 6) continue;
        const yawIn = Math.atan2(nx * side, nz * side); // facing the path
        [() => tree(px, pz, 0.8), () => presents(px, pz, k), () => candyCane(px, pz, yawIn), () => snowman(px, pz, yawIn)][k % 4]();
        k++;
        break;
      }
    }
  }

  // ---- the giant Plaza tree, with presents round it and a banner
  const spot = find(0, 268, 11, [[-70, 230, 70, 290]]) || [24, 262, 0];
  const [tx, tz] = spot;
  tree(tx, tz, 4.2);
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * Math.PI * 2 + 0.3;
    presents(tx + Math.cos(a) * 11, tz + Math.sin(a) * 11, j);
  }
  box([0.6, 18, 0.6], [tx - 15, G, tz + 13], 0x2a2a2e, 'Metal', { collide: 0 });
  sign([16, 3.4, 0.3], [tx - 15, G + 17, tz + 13.2], RED, 'Back', [['HAPPY HOLIDAYS!', 0, 0, 1, 0.62, WHITE], ['BENTON HOLIDAYS  ·  THROUGH JANUARY 1', 0, 0.62, 1, 0.38, GOLD, 'GothamBold']], { glow: true });

  // ---- light strands across Main Street
  for (let z = 214; z > 20; z -= 22) {
    for (let j = 0; j <= 20; j++) {
      const x = -24 + j * 2.4, u = x / 24;
      lights.push([x, 14.5 - 2.4 * (1 - u * u), z, 1]);
    }
  }

  // ---- Christmas lights on the rides: along both rails of every track,
  // and a ring round the flat rides
  const P = new THREE.Vector3(), T = new THREE.Vector3(), U = new THREE.Vector3(), S = new THREE.Vector3();
  for (const r of data.rides) {
    if (r.track) {
      const { cum, pos, tan, up } = r.track;
      let i = 0;
      for (let s = 0; s < r.track.length; s += 3.2) {
        while (i < cum.length - 2 && cum[i + 1] < s) i++;
        P.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        T.set(tan[i * 3], tan[i * 3 + 1], tan[i * 3 + 2]);
        U.set(up[i * 3], up[i * 3 + 1], up[i * 3 + 2]);
        S.crossVectors(T, U).normalize();
        for (const sd of [-1, 1]) lights.push([P.x + S.x * sd * 1.9 - U.x * 0.6, P.y + S.y * sd * 1.9 - U.y * 0.6, P.z + S.z * sd * 1.9 - U.z * 0.6, 0]);
      }
    } else if (r.cars && r.cars.length && r.origin) {
      const [ox, , oz] = r.origin;
      let R = 6;
      for (const c of r.cars) if (c.pivot) R = Math.max(R, Math.hypot(c.pivot[0] - ox, c.pivot[2] - oz));
      R = Math.min(R + 5, 40);
      const n = Math.round((Math.PI * 2 * R) / 2.6);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        lights.push([ox + Math.cos(a) * R, G + 1.2, oz + Math.sin(a) * R, 0]);
      }
    }
  }

  // ---- the backstage: Santa's Workshop
  // a festive arch over the gate (the gate is open again)
  const gx = (GATE.x0 + GATE.x1) / 2, gw = GATE.x1 - GATE.x0;
  for (const x of [GATE.x0 + 1.5, GATE.x1 - 1.5]) {
    for (let j = 0; j < 9; j++) box([2.6, 2, 2.6], [x, G + j * 2, -408], j % 2 ? WHITE : RED, 'SmoothPlastic', { collide: j === 0 ? 1 : 0, shape: 5 });
  }
  add([gw, 3, 1.4], [gx, G + 19.5, -408], GREEN, 'Grass', { collide: 0 });
  for (let j = 0; j < 16; j++) lights.push([GATE.x0 + 2 + j * ((gw - 4) / 15), G + 18, -406.9, 1]);
  sign([gw - 6, 2.6, 0.3], [gx, G + 19.6, -407.1], RED, 'Back', [["SANTA'S WORKSHOP", 0, 0, 1, 1, WHITE]], { glow: true });
  sign([gw - 10, 1.2, 0.3], [gx, G + 16.4, -407.1], GREEN, 'Back', [['MEET SANTA  ·  THROUGH JANUARY 1', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  // snow on the yard and over the old queue areas, wreaths on the stages
  add([300, 0.12, 120], [0, G + 0.06, -455], SNOW, 'SmoothPlastic', { collide: 0 });
  for (let i = 0; i < 5; i++) {
    const x = stageX(i);
    add([72, 0.16, QUEUE.z1 - QUEUE.z0], [x, G + 0.08, (QUEUE.z0 + QUEUE.z1) / 2], SNOW, 'SmoothPlastic', { collide: 0 });
    tree(x - 22, -540, 1.3);
    tree(x + 22, -560, 1.1);
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * Math.PI * 2;
      add([1.6, 1.6, 1.2], [x + Math.cos(a) * 3.4, G + 26 + Math.sin(a) * 3.4, STAGE_Z + 0.9], GREEN, 'Grass', { shape: 3, collide: 0 });
      lights.push([x + Math.cos(a + 0.2) * 3.4, G + 26 + Math.sin(a + 0.2) * 3.4, STAGE_Z + 1.6, 1]);
    }
    add([1.6, 1.2, 0.6], [x, G + 22.4, STAGE_Z + 1.2], RED, 'Fabric', { collide: 0 });
  }
  sign([54, 8, 0.3], [stageX(2), G + 33, STAGE_Z + 0.5], RED, 'Back', [['HAPPY HOLIDAYS', 0, 0, 1, 0.66, WHITE], ['FROM ALL OF US AT BENTON DIESEL WORLD', 0, 0.66, 1, 0.34, GOLD, 'GothamBold']], { glow: true });
  // the workshop: a red cottage with a snowy stepped roof and a chimney
  const W = WORKSHOP, wz = W.front - 8.5;
  box([40, 12, 17], [W.x, G, wz], 0x8a2a22, 'WoodPlanks');
  for (const [d, y] of [[19, 12], [14.5, 13.4], [10, 14.8], [5.5, 16.2]]) box([44, 1.4, d], [W.x, G + y, wz], SNOW, 'SmoothPlastic', { collide: 0 });
  box([4, 9, 4], [W.x + 13, G + 12, wz - 3], 0x8a3b2a, 'Brick', { collide: 0 });
  data.tags.SteamVent.push([W.x + 13, G + 21.2, wz - 3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  for (const dx of [-13, 13]) {
    add([5, 4, 0.3], [W.x + dx, G + 6, W.front + 0.2], 0xffd890, 'Neon', { collide: 0 });
    add([5.6, 0.5, 0.5], [W.x + dx, G + 3.9, W.front + 0.4], SNOW, 'SmoothPlastic', { collide: 0 });
  }
  add([5, 8, 0.3], [W.x, G + 4, W.front + 0.2], 0x1e5a2a, 'WoodPlanks', { collide: 0 });
  sign([24, 3, 0.4], [W.x, G + 10, W.front + 0.4], 0x1a2a1a, 'Back', [["SANTA'S WORKSHOP", 0, 0, 1, 1, GOLD]], { glow: true });
  for (let j = 0; j < 26; j++) lights.push([W.x - 21 + j * (42 / 25), G + 12, W.front + 0.8, 1]);
  // the porch and Santa's throne
  box([28, 1, 7], [W.x, G, W.front + 3.5], BROWN, 'WoodPlanks');
  for (const dx of [-13, 13]) for (let j = 0; j < 5; j++) box([0.8, 1.8, 0.8], [W.x + dx, G + 1 + j * 1.8, W.front + 6.6], j % 2 ? WHITE : RED, 'SmoothPlastic', { collide: 0, shape: 5 });
  add([30, 0.6, 8], [W.x, G + 10.2, W.front + 3.5], RED, 'Fabric', { collide: 0 });
  const [thx, thz] = W.throne;
  box([5, 1.6, 4], [thx, G + 1, thz], GOLD, 'Metal', { collide: 0 });
  box([5, 6.4, 0.8], [thx, G + 1, thz - 2.2], 0x8a1020, 'Fabric', { collide: 0 });
  add([5.6, 0.8, 1], [thx, G + 7.8, thz - 2.2], GOLD, 'Metal', { collide: 0 });
  for (const dx of [-2.5, 2.5]) box([0.6, 2.6, 4], [thx + dx, G + 1, thz], GOLD, 'Metal', { collide: 0 });
  for (const dx of [-9, 9]) presents(W.x + dx, W.front + 3.5, dx > 0 ? 2 : 1);
  tree(W.x - 26, W.front + 2, 1.5);
  tree(W.x + 26, W.front + 2, 1.5);
  // the line: gold posts and red velvet ropes
  const L = W.line;
  for (let j = 0; j < L.length - 1; j++) {
    const [ax, az] = L[j], [bx, bz] = L[j + 1];
    for (const off of [-1.6, 1.6]) {
      const horiz = Math.abs(bz - az) < 0.1;
      const ox = horiz ? 0 : off, oz = horiz ? off : 0;
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 4));
      for (let q = 0; q <= n; q++) box([0.25, 3, 0.25], [ax + ((bx - ax) * q) / n + ox, G, az + ((bz - az) * q) / n + oz], GOLD, 'Metal', { collide: 0 });
      add(horiz ? [len, 0.18, 0.18] : [0.18, 0.18, len], [(ax + bx) / 2 + ox, G + 2.6, (az + bz) / 2 + oz], RED, 'Fabric', { collide: 0 });
    }
  }
  box([0.4, 7, 0.4], [L[0][0] - 3, G, L[0][1] + 2], GOLD, 'Metal');
  sign([0.2, 2, 9], [L[0][0] - 2.8, G + 6.4, L[0][1] + 2], RED, 'Right', [['MEET SANTA', 0, 0, 1, 1, WHITE]], { glow: true });
  // the sleigh and two reindeer
  const sx = 34, sz = -458;
  box([5, 3, 9], [sx, G + 1, sz], RED, 'SmoothPlastic', { collide: 0 });
  box([5, 2, 3], [sx, G + 4, sz + 3], RED, 'SmoothPlastic', { collide: 0 });
  for (const dx of [-2.6, 2.6]) add([0.4, 0.4, 11], [sx + dx, G + 0.4, sz], GOLD, 'Metal', { collide: 0 });
  box([4, 2.4, 3], [sx, G + 4, sz - 1], 0x6a3a8a, 'Fabric', { collide: 0 });
  for (const dz of [-9, -15]) {
    box([2.4, 2.6, 5], [sx, G + 3, sz + dz], 0x7a5230, 'Fabric', { collide: 0 });
    for (const [lx, lz] of [[-0.8, -1.8], [0.8, -1.8], [-0.8, 1.8], [0.8, 1.8]]) box([0.4, 3, 0.4], [sx + lx, G, sz + dz + lz], 0x5a3a20, 'Fabric', { collide: 0 });
    box([1.2, 2.4, 1.2], [sx, G + 5, sz + dz - 2.6], 0x7a5230, 'Fabric', { collide: 0 });
    add([1.4, 1.2, 1.8], [sx, G + 7.6, sz + dz - 3.2], 0x7a5230, 'Fabric', { collide: 0 });
    add([0.4, 0.4, 0.4], [sx, G + 7.6, sz + dz - 4.2], dz === -15 ? 0xff2020 : 0x101012, dz === -15 ? 'Neon' : 'SmoothPlastic', { shape: 3, collide: 0 });
    for (const s of [-1, 1]) add([0.15, 1.8, 0.15], [sx + s * 0.6, G + 9, sz + dz - 3], 0x4a3020, 'Wood', { collide: 0, rot: [Math.cos(s * 0.5), -Math.sin(s * 0.5), 0, Math.sin(s * 0.5), Math.cos(s * 0.5), 0, 0, 0, 1] });
  }
  // elves at the gate and the workshop
  data.staff.lines.elf = ["Santa's this way!", 'Merry Christmas!', 'Ho ho ho!', 'Have you been good this year?', 'Happy holidays!', 'Santa is waiting for you on the porch!'];
  for (const [x, z, yaw] of [[gx - 6, -412, 0], [W.x - 8, W.front + 7, 0], [W.x + 8, W.front + 7, 0], [L[0][0] - 2, L[0][1] + 5, -Math.PI / 2]]) {
    data.staffSpots.push({ role: 'elf', kind: 'idle', land: 'Studios', seed: 0, cf: cf(x, G, z, yaw) });
  }
  data.xmasLights = lights;
  return { lights, tree: [tx, tz] };
}

// ------------------------------------------------------------------ live
const santaLook = { skin: 0xf0c8a8, shirt: RED, pants: RED, hair: WHITE, shoes: 0x101012, hat: RED, sleeves: 1, longPants: 1, hairStyle: 0, hatOn: 0, fem: 0, height: 1.08, width: 1.22 };
function santaParts(mi) {
  const P = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  return {
    head: [
      P(3, [0.95, 0.9, 0.6], [0, -0.78, -0.28], WHITE, 'Fabric'), // beard
      P(0, [0.7, 0.18, 0.2], [0, -0.58, -0.47], WHITE, 'Fabric'), // moustache
      P(5, [1.05, 0.5, 1.05], [0, -0.02, 0.02], RED, 'Fabric'),
      P(5, [0.7, 0.45, 0.7], [0.08, 0.38, 0.06], RED, 'Fabric'),
      P(5, [1.18, 0.26, 1.18], [0, -0.24, 0.02], WHITE, 'Fabric'),
      P(3, [0.32, 0.32, 0.32], [0.32, 0.55, 0.15], WHITE, 'Fabric'),
      P(3, [0.12, 0.08, 0.06], [-0.15, -0.42, -0.46], 0x101012, 'SmoothPlastic'),
      P(3, [0.12, 0.08, 0.06], [0.15, -0.42, -0.46], 0x101012, 'SmoothPlastic'),
      P(3, [0.16, 0.14, 0.12], [0, -0.52, -0.5], 0xe8908a, 'SmoothPlastic'),
    ],
    chest: [
      P(0, [1.2, 0.24, 0.95], [0, 0.12, 0], 0x101012, 'SmoothPlastic'), // belt
      P(0, [0.34, 0.3, 0.06], [0, 0.12, -0.5], GOLD, 'Metal'),
      P(0, [0.2, 1.1, 0.06], [0, 0.75, -0.47], WHITE, 'Fabric'),
    ],
    handL: [P(3, [1.6, 1.8, 1.4], [0, 0.2, 0.7], 0x8a6a3a, 'Fabric')], // the sack of toys
  };
}

export class Christmas {
  constructor({ scene, data, layout, people, bubbles, player, sim, hooks }) {
    this.scene = scene;
    this.people = people;
    this.bubbles = bubbles;
    this.player = player;
    this.sim = sim;
    this.hooks = hooks; // { toast, sound }
    this.t = 0;
    // twinkling bulbs: one instanced mesh, colors cycled a few times a second
    const L = data.xmasLights || [];
    this.lights = L;
    const geo = new THREE.OctahedronGeometry(0.34, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.bulbs = new THREE.InstancedMesh(geo, mat, Math.max(1, L.length));
    const m = new THREE.Matrix4();
    L.forEach(([x, y, z], i) => this.bulbs.setMatrixAt(i, m.makeTranslation(x, y, z)));
    this.bulbs.count = L.length;
    this.bulbs.frustumCulled = false;
    this.colors = BULBS.map((c) => new THREE.Color(c).multiplyScalar(1.6));
    for (let i = 0; i < L.length; i++) this.bulbs.setColorAt(i, this.colors[i % BULBS.length]);
    scene.add(this.bulbs);
    this.step = -1;
    // falling snow round the camera
    const N = 2200;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 160; pos[i * 3 + 1] = Math.random() * 70; pos[i * 3 + 2] = (Math.random() - 0.5) * 160; }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false }));
    this.snow.frustumCulled = false;
    scene.add(this.snow);
    // Santa: one walking the park, one on his throne in the workshop
    const mi = (name) => {
      let i = data.materials.indexOf(name);
      if (i < 0) { data.materials.push(name); i = data.materials.length - 1; }
      return i;
    };
    const make = () => {
      const f = new Figure(santaLook);
      const parts = santaParts(mi);
      f.headTop.add(buildModel(parts.head, data.materials, { detail: false, shadows: true }));
      f.joints.spine.add(buildModel(parts.chest, data.materials, { detail: false, shadows: true }));
      f.handL.add(buildModel(parts.handL, data.materials, { detail: false, shadows: true }));
      scene.add(f.root);
      return f;
    };
    this.walker = { fig: make(), line: WALKWAYS[0], u: 0.3, dir: 1, pos: new THREE.Vector3(), yaw: 0, pause: 0, said: 0 };
    this.seated = make();
    const [thx, thz] = WORKSHOP.throne;
    this.seated.root.position.set(thx, G + 2.7, thz + 0.2);
    this.seated.root.rotation.y = Math.PI;
    this.seated.update(0, { sitting: true });
    this.met = false;
    this.meetAt = 0;
  }

  // ---- the walk: along the park's walkways, onto whichever one joins at
  // the end, stopping to greet you when you come close
  walk(dt) {
    const w = this.walker;
    const [a, b] = w.line;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const p = this.player.pos;
    const near = Math.hypot(p.x - w.pos.x, p.z - w.pos.z) < 9;
    let speed = 0;
    if (near) {
      w.yaw += Math.atan2(Math.sin(Math.atan2(-(p.x - w.pos.x), -(p.z - w.pos.z)) - w.yaw), Math.cos(Math.atan2(-(p.x - w.pos.x), -(p.z - w.pos.z)) - w.yaw)) * Math.min(1, dt * 5);
      w.said -= dt;
      if (w.said <= 0) {
        w.said = 7;
        const lines = ['Ho ho ho! Merry Christmas!', "Have you been good this year?", 'Ho ho ho! Come see me at the workshop!', 'Happy holidays from the North Pole!'];
        this.bubbles.say(w, lines[Math.floor(Math.random() * lines.length)], this.head(w.fig), 3);
        this.hooks.sound('join');
      }
    } else {
      speed = 3.6;
      w.u += (w.dir * speed * dt) / len;
      if (w.u > 1 || w.u < 0) {
        const end = w.u > 1 ? b : a;
        const next = WALKWAYS.filter((l) => l !== w.line && (l[0].distanceTo(end) < 14 || l[1].distanceTo(end) < 14));
        if (next.length && Math.random() < 0.8) {
          const l = next[Math.floor(Math.random() * next.length)];
          w.line = l;
          const startAtA = l[0].distanceTo(end) < l[1].distanceTo(end);
          w.u = startAtA ? 0 : 1;
          w.dir = startAtA ? 1 : -1;
        } else {
          w.u = Math.max(0, Math.min(1, w.u));
          w.dir *= -1;
        }
      }
      const [a2, b2] = w.line;
      const tx = b2.x - a2.x, tz = b2.z - a2.z;
      const want = Math.atan2(-tx * w.dir, -tz * w.dir);
      w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * Math.min(1, dt * 6);
    }
    const [a3, b3] = w.line;
    w.pos.set(a3.x + (b3.x - a3.x) * w.u, 0.42, a3.z + (b3.z - a3.z) * w.u);
    w.fig.root.position.copy(w.pos);
    w.fig.root.rotation.y = w.yaw;
    w.fig.update(dt, { speed, onGround: true });
    this.bubbles.follow(w, this.head(w.fig));
  }

  head(fig) {
    const v = new THREE.Vector3();
    fig.headTop.getWorldPosition(v);
    v.y += 1.6;
    return v;
  }

  // ---- meeting Santa at the workshop
  prompt(pos) {
    if (this.player.riding) return null;
    const [mx, mz] = WORKSHOP.meet;
    if (Math.hypot(pos.x - mx, pos.z - mz) > 10) return null;
    return {
      key: `santa:${this.met}`, title: '🎅 Meet Santa', color: RED,
      sub: this.met ? 'Santa is so glad you came back! Merry Christmas!' : "Santa's Workshop · Benton Holidays, through January 1",
      actions: [{ label: this.met ? 'Say hi again' : 'Meet Santa', run: () => this.meet() }],
    };
  }

  meet() {
    const [mx, mz] = WORKSHOP.meet;
    const [thx, thz] = WORKSHOP.throne;
    const p = this.player;
    p.pos.set(mx, 1.2, mz);
    p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(-(thx - mx), -(thz - mz));
    p.camYaw = p.yaw + Math.PI + 0.6;
    p.camPitch = -0.1;
    p.camDist = 9;
    p.snapCamera();
    this.hooks.sound('fanfare');
    this.bubbles.say(this.seated, 'Ho ho ho! Merry Christmas!', this.head(this.seated), 3.2);
    this.meetAt = performance.now() / 1000 + 3.4; // (real time, so slow frames don't hold it up)
    if (!this.met) {
      this.met = true;
      this.gift = true;
    }
  }

  update(dt, cam) {
    this.t += dt;
    // twinkle: the ride lights chase, the tree lights sparkle
    const step = Math.floor(this.t * 3);
    if (step !== this.step && this.lights.length) {
      this.step = step;
      const L = this.lights, C = this.colors, n = C.length;
      for (let i = 0; i < L.length; i++) {
        const c = L[i][3] === 0 ? C[(i + step) % n] : C[(i * 7 + step * ((i % 3) + 1)) % n];
        this.bulbs.setColorAt(i, c);
      }
      this.bulbs.instanceColor.needsUpdate = true;
    }
    // snow drifts down and wraps round the camera
    const a = this.snow.geometry.getAttribute('position');
    const arr = a.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * (3 + (i % 7) * 0.3);
      arr[i] += Math.sin(this.t * 0.8 + i) * dt * 0.6;
      if (arr[i + 1] < 0) arr[i + 1] += 70;
    }
    // keep the flakes in a box round the camera
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i] - cam.x > 80) arr[i] -= 160; else if (arr[i] - cam.x < -80) arr[i] += 160;
      if (arr[i + 2] - cam.z > 80) arr[i + 2] -= 160; else if (arr[i + 2] - cam.z < -80) arr[i + 2] += 160;
    }
    a.needsUpdate = true;
    this.walk(dt);
    this.bubbles.follow(this.seated, this.head(this.seated));
    if (this.meetAt) {
      if (performance.now() / 1000 >= this.meetAt && this.gift) {
        this.meetAt = 0;
        this.gift = false;
        this.bubbles.say(this.seated, "You've been very good this year! Here's a present.", this.head(this.seated), 3.5);
        this.sim.addBucks(25, 'A present from Santa!');
        this.hooks.sound('reward');
      }
    }
    // families waiting in Santa's line
    const L = WORKSHOP.line;
    if (Math.hypot(cam.x - WORKSHOP.x, cam.z - WORKSHOP.front) < 220) {
      // walk back from the front of the line, a family every couple of studs
      for (let k = 0; k < 10; k++) {
        let d = 3 + k * 2.4;
        let j = L.length - 1;
        while (j > 0) {
          const len = Math.hypot(L[j][0] - L[j - 1][0], L[j][1] - L[j - 1][1]);
          if (d <= len) break;
          d -= len;
          j--;
        }
        if (j === 0) break;
        const [ax, az] = L[j], [bx, bz] = L[j - 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
        this.people.add('idle', k % 3, x, G + 0.1, z, Math.atan2(bx - ax, bz - az), 61000 + k * 13);
      }
    }
  }
}

// ---- after the holidays: everything coming down. The giant tree is half
// gone (its top tiers on a flatbed, a lift and a crew at work), crates of
// decorations wait where the walkway decorations stood, the last light
// strand is coming down over Main Street, and Santa's Workshop is being
// packed up behind the locked backstage gate.
export function buildXmasTeardown(data) {
  const { add, box, sign, cf } = helpers(data);
  const find = makeFinder(data);
  data.staffSpots = data.staffSpots || [];
  const crew = (kind, x, y, z, yaw) => data.staffSpots.push({ role: 'construction', kind, land: 'Plaza', seed: 0, cf: cf(x, y, z, yaw) });
  const crate = (x, z, k = 0, label = false) => {
    box([3.2, 2.4, 2.4], [x, G, z], 0x8a6a3a, 'WoodPlanks', { yaw: k * 0.3 });
    if (k % 2 === 0) box([2.6, 2, 2], [x + 0.3, G + 2.4, z], 0x8a6a3a, 'WoodPlanks', { collide: 0, yaw: k * 0.3 + 0.2 });
    if (label) sign([2.4, 0.9, 0.1], [x, G + 1.3, z + 1.25], 0x8a6a3a, 'Back', [['HOLIDAY DECOR', 0, 0, 1, 1, 0x1a1a1c, 'GothamBold']]);
  };
  const lift = (x, z, h, yaw = 0) => {
    box([4, 1.2, 7], [x, G + 0.4, z], 0xf2c818, 'SmoothPlastic', { yaw });
    for (const s of [-1, 1]) add([0.3, h - 1.6, 0.3], [x, G + h / 2, z], 0x2a2a2e, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(s * 0.55), -Math.sin(s * 0.55), 0, Math.sin(s * 0.55), Math.cos(s * 0.55)] });
    box([4.4, 0.4, 7.4], [x, G + h, z], 0xf2c818, 'SmoothPlastic', { collide: 0, yaw });
    crew('work', x, G + h + 0.4, z, yaw);
  };
  // the Plaza tree, half taken down
  const [tx, tz] = find(0, 268, 11, [[-70, 230, 70, 290]]) || [24, 262];
  const s = 4.2;
  box([0.8 * s, 1.4 * s, 0.8 * s], [tx, G, tz], BROWN, 'Wood');
  for (const [d, h, y] of [[5, 2.4, 2.2], [3.9, 2.2, 4.1]]) add([d * s, h * s, d * s], [tx, G + y * s, tz], GREEN, 'Grass', { shape: 5, collide: 0 });
  add([0.5, 14, 0.5], [tx, G + 18 + 7, tz], 0x6a4a30, 'Wood', { collide: 0 }); // the bare pole the top hung on
  // the top tiers, lying on a flatbed
  box([20, 1.2, 8], [tx + 20, G + 1.2, tz - 4], 0x3a3a3e, 'Metal');
  for (const [d, h, dx] of [[2.8 * s, 2 * s, -5], [1.6 * s, 1.7 * s, 5]]) add([h, d, d], [tx + 20 + dx, G + 2.4 + d / 2, tz - 4], GREEN, 'Grass', { shape: 2, collide: 0 });
  add([0.9 * s, 0.9 * s, 0.9 * s], [tx + 12, G + 1.9, tz + 6], GOLD, 'Metal', { shape: 3, collide: 0 }); // the star, unplugged
  lift(tx - 10, tz + 2, 16, Math.PI / 2);
  for (let k = 0; k < 5; k++) crate(tx - 14 + k * 4, tz + 14, k, k === 2);
  crew('idle', tx + 8, G, tz + 12, 0);
  // crates where the walkway decorations stood
  let k = 0;
  for (const line of WALKWAYS) {
    const [a, b] = line;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len, nx = -dz, nz = dx;
    for (let t = 10; t < len - 6; t += 26) {
      const side = (Math.round(t / 26) + k) % 2 ? 1 : -1;
      const px = a.x + dx * t + nx * side * 9, pz = a.z + dz * t + nz * side * 9;
      if (k++ % 3 || !find.clear(px, pz, 2.6)) continue;
      crate(px, pz, k, k % 2 === 0);
    }
  }
  // the last light strand over Main Street, half down
  for (let j = 0; j < 12; j++) {
    const x = -24 + j * 2.4, u = x / 24;
    add([0.3, 0.3, 0.3], [x, G + 14.4 - 2.4 * (1 - u * u), 126], [0xff2a2a, 0x2aff4a, 0xffc030, 0x3a6aff][j % 4], 'SmoothPlastic', { collide: 0, shape: 3 });
  }
  lift(4, 126, 12, 0);
  // Santa's Workshop, packed up behind the gate
  const W = WORKSHOP, wz = W.front - 8.5;
  box([40, 12, 17], [W.x, G, wz], 0x8a2a22, 'WoodPlanks');
  for (const [d, y] of [[19, 12], [14.5, 13.4], [10, 14.8], [5.5, 16.2]]) box([44, 1.4, d], [W.x, G + y, wz], 0x5a3a2a, 'Slate', { collide: 0 });
  sign([20, 3, 0.4], [W.x, G + 9, W.front + 0.4], 0x1a1a1c, 'Back', [['CLOSED FOR THE SEASON', 0, 0, 1, 1, WHITE]]);
  for (let j = 0; j < 8; j++) crate(W.x - 14 + (j % 4) * 4, W.front + 6 + Math.floor(j / 4) * 4, j, j === 1);
  box([10, 9, 22], [W.x + 30, G + 1.2, W.front + 8], WHITE, 'SmoothPlastic');
  box([8, 7, 7], [W.x + 30, G + 1, W.front + 23], 0x2a3a5a, 'SmoothPlastic');
  crew('work', W.x + 24, G, W.front + 8, Math.PI / 2);
  data.staff.lines.construction = [
    ...(data.staff.lines.construction || []),
    'The holidays are over - taking it all down!', 'Happy New Year!', 'See you next holiday season!', 'Careful, this box is full of ornaments.',
  ];
}
