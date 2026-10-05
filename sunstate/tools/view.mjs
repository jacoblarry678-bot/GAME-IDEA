/** Render static views of the world: node tools/view.mjs <url> <out.png> "<x,y,z,tx,ty,tz>" [hour] */
import { chromium } from 'playwright';
const [url, out, view, hour = '17.5', w = '1280', h = '720'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
await p.goto(`${url}?view=${view}&hour=${hour}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__sun?.ready, null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(4000);
await p.screenshot({ path: out });
console.log(JSON.stringify(await p.evaluate(() => window.__sun?.engine.info())));
console.log(logs.slice(0, 30).join('\n'));
await b.close();
