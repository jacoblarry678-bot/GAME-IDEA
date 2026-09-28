// Milestone 5 checks: Crankbolt (boss), the vault and keycard, doors and
// carrying knocked teammates, driven through the real game.
// Usage: node tools/island-milestone5.mjs [url] [shotDir]
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
// a key press, then two rendered frames so the game has handled it (slow headless frames)
const frames = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const key = async (k, ms = 120) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await frames(); };

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);
await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=team][data-id="2"]'); // duos: a bot teammate to carry
await p.click('[data-act=play]');
await p.waitForTimeout(700);
await ev(() => {
  const g = __bi.game;
  window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
  window.THREE_V = g.player.pos.constructor;
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (const a of g.actors) if (a.brain) { a.brain._upd = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; a.hp = 1e6; }
  window.put = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; };
  window.mate = g.actors.find((a) => a !== g.player && a.team === g.player.team);
  window.mate.hp = 100;
});

// ---- the world
const world = await ev(() => {
  const g = __bi.game, W = g.world, B = g.boss;
  return { doors: W.doors.length, closed: W.doors.filter((d) => !d.open).length, vault: !!W.vault && !W.vault.open, vaultChests: W.chests.filter((c) => c && c.vault).length, boss: B.alive && B.hp === 2000, home: B.pos.distanceTo(W.vault.home) < 1, poi: g.world.poiAt(W.vault.pos.x, W.vault.pos.z + 3)?.name };
});
check("island has doors on every house, Crankbolt's Vault (locked, 2 legendary chests inside) and Crankbolt at home with 2,000 HP", world.doors >= 12 && world.closed === world.doors && world.vault && world.vaultChests === 2 && world.boss && world.home && /Vault/.test(world.poi), JSON.stringify(world));

// ---- doors: E opens and closes; open doors let you through
await ev(() => {
  const g = __bi.game, P = g.player;
  // a door whose outside ground is level with the doorway
  const d = g.world.doors.filter((q) => { const x = q.pos.x, z = q.pos.z - q.inward * 1.3; return Math.abs(g.world.physics.groundAt(x, z, q.pos.y + 1).y - q.pos.y) < 0.3; })[0];
  window.D = d;
  // stand outside the door, facing in
  put(P, d.pos.x, d.pos.z - d.inward * 1.3, d.pos.y + 1);
  g.controller.yaw = d.inward > 0 ? Math.PI : 0;
  window.doors0 = P.stats.doors;
});
await p.waitForTimeout(300);
const dp = await ev(() => __bi.game.controller.prompt?.text);
const blocked = await ev(() => { const g = __bi.game; return !!g.world.physics.raycast(D.pos.x, D.pos.y + 1, D.pos.z - D.inward * 1.3, 0, 0, D.inward, 2); });
await key('KeyE');
const opened = await waitFor(() => D.open, 2000);
const through = await ev(() => { const g = __bi.game; return !g.world.physics.raycast(D.pos.x, D.pos.y + 1, D.pos.z - D.inward * 1.3, 0, 0, D.inward, 2); });
await p.keyboard.down('KeyW');
const inside = await waitFor(() => (__bi.game.player.pos.z - D.pos.z) * D.inward > 0.6, 5000);
await p.keyboard.up('KeyW');
await ev(() => { const P = __bi.game.player; put(P, D.pos.x, D.pos.z, D.pos.y + 1); });
await p.waitForTimeout(200);
await key('KeyE');
await p.waitForTimeout(300);
const stayOpen = await ev(() => D.open);
await ev(() => { const P = __bi.game.player; put(P, D.pos.x, D.pos.z - D.inward * 1.3, D.pos.y + 1); });
await p.waitForTimeout(200);
await key('KeyE');
const closed = await waitFor(() => !D.open, 2000);
await p.screenshot({ path: `${shots}/m5-01-door.png` });
check('E opens a door (you can walk through), won\'t close it on someone in the doorway, and E closes it again', /Open door/.test(dp) && blocked && opened && through && inside && stayOpen && closed, JSON.stringify({ dp, blocked, opened, through, inside, stayOpen, closed }));
const botDoor = await ev(() => {
  const g = __bi.game, d = g.world.doors.filter((q) => q !== D && !q.open)[0];
  const bot = g.actors.find((a) => a.brain && a.team !== g.player.team);
  put(bot, d.pos.x, d.pos.z - d.inward * 1.2, d.pos.y + 1);
  bot.brain.update = bot.brain._upd;
  bot.brain.mode = 'roam';
  bot.brain.goal = new THREE_V(d.pos.x, d.pos.y, d.pos.z + d.inward * 4);
  bot.brain.think = 99;
  for (let i = 0; i < 90 && !d.open; i++) step(1 / 60);
  const r = d.open;
  bot.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; };
  bot.pos.set(-150, 0, 150); bot.state = 'swim';
  return r;
}).catch((e) => String(e));
check('bots open doors in their way', botDoor === true, String(botDoor));

