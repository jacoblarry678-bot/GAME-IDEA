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
    this.att = {};
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
  if (opticOverride(b, y, z, 'reflex')) return;
  reflexCore(b, y, z);
}

function reflexCore(b, y, z) {
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
  if (opticOverride(b, yRear - 0.004, zRear - 0.03, 'iron')) return;
  b.add(rbox(0.024, 0.016, 0.014, 0.002), 'metal', 0, yRear, zRear);
  b.add(rbox(0.006, 0.006, 0.016), 'polymer', 0, yRear + 0.011, zRear);
  b.add(rbox(0.008, 0.012, 0.01), 'metal', -0.008, yRear + 0.012, zRear);
  b.add(rbox(0.008, 0.012, 0.01), 'metal', 0.008, yRear + 0.012, zRear);
  b.add(rbox(0.016, 0.014, 0.012, 0.002), 'metal', 0, yFront, zFront);
  b.add(rbox(0.003, 0.016, 0.003, 0.001), 'metal', 0, yFront + 0.014, zFront);
  b.marker('sight', 0, yRear + 0.018, zRear);
}

/**
 * Swap the weapon's built-in sight for the attached optic. `y` is the mount
 * surface, `z` the optic position. Returns true when an optic was built.
 */
function opticOverride(b, y, z, native) {
  const want = b.att.optic;
  if (!want || b.opticDone || want === native) return false;
  b.opticDone = true;
  if (native === 'iron' || native === 'bead') b.add(rbox(0.022, 0.012, 0.06, 0.003), 'metal', 0, y - 0.002, z); // riser mount
  if (want === 'reflex') reflexCore(b, y, z);
  else if (want === 'holo') holoCore(b, y, z);
  else if (want === 'scope3x') {
    b.add(rbox(0.016, 0.05, 0.02), 'metal', 0, y + 0.02, z - 0.05);
    b.add(rbox(0.016, 0.05, 0.02), 'metal', 0, y + 0.02, z + 0.05);
    scopeCore(b, y + 0.058, z);
  }
  return true;
}

/** Muzzle devices, barrel extension, magazine and underbarrel visuals. */
function attachmentVisuals(b) {
  const a = b.att, mz = b.markers.muzzle;
  if (!mz) return;
  const p = mz.position;
  let z = p.z;
  if (a.barrel === 'long') {
    b.add(cyl(0.011, 0.07), 'metal', 0, p.y, z - 0.035);
    z -= 0.07;
  }
  if (a.muzzle === 'supp') {
    b.add(cyl(0.021, 0.17, 14), 'polymer', 0, p.y, z - 0.085);
    b.add(cyl(0.0215, 0.006, 14), 'metal', 0, p.y, z - 0.02);
    z -= 0.17;
  } else if (a.muzzle === 'comp') {
    b.add(cyl(0.015, 0.05, 8), 'metal', 0, p.y, z - 0.025);
    for (let i = 0; i < 3; i++) b.add(rbox(0.004, 0.012, 0.006, 0.001), 'polymer', 0, p.y + 0.012, z - 0.012 - i * 0.013);
    z -= 0.05;
  } else if (a.muzzle === 'brake') {
    b.add(rbox(0.034, 0.024, 0.055, 0.004), 'metal', 0, p.y, z - 0.028);
    b.add(rbox(0.036, 0.006, 0.01, 0.001), 'polymer', 0, p.y, z - 0.02);
    b.add(rbox(0.036, 0.006, 0.01, 0.001), 'polymer', 0, p.y, z - 0.038);
    z -= 0.055;
  }
  p.z = z;
  if (a.magazine === 'ext' && b.parts.mag) b.parts.mag.scale.set(1.05, 1.4, 1.05);
  const lh = b.markers.leftHand;
  if (lh && a.underbarrel) {
    const q = lh.position;
    if (a.underbarrel === 'vgrip') b.add(rbox(0.022, 0.075, 0.026, 0.006), 'polymer', 0, q.y - 0.045, q.z + 0.03);
    else if (a.underbarrel === 'angled') b.add(rbox(0.022, 0.03, 0.07, 0.006), 'polymer', 0, q.y - 0.025, q.z + 0.02, -0.5, 0, 0);
    else if (a.underbarrel === 'laser') {
      b.add(rbox(0.02, 0.022, 0.05, 0.004), 'polymer', 0.026, q.y + 0.02, q.z - 0.04);
      b.add(new THREE.CircleGeometry(0.004, 8), 'reddot', 0.026, q.y + 0.02, q.z - 0.0655);
      b.marker('laser', 0.026, q.y + 0.02, q.z - 0.066);
    }
  }
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
    b.marker('charm', -0.026, 0.06, 0.04);
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
    b.marker('charm', -0.027, 0.05, 0.02);
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
    if (!opticOverride(b, 0.104, -0.03, 'bead')) b.marker('sight', 0, 0.112, 0.02);
    b.marker('muzzle', 0, 0.085, -0.67);
    b.marker('leftHand', 0, 0.03, -0.32);
    b.marker('eject', 0.03, 0.075, -0.06);
    b.marker('magWell', 0, 0.03, -0.12);
    b.marker('charm', -0.027, 0.045, 0.02);
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
    b.marker('charm', -0.027, 0.05, 0.08);
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
    b.marker('charm', -0.016, 0.035, 0.0);
  },
};


