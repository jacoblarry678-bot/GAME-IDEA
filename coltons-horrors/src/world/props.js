// Interactive props (generators, hooks, pallets, gates, chests, hatch, CRT screens) and their meshes.
import * as THREE from 'three';
import { metalTexture, planksTexture, concreteTexture, glowSpriteTexture, makeStaticCanvas, rubberTexture } from './textures.js';
import { boxGeo, cylGeo } from './batch.js';

const matCache = new Map();
function M(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
export function clearPropMaterials() { matCache.clear(); }

export const mats = {
  genPaint: () => M('genPaint', () => { const t = metalTexture('#7a6a2a', 'gen'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 0.55, roughness: 0.7 }); }),
  darkMetal: () => M('darkMetal', () => { const t = metalTexture('#2e2e2c', 'dark'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 0.7, roughness: 0.6 }); }),
  rust: () => M('rust', () => { const t = metalTexture('#5a3020', 'rust'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 0.5, roughness: 0.8 }); }),
  redTank: () => M('redTank', () => { const t = metalTexture('#7a1c14', 'tank'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 0.5, roughness: 0.6 }); }),
  palletWood: () => M('palletWood', () => { const t = planksTexture('#8a7050', 'pallet'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.9 }); }),
  oldWood: () => M('oldWood', () => { const t = planksTexture('#4a3a2a', 'old'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95 }); }),
  concrete: () => M('concrete', () => { const t = concreteTexture('#6a675f'); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95 }); }),
  rubber: () => M('rubber', () => { const t = rubberTexture(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95 }); }),
  bulbOff: () => M('bulbOff', () => new THREE.MeshStandardMaterial({ color: '#3a3a30', roughness: 0.3, metalness: 0.1 })),
  bulbOn: () => M('bulbOn', () => new THREE.MeshStandardMaterial({ color: '#ffe8b0', emissive: '#ffd890', emissiveIntensity: 4, roughness: 0.3 })),
  redOn: () => M('redOn', () => new THREE.MeshStandardMaterial({ color: '#ff3020', emissive: '#ff2010', emissiveIntensity: 5 })),
  greenOn: () => M('greenOn', () => new THREE.MeshStandardMaterial({ color: '#40ff60', emissive: '#30ff50', emissiveIntensity: 4 })),
  black: () => M('black', () => new THREE.MeshBasicMaterial({ color: '#000000' })),
  wire: () => M('wire', () => new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.6 })),
  chain: () => M('chain', () => new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.5, metalness: 0.8 })),
  crtCase: () => M('crtCase', () => new THREE.MeshStandardMaterial({ color: '#3a3530', roughness: 0.55, metalness: 0.05 })),
};

