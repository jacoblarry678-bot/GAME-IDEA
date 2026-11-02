/**
 * Ambient life on the water and in the sky — purely decorative, no collision and no
 * effect on the game: speedboats and a yacht crossing Biscayne Bay, a jet ski off the
 * beach, sailboats and a cruise ship out on the Atlantic, a banner plane towing an ad
 * along the shore, and gulls wheeling over the sand. Boats bob and pitch, leave foam
 * wakes, and the cruise ship lights up at night.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISLAND, WATER_Y, CAUSEWAY } from './layout.js';
import { signTexture } from './textures.js';
import { mulberry32 } from './district.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------
// models

/** A planing hull: pointed bow, V bottom, rising sheer, a deck over the top. Bow is +z. */
function hullGeometry(L, W, H) {
  const ring = (t) => {
    const b = (W / 2) * (t < 0.55 ? 1 - 0.08 * (0.55 - t) : Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)) * 0.98 + 0.02);
    const sheer = H * (1 + 0.28 * t * t), keel = -H * 0.45 * (1 - t ** 4) + H * 0.35 * t ** 4, chine = keel * 0.35 + 0.1 * H;
    return [[b, sheer], [b * 0.92, chine], [0, keel], [-b * 0.92, chine], [-b, sheer], [0, sheer + 0.03 * W], [b, sheer]];
  };
  const N = 20, pos = [], idx = [];
  let row = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * L, r = ring(t);
    row = r.length;
    for (const [x, y] of r) pos.push(x, y, z);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < row - 1; k++) {
    const a = i * row + k, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // transom: close the stern
  const s = ring(0), c = pos.length / 3;
  pos.push(0, H * 0.4, -L / 2);
  for (let k = 0; k < s.length - 1; k++) idx.push(c, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const mats = {
  hull: new THREE.MeshPhysicalMaterial({ color: 0xf4f4f0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
  navy: new THREE.MeshPhysicalMaterial({ color: 0x1d3557, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
  teak: new THREE.MeshStandardMaterial({ color: 0xa27a52, roughness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0b1620, roughness: 0.05, metalness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.25, metalness: 0.9 }),
  sail: new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.8, side: THREE.DoubleSide }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf28c28, roughness: 0.6 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true;
  return m;
}

function wakeTexture() {
  const W = 128, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), r = mulberry32(7);
  // two foam arms spreading back from the stern, broken up with streaks
  for (let i = 0; i < 2600; i++) {
    const t = r(), side = r() < 0.5 ? -1 : 1, spread = 0.12 + t * 0.38;
    const px = W / 2 + side * spread * W * (0.75 + r() * 0.3) * (r() < 0.25 ? r() : 1);
    const py = t * H, a = (1 - t) ** 1.4 * 0.55;
    x.fillStyle = `rgba(255,255,255,${a})`;
    x.fillRect(px, py, 1 + r() * 3, 2 + r() * 6);
  }
  const g = x.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(W * 0.3, 0, W * 0.4, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let WAKE = null;
function wake(len, width) {
  WAKE = WAKE || new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false, opacity: 0.85, side: THREE.DoubleSide });
  const g = new THREE.PlaneGeometry(width, len);
  g.rotateX(Math.PI / 2); // texture v = 1 (the dense foam) ends up at the stern
  g.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(g, WAKE);
  m.renderOrder = 3;
  return m;
}

function speedboat(color) {
  const g = new THREE.Group();
  const accent = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const hull = mesh(hullGeometry(8.5, 2.6, 0.95), mats.hull);
  const stripe = mesh(hullGeometry(8.6, 2.64, 0.5), accent, 0, 0.02, 0);
  stripe.scale.set(1, 0.6, 1);
  g.add(stripe, hull);
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 4.2), mats.teak, 0, 1.0, -0.9));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), mats.hull, 0.2, 1.3, 0.6));
  const ws = mesh(new THREE.BoxGeometry(1.5, 0.45, 0.05), mats.glass, 0.1, 1.8, 1.05);
  ws.rotation.x = -0.5;
  g.add(ws);
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), mats.hull, 0, 1.2, -2.6));
  g.add(mesh(new THREE.BoxGeometry(0.55, 1.1, 0.6), mats.dark, 0, 0.9, -4.45));
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.9, 0.12), mats.dark, 0, 0.1, -4.6));
  return { group: g, wake: wake(26, 9), stern: -4.3, len: 8.5 };
}

