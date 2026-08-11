/**
 * THE LAMENT CONFIGURATION.
 *
 * The box is a real object: four independently rotating horizontal segments,
 * each carrying six etched symbols. The server owns the target combination and
 * the current configuration — this module renders it, takes input, and asks
 * the server to rotate. Solving it is deliberately dangerous: every turn heats
 * the box, and heat is what the Cenobite feels.
 *
 * `buildBoxMesh()` is shared between the interactive puzzle view and the box
 * that physically sits on the altar in the world.
 */

import * as THREE from 'three';

const SEGMENTS = 4;
const FACES = 6;

/** Procedural symbol textures — occult glyphs drawn to canvas. */
function symbolTexture(index, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0808';
  g.fillRect(0, 0, size, size);

  // engraved border
  g.strokeStyle = '#8a6a2c';
  g.lineWidth = size * 0.035;
  g.strokeRect(size * 0.09, size * 0.09, size * 0.82, size * 0.82);
  g.strokeStyle = '#4a3a18';
  g.lineWidth = size * 0.012;
  g.strokeRect(size * 0.16, size * 0.16, size * 0.68, size * 0.68);

  g.save();
  g.translate(size / 2, size / 2);
  g.strokeStyle = '#d8b25a';
  g.lineWidth = size * 0.045;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const r = size * 0.26;

  switch (index % FACES) {
    case 0: // pierced circle
      g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 1.4); g.lineTo(0, r * 1.4); g.stroke();
      break;
    case 1: // inverted triangle with a bar
      g.beginPath(); g.moveTo(-r, -r * 0.75); g.lineTo(r, -r * 0.75); g.lineTo(0, r); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.6, r * 0.1); g.lineTo(r * 0.6, r * 0.1); g.stroke();
      break;
    case 2: // spiral
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.12) {
        const rr = (a / (Math.PI * 5)) * r * 1.3;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
      break;
    case 3: // barbed cross
      g.beginPath(); g.moveTo(0, -r * 1.25); g.lineTo(0, r * 1.25); g.stroke();
      g.beginPath(); g.moveTo(-r, -r * 0.25); g.lineTo(r, -r * 0.25); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.5, r * 1.25); g.lineTo(0, r * 0.8); g.lineTo(r * 0.5, r * 1.25); g.stroke();
      break;
    case 4: // the eye
      g.beginPath();
      g.moveTo(-r * 1.3, 0);
      g.quadraticCurveTo(0, -r * 1.1, r * 1.3, 0);
      g.quadraticCurveTo(0, r * 1.1, -r * 1.3, 0);
      g.stroke();
      g.beginPath(); g.arc(0, 0, r * 0.38, 0, 7); g.stroke();
      break;
    default: // interlocking hooks
      g.beginPath(); g.arc(-r * 0.42, 0, r * 0.62, -Math.PI * 0.5, Math.PI * 0.9); g.stroke();
      g.beginPath(); g.arc(r * 0.42, 0, r * 0.62, Math.PI * 0.5, Math.PI * 1.9); g.stroke();
      break;
  }
  g.restore();

  // wear and tarnish
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 0.78 + Math.random() * 0.34;
    img.data[i] *= n;
    img.data[i + 1] *= n;
    img.data[i + 2] *= n;
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let SYMBOL_CACHE = null;
function symbols() {
  if (!SYMBOL_CACHE) SYMBOL_CACHE = Array.from({ length: FACES }, (_, i) => symbolTexture(i));
  return SYMBOL_CACHE;
}

/**
 * Build the box. Returns { group, segments[] } where each segment is a Group
 * that can be rotated about Y.
 */
export function buildBoxMesh(scale = 1) {
  const group = new THREE.Group();
  const S = 1.0 * scale;
  const segH = S / SEGMENTS;
  const syms = symbols();

  const lacquer = new THREE.MeshStandardMaterial({
    color: 0x0d0b0c, roughness: 0.22, metalness: 0.35,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xb08a3a, roughness: 0.3, metalness: 0.95, emissive: 0x2a1a04, emissiveIntensity: 0.5,
  });

  const segments = [];
  for (let s = 0; s < SEGMENTS; s++) {
    const seg = new THREE.Group();
    seg.position.y = -S / 2 + segH * (s + 0.5);

    const core = new THREE.Mesh(new THREE.BoxGeometry(S * 0.98, segH * 0.94, S * 0.98), lacquer);
    core.castShadow = true;
    seg.add(core);

    // gold inlay running around the segment
    for (const yy of [-segH * 0.42, segH * 0.42]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(S * 1.005, segH * 0.06, S * 1.005), gold);
      band.position.y = yy;
      seg.add(band);
    }

    // a symbol plate on each of the four sides
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      const symIndex = (s * 4 + f) % FACES;
      const plateMat = new THREE.MeshStandardMaterial({
        map: syms[symIndex], roughness: 0.42, metalness: 0.6,
        emissive: 0x120a02, emissiveIntensity: 0.35,
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.72, segH * 0.7), plateMat);
      plate.position.set(Math.sin(a) * S * 0.5, 0, Math.cos(a) * S * 0.5);
      plate.rotation.y = a;
      plate.userData = { symbol: symIndex, segment: s, face: f, mat: plateMat };
      seg.add(plate);
    }

    // corner studs
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.035, S * 0.035, segH * 0.9, 6), gold);
        stud.position.set(sx * S * 0.49, 0, sz * S * 0.49);
        seg.add(stud);
      }
    }

    seg.userData = { index: s, value: 0, targetRot: 0 };
    group.add(seg);
    segments.push(seg);
  }

  // a faint inner glow that grows with heat
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff3a10, transparent: true, opacity: 0, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(S * 1.02, S * 1.02, S * 1.02), glowMat);
  group.add(glow);

  const light = new THREE.PointLight(0xff5a20, 0, 6 * scale);
  group.add(light);

  group.userData = { segments, glowMat, light, scale: S };
  return { group, segments, glowMat, light };
}

