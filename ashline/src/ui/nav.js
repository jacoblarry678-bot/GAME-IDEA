/**
 * Controller / keyboard navigation for menus: moves a focus highlight
 * between interactive elements spatially, A/Enter activates, B/Escape backs.
 */
import { PAD } from '../core/input.js';

const SEL = 'button:not([disabled]), select, input[type=range], [data-nav]';

export class MenuNav {
  constructor(app) {
    this.app = app;
    this.focus = null;
    this.repeatT = 0;
    this.lastDir = null;
  }

  items() {
    const scope = document.querySelector('#ui .modal') || document.querySelector('#ui .screen:last-of-type') || document.querySelector('#ui');
    return [...scope.querySelectorAll(SEL)].filter((e) => e.offsetParent !== null);
  }

  setFocus(e) {
    if (this.focus) this.focus.classList.remove('focus');
    this.focus = e;
    if (e) {
      e.classList.add('focus');
      e.focus({ preventScroll: false });
      e.scrollIntoView?.({ block: 'nearest' });
    }
  }

  move(dx, dy) {
    const items = this.items();
    if (!items.length) return;
    if (!this.focus || !items.includes(this.focus)) { this.setFocus(items[0]); return; }
    const r0 = this.focus.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bd = Infinity;
    for (const e of items) {
      if (e === this.focus) continue;
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const vx = x - cx, vy = y - cy;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const perp = Math.abs(vx * dy - vy * dx);
      const d = along + perp * 2.5;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { this.setFocus(best); this.app.audio.ui('hover'); }
  }

  /** Poll controller each frame while menus are visible. */
  update(dt) {
    const inp = this.app.input;
    if (!inp.pad) return;
    const ax = inp.padAxes[0], ay = inp.padAxes[1];
    let dir = null;
    if (inp.padNow[PAD.UP] || ay < -0.6) dir = [0, -1];
    else if (inp.padNow[PAD.DOWN] || ay > 0.6) dir = [0, 1];
    else if (inp.padNow[PAD.LEFT] || ax < -0.6) dir = [-1, 0];
    else if (inp.padNow[PAD.RIGHT] || ax > 0.6) dir = [1, 0];
    if (dir) {
      const key = dir.join(',');
      if (key !== this.lastDir) { this.repeatT = 0.35; this.lastDir = key; this.navDir(dir); }
      else { this.repeatT -= dt; if (this.repeatT <= 0) { this.repeatT = 0.12; this.navDir(dir); } }
    } else this.lastDir = null;
    if (inp.padPressed(PAD.A)) this.activate();
    if (inp.padPressed(PAD.B)) this.app.screens.back();
  }

  navDir(dir) {
    const f = this.focus;
    // sliders & selects adjust with left/right
    if (f && dir[1] === 0 && f.matches('input[type=range]')) {
      const step = Number(f.step) || 0.1;
      f.value = String(Math.min(Number(f.max), Math.max(Number(f.min), Number(f.value) + step * dir[0])));
      f.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (f && dir[1] === 0 && f.matches('select')) {
      f.selectedIndex = Math.min(f.options.length - 1, Math.max(0, f.selectedIndex + dir[0]));
      f.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    this.move(dir[0], dir[1]);
  }

  activate() {
    const f = this.focus;
    if (!f || !document.contains(f)) { this.move(0, 1); return; }
    if (f.matches('select, input[type=range]')) return;
    f.click();
  }

  reset() { this.setFocus(null); }
}
