/**
 * Hotfix 1.0.1 regression tests: progression, checkpoints and puzzles (no
 * browser). Run: node tools/hotfix/progression.mjs
 * Covers the maintenance lift, the Stillwater valves, item and clue
 * placement, June's escort, the counterweights, the freight return route in
 * the journal, refuge checkpoint spawns and records collected while resting.
 */
import { Game } from '../../src/sim/game.js';
import { CHAPTERS } from '../../src/data/chapters/index.js';
import { Level } from '../../src/sim/level.js';
import { Saves } from '../../src/game/saves.js';
import { addToPouch } from '../../src/sim/equipment.js';
import { available, findTarget } from '../../src/sim/interact.js';

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function ok(c, msg = 'expected true') { if (!c) throw new Error(msg); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/** A game positioned in a chapter (replay entry), with one player. */
function game(ch, opts = {}) {
  const g = new Game({ seed: 11, ...opts });
  g.addPlayer('p1', 'evan', 'Evan');
  g.loadChapter(ch, { entry: 'replay' });
  return g;
}
const P = (g) => g.players.get('p1');
const act = (g, id, a) => g.puzzles.get(id).input(P(g), a);
const run = (g, sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) g.tick(0.05); };
/** Quit and Continue: a fresh game restored from a parsed copy of the held checkpoint. */
function reload(g, players = ['p1']) {
  const snap = JSON.parse(JSON.stringify(g.checkpoint));
  const h = new Game({ seed: 99 });
  for (const id of players) h.addPlayer(id, 'evan', id);
  h.restore(snap);
  h.checkpoint = snap;
  return h;
}
const solve = (g, id, acts) => { for (const a of acts) act(g, id, a); };
const SOLUTION = { P1: ['reset', 'b3', 'b1', 'b2'], P2: ['t2', 't1', 't3', 'local'] };

// ------------------------------------------------------------------ 1 maintenance lift
test('item 1: the maintenance lift opens once P1 and P2 are done, in either order and across checkpoints', () => {
  for (const order of [['P1', 'P2'], ['P2', 'P1']]) {
    let g = game(1);
    for (const id of order) { solve(g, id, SOLUTION[id]); ok(g.story.has(`${id}.done`), `${id} done`); g.makeCheckpoint('test'); g.retry(); }
    for (const label of ['after retry', 'after continue']) {
      if (label === 'after continue') g = reload(g);
      const d = g.level.door('lift');
      ok(g.story.has('T1') && !g.isDoorLocked(d), `${order.join(' then ')} ${label}: lift unlocked`);
      eq(d.target, 1, `${order.join(' then ')} ${label}: lift doors open`);
      ok(available(g, g.level.interById.get('lift1')), `${order.join(' then ')} ${label}: lift controls available`);
    }
    const p = P(g); p.x = 37; p.z = 66;
    g.beginInteract('p1', 'lift1');
    ok(g.transition && g.transition.to === 2, `${order.join(' then ')}: the lift descends`);
  }
});

// ------------------------------------------------------------------ 2 Stillwater valves
const valveView = (g) => g.puzzles.get('P5').view().controls.map((c) => `${c.id}=${c.sub}/${c.state}`);
test('item 2: the drained basin keeps its valve positions after a checkpoint load', () => {
  let g = game(3, { assists: { noDamage: true } });
  P(g).x = 31; P(g).z = 26.9;
  solve(g, 'P5', ['valve:A', 'valve:B', 'valve:C', 'pump']);
  run(g, 8.5);
  ok(g.story.has('P5.done'), 'basin drained');
  const drained = valveView(g);
  for (const s of ['valve:A=CLOSED/off', 'valve:B=OPEN/on', 'valve:C=OPEN/on']) ok(drained.includes(s), `drained view shows ${s}`);
  g.makeCheckpoint('test');
  g.retry();
  eq(valveView(g), drained, 'after retry');
  g = reload(g);
  eq(valveView(g), drained, 'after continue');
  ok(g.puzzles.get('P5').view().display.startsWith('BASIN DRAINED'), 'panel display');
  eq(g.level.door('basin').target, 1, 'basin access gate open');
});
test('item 2: a checkpoint taken mid-pump keeps the valves set and the pump can be restarted', () => {
  const g = game(3, { assists: { noDamage: true } });
  P(g).x = 31; P(g).z = 26.9;
  solve(g, 'P5', ['valve:A', 'valve:B', 'valve:C', 'pump']);
  run(g, 3);
  g.makeCheckpoint('test');
  g.retry();
  const s = g.puzzles.get('P5').state;
  eq([s.A, s.B, s.C, s.pumping], ['closed', 'open', 'open', false], 'valves kept, pump stopped');
  act(g, 'P5', 'pump');
  run(g, 8.5);
  ok(g.story.has('P5.done'), 'pump completes after the reload');
});

