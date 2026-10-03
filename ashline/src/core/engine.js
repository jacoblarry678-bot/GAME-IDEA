/**
 * Rendering engine: WebGL renderer, world scene + first-person viewmodel
 * overlay scene, lighting and shadows, resolution scaling, frame cap and
 * performance stats.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** GTAO that skips particles, decals, sky and other transparent/unlit helpers in its G-buffer pass. */
class AOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || o.userData.noAO || (m && !Array.isArray(m) && (m.transparent || m.isShaderMaterial))) o.visible = false;
    });
  }
}

const SHADOW_SIZES = { off: 0, low: 1024, medium: 2048, high: 2048, ultra: 4096 };

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.06, 900);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(52, 16 / 9, 0.01, 10);

    // lights
    this.hemi = new THREE.HemisphereLight(0xbcd4ec, 0x6a5a48, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -64; sc.right = 64; sc.top = 64; sc.bottom = -64; sc.near = 1; sc.far = 260;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // viewmodel lights mirror the world lights
    this.vmHemi = new THREE.HemisphereLight(0xcfe0f0, 0x6a5a48, 1.7);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.vmKey = new THREE.DirectionalLight(0xfff4e8, 1.1); // soft key from upper-left front so the weapon reads clearly
    this.vmKey.position.set(-0.6, 0.8, 0.5);
    this.vmScene.add(this.vmHemi, this.vmSun, this.vmSun.target, this.vmKey);
    this.vmFill = new THREE.PointLight(0xffc890, 0, 3, 2); // muzzle flash light
    this.vmScene.add(this.vmFill);

    this.fps = 60; this.frameMs = 16.7; this._acc = 0; this._frames = 0; this._lastStat = performance.now();
    this.lastFrame = performance.now();
    this.vfov = 60;
    this.zoom = 1;
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange(() => this.applySettings());
  }

  /** Image-based lighting: prefilter the sky dome so metals and paint pick up reflections. */
  bakeEnvironment(sky) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const s = sky.clone();
    s.material = sky.material.clone();
    s.material.uniforms.time.value = 0;
    s.visible = true;
    envScene.add(s);
    // a dark ground disc so the lower hemisphere reflects ground, not sky
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshBasicMaterial({ color: 0x3c3a36 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2;
    envScene.add(ground);
    const rt = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();
    return rt.texture;
  }

  useEnvironment(tex) {
    this.scene.environment = tex;
    this.vmScene.environment = tex;
    this.scene.environmentIntensity = 0.55;
    this.vmScene.environmentIntensity = 0.75;
    this.hemi.intensity = 0.75;
  }

  setEnvironment(def) {
    const d = new THREE.Vector3(...def.sun.dir).normalize();
    this.sunDir = d;
    this.sun.color.set(def.sun.color);
    this.sun.intensity = def.sun.intensity;
    const ext = def.shadowExtent || { cx: 0, cz: 0, half: 64 };
    this.sun.target.position.set(ext.cx, 0, ext.cz);
    this.sun.position.copy(d).multiplyScalar(120).add(this.sun.target.position);
    const sc = this.sun.shadow.camera;
    sc.left = -ext.half; sc.right = ext.half; sc.top = ext.half; sc.bottom = -ext.half;
    sc.updateProjectionMatrix();
    this.vmSun.position.copy(d);
    this.vmSun.color.set(def.sun.color);
    this.scene.fog = new THREE.FogExp2(def.fog.color, def.fog.density);
    this.hemi.color.set(def.sky.top).lerp(new THREE.Color(0xffffff), 0.45);
    this.hemi.groundColor.set(def.sky.ground);
  }

  applySettings() {
    const g = this.settings.data.graphics;
    const size = SHADOW_SIZES[g.shadows] || 0;
    const r = this.renderer;
    const wantShadows = size > 0;
    if (r.shadowMap.enabled !== wantShadows) {
      r.shadowMap.enabled = wantShadows;
      this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    }
    this.sun.castShadow = wantShadows;
    r.shadowMap.type = g.shadows === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (wantShadows && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    r.toneMappingExposure = g.brightness;
    this.frameCap = Number(g.frameCap) || 0;
    this.resize();
    this.setupPost();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const g = this.settings.data.graphics;
    const scale = g.dynamicRes ? Math.min(g.renderScale, this.dynScale ?? g.renderScale) : g.renderScale;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    this.effectiveScale = scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.aspect = w / h;
    this.updateFov();
    this.vmCamera.aspect = this.aspect;
    this.vmCamera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  }

  /** Horizontal FOV setting (at 16:9) → vertical camera FOV, divided by zoom. */
  updateFov() {
    const hfov = this.settings.data.graphics.fov * Math.PI / 180;
    const v = 2 * Math.atan(Math.tan(hfov / 2) / (16 / 9));
    const vz = 2 * Math.atan(Math.tan(v / 2) / this.zoom);
    this.camera.fov = vz * 180 / Math.PI;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  setZoom(z) {
    if (Math.abs(z - this.zoom) < 1e-4) return;
    this.zoom = z;
    this.updateFov();
  }

  /** Should this animation frame be rendered given the frame cap? */
  shouldRender(now) {
    if (!this.frameCap) return true;
    return now - this.lastFrame >= 1000 / this.frameCap - 1.5;
  }

  /** Build or tear down the post-processing chain to match settings. */
  setupPost() {
    const g = this.settings.data.graphics;
    const want = g.bloom || g.ao;
    if (!want) {
      if (this.composer) { this.composer.dispose(); this.composer = null; }
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    if (!this.composer) {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.aoPass = new AOPass(this.scene, this.camera, w, h);
      this.aoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.6, scale: 1.25, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.aoPass.blendIntensity = 0.85;
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.45, 0.92);
      this.outputPass = new OutputPass();
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.aoPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.outputPass);
    }
    this.aoPass.enabled = !!g.ao;
    this.bloomPass.enabled = !!g.bloom;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(showViewmodel = true) {
    const r = this.renderer;
    r.info.reset();
    if (this.composer) {
      this.composer.render();
    } else {
      r.clear();
      r.render(this.scene, this.camera);
    }
    if (showViewmodel) {
      r.clearDepth();
      r.render(this.vmScene, this.vmCamera);
    }
  }

  /** Dynamic resolution: nudge the render scale toward ~60 FPS. */
  adaptResolution(now) {
    const g = this.settings.data.graphics;
    if (!g.dynamicRes) { this.dynScale = undefined; return; }
    if (now - (this._dynT || 0) < 1500) return;
    this._dynT = now;
    const cur = this.dynScale ?? g.renderScale;
    let next = cur;
    if (this.fps < 58) next = Math.max(0.5, cur - 0.05);
    else if (this.fps > 75) next = Math.min(g.renderScale, cur + 0.05);
    if (Math.abs(next - cur) > 1e-3) { this.dynScale = next; this.resize(); }
  }

  stat(now) {
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    this._frames++;
    this._acc += dt;
    if (now - this._lastStat > 500) {
      this.fps = (this._frames * 1000) / (now - this._lastStat);
      this.frameMs = this._acc / this._frames;
      this._frames = 0; this._acc = 0; this._lastStat = now;
    }
  }

  info() {
    const i = this.renderer.info;
    return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures };
  }
}
