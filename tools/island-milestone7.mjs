// Milestone 7 checks: story NPCs and quests, ramp and cone editing, and bots
// that drive, driven through the real game.
// Usage: node tools/island-milestone7.mjs [url] [shotDir]
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
await p.click('[data-act=play]');
await p.waitForTimeout(700);
await ev(() => {
  const g = __bi.game;
  window.step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) __bi.engine.step(1 / 60); };
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (const a of g.actors) if (a.brain) { a.brain._upd = a.brain.update; a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  window.put = (a, x, z, y = 60) => { a.pos.set(x, g.world.physics.groundAt(x, z, y).y + 0.05, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; };
  // stand 2m in front of an NPC, facing them
  window.meet = (i) => { const n = g.quests.npcs[i]; const f = n.mesh.rotation.y; const x = n.pos.x - Math.sin(f) * 2, z = n.pos.z - Math.cos(f) * 2; put(g.player, x, z, n.pos.y + 2); g.controller.yaw = Math.atan2(-(n.pos.x - x), -(n.pos.z - z)); };
  g.player.hp = 100; g.player.shield = 100;
  g.storm.update = () => {}; // no storm damage while we run around
});

// ---- the world: three islanders by their houses; tackle boxes hidden until needed
const world = await ev(() => {
  const g = __bi.game, Q = g.quests, W = g.world;
  return {
    npcs: Q.npcs.map((n) => ({ name: n.def.name, dry: n.pos.y > 0.5, near: Math.hypot(n.pos.x - W.minor.find((m) => m.name === n.def.near).x, n.pos.z - W.minor.find((m) => m.name === n.def.near).z) < 21, mark: n.markSym })),
    tackle: Q.tackle.length, shown: Q.tackle.filter((t) => t.mesh.visible).length,
  };
});
check('three story NPCs stand by the Farm House, Fishing Shack and Lookout Cabin with a "!" marker', world.npcs.length === 3 && world.npcs.every((n) => n.dry && n.near && n.mark === '!'), JSON.stringify(world.npcs));
check('six tackle boxes exist but stay hidden until the quest needs them', world.tackle === 6 && world.shown === 0, JSON.stringify(world));

// ---- Grandpa Gus: harvest, build, return
await ev(() => meet(0));
await waitFor(() => /Talk to Grandpa Gus/.test(__bi.game.controller.prompt?.text || ''), 5000);
const gp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
await waitFor(() => !!__bi.game.player.quests?.gus, 3000);
await waitFor(() => /Fix Up the Farm/.test(document.querySelector('.quests')?.textContent || ''), 5000); // the tracker refreshes every few frames
const gus1 = await ev(() => ({ q: __bi.game.player.quests.gus, track: document.querySelector('.quests')?.textContent, mark: __bi.game.quests.npcs[0].markSym }));
await p.screenshot({ path: `${shots}/m7-01-quest.png` });
check('E by Grandpa Gus starts "Fix Up the Farm"; the tracker shows the first step', /Talk to Grandpa Gus/.test(gp) && gus1.q.step === 0 && /Fix Up the Farm/.test(gus1.track || '') && /Harvest 60 materials\s*0\/60/.test(gus1.track || '') && gus1.mark === '…', JSON.stringify({ gp, ...gus1 }));

const gus2 = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  // swing at a tree until 60 materials are in (real harvesting)
  const tree = [...g.world.physics.colliders].find((c) => c.kind === 'tree' && c.alive && Math.hypot(c.minX - P.pos.x, c.minZ - P.pos.z) < 80);
  P.mats.wood = 0;
  const harvested = [];
  for (let i = 0; i < 40 && P.stats.harvest < 60; i++) {
    const tx = (tree.minX + tree.maxX) / 2, tz = (tree.minZ + tree.maxZ) / 2;
    put(P, tx + 1.4, tz, tree.maxY);
    P.sel = -1; P.fireCd = 0; P.swingCd = 0;
    g.combat.swing(P, new P.pos.constructor(-1, 0, 0));
    step(0.3);
    harvested.push(P.stats.harvest);
    if (!tree.alive) break;
  }
  step(0.4);
  const afterHarvest = P.quests.gus.step;
  // build six pieces
  meet(0);
  P.mats.wood = 200;
  let built = 0;
  for (let i = 0; i < 24 && built < 6; i++) {
    const s = B.spot(P, ['wall', 'floor', 'ramp'][i % 3], (i * Math.PI) / 4, 0);
    if (B.place(P, s, 'wood')) built++;
  }
  step(0.4);
  return { harvest: P.stats.harvest, afterHarvest, built, step: P.quests.gus.step, track: document.querySelector('.quests')?.textContent };
});
check('harvesting 60 materials, then building 6 pieces, moves the quest to "Return to Grandpa Gus"', gus2.harvest >= 60 && gus2.afterHarvest === 1 && gus2.built === 6 && gus2.step === 2, JSON.stringify(gus2));
await waitFor(() => !!document.querySelector('.qt.ready'), 5000);
const trk =await ev(() => document.querySelector('.qt.ready')?.textContent);
check('tracker highlights the hand-in step', /Return to Grandpa Gus/.test(trk || ''), trk);

