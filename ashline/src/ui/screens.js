/**
 * Menu screens: main, play setup, loadouts, settings, career, about,
 * pause and results. Screens are DOM pages over the live 3D background.
 */
import { el, esc } from './dom.js';
import { SETTINGS_SCHEMA, ACTION_LABELS, DEFAULT_BINDINGS } from '../core/settings.js';
import { codeLabel } from '../core/input.js';
import { WEAPONS, EQUIPMENT, PRIMARY_IDS, SECONDARY_IDS, LETHAL_IDS, TACTICAL_IDS, weaponStats, damageAt } from '../data/weapons.js';
import { MODES, ROADMAP_MODES, DIFFICULTIES, TEAMS } from '../game/modes.js';

export const VERSION = 'M1 · build 0.1.0';

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

function bar(label, v, extra = '') {
  return `<span>${esc(label)}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div><span>${extra}</span>`;
}

function weaponStatsHtml(id) {
  const d = WEAPONS[id];
  const s = weaponStats(d);
  return `
    <div class="kicker">${esc(d.classLabel)}</div>
    <h2 class="title">${esc(d.name)}</h2>
    <div class="muted small" style="margin-bottom:10px">${esc(d.blurb)}</div>
    <div class="stats">
      ${bar('Damage', s.damage, d.damage.near + (d.pellets > 1 ? '×' + d.pellets : ''))}
      ${bar('Range', s.range, d.damage.end + 'm')}
      ${bar('Fire Rate', s.fireRate, d.rpm)}
      ${bar('Accuracy', s.accuracy, '')}
      ${bar('Mobility', s.mobility, '')}
      ${bar('Handling', s.handling, Math.round(d.handling.adsTime * 1000) + 'ms')}
    </div>
    <div class="row small muted" style="margin-top:10px;gap:16px;flex-wrap:wrap">
      <span>MAG <b style="color:var(--text)">${d.mag}</b></span>
      <span>RESERVE <b style="color:var(--text)">${d.reserve}</b></span>
      <span>RELOAD <b style="color:var(--text)">${d.tube ? d.tube.perShell + 's/shell' : d.reload + 's'}</b></span>
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
          <nav class="menu-nav">
            <button class="menu-btn" data-go="play">Play<span class="sub">Team Deathmatch vs bots · offline</span></button>
            <button class="menu-btn" data-go="loadouts">Loadouts<span class="sub">Active: ${esc(app.profile.loadout.name)} — ${esc(WEAPONS[app.profile.loadout.primary].name)}</span></button>
            <button class="menu-btn" data-go="settings">Settings<span class="sub">Graphics, controls, audio, interface, accessibility</span></button>
            <button class="menu-btn" data-go="career">Career<span class="sub">${prof.career.matches} matches · ${prof.career.kills} eliminations</span></button>
            <button class="menu-btn" data-go="about">About &amp; Controls<span class="sub">What's in this build and what's next</span></button>
          </nav>
        </div>
        <div class="status-line">
          <div><span class="pill on">Offline</span> <span class="pill">Solo vs bots</span> <span class="pill off">Online play: not available in this build</span></div>
          <div style="margin-top:8px">Operator <b style="color:var(--text)">${esc(prof.name)}</b> · progress is saved in this browser only.</div>
          <div class="dim" id="device-hint" style="margin-top:4px"></div>
        </div>
      </div>`;
    node.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => app.screens.push(b.dataset.go); });
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
                ${Object.values(MODES).map((m) => `<button data-v="${m.id}" class="${setup.mode === m.id ? 'sel' : ''}">${esc(m.name)}</button>`).join('')}
                ${ROADMAP_MODES.map((m) => `<button disabled title="Planned for a later milestone">${esc(m.name)} · later</button>`).join('')}
              </div>
              <div class="muted small">${esc(MODES[setup.mode].blurb)}</div>
            </div>
            <div class="field map-card" style="grid-row: span 2">
              <canvas width="220" height="165"></canvas>
              <div class="kicker">Map</div>
              <div class="title">${esc(app.mapRuntime.def.name)}</div>
              <div class="muted small" style="position:relative">${esc(app.mapRuntime.def.blurb)}</div>
            </div>
            <div class="field"><label>Bots on your team (${TEAMS[0].name})</label><div data-k="botsAllies"></div></div>
            <div class="field"><label>Enemy bots (${TEAMS[1].name})</label><div data-k="botsEnemies"></div></div>
            <div class="field"><label>Bot difficulty</label><div class="choice" data-k="difficulty">
              ${Object.values(DIFFICULTIES).map((d) => `<button data-v="${d.id}" class="${setup.difficulty === d.id ? 'sel' : ''}">${esc(d.name)}</button>`).join('')}
            </div></div>
            <div class="field"><label>Score limit</label><div data-k="scoreLimit"></div></div>
            <div class="field"><label>Time limit</label><div data-k="timeLimit"></div></div>
            <div class="field"><label>Friendly fire</label><div class="choice" data-k="friendlyFire">
              <button data-v="false" class="${!setup.friendlyFire ? 'sel' : ''}">Off</button><button data-v="true" class="${setup.friendlyFire ? 'sel' : ''}">On</button>
            </div></div>
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
      // map thumb
      const cv = node.querySelector('.map-card canvas');
      if (cv && app.mapRuntime.minimap) { const ctx = cv.getContext('2d'); ctx.drawImage(app.mapRuntime.minimap.img, 0, 0, 220, 165); }
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
      st('botsAllies', 0, 4, 1, (v) => `${v} bot${v === 1 ? '' : 's'} + you`);
      st('botsEnemies', 1, 5, 1, (v) => `${v} bot${v === 1 ? '' : 's'}`);
      st('scoreLimit', 10, 200, 5, (v) => `${v} kills`);
      st('timeLimit', 3, 30, 1, (v) => `${v} min`);
      node.querySelectorAll('.choice[data-k]').forEach((c) => {
        c.querySelectorAll('button[data-v]').forEach((b) => {
          b.onclick = () => {
            const k = c.dataset.k, v = b.dataset.v;
            if (k === 'loadout') { app.profile.data.activeLoadout = Number(v); }
            else if (k === 'friendlyFire') setup.friendlyFire = v === 'true';
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
            <div class="slot"><div class="lab">Primary</div><div class="wpn-opts">
              ${PRIMARY_IDS.map((id) => `<button class="wpn-opt ${lo.primary === id ? 'sel' : ''}" data-slot="primary" data-id="${id}"><div class="wn">${esc(WEAPONS[id].name)}</div><div class="wc">${esc(WEAPONS[id].classLabel)}</div></button>`).join('')}
            </div></div>
            <div class="slot"><div class="lab">Secondary</div><div class="wpn-opts">
              ${SECONDARY_IDS.map((id) => `<button class="wpn-opt ${lo.secondary === id ? 'sel' : ''}" data-slot="secondary" data-id="${id}"><div class="wn">${esc(WEAPONS[id].name)}</div><div class="wc">${esc(WEAPONS[id].classLabel)}</div></button>`).join('')}
            </div></div>
            <div class="slot"><div class="lab">Lethal</div><div class="wpn-opts">
              ${LETHAL_IDS.map((id) => `<button class="wpn-opt ${lo.lethal === id ? 'sel' : ''}" data-slot="lethal" data-id="${id}"><div class="wn">${esc(EQUIPMENT[id].name)}</div><div class="wc">${esc(EQUIPMENT[id].blurb)}</div></button>`).join('')}
            </div></div>
            <div class="slot"><div class="lab">Tactical</div><div class="wpn-opts">
              ${TACTICAL_IDS.map((id) => `<button class="wpn-opt ${lo.tactical === id ? 'sel' : ''}" data-slot="tactical" data-id="${id}"><div class="wn">${esc(EQUIPMENT[id].name)}</div><div class="wc">${esc(EQUIPMENT[id].blurb)}</div></button>`).join('')}
            </div></div>
            <div class="muted small">More weapons, attachments, perks and a firing range are on the roadmap (Milestones 2–4).</div>
          </div>
        </div>
        <div class="panel wpn-info">${weaponStatsHtml(previewId)}</div>
        <div class="page-foot">
          <button class="btn" data-a="back">Back</button>
          <div class="spacer"></div>
          <button class="btn primary" data-a="active" ${sel === prof.data.activeLoadout ? 'disabled' : ''}>Set as Active</button>
        </div>
      </div>`;
      app.preview.show(previewId);
      node.querySelectorAll('.lo-item').forEach((b) => { b.onclick = () => { sel = Number(b.dataset.i); previewId = null; render(); }; });
      node.querySelectorAll('.wpn-opt').forEach((b) => {
        b.onclick = () => {
          lo[b.dataset.slot] = b.dataset.id;
          prof.save();
          if (WEAPONS[b.dataset.id]) previewId = b.dataset.id;
          render();
        };
        b.onmouseenter = () => { if (WEAPONS[b.dataset.id]) { node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(b.dataset.id); app.preview.show(b.dataset.id); } };
        b.onmouseleave = () => { node.querySelector('.wpn-info').innerHTML = weaponStatsHtml(previewId); app.preview.show(previewId); };
      });
      const nameIn = node.querySelector('.name-in');
      nameIn.onchange = () => { lo.name = (nameIn.value || 'LOADOUT').toUpperCase().slice(0, 16); prof.save(); render(); };
      nameIn.onkeydown = (e) => e.stopPropagation();
      node.querySelector('[data-a=back]').onclick = () => app.screens.back();
      node.querySelector('[data-a=active]').onclick = () => { prof.data.activeLoadout = sel; prof.save(); app.screens.toast(`${lo.name} is now your active loadout`); render(); };
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); app.screens.refreshTop(); };
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
          <div class="muted small" style="margin-top:14px">Career stats are stored locally in this browser. Persistent progression, weapon levels and unlocks arrive in Milestone 3.</div>
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
          <p class="muted small">Sprint + Crouch while moving to slide. Jump into a ledge or low wall to mantle/vault. Controller: standard layout (RT fire, LT aim, A jump, B crouch, X reload, Y swap, RB lethal, LB tactical, L3 sprint, R3 melee).</p>
        </div>
        <div class="panel" style="flex:1;min-width:300px">
          <h3 class="title">In this build (Milestone 1)</h3>
          <ul class="small" style="line-height:1.7;margin:0;padding-left:18px">
            <li>Cinder Yard — industrial rail depot map</li>
            <li>Team Deathmatch vs bots (up to 5v5), 4 difficulty levels</li>
            <li>5 weapons (AR, SMG, shotgun, sniper, pistol), knife melee, frag + smoke grenades</li>
            <li>Sprint, crouch, slide, jump, mantle/vault, ADS, health regen, spawn protection</li>
            <li>Loadout presets, settings with rebinding, controller support, local career stats</li>
          </ul>
          <h3 class="title" style="margin-top:14px">Not in this build</h3>
          <ul class="small muted" style="line-height:1.7;margin:0;padding-left:18px">
            <li>Online multiplayer — not available; every other player is a labelled bot</li>
            <li>Other modes, maps, attachments, perks, killstreak support abilities</li>
            <li>Progression, battle pass, cosmetics shop (planned with demo currency only)</li>
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
      <div class="kicker">Offline match paused</div>
      <h1 class="title">Paused</h1>
      <div class="muted" style="margin-top:6px">${esc(TEAMS[0].name)} ${g.match.teamScores[0]} — ${g.match.teamScores[1]} ${esc(TEAMS[1].name)}</div>
      <nav class="menu-nav">
        <button class="menu-btn" data-a="resume">Resume</button>
        <button class="menu-btn" data-a="settings">Settings</button>
        <button class="menu-btn" data-a="restart">Restart Match</button>
        <button class="menu-btn" data-a="leave">Leave Match</button>
      </nav>
    </div>`;
    node.querySelector('[data-a=resume]').onclick = () => app.resumeMatch();
    node.querySelector('[data-a=settings]').onclick = () => app.screens.push('settings', { inMatch: true });
    node.querySelector('[data-a=restart]').onclick = () => app.screens.confirm('Restart match?', 'Current progress in this match will be lost.', 'Restart', () => app.startMatch());
    node.querySelector('[data-a=leave]').onclick = () => app.screens.confirm('Leave match?', 'You will return to the main menu. This match will not count toward career stats.', 'Leave', () => app.leaveMatch());
    entry.onBack = () => app.resumeMatch();
  },

  results(app, node, p) {
    node.classList.add('shade-full');
    const r = p.result;
    const banner = r.outcome === 'win' ? 'VICTORY' : r.outcome === 'loss' ? 'DEFEAT' : 'DRAW';
    const cls = r.outcome;
    const reason = r.reason === 'score' ? 'Score limit reached' : 'Time limit reached';
    const table = (rows, team) => `
      <div class="team-head" style="color:${team === 0 ? 'var(--friendly)' : 'var(--enemy)'}"><span>${esc(TEAMS[team].name)}</span><span class="small muted" style="font-family:var(--font-body);letter-spacing:0.05em;font-weight:400">${esc(TEAMS[team].full)}</span><span class="score">${r.scores[team]}</span></div>
      <table class="sb"><thead><tr><th>Player</th><th class="num">Score</th><th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">Acc</th></tr></thead><tbody>
      ${rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.bot ? '<span class="bot-tag">BOT</span>' : ''}${esc(x.name)}</td><td class="num">${x.score}</td><td class="num">${x.kills}</td><td class="num">${x.deaths}</td><td class="num">${x.assists}</td><td class="num">${x.acc}</td></tr>`).join('')}
      </tbody></table>`;
    const me = r.me;
    const tiles = [['Score', me.score], ['Eliminations', me.kills], ['Deaths', me.deaths], ['Assists', me.assists], ['K/D', me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2)], ['Accuracy', me.shots ? Math.round(me.hits / me.shots * 100) + '%' : '—'], ['Headshots', me.headshots], ['Best Streak', me.bestStreak]];
    node.innerHTML = `<div class="page">
      <div class="page-head"><div><div class="kicker">${esc(reason)} · ${esc(app.mapRuntime.def.name)} · ${esc(MODES[r.mode].name)}</div><div class="res-banner ${cls}">${banner}</div></div><div class="spacer"></div>
        <div class="title" style="font-size:44px"><span style="color:var(--friendly)">${r.scores[0]}</span> <span class="dim">—</span> <span style="color:var(--enemy)">${r.scores[1]}</span></div></div>
      <div class="page-body scroll" style="gap:18px;flex-wrap:wrap">
        <div style="flex:1.4;min-width:340px" class="col">${table(r.rows[0], 0)}<div style="height:14px"></div>${table(r.rows[1], 1)}</div>
        <div style="flex:1;min-width:280px" class="col">
          <h3 class="title">Your performance</h3>
          <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
          <h3 class="title" style="margin-top:16px">Medals</h3>
          <div class="medal-list">${r.medals.length ? r.medals.map((m) => `<span class="medal">${esc(m.name)}<b>×${m.count}</b></span>`).join('') : '<span class="muted small">None this match</span>'}</div>
          <div class="muted small" style="margin-top:16px">${r.recorded ? 'Result added to your local career stats.' : 'Result already recorded.'} XP, levels and unlocks are planned for Milestone 3.</div>
        </div>
      </div>
      <div class="page-foot">
        <button class="btn" data-a="menu">Main Menu</button>
        <button class="btn" data-a="loadouts">Loadouts</button>
        <div class="spacer"></div>
        <button class="btn primary" data-a="again" style="padding:12px 40px">Play Again</button>
      </div></div>`;
    node.querySelector('[data-a=menu]').onclick = () => app.toMenu();
    node.querySelector('[data-a=loadouts]').onclick = () => { app.toMenu(); app.screens.push('play'); app.screens.push('loadouts'); };
    node.querySelector('[data-a=again]').onclick = () => app.startMatch();
  },
};

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
