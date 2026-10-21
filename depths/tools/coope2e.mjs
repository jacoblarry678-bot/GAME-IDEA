/**
 * Browser co-op check: the real server, a host page and a guest page.
 * Run: npm run build && node tools/coope2e.mjs
 */
import { launch } from './shot.mjs';
import { startServer } from '../server/server.mjs';
const OUT = new URL('./shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok', m); } else { fail++; console.log('  FAIL', m); } };
const srv = await startServer({ port: 0, quiet: true });
const base = `http://localhost:${srv.port}/?lowgfx`;
const { browser, page: host, errors } = await launch();
const guest = await browser.newPage({ viewport: { width: 1280, height: 720 } });
guest.on('pageerror', (e) => errors.push(`guest pageerror: ${e.message}`));
guest.on('console', (m) => { if (m.type() === 'error') errors.push(`guest: ${m.text()}`); });
const H = (fn, a) => host.evaluate(fn, a), G = (fn, a) => guest.evaluate(fn, a);
await host.goto(base); await guest.goto(base);
await host.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 240000 });
await guest.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 240000 });
await host.waitForFunction(() => window.__depths.netAvailable, null, { timeout: 30000 });
ok(await host.locator('button:has-text("Join Game"):not([disabled])').count() > 0, 'Join Game is offered when the server is present');
await H(() => window.__depths.startCampaign({ slot: 2, mode: 'host', difficulty: 'standard', noDamage: false, timer: false, reducedStartle: false }));
await host.waitForFunction(() => window.__depths.net && window.__depths.net.code, null, { timeout: 60000 });
const code = await H(() => window.__depths.net.code);
ok(/^[A-Z0-9]{6}$/.test(code), `host shows invite code ${code}`);
await G((code) => window.__depths.joinGame(code, 'Mara', 'mara'), code);
await guest.waitForFunction(() => window.__depths.state === 'game' && window.__depths.levelView && window.__depths.pid !== 'p1', null, { timeout: 180000 });
const gpid = await G(() => window.__depths.pid);
ok(!!gpid, `guest entered the game as ${gpid}`);
await host.waitForFunction((pid) => { const p = window.__depths.game.players.get(pid); return p && !p.spectating; }, gpid, { timeout: 120000 });
ok(true, 'guest spawned on the host');
ok(await G(() => window.__depths.game.players.size) === 2, 'guest mirror lists both crew members');
// the host walks; the guest sees the teammate body
await H(() => { const g = window.__depths.game; const p = g.players.get('p1'); p.z += 1.5; });
await guest.waitForFunction(() => { const a = window.__depths; return a.creatures.mateModels && a.creatures.mateModels.size === 1; }, null, { timeout: 120000 });
ok(true, 'guest renders the host as a teammate');
await guest.screenshot({ path: `${OUT}coop-guest.png` });
await host.screenshot({ path: `${OUT}coop-host.png` });
// guest interaction runs on the host: open the gate wheel
await H((pid) => { const g = window.__depths.game, it = g.level.interById.get('gateWheel'), p = g.players.get(pid); p.x = it.x; p.z = it.z - 1; }, gpid);
let opened = false;
for (let attempt = 0; attempt < 6 && !opened; attempt++) {
  await guest.waitForTimeout(2500);
  await G(() => { const a = window.__depths, g = a.game; g.setInput(a.pid, { yaw: 0, pitch: 0 }); g.beginInteract(a.pid, 'gateWheel'); });
  try { await host.waitForFunction(() => window.__depths.game.story.has('ch1.gate'), null, { timeout: 20000 }); opened = true; } catch {
    console.log('  (retry)', await H((pid) => { const g = window.__depths.game, it = g.level.interById.get('gateWheel'), p = g.players.get(pid); return JSON.stringify({ d: Math.hypot(it.x - p.x, it.z - p.z).toFixed(2), sp: p.spectating, st: p.stalled }); }, gpid));
  }
}
ok(opened, 'guest interaction reached the host');
ok(true, 'guest opened the gate through the host');
await guest.waitForFunction(() => window.__depths.game.story.has('ch1.gate'), null, { timeout: 60000 });
ok(true, 'the flag came back to the guest');
// host leaves: guest returns to the menu with a notice
await H(() => window.__depths.quitToMenu());
await guest.waitForFunction(() => window.__depths.state === 'menu', null, { timeout: 120000 });
ok(await guest.locator('text=The host ended the session').count() > 0, 'guest told the host ended the session');
ok(errors.length === 0, `consoles free of errors (${errors.length})`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
