/**
 * Weather presentation: rain streaks (stopped by roofs), fog and cloud light,
 * overcast sky, lightning with delayed thunder, wet-ground sheen and a rain
 * audio bed. Reads the match's Weather channels every frame; it never
 * changes the simulation.
 */
import * as THREE from 'three';

const WET_KEYS = ['asphalt', 'cobble', 'concrete', 'concrete_dark', 'gravel', 'ballast', 'dirt'];
const FOG_GREY = new THREE.Color(0x9aa1a8);
const RADIUS = 26, TOP = 16;

export class WeatherView {
  constructor(app, match) {
    this.app = app;
    this.m = match;
    const e = app.engine;
    this.base = {
      sun: e.sun.intensity, vmSun: e.vmSun?.intensity ?? 1, hemi: e.hemi.intensity,
      fogColor: e.scene.fog.color.clone(), fogDensity: e.scene.fog.density,
    };
    this.sky = app.sky;
    this.flash = 0;
    this.flashQ = []; // pending flicker pulses (seconds from now)
    this.boltT = 8;
    this.wet = 0;
    this.audioT = 0;
    this.rainH = null;
    this.paused = false;
    this.buildRoofs();
    this.buildRain();
    // wet-ground materials (only those this map already created)
    this.wetMats = [];
    for (const k of WET_KEYS) {
      if (!app.materials.cache?.has(k)) continue;
      const mat = app.materials.get(k).mat;
      this.wetMats.push({ mat, rough: mat.roughness, color: mat.color.clone() });
    }
  }

