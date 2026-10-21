/**
 * Unit and rule tests for the simulation (no browser). Run: npm test
 * Covers the RNG and saves, every puzzle (correct, incorrect and repeated
 * input), creature perception rules, checkpoints, side-trip parking, the
 * ending branches' requirements and Expedition determinism and validity.
 */
import { Rng, seedToText, textToSeed } from '../src/core/rng.js';
import { _failNextWrites } from '../src/core/storage.js';
import { Settings } from '../src/core/settings.js';
import { Saves } from '../src/game/saves.js';
import { Game } from '../src/sim/game.js';
import { CHAPTERS } from '../src/data/chapters/index.js';
import { validateLevel } from '../src/sim/validate.js';
import { generateSpec, validateSpec, startExpedition } from '../src/sim/expedition.js';
import { defineMachine, startMachine, maskedAt } from '../src/sim/machines.js';
import { addToPouch } from '../src/sim/equipment.js';
import { Relay } from '../server/relay.mjs';

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

// ------------------------------------------------------------------ core
test('rng is deterministic and seed text round-trips', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 50; i++) eq(a.next(), b.next());
  for (const s of [1, 12345, 32 ** 6 - 1, 987654321 % (32 ** 6)]) eq(textToSeed(seedToText(s)), s);
  eq(textToSeed('O0I1XX'), null, 'ambiguous characters rejected');
});

test('settings presets apply and bindings report conflicts', () => {
  const s = new Settings();
  s.applyPreset('reducedMotion');
  eq(s.data.accessibility.cameraBob, 0, 'reduced motion removes camera bob');
  ok(s.conflicts('journal', s.data.controls.bindings.inventory[0]).length > 0, 'duplicate binding is detected');
});

test('atomic save keeps the previous snapshot when a write fails', () => {
  const sv = new Saves();
  sv.erase(3);
  const snap = (n) => ({ ...game(1).serialize(), testMark: n });
  ok(sv.write(3, snap(1)));
  ok(sv.write(3, snap(2)));
  _failNextWrites(1);
  ok(!sv.write(3, snap(3)), 'failed write reports failure');
  eq(sv.read(3).snap.testMark, 2, 'active snapshot intact');
  sv.erase(3);
});

// ------------------------------------------------------------------ levels
test('every chapter and return trip passes level validation', () => {
  for (const [id, def] of Object.entries(CHAPTERS)) {
    eq(validateLevel(def).problems, [], `chapter ${id}`);
    if (def.returnTrip) eq(validateLevel(def.returnTrip(def)).problems, [], `chapter ${id} return trip`);
  }
});

