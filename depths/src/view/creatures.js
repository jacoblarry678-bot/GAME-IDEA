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

const BUILDERS = { listener: buildListener };
export function registerCreatureModel(type, fn) { BUILDERS[type] = fn; }

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
    o.visible = c.state !== 'dormant' || c.encounter === 'demo';
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

  /** Revealed bodies for photographs: add hidden-layer stand-ins at the exposure instant. */
  photoStandIns(photo, game) {
    const out = [];
    for (const cr of photo.creatures || []) {
      const c = game.enemyById(cr.id);
      if (c && c.photoModel) { const o = c.photoModel(); o.traverse((x) => x.layers.set(HIDDEN_LAYER)); out.push(o); }
    }
    return out;
  }

  clear() { for (const m of this.models.values()) this.root.remove(m.obj); this.models.clear(); }
}
