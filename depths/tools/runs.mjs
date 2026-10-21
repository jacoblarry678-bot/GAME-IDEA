/** Per-chapter bot routines used by tools/playthrough.mjs. */
import { maskedAt } from '../src/sim/machines.js';

export const RUNS = {};

RUNS[1] = (b) => {
  const g = b.g;
  b.walkTo(0, -1.5);
  b.use('gateWheel');
  b.wait(3);
  b.expect(g.story.has('ch1.entered'), 'gate opened into the yellow rooms');
  b.walkTo(0, 18);
  b.use('flashlight');
  b.expect(b.p.hasFlashlight, 'flashlight taken');
  b.use('drawer1'); b.use('rec:06'); b.use('rec:01');
  b.walkTo(-8, 22.5);
  b.watchClock('1.03');
  b.expect(!!g.persist.refuges['1.03'], 'R1 verified');
  b.use('camera'); b.use('rec:02');
  const ph = b.photo(-10.3, 0.47, 24.0);
  b.expect(ph.ok && ph.photo.targets.includes('h1chair'), 'tutorial photo reveals the footprint');
  b.use('c1bat'); b.use('c1band');
  b.walkTo(14, 38.5); b.use('practiceDecoy'); b.wait(4);
  b.use('rec:03');
  b.walkTo(-10.0, 50.75);
  b.use('station:S1', 12.3);
  b.expect(!!g.story.clues['clue.P1'], 'survey station supplies the P1 clue');
  b.use('c1film');
  b.walkTo(-3, 62.5);
  b.use('panel:P1');
  b.puzzle('P1', ['reset', 'b3', 'b1', 'b2']);
  b.expect(g.story.has('P1.done'), 'P1 solved');
  b.wait(2);
  b.walkTo(2.0, 58.5);
  b.walkTo(7.5, 58.0);
  b.wait(0.5);
  b.expect(g.story.has('ch1.hallStarted'), 'hall encounter starts');
  b.walkTo(24.0, 58.5, { sprint: true });
  b.walkTo(27.0, 58.5, { sprint: true });
  b.closeDoor('r2');
  b.walkTo(28.0, 58.5);
  b.watchClock('1.10');
  b.wait(6);
  b.expect(g.refugeSecured['1.10'], 'R2 secured after the chase');
  b.use('worksheet');
  b.walkTo(28, 66);
  b.use('panel:P2');
  b.puzzle('P2', ['mic', 't2', 't1', 't3', 'local']);
  b.expect(g.story.has('T1'), 'T1 restored');
  b.wait(2);
  b.walkTo(37, 66);
  b.use('lift1');
};

RUNS[2] = (b) => {
  const g = b.g;
  b.wait(2);
  b.walkTo(15, 3);
  b.walkTo(15, 33);
  b.wait(10); // display demonstration: watch the figure
  // P3 clue from the photo kiosk survey station
  b.walkTo(-6, 23.3);
  b.use('station:S2', 12.3);
  b.expect(!!g.story.clues['clue.P3'], 'survey station supplies the P3 chart');
  b.use('rec:09');
  // E1 Lena's badge in the toy shop
  if (b.cfg.evidence === 'all') {
    b.walkTo(2, 31.5);
    b.use('sizeLabel');
    b.use('rec:10');
    b.use('panel:E1');
    b.puzzle('E1', ['t4', 't2', 't7']);
    b.expect(g.persist.evidence.E1, 'E1 collected');
    b.walkTo(2, 31.5);
  }
  b.walkTo(15, 33);
  b.walkTo(14.5, 46.6);
  b.use('panel:P3');
  b.puzzle('P3', ['s2', 's4', 's1', 's3']);
  b.expect(g.story.has('P3.done'), 'P3 solved');
  b.wait(3);
  b.walkTo(18, 46.8);
  b.walkTo(18, 49.2);
  b.use('galLever1');
  b.walkTo(-7.5, 50.5, { sprint: true });
  b.walkTo(-11.5, 50.5);
  b.closeDoor('r2');
  b.walkTo(-12, 50.6);
  b.watchClock('2.09');
  b.wait(6);
  b.expect(g.refugeSecured['2.09'], 'R2 secured');
  b.walkTo(-12, 54.5);
  b.use('p4diagram');
  b.use('panel:P4');
  b.puzzle('P4', ['zone:atrium', 'zone:west', 'zone:service', 'play']);
  b.wait(14);
  b.expect(g.story.has('P4.done'), 'P4 routed the announcement');
  b.wait(4);
  b.walkTo(-16, 57);
  b.walkTo(-24, 52.4);
  b.use('t2switch');
  b.expect(g.story.has('T2'), 'T2 restored');
  b.wait(3);
  b.use('rec:12');
  b.walkTo(-23, 66);
  b.use('escalator');
};

