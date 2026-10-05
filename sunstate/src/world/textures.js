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

/**
 * Facade textures. One tile = 4 window bays (12 m) × 4 floors (13.6 m).
 * Returns {map, emissive}; the emissive map lights a random set of windows
 * so night-time facades don't repeat an obvious pattern.
 */
export const FACADE_TILE = [12, 13.6];
export function facade(style) {
  return cached('facade:' + style, () => {
    const W = 512, H = 512, B = 128, F = 128;
    const c = canvas(W, H), e = canvas(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const r = mulberry32(style.length * 977 + 3);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    noise(x, W, H, r, 7000, (v) => `rgba(${v < 0.5 ? '150,140,130' : '255,255,255'},${v * 0.12})`);
    // subtle weathering streaks
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,110,100,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 2 + r() * 6, 30 + r() * 120); }
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
    const lit = (wx, wy, ww, wh, p = 0.4) => {
      if (r() < p) {
        const warm = r() < 0.78;
        ex.fillStyle = warm ? `rgb(255,${190 + r() * 50 | 0},${120 + r() * 60 | 0})` : `rgb(${150 + r() * 60 | 0},${200 + r() * 40 | 0},255)`;
        ex.fillRect(wx, wy, ww, wh);
        // blinds / curtains break up the rectangle
        if (r() < 0.5) { ex.fillStyle = 'rgba(0,0,0,0.55)'; ex.fillRect(wx, wy, ww, wh * (0.2 + r() * 0.5)); }
      }
    };
    const glass = (wx, wy, ww, wh) => {
      const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
      g.addColorStop(0, '#6a879c'); g.addColorStop(0.5, '#2b3e52'); g.addColorStop(1, '#4b6a82');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(wx + 2, wy + 2, ww * 0.35, wh - 4);
      if (r() < 0.35) { x.fillStyle = `rgba(${200 + r() * 55 | 0},${190 + r() * 50 | 0},${170 + r() * 60 | 0},0.55)`; x.fillRect(wx + 1, wy + 1, ww - 2, wh * (0.2 + r() * 0.5)); }
    };
    for (let fy = 0; fy < 4; fy++) for (let bxI = 0; bxI < 4; bxI++) {
      const bx = bxI * B, by = fy * F;
      if (style === 'tower') {
        glass(bx + 3, by + 8, B - 6, 92); lit(bx + 3, by + 8, B - 6, 92, 0.38);
        x.fillStyle = '#f4f4f0'; x.fillRect(bx, by + 104, B, 24);
        x.fillStyle = 'rgba(180,200,210,0.85)'; x.fillRect(bx, by + 96, B, 8);
      } else if (style === 'motel') {
        if (bxI % 2 === 0) {
          x.fillStyle = '#2bb8c9'; x.fillRect(bx + 40, by + 34, 44, 94);
          x.fillStyle = '#1b6c78'; x.fillRect(bx + 76, by + 80, 4, 8);
          x.fillStyle = '#ffffff'; x.font = '700 14px Arial'; x.fillText(String(10 + fy * 4 + bxI), bx + 52, by + 52);
        } else { glass(bx + 24, by + 42, 80, 44); lit(bx + 24, by + 42, 80, 44, 0.5); x.fillStyle = '#e7dcc0'; x.fillRect(bx + 20, by + 38, 88, 4); }
        x.fillStyle = '#d8ccb0'; x.fillRect(bx, by + 120, B, 8);
      } else if (style === 'residential') {
        glass(bx + 26, by + 34, 76, 56); lit(bx + 26, by + 34, 76, 56, 0.42);
        x.fillStyle = '#ffffff'; x.fillRect(bx + 62, by + 34, 4, 56);
        x.fillStyle = 'rgba(60,60,60,0.25)'; x.fillRect(bx + 22, by + 90, 84, 5);
        if (r() < 0.3) { x.fillStyle = '#9aa3a8'; x.fillRect(bx + 80, by + 92, 20, 12); }
      } else if (style === 'civic') {
        glass(bx + 10, by + 30, 108, 64); lit(bx + 10, by + 30, 108, 64, 0.62);
        x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(bx, by + 100, B, 4);
      } else {
        // deco / shop upper floors: paired windows under an "eyebrow" shade
        glass(bx + 22, by + 36, 38, 56); glass(bx + 68, by + 36, 38, 56);
        lit(bx + 22, by + 36, 38, 56, 0.42); lit(bx + 68, by + 36, 38, 56, 0.42);
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(bx + 14, by + 28, 100, 6);
        x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(bx + 14, by + 24, 100, 4);
        if (style === 'deco' && bxI % 2) { x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(bx + 60, by, 8, F); }
      }
    }
    return { map: tex(c), emissive: tex(e) };
  });
}

/** Ground-floor storefront: big glass, door, awning band. */
export function storefront(kind = 'shop') {
  return cached('storefront:' + kind, () => {
    const W = 256, H = 128;
    const c = canvas(W, H), e = canvas(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const r = mulberry32(kind.length * 31 + 7);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) {
      const bx = i * 128;
      const g = x.createLinearGradient(0, 30, 0, 124);
      g.addColorStop(0, '#3a5266'); g.addColorStop(1, '#1d2a36');
      x.fillStyle = g; x.fillRect(bx + 8, 30, 112, 94);
      // goods / interior hints
      for (let k = 0; k < 10; k++) { x.fillStyle = `hsla(${r() * 360},50%,60%,0.35)`; x.fillRect(bx + 12 + r() * 100, 80 + r() * 30, 6 + r() * 8, 8 + r() * 10); }
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(bx + 12, 34, 30, 86);
      x.fillStyle = '#2a2a2a'; x.fillRect(bx + 62, 30, 3, 94);
      ex.fillStyle = kind === 'deco' ? 'rgb(255,214,170)' : 'rgb(255,236,200)';
      ex.fillRect(bx + 8, 30, 112, 94);
    }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, W, 6);
    return { map: tex(c), emissive: tex(e) };
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
