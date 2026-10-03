/**
 * FIRING RANGE — weapon testing ground.
 * Covered firing line at z = 0 facing -Z; targets at 10 / 25 / 40 / 60 / 90 m,
 * distance boards, side walls and an earth berm. A short close-quarters lane
 * on the east side has targets at 5 and 8 m behind cover.
 */
import * as THREE from 'three';
import { signTexture } from '../textures.js';

export const FIRING_RANGE = {
  id: 'firing_range',
  name: 'FIRING RANGE',
  blurb: 'Test weapons against training targets at marked distances.',
  bounds: { minX: -22, maxX: 22, minZ: -108, maxZ: 14 },
  sun: { dir: [-0.35, 0.72, 0.6], color: 0xfff0d8, intensity: 3.0 },
  sky: { top: 0x5a88bd, horizon: 0xdcd0bb, ground: 0x5a5146 },
  fog: { color: 0xc9c1b2, density: 0.004 },
  shadowExtent: { cx: 0, cz: -45, half: 70 },
  build,
  targets: [
    { x: -6, z: -10, d: 10 }, { x: 0, z: -10, d: 10, crouch: true }, { x: 6, z: -10, d: 10 },
    { x: -9, z: -25, d: 25 }, { x: 0, z: -25, d: 25, move: { amp: 4, speed: 1.3 } }, { x: 9, z: -25, d: 25, crouch: true },
    { x: -5, z: -40, d: 40 }, { x: 5, z: -40, d: 40, move: { amp: 5, speed: 1.0 } },
    { x: -7, z: -60, d: 60 }, { x: 7, z: -60, d: 60, move: { amp: 5, speed: 0.8 } },
    { x: 0, z: -90, d: 90 },
    { x: 16.5, z: -5, d: 5 }, { x: 18.5, z: -8, d: 8, crouch: true },
  ],
};

function build(b) {
  const B = FIRING_RANGE.bounds;
  // ground: concrete pad at the firing line, packed gravel downrange
  b.box(-60, -1, -140, 60, 0, 60, 'gravel', { faces: 4, map: false });
  b.box(-20, 0, -2, 20, 0.02, 12, 'concrete', { collide: false, map: false });
  // lane stripes
  for (const x of [-12, -3, 3, 12]) b.box(x - 0.05, 0, -100, x + 0.05, 0.004, -2, 'paint_white', { collide: false });
  for (const d of [10, 25, 40, 60, 90]) b.box(-14, 0, -d - 0.06, 14, 0.004, -d + 0.06, 'paint_yellow', { collide: false });
  // perimeter
  b.box(B.minX, 0, B.minZ, B.minX + 0.6, 4, B.maxZ, 'concrete', { map: 'wall' });
  b.box(B.maxX - 0.6, 0, B.minZ, B.maxX, 4, B.maxZ, 'concrete', { map: 'wall' });
  b.box(B.minX, 0, B.maxZ - 0.6, B.maxX, 4, B.maxZ, 'concrete', { map: 'wall' });
  b.box(B.minX, 0, B.minZ, B.maxX, 9, B.minZ + 4, 'gravel', { map: 'wall' }); // berm
  b.box(B.minX, 9, B.minZ, B.maxX, 10, B.minZ + 2, 'gravel', { map: false });
  b.blocker(B.minX - 2, 0, B.minZ - 2, B.minX, 30, B.maxZ + 2);
  b.blocker(B.maxX, 0, B.minZ - 2, B.maxX + 2, 30, B.maxZ + 2);
  b.blocker(B.minX, 0, B.maxZ, B.maxX, 30, B.maxZ + 2);
  b.blocker(B.minX, 0, B.minZ - 2, B.maxX, 30, B.minZ);
  // firing line: bench + canopy
  b.box(-12.5, 0, -0.9, -1.0, 0.95, -0.2, 'wood', { map: 'low' });
  b.box(1.0, 0, -0.9, 12.5, 0.95, -0.2, 'wood', { map: 'low' });
  b.box(-14, 3.6, -1.5, 14, 3.8, 8, 'roof', { map: false });
  for (const x of [-13.6, -4.5, 4.5, 13.6]) b.box(x - 0.15, 0, -1.3, x + 0.15, 3.6, -1.0, 'steel_yellow', { map: false });
  for (const x of [-8, 0, 8]) b.box(x - 0.6, 3.5, 2, x + 0.6, 3.56, 2.3, 'lamp', { collide: false });
  b.box(-14, 0, 7.6, 14, 3.6, 8, 'corrugated_green', { map: 'wall' });
  // weapon racks along the back wall (visual)
  for (let x = -11; x <= 11; x += 2.2) b.box(x - 0.8, 0, 6.6, x + 0.8, 1.6, 7.4, 'steel_green', { map: false });
  // cover pieces downrange to practice peeking
  b.box(-11, 0, -18.5, -8, 1.05, -18, 'concrete', { map: 'low' });
  b.box(8, 0, -33, 11, 1.05, -32.5, 'concrete', { map: 'low' });
  b.box(-1.5, 0, -50.5, 1.5, 1.6, -50, 'concrete', { map: 'low' });
  // CQB lane (east): low walls and two close targets
  b.box(14, 0, -2, 14.3, 2.6, -14, 'brick', { map: 'wall' });
  b.box(14.3, 0, -6.5, 16.2, 1.1, -6.2, 'brick', { map: 'low' });
  b.box(17.4, 0, -10.5, 21.4, 2.6, -10.2, 'brick', { map: 'wall' });
  // target frames (behind each target position)
  for (const t of FIRING_RANGE.targets) {
    if (t.move) b.box(t.x - t.move.amp - 0.6, 0, t.z - 0.9, t.x + t.move.amp + 0.6, 0.12, t.z - 0.7, 'metal', { collide: false });
    else b.box(t.x - 0.7, 0, t.z - 0.9, t.x + 0.7, 0.1, t.z - 0.75, 'metal', { collide: false });
  }
  // spawn on the firing line, facing downrange
  b.spawn(0, 0, 2.5, 0);
  b.spawn(0, -2, 2.5, 0);
  b.spawn(0, 2, 2.5, 0);
  b.hotspot(0, 2, 'Firing line', 1);
  b.label(0, 3, 'FIRING LINE');
  for (const d of [10, 25, 40, 60, 90]) b.label(-16, -d, `${d}m`);
  b.pointLight(0, 3.2, 2, 0xffe2b8, 6, 12);
  if (b.headless) return;
  // distance boards
  for (const d of [10, 25, 40, 60, 90]) {
    const tex = signTexture(`${d} M`, { w: 256, h: 128, bg: '#e7e2d6', fg: '#1b1b1b', size: 0.62 });
    for (const x of [-15.5, 15.5]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
      m.position.set(x, 2.2, -d);
      b.addObject(m);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), b.materials.get('metal').mat);
      post.position.set(x, 1.1, -d - 0.05);
      b.addObject(post);
    }
  }
  const t = signTexture('ASHLINE TRAINING RANGE · EYE & EAR PROTECTION REQUIRED', { w: 1024, h: 96, bg: '#1e3a28', size: 0.42 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.03), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  s.position.set(0, 2.6, 7.55); s.rotation.y = Math.PI;
  b.addObject(s);
}
