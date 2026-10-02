/**
 * Colton, Emerson and Waylon: procedural toon-shaded models with a small
 * hierarchical rig and fully procedural animation. Outfits are palettes plus
 * per-kid hair/hat/backpack pieces. All three share identical combat stats.
 */

import * as THREE from 'three';
import { weaponModel } from './models.js';
import { cosmeticModel, applyWrap } from './cosmeticModels.js';
import { RARITIES, WEAPONS } from '../gameplay/items.js';
import { LOCKER, DEFAULTS } from '../core/cosmetics.js';

export const SKIN_TONES = ['#ffd9bd', '#f3c29b', '#d9a077', '#b27a52', '#7d5033'];

export const CHARACTERS = {
  colton: {
    name: 'Colton',
    title: 'The Garage Ace',
    bio: 'Knows every truck at Benton Diesel by the sound of its engine. First one off the bus, every time.',
    emote: 'Wrench Wiggle',
    // Colton's look: short brown crew cut, round rosy face, sturdy build, heather-gray athletic tee
    outfits: [
      { name: 'Everyday Ace', level: 1, c: { top: '#8e9196', top2: '#26262b', pants: '#2f3a4f', shoes: '#f5f5f5', hair: '#5b4330', hat: '#5b4330', pack: '#3f7bff', heather: true } },
      { name: 'Haunt Hunter', level: 2, c: { top: '#3a3548', top2: '#ff8a1a', pants: '#5d3f80', shoes: '#1f1f2e', hair: '#5b4330', hat: '#ff8a1a', pack: '#ff8a1a', heather: true } },
      { name: 'Storm Chaser', level: 3, c: { top: '#6a3fd0', top2: '#39f0ff', pants: '#1f1f2e', shoes: '#39f0ff', hair: '#5b4330', hat: '#1f1f2e', pack: '#b35cff' } },
      { name: 'Crankbolt Rider', pass: 10, c: { top: '#ff8a3d', top2: '#4a5566', pants: '#3a3f4a', shoes: '#ff8a3d', hair: '#5b4330', hat: '#4a5566', pack: '#9fb2c4', heather: true } },
      { name: 'Blood Slimer', shop: 1500, costume: 'slimer', c: { top: '#2a0d12', top2: '#c8102e', pants: '#1a0a0e', shoes: '#120608', hair: '#1a0a0e', hat: '#1a0a0e', pack: '#c8102e' } },
      { name: 'Howl Punk', shop: 1200, costume: 'wolf', c: { top: '#2a2a2e', top2: '#ff2a2a', pants: '#18181c', shoes: '#d23a3a', hair: '#1d1a1c', hat: '#1d1a1c', pack: '#2a2a2e' } },
      { name: 'Hog Wild', shop: 1200, costume: 'pig', c: { top: '#efe6c8', top2: '#efe6c8', pants: '#3f4a2a', shoes: '#1d1d1d', hair: '#f0a3ad', hat: '#f0a3ad', pack: '#9fd0c4' } },
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
      { name: 'Vault Runner', pass: 14, c: { top: '#ffd23f', top2: '#1d2a3a', pants: '#1d2a3a', shoes: '#ffd23f', hair: '#f2c35b', hat: '#1d2a3a', pack: '#ffae1a' } },
      { name: 'Blood Slimer', shop: 1500, costume: 'slimer', c: { top: '#2a0d12', top2: '#c8102e', pants: '#1a0a0e', shoes: '#120608', hair: '#1a0a0e', hat: '#1a0a0e', pack: '#c8102e' } },
      { name: 'Howl Punk', shop: 1200, costume: 'wolf', c: { top: '#2a2a2e', top2: '#ff2a2a', pants: '#18181c', shoes: '#d23a3a', hair: '#1d1a1c', hat: '#1d1a1c', pack: '#2a2a2e' } },
      { name: 'Hog Wild', shop: 1200, costume: 'pig', c: { top: '#efe6c8', top2: '#efe6c8', pants: '#3f4a2a', shoes: '#1d1d1d', hair: '#f0a3ad', hat: '#f0a3ad', pack: '#9fd0c4' } },
    ],
  },
  waylon: {
    name: 'Waylon',
    title: 'The Dino Explorer',
    bio: 'Brave enough for Haunt Hollow after dark. Carries a dinosaur backpack full of snacks and secrets.',
    emote: 'Dino Stomp',
    outfits: [
      { name: 'Dino Explorer', level: 1, c: { top: '#3fb24a', top2: '#ffe066', pants: '#3f7bff', shoes: '#8a5a33', hair: '#3b2616', hat: '#3fb24a', pack: '#3fb24a' } },
      { name: 'Clubhouse Captain', level: 4, c: { top: '#e8453c', top2: '#ffffff', pants: '#1f3f7a', shoes: '#ffffff', hair: '#3b2616', hat: '#ffcf3f', pack: '#e8453c' } },
      { name: 'Golden Ace', level: 6, c: { top: '#ffcf3f', top2: '#ffffff', pants: '#8a5a1a', shoes: '#ffcf3f', hair: '#3b2616', hat: '#ffae1a', pack: '#ff7a1a' } },
      { name: 'Bolt Buddy', pass: 17, c: { top: '#39f0ff', top2: '#1d2a3a', pants: '#4a5566', shoes: '#1d2a3a', hair: '#3b2616', hat: '#39f0ff', pack: '#ff8a3d' } },
      { name: 'Blood Slimer', shop: 1500, costume: 'slimer', c: { top: '#2a0d12', top2: '#c8102e', pants: '#1a0a0e', shoes: '#120608', hair: '#1a0a0e', hat: '#1a0a0e', pack: '#c8102e' } },
      { name: 'Howl Punk', shop: 1200, costume: 'wolf', c: { top: '#2a2a2e', top2: '#ff2a2a', pants: '#18181c', shoes: '#d23a3a', hair: '#1d1a1c', hat: '#1d1a1c', pack: '#2a2a2e' } },
      { name: 'Hog Wild', shop: 1200, costume: 'pig', c: { top: '#efe6c8', top2: '#efe6c8', pants: '#3f4a2a', shoes: '#1d1d1d', hair: '#f0a3ad', hat: '#f0a3ad', pack: '#9fd0c4' } },
    ],
  },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Speckled "heather" knit for athletic tees (multiplies the outfit colour). */
let heatherTex = null;
function heather() {
  if (heatherTex) return heatherTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const v = Math.round(232 + rnd() * 23);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1 + Math.floor(rnd() * 3), 1);
  }
  heatherTex = new THREE.CanvasTexture(c);
  heatherTex.wrapS = heatherTex.wrapT = THREE.RepeatWrapping;
  heatherTex.repeat.set(5, 5);
  heatherTex.colorSpace = THREE.SRGBColorSpace;
  return heatherTex;
}

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

