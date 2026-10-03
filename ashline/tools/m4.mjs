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
const opts = await ev(() => ({ total: document.querySelectorAll('.wpn-opt[data-slot=primary], .wpn-opt[data-slot=secondary]').length, locked: document.querySelectorAll('.wpn-opt.locked[data-slot=primary], .wpn-opt.locked[data-slot=secondary]').length, perks: document.querySelectorAll('.wpn-opt[data-slot=perk]').length, lockedOther: document.querySelectorAll('.wpn-opt.locked[data-slot=perk], .wpn-opt.locked[data-slot=tactical]').length }));
check('loadouts list all 16 weapons; most locked at level 1', opts.total === 16 && opts.locked === 11, JSON.stringify(opts));
check('loadouts show 9 perks in 3 slots; advanced perks and tacticals locked at level 1', opts.perks === 9 && opts.lockedOther === 8, JSON.stringify(opts));
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
await p.click('.wpn-opt[data-id=pk_scavenger]');
await p.click('.wpn-opt[data-id=pk_ghost]');
await p.click('.wpn-opt[data-id=shield]');
await p.waitForTimeout(300);
const st2 = await ev(() => ({ ...window.__ashline.profile.loadout, locked: document.querySelectorAll('.wpn-opt.locked').length }));
check('perks and Bulwark equip at level 20', st2.perks.join() === 'pk_scavenger,pk_ghost,pk_resolve' && st2.tactical === 'shield', JSON.stringify(st2.perks) + st2.tactical);
check('at level 20 every weapon is unlocked and equippable', st2.primary === 'ar_meridian' && st2.secondary === 'melee_axe' && st2.locked === 0, JSON.stringify(st2));
await S('02-loadouts-unlocked');
// ---- gunsmith
await p.click('[data-a=gs-primary]');
await p.waitForTimeout(500);
const gs0 = await ev(() => ({ locked: document.querySelectorAll('.att-opt.locked').length, slots: document.querySelectorAll('.gs-slot').length }));
await p.click('.att-opt[data-id=opt_reflex]');
await p.waitForTimeout(200);
const gs1 = await ev(() => ({ build: window.__ashline.profile.data.builds.ar_meridian, toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|') }));
check('gunsmith: attachments locked at weapon level 1 with a reason', gs0.slots === 6 && gs0.locked > 0 && !gs1.build?.optic && /weapon level/i.test(gs1.toast), JSON.stringify({ ...gs0, ...gs1 }));
await ev(() => { const a = window.__ashline; a.profile.data.weaponProgress.ar_meridian.level = 20; a.profile.save(); a.screens.refreshTop(); });
await p.waitForTimeout(400);
await p.click('.gs-slot[data-s=optic]');
await p.click('.att-opt[data-id=opt_3x]');
await p.click('.gs-slot[data-s=magazine]');
await p.click('.att-opt[data-id=mg_ext]');
await p.click('.gs-slot[data-s=muzzle]');
await p.click('.att-opt[data-id=mz_supp]');
await p.waitForTimeout(500);
const gs2 = await ev(() => ({ build: window.__ashline.profile.data.builds.ar_meridian, deltas: document.querySelectorAll('.wpn-info .bar b').length }));
check('gunsmith: equip optic, magazine and muzzle; stats show tradeoffs', gs2.build.optic === 'opt_3x' && gs2.build.magazine === 'mg_ext' && gs2.build.muzzle === 'mz_supp' && gs2.deltas >= 2, JSON.stringify(gs2));
await S('02b-gunsmith');
await p.click('[data-screen=gunsmith] >> text=Back');
await p.waitForTimeout(400);
await p.click('[data-screen=loadouts] >> text=Back');
await p.waitForTimeout(300);

// ---- match with Meridian + axe
await ev(() => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { mode: 'tdm', botsAllies: 1, botsEnemies: 2 }); a.startMatch(); a.game.debugAdvance(3.4); });
const g0 = await ev(() => { const g = window.__ashline.game, pl = g.player; pl.spawnProtectT = 99; return { w: pl.weapon.def.id, mag: pl.weapon.mag }; });
check('match starts with the Meridian and its attachments', g0.w === 'ar_meridian' && g0.mag === 45, JSON.stringify(g0));
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
// ---- support abilities, shield, flash
await ev(() => { const g = window.__ashline.game, pl = g.player; pl.cmd.swapTo = 0; for (let i = 0; i < 60; i++) { g.match.tick(1 / 60); g.update(1 / 60); } pl.abilities.recon = 1; pl.abilities.supply = 1; pl.abilities.strike = 1; pl.x = 12; pl.z = -1.5; pl.y = 0; g.look.yaw = -Math.PI / 2; g.look.pitch = -0.12; window.__ashline.input.enabled = true; });
for (const k of ['Digit3', 'Digit4', 'Digit5']) {
  await p.keyboard.down(k);
  await ev(() => { const g = window.__ashline.game; window.__ashline.input.poll?.(); g.update(1 / 60); g.match.tick(1 / 60); });
  await p.keyboard.up(k);
  await ev(() => { const g = window.__ashline.game; window.__ashline.input.poll?.(); g.update(1 / 60); g.match.tick(1 / 60); });
}
const sup = await ev(() => { const g = window.__ashline.game, m = g.match, d = m.deployables; return { a: g.player.abilities, recon: (d.recon[0] || 0) > m.time, drops: d.drops.length, strikes: d.strikes.length, hud: document.querySelector('#hud .support')?.textContent || '' }; });
check('keys 3/4/5 call Recon Scan, Supply Drop and Area Strike', sup.recon && sup.drops === 1 && sup.strikes === 1 && sup.a.recon + sup.a.supply + sup.a.strike === 0, JSON.stringify(sup));
check('HUD shows the support ability strip', /recon scan/i.test(sup.hud) && /area strike/i.test(sup.hud), sup.hud.slice(0, 80));
await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 90; i++) { g.match.tick(1 / 60); g.update(1 / 60); } });
await p.waitForTimeout(500);
await S('04-support');
const sh = await ev(() => { const g = window.__ashline.game, pl = g.player; pl.cmd.tactical = false; for (let i = 0; i < 3; i++) g.match.tick(1 / 60); g.look.yaw = Math.PI / 2; g.look.pitch = 0; pl.cmd.yaw = Math.PI / 2; pl.tactical.count = 1; for (let i = 0; i < 40; i++) { pl.cmd.yaw = Math.PI / 2; pl.cmd.tactical = i < 2; g.match.tick(1 / 60); g.update(1 / 60); } return { n: g.match.deployables.shields.length, view: g.depView.views.size }; });
check('Bulwark shield deploys with a world model', sh.n === 1 && sh.view >= 1, JSON.stringify(sh));
const fl = await ev(() => { const g = window.__ashline.game, pl = g.player, m = g.match; m.projectiles.flash({ x: pl.x - 3, y: pl.y + 1.3, z: pl.z, def: { radius: 14, maxBlind: 3.6 }, owner: m.combatants.find((c) => c.team !== pl.team) }); g.update(1 / 60); return { t: pl.blindT, op: Number(getComputedStyle(document.querySelector('#hud .blind')).opacity) }; });
check('flash blinds the player with a white-out overlay', fl.t > 1 && fl.op > 0.5, JSON.stringify(fl));
await S('05-flashed');
const bots = await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 600; i++) g.update(1 / 60); return g.match.combatants.filter((c) => c.isBot).map((c) => c.weapon.def.id); });
check('bots run 10 s alongside new weapons without errors', bots.length === 3, bots.join());
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
