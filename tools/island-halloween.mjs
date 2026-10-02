// Halloween update checks: the Haunt Hollow expansion (Grimstone Manor), Candy
// Corn (temporary currency), the Fright Shop and the Blood set, the Halloween
// items, and Halloween online. Usage: node tools/island-halloween.mjs [url] [shotDir]
// (the online checks need `npm run island:server` and an http url)
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

// ---- off by default in a test browser; the owner can force it on
const off = await ev(() => ({ on: __bi.halloween.halloweenOn(), card: !!document.querySelector('.hw-card') }));
await ev(() => { __bi.halloween.setHalloweenForce('on'); __bi.menus.showMain(); });
const card = await ev(() => document.querySelector('.hw-card')?.textContent.replace(/\s+/g, ' ').trim());
check('Halloween is off in test browsers until forced; then the lobby shows the Halloween card with Candy Corn and the Fright Shop', !off.on && !off.card && /Halloween/.test(card || '') && /Fright Shop/.test(card || ''), JSON.stringify({ off, card }));

// ---- the map: Grimstone Manor on new land past Haunt Hollow
const map = await ev(() => {
  __bi.input.lockBlocked = true;
  __bi.play();
  const g = __bi.game, W = g.world, M = W.pois.find((q) => q.id === 'manor'), H = W.pois.find((q) => q.id === 'hollow');
  const land = [0.4, 0.7, 1].map((k) => +W.height(M.x * k + H.x * (1 - k), M.z * k + H.z * (1 - k)).toFixed(1));
  const chests = W.chests.filter((c) => c && Math.hypot(c.pos.x - M.x, c.pos.z - M.z) < 20);
  return { name: M.name, dist: Math.round(Math.hypot(M.x, M.z)), land, poi: W.poiAt(M.x + 2, M.z + 2)?.name, chests: chests.length, legendaryRoof: chests.some((c) => c.legendary && c.pos.y > M.h + 9), road: W.onRoad(-92, -96), patch: !!W.pumpkinPatch, doors: W.doors.filter((d) => Math.hypot(d.pos.x - M.x, d.pos.z - M.z) < 12).length };
});
check('the map grows past Haunt Hollow: Grimstone Manor on new land (3 floors, legendary chest on the roof, doors, a road, a pumpkin patch)', map.name === 'Grimstone Manor' && map.dist > 150 && map.land.every((h) => h > 2) && map.poi === 'Grimstone Manor' && map.chests >= 3 && map.legendaryRoof && map.road && map.patch && map.doors === 2, JSON.stringify(map));

// ---- a Halloween match: candy pumpkins, Candy Corn pickups, decorations, HUD
await p.waitForTimeout(500);
const m0 = await ev(() => {
  const g = __bi.game, W = g.world;
  window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (const a of g.actors) if (a.brain) { a.brain._upd = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; a.hp = 1e6; }
  window.put = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; };
  g.storm.update = () => {};
  const M = W.pois.find((q) => q.id === 'manor');
  put(g.player, M.x + 6, M.z + 33);
  g.controller.yaw = 0; g.controller.pitch = 0.05;
  step(0.3);
  const F = g.halloweenFx;
  return { on: g.halloween, pumpkins: F.pumpkins.length, ghosts: F.ghosts.length, candyLoot: g.loot.pickups.filter((k) => k.it.kind === 'coin' && k.it.id === 'candy').length, hwLoot: g.loot.pickups.filter((k) => ['ghost', 'candybar', 'pumpkin'].includes(k.it.id)).length };
});
await p.waitForTimeout(500);
await p.screenshot({ path: `${shots}/hw-01-manor.png` });
check('a Halloween match has 25+ candy pumpkins (the Manor patch and around the Hollow), drifting ghosts, and Candy Corn and Halloween loot on the floor', m0.on && m0.pumpkins >= 25 && m0.ghosts === 6 && m0.candyLoot + m0.hwLoot >= 5, JSON.stringify(m0));

