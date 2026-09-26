/**
 * Touch controls for phones and tablets. They drive the same Input the
 * keyboard/mouse use (virtual keys, mouse buttons, look deltas, an analog
 * stick), so every game system works unchanged on touch screens.
 *
 *  left half ........ floating joystick (push far to sprint)
 *  right half ....... drag to look
 *  buttons .......... fire (drag it to aim while shooting), aim, jump,
 *                     crouch, reload, use/interact, build, pickaxe, ping,
 *                     edit, repair, material, rotate, emote, map, pause
 */

import { save } from '../core/save.js';

const BTN = [
  // id, label, key, style ('hold' keeps it down while touched; 'toggle' flips)
  ['fire', 'FIRE', 'Mouse0', 'hold look'],
  ['aim', 'AIM', 'Mouse2', 'toggle'],
  ['jump', 'JUMP', 'Space', ''],
  ['crouch', 'CROUCH', 'KeyC', ''],
  ['reload', 'RELOAD', 'KeyR', ''],
  ['use', 'USE', 'KeyE', 'hold'],
  ['build', 'BUILD', 'KeyB', ''],
  ['pick', '⛏', 'KeyF', ''],
  ['ping', 'PING', 'KeyZ', ''],
  ['edit', 'EDIT', 'KeyV', ''],
  ['repair', 'FIX', 'KeyU', ''],
  ['mat', 'MAT', 'KeyT', ''],
  ['emote', '♪', 'KeyN', ''],
];

export function isTouchDevice() {
  return (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window);
}

