/**
 * Map visual review + flow: picks each map in Play setup, starts a match
 * (map builds on first use), screenshots several viewpoints, checks errors.
 * Usage: node tools/maps.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => {
  if (sessionStorage.getItem('maps-init')) return;
  sessionStorage.setItem('maps-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'medium', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: false, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.click('.menu-btn[data-go=play]');
await p.waitForTimeout(800);
const cards = await ev(() => [...document.querySelectorAll('.map-card[data-map]')].map((c) => c.dataset.map));
check('play setup lists three maps', cards.join() === 'cinder_yard,old_quarter,signal_station', cards.join());
await p.screenshot({ path: `${out}/maps-00-picker.png` });
const VIEWS = {
  old_quarter: [[-43, 2, 1.62, -Math.PI / 2, 0.04], [0, -6.5, 1.62, Math.PI, 0.12], [-26, 24, 1.62, -Math.PI / 2, 0.0], [0, 25, 1.62, Math.PI, 0.18], [-28, 3, 1.62, -Math.PI / 2, 0], [28, -26, 1.62, Math.PI / 2, 0.05]],
  signal_station: [[-42, 0, 1.62, -Math.PI / 2, 0.06], [0, 20, 1.62, 0, 0.1], [-4, -1.5, 1.62, -Math.PI / 2, 0], [8, -18, 1.62, 0.3, 0.12], [-34, 22, 1.62, -Math.PI / 2 - 0.4, 0.12], [30, -1, 1.62, -Math.PI / 2, 0.04]],
};
for (const id of ['old_quarter', 'signal_station']) {
  await p.click(`.map-card[data-map=${id}]`);
  await p.waitForTimeout(300);
  await ev(() => { const s = window.__ashline.profile.data.matchSetup; s.mode = 'tdm'; s.botsAllies = 2; s.botsEnemies = 3; window.__ashline.profile.save(); });
  const t0 = Date.now();
  await p.click('text=Start Match');
  await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 180000 });
  const built = Date.now() - t0;
  const info = await ev(() => { const a = window.__ashline, g = a.game; g.debugAdvance(3.4); g.hud.root.style.display = 'none'; return { map: g.map.def.id, n: g.match.combatants.length }; });
  check(`${id}: match starts on the selected map`, info.map === id && info.n === 6, `${JSON.stringify(info)} build+start ${built} ms (SwiftShader)`);
  let i = 0;
  for (const [x, z, eye, yaw, pitch] of VIEWS[id]) {
    await ev(([x, z, yaw, pitch]) => { const a = window.__ashline, g = a.game, pl = g.player; pl.x = x; pl.z = z; pl.y = g.match.world.groundHeight(x, z, 3, 0.3); pl.spawnProtectT = 99; g.look.yaw = yaw; g.look.pitch = pitch; for (const c of g.match.combatants) if (c !== pl) { c.x = 999; c.alive = false; } for (let k = 0; k < 4; k++) g.update(1 / 60); }, [x, z, yaw, pitch]);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/maps-${id}-${i++}.png` });
  }
  await ev(() => { window.__ashline.leaveMatch?.() ?? window.__ashline.toMenu(); });
  await p.waitForTimeout(800);
  if (await ev(() => window.__ashline.state) !== 'menu') await ev(() => window.__ashline.toMenu());
  await p.click('.menu-btn[data-go=play]');
  await p.waitForTimeout(500);
}
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
