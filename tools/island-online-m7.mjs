// Online checks for milestone 7: a client takes and hands in a story quest,
// edits a ramp and a cone through the host, and watches a bot drive.
// Needs `npm run island:server` and the dev server.
// Usage: node tools/island-online-m7.mjs [url] [shotDir]
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
await H.fill('input[data-set=name]', 'Hostie');
await H.click('[data-act=team][data-id="2"]'); // duos: host and client on one squad
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
const same = await C.evaluate(() => { const g = __bi.game; return g.quests.npcs.map((n) => [Math.round(n.pos.x), Math.round(n.pos.z)]).join(' '); });
const sameH = await H.evaluate(() => { const g = __bi.game; return g.quests.npcs.map((n) => [Math.round(n.pos.x), Math.round(n.pos.z)]).join(' '); });
check('host and client place the three NPCs in the same spots', same === sameH, `${same} | ${sameH}`);

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
  for (const a of g.actors) if (a.brain) { a.brain._upd = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; a.hp = 1e6; }
  window.tp = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.ep++; };
  g.storm.update = () => {};
  // client stands in front of Captain Kay
  const n = g.quests.npcs[1], f = n.mesh.rotation.y;
  tp(g.actors[1], n.pos.x - Math.sin(f) * 2, n.pos.z - Math.cos(f) * 2, n.pos.y + 2);
  tp(g.player, n.pos.x + 20, n.pos.z + 20);
});

// ---- the client takes Captain Kay's quest
const tk = await waitFor(C, () => /Talk to Captain Kay/.test(__bi.game.controller.prompt?.text || ''), 10000);
await key(C, 'KeyE');
const qH = await waitFor(H, () => !!__bi.game.actors[1].quests?.kay, 5000);
const qC = await waitFor(C, () => /Lost Tackle/.test(document.querySelector('.quests')?.textContent || '') && __bi.game.quests.tackle.filter((t) => t.mesh.visible).length === 6, 8000);
await C.screenshot({ path: `${shots}/on7-01-client-quest.png` });
check("the client presses E by Captain Kay: the host starts the quest, the client's tracker and the 6 tackle boxes appear", tk && qH && qC, JSON.stringify({ tk, qH, qC }));

// ---- the client walks over three boxes (the host counts them); the client's view follows
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1];
  window.boxes = g.quests.tackle.slice(0, 3).map((t) => [t.pos.x, t.pos.y, t.pos.z]);
});
for (let i = 0; i < 3; i++) {
  await H.evaluate((i) => { const [x, y, z] = window.boxes[i]; tp(__bi.game.actors[1], x, z, y + 2); }, i);
  await waitFor(H, (i) => __bi.game.actors[1].quests.kay.got.length > i, 6000, i);
}
const got = await H.evaluate(() => ({ got: __bi.game.actors[1].quests.kay.got.length, step: __bi.game.actors[1].quests.kay.step }));
const hid = await waitFor(C, () => __bi.game.quests.tackle.every((t) => !t.mesh.visible) && /Return to Captain Kay/.test(document.querySelector('.quests')?.textContent || ''), 8000);
check('three tackle boxes collected on the host; the client sees the boxes vanish and "Return to Captain Kay"', got.got === 3 && got.step === 1 && hid, JSON.stringify({ got, hid }));

// ---- hand in: bucks and the reward rifle reach the client
await H.evaluate(() => { const g = __bi.game, n = g.quests.npcs[1], f = n.mesh.rotation.y; tp(g.actors[1], n.pos.x - Math.sin(f) * 2, n.pos.z - Math.cos(f) * 2, n.pos.y + 2); window.bk0 = g.actors[1].bucks; });
await waitFor(C, () => /Hand in quest to Captain Kay/.test(__bi.game.controller.prompt?.text || ''), 8000);
const bkC0 = await C.evaluate(() => __bi.game.player.bucks);
await key(C, 'KeyE');
const doneH = await waitFor(H, () => __bi.game.actors[1].quests.kay.done, 5000);
const doneC = await waitFor(C, (b0) => __bi.game.player.bucks === b0 + 200 && /Complete!/.test(document.querySelector('.quests')?.textContent || '') && __bi.game.quests.npcs[1].markSym === '✓' && __bi.game.loot.pickups.some((k) => k.it.kind === 'weapon' && k.it.id === 'ar' && k.it.rarity === 3), 8000, bkC0);
check('the client hands in: +200 Benton Bucks, "Complete!", a ✓ over Captain Kay and an Epic rifle on the ground', doneH && doneC, JSON.stringify({ doneH, doneC }));