// ------------------------------------------------------------------ 3 items and clues
const ITEM_KINDS = ['pickup', 'record', 'note', 'inspect'];
const FLAT_TOPS = new Set(['table', 'desk', 'counter', 'workbench', 'crate', 'bench']);
const levels = () => Object.entries(CHAPTERS).flatMap(([id, def]) => [[`ch${id}`, +id, 'replay', def], ...(def.returnTrip ? [[`ch${id} return`, +id, 'return', def.returnTrip(def)]] : [])]);
/** Can the player actually target `it` (the same findTarget the game uses) from some reachable standing or crouching spot? */
function targetable(g, it, seen) {
  const p = P(g), nav = g.level.nav, W = g.level.world, reach = it.reach || 1.8;
  for (let i = 0; i < nav.walk.length; i++) {
    if (!seen[i]) continue;
    const c = nav.center(i), y = nav.floorY[i];
    if (Math.hypot(c.x - it.x, c.z - it.z) > reach) continue;
    if (W.overlaps(c.x - 0.36, y + 0.05, c.z - 0.36, c.x + 0.36, y + 1.75, c.z + 0.36, 1)) continue;
    for (const crouch of [false, true]) {
      p.x = c.x; p.z = c.z; p.y = y; p.crouched = crouch; p.eyeH = crouch ? 1.0 : 1.62;
      const e = p.eye(), dx = it.x - e.x, dy = it.y - e.y, dz = it.z - e.z;
      p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const t = findTarget(g, p);
      if (t && t.id === it.id) return true;
    }
  }
  return false;
}
test('item 3: every item and clue in every chapter and return trip can be targeted from a reachable spot', () => {
  const bad = [];
  for (const [label, ch, entry] of levels()) {
    const g = new Game({ seed: 3 }); g.addPlayer('p1', 'evan', 'Evan'); g.loadChapter(ch, { entry });
    const st = g.chapterDef.start, seen = g.level.nav.reachable(st.x, st.z, null, () => 0);
    for (const it of g.level.interactables) {
      if (!ITEM_KINDS.includes(it.kind) || it.noTarget) continue;
      for (const f of [].concat(it.requires || [])) g.story.flags[f] = true;
      if (!available(g, it)) continue;
      if (!targetable(g, it, seen)) bad.push(`${label} ${it.id}`);
    }
  }
  eq(bad, [], 'untargetable');
});
test('item 3: no item or clue lies beneath a table, desk, counter or bench top', () => {
  const bad = [];
  for (const [label, , , def] of levels()) {
    const L = new Level(def);
    for (const it of L.interactables) {
      if (!ITEM_KINDS.includes(it.kind)) continue;
      for (const pr of L.props) {
        const b = pr.box;
        if (!b || !FLAT_TOPS.has(pr.k)) continue;
        if (it.x > b.minX && it.x < b.maxX && it.z > b.minZ && it.z < b.maxZ && it.y > b.minY + 0.1 && it.y < b.maxY - 0.01) bad.push(`${label} ${it.id} under the ${pr.k} at ${pr.x}, ${pr.z}`);
      }
    }
  }
  eq(bad, [], 'buried');
});

// ------------------------------------------------------------------ 4 June's rescue
function juneWalking(opts = {}) {
  const g = game(4, opts);
  for (const f of ['P7.done', 'P8.done', 'ch4.juneSpoke', 'door.pass.unlocked', 'ch4.cartPlaced', 'ch4.roofCross']) g.story.set(f);
  g.persist.refuges['4.09'] = true;
  g.setDoor('pass', true); g.level.door('pass').open = 1;
  P(g).x = 17.0; P(g).z = 31.2;
  g.script.onInteract(g, P(g), g.level.interById.get('juneTalk2'), 'begin');
  ok(g.story.has('ch4.juneWalking'), 'June sets off');
  return g;
}
const june = (g) => g.npcs.find((n) => n.id === 'june');
test('item 4: June reaches Refuge R2 after every reload of a checkpoint taken mid-escort', () => {
  const g = juneWalking({ assists: { noDamage: true } });
  run(g, 6);
  g.makeCheckpoint('test');
  const left = g.checkpoint.npcs.find((n) => n.id === 'june').path.length;
  for (let n = 1; n <= 3; n++) {
    g.retry();
    run(g, 30);
    ok(g.story.has('JUNE_SAFE') && june(g).x < 6, `retry ${n}: June inside R2 (at ${june(g).x.toFixed(1)}, ${june(g).z.toFixed(1)})`);
  }
  eq(g.checkpoint.npcs.find((n) => n.id === 'june').path.length, left, 'checkpoint path untouched by the walk');
});
test('item 4: after Continue June reaches R2, and again after a later retry', () => {
  const g = juneWalking({ assists: { noDamage: true } });
  run(g, 6);
  g.makeCheckpoint('test');
  const h = reload(g);
  run(h, 30);
  ok(h.story.has('JUNE_SAFE'), 'continue: June safe');
  h.retry();
  run(h, 30);
  ok(h.story.has('JUNE_SAFE') && june(h).x < 6, 'retry after continue: June safe');
});
test('item 4: June walks through a closed refuge door into R2', () => {
  const g = juneWalking({ assists: { noDamage: true } });
  P(g).x = 3; P(g).z = 27.5;
  const d = g.level.door('r2'); d.target = d.open = 0; d.box.active = true;
  run(g, 30);
  ok(g.story.has('JUNE_SAFE'), 'June opened the refuge door and arrived');
});

