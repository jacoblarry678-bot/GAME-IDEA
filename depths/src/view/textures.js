/**
 * Procedural textures. Every surface is painted into a canvas at load time
 * (colour + height), and a normal map is derived from the height with a
 * Sobel filter. Each texture covers one metre unless noted, so UVs in metres
 * tile consistently across walls of any size.
 */
import * as THREE from 'three';

let SIZE = 512;
export function setTextureSize(s) { SIZE = s; }

// ---------------------------------------------------------------- noise
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const P = period || 1e9;
  const m = (a) => ((a % P) + P) % P;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Tileable fBm over [0,1)^2 with base frequency f. */
function fbm(u, v, f, oct, s) {
  let amp = 0.5, sum = 0, norm = 0, fr = f;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * fr, v * fr, s + o * 17, fr); norm += amp; amp *= 0.5; fr *= 2; }
  return sum / norm;
}

function make(fn, opts = {}) {
  const N = opts.size || SIZE;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const height = new Float32Array(N * N);
  const col = [0, 0, 0];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const h = fn(u, v, col, x, y, N);
      const i = (y * N + x);
      img.data[i * 4] = clamp255(col[0]); img.data[i * 4 + 1] = clamp255(col[1]); img.data[i * 4 + 2] = clamp255(col[2]); img.data[i * 4 + 3] = opts.alpha ? clamp255(col[3] ?? 255) : 255;
      height[i] = h;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (opts.post) opts.post(ctx, N);
  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const normalMap = opts.noNormal ? null : normalFrom(height, N, opts.bump ?? 2.0);
  return { map, normalMap, canvas: cv };
}
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

function normalFrom(h, N, strength) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mix(a, b, t) { return a + (b - a) * t; }
function setRGB(c, r, g, b) { c[0] = r; c[1] = g; c[2] = b; }

