/**
 * Headless rules tests (Node, no browser): movement, mantle, slide, weapons,
 * damage rules, grenades, spawns. Usage: node tools/test.mjs
 */
import { MapBuilder } from '../src/world/mapBuilder.js';
import { CINDER_YARD } from '../src/world/maps/cinderYard.js';
import { NavGrid } from '../src/world/navgrid.js';
import { Match } from '../src/game/match.js';
import { Combatant, MOVE } from '../src/entities/combatant.js';
import { WEAPONS, damageAt } from '../src/data/weapons.js';
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
    t(`${d.name}: fire rate ${d.rpm} rpm`, Math.abs(shots - expect) <= 1, `${shots} shots/s`);
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

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
