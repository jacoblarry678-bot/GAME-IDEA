/**
 * Visual effects: chains in flight, traps, gateways, wards, blood, apparitions
 * and the horror-event set dressing. Everything is pooled — nothing allocates
 * geometry during a match.
 */

import * as THREE from 'three';
import { FLOOR_Y } from '../../../shared/mapdata.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Reusable pool of identical meshes. */
class Pool {
  constructor(factory, size) {
    this.items = [];
    this.factory = factory;
    for (let i = 0; i < size; i++) {
      const o = factory();
      o.visible = false;
      this.items.push({ obj: o, alive: false, t: 0, life: 0, data: null });
    }
  }
  take() {
    for (const it of this.items) {
      if (!it.alive) {
        it.alive = true;
        it.t = 0;
        it.obj.visible = true;
        return it;
      }
    }
    // steal the oldest rather than allocate
    let oldest = this.items[0];
    for (const it of this.items) if (it.t > oldest.t) oldest = it;
    oldest.t = 0;
    return oldest;
  }
  release(it) {
    it.alive = false;
    it.obj.visible = false;
  }
  forEach(fn) {
    for (const it of this.items) if (it.alive) fn(it);
  }
}

export class Effects {
  constructor(engine, textures, quality) {
    this.engine = engine;
    this.tex = textures;
    this.quality = quality;
    this.root = new THREE.Group();
    engine.scene.add(this.root);
    this.time = 0;

    this.chainMat = new THREE.MeshStandardMaterial({
      color: 0x9a9088, metalness: 0.9, roughness: 0.42,
      emissive: 0x2a0a06, emissiveIntensity: 0.7,
    });
    this.bloodMat = new THREE.MeshBasicMaterial({
      color: 0x8e0d0d, transparent: true, opacity: 0.95, depthWrite: false,
    });

    this.buildPools();
    this.buildOverlays();
  }

