// Automated playtest for Battle Island: drives real keyboard/mouse input where
// possible and uses the window.__bi debug handle to set up scenarios and
// fast-forward time. Usage: node tools/island-playtest.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const out = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
const waitFor = async (fn, ms, arg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await p.waitForTimeout(250); }
  return false;
};

await p.goto(url, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2000);
// headless runs behave like a sandboxed frame without pointer lock: drag-to-look fallback
await ev(() => {
  __bi.input.lockBlocked = true;
  const g = __bi.game, orig = g.eliminate.bind(g);
  window.__deaths = [];
  g.eliminate = (t, k, o = {}) => { if (t === g.player) window.__deaths.push({ t: g.time.toFixed(1), killer: k && k.name, o: JSON.stringify(Object.keys(o)), hp: t.hp, st: t.state }); return orig(t, k, o); };
});
await p.click('[data-act=play]');
await waitFor(() => __bi.game.busT > 1.7, 30000);

// ---- bus → skydive → glide → land
await p.keyboard.press('Space');
await p.waitForTimeout(500);
check('jump from bus with SPACE', await ev(() => ['skydive', 'glide'].includes(__bi.game.player.state)), await ev(() => __bi.game.player.state));
await shot('01-skydive');
await ev(() => (__bi.engine.timeScale = 4));
const landed = await waitFor(() => ['ground', 'air', 'swim'].includes(__bi.game.player.state), 60000);
await ev(() => (__bi.engine.timeScale = 1));
const land = await ev(() => ({ st: __bi.game.player.state, hp: __bi.game.player.hp, y: __bi.game.player.pos.y.toFixed(1) }));
check('glider deploys and player lands without fall damage', landed && land.hp === 100, JSON.stringify(land));
await p.waitForTimeout(500);
await shot('02-landed');
// isolate the feature checks: bots stand still (they are released again for the full-match run)
await ev(() => {
  for (const a of __bi.game.actors) {
    if (!a.brain) continue;
    a.brain._update = a.brain.update;
    a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; };
  }
  __bi.game.player.hp = 100;
});

// ---- chests + pickups + drop
const chestInfo = await ev(() => {
  const g = __bi.game, P = g.player;
  const ch = g.world.chests.find((c) => !c.opened && c.pos.y - g.world.height(c.pos.x, c.pos.z) < 1 && !c.legendary);
  P.pos.set(ch.pos.x, ch.pos.y + 0.2, ch.pos.z + 1.4);
  P.vel.set(0, 0, 0);
  P.state = 'ground';
  g.controller.yaw = 0; g.controller.pitch = -0.3;
  return { x: ch.pos.x.toFixed(1), z: ch.pos.z.toFixed(1), idx: g.world.chests.indexOf(ch) };
});
await p.waitForTimeout(400);
await p.keyboard.press('KeyE');
await p.waitForTimeout(1500);
const opened = await ev((i) => __bi.game.world.chests[i].opened, chestInfo.idx);
check('open chest with E', opened, JSON.stringify(chestInfo));
await shot('03-chest');
for (let i = 0; i < 5; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(300); }
const inv = await ev(() => ({ slots: __bi.game.player.slots.map((s) => s && `${s.id}${s.count ? 'x' + s.count : ''}`), ammo: __bi.game.player.ammo, mats: __bi.game.player.mats }));
check('pick up chest loot (weapon/consumable + auto ammo/mats)', inv.slots.filter(Boolean).length >= 1, JSON.stringify(inv));
const held = await ev(() => JSON.stringify(__bi.game.player.slots[0]));
await p.keyboard.press('Digit1');
await p.waitForTimeout(400);
await p.keyboard.press('KeyG');
await p.waitForTimeout(800);
const dropped = await ev((h) => ({ onGround: __bi.game.loot.pickups.some((k) => JSON.stringify(k.it) === h), s0: __bi.game.player.slots[0] }), held);
check('drop held item with G', dropped.onGround && !dropped.s0, JSON.stringify({ held, ...dropped }));
await p.keyboard.press('KeyE');
await p.waitForTimeout(400);
check('pick the dropped item back up', await ev(() => !!__bi.game.player.slots.find(Boolean)));

