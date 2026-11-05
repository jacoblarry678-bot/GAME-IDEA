/**
 * Rendering: WebGL renderer, scene, camera, sky dome, sun/moon and hemisphere
 * lighting driven by the time of day, shadow map that follows the player,
 * optional bloom, render scale and frame-rate statistics.
 *
 * The light count is fixed for the whole session (no shader recompiles when
 * night falls): hemisphere + sun + two headlight spots + one interior point.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

/**
 * Colour grading in linear light, before tone mapping: white balance, contrast and
 * saturation, a soft vignette and a little film grain. The look is a hot, bright coast.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    warmth: { value: 0.25 },
    saturation: { value: 1.08 },
    contrast: { value: 1.06 },
    vignette: { value: 0.32 },
    grain: { value: 0.025 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, warmth, saturation, contrast, vignette, grain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = max(t.rgb, vec3(0.0));
      c *= vec3(1.0 + warmth * 0.07, 1.0 + warmth * 0.01, 1.0 - warmth * 0.09);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = pow(max(c, vec3(1e-6)) / 0.18, vec3(contrast)) * 0.18;
      float v = smoothstep(0.95, 0.3, length((vUv - 0.5) * vec2(1.2, 1.0)));
      c *= mix(1.0, v, vignette);
      c += (hash(vUv * 937.0 + fract(time) * 61.0) - 0.5) * grain * sqrt(l + 0.02);
      gl_FragColor = vec4(c, t.a);
    }`,
};


const SHADOW = { off: 0, low: 1024, high: 2048, ultra: 4096 };
const SHADOW_EXTENT = { off: 40, low: 55, high: 70, ultra: 90 };
const DRAW = { low: 300, medium: 520, high: 800, ultra: 1200 };

// time-of-day keyframes: hour → palette
const KEYS = [
  { h: 0, top: 0x060a1c, hor: 0x1a1f3c, sun: 0x8fa3d6, si: 0.32, hs: 0x3a4a7a, hg: 0x141420, hi: 0.42, fog: 0x121733, exp: 1.0 },
  { h: 5.2, top: 0x0d1433, hor: 0x2a2a4e, sun: 0x8fa3d6, si: 0.3, hs: 0x3a4a7a, hg: 0x141420, hi: 0.42, fog: 0x1a1d3a, exp: 1.0 },
  { h: 6.3, top: 0x37508f, hor: 0xf0a07c, sun: 0xffb27a, si: 1.1, hs: 0x8fa3c8, hg: 0x5a4a40, hi: 0.7, fog: 0xd8a089, exp: 0.95 },
  { h: 8, top: 0x4a88d6, hor: 0xf1d2b0, sun: 0xffe0b8, si: 2.5, hs: 0xbcd6f2, hg: 0x7a6a55, hi: 1.0, fog: 0xd5dde6, exp: 0.9 },
  { h: 12.5, top: 0x3a7ad4, hor: 0xc5def3, sun: 0xfff5e6, si: 3.3, hs: 0xcfe5ff, hg: 0x8a7a62, hi: 1.15, fog: 0xc8dcef, exp: 0.85 },
  { h: 16.5, top: 0x4282d2, hor: 0xe9d9bd, sun: 0xffe2b8, si: 2.9, hs: 0xc6dcf5, hg: 0x8a7458, hi: 1.05, fog: 0xd9d7d0, exp: 0.88 },
  { h: 18.3, top: 0x3d55a0, hor: 0xff9a62, sun: 0xffa060, si: 1.9, hs: 0xa8a8d8, hg: 0x7a5844, hi: 0.85, fog: 0xeaa585, exp: 0.95 },
  { h: 19.3, top: 0x232a66, hor: 0xc0588c, sun: 0xd0708a, si: 0.55, hs: 0x6a5a9a, hg: 0x2c2030, hi: 0.6, fog: 0x6a3f72, exp: 1.0 },
  { h: 20.4, top: 0x0b1030, hor: 0x3a2a5c, sun: 0x8fa3d6, si: 0.32, hs: 0x3a4a7a, hg: 0x141420, hi: 0.45, fog: 0x1c1a3c, exp: 1.0 },
  { h: 24, top: 0x060a1c, hor: 0x1a1f3c, sun: 0x8fa3d6, si: 0.32, hs: 0x3a4a7a, hg: 0x141420, hi: 0.42, fog: 0x121733, exp: 1.0 },
];

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
const UP = { x: 0, y: 1, z: 0 };
const HORIZON = [[1, 0.035, 0], [-1, 0.035, 0], [0, 0.035, 1], [0, 0.035, -1]].map(([x, y, z]) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; });
function lerpHex(a, b, t, out) { return out.copy(tmpA.setHex(a)).lerp(tmpB.setHex(b), t); }

export class TimeOfDay {
  constructor(hour = 17.6) {
    this.hour = hour;
    this.scale = 60; // game seconds per real second → one game day per 24 real minutes
    this.paused = false;
    this.palette = {};
    this.sunDir = new THREE.Vector3();
    this.night = 0; // 0 day … 1 full night (drives neon, windows, streetlights)
    this.update(0);
  }
  update(dt) {
    if (!this.paused) this.hour = (this.hour + (dt * this.scale) / 3600) % 24;
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);
    const p = this.palette;
    for (const k of ['top', 'hor', 'sun', 'hs', 'hg', 'fog']) p[k] = lerpHex(a[k], b[k], t, p[k] || new THREE.Color());
    p.si = a.si + (b.si - a.si) * t;
    p.hi = a.hi + (b.hi - a.hi) * t;
    p.exp = a.exp + (b.exp - a.exp) * t;
    // sun arc: rises in the east (+x), sets over the bay in the west (-x)
    const ang = ((h - 6.2) / 12.6) * Math.PI;
    const el = Math.sin(ang);
    this.sunDir.set(Math.cos(ang), Math.max(el, -0.3) * 0.92, 0.38).normalize();
    this.sunUp = el > -0.02;
    this.night = THREE.MathUtils.clamp((0.12 - el) / 0.3, 0, 1);
  }
  label() {
    const hh = Math.floor(this.hour), mm = Math.floor((this.hour - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Physically based daylight: the Preetham sky model (the same constants as three.js's Sky.js,
// MIT), ported to JS as well, so the sun's colour, the sky light, the fog and the reflections
// all come from the same atmosphere the player sees.
const RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
export const ATMOSPHERE = { turbidity: 2.6, rayleigh: 1.25, mie: 0.0045, mieG: 0.82, gain: 0.5 };

/** Sky radiance (as the sky shader outputs it) toward `dir` with the sun at `sun`. */
export function skyRadiance(dir, sun, A = ATMOSPHERE, out = [0, 0, 0]) {
  const up = Math.max(-1, Math.min(1, sun.y));
  const sunE = 1000 * Math.max(0, 1 - Math.exp(-((1.6110731556870734 - Math.acos(up)) / 1.5)));
  const bR = RAYLEIGH.map((v) => v * A.rayleigh);
  const c = 0.2 * A.turbidity * 10e-18;
  const bM = MIE.map((v) => 0.434 * c * v * A.mie);
  const zen = Math.acos(Math.max(0, dir.y));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
  const sR = 8.4e3 * inv, sM = 1.25e3 * inv;
  const cosT = dir.x * sun.x + dir.y * sun.y + dir.z * sun.z;
  const rP = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g2 = A.mieG * A.mieG, mP = 0.07957747154594767 * (1 - g2) / Math.pow(1 - 2 * A.mieG * cosT + g2, 1.5);
  const horizonMix = Math.min(1, Math.max(0, Math.pow(1 - up, 5)));
  for (let k = 0; k < 3; k++) {
    const fex = Math.exp(-(bR[k] * sR + bM[k] * sM));
    const ratio = (bR[k] * rP + bM[k] * mP) / (bR[k] + bM[k]);
    let lin = Math.pow(sunE * ratio * (1 - fex), 1.5);
    lin *= 1 + (Math.pow(sunE * ratio * fex, 0.5) - 1) * horizonMix;
    const l0 = 0.1 * fex;
    const tc = (lin + l0) * 0.04 + [0, 0.0003, 0.00075][k];
    out[k] = Math.pow(tc, 1 / 2.4) * A.gain;
  }
  return out;
}

