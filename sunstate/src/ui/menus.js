/**
 * Title screen, pause menu (map, brief, settings, controls) and the settings
 * widgets. Every option shown here changes real behaviour; options that need a
 * restart say so.
 */
import { Input } from '../core/input.js';
import { BINDING_LABELS, PRESETS } from '../core/settings.js';
import { staticMap, toMap, STATIC_BLIPS, ICONS, MAP } from './mapdraw.js';
import { PROTAGONISTS } from '../game/crew.js';
import { MISSIONS, CAST } from '../game/missions.js';
import { CRIMES, WANTED_CONFIG } from '../game/wanted.js';

const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export class Menus {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.buildTitle();
    this.buildPause();
    this.loading = h('div', 'loading', '<div><h1>SUNSTATE</h1><p>Building Ocean Mile…</p></div>');
    root.appendChild(this.loading);
    this.card = h('div', 'card', '<h2>Ocean Mile</h2><p>Costa Vela</p>');
    root.appendChild(this.card);
  }

  hideLoading() { this.loading.classList.add('done'); setTimeout(() => this.loading.remove(), 700); }

  showCard(title, sub, dur = 3.5) {
    this.card.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
    this.card.classList.add('show');
    setTimeout(() => this.card.classList.remove('show'), dur * 1000);
  }

  // ---------------------------------------------------------------- title
  buildTitle() {
    const s = h('div', 'screen title-screen');
    s.innerHTML = `
      <div class="logo"><h1>SUNSTATE</h1><p>Ocean Mile · Costa Vela</p></div>
      <div class="menu"></div>
      <div class="footnote">An original, non-commercial fan prototype inspired by the atmosphere of a modern sun-belt crime epic.
      Not affiliated with or endorsed by any game publisher. All characters, places, models, textures, music and sounds are original and generated in code.</div>`;
    this.root.appendChild(s);
    this.title = s;
    this.titleMenu = s.querySelector('.menu');
  }

  showTitle(hasSave) {
    const m = this.titleMenu;
    m.innerHTML = '';
    const add = (label, fn, disabled = false, sub = '') => {
      const b = h('button', '', label);
      b.disabled = disabled;
      b.onclick = () => { this.app.audio.unlock(); this.app.audio.ui('select'); fn(); };
      m.appendChild(b);
      if (sub) m.appendChild(h('div', 'sub', sub));
      return b;
    };
    const save = this.app.saveInfo();
    add('Continue', () => this.app.continueGame(), !hasSave, save ? `Saved ${new Date(save.savedAt).toLocaleString()} · $${save.money.toLocaleString()}` : '');
    add('New Game', () => this.app.startNew());
    add('Settings', () => this.openPause('settings', true));
    add('Controls', () => this.openPause('controls', true));
    if (window.matchMedia?.('(pointer: coarse)').matches && !navigator.getGamepads?.()?.some(Boolean)) {
      m.appendChild(h('div', 'sub', 'Sunstate needs a keyboard and mouse, or a gamepad. Touch controls are not supported yet.'));
    }
    this.title.classList.add('show');
    m.querySelector('button:not(:disabled)')?.focus();
  }

  hideTitle() { this.title.classList.remove('show'); }

  // ---------------------------------------------------------------- pause
  buildPause() {
    const s = h('div', 'screen pause-screen');
    s.innerHTML = `<div class="pause-wrap"><div class="tabs"></div><div class="panel body"></div></div>`;
    this.root.appendChild(s);
    this.pause = s;
    this.tabsEl = s.querySelector('.tabs');
    this.body = s.querySelector('.body');
  }

  openPause(tab = 'game', fromTitle = false) {
    this.fromTitle = fromTitle;
    const tabs = fromTitle ? ['settings', 'controls'] : ['game', 'map', 'brief', 'settings', 'controls'];
    this.tabsEl.innerHTML = `<span class="brand">SUNSTATE</span>`;
    for (const t of tabs) {
      const b = h('button', t === tab ? 'on' : '', { game: 'Paused', map: 'Map', brief: 'Brief', settings: 'Settings', controls: 'Controls' }[t]);
      b.onclick = () => { this.app.audio.ui('select'); this.openPause(t, fromTitle); };
      this.tabsEl.appendChild(b);
    }
    const back = h('button', '', fromTitle ? '← Back' : 'Resume ✕');
    back.style.marginLeft = 'auto';
    back.onclick = () => this.closePause();
    this.tabsEl.appendChild(back);
    this.tab = tab;
    this.body.innerHTML = '';
    this.body.style.padding = tab === 'map' ? '0' : '';
    this[`tab_${tab}`]();
    this.pause.classList.add('show');
    if (fromTitle) this.title.classList.remove('show');
  }

  closePause() {
    this.app.audio.ui('back');
    this.pause.classList.remove('show');
    this.mapCleanup?.();
    if (this.fromTitle) this.showTitle(this.app.hasSave());
    else this.app.resume();
  }

  get isOpen() { return this.pause.classList.contains('show'); }

  tab_game() {
    const g = this.app.game, M = g.missions;
    const b = this.body;
    b.innerHTML = `<h2>Paused</h2>`;
    const info = h('div');
    const st = M.stage;
    info.innerHTML = `
      <p><b>${st ? M.active.def.title + ':' : 'Free roam.'}</b> ${st ? st.objective : M.available.length ? 'Look for the blue <b>S</b> marker at the Bayside Motel to start a mission.' : 'Every mission in this build is complete. Explore, rob the store again later, or test the police.'}</p>
      <p>Money: <b>$${g.economy.money.toLocaleString()}</b> · Wanted: <b>${g.wanted.level}★</b> · Time: <b>${g.engine.time.label()}</b></p>`;
    b.appendChild(info);
    const row = h('div', 'actions-row');
    const btn = (label, cls, fn) => { const e = h('button', 'pill ' + cls, label); e.onclick = fn; row.appendChild(e); return e; };
    btn('Resume', 'primary', () => this.closePause());
    if (M.failed) btn('Retry mission from checkpoint', '', () => { this.closePause(); this.app.retryMission(); });
    if (M.active) btn('Restart from last checkpoint', '', () => { const cp = M.active.checkpoint; const id = M.active.def.id; M.cleanup(); M.failed = { id, reason: 'restart', checkpoint: cp }; this.closePause(); this.app.retryMission(); });
    if (M.active) btn('Abandon mission', 'warn', () => { M.abandon(); this.closePause(); });
    btn('Respawn at safehouse', '', () => { this.closePause(); this.app.respawnAtSafehouse(); });
    btn('Quit to title', 'warn', () => this.app.quitToTitle());
    b.appendChild(row);
    b.appendChild(h('p', '', '<small>Saving happens at the safehouse (Bayside Motel door) and automatically when a mission is passed.</small>'));
  }

  tab_brief() {
    const g = this.app.game;
    const b = this.body;
    const W = g.wanted;
    const missions = Object.values(MISSIONS).map((m) => `<li><b>${m.title}</b> — ${g.missions.completed.has(m.id) ? 'complete' : g.missions.active?.def.id === m.id ? 'in progress' : 'available'}. ${m.summary}</li>`).join('');
    const log = W.log.map((l) => `<li>${l.text}</li>`).join('') || '<li>Nothing yet.</li>';
    const ledger = g.economy.ledger.slice(0, 8).map((l) => `<li>${l.amount >= 0 ? '+' : '−'}$${Math.abs(l.amount).toLocaleString()} — ${l.reason}</li>`).join('') || '<li>No transactions yet.</li>';
    const crimes = Object.values(CRIMES).map((c) => `<li>${c.label}: ${c.level}★${c.civilians === false ? ' (only if an officer sees it)' : ''}</li>`).join('');
    b.innerHTML = `<h2>Brief</h2>
      <p><b>${CAST.cal.full}</b> owes a loan shark, Teo, more than he can pay. His partner <b>${CAST.sol.full}</b> has ideas about where the money could come from — and about getting out of Costa Vela together.</p>
      <h3>Missions</h3><ul>${missions}</ul>
      <h3>Police log</h3><ul>${log}</ul>
      <h3>Money</h3><ul>${ledger}</ul>
      <h3>How the police work here</h3>
      <p>Police only act on what they know. An officer who sees a crime reports it at once. A civilian witness must finish a 911 call (${WANTED_CONFIG.callTime[0]}–${WANTED_CONFIG.callTime[1]} s) — the call fails if they get hurt or you scare them off at gunpoint. When officers lose sight of you they search around your last known position: get outside the red circle and stay unseen until the timer runs out. A vehicle the police never saw you in shakes them off faster. At ${WANTED_CONFIG.shootAtLevel}★ and above officers shoot; below that they try to arrest you.</p>
      <ul>${crimes}</ul>`;
  }

  // ---------------------------------------------------------------- map
  tab_map() {
    const app = this.app, g = app.game, hud = app.hud;
    const wrap = h('div', 'mapview');
    const c = document.createElement('canvas');
    wrap.appendChild(c);
    wrap.appendChild(h('div', 'legend', `<b style="color:#29e6ff">${ICONS.safehouse}</b> Safehouse &nbsp; <b style="color:#ffd23f">$</b> Sunny Stop &nbsp; <b style="color:#ff5566">+</b> Hospital &nbsp; <b style="color:#6ea0ff">⛨</b> Police &nbsp; <b style="color:#9fd8ff">⚓</b> Marina<br><b style="color:#29e6ff">S</b> Mission start &nbsp; <b style="color:#ffd23f">●</b> Objective &nbsp; <b style="color:#d36bff">⚑</b> Waypoint &nbsp; <b style="color:${PROTAGONISTS[g.partner.protagonist].color}">${g.partner.protagonistName[0]}</b> ${g.partner.protagonistName}<br>Click: set waypoint · Right-click: clear · Wheel: zoom · Drag: pan`));
    this.body.appendChild(wrap);
    const img = staticMap();
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const view = { cx: toMap(p.x, p.z)[0], cy: toMap(p.x, p.z)[1], zoom: 0.55 };
    const draw = () => {
      const r = wrap.getBoundingClientRect();
      c.width = r.width * devicePixelRatio; c.height = r.height * devicePixelRatio;
      const x = c.getContext('2d');
      x.fillStyle = '#1a5a72'; x.fillRect(0, 0, c.width, c.height);
      x.save();
      x.translate(c.width / 2, c.height / 2);
      x.scale(view.zoom * devicePixelRatio, view.zoom * devicePixelRatio);
      x.translate(-view.cx, -view.cy);
      x.drawImage(img, 0, 0);
      const dot = (wx, wz, col, glyph, size = 26) => {
        const [mx, my] = toMap(wx, wz);
        const s = size / view.zoom;
        x.beginPath(); x.arc(mx, my, s / 2, 0, Math.PI * 2); x.fillStyle = 'rgba(0,0,0,0.6)'; x.fill();
        x.lineWidth = 3 / view.zoom; x.strokeStyle = col; x.stroke();
        x.fillStyle = col; x.font = `800 ${s * 0.6}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, mx, my + 1 / view.zoom);
      };
      for (const b of STATIC_BLIPS) dot(b.x, b.z, b.color, ICONS[b.icon]);
      for (const m of g.missions.available) if (g.missions.canStart(m.id)) dot(m.start.x, m.start.z, '#29e6ff', 'S');
      const t = g.missions.currentTarget();
      if (t) dot(t.x, t.z, '#ffd23f', '●');
      if (hud.waypoint) dot(hud.waypoint.x, hud.waypoint.z, '#d36bff', '⚑');
      const o = g.partner;
      if (o && !o.dead && !(o.vehicle && o.vehicle === g.player.vehicle)) { const op = o.vehicle ? o.vehicle.pos : o.pos; dot(op.x, op.z, PROTAGONISTS[o.protagonist].color, o.protagonistName[0]); }
      const [px, py] = toMap(p.x, p.z);
      x.beginPath(); x.arc(px, py, 9 / view.zoom, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3 / view.zoom; x.strokeStyle = '#000'; x.stroke();
      x.restore();
    };
    const toWorld = (ev) => {
      const r = wrap.getBoundingClientRect();
      const mx = (ev.clientX - r.left - r.width / 2) / view.zoom + view.cx;
      const my = (ev.clientY - r.top - r.height / 2) / view.zoom + view.cy;
      return { x: mx / MAP.ppm + MAP.x0, z: my / MAP.ppm + MAP.z0 };
    };
    let drag = null;
    wrap.onmousedown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false }; };
    wrap.onmousemove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; view.cx = drag.cx - dx / view.zoom; view.cy = drag.cy - dy / view.zoom; draw(); };
    wrap.onmouseup = (e) => {
      if (drag && !drag.moved) {
        if (e.button === 2) hud.waypoint = null;
        else { const w = toWorld(e); hud.waypoint = { x: w.x, z: w.z, label: 'Waypoint' }; this.app.audio.ui('select'); }
        hud.routeT = 0;
        draw();
      }
      drag = null;
    };
    wrap.oncontextmenu = (e) => e.preventDefault();
    wrap.onwheel = (e) => { e.preventDefault(); view.zoom = Math.max(0.25, Math.min(2.5, view.zoom * (e.deltaY > 0 ? 0.85 : 1.18))); draw(); };
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    this.mapCleanup = () => { ro.disconnect(); this.mapCleanup = null; };
    requestAnimationFrame(draw);
  }

  // ---------------------------------------------------------------- settings
  tab_settings() {
    const S = this.app.settings;
    const b = this.body;
    b.innerHTML = '<h2>Settings</h2>';
    const section = (title) => b.appendChild(h('h3', '', title));
    const row = (label, control, val = '', note = '') => {
      const r = h('div', 'row');
      r.appendChild(h('label', '', label));
      r.appendChild(control);
      const v = h('span', 'val', val);
      r.appendChild(v);
      if (note) r.appendChild(h('div', 'note2', note));
      b.appendChild(r);
      return v;
    };
    const slider = (group, key, min, max, step, fmt = (x) => x, note = '') => {
      const i = document.createElement('input');
      i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = S.data[group][key];
      const v = row(this.label(group, key), i, fmt(S.data[group][key]), note);
      i.oninput = () => { S.set(group, key, Number(i.value)); v.textContent = fmt(S.data[group][key]); };
    };
    const seg = (group, key, options, note = '', labels = null) => {
      const d = h('div', 'seg');
      const refresh = () => [...d.children].forEach((c, k) => c.classList.toggle('on', S.data[group][key] === options[k]));
      options.forEach((o, k) => { const e = h('button', '', labels ? labels[k] : String(o)); e.onclick = () => { S.set(group, key, o); refresh(); }; d.appendChild(e); });
      refresh();
      row(this.label(group, key), d, '', note);
    };
    const toggle = (group, key, note = '') => seg(group, key, [false, true], note, ['Off', 'On']);
    const pct = (x) => Math.round(x * 100) + '%';

    section('Graphics');
    const pd = h('div', 'seg');
    for (const p of Object.keys(PRESETS)) { const e = h('button', S.g.preset === p ? 'on' : '', p[0].toUpperCase() + p.slice(1)); e.onclick = () => { S.applyPreset(p); this.openPause('settings', this.fromTitle); }; pd.appendChild(e); }
    row('Preset', pd, S.g.preset === 'custom' ? 'custom' : '', 'Sets render scale, shadows, bloom, draw distance and anti-aliasing together.');
    slider('graphics', 'renderScale', 0.4, 1.5, 0.05, pct, 'Internal resolution. Lower is faster.');
    seg('graphics', 'shadows', ['off', 'low', 'high', 'ultra'], 'Sun shadow map size and coverage.', ['Off', 'Low', 'High', 'Ultra']);
    toggle('graphics', 'bloom', 'Glow on neon, lights and the sun.');
    seg('graphics', 'drawDistance', ['low', 'medium', 'high', 'ultra'], 'Fog and far-plane distance.', ['Low', 'Medium', 'High', 'Ultra']);
    toggle('graphics', 'antialias', 'Applies after reloading the page.');
    seg('graphics', 'frameCap', [0, 30, 60, 120], 'Limit the frame rate (Off = display refresh).', ['Off', '30', '60', '120']);
    slider('graphics', 'fov', 50, 90, 1, (x) => x + '°');
    toggle('graphics', 'showFps');

    section('Audio');
    for (const k of ['master', 'music', 'sfx', 'ambient', 'ui']) slider('audio', k, 0, 1, 0.05, pct);

    section('Interface');
    slider('interface', 'hudScale', 0.7, 1.4, 0.05, pct);
    seg('interface', 'subtitleSize', ['small', 'medium', 'large'], '', ['Small', 'Medium', 'Large']);
    slider('interface', 'cameraShake', 0, 1, 0.05, pct, 'Impacts, gunfire and crashes.');
    toggle('interface', 'minimapRotate', 'Off = north always up.');
    seg('interface', 'units', ['mph', 'kmh'], '', ['MPH', 'KM/H']);

    section('World');
    slider('gameplay', 'traffic', 0, 1.5, 0.05, pct, 'Number of ambient cars.');
    slider('gameplay', 'peds', 0, 1.5, 0.05, pct, 'Number of pedestrians.');

    const r = h('div', 'actions-row');
    for (const grp of ['graphics', 'audio', 'interface', 'gameplay']) {
      const e = h('button', 'pill', `Reset ${grp}`);
      e.onclick = () => { S.resetGroup(grp); this.openPause('settings', this.fromTitle); };
      r.appendChild(e);
    }
    b.appendChild(r);
  }

  label(group, key) {
    return {
      renderScale: 'Render scale', shadows: 'Shadows', bloom: 'Bloom', drawDistance: 'Draw distance', antialias: 'Anti-aliasing', frameCap: 'Frame cap', fov: 'Field of view', showFps: 'Show FPS / stats',
      master: 'Master volume', music: 'Radio & music', sfx: 'Effects', ambient: 'Ambience', ui: 'Interface sounds',
      hudScale: 'HUD scale', subtitleSize: 'Subtitle size', cameraShake: 'Camera shake', minimapRotate: 'Rotate minimap', units: 'Speed units',
      traffic: 'Traffic density', peds: 'Pedestrian density', sensitivity: 'Mouse sensitivity', aimSensitivity: 'Aiming sensitivity', invertY: 'Invert look Y', invertX: 'Invert look X', gamepad: 'Gamepad',
    }[key] || key;
  }

  tab_controls() {
    const S = this.app.settings, input = this.app.input;
    const b = this.body;
    b.innerHTML = '<h2>Controls</h2>';
    const row = (label, control, note = '') => {
      const r = h('div', 'row');
      r.appendChild(h('label', '', label)); r.appendChild(control); r.appendChild(h('span', 'val', ''));
      if (note) r.appendChild(h('div', 'note2', note));
      b.appendChild(r);
    };
    const slider = (key, min, max, step) => {
      const i = document.createElement('input');
      i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = S.c[key];
      i.oninput = () => S.set('controls', key, Number(i.value));
      row(this.label('controls', key), i);
    };
    const toggle = (key, note) => {
      const d = h('div', 'seg');
      const refresh = () => [...d.children].forEach((c, k) => c.classList.toggle('on', S.c[key] === [false, true][k]));
      ['Off', 'On'].forEach((l, k) => { const e = h('button', '', l); e.onclick = () => { S.set('controls', key, [false, true][k]); refresh(); }; d.appendChild(e); });
      refresh();
      row(this.label('controls', key), d, note);
    };
    b.appendChild(h('h3', '', 'Look'));
    slider('sensitivity', 0.1, 3, 0.05);
    slider('aimSensitivity', 0.1, 2, 0.05);
    toggle('invertY'); toggle('invertX');
    toggle('gamepad', 'Standard-mapping controllers: left stick move/steer, right stick camera, RT fire/accelerate, LT aim/brake, A jump/handbrake, Y vehicle, X interact.');
    b.appendChild(h('h3', '', 'Key bindings — click, then press a key or mouse button (Esc cancels)'));
    for (const [action, label] of Object.entries(BINDING_LABELS)) {
      const btn = h('button', 'bindbtn', Input.label(S.c.bindings[action]));
      btn.onclick = () => {
        btn.classList.add('wait'); btn.textContent = 'Press…';
        input.captureNext = (code) => { S.bind(action, code); this.openPause('controls', this.fromTitle); };
      };
      row(label, btn);
    }
    const r = h('div', 'actions-row');
    const e = h('button', 'pill', 'Reset controls');
    e.onclick = () => { S.resetGroup('controls'); this.openPause('controls', this.fromTitle); };
    r.appendChild(e);
    b.appendChild(r);
    b.appendChild(h('p', '', '<small>Mouse look uses pointer lock (click the game). If your browser blocks it, hold a mouse button and drag to look. Esc pauses.</small>'));
  }
}
