// Particle effects: fire, sparks, fireworks, confetti, fountain spray,
// smoke and explosion flashes, plus stage light beams and lamp glows.
import * as THREE from 'three';

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
uniform float scale;
void main() {
  vColor = color;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying vec3 vColor;
varying float vAlpha;
uniform float soft;
uniform float opacity;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = mix(1.0, 1.0 - r * r, soft);
  gl_FragColor = vec4(vColor, vAlpha * a * opacity);
}`;

class ParticlePool {
  constructor(scene, max, additive, { soft = additive ? 1 : 0.35, opacity = 1 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.endSize = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.next = 0;
    this.alive = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { scale: { value: 600 }, soft: { value: soft }, opacity: { value: opacity } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0, endSize = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.baseSize[i] = size;
    this.endSize[i] = endSize;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.dirty = true;
  }

  update(dt) {
    if (this.alive === 0 && !this.dirty) return; // nothing to simulate or upload
    this.dirty = false;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; }
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const u = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      this.size[i] = this.baseSize[i] + (this.endSize[i] - this.baseSize[i]) * u;
      this.alpha[i] = u < 0.1 ? u * 10 : 1 - Math.pow(u, 2);
    }
    this.alive = alive;
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.size.needsUpdate = true;
    a.alpha.needsUpdate = true;
  }
}

const tmpColor = new THREE.Color();
const rand = (a, b) => a + Math.random() * (b - a);

function randomDir(spreadDeg, out) {
  // random direction within a cone around +Y
  const s = (spreadDeg * Math.PI) / 180;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(1 - Math.random() * (1 - Math.cos(s)));
  out.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
  return out;
}

export class Effects {
  constructor(scene, data) {
    this.scene = scene;
    this.glow = new ParticlePool(scene, 7000, true);
    this.soft = new ParticlePool(scene, 5000, false);
    this.smoke = new ParticlePool(scene, 1200, false, { soft: 1, opacity: 0.5 });
    this.emitters = new Set();
    this.flashes = [];
    this.flashGeo = new THREE.SphereGeometry(1, 16, 12);
    this.tags = data.tags;
    this.fountainsOn = false;
    this.fountainColors = [];

    // stage light beams (cones, hidden until a show)
    this.beams = (data.tags.StageLight || []).map((c) => {
      const len = 34;
      const geo = new THREE.ConeGeometry(len * Math.tan((20 * Math.PI) / 180), len, 20, 1, true);
      geo.translate(0, -len / 2, 0);
      geo.rotateX(-Math.PI / 2); // tip at origin, opening toward -Z
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate = false;
      m.matrix.set(c[3], c[4], c[5], c[0], c[6], c[7], c[8], c[1], c[9], c[10], c[11], c[2], 0, 0, 0, 1);
      m.visible = false;
      scene.add(m);
      return m;
    });

    // lamp halos for the evening
    const lamps = data.tags.ParkLamp || [];
    const lampGeo = new THREE.BufferGeometry();
    const lp = new Float32Array(lamps.length * 3);
    lamps.forEach((c, i) => { lp[i * 3] = c[0]; lp[i * 3 + 1] = c[1]; lp[i * 3 + 2] = c[2]; });
    lampGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lampGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lamps.length * 3).fill(1), 3));
    lampGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(lamps.length).fill(9), 1));
    lampGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(lamps.length).fill(0.6), 1));
    for (let i = 0; i < lamps.length; i++) lampGeo.attributes.color.setXYZ(i, 1, 0.82, 0.55);
    this.lampMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { scale: { value: 600 }, soft: { value: 1 }, opacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lamps = new THREE.Points(lampGeo, this.lampMat);
    this.lamps.visible = false;
    scene.add(this.lamps);
  }

  setViewport(height, fov) {
    // world-size points: pixels per unit at distance 1
    const s = height / (2 * Math.tan((fov * Math.PI) / 360));
    this.glow.material.uniforms.scale.value = s;
    this.soft.material.uniforms.scale.value = s;
    this.smoke.material.uniforms.scale.value = s;
    this.lampMat.uniforms.scale.value = s;
  }

  // -------------------------------------------------------------- bursts
  confetti(at, area, count = 300) {
    const palette = [0xff5050, 0xffdc3c, 0x50a0ff, 0x78e678, 0xff8c1a, 0xffffff];
    for (let i = 0; i < count; i++) {
      tmpColor.setHex(palette[i % palette.length]);
      this.soft.spawn(
        at.x + rand(-area.x / 2, area.x / 2), at.y + rand(-area.y / 2, area.y / 2), at.z + rand(-area.z / 2, area.z / 2),
        rand(-6, 6), rand(2, 10), rand(-6, 6), tmpColor, rand(0.45, 0.7), rand(3, 5), 8, 0.6,
      );
    }
  }

  explosion(at, scale = 1) {
    for (let i = 0; i < 90 * scale; i++) {
      const d = randomDir(180, new THREE.Vector3());
      tmpColor.setHSL(rand(0.02, 0.11), 1, rand(0.5, 0.65));
      const sp = rand(10, 34) * scale;
      this.glow.spawn(at.x, at.y, at.z, d.x * sp, Math.abs(d.y) * sp, d.z * sp, tmpColor, rand(2.5, 5) * scale, rand(0.5, 1.1), -4, 2.4, 0.5);
    }
    for (let i = 0; i < 24 * scale; i++) {
      const d = randomDir(70, new THREE.Vector3());
      tmpColor.setRGB(0.42, 0.4, 0.38);
      this.smoke.spawn(at.x + d.x * 3, at.y + 2, at.z + d.z * 3, d.x * 8, rand(6, 14), d.z * 8, tmpColor, rand(4, 6) * scale, rand(1.6, 2.6), -2, 0.8, 10 * scale);
    }
    this.flash(at, 0xffb050, 12 * scale, 0.5);
  }

  flash(at, color, radius, life) {
    const m = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(at);
    m.scale.setScalar(radius * 0.3);
    this.scene.add(m);
    this.flashes.push({ m, life, max: life, radius });
  }

  firework(at, color, size) {
    const n = 150;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const d = randomDir(180, new THREE.Vector3());
      const sp = rand(40, 55) * size;
      tmpColor.copy(color).lerp(white, Math.random() * 0.25);
      this.glow.spawn(at.x, at.y, at.z, d.x * sp, d.y * sp, d.z * sp, tmpColor, 2.6 * size, rand(1.4, 2.2), 14, 1.5, 0);
    }
    this.flash(at, color.getHex(), 26 * size, 0.45);
  }

  // continuous emitters (fire, sparks, mist, spray); returns handle
  emit(kind, at, opts = {}) {
    const e = { kind, at: at.clone(), acc: 0, until: opts.duration ? performance.now() / 1000 + opts.duration : Infinity, size: opts.size ?? 1, color: opts.color };
    this.emitters.add(e);
    return e;
  }

  stop(e) {
    this.emitters.delete(e);
  }

  runEmitter(e, dt) {
    const rates = { fire: 70, sparks: 160, mist: 30, spray: 60, rocket: 60 };
    e.acc += dt * (rates[e.kind] ?? 40) * (e.kind === 'fire' ? e.size : 1);
    const v = new THREE.Vector3();
    while (e.acc >= 1) {
      e.acc -= 1;
      if (e.kind === 'fire') {
        const s = e.size;
        tmpColor.setHSL(rand(0.02, 0.1), 1, rand(0.45, 0.6));
        this.glow.spawn(e.at.x + rand(-1.2, 1.2) * s, e.at.y, e.at.z + rand(-1.2, 1.2) * s, rand(-1, 1), rand(8, 16) * s, rand(-1, 1), tmpColor, rand(2.5, 4) * s, rand(0.5, 0.9), -6, 0.5, 0.6);
        if (Math.random() < 0.25) {
          tmpColor.setRGB(0.3, 0.29, 0.28);
          this.smoke.spawn(e.at.x, e.at.y + 6 * s, e.at.z, rand(-1, 1), rand(5, 9), rand(-1, 1), tmpColor, 3 * s, rand(1.5, 2.5), -1, 0.3, 8 * s);
        }
      } else if (e.kind === 'sparks') {
        randomDir(60, v);
        tmpColor.setRGB(1, 0.86, 0.47);
        const sp = rand(20, 30);
        this.glow.spawn(e.at.x, e.at.y, e.at.z, v.x * sp, v.y * sp, v.z * sp, tmpColor, 0.7, rand(0.6, 1), 60, 0.2, 0);
      } else if (e.kind === 'mist') {
        randomDir(80, v);
        tmpColor.setRGB(0.86, 0.94, 1);
        this.smoke.spawn(e.at.x + rand(-2, 2), e.at.y, e.at.z + rand(-14, 14), v.x * 9, v.y * 9, v.z * 9, tmpColor, 4, rand(1, 2), 0, 0.5, 10);
      } else if (e.kind === 'spray') {
        randomDir(6, v);
        tmpColor.copy(e.color || new THREE.Color(0.8, 0.9, 1));
        const sp = rand(34, 40);
        this.soft.spawn(e.at.x, e.at.y, e.at.z, v.x * sp, v.y * sp, v.z * sp, tmpColor, rand(1.0, 1.4), rand(1.6, 2.1), 36, 0, 0.4);
      }
    }
  }

  // ------------------------------------------------------------ tram cues
  tramCue(kind, at) {
    if (kind === 'fire') {
      for (let i = -1; i <= 1; i++) this.emit('fire', new THREE.Vector3(at.x, at.y, at.z + i * 6), { duration: 4, size: 1.1 });
    } else if (kind === 'flood') {
      this.emit('mist', new THREE.Vector3(at.x, at.y + 4, at.z), { duration: 3 });
      // a sheet of falling water
      for (let i = 0; i < 400; i++) {
        tmpColor.setRGB(0.4 + Math.random() * 0.2, 0.65, 0.9);
        this.soft.spawn(at.x + rand(-3, 3), at.y + 16 + rand(0, 3), at.z + rand(-15, 15), rand(-2, 2), rand(-4, 0), 0, tmpColor, rand(1.2, 2), rand(1, 1.6), 30, 0, 1.6);
      }
    } else if (kind === 'explosion') {
      this.explosion(new THREE.Vector3(at.x, at.y + 6, at.z), 1);
    } else {
      this.emit('sparks', new THREE.Vector3(at.x, at.y + 8, at.z), { duration: 3 });
    }
  }

  // --------------------------------------------------- show controlled bits
  setStageLights(on, t) {
    this.beams.forEach((b, i) => {
      b.visible = on;
      if (on) {
        b.material.color.setHSL((t * 0.08 + i * 0.13) % 1, 0.7, 0.6);
        b.material.opacity = 0.12 + 0.08 * Math.sin(t * 3 + i);
      }
    });
  }

  setFountains(on, t) {
    const list = this.tags.LakeFountain || [];
    if (!this.fountainEmitters) {
      this.fountainEmitters = list.map((c) => ({ kind: 'spray', at: new THREE.Vector3(c[0], c[1] + 1.5, c[2]), acc: 0, until: Infinity, color: new THREE.Color(0.8, 0.9, 1), on: false }));
    }
    this.fountainEmitters.forEach((e, i) => {
      const want = on && ((Math.floor(t / 2) + i) % 3 !== 0 || t > 54);
      e.color.setHSL((t * 0.05 + i * 0.1) % 1, 0.35, 0.85);
      if (want && !e.on) this.emitters.add(e);
      if (!want && e.on) this.emitters.delete(e);
      e.on = want;
    });
  }

  fireAt(key, list, on) {
    // named group of fire emitters switched together
    this.groups = this.groups || {};
    const g = this.groups[key];
    if (on && !g) {
      this.groups[key] = list.map(([p, size]) => this.emit('fire', p, { size }));
    } else if (!on && g) {
      g.forEach((e) => this.stop(e));
      delete this.groups[key];
    }
  }

  // ----------------------------------------------------------------- tick
  update(dt, daylight) {
    const now = performance.now() / 1000;
    for (const e of this.emitters) {
      if (now > e.until) {
        this.emitters.delete(e);
        continue;
      }
      this.runEmitter(e, dt);
    }
    this.glow.update(dt);
    this.soft.update(dt);
    this.smoke.update(dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const u = 1 - f.life / f.max;
      f.m.scale.setScalar(f.radius * (0.3 + 0.7 * Math.sqrt(Math.max(0, u))));
      f.m.material.opacity = Math.max(0, 0.9 * (1 - u));
      if (f.life <= 0) {
        this.scene.remove(f.m);
        f.m.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    this.lamps.visible = daylight < 0.55;
    this.lampMat.opacity = 1;
  }
}
