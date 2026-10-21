/**
 * Creature and character models, built from primitives and animated
 * procedurally (gait from travelled distance, state-driven poses).
 * Silhouettes are distinct by design: thin cable limbs (Listener), flat
 * display body (Cutout), low water wake (Drowned Shape), curtain rectangle
 * (Tenant), heavy tool frame (Caretaker), empty human indentation (Unseen).
 */
import * as THREE from 'three';
import { mat } from './materials.js';
import { HIDDEN_LAYER } from './levelView.js';

function limb(len, r, m, r2) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r2 ?? r * 0.8, r, len, 6);
  geo.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  g.add(mesh);
  g.userData.len = len;
  return g;
}
function joint(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/** Thin jointed silhouette with a ribbed cable-bundle head. */
function buildListener() {
  const M = mat('creature');
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.15, 0);
  const torso = limb(0.75, 0.07, M, 0.09); torso.rotation.x = Math.PI; hips.add(torso);
  const chest = joint(hips, 0, 0.75, 0);
  const neck = limb(0.32, 0.03, M); neck.rotation.x = Math.PI; chest.add(neck);
  const head = joint(chest, 0, 0.32, 0.03);
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075 - i * 0.004, 0.022, 5, 10), M);
    ring.rotation.x = Math.PI / 2 + 0.25; ring.position.set(0, i * 0.035, 0.02 + i * 0.01);
    head.add(ring);
  }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = joint(chest, s * 0.17, -0.04, 0);
    const up = limb(0.5, 0.03, M); sh.add(up);
    const el = joint(up, 0, -0.5, 0);
    const lo = limb(0.55, 0.025, M, 0.015); el.add(lo);
    const hand = joint(lo, 0, -0.55, 0);
    for (let f = 0; f < 3; f++) { const fi = limb(0.2, 0.008, M, 0.004); fi.rotation.z = (f - 1) * 0.25; hand.add(fi); }
    arms.push({ sh, el });
    const hp = joint(hips, s * 0.09, 0, 0);
    const th = limb(0.58, 0.04, M, 0.03); hp.add(th);
    const kn = joint(th, 0, -0.58, 0);
    const sn = limb(0.6, 0.03, M, 0.02); kn.add(sn);
    legs.push({ hp, kn });
  }
  root.userData = { hips, chest, head, arms, legs };
  return root;
}

/** Generic crew/NPC figure (capsule body), tinted per character. */
export function buildHuman(color = 0x4a6b8a, accent = 0xd8b04a, opts = {}) {
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin || 0xc8a080, roughness: 0.7 });
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, emissive: accent, emissiveIntensity: opts.hiVis ? 0.25 : 0 });
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.95, 0);
  const torsoG = new THREE.CapsuleGeometry(0.17, 0.42, 4, 8); torsoG.translate(0, 0.3, 0);
  const torso = new THREE.Mesh(torsoG, body); hips.add(torso); torso.castShadow = true;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.25), acc); vest.position.set(0, 0.42, 0); hips.add(vest);
  const head = joint(hips, 0, 0.78, 0);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); hm.position.y = 0.08; head.add(hm); hm.castShadow = true;
  if (opts.hair !== false) { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: opts.hairColor || 0x2a2018, roughness: 0.9 })); hair.position.y = 0.09; head.add(hair); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = joint(hips, s * 0.22, 0.55, 0);
    const up = limb(0.3, 0.055, body, 0.05); sh.add(up);
    const el = joint(up, 0, -0.3, 0);
    const lo = limb(0.28, 0.045, skin, 0.04); el.add(lo);
    arms.push({ sh, el });
    const hp = joint(hips, s * 0.1, 0, 0);
    const th = limb(0.45, 0.075, body, 0.06); hp.add(th);
    const kn = joint(th, 0, -0.45, 0);
    const sn = limb(0.45, 0.06, mat('darkMetal'), 0.05); kn.add(sn);
    legs.push({ hp, kn });
  }
  root.userData = { hips, head, arms, legs, human: true };
  return root;
}

