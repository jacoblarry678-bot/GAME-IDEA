/**
 * Palms: coconut palms (curved, ring-scarred trunks, a full drooping crown with a few dead
 * fronds hanging below and a cluster of coconuts) on the beach and promenade, and royal
 * palms (straight smooth grey trunks, a glossy green crownshaft) along the avenues.
 *
 * Every frond is a real strip of geometry that arches out and droops under its own weight,
 * folded into a V along the rachis, textured with an alpha-cut leaflet atlas so the sun
 * throws dappled shadows through it. Foliage normals are "bent" outward from the crown
 * and not flipped on back faces, which gives the soft, light-through-leaves look instead
 * of black undersides.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/**
 * A trunk along a gentle curve in the x–y plane (meters, reference size). UV u runs
 * around the trunk, v along it in units of `texLen` meters so the bark rings stay
 * the same size whatever the height.
 */
function trunkGeometry({ height, bend, r0, r1, flare = 0, swell = 0, radial = 8, segs = 11, texLen = 3 }) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = height * t, x = bend * t * t;
    const tx = 2 * bend * t, ty = height, tl = Math.hypot(tx, ty);
    const Tx = tx / tl, Ty = ty / tl;
    let r = r0 + (r1 - r0) * t;
    r *= 1 + flare * Math.exp(-y / 0.45) + swell * Math.sin(Math.PI * Math.min(1, t * 1.15));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = Ty * ca, ny = -Tx * ca, nz = sa;
      pos.push(x + nx * r, y + ny * r, nz * r);
      nor.push(nx, ny, nz);
      uv.push(j / radial, y / texLen);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const top = V(bend, height, 0);
  const tangent = V(2 * bend, height, 0).normalize();
  return { geo: g, top, tangent };
}

/**
 * One frond: starts at the crown centre, leaves at `elev` radians above horizontal toward
 * azimuth `az`, and bends down by `droop` radians along its length (more toward the tip).
 */
