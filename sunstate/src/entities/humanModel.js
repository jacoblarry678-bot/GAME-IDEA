/**
 * Procedural human: rounded body parts rigidly skinned to an 18-bone
 * skeleton, so each person is a single SkinnedMesh (one draw call) and every
 * pose is driven by bone rotations from HumanAnimator.
 *
 * Bind pose: standing, facing +z, feet at y = 0.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

/** Appearance presets. All colours are hex. */
export function randomLook(rnd = Math.random, overrides = {}) {
  const skins = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a21, 0xa66a3f, 0xd9a273];
  const hairs = [0x1b1410, 0x2e1f14, 0x4a3020, 0x7a5a3a, 0xb08d57, 0x111111, 0x5b3b2a, 0xd8c08a];
  const tops = [0xf2f2f2, 0x1f3a5f, 0xd94f4f, 0x2f8f6f, 0xf2b5c4, 0x9fd8d0, 0xf7e3a1, 0x333333, 0xe58a3a, 0x6a5acd, 0xffffff, 0x88b04b];
  const bottoms = [0x2e3b55, 0x3c3c3c, 0xd8cfb8, 0x556b2f, 0x1f1f1f, 0x8b7d6b, 0x4a6fa5, 0xc2b280];
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const female = rnd() < 0.5;
  return {
    female,
    height: female ? 1.62 + rnd() * 0.12 : 1.72 + rnd() * 0.14,
    build: 0.9 + rnd() * 0.25,
    skin: pick(skins), hair: pick(hairs), top: pick(tops), bottom: pick(bottoms),
    shoes: pick([0xf4f4f4, 0x222222, 0x6b4a2b, 0x3355aa]),
    hairStyle: female ? pick(['long', 'bun', 'long', 'short']) : pick(['short', 'short', 'buzz', 'bald', 'long']),
    shorts: rnd() < 0.35,
    sleeveless: rnd() < 0.25,
    hat: rnd() < 0.12 ? pick([0xf4f4f4, 0x1f3a5f, 0xd94f4f]) : null,
    beard: !female && rnd() < 0.3,
    ...overrides,
  };
}

function capsule(r, len, sx = 1, sz = 1) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.scale(sx, 1, sz);
  return g;
}

