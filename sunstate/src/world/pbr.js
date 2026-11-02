/**
 * Procedural PBR materials, baked on the GPU at startup: for each surface a
 * colour map, a normal map and an "ORM" map (R = ambient occlusion,
 * G = roughness, B = metalness), all seamless (periodic noise), so the same
 * texture tiles across a whole street. No image files and no licences to
 * track: every map is generated from the shaders below.
 *
 * Each material is a GLSL function
 *     void surf(vec2 uv, out vec3 albedo, out float height, out float rough, out float ao)
 * over one tile (uv 0..1), whose real size in metres is `meters`. Albedo is
 * linear; the colour target is stored as sRGB, so it keeps its precision in
 * the darks. The normal map comes from the height via a second pass.
 */
import * as THREE from 'three';

const LIB = /* glsl */`
  uniform float uSize;
  uniform float uSeed;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.0137); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973) + uSeed * 0.0119); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  // periodic value noise: lattice wrapped every P cells, so the tile is seamless
  float vnoise(vec2 x, float P) {
    vec2 i = floor(x), f = fract(x);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(mod(i, P)), b = hash12(mod(i + vec2(1.0, 0.0), P));
    float c = hash12(mod(i + vec2(0.0, 1.0), P)), d = hash12(mod(i + vec2(1.0, 1.0), P));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 uv, float P, int oct) {
    float s = 0.0, a = 0.5, n = 0.0; vec2 x = uv * P; float p = P;
    for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * vnoise(x, p); n += a; x *= 2.0; p *= 2.0; a *= 0.5; }
    return s / n;
  }
  // periodic cellular noise: (F1, F2, cell id)
  vec3 worley(vec2 uv, float P) {
    vec2 x = uv * P, i = floor(x), f = fract(x);
    float f1 = 9.0, f2 = 9.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int xx = -1; xx <= 1; xx++) {
      vec2 g = vec2(float(xx), float(y));
      vec2 c = mod(i + g, P);
      vec2 r = g + hash22(c) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = hash12(c + 17.0); } else if (d < f2) f2 = d;
    }
    return vec3(sqrt(f1), sqrt(f2), id);
  }
  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); } // author colours in sRGB, use them linear
`;

