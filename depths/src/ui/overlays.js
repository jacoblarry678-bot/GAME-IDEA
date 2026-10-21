/**
 * Modal overlays during play: puzzle inspection panels, record and note
 * reader, journal (Objective, Map, Photos, Evidence, Records), inventory,
 * pause menu, death screen, refuge map board (manual saves) and cassette
 * deck. In solo the world pauses only for the pause menu; inventory,
 * journal and panels keep the world running, and the screen says so.
 */
import { el, clear, btn, fmtTime } from './dom.js';
import { RECORDS } from '../data/records.js';
import { ITEMS } from '../data/items.js';
import { EQUIP } from '../data/items.js';

export class Overlays {
  constructor(root, app) {
    this.app = app;
    this.root = root;
    this.stack = [];
    this.journalTab = 'Objective';
    this.recordSize = 1;
  }
  get open() { return this.stack.length > 0; }
  get pausing() { return this.stack.some((o) => o.pauses); }
  top() { return this.stack[this.stack.length - 1]; }
  has(kind) { return this.stack.some((o) => o.kind === kind); }

  push(kind, node, { pauses = false, onClose = null, live = null } = {}) {
    const wrap = el('div', { class: `overlay ${pauses ? '' : 'clear'}` }, node);
    this.root.appendChild(wrap);
    const o = { kind, wrap, pauses, onClose, live };
    this.stack.push(o);
    this.app.nav.push(wrap, () => this.close(kind));
    this.app.onOverlayChange();
    return o;
  }
  close(kind) {
    const i = kind ? this.stack.findIndex((o) => o.kind === kind) : this.stack.length - 1;
    if (i < 0) return;
    const [o] = this.stack.splice(i, 1);
    o.wrap.remove();
    this.app.nav.pop(o.wrap);
    if (o.onClose) o.onClose();
    this.app.onOverlayChange();
  }
  closeAll() { while (this.stack.length) this.close(); }
  update(dt) { for (const o of this.stack) if (o.live) o.live(dt); }

  liveNote() { return this.app.coop ? el('div', { class: 'small dim', style: { marginTop: '10px' } }, 'Session running: the world continues while this is open.') : el('div', { class: 'small dim', style: { marginTop: '10px' } }, 'The world keeps running while this is open.'); }

  // ---------------------------------------------------------------- puzzle panel
  panel(puzzleId) {
    const app = this.app, g = app.game;
    const pz = g.puzzles.get(puzzleId);
    if (!pz) return;
    const node = el('div', { class: 'panelui' });
    const render = () => {
      const v = pz.view();
      clear(node);
      node.append(el('div', { class: 'pt' }, v.title));
      if (v.instructions) node.append(el('div', { class: 'pi' }, v.instructions));
      node.append(el('div', { class: 'disp' }, v.display || ''));
      const ctrls = el('div', { class: 'ctrls' });
      for (const c of v.controls) {
        const b = el('button', { class: `ctl ${c.state === 'on' ? 'on' : ''} ${c.wide ? 'wide' : ''}`, 'data-nav': '', disabled: v.done || c.disabled ? true : null, onclick: () => { const r = app.puzzleAction(puzzleId, c.id); if (r && r.msg) msg.textContent = r.msg; render(); } },
          el('span', { class: 'st' }), el('div', { class: 'lb' }, c.label), c.sub ? el('div', { class: 'sb' }, c.sub) : null);
        ctrls.append(b);
      }
      node.append(ctrls);
      const msg = el('div', { class: 'msg' }, pz.message || '');
      node.append(msg);
      if (pz.reservedBy && pz.reservedBy !== app.pid && !v.done) node.append(el('div', { class: 'ob' }, 'Another crew member is using this panel. You are observing.'));
      node.append(el('div', { class: 'row', style: { marginTop: '16px' } }, btn('Back', () => this.close('panel'), { 'data-autofocus': v.done ? '' : null }), el('div', { class: 'spacer' }), this.liveNote()));
      if (app.nav.top() && app.nav.top().layer.contains(node)) setTimeout(() => app.nav.focusFirst(), 0);
    };
    render();
    let last = '';
    this.push('panel', node, { onClose: () => { pz.release && pz.release(g.players.get(app.pid)); app.audio.play('click'); }, live: () => { const s = JSON.stringify(pz.view()); if (s !== last) { last = s; const f = document.activeElement && document.activeElement.textContent; render(); const again = [...node.querySelectorAll('[data-nav]')].find((e) => e.textContent === f); if (again) again.focus(); } } });
  }

