// Physical queue lines (built by the Roblox park builder, see
// src/shared/QueueLine.luau): the path through each ride's switchback maze,
// the guests standing in line, and helpers for walking the player along it.
import * as THREE from 'three';
import { buildModel } from './geom.js';

const FLOOR = 0.55; // top of the queue floor
const WALK = 7; // how fast guests shuffle forward (studs/s)

export class QueuePath {
  constructor(q) {
    this.pts = [];
    for (let i = 0; i < q.points.length; i += 2) this.pts.push({ x: q.points[i], z: q.points[i + 1] });
    this.cum = q.cum;
    this.length = q.length;
    this.signAt = q.signAt;
    this.gate = { x: q.gate[0], z: q.gate[1] };
  }

  // position `s` studs back from the gate and the direction toward the front
  pointAt(s, out = { x: 0, z: 0, fx: 0, fz: 1 }) {
    const { pts, cum } = this;
    s = Math.min(Math.max(s, 0), this.length);
    let i = 1;
    while (i < pts.length - 1 && s > cum[i]) i++;
    const a = pts[i - 1], b = pts[i];
    const seg = cum[i] - cum[i - 1];
    const u = seg > 0 ? Math.min(1, Math.max(0, (s - cum[i - 1]) / seg)) : 0;
    out.x = a.x + (b.x - a.x) * u;
    out.z = a.z + (b.z - a.z) * u;
    const len = Math.hypot(a.x - b.x, a.z - b.z) || 1;
    out.fx = (a.x - b.x) / len;
    out.fz = (a.z - b.z) / len;
    return out;
  }

  // closest point on the path: distance along it and distance away
  project(x, z) {
    const { pts, cum } = this;
    let bestS = 0, bestD = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const vx = b.x - a.x, vz = b.z - a.z;
      const l2 = vx * vx + vz * vz;
      const u = l2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / l2)) : 0;
      const d = Math.hypot(x - (a.x + vx * u), z - (a.z + vz * u));
      if (d < bestD) {
        bestD = d;
        bestS = cum[i - 1] + (cum[i] - cum[i - 1]) * u;
      }
    }
    return { s: bestS, d: bestD };
  }

  // Next point to walk to when going from distance s0 to s1 along the path
  // (the next bend in between, or the destination itself).
  nextWaypoint(s0, s1) {
    const { cum } = this;
    if (s1 < s0) {
      for (let i = cum.length - 1; i >= 0; i--) if (cum[i] < s0 - 0.05 && cum[i] > s1) return { ...this.pointAt(cum[i]), final: false };
    } else {
      for (let i = 0; i < cum.length; i++) if (cum[i] > s0 + 0.05 && cum[i] < s1) return { ...this.pointAt(cum[i]), final: false };
    }
    return { ...this.pointAt(s1), final: true };
  }
}

export function slotAt(index, spacing) {
  return index * spacing; // index 0 = next to board
}

// Guests standing in every line, drawn with one instanced mesh per figure.
export class QueueCrowd {
  constructor(scene, data, paths) {
    this.paths = paths;
    this.spacing = data.queue.spacing;
    this.variants = data.guests.filter((g) => g.pose === 'stand').map((g) => {
      const model = buildModel(g.parts, data.materials, { detail: false });
      const meshes = model.children.map((m) => {
        const inst = new THREE.InstancedMesh(m.geometry, m.material, 160);
        inst.frustumCulled = false;
        inst.count = 0;
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(inst);
        return inst;
      });
      return { meshes, used: 0 };
    });
    this.visual = new Map(); // entry id -> { s, walking }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.pt = { x: 0, z: 0, fx: 0, fz: 1 };
  }

  variantOf(seed) {
    return (Math.abs(Math.imul(seed | 0, 2654435761)) >>> 0) % this.variants.length;
  }

  // rides: sim ride states; cam: camera position; first: snap everyone in place
  update(dt, time, rides, cam, first) {
    for (const v of this.variants) v.used = 0;
    const seen = new Set();
    for (const st of rides) {
      const path = this.paths.get(st.id);
      if (!path) continue;
      const near = Math.hypot(path.gate.x - cam.x, path.gate.z - cam.z) < 420;
      st.queue.forEach((e, index) => {
        if (e.player) return;
        seen.add(e.id);
        const target = slotAt(index, this.spacing);
        let v = this.visual.get(e.id);
        if (!v) {
          // newcomers walk in from outside the entrance sign
          const start = first ? target : Math.max(target, Math.min(path.length, path.signAt + 4));
          v = { s: start, walking: false };
          this.visual.set(e.id, v);
        }
        const gap = target - v.s;
        const stepMax = WALK * dt;
        v.walking = Math.abs(gap) > 0.05;
        v.s += Math.max(-stepMax, Math.min(stepMax, gap));
        if (!near) return;
        const variant = this.variants[this.variantOf(e.seed)];
        if (variant.used >= variant.meshes[0].instanceMatrix.count) return;
        path.pointAt(v.s, this.pt);
        const bob = v.walking ? Math.abs(Math.sin(time * 9 + e.seed)) * 0.35 : 0;
        // idle guests glance around now and then
        const look = v.walking ? 0 : Math.sin(time * 0.6 + (e.seed % 97)) * 0.5;
        const yaw = Math.atan2(-this.pt.fx, -this.pt.fz) + look;
        this.q.setFromAxisAngle(this.up, yaw);
        this.p.set(this.pt.x, FLOOR + 2.8 + bob, this.pt.z);
        this.m.compose(this.p, this.q, this.one);
        for (const mesh of variant.meshes) mesh.setMatrixAt(variant.used, this.m);
        variant.used++;
      });
    }
    for (const id of this.visual.keys()) if (!seen.has(id)) this.visual.delete(id);
    for (const v of this.variants) {
      for (const mesh of v.meshes) {
        mesh.count = v.used;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
