/** Pooled cartoon effects: tracers, particles, muzzle flashes, explosions, confetti. */

import * as THREE from 'three';

const MAX_P = 700;
const R = (v) => Math.round(v * 10);


export class Effects {
  constructor(scene) {
    this.scene = scene;
    // particles: one instanced mesh of little cubes
    this.pGeo = new THREE.BoxGeometry(1, 1, 1);
    this.pMesh = new THREE.InstancedMesh(this.pGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX_P);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    this.pMesh.setColorAt(0, new THREE.Color());
    scene.add(this.pMesh);
    this.parts = [];
    this.free = [];
    for (let i = MAX_P - 1; i >= 0; i--) this.free.push(i);
    this._o = new THREE.Object3D();
    this._c = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_P; i++) this.pMesh.setMatrixAt(i, zero);
    // tracers
    this.tracers = [];
    this.tracerMat = new THREE.MeshBasicMaterial({ color: '#fff6a8', transparent: true, opacity: 0.9, depthWrite: false });
    this.tracerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 4, 1, true);
    this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerGeo.translate(0, 0, 0.5);
    // explosions
    this.booms = [];
    this.boomGeo = new THREE.SphereGeometry(1, 16, 12);
    // flashes
    this.flashTex = flashTexture();
    this.flashes = [];
    this.shake = 0;
  }

  particle(pos, vel, color, size, life, gravity = 12) {
    const idx = this.free.pop();
    if (idx === undefined) return;
    this.parts.push({ idx, pos: pos.clone(), vel, size, life, max: life, gravity, rot: Math.random() * 6 });
    this.pMesh.setColorAt(idx, this._c.set(color));
    this.pMesh.instanceColor.needsUpdate = true;
  }

  burst(pos, color, n = 8, speed = 4, size = 0.12, life = 0.6) {
    this.onFx?.(['bu', R(pos.x), R(pos.y), R(pos.z), color, n, R(speed), Math.round(size * 100), R(life)]);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).multiplyScalar(speed);
      this.particle(pos, v, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6));
    }
  }

  confetti(pos) {
    this.onFx?.(['cf', R(pos.x), R(pos.y), R(pos.z)]);
    const hold = this.onFx;
    this.onFx = null; // the burst below is part of the same moment
    try { this._confetti(pos); } finally { this.onFx = hold; }
  }

  _confetti(pos) {
    const cols = ['#ff5ca8', '#ffd23f', '#39f0ff', '#7ed957', '#b35cff', '#ff7a1a'];
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 6, (Math.random() - 0.5) * 8);
      this.particle(pos, v, cols[i % cols.length], 0.14, 1.4 + Math.random(), 7);
    }
    this.burst(pos, '#ffffff', 14, 3, 0.35, 0.7);
  }

  tracer(from, to, color = '#fff6a8') {
    this.onFx?.(['tr', R(from.x), R(from.y), R(from.z), R(to.x), R(to.y), R(to.z), color]);
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const mat = this.tracerMat.clone();
    mat.color.set(color);
    const m = new THREE.Mesh(this.tracerGeo, mat);
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(1, 1, len);
    this.scene.add(m);
    this.tracers.push({ m, life: 0.07 });
  }

  muzzle(pos) {
    this.onFx?.(['mz', R(pos.x), R(pos.y), R(pos.z)]);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: '#ffe38a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos);
    s.scale.setScalar(0.7 + Math.random() * 0.3);
    this.scene.add(s);
    this.flashes.push({ s, life: 0.05 });
  }

  explosion(pos, radius) {
    this.onFx?.(['ex', R(pos.x), R(pos.y), R(pos.z), radius]);
    const hold = this.onFx;
    this.onFx = null;
    try { this._explosion(pos, radius); } finally { this.onFx = hold; }
  }

  _explosion(pos, radius) {
    const m = new THREE.Mesh(this.boomGeo, new THREE.MeshBasicMaterial({ color: '#ffb23f', transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos);
    this.scene.add(m);
    this.booms.push({ m, life: 0.5, radius });
    this.burst(pos, '#ff7a1a', 26, 9, 0.3, 0.8);
    this.burst(pos, '#555555', 16, 5, 0.5, 1.2);
    this.burst(pos, '#ffe066', 14, 12, 0.18, 0.5);
  }

  update(dt, camPos) {
    const o = this._o;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        o.scale.setScalar(0);
        o.updateMatrix();
        this.pMesh.setMatrixAt(p.idx, o.matrix);
        this.free.push(p.idx);
        this.parts.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += dt * 6;
      o.position.copy(p.pos);
      o.rotation.set(p.rot, p.rot * 0.7, 0);
      o.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 2));
      o.updateMatrix();
      this.pMesh.setMatrixAt(p.idx, o.matrix);
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) {
        this.scene.remove(t.m);
        t.m.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      if ((f.life -= dt) <= 0) {
        this.scene.remove(f.s);
        f.s.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.life -= dt;
      const k = 1 - b.life / 0.5;
      b.m.scale.setScalar(b.radius * (0.3 + k * 0.9));
      b.m.material.opacity = Math.max(0, 0.9 * (1 - k));
      b.m.material.color.setHSL(0.1 - k * 0.08, 1, 0.6 - k * 0.3);
      if (b.life <= 0) {
        this.scene.remove(b.m);
        b.m.material.dispose();
        this.booms.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  clear() {
    for (const t of this.tracers) this.scene.remove(t.m);
    for (const f of this.flashes) this.scene.remove(f.s);
    for (const b of this.booms) this.scene.remove(b.m);
    this.tracers = [];
    this.flashes = [];
    this.booms = [];
    for (const p of this.parts) this.free.push(p.idx);
    this.parts = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_P; i++) this.pMesh.setMatrixAt(i, zero);
    this.pMesh.instanceMatrix.needsUpdate = true;
  }
}

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,220,120,0.9)');
  gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
