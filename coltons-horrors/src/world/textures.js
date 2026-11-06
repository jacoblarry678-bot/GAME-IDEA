// Procedural, tileable textures (color + normal maps) generated at load time.
import * as THREE from 'three';
import { mulberry32, clamp } from '../core/util.js';

class TileNoise {
  constructor(seed) {
    const r = mulberry32(seed);
    this.v = new Float32Array(256 * 256);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }
  n(x, y, p) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const v = this.v;
    const a = v[y0 * 256 + x0], b = v[y0 * 256 + x1], c = v[y1 * 256 + x0], d = v[y1 * 256 + x1];
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  // u,v in [0,1): tileable fbm with base period p
  fbm(u, v, p, oct = 5, gain = 0.5) {
    let s = 0, amp = 1, norm = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      const per = Math.min(256, p * f);
      s += amp * this.n(u * per, v * per, per);
      norm += amp; amp *= gain; f *= 2;
    }
    return s / norm;
  }
  // cellular-ish: distance to nearest jittered point on a tileable grid
  cell(u, v, p) {
    const x = u * p, y = v * p;
    const xi = Math.floor(x), yi = Math.floor(y);
    let best = 9, second = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ((xi + i) % p + p) % p, cy = ((yi + j) % p + p) % p;
      const h = this.v[(cy * 31 + cx * 17) % 65536];
      const h2 = this.v[(cy * 57 + cx * 91 + 7) % 65536];
      const px = xi + i + h, py = yi + j + h2;
      const d = Math.hypot(px - x, py - y);
      if (d < best) { second = best; best = d; } else if (d < second) second = d;
    }
    return [best, second];
  }
}

const N = new TileNoise(1337);
const N2 = new TileNoise(4242);

let SIZE = 512;
export function setTextureSize(s) { SIZE = s; }

const cache = new Map();

function mix(a, b, t) { return a + (b - a) * t; }
function mixc(c1, c2, t) { return [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)]; }
function hex(h) { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }

function finishTexture(data, size, srgb) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// fn(u, v) -> [r, g, b, height] with rgb in 0..1 (sRGB-ish), height 0..1
function generate(key, fn, { size = SIZE, normalStrength = 3, rough = null } = {}) {
  if (cache.has(key)) return cache.get(key);
  const col = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  const rgh = rough ? new Uint8Array(size * size * 4) : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const r = fn(u, v);
      const i = y * size + x;
      col[i * 4] = clamp(r[0], 0, 1) * 255;
      col[i * 4 + 1] = clamp(r[1], 0, 1) * 255;
      col[i * 4 + 2] = clamp(r[2], 0, 1) * 255;
      col[i * 4 + 3] = 255;
      h[i] = r[3];
      if (rgh) {
        const rv = clamp(rough(u, v, r), 0, 1) * 255;
        rgh[i * 4] = rv; rgh[i * 4 + 1] = rv; rgh[i * 4 + 2] = rv; rgh[i * 4 + 3] = 255;
      }
    }
  }
  const nrm = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const t = h[((y - 1 + size) % size) * size + x], b = h[((y + 1) % size) * size + x];
      let nx = (l - r) * normalStrength, ny = (t - b) * normalStrength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
    }
  }
  const out = { map: finishTexture(col, size, true), normalMap: finishTexture(nrm, size, false), roughnessMap: rgh ? finishTexture(rgh, size, false) : null };
  cache.set(key, out);
  return out;
}

/* ---------------- ground ---------------- */