/** Flat display figure: printed smiling front, blank back, hands folded over impossible creases. */
let _cutTex = null;
function cutoutTextures() {
  if (_cutTex) return _cutTex;
  const W = 256, H = 768;
  const outline = (ctx) => {
    ctx.beginPath();
    ctx.arc(W / 2, 92, 62, 0, Math.PI * 2);
    ctx.moveTo(W / 2 - 92, 190); ctx.lineTo(W / 2 + 92, 190); ctx.lineTo(W / 2 + 104, 470); ctx.lineTo(W / 2 + 70, 480);
    ctx.lineTo(W / 2 + 64, 760); ctx.lineTo(W / 2 + 8, 760); ctx.lineTo(W / 2, 500); ctx.lineTo(W / 2 - 8, 760); ctx.lineTo(W / 2 - 64, 760); ctx.lineTo(W / 2 - 70, 480); ctx.lineTo(W / 2 - 104, 470); ctx.closePath();
  };
  const mk = (front) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    outline(c); c.save(); c.clip();
    if (front) {
      c.fillStyle = '#d9b9a0'; c.fillRect(0, 0, W, 190);
      c.fillStyle = '#6a8ab0'; c.fillRect(0, 160, W, 340);
      c.fillStyle = '#3a3a48'; c.fillRect(0, 480, W, 300);
      // printed face: too-wide smile, painted eyes
      c.fillStyle = '#1a1410'; c.beginPath(); c.arc(W / 2 - 22, 82, 7, 0, 7); c.arc(W / 2 + 22, 82, 7, 0, 7); c.fill();
      c.strokeStyle = '#7a2020'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, 98, 38, 0.15, Math.PI - 0.15); c.stroke();
      c.fillStyle = '#4a2a1a'; c.fillRect(W / 2 - 62, 26, 124, 26);
      // folded hands with a crease that does not fold anything
      c.fillStyle = '#d9b9a0'; c.fillRect(W / 2 - 46, 330, 92, 40);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2 - 60, 300); c.lineTo(W / 2 + 70, 390); c.moveTo(W / 2 + 40, 170); c.lineTo(W / 2 - 30, 520); c.stroke();
    } else { c.fillStyle = '#c9c4b8'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < H; y += 40) c.fillRect(0, y, W, 2); }
    c.restore();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  _cutTex = { front: mk(true), back: mk(false) };
  return _cutTex;
}
function buildCutout() {
  const T = cutoutTextures();
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const geo = new THREE.PlaneGeometry(0.62, 1.86); geo.translate(0, 0.93, 0);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.front, alphaTest: 0.5, roughness: 0.6, side: THREE.FrontSide }));
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.back, alphaTest: 0.5, roughness: 0.8 }));
  back.rotation.y = Math.PI;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 1).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9 }));
  front.castShadow = back.castShadow = true;
  body.add(front, back, edge);
  root.userData = { custom: animateCutout, front, back, edge, body };
  return root;
}
function animateCutout(o, c) {
  const u = o.userData;
  const t = 0.012 + (c.awake || 0) * 0.22;
  u.front.position.z = t / 2; u.back.position.z = -t / 2;
  u.edge.scale.z = t * 0.85; u.edge.visible = t > 0.03;
  u.body.rotation.x = 0;
  u.body.rotation.z = c.moving ? Math.sin(c.game.time * 9) * 0.03 : 0;
}

