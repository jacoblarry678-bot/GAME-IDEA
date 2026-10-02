// Online multiplayer test: two separate browsers (host + client) through the
// relay server. Needs `npm run island:server` and the dev server (or open the
// server's own address). Usage: node tools/island-online.mjs [url] [shotDir]
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
  while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(200); }
  return false;
};

const H = await open('host');
const C = await open('client');
await H.fill('input[data-set=name]', 'Hostie');
await H.click('[data-act=bots][data-id="29"]'); // biggest match: 30 players
await H.click('[data-act=queue][data-id=ranked]'); // a ranked online match
await C.fill('input[data-set=name]', 'Guesty');
await C.click('[data-act=chars]');
await C.click('[data-act=pick][data-id=emerson]');
await C.click('[data-act=main]');

await H.click('[data-act=online]');
check('host connects to online play (relay server)', await waitFor(H, () => !!document.querySelector('[data-act=host]')), await H.evaluate(() => __bi.online.kind));
await H.click('[data-act=host]');
await waitFor(H, () => !!document.querySelector('.code'));
const code = (await H.textContent('.code')).trim().toLowerCase();
check('hosting shows a 5-character game code', /^[a-z0-9]{5}$/.test(code), code);

await C.click('[data-act=online]');
const listed = await waitFor(C, (c) => !!document.querySelector(`[data-act=join][data-code="${c}"]`), 15000, code);
check("the host's game appears in the client's open games list", listed);
await C.click(`[data-act=join][data-code="${code}"]`);
const roster = await waitFor(H, () => document.querySelectorAll('.player-row').length === 2, 15000);
const names = await H.evaluate(() => [...document.querySelectorAll('.player-row b')].map((e) => e.textContent.replace(/^\S*\s/, '').trim()));
check('client joins; both players are in the room roster', roster && names.includes('Hostie') && names.includes('Guesty'), JSON.stringify(names));

await H.click('[data-act=start-online]');
const started = await waitFor(C, () => __bi.game.role === 'client' && !!__bi.game.world, 15000);
const setup = await C.evaluate(() => { const g = __bi.game; return { role: g.role, me: g.player.id, name: g.player.name, char: g.player.charId, actors: g.actors.length, host: g.actors[0].name, bots: g.actors.filter((a) => a.isBot).length }; });
const hsetup = await H.evaluate(() => { const g = __bi.game; return { role: g.role, actors: g.actors.length, remote: g.actors[1].remote ? 'yes' : 'no', name: g.actors[1].name, char: g.actors[1].charId, bot5: g.actors[5].name }; });
const cBot5 = await C.evaluate(() => __bi.game.actors[5].name);
check('host starts: client joins the same match (same roster, same bots)', started && setup.role === 'client' && setup.me === 1 && setup.char === 'emerson' && setup.actors === hsetup.actors && hsetup.remote === 'yes' && hsetup.name === 'Guesty' && cBot5 === hsetup.bot5, JSON.stringify({ setup, hsetup, cBot5 }));

// both jump; speed both up while falling
await waitFor(C, () => __bi.game.busT > 1.8, 20000);
await C.keyboard.press('Space');
await H.keyboard.press('Space');
const jumped = await waitFor(H, () => __bi.game.actors[1].state !== 'bus', 8000);
check('client presses SPACE: the host sees them leave the bus', jumped, await H.evaluate(() => __bi.game.actors[1].state));
await H.evaluate(() => (__bi.engine.timeScale = 3));
await C.evaluate(() => (__bi.engine.timeScale = 3));
const landed = await waitFor(C, () => ['ground', 'swim'].includes(__bi.game.player.state), 60000);
await H.evaluate(() => (__bi.engine.timeScale = 1));
await C.evaluate(() => (__bi.engine.timeScale = 1));
await H.waitForTimeout(1500);
const posC = await C.evaluate(() => __bi.game.player.pos.toArray());
const posH = await H.evaluate(() => __bi.game.actors[1].pos.toArray());
const drift = Math.hypot(posC[0] - posH[0], posC[2] - posH[2]);
const pres = await H.evaluate(() => { const s = __bi.session; const me = s.room.peers().find((p) => p.sameTab); return new TextEncoder().encode(JSON.stringify(me.presence)).length; });
check('host presence (snapshot of 30 players + private state) stays under the 4 KiB room limit', pres < 4096, `${pres} bytes`);
check("client lands; the host's copy of them matches their position", landed && drift < 2.5, `drift=${drift.toFixed(2)}m`);

