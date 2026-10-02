// Online checks for milestone 5: doors, Crankbolt, carrying a knocked
// teammate, the vault, and crash damage for client-driven vehicles.
// Needs `npm run island:server` and the dev server.
// Usage: node tools/island-online-m5.mjs [url] [shotDir]
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
const same = await C.evaluate(() => { const g = __bi.game; return { doors: g.world.doors.length, boss: g.boss.alive && g.boss.hp, team: g.player.team === g.actors[0].team }; });
check('client joins the Duos match: same doors, Crankbolt at full health, same squad as the host', same.doors >= 12 && same.boss === 2000 && same.team, JSON.stringify(same));

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
});

// ---- a client opens a door; the host and client agree
await H.evaluate(() => {
  const g = __bi.game;
  const d = g.world.doors.filter((q) => Math.abs(g.world.physics.groundAt(q.pos.x, q.pos.z - q.inward * 1.3, q.pos.y + 1).y - q.pos.y) < 0.3)[0];
  window.D = d.i;
  tp(g.actors[1], d.pos.x, d.pos.z - d.inward * 1.3, d.pos.y + 1);
  tp(g.player, d.pos.x + 3, d.pos.z - d.inward * 3, d.pos.y + 1);
});
const Di = await H.evaluate(() => window.D);
await waitFor(C, (i) => /Open door/.test(__bi.game.controller.prompt?.text || ''), 8000, Di);
await key(C, 'KeyE');
const dH = await waitFor(H, (i) => __bi.game.world.doors[i].open, 5000, Di);
const dC = await waitFor(C, (i) => __bi.game.world.doors[i].open, 5000, Di);
check('client presses E at a door: the host opens it and the client sees it open', dH && dC);
await H.evaluate((i) => __bi.game.toggleDoor(i, null), Di);
const shut = await waitFor(C, (i) => !__bi.game.world.doors[i].open, 5000, Di);
check('the host closes it: the client sees it close', shut);

// ---- Crankbolt: the client shoots it, the host takes the damage, the client gets hitmarkers
await H.evaluate(() => {
  const g = __bi.game, B = g.boss, c = g.actors[1];
  c.slots = [{ kind: 'weapon', id: 'ar', rarity: 2, mag: 30 }, null, null, null, null];
  c.ammo.medium = 120;
  c.hp = 1e5; // outlast the rockets for this check
  tp(c, B.pos.x + 12, B.pos.z - 5, B.pos.y + 2);
  tp(g.player, B.pos.x + 60, B.pos.z, 60);
});
await waitFor(C, () => __bi.game.player.slots[0]?.id === 'ar' && Math.hypot(__bi.game.player.pos.x - __bi.game.boss.pos.x, __bi.game.player.pos.z - __bi.game.boss.pos.z) < 20, 8000);
await C.evaluate(() => {
  const g = __bi.game, P = g.player, B = g.boss;
  g.actions.select(0);
  const e = P.eye;
  g.controller.yaw = Math.atan2(-(B.pos.x - P.pos.x), -(B.pos.z - P.pos.z));
  g.controller.pitch = Math.atan2(B.pos.y + 2.5 - e.y, Math.hypot(B.pos.x - P.pos.x, B.pos.z - P.pos.z));
  window.hits = 0;
  const hm = g.hud.hitmarker.bind(g.hud);
  g.hud.hitmarker = (...a) => { window.hits++; return hm(...a); };
});
await C.waitForTimeout(600);
const hp0 = await H.evaluate(() => __bi.game.boss.hp);
await C.mouse.move(480, 270);
await C.mouse.down();
await waitFor(H, (h) => __bi.game.boss.hp < h - 60, 12000, hp0);
await C.mouse.up();
await C.waitForTimeout(800);
const bossH = await H.evaluate(() => ({ hp: __bi.game.boss.hp, stat: __bi.game.actors[1].stats.bossDmg, target: __bi.game.boss.target?.id }));
const bossC = await C.evaluate(() => ({ hp: __bi.game.boss.hp, hits: window.hits, bar: getComputedStyle(document.querySelector('.bossbar')).display }));
await C.screenshot({ path: `${shots}/on5-01-client-boss.png` });
check("the client shoots Crankbolt: the host applies the damage, Crankbolt turns on them, and the client's boss bar and hitmarkers follow", bossH.hp < hp0 && bossH.stat > 0 && bossH.target === 1 && Math.abs(bossC.hp - bossH.hp) < 120 && bossC.hits > 0 && bossC.bar !== 'none', JSON.stringify({ hp0, bossH, bossC }));

// defeat it on the host; the client sees the loot and the killfeed
await H.evaluate(() => { const g = __bi.game; g.applyDamage(g.boss, 99999, g.actors[1], {}); });
const downC = await waitFor(C, () => !__bi.game.boss.alive && __bi.game.loot.pickups.some((k) => k.it.kind === 'key') && __bi.game.loot.pickups.some((k) => k.it.kind === 'weapon' && k.it.rarity === 5), 8000);
check('Crankbolt goes down: the client sees it vanish and the keycard + Mythic rifle drop', downC);

