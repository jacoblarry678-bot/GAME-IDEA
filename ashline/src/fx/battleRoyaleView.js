/**
 * Battle Royale world visuals: the storm wall at the edge of the safe zone,
 * a ground ring for the next circle, and loot on the ground (real weapon
 * models, ammo boxes, medkits, grenade packs) with a tier-coloured light
 * beam so it reads at a distance. Purely presentation.
 */
import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { buildWeapon } from './weaponModels.js';
import { brZone, weaponTier } from '../game/battleRoyale.js';

const TIER_COL = { 0: 0xb8bcc0, 1: 0xb8bcc0, 2: 0x4fa3ff, 3: 0xc070ff };
const WALL_H = 70;

export class BattleRoyaleView {
  constructor(scene, match, wmats) {
    this.scene = scene;
    this.m = match;
    this.wmats = wmats;
    this.group = new THREE.Group();
    this.group.name = 'br-view';
    scene.add(this.group);
    // storm wall: open cylinder, animated bands, visible from both sides
    this.wallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0x5a8cff) } },
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vW;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float time; uniform vec3 color; varying vec2 vUv; varying vec3 vW;
        void main() {
          float bands = 0.5 + 0.5 * sin(vW.y * 1.4 - time * 2.2 + sin(vUv.x * 60.0 + time) * 0.8);
          float fade = smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.02, vUv.y);
          float a = (0.16 + bands * 0.22) * fade;
          gl_FragColor = vec4(color * (1.1 + bands * 0.6), a);
        }`,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, WALL_H, 96, 1, true), this.wallMat);
    this.wall.position.y = WALL_H / 2 - 2;
    this.wall.frustumCulled = false;
    this.wall.renderOrder = 5;
    this.wall.userData.noAO = true;
    this.group.add(this.wall);
    // next circle: thin white ring on the ground plus faint posts
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.ring.userData.noAO = true;
    this.group.add(this.ring);
    // loot
    this.items = new Map();
    this.beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    this.mats = {
      ammo: new THREE.MeshStandardMaterial({ color: 0x4b5a32, roughness: 0.7, metalness: 0.2 }),
      ammoLid: new THREE.MeshStandardMaterial({ color: 0xc9a645, roughness: 0.5, metalness: 0.5 }),
      med: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6 }),
      cross: new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.5, emissive: 0x400808 }),
      gear: new THREE.MeshStandardMaterial({ color: 0x3e4a3a, roughness: 0.8 }),
      nade: new THREE.MeshStandardMaterial({ color: 0x5d6b45, roughness: 0.5, metalness: 0.3 }),
    };
    this.t = 0;
  }

  makeItem(it) {
    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    let col = 0xffffff;
    if (it.kind === 'weapon' && WEAPONS[it.wid]) {
      const w = buildWeapon(WEAPONS[it.wid].model, this.wmats, { merge: true });
      w.group.rotation.y = Math.PI / 2;
      w.group.scale.setScalar(1.15);
      spin.add(w.group);
      spin.position.y = 0.45;
      col = TIER_COL[Math.round(weaponTier(it.wid))] ?? 0xffffff;
    } else if (it.kind === 'ammo') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.22), this.mats.ammo);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.24), this.mats.ammoLid);
      lid.position.y = 0.14;
      spin.add(box, lid);
      spin.position.y = 0.2;
      col = 0xffd060;
    } else if (it.kind === 'medkit') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.28), this.mats.med);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.06), this.mats.cross);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.2), this.mats.cross);
      c1.position.y = c2.position.y = 0.116;
      spin.add(box, c1, c2);
      spin.position.y = 0.2;
      col = 0x60ff8a;
    } else {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.3), this.mats.gear);
      spin.add(crate);
      for (let i = 0; i < 3; i++) {
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), this.mats.nade);
        n.position.set(-0.12 + i * 0.12, 0.13, 0);
        spin.add(n);
      }
      spin.position.y = 0.18;
      col = 0xff8a40;
    }
    spin.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    beam.scale.y = it.kind === 'weapon' ? 3.2 : 1.8;
    g.add(beam);
    g.position.set(it.x, it.y, it.z);
    g.userData = { spin, beam, phase: (it.id * 1.7) % 6.28 };
    return g;
  }

  update(dt) {
    const m = this.m;
    if (!m.br) return;
    this.t += dt;
    const z = brZone(m);
    this.wall.position.x = z.x; this.wall.position.z = z.z;
    const r = Math.max(0.05, z.r);
    this.wall.scale.set(r, 1, r);
    this.wallMat.uniforms.time.value = this.t;
    const n = m.br.next;
    const showNext = n && n.r > 0.5 && m.br.zone.state === 'wait';
    this.ring.visible = !!showNext;
    if (showNext) { this.ring.position.set(n.x, 0.06, n.z); this.ring.scale.set(n.r, n.r, 1); this.ringMat.opacity = 0.45 + 0.25 * Math.sin(this.t * 3); }
    // loot: add/remove to match the list, then animate
    const seen = new Set();
    for (const it of m.loot || []) {
      seen.add(it.id);
      let g = this.items.get(it.id);
      if (!g) { g = this.makeItem(it); this.group.add(g); this.items.set(it.id, g); }
      const u = g.userData;
      u.spin.rotation.y += dt * 0.9;
      u.spin.position.y += Math.sin(this.t * 2 + u.phase) * 0.0015;
      u.beam.material.opacity = 0.22 + 0.13 * Math.sin(this.t * 3 + u.phase);
    }
    for (const [id, g] of this.items) {
      if (seen.has(id)) continue;
      this.group.remove(g);
      g.traverse((o) => { if (o.isMesh && o.geometry !== this.beamGeo) o.geometry.dispose(); }); // materials are shared
      g.userData.beam.material.dispose();
      this.items.delete(id);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.wall.geometry.dispose(); this.wallMat.dispose();
    this.ring.geometry.dispose(); this.ringMat.dispose();
    for (const g of this.items.values()) g.userData.beam.material.dispose();
    this.beamGeo.dispose();
    for (const mm of Object.values(this.mats)) mm.dispose();
    this.items.clear();
  }
}
