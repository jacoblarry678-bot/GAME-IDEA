/**
 * Chapter three: Stillwater. Tiled bathing halls, shallow pools, changing
 * rooms and an oversized filtration plant. Pale daylight through windows
 * that reveal no exterior. Sound carries across water; dry grating provides
 * readable safety. Target 55-70 minutes.
 */
const H = 0.3; // raised dry decks and islands

const rooms = [
  { id: '3.01', name: 'Escalator drain', x0: 11, z0: -28, w: 6, d: 12, h: 6, kit: 'pool', surface: 'whitetile' },
  { id: '3.02', name: 'Changing hall', x0: 8, z0: -16, w: 12, d: 16, h: 4, kit: 'pool', surface: 'whitetile' },
  { id: '3.03', name: 'Refuge R1', x0: 2, z0: -10, w: 6, d: 5, h: 3, kit: 'pool', surface: 'whitetile', refuge: 'R1' },
  { id: '3.04', name: 'Main pool', x0: 0, z0: 0, w: 28, d: 24, h: 10, kit: 'pool', surface: 'pooltile', lights: poolLights(),
    floors: [[0.2, 0.2, 27.8, 3, H], [11, 7, 17, 11, H], [11, 16, 16, 20, H], [22, 12, 27.8, 23.8, H], [0.2, 20, 5, 23.8, H]] },
  { id: '3.05', name: 'Filtration room', x0: 28, z0: 14, w: 12, d: 14, h: 5, kit: 'pool', surface: 'concrete', wall: 'concrete' },
  { id: '3.06', name: 'Observation gallery', x0: -16, z0: 24, w: 24, d: 5, h: 5, kit: 'pool', surface: 'whitetile' },
  { id: '3.07', name: 'Drained service basin', x0: 22, z0: 28, w: 18, d: 10, h: 5, kit: 'pool', surface: 'concrete', wall: 'whiteTile' },
  { id: '3.08', name: 'Engineer locker bay', x0: 8, z0: 24, w: 8, d: 10, h: 4, kit: 'pool', surface: 'concrete', wall: 'paintBlock' },
  { id: '3.09', name: 'Refuge R2', x0: 16, z0: 29, w: 6, d: 5, h: 3, kit: 'pool', surface: 'whitetile', refuge: 'R2' },
  { id: '3.10', name: 'Reflection hall', x0: 8, z0: 34, w: 14, d: 14, h: 8, kit: 'pool', surface: 'pooltile', ceiling: 'chrome' },
  { id: '3.11', name: 'Relay T3', x0: 10, z0: 48, w: 10, d: 12, h: 5, kit: 'relay', surface: 'concrete' },
  { id: '3.12', name: 'Tile stairwell', x0: 20, z0: 48, w: 5, d: 14, h: 8, kit: 'pool', surface: 'whitetile' },
];
function poolLights() { const o = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) o.push([3.5 + i * 7, 4 + j * 8, 7]); return o; }

const doors = [
  { id: 'd301', a: '3.01', b: '3.02', type: 'arch', w: 2.4 },
  { id: 'r1', a: '3.02', b: '3.03', type: 'refuge' },
  { id: 'd304', a: '3.02', b: '3.04', type: 'arch', w: 2.4, label: 'To the main pool' },
  { id: 'd305', a: '3.04', b: '3.05', type: 'door' },
  { id: 'd306', a: '3.04', b: '3.06', type: 'door', pos: 2.6 },
  { id: 'basin', a: '3.05', b: '3.07', type: 'gate', w: 2.2, lock: 'P5.done', lockText: 'The basin access gate opens once the basin is drained.', label: 'Basin access gate' },
  { id: 'd368', a: '3.06', b: '3.08', type: 'door' },
  { id: 'eng', a: '3.08', b: '3.09', type: 'door', lock: 'P5.done', lockText: 'The basin interlock holds this door shut until the service basin is drained.' },
  { id: 'r2', a: '3.07', b: '3.09', type: 'refuge' },
  { id: 'd2r', a: '3.09', b: '3.10', type: 'door', label: 'Reflection hall' },
  { id: 'tiles', a: '3.10', b: '3.11', type: 'door', pos: 16.25, w: 1.4, lock: 'P6.done', lockText: 'Locked from the far side of the tiles.' },
  { id: 'd312', a: '3.11', b: '3.12', type: 'arch', w: 2 },
];