// ---- the client edits a ramp and a cone through the host
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1], B = g.building;
  let f = null;
  for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 10, z - 10, x + 10, z + 10).length) f = { x, z }; }
  tp(c, f.x, f.z);
  c.mats.wood = 200;
  window.RK = B.place(c, B.spot(c, 'ramp', 0, 0), 'wood').key;
  tp(c, f.x, f.z + 9);
  window.CK = B.place(c, B.spot(c, 'cone', 0, 0), 'wood').key;
  window.rdir0 = B.occupied.get(RK).dir;
});
const keys = await H.evaluate(() => ({ r: RK, c: CK, d0: rdir0 }));
await waitFor(C, (k) => __bi.game.building.occupied.has(k.r) && __bi.game.building.occupied.has(k.c), 8000, keys);
const want = keys.d0 === 0 ? 2 : 0; // turn it around
const sent = await C.evaluate(({ k, want }) => {
  const B = __bi.game.building;
  const pairs = { 0: [1, 3], 1: [2, 3], 2: [0, 2], 3: [0, 1] };
  const tiles = [true, true, true, true];
  for (const i of pairs[want]) tiles[i] = false;
  const r = __bi.game.actions.edit(B.occupied.get(k.r), tiles);
  const bad = __bi.game.actions.edit(B.occupied.get(k.r), [false, true, true, true]); // not a side: refused locally
  const cone = __bi.game.actions.edit(B.occupied.get(k.c), [true, false, true, false]); // raise the two +x corners
  return { r, bad, cone };
}, { k: keys, want });
const rH = await waitFor(H, (w) => __bi.game.building.occupied.get(RK).dir === w, 5000, want);
const rC = await waitFor(C, ({ k, w }) => __bi.game.building.occupied.get(k.r).dir === w && __bi.game.building.occupied.get(k.r).colliders[0].dir === w, 5000, { k: keys, w: want });
check('the client turns a ramp around (V edit): the host changes it and the client mirror follows', sent.r && sent.bad === false && rH && rC, JSON.stringify({ sent, rH, rC, want }));
const cH = await waitFor(H, () => (__bi.game.building.occupied.get(CK).tiles || []).map(Number).join('') === '1010', 5000);
const cC = await waitFor(C, (k) => { const p = __bi.game.building.occupied.get(k.c); return p && p.colliders[0].raise && p.colliders[0].raise.map(Number).join('') === '0101'; }, 5000, keys);
check('the client raises two cone corners: host and client both have the edited cone', sent.cone && cH && cC, JSON.stringify({ cH, cC }));

// ---- a bot drives; the client sees it happen
await H.evaluate(() => {
  const g = __bi.game, V = g.vehicles;
  const v = V.list.find((x) => x.type === 'truck' && x.alive && !x.seats.some(Boolean));
  const bot = g.actors.find((a) => a.brain && a.alive && a.team !== g.player.team);
  bot.brain.update = bot.brain._upd;
  bot.slots = [null, null, null, null, null];
  const f = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) };
  tp(bot, v.pos.x + f.z * 4, v.pos.z - f.x * 4, v.pos.y + 3);
  const S = g.storm;
  const far = { x: -Math.sign(v.pos.x || 1) * 60, z: -Math.sign(v.pos.z || 1) * 60 };
  S.stage = 'shrink'; S.timer = 60; S.center.set(far.x, far.z); S.radius = 30; S.next = { c: S.center.clone(), r: 30 };
  bot.brain.enemy = null; bot.brain.think = 0;
  window.BOT = bot; window.VEH = v;
  tp(g.actors[1], v.pos.x + 30, v.pos.z + 30); // the client watches from nearby
});
const bid = await H.evaluate(() => ({ b: BOT.id, v: VEH.id }));
const inH = await waitFor(H, () => BOT.vehicle === VEH && BOT.seat === 0, 20000);
const pos0 = await C.evaluate((id) => { const v = __bi.game.vehicles.list[id.v]; return [v.pos.x, v.pos.z]; }, bid);
const seenC = await waitFor(C, ({ id, p0 }) => { const g = __bi.game, v = g.vehicles.list[id.v]; return v.seats[0] === g.actors[id.b] && Math.hypot(v.pos.x - p0[0], v.pos.z - p0[1]) > 10; }, 25000, { id: bid, p0: pos0 });
await C.screenshot({ path: `${shots}/on7-02-client-bot-drive.png` });
check('a bot takes a truck and drives off: the client sees the bot in the driver seat and the truck moving', inH && seenC, JSON.stringify({ inH, seenC }));

// ---- end of the match: the client's result counts the quest
await H.evaluate(() => { const g = __bi.game; for (const a of g.actors) if (a.team !== g.player.team && a.alive) { if (a.vehicle) g.vehicles.exit(a); a.state = 'ground'; g.eliminate(a, g.player, {}); } });
const resC = await waitFor(C, () => __bi.game.result && __bi.game.result.quests === 1 && [...document.querySelectorAll('.sx-won')].some((e) => /Story quest completed: 1 \(\+750 XP\)/.test(e.textContent)), 15000);
check("the client's result screen adds the story quest's 750 XP", resC);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online milestone-7 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
