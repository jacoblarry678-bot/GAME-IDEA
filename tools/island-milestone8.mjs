// Milestone 8 checks: weapon attachments, the hidden Benton Badges and the
// rotating island events, driven through the real game.
// Usage: node tools/island-milestone8.mjs [url] [shotDir]
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
const frames = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const key = async (k, ms = 120) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await frames(); };

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);
await ev(() => (__bi.input.lockBlocked = true));

/** Starts a solo match (event: an id, or null for classic) and lands the player with frozen bots far away. */
async function match(event) {
  await ev((event) => {
    const P = __bi.save.data.profile;
    P.event = !!event;
    P.eventPick = event || null;
    P.ranked = false;
    __bi.save.write();
    if (__bi.game.world) __bi.toLobby();
    __bi.play();
  }, event);
  await p.waitForTimeout(500);
  await ev(() => {
    const g = __bi.game;
    window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
    while (g.busT < 1.8) __bi.engine.step(1 / 60);
    g.jumpFromBus(g.player);
    for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; a.hp = 1e6; }
    window.put = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; };
    // open flat ground away from everything
    let f = null;
    for (let x = -100; x <= 100 && !f; x += 3) for (let z = -100; z <= 100 && !f; z += 3) { const h = g.world.height(x, z); if (h > 2 && !g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) f = { x, z }; }
    window.F = f;
    put(g.player, f.x, f.z);
    g.player.hp = 100; g.player.shield = 100;
    g.storm.update = () => {};
    step(0.3);
  });
}

// ================================================================ attachments
await match(null);
const a0 = await ev(() => {
  const g = __bi.game, P = g.player;
  P.slots = [{ kind: 'weapon', id: 'ar', rarity: 2, mag: 30 }, { kind: 'weapon', id: 'shotgun', rarity: 1, mag: 5 }, null, null, null];
  P.ammo.medium = 200;
  P.select(0); P.equipT = 0;
  g.controller.yaw = 0; g.controller.pitch = 0;
  window.dropMod = (id) => g.loot.drop({ kind: 'mod', id, count: 1 }, new P.pos.constructor(P.pos.x, P.pos.y + 0.3, P.pos.z - 1.2), null, true);
  window.PK = dropMod('scope');
  step(0.3);
  return { rows: g.loot.pickups.filter((k) => k.it.kind === 'mod').length };
});
await waitFor(() => /Attach 4x Scope to Thunder Rifle/.test(__bi.game.controller.prompt?.text || ''), 5000);
const prompt = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
await waitFor(() => (__bi.game.player.slots[0].mods || []).includes('scope'), 3000);
const a1 = await ev(() => { const P = __bi.game.player, w = P.weapon; return { mods: P.slots[0].mods, zoom: w.zoom, scope: !!w.scope, ads: +w.ads.toFixed(4), base: 0.006, gone: !__bi.game.loot.pickups.includes(PK) }; });
check('E on a 4x Scope attaches it to the held rifle: 3x zoom, scoped, tighter aim', /Attach 4x Scope to Thunder Rifle/.test(prompt) && a1.mods.join() === 'scope' && a1.zoom === 3 && a1.scope && a1.ads < a1.base && a1.gone, JSON.stringify({ prompt, ...a1 }));

// aiming down sights with the scope shows the scope overlay
await p.mouse.move(550, 310);
await p.mouse.down({ button: 'right' });
const scoped = await waitFor(() => getComputedStyle(document.querySelector('.scope')).display === 'block', 5000);
await p.screenshot({ path: `${shots}/m8-01-scope.png` });
await p.mouse.up({ button: 'right' });
const dots = await ev(() => document.querySelectorAll('.slot .slot-mods u').length);
check('right-click aims through the scope; the slot shows an attachment dot', scoped && dots === 1, JSON.stringify({ scoped, dots }));

// a red dot replaces the scope (same optic slot): the scope drops back on the ground
await ev(() => { window.PK = dropMod('dot'); step(0.3); });
await waitFor(() => /Attach Red Dot Sight/.test(__bi.game.controller.prompt?.text || ''), 5000);
await key('KeyE');
await waitFor(() => (__bi.game.player.slots[0].mods || []).includes('dot'), 3000);
await p.waitForTimeout(400);
const a2 = await ev(() => { const g = __bi.game, P = g.player; return { mods: P.slots[0].mods.join(), zoom: P.weapon.zoom, scopeBack: g.loot.pickups.some((k) => k.it.kind === 'mod' && k.it.id === 'scope') }; });
check('a Red Dot swaps out the 4x Scope (one optic per gun); the scope drops for someone else', a2.mods === 'dot' && a2.zoom === 1.6 && a2.scopeBack, JSON.stringify(a2));

