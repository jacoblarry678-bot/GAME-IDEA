/**
 * Headless smoke run: boot → screenshot menu → start match → screenshots.
 * Usage: node tools/shot.mjs [url] [outDir]
 * Uses low graphics settings because the container renders with SwiftShader (CPU).
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const lowGfx = process.env.LOWGFX !== '0';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', (m) => { if (!m.text().includes('Failed to load resource')) logs.push(`[${m.type()}] ${m.text()}`); });
p.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
if (lowGfx) await p.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('ashline.settings') || '{}'); s.graphics = { ...(s.graphics || {}), preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low' }; localStorage.setItem('ashline.settings', JSON.stringify(s)); } catch {} });
const t0 = Date.now();
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline && window.__ashline.state === 'menu', null, { timeout: 120000 }).catch(() => {});
console.log('boot ms', Date.now() - t0, 'state', await p.evaluate(() => window.__ashline?.state));
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/01-menu.png` });
await p.click('text=Play');
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/02-setup.png` });
await p.click('text=Start Match');
await p.waitForTimeout(5000);
await p.screenshot({ path: `${out}/03-match.png` });
const snap = () => p.evaluate(() => {
  const a = window.__ashline, g = a.game;
  return { state: a.state, fps: a.engine.fps.toFixed(1), info: a.engine.info(), mstate: g?.match.state, t: g?.match.time.toFixed(1), scores: g?.match.teamScores, alive: g?.match.combatants.filter((c) => c.alive).length, fatal: a.fatal && String(a.fatal) };
});
console.log(JSON.stringify(await snap()));
await p.waitForTimeout(10000);
await p.screenshot({ path: `${out}/04-match-later.png` });
console.log(JSON.stringify(await snap()));
console.log(logs.slice(0, 40).join('\n'));
await b.close();
