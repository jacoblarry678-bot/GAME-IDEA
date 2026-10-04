/**
 * Headless rules tests (Node, no browser): movement, mantle, slide, weapons,
 * damage rules, grenades, spawns. Usage: node tools/test.mjs
 */
import { MapBuilder } from '../src/world/mapBuilder.js';
import { CINDER_YARD } from '../src/world/maps/cinderYard.js';
import { NavGrid } from '../src/world/navgrid.js';
import { Match } from '../src/game/match.js';
import { Combatant, MOVE } from '../src/entities/combatant.js';
import { WEAPONS, EQUIPMENT, damageAt } from '../src/data/weapons.js';
import { WeaponState } from '../src/combat/weaponState.js';

let pass = 0, fail = 0;
const t = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const b = new MapBuilder({ headless: true });
CINDER_YARD.build(b);
const nav = new NavGrid(b.world, CINDER_YARD.bounds, 1);
const map = { world: b.world, nav, spawns: b.spawns, hotspots: b.hotspots, def: CINDER_YARD };
const LO = { primary: 'ar_kv7', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' };

function mkMatch(extra = {}) {
  const m = new Match(map, { mode: 'tdm', scoreLimit: 75, timeLimit: 10, botsAllies: 0, botsEnemies: 0, difficulty: 'regular', friendlyFire: false, includePlayer: true, playerLoadout: LO, countdown: 0, ...extra });
  m.start();
  m.state = 'live';
  return m;
}
function place(c, x, y, z, yaw = 0) { c.x = x; c.y = y; c.z = z; c.vx = c.vy = c.vz = 0; c.yaw = yaw; c.cmd.yaw = yaw; c.cmd.pitch = 0; c.grounded = true; c.stance = 'stand'; c.alive = true; c.spawnProtectT = 0; }
function run(m, secs, fn) { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { fn?.(i); m.tick(1 / 60); } }
function addEnemy(m, team = 1, lo = LO) { const c = new Combatant({ name: 'T', team, isBot: true, loadout: lo }); m.add(c); c.alive = true; c.health = 100; return c; }

// ---------------- movement ----------------
{
  const m = mkMatch(); const p = m.player;
  // open area east of the booth: x 12..30, z -1..-4 is open asphalt (rail lane between tracks)
  place(p, 12, 0, -1.5, -Math.PI / 2); // facing +X
  p.cmd.moveZ = 1;
  run(m, 1.0);
  const x1 = p.x;
  run(m, 1.0);
  const walk = p.x - x1;
  t('walk speed ≈ 5 m/s (AR)', Math.abs(walk - MOVE.walk * WEAPONS.ar_kv7.handling.move) < 0.3, walk.toFixed(2));
  place(p, 12, 0, -1.5, -Math.PI / 2);
  p.cmd.moveZ = 1; p.cmd.sprint = true;
  run(m, 0.6);
  const xs = p.x; run(m, 1.0);
  t('sprint faster than walk', p.x - xs > walk + 1.5, (p.x - xs).toFixed(2));
  p.cmd.sprint = false; p.cmd.moveZ = 0;
  run(m, 0.5);
  // jump height
  place(p, 14, 0, -1.5, -Math.PI / 2);
  let peak = 0;
  run(m, 1.2, (i) => { p.cmd.jump = i < 2; peak = Math.max(peak, p.y); });
  t('jump apex ~0.9–1.1 m', peak > 0.8 && peak < 1.15, peak.toFixed(2));
  t('lands back on ground', p.grounded && Math.abs(p.y) < 0.01);
  // crouch lowers eye and speed
  place(p, 12, 0, -1.5, -Math.PI / 2);
  p.cmd.crouch = true; p.cmd.moveZ = 1;
  run(m, 0.3); const xc = p.x; run(m, 1.0);
  t('crouch walk ≈ 2.7 m/s', Math.abs((p.x - xc) - MOVE.crouch) < 0.3, (p.x - xc).toFixed(2));
  t('crouch eye height lower', p.eyeHeight < 1.2);
  p.cmd.crouch = false; p.cmd.moveZ = 0; run(m, 0.2);
  t('stands back up', p.stance === 'stand');
  // slide
  place(p, 10, 0, -1.5, -Math.PI / 2);
  p.cmd.moveZ = 1; p.cmd.sprint = true; run(m, 0.8);
  p.cmd.crouch = true; const xsl = p.x; run(m, 0.05);
  t('sprint + crouch starts a slide', p.stance === 'slide', p.stance);
  run(m, 0.7);
  t('slide covers more ground than crouch-walk', p.x - xsl > 3.5, (p.x - xsl).toFixed(2));
  p.cmd.crouch = false; p.cmd.sprint = false; p.cmd.moveZ = 0; run(m, 0.6);
  // walls block
  place(p, -1.6 - 1.0, 0, 0, -Math.PI / 2); // just west of control booth wall (booth -1.7..1.7)
  p.cmd.moveZ = 1; run(m, 1.5);
  t('cannot walk through booth wall', p.x < -1.7 - p.radius + 0.05 || Math.abs(p.z) < 0.5, `x=${p.x.toFixed(2)} z=${p.z.toFixed(2)}`);
  p.cmd.moveZ = 0;
  // stairs onto the 1.2 m dock (front stairs at z -1.4..1.4, east side x -41.2..-39.2)
  place(p, -37.5, 0, 0, Math.PI / 2); // facing -X
  p.cmd.moveZ = 1; run(m, 1.6);
  t('walks up dock stairs', p.y > 1.15, `y=${p.y.toFixed(2)} x=${p.x.toFixed(2)}`);
  p.cmd.moveZ = 0;
  // mantle onto a 1.2 m crate: crate at (9, 3.2) size 1.2 → x 8.4..9.6
  place(p, 7.6, 0, 3.2, -Math.PI / 2);
  run(m, 0.6, (i) => { p.cmd.moveZ = 1; p.cmd.jump = i < 2; });
  p.cmd.moveZ = 0; p.cmd.jump = false; run(m, 0.3);
  t('mantles onto 1.2 m crate', p.y > 1.15, `y=${p.y.toFixed(2)}`);
  // vault over a jersey barrier (0.85 m): barrier at (-6.5,-2.2) along Z (x -6.81..-6.19)
  place(p, -7.6, 0, -2.2, -Math.PI / 2);
  run(m, 0.9, (i) => { p.cmd.moveZ = 1; p.cmd.jump = i < 2; });
  p.cmd.moveZ = 0; p.cmd.jump = false; run(m, 0.3);
  t('vaults jersey barrier', p.x > -6.1, `x=${p.x.toFixed(2)} y=${p.y.toFixed(2)}`);
  // perimeter is sealed
  place(p, 46.5, 0, 0, -Math.PI / 2); p.cmd.moveZ = 1; run(m, 2); p.cmd.moveZ = 0;
  t('perimeter wall blocks leaving the map', p.x < 48, p.x.toFixed(2));
}

// ---------------- weapons ----------------
{
  for (const [id, d] of Object.entries(WEAPONS)) {
    const w = new WeaponState(d);
    let shots = 0, time = 0;
    while (time < 1.0) { if (w.fire(time)) shots++; w.update(1 / 240); time += 1 / 240; }
    const expect = Math.min(d.mag, Math.floor(d.rpm / 60) + 1);
    if (!d.melee && !d.burst) t(`${d.name}: fire rate ${d.rpm} rpm`, Math.abs(shots - expect) <= 1, `${shots} shots/s`);
    if (d.melee) { t(`${d.name}: melee weapon never reloads`, !new WeaponState(d).canReload); continue; }
    // reload timing
    const w2 = new WeaponState(d); w2.mag = d.tube ? d.mag - 2 : 0;
    w2.startReload();
    let rt = 0; while (w2.reloading && rt < 10) { w2.update(1 / 240); rt += 1 / 240; }
    const exp = d.tube ? d.tube.start + 2 * d.tube.perShell + d.tube.end : d.reloadEmpty;
    t(`${d.name}: reload ${exp.toFixed(2)}s refills`, Math.abs(rt - exp) < 0.05 && w2.mag === d.mag, `${rt.toFixed(2)}s mag=${w2.mag} res=${w2.reserve}`);
  }
  // shots to kill near range (torso)
  const stk = (id, dist, zone = 'torso') => { const d = WEAPONS[id]; return Math.ceil(100 / (damageAt(d, dist) * d.mult[zone] * (d.pellets || 1))); };
  t('AR 4 shots to kill at 10 m', stk('ar_kv7', 10) === 4, String(stk('ar_kv7', 10)));
  t('SMG 4 shots close', stk('smg_vesper', 8) === 4, String(stk('smg_vesper', 8)));
  t('Sniper one-shot torso', stk('sr_longreach', 40) === 1);
  t('Sniper leg is not one-shot', stk('sr_longreach', 40, 'limb') === 2);
  t('Shotgun one-shot point blank (all pellets)', stk('sg_brakk', 4) === 1);
  t('Pistol 3 shots close', stk('pistol_warden', 5) === 3, String(stk('pistol_warden', 5)));
  // tube reload interrupt
  const sg = new WeaponState(WEAPONS.sg_brakk); sg.mag = 2; sg.startReload();
  for (let i = 0; i < 240 * 0.9; i++) sg.update(1 / 240);
  const magMid = sg.mag; const fired = sg.fire(1);
  t('shotgun can interrupt tube reload to fire', fired && sg.mag === magMid - 1 && !sg.reloading);
}

// ---------------- damage rules ----------------
{
  const m = mkMatch(); const p = m.player;
  place(p, 12, 0, -1.5, -Math.PI / 2);
  const e = addEnemy(m); place(e, 22, 0, -1.5, Math.PI / 2);
  const ally = addEnemy(m, 0); place(ally, 14, 0, 2.5, 0);
  // fire at enemy: aim at chest
  p.cmd.pitch = Math.atan2(1.25 - 1.62, 10); p.cmd.yaw = -Math.PI / 2;
  let hits = 0;
  m.on((ev) => { if (ev.type === 'damage' && ev.attacker === p) hits++; });
  p.weapon.def.spread.hip = 0; // deterministic
  run(m, 0.6, () => { p.cmd.fire = true; p.cmd.ads = true; });
  p.cmd.fire = false;
  t('player shots hit and kill an enemy in the open', !e.alive && hits >= 4, `hits=${hits} alive=${e.alive}`);
  t('kill scores for team', m.teamScores[0] === 1 && p.stats.kills === 1);
  WEAPONS.ar_kv7.spread.hip = 3.0;
  // friendly fire off
  m.applyDamage(ally, p, 50, { kind: 'bullet', zone: 'torso' });
  t('friendly fire off protects allies', ally.health === 100);
  // spawn protection
  const e2 = addEnemy(m); place(e2, 20, 0, -3); e2.spawnProtectT = 1.5;
  m.applyDamage(e2, p, 80, { kind: 'bullet', zone: 'torso' });
  t('spawn protection blocks damage', e2.health === 100);
  e2.spawnProtectT = 0;
  // headshot multiplier
  m.applyDamage(e2, p, damageAt(WEAPONS.ar_kv7, 5) * WEAPONS.ar_kv7.mult.head, { kind: 'bullet', zone: 'head' });
  t('headshot multiplier applied', e2.health === 100 - Math.round(30 * 1.4), String(e2.health));
  // assist
  const e3 = addEnemy(m); place(e3, 25, 0, 4);
  m.applyDamage(e3, ally, 40, { kind: 'bullet', zone: 'torso' });
  m.applyDamage(e3, p, 70, { kind: 'bullet', zone: 'torso' });
  t('assist credited to earlier damager', ally.stats.assists === 1 && p.stats.kills === 2);
  // regen
  const e4 = addEnemy(m); place(e4, 28, 0, -4);
  m.applyDamage(e4, p, 60, { kind: 'bullet', zone: 'torso' });
  run(m, 3.0); const hMid = e4.health; run(m, 3.0);
  t('health regenerates after delay', hMid === 40 && e4.health === 100, `${hMid} → ${Math.round(e4.health)}`);
  // friendly fire on
  const m2 = mkMatch({ friendlyFire: true });
  const a2 = addEnemy(m2, 0); place(a2, 10, 0, 0);
  m2.applyDamage(a2, m2.player, 30, { kind: 'bullet', zone: 'torso' });
  t('friendly fire on damages allies', a2.health === 70);
}

// ---------------- grenades ----------------
{
  const m = mkMatch(); const p = m.player;
  place(p, 12, 0, -1.5, -Math.PI / 2);
  const near = addEnemy(m); place(near, 18, 0, -1.5);
  const behind = addEnemy(m); place(behind, 0, 0, 0.2); // inside control booth? booth is around (0,0)
  // throw a frag toward the near enemy
  p.cmd.pitch = 0.05; p.cmd.lethal = true; run(m, 0.05); p.cmd.lethal = false;
  run(m, 0.6);
  t('frag thrown', m.projectiles.list.length === 1 || m.projectiles.list.some((g) => g.kind === 'frag'));
  const g = m.projectiles.list[0];
  if (g) { g.x = 18; g.z = -1.2; g.y = 0.1; g.rest = true; g.fuse = 0.01; }
  run(m, 0.1);
  t('frag damages enemy in blast radius', !near.alive || near.health < 60, `hp=${near.health}`);
  // walls block blast: put enemy behind booth wall from the blast
  const m2 = mkMatch(); const v = addEnemy(m2); place(v, 0, 0, 0); // center inside booth
  m2.projectiles.list.push({ id: 99, kind: 'frag', def: { damage: 150, innerRadius: 2.4, radius: 7, minDamage: 15 }, owner: m2.player, x: 0, y: 0.1, z: -3.2, vx: 0, vy: 0, vz: 0, fuse: 0, rest: true, spin: 0 });
  run(m2, 0.05);
  t('booth walls shield from blast outside', v.health === 100, `hp=${v.health}`);
  // smoke blocks sight
  const m3 = mkMatch();
  m3.projectiles.smokes.push({ x: 20, y: 1.4, z: -1.5, r: 4.8, maxR: 4.8, age: 3, duration: 14 });
  t('smoke blocks line of sight', !m3.canSee(12, 1.6, -1.5, 30, 1.6, -1.5));
  t('clear line of sight without smoke', m3.canSee(12, 1.6, 4.0, 30, 1.6, 4.0));
}

// ---------------- spawns ----------------
{
  const m = new Match(map, { mode: 'tdm', scoreLimit: 75, timeLimit: 10, botsAllies: 4, botsEnemies: 5, difficulty: 'regular', friendlyFire: false, includePlayer: true, playerLoadout: LO, countdown: 0 });
  m.start();
  let ok = true, minD = Infinity;
  for (const c of m.combatants) {
    const r = c.radius;
    if (m.world.overlaps(c.x - r, c.y + 0.05, c.z - r, c.x + r, c.y + 1.7, c.z + r)) ok = false;
    for (const o of m.combatants) if (o !== c && o.team !== c.team) minD = Math.min(minD, Math.hypot(o.x - c.x, o.z - c.z));
  }
  t('initial spawns are clear of geometry', ok);
  t('initial teams spawn far apart', minD > 50, minD.toFixed(1));
  // respawn away from enemies
  m.state = 'live';
  const p = m.player;
  for (const e of m.combatants) if (e.team === 1) { e.x = -40; e.z = 0; }
  m.kill(p, null, { weapon: 'fall', kind: 'fall' });
  m.respawn(p);
  let near = Infinity; for (const e of m.combatants) if (e.team === 1) near = Math.min(near, Math.hypot(e.x - p.x, e.z - p.z));
  t('respawn avoids enemy-held area', near > 25, `nearest enemy ${near.toFixed(1)} m`);
}

// ---------------- match flow ----------------
{
  const m = new Match(map, { mode: 'tdm', scoreLimit: 3, timeLimit: 10, botsAllies: 0, botsEnemies: 1, difficulty: 'regular', friendlyFire: false, includePlayer: true, playerLoadout: LO, countdown: 0 });
  m.start(); m.state = 'live';
  const e = m.combatants.find((c) => c.isBot);
  for (let i = 0; i < 3; i++) { m.respawn(e); e.spawnProtectT = 0; m.applyDamage(e, m.player, 200, { kind: 'bullet', zone: 'torso' }); }
  t('score limit ends match with winner', m.state === 'ended' && m.winner === 0 && m.endReason === 'score');
  const m2 = new Match(map, { mode: 'tdm', scoreLimit: 50, timeLimit: 0.05, botsAllies: 0, botsEnemies: 0, difficulty: 'regular', friendlyFire: false, includePlayer: true, playerLoadout: LO, countdown: 0 });
  m2.start(); m2.state = 'live';
  run(m2, 4);
  t('time limit with tied score is a draw', m2.state === 'ended' && m2.winner === -1 && m2.endReason === 'time');
}

// ---------------- modes ----------------
{
  const mk = (mode, extra = {}) => { const m = new Match(map, { mode, scoreLimit: 50, timeLimit: 10, botsAllies: 0, botsEnemies: 0, difficulty: 'regular', friendlyFire: false, includePlayer: true, playerLoadout: LO, countdown: 0, ...extra }); m.start(); m.state = 'live'; return m; };
  // Domination: capture alone takes ~8 s, then scores every 2 s
  const d = mk('dom');
  const A = d.flags[0];
  place(d.player, A.x, 0, A.z);
  run(d, 4);
  t('dom: half-captured after 4 s alone', A.owner === -1 && A.progress > 0.4 && A.progress < 0.6, A.progress.toFixed(2));
  run(d, 4.5);
  t('dom: captured after ~8 s', A.owner === 0);
  const s0 = d.teamScores[0]; run(d, 4.1);
  t('dom: held flag scores 1 point / 2 s', d.teamScores[0] - s0 === 2, String(d.teamScores[0] - s0));
  const e = addEnemy(d); place(e, A.x + 1, 0, A.z); e.spawnProtectT = 0;
  run(d, 1);
  t('dom: enemy on the flag contests it', A.contested && A.owner === 0);
  // Hardpoint
  const h = mk('hp', { scoreLimit: 999 });
  const z = h.zones[0];
  place(h.player, z.x + z.w / 2 - 0.6, 0, z.z + z.d / 2 - 0.6);
  run(h, 5.05);
  t('hp: holding the zone scores 1 / s', h.teamScores[0] === 5, String(h.teamScores[0]));
  run(h, 60);
  t('hp: zone rotates after 60 s', h.hp.idx === 1);
  // Elimination
  const el = mk('elim', { scoreLimit: 2, timeLimit: 2 });
  const foe = addEnemy(el); place(foe, 20, 0, 0); foe.spawnProtectT = 0;
  el.applyDamage(foe, el.player, 200, { kind: 'bullet', zone: 'torso' });
  t('elim: wiping the enemy team wins the round', el.teamScores[0] === 1 && el.round.phase === 'post');
  run(el, 2);
  t('elim: no respawn during the round', !foe.alive);
  run(el, 3);
  t('elim: next round respawns everyone', foe.alive && el.round.n === 2);
  // Gun Game
  const g = mk('gun', { scoreLimit: 0 });
  const v = addEnemy(g, 1); v.gunLevel = 0; place(v, 20, 0, 0); v.spawnProtectT = 0;
  const lv0 = g.player.weapon.def.id;
  g.applyDamage(v, g.player, 200, { kind: 'bullet', zone: 'torso', weapon: lv0 });
  t('gun: a kill advances to the next weapon', g.player.gunLevel === 1 && g.player.weapon.def.id === g.ladder[1], g.player.weapon.def.id);
  g.respawn(v); v.spawnProtectT = 0; v.gunLevel = 2;
  g.applyDamage(g.player, v, 200, { kind: 'melee', zone: 'torso', weapon: 'melee' });
  t('gun: melee kill sets the victim back', g.player.gunLevel === 0 && v.gunLevel === 2);
  g.respawn(g.player); g.player.spawnProtectT = 0;
  for (let i = 0; i < g.ladder.length; i++) { g.respawn(v); v.spawnProtectT = 0; g.applyDamage(v, g.player, 200, { kind: 'bullet', zone: 'torso' }); }
  t('gun: finishing the ladder wins', g.state === 'ended' && g.winner === g.player.team);
  // FFA
  const f = mk('ffa', { scoreLimit: 2, botsEnemies: 3 });
  t('ffa: everyone on their own team', new Set(f.combatants.map((c) => c.team)).size === 4 && f.teamScores.length === 4);
  const bots = f.combatants.filter((c) => c.isBot);
  for (const bt of bots.slice(0, 2)) { bt.spawnProtectT = 0; f.applyDamage(bt, f.player, 200, { kind: 'bullet', zone: 'torso' }); }
  t('ffa: first to the limit wins', f.state === 'ended' && f.winner === 0);
}

// ---------------- progression & economy (local profile) ----------------
{
  const store = {};
  globalThis.window = { localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  const { Profile, xpToNext } = await import('../src/core/profile.js');
  const { SEASON, PASS_TIERS } = await import('../src/data/season.js');
  const { BUNDLES, bundlePrice, itemPrice } = await import('../src/data/shop.js');
  const { COSMETICS } = await import('../src/data/cosmetics.js');
  const { periodKeys } = await import('../src/data/challenges.js');
  let pr = new Profile();
  t('new profile starts at level 1 with test credits', pr.data.level === 1 && pr.data.credits === SEASON.startingCredits);
  // level-ups grant level unlocks
  const lv = pr.addXp(xpToNext(1) + xpToNext(2) + xpToNext(3) + xpToNext(4));
  t('XP raises level and grants level unlocks', pr.data.level === 5 && pr.owns('fn_graphite') && pr.owns('fn_sand') && pr.owns('em_star') && lv.unlocks.length >= 4, `L${pr.data.level} unlocks=${lv.unlocks.map((i) => i.id)}`);
  // duplicate grant converts to credits
  const c0 = pr.data.credits; const dup = pr.grant('fn_sand', 'test');
  t('duplicate item converts to credits', dup.duplicate && pr.data.credits === c0 + 50);
  // weapon level unlock
  pr.addWeaponXp('ar_kv7', 20000, 10); pr.grantEarnedUnlocks();
  t('weapon level unlocks weapon camo', pr.data.weaponProgress.ar_kv7.level >= 8 && pr.owns('fn_woodland'));
  // equip rules
  t('cannot equip an unowned item', pr.equip('fn_gold', 'ar_kv7') === false);
  t('equip finish per weapon', pr.equip('fn_sand', 'smg_vesper') && pr.data.equipped.weapons.smg_vesper.finish === 'fn_sand' && pr.data.equipped.weapons.ar_kv7.finish === 'fn_factory');
  // battle pass
  t('cannot claim an unreached tier', pr.claim(1, 'free') === null && pr.passTier === 0);
  pr.addPassXp(SEASON.xpPerTier * 3 + 10);
  t('pass tier from XP', pr.passTier === 3);
  t('premium track needs premium', pr.claim(1, 'premium') === null);
  const r2 = pr.claim(2, 'free');
  t('claim free tier item', r2 && pr.owns('cd_railbaron'));
  t('no double claim', pr.claim(2, 'free') === null);
  pr.data.credits = 100;
  t('premium purchase blocked without funds', pr.buyPremium().reason === 'funds' && !pr.data.pass.premium);
  pr.data.credits = 2000;
  t('premium purchase with test credits', pr.buyPremium().ok && pr.data.credits === 2000 - SEASON.premiumPrice && pr.data.pass.premium);
  const all = pr.claimAll();
  t('claim all claims reached tiers only', all.length === 5 && pr.owns('op_kestrel') && pr.owns('of_kestrel_std') && !pr.owns(PASS_TIERS[9].premium.item || 'none'), `${all.length} claimed`);
  t('every tier has a premium reward; 50 tiers', PASS_TIERS.length === 50 && PASS_TIERS.every((x) => x.premium));
  // store
  pr.data.credits = 5000;
  const shopId = 'fn_cobalt';
  const b1 = pr.buyItem(shopId);
  t('buy shop item', b1.ok && pr.owns(shopId) && pr.data.credits === 5000 - itemPrice(shopId));
  t('cannot buy owned item', pr.buyItem(shopId).reason === 'owned');
  t('cannot buy non-shop item', pr.buyItem('fn_gold').reason === 'unavailable');
  const bd = BUNDLES.find((x) => x.items.includes('fn_cobalt'));
  const bp = bundlePrice(bd, pr.data.owned);
  t('bundle price excludes owned items', bp.ownedCount === 1 && bp.price < Math.round(bd.items.reduce((s2, i) => s2 + itemPrice(i), 0) * (1 - bd.discount)));
  const cb = pr.data.credits; const rb = pr.buyBundle(bd.id);
  t('buy bundle grants only new items', rb.ok && rb.granted.length === 2 && pr.data.credits === cb - bp.price && bd.items.every((i) => pr.owns(i)));
  t('purchase history logged', pr.data.purchases.length >= 3 && pr.data.purchases.every((h) => typeof h.balance === 'number'));
  pr.data.credits = 0;
  t('insufficient funds for item', pr.buyItem('fn_aurora').reason === 'funds');
  // challenges
  const day0 = Date.UTC(2026, 9, 5, 12); // a Monday
  pr.ensureChallenges(day0);
  const d0 = pr.data.challenges.daily.map((c) => c.id).join();
  pr.ensureChallenges(day0 + 3600e3);
  t('daily challenges stable within a day', pr.data.challenges.daily.map((c) => c.id).join() === d0);
  pr.data.challenges.daily[0].progress = 5;
  pr.ensureChallenges(day0 + 86400e3);
  t('daily challenges reset next UTC day', pr.data.challenges.day === periodKeys(day0).day + 1 && pr.data.challenges.daily.every((c) => c.progress === 0));
  const wk = pr.data.challenges.week;
  pr.ensureChallenges(day0 + 6 * 86400e3);
  t('weekly challenges keep through Sunday', pr.data.challenges.week === wk);
  pr.ensureChallenges(day0 + 7 * 86400e3);
  t('weekly challenges reset Monday', pr.data.challenges.week === wk + 1);
  const huge = { kills: 999, headshots: 999, assists: 999, score: 99999, matches: 9, wins: 9, grenadeKills: 9, meleeKills: 9, longshots: 9, multikills: 99, bestStreak: 20, classKills: { assault: 99, smg: 99, shotgun: 99, sniper: 99, pistol: 99 } };
  const done = pr.applyChallenges(huge, day0 + 7 * 86400e3);
  t('all challenges complete with enough progress', done.length === 8, String(done.length));
  t('completed challenges pay once', pr.applyChallenges(huge, day0 + 7 * 86400e3).length === 0);
  // match rewards once
  const before = pr.data.totalXp;
  const rep = pr.recordMatch('m-1', 'win', { kills: 10, deaths: 4, assists: 2, headshots: 3, shots: 100, hits: 40, score: 1500, bestStreak: 5 }, 300, { classKills: { assault: 10 }, weaponKills: { ar_kv7: 10 }, weaponHeadshots: { ar_kv7: 3 }, weaponsUsed: ['ar_kv7'], difficulty: 'regular' });
  t('match rewards: XP lines and total', rep && rep.total === 1500 + 500 + 500 + 300 + rep.challenges.reduce((a, c) => a + c.xp, 0) && pr.data.totalXp === before + rep.total, rep && `total ${rep.total}`);
  t('same match never rewarded twice', pr.recordMatch('m-1', 'win', { kills: 1, deaths: 0, assists: 0, headshots: 0, shots: 1, hits: 1, score: 100, bestStreak: 1 }, 10, {}) === null);
  // persistence + recovery
  pr.save();
  const pr2 = new Profile();
  t('profile round-trips through storage', pr2.owns('op_kestrel') && pr2.data.pass.premium && pr2.data.equipped.weapons.smg_vesper.finish === 'fn_sand' && pr2.data.totalXp === pr.data.totalXp);
  store['ashline.profile'] = '{not json';
  const pr3 = new Profile();
  t('corrupt save recovers to a valid default profile', pr3.data.level === 1 && pr3.owns('op_voss'));
  store['ashline.profile'] = JSON.stringify({ version: 1, name: 'Old', owned: { bogus_item: { t: 1 } }, equipped: { operator: 'bogus', weapons: { ar_kv7: { finish: 'fn_gold' } } }, loadouts: [{ primary: 'nope' }] });
  const pr4 = new Profile();
  t('v1 / invalid data migrates safely', pr4.data.version === 3 && pr4.data.name === 'Old' && !pr4.owns('bogus_item') && pr4.data.equipped.operator === 'op_voss' && pr4.data.equipped.weapons.ar_kv7.finish === 'fn_factory' && pr4.data.loadouts[0].primary === 'ar_kv7');
  // weapon unlock gating
  store['ashline.profile'] = JSON.stringify({ version: 2, level: 3, loadouts: [{ name: 'X', primary: 'lmg_anvil', secondary: 'melee_axe' }, { name: 'Y', primary: 'ar_tarn', secondary: 'pistol_grizzly' }] });
  const pr5 = new Profile();
  t('locked weapons in a save revert to defaults', pr5.data.loadouts[0].primary === 'ar_kv7' && pr5.data.loadouts[0].secondary === 'pistol_warden' && pr5.data.loadouts[1].primary === 'ar_tarn' && pr5.data.loadouts[1].secondary === 'pistol_warden', JSON.stringify(pr5.data.loadouts.slice(0, 2)));
  t('weapon unlock levels', !pr5.weaponUnlocked('lmg_anvil') && pr5.weaponUnlocked('ar_tarn') && pr5.weaponsUnlockedBetween(1, 6).length === 5, pr5.weaponsUnlockedBetween(1, 6).join());
  t('catalog meets content targets (≥4 operators, ≥8 outfits, ≥20 finishes)', ['operator', 'outfit', 'finish'].map((k) => Object.values(COSMETICS).filter((i) => i.type === k).length).join() === '4,12,25');
}

// ---------------- M4 weapons ----------------
{
  t('16 weapons: 4 AR, 3 SMG, 2 SG, 2 sniper/DMR, 2 LMG, 2 pistols, 1 melee', (() => { const c = {}; for (const w of Object.values(WEAPONS)) c[w.class] = (c[w.class] || 0) + 1; return Object.keys(WEAPONS).length === 16 && c.assault === 4 && c.smg === 3 && c.shotgun === 2 && c.sniper === 2 && c.lmg === 2 && c.pistol === 2 && c.melee === 1; })());
  // burst: one trigger pull fires exactly three rounds
  const m = mkMatch({ playerLoadout: { ...LO, primary: 'ar_meridian' } }); const p = m.player;
  place(p, 12, 0, -1.5, -Math.PI / 2);
  const mag0 = p.weapon.mag;
  run(m, 0.6, (i) => { p.cmd.fire = i < 2; });
  t('Meridian: one trigger pull = 3-round burst', mag0 - p.weapon.mag === 3, `${mag0 - p.weapon.mag} rounds`);
  run(m, 1.0, () => { p.cmd.fire = true; });
  const held = mag0 - p.weapon.mag;
  run(m, 1.0, (i) => { p.cmd.fire = i % 30 < 3; });
  t('Meridian: held trigger = one burst, each re-pull = another', held === 6 && mag0 - p.weapon.mag === 9, `held ${held}, total ${mag0 - p.weapon.mag}`);
  // axe: one swing downs a full-health enemy at 2 m; no ADS
  const m2 = mkMatch({ playerLoadout: { ...LO, secondary: 'melee_axe' } }); const p2 = m2.player;
  place(p2, 12, 0, -1.5, -Math.PI / 2);
  const e = addEnemy(m2); place(e, 14, 0, -1.5, Math.PI / 2);
  run(m2, 0.8, (i) => { p2.cmd.swapTo = i === 0 ? 1 : -1; });
  t('axe equipped', p2.weapon.def.id === 'melee_axe');
  run(m2, 1.0, (i) => { p2.cmd.fire = i < 2; p2.cmd.ads = true; });
  t('axe: one swing kills at 2 m', !e.alive, `hp=${e.health}`);
  t('axe: cannot aim down sights', p2.adsT === 0);
  // suppressed SMG makes less noise than an unsuppressed one
  t('Hollow is suppressed (no radar ping)', WEAPONS.smg_hollow.suppressed === true);
}

// ---------------- M4 attachments / perks / equipment / support ----------------
{
  const { applyAttachments, attachmentsFor, sanitizeBuild, ATTACHMENTS } = await import('../src/data/attachments.js');
  const base = WEAPONS.ar_kv7;
  const avail = attachmentsFor(base);
  t('attachments: each gun has options, melee has none', avail.length >= 12 && attachmentsFor(WEAPONS.melee_axe).length === 0 && Object.keys(WEAPONS).filter((id) => id !== 'melee_axe').every((id) => attachmentsFor(WEAPONS[id]).length >= 5), `${avail.length} for KV-7`);
  t('attachments unlock across weapon levels 2–19', avail[0].level === 2 && avail[avail.length - 1].level === 19);
  const ext = applyAttachments(base, { magazine: 'mg_ext' });
  t('extended mag: +50% rounds, slower reload, same stable id', ext.mag === 45 && ext.reload > base.reload && ext.id === base.id && base.mag === 30);
  const sup = applyAttachments(base, { muzzle: 'mz_supp' });
  t('suppressor: suppressed, shorter range', sup.suppressed && sup.damage.end < base.damage.end && sup.audio.kind === 'suppressed');
  t('every attachment has a drawback', Object.values(ATTACHMENTS).every((a) => a.cons.length > 0 && a.pros.length > 0));
  t('builds are sanitized: locked, wrong-slot, unknown and inapplicable dropped', JSON.stringify(sanitizeBuild(base, { optic: 'opt_3x', muzzle: 'mg_ext', barrel: 'nope', magazine: 'mg_ext' }, 6)) === '{"magazine":"mg_ext"}' && Object.keys(sanitizeBuild(WEAPONS.pistol_warden, { optic: 'opt_reflex' })).length === 0);
  // build applies in a match
  const m = mkMatch({ playerLoadout: { ...LO, builds: { ar_kv7: { magazine: 'mg_ext' } }, perks: ['pk_quickdraw', 'pk_hardline', 'pk_resolve'] } });
  const p = m.player;
  t('match uses the attachment build', p.weapon.mag === 45 && p.weapon.def.mag === 45);
  // quickdraw: ADS faster
  place(p, 12, 0, -1.5, -Math.PI / 2);
  run(m, 0.15, () => { p.cmd.ads = true; });
  const qd = p.adsT;
  const m0 = mkMatch(); const p0 = m0.player; place(p0, 12, 0, -1.5, -Math.PI / 2);
  run(m0, 0.15, () => { p0.cmd.ads = true; });
  t('Quickdraw aims faster', qd > p0.adsT + 0.05, `${qd.toFixed(2)} vs ${p0.adsT.toFixed(2)}`);
  // support abilities: Hardline recon at 3 kills
  for (let i = 0; i < 3; i++) { const e = addEnemy(m); place(e, 14, 0, -1.5); m.applyDamage(e, p, 200, { weapon: 'ar_kv7', zone: 'torso', kind: 'bullet' }); }
  t('Hardline: Recon Scan earned at 3 eliminations', p.abilities.recon === 1 && p.abilities.supply === 0, JSON.stringify(p.abilities));
  const e2 = addEnemy(m); place(e2, 30, 0, -1.5);
  p.cmd.support = 'recon'; run(m, 0.05);
  t('Recon Scan reveals enemies to the team', p.abilities.recon === 0 && m.deployables.revealed(e2, 0));
  const ghost = addEnemy(m, 1, { ...LO, perks: ['pk_flak', 'pk_ghost', 'pk_resolve'] }); place(ghost, 25, 0, -1.5);
  t('Ghost hides from Recon Scan', !m.deployables.revealed(ghost, 0));
  // supply drop
  p.abilities.supply = 1; p.weapon.reserve = 0; p.lethal.count = 0; p.health = 50; p.lastDamageT = m.time;
  p.cmd.support = 'supply'; run(m, 0.05);
  const drop = m.deployables.drops[0];
  t('Supply Drop is called in', !!drop && drop.fall > 0);
  place(p, drop.x, drop.y, drop.z + 0.5); run(m, 3.5);
  t('Supply Drop restocks ammo, equipment and health', p.weapon.reserve === p.weapon.def.reserve && p.lethal.count === 1 && p.health === 100);
  // area strike
  const far = addEnemy(m); place(far, 30, 0, -1.5); far.health = 100;
  p.abilities.strike = 1; place(p, 12, 0, -1.5, -Math.PI / 2); p.cmd.pitch = -0.08; run(m, 0.02);
  const before = p.stats.kills;
  p.cmd.support = 'strike'; run(m, 0.05);
  const s = m.deployables.strikes[0];
  t('Area Strike targets the aim point', !!s && s.x > 14, s ? `${s.x.toFixed(1)},${s.z.toFixed(1)}` : 'none');
  place(far, s.x, 0, s.z);
  run(m, 6, () => { place(far, s.x, 0, s.z); });
  t('Area Strike damages enemies in the zone and credits the caller', !far.alive || p.stats.kills > before, `alive=${far.alive} hp=${far.health}`);
  t('strike kills do not advance support streaks', p.supportKills === 3 + 0, `${p.supportKills}`);
  // flash
  const m2 = mkMatch(); const p2 = m2.player; place(p2, 12, 0, -1.5, -Math.PI / 2);
  const fe = addEnemy(m2); place(fe, 20, 0, -1.5, Math.PI / 2);
  const fe2 = addEnemy(m2); place(fe2, 20, 0, -2.5, -Math.PI / 2); // looking away
  m2.projectiles.flash({ x: 19, y: 0.2, z: -2, def: EQUIPMENT.flash, owner: p2 });
  t('flash blinds enemies; facing it blinds longer', fe.blindT > 2 && fe2.blindT > 0 && fe.blindT > fe2.blindT, `${fe.blindT.toFixed(2)} / ${fe2.blindT.toFixed(2)}`);
  // shield
  const m3 = mkMatch({ playerLoadout: { ...LO, tactical: 'shield' } }); const p3 = m3.player; place(p3, 12, 0, -1.5, -Math.PI / 2);
  run(m3, 0.6, (i) => { p3.cmd.tactical = i < 2; });
  const sh = m3.deployables.shields[0];
  t('Bulwark deploys in front of the player', !!sh && sh.x > 12.5, sh ? `${sh.x.toFixed(2)}` : 'none');
  const se = addEnemy(m3); place(se, 22, 0, -1.5, Math.PI / 2); se.health = 100;
  run(m3, 0.4, () => { p3.cmd.crouch = true; });
  const hp0 = sh.hp, aim = Math.atan2(0.75 - 1.62, 10);
  run(m3, 1.0, () => { se.cmd.fire = true; se.cmd.yaw = Math.PI / 2; se.cmd.pitch = aim; p3.cmd.crouch = true; });
  t('Bulwark blocks bullets and takes damage', sh.hp < hp0 && p3.health === 100, `shield ${sh.hp}/${hp0} player ${p3.health}`);
  run(m3, 8, (i) => { se.cmd.fire = i % 2 === 0; se.cmd.pitch = aim; se.cmd.reload = se.weapon.mag === 0; p3.cmd.crouch = true; });
  t('Bulwark breaks after enough damage and frees the space', !m3.deployables.shields.length && !m3.world.overlaps(sh.box.minX, sh.box.minY + 0.1, sh.box.minZ, sh.box.maxX, sh.box.maxY - 0.1, sh.box.maxZ), `hp ${sh.hp}`);
  // flak
  const m4 = mkMatch({ playerLoadout: { ...LO, perks: ['pk_flak', 'pk_hardline', 'pk_resolve'] } }); const p4 = m4.player; place(p4, 12, 0, -1.5);
  m4.applyDamage(p4, null, 80, { weapon: 'frag', zone: 'torso', kind: 'explosive' });
  t('Flak Lining reduces explosive damage', p4.health === 56, `${p4.health}`);
}

// ---------------- M4 maps ----------------
{
  const { MAPS } = await import('../src/world/maps/index.js');
  t('three maps registered (Cinder Yard, Old Quarter, Signal Station)', Object.keys(MAPS).join() === 'cinder_yard,old_quarter,signal_station');
  for (const def of Object.values(MAPS)) {
    const mb = new MapBuilder({ headless: true });
    def.build(mb);
    const mnav = new NavGrid(mb.world, def.bounds, 1);
    const mmap = { world: mb.world, nav: mnav, spawns: mb.spawns, hotspots: mb.hotspots, def };
    t(`${def.name}: ≥10 spawns per team, 3 flags, 6 hardpoints`, mb.spawns.filter((s) => s.team === 0).length >= 10 && mb.spawns.filter((s) => s.team === 1).length >= 10 && def.objectives.dom.length === 3 && def.objectives.hp.length === 6);
    const spawnsClear = mb.spawns.every((s) => !mb.world.overlaps(s.x - 0.36, s.y + 0.05, s.z - 0.36, s.x + 0.36, s.y + 1.8, s.z + 0.36));
    t(`${def.name}: all spawns clear of geometry`, spawnsClear);
    for (const mode of ['tdm', 'ffa', 'dom', 'hp', 'elim', 'gun']) {
      const m = new Match(mmap, { mode, scoreLimit: mode === 'elim' ? 3 : 9999, timeLimit: 2, botsAllies: 4, botsEnemies: 5, difficulty: 'regular', friendlyFire: false, includePlayer: false, countdown: 0 });
      m.start();
      let kills = 0;
      m.on((e) => { if (e.type === 'kill') kills++; });
      let err = null;
      try { for (let i = 0; i < 60 * 45; i++) m.tick(1 / 60); } catch (e) { err = e; }
      t(`${def.name}: ${mode} runs 45 s with bots fighting`, !err && kills > 0, err ? err.message : `${kills} kills`);
    }
  }
}

// ---------------- update: pistol buff, Waspinator collab ----------------
{
  const W = WEAPONS.pistol_warden;
  const stk = (d) => Math.ceil(100 / damageAt(W, d));
  t('HX-9 Warden buff: 3 body shots to 14 m, 4 to 32 m; 2 headshots kill; 15-round mag', stk(10) === 3 && stk(14) === 3 && stk(30) === 4 && damageAt(W, 10) * W.mult.head * 2 >= 100 && W.mag === 15 && W.rpm >= 460, `${stk(10)}/${stk(30)} shots`);
  const { COSMETICS } = await import('../src/data/cosmetics.js');
  const { SHOP_ITEMS, BUNDLES, COLLABS, currentRotation, bundlePrice } = await import('../src/data/shop.js');
  const wasp = ['ch_waspinator', 'bn_waspinator'];
  t('Waspinator collab: keychain charm + banner, flagged collab, store-only', wasp.every((id) => COSMETICS[id]?.collab === 'waspinator' && COSMETICS[id].unlock.type === 'shop') && COSMETICS.ch_waspinator.charm.shape === 'waspinator' && COSMETICS.bn_waspinator.art.kind === 'waspinator');
  t('collab items stay out of the daily/weekly rotation and have their own section', !SHOP_ITEMS.some((id) => wasp.includes(id)) && !currentRotation().bundles.some((b) => b.collab) && COLLABS[0].items.join() === wasp.join());
  const { Profile: P2 } = await import('../src/core/profile.js');
  globalThis.window.localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, credits: 5000 }));
  const pc = new P2();
  const b = BUNDLES.find((x) => x.id === 'bd_waspinator');
  const price = bundlePrice(b, pc.data.owned).price;
  const r = pc.buyBundle('bd_waspinator');
  t('collab bundle buys with test credits and grants both items', r.ok && wasp.every((id) => pc.owns(id)) && pc.data.credits === 5000 - price && price === Math.round((1800 + 1000) * 0.8 / 10) * 10, `price ${price}`);
  t('collab bundle cannot be bought twice', pc.buyBundle('bd_waspinator').reason === 'owned');
  pc.equip('ch_waspinator', 'ar_kv7'); pc.equip('bn_waspinator');
  t('collab charm and banner equip', pc.data.equipped.weapons.ar_kv7.charm === 'ch_waspinator' && pc.data.equipped.banner === 'bn_waspinator');
}

