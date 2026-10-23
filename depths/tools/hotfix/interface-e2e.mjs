/**
 * Hotfix 1.0.1 interface checks that need a browser (headless Chromium,
 * software WebGL): controller focus in the inventory and journal, the
 * flash setting on the TEST LIGHT lamp, the radio tool's replay caption and
 * the captions drawn for sound-based puzzle cues.
 * Run: npm run build && node tools/hotfix/interface-e2e.mjs
 */
import { serve, launch } from '../shot.mjs';

const srv = await serve(4198);
const { browser, page, errors } = await launch();
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ok', name); } else { fail++; console.log('  FAIL', name); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const focused = () => ev(() => (document.activeElement ? document.activeElement.textContent : ''));

await page.goto('http://localhost:4198/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
await ev(() => window.__depths.startCampaign({ slot: 1, mode: 'solo', difficulty: 'standard', noDamage: true, timer: false, reducedStartle: false }));
await page.waitForFunction(() => window.__depths.state === 'game' && window.__depths.levelView && window.__depths.lights, null, { timeout: 120000 });
await frames(2);

// inventory: the selected slot takes focus and keeps it when chosen with A
await ev(() => window.__depths.overlays.inventory());
await frames(2);
ok(await ev(() => document.activeElement === document.querySelectorAll('.inv .slot')[0]), 'inventory opens focused on the selected slot');
await ev(() => { window.__depths.nav.move(1, 0); document.activeElement.click(); });
await frames(1);
ok(await ev(() => { const s = document.querySelectorAll('.inv .slot')[1]; return document.activeElement === s && s.classList.contains('sel'); }), 'choosing a slot keeps focus on it');
await ev(() => window.__depths.overlays.close('inventory'));

// journal: the open tab takes focus, a tab change keeps it, closing a record returns to it
await ev(() => { window.__depths.game.persist.records['01'] = true; window.__depths.overlays.journal(); });
await frames(2);
ok(await focused() === 'Objective', 'journal opens focused on the open tab');
await ev(() => { for (let i = 0; i < 4; i++) window.__depths.nav.move(1, 0); document.activeElement.click(); });
await frames(1);
ok(await ev(() => document.activeElement && document.activeElement.textContent === 'Records' && document.activeElement.classList.contains('on')), 'changing tabs keeps focus on the new tab');
await ev(() => { const b = [...document.querySelectorAll('.journal .body button')].find((x) => x.textContent.startsWith('01 ·')); if (b) { b.focus(); b.click(); } });
await frames(2);
ok(await focused() === 'Close', 'record reader takes focus');
await ev(() => document.activeElement.click());
await frames(1);
ok((await focused()).startsWith('01 ·'), 'closing the record returns focus to it in the journal');
await ev(() => window.__depths.overlays.closeAll());

// flash setting applies to the scripted TEST LIGHT lamp
const peak = (k) => ev((k) => { const a = window.__depths; a.settings.data.accessibility.flashIntensity = k; a._handleEvents([{ e: 'testLight' }]); return a.lights.extraPeak; }, k);
ok(await peak(1) === 30, 'TEST LIGHT at full intensity');
ok(Math.abs(await peak(0.3) - 9) < 1e-6, 'TEST LIGHT follows the gentle flash setting');
await ev(() => { window.__depths.settings.data.accessibility.flashIntensity = 1; });

// radio tool replays the last line as a caption
await ev(() => { const a = window.__depths, g = a.game; a.hud.captions.innerHTML = ''; g.story.lastLine = { sp: 'operator', src: 'radio', text: 'Maintenance crew, remain where you are.' }; g.equip('p1', 'radio'); g.useTool('p1'); });
await frames(3);
ok(await page.locator('.captions .cap:has-text("remain where you are")').count() > 0, 'radio tool replay shows the last line');

// captions for sound-based puzzle cues
await ev(() => {
  const a = window.__depths, p = a.game.players.get('p1');
  a.hud.captions.innerHTML = '';
  a._handleEvents([
    { e: 'tileLit', cell: 'B2' },
    { e: 'cycleClosed', label: 'Gallery shutters', x: p.x, z: p.z },
    { e: 'machine', running: true, label: 'Press', x: p.x, z: p.z, dur: 6 },
    { e: 'machine', running: false, label: 'Press', x: p.x, z: p.z },
  ]);
});
const capText = await ev(() => [...document.querySelectorAll('.captions .cap')].map((c) => c.textContent));
ok(capText.includes('[A soft tone: tile B2 holds]'), 'safe tile caption');
ok(capText.includes('[Gallery shutters closed]'), 'shutter caption');
ok(capText.includes('[Press at rest]') && !capText.some((t) => t.includes('Press running')), 'machine at rest replaces running');

const bad = errors.filter((e) => !/favicon/.test(e));
ok(bad.length === 0, `console free of errors (${bad.length})`);
if (bad.length) console.log(bad.slice(0, 20).join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
