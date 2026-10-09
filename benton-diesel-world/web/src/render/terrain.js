// The ground as one smooth heightfield: grassy hills, the rocky mountain
// in Backwoods Junction, the lake basin with its sandy shore and rolling
// countryside beyond the park. Collisions walk on the same heights.
import * as THREE from 'three';
import { groundTextures } from './materials.js';

const BASE = -0.02;

function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm2(x, z, oct = 4) {
  let s = 0, a = 0.5, t = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x, z) * a;
    t += a;
    x = x * 2.03 + 17.1;
    z = z * 2.03 + 3.7;
    a *= 0.5;
  }
  return s / t;
}

// smooth maximum so hills melt into the flat ground
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

export class Terrain {
  constructor(data) {
    const bounds = data.config.Bounds;
    this.rect = { x0: bounds.minX - 150, x1: bounds.maxX + 150, z0: bounds.minZ - 150, z1: bounds.maxZ + 230 };
    this.hills = [];
    this.rocks = [];
    this.lake = null;
    this.ponds = [];
    for (const op of data.terrain) {
      if (op.kind === 'ball') {
        const b = { x: op.center[0], y: op.center[1], z: op.center[2], r: op.radius };
        (op.material === 'Grass' ? this.hills : this.rocks).push(b);
      } else if (op.kind === 'cylinder' && op.material === 'Water') {
        this.lake = { x: op.cf[0], z: op.cf[2], r: op.radius, level: op.cf[1] + op.height / 2 + 0.1 };
      } else if (op.kind === 'block' && op.material === 'Water') {
        this.ponds.push({ x: op.cf[0], z: op.cf[2], sx: op.size[0], sz: op.size[2], level: op.cf[1] + op.size[1] / 2 - 0.7 });
      }
    }
  }

  // how far outside the park (plus margin) a point is
  outside(x, z) {
    const r = this.rect;
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    return Math.hypot(dx, dz);
  }

  // height and how rocky / sandy the ground is there
  sample(x, z, out = { h: 0, rock: 0, sand: 0 }) {
    let h = BASE;
    let rock = 0, sand = 0;
    for (const b of this.hills) {
      const d2 = (x - b.x) ** 2 + (z - b.z) ** 2;
      if (d2 < b.r * b.r) h = smax(h, b.y + Math.sqrt(b.r * b.r - d2), 6);
    }
    for (const b of this.rocks) {
      const d2 = (x - b.x) ** 2 + (z - b.z) ** 2;
      if (d2 < b.r * b.r) {
        const cap = b.y + Math.sqrt(b.r * b.r - d2);
        if (cap > h - 1) rock = Math.max(rock, THREE.MathUtils.smoothstep(cap, 0.4, 3));
        // rough, craggy rock
        h = smax(h, cap + (fbm2(x * 0.18, z * 0.18, 3) - 0.5) * Math.min(4, Math.max(0, cap) * 0.35), 3);
      }
    }
    // rolling countryside beyond the park
    const far = this.outside(x, z);
    if (far > 0) {
      const k = THREE.MathUtils.smoothstep(far, 0, 380);
      h = Math.max(h, BASE + k * (8 + fbm2(x * 0.004, z * 0.004, 4) * 95) + (fbm2(x * 0.03, z * 0.03, 2) - 0.5) * 3 * k);
    }
    if (this.lake) {
      const L = this.lake;
      const d = Math.hypot(x - L.x, z - L.z);
      if (d < L.r + 12) {
        const bed = -2.8;
        const t = THREE.MathUtils.smoothstep(d, L.r - 16, L.r + 4);
        h = Math.min(h, bed + (BASE - bed) * t);
        sand = Math.max(sand, 1 - THREE.MathUtils.smoothstep(d, L.r + 4, L.r + 9));
      }
    }
    for (const p of this.ponds) {
      if (Math.abs(x - p.x) < p.sx / 2 && Math.abs(z - p.z) < p.sz / 2) h = Math.min(h, p.level - 1.5);
    }
    out.h = h;
    out.rock = rock;
    out.sand = sand;
    return out;
  }