// isolate: freeze bots on the host and put both humans on open ground
await H.evaluate(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; }
  let fx = 0, fz = 0;
  search: for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2) continue;
    let ok = true;
    for (const [dx, dz] of [[-10, -12], [10, -12], [-10, 6], [10, 6], [0, 0]]) if (Math.abs(g.world.height(x + dx, z + dz) - h) > 0.8) ok = false;
    if (!ok || g.world.physics.query(x - 11, z - 13, x + 11, z + 7).length) continue;
    fx = x; fz = z; break search;
  }
  window.F = { x: fx, z: fz };
  for (const a of g.actors) if (a.brain) { a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  const P = g.player;
  P.pos.set(fx - 5, g.world.height(fx - 5, fz), fz); P.state = 'ground';
  // move the client with a host teleport (epoch bump), exactly like a reboot does
  const c = g.actors[1];
  c.pos.set(fx, g.world.height(fx, fz), fz); c.state = 'ground'; c.ep++;
  const bot = g.actors[4];
  bot.alive = true;
  bot.pos.set(fx, g.world.height(fx, fz - 9), fz - 9); bot.state = 'ground'; bot.hp = 100; bot.shield = 0; bot.overshield = 0;
  c.slots = [{ kind: 'weapon', id: 'ar', rarity: 2, mag: 30 }, null, null, null, null];
  c.ammo.medium = 90;
  c.mats.wood = 100;
});
const target = await H.evaluate(() => window.F);
const tp = await waitFor(C, (f) => { const P = __bi.game.player; return Math.hypot(P.pos.x - f.x, P.pos.z - f.z) < 1 && P.state === 'ground'; }, 8000, target);
const inv = await waitFor(C, () => __bi.game.player.slots[0]?.id === 'ar' && __bi.game.player.ammo.medium === 90, 5000);
check('host teleports the client (reboot-style) and syncs their inventory', tp && inv, JSON.stringify({ tp, inv, c: await C.evaluate(() => [__bi.game.player.ep, __bi.game.player.state, __bi.game.player.pos.toArray().map(Math.round), __bi.game.player.alive]), h: await H.evaluate(() => [__bi.game.actors[1].ep, __bi.game.actors[1].state, __bi.game.actors[1].pos.toArray().map(Math.round)]) }));

// client walks forward with W for 1s: the host sees the movement
const z0 = await H.evaluate(() => __bi.game.actors[1].pos.z);
await C.keyboard.down('KeyD');
await C.waitForTimeout(2000);
await C.keyboard.up('KeyD');
await C.waitForTimeout(800);
const moved = await H.evaluate((z) => { const a = __bi.game.actors[1]; return { dx: +(a.pos.x - window.F.x).toFixed(2), dz: +(a.pos.z - z).toFixed(2) }; }, z0);
check('client movement (client-simulated) shows up on the host', Math.abs(moved.dx) > 1.0, JSON.stringify(moved));

// client shoots the bot
await C.evaluate(() => {
  const g = __bi.game, P = g.player, bot = g.actors[4];
  P.pos.x = bot.pos.x; // line up
  g.actions.select(0);
  g.controller.yaw = 0;
  g.controller.pitch = Math.atan2(bot.pos.y + 1.0 - (P.pos.y + 1.55), P.pos.z - bot.pos.z);
});
await C.waitForTimeout(700);
await C.mouse.move(480, 270);
await C.mouse.down();
await C.waitForTimeout(2500);
await C.mouse.up();
await C.waitForTimeout(800);
const shotH = await H.evaluate(() => { const b = __bi.game.actors[4]; return { hp: b.hp, alive: b.alive, mag: __bi.game.actors[1].slots[0]?.mag, dmg: __bi.game.actors[1].damageDealt }; });
const shotC = await C.evaluate(() => ({ dmgNums: document.querySelectorAll('.dmg').length, mag: __bi.game.player.slots[0]?.mag }));
await C.screenshot({ path: `${shots}/on-01-client-shooting.png` });
check("client's shots are simulated by the host and damage the bot", shotH.dmg > 0 && shotH.mag < 30, JSON.stringify({ shotH, shotC }));

// client builds a wall
await C.evaluate(() => { __bi.game.controller.pitch = -0.1; });
await C.keyboard.press('KeyB');
await C.waitForTimeout(300);
await C.keyboard.press('Digit1');
await C.waitForTimeout(200);
await C.mouse.click(480, 270);
const builtH = await waitFor(H, () => [...__bi.game.building.pieces].some((p) => p.owner === __bi.game.actors[1]), 5000);
const builtC = await waitFor(C, () => __bi.game.building.pieces.size > 0 && __bi.game.player.mats.wood === 90, 5000);
check('client builds: the piece exists on the host and appears for the client (materials charged)', builtH && builtC, JSON.stringify({ c: await C.evaluate(() => [__bi.game.player.ep, __bi.game.player.pos.toArray().map(Math.round)]), h: await H.evaluate(() => [__bi.game.actors[1].ep, __bi.game.actors[1].pos.toArray().map(Math.round)]) }));
await C.keyboard.press('KeyB');

