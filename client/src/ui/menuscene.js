/**
 * The animated main-menu backdrop: a dark room, a table, the Lament
 * Configuration turning slowly under a candle, and chains that move when you
 * are not looking at them.
 */

import * as THREE from 'three';
import { buildBoxMesh } from '../gameplay/lament.js';
import { chainStrand } from '../world/props.js';

export class MenuScene {
  constructor(engine, textures) {
    this.engine = engine;
    this.tex = textures;
    this.root = new THREE.Group();
    this.time = 0;
    this.build();
    engine.scene.add(this.root);
  }

  build() {
    const stone = this.tex.material('stone', { repeat: 0.4, normalScale: 1.5 });
    const wood = this.tex.material('wood', { repeat: 0.9 });
    const iron = this.tex.material('rust', { repeat: 0.8, metalness: 0.85 });

    // ---- room shell ----
    const room = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 16), stone);
    room.material = stone.clone();
    room.material.side = THREE.BackSide;
    room.position.y = 4;
    room.receiveShadow = true;
    this.root.add(room);

    // ---- table ----
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), wood);
    top.position.y = 0.94;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);
    for (const [x, z] of [[-1.05, -0.55], [1.05, -0.55], [-1.05, 0.55], [1.05, 0.55]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.94, 0.12), wood);
      leg.position.set(x, 0.47, z);
      leg.castShadow = true;
      table.add(leg);
    }
    table.position.set(0, 0, 0);
    this.root.add(table);

    // ---- the box ----
    const built = buildBoxMesh(0.42);
    this.box = built.group;
    this.boxParts = built;
    this.box.position.set(0, 1.28, 0);
    this.root.add(this.box);

    // ---- candle ----
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 }));
    candle.position.set(0.82, 1.17, 0.34);
    candle.castShadow = true;
    this.root.add(candle);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshBasicMaterial({ color: 0xffca70 }));
    flame.position.set(0.82, 1.4, 0.34);
    this.root.add(flame);
    this.flame = flame;

    this.candleLight = new THREE.PointLight(0xffb060, 26, 12, 1.7);
    this.candleLight.position.set(0.82, 1.45, 0.34);
    this.candleLight.castShadow = this.engine.quality.shadows;
    if (this.candleLight.shadow) {
      this.candleLight.shadow.mapSize.set(1024, 1024);
      this.candleLight.shadow.bias = -0.005;
    }
    this.root.add(this.candleLight);

    // ---- the box's own glow ----
    this.boxLight = new THREE.PointLight(0x9a3cff, 10, 7, 1.8);
    this.boxLight.position.set(0, 1.35, 0);
    this.root.add(this.boxLight);

    // ---- chains hanging in the dark ----
    const chainGeo = chainStrand(20, 0.19, 0.08, 0.024);
    const chainMat = iron.clone();
    this.chainInst = new THREE.InstancedMesh(chainGeo, chainMat, 26);
    const dummy = new THREE.Object3D();
    this.chainPhases = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.2 + Math.random() * 4.2;
      dummy.position.set(Math.cos(a) * r, 7.6, Math.sin(a) * r);
      dummy.rotation.set(0, Math.random() * 6.28, 0);
      dummy.scale.setScalar(0.7 + Math.random() * 0.8);
      dummy.updateMatrix();
      this.chainInst.setMatrixAt(i, dummy.matrix);
      this.chainPhases.push({ a, r, phase: Math.random() * 6.28, scale: dummy.scale.x });
    }
    this.chainInst.instanceMatrix.needsUpdate = true;
    this.chainInst.castShadow = true;
    this.root.add(this.chainInst);
    this._dummy = dummy;

    // ---- ambience ----
    this.ambient = new THREE.AmbientLight(0x2a2632, 9);
    this.root.add(this.ambient);
    this.fill = new THREE.PointLight(0x3a4a6a, 14, 22, 1.4);
    this.fill.position.set(-4, 5, -4);
    this.root.add(this.fill);
  }

  activate() {
    this.root.visible = true;
    this.engine.scene.fog = new THREE.FogExp2(0x0a0810, 0.055);
    this.engine.scene.background = new THREE.Color(0x05040a);
  }

  deactivate() {
    this.root.visible = false;
  }

  update(dt, elapsed) {
    if (!this.root.visible) return;
    this.time += dt;
    const t = this.time;

    // slow orbit around the table
    const cam = this.engine.camera;
    const a = t * 0.075;
    const r = 3.5 + Math.sin(t * 0.13) * 0.35;
    cam.position.set(Math.cos(a) * r, 1.72 + Math.sin(t * 0.21) * 0.14, Math.sin(a) * r);
    cam.lookAt(0, 1.24, 0);

    // the box turns, and occasionally a segment clicks over on its own
    this.box.rotation.y += dt * 0.22;
    for (let i = 0; i < this.boxParts.segments.length; i++) {
      const s = this.boxParts.segments[i];
      s.rotation.y += dt * (0.05 + i * 0.035) * (i % 2 ? -1 : 1);
    }
    const pulse = 0.35 + Math.sin(t * 0.9) * 0.2 + Math.sin(t * 2.7) * 0.06;
    this.boxParts.glowMat.opacity = Math.max(0, pulse * 0.35);
    this.boxLight.intensity = 6 + pulse * 12;

    // candle flicker
    const f = 1 + Math.sin(t * 13.7) * 0.16 + Math.sin(t * 31.3) * 0.08 + (Math.random() - 0.5) * 0.12;
    this.candleLight.intensity = 24 * f;
    this.flame.scale.set(0.85 + f * 0.2, 1.1 + f * 0.35, 0.85 + f * 0.2);
    this.flame.position.x = 0.82 + Math.sin(t * 7.3) * 0.006;

    // chains sway, and one of them shifts sharply now and then
    const dummy = this._dummy;
    for (let i = 0; i < this.chainPhases.length; i++) {
      const c = this.chainPhases[i];
      const sway = Math.sin(t * 0.6 + c.phase) * 0.05;
      dummy.position.set(Math.cos(c.a) * c.r, 7.6, Math.sin(c.a) * c.r);
      dummy.rotation.set(sway, c.phase + t * 0.02, Math.cos(t * 0.47 + c.phase) * 0.04);
      dummy.scale.setScalar(c.scale);
      dummy.updateMatrix();
      this.chainInst.setMatrixAt(i, dummy.matrix);
    }
    this.chainInst.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.engine.scene.remove(this.root);
  }
}
