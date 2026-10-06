/**
 * Input: keyboard, mouse (pointer lock with graceful fallback), wheel and
 * gamepad. Actions are resolved through the rebindable binding table in
 * settings. Tracks the last used device for on-screen prompts.
 */

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
export const PAD_ACTIONS = {
  jump: PAD.A, crouch: PAD.B, reload: PAD.X, swap: PAD.Y, tactical: PAD.LB, lethal: PAD.RB,
  ads: PAD.LT, fire: PAD.RT, sprint: PAD.L3, melee: PAD.R3, scoreboard: PAD.BACK, pause: PAD.START,
  support1: PAD.LEFT, support2: PAD.UP, support3: PAD.RIGHT, interact: PAD.DOWN,
};
const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'D↑', 'D↓', 'D←', 'D→'];

export class Input {
  constructor(target, settings) {
    this.target = target;
    this.settings = settings;
    this.down = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.lockWanted = false;
    this.enabled = false; // gameplay input active
    this.device = 'kbm';
    this.captureCb = null;
    this.pad = null;
    this.padPrev = [];
    this.padNow = [];
    this.padAxes = [0, 0, 0, 0];
    this.listeners = { lockchange: [], pause: [], device: [] };
    this.lastLockFail = 0;
    this._bind();
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  _emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }

  _setDevice(d) {
    if (this.device !== d) { this.device = d; this._emit('device', d); }
  }

  _bind() {
    const t = window;
    t.addEventListener('keydown', (e) => {
      if (this.captureCb) {
        e.preventDefault();
        const cb = this.captureCb; this.captureCb = null;
        cb(e.code === 'Escape' ? null : e.code);
        return;
      }
      if (this.enabled && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.enabled && (e.ctrlKey || e.metaKey) && ['KeyW', 'KeyS', 'KeyD', 'KeyR'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
      this._setDevice('kbm');
    });
    t.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    t.addEventListener('blur', () => { this.down.clear(); });
    this.target.addEventListener('mousedown', (e) => {
      if (this.captureCb) { e.preventDefault(); const cb = this.captureCb; this.captureCb = null; cb('Mouse' + e.button); return; }
      const code = 'Mouse' + e.button;
      if (!this.down.has(code)) this.pressedSet.add(code);
      this.down.add(code);
      this._setDevice('kbm');
      if (this.enabled && this.lockWanted && !this.locked) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      const code = 'Mouse' + e.button;
      this.down.delete(code);
      this.releasedSet.add(code);
    });
    this.target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (this.captureCb) { const cb = this.captureCb; this.captureCb = null; cb(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); return; }
      if (!this.enabled) return;
      this.pressedSet.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
    }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // without pointer lock (e.g. sandboxed iframe) movementX still works while the cursor is in the window
      if (this.locked || !this.lockSupported() || performance.now() - this.lastLockFail < 60000) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this._setDevice('kbm');
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.target;
      if (was !== this.locked) this._emit('lockchange', this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lastLockFail = performance.now(); });
    window.addEventListener('gamepadconnected', () => { this._setDevice('pad'); });
  }

  lockSupported() { return 'pointerLockElement' in document && typeof this.target.requestPointerLock === 'function'; }

  requestLock() {
    if (!this.lockSupported()) return;
    try {
      const p = this.target.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => {
        try { const p2 = this.target.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => { this.lastLockFail = performance.now(); }); } catch { this.lastLockFail = performance.now(); }
      });
    } catch { this.lastLockFail = performance.now(); }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  /** Capture next key/mouse/wheel press for rebinding; cb(code|null). */
  capture(cb) { this.captureCb = cb; }

  binding(action) { return this.settings.data.controls.bindings[action] || []; }

  isDown(action) {
    for (const c of this.binding(action)) if (c && this.down.has(c)) return true;
    const pb = PAD_ACTIONS[action];
    if (pb !== undefined && this.padNow[pb]) return true;
    return false;
  }

  pressed(action) {
    for (const c of this.binding(action)) if (c && this.pressedSet.has(c)) return true;
    const pb = PAD_ACTIONS[action];
    if (pb !== undefined && this.padNow[pb] && !this.padPrev[pb]) return true;
    return false;
  }

  /** Keyboard/mouse bindings only (no controller). */
  bindDown(action) {
    for (const c of this.binding(action)) if (c && this.down.has(c)) return true;
    return false;
  }
  bindPressed(action) {
    for (const c of this.binding(action)) if (c && this.pressedSet.has(c)) return true;
    return false;
  }

  keyPressed(code) { return this.pressedSet.has(code); }
  padPressed(btn) { return !!(this.padNow[btn] && !this.padPrev[btn]); }

  /** Poll gamepads (call once per frame before reading actions). */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.pad = pad;
    this.padPrev = this.padNow;
    this.padNow = [];
    this.padAxes = [0, 0, 0, 0];
    if (!pad) return;
    const dz = this.settings.data.controls.padDeadzone;
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      this.padNow[i] = b.pressed || b.value > 0.4;
      if (this.padNow[i] && !this.padPrev[i]) this._setDevice('pad');
    }
    for (let i = 0; i < 4; i++) {
      const v = pad.axes[i] || 0;
      // radial dead zone per stick
      this.padAxes[i] = v;
    }
    for (const [ix, iy] of [[0, 1], [2, 3]]) {
      const x = this.padAxes[ix], y = this.padAxes[iy];
      const m = Math.hypot(x, y);
      if (m < dz) { this.padAxes[ix] = 0; this.padAxes[iy] = 0; } else {
        const k = (m - dz) / (1 - dz) / m;
        this.padAxes[ix] = x * k; this.padAxes[iy] = y * k;
        if (m > 0.5) this._setDevice('pad');
      }
    }
  }

  rumble(strong, weak, ms) {
    if (!this.settings.data.controls.padVibration || !this.pad) return;
    const act = this.pad.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  }

  /** Reset per-frame edge state. */
  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouseDX = 0; this.mouseDY = 0;
  }

  /** Human-readable label for an action given the active device. */
  label(action) {
    if (this.device === 'pad' && PAD_ACTIONS[action] !== undefined) return PAD_LABELS[PAD_ACTIONS[action]];
    const b = this.binding(action);
    return codeLabel(b[0] || b[1] || '');
  }
}

export function codeLabel(code) {
  if (!code) return '—';
  const map = {
    Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'MB4', Mouse4: 'MB5', WheelUp: 'WHEEL ↑', WheelDown: 'WHEEL ↓',
    Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
    Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER', Backspace: 'BKSP', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

export { PAD };
