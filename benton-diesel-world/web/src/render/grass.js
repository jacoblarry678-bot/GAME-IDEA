// Grass blades around the camera: a field of thin blades that follows the
// view (each blade keeps its spot in the world), grows only on open lawn
// (not under paths, buildings or water) and sways in the wind.
import * as THREE from 'three';
import { P } from '../geom.js';
import { rng } from './noise.js';

const RES = 1.25; // studs per mask cell
const X0 = -620, Z0 = -640, SIZE = 1240;

// Where grass may grow, and the ground height there.
function buildMask(data, terrain) {
  const n = Math.ceil(SIZE / RES);
  const mask = new Uint8Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = X0 + (i + 0.5) * RES, z = Z0 + (j + 0.5) * RES;
      const s = terrain.sample(x, z);
      const k = (j * n + i) * 2;
      mask[k] = s.rock > 0.2 || s.sand > 0.2 || s.h < -0.3 ? 0 : 255;
      mask[k + 1] = Math.max(0, Math.min(255, Math.round((s.h + 4) / 64 * 255)));
    }
  }
  // anything standing on the ground covers the grass under it
  for (const p of data.static) {
    const sx = p[P.SX], sy = p[P.SY], sz = p[P.SZ];
    const ax = [p[7], p[10], p[13]], ay = [p[8], p[11], p[14]], az = [p[9], p[12], p[15]];
    // vertical extent
    const hy = (Math.abs(ax[1]) * sx + Math.abs(ay[1]) * sy + Math.abs(az[1]) * sz) / 2;
    if (p[P.Y] - hy > 1.2 || p[P.Y] + hy < -0.3) continue;
    const ex = (Math.abs(ax[0]) * sx + Math.abs(ay[0]) * sy + Math.abs(az[0]) * sz) / 2;
    const ez = (Math.abs(ax[2]) * sx + Math.abs(ay[2]) * sy + Math.abs(az[2]) * sz) / 2;
    if (ex * ez > 40000) continue; // huge ground plates
    const i0 = Math.max(0, Math.floor((p[P.X] - ex - X0) / RES)), i1 = Math.min(n - 1, Math.floor((p[P.X] + ex - X0) / RES));
    const j0 = Math.max(0, Math.floor((p[P.Z] - ez - Z0) / RES)), j1 = Math.min(n - 1, Math.floor((p[P.Z] + ez - Z0) / RES));
    // test cell centers against the rotated footprint
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = X0 + (i + 0.5) * RES - p[P.X], dz = Z0 + (j + 0.5) * RES - p[P.Z];
        const lx = dx * ax[0] + dz * ax[2], ly = dx * ay[0] + dz * ay[2], lz = dx * az[0] + dz * az[2];
        if (Math.abs(lx) <= sx / 2 + 0.4 && Math.abs(ly) <= sy / 2 + 0.4 && Math.abs(lz) <= sz / 2 + 0.4) mask[(j * n + i) * 2] = 0;
      }
    }
  }
  const tex = new THREE.DataTexture(mask, n, n, THREE.RGFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Grass {
  constructor(scene, data, terrain, { count = 60000, radius = 46 } = {}) {
    this.radius = radius;
    this.enabled = true;
    const rand = rng(31);
    // one triangle strip of 3 segments per blade, in blade space
    const SEG = 3;
    const vertsPer = SEG * 2 + 1;
    const pos = new Float32Array(count * vertsPer * 3);
    const root = new Float32Array(count * vertsPer * 4); // x, z, height, shade
    const idx = [];
    for (let b = 0; b < count; b++) {
      // spread evenly over the disc around the camera
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
      const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
      const h = 0.4 + rand() * 0.55;
      const w = 0.09 + rand() * 0.06;
      const yaw = rand() * Math.PI;
      const lean = (rand() - 0.5) * 0.6;
      const shade = rand();
      const cx = Math.cos(yaw), cz = Math.sin(yaw);
      const base = b * vertsPer;
      for (let k = 0; k < vertsPer; k++) {
        const level = Math.floor(k / 2) / SEG; // 0..1 up the blade
        const side = k === vertsPer - 1 ? 0 : (k % 2 ? 1 : -1);
        const width = w * (1 - level * 0.85);
        const bend = lean * level * level;
        const o = (base + k) * 3;
        pos[o] = cx * side * width + -cz * bend;
        pos[o + 1] = level;
        pos[o + 2] = cz * side * width + cx * bend;
        const q = (base + k) * 4;
        root[q] = rx; root[q + 1] = rz; root[q + 2] = h; root[q + 3] = shade;
      }
      for (let s = 0; s < SEG; s++) {
        const v = base + s * 2;
        if (s < SEG - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        else idx.push(v, v + 1, v + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRoot', new THREE.BufferAttribute(root, 4));
    g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = {
      uMask: { value: buildMask(data, terrain) },
      uCam: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uRadius: { value: radius },
      uOrigin: { value: new THREE.Vector3(X0, Z0, Math.ceil(SIZE / RES) * RES) },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.4 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aRoot;
          uniform sampler2D uMask;
          uniform vec2 uCam;
          uniform float uTime;
          uniform float uRadius;
          uniform vec3 uOrigin;
          varying vec3 vGrass;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          objectNormal = vec3(0.0, 1.0, 0.0);`)
        .replace('#include <begin_vertex>', `
          // keep each blade fixed in the world as the field follows the view
          float span = uRadius * 2.0;
          vec2 rootW = aRoot.xy + span * floor((uCam - aRoot.xy + uRadius) / span);
          vec2 muv = (rootW - uOrigin.xy) / uOrigin.z;
          vec2 m = texture2D(uMask, muv).rg;
          float d = length(rootW - uCam);
          float fade = 1.0 - smoothstep(uRadius * 0.6, uRadius, d);
          float inside = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
          float hgt = aRoot.z * fade * smoothstep(0.5, 0.95, m.r) * inside;
          float wind = sin(uTime * 1.7 + rootW.x * 0.21 + rootW.y * 0.17) * 0.25 + sin(uTime * 3.1 + rootW.x * 0.7) * 0.06;
          vec3 transformed = vec3(position.x, position.y * hgt, position.z);
          transformed.xz += vec2(wind, wind * 0.6) * position.y * position.y * hgt;
          transformed.xz += rootW;
          transformed.y += m.g * 64.0 - 4.0;
          vGrass = mix(vec3(0.045, 0.12, 0.02), vec3(0.13, 0.25, 0.045), aRoot.w) * (0.6 + 0.7 * position.y);
          if (hgt < 0.05) transformed = vec3(0.0, -100.0, 0.0);
        `);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGrass;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vGrass, opacity );');
    };
    mat.customProgramCacheKey = () => 'grass';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(t, cam) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCam.value.set(cam.x, cam.z);
    this.mesh.visible = this.enabled && cam.y < 140;
  }
}