// ------------------------------------------------------------------ puzzles
test('P1 breakers: wrong order trips the panel, correct order powers the hall', () => {
  const g = game(1);
  act(g, 'P1', 'reset'); ok(!act(g, 'P1', 'b1').ok, 'b1 first is wrong');
  ok(!act(g, 'P1', 'b3').ok, 'tripped panel needs a reset');
  for (const a of ['reset', 'b3', 'b1', 'b2']) act(g, 'P1', a);
  ok(g.story.has('P1.done'));
});
test('P2 tone test ignores the microphone and needs LOCAL SERVICE', () => {
  const g = game(1);
  ok(!act(g, 'P2', 'mic').ok, 'microphone fails authentication');
  for (const a of ['t2', 't1', 't3']) act(g, 'P2', a);
  ok(!g.story.has('P2.done'), 'not done before LOCAL SERVICE');
  act(g, 'P2', 'local'); ok(g.story.has('P2.done'));
});
test('P3 shutter controls 2, 4, 1, 3', () => {
  const g = game(2);
  for (const a of ['s2', 's4', 's1', 's3']) act(g, 'P3', a);
  ok(g.story.has('P3.done'));
});
test('E1 badge drawer', () => { const g = game(2); for (const a of ['t4', 't2', 't7']) act(g, 'E1', a); ok(g.persist.evidence.E1 || g.story.has('E1.done')); });
test('P7 mail: a mismatch is returned, correct boxes open the gate', () => {
  const g = game(4);
  ok(!act(g, 'P7', 'place:morrow:105').ok);
  for (const a of ['place:morrow:204', 'place:ash:312', 'place:vale:105']) act(g, 'P7', a);
  ok(g.story.has('P7.done'));
});
test('P8 frames: gate, bedroom, uniform', () => {
  const g = game(4);
  for (const a of ['mount:0', 'mount:0', 'mount:0', 'mount:1', 'mount:2']) act(g, 'P8', a);
  ok(g.story.has('P8.done'));
});
test('P9 counterweights: only 25 + 65 balances 110 to 200', () => {
  const g = game(5);
  for (const a of ['w:40', 'w:15']) act(g, 'P9', a);
  ok(!act(g, 'P9', 'release').ok, 'wrong total keeps the brake engaged');
  for (const a of ['w:40', 'w:15', 'w:25', 'w:65']) act(g, 'P9', a);
  ok(act(g, 'P9', 'release').ok && g.story.has('P9.done'));
});
test('P10 pressure lock: a wrong control keeps completed steps', () => {
  const g = game(5);
  act(g, 'P10', 'A');
  ok(!act(g, 'P10', 'B').ok, 'B before C is wrong');
  eq(g.puzzles.get('P10').state.seq, ['A'], 'A is kept');
  act(g, 'P10', 'C'); act(g, 'P10', 'B');
  ok(g.story.has('P10.done'));
});
test('E4 telemetry: playback prints the archive; direct sensor + TEST LIGHT prints the pulse', () => {
  const g = game(5);
  ok(!act(g, 'E4', 'print').ok, 'playback is the archive pattern');
  act(g, 'E4', 'channel');
  ok(!act(g, 'E4', 'print').ok, 'no response marker without TEST LIGHT');
  act(g, 'E4', 'test');
  ok(act(g, 'E4', 'print').ok && g.persist.evidence.E4);
});
test('P11 patch board: duplicates and wrong chains are invalid', () => {
  const g = game(6);
  act(g, 'P11', 'plug:T1');
  ok(!act(g, 'P11', 'plug:T1').ok, 'duplicate socket is invalid');
  for (const a of ['plug:T2', 'plug:T3', 'plug:T4', 'plug:T5']) act(g, 'P11', a);
  ok(!act(g, 'P11', 'plug:RETURN').ok, 'wrong order carries no return signal');
  act(g, 'P11', 'clear');
  for (const a of ['plug:T1', 'plug:T3', 'plug:T2', 'plug:T5', 'plug:T4', 'plug:RETURN']) act(g, 'P11', a);
  ok(g.story.has('P11.done'));
});
test('P12: maintenance bypass explains missing proof; the others are always available', () => {
  const g = game(6);
  const r = act(g, 'P12', 'sel:door');
  ok(!r.ok && /E1/.test(r.msg) && /missing/.test(r.msg), 'missing evidence is named');
  ok(act(g, 'P12', 'sel:familiar').ok && act(g, 'P12', 'sel:cut').ok);
  for (const e of ['E1', 'E2', 'E3', 'E4']) g.story.set(e);
  ok(act(g, 'P12', 'sel:door').ok, 'available with all four proofs');
});
test('maintenance bypass: order enforced, a wrong memory answer allows another try', () => {
  const g = game(6);
  g.story.set('route.door');
  ok(!act(g, 'BYPASS', 'badge').ok, 'key first');
  for (const a of ['key', 'badge', 'pulse', 'handset']) act(g, 'BYPASS', a);
  ok(!act(g, 'BYPASS', 'answer:blue').ok, 'wrong answer');
  ok(act(g, 'BYPASS', 'answer:yellow').ok, 'right answer accepted after a wrong one');
  for (const a of ['life', 'identity', 'release']) act(g, 'BYPASS', a);
  ok(g.story.has('BYPASS.done'));
});
test('emergency isolation: PURGE is interlocked until all three lines are isolated', () => {
  const g = game(6);
  g.story.set('route.cut');
  act(g, 'PURGE', 'cover');
  ok(!act(g, 'PURGE', 'purge').ok);
  for (const a of ['sw1', 'sw2', 'sw3']) act(g, 'PURGE', a);
  ok(act(g, 'PURGE', 'purge').ok && g.story.has('cut.purge'));
});
test('commit lever: host only, everyone in the room, selection required', () => {
  const g = game(6);
  g.addPlayer('p2', 'mara', 'Mara');
  const p1 = P(g), p2 = g.players.get('p2');
  const it = g.level.interById.get('commit');
  ok(!g.script.onInteract(g, p1, it, 'complete').ok, 'needs a selection');
  act(g, 'P12', 'sel:familiar');
  ok(!g.script.onInteract(g, p2, it, 'complete').ok, 'guests cannot commit');
  p1.room = '6.10'; p2.room = '6.07';
  ok(!g.script.onInteract(g, p1, it, 'complete').ok, 'everyone must be present');
  p2.room = '6.10';
  ok(g.script.onInteract(g, p1, it, 'complete').ok && g.story.has('route.familiar'));
});

