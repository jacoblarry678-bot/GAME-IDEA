/**
 * Online browser test: starts the dedicated server in-process (serving dist/),
 * opens two browser players, connects both through the Online screen and
 * checks: both in the same server match, bots tagged, remote player visible
 * and moving, prediction agrees with the server, a server-side elimination
 * reaches both clients (kill feed, death screen), respawn, leaving returns
 * the slot to a bot, and losing the server returns to the menu.
 *
 * SwiftShader renders at 1–3 FPS, so after joining, rendering is paused and
 * each client's game loop is driven in real time (60 Hz) with injected input.
 * Usage: npm run build && node tools/online.mjs [outDir]
 */
import { chromium } from 'playwright';
import { startServer } from '../server/server.mjs';

const out = process.argv[2] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const srv = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'tdm' }], bots: 3, time: 10 });
const base = `http://localhost:${srv.port}/`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

async function player(name) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message} ${(e.stack || '').split('\n')[1]}`));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`); });
  await p.addInitScript(([n]) => {
    if (sessionStorage.getItem('init')) return;
    sessionStorage.setItem('init', '1');
    localStorage.clear();
    localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } }));
    localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, name: n }));
  }, [name]);
  await p.goto(base, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
  return p;
}

const A = await player('Alpha');
const B = await player('Bravo');
check('the server serves the game page', true, base);

// connect A through the UI
await A.click('.menu-btn[data-go=online]');
await A.waitForTimeout(400);
const addr = await A.evaluate(() => document.querySelector('.srv-in').value);
check('Online screen suggests this server’s WebSocket address', addr === `ws://localhost:${srv.port}/ws`, addr);
await A.screenshot({ path: `${out}/online-00-screen.png` });
await A.click('[data-a=connect]');
await A.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 });
await B.click('.menu-btn[data-go=online]');
await B.waitForTimeout(300);
await B.click('[data-a=connect]');
await B.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 });
check('both players connect and enter the match', true);

// stop the render loop; drive the games ourselves
for (const p of [A, B]) await p.evaluate(() => { const a = window.__ashline; a.engine.shouldRender = () => false; a.input.enabled = true; a.input.lastLockFail = performance.now(); });
const drive = (p, secs, setup = '') => p.evaluate(async ([secs, setup]) => {
  const a = window.__ashline, g = a.game;
  if (setup) new Function('a', 'g', setup)(a, g);
  const t0 = performance.now();
  let last = t0;
  while (performance.now() - t0 < secs * 1000) {
    await new Promise((r) => setTimeout(r, 16));
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    a.input.poll();
    a.game.update(dt);
  }
}, [secs, setup]);
const both = (secs) => Promise.all([drive(A, secs), drive(B, secs)]);

await both(1.5);
const rosterA = await A.evaluate(() => { const m = window.__ashline.game.match; return m.combatants.map((c) => ({ n: c.name, bot: c.isBot, team: c.team, me: c === m.player, dn: c.displayName })); });
const bravo = rosterA.find((r) => r.n === 'Bravo');
check('A sees Bravo as a human on the other team; bots are tagged [BOT]', bravo && !bravo.bot && bravo.team !== rosterA.find((r) => r.me).team && rosterA.filter((r) => r.bot).every((r) => r.dn.startsWith('[BOT]')) && !bravo.dn.startsWith('[BOT]'), JSON.stringify(rosterA));

// wait out the countdown
await both(5.5);
const st = await A.evaluate(() => window.__ashline.game.match.state);
check('match state comes from the server (live after countdown)', st === 'live', st);
await A.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'freezeBots' }));

// movement: A walks forward; prediction vs server and B's view of A
await A.evaluate(() => { const a = window.__ashline; a.online.client.send({ t: 'dbg', op: 'revive' }); a.online.client.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 }); });
await both(0.6);
await A.evaluate(() => { const g = window.__ashline.game; g.look.yaw = -Math.PI / 2; g.look.pitch = 0; });
const ax0 = await A.evaluate(() => window.__ashline.game.player.x);
await Promise.all([drive(A, 1.5, "a.input.down.add('KeyW')"), drive(B, 1.5)]);
await A.evaluate(() => window.__ashline.input.down.delete('KeyW'));
await both(0.6);
const aPos = await A.evaluate(() => { const p = window.__ashline.game.player; return { x: p.x, z: p.z, id: p.id }; });
const bSeesA = await B.evaluate((id) => { const c = window.__ashline.game.match.find(id); return { x: c.x, z: c.z }; }, aPos.id);
const srvA = srv.room.match.combatants.find((c) => c.id === aPos.id);
check('A moves from its own input (local prediction)', aPos.x - ax0 > 4, `${(aPos.x - ax0).toFixed(2)} m`);
check('prediction agrees with the server (< 0.3 m)', Math.hypot(aPos.x - srvA.x, aPos.z - srvA.z) < 0.3, `client ${aPos.x.toFixed(2)} vs server ${srvA.x.toFixed(2)}`);
check('B sees A at the same place (interpolated, < 0.5 m)', Math.hypot(bSeesA.x - srvA.x, bSeesA.z - srvA.z) < 0.5, `B sees ${bSeesA.x.toFixed(2)}`);

