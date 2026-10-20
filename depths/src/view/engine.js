/**
 * Rendering engine: WebGL renderer, world scene + first-person overlay
 * scene, a single post pass (grain, vignette, chromatic aberration, damage
 * edge, composure desaturation, flash and fades), resolution scaling and
 * frame statistics. Every comfort effect has its own setting.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY } from '../core/settings.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.05 }, vignette: { value: 0.35 },
    aberration: { value: 0.0 }, damage: { value: 0 }, desat: { value: 0 }, fade: { value: 0 }, flash: { value: 0 },
    lowHealth: { value: 0 }, brightness: { value: 1 }, resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, aberration, damage, desat, fade, flash, lowHealth, brightness; uniform vec2 resolution;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c,c);
      vec3 col;
      if (aberration > 0.0) {
        vec2 off = c * aberration * 0.0045;
        col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      } else col = texture2D(tDiffuse, vUv).rgb;
      col *= brightness;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(l), desat);
      col *= 1.0 - vignette * smoothstep(0.08, 0.6, r2);
      float edge = smoothstep(0.12, 0.5, r2);
      col = mix(col, vec3(0.45,0.02,0.02), edge * clamp(damage + lowHealth * (0.5 + 0.5*sin(time*5.0)) * 0.6, 0.0, 0.85));
      col += (rand(vUv * resolution + time * 37.0) - 0.5) * grain;
      col = mix(col, vec3(1.0, 0.98, 0.94), flash);
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Engine {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 120);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.set(0);
    this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0xfff4d8, 0x3a3020, 0.35);
    this.scene.add(this.hemi);

    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(55, 16 / 9, 0.01, 5);
    this.vmHemi = new THREE.HemisphereLight(0xfff4d8, 0x3a3020, 0.6);
    this.vmKey = new THREE.PointLight(0xfff0d8, 1.2, 3, 2);
    this.vmKey.position.set(0.3, 0.4, 0.3);
    this.vmScene.add(this.vmHemi, this.vmKey);

    this.composer = new EffectComposer(this.renderer);
    this.rp = new RenderPass(this.scene, this.camera);
    this.vmPass = new RenderPass(this.vmScene, this.vmCamera);
    this.vmPass.clear = false;
    this.vmPass.clearDepth = true;
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.rp);
    this.composer.addPass(this.vmPass);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.fxState = { damage: 0, desat: 0, fade: 0, flash: 0, lowHealth: 0, extraGrain: 0 };

    this.fps = 60; this._frames = 0; this._lastStat = performance.now();
    this.hfov = 90;
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange(() => { this.applySettings(); this.resize(); });
  }

  applySettings() {
    const g = this.settings.data.graphics;
    const q = QUALITY[g.quality] || QUALITY.high;
    this.quality = q;
    this.renderScale = Math.min(g.renderScale, q.renderScale === 1 ? 1 : Math.max(g.renderScale * 0.85, q.renderScale));
    this.renderer.shadowMap.enabled = !!(g.shadows && q.shadows);
    this.hfov = g.fov;
    const A = this.settings.data.accessibility;
    this.final.uniforms.grain.value = A.grain ? 0.045 : 0;
    this.final.uniforms.aberration.value = A.aberration ? 1 : 0;
    this.final.uniforms.brightness.value = g.brightness;
    this._setFov();
  }

  _setFov() {
    const aspect = this.camera.aspect || 16 / 9;
    const v = 2 * Math.atan(Math.tan((this.hfov * Math.PI / 180) / 2) / aspect) * 180 / Math.PI;
    this.camera.fov = Math.max(40, Math.min(100, v));
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = aspect;
    this.vmCamera.updateProjectionMatrix();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.renderScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this._setFov();
    this.final.uniforms.resolution.value.set(w * pr, h * pr);
  }

  render(dt, showViewmodel = true) {
    const u = this.final.uniforms;
    const s = this.fxState;
    u.time.value = (u.time.value + dt) % 1000;
    u.damage.value = s.damage; u.desat.value = s.desat; u.fade.value = s.fade; u.flash.value = s.flash; u.lowHealth.value = s.lowHealth;
    const A = this.settings.data.accessibility;
    u.vignette.value = 0.32 + (A.stressEffects ? s.desat * 0.4 : 0);
    u.grain.value = A.grain ? 0.04 + (A.stressEffects ? s.extraGrain : 0) : 0;
    this.vmPass.enabled = showViewmodel;
    this.renderer.info.reset();
    this.composer.render(dt);
    this._frames++;
    const now = performance.now();
    if (now - this._lastStat > 500) { this.fps = this._frames * 1000 / (now - this._lastStat); this._frames = 0; this._lastStat = now; }
  }
}
