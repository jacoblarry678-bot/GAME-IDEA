/**
 * Keyboard / mouse / gamepad input with pointer lock and rebindable keys.
 * Actions are queried by name so the rest of the game never sees a key code.
 */

import { settings } from './settings.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: new Set(), wheel: 0 };
    this.locked = false;
    this.enabled = false;
    this.gamepadIndex = null;
    this.rebinding = null;
    this.onRebind = null;
    this._blockedUntil = 0;
    // Pointer lock is not always available — sandboxed iframes and some browser
    // settings refuse it. When that happens we fall back to drag-to-look and
    // arrow-key turning rather than leaving the player unable to aim.
    this.lockBlocked = false;
    this.dragging = false;
    this.onLockBlocked = null;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (this.rebinding) {
        e.preventDefault();
        const action = this.rebinding;
        this.rebinding = null;
        settings.data.controls.bindings[action] = e.code;
        settings.save();
        this.onRebind?.(action, e.code);
        return;
      }
      if (!this.enabled) return;
      if (e.repeat) return;
      // never swallow the browser's own escape/refresh
      if (e.code !== 'Escape' && e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
      this.keys.add(e.code);
      this.pressedThisFrame.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.releasedThisFrame.add(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.buttons.clear();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouse.buttons.add(e.button);
      this.pressedThisFrame.add('Mouse' + e.button);
      this.dragging = true;
      if (!this.locked && !this.lockBlocked) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons.delete(e.button);
      this.releasedThisFrame.add('Mouse' + e.button);
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // locked: every movement steers. unlocked: only while dragging.
      if (!this.locked && !this.dragging) return;
      const sens = settings.get('controls.sensitivity', 1) * (this.locked ? 1 : 1.35);
      const mx = e.movementX !== undefined ? e.movementX : 0;
      const my = e.movementY !== undefined ? e.movementY : 0;
      this.mouse.dx += mx * sens;
      this.mouse.dy += my * sens * (settings.get('controls.invertY', false) ? -1 : 1);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.enabled && this.locked) this.mouse.wheel += Math.sign(e.deltaY);
      },
      { passive: true }
    );

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      if (!this.lockBlocked) {
        this.lockBlocked = true;
        this.onLockBlocked?.();
      }
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
    });
  }

  requestLock() {
    if (this.locked || this.lockBlocked || performance.now() < this._blockedUntil) return;
    if (!this.canvas.requestPointerLock) {
      this.lockBlocked = true;
      this.onLockBlocked?.();
      return;
    }
    try {
      // Chrome throws if you re-request too fast after an exit, and returns a
      // promise that rejects when the embedding context disallows it.
      const r = this.canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          if (!this.lockBlocked) {
            this.lockBlocked = true;
            this.onLockBlocked?.();
          }
        });
      }
    } catch {
      this.lockBlocked = true;
      this.onLockBlocked?.();
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    this._blockedUntil = performance.now() + 1300;
  }

  key(action) {
    return settings.data.controls.bindings[action] || action;
  }

  down(action) {
    const code = this.key(action);
    return code.startsWith('Mouse') ? this.mouse.buttons.has(+code.slice(5)) : this.keys.has(code);
  }

  pressed(action) {
    return this.pressedThisFrame.has(this.key(action));
  }

  released(action) {
    return this.releasedThisFrame.has(this.key(action));
  }

  rawDown(code) {
    return this.keys.has(code);
  }
  rawPressed(code) {
    return this.pressedThisFrame.has(code);
  }

  /** Look delta for this frame: mouse (locked or dragged), stick, arrow keys. */
  look() {
    const out = { x: this.mouse.dx * 0.0022, y: this.mouse.dy * 0.0022 };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    // Keyboard turning always works, and is the guaranteed fallback when the
    // page cannot capture the mouse at all. Rate is per SECOND — a per-frame
    // constant would turn twice as fast on a 120Hz display as on a 60Hz one.
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this._lastLook || now)) / 1000);
    this._lastLook = now;
    const k = 2.4 * settings.get('controls.sensitivity', 1) * dt;
    if (this.keys.has('ArrowLeft')) out.x -= k;
    if (this.keys.has('ArrowRight')) out.x += k;
    const inv = settings.get('controls.invertY', false) ? -1 : 1;
    if (this.keys.has('ArrowUp')) out.y -= k * 0.6 * inv;
    if (this.keys.has('ArrowDown')) out.y += k * 0.6 * inv;
    const gp = this.gamepad();
    if (gp) {
      const s = settings.get('controls.controllerSensitivity', 1) * 0.045;
      out.x += this.dead(gp.axes[2]) * s;
      out.y += this.dead(gp.axes[3]) * s * (settings.get('controls.invertY', false) ? -1 : 1);
    }
    return out;
  }

  /** Normalised movement vector from WASD + left stick. */
  move() {
    let x = 0;
    let y = 0;
    if (this.down('forward')) y -= 1;
    if (this.down('back')) y += 1;
    if (this.down('left')) x -= 1;
    if (this.down('right')) x += 1;
    const gp = this.gamepad();
    if (gp) {
      x += this.dead(gp.axes[0]);
      y += this.dead(gp.axes[1]);
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, magnitude: Math.min(1, len) };
  }

  dead(v, dz = 0.16) {
    if (v === undefined) return 0;
    return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz);
  }

  gamepad() {
    if (this.gamepadIndex === null || !navigator.getGamepads) return null;
    return navigator.getGamepads()[this.gamepadIndex] || null;
  }

  /** Gamepad button by semantic name. */
  pad(name) {
    const gp = this.gamepad();
    if (!gp) return false;
    const map = {
      interact: 0, // A
      vault: 1, // B
      crouch: 2, // X
      flashlight: 3, // Y
      sprint: 10, // L3
      attack: 7, // RT
      ability1: 4,
      ability2: 5,
      pause: 9,
    };
    const b = gp.buttons[map[name]];
    return !!(b && b.pressed);
  }

  beginRebind(action, cb) {
    this.rebinding = action;
    this.onRebind = cb;
  }

  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.mouse.wheel = 0;
  }
}