// ---- stacking + slot limit
const stack = await ev(() => {
  const P = __bi.game.player;
  P.slots = [null, null, null, null, null];
  P.addItem({ kind: 'consumable', id: 'minishield', count: 4 });
  const left = P.addItem({ kind: 'consumable', id: 'minishield', count: 4 });
  return { s: P.slots.filter(Boolean).map((s) => s.count), left };
});
check('consumables stack to their limit (6) and overflow to a new slot', stack.s[0] === 6 && stack.s[1] === 2 && !stack.left, JSON.stringify(stack));
const full = await ev(() => {
  const P = __bi.game.player;
  P.slots = [1, 2, 3, 4, 5].map(() => ({ kind: 'weapon', id: 'pistol', rarity: 0, mag: 16 }));
  return { room: P.hasRoomFor({ kind: 'weapon', id: 'ar', rarity: 1, mag: 30 }), left: !!P.addItem({ kind: 'weapon', id: 'ar', rarity: 1, mag: 30 }) };
});
check('five-slot limit enforced', !full.room && full.left, JSON.stringify(full));

// ---- healing use time + interruption
const heal = await ev(() => {
  const P = __bi.game.player;
  P.slots = [{ kind: 'consumable', id: 'bandage', count: 2 }, { kind: 'weapon', id: 'ar', rarity: 1, mag: 30 }, null, null, null];
  P.hp = 40; P.select(0); P.equipT = 0;
  const started = P.startUse();
  return { started, t: P.use && P.use.total };
});
await waitFor(() => __bi.game.player.use && __bi.game.player.use.t < 3.2, 5000);
await p.keyboard.press('Digit2');
await waitFor(() => __bi.game.player.sel === 1, 5000);
const interrupted = await ev(() => ({ use: __bi.game.player.use, hp: __bi.game.player.hp, n: __bi.game.player.slots[0].count }));
check('consumable use is interrupted by switching slots', heal.started && !interrupted.use && interrupted.hp === 40 && interrupted.n === 2, JSON.stringify({ heal, interrupted }));
await ev(() => { const P = __bi.game.player; P.select(0); P.equipT = 0; P.startUse(); });
await waitFor(() => !__bi.game.player.use, 20000);
await waitFor(() => __bi.game.player.hp === 55, 3000);
const healed = await ev(() => ({ hp: __bi.game.player.hp, n: __bi.game.player.slots[0]?.count }));
check('bandage heals 15 after its 3.5s use time', healed.hp === 55 && healed.n === 1, JSON.stringify(healed));

// ---- shooting a bot (real mouse input)
const target = await ev(() => {
  const g = __bi.game, P = g.player;
  g.debugLoadout();
  P.select(0); P.equipT = 0;
  const bot = g.actors.find((a) => a.isBot && a.alive);
  bot.brain.update = () => { const i = bot.brain.inp; i.mx = i.mz = 0; i.jump = false; return i; };
  // open flat ground: find a clear spot with nothing solid within 14m
  let x = 0, z = 0;
  search: for (let gx = -120; gx <= 120; gx += 8) for (let gz = -120; gz <= 120; gz += 8) {
    if (g.world.height(gx, gz) < 2 || g.world.height(gx, gz - 9) < 2 || Math.abs(g.world.height(gx, gz) - g.world.height(gx, gz - 9)) > 1.5) continue;
    if (g.world.physics.query(gx - 14, gz - 16, gx + 14, gz + 6).length) continue;
    x = gx; z = gz; break search;
  }
  P.pos.set(x, g.world.height(x, z), z);
  window.F = { x, z };
  bot.state = 'ground'; bot.pos.set(x, g.world.height(x, z - 9), z - 9); bot.vel.set(0, 0, 0);
  bot.hp = 100; bot.shield = 50;
  P.state = 'ground';
  g.controller.yaw = 0;
  g.controller.pitch = Math.atan2(bot.pos.y + 1.0 - (P.pos.y + 1.55), 9);
  return { id: bot.id, name: bot.name, x, z };
});
await p.waitForTimeout(400);
const ammo0 = await ev(() => __bi.game.player.slots[0].mag);
await p.mouse.move(640, 360);
await p.mouse.down();
await p.waitForTimeout(2500);
await p.mouse.up();
await p.waitForTimeout(300);
const shot1 = await ev((id) => { const b = __bi.game.actors[id]; return { hp: b.hp, sh: b.shield, alive: b.alive, mag: __bi.game.player.slots[0]?.mag, dmg: __bi.game.player.damageDealt }; }, target.id);
check('auto rifle fires with mouse, uses ammo, damages bot', shot1.mag < ammo0 && shot1.dmg > 0, JSON.stringify({ ammo0, ...shot1 }));
await shot('04-shooting');
await p.keyboard.press('KeyR');
const reloading = await waitFor(() => __bi.game.player.reloadT > 0, 3000);
await waitFor(() => __bi.game.player.reloadT <= 0, 15000);
const rl = await ev(() => ({ mag: __bi.game.player.slots[0].mag, reserve: __bi.game.player.ammo.medium }));
check('reload with R refills the magazine from reserve', reloading && rl.mag === 30, JSON.stringify(rl));

