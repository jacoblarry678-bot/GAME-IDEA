// Wolverine, the next coaster, is going up beyond Backwoods' west wall: the
// whole circuit is staked out with footings, the supports are up for the
// first half (a launch, an 80-stud top hat and the turn behind it) and the
// yellow track is bolted on most of the way, with a crane lifting the next
// piece into place. The rest of the supports are part-built, track pieces
// wait on the ground, the station is a steel frame on its slab, and claw
// marked banners on the wall tease it from inside the park.
import * as THREE from 'three';
import { makeFinder } from './haunt.js';

export const WV_SITE = { x0: -592, x1: -380, z0: -402, z1: -148 };
const G = 0.1;
const YELLOW = 0xf2c818, BLUE = 0x1e3a8a, STEEL = 0xb8bcc0, BLACK = 0x101012, WHITE = 0xf4f4f0, RED = 0x8a3a22;
// the circuit (x, y, z of the rails), starting at the station
const CIRCUIT = [
  [-400, 4, -176], [-400, 4, -200], [-400, 4, -240], [-401, 5, -285], // station and launch
  [-405, 22, -318], [-414, 62, -338], [-425, 80, -351], [-438, 66, -362], [-452, 26, -373], [-470, 7, -381], // top hat
  [-500, 9, -388], [-532, 16, -386], [-562, 30, -370], [-576, 34, -340], [-570, 28, -310], // overbanked turn
  [-560, 12, -290], [-555, 44, -264], [-550, 14, -238], // camelback
  [-546, 10, -205], [-532, 24, -176], [-502, 28, -162], [-470, 16, -166], // turn and swoop
  [-444, 8, -160], [-420, 4, -157], [-404, 4, -165],
];
const BUILT = 0.47; // how much of the circuit has track on it

function spline(pts) {
  const n = pts.length;
  const V = pts.map((p) => new THREE.Vector3(...p));
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = V[(i - 1 + n) % n], p1 = V[i], p2 = V[(i + 1) % n], p3 = V[(i + 2) % n];
    const steps = Math.max(4, Math.ceil(p1.distanceTo(p2) / 2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push(new THREE.Vector3(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      ));
    }
  }
  return out;
}

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
  return { add, box, sign, cf };
}

// a rotation whose local Z runs along t (and X stays level)
function along(t) {
  const Z = t.clone().normalize();
  const X = new THREE.Vector3(0, 1, 0).cross(Z).normalize();
  if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
  const Y = Z.clone().cross(X);
  return [X.x, Y.x, Z.x, X.y, Y.y, Z.y, X.z, Y.z, Z.z];
}

