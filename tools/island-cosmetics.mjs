// Pickaxes, back blings and wraps (Blender-made): the Locker, unlocks, how they
// show in a match, bots wearing them, and a client's cosmetics seen by the host.
// Usage: node tools/island-cosmetics.mjs [url] [shotDir]   (online check needs `npm run island:server`)
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const online = /^http/.test(url);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const waitFor = async (pg, fn, ms = 15000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(fn, arg)) return true; await pg.waitForTimeout(150); } return false; };

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);

// ---- the Locker: three new sections, defaults equipped, locked items explain themselves
await p.click('[data-act=locker]');
await p.waitForTimeout(300);
const lk = await ev(() => {
  const sec = (k) => [...document.querySelectorAll(`.cos[data-kind=${k}]`)];
  const on = (k) => document.querySelector(`.cos.on[data-kind=${k}]`)?.dataset.id;
  return { pk: sec('pickaxe').length, bb: sec('backbling').length, wr: sec('wrap').length, on: [on('pickaxe'), on('backbling'), on('wrap')].join(), locked: sec('pickaxe').filter((x) => x.classList.contains('locked')).length, star: document.querySelector('.cos[data-kind=pickaxe][data-id=star] small').textContent, bolt: document.querySelector('.cos[data-kind=pickaxe][data-id=crankbolt] small').textContent, chest: document.querySelector('.cos[data-kind=backbling][data-id=chest] small').textContent };
});
await p.click('.cos[data-kind=wrap][data-id=gold]');
const lockedMsg = await ev(() => document.querySelector('.adm-msg')?.textContent);
await p.screenshot({ path: `${shots}/cos-01-locker.png` });
check('Locker has 8 pickaxes, 9 back blings and 8 wraps (with the Fright Shop ones); defaults equipped; locked ones say how to unlock (and say it when tapped)', lk.pk === 8 && lk.bb === 9 && lk.wr === 8 && lk.on === 'default,outfit,none' && lk.locked === 7 && /Reach level 12/.test(lk.star) && /Achievement: Bolt Breaker/.test(lk.bolt) && /Find 4 Benton Badges/.test(lk.chest) && /Gold Rush: Achievement: Benton Champion to unlock it/.test(lockedMsg || ''), JSON.stringify({ ...lk, lockedMsg }));

// ---- unlocks: by level, by achievement, by badges
const un = await ev(() => {
  const S = __bi.season, s = __bi.save.data;
  const before = S.owns('pickaxe', 'pickle');
  s.progress.xp = 60000; // a high level
  const lvl = ['pickle', 'wrench', 'lollipop', 'dino', 'star'].every((id) => S.owns('pickaxe', id)) && S.owns('wrap', 'lava') && S.owns('backbling', 'rocket');
  const boltBefore = S.owns('pickaxe', 'crankbolt');
  s.ach = s.ach || { totals: {}, done: {} }; s.ach.done.boss1 = Date.now();
  const bolt = S.owns('pickaxe', 'crankbolt');
  const chestBefore = S.owns('backbling', 'chest');
  s.badges = { found: { baseball: 1, dino: 1, mug: 1, wrench: 1 } };
  const chest = S.owns('backbling', 'chest');
  __bi.save.write();
  return { before, lvl, boltBefore, bolt, chestBefore, chest };
});
check('level unlocks the level items, the Bolt Breaker comes with the boss achievement, the Treasure Chest with 4 badges', !un.before && un.lvl && !un.boltBefore && un.bolt && !un.chestBefore && un.chest, JSON.stringify(un));

// ---- equip by tapping: the preview holds the item
await ev(() => __bi.menus.showLocker());
for (const [k, id] of [['pickaxe', 'pickle'], ['backbling', 'dino'], ['wrap', 'camo']]) {
  await p.click(`.cos[data-kind=${k}][data-id=${id}]`);
  await p.waitForTimeout(150);
}
const eq = await ev(() => __bi.season.equipped(__bi.save.data.profile.character));
await p.waitForTimeout(500);
await p.screenshot({ path: `${shots}/cos-02-equipped.png` });
check('tapping Pickle Pick, Dino Buddy and Camo Crew equips them', eq.pickaxe === 'pickle' && eq.backbling === 'dino' && eq.wrap === 'camo', JSON.stringify(eq));
await p.click('[data-act=main]');

