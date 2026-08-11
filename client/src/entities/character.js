/**
 * Procedural articulated characters.
 *
 * Rather than shipping rigged GLB files we build a real bone hierarchy out of
 * Object3Ds and hang capsule/box limb meshes off it. Joints are covered by
 * sphere caps so there are no gaps, and every pose is computed analytically in
 * `Animator`, which means:
 *   - smooth blending between any two states for free
 *   - animation that reacts continuously to speed, injury, fear and look pitch
 *   - no animation files to load or licence
 *
 * To swap in professional assets, replace `buildBody()` with a GLTF load and
 * map the loaded bones onto the same `this.bones` names — `Animator` will
 * drive them unchanged.
 */

import * as THREE from 'three';

const BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'armL', 'foreArmL', 'handL',
  'shoulderR', 'armR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];

function capsule(radius, length, mat, segs = 8) {
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.01, length), 3, segs);
  const m = new THREE.Mesh(g, mat);
  m.position.y = -length / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function boxMesh(w, h, d, mat, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(0, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Character {
  /**
   * @param {object} opts
   * @param {object} opts.build   colour/proportion spec from shared/characters.js
   * @param {'survivor'|'cenobite'} opts.role
   * @param {boolean} opts.isCenobite
   */
  constructor({ build, role = 'survivor', name = '', quality = {} }) {
    this.build = build;
    this.role = role;
    this.isCenobite = role === 'cenobite';
    this.name = name;
    this.quality = quality;
    this.group = new THREE.Group();
    this.bones = {};
    this.rest = {};
    this.materials = {};
    this.time = 0;
    this.phase = 0;
    this.blend = {};
    this.state = 'idle';
    this.prevState = 'idle';
    this.stateT = 1;
    this.speedFrac = 0;
    this.crouch = 0;
    this.injured = 0;
    this.lookPitch = 0;
    this.actionT = 0;
    this.action = null;

    this.buildMaterials();
    this.buildBody();
    for (const n of BONE_NAMES) {
      if (this.bones[n]) this.rest[n] = this.bones[n].rotation.clone();
    }
  }

  buildMaterials() {
    const b = this.build;
    const mk = (color, rough = 0.82, metal = 0.02, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

    if (this.isCenobite) {
      this.materials.skin = mk(b.skin, 0.55, 0.0);
      this.materials.cloth = mk(b.cassock, 0.72, 0.06);
      this.materials.leather = mk(b.leather, 0.42, 0.12);
      this.materials.accent = mk(b.accent, 0.6, 0.3);
      this.materials.pin = mk(b.pins ?? 0xbfc3c7, 0.28, 0.92);
      this.materials.wound = mk(0x5e1414, 0.5, 0.0, { emissive: 0x1a0303, emissiveIntensity: 0.6 });
    } else {
      this.materials.skin = mk(b.skin, 0.78);
      this.materials.cloth = mk(b.shirt, 0.88);
      this.materials.pants = mk(b.pants, 0.9);
      this.materials.coat = mk(b.coat, 0.85);
      this.materials.hair = mk(b.hair, 0.94);
      this.materials.accent = mk(b.accent, 0.6, 0.35);
      this.materials.blood = mk(0x5a0f0f, 0.4, 0.0);
    }
    this.materials.boot = mk(0x14120f, 0.9);
  }

  /** Adds a bone as a child of `parent` at local offset. */
  bone(name, parent, x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    (parent ? this.bones[parent] : this.group).add(o);
    this.bones[name] = o;
    return o;
  }

  buildBody() {
    const b = this.build;
    const S = b.height / 1.78; // scale everything from a 1.78m reference
    const F = b.frame || 1;
    this.scaleFactor = S;

    const legLen = 0.46 * S;
    const shinLen = 0.44 * S;
    const torsoLen = 0.28 * S;
    const chestLen = 0.24 * S;
    const armLen = 0.30 * S;
    const foreLen = 0.28 * S;
    const hipY = (legLen + shinLen + 0.11) * S;
    this.hipHeight = hipY;
    this.eyeHeight = b.height * 0.93;

    const skin = this.materials.skin;
    const cloth = this.materials.cloth;
    const pants = this.isCenobite ? this.materials.leather : this.materials.pants;
    const coat = this.isCenobite ? this.materials.cloth : this.materials.coat;

    // ---- spine ----
    this.bone('hips', null, 0, hipY, 0);
    this.bones.hips.add(boxMesh(0.28 * S * F, 0.2 * S, 0.19 * S * F, pants, -0.02 * S));
    this.bone('spine', 'hips', 0, 0.06 * S, 0);
    const torso = capsule(0.145 * S * F, torsoLen, cloth, 10);
    torso.position.y = torsoLen / 2;
    torso.scale.z = 0.82;
    this.bones.spine.add(torso);

    this.bone('chest', 'spine', 0, torsoLen, 0);
    const chest = capsule(0.165 * S * F, chestLen, cloth, 10);
    chest.position.y = chestLen / 2;
    chest.scale.z = 0.78;
    this.bones.chest.add(chest);
    // shoulders block
    this.bones.chest.add(boxMesh(0.42 * S * F, 0.1 * S, 0.2 * S * F, cloth, chestLen * 0.92));

    this.bone('neck', 'chest', 0, chestLen + 0.03 * S, 0);
    this.bones.neck.add(capsule(0.052 * S, 0.07 * S, skin, 8));
    this.bone('head', 'neck', 0, 0.1 * S, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.108 * S, 16, 14), skin);
    head.position.y = 0.09 * S;
    head.scale.set(0.94, 1.12, 1.0);
    head.castShadow = true;
    this.bones.head.add(head);
    // jaw so the silhouette isn't a ball
    const jaw = boxMesh(0.13 * S, 0.075 * S, 0.12 * S, skin, 0.035 * S, 0.03 * S);
    this.bones.head.add(jaw);

    // ---- arms ----
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? -1 : 1;
      this.bone('shoulder' + side, 'chest', s * 0.2 * S * F, chestLen * 0.86, 0);
      this.bones['shoulder' + side].add(
        new THREE.Mesh(new THREE.SphereGeometry(0.072 * S * F, 10, 8), cloth)
      );
      this.bone('arm' + side, 'shoulder' + side, 0, -0.02 * S, 0);
      this.bones['arm' + side].add(capsule(0.055 * S * F, armLen, cloth, 8));
      this.bone('foreArm' + side, 'arm' + side, 0, -armLen - 0.02 * S, 0);
      this.bones['foreArm' + side].add(capsule(0.048 * S * F, foreLen, this.isCenobite ? this.materials.leather : skin, 8));
      this.bone('hand' + side, 'foreArm' + side, 0, -foreLen - 0.02 * S, 0);
      const hand = boxMesh(0.055 * S, 0.1 * S, 0.085 * S, skin, -0.04 * S);
      this.bones['hand' + side].add(hand);
    }

    // ---- legs ----
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? -1 : 1;
      this.bone('thigh' + side, 'hips', s * 0.095 * S * F, -0.07 * S, 0);
      this.bones['thigh' + side].add(capsule(0.075 * S * F, legLen, pants, 8));
      this.bone('shin' + side, 'thigh' + side, 0, -legLen - 0.02 * S, 0);
      this.bones['shin' + side].add(capsule(0.06 * S * F, shinLen, pants, 8));
      this.bone('foot' + side, 'shin' + side, 0, -shinLen - 0.02 * S, 0);
      const foot = boxMesh(0.09 * S, 0.075 * S, 0.22 * S, this.materials.boot, -0.03 * S, 0.05 * S);
      this.bones['foot' + side].add(foot);
    }

    if (this.isCenobite) this.buildCenobiteDetail(S, F);
    else this.buildSurvivorDetail(S, F, coat);

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  buildSurvivorDetail(S, F, coat) {
    const b = this.build;
    // long coat panels that swing with the hips
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3 * S * F, 0.5 * S, 0.03 * S), coat);
    panel.position.set(0, -0.24 * S, 0.115 * S * F);
    this.bones.hips.add(panel);
    const panelB = panel.clone();
    panelB.position.z = -0.115 * S * F;
    this.bones.hips.add(panelB);
    this.coatPanels = [panel, panelB];

    // hair
    const hairMat = this.materials.hair;
    if (b.hairStyle === 'bun') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115 * S, 12, 10, 0, 6.28, 0, 1.5), hairMat);
      cap.position.y = 0.095 * S;
      this.bones.head.add(cap);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.062 * S, 10, 8), hairMat);
      bun.position.set(0, 0.13 * S, -0.1 * S);
      this.bones.head.add(bun);
    } else if (b.hairStyle === 'ponytail') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.117 * S, 12, 10, 0, 6.28, 0, 1.7), hairMat);
      cap.position.y = 0.088 * S;
      this.bones.head.add(cap);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * S, 0.26 * S, 3, 8), hairMat);
      tail.position.set(0, -0.02 * S, -0.13 * S);
      tail.rotation.x = -0.4;
      this.bones.head.add(tail);
      this.ponytail = tail;
    } else {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112 * S, 12, 10, 0, 6.28, 0, 1.35), hairMat);
      cap.position.y = 0.1 * S;
      this.bones.head.add(cap);
    }

    // a belt with the accent colour so each survivor reads at distance
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * S * F, 0.16 * S * F, 0.05 * S, 12), this.materials.accent);
    belt.position.y = 0.02 * S;
    belt.scale.z = 0.85;
    this.bones.hips.add(belt);

    // blood overlay meshes, revealed when injured
    this.bloodDecals = [];
    for (const [boneName, y, r] of [['chest', 0.1, 0.17], ['spine', 0.12, 0.15], ['thighL', -0.2, 0.08]]) {
      const bone = this.bones[boneName];
      if (!bone) continue;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r * S, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a0a0a, roughness: 0.35, transparent: true, opacity: 0 })
      );
      m.position.y = y * S;
      m.scale.set(1.05, 1.02, 1.05);
      bone.add(m);
      this.bloodDecals.push(m);
    }
  }

  buildCenobiteDetail(S, F) {
    const b = this.build;
    // ---- the cassock: a long skirt that reads as fabric ----
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19 * S * F, 0.42 * S * F, 0.95 * S, 14, 3, true),
      new THREE.MeshStandardMaterial({ color: b.cassock, roughness: 0.68, metalness: 0.08, side: THREE.DoubleSide })
    );
    skirt.position.y = -0.42 * S;
    skirt.castShadow = true;
    this.bones.hips.add(skirt);
    this.skirt = skirt;

    // ---- leather chest harness ----
    for (let i = 0; i < 3; i++) {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.17 * S * F, 0.016 * S, 5, 18),
        this.materials.leather
      );
      strap.rotation.x = Math.PI / 2;
      strap.position.y = 0.06 * S + i * 0.08 * S;
      strap.scale.z = 0.8;
      this.bones.chest.add(strap);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.04 * S, 0.34 * S, 0.02 * S), this.materials.leather);
    cross.position.set(0, 0.14 * S, 0.13 * S * F);
    cross.rotation.z = 0.35;
    this.bones.chest.add(cross);
    const cross2 = cross.clone();
    cross2.rotation.z = -0.35;
    this.bones.chest.add(cross2);

    // ---- the grid of pins ----
    const n = b.pinGrid || 6;
    const pinGeo = new THREE.CylinderGeometry(0.0055 * S, 0.0045 * S, 0.052 * S, 5);
    const headGeo = new THREE.SphereGeometry(0.0085 * S, 5, 4);
    const total = n * n * 2;
    const pins = new THREE.InstancedMesh(pinGeo, this.materials.pin, total);
    const heads = new THREE.InstancedMesh(headGeo, this.materials.pin, total);
    const dummy = new THREE.Object3D();
    const R = 0.108 * S;
    let k = 0;
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n * 2; ix++) {
        if (k >= total) break;
        // spread over the front and sides of the skull, not the jaw
        const theta = (ix / (n * 2)) * Math.PI * 2;
        const phi = 0.32 + (iy / (n - 1)) * 1.15;
        const px = Math.sin(phi) * Math.cos(theta) * R * 0.94;
        const py = Math.cos(phi) * R * 1.12 + 0.09 * S;
        const pz = Math.sin(phi) * Math.sin(theta) * R;
        const nrm = new THREE.Vector3(px, py - 0.09 * S, pz).normalize();
        dummy.position.set(px + nrm.x * 0.02 * S, py + nrm.y * 0.02 * S, pz + nrm.z * 0.02 * S);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pins.setMatrixAt(k, dummy.matrix);
        dummy.position.set(px + nrm.x * 0.045 * S, py + nrm.y * 0.045 * S, pz + nrm.z * 0.045 * S);
        dummy.updateMatrix();
        heads.setMatrixAt(k, dummy.matrix);
        k++;
      }
    }
    pins.count = k;
    heads.count = k;
    pins.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    pins.castShadow = false;
    heads.castShadow = false;
    this.bones.head.add(pins);
    this.bones.head.add(heads);

    // ---- incised grid on the scalp ----
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x7a3535, roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.104 * S, 0.0022 * S, 3, 24), lineMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 * S + i * 0.032 * S;
      ring.scale.setScalar(Math.max(0.25, Math.sin((i / 6) * Math.PI * 0.9 + 0.35)));
      this.bones.head.add(ring);
      const vert = new THREE.Mesh(new THREE.TorusGeometry(0.106 * S, 0.0022 * S, 3, 24), lineMat);
      vert.rotation.y = (i / 6) * Math.PI;
      vert.position.y = 0.088 * S;
      this.bones.head.add(vert);
    }

    // ---- chains from the shoulders ----
    this.shoulderChains = [];
    for (const side of ['L', 'R']) {
      const chain = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const link = new THREE.Mesh(
          new THREE.TorusGeometry(0.028 * S, 0.008 * S, 4, 7),
          this.materials.accent
        );
        link.position.y = -i * 0.05 * S;
        link.rotation.y = i % 2 ? Math.PI / 2 : 0;
        link.rotation.x = Math.PI / 2;
        chain.add(link);
      }
      chain.position.set(side === 'L' ? -0.16 * S : 0.16 * S, 0.12 * S, 0.1 * S);
      this.bones.chest.add(chain);
      this.shoulderChains.push(chain);
    }

    // ---- wounds ----
    if (b.wounds) {
      for (const [bn, y, z, s] of [['chest', 0.14, 0.14, 0.05], ['spine', 0.1, 0.13, 0.04], ['head', 0.04, 0.1, 0.02]]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(s * S, 6, 5), this.materials.wound);
        w.position.set(0, y * S, z * S);
        w.scale.set(2.4, 0.6, 0.5);
        this.bones[bn].add(w);
      }
    }
  }

  // ------------------------------------------------------------ appearance

  setInjured(t) {
    this.injured = t;
    if (!this.bloodDecals) return;
    for (const d of this.bloodDecals) d.material.opacity = t * 0.85;
  }

  /** A spotlight in the character's hand. Survivors only. */
  attachFlashlight() {
    if (this.flashlight || this.isCenobite) return;
    const light = new THREE.SpotLight(0xf5e6c8, 0, 26, Math.PI / 7, 0.42, 1.4);
    light.position.set(0, -0.05, 0.06);
    const target = new THREE.Object3D();
    target.position.set(0, -0.05, 3);
    this.bones.handR.add(light);
    this.bones.handR.add(target);
    light.target = target;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.17, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 })
    );
    body.rotation.x = Math.PI / 2;
    body.position.set(0, -0.05, 0.05);
    this.bones.handR.add(body);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.024, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0cc })
    );
    lens.position.set(0, -0.05, 0.135);
    this.bones.handR.add(lens);
    this.flashlight = light;
    this.flashlightLens = lens;
    this.flashlightBody = body;
    body.visible = false;
    lens.visible = false;
  }

  setFlashlight(on, intensity = 55) {
    if (!this.flashlight) this.attachFlashlight();
    if (!this.flashlight) return;
    this.flashlight.intensity = on ? intensity : 0;
    if (this.flashlightBody) this.flashlightBody.visible = true;
    if (this.flashlightLens) {
      this.flashlightLens.visible = true;
      this.flashlightLens.material.color.setHex(on ? 0xfff0cc : 0x3a3428);
    }
  }

  setCarrying(kind) {
    if (this.carryMesh) {
      this.carryMesh.parent?.remove(this.carryMesh);
      this.carryMesh = null;
    }
    if (!kind) return;
    const isRelic = kind === 'relic';
    const m = new THREE.Mesh(
      isRelic ? new THREE.OctahedronGeometry(0.11, 0) : new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshStandardMaterial({
        color: isRelic ? 0xd8b25a : 0xc0402f,
        emissive: isRelic ? 0x6a4408 : 0x4d0c06,
        emissiveIntensity: 1.4,
        metalness: 0.7,
        roughness: 0.35,
      })
    );
    m.position.set(0, -0.11, 0.02);
    this.bones.handL.add(m);
    this.carryMesh = m;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose && !o.material.__shared) o.material.dispose();
    });
  }
}

