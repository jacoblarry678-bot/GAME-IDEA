// Physically based materials for the park, with procedural detail
// textures (albedo variation, normal and roughness maps) so painted steel,
// timber, concrete, brick and fabric each read as what they are.
import * as THREE from 'three';
import { fbm, heightToNormal, rng } from './noise.js';

// Part material name -> material family
export const FAMILY = {
  SmoothPlastic: 'paint', Plastic: 'paint',
  Metal: 'metal', DiamondPlate: 'metal', CorrodedMetal: 'metal',
  Wood: 'wood', WoodPlanks: 'planks',
  Concrete: 'stone', Pavement: 'stone', Slate: 'stone', Asphalt: 'stone', Cobblestone: 'stone', Ground: 'stone',
  Brick: 'brick', Fabric: 'fabric', Rubber: 'rubber', Grass: 'foliage',
  Glass: 'glass', Neon: 'neon',
};

// tile: studs covered by one texture repeat; metal: metalness;
// bump: normal strength; env: reflection strength
const SPEC = {
  paint: { tile: 9, metal: 0.0, bump: 0.6, env: 1.0 },
  metal: { tile: 7, metal: 0.55, bump: 0.5, env: 1.1 },
  wood: { tile: 6, metal: 0, bump: 1.4, env: 0.6 },
  planks: { tile: 7, metal: 0, bump: 1.6, env: 0.6 },
  stone: { tile: 10, metal: 0, bump: 1.6, env: 0.5 },
  brick: { tile: 4, metal: 0, bump: 2.2, env: 0.5 },
  fabric: { tile: 3, metal: 0, bump: 1.2, env: 0.35 },
  rubber: { tile: 4, metal: 0, bump: 0.5, env: 0.5 },
  foliage: { tile: 5, metal: 0, bump: 2.0, env: 0.4 },
};

let texSize = 512;
let anisotropy = 4;
const cache = new Map();

export function configureMaterials({ size, aniso }) {
  texSize = size;
  anisotropy = aniso;
}

