// Speech bubbles over people's heads ("All clear!", "Welcome in!").
import * as THREE from 'three';

const FONT = '600 30px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
const RANGE = 75; // studs from the camera

function bubbleTexture(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = FONT;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  const h = 64;
  c.width = w;
  c.height = h + 14;
  ctx.font = FONT;
  const r = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(20,24,34,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r, 2);
  ctx.lineTo(w - r, 2);
  ctx.quadraticCurveTo(w - 2, 2, w - 2, r);
  ctx.lineTo(w - 2, h - r);
  ctx.quadraticCurveTo(w - 2, h, w - r, h);
  ctx.lineTo(w / 2 + 10, h);
  ctx.lineTo(w / 2, h + 12);
  ctx.lineTo(w / 2 - 10, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(2, h, 2, h - r);
  ctx.lineTo(2, r);
  ctx.quadraticCurveTo(2, 2, r, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b2233';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}

export class Bubbles {
  constructor(scene) {
    this.scene = scene;
    this.active = new Map(); // speaker id -> bubble
    this.textures = new Map();
  }

  // speaker: any key; at: Vector3 (head position, updated by the caller)
  say(speaker, text, at, duration = 2.8) {
    if (!text) return;
    this.clear(speaker);
    let t = this.textures.get(text);
    if (!t) {
      t = bubbleTexture(text);
      this.textures.set(text, t);
    }
    const mat = new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(mat);
    const h = 1.15;
    sprite.scale.set(h * t.aspect, h, 1);
    sprite.renderOrder = 10;
    sprite.center.set(0.5, 0);
    sprite.position.copy(at);
    this.scene.add(sprite);
    this.active.set(speaker, { sprite, life: duration, max: duration, at });
  }

  // keep a bubble above a moving speaker
  follow(speaker, at) {
    const b = this.active.get(speaker);
    if (b) b.sprite.position.copy(at);
  }

  clear(speaker) {
    const b = this.active.get(speaker);
    if (!b) return;
    this.scene.remove(b.sprite);
    b.sprite.material.dispose();
    this.active.delete(speaker);
  }

  // is the point close enough to the camera to bother speaking?
  near(at, cam) {
    return at.distanceToSquared(cam) < RANGE * RANGE;
  }

  update(dt, cam) {
    for (const [id, b] of this.active) {
      b.life -= dt;
      const d = b.sprite.position.distanceTo(cam);
      // stay readable a little further away
      const k = Math.max(1, d / 22);
      const h = 1.15 * k;
      b.sprite.scale.set(h * (b.sprite.scale.x / b.sprite.scale.y), h, 1);
      b.sprite.material.opacity = Math.min(1, b.life / 0.3) * (d > RANGE ? 0 : 1);
      if (b.life <= 0) this.clear(id);
    }
  }
}