function m(geo, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

export function glowSprite(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  s.scale.set(size, size, size);
  return s;
}

/* ---------------- Generator ---------------- */

export function buildGeneratorMesh() {
  const g = new THREE.Group();
  const paint = mats.genPaint(), dark = mats.darkMetal(), tank = mats.redTank();
  m(boxGeo(1.25, 0.12, 0.85, 1), dark, 0, 0.06, 0, g);
  for (const sx of [-0.55, 0.55]) m(boxGeo(0.08, 0.6, 0.85, 1), dark, sx, 0.4, 0, g);
  m(boxGeo(0.72, 0.55, 0.6, 1), paint, -0.12, 0.42, 0, g);
  for (let i = 0; i < 6; i++) m(boxGeo(0.04, 0.22, 0.5, 1), dark, -0.38 + i * 0.1, 0.8, 0, g);
  m(cylGeo(0.17, 0.17, 0.8, 14, 1), tank, 0.05, 1.05, 0.0, g, 0, 0, Math.PI / 2);
  m(cylGeo(0.05, 0.05, 0.06, 8, 1), dark, 0.25, 1.24, 0, g);
  const flywheel = m(cylGeo(0.22, 0.22, 0.06, 16, 1), dark, 0.45, 0.45, 0.0, g, 0, 0, Math.PI / 2);
  const spokes = new THREE.Group();
  flywheel.add(spokes);
  for (let i = 0; i < 3; i++) m(boxGeo(0.4, 0.07, 0.03, 1), paint, 0, 0.04, 0, spokes, 0, (i * Math.PI) / 3, 0);
  const pistons = [];
  for (let i = 0; i < 2; i++) pistons.push(m(cylGeo(0.06, 0.06, 0.25, 10, 1), dark, -0.3 + i * 0.25, 0.85, -0.25, g));
  m(cylGeo(0.035, 0.035, 0.9, 8, 1), dark, -0.45, 1.05, 0.3, g);
  // work-light pole with two bulbs
  m(cylGeo(0.025, 0.025, 1.7, 6, 1), dark, 0.58, 0.95, -0.36, g);
  m(boxGeo(0.5, 0.04, 0.04, 1), dark, 0.58, 1.78, -0.36, g);
  const bulbs = [];
  for (const dx of [-0.2, 0.2]) {
    m(new THREE.ConeGeometry(0.07, 0.08, 10, 1, true), dark, 0.58 + dx, 1.74, -0.36, g, Math.PI, 0, 0);
    bulbs.push(m(new THREE.SphereGeometry(0.045, 10, 8), mats.bulbOff(), 0.58 + dx, 1.7, -0.36, g));
  }
  // dangling wires
  for (let i = 0; i < 3; i++) {
    const w = m(new THREE.TorusGeometry(0.25 + i * 0.05, 0.012, 4, 12, Math.PI), mats.wire(), 0.1 + i * 0.05, 0.6, 0.36, g, 0, 0, Math.PI);
    w.scale.set(1, 0.6, 1);
  }
  const glow = glowSprite(0xffd890, 3.2, 0.0);
  glow.position.set(0.58, 1.72, -0.36);
  g.add(glow);
  return { group: g, bulbs, pistons, flywheel, glow };
}

/* ---------------- Hook ---------------- */

export function buildHookMesh() {
  const g = new THREE.Group();
  const rust = mats.rust(), wood = mats.oldWood();
  m(boxGeo(1.4, 0.12, 1.4, 1), wood, 0, 0.06, 0, g);
  for (let i = 0; i < 5; i++) m(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.08, 0), mats.concrete(), Math.cos(i * 1.3) * 0.55, 0.12, Math.sin(i * 1.3) * 0.55, g, i, i * 2, 0);
  m(cylGeo(0.07, 0.09, 3.0, 10, 1), rust, 0, 1.5, 0, g);
  m(cylGeo(0.05, 0.05, 0.95, 8, 1), rust, 0, 2.9, 0.42, g, Math.PI / 2, 0, 0);
  m(cylGeo(0.035, 0.035, 0.8, 6, 1), rust, 0, 2.55, 0.25, g, -0.75, 0, 0);
  // chain
  for (let i = 0; i < 5; i++) m(new THREE.TorusGeometry(0.035, 0.01, 4, 8), mats.chain(), 0, 2.82 - i * 0.065, 0.86, g, 0, i % 2 ? Math.PI / 2 : 0, 0);
  // hook
  const hook = m(new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI * 1.3), rust, 0, 2.38, 0.86, g, 0, Math.PI / 2, -Math.PI * 0.15);
  m(new THREE.ConeGeometry(0.022, 0.12, 6), rust, 0, 2.35, 0.95, g, -0.6, 0, 0);
  const glow = glowSprite(0xff2a1a, 2.0, 0);
  glow.position.set(0, 2.3, 0.86);
  g.add(glow);
  return { group: g, hook, glow };
}

/* ---------------- Pallet ---------------- */

export function buildPalletMesh() {
  const g = new THREE.Group();
  const wood = mats.palletWood();
  // board lies in local XY plane (x = width across the gap, y = height when standing)
  const board = new THREE.Group();
  g.add(board);
  for (let i = 0; i < 6; i++) m(boxGeo(1.95, 0.14, 0.03, 1), wood, 0, -0.55 + i * 0.22, 0.04, board);
  for (const x of [-0.85, 0, 0.85]) m(boxGeo(0.12, 1.25, 0.1, 1), wood, x, 0, -0.03, board);
  for (let i = 0; i < 6; i++) m(boxGeo(1.95, 0.14, 0.03, 1), wood, 0, -0.55 + i * 0.22, -0.1, board);
  return { group: g, board };
}

/* ---------------- Exit gate ---------------- */

