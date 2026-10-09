// The static park: merged geometry chunks per material, the terrain and
// water, sign text, live wait-time signs, trees, ride tracks, and the sky
// with its day/night lighting.
import * as THREE from 'three';
import { Merger, P, partMatrix, cfMatrix, buildModel, partFamily } from './geom.js';
import { material } from './render/materials.js';
import { Terrain } from './render/terrain.js';
import { waterMaterial } from './render/water.js';
import { SkySystem } from './render/sky.js';
import { Trees } from './render/trees.js';
import { buildTracks } from './render/tracks.js';
import { Grass } from './render/grass.js';
import * as Clock from './clock.js';

const CHUNK = 160;
const SIGN_FONT = '"Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';

export class World {
  constructor(scene, data, quality, renderer) {
    this.scene = scene;
    this.data = data;
    this.quality = quality;
    this.materials = data.materials;
    this.signMaterials = [];
    this.dynamicSigns = [];
    this.hidden = new Set(data.hidden || []);
    this.terrain = new Terrain(data);
    this.lake = this.terrain.lake;
    this.sky = new SkySystem(scene, renderer, quality);
    this.sun = this.sky.sun;
    this.buildTerrain();
    this.buildStatic();
    this.buildSigns();
    this.globe = this.buildGlobe();
    this.spinners = this.buildSpinners();
    this.trees = new Trees(scene, data, this.terrain, quality);
    this.tracks = buildTracks(scene, data, quality);
    // blades of grass around the camera (not on the fast setting)
    if (quality.grass) this.grass = new Grass(scene, data, this.terrain, { count: quality.grass, radius: quality.name === 'ultra' ? 60 : 46 });
  }

  updateGrass(t, cam) {
    this.grass?.update(t, cam);
  }

  // graphics preset changed: grass comes and goes with it
  setQuality(preset) {
    if (preset.grass && !this.grass) this.grass = new Grass(this.scene, this.data, this.terrain, { count: preset.grass, radius: preset.name === 'ultra' ? 60 : 46 });
    if (this.grass) this.grass.enabled = !!preset.grass;
  }

  // ---------------------------------------------------------------- terrain
  buildTerrain() {
    this.terrainMesh = this.terrain.buildMesh(this.quality);
    this.scene.add(this.terrainMesh);
    const L = this.terrain.lake;
    if (L) {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(L.r + 4, 96), waterMaterial({ opacity: 0.88 }));
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(L.x, -0.35, L.z);
      lake.renderOrder = 1;
      this.scene.add(lake);
    }
    for (const p of this.terrain.ponds) {
      const pond = new THREE.Mesh(new THREE.PlaneGeometry(p.sx, p.sz), waterMaterial({ opacity: 0.9, color: 0x24505a }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(p.x, p.level, p.z);
      pond.renderOrder = 1;
      this.scene.add(pond);
    }
  }

  // ---------------------------------------------------------- static parts
  buildStatic() {
    const chunks = new Map();
    const glass = new Merger();
    const m = new THREE.Matrix4();
    this.data.static.forEach((p, i) => {
      if (this.hidden.has(i)) return;
      const fam = partFamily(p, this.materials);
      if (fam === 'glass') {
        glass.add(p, partMatrix(p, m), this.materials, false);
        return;
      }
      const key = `${fam}:${Math.floor(p[P.X] / CHUNK)}:${Math.floor(p[P.Z] / CHUNK)}`;
      let merger = chunks.get(key);
      if (!merger) {
        merger = new Merger();
        chunks.set(key, merger);
      }
      merger.add(p, partMatrix(p, m), this.materials, false);
    });
    for (const [key, merger] of chunks) {
      const fam = key.split(':')[0];
      const mesh = new THREE.Mesh(merger.build(), material(fam));
      mesh.castShadow = fam !== 'neon';
      mesh.receiveShadow = fam !== 'neon';
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    if (glass.count) {
      const mesh = new THREE.Mesh(glass.build(), material('glass'));
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
        // glowing signs shine on their own; painted ones take the light
        const mat = kind === 'glow'
          ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
          : new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.55, metalness: 0 });
        if (kind === 'glow') mat.color.setScalar(1.35);
        this.signMaterials.push(mat);
        const mesh = new THREE.Mesh(quadGeometry(pg.quads[kind]), mat);
        mesh.receiveShadow = kind !== 'glow';
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
      // LED display boards
      const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 });
      mat.color.setScalar(1.15);
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
    const model = buildModel(g.parts, this.materials, { detail: true, shadows: true });
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(cfMatrix(g.pivot));
    holder.add(model);
    this.scene.add(holder);
    return { model, holder };
  }

  // -------------------------------------------------------------- sky/light
  // daylight factor 0 (night) .. 1 (day)
  updateLighting(focus, t = 0) {
    const hour = Clock.minutes() / 60;
    const f = focus ?? new THREE.Vector3();
    const day = this.sky.update(hour, f, t);
    this.sky.updateEnvironment();
    this.trees?.update(t);
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
      holder.add(buildModel(sp.parts, this.materials, { detail: true, shadows: true }));
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
