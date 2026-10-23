/**
 * Hotfix 1.0.1 interface and accessibility checks (no browser).
 * Run: node tools/hotfix/interface.mjs
 * Covers caption trimming when dialogue and warnings overlap, subtitle
 * settings across a restart, text for sound-based puzzle cues, speaker
 * labels and a text guard. The HUD is built on a minimal stand-in for the
 * DOM: element tree, class names and text only. Focus and flash checks
 * need a browser: tools/hotfix/interface-e2e.mjs.
 */

class FakeNode {
  constructor(tag, text = '') { this.tagName = tag; this.children = []; this.parent = null; this.className = ''; this.text = text; this.style = { setProperty(k, v) { this[k] = v; } }; this.dataset = {}; this.attrs = {}; }
  get classList() { const n = this; return { contains: (c) => n.className.split(/\s+/).includes(c), toggle() {} }; }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this.text = String(v); }
  appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c; }
  append(...cs) { for (const c of cs) if (c != null) this.appendChild(typeof c === 'string' ? new FakeNode('#text', c) : c); }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return c; }
  remove() { if (this.parent) this.parent.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
}
globalThis.document = { createElement: (t) => new FakeNode(t), createTextNode: (s) => new FakeNode('#text', s) };

const { readFileSync, readdirSync } = await import('node:fs');
const { Hud } = await import('../../src/ui/hud.js');
const { Settings } = await import('../../src/core/settings.js');
const { remove } = await import('../../src/core/storage.js');
const { Game } = await import('../../src/sim/game.js');
const { closeCycle, openCycle } = await import('../../src/sim/shutters.js');
const { startMachine } = await import('../../src/sim/machines.js');
const { SCENES, SPEAKERS, SOURCES } = await import('../../src/data/dialogue.js');
const { ACHIEVEMENTS } = await import('../../src/data/achievements.js');

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function ok(c, msg = 'expected true') { if (!c) throw new Error(msg); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const hud = () => new Hud(new FakeNode('div'), { settings: new Settings() });
const caps = (h) => h.captions.children.map((c) => c.textContent);

/** A game positioned in a chapter (replay entry), with one player who takes no damage. */
function game(ch) {
  const g = new Game({ seed: 11, assists: { noDamage: true } });
  g.addPlayer('p1', 'evan', 'Evan');
  g.loadChapter(ch, { entry: 'replay' });
  g.drainEvents();
  return g;
}
const P = (g) => g.players.get('p1');
const run = (g, sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) g.tick(0.05); };
const events = (g, kind) => g.drainEvents().filter((e) => e.e === kind);

// ------------------------------------------------------------------ 1. subtitles and warnings
test('a radio line stays on screen while environmental warnings pile up', () => {
  const h = hud();
  h.line({ sp: 'operator', src: 'radio', text: 'Maintenance crew, remain where you are.', dur: 6 });
  h.envCaption('Three floor dents advancing toward you.', { warn: true, dir: 'ahead' });
  for (let n = 1; n <= 3; n++) h.envCaption(`[Floor dent ${n} of 3]`, { warn: true, dur: 1.2 });
  ok(caps(h).some((t) => t.includes('remain where you are')), 'radio line was pushed off screen');
  ok(caps(h).includes('[Floor dent 3 of 3]'), 'newest warning shown');
  eq(h.captions.children.filter((c) => c.classList.contains('env')).length, 3, 'warnings keep their own limit of three');
});
test('warnings are not pushed off screen by dialogue either', () => {
  const h = hud();
  h.envCaption('The tile sinks and cracks. Step back.', { warn: true });
  for (let i = 0; i < 4; i++) h.line({ sp: 'lena', src: 'radio', text: `Line ${i}`, dur: 3 });
  ok(caps(h).includes('The tile sinks and cracks. Step back.'), 'warning was pushed off screen');
  eq(caps(h).filter((t) => t.includes('Line')).length, 3, 'dialogue keeps its own limit of three');
});

