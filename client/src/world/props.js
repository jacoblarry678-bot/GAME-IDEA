/**
 * Procedural prop geometry.
 *
 * Every piece of furniture is assembled from primitives and merged into a
 * single BufferGeometry so it can be drawn as one InstancedMesh per kind.
 * Each builder returns { geo, matKind } and is authored at the origin with
 * +Y up and the "front" facing -Z.
 *
 * Replacing these with real GLB models later means changing PROPS[kind] to
 * return loaded geometry — nothing else in the world builder needs to know.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
};

const cyl = (rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
};

const sph = (r, x = 0, y = 0, z = 0, ws = 8, hs = 6) => {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(x, y, z);
  return g;
};

const torus = (r, tube, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, rs = 5, ts = 7) => {
  const g = new THREE.TorusGeometry(r, tube, rs, ts);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
};

const merge = (parts) => {
  const clean = parts.filter(Boolean);
  const g = mergeGeometries(clean, false);
  for (const p of clean) p.dispose();
  g.computeVertexNormals();
  return g;
};

/** A hanging chain: N interlocked links, origin at the top. */
export function chainStrand(links = 14, spacing = 0.17, r = 0.075, tube = 0.022) {
  const parts = [];
  for (let i = 0; i < links; i++) {
    parts.push(torus(r, tube, 0, -i * spacing, 0, Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0, 4, 6));
  }
  return merge(parts);
}

/** A meat hook on a short chain. */
function hook() {
  const parts = [chainStrand(5, 0.16)];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.8, 0),
    new THREE.Vector3(0, -1.15, 0.02),
    new THREE.Vector3(0.13, -1.35, 0.05),
    new THREE.Vector3(0.24, -1.2, 0.02),
    new THREE.Vector3(0.19, -1.03, -0.02),
  ]);
  parts.push(new THREE.TubeGeometry(curve, 14, 0.032, 5, false));
  return merge(parts);
}

