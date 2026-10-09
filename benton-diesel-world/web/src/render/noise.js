// Tileable noise fields for procedural textures (all values 0..1).

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise that wraps around an N x N image: cx by cy lattice cells.
function octave(out, N, cx, cy, amp, rand) {
  const lat = new Float32Array(cx * cy);
  for (let i = 0; i < lat.length; i++) lat[i] = rand();
  const sx = cx / N, sy = cy / N;
  for (let y = 0; y < N; y++) {
    const fy = y * sy;
    const iy = Math.floor(fy);
    let ty = fy - iy;
    ty = ty * ty * (3 - 2 * ty);
    const r0 = (iy % cy) * cx, r1 = ((iy + 1) % cy) * cx;
    for (let x = 0; x < N; x++) {
      const fx = x * sx;
      const ix = Math.floor(fx);
      let tx = fx - ix;
      tx = tx * tx * (3 - 2 * tx);
      const c0 = ix % cx, c1 = (ix + 1) % cx;
      const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
      const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
      out[y * N + x] += (a + (b - a) * ty) * amp;
    }
  }
}

// Fractal noise; cells = lattice cells across at the first octave
// (cellsY for stretched noise such as wood grain and brushed metal).
export function fbm(N, cells, octaves, seed, { gain = 0.5, cellsY = cells } = {}) {
  const out = new Float32Array(N * N);
  const rand = rng(seed);
  let amp = 1, total = 0, cx = cells, cy = cellsY;
  for (let o = 0; o < octaves && cx <= N && cy <= N; o++) {
    octave(out, N, Math.max(1, Math.round(cx)), Math.max(1, Math.round(cy)), amp, rand);
    total += amp;
    amp *= gain;
    cx *= 2;
    cy *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return normalize(out);
}

// stretch values to fill 0..1
export function normalize(a) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < lo) lo = a[i];
    if (a[i] > hi) hi = a[i];
  }
  const k = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
  return a;
}

// Height field -> tangent-space normal map (RGBA bytes).
export function heightToNormal(h, N, strength) {
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    const ym = ((y - 1 + N) % N) * N, yp = ((y + 1) % N) * N, yr = y * N;
    for (let x = 0; x < N; x++) {
      const xm = (x - 1 + N) % N, xp = (x + 1) % N;
      const dx = (h[yr + xp] - h[yr + xm]) * strength;
      const dy = (h[yp + x] - h[ym + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (yr + x) * 4;
      out[i] = (-dx / len * 0.5 + 0.5) * 255;
      out[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      out[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}
