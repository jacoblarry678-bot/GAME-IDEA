/**
 * Third-person soldier: procedurally modelled operator with a hierarchical
 * rig animated in code (locomotion cycle, crouch, slide, aim pitch, recoil,
 * reload dip, death fall). Hitboxes are defined in Combatant and do not
 * depend on this visual model.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildWeapon } from '../fx/weaponModels.js';
import { buildKey } from '../data/attachments.js';
import { WEAPONS } from '../data/weapons.js';

const geo = new Map();
function rb(w, h, d, r = 0.02) {
  const k = `${w},${h},${d},${r}`;
  if (!geo.has(k)) geo.set(k, new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.1, h / 2.1, d / 2.1)));
  return geo.get(k);
}
function sphere(r, ws = 12, hs = 8, phiLen = Math.PI * 2, thetaLen = Math.PI) {
  const k = `s${r},${ws},${hs},${thetaLen}`;
  if (!geo.has(k)) geo.set(k, new THREE.SphereGeometry(r, ws, hs, 0, phiLen, 0, thetaLen));
  return geo.get(k);
}

function cap(r, len) {
  const k = `cap${r},${len}`;
  if (!geo.has(k)) geo.set(k, new THREE.CapsuleGeometry(r, len, 2, 8));
  return geo.get(k);
}

const SKIN = [0xc79a7c, 0x8d5f45, 0xe0b49a, 0x5e3d2b, 0xb08060];

export class SoldierMaterials {
  constructor(lib) {
    this.lib = lib;
    this.camo = [lib.camo(0), lib.camo(1)];
    this.vest = [lib.fabric('vest0', [58, 66, 60]), lib.fabric('vest1', [92, 80, 62])];
    this.gear = lib.fabric('gear', [40, 42, 40]);
    this.boot = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.85 });
    this.glove = new THREE.MeshStandardMaterial({ color: 0x232321, roughness: 0.8 });
    this.helmet = [new THREE.MeshStandardMaterial({ color: 0x4a5444, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.7 })];
    this.skin = SKIN.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
    this.goggle = new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.1, metalness: 0.7 });
    this.team = [new THREE.MeshStandardMaterial({ color: 0x3d9bff, emissive: 0x3d9bff, emissiveIntensity: 0.35, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xff7a2f, emissive: 0xff7a2f, emissiveIntensity: 0.35, roughness: 0.6 })];
  }
  /** colors: [friendlyHex, enemyHex]; player team is always "friendly". */
  setTeamColors(friendly, enemy, playerTeam = 0) {
    const f = new THREE.Color(friendly), e = new THREE.Color(enemy);
    const a = playerTeam === 0 ? f : e, b = playerTeam === 0 ? e : f;
    this.team[0].color.copy(a); this.team[0].emissive.copy(a);
    this.team[1].color.copy(b); this.team[1].emissive.copy(b);
  }
}

/** Training-target look: grey mannequin with high-visibility orange vest. */
export function dummyMaterials(base) {
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.8 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x401800, roughness: 0.6 });
  return {
    camo: [grey, grey], vest: [orange, orange], gear: dark, boot: dark, glove: dark,
    helmet: [dark, dark], skin: [grey], goggle: dark, team: [orange, orange],
  };
}

/** Material set for an equipped outfit (team ID materials stay shared for readability). */
export function outfitMaterials(lib, base, outfitItem, opItem) {
  const o = outfitItem.outfit;
  const camo = lib.camoPalette(outfitItem.id, o.palette, !!o.stripes);
  const vest = lib.fabric('vest_' + outfitItem.id, o.vest);
  const helmet = new THREE.MeshStandardMaterial({ color: o.helmet, roughness: 0.7 });
  const glove = new THREE.MeshStandardMaterial({ color: o.glove, roughness: 0.8 });
  const glow = o.glow ? new THREE.MeshStandardMaterial({ color: o.glow, emissive: o.glow, emissiveIntensity: 1.4, roughness: 0.5 }) : null;
  return {
    camo: [camo, camo], vest: [vest, vest], gear: base.gear, boot: base.boot, glove, helmet: [helmet, helmet],
    skin: [base.skin[opItem?.op.skin ?? 0]], goggle: base.goggle, team: base.team, glow,
    headgear: opItem?.op.headgear || 'helmet',
  };
}

