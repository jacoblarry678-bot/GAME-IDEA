/**
 * In-game HUD. Minimal by default: an interaction dot, a contextual prompt
 * (plain name, action, hold time), the equipped tool's physical readout,
 * health and stamina that appear when they change and fade after five
 * seconds, a brief objective update only when it changes, captions with
 * speaker and source, environmental warning captions, the save indicator,
 * the polaroid development and optional accessibility aids.
 */
import * as THREE from 'three';
import { el, clear } from './dom.js';
import { SPEAKERS, SOURCES } from '../data/dialogue.js';
import { ITEMS, TOOL_NAMES } from '../data/items.js';
import { CHARACTERS, CALLOUTS } from '../data/characters.js';

const ITEM_SHORT = { bandage: 'BND', firstaid: 'AID', tea: 'TEA', battery: 'BAT', film: 'FLM', decoy: 'DCY', chalk: 'CHK', wedge: 'WDG' };

export class Hud {
  constructor(root, app) {
    this.app = app;
    this.root = el('div', { class: 'hud' });
    root.appendChild(this.root);
    this.dot = el('div', { class: 'dot' });
    this.ring = el('canvas', { class: 'ring', width: 92, height: 92 });
    this.prompt = el('div', { class: 'prompt' });
    this.objective = el('div', { class: 'objective', style: { opacity: 0 } });
    this.meters = el('div', { class: 'meters', style: { opacity: 0 } });
    this.tool = el('div', { class: 'tool' });
    this.captions = el('div', { class: 'captions' });
    this.toasts = el('div', { class: 'toasts' });
    this.saveind = el('div', { class: 'saveind', style: { opacity: 0 } }, 'Saved');
    this.clockind = el('div', { class: 'clockind', style: { display: 'none' } });
    this.markers = el('div', { style: { position: 'absolute', inset: 0 } });
    this.dirring = el('div', { class: 'dirring', style: { display: 'none' } });
    this.fps = el('div', { class: 'fps', style: { display: 'none' } });
    this.hintBox = el('div', { class: 'hint', style: { display: 'none' } });
    this.radial = el('div', { class: 'radial', style: { display: 'none' } });
    this.countdownEl = el('div', { class: 'countdown', style: { display: 'none' } });
    this.letterbox = el('div', { class: 'letterbox', style: { display: 'none' } }, el('div', { class: 'lbt' }), el('div', { class: 'lbb' }));
    this.polaroid = null;
    this.root.append(this.markers, this.dot, this.ring, this.prompt, this.objective, this.meters, this.tool, this.captions, this.toasts, this.saveind, this.clockind, this.dirring, this.hintBox, this.radial, this.fps, this.countdownEl, this.letterbox);
    this._buildMeters();
    this.caps = [];
    this.metersShownAt = -99;
    this.lastVals = { h: 100, s: 100, c: 100 };
    this.objShownAt = -99;
    this.pings = [];
    this.blips = [];
    this.navMarker = null;
    this.visible = true;
  }

  _buildMeters() {
    clear(this.meters);
    this.mh = el('div', { class: 'meter health' }, el('div', { style: { width: '100%' } }));
    this.ms = el('div', { class: 'meter stamina' }, el('div', { style: { width: '100%' } }));
    this.mc = el('div', { class: 'meter comp' }, el('div', { style: { width: '100%' } }));
    this.mcl = el('div', { class: 'meter-label' }, 'Composure');
    this.meters.append(el('div', { class: 'meter-label' }, 'Health'), this.mh, el('div', { class: 'meter-label' }, 'Stamina'), this.ms, this.mcl, this.mc);
  }

  show(v) { this.visible = v; this.root.style.display = v ? '' : 'none'; }

  setObjective(text, radio) {
    clear(this.objective);
    this.objective.append(el('div', { class: 'h' }, 'Objective'), el('div', { class: 't' }, text || ''));
    if (radio) this.objective.append(el('div', { class: 'r' }, `Radio: ${radio}`));
    this.objective.style.opacity = 1;
    this.objShownAt = performance.now();
  }

