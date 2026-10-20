/**
 * Chapter one: The Yellow Silence. Teaches observation, camera development,
 * refuge verification, sound, and the difference between a radio
 * instruction and a trusted objective. Target 50-65 minutes on a first visit.
 */
import { cubicleCluster, row } from './util.js';

const rooms = [
  { id: 'A.00', name: 'Annex service corridor', x0: -2, z0: -20, w: 4, d: 20, h: 3, kit: 'annex', surface: 'concrete', swapKit: { flag: 'ch1.entered', kit: 'office' }, noSpawn: true },
  { id: '1.01', name: 'Arrival corridor', x0: -2, z0: 0, w: 4, d: 16, h: 3 },
  { id: '1.02', name: 'Reception', x0: -5, z0: 16, w: 10, d: 12, h: 3 },
  { id: '1.03', name: 'Refuge R1', x0: -11, z0: 20, w: 6, d: 5, h: 3, refuge: 'R1' },
  { id: '1.04', name: 'Cubicle field', x0: -11, z0: 28, w: 22, d: 18, h: 3 },
  { id: '1.05', name: 'Copy room', x0: 11, z0: 36, w: 8, d: 8, h: 3 },
  { id: '1.06', name: 'Survey corridor', x0: -11, z0: 46, w: 4, d: 18, h: 3 },
  { id: '1.07', name: 'Breaker room', x0: -7, z0: 56, w: 8, d: 8, h: 3, surface: 'concrete', light: 'dim' },
  { id: '1.08', name: 'Personnel records', x0: 11, z0: 44, w: 10, d: 12, h: 3 },
  { id: '1.09', name: 'Listening hall', x0: 1, z0: 56, w: 24, d: 5, h: 3, light: 'dim', flicker: true, lights: [[4, 58.5], [10, 58.5], [16, 58.5], [22, 58.5]] },
  { id: '1.10', name: 'Refuge R2', x0: 25, z0: 56, w: 6, d: 5, h: 3, refuge: 'R2' },
  { id: '1.11', name: 'Relay T1', x0: 24, z0: 61, w: 10, d: 10, h: 4, surface: 'concrete' },
  { id: '1.12', name: 'Service lift', x0: 34, z0: 63, w: 5, d: 6, h: 4, surface: 'metal', kit: 'lift' },
];

const doors = [
  { id: 'gate', a: 'A.00', b: '1.01', type: 'gate', w: 2.2, h: 2.6, lock: 'ch1.gate', label: 'Service isolation gate', opaque: true },
  { id: 'd101', a: '1.01', b: '1.02', type: 'door', open: true },
  { id: 'r1', a: '1.02', b: '1.03', type: 'refuge' },
  { id: 'd104', a: '1.02', b: '1.04', type: 'arch', w: 3 },
  { id: 'd105', a: '1.04', b: '1.05', type: 'door' },
  { id: 'd106', a: '1.04', b: '1.06', type: 'door', open: true },
  { id: 'd108c', a: '1.05', b: '1.08', type: 'door' },
  { id: 'd107', a: '1.06', b: '1.07', type: 'door' },
  { id: 'hall', a: '1.07', b: '1.09', type: 'fire', lock: 'P1.done', lockText: 'No power. The magnetic lock is engaged.', label: 'Fire door' },
  { id: 'rec1', a: '1.08', b: '1.09', type: 'door', pos: 13, lock: 'P1.done', lockText: 'The electric latch has no power.', label: 'Records door' },
  { id: 'rec2', a: '1.08', b: '1.09', type: 'fire', pos: 19, lock: 'P1.done', lockText: 'The electric latch has no power.', label: 'Records fire door' },
  { id: 'r2', a: '1.09', b: '1.10', type: 'refuge' },
  { id: 'd111', a: '1.10', b: '1.11', type: 'door' },
  { id: 'lift', a: '1.11', b: '1.12', type: 'lift', w: 1.8, lock: 'T1', label: 'Service lift doors', lockText: 'The lift has no call power.' },
];

