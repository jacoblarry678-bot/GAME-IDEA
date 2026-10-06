/**
 * Menu screens: main, play setup, loadouts, settings, career, about,
 * pause and results. Screens are DOM pages over the live 3D background.
 */
import { XP_EVENT } from '../data/events.js';
import { WEATHER_OPTIONS, WEATHER_NAMES } from '../game/weather.js';
import { el, esc } from './dom.js';
import { SETTINGS_SCHEMA, ACTION_LABELS, DEFAULT_BINDINGS } from '../core/settings.js';
import { codeLabel } from '../core/input.js';
import { WEAPONS, EQUIPMENT, PRIMARY_IDS, SECONDARY_IDS, LETHAL_IDS, TACTICAL_IDS, weaponStats, damageAt } from '../data/weapons.js';
import { MODES, ROADMAP_MODES, DIFFICULTIES, TEAMS } from '../game/modes.js';
import { SCREENS2, profileCard, creditsChip } from './screens2.js';
import { COSMETICS, RARITY } from '../data/cosmetics.js';
import { itemThumb, cardArt } from './art.js';
import { xpToNext, MAX_LEVEL } from '../core/profile.js';
import { SEASON } from '../data/season.js';
import { ATTACHMENTS, ATTACH_SLOTS, SLOT_LABELS, MAX_ATTACHMENTS, attachmentsFor, applyAttachments } from '../data/attachments.js';
import { PERKS, PERK_SLOTS, perksForSlot } from '../data/perks.js';
import { SUPPORT, SUPPORT_IDS } from '../data/support.js';
import { MAPS, MAP_IDS } from '../world/maps/index.js';
import { NetClient } from '../net/netClient.js';

export const VERSION = 'Update 0.6.0';

export class Screens {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.stack = [];
    let lastHover = 0;
    this.root.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled && performance.now() - lastHover > 60) { lastHover = performance.now(); app.audio.ui('hover'); }
    });
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled) app.audio.ui(b.dataset.sound || 'click');
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.stack.length && !this.app.input.captureCb && this.app.state !== 'match-live') {
        e.preventDefault();
        this.back();
      }
    });
  }

  get top() { return this.stack[this.stack.length - 1]; }

  show(name, params = {}) {
    this.clear();
    this.push(name, params);
  }

  push(name, params = {}) {
    const fn = SCREENS[name];
    const node = el('div', { class: 'screen', 'data-screen': name });
    if (this.top) this.top.node.style.visibility = 'hidden'; // only the top screen is shown
    this.root.appendChild(node);
    const entry = { name, node, params, onBack: null, cleanup: null };
    this.stack.push(entry);
    fn(this.app, node, params, entry);
    this.app.nav?.reset();
    return entry;
  }

  pop() {
    const e = this.stack.pop();
    if (!e) return;
    e.cleanup?.();
    e.node.remove();
    if (this.top) this.top.node.style.visibility = '';
    this.app.nav?.reset();
  }

  back() {
    const e = this.top;
    if (!e) return;
    if (this.root.querySelector('.modal')) { this.root.querySelector('.modal').remove(); return; }
    this.app.audio.ui('back');
    if (e.onBack) e.onBack(); else this.pop();
  }

  clear() {
    while (this.stack.length) this.pop();
  }

  /** Re-render the top screen in place (e.g. after a child screen changed data). */
  refreshTop() {
    const e = this.top;
    if (!e) return;
    e.cleanup?.();
    e.node.innerHTML = '';
    e.node.className = 'screen';
    e.onBack = null; e.cleanup = null;
    SCREENS[e.name](this.app, e.node, e.params, e);
  }

  /** Blocking loading overlay (null hides it). */
  loading(text) {
    this._loading?.remove();
    this._loading = null;
    if (!text) return;
    this._loading = el('div', { class: 'loading-ov' });
    this._loading.innerHTML = `<div class="ld"><div class="spin"></div><div>${esc(text)}</div></div>`;
    this.root.appendChild(this._loading);
  }

  toast(text, ms = 2200) {
    const t = el('div', { class: 'toast' }, text);
    this.root.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  confirm(title, body, okLabel, onOk) {
    const m = el('div', { class: 'modal' });
    m.innerHTML = `<div class="panel col" style="gap:14px"><h2 class="title">${esc(title)}</h2><div class="muted">${esc(body)}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-k="no">Cancel</button><button class="btn primary" data-k="ok">${esc(okLabel)}</button></div></div>`;
    m.querySelector('[data-k=no]').onclick = () => m.remove();
    m.querySelector('[data-k=ok]').onclick = () => { m.remove(); onOk(); };
    this.root.appendChild(m);
    this.app.nav?.reset();
  }
}

// ---------------------------------------------------------------- helpers
function head(kicker, title, extra = '') {
  return `<div class="page-head"><div><div class="kicker">${esc(kicker)}</div><h1 class="title">${esc(title)}</h1></div><div class="spacer"></div>${extra}</div>`;
}

function stepper(value, fmt = (v) => v) {
  const w = el('div', { class: 'stepper' });
  w.innerHTML = `<button data-d="-1" aria-label="decrease">−</button><span class="val">${esc(fmt(value))}</span><button data-d="1" aria-label="increase">+</button>`;
  return w;
}

function bar(label, v, extra = '', base = null) {
  const w = Math.round(Math.max(0, Math.min(1, v)) * 100);
  let delta = '';
  if (base !== null) {
    const b = Math.round(Math.max(0, Math.min(1, base)) * 100);
    if (Math.abs(w - b) >= 1) delta = `<b class="${w > b ? 'up' : 'down'}" style="left:${Math.min(w, b)}%;width:${Math.abs(w - b)}%"></b>`;
    return `<span>${esc(label)}</span><div class="bar"><i style="width:${Math.min(w, b)}%"></i>${delta}</div><span>${extra}</span>`;
  }
  return `<span>${esc(label)}</span><div class="bar"><i style="width:${w}%"></i></div><span>${extra}</span>`;
}

function weaponStatsHtml(id, build = null) {
  const base = WEAPONS[id];
  const d = build ? applyAttachments(base, build) : base;
  const s = weaponStats(d);
  const sb = build ? weaponStats(base) : {};
  return `
    <div class="kicker">${esc(d.classLabel)}</div>
    <h2 class="title">${esc(d.name)}</h2>
    <div class="muted small" style="margin-bottom:10px">${esc(d.blurb)}</div>
    <div class="stats">
      ${bar('Damage', s.damage, d.damage.near + (d.pellets > 1 ? '×' + d.pellets : ''), build ? sb.damage : null)}
      ${bar('Range', s.range, Math.round(d.damage.end) + 'm', build ? sb.range : null)}
      ${bar('Fire Rate', s.fireRate, d.rpm, build ? sb.fireRate : null)}
      ${bar('Accuracy', s.accuracy, '', build ? sb.accuracy : null)}
      ${bar('Mobility', s.mobility, '', build ? sb.mobility : null)}
      ${bar('Handling', s.handling, Math.round(d.handling.adsTime * 1000) + 'ms', build ? sb.handling : null)}
    </div>
    <div class="row small muted" style="margin-top:10px;gap:16px;flex-wrap:wrap">
      <span>MAG <b style="color:var(--text)">${d.mag}</b></span>
      <span>RESERVE <b style="color:var(--text)">${d.reserve}</b></span>
      <span>RELOAD <b style="color:var(--text)">${d.tube ? d.tube.perShell.toFixed(2) + 's/shell' : d.reload.toFixed(2) + 's'}</b></span>${d.suppressed ? '<span class="pill">Suppressed</span>' : ''}
      <span>HEAD ×<b style="color:var(--text)">${d.mult.head}</b></span>
      <span>DMG @40m <b style="color:var(--text)">${Math.round(damageAt(d, 40) * (d.pellets || 1))}</b></span>
    </div>`;
}