// ------------------------------------------------------------------ 2. subtitle settings survive a restart
// a restart is a new Settings read from the same storage
test('subtitle size and background survive a restart', () => {
  remove('settings');
  const s = new Settings();
  s.set('accessibility.subtitleSize', 1.6);
  s.set('accessibility.subtitleBg', 0.3);
  const r = new Settings();
  eq(r.data.accessibility.subtitleSize, 1.6, 'subtitle size');
  eq(r.data.accessibility.subtitleBg, 0.3, 'subtitle background');
  eq(r.data.preset, 'custom', 'a changed comfort value marks the preset custom');
});
test('a preset\'s subtitle size survives a restart, and other tabs\' resets leave it alone', () => {
  remove('settings');
  new Settings().applyPreset('lowVision');
  const r = new Settings();
  eq(r.data.accessibility.subtitleSize, 1.4, 'low vision subtitle size');
  eq(r.data.preset, 'lowVision');
  r.set('accessibility.subtitleSize', 1.8);
  r.resetTab('Visual comfort');
  r.resetTab('Audio');
  eq(new Settings().data.accessibility.subtitleSize, 1.8, 'after resetting other tabs');
  r.resetTab('Subtitles');
  eq(new Settings().data.accessibility.subtitleSize, 1.0, 'resetting the Subtitles tab restores the default');
  remove('settings');
});

// ------------------------------------------------------------------ 5. text for sound-based puzzle cues
// Puzzles whose solution depends on hearing, and the text that stands in for each cue:
//   P2 tone test, E1 keypad, P3 shutter order, P10 lock, P11 patch board: panel display and message
//   P4 closing announcement: subtitle plus a caption for where the figures went
//   P5 pump, E2 latch, E4 TEST LIGHT, P9 weights, expedition zone test: panel message
//   P6 reflection tiles: warning on a cracking tile, caption on a safe tile's tone (tileLit)
//   overflow levers (pool crossing): caption
//   gallery and display shutter cycles: warning, then captions when they close and open (cycleClosed / cycleOpen)
//   machine cover (press corridor, catwalk): caption for the whole running phase, replaced at rest
test('P6 reflection tiles: a cracking tile warns in text, a safe tile reports its cell', () => {
  const g = game(3);
  Object.assign(P(g), { x: 11.25, z: 37.25 }); run(g, 0.1);
  ok(events(g, 'warning').some((e) => /cracks/.test(e.text)), 'cracking tile warning text');
  Object.assign(P(g), { x: 13.75, z: 37.25 }); run(g, 0.1);
  eq(events(g, 'tileLit').map((e) => e.cell), ['B1'], 'safe tile event names the cell');
});
test('shutter cycles: closing warns in text, closed and reopened events carry the shutter name', () => {
  const g = game(2);
  closeCycle(g, 'gallery');
  ok(events(g, 'warning').some((e) => /Gallery shutters: warning tone/.test(e.text)), 'closing warning');
  run(g, 3.2);
  const closed = g.drainEvents().find((e) => e.e === 'cycleClosed');
  ok(closed && closed.label === 'Gallery shutters' && Number.isFinite(closed.x), 'closed event with name and position');
  openCycle(g, 'gallery');
  eq(events(g, 'cycleOpen').map((e) => e.label), ['Gallery shutters'], 'reopened event with name');
});
test('machine cover: running events say how long the cover lasts', () => {
  const g = game(5);
  run(g, 12.2);
  const ev = g.drainEvents().filter((e) => e.e === 'machine' && e.id === 'press1');
  ok(ev.some((e) => !e.running), 'press rests');
  ok(ev.some((e) => e.running && e.dur === 6), 'running again for six seconds');
  startMachine(g, 'press1', { until: 10 });
  ok(events(g, 'machine').some((e) => e.running && e.dur === 10), 'a timed start reports its duration');
});
test('machine captions: the at-rest caption replaces the running caption', () => {
  const h = hud();
  h.envCaption('[Press running: footsteps covered]', { dur: 6, key: 'machine:Press' });
  h.envCaption('[Press running: footsteps covered]', { dur: 6, key: 'machine:Press' });
  eq(caps(h), ['[Press running: footsteps covered]'], 'three presses in step share one caption');
  h.envCaption('[Press at rest]', { dur: 2, key: 'machine:Press' });
  eq(caps(h), ['[Press at rest]']);
});
test('P4 closing announcement: both outcomes are captioned', () => {
  const g = game(2), pz = g.puzzles.get('P4');
  pz.input(P(g), 'play');
  ok(events(g, 'caption').some((e) => /figures stay by the service exit/.test(e.text)), 'failure caption');
  pz.state.cooldown = 0; pz.state.playing = 0;
  for (const a of ['zone:atrium', 'zone:service', 'zone:west']) pz.input(P(g), a);
  pz.input(P(g), 'play');
  ok(events(g, 'caption').some((e) => /shuffle west/.test(e.text)), 'success caption');
});
test('pool overflow lever and TEST LIGHT give text with their sounds', () => {
  const g = game(3);
  const lever = g.level.interactables.find((it) => it.kind === 'overflow');
  g.script.onInteract(g, P(g), lever, 'begin');
  ok(events(g, 'caption').some((e) => /Water rushes/.test(e.text)), 'overflow caption');
  const h = game(5);
  h.puzzles.get('E4').input(P(h), 'channel');
  ok(/trace jumps/.test(h.puzzles.get('E4').input(P(h), 'test').msg), 'TEST LIGHT response in text');
});