/** The Drowned Shape has no surface body: a wake of rings and droplets that hang in the air a moment after it passes. */
function buildDrowned() {
  const root = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.35, depthWrite: false });
  const rings = [];
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 24), ringMat.clone()); r.rotation.x = -Math.PI / 2; root.add(r); rings.push(r); }
  const vee = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ color: 0xdff0f4, transparent: true, opacity: 0.18, depthWrite: false }));
  vee.rotation.x = -Math.PI / 2; vee.position.z = 0.6; root.add(vee);
  const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.05, transparent: true, opacity: 0.8 }));
  root.add(drops);
  root.userData = { custom: animateDrowned, rings, vee, drops, t: 0, trail: [] };
  return root;
}
function animateDrowned(o, c, dt, game) {
  const u = o.userData;
  const L = game.level;
  const w = L.waterAt(c.x, c.z);
  const surf = (w ? (w.y || 0) + w.depth : 0.2) + 0.01;
  o.position.y = surf;
  u.t += dt;
  const show = !c.inDrain && (c.moving || c.state === 'warn' || c.state === 'pursue') ? 1 : 0.25;
  u.rings.forEach((r, i) => { const k = ((u.t * 0.8 + i / 4) % 1); r.scale.setScalar(0.5 + k * 2.2); r.material.opacity = (1 - k) * 0.4 * show; });
  u.vee.material.opacity = c.moving ? 0.22 : 0;
  o.visible = !c.inDrain;
  // droplets hang in place for a moment after it passes
  if (c.moving && Math.random() < dt * 20) u.trail.push({ x: c.x + (Math.random() - 0.5) * 0.6, y: surf + 0.1 + Math.random() * 0.3, z: c.z + (Math.random() - 0.5) * 0.6, t: 0 });
  u.trail = u.trail.filter((d) => (d.t += dt) < 1.4).slice(-30);
  const arr = u.drops.geometry.attributes.position.array;
  arr.fill(0);
  u.trail.forEach((d, i) => { arr[i * 3] = d.x - c.x; arr[i * 3 + 1] = d.y - surf + (d.t > 0.8 ? -(d.t - 0.8) * 0.8 : 0); arr[i * 3 + 2] = d.z - c.z; });
  u.drops.geometry.attributes.position.needsUpdate = true;
  u.drops.rotation.y = -c.yaw; u.drops.rotation.y = 0;
  o.rotation.y = 0; u.vee.rotation.z = c.yaw;
}
/** Seen only in photographs: a body folded beneath the water. */
export function drownedPhotoBody(x, z) {
  const M = new THREE.MeshStandardMaterial({ color: 0xbfc8c4, roughness: 0.6, emissive: 0x404848 });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), M); torso.rotation.z = Math.PI / 2; torso.position.y = 0.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M); head.position.set(0.55, 0.18, 0.1); g.add(head);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.7, 4, 6), M); legs.position.set(-0.2, 0.1, 0.32); legs.rotation.set(0, 0.4, Math.PI / 2); g.add(legs);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 6), M); arm.position.set(0.25, 0.22, -0.25); arm.rotation.set(0, -0.8, Math.PI / 2); g.add(arm);
  g.position.set(x, 0, z);
  return g;
}

/** The Tenant: a figure behind layered curtains; its face is a flat, warmly lit window. */
let _tenantFace = null;
function buildTenant() {
  if (!_tenantFace) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a2416'; c.fillRect(0, 0, 128, 160);
    c.fillStyle = '#ffcf8a'; c.fillRect(10, 10, 108, 140);
    c.fillStyle = '#c87a3a'; c.fillRect(10, 10, 108, 8); c.fillRect(60, 10, 8, 140); c.fillRect(10, 76, 108, 8);
    c.fillStyle = 'rgba(120,60,20,0.5)'; c.fillRect(14, 20, 40, 50);
    _tenantFace = new THREE.CanvasTexture(cv); _tenantFace.colorSpace = THREE.SRGBColorSpace;
  }
  const root = new THREE.Group();
  const body = buildHuman(0x3a2a22, 0x3a2a22, { hair: false, skin: 0x2a1c14 });
  body.scale.set(1.0, 1.12, 1.0);
  root.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), new THREE.MeshStandardMaterial({ map: _tenantFace, emissive: 0xffb060, emissiveIntensity: 0.7, emissiveMap: _tenantFace }));
  face.position.set(0, 1.98, 0.14);
  root.add(face);
  const curtains = [];
  for (let i = 0; i < 4; i++) {
    const cu = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.1), new THREE.MeshStandardMaterial({ color: 0xd8c098, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 1 }));
    cu.position.set((i - 1.5) * 0.12, 1.05, 0.25 + i * 0.05);
    root.add(cu); curtains.push(cu);
  }
  root.userData = { ...body.userData, curtains, tenant: true };
  const base = body.userData;
  root.userData.custom = (o, c, dt, game, moved) => {
    // reuse the human gait on the inner body
    animHuman(base, c, dt, moved, game);
    curtains.forEach((cu, i) => { cu.rotation.y = Math.sin(game.time * 1.3 + i) * 0.12; cu.position.x = (i - 1.5) * 0.12 + Math.sin(game.time * 0.9 + i * 2) * 0.03; });
  };
  return root;
}
function animHuman(u, c, dt, moved, game) {
  u.phase = (u.phase || 0) + moved * 2.6;
  const sw = Math.min(1, moved / Math.max(dt, 1e-4) / 2.5);
  if (u.legs) u.legs.forEach((L, i) => { const ph = u.phase + i * Math.PI; L.hp.rotation.x = Math.sin(ph) * 0.5 * sw; L.kn.rotation.x = Math.max(0, -Math.cos(ph)) * 0.8 * sw; });
  if (u.arms) u.arms.forEach((A, i) => { A.sh.rotation.x = -Math.sin(u.phase + i * Math.PI) * 0.35 * sw; A.el.rotation.x = -0.15; });
  void game;
}

