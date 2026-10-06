/**
 * Update check: sun glare/lens flare (visible facing the sun, hidden behind
 * buildings), window reflections (per-map probe), enemy scope glint, the
 * Waspinator collab in the Store/Armory, and screenshots for review.
 * Usage: node tools/sun.mjs [url] [outDir]
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
  if (sessionStorage.getItem('sun-init')) return;
  sessionStorage.setItem('sun-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'high', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: true, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });

for (const map of ['cinder_yard', 'old_quarter', 'signal_station']) {
  await ev(async (map) => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { map, mode: 'tdm', botsAllies: 0, botsEnemies: 1, weather: 'clear' }); await a.startMatch(); }, map);
  await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 120000 });
  // find an open spot that sees the sun and one where a building hides it
  const spots = await ev(() => {
    const a = window.__ashline, g = a.game, w = g.match.world, B = g.map.def.bounds, d = a.engine.sunDir;
    g.debugAdvance(3.4);
    for (const c of g.match.combatants) if (c !== g.player) { c.alive = false; c.x = 999; c.brain = null; }
    let open = null, hidden = null;
    for (let x = B.minX + 4; x < B.maxX - 4 && !(open && hidden); x += 2) for (let z = B.minZ + 4; z < B.maxZ - 4 && !(open && hidden); z += 2) {
      const y = w.groundHeight(x, z, 0.3, 0.3);
      if (y !== 0 || w.overlaps(x - 0.4, 0.05, z - 0.4, x + 0.4, 1.8, z + 0.4)) continue;
      const hit = w.raycast(x, 1.62, z, d.x, d.y, d.z, 300, 'sight');
      if (!hit && !open) open = { x, z };
      if (hit && hit.t > 3 && hit.t < 25 && !hidden) hidden = { x, z };
    }
    return { open, hidden, dir: { x: d.x, y: d.y, z: d.z } };
  });
  const look = async (spot, extraYaw = 0) => ev(([s, dir, ey]) => {
    const a = window.__ashline, g = a.game, pl = g.player;
    pl.x = s.x; pl.z = s.z; pl.y = 0; pl.vx = pl.vz = 0; pl.spawnProtectT = 99;
    g.look.yaw = Math.atan2(-dir.x, -dir.z) + ey; g.look.pitch = Math.min(1.3, Math.asin(dir.y) - 0.04);
    for (let i = 0; i < 40; i++) g.update(1 / 60);
    const el = document.querySelector('#hud .sunflare');
    return { display: el.style.display, core: Number(document.querySelector('#hud .sf-core').style.opacity || 0) };
  }, [spot, spots.dir, extraYaw]);
  const seen = await look(spots.open);
  await ev(() => window.__ashline.game.hud.root.querySelectorAll('.hud-tl,.hud-tc,.hud-tr,.hud-bl,.hud-br').forEach((e) => { e.style.visibility = 'hidden'; }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/sun-${map}-flare.png` });
  check(`${map}: lens flare shows when facing the sun in the open`, seen.display !== 'none' && seen.core > 0.5, JSON.stringify(seen));
  if (spots.hidden) {
    const hid = await look(spots.hidden);
    check(`${map}: flare hidden when a building blocks the sun`, hid.display === 'none' || hid.core < 0.05, JSON.stringify(hid));
  } else check(`${map}: found a spot where buildings block the sun`, false);
  const away = await look(spots.open, Math.PI);
  check(`${map}: no flare when facing away`, away.display === 'none' || away.core < 0.05);
  const refl = await ev(() => { const a = window.__ashline; return !!a.activeMap.reflEnv && a.materials.get('window_dark').mat.envMap === a.activeMap.reflEnv; });
  check(`${map}: windows use this map's reflection probe`, refl);
  // reflection review shot: windows at a glancing angle
  const RV = { cinder_yard: [-6, 9, Math.PI + 0.35, 0.16], old_quarter: [-30, 24, -Math.PI / 2 + 0.12, 0.12], signal_station: [-4, -13, 0.25, 0.12] }[map];
  await ev(([x, z, yaw, pitch]) => { const g = window.__ashline.game, pl = g.player; pl.x = x; pl.z = z; pl.y = 0; g.look.yaw = yaw; g.look.pitch = pitch; for (let i = 0; i < 30; i++) g.update(1 / 60); }, RV);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/sun-${map}-reflect.png` });
  await ev(() => window.__ashline.toMenu());
}

// scope glint: an enemy sniper aiming at the player
await ev(async () => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { map: 'cinder_yard', mode: 'tdm', botsAllies: 0, botsEnemies: 1, weather: 'clear' }); await a.startMatch(); });
await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 120000 });
const glint = await ev(() => {
  const a = window.__ashline, g = a.game, pl = g.player, m = g.match;
  g.debugAdvance(3.4);
  const e = m.combatants.find((c) => c !== pl);
  e.brain = null; e.applyLoadout({ ...e.loadout, primary: 'sr_longreach' }); e.cur = 0;
  pl.x = -20; pl.z = -1.5; pl.y = 0; pl.spawnProtectT = 99;
  e.x = 20; e.z = -1.5; e.y = 0; e.alive = true; e.health = 100;
  const yaw = Math.PI / 2;
  e.yaw = e.cmd.yaw = yaw; e.pitch = e.cmd.pitch = 0; e.cmd.ads = true;
  g.look.yaw = -Math.PI / 2; g.look.pitch = 0;
  for (let i = 0; i < 60; i++) { e.cmd.ads = true; e.cmd.yaw = yaw; g.update(1 / 60); }
  const s = g.glints.get(e.id);
  return { vis: !!s?.visible, op: s?.material.opacity ?? 0 };
});
check('enemy sniper aiming at you shows a scope glint', glint.vis && glint.op > 0.5, JSON.stringify(glint));
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/sun-glint.png` });
await ev(() => window.__ashline.toMenu());

// collab store + armory
await p.click('.menu-btn[data-go=store]');
await p.waitForTimeout(800);
const col = await ev(() => ({ box: !!document.querySelector('.collab-box'), items: [...document.querySelectorAll('.collab-box [data-item]')].map((e) => e.dataset.item), bundle: !!document.querySelector('.collab-box [data-bundle=bd_waspinator]') }));
check('Store shows the Waspinator collab section (bundle + 2 items)', col.box && col.bundle && col.items.join() === 'ch_waspinator,bn_waspinator', JSON.stringify(col));
await p.click('.collab-box [data-bundle=bd_waspinator]');
await p.waitForTimeout(300);
await p.click('[data-a=topup]');
await p.waitForTimeout(200);
await p.click('[data-a=buyb]');
await p.waitForTimeout(300);
await p.click('.modal .btn.primary');
await p.waitForTimeout(800);
const owned = await ev(() => ['ch_waspinator', 'bn_waspinator'].every((id) => window.__ashline.profile.owns(id)));
check('collab bundle purchase with test credits', owned);
await ev(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
await ev(() => { const pr = window.__ashline.profile; pr.equip('ch_waspinator', 'ar_kv7'); pr.equip('bn_waspinator'); pr.save(); });
await p.click('.collab-box [data-item=ch_waspinator]');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/collab-store.png` });
await ev(() => window.__ashline.toMenu());
// keychain on the first-person weapon
await ev(async () => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { map: 'cinder_yard', mode: 'tdm', botsAllies: 0, botsEnemies: 1, weather: 'clear' }); await a.startMatch(); });
await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 120000 });
const vm = await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.4); g.hud.root.style.display = 'none'; g.look.yaw = -Math.PI / 2; g.look.pitch = -0.1; for (let i = 0; i < 20; i++) g.update(1 / 60); return window.__ashline.viewmodel.curCharm; });
check('keychain hangs on the first-person weapon', vm === 'ch_waspinator', vm);
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/collab-keychain.png` });
const banner = await ev(() => { const img = new Image(); return new Promise((r) => { img.onload = () => r(img.width); img.src = window.__ashline.profile.look.banner && document.createElement('canvas').toDataURL(); }); });
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