// ------------------------------------------------------------------ creatures
test('Caretaker: a running machine masks footsteps; it habituates to steady sources', () => {
  const g = game(5);
  // in the tool bay, away from the press corridor's own cover
  const C = g.spawn('caretaker', { id: 'Ct', x: 0, z: 12, anchors: [{ x: 0, z: 12 }], encounter: 'lane' });
  defineMachine(g, 'mt', { x: 2, z: 14, run: 6, rest: 6, mask: 3, label: 'Test' });
  startMachine(g, 'mt');
  ok(maskedAt(g, 1, 15), 'inside the cover radius');
  C.hear({ x: 1, z: 15, r: 9, kind: 'step', player: 'p1' }, { remain: 5, x: 1, z: 15 });
  eq(C.state, 'patrol', 'masked step is not heard');
  g.story.vars.machines.mt.running = false;
  ok(!maskedAt(g, 1, 15), 'cover gone while the machine rests');
  C.hear({ x: 1, z: 15, r: 9, kind: 'step', player: 'p1' }, { remain: 5, x: 1, z: 15 });
  eq(C.state, 'warn', 'unmasked step starts the tool-click warning');
  const D = g.spawn('caretaker', { id: 'Cd', x: -1, z: 20, anchors: [{ x: -1, z: 20 }], encounter: 'lane' });
  const ev = { x: -1, z: 19, r: 10, kind: 'decoy', source: 'dec1' };
  D.hear(ev, { remain: 5, x: -1, z: 19 }); eq(D.state, 'investigate', 'a new sound is investigated');
  D.setState('patrol');
  for (let t = 0; t < 4; t++) { run(g, 1); D.hear(ev, { remain: 5, x: -1, z: 19 }); }
  D.setState('patrol');
  run(g, 1); D.hear(ev, { remain: 5, x: -1, z: 19 });
  eq(D.state, 'patrol', 'a steady source is ignored after three seconds');
});
test('catwalk: moving while the stop machines rest draws the Caretaker', () => {
  const g = game(5);
  const C = g.spawn('caretaker', { id: 'Cc', x: 3, z: 104, anchors: [{ x: 3, z: 104 }], encounter: 'catwalk' });
  for (const id of ['turbine', 'pressS', 'compressor']) { const m = g.story.vars.machines[id]; m.enabled = false; m.running = false; m.armAt = null; }
  const p = P(g); p.x = 3; p.z = 112; p.y = 0;
  ok(!maskedAt(g, 3, 112), 'no cover while the machines rest');
  g.emitSound({ x: 3, z: 112, r: 9, kind: 'step', player: 'p1' });
  run(g, 0.1);
  eq(C.state, 'warn', 'a grated footstep in the quiet is heard');
});

test('Unseen: sees movement within ten metres, ignores a crouched still player beside cover', () => {
  const g = game(6);
  const p = P(g);
  const U = g.spawn('unseen', { id: 'Ut', x: 8.5, z: 98, yaw: 0, anchors: [{ x: 8.5, z: 98 }] });
  U.yaw = Math.atan2(-(5.9 - 8.5), -(90 - 98));
  p.x = 5.9; p.z = 90; p.y = 0; p.crouched = true; p.vx = p.vz = 0;
  ok(!U.canSee(p), 'crouched and still beside the partition');
  p.vx = 1.2;
  ok(U.canSee(p), 'moving within ten metres');
  p.x = 8.5; p.z = 86; p.crouched = false; U.x = 8.5; U.z = 106;
  ok(!U.canSee(p), 'beyond ten metres');
  ok(/facing/.test(U.photoText()), 'a photograph records its facing');
});
test('Cutout cannot move while observed', () => {
  const g = game(6);
  const p = P(g);
  const C = g.enemyById('Cfrag');
  p.x = 8; p.z = 61; p.y = 0;
  p.yaw = Math.atan2(-(C.x - p.x), -(C.z - p.z)); p.pitch = 0;
  ok(C.isObserved(), 'looked at within twelve metres');
  p.yaw += Math.PI;
  ok(!C.isObserved(), 'looking away');
});

