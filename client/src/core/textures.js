/**
 * Procedural PBR texture generation.
 *
 * Every surface in the game is authored here at runtime on a 2D canvas:
 * albedo, roughness and a derived normal map. Nothing is downloaded, nothing
 * is licensed, and the whole set regenerates at a different resolution when
 * the player changes texture quality.
 *
 * To swap in real art later, replace `TextureLibrary.get()` with a loader —
 * every material in the game asks for its maps through this one door.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------- noise

/** Classic value noise with fBm on top. Deterministic per seed. */
function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    const u = h & 1 ? x : y;
    const v = h & 2 ? x : y;
    return (h & 4 ? -u : u) + (h & 8 ? -v : v);
  };

  const noise2 = (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = perm[X] + Y;
    const B = perm[X + 1] + Y;
    return lerp(
      lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
      lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u),
      v
    );
  };

  const fbm = (x, y, oct = 5, lac = 2.03, gain = 0.5) => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  };

  return { noise2, fbm, rnd };
}

// ---------------------------------------------------------------- helpers

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** Height field -> tangent-space normal map (sobel). */
function normalFromHeight(height, size, strength = 2.4) {
  const out = new ImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = tl + 2 * l + bl - tr - 2 * r - br;
      const dy = tl + 2 * t + tr - bl - 2 * b - br;
      let nx = dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function toTexture(source, { repeat = 1, srgb = false, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(source);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- surfaces
//
// Each generator paints an albedo canvas, a roughness canvas and fills a
// height array which becomes the normal map.

const GENERATORS = {
  /** Wet, pitted, mortared blocks. The backbone of the Labyrinth. */
  stone(ctx, rough, height, size, n) {
    const brick = size / 4;
    ctx.fillStyle = '#4a423c';
    ctx.fillRect(0, 0, size, size);
    const rctx = rough.getContext('2d');
    rctx.fillStyle = '#8a8a8a';
    rctx.fillRect(0, 0, size, size);

    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? brick * 0.5 : 0;
      for (let col = -1; col < 5; col++) {
        const x = col * brick + offset + 2;
        const y = row * brick + 2;
        const w = brick - 4;
        const h = brick - 4;
        const shade = 66 + Math.floor(n.rnd() * 34);
        ctx.fillStyle = `rgb(${shade + 8},${shade + 3},${shade})`;
        ctx.fillRect(x, y, w, h);
        // chipped corners
        if (n.rnd() < 0.4) {
          ctx.fillStyle = `rgb(${shade - 12},${shade - 14},${shade - 15})`;
          const cw = w * (0.1 + n.rnd() * 0.2);
          ctx.fillRect(n.rnd() < 0.5 ? x : x + w - cw, n.rnd() < 0.5 ? y : y + h - cw, cw, cw);
        }
      }
    }

    // grime, damp streaks and fine grain over everything
    const img = ctx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const f = n.fbm(x / 26, y / 26, 5);
        const grain = n.fbm(x / 3.2, y / 3.2, 2) * 0.5;
        const damp = Math.max(0, n.fbm(x / 60 + 11, y / 14 + 3, 4)) * 0.85;
        const mul = 1 + f * 0.45 + grain * 0.2 - damp * 0.5;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] * mul));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] * mul * 0.98));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] * mul * 0.94));
        // mortar lines carve into the height field
        const bx = (x % brick) / brick;
        const by = (y % brick) / brick;
        const edge = Math.min(bx, 1 - bx, by, 1 - by);
        const mortar = edge < 0.04 ? 0 : 1;
        height[y * size + x] = mortar * (0.5 + f * 0.45 + grain * 0.25);
        // wet stone is smoother
        const r = 200 - damp * 150 + f * 30;
        rctx.fillStyle = `rgb(${r | 0},${r | 0},${r | 0})`;
        rctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  /** Corroded iron with flaking paint — the Torture Gallery and boiler. */
  rust(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const base = n.fbm(x / 30, y / 30, 6);
        const patch = n.fbm(x / 9 + 40, y / 9 - 20, 4);
        const rustAmt = Math.max(0, base * 0.7 + patch * 0.55);
        const pit = n.fbm(x / 2.4, y / 2.4, 2);
        // steel underneath, oxide on top
        const steel = [92, 95, 100];
        const oxide = [156, 78, 36];
        const t = Math.min(1, Math.max(0, rustAmt * 1.5));
        let r = steel[0] + (oxide[0] - steel[0]) * t;
        let g = steel[1] + (oxide[1] - steel[1]) * t;
        let b = steel[2] + (oxide[2] - steel[2]) * t;
        const v = 0.72 + pit * 0.5;
        img.data[i] = Math.min(255, r * v);
        img.data[i + 1] = Math.min(255, g * v);
        img.data[i + 2] = Math.min(255, b * v);
        img.data[i + 3] = 255;
        height[y * size + x] = 0.5 + rustAmt * 0.6 + pit * 0.3;
        const rr = (110 + t * 130 + pit * 30) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.min(255, rr);
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
    // rivets
    for (let k = 0; k < 18; k++) {
      const x = n.rnd() * size;
      const y = n.rnd() * size;
      const r = size / 90 + n.rnd() * (size / 120);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, 'rgba(150,120,95,0.95)');
      g.addColorStop(1, 'rgba(40,28,20,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
  },

  /** Dark varnished boards, split and water-damaged. */
  wood(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    const plank = size / 6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const pIdx = Math.floor(y / plank);
        const jitter = ((pIdx * 37) % 13) / 13;
        const grain = Math.sin((x * 0.06 + jitter * 6) + n.fbm(x / 40, y / 6 + pIdx, 4) * 7);
        const knot = n.fbm(x / 18 + pIdx * 3, y / 18, 3);
        const v = 0.55 + grain * 0.16 + knot * 0.3;
        const seam = (y % plank) / plank;
        const edge = seam < 0.03 || seam > 0.97 ? 0.35 : 1;
        img.data[i] = Math.min(255, 132 * v * edge);
        img.data[i + 1] = Math.min(255, 92 * v * edge);
        img.data[i + 2] = Math.min(255, 60 * v * edge);
        img.data[i + 3] = 255;
        height[y * size + x] = edge * (0.55 + grain * 0.2 + knot * 0.2);
        const r = (150 + grain * 40 - knot * 30) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(20, Math.min(255, r));
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Cracked institutional tile — the Blood Corridor and the Cistern. */
  tile(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const t = size / 8;
    ctx.fillStyle = '#161314';
    ctx.fillRect(0, 0, size, size);
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const v = 74 + n.rnd() * 30;
        ctx.fillStyle = `rgb(${v * 0.95 | 0},${v * 0.86 | 0},${v * 0.82 | 0})`;
        ctx.fillRect(gx * t + 1.5, gy * t + 1.5, t - 3, t - 3);
      }
    }
    const img = ctx.getImageData(0, 0, size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const stain = Math.max(0, n.fbm(x / 34 + 7, y / 12, 5));
        const blood = Math.max(0, n.fbm(x / 55 - 12, y / 22 + 40, 4) - 0.12) * 1.8;
        img.data[i] = Math.min(255, img.data[i] * (1 - stain * 0.4) + blood * 70);
        img.data[i + 1] = Math.min(255, img.data[i + 1] * (1 - stain * 0.55) + blood * 8);
        img.data[i + 2] = Math.min(255, img.data[i + 2] * (1 - stain * 0.55) + blood * 8);
        const gx = (x % t) / t;
        const gy = (y % t) / t;
        const grout = Math.min(gx, 1 - gx, gy, 1 - gy) < 0.05 ? 0.15 : 1;
        height[y * size + x] = grout * (0.75 + n.fbm(x / 4, y / 4, 2) * 0.15);
        const r = (60 + stain * 120 + (1 - grout) * 60) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.min(255, r);
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Polished black rock veined with something that catches the light. */
  obsidian(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const f = n.fbm(x / 44, y / 44, 6);
        const vein = Math.abs(n.fbm(x / 20 + 5, y / 20 - 9, 4));
        const v = vein < 0.045 ? 1 : 0;
        const base = 26 + f * 30;
        img.data[i] = Math.min(255, base + v * 118);
        img.data[i + 1] = Math.min(255, base * 0.82 + v * 14);
        img.data[i + 2] = Math.min(255, base * 0.95 + v * 26);
        img.data[i + 3] = 255;
        height[y * size + x] = 0.6 + f * 0.3 - v * 0.35;
        const r = (34 + f * 55 - v * 20) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(8, Math.min(255, r));
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Packed bone and dust. The Ossuary. */
  bone(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    ctx.fillStyle = '#5c5346';
    ctx.fillRect(0, 0, size, size);
    for (let k = 0; k < 150; k++) {
      const x = n.rnd() * size;
      const y = n.rnd() * size;
      const l = size / 22 + n.rnd() * (size / 9);
      const w = size / 90 + n.rnd() * (size / 110);
      const a = n.rnd() * Math.PI;
      const sh = 120 + n.rnd() * 70;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = `rgb(${sh},${sh * 0.94 | 0},${sh * 0.8 | 0})`;
      ctx.beginPath();
      ctx.roundRect(-l / 2, -w / 2, l, w, w / 2);
      ctx.fill();
      ctx.restore();
    }
    const img = ctx.getImageData(0, 0, size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const f = n.fbm(x / 18, y / 18, 4);
        const mul = 0.7 + f * 0.5;
        img.data[i] *= mul;
        img.data[i + 1] *= mul;
        img.data[i + 2] *= mul;
        height[y * size + x] = img.data[i] / 255;
        const r = (170 + f * 50) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.min(255, r);
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Peeling damask wallpaper over plaster. The Archives and Chapel. */
  wallpaper(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    ctx.fillStyle = '#6d5744';
    ctx.fillRect(0, 0, size, size);
    // damask motif
    const step = size / 4;
    ctx.strokeStyle = 'rgba(150,120,70,0.35)';
    ctx.lineWidth = Math.max(1, size / 220);
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const cx = gx * step + step / 2;
        const cy = gy * step + step / 2;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.06) {
          const r = step * 0.3 * (0.6 + 0.4 * Math.cos(a * 4));
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r * 1.25;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    const img = ctx.getImageData(0, 0, size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const peel = n.fbm(x / 42 + 3, y / 30 - 8, 5);
        const torn = peel > 0.22 ? 1 : 0; // exposed plaster
        const grime = Math.max(0, n.fbm(x / 70, y / 16 + 2, 4)) * 0.9;
        if (torn) {
          const p = 58 + n.fbm(x / 8, y / 8, 3) * 30;
          img.data[i] = p; img.data[i + 1] = p * 0.95; img.data[i + 2] = p * 0.9;
        }
        const mul = 1 - grime * 0.55;
        img.data[i] *= mul; img.data[i + 1] *= mul * 0.97; img.data[i + 2] *= mul * 0.93;
        height[y * size + x] = torn ? 0.35 : 0.75 + peel * 0.2;
        const r = (torn ? 210 : 150) - grime * 40;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(20, Math.min(255, r | 0));
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Wet concrete for the Inner Labyrinth floors. */
  concrete(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const f = n.fbm(x / 28, y / 28, 6);
        const speck = n.fbm(x / 2, y / 2, 2);
        const crack = Math.abs(n.fbm(x / 30 + 60, y / 30 + 12, 3)) < 0.03 ? 0.4 : 1;
        const v = (66 + f * 42 + speck * 16) * crack;
        img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.95;
        img.data[i + 3] = 255;
        height[y * size + x] = crack * (0.6 + f * 0.3 + speck * 0.12);
        const wet = Math.max(0, n.fbm(x / 55 - 4, y / 55 + 9, 4));
        const r = (185 - wet * 140) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(15, Math.min(255, r));
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },

  /** Flesh/leather for Cenobite garments. */
  leather(ctx, rough, height, size, n) {
    const rctx = rough.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const cell = n.fbm(x / 5, y / 5, 3);
        const f = n.fbm(x / 40, y / 40, 4);
        const v = 0.6 + cell * 0.5 + f * 0.3;
        img.data[i] = Math.min(255, 26 * v);
        img.data[i + 1] = Math.min(255, 22 * v);
        img.data[i + 2] = Math.min(255, 25 * v);
        img.data[i + 3] = 255;
        height[y * size + x] = 0.5 + cell * 0.45;
        const r = (70 + cell * 60 + f * 30) | 0;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.min(255, r);
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
  },
};

// ---------------------------------------------------------------- library

export class TextureLibrary {
  constructor(size = 512, anisotropy = 8) {
    this.size = size;
    this.anisotropy = anisotropy;
    this.cache = new Map();
    this.materials = new Map();
  }

  /** @returns {{map:Texture, normalMap:Texture, roughnessMap:Texture}} */
  get(kind, seed = 1) {
    const key = `${kind}:${seed}:${this.size}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const gen = GENERATORS[kind] || GENERATORS.stone;
    const size = this.size;
    const albedo = canvas(size);
    const rough = canvas(size);
    const ctx = albedo.getContext('2d', { willReadFrequently: true });
    const height = new Float32Array(size * size);
    const n = makeNoise(seed * 7919 + 13);

    gen(ctx, rough, height, size, n);

    const normalCanvas = canvas(size);
    normalCanvas.getContext('2d').putImageData(normalFromHeight(height, size, 2.2), 0, 0);

    const set = {
      map: toTexture(albedo, { srgb: true, aniso: this.anisotropy }),
      roughnessMap: toTexture(rough, { aniso: this.anisotropy }),
      normalMap: toTexture(normalCanvas, { aniso: this.anisotropy }),
    };
    this.cache.set(key, set);
    return set;
  }

  /**
   * Cached MeshStandardMaterial for a surface kind.
   * @param {string} kind  key in GENERATORS
   * @param {object} opts  { repeat, color, metalness, normalScale, emissive }
   */
  material(kind, opts = {}) {
    const key = `${kind}|${JSON.stringify(opts)}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const maps = this.get(kind, opts.seed || 1);
    const repeat = opts.repeat || 1;
    // clone so different repeats don't fight over one texture
    const map = maps.map.clone();
    const normalMap = maps.normalMap.clone();
    const roughnessMap = maps.roughnessMap.clone();
    for (const t of [map, normalMap, roughnessMap]) {
      t.repeat.set(repeat, opts.repeatY || repeat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      color: opts.color !== undefined ? opts.color : 0xffffff,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.08,
      roughness: 1.0,
      normalScale: new THREE.Vector2(opts.normalScale || 1, opts.normalScale || 1),
      emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 1,
      side: opts.side || THREE.FrontSide,
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1,
    });
    this.materials.set(key, mat);
    return mat;
  }

  /** Plain coloured material with a subtle procedural break-up. */
  simple(color, { rough = 0.75, metal = 0.05, emissive = 0x000000, ei = 1 } = {}) {
    const key = `simple|${color}|${rough}|${metal}|${emissive}|${ei}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei,
    });
    this.materials.set(key, mat);
    return mat;
  }

  dispose() {
    for (const set of this.cache.values()) {
      set.map.dispose();
      set.normalMap.dispose();
      set.roughnessMap.dispose();
    }
    for (const m of this.materials.values()) m.dispose();
    this.cache.clear();
    this.materials.clear();
  }
}

export { makeNoise };
