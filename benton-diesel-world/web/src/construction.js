// Construction site for a new ride beside Diesel Thunder. It is too big for
// the park, so a stretch of the west wall has come down and the site runs
// out onto the hills beyond, mostly to make room for a much bigger queue.
// Construction walls with "coming soon" art hide it; inside there's a
// tower crane (its jib slowly swings), the first steel of a lift hill, a
// future queue area laid out with stanchion posts, machines, a site office
// and workers in hard hats.
import * as THREE from 'three';
import { buildModel } from './geom.js';

export const SITE = { x0: -470, x1: -357, z0: -84, z1: -4 };
const FLOOR = 0.2;
const WALL_H = 12;

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
  const { x0, x1, z0, z1 } = SITE;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  // open the west wall where the site crosses it, and clear the trees
  data.hidden = data.hidden || [];
  const hide = (i) => { data.static[i][19] = 0; data.hidden.push(i); };
  data.static.forEach((p, i) => {
    const isWall = Math.abs(p[4] + 375) < 0.5 && p[3] > 600; // the west wall and its cap
    const pillar = Math.abs(p[4] + 375) < 0.5 && Math.abs(p[1] - 4.5) < 0.01 && p[6] > z0 - 1 && p[6] < z1 - 2.5;
    if (isWall || pillar) hide(i);
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  for (const [za, zb] of [[-405, z0 - 1], [z1 + 1, 280]]) {
    add([2.5, 14, zb - za], [-375, 7, (za + zb) / 2], STONE, 'Concrete');
    add([3.4, 1, zb - za + 1], [-375, 14.5, (za + zb) / 2], CAP, 'Concrete');
  }
  data.trees = (data.trees || []).filter((t) => !(t.pos[0] > x0 - 6 && t.pos[0] < x1 + 6 && t.pos[2] > z0 - 6 && t.pos[2] < z1 + 6));
  // the terrain is leveled under the site
  data.flatZones = [...(data.flatZones || []), { x0, x1, z0, z1, margin: 26 }];

  // graded dirt
  add([x1 - x0, 1, z1 - z0], [cx, FLOOR - 0.5, cz], 0x7a5c3e, 'Ground');

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
  wallRun(x0, z0, x1, z0);
  wallRun(x0, z1, x1, z1);
  wallRun(x0, z0, x0, z1);
  // the art on the park side (east face) and along Diesel District
  sign('COMING 2027  ·  A BRAND NEW THRILL FOR DIESEL DISTRICT', [0.2, 6, 62], [x1 + 0.35, 6.4, cz], 0x16223a, 0xf0c440, 'Right');
  sign('PARDON OUR DUST', [0.2, 2.4, 30], [x1 + 0.35, 10.6, cz - 22], 0xd66e2c, 0xffffff, 'Right');
  sign('BENTON IMAGINEERS AT WORK', [0.2, 2.4, 30], [x1 + 0.35, 10.6, cz + 22], 0xd66e2c, 0xffffff, 'Right');
  sign('NEW RIDE - BIGGEST QUEUE IN THE PARK', [24, 3.4, 0.2], [x1 - 12.5, 7.5, z1 + 0.35], 0x16223a, 0xfaf3e0, 'Back');
  sign('HARD HAT AREA - AUTHORIZED PERSONNEL ONLY', [24, 3.4, 0.2], [x1 - 12.5, 7.5, z0 - 0.35], 0xf0c440, 0x16223a, 'Front');

  // the future queue: a huge slab laid out with stanchion posts, rails
  // going in on the first rows
  const q = { x0: x0 + 8, x1: x0 + 72, z0: z0 + 8, z1: z0 + 46 };
  add([q.x1 - q.x0, 0.4, q.z1 - q.z0], [(q.x0 + q.x1) / 2, FLOOR + 0.2, (q.z0 + q.z1) / 2], 0xbdb4a6, 'Concrete');
  let row = 0;
  for (let z = q.z0 + 3; z < q.z1; z += 4, row++) {
    for (let x = q.x0 + 2; x < q.x1 - 1; x += 6) box([0.4, 3.2, 0.4], [x, FLOOR + 0.4, z], 0x464a54, 'Metal');
    if (row < 3) add([q.x1 - q.x0 - 6, 0.25, 0.25], [(q.x0 + q.x1) / 2 + 1, FLOOR + 3.2, z], 0xd66e2c, 'Metal', { collide: 0 });
  }
  sign('FUTURE QUEUE  ·  ROOM FOR 2+ HOURS', [20, 2.6, 0.3], [(q.x0 + q.x1) / 2, 6, q.z1 + 1], 0x16223a, 0xffffff, 'Back');
  box([0.4, 4.8, 0.4], [(q.x0 + q.x1) / 2 - 8, FLOOR, q.z1 + 1], 0x464a54, 'Metal');
  box([0.4, 4.8, 0.4], [(q.x0 + q.x1) / 2 + 8, FLOOR, q.z1 + 1], 0x464a54, 'Metal');

  // the first steel of a lift hill: columns rising, track on the first few
  const STEEL = 0xb8361a; // freshly painted steel, Diesel red-orange
  const hillX = x0 + 85;
  for (let k = 0; k < 7; k++) {
    const z = z0 + 10 + k * 10;
    const h = 14 + k * 11;
    for (const dx of [-3, 3]) box([1.6, h, 1.6], [hillX + dx, FLOOR, z], STEEL, 'SmoothPlastic');
    add([8, 1.2, 1.2], [hillX, FLOOR + h, z], STEEL, 'SmoothPlastic', { collide: 0 });
    box([5, 1, 5], [hillX, FLOOR, z], 0xbdb8b0, 'Concrete');
    if (k < 4) {
      const rise = 11, run = 10;
      const ang = Math.atan2(rise, run);
      const c = Math.cos(ang), s = Math.sin(ang);
      for (const dx of [-1.6, 1.6]) {
        add([0.8, 0.8, Math.hypot(rise, run)], [hillX + dx, FLOOR + h + 1 + rise / 2, z + run / 2], 0x5a5e66, 'Metal', { collide: 0, rot: [1, 0, 0, 0, c, s, 0, -s, c] });
      }
    }
  }
  // a stack of rail pieces waiting to go up
  for (let k = 0; k < 5; k++) add([1, 1, 18], [hillX - 14, FLOOR + 0.5 + k, z0 + 22], STEEL, 'SmoothPlastic');

  // machines and site stuff
  const yellow = 0xf2c818;
  // excavator
  box([6, 3, 8], [x0 + 30, FLOOR, z1 - 14], 0x2a2a2e, 'Rubber');
  box([5.5, 3.6, 5.5], [x0 + 30, FLOOR + 3, z1 - 14], yellow, 'SmoothPlastic');
  add([1.2, 1.2, 10], [x0 + 30, FLOOR + 8, z1 - 21], yellow, 'SmoothPlastic', { collide: 0, rot: [1, 0, 0, 0, 0.8, 0.6, 0, -0.6, 0.8] });
  // dirt piles
  for (const [x, z, r] of [[x0 + 18, z1 - 10, 7], [x0 + 46, z1 - 9, 5], [x0 + 52, z1 - 16, 4]]) add([r * 2, r * 2, r * 2], [x, FLOOR - r * 0.35, z], 0x6e5034, 'Ground', { shape: 3 });
  // cement mixer truck
  box([5, 3, 14], [hillX - 22, FLOOR + 1, z1 - 12], 0xf0f0ec, 'SmoothPlastic');
  add([7, 4.4, 4.4], [hillX - 22, FLOOR + 6, z1 - 10], 0xd66e2c, 'SmoothPlastic', { shape: 2, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  // site office trailer and portable toilets
  box([10, 6, 24], [x1 - 10, FLOOR + 1, z0 + 20], 0xeeeeea, 'SmoothPlastic');
  sign('SITE OFFICE', [0.2, 1.6, 8], [x1 - 15.1, FLOOR + 5.2, z0 + 20], 0x16223a, 0xffffff, 'Left', 'GothamBold');
  for (let k = 0; k < 3; k++) box([3.4, 7, 3.4], [x1 - 6, FLOOR, z0 + 38 + k * 4], 0x2f6fbf, 'SmoothPlastic');
  // barrels
  for (let k = 0; k < 6; k++) add([3, 2.4, 2.4], [x1 - 22 + (k % 3) * 3, FLOOR + 1.5, z1 - 6 - Math.floor(k / 3) * 3], k % 2 ? 0xffffff : 0xff6a10, 'SmoothPlastic', { shape: 2, rot: [0, -1, 0, 1, 0, 0, 0, 0, 1] });

  // the crew, in hard hats and orange vests
  const spots = [
    ['work', hillX + 5, z0 + 22, -Math.PI / 2], ['work', hillX - 5, z0 + 42, Math.PI / 2], ['work', q.x0 + 20, q.z0 + 10, 0],
    ['work', q.x0 + 44, q.z0 + 22, Math.PI], ['idle', x1 - 16, z0 + 34, -Math.PI / 2], ['work', x0 + 36, z1 - 18, 0],
    ['idle', hillX - 20, z1 - 20, Math.PI], ['work', q.x0 + 30, q.z1 - 6, 0.6],
  ];
  for (const [kind, x, z, yaw] of spots) {
    data.staffSpots.push({ role: 'construction', kind, land: 'Diesel', seed: 0, cf: [x, FLOOR, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)] });
  }
  Object.assign(data.staff.lines, {
    construction: ['Hard hat area, folks!', "Can't tell you what it is yet!", "It's going to be huge!", 'Pardon our dust!'],
  });
  return { crane: { x: hillX - 30, z: z0 + 30 } };
}

// The tower crane, whose jib swings slowly back and forth.
export class Construction {
  constructor(scene, data, layout, hooks) {
    this.hooks = hooks;
    const mi = (name) => data.materials.indexOf(name);
    const P = (sx, sy, sz, x, y, z, color, mat) => [0, sx, sy, sz, x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mi(mat), 0, 0];
    const Y = 0xf2c818;
    const { x, z } = layout.crane;
    // mast (a lattice suggested by a slim box with cross plates)
    const mast = buildModel([
      P(4, 2, 4, 0, 1, 0, 0xbdb8b0, 'Concrete'),
      P(2.4, 96, 2.4, 0, 49, 0, Y, 'Metal'),
      ...Array.from({ length: 12 }, (_, k) => P(2.8, 0.4, 2.8, 0, 6 + k * 8, 0, 0xd8b010, 'Metal')),
    ], data.materials, { shadows: true });
    mast.position.set(x, FLOOR, z);
    scene.add(mast);
    // jib, counter-jib, counterweight, cab and a hook on its cable
    this.jib = buildModel([
      P(70, 2, 2.2, 22, 0, 0, Y, 'Metal'),
      P(20, 1.6, 2, -18, 0, 0, Y, 'Metal'),
      P(6, 4, 3, -24, -1.6, 0, 0x8a8e96, 'Concrete'),
      P(3.2, 3.2, 3.2, 2.2, -2.6, 0, 0xf0f0ec, 'SmoothPlastic'),
      P(1.4, 9, 1.4, 0, 4.5, 0, Y, 'Metal'),
      P(0.12, 30, 0.12, 40, -15, 0, 0x202024, 'Metal'),
      P(1.4, 1.2, 1.4, 40, -30.6, 0, 0xd66e2c, 'Metal'),
      P(1, 1, 16, 40, -32, 0, 0xd66e2c, 'Metal'),
    ], data.materials, { shadows: true });
    this.jib.position.set(x, FLOOR + 98, z);
    scene.add(this.jib);
    this.site = new THREE.Vector3((SITE.x0 + SITE.x1) / 2, 0, (SITE.z0 + SITE.z1) / 2);
    this.told = false;
    this.nextClank = 2;
  }

  update(dt, time, playerPos, started) {
    this.jib.rotation.y = 0.9 + Math.sin(time * 0.06) * 1.1;
    if (!started) return;
    const d = Math.hypot(playerPos.x - this.site.x, playerPos.z - this.site.z);
    if (d < 95 && !this.told) {
      this.told = true;
      this.hooks.toast('Something big is being built here: a brand new ride for Diesel District, with the biggest queue in the park!', 'info');
    }
    // hammering and clanking from behind the walls
    this.nextClank -= dt;
    if (this.nextClank <= 0) {
      this.nextClank = 1.2 + Math.random() * 3;
      if (d < 85) this.hooks.sound('clank');
    }
  }
}
