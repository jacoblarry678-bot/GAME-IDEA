/**
 * Photo renderer. An exposure re-renders the scene from the camera pose
 * with the hidden layer enabled: 65 degree horizontal cone, nothing beyond
 * twenty metres. The image is developed through a shader that gives the
 * instant-film look: raised blacks, a silver stain on high-contrast edges,
 * vignette and grain. Results become JPEG data URLs for the journal.
 */
import * as THREE from 'three';
import { HIDDEN_LAYER } from './levelView.js';

const W = 480, H = 360;

const DevelopShader = {
  uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, seed: { value: 0 }, flash: { value: 0 }, exposure: { value: 1.2 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tSrc; uniform vec2 texel; uniform float seed, flash, exposure; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233)) + seed) * 43758.5453); }
    vec3 samp(vec2 uv){ return aces(texture2D(tSrc, uv).rgb * exposure); }
    void main(){
      vec3 c = samp(vUv);
      float l = luma(c);
      float lx = luma(samp(vUv + vec2(texel.x,0.0))) - luma(samp(vUv - vec2(texel.x,0.0)));
      float ly = luma(samp(vUv + vec2(0.0,texel.y))) - luma(samp(vUv - vec2(0.0,texel.y)));
      float edge = clamp(length(vec2(lx,ly)) * 3.0, 0.0, 1.0);
      vec3 tone = mix(vec3(l) * vec3(1.03, 1.0, 0.94), c, 0.45);
      tone = pow(tone, vec3(0.92));
      tone = 0.06 + tone * 0.9;
      tone += edge * vec3(0.55, 0.58, 0.62) * smoothstep(0.25, 0.9, l + edge);
      vec2 d = vUv - 0.5;
      tone *= 1.0 - smoothstep(0.18, 0.75, dot(d,d)) * 0.55;
      tone += (rand(vUv * 731.0) - 0.5) * 0.06;
      tone = pow(clamp(tone, 0.0, 1.0), vec3(1.0/2.2));
      gl_FragColor = vec4(tone, 1.0);
    }`,
};

export class PhotoRenderer {
  constructor(engine) {
    this.engine = engine;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.out = new THREE.WebGLRenderTarget(W, H);
    this.cam = new THREE.PerspectiveCamera(2 * Math.atan(Math.tan((65 * Math.PI / 180) / 2) / (W / H)) * 180 / Math.PI, W / H, 0.05, 20.5);
    this.cam.rotation.order = 'YXZ';
    this.cam.layers.enable(0); this.cam.layers.enable(HIDDEN_LAYER);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...DevelopShader, uniforms: THREE.UniformsUtils.clone(DevelopShader.uniforms), depthTest: false, depthWrite: false }));
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();
    this.flashLight = new THREE.PointLight(0xfff8f0, 0, 26, 1.4);
    this.images = new Map();
    this.thumbs = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
  }

  /** Render a photo record. extra: hidden-layer objects (creature reveals) to include. */
  capture(photo, extra = []) {
    const E = this.engine, R = E.renderer, S = E.scene;
    const c = photo.cam;
    this.cam.position.set(c.x, c.y, c.z);
    this.cam.rotation.set(c.pitch, c.yaw, 0);
    this.cam.updateMatrixWorld();
    const fog = S.fog;
    if (photo.flash) { this.flashLight.position.set(c.x, c.y, c.z); this.flashLight.intensity = 90; S.add(this.flashLight); }
    for (const o of extra) S.add(o);
    const prevBg = S.background;
    S.background = new THREE.Color(0x020202);
    const prevTarget = R.getRenderTarget();
    R.setRenderTarget(this.rt);
    R.clear();
    R.render(S, this.cam);
    S.background = prevBg;
    for (const o of extra) S.remove(o);
    if (photo.flash) S.remove(this.flashLight);
    S.fog = fog;
    const u = this.quad.material.uniforms;
    u.tSrc.value = this.rt.texture; u.seed.value = Math.random() * 100; u.flash.value = photo.flash ? 1 : 0;
    u.exposure.value = photo.flash ? 1.0 : 1.35;
    R.setRenderTarget(this.out);
    R.render(this.postScene, this.postCam);
    const buf = new Uint8Array(W * H * 4);
    R.readRenderTargetPixels(this.out, 0, 0, W, H, buf);
    R.setRenderTarget(prevTarget);
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/jpeg', 0.86);
    const tc = document.createElement('canvas'); tc.width = 200; tc.height = 150;
    tc.getContext('2d').drawImage(this.canvas, 0, 0, 200, 150);
    const thumb = tc.toDataURL('image/jpeg', 0.8);
    this.images.set(photo.id, url);
    this.thumbs.set(photo.id, thumb);
    return { url, thumb };
  }

  get(id) { return this.images.get(id) || this.thumbs.get(id) || null; }
  thumb(id) { return this.thumbs.get(id) || this.images.get(id) || null; }
  load(map) { for (const [k, v] of Object.entries(map || {})) { this.thumbs.set(k, v); } }
  exportThumbs(ids) { const o = {}; for (const id of ids) { const t = this.thumbs.get(id); if (t) o[id] = t; } return o; }
}
