/**
 * Browser check of every playable mode: start from the Play screen, run the
 * match with the autopilot, verify objective state/HUD, finish, results.
 * Usage: node tools/modes.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const only = process.argv[4];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => { if (!sessionStorage.getItem('mi')) { sessionStorage.setItem('mi', 1); localStorage.clear(); localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } })); } });
const ev = (fn, a) => p.evaluate(fn, a);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
const modes = only ? [only] : ['ffa', 'dom', 'hp', 'elim', 'gun', 'tdm'];
for (const mode of modes) {
  await p.click('.menu-btn[data-go=play]');
  await p.waitForTimeout(300);
  await p.click(`.choice[data-k=mode] button[data-v=${mode}]`);
  await p.waitForTimeout(300);
  const setup = await ev(() => ({ ...window.__ashline.profile.data.matchSetup }));
  await ev(() => { const s = window.__ashline.profile.data.matchSetup; if (s.mode === 'dom' || s.mode === 'hp') s.scoreLimit = 50; if (s.mode === 'ffa') s.scoreLimit = 10; if (s.mode === 'elim') s.scoreLimit = 2; if (s.mode === 'tdm') s.scoreLimit = 15; });
  await p.click('text=Start Match');
  await p.waitForTimeout(400);
  const info = await ev(() => { const g = window.__ashline.game, m = g.match; return { mode: m.mode.id, n: m.combatants.length, teams: m.teamScores.length, flags: m.flags?.length || 0, zones: m.zones?.length || 0, ladder: m.ladder?.length || 0 }; });
  check(`${mode}: starts from Play screen`, info.mode === mode && setup.mode === mode, JSON.stringify(info));
  await ev(() => { window.__ashline.game.debugAdvance(3.4); window.__ashline.autopilot(true); window.__ashline.game.debugAdvance(25); });
  await ev(() => { const a = window.__ashline; for (let i = 0; i < 3; i++) { a.input.poll(); a.game.update(1 / 30); a.input.endFrame(); } });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/mode-${mode}.png` });
  const mid = await ev(() => { const g = window.__ashline.game, m = g.match; return { t: m.time.toFixed(0), scores: m.teamScores.join(','), strip: document.querySelector('.obj-strip')?.innerText.replace(/\s+/g, ' ').trim() || '', markers: [...document.querySelectorAll('.om')].filter((e) => e.style.display !== 'none').length, limit: document.querySelector('.lim')?.textContent, round: m.round?.n, fatal: String(window.__ashline.fatal || '') }; });
  check(`${mode}: running, HUD shows mode info`, !mid.fatal && (mode === 'tdm' || mode === 'ffa' || mid.strip.length > 0), JSON.stringify(mid));
  if (mode === 'dom') check('dom: three flag markers on screen', mid.markers === 3);
  if (mode === 'hp') check('hp: hardpoint marker on screen', mid.markers === 1);
  for (let i = 0; i < 40; i++) { const st = await ev(() => { const g = window.__ashline.game; g.debugAdvance(10); return g.match.state; }); if (st === 'ended') break; }
  const end = await ev(() => { const m = window.__ashline.game.match; return { state: m.state, winner: m.winner, reason: m.endReason, scores: m.teamScores.join(','), rounds: m.round?.n }; });
  check(`${mode}: match ends with a result`, end.state === 'ended', JSON.stringify(end));
  await ev(() => { window.__ashline.game.endTimer = 10; });
  await p.waitForFunction(() => window.__ashline.state === 'results', null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/mode-${mode}-results.png` });
  check(`${mode}: results screen`, (await ev(() => window.__ashline.state)) === 'results');
  await ev(() => window.__ashline.toMenu());
  await p.waitForTimeout(400);
}
check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
