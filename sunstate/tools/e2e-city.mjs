/**
 * The living city in headless Chromium:
 *   npm run build && npm run preview &   then   node tools/e2e-city.mjs
 * Places (gun shop, clothes, gas station, auto shop) and their staff's
 * memory of Cal and Sol; Velvet Palms inside (door, bar, stage, DJ, VIP booth,
 * getting thrown out); police descriptions and recognition; respray losing
 * the police; LOOP reels and Claude-written posts.
 *
 * Mocked: `window.claude` (the claude.ai artifact runtime) is replaced by a
 * stub that returns fixed posts, so the prompt and the feed handling are
 * tested without spending anyone's Claude usage. The real call was not run.
 */
import { mkdirSync } from 'node:fs';
import { launch, checker } from './harness.mjs';

mkdirSync('shots', { recursive: true });
const { check, summary } = checker();
const t0 = Date.now();
const { browser, page, logs, sun } = await launch();
await page.addInitScript(() => {
  window.claude = {
    use: async (name) => (name === 'sample' ? Object.assign(async () => ({ text: '' }), {
      json: async (prompt) => { window.__prompt = prompt; return [{ handle: 'sandbar.sofi', text: 'the stub says hi from the beach', replyTo: null }, { handle: 'keys.kat', text: 'Cayo Lento has been weird since the shooting on the twin span', replyTo: null }, { handle: '<bad>', text: 'dropped' }]; },
    }) : null),
  };
});
await page.evaluate(() => { localStorage.removeItem('sunstate.save'); });
await page.goto(page.url().split('?')[0] + '?autostart', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 180000 });
const T = (fn, arg) => page.evaluate(fn, arg);
await T(() => {
  const S = window.__sun;
  window.__t = {
    tick: (s, r = 0) => S.advance(s, r),
    press(a) { S.input.virtual.edges.add(a); S.advance(1 / 30); },
    at(place) { const g = S.game, d = window.__places[place]; g.respawnPlayer(d.x, d.z, 0); S.advance(0.5); },
    shop() { const o = S.game.places.openShop; return o ? { id: o.id, greeting: o.greeting, msg: o.msg, items: S.game.places.items().map((i) => i.label) } : null; },
  };
  S.game.economy.money = 6000;
});
// door positions (exported via the map blips)
await T(() => { window.__places = {}; for (const k of ['gunshop', 'clothes', 'gas', 'club']) { const g = window.__sun.game; const it = g.interactables.find((i) => i.id === 'shop:' + k); window.__places[k] = { x: it.x - (k === 'gas' ? -1 : 1), z: it.z }; } });

// ---- Bayfront Arms: buy ammo, armour, the SMG; Dee remembers you ----
const gun = await T(() => {
  const t = window.__t, g = window.__sun.game;
  t.at('gunshop');
  const prompt = g.player.controller.prompt?.text;
  t.press('interact');
  const first = t.shop();
  const ammo0 = g.player.controller.inventory.ammo.pistol.reserve, money0 = g.economy.money;
  t.press('shop1'); t.press('shop2'); t.press('shop3');
  const r = { prompt, first, panel: document.querySelector('.shopmenu')?.classList.contains('show'), ammo: g.player.controller.inventory.ammo.pistol.reserve - ammo0, armour: g.player.armor, smg: g.player.controller.inventory.weapons.includes('smg'), spent: money0 - g.economy.money };
  t.press('interact');
  r.closed = !g.places.openShop;
  return r;
});
check('Bayfront Arms: the counter opens from the door', /Bayfront Arms/.test(gun.prompt || '') && gun.panel && gun.first?.id === 'gunshop', JSON.stringify(gun.first));
check('buying ammo, armour and the Vela Viper SMG works and costs money', gun.ammo === 48 && gun.armour === 100 && gun.smg && gun.spent === 60 + 200 + 1500 && gun.closed, JSON.stringify(gun));
const back = await T(() => { const t = window.__t, g = window.__sun.game; t.tick(130); t.at('gunshop'); t.press('interact'); const a = t.shop().greeting; t.press('interact'); t.tick(1.5); g.crew.switchCharacter(); t.at('gunshop'); t.press('interact'); const b = t.shop().greeting; t.press('interact'); t.tick(1.5); g.crew.switchCharacter(); t.tick(0.2); return { cal2: a, sol1: b, back: g.player.protagonist }; });
check('Dee remembers Cal on his second visit, and has never met Sol', /Cal, right\? Back already/.test(back.cal2) && /Licence/.test(back.sol1), JSON.stringify(back));

