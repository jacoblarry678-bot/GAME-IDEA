// Milestone 4 checks: vehicles, ziplines, Benton Bucks (vending bots, upgrade
// benches) and daily challenges, driven through the real game with real keys.
// Usage: node tools/island-milestone4.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const waitFor = async (fn, ms = 15000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await p.waitForTimeout(150); } return false; };
const key = async (k, ms = 120) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);

// ---- lobby: daily challenges card
const lobby = await ev(() => ({ card: document.querySelectorAll('.lobby .chal').length, list: __bi.challenges.dailyChallenges().list.map((c) => c.id) }));
check('lobby shows 3 daily challenges', lobby.card === 3 && lobby.list.length === 3, JSON.stringify(lobby));

await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=team][data-id="2"]'); // duos: a bot teammate for the ride-along check
await p.click('[data-act=play]');
await p.waitForTimeout(700);
// helpers inside the page: skip the bus, freeze everyone else far away, find open flat ground
await ev(() => {
  const g = __bi.game;
  window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (const a of g.actors) if (a.brain) { a.brain._upd = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  window.field = () => {
    let best = null;
    for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
      const h = g.world.height(x, z);
      if (h < 2 || g.world.physics.query(x - 9, z - 34, x + 9, z + 10).some((c) => c.kind !== 'tree' && c.kind !== 'rock')) continue;
      let dev = 0;
      for (const [dx, dz] of [[-8, -32], [8, -32], [-8, 8], [8, 8], [0, -16], [0, -24]]) dev = Math.max(dev, Math.abs(g.world.height(x + dx, z + dz) - h));
      if (dev < 2.5 && (!best || dev < best.dev)) best = { x, z, y: h, dev };
    }
    // test strip: clear the trees/rocks in it
    if (best) for (const c of [...g.world.physics.query(best.x - 9, best.z - 34, best.x + 9, best.z + 10)]) g.world.destroyCollider(c);
    if (best) return best;
    return null;
  };
  window.F = window.field();
  window.put = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; };
  window.freshFoe = (not) => { const P = g.player; const f = g.actors.find((a) => a.brain && a.team !== P.team && a.alive && !a.downed && a !== not && !a.vehicle); f.hp = 100; f.shield = 0; return f; };
});

// ---- the world
const world = await ev(() => {
  const g = __bi.game, W = g.world;
  const vs = g.vehicles.list;
  const overlap = vs.filter((v) => g.world.physics.query(v.pos.x - 2, v.pos.z - 2, v.pos.x + 2, v.pos.z + 2).some((c) => c.type === 'box' && c.vehicle !== v && c.maxY > v.pos.y + 0.9 && c.minY < v.pos.y + 1.8)).length;
  return { trucks: vs.filter((v) => v.type === 'truck').length, karts: vs.filter((v) => v.type === 'kart').length, vendors: W.vendors.length, benches: W.benches.length, zips: W.ziplines.length, pumps: W.pumps.length, overlap, field: !!window.F };
});
check('island has 4 trucks, 4 karts, 3 vending bots, 2 upgrade benches, 3 ziplines and fuel pumps (nothing parked inside a wall)', world.trucks === 4 && world.karts === 4 && world.vendors === 3 && world.benches === 2 && world.zips === 3 && world.pumps >= 4 && world.overlap === 0 && world.field, JSON.stringify(world));

