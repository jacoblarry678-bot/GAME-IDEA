// Runs whole bot-vs-bot matches quickly in a headless browser (logic stepped without rendering).
// Usage: node tools/sim.mjs [role] [killer] [map]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const [role = 'survivor', killer = 'specter', map = 'hollowpines'] = process.argv.slice(2);
const server = spawn('npx', ['vite', 'preview', '--port', '4196', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
await page.goto(`http://localhost:4196/?autoplay&role=${role}&killer=${killer}&map=${map}&q=low`);
await page.waitForFunction(() => window.__match, null, { timeout: 60000 });
let log = [];
for (let chunk = 0; chunk < 40; chunk++) {
  const r = await page.evaluate(() => {
    const m = window.__match;
    if (!m) return { ended: true };
    const t0 = performance.now();
    for (let i = 0; i < 900 && !m.over; i++) m.update(1 / 30, null);
    const ev = m.events.slice(-6).map((e) => e.title);
    return { t: Math.round(m.time), ms: Math.round(performance.now() - t0), gens: m.gensDone, over: m.over, endgame: m.endgameT,
      s: m.survivors.map((s) => `${s.name.split(' ')[0]}:${s.state}${s.hooks ? '/h' + s.hooks : ''}`).join(' '), k: `${m.killer.state}${m.killer.carrying ? '+carry' : ''}`, ev };
  });
  if (r.ended) break;
  console.log(`t=${r.t}s (${r.ms}ms/30s) gens=${r.gens} ${r.s} killer=${r.k}${r.endgame !== null ? ' endgame=' + Math.round(r.endgame) : ''}`);
  log = r.ev;
  if (r.over) break;
}
console.log('last events:', log.join(' | '));
await page.waitForTimeout(6000);
const res = await page.evaluate(() => window.__ch.lobbyResults && { total: window.__ch.lobbyResults.total, fates: window.__ch.lobbyResults.survivors.map((s) => s.name + ': ' + s.outcome) });
console.log('results:', JSON.stringify(res));
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 5).join('\n'));
await browser.close(); server.kill();
process.exit(errors.length ? 1 : 0);