export function groundTexture(kind) {
  return generate('ground_' + kind, (u, v) => {
    const big = N.fbm(u, v, 4, 4);
    const mid = N.fbm(u + 0.31, v + 0.77, 16, 4);
    const fine = N2.fbm(u, v, 64, 3);
    const speck = N2.n(u * 256, v * 256, 256);
    if (kind === 'farm' || kind === 'forest') {
      const grass = kind === 'farm' ? hex('#3a3d1f') : hex('#26321c');
      const dry = kind === 'farm' ? hex('#5d5434') : hex('#3a3a22');
      const dirt = kind === 'farm' ? hex('#4a3826') : hex('#3a2c1e');
      const needles = hex('#4a3420');
      let c = mixc(grass, dry, clamp(mid * 1.6 - 0.5, 0, 1));
      const dirtAmt = clamp((big - 0.55) * 4, 0, 1);
      c = mixc(c, kind === 'forest' ? needles : dirt, dirtAmt);
      const shade = 0.75 + fine * 0.4 + (speck - 0.5) * 0.25;
      return [c[0] * shade, c[1] * shade, c[2] * shade, fine * 0.6 + speck * 0.4];
    }
    if (kind === 'asylum') {
      // cracked paving slabs overtaken by moss and weeds
      const su = (u * 8) % 1, sv = (v * 8) % 1;
      const seam = Math.min(su, 1 - su, sv, 1 - sv);
      const crack = Math.abs(N.fbm(u * 1.0 + 0.2, v, 12, 4) - 0.5);
      const stone = mixc(hex('#55524c'), hex('#3c3a36'), mid);
      const moss = mixc(hex('#2f3a20'), hex('#47502a'), fine);
      let c = mixc(stone, moss, clamp((big - 0.45) * 3 + (seam < 0.03 ? 0.7 : 0), 0, 1));
      let hgt = 0.6 + fine * 0.3;
      if (seam < 0.02 || crack < 0.012) { c = mixc(c, hex('#1a1a16'), 0.8); hgt = 0.1; }
      const shade = 0.8 + (speck - 0.5) * 0.3;
      return [c[0] * shade, c[1] * shade, c[2] * shade, hgt];
    }
    // junk: oily gravel and packed dirt
    const [d1] = N.cell(u, v, 48);
    const pebble = clamp(1 - d1 * 1.6, 0, 1);
    const dirt = mixc(hex('#3e352c'), hex('#2a2520'), mid);
    let c = mixc(dirt, hex('#5a554e'), pebble * 0.7);
    const oil = clamp((big - 0.62) * 5, 0, 1);
    c = mixc(c, hex('#121010'), oil * 0.7);
    const shade = 0.8 + fine * 0.3;
    return [c[0] * shade, c[1] * shade, c[2] * shade, pebble * 0.7 + fine * 0.3];
  }, { normalStrength: 4, rough: (u, v, r) => 0.9 - r[3] * 0.1 });
}

export function dirtPathTexture() {
  return generate('dirtpath', (u, v) => {
    const mid = N.fbm(u, v, 12, 4);
    const [d1] = N2.cell(u, v, 40);
    const pebble = clamp(1 - d1 * 2.0, 0, 1);
    const c = mixc(hex('#3d2f22'), hex('#5a4a38'), mid);
    const p = mixc(c, hex('#6a6258'), pebble * 0.6);
    return [p[0], p[1], p[2], mid * 0.5 + pebble * 0.5];
  }, { normalStrength: 4 });
}

/* ---------------- building materials ---------------- */

export function planksTexture(tint = '#6a5440', key = 'planks') {
  const base = hex(tint);
  return generate(key + tint, (u, v) => {
    const boards = 6;
    const bu = u * boards;
    const bi = Math.floor(bu);
    const bf = bu - bi;
    const boardShift = N.v[bi * 13 % 256];
    const grain = N.fbm(u * 0.3 + boardShift, v, 8, 5);
    const streak = Math.sin((v * 40 + grain * 12 + boardShift * 30)) * 0.5 + 0.5;
    let c = base.map((x) => x * (0.75 + boardShift * 0.4));
    c = mixc(c, c.map((x) => x * 0.55), streak * 0.35);
    const weather = N2.fbm(u, v, 6, 4);
    c = mixc(c, hex('#4a4a46'), clamp(weather - 0.45, 0, 0.5));
    let hgt = 0.7 + streak * 0.2;
    const gap = Math.min(bf, 1 - bf);
    if (gap < 0.03) { c = c.map((x) => x * 0.25); hgt = 0.0; }
    // nail heads
    const nv = (v * 3) % 1;
    if (Math.abs(bf - 0.5) < 0.035 && Math.abs(nv - 0.5) < 0.012) { c = hex('#2a2420'); hgt = 0.9; }
    return [c[0], c[1], c[2], hgt];
  }, { normalStrength: 3 });
}

export function logsTexture(tint = '#5a4230') {
  const base = hex(tint);
  return generate('logs' + tint, (u, v) => {
    const rows = 7;
    const rv = v * rows;
    const ri = Math.floor(rv);
    const rf = rv - ri;
    const round = Math.sin(rf * Math.PI);
    const bark = N.fbm(u * 2 + ri * 0.37, v * 0.5, 16, 5);
    const ridge = Math.abs(Math.sin(u * 90 + bark * 10)) * 0.5;
    let c = base.map((x) => x * (0.5 + round * 0.6 + bark * 0.2));
    c = mixc(c, c.map((x) => x * 0.6), ridge);
    const chink = rf < 0.06 || rf > 0.94;
    if (chink) c = hex('#2b2620');
    return [c[0], c[1], c[2], chink ? 0 : round * 0.8 + ridge * 0.2];
  }, { normalStrength: 5 });
}