const props = [
  // A.00 annex corridor
  { k: 'pipeRun', x: -1.55, z: -10, y: 2.45, rot: 90, s: [18, 0.3, 0.3] },
  { k: 'pipeRun', x: 1.6, z: -10, y: 2.6, rot: 90, s: [18, 0.2, 0.2] },
  { k: 'boxes', x: 1.35, z: -15 }, { k: 'drum', x: -1.3, z: -6.5 },
  // 1.01
  { k: 'chair', x: 1.2, z: 8, rot: 90 }, { k: 'boxes', x: -1.4, z: 12.5 },
  // 1.02 reception
  { k: 'counter', x: 2.8, z: 22, rot: 90 }, { k: 'chair', x: 3.9, z: 22, rot: 270 },
  { k: 'directory', x: -3.6, z: 27.5 },
  { k: 'plant', x: 4.3, z: 16.9 }, { k: 'plant', x: -4.3, z: 16.9 },
  { k: 'table', x: -4.1, z: 18.3, s: [0.7, 0.7, 0.5] },
  { k: 'chair', x: -4.3, z: 19.4, rot: 90 }, { k: 'chair', x: -4.3, z: 25.6, rot: 90 }, { k: 'chair', x: -4.3, z: 26.5, rot: 90 },
  { k: 'seam', x: -3.6, z: 22.5, solid: false },
  // 1.03 R1
  { k: 'table', x: -9.6, z: 20.8, s: [1.2, 0.6, 0.75] },
  { k: 'chair', x: -10.3, z: 24.0 },
  // 1.04 cubicle field
  ...cubicleCluster(-5, 34, { sign: 'circle', tint: 'red', tall: true }),
  ...cubicleCluster(5, 34, { sign: 'triangle', tint: 'blue', tall: true }),
  ...cubicleCluster(0, 41, { sign: 'square', tint: 'green' }),
  { k: 'cabinet', x: -10.45, z: 31 }, { k: 'cabinet', x: -10.45, z: 36, rot: 90 }, { k: 'cabinet', x: 10.45, z: 31 }, { k: 'cabinet', x: 10.45, z: 44.5 },
  { k: 'plant', x: -10.3, z: 28.7 }, { k: 'plant', x: 10.3, z: 28.7 }, { k: 'plant', x: 10.3, z: 37.4 },
  { k: 'copier', x: -7.5, z: 45.3 }, { k: 'boxes', x: 8.5, z: 45.3 },
  // 1.05 copy room (mesh wall hides a service cavity on the east side)
  { k: 'mesh', x: 17.6, z: 40, rot: 90, s: [7.6, 0.06, 2.8] },
  { k: 'copier', x: 13, z: 43.3 }, { k: 'copier', x: 15.8, z: 43.3 }, { k: 'table', x: 13.4, z: 37.1, s: [2.2, 0.7, 0.75] },
  { k: 'shelf', x: 11.45, z: 42.7, rot: 90, s: [2.0, 0.4, 1.6] },
  // 1.06 survey corridor
  { k: 'boxes', x: -8.0, z: 58 }, { k: 'cabinet', x: -10.45, z: 61.5 }, { k: 'cableTray', x: -7.5, z: 50.75, y: 2.6, solid: false, s: [0.5, 3.0, 0.3] },
  { k: 'partition', x: -9.55, z: 49.25, s: [2.5, 0.08, 1.5] },
  // 1.07 breaker room
  { k: 'workbench', x: -5.8, z: 57.0 }, { k: 'cabinetTall', x: 0.3, z: 62.5, rot: 90 }, { k: 'drum', x: -6.3, z: 63.2 }, { k: 'crate', x: -0.3, z: 57.2 },
  // 1.08 personnel records
  ...row('shelf', 2, 12.6, 47.6, 2.0, 0), { k: 'shelf', x: 18.6, z: 47.6 },
  { k: 'shelf', x: 13.6, z: 50.6 }, { k: 'shelf', x: 17.6, z: 50.6 },
  { k: 'cabinetTall', x: 16, z: 54.1, id: 'recordsCabinet' },
  { k: 'cabinet', x: 11.5, z: 50, rot: 90 }, { k: 'desk', x: 19.6, z: 45.2 }, { k: 'chair', x: 19.6, z: 46.0, rot: 180 },
  { k: 'cabinet', x: 20.5, z: 52, rot: 90 },
  // 1.09 listening hall
  { k: 'cabinetFallen', x: 9.5, z: 59.6, rot: 90 },
  { k: 'vent', x: 2.6, z: 60.75, y: 0.4, solid: false }, { k: 'vent', x: 16.5, z: 60.75, y: 0.4, solid: false },
  { k: 'chair', x: 22, z: 56.7 }, { k: 'plant', x: 2.0, z: 60.3 },
  // 1.11 relay T1
  { k: 'relay', x: 29, z: 70.3 }, { k: 'relay', x: 24.7, z: 66, rot: 90 }, { k: 'relay', x: 33.3, z: 68.5, rot: 90 },
  { k: 'console', x: 26.5, z: 62.2 }, { k: 'pipeRun', x: 29, z: 70.6, y: 3.4, s: [9, 0.3, 0.3] },
  // 1.12 lift
  { k: 'liftPanel', x: 38.7, z: 66, y: 1.2, solid: false, rot: 270 },
];