export class TouchControls {
  constructor(root, input, hooks) {
    this.root = root;
    this.input = input;
    this.hooks = hooks; // { pause(), map(), game() }
    this.touches = new Map(); // identifier -> { kind, ... }
    this.enabled = false;
    root.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-btns">${BTN.map(([id, label]) => `<button class="t-btn t-${id}" data-id="${id}">${label}</button>`).join('')}</div>
      <button class="t-top t-pause" data-top="pause" aria-label="Pause">II</button>
      <button class="t-top t-mapbtn" data-top="map" aria-label="Map">MAP</button>
      <div class="t-rotate">Turn your device sideways to play</div>`;
    this.stick = root.querySelector('.t-stick');
    this.knob = root.querySelector('.t-knob');
    this.btns = Object.fromEntries([...root.querySelectorAll('.t-btn')].map((b) => [b.dataset.id, b]));
    // listen on the whole page: menus, the map and HUD slots stay tappable,
    // everything else becomes stick / look / buttons while a match is on
    const opts = { passive: false };
    document.addEventListener('touchstart', (e) => this._start(e), opts);
    document.addEventListener('touchmove', (e) => this._move(e), opts);
    document.addEventListener('touchend', (e) => this._end(e), opts);
    document.addEventListener('touchcancel', (e) => this._end(e), opts);
    this.active = false;
    this.refresh();
  }

  get wanted() {
    const s = save.data.settings.touch || 'auto';
    return s === 'on' || (s === 'auto' && isTouchDevice());
  }

  refresh() {
    this.enabled = this.wanted;
    document.body.classList.toggle('touch', this.enabled);
  }

  show(on) {
    this.active = !!on && this.enabled;
    this.root.style.display = this.active ? 'block' : 'none';
    if (!on) this._releaseAll();
  }

  /** Touches on menus, the big map, dialogs and HUD slots are left to the page. */
  _passThrough(el) {
    return !el || !!el.closest('#menus > *, .bigmap, .spectate-bar, button:not(.t-btn):not(.t-top), input, select, a');
  }

  _vDown(code) {
    const i = this.input;
    if (code.startsWith('Mouse')) i.mouse.buttons.add(+code.slice(5));
    else i.keys.add(code);
    i.pressedSet.add(code);
  }

  _vUp(code) {
    const i = this.input;
    if (code.startsWith('Mouse')) i.mouse.buttons.delete(+code.slice(5));
    else i.keys.delete(code);
  }

  _releaseAll() {
    for (const t of this.touches.values()) if (t.code && t.hold) this._vUp(t.code);
    this.touches.clear();
    this.input.analog = null;
    this.stick.style.display = 'none';
  }

  _start(e) {
    if (!this.active) return;
    let handled = false;
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.closest('.slot, .piece, .minimap')) {
        // HUD taps are handled here (no emulated mouse click afterwards)
        this._hudTap(el);
        handled = true;
        continue;
      }
      if (this._passThrough(el)) continue;
      handled = true;
      const top = el && el.closest('[data-top]');
      if (top) {
        if (top.dataset.top === 'pause') this.hooks.pause();
        else this.hooks.map();
        continue;
      }
      const btn = el && el.closest('.t-btn');
      if (btn) {
        const def = BTN.find((b) => b[0] === btn.dataset.id);
        const [, , code, style] = def;
        btn.classList.add('on');
        if (style.includes('toggle')) {
          if (this.input.down(code)) this._vUp(code);
          else this._vDown(code);
          btn.classList.toggle('lit', this.input.down(code));
          this.touches.set(t.identifier, { kind: 'btn', btn });
        } else {
          this._vDown(code);
          this.touches.set(t.identifier, { kind: 'btn', btn, code, hold: style.includes('hold'), look: style.includes('look'), x: t.clientX, y: t.clientY });
          if (!style.includes('hold')) setTimeout(() => this._vUp(code), 60);
        }
        continue;
      }
      if (t.clientX < window.innerWidth * 0.42) {
        // floating joystick where the thumb lands
        this.touches.set(t.identifier, { kind: 'stick', ox: t.clientX, oy: t.clientY });
        this.stick.style.display = 'block';
        this.stick.style.left = `${t.clientX}px`;
        this.stick.style.top = `${t.clientY}px`;
        this.knob.style.transform = 'translate(-50%,-50%)';
        this.input.analog = { x: 0, y: 0 };
      } else {
        this.touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
      }
    }
    if (handled) e.preventDefault();
  }

  _move(e) {
    if (!this.active) return;
    let handled = false;
    const k = 1.7 * (save.data.settings.touchLook || 1);
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      if (!s) continue;
      handled = true;
      if (s.kind === 'stick') {
        const R = 56;
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const d = Math.hypot(dx, dy);
        const m = Math.min(1, d / R);
        if (d > R) { dx *= R / d; dy *= R / d; }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.input.analog = d > 6 ? { x: (dx / R), y: (dy / R), m } : { x: 0, y: 0, m: 0 };
      } else if (s.kind === 'look' || (s.kind === 'btn' && s.look)) {
        this.input.mouse.dx += (t.clientX - s.x) * k;
        this.input.mouse.dy += (t.clientY - s.y) * k;
        s.x = t.clientX;
        s.y = t.clientY;
      }
    }
    if (handled) e.preventDefault();
  }

  _end(e) {
    if (!this.active && !this.touches.size) return;
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      if (!s) continue;
      e.preventDefault();
      this.touches.delete(t.identifier);
      if (s.kind === 'stick') {
        this.input.analog = null;
        this.stick.style.display = 'none';
      } else if (s.kind === 'btn') {
        s.btn.classList.remove('on');
        if (s.hold) this._vUp(s.code);
      }
    }
  }

  /** Tapping inventory slots / build pieces on the HUD. */
  _hudTap(el) {
    if (el && el.closest('.minimap')) {
      this.hooks.map();
      return;
    }
    const slot = el && el.closest('.slot, .piece');
    if (!slot) return;
    const key = slot.querySelector('em')?.textContent;
    const code = key === 'F' ? 'KeyF' : key === 'T' ? 'KeyT' : key === 'R' ? 'KeyR' : /^[1-5]$/.test(key) ? 'Digit' + key : null;
    if (code) {
      this._vDown(code);
      setTimeout(() => this._vUp(code), 60);
    }
  }

  /** Per-frame: labels follow context (place in build mode, revive, etc.). */
  update(game) {
    if (!this.enabled || !game || !game.world) return;
    const c = game.controller;
    const p = game.player;
    const building = c.building || c.editing;
    this.btns.fire.textContent = c.editing ? 'CUT' : building ? 'PLACE' : p.item && p.item.kind === 'consumable' ? 'USE' : p.item ? 'FIRE' : 'SWING';
    this.btns.use.textContent = c.prompt ? (c.prompt.key === 'Hold E' ? 'HOLD' : 'GRAB') : 'USE';
    this.btns.use.classList.toggle('hot', !!c.prompt);
    this.btns.edit.textContent = c.editing ? 'DONE' : 'EDIT';
    for (const id of ['mat', 'edit', 'repair']) this.btns[id].style.display = building || c.aimPiece ? '' : 'none';
    this.btns.build.classList.toggle('lit', !!building);
    this.btns.aim.classList.toggle('lit', this.input.down('Mouse2'));
    this.btns.build.style.display = game.mode === 'zerobuild' ? 'none' : '';
  }
}
