/**
 * Procedural texture generation (canvas 2D). Every surface in the game is
 * generated here at load time: color, normal (from a height field) and
 * roughness maps. No external image assets.
 */
import * as THREE from 'three';

// ---------- noise ----------
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = period;
  const w = (a) => ((a % p) + p) % p;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s);
  const c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Tileable fractal noise in [0,1]. */
export function fbm(x, y, seed = 0, oct = 4, base = 4) {
  let amp = 0.5, f = base, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(x * f, y * f, seed + o * 17, f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}
export function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- canvas helpers ----------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * Generic generator: fn(u,v) -> {r,g,b,h,rough} for every pixel. Produces
 * color, normal and roughness textures.
 */
function generate(size, fn, opts = {}) {
  const w = opts.w || size, h = opts.h || size;
  const col = makeCanvas(w, h), ctx = col.getContext('2d');
  const img = ctx.createImageData(w, h);
  const height = new Float32Array(w * h);
  const rough = new Uint8ClampedArray(w * h);
  const out = { r: 0, g: 0, b: 0, h: 0, rough: 0.8 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.h = 0; out.rough = 0.8;
      fn(x / w, y / h, out, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = out.r; img.data[i + 1] = out.g; img.data[i + 2] = out.b; img.data[i + 3] = 255;
      height[y * w + x] = out.h;
      rough[y * w + x] = out.rough * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (opts.post) opts.post(ctx, w, h);
  // normal map from height via sobel (wraps)
  const nc = makeCanvas(w, h), nctx = nc.getContext('2d');
  const nimg = nctx.createImageData(w, h);
  const strength = opts.normalStrength ?? 2.0;
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const rc = makeCanvas(w, h), rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    // roughness in G channel (three reads G for roughness, B for metalness)
    rimg.data[i * 4] = 255; rimg.data[i * 4 + 1] = rough[i]; rimg.data[i * 4 + 2] = 255; rimg.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  return { color: col, normal: nc, rough: rc };
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
function setRGB(o, r, g, b) { o.r = clamp255(r); o.g = clamp255(g); o.b = clamp255(b); }

// ---------- individual generators ----------
const GEN = {
  asphalt(S) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 1, 5, 8);
      const grain = hash((u * S) | 0, (v * S) | 0, 3);
      const patch = fbm(u, v, 9, 3, 2);
      let c = 46 + n * 30 + grain * 22 - (patch > 0.62 ? 12 : 0);
      // cracks
      const cr = Math.abs(fbm(u, v, 21, 4, 3) - 0.5);
      const crack = cr < 0.008 ? 1 : 0;
      c -= crack * 25;
      setRGB(o, c, c * 0.99, c * 0.97);
      o.h = n * 0.6 + grain * 0.5 - crack * 1.5;
      o.rough = 0.92 - grain * 0.1;
    }, { normalStrength: 1.6 });
  },
  gravel(S) {
    return generate(S, (u, v, o) => {
      // cellular stones
      const gx = u * 24, gy = v * 24;
      let d1 = 9, d2 = 9, id = 0;
      const xi = Math.floor(gx), yi = Math.floor(gy);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j;
        const wx = ((cx % 24) + 24) % 24, wy = ((cy % 24) + 24) % 24;
        const px = cx + hash(wx, wy, 5), py = cy + hash(wx, wy, 6);
        const d = Math.hypot(px - gx, py - gy);
        if (d < d1) { d2 = d1; d1 = d; id = hash(wx, wy, 7); } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      const stone = Math.min(1, edge * 4);
      const base = 70 + id * 60;
      const tint = id > 0.7 ? [1.1, 0.95, 0.8] : [1, 0.97, 0.92];
      const c = base * (0.45 + 0.55 * stone);
      setRGB(o, c * tint[0], c * tint[1], c * tint[2]);
      o.h = stone * 0.9 + fbm(u, v, 2, 3, 16) * 0.2;
      o.rough = 0.85;
    }, { normalStrength: 2.4 });
  },
  concrete(S, tone = 1) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 31, 5, 4);
      const fine = hash((u * S) | 0, (v * S) | 0, 11);
      const stain = fbm(u, v * 0.5, 41, 3, 2);
      const pores = fine > 0.985 ? -40 : 0;
      let c = (150 + n * 50 + fine * 14 + pores - Math.max(0, stain - 0.55) * 160) * tone;
      // form lines
      const line = Math.abs(((v * 4) % 1) - 0.5) > 0.495 ? -18 : 0;
      c += line;
      setRGB(o, c, c * 0.985, c * 0.96);
      o.h = n * 0.5 + fine * 0.15 + (pores ? -0.6 : 0) + (line ? -0.4 : 0);
      o.rough = 0.88;
    }, { normalStrength: 1.4 });
  },
  brick(S) {
    return generate(S, (u, v, o) => {
      const rows = 16, cols = 8;
      const ry = v * rows, row = Math.floor(ry);
      const rx = u * cols + (row % 2 ? 0.5 : 0), col = Math.floor(rx);
      const fy = ry - row, fx = rx - col;
      const mortar = fy < 0.1 || fx < 0.05;
      const id = hash(col % cols, row, 13);
      const n = fbm(u, v, 3, 4, 8);
      if (mortar) {
        const c = 120 + n * 30;
        setRGB(o, c, c * 0.95, c * 0.88);
        o.h = 0; o.rough = 0.95;
      } else {
        const r = 120 + id * 50 + n * 30, g = 58 + id * 18 + n * 16, b = 44 + id * 10 + n * 12;
        const soot = Math.max(0, fbm(u, v, 77, 3, 2) - 0.55) * 200;
        setRGB(o, r - soot, g - soot * 0.6, b - soot * 0.5);
        o.h = 1 - (fbm(u, v, 5, 3, 32) * 0.3); o.rough = 0.85;
      }
    }, { normalStrength: 3 });
  },
  corrugated(S, color = [92, 108, 118]) {
    return generate(S, (u, v, o) => {
      const wave = Math.sin(u * Math.PI * 2 * 24);
      const n = fbm(u, v, 51, 4, 4);
      const rust = Math.max(0, fbm(u, v, 61, 5, 6) - 0.6) * 3;
      const streak = fbm(u * 4, v * 0.3, 71, 3, 4);
      const shade = 0.85 + wave * 0.1 + n * 0.12 - streak * 0.12;
      const r = color[0] * shade * (1 - rust) + 120 * rust;
      const g = color[1] * shade * (1 - rust) + 62 * rust;
      const b = color[2] * shade * (1 - rust) + 35 * rust;
      setRGB(o, r, g, b);
      o.h = wave * 0.6 + n * 0.1;
      o.rough = 0.55 + rust * 0.4 + n * 0.1;
    }, { normalStrength: 2.2 });
  },
  metal(S, color = [110, 112, 112]) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 81, 5, 6);
      const scratch = hash((u * S * 0.25) | 0, (v * S * 4) | 0, 2) > 0.995 ? 30 : 0;
      const rust = Math.max(0, fbm(u, v, 91, 4, 4) - 0.63) * 2.5;
      const s = 0.8 + n * 0.3;
      setRGB(o, color[0] * s * (1 - rust) + 115 * rust + scratch, color[1] * s * (1 - rust) + 60 * rust + scratch, color[2] * s * (1 - rust) + 30 * rust + scratch);
      o.h = n * 0.3 - rust * 0.3;
      o.rough = 0.45 + n * 0.2 + rust * 0.4;
    }, { normalStrength: 1 });
  },
  diamondplate(S) {
    return generate(S, (u, v, o) => {
      const k = 16;
      const fx = ((u * k) % 1) - 0.5, fy = ((v * k) % 1) - 0.5;
      const cell = (Math.floor(u * k) + Math.floor(v * k)) % 2;
      const a = cell ? (fx + fy) : (fx - fy);
      const b = cell ? (fx - fy) : (fx + fy);
      const bump = Math.abs(a) < 0.08 && Math.abs(b) < 0.32 ? 1 : 0;
      const n = fbm(u, v, 7, 4, 4);
      const c = 105 + n * 40 + bump * 25;
      setRGB(o, c, c, c * 1.02);
      o.h = bump * 1 + n * 0.1;
      o.rough = 0.4 + n * 0.3;
    }, { normalStrength: 2.5 });
  },
  wood(S) {
    return generate(S, (u, v, o) => {
      const planks = 4;
      const p = Math.floor(v * planks);
      const fy = v * planks - p;
      const id = hash(p, 0, 17);
      const grain = Math.sin((u * 30 + fbm(u, v, 19 + p, 3, 4) * 8) * Math.PI) * 0.5 + 0.5;
      const gap = fy < 0.04 ? 1 : 0;
      const c = (150 + id * 40) * (0.8 + grain * 0.2) - gap * 80;
      const n = fbm(u, v, 23, 4, 8);
      setRGB(o, c * 0.95 + n * 10, c * 0.74 + n * 8, c * 0.48);
      o.h = grain * 0.2 - gap;
      o.rough = 0.8;
    }, { normalStrength: 2 });
  },
  hazard(S) {
    return generate(S, (u, v, o) => {
      const s = ((u + v) * 4) % 1 < 0.5;
      const n = fbm(u, v, 29, 4, 6);
      const wear = n > 0.68 ? 1 : 0;
      if (wear) setRGB(o, 120 + n * 30, 120 + n * 30, 118 + n * 30);
      else if (s) setRGB(o, 210 + n * 30, 165 + n * 25, 20);
      else setRGB(o, 30 + n * 20, 30 + n * 20, 30 + n * 20);
      o.h = wear ? -0.2 : 0; o.rough = 0.6;
    }, { normalStrength: 1 });
  },
  roof(S) {
    return generate(S, (u, v, o) => {
      const rib = Math.abs(Math.sin(u * Math.PI * 8));
      const n = fbm(u, v, 33, 4, 4);
      const c = 70 + rib * 18 + n * 20;
      setRGB(o, c, c * 1.02, c * 1.04);
      o.h = rib * 0.8; o.rough = 0.6;
    }, { normalStrength: 2 });
  },
  facade(S, tone = 1) {
    // distant industrial building: concrete panels with a grid of dark windows
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 171, 4, 4);
      const cols = 6, rows = 4;
      const fx = (u * cols) % 1, fy = (v * rows) % 1;
      const win = fx > 0.18 && fx < 0.82 && fy > 0.3 && fy < 0.72;
      const lit = hash(Math.floor(u * cols), Math.floor(v * rows), 5) > 0.88;
      if (win) {
        const c = lit ? 150 : 34 + n * 20;
        setRGB(o, c * (lit ? 1 : 0.9), c * (lit ? 0.92 : 0.95), c * (lit ? 0.7 : 1.05));
        o.h = -0.5; o.rough = 0.25;
      } else {
        const c = (120 + n * 40) * tone;
        const band = fy < 0.06 ? -14 : 0;
        setRGB(o, c + band, c * 0.98 + band, c * 0.95 + band);
        o.h = n * 0.3; o.rough = 0.9;
      }
    }, { normalStrength: 1.2 });
  },
  floorpaint(S) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 43, 5, 4);
      const scuff = fbm(u, v, 47, 4, 8);
      const c = 105 + n * 30 - (scuff > 0.6 ? 25 : 0);
      setRGB(o, c * 0.82, c * 0.9, c * 0.82);
      o.h = n * 0.2; o.rough = 0.6 + (scuff > 0.6 ? 0.25 : 0);
    }, { normalStrength: 0.8 });
  },
  camo(S, palette) {
    return generate(S, (u, v, o) => {
      const a = fbm(u, v, 101, 4, 3), b = fbm(u, v, 131, 4, 5);
      let c = palette[0];
      if (a > 0.55) c = palette[1];
      if (b > 0.6) c = palette[2];
      if (a < 0.38) c = palette[3];
      const weave = (hash((u * S) | 0, (v * S) | 0, 4) - 0.5) * 12;
      setRGB(o, c[0] + weave, c[1] + weave, c[2] + weave);
      o.h = weave / 30 + (((u * S) | 0) % 2) * 0.05;
      o.rough = 0.9;
    }, { normalStrength: 1.5 });
  },
  fabric(S, base) {
    return generate(S, (u, v, o) => {
      const weave = (((u * S) | 0) + ((v * S) | 0)) % 2;
      const n = fbm(u, v, 141, 4, 6);
      const s = 0.85 + n * 0.25 + weave * 0.05;
      setRGB(o, base[0] * s, base[1] * s, base[2] * s);
      o.h = weave * 0.3 + n * 0.2; o.rough = 0.92;
    }, { normalStrength: 1.4 });
  },
  gunmetal(S) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 151, 4, 8);
      const st = hash((u * S) | 0, (v * S) | 0, 9);
      const c = 58 + n * 18 + st * 8;
      setRGB(o, c, c * 1.02, c * 1.06);
      o.h = st * 0.15; o.rough = 0.42 + n * 0.25;
    }, { normalStrength: 0.8 });
  },
  polymer(S) {
    return generate(S, (u, v, o) => {
      const n = fbm(u, v, 161, 3, 16);
      const st = hash((u * S) | 0, (v * S) | 0, 19);
      const c = 44 + n * 12 + st * 8;
      setRGB(o, c, c, c);
      o.h = st * 0.4 + n * 0.2; o.rough = 0.75;
    }, { normalStrength: 1.6 });
  },
};

