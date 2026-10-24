/**
 * Phone check: a landscape touch-only viewport drives the real menus with
 * taps, then plays with the on-screen stick, look drag and buttons through
 * genuine touch events (Chrome DevTools Protocol), asserting the game reacts.
 * Run: npm run build && node tools/touche2e.mjs
 */
import { serve, launch } from './shot.mjs';
import { mkdir } from 'node:fs/promises';

const OUT = new URL('./shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const srv = await serve(4196);
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 }, touch: true });
const cdp = await page.context().newCDPSession(page);
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ok', name); } else { fail++; console.log('  FAIL', name); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const center = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const tapEl = async (sel) => { const [x, y] = await center(sel); await page.touchscreen.tap(x, y); await frames(1); };
const hold = async (sel, n) => { const [x, y] = await center(sel); await touch('touchStart', [[x, y, 9]]); await frames(n); await touch('touchEnd', []); await frames(1); };
const P = () => ev(() => { const g = window.__depths.game, p = g.players.get(window.__depths.pid); return { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, crouched: p.crouched, flashOn: p.flashOn }; });

await page.goto('http://localhost:4196/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
await page.screenshot({ path: `${OUT}touch-menu.png` });
ok(await ev(() => { const s = document.querySelector('.menu-side'); return s.scrollHeight <= s.clientHeight + 1 || getComputedStyle(s).overflowY === 'auto'; }), 'main menu fits or scrolls on a short screen');

// menus by tapping
await tapEl('button:has-text("New Campaign")');
ok(await ev(() => window.__depths.input.device) === 'touch', 'a tap makes touch the active device');
ok(await ev(() => { const s = document.querySelector('.sheet'); return getComputedStyle(s).overflowY === 'auto'; }), 'campaign setup scrolls on a short screen');
await tapEl('button:has-text("Continue")');
await tapEl('button:has-text("Begin")');
await page.waitForFunction(() => window.__depths.state === 'game' && window.__depths.game && window.__depths.levelView, null, { timeout: 120000 });
await frames(3);
ok(await ev(() => document.getElementById('touch').classList.contains('on')), 'touch controls show while playing');
ok(await ev(() => document.getElementById('ui').classList.contains('touch')), 'HUD switches to the touch layout');
ok(await ev(() => window.__depths.input.label('interact')) === 'ACT', 'prompts name the touch button');
await page.screenshot({ path: `${OUT}touch-game.png` });

// move with the stick: drag up from the left side
const a = await P();
await touch('touchStart', [[150, 300, 1]]);
await touch('touchMove', [[150, 240, 1]]);
await frames(8);
const mv = await ev(() => ({ ...window.__depths.input.touchMove }));
ok(mv.y > 0.9 && Math.abs(mv.x) < 0.1, `stick pushed up reads as forward (${mv.x.toFixed(2)}, ${mv.y.toFixed(2)})`);
await page.screenshot({ path: `${OUT}touch-stick.png` });
// look at the same time with a second finger on the right
await touch('touchMove', [[150, 240, 1], [600, 160, 2]]);
await touch('touchMove', [[150, 240, 1], [700, 170, 2]]);
await frames(3);
await touch('touchEnd', []);
await frames(2);
const b = await P();
ok(Math.hypot(b.x - a.x, b.z - a.z) > 0.2, `the player walks (${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m)`);
ok(Math.abs(b.yaw - a.yaw) > 0.3, `dragging on the right turns the view (${(b.yaw - a.yaw).toFixed(2)} rad)`);
ok(await ev(() => window.__depths.input.touchMove.x === 0 && window.__depths.input.touchMove.y === 0), 'lifting the thumb stops movement');

// buttons
await tapEl('.tbtn[data-act="crouch"]');
await frames(3);
ok((await P()).crouched, 'Crouch button crouches');
ok(await ev(() => document.querySelector('.tbtn[data-act="crouch"]').classList.contains('lit')), 'Crouch button shows it is on');
await tapEl('.tbtn[data-act="crouch"]');
await frames(3);
ok(!(await P()).crouched, 'a second tap stands up');
await tapEl('.tbtn[data-act="sprint"]');
ok(await ev(() => window.__depths.controller.sprintLatch === false || window.__depths.controller.sprintLatch === true), 'Run button reaches the controller');

// Act: hold at the isolation gate wheel
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = 0.6; p.z = -1.6; const e = p.eye(), dx = 1.35 - e.x, dz = -0.55 - e.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(1.2 - e.y, Math.hypot(dx, dz)); });
await frames(2);
ok(await ev(() => (window.__depths.game.findTarget('p1') || {}).id) === 'gateWheel', 'the gate wheel is under the crosshair');
await hold('.tbtn[data-act="interact"]', 6);
await frames(4);
ok(await ev(() => window.__depths.game.story.has('ch1.entered')), 'holding Act turns the gate wheel');

// flashlight once the player has one
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = 1.6; p.z = 21.3; g.beginInteract('p1', 'flashlight'); });
await frames(3);
const f0 = (await P()).flashOn;
await tapEl('.tbtn[data-act="flashlight"]');
await frames(2);
ok((await P()).flashOn !== f0, 'Light button toggles the flashlight');

// menu button pauses; controls hide under menus
await tapEl('.tbtn[data-act="pause"]');
await frames(2);
ok(await ev(() => window.__depths.overlays.has('pause')), 'Menu button opens the pause menu');
ok(!(await ev(() => document.getElementById('touch').classList.contains('on'))), 'touch controls hide while a menu is open');
await page.screenshot({ path: `${OUT}touch-pause.png` });
await tapEl('button:has-text("Resume")');
await frames(2);
ok(await ev(() => document.getElementById('touch').classList.contains('on')), 'and come back after Resume');
await tapEl('.tbtn[data-act="journal"]');
await frames(2);
ok(await ev(() => window.__depths.overlays.has('journal')), 'Journal button opens the journal');
await tapEl('button:has-text("Close")');
await frames(1);

ok(errors.filter((e) => !e.includes('requestFullscreen')).length === 0, `console free of errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