function frond({ len, width, elev, droop, az, dead = false, fold = 0.55, segs = 5, twist = 0 }) {
  const dir = V(Math.cos(az), 0, Math.sin(az));
  const side = V(-Math.sin(az), 0, Math.cos(az));
  const pos = [], nor = [], uv = [], idx = [];
  const cross = [-1, -0.45, 0, 0.45, 1];
  const P = V(0, 0, 0), D = V(), U = V(), S = V(), n = V(), q = new THREE.Quaternion();
  const step = len / segs;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const th = elev - droop * Math.pow(t, 1.5);
    D.copy(dir).multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
    // the leaf twists a little about the rachis toward the tip
    q.setFromAxisAngle(D, twist * t);
    S.copy(side).applyQuaternion(q);
    U.crossVectors(S, D).normalize();
    if (U.y < 0) U.negate();
    // narrow at the petiole, widest a third of the way out, tapering to the tip
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.94)), 0.75) * (t < 0.12 ? t / 0.12 : 1);
    for (const o of cross) {
      const sag = Math.pow(Math.abs(o), 1.3) * fold * w;
      const x = P.x + S.x * o * w - U.x * sag, y = P.y + S.y * o * w - U.y * sag, z = P.z + S.z * o * w - U.z * sag;
      pos.push(x, y, z);
      // bent normal: the leaf's up, pushed outward from the crown and skyward
      n.set(x, y * 0.4 + 0.6, z).normalize().multiplyScalar(0.55).addScaledVector(U, 0.45).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push((o * 0.5 + 0.5) * 0.5 + (dead ? 0.5 : 0), t);
    }
    if (i < segs) P.addScaledVector(D, step);
  }
  const row = cross.length;
  for (let i = 0; i < segs; i++) for (let j = 0; j < row - 1; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function coconutCrown(seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  let az = r() * 6.28;
  const add = (o) => { parts.push(frond({ ...o, az })); az += GOLDEN + (r() - 0.5) * 0.3; };
  for (let i = 0; i < 3; i++) add({ len: 2.4 + r() * 0.6, width: 0.7, elev: 1.05 + r() * 0.25, droop: 0.4, twist: 0.2 });
  for (let i = 0; i < 8; i++) add({ len: 4 + r() * 0.8, width: 1.05, elev: 0.35 + r() * 0.4, droop: 1.25 + r() * 0.35, twist: (r() - 0.5) * 0.8 });
  for (let i = 0; i < 5; i++) add({ len: 3.8 + r() * 0.6, width: 0.95, elev: -0.05 + r() * 0.25, droop: 1.3 + r() * 0.3, twist: (r() - 0.5) * 0.8 });
  for (let i = 0; i < 2; i++) add({ len: 3 + r() * 0.5, width: 0.7, elev: -1.05 - r() * 0.25, droop: 0.25, dead: true, fold: 0.8 });
  return mergeGeometries(parts, false);
}

function royalCrown(seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  let az = r() * 6.28;
  for (let i = 0; i < 13; i++) {
    const upper = i < 4;
    parts.push(frond({ len: upper ? 3.4 + r() * 0.6 : 4.4 + r() * 0.7, width: 1.05, elev: upper ? 1.0 + r() * 0.3 : 0.25 + r() * 0.45, droop: upper ? 0.7 : 1.45 + r() * 0.3, az, fold: 0.7, twist: (r() - 0.5) * 1.2 }));
    az += GOLDEN + (r() - 0.5) * 0.3;
  }
  return mergeGeometries(parts, false);
}

function coconutCluster() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + (i % 2) * 0.4, rr = 0.2 + (i % 3) * 0.04;
    const g = new THREE.SphereGeometry(0.13 + (i % 2) * 0.02, 8, 6).toNonIndexed();
    g.deleteAttribute('uv');
    g.scale(1, 1.15, 1);
    g.translate(Math.cos(a) * rr, -0.18 - (i % 3) * 0.1, Math.sin(a) * rr);
    const c = new THREE.Color(i % 3 === 0 ? 0x8a6a34 : 0x6d7f2c);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

/** Foliage material: alpha-cut leaflets, double sided, normals never flipped on the back face. */
function foliageMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: T.frondLeaf(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.72, metalness: 0, color: 0xf4ffe6 });
  m.onBeforeCompile = (sh) => {
    // keep the bent normal on both faces, but never let it face away from the viewer (that
    // would read as a grazing angle and turn the leaf into a mirror of the sky)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '{ vec3 vd = normalize( vViewPosition ); float d = dot( normal, vd ); if ( d < 0.15 ) normal = normalize( normal + vd * ( 0.15 - d ) ); }'));
    // leaves are matte and waxy, not mirrors: cap the grazing-angle reflectance
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.specularF90 = 0.12;');
    // a little light comes through the leaves: add some of the sun-facing diffuse to the dark side
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06;');
  };
  m.customProgramCacheKey = () => 'palm-foliage';
  return m;
}

function barkMaterial(kind) {
  const b = T.palmBark(kind);
  return new THREE.MeshStandardMaterial({ map: b.map, normalMap: b.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: b.orm, aoMap: b.orm, roughness: 1, metalness: 0 });
}

/**
 * Build every palm. `instanced(geo, mat, list, matrixFn, opts)` is the shared instancing
 * helper from props.js. Returns the crown meshes; each carries `userData.sway`, a list of
 * `{ top, q, s }` that World uses to sway them in the breeze.
 */
