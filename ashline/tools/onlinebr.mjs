/**
 * Online Battle Royale in a real browser: the dedicated server runs BR, a
 * browser player connects through the Online screen, and we check the client
 * mirrors the server's zone, loot and weather, the F key swaps a weapon on
 * the server, the zone hurts, and elimination shows the placement.
 * Usage: npm run build && node tools/onlinebr.mjs [outDir]
 */
import { chromium } from 'playwright';
import { startServer } from '../server/server.mjs';
const out = process.argv[2] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const srv = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'br' }], time: 8 });
const base = `http://localhost:${srv.port}/`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => errors.push(`${e.message} ${(e.stack || '').split('\n')[1]}`));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => {
  if (sessionStorage.getItem('init')) return;
  sessionStorage.setItem('init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } }));
  localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, name: 'Pilot' }));
});
await p.goto(base, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.click('.menu-btn[data-go=online]');
await p.waitForTimeout(300);
await p.click('[data-a=connect]');
await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 });
await p.evaluate(() => { const a = window.__ashline; a.engine.shouldRender = () => false; a.input.enabled = true; a.input.lastLockFail = performance.now(); });
const drive = (secs, setup = '') => p.evaluate(async ([secs, setup]) => {
  const a = window.__ashline;
  if (setup) new Function('a', 'g', setup)(a, a.game);
  const t0 = performance.now(); let last = t0;
  while (performance.now() - t0 < secs * 1000) {
    await new Promise((r) => setTimeout(r, 16));
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    a.input.poll(); a.game.update(dt); a.input.endFrame?.();
  }
}, [secs, setup]);
await drive(6.0);
await p.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'freezeBots' })); // bots stop looting so both sides can be compared
await drive(0.6);
const s1 = await p.evaluate(() => {
  const g = window.__ashline.game, m = g.match;
  return {
    mode: m.mode.id, state: m.state, n: m.combatants.length, loot: m.loot?.length, views: g.brView?.items.size, zone: m.br?.cur, cold: m.ceasefireT,
    strip: document.querySelector('#hud .obj-strip')?.textContent, lim: document.querySelector('#hud .lim')?.textContent, wx: document.querySelector('#hud .wxchip')?.textContent, kindSrv: null,
  };
});
const srvM = srv.room.match;
check('client is in the server BR match (live)', s1.mode === 'br' && s1.state === 'live' && s1.n === srvM.combatants.length, JSON.stringify({ mode: s1.mode, state: s1.state, n: s1.n }));
check('client loot mirrors the server and is rendered', s1.loot === srvM.loot.length && s1.views === s1.loot && s1.loot >= 30, `${s1.loot} client / ${srvM.loot.length} server / ${s1.views} models`);
check('client zone matches the server', s1.zone && Math.abs(s1.zone.r - (srvM.br.zone.r0)) < 1, JSON.stringify(s1.zone));
check('HUD shows weapons-cold timer, zone clock and players alive', /WEAPONS COLD/.test(s1.strip) && /ZONE/.test(s1.strip) && /ALIVE/.test(s1.lim), `${s1.strip} | ${s1.lim}`);
check('weather chip mirrors the server weather', s1.wx && s1.wx.length > 0 && srvM.weather.kind.length > 0, `${s1.wx} (server ${srvM.weather.kind})`);
// weapon pick-up with the real F key path (input → cmd bit → server)
await p.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'freezeBots' }));
const target = await p.evaluate(() => { const m = window.__ashline.game.match; const it = m.loot.find((l) => l.kind === 'weapon'); window.__ashline.online.client.send({ t: 'dbg', op: 'place', x: it.x, y: it.y, z: it.z }); return it; });
await drive(0.6);
const prompt = await p.evaluate(() => document.querySelector('#hud .prompt')?.textContent || '');
check('standing on server loot shows the pick-up prompt', /PICK UP/.test(prompt), prompt);
await drive(0.15, "a.input.down.add('KeyF'); a.input.pressedSet.add('KeyF')");
await p.evaluate(() => { const i = window.__ashline.input; i.down.delete('KeyF'); i.pressedSet.delete('KeyF'); });
await drive(0.8);
const after = await p.evaluate(() => { const g = window.__ashline.game; return { prim: g.player.weapons[0].def.id, vm: g.vm.weaponId ?? null }; });
const sp = srvM.combatants.find((c) => !c.isBot);
check('F swaps the weapon on the server and the client follows', sp.weapons[0].def.id === target.wid && after.prim === target.wid, `server ${sp.weapons[0].def.id}, client ${after.prim}, wanted ${target.wid}`);
// zone hurts
srvM.ceasefireT = 0;
const z = srvM.br.zone; z.state = 'final'; z.t = Infinity; z.x0 = z.x1 = sp.x + 40; z.z0 = z.z1 = sp.z; z.r0 = z.r1 = 3;
await drive(2.5);
const zs = await p.evaluate(() => ({ hp: window.__ashline.game.player.health, tint: document.querySelector('#hud .zonetint')?.classList.contains('on'), strip: document.querySelector('#hud .obj-strip')?.textContent }));
check('outside the server zone: health drains, tint and warning on the client', zs.hp < 100 && zs.tint && /OUTSIDE/.test(zs.strip), JSON.stringify(zs));
await p.evaluate(() => window.__ashline.engine.render(true));
await p.screenshot({ path: `${out}/onlinebr-zone.png` });
// eliminated → placement shown, no respawn
await p.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'health', v: 1 }));
await drive(3);
const dead = await p.evaluate(() => { const g = window.__ashline.game; return { alive: g.player.alive, death: document.querySelector('#hud .death')?.textContent || '' }; });
check('eliminated online: placement shown, waits for the match result', !dead.alive && /Eliminated · #\d+ of \d+/.test(dead.death) && /results when the match ends/.test(dead.death), dead.death);
await drive(4);
check('no respawn in online BR', !(await p.evaluate(() => window.__ashline.game.player.alive)));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
srv.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
