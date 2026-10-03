/**
 * World visuals for deployables and support abilities: Bulwark shields,
 * Supply Drop crates (falling with a beacon) and Area Strike warning zones.
 * Synced every frame from match.deployables by id.
 */
import * as THREE from 'three';
import { SUPPORT } from '../data/support.js';

export class DeployablesView {
  constructor(scene, match, playerTeam, colors) {
    this.scene = scene;
    this.match = match;
    this.playerTeam = playerTeam;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.views = new Map();
    this.t = 0;
    this.setColors(colors);
    this.mats = {
      plate: new THREE.MeshStandardMaterial({ color: 0x5c6468, metalness: 0.75, roughness: 0.42 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x2a2e30, metalness: 0.6, roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fc4d4, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.45 }),
      crate: new THREE.MeshStandardMaterial({ color: 0x4d5a3c, roughness: 0.8, metalness: 0.15 }),
      strap: new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.7 }),
      chute: new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.9, side: THREE.DoubleSide }),
    };
  }

  setColors([friendly, enemy]) {
    this.friendly = new THREE.Color(friendly);
    this.enemy = new THREE.Color(enemy);
  }

  teamColor(team) { return team === this.playerTeam ? this.friendly : this.enemy; }

  makeShield(s) {
    const g = new THREE.Group();
    const w = s.w, h = s.h, d = s.d;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.92, d * 0.6), this.mats.plate);
    plate.position.y = h * 0.46 + 0.04; plate.castShadow = true; plate.receiveShadow = true;
    g.add(plate);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d), this.mats.frame);
    rim.position.y = h - 0.03; g.add(rim);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), this.mats.frame);
      leg.position.set(sx * (w / 2 - 0.12), 0.04, 0.15); g.add(leg);
    }
    const slit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.07, d * 0.62), this.mats.glass);
    slit.position.y = h * 0.8; g.add(slit);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, d * 0.64), new THREE.MeshBasicMaterial({ color: this.teamColor(s.team), toneMapped: false }));
    stripe.position.y = h * 0.12; g.add(stripe);
    g.position.set(s.x, s.y, s.z);
    if (s.alongX) g.rotation.y = Math.PI / 2;
    // face away from the owner: legs toward the owner's side
    const fx = Math.sign(s.x - s.owner.x), fz = Math.sign(s.z - s.owner.z);
    if (s.alongX ? fx < 0 : fz > 0) g.rotation.y += Math.PI;
    g.scale.y = 0.05;
    return { g, kind: 'shield', s, born: this.t };
  }

  makeDrop(d) {
    const g = new THREE.Group();
    const crate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), this.mats.crate);
    box.position.y = 0.3; box.castShadow = true; crate.add(box);
    for (const z of [-0.25, 0.25]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.06), this.mats.strap);
      st.position.set(0, 0.3, z); crate.add(st);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: this.teamColor(d.team), toneMapped: false }));
    lamp.position.y = 0.66; crate.add(lamp);
    g.add(crate);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), this.mats.chute);
    chute.position.y = 3.2; g.add(chute);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 30, 6, 1, true), new THREE.MeshBasicMaterial({ color: this.teamColor(d.team), transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    beam.position.y = 15; beam.userData.noAO = true; g.add(beam);
    g.position.set(d.x, d.y, d.z);
    return { g, kind: 'drop', d, crate, chute, lamp, beam };
  }

  makeStrike(s) {
    const g = new THREE.Group();
    const R = SUPPORT.strike.spread + 1;
    const col = this.teamColor(s.team);
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R, 48), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.userData.noAO = true;
    g.add(ring);
    const fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R - 0.25, 48), fillMat);
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.05; fill.userData.noAO = true;
    g.add(fill);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
    beacon.position.y = 3; g.add(beacon);
    g.position.set(s.x, s.y, s.z);
    return { g, kind: 'strike', s, ringMat, fillMat };
  }

  update(dt) {
    this.t += dt;
    const dep = this.match.deployables;
    const alive = new Set();
    for (const s of dep.shields) {
      const key = 's' + s.id;
      alive.add(key);
      let v = this.views.get(key);
      if (!v) { v = this.makeShield(s); this.views.set(key, v); this.group.add(v.g); }
      v.g.scale.y = Math.min(1, v.g.scale.y + dt * 5); // unfold
      if (s.hitT && this.match.time - s.hitT < 0.08) v.g.position.x = s.x + (Math.random() - 0.5) * 0.02;
      else v.g.position.x = s.x;
    }
    for (const d of dep.drops) {
      const key = 'd' + d.id;
      alive.add(key);
      let v = this.views.get(key);
      if (!v) { v = this.makeDrop(d); this.views.set(key, v); this.group.add(v.g); }
      const fall = Math.max(0, d.fall);
      v.crate.position.y = fall * 9;
      v.chute.position.y = 3.2 + fall * 9;
      v.chute.visible = fall > 0.05;
      v.beam.visible = d.fall <= 0;
      v.lamp.material.color.copy(this.teamColor(d.team)).multiplyScalar(0.6 + 0.4 * Math.abs(Math.sin(this.t * 4)));
    }
    for (const s of dep.strikes) {
      const key = 'k' + s.id;
      alive.add(key);
      let v = this.views.get(key);
      if (!v) { v = this.makeStrike(s); this.views.set(key, v); this.group.add(v.g); }
      const rate = s.t > 0 ? 3 + (SUPPORT.strike.delay - s.t) * 3 : 10;
      v.ringMat.opacity = 0.4 + 0.5 * Math.abs(Math.sin(this.t * rate));
      v.fillMat.opacity = 0.08 + 0.1 * Math.abs(Math.sin(this.t * rate));
    }
    for (const [k, v] of this.views) {
      if (alive.has(k)) continue;
      this.group.remove(v.g);
      v.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      this.views.delete(k);
    }
  }

  dispose() { this.scene.remove(this.group); }
}