const hidden = [
  { id: 'h1chair', x: -10.3, y: 0.47, z: 24.0, face: 'up', w: 0.45, h: 0.45, art: 'footprint', anyFacing: true, onPhoto: 'ch1.tutorialPhoto', text: 'A muddy work-boot footprint on the seat of the empty chair.' },
  { id: 'h1wall', x: -10.78, y: 1.3, z: 40, face: 'E', w: 1.3, h: 2.4, art: 'listenerWall', text: 'Inside the wall cavity, a thin jointed figure stands pressed against the wallpaper. Its head looks like bundled cable insulation.' },
  { id: 'h1cables', x: -7.21, y: 1.5, z: 50.75, face: 'W', w: 3.0, h: 2.2, art: 'cables3', clue: 'clue.P1', quest: true, text: 'Three cable paths continue beneath the wallpaper. From left to right they are marked with a circle, a triangle and a square.', clueText: 'Survey corridor cables, left to right: ○ circle, △ triangle, □ square.' },
  { id: 'h1secret', x: -3.6, y: 1.45, z: 27.28, face: 'S', w: 1.2, h: 1.6, art: 'directorySecret', secret: 'S1', from: [-3.6, 22.5, 0.9], text: 'From the marked seam, the directory sign-in sheet lists EVAN WARD, MAINTENANCE, signed in for tomorrow.' },
];

const stations = [
  { id: 'S1', panel: { x: -10.55, y: 1.1, z: 50.75, face: 'E' }, cam: { x: -10.3, y: 1.55, z: 50.75, yaw: -Math.PI / 2, pitch: 0 }, alcove: [-10.8, 49.3, -8.4, 52.3], puzzle: 'P1', target: 'h1cables' },
];

const puzzles = [
  {
    id: 'P1', type: 'sequence', title: 'Breaker panel', panel: { x: -3, y: 1.4, z: 63.7, face: 'S' },
    instructions: 'Three breakers. Each circuit label is embossed with a symbol. A RESET lever re-arms the panel.',
    arm: 'reset', armLabel: 'RESET', armText: 'Panel re-armed. Enable the circuits.',
    buttons: [{ id: 'b1', label: 'CIRCUIT 1', sub: '△ triangle', sym: 'triangle' }, { id: 'b2', label: 'CIRCUIT 2', sub: '□ square', sym: 'square' }, { id: 'b3', label: 'CIRCUIT 3', sub: '○ circle', sym: 'circle' }],
    solution: ['b3', 'b1', 'b2'], kind: 'breaker',
    wrongText: 'A quiet click. The panel trips and all three breakers drop.', wrongSound: 'trip',
    idleDisplay: 'TRIPPED · RESET REQUIRED', armedDisplay: 'ARMED', doneDisplay: 'LISTENING HALL · POWER ON', doneText: 'Power restored to the listening hall.',
  },
  {
    id: 'P2', type: 'sequence', title: 'Relay T1 terminal', panel: { x: 29, y: 1.3, z: 69.65, face: 'S' },
    instructions: 'IDENTIFY YOURSELF. Three tone buttons are embossed with one, two and three bars.',
    buttons: [{ id: 't1', label: '▮', sub: 'one bar' }, { id: 't2', label: '▮▮', sub: 'two bars' }, { id: 't3', label: '▮▮▮', sub: 'three bars' }],
    solution: ['t2', 't1', 't3'], finish: 'local', finishLabel: 'LOCAL SERVICE', kind: 'tone', stepSound: 'tone',
    extraButtons: { mic: 'MICROPHONE' },
    extra: {
      mic: (pz) => { pz.game.story.play('p2MicUsed', { force: true }); return { ok: false, msg: 'AUTHENTICATION FAILURE. Voice profile not accepted.', sound: 'authFail' }; },
    },
    wrongText: 'Tone rejected. The buttons reset.', wrongSound: 'toneBad', finishEarlyText: 'Incomplete tone test. The buttons reset.',
    idleDisplay: 'IDENTIFY YOURSELF', display: (pz) => (pz.done ? 'RELAY T1 · RESTORED' : `IDENTIFY YOURSELF${pz.state.seq.length ? ' · ' + '•'.repeat(pz.state.seq.length) : ''}`),
    doneText: 'Relay T1 restored. Network diagram segment added.',
  },
];