// ---- the police description, and Threads on 5th to change it ----
const desc = await T(() => {
  const t = window.__t, g = window.__sun.game;
  g.events.emit('crimeReported', { crimeId: 'assault', x: g.player.pos.x, z: g.player.pos.z, by: 'police', level: 1 });
  const d = g.memory.describe(), m1 = g.memory.matchScore();
  t.at('clothes'); t.press('interact');
  const greet = t.shop().greeting, top0 = g.player.look.top;
  t.press('shop2');
  const r = { d, m1, greet, changed: g.player.look.top !== top0, m2: g.memory.matchScore(), modelOk: !!g.player.group.parent };
  t.press('interact');
  return r;
});
check('police keep a description after seeing a crime', desc.m1 === 1 && /in a cream top/.test(desc.d), desc.d);
check('Threads on 5th: Ines notices, a new outfit no longer matches the description', /news/.test(desc.greet) && desc.changed && desc.m2 === 0 && desc.modelOk, JSON.stringify(desc));

// ---- Sunshine Gas ----
const gas = await T(() => { const t = window.__t, g = window.__sun.game; t.at('gas'); g.player.health = 50; t.press('interact'); t.press('shop1'); const r = { open: t.shop()?.id, hp: Math.round(g.player.health) }; t.press('interact'); return r; });
check('Sunshine Gas: snacks restore health', gas.open === 'gas' && gas.hp === 75, JSON.stringify(gas));

// ---- Coral Auto Body: drive in, respray, lose the police ----
const respray = await T(() => {
  const t = window.__t, g = window.__sun.game, S = window.__sun;
  const v = g.vehicles.find((x) => x.persistentId === 'start-sedan');
  g.respawnPlayer(0, -20, 0);
  g.seatCharacter(v, 0, g.player);
  // the bay: inside the garage (from the place data the HUD prompt uses)
  const B = g.places.PLACES.autoshop.bay, bayX = (B.x0 + B.x1) / 2 - 1, bayZ = (B.z0 + B.z1) / 2;
  v.pos.set(bayX, 0.14, bayZ); v.yaw = -Math.PI / 2; v.vel.set(0, 0); v.health = 600;
  g.wanted.report('carjack', v.pos.x, v.pos.z, 'witness');
  g.police.clearAll();
  S.advance(0.5);
  const inBay = g.places.inBay, prompt = g.player.controller.prompt?.text;
  t.press('interact');
  const open = t.shop()?.id;
  const color0 = v.color, plate0 = v.plate;
  t.press('shop1'); t.press('shop2');
  const r = { inBay, prompt, open, repaired: v.health, color: v.color !== color0, plate: v.plate !== plate0, wanted: g.wanted.level };
  t.press('interact');
  return r;
});
check('Coral Auto Body: drive into the bay and the shop opens', respray.inBay && /Coral Auto Body/.test(respray.prompt || '') && respray.open === 'autoshop', JSON.stringify(respray));
check('repair and respray: new paint, new plates, and the police lose the car', respray.repaired === 1000 && respray.color && respray.plate && respray.wanted === 0, JSON.stringify(respray));

