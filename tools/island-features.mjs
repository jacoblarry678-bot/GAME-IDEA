// Focused checks for mechanics the main playtest does not cover:
// Zero Build, bounce pads, Boom barrels, supply drops, mantling, fall damage,
// sniper scope and swimming. Uses engine.step() for deterministic timing.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);

await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.click('[data-act=mode][data-id=zerobuild]');
await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=play]');
await p.waitForTimeout(800);

// common setup: everyone lands, bots idle, player on open ground
await ev(() => {
  const g = __bi.game;
  window.step = (s) => { for (let i = 0; i < s * 60; i++) __bi.engine.step(1 / 60); };
  for (const a of g.actors) {
    if (a.brain) a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; };
    a.state = 'ground';
    a.pos.set(-150 + a.id, 0, 150); // park bots far away on the beach corner
  }
  g.bus.visible = false;
  window.put = (a, x, z, dy = 0) => { a.pos.set(x, g.world.height(x, z) + dy, z); a.vel.set(0, 0, 0); a.state = dy > 0.5 ? 'air' : 'ground'; a.grounded = false; };
});

const zb = await ev(() => {
  const g = __bi.game, P = g.player;
  const r = { mode: g.mode, over: P.overshield, max: P.overshieldMax };
  put(P, 5, -30);
  step(0.2);
  g.applyDamage(P, 30, g.actors[1], {});
  r.afterHit = [P.overshield, P.shield, P.hp];
  step(3);
  r.noRegenYet = P.overshield;
  step(6);
  r.regen = Math.round(P.overshield);
  g.controller.building = false;
  return r;
});
check('Zero Build: overshield absorbs damage, then regenerates after 6s', zb.mode === 'zerobuild' && zb.afterHit[0] === 20 && zb.afterHit[2] === 100 && zb.noRegenYet === 20 && zb.regen === 50, JSON.stringify(zb));
await p.keyboard.press('KeyB');
await p.waitForTimeout(400);
check('Zero Build: B does not enter build mode', await ev(() => !__bi.game.controller.building));

const pad = await ev(() => {
  const g = __bi.game, P = g.player;
  const pc = [...g.world.physics.colliders].find((c) => c.kind === 'pad');
  const x = (pc.minX + pc.maxX) / 2, z = (pc.minZ + pc.maxZ) / 2;
  P.pos.set(x, pc.maxY + 1.2, z);
  P.vel.set(0, 0, 0);
  P.state = 'air';
  let maxY = 0, glided = false, sawSky = false;
  for (let i = 0; i < 60 * 12; i++) {
    // steer away from the pad (landing back on it bounces you again, by design)
    if (i === 90) __bi.input.keys.add('KeyD');
    __bi.engine.step(1 / 60);
    maxY = Math.max(maxY, P.pos.y - pc.maxY);
    if (P.state === 'skydive') sawSky = true;
    if (P.state === 'glide') glided = true;
    if (P.state === 'ground' && i > 120) break;
  }
  __bi.input.keys.delete('KeyD');
  return { height: Math.round(maxY), sawSky, glided, end: P.state, hp: P.hp, redeploy: P.canRedeploy };
});
check('Bounce pad launches, glider deploys, safe landing', pad.height > 15 && pad.sawSky && pad.glided && pad.end === 'ground' && pad.hp === 100, JSON.stringify(pad));

const fall = await ev(() => {
  const g = __bi.game, P = g.player;
  P.hp = 100; P.shield = 0; P.overshield = 0; P.overshieldMax = 0;
  put(P, 5, -30, 14);
  for (let i = 0; i < 240 && P.state !== 'ground'; i++) __bi.engine.step(1 / 60);
  step(0.2);
  const hp14 = P.hp;
  P.hp = 100;
  put(P, 5, -30, 3);
  for (let i = 0; i < 240 && P.state !== 'ground'; i++) __bi.engine.step(1 / 60);
  step(0.2);
  return { hp14, hp3: P.hp };
});
check('Fall damage from a 14m drop but not from 3m', fall.hp14 < 100 && fall.hp14 > 0 && fall.hp3 === 100, JSON.stringify(fall));

