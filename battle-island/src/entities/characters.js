/**
 * Colton, Emerson and Waylon: procedural toon-shaded models with a small
 * hierarchical rig and fully procedural animation. Outfits are palettes plus
 * per-kid hair/hat/backpack pieces. All three share identical combat stats.
 */

import * as THREE from 'three';
import { weaponModel } from './models.js';

export const SKIN_TONES = ['#ffd9bd', '#f3c29b', '#d9a077', '#b27a52', '#7d5033'];

export const CHARACTERS = {
  colton: {
    name: 'Colton',
    title: 'The Garage Ace',
    bio: 'Knows every truck at Benton Diesel by the sound of its engine. First one off the bus, every time.',
    emote: 'Wrench Wiggle',
    outfits: [
      { name: 'Garage Grease', level: 1, c: { top: '#ff7a1a', top2: '#ffd23f', pants: '#2f4f8a', shoes: '#f5f5f5', hair: '#6b4226', hat: '#e8453c', pack: '#3f7bff' } },
      { name: 'Storm Chaser', level: 3, c: { top: '#6a3fd0', top2: '#39f0ff', pants: '#1f1f2e', shoes: '#39f0ff', hair: '#6b4226', hat: '#1f1f2e', pack: '#b35cff' } },
      { name: 'Golden Wrench', level: 6, c: { top: '#ffcf3f', top2: '#ffffff', pants: '#8a5a1a', shoes: '#ffcf3f', hair: '#6b4226', hat: '#ffae1a', pack: '#ff7a1a' } },
    ],
  },
  emerson: {
    name: 'Emerson',
    title: 'The Star Sprinter',
    bio: 'Fastest kid in Pickles Park and captain of the Clubhouse. No slide in town is too fast for Emerson.',
    emote: 'Star Spin',
    outfits: [
      { name: 'Star Sprinter', level: 1, c: { top: '#b35cff', top2: '#ff7ac8', pants: '#27b3a7', shoes: '#ff7ac8', hair: '#f2c35b', hat: '#ff7ac8', pack: '#ffd23f' } },
      { name: 'Pickle Pop', level: 2, c: { top: '#7ed957', top2: '#ffffff', pants: '#ff7ac8', shoes: '#ffffff', hair: '#f2c35b', hat: '#7ed957', pack: '#ff7ac8' } },
      { name: 'Midnight Glow', level: 5, c: { top: '#1d2a5a', top2: '#39f0ff', pants: '#101828', shoes: '#39f0ff', hair: '#f2c35b', hat: '#39f0ff', pack: '#6a3fd0' } },
    ],
  },
  waylon: {
    name: 'Waylon',
    title: 'The Dino Explorer',
    bio: 'Brave enough for Haunt Hollow after dark. Carries a dinosaur backpack full of snacks and secrets.',
    emote: 'Dino Stomp',
    outfits: [
      { name: 'Dino Explorer', level: 1, c: { top: '#3fb24a', top2: '#ffe066', pants: '#3f7bff', shoes: '#8a5a33', hair: '#3b2616', hat: '#3fb24a', pack: '#3fb24a' } },
      { name: 'Haunt Hunter', level: 2, c: { top: '#3a3548', top2: '#ff8a1a', pants: '#5d3f80', shoes: '#1f1f2e', hair: '#3b2616', hat: '#ff8a1a', pack: '#ff8a1a' } },
      { name: 'Clubhouse Captain', level: 4, c: { top: '#e8453c', top2: '#ffffff', pants: '#1f3f7a', shoes: '#ffffff', hair: '#3b2616', hat: '#ffcf3f', pack: '#e8453c' } },
    ],
  },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const G = {};
const geo = (k, f) => G[k] || (G[k] = f());

export class CharacterModel {
  constructor(charId, outfit = 0, skin = 0) {
    this.charId = charId;
    const def = CHARACTERS[charId];
    const pal = def.outfits[outfit]?.c || def.outfits[0].c;
    this.mats = [];
    const M = (color, emissive = '#000000') => {
      const mm = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive });
      this.mats.push(mm);
      return mm;
    };
    const skinM = M(SKIN_TONES[skin] || SKIN_TONES[0]);
    const top = M(pal.top), top2 = M(pal.top2), pants = M(pal.pants), shoes = M(pal.shoes), hair = M(pal.hair), hat = M(pal.hat), pack = M(pal.pack);
    const black = M('#111111'), white = M('#ffffff');
    const mesh = (g, mt, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, mt);
      o.position.set(x, y, z);
      o.castShadow = true;
      return o;
    };

    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilts for skydive/swim
    this.root.add(this.body);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.8;
    this.body.add(this.hips);
    this.hips.add(mesh(geo('pelvis', () => new THREE.BoxGeometry(0.42, 0.2, 0.26)), pants, 0, 0, 0));

    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.12 * s, -0.02, 0);
      leg.add(mesh(geo('leg', () => new THREE.CapsuleGeometry(0.1, 0.5, 4, 8)), pants, 0, -0.36, 0));
      leg.add(mesh(geo('shoe', () => new THREE.BoxGeometry(0.2, 0.14, 0.32)), shoes, 0, -0.72, 0.05));
      this.hips.add(leg);
      this.legs.push(leg);
    }

    // torso
    this.spine = new THREE.Group();
    this.spine.position.y = 0.05;
    this.hips.add(this.spine);
    const torso = mesh(geo('torso', () => new THREE.CapsuleGeometry(0.24, 0.28, 4, 10)), top, 0, 0.3, 0);
    torso.scale.set(1.05, 1, 0.8);
    this.spine.add(torso);
    // outfit detail
    if (charId === 'colton') {
      this.spine.add(mesh(geo('pocket', () => new THREE.BoxGeometry(0.3, 0.12, 0.05)), top2, 0, 0.18, 0.2));
      const hood = mesh(geo('hood', () => new THREE.TorusGeometry(0.18, 0.06, 6, 12)), top, 0, 0.55, -0.1);
      hood.rotation.x = Math.PI / 2.4;
      this.spine.add(hood);
    } else if (charId === 'emerson') {
      const star = mesh(geo('star', () => new THREE.CylinderGeometry(0.1, 0.1, 0.04, 5)), top2, 0.08, 0.38, 0.19);
      star.rotation.x = Math.PI / 2;
      this.spine.add(star);
      this.spine.add(mesh(geo('zip', () => new THREE.BoxGeometry(0.03, 0.4, 0.04)), top2, -0.02, 0.3, 0.2));
    } else {
      this.spine.add(mesh(geo('bib', () => new THREE.BoxGeometry(0.34, 0.28, 0.05)), pants, 0, 0.2, 0.19));
      for (const s of [-1, 1]) this.spine.add(mesh(geo('strap', () => new THREE.BoxGeometry(0.05, 0.3, 0.05)), pants, 0.12 * s, 0.45, 0.17));
      const stripe = mesh(geo('stripe', () => new THREE.TorusGeometry(0.235, 0.03, 4, 16)), top2, 0, 0.5, 0);
      stripe.rotation.x = Math.PI / 2;
      this.spine.add(stripe);
    }
    // backpack / back bling
    const bp = mesh(geo('pack', () => new THREE.BoxGeometry(0.34, 0.38, 0.16)), pack, 0, 0.32, -0.26);
    this.spine.add(bp);
    if (charId === 'waylon') {
      for (let i = 0; i < 3; i++) {
        const sp = mesh(geo('spike', () => new THREE.ConeGeometry(0.06, 0.14, 4)), top2, 0, 0.52 - i * 0.13, -0.36);
        sp.rotation.x = -Math.PI / 2;
        this.spine.add(sp);
      }
    } else if (charId === 'emerson') {
      const st = mesh(geo('packstar', () => new THREE.CylinderGeometry(0.14, 0.14, 0.05, 5)), top2, 0, 0.34, -0.35);
      st.rotation.x = Math.PI / 2;
      this.spine.add(st);
    } else {
      const wr = mesh(geo('wrench', () => new THREE.BoxGeometry(0.06, 0.4, 0.04)), white, 0.1, 0.36, -0.35);
      wr.rotation.z = 0.5;
      this.spine.add(wr);
    }

    // head
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    this.spine.add(this.head);
    this.head.add(mesh(geo('head', () => new THREE.SphereGeometry(0.28, 16, 12)), skinM, 0, 0.24, 0));
    for (const s of [-1, 1]) {
      this.head.add(mesh(geo('eye', () => new THREE.SphereGeometry(0.055, 8, 6)), black, 0.1 * s, 0.27, 0.24));
      this.head.add(mesh(geo('glint', () => new THREE.SphereGeometry(0.018, 6, 4)), white, 0.1 * s + 0.02, 0.29, 0.29));
      this.head.add(mesh(geo('cheek', () => new THREE.SphereGeometry(0.04, 6, 4)), M('#ff9a9a'), 0.17 * s, 0.18, 0.21));
    }
    const smile = mesh(geo('smile', () => new THREE.TorusGeometry(0.07, 0.015, 4, 10, Math.PI)), black, 0, 0.16, 0.26);
    smile.rotation.z = Math.PI;
    this.head.add(smile);
    // hair / hats
    const cap = mesh(geo('haircap', () => new THREE.SphereGeometry(0.295, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1)), hair, 0, 0.27, -0.02);
    this.head.add(cap);
    if (charId === 'colton') {
      const c1 = mesh(geo('cap', () => new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4)), hat, 0, 0.3, 0);
      const brim = mesh(geo('brim', () => new THREE.BoxGeometry(0.34, 0.03, 0.24)), hat, 0, 0.34, 0.3);
      brim.rotation.x = 0.12;
      this.head.add(c1, brim);
    } else if (charId === 'emerson') {
      const band = mesh(geo('band', () => new THREE.TorusGeometry(0.285, 0.03, 6, 20)), hat, 0, 0.36, 0);
      band.rotation.x = Math.PI / 2 - 0.3;
      this.head.add(band);
      this.pony = new THREE.Group();
      this.pony.position.set(0, 0.42, -0.24);
      this.pony.add(mesh(geo('pony', () => new THREE.CapsuleGeometry(0.08, 0.32, 4, 8)), hair, 0, -0.2, -0.03));
      this.head.add(this.pony);
    } else {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        this.head.add(mesh(geo('curl', () => new THREE.SphereGeometry(0.1, 8, 6)), hair, Math.cos(a) * 0.2, 0.44 + (i % 2) * 0.03, Math.sin(a) * 0.2 - 0.02));
      }
      for (const s of [-1, 1]) {
        const gl = mesh(geo('glass', () => new THREE.TorusGeometry(0.07, 0.015, 4, 12)), black, 0.1 * s, 0.27, 0.27);
        this.head.add(gl);
      }
    }

    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0.32 * s, 0.5, 0);
      arm.add(mesh(geo('arm', () => new THREE.CapsuleGeometry(0.075, 0.38, 4, 8)), top, 0, -0.25, 0));
      arm.add(mesh(geo('hand', () => new THREE.SphereGeometry(0.085, 8, 6)), skinM, 0, -0.5, 0));
      this.spine.add(arm);
      this.arms.push(arm);
    }
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.52, 0.02);
    this.hand.rotation.x = Math.PI / 2;
    this.arms[1].add(this.hand);

    // glider (hidden until deployed)
    this.glider = new THREE.Group();
    const canopyTex = stripeTexture(pal.top, pal.top2);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshToonMaterial({ map: canopyTex, gradientMap: toonGradient(), side: THREE.DoubleSide }));
    canopy.scale.set(1.3, 0.6, 0.9);
    canopy.position.y = 1.2;
    this.glider.add(canopy);
    const lm = new THREE.LineBasicMaterial({ color: '#333333' });
    for (const [x, z] of [[-1.6, 0], [1.6, 0], [-1, 0.6], [1, 0.6]]) {
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(x, 1.0, z)]);
      this.glider.add(new THREE.Line(lg, lm));
    }
    this.glider.position.y = 2.4;
    this.glider.visible = false;
    this.root.add(this.glider);

    this.held = null;
    this.heldKey = '';
    this.phase = 0;
    this.flash = 0;
    this.swing = 0;
    this.kick = 0;
  }

  setHeld(key, rarity) {
    if (key === this.heldKey) return;
    this.heldKey = key;
    if (this.held) this.hand.remove(this.held);
    this.held = null;
    if (!key || key === 'none') return;
    this.held = weaponModel(key, rarity);
    if (key === 'pickaxe') this.held.rotation.x = -0.3;
    this.held.traverse((o) => (o.castShadow = true));
    this.hand.add(this.held);
  }

  hit() {
    this.flash = 0.12;
  }

  /**
   * st: { speed, state, crouch, pitch, pose ('gun'|'pickaxe'|'none'|'heal'|'build'), sprint, t, emote }
   */
  animate(dt, st) {
    const t = st.t;
    const [legL, legR] = this.legs;
    const [armL, armR] = this.arms;
    this.phase += dt * (3 + st.speed * 1.55);
    const run = Math.min(1, st.speed / 5);
    const sw = Math.sin(this.phase) * run;
    this.kick = Math.max(0, this.kick - dt * 8);
    this.swing = Math.max(0, this.swing - dt * 3.2);
    if (this.flash > 0) {
      this.flash -= dt;
      const v = this.flash > 0 ? 0.7 : 0;
      for (const mm of this.mats) mm.emissive.setScalar(v);
    }
    // defaults
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.hips.position.y = 0.8 + Math.abs(Math.sin(this.phase)) * 0.05 * run;
    this.hips.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    legL.rotation.set(sw * 0.9, 0, 0);
    legR.rotation.set(-sw * 0.9, 0, 0);
    armL.rotation.set(-sw * 0.8, 0, 0.1);
    armR.rotation.set(sw * 0.8, 0, -0.1);
    this.glider.visible = st.state === 'glide';
    if (this.pony) this.pony.rotation.x = 0.3 + Math.sin(t * 6) * 0.15 * (0.3 + run);

    const idle = run < 0.05;
    if (idle) {
      const b = Math.sin(t * 2.2);
      this.hips.position.y = 0.8 + b * 0.012;
      armL.rotation.z = 0.12 + b * 0.03;
      armR.rotation.z = -0.12 - b * 0.03;
      this.head.rotation.y = Math.sin(t * 0.7) * 0.15;
    }
    if (st.sprint && !idle) this.spine.rotation.x = 0.25;

    if (st.state === 'skydive') {
      this.body.rotation.x = 1.25;
      this.body.position.y = 1.0;
      legL.rotation.set(0.3, 0, -0.4);
      legR.rotation.set(0.3, 0, 0.4);
      armL.rotation.set(-0.3, 0, 1.3 + Math.sin(t * 9) * 0.1);
      armR.rotation.set(-0.3, 0, -1.3 - Math.sin(t * 9) * 0.1);
      this.head.rotation.x = -0.9;
      return;
    }
    if (st.state === 'glide') {
      armL.rotation.set(-2.9, 0, 0.35);
      armR.rotation.set(-2.9, 0, -0.35);
      legL.rotation.set(0.2 + Math.sin(t * 3) * 0.2, 0, 0);
      legR.rotation.set(0.2 - Math.sin(t * 3) * 0.2, 0, 0);
      return;
    }
    if (st.state === 'swim') {
      this.body.rotation.x = 1.1;
      this.body.position.y = 0.6;
      armL.rotation.set(-Math.PI + Math.sin(this.phase) * 1.4, 0, 0.3);
      armR.rotation.set(-Math.PI - Math.sin(this.phase) * 1.4, 0, -0.3);
      legL.rotation.x = Math.sin(this.phase * 2) * 0.4;
      legR.rotation.x = -Math.sin(this.phase * 2) * 0.4;
      this.head.rotation.x = -0.9;
      return;
    }
    if (st.state === 'air') {
      legL.rotation.x = -0.5;
      legR.rotation.x = 0.3;
      armL.rotation.z = 0.8;
      armR.rotation.z = -0.8;
    }
    if (st.crouch) {
      this.hips.position.y = 0.52;
      legL.rotation.x = -1.1 + sw * 0.4;
      legR.rotation.x = -1.1 - sw * 0.4;
      this.spine.rotation.x = 0.3;
    }
    if (st.slide) {
      this.body.rotation.x = -0.5;
      this.hips.position.y = 0.4;
      legL.rotation.x = -1.3;
      legR.rotation.x = -1.0;
    }

    if (st.emote) {
      this._emote(t, legL, legR, armL, armR);
      return;
    }

    const pitch = st.pitch || 0;
    if (st.pose === 'gun' || st.pose === 'build') {
      this.spine.rotation.x += -pitch * 0.35;
      const a = -Math.PI / 2 - pitch * 0.65;
      armR.rotation.set(a - this.kick * 0.25, 0, -0.05);
      armL.rotation.set(a + 0.1 - this.kick * 0.2, 0.55, 0.25);
      this.head.rotation.x = -pitch * 0.3;
    } else if (st.pose === 'pickaxe') {
      if (this.swing > 0) {
        const p = 1 - this.swing;
        armR.rotation.set(-2.6 + p * 2.3, 0, -0.2);
        this.spine.rotation.y = -0.4 + p * 0.6;
      } else {
        armR.rotation.set(-0.9 + sw * 0.4, 0, -0.15);
      }
    } else if (st.pose === 'heal') {
      armL.rotation.set(-2.2, 0.3, 0.5);
      armR.rotation.set(-2.0, -0.3, -0.5);
      this.head.rotation.x = 0.2;
    } else if (st.pose === 'throw') {
      armR.rotation.set(-2.7 + this.kick * 2.0, 0, -0.2);
    }
  }

  _emote(t, legL, legR, armL, armR) {
    if (this.charId === 'colton') {
      const b = Math.sin(t * 8);
      armL.rotation.set(-2.6 * (b > 0 ? 1 : 0.3), 0, 0.3);
      armR.rotation.set(-2.6 * (b > 0 ? 0.3 : 1), 0, -0.3);
      this.hips.rotation.z = b * 0.15;
      this.hips.position.y = 0.8 + Math.abs(b) * 0.1;
      legL.rotation.z = b * 0.2;
      legR.rotation.z = b * 0.2;
    } else if (this.charId === 'emerson') {
      this.body.rotation.y = t * 7;
      armL.rotation.set(0, 0, 1.5);
      armR.rotation.set(0, 0, -1.5);
      this.hips.position.y = 0.85 + Math.abs(Math.sin(t * 7)) * 0.2;
      legL.rotation.x = -0.4;
    } else {
      const b = Math.sin(t * 5);
      this.spine.rotation.x = 0.4;
      armL.rotation.set(-1.2, 0.4, 0.2 + b * 0.2);
      armR.rotation.set(-1.2, -0.4, -0.2 - b * 0.2);
      legL.rotation.x = b > 0 ? -0.9 * b : 0;
      legR.rotation.x = b < 0 ? 0.9 * b : 0;
      this.head.rotation.z = b * 0.2;
      this.hips.position.y = 0.8 + Math.abs(b) * 0.08;
    }
  }

  dispose() {
    for (const mm of this.mats) mm.dispose();
  }
}

function stripeTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(i * 16, 0, 16, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