  heightAt(x, z) {
    return this.sample(x, z, this.tmp || (this.tmp = { h: 0, rock: 0, sand: 0 })).h;
  }

  // grid lines: dense inside the park, sparse in the far countryside
  static axis(lo, hi, core, step) {
    const out = [];
    for (let v = -1500; v < lo - 260; v += step * 10) out.push(v);
    for (let v = lo - 260; v < lo; v += step * 2.5) out.push(v);
    for (let v = lo; v < hi; v += step) out.push(v);
    for (let v = hi; v < hi + 260; v += step * 2.5) out.push(v);
    for (let v = hi + 260; v <= 1500; v += step * 10) out.push(v);
    return out;
  }

  buildMesh(quality) {
    const step = quality.name === 'low' ? 8 : quality.name === 'ultra' ? 4 : 5;
    const xs = Terrain.axis(-660, 660, 0, step);
    const zs = Terrain.axis(-680, 640, 0, step);
    const nx = xs.length, nz = zs.length;
    const pos = new Float32Array(nx * nz * 3);
    const uv = new Float32Array(nx * nz * 2);
    const col = new Float32Array(nx * nz * 3);
    const splat = new Float32Array(nx * nz * 3);
    const s = { h: 0, rock: 0, sand: 0 };
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = xs[i], z = zs[j];
        this.sample(x, z, s);
        const k = j * nx + i;
        pos[k * 3] = x; pos[k * 3 + 1] = s.h; pos[k * 3 + 2] = z;
        uv[k * 2] = x; uv[k * 2 + 1] = z;
        // large scale color variation breaks up the tiling
        const m = fbm2(x * 0.012, z * 0.012, 3);
        const dry = fbm2(x * 0.004 + 40, z * 0.004, 2);
        col[k * 3] = 0.86 + m * 0.22 + dry * 0.12;
        col[k * 3 + 1] = 0.9 + m * 0.18;
        col[k * 3 + 2] = 0.84 + m * 0.16;
        const rock = Math.max(s.rock, THREE.MathUtils.smoothstep(s.h, 45, 80) * 0.6);
        const sand = s.sand * (1 - rock);
        splat[k * 3] = Math.max(0, 1 - rock - sand);
        splat[k * 3 + 1] = rock;
        splat[k * 3 + 2] = sand;
      }
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('splat', new THREE.BufferAttribute(splat, 3));
    g.setIndex(idx.length > 65535 * 3 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint32BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();

    const grass = groundTextures('grass');
    const rock = groundTextures('rock');
    const sand = groundTextures('sand');
    const map = grass.map.clone();
    map.repeat.set(1 / 14, 1 / 14);
    map.needsUpdate = true;
    const normalMap = grass.normalMap.clone();
    normalMap.repeat.set(1 / 14, 1 / 14);
    normalMap.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, normalMap, vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.45 });
    mat.normalScale.set(0.9, 0.9);
    const extra = { rockMap: { value: rock.map }, sandMap: { value: sand.map } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, extra);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSplat = splat;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D rockMap;\nuniform sampler2D sandMap;\nvarying vec3 vSplat;')
        .replace('#include <map_fragment>', `
          vec4 gC = texture2D(map, vMapUv);
          vec4 g2 = texture2D(map, vMapUv * 0.23 + vec2(0.31, 0.17));
          gC = mix(gC, g2, 0.4);
          vec4 rC = texture2D(rockMap, vMapUv * 0.6);
          vec4 sC = texture2D(sandMap, vMapUv * 1.2);
          diffuseColor *= gC * vSplat.x + rC * vSplat.y + sC * vSplat.z;
        `);
    };
    mat.customProgramCacheKey = () => 'terrain';
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