const m1 = await ev(() => {
  const g = __bi.game, P = g.player, F = g.halloweenFx;
  const pk = F.pumpkins.find((c) => c.alive);
  const c0 = P.stats.candy;
  g.damageCollider(pk, 999, P);
  step(0.2);
  const afterSmash = P.stats.candy - c0;
  // walk over a Candy Corn pickup
  // walking over a pile of Candy Corn on open ground (the floor loot itself is checked above)
  let f = null;
  for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 5, z - 5, x + 5, z + 5).length && Math.abs(g.world.height(x + 3, z) - h) < 0.3) f = { x, z, h }; }
  put(P, f.x - 4, f.z);
  const cc = g.loot.drop({ kind: 'coin', id: 'candy', count: 15 }, new P.pos.constructor(f.x, f.h + 0.5, f.z), null, true);
  cc.age = 1;
  const amount = cc.it.count;
  put(P, cc.pos.x, cc.pos.z, cc.pos.y + 2);
  step(1.2);
  return { afterSmash, picked: P.stats.candy - c0 - afterSmash, amount, bucks: P.bucks };
});
await waitFor(p, () => getComputedStyle(document.querySelector('.candy-pill')).display !== 'none' && +document.querySelector('.candy-pill b').textContent > 0, 5000);
const pill = await ev(() => document.querySelector('.candy-pill b').textContent);
check('smashing a candy pumpkin gives +10 Candy Corn, walking over Candy Corn picks it up, and the HUD counts it', m1.afterSmash === 10 && m1.picked === m1.amount && +pill === 10 + m1.amount, JSON.stringify({ ...m1, pill }));

// ---- the new items
const it = await ev(() => {
  const g = __bi.game, P = g.player;
  // open, flat ground (nothing in the line of fire)
  let f = null;
  for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 8, z - 18, x + 8, z + 4).length && Math.abs(g.world.height(x, z - 10) - h) < 0.4) f = { x, z }; }
  put(P, f.x, f.z);
  g.controller.yaw = 0;
  const foe = g.actors.find((a) => a.brain && a.alive);
  foe.hp = 100; foe.shield = 0;
  put(foe, P.pos.x, P.pos.z - 10);
  // Pumpkin Launcher
  P.slots = [{ kind: 'weapon', id: 'pumpkin', rarity: 2, mag: 2 }, { kind: 'consumable', id: 'ghost', count: 1 }, { kind: 'consumable', id: 'candybar', count: 2 }, null, null];
  P.ammo.rockets = 6;
  P.select(0); P.equipT = 0; P.fireCd = 0;
  const e = P.eye, t = foe.pos.clone().setY(foe.pos.y + 0.3); // at their feet: the blast does the rest
  const dir = t.sub(e).normalize(); // it arcs down a little: aim at the chest
  g.combat.fire(P, dir);
  const pumpkinShot = g.combat.projectiles.length && !!g.combat.projectiles[0].w.projectile.pumpkin;
  step(2);
  const hit = foe.hp < 100;
  // Candy Bar
  P.hp = 50; P.select(2); P.equipT = 0; P.startUse(); step(1.3);
  const healed = P.hp;
  // Ghost Potion
  P.select(1); P.equipT = 0; P.startUse(); step(1.5);
  const ghost = P.buffs.ghost > 0;
  const see = P.model.mats[0].opacity;
  // a bot 20m away doesn't spot a ghost
  const bot = g.actors.find((a) => a.brain && a.alive && a !== foe);
  put(bot, P.pos.x + 20, P.pos.z);
  bot.brain.update = bot.brain._upd; bot.brain.enemy = null; bot.lastHitBy = null;
  bot.aimYaw = Math.atan2(20, 0); // facing the player
  bot.brain._perceive();
  const spotted = bot.brain.enemy === P;
  return { pumpkinShot, hit, healed, ghost, see, spotted };
});
check('Pumpkin Launcher lobs an exploding pumpkin, Candy Bar heals 20, Ghost Potion makes you see-through and bots lose you from 20 m', it.pumpkinShot && it.hit && it.healed === 70 && it.ghost && it.see < 0.5 && !it.spotted, JSON.stringify(it));