// render one frame on each for screenshots
const shot = async (p, file) => { await p.evaluate(() => { const a = window.__ashline; a.engine.render(true); }); await p.screenshot({ path: `${out}/${file}` }); };
await A.evaluate(() => { const a = window.__ashline; a.online.client.send({ t: 'dbg', op: 'revive' }); a.online.client.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 }); a.online.client.send({ t: 'dbg', op: 'health', v: 100 }); });
await B.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'revive' }));
const bid = await B.evaluate(() => window.__ashline.game.player.id);
await B.evaluate(() => { const a = window.__ashline; a.online.client.send({ t: 'dbg', op: 'place', x: 24, z: -1.5, yaw: Math.PI / 2 }); a.online.client.send({ t: 'dbg', op: 'health', v: 100 }); });
await both(0.8);
await A.evaluate(() => { const g = window.__ashline.game; g.look.yaw = -Math.PI / 2; g.look.pitch = -0.02; });
await B.evaluate(() => { const g = window.__ashline.game; g.look.yaw = Math.PI / 2; g.look.pitch = 0; });
await both(0.3);
await shot(A, 'online-01-A-sees-B.png');
await shot(B, 'online-02-B-sees-A.png');

// A fires until B is down
await Promise.all([drive(A, 4, "a.input.down.add('Mouse0'); a.input.down.add('Mouse2'); g.look.yaw = -Math.PI / 2; g.look.pitch = -0.02;"), drive(B, 4)]);
await A.evaluate(() => { const i = window.__ashline.input; i.down.delete('Mouse0'); i.down.delete('Mouse2'); });
await both(0.5);
const bState = await B.evaluate(() => { const g = window.__ashline.game; return { alive: g.player.alive, death: document.querySelector('#hud .death')?.textContent || '', kf: document.querySelector('#hud .killfeed')?.textContent || '' }; });
const aState = await A.evaluate(() => { const g = window.__ashline.game; return { kills: g.player.stats.kills, kf: document.querySelector('#hud .killfeed')?.textContent || '' }; });
check('server-side elimination: B is down on B’s screen with a death screen', !bState.alive && /Alpha/.test(bState.death + bState.kf), JSON.stringify(bState).slice(0, 200));
check('A’s scoreboard and kill feed show the elimination', aState.kills >= 1 && /Bravo/.test(aState.kf), JSON.stringify(aState));
await shot(B, 'online-03-B-dead.png');
check('server agrees: B is dead there too', !srv.room.match.combatants.find((c) => c.id === bid).alive);

// respawn
await Promise.all([drive(A, 4.5), drive(B, 4.5, "a.input.down.add('Space')")]);
await B.evaluate(() => window.__ashline.input.down.delete('Space'));
await both(0.5);
const bAlive = await B.evaluate(() => window.__ashline.game.player.alive);
check('B respawns after asking the server', bAlive && srv.room.match.combatants.find((c) => c.id === bid).alive);

// B leaves → bot takes the slot (seen by A)
await B.evaluate(() => window.__ashline.leaveMatch());
await drive(A, 1.0);
const after = await A.evaluate(() => window.__ashline.game.match.combatants.map((c) => c.name + (c.isBot ? ':bot' : '')));
check('when B leaves, A sees a bot take the slot', !after.includes('Bravo') && after.length === 6, after.join(', '));
check('B is back at the main menu', await B.evaluate(() => window.__ashline.state === 'menu'));