// ---- building
await ev(() => { const g = __bi.game; g.controller.pitch = -0.1; g.player.mats = { wood: 100, brick: 50, metal: 50 }; });
await p.keyboard.press('KeyB');
await p.waitForTimeout(200);
const pieces = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const placed = [];
await waitFor(() => __bi.game.controller.building, 5000);
const mine = () => ev(() => [...__bi.game.building.pieces].filter((c) => c.owner === __bi.game.player).length);
for (const [i, k] of pieces.entries()) {
  await p.keyboard.press(k);
  await waitFor((n) => __bi.game.controller.piece === ['wall', 'floor', 'ramp', 'cone'][n], 5000, i);
  await ev((n) => (__bi.game.controller.yaw = n * 1.571), i);
  await p.waitForTimeout(250);
  const n0 = await mine();
  await p.mouse.click(640, 360);
  await waitFor((n) => [...__bi.game.building.pieces].filter((c) => c.owner === __bi.game.player).length > n, 4000, n0);
  placed.push(await mine());
}
const wood = await ev(() => __bi.game.player.mats.wood);
check('build wall/floor/ramp/cone with grid preview (10 wood each)', placed[3] === 4 && wood === 60, JSON.stringify({ placed, wood }));
await ev(() => (__bi.game.controller.yaw = 0.8));
await p.waitForTimeout(300);
await shot('05-building');
const dup = await ev(() => { const g = __bi.game; const s = g.building.spot(g.player, 'wall', 0, -0.1); return { free: s.free, placed: !!g.building.place(g.player, s, 'wood') && !!g.building.place(g.player, s, 'wood') }; });
check('occupied grid slot rejects a duplicate piece', dup.placed === false, JSON.stringify(dup));
const ramp = await ev(() => {
  const g = __bi.game, P = g.player;
  g.controller.building = false;
  // the clear, flat test field found for the shooting check (build pieces from the last step are far away)
  const x = Math.floor((window.F.x + 10) / 4) * 4 + 2, z = Math.floor(window.F.z / 4) * 4 + 2;
  P.pos.set(x, g.world.height(x, z), z);
  P.vel.set(0, 0, 0);
  P.state = 'ground';
  return true;
});
await waitFor(() => __bi.game.player.state === 'ground' && Math.abs(__bi.game.player.vel.y) < 0.01, 10000);
await p.waitForTimeout(300);
const climb = await ev(() => {
  const g = __bi.game, P = g.player;
  P.mats.wood = 50;
  g.controller.yaw = 0; g.controller.pitch = 0;
  const s = g.building.spot(P, 'ramp', 0, 0);
  const c = g.building.place(P, s, 'wood');
  return { ok: !!c, y0: P.pos.y, top: c && c.maxY };
});
await p.keyboard.down('KeyW');
let climbed = 0;
for (let i = 0; i < 50 && climbed < climb.y0 + 2.5; i++) { climbed = Math.max(climbed, await ev(() => __bi.game.player.pos.y)); await p.waitForTimeout(100); }
await p.keyboard.up('KeyW');
check('player can run up a placed ramp', climb.ok && climbed > climb.y0 + 2, JSON.stringify({ ...climb, after: climbed.toFixed(2) }));
const destroyed = await ev(() => {
  const g = __bi.game;
  const c = [...g.building.pieces][0];
  const n0 = g.building.pieces.size;
  g.building.damage(c, 9999, g.player);
  return { n0, n1: g.building.pieces.size, alive: c.alive };
});
check('structures take damage and are destroyed', destroyed.n1 === destroyed.n0 - 1 && !destroyed.alive, JSON.stringify(destroyed));

