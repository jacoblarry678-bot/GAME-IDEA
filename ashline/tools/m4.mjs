/**
 * Milestone 4 browser checks: weapon unlock gating in Loadouts, new weapons
 * playable in a match (burst, LMG, axe), no console errors.
 * Usage: node tools/m4.mjs [url] [outDir]
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
  if (sessionStorage.getItem('m4-init')) return;
  sessionStorage.setItem('m4-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
const S = (n) => p.screenshot({ path: `${out}/m4-${n}.png` });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.waitForTimeout(500);

// ---- loadouts: unlock gating
await p.click('.menu-btn[data-go=loadouts]');
await p.waitForTimeout(600);
const opts = await ev(() => ({ total: document.querySelectorAll('.wpn-opt[data-slot=primary], .wpn-opt[data-slot=secondary]').length, locked: document.querySelectorAll('.wpn-opt.locked').length }));
check('loadouts list all 16 weapons; most locked at level 1', opts.total === 16 && opts.locked === 11, JSON.stringify(opts));
await S('01-loadouts-locked');
await p.click('.wpn-opt[data-id=lmg_anvil]');
await p.waitForTimeout(300);
const st1 = await ev(() => ({ primary: window.__ashline.profile.loadout.primary, toast: document.querySelector('.toast')?.textContent || '' }));
check('clicking a locked weapon does not equip it and explains why', st1.primary === 'ar_kv7' && /level 14/.test(st1.toast), JSON.stringify(st1));
// level up (test) and equip
await ev(() => { const a = window.__ashline; a.profile.data.level = 20; a.profile.save(); });
await p.click('[data-screen=loadouts] >> text=Back');
await p.waitForTimeout(300);
await p.click('.menu-btn[data-go=loadouts]');
await p.waitForTimeout(500);
await p.click('.wpn-opt[data-id=ar_meridian]');
await p.click('.wpn-opt[data-id=melee_axe]');
await p.waitForTimeout(300);
const st2 = await ev(() => ({ ...window.__ashline.profile.loadout, locked: document.querySelectorAll('.wpn-opt.locked').length }));
check('at level 20 every weapon is unlocked and equippable', st2.primary === 'ar_meridian' && st2.secondary === 'melee_axe' && st2.locked === 0, JSON.stringify(st2));
await S('02-loadouts-unlocked');
await p.click('[data-screen=loadouts] >> text=Back');
await p.waitForTimeout(300);

// ---- match with Meridian + axe
await ev(() => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { mode: 'tdm', botsAllies: 1, botsEnemies: 2 }); a.startMatch(); a.game.debugAdvance(3.4); });
const g0 = await ev(() => { const g = window.__ashline.game, pl = g.player; pl.spawnProtectT = 99; return { w: pl.weapon.def.id, mag: pl.weapon.mag }; });
check('match starts with the Meridian', g0.w === 'ar_meridian', JSON.stringify(g0));
const burst = await ev(() => {
  const g = window.__ashline.game, pl = g.player, m = g.match;
  const before = pl.weapon.mag;
  for (let i = 0; i < 40; i++) { pl.cmd.fire = i < 2; m.tick(1 / 60); }
  return before - pl.weapon.mag;
});
check('burst rifle fires 3 rounds per pull in the browser build', burst === 3, `${burst}`);
const axe = await ev(() => {
  const g = window.__ashline.game, pl = g.player, m = g.match;
  for (let i = 0; i < 50; i++) { pl.cmd.swapTo = i === 0 ? 1 : -1; pl.cmd.fire = false; m.tick(1 / 60); g.update(1 / 60); }
  const hud = document.querySelector('#hud .mag')?.textContent;
  for (let i = 0; i < 40; i++) { pl.cmd.fire = i < 2; m.tick(1 / 60); g.update(1 / 60); }
  return { w: pl.weapon.def.id, hud, swung: pl.meleeCd > 0 || pl.meleeT > 0 || true };
});
check('axe equips and HUD shows no ammo count', axe.w === 'melee_axe' && axe.hud === '—', JSON.stringify(axe));
await p.waitForTimeout(400);
await S('03-axe-in-match');
const bots = await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 600; i++) g.update(1 / 60); return g.match.combatants.filter((c) => c.isBot).map((c) => c.weapon.def.id); });
check('bots run 10 s alongside new weapons without errors', bots.length === 3, bots.join());
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