/** The Caretaker: tall, wrapped in yellowed insulation, a carrier of hanging tools where the face should be. */
function buildCaretaker() {
  const ins = mat('insulation'), metal = mat('darkMetal'), tool = mat('chrome');
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.25, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.95, 8), ins); torso.position.y = 0.48; torso.castShadow = true; hips.add(torso);
  for (let i = 0; i < 5; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.235 + i * 0.006, 0.025, 4, 10), ins); band.rotation.x = Math.PI / 2; band.position.y = 0.12 + i * 0.18; hips.add(band); }
  const chest = joint(hips, 0, 0.95, 0);
  // the tool carrier: an open frame with spanners and wrenches hanging from it
  const head = joint(chest, 0, 0.12, 0.02);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.26), metal); frame.position.y = 0.2; head.add(frame);
  const hanging = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Group(); t.position.set(-0.17 + i * 0.068, 0.04, 0.14); head.add(t);
    const len = 0.18 + (i % 3) * 0.07;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.025, len, 0.012), tool); shaft.position.y = -len / 2; t.add(shaft);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.014), tool); jaw.position.y = -len; t.add(jaw);
    hanging.push(t);
  }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = joint(chest, s * 0.3, -0.02, 0);
    const up = limb(0.62, 0.075, ins, 0.065); sh.add(up);
    const el = joint(up, 0, -0.62, 0);
    const lo = limb(0.62, 0.06, ins, 0.05); el.add(lo);
    if (s > 0) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), tool); sp.position.y = -0.75; lo.add(sp); }
    arms.push({ sh, el });
    const hp = joint(hips, s * 0.13, 0, 0);
    const th = limb(0.64, 0.09, ins, 0.075); hp.add(th);
    const kn = joint(th, 0, -0.64, 0);
    const sn = limb(0.62, 0.07, ins, 0.06); kn.add(sn);
    legs.push({ hp, kn });
  }
  root.userData = { hips, chest, head, arms, legs, hanging, human: true };
  root.userData.custom = (o, c, dt, game, moved) => {
    const u = o.userData;
    animHuman(u, c, dt, moved * 0.75, game);
    const tap = (game.time * (c.state === 'pursue' || c.state === 'warn' ? 0.85 : 0.29)) % 1;
    u.arms[1].sh.rotation.x = tap < 0.12 ? -1.2 + tap * 6 : -0.5;
    u.arms[1].sh.rotation.z = -0.25;
    u.head.rotation.z = c.state === 'warn' || c.state === 'investigate' || c.state === 'search' ? Math.sin(game.time * 1.7) * 0.3 : 0;
    u.chest.rotation.x = c.state === 'pursue' ? 0.3 : 0.12;
    u.hanging.forEach((t, i) => { t.rotation.z = Math.sin(game.time * 3 + i) * 0.12 * (moved > 0.001 ? 1.6 : 0.4); });
  };
  return root;
}

