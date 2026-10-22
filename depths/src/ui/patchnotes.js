/**
 * Patch notes view, shared by the main menu screen and the in-game overlay.
 * Versions are listed newest first; opening an entry clears its Unread mark
 * (stored in the profile). Fixes, gameplay changes and known issues always
 * appear, with "None." when a version has nothing in that section.
 */
import { el, clear } from './dom.js';
import { PATCH_NOTES } from '../data/patchnotes.js';
import { VERSION } from '../version.js';

export function unreadNotes(profile) {
  const read = profile.data.patchNotesRead || {};
  return PATCH_NOTES.filter((n) => !read[n.version]).map((n) => n.version);
}

export function markNotesRead(profile, version) {
  const d = profile.data;
  d.patchNotesRead = d.patchNotesRead || {};
  if (d.patchNotesRead[version]) return false;
  d.patchNotesRead[version] = Date.now();
  profile.persist();
  return true;
}

/** "2 unread" for menu buttons, or '' when everything has been opened. */
export function unreadLabel(profile) {
  const n = unreadNotes(profile).length;
  return n ? `${n} unread` : '';
}

function group(g, depth = 0) {
  const out = [el(depth ? 'h5' : 'h4', {}, g.title)];
  for (const t of [].concat(g.text || [])) out.push(el('p', {}, t));
  if (g.items) out.push(el('ul', {}, ...g.items.map((t) => el('li', {}, t))));
  for (const s of g.groups || []) out.push(...group(s, depth + 1));
  return out;
}

function entryView(n) {
  const out = el('article', { class: 'pn-entry' },
    el('div', { class: 'pn-title' }, n.title),
    el('div', { class: 'small dim' }, `Version ${n.version}${n.version === VERSION ? ' · installed' : ''}`),
    n.tagline ? el('p', { class: 'pn-tag' }, n.tagline) : null,
    ...(n.intro || []).map((t) => el('p', {}, t)));
  const section = (label, kids) => out.append(el('section', { class: 'pn-sec' }, el('h3', {}, label), ...(kids.length ? kids : [el('p', { class: 'dim' }, 'None.')])));
  if (n.added) section('New', n.added.flatMap((g) => group(g)));
  section('Fixes', (n.fixes || []).flatMap((g) => group(g)));
  section('Gameplay changes', (n.changes || []).flatMap((g) => group(g)));
  section('Known issues', n.known && n.known.length ? [el('ul', {}, ...n.known.map((t) => el('li', {}, t)))] : []);
  for (const g of n.notes || []) section(g.title, group({ ...g, title: '' }).slice(1));
  if (n.signoff) out.append(el('div', { class: 'pn-sign' }, ...n.signoff.map((t) => el('p', {}, t))));
  return out;
}

/** The version list and the selected entry. The newest entry opens first. */
export function patchNotesView(profile) {
  let sel = PATCH_NOTES[0].version;
  const list = el('div', { class: 'pn-list' });
  const body = el('div', { class: 'pn-body', tabindex: '-1' });
  const rows = PATCH_NOTES.map((n) => {
    const mark = el('span', { class: 'chip unread' }, 'Unread');
    const b = el('button', { class: 'pn-ver', 'data-nav': '', onclick: () => { sel = n.version; show(); body.scrollTop = 0; } },
      el('span', { class: 'v' }, n.version), el('span', { class: 't' }, n.title), mark,
      n.version === VERSION ? el('span', { class: 'chip' }, 'Installed') : null);
    if (n.version === sel) b.setAttribute('data-autofocus', '');
    list.append(b);
    return { n, b, mark };
  });
  const show = () => {
    markNotesRead(profile, sel);
    const unread = new Set(unreadNotes(profile));
    for (const r of rows) {
      r.b.classList.toggle('on', r.n.version === sel);
      r.b.setAttribute('aria-pressed', r.n.version === sel ? 'true' : 'false');
      r.mark.style.display = unread.has(r.n.version) ? '' : 'none';
    }
    clear(body);
    body.append(entryView(PATCH_NOTES.find((n) => n.version === sel)));
  };
  show();
  return el('div', { class: 'pn-main' }, list, body);
}