/** The surfaces. Sizes match how the world maps them (asphalt every 8 m, sidewalk 3 m, ...). */
export const SURFACES = {
  // dark, dense asphalt: fine aggregate, sealed cracks, worn lighter patches
  asphalt: { meters: 8, normal: 2.2, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      float grain = fbm(uv, 512.0, 2);
      float stones = worley(uv, 900.0).x;
      float patchy = fbm(uv + 0.37, 6.0, 4);
      vec3 base = mix(srgb(vec3(0.22, 0.22, 0.23)), srgb(vec3(0.36, 0.355, 0.35)), smoothstep(0.42, 0.72, patchy));
      alb = base * (0.82 + 0.36 * grain) + srgb(vec3(0.5)) * 0.05 * smoothstep(0.32, 0.12, stones);
      // sealed cracks: thin, wandering, only in places
      vec2 w = uv + 0.03 * vec2(fbm(uv, 16.0, 3), fbm(uv + 0.5, 16.0, 3));
      vec3 cell = worley(w, 5.0);
      float crack = smoothstep(0.045, 0.0, cell.y - cell.x) * smoothstep(0.5, 0.65, fbm(uv + 0.9, 4.0, 3));
      alb = mix(alb, srgb(vec3(0.08, 0.08, 0.085)), crack * 0.9);
      // oil and water stains
      float stain = smoothstep(0.62, 0.78, fbm(uv + 0.21, 10.0, 4));
      alb *= 1.0 - 0.25 * stain;
      h = grain * 0.6 + smoothstep(0.35, 0.05, stones) * 0.5 - crack * 0.8;
      rough = clamp(0.92 - 0.08 * grain - crack * 0.35 - stain * 0.25, 0.3, 1.0);
      ao = 1.0 - crack * 0.6 - (1.0 - grain) * 0.15;
    }` },
  // poured concrete sidewalk in 1.5 m slabs: tooled joints, fine pitting, stains
  concrete: { meters: 3, normal: 2.5, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      vec2 s = uv * 2.0, sf = fract(s), si = floor(s);
      float slab = hash12(si + 3.0);
      float edge = min(min(sf.x, 1.0 - sf.x), min(sf.y, 1.0 - sf.y));
      float joint = smoothstep(0.012, 0.004, edge);
      float pores = smoothstep(0.08, 0.0, worley(uv, 260.0).x);
      float grain = fbm(uv, 256.0, 3);
      float stain = smoothstep(0.55, 0.85, fbm(uv + 0.6, 6.0, 4));
      vec3 base = srgb(vec3(0.74, 0.72, 0.68)) * (0.93 + 0.1 * slab);
      alb = base * (0.9 + 0.16 * grain) * (1.0 - 0.18 * stain) * (1.0 - 0.45 * joint) * (1.0 - 0.25 * pores);
      // the odd chewing-gum spot
      float gum = smoothstep(0.035, 0.02, worley(uv + 0.13, 40.0).x) * step(0.82, hash12(mod(floor(uv * 40.0), 40.0) + 5.0));
      alb = mix(alb, srgb(vec3(0.35, 0.34, 0.33)), gum * 0.8);
      h = grain * 0.3 - joint * 1.0 - pores * 0.4 + smoothstep(0.0, 0.05, edge) * 0.1;
      rough = clamp(0.86 + 0.08 * grain - stain * 0.1, 0.0, 1.0);
      ao = 1.0 - joint * 0.5 - pores * 0.2;
    }` },
  // beach sand: wind ripples, footprints, grains and the odd shell fragment
  sand: { meters: 5, normal: 3.0, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      vec2 w = uv + 0.05 * vec2(fbm(uv, 4.0, 3), fbm(uv + 0.3, 4.0, 3));
      float rip = sin((w.x * 0.6 + w.y) * 6.2831853 * 40.0 + fbm(uv, 8.0, 3) * 6.0) * 0.5 + 0.5;
      float trampled = smoothstep(0.35, 0.75, fbm(uv + 0.4, 5.0, 4));
      vec3 steps = worley(uv, 14.0);
      float dent = smoothstep(0.42, 0.15, steps.x) * step(0.45, steps.z) * trampled;
      float grain = fbm(uv, 512.0, 2);
      float shell = smoothstep(0.03, 0.0, worley(uv + 0.71, 180.0).x) * step(0.9, hash12(mod(floor(uv * 180.0), 180.0)));
      vec3 dry = srgb(vec3(0.93, 0.86, 0.71)), damp = srgb(vec3(0.80, 0.71, 0.55));
      alb = mix(dry, damp, smoothstep(0.5, 0.8, fbm(uv + 0.8, 3.0, 3)) * 0.35) * (0.9 + 0.12 * grain) * (0.97 + 0.04 * rip * (1.0 - trampled));
      alb = mix(alb, srgb(vec3(0.98, 0.96, 0.93)), shell);
      h = rip * (1.0 - trampled) * 0.25 * smoothstep(0.3, 0.7, fbm(uv + 0.2, 4.0, 3)) - dent * 0.9 + grain * 0.3;
      rough = 0.97;
      ao = 1.0 - dent * 0.25;
    }` },
  // a Florida lawn: St. Augustine grass, a few dry patches and bare spots
  grass: { meters: 6, normal: 2.0, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      float blades = fbm(vec2(uv.x * 3.0, uv.y), 160.0, 3);
      float tuft = fbm(uv, 48.0, 3);
      float dry = smoothstep(0.55, 0.78, fbm(uv + 0.3, 5.0, 4));
      float bare = smoothstep(0.72, 0.86, fbm(uv + 0.77, 7.0, 4));
      vec3 green = mix(srgb(vec3(0.24, 0.40, 0.13)), srgb(vec3(0.38, 0.52, 0.18)), tuft);
      alb = mix(green, srgb(vec3(0.55, 0.53, 0.28)), dry * 0.55) * (0.75 + 0.45 * blades);
      alb = mix(alb, srgb(vec3(0.45, 0.38, 0.28)), bare * 0.7);
      h = blades * (1.0 - bare) + tuft * 0.5;
      rough = 0.85;
      ao = 0.75 + 0.25 * blades;
    }` },
  // the beachwalk and Ocean Drive pavers: warm concrete bricks in running bond, sanded joints
  pavers: { meters: 4, normal: 3.0, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      vec2 g = uv * vec2(20.0, 40.0);
      g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
      vec2 f = fract(g), id = floor(g);
      id.x = mod(id.x, 20.0);
      float e = min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y)) * 2.0;
      float bevel = smoothstep(0.0, 0.12, e);
      float tone = hash12(id + 9.0);
      vec3 c = mix(srgb(vec3(0.83, 0.68, 0.58)), srgb(vec3(0.74, 0.58, 0.50)), tone);
      c = mix(c, srgb(vec3(0.88, 0.80, 0.70)), step(0.85, hash12(id + 2.0)) * 0.6);
      float grain = fbm(uv, 256.0, 2);
      float stain = smoothstep(0.6, 0.85, fbm(uv + 0.5, 6.0, 4));
      alb = mix(srgb(vec3(0.55, 0.50, 0.44)), c * (0.9 + 0.15 * grain) * (1.0 - 0.15 * stain), bevel);
      h = bevel * 0.8 + grain * 0.15;
      rough = 0.8 + 0.1 * grain;
      ao = mix(0.45, 1.0, bevel);
    }` },
  // weathered boardwalk / pier planks: grain, knots, gaps, nail heads
  wood: { meters: 4, normal: 2.5, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      float rows = 26.0;
      float r = floor(uv.y * rows);
      float fy = fract(uv.y * rows);
      float off = hash12(vec2(r, 1.0));
      float lenSeg = mod(floor((uv.x + off) * 3.0), 3.0);
      float plank = hash12(vec2(r, lenSeg + 4.0));
      float gap = smoothstep(0.06, 0.02, min(fy, 1.0 - fy)) + smoothstep(0.004, 0.0, abs(fract((uv.x + off) * 3.0) - 0.5) - 0.497);
      float grainLines = fbm(vec2(uv.x * 2.0, uv.y * rows * 6.0) + plank * 7.0, 32.0, 4);
      float streak = sin((uv.y * rows + grainLines * 3.0) * 30.0) * 0.5 + 0.5;
      vec3 wood = mix(srgb(vec3(0.55, 0.48, 0.40)), srgb(vec3(0.70, 0.64, 0.56)), plank) * (0.85 + 0.2 * streak);
      float nail = smoothstep(0.02, 0.01, length(vec2(fract((uv.x + off) * 3.0) - 0.05, fy - 0.5) * vec2(3.0, 0.4)));
      alb = mix(wood, srgb(vec3(0.12, 0.10, 0.08)), clamp(gap, 0.0, 1.0));
      alb = mix(alb, srgb(vec3(0.3, 0.3, 0.32)), nail);
      h = (1.0 - clamp(gap, 0.0, 1.0)) * 0.9 + streak * 0.15;
      rough = 0.82;
      ao = 1.0 - clamp(gap, 0.0, 1.0) * 0.6;
    }` },
  // flat roofs: tar and pea gravel
  roof: { meters: 6, normal: 2.0, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      vec3 gr = worley(uv, 700.0);
      float stone = smoothstep(0.45, 0.1, gr.x);
      float patchy = fbm(uv, 6.0, 4);
      alb = mix(srgb(vec3(0.42, 0.41, 0.40)), srgb(vec3(0.62, 0.60, 0.57)), gr.z * stone) * (0.85 + 0.2 * patchy);
      h = stone;
      rough = 0.95;
      ao = 0.7 + 0.3 * stone;
    }` },
  // rough cast concrete: seawalls, bridge piers, kerbs
  castConcrete: { meters: 4, normal: 2.0, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      float g = fbm(uv, 64.0, 5);
      float pores = smoothstep(0.06, 0.0, worley(uv, 120.0).x);
      float streak = fbm(vec2(uv.x * 30.0, uv.y * 2.0), 8.0, 3);
      alb = srgb(vec3(0.66, 0.64, 0.60)) * (0.82 + 0.25 * g) * (1.0 - 0.2 * pores) * (0.9 + 0.12 * streak);
      h = g - pores * 0.6;
      rough = 0.9;
      ao = 1.0 - pores * 0.3;
    }` },
  // the club and store floors: polished terrazzo
  terrazzo: { meters: 2, normal: 0.6, glsl: /* glsl */`
    void surf(vec2 uv, out vec3 alb, out float h, out float rough, out float ao) {
      vec3 chips = worley(uv, 90.0);
      float chip = smoothstep(0.32, 0.22, chips.x);
      vec3 chipCol = mix(srgb(vec3(0.55, 0.52, 0.5)), srgb(vec3(0.95, 0.92, 0.88)), chips.z);
      chipCol = mix(chipCol, srgb(vec3(0.75, 0.45, 0.45)), step(0.88, chips.z));
      alb = mix(srgb(vec3(0.86, 0.84, 0.80)), chipCol, chip * 0.8);
      h = chip * 0.2;
      rough = 0.18;
      ao = 1.0;
    }` },
};

