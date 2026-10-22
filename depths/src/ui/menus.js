/**
 * Front-end screens: main menu, new campaign setup (slot, solo or host,
 * difficulty, assists, content note), settings (generated from the schema,
 * with rebinding and duplicate detection), chapter select, collection,
 * credits. Unavailable features state their unlock condition in plain text.
 */
import { el, clear, btn, fmtTime } from './dom.js';
import { SETTINGS_SCHEMA, ACTION_LABELS, ACCESS_PRESETS, getPath } from '../core/settings.js';
import { codeLabel } from '../core/input.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { RECORDS, RECORD_IDS } from '../data/records.js';
import { ACHIEVEMENTS, FINISHES, ENDINGS } from '../data/achievements.js';
import { CHAPTERS } from '../data/chapters/index.js';
import { CHARACTERS } from '../data/characters.js';
import { SLOTS } from '../game/saves.js';
import { seedToText, textToSeed } from '../core/rng.js';
import { X_THEMES } from '../sim/expedition.js';
import { patchNotesView, unreadLabel } from './patchnotes.js';
import { VERSION } from '../version.js';

const CHAPTER_NAMES = { 1: 'The Yellow Silence', 2: 'After Closing', 3: 'Stillwater', 4: 'The Residents', 5: 'Service Below', 6: 'The Unseen Depth' };

export class Menus {
  constructor(root, app) { this.root = root; this.app = app; this.layer = null; }

  _screen(node, onBack) {
    this.close();
    this.at = null;
    this.layer = el('div', { class: 'screen' }, node);
    this.root.appendChild(this.layer);
    this.app.nav.push(this.layer, onBack || (() => this.main()));
  }
  close() { if (this.layer) { this.app.nav.pop(this.layer); this.layer.remove(); this.layer = null; } }

  // ---------------------------------------------------------------- main
  main() {
    const app = this.app, P = app.profile;
    const last = app.saves.lastSlot();
    const lastMeta = last ? app.saves.meta(last) : null;
    const items = [];
    if (lastMeta) items.push(btn(el('span', {}, 'Continue', el('span', { class: 'why' }, `Slot ${last} · Chapter ${lastMeta.chapter} · ${CHAPTER_NAMES[lastMeta.chapter] || ''} · ${fmtTime(lastMeta.elapsed)}`)), () => app.continueSlot(last), { 'data-autofocus': '' }));
    items.push(btn('New Campaign', () => this.newCampaign(), lastMeta ? {} : { 'data-autofocus': '' }));
    items.push(btn(el('span', {}, 'Join Game', el('span', { class: 'why' }, app.netAvailable ? 'Enter a six-character invite code.' : 'Needs the self-hosted server: run npm run server and open its address.')), () => app.joinMenu && app.joinMenu(), { disabled: !app.netAvailable || !app.joinMenu ? true : null }));
    items.push(btn(el('span', {}, 'Expedition', el('span', { class: 'why' }, P.expeditionUnlocked ? 'A seeded run through twelve connected rooms.' : 'Unlocks after you complete any campaign ending.')), () => app.expeditionMenu && app.expeditionMenu(), { disabled: !P.expeditionUnlocked || !app.expeditionMenu ? true : null }));
    items.push(btn(el('span', {}, 'Chapter Select', el('span', { class: 'why' }, P.chapterSelectUnlocked ? 'Replay a completed chapter. Never overwrites a campaign checkpoint.' : 'Unlocks after you complete chapter one.')), () => this.chapterSelect(), { disabled: !P.chapterSelectUnlocked ? true : null }));
    items.push(btn('Collection', () => this.collection()));
    const unread = unreadLabel(P);
    items.push(btn(el('span', {}, 'Patch Notes', el('span', { class: `why${unread ? ' unread' : ''}` }, unread || `Version history · installed ${VERSION}`)), () => this.patchNotes()));
    items.push(btn('Settings', () => this.settings(() => this.main())));
    items.push(btn('Credits', () => this.credits()));
    const node = el('div', { class: 'menu-side' },
      el('div', { class: 'title' }, 'Depths of the Unseen', el('small', {}, 'Hazelbank Facilities · Annex')),
      el('div', { class: 'menu-list' }, ...items),
      el('div', { class: 'menu-foot' }, 'First-person survival horror for one to four players.', el('br'), 'Everything here is generated in code: rooms, sounds, voices and music.'));
    this._screen(node, () => {});
    this.layer.append(el('div', { class: 'version-tag' }, `Version ${VERSION}`));
    this.at = 'main';
    app.menuBackdrop(true);
  }