export class SoldierModel {
  constructor(mats, wmats, team, seed = 0, opts = {}) {
    this.unarmed = !!opts.unarmed;
    this.mats = mats; this.wmats = wmats; this.team = team;
    const root = this.root = new THREE.Group();
    const camo = mats.camo[team], vest = mats.vest[team];
    const bones = this.bones = [];
    const B = (parent) => { const b = new THREE.Bone(); parent.add(b); bones.push(b); return b; };
    const parts = [];
    const P = (geom, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(x, y, z);
      parent.add(m);
      parts.push(m);
      return m;
    };
    this.rootBone = B(root);
    // hips
    const hips = this.hips = B(this.rootBone);
    hips.position.y = 0.95;
    P(rb(0.34, 0.16, 0.22, 0.04), camo, 0, 0, 0, hips);
    P(rb(0.36, 0.05, 0.24, 0.02), mats.gear, 0, 0.07, 0, hips); // belt
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const thigh = B(hips);
      thigh.position.set(s * 0.1, -0.04, 0);
      P(cap(0.085, 0.3), camo, 0, -0.22, 0, thigh);
      P(rb(0.06, 0.12, 0.14, 0.02), mats.gear, s * 0.08, -0.2, 0, thigh); // thigh pouch
      const shin = B(thigh);
      shin.position.set(0, -0.44, 0);
      P(cap(0.07, 0.3), camo, 0, -0.2, 0, shin);
      P(rb(0.14, 0.12, 0.08, 0.03), mats.gear, 0, -0.02, -0.06, shin); // knee pad
      P(rb(0.13, 0.1, 0.27, 0.035), mats.boot, 0, -0.43, -0.05, shin);
      this.legs.push({ thigh, shin, side: s });
    }
    // spine / torso
    const spine = this.spine = B(hips);
    spine.position.y = 0.06;
    P(rb(0.38, 0.5, 0.24, 0.06), camo, 0, 0.27, 0, spine);
    // plate carrier + pouches
    P(rb(0.4, 0.36, 0.3, 0.04), vest, 0, 0.3, 0, spine);
    for (const x of [-0.12, 0, 0.12]) P(rb(0.09, 0.11, 0.06, 0.015), mats.gear, x, 0.22, -0.17, spine);
    P(rb(0.3, 0.3, 0.12, 0.03), mats.gear, 0, 0.32, 0.19, spine); // backpack
    P(rb(0.08, 0.2, 0.05, 0.02), mats.gear, -0.12, 0.42, 0.25, spine); // radio
    // team ID: shoulder bands and back panel (readability; same for all cosmetics)
    this.teamMat = mats.team[team];
    for (const s of [-1, 1]) P(rb(0.13, 0.05, 0.15, 0.015), this.teamMat, s * 0.25, 0.4, 0, spine);
    P(rb(0.18, 0.06, 0.02, 0.01), this.teamMat, 0, 0.47, 0.255, spine);
    // neck + head
    const neck = this.neck = B(spine);
    neck.position.y = 0.55;
    const skin = mats.skin[seed % mats.skin.length];
    P(rb(0.1, 0.08, 0.1, 0.03), skin, 0, 0.02, 0, neck);
    const head = this.head = B(neck);
    head.position.y = 0.14;
    P(rb(0.19, 0.22, 0.21, 0.08), skin, 0, 0, 0, head);
    const hg = mats.headgear || (seed % 3 === 2 ? 'helmet' : 'helmet');
    if (hg === 'cap') {
      P(sphere(0.118, 14, 8, Math.PI * 2, Math.PI * 0.5), mats.helmet[team], 0, 0.04, 0.0, head);
      P(rb(0.14, 0.015, 0.1, 0.006), mats.helmet[team], 0, 0.045, -0.13, head);
    } else if (hg === 'beanie') {
      const bn = P(sphere(0.12, 14, 8, Math.PI * 2, Math.PI * 0.6), mats.helmet[team], 0, 0.03, 0.0, head);
      bn.scale.set(1, 1.15, 1.05);
    } else {
      const helm = P(sphere(0.135, 16, 10, Math.PI * 2, Math.PI * 0.55), mats.helmet[team], 0, 0.035, 0.01, head);
      helm.scale.set(1, 0.95, 1.08);
      P(rb(0.26, 0.03, 0.29, 0.01), mats.helmet[team], 0, 0.035, 0.01, head);
    }
    if (!mats.headgear && seed % 3 === 0) P(rb(0.17, 0.05, 0.04, 0.015), mats.goggle, 0, 0.06, -0.12, head); // goggles on helmet
    if ((!mats.headgear && seed % 3 === 1) || hg === 'balaclava') P(rb(0.19, 0.08, 0.04, 0.02), mats.gear, 0, -0.05, -0.1, head); // face mask
    if (mats.glow) { P(rb(0.02, 0.26, 0.02, 0.008), mats.glow, -0.12, 0.3, -0.16, spine); P(rb(0.02, 0.26, 0.02, 0.008), mats.glow, 0.12, 0.3, -0.16, spine); }
    P(rb(0.06, 0.05, 0.04, 0.01), this.teamMat, 0, 0.1, 0.1, head); // helmet strobe/ID
    // arms holding weapon: shoulder pivots
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = B(spine);
      sh.position.set(s * 0.24, 0.46, 0);
      const upper = P(cap(0.058, 0.2), camo, 0, -0.14, 0, sh);
      const elbow = B(sh);
      elbow.position.set(0, -0.28, 0);
      P(cap(0.052, 0.18), camo, 0, -0.13, 0, elbow);
      P(rb(0.09, 0.1, 0.1, 0.03), mats.glove, 0, -0.29, 0, elbow);
      this.arms.push({ sh, elbow, upper, side: s });
    }
    // weapon mount (chest height, right side) — regular child of the spine bone
    this.gunMount = new THREE.Group();
    this.gunMount.position.set(0.1, 0.36, -0.22);
    spine.add(this.gunMount);
    this._skin(parts);
    this.weaponId = null;
    // animation state
    this.phase = Math.random() * 10;
    this.deathT = -1;
    this.deathDir = 1;
    this.recoil = 0;
    this.reloadDip = 0;
    this.visible = true;
  }

  /**
   * Collapse all rigid parts into one SkinnedMesh per material: each vertex is
   * bound 100% to its part's bone, so the rig animates exactly as before but
   * a soldier costs ~9 draw calls instead of ~45.
   */
  _skin(parts) {
    this.root.updateMatrixWorld(true);
    const byMat = new Map();
    for (const m of parts) {
      const bi = this.bones.indexOf(m.parent);
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(g);
      m.parent.remove(m);
    }
    this.skeleton = new THREE.Skeleton(this.bones);
    this.meshes = [];
    for (const [mat, geoms] of byMat) {
      const geom = mergeGeometries(geoms, false);
      for (const g of geoms) g.dispose();
      const sm = new THREE.SkinnedMesh(geom, mat);
      sm.castShadow = true;
      sm.receiveShadow = true;
      this.root.add(sm);
      sm.bind(this.skeleton, new THREE.Matrix4());
      sm.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5);
      this.meshes.push(sm);
    }
  }

  setWeapon(id, wmats = this.wmats, attachments = null) {
    const bk = buildKey(attachments);
    if (this.unarmed || (this.weaponId === id && this._wmats === wmats && this._bk === bk)) return;
    this.weaponId = id;
    this._wmats = wmats;
    this._bk = bk;
    if (this.gun) { this.gunMount.remove(this.gun.group); }
    const key = WEAPONS[id].model;
    this.gun = buildWeapon(key, wmats, { merge: true, attachments });
    this.gunMount.add(this.gun.group);
    this.isPistol = key === 'pistol';
  }

  /** Pose the arms so the hands meet the weapon grip and foregrip. */
  poseArms(aimPitch) {
    const [L, R] = this.arms;
    if (this.unarmed) {
      R.sh.rotation.set(0.05, 0, -0.12); R.elbow.rotation.set(0.15, 0, 0);
      L.sh.rotation.set(0.05, 0, 0.12); L.elbow.rotation.set(0.15, 0, 0);
      return;
    }
    // Euler XYZ: +X swings a hanging limb forward; +Z moves it toward +X.
    R.sh.rotation.set(0.35 + aimPitch * 0.8, 0, -0.35);
    R.elbow.rotation.set(1.45, 0, 0);
    if (this.isPistol) {
      L.sh.rotation.set(1.05 + aimPitch * 0.8, 0, 0.55);
      L.elbow.rotation.set(0.7, 0, 0);
    } else {
      L.sh.rotation.set(1.25 + aimPitch * 0.8, 0, 0.5);
      L.elbow.rotation.set(0.35, 0, 0);
    }
  }

  /**
   * Update pose from simulation state.
   * s: { speed, sprinting, stance, grounded, pitch, adsT, reloading, alive, dt, firing }
   */
  update(s, dt) {
    if (!s.alive) {
      if (this.deathT < 0) { this.deathT = 0; this.deathDir = Math.random() < 0.5 ? 1 : -1; this.deathSide = (Math.random() - 0.5) * 0.8; }
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.55);
      const e = k * k;
      this.root.rotation.x = -this.deathDir * e * 1.45;
      this.root.rotation.z = this.deathSide * e;
      this.hips.position.y = 0.95 - e * 0.55;
      for (const l of this.legs) { l.thigh.rotation.x = e * 0.6 * l.side; l.shin.rotation.x = -e * 0.8; }
      for (const a of this.arms) { a.sh.rotation.x = 0.5 + e * 1.2; a.sh.rotation.z = a.side * e * 0.9; }
      this.spine.rotation.x = 0.2 * e;
      return;
    }
    if (this.deathT >= 0) { this.deathT = -1; this.root.rotation.set(0, this.root.rotation.y, 0); }
    const crouch = s.stance === 'crouch', slide = s.stance === 'slide';
    const spd = Math.min(s.speed, 8);
    // movement direction relative to facing: turn the hips toward strafes, reverse the cycle when backpedalling
    let dir = 1, hipYaw = 0;
    if (spd > 0.6 && s.vx !== undefined) {
      const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
      const fwd = (-sy * s.vx - cy * s.vz) / spd, right = (cy * s.vx - sy * s.vz) / spd;
      const rel = Math.atan2(right, fwd);
      if (Math.abs(rel) > 1.9) { dir = -1; hipYaw = -Math.sign(rel) * (Math.PI - Math.abs(rel)) * 0.6; }
      else hipYaw = -Math.max(-1.0, Math.min(1.0, rel)) * 0.75;
    }
    this.hipYaw = (this.hipYaw || 0) + (hipYaw - (this.hipYaw || 0)) * Math.min(1, dt * 10);
    this.hips.rotation.y = this.hipYaw;
    this.phase += dir * dt * (spd * (s.sprinting ? 1.25 : 1.6) + 0.0001);
    const amp = Math.min(1, spd / 5) * (s.sprinting ? 0.85 : 0.55) * (crouch ? 0.6 : 1);
    const sw = Math.sin(this.phase), cw = Math.cos(this.phase);
    const hipY = slide ? 0.45 : crouch ? 0.62 : 0.95;
    this.hips.position.y += (hipY + (s.grounded ? Math.abs(cw) * amp * 0.05 : 0) - this.hips.position.y) * Math.min(1, dt * 14);
    // legs (+X rotation swings the leg forward; knees bend with -X)
    const [l0, l1] = this.legs;
    if (slide) {
      l0.thigh.rotation.x = 1.3; l0.shin.rotation.x = -0.3;
      l1.thigh.rotation.x = 0.6; l1.shin.rotation.x = -1.6;
    } else if (!s.grounded) {
      l0.thigh.rotation.x = 0.5; l0.shin.rotation.x = -0.9;
      l1.thigh.rotation.x = -0.2; l1.shin.rotation.x = -0.5;
    } else {
      const base = crouch ? 1.0 : 0;
      const knee = crouch ? -1.7 : 0;
      l0.thigh.rotation.x = base + sw * amp;
      l1.thigh.rotation.x = base - sw * amp;
      l0.shin.rotation.x = knee - Math.max(0, -cw) * amp * 1.4;
      l1.shin.rotation.x = knee - Math.max(0, cw) * amp * 1.4;
    }
    // torso lean & aim
    const lean = s.sprinting ? -0.22 : slide ? 0.35 : crouch ? -0.15 : -0.04;
    this.spine.rotation.x += (lean - this.spine.rotation.x) * Math.min(1, dt * 10);
    this.flinch = Math.max(0, (this.flinch || 0) - dt * 5);
    this.spine.rotation.y = Math.sin(this.phase) * amp * 0.12 - this.hipYaw + (this.flinchSide || 0) * this.flinch * 0.25;
    this.spine.rotation.x -= this.flinch * 0.12;
    const aim = Math.max(-1.0, Math.min(1.0, s.pitch));
    this.neck.rotation.x = aim * 0.5;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.reloadDip += ((s.reloading ? 1 : 0) - this.reloadDip) * Math.min(1, dt * 8);
    if (s.sprinting && !this.unarmed) {
      // weapon held across the chest
      this.gunMount.rotation.set(-0.5, 0.9, 0.3);
      this.gunMount.position.set(0.04, 0.3, -0.18);
      this.arms[1].sh.rotation.set(0.3 + sw * 0.4, 0, -0.2);
      this.arms[1].elbow.rotation.set(1.4, 0, 0);
      this.arms[0].sh.rotation.set(0.8 - sw * 0.4, 0, 0.5);
      this.arms[0].elbow.rotation.set(1.0, 0, 0);
    } else {
      this.gunMount.rotation.set(aim * 0.85 + this.recoil * 0.12 - this.reloadDip * 0.6, 0, this.reloadDip * 0.4);
      this.gunMount.position.set(this.isPistol ? 0.02 : 0.1, 0.36 + aim * 0.06, -0.22 - (s.adsT || 0) * 0.04 + this.recoil * 0.03);
      this.poseArms(aim);
    }
  }

  fired() { this.recoil = 1; }

  /** Upper-body flinch when hit. */
  hit(side) { this.flinch = 1; this.flinchSide = side; }

  /** Distance LOD: drop shadows and the weapon detail when far away. */
  setLod(far) {
    if (this._far === far) return;
    this._far = far;
    for (const m of this.meshes) m.castShadow = !far;
    if (this.gun) this.gun.group.visible = !far || this.unarmed;
  }

  /** World position of the third-person muzzle. */
  muzzleWorld(out) {
    if (!this.gun?.markers.muzzle) return out.copy(this.root.position).setY(this.root.position.y + 1.4);
    return this.gun.markers.muzzle.getWorldPosition(out);
  }
}
