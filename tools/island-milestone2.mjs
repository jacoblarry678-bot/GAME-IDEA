// Milestone 2 checks: squads (teammates, downed/revive, team wipe, reboot,
// pings, friendly fire), buffs, and Building 2.0 (edit, repair/upgrade,
// structural integrity, supported placement). Deterministic via engine.step().
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const press = (code) => ev((c) => { __bi.input.pressedSet.add(c); __bi.engine.step(1 / 60); }, code);

await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.click('[data-act=team][data-id="4"]');
await p.click('[data-act=mode][data-id=build]');
await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=play]');
await p.waitForTimeout(800);

const setup = await ev(() => {
  const g = __bi.game;
  window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
  window.put = (a, x, z, dy = 0) => { a.pos.set(x, g.world.height(x, z) + dy, z); a.vel.set(0, 0, 0); a.state = dy > 0.5 ? 'air' : 'ground'; a.grounded = false; };
  // a clear, flat-ish test field
  let fx = null, fz = 0;
  search: for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2) continue;
    let ok = true;
    for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]]) if (Math.abs(g.world.height(x + dx, z + dz) - h) > 0.8) ok = false;
    if (!ok || g.world.physics.query(x - 9, z - 9, x + 9, z + 9).length) continue;
    fx = x; fz = z; break search;
  }
  if (fx === null) throw new Error('no clear test field');
  window.F = { x: fx, z: fz };
  const team = g.actors.filter((a) => a.team === 0);
  const teams = new Set(g.actors.map((a) => a.team));
  return { mates: team.length, bots: team.filter((a) => a.isBot).map((a) => a.name), teams: teams.size, field: window.F, teamRows: document.querySelectorAll('.team .mate').length };
});
await p.waitForTimeout(400);
const rows = await ev(() => document.querySelectorAll('.team .mate').length);
check('Squads: player + 3 labelled bot teammates, 5 squads of 4', setup.mates === 4 && setup.bots.every((n) => n.endsWith('[BOT]')) && setup.teams === 5 && rows === 4, JSON.stringify({ ...setup, rows }));

// teammates jump with the player and glide down beside them
await ev(() => { const g = __bi.game; while (g.busT < 1.8) __bi.engine.step(1 / 60); });
await p.keyboard.press('Space');
await p.waitForTimeout(300);
const drop = await ev(() => {
  const g = __bi.game, P = g.player;
  step(2.5);
  const out = g.actors.filter((a) => a.team === 0 && a.state !== 'bus').length;
  for (let i = 0; i < 60 * 40 && P.state !== 'ground' && P.state !== 'swim'; i++) __bi.engine.step(1 / 60);
  step(6);
  const d = g.actors.filter((a) => a.team === 0 && a !== P).map((a) => Math.round(a.pos.distanceTo(P.pos)));
  return { out, dists: d };
});
check('Teammates leave the bus with the player and land nearby', drop.out === 4 && drop.dists.every((d) => d < 40), JSON.stringify(drop));

// isolate: freeze every enemy squad far away
await ev(() => {
  const g = __bi.game;
  for (const a of g.actors) if (a.team !== 0) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; put(a, -150 + a.id, 150); }
  const P = g.player;
  put(P, F.x, F.z);
  g.actors.filter((a) => a.team === 0 && a !== P).forEach((a, i) => put(a, F.x + 3 + i * 2, F.z + 3));
  step(0.5);
});

const ff = await ev(() => {
  const g = __bi.game, P = g.player, m = g.actors[1];
  m.hp = 100; m.shield = 0;
  g.applyDamage(m, 50, P, {});
  return { hp: m.hp };
});
check('No friendly fire between squadmates', ff.hp === 100, JSON.stringify(ff));

