/**
 * In-match HUD: health/shield/overshield, stamina, materials, inventory,
 * ammo, minimap + full map (click to mark a drop point), compass, storm
 * timer, players left, eliminations, killfeed, crosshair with live spread,
 * hitmarkers, damage numbers, prompts, build bar, scope and storm tint.
 */

import * as THREE from 'three';
import { WEAPONS, RARITIES, CONSUMABLES, THROWABLES, AMMO, BUFFS, itemName } from '../gameplay/items.js';
import { REVIVE_TIME, REBOOT_TIME } from '../gameplay/teams.js';
import { lobbyLabel } from '../core/ranked.js';
import { PIECE_NAMES, PIECES } from '../gameplay/building.js';
import { ISLAND_SIZE } from '../world/island.js';
import { save } from '../core/save.js';

const SHORT = { ar: 'RIFLE', smg: 'SMG', shotgun: 'PUMP', pistol: 'PISTOL', sniper: 'SNIPER', launcher: 'BOOM', boomball: 'BOOM BALL', bandage: 'BAND-AID', medkit: 'MEDKIT', minishield: 'JUICE', bigshield: 'BIG SHIELD', pickle: 'PICKLE', zoom: 'ZOOM', bounce: 'BOUNCE', spicy: 'SPICY', snack: 'SNACK' };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const _v = new THREE.Vector3();
export const TEAM_COLORS = ['#ffd23f', '#39f0ff', '#ff7ac8', '#7ed957'];

