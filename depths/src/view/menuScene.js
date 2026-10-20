/**
 * Main menu backdrop: looking across an empty service desk. The wall clock
 * advances normally. No timed scares.
 */
import * as THREE from 'three';
import { mat } from './materials.js';
import { boxGeo } from './geom.js';
import { clockFace } from './art.js';
import { BUILD } from './propMeshes.js';
import { Batcher, PropBuilder, placement } from './geom.js';

export class MenuScene {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    const B = new Batcher();
    const k = 'm';
    B.add(k, 'carpet', boxGeo(-6, -0.02, -6, 6, 0, 4, 2, 4));
    B.add(k, 'ceilingTile', boxGeo(-6, 3, -6, 6, 3.05, 4, 1.2, 8));
    B.add(k, 'wallpaper', boxGeo(-6, 0, -6.2, 6, 3, -6, 1, 16));
    B.add(k, 'wallpaper', boxGeo(-6.2, 0, -6, -6, 3, 4, 1, 1));
    B.add(k, 'wallpaper', boxGeo(6, 0, -6, 6.2, 3, 4, 1, 2));
    B.add(k, 'trim', boxGeo(-6, 0, -6, 6, 0.1, -5.97, 1));
    const put = (kind, x, z, rot, s) => { const p = { k: kind, s }; const dims = s || null; BUILD[kind](new PropBuilder(B, k, placement(x, 0, z, rot)), ...(dims || defaults(kind)), p); };
    put('counter', 0.5, -3.2, 0);
    put('chair', 0.4, -4.1, 180);
    put('plant', -3.8, -5.4, 0);
    put('cabinet', 3.6, -5.6, 0);
    put('partition', -2.6, -1.2, 90, [3, 0.08, 1.5]);
    B.build(this.root);
    // fixtures
    for (const [x, z] of [[0, -3], [-3, 0], [3, 0]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), mat('lamp'));
      l.position.set(x, 2.98, z); this.root.add(l);
    }
    this.light = new THREE.PointLight(0xfff0c0, 9, 12, 1.6); this.light.position.set(0, 2.6, -3);
    this.light2 = new THREE.PointLight(0xfff0c0, 4, 10, 1.6); this.light2.position.set(-3, 2.6, 0);
    this.root.add(this.light, this.light2);
    // clock
    const clock = new THREE.Group();
    clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 })));
    const hand = (len, w, m, z) => { const h = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), mat(m)); b.position.y = len / 2 - 0.02; h.add(b); h.position.z = z; clock.add(h); return h; };
    this.hh = hand(0.12, 0.02, 'black', 0.01); this.mh = hand(0.19, 0.014, 'black', 0.015); this.sh = hand(0.22, 0.006, 'redPaint', 0.02);
    clock.position.set(0.5, 2.2, -5.98);
    this.root.add(clock);
    this.cam = new THREE.Vector3(-2.2, 1.55, 2.6);
    this.look = new THREE.Vector3(0.6, 1.25, -4.5);
  }
  attach() { this.engine.scene.add(this.root); this.engine.scene.fog = new THREE.FogExp2(0x8a7a3a, 0.03); this.engine.hemi.intensity = 0.35; }
  detach() { this.engine.scene.remove(this.root); }
  update(dt, t) {
    const d = new Date();
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    this.sh.rotation.z = -s / 60 * Math.PI * 2;
    this.mh.rotation.z = -m / 60 * Math.PI * 2;
    this.hh.rotation.z = -h / 12 * Math.PI * 2;
    const c = this.engine.camera;
    c.position.set(this.cam.x + Math.sin(t * 0.07) * 0.15, this.cam.y + Math.sin(t * 0.11) * 0.03, this.cam.z);
    c.lookAt(this.look);
  }
}
function defaults(kind) {
  const D = { counter: [3, 0.8, 1.05], chair: [0.55, 0.55, 0.9], plant: [0.45, 0.45, 1.3], cabinet: [0.5, 0.65, 1.35] };
  return D[kind] || [1, 1, 1];
}