/** Build the body geometry with per-vertex colour and rigid skin weights. */
function buildGeometry(look) {
  const parts = [];
  const add = (geo, bone, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const cols = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      si[i * 4] = BI[bone]; sw[i * 4] = 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  };
  const f = look.female, b = look.build;
  const skin = look.skin, top = look.top, bot = look.bottom;
  const sh = f ? 0.17 : 0.2; // shoulder half-width
  // pelvis and torso
  add(capsule(0.15 * b, 0.06, 1.15, 0.75), 'hips', bot, 0, 0.94, 0, 0, 0, Math.PI / 2);
  add(capsule((f ? 0.14 : 0.155) * b, 0.2, 1.05, 0.68), 'spine', top, 0, 1.12, 0);
  add(capsule((f ? 0.15 : 0.17) * b, 0.12, 1.12, 0.72), 'chest', top, 0, 1.32, 0.0);
  if (f) { add(new THREE.SphereGeometry(0.06, 8, 6), 'chest', top, 0.065, 1.3, 0.085); add(new THREE.SphereGeometry(0.06, 8, 6), 'chest', top, -0.065, 1.3, 0.085); }
  // shoulders (sleeve caps)
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.075 * b, 8, 6), 'chest', look.sleeveless ? skin : top, s * (sh - 0.02), 1.42, 0);
  // neck and head
  add(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 8), 'neck', skin, 0, 1.53, 0);
  add(new THREE.SphereGeometry(0.105, 14, 10).scale(0.92, 1.12, 1.02), 'head', skin, 0, 1.66, 0.005);
  add(new THREE.BoxGeometry(0.03, 0.045, 0.04), 'head', skin, 0, 1.655, 0.11); // nose
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.014, 6, 4), 'head', 0x1a1a1a, s * 0.038, 1.685, 0.094);
    add(new THREE.BoxGeometry(0.04, 0.008, 0.01), 'head', look.hair, s * 0.038, 1.71, 0.1); // brows
    add(new THREE.SphereGeometry(0.022, 6, 4).scale(0.6, 1, 0.8), 'head', skin, s * 0.098, 1.66, 0); // ears
  }
  add(new THREE.BoxGeometry(0.05, 0.008, 0.01), 'head', 0x7a3b3b, 0, 1.61, 0.1); // mouth
  if (look.beard) add(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.35).scale(0.95, 1.1, 1.05), 'head', look.hair, 0, 1.665, 0.01);
  // hair
  const hs = look.hairStyle;
  if (hs !== 'bald') {
    const cap = new THREE.SphereGeometry(0.113, 14, 8, 0, Math.PI * 2, 0, hs === 'buzz' ? Math.PI * 0.42 : Math.PI * 0.55);
    cap.scale(0.95, 1.1, 1.06);
    add(cap, 'head', look.hair, 0, 1.675, -0.006, -0.25);
    if (hs === 'long') add(capsule(0.085, 0.16, 1.25, 0.55), 'head', look.hair, 0, 1.55, -0.07);
    if (hs === 'bun') add(new THREE.SphereGeometry(0.055, 8, 6), 'head', look.hair, 0, 1.76, -0.08);
  }
  if (look.hat) add(new THREE.CylinderGeometry(0.115, 0.12, 0.07, 12), 'head', look.hat, 0, 1.76, 0), add(new THREE.BoxGeometry(0.2, 0.015, 0.12), 'head', look.hat, 0, 1.735, 0.1);
  // arms: upper arm, forearm, hand
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    const x = s * sh;
    add(capsule(0.048 * b, 0.2), 'upperArm' + L, look.sleeveless ? skin : top, x, 1.28, 0);
    add(capsule(0.042 * b, 0.19), 'foreArm' + L, skin, x, 1.02, 0);
    add(new THREE.BoxGeometry(0.06, 0.1, 0.035), 'hand' + L, skin, x, 0.85, 0.005);
    add(new THREE.BoxGeometry(0.025, 0.06, 0.03), 'hand' + L, skin, x - s * 0.035, 0.87, 0.03, 0, 0, s * 0.4); // thumb
  }
  // legs: thigh, shin, foot
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    const x = s * 0.095;
    add(capsule(0.072 * b, 0.32, 1, 1.05), 'thigh' + L, bot, x, 0.7, 0);
    add(capsule(0.055 * b, 0.32), 'shin' + L, look.shorts ? skin : bot, x, 0.3, 0);
    if (look.shorts) add(new THREE.CylinderGeometry(0.078 * b, 0.075 * b, 0.12, 10), 'thigh' + L, bot, x, 0.56, 0);
    add(new THREE.BoxGeometry(0.095, 0.07, 0.25).translate(0, 0, 0.04), 'foot' + L, look.shoes, x, 0.035, 0.02);
  }
  const g = mergeGeometries(parts, false);
  const sc = look.height / 1.78;
  g.scale(sc, sc, sc);
  g.computeBoundingSphere();
  return { geo: g, scale: sc };
}

/** Bone layout (bind pose positions, absolute), scaled by height. */
function buildSkeleton(look, sc) {
  const sh = look.female ? 0.17 : 0.2;
  const abs = {
    root: [0, 0, 0], hips: [0, 0.95, 0], spine: [0, 1.02, 0], chest: [0, 1.22, 0], neck: [0, 1.47, 0], head: [0, 1.55, 0],
    upperArmL: [-sh, 1.42, 0], foreArmL: [-sh, 1.14, 0], handL: [-sh, 0.9, 0],
    upperArmR: [sh, 1.42, 0], foreArmR: [sh, 1.14, 0], handR: [sh, 0.9, 0],
    thighL: [-0.095, 0.92, 0], shinL: [-0.095, 0.5, 0], footL: [-0.095, 0.09, 0],
    thighR: [0.095, 0.92, 0], shinR: [0.095, 0.5, 0], footR: [0.095, 0.09, 0],
  };
  const parent = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL', upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
  const bones = {};
  const list = [];
  for (const name of BONES) {
    const bone = new THREE.Bone();
    bone.name = name;
    const p = abs[name], pp = parent[name] ? abs[parent[name]] : [0, 0, 0];
    bone.position.set((p[0] - pp[0]) * sc, (p[1] - pp[1]) * sc, (p[2] - pp[2]) * sc);
    if (parent[name]) bones[parent[name]].add(bone);
    bones[name] = bone;
    list.push(bone);
  }
  return { bones, list };
}

const sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

export class HumanModel {
  constructor(look) {
    this.look = look;
    const { geo, scale } = buildGeometry(look);
    this.scale = scale;
    const { bones, list } = buildSkeleton(look, scale);
    this.bones = bones;
    this.mesh = new THREE.SkinnedMesh(geo, sharedMat);
    this.mesh.add(bones.root);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(list));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.rest = {};
    for (const [k, b] of Object.entries(bones)) this.rest[k] = b.position.clone();
    // held weapon (pistol) parented to the right hand
    this.gun = makePistol();
    this.gun.visible = false;
    this.gun.position.set(0, -0.08 * scale, 0.03);
    this.gun.rotation.x = Math.PI / 2;
    bones.handR.add(this.gun);
    this.phone = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x3366aa, emissiveIntensity: 0.6 }));
    this.phone.position.set(0, -0.07, 0.03);
    this.phone.visible = false;
    bones.handR.add(this.phone);
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
  }
}

function makePistol() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.4, metalness: 0.7 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.19), m);
  slide.position.set(0, 0.02, 0.06);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.1, 0.045), m);
  grip.position.set(0, -0.03, -0.005);
  grip.rotation.x = 0.25;
  g.add(slide, grip);
  g.userData.muzzle = new THREE.Object3D();
  g.userData.muzzle.position.set(0, 0.02, 0.16);
  g.add(g.userData.muzzle);
  return g;
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/**
 * Procedural animation. Call update(dt, state) each frame. State fields:
 * speed (m/s), grounded, crouch, aim (0..1), aimPitch, sitting, surrender,
 * cower, phone, dead (0..1 fall progress), swim, punch (0..1), flinch (0..1),
 * talk, steer (-1..1 while sitting), lookYaw (head turn), sitGround.
 */
export class HumanAnimator {
  constructor(model) {
    this.m = model;
    this.phase = Math.random() * 10;
    this.w = { walk: 0, run: 0, air: 0, aim: 0, sit: 0, surrender: 0, cower: 0, phone: 0, swim: 0, crouch: 0, talk: 0 };
    this.t = Math.random() * 10;
  }