// ---- enter a truck with E, drive with W/A, exit with E (real keys, real frames)
await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[0];
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  put(P, F.x - 2.6, F.z);
  const mate = g.actors.find((a) => a !== P && a.team === P.team);
  mate.brain.update = mate.brain._upd; // the bot teammate is live for the ride-along check
  put(mate, F.x + 8, F.z + 6);
  g.controller.yaw = 0;
});
await p.waitForTimeout(300);
const prompt = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
const inside = await waitFor(() => __bi.game.player.vehicle && __bi.game.player.seat === 0 && __bi.game.player.state === 'drive', 3000);
check('E next to a truck: "Drive Diesel Truck", you take the driver seat', /Drive Diesel Truck/.test(prompt) && inside, prompt);
const z0 = await ev(() => __bi.game.vehicles.list[0].pos.z);
await p.keyboard.down('KeyW');
await waitFor(() => Math.abs(__bi.game.vehicles.list[0].speed) > 8, 8000);
await p.screenshot({ path: `${shots}/m4-01-driving.png` });
const moving = await ev(() => ({ sp: __bi.game.vehicles.list[0].speed, panel: getComputedStyle(document.querySelector('.vehpanel')).display, speedText: document.querySelector('.vp-speed').textContent, seat: __bi.game.player.pos.distanceTo(__bi.game.vehicles.list[0].pos) }));
await p.keyboard.down('KeyA');
await p.waitForTimeout(700);
await p.keyboard.up('KeyA');
await p.keyboard.up('KeyW');
const drove = await ev((z) => { const v = __bi.game.vehicles.list[0]; return { dz: z - v.pos.z, yaw: v.yaw, fuel: v.fuel, driven: __bi.game.player.stats.driven }; }, z0);
check('W drives forward, A steers left; speed shows on the vehicle panel and the player rides in the seat', drove.dz > 6 && drove.yaw > 0.1 && moving.panel !== 'none' && /km\/h/.test(moving.speedText) && moving.seat < 3 && drove.driven > 6, JSON.stringify({ ...drove, ...moving }));
check('driving burns fuel', drove.fuel < 100, drove.fuel.toFixed(2));
const mateIn = await waitFor(() => { const g = __bi.game; const m = g.actors.find((a) => a !== g.player && a.team === g.player.team); return m.vehicle === g.player.vehicle && m.seat > 0; }, 12000);
check('bot teammate hops into a passenger seat', mateIn, await ev(() => { const g = __bi.game; const m = g.actors.find((a) => a !== g.player && a.team === g.player.team); return `${m.brain.mode} ${m.pos.distanceTo(g.vehicles.list[0].pos).toFixed(1)}m seat=${m.seat}`; }));
await ev(() => { __bi.game.vehicles.list[0].speed = 0; });
await key('KeyE');
const out = await waitFor(() => !__bi.game.player.vehicle && ['ground', 'air'].includes(__bi.game.player.state), 3000);
await p.waitForTimeout(600);
const outInfo = await ev(() => { const g = __bi.game, P = g.player, v = g.vehicles.list[0]; const m = g.actors.find((a) => a !== P && a.team === P.team); return { d: P.pos.distanceTo(v.pos), ground: P.grounded, mateOut: !m.vehicle }; });
check('E hops out beside the truck; the bot teammate gets out too', out && outInfo.d < 5 && outInfo.ground && outInfo.mateOut, JSON.stringify(outInfo));

// ---- fuel: running dry, then a pump
const fuel = await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[1];
  const mate = g.actors.find((a) => a !== P && a.team === P.team);
  mate.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; };
  mate.pos.set(-150, 0, 150);
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  g.vehicles.enter(P, v);
  v.fuel = 0;
  __bi.input.keys.add('KeyW');
  const z = v.pos.z;
  step(2);
  __bi.input.keys.delete('KeyW');
  const dry = Math.abs(v.pos.z - z);
  const pump = g.world.pumps[g.world.pumps.length - 1];
  v.pos.set(pump.x + 3, g.world.physics.groundAt(pump.x + 3, pump.z, 60).y, pump.z); v.speed = 0; g.vehicles._sync(v, true);
  step(2);
  const refilled = v.fuel;
  g.vehicles.exit(P);
  return { dry, refilled };
});
check('out of fuel: the throttle does nothing; parked at a pump it refuels', fuel.dry < 0.5 && fuel.refilled > 30, JSON.stringify(fuel));