  // ---------------------------------------------------------------- patch notes
  patchNotes() {
    const node = el('div', { class: 'sheet pn' },
      el('div', { class: 'row' }, el('h2', {}, 'Patch notes'), el('div', { class: 'spacer' }), btn('Back', () => this.main())),
      patchNotesView(this.app.profile));
    this._screen(node, () => this.main());
    this.at = 'patchnotes';
  }

  // ---------------------------------------------------------------- new campaign
  newCampaign() {
    const app = this.app;
    const st = { slot: null, mode: 'solo', difficulty: 'standard', noDamage: false, timer: false, reducedStartle: app.settings.data.accessibility.reducedStartle, host: 'friends', character: 'evan' };
    for (let i = 1; i <= SLOTS; i++) if (!app.saves.meta(i)) { st.slot = i; break; }
    if (!st.slot) st.slot = 1;
    const node = el('div', { class: 'sheet' });
    const render = () => {
      clear(node);
      node.append(el('h2', {}, 'New campaign'));
      node.append(el('h3', {}, 'Save slot'));
      const slots = el('div', { class: 'cards' });
      for (let i = 1; i <= SLOTS; i++) {
        const m = app.saves.meta(i);
        slots.append(el('button', { class: `card ${st.slot === i ? 'on' : ''}`, 'data-nav': '', onclick: () => { st.slot = i; render(); } }, el('div', { class: 't' }, `Slot ${i}`), el('div', { class: 'd' }, m ? `In use: chapter ${m.chapter}, ${fmtTime(m.elapsed)}. Starting here replaces it.` : 'Empty')));
      }
      node.append(slots);
      node.append(el('h3', {}, 'Play'));
      node.append(seg([['solo', 'Solo (offline)'], ['host', 'Host online']], st.mode, (v) => { st.mode = v; render(); }));
      if (st.mode === 'host') {
        node.append(el('p', { class: 'small dim' }, app.netAvailable ? 'You host the session; up to three guests join with a six-character invite code. The save stays with you. No microphone is needed.' : 'Hosting needs the self-hosted relay server (npm run server). Open the game from the address it prints.'));
        node.append(seg([['friends', 'Friends'], ['invite', 'Invite only'], ['open', 'Open']], st.host, (v) => { st.host = v; render(); }));
      }
      node.append(el('h3', {}, 'Difficulty'));
      node.append(seg(Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label]), st.difficulty, (v) => { st.difficulty = v; render(); }));
      const D = DIFFICULTY[st.difficulty];
      node.append(el('p', { class: 'small dim' }, `Contact damage ×${D.damage} · enemy hearing ×${D.hearing} · pursuit speed ×${D.pursuit} · optional supplies ${Math.round(D.supply * 100)}% · hints ${D.hint === 'auto' ? `offered after ${D.hintAfter} s stalled` : `on request after ${D.hintAfter} s`} · co-op downed timer ${D.downed} s. Death always reloads the latest checkpoint. Difficulty can be changed later; it takes effect at the next refuge.`));
      node.append(el('h3', {}, 'Assists (available on every difficulty; achievements stay available)'));
      node.append(toggleRow('No Damage', 'Keeps scares, puzzles and endings, prevents health loss and replaces scripted captures with a fade and immediate reset.', st.noDamage, (v) => { st.noDamage = v; }));
      node.append(toggleRow('Timer assist', 'Removes countdowns while keeping their alarms.', st.timer, (v) => { st.timer = v; }));
      node.append(toggleRow('Reduced startle', 'First warning windows last one second longer; abrupt non-essential stingers are lowered.', st.reducedStartle, (v) => { st.reducedStartle = v; }));
      node.append(el('div', { class: 'row', style: { marginTop: '20px' } }, btn('Back', () => this.main()), el('div', { class: 'spacer' }), btn('Continue', () => this.contentNote(st), { class: 'btn primary', disabled: st.mode === 'host' && !app.netAvailable ? true : null })));
    };
    render();
    this._screen(node);
  }

  contentNote(st) {
    const app = this.app;
    const node = el('div', { class: 'sheet', style: { width: 'min(680px, 92vw)' } },
      el('h2', {}, 'Before you begin'),
      el('p', {}, 'This game contains confinement, pursuit by creatures, drowning imagery without forced submersion, distorted human figures and implied death.'),
      el('p', { class: 'dim' }, 'No location uses flashing as its only warning or a scream as its only clue. You can choose comfort settings now and change them at any time.'),
      el('div', { class: 'row', style: { flexWrap: 'wrap' } }, ...Object.entries(ACCESS_PRESETS).map(([k, p]) => btn(p.label, () => { app.settings.applyPreset(k); app.hud && app.hud.toast(`${p.label} preset applied.`); }))),
      el('div', { class: 'row', style: { marginTop: '20px' } }, btn('Back', () => this.newCampaign()), btn('Settings', () => this.settings(() => this.contentNote(st))), el('div', { class: 'spacer' }), btn('Begin', () => { this.close(); app.startCampaign(st); }, { class: 'btn primary', 'data-autofocus': '' })));
    this._screen(node, () => this.newCampaign());
  }

  // ---------------------------------------------------------------- settings
  settings(onBack) {
    const app = this.app, S = app.settings;
    let tab = this._settingsTab || 'Presets';
    const node = el('div', { class: 'sheet' });
    const render = () => {
      clear(node);
      node.append(el('div', { class: 'row' }, el('h2', {}, 'Settings'), el('div', { class: 'spacer' }), el('span', { class: 'small dim' }, S.saveOk === false ? 'Settings could not be stored in this browser.' : 'Settings are saved independently of any campaign.')));
      const tabs = el('div', { class: 'tabs' });
      for (const t of SETTINGS_SCHEMA.map((x) => x.tab)) tabs.append(el('button', { class: t === tab ? 'on' : '', 'data-nav': '', onclick: () => { tab = this._settingsTab = t; render(); } }, t));
      node.append(tabs);
      const T = SETTINGS_SCHEMA.find((x) => x.tab === tab);
      for (const it of T.items) node.append(this._settingItem(it, render));
      node.append(el('div', { class: 'row', style: { marginTop: '18px' } }, btn('Reset this tab', () => { S.resetTab(tab); render(); }), el('div', { class: 'spacer' }), btn('Done', () => { if (overlay) { app.overlays.close('settings'); } else (onBack || (() => this.main()))(); }, { class: 'btn primary' })));
    };
    render();
    const overlay = app.inGame;
    if (overlay) app.overlays.push('settings', node, { pauses: !app.coop });
    else this._screen(node, onBack || (() => this.main()));
  }

  _settingItem(it, rerender) {
    const S = this.app.settings;
    const v = getPath(S.data, it.key);
    if (it.type === 'presets') {
      return el('div', {}, el('p', { class: 'dim' }, it.note), el('div', { class: 'cards' }, ...Object.entries(ACCESS_PRESETS).map(([k, p]) => el('button', { class: `card ${S.data.preset === k ? 'on' : ''}`, 'data-nav': '', onclick: () => { S.applyPreset(k); rerender(); } }, el('div', { class: 't' }, p.label), el('div', { class: 'd' }, presetDesc(k))))), el('p', { class: 'small dim' }, S.data.preset === 'custom' ? 'Current: custom combination.' : ''));
    }
    if (it.type === 'bindings') return this._bindings(rerender);
    const row = el('div', { class: 'setting' }, el('div', {}, it.label));
    if (it.type === 'toggle') {
      const t = el('div', { class: `toggle ${v ? 'on' : ''}`, tabindex: 0, 'data-nav': '', role: 'switch', 'aria-checked': String(!!v), 'aria-label': it.label });
      const flip = () => { S.set(it.key, !getPath(S.data, it.key)); t.classList.toggle('on'); t.setAttribute('aria-checked', String(getPath(S.data, it.key))); };
      t.addEventListener('click', flip);
      t.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); flip(); } });
      row.append(t);
    } else if (it.type === 'slider') {
      const val = el('span', { class: 'val' }, it.fmt ? it.fmt(v) : String(v));
      const r = el('input', { type: 'range', min: it.min, max: it.max, step: it.step, value: v, 'data-nav': '', 'aria-label': it.label });
      r.addEventListener('input', () => { const x = +r.value; val.textContent = it.fmt ? it.fmt(x) : String(x); S.set(it.key, x); });
      row.append(el('div', { class: 'row' }, r, val));
    } else if (it.type === 'select') {
      row.append(seg(it.options.map(([a, b]) => [a, b]), v, (x) => { S.set(it.key, x); rerender(); }));
    }
    if (it.note) row.append(el('div', { class: 'note' }, it.note));
    return row;
  }

  _bindings(rerender) {
    const app = this.app, S = app.settings;
    const wrap = el('div', {});
    wrap.append(el('p', { class: 'small dim' }, 'Select a binding and press a key or mouse button. Escape cancels. Duplicates are highlighted; you can keep both or clear the other action. Controller layout: A interact/mantle, B crouch (back in panels), X reload, Y inventory, LB tool radial, RB ping, LT inspect, RT use, View journal, Menu pause, L3 sprint toggle, R3 camera flash, D-pad up flashlight, D-pad down callouts, LT + D-pad left/right lean.'));
    const counts = new Map();
    for (const codes of Object.values(S.data.controls.bindings)) for (const c of codes) if (c) counts.set(c, (counts.get(c) || 0) + 1);
    for (const action of Object.keys(ACTION_LABELS)) {
      const codes = S.data.controls.bindings[action];
      const mk = (slot) => {
        const c = codes[slot];
        const b = el('button', { class: c && counts.get(c) > 1 ? 'dup' : '', 'data-nav': '' }, c ? codeLabel(c) : '—');
        b.addEventListener('click', () => {
          b.textContent = 'Press…';
          app.input.capture((code) => {
            if (code === null) { rerender(); return; }
            const conf = S.conflicts(action, code);
            if (conf.length) {
              app.overlays.confirm(`${codeLabel(code)} is already used by ${conf.map((a) => ACTION_LABELS[a]).join(', ')}. Clear it there?`, () => { S.bind(action, slot, code, { clearConflicts: true }); rerender(); });
              S.bind(action, slot, code);
            } else S.bind(action, slot, code);
            rerender();
          });
        });
        return b;
      };
      wrap.append(el('div', { class: 'bind' }, el('div', {}, ACTION_LABELS[action]), mk(0), mk(1)));
    }
    return wrap;
  }

  // ---------------------------------------------------------------- chapter select
  chapterSelect() {
    const app = this.app, P = app.profile;
    const node = el('div', { class: 'sheet' }, el('h2', {}, 'Chapter select'), el('p', { class: 'dim' }, 'A replay is a separate instance with chapter-appropriate equipment and your previously collected proof. It never changes your campaign\'s story flags or overwrites a checkpoint. New records and achievements still count.'));
    const cards = el('div', { class: 'cards' });
    for (let i = 1; i <= 6; i++) {
      const done = P.data.chapters[i];
      const avail = !!CHAPTERS[i] && (done || P.data.chapters[i - 1] || i === 1 && done);
      cards.append(el('button', { class: `card ${avail ? '' : 'locked'}`, 'data-nav': '', disabled: avail ? null : true, onclick: () => { this.close(); app.startReplay(i); } }, el('div', { class: 't' }, `${i} · ${CHAPTER_NAMES[i]}`), el('div', { class: 'd' }, avail ? (done ? 'Completed' : 'Reached') : `Complete chapter ${i - 1} to unlock.`)));
    }
    node.append(cards, el('div', { class: 'row', style: { marginTop: '18px' } }, btn('Back', () => this.main())));
    this._screen(node);
  }

  // ---------------------------------------------------------------- collection
  collection(tab = 'Records') {
    const app = this.app, P = app.profile.data;
    const node = el('div', { class: 'sheet' });
    const tabs = ['Records', 'Photographs', 'Achievements', 'Endings', 'Camera finishes'];
    const render = () => {
      clear(node);
      node.append(el('h2', {}, 'Collection'));
      const tb = el('div', { class: 'tabs' });
      for (const t of tabs) tb.append(el('button', { class: t === tab ? 'on' : '', 'data-nav': '', onclick: () => { tab = t; render(); } }, t));
      node.append(tb);
      if (tab === 'Records') {
        node.append(el('p', { class: 'dim' }, `${Object.keys(P.records).length} of 36 records. Each is tracked with its chapter and room, so you can complete the set through chapter replay.`));
        for (const id of RECORD_IDS) {
          const got = P.records[id];
          const R = RECORDS[id];
          node.append(got ? btn(el('span', {}, `${id} · ${R.title}`, el('span', { class: 'why' }, `Chapter ${R.ch}${got.room ? ` · room ${got.room}` : ''}`)), () => app.overlays.reader(R.title, R.text, { audio: R.audio })) : el('div', { class: 'jentry dim' }, `${id} · Missing · Chapter ${R.ch}`));
        }
      } else if (tab === 'Photographs') {
        const S = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
        node.append(el('p', { class: 'dim' }, 'One secret photograph per chapter. Each is a lore collectible, never an enemy spawn.'));
        S.forEach((s, i) => node.append(el('div', { class: 'jentry' }, `Chapter ${i + 1}: `, P.secrets[s] ? 'Captured' : 'Not captured')));
      } else if (tab === 'Achievements') {
        node.append(el('p', { class: 'dim' }, 'All achievements are cosmetic and compatible with every assist.'));
        for (const a of ACHIEVEMENTS) node.append(el('div', { class: 'jentry' }, el('span', { class: 'tag' }, a.id), `${a.name} · `, el('span', { class: 'dim' }, a.cond), P.achievements[a.id] ? el('span', { style: { color: 'var(--ok)', marginLeft: '8px' } }, 'Earned') : null));
      } else if (tab === 'Endings') {
        for (const [k, e] of Object.entries(ENDINGS)) node.append(el('div', { class: 'jentry' }, `${e.name}: `, P.endings[k] ? 'Reached' : el('span', { class: 'dim' }, 'Not yet')));
      } else {
        node.append(el('p', { class: 'dim' }, 'Finishes change the camera shell only. They do not alter visibility to creatures.'));
        for (const f of FINISHES) {
          const own = P.finishes[f.id];
          node.append(own ? btn(el('span', {}, `${f.name}${P.finish === f.id ? ' · equipped' : ''}`, el('span', { class: 'why' }, f.cond)), () => { P.finish = f.id; app.profile.persist(); render(); }) : el('div', { class: 'jentry dim' }, `${f.name} · ${f.cond}`));
        }
      }
      node.append(el('div', { class: 'row', style: { marginTop: '18px' } }, btn('Back', () => this.main())));
    };
    render();
    this._screen(node);
  }

  // ---------------------------------------------------------------- join
  join() {
    const app = this.app;
    const st = { slot: 'mara' };
    const code = el('input', { class: 'seedin', maxlength: 6, placeholder: 'CODE', 'aria-label': 'Invite code', 'data-nav': '', spellcheck: 'false' });
    const name = el('input', { class: 'seedin', maxlength: 16, placeholder: 'NAME', 'aria-label': 'Your name', 'data-nav': '', value: app.profile.data.name || '', style: { letterSpacing: '0.1em', textTransform: 'none' } });
    const err = el('div', { class: 'small dim' }, 'The host shares a six-character code. The host keeps the save and has final campaign control.');
    const node = el('div', { class: 'sheet', style: { width: 'min(600px, 94vw)' } });
    const render = () => {
      clear(node);
      node.append(el('h2', {}, 'Join game'), el('div', { class: 'col' }, code, name,
        el('div', { class: 'small dim' }, 'Character'),
        seg(Object.entries(CHARACTERS).map(([k, c]) => [k, c.short]), st.slot, (v) => { st.slot = v; render(); }),
        el('div', { class: 'small dim' }, `${CHARACTERS[st.slot].name} · ${CHARACTERS[st.slot].role}. If someone already plays this character, the host assigns a free one.`),
        err),
        el('div', { class: 'row', style: { marginTop: '16px' } }, btn('Back', () => this.main()), el('div', { class: 'spacer' }), btn('Join', () => {
          const c = String(code.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (c.length !== 6) { err.textContent = 'Enter the six-character invite code.'; return; }
          app.profile.data.name = String(name.value || '').trim().slice(0, 16) || CHARACTERS[st.slot].short; app.profile.persist();
          this.close();
          app.joinGame(c, app.profile.data.name, st.slot);
        }, { class: 'btn primary' })));
    };
    render();
    this._screen(node);
  }

  // ---------------------------------------------------------------- expedition
  expedition() {
    const app = this.app, X = app.profile.data.expedition || { runs: [] };
    const suspended = app.saves.suspend();
    const input = el('input', { class: 'seedin', maxlength: 6, placeholder: 'SEED', 'aria-label': 'Seed (six characters)', 'data-nav': '', spellcheck: 'false' });
    const err = el('div', { class: 'small dim' }, 'Six characters, letters and digits. Share a seed and everyone gets the same rooms, puzzles and patrols.');
    const runs = (X.runs || []).slice(0, 8);
    const node = el('div', { class: 'sheet', style: { width: 'min(640px, 94vw)' } },
      el('h2', {}, 'Expedition'),
      el('p', { class: 'small' }, 'Twelve connected rooms from one environment and its creature: three objectives, a relay control, two genuine refuges and an extraction lift. Full health, sixty flashlight charge, four exposures, one bandage and one decoy. A death ends the run.'),
      el('div', { class: 'col' },
        suspended ? btn(el('span', {}, 'Resume suspended run', el('span', { class: 'why' }, `${suspended.expedition ? suspended.expedition.seedText : ''} · the suspend is used up when you resume`)), () => app.resumeExpedition(), { 'data-autofocus': '' }) : null,
        btn('New run · random seed', () => app.startExpedition((Math.random() * 32 ** 6) >>> 0), suspended ? {} : { 'data-autofocus': '' }),
        el('div', { class: 'row' }, input, btn('Play this seed', () => { const v = textToSeed(input.value); if (v === null) { err.textContent = 'That is not a valid seed: use six letters and digits (no I, O, 0 or 1).'; return; } app.startExpedition(v); })),
        err),
      el('h3', { style: { marginTop: '18px' } }, 'Personal records'),
      runs.length ? el('div', { class: 'xruns' }, ...runs.map((r) => el('div', { class: 'xrun' }, el('b', {}, r.seedText), ` ${X_THEMES[r.theme] ? X_THEMES[r.theme].name : r.theme} · ${r.success ? 'extracted' : 'lost'} · ${fmtTime(r.time)} · ${r.photos} photos · ${r.downs} downs`))) : el('p', { class: 'small dim' }, 'No runs yet.'),
      el('div', { class: 'small dim' }, `Completed runs: ${X.completed || 0}`),
      el('div', { class: 'row', style: { marginTop: '14px' } }, btn('Back', () => this.main())));
    this._screen(node);
  }

  // ---------------------------------------------------------------- post-credits
  postCredits(info) {
    const app = this.app, P = app.profile.data;
    const nRec = Object.keys(P.records).length, nSec = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].filter((k) => P.secrets[k]).length;
    const got = Object.keys(ENDINGS).filter((k) => P.endings[k]);
    const node = el('div', { class: 'ending' }, el('div', { class: 'card' },
      el('div', { class: 'et' }, 'Ending unlocked'),
      el('div', { class: 'en' }, ENDINGS[info.ending].name),
      el('div', { class: 'stats' },
        el('div', {}, el('b', {}, `${nRec} / ${RECORD_IDS.length}`), 'records found'),
        el('div', {}, el('b', {}, `${nSec} / 6`), 'secret photographs'),
        el('div', {}, el('b', {}, `${got.length} / 3`), 'endings: ', got.map((k) => ENDINGS[k].name).join(', '))),
      info.slot && info.finale ? el('p', { class: 'small dim' }, 'Continue loads the pre-finale checkpoint in Broadcast control, before the final choice. The rest of the campaign does not have to be replayed.') : null,
      el('div', { class: 'col', style: { maxWidth: '420px', margin: '0 auto' } },
        info.slot && info.finale ? btn('Continue · before the final choice', () => app.continueSlot(info.slot), { class: 'btn primary', 'data-autofocus': '' }) : null,
        btn('Chapter select', () => this.chapterSelect()),
        btn('Main menu', () => this.main(), info.slot && info.finale ? {} : { 'data-autofocus': '' }))));
    this._screen(node, () => this.main());
  }

  // ---------------------------------------------------------------- credits
  credits(after) {
    const app = this.app;
    const roll = el('div', { class: 'roll' },
      ...['DEPTHS OF THE UNSEEN', '', 'Design document · Version 1.0', '', 'Built as a browser game in three.js', '', 'Rooms, textures, creatures, voices, sounds and music', 'are generated in code at load time.', '', 'Cast', ...Object.values(CHARACTERS).map((c) => `${c.name} · ${c.role}`), 'Lena Ortiz · Missing coworker', 'June Ellis · Resident', 'Dr. Imani Rook · Relay engineer', 'The Operator · Dispatch', '', 'Thank you for playing.', '', '', ''].map((t) => el('div', {}, t)));
    const node = el('div', { class: 'credits' }, roll);
    let y = window.innerHeight;
    let t = 0;
    const skip = el('button', { class: 'btn', style: { position: 'absolute', right: '30px', bottom: '24px', opacity: 0.4 }, 'data-nav': '', disabled: true, onclick: () => done() }, 'Skip');
    node.append(skip);
    const done = () => { cancelAnimationFrame(raf); if (after) after(); else this.main(); };
    let raf;
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; last = now; t += dt;
      y -= dt * 42; roll.style.top = `${y}px`;
      if (t > 5) { skip.disabled = false; skip.style.opacity = 1; }
      if (y < -roll.offsetHeight) { done(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    this._screen(node, () => { if (t > 5) done(); });
  }
}

function seg(options, value, onPick) {
  const s = el('div', { class: 'seg' });
  for (const [k, label] of options) s.append(el('button', { class: k === value ? 'on' : '', 'data-nav': '', onclick: () => onPick(k) }, label));
  return s;
}
function toggleRow(label, note, value, onChange) {
  const t = el('div', { class: `toggle ${value ? 'on' : ''}`, tabindex: 0, 'data-nav': '', role: 'switch', 'aria-label': label });
  let v = value;
  const flip = () => { v = !v; t.classList.toggle('on', v); onChange(v); };
  t.addEventListener('click', flip);
  t.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); flip(); } });
  return el('div', { class: 'setting' }, el('div', {}, label), t, el('div', { class: 'note' }, note));
}
function presetDesc(k) {
  return {
    standard: 'Default comfort settings.',
    reducedMotion: 'No camera bob, head shake, hand tremor, grain or aberration. Steady lights. Gentle camera flash.',
    lowVision: 'Larger text and subtitles, high contrast prompts, brighter image, HUD always visible.',
    deafHoh: 'Subtitles with speaker names and direction tags, environmental captions, sound direction ring.',
    simplified: 'Holds become single presses; sprint and crouch toggle.',
  }[k];
}
export { CHAPTER_NAMES };
