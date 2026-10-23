/**
 * Update check (0.9.0): emotes (Armory slot + preview, wheel in a match,
 * third-person camera, model animates, moving cancels), the three new weapons
 * in first person, and Battle Royale on Ashfield Valley (default map, loot,
 * screenshots).
 * Usage: node tools/u090.mjs [url] [outDir]
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
  if (sessionStorage.getItem('u9')) return;
  sessionStorage.setItem('u9', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'high', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: true, ao: false } }));
  localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, level: 25, credits: 20000, matchSetup: { halloween: false, weather: 'clear' } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
const waitState = (st, ms = 150000) => p.waitForFunction((s) => window.__ashline?.state === s, st, { timeout: ms });
await p.goto(url, { waitUntil: 'load', timeout: 150000 });
await waitState('menu');
await p.waitForTimeout(500);

// ---- Armory: emotes tab, buy + slot + preview
await ev(() => { const pr = window.__ashline.profile; pr.buyItem('ex_shuffle'); pr.save(); });
await p.click('.menu-btn[data-go=armory]');
await p.waitForTimeout(400);
await p.click('.tab[data-t=emote]');
await p.waitForTimeout(300);
const tab = await ev(() => document.querySelectorAll('.inv').length);
check('Armory has an Emotes tab with 10 emotes', tab === 10, String(tab));
await p.click('.inv[data-i=ex_shuffle]');
await p.waitForTimeout(300);
await p.click('[data-slot="2"]');
await p.waitForTimeout(400);
const slots = await ev(() => window.__ashline.profile.data.equipped.emotes.join());
check('an emote equips into the chosen wheel slot', slots === 'ex_wave,ex_salute,ex_shuffle,', slots);
const prev = await ev(() => { const pv = window.__ashline.preview; const m = pv.models.get(pv.cur)?.userData.model; return { emote: m?.emote?.anim, loop: m?.emote?.loop }; });
check('the Armory preview plays the emote on your operator (looping)', prev.emote === 'shuffle' && prev.loop, JSON.stringify(prev));
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/u9-01-armory-emote.png` });
await ev(() => window.__ashline.screens.back());

// ---- match: emote wheel → third-person, animation, cancel by moving
await ev(async () => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { mode: 'tdm', map: 'cinder_yard', botsAllies: 0, botsEnemies: 1, weather: 'clear', halloween: false }); a.screens.clear(); await a.startMatch(); });
await waitState('match-live');
await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.4); for (const c of g.match.combatants) if (c !== g.player) { c.brain = null; c.x = 999; c.alive = false; } g.player.spawnProtectT = 999; });
// let the app's own frame loop read the keys (don't tick the game from the test here)
const frames = (n) => p.waitForFunction((n) => { const a = window.__ashline; a.__f0 = a.__f0 ?? a.engine.frames ?? 0; return true; }, n).then(() => p.waitForTimeout(1500));
await p.keyboard.press('KeyB');
await frames(2);
const wheel = await ev(() => ({ open: window.__ashline.game.wheel.open, slots: [...document.querySelectorAll('.emote-wheel .ew-slot')].map((e) => e.textContent) }));
check('B opens the emote wheel with your 4 slots', wheel.open && wheel.slots.length === 4 && /SHUFFLE/.test(wheel.slots[2]), JSON.stringify(wheel));
await p.screenshot({ path: `${out}/u9-02-wheel.png` });
await p.keyboard.press('Digit3');
await frames(2);
const em = await ev(() => {
  const a = window.__ashline, g = a.game, p = g.player;
  for (let i = 0; i < 6; i++) g.update(1 / 30);
  const cam = a.engine.camera.position, v = g.views.get(p.id);
  return { state: p.emoteState?.id, camDist: Math.hypot(cam.x - p.x, cam.z - p.z), vm: g.vm.visible, own: v.root.visible, anim: v.emote?.anim, weapon: p.weapon.def.id };
});
check('picking slot 3 plays the emote', em.state === 'ex_shuffle' && em.anim === 'shuffle', JSON.stringify(em));
check('camera goes third-person and shows your own operator (viewmodel hidden)', em.camDist > 1.5 && !em.vm && em.own, JSON.stringify(em));
await ev(() => { window.__ashline.game.hud.root.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-br').forEach((e) => { e.style.visibility = 'hidden'; }); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/u9-03-emote-3p.png` });
await p.keyboard.down('KeyW');
await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 6; i++) g.update(1 / 30); });
await p.keyboard.up('KeyW');
const cancel = await ev(() => { const a = window.__ashline, g = a.game, p = g.player; for (let i = 0; i < 6; i++) g.update(1 / 30); const cam = a.engine.camera.position; return { state: !!p.emoteState, camDist: Math.hypot(cam.x - p.x, cam.z - p.z), vm: g.vm.visible }; });
check('moving cancels the emote and returns to first person', !cancel.state && cancel.camDist < 0.5 && cancel.vm, JSON.stringify(cancel));

// ---- new weapons in first person
for (const [id, sec] of [['smg_hornet', false], ['dmr_talon', false], ['pistol_stinger', true]]) {
  const r = await ev(([id, sec]) => {
    const g = window.__ashline.game, pl = g.player;
    pl.applyLoadout({ ...pl.loadout, [sec ? 'secondary' : 'primary']: id }); pl.cur = sec ? 1 : 0; pl.swapT = 0;
    for (const w of pl.weapons) w.refill();
    g.vm.setWeapon(id, undefined, null);
    const s0 = pl.stats.shots;
    pl.cmd.fire = true;
    for (let i = 0; i < 20; i++) { g.readInput = () => { pl.cmd.fire = true; }; g.update(1 / 30); }
    delete g.readInput;
    pl.cmd.fire = false;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    return { shots: pl.stats.shots - s0, vm: g.vm.weaponId ?? g.vm.cur?.id ?? null };
  }, [id, sec]);
  check(`${id}: equips and fires in first person`, r.shots >= 1, JSON.stringify(r));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/u9-04-${id}.png` });
}
await ev(() => window.__ashline.toMenu());
await waitState('menu');

// ---- Battle Royale defaults to Ashfield
await p.click('.menu-btn[data-go=play]');
await p.waitForTimeout(400);
await p.click('.choice[data-k=mode] button[data-v=br]');
await p.waitForTimeout(300);
check('choosing Battle Royale selects Ashfield Valley', (await ev(() => window.__ashline.profile.data.matchSetup.map)) === 'ashfield');
await p.screenshot({ path: `${out}/u9-05-setup.png` });
await ev(() => { const s = window.__ashline.profile.data.matchSetup; s.botsEnemies = 9; s.weather = 'clear'; window.__ashline.profile.save(); });
await p.click('text=Start Match');
await waitState('match-live', 240000);
const af = await ev(() => { const g = window.__ashline.game, m = g.match; g.debugAdvance(3.4); for (let i = 0; i < 10; i++) g.update(1 / 30); return { map: m.map.def.id, n: m.combatants.length, loot: m.loot.length, models: g.brView.items.size, r: Math.round(g.match.br.zone.r0) }; });
check('Battle Royale on Ashfield: 10 players, ~2× loot, big zone', af.map === 'ashfield' && af.n === 10 && af.loot >= 70 && af.models === af.loot && af.r > 120, JSON.stringify(af));
// overview shots
await ev(() => { const a = window.__ashline, g = a.game; g.hud.root.style.visibility = 'hidden'; const cam = a.engine.camera; g.updateCamera = () => { cam.position.set(-20, 55, 95); cam.lookAt(10, 0, 0); cam.updateMatrixWorld(); }; g.update(1 / 30); });
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/u9-06-ashfield-overview.png` });
await ev(() => { const a = window.__ashline, g = a.game, cam = a.engine.camera; g.updateCamera = () => { cam.position.set(-34, 2.2, 30); cam.lookAt(-50, 3, 50); cam.updateMatrixWorld(); }; g.update(1 / 30); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/u9-07-ashfield-farm.png` });
await ev(() => { const a = window.__ashline, g = a.game, cam = a.engine.camera; g.updateCamera = () => { cam.position.set(-6, 2, -6); cam.lookAt(12, 6, 14); cam.updateMatrixWorld(); }; g.update(1 / 30); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/u9-08-ashfield-mill.png` });
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
