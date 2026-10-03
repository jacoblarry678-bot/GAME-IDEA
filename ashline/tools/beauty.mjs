/**
 * Visual review shots at a chosen quality preset from fixed viewpoints.
 * Usage: node tools/beauty.mjs [preset=high] [url] [outDir]
 */
import { chromium } from 'playwright';
const preset = process.argv[2] || 'high';
const url = process.argv[3] || 'http://localhost:4180/';
const out = process.argv[4] || 'shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.addInitScript((preset) => {
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset, ...(preset === 'high' ? { renderScale: 1, shadows: 'high', textures: 'high', effects: 'high' } : {}) } }));
}, preset);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.evaluate(() => { const a = window.__ashline; a.settings.set('graphics.preset', a.settings.data.graphics.preset); a.startMatch(); a.game.debugAdvance(3.4); });
const views = [
  ['spawn-west', -38, 0, 0, -Math.PI / 2, 0],
  ['rail-center', -14, 0, 3.5, -Math.PI / 2 + 0.25, -0.02],
  ['warehouse-in', -17, 0, 24, -Math.PI / 2 - 0.3, 0.02],
  ['containers', 8, 0, -32.5, Math.PI / 2 - 0.2, 0],
  ['maintenance', 6.5, 0, -22, Math.PI / 2 + 0.4, 0],
  ['depot-east', 34, 0, 8, -Math.PI / 4, 0.02],
];
for (const [name, x, y, z, yaw, pitch] of views) {
  await p.evaluate(([x, y, z, yaw, pitch]) => {
    const g = window.__ashline.game, pl = g.player;
    pl.x = x; pl.y = y; pl.z = z; pl.vx = pl.vz = 0; pl.spawnProtectT = 99;
    g.look.yaw = yaw; g.look.pitch = pitch; pl.cmd.yaw = yaw; pl.cmd.pitch = pitch; pl.yaw = yaw;
    for (let i = 0; i < 3; i++) g.update(1 / 60);
  }, [x, y, z, yaw, pitch]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/view-${preset}-${name}.png` });
}
const info = await p.evaluate(() => ({ fps: window.__ashline.engine.fps.toFixed(2), ...window.__ashline.engine.info() }));
console.log(JSON.stringify(info), errors.join(' | '));
await b.close();
