// Keyboard, mouse and touch input (virtual joystick + camera drag).
export class Input {
  constructor(canvas, touchRoot) {
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.joy = { x: 0, y: 0 };
    this.jumpPressed = false;
    this.pressed = new Set(); // one-shot key presses
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // mouse / pen camera drag on the 3D canvas
    let dragging = false;
    let last = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerType === 'touch') return;
      this.look.dx += e.clientX - last.x;
      this.look.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => { dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    // touch: left side joystick, elsewhere drag camera, two fingers pinch
    this.joyEl = touchRoot.querySelector('#joystick');
    this.knobEl = touchRoot.querySelector('#joystick-knob');
    const touches = new Map();
    let joyId = null;
    let joyOrigin = null;
    let pinch = null;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const leftSide = t.clientX < window.innerWidth * 0.42 && t.clientY > window.innerHeight * 0.35;
        if (joyId === null && leftSide) {
          joyId = t.identifier;
          joyOrigin = { x: t.clientX, y: t.clientY };
          this.showJoystick(joyOrigin);
        } else {
          touches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          const dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
          const max = 50;
          const len = Math.hypot(dx, dy);
          const k = len > max ? max / len : 1;
          this.joy.x = (dx * k) / max;
          this.joy.y = (dy * k) / max;
          this.moveKnob(dx * k, dy * k);
        } else if (touches.has(t.identifier)) {
          const prev = touches.get(t.identifier);
          if (touches.size === 1) {
            this.look.dx += (t.clientX - prev.x) * 1.4;
            this.look.dy += (t.clientY - prev.y) * 1.4;
          }
          touches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom += (pinch - d) / 30;
        pinch = d;
      }
      e.preventDefault();
    }, { passive: false });
    const touchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.joy.x = 0;
          this.joy.y = 0;
          this.hideJoystick();
        }
        touches.delete(t.identifier);
      }
      if (touches.size < 2) pinch = null;
    };
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);
  }

  showJoystick(p) {
    if (!this.joyEl) return;
    this.joyEl.hidden = false;
    this.joyEl.style.left = `${p.x - 60}px`;
    this.joyEl.style.top = `${p.y - 60}px`;
    this.moveKnob(0, 0);
  }
  moveKnob(dx, dy) {
    if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  hideJoystick() {
    if (this.joyEl) this.joyEl.hidden = true;
  }

  // movement intent in camera space: x = right, y = forward
  move() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    x += this.joy.x;
    y -= this.joy.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  wantsJump() {
    const j = this.jumpPressed || this.keys.has(' ');
    this.jumpPressed = false;
    return this.enabled && j;
  }

  consume(key) {
    const had = this.pressed.has(key);
    this.pressed.delete(key);
    return had;
  }

  endFrame() {
    this.look.dx = 0;
    this.look.dy = 0;
    this.zoom = 0;
    this.pressed.clear();
  }
}
