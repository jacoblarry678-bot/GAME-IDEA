// The static park: merged geometry chunks, terrain, the lake, sign text,
// live wait-time signs, sky and day/night lighting.
import * as THREE from 'three';
import { Merger, Materials, P, partMatrix, cfMatrix, buildModel } from './geom.js';
import * as Clock from './clock.js';

const CHUNK = 120;
const SIGN_FONT = '"Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';

export class World {
  constructor(scene, data, quality) {
    this.scene = scene;
    this.data = data;
    this.quality = quality;
    this.materials = data.materials;
    this.signMaterials = [];
    this.litSignMaterials = [];
    this.dynamicSigns = [];
    this.buildTerrain();
    this.buildStatic();
    this.buildSigns();
    this.buildSky();
    this.globe = this.buildGlobe();
    this.spinners = this.buildSpinners();
  }

  // ---------------------------------------------------------------- terrain
  buildTerrain() {
    const grassTex = noiseTexture(256, [86, 150, 70], 18);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(160, 160);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshLambertMaterial({ map: grassTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    const colors = { Grass: 0x5d9a4a, Rock: 0x8a8580, Ground: 0x7a6248, Sand: 0xd9c49a };
    for (const op of this.data.terrain) {
      if (op.kind === 'ball') {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(op.radius, 18, 12),
          new THREE.MeshLambertMaterial({ color: colors[op.material] ?? 0x5d9a4a, flatShading: op.material === 'Rock' }),
        );
        mesh.position.set(...op.center);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
      } else if (op.kind === 'cylinder' && (op.material === 'Water' || op.material === 'Sand')) {
        const isWater = op.material === 'Water';
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(op.radius, 48),
          isWater
            ? new THREE.MeshPhongMaterial({ color: 0x3f86c8, shininess: 80, specular: 0x88bbee, transparent: true, opacity: 0.92 })
            : new THREE.MeshLambertMaterial({ color: colors.Sand }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(op.cf[0], isWater ? 0.05 : 0.02, op.cf[2]);
        this.scene.add(disc);
        if (isWater) this.lake = { x: op.cf[0], z: op.cf[2], r: op.radius };
      } else if (op.kind === 'block' && op.material === 'Water') {
        const box = new THREE.Mesh(
          new THREE.PlaneGeometry(op.size[0], op.size[2]),
          new THREE.MeshPhongMaterial({ color: 0x3f86c8, shininess: 80 }),
        );
        box.rotation.x = -Math.PI / 2;
        box.position.set(op.cf[0], 0.3, op.cf[2]);
        this.scene.add(box);
      }
    }
  }

  // ---------------------------------------------------------- static parts
  buildStatic() {
    const chunks = new Map();
    const glass = new Merger();
    const m = new THREE.Matrix4();
    for (const p of this.data.static) {
      const matName = this.materials[p[P.MAT]];
      const kind = matName === 'Neon' ? 'neon' : (p[P.TRANS] > 0.05 || matName === 'Glass') ? 'glass' : 'solid';
      if (kind === 'glass') {
        glass.add(p, partMatrix(p, m), this.materials, false);
        continue;
      }
      const key = `${kind}:${Math.floor(p[P.X] / CHUNK)}:${Math.floor(p[P.Z] / CHUNK)}`;
      let merger = chunks.get(key);
      if (!merger) {
        merger = new Merger();
        chunks.set(key, merger);
      }
      merger.add(p, partMatrix(p, m), this.materials, false);
    }
    for (const [key, merger] of chunks) {
      const kind = key.split(':')[0];
      const mesh = new THREE.Mesh(merger.build(), Materials[kind]);
      mesh.castShadow = kind === 'solid' && this.quality.shadows;
      mesh.receiveShadow = kind === 'solid' && this.quality.shadows;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    if (glass.count) {
      const mesh = new THREE.Mesh(glass.build(), Materials.glass);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
    }
  }

  // ------------------------------------------------------------------ signs
  faceFrame(part, face) {
    // returns { center, right, up, normal, w, h } in world space
    const mtx = partMatrix(part);
    const sx = part[P.SX], sy = part[P.SY], sz = part[P.SZ];
    const local = {
      Front: { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0], w: sx, h: sy, d: sz / 2 },
      Back: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], w: sx, h: sy, d: sz / 2 },
      Right: { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0], w: sz, h: sy, d: sx / 2 },
      Left: { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0], w: sz, h: sy, d: sx / 2 },
      Top: { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1], w: sx, h: sz, d: sy / 2 },
    }[face] ?? null;
    if (!local) return null;
    const rot = new THREE.Matrix3().setFromMatrix4(mtx);
    const n = new THREE.Vector3(...local.n).applyMatrix3(rot);
    const r = new THREE.Vector3(...local.r).applyMatrix3(rot);
    const u = new THREE.Vector3(...local.u).applyMatrix3(rot);
    const center = new THREE.Vector3(part[P.X], part[P.Y], part[P.Z]).addScaledVector(n, local.d + 0.04);
    return { center, right: r, up: u, normal: n, w: local.w, h: local.h };
  }

  buildSigns() {
    const PAGE = 2048;
    const pages = [];
    let page = null;
    let shelfX = 0, shelfY = 0, shelfH = 0;
    const newPage = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PAGE;
      canvas.height = PAGE;
      page = { canvas, ctx: canvas.getContext('2d'), quads: { glow: [], lit: [] } };
      pages.push(page);
      shelfX = 0; shelfY = 0; shelfH = 0;
    };
    newPage();
    for (const sign of this.data.signs) {
      const part = this.data.static[sign.part];
      const frame = this.faceFrame(part, sign.face);
      if (!frame) continue;
      const pps = Math.min(24, 560 / frame.w, 220 / frame.h);
      const w = Math.max(16, Math.ceil(frame.w * pps));
      const h = Math.max(8, Math.ceil(frame.h * pps));
      if (shelfX + w > PAGE) { shelfX = 0; shelfY += shelfH + 2; shelfH = 0; }
      if (shelfY + h > PAGE) newPage();
      const x = shelfX, y = shelfY;
      shelfX += w + 2;
      shelfH = Math.max(shelfH, h);
      drawLabels(page.ctx, x, y, w, h, sign.labels);
      page.quads[sign.glow ? 'glow' : 'lit'].push({ frame, uv: [x / PAGE, y / PAGE, (x + w) / PAGE, (y + h) / PAGE] });
    }
    for (const pg of pages) {
      const tex = new THREE.CanvasTexture(pg.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      for (const kind of ['glow', 'lit']) {
        if (!pg.quads[kind].length) continue;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        (kind === 'glow' ? this.signMaterials : this.litSignMaterials).push(mat);
        const mesh = new THREE.Mesh(quadGeometry(pg.quads[kind]), mat);
        mesh.renderOrder = 3;
        this.scene.add(mesh);
      }
    }
    // live signs: ride wait signs and the two wait-times boards
    for (const ds of this.data.dynamicSigns) {
      const part = this.data.static[ds.part];
      const frame = this.faceFrame(part, ds.face);
      const canvas = document.createElement('canvas');
      canvas.width = ds.kind === 'board' ? 600 : 480;
      canvas.height = ds.kind === 'board' ? 520 : 300;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new THREE.Mesh(quadGeometry([{ frame, uv: [0, 0, 1, 1] }]), mat);
      this.scene.add(mesh);
      this.dynamicSigns.push({ ...ds, canvas, ctx: canvas.getContext('2d'), tex });
    }
  }

  // Redraw live signs (called about once a second by the game).
  updateSigns(rides, rideState) {
    for (const s of this.dynamicSigns) {
      const ctx = s.ctx;
      const W = s.canvas.width, H = s.canvas.height;
      // only redraw (and re-upload) signs whose numbers changed
      const key = s.kind === 'wait'
        ? (({ status, wait }) => `${status}:${wait}`)(rideState(s.ride))
        : rides.map((r) => { const st = rideState(r.id); return `${st.status === 'Closed'}:${st.wait}`; }).join(',');
      if (key === s.key) continue;
      s.key = key;
      if (s.kind === 'wait') {
        const ride = rides.find((r) => r.id === s.ride);
        const st = rideState(s.ride);
        ctx.fillStyle = '#101624';
        ctx.fillRect(0, 0, W, H);
        fitText(ctx, ride.name, 20, 12, W - 40, 72, '#faf3e0', 800);
        const land = ride.landInfo;
        fitText(ctx, `${ride.category.toUpperCase()}  |  THRILL ${'★'.repeat(ride.thrill)}${'☆'.repeat(5 - ride.thrill)}  |  ${land.name}`, 20, 88, W - 40, 30, land.colorCss, 700);
        fitText(ctx, 'CURRENT WAIT', 20, 126, W - 40, 28, '#b4bed2', 700);
        const closed = st.status === 'Closed';
        fitText(ctx, closed ? 'CLOSED' : `${st.wait} MIN`, 20, 156, W - 40, 90, closed ? '#f04636' : waitColor(st.wait), 800);
        const statusText = closed ? 'TEMPORARILY CLOSED' : st.status === 'Running' ? 'RIDE IN PROGRESS' : 'NOW BOARDING';
        fitText(ctx, statusText, 20, 252, W - 40, 36, closed ? '#f04636' : st.status === 'Running' ? '#fad23c' : '#5adc6e', 700);
      } else {
        ctx.fillStyle = '#101624';
        ctx.fillRect(0, 0, W, H);
        const rowH = (H - 16) / rides.length;
        rides.forEach((ride, i) => {
          const y = 8 + i * rowH;
          ctx.fillStyle = i % 2 ? '#1a2234' : '#141a2a';
          ctx.fillRect(8, y, W - 16, rowH - 2);
          ctx.fillStyle = ride.landInfo.colorCss;
          ctx.fillRect(12, y + rowH * 0.2, 8, rowH * 0.6);
          const st = rideState(ride.id);
          fitText(ctx, ride.name, 28, y + 2, W * 0.66, rowH - 6, '#faf3e0', 700, 'left');
          const closed = st.status === 'Closed';
          fitText(ctx, closed ? 'CLOSED' : `${st.wait} MIN`, W * 0.7, y + 2, W * 0.28 - 12, rowH - 6, closed ? '#f04636' : waitColor(st.wait), 800, 'right');
        });
      }
      s.tex.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- globe
  buildGlobe() {
    const g = this.data.globe;
    const model = buildModel(g.parts, this.materials, { detail: true });
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(cfMatrix(g.pivot));
    holder.add(model);
    this.scene.add(holder);
    return { model, holder };
  }

  // -------------------------------------------------------------- sky/light
  buildSky() {
    const geo = new THREE.SphereGeometry(1800, 32, 16);
    this.skyUniforms = {
      top: { value: new THREE.Color(0x4a8fd8) },
      horizon: { value: new THREE.Color(0xbfdcf2) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(1, 0.95, 0.8) },
      night: { value: 0 },
    };
    const sky = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night; varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18) * (1.0 - night);
          vec3 q = floor(vDir * 420.0);
          float star = step(0.9975, hash(q)) * night * smoothstep(0.05, 0.3, vDir.y);
          col += vec3(star);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x506040, 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.castShadow = this.quality.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 900;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.Fog(0xbfdcf2, 500, 1700);
  }

  // daylight factor 0 (night) .. 1 (day)
  updateLighting(focus) {
    const minute = Clock.minutes();
    const hour = minute / 60;
    const sunAngle = (hour - 6) / 12 * Math.PI; // 6am rise, 6pm set
    const elev = Math.sin(sunAngle);
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.25);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * (elev > -0.2 ? 1 : 0);
    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.8, Math.max(elev, 0.05), 0.45).normalize();
    this.skyUniforms.sunDir.value.copy(sunDir);
    const dayTop = new THREE.Color(0x3f86d6), nightTop = new THREE.Color(0x070c1e), duskTop = new THREE.Color(0x3a4f9a);
    const dayHor = new THREE.Color(0xc4dff3), nightHor = new THREE.Color(0x1a2342), duskHor = new THREE.Color(0xf2a868);
    const top = nightTop.clone().lerp(dayTop, day).lerp(duskTop, dusk * 0.5);
    const hor = nightHor.clone().lerp(dayHor, day).lerp(duskHor, dusk * 0.65);
    this.skyUniforms.top.value.copy(top);
    this.skyUniforms.horizon.value.copy(hor);
    this.skyUniforms.night.value = 1 - day;
    this.scene.fog.color.copy(hor);
    this.sun.intensity = 0.25 + 1.55 * day;
    this.sun.color.setRGB(1, 0.92 + 0.08 * day - dusk * 0.15, 0.82 + 0.18 * day - dusk * 0.3);
    this.hemi.intensity = 0.35 + 0.75 * day;
    this.hemi.color.setRGB(0.55 + 0.33 * day, 0.6 + 0.34 * day, 0.85 + 0.15 * day);
    // follow the player with the shadow camera
    const f = focus ?? new THREE.Vector3();
    const lightDir = elev > 0 ? sunDir : new THREE.Vector3(0.3, 0.8, 0.4).normalize();
    this.sun.position.copy(f).addScaledVector(lightDir, 400);
    this.sun.target.position.copy(f);
    const signBrightness = 0.55 + 0.45 * day;
    for (const m of this.litSignMaterials) m.color.setScalar(signBrightness);
    this.sky.position.copy(f);
    this.daylight = day;
    return day;
  }

  // windmill, gears, film reels, show cars and the lighthouse lamp
  buildSpinners() {
    const axes = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) };
    return (this.data.spinners || []).map((sp) => {
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      const base = cfMatrix(sp.pivot);
      holder.matrix.copy(base);
      holder.add(buildModel(sp.parts, this.materials, { detail: true }));
      this.scene.add(holder);
      return { name: sp.name, holder, base, axis: axes[sp.axis] || axes.Y, speed: sp.speed, pos: new THREE.Vector3().setFromMatrixPosition(base), angle: 0 };
    });
  }

  spinSpinners(t, camPos) {
    const rot = new THREE.Matrix4();
    for (const s of this.spinners) {
      s.angle = t * s.speed;
      if (camPos && s.pos.distanceToSquared(camPos) > 600 * 600) continue;
      rot.makeRotationAxis(s.axis, s.angle);
      s.holder.matrix.copy(s.base).multiply(rot);
      s.holder.matrixWorldNeedsUpdate = true;
    }
  }

  spinGlobe(t) {
    const g = this.data.globe;
    const base = cfMatrix(g.pivot);
    const rot = new THREE.Matrix4().makeRotationY(t * 0.15);
    this.globe.holder.matrix.copy(base).multiply(rot);
    this.globe.holder.matrixWorldNeedsUpdate = true;
  }
}

