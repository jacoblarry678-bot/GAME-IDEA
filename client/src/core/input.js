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
      if (!this.locked) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons.delete(e.button);
      this.releasedThisFrame.add('Mouse' + e.button);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      const sens = settings.get('controls.sensitivity', 1);
      this.mouse.dx += e.movementX * sens;
      this.mouse.dy += e.movementY * sens * (settings.get('controls.invertY', false) ? -1 : 1);
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
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
    });
  }

  requestLock() {
    if (this.locked || performance.now() < this._blockedUntil) return;
    // Chrome throws if you re-request too fast after an exit
    this.canvas.requestPointerLock?.();
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

  /** Look delta for this frame, mouse + right stick combined. */
  look() {
    const out = { x: this.mouse.dx * 0.0022, y: this.mouse.dy * 0.0022 };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
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