/** The Unseen: a shadow that does not meet a body, and the faintest disturbance of the air above it. */
function buildUnseen() {
  const root = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.18, 0.02, 0.32); shadow.scale.set(0.8, 1.6, 1);
  root.add(shadow);
  const ghost = buildHuman(0x101014, 0x101014, { hair: false, skin: 0x101014 });
  ghost.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0x0a0a0e, transparent: true, opacity: 0.07, depthWrite: false }); o.castShadow = false; } });
  root.add(ghost);
  root.userData = { ...ghost.userData, shadow, ghost };
  const base = ghost.userData;
  root.userData.custom = (o, c, dt, game, moved) => {
    animHuman(base, c, dt, moved, game);
    const k = c.state === 'pursue' || c.state === 'warn' ? 0.13 : 0.06;
    ghost.traverse((m) => { if (m.isMesh) m.material.opacity = k + Math.sin(game.time * 7 + m.id) * 0.02; });
    shadow.material.opacity = 0.45 + Math.sin(game.time * 1.3) * 0.08;
  };
  return root;
}
/** On film the Unseen is an almost correct Evan with no eyes. */
export function unseenPhotoBody(cr) {
  const g = buildHuman(0x4a6b8a, 0xd8b04a, { hairColor: 0x2a2018, skin: 0xc8a080 });
  const hollow = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), hollow); e.position.set(sx * 0.045, 0.1, -0.105); g.userData.head.add(e); }
  g.position.set(cr.x, 0, cr.z); g.rotation.y = cr.yaw;
  return g;
}

const BUILDERS = { listener: buildListener, cutout: buildCutout, drowned: buildDrowned, tenant: buildTenant, caretaker: buildCaretaker, unseen: buildUnseen };
export function registerCreatureModel(type, fn) { BUILDERS[type] = fn; }

const NPC_LOOK = {
  june: { color: 0x6a5a7a, accent: 0x8a7a9a, hair: 0x9a9a98, skin: 0xc8a080 },
  lena: { color: 0x4a6a5a, accent: 0xd8b04a, hair: 0x2a1a12, skin: 0xb88a68 },
  copy: { color: 0x4a6b8a, accent: 0xd8b04a, hair: 0x2a2018, skin: 0xc8a080 },
};