  buildPools() {
    // --- flying chains: a segmented tube stretched from origin to tip ---
    const linkGeo = new THREE.TorusGeometry(0.1, 0.03, 4, 7);
    this.chains = new Pool(() => {
      const g = new THREE.Group();
      const inst = new THREE.InstancedMesh(linkGeo, this.chainMat, 40);
      inst.frustumCulled = false;
      g.add(inst);
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xb8aa9c, metalness: 0.95, roughness: 0.3, emissive: 0x400d06, emissiveIntensity: 1.2 })
      );
      g.add(head);
      const light = new THREE.PointLight(0xff4a1a, 0, 9);
      g.add(light);
      g.userData = { inst, head, light };
      this.root.add(g);
      return g;
    }, 8);

    // --- traps ---
    const trapRing = new THREE.TorusGeometry(1.2, 0.07, 5, 20);
    this.traps = new Pool(() => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(trapRing, this.chainMat.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.07;
      g.add(ring);
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 4), this.chainMat);
        const a = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9);
        spike.rotation.x = Math.PI;
        g.add(spike);
      }
      const light = new THREE.PointLight(0xff2a10, 0, 7);
      light.position.y = 0.5;
      g.add(light);
      g.userData = { ring, light };
      this.root.add(g);
      return g;
    }, 10);

    // --- gateways ---
    this.gateways = new Pool(() => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8b2fd6, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
      });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), mat);
      disc.position.y = 1.5;
      g.add(disc);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.55, 0.09, 6, 26),
        new THREE.MeshStandardMaterial({ color: 0x3a1252, emissive: 0x7d2fd6, emissiveIntensity: 2.4, roughness: 0.4 })
      );
      ring.position.y = 1.5;
      g.add(ring);
      const light = new THREE.PointLight(0x8b2fd6, 0, 16);
      light.position.y = 1.5;
      g.add(light);
      g.userData = { disc, ring, light, mat };
      this.root.add(g);
      return g;
    }, 4);

    // --- wards (chalk circles) ---
    this.wards = new Pool(() => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd8d0b8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
      });
      const m = new THREE.Mesh(new THREE.RingGeometry(6.4, 7, 40), mat);
      m.rotation.x = -Math.PI / 2;
      m.userData = { mat };
      this.root.add(m);
      return m;
    }, 3);

    // --- blood splatter (billboarded quads that fall and stick) ---
    const count = Math.floor(140 * this.quality.particles) || 40;
    const bloodGeo = new THREE.PlaneGeometry(0.16, 0.16);
    this.bloodInst = new THREE.InstancedMesh(bloodGeo, this.bloodMat, count);
    this.bloodInst.frustumCulled = false;
    this.bloodInst.count = count;
    this.root.add(this.bloodInst);
    this.bloodParticles = [];
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < count; i++) {
      this.bloodInst.setMatrixAt(i, dummy.matrix);
      this.bloodParticles.push({ alive: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 1 });
    }
    this.bloodCursor = 0;
    this._dummy = new THREE.Object3D();

    // --- apparitions: a translucent standing figure ---
    this.apparitions = new Pool(() => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9aa8c0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 3, 8), mat);
      body.position.y = 1.0;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
      head.position.y = 1.78;
      g.add(head);
      g.userData = { mat };
      this.root.add(g);
      return g;
    }, 4);

    // --- steam / dust puffs ---
    this.puffs = new Pool(() => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb8b0a4, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat);
      m.userData = { mat };
      this.root.add(m);
      return m;
    }, 12);
  }

  buildOverlays() {
    // full-screen blood on the lens when badly hurt
    this.damageEl = document.querySelector('.hud-damage');
  }

  // ------------------------------------------------------------- spawners

  spawnChain(data) {
    const it = this.chains.take();
    it.life = 2.2;
    it.data = { ...data, ox: data.ox, oy: data.oy, oz: data.oz };
    it.obj.userData.light.intensity = 12;
    this.updateChainMesh(it, data.x, data.y, data.z);
    return it;
  }

  updateChain(eid, x, y, z) {
    this.chains.forEach((it) => {
      if (it.data && it.data.eid === eid) {
        it.t = 0;
        this.updateChainMesh(it, x, y, z);
      }
    });
  }

  updateChainMesh(it, tx, ty, tz) {
    const d = it.data;
    const inst = it.obj.userData.inst;
    const ox = d.ox;
    const oy = d.oy;
    const oz = d.oz;
    const dx = tx - ox;
    const dy = ty - oy;
    const dz = tz - oz;
    const len = Math.hypot(dx, dy, dz) || 0.001;
    const links = Math.min(40, Math.max(2, Math.floor(len / 0.19)));
    const dummy = this._dummy;
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    for (let i = 0; i < links; i++) {
      const f = i / links;
      dummy.position.set(ox + dx * f, oy + dy * f, oz + dz * f);
      dummy.quaternion.copy(quat);
      dummy.rotateY(i % 2 ? Math.PI / 2 : 0);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.count = links;
    inst.instanceMatrix.needsUpdate = true;
    const head = it.obj.userData.head;
    head.position.set(tx, ty, tz);
    head.quaternion.copy(quat);
    head.rotateX(Math.PI);
    it.obj.userData.light.position.set(tx, ty, tz);
  }

  endChain(eid) {
    this.chains.forEach((it) => {
      if (it.data && it.data.eid === eid) it.life = Math.min(it.life, 0.25);
    });
  }

  spawnTrap(data) {
    const it = this.traps.take();
    it.life = 9999;
    it.data = data;
    it.obj.position.set(data.x, data.y + 0.02, data.z);
    it.obj.userData.light.intensity = 3;
    return it;
  }

  removeTrap(eid) {
    this.traps.forEach((it) => {
      if (it.data && it.data.eid === eid) this.traps.release(it);
    });
  }

  syncTraps(list, myFloor, iAmCenobite) {
    const seen = new Set(list.map((t) => t.e));
    this.traps.forEach((it) => {
      if (!it.data || !seen.has(it.data.eid)) this.traps.release(it);
    });
    for (const t of list) {
      // survivors only see an armed trap once they are very close
      let existing = null;
      this.traps.forEach((it) => {
        if (it.data && it.data.eid === t.e) existing = it;
      });
      if (!existing) existing = this.spawnTrap({ eid: t.e, x: t.x, y: t.y, z: t.z, floor: t.f });
      existing.data.floor = t.f;
      existing.obj.visible = t.f === myFloor;
      existing.obj.userData.ring.material.opacity = iAmCenobite ? 1 : 0.25;
      existing.obj.userData.light.intensity = iAmCenobite ? 4 : 1.2;
    }
  }

  syncGateways(list, myFloor) {
    const seen = new Set(list.map((g) => g.e));
    this.gateways.forEach((it) => {
      if (!it.data || !seen.has(it.data.eid)) this.gateways.release(it);
    });
    for (const g of list) {
      let a = null;
      let b = null;
      this.gateways.forEach((it) => {
        if (it.data && it.data.eid === g.e && it.data.end === 'a') a = it;
        if (it.data && it.data.eid === g.e && it.data.end === 'b') b = it;
      });
      if (!a) {
        a = this.gateways.take();
        a.data = { eid: g.e, end: 'a' };
        a.life = 9999;
      }
      if (!b) {
        b = this.gateways.take();
        b.data = { eid: g.e, end: 'b' };
        b.life = 9999;
      }
      a.obj.position.set(g.ax, g.ay, g.az);
      b.obj.position.set(g.bx, g.by, g.bz);
      a.obj.visible = g.af === myFloor;
      b.obj.visible = g.bf === myFloor;
      a.obj.userData.light.intensity = 14;
      b.obj.userData.light.intensity = 14;
    }
  }

  syncWards(list, myFloor) {
    const seen = new Set(list.map((w) => w.e));
    this.wards.forEach((it) => {
      if (!it.data || !seen.has(it.data.eid)) this.wards.release(it);
    });
    for (const w of list) {
      let found = null;
      this.wards.forEach((it) => {
        if (it.data && it.data.eid === w.e) found = it;
      });
      if (!found) {
        found = this.wards.take();
        found.data = { eid: w.e };
        found.life = 9999;
      }
      found.obj.position.set(w.x, w.y + 0.03, w.z);
      found.obj.scale.setScalar(w.r / 7);
      found.obj.visible = w.f === myFloor;
    }
  }

  /** Blood spray at a hit point. */
  spawnBlood(x, y, z, amount = 14, dir = null) {
    const n = Math.floor(amount * Math.min(2, this.quality.particles + 0.3));
    for (let i = 0; i < n; i++) {
      const p = this.bloodParticles[this.bloodCursor];
      this.bloodCursor = (this.bloodCursor + 1) % this.bloodParticles.length;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + (Math.random() - 0.5) * 0.3;
      p.z = z + (Math.random() - 0.5) * 0.3;
      const spread = 2.6;
      p.vx = (Math.random() - 0.5) * spread + (dir ? dir.x * 2 : 0);
      p.vy = Math.random() * 3.0 + 0.6;
      p.vz = (Math.random() - 0.5) * spread + (dir ? dir.z * 2 : 0);
      p.life = 1.4 + Math.random() * 2.2;
      p.maxLife = p.life;
      p.size = 0.5 + Math.random() * 1.3;
      p.stuck = false;
      p.groundY = null;
    }
  }

  spawnApparition(x, y, z, facing = 0) {
    const it = this.apparitions.take();
    it.life = 3.4;
    it.data = { fade: 0 };
    it.obj.position.set(x, y, z);
    it.obj.rotation.y = facing;
    it.obj.userData.mat.opacity = 0;
    return it;
  }

  spawnPuff(x, y, z, scale = 1, color = 0xb8b0a4) {
    const it = this.puffs.take();
    it.life = 1.8;
    it.obj.position.set(x, y, z);
    it.obj.scale.setScalar(0.2 * scale);
    it.obj.userData.mat.color.setHex(color);
    it.obj.userData.mat.opacity = 0.5;
    it.data = { scale };
    return it;
  }

  /** Big set-piece for a horror event. */
  horror(type, x, y, z, camera) {
    switch (type) {
      case 'apparition':
      case 'silhouette': {
        const a = Math.random() * Math.PI * 2;
        this.spawnApparition(x + Math.cos(a) * 4, y, z + Math.sin(a) * 4, a + Math.PI);
        break;
      }
      case 'blood_walls':
        for (let i = 0; i < 26; i++) {
          this.spawnBlood(x + (Math.random() - 0.5) * 6, y + 2.6 + Math.random() * 1.5, z + (Math.random() - 0.5) * 6, 1);
        }
        break;
      case 'chains_stir':
      case 'corridor_shift':
        for (let i = 0; i < 6; i++) {
          this.spawnPuff(x + (Math.random() - 0.5) * 7, y + 0.5, z + (Math.random() - 0.5) * 7, 1.6, 0x6a6258);
        }
        break;
      default:
        this.spawnPuff(x, y + 0.6, z, 2, 0x88808a);
    }
  }

  // -------------------------------------------------------------- update

  update(dt, camera) {
    this.time += dt;

    // chains
    this.chains.forEach((it) => {
      it.t += dt;
      it.life -= dt;
      const l = it.obj.userData.light;
      l.intensity = Math.max(0, l.intensity - dt * 22);
      if (it.life <= 0) this.chains.release(it);
    });

    // traps pulse
    this.traps.forEach((it) => {
      it.t += dt;
      it.obj.userData.ring.rotation.z += dt * 0.6;
      it.obj.userData.light.intensity = 2 + Math.sin(this.time * 3 + it.t) * 1.2;
    });

    // gateways spin and pulse
    this.gateways.forEach((it) => {
      it.t += dt;
      const ud = it.obj.userData;
      ud.ring.rotation.z += dt * 1.3;
      ud.disc.scale.setScalar(1 + Math.sin(this.time * 4 + it.t) * 0.07);
      ud.mat.opacity = 0.7 + Math.sin(this.time * 6) * 0.15;
      if (camera) ud.disc.lookAt(camera.position);
    });

    // wards fade near the end of their life
    this.wards.forEach((it) => {
      it.t += dt;
      it.obj.rotation.z += dt * 0.2;
      it.obj.userData.mat.opacity = 0.4 + Math.sin(this.time * 2.4) * 0.14;
    });

    // apparitions: fade in, drift, vanish
    this.apparitions.forEach((it) => {
      it.t += dt;
      it.life -= dt;
      const mat = it.obj.userData.mat;
      const p = 1 - Math.abs((it.t / 3.4) * 2 - 1);
      mat.opacity = Math.max(0, p * 0.42);
      it.obj.position.y += dt * 0.12;
      if (camera) {
        const dx = camera.position.x - it.obj.position.x;
        const dz = camera.position.z - it.obj.position.z;
        it.obj.rotation.y = Math.atan2(dx, dz);
      }
      if (it.life <= 0) this.apparitions.release(it);
    });

    // puffs
    this.puffs.forEach((it) => {
      it.t += dt;
      it.life -= dt;
      it.obj.scale.addScalar(dt * 1.6 * (it.data ? it.data.scale : 1));
      it.obj.position.y += dt * 0.55;
      it.obj.userData.mat.opacity = Math.max(0, 0.5 * (it.life / 1.8));
      if (it.life <= 0) this.puffs.release(it);
    });

    this.updateBlood(dt, camera);
  }

  updateBlood(dt, camera) {
    const dummy = this._dummy;
    let any = false;
    for (let i = 0; i < this.bloodParticles.length; i++) {
      const p = this.bloodParticles[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        dummy.scale.setScalar(0);
        dummy.position.set(0, -999, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.bloodInst.setMatrixAt(i, dummy.matrix);
        continue;
      }
      if (!p.stuck) {
        p.vy -= 16 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.groundY === null) p.groundY = this.groundGuess(p.y);
        if (p.y <= p.groundY + 0.02) {
          p.y = p.groundY + 0.02;
          p.stuck = true;
        }
      }
      dummy.position.set(p.x, p.y, p.z);
      if (p.stuck) {
        dummy.rotation.set(-Math.PI / 2, 0, i * 1.7);
        dummy.scale.setScalar(p.size * Math.min(1, p.life));
      } else {
        if (camera) dummy.lookAt(camera.position);
        else dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.size * 0.6, p.size * 1.5, p.size * 0.6);
      }
      dummy.updateMatrix();
      this.bloodInst.setMatrixAt(i, dummy.matrix);
    }
    if (any) this.bloodInst.instanceMatrix.needsUpdate = true;
  }

  /** Snap blood to whichever floor plane it is falling toward. */
  groundGuess(y) {
    let best = FLOOR_Y[0];
    for (const fy of FLOOR_Y) if (fy <= y + 0.4 && fy > best) best = fy;
    return best;
  }

  clearBlood() {
    const dummy = this._dummy;
    dummy.scale.setScalar(0);
    dummy.position.set(0, -999, 0);
    dummy.updateMatrix();
    for (let i = 0; i < this.bloodParticles.length; i++) {
      this.bloodParticles[i].alive = false;
      this.bloodInst.setMatrixAt(i, dummy.matrix);
    }
    this.bloodInst.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.engine.scene.remove(this.root);
  }
}
