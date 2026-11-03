// Post-processing: multisampled HDR render, ambient occlusion (ultra),
// bloom for neon and lights, filmic tone mapping, then a camera look: a
// gentle contrast curve, warm highlights and cool shadows, a vignette and
// fine film grain. Low quality draws straight to the screen instead.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uNight: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uNight;
    uniform float uAspect;
    varying vec2 vUv;
    float gHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      // a touch of lens fringing toward the corners
      float r2 = dot(d * vec2(uAspect, 1.0), d * vec2(uAspect, 1.0));
      vec2 off = d * r2 * 0.0035;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // filmic S-curve and a little more richness
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
      c = mix(vec3(l), c, 1.08 - uNight * 0.18);
      // warm highlights, cool shadows (moonlit blue at night)
      vec3 warm = vec3(1.035, 1.0, 0.955), cool = mix(vec3(0.97, 0.995, 1.04), vec3(0.9, 0.97, 1.12), uNight);
      c *= mix(cool, warm, smoothstep(0.15, 0.75, l));
      // vignette
      c *= 1.0 - smoothstep(0.25, 0.95, r2 * 1.6) * (0.28 + uNight * 0.12);
      // film grain, stronger in the dark
      float g = gHash(vUv * 1024.0 + fract(uTime) * 61.0) - 0.5;
      c += g * (0.018 + 0.03 * (1.0 - smoothstep(0.0, 0.4, l)));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.preset = null;
  }

  // preset: { post: bool, ao: bool, bloom: bool, samples: n }
  configure(preset) {
    this.preset = preset;
    this.composer?.dispose();
    this.composer = null;
    if (!preset.post) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: preset.samples || 0 });
    const composer = new EffectComposer(this.renderer, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (preset.ao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 2, scale: 1, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(ao);
      this.ao = ao;
    } else {
      this.ao = null;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 1.05);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE);
    this.grade.uniforms.uAspect.value = size.x / Math.max(1, size.y);
    composer.addPass(this.grade);
    this.composer = composer;
  }

  setSize(w, h) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    if (this.grade) this.grade.uniforms.uAspect.value = w / Math.max(1, h);
  }

  // bloom a little stronger at night
  render(night) {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.bloom.strength = 0.18 + 0.45 * night;
    this.bloom.threshold = 1.55 - 0.8 * night;
    this.grade.uniforms.uTime.value = performance.now() / 1000;
    this.grade.uniforms.uNight.value = night;
    this.composer.render();
  }
}
