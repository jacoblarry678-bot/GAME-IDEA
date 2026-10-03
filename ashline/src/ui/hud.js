/**
 * In-match HUD (DOM overlay). Writes to the DOM only when values change.
 */
import { el, esc } from './dom.js';
import { TEAMS } from '../game/modes.js';

export class Hud {
  constructor(root, app) {
    this.app = app;
    this.root = el('div', { id: 'hud' });
    root.appendChild(this.root);
    this.cache = {};
    this.root.innerHTML = `
      <div class="nameplates"></div>
      <div class="vignette"></div>
      <div class="flash-white"></div>
      <div class="blind"></div>
      <div class="scope"><div class="mask"></div><div class="line h"></div><div class="line v"></div><div class="line h thick-l"></div><div class="line h thick-r"></div><div class="line v thick-b"></div><div class="dot"></div></div>
      <div class="xh"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i><i class="c"></i></div>
      <div class="hitm"><i style="transform:rotate(45deg) translateY(-9px)"></i><i style="transform:rotate(135deg) translateY(-9px)"></i><i style="transform:rotate(225deg) translateY(-9px)"></i><i style="transform:rotate(315deg) translateY(-9px)"></i></div>
      <div class="dmgring"></div>
      <div class="hud-tl"><div class="hs"><canvas class="minimap" width="190" height="190"></canvas></div></div>
      <div class="hud-tc"><div class="hs"><div class="scorebar">
        <div class="tm t0"><span class="n"></span><span class="s">0</span></div>
        <div class="clock"><span class="time">10:00</span><small class="lim"></small></div>
        <div class="tm t1"><span class="s">0</span><span class="n"></span></div>
      </div></div></div>
      <div class="hud-tr"><div class="hs"><div class="killfeed"></div><div class="fps"></div></div></div>
      <div class="hud-bl"><div class="hs"><div class="hp"><div class="lab"><span>HEALTH</span><span class="hpv">100</span></div><div class="barbg"><div class="fill"></div></div></div></div></div>
      <div class="hud-br"><div class="hs">
        <div class="support"></div>
        <div class="wname"></div>
        <div class="ammo"><span class="mag">30</span><span class="res">/ 120</span></div>
        <div class="equip"><span class="e lethal"><span class="ic"></span><span class="lk"></span> <span class="lc"></span></span><span class="e tactical"><span class="ic sq"></span><span class="tk"></span> <span class="tc"></span></span></div>
      </div></div>
      <div class="popups"></div>
      <div class="prompt"></div>
      <div class="protect"></div>
      <div class="center-msg"></div>
      <div class="death"></div>
      <div class="captions"></div>
      <div class="scoreboard"></div>
      <div class="range-panel"></div>
      <div class="obj-markers"></div>
      <div class="obj-strip"></div>
    `;
    const q = (s) => this.root.querySelector(s);
    this.$ = {
      xh: q('.xh'), hitm: q('.hitm'), ring: q('.dmgring'), vignette: q('.vignette'), flash: q('.flash-white'), scope: q('.scope'),
      mini: q('.minimap'), t0: q('.t0'), t1: q('.t1'), time: q('.time'), lim: q('.lim'), kf: q('.killfeed'), fps: q('.fps'),
      hp: q('.hp'), hpv: q('.hpv'), hpfill: q('.hp .fill'), wname: q('.wname'), mag: q('.mag'), res: q('.res'),
      lethal: q('.lethal'), tactical: q('.tactical'), lk: q('.lk'), lc: q('.lc'), tk: q('.tk'), tc: q('.tc'),
      popups: q('.popups'), prompt: q('.prompt'), protect: q('.protect'), center: q('.center-msg'), death: q('.death'),
      blind: q('.blind'), support: q('.support'),
      captions: q('.captions'), sb: q('.scoreboard'), np: q('.nameplates'), rp: q('.range-panel'), topc: q('.hud-tc'), om: q('.obj-markers'), os: q('.obj-strip'),
    };
    this.miniCtx = this.$.mini.getContext('2d');
    this.hitT = 0; this.indicators = []; this.nadeInds = [];
    this.centerT = 0;
    this.applySettings();
  }