export function barkTexture() {
  return generate('bark', (u, v) => {
    const n = N.fbm(u * 1.0, v * 0.25, 16, 5);
    const ridges = Math.abs(Math.sin(u * 60 + n * 14));
    const c = mixc(hex('#2a2018'), hex('#5a4a3a'), ridges * 0.6 + n * 0.4);
    return [c[0], c[1], c[2], ridges * 0.7 + n * 0.3];
  }, { normalStrength: 6 });
}

export function brickTexture(tint = '#6a3a2c') {
  const base = hex(tint);
  return generate('brick' + tint, (u, v) => {
    const rows = 16, cols = 8;
    const rv = v * rows;
    const ri = Math.floor(rv);
    const cu = u * cols + (ri % 2) * 0.5;
    const ci = Math.floor(cu);
    const fu = cu - ci, fv = rv - ri;
    const mortar = fu < 0.05 || fv < 0.1;
    const bv = N.v[(ri * 37 + ci * 11) % 65536];
    const grime = N.fbm(u, v, 4, 4);
    const fine = N2.fbm(u, v, 64, 3);
    let c = mortar ? hex('#5a5650') : base.map((x) => x * (0.7 + bv * 0.5));
    c = c.map((x) => x * (0.75 + fine * 0.4));
    c = mixc(c, hex('#1e1c18'), clamp((grime - 0.5) * 1.5 + (1 - v) * 0.0, 0, 0.55));
    const moss = clamp((N2.fbm(u + 0.5, v, 6, 4) - 0.6) * 4, 0, 1) * clamp(v * 1.5 - 0.6, 0, 1);
    c = mixc(c, hex('#2e3a1e'), moss * 0.8);
    return [c[0], c[1], c[2], mortar ? 0.1 : 0.7 + fine * 0.3];
  }, { normalStrength: 4 });
}

export function concreteTexture(tint = '#77736a') {
  const base = hex(tint);
  return generate('concrete' + tint, (u, v) => {
    const n = N.fbm(u, v, 8, 5);
    const fine = N2.fbm(u, v, 64, 3);
    const stain = clamp((N.fbm(u * 0.5 + 0.3, v, 3, 3) - 0.5) * 2, 0, 1);
    const streaks = clamp(N2.fbm(u * 4, v * 0.2, 16, 3) - 0.45, 0, 1) * 1.5;
    let c = base.map((x) => x * (0.8 + n * 0.3 + (fine - 0.5) * 0.15));
    c = mixc(c, hex('#2a2824'), stain * 0.5 + streaks * 0.4);
    const crack = Math.abs(N.fbm(u * 1.3, v * 1.1 + 0.4, 6, 5) - 0.5) < 0.006;
    if (crack) c = c.map((x) => x * 0.3);
    return [c[0], c[1], c[2], crack ? 0 : 0.5 + fine * 0.4 + n * 0.1];
  }, { normalStrength: 2.5 });
}

export function metalTexture(paint = '#5a6a5a', key = 'metal') {
  const base = hex(paint);
  return generate(key + paint, (u, v) => {
    const n = N.fbm(u, v, 8, 5);
    const rustAmt = clamp((N2.fbm(u + 0.2, v + 0.4, 6, 5) - 0.48) * 3.5, 0, 1);
    const drip = clamp(N.fbm(u * 6, v * 0.4, 12, 3) - 0.55, 0, 1) * 2;
    const rust = mixc(hex('#5a2e16'), hex('#8a4a22'), n);
    let c = mixc(base.map((x) => x * (0.85 + n * 0.25)), rust, clamp(rustAmt + drip * 0.6, 0, 1));
    const fine = N2.n(u * 256, v * 256, 256);
    c = c.map((x) => x * (0.9 + fine * 0.2));
    return [c[0], c[1], c[2], 0.5 + rustAmt * 0.4 + fine * 0.1];
  }, { normalStrength: 2, rough: (u, v, r) => 0.45 + r[3] * 0.5 });
}