// ---- run over an opponent (teammates are safe)
const run = await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[2];
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  g.vehicles.enter(P, v);
  const foe = g.actors.find((a) => a.brain && a.team !== P.team);
  const mate = g.actors.find((a) => a !== P && a.team === P.team);
  put(foe, F.x, F.z - 14); foe.hp = 100; foe.shield = 0;
  put(mate, F.x + 0.3, F.z - 22); mate.hp = 100; mate.shield = 0;
  v.speed = 20;
  __bi.input.keys.add('KeyW');
  step(1.4);
  __bi.input.keys.delete('KeyW');
  const r = { foeHp: foe.hp, mateHp: mate.hp, runovers: P.stats.runovers };
  v.speed = 0;
  g.vehicles.exit(P);
  mate.pos.set(-150, 0, 150);
  return r;
});
check('running into an opponent hurts them (and counts as a run-over); teammates take no damage', run.foeHp < 60 && run.mateHp === 100 && run.runovers >= 1, JSON.stringify(run));

// ---- crash into a wall, shoot it, blow it up
const crash = await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[3];
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  // a metal wall across the road ahead
  g.world.box(F.x - 6, F.y - 0.5, F.z - 22, F.x + 6, F.y + 4, F.z - 21, { color: '#888', material: 'metal' });
  g.vehicles.enter(P, v);
  v.speed = 22;
  __bi.input.keys.add('KeyW');
  step(1.5);
  __bi.input.keys.delete('KeyW');
  const r = { z: v.pos.z - F.z, hp: v.hp, max: v.def.hp };
  g.vehicles.exit(P);
  put(P, F.x - 6, F.z + 6);
  return r;
});
check('crashing into a wall stops the truck and damages it', crash.z > -21 && crash.hp < crash.max, JSON.stringify(crash));
await ev(() => {
  const g = __bi.game, P = g.player;
  g.debugLoadout();
  P.select(0);
  const v = g.vehicles.list[3];
  g.controller.yaw = Math.atan2(-(v.pos.x - P.pos.x), -(v.pos.z - P.pos.z));
  g.controller.pitch = -0.05;
  window.hp0 = v.hp;
});
await p.mouse.down();
await p.waitForTimeout(1200);
await p.mouse.up();
const shot = await ev(() => ({ hp: __bi.game.vehicles.list[3].hp, hp0 }));
check('shooting a truck damages it', shot.hp < shot.hp0, JSON.stringify(shot));
const boom = await ev(() => {
  const g = __bi.game, v = g.vehicles.list[3];
  const foe = freshFoe();
  put(foe, v.pos.x + 2.6, v.pos.z);
  g.vehicles.enter(foe, v);
  const seated = foe.vehicle === v;
  g.vehicles.damage(v, 99999, g.player);
  step(0.3);
  const cols = g.world.physics.query(v.pos.x - 1, v.pos.z - 1, v.pos.x + 1, v.pos.z + 1).filter((c) => c.vehicle === v).length;
  return { seated, alive: v.alive, foeOut: !foe.vehicle, cols, onMap: g.vehicles.list.filter((x) => x.alive).length };
});
check('a destroyed truck explodes: occupants are thrown out and the wreck is gone', boom.seated && !boom.alive && boom.foeOut && boom.cols === 0, JSON.stringify(boom));

// ---- passengers shoot, drivers don't
const seats = await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[1];
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  const foe = freshFoe();
  put(foe, F.x, F.z + 30);
  const dir = () => foe.eye.sub(P.eye).normalize();
  g.vehicles.enter(P, v);
  P.select(0);
  P.fireCd = P.equipT = 0;
  const asDriver = g.combat.fire(P, dir());
  g.vehicles.exit(P);
  const dummy = freshFoe(foe);
  put(dummy, F.x + 2.6, F.z);
  g.vehicles.enter(dummy, v); // someone else drives
  g.vehicles.enter(P, v);
  const seat = P.seat;
  P.fireCd = P.equipT = 0;
  const hp0 = v.hp;
  let hits = 0;
  for (let i = 0; i < 6; i++) { P.fireCd = 0; P.bloom = 0; P.ads = true; if (g.combat.fire(P, dir())) hits++; }
  const r = { asDriver, seat, shots: hits, foeHp: foe.hp, ownTruck: v.hp === hp0 };
  g.vehicles.exit(P);
  g.vehicles.exit(dummy);
  dummy.pos.set(-150, 0, 150);
  return r;
});
check('the driver cannot shoot; a passenger can (and never hits their own truck)', !seats.asDriver && seats.seat === 1 && seats.shots > 0 && seats.foeHp < 100 && seats.ownTruck, JSON.stringify(seats));

