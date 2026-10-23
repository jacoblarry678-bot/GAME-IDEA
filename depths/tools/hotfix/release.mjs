/**
 * Hotfix 1.0.1 release checks: version, patch notes data and unread state,
 * the co-op version gate, save compatibility and the evidence re-check on
 * load. Run: node tools/hotfix/release.mjs
 */
import fs from 'node:fs';
import { VERSION } from '../../src/version.js';
import { PATCH_NOTES, LATEST_NOTES } from '../../src/data/patchnotes.js';
import { unreadNotes, markNotesRead, unreadLabel } from '../../src/ui/patchnotes.js';
import { normVersion } from '../../src/net/protocol.js';
import { Relay } from '../../server/relay.mjs';
import { Saves } from '../../src/game/saves.js';
import { Game } from '../../src/sim/game.js';

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function ok(c, msg = 'expected true') { if (!c) throw new Error(msg); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

function game(ch) {
  const g = new Game({ seed: 11 });
  g.addPlayer('p1', 'evan', 'Evan');
  g.loadChapter(ch, { entry: 'replay' });
  return g;
}
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

// ------------------------------------------------------------------ version and notes
test('installed version matches package.json and the newest patch notes', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  eq(VERSION, pkg.version, 'package.json');
  eq(LATEST_NOTES, VERSION, 'newest notes');
});

test('patch notes are newest first and every entry has its sections', () => {
  for (let i = 1; i < PATCH_NOTES.length; i++) ok(cmp(PATCH_NOTES[i - 1].version, PATCH_NOTES[i].version) > 0, `${PATCH_NOTES[i - 1].version} before ${PATCH_NOTES[i].version}`);
  for (const n of PATCH_NOTES) {
    ok(n.title && n.version, 'title and version');
    for (const g of [...(n.added || []), ...(n.fixes || []), ...(n.changes || []), ...(n.notes || [])]) {
      ok(g.title !== undefined, `${n.version} group title`);
      ok(g.items || g.groups || g.text, `${n.version} ${g.title} has content`);
    }
  }
  const hot = PATCH_NOTES[0];
  ok(hot.fixes.length >= 6 && hot.changes.length && hot.known.length, '1.0.1 has fixes, gameplay changes and known issues');
});

test('opening an entry clears its unread mark and persists', () => {
  let saved = 0;
  const profile = { data: {}, persist() { saved++; return true; } };
  eq(unreadNotes(profile), PATCH_NOTES.map((n) => n.version), 'all unread at first');
  eq(unreadLabel(profile), `${PATCH_NOTES.length} unread`);
  ok(markNotesRead(profile, VERSION), 'first open marks it');
  ok(!markNotesRead(profile, VERSION), 'second open is a no-op');
  eq(saved, 1, 'persisted once');
  ok(!unreadNotes(profile).includes(VERSION), 'cleared');
  for (const n of PATCH_NOTES) markNotesRead(profile, n.version);
  eq(unreadLabel(profile), '');
});

// ------------------------------------------------------------------ co-op version gate
function client(relay) {
  const box = [];
  const cl = relay.connect({ send: (s) => box.push(JSON.parse(s)), close() {} });
  return { cl, box, send: (o) => relay.onMessage(cl, JSON.stringify(o)) };
}

test('relay refuses a guest whose game version differs from the host', () => {
  const relay = new Relay();
  const host = client(relay);
  host.send({ t: 'host', name: 'Host', version: VERSION });
  const code = host.box.find((m) => m.t === 'hosted').code;
  const old = client(relay);
  old.send({ t: 'join', code, name: 'Old', slot: 'mara', ident: 'a' }); // 1.0.0 clients send no version
  const err = old.box.find((m) => m.t === 'error');
  ok(err && err.msg.includes(VERSION) && err.msg.includes('1.0.0'), `refusal names both versions: ${err && err.msg}`);
  ok(!host.box.some((m) => m.t === 'peer'), 'host never sees the refused guest');
  const cur = client(relay);
  cur.send({ t: 'join', code, name: 'New', slot: 'mara', ident: 'b', version: VERSION });
  ok(cur.box.some((m) => m.t === 'joined'), 'same version joins');
  const peer = host.box.find((m) => m.t === 'peer');
  eq(peer && peer.version, VERSION, 'peer carries the version');
  eq(relay.status().version, VERSION);
});

test('missing versions count as 1.0.0', () => {
  eq(normVersion(undefined), '1.0.0');
  eq(normVersion(''), '1.0.0');
  eq(normVersion('1.0.1'), '1.0.1');
});

// ------------------------------------------------------------------ saves
test('snapshots record the game version, and a 1.0.0 save still loads', () => {
  const g = game(2);
  const snap = g.serialize();
  eq(snap.game, VERSION);
  const old = JSON.parse(JSON.stringify(snap));
  delete old.game;
  const saves = new Saves();
  ok(saves.write(3, old), 'write');
  const r = saves.read(3);
  ok(r && r.from === 'active', 'read back');
  eq(saves.meta(3).game, '1.0.0', 'meta of an old save');
  const h = new Game({ seed: 5 }); h.addPlayer('p1', 'evan', 'Evan');
  h.restore(r.snap);
  eq(h.chapterId, 2);
});

test('an Expedition suspend keeps its photo thumbnails until it is resumed', () => {
  const saves = new Saves();
  const g = game(2);
  ok(saves.writeSuspend(g.serialize(), { ph1: 'data:image/jpeg;base64,AAAA' }), 'write');
  ok(saves.suspend(), 'snapshot');
  eq(saves.suspendPhotos(), { ph1: 'data:image/jpeg;base64,AAAA' }, 'thumbnails');
  saves.clearSuspend();
  ok(!saves.suspend(), 'snapshot consumed');
  eq(saves.suspendPhotos(), {}, 'thumbnails consumed with it');
});

test('loading re-checks evidence whose source is already satisfied', () => {
  const g = game(4);
  g.story.flags['ch4.mugSeen'] = true;
  g.story.flags['ch4.receiptSeen'] = true; // memory scene seen, but E3 never registered
  g.story.flags['E1.done'] = true;
  const snap = g.serialize();
  const h = new Game({ seed: 5 }); h.addPlayer('p1', 'evan', 'Evan');
  h.restore(snap);
  ok(h.story.has('E1') && h.persist.evidence.E1, 'E1 registered');
  ok(h.story.has('E3') && h.persist.evidence.E3, 'E3 registered');
  ok(!h.story.has('E2') && !h.persist.evidence.E2, 'E2 untouched');
  const prof = h.drainEvents().filter((e) => e.e === 'profile' && e.kind === 'evidence').map((e) => e.id).sort();
  eq(prof, ['E1', 'E3'], 'profile hears about the recovered proof');
  const again = new Game({ seed: 5 }); again.addPlayer('p1', 'evan', 'Evan');
  again.restore(h.serialize());
  eq(again.recheckEvidence(), [], 'nothing left to recover');
});

test('a story flag without persisted evidence is repaired on load', () => {
  const g = game(3);
  g.story.flags.E2 = true;
  const snap = g.serialize();
  snap.persist.evidence = {};
  const h = new Game({ seed: 5 }); h.addPlayer('p1', 'evan', 'Evan');
  h.restore(snap);
  ok(h.persist.evidence.E2, 'persisted');
});

console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