export function buildGateMesh(width, wallMat) {
  const g = new THREE.Group();
  const conc = mats.concrete(), dark = mats.darkMetal(), rust = mats.rust();
  const h = 4.4;
  for (const sx of [-1, 1]) m(boxGeo(1.1, h + 0.4, 1.1, 1.5), wallMat || conc, sx * (width / 2 + 0.55), (h + 0.4) / 2, 0, g);
  m(boxGeo(width + 2.2, 0.6, 1.1, 1.5), wallMat || conc, 0, h + 0.5, 0, g);
  const door = new THREE.Group();
  g.add(door);
  m(boxGeo(width, h - 0.1, 0.18, 1.5), rust, 0, (h - 0.1) / 2, 0, door);
  for (let i = 0; i < 6; i++) m(boxGeo(0.1, h - 0.2, 0.26, 1), dark, -width / 2 + 0.4 + i * (width - 0.8) / 5, (h - 0.1) / 2, 0, door);
  for (let i = 0; i < 3; i++) m(boxGeo(width, 0.12, 0.26, 1), dark, 0, 0.5 + i * 1.6, 0, door);
  // switch box with a lever and three lamps
  const sw = new THREE.Group();
  g.add(sw);
  sw.position.set(width / 2 + 0.55, 0, 0.75);
  m(boxGeo(0.7, 0.9, 0.3, 1), dark, 0, 1.25, 0, sw);
  const lever = new THREE.Group();
  lever.position.set(0, 1.25, 0.18);
  sw.add(lever);
  m(cylGeo(0.025, 0.025, 0.45, 6, 1), mats.chain(), 0, 0.2, 0, lever);
  m(new THREE.SphereGeometry(0.05, 8, 6), mats.redTank(), 0, 0.42, 0, lever);
  lever.rotation.x = 0.6;
  const lamps = [];
  for (let i = 0; i < 3; i++) lamps.push(m(new THREE.SphereGeometry(0.05, 8, 6), mats.bulbOff(), -0.2 + i * 0.2, 1.8, 0.1, sw));
  const alarm = m(new THREE.SphereGeometry(0.16, 10, 8), mats.bulbOff(), 0, h + 0.95, 0, g);
  const glow = glowSprite(0xff2010, 6, 0);
  glow.position.set(0, h + 0.95, 0);
  g.add(glow);
  return { group: g, door, lever, lamps, alarm, glow, switchGroup: sw };
}

/* ---------------- Chest ---------------- */

export function buildChestMesh() {
  const g = new THREE.Group();
  const wood = mats.oldWood(), dark = mats.darkMetal();
  m(boxGeo(0.95, 0.45, 0.55, 1), wood, 0, 0.23, 0, g);
  for (const x of [-0.4, 0.4]) m(boxGeo(0.05, 0.47, 0.57, 1), dark, x, 0.235, 0, g);
  const lid = new THREE.Group();
  lid.position.set(0, 0.46, -0.27);
  g.add(lid);
  m(boxGeo(0.97, 0.14, 0.57, 1), wood, 0, 0.07, 0.27, lid);
  m(boxGeo(0.1, 0.1, 0.04, 1), dark, 0, 0.0, 0.56, lid);
  return { group: g, lid };
}

/* ---------------- Hatch ---------------- */

export function buildHatchMesh() {
  const g = new THREE.Group();
  const dark = mats.darkMetal(), rust = mats.rust();
  m(boxGeo(1.3, 0.06, 1.3, 1), dark, 0, 0.03, 0, g);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mats.black());
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.065;
  g.add(hole);
  const lid = new THREE.Group();
  lid.position.set(0, 0.07, -0.5);
  g.add(lid);
  m(boxGeo(1.0, 0.05, 1.0, 1), rust, 0, 0, 0.5, lid);
  for (let i = 0; i < 4; i++) m(boxGeo(1.0, 0.04, 0.05, 1), dark, 0, 0.04, 0.12 + i * 0.25, lid);
  const glow = glowSprite(0x9ab8ff, 2.5, 0);
  glow.position.y = 0.4;
  g.add(glow);
  return { group: g, lid, glow };
}

/* ---------------- CRT screen (The EXE's power) ---------------- */

export function buildTVMesh(staticCanvas) {
  const g = new THREE.Group();
  m(boxGeo(0.7, 0.5, 0.6, 1), mats.oldWood(), 0, 0.25, 0, g);
  const c = mats.crtCase();
  m(boxGeo(0.62, 0.5, 0.48, 1), c, 0, 0.76, 0, g);
  m(boxGeo(0.44, 0.38, 0.26, 1), c, 0, 0.77, -0.3, g);
  const screenMat = new THREE.MeshBasicMaterial({ map: staticCanvas.tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), screenMat);
  screen.position.set(0, 0.78, 0.245);
  g.add(screen);
  m(cylGeo(0.008, 0.008, 0.4, 4, 1), mats.chain(), 0.12, 1.15, -0.05, g, 0, 0, -0.5);
  m(cylGeo(0.008, 0.008, 0.4, 4, 1), mats.chain(), -0.12, 1.15, -0.05, g, 0, 0, 0.5);
  const cord = m(new THREE.TorusGeometry(0.3, 0.012, 4, 10, Math.PI), mats.wire(), 0.2, 0.25, -0.45, g, 0, Math.PI / 2, 0);
  void cord;
  const glow = glowSprite(0x9ad8ff, 2.2, 0.35);
  glow.position.set(0, 0.78, 0.4);
  g.add(glow);
  return { group: g, screen, screenMat, glow };
}

export { makeStaticCanvas };
