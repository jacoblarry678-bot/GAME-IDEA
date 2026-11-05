/**
 * Procedural car meshes. Each body is lofted from the `look` in data/vehicles.js: a run of
 * cross-sections along the car, each a rounded section with tumblehome (the sides lean in
 * toward the top), shaped in side view by smooth upper and lower lines, rounded at the
 * corners in plan view, with real wheel arches cut out. The greenhouse is lofted the same
 * way and split into glass, painted pillars and roof, and black trim. Clearcoat paint,
 * see-through tinted glass with seats and a dash behind it, alloy wheels with brake discs,
 * door seams, handles, mirrors, wrapped lamps and a police livery.
 *
 * Local frame: +z forward, y up, origin on the ground under the middle of the car.
 * (Profile x in the look data runs forward from the rear bumper.)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { signTexture, plateTexture } from '../world/textures.js';

const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x04070a, roughness: 0.03, metalness: 0.15, transparent: true, opacity: 0.86, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.88 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc3c7cc, roughness: 0.22, metalness: 0.95 });
const wheelDarkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
// the matte dark parts of a car (trim, seats, dash) share one vertex-coloured material: one draw call
const darkVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.1 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.1 });
const wellMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 1, side: THREE.DoubleSide });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e6ea, roughness: 0.1, metalness: 1 });
const interiorMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.85 });
const dashMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.7 });
const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, clearcoat: 1, depthWrite: false });
const stripeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f0, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });

// ---------------------------------------------------------------------------------------
// curves

/** Monotone cubic interpolation through [x, y] points (no overshoot); clamps outside. */
function spline(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------------------------------------------------------------------------------------
// lofting

/**
 * Build a loft: `stations` x positions, `section(x)` returns an array of [u, y] from the
 * left side over the top to the right side (u lateral, signed), `faceMat(xMid, k, nSeg)`
 * picks a material slot for each quad (k = segment index across the section).
 */
function loft(stations, section, faceMat, slots) {
  const pos = [], uvs = [];
  let row = 0;
  for (const x of stations) {
    const s = section(x);
    row = s.length;
    let along = 0;
    for (let k = 0; k < s.length; k++) {
      if (k) along += Math.hypot(s[k][0] - s[k - 1][0], s[k][1] - s[k - 1][1]);
      pos.push(s[k][0], s[k][1], x);
      uvs.push(x, along);
    }
  }
  const lists = Array.from({ length: slots }, () => []);
  for (let i = 0; i < stations.length - 1; i++) {
    const xm = (stations[i] + stations[i + 1]) / 2;
    for (let k = 0; k < row - 1; k++) {
      const a = i * row + k, b = a + row;
      // sections run from one side over the top to the other, so one winding faces outward
      lists[faceMat(xm, k, row - 1)].push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const idx = [];
  lists.forEach((l, slot) => { g.addGroup(idx.length, l.length, slot); for (const v of l) idx.push(v); });
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Fill a closed section polygon (an end cap) facing `dir` (+1 forward, -1 back). */
function cap(sec, x, dir) {
  const cx = 0, cy = sec.reduce((a, p) => a + p[1], 0) / sec.length;
  const pos = [cx, cy, x], idx = [];
  for (const p of sec) pos.push(p[0], p[1], x);
  for (let k = 0; k < sec.length - 1; k++) {
    if (dir > 0) idx.push(0, k + 1, k + 2); else idx.push(0, k + 2, k + 1);
  }
  // close the bottom edge back across
  if (dir > 0) idx.push(0, sec.length, 1); else idx.push(0, 1, sec.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------
// shared wheel parts (unit radius; scaled by the wheel radius)

const WHEEL = (() => {
  // tyre: lathe around y, then turned so the axle is x
  const prof = [[0.64, -0.37], [0.9, -0.37], [0.97, -0.33], [1.0, -0.26], [1.0, 0.26], [0.97, 0.33], [0.9, 0.37], [0.64, 0.37]];
  const tire = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  tire.rotateZ(Math.PI / 2);
  // alloy face: a disc with five windows between the spokes, on both sides of the wheel
  const face = new THREE.Shape();
  face.absarc(0, 0, 0.66, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2 + 0.2, a1 = a0 + Math.PI * 2 / 5 - 0.4;
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.56, a0, a1, false);
    hole.absarc(0, 0, 0.24, a1 - 0.08, a0 + 0.08, true);
    hole.closePath();
    face.holes.push(hole);
  }
  const disc = new THREE.ExtrudeGeometry(face, { depth: 0.06, bevelEnabled: false, curveSegments: 9 });
  const faces = [];
  for (const s of [-1, 1]) {
    const g = disc.clone();
    g.rotateY(s * Math.PI / 2);
    g.translate(s * 0.26, 0, 0);
    faces.push(g);
  }
  const hub = new THREE.CylinderGeometry(0.12, 0.14, 0.62, 12).rotateZ(Math.PI / 2);
  const rim = mergeGeometries([...faces, hub].map((g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; }), false);
  // barrel and brake disc seen through the spokes
  const barrel = new THREE.CylinderGeometry(0.64, 0.64, 0.6, 12, 1, true).rotateZ(Math.PI / 2);
  const brake = new THREE.CylinderGeometry(0.48, 0.48, 0.05, 12).rotateZ(Math.PI / 2);
  // one draw call for the dark parts: tyre, barrel (seen through the spokes) and brake disc
  const colourOf = (g, hex) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const dark = mergeGeometries([colourOf(tire, 0x161616), colourOf(barrel, 0x0a0a0b), colourOf(brake, 0x5c5f63)], false);
  for (const g of [dark, rim]) g.userData.shared = true;
  return { dark, rim };
})();

// ---------------------------------------------------------------------------------------

/** Plan-view half width at profile x: full width in the middle, rounded at the corners. */
function planWidth(look, W, L) {
  const { rear = 0.45, front = 0.6, k = 0.74 } = look.plan || {};
  return (x) => {
    const dr = x, df = L - x;
    const corner = (d, rc) => { const e = Math.max(0, Math.min(1, (rc - d) / rc)); return 1 - (1 - k) * (1 - Math.sqrt(1 - e * e)); };
    return (W / 2) * Math.min(corner(dr, rear), corner(df, front));
  };
}

// body section: [lateral fraction of the half width, height fraction from sill to top]
const BODY_SEC = [[0.94, 0], [0.995, 0.1], [1, 0.4], [0.992, 0.6], [0.972, 0.78], [0.93, 0.9], [0.84, 0.97], [0.62, 0.995]];
const STRIPE_U = [0.215, 0.07]; // lateral metres of the twin stripes' outer and inner edges

export function buildCarModel(def, color, opts = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitches and rolls on the suspension
  root.add(body);
  const look = def.look;
  const L = def.length, W = def.width, ox = -L / 2;
  // static details are baked into one mesh per material (far fewer draw calls)
  const bins = new Map();
  const part = (...meshes) => {
    for (const m of meshes) {
      m.updateMatrix();
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      if (g.attributes.uv) g.deleteAttribute('uv');
      g.applyMatrix4(m.matrix);
      let mat = m.material;
      if (mat === trimMat || mat === interiorMat || mat === dashMat) {
        const c = mat.color, n = g.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
        mat = darkVC;
      }
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(g);
    }
  };
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });
  const parts = { paint };
  const police = !!opts.police;
  const roofPaint = police ? new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }) : paint;

  const top = spline(look.top), bot = spline(look.bot), hw = planWidth(look, W, L);
  const rearAx = (L - def.wheelbase) / 2 + 0.05, frontAx = rearAx + def.wheelbase;
  const archR = def.wheelR + 0.075;
  const archY = (x) => {
    let y = -1;
    for (const ax of [rearAx, frontAx]) { const dx = x - ax; if (Math.abs(dx) < archR) y = Math.max(y, def.wheelR + Math.sqrt(archR * archR - dx * dx)); }
    return y;
  };
  const crown = look.crown ?? 0.03;

  // --- body ---------------------------------------------------------------------------
  const halfSec = (x) => {
    const h = hw(x), t = top(x), b0 = bot(x), ay = archY(x);
    const pts = BODY_SEC.map(([u, f]) => {
      let y = b0 + f * (t - b0) + crown * (1 - u * u) * Math.max(0, (f - 0.85) / 0.15);
      if (u > 0.8 && ay > 0) y = Math.max(y, Math.min(ay, t - 0.04));
      return [u * h, y];
    });
    // the crown and the twin stripe edges across the top
    for (const s of [STRIPE_U[0], STRIPE_U[1], 0]) pts.push([s, t + crown * (1 - (s / h) ** 2)]);
    return pts;
  };
  const section = (x) => {
    const r = halfSec(x);
    const left = r.slice(0, -1).map(([u, y]) => [u, y]);
    const right = r.slice(0, -1).reverse().map(([u, y]) => [-u, y]);
    return [...left, [0, r[r.length - 1][1]], ...right];
  };
  const N = 60, stations = [];
  for (let i = 0; i <= N; i++) { const t = i / N; stations.push(L * (0.3 * t + 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * t)))); }
  const nHalf = BODY_SEC.length + 2; // segments per side before the centre
  const bodySlots = [paint, trimMat, def.stripes ? stripeMat : paint];
  const bodyGeo = loft(stations, section, (xm, k, nSeg) => {
    const fromEdge = Math.min(k, nSeg - 1 - k); // 0 at the bottom edges
    if (look.bed && xm > look.bed[0] && xm < look.bed[1] && fromEdge >= BODY_SEC.length - 1) return 1; // tonneau cover
    if (def.stripes && (k === nHalf - 2 || k === nSeg - nHalf + 1)) return 2;
    return 0;
  }, 3);
  bodyGeo.translate(0, 0, ox);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodySlots);
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  body.add(bodyMesh);
  const caps = mergeGeometries([cap(section(stations[0]), stations[0] + ox, -1), cap(section(stations[N]), stations[N] + ox, 1)], false);
  const capMesh = new THREE.Mesh(caps, paint);
  capMesh.castShadow = true;
  body.add(capMesh);
  // floor pan and wheel wells (so you can't see through the arches)
  const pan = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.9), trimMat);
  pan.position.set(0, bot(L / 2) + 0.02, 0);
  part(pan);
  for (const ax of [rearAx, frontAx]) {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(archR - 0.01, archR - 0.01, W * 0.96, 16, 1, true, 0, Math.PI), wellMat);
    well.rotation.z = Math.PI / 2;
    well.position.set(0, def.wheelR, ox + ax);
    part(well);
  }

  // surface helper: a strip that follows the body side at profile x
  const sidePoint = (x, f, side) => {
    const h = hw(x), t = top(x), b0 = bot(x);
    // interpolate the side section at height fraction f
    let i = 0;
    while (i < BODY_SEC.length - 2 && BODY_SEC[i + 1][1] < f) i++;
    const [u0, f0] = BODY_SEC[i], [u1, f1] = BODY_SEC[i + 1];
    const u = u0 + (u1 - u0) * ((f - f0) / Math.max(1e-6, f1 - f0));
    return new THREE.Vector3(side * u * h, b0 + f * (t - b0), x + ox);
  };
  const seamGeo = (x, f0, f1, side, w = 0.012) => {
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const f = f0 + (f1 - f0) * (j / 6), p = sidePoint(x, f, side);
      if (archY(x) > p.y) continue;
      pts.push(p);
    }
    if (pts.length < 2) return null;
    const pos = [];
    for (const p of pts) { const o = side * 0.003; pos.push(p.x + o, p.y, p.z - w / 2, p.x + o, p.y, p.z + w / 2); }
    const idx = [];
    for (let j = 0; j < pts.length - 1; j++) { const a = j * 2; if (side > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };

  // --- greenhouse -----------------------------------------------------------------------
  const [xr, xrr, xrf, xw] = look.cabin.x, roofY = look.cabin.roof, tumble = look.cabin.tumble ?? 0.8;
  const slopeBow = 0.03;
  const cabTop = spline([
    [xr, top(xr)], [xr + (xrr - xr) * 0.5, (top(xr) + roofY) / 2 + slopeBow * Math.min(1, (xrr - xr) / 0.4)],
    [xrr, roofY], [(xrr + xrf) / 2, roofY + 0.012], [xrf, roofY],
    [xrf + (xw - xrf) * 0.5, (roofY + top(xw)) / 2 + slopeBow], [xw, top(xw)],
  ]);
  const cabSec = (x) => {
    const b = top(x) - 0.006, t = Math.max(b, cabTop(x)), hB = hw(x) * 0.93, hT = hB * tumble;
    const half = [
      [hB, b], [hB - 0.005, b + Math.min(0.035, (t - b) * 0.3)],
      [hB + (hT - hB) * 0.55, b + (t - b) * 0.62], [hT, t - Math.min(0.035, (t - b) * 0.2)],
      [hT * 0.8, t - 0.003], [hT * 0.4, t + 0.012 * Math.min(1, (t - b) * 4)],
    ];
    const mid = [0, t + 0.016 * Math.min(1, (t - b) * 4)];
    return [...half, mid, ...half.slice().reverse().map(([u, y]) => [-u, y])];
  };
  const cabStations = [];
  const NC = 30;
  for (let i = 0; i <= NC; i++) cabStations.push(xr + (xw - xr) * (i / NC));
  const xb = look.cabin.b ?? (xrr + (xrf - xrr) * 0.45);
  const cPillar = look.cabin.cPillar ?? true;
  const cabGeo = loft(cabStations, cabSec, (xm, k, nSeg) => {
    const kk = Math.min(k, nSeg - 1 - k); // 0 = belt trim … 5 = centre
    if (kk === 0) return 2;
    if (xm < xrr) return cPillar && kk <= 3 ? 1 : kk === 3 ? 1 : 0; // rear window, C pillars
    if (xm > xrf) return kk === 3 ? 1 : 0; // windshield, A pillars
    if (kk >= 3) return 1; // roof
    if (Math.abs(xm - xb) < 0.055) return 2; // B pillar
    return 0;
  }, 3);
  cabGeo.translate(0, 0, ox);
  const cab = new THREE.Mesh(cabGeo, [glassMat, roofPaint, trimMat]);
  cab.castShadow = true;
  body.add(cab);
  if (look.rails) {
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, (xrf - xrr) * 0.95), trimMat);
      rail.position.set(s * hw(L / 2) * 0.93 * tumble * 0.72, roofY + 0.04, ox + (xrr + xrf) / 2);
      part(rail);
    }
  }

  // --- interior (seen through the glass) ----------------------------------------------
  for (const [sx, sy, sz] of def.seats) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), interiorMat);
    cushion.position.set(sx, sy - 0.08, sz);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.12), interiorMat);
    back.position.set(sx, sy + 0.26, sz - 0.3);
    back.rotation.x = -0.15;
    const rest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.1), interiorMat);
    rest.position.set(sx, sy + 0.66, sz - 0.36);
    part(cushion, back, rest);
  }
  const dashZ = ox + xw - 0.18;
  const dash = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.22, 0.5), dashMat);
  dash.position.set(0, top(xw) - 0.04, dashZ - 0.12);
  part(dash);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 20), trimMat);
  wheel.position.set(def.seats[0][0], top(xw) + 0.06, def.seats[0][2] + 0.5);
  wheel.rotation.x = -0.45;
  part(wheel);

  // --- seams, handles, mirrors ---------------------------------------------------------
  const seams = [];
  // door edges, rear to front
  const doors = look.doors || (def.seats.length > 2 ? [xr + 0.25, xb, xw - 0.08] : [xr + 0.2, xw - 0.08]);
  for (const s of [-1, 1]) for (const x of doors) { const g = seamGeo(x, 0.06, 0.92, s); if (g) seams.push(g); }
  if (seams.length) part(new THREE.Mesh(mergeGeometries(seams, false), trimMat));
  const handles = [];
  for (const s of [-1, 1]) for (const x of doors.slice(0, -1).map((d) => d + 0.2)) {
    const p = sidePoint(x, 0.78, s);
    const g = new THREE.BoxGeometry(0.03, 0.035, 0.18);
    g.translate(p.x + s * 0.01, p.y, p.z);
    handles.push(g);
  }
  part(new THREE.Mesh(mergeGeometries(handles, false), police ? trimMat : chromeMat));
  for (const s of [-1, 1]) {
    const mx = xw - 0.12, p = sidePoint(mx, 1, s);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), police ? trimMat : paint);
    mirror.scale.set(0.7, 0.75, 1.15);
    mirror.position.set(p.x + s * 0.12, top(mx) + 0.1, p.z);
    const glassFace = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.1), chromeMat);
    glassFace.position.set(p.x + s * 0.12, top(mx) + 0.1, p.z - 0.11);
    glassFace.rotation.y = Math.PI;
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), trimMat);
    stalk.position.set(p.x + s * 0.05, top(mx) + 0.06, p.z);
    part(mirror, glassFace, stalk);
  }

  // --- lamps, grille, plates -----------------------------------------------------------
  const noseY = top(L - 0.02), tailY = top(0.04);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc9ced3, emissive: 0xfff3d6, emissiveIntensity: 0.2, roughness: 0.12, metalness: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0a0a, emissive: 0xff1a1a, emissiveIntensity: 0.3, roughness: 0.25 });
  const revMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  parts.head = headMat; parts.tail = tailMat; parts.reverse = revMat;
  const fz = ox + L, rz = ox;
  const capHalf = hw(L);
  // a lamp lying on the body's upper line at profile x, facing out along its normal
  const onSurface = (mesh, x, lateral, inset = 0.015) => {
    const dy = (top(x + 0.02) - top(x - 0.02)) / 0.04;
    const n = new THREE.Vector3(0, 1, -dy).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    mesh.position.set(lateral, top(x) - inset, x + ox);
    part(mesh);
  };
  const lx = look.lamps || {};
  for (const s of [-1, 1]) {
    // headlamps on the sloping nose, set in from the corner, with a clear lens over them
    const hx = L - (lx.head ?? 0.12);
    onSurface(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.16), headMat), hx, s * (hw(hx) - 0.27));
    onSurface(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.18), lensMat), hx, s * (hw(hx) - 0.27), 0.008);
    // tail lamps across the rear corners, a reversing lamp inboard of each
    const tx = lx.tail ?? 0.05;
    onSurface(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.18), tailMat), tx, s * (hw(tx) - 0.26));
    onSurface(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), revMat), tx, s * (hw(tx) - 0.55));
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * (look.grille ?? 0.42), 0.15, 0.05), trimMat);
  grille.position.set(0, noseY - 0.1, fz - 0.005);
  part(grille);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(capHalf * 1.4, 0.1, 0.05), trimMat);
  lower.position.set(0, bot(L) + 0.1, fz - 0.005);
  part(lower);
  if (def.class === 'Muscle') {
    for (const z of [fz + 0.01, rz - 0.01]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(capHalf * 1.9, 0.07, 0.06), chromeMat);
      bar.position.set(0, bot(z === rz ? 0 : L) + 0.16, z);
      part(bar);
    }
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.155), new THREE.MeshStandardMaterial({ map: plateTexture(opts.plate || 'SUN 455'), roughness: 0.5 }));
  plate.position.set(0, (bot(0) + tailY) / 2 - 0.02, rz - 0.012);
  plate.rotation.y = Math.PI;
  body.add(plate);
  parts.plate = plate;

  if (police) policeLivery({ def, body, part, parts, ox, hw, bot, sidePoint, roofY, xb, doors });

  for (const [mat, list] of bins) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
    mesh.castShadow = false; // small details: the body, cabin and tyres cast the car's shadow
    mesh.receiveShadow = true;
    body.add(mesh);
  }

  // --- wheels (not on the suspended body: they stay on the ground) ----------------------
  const wheels = [];
  const R = def.wheelR;
  for (const [ax, isFront] of [[frontAx, true], [rearAx, false]]) {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * (def.track / 2), R, ox + ax);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(WHEEL.dark, wheelDarkMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(WHEEL.rim, rimMat);
      for (const m of [tire, rim]) m.scale.set(R, R, R);
      spin.add(tire, rim);
      pivot.add(spin);
      root.add(pivot);
      wheels.push({ pivot, spin, front: isFront, side: s, z: ox + ax });
    }
  }
  return { root, body, wheels, parts };
}

