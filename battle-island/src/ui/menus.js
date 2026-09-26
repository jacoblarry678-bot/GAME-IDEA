/**
 * Menu screens: lobby, character select, locker, settings, controls, roadmap,
 * pause, and the elimination / victory / match-over results. Every visible
 * button is wired to a working action.
 */

import { CHARACTERS, CHARACTER_IDS, SKIN_TONES } from '../entities/characters.js';
import { save, levelInfo } from '../core/save.js';
import { rankState, divName, divColor, divisionMMR, badgeHTML, TOP, PLACEMENT_MATCHES, lobbyLabel, isSupercharged, SUPER_LEAD, SUPER_MULT } from '../core/ranked.js';
import { superXP, refillIn, CAP_XP, DAILY_XP } from '../core/supercharge.js';
import { sfx } from '../core/audio.js';

export const ROADMAP = {
  done: [
    'Milestone 1 — solo battle royale vs labelled bots: lobby → Benton Bus → drop marker → skydive/glider → loot → 6-phase storm → victory/elimination → spectate → replay',
    'Colton, Emerson & Waylon: distinct models, outfits, backpacks, animations and emotes; equal combat stats; skin tones',
    'Island: Benton Diesel Garage, Pickles Park, Haunt Hollow, Boom Co. Depot, Benton Kids Clubhouse, 4 cabins, roads, pond, walk-in buildings, secret legendary chests',
    'Movement: sprint + stamina, crouch, slide, mantle/hurdle, swimming, fall damage, bounce pads with glider redeploy, camera collision, sensitivity/FOV settings',
    '6 weapons + Boom Balls: rarities, mags, reloads, ammo types, recoil, bloom, ADS, sniper scope and bullet drop, headshots, hit feedback',
    'Loot: 5 slots, stacking, swapping, dropping, chests, floor loot, supply drops, healing/shields with use times and interruption; explosive barrels',
    'Zero Build mode with regenerating overshield; XP, levels, outfit unlocks, saved settings and progression',
    'Milestone 2 — Duos, Trios and Squads with labelled bot teammates who drop with you, follow you and answer pings',
    'Knocked-down state with bleed-out, crawling and reviving; team wipes; squad placement',
    'Reboot cards and reboot vans (bring eliminated teammates back; vans shut off in the endgame)',
    'Pings (Z / middle mouse): enemy, chest, loot or “going here”, shown in the world and on the map',
    'Buffs: Zoom Juice (speed), Bouncy Soda (jump + no fall damage), Spicy Pickle (+20% damage), Shield Snack (shield regen) with HUD timers and auras; bots use them too',
    'Building 2.0: edit walls (3×3) and floors (2×2) with confirm/reset, repair, upgrade wood → brick → metal, structural integrity (unsupported builds collapse), team ownership',
    'Milestone 3 — online multiplayer: up to 4 players per match (bots fill the rest), host-authoritative, via the claude.ai link or a self-hosted server; open-games list and join codes; bot takeover if someone disconnects',
    'Mobile: touch joystick, drag-to-look, on-screen buttons (drag FIRE to aim), tappable inventory/build bar/minimap, phone layouts and lighter graphics defaults',
    'Ranked: Bronze → Silver → Gold → Platinum → Diamond → Champion (3 divisions each) → Legend; MMR-based matchmaking (bot difficulty), rank points for placement and eliminations, placement matches, separate Build / Zero Build ranks, ranks shown online',
    'Supercharged XP (daily bonus pool that doubles match XP, banks up to 3 days) and Supercharged rank (x1.5 rank gains and no RP loss while your MMR is well ahead of your rank)',
  ],
  next: [
    'Editing ramps and cones; carrying downed teammates',
    'Pre-match warm-up island; match replays',
    'Ziplines; weapon attachments and scopes as items',
    'World: drivable vehicles (fuel, damage, passengers), doors, NPCs, quests, vendors, currency, weapon upgrades, bosses, keycards & vaults',
    'Progression: challenges, achievements, more emotes and cosmetics; ranked seasons and rewards; a shared online leaderboard (ranks are stored per device today)',
    'Online: more than 4 players, host migration, joining a match already in progress, anti-cheat (the host is trusted)',
    'Benton Kids extras: 3-sibling co-op adventure mode with combo abilities, customizable clubhouse, garage vehicle customization, hidden family collectibles, rotating spooky/playground events',
  ],
};

