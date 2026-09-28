/**
 * Menu screens: lobby, character select, locker, settings, controls, roadmap,
 * pause, and the elimination / victory / match-over results. Every visible
 * button is wired to a working action.
 */

import { CHARACTERS, CHARACTER_IDS, SKIN_TONES } from '../entities/characters.js';
import { save, levelInfo } from '../core/save.js';
import { rankState, divName, divColor, divisionMMR, badgeHTML, TOP, PLACEMENT_MATCHES, lobbyLabel, isSupercharged, SUPER_LEAD, SUPER_MULT } from '../core/ranked.js';
import { superXP, refillIn, CAP_XP, DAILY_XP } from '../core/supercharge.js';
import { dailyChallenges, CHALLENGES, CHALLENGE_XP } from '../core/challenges.js';
import { owner } from '../core/owner.js';
import { matchOp, progressOp, canAdminMatch, PLACES } from '../gameplay/admin.js';
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
    'Milestone 4 — Wheels & Deals: drivable Diesel Trucks (4 seats) and Pickle Karts (boost) with fuel, pumps, damage, explosions and run-over hits; passengers can shoot; bot teammates ride along',
    'Ziplines between high points (shoot while riding), Benton Bucks from chests, floor loot and eliminations, three vending bots, two weapon upgrade benches, and three daily challenges worth bonus XP',
    "Milestone 5 — Boss & Vault: Crankbolt, a giant rocket-firing guard robot (drops the Vault Keycard and a Mythic rifle); Crankbolt's Vault on its hilltop; doors on every house; carrying knocked teammates",
    'Admin panel for the owner: progression tools in the lobby, match tools in the pause menu (god mode, teleports, storm, bots, boss, vault); admin matches never count for XP, rank or challenges',
  ],
  next: [
    'Editing ramps and cones',
    'Pre-match warm-up island; match replays',
    'Weapon attachments and scopes as items',
    'World: story NPCs and quests, more bosses and vaults; bots that drive',
    'Progression: weekly challenges, achievements, more emotes and cosmetics; ranked seasons and rewards; a shared online leaderboard (ranks are stored per device today)',
    'Online: more than 4 players, host migration, joining a match already in progress, anti-cheat (the host is trusted)',
    'Benton Kids extras: 3-sibling co-op adventure mode with combo abilities, customizable clubhouse, garage vehicle customization, hidden family collectibles, rotating spooky/playground events',
  ],
};

