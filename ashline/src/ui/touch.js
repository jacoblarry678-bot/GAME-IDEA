/**
 * Touch controls for phones and tablets. Everything feeds the normal Input
 * object as virtual actions (the same action names as keyboard bindings), so
 * every mode, menu and the online client work unchanged:
 *   - left thumb: floating move stick (push all the way forward to sprint)
 *   - right side: drag anywhere to look; the FIRE button also looks while held
 *   - buttons: fire (both sides), aim (toggle), jump, crouch (toggle), reload,
 *     swap, melee, lethal, tactical, support 1–3, pick-up (Battle Royale),
 *     scoreboard and pause.
 * Visible only during a live match when touch controls are enabled.
 */
const LOOK_K = 2.4; // touch px → mouse-equivalent units

export function isTouchDevice() {
  try { return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0; } catch { return false; }
}

const BUTTONS = [
  // [action, label, css class]
  ['fire', 'FIRE', 'tb-fire'], ['fire', 'FIRE', 'tb-fire-l'], ['ads', 'AIM', 'tb-ads'], ['jump', 'JUMP', 'tb-jump'], ['crouch', 'CROUCH', 'tb-crouch'],
  ['reload', 'RELOAD', 'tb-reload'], ['swap', 'SWAP', 'tb-swap'], ['melee', 'MELEE', 'tb-melee'], ['lethal', 'FRAG', 'tb-lethal'], ['tactical', 'TAC', 'tb-tac'],
  ['support1', '3', 'tb-s1'], ['support2', '4', 'tb-s2'], ['support3', '5', 'tb-s3'], ['interact', 'PICK UP', 'tb-interact'], ['scoreboard', 'SCORES', 'tb-score'], ['emote', '☺', 'tb-emote'],
];

export class TouchControls {
  constructor(app) {
    this.app = app;
    const inp = this.inp = app.input;
    this.root = document.createElement('div');
    this.root.className = 'touch-ui';
    this.root.innerHTML = `<div class="tz-move"></div><div class="tz-look"></div><div class="t-stick"><i></i></div>
      ${BUTTONS.map(([a, l, c]) => `<button class="tb ${c}" data-act="${a}">${l}</button>`).join('')}
      <button class="tb tb-pause" data-pause="1">❚❚</button>`;
    document.getElementById('app').appendChild(this.root);
    this.stick = this.root.querySelector('.t-stick');
    this.knob = this.stick.querySelector('i');
    this.moveId = null; this.lookIds = new Map();
    this.btnAct = new Map(); // pointerId → action
    const zMove = this.root.querySelector('.tz-move'), zLook = this.root.querySelector('.tz-look');
    const opt = { passive: false };
    zMove.addEventListener('pointerdown', (e) => this.moveStart(e), opt);
    zLook.addEventListener('pointerdown', (e) => this.lookStart(e, zLook), opt);
    for (const b of this.root.querySelectorAll('[data-act]')) b.addEventListener('pointerdown', (e) => this.btnStart(e, b), opt);
    this.root.querySelector('[data-pause]').addEventListener('pointerdown', (e) => { e.preventDefault(); app.pauseMatch(); this.update(); }, opt);
    window.addEventListener('pointermove', (e) => this.onMove(e), opt);
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    // any real touch switches the device (shows the controls in 'auto' mode)
    window.addEventListener('touchstart', () => { inp.touch.seen = true; inp._setDevice('touch'); }, { passive: true });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.visible = false;
    this.inp.touch.active = this.enabled; // known before the first menu renders
  }

  get enabled() {
    const mode = this.app.settings.data.controls.touchControls;
    return mode === 'on' || (mode === 'auto' && (this.inp.touch.seen || isTouchDevice()));
  }

  moveStart(e) {
    e.preventDefault();
    if (this.moveId !== null) return;
    this.moveId = e.pointerId;
    this.ox = e.clientX; this.oy = e.clientY;
    this.stick.style.display = 'block';
    this.stick.style.left = `${this.ox}px`; this.stick.style.top = `${this.oy}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  lookStart(e) {
    e.preventDefault();
    this.lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  btnStart(e, b) {
    e.preventDefault();
    const act = b.dataset.act, T = this.inp.touch;
    this.btnAct.set(e.pointerId, act);
    T.down.add(act); T.pressed.add(act);
    b.classList.add('on');
    if (act === 'fire') this.lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: b }); // fire-and-look
    if (navigator.vibrate && act === 'fire' && this.app.settings.data.controls.padVibration) try { navigator.vibrate(8); } catch { /* not supported */ }
  }

  onMove(e) {
    const T = this.inp.touch;
    if (e.pointerId === this.moveId) {
      e.preventDefault();
      const R = 56;
      let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      T.move.x = dx / R; T.move.y = -dy / R;
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const l = this.lookIds.get(e.pointerId);
    if (l) {
      e.preventDefault();
      const k = LOOK_K * this.app.settings.data.controls.touchSens;
      this.inp.mouseDX += (e.clientX - l.x) * k;
      this.inp.mouseDY += (e.clientY - l.y) * k;
      l.x = e.clientX; l.y = e.clientY;
    }
  }

  onUp(e) {
    const T = this.inp.touch;
    if (e.pointerId === this.moveId) { this.moveId = null; T.move.x = T.move.y = 0; this.stick.style.display = 'none'; }
    this.lookIds.delete(e.pointerId);
    const act = this.btnAct.get(e.pointerId);
    if (act) {
      this.btnAct.delete(e.pointerId);
      if (![...this.btnAct.values()].includes(act)) T.down.delete(act);
      for (const b of this.root.querySelectorAll(`[data-act=${act}]`)) b.classList.remove('on');
    }
  }

  /** Per frame: show during live matches, reflect state (aim/crouch toggles, ready abilities, pick-up). */
  update() {
    const app = this.app, g = app.game;
    const show = this.enabled && app.state === 'match-live' && !!g && !g.ended;
    this.inp.touch.active = this.enabled;
    document.body.classList.toggle('touch-on', this.enabled);
    if (show !== this.visible) {
      this.visible = show;
      this.root.classList.toggle('show', show);
      if (!show) this.releaseAll();
    }
    if (!show) return;
    const p = g.player;
    const set = (cls, on) => this.root.querySelector(cls)?.classList.toggle('lit', !!on);
    set('.tb-ads', g.adsToggle); set('.tb-crouch', g.crouchToggle);
    const range = g.isRange;
    ['support1', 'support2', 'support3'].forEach((a, i) => {
      const b = this.root.querySelector(`.tb-s${i + 1}`);
      const id = ['recon', 'supply', 'strike'][i];
      b.style.display = range ? 'none' : '';
      b.classList.toggle('ready', (p.abilities?.[id] || 0) > 0);
    });
    this.root.querySelector('.tb-interact').style.display = g.interactPrompt?.() ? '' : 'none';
    this.root.querySelector('.tb-lethal').textContent = `FRAG ${p.lethal.count}`;
    this.root.querySelector('.tb-tac').textContent = `TAC ${p.tactical.count}`;
  }

  releaseAll() {
    const T = this.inp.touch;
    T.down.clear(); T.move.x = T.move.y = 0;
    this.moveId = null; this.lookIds.clear(); this.btnAct.clear();
    this.stick.style.display = 'none';
    for (const b of this.root.querySelectorAll('.tb.on')) b.classList.remove('on');
  }
}