// ---- the client picks up the keycard and opens the vault
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1];
  c.hp = 100;
  const k = g.loot.pickups.find((q) => q.it.kind === 'key');
  c.slots[1] = { kind: 'key', id: 'vault', count: 1 };
  g.loot.remove(k);
  const V = g.world.vault;
  tp(c, V.pos.x, V.pos.z + 2, V.pos.y + 1);
});
await waitFor(C, () => /Open Crankbolt's Vault/.test(__bi.game.controller.prompt?.text || ''), 8000);
await key(C, 'KeyE');
const vH = await waitFor(H, () => __bi.game.world.vault.open && !__bi.game.actors[1].slots.some((s) => s && s.kind === 'key'), 5000);
const vC = await waitFor(C, () => __bi.game.world.vault.open && !__bi.game.player.slots.some((s) => s && s.kind === 'key'), 5000);
check('the client opens the vault with the keycard: the host opens it (keycard used up) and the client sees it open', vH && vC);

// ---- carrying: the host is knocked, the client carries them and puts them down
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1], P = g.player;
  let f = null;
  for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) f = { x, z }; }
  window.CF = f;
  tp(c, f.x, f.z);
  tp(P, f.x + 1.2, f.z);
  P.hp = 1; P.shield = 0;
  const foe = g.actors.find((a) => a.brain && a.team !== P.team);
  g.applyDamage(P, 10, foe, {});
});
await waitFor(C, () => __bi.game.actors[0].downed && /X to carry/.test(__bi.game.controller.prompt?.text || ''), 8000);
await key(C, 'KeyX');
const carriedH = await waitFor(H, () => __bi.game.actors[1].carrying === __bi.game.player && __bi.game.player.carriedBy === __bi.game.actors[1], 5000);
const carriedC = await waitFor(C, () => __bi.game.player.carrying === __bi.game.actors[0], 5000);
await C.evaluate(() => (__bi.game.controller.yaw = 0));
const z0 = await H.evaluate(() => __bi.game.player.pos.z);
await C.keyboard.down('KeyW');
await waitFor(H, (z) => z - __bi.game.player.pos.z > 2, 10000, z0);
await C.keyboard.up('KeyW');
await C.waitForTimeout(500);
const ride = await H.evaluate((z) => { const P = __bi.game.player, c = __bi.game.actors[1]; return { moved: +(z - P.pos.z).toFixed(2), onTop: +(P.pos.y - c.pos.y).toFixed(2), xz: +Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z).toFixed(2) }; }, z0);
check("the client presses X next to the knocked host: they carry them, and the host's character rides along as the client walks", carriedH && carriedC && ride.moved > 2 && ride.onTop > 0.8 && ride.xz < 0.5, JSON.stringify({ carriedH, carriedC, ride }));
await key(C, 'KeyX');
const dropped = await waitFor(H, () => !__bi.game.actors[1].carrying && !__bi.game.player.carriedBy && __bi.game.player.downed, 5000);
check('X again: the host is put down, still knocked', dropped);
await H.evaluate(() => { const g = __bi.game; g.teams.revive(g.player, g.actors[1]); });

// ---- crash damage for a client-driven truck
await H.evaluate(() => {
  const g = __bi.game, c = g.actors[1], v = g.vehicles.list[0];
  let f = null;
  for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2 || g.world.physics.query(x - 9, z - 30, x + 9, z + 8).some((q) => q.kind !== 'tree' && q.kind !== 'rock')) continue;
    let dev = 0;
    for (const [dx, dz] of [[-8, -28], [8, -28], [-8, 6], [8, 6], [0, -14], [-3, 0]]) dev = Math.max(dev, Math.abs(g.world.height(x + dx, z + dz) - h));
    if (dev < 1.5 && (!f || dev < f.dev)) f = { x, z, dev };
  }
  window.CF = f;
  for (const col of [...g.world.physics.query(f.x - 8, f.z - 40, f.x + 8, f.z + 6)]) if (col.kind === 'tree' || col.kind === 'rock') g.world.destroyCollider(col);
  v.pos.set(f.x, g.world.height(f.x, f.z), f.z); v.yaw = 0; v.speed = 0; v.dirty = true; g.vehicles._sync(v, true);
  g.world.box(f.x - 6, v.pos.y - 1, f.z - 24, f.x + 6, v.pos.y + 5, f.z - 23, { color: '#888' });
  window.wallZ = f.z - 23;
  tp(c, f.x - 2.6, f.z);
  window.vhp0 = v.hp;
});
// the client needs the same wall (built outside the network for the test)
await C.evaluate((f) => { const g = __bi.game; const y = g.world.height(f.x, f.z); g.world.box(f.x - 6, y - 1, f.z - 24, f.x + 6, y + 5, f.z - 23, { color: '#888' }); for (const col of [...g.world.physics.query(f.x - 8, f.z - 40, f.x + 8, f.z + 6)]) if (col.kind === 'tree' || col.kind === 'rock') g.world.destroyCollider(col); }, await H.evaluate(() => window.CF));
const dprompt = await waitFor(C, () => /Drive Diesel Truck/.test(__bi.game.controller.prompt?.text || ''), 8000);
await key(C, 'KeyE');
const seated = await waitFor(C, () => __bi.game.player.vehicle && __bi.game.player.seat === 0, 5000);
await C.evaluate(() => (__bi.game.controller.yaw = 0));
await C.keyboard.down('KeyW');
await waitFor(H, () => __bi.game.vehicles.list[0].hp < window.vhp0, 20000);
await C.keyboard.up('KeyW');
const crash = await H.evaluate(() => ({ hp: Math.round(__bi.game.vehicles.list[0].hp), hp0: window.vhp0, z: +(__bi.game.vehicles.list[0].pos.z - window.wallZ).toFixed(1) }));
check("a client crashing their truck into a wall at speed damages it on the host", crash.hp < crash.hp0 && crash.z > 0, JSON.stringify(crash));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} online milestone-5 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
