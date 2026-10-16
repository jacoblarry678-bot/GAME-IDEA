// The way into the park, from the road: a toll plaza, coned traffic lanes
// that split cars into Regular, Preferred and Deluxe parking, the lot
// itself (which fills up through the morning), and the security
// checkpoint between the lot and the front gate, with bag check tables and
// walk-through metal detectors. Guests get out of their cars, line up at
// bag check and walk through the detectors on their way in.
import * as THREE from 'three';
import * as Clock from './clock.js';
import { buildModel } from './geom.js';
import { STAFF } from './people/crowd.js';

export const SECURITY = { front: 344, back: 314, detectorZ: 322, tableZ: 332, fenceX: 150, lanes: [-30, -18, -6, 6, 18, 30] };
const walkX = (c) => c + 1.5; // where guests walk through a lane's detector
const TABLE_X = (c) => c - 3.6;

export const TIERS = [
  { id: 'Deluxe', name: 'Deluxe Parking', short: 'D', color: 0xf0c440, rows: [370], fill: 0.3, price: 40, lane: 14, endZ: 386, note: 'Right by the gate' },
  { id: 'Preferred', name: 'Preferred Parking', short: 'P', color: 0x40aa5a, rows: [396, 422], fill: 0.45, price: 20, lane: 0, endZ: 436, note: 'A short walk' },
  { id: 'Regular', name: 'Regular Parking', short: 'R', color: 0x2878dc, rows: [448, 474, 500, 526, 552], fill: 0.55, price: 0, lane: -14, endZ: 562, note: 'Free' },
];
const STALL_XS = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280];
const NEW_ROWS = [474, 500, 526, 552]; // rows added south of the original lot
const BOOTH_Z = 604;
const ROAD_END = 720;
const PARKWAY_WB = 649, PARKWAY_EB = 661; // the Benton Parkway's lanes (see resort.js)
const CONE_LINES = [[-21, 598, 562], [-7, 598, 436], [7, 598, 386], [21, 598, 386]];
const ISLANDS = [-21, -7, 7, 21];
const LAMPS = [[-150, 0], [150, 0]]; // no lamps in the stalls
const aisleZ = (row) => row + 13;
const GROUND = 0.3; // asphalt top
const PAVERS = 0.42; // forecourt top

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a CFrame-like record [x, y, z, r00..r22] for a yaw (facing direction)
const facingCF = (x, y, z, yaw) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
// yaw that faces along (dx, dz), in the people's convention
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const FACE_NORTH = 0, FACE_SOUTH = Math.PI, FACE_EAST = -Math.PI / 2, FACE_WEST = Math.PI / 2;

