/**
 * Input: keyboard, mouse (pointer lock or drag-to-look fallback) and gamepad,
 * mapped to named actions through the rebindable bindings in settings.
 *
 * Edge events ("pressed") are latched until a simulation step consumes them,
 * so a tap is never lost when a render frame runs zero fixed steps.
 * Tests drive the game through `virtual`, which merges with real input.
 */
export class Input {
  constructor(target, settings) {
    this.target = target;
    this.settings = settings;
    this.keys = new Set();
    this.edges = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.wheel = 0;
    this.enabled = true;
    this.locked = false;
    this.lastDevice = 'keyboard';
    this.virtual = { actions: new Set(), edges: new Set(), move: null, look: null, steer: null };
    this.pad = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, lt: 0, rt: 0, buttons: [], prev: [] };
    this.onEscape = null;
    this.onAnyKey = null;
    this.captureNext = null; // rebinding: next key/mouse button goes here

    const press = (code) => {
      if (this.captureNext) { const cb = this.captureNext; this.captureNext = null; cb(code); return; }
      if (!this.keys.has(code)) this.edges.add(code);
      this.keys.add(code);
      this.lastDevice = 'keyboard';
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { if (this.captureNext) { this.captureNext = null; return; } this.onEscape?.(); return; }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target === document.body) e.preventDefault();
      if (e.repeat) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      press(e.code);
      this.onAnyKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('mousedown', (e) => {
      press('Mouse' + e.button);
      if (this.wantLock && !this.locked) target.requestPointerLock?.()?.catch?.(() => {});
    });
    window.addEventListener('mouseup', (e) => this.keys.delete('Mouse' + e.button));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // without pointer lock, look only while a button is held (drag-to-look)
      if (this.locked || this.keys.has('Mouse0') || this.keys.has('Mouse2')) {
        this.lookX += e.movementX || 0;
        this.lookY += e.movementY || 0;
      }
    });
    target.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === target; });
    this.wantLock = false;
  }

  requestLock() {
    this.wantLock = true;
    try { this.target.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not allowed here */ }
  }

  releaseLock() {
    this.wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  code(action) { return this.settings.c.bindings[action]; }

  /** Gamepad button index per action (standard mapping). */
  static PAD = { jump: 0, handbrake: 0, crouch: 1, interact: 2, enterVehicle: 3, nextWeapon: 5, reload: 2, horn: 10, radio: 15, map: 8, lookBehind: 11, headlights: 14, sprint: 10, skip: 0, switchCharacter: 12, partner: 13 };

  down(action) {
    if (this.virtual.actions.has(action)) return true;
    if (!this.enabled) return false;
    if (this.keys.has(this.code(action))) return true;
    if (action === 'fire') return this.pad.rt > 0.4;
    if (action === 'aim') return this.pad.lt > 0.4;
    const b = Input.PAD[action];
    return b !== undefined && !!this.pad.buttons[b];
  }

  pressed(action) {
    if (this.virtual.edges.has(action)) return true;
    if (!this.enabled) return false;
    if (this.edges.has(this.code(action))) return true;
    const b = Input.PAD[action];
    return b !== undefined && !!this.pad.buttons[b] && !this.pad.prev[b];
  }

  /** Movement axes, x right, y forward, each in [-1, 1]. */
  move() {
    if (this.virtual.move) return { ...this.virtual.move };
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.down('forward')) y += 1;
      if (this.down('back')) y -= 1;
      if (this.down('right')) x += 1;
      if (this.down('left')) x -= 1;
      if (Math.abs(this.pad.move.x) > 0.15 || Math.abs(this.pad.move.y) > 0.15) { x = this.pad.move.x; y = -this.pad.move.y; }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /** Vehicle controls: throttle 0..1, brake 0..1, steer -1..1 (right positive). */
  drive() {
    if (this.virtual.steer) return { ...this.virtual.steer };
    let throttle = this.down('forward') ? 1 : 0;
    let brake = this.down('back') ? 1 : 0;
    let steer = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    if (this.pad.rt > 0.05) throttle = Math.max(throttle, this.pad.rt);
    if (this.pad.lt > 0.05) brake = Math.max(brake, this.pad.lt);
    if (Math.abs(this.pad.move.x) > 0.12) steer = this.pad.move.x;
    if (!this.enabled) return { throttle: 0, brake: 0, steer: 0 };
    return { throttle, brake, steer };
  }

  /** Accumulated look delta in pixels since the last call (mouse + right stick). */
  takeLook(dt) {
    const s = this.settings.c;
    let x = this.lookX, y = this.lookY;
    this.lookX = 0; this.lookY = 0;
    if (this.virtual.look) { x += this.virtual.look.x; y += this.virtual.look.y; }
    if (Math.abs(this.pad.look.x) > 0.12) x += this.pad.look.x * 900 * dt;
    if (Math.abs(this.pad.look.y) > 0.12) y += this.pad.look.y * 600 * dt;
    if (s.invertX) x = -x;
    if (s.invertY) y = -y;
    return { x, y };
  }

  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  pollGamepad() {
    if (!this.settings.c.gamepad || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    const p = this.pad;
    if (!gp) { p.buttons = []; p.move.x = p.move.y = p.look.x = p.look.y = p.lt = p.rt = 0; return; }
    p.buttons = gp.buttons.map((b) => b.pressed);
    p.move.x = gp.axes[0] || 0; p.move.y = gp.axes[1] || 0;
    p.look.x = gp.axes[2] || 0; p.look.y = gp.axes[3] || 0;
    p.lt = gp.buttons[6]?.value || 0; p.rt = gp.buttons[7]?.value || 0;
    if (p.buttons.some(Boolean) || Math.hypot(p.move.x, p.move.y) > 0.3) this.lastDevice = 'gamepad';
  }

  /** Called after each fixed simulation step. */
  endStep() {
    this.edges.clear();
    this.virtual.edges.clear();
    this.pad.prev = this.pad.buttons;
  }

  /** Readable name for a key code. */
  static label(code) {
    if (!code) return '—';
    if (code === 'Mouse0') return 'LMB';
    if (code === 'Mouse1') return 'MMB';
    if (code === 'Mouse2') return 'RMB';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Arrow')) return code.slice(5) === 'Up' ? '↑' : code.slice(5) === 'Down' ? '↓' : code.slice(5) === 'Left' ? '←' : '→';
    const map = { ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Bksp', CapsLock: 'Caps' };
    return map[code] || code;
  }
}
