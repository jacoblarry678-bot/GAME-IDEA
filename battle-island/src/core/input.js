/**
 * Keyboard + mouse input with pointer lock. Adapted from the repo's existing
 * input module: when pointer lock is refused (sandboxed frames) it falls back to
 * drag-to-look and arrow-key turning so the player can always aim.
 */

import { save } from './save.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedSet = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: new Set(), wheel: 0 };
    this.locked = false;
    this.lockBlocked = false;
    this.dragging = false;
    this.enabled = false;
    this.analog = null; // touch joystick {x, y} in -1..1 (y down = back)
    this._blockedUntil = 0;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (!['Escape', 'F5', 'F12'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedSet.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.buttons.clear();
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouse.buttons.add(e.button);
      this.pressedSet.add('Mouse' + e.button);
      this.dragging = true;
      if (!this.locked && !this.lockBlocked && !document.body.classList.contains('touch')) this.requestLock();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons.delete(e.button);
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.dragging) return;
      const k = this.locked ? 1 : 1.4;
      this.mouse.dx += (e.movementX || 0) * k;
      this.mouse.dy += (e.movementY || 0) * k;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.enabled) this.mouse.wheel += Math.sign(e.deltaY);
      },
      { passive: true }
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.lockBlocked = true;
    });
  }

  requestLock() {
    if (this.locked || this.lockBlocked || performance.now() < this._blockedUntil) return;
    if (!this.canvas.requestPointerLock) {
      this.lockBlocked = true;
      return;
    }
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => (this.lockBlocked = true));
    } catch {
      this.lockBlocked = true;
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    this._blockedUntil = performance.now() + 1200;
  }

  down(code) {
    return code.startsWith('Mouse') ? this.mouse.buttons.has(+code.slice(5)) : this.keys.has(code);
  }

  pressed(code) {
    return this.pressedSet.has(code);
  }

  /** Mouse look delta in radians for this frame (sensitivity applied). */
  look(dt, scale = 1) {
    const s = save.data.settings.sensitivity * scale;
    const inv = save.data.settings.invertY ? -1 : 1;
    const out = { x: this.mouse.dx * 0.0022 * s, y: this.mouse.dy * 0.0022 * s * inv };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    const k = 2.2 * s * dt;
    if (this.keys.has('ArrowLeft')) out.x -= k;
    if (this.keys.has('ArrowRight')) out.x += k;
    if (this.keys.has('ArrowUp')) out.y -= k * 0.6 * inv;
    if (this.keys.has('ArrowDown')) out.y += k * 0.6 * inv;
    return out;
  }

  endFrame() {
    this.pressedSet.clear();
    this.mouse.wheel = 0;
  }
}
