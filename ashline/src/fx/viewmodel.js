/**
 * First-person viewmodel: arms + weapon rendered in an overlay scene.
 * All animation is procedural: hip/ADS blend (sights aligned to screen
 * center), sprint pose, bob, sway, spring recoil, reload / tube reload,
 * bolt & pump cycling, swap, melee, grenade throw, muzzle flash, casings.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildWeapon, buildGrenade } from './weaponModels.js';
import { WEAPONS } from '../data/weapons.js';
import { spriteTexture } from '../world/textures.js';

const POSES = {
  ar: { hip: [0.15, -0.165, -0.4], eye: 0.17, rotY: -0.03 },
  smg: { hip: [0.145, -0.16, -0.38], eye: 0.24, rotY: -0.03 },
  shotgun: { hip: [0.15, -0.17, -0.38], eye: 0.3, rotY: -0.03 },
  sniper: { hip: [0.15, -0.18, -0.4], eye: 0.1, rotY: -0.03 },
  pistol: { hip: [0.13, -0.15, -0.42], eye: 0.34, rotY: -0.05 },
};

const Z = new THREE.Vector3(0, 0, 1);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function bump(p, a, b, c, d) {
  // 0 before a, ramps to 1 by b, holds until c, ramps to 0 by d
  if (p <= a || p >= d) return 0;
  if (p < b) return smooth((p - a) / (b - a));
  if (p <= c) return 1;
  return 1 - smooth((p - c) / (d - c));
}

class Spring {
  constructor(k = 260, damp = 0.75) { this.k = k; this.c = 2 * Math.sqrt(k) * damp; this.x = 0; this.v = 0; }
  update(dt, target = 0) {
    const a = -this.k * (this.x - target) - this.c * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
}

export class Viewmodel {
  constructor(engine, lib, wmats, settings) {
    this.engine = engine;
    this.settings = settings;
    this.wmats = wmats;
    this.root = new THREE.Group();
    engine.vmScene.add(this.root);
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.models = new Map();
    this.cur = null;
    this.curId = null;
    // arms: capsule sleeves, cuffs and articulated gloves
    const sleeve = lib.camo(0).clone();
    sleeve.color = new THREE.Color(0.62, 0.64, 0.6);
    const glove = new THREE.MeshStandardMaterial({ color: 0x2b2b28, roughness: 0.78 });
    const knuckle = new THREE.MeshStandardMaterial({ color: 0x1b1b1a, roughness: 0.6 });
    const cuff = lib.fabric('cuff', [46, 50, 46]);
    const unit = new THREE.CapsuleGeometry(0.04, 1, 4, 10);
    unit.rotateX(Math.PI / 2);
    this.unitLen = 1;
    const finger = new THREE.CapsuleGeometry(0.0085, 0.03, 3, 6);
    const fingerS = new THREE.CapsuleGeometry(0.0082, 0.022, 3, 6);
    const palmG = new RoundedBoxGeometry(0.03, 0.08, 0.075, 2, 0.012);
    this.arms = {};
    for (const side of ['R', 'L']) {
      const fore = new THREE.Mesh(unit, sleeve);
      const upper = new THREE.Mesh(unit, sleeve);
      upper.scale.set(1.2, 1.2, 1);
      const hand = new THREE.Group();
      const s = side === 'R' ? 1 : -1;
      // palm on the outside of the grip; fingers wrap around the front, thumb over the top
      const palm = new THREE.Mesh(palmG, glove);
      palm.position.set(0.026 * s, -0.02, 0.035);
      hand.add(palm);
      for (let i = 0; i < 4; i++) {
        const f1 = new THREE.Mesh(finger, glove);
        f1.rotation.z = Math.PI / 2;
        f1.position.set(0.006 * s, -0.004 - i * 0.019, -0.004);
        hand.add(f1);
        const f2 = new THREE.Mesh(fingerS, glove);
        f2.position.set(-0.016 * s, -0.004 - i * 0.019, 0.012);
        f2.rotation.x = Math.PI / 2;
        hand.add(f2);
        const k = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), knuckle);
        k.position.set(0.03 * s, -0.004 - i * 0.019, 0.0);
        hand.add(k);
      }
      const thumb = new THREE.Mesh(finger, glove);
      thumb.position.set(-0.016 * s, 0.028, 0.03);
      thumb.rotation.x = Math.PI / 2 - 0.3;
      hand.add(thumb);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.045, 0.05, 12), cuff);
      band.rotation.x = Math.PI / 2;
      band.position.set(0.02 * s, -0.035, 0.1);
      hand.add(band);
      this.root.add(fore, upper, hand);
      this.arms[side] = { fore, upper, hand, palm };
    }
    // grenade in hand
    this.handGrenade = { frag: buildGrenade('frag', wmats), smoke: buildGrenade('smoke', wmats) };
    for (const g of Object.values(this.handGrenade)) { g.visible = false; this.root.add(g); }
    // muzzle flash
    const flashTex = spriteTexture('flash');
    const fm = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), fm);
      if (i === 1) p.rotation.y = Math.PI / 2;
      if (i === 2) { p.rotation.x = Math.PI / 2; p.scale.set(0.6, 1.8, 1); }
      this.flash.add(p);
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), fm);
    front.rotation.y = 0; this.flash.add(front);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.flashT = 0;
    // casings
    const caseG = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6);
    caseG.rotateZ(Math.PI / 2);
    this.casings = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(caseG, wmats.brass);
      m.visible = false;
      this.root.add(m);
      this.casings.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
    }
    this.caseIdx = 0;
    // animation state
    this.recoilZ = new Spring(320, 0.7);
    this.recoilP = new Spring(260, 0.65);
    this.recoilR = new Spring(220, 0.6);
    this.landS = new Spring(180, 0.6);
    this.swayX = 0; this.swayY = 0;
    this.bobPhase = 0; this.bobAmt = 0;
    this.sprintK = 0; this.crouchK = 0;
    this.lastShot = -9; this.cycleStart = -9;
    this.time = 0;
    this._visible = true;
  }

  get visible() { return this._visible; }
  set visible(v) { this._visible = v; this.root.visible = v; }

  setWeapon(id) {
    if (this.curId === id) return;
    if (this.cur) this.cur.group.visible = false;
    let m = this.models.get(id);
    if (!m) {
      const def = WEAPONS[id];
      m = buildWeapon(def.model, this.wmats);
      m.def = def;
      m.pose = POSES[def.model] || POSES.ar;
      for (const k of Object.keys(m.parts)) m.parts[k].userData.base = m.parts[k].position.clone();
      this.pivot.add(m.group);
      this.models.set(id, m);
    }
    m.group.visible = true;
    this.cur = m;
    this.curId = id;
  }

  onFire(def) {
    const ads = this.adsK || 0;
    const kick = def.recoil.kick * (1 - ads * 0.45);
    this.recoilZ.v += 0.9 * kick;
    this.recoilP.v += 2.2 * kick * (0.8 + Math.random() * 0.4);
    this.recoilR.v += (Math.random() - 0.5) * 3 * kick;
    this.flashT = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = (def.class === 'shotgun' ? 1.6 : def.class === 'sniper' ? 1.5 : def.class === 'smg' ? 0.8 : 1) * (0.8 + Math.random() * 0.4);
    this.flash.scale.setScalar(s * (this.settings.data.accessibility.reducedFlash ? 0.45 : 1));
    this.lastShot = this.time;
    if (def.bolt || def.pump) this.cycleStart = this.time + (def.pump ? 0.12 : 0.18);
    if (!def.pump && !def.bolt) this.ejectCasing();
  }

  ejectCasing() {
    const m = this.cur?.markers.eject;
    if (!m) return;
    const c = this.casings[this.caseIdx++ % this.casings.length];
    m.getWorldPosition(c.m.position);
    this.root.worldToLocal(c.m.position);
    c.v.set(1.1 + Math.random() * 0.5, 0.7 + Math.random() * 0.4, -0.15 - Math.random() * 0.2);
    c.w.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    c.life = 0.7;
    c.m.visible = true;
  }

  /**
   * s: snapshot of the local combatant + inputs:
   * { adsT, sprinting, stance, speed, grounded, weapon(state), swapT, swapDur, meleeT, throwT, throwKind, mantle, mouseDX, mouseDY, landed }
   */
  update(dt, s) {
    this.time += dt;
    const set = this.settings.data;
    const motion = set.accessibility.reducedMotion ? 0 : 1;
    const bobScale = set.graphics.headBob * motion;
    const m = this.cur;
    if (!m) return;
    const def = m.def, pose = m.pose, w = s.weapon;

    // ---- base pose (hip → ADS) ----
    const ads = smooth(s.adsT);
    this.adsK = ads;
    const sight = m.markers.sight.position;
    const adsX = -sight.x, adsY = -sight.y, adsZ = -pose.eye - sight.z;
    let px = pose.hip[0] + (adsX - pose.hip[0]) * ads;
    let py = pose.hip[1] + (adsY - pose.hip[1]) * ads;
    let pz = pose.hip[2] + (adsZ - pose.hip[2]) * ads;
    let rx = 0, ry = pose.rotY * (1 - ads), rz = 0;

    // ---- sprint / crouch ----
    this.sprintK += ((s.sprinting ? 1 : 0) - this.sprintK) * Math.min(1, dt * 9);
    const sk = smooth(this.sprintK);
    px += 0.03 * sk; py += -0.05 * sk; pz += 0.03 * sk;
    rx += -0.22 * sk; ry += 0.75 * sk; rz += 0.3 * sk;
    this.crouchK += ((s.stance !== 'stand' ? 1 : 0) - this.crouchK) * Math.min(1, dt * 8);
    rz += 0.04 * this.crouchK * (1 - ads);

    // ---- bob ----
    const moving = s.grounded ? Math.min(1, s.speed / 5) : 0;
    this.bobAmt += (moving - this.bobAmt) * Math.min(1, dt * 8);
    this.bobPhase += dt * s.speed * (s.sprinting ? 1.35 : 1.65);
    const ba = this.bobAmt * bobScale * (1 - ads * 0.85) * (s.sprinting ? 2.0 : 1);
    px += Math.sin(this.bobPhase) * 0.008 * ba;
    py += -Math.abs(Math.cos(this.bobPhase)) * 0.009 * ba;
    rz += Math.sin(this.bobPhase) * 0.02 * ba;
    // idle breathing
    py += Math.sin(this.time * 1.6) * 0.0012 * motion * (1 - ads * 0.7);

    // ---- sway (weapon lags behind mouse) ----
    const swayK = 0.00055 * motion * (1 - ads * 0.6);
    this.swayX += (Math.max(-0.08, Math.min(0.08, -s.mouseDX * swayK)) - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (Math.max(-0.06, Math.min(0.06, s.mouseDY * swayK)) - this.swayY) * Math.min(1, dt * 10);
    ry += this.swayX; rx += this.swayY; px += this.swayX * 0.1;

    // ---- landing / jumping ----
    if (s.landed) this.landS.v -= Math.min(2.5, s.landed * 0.25);
    const land = this.landS.update(dt);
    py += land * 0.03 * motion; rx += land * 0.05 * motion;
    if (!s.grounded && !s.mantle) { py -= 0.01 * motion; rx += 0.03 * motion; }
    if (s.mantle) { py -= 0.08; rx -= 0.25; rz += 0.2; }

    // ---- recoil springs ----
    const rzk = this.recoilZ.update(dt), rpk = this.recoilP.update(dt), rrk = this.recoilR.update(dt);
    pz += rzk * 0.045; rx += rpk * 0.035; rz += rrk * 0.02; py += rpk * 0.004;

    // ---- reload ----
    let leftTarget = null; // override for left hand (vmRoot space)
    const parts = m.parts;
    if (parts.mag) { parts.mag.position.copy(parts.mag.userData.base); parts.mag.visible = true; }
    if (parts.pump) parts.pump.position.copy(parts.pump.userData.base);
    if (parts.bolt) { parts.bolt.position.copy(parts.bolt.userData.base); parts.bolt.rotation.set(0, 0, 0); }
    if (parts.slide) { parts.slide.position.copy(parts.slide.userData.base); }
    if (w.reloading) {
      if (def.tube) {
        const k = 1;
        rz += -0.35 * k; rx += 0.18 * k; py += -0.02 * k; px += -0.02;
        const osc = (Math.sin(this.time * Math.PI * 2 / def.tube.perShell) + 1) / 2;
        const port = tmpV.set(0, 0.0 - 0.06 * osc, -0.06).applyMatrix4(m.group.matrix).applyMatrix4(this.pivot.matrix);
        leftTarget = port.clone();
      } else {
        const p = w.reloadProgress;
        const tilt = bump(p, 0, 0.14, 0.84, 1);
        rz += -0.5 * tilt; rx += 0.2 * tilt; py += -0.035 * tilt; px += -0.015 * tilt;
        if (parts.mag) {
          const out = bump(p, 0.12, 0.32, 0.36, 0.37);
          const inn = p >= 0.36 && p < 0.62 ? 1 - smooth((p - 0.36) / 0.26) : 0;
          const off = p < 0.36 ? out : inn;
          parts.mag.position.y = parts.mag.userData.base.y - off * 0.28;
          parts.mag.visible = !(p > 0.3 && p < 0.4);
          // left hand follows the magazine
          if (p > 0.18 && p < 0.7) {
            const hp = tmpV.copy(parts.mag.position).add(tmpV2.set(0, -0.05, 0));
            hp.applyMatrix4(m.group.matrix).applyMatrix4(this.pivot.matrix);
            leftTarget = hp.clone();
          }
        }
        if (w.mag === 0 && p > 0.7 && p < 0.9) {
          const ch = bump(p, 0.7, 0.76, 0.82, 0.9);
          pz += 0.012 * ch; rx += 0.05 * ch;
          if (parts.bolt) parts.bolt.position.z += 0.06 * ch;
          if (parts.slide) parts.slide.position.z += 0.03 * ch;
        }
      }
    }
    // pistol slide lock & blowback
    if (parts.slide) {
      const sinceShot = this.time - this.lastShot;
      if (sinceShot < 0.08) parts.slide.position.z += 0.03 * (1 - sinceShot / 0.08);
      if (w.mag === 0 && !w.reloading) parts.slide.position.z += 0.028;
    }
    // bolt / pump cycling after a shot
    const cyc = this.time - this.cycleStart;
    if (cyc > 0 && cyc < 0.6 && !w.reloading) {
      const k = bump(cyc, 0, 0.12, 0.3, 0.5);
      if (parts.pump) {
        parts.pump.position.z += 0.085 * k;
        rx += 0.04 * k; pz += 0.01 * k;
      }
      if (parts.bolt && (1 - ads) > 0.05) {
        parts.bolt.rotation.z = 1.1 * bump(cyc, 0, 0.08, 0.42, 0.5);
        parts.bolt.position.z += 0.07 * bump(cyc, 0.08, 0.2, 0.3, 0.42);
        rz += -0.12 * k; rx += 0.05 * k;
        if (k > 0.1 && this.time - this._boltEject > 0.5) { /* casing handled once */ }
      }
      if (cyc > 0.25 && cyc < 0.3 && this._lastEjectCycle !== this.cycleStart) { this._lastEjectCycle = this.cycleStart; this.ejectCasing(); }
    }

    // ---- swap ----
    if (s.swapT > 0 && s.swapDur > 0) {
      const k = 1 - Math.abs((s.swapT - s.swapDur / 2) / (s.swapDur / 2));
      const e = smooth(k);
      py -= 0.22 * e; rx -= 0.9 * e; rz += 0.2 * e;
    }

    // ---- melee ----
    let meleeK = 0;
    if (s.meleeT > 0) {
      const p = 1 - s.meleeT / 0.42;
      meleeK = bump(p, 0, 0.3, 0.55, 1);
      px -= 0.08 * meleeK; rz += 0.6 * meleeK; ry += 0.5 * meleeK; py -= 0.05 * meleeK;
      const punch = bump(p, 0.15, 0.45, 0.55, 0.9);
      leftTarget = tmpV.set(-0.02 + 0.04 * punch, -0.07 + 0.02 * punch, -0.18 - 0.32 * punch).clone();
    }

    // ---- equipment throw ----
    for (const g of Object.values(this.handGrenade)) g.visible = false;
    if (s.throwT > 0) {
      const p = 1 - s.throwT / 0.5;
      const lower = bump(p, 0, 0.2, 0.75, 1);
      py -= 0.18 * lower; rx -= 0.5 * lower;
      const back = bump(p, 0, 0.3, 0.55, 0.62);
      const fwd = bump(p, 0.55, 0.7, 0.75, 1);
      leftTarget = new THREE.Vector3(-0.17 + 0.12 * fwd, -0.12 + 0.12 * back + 0.06 * fwd, -0.25 + 0.12 * back - 0.25 * fwd);
      if (p < 0.66) {
        const g = this.handGrenade[s.throwKind] || this.handGrenade.frag;
        g.visible = true;
        g.position.copy(leftTarget).add(tmpV2.set(0.0, 0.05, -0.03));
      }
    }

    // ---- apply ----
    this.pivot.position.set(px, py, pz);
    this.pivot.rotation.set(rx, ry, rz, 'YXZ');
    this.pivot.updateMatrix();
    m.group.updateMatrix();
    this.root.updateMatrixWorld(true);

    // arms: right hand at grip, left hand at foregrip (or override)
    const rHand = tmpV.set(0, 0.0, 0.02).applyMatrix4(this.pivot.matrix).clone();
    const lHandDefault = m.markers.leftHand.position.clone().applyMatrix4(m.group.matrix).applyMatrix4(this.pivot.matrix);
    let lHand = lHandDefault;
    if (leftTarget) {
      const k = s.throwT > 0 || s.meleeT > 0 ? 1 : 1;
      lHand = lHandDefault.lerp(leftTarget, k);
    }
    const handRot = new THREE.Euler(rx, ry, rz, 'YXZ');
    this.placeArm(this.arms.R, rHand, new THREE.Vector3(0.26, -0.36, 0.02), new THREE.Vector3(0.38, -0.72, 0.4), handRot, 1);
    this.placeArm(this.arms.L, lHand, new THREE.Vector3(-0.1 + px * 0.3, -0.38, -0.12), new THREE.Vector3(-0.36, -0.75, 0.35), handRot, -1);

    // muzzle flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      m.markers.muzzle.getWorldPosition(this.flash.position);
      this.root.worldToLocal(this.flash.position);
      this.flash.rotation.y = ry; this.flash.rotation.x = rx;
      this.flash.visible = true;
      this.engine.vmFill.position.copy(this.flash.position);
      this.engine.vmFill.intensity = (this.settings.data.accessibility.reducedFlash ? 0.6 : 2.0);
    } else {
      this.flash.visible = false;
      this.engine.vmFill.intensity = 0;
    }
    // casings
    for (const c of this.casings) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.v.y -= 6 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
      if (c.life <= 0) c.m.visible = false;
    }
    this.root.visible = this._visible;
  }

  placeArm(arm, hand, elbow, shoulder, handRot, side) {
    arm.hand.position.copy(hand);
    arm.hand.rotation.copy(handRot);
    if (side < 0) arm.hand.rotation.z += 0.4;
    limb(arm.fore, tmpV.copy(hand).add(tmpV2.set(0.02 * side, -0.035, 0.11)), elbow);
    limb(arm.upper, elbow, shoulder);
  }
}

function limb(mesh, a, b) {
  const dir = tmpV2.copy(b).sub(a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.z = len;
  tmpQ.setFromUnitVectors(Z, dir.normalize());
  mesh.quaternion.copy(tmpQ);
}
