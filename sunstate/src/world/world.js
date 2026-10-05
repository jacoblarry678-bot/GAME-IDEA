/**
 * World: owns static collision, world meshes and props, and animates the
 * time-of-day dependent parts (window lights, neon, streetlights, signals).
 */
import * as THREE from 'three';
import { CollisionWorld } from './collision.js';
import { makeMaterials, buildWorld } from './build.js';
import { buildProps, updateProps } from './props.js';
import { INTERIORS, PLACES } from './district.js';
import { groundHeight, isWater, surfaceAt, WATER_Y } from './layout.js';

export class World {
  constructor(engine) {
    this.engine = engine;
    this.collision = new CollisionWorld();
    this.mats = makeMaterials(engine);
    const built = buildWorld(engine, this.collision, this.mats);
    this.group = built.group;
    this.signs = built.signs;
    this.water = built.water;
    this.props = buildProps(this.collision, this.mats);
    engine.scene.add(this.group, this.props.group);
    this.facades = Object.entries(this.mats).filter(([k]) => k.startsWith('fac:')).map(([, m]) => m);
    this.fronts = Object.entries(this.mats).filter(([k]) => k.startsWith('front:')).map(([, m]) => m);
    this.signalClock = 0;
    this.places = PLACES;
    this.interiors = INTERIORS;
    const store = INTERIORS.find((i) => i.id === 'store');
    engine.interiorLight.position.set((store.x0 + store.x1) / 2, 3.6, (store.z0 + store.z1) / 2);
    engine.interiorLight.intensity = 30;
  }

  /** A car hit a piece of street furniture hard enough to knock it over. */
  breakProp(collider) {
    const d = collider.data;
    if (!d || d.broken) return;
    d.broken = true;
    this.collision.remove(collider);
    d.matrix = new THREE.Matrix4();
    d.mesh.getMatrixAt(d.index, d.matrix);
    (this.broken || (this.broken = [])).push(collider);
    d.mesh.setMatrixAt(d.index, new THREE.Matrix4().makeScale(0, 0, 0));
    d.mesh.instanceMatrix.needsUpdate = true;
    this.onPropBroken?.(collider);
  }

  /** Put knocked-over furniture back (new game / continue). */
  restoreProps() {
    for (const c of this.broken || []) {
      const d = c.data;
      d.broken = false;
      d.mesh.setMatrixAt(d.index, d.matrix);
      d.mesh.instanceMatrix.needsUpdate = true;
      this.collision.add(c);
    }
    this.broken = [];
  }

  ground(x, z, y) { return groundHeight(x, z, y); }
  isWater(x, z) { return isWater(x, z); }
  surface(x, z, y) { return surfaceAt(x, z, y); }
  get waterY() { return WATER_Y; }

  /** Interior containing a point, or null. */
  interiorAt(x, z, y = 0) {
    for (const i of this.interiors) if (x > i.x0 && x < i.x1 && z > i.z0 && z < i.z1 && y < i.ceiling + 0.5) return i;
    return null;
  }

  update(dt) {
    const night = this.engine.time.night;
    this.signalClock += dt;
    for (const m of this.facades) m.emissiveIntensity = night * 1.15;
    for (const m of this.fronts) m.emissiveIntensity = 0.06 + night * 0.85;
    this.mats.neon.color.setScalar(0.85 + night * 2.4);
    for (const s of this.signs) s.material.emissiveIntensity = s.userData.neonSign ? 0.35 + night * 1.8 : 0.08 + night * 0.45;
    updateProps(this.props, night, this.signalClock, dt);
    this.water.userData.update(dt);
    // gentle palm sway
    const crowns = this.props.crowns;
    crowns.userData.t = (crowns.userData.t || 0) + dt;
    if (!crowns.userData.acc || crowns.userData.t - crowns.userData.acc > 0.1) {
      crowns.userData.acc = crowns.userData.t;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const tt = crowns.userData.t;
      crowns.userData.sway.forEach((d, i) => {
        e.set(Math.sin(tt * 0.9 + i) * 0.05, d.yaw + Math.sin(tt * 0.5 + i * 0.7) * 0.06, Math.cos(tt * 0.8 + i * 1.3) * 0.05);
        q.setFromEuler(e);
        m.compose(d.top, q, new THREE.Vector3(d.s, d.s, d.s));
        crowns.setMatrixAt(i, m);
      });
      crowns.instanceMatrix.needsUpdate = true;
    }
  }

  /** Signal time base shared with traffic AI. */
  get signalTime() { return this.signalClock; }
}