const down = await ev(() => {
  const g = __bi.game, P = g.player, m = g.actors[1], enemy = g.actors.find((a) => a.team === 3);
  m.hp = 20; m.shield = 0;
  g.applyDamage(m, 50, enemy, {});
  return { downed: m.downed, alive: m.alive, downHp: m.downHp, canAct: m.canAct(), feed: document.querySelector('.killfeed').textContent.includes('knocked') };
});
check('Lethal damage knocks a squadmate down instead of eliminating', down.downed && down.alive && down.downHp === 100 && !down.canAct && down.feed, JSON.stringify(down));

// freeze own bots too so the player does the revive with a held E key
await ev(() => {
  const g = __bi.game, P = g.player, m = g.actors[1];
  for (const a of g.actors) if (a.team === 0 && a.brain) { a.brain._u = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = false; return i; }; }
  put(m, P.pos.x + 1.2, P.pos.z);
  step(0.3);
});
await p.waitForTimeout(300);
const prompt = await ev(() => document.querySelector('.prompt span').textContent);
await p.keyboard.down('KeyE');
await ev(() => step(4.5));
await p.keyboard.up('KeyE');
const rev = await ev(() => { const m = __bi.game.actors[1]; return { downed: m.downed, hp: m.hp }; });
check('Hold E revives a knocked teammate after 4s (back at 30 HP)', /Revive/.test(prompt) && !rev.downed && rev.hp === 30, JSON.stringify({ prompt, ...rev }));
await p.screenshot({ path: `${shots}/m2-01-squad.png` });

const botRevive = await ev(() => {
  const g = __bi.game, P = g.player;
  for (const a of g.actors) if (a.team === 0 && a.brain && a.brain._u) a.brain.update = a.brain._u;
  P.hp = 5; P.shield = 0;
  g.applyDamage(P, 50, g.actors.find((a) => a.team === 3), {});
  const was = P.downed;
  let t = 0;
  while (P.downed && t < 30) { __bi.engine.step(1 / 60); t += 1 / 60; }
  return { was, downed: P.downed, hp: P.hp, secs: Math.round(t) };
});
check('Bot teammates come and revive the knocked player', botRevive.was && !botRevive.downed && botRevive.hp === 30, JSON.stringify(botRevive));

const buffs = await ev(() => {
  const g = __bi.game, P = g.player;
  put(P, F.x, F.z); step(0.3);
  const r = {};
  const drink = (id) => { P.slots[4] = { kind: 'consumable', id, count: 1 }; P.select(4); P.equipT = 0; const ok = P.startUse(); step(1.4); return ok; };
  // speed
  const run = () => { const x0 = P.pos.x; for (let i = 0; i < 60; i++) P.move(1 / 60, { mx: 1, mz: 0, jump: false, sprint: false, crouch: false, slide: false, glide: false, dive: 0, ads: false }); const d = P.pos.x - x0; P.pos.x = x0; return d; };
  const base = run();
  r.zoomOk = drink('zoom');
  r.speed = +(run() / base).toFixed(2);
  // jump + no fall damage
  const jump = () => { put(P, F.x, F.z); step(0.2); const y0 = P.pos.y; let top = y0; P.move(1 / 60, { mx: 0, mz: 0, jump: true }); for (let i = 0; i < 90; i++) { P.move(1 / 60, { mx: 0, mz: 0, jump: false }); top = Math.max(top, P.pos.y); } return top - y0; };
  const j0 = jump();
  drink('bounce');
  r.jump = +(jump() / j0).toFixed(2);
  P.hp = 100; put(P, F.x, F.z, 16); for (let i = 0; i < 300 && P.state !== 'ground'; i++) __bi.engine.step(1 / 60); step(0.2);
  r.fallHp = P.hp;
  // spicy damage
  const enemy = g.actors.find((a) => a.team === 3);
  put(enemy, F.x + 3, F.z); enemy.hp = 100; enemy.shield = 0; enemy.overshield = 0;
  drink('spicy');
  g.applyDamage(enemy, 50, P, {});
  r.spicyDmg = 100 - enemy.hp;
  // shield snack
  P.shield = 0; drink('snack'); step(5);
  r.snackShield = Math.round(P.shield);
  r.hud = document.querySelectorAll('.buffs .buff').length;
  r.active = Object.keys(P.buffs);
  return r;
});
check('Buffs: Zoom +30% speed, Bouncy Soda higher jump & no fall damage, Spicy +20% damage, Shield Snack regen, HUD timers', buffs.zoomOk && buffs.speed >= 1.25 && buffs.jump >= 1.3 && buffs.fallHp === 100 && buffs.spicyDmg === 60 && buffs.snackShield >= 18 && buffs.hud >= 3, JSON.stringify(buffs));