await ev(() => { meet(0); window.bucks0 = __bi.game.player.bucks; window.picks0 = __bi.game.loot.pickups.length; });
await waitFor(() => /Hand in quest to Grandpa Gus/.test(__bi.game.controller.prompt?.text || ''), 5000);
const hp = await ev(() => __bi.game.controller.prompt?.text);
await key('KeyE');
await waitFor(() => __bi.game.player.quests.gus.done, 3000);
const gus3 = await ev(() => {
  const g = __bi.game, P = g.player, n = g.quests.npcs[0];
  const pk = g.loot.pickups.slice(picks0).find((k) => k.it.kind === 'weapon');
  return { done: P.quests.gus.done, bucks: P.bucks - bucks0, quests: P.stats.quests, reward: pk && `${pk.it.id}/${pk.it.rarity}`, near: pk && pk.pos.distanceTo(n.pos) < 3, mark: n.markSym };
});
await p.waitForTimeout(300);
await p.screenshot({ path: `${shots}/m7-02-handin.png` });
check('handing in pays 150 Benton Bucks and drops an Epic Night Pump at their feet; marker turns ✓', /Hand in quest/.test(hp) && gus3.done && gus3.bucks === 150 && gus3.quests === 1 && gus3.reward === 'shotgun/3' && gus3.near && gus3.mark === '✓', JSON.stringify({ hp, ...gus3 }));

// ---- Captain Kay: find three tackle boxes
await ev(() => meet(1));
await waitFor(() => /Captain Kay/.test(__bi.game.controller.prompt?.text || ''), 5000);
await key('KeyE');
await waitFor(() => !!__bi.game.player.quests?.kay, 3000);
await frames();
const kay1 = await ev(() => ({ shown: __bi.game.quests.tackle.filter((t) => t.mesh.visible).length }));
const kay2 = await ev(() => {
  const g = __bi.game, P = g.player, T = g.quests.tackle;
  const seen = [];
  for (const t of T.slice(0, 3)) { put(P, t.pos.x, t.pos.z, t.pos.y + 2); step(0.35); seen.push(P.quests.kay.got.length); }
  step(0.2);
  return { seen, step: P.quests.kay.step, shown: T.filter((t) => t.mesh.visible).length };
});
check("Captain Kay's quest shows all 6 tackle boxes; walking over 3 collects them and hides them", kay1.shown === 6 && kay2.seen.join() === '1,2,3' && kay2.step === 1 && kay2.shown === 0, JSON.stringify({ kay1, kay2 }));
await ev(() => { meet(1); window.bucks0 = __bi.game.player.bucks; window.picks0 = __bi.game.loot.pickups.length; });
await waitFor(() => /Hand in quest to Captain Kay/.test(__bi.game.controller.prompt?.text || ''), 5000);
await key('KeyE');
await waitFor(() => __bi.game.player.quests.kay.done, 3000);
const kay3 = await ev(() => { const g = __bi.game, P = g.player; const pk = g.loot.pickups.slice(picks0).find((k) => k.it.kind === 'weapon'); return { bucks: P.bucks - bucks0, reward: pk && `${pk.it.id}/${pk.it.rarity}` }; });
check('Captain Kay pays 200 Benton Bucks and an Epic rifle', kay3.bucks === 200 && kay3.reward === 'ar/3', JSON.stringify(kay3));

// ---- Ranger Rae: scout three places, then an elimination
await ev(() => meet(2));
await waitFor(() => /Ranger Rae/.test(__bi.game.controller.prompt?.text || ''), 5000);
await key('KeyE');
await waitFor(() => !!__bi.game.player.quests?.rae, 3000);
const rae = await ev(() => {
  const g = __bi.game, P = g.player, Q = g.quests;
  for (const pl of Q.places.slice(0, 3)) { put(P, pl.x + 2, pl.z + 2); step(0.3); }
  const scouted = P.quests.rae.seen.length, s1 = P.quests.rae.step;
  const foe = g.actors.find((a) => a.brain && a.alive);
  foe.state = 'ground';
  g.eliminate(foe, P, {});
  step(0.3);
  return { scouted, s1, s2: P.quests.rae.step };
});
check('Ranger Rae: 3 named places scouted, then an elimination, unlocks the hand-in', rae.scouted === 3 && rae.s1 === 1 && rae.s2 === 2, JSON.stringify(rae));
await ev(() => meet(2));
await waitFor(() => /Hand in quest to Ranger Rae/.test(__bi.game.controller.prompt?.text || ''), 5000);
await key('KeyE');
const raeDone = await waitFor(() => __bi.game.player.quests.rae.done, 3000);
await ev(() => meet(2));
await waitFor(() => /Say hi to Ranger Rae/.test(__bi.game.controller.prompt?.text || ''), 3000);
const again = await ev(() => { const P = __bi.game.player, b0 = P.bucks; __bi.game.actions.quest(2); return P.bucks - b0; });
check('a finished quest can only be handed in once ("Say hi")', raeDone && again === 0, String(again));