  toast(text, kind = '') {
    const t = el('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.removeChild(this.toasts.firstChild);
    setTimeout(() => { t.style.transition = 'opacity 0.6s'; t.style.opacity = 0; setTimeout(() => t.remove(), 700); }, kind === 'tip' ? 7000 : 4500);
  }

  /** Evacuation countdown (null hides it). */
  countdown(left) {
    if (left == null) { this.countdownEl.style.display = 'none'; return; }
    this.countdownEl.style.display = '';
    const m = Math.floor(left / 60), sec = Math.max(0, left % 60);
    this.countdownEl.textContent = `PURGE · EVACUATE ${m}:${String(sec).padStart(2, '0')}`;
    this.countdownEl.classList.toggle('urgent', left <= 20);
  }
  cinematic(on) { this.letterbox.style.display = on ? '' : 'none'; }
  saved(text = 'Saved') { this.saveind.textContent = text; this.saveind.style.opacity = 1; clearTimeout(this._sv); this._sv = setTimeout(() => { this.saveind.style.opacity = 0; }, 2600); }

  /** Dialogue line caption. */
  line(ev) {
    const A = this.app.settings.data.accessibility;
    if (!A.subtitles) return;
    const c = el('div', { class: `cap ${ev.src === 'memory' ? 'memory' : ''}` });
    if (A.speakerNames) {
      c.append(el('span', { class: 'sp' }, SPEAKERS[ev.sp] || ev.sp));
      const s = SOURCES[ev.src];
      if (s) c.append(el('span', { class: 'src' }, ev.src === 'replay' && A.replayTag ? 'Replay · distorted' : s));
    } else if (ev.src === 'replay' && A.replayTag) c.append(el('span', { class: 'src' }, 'Replay'));
    c.append(document.createTextNode(ev.text));
    this._cap(c, ev.dur + 0.6);
  }

  /** Environmental / warning caption with optional direction tag. */
  envCaption(text, { warn = false, dir = null, dur = 4 } = {}) {
    const A = this.app.settings.data.accessibility;
    if (!A.envCaptions && !warn) return;
    if (!A.subtitles && !A.envCaptions) return;
    const t = dir && A.directionTags ? `${text} (${dir})` : text;
    this._cap(el('div', { class: `cap env ${warn ? 'warn' : ''}` }, t), dur);
  }

  _cap(node, dur) {
    const A = this.app.settings.data.accessibility;
    this.captions.style.setProperty('--capbg', A.subtitleBg);
    this.captions.style.setProperty('--capsize', A.subtitleSize);
    this.captions.appendChild(node);
    // dialogue and environmental captions are trimmed separately, so a burst of warnings never pushes a line that is still being spoken off screen
    const env = node.classList.contains('env');
    const same = [...this.captions.children].filter((c) => c.classList.contains('env') === env);
    while (same.length > 3) this.captions.removeChild(same.shift());
    setTimeout(() => { node.style.transition = 'opacity 0.4s'; node.style.opacity = 0; setTimeout(() => node.remove(), 450); }, dur * 1000);
  }

  hint(text, stage, of) {
    clear(this.hintBox);
    this.hintBox.append(el('div', { class: 'caps small dim' }, `Hint ${stage} of ${of}`), el('div', { style: { marginTop: '6px' } }, text));
    this.hintBox.style.display = '';
    clearTimeout(this._ht); this._ht = setTimeout(() => { this.hintBox.style.display = 'none'; }, 14000);
  }

  /** Begin the polaroid development animation for a captured image. */
  polaroidDevelop(url, caption, devSec = 4) {
    if (this.polaroid) this.polaroid.remove();
    const img = el('img', { src: url, alt: caption });
    const p = el('div', { class: 'polaroid dev' }, img, el('div', { class: 'cap2' }, caption));
    this.root.appendChild(p);
    this.polaroid = p;
    img.style.transitionDuration = `${devSec}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove('dev')));
    clearTimeout(this._pt);
    this._pt = setTimeout(() => { p.style.opacity = 0; p.style.transform = 'rotate(-2deg) translateY(40px)'; setTimeout(() => p.remove(), 700); }, (devSec + 4) * 1000);
  }

  ping(ev) { this.pings.push(ev); }
  navTo(pos, label = 'Next doorway') { this.navMarker = { ...pos, label, until: performance.now() + 15000 }; }
  blip(angle, warn) { this.blips.push({ a: angle, warn, until: performance.now() + 2000 }); }

  showRadial(kind, sel) {
    if (!kind) { this.radial.style.display = 'none'; return; }
    clear(this.radial);
    const opts = kind === 'tools' ? ['flashlight', 'camera', 'radio', 'supply'].map((t) => TOOL_NAMES[t]) : CALLOUTS.map((c) => c.text);
    const n = opts.length;
    opts.forEach((o, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n;
      const d = el('div', { class: `opt ${i === sel ? 'on' : ''}` }, o);
      d.style.left = `${180 + Math.cos(a) * 125}px`; d.style.top = `${172 + Math.sin(a) * 125}px`;
      this.radial.appendChild(d);
    });
    this.radial.style.display = '';
  }

  update(dt, game, p, cam, opts = {}) {
    const S = this.app.settings.data;
    const A = S.accessibility;
    document.getElementById('ui').classList.toggle('hc', !!A.highContrast);
    this.root.style.setProperty('--hud', S.interface.hudScale);
    // --- prompt
    const target = opts.target, desc = opts.desc;
    this.dot.className = `dot ${target ? 'target' : ''}`;
    this.dot.style.display = p.spectating ? 'none' : '';
    clear(this.prompt);
    if (desc && !p.spectating) {
      const key = this.app.input.label('interact');
      const holdTxt = desc.hold ? (A.holdToToggle ? ` · press · ${desc.hold.toFixed(1)} s` : desc.tap ? ` · hold ${desc.hold} s quiet / press fast` : ` · hold ${desc.hold} s`) : '';
      this.prompt.append(el('div', { class: 'name' }, desc.name));
      if (desc.locked) this.prompt.append(el('div', { class: 'lock' }, desc.locked));
      else this.prompt.append(el('div', { class: 'act' }, el('span', { class: 'key' }, key), `${desc.verb}${holdTxt}`));
    } else if (opts.extraPrompt) {
      this.prompt.append(el('div', { class: 'act' }, opts.extraPrompt));
    }
    // --- hold ring
    const ctx = this.ring.getContext('2d');
    ctx.clearRect(0, 0, 92, 92);
    const a = p.action;
    if (a && (a.dur || a.kind === 'door')) {
      const dur = a.kind === 'door' ? (a.mode === 'fast' ? 0.45 : 1.4) : a.dur;
      const k = Math.min(1, a.t / dur);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(46, 46, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d9c27a'; ctx.beginPath(); ctx.arc(46, 46, 36, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    // --- meters
    const now = performance.now();
    const changed = Math.abs(p.health - this.lastVals.h) > 0.5 || Math.abs(p.stamina - this.lastVals.s) > 0.5 || (S.interface.composureBeside && Math.abs(p.composure - this.lastVals.c) > 0.5);
    if (changed) { this.metersShownAt = now; this.lastVals = { h: p.health, s: p.stamina, c: p.composure }; }
    const showM = S.interface.hudAlways || now - this.metersShownAt < 5000 || p.health <= 25;
    this.meters.style.opacity = showM && !p.spectating ? 1 : 0;
    this.mh.firstChild.style.width = `${p.health}%`;
    this.mh.classList.toggle('low', p.health <= 25);
    this.ms.firstChild.style.width = `${p.stamina}%`;
    this.ms.firstChild.style.opacity = p.exhausted ? 0.4 : 1;
    this.mc.firstChild.style.width = `${p.composure}%`;
    this.mc.style.display = this.mcl.style.display = S.interface.composureBeside ? '' : 'none';
    // --- objective fade
    if (now - this.objShownAt > 7000) this.objective.style.opacity = 0;
    // --- tool readout
    this._tool(game, p);
    // --- clock indicator
    if (A.clockIndicator && p.clockGaze > 0.2) {
      const room = game.level.room(p.room);
      const ref = room && room.refugeData;
      if (ref) {
        this.clockind.style.display = '';
        if (p.clockGaze < 3) { this.clockind.className = 'clockind'; this.clockind.textContent = `Watching the second hand · ${Math.ceil(3 - p.clockGaze)}`; }
        else { this.clockind.className = `clockind ${ref.genuine ? 'ok' : 'bad'}`; this.clockind.textContent = ref.genuine ? 'Second hand moving · Verified' : 'Second hand stopped'; }
      }
    } else this.clockind.style.display = 'none';
    // --- markers (pings, nav assist, teammates)
    this._markers(game, p, cam);
    // --- sound ring
    if (A.soundRing) {
      this.dirring.style.display = '';
      clear(this.dirring);
      this.blips = this.blips.filter((b) => b.until > now);
      for (const b of this.blips) {
        const d = el('div', { class: `blip ${b.warn ? 'warn' : ''}` });
        d.style.transform = `translate(${Math.sin(b.a) * 100}px, ${-Math.cos(b.a) * 100}px)`;
        d.style.opacity = (b.until - now) / 2000;
        this.dirring.appendChild(d);
      }
    } else this.dirring.style.display = 'none';
    // --- fps
    this.fps.style.display = S.graphics.showFps ? '' : 'none';
    if (S.graphics.showFps) this.fps.textContent = `${Math.round(this.app.engine.fps)} fps · ${this.app.engine.renderer.info.render.calls} calls`;
  }

  _tool(game, p) {
    clear(this.tool);
    if (p.spectating) { this.tool.append(el('div', { class: 'n' }, 'Spectating'), el('div', { class: 'v' }, 'Rejoin at the next refuge')); return; }
    if (p.downed) { this.tool.append(el('div', { class: 'n' }, 'Downed'), el('div', { class: 'v' }, `${Math.max(0, Math.ceil(game.D.downed - (game.time - p.downedAt)))} s`)); return; }
    const t = p.tool;
    if (t === 'flashlight' && p.hasFlashlight) {
      this.tool.append(el('div', { class: 'n' }, `Flashlight · ${p.flashOn ? 'on' : 'off'}`), el('div', { class: 'v' }, `${Math.round(p.charge)}%`), el('div', { class: 'bar' }, el('div', { style: { width: `${p.charge}%` } })));
    } else if (t === 'camera' && p.hasCamera) {
      const dev = game.time < p.developUntil;
      const fl = p.cameraFlash ? (game.time >= p.flashReadyAt ? 'flash ready' : 'flash charging') : 'flash off';
      this.tool.append(el('div', { class: 'n' }, `Instant camera · ${fl}`), el('div', { class: 'v' }, `${p.film} / 8 exposures`), dev ? el('div', { class: 'n' }, 'Developing…') : null);
    } else if (t === 'radio') {
      this.tool.append(el('div', { class: 'n' }, 'Radio'), el('div', { class: 'v' }, 'Emergency channel'), el('div', { class: 'n' }, `${this.app.input.label('use')} replays the last instruction`));
    } else if (t === 'supply') {
      const s = p.pouch[p.selected];
      this.tool.append(el('div', { class: 'n' }, 'Supply'), el('div', { class: 'v' }, s ? `${ITEMS[s.item].name}${s.n > 1 ? ' ×' + s.n : ''}${s.sub ? ` · ${s.sub[0]}` : ''}` : 'Empty'));
    } else {
      this.tool.append(el('div', { class: 'n' }, 'Radio'), el('div', { class: 'v' }, 'Emergency channel'));
    }
    const pouch = el('div', { class: 'pouch' });
    p.pouch.forEach((s, i) => pouch.append(el('span', { class: i === p.selected && t === 'supply' ? 'sel' : '' }, s ? el('i', {}, ITEM_SHORT[s.item]) : null, s ? String(s.n) : '')));
    this.tool.append(pouch);
  }

  _markers(game, p, cam) {
    clear(this.markers);
    const now = performance.now();
    const W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    const put = (x, y, z, label, cls) => {
      v.set(x, y, z).project(cam);
      if (v.z > 1) return;
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) return;
      const m = el('div', { class: `marker ${cls}` }, label);
      m.style.left = `${sx}px`; m.style.top = `${sy}px`;
      this.markers.appendChild(m);
    };
    this.pings = this.pings.filter((q) => q.until > game.time);
    for (const q of this.pings) put(q.x, q.y, q.z, q.label, 'ping');
    if (this.navMarker && this.navMarker.until > now) put(this.navMarker.x, 1.6, this.navMarker.z, this.navMarker.label, 'door');
    // teammates within twenty metres through walls
    for (const q of game.players.values()) {
      if (q === p || !q.active) continue;
      if (Math.hypot(q.x - p.x, q.z - p.z) > 20) continue;
      const C = CHARACTERS[q.slot];
      put(q.x, q.y + 2.0, q.z, `${C ? C.short : q.name}${q.downed ? ' · DOWN' : ''}`, 'mate');
    }
  }
}