/** What survives of sunlight after crossing the atmosphere (per channel, 0..1). */
export function sunTransmittance(sun, A = ATMOSPHERE, out = [0, 0, 0]) {
  const zen = Math.acos(Math.max(0.0, Math.min(1, sun.y)));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(Math.max(0.5, 93.885 - (zen * 180) / Math.PI), -1.253));
  const c = 0.2 * A.turbidity * 10e-18;
  for (let k = 0; k < 3; k++) out[k] = Math.exp(-(RAYLEIGH[k] * A.rayleigh * 8.4e3 * inv + 0.434 * c * MIE[k] * A.mie * 1.25e3 * inv));
  return out;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() }, // zenith / horizon colours and the sun's colour, computed in JS
      hor: { value: new THREE.Color() }, // (clouds, the water and the weather use them)
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(-0.4, 0.75, -0.5) },
      night: { value: 0 },
      time: { value: 0 },
      overcast: { value: 0 },
      turbidity: { value: ATMOSPHERE.turbidity },
      rayleigh: { value: ATMOSPHERE.rayleigh },
      mieCoefficient: { value: ATMOSPHERE.mie },
      mieDirectionalG: { value: ATMOSPHERE.mieG },
      gain: { value: ATMOSPHERE.gain },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, hor, sunColor, sunDir, moonDir;
      uniform float night, time, overcast, turbidity, rayleigh, mieCoefficient, mieDirectionalG, gain;
      varying vec3 vDir;
      const float PI = 3.141592653589793;
      const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
      const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
      vec3 preetham(vec3 d, vec3 s) {
        vec3 up = vec3(0.0, 1.0, 0.0);
        float zc = clamp(dot(s, up), -1.0, 1.0);
        float sunE = 1000.0 * max(0.0, 1.0 - exp(-((1.6110731556870734 - acos(zc)) / 1.5)));
        vec3 bR = totalRayleigh * rayleigh;
        vec3 bM = 0.434 * (0.2 * turbidity * 10E-18) * MieConst * mieCoefficient;
        float zen = acos(max(0.0, dot(up, d)));
        float inv = 1.0 / (cos(zen) + 0.15 * pow(93.885 - ((zen * 180.0) / PI), -1.253));
        vec3 Fex = exp(-(bR * 8.4E3 * inv + bM * 1.25E3 * inv));
        float cosT = dot(d, s);
        float rP = 0.05968310365946075 * (1.0 + pow(cosT * 0.5 + 0.5, 2.0));
        float g2 = mieDirectionalG * mieDirectionalG;
        float mP = 0.07957747154594767 * ((1.0 - g2) / pow(1.0 - 2.0 * mieDirectionalG * cosT + g2, 1.5));
        vec3 ratio = (bR * rP + bM * mP) / (bR + bM);
        vec3 Lin = pow(sunE * ratio * (1.0 - Fex), vec3(1.5));
        Lin *= mix(vec3(1.0), pow(sunE * ratio * Fex, vec3(0.5)), clamp(pow(1.0 - zc, 5.0), 0.0, 1.0));
        vec3 L0 = vec3(0.1) * Fex;
        float disk = smoothstep(0.99995, 0.999975, cosT);
        L0 += sunE * 19000.0 * Fex * disk;
        vec3 tc = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
        return pow(tc, vec3(1.0 / 2.4)) * gain;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 s = normalize(sunDir);
        // the atmosphere (mirrored a little below the horizon: haze over the sea)
        vec3 dh = normalize(vec3(d.x, max(d.y, 0.0) + 0.002, d.z));
        vec3 col = preetham(dh, s);
        col = mix(col, hor * 0.9, smoothstep(0.0, -0.2, d.y));
        // night: a deep blue sky with the orange glow of the city along the horizon
        float y = max(d.y, 0.0);
        vec3 nightSky = mix(vec3(0.032, 0.026, 0.04), vec3(0.006, 0.010, 0.030), pow(y, 0.35));
        nightSky += vec3(0.05, 0.03, 0.02) * pow(1.0 - y, 8.0);
        col = mix(col, max(col, nightSky), night);
        // drifting cumulus, lit by the same sunlight (golden undersides at dusk)
        vec2 uv = d.xz / (d.y + 0.1) * 1.3 + vec2(time * 0.004, time * 0.0015);
        float n = fbm(uv) + 0.12 * fbm(uv * 4.0 - time * 0.01);
        float c = smoothstep(0.55 - overcast * 0.5, 0.86 - overcast * 0.3, n);
        float cm = c * smoothstep(0.0 - overcast * 0.1, 0.22, d.y);
        float sd = max(dot(d, s), 0.0);
        float day = clamp(1.0 - night, 0.0, 1.0);
        vec3 lit = sunColor * (0.85 + 0.9 * pow(sd, 3.0)) * day + top * 0.6;
        vec3 shade = mix(hor, top, 0.5) * (0.55 + 0.25 * day);
        vec3 cloud = mix(shade, lit, smoothstep(0.55, 1.0, n + 0.15));
        cloud = mix(cloud, vec3(0.55, 0.56, 0.6) * (0.25 + 0.75 * day), overcast * 0.8);
        cloud = mix(cloud, vec3(0.03, 0.03, 0.045) + vec3(0.04, 0.025, 0.015) * pow(1.0 - y, 4.0), night * (1.0 - overcast * 0.5));
        col = mix(col, cloud, cm * (0.8 + overcast * 0.2));
        // an overcast sky flattens everything to grey
        col = mix(col, vec3(0.62, 0.64, 0.68) * (0.2 + 0.8 * day), overcast * 0.55 * (1.0 - cm));
        // stars and the moon
        if (night > 0.0) {
          vec2 sp = d.xz / (d.y + 0.3) * 170.0;
          float st = step(0.9962, hash(floor(sp))) * smoothstep(0.08, 0.4, d.y) * (1.0 - cm) * (1.0 - overcast);
          col += vec3(st) * night * (0.6 + 0.4 * hash(floor(sp) + 3.1));
          float md = max(dot(d, normalize(moonDir)), 0.0);
          col += vec3(0.9, 0.92, 1.0) * (smoothstep(0.9994, 0.9996, md) * 1.6 + pow(md, 120.0) * 0.08) * night * (1.0 - cm * 0.8);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  m.userData.noShadow = true;
  return m;
}

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.g.antialias, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc8dcef, 120, 800);
    this.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.time = new TimeOfDay();
    this.sky = makeSky();
    this.sky.scale.setScalar(1500);
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xcfe5ff, 0x8a7a62, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.focus = new THREE.Vector3();
    this._top = new THREE.Color(); this._hor = new THREE.Color(); this._sunc = new THREE.Color();
    this._ground = new THREE.Color(0.62, 0.55, 0.45); // sun-warmed sand and pavement

    // constant set of local lights (intensity animates; count never changes)
    this.headL = new THREE.SpotLight(0xfff1d6, 0, 55, 0.42, 0.55, 1.2);
    this.headR = this.headL.clone();
    this.scene.add(this.headL, this.headL.target, this.headR, this.headR.target);
    this.interiorLight = new THREE.PointLight(0xfff4e0, 0, 22, 1.4);
    this.scene.add(this.interiorLight);

    this.envDirtyHour = -10;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envScene = new THREE.Scene();
    this.envSky = makeSky();
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);

    this.fps = 60; this.frameMs = 16.7; this._frames = 0; this._lastStat = performance.now();
    this.clock = 0;
    this.shake = 0;
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange(() => this.applySettings());
  }

  applySettings() {
    const g = this.settings.g;
    const size = SHADOW[g.shadows];
    this.renderer.shadowMap.enabled = size > 0;
    this.sun.castShadow = size > 0;
    if (size && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const ext = SHADOW_EXTENT[g.shadows];
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400;
    sc.updateProjectionMatrix();
    this.shadowExtent = ext;
    this.drawDistance = DRAW[g.drawDistance];
    this.camera.far = this.drawDistance + 900;
    this.baseFov = g.fov;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * g.renderScale); // 1.5 cap: Retina at 2× costs 4× the pixels
    this.setupComposer();
    this.resize();
    // materials need recompiling when shadows toggle
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  /**
   * Post-processing, when any of it is on: an HDR (multisampled) scene buffer, ambient
   * occlusion, bloom, the colour grade, then tone mapping. Rebuilt when the options change.
   */
  setupComposer() {
    const g = this.settings.g;
    const key = `${g.bloom}|${g.ao}|${g.postfx}|${g.antialias}`;
    if (!g.bloom && !g.ao && !g.postfx) { this.composer?.dispose?.(); this.composer = null; this.bloom = null; this.gtao = null; this.grade = null; this.composerKey = null; return; }
    if (this.composer && this.composerKey === key) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); return; }
    this.composer?.dispose?.();
    const w = window.innerWidth, h = window.innerHeight, pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: g.antialias ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = null; this.bloom = null; this.grade = null;
    if (g.ao) {
      this.gtao = new GTAOPass(this.scene, this.camera, w, h);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      // the AO depth/normal pass ignores alpha cut-outs, so alpha-tested foliage would
      // shade its whole card; leave anything tagged noAO out of it
      this.gtao.overrideVisibility = function () {
        const cache = this._visibilityCache;
        this.scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false; });
      };
      this.gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 1.5, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
      this.composer.addPass(this.gtao);
    }
    if (g.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.86); this.composer.addPass(this.bloom); }
    if (g.postfx) { this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade); }
    this.composer.addPass(new OutputPass());
    this.composerKey = key;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  /** Advance sky and lighting. focus = point the shadow map is centred on. */
  updateLighting(dt, focus) {
    const t = this.time;
    t.update(dt);
    this.clock += dt;
    const p = t.palette;
    const u = this.sky.material.uniforms;
    // the sky's own colours (zenith, horizon, sunlight) from the atmosphere model
    const night = t.night, day = 1 - night, sd = t.sunDir, A = ATMOSPHERE;
    const z = skyRadiance(UP, sd, A, this._rz || (this._rz = [0, 0, 0]));
    const h = [0, 0, 0], tmp = [0, 0, 0];
    for (const hd of HORIZON) { skyRadiance(hd, sd, A, tmp); h[0] += tmp[0] / 4; h[1] += tmp[1] / 4; h[2] += tmp[2] / 4; }
    const tr = sunTransmittance(sd, A, tmp);
    const trMax = Math.max(tr[0], tr[1], tr[2], 1e-4);
    const skyTop = this._top.setRGB(z[0], z[1], z[2]).lerp(p.top, night);
    const skyHor = this._hor.setRGB(h[0], h[1], h[2]).lerp(p.hor, night);
    const sunCol = this._sunc.setRGB(tr[0] / trMax, tr[1] / trMax, tr[2] / trMax);
    u.top.value.copy(skyTop); u.hor.value.copy(skyHor); u.sunColor.value.copy(sunCol).lerp(p.sun, night);
    u.sunDir.value.copy(sd); u.night.value = night; u.time.value = this.clock;
    u.moonDir.value.copy(this._moon || (this._moon = new THREE.Vector3(-0.4, 0.75, -0.5).normalize()));
    this.sky.position.copy(this.camera.position);

    // sunlight: what the atmosphere lets through (deep orange at sunset); moonlight at night
    const elev = THREE.MathUtils.clamp(sd.y * 3.5 + 0.12, 0, 1);
    const lum = 0.2126 * tr[0] + 0.7152 * tr[1] + 0.0722 * tr[2];
    this.sun.color.copy(sunCol).lerp(p.sun, night);
    this.sun.intensity = day * 2.7 * elev * Math.pow(lum, 0.45) + night * p.si;
    // sky light: the image-based environment does most of it by day, so the hemisphere stays low
    this.hemi.color.copy(skyTop).multiplyScalar(1 / Math.max(0.05, skyTop.r, skyTop.g, skyTop.b)).lerp(p.hs, night);
    this.hemi.groundColor.copy(this._ground).lerp(p.hg, night);
    this.hemi.intensity = day * (0.1 + 0.12 * elev) + night * p.hi;
    // the sky's light reaches surfaces through the environment map; at night the hemisphere takes over
    this.scene.environmentIntensity = day * 0.55 + night * 0.25;
    this.scene.fog.color.copy(skyHor).multiplyScalar(0.78).lerp(p.fog, night);
    this.scene.fog.near = Math.min(220, this.drawDistance * 0.3);
    this.scene.fog.far = this.drawDistance * 1.25;
    this.renderer.toneMappingExposure = p.exp;
    if (this.bloom) this.bloom.strength = 0.22 + t.night * 0.55;
    if (this.grade) this.grade.uniforms.time.value = this.clock;


    // light from the sun when it is up, from a cool moon otherwise
    const dir = t.sunUp ? t.sunDir : this._moon || (this._moon = new THREE.Vector3(-0.4, 0.75, -0.5).normalize());
    this.focus.copy(focus);
    const texel = (this.shadowExtent * 2) / Math.max(512, this.sun.shadow.mapSize.x);
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + dir.x * 200, Math.max(20, dir.y * 200), fz + dir.z * 200);

    // refresh the reflection environment every ~20 game minutes
    if (Math.abs(t.hour - this.envDirtyHour) > 0.33) this.refreshEnvironment();
  }

  refreshEnvironment() {
    this.envDirtyHour = this.time.hour;
    const u = this.envSky.material.uniforms, s = this.sky.material.uniforms;
    for (const k of ['top', 'hor', 'sunColor']) u[k].value.copy(s[k].value);
    u.sunDir.value.copy(s.sunDir.value); u.night.value = s.night.value; u.overcast.value = s.overcast.value;
    u.moonDir.value.copy(s.moonDir.value); u.time.value = s.time.value;
    const old = this.scene.environment;
    this.scene.environment = this.pmrem.fromScene(this.envScene, 0.04).texture;
    old?.dispose();
  }

  render() {
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this._frames++;
    const now = performance.now();
    if (now - this._lastStat > 500) {
      this.fps = (this._frames * 1000) / (now - this._lastStat);
      this.frameMs = (now - this._lastStat) / this._frames;
      this._frames = 0; this._lastStat = now;
    }
  }

  info() {
    const i = this.renderer.info;
    return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }
}