const records = [
  { id: '01', title: 'Evacuation notice', x: 2.8, y: 1.08, z: 23.2 },
  { id: '02', title: 'Clock check', x: -7.55, y: 0.8, z: 23.75 },
  { id: '03', title: 'Copy request', x: 13.0, y: 1.25, z: 43.25 },
  { id: '04', title: 'Personnel correction', x: 12.6, y: 1.1, z: 47.3 },
  { id: '05', title: 'Wall complaint', x: 19.5, y: 0.8, z: 45.0 },
  { id: '06', title: 'Local service', x: 2.35, y: 0.72, z: 22.6, requires: 'drawer1.open' },
];

const pickups = [
  { id: 'flashlight', tool: 'flashlight', name: 'Flashlight', x: 2.8, y: 1.08, z: 21.3 },
  { id: 'camera', tool: 'camera', name: 'Instant camera', x: -9.6, y: 0.82, z: 20.8 },
  { id: 'c1bat', item: 'battery', perPlayer: 1, route: 'critical', x: -6.25, y: 0.8, z: 32.45 },
  { id: 'c1band', item: 'bandage', perPlayer: 1, route: 'critical', x: 6.25, y: 0.8, z: 35.55 },
  { id: 'c1film', item: 'film', perTwo: 1, route: 'critical', x: -8.0, y: 0.65, z: 58 },
  { id: 'o1bat1', item: 'battery', qty: 1, route: 'optional', x: 12.6, y: 0.8, z: 37.1 },
  { id: 'o1bat2', item: 'battery', qty: 1, route: 'optional', x: 20.5, y: 1.4, z: 52 },
  { id: 'o1film', item: 'film', qty: 1, route: 'optional', x: 11.5, y: 1.4, z: 50 },
  { id: 'o1tea', item: 'tea', qty: 1, route: 'optional', x: -4.1, y: 0.52, z: 18.3 },
  { id: 'o1wedge1', item: 'wedge', qty: 1, route: 'optional', x: -1.25, y: 0.8, z: 39.45 },
  { id: 'o1wedge2', item: 'wedge', qty: 1, route: 'optional', x: 14, y: 0.15, z: 45.0 },
];

const interactables = [
  { id: 'gateWheel', kind: 'gateWheel', name: 'Service isolation gate', verb: 'Open', x: 1.35, y: 1.2, z: -0.55, hideAfter: 'ch1.gate' },
  { id: 'drawer1', kind: 'drawer', name: 'Reception drawer', verb: 'Open', x: 2.35, y: 0.72, z: 22.6, once: true },
  { id: 'practiceDecoy', kind: 'practiceDecoy', name: 'Practice decoy', verb: 'Wind up', x: 14.0, y: 0.85, z: 37.1 },
  { id: 'worksheet', kind: 'note', title: 'Routing worksheet', x: 30.75, y: 1.4, z: 59.4, face: 'W', clue: 'clue.P2', text: 'MAINTENANCE CALLS authenticate with the three-tone test, not voice. Test order: TWO bars, ONE bar, THREE bars. Then press LOCAL SERVICE.', clueText: 'Routing worksheet: tone test order is two bars, one bar, three bars, then LOCAL SERVICE.' },
  { id: 'lift1', kind: 'lift', name: 'Service lift controls', verb: 'Descend', x: 38.6, y: 1.3, z: 66, requires: 'T1' },
];

