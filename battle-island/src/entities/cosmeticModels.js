/**
 * Loads the Blender-made cosmetics (src/assets/cosmetics.glb and the baked
 * wrap PNGs) and hands out copies. Loading is async, so callers get a Group
 * right away that fills in as soon as the file has loaded.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import glbUrl from '../assets/cosmetics.glb?url';
import camo from '../assets/wraps/camo.png?url';
import candy from '../assets/wraps/candy.png?url';
import pickle from '../assets/wraps/pickle.png?url';
import galaxy from '../assets/wraps/galaxy.png?url';
import lava from '../assets/wraps/lava.png?url';
import gold from '../assets/wraps/gold.png?url';
import blood from '../assets/wraps/blood.png?url';

const WRAP_URLS = { camo, candy, pickle, galaxy, lava, gold, blood };
const nodes = new Map(); // 'pickaxe_pickle' → Object3D (toon-shaded)
const waiting = []; // [group, name] filled once loaded
let loaded = false;

/** Starts loading (idempotent). Resolves when every model is ready. */
export const cosmeticsReady = new Promise((resolve) => {
  new GLTFLoader().load(
    glbUrl,
    (gltf) => {
      for (const obj of gltf.scene.children) {
        // flat game look: swap PBR for Lambert (same colour and glow)
        obj.traverse((o) => {
          if (!o.isMesh) return;
          const s = o.material;
          o.material = new THREE.MeshLambertMaterial({ color: s.color, emissive: s.emissive, emissiveIntensity: s.emissiveIntensity || 1, transparent: s.opacity < 1, opacity: s.opacity });
          o.castShadow = true;
        });
        nodes.set(obj.name, obj);
      }
      loaded = true;
      for (const [g, name] of waiting.splice(0)) fill(g, name);
      resolve(true);
    },
    undefined,
    () => resolve(false), // a missing file never breaks the game: defaults stay
  );
});

export const cosmeticsLoaded = () => loaded;

function fill(g, name) {
  const src = nodes.get(name);
  if (src) g.add(src.clone());
}

/** A pickaxe or back bling model (kind 'pickaxe' | 'backbling'). */
export function cosmeticModel(kind, id) {
  const g = new THREE.Group();
  g.name = `${kind}_${id}`;
  if (loaded) fill(g, g.name);
  else waiting.push([g, g.name]);
  return g;
}

const wrapTex = new Map();
function wrapTexture(id) {
  if (!wrapTex.has(id)) {
    const t = new THREE.TextureLoader().load(WRAP_URLS[id]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    wrapTex.set(id, new THREE.MeshLambertMaterial({ map: t }));
  }
  return wrapTex.get(id);
}

/**
 * Wraps a gun model: every body part gets the wrap; the rarity-coloured trim,
 * glowing bits (sights, lenses) and attachments keep their own look.
 */
export function applyWrap(gun, id, rarityColor) {
  if (!WRAP_URLS[id] || !gun) return gun;
  const keep = new THREE.Color(rarityColor || '#000000').getHex();
  const wrap = wrapTexture(id);
  gun.traverse((o) => {
    if (!o.isMesh || o.userData.mod) return;
    const m = o.material;
    if (!m || (m.emissive && m.emissive.getHex() !== 0) || (rarityColor && m.color && m.color.getHex() === keep)) return;
    o.material = wrap;
  });
  return gun;
}