export function corrugatedTexture(paint = '#6a6a62') {
  const base = hex(paint);
  return generate('corr' + paint, (u, v) => {
    const wave = Math.sin(u * Math.PI * 2 * 16) * 0.5 + 0.5;
    const rustAmt = clamp((N.fbm(u, v, 6, 5) - 0.42) * 3, 0, 1);
    const streak = clamp(N2.fbm(u * 8, v * 0.3, 16, 3) - 0.5, 0, 1) * 2;
    let c = base.map((x) => x * (0.65 + wave * 0.45));
    c = mixc(c, mixc(hex('#5a2c14'), hex('#9a5426'), wave), clamp(rustAmt + streak * 0.5, 0, 1));
    return [c[0], c[1], c[2], wave];
  }, { normalStrength: 6, rough: (u, v, r) => 0.5 + r[3] * 0.2 });
}

export function hayTexture() {
  return generate('hay', (u, v) => {
    const fib = N.fbm(u * 0.4, v * 4, 32, 4);
    const fine = Math.abs(Math.sin(u * 300 + fib * 40));
    const c = mixc(hex('#6a5420'), hex('#b09048'), fib * 0.7 + fine * 0.3);
    return [c[0], c[1], c[2], fine];
  }, { normalStrength: 3 });
}

export function rockTexture() {
  return generate('rock', (u, v) => {
    const n = N.fbm(u, v, 8, 6);
    const layers = Math.sin(v * 30 + n * 8) * 0.5 + 0.5;
    const lichen = clamp((N2.fbm(u, v, 10, 4) - 0.58) * 4, 0, 1);
    let c = mixc(hex('#3a3a38'), hex('#6a6862'), n * 0.7 + layers * 0.3);
    c = mixc(c, hex('#5a6040'), lichen * 0.6);
    return [c[0], c[1], c[2], n * 0.8 + layers * 0.2];
  }, { normalStrength: 5 });
}

export function fabricTexture(key = 'fabric') {
  return generate(key, (u, v) => {
    const wx = Math.sin(u * Math.PI * 2 * 96) * 0.5 + 0.5;
    const wy = Math.sin(v * Math.PI * 2 * 96) * 0.5 + 0.5;
    const n = N.fbm(u, v, 8, 4);
    const g = 0.82 + (wx * wy) * 0.12 + n * 0.12;
    return [g, g, g, wx * 0.5 + wy * 0.5];
  }, { size: 256, normalStrength: 1.5 });
}

export function skinTexture() {
  return generate('skin', (u, v) => {
    const n = N.fbm(u, v, 32, 4);
    const g = 0.92 + n * 0.1;
    return [g, g * 0.98, g * 0.97, n];
  }, { size: 128, normalStrength: 0.8 });
}

export function rubberTexture() {
  return generate('rubber', (u, v) => {
    const tread = Math.abs(Math.sin(u * Math.PI * 2 * 24 + Math.sin(v * 20) * 0.6));
    const n = N.fbm(u, v, 16, 3);
    const g = 0.08 + tread * 0.05 + n * 0.05;
    return [g, g, g, tread];
  }, { size: 256, normalStrength: 4 });
}

export function needlesTexture() {
  return generate('needles', (u, v) => {
    const n = N.fbm(u, v, 32, 4);
    const strand = Math.abs(Math.sin(u * 200 + v * 120 + n * 20));
    const c = mixc(hex('#142014'), hex('#2e4226'), strand * 0.5 + n * 0.5);
    return [c[0], c[1], c[2], strand];
  }, { size: 256, normalStrength: 4 });
}

export function leafTexture() {
  return generate('leaf', (u, v) => {
    const n = N.fbm(u, v, 24, 4);
    const c = mixc(hex('#2a2a14'), hex('#4a4420'), n);
    return [c[0], c[1], c[2], n];
  }, { size: 256, normalStrength: 3 });
}

export function waterTexture() {
  return generate('water', (u, v) => {
    const n = N.fbm(u, v, 8, 5);
    const g = 0.5 + n * 0.3;
    return [0.05, 0.07, 0.08, g];
  }, { size: 256, normalStrength: 1.2 });
}