function holoSight(b, y, z) {
  if (opticOverride(b, y, z, 'holo')) return;
  holoCore(b, y, z);
}

function holoCore(b, y, z) {
  // larger rectangular holographic window
  b.add(rbox(0.032, 0.012, 0.07, 0.003), 'polymer', 0, y + 0.006, z);
  b.add(rbox(0.004, 0.034, 0.05, 0.0015), 'polymer', 0.017, y + 0.027, z - 0.008);
  b.add(rbox(0.004, 0.034, 0.05, 0.0015), 'polymer', -0.017, y + 0.027, z - 0.008);
  b.add(rbox(0.038, 0.005, 0.05, 0.0015), 'polymer', 0, y + 0.045, z - 0.008);
  const glass = b.add(new THREE.PlaneGeometry(0.03, 0.03), 'glass', 0, y + 0.027, z - 0.03);
  glass.renderOrder = 2;
  const ring = b.add(new THREE.RingGeometry(0.0022, 0.0028, 16), 'reddot', 0, y + 0.027, z - 0.031);
  ring.renderOrder = 3;
  const dot = b.add(new THREE.CircleGeometry(0.0006, 8), 'reddot', 0, y + 0.027, z - 0.031);
  dot.renderOrder = 3;
  b.marker('sight', 0, y + 0.027, z + 0.03);
}

function scope3x(b, y, z, railY = y - 0.06) {
  if (opticOverride(b, railY, z, 'scope3x')) return;
  scopeCore(b, y, z);
}

function scopeCore(b, y, z) {
  // open-ended tube: from the eye you look through it and see the housing as a ring
  const tube = (r1, r2, len, zz) => {
    const g = new THREE.CylinderGeometry(r2, r1, len, 16, 1, true);
    g.rotateX(Math.PI / 2);
    return b.add(g, 'polymer', 0, y + 0.012, zz);
  };
  b.add(rbox(0.016, 0.062, 0.02), 'metal', 0, y - 0.03, z - 0.06);
  b.add(rbox(0.016, 0.062, 0.02), 'metal', 0, y - 0.03, z + 0.05);
  tube(0.014, 0.014, 0.17, z);
  tube(0.014, 0.019, 0.05, z - 0.105);
  tube(0.017, 0.014, 0.04, z + 0.1);
  b.add(new THREE.RingGeometry(0.0095, 0.019, 24), 'polymer', 0, y + 0.012, z + 0.12);
  b.add(new THREE.RingGeometry(0.0175, 0.0195, 20), 'polymer', 0, y + 0.012, z - 0.13);
  const r = b.add(new THREE.RingGeometry(0.0004, 0.0009, 3), 'reddot', 0, y + 0.0115, z + 0.118);
  r.rotation.z = Math.PI / 2;
  r.renderOrder = 3;
  b.marker('sight', 0, y + 0.012, z + 0.12);
}