const hints = {
  signal: ['Walk to the far end of the service corridor.'],
  gate: ['The isolation gate at the end of the corridor has a handwheel. Interact with it.'],
  explore: ['The reception is ahead. Something on the counter gives light.'],
  refuge1: ['The room off reception has a clock on the wall. Look at its second hand for three seconds.'],
  photo: ['Raise the camera at the empty chair in the refuge and take a picture. It takes four seconds to develop.'],
  breaker: [
    'The survey corridor north of the cubicles has cables that vanish into the wall. Photograph that wall, or run the Survey Station facing it.',
    'Each cable carries a symbol. The breaker labels use the same symbols: circuit 1 triangle, circuit 2 square, circuit 3 circle.',
    'Pull RESET, then enable circuits 3, 1, 2.',
  ],
  hall: [
    'It hunts by sound and only sees close up. Keep sprints short. The records room gives you a loop.',
    'Crouch behind the tall records cabinet to break sight, then move quietly toward the east end.',
    'Reach Refuge R2 at the east end of the hall, close the door and watch the clock.',
  ],
  relay: [
    'The worksheet on the wall of Refuge R2 explains how maintenance calls authenticate.',
    'Tones, not voice. The worksheet lists two bars, one bar, three bars.',
    'Press two bars, one bar, three bars, then LOCAL SERVICE. The microphone will not work.',
  ],
  lift: ['The service lift is through the east side of the relay room.'],
};
const navHints = { explore: 'd101', refuge1: 'r1', breaker: 'd106', hall: 'r2', relay: 'd111', lift: 'lift' };

// ------------------------------------------------------------------ script
function ensureCreatures(game) {
  const S = game.story;
  if (!S.has('P1.done') && !game.enemyById('Ldemo')) {
    game.spawn('listener', { id: 'Ldemo', x: 18.2, z: 38, state: 'dormant', encounter: 'demo', region: [17.75, 36.3, 18.75, 43.7], anchors: [{ x: 18.2, z: 38 }, { x: 18.2, z: 42.5 }], withdrawTo: { x: 18.2, z: 43 } });
  }
}