// server goes away → A returns to the menu with a notice
srv.close();
for (const c of srv.room.clients) c.transport.close();
await A.evaluate(() => { window.__ashline.engine.shouldRender = () => true; });
await A.waitForFunction(() => window.__ashline.state === 'menu', null, { timeout: 20000 }).catch(() => {});
const toast = await A.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'));
check('losing the server returns to the menu with a notice', (await A.evaluate(() => window.__ashline.state)) === 'menu' && /Disconnected/.test(toast), toast);

// ---- part 2: match end → results → server rotates to the next map
const srv2 = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'tdm' }, { map: 'old_quarter', mode: 'dom' }], bots: 2, time: 0.2, resultsPause: 6 });
await A.evaluate(() => { document.querySelector('.toast')?.remove(); });
await A.click('.menu-btn[data-go=online]');
await A.waitForTimeout(300);
await A.fill('.srv-in', `localhost:${srv2.port}`);
await A.click('[data-a=connect]');
await A.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 });
await A.evaluate(() => { window.__ashline.engine.shouldRender = () => false; });
// drive until the server ends the match and the results screen shows
await A.evaluate(async () => {
  const a = window.__ashline;
  let last = performance.now();
  for (let i = 0; i < 2400 && a.state !== 'results'; i++) {
    await new Promise((r) => setTimeout(r, 16));
    const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    a.input.poll(); a.game?.update(dt);
  }
});
const res = await A.evaluate(() => ({ state: window.__ashline.state, txt: document.querySelector('[data-screen=results]')?.textContent || '' }));
check('online match ends on the server and shows results (next match automatic)', res.state === 'results' && /next match starts automatically/i.test(res.txt), res.state);
await A.evaluate(() => { window.__ashline.engine.shouldRender = () => true; });
await A.screenshot({ path: `${out}/online-04-results.png` });
await A.waitForFunction(() => window.__ashline.state === 'match-live' && window.__ashline.game?.map.def.id === 'old_quarter', null, { timeout: 120000 }).catch(() => {});
const nx = await A.evaluate(() => ({ state: window.__ashline.state, map: window.__ashline.game?.map.def.id, mode: window.__ashline.game?.match.mode.id }));
check('the server rotates to the next map/mode and the client follows', nx.state === 'match-live' && nx.map === 'old_quarter' && nx.mode === 'dom', JSON.stringify(nx));
await A.evaluate(() => window.__ashline.toMenu());
srv2.close();

