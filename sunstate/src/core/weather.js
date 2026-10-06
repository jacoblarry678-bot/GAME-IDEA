/**
 * Weather: a small state machine (clear → clouding over → rain → clearing)
 * that drives the sky, light and fog, wet road materials, rain streaks
 * around the camera, tyre grip, rain audio and how people on the street
 * behave. Settings → World → Weather can pin it to clear or rain.
 *
 * Values ease toward their targets so nothing pops:
 *   cloud 0..1   overcast amount (sky, sun, fog)
 *   rain  0..1   how hard it's raining (streaks, audio, visibility)
 *   wet   0..1   how wet the ground is (lags the rain: dries slowly)
 */
import * as THREE from 'three';

/** Durations in real seconds (the game clock runs 60× faster). */
export const WEATHER_CONFIG = {
  clear: [240, 480],
  cloudy: [50, 90],
  rain: [100, 200],
  clearing: [40, 70],
  gripLoss: 0.3, // tyre grip at full wetness: 1 - gripLoss (wet braking ~20% longer)
};

const NEXT = { clear: 'cloudy', cloudy: 'rain', rain: 'clearing', clearing: 'clear' };
const TARGET = { clear: [0, 0], cloudy: [0.85, 0], rain: [1, 1], clearing: [0.45, 0] }; // [cloud, rain]

export class Weather {
  constructor(settings, rnd = Math.random) {
    this.settings = settings;
    this.rnd = rnd;
    this.state = 'clear';
    this.t = 0;
    this.dur = this.pick('clear') * 0.5; // the first change comes a bit sooner
    this.cloud = 0; this.rain = 0; this.wet = 0;
    this.flash = 0; this.thunderT = 20;
    this.onThunder = null;
  }

  pick(state) { const [a, b] = WEATHER_CONFIG[state]; return a + this.rnd() * (b - a); }

  get mode() { return this.settings?.gp?.weather || 'dynamic'; }

  /** Force a state now (tests, missions). */
  set(state, instant = false) {
    this.state = state; this.t = 0; this.dur = this.pick(state);
    if (instant) { [this.cloud, this.rain] = TARGET[state]; this.wet = this.rain; }
  }

  step(dt) {
    const mode = this.mode;
    if (mode === 'clear' && this.state !== 'clear') this.set('clear');
    else if (mode === 'rain' && this.state !== 'rain') this.set('rain');
    else if (mode === 'dynamic') {
      this.t += dt;
      if (this.t >= this.dur) this.set(NEXT[this.state]);
    }
    const [tc, tr] = TARGET[this.state];
    this.cloud += (tc - this.cloud) * (1 - Math.exp(-dt / 12));
    this.rain += (tr - this.rain) * (1 - Math.exp(-dt / (tr > this.rain ? 10 : 6)));
    // the ground soaks quickly and dries slowly
    const wetTarget = Math.min(1, this.rain * 1.4);
    this.wet += (wetTarget - this.wet) * (1 - Math.exp(-dt / (wetTarget > this.wet ? 8 : 70)));
    // the odd thunderclap in heavy rain
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.rain > 0.7) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) { this.thunderT = 18 + this.rnd() * 40; this.flash = 1; this.onThunder?.(1.5 + this.rnd() * 3); }
    }
  }

  /** Multiplier for tyre grip on wet roads. */
  get grip() { return 1 - WEATHER_CONFIG.gripLoss * this.wet; }

  get label() { return this.rain > 0.5 ? 'Rain' : this.rain > 0.1 ? 'Drizzle' : this.cloud > 0.5 ? 'Overcast' : ''; }
}

/**
 * Visuals: rain streaks (one LineSegments draw), wet-material tuning and
 * overcast light. `materials` are the world materials to wet (roads, lots,
 * pavements); their dry roughness/colour are remembered.
 */
export class WeatherFX {
  constructor(engine, materials) {
    this.engine = engine;
    this.mats = materials.filter(Boolean).map((m) => ({ m, rough: m.roughness, color: m.color.clone(), env: m.envMapIntensity ?? 1 }));
    // rain: N short vertical streaks in a box that follows the camera; the shader wraps them
    const N = 3200, box = new THREE.Vector3(46, 26, 46);
    const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * box.x, y = Math.random() * box.y, z = Math.random() * box.z;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1; // top / bottom end of the streak
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('end', new THREE.BufferAttribute(seed, 1));
    this.uniforms = { time: { value: 0 }, origin: { value: new THREE.Vector3() }, box: { value: box }, amount: { value: 0 }, wind: { value: new THREE.Vector2(1.6, 0.6) }, light: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        attribute float end;
        uniform float time, amount;
        uniform vec3 origin, box;
        uniform vec2 wind;
        varying float vA;
        void main() {
          vec3 p = position;
          float speed = 22.0;
          p.y = mod(p.y - time * speed, box.y);
          p.xz += wind * (box.y - p.y) * 0.05;
          // wrap the box around the camera so streaks never run out
          vec3 base = origin - box * 0.5;
          vec3 w = base + mod(p - base, box);
          w.y = origin.y - box.y * 0.35 + p.y;
          // streak length along the fall direction
          w.y -= end * 0.55; w.xz -= wind * end * 0.03;
          vA = amount * (1.0 - end * 0.6) * step(fract(position.x * 7.13 + position.z * 3.7), amount);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 light;
        varying float vA;
        void main() { gl_FragColor = vec4(light, vA * 0.38); }`,
    });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 6;
    this.rain.visible = false;
    engine.scene.add(this.rain);
    this._grey = new THREE.Color(0x8d949c);
    this._tmp = new THREE.Color();
  }

  /** After the engine set the time-of-day light: apply the weather on top. */
  update(dt, w) {
    const e = this.engine, u = this.uniforms;
    u.time.value += dt;
    u.origin.value.copy(e.camera.position);
    u.amount.value = w.rain;
    this.rain.visible = w.rain > 0.02;
    const night = e.time.night;
    u.light.value.setScalar(0.75 - night * 0.45).add(this._tmp.setScalar(w.flash * 0.6));
    // overcast: a grey sky, a weaker sun, a brighter-but-flatter sky light, closer fog
    const c = w.cloud;
    const sky = e.sky.material.uniforms;
    if (sky.overcast) sky.overcast.value = c;
    const grey = this._tmp.copy(this._grey).multiplyScalar(1 - night * 0.82);
    sky.top.value.lerp(grey, c * 0.75);
    sky.hor.value.lerp(grey, c * 0.6);
    e.sun.intensity *= 1 - c * 0.78;
    e.hemi.intensity *= 1 - c * 0.15;
    e.scene.fog.color.lerp(grey, c * 0.7);
    if (w.flash > 0) { e.hemi.intensity += w.flash * 1.5; sky.hor.value.lerp(this._tmp.setScalar(0.9), w.flash * 0.5); }
    e.scene.fog.far = Math.min(e.scene.fog.far, e.drawDistance * (1 - w.rain * 0.55));
    e.scene.fog.near = Math.min(e.scene.fog.near, e.scene.fog.far * 0.2);
    // wet ground: darker and glossier (the environment map gives it reflections)
    for (const o of this.mats) {
      o.m.roughness = o.rough + (Math.min(o.rough, 0.28) - o.rough) * w.wet;
      o.m.color.copy(o.color).multiplyScalar(1 - 0.32 * w.wet);
      o.m.envMapIntensity = o.env * (1 + 1.6 * w.wet);
    }
  }
}
