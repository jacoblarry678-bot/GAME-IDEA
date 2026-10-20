import { serve, launch } from './shot.mjs';
const OUT = new URL('./shots/', import.meta.url).pathname;
const srv = await serve(4196);
const { browser, page, errors } = await launch();
const ev = (fn, a) => page.evaluate(fn, a);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.goto('http://localhost:4196/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
const ch = +(process.argv[2] || 2);
const views = JSON.parse(process.argv[3] || '[]');
await ev((ch) => window.__depths.startReplay(ch), ch);
await page.waitForFunction(() => window.__depths.levelView, null, { timeout: 120000 });
await ev(() => { window.__depths.hud.root.style.display = 'none'; });
let i = 0;
for (const v of views) {
  await ev((v) => { const g = window.__depths.game, p = g.players.get('p1'); p.x = v[0]; p.z = v[1]; p.yaw = v[2]; p.pitch = v[3] || 0; p.flashOn = !!v[4]; for (const f of v[5] || []) g.story.set(f); }, v);
  await frames(3);
  await page.screenshot({ path: `${OUT}ch${ch}-${i++}.png` });
}
console.log(errors.join('\n'));
await browser.close(); srv.close();
