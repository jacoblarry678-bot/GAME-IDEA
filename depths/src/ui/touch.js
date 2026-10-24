/**
 * Touch controls for phones and tablets. A floating stick on the left side
 * moves (it appears where the thumb lands), dragging anywhere else looks,
 * and buttons cover the other actions. Everything goes through the same
 * Input actions the keyboard and controller use. The controls show once the
 * screen is touched (or always / never, from Settings → Controls) and only
 * while playing with no menu open.
 */
import { el } from './dom.js';

// [label, action, size, right, bottom] — positions in px from the bottom-right corner
const PAD = [
  ['Use', 'use', 80, 16, 18],
  ['Act', 'interact', 64, 108, 14],
  ['Crouch', 'crouch', 54, 184, 14],
  ['Aim', 'inspect', 58, 24, 110],
  ['Run', 'sprint', 54, 100, 92],
  ['Light', 'flashlight', 46, 24, 182],
  ['Flash', 'cameraFlash', 46, 80, 160],
  ['Tool', 'toolNext', 46, 136, 160],
  ['Reload', 'reload', 46, 192, 86],
  ['Breathe', 'breathe', 46, 250, 22],
];
// top-right bar: [label, action or function name]
const TOP = [['Menu', 'pause'], ['Journal', 'journal'], ['Bag', 'inventory'], ['Hint', 'hint'], ['Chat', 'fn:chat'], ['Full', 'fn:fullscreen']];
const STICK_R = 56;
const LOOK_RAD_PER_PX = 0.0055;

export class TouchControls {
  constructor(app, parent, before) {
    this.app = app;
    this.input = app.input;
    this.touches = new Map(); // identifier -> { kind: 'btn' | 'stick' | 'look', ... }
    this.visible = false;
    this.layer = el('div', { id: 'touch', 'aria-hidden': 'true' });
    this.stick = el('div', { class: 'tstick rest' }, el('div', { class: 'knob' }));
    this.layer.append(this.stick);
    this.buttons = {};
    for (const [label, action, size, r, b] of PAD) {
      const btn = el('div', { class: 'tbtn', 'data-act': action }, label);
      btn.style.setProperty('--s', `${size}px`); btn.style.setProperty('--r', `${r}px`); btn.style.setProperty('--b', `${b}px`);
      this.buttons[action] = btn;
      this.layer.append(btn);
    }
    const top = el('div', { class: 'ttop' });
    for (const [label, act] of TOP) {
      const btn = el('div', { class: 'tbtn', [act.startsWith('fn:') ? 'data-fn' : 'data-act']: act.replace('fn:', '') }, label);
      this.buttons[act] = btn;
      top.append(btn);
    }
    this.layer.append(top);
    parent.insertBefore(this.layer, before);
    const opts = { passive: false };
    this.layer.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) this._start(t); }, opts);
    this.layer.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) this._move(t); }, opts);
    const end = (e) => { e.preventDefault(); for (const t of e.changedTouches) this._end(t); };
    this.layer.addEventListener('touchend', end, opts);
    this.layer.addEventListener('touchcancel', end, opts);
    this.fns = {
      chat: () => { if (app.coop) app.overlays.chat(); },
      fullscreen: () => {
        const d = document;
        if (d.fullscreenElement) { d.exitFullscreen().catch(() => {}); return; }
        const r = d.documentElement.requestFullscreen && d.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (r && r.then) r.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
      },
    };
  }

  _start(t) {
    const b = t.target && t.target.closest ? t.target.closest('.tbtn') : null;
    if (b) {
      if (b.dataset.fn) this.fns[b.dataset.fn]();
      else this.input.touchAction(b.dataset.act, true);
      b.classList.add('down');
      this.touches.set(t.identifier, { kind: 'btn', b });
      return;
    }
    const w = this.layer.clientWidth, h = this.layer.clientHeight;
    if (!this._stickId() && t.clientX < w * 0.42 && t.clientY > h * 0.22) {
      this.touches.set(t.identifier, { kind: 'stick', ox: t.clientX, oy: t.clientY });
      this.stick.classList.remove('rest');
      this.stick.style.left = `${t.clientX}px`; this.stick.style.top = `${t.clientY}px`; this.stick.style.bottom = 'auto';
      this._knob(0, 0);
      return;
    }
    this.touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
  }

  _move(t) {
    const s = this.touches.get(t.identifier);
    if (!s) return;
    if (s.kind === 'stick') {
      let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
      const m = Math.hypot(dx, dy);
      if (m > STICK_R) { dx *= STICK_R / m; dy *= STICK_R / m; }
      this._knob(dx, dy);
      const k = Math.min(1, m / STICK_R), dead = 0.15;
      const v = k < dead ? 0 : (k - dead) / (1 - dead);
      const a = Math.atan2(dy, dx);
      this.input.touchMove.x = Math.cos(a) * v;
      this.input.touchMove.y = -Math.sin(a) * v;
    } else if (s.kind === 'look') {
      const k = LOOK_RAD_PER_PX * (this.app.settings.data.controls.touchLook || 1);
      this.input.touchLook.x += (t.clientX - s.x) * k;
      this.input.touchLook.y += (t.clientY - s.y) * k;
      s.x = t.clientX; s.y = t.clientY;
    }
  }

  _end(t) {
    const s = this.touches.get(t.identifier);
    if (!s) return;
    this.touches.delete(t.identifier);
    if (s.kind === 'btn') {
      s.b.classList.remove('down');
      if (s.b.dataset.act) this.input.touchAction(s.b.dataset.act, false);
    } else if (s.kind === 'stick') {
      this.input.touchMove.x = 0; this.input.touchMove.y = 0;
      this._restStick();
    }
  }

  _stickId() { for (const [id, s] of this.touches) if (s.kind === 'stick') return id + 1; return 0; }
  _knob(dx, dy) { this.stick.firstChild.style.transform = `translate(${dx}px, ${dy}px)`; }
  _restStick() { this.stick.classList.add('rest'); this.stick.style.left = ''; this.stick.style.top = ''; this.stick.style.bottom = ''; this._knob(0, 0); }

  /** Called every frame: show or hide, and reflect latched and unavailable buttons. */
  update() {
    const app = this.app, mode = app.settings.data.controls.touch || 'auto';
    const wanted = mode === 'on' || (mode === 'auto' && this.input.device === 'touch');
    const inGame = app.state === 'game' && !!app.game;
    app.uiRoot.classList.toggle('touch', wanted && inGame);
    const show = wanted && inGame && !app.overlays.open;
    if (show !== this.visible) {
      this.visible = show;
      this.layer.classList.toggle('on', show);
      if (!show) {
        for (const s of this.touches.values()) if (s.kind === 'btn') s.b.classList.remove('down');
        this.touches.clear();
        this.input.touchReset();
        this._restStick();
      }
    }
    if (!show) return;
    const p = app.game.players.get(app.pid);
    if (!p) return;
    const B = this.buttons;
    B.sprint.classList.toggle('lit', !!app.controller.sprintLatch);
    B.crouch.classList.toggle('lit', !!p.crouched);
    B.flashlight.classList.toggle('lit', !!p.flashOn);
    B.flashlight.classList.toggle('off', !p.hasFlashlight);
    B.cameraFlash.classList.toggle('off', !p.hasCamera);
    B.reload.classList.toggle('off', p.tool !== 'camera');
    B['fn:chat'].style.display = app.coop ? '' : 'none';
    B['fn:fullscreen'].style.display = document.fullscreenEnabled ? '' : 'none';
  }
}