// ---- harvesting with the pickaxe
await ev(() => {
  const g = __bi.game, P = g.player;
  let best = null, bd = 1e9;
  for (const c of g.world.physics.colliders) {
    if (c.kind !== 'tree' || !c.alive) continue;
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const d = Math.hypot(cx - P.pos.x, cz - P.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  const cx = (best.minX + best.maxX) / 2, cz = (best.minZ + best.maxZ) / 2;
  P.pos.set(cx, g.world.height(cx, cz + 1.5), cz + 1.5);
  P.vel.set(0, 0, 0);
  P.select(-1);
  g.controller.yaw = 0; g.controller.pitch = -0.05;
  P.mats.wood = 0;
});
await p.waitForTimeout(500);
await p.mouse.down();
await p.waitForTimeout(2200);
await p.mouse.up();
const harvested = await ev(() => __bi.game.player.mats.wood);
check('pickaxe harvests wood from a tree', harvested > 0, `wood=${harvested}`);
await shot('06-harvest');

// ---- storm damage
const storm = await ev(() => {
  const g = __bi.game, P = g.player, st = g.storm;
  st.radius = 20; // shrink artificially so a nearby spot is outside
  P.hp = 100; P.shield = 50;
  const a = Math.atan2(P.pos.z - st.center.y, P.pos.x - st.center.x);
  let x = st.center.x + Math.cos(a) * 60, z = st.center.y + Math.sin(a) * 60;
  if (!g.world.isLand(x, z)) { x = st.center.x - Math.cos(a) * 60; z = st.center.y - Math.sin(a) * 60; }
  P.pos.set(x, g.world.height(x, z) + 1, z);
  return { dmg: st.dmg };
});
await waitFor(() => __bi.game.player.hp < 100, 20000);
const st2 = await ev(() => ({ hp: __bi.game.player.hp, sh: __bi.game.player.shield, out: __bi.game.storm.outside(__bi.game.player.pos.x, __bi.game.player.pos.z) }));
check('storm damages health (not shields) outside the circle', st2.out && st2.hp < 100 && st2.sh === 50, JSON.stringify({ ...storm, ...st2 }));
await shot('07-storm');

// ---- pause menu (Esc) and resume
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
const paused = await ev(() => ({ paused: __bi.game.paused, menu: !!document.querySelector('[data-act=resume]') }));
await p.click('[data-act=resume]');
await p.waitForTimeout(300);
check('Esc pauses the match and Resume continues it', paused.paused && paused.menu && (await ev(() => !__bi.game.paused)), JSON.stringify(paused));

// ---- full match simulation with bots fighting each other
await ev(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.brain && a.brain._update) { a.brain.update = a.brain._update; delete a.brain._update; }
  // restore the storm schedule we bent above
  g.storm.radius = Math.max(g.storm.radius, 20);
  window.__god = setInterval(() => {
    const P = g.player;
    if (!P.alive) return;
    // park the tester out of play (like riding the bus) so bots only fight each other
    P.hp = 100; P.shield = 100;
    const c = g.storm.center;
    P.pos.set(c.x, g.world.height(c.x, c.y) + 2, c.y);
    P.vel.set(0, 0, 0);
    P.state = 'bus';
  }, 100);
  __bi.engine.timeScale = 8;
});
const t0 = Date.now();
const ended = await waitFor(() => __bi.game.alive().length <= 2, 420000);
const sim = await ev(() => {
  const g = __bi.game;
  __bi.engine.timeScale = 1;
  clearInterval(window.__god);
  const bots = g.actors.filter((a) => a.isBot);
  return { simTime: Math.round(g.time), alive: g.alive().length, botKills: bots.reduce((s, a) => s + a.kills, 0), pieces: g.building.pieces.size, chestsOpened: g.world.chests.filter((c) => c.opened).length, stormPhase: g.storm.phase };
});
check('bots loot, fight and eliminate each other until the endgame', ended && sim.botKills > 0, JSON.stringify({ ...sim, realSec: Math.round((Date.now() - t0) / 1000) }));