const VS = /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function main(out) {
  return /* glsl */`
    void main() {
      vec2 uv = gl_FragCoord.xy / uSize;
      vec3 alb; float h, rough, ao;
      surf(uv, alb, h, rough, ao);
      ${out === 0 ? 'gl_FragColor = vec4(clamp(alb, 0.0, 1.0), 1.0);' : out === 1 ? 'gl_FragColor = vec4(h, h, h, 1.0);' : 'gl_FragColor = vec4(clamp(ao, 0.0, 1.0), clamp(rough, 0.04, 1.0), 0.0, 1.0);'}
    }`;
}

const NORMAL_FS = /* glsl */`
  uniform sampler2D tHeight;
  uniform float uSize, uStrength;
  void main() {
    vec2 uv = gl_FragCoord.xy / uSize, t = vec2(1.0 / uSize, 0.0);
    float l = texture2D(tHeight, uv - t.xy).r, r = texture2D(tHeight, uv + t.xy).r;
    float d = texture2D(tHeight, uv - t.yx).r, u = texture2D(tHeight, uv + t.yx).r;
    vec3 n = normalize(vec3((l - r) * uStrength, (d - u) * uStrength, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  }`;

/**
 * Bake every surface at `size` texels (512 or 1024). Returns
 * { name: { map, normalMap, orm, meters } } — the textures live in render targets.
 */
