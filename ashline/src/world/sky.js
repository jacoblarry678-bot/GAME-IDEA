/**
 * Procedural sky dome: gradient, sun disc + glow and soft drifting clouds.
 * `overcast` (0..1) greys the sky, thickens clouds and hides the sun;
 * `flash` (0..1) lights the clouds for lightning.
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
      overcast: { value: 0 },
      flash: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float time; uniform float overcast; uniform float flash;
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
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * vec3(0.78, 0.8, 0.84), overcast * 0.8);
        float sunVis = 1.0 - overcast * 0.92;
        col += sunColor * (pow(sd, 900.0) * 6.0 * sunVis * sunVis + pow(sd, 18.0) * 0.35 * sunVis + pow(sd, 3.0) * 0.12 * sunVis);
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.18) * 1.4 + vec2(time * 0.004, time * 0.002) * (1.0 + overcast * 2.5);
          float c = smoothstep(0.52 - overcast * 0.5, 0.85 - overcast * 0.3, fbm(uv));
          vec3 cloud = mix(vec3(0.92, 0.9, 0.86), sunColor, 0.25 * sunVis) * (0.85 + pow(sd, 6.0) * 0.4 * sunVis);
          cloud = mix(cloud, vec3(0.42, 0.44, 0.48) * (0.8 + 0.4 * fbm(uv * 1.7)), overcast * 0.85);
          cloud += vec3(0.75, 0.8, 1.0) * flash * (0.6 + fbm(uv * 0.6 + 3.0));
          col = mix(col, cloud, c * smoothstep(0.0, 0.25, h) * (0.75 + overcast * 0.25));
        }
        col += vec3(0.5, 0.55, 0.7) * flash * 0.35;
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
