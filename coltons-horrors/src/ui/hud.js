// In-match HUD: objectives, team status, perks, prompts, skill checks and screen effects.
import * as THREE from 'three';
import { icon } from './icons.js';
import { PERK_BY_ID, ITEM_BY_ID } from '../data.js';
import { fmtTime, clamp } from '../core/util.js';
import { GENS_NEEDED } from '../game/match.js';

const STATE_ICON = { healthy: 'heart', injured: 'drop', dying: 'cross', carried: 'claw', hooked: 'hook', dead: 'skull', escaped: 'gate' };
const STATE_LABEL = { healthy: 'Healthy', injured: 'Injured', dying: 'Down', carried: 'Carried', hooked: 'Hooked', dead: 'Dead', escaped: 'Escaped' };

export class HUD {
  constructor(root) {
    this.root = root;
    this.markers = [];
    this.feedSeen = 0;
  }

  mount(m) {
    this.m = m;
    const P = m.player;
    const perks = P.perks.filter(Boolean);
    this.root.innerHTML = `
      <div class="fx fx-vignette"></div>
      <div class="fx fx-terror"></div>
      <div class="fx fx-hit"></div>
      <div class="fx fx-blind"></div>
      <div class="fx fx-glitch"></div>
      <div class="fx fx-veil"></div>
      <div class="h-obj"><div class="h-obj-label">Generators</div><div class="h-obj-num"></div><div class="h-obj-pips"></div><div class="h-endgame" hidden><span>The dark is closing in</span><b></b><i></i></div></div>
      <div class="h-team"></div>
      <div class="h-feed"></div>
      <div class="h-prompt" hidden><div class="h-prompt-text"></div><div class="h-bar"><i></i></div></div>
      <div class="h-mid" hidden></div>
      <svg class="h-skill" viewBox="-60 -60 120 120" hidden>
        <circle r="46" class="sk-ring"/>
        <path class="sk-zone"/><path class="sk-great"/>
        <line class="sk-needle" x1="0" y1="0" x2="0" y2="-52"/>
        <text class="sk-key" y="7" text-anchor="middle">SPACE</text>
      </svg>
      <div class="h-check-result" hidden></div>
      <div class="h-cross" ${P.isKiller ? '' : 'hidden'}></div>
      <div class="h-loadout">
        <div class="h-perks">${perks.map((id) => `<div class="h-perk" title="${PERK_BY_ID[id].name}">${icon(PERK_BY_ID[id].icon)}</div>`).join('')}</div>
        <div class="h-item"></div>
      </div>
      <div class="h-markers"></div>
      <div class="h-spectate" hidden><span></span><button class="btn-ghost h-leave">Leave match</button></div>
      <div class="h-help">${P.isKiller ? 'LMB attack · SPACE / E action · RMB / Q power · ESC pause' : 'WASD move · SHIFT run · C crouch · hold LMB / E use · SPACE vault, pallet, skill check · RMB / F item · ESC pause'}</div>
    `;
    const q = (s) => this.root.querySelector(s);
    this.el = {
      num: q('.h-obj-num'), pips: q('.h-obj-pips'), objLabel: q('.h-obj-label'), endgame: q('.h-endgame'), team: q('.h-team'), feed: q('.h-feed'),
      prompt: q('.h-prompt'), promptText: q('.h-prompt-text'), bar: q('.h-bar i'), mid: q('.h-mid'), skill: q('.h-skill'), checkResult: q('.h-check-result'),
      item: q('.h-item'), markers: q('.h-markers'), spectate: q('.h-spectate'), terror: q('.fx-terror'), hit: q('.fx-hit'), blind: q('.fx-blind'),
      glitch: q('.fx-glitch'), veil: q('.fx-veil'), zone: q('.sk-zone'), great: q('.sk-great'), needle: q('.sk-needle'), help: q('.h-help'),
    };
    this.el.spectate.querySelector('.h-leave').addEventListener('click', () => this.onLeave && this.onLeave());
    this.teamKey = '';
    this.feedSeen = 0;
    this.markerPool = [];
    setTimeout(() => { if (this.el.help) this.el.help.classList.add('fade'); }, 12000);
  }