// ------------------------------------------------------------------ 5 counterweights
test('item 5: rapid counterweight presses settle on the seated weights and the brake releases', () => {
  const g = game(5);
  const pz = g.puzzles.get('P9');
  let r = null;
  for (const a of ['w:25', 'w:25', 'w:25', 'w:40', 'w:40', 'w:65', 'w:15', 'w:15']) r = act(g, 'P9', a);
  eq(pz.state.on.slice().sort((a, b) => a - b), [25, 65], 'seated weights');
  ok(/= 200$/.test(r.msg) && pz.total() === 200, `indicated total (${r.msg})`);
  run(g, 0.05);
  const ps = g.propState;
  eq([ps.cw15.y, ps.cw25.y, ps.cw40.y, ps.cw65.y], [1.7, 0.15, 1.7, 0.15], 'counterweight positions follow the seating');
  g.makeCheckpoint('test');
  g.retry();
  eq(g.puzzles.get('P9').state.on.slice().sort((a, b) => a - b), [25, 65], 'seating survives a reload');
  ok(act(g, 'P9', 'release').ok && g.story.has('P9.done'), 'brake releases');
  ok(!act(g, 'P9', 'release').ok && !act(g, 'P9', 'w:25').ok, 'further presses are ignored once balanced');
  ok(g.story.has('P9.done'), 'still balanced');
});
test('item 5: a release pressed between rapid presses only checks the current total', () => {
  const g = game(5);
  for (const a of ['w:25', 'release', 'w:65', 'w:65', 'release']) act(g, 'P9', a);
  ok(!g.story.has('P9.done'), 'not balanced with 25 alone');
  act(g, 'P9', 'w:65');
  ok(act(g, 'P9', 'release').ok && g.story.has('P9.done'), 'balanced once 65 is seated');
});

// ------------------------------------------------------------------ 6 freight return route in the journal
function nexusGame() {
  const g = game(6, { assists: { noDamage: true } });
  g.makeCheckpoint('chapter start');
  for (const [x, z] of [[8, 4], [8, 22], [8, 30], [3.4, 9]]) { P(g).x = x; P(g).z = z; run(g, 0.2); }
  g.story.addClue('test.clue', 'A clue recorded before the side trip.', 'observed');
  return g;
}
function sideTrip(g, ch, how) {
  P(g).x = 3.4; P(g).z = 9;
  ok(g.puzzleAction('p1', 'NEXUS', `go:${ch}`).ok, 'freight lift dispatched');
  run(g, 5);
  eq([g.chapterId, !!g.returnTrip], [ch, true], 'on the return landing');
  if (how === 'retry') g.retry();
  if (how === 'continue') g = reload(g);
  ok(Object.keys(g.map.rooms).some((r) => r.startsWith('R.')), 'the return landing is on the journal map');
  ok(available(g, g.level.interById.get('returnLift')), 'freight return lift available');
  g.script.onInteract(g, P(g), g.level.interById.get('returnLift'), 'begin');
  run(g, 5);
  return g;
}
test('item 6: the freight route and journal survive side trips, a retry or a Continue on the landing, and two trips', () => {
  for (const how of ['plain', 'retry', 'continue']) {
    let g = nexusGame();
    const map = JSON.stringify(g.map);
    for (const ch of [3, 4]) {
      g = sideTrip(g, ch, how);
      eq([g.chapterId, g.returnTrip], [6, null], `${how} ch${ch}: back at the nexus`);
      eq(JSON.stringify(g.map), map, `${how} ch${ch}: journal map`);
      ok(g.story.clues['test.clue'], `${how} ch${ch}: clues kept`);
      ok(['core', 'prepare'].includes(g.story.objective.id) && g.story.objective.text, `${how} ch${ch}: objective (${g.story.objective.id})`);
      eq(g.puzzles.get('NEXUS').view().controls.length, 4, `${how} ch${ch}: all four landings listed`);
    }
  }
});
test('item 6: riding the R2 lift down keeps the journal map', () => {
  const g = nexusGame();
  g.story.set('P11.done');
  for (const [x, z] of [[8, 60], [8, 100], [8, 115], [8, 126]]) { P(g).x = x; P(g).z = z; run(g, 0.2); }
  const map = JSON.stringify(g.map);
  g.script.onInteract(g, P(g), g.level.interById.get('r2Lift'), 'begin');
  run(g, 4);
  eq([g.chapterId, JSON.stringify(g.map)], [6, map], 'map after the R2 lift');
  ok(Math.hypot(P(g).x - 3.4, P(g).z - 9) < 1.5, 'placed at the nexus entry');
});

