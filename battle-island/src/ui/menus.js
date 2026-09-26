/**
 * Menu screens: lobby, character select, locker, settings, controls, roadmap,
 * pause, and the elimination / victory / match-over results. Every visible
 * button is wired to a working action.
 */

import { CHARACTERS, CHARACTER_IDS, SKIN_TONES } from '../entities/characters.js';
import { save, levelInfo } from '../core/save.js';
import { sfx } from '../core/audio.js';

export const ROADMAP = {
  done: [
    'Solo battle royale vs labelled bots: lobby → Benton Bus → drop → loot → storm → victory/elimination → replay',
    'Colton, Emerson & Waylon: distinct models, outfits, backpacks, animations and emotes; equal combat stats',
    'Island with Benton Diesel Garage, Pickles Park, Haunt Hollow, Boom Co. Depot, Benton Kids Clubhouse, 4 cabins, roads, pond',
    'Walk-in buildings with stairs and upper floors, roofs, destructible walls, secret legendary chests (pickle statue, Haunt Hollow crypt)',
    'Skydiving, glider, map drop marker, bounce pads with glider redeploy',
    'Third-person camera with collision, sensitivity/ADS sensitivity/FOV settings',
    'Sprint + stamina, crouch, slide, jump, mantle/hurdle, swimming, fall damage',
    '6 weapons (rifle, SMG, pump, pistol, sniper w/ scope + bullet drop, launcher) + Boom Ball grenades; rarities, mags, reloads, ammo types, recoil, bloom, ADS, headshots',
    'Pickaxe harvesting (wood/brick/metal); build walls/floors/ramps/cones on a snapping grid with previews, rapid place, ramp rotation, costs, health, destruction, ownership',
    'Zero Build mode with regenerating overshield',
    '5 slots, stacking, swapping, dropping, separate ammo/material storage, chests, floor loot, supply drops, 5 healing/shield items with use times + interruption',
    'Storm with 6 shrinking phases and rising damage; explosive Boom barrels',
    'Bots that drop, loot, harvest, fight, wall up, heal, dance, break walls and rotate with the storm',
    'HUD: health/shield, inventory, ammo, materials, minimap, full map, compass, storm timer, players left, elims, killfeed, damage numbers',
    'XP, levels, outfit unlocks by level, saved settings and progression',
  ],
  next: [
    'Building: edit mode (window/door/arch cuts) with confirm/reset, repair, upgrade, structural integrity',
    'Match flow: pre-match warm-up island, duo/trio/squad rules, replay recording',
    'Teams: squadmates (bots), pings, downed/revive, carrying, reboot cards & vans',
    'Movement: ziplines',
    'Attachments/scopes as items',
    'World: drivable vehicles (fuel, damage, passengers), opening doors, NPCs, quests, vendors, currency, weapon upgrades, bosses, keycards & vaults',
    'Progression: challenges, achievements, more emotes and cosmetics',
    'Online multiplayer (needs a real, tested networking backend — not started)',
    'Benton Kids extras: 3-sibling co-op adventure mode with combo abilities, customizable clubhouse, garage vehicle customization, hidden family collectibles, rotating spooky/playground events',
  ],
};

const CONTROLS = [
  ['WASD', 'Move'], ['Mouse', 'Look (click the game to capture the mouse)'], ['Left click', 'Fire / swing / place / use item'], ['Right click (hold)', 'Aim down sights / scope'],
  ['Space', 'Jump · jump from bus · open glider'], ['Shift', 'Sprint (uses stamina)'], ['C / Ctrl', 'Crouch · slide while sprinting'], ['R', 'Reload · rotate ramp (build mode)'],
  ['E', 'Open chest / pick up · swap when full'], ['G', 'Drop held item'], ['1 – 5 / Wheel', 'Select slot · choose piece in build mode'], ['F', 'Pickaxe (harvest)'],
  ['B or Q', 'Toggle build mode'], ['T', 'Cycle build material'], ['M', 'Full map (click to set drop marker)'], ['N', 'Emote'], ['Esc', 'Pause'],
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
    else if (el.type === 'range') S[k] = +el.value;
    else if (k === 'name') save.data.profile.name = el.value.slice(0, 14);
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = el.value;
    save.write();
    this.app.applySettings();
  }

  _levelBar() {
    const L = levelInfo(save.data.progress.xp);
    return `<div class="level"><div class="lvl-badge">${L.level}</div><div class="lvl-bar"><div style="width:${(L.into / L.need) * 100}%"></div></div><small>${L.into} / ${L.need} XP</small></div>`;
  }

  showMain() {
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
          <h3>Mode</h3>
          <div class="seg">
            <button class="btn ${P.mode === 'build' ? 'on' : ''}" data-act="mode" data-id="build">Solo · Build</button>
            <button class="btn ${P.mode === 'zerobuild' ? 'on' : ''}" data-act="mode" data-id="zerobuild">Solo · Zero Build</button>
          </div>
          <h3>Bots</h3>
          <div class="seg">${[9, 19, 29].map((n) => `<button class="btn ${S.botCount === n ? 'on' : ''}" data-act="bots" data-id="${n}">${n}</button>`).join('')}</div>
          <p class="note">All opponents are computer-controlled bots and are labelled [BOT]. Online multiplayer is on the roadmap.</p>
          <button class="btn play" data-act="play">PLAY</button>
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

  showPause() {
    this.screen(`
      <div class="sheet panel small-sheet">
        <h2>Paused</h2>
        <div class="stack">
          <button class="btn play" data-act="resume">Resume</button>
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
        ${r.won ? '<div class="crown">#1</div><h1 class="big">BENTON CHAMPION!</h1>' : `<h1 class="big">#${r.place} <small>of ${r.total}</small></h1><p class="sub">${r.killer ? `Eliminated by ${escAttr(r.killer)}` : 'Eliminated'}</p>`}
        <div class="stats"><div><b>${r.kills}</b>elims</div><div><b>${r.damage}</b>damage</div><div><b>${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}</b>survived</div><div><b>+${r.xp}</b>XP</div></div>
        ${r.levelUp ? `<p class="lvlup">Level up! You reached level ${r.levelUp}.</p>` : ''}
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

  showMatchOver(w) {
    const r = this.lastResult;
    this.screen(`
      <div class="sheet panel result">
        <h1 class="big">${w ? escAttr(w.name) : 'Nobody'} wins!</h1>
        ${r ? `<p class="sub">You placed #${r.place} with ${r.kills} elims (+${r.xp} XP)</p>` : ''}
        <div class="row"><button class="btn play small" data-act="again">Play again</button><button class="btn" data-act="quit">Lobby</button></div>
      </div>`, 'screen dim');
    this.app.releaseLock();
  }
}

function escAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
