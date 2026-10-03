/**
 * Weapon finish materials, generated procedurally per finish kind. A finish
 * replaces the weapon's body materials (polymer / painted / wood parts) and,
 * for metal finishes, the metal parts too. Results are cached per finish.
 */
import * as THREE from 'three';
import { fbm, rand } from './textures.js';
import { COSMETICS } from '../data/cosmetics.js';

const cache = new Map();
const S = 256;

function canvas(n = S) { const c = document.createElement('canvas'); c.width = n; c.height = n; return c; }

/** Paint a finish into color (+ optional emissive / roughness / metalness) canvases. */
function paint(f, S = 256) {
  const col = canvas(S), ctx = col.getContext('2d');
  const img = ctx.createImageData(S, S);
  let emis = null, eimg = null, ectx = null;
  const needsEmissive = ['ember', 'circuit', 'obsidian'].includes(f.kind);
  if (needsEmissive) { emis = canvas(S); ectx = emis.getContext('2d'); eimg = ectx.createImageData(S, S); }
  const r = rand(f.kind.length * 97 + (f.base?.[0] || 7));
  const hex = (x, y) => { // distance to hex grid lines
    const sx = x * 10, sy = y * 10 / 0.866;
    const row = Math.floor(sy), ox = row % 2 ? 0.5 : 0;
    const fx = (sx + ox) % 1, fy = sy % 1;
    return Math.min(Math.abs(fx - 0.5), Math.abs(fy - 0.5) * 0.9);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let c = [128, 128, 128], e = [0, 0, 0];
      const n = fbm(u, v, 11, 4, 4);
      switch (f.kind) {
        case 'solid': { const k = 0.9 + n * 0.2; c = f.base.map((q) => q * k); break; }
        case 'metallic': { const k = 0.85 + n * 0.3 + Math.sin(u * 200) * 0.02; c = f.base.map((q) => q * k); break; }
        case 'camo': {
          const a = fbm(u, v, 21, 4, f.scale || 3), b = fbm(u, v, 41, 4, (f.scale || 3) * 1.6);
          c = a > 0.56 ? f.colors[1] : b > 0.6 ? f.colors[2] : a < 0.4 ? f.colors[3] : f.colors[0];
          break;
        }
        case 'stripes': {
          const w = Math.sin((u * 6 + fbm(u, v, 31, 3, 3) * 2.2) * Math.PI * 2);
          c = w > 0.55 ? f.colors[1] : w < -0.75 ? f.colors[2] : f.colors[0];
          break;
        }
        case 'digital': {
          const px = Math.floor(u * 32), py = Math.floor(v * 32);
          const a = fbm(px / 32, py / 32, 51, 3, 4);
          c = a > 0.6 ? f.colors[2] : a > 0.5 ? f.colors[1] : a < 0.38 ? f.colors[3] : f.colors[0];
          break;
        }
        case 'splinter': {
          const a = Math.floor((u * 3 + v * 7 + fbm(u, v, 61, 2, 2) * 3) * 2) % 3;
          const b = Math.floor((u * 9 - v * 4) * 1.5 + fbm(u, v, 71, 2, 2) * 2) % 4;
          c = b === 0 ? f.colors[2] : f.colors[(a + 3) % 3 === 2 ? 1 : 0];
          break;
        }
        case 'hex': { const d = hex(u, v); c = d < 0.06 ? f.line : f.base.map((q) => q * (0.9 + n * 0.2)); break; }
        case 'carbon': {
          const cx = Math.floor(u * 48), cy = Math.floor(v * 48);
          const weave = ((cx + cy) % 2) ? Math.sin((u * 48 % 1) * Math.PI) : Math.sin((v * 48 % 1) * Math.PI);
          const k = 18 + weave * 26;
          c = [k, k, k * 1.08];
          break;
        }
        case 'patina': {
          const p = fbm(u, v, 81, 5, 3);
          c = p > 0.58 ? [70, 150, 128] : [184 + n * 30, 104 + n * 20, 60 + n * 10];
          break;
        }
        case 'ember': {
          const cr = Math.abs(fbm(u, v, 91, 5, 3) - 0.5);
          const hot = cr < 0.035 ? 1 - cr / 0.035 : 0;
          c = [28 + n * 18, 24 + n * 12, 22 + n * 10];
          e = [255 * hot, 110 * hot, 20 * hot];
          break;
        }
        case 'circuit': {
          const gx = (u * 16) % 1, gy = (v * 16) % 1;
          const cell = rand(Math.floor(u * 16) * 131 + Math.floor(v * 16) * 17)();
          const trace = (cell > 0.5 ? Math.abs(gy - 0.5) < 0.06 : Math.abs(gx - 0.5) < 0.06) || (cell > 0.85 && Math.hypot(gx - 0.5, gy - 0.5) < 0.16);
          c = trace ? [176, 112, 52] : [22, 46, 36];
          e = trace && cell > 0.7 ? [40, 220, 140] : [0, 0, 0];
          break;
        }
        case 'damascus': {
          const w = Math.sin((v * 22 + Math.sin(u * 9 + fbm(u, v, 101, 3, 3) * 6) * 1.8) * Math.PI);
          const k = 110 + w * 55;
          c = [k * 0.95, k * 0.97, k];
          break;
        }
        case 'marble': {
          const vein = Math.abs(Math.sin((u * 3 + v * 2 + fbm(u, v, 111, 6, 3) * 4) * Math.PI));
          const k = 200 + n * 30 - (vein < 0.08 ? 110 * (1 - vein / 0.08) : 0);
          c = [k, k * 0.99, k * 0.97];
          break;
        }
        case 'gold': {
          const leaf = fbm(u, v, 121, 4, 6);
          c = leaf > 0.47 ? [212 + n * 30, 160 + n * 25, 60] : [24, 22, 20];
          break;
        }
        case 'obsidian': {
          const edge = Math.abs(fbm(u, v, 131, 4, 2) - 0.5);
          c = [16 + n * 10, 14 + n * 8, 20 + n * 12];
          e = edge < 0.02 ? [255, 80, 20] : [0, 0, 0];
          break;
        }
        case 'aurora': {
          const w = fbm(u, v * 0.5, 141, 4, 2);
          c = [30 + 60 * Math.sin(w * 6 + 1) ** 2, 80 + 150 * w, 110 + 120 * Math.cos(w * 4) ** 2];
          break;
        }
        case 'prism': {
          const w = fbm(u, v, 151, 4, 3) * 6 + u * 2;
          c = [128 + 120 * Math.sin(w), 128 + 120 * Math.sin(w + 2.1), 128 + 120 * Math.sin(w + 4.2)];
          break;
        }
        default: break;
      }
      const i = (y * S + x) * 4;
      img.data[i] = clamp(c[0]); img.data[i + 1] = clamp(c[1]); img.data[i + 2] = clamp(c[2]); img.data[i + 3] = 255;
      if (eimg) { eimg.data[i] = clamp(e[0]); eimg.data[i + 1] = clamp(e[1]); eimg.data[i + 2] = clamp(e[2]); eimg.data[i + 3] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (ectx) ectx.putImageData(eimg, 0, 0);
  return { col, emis };
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.anisotropy = 4;
  return t;
}

const METAL_LOOK = {
  metallic: { metalness: 0.75, roughness: 0.3 },
  patina: { metalness: 0.7, roughness: 0.35 },
  damascus: { metalness: 0.85, roughness: 0.25 },
  gold: { metalness: 0.9, roughness: 0.25 },
  obsidian: { metalness: 0.4, roughness: 0.12 },
  prism: { metalness: 0.9, roughness: 0.18 },
  aurora: { metalness: 0.6, roughness: 0.2 },
  carbon: { metalness: 0.25, roughness: 0.35 },
  marble: { metalness: 0.05, roughness: 0.3 },
};

/**
 * Weapon material set for a finish id. Shares glass/lens/reddot/brass with the
 * base set. `base` is the factory set from weaponMaterials().
 */
export function finishMaterials(base, finishId) {
  if (!finishId || finishId === 'fn_factory') return base;
  if (cache.has(finishId)) return cache.get(finishId);
  const f = COSMETICS[finishId]?.finish;
  if (!f) return base;
  const { col, emis } = paint(f);
  const look = METAL_LOOK[f.kind] || { metalness: 0.15, roughness: 0.6 };
  const body = new THREE.MeshStandardMaterial({ map: tex(col), roughness: look.roughness, metalness: look.metalness });
  if (emis) { body.emissiveMap = tex(emis); body.emissive = new THREE.Color(0xffffff); body.emissiveIntensity = 1.6; }
  const metalFinish = ['gold', 'prism', 'damascus', 'patina', 'obsidian'].includes(f.kind);
  const set = { ...base, polymer: body, tan: body, olive: body, wood: body, metal: metalFinish ? body : base.metal, finishBody: body };
  cache.set(finishId, set);
  return set;
}

const swatches = new Map();
/** Small swatch image (data URL) for UI thumbnails. */
export function finishSwatch(finishId) {
  if (swatches.has(finishId)) return swatches.get(finishId);
  const f = COSMETICS[finishId]?.finish;
  let url = null;
  if (f && f.kind !== 'factory') url = paint(f, 64).col.toDataURL();
  swatches.set(finishId, url);
  return url;
}