// ---------------------------------------------------------------- animator

const TWO_PI = Math.PI * 2;

/**
 * Analytical pose generation. Every state writes into a target pose which is
 * then blended toward, so transitions never pop.
 */
export class Animator {
  constructor(character) {
    this.c = character;
    this.phase = Math.random() * TWO_PI;
    this.pose = {};
    this.target = {};
    this.state = 'idle';
    this.prevWorld = new THREE.Vector3();
    this.footPhase = 0;
    this.lastFootstep = 0;
    this.onFootstep = null;
    this.actionT = 0;
    this.actionDur = 0;
    this.action = null;
    for (const n of BONE_NAMES) {
      this.pose[n] = { x: 0, y: 0, z: 0 };
      this.target[n] = { x: 0, y: 0, z: 0 };
    }
    this.rootOffset = { y: 0, pitch: 0, roll: 0 };
    this.rootTarget = { y: 0, pitch: 0, roll: 0 };
  }

  set(name, x, y = 0, z = 0) {
    const t = this.target[name];
    if (!t) return;
    t.x = x;
    t.y = y;
    t.z = z;
  }

  /** Trigger a one-shot overlay (attack, vault, hit, execute). */
  play(action, duration) {
    this.action = action;
    this.actionDur = duration;
    this.actionT = 0;
  }