export function bakeSurfaces(renderer, size = 512) {
  if (!renderer) return flatSurfaces(); // (headless unit tests: no GPU)
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const target = (opts) => {
    const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, stencilBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, ...opts });
    rt.texture.anisotropy = opts.generateMipmaps === false ? 1 : aniso;
    return rt;
  };
  const prevTarget = renderer.getRenderTarget(), prevTone = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  const out = {};
  let seed = 1;
  for (const [name, def] of Object.entries(SURFACES)) {
    const uniforms = { uSize: { value: size }, uSeed: { value: seed++ } };
    const mat = (o) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: LIB + def.glsl + main(o), depthTest: false, depthWrite: false });
    const mip = { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
    const color = target({ ...mip, colorSpace: THREE.SRGBColorSpace });
    const orm = target({ ...mip });
    const height = target({ type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
    const normal = target({ ...mip });
    for (const [o, rt] of [[0, color], [1, height], [2, orm]]) {
      quad.material = mat(o);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      quad.material.dispose();
    }
    quad.material = new THREE.ShaderMaterial({ uniforms: { tHeight: { value: height.texture }, uSize: { value: size }, uStrength: { value: def.normal * (size / 512) } }, vertexShader: VS, fragmentShader: NORMAL_FS, depthTest: false, depthWrite: false });
    renderer.setRenderTarget(normal);
    renderer.render(scene, cam);
    quad.material.dispose();
    height.dispose();
    out[name] = { map: color.texture, normalMap: normal.texture, orm: orm.texture, meters: def.meters };
  }
  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevTone;
  quad.geometry.dispose();
  return out;
}

/** Plain 1×1 stand-ins with the same shape (for code paths without a renderer). */
export function flatSurfaces() {
  const px = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); t.needsUpdate = true; return t; };
  const out = {};
  for (const [name, def] of Object.entries(SURFACES)) out[name] = { map: px(200, 200, 200), normalMap: px(128, 128, 255), orm: px(255, 230, 0), meters: def.meters };
  return out;
}

/** A standard material from a baked surface (roughness/AO from the ORM map). */
export function surfaceMaterial(s, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: s.map, normalMap: s.normalMap, roughnessMap: s.orm, aoMap: s.orm, aoMapIntensity: 1,
    roughness: 1, metalness: 0, ...opts,
  });
}
