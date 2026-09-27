// Online checks for milestone 4: a client drives, rides and shops through the
// host (relay server). Needs `npm run island:server` and the dev server.
// Usage: node tools/island-online-m4.mjs [url] [shotDir]
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
const key = async (p, k, ms = 150) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };

const H = await open('host');
const C = await open('client');
await H.fill('input[data-set=name]', 'Hostie');
await H.click('[data-act=bots][data-id="29"]'); // 30 players: the biggest snapshot
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
const started = await waitFor(C, () => __bi.game.role === 'client' && !!__bi.game.world, 15000);
check('client joins the host\'s match; both have the same 8 vehicles', started && (await C.evaluate(() => __bi.game.vehicles.list.length)) === 8 && (await H.evaluate(() => __bi.game.vehicles.list.length)) === 8);

await waitFor(C, () => __bi.game.busT > 1.8, 20000);
await C.keyboard.press('Space');
await H.keyboard.press('Space');
await waitFor(H, () => __bi.game.actors[1].state !== 'bus', 8000);
await H.evaluate(() => (__bi.engine.timeScale = 3));
await C.evaluate(() => (__bi.engine.timeScale = 3));
await waitFor(C, () => ['ground', 'swim'].includes(__bi.game.player.state), 60000);
await H.evaluate(() => (__bi.engine.timeScale = 1));
await C.evaluate(() => (__bi.engine.timeScale = 1));

// host: freeze bots, clear a strip of open ground, park truck 0 there and put the client beside it
await H.evaluate(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  let best = null;
  for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2 || g.world.physics.query(x - 9, z - 34, x + 9, z + 10).some((c) => c.kind !== 'tree' && c.kind !== 'rock')) continue;
    let dev = 0;
    for (const [dx, dz] of [[-8, -32], [8, -32], [-8, 8], [8, 8], [0, -16]]) dev = Math.max(dev, Math.abs(g.world.height(x + dx, z + dz) - h));
    if (dev < 2.5 && (!best || dev < best.dev)) best = { x, z, y: h, dev };
  }
  window.F = best;
  for (const c of [...g.world.physics.query(best.x - 9, best.z - 34, best.x + 9, best.z + 10)]) g.world.destroyCollider(c);
  const v = g.vehicles.list[0];
  v.pos.set(best.x, best.y, best.z); v.yaw = 0; v.speed = 0; v.dirty = true; g.vehicles._sync(v, true);
  const c = g.actors[1];
  c.pos.set(best.x - 2.6, g.world.height(best.x - 2.6, best.z) + 0.05, best.z); c.state = 'ground'; c.ep++;
  g.player.pos.set(best.x + 8, g.world.height(best.x + 8, best.z + 6), best.z + 6); g.player.state = 'ground';
});
const F = await H.evaluate(() => window.F);
// the client's copy of the island drops the same trees (the host's destroyed list only covers world colliders)
await C.evaluate((f) => { const g = __bi.game; for (const c of [...g.world.physics.query(f.x - 9, f.z - 34, f.x + 9, f.z + 10)]) if (c.kind === 'tree' || c.kind === 'rock') g.world.destroyCollider(c); }, F);
await waitFor(C, (f) => { const P = __bi.game.player; return Math.hypot(P.pos.x - (f.x - 2.6), P.pos.z - f.z) < 1; }, 8000, F);
const seen = await waitFor(C, (f) => { const v = __bi.game.vehicles.list[0]; return Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 1; }, 8000, F);
const prompt = await C.evaluate(() => __bi.game.controller.prompt?.text);
check("the host's moved truck shows up in the same place for the client, with a Drive prompt", seen && /Drive Diesel Truck/.test(prompt || ''), prompt);

await key(C, 'KeyE');
const seated = await waitFor(H, () => __bi.game.actors[1].vehicle === __bi.game.vehicles.list[0] && __bi.game.actors[1].seat === 0, 5000);
const cSeat = await waitFor(C, () => __bi.game.player.vehicle === __bi.game.vehicles.list[0] && __bi.game.player.state === 'drive', 5000);
check('client presses E: the host seats them as the driver, and the client knows it', seated && cSeat);

await C.evaluate(() => (__bi.game.controller.yaw = 0));
await C.keyboard.down('KeyW');
// headless browsers run slowly: hold W until the host has seen 8 m of driving (or 20 s)
await waitFor(H, (f) => f.z - __bi.game.vehicles.list[0].pos.z > 8, 20000, F);
await C.keyboard.up('KeyW');
await C.waitForTimeout(900);
const drive = await H.evaluate((f) => { const v = __bi.game.vehicles.list[0]; return { dz: +(f.z - v.pos.z).toFixed(1), fuel: +v.fuel.toFixed(2), driven: +__bi.game.actors[1].stats.driven.toFixed(1) }; }, F);
const cView = await C.evaluate(() => __bi.game.vehicles.list[0].pos.toArray());
const hView = await H.evaluate(() => __bi.game.vehicles.list[0].pos.toArray());
const drift = Math.hypot(cView[0] - hView[0], cView[2] - hView[2]);
await C.screenshot({ path: `${shots}/on4-01-client-driving.png` });
check('client drives with W (simulated on their device): the host sees the truck move, burn fuel and count the distance', drive.dz > 5 && drive.fuel < 100 && drive.driven > 5 && drift < 2, JSON.stringify({ ...drive, drift: +drift.toFixed(2) }));
const bodyH = await H.evaluate(() => __bi.game.actors[1].pos.distanceTo(__bi.game.vehicles.list[0].pos));
check("on the host, the client's character rides in the driver seat", bodyH < 3, bodyH.toFixed(2));