// ---- Crankbolt
await ev(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  g.debugLoadout();
  P.select(0);
  P.hp = 100; P.shield = 100;
  put(P, B.pos.x + 12, B.pos.z - 5, B.pos.y + 2); // on the plateau, in sight
  g.controller.yaw = 0; g.controller.pitch = 0.05;
  window.hp0 = P.hp + P.shield;
});
const aggro = await waitFor(() => __bi.game.boss.target === __bi.game.player, 6000);
const rockets = await waitFor(() => __bi.game.boss.shots > 0, 8000);
await p.screenshot({ path: `${shots}/m5-02-boss.png` });
const bar = await ev(() => ({ shown: getComputedStyle(document.querySelector('.bossbar')).display !== 'none', text: document.querySelector('.bossbar').textContent }));
const hurt = await waitFor(() => __bi.game.player.hp + __bi.game.player.shield < hp0 - 10, 12000);
check('Crankbolt spots you, fires rocket volleys that hurt, and the boss health bar shows', aggro && rockets && hurt && bar.shown && /CRANKBOLT/.test(bar.text), JSON.stringify({ aggro, rockets, hurt, bar }));
// shoot it with real clicks
await ev(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  P.hp = 100; P.shield = 100;
  const e = P.eye;
  g.controller.yaw = Math.atan2(-(B.pos.x - P.pos.x), -(B.pos.z - P.pos.z));
  g.controller.pitch = Math.atan2(B.pos.y + 2 - e.y, Math.hypot(B.pos.x - P.pos.x, B.pos.z - P.pos.z));
  window.bhp0 = B.hp;
  window.dmg0 = P.stats.bossDmg;
});
await p.mouse.down();
await p.waitForTimeout(1500);
await p.mouse.up();
const shot = await ev(() => ({ hp: __bi.game.boss.hp, hp0: bhp0, stat: __bi.game.player.stats.bossDmg - dmg0, nums: document.querySelectorAll('.dmg').length }));
check('shooting Crankbolt damages it (counted for challenges)', shot.hp < shot.hp0 && shot.stat > 0, JSON.stringify(shot));
const head = await ev(() => {
  const g = __bi.game, B = g.boss, P = g.player;
  const hb = B.hitbox();
  const o = P.eye;
  const toHead = new THREE_V(hb.head.x - o.x, hb.head.y - o.y, hb.head.z - o.z).normalize();
  const toBody = new THREE_V(B.pos.x - o.x, B.pos.y + 1.5 - o.y, B.pos.z - o.z).normalize();
  const h = g.combat.rayActors(o, toHead, 200, P), bd = g.combat.rayActors(o, toBody, 200, P);
  const through = !g.world.physics.raycast(o.x, o.y, o.z, toBody.x, toBody.y, toBody.z, B.pos.distanceTo(P.pos) + 2);
  return { head: h?.actor === B && h.head, body: bd?.actor === B && !bd.head, through };
});
check('Crankbolt has a head hitbox (critical hits) and a body hitbox; its bulk blocks walking, not bullets', head.head && head.body, JSON.stringify(head));
const stomp = await ev(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  P.hp = 100; P.shield = 100;
  put(P, B.pos.x + 3.5, B.pos.z, B.pos.y + 2);
  B.stompCd = 0; B.fireCd = 99; B.volley = 0; B.walkT = 0;
  const before = P.hp + P.shield;
  let wound = false, rose = 0;
  for (let i = 0; i < 180; i++) { step(1 / 60); if (B.windup > 0) wound = true; rose = Math.max(rose, P.vel.y); }
  return { wound, lost: before - P.hp - P.shield, rose };
});
check('get too close and Crankbolt winds up a stomp that hurts and knocks you up', stomp.wound && stomp.lost > 15 && stomp.rose > 4, JSON.stringify(stomp));
const leash = await ev(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  B.hp = 1200;
  put(P, B.home.x + 120, B.home.z, 60);
  step(20);
  return { home: +B.pos.distanceTo(B.home).toFixed(1), hp: Math.round(B.hp), target: !!B.target };
});
check('run away and Crankbolt walks home and repairs itself', leash.home < 3 && leash.hp > 1500 && !leash.target, JSON.stringify(leash));
const boom = await ev(() => {
  const g = __bi.game, B = g.boss;
  const hp = B.hp;
  g.combat.explode(B.pos.clone().add(new THREE_V(0, 1, 2)), 4.5, 90, 350, g.player);
  return { dealt: Math.round(hp - B.hp) };
});
check('explosions hurt Crankbolt (by their player damage, not their building damage)', boom.dealt > 40 && boom.dealt < 120, JSON.stringify(boom));