// ---- pings (real key)
await ev(() => { const g = __bi.game; put(g.player, F.x, F.z); g.controller.yaw = 0; g.controller.pitch = -0.3; step(0.2); });
await press('KeyZ');
await p.waitForTimeout(300);
const ping = await ev(() => { const g = __bi.game; return { n: g.teams.pings.length, label: g.teams.pings[0]?.label, mates: g.actors.filter((a) => a.team === 0 && a.brain && a.brain.pingT > 0).length, marker: [...document.querySelectorAll('.mk-ping')].some((d) => d.style.display !== 'none') }; });
check('Z pings a spot: world marker, and bot teammates head there', ping.n === 1 && ping.mates === 3 && ping.marker, JSON.stringify(ping));

// ---- reboot: eliminate a teammate, grab the card, use a van
const rb = await ev(() => {
  const g = __bi.game, P = g.player;
  const m = g.actors[2];
  const enemy = g.actors.find((a) => a.team === 3);
  for (const a of g.actors) if (a.team === 0 && a.brain) a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = false; return i; };
  put(m, F.x + 6, F.z + 6); step(0.2);
  m.hp = 1; m.shield = 0;
  g.applyDamage(m, 10, enemy, {}); // knocked
  g.applyDamage(m, 200, enemy, {}); // finished
  step(1.5);
  const card = g.loot.pickups.find((k) => k.it.kind === 'card' && k.it.id === m.id);
  const r = { knockedThenOut: !m.alive, card: !!card };
  put(P, card.pos.x, card.pos.z); step(0.8);
  r.carried = P.cards.includes(m.id);
  const van = g.world.vans[0];
  put(P, van.pos.x, van.pos.z); step(0.3);
  return r;
});
await p.waitForTimeout(300);
const vanPrompt = await ev(() => document.querySelector('.prompt span').textContent);
await p.keyboard.down('KeyE');
await ev(() => step(5.5));
await p.keyboard.up('KeyE');
const rb2 = await ev(() => { const m = __bi.game.actors[2]; return { alive: m.alive, state: m.state, hp: m.hp, pistol: m.slots[0]?.id, cards: __bi.game.player.cards.length, vanCd: Math.round(__bi.game.world.vans[0].cd) }; });
check('Reboot: eliminated teammate drops a card; carrying it to a van and holding E brings them back', rb.knockedThenOut && rb.card && rb.carried && /Reboot/.test(vanPrompt) && rb2.alive && rb2.state === 'skydive' && rb2.pistol === 'pistol' && rb2.cards === 0 && rb2.vanCd > 50, JSON.stringify({ ...rb, vanPrompt, ...rb2 }));

// ---- team wipe + squad placement
const wipe = await ev(() => {
  const g = __bi.game;
  const t = g.actors.filter((a) => a.team === 2);
  const enemy = g.actors.find((a) => a.team === 3);
  const before = g.teams.teamsAlive().size;
  for (const a of t) { a.state = 'ground'; a.hp = 1; a.shield = 0; a.overshield = 0; g.applyDamage(a, 10, enemy, {}); }
  step(0.2);
  return { before, after: g.teams.teamsAlive().size, anyAlive: t.some((a) => a.alive), place: g.teams.place[2] };
});
check('Knocking the whole squad wipes it (members eliminated, squad placed)', !wipe.anyAlive && wipe.after === wipe.before - 1 && wipe.place === wipe.before, JSON.stringify(wipe));

