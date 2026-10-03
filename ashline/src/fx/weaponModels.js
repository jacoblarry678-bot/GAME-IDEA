/**
 * Procedural weapon models. Local frame: origin at the firing-hand grip,
 * barrel along -Z, +Y up. Each model exposes markers used by animation:
 *   muzzle, sight (line-of-sight point for ADS), leftHand, eject, and
 *   movable parts (mag, bolt, pump, slide).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const geoCache = new Map();
function rbox(w, h, d, r = 0.004) {
  const k = `${w},${h},${d},${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)));
  return geoCache.get(k);
}
function cyl(r, len, seg = 12, r2 = r) {
  const k = `c${r},${len},${seg},${r2}`;
  if (!geoCache.has(k)) {
    const g = new THREE.CylinderGeometry(r2, r, len, seg);
    g.rotateX(Math.PI / 2); // along Z
    geoCache.set(k, g);
  }
  return geoCache.get(k);
}

export function weaponMaterials(lib) {
  return {
    metal: lib.gun('metal'),
    polymer: lib.gun('polymer'),
    tan: lib.gun('tan'),
    olive: lib.gun('olive'),
    wood: lib.gun('wood'),
    glass: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.35 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.1, metalness: 0.8 }),
    reddot: new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.35, metalness: 0.9 }),
  };
}

class Builder {
  constructor(mats) {
    this.mats = mats;
    this.group = new THREE.Group();
    this.parts = {};
    this.markers = {};
  }
  add(geom, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = this.group) {
    const m = new THREE.Mesh(geom, this.mats[mat] || mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }
  sub(name, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = name;
    this.group.add(g);
    this.parts[name] = g;
    return g;
  }
  marker(name, x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    this.group.add(o);
    this.markers[name] = o;
  }
}

function rail(b, y, z0, z1, mat = 'metal') {
  const len = z0 - z1;
  b.add(rbox(0.022, 0.008, len, 0.002), mat, 0, y, (z0 + z1) / 2);
  for (let z = z0 - 0.01; z > z1; z -= 0.012) b.add(rbox(0.024, 0.004, 0.005, 0.001), mat, 0, y + 0.006, z);
}

function reflexSight(b, y, z) {
  // low mount + open window frame (no solid plates) so the view stays clear when aiming
  b.add(rbox(0.026, 0.01, 0.05, 0.003), 'polymer', 0, y + 0.005, z);
  b.add(rbox(0.004, 0.026, 0.006, 0.0015), 'polymer', 0.0135, y + 0.023, z - 0.018);
  b.add(rbox(0.004, 0.026, 0.006, 0.0015), 'polymer', -0.0135, y + 0.023, z - 0.018);
  b.add(rbox(0.031, 0.004, 0.006, 0.0015), 'polymer', 0, y + 0.037, z - 0.018);
  b.add(rbox(0.012, 0.008, 0.026, 0.002), 'polymer', 0.012, y + 0.012, z + 0.006); // emitter housing
  const glass = b.add(new THREE.PlaneGeometry(0.023, 0.024), 'glass', 0, y + 0.023, z - 0.0185);
  glass.renderOrder = 2;
  const dot = b.add(new THREE.CircleGeometry(0.0009, 10), 'reddot', 0, y + 0.023, z - 0.019);
  dot.renderOrder = 3;
  b.marker('sight', 0, y + 0.023, z + 0.03);
}

function ironSights(b, yRear, zRear, yFront, zFront) {
  b.add(rbox(0.024, 0.016, 0.014, 0.002), 'metal', 0, yRear, zRear);
  b.add(rbox(0.006, 0.006, 0.016), 'polymer', 0, yRear + 0.011, zRear);
  b.add(rbox(0.008, 0.012, 0.01), 'metal', -0.008, yRear + 0.012, zRear);
  b.add(rbox(0.008, 0.012, 0.01), 'metal', 0.008, yRear + 0.012, zRear);
  b.add(rbox(0.016, 0.014, 0.012, 0.002), 'metal', 0, yFront, zFront);
  b.add(rbox(0.003, 0.016, 0.003, 0.001), 'metal', 0, yFront + 0.014, zFront);
  b.marker('sight', 0, yRear + 0.018, zRear);
}

const BUILDERS = {
  ar(b) {
    // lower + upper receiver
    b.add(rbox(0.048, 0.05, 0.3, 0.006), 'metal', 0, 0.075, -0.06);
    b.add(rbox(0.046, 0.04, 0.22, 0.006), 'olive', 0, 0.035, -0.04);
    // handguard
    b.add(rbox(0.054, 0.058, 0.27, 0.01), 'polymer', 0, 0.068, -0.345);
    for (let z = -0.24; z > -0.46; z -= 0.045) b.add(rbox(0.056, 0.012, 0.022, 0.003), 'olive', 0, 0.068, z, 0, 0, 0);
    rail(b, 0.104, 0.07, -0.47);
    // barrel + muzzle brake
    b.add(cyl(0.011, 0.16), 'metal', 0, 0.072, -0.555);
    b.add(cyl(0.017, 0.06, 8), 'metal', 0, 0.072, -0.65);
    b.add(rbox(0.008, 0.018, 0.012), 'polymer', 0, 0.084, -0.64);
    // charging handle & ejection port
    b.add(rbox(0.05, 0.012, 0.03), 'metal', 0, 0.098, 0.07);
    b.add(rbox(0.004, 0.018, 0.05), 'polymer', 0.026, 0.078, -0.04);
    // pistol grip
    b.add(rbox(0.03, 0.095, 0.042, 0.008), 'polymer', 0, -0.025, 0.035, 0.28, 0, 0);
    // trigger guard
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.025);
    // stock
    b.add(rbox(0.024, 0.03, 0.12, 0.004), 'metal', 0, 0.072, 0.13);
    b.add(rbox(0.042, 0.085, 0.16, 0.01), 'olive', 0, 0.055, 0.23);
    b.add(rbox(0.044, 0.1, 0.022, 0.008), 'polymer', 0, 0.05, 0.315);
    // magazine (curved look via two segments)
    const mag = b.sub('mag', 0, 0.03, -0.11);
    b.add(rbox(0.026, 0.1, 0.068, 0.006), 'polymer', 0, -0.045, 0, -0.12, 0, 0, mag);
    b.add(rbox(0.026, 0.07, 0.066, 0.006), 'polymer', 0, -0.12, -0.02, -0.4, 0, 0, mag);
    // optic
    reflexSight(b, 0.112, -0.05);
    // vertical grip
    b.add(rbox(0.026, 0.07, 0.03, 0.008), 'polymer', 0, 0.005, -0.36);
    b.marker('muzzle', 0, 0.072, -0.69);
    b.marker('leftHand', 0, 0.035, -0.36);
    b.marker('eject', 0.03, 0.08, -0.04);
    b.marker('magWell', 0, 0.03, -0.11);
  },
  smg(b) {
    b.add(rbox(0.05, 0.06, 0.25, 0.008), 'metal', 0, 0.07, -0.08);
    b.add(rbox(0.046, 0.034, 0.18, 0.006), 'polymer', 0, 0.03, -0.06);
    // shroud & barrel
    b.add(cyl(0.022, 0.14, 12), 'polymer', 0, 0.07, -0.27);
    for (let z = -0.22; z > -0.33; z -= 0.025) b.add(rbox(0.046, 0.008, 0.01), 'metal', 0, 0.07, z);
    b.add(cyl(0.012, 0.06), 'metal', 0, 0.07, -0.37);
    b.add(cyl(0.016, 0.035, 8), 'metal', 0, 0.07, -0.405);
    rail(b, 0.104, 0.03, -0.2);
    // grip, trigger
    b.add(rbox(0.03, 0.09, 0.04, 0.008), 'polymer', 0, -0.025, 0.03, 0.22, 0, 0);
    b.add(rbox(0.006, 0.004, 0.05), 'metal', 0, 0.002, -0.02);
    // straight mag ahead of grip
    const mag = b.sub('mag', 0, 0.03, -0.12);
    b.add(rbox(0.022, 0.17, 0.034, 0.005), 'polymer', 0, -0.085, 0, -0.06, 0, 0, mag);
    // folding wire stock
    b.add(rbox(0.008, 0.008, 0.2), 'metal', 0.016, 0.085, 0.13);
    b.add(rbox(0.008, 0.008, 0.2), 'metal', -0.016, 0.085, 0.13);
    b.add(rbox(0.008, 0.008, 0.19), 'metal', 0.016, 0.03, 0.13, 0.28, 0, 0);
    b.add(rbox(0.008, 0.008, 0.19), 'metal', -0.016, 0.03, 0.13, 0.28, 0, 0);
    b.add(rbox(0.042, 0.075, 0.016, 0.006), 'polymer', 0, 0.06, 0.235);
    // angled foregrip
    b.add(rbox(0.024, 0.055, 0.04, 0.007), 'tan', 0, 0.02, -0.25, -0.35, 0, 0);
    ironSights(b, 0.112, 0.0, 0.098, -0.2);
    b.marker('muzzle', 0, 0.07, -0.43);
    b.marker('leftHand', 0, 0.03, -0.25);
    b.marker('eject', 0.03, 0.08, -0.06);
    b.marker('magWell', 0, 0.03, -0.12);
  },
  shotgun(b) {
    b.add(rbox(0.05, 0.07, 0.22, 0.008), 'metal', 0, 0.065, -0.05);
    b.add(cyl(0.0125, 0.5), 'metal', 0, 0.085, -0.41);
    b.add(cyl(0.013, 0.42), 'metal', 0, 0.05, -0.37);
    b.add(cyl(0.015, 0.02, 10), 'metal', 0, 0.05, -0.58);
    // bead sight
    b.add(new THREE.SphereGeometry(0.0035, 8, 6), 'brass', 0, 0.1, -0.64);
    b.add(rbox(0.012, 0.012, 0.2), 'metal', 0, 0.098, -0.05);
    // pump forend
    const pump = b.sub('pump', 0, 0.05, -0.32);
    b.add(rbox(0.05, 0.05, 0.16, 0.012), 'wood', 0, 0, 0, 0, 0, 0, pump);
    for (let z = -0.06; z <= 0.06; z += 0.024) b.add(rbox(0.052, 0.004, 0.008), 'polymer', 0, 0.012, z, 0, 0, 0, pump);
    // grip + stock (wood)
    b.add(rbox(0.032, 0.09, 0.045, 0.01), 'wood', 0, -0.03, 0.06, 0.45, 0, 0);
    b.add(rbox(0.04, 0.075, 0.26, 0.012), 'wood', 0, 0.035, 0.23, -0.12, 0, 0);
    b.add(rbox(0.044, 0.1, 0.02, 0.008), 'polymer', 0, 0.025, 0.36, -0.12, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.015, -0.01);
    b.marker('sight', 0, 0.112, 0.02);
    b.marker('muzzle', 0, 0.085, -0.67);
    b.marker('leftHand', 0, 0.03, -0.32);
    b.marker('eject', 0.03, 0.075, -0.06);
    b.marker('magWell', 0, 0.03, -0.12);
  },
  sniper(b) {
    b.add(rbox(0.05, 0.06, 0.28, 0.008), 'metal', 0, 0.07, -0.06);
    // chassis / stock
    b.add(rbox(0.05, 0.05, 0.36, 0.01), 'tan', 0, 0.035, -0.12);
    b.add(rbox(0.032, 0.095, 0.045, 0.01), 'tan', 0, -0.03, 0.06, 0.32, 0, 0);
    b.add(rbox(0.045, 0.06, 0.24, 0.012), 'tan', 0, 0.05, 0.22);
    b.add(rbox(0.04, 0.03, 0.12), 'polymer', 0, 0.09, 0.2);
    b.add(rbox(0.046, 0.12, 0.024, 0.008), 'polymer', 0, 0.035, 0.345);
    // barrel (fluted look)
    b.add(cyl(0.013, 0.56, 10, 0.011), 'metal', 0, 0.072, -0.48);
    b.add(cyl(0.02, 0.09, 8), 'metal', 0, 0.072, -0.8);
    // bolt
    const bolt = b.sub('bolt', 0.03, 0.08, 0.02);
    b.add(rbox(0.008, 0.008, 0.05), 'metal', 0.012, 0, 0, 0, 0, -0.5, bolt);
    b.add(new THREE.SphereGeometry(0.011, 10, 8), 'polymer', 0.032, -0.012, 0, 0, 0, 0, bolt);
    // magazine
    const mag = b.sub('mag', 0, 0.02, -0.1);
    b.add(rbox(0.032, 0.07, 0.08, 0.005), 'polymer', 0, -0.03, 0, 0, 0, 0, mag);
    // scope
    const sy = 0.145;
    b.add(rbox(0.016, 0.03, 0.02), 'metal', 0, 0.11, -0.12);
    b.add(rbox(0.016, 0.03, 0.02), 'metal', 0, 0.11, 0.02);
    b.add(cyl(0.017, 0.24, 16), 'polymer', 0, sy, -0.05);
    b.add(cyl(0.024, 0.08, 16, 0.017), 'polymer', 0, sy, -0.2);
    b.add(cyl(0.021, 0.06, 16, 0.017), 'polymer', 0, sy, 0.1, 0, 0, 0);
    b.add(cyl(0.008, 0.024, 10), 'metal', 0, sy + 0.024, -0.05, Math.PI / 2, 0, 0);
    b.add(cyl(0.008, 0.024, 10), 'metal', 0.024, sy, -0.05, 0, Math.PI / 2, 0);
    b.add(new THREE.CircleGeometry(0.022, 16), 'lens', 0, sy, -0.241);
    // bipod (folded)
    b.add(rbox(0.008, 0.008, 0.16), 'metal', 0.012, 0.03, -0.38);
    b.add(rbox(0.008, 0.008, 0.16), 'metal', -0.012, 0.03, -0.38);
    b.marker('sight', 0, sy, 0.13);
    b.marker('muzzle', 0, 0.072, -0.85);
    b.marker('leftHand', 0, 0.02, -0.26);
    b.marker('eject', 0.03, 0.08, -0.04);
    b.marker('magWell', 0, 0.02, -0.1);
  },
  pistol(b) {
    const slide = b.sub('slide', 0, 0.075, -0.06);
    b.add(rbox(0.03, 0.034, 0.19, 0.006), 'metal', 0, 0, 0, 0, 0, 0, slide);
    for (let z = 0.05; z < 0.09; z += 0.008) b.add(rbox(0.032, 0.026, 0.003, 0.001), 'polymer', 0, 0, z, 0, 0, 0, slide);
    b.add(rbox(0.016, 0.01, 0.012), 'metal', 0, 0.021, 0.085, 0, 0, 0, slide);
    b.add(rbox(0.005, 0.01, 0.006), 'metal', 0, 0.021, -0.085, 0, 0, 0, slide);
    b.add(rbox(0.028, 0.026, 0.17, 0.006), 'polymer', 0, 0.046, -0.07);
    b.add(rbox(0.03, 0.11, 0.05, 0.01), 'polymer', 0, -0.01, 0.015, 0.22, 0, 0);
    b.add(rbox(0.006, 0.004, 0.045), 'polymer', 0, 0.02, -0.04);
    b.add(cyl(0.006, 0.01), 'metal', 0, 0.075, -0.157);
    const mag = b.sub('mag', 0, -0.02, 0.022);
    b.add(rbox(0.022, 0.09, 0.034, 0.004), 'metal', 0, -0.04, 0, 0.22, 0, 0, mag);
    b.marker('sight', 0, 0.104, 0.025);
    b.marker('muzzle', 0, 0.075, -0.165);
    b.marker('leftHand', -0.012, -0.015, 0.0);
    b.marker('eject', 0.02, 0.085, -0.04);
    b.marker('magWell', 0, -0.02, 0.022);
  },
};

/**
 * Build a weapon model. options.merge collapses static parts into one mesh
 * per material (third-person use) while keeping markers.
 */
