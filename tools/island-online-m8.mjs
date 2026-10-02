// Online checks for milestone 8: the host's island event reaches the client,
// pumpkins smash for everyone, a client attaches a mod through the host, and
// a client finds a Benton Badge on their own device.
// Needs `npm run island:server` and the dev server.
// Usage: node tools/island-online-m8.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const errors = [];
async function open(label) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message} ${(e.stack || '').split('\n')[1]}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => (__bi.input.lockBlocked = true));
  return p;
}
const waitFor = async (p, fn, ms = 20000, arg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
};
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const key = async (p, k, ms = 150) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await frames(p); };

const H = await open('host');
const C = await open('client');
// the host plays Spooky Night; the client has events switched off (the host decides)
await H.evaluate(() => { const P = __bi.save.data.profile; P.event = true; P.eventPick = 'spooky'; __bi.save.write(); });
await C.evaluate(() => { const P = __bi.save.data.profile; P.event = false; __bi.save.write(); });
await H.fill('input[data-set=name]', 'Hostie');
await H.click('[data-act=team][data-id="2"]');
await C.fill('input[data-set=name]', 'Guesty');
await H.click('[data-act=online]');
await waitFor(H, () => !!document.querySelector('[data-act=host]'));
await H.click('[data-act=host]');
await waitFor(H, () => !!document.querySelector('.code'));
const code = (await H.textContent('.code')).trim().toLowerCase();
await C.click('[data-act=online]');
await waitFor(C, (c) => !!document.querySelector(`[data-act=join][data-code="${c}"]`), 15000, code);
await C.click(`[data-act=join][data-code="${code}"]`);
await waitFor(H, () => document.querySelectorAll('.player-row').length === 2, 15000);
await H.click('[data-act=start-online]');
await waitFor(C, () => __bi.game.role === 'client' && !!__bi.game.world, 15000);
const evC = await C.evaluate(() => ({ event: __bi.game.event, pumpkins: __bi.game.eventFx.pumpkins.length, bg: __bi.game.scene.background.getHexString() }));
const evH = await H.evaluate(() => ({ event: __bi.game.event, pumpkins: __bi.game.eventFx.pumpkins.length }));
check("the host's Spooky Night reaches the client (same pumpkins, night sky) even with events off on the client", evC.event === 'spooky' && evH.event === 'spooky' && evC.pumpkins === evH.pumpkins && evC.pumpkins > 20 && evC.bg === '1d1540', JSON.stringify({ evH, evC }));

await waitFor(C, () => __bi.game.busT > 1.8, 20000);
await C.keyboard.press('Space');
await H.keyboard.press('Space');
await waitFor(H, () => __bi.game.actors[1].state !== 'bus', 8000);
await H.evaluate(() => (__bi.engine.timeScale = 3));
await C.evaluate(() => (__bi.engine.timeScale = 3));
await waitFor(C, () => ['ground', 'swim'].includes(__bi.game.player.state), 60000);
await H.evaluate(() => (__bi.engine.timeScale = 1));
await C.evaluate(() => (__bi.engine.timeScale = 1));
await H.evaluate(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; a.hp = 1e6; }
  window.tp = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.ep++; };
  g.storm.update = () => {};
});

// ---- the host smashes a pumpkin: it vanishes for the client and its Bucks show up there
const pi = await H.evaluate(() => { const g = __bi.game; const c = g.eventFx.pumpkins.find((q) => q.alive); window.PI = g.eventFx.pumpkins.indexOf(c); g.damageCollider(c, 999, g.player); return window.PI; });
const gone = await waitFor(C, (i) => !__bi.game.eventFx.pumpkins[i].alive, 8000, pi);
const coins = await waitFor(C, (i) => { const c = __bi.game.eventFx.pumpkins[i]; return __bi.game.loot.pickups.some((k) => k.it.kind === 'coin' && Math.hypot(k.pos.x - (c.minX + c.maxX) / 2, k.pos.z - (c.minZ + c.maxZ) / 2) < 5); }, 8000, pi);
check('the host smashes a pumpkin: it disappears on the client and its Benton Bucks drop there too', gone && coins, JSON.stringify({ gone, coins }));

// ---- the client attaches a 4x Scope through the host
const mnid = await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1];
  let f = null;
  for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) f = { x, z }; }
  tp(c, f.x, f.z);
  c.slots = [{ kind: 'weapon', id: 'ar', rarity: 2, mag: 30 }, null, null, null, null];
  c.select(0);
  window.MPK = g.loot.drop({ kind: 'mod', id: 'scope', count: 1 }, c.pos.clone().add(new c.pos.constructor(0, 0.3, -1.2)), null, true);
  return window.MPK.nid;
});
await waitFor(C, () => __bi.game.player.slots[0]?.id === 'ar' && __bi.game.player.sel === 0, 8000);
await C.evaluate(() => (__bi.game.controller.yaw = 0));
const pr = await waitFor(C, () => /Attach 4x Scope to Thunder Rifle/.test(__bi.game.controller.prompt?.text || ''), 8000);
await key(C, 'KeyE');
const onH = await waitFor(H, () => (__bi.game.actors[1].slots[0].mods || []).includes('scope') && !__bi.game.loot.pickups.includes(window.MPK), 5000);
const onC = await waitFor(C, (nid) => (__bi.game.player.slots[0].mods || []).includes('scope') && __bi.game.player.weapon.zoom === 3 && !__bi.game.loot.pickups.some((k) => k.nid === nid), 5000, mnid); // (other attachments can lie around as normal floor loot)
check("the client presses E on a 4x Scope: the host attaches it; the client's rifle gets it (3x zoom) and the pickup is gone", pr && onH && onC, JSON.stringify({ pr, onH, onC }));

// ---- the client finds a badge on their own device (the host's collection is untouched)
const bdg = await H.evaluate(() => { const b = __bi.game.badges.list[4]; return [b.pos.x, b.pos.y, b.pos.z]; });
await H.evaluate(([x, y, z]) => { const c = __bi.game.actors[1]; c.pos.set(x, y - 1.1, z); c.vel.set(0, 0, 0); c.state = 'ground'; c.ep++; }, bdg);
const foundC = await waitFor(C, () => !!__bi.save.data.badges?.found?.wrench, 8000);
const hostHas = await H.evaluate(() => !!__bi.save.data.badges?.found?.wrench);
await C.screenshot({ path: `${shots}/on8-01-client-spooky.png` });
check("the client reaches Dad's Wrench: it's saved on the client's device, not the host's", foundC && !hostHas, JSON.stringify({ foundC, hostHas }));

// ---- end: the client's result counts its badge
await H.evaluate(() => { const g = __bi.game; for (const a of g.actors) if (a.team !== g.player.team && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
const resC = await waitFor(C, () => __bi.game.result && __bi.game.result.badges === 1 && [...document.querySelectorAll('.sx-won')].some((e) => /Benton Badge found: 1 \(\+500 XP\)/.test(e.textContent)), 15000);
check("the client's result screen adds the badge's 500 XP", resC);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online milestone-8 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