// ---- building 2.0
const b1 = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  put(P, F.x + 2, F.z + 2); step(0.3);
  P.mats = { wood: 200, brick: 50, metal: 50 };
  const s = B.spot(P, 'wall', 0, 0);
  const w = B.place(P, s, 'wood');
  const up = B.spot(P, 'wall', 0, 0.8); // the wall above
  const w2 = B.place(P, up, 'wood');
  // a floating floor far from anything cannot be placed
  const fl = { ...B.spot(P, 'floor', 0, 0) };
  fl.minY += 12; fl.maxY += 12; fl.key = 'test-float';
  const floatOk = B.canPlace(P, fl, 'wood');
  return { w: !!w, w2: !!w2, stacked: w2 && w2.box.minY > w.box.minY + 2, floatOk };
});
check('Placement needs support: stacked wall OK, floating floor refused', b1.w && b1.w2 && b1.stacked && b1.floatOk === false, JSON.stringify(b1));

// edit: aim at the lower wall, V, cut the bottom-middle 2 tiles (door), V to confirm
await ev(() => { const g = __bi.game; g.controller.yaw = 0; g.controller.pitch = -0.05; step(0.2); });
await p.waitForTimeout(300);
await press('KeyV');
const e0 = await ev(() => { const e = __bi.game.controller.editing; return e ? { tiles: e.tiles.length, hover: e.hover } : null; });
await ev(() => { const e = __bi.game.controller.editing; e.tiles[1] = false; e.tiles[4] = false; });
await p.waitForTimeout(200);
await p.screenshot({ path: `${shots}/m2-02-edit.png` });
await press('KeyV');
const e1 = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  const w = [...B.pieces].find((q) => q.type === 'wall' && q.box.minY < P.pos.y + 1);
  // a ray through the door gap at knee height must pass; one through a kept tile must hit
  const b = w.box;
  const midX = (b.minX + b.maxX) / 2, midZ = (b.minZ + b.maxZ) / 2;
  const axisX = w.axisX;
  const from = (off) => (axisX ? [midX - 3, 0, midZ + off] : [midX + off, 0, midZ - 3]);
  const shoot = (off, y) => {
    const [ox, , oz] = from(off);
    const d = axisX ? [1, 0, 0] : [0, 0, 1];
    const h = g.world.physics.raycast(ox, y, oz, d[0], d[1], d[2], 6);
    return !!(h && h.c && h.c.piece === w);
  };
  return { editing: !!g.controller.editing, tiles: w.tiles && w.tiles.map(Number).join(''), colliders: w.colliders.length, doorOpen: !shoot(0, w.b + 0.6), sideSolid: shoot(1.5, w.b + 0.6) };
});
check('Edit a wall into a door (V, cut tiles, V confirm): gap is open, rest stays solid', e0 && e0.tiles === 9 && !e1.editing && e1.tiles === '101101111' && e1.doorOpen && e1.sideSolid, JSON.stringify({ e0, e1 }));

// aim at the solid top row (the ray would pass through the new doorway)
await ev(() => { __bi.game.controller.pitch = 0.3; __bi.engine.step(1 / 60); });
await press('KeyV');
await press('KeyR');
await press('KeyV');
const reset = await ev(() => { const w = [...__bi.game.building.pieces].find((q) => q.type === 'wall' && q.box.minY < __bi.game.player.pos.y + 1); return { tiles: w.tiles, colliders: w.colliders.length }; });
check('Edit reset (R) + confirm restores the full wall', reset.tiles === null && reset.colliders === 1, JSON.stringify(reset));