function policeLivery({ def, body, part, parts, ox, hw, bot, sidePoint, roofY, xb, doors }) {
  const L = def.length;
  // white front and rear doors in a panel that follows the body side
  const doorMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
  const x0 = doors[0], x1 = doors[doors.length - 1];
  const panels = [];
  for (const s of [-1, 1]) {
    const pos = [], idx = [];
    const nx = 18, nf = 6;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nf; j++) {
      const x = x0 + (x1 - x0) * (i / nx), f = 0.12 + 0.8 * (j / nf);
      const p = sidePoint(x, f, s);
      pos.push(p.x + s * 0.004, p.y, p.z);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nf; j++) {
      const a = i * (nf + 1) + j, b = a + nf + 1;
      if (s > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    panels.push(g);
  }
  part(new THREE.Mesh(mergeGeometries(panels, false), doorMat));
  const tex = signTexture('POLICE', { fg: '#14233f', font: '900 70px Arial' });
  const letter = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const xm = (x0 + x1) / 2;
  for (const s of [-1, 1]) {
    const p = sidePoint(xm, 0.42, s);
    const word = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3 / tex.userData.aspect), letter);
    word.position.set(p.x + s * 0.012, p.y, p.z);
    word.rotation.y = s * Math.PI / 2;
    body.add(word);
  }
  // light bar
  const barY = roofY + 0.04;
  const base = new THREE.Mesh(new THREE.BoxGeometry(hw(L / 2) * 1.35, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 }));
  base.position.set(0, barY, ox + xb);
  part(base);
  const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1020, emissiveIntensity: 0, roughness: 0.15 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x000a55, emissive: 0x1060ff, emissiveIntensity: 0, roughness: 0.15 });
  for (const [s, m] of [[-1, red], [1, blue]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(hw(L / 2) * 0.62, 0.09, 0.26), m);
    l.position.set(s * hw(L / 2) * 0.34, barY + 0.07, base.position.z);
    part(l);
  }
  parts.sirenRed = red; parts.sirenBlue = blue;
  // push bar
  const push = new THREE.Mesh(new THREE.BoxGeometry(hw(L) * 1.5, 0.36, 0.07), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 }));
  push.position.set(0, bot(L) + 0.25, ox + L + 0.08);
  part(push);
}