function jetski() {
  const g = new THREE.Group();
  g.add(mesh(hullGeometry(3.2, 1.2, 0.5), mats.hull));
  const top = mesh(hullGeometry(2.4, 1.0, 0.35), new THREE.MeshPhysicalMaterial({ color: 0xffd23f, roughness: 0.3, clearcoat: 1 }), 0, 0.25, 0.2);
  g.add(top);
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.25, 1.3), mats.dark, 0, 0.75, -0.3));
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), mats.dark, 0, 1.05, 0.55));
  // the rider
  const skin = new THREE.MeshStandardMaterial({ color: 0x9a6a4a, roughness: 0.7 });
  g.add(mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.6 }), 0, 1.25, -0.2));
  g.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), skin, 0, 1.75, -0.12));
  return { group: g, wake: wake(14, 5), stern: -1.5, len: 3.2 };
}

function yacht() {
  const g = new THREE.Group();
  g.add(mesh(hullGeometry(24, 6, 2.4), mats.hull));
  const band = mesh(hullGeometry(24.2, 6.05, 1.2), mats.navy, 0, -0.1, 0);
  band.scale.set(1, 0.5, 1);
  g.add(band);
  g.add(mesh(new THREE.BoxGeometry(4.6, 0.08, 18), mats.teak, 0, 2.5, -1));
  g.add(mesh(new THREE.BoxGeometry(4.4, 2.0, 11), mats.hull, 0, 3.5, -1.5));
  g.add(mesh(new THREE.BoxGeometry(4.5, 0.8, 10.6), mats.glass, 0, 3.6, -1.4));
  g.add(mesh(new THREE.BoxGeometry(3.8, 1.6, 6.5), mats.hull, 0, 5.2, -0.5));
  g.add(mesh(new THREE.BoxGeometry(3.9, 0.6, 6), mats.glass, 0, 5.3, -0.3));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.25, 4), mats.hull, 0, 6.15, -1));
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), mats.steel, 0, 7.2, -1));
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.1, 0.3), mats.steel, 0, 8.2, -1));
  return { group: g, wake: wake(60, 18), stern: -12, len: 24 };
}

function sailboat() {
  const g = new THREE.Group();
  g.add(mesh(hullGeometry(10, 3.2, 1.1), mats.hull));
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.6, 3.6), mats.hull, 0, 1.5, -0.6));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 14, 6), mats.steel, 0, 8.2, 0.6));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 6).rotateX(Math.PI / 2), mats.steel, 0, 2.6, -1.7));
  const tri = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); return new THREE.ShapeGeometry(s); };
  const main = mesh(tri([[0, 0], [4.4, 0], [0, 12.4]]).rotateY(Math.PI / 2), mats.sail, 0, 2.7, 0.55);
  const jib = mesh(tri([[0, 0], [-4.2, 0], [0, 11]]).rotateY(Math.PI / 2), mats.sail, 0, 1.4, 0.7);
  main.rotation.y = 0.25; jib.rotation.y = 0.2;
  g.add(main, jib);
  return { group: g, wake: wake(18, 5), stern: -5, len: 10 };
}

function cruiseShip() {
  const g = new THREE.Group();
  const L = 270, W = 36;
  // windows and balconies, lit at night
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const e = document.createElement('canvas');
  e.width = 512; e.height = 256;
  const ex = e.getContext('2d');
  x.fillStyle = '#f6f6f2'; x.fillRect(0, 0, 512, 256);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, 512, 256);
  const r = mulberry32(11);
  for (let row = 0; row < 8; row++) {
    const y = 10 + row * 31;
    x.fillStyle = '#28323c'; x.fillRect(0, y, 512, 16);
    for (let i = 0; i < 64; i++) {
      x.fillStyle = '#e8ecef'; x.fillRect(i * 8, y, 1, 16);
      if (r() < 0.55) { ex.fillStyle = `rgba(255,${200 + r() * 40 | 0},${130 + r() * 60 | 0},1)`; ex.fillRect(i * 8 + 1, y + 2, 6, 12); }
    }
    x.fillStyle = '#c9d2d9'; x.fillRect(0, y + 17, 512, 3);
  }
  const map = new THREE.CanvasTexture(c), emap = new THREE.CanvasTexture(e);
  for (const t of [map, emap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(4, 0.32); }
  const decks = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 });
  const hull = mesh(hullGeometry(L, W, 14), new THREE.MeshStandardMaterial({ color: 0x1b2a49, roughness: 0.45 }));
  g.add(hull);
  g.add(mesh(new THREE.BoxGeometry(W * 0.98, 4, L * 0.82), mats.hull, 0, 15.5, -10));
  for (let k = 0; k < 4; k++) {
    const w = W * (0.92 - k * 0.06), len = L * (0.74 - k * 0.07);
    g.add(mesh(new THREE.BoxGeometry(w, 7.5, len), decks, 0, 21 + k * 7.5, -14 + k * 3));
  }
  g.add(mesh(new THREE.BoxGeometry(W * 0.6, 4, 30), mats.glass, 0, 50.7, 52));
  // lifeboats along both sides
  for (const s of [-1, 1]) for (let i = 0; i < 10; i++) g.add(mesh(new THREE.CapsuleGeometry(1.4, 6, 4, 8).rotateX(Math.PI / 2), mats.orange, s * (W / 2 + 0.6), 17, -80 + i * 15));
  // a funnel in a fictional line's colours
  const funnel = mesh(new THREE.CylinderGeometry(4.5, 6, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0f7c8c, roughness: 0.4 }), 0, 56.5, -70);
  funnel.scale.set(1, 1, 1.8);
  g.add(funnel);
  g.add(mesh(new THREE.CylinderGeometry(4.6, 4.6, 3, 16), new THREE.MeshStandardMaterial({ color: 0xf4b942, roughness: 0.4 }), 0, 60.5, -70));
  g.children.forEach((m) => { m.castShadow = false; });
  return { group: g, wake: wake(260, 80), stern: -L / 2, len: L, decks };
}

function bannerPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc1121f, roughness: 0.5 });
  const fus = new THREE.LatheGeometry([[0, -4], [0.45, -3.6], [0.65, -1.5], [0.7, 0.5], [0.55, 2.4], [0.2, 3.4], [0, 3.5]].map(([r, y]) => new THREE.Vector2(r, y)), 14).rotateX(Math.PI / 2);
  g.add(mesh(fus, white));
  g.add(mesh(new THREE.BoxGeometry(11, 0.12, 1.5), white, 0, 0.75, 0.5));
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.1, 1), white, 0, 0.2, -3.4));
  g.add(mesh(new THREE.BoxGeometry(0.1, 1.6, 1.2), red, 0, 0.9, -3.4));
  g.add(mesh(new THREE.BoxGeometry(11.05, 0.13, 0.25), red, 0, 0.76, 0.0));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), mats.glass, 0, 0.55, 1.4));
  const prop = mesh(new THREE.BoxGeometry(2, 0.12, 0.05), mats.dark, 0, 0, 3.55);
  g.add(prop);
  return { group: g, prop };
}

const BANNERS = [
  'VELVET PALMS · LADIES NIGHT THURSDAYS',
  'TIDEWATER DINER · OPEN 24/7 · BEST CUBANO ON THE BEACH',
  'SUNNY STOP · 2 CAFECITOS $3',
  'DANI, WILL YOU MARRY ME? ♥ M',
  'SUNRAY GAS · COLD DRINKS · ICE · BAIT',
];

