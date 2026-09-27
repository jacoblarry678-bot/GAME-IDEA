/** Procedural low-poly models for weapons, consumables, ammo and materials. */

import * as THREE from 'three';
import { RARITIES, CONSUMABLES, AMMO, MATS } from '../gameplay/items.js';

const cache = new Map();
const m = (color, emissive) => {
  const k = color + (emissive || '');
  if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color, emissive: emissive || '#000000' }));
  return cache.get(k);
};
const bx = (w, h, d, color, x = 0, y = 0, z = 0, em) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(color, em));
  mesh.position.set(x, y, z);
  return mesh;
};
const cyl = (r, l, color, x = 0, y = 0, z = 0, alongZ = true) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10), m(color));
  if (alongZ) mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
};

/** Weapon models point their barrel along +Z; grip at the origin. */
export function weaponModel(id, rarity = 0) {
  const g = new THREE.Group();
  const rc = RARITIES[rarity]?.color || '#aaaaaa';
  const dark = '#2c3440';
  switch (id) {
    case 'ar':
      g.add(bx(0.1, 0.16, 0.75, dark, 0, 0.06, 0.2), cyl(0.03, 0.35, '#1a1a1a', 0, 0.08, 0.72), bx(0.08, 0.2, 0.12, rc, 0, -0.08, 0.28), bx(0.09, 0.14, 0.3, rc, 0, 0.02, -0.25), bx(0.06, 0.06, 0.18, '#555', 0, 0.18, 0.2));
      break;
    case 'smg':
      g.add(bx(0.1, 0.15, 0.45, dark, 0, 0.06, 0.12), cyl(0.028, 0.18, '#1a1a1a', 0, 0.08, 0.42), bx(0.07, 0.26, 0.08, rc, 0, -0.12, 0.2), bx(0.08, 0.1, 0.12, rc, 0, 0.03, -0.12));
      break;
    case 'shotgun':
      g.add(bx(0.1, 0.13, 0.7, '#6b4a2e', 0, 0.05, 0.1), cyl(0.04, 0.55, '#1a1a1a', 0, 0.1, 0.55), bx(0.11, 0.09, 0.2, rc, 0, 0.0, 0.45), bx(0.09, 0.16, 0.26, '#6b4a2e', 0, 0.0, -0.3));
      break;
    case 'pistol':
      g.add(bx(0.07, 0.11, 0.3, dark, 0, 0.07, 0.1), bx(0.07, 0.18, 0.08, rc, 0, -0.04, 0.0));
      break;
    case 'sniper':
      g.add(bx(0.09, 0.13, 0.9, '#3b4f3a', 0, 0.05, 0.2), cyl(0.028, 0.6, '#1a1a1a', 0, 0.07, 0.95), cyl(0.05, 0.36, '#111', 0, 0.2, 0.25), bx(0.09, 0.18, 0.32, rc, 0, 0.0, -0.3));
      break;
    case 'launcher':
      g.add(cyl(0.13, 1.1, '#4a6b3a', 0, 0.12, 0.25), cyl(0.15, 0.1, rc, 0, 0.12, 0.8), bx(0.07, 0.2, 0.1, dark, 0, -0.06, 0.1), bx(0.12, 0.1, 0.16, rc, 0, 0.28, 0.1));
      break;
    case 'pickaxe': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), m('#8a5a33'));
      handle.rotation.x = Math.PI / 2;
      handle.position.z = 0.35;
      const head = bx(0.08, 0.5, 0.1, rc === '#aaaaaa' ? '#c9d3dd' : rc, 0, 0.05, 0.78);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), m('#c9d3dd'));
      tip.position.set(0, 0.38, 0.78);
      g.add(handle, head, tip);
      break;
    }
    case 'boomball': {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), m('#ff4f7a', '#551122'));
      const f = cyl(0.02, 0.1, '#333', 0, 0.16, 0, false);
      g.add(s, f);
      break;
    }
    default:
      g.add(bx(0.2, 0.2, 0.2, rc));
  }
  return g;
}

export function consumableModel(id) {
  const g = new THREE.Group();
  const c = CONSUMABLES[id]?.color || '#fff';
  switch (id) {
    case 'bandage':
      g.add(bx(0.4, 0.12, 0.25, c), bx(0.1, 0.13, 0.26, '#e8453c'));
      break;
    case 'medkit':
      g.add(bx(0.55, 0.35, 0.3, c), bx(0.08, 0.25, 0.31, '#ffffff'), bx(0.25, 0.08, 0.31, '#ffffff'));
      break;
    case 'minishield':
      g.add(bx(0.2, 0.32, 0.14, c, 0, 0.16, 0, '#0a3a55'), cyl(0.012, 0.12, '#ffffff', 0.05, 0.36, 0, false));
      break;
    case 'bigshield': {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), m(c, '#0b2a66'));
      b.position.y = 0.2;
      g.add(b, cyl(0.07, 0.18, '#dfe8ff', 0, 0.45, 0, false));
      break;
    }
    case 'pickle': {
      const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), m(c, '#1e4a12'));
      p.position.y = 0.25;
      g.add(p);
      break;
    }
    case 'zoom': case 'bounce': case 'spicy': case 'snack': {
      // soda-can style buff drinks
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12), m(c, '#222222'));
      can.position.y = 0.16;
      g.add(can, cyl(0.08, 0.03, '#dddddd', 0, 0.33, 0, false), cyl(0.112, 0.08, '#ffffff', 0, 0.16, 0, false));
      break;
    }
    default:
      g.add(bx(0.3, 0.3, 0.3, c));
  }
  return g;
}

export function cardModel() {
  const g = new THREE.Group();
  const card = bx(0.5, 0.7, 0.04, '#3f9bff', 0, 0.45, 0, '#0b3a88');
  g.add(card, bx(0.3, 0.12, 0.05, '#ffffff', 0, 0.62, 0, '#666666'));
  return g;
}

export function coinModel() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#7a5a00' }));
    c.position.set((i - 1) * 0.12, 0.05 + i * 0.07, 0);
    g.add(c);
  }
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.07, 14), new THREE.MeshLambertMaterial({ color: '#7ed957', emissive: '#1d4a12' }));
  b.position.set(0, 0.28, 0);
  b.rotation.x = Math.PI / 2;
  g.add(b);
  return g;
}

export function ammoModel(id) {
  const g = new THREE.Group();
  g.add(bx(0.4, 0.22, 0.28, AMMO[id]?.color || '#fff', 0, 0.11, 0), bx(0.42, 0.05, 0.3, '#333', 0, 0.22, 0));
  return g;
}

export function matModel(id) {
  const g = new THREE.Group();
  const c = MATS[id]?.color || '#fff';
  for (let i = 0; i < 3; i++) g.add(bx(0.5, 0.1, 0.18, c, 0, 0.06 + i * 0.11, (i - 1) * 0.05));
  return g;
}

export function itemModel(it) {
  if (it.kind === 'weapon') return weaponModel(it.id, it.rarity);
  if (it.kind === 'throwable') return weaponModel(it.id);
  if (it.kind === 'consumable') return consumableModel(it.id);
  if (it.kind === 'ammo') return ammoModel(it.id);
  if (it.kind === 'card') return cardModel();
  if (it.kind === 'coin') return coinModel();
  return matModel(it.id);
}