function dataTex(bytes, N, srgb) {
  const t = new THREE.DataTexture(bytes, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Height, albedo multiplier and roughness fields for each family.
function pattern(name, N) {
  const h = new Float32Array(N * N), a = new Float32Array(N * N), r = new Float32Array(N * N);
  const seed = { paint: 11, metal: 23, wood: 37, planks: 41, stone: 53, brick: 67, fabric: 79, rubber: 83, foliage: 97 }[name];
  if (name === 'paint' || name === 'rubber') {
    const blot = fbm(N, 3, 5, seed);
    const fine = fbm(N, 96, 2, seed + 1);
    for (let i = 0; i < h.length; i++) {
      h[i] = fine[i] * 0.7 + blot[i] * 0.3;
      a[i] = 0.9 + (blot[i] - 0.5) * 0.08 + (fine[i] - 0.5) * 0.03;
      r[i] = name === 'rubber' ? 0.82 + (fine[i] - 0.5) * 0.1 : 0.36 + (blot[i] - 0.5) * 0.16 + (fine[i] - 0.5) * 0.06;
    }
  } else if (name === 'metal') {
    const streak = fbm(N, 2, 4, seed, { cellsY: 160 });
    const blot = fbm(N, 3, 5, seed + 2);
    const pit = fbm(N, 128, 1, seed + 3);
    for (let i = 0; i < h.length; i++) {
      h[i] = streak[i] * 0.6 + pit[i] * 0.4;
      a[i] = 0.88 + (streak[i] - 0.5) * 0.08 + (blot[i] - 0.5) * 0.12;
      r[i] = 0.34 + (streak[i] - 0.5) * 0.14 + (blot[i] - 0.5) * 0.22;
    }
  } else if (name === 'wood' || name === 'planks') {
    const warp = fbm(N, 3, 4, seed);
    const grain = fbm(N, 3, 4, seed + 1, { cellsY: 110 });
    const rand = rng(seed + 5);
    const rows = 7;
    const rowH = N / rows;
    const offsets = Array.from({ length: rows }, () => rand());
    const tones = Array.from({ length: rows * 2 }, () => 0.85 + rand() * 0.3);
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / rowH);
      const inRow = y - row * rowH;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const ring = 0.5 + 0.5 * Math.sin((y / N * 26 + warp[i] * 5 + grain[i] * 0.8) * Math.PI * 2);
        let tone = 1, seam = 1;
        if (name === 'planks') {
          const along = (x / N + offsets[row]) % 1;
          const piece = along < 0.5 ? 0 : 1;
          tone = tones[row * 2 + piece];
          const edge = Math.min(inRow, rowH - inRow);
          const butt = Math.min(Math.abs(along - 0.5), along, 1 - along) * N;
          if (edge < 1.6 || butt < 1.2) seam = 0;
        }
        h[i] = seam ? ring * 0.35 + grain[i] * 0.65 : 0;
        a[i] = seam ? clamp01((0.72 + ring * 0.12 + (grain[i] - 0.5) * 0.24) * tone) : 0.35;
        r[i] = seam ? 0.62 + (grain[i] - 0.5) * 0.18 : 0.9;
      }
    }
  } else if (name === 'stone') {
    const base = fbm(N, 6, 6, seed);
    const speck = fbm(N, 180, 1, seed + 1);
    const stain = fbm(N, 2, 4, seed + 2);
    for (let i = 0; i < h.length; i++) {
      h[i] = base[i] * 0.45 + speck[i] * 0.55;
      a[i] = 0.84 + (base[i] - 0.5) * 0.14 + (speck[i] - 0.5) * 0.14 + (stain[i] - 0.5) * 0.14;
      r[i] = 0.86 + (speck[i] - 0.5) * 0.12;
    }
  } else if (name === 'brick') {
    const rows = 16, cols = 6;
    const bh = N / rows, bw = N / cols;
    const rand = rng(seed);
    const tone = Array.from({ length: rows * cols }, () => 0.82 + rand() * 0.22);
    const n = fbm(N, 16, 4, seed + 1);
    const speck = fbm(N, 128, 1, seed + 2);
    const mortar = Math.max(1.5, N / 220);
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / bh);
      const yIn = y - row * bh;
      const shift = row % 2 ? bw / 2 : 0;
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const xs = (x + shift) % N;
        const col = Math.floor(xs / bw);
        const xIn = xs - col * bw;
        const m = Math.min(yIn, bh - yIn, xIn, bw - xIn) < mortar;
        if (m) {
          h[i] = 0.1 + speck[i] * 0.1;
          a[i] = 0.98;
          r[i] = 0.95;
        } else {
          h[i] = 0.75 + n[i] * 0.15 + speck[i] * 0.1;
          a[i] = clamp01(0.68 * tone[row * cols + col] + (n[i] - 0.5) * 0.12 + (speck[i] - 0.5) * 0.08);
          r[i] = 0.84 + (speck[i] - 0.5) * 0.1;
        }
      }
    }
  } else if (name === 'fabric') {
    const n = fbm(N, 8, 4, seed);
    const threads = N / 6;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const wx = Math.sin((x / N) * threads * Math.PI * 2);
        const wy = Math.sin((y / N) * threads * Math.PI * 2);
        const over = ((Math.floor((x / N) * threads) + Math.floor((y / N) * threads)) & 1) ? wx : wy;
        h[i] = 0.5 + over * 0.35 + (n[i] - 0.5) * 0.3;
        a[i] = 0.86 + over * 0.05 + (n[i] - 0.5) * 0.1;
        r[i] = 0.93;
      }
    }
  } else {
    // foliage: clumpy leaves
    const big = fbm(N, 6, 5, seed);
    const leaf = fbm(N, 40, 3, seed + 1);
    for (let i = 0; i < h.length; i++) {
      h[i] = leaf[i] * 0.7 + big[i] * 0.3;
      a[i] = 0.62 + leaf[i] * 0.3 + (big[i] - 0.5) * 0.2;
      r[i] = 0.78;
    }
  }
  return { h, a, r };
}