  applySettings() {
    const s = this.app.settings.data;
    const r = this.root.style;
    document.documentElement.style.setProperty('--hud-scale', s.interface.hudScale);
    r.setProperty('--xh-color', s.interface.crosshairColor);
    r.setProperty('--xh-size', s.interface.crosshairSize);
    const style = s.interface.crosshair;
    const show = (sel, on) => { this.$.xh.querySelectorAll(sel).forEach((e) => { e.style.display = on ? '' : 'none'; }); };
    show('.t,.b,.l,.r', style === 'cross' || style === 'cross_dot');
    show('.d', style === 'dot' || style === 'cross_dot');
    show('.c', style === 'circle');
    this.$.mini.style.display = s.interface.minimap === 'off' ? 'none' : '';
    this.$.kf.style.display = s.interface.killfeed ? '' : 'none';
    const [f, e] = this.app.settings.teamColors();
    document.documentElement.style.setProperty('--friendly', f);
    document.documentElement.style.setProperty('--enemy', e);
  }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  /** Free-for-all style score bar: you vs. the leader. */
  setFfa(on) {
    if (!on) return;
    this.$.t0.querySelector('.n').textContent = 'YOU';
    this.$.t1.querySelector('.n').textContent = 'LEADER';
    this.$.t0.style.color = 'var(--friendly)'; this.$.t1.style.color = 'var(--enemy)';
  }

  /** Objective strip under the score bar (flags, zone state, round info). */
  objStrip(html) { this.set('os', html, (v) => { this.$.os.innerHTML = v; this.$.os.style.display = v ? 'flex' : 'none'; }); }

  /** Screen-space objective markers: [{ x, y, label, color, sub, edge }]. */
  objMarkers(list) {
    const om = this.$.om;
    while (om.children.length < list.length) { const e = document.createElement('div'); e.className = 'om'; om.appendChild(e); }
    for (let i = 0; i < om.children.length; i++) {
      const e = om.children[i], m = list[i];
      if (!m) { e.style.display = 'none'; continue; }
      e.style.display = '';
      e.style.transform = `translate(${Math.round(m.x)}px, ${Math.round(m.y)}px)`;
      const html = `<div class="om-ic" style="border-color:${m.color};color:${m.color}${m.pulse ? ';animation:blink 0.6s infinite' : ''}">${m.label}</div><div class="om-sub">${m.sub || ''}</div>`;
      if (e._h !== html) { e.innerHTML = html; e._h = html; }
    }
  }

  setTeams(playerTeam) {
    const [f, e] = this.app.settings.teamColors();
    this.playerTeam = playerTeam;
    this.$.t0.querySelector('.n').textContent = TEAMS[playerTeam].name;
    this.$.t1.querySelector('.n').textContent = TEAMS[1 - playerTeam].name;
    this.$.t0.style.color = f; this.$.t1.style.color = e;
  }