// ---------------------------------------------------------------- generators
const GEN = {
  // the yellow rooms: vertical stripes, a faint repeating motif, age staining near the floor
  wallpaper: () => make((u, v, c) => {
    const stripe = Math.sin(u * Math.PI * 2 * 6) * 0.5 + 0.5;
    const fine = Math.sin(u * Math.PI * 2 * 24) * 0.5 + 0.5;
    const motifU = (u * 6) % 1, motifV = (v * 4) % 1;
    const dm = Math.abs(motifU - 0.5) + Math.abs(motifV - 0.5);
    const motif = dm < 0.22 && dm > 0.17 ? 1 : 0;
    const n = fbm(u, v, 6, 5, 3);
    const stain = Math.max(0, fbm(u, v, 3, 4, 9) - 0.55) * 2.2;
    const base = [196, 176, 92];
    const k = 0.94 + stripe * 0.05 + fine * 0.02 - motif * 0.05 + (n - 0.5) * 0.08 - stain * 0.18;
    setRGB(c, base[0] * k, base[1] * k, base[2] * k * (1 - stain * 0.15));
    return stripe * 0.15 + n * 0.4 + motif * 0.3;
  }, { bump: 1.2 }),
  carpet: () => make((u, v, c) => {
    const n = fbm(u, v, 32, 3, 5), m = fbm(u, v, 4, 4, 8);
    const damp = Math.max(0, fbm(u, v, 2, 4, 21) - 0.52) * 2.5;
    const k = 0.84 + n * 0.16 + (m - 0.5) * 0.16 - damp * 0.22;
    setRGB(c, 122 * k, 104 * k, 70 * k);
    return n * 0.5 + m * 0.2;
  }, { bump: 1.2 }),
  ceilingTile: () => make((u, v, c) => {
    // texture covers 1.2 m: two 0.6 m tiles
    const gu = (u * 2) % 1, gv = (v * 2) % 1;
    const edge = Math.min(gu, 1 - gu, gv, 1 - gv);
    const grid = edge < 0.015 ? 1 : 0;
    const speck = hash(Math.floor(u * 256), Math.floor(v * 256), 4) > 0.93 ? 1 : 0;
    const stain = Math.max(0, fbm(u, v, 3, 4, 33) - 0.6) * 2;
    const k = grid ? 0.55 : 0.9 - speck * 0.12 - stain * 0.3;
    setRGB(c, 214 * k, 208 * k, 186 * k);
    return grid ? 0 : 0.6 - speck * 0.3;
  }, { bump: 2.5 }),
  concrete: () => make((u, v, c) => {
    const n = fbm(u, v, 8, 5, 41), p = hash(Math.floor(u * 300), Math.floor(v * 300), 2);
    const k = 0.62 + n * 0.3 - (p > 0.97 ? 0.15 : 0);
    setRGB(c, 150 * k, 150 * k, 146 * k);
    return n;
  }, { bump: 1.5 }),
  paintBlock: () => make((u, v, c) => {
    // concrete block wall, 0.4 x 0.2 m blocks, painted pale green-grey
    const bu = u * 2.5, bv = v * 5;
    const row = Math.floor(bv);
    const bx = (bu + (row % 2) * 0.5) % 1, by = bv % 1;
    const mortar = bx < 0.025 || by < 0.05;
    const n = fbm(u, v, 12, 4, 52);
    const k = mortar ? 0.72 : 0.92 + (n - 0.5) * 0.1;
    setRGB(c, 178 * k, 186 * k, 172 * k);
    return mortar ? 0 : 0.5 + n * 0.2;
  }, { bump: 2.5 }),
  metal: () => make((u, v, c) => {
    const brush = fbm(u * 0.05, v, 64, 2, 61);
    const n = fbm(u, v, 6, 3, 62);
    const k = 0.6 + brush * 0.2 + n * 0.1;
    setRGB(c, 160 * k, 164 * k, 170 * k);
    return brush * 0.3;
  }, { bump: 0.6 }),
  diamondPlate: () => make((u, v, c) => {
    const gu = (u * 8) % 1, gv = (v * 8) % 1;
    const rot = Math.floor(u * 8 + v * 8) % 2;
    const a = rot ? Math.abs(gu - gv) : Math.abs(gu + gv - 1);
    const ridge = a < 0.12 && Math.abs(gu - 0.5) < 0.35 && Math.abs(gv - 0.5) < 0.35 ? 1 : 0;
    const n = fbm(u, v, 8, 3, 63);
    const k = 0.55 + ridge * 0.15 + n * 0.15;
    setRGB(c, 150 * k, 152 * k, 156 * k);
    return ridge;
  }, { bump: 3 }),
  fabric: () => make((u, v, c) => {
    const w = (Math.sin(u * Math.PI * 2 * 128) * Math.sin(v * Math.PI * 2 * 128)) * 0.5 + 0.5;
    const n = fbm(u, v, 16, 3, 71);
    const k = 0.8 + w * 0.12 + (n - 0.5) * 0.12;
    setRGB(c, 205 * k, 205 * k, 205 * k);
    return w * 0.5;
  }, { bump: 1.5 }),
  laminate: () => make((u, v, c) => {
    const g = fbm(u * 0.2, v * 3, 8, 4, 81);
    const ring = Math.sin((u * 3 + g * 2) * Math.PI * 6) * 0.5 + 0.5;
    const k = 0.72 + ring * 0.12 + g * 0.1;
    setRGB(c, 176 * k, 140 * k, 98 * k);
    return ring * 0.2;
  }, { bump: 0.5 }),
  plastic: () => make((u, v, c) => {
    const n = fbm(u, v, 10, 3, 91);
    const k = 0.86 + n * 0.1;
    setRGB(c, 222 * k, 216 * k, 200 * k);
    return n * 0.2;
  }, { bump: 0.3 }),
  paper: () => make((u, v, c) => {
    const n = fbm(u, v, 20, 3, 93);
    const line = (v * 24) % 1 < 0.06 && u > 0.08 && u < 0.92 && v > 0.2 ? 1 : 0;
    const k = 0.93 + n * 0.05 - line * 0.35;
    setRGB(c, 236 * k, 230 * k, 214 * k);
    return 0;
  }, { noNormal: true, size: 128 }),
  // mall
  terrazzo: () => make((u, v, c) => {
    const n = fbm(u, v, 6, 3, 101);
    const chip = hash(Math.floor(u * 160), Math.floor(v * 160), 5);
    const chipCol = hash(Math.floor(u * 160), Math.floor(v * 160), 6);
    let r = 214, g = 206, b = 196;
    if (chip > 0.86) { if (chipCol < 0.33) { r = 120; g = 110; b = 100; } else if (chipCol < 0.66) { r = 190; g = 140; b = 130; } else { r = 150; g = 160; b = 170; } }
    const k = 0.88 + n * 0.1;
    setRGB(c, r * k, g * k, b * k);
    return 0.3 + n * 0.1;
  }, { bump: 0.6 }),
  pastel: () => make((u, v, c) => {
    const n = fbm(u, v, 5, 4, 111);
    const k = 0.9 + n * 0.08;
    setRGB(c, 222 * k, 196 * k, 200 * k);
    return n * 0.2;
  }, { bump: 0.5 }),
  shopTile: () => make((u, v, c) => {
    const gu = (u * 2) % 1, gv = (v * 2) % 1;
    const grout = gu < 0.02 || gv < 0.02;
    const n = fbm(u, v, 8, 3, 113);
    const k = grout ? 0.6 : 0.92 + n * 0.06;
    setRGB(c, 226 * k, 224 * k, 218 * k);
    return grout ? 0 : 0.6;
  }, { bump: 2 }),
  // pool
  poolTile: () => make((u, v, c) => {
    const gu = (u * 8) % 1, gv = (v * 8) % 1;
    const grout = gu < 0.06 || gv < 0.06;
    const t = hash(Math.floor(u * 8), Math.floor(v * 8), 7);
    const n = fbm(u, v, 6, 3, 121);
    const k = grout ? 0.85 : 0.9 + t * 0.08 + (n - 0.5) * 0.05;
    if (grout) setRGB(c, 222 * k, 226 * k, 220 * k); else setRGB(c, 150 * k, 196 * k, 214 * k);
    return grout ? 0 : 0.7;
  }, { bump: 2.5 }),
  whiteTile: () => make((u, v, c) => {
    const gu = (u * 6.66) % 1, gv = (v * 6.66) % 1;
    const grout = gu < 0.05 || gv < 0.05;
    const n = fbm(u, v, 6, 3, 123);
    const water = Math.max(0, fbm(u, v, 3, 4, 124) - 0.58) * 2;
    const k = grout ? 0.78 : 0.95 + (n - 0.5) * 0.05 - water * 0.1;
    setRGB(c, 236 * k, 240 * k, 236 * k);
    return grout ? 0 : 0.7;
  }, { bump: 2.5 }),
  // apartments
  veneer: () => make((u, v, c) => {
    const g = fbm(u * 0.15, v * 2, 10, 4, 131);
    const k = 0.62 + g * 0.25;
    setRGB(c, 132 * k, 92 * k, 58 * k);
    return g * 0.3;
  }, { bump: 0.6 }),
  plaster: () => make((u, v, c) => {
    const n = fbm(u, v, 7, 5, 141);
    const crack = Math.abs(fbm(u, v, 3, 3, 142) - 0.5) < 0.006 ? 1 : 0;
    const k = 0.9 + n * 0.08 - crack * 0.25;
    setRGB(c, 226 * k, 212 * k, 182 * k);
    return n * 0.4 - crack;
  }, { bump: 1.2 }),
  floral: () => make((u, v, c) => {
    const fu = (u * 5) % 1 - 0.5, fv = (v * 5) % 1 - 0.5;
    const r = Math.hypot(fu, fv), a = Math.atan2(fv, fu);
    const petal = r < 0.18 + Math.cos(a * 5) * 0.06 && r > 0.04 ? 1 : 0;
    const stripe = Math.sin(u * Math.PI * 2 * 10) > 0.94 ? 1 : 0;
    const n = fbm(u, v, 5, 4, 151);
    const k = 0.9 + n * 0.08;
    if (petal) setRGB(c, 176 * k, 108 * k, 66 * k);
    else if (stripe) setRGB(c, 150 * k, 120 * k, 80 * k);
    else setRGB(c, 214 * k, 178 * k, 118 * k);
    return petal * 0.3;
  }, { bump: 0.6 }),
  woodFloor: () => make((u, v, c) => {
    const plank = Math.floor(u * 6);
    const off = hash(plank, 0, 9) * 3;
    const gap = (u * 6) % 1 < 0.03 || ((v + off) * 1.2) % 1 < 0.01;
    const g = fbm(u * 0.3, v * 3 + off, 8, 4, 161 + plank);
    const k = gap ? 0.45 : 0.62 + g * 0.3 + hash(plank, 1, 3) * 0.1;
    setRGB(c, 128 * k, 86 * k, 54 * k);
    return gap ? 0 : 0.5 + g * 0.2;
  }, { bump: 1.5 }),
  // industrial
  rust: () => make((u, v, c) => {
    const n = fbm(u, v, 6, 5, 171), r = fbm(u, v, 14, 4, 172);
    const rusty = Math.max(0, r - 0.45) * 2;
    setRGB(c, mix(110, 140, rusty) * (0.7 + n * 0.4), mix(108, 74, rusty) * (0.7 + n * 0.4), mix(104, 48, rusty) * (0.7 + n * 0.4));
    return n * 0.5 + rusty * 0.3;
  }, { bump: 2 }),
  orangePaint: () => make((u, v, c) => {
    const n = fbm(u, v, 8, 5, 181);
    const chip = fbm(u, v, 12, 4, 182) > 0.66 ? 1 : 0;
    const k = 0.8 + n * 0.2;
    if (chip) setRGB(c, 110 * k, 100 * k, 92 * k); else setRGB(c, 196 * k, 104 * k, 38 * k);
    return chip ? 0 : 0.4;
  }, { bump: 2 }),
  grating: () => make((u, v, c) => {
    const gu = (u * 20) % 1, gv = (v * 6) % 1;
    const bar = gu < 0.22 || gv < 0.12;
    if (bar) { const k = 0.6 + fbm(u, v, 10, 3, 191) * 0.3; setRGB(c, 120 * k, 118 * k, 112 * k); c[3] = 255; } else { setRGB(c, 20, 20, 20); c[3] = 0; }
    return bar ? 1 : 0;
  }, { bump: 2, alpha: true }),
  hazard: () => make((u, v, c) => {
    const s = ((u + v) * 4) % 1 < 0.5;
    const n = fbm(u, v, 10, 3, 199);
    const k = 0.8 + n * 0.2;
    if (s) setRGB(c, 222 * k, 182 * k, 40 * k); else setRGB(c, 34 * k, 32 * k, 30 * k);
    return 0.2;
  }, { bump: 0.4 }),
};