  // ---------------------------------------------------------------- reader
  reader(title, text, { audio = false, collectedCopy = false, kind = 'Record' } = {}) {
    const body = el('div', { class: 'rbody' }, text);
    const node = el('div', { class: 'reader', style: { '--readsize': this.recordSize } },
      el('div', { class: 'rt' }, `${kind}${audio ? ' · audio transcript' : ''}${collectedCopy ? ' · collected copy' : ''}`),
      el('div', { style: { fontSize: '1.15em', marginBottom: '12px' } }, title), body,
      el('div', { class: 'rb' }, btn('Close', () => this.close('reader'), { 'data-autofocus': '' }), btn('Text −', () => { this.recordSize = Math.max(0.8, this.recordSize - 0.1); node.style.setProperty('--readsize', this.recordSize); }), btn('Text +', () => { this.recordSize = Math.min(1.8, this.recordSize + 0.1); node.style.setProperty('--readsize', this.recordSize); })));
    this.push('reader', node);
  }

  // ---------------------------------------------------------------- death
  death(info) {
    const app = this.app;
    const node = el('div', { class: 'death' },
      el('div', { class: 't' }, info.kind === 'wipe' ? 'The crew is lost' : 'You did not make it'),
      el('div', { class: 'c' }, info.creature),
      el('div', { class: 'h' }, info.hint),
      app.netRole === 'guest'
        ? el('div', {}, el('p', { class: 'small dim', style: { textAlign: 'center', marginTop: '22px' } }, 'The host retries from the checkpoint; you will rejoin with the crew.'), el('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Leave session', () => { this.close('death'); app.quitToMenu(); }, { 'data-autofocus': '' })))
        : el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '28px' } }, btn('Retry from checkpoint', () => { this.close('death'); app.retry(); }, { class: 'btn primary', 'data-autofocus': '' }), btn('Quit to menu', () => { this.close('death'); app.quitToMenu(); })));
    this.push('death', node, { pauses: true });
  }

  // ---------------------------------------------------------------- ending
  /** Ending card: title, epilogue, the last developed photograph. */
  ending(info, onDone) {
    const node = el('div', { class: 'ending' },
      el('div', { class: 'card' },
        el('div', { class: 'et' }, 'Ending'),
        el('div', { class: 'en' }, info.title),
        el('div', { class: 'cols' },
          el('div', { class: 'txt' }, ...info.epilogue.map((t) => el('p', { class: 'ep' }, t))),
          info.photo ? el('div', { class: 'endphoto' }, el('img', { src: info.photo, alt: info.photoText }), el('div', { class: 'cap' }, info.photoText)) : el('p', { class: 'ep dim' }, info.photoText)),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Continue', () => { this.close('ending'); onDone(); }, { class: 'btn primary', 'data-autofocus': '' }))));
    this.push('ending', node);
  }

  // ---------------------------------------------------------------- expedition result
  expeditionResult(run, actions) {
    const node = el('div', { class: 'ending' }, el('div', { class: 'card', style: { width: 'min(620px, 94vw)' } },
      el('div', { class: 'et' }, 'Expedition'),
      el('div', { class: 'en' }, run.success ? 'Extracted' : 'Run lost'),
      el('div', { class: 'stats' },
        el('div', {}, el('b', {}, run.seedText), 'seed'),
        el('div', {}, el('b', {}, fmtTime(run.time)), 'time'),
        el('div', {}, el('b', {}, String(run.photos)), 'photographs'),
        el('div', {}, el('b', {}, String(run.downs)), 'downs')),
      el('p', { class: 'small dim' }, 'Share the seed to play the same rooms, puzzles and patrols.'),
      el('div', { class: 'col', style: { maxWidth: '380px', margin: '0 auto' } },
        btn('Retry this seed', () => { this.close('xresult'); actions.retry(); }, { class: 'btn primary', 'data-autofocus': '' }),
        btn('New seed', () => { this.close('xresult'); actions.fresh(); }),
        btn('Expedition menu', () => { this.close('xresult'); actions.menu(); }))));
    this.push('xresult', node, { pauses: true });
  }

  // ---------------------------------------------------------------- pause
  pause() {
    const app = this.app, g = app.game, p = g.players.get(app.pid);
    const inRefuge = g.inSafeRefuge(p);
    const node = el('div', { class: 'sheet', style: { width: 'min(520px, 92vw)' } },
      el('h2', {}, app.coop ? 'Session running' : 'Paused'),
      app.coop ? el('p', { class: 'small dim' }, 'Online play keeps running while this menu is open.') : null,
      app.coop ? el('div', { class: 'jentry' }, app.netRole === 'host' ? `Invite code ${app.net && app.net.code ? app.net.code : '…'} · you have final campaign control` : `Session ${app.net && app.net.code ? app.net.code : ''} · the host has final campaign control`, el('br'), [...g.players.values()].map((q) => `${q.name}${q.id === app.pid ? ' (you)' : ''}${q.connected ? (q.spectating ? ' · waiting' : q.downed ? ' · down' : '') : ' · disconnected'}`).join(' · ')) : null,
      !app.coop && app.netAvailable && !app.replay && app.slot ? btn('Open to guests (host online)', () => { this.close('pause'); app.startHosting(); }) : null,
      app.coop ? (g.sharedPause ? btn('Resume (three second countdown)', () => { g.resumeShared(app.pid); this.close('pause'); }) : btn('Vote to pause the shared game', () => { g.pauseVote(app.pid); this.close('pause'); })) : null,
      app.coop && app.netRole === 'guest' && g.chapterId === 6 && !g.story.has('P12.committed') ? btn('Ask the host for more time', () => { g.requestMoreTime(app.pid); this.close('pause'); }) : null,
      el('div', { class: 'col' },
        btn('Resume', () => this.close('pause'), { 'data-autofocus': '' }),
        btn('Journal', () => { this.close('pause'); this.journal(); }),
        btn('Settings', () => app.menus.settings(() => {})),
        btn('Request hint', () => { this.close('pause'); app.requestHint(); }),
        btn('Return to last safe position', () => { this.close('pause'); g.returnToSafe(app.pid); }),
        g.mode === 'expedition' ? btn('Suspend run and quit', () => { this.close('pause'); app.suspendExpedition(); }) : inRefuge ? btn('Save and quit', () => { this.close('pause'); app.saveAndQuit(); }) : el('button', { class: 'btn', disabled: true, 'data-nav': '' }, 'Save and quit', el('span', { class: 'why' }, 'Available in a secured refuge. Your last checkpoint is kept.')),
        btn('Quit to menu', () => { this.close('pause'); app.confirm('Quit to the menu? Progress since the last checkpoint is lost.', () => app.quitToMenu()); }, { class: 'btn danger' })),
      el('div', { class: 'small dim', style: { marginTop: '14px' } }, `Chapter ${g.chapterId} · ${g.D.label} · ${fmtTime(g.elapsed)}${g.checkpointReason ? ` · last checkpoint: ${g.checkpointReason}` : ''}`));
    this.push('pause', node, { pauses: !app.coop });
  }

  // ---------------------------------------------------------------- journal
  journal(tab) {
    if (tab) this.journalTab = tab;
    const app = this.app;
    const node = el('div', { class: 'journal' });
    const tabs = ['Objective', 'Map', 'Photos', 'Evidence', 'Records'];
    const body = el('div', { class: 'body' });
    const tabbar = el('div', { class: 'tabs' });
    const render = () => {
      clear(tabbar);
      for (const t of tabs) tabbar.append(el('button', { class: t === this.journalTab ? 'on' : '', 'data-nav': '', onclick: () => { this.journalTab = t; render(); } }, t));
      clear(body);
      this['_j' + this.journalTab](body);
    };
    node.append(el('div', { class: 'row' }, el('h2', { class: 'caps', style: { letterSpacing: '0.3em' } }, 'Journal'), el('div', { class: 'spacer' }), btn('Close', () => this.close('journal'))), tabbar, body, this.liveNote());
    render();
    this.push('journal', node);
  }

  _jObjective(body) {
    const g = this.app.game, S = g.story;
    body.append(el('div', { class: 'jentry' }, el('span', { class: 'tag' }, 'Objective'), S.objective.text || '—'));
    if (S.radio) body.append(el('div', { class: 'jentry radio' }, el('span', { class: 'tag' }, 'Radio claims'), S.radio.text, el('div', { class: 'small dim' }, 'An instruction received over the radio. Not confirmed by observation.')));
    body.append(el('h3', {}, 'Observations and clues'));
    const clues = Object.entries(S.clues).filter(([, c]) => !c.ch || c.ch === g.chapterId || true).sort((a, b) => b[1].t - a[1].t);
    if (!clues.length) body.append(el('div', { class: 'dim' }, 'Nothing recorded yet.'));
    for (const [, c] of clues) body.append(el('div', { class: 'jentry' }, el('span', { class: 'tag' }, c.source === 'photo' ? 'Photo' : c.source === 'station' ? 'Survey image' : c.source === 'note' ? 'Note' : 'Observed'), c.text));
    body.append(el('div', { class: 'row', style: { marginTop: '16px' } }, btn('Request hint', () => this.app.requestHint()), btn('Replay last instruction', () => g.useTool && this.app.replayRadio())));
  }

  _jMap(body) {
    const g = this.app.game, L = g.level, p = g.players.get(this.app.pid);
    const b = L.bounds;
    const pad = 3;
    const w = b.maxX - b.minX + pad * 2, h = b.maxZ - b.minZ + pad * 2;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${b.minX - pad} ${-(b.maxZ + pad)} ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const add = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text) e.textContent = text; svg.appendChild(e); return e; };
    for (const r of L.rooms) {
      if (!g.map.rooms[r.id]) continue;
      const fill = r.refuge && r.refuge !== 'imitation' ? (g.persist.refuges[r.id] ? 'rgba(127,197,150,0.25)' : 'rgba(127,197,150,0.1)') : 'rgba(232,226,204,0.08)';
      add('rect', { x: r.x0, y: -r.z1, width: r.w, height: r.d, fill, stroke: '#9a9686', 'stroke-width': 0.15 });
      add('text', { x: r.cx, y: -r.cz, 'font-size': Math.min(1.4, r.w / 6), fill: '#e8e2cc', 'text-anchor': 'middle', 'font-family': 'Arial' }, r.name);
      if (r.refuge && r.refuge !== 'imitation') add('text', { x: r.cx, y: -r.cz + 1.3, 'font-size': 0.9, fill: '#7fc596', 'text-anchor': 'middle', 'font-family': 'Arial' }, g.persist.refuges[r.id] ? `${r.refuge} · verified` : r.refuge);
    }
    for (const d of L.doors) {
      if (!g.map.doors[d.id]) continue;
      const known = g.map.rooms[d.a] || (d.b && g.map.rooms[d.b]);
      if (!known) continue;
      const locked = g.isDoorLocked(d);
      if (d.axis === 'x') add('line', { x1: d.bnd, y1: -(d.c - d.w / 2), x2: d.bnd, y2: -(d.c + d.w / 2), stroke: locked ? '#d0604a' : '#d9c27a', 'stroke-width': 0.5 });
      else add('line', { x1: d.c - d.w / 2, y1: -d.bnd, x2: d.c + d.w / 2, y2: -d.bnd, stroke: locked ? '#d0604a' : '#d9c27a', 'stroke-width': 0.5 });
    }
    for (const q of g.players.values()) {
      if (!q.active) continue;
      const a = add('circle', { cx: q.x, cy: -q.z, r: 0.6, fill: q === p ? '#d9c27a' : '#9cc3d8' });
      void a;
      if (q === p) add('line', { x1: q.x, y1: -q.z, x2: q.x - Math.sin(q.yaw) * 1.8, y2: -q.z + Math.cos(q.yaw) * 1.8, stroke: '#d9c27a', 'stroke-width': 0.3 });
    }
    body.append(el('div', { class: 'small dim' }, 'Discovered rooms, linked by doorways you have seen. Red doorways are locked. The map never shows creatures.'), el('div', { class: 'mapwrap' }, svg));
  }

  _jPhotos(body) {
    const app = this.app, g = app.game;
    const list = g.photos.slice().reverse();
    if (!list.length) { body.append(el('div', { class: 'dim' }, 'No photographs yet.')); return; }
    this.compare = this.compare || [];
    const grid = el('div', { class: 'photos' });
    const detail = el('div', { style: { marginTop: '16px' } });
    const showDetail = () => {
      clear(detail);
      if (this.compare.length === 2) {
        const [a, b] = this.compare.map((id) => g.photos.find((x) => x.id === id));
        detail.append(el('h3', {}, 'Comparison'), el('div', { class: 'compare' }, ...[a, b].map((ph) => el('div', {}, el('img', { src: app.photos.get(ph.id) || '', alt: ph.text.join(' ') }), el('div', { class: 'small', style: { marginTop: '6px' } }, ph.text.join(' '))))));
      } else if (this.compare.length === 1) {
        const ph = g.photos.find((x) => x.id === this.compare[0]);
        if (ph) detail.append(el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } }, el('img', { src: app.photos.get(ph.id) || '', style: { width: '480px', maxWidth: '55%' }, alt: ph.text.join(' ') }), el('div', {}, el('div', { class: 'caps small dim' }, `${ph.roomName || ''} · ${fmtTime(ph.t)}${ph.source === 'station' ? ' · survey station' : ''}${ph.flash ? ' · flash' : ''}`), ...ph.text.map((t) => el('p', {}, t)), el('div', { class: 'small dim' }, 'Select a second photo to compare side by side.'))));
      }
    };
    for (const ph of list) {
      const card = el('button', { class: `photo ${this.compare.includes(ph.id) ? 'sel' : ''}`, 'data-nav': '', onclick: () => {
        if (this.compare.includes(ph.id)) this.compare = this.compare.filter((x) => x !== ph.id);
        else { this.compare.push(ph.id); if (this.compare.length > 2) this.compare.shift(); }
        for (const c of grid.children) c.classList.toggle('sel', this.compare.includes(c.dataset.id));
        showDetail();
      } }, el('img', { src: app.photos.thumb(ph.id) || '', alt: ph.text[0] || 'photo' }), el('div', { class: 'pc' }, `${ph.roomName || ph.room || ''} · ${fmtTime(ph.t)}`));
      card.dataset.id = ph.id;
      grid.append(card);
    }
    body.append(grid, detail);
    showDetail();
  }

  _jEvidence(body) {
    const g = this.app.game;
    const E = [
      { id: 'E1', name: 'Lena\'s employee badge', where: 'Chapter two · toy shop staff locker', use: 'Supplies her original personnel number to the bypass.' },
      { id: 'E2', name: 'Rook\'s maintenance bypass key', where: 'Chapter three · engineer locker bay', use: 'Opens the maintenance lock.' },
      { id: 'E3', name: 'Evan and Lena\'s private memory', where: 'Chapter four · laundry and storage', use: 'The answer only Lena can confirm on an isolated line.' },
      { id: 'E4', name: 'Human pulse trace', where: 'Chapter five · medical telemetry booth', use: 'Proves a living reference.' },
    ];
    body.append(el('p', { class: 'dim' }, 'Optional proof. All four are needed for the Maintenance Bypass. Missing proof can be recovered through the freight return lift in the final chapter before the final gate is committed.'));
    const grid = el('div', { class: 'evidence' });
    for (const e of E) {
      const got = g.persist.evidence[e.id];
      grid.append(el('div', { class: `evi ${got ? 'got' : ''}` }, el('div', { class: 'eid' }, e.id), el('div', { style: { margin: '6px 0' } }, e.name), el('div', { class: 'small', style: { color: got ? 'var(--ok)' : 'var(--danger)' } }, got ? (g.story.has('P12.started') ? 'Collected · usable' : 'Collected') : 'Missing'), el('div', { class: 'small dim', style: { marginTop: '6px' } }, got ? e.use : e.where)));
    }
    body.append(grid);
  }

  _jRecords(body) {
    const app = this.app, g = app.game;
    const ids = Object.keys(RECORDS).filter((id) => g.persist.records[id] || app.profile.data.records[id]);
    body.append(el('div', { class: 'small dim' }, `${ids.length} of 36 records. Audio recordings can be replayed from a cassette deck in a refuge.`));
    for (const id of ids) {
      const R = RECORDS[id];
      body.append(el('button', { class: 'btn', 'data-nav': '', style: { display: 'block', width: '100%' }, onclick: () => this.reader(R.title, R.text, { audio: R.audio }) }, `${id} · ${R.title}${R.audio ? ' · audio' : ''}`, el('span', { class: 'why' }, `Chapter ${R.ch}`)));
    }
  }

  // ---------------------------------------------------------------- inventory
  inventory() {
    const app = this.app, g = app.game, p = g.players.get(app.pid);
    let sel = p.selected;
    const node = el('div', { class: 'inv' });
    const render = () => {
      clear(node);
      node.append(el('div', { class: 'row' }, el('h2', { class: 'caps', style: { letterSpacing: '0.3em' } }, 'Supply pouch'), el('div', { class: 'spacer' }), el('span', { class: 'small dim' }, `Composure ${Math.round(p.composure)} · Health ${Math.round(p.health)}`)));
      const slots = el('div', { class: 'slots' });
      p.pouch.forEach((s, i) => slots.append(el('button', { class: `slot ${i === sel ? 'sel' : ''}`, 'data-nav': '', onclick: () => { sel = i; render(); } }, el('div', {}, s ? ITEMS[s.item].name : 'Empty'), el('div', { class: 'q' }, s ? `×${s.n}` : ''))));
      node.append(slots);
      const s = p.pouch[sel];
      if (s) {
        const I = ITEMS[s.item];
        node.append(el('p', { class: 'dim' }, I.desc + (s.sub ? ` (${s.item === 'film' ? 'exposures in this pack' : 'marks left'}: ${s.sub.join(', ')})` : '')));
        const mates = [...g.players.values()].filter((q) => q !== p && q.active && Math.hypot(q.x - p.x, q.z - p.z) <= 2);
        node.append(el('div', { class: 'row' },
          btn('Use', () => { app.pouch(sel, 'use'); this.close('inventory'); }),
          btn('Equip', () => { app.pouch(sel, 'equip'); render(); }),
          btn('Drop', () => { app.pouch(sel, 'drop'); render(); }),
          ...mates.map((q) => btn(`Give to ${q.name}`, () => { app.pouch(sel, 'give', q.id); render(); }))));
      }
      node.append(el('div', { class: 'small dim', style: { marginTop: '12px' } }, `Tools: flashlight ${p.hasFlashlight ? Math.round(p.charge) + '%' : '—'} · camera ${p.hasCamera ? p.film + '/8' : '—'} · radio · journal. Tools and key evidence never use pouch slots.`), this.liveNote(), el('div', { class: 'row', style: { marginTop: '10px' } }, btn('Close', () => this.close('inventory'), { 'data-autofocus': '' })));
    };
    render();
    this.push('inventory', node);
  }

  // ---------------------------------------------------------------- refuge: map board & deck
  mapboard() {
    const app = this.app;
    const node = el('div', { class: 'sheet', style: { width: 'min(560px, 92vw)' } }, el('h2', {}, 'Map board'),
      el('p', { class: 'dim' }, 'Refuges save automatically. You can also keep up to three manual saves per campaign; the oldest is replaced.'));
    const list = el('div', { class: 'col' });
    const metas = app.saves.manualMeta(app.slot);
    metas.forEach((m, i) => list.append(el('div', { class: 'jentry' }, `Manual save ${i + 1}: `, m ? `Chapter ${m.chapter} · ${m.room || ''} · ${fmtTime(m.elapsed)} · ${new Date(m.updated).toLocaleString()}` : 'empty')));
    node.append(list, el('div', { class: 'row', style: { marginTop: '14px' } },
      btn('Manual save', () => { const ok = app.manualSave(); this.close('mapboard'); if (!ok) app.hud.toast('Could not save. Your previous checkpoint is intact.'); }, { 'data-autofocus': '' }),
      btn('Open map', () => { this.close('mapboard'); this.journal('Map'); }),
      btn('Save and quit', () => { this.close('mapboard'); app.saveAndQuit(); }),
      btn('Close', () => this.close('mapboard'))));
    this.push('mapboard', node);
  }

  deck() {
    const app = this.app, g = app.game;
    const node = el('div', { class: 'sheet', style: { width: 'min(620px, 92vw)' } }, el('h2', {}, 'Cassette deck'));
    const ids = Object.keys(RECORDS).filter((id) => RECORDS[id].audio && (g.persist.records[id] || app.profile.data.records[id]));
    if (!ids.length) node.append(el('p', { class: 'dim' }, 'No recordings collected yet.'));
    for (const id of ids) node.append(btn(`${RECORDS[id].title}`, () => { g.story.say('rook', 'recording', RECORDS[id].text); this.close('deck'); }));
    const lines = Object.keys(g.story.scenes).length;
    node.append(el('p', { class: 'small dim' }, `Collected recordings replay here. ${lines} story scenes are in your journal.`), btn('Close', () => this.close('deck'), { 'data-autofocus': '' }));
    this.push('deck', node);
  }

  notice(text) {
    const node = el('div', { class: 'sheet', style: { width: 'min(520px, 92vw)' } }, el('p', {}, text), el('div', { class: 'row' }, btn('OK', () => this.close('notice'), { 'data-autofocus': '' })));
    this.push('notice', node);
  }

  confirm(text, yes) {
    const node = el('div', { class: 'sheet', style: { width: 'min(520px, 92vw)' } }, el('p', {}, text), el('div', { class: 'row' }, btn('Yes', () => { this.close('confirm'); yes(); }), btn('No', () => this.close('confirm'), { 'data-autofocus': '' })));
    this.push('confirm', node, { pauses: true });
  }
}
void EQUIP;
