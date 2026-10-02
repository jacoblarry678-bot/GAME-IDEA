// Online co-op: a desktop host and a PHONE client (touch controls) play Duos
// on the same squad and revive each other across the network.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const errors = [];
const H = await (await b.newContext({ viewport: { width: 900, height: 500 } })).newPage();
const cctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const C = await cctx.newPage();
for (const [n, p] of [['host', H], ['phone', C]]) {
  p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
  await p.goto(url, { waitUntil: 'load' });
}
await H.waitForTimeout(1200);
await H.evaluate(() => (__bi.input.lockBlocked = true));
const cdp = await cctx.newCDPSession(C);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const center = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const waitFor = async (p, fn, ms = 20000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(200); } return false; };

await H.fill('input[data-set=name]', 'Parent');
await H.click('[data-act=team][data-id="2"]');
await H.click('[data-act=online]');
await H.waitForSelector('[data-act=host]');
await H.click('[data-act=host]');
await H.waitForSelector('.code');
const code = (await H.textContent('.code')).trim().toLowerCase();
await C.tap('[data-act=online]');
await C.waitForSelector('#join-code');
await C.fill('#join-code', code);
await C.tap('.row.left [data-act=join]');
check('phone joins the Duos game with the code', await waitFor(H, () => document.querySelectorAll('.player-row').length === 2));
await H.click('[data-act=start-online]');
check('both are in the match on the same squad', await waitFor(C, () => __bi.game.role === 'client' && __bi.game.player.team === 0 && __bi.game.actors[0].team === 0 && document.body.classList.contains('touch')));
await waitFor(C, () => __bi.game.busT > 1.8);
const jump = await center(C, '.t-jump');
await touch('touchStart', [[jump[0], jump[1], 1]]);
await C.waitForTimeout(100);
await touch('touchEnd', []);
check('phone taps JUMP: host sees them skydiving', await waitFor(H, () => __bi.game.actors[1].state !== 'bus', 6000));
await H.evaluate(() => { const g = __bi.game; g.jumpFromBus(g.player); });
await H.evaluate(() => (__bi.engine.timeScale = 3));
await C.evaluate(() => (__bi.engine.timeScale = 3));
await waitFor(C, () => ['ground', 'swim'].includes(__bi.game.player.state), 60000);
await H.evaluate(() => (__bi.engine.timeScale = 1));
await C.evaluate(() => (__bi.engine.timeScale = 1));

// meet up on open ground (host teleports both), freeze bots
await H.evaluate(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  let fx = 0, fz = 0;
  search: for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2 || g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) continue;
    fx = x; fz = z; break search;
  }
  const P = g.player, c = g.actors[1];
  P.pos.set(fx, g.world.height(fx, fz), fz); P.state = 'ground';
  c.pos.set(fx + 1.2, g.world.height(fx + 1.2, fz), fz); c.state = 'ground'; c.ep++;
});
await waitFor(C, () => __bi.game.player.state === 'ground' && __bi.game.player.pos.distanceTo(__bi.game.actors[0].pos) < 2.2, 8000);

// host gets knocked; phone holds USE to revive
await H.evaluate(() => { const g = __bi.game; g.player.hp = 5; g.player.shield = 0; g.applyDamage(g.player, 50, g.actors.find((a) => a.team === 3), {}); });
const hostDown = await waitFor(C, () => __bi.game.actors[0].downed, 4000);
await C.waitForTimeout(400);
const prompt = await C.evaluate(() => __bi.game.controller.prompt?.text || '');
const use = await center(C, '.t-use');
await touch('touchStart', [[use[0], use[1], 2]]);
const revived = await waitFor(H, () => !__bi.game.player.downed, 45000);
await touch('touchEnd', []);
await C.screenshot({ path: `${shots}/mob-04-coop.png` });
check('phone holds USE next to the knocked host: host is revived over the network', hostDown && /Revive/.test(prompt) && revived, JSON.stringify({ hostDown, prompt, revived, hp: await H.evaluate(() => __bi.game.player.hp) }));

// phone gets knocked; host holds E to revive
await H.evaluate(() => { const g = __bi.game, c = g.actors[1]; c.hp = 5; c.shield = 0; g.applyDamage(c, 50, g.actors.find((a) => a.team === 3), {}); });
const phoneDown = await waitFor(C, () => __bi.game.player.downed && !!document.querySelector('.downed') && getComputedStyle(document.querySelector('.downed')).display !== 'none', 4000);
await H.waitForTimeout(300);
await H.keyboard.down('KeyE');
const back = await waitFor(C, () => !__bi.game.player.downed && __bi.game.player.hp === 30, 45000);
await H.keyboard.up('KeyE');
check('knocked phone player sees the downed screen; host holds E and revives them', phoneDown && back);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online squad checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