const water = [
  // main pool water channels between the dry decks and islands
  { x0: 0.2, z0: 3, x1: 27.8, z1: 7, depth: 0.22, body: 'pool' },
  { x0: 0.2, z0: 7, x1: 11, z1: 11, depth: 0.22, body: 'pool' },
  { x0: 17, z0: 7, x1: 27.8, z1: 11, depth: 0.22, body: 'pool' },
  { x0: 0.2, z0: 11, x1: 27.8, z1: 12, depth: 0.22, body: 'pool' },
  { x0: 0.2, z0: 12, x1: 22, z1: 16, depth: 0.22, body: 'pool' },
  { x0: 0.2, z0: 16, x1: 11, z1: 20, depth: 0.22, body: 'pool' },
  { x0: 16, z0: 16, x1: 22, z1: 20, depth: 0.22, body: 'pool' },
  { x0: 5, z0: 20, x1: 22, z1: 23.8, depth: 0.22, body: 'pool' },
  // intake channel (filtration room) and observation channel, reached only through drains
  { x0: 36.6, z0: 14.2, x1: 39.8, z1: 27.8, depth: 0.5, body: 'intake' },
  { x0: -15.8, z0: 27.1, x1: 1.8, z1: 28.8, depth: 0.5, body: 'gallery' },
  // the service basin before it is drained
  { x0: 22.2, z0: 28.2, x1: 39.8, z1: 37.8, depth: 0.4, until: 'P5.done', body: 'basin' },
  // under the reflection tiles (visual; the creature is shown beneath the glass)
  { x0: 10, z0: 36, x1: 20, z1: 46, depth: -0.05, body: 'tiles', visualOnly: true },
  // the decorative pool in the changing hall
  { x0: 9.1, z0: -14.9, x1: 12.4, z1: -10.6, depth: 0.25, body: 'deco' },
  // displaced water in the escalator drain
  { x0: 11.2, z0: -22, x1: 16.8, z1: -19, depth: 0.04, body: 'puddle' },
];

const drains = [
  { a: { x: 27, z: 4 }, b: { x: 38.2, z: 15.2 }, len: 30 },
  { a: { x: 1.2, z: 19 }, b: { x: -14.5, z: 28 }, len: 30 },
];

const surfaces = [
  { x0: 33.6, z0: 14.2, x1: 36.5, z1: 27.8, s: 'grate' },
];