// ---- the result banks Candy Corn (temporary currency)
const before = await ev(() => __bi.halloween.candy());
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { if (a.vehicle) g.vehicles.exit(a); a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const res = await ev(() => { const r = __bi.game.result; return { candy: r.candy, kills: r.kills, ms: __bi.game.player.stats.candy, wallet: __bi.halloween.candy(), line: [...document.querySelectorAll('.sx-won')].map((e) => e.textContent).find((t) => /Candy Corn/.test(t)) }; });
check('the result adds pickups + pumpkins + 5 per elimination + 25 for the win to your Candy Corn', res.candy === res.ms + res.kills * 5 + 25 && res.wallet === before + res.candy && /\+[\d,]+ Candy Corn for the Fright Shop/.test(res.line || ''), JSON.stringify({ before, ...res }));
await ev(() => __bi.toLobby());

// ---- the Fright Shop
await p.click('[data-act=fright]');
await p.waitForTimeout(300);
const shop0 = await ev(() => ({ items: document.querySelectorAll('.fs-item').length, names: [...document.querySelectorAll('.fs-item b')].map((e) => e.textContent).join(', '), soon: /coming soon/.test(document.querySelector('.fright').textContent) }));
await p.click('[data-act=fright-buy][data-kind=outfit][data-id=slimer]');
const poor = await ev(() => ({ msg: document.querySelector('.adm-msg')?.textContent, owns: __bi.halloween.ownsHalloween('outfit', 'slimer') }));
await ev(() => { __bi.halloween.adminCandy(4000); __bi.menus.showFright(); });
const c0 = await ev(() => __bi.halloween.candy());
await p.click('[data-act=fright-buy][data-kind=outfit][data-id=slimer]');
await p.click('[data-act=fright-buy][data-kind=pickaxe][data-id=bloodsmasher]');
await p.click('[data-act=fright-buy][data-kind=backbling][data-id=bloodshield]');
await p.click('[data-act=fright-buy][data-kind=wrap][data-id=blood]');
const shop1 = await ev(() => ({ owned: document.querySelectorAll('.fs-item.own').length, candy: __bi.halloween.candy(), msg: document.querySelector('.adm-msg')?.textContent }));
await p.screenshot({ path: `${shots}/hw-02-shop.png` });
check('the Fright Shop sells the Blood set and more (with a "coming soon" note); too little candy is refused; buying spends it', shop0.items === 6 && /Blood Slimer/.test(shop0.names) && /Blood Smasher/.test(shop0.names) && /Blood Shield/.test(shop0.names) && /Blood Wrap/.test(shop0.names) && shop0.soon && /Not enough Candy Corn/.test(poor.msg || '') && !poor.owns && shop1.owned === 4 && shop1.candy === c0 - 3300, JSON.stringify({ shop0, poor, c0, shop1 }));

// ---- the Locker: the Blood Slimer works on every kid; the Blood set equips
await p.click('[data-act=locker]');
await p.waitForTimeout(300);
const slimerIdx = await ev(() => [...document.querySelectorAll('.outfit')].findIndex((o) => /Blood Slimer/.test(o.textContent)));
await p.click(`.outfit[data-id="${slimerIdx}"]`);
for (const [k, id] of [['pickaxe', 'bloodsmasher'], ['backbling', 'bloodshield'], ['wrap', 'blood']]) await p.click(`.cos[data-kind=${k}][data-id=${id}]`);
await p.waitForTimeout(500);
const lk = await ev(() => {
  const P = __bi.save.data.profile, eq = __bi.season.equipped(P.character);
  const all = ['colton', 'emerson', 'waylon'].every((c) => __bi.menus.outfitUnlocked(c, 4));
  return { outfit: P.outfits[P.character], eq: [eq.pickaxe, eq.backbling, eq.wrap].join(), all, bats: document.querySelector('.cos[data-kind=glider][data-id=bats] small')?.textContent };
});
await p.screenshot({ path: `${shots}/hw-03-locker.png` });
check('Locker: Blood Slimer unlocked for all three kids and equipped, with the Blood Smasher, Blood Shield and Blood Wrap; the Bat Swarm glider points to the shop', lk.outfit === slimerIdx && lk.eq === 'bloodsmasher,bloodshield,blood' && lk.all && /Fright Shop · 400 Candy Corn/.test(lk.bats || ''), JSON.stringify({ slimerIdx, ...lk }));
await p.click('[data-act=main]');

// ---- in a match the costume shows (head swapped, claws), and bots never wear shop items
await p.click('[data-act=play]');
await p.waitForTimeout(700);
const look = await ev(() => {
  const g = __bi.game, M = g.player.model;
  const hidden = M.head.children.filter((c) => !c.visible).length;
  const bots = g.actors.filter((a) => a.isBot);
  return { tall: M.body.scale.y, hidden, bling: M.bling?.name, shopOnBots: bots.filter((a) => ['bloodsmasher'].includes(a.model.cos.pickaxe) || ['bloodshield', 'jackolantern'].includes(a.model.cos.backbling) || a.model.cos.wrap === 'blood').length };
});
check('in a match you are the tall Blood Slimer (kid head hidden) with the Blood Shield; bots never wear Fright Shop items', look.tall > 1.1 && look.hidden >= 5 && look.bling === 'backbling_bloodshield' && look.shopOnBots === 0, JSON.stringify(look));
await ev(() => __bi.toLobby());

// ---- candy is temporary: gone after the event (or next year); purchases stay
const exp = await ev(() => {
  const H = __bi.save.data.halloween;
  H.candy = 777; H.year = 2025; // last year's candy
  const lastYear = __bi.halloween.candy();
  __bi.halloween.setHalloweenForce('off');
  __bi.menus.showMain();
  const P = __bi.save.data.profile;
  return { lastYear, card: !!document.querySelector('.hw-card'), owns: __bi.halloween.ownsHalloween('outfit', 'slimer'), stillWorn: __bi.menus.outfitUnlocked(P.character, 4), shopClosed: __bi.halloween.buyHalloween('glider', 'bats').text };
});
check("Candy Corn is temporary (last year's candy is gone; the card disappears when Halloween is off) but bought items stay yours", exp.lastYear === 0 && !exp.card && exp.owns && exp.stillWorn && /closed until next Halloween/.test(exp.shopClosed), JSON.stringify(exp));
await ev(() => __bi.halloween.setHalloweenForce('on'));

// ---- online: the host's Halloween reaches the client, and the client's candy and costume work
if (online) {
  const C = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  C.on('pageerror', (e) => errors.push('client: ' + e.message));
  await C.goto(url, { waitUntil: 'load' });
  await C.waitForTimeout(1200);
  await C.evaluate(() => { __bi.halloween.setHalloweenForce('on'); __bi.halloween.ownAllHalloween(); const P = __bi.save.data.profile; P.character = 'emerson'; P.outfits.emerson = 4; __bi.save.write(); __bi.input.lockBlocked = true; });
  await ev(() => { __bi.input.lockBlocked = true; __bi.menus.showMain(); });
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
  const cl = await C.evaluate(() => ({ on: __bi.game.halloween, pumpkins: __bi.game.halloweenFx.pumpkins.length, manor: !!__bi.game.world.pois.find((q) => q.id === 'manor') }));
  const hostSees = await ev(() => { const a = __bi.game.actors[1]; return { tall: a.model.body.scale.y, outfit: a.outfit ?? null }; });
  const hp = await ev(() => __bi.game.halloweenFx.pumpkins.length);
  check("online: the host's Halloween (Manor, same candy pumpkins) reaches the client, and the host sees the client's Blood Slimer", cl.on && cl.manor && cl.pumpkins === hp && hostSees.tall > 1.1, JSON.stringify({ cl, hp, hostSees }));
  // the client smashes a pumpkin (credited by the host) and sees its candy on the HUD
  await waitFor(C, () => __bi.game.busT > 1.8, 20000);
  await C.keyboard.press('Space'); await p.keyboard.press('Space');
  await waitFor(p, () => __bi.game.actors[1].state !== 'bus', 8000);
  const ci = await ev(() => { const g = __bi.game; const c = g.halloweenFx.pumpkins.find((q) => q.alive); g.damageCollider(c, 999, g.actors[1]); return g.halloweenFx.pumpkins.indexOf(c); });
  const gone = await waitFor(C, (i) => !__bi.game.halloweenFx.pumpkins[i].alive, 8000, ci);
  const hud = await waitFor(C, () => __bi.game.player.stats.candy === 10 && document.querySelector('.candy-pill b').textContent === '10', 8000);
  check('online: a pumpkin the client smashes vanishes for them and its +10 Candy Corn shows on their HUD', gone && hud, JSON.stringify({ gone, hud }));
}

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} halloween checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
