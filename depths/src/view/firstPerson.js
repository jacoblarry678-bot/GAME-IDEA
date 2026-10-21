/**
 * First-person camera and viewmodel: visible hands holding the equipped
 * tool (flashlight, instant camera, radio or the selected supply), with
 * head bob, sway, lean roll, damage shake, idle tremor at low composure and
 * the camera's raise/shutter/eject animation. Every motion effect scales
 * with its comfort setting.
 */
import * as THREE from 'three';
import { mat } from './materials.js';
import { itemMesh } from './levelView.js';
import { CHARACTERS } from '../data/characters.js';

function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m); o.position.set(x, y, z); return o; }

export class FirstPerson {
  constructor(engine, settings) {
    this.engine = engine;
    this.settings = settings;
    this.root = new THREE.Group();
    engine.vmScene.add(this.root);
    this.bobT = 0; this.bobAmt = 0;
    this.sway = new THREE.Vector2();
    this.shake = 0;
    this.raise = 0; // camera viewfinder raise 0..1
    this.shutterT = 0;
    this.tool = null;
    this.slot = 'evan';
    this.useT = 0;
    this.leanRoll = 0;
    this.lastYaw = 0; this.lastPitch = 0;
    this.photoCard = null;
    this._build();
  }

  _build() {
    const C = CHARACTERS[this.slot] || CHARACTERS.evan;
    this.sleeve = new THREE.MeshStandardMaterial({ color: C.color, roughness: 0.85 });
    this.glove = new THREE.MeshStandardMaterial({ color: 0x4a3c32, roughness: 0.85 });
    this.cuff = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
    const hand = (side) => {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.34, 10).rotateX(Math.PI / 2), this.sleeve, 0, -0.01, 0.2));
      g.add(mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.03, 10).rotateX(Math.PI / 2), this.cuff, 0, -0.01, 0.035));
      g.add(mesh(new THREE.CapsuleGeometry(0.032, 0.05, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.75, 1.2), this.glove, 0, 0, -0.015));
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CapsuleGeometry(0.008, 0.045, 3, 6).rotateX(Math.PI / 2 - 0.5), this.glove, -0.027 + i * 0.018, -0.022, -0.065));
      g.add(mesh(new THREE.CapsuleGeometry(0.009, 0.04, 3, 6).rotateZ(side * 0.9), this.glove, side * 0.038, -0.004, -0.03));
      return g;
    };
    this.right = hand(1); this.left = hand(-1);
    this.root.add(this.right, this.left);
    // tools
    this.tools = {
      flashlight: (() => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12).rotateX(Math.PI / 2), 'darkMetal', 0, 0, -0.05)); g.add(mesh(new THREE.CylinderGeometry(0.034, 0.024, 0.06, 12).rotateX(Math.PI / 2), 'darkMetal', 0, 0, -0.17)); this.lens = mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0xfff6dc }), 0, 0, -0.201); this.lens.rotation.y = Math.PI; g.add(this.lens); return g; })(),
      camera: (() => {
        const g = new THREE.Group();
        this.shell = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.55 }); // the cosmetic camera finish
        g.add(mesh(new THREE.BoxGeometry(0.2, 0.13, 0.11), this.shell, 0, 0, 0));
        g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.11), 'darkMetal', 0, 0.075, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.05, 16).rotateX(Math.PI / 2), 'black', 0.02, -0.005, -0.075));
        g.add(mesh(new THREE.BoxGeometry(0.035, 0.025, 0.02), 'glass', -0.06, 0.04, -0.06));
        this.flashLed = mesh(new THREE.BoxGeometry(0.012, 0.012, 0.01), 'ledGreen', 0.08, 0.06, -0.056);
        g.add(this.flashLed);
        this.slotPhoto = mesh(new THREE.BoxGeometry(0.11, 0.003, 0.09), 'paper', 0, -0.07, 0);
        this.slotPhoto.visible = false;
        g.add(this.slotPhoto);
        return g;
      })(),
      radio: (() => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.07, 0.15, 0.04), 'black', 0, 0, 0)); g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), 'black', -0.02, 0.13, 0)); this.radioLed = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.005), 'ledGreen', 0.022, 0.06, 0.021); g.add(this.radioLed); g.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.005), 'screenGreen', 0, 0.035, 0.021)); return g; })(),
    };
    for (const t of Object.values(this.tools)) { t.visible = false; this.root.add(t); }
    this.supply = new THREE.Group(); this.root.add(this.supply); this.supplyItem = null;
  }

  /** Cosmetic camera finish (shell colour only; never affects visibility to creatures). */
  setFinish(color) { if (this.shell) this.shell.color.setHex(color); }

  setCharacter(slot) {
    if (slot === this.slot) return;
    this.slot = slot;
    const C = CHARACTERS[slot] || CHARACTERS.evan;
    this.sleeve.color.setHex(C.color);
  }

  /** Called every frame with the local player's state. */
  update(dt, game, p, cam, opts = {}) {
    const A = this.settings.data.accessibility;
    // ---- camera pose
    const e = p.eye();
    const bobScale = A.cameraBob;
    const moving = p.moving && p.grounded && !p.hidden;
    this.bobAmt += ((moving ? 1 : 0) - this.bobAmt) * Math.min(1, dt * 6);
    this.bobT += dt * (p.sprinting ? 11 : p.crouched ? 5.5 : 7.5) * (moving ? 1 : 0.3);
    const bobY = Math.sin(this.bobT * 2) * 0.03 * this.bobAmt * bobScale * (p.sprinting ? 1.6 : 1);
    const bobX = Math.cos(this.bobT) * 0.02 * this.bobAmt * bobScale;
    const lean = p.lean;
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const rightV = { x: c, z: -s };
    // lean offset, stopped by walls
    let lo = lean * 0.38;
    if (Math.abs(lo) > 0.01) {
      const hit = game.level.world.raycast(e.x, e.y, e.z, rightV.x * Math.sign(lo), 0, rightV.z * Math.sign(lo), Math.abs(lo) + 0.2, 'solid', 1);
      if (hit) lo = Math.sign(lo) * Math.max(0, hit.t - 0.2);
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * A.headShake;
    const shx = (Math.random() - 0.5) * sh * 0.05, shy = (Math.random() - 0.5) * sh * 0.05;
    cam.position.set(e.x + rightV.x * (lo + bobX) + shx, e.y + bobY + shy, e.z + rightV.z * (lo + bobX));
    this.leanRoll += (-lean * 0.14 - this.leanRoll) * Math.min(1, dt * 9);
    cam.rotation.set(p.pitch + shy * 0.5, p.yaw, this.leanRoll * Math.min(1, A.headShake + 0.4));
    // ---- viewmodel
    const tool = p.hidden ? null : p.tool;
    const showSupply = tool === 'supply';
    for (const [k, t] of Object.entries(this.tools)) t.visible = (k === tool) || (k === 'flashlight' && tool !== 'flashlight' && false);
    const st = p.pouch[p.selected];
    if (showSupply && st && st.item !== this.supplyItem) { this.supply.clear(); this.supply.add(itemMesh(st.item)); this.supplyItem = st.item; this.supply.scale.setScalar(1.4); }
    this.supply.visible = showSupply && !!st;
    const dyaw = angleDiff(p.yaw, this.lastYaw), dpitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    this.sway.x += (-dyaw * 0.6 - this.sway.x) * Math.min(1, dt * 8);
    this.sway.y += (dpitch * 0.6 - this.sway.y) * Math.min(1, dt * 8);
    const wantRaise = tool === 'camera' && (opts.inspect || this.shutterT > 0) ? 1 : 0;
    this.raise += (wantRaise - this.raise) * Math.min(1, dt * 10);
    const tremor = A.handTremor && A.stressEffects && p.composure < 20 ? 0.004 : 0.0008;
    const tx = Math.sin(game.time * 13) * tremor, ty = Math.cos(game.time * 11) * tremor;
    const bx = bobX * 0.5, by = bobY * 0.6;
    const base = new THREE.Vector3(0.24 + this.sway.x * 0.05 + bx + tx, -0.24 + this.sway.y * 0.05 + by + ty, -0.46);
    this.root.position.set(0, 0, 0);
    // right hand
    this.right.visible = this.left.visible = !p.hidden && !p.downed;
    this.useT = p.action && p.action.kind === 'item' ? p.action.t / p.action.dur : 0;
    if (tool === 'camera') {
      const r = this.raise;
      const pos = base.clone().lerp(new THREE.Vector3(0.0, -0.06, -0.24), r);
      this.tools.camera.position.copy(pos);
      this.tools.camera.rotation.set(0, 0, 0);
      if (this.shutterT > 0) { this.shutterT -= dt; this.tools.camera.position.z += Math.sin(this.shutterT * 20) * 0.004; }
      this.right.position.copy(pos).add(new THREE.Vector3(0.1, -0.04, 0.05));
      this.left.position.copy(pos).add(new THREE.Vector3(-0.1, -0.04, 0.05));
      this.left.visible = this.right.visible;
      this.flashLed.material = mat(p.cameraFlash ? (game.time >= p.flashReadyAt ? 'ledGreen' : 'ledRed') : 'ledOff');
      this.slotPhoto.visible = game.time < p.developUntil;
      if (this.slotPhoto.visible) this.slotPhoto.position.y = -0.07 - Math.min(1, (p.developUntil - game.time) / 4) * 0.0 - (1 - Math.min(1, (p.developUntil - game.time) / 4)) * 0.05;
    } else {
      this.right.position.copy(base);
      this.left.position.set(-0.26 + bx, -0.3 + by, -0.44);
      this.left.visible = this.right.visible && (showSupply && this.useT > 0);
      const held = tool === 'flashlight' ? this.tools.flashlight : tool === 'radio' ? this.tools.radio : this.supply;
      if (held) {
        held.position.copy(base).add(new THREE.Vector3(0, 0.03, -0.06));
        held.rotation.set(tool === 'radio' ? 0.25 : 0, tool === 'radio' ? -0.5 : 0, tool === 'radio' ? -0.15 : 0);
        if (tool === 'radio') held.position.add(new THREE.Vector3(0.02, -0.03, 0.02));
        if (this.useT > 0) { held.position.y += Math.sin(this.useT * Math.PI) * 0.06; held.position.x -= this.useT * 0.1; }
      }
      if (tool === 'flashlight') this.lens.material.color.setHex(p.flashOn && p.charge > 0 ? 0xfff6dc : 0x333333);
      if (tool === 'radio') this.radioLed.material = mat(game.story.current && game.story.current.src === 'radio' ? 'ledGreen' : 'ledOff');
    }
    if (p.action && p.action.kind === 'item' && (p.action.item === 'battery' || p.action.item === 'film')) {
      const k = Math.sin(this.useT * Math.PI);
      this.root.position.y = -0.08 * k;
    }
    // engine vm camera follows only roll for consistency
    this.engine.vmCamera.rotation.set(0, 0, 0);
  }

  hit(strength = 1) { this.shake = Math.min(1.2, this.shake + strength); }
  shutter() { this.shutterT = 0.35; }
}

function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