const props = [
  // 3.01
  { k: 'escalator', x: 14, z: -27, rot: 180, s: [1.6, 4, 0.4] },
  { k: 'grating', x: 14, z: -20.5, s: [2, 2, 0.06] },
  // 3.02 changing hall
  { k: 'lockerBank', x: 19.5, z: -12, rot: 270, s: [4.8, 0.5, 2.0] }, { k: 'lockerBank', x: 19.5, z: -5, rot: 270, s: [4.8, 0.5, 2.0] },
  { k: 'locker', x: 19.45, z: -2.4, rot: 270, id: 'L3a', face: 'W' }, { k: 'locker', x: 8.55, z: -2.4, rot: 90, id: 'L3b', face: 'E' },
  { k: 'bench', x: 16.5, z: -8.5, rot: 90 }, { k: 'bench', x: 16.5, z: -12, rot: 90 },
  { k: 'railing', x: 10.75, z: -15.0, s: [3.5, 0.08, 0.9] }, { k: 'railing', x: 10.75, z: -10.5, s: [3.5, 0.08, 0.9] }, { k: 'railing', x: 12.5, z: -12.75, rot: 90, s: [4.5, 0.08, 0.9] },
  // 3.04 main pool
  { k: 'lifeguardChair', x: 25, z: 1.6 },
  { k: 'lever', x: 14, z: 9, y: 1.2, solid: false },
  { k: 'lane', x: 14, z: 13.5, s: [22, 0.12, 0.3] },
  { k: 'floatCup', x: 14, z: 5.5, y: 0.22, id: 'cup', dynamic: true, hideIf: 'ch3.cupStruck' },
  { k: 'windowArch', x: 14, z: 23.8, y: 3.5, s: [10, 0.1, 5.5] },
  // 3.05 filtration
  { k: 'railing', x: 36.45, z: 21, rot: 90, s: [13.6, 0.08, 1.05] },
  { k: 'pump', x: 30.5, z: 16.2 }, { k: 'tank', x: 33, z: 25.8 }, { k: 'pipeRun', x: 34, z: 26.8, y: 3.0, s: [11.6, 0.3, 0.3] },
  { k: 'workbench', x: 29.0, z: 22, rot: 90 },
  // 3.06 observation gallery: glass over the channel
  { k: 'glass', x: -7, z: 26.95, s: [17.6, 0.06, 2.6], mask: 3 }, { k: 'bench', x: -7, z: 25.0 },
  // 3.07 drained basin
  { k: 'pipeRun', x: 31, z: 37.6, y: 0.4, s: [17, 0.4, 0.4] }, { k: 'drum', x: 38.8, z: 36.8 }, { k: 'crate', x: 24, z: 36.6 },
  // 3.08 engineer bay
  { k: 'lockerBank', x: 15.7, z: 27.4, rot: 270, s: [4.8, 0.5, 2.0] }, { k: 'workbench', x: 11, z: 24.65 },
  { k: 'glass', x: 12, z: 33.65, s: [1.2, 0.06, 1.8], solid: false },
  // 3.10 reflection hall: rails stop the grid being bypassed, dividers fix the intended turns
  { k: 'railing', x: 10, z: 41, rot: 90, s: [10, 0.08, 1.05] }, { k: 'railing', x: 20, z: 41, rot: 90, s: [10, 0.08, 1.05] },
  { k: 'block', x: 9.1, z: 41, s: [1.8, 10, 1.2], hidden: true }, { k: 'block', x: 20.9, z: 41, s: [1.8, 10, 1.2], hidden: true },
  { k: 'divider', x: 13.75, z: 41, s: [2.5, 0.12, 1.0] }, { k: 'divider', x: 16.25, z: 43.5, s: [2.5, 0.12, 1.0] },
  ...[12.5, 15, 17.5].flatMap((x) => [38.5, 41, 43.5].map((z) => ({ k: 'post', x, z }))),
  { k: 'tileGrid', x: 15, z: 41, s: [10, 10, 0.05] },
  { k: 'bridge', x: 15, z: 41, s: [10, 10, 0.05], dynamic: true, showIf: 'P6.done', path: ['B1', 'B2', 'C2', 'C3', 'B3', 'B4', 'C4'] },
  // 3.11 relay T3
  { k: 'relay', x: 17.5, z: 59.4 }, { k: 'console', x: 12.5, z: 59.3, s: [2.0, 0.7, 1.1] }, { k: 'waveScreen', x: 15, z: 59.85, y: 1.7, s: [2.0, 0.05, 0.9] },
  // 3.12 stairwell
  { k: 'stairsDown', x: 22.5, z: 57, s: [3.6, 8, 0.4] },
];

const hidden = [
  { id: 'h3path', x: 15, y: 7.95, z: 41, face: 'down', w: 10, h: 10, art: 'reflectionPath', clue: 'clue.P6', quest: true, text: 'In the developed image the ceiling reflection shows one continuous maintenance line across the tiles: B1, B2, C2, C3, B3, B4, C4, then the exit.', clueText: 'Reflection hall ceiling: safe line B1 · B2 · C2 · C3 · B3 · B4 · C4, columns A-D left to right from the entrance.' },
  { id: 'h3stairs', x: 10.75, y: 0.05, z: -12.75, face: 'up', w: 3.2, h: 4.0, art: 'stairsBelow', secret: 'S3', anyFacing: true, text: 'Beneath the surface of the decorative pool, an extra staircase descends into the tiles.' },
];

const stations = [
  { id: 'S3', panel: { x: 9.0, y: 1.1, z: 34.6, face: 'N' }, cam: { x: 9.4, y: 1.6, z: 35.2, yaw: -2.356, pitch: 0.68 }, alcove: [8.2, 34.2, 11.2, 36.7], puzzle: 'P6', target: 'h3path' },
];