export const script = {
  init(game, entry) {
    if (entry === 'start') {
      for (const p of game.players.values()) { p.hasFlashlight = false; p.hasCamera = false; p.flashOn = false; p.tool = 'radio'; }
      game.story.setObjective('signal', 'Find the source of the distress call.');
      game.after(1.5, 'scene:prologue');
    }
    ensureCreatures(game);
  },

  update(game) {
    const S = game.story;
    // the hall encounter starts a few metres in; the Listener comes out of the vent behind you
    if (S.has('P1.done') && !S.has('ch1.hallStarted')) {
      for (const p of game.players.values()) if (p.alive && p.room === '1.09' && p.x > 6) {
        S.set('ch1.hallStarted');
        game.fx('warning', { type: 'listener', x: 2.6, z: 60.5, text: 'One extra footstep. A tap inside the wall. The vent behind you shakes.', target: p.id });
        game.fx('sfx', { name: 'extraStep', x: 3.5, z: 58.5 });
        game.fx('sfx', { name: 'wallTap', x: 2.6, z: 60.8 });
        game.fx('ventShake', { x: 2.6, z: 60.75 });
        game.after(3.0 + (game.assists.reducedStartle ? 1 : 0), 'hallEmerge', { pid: p.id });
        break;
      }
    }
    if (!S.has('ch1.opening')) {
      for (const p of game.players.values()) if (p.room === 'A.00' && p.z > -12) {
        S.set('ch1.opening');
        S.play('opening'); S.play('coopCrew');
        S.setObjective('gate', 'Follow the signal through the service isolation gate.');
      }
    }
    // a single extra footstep after movement first stops in the yellow rooms
    if (S.has('ch1.entered') && !S.has('ch1.extraStep')) {
      const p = game.anyLivingPlayer();
      if (p && !p.moving) { S.vars.still = (S.vars.still || 0) + 1 / 60; if (S.vars.still > 1.2) { S.set('ch1.extraStep'); game.fx('extraStep', { x: p.x, z: p.z + 2 }); game.fx('caption', { text: '[One footstep behind you]', dir: 'behind', env: true }); } } else S.vars.still = 0;
    }
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    if (room.id === '1.01' && first && S.has('ch1.entered')) {
      game.after(2.5, 'scene:firstOperator');
      S.setRadio('Remain where you are. Restore local power.');
    }
    if (room.id === '1.03' && !S.has('ch1.r1seen')) {
      S.set('ch1.r1seen');
      if (S.objective.id === 'refuge1' || S.objective.id === 'explore') S.setObjective('refuge1', 'Watch the clock in the side room until you are sure it is working.');
      game.fx('tutorial', { id: 'clock', text: 'Refuges have a working wall clock. Watch the second hand for three seconds to verify the room.' });
    }
    if (room.id === '1.04' && first) { S.play('operatorObjective1'); S.setRadio('Restore the breaker panel. The hall will open.'); }
    if (room.id === '1.05' && first) {
      const L = game.enemyById('Ldemo');
      if (L && L.state === 'dormant') L.setState('patrol');
      game.fx('tutorial', { id: 'decoy', text: 'Wind the practice decoy. Watch what the sound attracts.' });
    }
    if (room.id === '1.07' && first) {
      S.addClue('obs.P1labels', 'Breaker labels: circuit 1 △ triangle, circuit 2 □ square, circuit 3 ○ circle.', 'observed');
      if (!S.has('P1.done')) S.setObjective('breaker', S.has('clue.P1') ? 'Restore the circuit order in the breaker room.' : 'Find out the order the breaker circuits run in.');
    }
    if (room.id === '1.11' && first && !S.has('T1')) {
      S.play('p2Mic');
      S.setRadio('Speak your full name into the microphone.');
      S.setObjective('relay', 'Restore relay T1.');
    }
  },

  onTimer(game, key, data) {
    const S = game.story;
    if (key === 'hallEmerge') {
      const p = game.players.get(data.pid) || game.anyLivingPlayer();
      const L = game.spawn('listener', { id: 'L1', x: 2.6, z: 60.1, yaw: -Math.PI / 2, encounter: 'hall', anchors: [{ x: 6, z: 58.5 }, { x: 15, z: 58.5 }], withdrawTo: { x: 2.6, z: 60.2 }, despawnOnWithdraw: true });
      L.onWithdrawn = () => { S.set('ch1.firstChaseDone'); };
      L.target = p.id; L.lastKnown = { x: p.x, z: p.z, t: game.time }; L.lastSeenT = game.time;
      L.setState('pursue');
      game.fx('creatureEmerge', { id: 'L1', x: 2.6, z: 60.1 });
      S.play('listenerHall');
      S.setObjective('hall', 'Get through the listening hall to the refuge at the far end.');
    }
  },

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.kind === 'gateWheel' && phase === 'begin') {
      if (!S.has('ch1.opening')) { S.set('ch1.opening'); S.play('opening'); }
      S.set('ch1.gate');
      S.set('ch1.entered');
      game.fx('sfx', { name: 'gateWheel', x: it.x, z: it.z });
      game.fx('transform', { room: 'A.00' });
      game.after(3.5, 'scene:arrival');
      S.setObjective('explore', 'Find a light and a way forward.');
      game.requestCheckpoint('arrival');
      return { ok: true };
    }
    if (it.kind === 'drawer' && phase === 'begin') {
      S.set('drawer1.open'); S.set(`used.${it.id}`);
      game.emitSound({ x: it.x, z: it.z, r: 4, kind: 'drawer', player: p.id });
      game.fx('sfx', { name: 'drawerSqueak', x: it.x, z: it.z });
      return { ok: true };
    }
    if (it.kind === 'practiceDecoy' && phase === 'begin') {
      if (game.decoys.some((d) => d.id === 'practice' && d.until > game.time)) return { ok: false, msg: 'Still ringing.' };
      game.decoys.push({ id: 'practice', x: it.x, z: it.z, until: game.time + 6, acc: 1, practice: true });
      game.fx('decoy', { pid: p.id, x: it.x, z: it.z, dur: 6, id: 'practice', practice: true });
      S.set('ch1.decoySeen');
      return { ok: true };
    }
    if (it.kind === 'lift' && phase === 'begin') {
      if (!S.has('T1')) return { ok: false, msg: 'No call power.' };
      game.beginTransition('lift', 2, { scene: 'liftRide1', dur: 9 });
      return { ok: true };
    }
    return null;
  },

  onPickup(game, p, it) {
    const S = game.story;
    if (it.tool === 'flashlight') { S.setObjective('refuge1', 'Check the room off the reception.'); game.fx('tutorial', { id: 'flashlight', text: 'Flashlight: [F] toggles it. Charge drains slowly while it is on.' }); }
    if (it.tool === 'camera') {
      S.play('cameraFound');
      S.setObjective('photo', 'Try the camera on the empty chair.');
      game.fx('tutorial', { id: 'camera', text: 'Camera: [2] to equip, [RMB] to raise the viewfinder, [LMB] to take a photo. Hidden layers appear only in a developed image.' });
    }
  },

  onPhoto(game, p, photo) {
    const S = game.story;
    if (photo.targets.includes('h1chair') && !S.has('ch1.firstReveal')) {
      S.set('ch1.firstReveal');
      game.after(4.2, 'scene:firstReveal');
      game.after(6, 'objBreaker');
    }
    if (photo.targets.includes('h1cables') && !S.has('P1.done')) S.setObjective('breaker', 'Restore the circuit order in the breaker room.');
  },

  onVerified(game, p, room) {
    if (room.id === '1.03') game.story.play('clockLesson');
  },

  onPuzzle(game, pz) {
    const S = game.story;
    if (pz.id === 'P1') {
      game.setDoor('hall', true);
      S.play('p1Done');
      S.setRadio('Proceed through the listening hall.');
      S.setObjective('hall', 'Get through the listening hall.');
      const L = game.enemyById('Ldemo');
      if (L) game.removeEnemy('Ldemo');
      game.makeCheckpoint('before the listening hall');
    }
    if (pz.id === 'P2') {
      S.set('T1');
      game.fx('network', { segment: 'T1' });
      S.play('t1Done');
      S.setRadio('The service lift is yours.');
      S.setObjective('lift', 'Take the service lift down.');
    }
  },

  onRefugeSecured(game, room) {
    const S = game.story;
    if (room.id === '1.10' && S.has('ch1.hallStarted') && !S.has('ch1.hallDone')) {
      S.set('ch1.hallDone');
      const L = game.enemyById('L1');
      if (L) L.forceWithdraw();
      S.setObjective('relay', 'Restore relay T1.');
    }
  },
};

// timer for the objective after the first reveal
const _onTimer = script.onTimer;
script.onTimer = function (game, key, data) {
  if (key === 'objBreaker') {
    if (!game.story.has('P1.done') && game.story.objective.id === 'photo') game.story.setObjective('breaker', 'Find a way to restore power.');
    return;
  }
  return _onTimer(game, key, data);
};

export default {
  id: 1,
  title: 'The Yellow Silence',
  kit: 'office',
  palette: 'yellow',
  fog: { color: 0x8a7a3a, density: 0.035 },
  ambient: 'office',
  music: 'wrongCorridor',
  start: { x: 0, z: -18.5, yaw: Math.PI },
  replayKit: { flashlight: true, camera: true },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints,
  wallDoors: [{ room: 'A.00', side: 'S', pos: 0, hideFlag: 'ch1.entered', label: 'Annex exterior door' }],
  director: { ambient: ['tubeBuzz', 'distantDoor', 'paperJam', 'wallTap'], roamer: { type: 'listener', rooms: ['1.04', '1.05', '1.08', '1.09'], after: 'ch1.hallDone' } },
  secret: { id: 'S1', text: 'The reception directory, taken from its marked floor seam.' },
  script,
};