/**
 * Shipping container atlas: top half = long side panel with logo,
 * bottom-left = door end, bottom-right = roof.
 */
function containerTex(S, color, brand) {
  const w = S, h = S / 2;
  const t = generate(S, (u, v, o) => {
    const top = v < 0.5;
    let wave, n = fbm(u, v, 201, 4, 6);
    if (top) wave = Math.sin(u * Math.PI * 2 * 30) > 0.2 ? 1 : 0;
    else if (u < 0.5) wave = Math.abs(((u * 2) % 0.5) - 0.25) < 0.01 ? -1 : (Math.sin(v * Math.PI * 2 * 14) > 0.3 ? 0.6 : 0);
    else wave = Math.sin(u * Math.PI * 2 * 12) > 0.6 ? 0.5 : 0;
    const rust = Math.max(0, fbm(u, v, 211, 5, 5) - 0.62) * 2.8;
    const dirt = Math.max(0, (v % 0.5) / 0.5 - 0.7) * 0.6; // lower edge grime
    const s = (0.8 + wave * 0.12 + n * 0.15) * (1 - dirt);
    setRGB(o, color[0] * s * (1 - rust) + 105 * rust, color[1] * s * (1 - rust) + 55 * rust, color[2] * s * (1 - rust) + 30 * rust);
    o.h = wave * 0.7 - rust * 0.2;
    o.rough = 0.55 + rust * 0.35;
  }, {
    w, h,
    normalStrength: 2.2,
    post(ctx) {
      // logo on side panel
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(240,240,235,0.9)';
      ctx.font = `bold ${Math.round(h * 0.13)}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(brand.name, w * 0.08, h * 0.17);
      ctx.font = `${Math.round(h * 0.05)}px monospace`;
      ctx.fillText(brand.code, w * 0.72, h * 0.08);
      // stripe
      ctx.fillStyle = brand.stripe;
      ctx.fillRect(w * 0.08, h * 0.27, w * 0.25, h * 0.025);
      // door handles on end panel
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#2a2a2a';
      for (let i = 0; i < 4; i++) ctx.fillRect(w * (0.08 + i * 0.105), h * 0.55, w * 0.008, h * 0.42);
      ctx.fillStyle = 'rgba(240,240,235,0.85)';
      ctx.font = `bold ${Math.round(h * 0.05)}px Arial, sans-serif`;
      ctx.fillText(brand.code.split(' ')[0], w * 0.05, h * 0.6);
      ctx.restore();
    },
  });
  return t;
}

const BRANDS = [
  { name: 'KESTREL LINES', code: 'KSTU 418820 4', stripe: '#e8b400' },
  { name: 'ORBA FREIGHT', code: 'ORBU 220471 9', stripe: '#d24a2a' },
  { name: 'NORDVAST', code: 'NVSU 830155 2', stripe: '#3a7ad9' },
  { name: 'TALLIS & ROWE', code: 'TRWU 517902 6', stripe: '#ffffff' },
  { name: 'MERIDIAN BOX', code: 'MDBU 664013 0', stripe: '#1fa36b' },
];

/** Sign / decal textures with text. */
export function signTexture(text, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#1d2a33';
  ctx.fillRect(0, 0, w, h);
  if (opts.border !== false) {
    ctx.strokeStyle = opts.fg || '#e9e4d8';
    ctx.lineWidth = h * 0.05;
    ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  }
  ctx.fillStyle = opts.fg || '#e9e4d8';
  let fs = Math.round(h * (opts.size || 0.5));
  ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
  while (fs > 8 && ctx.measureText(text).width > w * 0.86) { fs -= 2; ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + h * 0.03);
  // weathering
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 6, Math.random() * 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Painted floor decal (transparent canvas). */
export function decalTexture(kind) {
  const S = 256;
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  if (kind === 'oil') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(8,8,6,0.75)'); g.addColorStop(0.6, 'rgba(10,10,8,0.45)'); g.addColorStop(1, 'rgba(10,10,8,0)');
    ctx.fillStyle = g;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(S / 2 + (Math.random() - 0.5) * 80, S / 2 + (Math.random() - 0.5) * 80, 40 + Math.random() * 60, 30 + Math.random() * 50, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'bullet') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.18, 'rgba(20,18,15,0.85)'); g.addColorStop(0.3, 'rgba(60,55,50,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (kind === 'scorch') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(5,5,5,0.9)'); g.addColorStop(0.5, 'rgba(15,12,10,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function spriteTexture(kind) {
  const S = 128;
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  if (kind === 'flash') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.2, 'rgba(255,220,140,0.9)'); g.addColorStop(0.5, 'rgba(255,140,40,0.35)'); g.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,230,170,0.8)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath(); ctx.moveTo(S / 2, S / 2);
      ctx.lineTo(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48); ctx.stroke();
    }
  } else if (kind === 'smoke') {
    for (let i = 0; i < 18; i++) {
      const x = S / 2 + (Math.random() - 0.5) * S * 0.4, y = S / 2 + (Math.random() - 0.5) * S * 0.4, r = S * (0.15 + Math.random() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
  } else if (kind === 'spark') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,200,120,0.8)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (kind === 'dust') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(200,190,170,0.6)'); g.addColorStop(1, 'rgba(200,190,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (kind === 'glow') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- material library ----------
export class MaterialLibrary {
  constructor(quality = 'high', anisotropy = 4) {
    this.size = { low: 256, medium: 512, high: 512, ultra: 1024 }[quality] || 512;
    this.aniso = anisotropy;
    this.cache = new Map();
    this.textures = [];
  }

  _tex(canvas, srgb, repeat = true) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = this.aniso;
    t.needsUpdate = true;
    this.textures.push(t);
    return t;
  }

  _std(maps, params = {}) {
    const m = new THREE.MeshStandardMaterial({
      map: this._tex(maps.color, true),
      normalMap: this._tex(maps.normal, false),
      roughnessMap: this._tex(maps.rough, false),
      roughness: 1,
      metalness: params.metalness ?? 0,
      color: params.color ?? 0xffffff,
      ...(params.extra || {}),
    });
    if (params.normalScale) m.normalScale.set(params.normalScale, params.normalScale);
    return m;
  }

  /**
   * Material entries: { mat: THREE.Material, scale: meters per texture tile }
   */
  get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const S = this.size;
    let e;
    const interior = key.endsWith(':in');
    const base = interior ? key.slice(0, -3) : key;
    switch (base) {
      case 'asphalt': e = { mat: this._std(GEN.asphalt(S * 2 > 1024 ? 1024 : S * 2)), scale: 8 }; break;
      case 'gravel': e = { mat: this._std(GEN.gravel(S)), scale: 3 }; break;
      case 'concrete': e = { mat: this._std(GEN.concrete(S)), scale: 4 }; break;
      case 'concrete_dark': e = { mat: this._std(GEN.concrete(S, 0.7)), scale: 4 }; break;
      case 'brick': e = { mat: this._std(GEN.brick(S)), scale: 3 }; break;
      case 'corrugated_blue': e = { mat: this._std(GEN.corrugated(S, [86, 104, 118]), { metalness: 0.3 }), scale: 4 }; break;
      case 'corrugated_tan': e = { mat: this._std(GEN.corrugated(S, [150, 138, 112]), { metalness: 0.3 }), scale: 4 }; break;
      case 'corrugated_green': e = { mat: this._std(GEN.corrugated(S, [78, 98, 80]), { metalness: 0.3 }), scale: 4 }; break;
      case 'metal': e = { mat: this._std(GEN.metal(S), { metalness: 0.6 }), scale: 2 }; break;
      case 'rust': e = { mat: this._std(GEN.metal(S, [110, 66, 44]), { metalness: 0.4 }), scale: 3 }; break;
      case 'steel_green': e = { mat: this._std(GEN.metal(S, [60, 84, 64]), { metalness: 0.4 }), scale: 2 }; break;
      case 'steel_yellow': e = { mat: this._std(GEN.metal(S, [190, 150, 40]), { metalness: 0.3 }), scale: 2 }; break;
      case 'tank_white': e = { mat: this._std(GEN.metal(S, [196, 196, 188]), { metalness: 0.3 }), scale: 4 }; break;
      case 'diamondplate': e = { mat: this._std(GEN.diamondplate(S), { metalness: 0.7 }), scale: 1.5 }; break;
      case 'wood': e = { mat: this._std(GEN.wood(S)), scale: 1.5 }; break;
      case 'hazard': e = { mat: this._std(GEN.hazard(S / 2)), scale: 1 }; break;
      case 'roof': e = { mat: this._std(GEN.roof(S), { metalness: 0.4 }), scale: 4 }; break;
      case 'floorpaint': e = { mat: this._std(GEN.floorpaint(S)), scale: 6 }; break;
      case 'rubber': e = { mat: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }), scale: 1 }; break;
      case 'black': e = { mat: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 }), scale: 1 }; break;
      case 'lamp': e = { mat: new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 3 }), scale: 1 }; break;
      case 'lamp_red': e = { mat: new THREE.MeshStandardMaterial({ color: 0xff5040, emissive: 0xff2010, emissiveIntensity: 4 }), scale: 1 }; break;
      case 'lamp_green': e = { mat: new THREE.MeshStandardMaterial({ color: 0x60ff80, emissive: 0x20ff50, emissiveIntensity: 3 }), scale: 1 }; break;
      case 'window_dark': e = { mat: new THREE.MeshStandardMaterial({ color: 0x182028, roughness: 0.15, metalness: 0.6 }), scale: 1 }; break;
      case 'paint_yellow': e = { mat: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), scale: 1 }; break;
      case 'paint_white': e = { mat: new THREE.MeshStandardMaterial({ color: 0xbdbab0, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), scale: 1 }; break;
      case 'paint_blue': e = { mat: new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), scale: 1 }; break;
      case 'paint_orange': e = { mat: new THREE.MeshStandardMaterial({ color: 0xc8641e, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), scale: 1 }; break;
      case 'ballast': e = { mat: this._std(GEN.gravel(S), { extra: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } }), scale: 2.5 }; break;
      case 'floor_in': e = { mat: this._std(GEN.floorpaint(S), { extra: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } }), scale: 6 }; break;
      case 'backdrop': e = { mat: this._std(GEN.facade(256)), scale: 12 }; break;
      case 'backdrop2': e = { mat: this._std(GEN.facade(256, 0.75)), scale: 10 }; break;
      default:
        if (base.startsWith('container_')) {
          const colors = { red: [140, 46, 36], blue: [36, 78, 130], green: [48, 98, 66], orange: [196, 98, 34], grey: [120, 124, 126], white: [200, 200, 192] };
          const cname = base.slice(10);
          const idx = Object.keys(colors).indexOf(cname);
          const maps = containerTex(S * 2 > 1024 ? 1024 : S * 2, colors[cname] || colors.grey, BRANDS[(idx + 5) % BRANDS.length]);
          const m = this._std(maps, { metalness: 0.35 });
          m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping;
          e = { mat: m, scale: 0, atlas: true };
        } else {
          e = { mat: new THREE.MeshStandardMaterial({ color: 0xff00ff }), scale: 1 };
        }
    }
    if (interior) {
      const m = e.mat.clone();
      m.color = new THREE.Color(0.62, 0.62, 0.64);
      e = { ...e, mat: m };
    }
    this.cache.set(key, e);
    return e;
  }

  camo(team) {
    const key = 'camo_' + team;
    if (this.cache.has(key)) return this.cache.get(key).mat;
    const pal = team === 0
      ? [[70, 78, 70], [92, 98, 84], [48, 54, 50], [112, 112, 98]]
      : [[104, 92, 72], [128, 112, 86], [76, 66, 54], [60, 56, 48]];
    const m = this._std(GEN.camo(256, pal));
    this.cache.set(key, { mat: m });
    return m;
  }

  fabric(name, rgb) {
    const key = 'fabric_' + name;
    if (this.cache.has(key)) return this.cache.get(key).mat;
    const m = this._std(GEN.fabric(128, rgb));
    this.cache.set(key, { mat: m });
    return m;
  }

  gun(kind) {
    const key = 'gun_' + kind;
    if (this.cache.has(key)) return this.cache.get(key).mat;
    let m;
    if (kind === 'metal') m = this._std(GEN.gunmetal(256), { metalness: 0.75 });
    else if (kind === 'polymer') m = this._std(GEN.polymer(256), { metalness: 0.05 });
    else if (kind === 'tan') m = this._std(GEN.polymer(256), { color: 0xb59a72 });
    else if (kind === 'olive') m = this._std(GEN.polymer(256), { color: 0x7c8466 });
    else if (kind === 'wood') m = this._std(GEN.wood(256), { color: 0xb08060 });
    else m = new THREE.MeshStandardMaterial({ color: 0x222222 });
    this.cache.set(key, { mat: m });
    return m;
  }
}