const puzzles = [
  {
    id: 'P5', type: 'valves', title: 'Filtration panel', panel: { x: 31, y: 1.3, z: 27.65, face: 'S' },
    instructions: 'Inlet A, bypass B, drain C and the pump. The maintenance diagram: isolate the inlet, open bypass and drain, then start the pump.',
    labels: { A: 'INLET A', B: 'BYPASS B', C: 'DRAIN C' },
    required: { A: 'closed', B: 'open', C: 'open' },
    unmetText: { A: 'Isolate the inlet first.', B: 'Open the bypass.', C: 'Open the drain.' },
    onPumpStart: (pz) => { const g = pz.game; if (!g.story.has('ch3.pumpFirst')) { g.story.set('ch3.pumpFirst'); g.story.play('pumpFirst'); const D = g.enemyById('D'); if (D) { D.suspect = { x: 38.2, z: 20, t: g.time }; D.setState('investigate'); } } },
    doneText: 'The service basin drains to a dry floor. Its access gate opens.',
  },
  {
    id: 'E2', type: 'latch', title: 'Clear cabinet · ROOK', panel: { x: 12, y: 1.3, z: 33.6, face: 'S' },
    instructions: 'The latch is powered by a local breaker. Printed beside it: isolate the cabinet breaker, wait for the indicator to go dark, pull the mechanical release.',
    doneText: 'The cabinet opens. Rook\'s maintenance bypass key.',
  },
  {
    id: 'P6', type: 'tiles', title: 'Reflection tiles',
    grid: { x0: 10, z0: 36, size: 2.5, entrance: { x: 15, z: 35.1 } },
    safe: ['B1', 'B2', 'C2', 'C3', 'B3', 'B4', 'C4'],
    doneText: 'The tiles you crossed stay lit. A maintenance bridge extends across the hall.',
  },
];

const records = [
  { id: '13', title: 'Pool hours', x: 3.4, y: 1.0, z: -9.5 },
  { id: '14', title: 'Drain inspection', x: 29.0, y: 1.0, z: 21.2 },
  { id: '15', title: 'Dry route', x: -7.0, y: 0.5, z: 25.0 },
  { id: '16', title: 'Rook recording two', audio: true, x: 13.0, y: 1.0, z: 33.5 },
  { id: '17', title: 'Reflection ticket', x: 12.5, y: 1.0, z: 34.5 },
  { id: '18', title: 'Reference label', x: 12.5, y: 1.15, z: 59.2 },
];

const pickups = [
  { id: 'c3bat', item: 'battery', perPlayer: 1, route: 'critical', x: 16.5, y: 0.5, z: -8.5 },
  { id: 'c3film', item: 'film', perTwo: 1, route: 'critical', x: 29.0, y: 1.0, z: 22.6 },
  { id: 'c3aid', item: 'firstaid', qty: 1, route: 'critical', x: 24.5, y: H + 0.1, z: 22.5 },
  { id: 'c3tea', item: 'tea', perPlayer: 1, route: 'critical', x: 6.5, y: 0.8, z: -6.2 },
  { id: 'o3bat1', item: 'battery', qty: 1, route: 'optional', x: -13.5, y: 0.5, z: 25.0 },
  { id: 'o3bat2', item: 'battery', qty: 1, route: 'optional', x: 38.8, y: 1.0, z: 36.8 },
  { id: 'o3film1', item: 'film', qty: 1, route: 'optional', x: 11.0, y: 1.0, z: 24.65 },
  { id: 'o3film2', item: 'film', qty: 1, route: 'optional', x: 18.5, y: 1.15, z: 59.0 },
  { id: 'o3tea', item: 'tea', qty: 1, route: 'optional', x: 16.5, y: 0.5, z: -12 },
  { id: 'o3aid', item: 'firstaid', qty: 1, route: 'optional', x: 24.0, y: 0.8, z: 36.6 },
  { id: 'o3decoy1', item: 'decoy', qty: 1, route: 'optional', x: 3, y: H + 0.1, z: 1.6 },
  { id: 'o3decoy2', item: 'decoy', qty: 1, route: 'optional', x: 30.5, y: 1.7, z: 16.2 },
];

const interactables = [
  { id: 'lever1', kind: 'overflow', name: 'Overflow lever', verb: 'Release', x: 14, y: 1.0, z: 9, stream: { x: 2, z: 5 }, mesh: 'lever' },
  { id: 'lever2', kind: 'overflow', name: 'Overflow lever', verb: 'Release', x: 13.5, y: 1.0, z: 18.6, stream: { x: 2, z: 13 }, mesh: 'lever' },
  { id: 'lever3', kind: 'overflow', name: 'Overflow lever', verb: 'Release', x: 23.0, y: 1.0, z: 12.8, stream: { x: 18, z: 22.5 }, mesh: 'lever' },
  { id: 't3switch', kind: 'switch', name: 'Relay T3', verb: 'Restore', x: 17.5, y: 1.3, z: 58.85, face: 'S' },
  { id: 'stairs', kind: 'lift', name: 'Tile stairwell', verb: 'Descend', x: 22.5, y: 1.1, z: 52.5, requires: 'T3' },
];

