/** Per-chapter bot routines used by tools/playthrough.mjs. */

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