export function buildWeapon(modelId, mats, options = {}) {
  const b = new Builder(mats);
  (BUILDERS[modelId] || BUILDERS.ar)(b);
  if (options.merge) return mergeModel(b);
  b.group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: b.group, parts: b.parts, markers: b.markers };
}

function mergeModel(b) {
  b.group.updateMatrixWorld(true);
  const byMat = new Map();
  b.group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // normalize attributes for merging
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const ng = g.index ? g.toNonIndexed() : g;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(ng);
  });
  const out = new THREE.Group();
  for (const [mat, geoms] of byMat) {
    if (mat.transparent) continue;
    const m = new THREE.Mesh(mergeGeometries(geoms, false), mat);
    m.castShadow = true;
    out.add(m);
  }
  const markers = {};
  for (const [k, v] of Object.entries(b.markers)) {
    const o = new THREE.Object3D();
    o.position.copy(v.getWorldPosition(new THREE.Vector3()));
    out.add(o);
    markers[k] = o;
  }
  return { group: out, parts: {}, markers };
}

/** Simple grenade models for hands/world. */
export function buildGrenade(kind, mats) {
  const g = new THREE.Group();
  if (kind === 'smoke') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 12), new THREE.MeshStandardMaterial({ color: 0x5a6a52, roughness: 0.6, metalness: 0.4 }));
    g.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.02, 10), mats.metal);
    top.position.y = 0.065; g.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0325, 0.0325, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xd8d8d0 }));
    band.position.y = 0.03; g.add(band);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3c4a34, roughness: 0.55, metalness: 0.3 }));
    body.scale.y = 1.15; g.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.025, 8), mats.metal);
    top.position.y = 0.045; g.add(top);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.014), mats.metal);
    spoon.position.set(0.03, 0.02, 0); spoon.rotation.z = -0.25; g.add(spoon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.002, 6, 12), mats.metal);
    ring.position.set(-0.016, 0.056, 0); g.add(ring);
  }
  return g;
}
