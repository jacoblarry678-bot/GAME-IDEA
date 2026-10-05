/**
 * Street furniture and beach dressing as instanced meshes, with colliders.
 * Night-time elements (bulbs, light pools, signal lamps) are updated by World.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DISTRICT, mulberry32 } from './district.js';
import { ROAD_GRAPH, signalState, groundHeight, causewayDeck, CURB } from './layout.js';
import { Batcher } from './geo.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.index) return geo.toNonIndexed();
  return geo;
}
function part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1)));
  return colored(g, hex);
}
const merge = (parts) => mergeGeometries(parts, false);

function instanced(geo, mat, list, matrixFn, { shadow = true, colorFn = null } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  const m = new THREE.Matrix4();
  list.forEach((p, i) => {
    matrixFn(p, m, i);
    mesh.setMatrixAt(i, m);
    if (colorFn) mesh.setColorAt(i, new THREE.Color(colorFn(p, i)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

const placed = (p, m, y = null, s = 1) => m.compose(V(p.x, y ?? groundHeight(p.x, p.z, p.bridge ? 50 : 1), p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.rot || 0), V(s, s, s));

export function buildProps(collision, mats) {
  const group = new THREE.Group();
  group.name = 'props';
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const vcMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 });
  const by = (t) => DISTRICT.props.filter((p) => p.type === t);
  const night = { bulbs: null, pools: null, lamps: null, lampList: [] };

  // --- streetlights ----------------------------------------------------------
  const lights = by('streetlight');
  const poleGeo = merge([
    part(new THREE.CylinderGeometry(0.07, 0.11, 7.6, 8), 0x5d6266, 0, 3.8, 0),
    part(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), 0x5d6266, 0, 0.25, 0),
    part(new THREE.BoxGeometry(0.08, 0.08, 2.4), 0x5d6266, 0, 7.45, 1.15),
    part(new THREE.BoxGeometry(0.42, 0.16, 0.8), 0x4a4e52, 0, 7.4, 2.3),
  ]);
  group.add(instanced(poleGeo, vcMetal, lights, (p, m) => placed(p, m)));
  const bulbGeo = new THREE.BoxGeometry(0.34, 0.04, 0.66);
  bulbGeo.translate(0, 7.3, 2.3);
  night.bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0, toneMapped: false });
  group.add(instanced(bulbGeo, night.bulbMat, lights, (p, m) => placed(p, m), { shadow: false }));
  // light pools on the ground under each head (visible at night)
  const poolGeo = new THREE.PlaneGeometry(9, 9);
  poolGeo.rotateX(-Math.PI / 2);
  night.poolMat = new THREE.MeshBasicMaterial({ map: T.radial(), color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pools = instanced(poolGeo, night.poolMat, lights, (p, m) => {
    const fx = Math.sin(p.rot) * 2.4, fz = Math.cos(p.rot) * 2.4;
    const y = groundHeight(p.x + fx, p.z + fz, p.bridge ? 50 : 1) + 0.03;
    m.compose(V(p.x + fx, y, p.z + fz), new THREE.Quaternion(), V(1, 1, 1));
  }, { shadow: false });
  pools.renderOrder = 3;
  group.add(pools);
  for (const p of lights) collision.add({ type: 'circle', cx: p.x, cz: p.z, r: 0.15, y0: groundHeight(p.x, p.z, p.bridge ? 50 : 1) - 0.5, y1: 8, material: 'metal', cameraBlock: false, tag: 'prop' });

  // --- traffic signals ----------------------------------------------------------
  const sigs = by('signal');
  const sigGeo = merge([
    part(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8), 0x2f3336, 0, 2.3, 0),
    part(new THREE.BoxGeometry(0.42, 1.15, 0.42), 0x1f2225, 0, 4.2, 0),
  ]);
  group.add(instanced(sigGeo, vcMetal, sigs, (p, m) => placed(p, m)));
  // four lamp faces per pole: ±z faces show the north–south phase, ±x the east–west phase
  const lampGeo = new THREE.CircleGeometry(0.13, 10);
  for (const p of sigs) {
    for (const [ax, rot, ox, oz] of [['ns', 0, 0, 0.215], ['ns', Math.PI, 0, -0.215], ['ew', Math.PI / 2, 0.215, 0], ['ew', -Math.PI / 2, -0.215, 0]]) {
      night.lampList.push({ node: ROAD_GRAPH.nodes[p.node], axis: ax, x: p.x + ox, z: p.z + oz, rot, y: groundHeight(p.x, p.z) + 4.2 });
    }
  }
  night.lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  night.lamps = instanced(lampGeo, night.lampMat, night.lampList, (l, m) => m.compose(V(l.x, l.y, l.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), l.rot), V(1, 1, 1)), { shadow: false, colorFn: () => 0x222222 });
  group.add(night.lamps);
  for (const p of sigs) collision.add({ type: 'circle', cx: p.x, cz: p.z, r: 0.16, y0: -1, y1: 5, material: 'metal', cameraBlock: false, tag: 'prop' });

  // --- palms -----------------------------------------------------------------
  const palms = by('palm');
  const rnd = mulberry32(99);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.02, 0.35, 0), V(0.08, 0.7, 0), V(0.18, 1, 0)]);
  const trunkGeo = new THREE.TubeGeometry(curve, 10, 0.2, 7, false);
  // taper: shrink the radius toward the top
  {
    const pos = trunkGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const cx = curve.getPoint(Math.min(1, Math.max(0, y))).x;
      const k = 1 - y * 0.45;
      pos.setX(i, cx + (pos.getX(i) - cx) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    trunkGeo.computeVertexNormals();
  }
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 1 });
  const crownParts = [];
  for (let i = 0; i < 11; i++) {
    const g = new THREE.PlaneGeometry(1.7, 3.8, 1, 5);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 1.9; // 0..3.8 from base to tip
      pos.setY(k, y);
      pos.setZ(k, -0.09 * y * y); // droop
    }
    g.rotateX(-Math.PI / 2 + 0.55 + (i % 3) * 0.12);
    g.rotateY((i / 11) * Math.PI * 2 + (i % 2) * 0.2);
    crownParts.push(g);
  }
  const crownGeo = mergeGeometries(crownParts.map((g) => g.toNonIndexed()), false);
  const frondMat = new THREE.MeshStandardMaterial({ map: T.frond(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0xd8e8b0 });
  const palmData = palms.map((p) => {
    const yaw = rnd() * Math.PI * 2;
    const lean = (p.lean || 0) * 0.22;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, -lean, 'YXZ'));
    const base = V(p.x, groundHeight(p.x, p.z, 1), p.z);
    const top = V(0.18, 1, 0).multiply(V(p.h, p.h, p.h)).applyQuaternion(q).add(base);
    return { base, q, h: p.h, top, yaw: rnd() * 6.28, s: 0.85 + rnd() * 0.35 };
  });
  group.add(instanced(trunkGeo, barkMat, palmData, (d, m) => m.compose(d.base, d.q, V(1 + d.h * 0.02, d.h, 1 + d.h * 0.02))));
  const crowns = instanced(crownGeo, frondMat, palmData, (d, m) => m.compose(d.top, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(d.s, d.s, d.s)));
  crowns.userData.sway = palmData;
  group.add(crowns);
  for (const d of palmData) collision.add({ type: 'circle', cx: d.base.x, cz: d.base.z, r: 0.28, y0: d.base.y - 1, y1: d.base.y + d.h, material: 'wood', cameraBlock: false, tag: 'prop' });

  // --- small street furniture -----------------------------------------------------
  const furniture = {
    bench: { geo: merge([part(new THREE.BoxGeometry(1.8, 0.08, 0.45), 0x8a6a4a, 0, 0.45, 0), part(new THREE.BoxGeometry(1.8, 0.45, 0.06), 0x8a6a4a, 0, 0.75, -0.22), part(new THREE.BoxGeometry(0.06, 0.45, 0.4), 0x333333, -0.8, 0.22, 0), part(new THREE.BoxGeometry(0.06, 0.45, 0.4), 0x333333, 0.8, 0.22, 0)]), col: { type: 'box', hx: 0.9, hz: 0.3, y1: 0.9 } },
    bin: { geo: merge([part(new THREE.CylinderGeometry(0.3, 0.27, 0.95, 10), 0x2f5d50, 0, 0.47, 0)]), col: { type: 'circle', r: 0.32, y1: 1 } },
    hydrant: { geo: merge([part(new THREE.CylinderGeometry(0.13, 0.15, 0.6, 8), 0xd8c23a, 0, 0.3, 0), part(new THREE.SphereGeometry(0.14, 8, 6), 0xd8c23a, 0, 0.62, 0), part(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 6), 0xd8c23a, 0, 0.42, 0, 0, 0, Math.PI / 2)]), col: { type: 'circle', r: 0.18, y1: 0.8 } },
    newsbox: { geo: merge([part(new THREE.BoxGeometry(0.5, 1, 0.45), 0x2b56a8, 0, 0.5, 0)]), col: { type: 'box', hx: 0.25, hz: 0.23, y1: 1 } },
    planter: { geo: merge([part(new THREE.BoxGeometry(1.2, 0.55, 1.2), 0xd6cbb6, 0, 0.27, 0), part(new THREE.IcosahedronGeometry(0.65, 1), 0x4f7a3a, 0, 0.85, 0)]), col: { type: 'box', hx: 0.6, hz: 0.6, y1: 1.2 } },
  };
  for (const [type, def] of Object.entries(furniture)) {
    const list = by(type);
    const im = instanced(def.geo, vc, list, (p, m) => placed(p, m));
    group.add(im);
    // small furniture gets knocked over by cars (see World.breakProp); planters are too heavy
    const breakable = type !== 'planter';
    list.forEach((p, index) => collision.add({ ...def.col, cx: p.x, cz: p.z, angle: p.rot || 0, y0: -1, y1: CURB + def.col.y1, material: type === 'bench' ? 'wood' : 'metal', cameraBlock: false, tag: 'prop', data: breakable ? { breakable: true, mesh: im, index, type } : null }));
  }

  // --- beach --------------------------------------------------------------------
  const umbrellas = by('umbrella');
  const umbPole = merge([part(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), 0xeeeeee, 0, 1.15, 0)]);
  group.add(instanced(umbPole, vc, umbrellas, (p, m) => placed(p, m), { shadow: false }));
  const canopy = new THREE.ConeGeometry(1.25, 0.45, 10, 1, true);
  canopy.translate(0, 2.25, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  group.add(instanced(canopy, canopyMat, umbrellas, (p, m) => placed(p, m), { colorFn: (p, i) => (i % 5 === 0 ? 0xffffff : p.color) }));
  const loungers = by('lounger');
  const loungerGeo = merge([part(new THREE.BoxGeometry(0.62, 0.06, 1.3), 0xf4f1ea, 0, 0.3, 0.2), part(new THREE.BoxGeometry(0.62, 0.06, 0.7), 0xf4f1ea, 0, 0.5, -0.65, -0.6, 0, 0), part(new THREE.BoxGeometry(0.6, 0.28, 0.06), 0xcfcfcf, 0, 0.14, 0.75), part(new THREE.BoxGeometry(0.6, 0.28, 0.06), 0xcfcfcf, 0, 0.14, -0.3)]);
  group.add(instanced(loungerGeo, vc, loungers, (p, m) => placed(p, m)));
  const loungerMesh = group.children[group.children.length - 1];
  loungers.forEach((p, index) => collision.add({ type: 'box', cx: p.x, cz: p.z, hx: 0.32, hz: 0.75, angle: p.rot, y0: -2, y1: groundHeight(p.x, p.z) + 0.55, tag: 'prop', cameraBlock: false, material: 'wood', data: { breakable: true, mesh: loungerMesh, index, type: 'lounger' } }));

  // lifeguard towers, docks, boats, barriers etc. are few: batch them
  const Bt = new Batcher();
  for (const p of by('lifeguard')) lifeguardTower(Bt, p, collision);
  for (const p of by('dock')) {
    const y = 0.1;
    Bt.box('wood', p.x - p.len / 2, p.x + p.len / 2, y - 0.25, y, p.z - 1.5, p.z + 1.5, { tile: [3, 3], topTile: 3 });
    for (let x = p.x - p.len / 2 + 1; x < p.x + p.len / 2; x += 4) for (const s of [-1.3, 1.3]) Bt.box('wood', x - 0.15, x + 0.15, -4.3, y, p.z + s - 0.15, p.z + s + 0.15, { tile: [1, 1] });
  }
  for (const p of by('boat')) boat(Bt, p, collision);
  for (const p of by('barrier')) {
    const g = new THREE.BoxGeometry(2.3, 0.85, 0.55);
    Bt.geometry('trim', g, new THREE.Matrix4().compose(V(p.x, 0.43, p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.rot), V(1, 1, 1)), new THREE.Color(0xe8e4dc));
    collision.add({ type: 'box', cx: p.x, cz: p.z, hx: 1.15, hz: 0.28, angle: p.rot, y0: -1, y1: 0.9, material: 'concrete', tag: 'prop' });
  }
  for (const p of by('volley')) {
    for (const s of [-4.5, 4.5]) Bt.box('metal', p.x - 0.05, p.x + 0.05, groundHeight(p.x, p.z) - 0.3, 2.4, p.z + s - 0.05, p.z + s + 0.05, { color: new THREE.Color(0xdddddd) });
    Bt.box('trim', p.x - 0.01, p.x + 0.01, 1.6, 2.4, p.z - 4.5, p.z + 4.5, { color: new THREE.Color(0x222222) });
  }
  for (const p of by('gym')) {
    for (let k = 0; k < 4; k++) {
      const z = p.z - 6 + k * 4;
      for (const s of [-0.8, 0.8]) Bt.box('metal', p.x - 0.05, p.x + 0.05, CURB, CURB + 2.4, z + s - 0.05, z + s + 0.05, { color: new THREE.Color(0x3b78c4) });
      Bt.box('metal', p.x - 0.04, p.x + 0.04, CURB + 2.3, CURB + 2.38, z - 0.8, z + 0.8, { color: new THREE.Color(0xcccccc) });
      collision.add({ type: 'box', cx: p.x, cz: z, hx: 0.1, hz: 0.85, y0: -1, y1: 2.5, cameraBlock: false, tag: 'prop' });
    }
    Bt.flat('trim', p.x - 3, p.x + 3, p.z - 8, p.z + 8, CURB + 0.02, 1, new THREE.Color(0x4a8f5a));
  }
  for (const p of by('pylonSign')) {
    Bt.box('metal', p.x - 0.15, p.x + 0.15, CURB, CURB + 7, p.z - 0.15, p.z + 0.15, { color: new THREE.Color(0x777777) });
    collision.add({ type: 'circle', cx: p.x, cz: p.z, r: 0.2, y0: -1, y1: 8, tag: 'prop', cameraBlock: false });
    const t = T.signTexture(p.text, { fg: '#e8fbff', neon: '#29e6ff', bg: '#1d2b44' });
    const s = new THREE.Mesh(new THREE.BoxGeometry(5, 5 / t.userData.aspect, 0.3), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    s.position.set(p.x, CURB + 7 + 0.6, p.z); s.rotation.y = Math.PI / 2;
    s.userData.neonSign = true;
    group.add(s); night.pylons = (night.pylons || []).concat(s);
  }
  for (const p of by('roadSign')) {
    const t = T.signTexture(p.text, { fg: '#111111', bg: '#f39a1e', font: '700 44px Arial' });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7 / t.userData.aspect), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }));
    s.position.set(p.x, 2.2, p.z + 8); s.rotation.y = Math.PI / 2;
    group.add(s);
    for (const dz of [-3, 3]) Bt.box('metal', p.x - 0.05, p.x + 0.05, 0, 2, p.z + 8 + dz - 0.05, p.z + 8 + dz + 0.05, { color: new THREE.Color(0x777777) });
  }
  for (const m of Bt.build((k) => (mats[k] || mats.trim))) group.add(m);

  return { group, night, crowns };
}

function lifeguardTower(B, p, cw) {
  const y = groundHeight(p.x, p.z);
  const c = new THREE.Color(p.color);
  const w = new THREE.Color(0xf4f1ea);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('trim', p.x + dx * 1.1 - 0.08, p.x + dx * 1.1 + 0.08, y - 0.5, y + 1.6, p.z + dz * 1.1 - 0.08, p.z + dz * 1.1 + 0.08, { color: w });
  B.box('trim', p.x - 1.6, p.x + 1.6, y + 1.6, y + 1.75, p.z - 1.6, p.z + 1.6, { color: w });
  B.box('trim', p.x - 1.2, p.x + 1.2, y + 1.75, y + 3.6, p.z - 1.2, p.z + 1.2, { color: c });
  B.box('trim', p.x - 1.5, p.x + 1.5, y + 3.6, y + 3.85, p.z - 1.5, p.z + 1.5, { color: w });
  B.box('glass', p.x - 1.22, p.x + 1.22, y + 2.5, y + 3.3, p.z - 0.8, p.z + 0.8, { sides: { top: false } });
  // ramp down to the sand on the town side
  B.quad('wood', [[p.x - 1.6, y + 1.7, p.z - 0.5], [p.x - 1.6, y + 1.7, p.z + 0.5], [p.x - 5, y, p.z + 0.5], [p.x - 5, y, p.z - 0.5]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  cw.add({ type: 'box', cx: p.x, cz: p.z, hx: 1.6, hz: 1.6, y0: y - 1, y1: y + 3.9, material: 'wood', tag: 'prop' });
}

function boat(B, p, cw) {
  const shape = new THREE.Shape();
  shape.moveTo(-1.2, -4); shape.lineTo(1.2, -4); shape.lineTo(1.3, 2); shape.quadraticCurveTo(0.8, 4.4, 0, 5); shape.quadraticCurveTo(-0.8, 4.4, -1.3, 2); shape.closePath();
  const hull = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
  hull.rotateX(Math.PI / 2);
  hull.translate(0, 0.9 - 0.45, 0);
  const m = new THREE.Matrix4().compose(V(p.x, -0.45, p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.rot), V(1, 1, 1));
  B.geometry('trim', hull, m, new THREE.Color(p.color));
  const cabin = new THREE.BoxGeometry(1.8, 0.9, 2.2);
  cabin.translate(0, 1.3, -0.4);
  B.geometry('trim', cabin, m, new THREE.Color(0xf4f4f4));
  cw.add({ type: 'box', cx: p.x, cz: p.z, hx: 1.3, hz: 4.5, angle: p.rot, y0: -2, y1: 1.6, material: 'wood', tag: 'prop' });
}

/** Per-frame updates for night lighting and signal lamps. */
export function updateProps(props, night, t, dt) {
  const n = props.night;
  n.bulbMat.color.setScalar(0.55 + night * 2.2).multiply(new THREE.Color(0xfff2d0));
  n.poolMat.opacity = night * 0.42;
  n.poolMat.visible = night > 0.02;
  if (n.pylons) for (const s of n.pylons) s.material.emissiveIntensity = 0.3 + night * 1.6;
  // signal lamps refresh four times a second
  n.acc = (n.acc || 0) + dt;
  if (n.acc > 0.25) {
    n.acc = 0;
    const col = new THREE.Color();
    const boost = 1.6 + night * 1.5;
    n.lampList.forEach((l, i) => {
      const s = signalState(l.node, l.axis, t);
      col.setHex(s === 'green' ? 0x2dff8a : s === 'yellow' ? 0xffc21a : 0xff2a2a).multiplyScalar(boost);
      n.lamps.setColorAt(i, col);
    });
    n.lamps.instanceColor.needsUpdate = true;
  }
  void causewayDeck;
}
