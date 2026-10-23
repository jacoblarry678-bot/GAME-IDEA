/**
 * Update check (0.7.0): Hollow Night event and the sealed collab drop_002.
 *   main menu event entry → event screen (track + challenges) → Store event
 *   section (buy with test credits) → match under the Hollow Night look
 *   (night sky, lanterns) → results Candy + track unlock → restore on exit →
 *   atmosphere toggle off → drop_002 hidden before release → redeem code →
 *   collab section, bundle purchase, equip → preview + in-world screenshots,
 *   same height as a standard operator.
 * Usage: VAULT_TEST_CODE_2=<code> node tools/halloween.mjs [url] [outDir]
 * (without the code the drop_002 checks are skipped and reported as such)
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const CODE2 = process.env.VAULT_TEST_CODE_2;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => {
  if (sessionStorage.getItem('hn-init')) return;
  sessionStorage.setItem('hn-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'high', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: true, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
const waitState = (st, ms = 120000) => p.waitForFunction((s) => window.__ashline?.state === s, st, { timeout: ms });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await waitState('menu');
await p.waitForTimeout(600);

// ---- menu + event screen
const menu = await ev(() => document.querySelector('.menu-btn[data-go=event]')?.textContent || '');
check('main menu shows the Hollow Night event (device date in the event window)', /Hollow Night/.test(menu) && /days left/.test(menu), menu);
await p.screenshot({ path: `${out}/hn-01-menu.png` });
await p.click('.menu-btn[data-go=event]');
await p.waitForTimeout(500);
const es = await ev(() => ({ tiers: document.querySelectorAll('.hn-tier').length, chal: document.querySelectorAll('.chal').length, candy: document.querySelector('.hn-candy')?.textContent }));
check('event screen: 8-tier free track and 5 event challenges', es.tiers === 8 && es.chal === 5, JSON.stringify(es));
await p.screenshot({ path: `${out}/hn-02-event.png` });

// ---- Store: event section, buy one item with test credits
await p.click('[data-a=store]');
await p.waitForTimeout(600);
const shop = await ev(() => { const box = document.querySelector('.event-box'); return { items: box?.querySelectorAll('[data-item]').length, bundle: !!box?.querySelector('[data-bundle=bd_hollow]'), credits: window.__ashline.profile.data.credits }; });
check('Store has a Hollow Night section with 7 items and a bundle', shop.items === 7 && shop.bundle, JSON.stringify(shop));
await p.click('.event-box [data-item=ch_ghost]');
await p.waitForTimeout(300);
await p.click('[data-a=buy]');
await p.waitForTimeout(300);
await p.click('.modal .btn.primary, .modal [data-k=ok], .modal button:last-child');
await p.waitForTimeout(400);
const bought = await ev(() => ({ owns: window.__ashline.profile.owns('ch_ghost'), credits: window.__ashline.profile.data.credits }));
check('event item bought with test credits', bought.owns && bought.credits === shop.credits - 600, JSON.stringify(bought));
await p.screenshot({ path: `${out}/hn-03-store.png` });
await ev(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));

// ---- match under the Hollow Night look
const before = await ev(() => { const a = window.__ashline; return { top: a.sky.material.uniforms.top.value.getHex(), sun: a.engine.sun.intensity }; });
await ev(async () => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { mode: 'tdm', map: 'old_quarter', botsAllies: 2, botsEnemies: 3, weather: 'clear', halloween: true, timeLimit: 3 }); a.screens.clear(); await a.startMatch(); });
await waitState('match-live');
const night = await ev(() => {
  const a = window.__ashline, g = a.game;
  g.debugAdvance(3.3);
  for (let i = 0; i < 20; i++) g.update(1 / 30);
  const grp = a.engine.scene.getObjectByName('hollow-night');
  return { view: !!g.hwView, lanterns: g.hwView?.lanterns.length || 0, inScene: !!grp, top: a.sky.material.uniforms.top.value.getHex(), sun: a.engine.sun.intensity };
});
check('match uses the Hollow Night look: night sky, dimmer light, jack-o\'-lanterns', night.view && night.inScene && night.lanterns >= 8 && night.top !== before.top && night.sun < before.sun * 0.5, JSON.stringify(night));
// look at a lantern for the screenshot
await ev(() => {
  const g = window.__ashline.game, pl = g.player, L = g.hwView.lanterns[2].position;
  for (const c of g.match.combatants) if (c !== pl) { c.brain = null; c.x = 999; c.alive = false; }
  pl.x = L.x + 3.2; pl.z = L.z + 1.2; pl.y = L.y; pl.spawnProtectT = 999;
  g.look.yaw = Math.atan2(-(L.x - pl.x), -(L.z - pl.z)); g.look.pitch = -0.18;
  for (let i = 0; i < 20; i++) g.update(1 / 30);
  g.hud.root.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-br').forEach((e) => { e.style.visibility = 'hidden'; });
});
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/hn-04-night.png` });

// ---- results: Candy + track unlock
await ev(() => { const g = window.__ashline.game, m = g.match; g.player.stats.kills = 6; g.player.stats.headshots = 2; m.end(g.player.team, 'score'); g.endTimer = 10; });
await waitState('results', 60000);
await p.waitForTimeout(600);
const res = await ev(() => ({ text: document.querySelector('.hn-res')?.textContent || '', candy: window.__ashline.profile.eventState().candy, pumpkin: window.__ashline.profile.owns('em_pumpkin') }));
check('results: Candy earned (10 + win 10 + 6×2 + 2) and the first track reward unlocks', res.candy === 34 + 0 && /\+34 Candy/.test(res.text) && /Unlocked: Jack/.test(res.text) && res.pumpkin, `${res.candy} · ${res.text.slice(0, 120)}`);
await p.screenshot({ path: `${out}/hn-05-results.png` });
await ev(() => window.__ashline.toMenu());
await waitState('menu');
const restored = await ev(() => { const a = window.__ashline; return { top: a.sky.material.uniforms.top.value.getHex(), sun: a.engine.sun.intensity, grp: !!a.engine.scene.getObjectByName('hollow-night') }; });
check('leaving the match restores the day sky and light', restored.top !== night.top && Math.abs(restored.sun - before.sun) < 1e-6 && !restored.grp, JSON.stringify(restored));

// ---- atmosphere off
await ev(async () => { const a = window.__ashline; a.profile.data.matchSetup.halloween = false; await a.startMatch(); });
await waitState('match-live');
check('Hollow Night look can be switched off in Play setup', !(await ev(() => !!window.__ashline.game.hwView)));
await ev(() => window.__ashline.toMenu());
await waitState('menu');

// ---- drop_002
await p.click('.menu-btn[data-go=store]');
await p.waitForTimeout(500);
const before2 = await ev(() => [...document.querySelectorAll('.collab-box h3')].map((h) => h.textContent));
check('before release only the existing collab section is listed', before2.length === 1 && /Waspinator/.test(before2[0]), before2.join(' | '));
if (CODE2) {
  await p.fill('.code-in', CODE2.toLowerCase());
  await p.click('[data-a=redeem]');
  await p.waitForFunction(() => document.querySelectorAll('.collab-box').length >= 2, null, { timeout: 60000 });
  await p.waitForTimeout(500);
  const after = await ev(() => [...document.querySelectorAll('.collab-box h3')].map((h) => h.textContent));
  check('the code opens drop_002: a second collab section appears', after.length === 2, after.join(' | '));
  await ev(() => window.__ashline.profile.addTestCredits(3000));
  const bundleBtn = await p.$('.collab-box:last-child [data-bundle]');
  await bundleBtn.click();
  await p.waitForTimeout(300);
  await p.click('[data-a=buyb]');
  await p.waitForTimeout(300);
  await p.click('.modal .btn.primary, .modal button:last-child');
  await p.waitForTimeout(500);
  const own = await ev(() => { const pr = window.__ashline.profile; const ids = Object.keys(pr.data.owned).filter((id) => /slender/.test(id)); return ids; });
  check('collab bundle bought with test credits: operator, outfit and banner owned', own.length === 3, own.join());
  await ev(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  // preview the operator and compare its height with a standard operator
  const h = await ev(() => {
    const a = window.__ashline;
    const pr = a.profile, ids = Object.keys(pr.data.owned);
    const opId = ids.find((id) => id.startsWith('op_') && /slender/.test(id));
    pr.equip(opId);
    const look = pr.look;
    a.preview.showOperator(look.operator, look.outfit);
    return { opId, op: look.operator.name };
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/hn-06-slender-store.png` });
  check('collab operator equips and previews', !!h.opId && /SLENDER/.test(h.op), JSON.stringify(h));
  // in-world: a bot wearing the skin, at night
  await ev(async () => { const a = window.__ashline; a.screens.clear(); Object.assign(a.profile.data.matchSetup, { mode: 'tdm', map: 'cinder_yard', botsAllies: 1, botsEnemies: 1, halloween: true, weather: 'clear' }); await a.startMatch(); });
  await waitState('match-live');
  const world = await ev(() => {
    const a = window.__ashline, g = a.game, m = g.match, pl = g.player;
    g.debugAdvance(3.3);
    const bot = m.combatants.find((c) => c !== pl && c.team === pl.team);
    const pr = a.profile, look = pr.look;
    bot.look = { operator: look.operator.id, outfit: look.outfit.id };
    g.removeView(bot); g.addView(bot);
    const std = m.combatants.find((c) => c !== pl && c !== bot);
    for (const c of m.combatants) if (c !== pl) { c.brain = null; c.cmd.moveX = c.cmd.moveZ = 0; c.cmd.fire = false; }
    pl.spawnProtectT = 999; std.spawnProtectT = 999; bot.spawnProtectT = 999;
    pl.x = 4; pl.z = 14; pl.y = 0; bot.x = 4.6; bot.z = 10.8; bot.y = 0; bot.yaw = 0; bot.cmd.yaw = 0; std.x = 3.2; std.z = 10.9; std.y = 0; std.yaw = 0; std.cmd.yaw = 0; std.alive = true;
    g.look.yaw = 0; g.look.pitch = -0.05;
    for (let i = 0; i < 25; i++) g.update(1 / 30);
    g.hud.root.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-br,.nameplates').forEach((e) => { e.style.visibility = 'hidden'; });
    const box = (c) => { const v = g.views.get(c.id); let maxY = -9; for (const mesh of v.meshes) { mesh.geometry.computeBoundingBox(); maxY = Math.max(maxY, mesh.geometry.boundingBox.max.y); } return maxY; };
    return { skinTop: +box(bot).toFixed(3), stdTop: +box(std).toFixed(3) };
  });
  check('in a match the collab skin is the same height as a standard operator (±6 cm)', Math.abs(world.skinTop - world.stdTop) < 0.06, JSON.stringify(world));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/hn-07-slender-world.png` });
  await ev(() => window.__ashline.toMenu());
} else console.log('SKIP  drop_002 browser checks (set VAULT_TEST_CODE_2)');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
