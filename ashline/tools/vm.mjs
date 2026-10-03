/** Viewmodel review: each weapon at hip and ADS against a neutral background. */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const only = process.argv[4];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.addInitScript(() => localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'medium', renderScale: 0.8, shadows: 'off', textures: 'medium', effects: 'medium', bloom: false, ao: false } })));
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.evaluate(() => { const a = window.__ashline; a.startMatch(); a.game.debugAdvance(3.4); a.game.hud.root.style.display = 'none'; a.input.enabled = true; a.input.lastLockFail = performance.now(); });
const ids = only ? [only] : ['ar_kv7', 'smg_vesper', 'sg_brakk', 'sr_longreach', 'pistol_warden'];
for (const id of ids) {
  for (const ads of [0, 1]) {
    await p.evaluate(([id]) => {
      const a = window.__ashline, g = a.game, pl = g.player;
      pl.applyLoadout({ ...pl.loadout, primary: id === 'pistol_warden' ? 'ar_kv7' : id });
      pl.cur = id === 'pistol_warden' ? 1 : 0;
      pl.x = 12; pl.y = 0; pl.z = -1.5; pl.vx = pl.vz = 0; pl.spawnProtectT = 99;
      g.look.yaw = -Math.PI / 2; g.look.pitch = 0.05;
    }, [id]);
    if (ads) await p.mouse.down({ button: 'right' });
    await p.evaluate(() => { const a = window.__ashline; for (let i = 0; i < 40; i++) { a.input.poll(); a.game.update(1 / 60); } });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/vm-${id}-${ads ? 'ads' : 'hip'}.png` });
    if (ads) await p.mouse.up({ button: 'right' });
  }
}
console.log('errors:', errors.join(' | ') || 'none');
await b.close();