const ru = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  const w = [...B.pieces].find((q) => q.type === 'wall' && q.box.minY < P.pos.y + 1);
  B.damage(w, 90, null);
  const hp0 = Math.round(w.hp), wood0 = P.mats.wood;
  return { hp0, wood0 };
});
await p.waitForTimeout(200);
const hint = await ev(() => document.querySelector('.buildinfo span').textContent);
await press('KeyU');
const ru1 = await ev(() => { const P = __bi.game.player; const w = [...__bi.game.building.pieces].find((q) => q.type === 'wall' && q.box.minY < P.pos.y + 1); return { hp: w.hp, max: w.maxHp, wood: P.mats.wood, mat: w.material }; });
await press('KeyU');
const ru2 = await ev(() => { const P = __bi.game.player; const w = [...__bi.game.building.pieces].find((q) => q.type === 'wall' && q.box.minY < P.pos.y + 1); return { hp: w.hp, max: w.maxHp, brick: P.mats.brick, mat: w.material }; });
check('U repairs a damaged build, then upgrades wood → brick', /Repair/.test(hint) && ru1.hp === ru1.max && ru1.wood === ru.wood0 - 6 && ru2.mat === 'brick' && ru2.max === 260 && ru2.brick === 40, JSON.stringify({ ...ru, hint, ru1, ru2 }));

const integ = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  const walls = [...B.pieces].filter((q) => q.type === 'wall').sort((a, b) => a.box.minY - b.box.minY);
  const n0 = B.pieces.size;
  B.damage(walls[0], 9999, null);
  return { n0, n1: B.pieces.size, upperGone: !walls[1].alive };
});
check('Structural integrity: destroying the bottom wall collapses the wall on top', integ.upperGone && integ.n1 === integ.n0 - 2, JSON.stringify(integ));

// ---- squad victory
const win = await ev(() => {
  const g = __bi.game, P = g.player;
  for (const a of g.actors) if (a.team !== 0 && a.alive) { a.state = 'ground'; g.eliminate(a, P, {}); }
  step(0.3);
  return { state: g.state, won: g.result?.won, team: g.result?.team, place: g.result?.place, screen: document.querySelector('.result h1')?.textContent };
});
check('Last squad standing wins (squad victory screen)', win.state === 'over' && win.won && win.team && /SQUAD/.test(win.screen), JSON.stringify(win));
await p.screenshot({ path: `${shots}/m2-03-victory.png` });

// ---- player eliminated with teammates alive → spectate teammate, no results yet
await p.click('[data-act=again]');
await p.waitForTimeout(800);
const spec = await ev(() => {
  const g = __bi.game, P = g.player;
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(P);
  for (let i = 0; i < 60 * 40 && P.state !== 'ground' && P.state !== 'swim'; i++) __bi.engine.step(1 / 60);
  const enemy = g.actors.find((a) => a.team === 3);
  for (const a of g.actors) if (a.team !== 0) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; put(a, -150 + a.id, 150); }
  P.hp = 1; P.shield = 0;
  g.applyDamage(P, 10, enemy, {});
  g.applyDamage(P, 200, enemy, {});
  step(0.3);
  return { alive: P.alive, spectating: g.controller.spectating, specTeam: g.controller.spec?.team, result: !!g.result, bar: !document.querySelector('.spectate-bar').classList.contains('hidden') };
});
check('Eliminated with squad alive: spectate a teammate, wait for a reboot (no results yet)', !spec.alive && spec.spectating && spec.specTeam === 0 && !spec.result && spec.bar, JSON.stringify(spec));
const botReboot = await ev(() => {
  const g = __bi.game, P = g.player;
  let t = 0;
  while (!P.alive && t < 150 && g.state !== 'over' && !g.result) { __bi.engine.step(1 / 60); t += 1 / 60; }
  return { alive: P.alive, secs: Math.round(t), spectating: g.controller.spectating, over: g.state === 'over', result: g.result, feed: document.querySelector('.killfeed').textContent.slice(0, 300), mates: g.actors.filter((a) => a.team === 0).map((a) => [a.alive, a.downed, a.cards.length, a.brain?.mode, Math.round(a.hp)]) };
});
check('Bot teammates collect the player\'s card and reboot them', botReboot.alive && !botReboot.spectating, JSON.stringify(botReboot));
await p.screenshot({ path: `${shots}/m2-04-rebooted.png` });

check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-2 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