// ------------------------------------------------------------------ 6. speaker labels and text
const SRC = new URL('../../src/', import.meta.url).pathname;
const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? sources(`${dir}${d.name}/`) : d.name.endsWith('.js') ? [`${dir}${d.name}`] : []));
const FILES = sources(SRC).map((f) => ({ f: f.slice(SRC.length), text: readFileSync(f, 'utf8') }));
test('every dialogue beat names a known speaker and source', () => {
  const bad = [];
  for (const [id, beats] of Object.entries(SCENES)) for (const b of beats) if (b.text !== undefined && (!SPEAKERS[b.sp] || !(b.src in SOURCES))) bad.push(`${id}: ${b.text}`);
  eq(bad, [], 'beats without speaker or source');
});
test('every scripted line outside the scenes names a known speaker and source', () => {
  const bad = [];
  let n = 0;
  for (const { f, text } of FILES) {
    for (const m of text.matchAll(/\.say\(\s*'([^']*)',\s*'([^']*)'/g)) { n++; if (!SPEAKERS[m[1]] || !(m[2] in SOURCES)) bad.push(`${f}: ${m[0]}`); }
    for (const m of text.matchAll(/hud\.line\(\{ sp: '([^']*)', src: '([^']*)'/g)) { n++; if (!SPEAKERS[m[1]] || !(m[2] in SOURCES)) bad.push(`${f}: ${m[0]}`); }
  }
  ok(n >= 10, `found ${n} scripted lines`);
  eq(bad, [], 'lines without a known speaker');
});
test('text has no doubled words or unhyphenated compound numbers', () => {
  // scans whole source lines: these patterns do not occur in code, so strings, records and journal text are all covered
  const bad = [];
  for (const { f, text } of FILES) {
    text.split('\n').forEach((line, i) => {
      const dup = /\b([a-z]{2,})[ \t]+\1\b/i.exec(line);
      if (dup || /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety) (one|two|three|four|five|six|seven|eight|nine)\b/i.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  eq(bad, []);
  ok(ACHIEVEMENTS.find((a) => a.id === 'A11').cond.includes('thirty-six'), 'A11 reads thirty-six');
});

console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