const hints = {
  pool: ['The main pool is north of the changing hall. Watch the water before you step in.'],
  crossing: ['Footsteps in the water carry. Crouch to wade quietly; it still sees ripples close by. The dry islands and grating are safe.', 'Each island has an overflow lever that pulls the creature to a distant corner for six seconds.', 'Use a lever, then cross to the next island while it is drawn away. The filtration room is east.'],
  pump: ['The diagram on the filtration panel lists the order: isolate the inlet, open bypass and drain, start the pump.', 'Inlet A closed, bypass B open, drain C open.', 'Set A closed, B open, C open, then press PUMP and stay at the panel for eight seconds.'],
  basin: ['The drained basin is north of the filtration room. Refuge R2 is at its west end.'],
  tiles: ['The tiles look identical. The ceiling above them is a reflection; photograph it from the entrance, or use the Survey Station.', 'Columns are A to D from left to right, rows 1 to 4 from the entrance.', 'Step on B1, B2, C2, C3, B3, B4, C4, then the exit ledge.'],
  relayT3: ['The relay T3 panel is on the north wall.'],
  stairs: ['The tile stairwell is east of relay T3.'],
};
const navHints = { pool: 'd304', crossing: 'd305', pump: 'd305', basin: 'basin', tiles: 'd2r', relayT3: 'tiles', stairs: 'd312' };

// ------------------------------------------------------------------ script
function ensure(game, entry) {
  if (entry === 'return') return;
  const S = game.story;
  if (!game.enemyById('D')) {
    const pos = S.has('ch3.pumpFirst') ? { x: 38.2, z: 20 } : { x: 21, z: 5 };
    game.spawn('drowned', { id: 'D', ...pos, anchors: [{ x: 21, z: 5 }, { x: 6, z: 14 }, { x: 19, z: 21.5 }, { x: 3, z: 9 }], withdrawTo: { x: 21, z: 5 }, armed: S.has('ch3.island1'), state: S.has('ch3.cupStruck') ? 'patrol' : 'dormant' });
  }
}