  /** 1 m grid of the highest surface over each cell: rain stops there. */
  buildRoofs() {
    const b = this.m.map.def.bounds;
    this.rx = Math.floor(b.minX) - 2; this.rz = Math.floor(b.minZ) - 2;
    this.rw = Math.ceil(b.maxX - b.minX) + 4; this.rd = Math.ceil(b.maxZ - b.minZ) + 4;
    const h = this.roof = new Float32Array(this.rw * this.rd);
    for (const box of this.m.world.boxes) {
      if (!box.solid && !box.sight) continue;
      const x0 = Math.max(0, Math.floor(box.minX - this.rx)), x1 = Math.min(this.rw - 1, Math.floor(box.maxX - this.rx));
      const z0 = Math.max(0, Math.floor(box.minZ - this.rz)), z1 = Math.min(this.rd - 1, Math.floor(box.maxZ - this.rz));
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const i = z * this.rw + x; if (box.maxY > h[i]) h[i] = box.maxY; }
    }
  }

  roofAt(x, z) {
    const ix = Math.floor(x - this.rx), iz = Math.floor(z - this.rz);
    if (ix < 0 || iz < 0 || ix >= this.rw || iz >= this.rd) return 0;
    return this.roof[iz * this.rw + ix];
  }

  buildRain() {
    const q = this.app.settings.data.graphics.effects;
    const n = this.n = q === 'low' ? 900 : q === 'medium' ? 1600 : 2600;
    this.drops = new Float32Array(n * 4); // x, y, z, speed
    this.pos = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xb4bec8, transparent: true, opacity: 0.32, depthWrite: false });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.name = 'rain';
    this.app.engine.scene.add(this.rain);
    const cam = this.app.engine.camera.position;
    for (let i = 0; i < n; i++) this.respawnDrop(i, cam, true);
  }

  respawnDrop(i, cam, anyHeight) {
    const d = this.drops, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RADIUS;
    d[i * 4] = cam.x + Math.cos(a) * r;
    d[i * 4 + 2] = cam.z + Math.sin(a) * r;
    // never start inside a building or under a roof
    d[i * 4 + 1] = Math.max(this.roofAt(d[i * 4], d[i * 4 + 2]) + 0.1, cam.y + (anyHeight ? -6 + Math.random() * (TOP + 6) : TOP - Math.random() * 4));
    d[i * 4 + 3] = 16 + Math.random() * 6;
  }

  setPaused(on) {
    this.paused = on;
    if (on && this.rainH) { this.app.audio.stopLoop(this.rainH, 0.4); this.rainH = null; }
  }

  update(dt, indoor = 0) {
    const w = this.m.weather.cur, app = this.app, e = app.engine, s = app.settings.data;
    const fx = s.graphics.weatherFx;
    const reduced = s.accessibility.reducedFlash;
    // light and fog (always on: visibility is part of the match)
    e.sun.intensity = this.base.sun * (1 - w.cloud * 0.72);
    if (e.vmSun) e.vmSun.intensity = this.base.vmSun * (1 - w.cloud * 0.5);
    e.hemi.intensity = this.base.hemi * (1 + w.cloud * 0.08) + this.flash * (reduced ? 0.6 : 2.2);
    const fog = e.scene.fog;
    fog.color.copy(this.base.fogColor).lerp(FOG_GREY, Math.min(1, w.cloud * 0.6 + w.fog * 0.4));
    if (this.flash > 0) fog.color.lerp(new THREE.Color(0xc8d2e6), this.flash * (reduced ? 0.15 : 0.45));
    fog.density = this.base.fogDensity * (1 + w.fog * 3.2 + w.rain * 0.8);
    if (this.sky) { const u = this.sky.material.uniforms; u.overcast.value = w.cloud; u.flash.value = fx ? this.flash * (reduced ? 0.3 : 1) : 0; }

    // lightning: a few flicker pulses, thunder follows by distance
    if (!this.paused) {
      if (w.storm > 0.5) {
        this.boltT -= dt;
        if (this.boltT <= 0) {
          this.boltT = 6 + Math.random() * 12;
          this.flashQ.push(0, 0.09 + Math.random() * 0.05);
          if (Math.random() < 0.5) this.flashQ.push(0.3 + Math.random() * 0.2);
          const dist = 0.4 + Math.random() * 2.6;
          if (app.audio.ready) app.audio.play('thunder', { vol: 1.1 - dist * 0.22, delay: dist, rate: 0.9 + Math.random() * 0.2 });
          this.m.lastBolt = this.m.time;
        }
      }
      for (let i = this.flashQ.length - 1; i >= 0; i--) {
        this.flashQ[i] -= dt;
        if (this.flashQ[i] <= 0) { this.flash = fx ? 1 : 0.25; this.flashQ.splice(i, 1); }
      }
      this.flash = Math.max(0, this.flash - dt * 6);
    }

    // rain streaks
    const cam = e.camera.position;
    const active = fx ? Math.floor(this.n * Math.min(1, w.rain * 1.1)) : 0;
    this.rain.geometry.setDrawRange(0, active * 2);
    this.rain.visible = active > 0;
    if (active > 0 && !this.paused) {
      const d = this.drops, p = this.pos;
      const wx = w.wind * 4.5, wz = w.wind * 1.5;
      const len = 0.55 + w.storm * 0.25;
      for (let i = 0; i < active; i++) {
        const k = i * 4;
        d[k + 1] -= d[k + 3] * dt;
        d[k] += wx * dt; d[k + 2] += wz * dt;
        const dx = d[k] - cam.x, dz = d[k + 2] - cam.z;
        if (d[k + 1] < this.roofAt(d[k], d[k + 2]) || d[k + 1] < cam.y - 8 || dx * dx + dz * dz > RADIUS * RADIUS * 1.2) this.respawnDrop(i, cam, false);
        const j = i * 6;
        p[j] = d[k]; p[j + 1] = d[k + 1]; p[j + 2] = d[k + 2];
        p[j + 3] = d[k] - wx * 0.035; p[j + 4] = d[k + 1] + len; p[j + 5] = d[k + 2] - wz * 0.035;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rainMat.opacity = 0.3 + w.rain * 0.22;
    }

    // wet ground: soaks in over ~25 s, dries over ~60 s
    const target = fx && w.rain > 0.25 ? Math.min(1, w.rain * 1.3) : 0;
    this.wet += (target - this.wet) * Math.min(1, dt / (target > this.wet ? 25 : 60) * 3);
    for (const it of this.wetMats) {
      it.mat.roughness = it.rough * (1 - 0.55 * this.wet);
      it.mat.color.copy(it.color).multiplyScalar(1 - 0.28 * this.wet);
    }

    // rain audio bed (muffled indoors)
    this.audioT -= dt;
    if (this.audioT <= 0 && app.audio.ready && !this.paused) {
      this.audioT = 0.25;
      const vol = w.rain * 0.55 * (1 - indoor * 0.55);
      if (vol > 0.02 && !this.rainH) this.rainH = app.audio.startLoop('rain', 'sfx', vol);
      else if (this.rainH) {
        if (vol <= 0.01) { app.audio.stopLoop(this.rainH, 1.5); this.rainH = null; }
        else this.rainH.g.gain.setTargetAtTime(vol, app.audio.ctx.currentTime, 0.5);
      }
    }
  }

  /** Put the map's lighting and materials back. */
  dispose() {
    const e = this.app.engine;
    e.sun.intensity = this.base.sun;
    if (e.vmSun) e.vmSun.intensity = this.base.vmSun;
    e.hemi.intensity = this.base.hemi;
    e.scene.fog.color.copy(this.base.fogColor);
    e.scene.fog.density = this.base.fogDensity;
    if (this.sky) { this.sky.material.uniforms.overcast.value = 0; this.sky.material.uniforms.flash.value = 0; }
    for (const it of this.wetMats) { it.mat.roughness = it.rough; it.mat.color.copy(it.color); }
    if (this.rainH) { this.app.audio.stopLoop(this.rainH, 0.6); this.rainH = null; }
    e.scene.remove(this.rain);
    this.rain.geometry.dispose();
    this.rainMat.dispose();
  }
}
