/**
 * Procedural car meshes from the side profiles in data/vehicles.js:
 * an extruded, bevelled body with wheel arches, a glass greenhouse with a
 * painted roof, bumpers, lights, mirrors, wheels, and police livery.
 * Local frame: +z forward, +x left-to-right is -x… (see below), y up, origin
 * at the ground under the centre of the wheelbase footprint.
 */
import * as THREE from 'three';
import { signTexture, plateTexture } from '../world/textures.js';

const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2632, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.4 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.25, metalness: 0.9 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6, metalness: 0.2 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdadfe3, roughness: 0.15, metalness: 1 });
const interiorMat = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.9 });

const tireGeo = new THREE.CylinderGeometry(1, 1, 1, 18);
tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.04, 10);
rimGeo.rotateZ(Math.PI / 2);
const spokeGeo = new THREE.BoxGeometry(1.06, 0.12, 1.1);
for (const g of [tireGeo, rimGeo, spokeGeo]) g.userData.shared = true;

/** Shape from profile points, with concave wheel arches cut into the bottom edge. */
function bodyShape(def) {
  const s = new THREE.Shape();
  const p = def.profile;
  const L = def.length;
  const rear = (L - def.wheelbase) / 2 + 0.05, front = rear + def.wheelbase;
  const r = def.wheelR + 0.06;
  const bottom = Math.min(p[0][1], p[p.length - 1][1]);
  s.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
  // underside back toward the rear with arches over the wheel centres
  s.lineTo(front + r, bottom);
  s.absarc(front, def.wheelR, r, 0, Math.PI, false);
  s.lineTo(rear + r, bottom);
  s.absarc(rear, def.wheelR, r, 0, Math.PI, false);
  s.lineTo(p[0][0], bottom);
  s.closePath();
  return s;
}

function extrude(shape, width, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 });
  // shape x = forward, y = up, extrude z = width → rotate so forward is +z
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  return g;
}

function polyShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export function buildCarModel(def, color, opts = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitches and rolls on the suspension
  root.add(body);
  const L = def.length, W = def.width;
  const ox = -L / 2; // profile x → local z offset
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45, envMapIntensity: 1.1 });
  const parts = { paint };

  const bodyGeo = extrude(bodyShape(def), W, 0.08);
  bodyGeo.translate(0, 0, ox);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  body.add(bodyMesh);

  // greenhouse: glass, narrower than the body, with a painted roof on top
  const c = def.cabin;
  const cabGeo = extrude(polyShape([[c[0][0], c[0][1] - 0.04], [c[1][0], c[1][1]], [c[2][0], c[2][1]], [c[3][0], c[3][1] - 0.04]]), W * 0.86, 0.07);
  cabGeo.translate(0, 0, ox);
  const cab = new THREE.Mesh(cabGeo, glassMat);
  cab.castShadow = true;
  body.add(cab);
  const roofGeo = extrude(polyShape([[c[1][0] + 0.06, c[1][1] - 0.04], [c[2][0] - 0.02, c[2][1] - 0.04], [c[2][0] - 0.05, c[2][1] + 0.03], [c[1][0] + 0.1, c[1][1] + 0.03]]), W * 0.84, 0.03);
  roofGeo.translate(0, 0, ox);
  const roof = new THREE.Mesh(roofGeo, opts.police ? new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.35, metalness: 0.3 }) : paint);
  roof.castShadow = true;
  body.add(roof);
  // pillars between side windows
  const midX = (c[1][0] + c[2][0]) / 2 + ox;
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, (c[1][1] - c[0][1]) * 0.95, 0.09), trimMat);
    pillar.position.set(s * W * 0.43, (c[0][1] + c[1][1]) / 2, midX);
    body.add(pillar);
  }
  // pickup bed
  if (def.bed) {
    const [b0, b1] = def.bed;
    const top = def.profile[1][1];
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.05, b1 - b0 - 0.1), trimMat);
    bed.position.set(0, top - 0.42, ox + (b0 + b1) / 2);
    body.add(bed);
  }
  // seats and steering wheel, visible through the glass
  for (const [sx, , sz] of def.seats) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), interiorMat);
    seat.position.set(sx, def.profile[1][1] + 0.08, sz - 0.25);
    body.add(seat);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), trimMat);
  wheel.position.set(def.seats[0][0], def.profile[1][1] + 0.22, def.seats[0][2] + 0.42);
  wheel.rotation.x = -0.4;
  body.add(wheel);

  // bumpers
  const bumpY = def.profile[0][1] + 0.12;
  for (const z of [ox + 0.04, ox + L - 0.04]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.2, 0.18), opts.police ? trimMat : chromeMat.clone());
    if (!opts.police && def.class !== 'Muscle') b.material = trimMat;
    b.position.set(0, bumpY, z);
    body.add(b);
  }
  // lights: headlights (white), tail lights (red); materials animated by Vehicle
  const fy = def.profile[def.profile.length - 2][1] - 0.08;
  const ry = def.profile[1][1] - 0.1;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0xfff3d6, emissiveIntensity: 0.2, roughness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0a0a, emissive: 0xff1a1a, emissiveIntensity: 0.3, roughness: 0.3 });
  const revMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  parts.head = headMat; parts.tail = tailMat; parts.reverse = revMat;
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.06), headMat);
    h.position.set(s * (W / 2 - 0.3), fy, ox + L - 0.02);
    body.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), tailMat);
    t.position.set(s * (W / 2 - 0.28), ry, ox + 0.0);
    body.add(t);
    const rv = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), revMat);
    rv.position.set(s * (W / 2 - 0.58), ry, ox + 0.0);
    body.add(rv);
    // mirrors
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), opts.police ? trimMat : paint);
    m.position.set(s * (W / 2 + 0.06), c[0][1] + 0.08, ox + c[0][0] + 0.25);
    body.add(m);
  }
  // grille and plates
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, 0.16, 0.04), trimMat);
  grille.position.set(0, fy - 0.02, ox + L + 0.0);
  body.add(grille);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: plateTexture(opts.plate || 'SUN 455'), roughness: 0.5 }));
  plate.position.set(0, bumpY + 0.17, ox - 0.03);
  plate.rotation.y = Math.PI;
  body.add(plate);
  parts.plate = plate;

  if (def.stripes) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, L * 0.98), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.3, metalness: 0.3 }));
    stripe.position.set(0, def.profile[2][1] + 0.035, 0.0);
    body.add(stripe);
  }
  if (opts.police) policeLivery(def, body, parts, ox);

  // wheels (not on the suspended body: they stay on the ground)
  const wheels = [];
  const rear = ox + (L - def.wheelbase) / 2 + 0.05, front = rear + def.wheelbase;
  for (const [z, isFront] of [[front, true], [rear, false]]) {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * (def.track / 2), def.wheelR, z);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.scale.set(0.24, def.wheelR, def.wheelR);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.scale.set(0.24, def.wheelR, def.wheelR);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.scale.set(0.24, def.wheelR, def.wheelR);
      spin.add(tire, rim, spoke);
      pivot.add(spin);
      root.add(pivot);
      wheels.push({ pivot, spin, front: isFront, side: s, z });
    }
  }
  return { root, body, wheels, parts };
}

function policeLivery(def, body, parts, ox) {
  const W = def.width, L = def.length;
  // white doors with POLICE lettering
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.35, metalness: 0.3 });
  const tex = signTexture('POLICE', { fg: '#14233f', font: '900 70px Arial' });
  const letter = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4 });
  const c = def.cabin;
  const dz0 = ox + c[0][0] + 0.1, dz1 = ox + c[3][0] + 0.15;
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, dz1 - dz0), doorMat);
    door.position.set(s * (W / 2 + 0.005), 0.62, (dz0 + dz1) / 2);
    body.add(door);
    const word = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4 / tex.userData.aspect), letter);
    word.position.set(s * (W / 2 + 0.02), 0.64, (dz0 + dz1) / 2);
    word.rotation.y = s * Math.PI / 2;
    body.add(word);
  }
  // light bar
  const barY = c[1][1] + 0.08;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.07, 0.3), trimMat);
  base.position.set(0, barY, ox + (c[1][0] + c[2][0]) / 2);
  body.add(base);
  const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1020, emissiveIntensity: 0, roughness: 0.2 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x000a55, emissive: 0x1060ff, emissiveIntensity: 0, roughness: 0.2 });
  for (const [s, m] of [[-1, red], [1, blue]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(W * 0.32, 0.1, 0.26), m);
    l.position.set(s * W * 0.18, barY + 0.07, base.position.z);
    body.add(l);
  }
  parts.sirenRed = red; parts.sirenBlue = blue;
  // push bar
  const push = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.4, 0.08), trimMat);
  push.position.set(0, 0.55, ox + L + 0.08);
  body.add(push);
}