// ---- trucks climb build ramps
const ramp = await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[1];
  v.pos.set(F.x, F.y, F.z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  // two ramps in a row ahead, built by the player
  P.mats.wood = 200;
  put(P, F.x + 2, F.z - 6);
  for (const dz of [0, 4]) {
    put(P, Math.floor(F.x / 4) * 4 + 2, Math.floor((F.z - 6) / 4) * 4 + 2 - dz);
    const s = g.building.spot(P, 'ramp', 0, 0);
    g.building.place(P, s, 'wood');
  }
  const y0 = v.pos.y;
  v.pos.x = Math.floor(F.x / 4) * 4 + 2; g.vehicles._sync(v, true);
  put(P, v.pos.x + 2.6, v.pos.z);
  g.vehicles.enter(P, v);
  let top = y0;
  __bi.input.keys.add('KeyW');
  for (let i = 0; i < 150; i++) { step(1 / 60); top = Math.max(top, v.pos.y); }
  __bi.input.keys.delete('KeyW');
  v.speed = 0;
  g.vehicles.exit(P);
  return { climbed: +(top - y0).toFixed(2) };
});
check('a truck drives up build ramps', ramp.climbed > 2, JSON.stringify(ramp));

// ---- ziplines: E at a tower, ride, let go with SPACE
await ev(() => {
  const g = __bi.game, P = g.player, L = g.world.ziplines[0];
  put(P, L.base[0].x + 1.2, L.base[0].z + 1.2);
  window.zips0 = P.stats.zips;
});
await p.waitForTimeout(300);
const zp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
const riding = await waitFor(() => __bi.game.player.state === 'zip', 3000);
const zs = await ev(() => ({ t: __bi.game.player.zip?.t, y: __bi.game.player.pos.y }));
await p.waitForTimeout(1200);
await p.screenshot({ path: `${shots}/m4-02-zipline.png` });
const zm = await ev(() => ({ t: __bi.game.player.zip?.t, zips: __bi.game.player.stats.zips - zips0 }));
await key('Space');
const dropped = await waitFor(() => __bi.game.player.state !== 'zip', 2000);
check('E at a zipline tower rides the cable (and counts for challenges); SPACE lets go', /zipline/i.test(zp) && riding && zm.t > zs.t + 0.05 && zm.zips === 1 && dropped, JSON.stringify({ zp, zs, zm }));
const ride = await ev(() => {
  const g = __bi.game, P = g.player, L = g.world.ziplines[1];
  put(P, L.base[1].x + 1, L.base[1].z + 1);
  P.startZip(L);
  let minClear = 99;
  for (let i = 0; i < 60 * 8 && P.state === 'zip'; i++) { step(1 / 60); minClear = Math.min(minClear, P.pos.y - g.world.height(P.pos.x, P.pos.z)); }
  return { state: P.state, end: Math.hypot(P.pos.x - L.base[0].x, P.pos.z - L.base[0].z), minClear: +minClear.toFixed(2) };
});
check('a full ride reaches the far tower without scraping the ground', ride.state !== 'zip' && ride.end < 4 && ride.minClear > 1, JSON.stringify(ride));

// ---- Benton Bucks: chests and eliminations drop them; auto-collected
const bucks = await ev(() => {
  const g = __bi.game, P = g.player;
  P.bucks = 0;
  const ch = g.world.chests.find((c) => c && !c.opened);
  put(P, ch.pos.x + 1.2, ch.pos.z, ch.pos.y + 1);
  g.loot.openChest(P, ch);
  step(2.5);
  const coins = g.loot.pickups.filter((k) => k.it.kind === 'coin');
  for (const k of coins) if (k.pos.distanceTo(P.pos) < 8) { P.pos.copy(k.pos); P.state = 'ground'; step(0.2); }
  const fromChest = P.bucks;
  const foe = freshFoe();
  foe.bucks = 40;
  put(foe, F.x, F.z);
  g.eliminate(foe, P, {});
  step(2);
  const drop = g.loot.pickups.find((k) => k.it.kind === 'coin' && k.pos.distanceTo(foe.pos) < 6);
  return { fromChest, dropped: drop ? drop.it.count : 0, hud: document.querySelector('.bucks b').textContent };
});
check('chests drop Benton Bucks (auto-collected, shown on the HUD); eliminations drop their Bucks + 25', bucks.fromChest >= 20 && bucks.dropped === 65 && +bucks.hud === bucks.fromChest, JSON.stringify(bucks));