await key(C, 'KeyE');
const outH = await waitFor(H, () => !__bi.game.actors[1].vehicle, 5000);
const outC = await waitFor(C, () => !__bi.game.player.vehicle && ['ground', 'air'].includes(__bi.game.player.state), 5000);
check('client presses E again: out of the truck on both machines', outH && outC);

// the host drives: the client sees it move
await H.evaluate(() => {
  const g = __bi.game, v = g.vehicles.list[4];
  v.pos.set(window.F.x + 5, window.F.y, window.F.z); v.yaw = 0; v.dirty = true; g.vehicles._sync(v, true);
  g.player.pos.set(v.pos.x - 2, v.pos.y, v.pos.z);
  g.vehicles.enter(g.player, v);
  __bi.input.keys.add('KeyW');
});
await waitFor(H, (f) => f.z - __bi.game.vehicles.list[4].pos.z > 8, 20000, F);
await H.evaluate(() => __bi.input.keys.delete('KeyW'));
await H.waitForTimeout(700);
const kH = await H.evaluate(() => __bi.game.vehicles.list[4].pos.toArray());
const kC = await C.evaluate(() => __bi.game.vehicles.list[4].pos.toArray());
const kSeat = await C.evaluate(() => __bi.game.actors[0].vehicle === __bi.game.vehicles.list[4]);
check('the host drives a kart: the client sees it move and sees the host in the seat', Math.hypot(kH[0] - kC[0], kH[2] - kC[2]) < 2 && Math.abs(kH[2] - F.z) > 4 && kSeat, JSON.stringify({ kH: kH.map(Math.round), kC: kC.map(Math.round), kSeat }));
await H.evaluate(() => { const g = __bi.game; g.vehicles.list[4].speed = 0; g.vehicles.exit(g.player); });

// shopping: the host gives the client Bucks and moves them to a vending bot
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1], V = g.world.vendors[0];
  c.bucks = 150;
  c.slots = [null, null, null, null, null];
  c.pos.set(V.stand.x, V.stand.y + 0.05, V.stand.z); c.state = 'ground'; c.ep++;
});
await waitFor(C, () => __bi.game.player.bucks === 150 && !!__bi.game.controller.prompt && /Shop/.test(__bi.game.controller.prompt.text), 8000);
await key(C, 'KeyE');
await waitFor(C, () => !document.querySelector('.shop').classList.contains('hidden'), 3000);
await key(C, 'Digit1');
const boughtH = await waitFor(H, () => __bi.game.actors[1].slots.some((s) => s && s.id === 'bigshield') && __bi.game.actors[1].bucks === 50, 5000);
const boughtC = await waitFor(C, () => __bi.game.player.slots.some((s) => s && s.id === 'bigshield') && __bi.game.player.bucks === 50 && document.querySelector('.bucks b').textContent === '50', 5000);
await C.screenshot({ path: `${shots}/on4-02-client-shop.png` });
check('client buys from a vending bot: the host charges 100 Bucks and the item lands in their inventory', boughtH && boughtC);

// the biggest snapshot (30 players + every vehicle moved) still fits
await H.evaluate(() => { for (const v of __bi.game.vehicles.list) v.dirty = true; });
await H.waitForTimeout(400);
const pres = await H.evaluate(() => { const s = __bi.session; const me = s.room.peers().find((p) => p.sameTab); return new TextEncoder().encode(JSON.stringify(me.presence)).length; });
check('host presence with 30 players and all 8 vehicles stays under the 4 KiB room limit', pres < 4096, `${pres} bytes`);

// challenges: the client's result carries the stats the host counted
const fps = await C.evaluate(() => Math.round(__bi.engine.fps));
console.log(`(client ${fps} fps)`);
await C.evaluate(() => { const s = __bi.save.data; __bi.challenges.dailyChallenges(); s.challenges.list = [{ id: 'drive', prog: 0, done: false }, { id: 'bucks', prog: 0, done: false }, { id: 'play', prog: 0, done: false }]; __bi.save.write(); });
await H.evaluate(() => { const g = __bi.game; for (const a of g.actors) if (a.id !== 1 && a.alive) { a.state = 'ground'; g.eliminate(a, g.actors[1], {}); } });
const res = await waitFor(C, () => !!__bi.game.result, 10000);
const chal = await C.evaluate(() => __bi.game.result?.challenges?.map((c) => [c.id, c.prog, c.done]));
check("the client's result counts what the host saw them do (distance driven, Bucks spent)", res && chal && chal[0][1] > 5 && chal[1][1] === 100 && chal[2][1] === 1, JSON.stringify(chal));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online milestone-4 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