// ------------------------------------------------------------------ checkpoints and parking
test('checkpoint round-trip restores flags, puzzles and position; evidence merge is monotonic', () => {
  const g = game(5);
  act(g, 'P10', 'A');
  P(g).x = 3; P(g).z = 90;
  g.makeCheckpoint('test');
  act(g, 'E4', 'channel'); act(g, 'E4', 'test'); act(g, 'E4', 'print');
  ok(g.persist.evidence.E4);
  g.retry();
  eq(g.puzzles.get('P10').state.seq, ['A'], 'puzzle state from the checkpoint');
  ok(Math.abs(P(g).z - 90) < 0.01, 'position restored');
  ok(g.persist.evidence.E4 && g.story.has('E4'), 'evidence collected after the checkpoint is kept');
});
test('side trip parking: the nexus resumes exactly as left', () => {
  const g = game(6);
  addToPouch(P(g), 'battery', 0);
  g.pickups.c6film.taken = true;
  g.story.set('test.mark');
  g.parkChapter();
  g.loadChapter(3, { entry: 'return' });
  ok(g.returnTrip, 'side area is a return trip');
  g.loadChapter(6, { entry: 'nexus' });
  ok(g.pickups.c6film.taken && !g.returnTrip, 'pickups kept, back in the main chapter');
  ok(Math.abs(P(g).x - 3.4) < 1.5, 'placed at the nexus entry');
});
test('every return-trip lift goes back to the nexus', () => {
  for (const ch of [2, 3, 4, 5]) {
    const g = new Game({ seed: 1 }); g.addPlayer('p1', 'evan', 'Evan');
    g.loadChapter(ch, { entry: 'return' });
    const it = g.level.interById.get('returnLift');
    g.script.onInteract(g, P(g), it, 'begin');
    eq(g.transition && g.transition.entry, 'nexus', `chapter ${ch}`);
  }
});

// ------------------------------------------------------------------ endings
test('an ending records itself once and plays its scene', () => {
  const g = game(6);
  g.story.set('JUNE_SAFE');
  g.beginEnding('door');
  ok(g.persist.endings.door && g.story.has('ending.door'));
  run(g, 40);
  ok(g.over && g.over.done, 'ending scene finishes');
  ok(g.drainEvents().some((e) => e.e === 'endingDone' && e.june), 'June staging reported');
});

// ------------------------------------------------------------------ co-op relay
test('relay: invite codes, routing, a full session and the host leaving', () => {
  const R = new Relay();
  const box = () => { const b = { got: [] }; b.cl = R.connect({ send: (s) => b.got.push(JSON.parse(s)), close: () => {} }); return b; };
  const h = box();
  R.onMessage(h.cl, JSON.stringify({ t: 'host', name: 'Evan' }));
  const code = h.got[0].code;
  ok(/^[A-Z0-9]{6}$/.test(code), 'invite code issued');
  const gs = [box(), box(), box(), box()];
  for (const g of gs) R.onMessage(g.cl, JSON.stringify({ t: 'join', code: code.toLowerCase(), name: 'G', slot: 'mara' }));
  eq(gs.slice(0, 3).map((g) => g.got[0].t), ['joined', 'joined', 'joined']);
  eq(gs[3].got[0].t, 'error', 'a fourth guest is refused');
  R.onMessage(gs[0].cl, JSON.stringify({ t: 'to', id: 'host', d: { k: 'input' } }));
  ok(h.got.some((m) => m.t === 'from' && m.d.k === 'input'), 'guest → host routed');
  R.onMessage(h.cl, JSON.stringify({ t: 'all', d: { k: 'snap' } }));
  ok(gs.slice(0, 3).every((g) => g.got.some((m) => m.t === 'from' && m.d.k === 'snap')), 'host → all routed');
  R.disconnect(gs[1].cl);
  ok(h.got.some((m) => m.t === 'left'), 'host told when a guest leaves');
  R.disconnect(h.cl);
  ok(gs[0].got.some((m) => m.t === 'hostLeft'), 'guests told when the host leaves');
  eq(R.sessions.size, 0, 'session closed');
});

// ------------------------------------------------------------------ expedition
test('expedition: the same seed always builds the same run', () => {
  const a = generateSpec(424242), b = generateSpec(424242);
  eq(JSON.stringify(a), JSON.stringify(b));
});
test('expedition: generated runs are valid, with three distinct families and unique counterweights', () => {
  for (let s = 1; s <= 25; s++) {
    const sp = generateSpec(s * 7907);
    ok(validateSpec(sp).ok, `seed ${s} valid`);
    eq(sp.rooms.length, 12, 'twelve rooms');
    eq(new Set(sp.puzzles.map((p) => p.type)).size, 3, 'three distinct families');
    eq(sp.threats.length, 2, 'two threat areas');
    ok(sp.doors.some((d) => d.lock === 'x.ready'), 'extraction is locked');
  }
});
test('expedition: a suspended run restores from its stored graph', () => {
  const g = new Game({ seed: 3 }); g.addPlayer('p1', 'evan', 'Evan');
  const spec = startExpedition(g, 777, addToPouch);
  P(g).film = 2;
  const snap = g.serialize();
  const h = new Game({ seed: 9 }); h.addPlayer('p1', 'evan', 'Evan');
  h.restore(snap);
  eq(h.expedition.seedText, spec.seedText);
  eq(h.level.rooms.length, 12);
  eq(P(h).film, 2);
});


console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);
