/**
 * Hollow Night atmosphere (Halloween event): turns the map's day into a violet
 * night with a pale moon, purple fog and glowing jack-o'-lanterns placed
 * around the map's points of interest. Presentation only — no collision, no
 * effect on bots or hit detection. Restores the map on dispose.
 *
 * Construct it before WeatherView so the weather blends on top of the night.
 */
import * as THREE from 'three';

const NIGHT = { top: 0x120a24, horizon: 0x3a1f5a, ground: 0x0c0a12, moon: 0xb8c4ff, fog: 0x2a1d40, hemiSky: 0x5a4a8a, hemiGround: 0x1a1222 };

export class HalloweenView {
  constructor(app, match) {
    this.app = app;
    this.m = match;
    const e = app.engine, sky = app.sky?.material.uniforms;
    this.base = {
      sun: e.sun.intensity, sunColor: e.sun.color.clone(), vmSun: e.vmSun?.intensity ?? 1,
      hemi: e.hemi.intensity, hemiColor: e.hemi.color.clone(), hemiGround: e.hemi.groundColor.clone(),
      fogColor: e.scene.fog.color.clone(), fogDensity: e.scene.fog.density, envI: e.scene.environmentIntensity,
      sky: sky ? { top: sky.top.value.clone(), horizon: sky.horizon.value.clone(), ground: sky.ground.value.clone(), sunColor: sky.sunColor.value.clone() } : null,
    };
    // night
    e.sun.intensity = this.base.sun * 0.3;
    e.sun.color.set(NIGHT.moon);
    if (e.vmSun) e.vmSun.intensity = this.base.vmSun * 0.55;
    e.hemi.intensity = this.base.hemi * 0.6;
    e.hemi.color.set(NIGHT.hemiSky);
    e.hemi.groundColor.set(NIGHT.hemiGround);
    e.scene.fog.color.set(NIGHT.fog);
    e.scene.fog.density = this.base.fogDensity * 1.35;
    e.scene.environmentIntensity = this.base.envI * 0.4;
    if (sky) { sky.top.value.set(NIGHT.top); sky.horizon.value.set(NIGHT.horizon); sky.ground.value.set(NIGHT.ground); sky.sunColor.value.set(NIGHT.moon); }
    this.group = new THREE.Group();
    this.group.name = 'hollow-night';
    e.scene.add(this.group);
    this.buildLanterns();
    this.t = 0;
  }

  /** Jack-o'-lanterns on walkable ground near hotspots, preferring spots next to cover. */
  buildLanterns() {
    const nav = this.m.nav, hs = this.m.map.hotspots || [];
    const rind = new THREE.MeshStandardMaterial({ color: 0xe0661a, roughness: 0.55, emissive: 0x3a1000, emissiveIntensity: 0.6 });
    const stem = new THREE.MeshStandardMaterial({ color: 0x3e6a24, roughness: 0.8 });
    this.glow = new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xff9a1a, emissiveIntensity: 3, toneMapped: false });
    this.mats = [rind, stem, this.glow];
    const lobe = new THREE.SphereGeometry(0.17, 12, 10);
    const stemG = new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6);
    const eye = new THREE.ConeGeometry(0.05, 0.07, 3);
    const mouth = new THREE.BoxGeometry(0.2, 0.06, 0.04);
    this.geoms = [lobe, stemG, eye, mouth];
    const spots = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const h of hs) {
      let best = -1, bc = -1;
      for (let tries = 0; tries < 30; tries++) {
        const i = nav.nearest(h.x + (rnd() - 0.5) * 10, h.z + (rnd() - 0.5) * 10, null, 3);
        if (i < 0) continue;
        if (nav.cover[i] > bc) { bc = nav.cover[i]; best = i; }
      }
      if (best >= 0) spots.push(nav.center(best));
    }
    this.lanterns = [];
    for (const p of spots) {
      if (!Number.isFinite(p.y)) continue;
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = rnd() * Math.PI * 2;
      const s = 0.8 + rnd() * 0.6;
      g.scale.setScalar(s);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const l = new THREE.Mesh(lobe, rind);
        l.position.set(Math.cos(a) * 0.11, 0.17, Math.sin(a) * 0.11);
        l.scale.set(0.8, 0.9, 0.8);
        l.castShadow = true;
        g.add(l);
      }
      const st = new THREE.Mesh(stemG, stem); st.position.y = 0.36; st.rotation.z = 0.2; g.add(st);
      for (const sx of [-1, 1]) { const ey = new THREE.Mesh(eye, this.glow); ey.position.set(sx * 0.08, 0.22, -0.27); ey.rotation.x = -Math.PI / 2; g.add(ey); }
      const mo = new THREE.Mesh(mouth, this.glow); mo.position.set(0, 0.12, -0.27); g.add(mo);
      this.group.add(g);
      this.lanterns.push(g);
    }
    // a few real lights (the nearest lanterns get one each, re-assigned as you move)
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xff8a2a, 0, 9, 1.6);
      this.group.add(L);
      this.lights.push(L);
    }
    this.lightT = 0;
  }

  /** Moon/sun-glare strength multiplier for the flare overlay. */
  get flareScale() { return 0.3; }

  update(dt) {
    this.t += dt;
    const flick = 0.85 + 0.15 * Math.sin(this.t * 17) * Math.sin(this.t * 7.3);
    this.glow.emissiveIntensity = 3 * flick;
    this.lightT -= dt;
    if (this.lightT <= 0 && this.lanterns.length) {
      this.lightT = 0.5;
      const cam = this.app.engine.camera.position;
      const near = [...this.lanterns].sort((a, b) => a.position.distanceToSquared(cam) - b.position.distanceToSquared(cam));
      this.lights.forEach((L, i) => { const g = near[i]; if (g) { L.position.set(g.position.x, g.position.y + 0.35, g.position.z); L.visible = true; } else L.visible = false; });
    }
    for (const L of this.lights) L.intensity = 6 * flick;
  }

  dispose() {
    const e = this.app.engine, b = this.base, sky = this.app.sky?.material.uniforms;
    e.sun.intensity = b.sun; e.sun.color.copy(b.sunColor);
    if (e.vmSun) e.vmSun.intensity = b.vmSun;
    e.hemi.intensity = b.hemi; e.hemi.color.copy(b.hemiColor); e.hemi.groundColor.copy(b.hemiGround);
    e.scene.fog.color.copy(b.fogColor); e.scene.fog.density = b.fogDensity;
    e.scene.environmentIntensity = b.envI;
    if (sky && b.sky) { sky.top.value.copy(b.sky.top); sky.horizon.value.copy(b.sky.horizon); sky.ground.value.copy(b.sky.ground); sky.sunColor.value.copy(b.sky.sunColor); }
    e.scene.remove(this.group);
    for (const g of this.geoms) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
