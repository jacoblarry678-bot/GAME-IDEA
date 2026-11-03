// The world beyond the park, and the things that make it feel alive:
// ranges of hills and snow-capped mountains fading into the haze on every
// horizon; flocks of birds wheeling over the park by day; airliners
// crossing high overhead leaving contrails; and flags flying over the
// forecourt, rippling in the breeze.
import * as THREE from 'three';
import { rng } from './noise.js';

const CENTER = new THREE.Vector2(200, 55);

// ---------------------------------------------------------------- horizon
// a ring of ridges: each a strip from below the ground up to a ridgeline
// made of layered random sine waves, with snow on the highest peaks
function ridge(radius, minH, maxH, seed, near, far, snow) {
  const rand = rng(seed);
  const waves = Array.from({ length: 7 }, (_, k) => ({ f: Math.round(3 + rand() * 9 * (k + 1)), p: rand() * Math.PI * 2, a: (1 / (k + 1.4)) }));
  const N = 900, ROWS = 4;
  const pos = [], col = [], idx = [];
  const c1 = new THREE.Color(near), c2 = new THREE.Color(far), white = new THREE.Color(0xeef2f6);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let h = 0, norm = 0;
    for (const w of waves) { h += Math.sin(a * w.f + w.p) * w.a; norm += w.a; }
    h = (h / norm) * 0.5 + 0.5;
    h = Math.pow(h, 1.6);
    const top = minH + (maxH - minH) * h;
    for (let r = 0; r <= ROWS; r++) {
      const u = r / ROWS;
      const y = -40 + (top + 40) * u;
      // the slopes lean back as they climb, so the lit faces read as hills
      const rr = radius + (1 - u) * -60 + u * 40;
      pos.push(CENTER.x + Math.cos(a) * rr, y, CENTER.y + Math.sin(a) * rr);
      const c = c1.clone().lerp(c2, u * 0.7);
      if (snow && top > snow && y > snow - 10) c.lerp(white, Math.min(1, (y - snow + 10) / 40));
      col.push(c.r, c.g, c.b);
    }
  }
  const W = ROWS + 1;
  for (let i = 0; i < N; i++) {
    for (let r = 0; r < ROWS; r++) {
      const a = i * W + r, b = (i + 1) * W + r;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function horizon(scene) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = 'horizon';
  group.add(new THREE.Mesh(ridge(2350, 200, 520, 41, 0x6f7f95, 0x9aaabf, 380), mat));
  group.add(new THREE.Mesh(ridge(1900, 60, 230, 17, 0x52624e, 0x76877a, 0), mat));
  group.add(new THREE.Mesh(ridge(1500, 20, 110, 7, 0x3e5236, 0x5a6c48, 0), mat));
  for (const m of group.children) { m.frustumCulled = false; m.renderOrder = -5; }
  scene.add(group);
  return group;
}

// ------------------------------------------------------------------ birds
function birdGeometry() {
  // a body and two swept wings; the wing tips (|x| large) flap
  const g = new THREE.BufferGeometry();
  const v = [
    0, 0, -0.6, -1.6, 0.1, 0.2, -0.3, 0, 0.3,
    0, 0, -0.6, 0.3, 0, 0.3, 1.6, 0.1, 0.2,
    0, 0, -0.6, -0.3, 0, 0.3, 0, -0.05, 0.9,
    0, 0, -0.6, 0, -0.05, 0.9, 0.3, 0, 0.3,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

class Birds {
  constructor(scene) {
    const PER = 11;
    this.flocks = [
      { c: new THREE.Vector3(-120, 60, 40), r: 70, h: 60, speed: 0.12, phase: 0 },
      { c: new THREE.Vector3(260, 75, -180), r: 90, h: 75, speed: -0.09, phase: 2 },
      { c: new THREE.Vector3(60, 90, -420), r: 120, h: 90, speed: 0.07, phase: 4 },
      { c: new THREE.Vector3(500, 55, 300), r: 80, h: 55, speed: -0.11, phase: 1 },
    ];
    this.per = PER;
    const n = this.flocks.length * PER;
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a2826, side: THREE.DoubleSide });
    const flap = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFlap = flap;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uFlap;\nattribute float aPhase;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += abs(position.x) * sin(uFlap * 11.0 + aPhase) * 0.7;');
    };
    mat.customProgramCacheKey = () => 'birds';
    this.flap = flap;
    const g = birdGeometry();
    const ph = new Float32Array(n);
    const rand = rng(5);
    for (let i = 0; i < n; i++) ph[i] = rand() * 6.28;
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    this.offsets = Array.from({ length: n }, () => new THREE.Vector3((rand() - 0.5) * 14, (rand() - 0.5) * 5, (rand() - 0.5) * 14));
    this.speeds = Array.from({ length: n }, () => 0.85 + rand() * 0.3);
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
  }

  update(t, day) {
    this.mesh.visible = day > 0.25;
    if (!this.mesh.visible) return;
    this.flap.value = t;
    const up = new THREE.Vector3(0, 1, 0);
    this.flocks.forEach((f, k) => {
      for (let j = 0; j < this.per; j++) {
        const i = k * this.per + j;
        const a = t * f.speed * this.speeds[i] + f.phase + j * 0.04;
        const o = this.offsets[i];
        const wob = Math.sin(t * 0.7 + i) * 3;
        this.p.set(f.c.x + Math.cos(a) * (f.r + o.x + wob), f.h + o.y + Math.sin(t * 0.4 + i * 0.3) * 4, f.c.z + Math.sin(a) * (f.r + o.z + wob));
        // facing along the circle, banked into the turn
        const heading = Math.atan2(-Math.sin(a) * Math.sign(f.speed), Math.cos(a) * Math.sign(f.speed));
        this.q.setFromAxisAngle(up, heading + Math.PI);
        this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.35 * Math.sign(f.speed)));
        this.s.setScalar(0.9);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------- planes overhead
class Planes {
  constructor(scene) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.2 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 10), white);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(36, 0.5, 6), white);
    wing.position.set(0, -0.5, 1);
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 3), white);
    tail.position.set(0, 0.6, 15);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 4), white);
    fin.position.set(0, 3.4, 15);
    g.add(fin);
    for (const x of [-7, 7]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 8), white);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(x, -1.6, -1);
      g.add(eng);
    }
    // contrails: long soft white streaks behind the engines
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    const trailGeo = new THREE.BoxGeometry(1.4, 1.4, 1);
    trailGeo.translate(0, 0, 0.5);
    // fade toward the far end
    const tc = [];
    const tp = trailGeo.getAttribute('position');
    for (let i = 0; i < tp.count; i++) { const f = 1 - tp.getZ(i) * 0.9; tc.push(f, f, f); }
    trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    trailMat.vertexColors = true;
    this.trails = [-7, 7].map((x) => {
      const m = new THREE.Mesh(trailGeo, trailMat);
      m.position.set(x, -1.6, 2);
      g.add(m);
      return m;
    });
    g.visible = false;
    for (const o of g.children) o.frustumCulled = false;
    scene.add(g);
    this.plane = g;
    this.rand = rng(9);
    this.next = 20;
    this.active = null;
  }

  update(dt, t, day) {
    if (!this.active) {
      if (t < this.next) return;
      const r = this.rand;
      const a = r() * Math.PI * 2, off = (r() - 0.5) * 1600;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const from = new THREE.Vector3(CENTER.x, 520 + r() * 160, CENTER.y).addScaledVector(dir, -2600).addScaledVector(side, off);
      this.active = { from, dir, s: 0, len: 5200, speed: 95 };
      this.plane.visible = true;
      this.plane.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    }
    const A = this.active;
    A.s += A.speed * dt;
    this.plane.position.copy(A.from).addScaledVector(A.dir, A.s);
    // the trail grows to its full length, and fades at night
    const len = Math.min(A.s, 900);
    for (const tr of this.trails) tr.scale.set(1 + len / 900, 1 + len / 900, len);
    this.trails[0].material.opacity = 0.5 * (0.2 + 0.8 * day);
    if (A.s > A.len) {
      this.active = null;
      this.plane.visible = false;
      this.next = t + 50 + this.rand() * 70;
    }
  }
}