const cache = new Map();
export function tex(name) {
  if (!cache.has(name)) {
    const g = GEN[name];
    if (!g) throw new Error(`no texture ${name}`);
    cache.set(name, g());
  }
  return cache.get(name);
}
export const TEXTURE_NAMES = Object.keys(GEN);
export function clearTextures() { for (const t of cache.values()) { t.map.dispose(); if (t.normalMap) t.normalMap.dispose(); } cache.clear(); }

/** Draw a sign/label texture with text (building-directory typography). */
export function textTexture(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = opts.bg || '#1d2422';
  ctx.fillRect(0, 0, w, h);
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12); }
  ctx.fillStyle = opts.fg || '#e8e2cc';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const size = opts.size || 44;
  ctx.font = `${opts.weight || 600} ${size}px "Helvetica Neue", Arial, sans-serif`;
  const L = [].concat(lines);
  L.forEach((line, i) => {
    const y = h / 2 + (i - (L.length - 1) / 2) * size * 1.25;
    if (opts.spacing) { drawSpaced(ctx, line, w / 2, y, opts.spacing); } else ctx.fillText(line, w / 2, y);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function drawSpaced(ctx, text, cx, y, sp) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + sp);
  const total = widths.reduce((a, b) => a + b, 0) - sp;
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i]; });
  ctx.textAlign = 'center';
}

/** Generic canvas texture from a draw callback (used for clocks, decals, photo-layer art). */
export function drawTexture(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
