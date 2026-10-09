// Draws many people at once: every pose (walk-cycle frames and a few idle
// stances) is a baked body drawn with instancing, in a near and a far
// level of detail, each person colored by their own outfit.
import * as THREE from 'three';
import { bakePose, poseWalk, poseIdle, outfit, packOutfit, humanMaterial, withOutfitAttributes } from './human.js';

export const WALK_FRAMES = 16;
export const IDLE_KINDS = 4;
const NEAR = 70; // studs: closer people get the detailed body

const looks = new Map();
// A guest's outfit by seed (cached), packed for the shader.
export function lookFor(seed) {
  let l = looks.get(seed);
  if (!l) {
    const o = outfit(seed);
    const [A, B] = packOutfit(o);
    l = { o, A, B };
    looks.set(seed, l);
  }
  return l;
}

class Batch {
  constructor(scene, geo, capacity) {
    this.capacity = capacity;
    this.geo = withOutfitAttributes(geo, capacity);
    this.mesh = new THREE.InstancedMesh(this.geo, humanMaterial(), capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.a = this.geo.getAttribute('iColA');
    this.b = this.geo.getAttribute('iColB');
    this.used = 0;
    scene.add(this.mesh);
  }
}

export class CrowdRenderer {
  constructor(scene, { walkCapacity = 160, idleCapacity = 700, shadows = true } = {}) {
    this.batches = { walk: [[], []], idle: [[], []] };
    for (const lod of [0, 1]) {
      for (let f = 0; f < WALK_FRAMES; f++) {
        this.batches.walk[lod].push(new Batch(scene, bakePose(poseWalk((f / WALK_FRAMES) * Math.PI * 2), lod), walkCapacity));
      }
      for (let k = 0; k < IDLE_KINDS; k++) {
        this.batches.idle[lod].push(new Batch(scene, bakePose(poseIdle(k), lod), idleCapacity));
      }
    }
    this.all = [...this.batches.walk[0], ...this.batches.walk[1], ...this.batches.idle[0], ...this.batches.idle[1]];
    for (const b of this.all) b.mesh.castShadow = shadows;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.cam = new THREE.Vector3();
  }

  setShadows(on) {
    for (const b of this.all) b.mesh.castShadow = on;
  }

  begin(camPos) {
    this.cam.copy(camPos);
    for (const b of this.all) b.used = 0;
  }

  // kind: 'walk' (frame = walk phase 0..1) or 'idle' (frame = stance)
  add(kind, frame, x, y, z, yaw, seed) {
    const near = (x - this.cam.x) ** 2 + (z - this.cam.z) ** 2 < NEAR * NEAR ? 1 : 0;
    const list = this.batches[kind][near];
    const idx = kind === 'walk' ? Math.floor(((frame % 1) + 1) % 1 * WALK_FRAMES) % WALK_FRAMES : frame % IDLE_KINDS;
    const b = list[idx];
    if (b.used >= b.capacity) return;
    const look = lookFor(seed);
    this.q.setFromAxisAngle(this.up, yaw);
    this.p.set(x, y, z);
    this.s.set(look.o.width, look.o.height, look.o.width);
    this.m.compose(this.p, this.q, this.s);
    const i = b.used++;
    b.mesh.setMatrixAt(i, this.m);
    b.a.array.set(look.A, i * 4);
    b.b.array.set(look.B, i * 4);
  }

  end() {
    for (const b of this.all) {
      b.mesh.count = b.used;
      if (b.used) {
        b.mesh.instanceMatrix.needsUpdate = true;
        b.a.needsUpdate = true;
        b.b.needsUpdate = true;
      }
    }
  }
}

// how far one walk cycle (two steps) carries a person, by height
export function strideLength(seed) {
  return 5.2 * lookFor(seed).o.height;
}
