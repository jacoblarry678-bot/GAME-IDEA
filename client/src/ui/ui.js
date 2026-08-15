/**
 * All DOM UI: main menu, host/join, lobby, character select, settings,
 * how-to-play, credits, the in-match HUD, the box puzzle overlay, the endgame
 * card and the F3 debug menu.
 *
 * The UI never touches game state directly — it reads a plain object from
 * Game.hudState() and calls back through the handlers passed to the ctor.
 */

import { GAME_MODES, ROLES, QUALITY_PRESETS, HEALTH, STAMINA, FEAR, ABILITIES, KEYCODE_DEFAULTS } from '../../../shared/constants.js';
import { settings, DEFAULTS } from '../core/settings.js';
import { LamentPuzzle } from '../gameplay/lament.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const ITEM_GLYPH = {
  flashlight: '🔦', medkit: '✚', key: '🗝', chalk: '✎', lantern: '🕯',
  relic: '◈', box_piece: '◫', lament: '❖',
};
const ABILITY_GLYPH = {
  chain_summon: '⛓', chain_trap: '☠', gateway: '◉', pain_sense: '👁', lament_teleport: '❖',
};

export class UI {
  constructor(root, handlers = {}) {
    this.root = root;
    this.h = handlers;
    this.screen = 'menu';
    this.modalOpen = true;
    this.toasts = [];
    this.chatLines = [];
    this.selectedSurvivor = null;
    this.build();
  }

  build() {
    this.root.innerHTML = '';
    this.buildMenu();
    this.buildHost();
    this.buildJoin();
    this.buildLobby();
    this.buildCharacters();
    this.buildSettings();
    this.buildHowTo();
    this.buildCredits();
    this.buildHUD();
    this.buildBoxOverlay();
    this.buildEnd();
    this.buildDebug();
    this.show('menu');
  }

  // ------------------------------------------------------------- screens

  screenEl(id, contentBuilder) {
    const s = el('div', 'screen hidden');
    s.id = 'screen-' + id;
    contentBuilder(s);
    this.root.appendChild(s);
    return s;
  }

  titleBlock() {
    const t = el('div', 'title-block');
    t.innerHTML = `
      <h1 class="title-main">HELLRAISER</h1>
      <div class="title-sub">The Game</div>
      <div class="title-tag">Non-commercial fan prototype · original placeholder assets</div>`;
    return t;
  }

  btn(label, cls, onClick) {
    const b = el('button', 'menu-btn ' + (cls || ''), label);
    b.addEventListener('click', () => {
      this.h.sound?.('ui_click');
      onClick();
    });
    b.addEventListener('mouseenter', () => this.h.sound?.('ui_hover'));
    return b;
  }

  buildMenu() {
    this.menuEl = this.screenEl('menu', (s) => {
      s.appendChild(this.titleBlock());
      const m = el('div', 'menu');
      m.appendChild(this.btn('HOST GAME', 'primary', () => this.show('host')));
      m.appendChild(this.btn('JOIN GAME', '', () => this.show('join')));
      m.appendChild(this.btn('CHARACTERS', '', () => this.show('characters')));
      m.appendChild(this.btn('SETTINGS', '', () => this.show('settings')));
      m.appendChild(this.btn('HOW TO PLAY', '', () => this.show('howto')));
      m.appendChild(this.btn('CREDITS', '', () => this.show('credits')));
      s.appendChild(m);
      const lan = el('div', 'muted center');
      lan.style.marginTop = '2.4rem';
      lan.id = 'lanHint';
      s.appendChild(lan);
    });
  }

  /** Offline (single-file) build: solo versus bots, no join-by-code. */
  setOffline() {
    this.offline = true;
    const menu = document.querySelector('#screen-menu .menu');
    if (menu) {
      const btns = [...menu.children];
      if (btns[0]) btns[0].textContent = 'PLAY — SOLO VS BOTS';
      if (btns[1]) btns[1].style.display = 'none';
    }
    const hint = document.getElementById('lanHint');
    if (hint) {
      hint.innerHTML =
        'This is the <b style="color:var(--gold)">offline build</b> — the whole game, including the ' +
        'authoritative simulation and the bots, is running inside this page.<br>' +
        'For multiplayer with join codes, run the project locally with <b>npm run dev</b>.';
    }
    if (this.lobbyHint) {
      this.lobbyHint.textContent = 'Offline: you and the bots. Swap sides or change the roster below.';
    }
    if (this.hostName) this.hostName.value = this.hostName.value || 'You';
  }

  setLanHint(urls) {
    const e = document.getElementById('lanHint');
    if (!e) return;
    if (!urls || !urls.length) {
      e.innerHTML = 'Others on this WiFi open this same page, then click JOIN.';
      return;
    }
    const port = location.port || '80';
    e.innerHTML =
      'Others on this WiFi open:<br>' +
      urls.map((u) => `<b style="color:var(--gold)">http://${u.address}:${port}</b>`).join('<br>') +
      '<br>then click JOIN and type your code.';
  }

