/**
 * Procedural sky dome: gradient, sun disc + glow and soft drifting clouds.
 */
import * as THREE from 'three';

export function createSky(def) {
  const sunDir = new THREE.Vector3(...def.sun.dir).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(def.sky.top) },
      horizon: { value: new THREE.Color(def.sky.horizon) },
      ground: { value: new THREE.Color(def.sky.ground) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(def.sun.color) },
      time: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 4.0, 0.0, 1.0));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 3.0) * 0.12);
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.18) * 1.4 + vec2(time * 0.004, time * 0.002);
          float c = smoothstep(0.52, 0.85, fbm(uv));
          vec3 cloud = mix(vec3(0.92, 0.9, 0.86), sunColor, 0.25) * (0.85 + pow(sd, 6.0) * 0.4);
          col = mix(col, cloud, c * smoothstep(0.0, 0.25, h) * 0.75);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  return mesh;
}
