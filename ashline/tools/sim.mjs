/**
 * Headless match simulation: builds Cinder Yard without rendering and runs a
 * bots-only Team Deathmatch. Reports score, kills, stuck bots and timing.
 * Usage: node tools/sim.mjs [minutes=3] [difficulty=regular] [botsPerTeam=5]
 */
import { MapBuilder } from '../src/world/mapBuilder.js';
import { CINDER_YARD } from '../src/world/maps/cinderYard.js';
import { NavGrid } from '../src/world/navgrid.js';
import { Match } from '../src/game/match.js';

const minutes = Number(process.argv[2] || 3);
const difficulty = process.argv[3] || 'regular';
const per = Number(process.argv[4] || 5);
const mode = process.argv[5] || 'tdm';

const b = new MapBuilder({ headless: true });
CINDER_YARD.build(b);
const nav = new NavGrid(b.world, CINDER_YARD.bounds, 1);
const map = { world: b.world, nav, spawns: b.spawns, hotspots: b.hotspots, def: CINDER_YARD };
const match = new Match(map, {
  mode, scoreLimit: mode === 'tdm' || mode === 'ffa' ? 999 : mode === 'elim' ? 99 : mode === 'gun' ? 0 : 9999, timeLimit: mode === 'elim' ? 1.5 : minutes, botsAllies: per, botsEnemies: per,
  difficulty, friendlyFire: false, includePlayer: false, countdown: 0.1,
});
const counts = { objective: 0, roundEnd: 0, kill: 0, shot: 0, damage: 0, grenadeThrown: 0, explosion: 0, melee: 0, smoke: 0, flash: 0, flashed: 0, shield: 0, supportEarned: 0, supportUsed: 0, supplyPickup: 0 };
const kinds = {};
const weaponsK = {};
const objK = {};
match.on((e) => {
  if (e.type === 'objective') objK[e.kind] = (objK[e.kind] || 0) + 1;
  if (counts[e.type] !== undefined) counts[e.type]++;
  if (e.type === 'kill') { kinds[e.kind] = (kinds[e.kind] || 0) + 1; weaponsK[e.weapon] = (weaponsK[e.weapon] || 0) + 1; }
});
match.start();
const dt = 1 / 60;
const t0 = performance.now();
// stuck tracking: bots alive that haven't moved >1m in 15s
const track = new Map();
let stuckReports = 0;
const heat = new Map();
let steps = 0;
while (match.state !== 'ended' && steps < minutes * 60 * 60 + 600) {
  match.tick(dt);
  steps++;
  if (steps % 60 === 0) {
    for (const c of match.combatants) {
      if (!c.alive) { track.delete(c.id); continue; }
      const k = `${Math.floor(c.x / 8)},${Math.floor(c.z / 8)}`;
      heat.set(k, (heat.get(k) || 0) + 1);
      const tr = track.get(c.id);
      if (!tr) { track.set(c.id, { x: c.x, z: c.z, t: match.time }); continue; }
      if (Math.hypot(c.x - tr.x, c.z - tr.z) > 1.5) { track.set(c.id, { x: c.x, z: c.z, t: match.time }); continue; }
      if (match.time - tr.t > 15 && c.brain.state !== 'cover' && !(c.brain.state === 'engage' && c.loadout.primary === 'sr_longreach')) {
        stuckReports++;
        if (stuckReports < 12) console.log(`STUCK? ${c.name} ${c.loadout.primary} cur=${c.cur} mag=${c.weapon.mag} tgt=${c.brain.target ? Math.hypot(c.brain.target.x - c.x, c.brain.target.z - c.z).toFixed(1) + "m" : "none"} t${c.team} at (${c.x.toFixed(1)},${c.y.toFixed(2)},${c.z.toFixed(1)}) state=${c.brain.state} goal=${c.brain.goalName} path=${c.brain.path ? c.brain.path.length - c.brain.pathIdx : 'none'}`);
        track.set(c.id, { x: c.x, z: c.z, t: match.time });
      }
    }
  }
}
const ms = performance.now() - t0;
console.log(`sim ${minutes} min @${difficulty} ${per}v${per}: ${(ms / 1000).toFixed(2)}s real (${(steps / (ms / 1000)).toFixed(0)} ticks/s)`);
console.log('mode', mode, 'team scores', match.teamScores.join(','), 'state', match.state, 'winner', match.winner, 'reason', match.endReason);
if (match.flags) console.log('flags', match.flags.map((f) => `${f.id}:${f.owner}`).join(' '));
if (match.hp) console.log('hardpoint zone', match.hp.idx);
if (match.round) console.log('round', match.round.n);
const objKinds = {};
match.on(() => {});
console.log('events', counts, 'kill kinds', kinds, 'by weapon', weaponsK);
const groups = match.scoreboard();
for (const rows of groups) for (const r of rows) console.log(`  t${r.c.team} ${r.c.name.padEnd(10)} ${r.c.loadout.primary.padEnd(13)} K${r.kills} D${r.deaths} A${r.assists} acc ${(r.shots ? r.hits / r.shots * 100 : 0).toFixed(0)}% hs ${r.headshots} score ${r.score}`);
console.log('stuck reports', stuckReports, 'objective events', JSON.stringify(objK));
const cells = [...heat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('hot cells (8m grid):', cells.map(([k, v]) => `${k}:${v}`).join(' '));