function bipod(b, y, z) {
  b.add(rbox(0.008, 0.008, 0.18), 'metal', 0.014, y, z);
  b.add(rbox(0.008, 0.008, 0.18), 'metal', -0.014, y, z);
}

Object.assign(BUILDERS, {
  bullpup(b) {
    b.add(rbox(0.05, 0.085, 0.56, 0.012), 'olive', 0, 0.055, 0.0);
    b.add(rbox(0.054, 0.05, 0.2, 0.012), 'polymer', 0, 0.06, -0.3);
    b.add(cyl(0.011, 0.16), 'metal', 0, 0.075, -0.46);
    b.add(cyl(0.016, 0.05, 8), 'metal', 0, 0.075, -0.56);
    rail(b, 0.104, 0.06, -0.32);
    b.add(rbox(0.03, 0.09, 0.042, 0.008), 'polymer', 0, -0.03, 0.0, 0.25, 0, 0);
    b.add(rbox(0.006, 0.004, 0.07), 'metal', 0, -0.0, -0.04);
    b.add(rbox(0.048, 0.1, 0.03, 0.01), 'polymer', 0, 0.045, 0.28);
    const mag = b.sub('mag', 0, 0.01, 0.14);
    b.add(rbox(0.026, 0.12, 0.06, 0.006), 'polymer', 0, -0.06, 0, -0.18, 0, 0, mag);
    reflexSight(b, 0.112, -0.08);
    b.marker('muzzle', 0, 0.075, -0.6);
    b.marker('leftHand', 0, 0.03, -0.27);
    b.marker('eject', 0.03, 0.07, 0.12);
    b.marker('magWell', 0, 0.01, 0.14);
    b.marker('charm', -0.026, 0.04, 0.2);
  },
  battle(b) {
    b.add(rbox(0.05, 0.06, 0.3, 0.006), 'metal', 0, 0.07, -0.06);
    b.add(rbox(0.052, 0.024, 0.3, 0.004), 'metal', 0, 0.104, -0.06);
    b.add(rbox(0.056, 0.06, 0.22, 0.014), 'wood', 0, 0.064, -0.33);
    b.add(rbox(0.04, 0.03, 0.2, 0.01), 'wood', 0, 0.104, -0.33);
    b.add(cyl(0.012, 0.24), 'metal', 0, 0.075, -0.55);
    b.add(rbox(0.024, 0.03, 0.03), 'metal', 0, 0.075, -0.66);
    b.add(rbox(0.03, 0.09, 0.044, 0.008), 'polymer', 0, -0.028, 0.03, 0.3, 0, 0);
    b.add(rbox(0.04, 0.085, 0.27, 0.012), 'wood', 0, 0.05, 0.22, -0.1, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.03);
    const mag = b.sub('mag', 0, 0.035, -0.12);
    b.add(rbox(0.028, 0.09, 0.07, 0.005), 'metal', 0, -0.04, 0, -0.15, 0, 0, mag);
    b.add(rbox(0.028, 0.08, 0.068, 0.005), 'metal', 0, -0.11, -0.03, -0.5, 0, 0, mag);
    ironSights(b, 0.116, -0.12, 0.094, -0.63);
    b.marker('muzzle', 0, 0.075, -0.69);
    b.marker('leftHand', 0, 0.03, -0.33);
    b.marker('eject', 0.03, 0.08, -0.04);
    b.marker('magWell', 0, 0.035, -0.12);
    b.marker('charm', -0.026, 0.06, 0.04);
  },
  carbine(b) {
    b.add(rbox(0.048, 0.05, 0.28, 0.006), 'metal', 0, 0.075, -0.06);
    b.add(rbox(0.046, 0.04, 0.2, 0.006), 'tan', 0, 0.035, -0.04);
    b.add(rbox(0.054, 0.06, 0.2, 0.012), 'tan', 0, 0.068, -0.3);
    rail(b, 0.104, 0.07, -0.4);
    b.add(cyl(0.011, 0.12), 'metal', 0, 0.072, -0.46);
    b.add(cyl(0.016, 0.045, 10), 'metal', 0, 0.072, -0.53);
    b.add(rbox(0.03, 0.095, 0.042, 0.008), 'polymer', 0, -0.025, 0.035, 0.28, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.025);
    b.add(rbox(0.024, 0.03, 0.12, 0.004), 'metal', 0, 0.072, 0.13);
    b.add(rbox(0.04, 0.075, 0.15, 0.01), 'tan', 0, 0.06, 0.22);
    b.add(rbox(0.026, 0.05, 0.05, 0.008), 'polymer', 0, 0.02, -0.3, -0.5, 0, 0);
    const mag = b.sub('mag', 0, 0.03, -0.11);
    b.add(rbox(0.026, 0.1, 0.068, 0.006), 'tan', 0, -0.045, 0, -0.12, 0, 0, mag);
    b.add(rbox(0.026, 0.07, 0.066, 0.006), 'tan', 0, -0.12, -0.02, -0.4, 0, 0, mag);
    holoSight(b, 0.112, -0.04);
    b.marker('muzzle', 0, 0.072, -0.56);
    b.marker('leftHand', 0, 0.03, -0.3);
    b.marker('eject', 0.03, 0.08, -0.04);
    b.marker('magWell', 0, 0.03, -0.11);
    b.marker('charm', -0.026, 0.06, 0.04);
  },
  mp(b) {
    b.add(rbox(0.046, 0.07, 0.2, 0.008), 'polymer', 0, 0.065, -0.07);
    b.add(cyl(0.011, 0.05), 'metal', 0, 0.075, -0.19);
    b.add(rbox(0.03, 0.1, 0.045, 0.008), 'polymer', 0, -0.02, 0.0, 0.12, 0, 0);
    const mag = b.sub('mag', 0, -0.06, 0.0);
    b.add(rbox(0.024, 0.2, 0.034, 0.004), 'metal', 0, -0.09, 0.006, 0.12, 0, 0, mag);
    b.add(rbox(0.024, 0.04, 0.03, 0.006), 'polymer', 0, 0.02, -0.15, -0.3, 0, 0);
    b.add(rbox(0.008, 0.008, 0.12), 'metal', 0.016, 0.075, 0.09);
    b.add(rbox(0.008, 0.008, 0.12), 'metal', -0.016, 0.075, 0.09);
    b.add(rbox(0.04, 0.05, 0.012, 0.004), 'polymer', 0, 0.065, 0.15);
    ironSights(b, 0.104, 0.0, 0.1, -0.15);
    b.marker('muzzle', 0, 0.075, -0.22);
    b.marker('leftHand', 0, 0.01, -0.15);
    b.marker('eject', 0.026, 0.08, -0.06);
    b.marker('magWell', 0, -0.06, 0.0);
    b.marker('charm', -0.024, 0.05, 0.0);
  },
  suppressed(b) {
    b.add(rbox(0.05, 0.065, 0.24, 0.008), 'metal', 0, 0.07, -0.06);
    b.add(rbox(0.046, 0.034, 0.16, 0.006), 'polymer', 0, 0.03, -0.05);
    b.add(cyl(0.024, 0.32, 16), 'polymer', 0, 0.07, -0.34);
    for (let z = -0.22; z > -0.48; z -= 0.05) b.add(cyl(0.0245, 0.006, 16), 'metal', 0, 0.07, z);
    rail(b, 0.104, 0.04, -0.17);
    b.add(rbox(0.03, 0.09, 0.04, 0.008), 'polymer', 0, -0.025, 0.03, 0.22, 0, 0);
    b.add(rbox(0.006, 0.004, 0.05), 'metal', 0, 0.002, -0.02);
    const mag = b.sub('mag', 0, 0.03, -0.11);
    b.add(rbox(0.024, 0.13, 0.04, 0.005), 'polymer', 0, -0.065, 0, -0.18, 0, 0, mag);
    b.add(rbox(0.012, 0.06, 0.16, 0.004), 'polymer', 0.0, 0.06, 0.13);
    b.add(rbox(0.04, 0.08, 0.016, 0.006), 'polymer', 0, 0.055, 0.215);
    reflexSight(b, 0.112, -0.04);
    b.marker('muzzle', 0, 0.07, -0.5);
    b.marker('leftHand', 0, 0.04, -0.24);
    b.marker('eject', 0.03, 0.08, -0.05);
    b.marker('magWell', 0, 0.03, -0.11);
    b.marker('charm', -0.027, 0.05, 0.03);
  },
  autoshotgun(b) {
    b.add(rbox(0.054, 0.08, 0.3, 0.008), 'polymer', 0, 0.065, -0.08);
    b.add(rbox(0.05, 0.06, 0.18, 0.01), 'polymer', 0, 0.065, -0.32);
    for (let z = -0.25; z > -0.4; z -= 0.03) b.add(rbox(0.052, 0.008, 0.012), 'metal', 0, 0.085, z);
    b.add(cyl(0.014, 0.12), 'metal', 0, 0.075, -0.47);
    b.add(cyl(0.019, 0.04, 10), 'metal', 0, 0.075, -0.54);
    rail(b, 0.11, 0.04, -0.2);
    b.add(rbox(0.03, 0.095, 0.045, 0.01), 'polymer', 0, -0.03, 0.05, 0.3, 0, 0);
    b.add(rbox(0.04, 0.08, 0.2, 0.012), 'polymer', 0, 0.05, 0.2, -0.08, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.004, -0.01);
    const mag = b.sub('mag', 0, 0.025, -0.13);
    b.add(rbox(0.04, 0.1, 0.06, 0.006), 'polymer', 0, -0.05, 0, -0.08, 0, 0, mag);
    reflexSight(b, 0.118, -0.06);
    b.marker('muzzle', 0, 0.075, -0.57);
    b.marker('leftHand', 0, 0.03, -0.32);
    b.marker('eject', 0.03, 0.08, -0.06);
    b.marker('magWell', 0, 0.025, -0.13);
    b.marker('charm', -0.028, 0.05, 0.03);
  },
  dmr(b) {
    b.add(rbox(0.048, 0.055, 0.3, 0.006), 'metal', 0, 0.075, -0.06);
    b.add(rbox(0.046, 0.04, 0.22, 0.006), 'polymer', 0, 0.035, -0.04);
    b.add(rbox(0.054, 0.058, 0.32, 0.01), 'tan', 0, 0.068, -0.37);
    rail(b, 0.106, 0.08, -0.5);
    b.add(cyl(0.012, 0.22), 'metal', 0, 0.072, -0.63);
    b.add(cyl(0.017, 0.06, 8), 'metal', 0, 0.072, -0.76);
    b.add(rbox(0.03, 0.095, 0.042, 0.008), 'polymer', 0, -0.025, 0.035, 0.28, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.025);
    b.add(rbox(0.042, 0.09, 0.2, 0.01), 'tan', 0, 0.05, 0.22);
    b.add(rbox(0.03, 0.025, 0.1, 0.006), 'polymer', 0, 0.105, 0.2);
    const mag = b.sub('mag', 0, 0.03, -0.11);
    b.add(rbox(0.028, 0.085, 0.07, 0.006), 'polymer', 0, -0.04, 0, -0.08, 0, 0, mag);
    bipod(b, 0.03, -0.42);
    scope3x(b, 0.17, -0.04, 0.112);
    b.marker('muzzle', 0, 0.072, -0.8);
    b.marker('leftHand', 0, 0.03, -0.34);
    b.marker('eject', 0.03, 0.08, -0.04);
    b.marker('magWell', 0, 0.03, -0.11);
    b.marker('charm', -0.026, 0.06, 0.04);
  },
  lmg(b) {
    b.add(rbox(0.06, 0.085, 0.36, 0.008), 'metal', 0, 0.075, -0.06);
    b.add(rbox(0.064, 0.02, 0.24, 0.004), 'polymer', 0, 0.126, -0.02);
    b.add(rbox(0.06, 0.06, 0.22, 0.01), 'polymer', 0, 0.07, -0.34);
    b.add(cyl(0.016, 0.36), 'metal', 0, 0.075, -0.56);
    b.add(cyl(0.021, 0.06, 10), 'metal', 0, 0.075, -0.76);
    b.add(rbox(0.012, 0.05, 0.12, 0.004), 'metal', 0, 0.14, -0.36); // carry handle
    b.add(rbox(0.03, 0.095, 0.044, 0.008), 'polymer', 0, -0.03, 0.05, 0.28, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.01);
    b.add(rbox(0.046, 0.1, 0.24, 0.012), 'polymer', 0, 0.05, 0.25, -0.08, 0, 0);
    const mag = b.sub('mag', -0.0, 0.0, -0.1);
    b.add(rbox(0.07, 0.12, 0.13, 0.008), 'olive', -0.01, -0.06, 0, 0, 0, 0, mag);
    b.add(rbox(0.02, 0.04, 0.03, 0.004), 'metal', 0.03, 0.01, 0, 0, 0, 0, mag);
    bipod(b, 0.035, -0.5);
    reflexSight(b, 0.136, -0.1);
    b.marker('muzzle', 0, 0.075, -0.8);
    b.marker('leftHand', 0, 0.035, -0.34);
    b.marker('eject', 0.034, 0.07, -0.06);
    b.marker('magWell', 0, 0.0, -0.1);
    b.marker('charm', -0.032, 0.06, 0.06);
  },
  lmgdrum(b) {
    b.add(rbox(0.052, 0.06, 0.32, 0.006), 'metal', 0, 0.075, -0.06);
    b.add(rbox(0.06, 0.064, 0.26, 0.012), 'olive', 0, 0.07, -0.36);
    rail(b, 0.106, 0.08, -0.46);
    b.add(cyl(0.015, 0.28), 'metal', 0, 0.075, -0.62);
    b.add(cyl(0.02, 0.05, 10), 'metal', 0, 0.075, -0.78);
    b.add(rbox(0.03, 0.095, 0.044, 0.008), 'polymer', 0, -0.028, 0.04, 0.28, 0, 0);
    b.add(rbox(0.006, 0.004, 0.06), 'metal', 0, 0.0, -0.02);
    b.add(rbox(0.044, 0.09, 0.22, 0.012), 'olive', 0, 0.055, 0.22);
    const mag = b.sub('mag', 0, 0.02, -0.12);
    const drum = new THREE.CylinderGeometry(0.065, 0.065, 0.06, 18);
    drum.rotateZ(Math.PI / 2);
    b.add(drum, 'polymer', 0, -0.075, 0, 0, 0, 0, mag);
    b.add(rbox(0.03, 0.05, 0.05, 0.005), 'polymer', 0, -0.01, 0, 0, 0, 0, mag);
    bipod(b, 0.03, -0.46);
    holoSight(b, 0.112, -0.06);
    b.marker('muzzle', 0, 0.075, -0.81);
    b.marker('leftHand', 0, 0.035, -0.36);
    b.marker('eject', 0.03, 0.08, -0.05);
    b.marker('magWell', 0, 0.02, -0.12);
    b.marker('charm', -0.028, 0.06, 0.05);
  },
  revolver(b) {
    b.add(rbox(0.028, 0.04, 0.11, 0.006), 'metal', 0, 0.06, -0.04);
    const cylg = new THREE.CylinderGeometry(0.02, 0.02, 0.045, 12);
    cylg.rotateX(Math.PI / 2);
    b.add(cylg, 'metal', 0, 0.055, -0.04);
    b.add(cyl(0.009, 0.16), 'metal', 0, 0.072, -0.17);
    b.add(rbox(0.012, 0.012, 0.16), 'metal', 0, 0.084, -0.17);
    b.add(rbox(0.004, 0.012, 0.008), 'metal', 0, 0.096, -0.24);
    b.add(rbox(0.006, 0.014, 0.012), 'metal', 0, 0.09, 0.02);
    b.add(rbox(0.032, 0.1, 0.045, 0.012), 'wood', 0, -0.015, 0.03, 0.32, 0, 0);
    b.add(rbox(0.005, 0.004, 0.035), 'metal', 0, 0.025, -0.03);
    b.marker('sight', 0, 0.1, 0.02);
    b.marker('muzzle', 0, 0.072, -0.255);
    b.marker('leftHand', -0.012, -0.015, 0.0);
    b.marker('eject', 0.02, 0.06, -0.04);
    b.marker('magWell', 0, 0.055, -0.04);
    b.marker('charm', -0.016, 0.02, 0.05);
  },
  axe(b) {
    // haft rises up and forward from the grip; the head sits at the top
    const tilt = 0.55, L = 0.46;
    const dy = Math.cos(tilt), dz = -Math.sin(tilt);
    const at = (t) => [0, 0.0 + dy * t, -0.02 + dz * t];
    const haft = new THREE.CylinderGeometry(0.011, 0.013, L, 10);
    haft.rotateX(-tilt);
    const [, hy, hz] = at(L / 2 - 0.05);
    b.add(haft, 'wood', 0, hy, hz);
    const grip = new THREE.CylinderGeometry(0.0145, 0.0145, 0.12, 10);
    grip.rotateX(-tilt);
    const [, gy, gz] = at(0.0);
    b.add(grip, 'polymer', 0, gy, gz);
    const [, ty, tz] = at(L - 0.08);
    b.add(rbox(0.026, 0.05, 0.05, 0.006), 'metal', 0, ty, tz, -tilt, 0, 0);
    const fy = -Math.sin(tilt), fz = -Math.cos(tilt); // forward, perpendicular to the haft
    b.add(rbox(0.007, 0.09, 0.11, 0.003), 'metal', 0, ty + fy * 0.07, tz + fz * 0.07, -tilt, 0, 0);
    b.add(rbox(0.0035, 0.1, 0.012, 0.001), 'metal', 0, ty + fy * 0.128, tz + fz * 0.128, -tilt, 0, 0);
    b.add(new THREE.ConeGeometry(0.011, 0.08, 6), 'metal', 0, ty - fy * 0.06, tz - fz * 0.06, Math.PI / 2 - tilt, 0, 0);
    b.add(rbox(0.028, 0.016, 0.054, 0.004), 'tan', 0, ty - 0.03, tz + 0.02, -tilt, 0, 0);
    b.marker('sight', 0, 0.1, 0.0);
    b.marker('muzzle', 0, ty, tz - 0.1);
    const [, ly, lz] = at(0.11);
    b.marker('leftHand', -0.005, ly - 0.02, lz);
    b.marker('eject', 0, 0, 0);
    b.marker('magWell', 0, 0, 0);
    b.marker('charm', -0.018, -0.03, 0.0);
  },
});

