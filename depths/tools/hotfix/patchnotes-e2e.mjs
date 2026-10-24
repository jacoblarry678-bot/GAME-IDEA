/**
 * Browser check for the 1.0.1 patch notes: version in the main menu corner,
 * the Unread indicator, newest-first entries with their sections, the pause
 * menu entry (solo pauses, online shows a notice first).
 * Run: npm run build && node tools/hotfix/patchnotes-e2e.mjs
 */
import { serve, launch } from '../shot.mjs';
import { mkdir } from 'node:fs/promises';
import { VERSION } from '../../src/version.js';

const OUT = new URL('../shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const srv = await serve(4198);
const { browser, page, errors } = await launch();
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ok', name); } else { fail++; console.log('  FAIL', name); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const click = (sel) => ev((s) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(s)); if (b) b.click(); return !!b; }, sel);

await page.goto('http://localhost:4198/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
ok((await page.locator('.version-tag').textContent()).includes(VERSION), 'main menu shows the installed version');
ok(await page.locator('button:has-text("Patch Notes") .why.unread').count() === 1, 'main menu marks unread patch notes');
await page.screenshot({ path: `${OUT}pn-menu.png` });

await click('Patch Notes');
await frames(2);
const vers = await ev(() => [...document.querySelectorAll('.pn-ver .v')].map((e) => e.textContent));
ok(vers[0] === VERSION && vers.length >= 2, `entries newest first (${vers.join(', ')})`);
ok(await ev(() => document.querySelector('.pn-ver.on .v').textContent) === VERSION, 'the newest entry opens first');
const heads = await ev(() => [...document.querySelectorAll('.pn-body h3')].map((e) => e.textContent));
ok(['Fixes', 'Gameplay changes', 'Known issues'].every((h) => heads.includes(h)), `sections present (${heads.join(', ')})`);
const marks = () => ev(() => [...document.querySelectorAll('.pn-ver')].map((b) => b.querySelector('.chip.unread').style.display !== 'none'));
eq((await marks())[0], false, 'opening the newest entry clears its Unread mark');
ok((await marks())[1] === true, 'older entry is still unread');
await page.screenshot({ path: `${OUT}pn-notes.png` });
await ev(() => document.querySelectorAll('.pn-ver')[1].click());
await frames(1);
ok((await marks()).every((m) => !m), 'opening the older entry clears it too');
ok(await ev(() => Object.keys(JSON.parse(localStorage.getItem('depths.profile')).patchNotesRead).length) === vers.length, 'read state is saved in the profile');
await click('Back');
await frames(2);
ok(await page.locator('button:has-text("Patch Notes") .why.unread').count() === 0, 'menu indicator clears after reading');

// in game: solo pauses, online shows a notice first
await click('New Campaign');
await frames(1);
await click('Continue');
await frames(1);
await click('Begin');
await page.waitForFunction(() => window.__depths.state === 'game' && window.__depths.game && window.__depths.levelView, null, { timeout: 120000 });
ok(!(await ev(() => document.getElementById('touch').classList.contains('on'))), 'no touch controls for mouse and keyboard play');
await ev(() => window.__depths.overlays.pause());
await frames(1);
ok(await click('Patch notes'), 'pause menu has Patch notes');
await frames(1);
ok(await ev(() => window.__depths.overlays.has('patchnotes') && window.__depths.overlays.pausing), 'solo play pauses while the notes are open');
const t0 = await ev(() => window.__depths.game.time);
await frames(5);
ok(await ev((t) => window.__depths.game.time === t, t0), 'simulation time stands still');
await click('Close');
await ev(() => { window.__depths.coop = true; window.__depths.overlays.patchNotes(); });
await frames(1);
ok(await page.locator('text=keeps running while you read').count() > 0, 'online play shows a notice before opening');
ok(!(await ev(() => window.__depths.overlays.has('patchnotes'))), 'notes wait for confirmation');
await click('Read patch notes');
await frames(1);
ok(await ev(() => window.__depths.overlays.has('patchnotes') && !window.__depths.overlays.pausing), 'online notes do not pause the session');
await ev(() => { window.__depths.overlays.closeAll(); window.__depths.coop = false; });

ok(errors.length === 0, `console free of errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);

function eq(a, b, name) { ok(a === b, name); }
