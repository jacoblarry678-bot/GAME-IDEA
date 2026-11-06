// Keyboard, mouse (pointer lock) and touch controls, read once per frame.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, l: false, r: false, lp: false };
    this.locked = false;
    this.touch = { active: false, mx: 0, my: 0, lookDX: 0, lookDY: 0, buttons: {}, taps: new Set() };
    this.enabled = false;
    this.wiggleLast = null;
    this.wiggle = 0;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'KeyA' || e.code === 'KeyD') { if (this.wiggleLast && this.wiggleLast !== e.code) this.wiggle++; this.wiggleLast = e.code; }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.touch.active) { this.requestLock(); return; }
      if (e.button === 0) { this.mouse.l = true; this.mouse.lp = true; }
      if (e.button === 2) this.mouse.r = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked && this.onUnlock) this.onUnlock(); });
  }

  requestLock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // Touch controls: a stick on the left, look anywhere on the right, buttons.
  buildTouch(root, role) {
    this.touch.active = true;
    root.innerHTML = '';
    root.hidden = false;
    const stick = document.createElement('div');
    stick.className = 'tstick';
    const knob = document.createElement('div');
    knob.className = 'tknob';
    stick.appendChild(knob);
    root.appendChild(stick);
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        let dx = (t.clientX - sx) / 55, dy = (t.clientY - sy) / 55;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        this.touch.mx = dx; this.touch.my = dy;
        knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      }
    };
    stick.addEventListener('touchmove', (e) => { moveStick(e); e.preventDefault(); }, { passive: false });
    const endStick = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; this.touch.mx = this.touch.my = 0; knob.style.transform = ''; } };
    stick.addEventListener('touchend', endStick); stick.addEventListener('touchcancel', endStick);
    const look = document.createElement('div');
    look.className = 'tlook';
    root.appendChild(look);
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault(); }, { passive: false });
    look.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) { this.touch.lookDX += (t.clientX - lx) * 2.2; this.touch.lookDY += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; } e.preventDefault(); }, { passive: false });
    look.addEventListener('touchend', () => { lid = null; });
    const btns = role === 'killer'
      ? [['attack', 'Attack'], ['act', 'Action'], ['item', 'Power']]
      : [['act', 'Vault / Drop'], ['interact', 'Hold: Use'], ['item', 'Item'], ['run', 'Run'], ['crouch', 'Crouch']];
    const wrap = document.createElement('div');
    wrap.className = 'tbtns';
    root.appendChild(wrap);
    for (const [id, label] of btns) {
      const b = document.createElement('button');
      b.className = 'tbtn tb-' + id;
      b.textContent = label;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (id === 'run') { this.touch.buttons.run = !this.touch.buttons.run; b.classList.toggle('on', this.touch.buttons.run); return; }
        this.touch.buttons[id] = true; this.touch.taps.add(id); b.classList.add('on');
      }, { passive: false });
      const up = (e) => { e.preventDefault(); if (id !== 'run') { this.touch.buttons[id] = false; b.classList.remove('on'); } };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      wrap.appendChild(b);
    }
  }

  read() {
    const k = this.keys, p = this.pressed, t = this.touch;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - t.my;
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + t.mx;
    const stickRun = Math.hypot(t.mx, t.my) > 0.92;
    const out = {
      moveF: Math.max(-1, Math.min(1, f)), moveR: Math.max(-1, Math.min(1, r)),
      run: k.has('ShiftLeft') || k.has('ShiftRight') || !!t.buttons.run || stickRun,
      crouchPressed: p.has('ControlLeft') || p.has('KeyC') || t.taps.has('crouch'),
      interact: this.mouse.l || k.has('KeyE') || !!t.buttons.interact,
      interactPressed: p.has('KeyE') || t.taps.has('interact'),
      actPressed: p.has('Space') || t.taps.has('act'),
      actHeld: k.has('Space') || !!t.buttons.act,
      item: this.mouse.r || k.has('KeyF') || k.has('KeyQ') || !!t.buttons.item,
      attack: this.mouse.l || !!t.buttons.attack,
      attackPressed: this.mouse.lp || t.taps.has('attack'),
      lookX: this.mouse.dx + t.lookDX, lookY: this.mouse.dy + t.lookDY,
      wiggle: this.wiggle + (t.taps.has('act') ? 1 : 0) + (t.taps.has('interact') ? 1 : 0),
      escape: p.has('Escape') || p.has('KeyP'),
      tab: k.has('Tab'),
    };
    this.mouse.dx = this.mouse.dy = 0; this.mouse.lp = false;
    t.lookDX = t.lookDY = 0; t.taps.clear();
    p.clear();
    this.wiggle = 0;
    return out;
  }
}
