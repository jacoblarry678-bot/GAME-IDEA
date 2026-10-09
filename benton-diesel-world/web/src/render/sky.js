// Sky and daylight: an atmospheric-scattering sky (Preetham model) with a
// drifting cloud layer, stars and moon at night, the sun and moon lights,
// fog that matches the horizon, and an environment map rendered from the
// sky so metal, paint and water reflect it.
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
uniform vec3 sunPosition;
uniform float rayleigh;
uniform float turbidity;
uniform float mieCoefficient;
varying vec3 vWorldPosition;
varying vec3 vSunDirection;
varying float vSunfade;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;
const float e = 2.718281828459045;
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
const float cutoffAngle = 1.6110731556870734;
const float steepness = 1.5;
const float EE = 1000.0;
float sunIntensity(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}
vec3 totalMie(float T) {
  float c = (0.2 * T) * 10E-18;
  return 0.434 * c * MieConst;
}
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
  vSunDirection = normalize(sunPosition);
  vSunE = sunIntensity(vSunDirection.y);
  vSunfade = 1.0 - clamp(1.0 - exp(sunPosition.y / 450000.0), 0.0, 1.0);
  float rayleighCoefficient = rayleigh - (1.0 * (1.0 - vSunfade));
  vBetaR = totalRayleigh * rayleighCoefficient;
  vBetaM = totalMie(turbidity) * mieCoefficient;
}`;

const SKY_FRAG = /* glsl */`
varying vec3 vWorldPosition;
varying vec3 vSunDirection;
varying float vSunfade;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;
uniform float mieDirectionalG;
uniform float gain;
uniform float night;
uniform float time;
uniform float cloudCover;
uniform vec3 moonDir;
uniform vec3 groundColor;
const float pi = 3.141592653589793;
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
const float sunAngularDiameterCos = 0.99996;
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;
float rayleighPhase(float cosTheta) { return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0)); }
float hgPhase(float cosTheta, float g) {
  float g2 = pow(g, 2.0);
  float inverse = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
  return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
vec3 atmosphere(vec3 direction) {
  vec3 dir = direction;
  dir.y = max(dir.y, 0.0);
  dir = normalize(dir + vec3(0.0, 0.0001, 0.0));
  float zenithAngle = acos(max(0.0, dir.y));
  float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
  float sR = rayleighZenithLength * inverse;
  float sM = mieZenithLength * inverse;
  vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));
  float cosTheta = dot(dir, vSunDirection);
  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
  vec3 betaRTheta = vBetaR * rPhase;
  float mPhase = hgPhase(cosTheta, mieDirectionalG);
  vec3 betaMTheta = vBetaM * mPhase;
  vec3 Lin = pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * (1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * Fex, vec3(0.5)), clamp(pow(1.0 - vSunDirection.y, 5.0), 0.0, 1.0));
  vec3 L0 = vec3(0.1) * Fex;
  float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
  L0 += (vSunE * 1900.0 * Fex) * sundisk;
  vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
  return pow(texColor, vec3(1.0 / (1.2 + (1.2 * vSunfade))));
}
void main() {
  vec3 direction = normalize(vWorldPosition - cameraPosition);
  vec3 col = atmosphere(direction) * gain;
  // night sky: deep blue with stars and the moon
  vec3 nightCol = mix(vec3(0.010, 0.016, 0.040), vec3(0.002, 0.004, 0.014), clamp(direction.y * 1.4, 0.0, 1.0));
  vec3 q = floor(direction * 380.0);
  float star = step(0.9972, hash3(q)) * smoothstep(0.02, 0.25, direction.y);
  float twinkle = 0.6 + 0.4 * sin(time * 3.0 + hash3(q + 1.0) * 40.0);
  nightCol += vec3(0.9, 0.92, 1.0) * star * twinkle * 0.9;
  float m = dot(direction, normalize(moonDir));
  nightCol += vec3(0.85, 0.88, 1.0) * (smoothstep(0.99955, 0.9997, m) * 3.0 + pow(max(m, 0.0), 60.0) * 0.06);
  col = mix(col, max(col, nightCol), night);
  // clouds: a layer of drifting fractal noise
  if (direction.y > 0.0) {
    vec2 p = direction.xz / (direction.y + 0.08) * 1.6 + vec2(time * 0.006, time * 0.0025);
    float n = fbm(p);
    float cover = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.32, n);
    float thick = smoothstep(0.35, 0.95, n);
    float sunSide = pow(max(dot(direction, vSunDirection), 0.0), 6.0);
    float dayL = (1.0 - night);
    vec3 lit = mix(vec3(1.0, 0.96, 0.9), vec3(1.0, 0.72, 0.5), clamp(1.0 - vSunDirection.y * 4.0, 0.0, 1.0));
    vec3 cloud = mix(lit * 1.25, vec3(0.62, 0.66, 0.74), thick * 0.7) * (0.25 + 1.2 * dayL) * gain * 0.55;
    cloud += lit * sunSide * 0.8 * dayL * gain * 0.4;
    cloud = mix(cloud, vec3(0.03, 0.035, 0.05), night * 0.85);
    float fade = smoothstep(0.0, 0.18, direction.y);
    col = mix(col, cloud, cover * fade * 0.92);
  }
  // below the horizon: the ground, so reflections are not black
  float below = smoothstep(0.0, -0.06, direction.y);
  col = mix(col, groundColor, below);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkySystem {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      turbidity: { value: 2.4 },
      rayleigh: { value: 1.2 },
      mieCoefficient: { value: 0.004 },
      mieDirectionalG: { value: 0.82 },
      sunPosition: { value: new THREE.Vector3(0, 1, 0) },
      gain: { value: 1 },
      night: { value: 0 },
      time: { value: 0 },
      cloudCover: { value: 0.42 },
      moonDir: { value: new THREE.Vector3(-0.4, 0.6, -0.3) },
      groundColor: { value: new THREE.Color(0.16, 0.2, 0.12) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    // the environment is rendered from its own copy of the sky
    this.envScene = new THREE.Scene();
    this.envMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    this.envScene.add(this.envMesh);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.envKey = '';

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows;
    this.setShadowQuality(quality);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.HemisphereLight(0x8fb0e0, 0x3a3428, 0.2);
    scene.add(this.fill);
    scene.fog = new THREE.FogExp2(0xbfd4ea, 0.0011);
    this.sunDir = new THREE.Vector3();
    this.daylight = 1;
  }

  setShadowQuality(q) {
    const size = q.shadowSize || 2048;
    this.sun.castShadow = !!q.shadows;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const sc = this.sun.shadow.camera;
    const r = q.shadowRange || 120;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 10; sc.far = 1000;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 3;
    this.shadowRange = r;
  }

  // hour: 0..24; focus: point the shadow camera follows; t: seconds
  update(hour, focus, t) {
    const sunAngle = ((hour - 6) / 12) * Math.PI; // 6am rise, 6pm set
    const elev = Math.sin(sunAngle);
    const day = THREE.MathUtils.smoothstep(elev, -0.1, 0.2);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * (elev > -0.2 ? 1 : 0);
    // the sun crosses the sky a little to the south
    this.sunDir.set(Math.cos(sunAngle) * 0.85, elev, 0.42).normalize();
    const u = this.uniforms;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(450000);
    u.night.value = 1 - day;
    u.time.value = t;
    u.turbidity.value = 2.2 + dusk * 3.5;
    u.gain.value = 0.3 + 0.12 * day;
    u.moonDir.value.set(-Math.cos(sunAngle) * 0.8, Math.max(0.25, -elev), -0.35).normalize();
    // ground color seen in reflections
    u.groundColor.value.setRGB(0.09 + 0.1 * day, 0.11 + 0.12 * day, 0.07 + 0.06 * day);

    // sunlight: warm and low at dusk, gone at night (the moon takes over)
    const sunUp = elev > 0;
    const light = sunUp ? this.sunDir : u.moonDir.value;
    this.sun.intensity = sunUp ? 2.5 * THREE.MathUtils.smoothstep(elev, -0.02, 0.18) : 0.3 * (1 - day);
    if (sunUp) this.sun.color.setRGB(1, 0.86 + 0.14 * (1 - dusk), 0.7 + 0.3 * (1 - dusk));
    else this.sun.color.setRGB(0.62, 0.72, 1.0);
    this.fill.intensity = 0.12 + 0.45 * (1 - day);
    this.fill.color.setRGB(0.45 + 0.4 * day, 0.55 + 0.35 * day, 0.9);
    const f = focus;
    // snap the shadow camera to texels so shadows don't shimmer
    const step = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(f.x / step) * step, fz = Math.round(f.z / step) * step;
    this.sun.position.set(fx, f.y, fz).addScaledVector(light, 450);
    this.sun.target.position.set(fx, f.y, fz);
    this.mesh.position.copy(f);

    // fog: the color of the horizon
    const dayFog = new THREE.Color(0.66, 0.77, 0.9);
    const duskFog = new THREE.Color(0.86, 0.6, 0.45);
    const nightFog = new THREE.Color(0.02, 0.03, 0.06);
    this.scene.fog.color.copy(nightFog).lerp(dayFog, day).lerp(duskFog, dusk * 0.55 * day);
    this.scene.fog.density = 0.0009 + 0.0004 * (1 - day);
    this.daylight = day;
    this.night = 1 - day;
    return day;
  }

  // Re-render the reflection environment when the sky has changed enough.
  updateEnvironment(force = false) {
    const key = `${this.sunDir.x.toFixed(2)},${this.sunDir.y.toFixed(2)},${this.uniforms.night.value.toFixed(2)}`;
    if (!force && key === this.envKey) return;
    this.envKey = key;
    this.envMesh.position.set(0, 0, 0);
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 400);
    this.scene.environment = this.envRT.texture;
    old?.dispose();
  }
}