export class Hud {
  constructor(root, menus) {
    this.root = root;
    this.menus = menus;
    root.innerHTML = `
      <div class="hud-tl">
        <canvas class="minimap" width="190" height="190"></canvas>
        <div class="storm-info"><span class="storm-label">Storm</span><b class="storm-time">0:00</b></div>
        <div class="counts"><span class="pill"><i class="ico-alive"></i><b class="n-alive">0</b> <span class="alive-label">left</span></span><span class="pill"><i class="ico-kill"></i><b class="n-kills">0</b> elims</span></div>
        <div class="ranked-pill"></div>
        <div class="team"></div>
      </div>
      <div class="markers"></div>
      <div class="compass"><div class="compass-strip"></div><div class="compass-mark"></div></div>
      <div class="killfeed"></div>
      <div class="toasts"></div>
      <div class="banner"></div>
      <div class="crosshair"><i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><b class="c-dot"></b></div>
      <div class="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="hurtdir"></div>
      <div class="prompt"><kbd>E</kbd><span></span></div>
      <div class="buildinfo"><div class="bhp"><div></div></div><span></span></div>
      <div class="downed"><b>KNOCKED DOWN</b><div class="bar"><div class="fill"></div></div><small>Crawl to cover · your team can revive you · Z to ping</small></div>
      <div class="usebar"><div class="usefill"></div><span class="uselabel"></span></div>
      <div class="hud-bl">
        <div class="buffs"></div>
        <div class="bars">
          <div class="bar over"><div class="fill"></div><span></span></div>
          <div class="bar shield"><div class="fill"></div><span></span></div>
          <div class="bar health"><div class="fill"></div><span></span></div>
          <div class="bar stamina"><div class="fill"></div></div>
        </div>
      </div>
      <div class="hud-br">
        <div class="mats"></div>
        <div class="ammo-big"><b class="mag">-</b><span class="reserve"></span></div>
        <div class="slots"></div>
        <div class="ammo-list"></div>
      </div>
      <div class="buildbar"></div>
      <div class="bus-hint"></div>
      <div class="dmgnums"></div>
      <div class="storm-tint"></div>
      <div class="hurt-tint"></div>
      <div class="scope"><div class="scope-ring"></div></div>
      <div class="bigmap hidden"><div class="bigmap-card"><div class="bigmap-title">Battle Island <small>Click to place your drop marker · M to close</small></div><canvas width="620" height="620"></canvas><button class="btn small clear-marker">Clear marker</button></div></div>
      <div class="spectate-bar hidden"><span>Spectating <b class="spec-name"></b></span><button class="btn small spec-next">Next player <kbd>Space</kbd></button><button class="btn small spec-results">Results</button><button class="btn small spec-leave">Leave match</button></div>
      <div class="fps"></div>
    `;
    const q = (s) => root.querySelector(s);
    this.el = {
      mini: q('.minimap'), stormLabel: q('.storm-label'), stormTime: q('.storm-time'), alive: q('.n-alive'), kills: q('.n-kills'),
      compass: q('.compass-strip'), killfeed: q('.killfeed'), toasts: q('.toasts'), banner: q('.banner'), cross: q('.crosshair'),
      hit: q('.hitmarker'), hurtdir: q('.hurtdir'), prompt: q('.prompt'), promptText: q('.prompt span'), use: q('.usebar'), useFill: q('.usefill'), useLabel: q('.uselabel'),
      over: q('.bar.over'), shield: q('.bar.shield'), health: q('.bar.health'), stamina: q('.bar.stamina'), mats: q('.mats'), mag: q('.mag'), reserve: q('.reserve'),
      slots: q('.slots'), ammoList: q('.ammo-list'), build: q('.buildbar'), busHint: q('.bus-hint'), dmg: q('.dmgnums'), stormTint: q('.storm-tint'), hurtTint: q('.hurt-tint'),
      team: q('.team'), markers: q('.markers'), buffs: q('.buffs'), bi: q('.buildinfo'), biBar: q('.buildinfo .bhp div'), biText: q('.buildinfo span'),
      rankedPill: q('.ranked-pill'),
      downed: q('.downed'), downFill: q('.downed .fill'), aliveLabel: q('.alive-label'), specResults: q('.spec-results'),
      scope: q('.scope'), bigmap: q('.bigmap'), bigCanvas: q('.bigmap canvas'), spec: q('.spectate-bar'), specName: q('.spec-name'), fps: q('.fps'),
    };
    this.ctx = this.el.mini.getContext('2d');
    this.bctx = this.el.bigCanvas.getContext('2d');
    this.cache = {};
    this.hurtT = 0;
    this.hitT = 0;
    this.frame = 0;
    // compass ticks
    let strip = '';
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let rep = 0; rep < 3; rep++) {
      for (let d = 0; d < 360; d += 15) strip += `<span class="${names[d] ? 'major' : ''}">${names[d] || (d % 45 ? '·' : d)}</span>`;
    }
    this.el.compass.innerHTML = strip;
    this.el.bigCanvas.addEventListener('mousedown', (e) => {
      const r = this.el.bigCanvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * ISLAND_SIZE;
      const z = ((e.clientY - r.top) / r.height - 0.5) * ISLAND_SIZE;
      this.game?.setMarker(x, z);
    });
    q('.clear-marker').addEventListener('click', () => this.game?.setMarker(null));
    this.el.bigmap.addEventListener('mousedown', (e) => {
      if (e.target === this.el.bigmap) this.toggleMap(false);
    });
    q('.spec-next').addEventListener('click', () => this.game?.controller.nextSpectate());
    q('.spec-results').addEventListener('click', () => this.menus.showResultAgain());
    q('.spec-leave').addEventListener('click', () => this.menus.act('quit', {}));
    this.show(false);
  }

  show(on) {
    this.root.style.display = on ? '' : 'none';
  }

  onMatchStart(game) {
    this.game = game;
    this.el.killfeed.innerHTML = '';
    this.el.toasts.innerHTML = '';
    this.el.spec.classList.add('hidden');
    this.el.bigmap.classList.add('hidden');
    this.cache = {};
  }

  toggleMap(force) {
    const hide = force !== undefined ? !force : !this.el.bigmap.classList.contains('hidden');
    this.el.bigmap.classList.toggle('hidden', hide);
    if (!hide) this.game?.input.releaseLock();
  }

  get mapOpen() {
    return !this.el.bigmap.classList.contains('hidden');
  }

  toast(text, color = '#fff', dur = 2.5) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    d.style.color = color;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.classList.add('out'), dur * 1000);
    setTimeout(() => d.remove(), dur * 1000 + 500);
  }

  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  matGain(mat, n) {
    if (n > 0) this.toast(`+${n} ${mat}`, '#ffe9b0', 0.9);
  }

  hitmarker(head, shieldOnly) {
    const h = this.el.hit;
    h.className = 'hitmarker show' + (head ? ' head' : shieldOnly ? ' shield' : '');
    clearTimeout(this._hitTo);
    this._hitTo = setTimeout(() => (h.className = 'hitmarker'), 140);
  }

  damageNumber(pos, amount, head, shield) {
    const cam = this.game.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'dmg' + (head ? ' head' : shield ? ' shield' : '');
    d.textContent = amount;
    d.style.left = `${(_v.x * 0.5 + 0.5) * 100 + (Math.random() - 0.5) * 3}%`;
    d.style.top = `${(-_v.y * 0.5 + 0.5) * 100}%`;
    this.el.dmg.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }

  hurt(srcPos, storm) {
    this.hurtT = storm ? 0.25 : 0.5;
    if (srcPos && this.game) {
      const p = this.game.player.pos;
      const ang = Math.atan2(-(srcPos.x - p.x), -(srcPos.z - p.z));
      const rel = ang - this.game.controller.yaw;
      this.el.hurtdir.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`;
      this.el.hurtdir.classList.remove('show');
      void this.el.hurtdir.offsetWidth;
      this.el.hurtdir.classList.add('show');
    }
  }

  killfeed(m, player) {
    const d = document.createElement('div');
    d.className = 'kf';
    const mine = (n) => (player && n === player.name ? ' me' : '');
    const icon = { headshot: '◎', boom: '✹', elim: '➤', storm: '☁', fall: '↓', out: '✖', knock: '▼', reboot: '↻' }[m.how] || '➤';
    if (m.how === 'reboot') d.innerHTML = `<b class="${mine(m.a)}">${esc(m.a)}</b> <i>${icon}</i> rebooted <b>${esc(m.b)}</b>`;
    else if (m.how === 'knock') d.innerHTML = m.a ? `<b class="${mine(m.a)}">${esc(m.a)}</b> <i>${icon}</i> knocked <b class="${mine(m.b)}">${esc(m.b)}</b>` : `<b class="${mine(m.b)}">${esc(m.b)}</b> <i>${icon}</i> was knocked down`;
    else d.innerHTML = m.a ? `<b class="${mine(m.a)}">${esc(m.a)}</b> <i>${icon}</i> <b class="${mine(m.b)}">${esc(m.b)}</b>` : `<b class="${mine(m.b)}">${esc(m.b)}</b> <i>${icon}</i> ${m.how === 'storm' ? 'lost to the storm' : m.how === 'fall' ? 'fell too far' : 'was eliminated'}`;
    this.el.killfeed.prepend(d);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 6000);
  }

  playerResult(r) {
    this.menus.showResult(r);
  }

  matchOver(winner, team) {
    this.menus.showMatchOver(winner, team);
  }

  set(key, el, val, prop = 'textContent') {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el[prop] = val;
  }

  update(game, dt) {
    this.frame++;
    const p = game.player;
    const c = game.controller;
    const st = game.storm;
    const specA = c.spectating && c.spec ? c.spec : p;
    this.set('stormL', this.el.stormLabel, st.label);
    this.set('stormT', this.el.stormTime, st.stage === 'done' ? '--' : fmt(Math.max(0, st.timer)));
    const T = game.teams;
    this.set('alive', this.el.alive, String(T.enabled ? T.teamsAlive().size : game.alive().length));
    this.set('aliveL', this.el.aliveLabel, T.enabled ? 'squads' : 'left');
    this.set('rk', this.el.rankedPill, game.ranked ? `RANKED · ${lobbyLabel(game.lobbyRating)} lobby` : '', 'textContent');
    this.set('rkd', this.el.rankedPill.style, game.ranked ? '' : 'none', 'display');
    this.set('kills', this.el.kills, String(specA.kills));
    // compass
    const deg = ((-c.yaw * 180) / Math.PI + 360 * 4) % 360;
    this.set('comp', this.el.compass.style, `translateX(${(180 - 18 - (24 + deg / 15) * 36).toFixed(1)}px)`, 'transform');
    // bars
    const bar = (el, key, v, max, show = true) => {
      this.set(key + 'd', el.style, show ? '' : 'none', 'display');
      this.set(key + 'w', el.firstElementChild.style, `${Math.max(0, Math.min(1, v / max)) * 100}%`, 'width');
      const sp = el.querySelector('span');
      if (sp) this.set(key + 't', sp, `${Math.ceil(v)}`);
    };
    bar(this.el.over, 'o', specA.overshield, 50, specA.overshieldMax > 0);
    bar(this.el.shield, 's', specA.shield, 100);
    bar(this.el.health, 'h', specA.hp, 100);
    bar(this.el.stamina, 'st', specA.stamina, 100);
    // mats
    const mats = `<span class="mat wood ${c.material === 'wood' ? 'sel' : ''}">${specA.mats.wood}</span><span class="mat brick ${c.material === 'brick' ? 'sel' : ''}">${specA.mats.brick}</span><span class="mat metal ${c.material === 'metal' ? 'sel' : ''}">${specA.mats.metal}</span>`;
    this.set('mats', this.el.mats, game.mode === 'zerobuild' ? '<span class="zb">ZERO BUILD</span>' : mats, 'innerHTML');
    // slots
    let slots = `<div class="slot pick ${specA.sel === -1 && !c.building ? 'sel' : ''}"><em>F</em><b>PICKAXE</b></div>`;
    specA.slots.forEach((s, i) => {
      if (!s) {
        slots += `<div class="slot empty"><em>${i + 1}</em></div>`;
        return;
      }
      const rc = s.kind === 'weapon' ? RARITIES[s.rarity].color : s.kind === 'consumable' ? CONSUMABLES[s.id].color : THROWABLES[s.id]?.color || '#888';
      const sub = s.kind === 'weapon' ? `${s.mag}/${specA.ammo[WEAPONS[s.id].ammo]}` : `x${s.count}`;
      slots += `<div class="slot ${specA.sel === i && !c.building ? 'sel' : ''}" style="--rc:${rc}"><em>${i + 1}</em><b>${SHORT[s.id] || s.id}</b><small>${sub}</small></div>`;
    });
    this.set('slots', this.el.slots, slots, 'innerHTML');
    const w = specA.weapon;
    if (w) {
      this.set('mag', this.el.mag, specA.reloadT > 0 ? 'RELOAD' : String(specA.item.mag));
      this.set('res', this.el.reserve, `/ ${specA.ammo[w.ammo]} ${AMMO[w.ammo].name}`);
    } else {
      this.set('mag', this.el.mag, specA.item ? itemName(specA.item) : c.building ? 'BUILD' : 'PICKAXE');
      this.set('res', this.el.reserve, '');
    }
    if (this.frame % 10 === 0) {
      const al = Object.entries(specA.ammo).map(([k, v]) => `<span style="color:${AMMO[k].color}">${v}</span>`).join('');
      this.set('ammo', this.el.ammoList, al, 'innerHTML');
    }
    // build bar
    const building = c.building && !c.spectating;
    this.set('bshow', this.el.build.style, building ? '' : 'none', 'display');
    if (building) {
      const bb = PIECES.map((pc, i) => `<div class="piece ${c.piece === pc ? 'sel' : ''}"><em>${i + 1}</em>${PIECE_NAMES[pc]}</div>`).join('') + `<div class="piece mat ${c.material}"><em>T</em>${c.material}</div><div class="piece"><em>R</em>Rotate</div>`;
      this.set('bb', this.el.build, bb, 'innerHTML');
    }
    // crosshair spread
    const cone = w && !building ? game.combat.cone(specA) : 0.01;
    const gap = Math.round(6 + Math.tan(cone) * (window.innerHeight / 2) / Math.tan((game.camera.fov * Math.PI) / 360));
    this.set('gap', this.el.cross.style, `${Math.min(80, gap)}px`, '--gap');
    const scoped = specA === p && p.ads && w && w.scope && c.dist < 0.8;
    this.set('scope', this.el.scope.style, scoped ? 'block' : 'none', 'display');
    this.set('cross', this.el.cross.style, (p.alive && p.state !== 'bus' && p.state !== 'skydive' && p.state !== 'glide' && !scoped) || c.spectating ? '' : 'none', 'display');
    // prompt
    const pr = c.prompt;
    this.set('pr', this.el.prompt.style, pr ? '' : 'none', 'display');
    if (pr) {
      this.set('prt', this.el.promptText, pr.text);
      this.set('prc', this.el.promptText.style, pr.color || '#fff', 'color');
    }
    // use / reload bar
    const use = specA.reviveTarget && specA.reviveT > 0 ? { k: specA.reviveT / REVIVE_TIME, l: `Reviving ${specA.reviveTarget.name}` }
      : specA.rebootVan && specA.rebootT > 0 ? { k: specA.rebootT / REBOOT_TIME, l: 'Rebooting teammates…' }
      : specA.use ? { k: 1 - specA.use.t / specA.use.total, l: `Using ${CONSUMABLES[specA.slots[specA.use.slot]?.id]?.name || ''}` } : specA.reloadT > 0 ? { k: 1 - specA.reloadT / specA.reloadTotal, l: 'Reloading' } : null;
    this.set('use', this.el.use.style, use ? '' : 'none', 'display');
    if (use) {
      this.el.useFill.style.width = `${use.k * 100}%`;
      this.set('usel', this.el.useLabel, use.l);
    }
    // bus hint
    let hint = '';
    const tch = document.body.classList.contains('touch');
    if (p.state === 'bus') hint = game.busT < 1.5 ? 'The bus doors are opening…' : tch ? 'Tap <kbd>JUMP</kbd> to leave the bus · tap the map to set a drop marker' : 'Press <kbd>SPACE</kbd> to jump · <kbd>M</kbd> map & drop marker';
    else if (tch && p.state === 'skydive') hint = p.canRedeploy ? '<kbd>JUMP</kbd> redeploy glider' : 'Push the stick up to dive · <kbd>JUMP</kbd> opens the glider';
    else if (!tch && p.state === 'skydive') hint = p.canRedeploy ? '<kbd>SPACE</kbd> redeploy glider' : '<kbd>W</kbd> dive · <kbd>SPACE</kbd> open glider';
    else if (p.state === 'glide' && p.canRedeploy) hint = '<kbd>SPACE</kbd> close glider';
    this.set('hint', this.el.busHint, hint, 'innerHTML');
    // tints
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.el.hurtTint.style.opacity = String(Math.min(0.8, this.hurtT * 1.6) + (p.alive && p.hp < 30 ? 0.25 : 0));
    const inStorm = specA.alive && st.outside(specA.pos.x, specA.pos.z) && specA.state !== 'bus';
    this.set('storm', this.el.stormTint.style, inStorm ? '1' : '0', 'opacity');
    // spectate bar
    this.el.spec.classList.toggle('hidden', !(c.spectating && this.menus.overlayHidden));
    this.set('specR', this.el.specResults.style, game.result ? '' : 'none', 'display');
    if (c.spectating && c.spec) this.set('specn', this.el.specName, c.spec.name);
    this.set('fps', this.el.fps, save.data.settings.showFps ? `${Math.round(game.engine.fps)} fps` : '');
    // buffs
    const bl = Object.entries(specA.buffs).map(([k, v]) => `<span class="buff" style="--bc:${BUFFS[k].color}" title="${BUFFS[k].desc}">${BUFFS[k].name} <b>${Math.ceil(v)}s</b></span>`).join('') + (specA.cards.length ? `<span class="buff" style="--bc:#3f9bff">Reboot cards <b>${specA.cards.length}</b></span>` : '');
    this.set('buffs', this.el.buffs, bl, 'innerHTML');
    // downed
    this.set('dn', this.el.downed.style, specA.alive && specA.downed ? '' : 'none', 'display');
    if (specA.downed) this.el.downFill.style.width = `${Math.max(0, specA.downHp)}%`;
    // aimed build piece: health + edit / repair / upgrade hint
    const pc = c.aimPiece;
    const editing = c.editing;
    const showBi = !c.spectating && (editing || (pc && c.buildInfo));
    this.set('bi', this.el.bi.style, showBi ? '' : 'none', 'display');
    if (editing) {
      this.el.biBar.style.width = `${(editing.piece.hp / editing.piece.maxHp) * 100}%`;
      this.set('bit', this.el.biText, 'EDIT · click/drag tiles to cut · V confirm · R reset · B cancel', 'textContent');
    } else if (showBi) {
      this.el.biBar.style.width = `${Math.max(0, pc.hp / pc.maxHp) * 100}%`;
      this.set('bit', this.el.biText, `${Math.ceil(pc.hp)}/${pc.maxHp} · ${game.building.editable(pc) ? 'V Edit · ' : ''}U ${c.buildInfo.text}`, 'textContent');
    }
    if (this.frame % 4 === 0) this._team(game);
    this._markers(game);
    if (this.frame % 3 === 0) this._minimap(game);
    if (this.mapOpen && this.frame % 6 === 0) this._bigmap(game);
  }

  _minimap(game) {
    const g = this.ctx;
    const S = 190, W = 130; // metres shown
    const c = game.controller;
    const f = c.focus();
    const map = game.world.mapCanvas;
    const k = map.width / ISLAND_SIZE;
    g.fillStyle = '#2a8fc4';
    g.fillRect(0, 0, S, S);
    g.drawImage(map, (f.x + ISLAND_SIZE / 2 - W / 2) * k, (f.z + ISLAND_SIZE / 2 - W / 2) * k, W * k, W * k, 0, 0, S, S);
    const tm = (x, z) => [((x - f.x) / W + 0.5) * S, ((z - f.z) / W + 0.5) * S];
    this._stormDraw(g, game, tm, S / W);
    if (game.marker) {
      const [mx, my] = tm(game.marker.x, game.marker.y);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx, my, 5, 0, 7); g.fill();
    }
    this._mapIcons(g, game, tm, 1);
    // arrow
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-c.yaw);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }

  /** Reboot vans, squadmates and pings on a map canvas. */
  _mapIcons(g, game, tm, k) {
    const T = game.teams;
    if (!T.enabled) return;
    for (const v of game.world.vans) {
      const [x, y] = tm(v.pos.x, v.pos.z);
      g.fillStyle = v.cd > 0 || !T.vansOnline() ? '#777' : '#39f0ff';
      g.strokeStyle = '#000';
      g.lineWidth = 1.5;
      g.fillRect(x - 5 * k, y - 3.5 * k, 10 * k, 7 * k);
      g.strokeRect(x - 5 * k, y - 3.5 * k, 10 * k, 7 * k);
    }
    const p = game.player;
    for (const a of game.actors) {
      if (a === p || a.team !== p.team || !a.alive || a.state === 'bus') continue;
      const [x, y] = tm(a.pos.x, a.pos.z);
      g.fillStyle = a.downed ? '#ff5c5c' : TEAM_COLORS[a.id % TEAM_COLORS.length];
      g.strokeStyle = '#000';
      g.beginPath(); g.arc(x, y, 4.5 * k, 0, 7); g.fill(); g.stroke();
    }
    for (const pg of T.pings) {
      if (pg.team !== p.team) continue;
      const [x, y] = tm(pg.pos.x, pg.pos.z);
      g.strokeStyle = pg.color;
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x, y - 7 * k); g.lineTo(x + 5 * k, y); g.lineTo(x, y + 7 * k); g.lineTo(x - 5 * k, y); g.closePath(); g.stroke();
    }
  }

  _team(game) {
    const T = game.teams;
    if (!T.enabled) {
      this.set('team', this.el.team, '', 'innerHTML');
      return;
    }
    const p = game.player;
    const rows = game.actors.filter((a) => a.team === p.team).map((a) => {
      const st = !a.alive ? (game.loot.pickups.some((k) => k.it.kind === 'card' && k.it.id === a.id) ? 'CARD DROPPED' : game.actors.some((o) => o.cards.includes(a.id)) ? 'CARD PICKED UP' : 'OUT') : a.downed ? 'DOWNED' : a.state === 'bus' ? 'ON BUS' : '';
      const col = a === p ? '#ffd23f' : TEAM_COLORS[a.id % TEAM_COLORS.length];
      return `<div class="mate ${!a.alive ? 'out' : a.downed ? 'down' : ''}"><i style="background:${col}"></i><span>${esc(a.name)}</span>${st ? `<em>${st}</em>` : `<div class="mbar"><div class="mh" style="width:${a.hp}%"></div><div class="ms" style="width:${a.shield}%"></div></div>`}</div>`;
    }).join('');
    this.set('team', this.el.team, rows, 'innerHTML');
  }

  /** Screen-space markers above squadmates and on team pings (visible through walls). */
  _markers(game) {
    const T = game.teams;
    const cam = game.camera;
    const p = game.player;
    const items = [];
    if (T.enabled) {
      for (const a of game.actors) {
        if (a === p || a.team !== p.team || !a.alive || a.state === 'bus') continue;
        items.push({ pos: _v.set(a.pos.x, a.pos.y + a.height + 0.6, a.pos.z).clone(), text: a.downed ? `${a.name} ▼ HELP` : a.name, color: a.downed ? '#ff5c5c' : TEAM_COLORS[a.id % TEAM_COLORS.length], cls: 'mk-mate' });
      }
    }
    for (const pg of T.pings) {
      if (pg.team !== p.team) continue;
      const d = Math.round(pg.pos.distanceTo(cam.position));
      items.push({ pos: pg.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), text: `${pg.label} ${d}m`, color: pg.color, cls: 'mk-ping' });
    }
    const el = this.el.markers;
    while (el.children.length < items.length) el.appendChild(document.createElement('div'));
    for (let i = 0; i < el.children.length; i++) {
      const d = el.children[i];
      const it = items[i];
      if (!it) { d.style.display = 'none'; continue; }
      _v.copy(it.pos).project(cam);
      if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) { d.style.display = 'none'; continue; }
      d.style.display = '';
      d.className = 'marker ' + it.cls;
      d.style.left = `${(_v.x * 0.5 + 0.5) * 100}%`;
      d.style.top = `${(-_v.y * 0.5 + 0.5) * 100}%`;
      d.style.setProperty('--mc', it.color);
      if (d.textContent !== it.text) d.textContent = it.text;
    }
  }

  _stormDraw(g, game, tm, scale) {
    const st = game.storm;
    const [cx, cy] = tm(st.center.x, st.center.y);
    g.save();
    g.fillStyle = 'rgba(120,40,200,0.38)';
    g.beginPath();
    g.rect(-2000, -2000, 5000, 5000);
    g.arc(cx, cy, Math.max(0, st.radius * scale), 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.strokeStyle = '#d9a8ff';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, Math.max(0, st.radius * scale), 0, 7); g.stroke();
    if (st.stage === 'wait') {
      const [nx, ny] = tm(st.next.c.x, st.next.c.y);
      g.strokeStyle = '#ffffff';
      g.setLineDash([5, 4]);
      g.beginPath(); g.arc(nx, ny, Math.max(1, st.next.r * scale), 0, 7); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  _bigmap(game) {
    const g = this.bctx;
    const S = 620;
    const k = S / ISLAND_SIZE;
    g.fillStyle = '#2a8fc4';
    g.fillRect(0, 0, S, S);
    g.drawImage(game.world.mapCanvas, 0, 0, S, S);
    const tm = (x, z) => [(x + ISLAND_SIZE / 2) * k, (z + ISLAND_SIZE / 2) * k];
    this._stormDraw(g, game, tm, k);
    if (game.bus.visible) {
      const [ax, ay] = tm(game.busFrom.x, game.busFrom.z), [bx, by] = tm(game.busTo.x, game.busTo.z);
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 3;
      g.setLineDash([10, 6]);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.setLineDash([]);
      const [px, py] = tm(game.bus.position.x, game.bus.position.z);
      g.fillStyle = '#ffd23f';
      g.fillRect(px - 7, py - 5, 14, 10);
    }
    g.font = '800 15px "Baloo 2", "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    for (const poi of game.world.pois) {
      const [x, y] = tm(poi.x, poi.z);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText(poi.name, x, y - 22);
      g.fillStyle = poi.color;
      g.fillText(poi.name, x, y - 22);
    }
    g.font = '700 11px "Baloo 2", "Trebuchet MS", sans-serif';
    for (const m of game.world.minor) {
      const [x, y] = tm(m.x, m.z);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 3;
      g.strokeText(m.name, x, y - 12);
      g.fillStyle = '#fff';
      g.fillText(m.name, x, y - 12);
    }
    if (game.marker) {
      const [mx, my] = tm(game.marker.x, game.marker.y);
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#000';
      g.beginPath(); g.arc(mx, my, 8, 0, 7); g.fill(); g.stroke();
    }
    this._mapIcons(g, game, tm, 1.5);
    const f = game.controller.focus();
    const [px, py] = tm(f.x, f.z);
    g.save();
    g.translate(px, py);
    g.rotate(-game.controller.yaw);
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