// ---------------------------------------------------------------- build
// Adds the entrance's parts, signs and staff to the park data (before the
// world and collisions are built) and returns its layout.
export function buildEntrance(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, trans = 0, rot = null, shape = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const r = rot || [c, 0, s, 0, 1, 0, -s, 0, c];
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...r, color, mi(mat), trans, collide]);
    return data.static.length - 1;
  };
  // box standing on a floor: base = [x, floorY, z]
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, { face = 'Back', font = 'GothamBlack', yaw = 0 } = {}) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({ part: i, face, glow: true, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.12 }] });
    return i;
  };
  const staff = (role, kind, x, y, z, yaw, extra = {}) => {
    data.staffSpots.push({ role, kind, land: 'Plaza', seed: 0, cf: facingCF(x, y, z, yaw), ...extra });
  };
  const WHITE = 0xffffff, NAVY = 0x16223a, SCREEN = 0x1e4f8c, ORANGE = 0xd66e2c, STEEL = 0xc4c6cc, DARK = 0x3c4048;

  // the old spawn pad sat where security now stands
  data.hidden = data.hidden || [];
  data.static.forEach((p, i) => {
    if (Math.abs(p[1] - 30) < 0.01 && Math.abs(p[3] - 16) < 0.01 && Math.abs(p[6] - 330) < 0.5) {
      p[19] = 0;
      data.hidden.push(i);
    }
  });

  // ---- security checkpoint
  const S = SECURITY;
  // canopy: columns, roof, orange fascia with screens
  for (const x of [-42, -24, 0, 24, 42]) {
    for (const z of [S.back + 1, S.front - 1]) box([0.9, 13.2, 0.9], [x, PAVERS, z], STEEL, 'Metal');
  }
  add([88, 0.8, 31], [0, 13.9, 329], 0xb8bbc0, 'Metal', { collide: 0 });
  for (const z of [S.back - 0.4, S.front + 0.4]) add([89, 2.6, 0.6], [0, 12.4, z], ORANGE, 'WoodPlanks', { collide: 0 });
  sign('SECURITY CHECKPOINT', [34, 2.0, 0.2], [0, 12.4, S.front + 0.8], SCREEN, WHITE);
  sign('BAGS OPEN, PLEASE', [14, 1.6, 0.2], [-33, 12.4, S.front + 0.8], SCREEN, WHITE, { font: 'GothamBold' });
  sign('NO WEAPONS - ILLEGAL ITEMS WILL BE CONFISCATED', [24, 1.6, 0.2], [33, 12.4, S.front + 0.8], SCREEN, WHITE, { font: 'GothamBold' });
  sign('THANKS FOR YOUR PATIENCE', [30, 2.0, 0.2], [0, 12.4, S.back - 0.8], SCREEN, WHITE, { face: 'Front' });
  for (const x of [-30, -6, 18]) add([1.2, 0.2, 26], [x + 6, 13.4, 329], 0xfff4e0, 'Neon', { collide: 0 });
  const detectors = [];
  S.lanes.forEach((c, i) => {
    const tx = TABLE_X(c);
    // bag check table: orange panels, stainless top, gray end caps
    box([2.6, 2.9, 12], [tx, PAVERS, S.tableZ], ORANGE, 'WoodPlanks');
    box([2.9, 0.15, 12.3], [tx, PAVERS + 2.9, S.tableZ], 0xd8dade, 'Metal', { collide: 0 });
    for (const z of [S.tableZ - 6, S.tableZ + 6]) box([2.8, 3.0, 0.4], [tx, PAVERS, z], 0x8a8e96, 'Metal', { collide: 0 });
    // bins to put bags in, and an x-ray scanner on every other lane
    for (let k = 0; k < 3; k++) box([1.9, 0.45, 1.3], [tx, PAVERS + 3.05 + k * 0.45, S.tableZ + 4.8], 0x5a5e66, 'Plastic', { collide: 0 });
    if (i % 2 === 0) {
      box([2.8, 2.4, 3.4], [tx, PAVERS + 3.05, S.tableZ - 1], 0xe2e4e8, 'SmoothPlastic', { collide: 0 });
      box([2.0, 1.2, 3.6], [tx, PAVERS + 3.15, S.tableZ - 1], 0x15161a, 'SmoothPlastic', { collide: 0 });
    }
    // numbered lane post (as in the photos: an orange-paneled pillar)
    box([2.2, 4.2, 1.6], [tx, PAVERS, S.tableZ + 7.5], 0x6a6e76, 'Metal');
    box([1.8, 3.2, 1.65], [tx, PAVERS + 0.5, S.tableZ + 7.5], ORANGE, 'WoodPlanks', { collide: 0 });
    sign(`${i + 1} →`, [1.5, 1.3, 0.1], [tx, PAVERS + 3.5, S.tableZ + 8.36], SCREEN, WHITE);
    // walk-through metal detector
    const wx = walkX(c);
    for (const sx of [-1.75, 1.75]) box([0.6, 7.2, 1.2], [wx + sx, PAVERS, S.detectorZ], 0xc8cad0, 'Metal');
    box([4.1, 0.8, 1.2], [wx, PAVERS + 7.2, S.detectorZ], 0xb0b4ba, 'Metal', { collide: 0 });
    detectors.push({ lane: i, x: wx, z: S.detectorZ, top: PAVERS + 8.0 });
    // officers: one checking bags, one at the detector
    staff('security', 'table', tx - 2.1, PAVERS, S.tableZ, FACE_EAST, { lane: i });
    staff('security', 'detector', wx + 3.1, PAVERS, S.detectorZ + 3.2, FACE_SOUTH, { lane: i });
  });
  // fences: between the detectors, out to the sides, and north to the wall
  const fence = (x1, x2, z) => {
    const len = Math.abs(x2 - x1);
    if (len < 0.5) return;
    box([len, 3.4, 0.25], [(x1 + x2) / 2, GROUND, z], 0x41454e, 'Metal');
    box([len, 0.25, 0.4], [(x1 + x2) / 2, GROUND + 3.4, z], 0x2a2d33, 'Metal', { collide: 0 });
  };
  const gaps = S.lanes.map((c) => walkX(c));
  fence(-S.fenceX, gaps[0] - 2.05, S.detectorZ);
  for (let i = 0; i < gaps.length - 1; i++) fence(gaps[i] + 2.05, gaps[i + 1] - 2.05, S.detectorZ);
  fence(gaps[gaps.length - 1] + 2.05, S.fenceX, S.detectorZ);
  for (const x of [-S.fenceX, S.fenceX]) {
    box([0.25, 3.4, S.detectorZ - 282], [x, GROUND, (S.detectorZ + 282) / 2], 0x41454e, 'Metal');
  }

  // ---- the lot: more rows to the south, toll plaza and the access road
  const ASPHALT = 0x46484c;
  add([640, 1, 105], [0, GROUND - 0.5, 522.5], ASPHALT, 'Asphalt');
  add([100, 1, 66], [0, GROUND - 0.5, 608], ASPHALT, 'Asphalt');
  add([48, 1, 80], [0, GROUND - 0.5, 680], ASPHALT, 'Asphalt');
  for (const row of NEW_ROWS) {
    for (const side of [-1, 1]) {
      for (const x of STALL_XS) add([0.4, 0.05, 12], [side * x - 10, 0.33, row], 0xf0f0f0, 'SmoothPlastic', { collide: 0 });
    }
  }
  // lane markings on the road
  for (const x of [-7, 7]) {
    for (let z = 620; z < ROAD_END; z += 12) add([0.35, 0.05, 6], [x, 0.33, z], 0xf0f0f0, 'SmoothPlastic', { collide: 0 });
  }
  // row signs: tier color, row letter
  for (const tier of TIERS) {
    tier.rows.forEach((row, r) => {
      for (const side of [-1, 1]) {
        box([0.4, 9, 0.4], [side * 88, GROUND, row], DARK, 'Metal');
        sign(`${tier.id.toUpperCase()}  ${tier.short}${r + 1}`, [7, 2.2, 0.3], [side * 88, GROUND + 10, row], tier.color, WHITE);
      }
    });
  }
  // lamps in the new rows (in the aisles)
  for (const z of [513, 539]) {
    for (const x of [-150, 150, -230, 230]) {
      add([11, 0.5, 0.5], [x, GROUND + 5.5, z], 0x1e222c, 'Metal', { shape: 2, rot: [0, -1, 0, 1, 0, 0, 0, 0, 1] });
      add([1.6, 1.6, 1.6], [x, GROUND + 11.6, z], 0xffecbe, 'Neon', { shape: 3, collide: 0 });
      data.tags.ParkLamp = data.tags.ParkLamp || [];
      data.tags.ParkLamp.push([x, GROUND + 11.6, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
  }
  // toll plaza: curbed islands, booths with windows, barrier arms (up)
  const booths = [];
  ISLANDS.forEach((x, k) => {
    box([3, 0.6, 16], [x, GROUND, BOOTH_Z], 0xc8c6c0, 'Concrete');
    if (k === ISLANDS.length - 1) {
      box([1.6, 2.6, 10], [x, GROUND + 0.6, BOOTH_Z], 0xd2d0ca, 'Concrete');
      return;
    }
    const tier = TIERS.find((t) => t.lane === x + 7);
    const fy = GROUND + 0.6;
    box([0.2, 6, 4.6], [x - 1.2, fy, BOOTH_Z], 0xefebe2, 'SmoothPlastic');
    for (const dz of [-2.2, 2.2]) box([2.6, 6, 0.2], [x, fy, BOOTH_Z + dz], 0xefebe2, 'SmoothPlastic');
    box([0.2, 2.6, 4.6], [x + 1.2, fy, BOOTH_Z], 0xefebe2, 'SmoothPlastic');
    box([0.2, 2.8, 4.2], [x + 1.2, fy + 2.7, BOOTH_Z], 0xa8cce0, 'Glass', { trans: 0.6, collide: 0 });
    box([3.6, 0.5, 6], [x, fy + 6, BOOTH_Z], tier.color, 'SmoothPlastic', { collide: 0 });
    // barrier arm, raised
    const px = x + 1.6, py = GROUND + 3.4, pz = BOOTH_Z - 6;
    box([0.8, 3.1, 0.8], [px, GROUND, pz], 0xc83228, 'Metal');
    const a = THREE.MathUtils.degToRad(72);
    const m = new THREE.Matrix4().makeRotationZ(a);
    const e = m.elements;
    add([10, 0.3, 0.3], [px + 5 * Math.cos(a), py + 5 * Math.sin(a), pz], 0xf2f2f2, 'SmoothPlastic', { collide: 0, rot: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]] });
    staff('parking', 'booth', x, fy, BOOTH_Z, FACE_EAST);
    booths.push({ x, tier: tier.id });
  });
  // gantry over the lanes
  for (const x of [-28, 28]) box([1, 13, 1], [x, GROUND, BOOTH_Z + 10], DARK, 'Metal');
  add([58, 1.6, 1.4], [0, GROUND + 13, BOOTH_Z + 10], DARK, 'Metal', { collide: 0 });
  sign('BENTON DIESEL WORLD PARKING', [44, 1.4, 0.3], [0, GROUND + 13, BOOTH_Z + 10.85], NAVY, 0xfaf3e0);
  for (const tier of TIERS) {
    sign(tier.id.toUpperCase(), [11, 2.6, 0.3], [tier.lane, GROUND + 10.6, BOOTH_Z + 10.85], tier.color, WHITE);
    sign(tier.price ? `B$${tier.price}` : 'FREE', [5, 1.3, 0.3], [tier.lane, GROUND + 8.6, BOOTH_Z + 10.85], NAVY, WHITE, { font: 'GothamBold' });
  }
  // parking crew: one at the end of each coned lane, two in the lot
  for (const tier of TIERS) staff('parking', 'lane', tier.lane + 7, GROUND, tier.endZ + 1, FACE_SOUTH);
  staff('parking', 'lot', -62, GROUND, 461, FACE_SOUTH);
  staff('parking', 'lot', 62, GROUND, 513, FACE_SOUTH);

  // traffic cones and delineator posts (drawn by the browser)
  const cones = [], posts = [];
  for (const [x, z1, z2] of CONE_LINES) {
    for (let z = z1; z >= z2 + 3; z -= 4.5) cones.push([x, z]);
    posts.push([x, z1 + 2.5], [x, z2]);
  }
  for (const x of ISLANDS) posts.push([x, BOOTH_Z + 9], [x, BOOTH_Z - 9]);

  // staff lines for the new roles
  Object.assign(data.staff.lines, {
    security: ['Bags open, please!', 'Step right up to the table!', 'Thanks for your patience!', 'Have a great day!'],
    detector: ["You're all set - enjoy the park!", 'All clear, welcome in!', 'Thank you! Have fun today!'],
    parking: ['This way, please!', 'Keep it moving, folks!', 'Watch for cars!', 'Welcome! Have a great visit!'],
  });

  // stalls, and which ones already had a car parked in the original lot
  const r = rng(99);
  const stalls = [];
  for (const tier of TIERS) {
    for (const row of tier.rows) {
      for (const side of [-1, 1]) {
        for (const x of STALL_XS) {
          const sx = side * x;
          let taken = false;
          if (NEW_ROWS.includes(row)) taken = r() < tier.fill;
          else taken = data.static.some((p) => Math.abs(p[1] - 6.5) < 0.01 && Math.abs(p[3] - 11) < 0.01 && Math.abs(p[4] - sx) < 1 && Math.abs(p[6] - row) < 1);
          // keep clear of the lamps standing in the old lot
          const lamp = row === 422 && (Math.abs(sx) === 120 || Math.abs(sx) === 200);
          stalls.push({ x: sx, z: row, tier: tier.id, row, taken: taken || lamp, staticCar: !NEW_ROWS.includes(row) && taken, preParked: NEW_ROWS.includes(row) && taken });
        }
      }
    }
  }
  // the player starts the day in the lot; "back to the gate" goes inside
  data.config.Spawn = [0, 3, 298];
  return { detectors, cones, posts, stalls, booths };
}