export const script = {
  init(game, entry) {
    const S = game.story;
    ensure(game, entry);
    if (entry === 'start') { S.setObjective('pool', 'Find a way through the baths.'); S.setRadio('Restore relay three. Keep to the tiles.'); game.after(3, 'scene:poolArrival'); }
    if (entry === 'return') S.setObjective('return3', 'Recover Rook\'s key from the engineer bay, then take the freight lift back.');
  },

  update(game) {
    const S = game.story;
    if (game.returnTrip) return;
    const D = game.enemyById('D');
    // the cup demonstration: the wake accelerates toward the floating cup and strikes it
    if (S.has('ch3.cupDemo') && !S.has('ch3.cupStruck') && D) {
      if (Math.hypot(D.x - 14, D.z - 5.5) < 1.2) { S.set('ch3.cupStruck'); game.fx('sfx', { name: 'splash', x: 14, z: 5.5 }); game.fx('caption', { text: '[The floating cup is yanked under the water]', env: true }); D.setState('patrol'); }
    }
    if (!S.has('ch3.island1')) {
      for (const p of game.players.values()) if (p.x > 11 && p.x < 17 && p.z > 7 && p.z < 11 && p.y > 0.2) { S.set('ch3.island1'); if (D) D.armed = true; S.setObjective('crossing', 'Cross the pool to the filtration room.'); }
    }
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    if (game.returnTrip) return;
    if (room.id === '3.04' && !S.has('ch3.cupDemo')) {
      S.set('ch3.cupDemo');
      const D = game.enemyById('D');
      if (D) { D.setState('investigate'); D.suspect = { x: 14, z: 5.5, t: game.time }; D.lure = { x: 14, z: 5.5, until: game.time + 20 }; }
      game.fx('warning', { type: 'drowned', x: 21, z: 5, text: 'Water moving toward the floating cup.', target: p.id });
      game.fx('tutorial', { id: 'water', text: 'Footsteps in water carry. Crouch to wade quietly. Dry islands, decks and grating are safe.' });
    }
    if (room.id === '3.06' && first) {
      const D = game.enemyById('D');
      if (D && D.state !== 'pursue' && D.state !== 'warn') { D.suspect = { x: -10, z: 28, t: game.time }; D.lure = { x: -10, z: 28, until: game.time + 25 }; D.setState('investigate'); }
    }
    if (room.id === '3.05' && first && !S.has('P5.done')) S.setObjective('pump', 'Drain the service basin.');
    if (room.id === '3.10' && first && !S.has('P6.done')) S.setObjective('tiles', 'Cross the reflection tiles.');
  },

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.kind === 'overflow' && phase === 'begin') {
      const v = S.vars; v.levers = v.levers || {};
      if (v.levers[it.id] && game.time < v.levers[it.id]) return { ok: false, msg: `The lever is recharging (${Math.ceil(v.levers[it.id] - game.time)} s).` };
      v.levers[it.id] = game.time + 12;
      game.decoys.push({ id: `stream-${it.id}`, x: it.stream.x, z: it.stream.z, until: game.time + 6, acc: 1, kind: 'stream' });
      game.fx('sfx', { name: 'leverClunk', x: it.x, z: it.z });
      game.fx('stream', { x: it.stream.x, z: it.stream.z, dur: 6 });
      game.fx('caption', { text: '[Water rushes out of an overflow in the far corner]', env: true });
      return { ok: true };
    }
    if (it.id === 't3switch' && phase === 'begin') {
      if (S.has('T3')) return { ok: true };
      S.set('T3');
      game.fx('network', { segment: 'T3' });
      game.fx('sfx', { name: 'relayClick', x: it.x, z: it.z });
      S.play('t3Done');
      S.addClue('T3.label', 'Relay T3 display: a waveform labeled HUMAN REFERENCE. It has a pulse. (The Operator calls it a damaged microphone profile.)', 'observed');
      S.setObjective('stairs', 'Take the tile stairwell down.');
      game.requestCheckpoint('relay T3');
      return { ok: true };
    }
    if (it.id === 'stairs' && phase === 'begin') {
      if (!S.has('T3')) return { ok: false, msg: 'The stairwell lights are dead.' };
      game.beginTransition('stairs', 4, { dur: 6 });
      return { ok: true };
    }
    if (it.id === 'returnLift' && phase === 'begin') { game.beginTransition('lift', 6, { entry: 'nexus', dur: 4 }); return { ok: true }; }
    return null;
  },

  onPuzzle(game, pz) {
    const S = game.story;
    if (pz.id === 'P5') { S.setObjective('basin', 'Cross the drained basin to the refuge.'); game.requestCheckpoint('basin drained'); }
    if (pz.id === 'E2') { game.collectEvidence('E2', null); S.play('rookKey'); }
    if (pz.id === 'P6') { S.setObjective('relayT3', 'Restore relay T3.'); game.requestCheckpoint('reflection tiles crossed'); }
  },
};

function returnTrip(def) {
  const keep = new Set(['3.08']);
  const inRoom = (o) => def.rooms.some((r) => keep.has(r.id) && o.x >= r.x0 && o.x <= r.x0 + r.w && o.z >= r.z0 && o.z <= r.z0 + r.d);
  return {
    ...def,
    rooms: [...def.rooms.filter((r) => keep.has(r.id)), { id: 'R.03', name: 'Freight return landing', x0: 4, z0: 29, w: 4, d: 4, h: 3, surface: 'metal', kit: 'lift' }],
    doors: [{ id: 'ret', a: 'R.03', b: '3.08', type: 'arch', w: 2 }],
    props: def.props.filter(inRoom), pickups: [], records: def.records.filter(inRoom), hidden: [], stations: [], water: [], drains: [],
    puzzles: def.puzzles.filter((p) => p.id === 'E2'),
    interactables: [{ id: 'returnLift', kind: 'lift', name: 'Freight return lift', verb: 'Return to the freight nexus', x: 4.6, y: 1.2, z: 31 }],
    wallDoors: [], director: null,
    start: { x: 6, z: 31, yaw: -Math.PI / 2 },
  };
}

export default {
  id: 3,
  title: 'Stillwater',
  kit: 'pool',
  fog: { color: 0x7a96a0, density: 0.02 },
  hemi: 0.6,
  ambient: 'pool',
  music: 'beneathTheTiles',
  start: { x: 14, z: -25.5, yaw: Math.PI },
  replayKit: { flashlight: true, camera: true, pouch: [['battery', 1], ['firstaid', 1]] },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints, water, drains, surfaces,
  wallDoors: [{ room: '3.08', side: 'W', pos: 2, label: 'Freight return lift (out of service)' }],
  director: { ambient: ['pipeKnock', 'distantDoor'] },
  script,
  returnTrip,
};