  update(dt, s) {
    const w = this.w;
    this.t += dt;
    const sp = s.speed || 0;
    const moving = s.grounded !== false && !s.sitting && !s.swim;
    w.walk = damp(w.walk, moving ? Math.min(1, sp / 1.6) : 0, 10, dt);
    w.run = damp(w.run, moving ? THREE.MathUtils.clamp((sp - 2.2) / 2.5, 0, 1) : 0, 8, dt);
    w.air = damp(w.air, s.grounded === false && !s.swim && !s.sitting ? 1 : 0, 12, dt);
    w.aim = damp(w.aim, s.aim ? 1 : 0, 14, dt);
    w.sit = s.sitting ? 1 : damp(w.sit, 0, 10, dt);
    w.surrender = damp(w.surrender, s.surrender ? 1 : 0, 6, dt);
    w.cower = damp(w.cower, s.cower ? 1 : 0, 6, dt);
    w.phone = damp(w.phone, s.phone ? 1 : 0, 6, dt);
    w.swim = damp(w.swim, s.swim ? 1 : 0, 5, dt);
    w.crouch = damp(w.crouch, s.crouch ? 1 : 0, 10, dt);
    w.talk = damp(w.talk, s.talk ? 1 : 0, 4, dt);
    const stride = 1.25 + w.run * 0.6;
    this.phase += (sp / stride) * Math.PI * dt * (s.swim ? 0.5 : 1);
    if (s.swim) this.phase += dt * 3;
    const ph = this.phase;
    const B = this.m.bones;
    const sc = this.m.scale;
    const R = this.m.rest;

    // reset
    for (const k in B) { B[k].rotation.set(0, 0, 0); B[k].position.copy(R[k]); }

    const legAmp = 0.45 * w.walk + 0.35 * w.run;
    const sinp = Math.sin(ph), cosp = Math.cos(ph);
    // legs
    B.thighL.rotation.x = -sinp * legAmp;
    B.thighR.rotation.x = sinp * legAmp;
    B.shinL.rotation.x = Math.max(0, cosp) * (0.5 * w.walk + 0.9 * w.run);
    B.shinR.rotation.x = Math.max(0, -cosp) * (0.5 * w.walk + 0.9 * w.run);
    B.footL.rotation.x = -B.thighL.rotation.x * 0.3;
    B.footR.rotation.x = -B.thighR.rotation.x * 0.3;
    B.hips.position.y = R.hips.y + (Math.abs(Math.cos(ph)) - 0.6) * 0.035 * (w.walk + w.run) * sc;
    B.hips.rotation.y = sinp * 0.12 * w.walk;
    B.spine.rotation.y = -sinp * 0.12 * w.walk;
    B.spine.rotation.x = 0.06 * w.run + 0.02 * w.walk;
    // arms swing opposite legs
    const armAmp = 0.35 * w.walk + 0.45 * w.run;
    B.upperArmL.rotation.x = sinp * armAmp;
    B.upperArmR.rotation.x = -sinp * armAmp;
    B.upperArmL.rotation.z = -0.08 - 0.1 * w.run;
    B.upperArmR.rotation.z = 0.08 + 0.1 * w.run;
    B.foreArmL.rotation.x = -0.25 - 0.9 * w.run;
    B.foreArmR.rotation.x = -0.25 - 0.9 * w.run;
    // idle breathing
    const br = Math.sin(this.t * 1.7) * 0.015 * (1 - w.walk);
    B.chest.rotation.x = br;
    B.neck.rotation.x = -br;

    // airborne: knees up, arms out
    if (w.air > 0.01) {
      const a = w.air;
      B.thighL.rotation.x = lerp(B.thighL.rotation.x, -0.7, a); B.thighR.rotation.x = lerp(B.thighR.rotation.x, -0.2, a);
      B.shinL.rotation.x = lerp(B.shinL.rotation.x, 1.1, a); B.shinR.rotation.x = lerp(B.shinR.rotation.x, 0.6, a);
      B.upperArmL.rotation.z = lerp(B.upperArmL.rotation.z, -0.7, a); B.upperArmR.rotation.z = lerp(B.upperArmR.rotation.z, 0.7, a);
    }
    // crouch
    if (w.crouch > 0.01) {
      const c = w.crouch;
      B.hips.position.y -= 0.3 * c * sc;
      B.thighL.rotation.x += -0.9 * c; B.thighR.rotation.x += -0.9 * c;
      B.shinL.rotation.x += 1.3 * c; B.shinR.rotation.x += 1.3 * c;
      B.footL.rotation.x -= 0.4 * c; B.footR.rotation.x -= 0.4 * c;
      B.spine.rotation.x += 0.35 * c;
    }
    // talking gestures
    if (w.talk > 0.01) {
      const g = Math.sin(this.t * 2.3) * 0.5 + Math.sin(this.t * 3.7) * 0.3;
      B.upperArmR.rotation.x = lerp(B.upperArmR.rotation.x, -0.5 + g * 0.3, w.talk);
      B.foreArmR.rotation.x = lerp(B.foreArmR.rotation.x, -1.2 + g * 0.4, w.talk);
      B.head.rotation.y = Math.sin(this.t * 0.7) * 0.25 * w.talk;
    }
    // phone to ear
    if (w.phone > 0.01) {
      const p = w.phone;
      B.upperArmR.rotation.x = lerp(B.upperArmR.rotation.x, -0.4, p);
      B.upperArmR.rotation.z = lerp(B.upperArmR.rotation.z, 0.5, p);
      B.foreArmR.rotation.x = lerp(B.foreArmR.rotation.x, -2.4, p);
      B.foreArmR.rotation.y = lerp(0, -0.4, p);
      B.head.rotation.z = -0.15 * p;
    }
    this.m.phone.visible = w.phone > 0.5;
    // surrender: hands up
    if (w.surrender > 0.01) {
      const u = w.surrender;
      for (const [ua, fa, sgn] of [[B.upperArmL, B.foreArmL, -1], [B.upperArmR, B.foreArmR, 1]]) {
        ua.rotation.x = lerp(ua.rotation.x, -0.2, u);
        ua.rotation.z = lerp(ua.rotation.z, sgn * 2.4, u);
        fa.rotation.z = lerp(fa.rotation.z, -sgn * 1.3, u);
        fa.rotation.x = lerp(fa.rotation.x, 0, u);
      }
    }
    // cower: crouched, arms over the head
    if (w.cower > 0.01) {
      const c = w.cower;
      B.hips.position.y -= 0.42 * c * sc;
      B.thighL.rotation.x = lerp(B.thighL.rotation.x, -1.6, c); B.thighR.rotation.x = lerp(B.thighR.rotation.x, -1.5, c);
      B.shinL.rotation.x = lerp(B.shinL.rotation.x, 2.2, c); B.shinR.rotation.x = lerp(B.shinR.rotation.x, 2.1, c);
      B.spine.rotation.x = lerp(B.spine.rotation.x, 0.7, c);
      B.upperArmL.rotation.x = lerp(B.upperArmL.rotation.x, -2.6, c); B.upperArmR.rotation.x = lerp(B.upperArmR.rotation.x, -2.6, c);
      B.foreArmL.rotation.x = lerp(B.foreArmL.rotation.x, -1.8, c); B.foreArmR.rotation.x = lerp(B.foreArmR.rotation.x, -1.8, c);
    }
    // aiming the pistol: right arm extended, left hand supporting, chest pitched with aim
    this.m.gun.visible = !!s.armed && !s.sitting && !s.swim && !(s.dead > 0.05) && !s.surrender;
    if (w.aim > 0.01) {
      const a = w.aim, pitch = s.aimPitch || 0;
      B.chest.rotation.x = lerp(B.chest.rotation.x, -pitch * 0.5, a);
      B.upperArmR.rotation.set(lerp(B.upperArmR.rotation.x, -Math.PI / 2 - pitch * 0.5, a), lerp(0, 0.15, a), lerp(B.upperArmR.rotation.z, -0.15, a));
      B.foreArmR.rotation.set(lerp(B.foreArmR.rotation.x, 0, a), 0, 0);
      B.upperArmL.rotation.set(lerp(B.upperArmL.rotation.x, -Math.PI / 2 - pitch * 0.5, a), lerp(0, -0.6, a), lerp(B.upperArmL.rotation.z, 0.5, a));
      B.foreArmL.rotation.set(lerp(B.foreArmL.rotation.x, -0.2, a), lerp(0, -0.5, a), 0);
      B.head.rotation.x = -pitch * 0.4 * a;
    } else if (s.armed && !s.sitting) {
      // gun held low
      B.foreArmR.rotation.x = Math.min(B.foreArmR.rotation.x, -0.5);
    }
    // punch
    if (s.punch > 0) {
      const p = Math.sin(Math.min(1, s.punch) * Math.PI);
      B.upperArmR.rotation.x = lerp(B.upperArmR.rotation.x, -1.5, p);
      B.foreArmR.rotation.x = lerp(B.foreArmR.rotation.x, -0.1, p);
      B.spine.rotation.y = lerp(B.spine.rotation.y, -0.5, p);
    }
    // sitting in a vehicle
    if (w.sit > 0.01) {
      const k = w.sit;
      B.thighL.rotation.set(lerp(B.thighL.rotation.x, -1.45, k), 0, -0.06 * k);
      B.thighR.rotation.set(lerp(B.thighR.rotation.x, -1.45, k), 0, 0.06 * k);
      B.shinL.rotation.x = lerp(B.shinL.rotation.x, 1.35, k); B.shinR.rotation.x = lerp(B.shinR.rotation.x, 1.35, k);
      const st = (s.steer || 0) * 0.35;
      B.upperArmL.rotation.set(lerp(B.upperArmL.rotation.x, -1.05 + st, k), 0, lerp(B.upperArmL.rotation.z, 0.25, k));
      B.upperArmR.rotation.set(lerp(B.upperArmR.rotation.x, -1.05 - st, k), 0, lerp(B.upperArmR.rotation.z, -0.25, k));
      B.foreArmL.rotation.set(lerp(B.foreArmL.rotation.x, -0.45, k), 0, 0);
      B.foreArmR.rotation.set(lerp(B.foreArmR.rotation.x, -0.45, k), 0, 0);
      if (s.passenger) { B.upperArmL.rotation.set(-0.5, 0, 0.1); B.upperArmR.rotation.set(-0.5, 0, -0.1); B.foreArmL.rotation.x = -1; B.foreArmR.rotation.x = -1; }
    }
    // sitting on the sand: legs out in front, leaning back on the hands
    if (s.sitGround) {
      B.hips.position.y = R.hips.y - 0.78 * sc;
      B.thighL.rotation.set(-1.45, 0, -0.12); B.thighR.rotation.set(-1.4, 0, 0.12);
      B.shinL.rotation.x = 0.15; B.shinR.rotation.x = 0.5;
      B.spine.rotation.x = -0.35;
      B.upperArmL.rotation.set(0.5, 0, -0.3); B.upperArmR.rotation.set(0.5, 0, 0.3);
      B.foreArmL.rotation.x = 0; B.foreArmR.rotation.x = 0;
    }
    // swimming: body horizontal, crawl stroke
    if (w.swim > 0.01) {
      const k = w.swim;
      B.root.rotation.x = lerp(0, 1.25, k);
      B.root.position.y = 0.25 * k;
      B.upperArmL.rotation.x = lerp(B.upperArmL.rotation.x, -Math.PI + Math.sin(ph * 2) * 1.6, k);
      B.upperArmR.rotation.x = lerp(B.upperArmR.rotation.x, -Math.PI - Math.sin(ph * 2) * 1.6, k);
      B.thighL.rotation.x = Math.sin(ph * 4) * 0.25 * k; B.thighR.rotation.x = -Math.sin(ph * 4) * 0.25 * k;
      B.head.rotation.x = -0.9 * k;
    }
    // flinch from a hit
    if (s.flinch > 0) { B.spine.rotation.x -= s.flinch * 0.35; B.head.rotation.x -= s.flinch * 0.3; }
    // head look
    if (s.lookYaw) B.head.rotation.y += THREE.MathUtils.clamp(s.lookYaw, -1.1, 1.1);
    // death: fall backwards onto the ground (non-graphic)
    if (s.dead > 0) {
      const d = easeOut(Math.min(1, s.dead));
      B.root.rotation.x = -Math.PI / 2 * d;
      B.root.position.y = 0.12 * d * sc;
      B.root.position.z = -0.25 * d;
      B.upperArmL.rotation.z = lerp(B.upperArmL.rotation.z, -1.2, d);
      B.upperArmR.rotation.z = lerp(B.upperArmR.rotation.z, 1.0, d);
      B.thighL.rotation.x = lerp(B.thighL.rotation.x, -0.15, d); B.thighR.rotation.x = lerp(B.thighR.rotation.x, 0.05, d);
      B.shinL.rotation.x = lerp(B.shinL.rotation.x, 0.4, d); B.shinR.rotation.x = lerp(B.shinR.rotation.x, 0.1, d);
      B.head.rotation.y = 0.5 * d;
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