RUNS[3] = (b) => {
  const g = b.g;
  b.wait(2);
  b.walkTo(14, -17.5);
  b.use('c3bat');
  if (b.cfg.evidence === 'all' || true) { b.walkTo(6.5, -7.5); b.use('c3tea'); b.use('rec:13'); b.walkTo(9.5, -7.5); }
  b.walkTo(14, -1);
  b.walkTo(14, 1.8);
  b.wait(5); // the cup demonstration
  b.expect(g.story.has('ch3.cupStruck'), 'the wake strikes the floating cup');
  b.walkTo(14, 8.6);
  b.expect(g.story.has('ch3.island1'), 'reached the first island');
  b.use('lever1');
  b.walkStraight(13.6, 17.4, { crouch: true });
  b.use('lever2');
  b.walkStraight(16.5, 18.2, { crouch: true });
  b.walkStraight(23, 18.2, { crouch: true });
  b.expect(b.p.health > 50, `crossed the pool (health ${b.p.health})`);
  b.walkTo(27, 19);
  b.walkTo(30, 22);
  b.use('c3film'); b.use('rec:14');
  b.walkTo(31, 26.5);
  b.use('panel:P5');
  b.puzzle('P5', ['pump', 'valve:A', 'valve:B', 'valve:C', 'pump']);
  b.wait(8.5);
  b.expect(g.story.has('P5.done'), 'P5 drained the basin');
  b.wait(2);
  b.walkTo(34, 30);
  b.walkTo(23.5, 31.5);
  b.walkTo(19, 31.5);
  b.closeDoor('r2');
  b.walkTo(19, 31.6);
  b.watchClock('3.09'); b.wait(6);
  b.expect(g.refugeSecured['3.09'], 'R2 secured');
  if (b.cfg.evidence === 'all') {
    b.walkTo(13, 31.5);
    b.use('rec:16');
    b.use('panel:E2');
    b.puzzle('E2', ['release', 'breaker']);
    b.wait(3.4);
    b.puzzle('E2', ['release']);
    b.expect(g.persist.evidence.E2, 'E2 collected');
    b.walkTo(18, 32);
  }
  b.walkTo(19, 35.2);
  b.use('rec:17');
  b.use('station:S3', 12.3);
  b.expect(!!g.story.clues['clue.P6'], 'survey station shows the tile line');
  b.walkTo(13.75, 35.4);
  for (const [x, z] of [[13.75, 37.25], [13.75, 39.75], [16.25, 39.75], [16.25, 42.25], [13.75, 42.25], [13.75, 44.75], [16.25, 44.75], [16.25, 47.1]]) b.walkStraight(x, z);
  b.expect(g.story.has('P6.done'), 'P6 tiles crossed');
  b.expect(b.p.health > 50, 'no tile damage on the correct line');
  b.wait(1);
  b.walkTo(16.25, 50);
  b.use('rec:18');
  b.use('t3switch');
  b.expect(g.story.has('T3'), 'T3 restored');
  b.walkTo(22.5, 51.5);
  b.use('stairs');
};