function banner(text) {
  const tex = signTexture(text, { fg: '#c1121f', bg: '#fbfbf7', font: '900 80px Arial, sans-serif' });
  const len = 6 * tex.userData.aspect, h = 6;
  const geo = new THREE.PlaneGeometry(len, h, 24, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  m.userData.base = geo.attributes.position.array.slice();
  m.userData.len = len;
  return m;
}

/** A gull: slender wings with the bent "M" profile (inner wing up, outer wing drooping); flapping is a scale on y. */
function gullGeometry() {
  const P = [];
  for (const s of [-1, 1]) {
    // inner wing: root to wrist
    P.push(0, 0, 0.1, s * 0.3, 0.07, 0.02, 0, 0, -0.08);
    P.push(s * 0.3, 0.07, 0.02, s * 0.3, 0.07, -0.08, 0, 0, -0.08);
    // outer wing: wrist to a swept, drooping tip
    P.push(s * 0.3, 0.07, 0.02, s * 0.66, -0.02, -0.16, s * 0.3, 0.07, -0.08);
  }
  // body and tail
  P.push(0, -0.01, 0.24, -0.04, -0.02, -0.18, 0.04, -0.02, -0.18);
  P.push(-0.07, -0.01, -0.3, 0.07, -0.01, -0.3, 0, -0.01, -0.12);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------

/** A looped route on the water: waypoints, speed (m/s), and how long to idle at the end. */
class Mover {
  constructor(model, pts, speed, { bob = 0.08, pitch = 0.03, lift = 0, loop = true } = {}) {
    this.m = model; this.pts = pts.map(([x, z]) => V(x, WATER_Y, z)); this.speed = speed;
    this.bob = bob; this.pitch = pitch; this.lift = lift; this.loop = loop;
    this.i = 0; this.t = 0; this.yaw = null; this.time = Math.random() * 100;
    this.pos = this.pts[0].clone();
    this.m.group.add(this.m.wake);
    this.m.wake.position.set(0, 0.05, this.m.stern);
  }
  update(dt) {
    this.time += dt;
    let a = this.pts[this.i], b = this.pts[(this.i + 1) % this.pts.length];
    const seg = a.distanceTo(b);
    this.t += (this.speed * dt) / Math.max(1, seg);
    if (this.t >= 1) { this.t = 0; this.i = (this.i + 1) % this.pts.length; a = this.pts[this.i]; b = this.pts[(this.i + 1) % this.pts.length]; }
    this.pos.lerpVectors(a, b, this.t);
    const want = Math.atan2(b.x - a.x, b.z - a.z);
    if (this.yaw === null) this.yaw = want;
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 0.6);
    const g = this.m.group;
    g.position.set(this.pos.x, WATER_Y + Math.sin(this.time * 1.3) * this.bob + this.lift, this.pos.z);
    g.rotation.set(-this.pitch - Math.sin(this.time * 1.1) * this.pitch * 0.5, this.yaw, Math.sin(this.time * 0.9) * this.pitch * 0.8 + d * 0.15, 'YXZ');
    // the wake lies flat on the water whatever the hull is doing
    this.m.wake.rotation.set(this.pitch, 0, 0);
    this.m.wake.position.y = WATER_Y - g.position.y + 0.06;
  }
}

export class Ambient {
  constructor(engine) {
    this.engine = engine;
    this.group = new THREE.Group();
    this.group.name = 'ambient';
    engine.scene.add(this.group);
    const bayW = ISLAND.west - 25, bayE = CAUSEWAY.xEnd + 30; // bay between the island and the mainland
    const add = (model, pts, speed, opts) => { const mv = new Mover(model, pts, speed, opts); this.group.add(model.group); return mv; };
    this.movers = [
      // Biscayne Bay: speedboats on loops either side of the causeway, a yacht cruising slowly
      add(speedboat(0x1d6fa8), [[bayW, -60], [bayE + 40, -150], [bayE + 20, -250], [bayW - 20, -200]], 14, { pitch: 0.07 }),
      add(speedboat(0xe63946), [[bayE + 30, 60], [bayW, 140], [bayW - 30, 250], [bayE + 60, 200]], 12, { pitch: 0.06 }),
      add(yacht(), [[bayE + 50, -40], [bayE + 50, -270], [bayW - 40, -270], [bayW - 40, -40]], 4.5, { pitch: 0.01, bob: 0.05 }),
      // off the beach: a jet ski zig-zagging behind the surf line
      add(jetski(), [[262, -200], [300, -120], [258, -40], [305, 40], [265, 120], [300, 200], [270, 260], [320, -260]], 15, { pitch: 0.08, bob: 0.12 }),
      // further out: sailboats and a speedboat run
      add(sailboat(), [[420, -600], [460, 500], [380, 520], [340, -560]], 5, { pitch: 0.04, bob: 0.1 }),
      add(sailboat(), [[520, 400], [560, -500], [480, -520], [470, 380]], 4.5, { pitch: 0.04, bob: 0.1 }),
      add(speedboat(0xf2f2f2), [[360, 700], [380, -700], [420, -720], [400, 720]], 18, { pitch: 0.08 }),
    ];
    // a cruise ship heading out to sea and back, slow and huge, about 500 m off the beach
    this.ship = cruiseShip();
    this.movers.push(add(this.ship, [[720, -1100], [700, 1100]], 6, { bob: 0, pitch: 0, lift: 0 }));
    for (const mv of this.movers) mv.t = Math.random(), mv.i = Math.floor(Math.random() * mv.pts.length);

    // the banner plane: north along the shoreline, south further out, at about 90 m
    const pl = bannerPlane();
    this.plane = { ...pl, s: 0, text: 0, r: 0 };
    this.banner = banner(BANNERS[0]);
    this.rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, -0.3, -4), V(0, -3.5, -16)]), new THREE.LineBasicMaterial({ color: 0x444444 }));
    pl.group.add(this.rope);
    this.group.add(pl.group, this.banner);

    // gulls
    this.gullCount = 18;
    // seen from below against the sky a gull is pale, not a silhouette: a little self-light keeps it white
    this.gulls = new THREE.InstancedMesh(gullGeometry(), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, emissive: 0x9a9a98, roughness: 0.9, side: THREE.DoubleSide }), this.gullCount);
    this.gulls.frustumCulled = false;
    this.gullData = Array.from({ length: this.gullCount }, (_, i) => ({ r: 8 + Math.random() * 22, h: 8 + Math.random() * 10, w: (0.25 + Math.random() * 0.25) * (i % 2 ? 1 : -1), p: Math.random() * 6.28, f: 4 + Math.random() * 3 }));
    this.gullCentre = V(200, 0, 0);
    this.group.add(this.gulls);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3();
  }

  update(dt) {
    if (!(dt > 0)) return;
    const time = this.engine.time, hour = time.hour, night = time.night;
    const day = hour > 7 && hour < 19.5;
    for (const mv of this.movers) {
      const isShip = mv.m === this.ship;
      mv.m.group.visible = isShip || day;
      if (mv.m.group.visible) mv.update(dt);
    }
    this.ship.decks.emissiveIntensity = 0.1 + night * 1.6;

    // banner plane on an oval: north along x≈235, a wide turn, south along x≈420
    const P = this.plane, show = hour > 8.5 && hour < 18.5;
    P.group.visible = this.banner.visible = show;
    if (show) {
      const legLen = 1500, turnR = 92, perim = 2 * legLen + 2 * Math.PI * turnR, cx = 328;
      P.s = (P.s + dt * 38) % perim;
      let x, z, yaw, s = P.s;
      if (s < legLen) { x = cx - turnR; z = 750 - s; yaw = Math.PI; }
      else if ((s -= legLen) < Math.PI * turnR) { const a = s / turnR; x = cx - turnR * Math.cos(a); z = -750 - turnR * Math.sin(a); yaw = Math.PI - a; }
      else if ((s -= Math.PI * turnR) < legLen) { x = cx + turnR; z = -750 + s; yaw = 0; }
      else { s -= legLen; const a = s / turnR; x = cx + turnR * Math.cos(a); z = 750 + turnR * Math.sin(a); yaw = -a; }
      // a new banner each lap
      if (P.s < P.last) { P.text = (P.text + 1) % BANNERS.length; const b = banner(BANNERS[P.text]); this.group.remove(this.banner); this.banner.geometry.dispose(); this.banner = b; this.group.add(b); }
      P.last = P.s;
      const bank = (P.s > legLen && P.s < legLen + Math.PI * turnR) || P.s > 2 * legLen + Math.PI * turnR ? 0.35 : 0;
      P.group.position.set(x, 92 + Math.sin(P.s * 0.01) * 2, z);
      P.group.rotation.set(0, yaw, bank, 'YXZ');
      P.prop.rotation.z += dt * 40;
      // the banner trails behind, fluttering
      const b = this.banner, base = b.userData.base, pos = b.geometry.attributes.position, len = b.userData.len;
      const t = performance.now() / 1000;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], u = (bx + len / 2) / len; // 0 at the leading edge
        pos.setXYZ(i, bx, by, Math.sin(t * 7 + u * 9) * 0.5 * u);
      }
      pos.needsUpdate = true;
      b.position.copy(P.group.position).add(V(-Math.sin(yaw) * (16 + len / 2), -3.5, -Math.cos(yaw) * (16 + len / 2)));
      b.rotation.set(0, yaw + Math.PI / 2, 0);
    }

    // gulls wheel over the beach near the camera (and stay home at night)
    const cam = this.engine.camera.position;
    this.gulls.visible = night < 0.6;
    if (this.gulls.visible) {
      const tx = Math.min(250, Math.max(ISLAND.sandStart + 8, cam.x + 20)), tz = Math.min(ISLAND.south, Math.max(ISLAND.north, cam.z + 25));
      this.gullCentre.x += (tx - this.gullCentre.x) * Math.min(1, dt * 0.05);
      this.gullCentre.z += (tz - this.gullCentre.z) * Math.min(1, dt * 0.05);
      const t = performance.now() / 1000;
      this.gullData.forEach((d, i) => {
        const a = d.p + t * d.w;
        const x = this.gullCentre.x + Math.cos(a) * d.r, z = this.gullCentre.z + Math.sin(a) * d.r, y = d.h + Math.sin(t * 0.7 + i) * 1.5;
        this._e.set(Math.sin(t + i) * 0.2, -a + (d.w > 0 ? 0 : Math.PI), (d.w > 0 ? -1 : 1) * 0.35, 'YXZ');
        this._q.setFromEuler(this._e);
        const flap = Math.sin(t * d.f + i * 1.7);
        this._m.compose(this._s.set(x, y, z), this._q, V(1.6, 1.6 * Math.max(-0.4, flap) * 1.6, 1.6));
        this.gulls.setMatrixAt(i, this._m);
      });
      this.gulls.instanceMatrix.needsUpdate = true;
    }
  }
}