// ---- vending bot: E opens the shop, 1 buys
await ev(() => {
  const g = __bi.game, P = g.player, V = g.world.vendors[0];
  P.slots = [null, null, null, null, null]; P.sel = -1;
  P.bucks = 150;
  put(P, V.stand.x, V.stand.z, V.stand.y + 1);
  window.spent0 = P.stats.spent;
});
await p.waitForTimeout(300);
const sp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
const open = await waitFor(() => !document.querySelector('.shop').classList.contains('hidden'), 2000);
await p.screenshot({ path: `${shots}/m4-03-shop.png` });
await key('Digit1');
await p.waitForTimeout(300);
const bought = await ev(() => { const P = __bi.game.player; return { bucks: P.bucks, slot: P.slots.find(Boolean), spent: P.stats.spent - spent0 }; });
await key('Digit1'); // 50 left: not enough for another 100
await p.waitForTimeout(300);
const poor = await ev(() => __bi.game.player.bucks);
await key('KeyE');
const closed = await waitFor(() => document.querySelector('.shop').classList.contains('hidden'), 2000);
check('vending bot: E opens the shop, 1 buys a Big Shield Potion for 100; you cannot buy what you cannot afford', /SNACK-O-BOT/.test(sp) && open && bought.bucks === 50 && bought.slot?.id === 'bigshield' && bought.spent === 100 && poor === 50 && closed, JSON.stringify({ sp, bought, poor }));

// ---- upgrade bench
await ev(() => {
  const g = __bi.game, P = g.player, B = g.world.benches[0];
  P.slots[1] = { kind: 'weapon', id: 'ar', rarity: 1, mag: 30 };
  P.select(1);
  P.bucks = 120;
  put(P, B.pos.x + 1.8, B.pos.z + 1.8, B.pos.y + 1);
});
await p.waitForTimeout(300);
const bp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
await p.waitForTimeout(300);
const up = await ev(() => { const P = __bi.game.player; return { rarity: P.slots[1].rarity, bucks: P.bucks, upgrades: P.stats.upgrades }; });
check('upgrade bench: E upgrades the held Uncommon rifle to Rare for 100 Bucks', /Upgrade to Rare · 100/.test(bp) && up.rarity === 2 && up.bucks === 20 && up.upgrades === 1, JSON.stringify({ bp, up }));

// ---- daily challenges pay out at the end of the match
await ev(() => {
  const s = __bi.save.data;
  s.challenges.list = [{ id: 'chests', prog: 4, done: false }, { id: 'zip', prog: 0, done: false }, { id: 'drive', prog: 450, done: false }];
  __bi.save.write();
  window.xp0 = s.progress.xp;
});
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a.team !== g.player.team && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const chal = await ev(() => { const r = __bi.game.result; return { chalXP: r.chalXP, rows: r.challenges.map((c) => [c.id, c.prog, c.done]), gained: __bi.save.data.progress.xp - xp0, xp: r.xp, shown: document.querySelectorAll('.result .chal').length, text: document.querySelector('.chal-result')?.textContent.replace(/\s+/g, ' ') }; });
await p.screenshot({ path: `${shots}/m4-04-result.png` });
check('match stats complete daily challenges: +1,000 XP each, listed on the result screen', chal.chalXP === 3000 && chal.gained === chal.xp && chal.shown === 3 && /\+1,000 XP/.test(chal.text), JSON.stringify(chal));
await p.click('[data-act=quit]');
await p.waitForTimeout(600);
const lobby2 = await ev(() => document.querySelectorAll('.lobby .chal.done').length);
check('lobby card shows the completed challenges', lobby2 === 3, lobby2);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-4 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