// ---- Velvet Palms: the door, the room, the counters, and getting thrown out ----
const club = await T(() => {
  const t = window.__t, g = window.__sun.game, S = window.__sun;
  if (g.player.vehicle) g.unseatCharacter(g.player.vehicle, g.player, null);
  const walkIn = () => { const d = g.club.L.door; g.respawnPlayer(d.x - 2.5, d.z, Math.PI / 2); g.cameraRig.yaw = Math.PI / 2; S.input.virtual.move = { x: 0, y: 1 }; S.advance(2.5); S.input.virtual.move = null; S.advance(0.3); return g.club.playerInside; };
  g.engine.time.hour = 13; t.at('club'); t.press('interact');
  const day = { open: !!g.places.openShop, said: document.querySelector('.subtitle')?.textContent || '', walkedIn: walkIn() };
  g.engine.time.hour = 22.2; S.advance(0.3);
  const unpaid = walkIn();
  t.at('club'); t.press('interact');
  const menu = t.shop();
  t.press('shop1');
  const night = { menu: menu?.items, admitted: g.club.admitted, inside: walkIn() };
  const people = g.club.people.map((x) => x.role);
  return { day, unpaid, night, performers: people.filter((r) => r === 'performer').length, patrons: people.filter((r) => r !== 'performer').length, staff: ['clubbar', 'clubdj', 'clubvip'].filter((k) => g.places.staff[k]), music: g.club.musicOn };
});
check('Velvet Palms: closed by day; at night you can\'t walk in without paying the cover', !club.day.open && /8 PM/.test(club.day.said) && !club.day.walkedIn && !club.unpaid, JSON.stringify(club.day) + ' unpaid ' + club.unpaid);
check('pay Big Tomas and walk in: dancers on stage, a full room, staff and a DJ playing', club.night.admitted && club.night.inside && club.performers === 3 && club.patrons >= 6 && club.staff.length === 3 && club.music, JSON.stringify(club));
const inside = await T(() => {
  const t = window.__t, g = window.__sun.game, S = window.__sun, P = g.places.PLACES;
  const use = (id, ...picks) => { const d = P[id].door; g.respawnPlayer(d.x, d.z, 0); S.advance(0.4); t.press('interact'); const o = t.shop(); for (const k of picks) t.press('shop' + k); const msg = g.places.openShop?.msg; if (g.places.openShop) t.press('interact'); S.advance(0.2); return { ...o, msg }; };
  const money0 = g.economy.money;
  const bar = use('clubbar', 1);
  const tipsy = g.club.tipsy;
  const posts0 = g.social.posts.length;
  const stage = use('clubstage', 2);
  S.advance(3, 1);
  const rain = g.social.posts.find((p) => /made it rain/i.test(p.text));
  const dj = use('clubdj', 2);
  const h0 = g.engine.time.hour; g.player.health = 40;
  const vip = use('clubvip', 1);
  const after = { hour: +(g.engine.time.hour - h0).toFixed(2), hp: g.player.health, closed: !g.places.openShop, seated: g.player.pinned };
  S.advance(3);
  return { bar: bar.greeting, tipsy, stage: stage.msg, bills: g.club.bills.length, reel: rain?.reel?.frames.length || 0, newPosts: g.social.posts.length - posts0, style: g.club.style, dj: dj.msg, vip: vip.id, after, standing: !g.player.pinned, spent: money0 - g.economy.money };
});
check('the bar: Jules serves a drink, and it goes to your head', /welcome to the Palms/.test(inside.bar) && inside.tipsy > 0.2, JSON.stringify(inside));
check('making it rain at the stage: bills fly, and someone at the rail films it for LOOP', inside.bills > 40 && inside.reel >= 6 && /make it rain|Bills everywhere/i.test(inside.stage), JSON.stringify(inside));
check('the DJ takes a request; an hour in a booth passes time and restores health', inside.style === 'dembow' && /goes out to/.test(inside.dj) && inside.after.hour === 1 && inside.after.hp === 100 && inside.after.closed && inside.standing && inside.spent === 12 + 200 + 10 + 60, JSON.stringify(inside));
const fight = await T(() => {
  const t = window.__t, g = window.__sun.game, S = window.__sun, p = g.player;
  const v = g.club.people.find((x) => x.role === 'floor' || x.role === 'booth');
  p.pos.set(v.ch.pos.x - 0.9, p.pos.y, v.ch.pos.z); S.advance(0.1);
  g.events.emit('assault', { attacker: p, victim: v.ch });
  S.advance(0.5);
  const out = { inside: g.club.playerInside, gate: !!g.club.gate };
  t.at('club'); t.press('interact');
  return { ...out, refused: !g.places.openShop, said: document.querySelector('.subtitle')?.textContent || '' };
});
check('start a fight inside and the bouncer throws you out (and won\'t let you back tonight)', !fight.inside && fight.gate && fight.refused && /what you did/.test(fight.said), JSON.stringify(fight));
await T(() => { const g = window.__sun.game; g.engine.time.hour = 14; window.__sun.advance(0.5); });