// ---- ramp editing: pick the two tiles on a side to set which way it climbs
const r0 = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  // open flat ground away from everything
  let spot = null;
  for (let x = -100; x <= 100 && !spot; x += 3) for (let z = -100; z <= 100 && !spot; z += 3) {
    const h = g.world.height(x, z);
    if (h < 2 || g.world.physics.query(x - 8, z - 8, x + 8, z + 8).length) continue;
    if (Math.abs(g.world.height(x + 6, z) - h) + Math.abs(g.world.height(x, z + 6) - h) < 0.6) spot = { x, z };
  }
  window.SP = spot;
  put(P, spot.x, spot.z);
  step(0.2);
  P.mats.wood = 200;
  g.controller.yaw = 0; g.controller.pitch = 0;
  const s = B.spot(P, 'ramp', 0, 0);
  window.R = B.place(P, s, 'wood');
  return { dir: R.dir, key: R.key };
});
await p.waitForTimeout(300);
await waitFor(() => __bi.game.controller.aimPiece === R, 4000);
await key('KeyV');
const re0 = await ev(() => { const e = __bi.game.controller.editing; return e ? { n: e.tiles.length, type: e.piece.type, text: document.querySelector('.buildinfo span').textContent } : null; });
// one tile is not a side: refused, still editing
await ev(() => { const e = __bi.game.controller.editing; e.tiles.fill(true); e.tiles[0] = false; });
await key('KeyV');
const bad = await ev(() => ({ editing: !!__bi.game.controller.editing, toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|') }));
// the two tiles on the +x side: the ramp now climbs toward +x
await ev(() => { const e = __bi.game.controller.editing; e.tiles.fill(true); e.tiles[1] = false; e.tiles[3] = false; });
await p.screenshot({ path: `${shots}/m7-03-ramp-edit.png` });
await key('KeyV');
const re1 = await ev(() => {
  const c = R.colliders[0], b = R.box;
  const mz = (b.minZ + b.maxZ) / 2;
  return { editing: !!__bi.game.controller.editing, dir: R.dir, lowWest: c.surfaceY(b.minX + 0.2, mz) < c.surfaceY(b.maxX - 0.2, mz) - 2.5 };
});
check('V on a ramp opens a 2x2 ramp edit with its own hint', re0 && re0.n === 4 && re0.type === 'ramp' && /EDIT RAMP/.test(re0.text), JSON.stringify(re0));
check('picking one tile is refused with a hint (stays in edit)', bad.editing && /2 tiles on the side/.test(bad.toast), JSON.stringify(bad));
check('picking the two +x tiles turns the ramp to climb toward +x (surface agrees)', r0.dir !== 0 && !re1.editing && re1.dir === 0 && re1.lowWest, JSON.stringify({ r0, re1 }));

// ---- cone editing: raise corners
const c0 = await ev(() => {
  const g = __bi.game, P = g.player, B = g.building;
  put(P, SP.x + 1, SP.z + 12);
  step(0.2);
  const s = B.spot(P, 'cone', 0, 0);
  window.C = B.place(P, s, 'wood');
  g.controller.yaw = 0; g.controller.pitch = -0.2;
  return !!C;
});
await p.waitForTimeout(300);
const aimed = await waitFor(() => __bi.game.controller.aimPiece === C, 4000);
await key('KeyV');
const ce0 = await ev(() => { const e = __bi.game.controller.editing; return e ? { type: e.piece.type, n: e.tiles.length, text: document.querySelector('.buildinfo span').textContent, btn: document.querySelector('.buildinfo span') && 1 } : null; });
await ev(() => { const e = __bi.game.controller.editing; e.tiles.fill(true); e.tiles[2] = false; e.tiles[3] = false; }); // raise the two +z corners
await p.screenshot({ path: `${shots}/m7-04-cone-edit.png` });
await key('KeyV');
const ce1 = await ev(() => {
  const g = __bi.game, c = C.colliders[0], b = C.box;
  const top = b.maxY;
  return {
    tiles: C.tiles && C.tiles.map(Number).join(''), raise: c.raise && c.raise.map(Number).join(''),
    cornerUp: Math.abs(c.surfaceY(b.minX + 0.05, b.maxZ - 0.05) - top) < 0.05, cornerDown: c.surfaceY(b.minX + 0.05, b.minZ + 0.05) < b.minY + 0.2,
    stand: g.world.physics.groundAt(b.minX + 0.3, b.maxZ - 0.3, top + 1).y > top - 0.3,
  };
});
check('V on a cone: click corners to raise them; raised corners reach the peak and can be stood on', c0 && aimed && ce0 && ce0.type === 'cone' && ce0.n === 4 && /EDIT CONE/.test(ce0.text) && ce1.tiles === '1100' && ce1.raise === '0011' && ce1.cornerUp && ce1.cornerDown && ce1.stand, JSON.stringify({ ce0, ce1 }));
const ce2 = await ev(() => { const B = __bi.game.building; return { all: B.applyEdit(C, [false, false, false, false]), reset: B.applyEdit(C, null) && C.tiles === null && !C.colliders[0].raise }; });
check('raising all four corners is refused; confirming with nothing raised resets the cone', ce2.all === false && ce2.reset, JSON.stringify(ce2));

// ---- bots that drive
const bot0 = await ev(() => {
  const g = __bi.game, V = g.vehicles;
  const v = V.list.find((x) => x.type === 'truck' && x.alive && !x.seats.some(Boolean));
  const bot = g.actors.find((a) => a.brain && a.alive && !a.downed);
  bot.brain.update = bot.brain._upd;
  bot.hp = 1e6;
  // the bot stands near the truck, the safe zone is far away on the other side of the island
  const f = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) };
  put(bot, v.pos.x + f.z * 4, v.pos.z - f.x * 4, v.pos.y + 3);
  bot.slots = [null, null, null, null, null];
  const S = g.storm;
  const far = { x: -Math.sign(v.pos.x || 1) * 60, z: -Math.sign(v.pos.z || 1) * 60 };
  S.stage = 'shrink'; S.timer = 60; S.center.set(far.x, far.z); S.radius = 30; S.next = { c: S.center.clone(), r: 30 };
  window.BOT = bot; window.VEH = v; window.FAR = far;
  bot.brain.enemy = null;
  bot.brain.think = 0;
  bot.brain.leader = null;
  const d0 = Math.hypot(v.pos.x - far.x, v.pos.z - far.z);
  window.__d0 = d0;
  return { d0, id: bot.id };
});
const entered = await waitFor(() => BOT.vehicle === VEH && BOT.seat === 0, 20000);
const mode = await ev(() => BOT.brain.mode);
const drove = await waitFor(() => Math.hypot(VEH.pos.x - FAR.x, VEH.pos.z - FAR.z) < window.__d0 - 30 || (!BOT.vehicle && Math.hypot(BOT.pos.x - FAR.x, BOT.pos.z - FAR.z) < 60), 30000);
const bot1 = await ev(() => ({ d: Math.round(Math.hypot(VEH.pos.x - FAR.x, VEH.pos.z - FAR.z)), driving: BOT.vehicle === VEH, driven: Math.round(BOT.stats.driven), fuel: Math.round(VEH.fuel) }));
await p.screenshot({ path: `${shots}/m7-05-bot-drive.png` });
check('a bot with a long rotation takes a free truck, drives toward the safe zone and burns fuel', entered && mode === 'drive' && bot1.driven > 25 && bot1.fuel < 100, JSON.stringify({ ...bot0, entered, mode, ...bot1 }));
const bot2 = await ev(() => {
  // when the trip is short, the bot parks and gets out
  const g = __bi.game;
  BOT.brain.goal = new BOT.pos.constructor(VEH.pos.x + 6, 0, VEH.pos.z + 6);
  g.storm.center.set(VEH.pos.x + 6, VEH.pos.z + 6); g.storm.radius = 60; g.storm.next = { c: g.storm.center.clone(), r: 60 };
  BOT.brain.think = 0;
  step(1.5);
  return { out: !BOT.vehicle, seat: VEH.seats[0] === null };
});
check('near the goal the bot gets out and the truck is free again', bot2.out && bot2.seat, JSON.stringify(bot2));

// ---- the result: quest XP, and the new achievement
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const res = await ev(() => { const r = __bi.game.result; return { q: r.quests, qxp: r.questXP, ach: (r.achievements || []).map((a) => a.id), line: [...document.querySelectorAll('.sx-won')].map((e) => e.textContent).find((t) => /Story quest/.test(t)) }; });
await p.screenshot({ path: `${shots}/m7-06-result.png` });
check('result: 3 story quests = +2,250 XP, and the Helping Hand achievement', res.q === 3 && res.qxp === 2250 && /Story quests completed: 3 \(\+2,250 XP\)/.test(res.line || '') && res.ach.includes('quest1'), JSON.stringify(res));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-7 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
