// The Woodsman (PTB): a hulking logger in a carved birch mask, carrying a felling axe.
import * as THREE from 'three';
import { attachAura } from './characters.js';
import { fabricTexture, metalTexture, barkTexture } from '../world/textures.js';

const plaidCache = new Map();
function plaidTexture(a, b) {
  const key = a + b;
  if (plaidCache.has(key)) return plaidCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.55; g.fillStyle = b;
  for (const o of [0, 64]) { g.fillRect(o, 0, 28, 128); g.fillRect(0, o, 128, 28); }
  g.globalAlpha = 0.35;
  for (const o of [40, 104]) { g.fillRect(o, 0, 4, 128); g.fillRect(0, o, 128, 4); }
  g.globalAlpha = 0.12; g.fillStyle = '#fff';
  for (let y = 0; y < 128; y += 2) g.fillRect(0, y, 128, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  plaidCache.set(key, t);
  return t;
}

function birchTexture(base) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(20,16,12,0.75)';
  for (let i = 0; i < 16; i++) { const y = Math.random() * 128; g.fillRect(Math.random() * 40, y, 8 + Math.random() * 22, 1 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
function mesh(geo, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

function axeMeshes(parent, outfit, scale = 1) {
  const metal = metalTexture('#6a6a66', 'axehead');
  const steel = new THREE.MeshStandardMaterial({ color: outfit.metal, map: metal.map, normalMap: metal.normalMap, metalness: 0.75, roughness: 0.45 });
  const edge = new THREE.MeshStandardMaterial({ color: '#d8dce0', metalness: 0.9, roughness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: outfit.haft, roughness: 0.8, map: barkTexture().map });
  const haft = mesh(new THREE.CylinderGeometry(0.022 * scale, 0.028 * scale, 1.0 * scale, 8), wood, 0, 0.42 * scale, 0, parent);
  haft.castShadow = true;
  const head = grp(parent, 0, 0.9 * scale, 0);
  mesh(new THREE.BoxGeometry(0.07 * scale, 0.1 * scale, 0.09 * scale), steel, 0, 0, 0, head);
  const blade = new THREE.Shape();
  blade.moveTo(0, -0.05); blade.lineTo(0.2, -0.11); blade.quadraticCurveTo(0.25, 0, 0.2, 0.11); blade.lineTo(0, 0.05); blade.lineTo(0, -0.05);
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.022, bevelEnabled: false });
  bg.translate(0, 0, -0.011);
  bg.scale(scale, scale, scale);
  const b = mesh(bg, steel, 0.03 * scale, 0, 0, head);
  b.rotation.y = Math.PI / 2;
  const eg = new THREE.BoxGeometry(0.012 * scale, 0.2 * scale, 0.026 * scale);
  mesh(eg, edge, 0, 0, 0.255 * scale, head);
  mesh(new THREE.BoxGeometry(0.05 * scale, 0.08 * scale, 0.07 * scale), steel, 0, 0, -0.075 * scale, head); // poll
  return { head };
}

export function buildWoodsman(outfit) {
  const root = new THREE.Group();
  root.name = 'woodsman';
  const body = grp(root);
  const fab = fabricTexture().normalMap;
  const shirt = new THREE.MeshStandardMaterial({ map: plaidTexture(outfit.plaid, outfit.plaid2), normalMap: fab, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: outfit.pants, normalMap: fab, roughness: 0.95 });
  const boots = new THREE.MeshStandardMaterial({ color: '#1e1610', roughness: 0.7 });
  const gloves = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.8 });
  const mask = new THREE.MeshStandardMaterial({ color: '#ffffff', map: birchTexture(outfit.mask), roughness: 0.85 });
  const cap = new THREE.MeshStandardMaterial({ color: outfit.cap, normalMap: fab, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: '#050404', roughness: 1 });
  const strap = new THREE.MeshStandardMaterial({ color: '#2a1e14', roughness: 0.7 });

  const hips = grp(body, 0, 1.06, 0);
  mesh(new THREE.CapsuleGeometry(0.16, 0.2, 4, 10), pants, 0, 0, 0, hips).rotation.z = Math.PI / 2;
  const torso = grp(hips, 0, 0.04, 0);
  const chest = mesh(new THREE.CapsuleGeometry(0.22, 0.36, 6, 14), shirt, 0, 0.3, 0, torso);
  chest.scale.set(1.25, 1, 0.82);
  const belly = mesh(new THREE.SphereGeometry(0.22, 14, 10), shirt, 0, 0.12, 0.05, torso);
  belly.scale.set(1.15, 0.9, 0.95);
  // suspenders
  for (const s of [-1, 1]) {
    const st = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.02), strap, s * 0.12, 0.3, 0.205, torso, false);
    st.rotation.z = s * 0.06;
    mesh(new THREE.BoxGeometry(0.05, 0.62, 0.02), strap, s * 0.12, 0.3, -0.19, torso, false);
  }
  mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), shirt, 0, 0.6, 0, torso).rotation.z = Math.PI / 2;
  const neck = grp(torso, 0, 0.66, 0);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 10), shirt, 0, 0.03, 0, neck);
  const head = grp(neck, 0, 0.14, 0.02);
  mesh(new THREE.SphereGeometry(0.13, 16, 12), cap, 0, 0.07, -0.01, head);
  // knit cap with a fold
  const kc = mesh(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cap, 0, 0.09, -0.01, head);
  kc.scale.set(1, 1.15, 1.05);
  mesh(new THREE.TorusGeometry(0.135, 0.025, 6, 18), cap, 0, 0.1, -0.01, head).rotation.x = Math.PI / 2;
  // carved birch mask: a curved shell with eye holes and a slit mouth
  const mg = new THREE.SphereGeometry(0.15, 18, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.62);
  const mk = mesh(mg, mask, 0, 0.05, 0.03, head);
  mk.material.side = THREE.DoubleSide;
  mk.rotation.y = Math.PI / 2 - Math.PI / 2;
  mk.scale.set(0.95, 1.25, 1.0);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.CircleGeometry(0.026, 10), dark, s * 0.05, 0.09, 0.172, head, false);
    eye.scale.set(1, 1.4, 1);
  }
  mesh(new THREE.PlaneGeometry(0.1, 0.012), dark, 0, -0.01, 0.176, head, false);
  for (let i = 0; i < 4; i++) mesh(new THREE.PlaneGeometry(0.006, 0.03), dark, -0.036 + i * 0.024, -0.01, 0.177, head, false);
  // straggly beard below the mask
  const beard = mesh(new THREE.ConeGeometry(0.09, 0.18, 8), cap.clone(), 0, -0.13, 0.08, head);
  beard.material.color.set('#2a2018');
  beard.rotation.x = Math.PI + 0.25;

  const arm = (side) => {
    const sh = grp(torso, side * 0.33, 0.58, 0);
    mesh(new THREE.SphereGeometry(0.11, 10, 8), shirt, 0, 0, 0, sh);
    mesh(new THREE.CapsuleGeometry(0.085, 0.26, 4, 10), shirt, 0, -0.2, 0, sh);
    const elbow = grp(sh, 0, -0.38, 0);
    mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 10), shirt, 0, -0.17, 0, elbow);
    const hand = grp(elbow, 0, -0.35, 0);
    mesh(new THREE.SphereGeometry(0.07, 10, 8), gloves, 0, -0.03, 0, hand).scale.set(1, 1.2, 0.9);
    return { sh, elbow, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);
  const weapon = grp(armR.hand, 0, -0.05, 0.02);
  axeMeshes(weapon, outfit, 1);
  weapon.rotation.x = Math.PI / 2 - 0.2;

  const leg = (side) => {
    const hip = grp(hips, side * 0.13, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.1, 0.36, 4, 10), pants, 0, -0.25, 0, hip);
    const knee = grp(hip, 0, -0.5, 0);
    mesh(new THREE.CapsuleGeometry(0.085, 0.36, 4, 10), pants, 0, -0.24, 0, knee);
    const ankle = grp(knee, 0, -0.5, 0);
    mesh(new THREE.BoxGeometry(0.15, 0.12, 0.3), boots, 0, -0.02, 0.05, ankle);
    return { hip, knee, ankle };
  };
  const legL = leg(1);
  const legR = leg(-1);

  const rig = { root, body, hips, torso, neck, head, armL, armR, legL, legR, weapon, s: 1.16, t: 0, phase: 0, kind: 'woodsman', outfit };
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  rig.aura = attachAura(root);
  return rig;
}

export function buildWoodsmanViewmodel(outfit) {
  const g = new THREE.Group();
  const arm = new THREE.Group();
  g.add(arm);
  const shirt = new THREE.MeshStandardMaterial({ map: plaidTexture(outfit.plaid, outfit.plaid2), roughness: 0.9 });
  const gloves = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.8 });
  const fore = mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 10), shirt, 0, 0, 0.08, arm, false);
  fore.rotation.x = Math.PI / 2;
  const hand = grp(arm, 0, 0, -0.14);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), gloves, 0, 0, 0, hand, false).scale.set(1, 0.9, 1.2);
  const axe = grp(hand, 0, 0, 0);
  axeMeshes(axe, outfit, 0.8);
  axe.rotation.set(-0.5, 0, -0.25);
  arm.position.set(0.28, -0.32, -0.42);
  arm.rotation.set(0.1, 0.12, 0);
  g.scale.setScalar(0.7);
  g.userData.arm = arm;
  g.userData.base = arm.position.clone();
  g.userData.baseRot = arm.rotation.clone();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}