RUNS[4] = (b) => {
  const g = b.g;
  b.wait(2);
  b.walkTo(12, -10);
  b.use('intercom'); b.use('rec:19'); b.use('c4bat'); b.use('c4tea');
  b.use('panel:P7');
  b.puzzle('P7', ['place:morrow:105', 'place:morrow:204', 'place:ash:312', 'place:vale:105']);
  b.expect(g.story.has('P7.done'), 'P7 mail sorted');
  b.wait(2.5);
  b.walkTo(12, 2);
  if (b.cfg.june) { b.walkTo(21, 22.6); b.use('juneTalk'); b.wait(6); b.expect(g.story.has('ch4.juneSpoke'), 'spoke with June'); b.use('rec:21'); }
  b.walkTo(2, 12.5);
  b.walkTo(-3, 12.5);
  b.watchClock('4.06');
  b.expect(!!g.story.clues['imitation.4.06'], 'the side room clock is stopped (imitation refuge)');
  b.walkTo(-3, 16.5);
  b.use('station:S4', 12.3);
  b.expect(!!g.story.clues['clue.P8'], 'survey station shows the frame labels');
  b.use('rec:22'); b.use('c4film');
  b.walkTo(-8, 29.4);
  b.use('panel:P8');
  b.puzzle('P8', ['mount:0', 'mount:0', 'mount:0', 'mount:1', 'mount:2']);
  b.expect(g.story.has('P8.done'), 'P8 frames arranged');
  b.wait(2);
  b.walkTo(-1.2, 27.2);
  b.walkTo(3, 27);
  b.watchClock('4.09'); b.wait(1);
  b.expect(!!g.persist.refuges['4.09'], 'R2 verified');
  b.use('c4aid');
  b.walkTo(8, 27);
  if (b.cfg.evidence === 'all') { b.use('mug'); b.use('rec:23'); b.wait(10); b.expect(g.persist.evidence.E3, 'E3 private memory recorded'); }
  if (b.cfg.june) {
    b.walkTo(16.6, 30);
    b.use('door:pass');
    b.wait(1.5);
    b.use('cartPush', 2.2);
    b.expect(g.story.has('ch4.cartPlaced'), 'cart holds the laundry passage open');
    b.walkTo(17.0, 31.2);
    b.use('juneTalk2');
    b.wait(28);
    b.expect(g.story.has('JUNE_SAFE'), 'June reached Refuge R2');
  }
  b.walkTo(3, 28.5);
  b.walkTo(3, 36.5);
  b.wait(0.5);
  b.expect(g.story.has('ch4.roofCross'), 'roof hall crossing triggered');
  b.walkTo(3, 28.0);
  b.closeDoor('roof');
  b.wait(28);
  b.walkTo(3, 57);
  b.walkTo(3, 65.6);
  b.use('rec:24');
  b.use('t4switch');
  b.expect(g.story.has('T4'), 'T4 restored');
  b.wait(2);
  b.walkTo(11, 63);
  b.use('lift4');
};