// ---- in a match: back bling on the back, pickaxe in hand, wrapped guns
await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=play]');
await p.waitForTimeout(700);
const m1 = await ev(async () => {
  const g = __bi.game, P = g.player, M = P.model;
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (let i = 0; i < 1500 && !['ground', 'swim'].includes(P.state); i++) __bi.engine.step(1 / 60);
  if (P.state === 'swim') { P.pos.set(0, g.world.physics.groundAt(0, -12, 60).y + 0.05, -12); P.state = 'ground'; P.grounded = true; }
  P.select(-1); __bi.engine.step(1 / 60); P.updateModel?.(0.016, 0);
  for (let i = 0; i < 5; i++) __bi.engine.step(1 / 60);
  const bling = M.bling;
  const meshes = (o) => { let n = 0; o?.traverse((q) => q.isMesh && n++); return n; };
  const pack = M.spine.children.filter((c) => c !== bling && !c.visible).length;
  const pick = M.held && M.held.name;
  P.slots[0] = { kind: 'weapon', id: 'ar', rarity: 3, mag: 30 }; P.select(0); P.equipT = 0;
  for (let i = 0; i < 5; i++) __bi.engine.step(1 / 60);
  let wrapped = 0, kept = 0;
  M.held.traverse((q) => { if (!q.isMesh) return; if (q.material.map) wrapped++; else kept++; });
  return { bling: bling && bling.name, blingMeshes: meshes(bling), packHidden: pack, pick, pickMeshes: meshes(M.held && null), wrapped, kept };
});
await p.waitForTimeout(400);
await p.screenshot({ path: `${shots}/cos-03-match.png` });
check('in a match the Dino Buddy rides on your back (outfit pack hidden), the Pickle Pick is in hand, and guns wear Camo (rarity trim kept)', m1.bling === 'backbling_dino' && m1.blingMeshes > 8 && m1.packHidden >= 1 && m1.pick === 'pickaxe_pickle' && m1.wrapped >= 3 && m1.kept >= 1, JSON.stringify(m1));
const bots = await ev(() => {
  const g = __bi.game;
  const bs = g.actors.filter((a) => a.isBot);
  return { n: bs.length, bling: bs.filter((a) => a.model.bling).length, kinds: new Set(bs.map((a) => a.model.cos.pickaxe)).size };
});
check('bots wear a mix of pickaxes and back blings too', bots.bling >= 5 && bots.kinds >= 3, JSON.stringify(bots));
await ev(() => __bi.toLobby());

// ---- online: a client's cosmetics show on the host
if (online) {
  const C = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  C.on('pageerror', (e) => errors.push('client: ' + e.message));
  await C.goto(url, { waitUntil: 'load' });
  await C.waitForTimeout(1200);
  await C.evaluate(() => { const d = __bi.save.data; d.progress.xp = 60000; d.pass = d.pass || {}; __bi.save.write(); __bi.season.equip('pickaxe', 'star'); __bi.season.equip('backbling', 'rocket'); __bi.season.equip('wrap', 'lava'); __bi.input.lockBlocked = true; });
  await ev(() => (__bi.input.lockBlocked = true));
  await p.click('[data-act=online]');
  await waitFor(p, () => !!document.querySelector('[data-act=host]'));
  await p.click('[data-act=host]');
  await waitFor(p, () => !!document.querySelector('.code'));
  const code = (await p.textContent('.code')).trim().toLowerCase();
  await C.click('[data-act=online]');
  await waitFor(C, (c) => !!document.querySelector(`[data-act=join][data-code="${c}"]`), 15000, code);
  await C.click(`[data-act=join][data-code="${code}"]`);
  await waitFor(p, () => document.querySelectorAll('.player-row').length === 2, 15000);
  await p.click('[data-act=start-online]');
  await waitFor(C, () => __bi.game.role === 'client' && !!__bi.game.world, 15000);
  const seen = await ev(() => { const a = __bi.game.actors[1]; return { cos: a.model.cos, bling: a.model.bling && a.model.bling.name }; });
  const mine = await C.evaluate(() => { const a = __bi.game.actors[0]; return { cos: a.model.cos }; });
  check("online: the host sees the client's Star Scepter, Toy Rocket and Lava Rock (and the client sees the host's)", seen.cos.pickaxe === 'star' && seen.cos.backbling === 'rocket' && seen.cos.wrap === 'lava' && seen.bling === 'backbling_rocket' && mine.cos.pickaxe === 'pickle' && mine.cos.backbling === 'dino', JSON.stringify({ seen, mine }));
}

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} cosmetics checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
