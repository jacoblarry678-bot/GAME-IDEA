/**
 * Renderer, camera, post-processing stack and the frame loop.
 *
 * The post chain is: scene -> bloom -> "dread" pass. The dread pass is a single
 * custom shader that does vignette, chromatic aberration, film grain, colour
 * grading, a wet-lens smear and the fear-driven barrel warp in one draw, so
 * high fear costs nothing extra in draw calls.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { QUALITY_PRESETS } from '../../../shared/constants.js';

const DreadShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFear: { value: 0 },
    uHurt: { value: 0 },
    uVignette: { value: 1.0 },
    uGrain: { value: 1.0 },
    uAberration: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTint: { value: new THREE.Color(0x8e7f74) },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFear, uHurt, uVignette, uGrain, uAberration, uFlash;
    uniform vec2 uResolution;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // fear warps the lens and makes the edges breathe
      float breathe = sin(uTime * 2.1) * 0.5 + 0.5;
      float warp = uFear * (0.055 + breathe * 0.045) + uHurt * 0.09;
      uv = 0.5 + c * (1.0 - warp * r2 * 2.2);

      // chromatic aberration, stronger toward the edge and with fear
      float ab = (0.0016 + uFear * 0.006 + uHurt * 0.01) * uAberration;
      vec2 dir = normalize(c + 1e-5);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab * (1.0 + r2)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab * (1.0 + r2)).b;

      // a smeared, greasy double-exposure at high fear
      if (uFear > 0.45) {
        float amt = (uFear - 0.45) * 0.55;
        vec2 off = vec2(sin(uTime * 3.3 + uv.y * 18.0), cos(uTime * 2.7 + uv.x * 15.0)) * 0.004 * amt;
        col = mix(col, texture2D(tDiffuse, uv + off).rgb, amt * 0.5);
      }

      // grade: crush blacks, push toward cold rot, keep highlights bloody
      col = pow(max(col, 0.0), vec3(1.06, 1.03, 1.0));
      col *= mix(vec3(1.0), uTint, 0.14);
      col.r += uHurt * 0.22 + uFlash * 0.4;
      col.gb *= (1.0 - uHurt * 0.25);
      col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 - uFear * 0.35);

      // vignette
      float vig = smoothstep(1.25, 0.16, r2 * (1.35 + uFear * 1.1));
      col *= mix(1.0, vig, uVignette);

      // film grain
      float g = hash(gl_FragCoord.xy + fract(uTime) * 431.0);
      col += (g - 0.5) * (0.055 + uFear * 0.09) * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Engine {
  constructor(canvasEl, quality = 'high') {
    this.canvas = canvasEl;
    this.clock = new THREE.Clock();
    this.frame = 0;
    this.fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this.updaters = new Set();
    this.paused = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.7;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 420);
    this.camera.position.set(0, 2, 6);

    this.composer = null;
    this.quality = null;
    this.applyQuality(quality);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!document.hidden) this.clock.getDelta();
    });
    this.resize();
  }

  applyQuality(name) {
    const q = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
    this.qualityName = QUALITY_PRESETS[name] ? name : 'high';
    this.quality = q;

    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * q.pixelRatio);

    // rebuild the post chain for the new preset
    if (this.composer) this.composer.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (q.postProcessing) {
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.34, 0.55, 1.05
        );
        this.composer.addPass(this.bloom);
      } else {
        this.bloom = null;
      }
      this.dread = new ShaderPass(DreadShader);
      this.dread.uniforms.uGrain.value = q.grain ? 1 : 0;
      this.composer.addPass(this.dread);
      if (q.antialias) {
        this.fxaa = new ShaderPass(FXAAShader);
        this.composer.addPass(this.fxaa);
      } else {
        this.fxaa = null;
      }
    } else {
      this.bloom = null;
      this.dread = null;
      this.fxaa = null;
    }
    this.resize();
    this.onQualityChanged?.(this.qualityName, q);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    if (this.fxaa) {
      this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    }
    if (this.dread) this.dread.uniforms.uResolution.value.set(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  /** @param {(dt:number, elapsed:number)=>void} fn */
  add(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  setFear(v) {
    if (this.dread) this.dread.uniforms.uFear.value = v;
  }
  setHurt(v) {
    if (this.dread) this.dread.uniforms.uHurt.value = v;
  }
  flash(v) {
    if (this.dread) this.dread.uniforms.uFlash.value = v;
  }
  setTint(hex) {
    if (this.dread) this.dread.uniforms.uTint.value.setHex(hex);
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, this.clock.getDelta());
      const elapsed = this.clock.elapsedTime;
      this.frame++;

      this._fpsAccum += dt;
      this._fpsFrames++;
      if (this._fpsAccum >= 0.4) {
        this.fps = this._fpsFrames / this._fpsAccum;
        this._fpsAccum = 0;
        this._fpsFrames = 0;
      }

      if (this.paused) { this.renderer.info.autoReset = true; return; }
      for (const fn of this.updaters) {
        try {
          fn(dt, elapsed);
        } catch (err) {
          console.error('[engine] updater threw', err);
          this.updaters.delete(fn);
        }
      }
      if (this.dread) {
        this.dread.uniforms.uTime.value = elapsed;
        const f = this.dread.uniforms.uFlash.value;
        if (f > 0) this.dread.uniforms.uFlash.value = Math.max(0, f - dt * 3);
      }
      if (this.composer) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  get info() {
    const r = this.renderer.info;
    return {
      calls: r.render.calls,
      triangles: r.render.triangles,
      geometries: r.memory.geometries,
      textures: r.memory.textures,
      programs: r.programs ? r.programs.length : 0,
    };
  }
}

export { DreadShader };