// ---------------------------------------------------------------- screens
const SCREENS = {
  main(app, node, p, entry) {
    node.classList.add('shade');
    app.preview.hide();
    app.setMenuCamera('orbit');
    const prof = app.profile.data;
    node.innerHTML = `
      <div class="menu-left col">
        <div>
          <div class="kicker">${esc(VERSION)}</div>
          <h1 class="title" style="font-size:calc(22px * var(--text-scale));letter-spacing:0.5em;color:var(--muted);margin-top:18px">OPERATION</h1>
          <h1 class="title" style="font-size:calc(76px * var(--text-scale));letter-spacing:0.08em">ASH<span style="color:var(--accent)">LINE</span></h1>
          <nav class="menu-nav compact">
            <button class="menu-btn" data-go="play">Play<span class="sub">${esc(MODES[app.profile.data.matchSetup.mode]?.name || "Team Deathmatch")} vs bots · offline</span></button>
            <button class="menu-btn" data-go="online">Online<span class="sub">Self-hosted server · real players, bots fill empty slots</span></button>
            <button class="menu-btn" data-act="range">Firing Range<span class="sub">Test weapons on training targets</span></button>
            <button class="menu-btn" data-go="loadouts">Loadouts<span class="sub">Active: ${esc(app.profile.loadout.name)} — ${esc(WEAPONS[app.profile.loadout.primary].name)}</span></button>
            <button class="menu-btn" data-go="armory">Armory${app.profile.unseenCount() ? ` <span class="newdot">${app.profile.unseenCount()}</span>` : ''}<span class="sub">Operators, outfits, finishes, charms, cards</span></button>
            <button class="menu-btn" data-go="pass">Battle Pass<span class="sub">Season ${SEASON.number} · tier ${app.profile.passTier} / ${SEASON.tiers}${app.profile.data.pass.premium ? ' · Premium' : ''}</span></button>
            <button class="menu-btn" data-go="challenges">Challenges<span class="sub">${app.profile.challengeDefs().daily.filter((c) => c.done).length}/5 daily · ${app.profile.challengeDefs().weekly.filter((c) => c.done).length}/3 weekly</span></button>
            <button class="menu-btn" data-go="store">Store<span class="sub">New: Waspinator collab · test credits only</span></button>
            <button class="menu-btn" data-go="settings">Settings<span class="sub">Graphics, controls, audio, interface, accessibility</span></button>
            <button class="menu-btn" data-go="career">Career<span class="sub">${prof.career.matches} matches · ${prof.career.kills} eliminations</span></button>
            <button class="menu-btn" data-go="about">About &amp; Controls<span class="sub">What's in this build and what's next</span></button>
          </nav>
        </div>
        <div class="status-line">
          <div><span class="pill on">Offline vs bots</span> <span class="pill">Online: self-hosted server (npm run server)</span></div>
          <div style="margin-top:8px">Operator <b style="color:var(--text)">${esc(prof.name)}</b> · progress is saved in this browser only.</div>
          <div class="dim" id="device-hint" style="margin-top:4px"></div>
          ${matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches ? '<div style="margin-top:8px;color:var(--accent-2)">This game needs a keyboard and mouse or a game controller. Touch controls are not supported.</div>' : ''}
        </div>
      </div>`;
    node.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => app.screens.push(b.dataset.go); });
    node.querySelector('[data-act=range]').onclick = () => app.startRange();
    const side = document.createElement('div');
    side.className = 'menu-side';
    const renderSide = () => {
      side.innerHTML = `${profileCard(app)}<div class="row" style="justify-content:flex-end;margin-top:8px">${creditsChip(app)}</div>${xpEventCard(app)}`;
      const claim = side.querySelector('[data-a=claim-xp]');
      if (claim) claim.onclick = () => { const r = app.profile.claimXpGift(); app.audio.ui('click'); if (r.ok) app.screens.toast('Supercharged XP claimed: 1 hour of 2× XP, counting down only in matches.', 5000); renderSide(); };
    };
    renderSide();
    node.appendChild(side);
    for (const n of app.profile.data.notices.splice(0)) app.screens.toast(n, 5000);
    const hint = node.querySelector('#device-hint');
    hint.textContent = app.input.device === 'pad' ? 'Controller detected — D-pad to navigate, A to select, B to go back.' : 'Mouse & keyboard. Controllers are supported.';
    entry.onBack = () => {};
  },

  play(app, node, p, entry) {
    node.classList.add('shade-full');
    app.setMenuCamera('overview');
    const setup = app.profile.data.matchSetup;
    const render = () => {
      const lo = app.profile.loadout;
      node.innerHTML = `<div class="page">
        ${head('Private match · offline', 'Play')}
        <div class="page-body scroll" style="flex-direction:column">
          <div class="setup-grid">
            <div class="field" style="grid-column: span 2">
              <label>Mode</label>
              <div class="choice" data-k="mode">
                ${Object.values(MODES).filter((m) => m.playable).map((m) => `<button data-v="${m.id}" class="${setup.mode === m.id ? 'sel' : ''}">${esc(m.name)}</button>`).join('')}
                ${ROADMAP_MODES.map((m) => `<button disabled title="Planned for a later milestone">${esc(m.name)} · later</button>`).join('')}
              </div>
              <div class="muted small">${esc(MODES[setup.mode].blurb)}</div>
            </div>
            <div class="field" style="grid-row: span 2">
              <label>Map</label>
              <div class="map-pick">
                ${MAP_IDS.map((id) => `<button class="map-card ${setup.map === id ? 'sel' : ''}" data-map="${id}"><canvas width="220" height="150"></canvas><div class="title">${esc(MAPS[id].name)}</div></button>`).join('')}
              </div>
              <div class="muted small">${esc((MAPS[setup.map] || MAPS.cinder_yard).blurb)}</div>
            </div>
            ${MODES[setup.mode].teams ? `<div class="field"><label>Bots on your team (${TEAMS[0].name})</label><div data-k="botsAllies"></div></div>
            <div class="field"><label>Enemy bots (${TEAMS[1].name})</label><div data-k="botsEnemies"></div></div>` : '<div class="field" style="grid-column: span 2"><label>Opponents (bots, everyone for themselves)</label><div data-k="botsEnemies"></div></div>'}
            <div class="field"><label>Bot difficulty</label><div class="choice" data-k="difficulty">
              ${Object.values(DIFFICULTIES).map((d) => `<button data-v="${d.id}" class="${setup.difficulty === d.id ? 'sel' : ''}">${esc(d.name)}</button>`).join('')}
            </div></div>
            ${MODES[setup.mode].limits.scoreLimit ? `<div class="field"><label>${setup.mode === 'elim' ? 'Rounds to win' : 'Score limit'}</label><div data-k="scoreLimit"></div></div>` : ''}
            <div class="field"><label>${setup.mode === 'elim' ? 'Round time' : 'Time limit'}</label><div data-k="timeLimit"></div></div>
            ${MODES[setup.mode].teams ? `<div class="field"><label>Friendly fire</label><div class="choice" data-k="friendlyFire">
              <button data-v="false" class="${!setup.friendlyFire ? 'sel' : ''}">Off</button><button data-v="true" class="${setup.friendlyFire ? 'sel' : ''}">On</button>
            </div></div>` : ''}
            <div class="field" style="grid-column: span 2"><label>Weather</label><div class="choice" data-k="weather">
              ${WEATHER_OPTIONS.map((w) => `<button data-v="${w}" class="${(setup.weather || 'dynamic') === w ? 'sel' : ''}">${esc(WEATHER_NAMES[w])}</button>`).join('')}
            </div><div class="muted small">${setup.weather === 'dynamic' || !setup.weather ? 'Changes during the match: clear → clouds → rain → thunderstorm, or fog. Fog and rain shorten how far bots can see.' : 'Fixed for the whole match.'}</div></div>
            <div class="field" style="grid-column: span 2"><label>Loadout</label><div class="choice" data-k="loadout">
              ${app.profile.data.loadouts.map((l, i) => `<button data-v="${i}" class="${app.profile.data.activeLoadout === i ? 'sel' : ''}">${esc(l.name)} · ${esc(WEAPONS[l.primary].name)}</button>`).join('')}
            </div><div class="muted small">${esc(WEAPONS[lo.primary].name)} + ${esc(WEAPONS[lo.secondary].name)} · ${esc(EQUIPMENT[lo.lethal].name)} · ${esc(EQUIPMENT[lo.tactical].name)}</div></div>
          </div>
          <div class="muted small" style="margin-top:12px">All other players in this match are bots and are labelled <span class="bot-tag">BOT</span>. Pausing stops the match (offline).</div>
        </div>
        <div class="page-foot">
          <button class="btn" data-a="back">Back</button>
          <button class="btn" data-a="loadouts">Edit Loadouts</button>
          <div class="spacer"></div>
          <button class="btn primary" data-a="start" style="padding:12px 40px">Start Match</button>
        </div>
      </div>`;
      // map thumbnails
      node.querySelectorAll('.map-card[data-map]').forEach((card) => {
        const cv = card.querySelector('canvas');
        try { const img = app.mapThumb(card.dataset.map); const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, 220, 150); } catch (e) { /* thumbnail is cosmetic */ }
        card.onclick = () => { setup.map = card.dataset.map; app.profile.save(); render(); };
      });
      const st = (k, min, max, step, fmt) => {
        const box = node.querySelector(`[data-k=${k}]`);
        const s = stepper(setup[k], fmt);
        box.appendChild(s);
        s.querySelectorAll('button').forEach((b) => {
          b.onclick = () => {
            setup[k] = Math.max(min, Math.min(max, setup[k] + Number(b.dataset.d) * step));
            s.querySelector('.val').textContent = fmt ? fmt(setup[k]) : setup[k];
            app.profile.save();
          };
        });
      };
      const md = MODES[setup.mode];
      const unit = { kills: 'kills', points: 'points', rounds: 'rounds' }[md.scoreLabel] || '';
      if (md.teams) {
        setup.botsEnemies = Math.min(5, setup.botsEnemies);
        st('botsAllies', 0, 4, 1, (v) => `${v} bot${v === 1 ? '' : 's'} + you`);
        st('botsEnemies', 1, 5, 1, (v) => `${v} bot${v === 1 ? '' : 's'}`);
      } else st('botsEnemies', 1, 9, 1, (v) => `${v} bot${v === 1 ? '' : 's'}`);
      if (md.limits.scoreLimit) st('scoreLimit', ...md.limits.scoreLimit, (v) => `${v} ${unit}`);
      st('timeLimit', ...md.limits.timeLimit, (v) => `${v} min`);
      node.querySelectorAll('.choice[data-k]').forEach((c) => {
        c.querySelectorAll('button[data-v]').forEach((b) => {
          b.onclick = () => {
            const k = c.dataset.k, v = b.dataset.v;
            if (k === 'loadout') { app.profile.data.activeLoadout = Number(v); }
            else if (k === 'friendlyFire') setup.friendlyFire = v === 'true';
            else if (k === 'mode') { setup.mode = v; setup.scoreLimit = MODES[v].defaults.scoreLimit; setup.timeLimit = MODES[v].defaults.timeLimit; }
            else setup[k] = v;
            app.profile.save();
            render();
          };
        });
      });
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=loadouts]').onclick = () => app.screens.push('loadouts');
      node.querySelector('[data-a=start]').onclick = () => app.startMatch();
    };
    render();
    entry.onBack = () => app.screens.pop();
  },

  loadouts(app, node, p, entry) {
    node.classList.add('shade');
    app.setMenuCamera('closeup');
    const prof = app.profile;
    let sel = prof.data.activeLoadout;
    let previewId = null;
    const render = () => {
      const lo = prof.data.loadouts[sel];
      previewId = previewId || lo.primary;
      node.innerHTML = `<div class="page">
        ${head('Customize', 'Loadouts')}
        <div class="page-body">
          <div class="lo-list scroll">
            ${prof.data.loadouts.map((l, i) => `<button class="lo-item ${i === sel ? 'sel' : ''}" data-i="${i}"><div class="n">${esc(l.name)}${i === prof.data.activeLoadout ? ' <span class="pill on" style="font-size:9px">Active</span>' : ''}</div><div class="d">${esc(WEAPONS[l.primary].name)} · ${esc(WEAPONS[l.secondary].name)}</div></button>`).join('')}
          </div>
          <div class="lo-edit scroll">
            <div class="slot"><div class="lab">Preset name</div><input class="name-in" maxlength="16" value="${esc(lo.name)}" style="width:100%;background:var(--panel-2);border:1px solid var(--line-2);color:var(--text);padding:8px;font-family:var(--font-head);font-size:18px;letter-spacing:0.08em" /></div>
            <div class="slot"><div class="lab row">Primary<div class="spacer"></div><button class="btn sm" data-a="gs-primary">Gunsmith · ${buildCount(prof, lo.primary)}/${MAX_ATTACHMENTS}</button></div><div class="wpn-opts">
              ${PRIMARY_IDS.map((id) => wpnOpt(prof, lo, 'primary', id)).join('')}
            </div></div>
            <div class="slot"><div class="lab row">Secondary<div class="spacer"></div>${WEAPONS[lo.secondary].melee ? '' : `<button class="btn sm" data-a="gs-secondary">Gunsmith · ${buildCount(prof, lo.secondary)}/${MAX_ATTACHMENTS}</button>`}</div><div class="wpn-opts">
              ${SECONDARY_IDS.map((id) => wpnOpt(prof, lo, 'secondary', id)).join('')}
            </div></div>
            <div class="slot"><div class="lab">Lethal</div><div class="wpn-opts">
              ${LETHAL_IDS.map((id) => eqOpt(prof, lo, 'lethal', id)).join('')}
            </div></div>
            <div class="slot"><div class="lab">Tactical</div><div class="wpn-opts">
              ${TACTICAL_IDS.map((id) => eqOpt(prof, lo, 'tactical', id)).join('')}
            </div></div>
            ${PERK_SLOTS.map((ps, i) => `<div class="slot"><div class="lab">Perk ${ps}</div><div class="wpn-opts three">
              ${perksForSlot(ps).map((pk) => perkOpt(prof, lo, i, pk)).join('')}
            </div></div>`).join('')}
            <div class="row"><button class="btn" data-a="armory">Finishes &amp; charms for ${esc(WEAPONS[previewId || lo.primary].name)}</button></div>
          </div>
        </div>
        <div class="panel wpn-info">${weaponStatsHtml(previewId, prof.data.builds[previewId])}</div>
        <div class="page-foot">
          <button class="btn" data-a="back">Back</button>
          <div class="spacer"></div>
          <button class="btn" data-a="range">Test in Firing Range</button>
          <button class="btn primary" data-a="active" ${sel === prof.data.activeLoadout ? 'disabled' : ''}>Set as Active</button>
        </div>
      </div>`;
      app.preview.show(previewId, app.profile.data.equipped.weapons[previewId], prof.data.builds[previewId]);
      node.querySelectorAll('.lo-item').forEach((b) => { b.onclick = () => { sel = Number(b.dataset.i); previewId = null; render(); }; });
      node.querySelectorAll('.wpn-opt').forEach((b) => {
        b.onclick = () => {
          if (b.classList.contains('locked')) { app.screens.toast(b.dataset.lock); return; }
          if (b.dataset.slot === 'perk') { lo.perks[Number(b.dataset.i)] = b.dataset.id; prof.save(); render(); return; }
          lo[b.dataset.slot] = b.dataset.id;
          prof.save();
          if (WEAPONS[b.dataset.id]) previewId = b.dataset.id;
          render();
        };
        b.onmouseenter = () => { if (WEAPONS[b.dataset.id]) { node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(b.dataset.id, prof.data.builds[b.dataset.id]); app.preview.show(b.dataset.id, app.profile.data.equipped.weapons[b.dataset.id], prof.data.builds[b.dataset.id]); } };
        b.onmouseleave = () => { node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(previewId, prof.data.builds[previewId]); app.preview.show(previewId, app.profile.data.equipped.weapons[previewId], prof.data.builds[previewId]); };
      });
      const nameIn = node.querySelector('.name-in');
      nameIn.onchange = () => { lo.name = (nameIn.value || 'LOADOUT').toUpperCase().slice(0, 16); prof.save(); render(); };
      nameIn.onkeydown = (e) => e.stopPropagation();
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=range]').onclick = () => { prof.data.activeLoadout = sel; prof.save(); app.startRange(); };
      node.querySelector('[data-a=armory]').onclick = () => app.screens.push('armory', { tab: 'finish', weapon: previewId || lo.primary });
      for (const sl of ['primary', 'secondary']) {
        const gb = node.querySelector(`[data-a=gs-${sl}]`);
        if (gb) gb.onclick = () => app.screens.push('gunsmith', { weapon: lo[sl] });
      }
      node.querySelector('[data-a=active]').onclick = () => { prof.data.activeLoadout = sel; prof.save(); app.screens.toast(`${lo.name} is now your active loadout`); render(); };
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); app.screens.refreshTop(); };
    entry.refresh = render;
  },

  /** Online: connect to a self-hosted Ashline server. */
  online(app, node) {
    node.classList.add('shade-full');
    let saved = '';
    try { saved = localStorage.getItem('ashline.server') || ''; } catch { /* storage unavailable */ }
    const hosted = typeof location !== 'undefined' && (location.protocol === 'file:' || /claude\.ai$|claudeusercontent\.com$/.test(location.hostname));
    node.innerHTML = `<div class="page">
      ${head('Self-hosted server', 'Online')}
      <div class="page-body scroll" style="gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div class="panel" style="flex:1;min-width:320px;max-width:560px">
          <div class="slot"><div class="lab">Server address</div><input class="srv-in" value="${esc(saved || NetClient.defaultUrl())}" spellcheck="false" style="width:100%;background:var(--panel-2);border:1px solid var(--line-2);color:var(--text);padding:8px;font-size:16px;font-family:monospace" /></div>
          <div class="slot"><div class="lab">Your name</div><div>${esc(app.profile.data.name)} <span class="muted small">(change it in Career)</span></div></div>
          <div class="slot"><div class="lab">Loadout</div><div>${esc(app.profile.loadout.name)} — ${esc(WEAPONS[app.profile.loadout.primary].name)} + ${esc(WEAPONS[app.profile.loadout.secondary].name)}</div></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" data-a="connect" style="padding:10px 34px">Connect</button><span class="status muted small"></span></div>
          ${hosted ? '<div class="small" style="margin-top:10px;color:var(--accent-2)">This copy of the game is a hosted static page. Browsers usually block it from reaching a server on your computer or network, so connecting from here is likely to fail. Open the address that the server prints instead (for example http://localhost:4190/).</div>' : ''}
        </div>
        <div class="panel" style="flex:1;min-width:300px;max-width:520px">
          <h3 class="title">How online play works</h3>
          <ul class="small" style="line-height:1.7;margin:0;padding-left:18px">
            <li>One person runs the server on a PC: <span class="key">npm run build</span> then <span class="key">npm run server</span> (Node 18+). It prints the address to open.</li>
            <li>Everyone opens that address in a browser, picks <b>Online</b> and connects. Ports must be reachable (same network, or a forwarded port).</li>
            <li>The server runs the match: movement, hits (with lag compensation), damage, scores and objectives. Your game only sends inputs.</li>
            <li>Empty slots are filled by bots, always tagged <span class="bot-tag">BOT</span>. Players have no tag.</li>
            <li>Maps and modes rotate on the server. Progression and unlocks stay on each device; the server checks that loadouts are valid but can't verify unlocks.</li>
          </ul>
          <h3 class="title" style="margin-top:12px">Not provided</h3>
          <ul class="small muted" style="line-height:1.7;margin:0;padding-left:18px">
            <li>No public servers, matchmaking, accounts, friends lists or voice/text chat.</li>
            <li>No anti-cheat beyond server authority (aim is still client-side).</li>
          </ul>
        </div>
      </div>
      <div class="page-foot"><button class="btn" data-a="back">Back</button></div></div>`;
    const input = node.querySelector('.srv-in');
    const status = node.querySelector('.status');
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') connect(); };
    const btn = node.querySelector('[data-a=connect]');
    const connect = async () => {
      let url;
      try { url = NetClient.normalize(input.value); } catch { status.textContent = 'That address is not valid.'; return; }
      try { localStorage.setItem('ashline.server', input.value.trim()); } catch { /* ignore */ }
      btn.disabled = true;
      status.textContent = `Connecting to ${url}…`;
      try { await app.connectOnline(url); } catch (e) {
        btn.disabled = false;
        status.textContent = e.message;
        status.style.color = 'var(--bad)';
      }
    };
    btn.onclick = connect;
    node.querySelector('[data-a=back]').onclick = () => app.screens.back();
  },

  /** Gunsmith: attachments per weapon, earned by weapon level. */
  gunsmith(app, node, p, entry) {
    node.classList.add('shade');
    app.setMenuCamera('closeup');
    const prof = app.profile;
    const id = p.weapon;
    const def = WEAPONS[id];
    const avail = attachmentsFor(def);
    let slot = ATTACH_SLOTS.find((s) => avail.some((a) => a.slot === s));
    const render = () => {
      const build = prof.data.builds[id] || {};
      const lvl = prof.data.weaponProgress[id].level;
      const n = Object.keys(build).length;
      const opts = avail.filter((a) => a.slot === slot);
      node.innerHTML = `<div class="page">
        ${head('Gunsmith', def.name)}
        <div class="page-body">
          <div class="lo-list scroll">
            ${ATTACH_SLOTS.map((s) => {
              const has = avail.some((a) => a.slot === s);
              const cur = build[s] ? ATTACHMENTS[build[s]].name : has ? 'None' : 'Not available';
              return `<button class="lo-item gs-slot ${s === slot ? 'sel' : ''}" data-s="${s}" ${has ? '' : 'disabled style="opacity:.4"'}><div class="n">${esc(SLOT_LABELS[s])}</div><div class="d">${esc(cur)}</div></button>`;
            }).join('')}
            <div class="muted small" style="margin-top:6px">Weapon level <b>${lvl}</b> · ${n}/${MAX_ATTACHMENTS} attachments. Attachments unlock by using this weapon in matches — they can't be bought.</div>
          </div>
          <div class="lo-edit scroll">
            <div class="slot"><div class="lab">${esc(SLOT_LABELS[slot])}</div>
              <button class="att-opt ${!build[slot] ? 'sel' : ''}" data-id=""><div class="wn">None</div><div class="wc">Remove the ${esc(SLOT_LABELS[slot].toLowerCase())} attachment.</div></button>
              ${opts.map((a) => {
                const locked = lvl < a.level;
                return `<button class="att-opt ${build[slot] === a.id ? 'sel' : ''} ${locked ? 'locked' : ''}" data-id="${a.id}">
                  <div class="row"><div class="wn">${esc(a.name)}</div><div class="spacer"></div>${locked ? `<span class="pill">🔒 Weapon LV ${a.level}</span>` : build[slot] === a.id ? '<span class="pill on">Equipped</span>' : ''}</div>
                  <div class="pc">${a.pros.map((t) => `<span class="pro">+ ${esc(t)}</span>`).join('')}${a.cons.map((t) => `<span class="con">− ${esc(t)}</span>`).join('')}</div>
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>
        <div class="panel wpn-info">${weaponStatsHtml(id, build)}</div>
        <div class="page-foot">
          <button class="btn" data-a="back">Back</button>
          <div class="spacer"></div>
          <button class="btn danger" data-a="clear" ${n ? '' : 'disabled'}>Remove all</button>
          <button class="btn" data-a="range">Test in Firing Range</button>
        </div>
      </div>`;
      app.preview.show(id, prof.data.equipped.weapons[id], build);
      node.querySelectorAll('.gs-slot').forEach((b) => { b.onclick = () => { slot = b.dataset.s; render(); }; });
      node.querySelectorAll('.att-opt').forEach((b) => {
        b.onclick = () => {
          const r = prof.setAttachment(id, slot, b.dataset.id || null);
          if (!r.ok) { app.screens.toast(r.reason); return; }
          app.audio.ui('select');
          render();
        };
        b.onmouseenter = () => {
          if (b.classList.contains('locked')) return;
          const tb = { ...build };
          if (b.dataset.id) tb[slot] = b.dataset.id; else delete tb[slot];
          node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(id, tb);
          app.preview.show(id, prof.data.equipped.weapons[id], tb);
        };
        b.onmouseleave = () => { node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(id, build); app.preview.show(id, prof.data.equipped.weapons[id], build); };
      });
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=clear]').onclick = () => { for (const s of ATTACH_SLOTS) prof.setAttachment(id, s, null); render(); };
      node.querySelector('[data-a=range]').onclick = () => app.startRange();
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); const t = app.screens.top; if (t?.refresh) t.refresh(); else app.screens.refreshTop(); };
  },

  settings(app, node, p, entry) {
    node.classList.add('shade-full');
    let tab = p.tab || 'Graphics';
    const S = app.settings;
    const render = () => {
      const tabDef = SETTINGS_SCHEMA.find((t) => t.tab === tab);
      node.innerHTML = `<div class="page">
        ${head(p.inMatch ? 'Match paused' : 'Options', 'Settings')}
        <div class="tabs">${SETTINGS_SCHEMA.map((t) => `<button class="tab ${t.tab === tab ? 'sel' : ''}" data-t="${t.tab}">${t.tab}</button>`).join('')}</div>
        <div class="page-body scroll"><div class="set-list"></div></div>
        <div class="page-foot">
          <button class="btn" data-a="back">Back</button>
          <div class="spacer"></div>
          <span class="muted small">Changes save automatically.</span>
          <button class="btn danger" data-a="reset">Reset ${esc(tab)}</button>
          <button class="btn danger" data-a="resetall">Reset All</button>
        </div>
      </div>`;
      const list = node.querySelector('.set-list');
      for (const item of tabDef.items) list.appendChild(renderItem(app, item, render));
      node.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { tab = b.dataset.t; render(); }; });
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=reset]').onclick = () => app.screens.confirm(`Reset ${tab}?`, 'Restore the default values for this tab.', 'Reset', () => {
        const section = { Graphics: 'graphics', Controls: 'controls', Audio: 'audio', Interface: 'interface', Accessibility: 'accessibility' }[tab];
        S.resetSection(section); render();
      });
      node.querySelector('[data-a=resetall]').onclick = () => app.screens.confirm('Reset all settings?', 'Every option returns to its default value.', 'Reset All', () => { S.resetAll(); render(); });
    };
    render();
  },

  career(app, node) {
    node.classList.add('shade-full');
    const render = () => {
      const c = app.profile.data.career;
      const kd = c.deaths ? (c.kills / c.deaths).toFixed(2) : c.kills.toFixed(2);
      const acc = c.shots ? Math.round((c.hits / c.shots) * 100) + '%' : '—';
      const tiles = [['Matches', c.matches], ['Wins', c.wins], ['Losses', c.losses], ['Draws', c.draws], ['Eliminations', c.kills], ['Deaths', c.deaths], ['Assists', c.assists], ['K/D', kd], ['Headshots', c.headshots], ['Accuracy', acc], ['Best Streak', c.bestStreak], ['Score', c.score], ['Time Played', `${Math.floor(c.timePlayed / 60)}m`]];
      node.innerHTML = `<div class="page">${head('Local profile', 'Career')}
        <div class="page-body scroll" style="flex-direction:column">
          <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
          <div class="muted small" style="margin-top:14px">Career stats, levels, unlocks and purchases are stored locally in this browser (offline build — not a secure or synced save).</div>
          <div class="slot" style="max-width:420px;margin-top:10px"><div class="lab">Operator name</div><input class="name-in" maxlength="16" value="${esc(app.profile.data.name)}" style="width:100%;background:var(--panel-2);border:1px solid var(--line-2);color:var(--text);padding:8px;font-size:16px" /></div>
        </div>
        <div class="page-foot"><button class="btn" data-a="back">Back</button><div class="spacer"></div><button class="btn danger" data-a="reset">Reset Career Stats</button></div></div>`;
      const n = node.querySelector('.name-in');
      n.onkeydown = (e) => e.stopPropagation();
      n.onchange = () => { app.profile.data.name = n.value.trim().slice(0, 16) || 'Operator'; app.profile.save(); };
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=reset]').onclick = () => app.screens.confirm('Reset career stats?', 'This clears your local match history totals. Settings and loadouts are kept.', 'Reset', () => {
        for (const k of Object.keys(c)) c[k] = 0;
        app.profile.save(); render();
      });
    };
    render();
  },

  about(app, node) {
    node.classList.add('shade-full');
    const key = (a) => `<span class="key">${esc(app.input.label(a))}</span>`;
    node.innerHTML = `<div class="page">${head('Operation Ashline', 'About & Controls')}
      <div class="page-body scroll" style="gap:16px;flex-wrap:wrap">
        <div class="panel" style="flex:1;min-width:300px">
          <h3 class="title">Controls (current bindings)</h3>
          <div class="bind-grid" style="grid-template-columns:1fr auto">
            ${Object.keys(DEFAULT_BINDINGS).map((a) => `<div>${esc(ACTION_LABELS[a])}</div><div>${key(a)}</div>`).join('')}
            <div>Pause</div><div><span class="key">ESC</span></div>
          </div>
          <p class="muted small">Sprint + Crouch while moving to slide. Jump into a ledge or low wall to mantle/vault. Controller: standard layout (RT fire, LT aim, A jump, B crouch, X reload, Y swap, RB lethal, LB tactical, L3 sprint, R3 melee, D-pad ←/↑/→ support abilities).</p>
        </div>
        <div class="panel" style="flex:1;min-width:300px">
          <h3 class="title">In this build (update 0.6.0)</h3>
          <ul class="small" style="line-height:1.7;margin:0;padding-left:18px">
            <li>3 maps: Cinder Yard, Old Quarter, Signal Station · plus a Firing Range</li>
            <li>7 modes vs bots: Team Deathmatch, Free-for-All, Domination, Hardpoint, Elimination, Gun Game, Battle Royale (mini, up to 10 players) · private match settings</li>
            <li>Dynamic weather: clouds, rain, thunderstorms and fog that change during a match (or pick fixed weather)</li>
            <li>Supercharged XP event: a free one-hour 2× XP gift, counted only while you play</li>
            <li>16 weapons (4 AR, 3 SMG, 2 shotguns, sniper + DMR, 2 LMGs, 2 pistols, breaching axe)</li>
            <li>Gunsmith: 16 attachments in 6 slots, each with a drawback, unlocked by weapon level</li>
            <li>9 perks · frag, smoke, flash, Bulwark deployable cover</li>
            <li>Support abilities from kill streaks: Recon Scan (4), Supply Drop (6), Area Strike (8)</li>
            <li>Player and weapon levels, cosmetics, 50-tier battle pass, challenges, demo store (test credits only)</li>
            <li>Online play on a self-hosted server (npm run server): server-authoritative matches, lag-compensated hits, bots fill empty slots</li>
          </ul>
          <h3 class="title" style="margin-top:14px">Not in this build</h3>
          <ul class="small muted" style="line-height:1.7;margin:0;padding-left:18px">
            <li>Public servers, matchmaking, accounts, chat — online play needs a server you run yourself</li>
            <li>Co-op survival mode (planned)</li>
            <li>Real payments — none; store and pass use test credits stored on this device</li>
          </ul>
        </div>
        <div class="panel" style="flex:1;min-width:300px">
          <h3 class="title">Credits</h3>
          <p class="small muted" style="line-height:1.6">An original game. Rendering by three.js (MIT). All textures, models, sounds and music are generated procedurally in code at load time — no third-party art or audio assets. Inspired by the pacing of modern military shooters; no names, maps or assets from any existing franchise.</p>
          <p class="small dim">${esc(VERSION)}</p>
        </div>
      </div>
      <div class="page-foot"><button class="btn" data-a="back">Back</button></div></div>`;
    node.querySelector('[data-a=back]').onclick = () => app.screens.back();
  },

  pause(app, node, p, entry) {
    node.classList.add('shade-full');
    const g = app.game;
    node.innerHTML = `<div class="menu-left col" style="justify-content:center">
      <div class="kicker">${g.isRange ? 'Firing range' : g.online ? `Online · ${esc(app.online?.server?.name || 'server')} · the match keeps running` : 'Offline match paused'}</div>
      <h1 class="title">Paused</h1>
      <div class="muted" style="margin-top:6px">${g.isRange ? 'Training targets only. Nothing here counts toward career stats.' : `${esc(TEAMS[0].name)} ${g.match.teamScores[0]} — ${g.match.teamScores[1]} ${esc(TEAMS[1].name)}`}</div>
      <nav class="menu-nav">
        <button class="menu-btn" data-a="resume">Resume</button>
        <button class="menu-btn" data-a="settings">Settings</button>
        ${g.isRange ? '<button class="menu-btn" data-a="loadouts">Change Loadout</button>' : g.online ? '' : '<button class="menu-btn" data-a="restart">Restart Match</button>'}
        <button class="menu-btn" data-a="leave">${g.isRange ? 'Leave Range' : g.online ? 'Leave Server' : 'Leave Match'}</button>
      </nav>
    </div>`;
    node.querySelector('[data-a=resume]').onclick = () => app.resumeMatch();
    node.querySelector('[data-a=settings]').onclick = () => app.screens.push('settings', { inMatch: true });
    if (g.isRange) {
      node.querySelector('[data-a=loadouts]').onclick = () => { app.toMenu(); app.screens.push('loadouts'); };
      node.querySelector('[data-a=leave]').onclick = () => app.leaveMatch();
    } else {
      if (g.online) node.querySelector('[data-a=leave]').onclick = () => app.screens.confirm('Leave server?', 'You will disconnect and a bot takes your slot.', 'Leave', () => app.leaveMatch());
      else {
        node.querySelector('[data-a=restart]').onclick = () => app.screens.confirm('Restart match?', 'Current progress in this match will be lost.', 'Restart', () => app.startMatch());
        node.querySelector('[data-a=leave]').onclick = () => app.screens.confirm('Leave match?', 'You will return to the main menu. This match will not count toward career stats.', 'Leave', () => app.leaveMatch());
      }
    }
    entry.onBack = () => app.resumeMatch();
  },

  results(app, node, p) {
    node.classList.add('shade-full');
    const r = p.result;
    const banner = r.outcome === 'win' ? (r.br ? 'LAST ONE STANDING' : 'VICTORY') : r.outcome === 'loss' ? (r.ffa ? `#${r.placing} PLACE` : 'DEFEAT') : 'DRAW';
    const cls = r.outcome;
    const reason = r.br ? (r.reason === 'last' ? 'Decided by elimination' : 'Time ran out · most eliminations among the survivors wins') : r.reason === 'score' ? (r.mode === 'gun' ? 'Ladder completed' : r.mode === 'elim' ? 'Round limit reached' : 'Score limit reached') : 'Time limit reached';
    const ffaTable = (rr) => `<div class="team-head"><span>STANDINGS</span><span class="small muted" style="font-family:var(--font-body);font-weight:400">You placed #${rr.placing} of ${rr.rows[0].length}</span></div>
      <table class="sb"><thead><tr><th>#</th><th>Player</th>${rr.mode === 'gun' ? '<th class="num">Level</th>' : ''}<th class="num">Score</th><th class="num">K</th><th class="num">D</th><th class="num">Acc</th></tr></thead><tbody>
      ${rr.rows[0].map((x, i) => `<tr class="${x.me ? 'me' : ''}"><td>${i + 1}</td><td>${x.bot ? '<span class="bot-tag">BOT</span>' : ''}${esc(x.name)}</td>${rr.mode === 'gun' ? `<td class="num">${Math.min(x.level + 1, rr.ladder)}/${rr.ladder}</td>` : ''}<td class="num">${x.score}</td><td class="num">${x.kills}</td><td class="num">${x.deaths}</td><td class="num">${x.acc}</td></tr>`).join('')}
      </tbody></table>`;
    const table = (rows, team) => `
      <div class="team-head" style="color:${team === 0 ? 'var(--friendly)' : 'var(--enemy)'}"><span>${esc(TEAMS[team].name)}</span><span class="small muted" style="font-family:var(--font-body);letter-spacing:0.05em;font-weight:400">${esc(TEAMS[team].full)}</span><span class="score">${r.scores[team]}</span></div>
      <table class="sb"><thead><tr><th>Player</th><th class="num">Score</th><th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">Acc</th></tr></thead><tbody>
      ${rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.bot ? '<span class="bot-tag">BOT</span>' : ''}${esc(x.name)}</td><td class="num">${x.score}</td><td class="num">${x.kills}</td><td class="num">${x.deaths}</td><td class="num">${x.assists}</td><td class="num">${x.acc}</td></tr>`).join('')}
      </tbody></table>`;
    const me = r.me;
    const tiles = [['Score', me.score], ['Eliminations', me.kills], ['Deaths', me.deaths], ['Assists', me.assists], ['K/D', me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2)], ['Accuracy', me.shots ? Math.round(me.hits / me.shots * 100) + '%' : '—'], ['Headshots', me.headshots], ['Best Streak', me.bestStreak]];
    node.innerHTML = `<div class="page">
      <div class="page-head"><div><div class="kicker">${esc(reason)} · ${esc(app.mapRuntime.def.name)} · ${esc(MODES[r.mode].name)}</div><div class="res-banner ${cls}">${banner}</div></div><div class="spacer"></div>
        <img class="res-card" src="${cardArt(app.profile.data.equipped.card, 384, 96)}" alt="">
        <div class="title" style="font-size:44px"><span style="color:var(--friendly)">${r.scores[0]}</span> <span class="dim">—</span> <span style="color:var(--enemy)">${r.scores[1]}</span></div></div>
      <div class="page-body scroll" style="gap:18px;flex-wrap:wrap">
        <div style="flex:1.4;min-width:340px" class="col">${r.ffa ? ffaTable(r) : `${table(r.rows[0], 0)}<div style="height:14px"></div>${table(r.rows[1], 1)}`}</div>
        <div style="flex:1;min-width:280px" class="col">
          <h3 class="title">Your performance</h3>
          <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
          <h3 class="title" style="margin-top:16px">Medals</h3>
          <div class="medal-list">${r.medals.length ? r.medals.map((m) => `<span class="medal">${esc(m.name)}<b>×${m.count}</b></span>`).join('') : '<span class="muted small">None this match</span>'}</div>
          ${rewardsHtml(app, r.rewards, r.recorded)}
        </div>
      </div>
      <div class="page-foot">
        <button class="btn" data-a="menu">Main Menu</button>
        <button class="btn" data-a="loadouts">Loadouts</button>
        <button class="btn" data-a="pass">Battle Pass</button>
        <div class="spacer"></div>
        ${r.online ? '<span class="muted small">Online · the next match starts automatically</span><button class="btn primary" data-a="menu2" style="padding:12px 30px">Leave Server</button>' : '<button class="btn primary" data-a="again" style="padding:12px 40px">Play Again</button>'}
      </div></div>`;
    node.querySelector('[data-a=menu]').onclick = () => app.toMenu();
    node.querySelector('[data-a=loadouts]').onclick = () => { app.toMenu(); app.screens.push('play'); app.screens.push('loadouts'); };
    if (r.online) node.querySelector('[data-a=menu2]').onclick = () => app.toMenu();
    else node.querySelector('[data-a=again]').onclick = () => app.startMatch();
    node.querySelector('[data-a=pass]').onclick = () => { app.toMenu(); app.screens.push('pass'); };
  },
};

Object.assign(SCREENS, SCREENS2);

function rewardsHtml(app, rw, recorded) {
  if (!recorded || !rw) return '<div class="muted small" style="margin-top:16px">Result already recorded.</div>';
  const d = app.profile.data;
  const need = xpToNext(d.level);
  const pct = d.level >= MAX_LEVEL ? 100 : Math.round((d.xp / need) * 100);
  const lvUp = rw.levelAfter > rw.levelBefore;
  return `<h3 class="title" style="margin-top:16px">Rewards</h3>
    <div class="xp-lines">${rw.xp.map(([k, v]) => `<div class="row small"><span class="muted">${esc(k)}</span><div class="spacer"></div><b>+${Number(v).toLocaleString('en-US')}</b></div>`).join('')}
      <div class="row"><b>Total XP</b><div class="spacer"></div><b style="color:var(--accent)">+${rw.total.toLocaleString('en-US')}</b></div></div>
    <div class="row small" style="margin-top:8px"><b>LEVEL ${d.level}</b>${lvUp ? `<span class="pill on">Level up! ${rw.levelBefore} → ${rw.levelAfter}</span>` : ''}<div class="spacer"></div><span class="muted">${d.level >= MAX_LEVEL ? 'Max' : `${d.xp.toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`}</span></div>
    <div class="xpbar"><i style="width:${pct}%"></i></div>
    <div class="row small" style="margin-top:8px"><span>Battle pass tier ${rw.pass.from} → <b>${rw.pass.to}</b></span>${rw.pass.to > rw.pass.from ? '<span class="pill on">Rewards ready to claim</span>' : ''}</div>
    ${rw.boost ? `<div class="row small xp-boost-line" style="margin-top:8px"><span class="pill xpb">SUPERCHARGED XP ×${rw.boost.mult}</span><span class="muted">${rw.boost.left > 0 ? `${fmtBoost(rw.boost.left)} of boost left` : 'Boost used up'}</span></div>` : ''}
    ${rw.weapons.length ? `<div class="small" style="margin-top:8px">${rw.weapons.map((w) => `<div class="row"><span class="muted">${esc(WEAPONS[w.id].name)}</span><div class="spacer"></div>+${w.xp} XP · LV ${w.to}${w.to > w.from ? ' <span class="pill on">Level up</span>' : ''}</div>${w.atts?.length ? `<div class="muted" style="margin:-2px 0 4px 10px">New attachments: ${w.atts.map((id) => esc(ATTACHMENTS[id].name)).join(', ')}</div>` : ''}`).join('')}</div>` : ''}
    ${rw.challenges.length ? `<div class="small" style="margin-top:8px">${rw.challenges.map((c) => `<div class="row"><span class="pill on">Challenge complete</span><span>${esc(c.text)}</span></div>`).join('')}</div>` : ''}
    ${rw.newWeapons?.length ? `<h3 class="title" style="margin-top:12px">New weapons</h3><div class="row" style="flex-wrap:wrap;gap:8px">${rw.newWeapons.map((id) => `<div class="pill on">${esc(WEAPONS[id].name)} · ${esc(WEAPONS[id].classLabel)}</div>`).join('')}</div>` : ''}
    ${rw.unlocks.length ? `<h3 class="title" style="margin-top:12px">Unlocked</h3><div class="row" style="flex-wrap:wrap;gap:8px">${rw.unlocks.map((i) => `<div class="row small" style="gap:6px;border:1px solid ${RARITY[i.rarity].color};padding:4px 8px">${itemThumb(i)}<span>${esc(i.name)}</span></div>`).join('')}</div>` : ''}
    <div class="muted small" style="margin-top:10px">Saved to your local profile.</div>`;
}

function fmtBoost(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

/** Main-menu card for the free Supercharged XP event gift. */
function xpEventCard(app) {
  const pr = app.profile, left = pr.xpBoostLeft;
  if (!pr.giftClaimed(XP_EVENT.id)) return `<div class="xp-event"><div class="xe-k">LIMITED EVENT · FREE GIFT</div><div class="xe-t">${esc(XP_EVENT.name)}</div><div class="xe-b">${esc(XP_EVENT.blurb)}</div><button class="btn primary" data-a="claim-xp">Claim 1 hour of 2× XP</button></div>`;
  if (left > 0) return `<div class="xp-event on"><div class="xe-k">ACTIVE</div><div class="xe-t">${esc(XP_EVENT.name)} ×${XP_EVENT.mult}</div><div class="xe-b"><b>${fmtBoost(left)}</b> left · counts down only in matches</div></div>`;
  return `<div class="xp-event done"><div class="xe-k">EVENT</div><div class="xe-t">${esc(XP_EVENT.name)}</div><div class="xe-b">Your hour has been used. Thanks for playing!</div></div>`;
}

// ---------------------------------------------------------------- settings rows
function renderItem(app, item, rerender) {
  const S = app.settings;
  if (item.type === 'header') return el('div', { class: 'set-header' }, item.label);
  if (item.type === 'bindings') return renderBindings(app, rerender);
  const row = el('div', { class: 'set-row' });
  const lab = el('div', { class: 'lab' });
  lab.innerHTML = `${esc(item.label)}${item.restart ? '<span class="restart">· applies after reload</span>' : ''}${item.note ? `<span class="note">${esc(item.note)}</span>` : ''}`;
  row.appendChild(lab);
  const ctl = el('div', { class: 'set-ctl' });
  row.appendChild(ctl);
  const val = item.key.startsWith('_') ? null : S.get(item.key);
  if (item.type === 'slider') {
    const r = el('input', { type: 'range', min: item.min, max: item.max, step: item.step });
    r.value = val;
    const v = el('span', { class: 'v' }, item.fmt ? item.fmt(val) : String(val));
    r.oninput = () => { const n = Number(r.value); v.textContent = item.fmt ? item.fmt(n) : String(n); S.set(item.key, n); };
    r.onchange = () => { if (item.key === 'graphics.renderScale') rerender(); };
    ctl.append(r, v);
  } else if (item.type === 'select') {
    const s = el('select');
    for (const [v, l] of item.options) { const o = el('option', { value: String(v) }, l); if (String(v) === String(val)) o.selected = true; s.appendChild(o); }
    s.onchange = () => {
      const opt = item.options.find(([v]) => String(v) === s.value);
      S.set(item.key, opt ? opt[0] : s.value);
      if (item.key === 'graphics.preset' || item.key.startsWith('graphics.')) rerender();
      if (item.restart) app.screens.toast('Texture quality applies the next time the game loads.');
    };
    s.onkeydown = (e) => { if (e.code !== 'Escape') e.stopPropagation(); };
    ctl.appendChild(s);
  } else if (item.type === 'toggle') {
    const t = el('button', { class: 'toggle' + (val ? ' on' : ''), 'aria-pressed': String(!!val), 'aria-label': item.label });
    t.onclick = () => { const nv = !S.get(item.key); S.set(item.key, nv); t.classList.toggle('on', nv); t.setAttribute('aria-pressed', String(nv)); };
    ctl.appendChild(t);
  } else if (item.type === 'info') {
    ctl.innerHTML = `<span class="muted small" style="text-align:right">${esc(item.text)}</span>`;
    ctl.style.width = '360px';
  } else if (item.type === 'display') {
    const supported = document.fullscreenEnabled;
    const b = el('button', { class: 'btn' }, document.fullscreenElement ? 'Windowed' : 'Fullscreen');
    if (!supported) { b.disabled = true; b.textContent = 'Fullscreen unavailable'; lab.innerHTML += '<span class="note">This browser or embed does not allow fullscreen.</span>'; }
    b.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { app.screens.toast('Fullscreen was blocked by the browser.'); }
      setTimeout(rerender, 200);
    };
    ctl.appendChild(b);
  }
  return row;
}

function renderBindings(app, rerender) {
  const S = app.settings;
  const wrap = el('div', { class: 'col', style: 'gap:2px' });
  wrap.appendChild(el('div', { class: 'set-header' }, 'Key bindings — click a slot, then press a key, mouse button or scroll (Esc cancels)'));
  const grid = el('div', { class: 'bind-grid' });
  const binds = S.data.controls.bindings;
  for (const action of Object.keys(DEFAULT_BINDINGS)) {
    grid.appendChild(el('div', {}, ACTION_LABELS[action]));
    for (let slot = 0; slot < 2; slot++) {
      const cell = el('div', { style: 'padding:3px' });
      const b = el('button', { class: 'bind-btn' }, codeLabel(binds[action][slot]));
      b.onclick = () => {
        b.classList.add('wait'); b.textContent = 'PRESS…';
        app.input.capture((code) => {
          b.classList.remove('wait');
          if (code === null) { rerender(); return; }
          if (code === 'Escape') { rerender(); return; }
          // clear conflicts
          for (const [a, arr] of Object.entries(binds)) arr.forEach((c, i) => { if (c === code && !(a === action && i === slot)) arr[i] = ''; });
          binds[action][slot] = code;
          S.set('controls.bindings', binds);
          rerender();
        });
      };
      b.oncontextmenu = (e) => { e.preventDefault(); binds[action][slot] = ''; S.set('controls.bindings', binds); rerender(); };
      cell.appendChild(b);
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  const foot = el('div', { class: 'row', style: 'padding:8px 0' });
  const rb = el('button', { class: 'btn' }, 'Restore default bindings');
  rb.onclick = () => { S.set('controls.bindings', structuredClone(DEFAULT_BINDINGS)); rerender(); };
  foot.appendChild(rb);
  foot.appendChild(el('span', { class: 'muted small' }, 'Right-click a slot to clear it.'));
  wrap.appendChild(foot);
  return wrap;
}

function wpnOpt(prof, lo, slot, id) {
  const w = WEAPONS[id], open = prof.weaponUnlocked(id);
  const sub = open ? `${esc(w.classLabel)} · LV ${prof.data.weaponProgress[id].level}` : `🔒 Unlocks at level ${w.unlockLevel}`;
  return `<button class="wpn-opt ${lo[slot] === id ? 'sel' : ''} ${open ? '' : 'locked'}" data-slot="${slot}" data-id="${id}" data-lock="${esc(w.name)} unlocks at level ${w.unlockLevel}"><div class="wn">${esc(w.name)}</div><div class="wc">${sub}</div></button>`;
}

function buildCount(prof, id) { return Object.keys(prof.data.builds[id] || {}).length; }

function eqOpt(prof, lo, slot, id) {
  const e = EQUIPMENT[id], open = prof.equipmentUnlocked(id);
  return `<button class="wpn-opt ${lo[slot] === id ? 'sel' : ''} ${open ? '' : 'locked'}" data-slot="${slot}" data-id="${id}" data-lock="${esc(e.name)} unlocks at level ${e.unlockLevel}"><div class="wn">${esc(e.name)}</div><div class="wc">${open ? esc(e.blurb) : `🔒 Unlocks at level ${e.unlockLevel}`}</div></button>`;
}

function perkOpt(prof, lo, i, pk) {
  const open = prof.perkUnlocked(pk.id);
  return `<button class="wpn-opt ${lo.perks[i] === pk.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-slot="perk" data-i="${i}" data-id="${pk.id}" data-lock="${esc(pk.name)} unlocks at level ${pk.unlockLevel}"><div class="wn">${esc(pk.name)}</div><div class="wc">${open ? esc(pk.desc) : `🔒 Unlocks at level ${pk.unlockLevel}`}</div></button>`;
}