/** Glider canopy designs (see GLIDERS in core/season.js). */
function gliderTexture(style, pal) {
  const G = {
    pickle: ['#5bbf3a', '#3f9a2a', 'dots'], storm: ['#6a3fd0', '#39f0ff', 'bolt'], night: ['#1d2a5a', '#ffe45c', 'stars'],
    crankbolt: ['#ff8a3d', '#4a5566', 'stripes'], golden: ['#ffcf3f', '#ffae1a', 'stripes'], champion: [null, null, 'rainbow'],
    treasure: ['#e8d3a0', '#b0472f', 'map'], medal: ['#1d2a5a', '#ffcf3f', 'medals'], bats: ['#1d1430', '#ff8a1a', 'bats'],
  }[style];
  if (!G) return stripeTexture(pal.top, pal.top2);
  const [a, b, pat] = G;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d');
  if (pat === 'rainbow') {
    ['#ff5c7a', '#ffcf3f', '#7ed957', '#39f0ff', '#b35cff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 6.4, 256, 6.4); });
  } else {
    g.fillStyle = a;
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = b;
    for (let i = 0; i < 16; i++) {
      const x = i * 16 + 8;
      if (pat === 'dots') { g.beginPath(); g.arc(x, 10 + (i % 2) * 12, 4, 0, 7); g.fill(); }
      else if (pat === 'stars') { g.font = '12px sans-serif'; g.fillText('★', x - 5, 14 + (i % 2) * 12); }
      else if (pat === 'map') { g.fillRect(x - 6, 15, 4, 2); g.fillRect(x + 1, 15, 4, 2); if (i % 4 === 3) { g.lineWidth = 2; g.strokeStyle = b; g.beginPath(); g.moveTo(x - 4, 8); g.lineTo(x + 4, 24); g.moveTo(x + 4, 8); g.lineTo(x - 4, 24); g.stroke(); } }
      else if (pat === 'bats') { const yy = 12 + (i % 2) * 9; g.beginPath(); g.moveTo(x - 7, yy - 3); g.quadraticCurveTo(x - 3, yy, x, yy + 3); g.quadraticCurveTo(x + 3, yy, x + 7, yy - 3); g.lineTo(x + 3, yy + 1); g.lineTo(x, yy - 1); g.lineTo(x - 3, yy + 1); g.closePath(); g.fill(); }
      else if (pat === 'medals') { g.beginPath(); g.arc(x, 16, 6, 0, 7); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(x, 16, 3, 0, 7); g.fill(); g.fillStyle = b; }
      else if (pat === 'bolt') { g.beginPath(); g.moveTo(x, 3); g.lineTo(x - 4, 16); g.lineTo(x + 1, 16); g.lineTo(x - 2, 29); g.lineTo(x + 5, 13); g.lineTo(x, 13); g.closePath(); g.fill(); }
      else if (i % 2) g.fillRect(i * 16, 0, 16, 32);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CharacterModel {
  /** cos: equipped cosmetics { emote, glider } (defaults: signature emote, outfit-striped glider). */
  constructor(charId, outfit = 0, skin = 0, cos = {}) {
    this.charId = charId;
    this.emoteId = cos.emote || 'sig';
    // pickaxe / backbling / wrap ids (see core/cosmetics.js); unknown ids (e.g. from a newer client) fall back to defaults
    this.cos = { ...cos };
    for (const [kind, list] of Object.entries(LOCKER)) if (!list[this.cos[kind]]) this.cos[kind] = DEFAULTS[kind];
    cos = this.cos;
    const def = CHARACTERS[charId];
    const pal = def.outfits[outfit]?.c || def.outfits[0].c;
    this.mats = [];
    const M = (color, emissive = '#000000', map = null) => {
      const mm = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive, map });
      this.mats.push(mm);
      return mm;
    };
    const skinM = M(SKIN_TONES[skin] || SKIN_TONES[0]);
    const colton = charId === 'colton';
    const top = M(pal.top, '#000000', pal.heather ? heather() : null), top2 = M(pal.top2), pants = M(pal.pants), shoes = M(pal.shoes), hair = M(pal.hair), hat = M(pal.hat), pack = M(pal.pack);
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
    const pelvis = mesh(geo('pelvis', () => new THREE.BoxGeometry(0.42, 0.2, 0.26)), pants, 0, 0, 0);
    if (colton) pelvis.scale.set(1.14, 1, 1.1);
    this.hips.add(pelvis);

    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set((colton ? 0.135 : 0.12) * s, -0.02, 0);
      const legM = mesh(geo('leg', () => new THREE.CapsuleGeometry(0.1, 0.5, 4, 8)), pants, 0, -0.36, 0);
      if (colton) legM.scale.set(1.18, 1, 1.18);
      leg.add(legM);
      leg.add(mesh(geo('shoe', () => new THREE.BoxGeometry(0.2, 0.14, 0.32)), shoes, 0, -0.72, 0.05));
      this.hips.add(leg);
      this.legs.push(leg);
    }

    // torso
    this.spine = new THREE.Group();
    this.spine.position.y = 0.05;
    this.hips.add(this.spine);
    const torso = mesh(geo('torso', () => new THREE.CapsuleGeometry(0.24, 0.28, 4, 10)), top, 0, 0.3, 0);
    torso.scale.set(colton ? 1.24 : 1.05, 1, colton ? 0.95 : 0.8); // Colton: a sturdier build
    this.spine.add(torso);
    // outfit detail
    if (colton) {
      // athletic tee: a crew-neck collar and a small wrench badge on the chest
      const collar = mesh(geo('collar', () => new THREE.TorusGeometry(0.13, 0.025, 6, 16)), top2, 0, 0.6, 0.02);
      collar.rotation.x = Math.PI / 2;
      collar.scale.set(1.1, 1, 0.9);
      this.spine.add(collar);
      const badge = new THREE.Group();
      badge.position.set(0.12, 0.44, 0.225);
      badge.rotation.z = -0.6;
      badge.add(mesh(geo('badgeBar', () => new THREE.BoxGeometry(0.018, 0.075, 0.012)), top2, 0, 0, 0));
      badge.add(mesh(geo('badgeHead', () => new THREE.TorusGeometry(0.018, 0.007, 4, 8, Math.PI * 1.5)), top2, 0, 0.045, 0));
      this.spine.add(badge);
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
    const packFrom = this.spine.children.length;
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

    // an equipped back bling (made in Blender) replaces the outfit's backpack
    this._packParts = this.spine.children.slice(packFrom);
    if (cos.backbling && cos.backbling !== 'outfit') {
      for (const o of this.spine.children.slice(packFrom)) o.visible = false;
      this.bling = cosmeticModel('backbling', cos.backbling);
      this.bling.position.set(0, 0.2, -0.17);
      this.spine.add(this.bling);
    }

    // head
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    this.spine.add(this.head);
    const headM = mesh(geo('head', () => new THREE.SphereGeometry(0.28, 16, 12)), skinM, 0, 0.24, 0);
    if (colton) headM.scale.set(1.1, 1.0, 1.02); // a round, full face
    this.head.add(headM);
    if (colton) {
      // Colton: ears that show under the crew cut, straight brows, brown eyes, rosy cheeks, a calm little smile
      for (const s of [-1, 1]) {
        const ear = mesh(geo('ear', () => new THREE.SphereGeometry(0.06, 8, 6)), skinM, 0.305 * s, 0.22, 0);
        ear.scale.set(0.55, 1, 0.8);
        this.head.add(ear);
        this.head.add(mesh(geo('eyeC', () => new THREE.SphereGeometry(0.05, 8, 6)), M('#3b2616'), 0.1 * s, 0.265, 0.245));
        this.head.add(mesh(geo('glint', () => new THREE.SphereGeometry(0.018, 6, 4)), white, 0.1 * s + 0.018, 0.285, 0.29));
        const lid = mesh(geo('lid', () => new THREE.SphereGeometry(0.056, 8, 6, 0, Math.PI * 2, 0, Math.PI / 3.4)), skinM, 0.1 * s, 0.27, 0.243);
        lid.rotation.x = 0.2; // relaxed, slightly heavy eyelids
        this.head.add(lid);
        const brow = mesh(geo('brow', () => new THREE.BoxGeometry(0.09, 0.018, 0.02)), hair, 0.1 * s, 0.34, 0.25);
        brow.rotation.z = -0.08 * s;
        this.head.add(brow);
        const cheek = mesh(geo('cheekC', () => new THREE.SphereGeometry(0.065, 8, 6)), M('#f29a9a'), 0.19 * s, 0.17, 0.2);
        cheek.scale.set(1, 0.8, 0.5);
        this.head.add(cheek);
      }
      // calm, closed lips
      const lips = mesh(geo('lips', () => new THREE.SphereGeometry(0.04, 10, 6)), M('#c9716f'), 0, 0.13, 0.268);
      lips.scale.set(1.35, 0.42, 0.45);
      this.head.add(lips);
    }
    for (const s of colton ? [] : [-1, 1]) {
      this.head.add(mesh(geo('eye', () => new THREE.SphereGeometry(0.055, 8, 6)), black, 0.1 * s, 0.27, 0.24));
      this.head.add(mesh(geo('glint', () => new THREE.SphereGeometry(0.018, 6, 4)), white, 0.1 * s + 0.02, 0.29, 0.29));
      this.head.add(mesh(geo('cheek', () => new THREE.SphereGeometry(0.04, 6, 4)), M('#ff9a9a'), 0.17 * s, 0.18, 0.21));
    }
    if (!colton) {
      const smile = mesh(geo('smile', () => new THREE.TorusGeometry(0.07, 0.015, 4, 10, Math.PI)), black, 0, 0.16, 0.26);
      smile.rotation.z = Math.PI;
      this.head.add(smile);
    }
    // hair / hats
    const cap = mesh(geo('haircap', () => new THREE.SphereGeometry(0.295, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1)), hair, 0, 0.27, -0.02);
    this.head.add(cap);
    if (colton) {
      // short crew cut: close-cropped on top with a straight front hairline, faded sides
      cap.scale.set(1.12, 0.92, 1.07);
      cap.position.set(0, 0.275, -0.015);
      cap.rotation.x = -0.42; // hairline sits high on the forehead, low at the back
      // the faded sides wrap the sides and back only (the forehead stays clear)
      const sides = mesh(geo('fade', () => new THREE.SphereGeometry(0.3, 16, 8, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI / 3.2, Math.PI / 7)), hair, 0, 0.245, -0.02);
      sides.scale.set(1.04, 1, 1.0);
      sides.material = M(pal.hair);
      sides.material.opacity = 0.75;
      sides.material.transparent = true;
      this.head.add(sides);
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
      arm.position.set((colton ? 0.36 : 0.32) * s, 0.5, 0);
      if (colton) {
        // short sleeves: tee sleeve, then bare arm
        arm.add(mesh(geo('sleeve', () => new THREE.CapsuleGeometry(0.095, 0.12, 4, 8)), top, 0, -0.1, 0));
        arm.add(mesh(geo('forearm', () => new THREE.CapsuleGeometry(0.082, 0.28, 4, 8)), skinM, 0, -0.32, 0));
      } else arm.add(mesh(geo('arm', () => new THREE.CapsuleGeometry(0.075, 0.38, 4, 8)), top, 0, -0.25, 0));
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
    const canopyTex = gliderTexture(cos.glider, pal);
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

    const costume = (def.outfits[outfit] || def.outfits[0]).costume;
    if (costume === 'slimer') this._slimer(M, mesh, skinM);
    else if (costume === 'wolf') this._wolf(M, mesh, skinM);
    else if (costume === 'pig') this._pig(M, mesh, skinM);

    this.held = null;
    this.heldKey = '';
    this.phase = 0;
    this.flash = 0;
    this.swing = 0;
    this.kick = 0;
  }

  /**
   * The Blood Slimer costume (from a fan drawing): a tall, shaggy, slimy shadow
   * with a round grey head, two slit eyes, a wide grin, claws and red drips.
   */
  _slimer(M, mesh, skinM) {
    skinM.color.set('#2a1a20'); // no skin showing: dark slimy hands
    for (const o of this.head.children) o.visible = false;
    if (this.pony) this.pony.visible = false;
    const grey = M('#8d8a93'), dark = M('#120608'), slime = M('#c8102e', '#3a0008'), shag = M('#1d0a10');
    // a long neck and a big round head
    this.spine.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.34, 10), shag, 0, 0.66, 0));
    this.head.position.y = 0.8;
    const head = mesh(new THREE.SphereGeometry(0.31, 18, 14), grey, 0, 0.28, 0);
    this.head.add(head);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), dark, 0.09 * s, 0.33, 0.27);
      eye.rotation.x = -0.25;
      this.head.add(eye);
    }
    const grin = mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16, Math.PI), dark, 0, 0.2, 0.27);
    grin.rotation.z = Math.PI;
    grin.rotation.x = -0.35;
    this.head.add(grin);
    // shaggy strands down the body, and slime drips
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const st = mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), shag, Math.cos(a) * 0.26, 0.18, Math.sin(a) * 0.22);
      st.rotation.set(Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15);
      this.spine.add(st);
    }
    for (const [x, y, z] of [[0.15, 0.05, 0.2], [-0.12, 0.12, 0.21], [0.02, -0.02, 0.22], [-0.2, 0.0, -0.15], [0.18, 0.08, -0.17]]) {
      const d = mesh(new THREE.SphereGeometry(0.045, 8, 6), slime, x, y, z);
      d.scale.y = 1.8;
      this.spine.add(d);
    }
    // claws
    for (const arm of this.arms) {
      for (let i = -1; i <= 1; i++) {
        const c = mesh(new THREE.ConeGeometry(0.025, 0.14, 5), M('#e8e2d6'), i * 0.05, -0.62, 0.03);
        c.rotation.x = Math.PI;
        arm.add(c);
      }
    }
    // taller and lankier
    this.body.scale.set(0.95, 1.15, 0.95);
  }

  /** Costumes swap the kid's head for a Blender-made one (and drop the outfit backpack). */
  _costumeHead(id) {
    const kid = [...this.head.children];
    if (!this.bling) for (const o of this._packParts || []) o.visible = false;
    // the kid's own head only goes away once the costume head has really loaded (never a headless kid)
    const h = cosmeticModel('costume', id, () => {
      for (const o of kid) o.visible = false;
      if (this.pony) this.pony.visible = false;
    });
    h.position.y = 0.24;
    this.head.add(h);
    this.costumeHead = h;
  }

  /** Howl Punk (skin drop): a punk werewolf in a studded vest with glowing red stripes, a muzzle cage and a bushy tail. */
  _wolf(M, mesh, skinM) {
    skinM.color.set('#2a2426'); // furry hands
    this._costumeHead('wolfhead');
    const glow = M('#ff2a2a', '#c00000'), steel = M('#a9b0bb'), red = M('#c8102e');
    // a glowing red X across the chest and stripes down the arms
    for (const s of [-1, 1]) {
      const x = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), glow, 0, 0.32, 0.215);
      x.rotation.z = 0.7 * s;
      this.spine.add(x);
    }
    for (const arm of this.arms) for (const y of [-0.15, -0.3]) arm.add(mesh(new THREE.BoxGeometry(0.17, 0.035, 0.17), glow, 0, y, 0));
    // studded collar
    const col = mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 16), M('#1d1a1c'), 0, 0.6, 0);
    col.rotation.x = Math.PI / 2;
    this.spine.add(col);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const st = mesh(new THREE.ConeGeometry(0.025, 0.08, 5), steel, Math.cos(a) * 0.18, 0.6, Math.sin(a) * 0.18);
      st.rotation.set(Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2);
      this.spine.add(st);
    }
    // a red studded belt with a hanging chain
    const belt = mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 18), red, 0, 0.06, 0);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 0.7, 1);
    this.hips.add(belt);
    for (let i = 0; i < 4; i++) {
      const l = mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), steel, 0.2, -0.04 - i * 0.05, 0.1);
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      this.hips.add(l);
    }
    // claws and the tail
    for (const arm of this.arms) for (let i = -1; i <= 1; i++) {
      const c = mesh(new THREE.ConeGeometry(0.02, 0.1, 5), steel, i * 0.045, -0.6, 0.03);
      c.rotation.x = Math.PI;
      arm.add(c);
    }
    const tail = cosmeticModel('costume', 'wolftail');
    tail.position.set(0, 0.0, -0.12);
    this.hips.add(tail);
  }

  /** Hog Wild (skin drop): a grumpy pig butcher in an apron with a sausage chain and ketchup splats. */
  _pig(M, mesh, skinM) {
    skinM.color.set('#f0a3ad');
    this._costumeHead('pighead');
    const apron = M('#9fd0c4'), ketchup = M('#c8102e'), sausage = M('#c0603a'), steel = M('#a9b0bb'), black = M('#1d1d1d');
    // the apron: a bib on the chest and a skirt over the legs
    this.spine.add(mesh(new THREE.BoxGeometry(0.36, 0.42, 0.03), apron, 0, 0.3, 0.205));
    this.hips.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.03), apron, 0, -0.2, 0.16));
    this.hips.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.035), apron, 0.08, -0.08, 0.175)); // pocket
    for (const [x, y, z, sz] of [[-0.1, 0.36, 0.222, 0.035], [0.08, 0.22, 0.222, 0.025], [-0.12, -0.3, 0.178, 0.04], [0.14, -0.34, 0.178, 0.03], [0.02, -0.12, 0.178, 0.02]]) {
      const k = mesh(new THREE.SphereGeometry(sz, 8, 6), ketchup, x, y, z);
      k.scale.z = 0.3;
      (y > 0 ? this.spine : this.hips).add(k);
    }
    // a sausage chain over one shoulder, with a steel chain beside it
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const sg = mesh(new THREE.CapsuleGeometry(0.035, 0.06, 4, 8), sausage, 0.2 - t * 0.38, 0.58 - t * 0.5, 0.21);
      sg.rotation.z = 0.9;
      this.spine.add(sg);
      const l = mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), steel, 0.24 - t * 0.38, 0.56 - t * 0.5, 0.215);
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      this.spine.add(l);
    }
    // black work gloves and a belt strap
    for (const arm of this.arms) arm.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), black, 0, -0.5, 0));
    const strap = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 18), black, 0, 0.08, 0);
    strap.rotation.x = Math.PI / 2;
    strap.scale.set(1, 0.7, 1);
    this.hips.add(strap);
    this.body.scale.set(1.08, 1.05, 1.08); // a big, sturdy butcher
  }

  setHeld(key, rarity, mods) {
    const k = `${key}|${rarity | 0}|${(mods || []).join(',')}`; // rebuild when the gun, its rarity or attachments change
    if (k === this.heldKey) return;
    this.heldKey = k;
    if (this.held) this.hand.remove(this.held);
    this.held = null;
    if (!key || key === 'none') return;
    const cos = this.cos || {};
    if (key === 'pickaxe' && cos.pickaxe && cos.pickaxe !== 'default') this.held = cosmeticModel('pickaxe', cos.pickaxe);
    else {
      this.held = weaponModel(key, rarity, mods);
      if (WEAPONS[key] && cos.wrap && cos.wrap !== 'none') applyWrap(this.held, cos.wrap, RARITIES[rarity | 0]?.color);
    }
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
    if (st.downed) {
      // knocked down: crawling on hands and knees
      this.body.rotation.x = 1.15;
      this.body.position.y = 0.3;
      this.hips.position.y = 0.55;
      const c = Math.sin(this.phase * 0.8);
      armL.rotation.set(-2.2 + c * 0.5, 0, 0.3);
      armR.rotation.set(-2.2 - c * 0.5, 0, -0.3);
      legL.rotation.set(-0.4 + c * 0.4, 0, 0);
      legR.rotation.set(-0.4 - c * 0.4, 0, 0);
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
    const e = this.emoteId;
    if (e === 'wave') {
      const w = Math.sin(t * 7);
      armL.rotation.set(-2.8, 0, 0.5 + w * 0.35);
      armR.rotation.set(-2.8, 0, -0.5 + w * 0.35);
      this.hips.position.y = 0.8 + Math.abs(Math.sin(t * 3.5)) * 0.04;
      this.head.rotation.z = w * 0.1;
      return;
    }
    if (e === 'hop') {
      const b = Math.sin(t * 6);
      this.body.position.x = b * 0.18;
      this.hips.position.y = 0.8 + Math.abs(Math.cos(t * 6)) * 0.28;
      legL.rotation.set(-0.5 * Math.abs(b), 0, 0.2);
      legR.rotation.set(-0.5 * Math.abs(b), 0, -0.2);
      armL.rotation.set(-1.6, 0, 0.6 + b * 0.3);
      armR.rotation.set(-1.6, 0, -0.6 + b * 0.3);
      return;
    }
    if (e === 'robo') {
      const step = Math.floor(t * 4) % 4;
      const k = [0.6, 0, -0.6, 0][step];
      this.body.rotation.y = k * 0.5;
      armL.rotation.set(-1.57, 0, step % 2 ? 0.2 : 1.2);
      armR.rotation.set(-1.57, 0, step % 2 ? -1.2 : -0.2);
      legL.rotation.x = step === 0 ? -0.5 : 0;
      legR.rotation.x = step === 2 ? -0.5 : 0;
      this.head.rotation.y = -k * 0.6;
      return;
    }
    if (e === 'guitar') {
      const s = Math.sin(t * 14);
      this.spine.rotation.x = -0.25;
      armL.rotation.set(-1.3, 0.8, 0.4);
      armR.rotation.set(-0.8 + s * 0.35, -0.5, -0.3);
      this.head.rotation.x = Math.sin(t * 7) * 0.25;
      legL.rotation.set(-0.3, 0, 0.3);
      legR.rotation.set(0.2, 0, -0.3);
      this.hips.position.y = 0.72;
      return;
    }
    if (e === 'lap') {
      const r = Math.sin(t * 12);
      armL.rotation.set(-3.0, 0, 0.3 + r * 0.1);
      armR.rotation.set(-3.0, 0, -0.3 - r * 0.1);
      legL.rotation.x = r * 0.9;
      legR.rotation.x = -r * 0.9;
      this.hips.position.y = 0.8 + Math.abs(r) * 0.08;
      this.body.rotation.y = t * 1.5;
      return;
    }
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