RUNS[5] = (b) => {
  const g = b.g;
  const hits0 = b.count('hit');
  const M = (id) => (g.story.vars.machines || {})[id];
  const running = (id) => { const m = M(id); return !!(m && m.enabled && m.running); };
  const masked = () => maskedAt(g, b.p.x, b.p.z);
  /** Catwalk: move only while some machine covers the footsteps; freeze in place while they rest. */
  const cross = (x, z) => b.walkTo(x, z, { when: () => masked() || b.p.z > 140.1 });
  b.wait(2);
  b.walkTo(3, 6.4);
  b.walkTo(1.5, 14);
  b.wait(9);
  b.expect(g.story.has('ch5.demo') && g.enemyById('Cdemo'), 'the Caretaker demonstration behind the mesh');
  b.expect(b.has('creatureHeard', (e) => e.id === 'Cdemo'), 'it reacts to the dropped spanner');
  b.use('rec:25'); b.use('c5bat');
  if (b.cfg.evidence === 'all') {
    b.walkTo(-4.5, 14.5);
    b.watchClock('5.03');
    b.expect(!!g.persist.refuges['5.03'], 'R1 verified');
    b.use('rec:26');
  }
  b.walkTo(1.5, 24.5);
  b.use('rec:27'); b.use('c5film');
  b.use('panel:P9');
  b.puzzle('P9', ['w:40', 'w:15', 'release', 'w:40', 'w:15', 'w:25', 'w:65', 'release']);
  b.expect(g.story.has('P9.done'), 'P9 balanced at 110 + 25 + 65');
  b.wait(2);
  b.walkTo(1.5, 27.6);
  b.walkTo(1.5, 38.5);
  b.walkTo(1.5, 41.2);
  b.waitUntil(() => running('press1') && M('press1').t < 0.3, 20);
  b.walkTo(1.5, 43.4);
  b.expect(!!g.enemyById('Clane'), 'the Caretaker walks the service lane');
  b.walkTo(0.8, 70.9, { when: masked, quietDoors: true });
  b.walkTo(0.8, 73.6, { when: () => masked() || b.p.z > 72.4, quietDoors: true });
  b.expect(!b.has('warning', (e) => e.id === 'Clane'), 'crossed the press corridor unheard');
  b.use('o5film1'); b.use('rec:28');
  b.use('station:S5', 12.3);
  b.expect(!!g.story.clues['clue.P10'], 'survey station shows the maintenance order');
  b.walkTo(1, 81.4);
  b.closeDoor('r2a');
  b.walkTo(2.5, 83);
  b.look(-3.2, 1.2, 83); b.wait(1);
  b.expect(g.story.has('ch5.lenaSeen'), 'Lena seen through the glass');
  b.watchClock('5.08'); b.wait(6);
  b.expect(g.refugeSecured['5.08'], 'R2 secured');
  if (b.cfg.evidence === 'all') {
    b.walkTo(4.5, 79.3);
    b.walkTo(5.5, 77.6);
    b.use('rec:29');
    b.use('panel:E4');
    b.puzzle('E4', ['print', 'channel', 'test', 'print']);
    b.expect(g.persist.evidence.E4, 'E4 living pulse recorded');
    b.walkTo(4.5, 81.2);
  }
  b.walkTo(3, 87.5);
  b.use('c5aid');
  b.use('panel:P10');
  b.puzzle('P10', ['B', 'A', 'B', 'C', 'B']);
  b.expect(g.story.has('P10.done'), 'P10 lock isolated in the order A, C, B');
  b.wait(1);
  b.use('wheel', 2.5);
  b.expect(g.story.has('ch5.wheel'), 'wheel turned');
  b.wait(1.6);
  b.walkTo(3, 99.6);
  b.walkTo(3, 103.4);
  b.expect(running('turbine'), 'the turbine starts as the party reaches it');
  cross(3, 115.4);
  cross(3, 129.4);
  cross(3, 141.6);
  b.wait(0.5);
  b.expect(g.story.has('ch5.isolated'), 'isolation door shut behind the party');
  b.expect(b.count('hit') === hits0, 'no Caretaker contact in chapter five');
  b.walkTo(3, 151.6);
  b.use('rec:30');
  b.use('t5switch');
  b.expect(g.story.has('T5'), 'T5 restored');
  b.wait(3);
  b.walkTo(16.5, 148);
  b.use('freight5');
};