/**
 * Build a weapon model. options.merge collapses static parts into one mesh
 * per material (third-person use) while keeping markers.
 */
export function buildWeapon(modelId, mats, options = {}) {
  const b = new Builder(mats);
  b.att = visualAttachments(options.attachments);
  (BUILDERS[modelId] || BUILDERS.ar)(b);
  attachmentVisuals(b);
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

/** Attachment ids → visual variants used by the builders. */
function visualAttachments(build) {
  const out = {};
  if (!build) return out;
  const ATT = { opt_reflex: ['optic', 'reflex'], opt_holo: ['optic', 'holo'], opt_3x: ['optic', 'scope3x'], mz_supp: ['muzzle', 'supp'], mz_comp: ['muzzle', 'comp'], mz_choke: ['muzzle', 'comp'], mz_brake: ['muzzle', 'brake'], br_long: ['barrel', 'long'], mg_ext: ['magazine', 'ext'], ub_vgrip: ['underbarrel', 'vgrip'], ub_angled: ['underbarrel', 'angled'], ub_laser: ['underbarrel', 'laser'] };
  for (const id of Object.values(build)) { const v = ATT[id]; if (v) out[v[0]] = v[1]; }
  return out;
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
  } else if (kind === 'flash') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x8a8f86, roughness: 0.5, metalness: 0.5 }));
    g.add(body);
    for (const y of [-0.025, 0.0, 0.025]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0265, 0.0265, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0x24282a }));
      band.position.y = y; g.add(band);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.02, 10), mats.metal);
    top.position.y = 0.06; g.add(top);
  } else if (kind === 'shield') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x5c6468, metalness: 0.7, roughness: 0.4 }));
    g.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), mats.metal);
    handle.position.y = 0.07; g.add(handle);
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