export function buildPalms(list, group, collision, groundHeight, instanced, rnd) {
  const crowns = [];
  const foliage = foliageMaterial();
  const coco = list.filter((p) => p.species !== 'royal');
  const royal = list.filter((p) => p.species === 'royal');

  // --- coconut palms: three trunk shapes from nearly straight to a strong beach lean
  const REF = 10;
  const shapes = [0.5, 1.6, 3.0].map((bend) => trunkGeometry({ height: REF, bend, r0: 0.2, r1: 0.14, flare: 0.55 }));
  const cocoBark = barkMaterial('coconut');
  const cocoData = coco.map((p) => {
    const shape = (p.lean || 0) < 0.35 ? 0 : (p.lean || 0) < 0.75 ? 1 : 2;
    const s = p.h / REF;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI * 2);
    const base = V(p.x, groundHeight(p.x, p.z, 1) - 0.05, p.z);
    const S = shapes[shape];
    const top = S.top.clone().multiplyScalar(s).applyQuaternion(q).add(base);
    // the crown tips partway toward the trunk's lean
    const tilt = Math.atan2(S.tangent.x, S.tangent.y) * 0.55;
    const cq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -tilt)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6.28));
    return { p, shape, s, q, base, top, cq, cs: 0.85 + rnd() * 0.3, crown: Math.floor(rnd() * 3) };
  });
  shapes.forEach((S, k) => {
    const mine = cocoData.filter((d) => d.shape === k);
    if (mine.length) group.add(instanced(S.geo, cocoBark, mine, (d, m) => m.compose(d.base, d.q, V(d.s, d.s, d.s))));
  });
  // three crown variants so neighbouring palms don't look cloned
  for (let k = 0; k < 3; k++) {
    const mine = cocoData.filter((d) => d.crown === k);
    if (!mine.length) continue;
    const sway = mine.map((d) => ({ top: d.top, q: d.cq, s: d.cs }));
    const mesh = instanced(coconutCrown(1234 + k * 977), foliage, sway, (d, m) => m.compose(d.top, d.q, V(d.s, d.s, d.s)));
    mesh.userData.sway = sway; mesh.userData.noAO = true;
    group.add(mesh); crowns.push(mesh);
  }
  const nutMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  group.add(instanced(coconutCluster(), nutMat, cocoData, (d, m) => m.compose(d.top, d.cq, V(d.cs, d.cs, d.cs))));

  // --- royal palms: straight, smooth, a slight swelling partway up, a green crownshaft
  if (royal.length) {
    const R = trunkGeometry({ height: REF, bend: 0.05, r0: 0.26, r1: 0.2, flare: 0.3, swell: 0.12, texLen: 4 });
    const shaftH = 1.9;
    const shaft = new THREE.CylinderGeometry(0.16, 0.21, shaftH, 12, 1, false).translate(0, shaftH / 2, 0);
    const shaftMat = new THREE.MeshPhysicalMaterial({ color: 0x5f8a3a, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35 });
    const royalData = royal.map((p) => {
      const s = (p.h * 1.15) / REF;
      const q = new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI * 2);
      const base = V(p.x, groundHeight(p.x, p.z, 1) - 0.05, p.z);
      const shaftBase = R.top.clone().multiplyScalar(s).applyQuaternion(q).add(base);
      const top = shaftBase.clone().add(V(0, shaftH * s, 0));
      const cq = new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6.28);
      return { p, s, q, base, shaftBase, top, cq, cs: 0.9 + rnd() * 0.2, crown: Math.floor(rnd() * 2) };
    });
    group.add(instanced(R.geo, barkMaterial('royal'), royalData, (d, m) => m.compose(d.base, d.q, V(d.s, d.s, d.s))));
    group.add(instanced(shaft, shaftMat, royalData, (d, m) => m.compose(d.shaftBase, d.q, V(d.s, d.s, d.s))));
    for (let k = 0; k < 2; k++) {
      const mine = royalData.filter((d) => d.crown === k);
      if (!mine.length) continue;
      const sway = mine.map((d) => ({ top: d.top, q: d.cq, s: d.cs }));
      const mesh = instanced(royalCrown(4321 + k * 613), foliage, sway, (d, m) => m.compose(d.top, d.q, V(d.s, d.s, d.s)));
      mesh.userData.sway = sway; mesh.userData.noAO = true;
      group.add(mesh); crowns.push(mesh);
    }
    for (const d of royalData) collision.add({ type: 'circle', cx: d.base.x, cz: d.base.z, r: 0.32, y0: d.base.y - 1, y1: d.top.y, material: 'wood', cameraBlock: false, tag: 'prop' });
  }
  for (const d of cocoData) collision.add({ type: 'circle', cx: d.base.x, cz: d.base.z, r: 0.28, y0: d.base.y - 1, y1: d.base.y + d.p.h, material: 'wood', cameraBlock: false, tag: 'prop' });
  return crowns;
}

/** Sway every crown a little; cheap enough to run ten times a second. */
export function swayPalms(crowns, t) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  for (const mesh of crowns) {
    mesh.userData.sway.forEach((d, i) => {
      e.set(Math.sin(t * 0.9 + i) * 0.045, Math.sin(t * 0.5 + i * 0.7) * 0.05, Math.cos(t * 0.8 + i * 1.3) * 0.045);
      q.copy(d.q).multiply(new THREE.Quaternion().setFromEuler(e));
      m.compose(d.top, q, s.set(d.s, d.s, d.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
}