/** From the chapter six freight nexus: ride to a landing, recover its proof, ride back. */
function sideTrip(b, ch, ev) {
  const g = b.g;
  b.use('panel:NEXUS');
  b.puzzle('NEXUS', [`go:${ch}`]);
  b.waitUntil(() => g.chapterId === ch && !g.transition, 20);
  b.wait(1);
  if (ch === 2) { b.use('sizeLabel'); b.use('rec:10'); b.use('panel:E1'); b.puzzle('E1', ['t4', 't2', 't7']); }
  if (ch === 3) { b.use('rec:16'); b.use('panel:E2'); b.puzzle('E2', ['release', 'breaker']); b.wait(3.4); b.puzzle('E2', ['release']); }
  if (ch === 4) { b.use('mug'); b.use('rec:23'); b.wait(10); }
  if (ch === 5) { b.use('rec:29'); b.use('panel:E4'); b.puzzle('E4', ['channel', 'test', 'print']); }
  b.expect(g.persist.evidence[ev], `${ev} recovered on a return trip to chapter ${ch}`);
  b.use('returnLift');
  b.waitUntil(() => g.chapterId === 6 && !g.transition, 20);
  b.wait(1);
}

RUNS[6] = (b) => {
  const g = b.g;
  const hits0 = b.count('hit');
  b.wait(2);
  b.use('rec:31'); b.use('c6film'); b.use('o6aid1');
  if (b.cfg.evidence === 'late') {
    const before = JSON.stringify(g.pickups);
    g.story.set('ch6.markBeforeTrips');
    for (const [ev, ch] of [['E1', 2], ['E2', 3], ['E3', 4], ['E4', 5]]) if (!g.story.has(ev)) sideTrip(b, ch, ev);
    b.expect(JSON.stringify(g.pickups) === before && g.story.has('ch6.markBeforeTrips'), 'the nexus resumes exactly as it was left before the side trips');
  }
  // R1
  b.walkTo(8, 21.5);
  b.watchClock('6.02');
  b.expect(!!g.persist.refuges['6.02'], 'R1 verified');
  b.use('rec:32'); b.use('c6bat'); b.use('c6tea');
  // office fragment: the Listener hunts noise, so crouch along the east aisle
  b.walkTo(8, 27.6);
  b.walkTo(13.2, 29, { crouch: true });
  b.walkTo(13.2, 44.6, { crouch: true });
  b.walkTo(8, 45.2, { crouch: true });
  b.expect(!b.has('warning', (e) => e.id === 'Lfrag'), 'crossed the office fragment unheard');
  // display fragment: close the shutters, then back out through the gate watching the figure
  b.walkTo(8, 47.6);
  b.walkTo(11, 60.4);
  b.use('fragLever');
  b.wait(3.3);
  b.moveFacing(8, 63, [8, 1.2, 54]);
  b.waitUntil(() => g.level.door('frag').open > 0.9, 6);
  b.moveFacing(8, 65.8, [8, 1.2, 54]);
  b.expect(g.story.has('ch6.fragDone'), 'through the display fragment with the figure in view');
  // pool fragment: the dry route along the east grating
  b.walkTo(14.4, 66);
  b.walkTo(14.4, 82);
  b.walkTo(8, 82.6);
  b.expect(b.count('hit') === hits0, 'no contact in the fragments');
  // observation gallery: the first live Unseen
  b.walkTo(8, 86.8);
  b.walkTo(8, 88.2);
  b.walkTo(5.9, 90.0, { crouch: true });
  b.g.setInput(b.pid, { crouch: true });
  b.waitUntil(() => g.story.has('ch6.unseenLive') && !g.enemies.some((c) => c.id === 'Ugal' && !c.gone), 45);
  b.expect(!b.has('warning', (e) => e.id === 'Ugal'), 'the Unseen walked past the crouched player');
  b.g.setInput(b.pid, { crouch: false });
  b.wait(0.5);
  b.use('rec:33');
  b.walkTo(8, 107.2);
  // switching room: P11 via the Survey Station
  b.walkTo(8, 109.5);
  b.use('o6wedge2');
  b.use('station:S6', 12.3);
  b.expect(!!g.story.clues['clue.P11'], 'survey station shows the service route');
  b.use('rec:34'); b.use('o6film1');
  b.use('panel:P11');
  b.puzzle('P11', ['plug:T1', 'plug:T3', 'plug:T3', 'plug:T2', 'plug:T5', 'plug:T4', 'plug:RETURN']);
  b.expect(g.story.has('P11.done'), 'P11 return circuit rebuilt');
  b.wait(2);
  // R2
  b.walkTo(8, 124.4);
  b.closeDoor('r2a');
  b.walkTo(8, 125.5);
  b.watchClock('6.08'); b.wait(6);
  b.expect(g.refugeSecured['6.08'], 'R2 secured');
  b.use('planBoard');
  // anchor chamber
  b.walkTo(8, 133);
  b.use('rec:35'); b.use('o6aid2');
  b.use('lenaTalk'); b.wait(9);
  b.walkTo(8, 152);
  b.use('rec:36');
  const ending = b.cfg.ending;
  b.use('panel:P12');
  b.puzzle('P12', [`sel:${ending}`]);
  b.use('commit', 3.3);
  b.expect(g.story.has(`route.${ending}`), `committed to ${ending}`);
  if (ending === 'familiar') {
    b.use('vgB', 2.3);
    b.expect(!g.story.has('fam.B'), 'gate B waits for gate A');
    b.use('vgA', 2.3); b.use('vgB', 2.3); b.use('vgC', 2.3);
    b.expect(g.story.has('fam.open'), 'voice gates accepted');
    b.wait(2.5);
    b.walkTo(8, 170.5);
    b.walkTo(9.5, 205);
    b.expect(!!g.enemyById('Uwatch'), 'the Unseen keeps pace behind the glass');
    b.walkTo(8, 211);
  }
  if (ending === 'door') {
    b.use('panel:BYPASS');
    b.puzzle('BYPASS', ['badge', 'key', 'badge', 'pulse', 'handset']);
    b.wait(6);
    b.puzzle('BYPASS', ['answer:blue', 'answer:yellow']);
    b.wait(6);
    b.puzzle('BYPASS', ['life', 'identity', 'release']);
    b.expect(g.story.has('res.free'), 'anchor released');
    b.wait(1.5);
    b.walkTo(17.6, 159, { sprint: true });
    b.walkTo(22.5, 162.6, { sprint: true });
    b.use('lever1', 1.2);
    b.walkTo(30.6, 159.5, { sprint: true });
    b.closeDoor('bar1');
    b.walkTo(35.5, 156.4, { sprint: true });
    b.use('lever2', 1.2);
    b.walkTo(43.6, 159.5, { sprint: true });
    b.closeDoor('bar2');
    b.walkTo(48.5, 162.6);
    b.use('lever3', 1.2);
    b.expect(g.story.has('res.lever3'), 'third release lever pulled');
    b.wait(1.5);
    b.walkTo(57.5, 159);
  }
  if (ending === 'cut') {
    b.use('panel:PURGE');
    b.puzzle('PURGE', ['purge', 'cover', 'sw1', 'sw2', 'sw3', 'purge']);
    b.expect(g.story.has('cut.purge'), 'PURGE pulled');
    b.wait(1.5);
    b.walkTo(-1.6, 159);
    b.use('hw1', 3.2);
    b.wait(1.2);
    b.walkTo(-17.8, 158);
    b.use('hw2', 3.2);
    b.wait(1.2);
    b.walkTo(-28.5, 158);
    b.use('hw3', 3.2);
    b.wait(1.2);
    b.walkTo(-41.6, 158);
    b.expect(g.story.vars.purgeLeft > 0, `evacuated with ${Math.round(g.story.vars.purgeLeft)} s left`);
  }
  b.waitUntil(() => g.over && g.over.kind === 'endingPlay' && g.over.done, 90);
  b.expect(g.persist.endings[ending], `ending ${ending} reached`);
  b.expect(b.count('hit') === hits0, 'no damage in chapter six');
};