/**
 * Weapon charm: split ring + short chain + pendant, pivoting at the top so the
 * viewmodel can swing it. Returns { group, pendulum } (pendulum is the swinging part).
 */
export function buildCharm(shape, color, mats) {
  const group = new THREE.Group();
  if (!shape || shape === 'none') return { group, pendulum: null };
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.3 });
  const m = new THREE.MeshStandardMaterial({ color, metalness: ['tag', 'star', 'cog', 'compass', 'spike'].includes(shape) ? 0.8 : 0.1, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 6, 12), chainMat);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  const pendulum = new THREE.Group();
  pendulum.position.y = -0.004;
  group.add(pendulum);
  for (let i = 0; i < 3; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.0028, 0.0008, 4, 8), chainMat);
    link.position.y = -0.006 - i * 0.0055;
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    pendulum.add(link);
  }
  const p = new THREE.Group();
  p.position.y = -0.03;
  pendulum.add(p);
  const add = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, mat = m) => { const o = new THREE.Mesh(g, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  switch (shape) {
    case 'tag': add(new RoundedBoxGeometry(0.003, 0.03, 0.019, 1, 0.0012)); break;
    case 'die': {
      add(new RoundedBoxGeometry(0.016, 0.016, 0.016, 2, 0.003));
      const dot = new THREE.MeshBasicMaterial({ color: 0x111111 });
      for (const [x, y] of [[0, 0], [0.0045, 0.0045], [-0.0045, -0.0045]]) add(new THREE.CircleGeometry(0.0016, 8), 0.0081, y, x, 0, Math.PI / 2, 0, dot);
      break;
    }
    case 'frag': add(new THREE.SphereGeometry(0.009, 10, 8)); add(new THREE.CylinderGeometry(0.003, 0.0035, 0.006, 8), 0, 0.011, 0, 0, 0, 0, chainMat); break;
    case 'star': {
      const sh = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.0055 : 0.013, a = (i / 10) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * r, y = -Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false });
      g.center();
      add(g, 0, 0, 0, 0, Math.PI / 2, 0);
      break;
    }
    case 'spike': add(new THREE.BoxGeometry(0.006, 0.034, 0.006)); add(new THREE.BoxGeometry(0.012, 0.004, 0.009), 0, 0.017, 0); break;
    case 'duck': add(new THREE.SphereGeometry(0.009, 10, 8)); add(new THREE.SphereGeometry(0.0062, 10, 8), 0, 0.009, -0.005); add(new THREE.ConeGeometry(0.0025, 0.006, 6), 0, 0.0085, -0.0115, -Math.PI / 2, 0, 0, new THREE.MeshStandardMaterial({ color: 0xff7a1a })); break;
    case 'cog': {
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.004, 12), 0, 0, 0, 0, 0, Math.PI / 2);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.BoxGeometry(0.004, 0.004, 0.004), 0, Math.cos(a) * 0.012, Math.sin(a) * 0.012); }
      break;
    }
    case 'compass': {
      add(new THREE.CylinderGeometry(0.011, 0.011, 0.005, 16), 0, 0, 0, 0, 0, Math.PI / 2);
      add(new THREE.CircleGeometry(0.009, 16), 0.0026, 0, 0, 0, Math.PI / 2, 0, new THREE.MeshStandardMaterial({ color: 0xf2eee4 }));
      add(new THREE.BoxGeometry(0.0008, 0.014, 0.002), 0.003, 0, 0, 0, 0, 0, new THREE.MeshBasicMaterial({ color: 0xc8302a }));
      break;
    }
    default: add(new THREE.SphereGeometry(0.008, 8, 6));
  }
  return { group, pendulum };
}
