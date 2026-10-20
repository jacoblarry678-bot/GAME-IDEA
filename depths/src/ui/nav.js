/**
 * Menu navigation for keyboard and controller: arrow keys / D-pad / left
 * stick move focus between [data-nav] elements in the topmost open layer,
 * Enter / A activates, Escape / B goes back. Mouse works as usual.
 */
import { PAD } from '../core/input.js';

export class MenuNav {
  constructor(input, audio) {
    this.input = input;
    this.audio = audio;
    this.stack = [];
    this.repeat = 0;
    this.lastDir = null;
    window.addEventListener('keydown', (e) => this._key(e));
  }
  push(layer, onBack) { this.stack.push({ layer, onBack }); setTimeout(() => this.focusFirst(), 0); }
  pop(layer) { this.stack = this.stack.filter((s) => s.layer !== layer); }
  top() { return this.stack[this.stack.length - 1] || null; }
  items() {
    const t = this.top();
    if (!t || !t.layer.isConnected) return [];
    return [...t.layer.querySelectorAll('[data-nav]')].filter((e) => e.offsetParent !== null && !e.disabled);
  }
  focusFirst() {
    const it = this.items();
    const pref = it.find((e) => e.hasAttribute('data-autofocus')) || it[0];
    if (pref && document.activeElement && !this.top()?.layer.contains(document.activeElement)) pref.focus({ preventScroll: false });
    else if (pref && !document.activeElement) pref.focus();
  }
  move(dx, dy) {
    const it = this.items();
    if (!it.length) return;
    const cur = document.activeElement && it.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { it[0].focus(); return; }
    if (cur.tagName === 'INPUT' && cur.type === 'range' && dx) { cur.value = String(+cur.value + dx * (+cur.step || 1)); cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bd = Infinity;
    for (const e of it) {
      if (e === cur) continue;
      const q = e.getBoundingClientRect();
      const ex = q.left + q.width / 2, ey = q.top + q.height / 2;
      const vx = ex - cx, vy = ey - cy;
      const along = dx ? vx * dx : vy * dy;
      if (along <= 2) continue;
      const across = dx ? Math.abs(vy) : Math.abs(vx);
      const d = along + across * 2.5;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); this.audio && this.audio.play('uiMove'); }
  }
  back() { const t = this.top(); if (t && t.onBack) { this.audio && this.audio.play('click'); t.onBack(); } }
  _key(e) {
    if (!this.top() || this.input.captureCb) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' && document.activeElement.type === 'text') { if (e.code === 'Escape') { document.activeElement.blur(); } return; }
    if (e.code === 'ArrowUp') { e.preventDefault(); this.move(0, -1); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); this.move(0, 1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); this.move(-1, 0); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); this.move(1, 0); }
    else if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); this.back(); }
  }
  /** Poll the controller (call each frame while a menu layer is open). */
  poll(dt) {
    if (!this.top()) return;
    const inp = this.input;
    if (!inp.pad) return;
    const ax = inp.padAxes[0], ay = inp.padAxes[1];
    let dir = null;
    if (inp.padNow[PAD.UP] || ay < -0.6) dir = 'u'; else if (inp.padNow[PAD.DOWN] || ay > 0.6) dir = 'd'; else if (inp.padNow[PAD.LEFT] || ax < -0.6) dir = 'l'; else if (inp.padNow[PAD.RIGHT] || ax > 0.6) dir = 'r';
    if (dir) {
      this.repeat -= dt;
      if (dir !== this.lastDir || this.repeat <= 0) {
        this.repeat = dir !== this.lastDir ? 0.38 : 0.12;
        this.lastDir = dir;
        this.move(dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dir === 'u' ? -1 : dir === 'd' ? 1 : 0);
      }
    } else this.lastDir = null;
    if (inp.padPressed(PAD.A)) { const a = document.activeElement; if (a && this.items().includes(a)) { a.click(); this.audio && this.audio.play('uiOk'); } }
    if (inp.padPressed(PAD.B)) this.back();
  }
}