export function buildWolverine(data) {
  const { add, box, sign, cf } = helpers(data);
  const S = WV_SITE;
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  const crew = (kind, x, y, z, yaw) => data.staffSpots.push({ role: 'construction', kind, land: 'Backwoods', seed: 0, cf: cf(x, y, z, yaw) });

  data.flatZones = [...(data.flatZones || []), { ...S, margin: 34 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], S, 10));
  add([S.x1 - S.x0, 1, S.z1 - S.z0], [(S.x0 + S.x1) / 2, G - 0.5, (S.z0 + S.z1) / 2], 0x7a7064, 'Ground');

  // ---- the circuit: footings everywhere, supports and track on the first part
  const pts = spline(CIRCUIT);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = cum[cum.length - 1];
  const built = L * BUILT;
  let nextSupport = 6;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], s = cum[i];
    if (s < nextSupport) continue;
    nextSupport = s + 13;
    box([3.4, 0.8, 3.4], [p.x, G, p.z], 0xa8a49c, 'Concrete');
    if (p.y < 5) continue;
    const h = p.y - 1.4;
    if (s < built + 20) box([1.6, h, 1.6], [p.x, G + 0.8, p.z], BLUE, 'Metal', { shape: 5 });
    else if (s < L * 0.75) box([1.6, h * (0.25 + 0.5 * ((i * 7) % 5) / 5), 1.6], [p.x, G + 0.8, p.z], BLUE, 'Metal', { shape: 5 });
  }
  // the track itself: yellow rails on a blue spine, bolted on up to here
  const T = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1; i++) {
    if (cum[i] > built) break;
    const a = pts[i], b = pts[i + 1];
    T.subVectors(b, a);
    const len = T.length() + 0.15, rot = along(T);
    const c = a.clone().add(b).multiplyScalar(0.5);
    const X = new THREE.Vector3(rot[0], rot[3], rot[6]);
    add([0.9, 0.9, len], [c.x, c.y - 0.7, c.z], BLUE, 'Metal', { rot, collide: 0 });
    for (const sd of [-1, 1]) add([0.35, 0.35, len], [c.x + X.x * sd * 1.1, c.y, c.z + X.z * sd * 1.1], YELLOW, 'Metal', { rot, collide: 0 });
    if (i % 2 === 0) add([2.6, 0.25, 0.3], [c.x, c.y - 0.4, c.z], YELLOW, 'Metal', { rot, collide: 0 });
  }
  // the next piece, hanging from a crane at the end of the built track
  let endI = 0;
  while (endI < pts.length - 1 && cum[endI] < built) endI++;
  const pe = pts[endI], pn = pts[Math.min(pts.length - 1, endI + 6)];
  T.subVectors(pn, pe);
  const hang = pe.clone().add(pn).multiplyScalar(0.5).add(new THREE.Vector3(0, 6, 0));
  const hrot = along(T);
  add([0.9, 0.9, T.length()], [hang.x, hang.y - 0.7, hang.z], BLUE, 'Metal', { rot: hrot, collide: 0 });
  add([3, 0.35, T.length()], [hang.x, hang.y, hang.z], YELLOW, 'Metal', { rot: hrot, collide: 0 });
  crane(hang.x + 22, hang.z + 18, 92, Math.atan2(hang.x - (hang.x + 22), hang.z - (hang.z + 18)), Math.hypot(22, 18), hang.y + 1.5);
  crew('work', pe.x, pe.y + 0.6, pe.z, 0);
  crew('work', pts[Math.max(0, endI - 8)].x, pts[Math.max(0, endI - 8)].y + 0.6, pts[Math.max(0, endI - 8)].z, Math.PI);

  // ---- track pieces waiting on the ground, and support columns
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 5; k++) {
      const x = -520 + k * 14, z = -232 - r * 9;
      box([1, 0.9, 12], [x, G + 0.6, z], BLUE, 'Metal', { collide: k === 0 ? 1 : 0 });
      for (const sd of [-1.1, 1.1]) box([0.35, 0.35, 12], [x + sd, G + 1.6, z], YELLOW, 'Metal', { collide: 0 });
      for (let j = -1; j <= 1; j++) box([1.6, 0.5, 0.5], [x, G, z + j * 5], 0x6a4a30, 'Wood', { collide: 0 });
    }
  }
  for (let k = 0; k < 8; k++) box([24, 1.6, 1.6], [-470, G + Math.floor(k / 4) * 1.6, -296 + (k % 4) * 1.8], BLUE, 'Metal', { yaw: Math.PI / 2, collide: k < 4 ? 1 : 0 });

  // ---- the station: a slab and a steel frame
  box([22, 1, 50], [-394, G, -190], 0xa8a49c, 'Concrete');
  for (const z of [-212, -196, -180, -166]) for (const x of [-404, -384]) box([1, 14, 1], [x, G + 1, z], RED, 'Metal');
  for (const z of [-212, -196, -180]) add([21, 1, 1], [-394, G + 15, z], RED, 'Metal', { collide: 0 });
  add([1, 1, 46], [-404, G + 15, -189], RED, 'Metal', { collide: 0 });

  // ---- a crawler crane by the camelback, materials, the site office
  crane(-528, -300, 74, 2.2, 30, 40);
  box([24, 9, 9], [S.x0 + 22, G + 1, S.z1 - 14], WHITE, 'SmoothPlastic');
  sign([20, 1.8, 0.2], [S.x0 + 22, G + 8.2, S.z1 - 18.6], WHITE, 'Front', [['BENTON CONSTRUCTION  ·  SITE OFFICE', 0, 0, 1, 1, 0x16223a, 'GothamBold']]);
  sign([10, 1.2, 0.2], [S.x0 + 22, G + 6.2, S.z1 - 18.6], WHITE, 'Front', [['WOLVERINE PROJECT', 0, 0, 1, 1, 0xc8a010, 'GothamBold']]);
  for (let k = 0; k < 3; k++) box([3.6, 7.4, 3.6], [S.x0 + 46 + k * 4.2, G, S.z1 - 10], 0x2a6ae0, 'SmoothPlastic');
  box([20, 8.6, 8], [S.x0 + 18, G, S.z1 - 34], 0x2a5a9a, 'CorrodedMetal');
  // a flatbed with the first car under a cover
  box([18, 1.2, 7], [-450, G + 1.4, -200], 0x2a2a2e, 'Metal');
  box([6, 3, 12], [-450, G + 2.6, -200], 0x3a3e46, 'Fabric', { yaw: Math.PI / 2 });
  sign([8, 2, 0.2], [-450, G + 3.4, -196.4], YELLOW, 'Back', [['DO NOT UNCOVER', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  crew('idle', -440, G, -205, -Math.PI / 2);
  crew('work', -514, G, -240, 0);
  crew('work', -396, G + 1.1, -190, Math.PI / 2);
  // fence round the site, lights
  const fence = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    for (let k = 0; k <= Math.round(len / 10); k++) {
      const t = k / Math.round(len / 10);
      box([0.5, 9, 0.5], [xa + (xb - xa) * t, G, za + (zb - za) * t], STEEL, 'Metal', { shape: 5 });
    }
    add([0.2, 8.6, len], [(xa + xb) / 2, G + 4.4, (za + zb) / 2], 0x8a9096, 'Metal', { yaw, trans: 0.6 });
    add([0.25, 5, len], [(xa + xb) / 2, G + 3, (za + zb) / 2], 0x1e2a5a, 'Fabric', { yaw, collide: 0 });
  };
  fence(S.x0, S.z0, S.x0, S.z1);
  fence(S.x0, S.z0, -377, S.z0);
  fence(S.x0, S.z1, -377, S.z1);
  for (const [x, z] of [[-430, -230], [-520, -330], [-470, -170], [-560, -220]]) {
    box([0.6, 16, 0.6], [x, G, z], 0x5a5e66, 'Metal');
    for (const dx of [-1.2, 1.2]) add([2, 1.4, 0.8], [x + dx, G + 16.4, z], 0xfff6d8, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x, G + 16, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ---- the teaser inside the park: claw-marked banners on the west wall
  for (const [z, title, sub] of [[-222, 'WOLVERINE', 'COMING SOON'], [-188, 'THE CLAWS ARE OUT', 'BENTON DIESEL WORLD']]) {
    sign([0.3, 9, 30], [-373.4, G + 8.6, z], 0x14161c, 'Right', [[title, 0, 0.06, 1, 0.56, YELLOW], [sub, 0, 0.64, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
    for (let k = 0; k < 3; k++) add([0.2, 0.5, 11], [-373.2, G + 8.6 + (k - 1) * 1.6, z + 6 + k * 1.2], 0xe8eef4, 'Neon', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.5), -Math.sin(-0.5), 0, Math.sin(-0.5), Math.cos(-0.5)] });
  }

  // and a teaser board beside the Backwoods walkway, where everyone sees it
  const spot = makeFinder(data)(-252, -200, 9, [[-375, -405, -110, -140]]);
  if (spot) {
    const [bx, bz] = spot;
    for (const dz of [-8, 8]) box([0.8, 16, 0.8], [bx, G, bz + dz], 0x2a2e36, 'Metal', { shape: 5 });
    add([1, 11, 25], [bx, G + 14, bz], 0x2a2e36, 'Metal', { collide: 0 });
    sign([0.3, 10, 24], [bx + 0.7, G + 14, bz], 0x14161c, 'Right', [['WOLVERINE', 0, 0.08, 1, 0.5, YELLOW], ['THE CLAWS ARE OUT', 0, 0.58, 1, 0.2, WHITE, 'GothamBold'], ['COMING SOON  ·  LOOK OVER THE WALL', 0, 0.8, 1, 0.14, 0x9ab8ff, 'GothamBold']], { glow: true });
    sign([0.3, 10, 24], [bx - 0.7, G + 14, bz], 0x14161c, 'Left', [['WOLVERINE', 0, 0.08, 1, 0.5, YELLOW], ['COMING SOON', 0, 0.62, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
    for (let k = 0; k < 3; k++) add([0.3, 0.5, 10], [bx + 1, G + 16 + (k - 1) * 1.5, bz + 5 + k * 1.1], 0xe8eef4, 'Neon', { collide: 0, rot: [1, 0, 0, 0, Math.cos(-0.5), -Math.sin(-0.5), 0, Math.sin(-0.5), Math.cos(-0.5)] });
  }

  data.staff.lines.construction = [
    ...(data.staff.lines.construction || []),
    'Wolverine is going up!', 'That top hat is eighty studs tall!', 'Watch out, the claws are coming...', 'Hard hats only back here!',
  ];
  return { site: S, gate: spot ? { x: spot[0], z: spot[1] } : { x: -360, z: -205 } };

  // a tower crane: mast, jib, counterweight, and its hook
  function crane(x, z, h, yaw, hookAt, hookY) {
    box([10, 2, 10], [x, G, z], 0xa8a49c, 'Concrete');
    box([3, h, 3], [x, G + 2, z], YELLOW, 'Metal');
    const top = G + 2 + h;
    box([3.6, 3, 3.6], [x, top, z], WHITE, 'SmoothPlastic', { collide: 0 });
    box([1.2, 9, 1.2], [x, top + 3, z], YELLOW, 'Metal', { collide: 0 });
    const ux = Math.sin(yaw), uz = Math.cos(yaw);
    add([2.2, 2.2, 74], [x + ux * 25, top + 4, z + uz * 25], YELLOW, 'Metal', { yaw, collide: 0 });
    add([3, 3.4, 5], [x - ux * 9, top + 3.2, z - uz * 9], 0x8a8a86, 'Concrete', { yaw, collide: 0 });
    add([1, 1, 1], [x, top + 12.6, z], 0xff2020, 'Neon', { collide: 0, shape: 3 });
    const hx = x + ux * hookAt, hz = z + uz * hookAt;
    add([0.15, top + 3 - hookY, 0.15], [hx, (top + 3 + hookY) / 2, hz], 0x2a2a2e, 'Metal', { collide: 0 });
    add([1.2, 1.6, 1.2], [hx, hookY + 0.8, hz], YELLOW, 'Metal', { collide: 0 });
  }
}

// a toast and some construction noise near the wall
export class WolverineSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
    this.next = 2;
  }

  update(dt, pos, started) {
    if (!started) return;
    const near = Math.hypot(pos.x - this.layout.gate.x, pos.z - this.layout.gate.z) < 50;
    if (near && !this.told) {
      this.told = true;
      this.hooks.toast('Construction has started on WOLVERINE, the next coaster! Look over the wall: the top hat is already up.', 'info');
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 1 + Math.random() * 3;
      if (near) this.hooks.sound('clank');
    }
  }
}