export const PROPS = {
  // ---------------------------------------------------------- chain hall
  chain_cluster: () => {
    const parts = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 0.25 + (i % 3) * 0.22;
      const g = chainStrand(8 + (i % 3), 0.28);
      g.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      parts.push(g);
    }
    return { geo: merge(parts), mat: 'chain', hang: true };
  },

  pillar_chain: () => {
    const parts = [
      cyl(0.34, 0.4, 4.6, 8, 0, 2.3, 0),
      cyl(0.5, 0.5, 0.22, 8, 0, 0.11, 0),
      cyl(0.46, 0.5, 0.2, 8, 0, 4.5, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      parts.push(torus(0.42, 0.045, Math.cos(a) * 0.02, 1.2 + i * 0.5, Math.sin(a) * 0.02, Math.PI / 2, 0, 0));
    }
    return { geo: merge(parts), mat: 'iron' };
  },

  hook: () => ({ geo: hook(), mat: 'iron', hang: true }),

  // ---------------------------------------------------------- archives
  bookshelf: () => {
    const parts = [
      box(1.9, 0.08, 0.42, 0, 0.05, 0),
      box(1.9, 0.08, 0.42, 0, 2.35, 0),
      box(0.09, 2.4, 0.42, -0.9, 1.2, 0),
      box(0.09, 2.4, 0.42, 0.9, 1.2, 0),
      box(1.9, 2.4, 0.05, 0, 1.2, 0.2),
    ];
    for (let s = 0; s < 4; s++) {
      const y = 0.42 + s * 0.55;
      parts.push(box(1.75, 0.05, 0.4, 0, y, 0));
      // individual books, leaning and gappy
      let x = -0.83;
      while (x < 0.8) {
        const w = 0.05 + Math.random() * 0.07;
        if (Math.random() > 0.18) {
          const h = 0.24 + Math.random() * 0.18;
          const tilt = Math.random() < 0.12 ? (Math.random() - 0.5) * 0.5 : 0;
          parts.push(box(w, h, 0.28, x + w / 2, y + h / 2 + 0.025, -0.03, 0, 0, tilt));
        }
        x += w + 0.006;
      }
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  book_pile: () => {
    const parts = [];
    let y = 0;
    for (let i = 0; i < 7; i++) {
      const w = 0.24 + Math.random() * 0.12;
      const h = 0.045 + Math.random() * 0.03;
      parts.push(box(w, h, w * 0.72, (Math.random() - 0.5) * 0.06, y + h / 2, (Math.random() - 0.5) * 0.06, 0, Math.random() * 0.6, 0));
      y += h;
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  reading_desk: () => {
    const parts = [
      box(1.5, 0.07, 0.75, 0, 0.78, 0),
      box(1.42, 0.28, 0.68, 0, 0.6, 0),
      box(0.09, 0.75, 0.09, -0.68, 0.375, -0.31),
      box(0.09, 0.75, 0.09, 0.68, 0.375, -0.31),
      box(0.09, 0.75, 0.09, -0.68, 0.375, 0.31),
      box(0.09, 0.75, 0.09, 0.68, 0.375, 0.31),
      box(0.32, 0.02, 0.24, 0.3, 0.82, 0.05, -0.12, 0.4, 0),
    ];
    return { geo: merge(parts), mat: 'wood' };
  },

  ladder: () => {
    const parts = [box(0.07, 2.8, 0.07, -0.24, 1.4, 0), box(0.07, 2.8, 0.07, 0.24, 1.4, 0)];
    for (let i = 0; i < 8; i++) parts.push(box(0.55, 0.045, 0.045, 0, 0.24 + i * 0.34, 0));
    return { geo: merge(parts), mat: 'wood' };
  },

  // ---------------------------------------------------------- torture gallery
  rack: () => {
    const parts = [
      box(2.3, 0.16, 1.0, 0, 0.72, 0),
      box(0.14, 0.72, 0.14, -1.05, 0.36, -0.42),
      box(0.14, 0.72, 0.14, 1.05, 0.36, -0.42),
      box(0.14, 0.72, 0.14, -1.05, 0.36, 0.42),
      box(0.14, 0.72, 0.14, 1.05, 0.36, 0.42),
      cyl(0.16, 0.16, 1.1, 8, -1.18, 0.85, 0, 0, 0, Math.PI / 2),
      cyl(0.16, 0.16, 1.1, 8, 1.18, 0.85, 0, 0, 0, Math.PI / 2),
    ];
    for (let i = 0; i < 6; i++) {
      parts.push(box(0.05, 0.34, 0.05, -1.18 + (i % 3) * 0.02, 0.85, -0.5 + i * 0.2, 0.7, 0, 0));
    }
    parts.push(chainStrand(4, 0.14).translate(-1.0, 0.8, 0.3));
    parts.push(chainStrand(4, 0.14).translate(1.0, 0.8, -0.3));
    return { geo: merge(parts), mat: 'iron' };
  },

  gurney: () => {
    const parts = [
      box(2.0, 0.09, 0.85, 0, 0.86, 0),
      box(1.9, 0.12, 0.78, 0, 0.95, 0),
      box(0.07, 0.82, 0.07, -0.88, 0.43, -0.36),
      box(0.07, 0.82, 0.07, 0.88, 0.43, -0.36),
      box(0.07, 0.82, 0.07, -0.88, 0.43, 0.36),
      box(0.07, 0.82, 0.07, 0.88, 0.43, 0.36),
    ];
    for (const [x, z] of [[-0.88, -0.36], [0.88, -0.36], [-0.88, 0.36], [0.88, 0.36]]) {
      parts.push(cyl(0.11, 0.11, 0.06, 8, x, 0.06, z, 0, 0, Math.PI / 2));
    }
    for (let i = 0; i < 4; i++) parts.push(box(0.5, 0.03, 0.035, 0, 1.02, -0.3 + i * 0.2));
    return { geo: merge(parts), mat: 'iron' };
  },

  wheel: () => {
    const parts = [torus(1.05, 0.09, 0, 1.3, 0, 0, 0, 0, 8, 20), cyl(0.16, 0.16, 0.36, 10, 0, 1.3, 0, 0, 0, Math.PI / 2)];
    for (let i = 0; i < 8; i++) {
      parts.push(box(0.06, 2.0, 0.06, 0, 1.3, 0, 0, 0, (i / 8) * Math.PI));
    }
    parts.push(box(0.28, 1.4, 0.28, 0, 0.7, 0));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push(box(0.05, 0.16, 0.05, Math.cos(a) * 1.05, 1.3 + Math.sin(a) * 1.05, 0.14, 0, 0, a));
    }
    return { geo: merge(parts), mat: 'iron' };
  },

  tool_table: () => {
    const parts = [box(1.3, 0.06, 0.6, 0, 0.85, 0)];
    for (const [x, z] of [[-0.58, -0.24], [0.58, -0.24], [-0.58, 0.24], [0.58, 0.24]]) {
      parts.push(box(0.06, 0.85, 0.06, x, 0.425, z));
    }
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + i * 0.17;
      const kind = i % 3;
      if (kind === 0) parts.push(box(0.03, 0.02, 0.3, x, 0.9, 0, 0, Math.random() * 0.5, 0));
      else if (kind === 1) parts.push(cyl(0.02, 0.03, 0.26, 6, x, 0.9, 0.05, Math.PI / 2, 0, 0));
      else parts.push(box(0.07, 0.03, 0.14, x, 0.9, -0.08));
    }
    return { geo: merge(parts), mat: 'iron' };
  },

  // ---------------------------------------------------------- pipes / boiler
  pipe: () => {
    const parts = [
      cyl(0.13, 0.13, 3.6, 9, 0, 2.4, 0, 0, 0, Math.PI / 2),
      cyl(0.17, 0.17, 0.14, 9, -1.2, 2.4, 0, 0, 0, Math.PI / 2),
      cyl(0.17, 0.17, 0.14, 9, 1.2, 2.4, 0, 0, 0, Math.PI / 2),
      cyl(0.09, 0.09, 0.9, 8, 0.8, 1.95, 0),
      box(0.34, 0.1, 0.34, 0.8, 1.5, 0),
    ];
    return { geo: merge(parts), mat: 'iron' };
  },

  valve: () => {
    const parts = [cyl(0.1, 0.1, 0.5, 8, 0, 1.2, 0), torus(0.3, 0.045, 0, 1.45, 0, Math.PI / 2, 0, 0, 6, 14)];
    for (let i = 0; i < 4; i++) parts.push(box(0.6, 0.045, 0.045, 0, 1.45, 0, 0, (i / 4) * Math.PI, 0));
    return { geo: merge(parts), mat: 'iron' };
  },

  boiler_tank: () => {
    const parts = [
      cyl(0.85, 0.85, 2.6, 12, 0, 1.5, 0),
      sph(0.85, 0, 2.8, 0, 12, 6),
      cyl(0.95, 0.95, 0.2, 12, 0, 0.2, 0),
      cyl(0.14, 0.14, 1.2, 8, 0.7, 3.2, 0),
    ];
    for (let i = 0; i < 3; i++) parts.push(torus(0.88, 0.05, 0, 0.7 + i * 0.8, 0, Math.PI / 2, 0, 0, 5, 14));
    return { geo: merge(parts), mat: 'iron' };
  },

  drain: () => {
    const parts = [cyl(0.42, 0.5, 0.12, 12, 0, 0.06, 0)];
    for (let i = 0; i < 5; i++) parts.push(box(0.72, 0.04, 0.05, 0, 0.12, -0.24 + i * 0.12));
    return { geo: merge(parts), mat: 'iron' };
  },

  // ---------------------------------------------------------- occult
  obelisk: () => {
    const parts = [box(0.9, 0.3, 0.9, 0, 0.15, 0), box(0.7, 0.25, 0.7, 0, 0.42, 0), box(0.5, 3.2, 0.5, 0, 2.15, 0)];
    const tip = new THREE.ConeGeometry(0.36, 0.6, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(0, 4.05, 0);
    parts.push(tip);
    for (let i = 0; i < 8; i++) {
      parts.push(box(0.14, 0.02, 0.02, 0, 1.0 + i * 0.28, 0.255, 0, 0, (i % 2 ? 0.5 : -0.5)));
    }
    return { geo: merge(parts), mat: 'obsidian' };
  },

  statue: () => {
    const parts = [
      box(0.85, 0.35, 0.85, 0, 0.17, 0),
      cyl(0.24, 0.3, 1.05, 8, 0, 0.87, 0), // robed body
      cyl(0.3, 0.24, 0.5, 8, 0, 1.62, 0),
      sph(0.19, 0, 1.98, 0, 8, 6), // head
      cyl(0.08, 0.07, 0.75, 6, -0.28, 1.5, 0.05, 0.3, 0, 0.35),
      cyl(0.08, 0.07, 0.75, 6, 0.28, 1.5, 0.05, 0.3, 0, -0.35),
    ];
    // the hands are wrong, deliberately
    parts.push(sph(0.1, -0.4, 1.16, 0.22, 6, 5), sph(0.1, 0.4, 1.16, 0.22, 6, 5));
    return { geo: merge(parts), mat: 'stone' };
  },

  skull_pile: () => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      const y = 0.11 + Math.floor(i / 4) * 0.19;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      parts.push(sph(0.11, x, y, z, 7, 5));
      parts.push(box(0.13, 0.07, 0.1, x, y - 0.09, z + 0.03));
      parts.push(sph(0.03, x - 0.04, y + 0.02, z + 0.09, 5, 4));
      parts.push(sph(0.03, x + 0.04, y + 0.02, z + 0.09, 5, 4));
    }
    return { geo: merge(parts), mat: 'bone' };
  },

  bone_rack: () => {
    const parts = [box(0.14, 2.4, 0.14, -1.0, 1.2, 0), box(0.14, 2.4, 0.14, 1.0, 1.2, 0)];
    for (let s = 0; s < 4; s++) {
      const y = 0.4 + s * 0.6;
      parts.push(box(2.1, 0.07, 0.4, 0, y, 0));
      for (let i = 0; i < 6; i++) {
        const x = -0.85 + i * 0.34;
        parts.push(sph(0.1, x, y + 0.14, 0, 6, 5));
        parts.push(cyl(0.03, 0.035, 0.3, 5, x, y + 0.1, 0.14, 0, 0, Math.PI / 2));
      }
    }
    return { geo: merge(parts), mat: 'bone' };
  },

  // ---------------------------------------------------------- chapel
  pew: () => {
    const parts = [
      box(2.4, 0.09, 0.42, 0, 0.46, 0),
      box(2.4, 0.62, 0.08, 0, 0.78, -0.2),
      box(0.1, 0.46, 0.4, -1.1, 0.23, 0),
      box(0.1, 0.46, 0.4, 1.1, 0.23, 0),
    ];
    return { geo: merge(parts), mat: 'wood' };
  },

  candelabra: () => {
    const parts = [cyl(0.24, 0.3, 0.1, 8, 0, 0.05, 0), cyl(0.05, 0.06, 1.35, 6, 0, 0.72, 0)];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * 0.28;
      const z = Math.sin(a) * 0.28;
      parts.push(cyl(0.03, 0.03, 0.55, 5, x * 0.6, 1.25, z * 0.6, 0, 0, 0));
      parts.push(cyl(0.035, 0.035, 0.26, 6, x, 1.62, z));
    }
    parts.push(cyl(0.04, 0.04, 0.3, 6, 0, 1.55, 0));
    return { geo: merge(parts), mat: 'iron' };
  },

  brazier_stand: () => {
    const parts = [cyl(0.42, 0.5, 0.12, 10, 0, 0.06, 0)];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      parts.push(cyl(0.05, 0.06, 1.1, 6, Math.cos(a) * 0.15, 0.6, Math.sin(a) * 0.15, Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12));
    }
    parts.push(cyl(0.44, 0.26, 0.36, 12, 0, 1.3, 0));
    parts.push(torus(0.44, 0.04, 0, 1.47, 0, Math.PI / 2, 0, 0, 5, 16));
    return { geo: merge(parts), mat: 'iron' };
  },

  // ---------------------------------------------------------- generic
  crate: () => {
    const parts = [box(0.95, 0.85, 0.95, 0, 0.43, 0)];
    for (const s of [-1, 1]) {
      parts.push(box(1.0, 0.07, 0.07, 0, 0.14, s * 0.48));
      parts.push(box(1.0, 0.07, 0.07, 0, 0.72, s * 0.48));
      parts.push(box(0.07, 0.07, 1.0, s * 0.48, 0.14, 0));
      parts.push(box(0.07, 0.07, 1.0, s * 0.48, 0.72, 0));
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  rubble: () => {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const s = 0.12 + Math.random() * 0.3;
      parts.push(
        box(s, s * 0.7, s * 0.9, (Math.random() - 0.5) * 1.4, s * 0.35, (Math.random() - 0.5) * 1.4,
          Math.random(), Math.random() * 3, Math.random())
      );
    }
    return { geo: merge(parts), mat: 'stone' };
  },

  railing_prop: () => {
    const parts = [box(2.6, 0.09, 0.09, 0, 1.05, 0), box(2.6, 0.06, 0.06, 0, 0.55, 0)];
    for (let i = 0; i < 7; i++) parts.push(cyl(0.03, 0.03, 1.05, 5, -1.2 + i * 0.4, 0.52, 0));
    return { geo: merge(parts), mat: 'iron' };
  },

  // ---------------------------------------------------------- interactives
  container_chest: () => {
    const parts = [box(1.0, 0.6, 0.62, 0, 0.3, 0)];
    const lid = new THREE.CylinderGeometry(0.31, 0.31, 1.0, 10, 1, false, 0, Math.PI);
    lid.rotateZ(Math.PI / 2);
    lid.rotateY(Math.PI / 2);
    lid.translate(0, 0.6, 0);
    parts.push(lid);
    parts.push(box(1.03, 0.06, 0.06, 0, 0.3, 0.32), box(0.1, 0.16, 0.08, 0, 0.42, 0.33));
    for (const s of [-1, 1]) parts.push(box(0.07, 0.62, 0.65, s * 0.36, 0.3, 0));
    return { geo: merge(parts), mat: 'wood' };
  },

  container_cabinet: () => {
    const parts = [box(1.1, 1.85, 0.55, 0, 0.93, 0), box(1.16, 0.09, 0.6, 0, 1.9, 0)];
    for (const s of [-1, 1]) {
      parts.push(box(0.5, 1.6, 0.05, s * 0.27, 0.9, 0.29));
      parts.push(sph(0.045, s * 0.06, 0.95, 0.33, 6, 5));
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  container_desk: () => {
    const parts = [box(1.5, 0.08, 0.75, 0, 0.78, 0), box(0.62, 0.62, 0.7, -0.42, 0.4, 0), box(0.62, 0.62, 0.7, 0.42, 0.4, 0)];
    for (let i = 0; i < 3; i++) {
      parts.push(box(0.55, 0.16, 0.05, -0.42, 0.18 + i * 0.2, 0.36));
      parts.push(box(0.14, 0.03, 0.04, -0.42, 0.18 + i * 0.2, 0.39));
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  container_crate: () => PROPS.crate(),

  locker: () => {
    const parts = [box(0.8, 2.0, 0.55, 0, 1.0, 0), box(0.86, 0.07, 0.6, 0, 2.03, 0)];
    parts.push(box(0.74, 1.86, 0.04, 0, 1.0, 0.28));
    for (let i = 0; i < 4; i++) parts.push(box(0.5, 0.03, 0.03, 0, 1.55 + i * 0.09, 0.31));
    parts.push(box(0.06, 0.2, 0.05, 0.3, 1.05, 0.3));
    return { geo: merge(parts), mat: 'iron' };
  },

  wardrobe: () => {
    const parts = [box(1.25, 2.15, 0.62, 0, 1.07, 0), box(1.35, 0.12, 0.7, 0, 2.2, 0), box(1.32, 0.14, 0.68, 0, 0.07, 0)];
    for (const s of [-1, 1]) {
      parts.push(box(0.58, 1.85, 0.05, s * 0.31, 1.1, 0.32));
      parts.push(box(0.44, 0.6, 0.02, s * 0.31, 1.55, 0.35));
      parts.push(sph(0.05, s * 0.05, 1.1, 0.35, 6, 5));
    }
    return { geo: merge(parts), mat: 'wood' };
  },

  iron_maiden: () => {
    const parts = [
      cyl(0.42, 0.5, 2.0, 8, 0, 1.0, 0),
      cyl(0.3, 0.36, 0.3, 8, 0, 2.1, 0),
      cyl(0.52, 0.56, 0.12, 10, 0, 0.06, 0),
    ];
    for (let i = 0; i < 3; i++) parts.push(torus(0.46, 0.04, 0, 0.4 + i * 0.6, 0, Math.PI / 2, 0, 0, 5, 14));
    parts.push(box(0.04, 1.9, 0.5, 0, 1.0, 0.26));
    parts.push(sph(0.07, 0, 1.75, 0.4, 6, 5));
    return { geo: merge(parts), mat: 'iron' };
  },

  seal: () => {
    const parts = [cyl(0.9, 0.9, 0.16, 20, 0, 1.5, 0.12, Math.PI / 2, 0, 0)];
    for (let i = 0; i < 3; i++) {
      parts.push(torus(0.42 + i * 0.22, 0.035, 0, 1.5, 0.22, 0, 0, 0, 5, 22));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(box(0.07, 0.34, 0.03, Math.cos(a) * 0.66, 1.5 + Math.sin(a) * 0.66, 0.23, 0, 0, a));
    }
    return { geo: merge(parts), mat: 'obsidian' };
  },

  altar: () => {
    const parts = [
      box(3.4, 0.3, 3.4, 0, 0.15, 0),
      box(2.9, 0.25, 2.9, 0, 0.42, 0),
      box(2.2, 0.75, 2.2, 0, 0.92, 0),
      box(2.7, 0.18, 2.7, 0, 1.38, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(box(0.22, 1.5, 0.22, Math.cos(a) * 1.5, 0.75, Math.sin(a) * 1.5));
      parts.push(sph(0.16, Math.cos(a) * 1.5, 1.58, Math.sin(a) * 1.5, 8, 6));
    }
    return { geo: merge(parts), mat: 'obsidian' };
  },

  gate_frame: () => {
    const parts = [
      box(1.0, 8.0, 1.2, -3.4, 4.0, 0),
      box(1.0, 8.0, 1.2, 3.4, 4.0, 0),
      box(7.8, 1.0, 1.2, 0, 8.2, 0),
      box(8.6, 0.5, 1.6, 0, 8.9, 0),
    ];
    for (let i = 0; i < 6; i++) {
      const y = 1.2 + i * 1.2;
      parts.push(box(0.35, 0.35, 1.3, -3.4, y, 0, 0, 0, Math.PI / 4));
      parts.push(box(0.35, 0.35, 1.3, 3.4, y, 0, 0, 0, Math.PI / 4));
    }
    return { geo: merge(parts), mat: 'obsidian' };
  },

  hazard_blades: () => {
    const parts = [box(1.6, 0.14, 0.3, 0, 0.07, 0)];
    for (let i = 0; i < 5; i++) {
      const c = new THREE.ConeGeometry(0.13, 0.62, 4);
      c.translate(-0.6 + i * 0.3, 0.42, 0);
      parts.push(c);
    }
    return { geo: merge(parts), mat: 'iron' };
  },

  hazard_spikes: () => {
    const parts = [];
    for (let i = 0; i < 11; i++) {
      const c = new THREE.ConeGeometry(0.09, 0.5 + Math.random() * 0.3, 5);
      c.translate((Math.random() - 0.5) * 1.7, 0.3, (Math.random() - 0.5) * 1.7);
      parts.push(c);
    }
    return { geo: merge(parts), mat: 'iron' };
  },

  hazard_steam: () => {
    const parts = [cyl(0.14, 0.14, 0.7, 8, 0, 0.35, 0), cyl(0.2, 0.2, 0.12, 8, 0, 0.72, 0)];
    return { geo: merge(parts), mat: 'iron' };
  },
};

/** Doors are built separately because they need a pivot at the hinge. */
export function buildDoor(kind = 'wood') {
  const w = 1.7;
  const h = 3.4;
  const parts = [box(w, h, 0.14, w / 2, h / 2, 0)];
  if (kind === 'wood') {
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++)
        parts.push(box(w * 0.32, h * 0.24, 0.05, w * 0.28 + i * w * 0.44, h * 0.22 + j * h * 0.28, 0.09));
  } else {
    for (let i = 0; i < 4; i++) parts.push(box(w * 0.94, 0.1, 0.06, w / 2, 0.4 + i * 0.85, 0.1));
    for (let i = 0; i < 6; i++) {
      parts.push(sph(0.05, 0.2 + (i % 3) * 0.6, 0.5 + Math.floor(i / 3) * 1.6, 0.11, 6, 5));
    }
  }
  parts.push(cyl(0.05, 0.05, 0.22, 6, w * 0.86, h * 0.45, 0.13, Math.PI / 2, 0, 0));
  return merge(parts);
}

/** Vaultable obstacle — a broken wall / pallet run. */
export function buildVault() {
  const parts = [box(3.6, 1.05, 0.36, 0, 0.52, 0)];
  for (let i = 0; i < 5; i++) {
    parts.push(box(0.55, 0.18 + Math.random() * 0.3, 0.4, -1.4 + i * 0.7, 1.1, 0, 0, 0, (Math.random() - 0.5) * 0.2));
  }
  parts.push(box(3.7, 0.12, 0.45, 0, 1.06, 0));
  return merge(parts);
}