// drum mag + grip; a choke goes on the shotgun even while holding the rifle
const a3 = await ev(() => {
  const g = __bi.game, P = g.player;
  for (const k of [...g.loot.pickups]) if (k.it.kind === 'mod') g.loot.remove(k);
  const take = (id) => { const pk = dropMod(id); return g.loot.take(P, pk); };
  const r = [take('drum'), take('grip'), take('choke')];
  const w = P.weapon;
  P.slots[0].mag = 0; P.startReload(); step(3);
  return { r, ar: P.slots[0].mods.slice().sort().join(), sg: (P.slots[1].mods || []).join(), mag: P.slots[0].mag, recoil: +w.recoil.toFixed(4), baseRecoil: 0.014 };
});
check('Drum Mag reloads to 45 rounds, Steady Grip cuts recoil, and a Tight Choke fits only the shotgun (goes there)', a3.r.join() === 'ok,ok,ok' && a3.ar === 'dot,drum,grip' && a3.sg === 'choke' && a3.mag === 45 && a3.recoil < a3.baseRecoil * 0.6, JSON.stringify(a3));

// nothing to put it on
await ev(() => { const P = __bi.game.player; window.saved = P.slots; P.slots = [{ kind: 'weapon', id: 'launcher', rarity: 2, mag: 1 }, null, null, null, null]; P.select(0); window.PK = dropMod('scope'); step(0.3); });
await waitFor(() => /no gun it fits/.test(__bi.game.controller.prompt?.text || ''), 5000);
const nofit = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
const stayed = await ev(() => __bi.game.loot.pickups.includes(PK));
check("an attachment with no gun it fits says which guns take it, and E doesn't grab it", /4x Scope: no gun it fits \(Assault Rifle, SMG, Pistol\)/.test(nofit) && stayed, nofit);

// dropping the gun keeps its attachments
const a4 = await ev(() => {
  const g = __bi.game, P = g.player;
  g.loot.remove(PK);
  P.slots = window.saved; P.select(0);
  g.loot.dropSelected(P);
  step(1);
  const pk = [...g.loot.pickups].reverse().find((k) => k.it.kind === 'weapon' && k.it.id === 'ar'); // the one just dropped
  return { mods: pk && pk.it.mods.slice().sort().join(), meshes: pk && pk.model.children.length, plain: __bi.game.loot.drop({ kind: 'weapon', id: 'ar', rarity: 0, mag: 30 }, P.pos.clone()).model.children.length };
});
check('a dropped gun keeps its attachments (and shows them on the model)', a4.mods === 'dot,drum,grip' && a4.meshes >= a4.plain + 6, JSON.stringify(a4));