  arc(a0, a1, r = 46) {
    const p = (a) => [Math.sin(a) * r, -Math.cos(a) * r];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  update(dt) {
    const m = this.m;
    if (!m) return;
    const P = m.player, k = m.killer, el = this.el, t = m.time;
    // objective
    const left = Math.max(0, GENS_NEEDED - m.gensDone);
    if (m.gatesPowered) { el.objLabel.textContent = 'Exit gates'; el.num.textContent = m.world.gates.some((g) => g.open) ? 'OPEN' : 'POWERED'; }
    else { el.objLabel.textContent = 'Generators left'; el.num.textContent = left; }
    el.pips.innerHTML = Array.from({ length: GENS_NEEDED }, (_, i) => `<i class="${i < m.gensDone ? 'on' : ''}"></i>`).join('');
    if (m.endgameT !== null) { el.endgame.hidden = false; el.endgame.querySelector('b').textContent = fmtTime(m.endgameT); el.endgame.querySelector('i').style.width = `${(m.endgameT / 120) * 100}%`; }
    // team
    const key = m.survivors.map((s) => s.state + s.hooks + (s.chased ? 'c' : '') + (s.hookProg > 0.5 ? 'x' : '')).join('|');
    if (key !== this.teamKey) {
      this.teamKey = key;
      el.team.innerHTML = m.survivors.map((s) => `
        <div class="h-mate st-${s.state} ${s.isPlayer ? 'me' : ''} ${s.chased ? 'chased' : ''}">
          <div class="h-mate-ico">${icon(STATE_ICON[s.state])}</div>
          <div class="h-mate-txt"><b>${s.name.split(' ')[0]}</b><span>${STATE_LABEL[s.state]}${s.chased ? ' · chased' : ''}</span></div>
          <div class="h-hooks">${[0, 1].map((i) => `<i class="${s.hooks > i || (i === 1 && s.state === 'hooked' && s.hookProg >= 0.5) ? 'on' : ''}"></i>`).join('')}</div>
        </div>`).join('');
    }
    // feed
    while (this.feedSeen < m.events.length) {
      const e = m.events[this.feedSeen++];
      const d = document.createElement('div');
      d.className = 'h-toast k-' + e.kind;
      d.innerHTML = `<b>${e.title}</b>${e.sub ? `<span>${e.sub}</span>` : ''}`;
      el.feed.prepend(d);
      setTimeout(() => d.classList.add('out'), 4200);
      setTimeout(() => d.remove(), 5000);
    }
    // prompt + progress
    let prompt = null, prog = null;
    if (P.isSurvivor && P.alive) {
      const a = P.action;
      if (P.state === 'hooked') {
        prompt = P.hookProg >= 0.5 ? 'Press SPACE to struggle' : P.hooks === 1 && P.selfTries < 3 ? `Hold E to try to free yourself (${3 - P.selfTries} left)` : 'Wait for a rescue';
        prog = 1 - P.hookProg;
      } else if (P.state === 'carried') { prompt = 'Tap A and D to wiggle free'; prog = P.wiggle; }
      else if (P.state === 'dying') { prompt = 'You are down. Crawl away or wait for help'; prog = 1 - P.bleed; }
      else if (a && a.type === 'repair') { prompt = 'Repairing'; prog = a.target.progress; }
      else if (a && (a.type === 'heal' || a.type === 'recover')) { prompt = a.type === 'heal' ? `Healing ${a.target.name.split(' ')[0]}` : `Picking up ${a.target.name.split(' ')[0]}`; prog = a.target.heal; }
      else if (a && a.type === 'selfheal') { prompt = 'Healing yourself'; prog = P.heal; }
      else if (a && a.type === 'unhook') { prompt = 'Unhooking'; prog = a.t / (P.has('borrowed_breath') ? 0.6 : 1.2); }
      else if (a && a.type === 'gate') { prompt = 'Opening the gate'; prog = a.target.progress; }
      else if (a && a.type === 'chest') { prompt = 'Searching'; prog = a.target.progress; }
      else if (a && a.type === 'unplug') { prompt = 'Unplugging the screen'; prog = a.target.unplug; }
      else if (!P.vault) {
        const v = m.vaultable(P), pal = m.droppablePallet(P);
        const ia = m.findSurvivorInteraction(P);
        const h = m.world.hatch;
        if (h.open && !h.closed && Math.hypot(P.pos.x - h.x, P.pos.z - h.z) < 1.8) prompt = 'SPACE: jump into the hatch';
        else if (v) prompt = v.type === 'window' ? 'SPACE: vault' : 'SPACE: vault the pallet';
        else if (pal) prompt = 'SPACE: drop the pallet';
        else if (ia) prompt = { repair: 'Hold E / LMB: repair', heal: 'Hold E / LMB: heal', recover: 'Hold E / LMB: pick up', unhook: 'Hold E / LMB: unhook', gate: 'Hold E / LMB: open the gate', chest: 'Hold E / LMB: search', unplug: 'Hold E / LMB: unplug the screen' }[ia.type];
        else if (P.state === 'injured' && P.item && P.item.id === 'medkit') prompt = 'Hold RMB / F: heal with the med kit';
      }
    } else if (P.isKiller) {
      prompt = m.killerPrompt();
      if (k.state !== 'normal' && k.stateDur && ['pickup', 'hook', 'break', 'kick', 'channel', 'closeHatch'].includes(k.state)) prog = k.stateT / k.stateDur;
      if (k.carrying) prompt = prompt || 'Carry them to a hook';
      if (k.state === 'stun') prompt = 'Stunned';
      if (k.state === 'blind') prompt = 'Blinded';
    }
    el.prompt.hidden = !prompt && prog === null;
    if (prompt) el.promptText.textContent = prompt;
    el.prompt.querySelector('.h-bar').hidden = prog === null;
    if (prog !== null) el.bar.style.width = `${clamp(prog, 0, 1) * 100}%`;
    // skill check
    const sc = m.skillCheck;
    el.skill.hidden = !sc;
    if (sc) {
      el.zone.setAttribute('d', this.arc(sc.zoneStart, sc.zoneStart + sc.zone));
      el.great.setAttribute('d', this.arc(sc.zoneStart, sc.zoneStart + sc.great));
      el.needle.setAttribute('transform', `rotate(${(sc.reversed ? -1 : 1) * sc.needle * 180 / Math.PI})`);
      el.skill.style.transform = `translate(calc(-50% + ${sc.ox * 100}vw), calc(-50% + ${sc.oy * 100}vh)) scaleX(${sc.reversed ? -1 : 1})`;
    }
    if (m.lastCheck && t - m.lastCheck.t < 0.8) { el.checkResult.hidden = false; el.checkResult.textContent = { great: 'GREAT', good: 'GOOD', miss: 'MISSED' }[m.lastCheck.r]; el.checkResult.className = 'h-check-result r-' + m.lastCheck.r; }
    else el.checkResult.hidden = true;
    // item / power
    if (P.isSurvivor) {
      if (P.item) { const def = ITEM_BY_ID[P.item.id]; el.item.innerHTML = `<div class="h-itm">${icon(def.icon)}</div><div class="h-itm-txt"><b>${def.name}</b><div class="h-meter"><i style="width:${(P.item.charges / P.item.max) * 100}%"></i></div></div>`; }
      else el.item.innerHTML = '';
    } else {
      const p = k.power;
      if (p.kind === 'veil') el.item.innerHTML = `<div class="h-itm ${p.active ? 'live' : p.charge >= 1 ? 'ready' : ''}">${icon('ghost')}</div><div class="h-itm-txt"><b>Veil Walk</b><div class="h-meter"><i style="width:${(p.active ? 1 - p.t / p.dur : p.charge) * 100}%"></i></div></div>`;
      else el.item.innerHTML = `<div class="h-itm ${p.cooldown <= 0 ? 'ready' : ''}">${icon('tv')}</div><div class="h-itm-txt"><b>Signal Jump${p.selecting ? ': release to jump' : ''}</b><div class="h-meter"><i style="width:${(1 - p.cooldown / p.maxCd) * 100}%"></i></div></div>`;
    }
    // screen effects
    const terror = m.terror || 0;
    el.terror.style.opacity = P.isSurvivor ? (terror * (0.35 + 0.25 * Math.max(0, Math.sin(t * (6 + terror * 6))))).toFixed(3) : 0;
    m.hitFlash = Math.max(0, m.hitFlash - dt * 1.5);
    m.blindFlash = Math.max(0, m.blindFlash - dt * (P.isKiller && k.state === 'blind' ? 0.35 : 1.2));
    el.hit.style.opacity = m.hitFlash.toFixed(3);
    el.blind.style.opacity = (P.isKiller && k.state === 'blind' ? Math.max(0.85, m.blindFlash) : m.blindFlash).toFixed(3);
    el.glitch.style.opacity = P.isSurvivor && P.glitchUntil > t ? (0.18 + Math.random() * 0.2).toFixed(3) : 0;
    el.veil.style.opacity = P.isKiller && k.phasing ? 1 : 0;
    // spectate bar
    el.spectate.hidden = !m.spectate;
    if (m.spectate) el.spectate.querySelector('span').textContent = `Spectating ${m.spectate.name} · click to switch`;
    this.updateMarkers();
  }

  updateMarkers() {
    const m = this.m, P = m.player, cam = m.camera, t = m.time;
    const list = [];
    if (P.isKiller) {
      for (const n of m.noises) if (t - n.t < 3 && n.loud >= 0.5) list.push({ x: n.x, y: 1.2, z: n.z, cls: 'mk-noise', label: '' });
    } else if (P.alive && m.ctx.settings.hints) {
      for (const g of m.world.gens) {
        if (g.done) continue;
        const d = Math.hypot(g.x - P.pos.x, g.z - P.pos.z);
        if (d < 26 && d > 3) list.push({ x: g.x, y: 1.6, z: g.z, cls: 'mk-gen', label: `${Math.round(g.progress * 100)}%` });
      }
      for (const g of m.world.gates) if (g.powered && !g.open) list.push({ x: g.switchX, y: 2, z: g.switchZ, cls: 'mk-gate', label: '' });
    }
    while (this.markerPool.length < list.length) { const d = document.createElement('div'); this.el.markers.appendChild(d); this.markerPool.push(d); }
    const v = new THREE.Vector3();
    const w = window.innerWidth, h = window.innerHeight;
    this.markerPool.forEach((d, i) => {
      const it = list[i];
      if (!it) { d.hidden = true; return; }
      v.set(it.x, it.y, it.z).project(cam);
      if (v.z > 1) { d.hidden = true; return; }
      d.hidden = false;
      d.className = 'mk ' + it.cls;
      d.textContent = it.label;
      d.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    });
  }

  unmount() { this.root.innerHTML = ''; this.m = null; }
}
