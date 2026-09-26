// Quick boot check: lobby renders, PLAY starts a match, no page errors.
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5174/';
const out = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
await p.goto(url, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}/lobby.png` });
await p.click('[data-act=play]');
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/bus.png` });
const info = await p.evaluate(() => {
  const g = window.__bi.game;
  return { state: g.state, actors: g.actors.length, fps: window.__bi.engine.fps, calls: window.__bi.engine.renderer.info.render.calls, tris: window.__bi.engine.renderer.info.render.triangles };
});
console.log(JSON.stringify(info));
console.log(logs.slice(-20).join('\n'));
await b.close();
