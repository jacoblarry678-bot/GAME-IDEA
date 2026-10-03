/**
 * World effects: GPU-instanced billboard particles (one draw call per blend
 * mode), bullet tracers, impact decals, explosions, smoke clouds, muzzle
 * flash lights and grenade meshes.
 */
import * as THREE from 'three';
import { spriteTexture, decalTexture } from '../world/textures.js';
import { buildGrenade } from './weaponModels.js';

const MAX_PARTICLES = { low: 300, medium: 700, high: 1400 };

/** Instanced camera-facing quads with per-instance color/alpha/size/rotation. */
class BillboardSystem {
  constructor(scene, max, texture, blending, depthWrite = false) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.sr = new Float32Array(max * 2);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iSR', new THREE.InstancedBufferAttribute(this.sr, 2).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    this.geom = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSR;
        varying vec2 vUv; varying vec4 vCol; varying float vFogDepth;
        void main() {
          vUv = uv; vCol = iCol;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float c = cos(iSR.y), s = sin(iSR.y);
          vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSR.x;
          mv.xy += p;
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity;
        varying vec2 vUv; varying vec4 vCol; varying float vFogDepth;
        void main() {
          vec4 t = texture2D(map, vUv);
          vec4 c = t * vCol;
          float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          ${blending === THREE.AdditiveBlending ? 'c.rgb *= (1.0 - f);' : 'c.rgb = mix(c.rgb, fogColor, f);'}
          if (c.a < 0.004) discard;
          gl_FragColor = c;
        }`,
      transparent: true,
      depthWrite,
      blending,
    });
    this.mat = mat;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
    this.mesh.renderOrder = blending === THREE.AdditiveBlending ? 5 : 4;
    scene.add(this.mesh);
    this.p = []; // live particles
  }

  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    o.age = 0;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.vz = o.vz || 0;
    o.g = o.g || 0; o.drag = o.drag ?? 0;
    o.size0 = o.size; o.size1 = o.size1 ?? o.size;
    o.a0 = o.a ?? 1; o.a1 = o.a1 ?? 0;
    o.rot = o.rot ?? Math.random() * Math.PI * 2; o.vr = o.vr || 0;
    this.p.push(o);
  }

  update(dt, scene) {
    if (scene.fog) { this.mat.uniforms.fogColor.value.copy(scene.fog.color); this.mat.uniforms.fogDensity.value = scene.fog.density; }
    let n = 0;
    const live = [];
    for (const o of this.p) {
      o.age += dt;
      if (o.age >= o.life) continue;
      const k = o.age / o.life;
      o.vy -= o.g * dt;
      const dr = Math.max(0, 1 - o.drag * dt);
      o.vx *= dr; o.vy *= dr; o.vz *= dr;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.floor !== undefined && o.y < o.floor) { o.y = o.floor; o.vy *= -0.3; o.vx *= 0.6; o.vz *= 0.6; }
      o.rot += o.vr * dt;
      const i3 = n * 3, i4 = n * 4, i2 = n * 2;
      this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
      const fadeIn = o.fadeIn ? Math.min(1, o.age / o.fadeIn) : 1;
      this.col[i4] = o.r; this.col[i4 + 1] = o.gr; this.col[i4 + 2] = o.b;
      this.col[i4 + 3] = (o.a0 + (o.a1 - o.a0) * k) * fadeIn;
      this.sr[i2] = o.size0 + (o.size1 - o.size0) * k; this.sr[i2 + 1] = o.rot;
      live.push(o);
      n++;
      if (n >= this.max) break;
    }
    this.p = live;
    this.geom.instanceCount = n;
    this.geom.attributes.iPos.needsUpdate = true;
    this.geom.attributes.iCol.needsUpdate = true;
    this.geom.attributes.iSR.needsUpdate = true;
    this.geom.attributes.iPos.clearUpdateRanges?.();
  }
}

export class Effects {
  constructor(engine, settings, wmats) {
    this.engine = engine;
    this.scene = engine.scene;
    this.settings = settings;
    const q = settings.data.graphics.effects;
    const max = MAX_PARTICLES[q] || 1000;
    this.add = new BillboardSystem(this.scene, max, spriteTexture('spark'), THREE.AdditiveBlending);
    this.fire = new BillboardSystem(this.scene, 300, spriteTexture('flash'), THREE.AdditiveBlending);
    this.smoke = new BillboardSystem(this.scene, max, spriteTexture('smoke'), THREE.NormalBlending);
    this.dust = new BillboardSystem(this.scene, max, spriteTexture('dust'), THREE.NormalBlending);
    // tracers
    this.tracers = [];
    const tg = new THREE.BoxGeometry(0.018, 0.018, 1);
    tg.translate(0, 0, -0.5);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, tm);
      m.visible = false; m.frustumCulled = false;
      this.scene.add(m);
      this.tracers.push({ m, life: 0 });
    }
    this.tracerIdx = 0;
    // decals (instanced)
    const dg = new THREE.PlaneGeometry(1, 1);
    const dmat = new THREE.MeshStandardMaterial({ map: decalTexture('bullet'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.9 });
    this.decalMax = 160;
    this.decals = new THREE.InstancedMesh(dg, dmat, this.decalMax);
    this.decals.count = 0; this.decals.frustumCulled = false;
    this.decals.renderOrder = 1;
    this.scene.add(this.decals);
    this.decalIdx = 0;
    const smat = new THREE.MeshStandardMaterial({ map: decalTexture('scorch'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, roughness: 1 });
    this.scorch = new THREE.InstancedMesh(dg, smat, 16);
    this.scorch.count = 0; this.scorch.frustumCulled = false;
    this.scene.add(this.scorch);
    this.scorchIdx = 0;
    // muzzle flash lights (fixed count so shaders never recompile)
    this.lights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 9, 2);
      this.scene.add(l);
      this.lights.push({ l, t: 0, peak: 0 });
    }
    this.lightIdx = 0;
    this.expLight = new THREE.PointLight(0xff9a40, 0, 22, 2);
    this.scene.add(this.expLight);
    this.expT = 0;
    // grenades
    this.wmats = wmats;
    this.grenadeMeshes = new Map();
    this.smokeClouds = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
  }

  get quality() { return this.settings.data.graphics.effects; }
  get qMul() { return { low: 0.4, medium: 0.7, high: 1 }[this.quality] || 1; }

  tracer(x0, y0, z0, x1, y1, z1) {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const L = Math.hypot(dx, dy, dz);
    if (L < 2) return;
    t.ox = x0; t.oy = y0; t.oz = z0;
    t.dx = dx / L; t.dy = dy / L; t.dz = dz / L;
    t.L = L; t.d = 0; t.speed = 420; t.life = 1;
    t.m.visible = true;
    t.m.position.set(x0, y0, z0);
    t.m.lookAt(x0 + t.dx, y0 + t.dy, z0 + t.dz);
  }

  muzzleFlash(x, y, z, dx, dy, dz, big = 1) {
    const rf = this.settings.data.accessibility.reducedFlash ? 0.4 : 1;
    this.fire.spawn({ x: x + dx * 0.05, y: y + dy * 0.05, z: z + dz * 0.05, size: 0.35 * big, size1: 0.5 * big, life: 0.05, r: 1, gr: 0.85, b: 0.6, a: rf, a1: 0 });
    const L = this.lights[this.lightIdx++ % this.lights.length];
    L.l.position.set(x, y, z);
    L.t = 0.06; L.peak = 6 * big * rf;
    if (this.quality !== 'low') this.smoke.spawn({ x, y, z, vx: dx * 0.6, vy: 0.3, vz: dz * 0.6, size: 0.2, size1: 0.6, life: 0.5, r: 0.8, gr: 0.8, b: 0.8, a: 0.18, drag: 2 });
  }

  impact(x, y, z, nx, ny, nz, mat) {
    const q = this.qMul;
    const n = Math.max(1, Math.round(5 * q));
    if (mat === 'metal') {
      for (let i = 0; i < n + 2; i++) {
        this.add.spawn({ x, y, z, vx: nx * 3 + (Math.random() - 0.5) * 5, vy: ny * 3 + Math.random() * 3, vz: nz * 3 + (Math.random() - 0.5) * 5, g: 12, size: 0.05, size1: 0.02, life: 0.25 + Math.random() * 0.2, r: 1, gr: 0.75, b: 0.4, a: 1, a1: 0 });
      }
      this.dust.spawn({ x, y, z, vx: nx * 0.4, vy: 0.2, vz: nz * 0.4, size: 0.12, size1: 0.4, life: 0.4, r: 0.5, gr: 0.5, b: 0.5, a: 0.5, drag: 3 });
    } else {
      const col = mat === 'wood' ? [0.55, 0.42, 0.28] : mat === 'brick' ? [0.6, 0.38, 0.3] : mat === 'gravel' ? [0.55, 0.52, 0.47] : [0.66, 0.64, 0.6];
      for (let i = 0; i < n; i++) {
        this.dust.spawn({ x, y, z, vx: nx * (1 + Math.random() * 2) + (Math.random() - 0.5), vy: ny * 1.5 + Math.random() * 1.2, vz: nz * (1 + Math.random() * 2) + (Math.random() - 0.5), g: 2, drag: 2.5, size: 0.08, size1: 0.45 + Math.random() * 0.3, life: 0.5 + Math.random() * 0.5, r: col[0], gr: col[1], b: col[2], a: 0.7, a1: 0 });
      }
      for (let i = 0; i < Math.round(3 * q); i++) {
        this.dust.spawn({ x, y, z, vx: nx * 4 + (Math.random() - 0.5) * 4, vy: ny * 4 + Math.random() * 3, vz: nz * 4 + (Math.random() - 0.5) * 4, g: 14, size: 0.03, life: 0.4, r: col[0] * 0.6, gr: col[1] * 0.6, b: col[2] * 0.6, a: 1, a1: 1 });
      }
    }
    this.decal(x, y, z, nx, ny, nz, 0.09 + Math.random() * 0.04);
  }

  decal(x, y, z, nx, ny, nz, size) {
    const i = this.decalIdx++ % this.decalMax;
    const n = this._v.set(nx, ny, nz);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const spin = new THREE.Quaternion().setFromAxisAngle(n, Math.random() * Math.PI * 2);
    this._q.premultiply(spin);
    this._s.set(size, size, size);
    this._m.compose(new THREE.Vector3(x + nx * 0.004, y + ny * 0.004, z + nz * 0.004), this._q, this._s);
    this.decals.setMatrixAt(i, this._m);
    this.decals.count = Math.min(this.decalMax, Math.max(this.decals.count, i + 1));
    this.decals.instanceMatrix.needsUpdate = true;
  }

  bodyHit(x, y, z, dx, dz, head) {
    const q = this.qMul;
    for (let i = 0; i < Math.round((head ? 7 : 4) * q) + 1; i++) {
      this.dust.spawn({ x, y, z, vx: dx * 1.5 + (Math.random() - 0.5) * 1.2, vy: Math.random() * 1.2, vz: dz * 1.5 + (Math.random() - 0.5) * 1.2, g: 3, drag: 3, size: 0.06, size1: 0.3, life: 0.35, r: 0.45, gr: 0.06, b: 0.05, a: 0.7, a1: 0 });
    }
  }

  explosion(x, y, z, radius) {
    const q = this.qMul;
    const rf = this.settings.data.accessibility.reducedFlash ? 0.45 : 1;
    for (let i = 0; i < Math.round(14 * q) + 4; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2;
      const s = 3 + Math.random() * 5;
      this.fire.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1, vz: Math.sin(a) * Math.cos(e) * s, drag: 5, size: 0.8, size1: 2.2, life: 0.35 + Math.random() * 0.2, r: 1, gr: 0.6 + Math.random() * 0.2, b: 0.25, a: rf, a1: 0 });
    }
    for (let i = 0; i < Math.round(16 * q) + 4; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.smoke.spawn({ x: x + Math.cos(a) * 0.5, y: y + 0.4 + Math.random(), z: z + Math.sin(a) * 0.5, vx: Math.cos(a) * s, vy: 1 + Math.random() * 2, vz: Math.sin(a) * s, drag: 1.5, size: 1.2, size1: 4 + Math.random() * 2, life: 2.5 + Math.random() * 2, r: 0.25, gr: 0.23, b: 0.21, a: 0.75, a1: 0, fadeIn: 0.1, vr: (Math.random() - 0.5) * 0.6 });
    }
    for (let i = 0; i < Math.round(22 * q) + 6; i++) {
      this.add.spawn({ x, y: y + 0.2, z, vx: (Math.random() - 0.5) * 18, vy: Math.random() * 10, vz: (Math.random() - 0.5) * 18, g: 14, size: 0.06, size1: 0.02, life: 0.5 + Math.random() * 0.5, r: 1, gr: 0.7, b: 0.3, a: 1, a1: 0, floor: y });
    }
    this.expLight.position.set(x, y + 1, z);
    this.expT = 0.35;
    this.expPeak = 40 * rf;
    // scorch
    const i = this.scorchIdx++ % 16;
    this._m.compose(new THREE.Vector3(x, y + 0.01, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.random() * 6)), new THREE.Vector3(3, 3, 3));
    this.scorch.setMatrixAt(i, this._m);
    this.scorch.count = Math.min(16, Math.max(this.scorch.count, i + 1));
    this.scorch.instanceMatrix.needsUpdate = true;
  }

  smokeCloud(x, y, z, radius, duration) {
    this.smokeClouds.push({ x, y, z, radius, duration, age: 0, emit: 0 });
  }

  grenadeMesh(g) {
    let m = this.grenadeMeshes.get(g.id);
    if (!m) {
      m = buildGrenade(g.kind, this.wmats);
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(m);
      this.grenadeMeshes.set(g.id, m);
    }
    return m;
  }

  update(dt, projectiles) {
    // tracers fly along their path
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.d += t.speed * dt;
      const len = Math.min(5, t.d, t.L - t.d + 5);
      if (t.d - len > t.L) { t.life = 0; t.m.visible = false; continue; }
      const head = Math.min(t.d, t.L);
      t.m.position.set(t.ox + t.dx * head, t.oy + t.dy * head, t.oz + t.dz * head);
      t.m.scale.z = Math.max(0.1, Math.min(len, head));
    }
    for (const L of this.lights) {
      if (L.t > 0) { L.t -= dt; L.l.intensity = L.peak * Math.max(0, L.t / 0.06); } else L.l.intensity = 0;
    }
    if (this.expT > 0) { this.expT -= dt; this.expLight.intensity = this.expPeak * Math.max(0, this.expT / 0.35); } else this.expLight.intensity = 0;
    // smoke grenade clouds emit billboards
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const c = this.smokeClouds[i];
      c.age += dt;
      if (c.age > c.duration) { this.smokeClouds.splice(i, 1); continue; }
      const growing = Math.min(1, c.age / 2.2);
      const ending = c.age > c.duration - 3;
      c.emit += dt * (ending ? 2 : 16) * this.qMul;
      while (c.emit > 1) {
        c.emit -= 1;
        const r = c.radius * growing * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        this.smoke.spawn({ x: c.x + Math.cos(a) * r, y: c.y + 0.2 + Math.random() * 2.8 * growing, z: c.z + Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.3, vy: 0.08, vz: (Math.random() - 0.5) * 0.3, size: 2.4, size1: 3.6, life: 3.2, r: 0.82, gr: 0.83, b: 0.84, a: 0.55, a1: 0, fadeIn: 0.6, vr: (Math.random() - 0.5) * 0.3 });
      }
    }
    // grenade meshes follow simulation
    const live = new Set();
    for (const g of projectiles.list) {
      live.add(g.id);
      const m = this.grenadeMesh(g);
      m.position.set(g.x, g.y, g.z);
      m.rotation.set(g.spin, g.spin * 0.7, 0);
      if (g.kind === 'smoke' && g.fuse < 0.3 && Math.random() < 0.5) this.smoke.spawn({ x: g.x, y: g.y + 0.1, z: g.z, vy: 1, size: 0.3, size1: 1.2, life: 1, r: 0.8, gr: 0.8, b: 0.8, a: 0.4 });
    }
    for (const [id, m] of this.grenadeMeshes) {
      if (!live.has(id)) { this.scene.remove(m); this.grenadeMeshes.delete(id); }
    }
    this.add.update(dt, this.scene);
    this.fire.update(dt, this.scene);
    this.smoke.update(dt, this.scene);
    this.dust.update(dt, this.scene);
  }
}
