/**
 * Sun glare and lens flare (screen-space overlay).
 *
 * The sun position is projected to the screen every frame. Visibility comes
 * from the collision world (a ray from the camera toward the sun) and smoke,
 * so buildings, containers and smoke clouds hide the flare the same way they
 * block sight. Looking toward the sun adds a soft veil over the whole view.
 */
import * as THREE from 'three';

const GHOSTS = [
  { t: 0.45, size: 0.09, color: '255,214,150', a: 0.32 },
  { t: 0.75, size: 0.05, color: '170,210,255', a: 0.35 },
  { t: 1.15, size: 0.14, color: '255,170,120', a: 0.18 },
  { t: 1.45, size: 0.035, color: '200,255,210', a: 0.4 },
  { t: 1.8, size: 0.22, color: '160,140,255', a: 0.12 },
  { t: 2.15, size: 0.07, color: '255,230,190', a: 0.25 },
];

const v = new THREE.Vector3(), fwd = new THREE.Vector3();

export class SunFlare {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'sunflare';
    this.el.innerHTML = `<div class="sf-veil"></div><div class="sf-glare"></div><div class="sf-streak"></div><div class="sf-core"></div>${GHOSTS.map(() => '<div class="sf-ghost"></div>').join('')}`;
    root.prepend(this.el);
    this.veil = this.el.querySelector('.sf-veil');
    this.glare = this.el.querySelector('.sf-glare');
    this.streak = this.el.querySelector('.sf-streak');
    this.core = this.el.querySelector('.sf-core');
    this.ghosts = [...this.el.querySelectorAll('.sf-ghost')];
    GHOSTS.forEach((g, i) => { this.ghosts[i].style.background = `radial-gradient(circle, rgba(${g.color},${g.a}) 0%, rgba(${g.color},${g.a * 0.5}) 55%, rgba(${g.color},0) 72%)`; });
    this.vis = 0;
    this.checkT = 0;
    this.visible = false;
  }

  /**
   * camera: THREE.PerspectiveCamera; sunDir: normalized Vector3 toward the sun;
   * blocked(ox,oy,oz,dx,dy,dz) → true when geometry/smoke hides the sun; strength 0..1.
   */
  update(dt, camera, sunDir, blocked, strength = 1) {
    if (!sunDir || strength <= 0) { this.hide(); return; }
    camera.getWorldDirection(fwd);
    const facing = fwd.dot(sunDir);
    v.copy(camera.position).addScaledVector(sunDir, 400).project(camera);
    const onScreen = facing > 0 && Math.abs(v.x) < 1.35 && Math.abs(v.y) < 1.35;
    // occlusion is tested at 20 Hz (cheap grid ray) and smoothed
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.05;
      const p = camera.position;
      this.occluded = !onScreen || blocked(p.x, p.y, p.z, sunDir.x, sunDir.y, sunDir.z);
    }
    const target = this.occluded ? 0 : 1;
    this.vis += (target - this.vis) * Math.min(1, dt * (target > this.vis ? 10 : 14));
    const k = this.vis * strength;
    if (k < 0.01) { this.hide(); return; }
    this.show();
    const W = window.innerWidth, H = window.innerHeight;
    const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
    const cx = W / 2, cy = H / 2;
    const center = Math.max(0, 1 - Math.hypot(v.x, v.y) / 1.4); // stronger near the middle of the view
    const D = Math.min(W, H);
    const place = (el, x, y, size, op) => {
      el.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px)`;
      el.style.width = el.style.height = `${size.toFixed(1)}px`;
      el.style.opacity = op.toFixed(3);
    };
    place(this.glare, sx, sy, D * 0.9, k * (0.55 + center * 0.45));
    place(this.core, sx, sy, D * 0.12, k);
    this.streak.style.transform = `translate(${(sx - W * 0.6).toFixed(1)}px, ${(sy - 3).toFixed(1)}px)`;
    this.streak.style.opacity = (k * 0.55 * (0.4 + center * 0.6)).toFixed(3);
    GHOSTS.forEach((g, i) => place(this.ghosts[i], sx + (cx - sx) * g.t, sy + (cy - sy) * g.t, D * g.size, k * center));
    this.veil.style.opacity = (k * Math.pow(Math.max(0, facing), 6) * 0.32).toFixed(3);
  }

  show() { if (!this.visible) { this.visible = true; this.el.style.display = ''; } }
  hide() { if (this.visible || this.el.style.display !== 'none') { this.visible = false; this.el.style.display = 'none'; } }
  destroy() { this.el.remove(); }
}

/** Shared glint texture (four-point star with a hot core). */
let glintTex = null;
export function glintTexture() {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,250,230,0.9)'); g.addColorStop(0.4, 'rgba(255,230,180,0.25)'); g.addColorStop(1, 'rgba(255,220,160,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[64, 3], [3, 64]]) { const s = x.createLinearGradient(32 - w / 2, 32 - h / 2, 32 + w / 2, 32 + h / 2); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.9)'); s.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fillRect(32 - w / 2, 32 - h / 2, w, h); }
  glintTex = new THREE.CanvasTexture(c);
  glintTex.colorSpace = THREE.SRGBColorSpace;
  return glintTex;
}