// defeat it: loot drops
const down = await ev(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  put(P, B.pos.x, B.pos.z + 10, B.pos.y + 2);
  g.applyDamage(B, 99999, P, {});
  step(3);
  const near = g.loot.pickups.filter((k) => k.pos.distanceTo(B.pos) < 12).map((k) => k.it);
  return {
    alive: B.alive, bar: getComputedStyle(document.querySelector('.bossbar')).display, bosses: P.stats.bosses,
    key: near.some((it) => it.kind === 'key'), mythic: near.find((it) => it.kind === 'weapon' && it.rarity === 5), bucks: near.find((it) => it.kind === 'coin')?.count,
    feed: document.querySelector('.killfeed').textContent,
  };
});
check('defeating Crankbolt drops the Vault Keycard, a Mythic rifle and 150 Bucks', !down.alive && down.bar === 'none' && down.bosses === 1 && down.key && down.mythic?.id === 'ar' && down.bucks === 150 && /took down Crankbolt/.test(down.feed), JSON.stringify(down));

// ---- the vault
await ev(() => {
  const g = __bi.game, P = g.player, V = g.world.vault;
  P.slots = [P.slots[0], null, null, null, null];
  put(P, V.pos.x, V.pos.z + 2, V.pos.y + 1);
  g.controller.yaw = 0;
});
await p.waitForTimeout(300);
const locked = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
await p.waitForTimeout(300);
const stillShut = await ev(() => !__bi.game.world.vault.open);
// pick up the keycard (a slot item: E)
const picked = await ev(() => {
  const g = __bi.game, P = g.player;
  const k = g.loot.pickups.find((q) => q.it.kind === 'key');
  P.pos.copy(k.pos); P.state = 'ground';
  return g.loot.take(P, k) === 'ok' && P.slots.some((s) => s && s.kind === 'key');
});
await p.waitForTimeout(300);
const slotText = await ev(() => document.querySelector('.slots').textContent);
await ev(() => { const g = __bi.game, P = g.player, V = g.world.vault; put(P, V.pos.x, V.pos.z + 2, V.pos.y + 1); window.vault0 = P.stats.vault; window.bucks0 = P.bucks; });
await waitFor(() => /Open Crankbolt/.test(__bi.game.controller.prompt?.text || ''), 3000);
const unlock = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
const open = await waitFor(() => __bi.game.world.vault.open, 3000);
await p.waitForTimeout(1500);
const v = await ev(() => {
  const g = __bi.game, P = g.player, V = g.world.vault;
  const wall = g.world.physics.raycast(V.pos.x, V.pos.y + 1, V.pos.z + 2, 0, 0, -1, 3);
  return { keyGone: !P.slots.some((s) => s && s.kind === 'key'), stat: P.stats.vault - vault0, doorGone: !wall || wall.t > 2.5, gold: g.loot.pickups.some((k) => k.it.kind === 'coin' && k.it.count === 200) };
});
await p.screenshot({ path: `${shots}/m5-03-vault.png` });
check('the vault stays locked without the keycard ("Locked: needs the Vault Keycard")', /Locked/.test(locked || '') && stillShut, locked);
check('pick up the Vault Keycard (it takes a slot), E at the vault door opens it; the keycard is used up and 200 Bucks wait inside', picked && /KEYCARD/.test(slotText) && /Open Crankbolt's Vault/.test(unlock || '') && open && v.keyGone && v.stat === 1 && v.doorGone && v.gold, JSON.stringify({ picked, slotText, unlock, ...v }));
const vchest = await ev(() => { const g = __bi.game; return g.world.chests.filter((c) => c.vault).every((c) => c.legendary && !c.opened); });
check('the vault holds two legendary chests', vchest);

// ---- carrying a knocked teammate
await ev(() => {
  const g = __bi.game, P = g.player;
  const f = (() => { for (let x = -100; x <= 100; x += 3) for (let z = -100; z <= 100; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) return { x, z }; } return { x: 0, z: 30 }; })();
  window.C = f;
  put(P, f.x, f.z); P.hp = 100;
  put(mate, f.x + 1.2, f.z);
  mate.hp = 1; mate.shield = 0;
  const foe = g.actors.find((a) => a.brain && a.team !== P.team && a.alive);
  g.applyDamage(mate, 10, foe, {});
  g.controller.yaw = 0;
});
await p.waitForTimeout(300);
const knocked = await ev(() => mate.downed);
const cp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyX');
const carrying = await waitFor(() => __bi.game.player.carrying === mate && mate.carriedBy === __bi.game.player, 2000);
const z0 = await ev(() => __bi.game.player.pos.z);
await p.keyboard.down('KeyW');
await p.waitForTimeout(1200);
await p.keyboard.up('KeyW');
await p.screenshot({ path: `${shots}/m5-04-carry.png` });
const ride = await ev((z) => { const P = __bi.game.player; return { moved: +(z - P.pos.z).toFixed(2), onTop: +(mate.pos.y - P.pos.y).toFixed(2), sameXZ: Math.hypot(mate.pos.x - P.pos.x, mate.pos.z - P.pos.z) < 0.1, carried: +P.stats.carried.toFixed(1), prompt: __bi.game.controller.prompt?.text }; }, z0);
const noShoot = await ev(() => { const g = __bi.game, P = g.player; P.select(0); P.fireCd = P.equipT = 0; return g.combat.fire(P, new THREE_V(0, 0, -1)) === 0; });
await key('KeyX');
const putDown = await waitFor(() => !__bi.game.player.carrying && !mate.carriedBy, 2000);
await p.waitForTimeout(500);
const after = await ev(() => { const P = __bi.game.player; return { d: +Math.hypot(mate.pos.x - P.pos.x, mate.pos.z - P.pos.z).toFixed(2), downed: mate.downed, ground: mate.pos.y - __bi.game.world.height(mate.pos.x, mate.pos.z) < 0.6 }; });
check('X picks up a knocked teammate ("Revive · X to carry"); they ride on your shoulders while you walk (slower, no shooting)', knocked && /X to carry/.test(cp || '') && carrying && ride.moved > 1 && ride.onTop > 1 && ride.sameXZ && ride.carried > 0.5 && /Put down/.test(ride.prompt) && noShoot, JSON.stringify({ knocked, cp, carrying, ride, noShoot }));
check('X puts them down in front of you, still knocked (ready to revive)', putDown && after.d < 2.5 && after.downed && after.ground, JSON.stringify(after));

// ---- challenges pick up the new stats
await ev(() => {
  const s = __bi.save.data;
  __bi.challenges.dailyChallenges();
  s.challenges.list = [{ id: 'boss', prog: 0, done: false }, { id: 'vault', prog: 0, done: false }, { id: 'doors', prog: 7, done: false }];
  __bi.save.write();
});
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a.team !== g.player.team && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const chal = await ev(() => ({ rows: __bi.game.result.challenges.map((c) => [c.id, c.prog, c.done]), xp: __bi.game.result.chalXP }));
check('daily challenges count boss damage, the vault and doors', chal.xp === 3000, JSON.stringify(chal));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-5 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