export class CreatureView {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    engine.scene.add(this.root);
    this.models = new Map();
  }

  sync(game, dt) {
    const seen = new Set();
    for (const c of game.enemies) {
      if (c.gone) continue;
      seen.add(c.id);
      let m = this.models.get(c.id);
      if (!m) {
        const fn = BUILDERS[c.type];
        const obj = fn ? fn(c) : buildListener();
        this.root.add(obj);
        m = { obj, phase: 0, lx: c.x, lz: c.z, emerge: c.type === 'listener' ? 1 : 0, type: c.type };
        this.models.set(c.id, m);
      }
      this._animate(m, c, dt, game);
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.root.remove(m.obj); m.obj.traverse((o) => o.geometry && o.geometry.dispose()); this.models.delete(id); }
  }

  _animate(m, c, dt, game) {
    const o = m.obj, u = o.userData;
    const moved = Math.hypot(c.x - m.lx, c.z - m.lz);
    m.lx = c.x; m.lz = c.z;
    o.position.set(c.x, c.y || 0, c.z);
    o.rotation.y = c.yaw;
    o.visible = c.state !== 'dormant' || c.encounter === 'demo' || c.type === 'cutout'; // a dormant Cutout is still a flat display figure
    if (c.render) { c.render(o, dt, game); return; }
    if (u.custom) { u.custom(o, c, dt, game, moved); return; }
    const speed = moved / Math.max(dt, 1e-4);
    m.phase += moved * (u.human ? 2.6 : 2.1);
    const sw = Math.min(1, speed / 2.5);
    if (u.legs) {
      u.legs.forEach((L, i) => {
        const ph = m.phase + i * Math.PI;
        L.hp.rotation.x = Math.sin(ph) * 0.55 * sw;
        L.kn.rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * sw;
      });
    }
    if (u.arms) {
      u.arms.forEach((A, i) => {
        const ph = m.phase + i * Math.PI;
        A.sh.rotation.x = -Math.sin(ph) * 0.4 * sw + (c.type === 'listener' ? 0.15 : 0);
        A.sh.rotation.z = (i ? -1 : 1) * (c.type === 'listener' ? 0.12 : 0.05);
        A.el.rotation.x = -0.2 - (c.state === 'pursue' ? 0.5 : 0);
      });
    }
    if (u.head) {
      const listen = c.state === 'warn' || c.state === 'investigate' || c.state === 'search';
      u.head.rotation.z = listen ? Math.sin(game.time * 2.3) * 0.35 : Math.sin(game.time * 0.7) * 0.06;
      u.head.rotation.x = c.state === 'pursue' ? 0.35 : 0.1;
    }
    if (u.hips && c.type === 'listener') { u.hips.position.y = 1.15 + Math.abs(Math.sin(m.phase)) * 0.04 * sw; u.chest && (u.chest.rotation.x = c.state === 'pursue' ? 0.35 : 0.12); }
  }

  /** Escorted characters (June, Lena). */
  syncNpcs(game, dt) {
    this.npcModels = this.npcModels || new Map();
    const seen = new Set();
    for (const n of game.npcs || []) {
      seen.add(n.id);
      let m = this.npcModels.get(n.id);
      if (!m) {
        const look = NPC_LOOK[n.model] || NPC_LOOK.june;
        const obj = buildHuman(look.color, look.accent, { hairColor: look.hair, skin: look.skin });
        this.root.add(obj);
        m = { obj, lx: n.x, lz: n.z };
        this.npcModels.set(n.id, m);
      }
      const moved = Math.hypot(n.x - m.lx, n.z - m.lz); m.lx = n.x; m.lz = n.z;
      m.obj.position.set(n.x, n.y || 0, n.z); m.obj.rotation.y = n.yaw || 0;
      m.obj.visible = !n.hidden;
      animHuman(m.obj.userData, n, dt, moved, game);
      if (n.seated && m.obj.userData.hips) { m.obj.userData.hips.position.y = 0.5; m.obj.userData.legs.forEach((L) => { L.hp.rotation.x = 1.45; L.kn.rotation.x = -1.45; }); m.obj.userData.arms.forEach((A) => { A.sh.rotation.x = 0.5; A.el.rotation.x = 0.9; }); }
    }
    for (const [id, m] of this.npcModels) if (!seen.has(id)) { this.root.remove(m.obj); this.npcModels.delete(id); }
  }

  /** Revealed bodies for photographs: add hidden-layer stand-ins at the exposure instant. */
  photoStandIns(photo, game) {
    const out = [];
    for (const cr of photo.creatures || []) {
      const c = game.enemyById(cr.id);
      let o = null;
      if (cr.type === 'drowned') o = drownedPhotoBody(cr.x, cr.z);
      else if (cr.type === 'unseen') o = unseenPhotoBody(cr);
      else if (c && c.photoModel) o = c.photoModel();
      if (o) { o.traverse((x) => x.layers.set(HIDDEN_LAYER)); out.push(o); }
    }
    return out;
  }

  /** Footprints and floor dents: short-lived decals on the floor. */
  addDecal(kind, x, z, y = 0, yaw = 0, opts = {}) {
    this.decals = this.decals || [];
    let mesh;
    if (kind === 'footprint') {
      mesh = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: opts.wet ? 0x1a2a30 : 0x050505, transparent: true, opacity: 0, depthWrite: false }));
      mesh.scale.set(1, 2.6, 1);
    } else {
      mesh = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    }
    mesh.rotation.set(-Math.PI / 2, 0, -yaw);
    mesh.position.set(x, y + 0.015, z);
    this.root.add(mesh);
    this.decals.push({ mesh, t: -(opts.delay || 0), life: kind === 'footprint' ? 22 : 6, peak: kind === 'footprint' ? 0.55 : 0.7 });
  }
  updateDecals(dt) {
    if (!this.decals) return;
    for (const d of this.decals) {
      d.t += dt;
      const a = d.t < 0 ? 0 : d.t < 0.3 ? d.t / 0.3 : Math.max(0, 1 - (d.t - 0.3) / (d.life - 0.3));
      d.mesh.material.opacity = a * d.peak;
    }
    const dead = this.decals.filter((d) => d.t > d.life);
    for (const d of dead) { this.root.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
    if (dead.length) this.decals = this.decals.filter((d) => d.t <= d.life);
  }

  clear() { if (this.decals) { for (const d of this.decals) this.root.remove(d.mesh); this.decals = []; } for (const m of this.models.values()) this.root.remove(m.obj); this.models.clear(); if (this.npcModels) { for (const m of this.npcModels.values()) this.root.remove(m.obj); this.npcModels.clear(); } }
}
