// Procedural character models: survivors (humanoid rig), The Specter and The EXE.
// Every model faces +Z. Animation is procedural and driven from pose().
import * as THREE from 'three';
import { fabricTexture, skinTexture, makeStaticCanvas, metalTexture } from '../world/textures.js';
import { clamp, lerp } from '../core/util.js';

const TAU = Math.PI * 2;

/* ---------------- aura (seen through walls) ---------------- */

const auraVert = `
varying vec3 vN; varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const auraFrag = `
uniform vec3 color; uniform float opacity;
varying vec3 vN; varying vec3 vV;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  f = pow(f, 1.6);
  gl_FragColor = vec4(color * (0.6 + f), (0.16 + f * 0.85) * opacity);
}`;

export function makeAuraMaterial(color = 0xffffff) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 } },
    vertexShader: auraVert, fragmentShader: auraFrag,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function attachAura(root) {
  const mat = makeAuraMaterial();
  const list = [];
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.noAura) meshes.push(o); });
  for (const m of meshes) {
    const a = new THREE.Mesh(m.geometry, mat);
    a.position.copy(m.position); a.quaternion.copy(m.quaternion); a.scale.copy(m.scale);
    a.renderOrder = 999; a.visible = false; a.frustumCulled = false;
    a.userData.noAura = true;
    m.parent.add(a);
    list.push(a);
  }
  return {
    mat, list, on: false,
    set(color, opacity = 1) {
      const want = color != null;
      if (want) { mat.uniforms.color.value.set(color); mat.uniforms.opacity.value = opacity; }
      if (want !== this.on) { for (const a of list) a.visible = want; this.on = want; }
    },
  };
}

/* ---------------- helpers ---------------- */

const fabricN = () => fabricTexture().normalMap;

function cloth(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, normalMap: fabricN(), normalScale: new THREE.Vector2(0.6, 0.6) });
}
function skinMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, normalMap: skinTexture().normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
}
function plain(color, rough = 0.7, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = false;
  if (parent) parent.add(m);
  return m;
}

function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

function limb(parent, len, r, mat, x, y, z) {
  const pivot = group(parent, x, y, z);
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), mat, 0, -len / 2, 0, pivot);
  return { pivot, mesh: m };
}

/* ================================================================== */
/* Survivor                                                            */
/* ================================================================== */

export function buildSurvivor(def, outfit) {
  const s = def.height / 1.78;
  const root = new THREE.Group();
  root.name = def.id;
  const body = group(root);
  const mats = {
    skin: skinMat(def.skin),
    top: cloth(outfit.topColor),
    accent: cloth(outfit.accent, 0.6),
    legs: cloth(outfit.legsColor, 0.9),
    shoes: plain(outfit.shoes, 0.6),
    hair: plain(outfit.hairColor, 0.55),
    hat: cloth(outfit.hatColor || '#222222'),
    extra: cloth(outfit.extraColor || '#333333'),
    eye: plain('#f2efe8', 0.3),
    iris: plain('#20160f', 0.2),
    dark: plain('#141010', 0.8),
  };

  const hipY = 0.93 * s;
  const hips = group(body, 0, hipY, 0);
  // pelvis
  mesh(new THREE.CapsuleGeometry(0.135 * s, 0.12 * s, 4, 10), mats.legs, 0, 0.02 * s, 0, hips).rotation.z = Math.PI / 2;

  const torso = group(hips, 0, 0.04 * s, 0);
  const chestLen = 0.3 * s;
  const chest = mesh(new THREE.CapsuleGeometry(0.15 * s, chestLen, 6, 14), mats.top, 0, 0.24 * s, 0, torso);
  chest.scale.set(1.18, 1, 0.72);
  // shoulders
  const sh = mesh(new THREE.CapsuleGeometry(0.075 * s, 0.26 * s, 4, 10), mats.top, 0, 0.42 * s, 0, torso);
  sh.rotation.z = Math.PI / 2;
  sh.scale.set(1, 1, 0.9);

  // clothing details
  const top = outfit.top;
  if (top === 'hoodie') {
    mesh(new THREE.BoxGeometry(0.22 * s, 0.1 * s, 0.03 * s), mats.top, 0, 0.12 * s, 0.11 * s, torso); // pocket
    const hood = mesh(new THREE.SphereGeometry(0.13 * s, 14, 10, 0, TAU, 0, Math.PI * 0.6), mats.top, 0, 0.5 * s, -0.09 * s, torso);
    hood.rotation.x = -1.1;
    for (const dx of [-0.04, 0.04]) mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.14 * s, 4), mats.accent, dx * s, 0.36 * s, 0.115 * s, torso);
  } else if (top === 'jacket') {
    mesh(new THREE.BoxGeometry(0.018 * s, 0.4 * s, 0.02 * s), mats.accent, 0, 0.22 * s, 0.118 * s, torso); // zipper
    const collar = mesh(new THREE.TorusGeometry(0.085 * s, 0.03 * s, 6, 14, Math.PI * 1.3), mats.top, 0, 0.47 * s, 0, torso);
    collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI * 1.15;
    mesh(new THREE.BoxGeometry(0.34 * s, 0.03 * s, 0.2 * s), mats.accent, 0, 0.02 * s, 0, torso); // hem band
  } else if (top === 'vest') {
    for (const y of [0.12, 0.3]) {
      const band = mesh(new THREE.CylinderGeometry(0.182 * s, 0.182 * s, 0.035 * s, 16, 1, true), mats.accent, 0, y * s, 0, torso);
      band.scale.set(1.0, 1, 0.66);
    }
  } else if (top === 'coat') {
    const skirt = mesh(new THREE.CylinderGeometry(0.17 * s, 0.24 * s, 0.38 * s, 16, 1, true), mats.top, 0, -0.17 * s, 0, torso);
    skirt.scale.set(1.05, 1, 0.8);
    skirt.material = mats.top.clone(); skirt.material.side = THREE.DoubleSide;
    const lapel = mesh(new THREE.BoxGeometry(0.08 * s, 0.26 * s, 0.02 * s), mats.accent, 0, 0.32 * s, 0.112 * s, torso);
    lapel.rotation.z = 0.1;
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.012 * s, 6, 4), mats.dark, 0.04 * s, (0.06 + i * 0.1) * s, 0.118 * s, torso);
  } else if (top === 'shirt') {
    mesh(new THREE.BoxGeometry(0.012 * s, 0.38 * s, 0.012 * s), mats.accent, 0, 0.22 * s, 0.112 * s, torso);
    mesh(new THREE.BoxGeometry(0.06 * s, 0.05 * s, 0.01 * s), mats.accent, 0.07 * s, 0.33 * s, 0.112 * s, torso); // pocket flap
  }

  // neck + head
  const neck = group(torso, 0, 0.49 * s, 0);
  mesh(new THREE.CylinderGeometry(0.048 * s, 0.055 * s, 0.09 * s, 10), mats.skin, 0, 0.03 * s, 0, neck);
  const head = group(neck, 0, 0.1 * s, 0.01 * s);
  const skull = mesh(new THREE.SphereGeometry(0.105 * s, 20, 16), mats.skin, 0, 0.06 * s, 0, head);
  skull.scale.set(0.92, 1.12, 1.0);
  const jaw = mesh(new THREE.SphereGeometry(0.08 * s, 14, 10), mats.skin, 0, 0.0, 0.025 * s, head);
  jaw.scale.set(0.95, 0.75, 1.0);
  // face
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.016 * s, 10, 8), mats.eye, side * 0.035 * s, 0.075 * s, 0.088 * s, head, false);
    mesh(new THREE.SphereGeometry(0.009 * s, 8, 6), mats.iris, 0, 0, 0.011 * s, eye, false);
    const brow = mesh(new THREE.BoxGeometry(0.035 * s, 0.008 * s, 0.01 * s), mats.hair, side * 0.036 * s, 0.1 * s, 0.095 * s, head, false);
    brow.rotation.z = -side * 0.12;
    mesh(new THREE.SphereGeometry(0.018 * s, 8, 6), mats.skin, side * 0.1 * s, 0.06 * s, 0, head, false).scale.set(0.5, 1, 0.8); // ears
  }
  const nose = mesh(new THREE.ConeGeometry(0.016 * s, 0.04 * s, 6), mats.skin, 0, 0.05 * s, 0.105 * s, head, false);
  nose.rotation.x = Math.PI / 2 - 0.3;
  mesh(new THREE.BoxGeometry(0.035 * s, 0.006 * s, 0.01 * s), plain('#6a3a32', 0.6), 0, 0.012 * s, 0.098 * s, head, false);

  // hair
  const hs = outfit.hair;
  const cap = (scaleY = 1, r = 0.112) => {
    const c = mesh(new THREE.SphereGeometry(r * s, 18, 12, 0, TAU, 0, Math.PI * 0.55), mats.hair, 0, 0.07 * s, -0.008 * s, head);
    c.scale.set(0.95, scaleY * 1.12, 1.04);
    return c;
  };
  let tail = null;
  if (hs === 'swept') {
    cap(1, 0.114);
    const swoop = mesh(new THREE.SphereGeometry(0.07 * s, 12, 8), mats.hair, 0.02 * s, 0.155 * s, 0.05 * s, head);
    swoop.scale.set(1.3, 0.5, 0.9);
  } else if (hs === 'short') {
    cap(0.95, 0.11);
  } else if (hs === 'bun') {
    cap(1, 0.112);
    mesh(new THREE.SphereGeometry(0.05 * s, 12, 10), mats.hair, 0, 0.17 * s, -0.07 * s, head);
  } else if (hs === 'curly') {
    cap(1, 0.115);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      mesh(new THREE.SphereGeometry(0.032 * s, 8, 6), mats.hair, Math.cos(a) * 0.08 * s, 0.14 * s + Math.sin(i * 1.7) * 0.02 * s, Math.sin(a) * 0.08 * s - 0.01 * s, head);
    }
  } else if (hs === 'ponytail') {
    cap(1, 0.112);
    tail = group(head, 0, 0.12 * s, -0.1 * s);
    mesh(new THREE.CapsuleGeometry(0.03 * s, 0.18 * s, 4, 8), mats.hair, 0, -0.1 * s, -0.02 * s, tail);
    mesh(new THREE.TorusGeometry(0.03 * s, 0.008 * s, 6, 10), mats.accent, 0, 0, 0, tail).rotation.x = Math.PI / 2;
  } else if (hs === 'long') {
    cap(1, 0.115);
    const back = mesh(new THREE.BoxGeometry(0.2 * s, 0.24 * s, 0.05 * s), mats.hair, 0, -0.03 * s, -0.08 * s, head);
    back.rotation.x = 0.12;
    for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(0.035 * s, 0.18 * s, 0.07 * s), mats.hair, side * 0.095 * s, 0.0, -0.01 * s, head);
  }

  // hats
  const hat = outfit.hat;
  if (hat === 'beanie') {
    const b = mesh(new THREE.SphereGeometry(0.12 * s, 16, 10, 0, TAU, 0, Math.PI * 0.55), mats.hat, 0, 0.08 * s, -0.005 * s, head);
    b.scale.set(0.98, 1.25, 1.06);
    mesh(new THREE.TorusGeometry(0.108 * s, 0.022 * s, 8, 18), mats.hat, 0, 0.09 * s, -0.005 * s, head).rotation.x = Math.PI / 2;
  } else if (hat === 'cap') {
    const c = mesh(new THREE.SphereGeometry(0.118 * s, 16, 10, 0, TAU, 0, Math.PI * 0.5), mats.hat, 0, 0.09 * s, -0.005 * s, head);
    c.scale.set(0.97, 0.95, 1.05);
    const brim = mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.012 * s, 16, 1, false, -Math.PI / 2, Math.PI), mats.hat, 0, 0.095 * s, 0.09 * s, head);
    brim.scale.set(1, 1, 1.2);
    brim.rotation.x = 0.12;
  } else if (hat === 'hood') {
    const hd = mesh(new THREE.SphereGeometry(0.14 * s, 16, 12, Math.PI * 0.28, Math.PI * 1.44, 0, Math.PI * 0.8), mats.hat, 0, 0.06 * s, -0.01 * s, head);
    hd.material = mats.hat.clone(); hd.material.side = THREE.DoubleSide;
    hd.scale.set(1, 1.12, 1.08);
    hd.rotation.y = Math.PI;
  } else if (hat === 'headband') {
    mesh(new THREE.TorusGeometry(0.105 * s, 0.014 * s, 6, 20), mats.hat, 0, 0.12 * s, 0, head).rotation.x = Math.PI / 2 - 0.15;
  }

  // extras
  const extras = outfit.extras || [];
  if (extras.includes('glasses')) {
    const gm = plain('#1a1a1a', 0.3, 0.6);
    for (const side of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.022 * s, 0.004 * s, 6, 14), gm, side * 0.036 * s, 0.075 * s, 0.103 * s, head, false);
      ring.scale.set(1.1, 0.85, 1);
    }
    mesh(new THREE.BoxGeometry(0.026 * s, 0.004 * s, 0.004 * s), gm, 0, 0.08 * s, 0.104 * s, head, false);
  }
  if (extras.includes('beard')) {
    const bd = mesh(new THREE.SphereGeometry(0.075 * s, 12, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.55), mats.hair, 0, 0.035 * s, 0.03 * s, head);
    bd.scale.set(1.08, 1.1, 1.05);
  }
  if (extras.includes('headphones')) {
    const hm = plain('#1a1a1a', 0.4, 0.3);
    mesh(new THREE.TorusGeometry(0.12 * s, 0.01 * s, 6, 18, Math.PI), hm, 0, 0.08 * s, 0, head);
    for (const side of [-1, 1]) mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.03 * s, 12), hm, side * 0.11 * s, 0.07 * s, 0, head).rotation.z = Math.PI / 2;
  }
  if (extras.includes('scarf')) {
    const sc = mesh(new THREE.TorusGeometry(0.075 * s, 0.03 * s, 8, 16), mats.extra, 0, 0.47 * s, 0.0, torso);
    sc.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.06 * s, 0.22 * s, 0.025 * s), mats.extra, 0.05 * s, 0.34 * s, 0.11 * s, torso).rotation.z = 0.1;
  }
  if (extras.includes('backpack')) {
    const bp = mesh(new THREE.BoxGeometry(0.26 * s, 0.32 * s, 0.12 * s), mats.extra, 0, 0.25 * s, -0.16 * s, torso);
    bp.geometry.translate(0, 0, 0);
    mesh(new THREE.BoxGeometry(0.2 * s, 0.12 * s, 0.05 * s), mats.extra, 0, 0.16 * s, -0.235 * s, torso);
    for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(0.03 * s, 0.32 * s, 0.02 * s), mats.dark, side * 0.09 * s, 0.28 * s, 0.11 * s, torso);
  }

  // arms
  const sleeveFull = top !== 'shirt';
  const upperMat = top === 'vest' ? cloth('#2a2a2e') : mats.top;
  const foreMat = sleeveFull ? upperMat : mats.skin;
  const arm = (side) => {
    const sh = group(torso, side * 0.2 * s, 0.42 * s, 0);
    const up = mesh(new THREE.CapsuleGeometry(0.048 * s, 0.2 * s, 4, 10), upperMat, 0, -0.145 * s, 0, sh);
    up.scale.set(1, 1, 0.95);
    const elbow = group(sh, 0, -0.29 * s, 0);
    mesh(new THREE.CapsuleGeometry(0.04 * s, 0.19 * s, 4, 10), foreMat, 0, -0.13 * s, 0, elbow);
    const hand = group(elbow, 0, -0.27 * s, 0);
    const hm = mesh(new THREE.BoxGeometry(0.055 * s, 0.09 * s, 0.03 * s), mats.skin, 0, -0.04 * s, 0, hand);
    hm.geometry = new THREE.CapsuleGeometry(0.026 * s, 0.05 * s, 3, 8);
    hm.scale.set(1.2, 1, 0.7);
    return { sh, elbow, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);

  // legs
  const legType = outfit.legs;
  const lr = legType === 'slim' ? 0.058 : 0.068;
  const shinMat = legType === 'shorts' ? mats.skin : mats.legs;
  const leg = (side) => {
    const hip = group(hips, side * 0.095 * s, 0, 0);
    mesh(new THREE.CapsuleGeometry(lr * s, 0.3 * s, 4, 10), mats.legs, 0, -0.21 * s, 0, hip);
    if (legType === 'shorts') {
      mesh(new THREE.CylinderGeometry(0.08 * s, 0.085 * s, 0.22 * s, 12), mats.legs, 0, -0.12 * s, 0, hip);
    }
    const knee = group(hip, 0, -0.44 * s, 0);
    mesh(new THREE.CapsuleGeometry((lr - 0.01) * s, 0.31 * s, 4, 10), shinMat, 0, -0.2 * s, 0, knee);
    const ankle = group(knee, 0, -0.43 * s, 0);
    const foot = mesh(new THREE.BoxGeometry(0.095 * s, 0.07 * s, 0.24 * s), mats.shoes, 0, -0.025 * s, 0.05 * s, ankle);
    foot.geometry = new THREE.CapsuleGeometry(0.045 * s, 0.15 * s, 3, 8);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1.05, 1, 0.75);
    return { hip, knee, ankle };
  };
  const legL = leg(1);
  const legR = leg(-1);

  // flashlight etc. are attached to the right hand
  const itemSocket = group(armR.hand, 0, -0.07 * s, 0.02 * s);

  const rig = { root, body, hips, torso, neck, head, armL, armR, legL, legR, tail, itemSocket, s, hipY, phase: 0, t: 0, kind: 'survivor', mats };
  rig.aura = attachAura(root);
  root.traverse((o) => { if (o.isMesh && !o.userData.noAura) { o.castShadow = true; } });
  return rig;
}

// Smoothly blend joint rotations toward targets.
function rot(obj, x, y, z, k) {
  obj.rotation.x = lerp(obj.rotation.x, x, k);
  obj.rotation.y = lerp(obj.rotation.y, y, k);
  obj.rotation.z = lerp(obj.rotation.z, z, k);
}

// p: { mode, speed, crouch, injured, t, dt, struggle, progress }
export function poseSurvivor(rig, p) {
  const dt = p.dt;
  const k = 1 - Math.exp(-14 * dt);
  const s = rig.s;
  rig.t += dt;
  const t = rig.t;
  const speed = p.speed || 0;
  const mode = p.mode || 'stand';
  let bodyY = 0, bodyPitch = 0, bodyZ = 0;
  let torsoX = 0, torsoY = 0, torsoZ = 0, headX = 0, headY = 0;
  const L = { sh: [0, 0, 0.08], el: [0, 0, 0], hip: [0, 0, 0], kn: [0, 0, 0], an: [0, 0, 0] };
  const R = { sh: [0, 0, -0.08], el: [0, 0, 0], hip: [0, 0, 0], kn: [0, 0, 0], an: [0, 0, 0] };

  const gait = (stride, knee, armAmp, elbowBase, freq) => {
    rig.phase += dt * freq * TAU;
    const ph = rig.phase;
    const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
    L.hip[0] = -sL * stride; R.hip[0] = -sR * stride;
    L.kn[0] = Math.max(0, Math.sin(ph - 1.2)) * knee + 0.08;
    R.kn[0] = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * knee + 0.08;
    L.an[0] = -0.1 * sL; R.an[0] = -0.1 * sR;
    L.sh[0] = sL * armAmp; R.sh[0] = sR * armAmp;
    L.el[0] = -elbowBase - Math.max(0, sL) * 0.3; R.el[0] = -elbowBase - Math.max(0, sR) * 0.3;
    bodyY += Math.abs(Math.cos(ph)) * 0.035 * stride;
  };

  if (mode === 'stand' || mode === 'crouch') {
    const crouch = mode === 'crouch';
    if (crouch) {
      bodyY = -0.4 * s;
      L.hip[0] = R.hip[0] = -1.25; L.kn[0] = R.kn[0] = 1.95; L.an[0] = R.an[0] = -0.55;
      torsoX = 0.55; headX = -0.45;
      L.sh[0] = R.sh[0] = -0.35; L.el[0] = R.el[0] = -0.7;
      if (speed > 0.1) {
        rig.phase += dt * 1.5 * TAU * (speed / 1.2);
        const ph = rig.phase;
        L.hip[0] += Math.sin(ph) * 0.35; R.hip[0] -= Math.sin(ph) * 0.35;
        L.kn[0] += Math.max(0, Math.sin(ph)) * 0.25; R.kn[0] += Math.max(0, -Math.sin(ph)) * 0.25;
        L.sh[0] -= Math.sin(ph) * 0.2; R.sh[0] += Math.sin(ph) * 0.2;
      }
    } else if (speed > 0.15) {
      const run = clamp((speed - 2.3) / 1.7, 0, 1);
      const w = clamp(speed / 2.26, 0, 1);
      gait(lerp(0.45, 0.85, run) * w, lerp(0.55, 1.35, run), lerp(0.3, 0.85, run) * w, lerp(0.15, 1.2, run), lerp(0.85, 1.45, run) * (0.6 + 0.4 * w));
      torsoX = lerp(0.04, 0.28, run);
      headX = -torsoX * 0.6;
    } else {
      // idle breathing and weight shift
      torsoX = 0.02 + Math.sin(t * 1.6) * 0.015;
      torsoZ = Math.sin(t * 0.5) * 0.02;
      headY = Math.sin(t * 0.37) * 0.25;
      L.sh[2] = 0.1; R.sh[2] = -0.1;
      L.el[0] = R.el[0] = -0.15;
      L.kn[0] = 0.05; R.kn[0] = 0.12;
    }
    if (p.injured && !crouch) {
      torsoX += 0.18; torsoZ += 0.08;
      L.sh[0] = -0.7; L.sh[2] = 0.35; L.el[0] = -1.7; L.el[1] = 0.6;
      headX += 0.15;
    }
  } else if (mode === 'crawl') {
    bodyPitch = Math.PI / 2 - 0.08;
    bodyY = 0.16 * s;
    bodyZ = -0.5 * s;
    rig.phase += dt * TAU * 0.6 * clamp(speed / 0.6, 0.2, 1);
    const ph = rig.phase;
    const moving = speed > 0.1;
    L.sh[0] = -2.6 + (moving ? Math.sin(ph) * 0.5 : 0); R.sh[0] = -2.6 + (moving ? -Math.sin(ph) * 0.5 : 0);
    L.sh[2] = 0.3; R.sh[2] = -0.3;
    L.el[0] = -0.6 - (moving ? Math.max(0, Math.sin(ph)) * 0.8 : 0); R.el[0] = -0.6 - (moving ? Math.max(0, -Math.sin(ph)) * 0.8 : 0);
    L.hip[0] = 0.1 + (moving ? Math.sin(ph) * 0.2 : 0); R.hip[0] = 0.1 - (moving ? Math.sin(ph) * 0.2 : 0);
    L.kn[0] = 0.4; R.kn[0] = 0.25;
    headX = -0.9;
  } else if (mode === 'carried') {
    bodyPitch = Math.PI / 2;
    torsoX = 0.6;
    const w = p.struggle ? Math.sin(t * 14) * 0.25 : Math.sin(t * 2) * 0.05;
    torsoZ = w;
    L.sh[0] = R.sh[0] = 1.2 + w; L.el[0] = R.el[0] = -0.3;
    L.hip[0] = 0.5 + w; R.hip[0] = 0.6 - w; L.kn[0] = R.kn[0] = 1.2;
    headX = 0.3;
  } else if (mode === 'hooked') {
    bodyY = 0.3 * s;
    const sw = Math.sin(t * 0.9) * 0.04;
    torsoX = 0.15 + sw; headX = 0.5;
    L.sh[0] = R.sh[0] = -2.7; L.sh[2] = 0.25; R.sh[2] = -0.25;
    L.el[0] = R.el[0] = -0.6;
    L.hip[0] = 0.15; R.hip[0] = 0.05; L.kn[0] = 0.45; R.kn[0] = 0.3; L.an[0] = R.an[0] = 0.5;
    if (p.struggle) {
      const f = Math.sin(t * 11);
      L.hip[0] = -0.4 + f * 0.6; R.hip[0] = -0.4 - f * 0.6; L.kn[0] = 1.0 + f * 0.4; R.kn[0] = 1.0 - f * 0.4;
      torsoZ = f * 0.15; headX = -0.2; headY = f * 0.3;
    }
  } else if (mode === 'repair' || mode === 'search' || mode === 'heal') {
    bodyY = -0.42 * s;
    L.hip[0] = -1.3; R.hip[0] = -0.9; L.kn[0] = 2.0; R.kn[0] = 2.2; L.an[0] = -0.6; R.an[0] = 0.3;
    R.hip[2] = -0.15; L.hip[2] = 0.15;
    torsoX = 0.45; headX = -0.1;
    const w = Math.sin(t * (mode === 'repair' ? 7 : 4));
    const reach = mode === 'heal' ? -1.0 : -1.25;
    L.sh[0] = reach + w * 0.2; R.sh[0] = reach - w * 0.2;
    L.el[0] = -0.7 - w * 0.2; R.el[0] = -0.7 + w * 0.2;
    L.sh[2] = 0.2; R.sh[2] = -0.2;
  } else if (mode === 'unhook' || mode === 'gate') {
    const up = mode === 'unhook';
    const w = Math.sin(t * 5) * 0.12;
    L.sh[0] = (up ? -2.5 : -1.45) + w; R.sh[0] = (up ? -2.5 : -1.45) - w;
    L.el[0] = R.el[0] = up ? -0.4 : -0.6;
    L.sh[2] = 0.15; R.sh[2] = -0.15;
    headX = up ? -0.5 : 0.1;
    torsoX = up ? -0.05 : 0.1;
    L.kn[0] = R.kn[0] = 0.12;
  } else if (mode === 'vault') {
    const pr = p.progress || 0;
    const tuck = Math.sin(pr * Math.PI);
    torsoX = 0.4 * tuck + 0.2;
    L.hip[0] = R.hip[0] = -1.4 * tuck; L.kn[0] = R.kn[0] = 1.8 * tuck;
    L.sh[0] = R.sh[0] = -1.2; L.el[0] = R.el[0] = -0.3;
    L.sh[2] = 0.4; R.sh[2] = -0.4;
  } else if (mode === 'drop') {
    const pr = p.progress || 0;
    R.sh[0] = lerp(-2.8, -0.6, pr); R.el[0] = -0.3;
    L.sh[0] = lerp(-2.4, -0.4, pr);
    torsoX = lerp(-0.1, 0.35, pr);
  } else if (mode === 'flinch') {
    torsoX = -0.35; headX = -0.4;
    L.sh[0] = R.sh[0] = -0.6; L.el[0] = R.el[0] = -1.4;
  } else if (mode === 'item') {
    // aiming a flashlight or holding a map out front
    R.sh[0] = -1.45; R.el[0] = -0.15; R.sh[1] = 0.1;
    L.sh[0] = -0.2; L.el[0] = -0.3;
    if (speed > 0.15) gait(0.4, 0.6, 0.0, 0.3, 0.9);
    R.sh[0] = -1.45; R.el[0] = -0.15;
  }

  if (p.aimPitch !== undefined && (mode === 'item')) torsoX -= p.aimPitch * 0.3;

  rig.body.position.y = lerp(rig.body.position.y, bodyY, k);
  rig.body.position.z = lerp(rig.body.position.z, bodyZ, k);
  rig.body.rotation.x = lerp(rig.body.rotation.x, bodyPitch, k);
  rot(rig.torso, torsoX, torsoY, torsoZ, k);
  rot(rig.head, headX, headY, 0, k);
  const apply = (limbSet, P) => {
    rot(limbSet.sh, P.sh[0], P.sh[1], P.sh[2], k);
    rot(limbSet.elbow, P.el[0], P.el[1], P.el[2], k);
  };
  apply(rig.armL, L); apply(rig.armR, R);
  rot(rig.legL.hip, L.hip[0], L.hip[1], L.hip[2], k); rot(rig.legL.knee, L.kn[0], 0, 0, k); rot(rig.legL.ankle, L.an[0], 0, 0, k);
  rot(rig.legR.hip, R.hip[0], R.hip[1], R.hip[2], k); rot(rig.legR.knee, R.kn[0], 0, 0, k); rot(rig.legR.ankle, R.an[0], 0, 0, k);
  if (rig.tail) rig.tail.rotation.x = 0.3 + Math.sin(t * 3 + speed) * 0.1 * (1 + speed * 0.4);
}

/* ================================================================== */
/* The Specter                                                         */
/* ================================================================== */

export function buildSpecter(outfit) {
  const s = 1.0;
  const root = new THREE.Group();
  root.name = 'specter';
  const body = group(root);
  const dressMat = cloth(outfit.dress, 0.9);
  dressMat.side = THREE.DoubleSide;
  const stainMat = cloth(outfit.dress2, 0.95);
  stainMat.side = THREE.DoubleSide;
  const skin = skinMat(outfit.skin);
  skin.roughness = 0.45;
  const hairMat = plain(outfit.hair, 0.5);
  hairMat.side = THREE.DoubleSide;
  const eyeMat = new THREE.MeshStandardMaterial({ color: outfit.eyes, emissive: outfit.eyes, emissiveIntensity: 3, roughness: 0.3 });
  const metal = metalTexture('#4a3a2a', 'hookmetal');
  const hookMat = new THREE.MeshStandardMaterial({ color: outfit.metal, map: metal.map, normalMap: metal.normalMap, roughness: 0.75, metalness: 0.5 });
  const woodMat = plain('#3a2a1e', 0.85);

  // skirt: lathe with tattered hem
  const pts = [];
  const prof = [[0.2, 1.05], [0.24, 0.9], [0.3, 0.65], [0.38, 0.35], [0.46, 0.1], [0.5, 0.0]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const skirtGeo = new THREE.LatheGeometry(pts, 28);
  const pos = skirtGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0.12) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, y + Math.abs(Math.sin(a * 7) * Math.sin(a * 3.3)) * 0.18 - 0.02);
    }
  }
  skirtGeo.computeVertexNormals();
  const skirt = mesh(skirtGeo, dressMat, 0, 0, 0, body);
  // stained overskirt layer
  const over = mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x * 1.04, p.y * 0.7 + 0.3)), 20, 0, Math.PI * 1.2), stainMat, 0, 0, 0, body);
  over.rotation.y = 2.2;

  const hips = group(body, 0, 1.05, 0);
  const torso = group(hips, 0, 0, 0);
  const bodice = mesh(new THREE.CapsuleGeometry(0.13, 0.36, 6, 14), dressMat, 0, 0.24, 0, torso);
  bodice.scale.set(1.05, 1, 0.72);
  const lace = mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 18), stainMat, 0, 0.5, 0, torso);
  lace.rotation.x = Math.PI / 2;
  const neck = group(torso, 0, 0.55, 0);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 10), skin, 0, 0.04, 0, neck);
  const head = group(neck, 0, 0.12, 0.01);
  const skull = mesh(new THREE.SphereGeometry(0.1, 18, 14), skin, 0, 0.06, 0, head);
  skull.scale.set(0.88, 1.18, 0.98);
  for (const side of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat, side * 0.03, 0.075, 0.085, head, false);
    e.userData.eye = true;
  }
  // hair: long strands draping over the face and down the back
  const hairCap = mesh(new THREE.SphereGeometry(0.108, 18, 12, 0, TAU, 0, Math.PI * 0.6), hairMat, 0, 0.07, -0.005, head);
  hairCap.scale.set(0.95, 1.15, 1.05);
  const strands = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const front = Math.cos(a) > 0.2 ? 0 : 1;
    const len = 0.35 + Math.random() * 0.35 + (Math.sin(a) < -0.3 ? 0.25 : 0);
    const g = group(head, Math.cos(a) * 0.085, 0.13, Math.sin(a) * 0.09);
    const st = mesh(new THREE.BoxGeometry(0.035, len, 0.012), hairMat, 0, -len / 2, 0, g);
    st.rotation.y = -a;
    g.rotation.x = Math.sin(a) > 0 ? -0.12 : 0.15;
    g.userData.base = g.rotation.x;
    strands.push(g);
    void front;
  }
  let veil = null;
  if (outfit.veil) {
    const vm = new THREE.MeshStandardMaterial({ color: outfit.dress, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
    const vg = new THREE.PlaneGeometry(0.5, 0.95, 4, 8);
    const vp = vg.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const y = vp.getY(i);
      vp.setZ(i, Math.pow((0.475 - y) / 0.95, 1.5) * -0.2 + Math.sin(vp.getX(i) * 12) * 0.02);
      vp.setX(i, vp.getX(i) * (0.6 + (0.475 - y) * 0.6));
    }
    vg.computeVertexNormals();
    veil = mesh(vg, vm, 0, -0.32, -0.12, head, false);
    veil.userData.noAura = true;
  }

  const arm = (side) => {
    const sh = group(torso, side * 0.17, 0.45, 0);
    mesh(new THREE.CapsuleGeometry(0.04, 0.26, 4, 10), dressMat, 0, -0.17, 0, sh);
    // tattered sleeve cuff
    const cuff = mesh(new THREE.ConeGeometry(0.07, 0.16, 10, 1, true), stainMat, 0, -0.32, 0, sh);
    cuff.rotation.x = Math.PI;
    const elbow = group(sh, 0, -0.33, 0);
    mesh(new THREE.CapsuleGeometry(0.03, 0.26, 4, 8), skin, 0, -0.15, 0, elbow);
    const hand = group(elbow, 0, -0.31, 0);
    for (let f = 0; f < 4; f++) {
      const fg = mesh(new THREE.CapsuleGeometry(0.008, 0.09, 3, 5), skin, (f - 1.5) * 0.014, -0.05, 0.01, hand);
      fg.rotation.x = 0.3;
    }
    mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), skin, 0, -0.01, 0, hand);
    return { sh, elbow, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);

  // weapon: rusted boat hook held in the right hand
  const weapon = group(armR.hand, 0, -0.04, 0.02);
  const pole = mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.7, 8), woodMat, 0, 0, 0, weapon);
  pole.rotation.x = Math.PI / 2;
  pole.position.z = 0.25;
  const hookHead = group(weapon, 0, 0, 1.1);
  mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 8), hookMat, 0, 0, 0, hookHead).rotation.x = Math.PI / 2;
  const spike = mesh(new THREE.ConeGeometry(0.02, 0.22, 6), hookMat, 0, 0, 0.17, hookHead);
  spike.rotation.x = Math.PI / 2;
  const curl = mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 12, Math.PI * 1.1), hookMat, 0, 0.08, 0.03, hookHead);
  curl.rotation.y = Math.PI / 2;
  weapon.rotation.x = -0.5;

  const rig = { root, body, hips, torso, neck, head, armL, armR, weapon, strands, veil, skirt, s, t: 0, phase: 0, kind: 'specter', eyeMat, twitch: 0, twitchY: 0 };
  rig.allMats = [];
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (!rig.allMats.includes(o.material)) rig.allMats.push(o.material); } });
  for (const m of rig.allMats) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
  rig.aura = attachAura(root);
  return rig;
}

/* ================================================================== */
/* The EXE                                                             */
/* ================================================================== */

function exeBodyMaterial(base, glow) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.35, metalness: 0.4, emissive: glow, emissiveIntensity: 0.0 });
  m.userData.uniforms = { uTime: { value: 0 }, uGlitch: { value: 0 }, uGlow: { value: new THREE.Color(glow) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGlitch; varying vec3 vWp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float band = step(0.82, fract(sin(floor((position.y + uTime * 0.7) * 18.0) * 43758.5453)));
        transformed.x += band * uGlitch * 0.05 * sin(uTime * 90.0);
        transformed.z += band * uGlitch * 0.03 * cos(uTime * 70.0);`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGlitch; uniform vec3 uGlow; varying vec3 vWp;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float scan = step(0.93, fract(vWp.y * 9.0 - uTime * 1.7));
        float vein = step(0.965, fract(vWp.y * 23.0 + sin(vWp.x * 31.0 + vWp.z * 17.0) * 0.6));
        totalEmissiveRadiance += uGlow * (scan * 0.9 + vein * 1.6 + uGlitch * 0.4);`);
  };
  return m;
}

export function buildExe(outfit) {
  const root = new THREE.Group();
  root.name = 'exe';
  const body = group(root);
  const mat = exeBodyMaterial(outfit.body, outfit.glow);
  const jointMat = new THREE.MeshStandardMaterial({ color: outfit.glow2, emissive: outfit.glow2, emissiveIntensity: 1.6, roughness: 0.4 });
  const caseMat = new THREE.MeshStandardMaterial({ color: '#2a2824', roughness: 0.6, metalness: 0.1 });
  const caseDark = new THREE.MeshStandardMaterial({ color: '#121110', roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9adfe8', emissive: outfit.glow, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8 });

  const hipY = 1.12;
  const hips = group(body, 0, hipY, 0);
  mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), mat, 0, 0, 0, hips).rotation.z = Math.PI / 2;
  const torso = group(hips, 0, 0.03, 0);
  // gaunt rib cage
  const ribs = mesh(new THREE.CapsuleGeometry(0.14, 0.34, 6, 12), mat, 0, 0.3, 0, torso);
  ribs.scale.set(1.15, 1, 0.65);
  for (let i = 0; i < 4; i++) {
    const r = mesh(new THREE.TorusGeometry(0.15 - i * 0.01, 0.012, 4, 14, Math.PI), jointMat, 0, 0.2 + i * 0.08, 0.02, torso, false);
    r.rotation.y = -Math.PI / 2; r.rotation.z = Math.PI / 2;
    r.scale.set(1, 1.15, 0.7);
  }
  mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 10), mat, 0, 0.58, 0, torso).rotation.z = Math.PI / 2;
  const neck = group(torso, 0, 0.62, 0);
  mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 8), mat, 0, 0.06, 0, neck);
  // cable bundle out of the neck
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.TorusGeometry(0.12, 0.012, 5, 10, Math.PI * 0.8), caseDark, (i - 1) * 0.04, 0.05, -0.08, neck, false);
    c.rotation.y = Math.PI / 2;
  }
  const head = group(neck, 0, 0.2, 0.02);
  // CRT monitor head
  const crt = mesh(new THREE.BoxGeometry(0.46, 0.38, 0.34), caseMat, 0, 0.1, -0.02, head);
  const back = mesh(new THREE.BoxGeometry(0.34, 0.28, 0.2), caseMat, 0, 0.11, -0.25, head);
  back.scale.set(1, 1, 1);
  mesh(new THREE.BoxGeometry(0.4, 0.32, 0.02), caseDark, 0, 0.11, 0.155, head);
  const screenCanvas = makeStaticCanvas(128, 104);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenCanvas.tex, toneMapped: false });
  const screen = mesh(new THREE.PlaneGeometry(0.36, 0.29), screenMat, 0, 0.11, 0.168, head, false);
  // crack across the glass
  const crack = mesh(new THREE.BoxGeometry(0.3, 0.006, 0.002), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }), 0.02, 0.16, 0.17, head, false);
  crack.rotation.z = -0.5;
  crack.userData.noAura = true;
  // antennae
  for (const side of [-1, 1]) {
    const a = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4), plain('#8a8a8a', 0.3, 0.8), side * 0.08, 0.48, -0.1, head, false);
    a.rotation.z = side * -0.55;
  }
  const screenLight = new THREE.PointLight(outfit.face, 0.0, 4, 2);
  screenLight.position.set(0, 0.11, 0.35);
  head.add(screenLight);

  const arm = (side) => {
    const sh = group(torso, side * 0.24, 0.58, 0);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), jointMat, 0, 0, 0, sh, false);
    mesh(new THREE.CapsuleGeometry(0.035, 0.36, 4, 8), mat, 0, -0.22, 0, sh);
    const elbow = group(sh, 0, -0.44, 0);
    mesh(new THREE.SphereGeometry(0.04, 8, 6), jointMat, 0, 0, 0, elbow, false);
    mesh(new THREE.CapsuleGeometry(0.03, 0.36, 4, 8), mat, 0, -0.21, 0, elbow);
    const hand = group(elbow, 0, -0.43, 0);
    mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), mat, 0, 0, 0, hand);
    for (let f = 0; f < 4; f++) {
      const fg = group(hand, (f - 1.5) * 0.018, -0.03, 0);
      const fm = mesh(new THREE.CapsuleGeometry(0.007, 0.14, 3, 5), mat, 0, -0.08, 0, fg);
      fm.position.z = 0.01;
      fg.rotation.x = 0.25;
    }
    return { sh, elbow, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);

  // weapon: jagged shard of screen glass
  const weapon = group(armR.hand, 0, -0.06, 0.03);
  const shardGeo = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0, 0.05, 0.02, 0.25, -0.03, -0.01, 0.55, 0.0, 0.0, 0.75, 0.04, 0.0, 0.45, -0.05, 0.02, 0.2,
  ]);
  shardGeo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  shardGeo.setIndex([0, 1, 5, 1, 4, 5, 5, 4, 2, 4, 3, 2]);
  shardGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
  shardGeo.computeVertexNormals();
  glassMat.side = THREE.DoubleSide;
  const shard = mesh(shardGeo, glassMat, 0, 0, 0, weapon);
  shard.scale.set(1.6, 1.6, 1);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), caseDark, 0, 0, 0.0, weapon).rotation.x = Math.PI / 2;
  weapon.rotation.x = -1.2;

  const leg = (side) => {
    const hip = group(hips, side * 0.1, 0, 0);
    mesh(new THREE.CapsuleGeometry(0.045, 0.44, 4, 8), mat, 0, -0.28, 0, hip);
    const knee = group(hip, 0, -0.55, 0);
    mesh(new THREE.SphereGeometry(0.045, 8, 6), jointMat, 0, 0, 0, knee, false);
    mesh(new THREE.CapsuleGeometry(0.038, 0.44, 4, 8), mat, 0, -0.27, 0, knee);
    const ankle = group(knee, 0, -0.55, 0);
    const foot = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.22), mat, 0, -0.01, 0.05, ankle);
    void foot;
    return { hip, knee, ankle };
  };
  const legL = leg(1);
  const legR = leg(-1);

  // RGB-split ghosts shown while glitching
  const ghosts = [];
  for (const c of [outfit.glow, outfit.glow2]) {
    const gm = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.6, 4, 10), gm);
    g.position.y = 1.1;
    g.visible = false;
    g.userData.noAura = true;
    root.add(g);
    ghosts.push(g);
  }

  const rig = { root, body, hips, torso, neck, head, armL, armR, legL, legR, weapon, screen, screenCanvas, screenLight, ghosts, mat, s: 1.22, t: 0, phase: 0, kind: 'exe', outfit, frameT: 0, glitch: 0 };
  root.traverse((o) => { if (o.isMesh && !o.userData.noAura) o.castShadow = true; });
  rig.aura = attachAura(root);
  drawExeFace(rig, 0);
  return rig;
}

export function drawExeFace(rig, t, mode = 'face') {
  const sc = rig.screenCanvas;
  const g = sc.ctx;
  const w = sc.canvas.width, h = sc.canvas.height;
  const face = rig.outfit.face;
  sc.noise(0.35, [0.5, 0.55, 0.6]);
  g.globalAlpha = 0.85;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  // scanlines
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  if (mode === 'static') { sc.tex.needsUpdate = true; return; }
  const jx = Math.random() < 0.1 ? (Math.random() - 0.5) * 10 : 0;
  g.fillStyle = face;
  g.shadowColor = face;
  g.shadowBlur = 8;
  // eyes: hollow pixel rings that narrow over time
  const blink = (Math.sin(t * 0.7) > 0.97) ? 0.2 : 1;
  for (const ex of [36, 92]) {
    const px = 6;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
      const d = Math.abs(xx) + Math.abs(yy);
      if (d >= 2 && d <= 3) g.fillRect(ex + jx + xx * px - px / 2, 40 + yy * px * blink, px - 1, (px - 1) * blink);
    }
    g.fillRect(ex + jx - 2, 38, 4, 4);
  }
  // jagged grin of dead pixels
  const teeth = 12;
  for (let i = 0; i < teeth; i++) {
    const x = 20 + i * 7.5 + jx;
    const y = 74 + Math.sin(i / (teeth - 1) * Math.PI) * 8;
    g.fillRect(x, y - (i % 2 ? 6 : 2), 5, i % 2 ? 6 : 2);
  }
  g.shadowBlur = 0;
  // tearing
  if (Math.random() < 0.25) {
    const y = Math.random() * h;
    const strip = g.getImageData(0, y, w, 6);
    g.putImageData(strip, (Math.random() - 0.5) * 20, y);
  }
  sc.tex.needsUpdate = true;
}

/* ================================================================== */
/* Killer posing                                                       */
/* ================================================================== */

// p: { mode: 'move'|'attack'|'carry'|'kick'|'stun'|'pickup'|'hook'|'channel'|'phase'|'vault', speed, progress, dt, carrying }
export function poseKiller(rig, p) {
  const dt = p.dt;
  rig.t += dt;
  const t = rig.t;
  const k = 1 - Math.exp(-16 * dt);
  const speed = p.speed || 0;
  const pr = p.progress || 0;
  let torsoX = 0.06, torsoY = 0, torsoZ = 0, headX = 0, headY = 0, headZ = 0, bodyY = 0;
  const L = { sh: [0, 0, 0.12], el: [-0.3, 0, 0] };
  const R = { sh: [-0.5, 0, -0.15], el: [-0.8, 0, 0] };
  const legs = { lh: 0, rh: 0, lk: 0, rk: 0 };

  if (rig.kind === 'specter') {
    // glide with a slow bob, occasional violent twitch of the head
    bodyY = Math.sin(t * 2.2) * 0.03 + 0.02;
    rig.twitch -= dt;
    if (rig.twitch <= 0) { rig.twitch = 1.5 + Math.random() * 4; rig.twitchY = (Math.random() - 0.5) * 1.4; }
    const tw = rig.twitch > 1.3 ? rig.twitchY : 0;
    headY = tw + Math.sin(t * 0.6) * 0.1; headZ = tw * 0.4; headX = 0.25;
    torsoX = 0.12 + speed * 0.02;
    L.sh = [Math.sin(t * 1.1) * 0.1 - 0.1, 0, 0.18]; L.el = [-0.2, 0, 0];
    R.sh = [-0.55, 0.2, -0.2]; R.el = [-0.9, 0, 0];
    for (const g of rig.strands) g.rotation.x = g.userData.base + Math.sin(t * 2 + g.position.x * 20) * 0.04 - speed * 0.03;
    rig.skirt.rotation.y = Math.sin(t * 1.3) * 0.05;
  } else {
    // EXE: long jerky strides, animated at a low frame rate for a corrupted look
    rig.phase += dt * TAU * (0.55 + speed * 0.12);
    const ph = rig.phase;
    const amp = clamp(speed / 4.6, 0, 1);
    legs.lh = -Math.sin(ph) * 0.7 * amp; legs.rh = Math.sin(ph) * 0.7 * amp;
    legs.lk = Math.max(0, Math.sin(ph - 1.2)) * 1.1 * amp + 0.1; legs.rk = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 1.1 * amp + 0.1;
    bodyY = Math.abs(Math.cos(ph)) * 0.05 * amp;
    torsoX = 0.3; headX = -0.15 + Math.sin(t * 7) * 0.02; headY = Math.sin(t * 0.8) * 0.2; headZ = Math.sin(t * 13) * 0.04;
    L.sh = [Math.sin(ph) * 0.5 * amp + 0.1, 0, 0.15]; L.el = [-0.4, 0, 0];
    R.sh = [-0.45 - Math.sin(ph) * 0.3 * amp, 0, -0.18]; R.el = [-0.9, 0, 0];
  }

  switch (p.mode) {
    case 'lunge':
      R.sh = [-2.4, 0.3, -0.5]; R.el = [-0.6, 0, 0]; torsoX += 0.15; torsoY = 0.3;
      break;
    case 'attack': {
      // wind up, swing across the body, follow through
      const a = pr < 0.25 ? pr / 0.25 : 1;
      const b = clamp((pr - 0.25) / 0.35, 0, 1);
      R.sh = [lerp(-2.4, -1.0, b), lerp(0.3, -1.1, b), lerp(-0.5, 0.4, b)];
      R.el = [lerp(-0.6, -0.2, b), 0, 0];
      torsoY = lerp(0.35 * a, -0.45, b); torsoX += 0.2 * b;
      break;
    }
    case 'carry':
      L.sh = [-2.6, 0, 0.35]; L.el = [-1.6, 0, 0];
      torsoX = 0.15;
      break;
    case 'kick':
      torsoX = 0.5 + Math.sin(pr * Math.PI * 6) * 0.12;
      R.sh = [-1.6 + Math.sin(pr * Math.PI * 6) * 0.5, 0, -0.2]; R.el = [-0.3, 0, 0];
      L.sh = [-1.0, 0, 0.2];
      break;
    case 'pickup':
      torsoX = lerp(0.9, 0.2, pr); L.sh = [-1.6, 0, 0.2]; R.sh = [-1.4, 0, -0.2]; bodyY -= 0.25 * Math.sin(pr * Math.PI);
      break;
    case 'hook':
      L.sh = [-2.9, 0, 0.25]; L.el = [-0.4, 0, 0]; R.sh = [-2.6, 0, -0.25]; torsoX = -0.1;
      break;
    case 'stun':
      torsoX = -0.4 + Math.sin(t * 9) * 0.08; headX = -0.4; L.sh = [-1.2, 0, 0.6]; R.sh = [-1.2, 0, -0.6]; L.el[0] = R.el[0] = -1.5;
      break;
    case 'channel':
      L.sh = [-1.6, 0, 0.4]; R.sh = [-1.6, 0, -0.4]; L.el[0] = R.el[0] = -0.4; headX = -0.3;
      break;
    case 'vault':
      torsoX = 0.6 * Math.sin(pr * Math.PI) + 0.1; L.sh = [-1.5, 0, 0.3]; R.sh = [-1.5, 0, -0.3];
      break;
    case 'phase':
      headY += Math.sin(t * 31) * 0.4; headX = 0.6; torsoX = 0.35; L.sh = [0.4, 0, 0.5]; R.sh = [0.4, 0, -0.5];
      break;
    default: break;
  }

  // EXE updates its visible pose at ~12 fps with dropped frames
  let kk = k;
  if (rig.kind === 'exe') {
    rig.frameT -= dt;
    if (rig.frameT > 0) return;
    rig.frameT = 1 / 12 + (Math.random() < 0.15 ? 0.12 : 0);
    kk = 0.85;
  }
  rig.body.position.y = lerp(rig.body.position.y, bodyY, kk);
  rot(rig.torso, torsoX, torsoY, torsoZ, kk);
  rot(rig.head, headX, headY, headZ, kk);
  rot(rig.armL.sh, L.sh[0], L.sh[1], L.sh[2], kk); rot(rig.armL.elbow, L.el[0], L.el[1], L.el[2], kk);
  rot(rig.armR.sh, R.sh[0], R.sh[1], R.sh[2], kk); rot(rig.armR.elbow, R.el[0], R.el[1], R.el[2], kk);
  if (rig.legL) {
    rot(rig.legL.hip, legs.lh, 0, 0, kk); rot(rig.legL.knee, legs.lk, 0, 0, kk);
    rot(rig.legR.hip, legs.rh, 0, 0, kk); rot(rig.legR.knee, legs.rk, 0, 0, kk);
  }
}

// Specter fade for the veil: opacity applied to every material.
export function setSpecterOpacity(rig, o) {
  for (const m of rig.allMats) {
    const base = m.userData.baseOpacity ?? 1;
    const want = o < 0.999 || m.userData.baseTransparent;
    if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; }
    m.opacity = base * o;
    m.depthWrite = o > 0.5 && !m.userData.baseTransparent;
  }
}

/* ================================================================== */
/* First-person viewmodels for the killer                              */
/* ================================================================== */

export function buildViewmodel(kind, outfit) {
  const g = new THREE.Group();
  const arm = new THREE.Group();
  g.add(arm);
  if (kind === 'specter') {
    const skin = skinMat(outfit.skin);
    const sleeve = cloth(outfit.dress, 0.9);
    const stain = cloth(outfit.dress2, 0.95);
    stain.side = THREE.DoubleSide;
    const wood = plain('#3a2a1e', 0.85);
    const metal = metalTexture('#4a3a2a', 'hookmetal');
    const hookMat = new THREE.MeshStandardMaterial({ color: outfit.metal, map: metal.map, normalMap: metal.normalMap, roughness: 0.75, metalness: 0.5 });
    mesh(new THREE.CapsuleGeometry(0.045, 0.35, 4, 10), sleeve, 0, 0, 0.12, arm, false).rotation.x = Math.PI / 2;
    const cuff = mesh(new THREE.ConeGeometry(0.075, 0.12, 10, 1, true), stain, 0, 0, -0.08, arm, false);
    cuff.rotation.x = -Math.PI / 2;
    const fore = mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), skin, 0, 0, -0.22, arm, false);
    fore.rotation.x = Math.PI / 2;
    const hand = group(arm, 0, 0, -0.36);
    mesh(new THREE.BoxGeometry(0.06, 0.04, 0.07), skin, 0, 0, 0, hand, false);
    for (let f = 0; f < 4; f++) mesh(new THREE.CapsuleGeometry(0.009, 0.06, 3, 5), skin, (f - 1.5) * 0.015, 0.02, -0.03, hand, false).rotation.z = Math.PI / 2;
    const wp = group(hand, 0, 0, 0);
    const pole = mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.5, 8), wood, 0, 0.0, 0, wp, false);
    pole.rotation.x = 0.0;
    pole.position.set(0, 0.35, -0.05);
    const headG = group(wp, 0, 1.08, -0.05);
    mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 8), hookMat, 0, 0, 0, headG, false);
    mesh(new THREE.ConeGeometry(0.02, 0.22, 6), hookMat, 0, 0.17, 0, headG, false);
    const curl = mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 12, Math.PI * 1.1), hookMat, 0.08, 0.05, 0, headG, false);
    curl.rotation.z = Math.PI / 2;
    wp.rotation.x = -1.05;
    wp.rotation.z = 0.25;
  } else {
    const mat = exeBodyMaterial(outfit.body, outfit.glow);
    const joint = new THREE.MeshStandardMaterial({ color: outfit.glow2, emissive: outfit.glow2, emissiveIntensity: 1.6 });
    const glass = new THREE.MeshStandardMaterial({ color: '#9adfe8', emissive: outfit.glow, emissiveIntensity: 0.7, roughness: 0.05, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    mesh(new THREE.CapsuleGeometry(0.035, 0.4, 4, 8), mat, 0, 0, 0.1, arm, false).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.026, 8, 6), joint, 0, 0, -0.14, arm, false);
    const hand = group(arm, 0, 0, -0.2);
    mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), mat, 0, 0, 0, hand, false);
    for (let f = 0; f < 4; f++) {
      const fm = mesh(new THREE.CapsuleGeometry(0.007, 0.12, 3, 5), mat, (f - 1.5) * 0.017, 0, -0.08, hand, false);
      fm.rotation.x = Math.PI / 2 + 0.4;
    }
    const shardGeo = new THREE.ConeGeometry(0.04, 0.4, 3);
    shardGeo.translate(0, 0.2, 0);
    const sh = mesh(shardGeo, glass, 0, 0.02, -0.02, hand, false);
    sh.rotation.x = -1.2;
    sh.scale.set(1.2, 1, 0.3);
    g.userData.exeMat = mat;
  }
  arm.position.set(kind === 'exe' ? 0.3 : 0.22, kind === 'exe' ? -0.3 : -0.24, kind === 'exe' ? -0.46 : -0.36);
  arm.rotation.set(0.1, 0.15, 0);
  g.scale.setScalar(0.62);
  g.userData.arm = arm;
  g.userData.base = arm.position.clone();
  g.userData.baseRot = arm.rotation.clone();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}