const CONTROLS = [
  ['WASD', 'Move'], ['Mouse', 'Look (click the game to capture the mouse)'], ['Left click', 'Fire / swing / place / use item'], ['Right click (hold)', 'Aim down sights / scope'],
  ['Space', 'Jump · jump from bus · open glider'], ['Shift', 'Sprint (uses stamina)'], ['C / Ctrl', 'Crouch · slide while sprinting'], ['R', 'Reload · rotate ramp (build mode)'],
  ['E', 'Open chest / pick up · swap when full'], ['G', 'Drop held item'], ['1 – 5 / Wheel', 'Select slot · choose piece in build mode'], ['F', 'Pickaxe (harvest)'],
  ['B or Q', 'Toggle build mode'], ['T', 'Cycle build material'], ['V', 'Edit the build you aim at · V again confirms, R resets'], ['U', 'Repair / upgrade the build you aim at'],
  ['Hold E', 'Revive a knocked teammate · reboot at a reboot van'], ['Touch screens', 'Left thumb: move · right thumb: look · on-screen buttons for everything else'], ['Z / middle click', 'Ping'], ['M', 'Full map (click to set drop marker)'], ['N', 'Emote'], ['Esc', 'Pause'],
];

export class Menus {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.overlayHidden = true;
    this.lastResult = null;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      sfx.init();
      sfx.play('ui');
      this.act(b.dataset.act, b.dataset);
    });
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('change', (e) => this.onInput(e));
  }

  get profile() {
    return save.data.profile;
  }

  hide() {
    this.current = null;
    this.root.innerHTML = '';
    this.root.className = '';
    this.overlayHidden = true;
  }

  screen(html, cls = 'screen') {
    this.app.previewSide?.(cls.includes('right'));
    this.root.className = cls;
    this.root.innerHTML = html;
    this.overlayHidden = false;
  }

  act(a, d) {
    const P = this.profile;
    switch (a) {
      case 'play': this.app.play(); break;
      case 'main': this.showMain(); break;
      case 'chars': this.showChars(); break;
      case 'locker': this.showLocker(); break;
      case 'settings': this.showSettings(d.back || 'main'); break;
      case 'controls': this.showControls(d.back || 'main'); break;
      case 'roadmap': this.showRoadmap(); break;
      case 'pick': P.character = d.id; save.write(); this.app.preview(); this.showChars(); break;
      case 'mode': P.mode = d.id; save.write(); this.showMain(); break;
      case 'queue': P.ranked = d.id === 'ranked'; save.write(); this.showMain(); break;
      case 'ranked': this.showRanked(); break;
      case 'team': P.teamSize = +d.id; save.write(); this.showMain(); break;
      case 'bots': save.data.settings.botCount = +d.id; save.write(); this.showMain(); break;
      case 'outfit': {
        const lvl = levelInfo(save.data.progress.xp).level;
        if (CHARACTERS[P.character].outfits[+d.id].level <= lvl) { P.outfits[P.character] = +d.id; save.write(); this.app.preview(); }
        this.showLocker();
        break;
      }
      case 'skin': P.skin = +d.id; save.write(); this.app.preview(); this.showLocker(); break;
      case 'emote': this.app.previewEmote(); break;
      case 'resume': this.app.resume(); break;
      case 'fullscreen':
        try {
          const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
          if (r && r.catch) r.catch(() => {});
        } catch {
          /* not allowed here */
        }
        break;
      case 'online': this.app.online(); break;
      case 'host': this.app.hostGame(); break;
      case 'join': this.app.joinGame(d.code || this.root.querySelector('#join-code')?.value); break;
      case 'start-online': this.app.startOnline(); break;
      case 'leave-online': this.app.leaveSession(); break;
      case 'pause-back': this.showPause(); break;
      case 'quit': this.app.toLobby(); break;
      case 'again': this.app.play(); break;
      case 'spectate': this.hide(); break;
      case 'reset-progress':
        if (d.confirm) { save.data.progress = { xp: 0, wins: 0, matches: 0, kills: 0, bestPlace: 0 }; save.write(); this.showSettings('main'); }
        else this.showSettings(d.back || 'main', true);
        break;
      default: break;
    }
  }

  onInput(e) {
    const el = e.target;
    const k = el.dataset.set;
    if (!k) return;
    const S = save.data.settings;
    if (el.type === 'checkbox') S[k] = el.checked;
    else if (el.tagName === 'SELECT') S[k] = el.value;
    else if (el.type === 'range') S[k] = +el.value;
    else if (k === 'name') save.data.profile.name = el.value.slice(0, 14);
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = el.value;
    save.write();
    this.app.applySettings();
  }

  _levelBar() {
    const L = levelInfo(save.data.progress.xp);
    return `<div class="level"><div class="lvl-badge">${L.level}</div><div class="lvl-bar"><div style="width:${(L.into / L.need) * 100}%"></div></div><small>${L.into} / ${L.need} XP</small></div>${this._superXP()}`;
  }

  /** Daily Supercharged XP pool. */
  _superXP() {
    const s = superXP();
    const text = s.pool > 0 ? `<b>${s.pool.toLocaleString()}</b> XP left: match XP is doubled` : `Used up · refills in ${refillIn()}`;
    return `<div class="super-xp ${s.pool > 0 ? 'on' : ''}" title="+${DAILY_XP.toLocaleString()} every day, banks up to ${CAP_XP.toLocaleString()}"><span class="bolt">⚡</span><span class="sx-text"><small>Supercharged XP</small><span class="sx-bar"><i style="width:${(s.pool / CAP_XP) * 100}%"></i></span><small>${text}</small></span></div>`;
  }

  showMain() {
    this.current = 'main';
    const P = this.profile;
    const S = save.data.settings;
    const pr = save.data.progress;
    const ch = CHARACTERS[P.character];
    this.app.menuView();
    this.screen(`
      <div class="lobby">
        <div class="lobby-left panel">
          <h1 class="logo"><span>BENTON KIDS</span>Battle Island</h1>
          ${this._levelBar()}
          <div class="stats"><div><b>${pr.wins}</b>wins</div><div><b>${pr.matches}</b>matches</div><div><b>${pr.kills}</b>elims</div><div><b>${pr.bestPlace ? '#' + pr.bestPlace : '-'}</b>best</div></div>
          ${this._rankCard(P.mode)}
          <label class="field">Player name <input data-set="name" maxlength="14" value="${escAttr(P.name || '')}" placeholder="You"></label>
          <nav class="nav">
            <button class="btn" data-act="chars">Characters</button>
            <button class="btn" data-act="locker">Locker</button>
            <button class="btn" data-act="settings">Settings</button>
            <button class="btn" data-act="controls">Controls</button>
            <button class="btn" data-act="roadmap">Roadmap</button>
          </nav>
        </div>
        <div class="lobby-center"><div class="hero-name">${ch.name}<small>${ch.title} · ${ch.outfits[P.outfits[P.character]].name}</small></div></div>
        <div class="lobby-right panel">
          <h3>Squad</h3>
          <div class="seg four">${[[1, 'Solo'], [2, 'Duos'], [3, 'Trios'], [4, 'Squads']].map(([n, l]) => `<button class="btn ${(P.teamSize || 1) === n ? 'on' : ''}" data-act="team" data-id="${n}">${l}</button>`).join('')}</div>
          <h3>Mode</h3>
          <div class="seg two">
            <button class="btn ${P.mode === 'build' ? 'on' : ''}" data-act="mode" data-id="build">Build</button>
            <button class="btn ${P.mode === 'zerobuild' ? 'on' : ''}" data-act="mode" data-id="zerobuild">Zero Build</button>
          </div>
          <h3>Queue</h3>
          <div class="seg two">
            <button class="btn ${!P.ranked ? 'on' : ''}" data-act="queue" data-id="casual">Casual</button>
            <button class="btn ${P.ranked ? 'on' : ''}" data-act="queue" data-id="ranked">Ranked</button>
          </div>
          <h3>Bots</h3>
          <div class="seg">${[9, 19, 29].map((n) => `<button class="btn ${S.botCount === n ? 'on' : ''}" data-act="bots" data-id="${n}">${n}</button>`).join('')}</div>
          <p class="note">Bots are labelled [BOT]. Use Play Online to team up with (or battle) friends — up to 4 players per match.</p>
          <button class="btn play" data-act="play">PLAY</button>
          <button class="btn online-btn" data-act="online">Play Online</button>
        </div>
      </div>`);
  }

  showChars() {
    const P = this.profile;
    this.app.menuView();
    this.screen(`
      <div class="sheet panel wide">
        <h2>Choose your Benton Kid</h2>
        <p class="note">Everyone has the same health, speed and weapons in battle royale — pick your favourite!</p>
        <div class="cards">${CHARACTER_IDS.map((id) => {
          const c = CHARACTERS[id];
          const o = c.outfits[P.outfits[id]].c;
          return `<button class="card ${P.character === id ? 'on' : ''}" data-act="pick" data-id="${id}" style="--a:${o.top};--b:${o.top2}">
            <div class="card-art"><div class="face"></div></div><h3>${c.name}</h3><em>${c.title}</em><p>${c.bio}</p><small>Emote: ${c.emote}</small></button>`;
        }).join('')}</div>
        <div class="row"><button class="btn" data-act="locker">Locker</button><button class="btn play small" data-act="main">Done</button></div>
      </div>`, 'screen right');
  }

  showLocker() {
    const P = this.profile;
    const c = CHARACTERS[P.character];
    const lvl = levelInfo(save.data.progress.xp).level;
    this.app.menuView();
    this.screen(`
      <div class="sheet panel">
        <h2>Locker · ${c.name}</h2>
        <h3>Outfits</h3>
        <div class="outfits">${c.outfits.map((o, i) => {
          const locked = o.level > lvl;
          return `<button class="outfit ${P.outfits[P.character] === i ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="outfit" data-id="${i}" style="--a:${o.c.top};--b:${o.c.top2};--c:${o.c.pants}">
            <span class="sw"></span><b>${o.name}</b><small>${locked ? 'Unlocks at level ' + o.level : P.outfits[P.character] === i ? 'Equipped' : 'Unlocked'}</small></button>`;
        }).join('')}</div>
        <h3>Skin tone</h3>
        <div class="skins">${SKIN_TONES.map((s, i) => `<button class="skin ${P.skin === i ? 'on' : ''}" style="background:${s}" data-act="skin" data-id="${i}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>
        <h3>Emote</h3>
        <button class="btn" data-act="emote">Preview “${c.emote}”</button>
        <p class="note">Earn XP in matches to level up and unlock outfits. More cosmetics are on the roadmap.</p>
        <div class="row"><button class="btn" data-act="chars">Characters</button><button class="btn play small" data-act="main">Done</button></div>
      </div>`, 'screen right');
  }

  showSettings(back = 'main', confirmReset = false) {
    const S = save.data.settings;
    const range = (k, label, min, max, step) => `<label class="field">${label}<span class="rng"><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}"><output>${S[k]}</output></span></label>`;
    const check = (k, label) => `<label class="field check"><input type="checkbox" data-set="${k}" ${S[k] ? 'checked' : ''}> ${label}</label>`;
    this.screen(`
      <div class="sheet panel">
        <h2>Settings</h2>
        ${range('sensitivity', 'Mouse sensitivity', 0.2, 3, 0.05)}
        ${range('adsSensitivity', 'Aim-down-sights sensitivity', 0.2, 1.5, 0.05)}
        ${range('fov', 'Field of view', 60, 100, 1)}
        ${range('volume', 'Volume', 0, 1, 0.05)}
        ${check('invertY', 'Invert vertical look')}
        ${check('shadows', 'Shadows (turn off for more FPS)')}
        ${check('showFps', 'Show FPS counter')}
        <label class="field">Touch controls <select data-set="touch">${[['auto', 'Automatic'], ['on', 'Always on'], ['off', 'Off']].map(([v, l]) => `<option value="${v}" ${(S.touch || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${range('touchLook', 'Touch look speed', 0.3, 3, 0.1)}
        <p class="note">Settings and progress save automatically in this browser.</p>
        <div class="row">
          ${confirmReset ? '<button class="btn danger" data-act="reset-progress" data-confirm="1">Really reset XP & stats?</button>' : `<button class="btn" data-act="reset-progress" data-back="${back}">Reset progress</button>`}
          <button class="btn play small" data-act="${back === 'pause' ? 'pause-back' : 'main'}">Done</button>
        </div>
      </div>`, back === 'pause' ? 'screen dim' : 'screen right');
  }

  showControls(back = 'main') {
    this.screen(`
      <div class="sheet panel">
        <h2>Controls</h2>
        <div class="controls">${CONTROLS.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>
        <p class="note">If the browser blocks mouse capture, hold a mouse button and drag to look, or use the arrow keys.</p>
        <div class="row"><button class="btn play small" data-act="${back === 'pause' ? 'pause-back' : 'main'}">Done</button></div>
      </div>`, back === 'pause' ? 'screen dim' : 'screen right');
  }

  showRoadmap() {
    this.screen(`
      <div class="sheet panel wide">
        <h2>Roadmap</h2>
        <div class="cols">
          <div><h3 class="ok">Playable now (milestone 1)</h3><ul>${ROADMAP.done.map((x) => `<li>${x}</li>`).join('')}</ul></div>
          <div><h3 class="todo">Coming in later milestones</h3><ul>${ROADMAP.next.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        </div>
        <div class="row"><button class="btn play small" data-act="main">Done</button></div>
      </div>`, 'screen right');
  }

  /** Online hub: host, open games, join by code. */
  showOnline(st = {}) {
    this.current = 'online';
    const on = this.app.onlineInfo();
    let body;
    if (st.status === 'connecting') body = '<p class="note">Connecting to online play…</p>';
    else if (!on.kind) {
      body = `<p class="note">Online play isn't available in this copy of the game.</p>
        <ul class="howto">
          <li><b>claude.ai link:</b> open the game from its shared claude.ai link. Everyone who opens that link can host or join.</li>
          <li><b>Your own server:</b> run <kbd>npm run island:server</kbd> and open the address it prints on every device (same Wi-Fi works).</li>
        </ul>`;
    } else {
      const games = on.games;
      const S = save.data.settings;
      const P = this.profile;
      body = `
        <p class="note">Connected via ${on.kind === 'claude' ? 'claude.ai: everyone viewing this game link can join. Hosting needs contribute or edit access to the link' : 'the Battle Island server'}. Up to 4 players per match; bots fill the rest.</p>
        ${st.error ? `<p class="err">${escAttr(st.error)}</p>` : ''}
        <h3>Host a game</h3>
        <p class="note">Uses your lobby choices: ${P.ranked ? 'Ranked · ' : ''}${['', 'Solo', 'Duos', 'Trios', 'Squads'][P.teamSize || 1]} · ${P.mode === 'zerobuild' ? 'Zero Build' : 'Build'} · ${S.botCount + 1} players total.</p>
        <button class="btn play small" data-act="host">Host game</button>
        <h3>Open games</h3>
        <div class="games">${games.length ? games.map((g) => `<div class="game-row"><b>${escAttr(g.n)}</b><span>${g.cfg?.ranked ? 'Ranked · ' : ''}${['', 'Solo', 'Duos', 'Trios', 'Squads'][g.cfg?.team || 1]} · ${g.cfg?.mode === 'zerobuild' ? 'Zero Build' : 'Build'} · ${g.cnt} player${g.cnt === 1 ? '' : 's'}</span><button class="btn small" data-act="join" data-code="${escAttr(g.code)}">Join</button></div>`).join('') : '<p class="note">No open games yet. Host one, or ask a friend for their code.</p>'}</div>
        <h3>Join with a code</h3>
        <div class="row left"><input id="join-code" maxlength="5" placeholder="abc12" autocomplete="off"><button class="btn" data-act="join">Join</button></div>`;
    }
    this.screen(`<div class="sheet panel"><h2>Play Online</h2>${body}<div class="row"><button class="btn" data-act="main">Back</button></div></div>`, 'screen right');
  }

  /** Pre-match room: roster and start. */
  showSession(s, note = '') {
    this.current = 'session';
    const players = s.players();
    const hp = s.hostPresence();
    const inPlay = hp && hp.st === 'play';
    const cfg = s.role === 'host' ? s.cfg : hp?.cfg;
    const rows = players.map((p, i) => `<div class="player-row ${i < 4 ? '' : 'wait'}"><i style="background:${['#ffd23f', '#39f0ff', '#ff7ac8', '#7ed957'][i % 4]}"></i><b>${p.rk ? badgeHTML(p.rk[cfg && cfg.mode === 'zerobuild' ? 1 : 0][1], 20) : ''} ${escAttr(p.name)}</b><span>${p.rk ? divName(p.rk[cfg && cfg.mode === 'zerobuild' ? 1 : 0][1]) + ' · ' : ''}${CHARACTERS[p.charId]?.name || ''}${p.host ? ' · host' : ''}${p.me ? ' · you' : ''}${i >= 4 ? ' · waiting (match is full)' : ''}</span></div>`).join('');
    const host = s.role === 'host';
    this.screen(`
      <div class="sheet panel">
        <h2>Game <span class="code">${s.code.toUpperCase()}</span></h2>
        <p class="note">${cfg ? `${cfg.ranked ? 'Ranked · ' : ''}${['', 'Solo', 'Duos', 'Trios', 'Squads'][cfg.team || 1]} · ${cfg.mode === 'zerobuild' ? 'Zero Build' : 'Build'}. ` : ''}Friends join from Play Online with this code. ${cfg && cfg.team > 1 ? 'Players fill squads in this order.' : ''}</p>
        ${note ? `<p class="err">${escAttr(note)}</p>` : ''}
        <div class="players">${rows || '<p class="note">Connecting…</p>'}</div>
        ${host ? '<button class="btn play" data-act="start-online">Start match</button>' : `<p class="note">${inPlay ? 'A match is in progress. You will join the next one.' : 'Waiting for the host to start…'}</p>`}
        <div class="row"><button class="btn" data-act="leave-online">Leave</button></div>
      </div>`, 'screen right');
  }

  /** Compact rank card for the lobby. */
  _rankCard(mode) {
    const s = rankState(mode);
    const label = mode === 'zerobuild' ? 'Zero Build rank' : 'Build rank';
    const sub = s.d < 0 ? `${Math.max(0, PLACEMENT_MATCHES - s.matches)} placement match${PLACEMENT_MATCHES - s.matches === 1 ? '' : 'es'} left` : s.d >= TOP ? `${s.rp} RP` : `${s.rp}% to next`;
    const sup = isSupercharged(s) ? '<span class="sc-tag">⚡ Supercharged</span>' : '';
    return `<button class="rank-card ${sup ? 'super' : ''}" data-act="ranked" style="--rc:${divColor(s.d)}">
      ${badgeHTML(s.d, 42)}
      <span class="rk-text"><small>${label}${sup}</small><b>${divName(s.d)}</b><span class="rk-bar"><i style="width:${s.d < 0 ? (s.matches / PLACEMENT_MATCHES) * 100 : s.d >= TOP ? 100 : s.rp}%"></i></span><small>${sub} · MMR ${s.mmr}</small></span>
    </button>`;
  }

  /** Rank change on the results screen. */
  _rankResult(k) {
    const a = k.after, b = k.before;
    let head;
    if (k.placed) head = `<b class="promo">Placed: ${divName(a.d)}!</b>`;
    else if (a.d < 0) head = `<b>Placement match ${PLACEMENT_MATCHES - k.placementLeft} of ${PLACEMENT_MATCHES}</b>`;
    else if (k.promoted) head = `<b class="promo">Promoted to ${divName(a.d)}!</b>`;
    else head = `<b>${divName(a.d)}</b>`;
    const rp = a.d < 0 ? '' : `<span class="${k.dRP >= 0 ? 'up' : 'down'}">${k.dRP >= 0 ? '+' : ''}${k.dRP} RP</span>`;
    const sup = k.supercharged ? `<span class="sc-tag">⚡ Supercharged ×${SUPER_MULT}</span>` : k.stillSupercharged ? '<span class="sc-tag">⚡ Supercharged next match</span>' : '';
    const pct = a.d < 0 ? ((PLACEMENT_MATCHES - k.placementLeft) / PLACEMENT_MATCHES) * 100 : a.d >= TOP ? 100 : a.rp;
    return `<div class="rank-result" style="--rc:${divColor(a.d)}">
      ${badgeHTML(b.d, 34)}<span class="arrow">→</span>${badgeHTML(a.d, 46)}
      <div class="rk-text">${head}<span class="rk-bar"><i style="width:${pct}%"></i></span>
      <small>${rp} <span class="${k.dMMR >= 0 ? 'up' : 'down'}">MMR ${k.dMMR >= 0 ? '+' : ''}${k.dMMR}</span> (now ${a.mmr})</small>${sup}</div>
    </div>`;
  }

  showRanked() {
    this.current = 'ranked';
    const card = (mode, title) => {
      const s = rankState(mode);
      const hist = s.history.length ? s.history.map((h) => `<tr><td>${h.won ? '#1' : `#${h.place}/${h.total}`}</td><td>${h.kills}</td><td class="${h.dRP >= 0 ? 'up' : 'down'}">${h.d < 0 && !h.dRP ? '—' : (h.dRP >= 0 ? '+' : '') + h.dRP}${h.sup ? ' ⚡' : ''}</td><td class="${h.dMMR >= 0 ? 'up' : 'down'}">${h.dMMR >= 0 ? '+' : ''}${h.dMMR}</td></tr>`).join('') : '<tr><td colspan="4">No ranked matches yet</td></tr>';
      return `<div class="rank-panel" style="--rc:${divColor(s.d)}">
        <div class="rank-head">${badgeHTML(s.d, 64)}<div><small>${title}${isSupercharged(s) ? ' <span class="sc-tag">⚡ Supercharged</span>' : ''}</small><h3>${divName(s.d)}</h3><span class="rk-bar"><i style="width:${s.d < 0 ? (s.matches / PLACEMENT_MATCHES) * 100 : s.d >= TOP ? 100 : s.rp}%"></i></span>
        <small>${s.d < 0 ? `Placement: ${s.matches}/${PLACEMENT_MATCHES} matches` : s.d >= TOP ? `${s.rp} RP` : `${s.rp} / 100 RP`}</small></div></div>
        <div class="stats"><div><b>${s.mmr}</b>MMR</div><div><b>${s.matches}</b>matches</div><div><b>${divName(s.peak).replace(' ', '&nbsp;')}</b>peak</div><div><b>${lobbyLabel(s.mmr)}</b>lobbies</div></div>
        <table class="hist"><tr><th>Place</th><th>Elims</th><th>RP</th><th>MMR</th></tr>${hist}</table>
      </div>`;
    };
    const ladder = Array.from({ length: TOP + 1 }, (_, d) => `<span class="ladder-step" style="--rc:${divColor(d)}" title="about ${divisionMMR(d)} MMR">${badgeHTML(d, 22)}${divName(d)}</span>`).join('');
    this.screen(`
      <div class="sheet panel wide">
        <h2>Ranked</h2>
        <div class="cols">${card('build', 'Build')}${card('zerobuild', 'Zero Build')}</div>
        <h3>How it works</h3>
        <ul class="howto">
          <li><b>MMR</b> (matchmaking rating) is your skill score. It goes up when you place better than expected and down when you place worse. In Ranked, the bots you face are tuned to your MMR. Online, they're tuned to the average MMR of the players in the lobby.</li>
          <li><b>Rank</b> is earned with rank points: 100 RP per division. Placement and eliminations earn RP. Each match costs a little entry RP, and the cost grows with rank. If your MMR is higher than your rank, you gain faster (and lose less) until your rank catches up.</li>
          <li><b>⚡ Supercharged rank:</b> when your MMR is at least ${SUPER_LEAD} ahead of your rank (about 1.5 divisions), rank gains are ×${SUPER_MULT} and matches never cost RP. It switches off once your rank catches up.</li>
          <li>Your first ${PLACEMENT_MATCHES} matches are placement matches. You can lose progress, but you never drop a division. Leaving a match early counts as being eliminated.</li>
          <li>Build and Zero Build have separate ranks. Ranks are saved on this device.</li>
        </ul>
        <div class="ladder">${ladder}</div>
        <div class="row"><button class="btn play small" data-act="main">Done</button></div>
      </div>`, 'screen right');
  }

  showPause() {
    this.screen(`
      <div class="sheet panel small-sheet">
        <h2>Paused</h2>
        <div class="stack">
          <button class="btn play" data-act="resume">Resume</button>
          <button class="btn" data-act="fullscreen">Full screen</button>
          <button class="btn" data-act="settings" data-back="pause">Settings</button>
          <button class="btn" data-act="controls" data-back="pause">Controls</button>
          <button class="btn danger" data-act="quit">Leave match</button>
        </div>
      </div>`, 'screen dim');
  }

  showResult(r) {
    this.lastResult = r;
    const pr = save.data.progress;
    const L = levelInfo(pr.xp);
    this.screen(`
      <div class="sheet panel result ${r.won ? 'win' : ''}">
        ${r.won ? `<div class="crown">#1</div><h1 class="big">${r.team ? 'BENTON SQUAD CHAMPIONS!' : 'BENTON CHAMPION!'}</h1>` : `<h1 class="big">#${r.place} <small>of ${r.total} ${r.team ? 'squads' : ''}</small></h1><p class="sub">${r.team ? 'Your squad was eliminated' : r.killer ? `Eliminated by ${escAttr(r.killer)}` : 'Eliminated'}</p>`}
        <div class="stats"><div><b>${r.kills}</b>elims</div><div><b>${r.damage}</b>damage</div><div><b>${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}</b>survived</div><div><b>+${r.xp}</b>XP</div></div>
        ${r.superXP ? `<p class="sx-won">⚡ +${r.superXP.toLocaleString()} Supercharged XP (included)</p>` : ''}
        ${r.levelUp ? `<p class="lvlup">Level up! You reached level ${r.levelUp}.</p>` : ''}
        ${r.ranked ? this._rankResult(r.ranked) : ''}
        <div class="level"><div class="lvl-badge">${L.level}</div><div class="lvl-bar"><div style="width:${(L.into / L.need) * 100}%"></div></div><small>${L.into} / ${L.need} XP</small></div>
        <div class="row">
          ${!r.won && this.app.matchRunning() ? '<button class="btn" data-act="spectate">Spectate</button>' : ''}
          <button class="btn play small" data-act="again">Play again</button>
          <button class="btn" data-act="quit">Lobby</button>
        </div>
      </div>`, 'screen dim');
    this.app.releaseLock();
  }

  showResultAgain() {
    if (this.lastResult) this.showResult(this.lastResult);
  }

  showMatchOver(w, team) {
    const r = this.lastResult;
    this.screen(`
      <div class="sheet panel result">
        <h1 class="big">${w ? escAttr(w.name) + (team ? "'s squad" : '') : 'Nobody'} wins!</h1>
        ${r ? `<p class="sub">You placed #${r.place} with ${r.kills} elims (+${r.xp} XP)</p>` : ''}
        <div class="row"><button class="btn play small" data-act="again">Play again</button><button class="btn" data-act="quit">Lobby</button></div>
      </div>`, 'screen dim');
    this.app.releaseLock();
  }
}

function escAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