// ---- part 3: 75 ms each way (150 ms round trip)
const srv3 = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'tdm' }], bots: 2, time: 10, lagMs: 75, lagComp: process.env.LAGCOMP !== '0' });
for (const p of [A, B]) {
  await p.evaluate(() => { window.__ashline.engine.shouldRender = () => true; document.querySelectorAll('.toast').forEach((t) => t.remove()); });
  if (await p.evaluate(() => window.__ashline.state) !== 'menu') await p.evaluate(() => window.__ashline.toMenu());
  await p.click('.menu-btn[data-go=online]');
  await p.waitForTimeout(300);
  await p.fill('.srv-in', `localhost:${srv3.port}`);
  await p.click('[data-a=connect]');
  await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 });
  await p.evaluate(() => { window.__ashline.engine.shouldRender = () => false; window.__ashline.input.enabled = true; });
}
await both(6.5); // countdown
await A.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'freezeBots' }));
const rtt = await A.evaluate(() => window.__ashline.online.client.rtt);
check('simulated latency is in effect', rtt > 0.12, `rtt ${(rtt * 1000).toFixed(0)} ms`);
await A.evaluate(() => { const c = window.__ashline.online.client; c.send({ t: 'dbg', op: 'revive' }); c.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 }); });
await B.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'revive' }));
await both(0.8);
await A.evaluate(() => { const g = window.__ashline.game; g.look.yaw = -Math.PI / 2; g.look.pitch = 0; });
const lx0 = await A.evaluate(() => window.__ashline.game.player.x);
await Promise.all([drive(A, 0.4), drive(B, 0.4)]);
const lx1 = await A.evaluate(() => window.__ashline.game.player.x);
await Promise.all([drive(A, 1.2, "a.input.down.add('KeyW')"), drive(B, 1.2)]);
const lagMove = await A.evaluate(() => window.__ashline.game.player.x);
await A.evaluate(() => window.__ashline.input.down.delete('KeyW'));
check('with 150 ms RTT the player still moves immediately (prediction)', lagMove - lx1 > 4.5 && Math.abs(lx1 - lx0) < 0.1, `${(lagMove - lx1).toFixed(2)} m in 1.2 s`);
await both(1.0);
const pa = await A.evaluate(() => { const p = window.__ashline.game.player; return { x: p.x, z: p.z, id: p.id }; });
const sa = srv3.room.match.combatants.find((c) => c.id === pa.id);
check('after stopping, prediction and server agree (< 0.3 m)', Math.hypot(pa.x - sa.x, pa.z - sa.z) < 0.3, `client ${pa.x.toFixed(2)} vs server ${sa.x.toFixed(2)}`);
// B strafes; A tracks what it sees and fires
const bid3 = await B.evaluate(() => window.__ashline.game.player.id);
await A.evaluate(() => window.__ashline.online.client.send({ t: 'dbg', op: 'place', x: 6, z: -1.5, yaw: -Math.PI / 2 }));
await B.evaluate(() => { window.__ashline.online.client.send({ t: 'dbg', op: 'place', x: 20, z: -1.5, yaw: Math.PI / 2 }); window.__ashline.online.client.send({ t: 'dbg', op: 'health', v: 100 }); });
await both(0.8);
const dmgBefore = srv3.room.match.combatants.find((c) => c.id === pa.id).stats.damage;
const srvLog = [];
let killT = Infinity;
srv3.room.match.on((e) => { if (e.type === 'kill' && e.victim.id === bid3 && killT === Infinity) killT = srv3.room.match.time; });
{
  const room = srv3.room, orig = room.rewind.bind(room);
  room.rewind = (sh) => { const r = orig(sh); const t = room.match.combatants.find((c) => c.id === bid3); srvLog.push({ now: room.match.time, vt: sh.netViewT, bx: t.x, bz: t.z }); return r; };
  if (process.env.LAGDBG) await A.evaluate(() => { const g = window.__ashline.game; g._log = []; g.match.on((e) => { if (e.type === 'shot' && e.c === g.player) { const t = g.match.combatants.find((c) => c !== g.player && !c.isBot); g._log.push({ st: g.match.net.serverNow(), vt: g.match.net.serverNow() - 0.1, bx: t.x, bz: t.z }); } }); });
}
const track = `
  const m = g.match, me = m.player, t = m.find(${bid3});
  a.input.down.add('Mouse2');
  g._track = setInterval(() => { if (!t) return; const dx = t.x - me.x, dz = t.z - me.z, dy = (t.y + 1.25) - me.eyeY; g.look.yaw = Math.atan2(-dx, -dz); g.look.pitch = Math.atan2(dy, Math.hypot(dx, dz)); g._n = (g._n || 0) + 1; if (me.adsT > 0.9 && g._n % 36 < 2) a.input.down.add('Mouse0'); else a.input.down.delete('Mouse0'); }, 8);
`;
const strafe = "let k = 0; g._st = setInterval(() => { k++; a.input.down.delete(k % 2 ? 'KeyA' : 'KeyD'); a.input.down.add(k % 2 ? 'KeyD' : 'KeyA'); }, 700); a.input.down.add('KeyA');";
await Promise.all([drive(A, 4, track), drive(B, 4, strafe)]);
await A.evaluate(() => { const a = window.__ashline; clearInterval(a.game._track); a.input.down.clear(); });
await B.evaluate(() => { const a = window.__ashline; clearInterval(a.game._st); a.input.down.clear(); });
if (process.env.LAGDBG) { const cl = await A.evaluate(() => window.__ashline.game._log); console.log('client', JSON.stringify(cl.map((c) => [c.vt.toFixed(3), c.bx.toFixed(2), c.bz.toFixed(2)]))); console.log('server', JSON.stringify(srvLog.map((c) => [c.now.toFixed(3), c.vt.toFixed(3), c.bx.toFixed(2), c.bz.toFixed(2)]))); }
const shooter = srv3.room.match.combatants.find((c) => c.id === pa.id);
const dealt = shooter.stats.damage - dmgBefore;
const shotsAlive = srvLog.filter((r) => r.now <= killT).length;
const hitsAlive = Math.round(dealt / 30);
check('lag compensation: tapping at a strafing player at 150 ms RTT lands most shots and eliminates them', killT < Infinity && hitsAlive / Math.max(1, shotsAlive) >= 0.6, `${killT < Infinity ? 'eliminated' : 'survived'} · ~${hitsAlive} hits from ${shotsAlive} shots fired while the target was alive`);
for (const p of [A, B]) await p.evaluate(() => window.__ashline.toMenu());
srv3.close();

check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
