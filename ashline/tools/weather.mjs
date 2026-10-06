/**
 * Update check: dynamic weather presentation — overcast sky, rain that stops
 * at roofs, fog density, cloud-dimmed sun, lightning + thunder, wet ground,
 * the Weather Effects toggle, cleanup on exit, and screenshots for review.
 * Usage: node tools/weather.mjs [url] [outDir]
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
  if (sessionStorage.getItem('wx-init')) return;
  sessionStorage.setItem('wx-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'high', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: true, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
const base = await ev(() => { const e = window.__ashline.engine; return { sun: e.sun.intensity, fog: e.scene.fog.density, rough: window.__ashline.materials.get('asphalt').mat.roughness }; });

const start = async (map, weather) => {
  await ev(async ([map, weather]) => { const a = window.__ashline; Object.assign(a.profile.data.matchSetup, { map, mode: 'tdm', botsAllies: 0, botsEnemies: 1, weather }); await a.startMatch(); }, [map, weather]);
  await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 120000 });
  await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.4); for (const c of g.match.combatants) if (c !== g.player) { c.alive = false; c.x = 999; c.brain = null; } g.player.spawnProtectT = 999; });
};
const frames = (n, dt = 1 / 30) => ev(([n, dt]) => { const g = window.__ashline.game; for (let i = 0; i < n; i++) g.update(dt); }, [n, dt]);
const hideHud = () => ev(() => window.__ashline.game.hud.root.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-br').forEach((e) => { e.style.visibility = 'hidden'; }));

// --- thunderstorm on Cinder Yard
await start('cinder_yard', 'storm');
await frames(900); // 30 s: channels settle, ground soaks
const st = await ev(() => {
  const a = window.__ashline, g = a.game, v = g.wxView, w = g.match.weather;
  const r = v.rain.geometry.drawRange.count / 2;
  let below = 0;
  const d = v.drops;
  for (let i = 0; i < r; i++) if (d[i * 4 + 1] < v.roofAt(d[i * 4], d[i * 4 + 2]) - 0.6) below++;
  return { kind: w.kind, cloud: w.cur.cloud, rain: r, below, overcast: a.sky.material.uniforms.overcast.value, sun: a.engine.sun.intensity, fog: a.engine.scene.fog.density, rough: a.materials.get('asphalt').mat.roughness, chip: document.querySelector('#hud .wxchip')?.textContent, sight: w.sightRange() };
});
check('storm: weather kind is storm, chip shows it', st.kind === 'storm' && /thunder/i.test(st.chip), JSON.stringify({ kind: st.kind, chip: st.chip }));
check('storm: sky goes overcast', st.overcast > 0.9, st.overcast.toFixed(2));
check('storm: sun dimmed by cloud', st.sun < base.sun * 0.4, `${st.sun.toFixed(2)} vs ${base.sun}`);
check('storm: rain streaks active', st.rain > 1000, `${st.rain} drops`);
check('storm: no rain drawn below roofs', st.below === 0, `${st.below} below`);
check('storm: fog thicker', st.fog > base.fog * 1.8, `${st.fog.toFixed(4)} vs ${base.fog}`);
check('storm: ground is wet (lower roughness)', st.rough < base.rough * 0.7, `${st.rough.toFixed(2)} vs ${base.rough}`);
check('storm: bots see less far', st.sight < 75, st.sight.toFixed(1));
// lightning
const bolt = await ev(() => { const g = window.__ashline.game, v = g.wxView; v.boltT = 0; let peak = 0; for (let i = 0; i < 30; i++) { g.update(1 / 60); peak = Math.max(peak, v.flash, window.__ashline.sky.material.uniforms.flash.value); } return { peak, at: g.match.lastBolt }; });
check('storm: lightning flashes the sky', bolt.peak > 0.5 && bolt.at != null, JSON.stringify(bolt));
await ev(() => { const g = window.__ashline.game; g.look.yaw = Math.PI * 0.85; g.look.pitch = 0.08; });
await frames(20);
await hideHud(); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/wx-storm.png` });
// look out from under a roof: no drops inside
const indoor = await ev(() => {
  const g = window.__ashline.game, w = g.match.world, B = g.map.def.bounds, v = g.wxView;
  for (let x = B.minX + 4; x < B.maxX - 4; x += 1.5) for (let z = B.minZ + 4; z < B.maxZ - 4; z += 1.5) {
    const y = w.groundHeight(x, z, 0.3, 0.3);
    if (y !== 0 || w.overlaps(x - 0.4, 0.05, z - 0.4, x + 0.4, 1.8, z + 0.4)) continue;
    const roof = w.raycast(x, 1.6, z, 0, 1, 0, 6, 'solid');
    if (!roof) continue;
    const pl = g.player; pl.x = x; pl.z = z; pl.y = 0;
    for (let i = 0; i < 120; i++) g.update(1 / 30);
    const r = v.rain.geometry.drawRange.count / 2; let inside = 0;
    for (let i = 0; i < r; i++) { const dx = v.drops[i * 4] - x, dz = v.drops[i * 4 + 2] - z, dy = v.drops[i * 4 + 1]; if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5 && dy < 1.6 + roof.t) inside++; }
    return { x, z, roofT: roof.t, inside };
  }
  return null;
});
check('storm: no rain falls through a roof onto the player', indoor && indoor.inside === 0, JSON.stringify(indoor));
// Weather Effects off: rain hidden, fog/light still follow
await ev(() => { window.__ashline.settings.set('graphics.weatherFx', false); });
await frames(10);
const off = await ev(() => { const a = window.__ashline, v = a.game.wxView; return { rain: v.rain.visible, overcast: a.sky.material.uniforms.overcast.value }; });
check('Weather Effects off hides rain but keeps the overcast sky', !off.rain && off.overcast > 0.9, JSON.stringify(off));
await ev(() => { window.__ashline.settings.set('graphics.weatherFx', true); });
await ev(() => window.__ashline.toMenu());
const after = await ev(() => { const a = window.__ashline, e = a.engine; return { sun: e.sun.intensity, fog: e.scene.fog.density, rough: a.materials.get('asphalt').mat.roughness, rainInScene: !!e.scene.getObjectByName('rain'), overcast: a.sky.material.uniforms.overcast.value }; });
check('leaving the match restores light, fog, materials and removes rain', Math.abs(after.sun - base.sun) < 1e-6 && Math.abs(after.fog - base.fog) < 1e-9 && Math.abs(after.rough - base.rough) < 1e-6 && !after.rainInScene && after.overcast === 0, JSON.stringify(after));

// --- fog on Old Quarter, rain on Signal Station: review shots
await start('old_quarter', 'fog');
await frames(600);
const fg = await ev(() => { const a = window.__ashline, g = a.game; return { fog: a.engine.scene.fog.density, sight: g.match.weather.sightRange(), rain: g.wxView.rain.visible }; });
check('fog: dense fog, short bot sight, no rain', fg.fog > 0.02 && fg.sight < 50 && !fg.rain, JSON.stringify(fg));
await ev(() => { const g = window.__ashline.game; g.look.yaw = -Math.PI / 2; g.look.pitch = 0.02; });
await frames(10); await hideHud(); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/wx-fog.png` });
await ev(() => window.__ashline.toMenu());
await start('signal_station', 'rain');
await frames(600);
await ev(() => { const g = window.__ashline.game; g.look.yaw = 0.4; g.look.pitch = 0.05; });
await frames(10); await hideHud(); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/wx-rain.png` });
const rn = await ev(() => { const g = window.__ashline.game; return { kind: g.match.weather.kind, storm: g.match.weather.cur.storm, rain: g.wxView.rain.visible }; });
check('rain: fixed rain, no storm channel', rn.kind === 'rain' && rn.storm < 0.05 && rn.rain, JSON.stringify(rn));
await ev(() => window.__ashline.toMenu());

// --- dynamic: weather changes during a match and is announced
await start('cinder_yard', 'dynamic');
const dyn = await ev(() => {
  const g = window.__ashline.game, m = g.match, seen = new Set([m.weather.kind]);
  let popups = 0;
  const obs = new MutationObserver((ml) => { for (const r of ml) for (const n of r.addedNodes) if (/WEATHER/.test(n.textContent || '')) popups++; });
  obs.observe(document.querySelector('#hud .popups'), { childList: true, subtree: true });
  for (let i = 0; i < 30 * 600 && seen.size < 3; i++) { g.update(1 / 30); seen.add(m.weather.kind); if (i % 600 === 0) for (const c of m.combatants) if (c !== g.player) { c.alive = false; c.x = 999; } }
  for (const r of obs.takeRecords()) for (const n of r.addedNodes) if (/WEATHER/.test(n.textContent || '')) popups++;
  obs.disconnect();
  return { seen: [...seen], popups };
});
check('dynamic: weather changes during the match', dyn.seen.length >= 3, dyn.seen.join(' → '));
check('dynamic: changes are announced on the HUD', dyn.popups >= 1, `${dyn.popups} popups`);
await ev(() => window.__ashline.toMenu());

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
