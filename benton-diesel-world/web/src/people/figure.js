// A single animated person on the joint rig (the player): each body
// segment hangs from its joint, and poses are blended live — idle, walk,
// run, jump, fall and sitting on rides.
import * as THREE from 'three';
import {
  JOINTS, PARENT, WRIST_DROP, bodySegments, packOutfit, humanMaterial, withOutfitAttributes,
  poseIdle, poseWalk, poseJump, poseSit, blendPose, poseMatrices,
} from './human.js';

export class Figure {
  constructor(look) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // scaled by height
    this.root.add(this.body);
    const { geos, offsets } = bodySegments(2);
    this.offsets = offsets;
    this.joints = {};
    this.meshes = [];
    this.look = { ...look };
    const f = look.fem;
    for (const j of JOINTS) {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      this.joints[j] = g;
      (PARENT[j] ? this.joints[PARENT[j]] : this.body).add(g);
      const geo = geos[j];
      if (geo) {
        const mesh = new THREE.InstancedMesh(withOutfitAttributes(geo, 1), humanMaterial(), 1);
        mesh.setMatrixAt(0, new THREE.Matrix4());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        g.add(mesh);
        this.meshes.push(mesh);
      }
    }
    // attachment points for hats, held items and balloon strings
    this.headTop = new THREE.Object3D();
    this.headTop.position.set(0, 0.98, -0.02);
    this.joints.neck.add(this.headTop);
    this.handR = new THREE.Object3D();
    this.handR.position.set(0.02, -WRIST_DROP - 0.17, -0.02);
    this.joints.elbowR.add(this.handR);
    this.handL = new THREE.Object3D();
    this.handL.position.set(-0.02, -WRIST_DROP - 0.17, -0.02);
    this.joints.elbowL.add(this.handL);
    this.setLook(look);
    this.phase = 0;
    this.stepRate = 0;
    this.state = { move: 0, run: 0, air: 0, fall: 0, sit: 0, hold: 0 };
    this.mats = {};
    this.time = 0;
    this.apply(poseIdle(0), f);
  }

  setLook(look) {
    this.look = { ...look };
    const [A, B] = packOutfit(look);
    for (const m of this.meshes) {
      m.geometry.getAttribute('iColA').array.set(A);
      m.geometry.getAttribute('iColB').array.set(B);
      m.geometry.getAttribute('iColA').needsUpdate = true;
      m.geometry.getAttribute('iColB').needsUpdate = true;
    }
    this.body.scale.setScalar(look.height || 1);
  }

  // set the joint transforms from a pose (matrices relative to parents)
  apply(pose, f) {
    const world = poseMatrices(pose, f, this.offsets, this.mats);
    const inv = new THREE.Matrix4();
    for (const j of JOINTS) {
      const g = this.joints[j];
      const p = PARENT[j];
      if (p) g.matrix.copy(inv.copy(world[p]).invert().multiply(world[j]));
      else g.matrix.copy(world[j]);
      g.matrixWorldNeedsUpdate = true;
    }
  }

  // speed in studs/s; air: off the ground (vy for rising/falling); sit
  update(dt, { speed = 0, onGround = true, vy = 0, sitting = false, holding = false }) {
    this.time += dt;
    const s = this.state;
    const k = (target, cur, rate) => cur + (target - cur) * Math.min(1, rate * dt);
    s.sit = sitting ? 1 : 0;
    s.air = k(onGround || sitting ? 0 : 1, s.air, 14);
    s.move = k(Math.min(1, speed / 3), s.move, 10);
    s.run = k(THREE.MathUtils.smoothstep(speed, 11, 17), s.run, 6);
    s.fall = k(vy < -5 ? 1 : 0, s.fall, 5);
    const f = this.look.fem || 0;
    if (sitting) {
      this.apply(poseSit(false), f);
      return;
    }
    // walk cycle: one cycle per stride (two steps)
    // strides lengthen as we speed up into a run
    const stride = (6.0 + 6.4 * s.run) * (this.look.height || 1);
    if (onGround) this.phase += (dt * speed / stride) * Math.PI * 2;
    this.stepRate = (2 * speed) / stride;
    let pose = blendPose(poseIdle(0, this.time), poseWalk(this.phase, s.run), s.move);
    pose = blendPose(pose, poseJump(s.fall), s.air);
    if (holding) {
      pose.shoulderR = [0.55, 0, 0.1];
      pose.elbowR = [0.9, 0, 0];
    }
    pose.ground = onGround && s.air < 0.5;
    this.apply(pose, f);
  }
}