const CONTROLS = [
  ['WASD', 'Move'], ['Mouse', 'Look (click the game to capture the mouse)'], ['Left click', 'Fire / swing / place / use item'], ['Right click (hold)', 'Aim down sights / scope'],
  ['Space', 'Jump · jump from bus · open glider'], ['Shift', 'Sprint (uses stamina)'], ['C / Ctrl', 'Crouch · slide while sprinting'], ['R', 'Reload · rotate ramp (build mode)'],
  ['E', 'Open chest / pick up · swap when full'], ['G', 'Drop held item'], ['1 – 5 / Wheel', 'Select slot · choose piece in build mode'], ['F', 'Pickaxe (harvest)'],
  ['B or Q', 'Toggle build mode'], ['T', 'Cycle build material'], ['V', 'Edit the build you aim at · V again confirms, R resets'], ['U', 'Repair / upgrade the build you aim at'],
  ['Hold E', 'Revive a knocked teammate · reboot at a reboot van'],
  ['E (near a vehicle)', 'Drive / ride · E again to hop out'], ['W/S · A/D (driving)', 'Throttle / brake · steer'], ['Shift (kart) · H', 'Boost · horn'],
  ['E (zipline tower)', 'Ride the zipline · Space lets go'], ['E (vending bot)', 'Open the shop · 1–3 buy with Benton Bucks'], ['E (upgrade bench)', 'Upgrade the held weapon'],
  ['E (door)', 'Open / close'], ['E (vault door)', 'Open with the Vault Keycard'], ['X', 'Carry / put down a knocked teammate'], ['Touch screens', 'Left thumb: move · right thumb: look · on-screen buttons for everything else'], ['Z / middle click', 'Ping'], ['M', 'Full map (click to set drop marker)'], ['N', 'Emote'], ['Esc', 'Pause'],
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
      case 'admin': if (owner.is) this.showAdmin(); break;
      case 'admin-match': if (owner.is) this.showAdminMatch(); break;
      case 'adm': {
        if (!owner.is) break;
        if (d.scope === 'match') {
          const g = this.app.game;
          const had = !!g.result;
          const msg = matchOp(g, d.op, d.arg);
          if (!had && g.result) {
            g.paused = false; // that ended the match: the result screen is showing
            break;
          }
          this.showAdminMatch(msg);
        }
        else {
          const sel = this.root.querySelector('#adm-rank');
          // "Set rank" reads the dropdown; other buttons carry their own value
          this.showAdmin(progressOp(d.op, d.op === 'rank' && d.arg === '' ? sel?.value : d.arg, P.mode));
        }
        break;
      }
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

  /** Today's challenges (lobby card, or the result rows after a match). */
  _challenges(rows = null) {
    const list = rows || dailyChallenges().list.map((c) => ({ ...c, text: CHALLENGES[c.id].text, goal: CHALLENGES[c.id].goal }));
    const row = (c) => `<div class="chal ${c.done ? 'done' : ''}"><div class="ch-row"><b>${c.done ? '✓ ' : ''}${c.text}</b><span>${c.justDone ? `+${CHALLENGE_XP.toLocaleString()} XP!` : c.done ? 'Done' : `${c.prog.toLocaleString()} / ${c.goal.toLocaleString()}`}</span></div><span class="rk-bar"><i style="width:${(c.prog / c.goal) * 100}%"></i></span></div>`;
    return `<div class="chal-card ${rows ? 'chal-result' : ''}"><h4>Daily challenges <small>${rows ? '' : `+${CHALLENGE_XP.toLocaleString()} XP each · new in ${refillIn()}`}</small></h4>${list.map(row).join('')}</div>`;
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
          ${this._challenges()}
          <label class="field">Player name <input data-set="name" maxlength="14" value="${escAttr(P.name || '')}" placeholder="You"></label>
          <nav class="nav">
            <button class="btn" data-act="chars">Characters</button>
            <button class="btn" data-act="locker">Locker</button>
            <button class="btn" data-act="settings">Settings</button>
            <button class="btn" data-act="controls">Controls</button>
            <button class="btn" data-act="roadmap">Roadmap</button>
            ${owner.is ? '<button class="btn admin-btn" data-act="admin">Admin</button>' : ''}
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
          <div><h3 class="ok">Playable now</h3><ul>${ROADMAP.done.map((x) => `<li>${x}</li>`).join('')}</ul></div>
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

  /** Owner-only: progression tools for this device, plus where to find match tools. */
  showAdmin(msg = '') {
    this.current = 'admin';
    const P = this.profile;
    const L = levelInfo(save.data.progress.xp);
    const b = (op, label, arg = '') => `<button class="btn small" data-act="adm" data-scope="progress" data-op="${op}" data-arg="${arg}">${label}</button>`;
    const rs = rankState(P.mode);
    const opts = Array.from({ length: TOP + 2 }, (_, i) => i - 1).map((d) => `<option value="${d}" ${d === rs.d ? 'selected' : ''}>${divName(d)}</option>`).join('');
    const c = dailyChallenges();
    this.screen(`
      <div class="sheet panel wide admin">
        <h2>Admin <small>owner only · ${escAttr(owner.how)}</small></h2>
        ${msg ? `<p class="adm-msg">${escAttr(msg)}</p>` : ''}
        <div class="cols">
          <div>
            <h3>Level & XP <small>level ${L.level} · ${save.data.progress.xp.toLocaleString()} XP</small></h3>
            <div class="adm-grid">${b('level', '+1 level', 1)}${b('level', '+10 levels', 10)}${b('outfits', 'Unlock every outfit')}${b('super', 'Refill Supercharged XP')}</div>
            <h3>Daily challenges <small>${c.list.filter((x) => x.done).length}/3 done</small></h3>
            <div class="adm-grid">${b('chal-done', 'Mark today\'s done')}${b('chal-reset', 'Reset today\'s progress')}</div>
          </div>
          <div>
            <h3>${P.mode === 'zerobuild' ? 'Zero Build' : 'Build'} rank <small>${divName(rs.d)} · ${rs.rp}% · MMR ${rs.mmr}</small></h3>
            <div class="adm-grid"><select id="adm-rank">${opts}</select>${b('rank', 'Set rank')}</div>
            <div class="adm-grid">${b('rp', 'Progress 0%', 0)}${b('rp', 'Progress 50%', 50)}${b('rp', 'Progress 95%', 95)}${b('rank', 'Reset to Unranked', -1)}</div>
            <p class="note">Switch Build / Zero Build in the lobby to edit the other rank.</p>
          </div>
        </div>
        <h3>Match tools</h3>
        <p class="note">God mode, loadouts, teleports, the storm, bots, Crankbolt and the vault are in the <b>pause menu → Admin</b> during a match (or press <kbd>\`</kbd>). They work in solo matches and matches you host, and a match where they're used doesn't count for XP, rank or challenges.</p>
        <div class="row"><button class="btn play small" data-act="main">Done</button></div>
      </div>`, 'screen right');
  }

  /** Owner-only: tools for the match this device is running. */
  showAdminMatch(msg = '') {
    this.current = 'admin-match';
    const g = this.app.game;
    const ok = canAdminMatch(g);
    const A = (g && g.admin) || {};
    const b = (op, label, arg = '', on = false) => `<button class="btn small ${on ? 'on' : ''}" data-act="adm" data-scope="match" data-op="${op}" data-arg="${arg}">${label}</button>`;
    const body = ok ? `
        <div class="cols">
          <div>
            <h3>You</h3>
            <div class="adm-grid">${b('god', `God mode: ${A.god ? 'ON' : 'off'}`, '', A.god)}${b('heal', 'Full health + shields')}${b('loadout', 'Starter loadout')}${b('mythic', 'Mythic weapons')}${b('mats', 'Max materials')}${b('bucks', '+500 Bucks')}${b('keycard', 'Vault Keycard')}</div>
            <h3>Teleport</h3>
            <div class="adm-grid">${b('tp', 'To map marker', 'marker')}${PLACES.map((p) => b('tp', escAttr(p.name), p.id)).join('')}</div>
          </div>
          <div>
            <h3>World</h3>
            <div class="adm-grid">${b('storm-skip', 'Storm: next step')}${b('storm-pause', `Storm: ${A.stormPaused ? 'paused' : 'running'}`, '', A.stormPaused)}${b('supply', 'Supply drop here')}${b('vehicle', 'Bring a truck', 'truck')}${b('vehicle', 'Bring a kart', 'kart')}${b('vault', 'Open the vault')}</div>
            <h3>Bots & boss</h3>
            <div class="adm-grid">${b('freeze', `Bots: ${A.freezeBots ? 'frozen' : 'moving'}`, '', A.freezeBots)}${b('clear-bots', 'Remove opposing bots')}${b('boss-kill', 'Defeat Crankbolt')}${b('boss-reset', 'Reset Crankbolt')}</div>
            ${g.role === 'solo' ? `<h3>Game speed</h3><div class="adm-grid">${['0.5', '1', '2'].map((s) => b('speed', `×${s}`, s, String(g.engine.timeScale) === s)).join('')}</div>` : ''}
          </div>
        </div>
        <p class="note">${g.adminUsed ? 'Admin tools are on: this match won\'t count for XP, rank or challenges.' : 'Using any of these means this match won\'t count for XP, rank or challenges.'}${g.role === 'host' ? ' Everyone in the match is told when you use them.' : ''}</p>`
      : `<p class="note">You're a guest in someone else's match, so admin tools can't touch it. They work in solo matches and matches you host.</p>`;
    this.screen(`
      <div class="sheet panel wide admin">
        <h2>Admin <small>match tools</small></h2>
        ${msg ? `<p class="adm-msg">${escAttr(msg)}</p>` : ''}
        ${body}
        <div class="row"><button class="btn play small" data-act="resume">Resume</button><button class="btn" data-act="pause-back">Back</button></div>
      </div>`, 'screen dim');
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
          ${owner.is ? '<button class="btn admin-btn" data-act="admin-match">Admin</button>' : ''}
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
        ${r.admin ? '<p class="adm-note">Admin tools were used in this match, so it doesn\'t count for XP, rank or challenges.</p>' : ''}
        ${r.challenges ? this._challenges(r.challenges) : ''}
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
