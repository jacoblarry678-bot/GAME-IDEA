/**
 * Hotfix 1.0.1 interface and accessibility checks (no browser).
 * Run: node tools/hotfix/interface.mjs
 * Covers caption trimming when dialogue and warnings overlap. The HUD is
 * built on a minimal stand-in for the DOM: element tree, class names and
 * text only.
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

const { Hud } = await import('../../src/ui/hud.js');
const { Settings } = await import('../../src/core/settings.js');

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function ok(c, msg = 'expected true') { if (!c) throw new Error(msg); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const hud = () => new Hud(new FakeNode('div'), { settings: new Settings() });
const caps = (h) => h.captions.children.map((c) => c.textContent);

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

console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