// ---------------------------------------------------------------- helpers
export function waitColor(min) {
  if (min <= 15) return '#5adc6e';
  if (min <= 30) return '#fad23c';
  if (min <= 45) return '#ff8c1a';
  return '#f04636';
}

function quadGeometry(quads) {
  const pos = [], uv = [], idx = [];
  quads.forEach((q, i) => {
    const { center, right, up, w, h } = q.frame;
    const hw = w / 2, hh = h / 2;
    const corners = [
      center.clone().addScaledVector(right, -hw).addScaledVector(up, hh),
      center.clone().addScaledVector(right, hw).addScaledVector(up, hh),
      center.clone().addScaledVector(right, hw).addScaledVector(up, -hh),
      center.clone().addScaledVector(right, -hw).addScaledVector(up, -hh),
    ];
    for (const c of corners) pos.push(c.x, c.y, c.z);
    const [u0, v0, u1, v1] = q.uv;
    uv.push(u0, 1 - v0, u1, 1 - v0, u1, 1 - v1, u0, 1 - v1);
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cssColor(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

// Draw text scaled to fit a box (like Roblox TextScaled + TextWrapped).
export function fitText(ctx, text, x, y, w, h, color, weight = 700, align = 'center', stroke = false) {
  let size = Math.floor(h);
  let lines;
  for (; size > 6; size -= 1) {
    ctx.font = `${weight} ${size}px ${SIGN_FONT}`;
    lines = wrapLines(ctx, text, w);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length * size * 1.05 <= h && widest <= w) break;
  }
  ctx.font = `${weight} ${size}px ${SIGN_FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const lh = size * 1.05;
  const top = y + (h - lines.length * lh) / 2 + lh / 2;
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => {
    if (stroke) {
      ctx.lineWidth = Math.max(2, size * 0.12);
      ctx.strokeStyle = 'rgba(10,12,20,0.9)';
      ctx.strokeText(l, ax, top + i * lh);
    }
    ctx.fillText(l, ax, top + i * lh);
  });
}

function drawLabels(ctx, x, y, w, h, labels) {
  for (const l of labels) {
    const padY = (l.pad || 0.08) * l.h * h;
    const padX = 0.04 * l.w * w;
    const bx = x + l.x * w + padX, by = y + l.y * h + padY;
    const bw = l.w * w - padX * 2, bh = l.h * h - padY * 2;
    const weight = /Black/.test(l.font) ? 800 : 700;
    const align = l.align === 'Left' ? 'left' : l.align === 'Right' ? 'right' : 'center';
    fitText(ctx, l.text, bx, by, bw, bh, cssColor(l.color), weight, align, l.stroke);
  }
}

function noiseTexture(size, rgb, amount) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * amount * 2;
    const blade = Math.random() < 0.08 ? 14 : 0;
    img.data[i * 4] = Math.max(0, Math.min(255, rgb[0] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, rgb[1] + n + blade));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, rgb[2] + n));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
