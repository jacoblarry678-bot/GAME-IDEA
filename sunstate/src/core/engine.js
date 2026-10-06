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

function makeSky() {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      hor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      night: { value: 0 },
      time: { value: 0 },
      overcast: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, hor, sunColor, sunDir;
      uniform float night, time, overcast;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 col = mix(hor, top, pow(y, 0.45));
        // below the horizon fade to a hazy sea-level colour
        col = mix(col, hor * 0.85, smoothstep(0.0, -0.15, d.y));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        float above = smoothstep(-0.08, 0.04, sunDir.y);
        col += sunColor * (pow(sd, 8.0) * 0.35 + pow(sd, 64.0) * 0.6) * above;
        col += sunColor * smoothstep(0.9993, 0.9997, sd) * 4.0 * above;
        // warm horizon band around the sun at golden hour
        col += sunColor * pow(1.0 - y, 6.0) * pow(sd, 2.0) * 0.35 * above;
        // drifting cumulus
        vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(time * 0.004, time * 0.0015);
        float c = smoothstep(0.52 - overcast * 0.45, 0.8 - overcast * 0.25, fbm(uv));
        float cm = c * smoothstep(0.02 - overcast * 0.1, 0.25, d.y);
        vec3 cloudLit = mix(hor * 1.1, vec3(1.0), 0.55 - overcast * 0.35) * (1.0 - night * 0.8) * (1.0 - overcast * 0.35) + sunColor * pow(sd, 4.0) * 0.4 * (1.0 - overcast);
        col = mix(col, cloudLit, cm * 0.85);
        // stars
        if (night > 0.0) {
          vec2 sp = d.xz / (d.y + 0.3) * 160.0;
          float s = step(0.9965, hash(floor(sp))) * smoothstep(0.1, 0.4, d.y) * (1.0 - cm);
          col += vec3(s) * night * 0.9;
        }
        gl_FragColor = vec4(col, 1.0);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * g.renderScale);
    this.setupComposer();
    this.resize();
    // materials need recompiling when shadows toggle
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  setupComposer() {
    const g = this.settings.g;
    if (!g.bloom) { this.composer = null; return; }
    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
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
    u.top.value.copy(p.top); u.hor.value.copy(p.hor); u.sunColor.value.copy(p.sun);
    u.sunDir.value.copy(t.sunDir); u.night.value = t.night; u.time.value = this.clock;
    this.sky.position.copy(this.camera.position);

    this.hemi.color.copy(p.hs); this.hemi.groundColor.copy(p.hg); this.hemi.intensity = p.hi;
    this.sun.color.copy(p.sun); this.sun.intensity = p.si;
    this.scene.fog.color.copy(p.fog);
    this.scene.fog.near = Math.min(140, this.drawDistance * 0.25);
    this.scene.fog.far = this.drawDistance;
    this.renderer.toneMappingExposure = p.exp;
    if (this.bloom) this.bloom.strength = 0.25 + t.night * 0.55;

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
    u.sunDir.value.copy(s.sunDir.value); u.night.value = s.night.value;
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
