/**
 * Procedural textures drawn on canvases at startup. Every surface in the game
 * is generated here — no external image files (see ASSETS.md).
 */
import * as THREE from 'three';
import { mulberry32 } from './district.js';

const cache = new Map();
let maxAniso = 4;
export function setAnisotropy(a) { maxAniso = a; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { repeat = true, srgb = true, aniso = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso ? Math.min(8, maxAniso) : 1;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noise(ctx, w, h, rnd, count, colorFn, size = [1, 3]) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colorFn(rnd());
    const s = size[0] + rnd() * (size[1] - size[0]);
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

export const asphalt = () => cached('asphalt', () => {
  const c = canvas(512, 512), x = c.getContext('2d'), r = mulberry32(11);
  x.fillStyle = '#3d3f42'; x.fillRect(0, 0, 512, 512);
  noise(x, 512, 512, r, 26000, (v) => `rgba(${v < 0.5 ? '20,20,22' : '120,118,112'},${0.12 + v * 0.18})`, [1, 2.5]);
  // tar patches and wear
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(25,25,28,${0.12 + r() * 0.12})`;
    x.beginPath(); x.ellipse(r() * 512, r() * 512, 20 + r() * 60, 8 + r() * 30, r() * 3, 0, 7); x.fill();
  }
  x.strokeStyle = 'rgba(22,22,24,0.55)'; x.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    x.beginPath(); let px = r() * 512, py = r() * 512; x.moveTo(px, py);
    for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); }
    x.stroke();
  }
  return tex(c);
});

export const concrete = () => cached('concrete', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(12);
  x.fillStyle = '#c9c3b6'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, r, 9000, (v) => `rgba(${v < 0.5 ? '90,88,80' : '240,236,226'},${0.08 + v * 0.12})`);
  x.strokeStyle = 'rgba(80,76,70,0.5)'; x.lineWidth = 2;
  for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(256, i * 128); x.stroke(); x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 256); x.stroke(); }
  return tex(c);
});

export const pavers = () => cached('pavers', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(13);
  x.fillStyle = '#d9c7a8'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
    const off = (j % 2) * 32;
    x.fillStyle = `hsl(${30 + r() * 12},${30 + r() * 15}%,${70 + r() * 10}%)`;
    x.fillRect(i * 64 + off + 1, j * 32 + 1, 62, 30);
    x.fillRect(i * 64 + off - 256 + 1, j * 32 + 1, 62, 30);
  }
  noise(x, 256, 256, r, 3000, (v) => `rgba(60,50,40,${v * 0.12})`);
  return tex(c);
});

export const sand = () => cached('sand', () => {
  const c = canvas(512, 512), x = c.getContext('2d'), r = mulberry32(14);
  x.fillStyle = '#f6e3b8'; x.fillRect(0, 0, 512, 512);
  noise(x, 512, 512, r, 40000, (v) => `rgba(${v < 0.5 ? '196,164,112' : '255,250,232'},${0.1 + v * 0.2})`, [1, 2]);
  x.strokeStyle = 'rgba(190,170,130,0.25)'; x.lineWidth = 3;
  for (let i = 0; i < 30; i++) {
    x.beginPath(); const y = r() * 512; x.moveTo(0, y);
    for (let k = 0; k <= 16; k++) x.lineTo(k * 32, y + Math.sin(k * 0.9 + i) * 6);
    x.stroke();
  }
  return tex(c);
});

export const grass = () => cached('grass', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(15);
  x.fillStyle = '#5f8a3e'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, r, 14000, (v) => `rgba(${v < 0.5 ? '40,70,25' : '140,170,80'},${0.2 + v * 0.3})`, [1, 3]);
  return tex(c);
});

export const wood = () => cached('wood', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(16);
  for (let i = 0; i < 8; i++) {
    x.fillStyle = `hsl(28,${28 + r() * 10}%,${42 + r() * 10}%)`;
    x.fillRect(0, i * 32, 256, 31);
    x.fillStyle = 'rgba(40,25,15,0.6)'; x.fillRect(0, i * 32 + 31, 256, 1);
  }
  noise(x, 256, 256, r, 6000, (v) => `rgba(60,40,25,${v * 0.15})`, [1, 6]);
  return tex(c);
});

/** Soft radial spot used for streetlight pools, headlight cones and blob shadows. */
export const radial = () => cached('radial', () => {
  const c = canvas(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false, srgb: false });
});

export const cone = () => cached('cone', () => {
  const c = canvas(128, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(54, 0); x.lineTo(74, 0); x.lineTo(128, 256); x.lineTo(0, 256); x.closePath(); x.fill();
  return tex(c, { repeat: false, srgb: false });
});

/** Palm frond with alpha: a midrib with dense, filled, drooping leaflets. */
export const frond = () => cached('frond', () => {
  const c = canvas(256, 512), x = c.getContext('2d'), r = mulberry32(18);
  for (let i = 0; i < 70; i++) {
    const t = i / 70, y = 505 - t * 495, len = 110 * Math.sin(Math.PI * (0.12 + t * 0.8)) + 10;
    for (const s of [-1, 1]) {
      const g = 95 + Math.floor(r() * 60);
      x.fillStyle = `rgb(${40 + (g >> 2)},${g},${30 + r() * 20 | 0})`;
      x.beginPath();
      x.moveTo(128, y);
      x.quadraticCurveTo(128 + s * len * 0.55, y - 10, 128 + s * len, y + 22 + t * 14);
      x.quadraticCurveTo(128 + s * len * 0.5, y + 4, 128, y + 7);
      x.closePath(); x.fill();
    }
  }
  x.strokeStyle = '#6b6a30'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(128, 512); x.quadraticCurveTo(134, 250, 128, 0); x.stroke();
  return tex(c, { repeat: false });
});

/**
 * Palm fronds, seen from above, as a two-cell atlas: a live green frond in the left half,
 * a dead brown one in the right. v runs base → tip along the rachis; long narrow leaflets
 * angle toward the tip with gaps between them (alpha). The geometry folds each into a
 * drooping V along the rachis.
 */
export const frondLeaf = () => cached('frondLeaf', () => {
  const W = 256, H = 512, c = canvas(W * 2, H), x = c.getContext('2d');
  for (const dead of [false, true]) {
    const r = mulberry32(dead ? 41 : 40), ox = dead ? W : 0, cx = ox + W / 2;
    x.save(); x.beginPath(); x.rect(ox, 0, W, H); x.clip();
    const n = 58;
    for (let i = 0; i < n; i++) {
      const t = i / n, y = H - 10 - t * (H - 24);
      for (const sd of [-1, 1]) {
        if (dead && r() < 0.18) continue; // dead fronds lose leaflets
        const len = (W / 2 - 8) * (0.82 + r() * 0.18) * (dead ? 0.8 + r() * 0.2 : 1);
        const rise = 58 + r() * 14, k = r() * 22;
        const g = x.createLinearGradient(cx, y, cx + sd * len, y - rise);
        if (dead) { g.addColorStop(0, `rgb(${110 + k | 0},${88 + k | 0},${56 + k * 0.5 | 0})`); g.addColorStop(1, `rgb(${150 + k | 0},${124 + k | 0},${84 + k * 0.5 | 0})`); }
        else { g.addColorStop(0, `rgb(${50 + k | 0},${92 + k | 0},${30 + k * 0.4 | 0})`); g.addColorStop(0.65, `rgb(${78 + k | 0},${128 + k | 0},${42 + k * 0.4 | 0})`); g.addColorStop(1, `rgb(${112 + k | 0},${140 + k | 0},${58 + k * 0.4 | 0})`); }
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(cx, y + 4);
        x.quadraticCurveTo(cx + sd * len * 0.5, y - 16 + r() * 6, cx + sd * len, y - rise);
        x.quadraticCurveTo(cx + sd * len * 0.5, y - 10, cx, y - 3);
        x.closePath(); x.fill();
        x.strokeStyle = dead ? 'rgba(90,68,40,0.55)' : 'rgba(170,185,100,0.4)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + sd * len * 0.5, y - 13, cx + sd * len * 0.96, y - rise + 2); x.stroke();
      }
    }
    const g = x.createLinearGradient(cx - 7, 0, cx + 7, 0);
    g.addColorStop(0, dead ? '#5c4a2c' : '#6d7a3a'); g.addColorStop(0.5, dead ? '#a08a5c' : '#c2c07a'); g.addColorStop(1, dead ? '#5c4a2c' : '#6d7a3a');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(cx - 7, H); x.lineTo(cx + 7, H); x.lineTo(cx + 1.5, 4); x.lineTo(cx - 1.5, 4); x.closePath(); x.fill();
    x.restore();
  }
  const t = tex(c, { repeat: false });
  t.generateMipmaps = true;
  return t;
});

/** Palm bark: coconut palms have grey-brown trunks ringed with old leaf scars; royals are smooth pale grey. */
export function palmBark(kind = 'coconut') {
  return cached('palmBark:' + kind, () => {
    const W = 128, H = 512;
    const L = new Layers(W, H);
    const r = mulberry32(kind === 'royal' ? 52 : 51);
    if (kind === 'royal') {
      L.rect(0, 0, W, H, '#9c9890', { rough: 0.8, height: 0.5 });
      noise(L.x, W, H, r, 5000, (v) => `rgba(${v < 0.5 ? '90,88,84' : '230,228,220'},${0.05 + v * 0.08})`);
      for (let i = 0; i < 30; i++) { const y = r() * H; L.rect(0, y, W, 1 + r() * 2, 'rgba(110,105,96,0.25)', { rough: 0.85, height: 0.42 }); }
    } else {
      L.rect(0, 0, W, H, '#8e8170', { rough: 0.92, height: 0.5 });
      noise(L.x, W, H, r, 9000, (v) => `rgba(${v < 0.5 ? '60,52,44' : '190,180,165'},${0.08 + v * 0.14})`, [1, 3]);
      const rings = 42;
      for (let i = 0; i < rings; i++) {
        const y = (i / rings) * H + r() * 3;
        L.rect(0, y, W, 3 + r() * 2, 'rgba(58,50,42,0.65)', { rough: 0.95, height: 0.15, ao: 150 });
        L.rect(0, y + 4, W, 2, 'rgba(200,190,175,0.35)', { rough: 0.9, height: 0.7 });
      }
      // vertical fissures between the rings
      for (let i = 0; i < 70; i++) { const xx = r() * W, y = r() * H; L.rect(xx, y, 1, 6 + r() * 10, 'rgba(50,42,36,0.45)', { rough: 0.95, height: 0.3 }); }
    }
    return { map: tex(L.c), normal: tex(normalFromHeight(L.h, 4), { srgb: false }), orm: tex(L.o, { srgb: false }) };
  });
}

/** Tileable ocean normal map. */
export const waterNormal = () => cached('waterNormal', () => {
  const N = 256, c = canvas(N, N), x = c.getContext('2d');
  const img = x.createImageData(N, N);
  const h = new Float32Array(N * N);
  const r = mulberry32(17);
  const waves = Array.from({ length: 14 }, () => ({ kx: Math.round((r() - 0.5) * 12), kz: Math.round((r() - 0.5) * 12), a: 0.3 + r(), p: r() * 6.28 }));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    for (const w of waves) v += Math.sin(((w.kx * i + w.kz * j) / N) * Math.PI * 2 + w.p) * w.a / (1 + Math.hypot(w.kx, w.kz) * 0.3);
    h[j * N + i] = v;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = h[j * N + ((i + 1) % N)] - h[j * N + ((i - 1 + N) % N)];
    const dz = h[((j + 1) % N) * N + i] - h[((j - 1 + N) % N) * N + i];
    const nx = -dx * 0.5, nz = -dz * 0.5, ny = 1;
    const l = Math.hypot(nx, ny, nz);
    const k = (j * N + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 2] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
});

/** Normal map (tangent space, +Y up) from a greyscale height canvas; wraps at the edges. */
function normalFromHeight(hc, strength = 2) {
  const W = hc.width, H = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, W, H).data;
  const out = canvas(W, H), ox = out.getContext('2d'), img = ox.createImageData(W, H), d = img.data;
  const h = (x, y) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // canvas rows run top-down; texture v runs bottom-up, so "up" in v is y - 1
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y - 1) - h(x, y + 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (y * W + x) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  return out;
}

/**
 * Paint on four layers at once: colour, ORM (R = AO, G = roughness, B = metalness),
 * height (for the normal map) and emissive (lit windows at night).
 */
class Layers {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.c = canvas(W, H); this.o = canvas(W, H); this.h = canvas(W, H); this.e = canvas(W, H);
    this.x = this.c.getContext('2d'); this.ox = this.o.getContext('2d'); this.hx = this.h.getContext('2d'); this.ex = this.e.getContext('2d');
    this.ex.fillStyle = '#000'; this.ex.fillRect(0, 0, W, H);
  }
  /** fill a rect on the colour layer and, optionally, set its roughness/metal/height */
  rect(x, y, w, h, color, { rough = null, metal = 0, height = null, ao = 255 } = {}) {
    if (color) { this.x.fillStyle = color; this.x.fillRect(x, y, w, h); }
    if (rough !== null) { this.ox.fillStyle = `rgb(${ao},${Math.round(rough * 255)},${Math.round(metal * 255)})`; this.ox.fillRect(x, y, w, h); }
    if (height !== null) { const v = Math.round(height * 255); this.hx.fillStyle = `rgb(${v},${v},${v})`; this.hx.fillRect(x, y, w, h); }
  }
}

/** Stucco: the base plaster with a fine trowelled relief (height) and grime. */
function stucco(L, r, rough = 0.88) {
  const { W, H } = L;
  L.rect(0, 0, W, H, '#ffffff', { rough, height: 0.5 });
  noise(L.x, W, H, r, 7000, (v) => `rgba(${v < 0.5 ? '150,140,130' : '255,255,255'},${v * 0.12})`);
  noise(L.hx, W, H, r, 14000, (v) => `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + v * 0.08})`, [1, 4]);
  L.hx.filter = 'blur(1px)'; L.hx.drawImage(L.h, 0, 0); L.hx.filter = 'none';
  // rain streaks below sills and grime near the ground of each floor
  for (let i = 0; i < 40; i++) { L.x.fillStyle = `rgba(120,110,100,${r() * 0.05})`; L.x.fillRect(r() * W, r() * H, 2 + r() * 6, 30 + r() * 120); }
}

/** A window: aluminium frame, reflective glass (low roughness, metallic so it mirrors the sky). */
function glassPane(L, r, wx, wy, ww, wh, { tint = [52, 68, 84], frame = 4, mullion = true } = {}) {
  L.rect(wx - frame, wy - frame, ww + frame * 2, wh + frame * 2, '#d9dde0', { rough: 0.35, metal: 0.85, height: 0.62 });
  const [cr, cg, cb] = tint, v = r() * 14 - 7;
  L.rect(wx, wy, ww, wh, `rgb(${cr + v | 0},${cg + v | 0},${cb + v | 0})`, { rough: 0.04 + r() * 0.04, metal: 0.92, height: 0.18, ao: 210 });
  // drawn blinds or curtains behind some panes (they read through the reflection)
  if (r() < 0.35) L.rect(wx + 1, wy + 1, ww - 2, wh * (0.2 + r() * 0.5), `rgba(${200 + r() * 55 | 0},${190 + r() * 50 | 0},${170 + r() * 60 | 0},0.45)`);
  if (mullion && ww > 40) L.rect(wx + ww / 2 - 2, wy, 4, wh, '#d9dde0', { rough: 0.35, metal: 0.85, height: 0.6 });
  // the sill casts a little contact shadow
  L.rect(wx - frame - 2, wy + wh + frame, ww + frame * 2 + 4, 5, '#ece8e0', { rough: 0.7, height: 0.85 });
}

/**
 * Facade textures. One tile = 4 window bays (12 m) × 4 floors (13.6 m).
 * Returns {map, emissive, orm, normal}: reflective glass in aluminium frames set
 * into stucco (the vertex colour tints only the plaster: see tintByMetal in build.js).
 * The emissive map lights a random set of windows at night.
 */
export const FACADE_TILE = [12, 13.6];
export function facade(style) {
  return cached('facade:' + style, () => {
    const W = 512, H = 512, B = 128, F = 128;
    const L = new Layers(W, H);
    const r = mulberry32(style.length * 977 + 3);
    stucco(L, r);
    const ex = L.ex;
    const lit = (wx, wy, ww, wh, p = 0.4) => {
      if (r() < p) {
        const warm = r() < 0.78;
        ex.fillStyle = warm ? `rgb(255,${190 + r() * 50 | 0},${120 + r() * 60 | 0})` : `rgb(${150 + r() * 60 | 0},${200 + r() * 40 | 0},255)`;
        ex.fillRect(wx, wy, ww, wh);
        if (r() < 0.5) { ex.fillStyle = 'rgba(0,0,0,0.55)'; ex.fillRect(wx, wy, ww, wh * (0.2 + r() * 0.5)); }
      }
    };
    for (let fy = 0; fy < 4; fy++) for (let bxI = 0; bxI < 4; bxI++) {
      const bx = bxI * B, by = fy * F;
      if (style === 'tower') {
        // curtain wall: tall tinted glass with slab edges
        glassPane(L, r, bx + 4, by + 8, B - 8, 90, { tint: [44, 70, 86], frame: 3, mullion: false }); lit(bx + 4, by + 8, B - 8, 90, 0.38);
        L.rect(bx, by + 104, B, 24, '#f4f4f0', { rough: 0.75, height: 0.7 });
        L.rect(bx, by + 98, B, 6, 'rgba(180,200,210,0.85)', { rough: 0.2, metal: 0.8, height: 0.75 }); // balcony glass rail
      } else if (style === 'motel') {
        if (bxI % 2 === 0) {
          L.rect(bx + 40, by + 34, 44, 94, '#2bb8c9', { rough: 0.45, metal: 0, height: 0.3 });
          L.rect(bx + 76, by + 80, 4, 8, '#c9c9c9', { rough: 0.3, metal: 0.9, height: 0.6 });
          L.x.fillStyle = '#ffffff'; L.x.font = '700 14px Arial'; L.x.fillText(String(10 + fy * 4 + bxI), bx + 52, by + 52);
        } else { glassPane(L, r, bx + 24, by + 42, 80, 44); lit(bx + 24, by + 42, 80, 44, 0.5); }
        L.rect(bx, by + 120, B, 8, '#d8ccb0', { rough: 0.8, height: 0.8 });
      } else if (style === 'residential') {
        glassPane(L, r, bx + 26, by + 34, 76, 56); lit(bx + 26, by + 34, 76, 56, 0.42);
        L.rect(bx + 22, by + 90, 84, 5, 'rgba(60,60,60,0.25)');
        if (r() < 0.3) L.rect(bx + 80, by + 96, 20, 12, '#9aa3a8', { rough: 0.5, metal: 0.6, height: 0.9 }); // a window AC unit
      } else if (style === 'civic') {
        glassPane(L, r, bx + 10, by + 30, 108, 64, { tint: [60, 80, 92] }); lit(bx + 10, by + 30, 108, 64, 0.62);
        L.rect(bx, by + 100, B, 4, 'rgba(0,0,0,0.12)');
      } else {
        // deco / shop upper floors: paired windows under an "eyebrow" shade
        glassPane(L, r, bx + 22, by + 36, 38, 56, { mullion: false }); glassPane(L, r, bx + 68, by + 36, 38, 56, { mullion: false });
        lit(bx + 22, by + 36, 38, 56, 0.42); lit(bx + 68, by + 36, 38, 56, 0.42);
        L.rect(bx + 14, by + 26, 100, 8, 'rgba(0,0,0,0.18)', { rough: 0.85, height: 0.95, ao: 170 });
        L.rect(bx + 14, by + 22, 100, 4, 'rgba(255,255,255,0.75)', { rough: 0.8, height: 1 });
        if (style === 'deco' && bxI % 2) L.rect(bx + 60, by, 8, F, 'rgba(0,0,0,0.06)', { rough: 0.85, height: 0.75 }); // a fluted pilaster
      }
    }
    return { map: tex(L.c), emissive: tex(L.e), orm: tex(L.o, { srgb: false }), normal: tex(normalFromHeight(L.h, 3), { srgb: false }) };
  });
}

/** Ground-floor storefront: big glass (reflective), a door, an awning band. Same layers as facades. */
export function storefront(kind = 'shop') {
  return cached('storefront:' + kind, () => {
    const W = 256, H = 128;
    const L = new Layers(W, H);
    const r = mulberry32(kind.length * 31 + 7);
    L.rect(0, 0, W, H, '#ffffff', { rough: 0.85, height: 0.55 });
    for (let i = 0; i < 2; i++) {
      const bx = i * 128;
      L.rect(bx + 6, 28, 116, 98, '#2a2c2e', { rough: 0.4, metal: 0.8, height: 0.65 }); // dark aluminium shopfront frame
      L.rect(bx + 10, 32, 108, 92, '#26394a', { rough: 0.04, metal: 0.9, height: 0.2, ao: 220 });
      // goods and lights inside read through the glass
      for (let k = 0; k < 10; k++) L.rect(bx + 14 + r() * 96, 80 + r() * 30, 6 + r() * 8, 8 + r() * 10, `hsla(${r() * 360},50%,60%,0.35)`);
      L.rect(bx + 62, 32, 4, 92, '#2a2c2e', { rough: 0.4, metal: 0.8, height: 0.65 });
      L.ex.fillStyle = kind === 'deco' ? 'rgb(255,214,170)' : 'rgb(255,236,200)';
      L.ex.fillRect(bx + 10, 32, 108, 92);
    }
    L.rect(0, 0, W, 6, 'rgba(0,0,0,0.25)');
    return { map: tex(L.c), emissive: tex(L.e), orm: tex(L.o, { srgb: false }), normal: tex(normalFromHeight(L.h, 2.5), { srgb: false }) };
  });
}

/** Text sign. Returns a texture sized to the text; aspect in .userData.aspect. */
export function signTexture(text, { fg = '#ffffff', bg = null, font = '700 64px "Trebuchet MS", Arial, sans-serif', neon = null, script = false } = {}) {
  return cached(`sign:${text}:${fg}:${bg}:${neon}:${script}`, () => {
    const pad = 28;
    const m = canvas(16, 16).getContext('2d');
    const f = script ? 'italic 700 72px Georgia, "Times New Roman", serif' : font;
    m.font = f;
    const tw = Math.ceil(m.measureText(text).width);
    const c = canvas(Math.min(2048, tw + pad * 2), 112);
    const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
    x.font = f; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (neon) { x.shadowColor = neon; x.shadowBlur = 18; x.fillStyle = neon; x.fillText(text, c.width / 2, 58); x.shadowBlur = 6; }
    x.fillStyle = fg;
    x.fillText(text, c.width / 2, 58);
    const t = tex(c, { repeat: false });
    t.userData.aspect = c.width / c.height;
    return t;
  });
}

/** Store shelving: rows of colourful product packs. */
export const shelfGoods = () => cached('shelf', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(19);
  x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    x.fillStyle = '#9aa0a6'; x.fillRect(0, y + 58, 256, 6);
    let px = 2;
    while (px < 250) {
      const w = 10 + r() * 18, h = 26 + r() * 26;
      x.fillStyle = `hsl(${r() * 360},${55 + r() * 30}%,${45 + r() * 20}%)`;
      x.fillRect(px, y + 58 - h, w - 2, h);
      x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(px + 2, y + 58 - h + 6, w - 6, 4);
      px += w;
    }
  }
  return tex(c);
});

export const tiles = () => cached('tiles', () => {
  const c = canvas(256, 256), x = c.getContext('2d'), r = mulberry32(21);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    x.fillStyle = (i + j) % 2 ? '#e9e6df' : '#d2cdc2';
    x.fillRect(i * 32, j * 32, 32, 32);
  }
  noise(x, 256, 256, r, 3000, (v) => `rgba(80,80,80,${v * 0.08})`);
  return tex(c);
});

/** Faint dirt / grime overlay for car bodies when damaged is applied via color, not texture. */
export function plateTexture(text) {
  return cached('plate:' + text, () => {
    const c = canvas(128, 64), x = c.getContext('2d');
    x.fillStyle = '#f4f4ef'; x.fillRect(0, 0, 128, 64);
    x.fillStyle = '#e07b39'; x.fillRect(0, 0, 128, 12);
    x.fillStyle = '#1d3a6b'; x.font = '700 30px Arial'; x.textAlign = 'center'; x.fillText(text, 64, 48);
    return tex(c, { repeat: false });
  });
}