/**
 * The interactive puzzle view: its own tiny renderer drawn into the overlay
 * canvas, so it never fights the main scene for state.
 */
export class LamentPuzzle {
  constructor(container, { onRotate, onSubmit, audio } = {}) {
    this.container = container;
    this.onRotate = onRotate || (() => {});
    this.onSubmit = onSubmit || (() => {});
    this.audio = audio;
    this.active = false;
    this.activeSegment = 0;
    this.config = [0, 0, 0, 0];
    this.hint = null; // Scholar perk: which segments are correct
    this.heat = 0;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'box-canvas';
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    this.camera.position.set(0, 0.55, 3.1);
    this.camera.lookAt(0, 0, 0);

    const key = new THREE.PointLight(0xffd9a0, 34, 14);
    key.position.set(2.2, 2.6, 3.0);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x6a3cff, 22, 12);
    rim.position.set(-2.6, -0.6, -2.2);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x4a4458, 6));

    const built = buildBoxMesh(1);
    this.box = built.group;
    this.segments = built.segments;
    this.glowMat = built.glowMat;
    this.boxLight = built.light;
    this.scene.add(this.box);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  bindInput() {
    const pick = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.box.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && o.userData.index === undefined) o = o.parent;
        if (o) return o.userData.index;
      }
      return null;
    };

    this.canvas.addEventListener('pointerdown', (ev) => {
      if (!this.active) return;
      const seg = pick(ev);
      if (seg === null) return;
      this.activeSegment = seg;
      this.dragging = { x: ev.clientX, moved: 0, seg };
      this.canvas.setPointerCapture(ev.pointerId);
    });
    this.canvas.addEventListener('pointermove', (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.dragging.x;
      if (Math.abs(dx) > 42) {
        this.rotate(this.dragging.seg, dx > 0 ? 1 : -1);
        this.dragging.x = ev.clientX;
        this.dragging.moved += 1;
      }
    });
    this.canvas.addEventListener('pointerup', (ev) => {
      if (this.dragging && this.dragging.moved === 0) {
        // a tap rotates one step clockwise
        this.rotate(this.dragging.seg, 1);
      }
      this.dragging = null;
      try { this.canvas.releasePointerCapture(ev.pointerId); } catch {}
    });

    this._keyHandler = (ev) => {
      if (!this.active) return;
      if (ev.code === 'ArrowUp') { this.activeSegment = (this.activeSegment + SEGMENTS - 1) % SEGMENTS; ev.preventDefault(); }
      else if (ev.code === 'ArrowDown') { this.activeSegment = (this.activeSegment + 1) % SEGMENTS; ev.preventDefault(); }
      else if (ev.code === 'ArrowLeft') { this.rotate(this.activeSegment, -1); ev.preventDefault(); }
      else if (ev.code === 'ArrowRight') { this.rotate(this.activeSegment, 1); ev.preventDefault(); }
      else if (ev.code === 'Enter') { this.onSubmit(); ev.preventDefault(); }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  rotate(segment, dir) {
    this.onRotate(segment, dir);
    this.audio?.play('box_turn', {});
  }

  /** Push authoritative state from the server. */
  setState({ config, heat, hint }) {
    if (config) this.config = config.slice();
    if (typeof heat === 'number') this.heat = heat;
    this.hint = hint || null;
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].userData.targetRot = ((this.config[i] || 0) / FACES) * Math.PI * 2;
    }
  }

  open() {
    this.active = true;
    this.container.classList.remove('hidden');
    this.resize();
  }

  close() {
    this.active = false;
    this.container.classList.add('hidden');
  }

  resize() {
    const w = this.canvas.clientWidth || 400;
    const h = this.canvas.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.active) return;
    // ease each segment toward its authoritative rotation
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      let diff = s.userData.targetRot - s.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.rotation.y += diff * Math.min(1, dt * 12);
      // the selected segment lifts slightly
      const sel = i === this.activeSegment;
      const targetScale = sel ? 1.06 : 1.0;
      s.scale.x += (targetScale - s.scale.x) * Math.min(1, dt * 10);
      s.scale.z = s.scale.x;
    }
    // idle drift so the box never looks static
    this.box.rotation.y += dt * 0.12;
    this.box.rotation.x = Math.sin(performance.now() * 0.0004) * 0.06;

    // heat glow
    this.glowMat.opacity = this.heat * 0.5;
    this.boxLight.intensity = this.heat * 26;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('keydown', this._keyHandler);
    this.renderer.dispose();
    this.canvas.remove();
  }
}

export { SEGMENTS, FACES, symbolTexture };