/* ---------------- alpha cards for vegetation ---------------- */

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function grassCardTexture(palette = ['#3a4a22', '#55602e', '#6a6238', '#2c3a1a']) {
  const key = 'grasscard' + palette.join();
  if (cache.has(key)) return cache.get(key);
  const r = mulberry32(99);
  const t = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const hh = h * (0.45 + r() * 0.55);
      const lean = (r() - 0.5) * 50;
      const wid = 2 + r() * 4;
      const grd = g.createLinearGradient(0, h, 0, h - hh);
      const col = palette[Math.floor(r() * palette.length)];
      grd.addColorStop(0, '#141a0c');
      grd.addColorStop(0.4, col);
      grd.addColorStop(1, col);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x - wid, h);
      g.quadraticCurveTo(x + lean * 0.4, h - hh * 0.5, x + lean, h - hh);
      g.quadraticCurveTo(x + lean * 0.4 + wid * 0.3, h - hh * 0.5, x + wid, h);
      g.closePath();
      g.fill();
    }
  });
  cache.set(key, t);
  return t;
}

export function cornCardTexture() {
  if (cache.has('corncard')) return cache.get('corncard');
  const r = mulberry32(7);
  const t = canvasTex(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // stalk
    const sg = g.createLinearGradient(0, h, 0, 0);
    sg.addColorStop(0, '#3a3018'); sg.addColorStop(1, '#7a6a3a');
    g.fillStyle = sg;
    g.fillRect(w / 2 - 3, 20, 6, h - 20);
    // leaves, dry and torn
    for (let i = 0; i < 9; i++) {
      const y = h * (0.15 + i * 0.09);
      const dir = i % 2 ? 1 : -1;
      const len = w * (0.35 + r() * 0.15);
      g.fillStyle = ['#6a5e30', '#80703a', '#5a5228', '#8a7a48'][i % 4];
      g.beginPath();
      g.moveTo(w / 2, y);
      g.quadraticCurveTo(w / 2 + dir * len * 0.6, y - 30, w / 2 + dir * len, y + 40 + r() * 30);
      g.quadraticCurveTo(w / 2 + dir * len * 0.5, y - 10, w / 2, y + 12);
      g.fill();
    }
    // tassel
    g.strokeStyle = '#9a8248';
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(w / 2, 24); g.lineTo(w / 2 + (r() - 0.5) * 40, 0); g.stroke(); }
    // ear of corn
    g.fillStyle = '#7a6638';
    g.beginPath(); g.ellipse(w / 2 + 8, h * 0.45, 7, 28, 0.3, 0, Math.PI * 2); g.fill();
  });
  cache.set('corncard', t);
  return t;
}

export function glowSpriteTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const t = canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  cache.set('glow', t);
  return t;
}

export function moonTexture(blood = false) {
  const key = 'moon' + blood;
  if (cache.has(key)) return cache.get(key);
  const r = mulberry32(31);
  const t = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2);
    grd.addColorStop(0, blood ? 'rgba(200,60,40,0.5)' : 'rgba(200,215,240,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = blood ? '#c8584a' : '#e6e8ec';
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = r() * w * 0.17, rr = 2 + r() * 9;
      g.fillStyle = blood ? 'rgba(90,20,15,0.35)' : 'rgba(120,125,140,0.35)';
      g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, rr, 0, Math.PI * 2); g.fill();
    }
  });
  cache.set(key, t);
  return t;
}

export function scratchTexture() {
  if (cache.has('scratch')) return cache.get('scratch');
  const r = mulberry32(5);
  const t = canvasTex(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 2 + r() * 3;
      g.beginPath();
      const y = 10 + i * 12 + r() * 6;
      g.moveTo(8 + r() * 20, y);
      g.lineTo(w - 8 - r() * 20, y + (r() - 0.5) * 18);
      g.stroke();
    }
  });
  cache.set('scratch', t);
  return t;
}

export function bloodTexture() {
  if (cache.has('blood')) return cache.get('blood');
  const r = mulberry32(17);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (r() - 0.5) * 70, y = h / 2 + (r() - 0.5) * 70, rr = 4 + r() * 16;
      g.fillStyle = `rgba(${90 + r() * 40},${8 + r() * 10},${8 + r() * 8},${0.7 + r() * 0.3})`;
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
  });
  cache.set('blood', t);
  return t;
}

export function rippleTexture() {
  if (cache.has('ripple')) return cache.get('ripple');
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 5;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.28, 0, Math.PI * 2); g.stroke();
  });
  cache.set('ripple', t);
  return t;
}

// Animated static used by CRT screens and The EXE's face.
export function makeStaticCanvas(w = 128, h = 96) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const img = g.createImageData(w, h);
  return {
    canvas: c, ctx: g, tex, img,
    noise(intensity = 1, tint = [1, 1, 1]) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255 * intensity;
        d[i] = v * tint[0]; d[i + 1] = v * tint[1]; d[i + 2] = v * tint[2]; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
  };
}