// ---------------- hotfix: sealed vault content ----------------
{
  globalThis.localStorage = globalThis.window.localStorage;
  const fs = await import('node:fs');
  const V = await import('../src/core/vault.js');
  const { VAULT } = await import('../src/data/vault.js');
  const { COSMETICS } = await import('../src/data/cosmetics.js');
  const { BUNDLES, COLLABS } = await import('../src/data/shop.js');
  const src = fs.readFileSync(new URL('../src/data/vault.js', import.meta.url), 'utf8');
  const body = src.replace(/^[\s\S]*?export const VAULT/, '');
  t('vault ships sealed: no item ids or names in plaintext', VAULT.length >= 1 && VAULT.every((e) => /^[A-Za-z0-9+/=]+$/.test(e.data)) && !/op_wasp|of_wasp|hive armour|visorhelm|"name"/i.test(body));
  t('vault content is not registered before release', !Object.values(COSMETICS).some((i) => i.vault));
  t('a wrong code opens nothing', (await V.redeem('AAAAA-BBBBB-CCCCC-DDDDD')).length === 0);
  // tampering is detected by GCM authentication
  const bad = { ...VAULT[0], data: VAULT[0].data.slice(0, -6) + (VAULT[0].data.endsWith('AAAA==') ? 'BBBB==' : 'AAAA==') };
  t('tampered ciphertext is rejected', (await V.unseal(bad, 'nope')) === null);
  const code = process.env.VAULT_TEST_CODE;
  if (code) {
    const got = await V.redeem(code.toLowerCase().replace(/-/g, ' '));
    const op = Object.values(COSMETICS).find((i) => i.vault && i.type === 'operator');
    t('release code opens the drop (case/spacing-insensitive) and registers its items', got.length === 1 && !!op && Object.values(COSMETICS).filter((i) => i.vault).length === 2, op?.id);
    t('released skin joins the Store collab section; outfit comes with the operator', COLLABS.some((c) => c.items.includes(op.id)) && Object.values(COSMETICS).some((i) => i.vault && i.type === 'outfit' && i.operator === op.id));
    t('redeeming again is a no-op', (await V.redeem(code)).length === 0);
    const { Profile: P3 } = await import('../src/core/profile.js');
    globalThis.window.localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, credits: 5000 }));
    const pr = new P3();
    const r = pr.buyItem(op.id);
    pr.grantEarnedUnlocks(true);
    pr.equip(op.id);
    pr.save();
    t('released operator skin can be bought with test credits and equipped', r.ok && pr.owns(op.op.outfit) && pr.data.equipped.operator === op.id);
    t('the unlock is remembered for the next launch', JSON.parse(globalThis.localStorage.getItem('ashline.vault')).length === 1);
    const pr2 = new P3();
    t('owned vault skin survives a reload (vault opens before profile validation)', pr2.owns(op.id) && pr2.data.equipped.operator === op.id);
  } else console.log('SKIP  release-code tests (set VAULT_TEST_CODE to run them)');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