// host drops a weapon next to the client; client picks it up with E
const nid = await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1];
  return g.loot.drop({ kind: 'weapon', id: 'shotgun', rarity: 3, mag: 5 }, c.pos.clone().add({ x: 0.8, y: 0.3, z: 0, isVector3: true }), null, true).nid;
});
const seen = await waitFor(C, (n) => __bi.game.loot.pickups.some((k) => k.nid === n), 5000, nid);
await C.waitForTimeout(300);
const prompt = await C.evaluate(() => ({ prompt: __bi.game.controller.prompt, st: __bi.game.player.state, canAct: __bi.game.player.canAct(), d: Math.min(...__bi.game.loot.pickups.filter((k) => k.it.id === 'shotgun' && k.it.rarity === 3).map((k) => k.pos.distanceTo(__bi.game.player.pos))) }));
await C.keyboard.press('KeyE');
const took = await waitFor(H, () => __bi.game.actors[1].slots.some((s) => s && s.id === 'shotgun'), 5000);
const gone = await waitFor(C, (n) => !__bi.game.loot.pickups.some((k) => k.nid === n) && __bi.game.player.slots.some((s) => s && s.id === 'shotgun'), 5000, nid);
check('host-spawned loot appears for the client; E picks it up (host inventory + client HUD update)', seen && took && gone, JSON.stringify({ seen, took, gone, prompt, c: await C.evaluate(() => [__bi.game.player.ep, __bi.game.player.pos.toArray().map(Math.round), __bi.game.player.state]), h: await H.evaluate(() => [__bi.game.actors[1].ep, __bi.game.actors[1].pos.toArray().map(Math.round), __bi.game.actors[1].state]) }));

// host-side damage reaches the client HUD
await H.evaluate(() => { const g = __bi.game; g.applyDamage(g.actors[1], 30, g.actors[4], {}); });
const hurt = await waitFor(C, () => __bi.game.player.hp + __bi.game.player.shield < 200 && __bi.game.player.hp <= 100, 4000);
check('damage from the host simulation shows on the client', hurt, JSON.stringify(await C.evaluate(() => ({ hp: __bi.game.player.hp, sh: __bi.game.player.shield }))));

// client eliminated → result on the client
await H.evaluate(() => { const g = __bi.game; g.applyDamage(g.actors[1], 999, g.actors[4], {}); });
const out = await waitFor(C, () => !__bi.game.player.alive && __bi.game.controller.spectating && !!__bi.game.result, 6000);
const cres = await C.evaluate(() => ({ res: __bi.game.result, screen: !!document.querySelector('.result') }));
check('client elimination: spectating + their own result screen (placement from the host)', out && cres.screen && cres.res.place > 1, JSON.stringify(cres.res));
check('ranked online: the client gets its own rank/MMR update from its result', cres.res.ranked && cres.res.ranked.after.mmr !== undefined && (await C.evaluate(() => __bi.game.ranked && __bi.ranked.rankState('build').matches === 1)), JSON.stringify(cres.res.ranked));
await C.screenshot({ path: `${shots}/on-02-client-result.png` });

// host wins → match over for both
await H.evaluate(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) g.eliminate(a, g.player, {}); });
const hwin = await waitFor(H, () => __bi.game.state === 'over' && __bi.game.result?.won, 5000);
const cover = await waitFor(C, () => __bi.game.state === 'over', 5000);
check('host wins: host victory, client sees the match end', hwin && cover);
check('ranked online: the host rank updates too (lobby rated at the players\' average MMR)', await H.evaluate(() => !!__bi.game.result.ranked && __bi.game.lobbyRating === 1000 && __bi.ranked.rankState('build').matches === 1));

// play again: host back to the room and starts a second match; client follows
await H.waitForTimeout(1000);
await H.click('[data-act=again]');
await waitFor(H, () => !!document.querySelector('[data-act=start-online]'), 5000);
// the client is brought back to the game room automatically when the host returns
const back = await waitFor(C, () => document.querySelectorAll('.player-row').length === 2 && !__bi.game.world, 8000);
check('host returns to the room: the client follows automatically', back);
const mid1 = await C.evaluate(() => __bi.session.lastMid);
await H.click('[data-act=start-online]');
const again = await waitFor(C, (m) => __bi.session.lastMid !== m && __bi.game.role === 'client' && __bi.game.state === 'bus', 15000, mid1);
check('Play again: host starts a new match and the client is pulled in', again);

// client disconnects mid-match → a bot takes over on the host
await C.close();
const takeover = await waitFor(H, () => __bi.game.actors[1].isBot && !!__bi.game.actors[1].brain && /left/.test(__bi.game.actors[1].name), 20000);
check('client disconnects mid-match: a labelled bot takes over their character', takeover, await H.evaluate(() => __bi.game.actors[1].name));
await H.screenshot({ path: `${shots}/on-03-host.png` });

check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