const barrel = await ev(() => {
  const g = __bi.game, P = g.player;
  const bc = [...g.world.physics.colliders].find((c) => c.kind === 'barrel' && c.alive);
  const x = (bc.minX + bc.maxX) / 2, z = (bc.minZ + bc.maxZ) / 2;
  const bot = g.actors[2];
  put(bot, x + 2, z);
  bot.hp = 100; bot.shield = 0; bot.overshield = 0;
  g.damageCollider(bc, 100, P);
  step(0.1);
  return { barrelGone: !bc.alive, botHp: bot.hp };
});
check('Shooting a Boom barrel explodes and hurts nearby players', barrel.barrelGone && barrel.botHp < 100, JSON.stringify(barrel));

const mantle = await ev(() => {
  const g = __bi.game, P = g.player;
  // a 1.6m crate stack face: find a container at the Depot and run into it
  const c = [...g.world.physics.colliders].find((k) => k.kind === 'static' && k.type === 'box' && k.material === 'metal' && k.maxY - k.minY > 2.4 && k.maxY - k.minY < 2.8 && (k.maxX - k.minX) > 5 && k.minY - g.world.height((k.minX + k.maxX) / 2, k.minZ - 1.5) < 0.4
    && ![...g.world.physics.colliders].some((o) => o !== k && Math.abs(o.minY - k.maxY) < 0.2 && o.minX < k.maxX && o.maxX > k.minX && o.minZ < k.maxZ && o.maxZ > k.minZ));
  const x = (c.minX + c.maxX) / 2, z = c.minZ - 1.5;
  put(P, x, z);
  step(0.3);
  const y0 = P.pos.y;
  let mantled = false, maxY = y0;
  for (let i = 0; i < 90; i++) {
    const inp = { mx: 0, mz: 1, jump: i === 5, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false };
    P.move(1 / 60, inp);
    if (P.state === 'mantle') mantled = true;
    maxY = Math.max(maxY, P.pos.y);
  }
  return { mantled, climbed: +(maxY - y0).toFixed(2), top: +(c.maxY - y0).toFixed(2) };
});
check('Mantle onto a ledge by jumping into it', mantle.mantled && mantle.climbed > 2, JSON.stringify(mantle));

const swim = await ev(() => {
  const g = __bi.game, P = g.player;
  const pond = { x: 90, z: 84 };
  put(P, pond.x, pond.z, 2);
  step(1.5);
  const st = P.state;
  const inp = { mx: 1, mz: 0, jump: false, sprint: true, crouch: false, slide: false, glide: false, dive: 0, ads: false };
  for (let i = 0; i < 60 * 8 && P.state === 'swim'; i++) P.move(1 / 60, inp);
  return { st, out: P.state };
});
check('Swimming in the Pickles Park pond and climbing out', swim.st === 'swim' && swim.out !== 'swim', JSON.stringify(swim));

const supply = await ev(() => {
  const g = __bi.game;
  const n0 = g.world.chests.length;
  g.loot.supplyDrop(5, -30);
  step(20);
  const ch = g.world.chests[g.world.chests.length - 1];
  return { added: g.world.chests.length - n0, supply: !!ch.supply };
});
check('Supply drop floats down and becomes an openable crate', supply.added === 1 && supply.supply, JSON.stringify(supply));

const scope = await ev(() => {
  const g = __bi.game, P = g.player;
  put(P, 5, -30);
  P.slots[0] = { kind: 'weapon', id: 'sniper', rarity: 3, mag: 1 };
  P.ammo.heavy = 10;
  P.select(0);
  step(0.5);
  return true;
});
await p.mouse.move(480, 270);
await p.mouse.down({ button: 'right' });
for (let i = 0; i < 40 && (await ev(() => __bi.game.camera.fov)) > 25; i++) await p.waitForTimeout(250);
const scoped = await ev(() => ({ ads: __bi.game.player.ads, fov: Math.round(__bi.game.camera.fov), scope: getComputedStyle(document.querySelector('.scope')).display }));
await p.screenshot({ path: (process.argv[3] || '.') + '/12-scope.png' });
await p.mouse.up({ button: 'right' });
check('Sniper ADS zooms and shows the scope overlay', scope && scoped.ads && scoped.fov < 30 && scoped.scope === 'block', JSON.stringify(scoped));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} feature checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