// ---- elimination of last bot → victory screen
await ev(() => {
  const g = __bi.game, P = g.player;
  const c = g.storm.center;
  P.pos.set(c.x, g.world.height(c.x, c.y), c.y);
  P.state = 'ground';
  for (const a of g.actors) if (a !== P && a.alive) g.applyDamage(a, 999, P, { pos: a.pos });
});
await p.waitForTimeout(1500);
const win = await ev(() => ({ state: __bi.game.state, result: __bi.game.result, screen: !!document.querySelector('.result.win') }));
check('eliminating the last opponent shows the victory screen', win.state === 'over' && win.result?.won && win.screen, JSON.stringify(win.result));
await shot('08-victory');

// ---- replay
await p.click('[data-act=again]');
await p.waitForTimeout(3000);
const again = await ev(() => ({ state: __bi.game.state, alive: __bi.game.alive().length, n: __bi.game.actors.length, p: __bi.game.player.state }));
check('Play again starts a fresh match', again.state === 'bus' && again.alive === again.n && again.p === 'bus', JSON.stringify(again));

// ---- player elimination → results + spectate + lobby
await waitFor(() => __bi.game.busT > 1.7, 30000);
await p.keyboard.press('Space');
await waitFor(() => __bi.game.player.state !== 'bus', 60000);
await ev(() => { __bi.engine.timeScale = 1; const g = __bi.game; const k = g.actors.find((a) => a.isBot && a.alive); g.applyDamage(g.player, 999, k, {}); });
await p.waitForTimeout(1000);
const dead = await ev(() => ({ res: __bi.game.result, spectating: __bi.game.controller.spectating, screen: !!document.querySelector('.result') }));
check('player elimination shows placement and enables spectating', dead.res && !dead.res.won && dead.spectating && dead.screen, JSON.stringify(dead.res));
await p.click('[data-act=spectate]');
await p.waitForTimeout(1500);
await shot('09-spectate');
check('spectate bar visible after choosing Spectate', await ev(() => !document.querySelector('.spectate-bar').classList.contains('hidden')));
await p.keyboard.press('Space');
await p.waitForTimeout(300);
check('Space cycles the spectated player', await ev(() => !!__bi.game.controller.spec));
await p.click('.spec-results');
await p.waitForTimeout(300);
await p.click('[data-act=quit]');
await p.waitForTimeout(1500);
check('return to lobby', await ev(() => !!document.querySelector('.lobby') && !__bi.game.world));
await shot('10-lobby');

// ---- menus: every lobby button opens its screen
for (const [act, sel] of [['chars', '.cards'], ['locker', '.outfits'], ['settings', 'input[type=range]'], ['controls', '.controls'], ['roadmap', '.cols']]) {
  await p.click(`[data-act=${act}]`);
  await p.waitForTimeout(250);
  const ok = await ev((s) => !!document.querySelector(s), sel);
  check(`lobby button "${act}" works`, ok);
  if (act === 'chars') { await p.click('[data-act=pick][data-id=waylon]'); await p.waitForTimeout(200); check('select Waylon', await ev(() => __bi.save.data.profile.character === 'waylon')); await shot('11-characters'); }
  await p.click('[data-act=main]');
  await p.waitForTimeout(200);
}
check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log('player deaths:', JSON.stringify(await ev(() => window.__deaths)));
const perf = await ev(() => { const e = __bi.engine; const t = performance.now(); return { fps: Math.round(e.fps) }; });
console.log('perf (headless software GL):', JSON.stringify(perf));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
