/** Screenshot the ending card, credits and post-credits screen for one ending (dev aid). */
import { serve, launch } from './shot.mjs';
const OUT = new URL('./shots/', import.meta.url).pathname;
const kind = process.argv[2] || 'door';
const srv = await serve(4198);
const { browser, page, errors } = await launch();
const ev = (fn, a) => page.evaluate(fn, a);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.goto('http://localhost:4198/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
await ev(() => window.__depths.startReplay(6));
await page.waitForFunction(() => window.__depths.levelView, null, { timeout: 120000 });
await ev((kind) => {
  const g = window.__depths.game, p = g.players.get('p1');
  const pos = { familiar: [8, 211, Math.PI], door: [57.5, 159, -Math.PI / 2], cut: [-45.5, 159, Math.PI / 2] }[kind];
  p.x = pos[0]; p.z = pos[1]; p.yaw = pos[2];
  g.story.set('JUNE_SAFE');
  g.beginEnding(kind);
  for (let i = 0; i < 900 && !(g.over && g.over.done); i++) g.tick(0.05);
}, kind);
await page.waitForSelector('.ending', { timeout: 60000 });
await frames(2);
await page.screenshot({ path: `${OUT}ending-${kind}.png` });
await page.locator('.ending button:has-text("Continue")').click({ force: true });
await page.waitForSelector('.credits', { timeout: 20000 });
await page.waitForFunction(() => { const b = document.querySelector('.credits button'); return b && !b.disabled; }, null, { timeout: 120000 });
await page.screenshot({ path: `${OUT}credits.png` });
console.log('skip state', await ev(() => { const b = document.querySelector('.credits button'); try { b.click(); } catch (e) { return 'threw ' + e.message; } return 'clicked, screens=' + document.querySelectorAll('.screen').length + ' ' + (document.querySelector('.screen')?.innerText.slice(0, 30)); }));
try { await page.waitForSelector('.ending .stats', { timeout: 20000 }); } catch (e) { console.log('post-credits missing', errors.join('\n'), await ev(() => document.querySelector('.screen')?.innerText.slice(0, 200))); }
console.log(await ev(() => [...document.querySelectorAll('.screen, .credits, .ending')].map((e) => e.className + ':' + e.innerText.slice(0, 40).replace(/\n/g, ' ')).join(' | ')));
await frames(2);
await page.screenshot({ path: `${OUT}postcredits-${kind}.png` });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close(); srv.close();