// ---------------------------------------------------------- live entrance
function coneGeometry() {
  // lime green with white reflective collars, on a square base
  const prof = [[0.56, 0.12], [0.5, 0.2], [0.33, 1.15], [0.31, 1.3], [0.27, 1.6], [0.25, 1.75], [0.21, 1.95], [0.1, 2.4], [0, 2.45]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const white = (y > 1.18 && y < 1.62) || (y > 1.72 && y < 1.97);
    col.set(white ? [0.92, 0.94, 0.94] : [0.5, 0.86, 0.06], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const base = new THREE.BoxGeometry(1.3, 0.12, 1.3);
  base.translate(0, 0.06, 0);
  const bc = new Float32Array(base.getAttribute('position').count * 3);
  for (let i = 0; i < bc.length; i += 3) bc.set([0.32, 0.6, 0.04], i);
  base.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  return [g, base];
}

function postGeometry() {
  // orange and white striped delineator post
  const g = new THREE.CylinderGeometry(0.22, 0.22, 4, 10, 8);
  g.translate(0, 2.1, 0);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const band = Math.floor(pos.getY(i) / 0.5) % 2;
    col.set(band ? [0.95, 0.95, 0.95] : [0.95, 0.32, 0.1], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// the same simple car the park builder parks in the lot
export const CAR_PARTS = (bodyColor) => {
  const P = (sx, sy, sz, x, y, z, color, mat, shape = 0) => [shape, sx, sy, sz, x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1, color, mat, 0, 0];
  return (mi) => [
    P(6.5, 2.4, 11, 0, 2.1, 0, bodyColor, mi('SmoothPlastic')),
    P(6, 2.2, 6, 0, 4.4, 0.5, 0x1e2a36, mi('SmoothPlastic')),
    P(6.1, 1.6, 5.4, 0, 4.3, 0.5, 0xa0c8e6, mi('Glass')),
    ...[[-3.2, -3.6], [-3.2, 3.6], [3.2, -3.6], [3.2, 3.6]].map(([x, z]) => P(0.8, 2.6, 2.6, x, 1.3, z, 0x191919, mi('Rubber'), 2)),
  ];
};
export const CAR_COLORS = [0xc42828, 0x1e6ee6, 0xf0f0f0, 0x1e1e22, 0xf0c440, 0x78828c, 0x40a048, 0x8a2a2a, 0xd0d4da];

export class Entrance {
  constructor({ scene, data, layout, people, staff, hooks }) {
    this.data = data;
    this.layout = layout;
    this.people = people;
    this.staff = staff;
    this.hooks = hooks; // { sound(kind), toast(text, kind) }
    this.rand = rng(4242);
    // cones and posts
    const [coneG, baseG] = coneGeometry();
    const coneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    const putAll = (geo, list, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const mtx = new THREE.Matrix4();
      list.forEach(([x, z], i) => m.setMatrixAt(i, mtx.makeTranslation(x, GROUND, z)));
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    putAll(coneG, layout.cones, coneMat);
    putAll(baseG, layout.cones, coneMat);
    putAll(postGeometry(), layout.posts, coneMat);
    // a stack of spare blue cones by the booths
    const blue = coneG.clone();
    const bc = blue.getAttribute('color');
    for (let i = 0; i < bc.count; i++) bc.setXYZ(i, 0.15, 0.4, 0.85);
    const stack = new THREE.InstancedMesh(blue, coneMat, 4);
    for (let k = 0; k < 4; k++) stack.setMatrixAt(k, new THREE.Matrix4().makeTranslation(30, GROUND + k * 0.28, BOOTH_Z - 6));
    scene.add(stack);

    // detector status lamps: amber, flashing green as someone walks through
    this.detectors = layout.detectors.map((d) => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.3), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
      lamp.position.set(d.x, d.top + 0.2, d.z + 0.62);
      scene.add(lamp);
      return { ...d, lamp, flash: 0, queue: [], table: null };
    });

    // cars: one instanced mesh per material family of the car model
    const model = buildModel(CAR_PARTS(0xffffff)((n) => this.matIndex(n)), data.materials, { detail: true });
    this.carCap = layout.stalls.length + 8;
    this.carMeshes = model.children.map((c) => {
      const m = new THREE.InstancedMesh(c.geometry, c.material, this.carCap);
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    this.bodyMesh = this.carMeshes.find((m) => m.material.name === 'paint') || this.carMeshes[0];
    this.cars = [];
    for (const s of layout.stalls) if (s.preParked) this.park(s, CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)]);
    this.walkers = [];
    this.nextCar = 2;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.color = new THREE.Color();
    this.playerLane = -1;
    this.lastPlayer = null;
    // a few guests already going through security when the park opens
    for (let i = 0; i < 10; i++) this.addWalker(null, 6 + this.rand() * 40);
  }

  matIndex(name) {
    const mats = this.data.materials;
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  }

  park(stall, color) {
    stall.taken = true;
    this.cars.push({ state: 'parked', pos: new THREE.Vector3(stall.x, GROUND, stall.z), yaw: 0, color, stall });
  }

  freeStall(tierId, nearest = false) {
    const free = this.layout.stalls.filter((s) => s.tier === tierId && !s.taken);
    if (!free.length) return null;
    if (nearest) {
      free.sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x));
      return free[0];
    }
    return free[Math.floor(this.rand() * free.length)];
  }

  // a car arrives from the road and drives to a stall in its tier
  addCar() {
    const roll = this.rand();
    const order = roll < 0.12 ? ['Deluxe', 'Preferred', 'Regular'] : roll < 0.4 ? ['Preferred', 'Regular', 'Deluxe'] : ['Regular', 'Preferred', 'Deluxe'];
    let stall = null, tier = null;
    for (const id of order) {
      stall = this.freeStall(id);
      if (stall) { tier = TIERS.find((t) => t.id === id); break; }
    }
    if (!stall) return;
    stall.taken = true;
    const lx = tier.lane;
    // up the road from the south, or off the Benton Parkway from either way
    const from = this.rand();
    const prefix = from < 0.4 ? [[lx, ROAD_END + 20]]
      : from < 0.7 ? [[-780, PARKWAY_EB], [lx - 10, PARKWAY_EB], [lx, PARKWAY_EB - 10]]
        : [[780, PARKWAY_WB], [lx + 10, PARKWAY_WB], [lx, PARKWAY_WB - 6]];
    const pts = [...prefix, ...this.routeIn(stall, tier)].map(([x, z]) => new THREE.Vector3(x, GROUND, z));
    const yaw = from < 0.4 ? 0 : from < 0.7 ? -Math.PI / 2 : Math.PI / 2;
    this.cars.push({ state: 'drive', pts, seg: 0, b: prefix.length - 1, pos: pts[0].clone(), yaw, speed: 0, color: CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)], stall, lane: lx, stopped: 0, boothDone: false });
  }

  // from the toll booth to a stall: down the coned lane, along the aisle
  // and nose in
  routeIn(stall, tier = TIERS.find((t) => t.id === stall.tier)) {
    const lx = tier.lane;
    const az = aisleZ(stall.row);
    return [[lx, BOOTH_Z + 2], [lx, tier.endZ], [lx, az], [stall.x - Math.sign(stall.x) * 8, az], [stall.x, az - 4], [stall.x, stall.z]];
  }

  aisle(stall) {
    return aisleZ(stall.row);
  }

  // guests off the shuttle walk from the platform to the shortest bag check line
  addWalkerFrom(x, z) {
    const lanes = this.detectors;
    const lane = lanes.reduce((a, b) => (b.queue.length < a.queue.length ? b : a), lanes[Math.floor(this.rand() * lanes.length)]);
    const seed = 30000 + Math.floor(this.rand() * 1e6);
    const pts = [[x, SECURITY.front + 8], [lane.x, SECURITY.front + 8], [lane.x, SECURITY.front + 3]];
    this.walkers.push({
      seed, lane, pts: pts.map(([px, pz]) => new THREE.Vector3(px, GROUND, pz)), seg: 0,
      pos: new THREE.Vector3(x, GROUND, z), yaw: Math.PI / 2, cycle: this.rand(), phase: 'approach', wait: 0, speed: 3.8 + this.rand() * 1.2,
    });
  }

  // guests leave their car and head for security
  addWalker(stall, startDelay = 0) {
    const lanes = this.detectors;
    // the lane with the shortest line
    const lane = lanes.reduce((a, b) => (b.queue.length < a.queue.length ? b : a), lanes[Math.floor(this.rand() * lanes.length)]);
    const seed = 30000 + Math.floor(this.rand() * 1e6);
    const pts = [];
    if (stall) {
      const door = stall.x - Math.sign(stall.x) * 4.6;
      const cx = Math.sign(stall.x) * (8 + this.rand() * 50);
      pts.push([door, stall.z], [door, stall.z - 13], [cx, stall.z - 13], [cx, SECURITY.front + 8]);
    }
    pts.push([lane.x, SECURITY.front + 3]);
    this.walkers.push({
      seed, lane, pts: pts.map(([x, z]) => new THREE.Vector3(x, GROUND, z)), seg: 0,
      pos: stall ? new THREE.Vector3(pts[0][0], GROUND, pts[0][1]) : new THREE.Vector3(lane.x + (this.rand() - 0.5) * 30, GROUND, SECURITY.front + 6 + startDelay),
      yaw: Math.PI, cycle: this.rand(), phase: 'approach', wait: 0, speed: 3.8 + this.rand() * 1.2,
    });
  }

  // the player picks a tier: spend, park next to your car
  arrive(tierId, player, sim, shirtColor) {
    const tier = TIERS.find((t) => t.id === tierId) || TIERS[2];
    let chosen = tier;
    if (tier.price > sim.profile.bucks) chosen = TIERS[2];
    const stall = this.freeStall(chosen.id, true) || this.freeStall('Regular', true);
    if (!stall) return;
    this.park(stall, shirtColor ?? 0x1e6ee6);
    this.myCar = stall;
    if (chosen.price) {
      sim.profile.bucks -= chosen.price;
      sim.save();
    }
    const row = chosen.rows.indexOf(stall.row) + 1;
    this.hooks.toast(`You parked in ${chosen.name}, row ${chosen.short}${row}${chosen.price ? ` (B$${chosen.price})` : ''}. Head through security to the gate!`, 'info');
    this.toCar(player);
  }

  // stand next to your car (also used by "back to my car")
  toCar(player) {
    const s = this.myCar;
    if (!s) return;
    player.pos.set(s.x - Math.sign(s.x) * 5, GROUND + 0.2, s.z);
    player.vel.set(0, 0, 0);
    player.yaw = FACE_NORTH;
    player.camYaw = 0;
    player.snapCamera();
  }

  flash(d, cam, who) {
    d.flash = 1.2;
    if (d.lamp.position.distanceToSquared(cam) < 45 * 45) this.hooks.sound('detector');
    if (who === 'player') {
      const officer = this.staff.spotNear('security', d.x, d.z, 'detector');
      if (officer) this.staff.say(officer, this.staff.lines.detector[Math.floor(Math.random() * this.staff.lines.detector.length)]);
    }
  }

  update(dt, cam, playerPos) {
    // cars arrive through the morning and early afternoon
    const minute = Clock.minutes();
    const every = minute < 690 ? 3.5 : minute < 900 ? 9 : minute < 1080 ? 18 : Infinity;
    this.nextCar -= dt;
    const driving = this.cars.filter((c) => c.state === 'drive').length;
    if (this.nextCar <= 0 && every < Infinity) {
      this.nextCar = every * (0.6 + this.rand() * 0.8);
      if (driving < 14) this.addCar();
    }
    this.updateCars(dt);
    this.updateWalkers(dt, cam);
    // the player walking through a detector
    const S = SECURITY;
    if (this.lastPlayer && this.lastPlayer.z > S.detectorZ && playerPos.z <= S.detectorZ) {
      const d = this.detectors.find((x) => Math.abs(playerPos.x - x.x) < 1.6);
      if (d) this.flash(d, cam, 'player');
    }
    this.lastPlayer = (this.lastPlayer || new THREE.Vector3()).copy(playerPos);
    for (const d of this.detectors) {
      d.flash = Math.max(0, d.flash - dt);
      d.lamp.material.color.setHex(d.flash > 0 ? 0x30ff60 : 0xffb020);
    }
    // officers bend over the bags when someone is at their table
    for (const d of this.detectors) {
      const officer = d.officer || (d.officer = this.staff.spotNear('security', TABLE_X(S.lanes[d.lane]) - 2.1, S.tableZ, 'table'));
      if (officer) officer.busy = !!d.table;
    }
    this.draw();
  }

  updateCars(dt) {
    for (const c of this.cars) {
      if (c.state !== 'drive') continue;
      const target = c.pts[c.seg + 1];
      if (!target) {
        c.state = 'parked';
        c.pos.set(c.stall.x, GROUND, c.stall.z);
        c.yaw = 0;
        // out they get
        const n = 1 + Math.floor(this.rand() * 4);
        for (let k = 0; k < n; k++) this.addWalker(c.stall);
        continue;
      }
      const b = c.b || 0; // points before the one at the booth's lane entry
      // pause at the toll booth
      if (!c.boothDone && c.seg === 1 + b && c.pos.z <= BOOTH_Z + 2.5) {
        c.stopped += dt;
        c.speed = 0;
        if (c.stopped < 1.6) continue;
        c.boothDone = true;
      }
      // keep a gap behind the car ahead in the same lane
      let blocked = false;
      if (c.seg >= b && c.seg <= 2 + b) {
        for (const o of this.cars) {
          const ob = o.b || 0;
          if (o === c || o.state !== 'drive' || o.lane !== c.lane || o.seg > 2 + ob || o.seg < ob) continue;
          const ahead = c.pos.z - o.pos.z;
          if (ahead > 0 && ahead < 14) { blocked = true; break; }
        }
      }
      const turning = c.seg >= 3 + b || (b > 0 && c.seg >= 1 && c.seg < b);
      const want = blocked ? 0 : turning ? 6 : 13;
      c.speed += (want - c.speed) * Math.min(1, dt * 2.5);
      const d = this.v.copy(target).sub(c.pos);
      const dist = d.length();
      const step = c.speed * dt;
      if (dist <= step) {
        c.pos.copy(target);
        c.seg++;
      } else {
        c.pos.addScaledVector(d, step / dist);
        const yaw = Math.atan2(-d.x, -d.z);
        let dy = yaw - c.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw += dy * Math.min(1, dt * 4);
      }
    }
  }

  updateWalkers(dt, cam) {
    const S = SECURITY;
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      const d = w.lane;
      let target = null;
      if (w.phase === 'approach') {
        target = w.pts[w.seg];
        if (!target) {
          w.phase = 'line';
          d.queue.push(w);
        }
      }
      if (w.phase === 'line') {
        // the line at the bag check table
        const k = d.queue.indexOf(w);
        target = new THREE.Vector3(d.x - 0.3, PAVERS, S.tableZ + 1 + k * 2.6);
        if (k === 0 && w.pos.distanceTo(target) < 0.3) {
          w.phase = 'table';
          w.wait = 2 + this.rand() * 2.5;
          d.table = w;
        }
      }
      if (w.phase === 'table') {
        w.wait -= dt;
        if (w.wait <= 0) {
          w.phase = 'detector';
          d.queue.shift();
          d.table = null;
        }
      }
      if (w.phase === 'detector') {
        target = new THREE.Vector3(d.x, PAVERS, S.detectorZ - 4);
        if (w.pos.z <= S.detectorZ && !w.beeped) {
          w.beeped = true;
          this.flash(d, cam, 'guest');
        }
        if (w.pos.distanceTo(target) < 0.4) w.phase = 'gate';
      }
      if (w.phase === 'gate') {
        target = new THREE.Vector3(d.x * 0.5, PAVERS, 283);
        if (w.pos.distanceTo(target) < 0.6) {
          this.walkers.splice(i, 1);
          continue;
        }
      }
      let moving = false;
      if (target) {
        const v = this.v.copy(target).sub(w.pos);
        v.y = 0;
        const dist = v.length();
        const step = w.speed * dt;
        if (dist > 0.05) {
          moving = true;
          w.pos.addScaledVector(v, Math.min(1, step / dist));
          w.yaw = yawTo(v.x, v.z);
          w.cycle += Math.min(step, dist) / 5.2;
        }
        if (w.phase === 'approach' && dist < 0.6) w.seg++;
      }
      w.pos.y = w.pos.z < SECURITY.front + 1 && Math.abs(w.pos.x) < 70 ? PAVERS : GROUND;
      if (w.pos.distanceToSquared(cam) > 260 * 260) continue;
      if (moving) this.people.add('walk', w.cycle, w.pos.x, w.pos.y, w.pos.z, w.yaw, w.seed);
      else this.people.add('idle', w.phase === 'table' ? 0 : w.seed % 4 === 1 ? 1 : 0, w.pos.x, w.pos.y, w.pos.z, w.phase === 'table' ? FACE_NORTH : w.yaw, w.seed);
    }
  }

  draw() {
    let n = 0;
    for (const c of this.cars) {
      if (n >= this.carCap) break;
      this.q.setFromAxisAngle(this.up, c.yaw);
      this.m.compose(c.pos, this.q, this.one);
      for (const mesh of this.carMeshes) mesh.setMatrixAt(n, this.m);
      this.bodyMesh.setColorAt(n, this.color.setHex(c.color));
      n++;
    }
    for (const mesh of this.carMeshes) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
  }
}