// ---- police recognise you from the description ----
const rec = await T(() => {
  const t = window.__t, g = window.__sun.game, S = window.__sun;
  g.engine.time.hour = 14;
  g.respawnPlayer(30, -40, 0); g.wanted.clear(true);
  g.events.emit('crimeReported', { crimeId: 'assault', x: 30, z: -40, by: 'police', level: 1 });
  g.wanted.clear(true);
  const u = g.police.spawnUnit(true);
  if (!u) return { spawned: false };
  u.vehicle.pos.set(31.75, 0, -52); u.vehicle.yaw = Math.PI; u.vehicle.vel.set(0, 0); u.vehicle.ai.speedScale = 0; // a patrol car parked up the street
  let level = 0; for (let i = 0; i < 16 && !level; i++) { S.advance(0.5); level = g.wanted.level; }
  return { spawned: true, level, note: g.wanted.log[0]?.text };
});
check('an officer who gets a good look at someone matching the description recognises you', rec.level === 1 && /description/.test(rec.note || ''), JSON.stringify(rec));
await T(() => { const g = window.__sun.game; g.wanted.clear(true); g.police.clearAll(); });

// ---- LOOP: a reel filmed from a witness's eyes; Claude-written posts (stubbed) ----
const reel = await T(() => {
  const S = window.__sun, g = S.game;
  const w = g.partner;
  g.wanted.startCall(w, 'shooting', g.player.pos.x, g.player.pos.z);
  S.advance(3, 1);
  const p = g.social.posts.find((x) => x.reel);
  return { frames: p?.reel.frames.length || 0, w: p?.reel.frames[0]?.width };
});
check('a witness films a reel: frames captured from their phone', reel.frames >= 6 && reel.w === 90, JSON.stringify(reel));
const ai = await T(async () => {
  const S = window.__sun, g = S.game;
  g.memory.state.nickname = 'the Coral Ave Carjacker';
  S.input.virtual.edges.add('phone'); S.advance(0.1, 1);
  const avail = g.social.ai.available;
  S.input.virtual.edges.add('loopAI'); S.advance(0.1, 1);
  for (let i = 0; i < 20 && g.social.ai.busy; i++) await new Promise((r) => setTimeout(r, 50));
  S.advance(0.2, 1);
  const posts = g.social.posts.filter((p) => p.ai);
  return { avail, n: posts.length, texts: posts.map((p) => p.text), prompt: (window.__prompt || '').includes('Coral Ave Carjacker'), canvas: !!document.querySelector('.loopfeed canvas.reel'), status: g.social.ai.status };
});
check('LOOP asks Claude (stubbed) with what the city remembers, and adds the posts it gets back', ai.avail && ai.n === 2 && ai.prompt && /Claude/.test(ai.status), JSON.stringify(ai));
check('reels play in the LOOP feed', ai.canvas);
await sun.shot('shots/loop-reel.png');

// ---- memory survives a save ----
const mem = await T(() => { const g = window.__sun.game; g.saveGame('test'); const s = JSON.parse(localStorage.getItem('sunstate.save')); return { visits: s.memory.people.gunshop?.cal?.visits, nick: s.memory.nickname }; });
check('memory is saved with the game', mem.visits === 2 && mem.nick === 'the Coral Ave Carjacker', JSON.stringify(mem));

const errs = logs.filter((l) => l.includes('PAGEERROR'));
check('no page errors', errs.length === 0, errs.slice(0, 3).join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
await browser.close();
process.exit(summary() ? 0 : 1);