// ================================================================ badges
const bd0 = await ev(() => {
  const B = __bi.game.badges;
  const W = __bi.game.world;
  return B.list.map((b) => ({ id: b.def.id, y: +(b.pos.y - W.height(b.pos.x, b.pos.z)).toFixed(1), owned: b.owned }));
});
const roofs = bd0.filter((x) => !['bone', 'bottle', 'key'].includes(x.id));
check('12 Benton Badges placed: the rooftop ones sit well above the ground, none owned yet', bd0.length === 12 && roofs.every((x) => x.y > 2.5) && bd0.every((x) => !x.owned), JSON.stringify(bd0));
await ev(() => { const g = __bi.game, P = g.player, b = g.badges.list[0]; P.pos.set(b.pos.x, b.pos.y - 1.1, b.pos.z); P.vel.set(0, 0, 0); P.state = 'ground'; P.grounded = true; });
const found = await waitFor(() => __bi.save.data.badges?.found?.baseball, 5000);
await p.waitForTimeout(300);
await p.screenshot({ path: `${shots}/m8-02-badge.png` });
const bd1 = await ev(() => { const g = __bi.game, b = g.badges.list[0]; return { now: g.badges.foundNow, ghost: b.mesh.children[0].material[0].opacity < 0.5, toast: [...document.querySelectorAll('.toast')].some((t) => /Badge found: Colton's Baseball! \(1\/12\)/.test(t.textContent)) }; });
check("reaching Colton's Baseball on the Clubhouse roof finds it (saved), toasts 1/12 and it turns into a ghost", found && bd1.now.join() === 'baseball' && bd1.ghost && bd1.toast, JSON.stringify(bd1));

// five more: the Treasure Map glider unlocks
const bd2 = await ev(() => {
  const g = __bi.game;
  for (const b of g.badges.list.slice(1, 6)) { g.player.pos.set(b.pos.x, b.pos.y - 1.1, b.pos.z); step(0.1); }
  return { n: g.badges.foundNow.length, treasure: __bi.season.owns('glider', 'treasure'), medal: __bi.season.owns('glider', 'medal') };
});
check('six badges unlock the Treasure Map glider (the Badge Collector needs all 12)', bd2.n === 6 && bd2.treasure && !bd2.medal, JSON.stringify(bd2));

// the match result pays badge XP
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const bres = await ev(() => { const r = __bi.game.result; return { n: r.badges, xp: r.badgeXP, line: [...document.querySelectorAll('.sx-won')].map((e) => e.textContent).find((t) => /Benton Badges found/.test(t)) }; });
check('result: 6 badges found = +3,000 XP', bres.n === 6 && bres.xp === 3000 && /Benton Badges found: 6 \(\+3,000 XP\)/.test(bres.line || ''), JSON.stringify(bres));

// the book, the lobby button and the locker
await ev(() => __bi.toLobby());
await p.waitForTimeout(400);
const lobbyBtn = await ev(() => document.querySelector('[data-act=badges]')?.textContent);
await p.click('[data-act=badges]');
await p.waitForTimeout(300);
const book = await ev(() => ({ found: document.querySelectorAll('.bdg.got').length, hidden: [...document.querySelectorAll('.bdg:not(.got) small')].map((s) => s.textContent), reward: document.querySelector('.bdg-rewards')?.textContent }));
await p.screenshot({ path: `${shots}/m8-03-book.png` });
check('lobby "Badges · 6/12" opens the book: 6 found, hints for the rest, reward progress', /Badges · 6\/12/.test(lobbyBtn) && book.found === 6 && book.hidden.length === 6 && book.hidden.every((h) => /^Hint: /.test(h)) && /✓ Treasure Map glider/.test(book.reward) && /12 badges: Badge Collector glider/.test(book.reward), JSON.stringify({ lobbyBtn, ...book }));
await p.click('[data-act=main]');
await p.click('[data-act=locker]');
await p.waitForTimeout(300);
const locker = await ev(() => ({ treasure: document.querySelector('.cos[data-kind=glider][data-id=treasure]')?.textContent, medal: document.querySelector('.cos[data-kind=glider][data-id=medal]')?.textContent, medalAct: document.querySelector('.cos[data-kind=glider][data-id=medal]')?.dataset.act }));
await p.click('.cos[data-kind=glider][data-id=treasure]');
const eq = await ev(() => __bi.season.equipped(__bi.save.data.profile.character).glider);
await p.click('.cos[data-kind=glider][data-id=medal]');
const toBook = await ev(() => __bi.menus.current);
check('Locker: the Treasure Map glider equips; the locked Badge Collector says "Find 12 Benton Badges" and opens the book', /Tap to equip|Equipped/.test(locker.treasure) && eq === 'treasure' && /Find 12 Benton Badges/.test(locker.medal) && locker.medalAct === 'badges' && toBook === 'badges', JSON.stringify({ ...locker, eq, toBook }));
await p.click('[data-act=main]');

// ================================================================ events
const card = await ev(() => { const c = document.querySelector('.event-card'); return { text: c?.textContent.replace(/\s+/g, ' ').trim(), on: c?.classList.contains('on') }; });
await p.click('[data-act=event-toggle]');
const card2 = await ev(() => ({ on: document.querySelector('.event-card').classList.contains('on'), btn: document.querySelector('[data-act=event-toggle]').textContent, saved: __bi.save.data.profile.event }));
await p.click('[data-act=event-toggle]');
const card3 = await ev(() => ({ on: document.querySelector('.event-card').classList.contains('on'), saved: __bi.save.data.profile.event }));
check("lobby shows today's island event with tomorrow's, and On/Off toggles it", /Tomorrow: /.test(card.text) && card2.on !== card.on && card3.on === card.on && card2.saved !== card3.saved, JSON.stringify({ card, card2, card3 }));
await p.click('[data-act=queue][data-id=ranked]');
const rankedCard = await ev(() => ({ on: document.querySelector('.event-card').classList.contains('on'), text: document.querySelector('.event-card').textContent, ev: __bi.save.data.profile.ranked }));
await p.click('[data-act=queue][data-id=casual]');
check('ranked is always classic (the card says so)', !rankedCard.on && /Ranked matches are always classic/.test(rankedCard.text), JSON.stringify(rankedCard));

// spooky night
await match('spooky');
const sp = await ev(() => {
  const g = __bi.game, E = g.eventFx;
  const pk = E.pumpkins.filter((c) => c.alive);
  const c = pk[0];
  const at = { x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 };
  const b0 = g.loot.pickups.length;
  g.damageCollider(c, 999, g.player);
  step(0.2);
  return { event: g.event, bg: g.scene.background.getHexString(), sun: g.sun.intensity, pumpkins: pk.length, smashed: !c.alive, drops: g.loot.pickups.slice(b0).map((k) => k.it.kind), stat: g.player.stats.pumpkins, toast: [...document.querySelectorAll('.toast')].some((t) => /Island event: Spooky Night/.test(t.textContent)) };
});
await p.screenshot({ path: `${shots}/m8-04-spooky.png` });
check('Spooky Night: night sky, ~28 glowing pumpkins; smashing one spills Benton Bucks (and maybe a treat)', sp.event === 'spooky' && sp.bg === '1d1540' && sp.sun < 1.5 && sp.pumpkins >= 20 && sp.smashed && sp.drops.includes('coin') && sp.stat === 1 && sp.toast, JSON.stringify(sp));

// low gravity: jump height compared with a classic match
const jump = async () => ev(() => {
  const g = __bi.game, P = g.player;
  put(P, F.x, F.z); step(0.3);
  const y0 = P.pos.y;
  let top = y0;
  P.hp = 100;
  const inp = { mx: 0, mz: 0, jump: true, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false };
  P.move(1 / 60, inp);
  inp.jump = false;
  for (let i = 0; i < 240; i++) { P.move(1 / 60, inp); top = Math.max(top, P.pos.y); }
  // a long fall does no damage in low gravity
  P.pos.y += 25; P.state = 'air'; P.grounded = false; P.vel.set(0, 0, 0);
  for (let i = 0; i < 600 && !P.grounded; i++) P.move(1 / 60, inp);
  return { h: +(top - y0).toFixed(2), hp: P.hp };
});
const lg = await (async () => { await match('lowgrav'); return jump(); })();
const cl = await (async () => { await match(null); return jump(); })();
check('Low Gravity: jumps go about twice as high and a 25 m drop does no damage (classic: normal jump, fall damage)', lg.h > cl.h * 1.9 && lg.hp === 100 && cl.hp < 100, JSON.stringify({ lg, cl }));

// supply frenzy
await match('supply');
const sf = await ev(() => {
  const g = __bi.game;
  // falling drops plus landed crates
  const count = () => g.loot.drops.length + g.world.chests.filter((c) => c && c.supply).length;
  const n0 = count();
  g.state = 'playing';
  step(32);
  const n1 = count();
  step(46);
  const n2 = count();
  return { n0, n1, n2 };
});
check('Supply Frenzy: a supply drop 30 s in, then another every 45 s', sf.n1 === sf.n0 + 1 && sf.n2 === sf.n0 + 2, JSON.stringify(sf));

// golden loot
await match('golden');
const gl = await ev(() => {
  const g = __bi.game;
  const ws = g.loot.pickups.filter((k) => k.it.kind === 'weapon');
  const ch = g.world.chests.find((c) => c && !c.opened && !c.vault && !c.legendary);
  const b0 = g.loot.pickups.length;
  g.loot.openChest(g.player, ch);
  const cw = g.loot.pickups.slice(b0).find((k) => k.it.kind === 'weapon');
  return { floor: ws.length, minRarity: Math.min(...ws.map((k) => k.it.rarity)), chest: cw && cw.it.rarity };
});
check('Golden Loot: no common guns on the floor, chest guns at least Rare', gl.floor >= 5 && gl.minRarity >= 1 && gl.chest >= 2, JSON.stringify(gl));

// playground party
const padsClassic = await ev(() => [...__bi.game.world.physics.colliders].filter((c) => c.kind === 'pad').length);
await match('playground');
const pg = await ev(() => {
  const g = __bi.game, E = g.eventFx;
  const pads = [...g.world.physics.colliders].filter((c) => c.kind === 'pad').length;
  const sodas = E.pads.filter((s) => g.loot.pickups.some((k) => k.it.kind === 'consumable' && k.it.id === 'bounce' && Math.hypot(k.pos.x - s.x, k.pos.z - s.z) < 4)).length;
  // bounce on one
  const s = E.pads[0], P = g.player;
  put(P, s.x, s.z, s.y + 3);
  let top = P.pos.y;
  const inp = { mx: 0, mz: 0, jump: false, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false };
  for (let i = 0; i < 120; i++) { P.move(1 / 60, inp); top = Math.max(top, P.pos.y); }
  return { pads, eventPads: E.pads.length, sodas, launch: +(top - s.y).toFixed(1) };
});
await p.screenshot({ path: `${shots}/m8-05-playground.png` });
check('Playground Party: extra bounce pads at the named places, a Bouncy Soda by each, and they launch you', pg.eventPads >= 10 && pg.pads === padsClassic + pg.eventPads && pg.sodas === pg.eventPads && pg.launch > 10, JSON.stringify({ padsClassic, ...pg }));

// back to the lobby: classic lighting again
await ev(() => __bi.toLobby());
await match(null);
const back = await ev(() => ({ bg: '#' + __bi.game.scene.background.getHexString(), event: __bi.game.event, pumpkins: __bi.game.eventFx.pumpkins.length }));
check('the next classic match has the normal sky and no event props', back.bg !== '#1d1540' && back.event === null && back.pumpkins === 0, JSON.stringify(back));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-8 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
