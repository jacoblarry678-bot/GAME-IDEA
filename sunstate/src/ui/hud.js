/**
 * In-game HUD. DOM overlay plus a canvas minimap that rotates with the camera,
 * shows roads, the GPS route to the current objective (or waypoint), blips,
 * police, witness calls and the police search area.
 */
import { Input } from '../core/input.js';
import { staticMap, toMap, routeBetween, STATIC_BLIPS, ICONS, MAP } from './mapdraw.js';
import { roadAt, ISLAND, KEYS } from '../world/layout.js';
import { WANTED_CONFIG } from '../game/wanted.js';
import { PROTAGONISTS } from '../game/crew.js';
import { SHOPS } from '../game/places.js';
import { DISTRICT_NAME } from '../world/layout.js';

/** Set innerHTML only when it changed (avoids per-frame layout work). */
const setHTML = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export class HUD {
  constructor(app, root) {
    this.app = app;
    this.root = h('div');
    this.root.id = 'hud';
    root.appendChild(this.root);
    const r = this.root;
    // bottom-left: minimap, bars, street
    const bl = h('div', 'hud-corner hud-bl');
    this.mm = h('div', 'minimap');
    this.mmCanvas = document.createElement('canvas');
    this.mmCanvas.width = 440; this.mmCanvas.height = 440;
    this.mm.appendChild(this.mmCanvas);
    this.north = h('div', 'northmark', 'N');
    this.mm.appendChild(this.north);
    bl.appendChild(this.mm);
    this.crewEl = h('div', 'crew');
    bl.appendChild(this.crewEl);
    const bars = h('div', 'bars');
    this.hp = h('div', 'bar hp', '<i></i>');
    this.armor = h('div', 'bar armor none', '<i></i>');
    bars.append(this.hp, this.armor);
    bl.appendChild(bars);
    this.street = h('div', 'street');
    // LOOP: the social feed, on the phone
    this.loop = h('div', 'loopfeed');
    this.shop = h('div', 'shopmenu');
    this.loopBadge = h('div', 'loop-badge');
    bl.appendChild(this.street);
    r.appendChild(bl);
    // top-right: money, stars, wanted status, weapon, witness calls
    const tr = h('div', 'hud-corner hud-tr');
    this.moneyEl = h('div', 'money');
    this.moneyDelta = h('div', 'money-delta');
    this.stars = h('div', 'stars');
    this.wantedText = h('div', 'wanted-text');
    this.weaponEl = h('div', 'weapon');
    this.witnessEl = h('div', 'witness');
    tr.append(this.moneyEl, this.moneyDelta, this.stars, this.wantedText, this.weaponEl, this.witnessEl, this.loopBadge);
    r.appendChild(tr);
    // top-left: notification feed
    this.feed = h('div', 'hud-corner hud-tl feed');
    r.appendChild(this.feed);
    // bottom-right: speedometer + radio
    const br = h('div', 'hud-corner hud-br');
    this.speedo = h('div', 'speedo');
    this.radio = h('div', 'radio');
    br.append(this.speedo, this.radio);
    r.appendChild(br);
    // centre elements
    this.objective = h('div', 'objective');
    this.progress = h('div', 'progress', '<i></i>');
    this.prompt = h('div', 'prompt');
    this.subtitleEl = h('div', 'subtitle');
    this.crosshair = h('div', 'crosshair', '<span class="dot"></span>');
    this.hitmarker = h('div', 'hitmarker');
    this.bigEl = h('div', 'big');
    this.vignette = h('div', 'vignette');
    this.fps = h('div', 'fps');
    r.append(this.loop, this.shop);
    r.append(this.vignette, this.objective, this.progress, this.prompt, this.subtitleEl, this.crosshair, this.hitmarker, this.bigEl, this.fps);

    this.sub = null;
    this.bigT = 0;
    this.lastMoney = null;
    this.deltaT = 0;
    this.routeT = 0;
    this.route = null;
    this.radioT = 0;
    this.waypoint = null;
    this.objectiveText = '';
    this.mapImg = staticMap();
    this.mmCtx = this.mmCanvas.getContext('2d');
  }

  bind(game) {
    this.game = game;
    const ev = game.events;
    ev.on('objective', ({ text, hint }) => this.setObjective(text, hint));
    ev.on('missionPassed', ({ def, earned }) => { this.setObjective(''); this.big('MISSION PASSED', `${def.title}${earned ? ` · +$${earned.toLocaleString()}` : ''}`, 'pass', 5); });
    ev.on('missionFailed', ({ reason }) => { this.setObjective(''); this.failInfo = { reason, t: 12 }; });
    ev.on('missionStarted', (def) => { this.failInfo = null; this.big(def.title.toUpperCase(), 'Mission', 'pass', 2.5); });
    ev.on('phoneMessage', (m) => { this.notify(m.text, PROTAGONISTS[m.from]?.name || m.from, 'phone', 9); game.audio?.ui('message'); });
    ev.on('switched', ({ to, far }) => { if (far) this.app.menus.showCard(to.protagonistName, PROTAGONISTS[to.protagonist].full, 1.8); });
    ev.on('wantedNote', (text) => this.notify(text, 'Police', 'warn', 5));
    ev.on('witnessCall', () => this.notify('Someone is calling 911 about you. Stop them, or get out of sight.', 'Witness', 'warn', 5));
    ev.on('saved', ({ reason }) => this.notify(reason === 'mission' ? 'Progress saved.' : 'Game saved at the safehouse.', 'Autosave', '', 4));
    ev.on('damaged', ({ source, victim }) => { if (source === game.player && victim !== game.player) this.hit(); });
    ev.on('ambientEvent', () => {});
    game.audio && (game.audio.onStation = (name) => { this.radio.textContent = '📻 ' + name; this.radioT = 3; });
    this.failInfo = null;
  }

  setObjective(text, hint) {
    this.objectiveText = text;
    this.objective.innerHTML = text ? `${text}${hint ? `<span class="hint">${hint}</span>` : ''}` : '';
  }

  notify(text, from = '', kind = '', dur = 6) {
    const n = h('div', 'note ' + kind, `${from ? `<span class="from">${from}</span>` : ''}${text}`);
    this.feed.prepend(n);
    while (this.feed.children.length > 4) this.feed.lastChild.remove();
    setTimeout(() => n.classList.add('fade'), dur * 1000);
    setTimeout(() => n.remove(), dur * 1000 + 700);
  }

  subtitle(who, text, dur = 3, title = null) {
    if (!who && !text) { this.sub = null; this.subtitleEl.classList.remove('show'); return; }
    this.sub = { t: dur };
    const skip = this.game?.missions.cutscene ? `<span class="skip"><span class="key">${Input.label(this.app.settings.c.bindings.skip)}</span>skip</span>` : '';
    this.subtitleEl.innerHTML = `${title ? `<span class="title">${title}</span>` : ''}<span class="who">${who}:</span>${text}${skip}`;
    this.subtitleEl.classList.add('show');
  }

  big(title, sub = '', kind = '', dur = 4, actions = '') {
    this.bigEl.className = 'big show ' + kind;
    this.bigEl.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}${actions ? `<div class="actions">${actions}</div>` : ''}`;
    this.bigT = dur;
  }

  hit() {
    this.hitmarker.className = 'hitmarker show';
    clearTimeout(this._hm);
    this._hm = setTimeout(() => { this.hitmarker.className = 'hitmarker fade'; }, 60);
  }

  update(dt) {
    const g = this.game, app = this.app;
    if (!g) return;
    const s = app.settings;
    document.documentElement.style.setProperty('--hud-scale', s.i.hudScale);
    document.documentElement.style.setProperty('--sub-size', { small: '16px', medium: '20px', large: '26px' }[s.i.subtitleSize]);
    const p = g.player, pc = p.controller;
    // money
    const m = g.economy.money;
    if (this.lastMoney !== null && m !== this.lastMoney) {
      const d = m - this.lastMoney;
      this.moneyDelta.textContent = (d > 0 ? '+' : '−') + '$' + Math.abs(d).toLocaleString();
      this.moneyDelta.className = 'money-delta show ' + (d > 0 ? 'pos' : 'neg');
      this.deltaT = 3;
    }
    this.lastMoney = m;
    if (this.deltaT > 0) { this.deltaT -= dt; if (this.deltaT <= 0) this.moneyDelta.className = 'money-delta'; }
    setHTML(this.moneyEl, '$' + m.toLocaleString());
    // health / armor
    this.hp.firstChild.style.width = Math.max(0, p.health) + '%';
    this.hp.classList.toggle('low', p.health < 30);
    this.armor.firstChild.style.width = p.armor + '%';
    this.armor.classList.toggle('none', p.armor <= 0);
    this.vignette.classList.toggle('show', p.health < 30 && !p.dead);
    this.drawCrew();
    this.drawLoop();
    this.drawShop();
    // wanted
    const W = g.wanted;
    let stars = '';
    for (let i = 1; i <= WANTED_CONFIG.maxLevel; i++) stars += `<span class="${i <= W.level ? 'on' : ''}">★</span>`;
    if (this._stars !== stars) { this.stars.innerHTML = stars; this._stars = stars; }
    this.stars.className = 'stars' + (W.state === 'search' || W.state === 'reported' ? ' flash' : W.state === 'pursuit' ? ' pursuit' : '');
    let wt = '';
    if (W.level > 0) {
      if (W.state === 'pursuit') wt = 'PURSUIT — officers can see you';
      else if (W.state === 'search') wt = `SEARCHING — leave the area and stay hidden (${Math.max(0, Math.ceil(W.searchLeft))}s)`;
      else if (W.state === 'reported') wt = `REPORTED — units responding (${Math.max(0, Math.ceil(W.searchLeft))}s)`;
    }
    const arrest = g.police?.arrestProgress || 0;
    if (arrest > 0.05 && W.level > 0) wt = `ARRESTING — get away! ${Math.round(arrest * 100)}%`;
    if (this.wantedText.textContent !== wt) this.wantedText.textContent = wt;
    // witness calls
    if (W.calls.length) {
      const c = W.calls.reduce((a, b) => (b.t / b.duration > a.t / a.duration ? b : a));
      setHTML(this.witnessEl, `📞 ${W.calls.length > 1 ? W.calls.length + ' witnesses' : 'Witness'} calling 911<span class="meter"><i style="width:${Math.round((c.t / c.duration) * 100)}%"></i></span>`);
      this.witnessEl.classList.add('show');
    } else this.witnessEl.classList.remove('show');
    // weapon
    const w = pc.weapon, ammo = pc.ammo;
    setHTML(this.weaponEl, w.melee ? `<b>${w.icon}</b> ${w.name}` : `<b>${w.icon}</b> ${w.name} &nbsp;<b>${ammo.mag}</b> / ${ammo.reserve}${pc.reloadT > 0 ? ' <span class="reload">RELOADING</span>' : ''}`);
    // crosshair
    const showX = (!p.vehicle || p.seat > 0) && !p.dead && (pc.aiming || pc.hipT > 0) && !w.melee;
    this.crosshair.classList.toggle('show', showX);
    this.crosshair.classList.toggle('target', !!pc.aimTarget);
    // prompt
    const pr = pc.prompt;
    if (pr && !p.dead && !g.missions.cutscene) {
      const html = `<span class="key">${Input.label(s.c.bindings[pr.key])}</span>${pr.text}${pr.alt ? ` &nbsp;·&nbsp; <span class="key">${Input.label(s.c.bindings[pr.alt.key])}</span>${pr.alt.text}` : ''}`;
      if (this._prompt !== html) { this.prompt.innerHTML = html; this._prompt = html; }
      this.prompt.classList.add('show');
    } else this.prompt.classList.remove('show');
    // objective progress (hold-up), arrest
    const st = g.missions.stage;
    let prog = st?.progress ? st.progress(g) : null;
    if (prog === null && g.store.holdup) prog = g.store.holdup.progress;
    this.progress.classList.toggle('show', prog !== null && prog < 1);
    this.progress.classList.toggle('red', false);
    if (prog !== null) this.progress.firstChild.style.width = Math.round(prog * 100) + '%';
    // mission failed: offer retry
    if (this.failInfo) {
      this.failInfo.t -= dt;
      if (this.failInfo.t > 0 && !app.overlay) {
        const key = Input.label(s.c.bindings.skip);
        this.big('MISSION FAILED', this.failInfo.reason, 'fail', 0.2, `<span class="key">${key}</span>Retry from checkpoint &nbsp;·&nbsp; or keep playing`);
      } else if (this.failInfo.t <= 0) this.failInfo = null;
    }
    // subtitle timeout
    if (this.sub) { this.sub.t -= dt; if (this.sub.t <= 0 && !g.missions.cutscene) this.subtitle(null); }
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) this.bigEl.className = 'big'; }
    // vehicle HUD
    const v = p.vehicle;
    if (v) {
      const kmh = s.i.units === 'kmh';
      const spd = Math.round(v.speed * (kmh ? 3.6 : 2.237));
      setHTML(this.speedo, `${spd}<small>${kmh ? 'KM/H' : 'MPH'}</small><div class="car">${v.def.name} · ${v.gear < 0 ? 'R' : v.gear}<span class="dmg"><i style="width:${Math.round(v.health / 10)}%"></i></span></div>`);
      this.speedo.classList.add('show');
    } else this.speedo.classList.remove('show');
    if (this.radioT > 0) { this.radioT -= dt; this.radio.classList.add('show'); } else this.radio.classList.remove('show');
    // street name
    const pos = v ? v.pos : p.pos;
    const road = roadAt(pos.x, pos.z);
    const area = pos.z > KEYS.z0 - 8 ? KEYS.name : pos.z > ISLAND.south ? 'Vela Keys Twin Span' : pos.x > ISLAND.sandStart ? 'Ocean Mile Beach' : pos.x < ISLAND.west ? (pos.x < -290 ? 'Mainland Landing' : 'Vela Bay') : DISTRICT_NAME;
    const wl = g.weather?.label;
    setHTML(this.street, `${road ? road.name : area}<small>${road ? area : ''} · ${g.engine.time.label()}${wl ? ' · ' + wl : ''}</small>`);
    // fps
    this.fps.classList.toggle('show', s.g.showFps);
    if (s.g.showFps) {
      const i = g.engine.info();
      this.fps.textContent = `${g.engine.fps.toFixed(0)} fps · ${g.engine.frameMs.toFixed(1)} ms\n${i.calls} calls · ${(i.tris / 1000).toFixed(0)}k tris\n${g.vehicles.length} veh · ${g.peds.length + g.extras.length} peds · ${g.cops.length} cops`;
    }
    this.drawMinimap(dt);
  }

  /** Both protagonists: who you are, how the other one is doing and what they're up to. */
  drawCrew() {
    const g = this.game, crew = g.crew;
    let html = '';
    for (const ch of crew.list) {
      const def = PROTAGONISTS[ch.protagonist];
      const on = ch === g.player;
      let status = '';
      if (!on) {
        const ai = ch.partnerAI;
        status = ch.dead || crew.downT > 0 ? 'down' : ch.vehicle && ch.vehicle === g.player.vehicle ? (ch.seat === 0 ? (ai.hold ? 'parked' : 'driving') : 'riding') : ai.mode === 'follow' ? 'with you' : 'waiting';
      }
      html += `<span class="m${on ? ' on' : ''}${status === 'down' ? ' down' : ''}" style="--c:${def.color}"><b>${def.name.toUpperCase()}</b>${status ? `<em>${status}</em>` : ''}<i><u style="width:${Math.max(0, Math.round(ch.health))}%"></u></i></span>`;
    }
    html += `<span class="key">${Input.label(this.app.settings.c.bindings.switchCharacter)}</span>`;
    setHTML(this.crewEl, html);
  }

  /** An open shop: who's talking, what they said, and what's for sale. */
  drawShop() {
    const P = this.game.places, o = P?.openShop;
    this.shop.classList.toggle('show', !!o);
    if (!o) return;
    const def = SHOPS[o.id];
    const money = this.game.economy.money, ik = Input.label(this.app.settings.c.bindings.interact);
    const rows = P.items().map((it, i) => `<li class="${it.disabled || it.owned ? 'off' : it.price > money ? 'poor' : ''}"><span class="key">${i + 1}</span>${it.label}${it.owned ? ' <em>wearing</em>' : ''}<b>${it.price ? '$' + it.price.toLocaleString() : '—'}</b>${it.note ? `<small>${it.note}</small>` : ''}</li>`).join('');
    setHTML(this.shop, `<header>${def.title}</header><p class="greet"><b>${def.staff}:</b> “${o.greeting}”</p><ul>${rows}</ul>${o.msg ? `<p class="msg">${o.msg}</p>` : ''}<footer><span class="key">${ik}</span>leave · $${money.toLocaleString()}</footer>`);
  }

  /** The LOOP feed (open) or its unread badge (closed). */
  drawLoop() {
    const so = this.game.social, key = Input.label(this.app.settings.c.bindings.phone);
    this.loop.classList.toggle('show', so.open);
    setHTML(this.loopBadge, so.unread ? `<span class="key">${key}</span>LOOP <b>${so.unread}</b>` : `<span class="key">${key}</span>LOOP`);
    this.loopBadge.classList.toggle('hot', so.unread > 0);
    if (!so.open) return;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n));
    const one = (p, reply = false) => `<div class="post${p.about ? ' about' : ''}${reply ? ' reply' : ''}"><i style="background:${esc(p.color || '#ccc')}">${esc(p.handle[0].toUpperCase())}</i><div><b>${esc(p.name)}</b>${p.verified ? ' <u>✔</u>' : ''}${p.ai ? ' <s title="written by Claude">✨</s>' : ''} <small>@${esc(p.handle)} · ${so.age(p)}</small><p>${esc(p.text)}</p>${p.reel?.frames.length ? `<canvas class="reel" width="90" height="160" data-reel="${p.id}"></canvas>` : p.clip ? '<span class="clip">▶ clip</span>' : ''}<small>♥ ${fmt(p.likes)}${p.reel ? ` · ▶ ${fmt(p.reel.views)} views` : ''}</small></div></div>`;
    const items = so.posts.slice(0, 12).map((p) => one(p) + p.replies.slice(0, 3).map((r) => one(r, true)).join('')).join('');
    const aiKey = Input.label(this.app.settings.c.bindings.loopAI);
    const ai = so.ai.available ? `<div class="ai">${so.ai.busy ? '✨ Claude is writing…' : so.ai.status ? esc(so.ai.status) : ''} <span><span class="key">${aiKey}</span>ask Claude for fresh posts</span></div>` : '';
    setHTML(this.loop, `<header>LOOP<small>Costa Vela · trending <em>${esc(so.trending)}</em> · ${key} to close</small></header>${ai}${items}`);
    // play the reels
    const reels = new Map(); for (const p of so.posts) if (p.reel) reels.set(String(p.id), p.reel);
    const frame = Math.floor(performance.now() / 220);
    for (const c of this.loop.querySelectorAll('canvas[data-reel]')) {
      const r = reels.get(c.dataset.reel);
      if (r?.frames.length) c.getContext('2d').drawImage(r.frames[frame % r.frames.length], 0, 0);
    }
  }

  /** GPS target: mission objective first, then the map waypoint. */
  gpsTarget() {
    const t = this.game.missions.currentTarget();
    if (t) return t;
    return this.waypoint;
  }

  drawMinimap(dt) {
    const g = this.game, ctx = this.mmCtx, s = this.app.settings;
    const W = this.mmCanvas.width;
    const p = g.player;
    const pos = p.vehicle ? p.vehicle.pos : p.pos;
    const yaw = g.cameraRig.yaw;
    const speed = p.vehicle ? p.vehicle.speed : 0;
    const zoom = (W / 440) * (p.vehicle ? Math.max(0.55, 1 - speed * 0.012) : 1.05);
    const rot = s.i.minimapRotate ? -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw)) : 0;
    const [mx, my] = toMap(pos.x, pos.z);
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2 + W * 0.12);
    ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.translate(-mx, -my);
    ctx.drawImage(this.mapImg, 0, 0);
    const P = (x, z) => toMap(x, z);
    // police search area
    const Wn = g.wanted;
    if (Wn.level > 0 && Wn.lastKnown && Wn.state !== 'pursuit') {
      const [cx, cy] = P(Wn.lastKnown.x, Wn.lastKnown.z);
      ctx.beginPath(); ctx.arc(cx, cy, Wn.searchRadius * MAP.ppm, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,60,80,${0.14 + 0.06 * Math.sin(g.time * 4)})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,100,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    }
    // GPS route
    const tgt = this.gpsTarget();
    this.routeT -= dt;
    if (tgt && this.routeT <= 0) { this.routeT = 0.8; this.route = routeBetween(pos.x, pos.z, tgt.x, tgt.z); }
    if (!tgt) this.route = null;
    if (this.route) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [col, w] of [['rgba(0,0,0,0.5)', 9], [g.missions.active ? '#ffd23f' : '#d36bff', 5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w / zoom * (W / 440);
        ctx.beginPath();
        this.route.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
        ctx.stroke();
      }
    }
    ctx.restore();
    // blips drawn upright in screen space
    const toScreen = (x, z) => {
      const [ax, ay] = P(x, z);
      let dx = (ax - mx) * zoom, dy = (ay - my) * zoom;
      const c = Math.cos(rot), sn = Math.sin(rot);
      const rx = dx * c - dy * sn, ry = dx * sn + dy * c;
      return [W / 2 + rx, W / 2 + W * 0.12 + ry];
    };
    const clampEdge = ([x, y]) => {
      const m = 16, cx = W / 2, cy = W / 2;
      const dx = x - cx, dy = y - cy;
      const k = Math.max(Math.abs(dx) / (cx - m), Math.abs(dy) / (cy - m), 1);
      return [cx + dx / k, cy + dy / k, k > 1];
    };
    const blip = (x, z, color, glyph, size = 22, edge = true) => {
      let [sx, sy] = toScreen(x, z);
      let off = false;
      if (edge) [sx, sy, off] = clampEdge([sx, sy]);
      else if (sx < -20 || sy < -20 || sx > W + 20 || sy > W + 20) return;
      ctx.beginPath(); ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
      ctx.fillStyle = color; ctx.font = `800 ${size * 0.62}px Inter, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, sx, sy + 1);
      void off;
    };
    for (const b of STATIC_BLIPS) blip(b.x, b.z, b.color, ICONS[b.icon], 24, b.icon === 'safehouse');
    for (const def of g.missions.available) if (g.missions.canStart(def.id)) blip(def.start.x, def.start.z, '#29e6ff', 'S', 26, true);
    if (tgt) blip(tgt.x, tgt.z, g.missions.active ? '#ffd23f' : '#d36bff', g.missions.active ? '●' : '⚑', 24, true);
    // the partner, when they're not riding with you
    const o = g.partner;
    if (o && !o.dead && !(o.vehicle && o.vehicle === p.vehicle)) {
      const op = o.vehicle ? o.vehicle.pos : o.pos;
      blip(op.x, op.z, PROTAGONISTS[o.protagonist].color, o.protagonistName[0], 22, true);
    }
    // police and witnesses
    const flash = Math.floor(g.time * 4) % 2;
    for (const c of g.cops) {
      if (c.dead) continue;
      const cp = c.vehicle ? c.vehicle.pos : c.pos;
      if (c.vehicle && c.seat !== 0) continue;
      const [sx, sy] = toScreen(cp.x, cp.z);
      if (sx < 0 || sy < 0 || sx > W || sy > W) continue;
      ctx.fillStyle = Wn.level > 0 ? (flash ? '#ff3b4f' : '#3b6bff') : '#6ea0ff';
      ctx.beginPath(); ctx.arc(sx, sy, c.vehicle ? 8 : 6, 0, Math.PI * 2); ctx.fill();
    }
    for (const call of Wn.calls) {
      const [sx, sy] = toScreen(call.witness.pos.x, call.witness.pos.z);
      ctx.fillStyle = '#ffd23f'; ctx.font = '800 20px Inter, Arial'; ctx.textAlign = 'center';
      ctx.fillText('☎', sx, sy);
    }
    // player arrow (points along the character / vehicle heading)
    const heading = p.vehicle ? p.vehicle.yaw : p.yaw;
    const [px, py] = toScreen(pos.x, pos.z);
    const hx = Math.sin(heading), hz = Math.cos(heading);
    const [ex, ey] = toScreen(pos.x + hx * 10, pos.z + hz * 10);
    const ang = Math.atan2(ey - py, ex - px);
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke(); ctx.fill();
    ctx.restore();
    // north marker
    const [nx, ny] = clampEdge(toScreen(pos.x, pos.z - 5000));
    this.north.style.left = (nx / W) * 100 + '%';
    this.north.style.top = (ny / W) * 100 + '%';
  }

  setVisible(v) { this.root.classList.toggle('hidden', !v); }
}
