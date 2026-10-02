/** Renderer, camera and the frame loop (lightweight: no post-processing). */

import * as THREE from 'three';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.1, 1200);
    this.view = { scene: this.scene, camera: this.camera };
    this.updaters = [];
    this.timeScale = 1;
    this.fps = 60;
    this.elapsed = 0;
    this._last = performance.now();
    this._acc = 0;
    this._frames = 0;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    for (const cam of [this.camera, this.view.camera]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  }

  add(fn) {
    this.updaters.push(fn);
  }

  /** Advances the simulation by `dt` seconds without waiting for frames (tests). */
  step(dt) {
    this.elapsed += dt;
    for (const fn of this.updaters) fn(dt, this.elapsed);
    this.afterStep?.();
  }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      const raw = Math.min(0.1, (now - this._last) / 1000);
      this._last = now;
      this._acc += raw;
      this._frames++;
      if (this._acc > 0.5) {
        this.fps = this._frames / this._acc;
        this._acc = 0;
        this._frames = 0;
      }
      if (document.hidden) return;
      // large time scales (tests) are split into safe sub-steps
      let left = raw * this.timeScale;
      while (left > 1e-6) {
        const dt = Math.min(left, 1 / 30);
        left -= dt;
        this.elapsed += dt;
        for (const fn of this.updaters) {
          try {
            fn(dt, this.elapsed);
          } catch (e) {
            console.error('[engine]', e);
          }
        }
        this.afterStep?.();
      }
      this.renderer.render(this.view.scene, this.view.camera);
    };
    requestAnimationFrame(loop);
  }
}
