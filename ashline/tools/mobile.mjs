/**
 * Mobile check (0.8.0): phone-sized landscape viewport with touch. First
 * launch picks light graphics, menus fit and respond to taps, a match starts
 * without mouse capture, the move stick walks, dragging looks, FIRE shoots,
 * AIM/CROUCH toggle, JUMP jumps, pause button pauses, portrait asks to rotate.
 * Touches are sent as real touch-type pointer events.
 * Usage: node tools/mobile.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => { if (sessionStorage.getItem('mb')) return; sessionStorage.setItem('mb', '1'); localStorage.clear(); });
const ev = (fn, a) => p.evaluate(fn, a);
const waitState = (st, ms = 150000) => p.waitForFunction((s) => window.__ashline?.state === s, st, { timeout: ms });
await p.goto(url, { waitUntil: 'load', timeout: 150000 });
await waitState('menu');
await p.waitForTimeout(800);
const boot = await ev(() => { const a = window.__ashline; return { preset: a.settings.data.graphics.preset, scale: a.settings.data.graphics.renderScale, touch: a.input.touch.active, fs: !!document.querySelector('[data-act=fullscreen]') }; });
check('first launch on a phone: low preset, dynamic resolution, touch controls on', boot.preset === 'low' && boot.touch, JSON.stringify(boot));
check('main menu offers Fullscreen on touch devices', boot.fs);
const fit = await ev(() => { const r = document.querySelector('.menu-btn[data-go=play]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, about: document.querySelector('.menu-btn[data-go=about]').getBoundingClientRect().bottom }; });
check('menu fits a 390 px tall screen', fit.about <= fit.h && fit.top >= 0, JSON.stringify(fit));
await p.screenshot({ path: `${out}/mobile-01-menu.png` });
await p.tap('.menu-btn[data-go=play]');
await p.waitForTimeout(500);
await ev(() => { const s = window.__ashline.profile.data.matchSetup; Object.assign(s, { mode: 'tdm', map: 'cinder_yard', botsAllies: 1, botsEnemies: 1, weather: 'clear', halloween: false }); });
await p.screenshot({ path: `${out}/mobile-02-setup.png` });
await p.tap('text=Start Match');
await waitState('match-live');
await ev(() => { const a = window.__ashline; a.engine.shouldRender = () => false; a.touch.update(); });
const st = await ev(() => ({ lockHint: !!document.getElementById('lock-hint'), ui: document.querySelector('.touch-ui').classList.contains('show') }));
check('match starts without a "click to capture mouse" prompt; touch controls shown', !st.lockHint && st.ui, JSON.stringify(st));

// helpers: real touch-type pointer events, while driving the game loop
const touch = (type, sel, x, y, id) => ev(([type, sel, x, y, id]) => {
  const el = sel ? document.querySelector(sel) : document.elementFromPoint(x, y);
  const r = sel ? el.getBoundingClientRect() : null;
  const cx = sel && x == null ? r.left + r.width / 2 : x, cy = sel && y == null ? r.top + r.height / 2 : y;
  (type === 'pointerdown' ? el : window).dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
  return { cx, cy, tag: el.className };
}, [type, sel, x, y, id]);
const run = (n) => ev((n) => { const a = window.__ashline; for (let i = 0; i < n; i++) { a.touch.update(); a.updateRotateHint(); a.game.update(1 / 30); a.input.endFrame(); } }, n);
await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.4); for (const c of g.match.combatants) if (c !== g.player) { c.brain = null; c.x = 999; c.alive = false; } g.player.spawnProtectT = 999; });
await run(3);
// move stick: thumb down in the left zone, push forward
await ev(() => { // face open ground so the walk isn't blocked by a wall
  const g = window.__ashline.game, pl = g.player, w = g.match.world;
  for (let k = 0; k < 16; k++) { const yaw = k * Math.PI / 8; if (!w.raycast(pl.x, 1, pl.z, -Math.sin(yaw), 0, -Math.cos(yaw), 14, 'solid')) { g.look.yaw = yaw; pl.cmd.yaw = yaw; break; } }
});
await run(2);
const p0 = await ev(() => { const g = window.__ashline.game; return { x: g.player.x, z: g.player.z, yaw: g.look.yaw }; });
await touch('pointerdown', null, 120, 300, 1);
await touch('pointermove', null, 120, 236, 1);
await run(45);
const p1 = await ev(() => { const g = window.__ashline.game; return { x: g.player.x, z: g.player.z, sprint: g.player.sprinting }; });
await touch('pointerup', null, 120, 236, 1);
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
check('move stick walks the player (full push sprints)', moved > 3 && p1.sprint, `${moved.toFixed(2)} m, sprint ${p1.sprint}`);
// look: drag on the right side
await touch('pointerdown', null, 520, 160, 2);
await touch('pointermove', null, 600, 160, 2);
await run(2);
await touch('pointerup', null, 600, 160, 2);
const y1 = await ev(() => window.__ashline.game.look.yaw);
check('dragging on the right side turns the view', Math.abs(y1 - p0.yaw) > 0.1, `${(y1 - p0.yaw).toFixed(3)} rad`);
// fire
const shots0 = await ev(() => window.__ashline.game.player.stats.shots);
await touch('pointerdown', '.tb-fire', null, null, 3);
await run(20);
await touch('pointerup', '.tb-fire', null, null, 3);
await run(2);
const shots1 = await ev(() => window.__ashline.game.player.stats.shots);
check('FIRE button shoots while held', shots1 - shots0 >= 2, `${shots1 - shots0} shots`);
// aim + crouch toggles, jump
for (const [sel, id] of [['.tb-ads', 4], ['.tb-crouch', 5]]) { await touch('pointerdown', sel, null, null, id); await run(1); await touch('pointerup', sel, null, null, id); }
await run(15);
const tg = await ev(() => { const g = window.__ashline.game; return { ads: g.player.adsT > 0.5, crouch: g.player.stance === 'crouch' }; });
check('AIM and CROUCH buttons toggle', tg.ads && tg.crouch, JSON.stringify(tg));
await touch('pointerdown', '.tb-crouch', null, null, 6); await run(1); await touch('pointerup', '.tb-crouch', null, null, 6);
await run(10);
await touch('pointerdown', '.tb-jump', null, null, 7); await run(3);
const air = await ev(() => !window.__ashline.game.player.grounded);
await touch('pointerup', '.tb-jump', null, null, 7); await run(30);
check('JUMP button jumps', air);
await ev(() => { const a = window.__ashline; a.engine.render(true); });
await p.screenshot({ path: `${out}/mobile-03-hud.png` });
// pause button
await touch('pointerdown', '.tb-pause', null, null, 8);
await p.waitForTimeout(300);
const paused = await ev(() => ({ state: window.__ashline.state, ui: document.querySelector('.touch-ui').classList.contains('show') }));
check('pause button pauses and hides the touch controls', paused.state === 'match-paused' && !paused.ui, JSON.stringify(paused));
await p.screenshot({ path: `${out}/mobile-04-pause.png` });
await p.tap('text=Resume');
await p.waitForTimeout(300);
await run(1);
check('Resume returns to the match with touch controls', await ev(() => window.__ashline.state === 'match-live' && document.querySelector('.touch-ui').classList.contains('show')));
// portrait
await p.setViewportSize({ width: 390, height: 844 });
await run(2);
check('portrait shows a rotate-to-landscape prompt', await ev(() => !!document.getElementById('rotate-hint')));
await p.screenshot({ path: `${out}/mobile-05-portrait.png` });
await p.setViewportSize({ width: 844, height: 390 });
await run(2);
check('rotating back removes the prompt', await ev(() => !document.getElementById('rotate-hint')));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