  buildHost() {
    this.screenEl('host', (s) => {
      s.appendChild(this.titleBlock());
      const p = el('div', 'panel');
      p.innerHTML = '<h2>Host a Game</h2>';
      const nameField = el('div', 'field');
      nameField.innerHTML = '<label>Your name</label>';
      this.hostName = el('input');
      this.hostName.type = 'text';
      this.hostName.maxLength = 18;
      this.hostName.value = settings.get('player.name', '') || '';
      this.hostName.placeholder = 'Enter a name';
      nameField.appendChild(this.hostName);
      p.appendChild(nameField);

      const modeField = el('div', 'field');
      modeField.innerHTML = '<label>Game mode</label>';
      this.hostMode = el('select');
      for (const m of Object.values(GAME_MODES)) {
        const o = el('option', '', m.name);
        o.value = m.id;
        this.hostMode.appendChild(o);
      }
      this.hostMode.value = '1v4';
      modeField.appendChild(this.hostMode);
      p.appendChild(modeField);

      this.hostError = el('div', 'error');
      p.appendChild(this.hostError);

      const row = el('div', 'menu');
      row.style.marginTop = '1rem';
      row.appendChild(this.btn('OPEN THE LOBBY', 'primary', () => {
        const n = this.hostName.value.trim();
        if (!n) {
          this.hostError.textContent = 'Enter a name first.';
          return;
        }
        settings.set('player.name', n);
        this.h.host?.(n, this.hostMode.value);
      }));
      row.appendChild(this.btn('BACK', '', () => this.show('menu')));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  buildJoin() {
    this.screenEl('join', (s) => {
      s.appendChild(this.titleBlock());
      const p = el('div', 'panel');
      p.innerHTML = '<h2>Join a Game</h2>';

      const nameField = el('div', 'field');
      nameField.innerHTML = '<label>Your name</label>';
      this.joinName = el('input');
      this.joinName.type = 'text';
      this.joinName.maxLength = 18;
      this.joinName.value = settings.get('player.name', '') || '';
      this.joinName.placeholder = 'Enter a name';
      nameField.appendChild(this.joinName);
      p.appendChild(nameField);

      const lbl = el('div', 'muted center');
      lbl.style.margin = '1.2rem 0 0.4rem';
      lbl.textContent = 'LOBBY CODE';
      p.appendChild(lbl);
      this.joinCode = el('input', 'code-input');
      this.joinCode.type = 'text';
      this.joinCode.maxLength = 6;
      this.joinCode.placeholder = '••••••';
      this.joinCode.addEventListener('input', () => {
        this.joinCode.value = this.joinCode.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      });
      this.joinCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.doJoin();
      });
      p.appendChild(this.joinCode);

      this.joinError = el('div', 'error');
      this.joinError.style.marginTop = '0.8rem';
      p.appendChild(this.joinError);

      const row = el('div', 'menu');
      row.appendChild(this.btn('JOIN GAME', 'primary', () => this.doJoin()));
      row.appendChild(this.btn('BACK', '', () => this.show('menu')));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  doJoin() {
    const n = this.joinName.value.trim();
    const c = this.joinCode.value.trim();
    if (!n) {
      this.joinError.textContent = 'Enter a name first.';
      return;
    }
    if (c.length !== 6) {
      this.joinError.textContent = 'A code is six characters.';
      return;
    }
    settings.set('player.name', n);
    this.joinError.textContent = '';
    this.h.join?.(c, n);
  }

  buildLobby() {
    this.screenEl('lobby', (s) => {
      const p = el('div', 'panel');
      p.style.marginTop = '4vh';
      p.innerHTML = '<h2>Lobby</h2>';

      const codeLabel = el('div', 'muted center');
      codeLabel.textContent = 'LOBBY CODE';
      p.appendChild(codeLabel);
      this.lobbyCode = el('div', 'lobby-code', '------');
      this.lobbyCode.title = 'Click to copy';
      this.lobbyCode.addEventListener('click', () => {
        navigator.clipboard?.writeText(this.lobbyCode.textContent);
        this.showToast('Code copied.', 'good');
      });
      p.appendChild(this.lobbyCode);
      this.lobbyHint = el('div', 'lobby-hint', 'Read this out. Everyone else clicks JOIN and types it.');
      p.appendChild(this.lobbyHint);

      const modeRow = el('div', 'field');
      modeRow.innerHTML = '<label>Mode</label>';
      this.lobbyMode = el('select');
      for (const m of Object.values(GAME_MODES)) {
        const o = el('option', '', m.name);
        o.value = m.id;
        this.lobbyMode.appendChild(o);
      }
      this.lobbyMode.addEventListener('change', () => this.h.setMode?.(this.lobbyMode.value));
      modeRow.appendChild(this.lobbyMode);
      p.appendChild(modeRow);

      this.slotList = el('div');
      this.slotList.style.marginTop = '1rem';
      p.appendChild(this.slotList);

      this.lobbyRole = el('div', 'row');
      this.lobbyRole.style.marginTop = '1rem';
      const survBtn = this.btn('PLAY AS SURVIVOR', '', () => this.h.setRole?.(ROLES.SURVIVOR));
      const cenoBtn = this.btn('PLAY AS CENOBITE', 'danger', () => this.h.setRole?.(ROLES.CENOBITE));
      this.lobbyRole.appendChild(survBtn);
      this.lobbyRole.appendChild(cenoBtn);
      p.appendChild(this.lobbyRole);

      this.hostControls = el('div');
      const botRow = el('div', 'row');
      botRow.style.marginTop = '0.5rem';
      botRow.appendChild(this.btn('+ SURVIVOR BOT', '', () => this.h.addBot?.(ROLES.SURVIVOR)));
      botRow.appendChild(this.btn('+ CENOBITE BOT', '', () => this.h.addBot?.(ROLES.CENOBITE)));
      this.hostControls.appendChild(botRow);
      p.appendChild(this.hostControls);

      this.lobbyError = el('div', 'error');
      this.lobbyError.style.marginTop = '0.6rem';
      p.appendChild(this.lobbyError);

      const row = el('div', 'menu');
      row.style.marginTop = '0.8rem';
      this.startBtn = this.btn('BEGIN THE RITE', 'primary', () => this.h.start?.());
      row.appendChild(this.startBtn);
      row.appendChild(this.btn('CHOOSE CHARACTER', '', () => this.show('characters')));
      row.appendChild(this.btn('LEAVE', 'danger', () => this.h.leave?.()));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  updateLobby(lobby, myId) {
    this.lobby = lobby;
    this.myId = myId;
    if (!lobby) return;
    this.lobbyCode.textContent = lobby.code;
    this.lobbyMode.value = lobby.mode;
    const isHost = lobby.hostId === myId;
    this.lobbyMode.disabled = !isHost;
    this.hostControls.style.display = isHost ? '' : 'none';
    this.startBtn.style.display = isHost ? '' : '';
    this.startBtn.disabled = !isHost;
    this.startBtn.textContent = isHost ? 'BEGIN THE RITE' : 'WAITING FOR THE HOST';

    const max = lobby.maxPlayers;
    this.slotList.innerHTML = '';
    const sorted = [...lobby.players].sort((a, b) => (a.role === b.role ? 0 : a.role === ROLES.CENOBITE ? -1 : 1));
    for (let i = 0; i < max; i++) {
      const p = sorted[i];
      const row = el('div', 'slot' + (p ? ' filled' : '') + (p && p.role === ROLES.CENOBITE ? ' cenobite' : ''));
      const num = el('span', 'num', String(i + 1) + '.');
      row.appendChild(num);
      const who = el('span', 'who', p ? p.name : '<span class="muted">Waiting…</span>');
      row.appendChild(who);
      if (p) {
        if (p.isHost) row.appendChild(el('span', 'tag host', 'HOST'));
        if (p.role === ROLES.CENOBITE) row.appendChild(el('span', 'tag ceno', 'CENOBITE'));
        if (p.isBot) row.appendChild(el('span', 'tag', 'BOT'));
        if (p.id === myId) row.appendChild(el('span', 'tag', 'YOU'));
        if (isHost && p.id !== myId) {
          const k = el('span', 'tag', p.isBot ? 'REMOVE' : 'KICK');
          k.style.cursor = 'pointer';
          k.addEventListener('click', () => (p.isBot ? this.h.removeBot?.(p.id) : this.h.kick?.(p.id)));
          row.appendChild(k);
        }
      }
      this.slotList.appendChild(row);
    }
    const me = lobby.players.find((p) => p.id === myId);
    if (me) this.selectedRole = me.role;
  }

  buildCharacters() {
    this.screenEl('characters', (s) => {
      const p = el('div', 'panel');
      p.innerHTML = '<h2>Characters</h2>';
      const tabs = el('div', 'tabs');
      const tabS = el('div', 'tab active', 'SURVIVORS');
      const tabC = el('div', 'tab', 'CENOBITES');
      tabs.appendChild(tabS);
      tabs.appendChild(tabC);
      p.appendChild(tabs);

      this.survGrid = el('div', 'char-grid');
      this.cenoGrid = el('div', 'char-grid');
      this.cenoGrid.style.display = 'none';
      p.appendChild(this.survGrid);
      p.appendChild(this.cenoGrid);
      this.charDetail = el('div', 'char-detail');
      p.appendChild(this.charDetail);

      tabS.addEventListener('click', () => {
        tabS.classList.add('active'); tabC.classList.remove('active');
        this.survGrid.style.display = ''; this.cenoGrid.style.display = 'none';
        if (this.survivorDefs) this.showCharDetail(this.survivorDefs[0], false);
      });
      tabC.addEventListener('click', () => {
        tabC.classList.add('active'); tabS.classList.remove('active');
        this.cenoGrid.style.display = ''; this.survGrid.style.display = 'none';
        if (this.cenobiteDefs) this.showCharDetail(this.cenobiteDefs[0], true);
      });

      const row = el('div', 'menu');
      row.style.marginTop = '1rem';
      row.appendChild(this.btn('BACK', '', () => this.show(this.lobby ? 'lobby' : 'menu')));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  populateCharacters(survivors, cenobites, portraitFor) {
    this.survivorDefs = survivors;
    this.cenobiteDefs = cenobites;
    const fill = (grid, list, isCeno) => {
      grid.innerHTML = '';
      for (const c of list) {
        const card = el('div', 'char-card' + (isCeno && !c.available ? ' locked' : ''));
        const portrait = el('div', 'char-portrait');
        const cv = portraitFor ? portraitFor(c, isCeno) : null;
        if (cv) portrait.appendChild(cv);
        card.appendChild(portrait);
        card.appendChild(el('div', 'char-name', c.name));
        card.appendChild(el('div', 'char-role', isCeno && !c.available ? 'COMING SOON' : c.role));
        card.addEventListener('click', () => {
          if (isCeno && !c.available) return;
          this.h.sound?.('ui_click');
          for (const n of grid.children) n.classList.remove('selected');
          card.classList.add('selected');
          this.showCharDetail(c, isCeno);
          this.h.setCharacter?.(c.id, isCeno);
        });
        card.addEventListener('mouseenter', () => this.showCharDetail(c, isCeno));
        grid.appendChild(card);
      }
    };
    fill(this.survGrid, survivors, false);
    fill(this.cenoGrid, cenobites, true);
    if (survivors[0]) this.showCharDetail(survivors[0], false);
  }

  showCharDetail(c, isCeno) {
    const perk = isCeno ? c.passive : c.perk;
    const active = isCeno ? null : c.active;
    this.charDetail.innerHTML = `
      <div style="font-size:1.05rem;letter-spacing:0.14em;">${c.name}${c.subtitle ? ` <span class="muted">— ${c.subtitle}</span>` : ''}</div>
      <div class="muted" style="margin:0.4rem 0 0.7rem">${c.bio}</div>
      ${perk ? `<div class="perk">PASSIVE · ${perk.name} — <span class="muted">${perk.desc}</span></div>` : ''}
      ${active ? `<div class="active" style="margin-top:0.3rem">ACTIVE (Q) · ${active.name} — <span class="muted">${active.desc} [${active.cooldown}s]</span></div>` : ''}
      ${isCeno && c.abilities && c.abilities.length ? `<div style="margin-top:0.5rem" class="muted">Abilities: ${c.abilities.map((a) => Object.values(ABILITIES).find((x) => x.id === a)?.name).filter(Boolean).join(' · ')}</div>` : ''}
    `;
  }

  // ------------------------------------------------------------- settings

  buildSettings() {
    this.screenEl('settings', (s) => {
      const p = el('div', 'panel');
      p.innerHTML = '<h2>Settings</h2>';
      const tabs = el('div', 'tabs');
      const pages = {};
      const names = [['graphics', 'GRAPHICS'], ['audio', 'AUDIO'], ['controls', 'CONTROLS'], ['accessibility', 'ACCESSIBILITY']];
      for (const [key, label] of names) {
        const t = el('div', 'tab' + (key === 'graphics' ? ' active' : ''), label);
        tabs.appendChild(t);
        const page = el('div', 'tabpage' + (key === 'graphics' ? ' active' : ''));
        pages[key] = page;
        t.addEventListener('click', () => {
          for (const n of tabs.children) n.classList.remove('active');
          t.classList.add('active');
          for (const k of Object.keys(pages)) pages[k].classList.toggle('active', k === key);
        });
      }
      p.appendChild(tabs);

      // ---- graphics ----
      const g = pages.graphics;
      g.appendChild(this.selectField('Quality preset', 'graphics.preset',
        Object.keys(QUALITY_PRESETS).map((k) => [k, QUALITY_PRESETS[k].name]),
        (v) => this.h.setQuality?.(v)));
      g.appendChild(this.rangeField('Resolution scale', 'graphics.resolutionScale', 0.5, 1.5, 0.05, (v) => this.h.setResolution?.(v)));
      g.appendChild(this.rangeField('Field of view', 'graphics.fov', 60, 100, 1, (v) => this.h.setFov?.(v)));
      g.appendChild(this.toggleField('Shadows', 'graphics.shadows', () => this.h.refreshGraphics?.()));
      g.appendChild(this.toggleField('Anti-aliasing', 'graphics.antialiasing', () => this.h.refreshGraphics?.()));
      g.appendChild(this.toggleField('Post processing', 'graphics.postProcessing', () => this.h.refreshGraphics?.()));
      g.appendChild(this.toggleField('Bloom', 'graphics.bloom', () => this.h.refreshGraphics?.()));
      g.appendChild(this.toggleField('Film grain', 'graphics.filmGrain', () => this.h.refreshGraphics?.()));
      g.appendChild(this.selectField('Texture quality', 'graphics.textureQuality',
        [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], () => this.showToast('Texture quality applies on the next match.', '')));
      g.appendChild(this.selectField('Fog quality', 'graphics.fogQuality',
        [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], () => this.h.refreshGraphics?.()));
      p.appendChild(g);

      // ---- audio ----
      const a = pages.audio;
      a.appendChild(this.rangeField('Master', 'audio.master', 0, 1, 0.01));
      a.appendChild(this.rangeField('Music', 'audio.music', 0, 1, 0.01));
      a.appendChild(this.rangeField('Sound effects', 'audio.sfx', 0, 1, 0.01));
      a.appendChild(this.rangeField('Voice', 'audio.voice', 0, 1, 0.01));
      a.appendChild(this.rangeField('Ambience', 'audio.ambience', 0, 1, 0.01));
      a.appendChild(this.toggleField('Subtitles / captions', 'audio.subtitles'));
      p.appendChild(a);

      // ---- controls ----
      const c = pages.controls;
      c.appendChild(this.rangeField('Mouse sensitivity', 'controls.sensitivity', 0.2, 3, 0.05));
      c.appendChild(this.rangeField('Controller sensitivity', 'controls.controllerSensitivity', 0.2, 3, 0.05));
      c.appendChild(this.toggleField('Invert Y', 'controls.invertY'));
      c.appendChild(this.toggleField('Toggle sprint', 'controls.toggleSprint'));
      c.appendChild(this.toggleField('Toggle crouch', 'controls.toggleCrouch'));
      c.appendChild(el('h3', '', 'Key bindings'));
      const bindWrap = el('div');
      const binds = [
        ['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'],
        ['sprint', 'Sprint'], ['crouch', 'Crouch'], ['interact', 'Interact'], ['vault', 'Vault'],
        ['flashlight', 'Flashlight'], ['drop', 'Drop item'], ['scoreboard', 'Scoreboard'],
      ];
      for (const [action, label] of binds) {
        const f = el('div', 'field');
        f.innerHTML = `<label>${label}</label>`;
        const b = el('button', 'kbd-btn', settings.data.controls.bindings[action] || '—');
        b.addEventListener('click', () => {
          b.classList.add('listening');
          b.textContent = 'press a key…';
          this.h.rebind?.(action, (a2, code) => {
            b.classList.remove('listening');
            b.textContent = code;
          });
        });
        f.appendChild(b);
        bindWrap.appendChild(f);
      }
      c.appendChild(bindWrap);
      const resetRow = el('div', 'menu');
      resetRow.appendChild(this.btn('RESET BINDINGS', '', () => {
        settings.resetBindings();
        this.showToast('Bindings reset.', 'good');
        this.build();
        this.show('settings');
      }));
      c.appendChild(resetRow);
      p.appendChild(c);

      // ---- accessibility ----
      const ac = pages.accessibility;
      ac.appendChild(this.toggleField('Reduce camera shake', 'accessibility.reduceShake'));
      ac.appendChild(this.toggleField('Reduce flashing', 'accessibility.reduceFlashing'));
      ac.appendChild(this.toggleField('High contrast prompts', 'accessibility.highContrastPrompts', (v) => {
        document.body.classList.toggle('high-contrast', v);
      }));
      ac.appendChild(this.toggleField('Larger text', 'accessibility.largeText', (v) => {
        document.documentElement.style.fontSize = v ? '18px' : '';
      }));
      ac.appendChild(this.toggleField('Heartbeat audio cue', 'accessibility.heartbeatCue'));
      ac.appendChild(this.rangeField('Fear visual intensity', 'accessibility.fearVisuals', 0, 1, 0.05));
      ac.appendChild(this.selectField('Colourblind mode', 'accessibility.colorblind',
        [['none', 'Off'], ['protan', 'Protanopia'], ['deutan', 'Deuteranopia'], ['tritan', 'Tritanopia']]));
      p.appendChild(ac);

      const row = el('div', 'menu');
      row.style.marginTop = '1rem';
      row.appendChild(this.btn('BACK', '', () => this.show(this.lobby ? 'lobby' : 'menu')));
      row.appendChild(this.btn('RESET ALL', 'danger', () => {
        settings.reset();
        this.build();
        this.show('settings');
        this.h.refreshGraphics?.();
      }));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  rangeField(label, path, min, max, step, onChange) {
    const f = el('div', 'field');
    f.innerHTML = `<label>${label}</label>`;
    const wrap = el('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '0.6rem';
    const input = el('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = settings.get(path, min);
    const val = el('span', 'val', String(input.value));
    input.addEventListener('input', () => {
      val.textContent = (+input.value).toFixed(step < 1 ? 2 : 0);
      settings.set(path, +input.value);
      onChange?.(+input.value);
    });
    wrap.appendChild(input);
    wrap.appendChild(val);
    f.appendChild(wrap);
    return f;
  }

  toggleField(label, path, onChange) {
    const f = el('div', 'field');
    f.innerHTML = `<label>${label}</label>`;
    const b = el('button', 'kbd-btn', settings.get(path) ? 'ON' : 'OFF');
    b.addEventListener('click', () => {
      const v = !settings.get(path);
      settings.set(path, v);
      b.textContent = v ? 'ON' : 'OFF';
      this.h.sound?.('ui_click');
      onChange?.(v);
    });
    f.appendChild(b);
    return f;
  }

  selectField(label, path, options, onChange) {
    const f = el('div', 'field');
    f.innerHTML = `<label>${label}</label>`;
    const sel = el('select');
    for (const [v, name] of options) {
      const o = el('option', '', name);
      o.value = v;
      sel.appendChild(o);
    }
    sel.value = settings.get(path, options[0][0]);
    sel.addEventListener('change', () => {
      settings.set(path, sel.value);
      onChange?.(sel.value);
    });
    f.appendChild(sel);
    return f;
  }

  buildHowTo() {
    this.screenEl('howto', (s) => {
      const p = el('div', 'panel');
      p.innerHTML = `
        <h2>How to Play</h2>
        <h3>The situation</h3>
        <p class="muted">Four survivors are inside the Labyrinth. One player is the Hell Priest. The survivors are trying to complete a rite that opens the Gate. The Priest is trying to make sure nobody finishes it.</p>
        <h3>Survivors — the rite, in order</h3>
        <p class="muted">
          <b>1. Break the seals.</b> Four ritual seals are bound into the walls. Channel each one. It takes time and it is loud.<br>
          <b>2. The offering.</b> Carry three ritual relics to the altar in the Puzzle Chamber. You can only carry one at a time.<br>
          <b>3. The configuration.</b> Find three fragments of the Lament Configuration and set them on the altar.<br>
          <b>4. Solve the box.</b> Someone has to open it. Rotate the four segments until the symbols align. Every turn heats the box, and the Priest can feel the heat — and can step out of the box beside you.<br>
          <b>5. The Gate.</b> Solving the box unbinds the Gate. Charge it together and get out.
        </p>
        <h3>Survivor controls</h3>
        <p class="muted">
          WASD move · Shift sprint · Ctrl crouch · <b>E</b> hold to interact · Space vault · F flashlight ·
          Q active perk · 1 use medkit · G drop · Tab scoreboard · Esc menu · F3 debug
        </p>
        <h3>Staying alive</h3>
        <p class="muted">
          Hide in lockers and wardrobes. Vault to break line of sight. Light and company both reduce fear —
          fear makes your hands shake, your vision warp, and delicate work slower. Pick teammates up when they go down;
          a downed survivor bleeds out in a minute, or gets executed sooner.
        </p>
        <h3>The Hell Priest</h3>
        <p class="muted">
          Left click melee · <b>1</b> Chain Summon · <b>2</b> Chain Trap · <b>3</b> Gateway · <b>4</b> Pain Sense ·
          <b>5</b> Lament Teleport · <b>F</b> execute a downed survivor · <b>R</b> step through your own gateway.<br>
          You are slower at top speed than a sprinting survivor. You win with position, information and patience — not a footrace.
        </p>
        <h3>Playing together on one WiFi</h3>
        <p class="muted">
          One person clicks HOST GAME and reads out the six-character code. Everyone else opens the same web address
          on their own device and clicks JOIN, then types the code. Nobody types an IP address. Add bots to fill empty
          seats if you are short of people.
        </p>`;
      const row = el('div', 'menu');
      row.appendChild(this.btn('BACK', '', () => this.show(this.lobby ? 'lobby' : 'menu')));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  buildCredits() {
    this.screenEl('credits', (s) => {
      const p = el('div', 'panel');
      p.innerHTML = `
        <h2>Credits</h2>
        <p class="muted">
          <b>HELLRAISER: THE GAME</b> is a non-commercial fan prototype. It is not affiliated with, endorsed by,
          or licensed from the rights holders of the Hellraiser films or the Clive Barker novella
          <i>The Hellbound Heart</i>.
        </p>
        <h3>Assets</h3>
        <p class="muted">
          Every texture, model, animation and sound in this build is generated procedurally in code at runtime.
          Nothing is downloaded and nothing is copied from the films. The Cenobite model is an original placeholder
          built from primitives, clearly labelled as such, and is intended to be replaced by properly licensed or
          commissioned art.
        </p>
        <h3>Built with</h3>
        <p class="muted">three.js · Vite · Node.js · Express · Socket.IO · the Web Audio API</p>
        <h3>Original characters</h3>
        <p class="muted">Mara Vance, Tobias Kerr, Inés Fuentes, Gideon Roarke, Nadia Sorel and Wren Adeyemi are original
        characters written for this prototype.</p>`;
      const row = el('div', 'menu');
      row.appendChild(this.btn('BACK', '', () => this.show('menu')));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  // ------------------------------------------------------------------ HUD

  buildHUD() {
    const h = el('div', 'hidden');
    h.id = 'hud';
    h.innerHTML = `
      <div class="hud-damage"></div>
      <div class="hud-lowhealth" style="display:none"></div>
      <div class="crosshair hidden"></div>
      <div class="hud-objective">
        <div class="obj-phase"></div>
        <div class="obj-text"></div>
        <div class="obj-progress"></div>
      </div>
      <div class="hud-clock"><div class="t">20:00</div><div class="zone"></div></div>
      <div class="hud-team"></div>
      <div class="hud-vitals">
        <div class="bar-label">VITALITY</div><div class="bar health"><i></i></div>
        <div class="bar-label stamina-label">STAMINA</div><div class="bar stamina"><i></i></div>
        <div class="bar-label fear-label">FEAR</div><div class="bar fear"><i></i></div>
      </div>
      <div class="hud-inventory"></div>
      <div class="hud-abilities"></div>
      <div class="prompt hidden"></div>
      <div class="channel hidden"><div class="lbl"></div><div class="track"><i></i></div></div>
      <div class="toast-stack"></div>
      <div class="chat"><div class="lines"></div><input class="hidden" maxlength="180" placeholder="say something…"></div>`;
    this.root.appendChild(h);
    this.hud = h;
    this.q = {
      damage: h.querySelector('.hud-damage'),
      low: h.querySelector('.hud-lowhealth'),
      crosshair: h.querySelector('.crosshair'),
      objPhase: h.querySelector('.obj-phase'),
      objText: h.querySelector('.obj-text'),
      objProgress: h.querySelector('.obj-progress'),
      clock: h.querySelector('.hud-clock .t'),
      zone: h.querySelector('.hud-clock .zone'),
      team: h.querySelector('.hud-team'),
      health: h.querySelector('.bar.health > i'),
      stamina: h.querySelector('.bar.stamina > i'),
      fear: h.querySelector('.bar.fear > i'),
      fearLabel: h.querySelector('.fear-label'),
      staminaLabel: h.querySelector('.stamina-label'),
      inventory: h.querySelector('.hud-inventory'),
      abilities: h.querySelector('.hud-abilities'),
      prompt: h.querySelector('.prompt'),
      channel: h.querySelector('.channel'),
      channelLbl: h.querySelector('.channel .lbl'),
      channelBar: h.querySelector('.channel .track > i'),
      toasts: h.querySelector('.toast-stack'),
      chatLines: h.querySelector('.chat .lines'),
      chatInput: h.querySelector('.chat input'),
    };
    this.q.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const t = this.q.chatInput.value.trim();
        if (t) this.h.chat?.(t);
        this.q.chatInput.value = '';
        this.q.chatInput.classList.add('hidden');
        this.q.chatInput.blur();
        this.h.chatClosed?.();
      } else if (e.key === 'Escape') {
        this.q.chatInput.value = '';
        this.q.chatInput.classList.add('hidden');
        this.q.chatInput.blur();
        this.h.chatClosed?.();
      }
    });
  }

  openChat() {
    this.q.chatInput.classList.remove('hidden');
    this.q.chatInput.focus();
  }

  get chatOpen() {
    return !this.q.chatInput.classList.contains('hidden');
  }

  updateHUD(s) {
    if (!s) return;
    const q = this.q;
    q.health.style.transform = `scaleX(${Math.max(0, s.health / HEALTH.MAX)})`;
    q.stamina.style.transform = `scaleX(${Math.max(0, s.stamina / STAMINA.MAX)})`;
    q.fear.style.transform = `scaleX(${Math.max(0, s.fear / FEAR.MAX)})`;
    q.fearLabel.textContent =
      s.fear > FEAR.TERRIFIED ? 'TERRIFIED' : s.fear > FEAR.AFRAID ? 'AFRAID' : s.fear > FEAR.UNEASY ? 'UNEASY' : 'FEAR';

    // the Cenobite has power instead of fear/stamina
    if (s.isCenobite) {
      q.fear.parentElement.className = 'bar power';
      q.fear.style.transform = `scaleX(${s.power / 100})`;
      q.fearLabel.textContent = 'POWER';
      q.stamina.parentElement.style.display = 'none';
      q.staminaLabel.style.display = 'none';
    } else {
      q.fear.parentElement.className = 'bar fear';
      q.stamina.parentElement.style.display = '';
      q.staminaLabel.style.display = '';
    }

    q.low.style.display = !s.isCenobite && s.health < HEALTH.INJURED_AT ? '' : 'none';
    q.crosshair.classList.toggle('hidden', !s.isCenobite);

    const m = Math.floor(s.clock / 60);
    const sec = Math.floor(s.clock % 60);
    q.clock.textContent = `${m}:${String(sec).padStart(2, '0')}`;
    q.zone.textContent = s.zone;

    q.objPhase.textContent = s.objective.title;
    q.objText.textContent = s.objective.hint;
    q.objProgress.textContent = s.objective.progress;

    // teammates
    const html = s.mates
      .map((mt) => {
        const cls = mt.state === HEALTH_STATE_MAP.injured ? 'injured' : mt.state;
        return `<div class="mate ${cls}"><span class="dot"></span>${mt.name}${mt.carrying ? ' ◈' : ''}${mt.revealed ? ' <span style="color:var(--blood-bright)">◉</span>' : ''}</div>`;
      })
      .join('');
    if (html !== this._matesHtml) {
      q.team.innerHTML = html;
      this._matesHtml = html;
    }

    // inventory
    if (!s.isCenobite) {
      const inv = s.inventory || [];
      const slots = [];
      for (let i = 0; i < 3; i++) {
        const item = inv[i];
        slots.push(
          `<div class="inv-slot ${item ? '' : 'empty'}"><span class="k">${i + 1}</span><span class="glyph">${item ? ITEM_GLYPH[item] || '▪' : '·'}</span>${item ? item.replace('_', ' ') : ''}</div>`
        );
      }
      if (s.carrying) {
        slots.push(`<div class="inv-slot" style="border-color:var(--gold)"><span class="glyph">${ITEM_GLYPH[s.carrying] || '◈'}</span>${s.carrying.replace('_', ' ')}</div>`);
      }
      if (s.perk && s.activePerk) {
        const ready = s.perkCooldown <= 0;
        slots.push(
          `<div class="inv-slot" style="border-color:${ready ? 'var(--violet)' : 'rgba(180,140,120,0.2)'}"><span class="k">Q</span><span class="glyph">${ready ? '✦' : Math.ceil(s.perkCooldown)}</span>${s.activePerk.name}</div>`
        );
      }
      const invHtml = slots.join('');
      if (invHtml !== this._invHtml) {
        q.inventory.innerHTML = invHtml;
        this._invHtml = invHtml;
      }
      q.abilities.innerHTML = '';
    } else {
      q.inventory.innerHTML = '';
      const ab = s.abilities
        .map((a) => {
          const pct = a.max > 0 ? a.cd / a.max : 0;
          return `<div class="ability ${a.ready && !a.locked ? 'ready' : ''} ${a.locked ? 'locked' : ''}">
            <span class="key">${a.key}</span>
            <span class="glyph">${ABILITY_GLYPH[a.id] || '◆'}</span>
            <span class="nm">${a.name}</span>
            ${a.cd > 0 ? `<div class="cd" style="transform:scaleY(${pct})">${Math.ceil(a.cd)}</div>` : ''}
          </div>`;
        })
        .join('');
      if (ab !== this._abHtml) {
        q.abilities.innerHTML = ab;
        this._abHtml = ab;
      }
    }

    // interaction prompt
    if (s.prompt) {
      q.prompt.classList.remove('hidden');
      q.prompt.innerHTML = `<span class="k">${s.prompt.key}</span>${s.prompt.text}`;
    } else {
      q.prompt.classList.add('hidden');
    }

    // channel bar
    if (s.channel) {
      q.channel.classList.remove('hidden');
      q.channelLbl.textContent = CHANNEL_LABEL[s.channel.type] || s.channel.type;
      q.channelBar.style.transform = `scaleX(${Math.max(0, Math.min(1, s.channel.progress))})`;
    } else {
      q.channel.classList.add('hidden');
    }

    // downed timer takes over the objective line
    if (s.healthState === 'downed') {
      q.objPhase.textContent = 'BLEEDING OUT';
      q.objText.textContent = `${Math.max(0, Math.ceil(60 - s.downedTimer))}s`;
      q.objProgress.textContent = 'Someone has to pick you up.';
    }
    if (s.hiding) {
      q.objPhase.textContent = 'HIDDEN';
      q.objText.textContent = 'Do not move.';
    }
  }

  setDamageFlash(v) {
    this.q.damage.style.opacity = String(Math.min(1, v));
  }

  showHUD(on) {
    this.hud.classList.toggle('hidden', !on);
  }

  // ------------------------------------------------------------ box puzzle

  buildBoxOverlay() {
    const o = el('div', 'hidden');
    o.id = 'boxPuzzle';
    const frame = el('div', 'box-frame');
    frame.innerHTML = '<h2>The Lament Configuration</h2>';
    const canvasHost = el('div');
    canvasHost.style.cssText = 'width:min(440px,80vw);aspect-ratio:1;margin:0 auto;';
    frame.appendChild(canvasHost);
    this.boxSegments = el('div', 'box-segments');
    frame.appendChild(this.boxSegments);
    this.boxHeat = el('div', 'box-heat');
    this.boxHeat.innerHTML = '<i></i>';
    frame.appendChild(this.boxHeat);
    this.boxHint = el('div', 'box-hint', 'Click or drag a segment to turn it · ↑↓ select · ←→ turn · ENTER commit · ESC step away');
    frame.appendChild(this.boxHint);
    o.appendChild(frame);
    this.root.appendChild(o);
    this.boxOverlay = o;
    this.boxCanvasHost = canvasHost;
  }

  initBoxPuzzle(audio) {
    if (this.puzzle) return;
    this.puzzle = new LamentPuzzle(this.boxCanvasHost, {
      audio,
      onRotate: (seg, dir) => this.h.boxRotate?.(seg, dir),
      onSubmit: () => this.h.boxSubmit?.(),
    });
    // the puzzle canvas needs a real size before first render
    this.boxCanvasHost.style.display = 'block';
  }

  openBoxPuzzle(box, charDef) {
    this.boxOverlay.classList.remove('hidden');
    this.modalOpen = true;
    if (this.puzzle) {
      this.puzzle.open();
      this.puzzle.resize();
    }
    this.updateBoxPuzzle(box, charDef);
  }

  closeBoxPuzzle() {
    this.boxOverlay.classList.add('hidden');
    this.modalOpen = false;
    this.puzzle?.close();
  }

  updateBoxPuzzle(box, charDef) {
    if (!box) return;
    const scholar = charDef && charDef.perk && charDef.perk.id === 'scholar';
    this.puzzle?.setState({ config: box.config, heat: box.heat, hint: null });
    const glyphs = ['◍', '▽', '◎', '✚', '◉', '☍'];
    this.boxSegments.innerHTML = box.config
      .map((v, i) => {
        const active = this.puzzle && this.puzzle.activeSegment === i;
        return `<div class="seg ${active ? 'active' : ''}" data-seg="${i}">
          <span class="sym">${glyphs[v % glyphs.length]}</span>
          <span class="idx">RING ${i + 1}</span>
        </div>`;
      })
      .join('');
    for (const n of this.boxSegments.children) {
      n.addEventListener('click', () => {
        const i = +n.dataset.seg;
        if (this.puzzle) this.puzzle.activeSegment = i;
        this.h.boxRotate?.(i, 1);
      });
    }
    this.boxHeat.querySelector('i').style.transform = `scaleX(${box.heat || 0})`;
    this.boxHint.textContent =
      box.heat > 0.66
        ? 'It is very warm now. Something is paying attention.'
        : scholar
        ? 'Scholar: the rings ring true when they are right.'
        : 'Click or drag a segment to turn it · ENTER commit · ESC step away';
  }

  // ------------------------------------------------------------- end card

  buildEnd() {
    this.endEl = this.screenEl('end', (s) => {
      const p = el('div', 'panel endcard');
      this.endContent = el('div');
      p.appendChild(this.endContent);
      const row = el('div', 'menu');
      row.style.marginTop = '1.5rem';
      row.appendChild(this.btn('BACK TO LOBBY', 'primary', () => this.show('lobby')));
      row.appendChild(this.btn('MAIN MENU', '', () => this.h.leave?.()));
      p.appendChild(row);
      s.appendChild(p);
    });
  }

  showEnd(data, myId) {
    const me = data.players.find((p) => p.id === myId);
    const iWon = me
      ? (me.role === ROLES.CENOBITE && data.winner === 'cenobite') ||
        (me.role === ROLES.SURVIVOR && me.escaped)
      : false;
    this.endContent.innerHTML = `
      <div class="verdict ${iWon ? 'win' : 'lose'}">${iWon ? 'YOU ENDURED' : data.winner === 'cenobite' ? 'THE LABYRINTH KEEPS YOU' : 'IT IS OVER'}</div>
      <div class="msg">${data.message}</div>
      ${data.players
        .map((p) => {
          const st = p.escaped ? 'ESCAPED' : p.alive ? 'STILL INSIDE' : 'CLAIMED';
          const cls = p.escaped ? 'escaped' : p.alive ? '' : 'dead';
          return `<div class="endrow"><span>${p.name}${p.isBot ? ' <span class="muted">(bot)</span>' : ''} <span class="muted">· ${p.role}</span></span><span class="st ${cls}">${st}</span></div>`;
        })
        .join('')}
      <div class="endrow" style="margin-top:1rem;border:0">
        <span class="muted">Hits ${data.stats.hits} · Downs ${data.stats.downs} · Claimed ${data.stats.kills} · Escaped ${data.stats.escapes} · Seals ${data.stats.sealsBroken}</span>
      </div>`;
    this.show('end');
  }

  // ---------------------------------------------------------------- debug

  buildDebug() {
    const d = el('div', 'hidden');
    d.id = 'debug';
    this.root.appendChild(d);
    this.debugEl = d;
    this.debugVisible = false;
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugEl.classList.toggle('hidden', !this.debugVisible);
  }

  updateDebug(info, isHost) {
    if (!this.debugVisible) return;
    const kv = (k, v, cls = '') => `<div class="kv"><span>${k}</span><b class="${cls}">${v}</b></div>`;
    const fpsCls = info.fps < 30 ? 'bad' : info.fps < 50 ? 'warn' : '';
    const pingCls = info.ping > 120 ? 'bad' : info.ping > 60 ? 'warn' : '';
    let html = `<h4>Performance</h4>
      ${kv('FPS', info.fps, fpsCls)}
      ${kv('Draw calls', info.draws)}
      ${kv('Triangles', (info.tris / 1000).toFixed(0) + 'k')}
      <h4>Network</h4>
      ${kv('Ping', info.ping + ' ms', pingCls)}
      ${kv('Status', info.connected ? 'connected' : 'OFFLINE', info.connected ? '' : 'bad')}
      ${kv('Snapshots buffered', info.snapshots)}
      ${kv('Connected players', info.players)}
      <h4>Player</h4>
      ${kv('Position', info.pos)}
      ${kv('Floor', info.floor)}
      ${kv('Room', info.zone)}
      ${kv('Role', info.role)}
      ${kv('Health', info.health + ' (' + info.healthState + ')')}
      ${kv('Fear', info.fear)}
      ${kv('Stamina', info.stamina)}
      ${kv('Power', info.power)}
      ${kv('Noclip', info.noclip ? 'ON' : 'off')}
      <h4>Match</h4>
      ${kv('Phase', info.phase)}`;

    if (isHost) {
      html += `<h4>Host tools</h4><div id="dbgBtns">
        <button data-cmd="heal">Heal</button>
        <button data-cmd="spawn_item" data-item="medkit">Spawn medkit</button>
        <button data-cmd="spawn_item" data-item="key">Spawn key</button>
        <button data-cmd="teleport" data-to="altar">TP altar</button>
        <button data-cmd="teleport" data-to="gate">TP gate</button>
        <button data-cmd="complete_objective">Skip objectives</button>
        <button data-cmd="solve_box">Solve box</button>
        <button data-cmd="horror" data-event="lights_out">Lights out</button>
        <button data-cmd="horror" data-event="apparition">Apparition</button>
        <button data-cmd="set_fear" data-value="90">Fear 90</button>
        <button data-cmd="set_fear" data-value="0">Fear 0</button>
        <button data-cmd="toggle_ai">Toggle AI</button>
        <button data-cmd="__noclip">Toggle noclip</button>
        <button data-cmd="end_match" data-winner="survivors">End: survivors</button>
        <button data-cmd="end_match" data-winner="cenobite">End: cenobite</button>
      </div>`;
    } else {
      html += `<h4>Host tools</h4><div class="muted">Only the host can run debug commands.</div>`;
    }
    html += `<h4>Local</h4><div><button data-cmd="__noclip">Noclip</button><button data-cmd="__fp">First person</button></div>`;

    if (html !== this._debugHtml) {
      this.debugEl.innerHTML = html;
      this._debugHtml = html;
      for (const b of this.debugEl.querySelectorAll('button')) {
        b.addEventListener('click', () => {
          const cmd = b.dataset.cmd;
          if (cmd === '__noclip') return this.h.toggleNoclip?.();
          if (cmd === '__fp') return this.h.toggleFirstPerson?.();
          this.h.debug?.(cmd, {
            item: b.dataset.item, to: b.dataset.to, event: b.dataset.event,
            value: b.dataset.value ? +b.dataset.value : undefined,
            winner: b.dataset.winner,
          });
        });
      }
    }
  }

  // --------------------------------------------------------------- toasts

  showToast(text, kind = '', seconds = 3) {
    const t = el('div', 'toast ' + kind, text);
    this.q.toasts.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.5s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 520);
    }, seconds * 1000);
    while (this.q.toasts.children.length > 5) this.q.toasts.firstChild.remove();
  }

  addChat(from, text) {
    const line = el('div', 'line', `<b>${escapeHtml(from)}:</b> ${escapeHtml(text)}`);
    this.q.chatLines.appendChild(line);
    while (this.q.chatLines.children.length > 6) this.q.chatLines.firstChild.remove();
    setTimeout(() => {
      line.style.transition = 'opacity 1s';
      line.style.opacity = '0';
      setTimeout(() => line.remove(), 1100);
    }, 14000);
  }

  showError(msg) {
    if (this.screen === 'join') this.joinError.textContent = msg;
    else if (this.screen === 'host') this.hostError.textContent = msg;
    else if (this.screen === 'lobby') this.lobbyError.textContent = msg;
    this.showToast(msg, 'bad', 4);
  }

  // ---------------------------------------------------------------- switch

  show(name) {
    this.screen = name;
    for (const s of this.root.querySelectorAll('.screen')) s.classList.add('hidden');
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.remove('hidden');
    const inMatch = name === 'game';
    this.showHUD(inMatch);
    this.modalOpen = !inMatch;
    this.h.screenChanged?.(name);
  }
}

const HEALTH_STATE_MAP = { injured: 'injured' };
const CHANNEL_LABEL = {
  seal: 'BREAKING THE SEAL',
  container: 'SEARCHING',
  relic: 'TAKING THE RELIC',
  piece: 'TAKING THE FRAGMENT',
  deliver: 'OFFERING',
  gate: 'CHARGING THE GATE',
  door: 'FORCING THE DOOR',
  revive: 'PICKING THEM UP',
  heal: 'PATCHING THEM UP',
  selfheal: 'PATCHING YOURSELF UP',
  hide: 'HIDING',
  box: 'OPENING THE BOX',
};

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