  /**
   * @param {number} dt
   * @param {object} s state: { state, speedFrac, crouch, injured, lookPitch, fear }
   */
  update(dt, s) {
    const c = this.c;
    const speed = s.speedFrac || 0;
    const crouch = s.crouch ? 1 : 0;
    const injured = s.injured || 0;
    const fear = s.fear || 0;

    // walk cycle phase advances with speed so feet never skate
    const cadence = 2.2 + speed * 5.4;
    if (s.state === 'walk' || s.state === 'run' || s.state === 'crouchwalk') {
      this.phase += dt * cadence;
    } else if (s.state === 'crawl') {
      this.phase += dt * 2.4;
    } else {
      this.phase += dt * 1.1;
    }
    if (this.phase > TWO_PI * 64) this.phase -= TWO_PI * 64;

    // reset targets
    for (const n of BONE_NAMES) {
      const t = this.target[n];
      t.x = t.y = t.z = 0;
    }
    this.rootTarget.y = 0;
    this.rootTarget.pitch = 0;
    this.rootTarget.roll = 0;

    switch (s.state) {
      case 'run':
      case 'walk':
      case 'crouchwalk':
        this.poseLocomotion(speed, crouch, injured, s.state === 'run');
        break;
      case 'crawl':
        this.poseCrawl();
        break;
      case 'downed':
        this.poseDowned();
        break;
      case 'dead':
        this.poseDead();
        break;
      case 'interact':
        this.poseInteract(crouch);
        break;
      case 'hide':
        this.poseHide();
        break;
      case 'box':
        this.poseBox();
        break;
      default:
        this.poseIdle(crouch, injured, fear);
    }

    // ---- one-shot overlays ----
    if (this.action) {
      this.actionT += dt;
      const t = Math.min(1, this.actionT / this.actionDur);
      if (this.action === 'attack') this.poseAttack(t);
      else if (this.action === 'vault') this.poseVault(t);
      else if (this.action === 'hit') this.poseHit(t);
      else if (this.action === 'execute') this.poseExecute(t);
      else if (this.action === 'cast') this.poseCast(t);
      if (t >= 1) this.action = null;
    }

    // ---- look ----
    const pitch = THREE.MathUtils.clamp(s.lookPitch || 0, -0.7, 0.7);
    this.target.head.x += pitch * 0.6;
    this.target.neck.x += pitch * 0.25;

    // ---- injury limp and fear tremor ----
    if (injured > 0.01) {
      const limp = Math.sin(this.phase) > 0 ? injured : 0;
      this.rootTarget.y -= limp * 0.06;
      this.rootTarget.roll += limp * 0.09;
      this.target.spine.z += injured * 0.12;
      this.target.chest.x += injured * 0.16;
    }
    if (fear > 0.5 && s.state !== 'dead') {
      const tremor = (fear - 0.5) * 2;
      const j = Math.sin(this.phase * 23) * 0.012 * tremor;
      this.target.chest.z += j;
      this.target.head.z += j * 1.6;
      this.target.handL.x += Math.sin(this.phase * 31) * 0.06 * tremor;
      this.target.handR.x += Math.cos(this.phase * 29) * 0.06 * tremor;
    }

    // ---- breathing, always ----
    const breath = Math.sin(this.phase * (0.9 + speed * 0.7 + fear * 1.6)) * (0.012 + fear * 0.02);
    this.target.chest.x += breath;
    this.target.spine.x -= breath * 0.5;

    // ---- blend and apply ----
    const k = 1 - Math.pow(0.0008, dt); // frame-rate independent smoothing
    for (const n of BONE_NAMES) {
      const bone = c.bones[n];
      if (!bone) continue;
      const p = this.pose[n];
      const t = this.target[n];
      p.x += (t.x - p.x) * k;
      p.y += (t.y - p.y) * k;
      p.z += (t.z - p.z) * k;
      const rest = c.rest[n];
      bone.rotation.set(rest.x + p.x, rest.y + p.y, rest.z + p.z);
    }
    this.rootOffset.y += (this.rootTarget.y - this.rootOffset.y) * k;
    this.rootOffset.pitch += (this.rootTarget.pitch - this.rootOffset.pitch) * k;
    this.rootOffset.roll += (this.rootOffset.roll !== this.rootTarget.roll ? this.rootTarget.roll - this.rootOffset.roll : 0) * k;

    c.bones.hips.position.y = c.hipHeight + this.rootOffset.y;
    c.group.rotation.x = this.rootOffset.pitch;
    c.group.rotation.z = this.rootOffset.roll;

    // ---- extras ----
    if (c.skirt) c.skirt.rotation.z = Math.sin(this.phase) * speed * 0.09;
    if (c.ponytail) c.ponytail.rotation.x = -0.4 + Math.sin(this.phase * 2) * speed * 0.25;
    if (c.coatPanels) {
      for (let i = 0; i < c.coatPanels.length; i++) {
        c.coatPanels[i].rotation.x = Math.sin(this.phase * 2 + i * 3.14) * speed * 0.28;
      }
    }
    if (c.shoulderChains) {
      for (let i = 0; i < c.shoulderChains.length; i++) {
        c.shoulderChains[i].rotation.x = Math.sin(this.phase * 1.6 + i) * (0.06 + speed * 0.2);
        c.shoulderChains[i].rotation.z = Math.cos(this.phase * 1.3 + i) * (0.04 + speed * 0.15);
      }
    }

    // ---- footstep events ----
    if ((s.state === 'walk' || s.state === 'run' || s.state === 'crouchwalk') && speed > 0.05) {
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastFootstep) {
        this.lastFootstep = step;
        this.onFootstep?.(s.state, speed);
      }
    }
    this.state = s.state;
  }

  // ------------------------------------------------------------- poses

  poseIdle(crouch, injured, fear) {
    const sway = Math.sin(this.phase * 0.8) * 0.03;
    this.set('spine', 0.04 + crouch * 0.35, sway * 0.4, 0);
    this.set('chest', 0.02, -sway * 0.3, 0);
    this.set('armL', 0.06 + crouch * 0.2, 0, 0.13 + fear * 0.06);
    this.set('armR', 0.06 + crouch * 0.2, 0, -0.13 - fear * 0.06);
    this.set('foreArmL', -0.25 - fear * 0.4, 0, 0);
    this.set('foreArmR', -0.25 - fear * 0.4, 0, 0);
    this.set('thighL', crouch * -0.75 + sway * 0.2, 0, 0.03);
    this.set('thighR', crouch * -0.75 - sway * 0.2, 0, -0.03);
    this.set('shinL', crouch * 1.25, 0, 0);
    this.set('shinR', crouch * 1.25, 0, 0);
    this.set('footL', crouch * -0.5, 0, 0);
    this.set('footR', crouch * -0.5, 0, 0);
    this.rootTarget.y = -crouch * 0.42 * this.c.scaleFactor - injured * 0.04;
    this.rootTarget.pitch = crouch * 0.16 + injured * 0.1;
  }

  poseLocomotion(speed, crouch, injured, running) {
    const p = this.phase;
    const amp = (running ? 0.85 : 0.5) + speed * 0.35;
    const legSwing = amp * (1 - crouch * 0.4);
    const armSwing = amp * 0.72 * (1 - crouch * 0.5);

    const sL = Math.sin(p);
    const sR = Math.sin(p + Math.PI);

    this.set('thighL', sL * legSwing - crouch * 0.6, 0, 0.03);
    this.set('thighR', sR * legSwing - crouch * 0.6, 0, -0.03);
    // knees only bend backwards, and mostly on the recovery half of the stride
    this.set('shinL', Math.max(0, -sL) * amp * 1.5 + crouch * 1.0 + 0.08, 0, 0);
    this.set('shinR', Math.max(0, -sR) * amp * 1.5 + crouch * 1.0 + 0.08, 0, 0);
    this.set('footL', -sL * 0.32 - crouch * 0.4, 0, 0);
    this.set('footR', -sR * 0.32 - crouch * 0.4, 0, 0);

    this.set('armL', sR * armSwing * 0.9, 0, 0.12);
    this.set('armR', sL * armSwing * 0.9, 0, -0.12);
    this.set('foreArmL', -0.35 - Math.max(0, sR) * amp * 0.7 - (running ? 0.5 : 0), 0, 0);
    this.set('foreArmR', -0.35 - Math.max(0, sL) * amp * 0.7 - (running ? 0.5 : 0), 0, 0);

    // counter-rotation through the spine sells the weight transfer
    this.set('hips', 0, sL * 0.11 * amp, sL * 0.05);
    this.set('spine', 0.1 + speed * 0.22 + crouch * 0.42, sR * 0.13 * amp, 0);
    this.set('chest', 0.04 + speed * 0.12, sR * 0.09 * amp, 0);
    this.set('head', -speed * 0.1, sL * 0.05, 0);

    // vertical bob, twice per stride
    this.rootTarget.y =
      Math.abs(Math.sin(p)) * 0.055 * amp - 0.03 - crouch * 0.42 * this.c.scaleFactor - injured * 0.04;
    this.rootTarget.pitch = speed * 0.1 + crouch * 0.18 + injured * 0.12;
    this.rootTarget.roll = Math.sin(p) * 0.03 * amp;
  }

  poseCrawl() {
    const p = this.phase;
    const sL = Math.sin(p);
    const sR = Math.sin(p + Math.PI);
    this.rootTarget.pitch = 1.42;
    this.rootTarget.y = -this.c.hipHeight + 0.22;
    this.set('spine', -0.2, 0, 0);
    this.set('chest', -0.35, sL * 0.2, 0);
    this.set('head', -0.9, 0, 0);
    this.set('armL', -1.9 + sL * 0.7, 0, 0.4);
    this.set('armR', -1.9 + sR * 0.7, 0, -0.4);
    this.set('foreArmL', -0.5, 0, 0);
    this.set('foreArmR', -0.5, 0, 0);
    this.set('thighL', 0.15 + sR * 0.4, 0, 0.35);
    this.set('thighR', 0.15 + sL * 0.4, 0, -0.35);
    this.set('shinL', 0.7, 0, 0);
    this.set('shinR', 0.7, 0, 0);
  }

  poseDowned() {
    this.rootTarget.pitch = 1.45;
    this.rootTarget.y = -this.c.hipHeight + 0.2;
    this.set('spine', -0.15, 0, 0.1);
    this.set('chest', -0.25, 0.2, 0);
    this.set('head', -0.7 + Math.sin(this.phase * 0.6) * 0.12, 0.2, 0);
    this.set('armL', -1.6, 0, 0.5);
    this.set('armR', -0.6, 0, -0.9);
    this.set('foreArmL', -0.8, 0, 0);
    this.set('foreArmR', -1.4, 0, 0);
    this.set('thighL', 0.3, 0, 0.5);
    this.set('thighR', 0.15, 0, -0.3);
    this.set('shinL', 0.9, 0, 0);
    this.set('shinR', 0.5, 0, 0);
  }

  poseDead() {
    this.rootTarget.pitch = 1.55;
    this.rootTarget.roll = 0.3;
    this.rootTarget.y = -this.c.hipHeight + 0.16;
    this.set('head', -0.4, 0.7, 0);
    this.set('armL', -0.4, 0, 1.3);
    this.set('armR', -0.2, 0, -1.5);
    this.set('foreArmL', -0.3, 0, 0);
    this.set('foreArmR', -0.2, 0, 0);
    this.set('thighL', 0.2, 0, 0.6);
    this.set('thighR', 0.1, 0, -0.2);
    this.set('shinL', 0.4, 0, 0);
    this.set('shinR', 0.2, 0, 0);
  }

  poseInteract(crouch) {
    const w = Math.sin(this.phase * 3.4) * 0.16;
    this.set('spine', 0.24 + crouch * 0.3, 0, 0);
    this.set('chest', 0.14, 0, 0);
    this.set('head', 0.3, 0, 0);
    this.set('armL', -1.15 + w * 0.4, 0, 0.28);
    this.set('armR', -1.15 - w * 0.4, 0, -0.28);
    this.set('foreArmL', -0.75 - w, 0, 0);
    this.set('foreArmR', -0.75 + w, 0, 0);
    this.set('thighL', -0.28 - crouch * 0.5, 0, 0.05);
    this.set('thighR', -0.28 - crouch * 0.5, 0, -0.05);
    this.set('shinL', 0.5 + crouch * 0.7, 0, 0);
    this.set('shinR', 0.5 + crouch * 0.7, 0, 0);
    this.rootTarget.y = -0.1 - crouch * 0.35;
    this.rootTarget.pitch = 0.18;
  }

  poseBox() {
    const w = Math.sin(this.phase * 2.1);
    this.set('spine', 0.3, 0, 0);
    this.set('chest', 0.2, 0, 0);
    this.set('head', 0.45, w * 0.1, 0);
    this.set('armL', -1.5, 0, 0.5);
    this.set('armR', -1.5, 0, -0.5);
    this.set('foreArmL', -1.1, w * 0.6, 0);
    this.set('foreArmR', -1.1, -w * 0.6, 0);
    this.set('handL', 0, w * 0.9, 0);
    this.set('handR', 0, -w * 0.9, 0);
    this.rootTarget.pitch = 0.1;
  }

  poseHide() {
    this.set('spine', 0.1, 0, 0);
    this.set('armL', 0.1, 0, 0.35);
    this.set('armR', 0.1, 0, -0.35);
    this.set('foreArmL', -1.6, 0, 0);
    this.set('foreArmR', -1.6, 0, 0);
    this.set('head', 0.2, 0, 0);
    this.rootTarget.y = -0.05;
  }

  poseAttack(t) {
    // wind up, strike, recover
    const wind = Math.min(1, t / 0.32);
    const strike = t > 0.32 ? Math.min(1, (t - 0.32) / 0.22) : 0;
    const recover = t > 0.54 ? (t - 0.54) / 0.46 : 0;
    const s = wind - strike * 1.85 + recover * 0.85;
    this.target.armR.x += -1.9 * s;
    this.target.armR.z += -0.9 * s;
    this.target.foreArmR.x += -1.1 * (1 - strike) * wind;
    this.target.chest.y += 0.75 * s;
    this.target.hips.y += 0.3 * s;
    this.target.spine.x += 0.2 * strike;
    this.target.armL.z += 0.4 * s;
  }

  poseCast(t) {
    const raise = Math.sin(Math.min(1, t) * Math.PI);
    this.target.armR.x += -2.4 * raise;
    this.target.armL.x += -1.5 * raise;
    this.target.armR.z += -0.5 * raise;
    this.target.armL.z += 0.5 * raise;
    this.target.foreArmR.x += -0.4 * raise;
    this.target.chest.x += -0.25 * raise;
    this.target.head.x += -0.3 * raise;
  }

  poseExecute(t) {
    const grab = Math.min(1, t / 0.25);
    const lift = t > 0.25 ? Math.min(1, (t - 0.25) / 0.35) : 0;
    const rend = t > 0.6 ? Math.sin((t - 0.6) / 0.4 * Math.PI * 3) * 0.5 : 0;
    this.target.armL.x += -1.6 * grab - rend;
    this.target.armR.x += -1.6 * grab + rend;
    this.target.armL.z += 0.7 * grab + rend * 0.8;
    this.target.armR.z += -0.7 * grab - rend * 0.8;
    this.target.foreArmL.x += -0.5 * lift;
    this.target.foreArmR.x += -0.5 * lift;
    this.target.spine.x += 0.3 * lift;
    this.target.head.x += 0.25 * lift;
    this.rootTarget.pitch += 0.12 * lift;
  }

  poseVault(t) {
    const up = Math.sin(t * Math.PI);
    this.rootTarget.y += up * 0.75;
    this.rootTarget.pitch += up * 0.75;
    this.target.thighL.x += -1.5 * up;
    this.target.thighR.x += -1.2 * up;
    this.target.shinL.x += 1.7 * up;
    this.target.shinR.x += 1.3 * up;
    this.target.armL.x += -1.9 * up;
    this.target.armR.x += -1.9 * up;
    this.target.foreArmL.x += -0.4 * up;
    this.target.foreArmR.x += -0.4 * up;
    this.target.spine.x += 0.55 * up;
  }

  poseHit(t) {
    const j = Math.sin(t * Math.PI) * (1 - t * 0.4);
    this.target.spine.x += -0.4 * j;
    this.target.chest.x += -0.3 * j;
    this.target.head.x += -0.5 * j;
    this.target.armL.z += 0.6 * j;
    this.target.armR.z += -0.6 * j;
    this.rootTarget.pitch += -0.25 * j;
  }
}

export { BONE_NAMES };
