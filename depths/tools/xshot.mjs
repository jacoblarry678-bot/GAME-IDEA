/** Browser check of the Expedition flow: menu, run, suspend and resume, results (dev aid). */
import { serve, launch } from './shot.mjs';
const OUT = new URL('./shots/', import.meta.url).pathname;
const srv = await serve(4199);
const { browser, page, errors } = await launch();
const ev = (fn, a) => page.evaluate(fn, a);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const log = (...a) => console.log(...a);
await page.goto('http://localhost:4199/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
await ev(() => { const a = window.__depths; a.profile.data.endings.door = true; a.profile.persist(); a.menus.main(); });
await page.locator('button:has-text("Expedition")').first().click({ force: true });
await page.waitForSelector('.seedin');
await page.screenshot({ path: `${OUT}x-menu.png` });
await page.locator('.seedin').fill('ABCDEF');
await page.locator('button:has-text("Play this seed")').click({ force: true });
await page.waitForFunction(() => window.__depths.levelView && window.__depths.game && window.__depths.game.mode === 'expedition', null, { timeout: 120000 });
const info = await ev(() => { const g = window.__depths.game; return { seed: g.expedition.seedText, theme: g.expedition.theme, rooms: g.level.rooms.length, film: g.players.get('p1').film, charge: g.players.get('p1').charge }; });
log('run', JSON.stringify(info));
await frames(3);
await page.screenshot({ path: `${OUT}x-run0.png` });
// look into the first threat room
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); const t = g.expedition.threats[0]; const r = g.level.room(t.room); p.x = r.x0 + 1.5; p.z = r.z0 + 1.5; p.yaw = Math.atan2(-(r.cx - p.x), -(r.cz - p.z)); p.flashOn = true; });
await frames(3);
await page.screenshot({ path: `${OUT}x-run1.png` });
// suspend and resume
await ev(() => window.__depths.suspendExpedition());
await page.waitForFunction(() => window.__depths.state === 'menu', null, { timeout: 60000 });
await ev(() => window.__depths.menus.expedition());
const hasResume = await page.locator('button:has-text("Resume suspended run")').count();
log('resume offered', hasResume > 0);
await ev(() => window.__depths.resumeExpedition());
await page.waitForFunction(() => window.__depths.game && window.__depths.game.mode === 'expedition' && window.__depths.levelView, null, { timeout: 120000 });
log('resumed seed', await ev(() => window.__depths.game.expedition.seedText), 'suspend consumed', await ev(() => !window.__depths.saves.suspend()));
// finish: unlock extraction and leave
await ev(() => { const g = window.__depths.game; g.story.set('x.ready'); const it = g.level.interById.get('xlift'); const p = g.players.get('p1'); p.x = it.x; p.z = it.z + 1.0; g.beginInteract('p1', 'xlift'); });
await page.waitForSelector('.ending .stats', { timeout: 60000 });
await page.screenshot({ path: `${OUT}x-result.png` });
log('A17', await ev(() => !!window.__depths.profile.data.achievements.A17));
log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close(); srv.close();