  /** Per-frame update. s = snapshot from Game. */
  update(dt, s) {
    const $ = this.$;
    // health
    const hp = Math.max(0, Math.ceil(s.health));
    this.set('hp', hp, (v) => { $.hpv.textContent = v; $.hpfill.style.width = v + '%'; $.hp.classList.toggle('low', v < 35); });
    const vig = s.alive ? Math.max(0, (60 - s.health) / 60) : 0;
    this.set('vig', Math.round(vig * 20), () => { $.vignette.style.opacity = (vig * 0.9).toFixed(2); });
    // weapon
    this.set('wname', s.weaponName, (v) => { $.wname.textContent = v; });
    this.set('mag', s.mag, (v) => { $.mag.textContent = v; });
    this.set('magLow', s.mag <= s.magSize * 0.25, (v) => $.mag.classList.toggle('low', v));
    this.set('res', s.reserve, (v) => { $.res.textContent = v === '' ? '' : '/ ' + v; });
    this.set('lc', s.lethal, (v) => { $.lc.textContent = '×' + v; $.lethal.classList.toggle('empty', v === 0); });
    this.set('tc', s.tactical, (v) => { $.tc.textContent = '×' + v; $.tactical.classList.toggle('empty', v === 0); });
    this.set('lk', s.keys.lethal, (v) => { $.lk.innerHTML = `<span class="key">${esc(v)}</span>`; });
    this.set('tk', s.keys.tactical, (v) => { $.tk.innerHTML = `<span class="key">${esc(v)}</span>`; });
    // scores / clock
    this.set('s0', s.scores[0], (v) => { $.t0.querySelector('.s').textContent = v; });
    this.set('s1', s.scores[1], (v) => { $.t1.querySelector('.s').textContent = v; });
    const t = Math.max(0, Math.ceil(s.timeLeft));
    this.set('time', t, (v) => { $.time.textContent = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; $.time.style.color = v <= 30 ? 'var(--bad)' : ''; });
    this.set('lim', s.limitText || `FIRST TO ${s.scoreLimit}`, (v) => { $.lim.textContent = v; });
    // crosshair
    const hideXh = !s.alive || s.sprinting || s.adsT > 0.6 || s.busy || s.scoped;
    this.set('xhHide', hideXh, (v) => { $.xh.style.opacity = v ? '0' : '1'; });
    const gapPx = Math.max(3, Math.tan(s.spreadDeg * Math.PI / 180) / Math.tan(s.vfov / 2) * (window.innerHeight / 2));
    const g = Math.round(gapPx);
    this.set('gap', g, (v) => {
      $.xh.style.setProperty('--gap', v + 'px');
      const L = $.xh.children;
      L[0].style.top = `${-v - 8 * this.app.settings.data.interface.crosshairSize}px`;
      L[1].style.top = `${v}px`;
      L[2].style.left = `${-v - 8 * this.app.settings.data.interface.crosshairSize}px`;
      L[3].style.left = `${v}px`;
    });
    // scope
    this.set('scope', !!s.scoped, (v) => $.scope.classList.toggle('on', v));
    // hitmarker fade
    if (this.hitT > 0) { this.hitT -= dt; $.hitm.style.opacity = Math.max(0, this.hitT / 0.25).toFixed(2); }
    // damage indicators
    for (let i = this.indicators.length - 1; i >= 0; i--) {
      const d = this.indicators[i];
      d.t -= dt;
      if (d.t <= 0) { d.el.remove(); this.indicators.splice(i, 1); continue; }
      const ang = Math.atan2(d.x - s.x, d.z - s.z);
      // relative to view: forward is -Z at yaw
      const rel = -(ang - (s.yaw + Math.PI));
      d.el.style.transform = `rotate(${rel}rad)`;
      d.el.style.opacity = Math.min(1, d.t / 0.6).toFixed(2);
    }
    // grenade warnings
    this.updateNadeIndicators(s);
    // prompts
    let prompt = '', warn = false;
    if (s.alive) {
      if (s.mag === 0 && s.reserve === 0) { prompt = 'NO AMMO — SWITCH WEAPON'; warn = true; }
      else if (s.reloading) prompt = 'RELOADING';
      else if (s.mag <= s.magSize * 0.25 && s.reserve > 0) { prompt = `<span class="key">${esc(s.keys.reload)}</span> RELOAD`; warn = s.mag === 0; }
    }
    this.set('prompt', prompt + warn, () => { $.prompt.innerHTML = prompt; $.prompt.classList.toggle('warn', warn); });
    this.set('protect', s.alive && s.protect > 0, (v) => { $.protect.textContent = v ? 'SPAWN PROTECTION' : ''; });
    // center message timer
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) $.center.innerHTML = ''; }
    // fps
    if (this.app.settings.data.graphics.showFps) {
      const e = this.app.engine, info = e.info();
      this.set('fps', `${Math.round(e.fps)} FPS · ${e.frameMs.toFixed(1)} ms · ${Math.round((e.effectiveScale || 1) * 100)}% res · ${info.calls} draws`, (v) => { $.fps.textContent = v; });
    } else this.set('fps', '', () => { $.fps.textContent = ''; });
  }

  hitmarker(kill, head) {
    if (!this.app.settings.data.interface.hitmarkers) return;
    const h = this.$.hitm;
    h.classList.toggle('kill', kill);
    h.classList.toggle('head', head);
    h.style.opacity = '1';
    this.hitT = kill ? 0.4 : 0.25;
  }

  damageFrom(x, z) {
    const e = el('div', { class: 'ind' });
    this.$.ring.appendChild(e);
    this.indicators.push({ el: e, x, z, t: 1.4 });
    if (this.indicators.length > 6) { const d = this.indicators.shift(); d.el.remove(); }
  }

  updateNadeIndicators(s) {
    const list = s.nades || [];
    while (this.nadeInds.length < list.length) { const e = el('div', { class: 'nade' }, '⬤'); e.title = 'grenade'; this.$.ring.appendChild(e); this.nadeInds.push(e); }
    while (this.nadeInds.length > list.length) this.nadeInds.pop().remove();
    list.forEach((n, i) => {
      const ang = Math.atan2(n.x - s.x, n.z - s.z);
      const rel = -(ang - (s.yaw + Math.PI));
      this.nadeInds[i].style.transform = `rotate(${rel}rad)`;
      this.nadeInds[i].innerHTML = `<span style="transform:rotate(${-rel}rad);display:inline-block">💣</span>`;
    });
  }

  killfeed(k, playerId) {
    if (!this.app.settings.data.interface.killfeed) return;
    const [f, e] = this.app.settings.teamColors();
    const col = (c) => (c.team === this.playerTeam ? f : e);
    const nm = (c) => `${c.isBot ? '' : '★ '}${esc(c.name)}`;
    const row = el('div', { class: 'kf' });
    if (k.system) {
      row.innerHTML = `<span class="w">${esc(k.text)}</span>`;
      this.$.kf.prepend(row);
      while (this.$.kf.children.length > 6) this.$.kf.lastChild.remove();
      setTimeout(() => row.remove(), 5000);
      return;
    }
    const w = k.weapon === 'frag' ? 'FRAG' : k.weapon === 'strike' ? 'AREA STRIKE' : k.weapon === 'melee' ? 'MELEE' : k.weapon === 'fall' ? 'FELL' : (k.weaponName || '');
    if (k.killer && k.killer !== k.victim) {
      row.innerHTML = `<span style="color:${col(k.killer)}">${nm(k.killer)}</span><span class="w">${esc(w)}</span>${k.headshot ? '<span class="hs">HEADSHOT</span>' : ''}<span style="color:${col(k.victim)}">${nm(k.victim)}</span>`;
    } else {
      row.innerHTML = `<span style="color:${col(k.victim)}">${nm(k.victim)}</span><span class="w">${esc(w || 'ELIMINATED')}</span>`;
    }
    if (k.killer?.id === playerId || k.victim.id === playerId) row.style.background = 'rgba(255,138,61,0.25)';
    this.$.kf.prepend(row);
    while (this.$.kf.children.length > 6) this.$.kf.lastChild.remove();
    setTimeout(() => row.remove(), 7000);
  }

  popup(text, xp, cls = '') {
    const p = el('div', { class: 'popup ' + cls });
    p.innerHTML = `${esc(text)}${xp ? `<span class="xp">+${xp}</span>` : ''}`;
    this.$.popups.appendChild(p);
    while (this.$.popups.children.length > 5) this.$.popups.firstChild.remove();
    setTimeout(() => p.remove(), 1850);
  }

  center(big, sub = '', dur = 2.5, color = '') {
    this.$.center.innerHTML = `<div class="big" style="color:${color}">${esc(big)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}`;
    this.centerT = dur;
  }

  death(info) {
    if (!info) { this.$.death.innerHTML = ''; return; }
    this.$.death.innerHTML = `<div class="by">${esc(info.by)}</div><div class="who" style="color:${info.color}">${esc(info.who)}</div><div class="how">${esc(info.how)}</div><div class="rs">${info.respawn}</div>`;
  }

  caption(text, who = '') {
    const c = el('div', { class: 'caption' });
    c.innerHTML = `${who ? `<span class="who">${esc(who)}</span>` : ''}${esc(text)}`;
    this.$.captions.appendChild(c);
    while (this.$.captions.children.length > 3) this.$.captions.firstChild.remove();
    setTimeout(() => c.remove(), 3500);
  }

  /** Flash-grenade blindness (k = 0..1). Reduced-flash accessibility setting caps it. */
  blind(k) {
    const reduced = this.app.settings.data.accessibility.reducedFlash;
    this.set('blind', Math.round(k * 50), () => {
      this.$.blind.style.opacity = (Math.min(1, k * 1.3) * (reduced ? 0.55 : 1)).toFixed(2);
      this.$.blind.classList.toggle('reduced', !!reduced);
    });
  }

  /** Support ability strip: [{ id, name, key, have, need, ready }]. */
  support(list, hidden) {
    const html = hidden ? '' : list.map((a) => `<div class="sa ${a.ready ? 'ready' : ''}"><span class="key">${esc(a.key)}</span><span class="sn">${esc(a.name)}${a.ready > 1 ? ' ×' + a.ready : ''}</span><span class="pips">${a.ready ? 'READY' : Array.from({ length: a.need }, (_, i) => `<i class="${i < a.have ? 'on' : ''}"></i>`).join('')}</span></div>`).join('');
    this.set('support', html, (v) => { this.$.support.innerHTML = v; });
  }

  flash(amount) {
    const f = this.$.flash;
    const reduced = this.app.settings.data.accessibility.reducedFlash;
    f.style.transition = 'none';
    f.style.opacity = String(amount * (reduced ? 0.25 : 0.6));
    requestAnimationFrame(() => { f.style.transition = 'opacity 0.6s'; f.style.opacity = '0'; });
  }

  damageNumber(x, y, amount, head) {
    if (!this.app.settings.data.interface.damageNumbers) return;
    const d = el('div', { class: 'dmgnum' + (head ? ' head' : '') }, String(Math.round(amount)));
    d.style.left = x + 'px'; d.style.top = y + 'px';
    this.root.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }

  scoreboard(show, html) {
    this.set('sbOn', !!show, (v) => this.$.sb.classList.toggle('on', v));
    if (show && html !== undefined) this.set('sbHtml', html, (v) => { this.$.sb.innerHTML = v; });
  }

  nameplates(list) {
    const np = this.$.np;
    const key = list.map((n) => `${n.text}|${n.color}|${Math.round(n.x)}|${Math.round(n.y)}|${n.chev}`).join(';');
    if (this.cache.np === key) return;
    this.cache.np = key;
    while (np.children.length < list.length) np.appendChild(el('div', { class: 'np' }));
    for (let i = 0; i < np.children.length; i++) {
      const e = np.children[i];
      const n = list[i];
      if (!n) { e.style.display = 'none'; continue; }
      e.style.display = '';
      e.style.left = n.x + 'px'; e.style.top = n.y + 'px';
      e.style.color = n.color;
      e.style.opacity = n.alpha ?? 1;
      const html = `${esc(n.text)}${n.chev ? '<span class="chev"></span>' : ''}`;
      if (e._h !== html) { e.innerHTML = html; e._h = html; }
    }
  }

  /** Draw minimap. m: {img, scale (px per m), minX, minZ, pad}, s: player snapshot, dots: [{x,z,color,kind}] */
  minimap(m, s, dots) {
    const mode = this.app.settings.data.interface.minimap;
    if (mode === 'off' || !m) return;
    const ctx = this.miniCtx, W = 190, H = 190;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    const rotate = mode === 'rotate';
    if (rotate) ctx.rotate(s.yaw);
    const k = 2.4; // px per meter on minimap
    ctx.scale(k, k);
    ctx.translate(-s.x, -s.z);
    // map image is drawn in world units
    ctx.globalAlpha = 0.95;
    ctx.drawImage(m.img, m.minX - m.pad, m.minZ - m.pad, m.img.width / m.scale, m.img.height / m.scale);
    ctx.globalAlpha = 1;
    for (const d of dots) {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.z, (d.kind === 'enemy' ? 2.6 : 2.2) / k * 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (d.kind === 'ally' && d.yaw !== undefined) {
        ctx.strokeStyle = d.color; ctx.lineWidth = 1 / k;
        ctx.beginPath(); ctx.moveTo(d.x, d.z); ctx.lineTo(d.x - Math.sin(d.yaw) * 3, d.z - Math.cos(d.yaw) * 3); ctx.stroke();
      }
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (!rotate) ctx.rotate(-s.yaw);
    // view cone
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  rangeMode(on) {
    this.$.topc.style.display = on ? 'none' : '';
    this.$.rp.style.display = on ? 'block' : 'none';
  }

  rangePanel(html) { this.set('rp', html, (v) => { this.$.rp.innerHTML = v; }); }

  show(on) { this.root.style.display = on ? '' : 'none'; }
  destroy() { this.root.remove(); }
}
