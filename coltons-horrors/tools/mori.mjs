// Forces a full mori and a mini mori for each killer and checks the outcome. Usage: node tools/mori.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
mkdirSync('build/shots', { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const killer of ['woodsman', 'specter', 'exe']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + ' ' + e.stack));
  await page.goto(`http://localhost:4198/?autoplay&role=killer&killer=${killer}&map=ashgrove&q=medium`);
  await page.waitForFunction(() => window.__match, null, { timeout: 60000 });
  const result = {};
  for (const kind of ['full', 'mini']) {
    await page.evaluate((kind) => {
      const m = window.__match;
      const k = m.killer;
      m.moriAllowed = kind === 'full';
      const alive = m.survivors.filter((s) => s.alive);
      if (kind === 'mini') alive.slice(1).forEach((s) => m.kill(s, 'taken'));
      const s = m.survivors.find((x) => x.alive);
      s.state = 'dying'; s.hooks = kind === 'full' ? 1 : s.hooks;
      const p = m.world.nav.nearestWalkable(k.pos.x + 1.2, k.pos.z, 4);
      s.pos.set(p[0], 0, p[1]);
      k.state = 'normal'; k.carrying = null;
      window.__victim = s.name;
      window.__kind = m.moriKind(s);
      k.ai = null; // drive it by hand
      k.intent.mori = true;
    }, kind);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `build/shots/mori-${killer}-${kind}.png` });
    await page.evaluate(() => { const m = window.__match; for (let i = 0; i < 240; i++) m.update(1 / 30, null); });
    result[kind] = await page.evaluate(() => { const m = window.__match; const s = m.survivors.find((x) => x.name === window.__victim); return `${window.__kind}->${s.state}/${s.outcome}`; });
  }
  console.log(killer, JSON.stringify(result), errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'ok');
  if (errors.length || !result.full.endsWith('executed') || !result.mini.endsWith('finished off')) bad++;
  await page.close();
}
await browser.close(); server.kill();
process.exit(bad ? 1 : 0);
