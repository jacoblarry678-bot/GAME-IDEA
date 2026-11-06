// Headless smoke test: lobby, then bot-driven matches on each side. Usage: node tools/e2e.mjs [seconds]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const secs = +(process.argv[2] || 25);
mkdirSync('build/shots', { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4195', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;
async function run(name, query, shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:4195/${query}`);
  await page.waitForTimeout(1500);
  if (!query) { await page.screenshot({ path: `build/shots/${name}.png` }); }
  else {
    await page.waitForFunction(() => window.__match, null, { timeout: 60000 }).catch(() => errors.push('match never started'));
    for (let i = 0; i < shots; i++) {
      await page.waitForTimeout((secs * 1000) / shots);
      await page.screenshot({ path: `build/shots/${name}-${i}.png` });
    }
    const info = await page.evaluate(() => {
      const m = window.__match;
      if (!m) return { state: window.__ch.state };
      return {
        t: m.time.toFixed(1), map: m.mapDef.id, gens: m.world.gens.map((g) => g.progress.toFixed(2)).join(' '), done: m.gensDone,
        survivors: m.survivors.map((s) => `${s.name.split(' ')[0]}:${s.state}${s.hooks ? '/h' + s.hooks : ''}${s.action ? '[' + s.action.type + ']' : ''}`).join(' '),
        killer: `${m.killer.def.id} ${m.killer.state} ${m.killer.pos.x.toFixed(1)},${m.killer.pos.z.toFixed(1)} chase=${m.killer.chaseTarget ? m.killer.chaseTarget.name : '-'}`,
        pallets: m.world.pallets.filter((p) => p.state !== 'up').length + '/' + m.world.pallets.length,
      };
    });
    console.log(name, JSON.stringify(info));
  }
  if (errors.length) { failures++; console.log(name, 'ERRORS:\n' + errors.slice(0, 8).join('\n')); }
  else console.log(name, 'ok');
  await page.close();
}
await run('lobby', '', 0);
const which = process.argv[3] || 'all';
if (which === 'all' || which === 's') await run('survivor', `?autoplay&speed=4&role=survivor&map=${process.argv[4] || 'ashgrove'}&q=medium`, 3);
if (which === 'all' || which === 'k') await run('killer', `?autoplay&speed=4&role=killer&killer=exe&map=${process.argv[5] || 'gravelpit'}&q=medium`, 3);
await browser.close();
server.kill();
process.exit(failures ? 1 : 0);
