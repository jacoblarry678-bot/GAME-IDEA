/**
 * Input: keyboard, mouse (pointer lock with graceful fallback), wheel and
 * gamepad. Actions resolve through the rebindable keyboard table in settings
 * and the controller map from the design (A interact, B crouch/back, X reload,
 * Y inventory, LB tool radial, RB ping, LT inspect, RT use, View journal,
 * Menu pause, L3 sprint toggle, D-pad up flashlight, D-pad down callouts,
 * LT + D-pad left/right lean). Tracks the last used device for prompts.
 */

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
export const PAD_ACTIONS = {
  interact: PAD.A, mantle: PAD.A, crouch: PAD.B, reload: PAD.X, inventory: PAD.Y, radial: PAD.LB, ping: PAD.RB,
  inspect: PAD.LT, use: PAD.RT, journal: PAD.VIEW, pause: PAD.MENU, sprint: PAD.L3, cameraFlash: PAD.R3,
  flashlight: PAD.UP, callout: PAD.DOWN,
};
const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →'];

export class Input {
  constructor(target, settings) {
    this.target = target;
    this.settings = settings;
    this.down = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.enabled = false;
    this.device = 'kbm';
    this.captureCb = null;
    this.pad = null;
    this.padPrev = [];
    this.padNow = [];
    this.padAxes = [0, 0, 0, 0];
    this.listeners = { lockchange: [], device: [] };
    this.lastLockFail = 0;
    this.typing = false; // text field focused: gameplay keys suspended
    this._bind();
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  _emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }
  _setDevice(d) { if (this.device !== d) { this.device = d; this._emit('device', d); } }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (this.captureCb) {
        e.preventDefault();
        const cb = this.captureCb; this.captureCb = null;
        cb(e.code === 'Escape' ? null : e.code);
        return;
      }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') { this.typing = true; return; }
      this.typing = false;
      if (this.enabled && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ['KeyW', 'KeyS', 'KeyD', 'KeyR', 'KeyF'].includes(e.code) && this.enabled) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
      this._setDevice('kbm');
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); this.releasedSet.add(e.code); });
    window.addEventListener('blur', () => { for (const c of this.down) this.releasedSet.add(c); this.down.clear(); });
    this.target.addEventListener('mousedown', (e) => {
      if (this.captureCb) { e.preventDefault(); const cb = this.captureCb; this.captureCb = null; cb('Mouse' + e.button); return; }
      const code = 'Mouse' + e.button;
      if (!this.down.has(code)) this.pressedSet.add(code);
      this.down.add(code);
      this._setDevice('kbm');
      if (this.enabled && !this.locked) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => { const code = 'Mouse' + e.button; this.down.delete(code); this.releasedSet.add(code); });
    this.target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (this.captureCb) { const cb = this.captureCb; this.captureCb = null; cb(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); return; }
      if (!this.enabled) return;
      this.pressedSet.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
    }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
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
    window.addEventListener('gamepadconnected', () => this._setDevice('pad'));
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
  capture(cb) { this.captureCb = cb; }
  binding(action) { return (this.settings.data.controls.bindings[action]) || []; }

  _padDown(action) {
    const p = this.padNow;
    if (action === 'leanLeft') return !!(p[PAD.LT] && p[PAD.LEFT]);
    if (action === 'leanRight') return !!(p[PAD.LT] && p[PAD.RIGHT]);
    if (action === 'toolPrev') return !!(p[PAD.LEFT] && !p[PAD.LT]);
    if (action === 'toolNext') return !!(p[PAD.RIGHT] && !p[PAD.LT]);
    const b = PAD_ACTIONS[action];
    return b !== undefined && !!p[b];
  }
  _padWas(action) {
    const p = this.padPrev;
    if (action === 'leanLeft') return !!(p[PAD.LT] && p[PAD.LEFT]);
    if (action === 'leanRight') return !!(p[PAD.LT] && p[PAD.RIGHT]);
    if (action === 'toolPrev') return !!(p[PAD.LEFT] && !p[PAD.LT]);
    if (action === 'toolNext') return !!(p[PAD.RIGHT] && !p[PAD.LT]);
    const b = PAD_ACTIONS[action];
    return b !== undefined && !!p[b];
  }

  isDown(action) {
    if (this.typing) return false;
    for (const c of this.binding(action)) if (c && this.down.has(c)) return true;
    return this._padDown(action);
  }
  pressed(action) {
    if (this.typing) return false;
    for (const c of this.binding(action)) if (c && this.pressedSet.has(c)) return true;
    return this._padDown(action) && !this._padWas(action);
  }
  released(action) {
    for (const c of this.binding(action)) if (c && this.releasedSet.has(c)) return true;
    return !this._padDown(action) && this._padWas(action);
  }
  /** Was this action triggered from the controller this frame (vs keyboard)? */
  padPressed(btn) { return !!(this.padNow[btn] && !this.padPrev[btn]); }
  keyPressed(code) { return this.pressedSet.has(code); }

  poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
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
    for (let i = 0; i < 4; i++) this.padAxes[i] = pad.axes[i] || 0;
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

  endFrame() { this.pressedSet.clear(); this.releasedSet.clear(); this.mouseDX = 0; this.mouseDY = 0; }

  label(action) {
    if (this.device === 'pad') {
      if (action === 'leanLeft') return 'LT + D-PAD ←';
      if (action === 'leanRight') return 'LT + D-PAD →';
      if (PAD_ACTIONS[action] !== undefined) return PAD_LABELS[PAD_ACTIONS[action]];
    }
    const b = this.binding(action);
    return codeLabel(b[0] || b[1] || '');
  }
}

export function codeLabel(code) {
  if (!code) return '—';
  const map = {
    Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'MB4', Mouse4: 'MB5', WheelUp: 'WHEEL ↑', WheelDown: 'WHEEL ↓',
    Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
    Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER', Backspace: 'BKSP', Escape: 'ESC', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}