function textureSet(name) {
  const N = texSize;
  const { h, a, r } = pattern(name, N);
  const alb = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  let sum = 0;
  for (let i = 0; i < h.length; i++) {
    const v = clamp01(a[i]) * 255;
    sum += a[i];
    alb[i * 4] = alb[i * 4 + 1] = alb[i * 4 + 2] = v;
    alb[i * 4 + 3] = 255;
    const g = clamp01(r[i]) * 255;
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = g;
    rough[i * 4 + 3] = 255;
  }
  const spec = SPEC[name];
  const repeat = 1 / spec.tile;
  const maps = {
    map: dataTex(alb, N, false),
    normalMap: dataTex(heightToNormal(h, N, spec.bump * N / 256), N, false),
    roughnessMap: dataTex(rough, N, false),
  };
  for (const t of Object.values(maps)) t.repeat.set(repeat, repeat);
  // the detail map darkens a little on average; brighten to keep the
  // part's own color
  return { maps, gain: 1 / (sum / h.length) };
}

export function familyOf(matName) {
  return FAMILY[matName] || 'paint';
}

// Shared material for a family (vertex colors carry each part's color).
export function material(family) {
  if (cache.has(family)) return cache.get(family);
  let m;
  if (family === 'neon') {
    m = new THREE.MeshBasicMaterial({ vertexColors: true });
    m.color.setScalar(2.4); // brighter than white so it blooms
  } else if (family === 'glass') {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true, transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0.1, depthWrite: false, envMapIntensity: 1.6,
    });
  } else {
    const spec = SPEC[family] || SPEC.paint;
    const { maps, gain } = textureSet(family);
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      ...maps,
      roughness: 1,
      metalness: spec.metal,
      envMapIntensity: spec.env,
    });
    m.color.setScalar(gain);
    m.normalScale.set(1, 1);
  }
  m.name = family;
  cache.set(family, m);
  return m;
}

// ----------------------------------------------------------------- ground
// Grass, sand and rock textures for the ground and hills, drawn with
// blades and pebbles on a canvas.
export function groundTextures(kind) {
  const key = `ground:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const N = texSize * 2;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const rand = rng(kind === 'grass' ? 7 : kind === 'sand' ? 8 : 9);
  const base = fbm(N / 2, 8, 6, kind.length * 31);
  const img = ctx.createImageData(N, N);
  const palette = {
    grass: [[62, 104, 40], [92, 132, 52], [118, 128, 66]],
    sand: [[196, 176, 136], [214, 196, 156], [180, 160, 124]],
    rock: [[118, 114, 108], [140, 136, 128], [96, 92, 88]],
    dirt: [[112, 88, 62], [132, 106, 76], [92, 72, 52]],
  }[kind];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = base[(y >> 1) * (N / 2) + (x >> 1)];
      const [p, q] = v < 0.5 ? [palette[0], palette[1]] : [palette[1], palette[2]];
      const t = v < 0.5 ? v * 2 : (v - 0.5) * 2;
      const i = (y * N + x) * 4;
      const jitter = (rand() - 0.5) * 18;
      img.data[i] = p[0] + (q[0] - p[0]) * t + jitter;
      img.data[i + 1] = p[1] + (q[1] - p[1]) * t + jitter;
      img.data[i + 2] = p[2] + (q[2] - p[2]) * t + jitter;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const strokes = kind === 'grass' ? N * 22 : kind === 'sand' ? N * 3 : N * 4;
  for (let i = 0; i < strokes; i++) {
    const x = rand() * N, y = rand() * N;
    if (kind === 'grass') {
      const len = 4 + rand() * 10;
      const ang = -Math.PI / 2 + (rand() - 0.5) * 1.3;
      const g = 90 + rand() * 90;
      ctx.strokeStyle = `rgba(${40 + rand() * 50},${g},${20 + rand() * 40},${0.35 + rand() * 0.5})`;
      ctx.lineWidth = 0.8 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    } else {
      const r = kind === 'sand' ? 0.6 + rand() * 1.2 : 1 + rand() * 4;
      const l = kind === 'sand' ? 150 + rand() * 90 : 70 + rand() * 90;
      ctx.fillStyle = `rgba(${l},${l * 0.95},${l * 0.85},${0.25 + rand() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  // normal map from the image brightness
  const px = ctx.getImageData(0, 0, N, N).data;
  const h = new Float32Array(N * N);
  for (let i = 0; i < h.length; i++) h[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 765;
  const normalMap = dataTex(heightToNormal(h, N, kind === 'grass' ? 3 : 2.2), N, false);
  const out = { map, normalMap };
  cache.set(key, out);
  return out;
}
