// Water: a glossy surface whose normals ripple with layered waves, so the
// sky and sun reflect and sparkle off it. `flow` scrolls the ripples along
// a direction (flume channels).
import * as THREE from 'three';

export const waterTime = { value: 0 };

export function waterMaterial({ color = 0x1b4a56, opacity = 0.9, flow = 0, scale = 1 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.05, metalness: 0.0, transparent: true, opacity, envMapIntensity: 1.25,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.uniforms.uFlow = { value: flow };
    sh.uniforms.uScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform float uTime;
        uniform float uFlow;
        uniform float uScale;
        float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), u.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float waves(vec2 p, float t) {
          float h = 0.0;
          h += sin(dot(p, vec2(0.21, 0.13)) + t * 1.1) * 0.5;
          h += sin(dot(p, vec2(-0.17, 0.27)) + t * 1.4) * 0.35;
          h += sin(dot(p, vec2(0.41, -0.33)) + t * 2.1) * 0.18;
          h += (wn(p * 0.7 + vec2(t * 0.3, t * 0.2)) - 0.5) * 0.9;
          h += (wn(p * 1.9 - vec2(t * 0.5, -t * 0.4)) - 0.5) * 0.4;
          return h;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xz * uScale;
          p.y -= uTime * uFlow;
          float e = 0.35;
          float h0 = waves(p, uTime);
          vec2 grad = vec2(waves(p + vec2(e, 0.0), uTime) - h0, waves(p + vec2(0.0, e), uTime) - h0) / e;
          vec3 pert = (viewMatrix * vec4(-grad.x * 0.16, 0.0, -grad.y * 0.16, 0.0)).xyz;
          normal = normalize(normal + pert);
        }`);
  };
  mat.customProgramCacheKey = () => 'water';
  return mat;
}