// ------------------------------------------------------------------ 7 refuge checkpoint spawns
const genuineRefuges = () => Object.entries(CHAPTERS).flatMap(([id, def]) => new Level(def).rooms.filter((r) => r.refuge && r.refuge !== 'imitation').map((r) => [+id, r.id]));
function secureIn(g, roomId, pids = ['p1']) {
  const r = g.level.room(roomId);
  g.persist.refuges[roomId] = true;
  pids.forEach((id, k) => { const p = g.players.get(id); p.x = r.cx + (k ? 0.8 : 0); p.z = r.cz; p.y = r.floorY; p.vx = p.vz = 0; });
  for (const d of r.doors) if (d.T.hinged) { d.target = d.open = 0; if (d.box) d.box.active = true; }
}
test('item 7: every refuge checkpoint returns the player inside that refuge', () => {
  for (const [ch, roomId] of genuineRefuges()) {
    const g = game(ch, { assists: { noDamage: true } });
    const L = g.level, r = L.room(roomId);
    ok(!L.world.overlaps(r.cx - 0.36, r.floorY + 0.05, r.cz - 0.36, r.cx + 0.36, r.floorY + 1.75, r.cz + 0.36, 1), `ch${ch} ${roomId}: respawn point clear`);
    secureIn(g, roomId);
    run(g, 6);
    ok(g.refugeSecured[roomId] && g.checkpointReason === 'refuge', `ch${ch} ${roomId}: secured and saved`);
    P(g).x = g.chapterDef.start.x; P(g).z = g.chapterDef.start.z;
    g.retry();
    ok(P(g).room === roomId && g.inRefugeVolume(P(g)), `ch${ch} ${roomId}: retry places the player in ${P(g).room}`);
  }
});
test('item 7: a crewmate busy with an action does not move the refuge save outside the door', () => {
  const g = new Game({ seed: 2, assists: { noDamage: true } });
  g.addPlayer('p1', 'evan', 'Evan'); g.addPlayer('p2', 'mara', 'Mara');
  g.loadChapter(1, { entry: 'replay' });
  const p1 = P(g), p2 = g.players.get('p2');
  secureIn(g, '1.03');
  p2.x = 0; p2.z = 22; p2.health = 40; addToPouch(p2, 'firstaid', 1);
  run(g, 4.8);
  g.pouchAction('p2', p2.pouch.findIndex((s) => s && s.item === 'firstaid'), 'use');
  run(g, 0.4);
  ok(g.refugeSecured['1.03'] && p2.action, 'secured while the crewmate is healing');
  const r1 = g.level.door('r1'); r1.target = r1.open = 1; r1.box.active = false;
  p1.x = -3; p1.z = 22.5;
  run(g, 6);
  g.retry();
  eq(g.level.roomAt(p1.x, p1.z).id, '1.03', 'p1 returns inside Refuge R1');
});

// ------------------------------------------------------------------ 8 records collected while resting
test('item 8: a record read while resting in a secured refuge is kept by Save and quit', () => {
  const g = game(1, { assists: { noDamage: true } });
  secureIn(g, '1.03');
  run(g, 6);
  ok(g.refugeSecured['1.03'] && g.checkpointReason === 'refuge', 'resting in a secured refuge');
  P(g).x = -7.6; P(g).z = 22.6;
  ok(g.beginInteract('p1', 'rec:02').first, 'record 02 read for the first time');
  const sv = new Saves();
  sv.erase(2);
  ok(sv.write(2, g.checkpoint), 'save and quit writes the held checkpoint');
  const h = new Game({ seed: 5 }); h.addPlayer('p1', 'evan', 'Evan');
  h.restore(sv.read(2).snap);
  ok(h.persist.records['02'], 'record 02 kept after Continue');
  ok(!h.collectRecord(P(h), '02'), 'read again it is a collected copy');
  ok(h.level.roomAt(P(h).x, P(h).z).id === '1.03', 'still resting in R1');
  sv.erase(2);
  g.retry();
  ok(g.persist.records['02'], 'kept after a retry too');
});

console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