// ------------------------------------------------------------------ flags
function flagTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  if (kind === 'usa') {
    for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#b22234'; x.fillRect(0, (i * 160) / 13, 256, 160 / 13 + 1); }
    x.fillStyle = '#3c3b6e';
    x.fillRect(0, 0, 104, 86);
    x.fillStyle = '#ffffff';
    for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { x.beginPath(); x.arc(9 + k * 17 + (r % 2 ? 8.5 : 0), 6 + r * 9, 2.4, 0, 7); x.fill(); }
  } else {
    const g = x.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, kind === 'park' ? '#c42828' : '#1e3c78');
    g.addColorStop(1, kind === 'park' ? '#8a1414' : '#122452');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 160);
    x.fillStyle = '#f0c440';
    x.fillRect(0, 66, 256, 28);
    x.fillStyle = '#ffffff';
    x.font = 'bold 30px "Barlow Semi Condensed", Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText(kind === 'park' ? 'BENTON' : 'BENTON DIESEL', 128, 50);
    x.fillStyle = '#1a1a1a';
    x.font = 'bold 22px "Barlow Semi Condensed", Arial, sans-serif';
    x.fillText(kind === 'park' ? 'DIESEL WORLD' : 'WORLD', 128, 88);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

class Flags {
  constructor(scene) {
    this.time = { value: 0 };
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.3, metalness: 0.8 });
    const spots = [[-62, 'usa'], [-54, 'park'], [-46, 'blue'], [46, 'blue'], [54, 'park'], [62, 'usa']];
    const geo = new THREE.PlaneGeometry(9, 5.6, 24, 10);
    geo.translate(4.5, 0, 0);
    this.group = new THREE.Group();
    spots.forEach(([x, kind], k) => {
      const z = 356;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 26, 10), poleMat);
      pole.position.set(x, 13, z);
      pole.castShadow = true;
      this.group.add(pole);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.3, metalness: 1 }));
      cap.position.set(x, 26.2, z);
      this.group.add(cap);
      const mat = new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 0.85 });
      const phase = { value: k * 1.3 };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.time;
        sh.uniforms.uPhase = phase;
        const wave = `
          float fx = position.x;
          float wv = uTime * 4.2 + uPhase - fx * 0.85;
          float amp = fx / 9.0;
          float dz = (sin(wv) * 0.55 + sin(wv * 2.3 + 1.0) * 0.18) * amp;
          float dzdx = (-cos(wv) * 0.85 * 0.55 - cos(wv * 2.3 + 1.0) * 1.955 * 0.18) * amp + (sin(wv) * 0.55) / 9.0;`;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uPhase;')
          .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n{${wave}\nobjectNormal = normalize(vec3(-dzdx, 0.0, 1.0));\n}`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n{${wave}\ntransformed.z += dz;\ntransformed.y -= amp * amp * 0.5;\n}`);
      };
      mat.customProgramCacheKey = () => 'flag';
      const flag = new THREE.Mesh(geo, mat);
      // flying out downwind (toward +x in the flag's frame)
      flag.position.set(x, 23, z);
      flag.rotation.y = -0.5;
      flag.castShadow = true;
      this.group.add(flag);
    });
    scene.add(this.group);
  }

  update(t) {
    this.time.value = t;
  }
}

export class Life {
  constructor(scene, quality) {
    this.horizon = horizon(scene);
    this.birds = new Birds(scene);
    this.planes = new Planes(scene);
    this.flags = new Flags(scene);
    this.quality = quality;
  }

  update(dt, t, day) {
    this.birds.update(t, day);
    this.planes.update(dt, t, day);
    this.flags.update(t);
  }
}
