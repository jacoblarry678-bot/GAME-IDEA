/**
 * Chapter five: Service Below. Freight machinery, pressure doors and a
 * shaft big enough to hold an office tower. The Caretaker turns noise into
 * a timing problem: machines run for six seconds and rest for six, and a
 * running machine covers footsteps nearby. Evan finally sees Lena, alive,
 * through the reference chamber glass. Target 60-75 min.
 */
import { defineMachine, startMachine, stopMachine, machine } from '../../sim/machines.js';

const rail = (x0, z0, x1, z1, extra = {}) => (z0 === z1
  ? { k: 'railing', x: (x0 + x1) / 2, z: z0, s: [Math.abs(x1 - x0), 0.08, 1.05], ...extra }
  : { k: 'railing', x: x0, z: (z0 + z1) / 2, rot: 90, s: [Math.abs(z1 - z0), 0.08, 1.05], ...extra });

// shaft catwalk geometry: a 2.4 m grated walkway along x = 3 with three stop platforms
const STRIP = [1.8, 4.2];
const STOPS = [
  { id: 'turbine', z0: 101, z1: 106, label: 'Turbine housing' },
  { id: 'press', z0: 113, z1: 118, label: 'Stamping press screen' },
  { id: 'compressor', z0: 127, z1: 132, label: 'Pressure-door alcove' },
];
const LANDING = { z0: 137, z1: 140 };
const crawlAt = (s) => ({ x0: 7, z0: (s.z0 + s.z1) / 2 - 1, x1: 9.5, z1: (s.z0 + s.z1) / 2 + 1 });

function catwalkFloors() {
  const f = [];
  const segs = [[98, STOPS[0].z0], [STOPS[0].z1, STOPS[1].z0], [STOPS[1].z1, STOPS[2].z0], [STOPS[2].z1, LANDING.z0]];
  for (const [a, b] of segs) f.push([STRIP[0], a, STRIP[1], b, 0, true]);
  for (const s of [...STOPS, LANDING]) f.push([-1, s.z0, 7, s.z1, 0, true]);
  for (const s of STOPS) { const c = crawlAt(s); f.push([c.x0, c.z0, c.x1, c.z1, 0, true]); }
  return f;
}

function catwalkRails() {
  const r = [];
  const segs = [[98.2, STOPS[0].z0], [STOPS[0].z1, STOPS[1].z0], [STOPS[1].z1, STOPS[2].z0], [STOPS[2].z1, LANDING.z0]];
  for (const [a, b] of segs) { r.push(rail(STRIP[0], a, STRIP[0], b), rail(STRIP[1], a, STRIP[1], b)); }
  for (const s of STOPS) {
    const c = crawlAt(s);
    r.push(rail(-1, s.z0, STRIP[0], s.z0), rail(STRIP[1], s.z0, 7, s.z0), rail(-1, s.z1, STRIP[0], s.z1), rail(STRIP[1], s.z1, 7, s.z1));
    r.push(rail(-1, s.z0, -1, s.z1), rail(7, s.z0, 7, c.z0), rail(7, c.z1, 7, s.z1));
  }
  r.push(rail(-1, LANDING.z0, STRIP[0], LANDING.z0), rail(STRIP[1], LANDING.z0, 7, LANDING.z0), rail(-1, LANDING.z0, -1, 139.8), rail(7, LANDING.z0, 7, 139.8));
  return r;
}

function crawlBlocks() {
  const b = [];
  for (const s of STOPS) {
    const c = crawlAt(s);
    b.push({ x0: c.x0, x1: c.x1 + 0.2, z0: c.z0 - 0.2, z1: c.z0, y0: -0.5, y1: 3, sight: true });
    b.push({ x0: c.x0, x1: c.x1 + 0.2, z0: c.z1, z1: c.z1 + 0.2, y0: -0.5, y1: 3, sight: true });
    b.push({ x0: c.x1, x1: c.x1 + 0.2, z0: c.z0, z1: c.z1, y0: -0.5, y1: 3, sight: true });
    b.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 1.65, y1: 2.2, sight: true }); // low hood: crouch to enter
  }
  return b;
}

const rooms = [
  { id: '5.01', name: 'Utility lift exit', x0: 0, z0: 0, w: 6, d: 8, h: 5, surface: 'concrete' },
  { id: '5.02', name: 'Tool bay', x0: -3, z0: 8, w: 12, d: 14, h: 6, surface: 'concrete' },
  { id: '5.03', name: 'Refuge R1', x0: -9, z0: 12, w: 6, d: 5, h: 3, surface: 'concrete', refuge: 'R1' },
  {
    id: '5.04', name: 'Counterweight platform', x0: -6, z0: 22, w: 16, d: 20, h: 12, surface: 'metal', noFloor: true, light: 'dim',
    floors: [[-6, 22, 10, 29, 0], [-6, 35, 10, 42, 0], [-6, 29, 10, 35, -6], [0, 29, 3, 35, 0, true, { after: 'P9.done' }]],
    lights: [[-2, 25, 6], [6, 25, 6], [-2, 39, 6], [6, 39, 6], [1.5, 32, -4]],
  },
  { id: '5.05', name: 'Press corridor', x0: -2, z0: 42, w: 8, d: 30, h: 8, surface: 'concrete', light: 'dim', lights: [[2, 45, 6], [2, 52, 6], [2, 59, 6], [2, 66, 6]] },
  { id: '5.06', name: 'Survey cage', x0: -3, z0: 72, w: 5, d: 8, h: 5, surface: 'metal' },
  { id: '5.07', name: 'Medical telemetry booth', x0: 2, z0: 72, w: 8, d: 8, h: 4, surface: 'tile', wall: 'plaster' },
  { id: '5.08', name: 'Refuge R2', x0: 0, z0: 80, w: 6, d: 6, h: 3, surface: 'concrete', refuge: 'R2' },
  { id: '5.R', name: 'Reference chamber', x0: -8, z0: 80, w: 8, d: 6, h: 3.2, surface: 'tile', wall: 'plaster', unreachable: true, noCreatures: true, noSpawn: true, light: 'dim', lights: [[-4, 83, 3.0]] },
  { id: '5.09', name: 'Pressure lock', x0: -2, z0: 86, w: 10, d: 12, h: 6, surface: 'metal' },
  {
    id: '5.10', name: 'Shaft catwalk', x0: -6, z0: 98, w: 18, d: 42, h: 14, surface: 'grate', noFloor: true, light: 'dim',
    floors: catwalkFloors(), lights: [[3, 103.5, 4], [3, 115.5, 4], [3, 129.5, 4], [3, 138.5, 4]],
  },
  { id: '5.11', name: 'Relay T5', x0: -3, z0: 140, w: 12, d: 14, h: 8, kit: 'relay', surface: 'concrete' },
  { id: '5.12', name: 'Return freight landing', x0: 9, z0: 140, w: 10, d: 16, h: 8, kit: 'lift', surface: 'metal' },
];

const doors = [
  { id: 'd502', a: '5.01', b: '5.02', type: 'door', pos: 3 },
  { id: 'r1', a: '5.02', b: '5.03', type: 'refuge' },
  { id: 'd504', a: '5.02', b: '5.04', type: 'door', pos: 1.5, label: 'Platform hall' },
  { id: 'd505', a: '5.04', b: '5.05', type: 'door', pos: 1.5, label: 'Press corridor' },
  { id: 'd506', a: '5.05', b: '5.06', type: 'door', pos: 0.8, label: 'Survey cage' },
  { id: 'd507', a: '5.05', b: '5.07', type: 'door', pos: 4.5, label: 'Telemetry' },
  { id: 'r2a', a: '5.06', b: '5.08', type: 'refuge', pos: 1.0 },
  { id: 'r2b', a: '5.07', b: '5.08', type: 'refuge', pos: 4.5 },
  { id: 'pane', a: '5.08', b: '5.R', type: 'arch', pos: 83, w: 2.0, noPlate: true },
  { id: 'r2c', a: '5.08', b: '5.09', type: 'refuge', pos: 3 },
  { id: 'lock', a: '5.09', b: '5.10', type: 'gate', pos: 3, w: 2.0, lock: 'ch5.wheel', lockText: 'The pressure lock is sealed. Isolate it from the control panel, then turn the wheel.', label: 'Pressure lock' },
  { id: 'routeWin', a: '5.09', b: '5.10', type: 'arch', pos: -0.6, w: 1.6, noPlate: true },
  { id: 'iso', a: '5.10', b: '5.11', type: 'gate', pos: 3, w: 2.0, lockAfter: 'ch5.isolated', label: 'Isolation door' },
  { id: 'freight', a: '5.11', b: '5.12', type: 'gate', pos: 147, w: 2.2, lock: 'T5', lockText: 'The freight loop needs relay T5.', label: 'Freight loop' },
];

const props = [
  // 5.01 lift exit: the rhythm lesson machine
  { k: 'machine', x: 4.6, z: 5.6, rot: 270, id: 'm501', dynamic: true },
  { k: 'drum', x: 0.8, z: 6.8 }, { k: 'drum', x: 1.6, z: 7.2 },
  { k: 'sign', x: 0.25, z: 4, y: 1.8, rot: 90, text: 'MACHINE COVER|MOVE WHILE IT RUNS' },
  // 5.02 tool bay: workbenches, the mesh, the steady machine behind it
  { k: 'workbench', x: -1.6, z: 10.6, rot: 90 }, { k: 'workbench', x: -1.6, z: 19.4, rot: 90 },
  { k: 'shelf', x: -1.5, z: 21.55 }, { k: 'drum', x: 3.6, z: 20.8 }, { k: 'crate', x: 3.0, z: 12.2 },
  { k: 'mesh', x: 5.0, z: 11.6, rot: 90, s: [6.8, 0.06, 3.2] }, { k: 'mesh', x: 5.0, z: 18.4, rot: 90, s: [6.8, 0.06, 3.2] },
  { k: 'machine', x: 7.6, z: 11.0, rot: 270, id: 'm502', dynamic: true },
  { k: 'hatch', x: 7.6, z: 20.6 },
  { k: 'pipeRun', x: 7, z: 21.4, y: 3.6, s: [3.6, 0.3, 0.3] },
  // 5.03 R1
  { k: 'crate', x: -4.0, z: 16.3 },
  // 5.04 counterweight platform: landings, pit, the platform, four counterweights
  rail(-5.8, 28.96, 0, 28.96), rail(3, 28.96, 9.8, 28.96), rail(0, 28.96, 3, 28.96, { until: 'P9.done', id: 'gapS' }),
  rail(-5.8, 35.04, 0, 35.04), rail(3, 35.04, 9.8, 35.04), rail(0, 35.04, 3, 35.04, { until: 'P9.done', id: 'gapN' }),
  rail(-0.04, 29, -0.04, 35, { after: 'P9.done', id: 'bridgeW' }), rail(3.04, 29, 3.04, 35, { after: 'P9.done', id: 'bridgeE' }),
  { k: 'slab', x: 2, z: 28.85, y: -6, s: [16, 0.3, 6] }, { k: 'slab', x: 2, z: 35.15, y: -6, s: [16, 0.3, 6] },
  { k: 'slab', x: -5.85, z: 32, y: -6, s: [0.3, 6, 6] }, { k: 'slab', x: 9.85, z: 32, y: -6, s: [0.3, 6, 6] },
  { k: 'platform', x: 1.5, z: 32, y: -5.2, id: 'platLow', dynamic: true, hideIf: 'P9.done', s: [3, 6, 0.3] },
  { k: 'platform', x: 1.5, z: 32, y: -0.3, id: 'platUp', dynamic: true, showIf: 'P9.done', s: [3, 6, 0.3] },
  ...[[15, 23.6], [25, 24.9], [40, 26.2], [65, 27.5]].map(([w, z]) => ({ k: 'counterweight', x: -5.3, z, rot: 90, label: String(w), id: `cw${w}`, dynamic: true })),
  { k: 'console', x: 6.5, z: 27.9 },
  { k: 'table', x: 8.8, z: 24 },
  { k: 'sign', x: 9.75, z: 26, y: 2.2, rot: 270, text: 'FIXED PAYLOAD 110|BALANCED LOAD 200' },
  // 5.05 press corridor: service lane railing (two gaps), three presses on the east wall
  rail(-0.2, 42.2, -0.2, 47), rail(-0.2, 48.4, -0.2, 66), rail(-0.2, 67.4, -0.2, 71.8),
  { k: 'press', x: 4.6, z: 48, rot: 90, id: 'press1', dynamic: true }, { k: 'press', x: 4.6, z: 57, rot: 90, id: 'press2', dynamic: true }, { k: 'press', x: 4.6, z: 66, rot: 90, id: 'press3', dynamic: true },
  { k: 'hatch', x: -1.0, z: 71.0 },
  { k: 'cableTray', x: -1.0, z: 57, y: 5.5, s: [0.5, 28, 0.3] },
  // 5.06 survey cage
  { k: 'mesh', x: -2.8, z: 76, rot: 90, s: [7.6, 0.06, 2.6], solid: false },
  { k: 'table', x: -1.6, z: 73.2, s: [1.2, 0.7, 0.75] },
  // 5.07 telemetry booth
  { k: 'console', x: 6.5, z: 79.4, rot: 180, s: [2.2, 0.8, 1.1] },
  { k: 'desk', x: 3.4, z: 78.8 }, { k: 'chair', x: 3.4, z: 78.0 },
  { k: 'cabinet', x: 9.4, z: 79.3 },
  // 5.08 R2: the observation pane into the reference chamber
  { k: 'glass', x: 0, z: 83, rot: 90, s: [2.0, 0.06, 2.2] },
  // reference chamber (unreachable): Lena's chair, the support console, the emergency display, the TEST LIGHT lamp
  { k: 'chair', x: -3.2, z: 83, rot: 90 },
  { k: 'console', x: -7.4, z: 83, rot: 90, s: [2.4, 0.8, 1.2] },
  { k: 'sign', x: -4, z: 85.75, y: 2.0, rot: 180, text: 'LIFE SUPPORT|ROUTED THROUGH TRANSFER NETWORK|DO NOT ISOLATE', emissive: true },
  { k: 'testLamp', x: -1.2, z: 81.0, y: 2.4, id: 'testLamp', dynamic: true },
  { k: 'cableTray', x: -4, z: 83, y: 2.9, s: [0.5, 5.6, 0.2] },
  // 5.09 pressure lock: control console, overhead piping, the hatch it comes from, the route window
  { k: 'console', x: -1.4, z: 92, rot: 90 },
  { k: 'pipeRun', x: 3, z: 97.4, y: 4.0, s: [9.6, 0.5, 0.5] }, { k: 'pipeRun', x: 3, z: 96.8, y: 4.6, s: [9.6, 0.35, 0.35] },
  { k: 'glass', x: -0.6, z: 98, s: [1.6, 0.06, 2.2] },
  { k: 'hatch', x: -1.0, z: 87.2 },
  { k: 'wheelValve', x: 5.0, z: 97.75, y: 1.3, rot: 180 },
  { k: 'drum', x: 7.2, z: 87 }, { k: 'drum', x: 7.2, z: 87.9 },
  // 5.10 shaft catwalk
  ...catwalkRails(),
  { k: 'turbine', x: 0.6, z: 103.5, id: 'turbine', dynamic: true },
  { k: 'press', x: 0.4, z: 115.5, rot: 90, id: 'pressS', dynamic: true },
  { k: 'machine', x: 0.5, z: 129.5, rot: 90, id: 'compressor', dynamic: true },
  { k: 'doorFrame', x: 3, z: 133, s: [2.6, 0.3, 2.6] },
  ...STOPS.map((s) => { const c = crawlAt(s); return { k: 'duct', x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, s: [c.x1 - c.x0, c.z1 - c.z0, 1.65] }; }),
  { k: 'shaftCable', x: -4, z: 120, s: [0.3, 0.3, 14] }, { k: 'shaftCable', x: 10, z: 108, s: [0.3, 0.3, 14] },
  // the shaft keeps going down: walls below the catwalk and red beacons marking the depth
  { k: 'slab', x: -5.85, z: 119, y: -24, s: [0.3, 42, 24] }, { k: 'slab', x: 11.85, z: 119, y: -24, s: [0.3, 42, 24] },
  { k: 'slab', x: 3, z: 98.15, y: -24, s: [18, 0.3, 24] }, { k: 'slab', x: 3, z: 139.85, y: -24, s: [18, 0.3, 24] },
  ...[[-5.65, 108, -3, 90], [-5.65, 126, -9, 90], [11.65, 116, -5, 270], [11.65, 134, -14, 270], [-5.65, 104, 6, 90], [11.65, 124, 8, 270], [3, 139.65, -20, 180], [-5.65, 118, -18, 90]].map(([x, z, y, rot]) => ({ k: 'beacon', x, z, y, rot })),
  // 5.11 T5
  { k: 'relay', x: 3, z: 153.4 }, { k: 'console', x: -2.2, z: 147, rot: 90 },
  // 5.12 freight landing
  { k: 'liftPanel', x: 18.75, z: 148, y: 1.2, solid: false, rot: 270 },
  { k: 'crate', x: 11, z: 154.6 }, { k: 'crate', x: 12.1, z: 154.6 },
];

const hidden = [
  { id: 'h5order', x: 3, y: 4.35, z: 97.75, face: 'S', w: 6, h: 1.4, art: 'text:MAINTENANCE ORDER|A  ISOLATE POWER   ·   C  CLAMP BRAKE   ·   B  VENT|THEN UNLOCK WHEEL', clue: 'clue.P10', quest: true, text: 'A faded maintenance order on the overhead piping: A isolate power, C clamp brake, B vent, then the unlock wheel.', clueText: 'Pressure lock maintenance order: A isolates power, C clamps the brake, B vents pressure, then turn the wheel. Order: A, C, B, wheel.' },
  { id: 'h5ceiling', x: 3, y: 13.9, z: 121, face: 'down', w: 3, h: 5, art: 'ceilingCaretaker', secret: 'S5', from: { x: 3, z: 116, r: 10 }, text: 'On the shaft ceiling, another Caretaker walks upside down, tools hanging toward the floor.' },
];

const stations = [
  { id: 'S5', panel: { x: -0.4, y: 1.1, z: 79.6, face: 'S' }, cam: { x: 3, y: 1.7, z: 89, yaw: Math.PI, pitch: 0.42 }, alcove: [-2.6, 76.6, 1.8, 79.8], puzzle: 'P10', target: 'h5order' },
];

const puzzles = [
  {
    id: 'P9', type: 'weights', title: 'Service platform balance', panel: { x: 6.5, y: 1.15, z: 27.5, face: 'S' },
    payload: 110, target: 200, weights: [15, 25, 40, 65],
    instructions: 'The platform carries a fixed equipment payload of 110. Four counterweights ride on their own rails: 15, 25, 40 and 65. The display reads 110 + selected weights = 200. The personnel walkway is excluded from the measurement.',
    doneText: 'The brake releases. The platform rises level with the landings and locks into place as a bridge.',
  },
  {
    id: 'P10', type: 'sequence', title: 'Pressure lock controls', panel: { x: -0.95, y: 1.2, z: 92, face: 'E' },
    instructions: 'Three unlabeled controls, A, B and C. The unlock wheel is beside the lock door. The live panel reports each completed step.',
    buttons: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }],
    solution: ['A', 'C', 'B'], onWrong: 'keep', kind: 'lever', stepSound: 'leverClunk',
    wrongText: 'A quiet fault click. The lock stays closed. Completed steps hold.', wrongSound: 'fault', repeatText: 'Already set.',
    display: (pz) => {
      const st = { A: 'POWER ISOLATED', C: 'BRAKE SET', B: 'PRESSURE ZERO' };
      if (pz.done) return 'POWER ISOLATED · BRAKE SET · PRESSURE ZERO · WHEEL FREE';
      return pz.state.seq.map((s) => st[s]).join(' · ') || 'LOCK LIVE · PRESSURIZED';
    },
    doneText: 'POWER ISOLATED · BRAKE SET · PRESSURE ZERO. The unlock wheel turns freely now. Turning it will vent the lock.',
  },
  {
    id: 'E4', type: 'telemetry', title: 'Medical telemetry', panel: { x: 6.5, y: 1.2, z: 78.95, face: 'S' },
    instructions: 'Two channels: REFERENCE PLAYBACK and DIRECT SENSOR. A training strip taped to the housing shows the playback pattern repeating every four beats. A marked TEST LIGHT button flashes a lamp in the reference chamber. The machine labels its own comparison.',
    doneText: 'The printer feeds out a pulse trace. Response marker at the TEST LIGHT. SOURCE LOCAL. Proof E4: a living pulse.',
  },
];

const records = [
  { id: '25', title: 'Tool inventory', x: -1.6, y: 0.98, z: 10.2 },
  { id: '26', title: 'Machine cover', x: -4.0, y: 0.78, z: 16.3 },
  { id: '27', title: 'Platform placard', x: 8.8, y: 0.78, z: 24 },
  { id: '28', title: 'Rook recording four', audio: true, x: -1.8, y: 0.78, z: 73.2 },
  { id: '29', title: 'Local sensor', x: 3.6, y: 0.78, z: 78.8 },
  { id: '30', title: 'Rook recording five', audio: true, x: -2.0, y: 1.15, z: 147.4 },
];

const pickups = [
  { id: 'c5bat', item: 'battery', perPlayer: 1, route: 'critical', x: -1.6, y: 0.98, z: 19.0 },
  { id: 'c5film', item: 'film', perTwo: 1, route: 'critical', x: 8.6, y: 0.78, z: 24.3 },
  { id: 'c5aid', item: 'firstaid', qty: 1, route: 'critical', x: 7.2, y: 1.05, z: 87.0 },
  { id: 'o5aid1', item: 'firstaid', qty: 1, route: 'optional', x: 9.4, y: 1.4, z: 79.3 },
  { id: 'o5aid2', item: 'firstaid', qty: 1, route: 'optional', x: 7.8, y: 0.05, z: 152.6 },
  { id: 'o5bat1', item: 'battery', qty: 1, route: 'optional', x: -1.5, y: 1.2, z: 21.5 },
  { id: 'o5bat2', item: 'battery', qty: 1, route: 'optional', x: 11, y: 0.78, z: 154.6 },
  { id: 'o5film1', item: 'film', qty: 1, route: 'optional', x: -1.2, y: 0.78, z: 73.0 },
  { id: 'o5film2', item: 'film', qty: 1, route: 'optional', x: 2.4, y: 0.78, z: 12.2 },
  { id: 'o5decoy1', item: 'decoy', qty: 1, route: 'optional', x: 3.6, y: 1.0, z: 20.8 },
  { id: 'o5decoy2', item: 'decoy', qty: 1, route: 'optional', x: 7.2, y: 1.05, z: 87.9 },
  { id: 'o5wedge1', item: 'wedge', qty: 1, route: 'optional', x: 5.2, y: 0.05, z: 43.2 },
  { id: 'o5wedge2', item: 'wedge', qty: 1, route: 'optional', x: 12.1, y: 0.78, z: 154.6 },
];

const interactables = [
  { id: 'wheel', kind: 'wheel', name: 'Unlock wheel', verb: 'Turn', x: 5.0, y: 1.3, z: 97.55, hold: 2.5, requires: 'P10.done', hideAfter: 'ch5.wheel', face: 'S' },
  { id: 'paneNote', kind: 'note', title: 'Through the glass', x: 0.6, y: 1.5, z: 84.4, text: 'The emergency display beside the chair reads: LIFE SUPPORT · ROUTED THROUGH TRANSFER NETWORK · DO NOT ISOLATE. The occupant\'s sleeve has a sunflower sticker on it.' },
  { id: 't5switch', kind: 'switch', name: 'Relay T5 completion switch', verb: 'Engage', x: 3, y: 1.3, z: 152.75, face: 'S' },
  { id: 'freight5', kind: 'lift', name: 'Freight loop controls', verb: 'Ride to the core', x: 18.3, y: 1.3, z: 148, requires: 'T5' },
];

const hints = {
  toolbay: ['The tool bay continues north to the platform hall. Refuge R1 is through the door on the west wall.'],
  platform: ['Read the placard by the platform and the display on the console: 110 + selected weights = 200.', 'You need 90 more from two of the four counterweights: 15, 25, 40, 65.', 'Put 25 and 65 on the platform, then release the brake.'],
  press: ['Move only while the presses run: they cover your footsteps. Stand still while they rest.', 'The Caretaker walks the service lane behind the railing. Keep away from the gaps.'],
  lock: ['The order for the lock controls is written on the overhead piping in the pressure lock. Photograph it, or use the Survey Station in the survey cage.', 'A isolates power, C clamps the brake, B vents pressure.', 'Press A, then C, then B. Then turn the wheel.'],
  wheel: ['Turning the wheel vents the lock loudly. Look at the route through the window first: three stops, each with a machine and a crawlway.'],
  catwalk: ['Each stop\'s machine starts when you reach it. Move during its six seconds of noise; wait behind cover while it rests.', 'If it hears you, crouch into the crawlway at the stop. It cannot follow.'],
  relayT5: ['The T5 completion switch is on the relay at the north wall.'],
  freight: ['The freight loop is east of relay T5.'],
};
const navHints = { toolbay: 'd504', platform: 'd505', press: 'd506', lock: 'lock', wheel: 'lock', catwalk: 'iso', relayT5: 'iso', freight: 'freight' };

// ------------------------------------------------------------------ script
// each stop's machine covers its platform and the walk to the next stop (overlapping, so the next machine can arm)
const TURBINE_MASK = [-1.2, 98, 7.2, 116];
const PRESS_MASK = [-1.2, 113, 7.2, 130];
const COMP_MASK = [-1.2, 127, 7.2, 140.2];

function setupMachines(game) {
  defineMachine(game, 'm501', { x: 4.6, z: 5.6, run: 6, rest: 6, mask: 6, label: 'Utility machine' });
  defineMachine(game, 'm502', { x: 7.6, z: 11, always: true, mask: 4, label: 'Tool bay machine' });
  // the three presses run together; while they run the whole walkway rings with them
  for (const [i, z] of [[1, 48], [2, 57], [3, 66]]) defineMachine(game, `press${i}`, { x: 4.6, z, run: 6, rest: 6, mask: 6.5, zone: [-0.15, 42, 6, 72.4], label: 'Press' });
  defineMachine(game, 'turbine', { x: 0.6, z: 103.5, zone: TURBINE_MASK, mask: 6, armAt: { x: 3, z: 103.5, r: 1.5 }, label: 'Turbine' });
  defineMachine(game, 'pressS', { x: 0.4, z: 115.5, zone: PRESS_MASK, mask: 6, armAt: { x: 3, z: 115.5, r: 1.5 }, label: 'Stamping press' });
  defineMachine(game, 'compressor', { x: 0.5, z: 129.5, zone: COMP_MASK, mask: 6, armAt: { x: 3, z: 129.5, r: 1.5 }, label: 'Compressor' });
}

function spawnLaneCaretaker(game) {
  if (game.enemyById('Clane')) return;
  const C = game.spawn('caretaker', { id: 'Clane', x: -1.0, z: 70.4, anchors: [{ x: -1.0, z: 70.4 }, { x: -1.0, z: 43.6 }], withdrawTo: { x: -1.0, z: 71.0 }, encounter: 'lane', despawnOnWithdraw: true });
  C.setState('patrol');
}

export const script = {
  init(game, entry) {
    const S = game.story;
    if (entry === 'return') { S.setObjective('return5', 'Record the pulse at the telemetry booth if you have not, then take the freight lift back.'); return; }
    setupMachines(game);
    if (!game.npcs.some((n) => n.id === 'lena')) game.npcs.push({ id: 'lena', name: 'Lena Ortiz', model: 'lena', x: -3.2, z: 83, yaw: -Math.PI / 2, seated: true, speed: 0, path: null });
    if (entry === 'start') {
      S.setObjective('toolbay', 'Find a way through the lower plant.');
      S.setRadio('Relay five is at the top of the freight shaft. Proceed.');
      game.after(3, 'scene:serviceArrival');
      game.after(5, 'machineLesson');
    }
    if (S.has('ch5.lanePatrol') && !S.has('ch5.laneDone')) spawnLaneCaretaker(game);
  },

  update(game, dt) {
    if (game.returnTrip) return;
    const S = game.story;
    // presentation state: counterweights ride their rails, running machines shudder
    const ps = game.propState = game.propState || {};
    const P9 = game.puzzles.get('P9');
    if (P9) for (const w of [15, 25, 40, 65]) ps[`cw${w}`] = { y: P9.done || P9.state.on.includes(w) ? 0.15 : 1.7 };
    for (const m of Object.values(S.vars.machines || {})) {
      const pr = game.level.propById.get(m.id);
      if (pr) ps[m.id] = { y: m.enabled && m.running ? Math.abs(Math.sin(game.time * 31)) * 0.02 : 0 };
    }
    // the revelation: a player in R2 looking at the glass (or lingering there)
    if (!S.has('ch5.lenaSeen')) {
      for (const p of game.players.values()) {
        if (!p.alive || p.room !== '5.08') continue;
        const e = p.eye(), f = p.forward();
        const dx = -3.2 - e.x, dz = 83 - e.z, d = Math.hypot(dx, dz);
        const facing = (dx * f.x + dz * f.z) / d > Math.cos(35 * Math.PI / 180);
        S.vars.r2Time = (S.vars.r2Time || 0) + dt;
        if (facing || S.vars.r2Time > 8) { revelation(game, p); break; }
      }
    }
    // isolation: every living player past the door
    if (S.has('ch5.wheel') && !S.has('ch5.isolated')) {
      const living = [...game.players.values()].filter((p) => p.alive);
      if (living.length && living.every((p) => p.room === '5.11' || p.room === '5.12')) {
        S.set('ch5.isolated');
        for (const id of ['Ccat']) { const c = game.enemyById(id); if (c) game.removeEnemy(id); }
        for (const id of ['turbine', 'pressS', 'compressor']) stopMachine(game, id);
        game.fx('caption', { text: '[The isolation door slams shut behind you and the locking bars drop]', env: true });
        game.fx('sfx', { name: 'pressHit', x: 3, z: 140 });
        S.setObjective('relayT5', 'Restore relay T5.');
        game.requestCheckpoint('isolation door');
      }
    }
    // the lane Caretaker leaves once nobody is in the corridor
    if (S.has('ch5.lanePatrol') && !S.has('ch5.laneDone')) {
      const any = [...game.players.values()].some((p) => p.alive && (p.room === '5.05' || p.room === '5.04'));
      if (!any) { S.set('ch5.laneDone'); const c = game.enemyById('Clane'); if (c) c.forceWithdraw(); }
    }
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    if (game.returnTrip) return;
    if (room.id === '5.02' && first && !S.has('ch5.demo')) {
      S.set('ch5.demo');
      const C = game.spawn('caretaker', { id: 'Cdemo', x: 7.6, z: 20.2, anchors: [{ x: 7.6, z: 20.2 }, { x: 7.4, z: 13.6 }], withdrawTo: { x: 7.6, z: 20.6 }, region: [6.2, 8.4, 8.7, 21.7], encounter: 'demo', despawnOnWithdraw: true });
      C.setState('patrol');
      game.fx('caption', { text: '[Behind the mesh, a hatch lifts. Something tall climbs out, tapping the pipes]', env: true });
      game.after(7, 'toolDrop');
      game.after(34, 'demoGone');
    }
    if (room.id === '5.04' && first) S.setObjective('platform', 'Balance the service platform.');
    if (room.id === '5.05' && !S.has('ch5.lanePatrol')) {
      S.set('ch5.lanePatrol');
      spawnLaneCaretaker(game);
      S.setObjective('press', 'Cross the press corridor while the presses run.');
      game.fx('tutorial', { id: 'pressCover', text: 'A running press covers your footsteps within about six metres. Move while they run; stand still while they rest.' });
    }
    if (room.id === '5.08' && first) S.setObjective('lock', 'Open the pressure lock.');
    if (room.id === '5.09' && first) {
      const c = game.enemyById('Clane'); if (c) { S.set('ch5.laneDone'); c.forceWithdraw(); }
    }
  },

  onTimer(game, key) {
    const S = game.story;
    if (key === 'machineLesson') game.fx('tutorial', { id: 'machines', text: 'Machines down here run and rest in a steady rhythm. While one runs, it covers footsteps around it.' });
    if (key === 'toolDrop') {
      game.emitSound({ x: 7.2, z: 16.2, r: 10, kind: 'bang', source: 'toolDrop' });
      game.fx('sfx', { name: 'scrape', x: 7.2, z: 16.2 });
      game.fx('caption', { text: '[A spanner falls from the shelf behind the mesh]', env: true });
      S.play('caretakerDemo');
      game.fx('tutorial', { id: 'caretaker', text: 'It is blind. It ignores a machine that keeps running, but anything that changes, a step, a door, a dropped tool, it hears.' });
    }
    if (key === 'demoGone') { const c = game.enemyById('Cdemo'); if (c) c.forceWithdraw(); }
    if (key === 'operatorArgues') S.play('operatorArgues');
    if (key === 'catwalkStart') {
      const p = game.players.get(S.vars.wheelBy) || game.anyLivingPlayer();
      const C = game.spawn('caretaker', {
        id: 'Ccat', x: -1.0, z: 87.4, encounter: 'catwalk', despawnOnWithdraw: true, withdrawTo: { x: -1.0, z: 87.4 },
        anchors: [{ x: 3, z: 99.4 }, { x: 3, z: 103.5 }, { x: 3, z: 109.5 }, { x: 3, z: 115.5 }, { x: 3, z: 122 }, { x: 3, z: 129.5 }, { x: 3, z: 134 }, { x: 3, z: 138.6 }],
        negotiate: [{ id: 'housing', x: 3, z: 103.5, r: 1.4, t: 3, what: 'turbine housing' }, { id: 'pdoor', x: 3, z: 133, r: 1.4, t: 4, what: 'pressure door' }],
      });
      game.fx('caption', { text: '[The floor hatch bangs open. Tools rattle up out of the dark]', env: true });
      if (p) { C.beginWarn(p); C.lastKnown = { x: 5, z: 96.4, t: game.time }; }
    }
  },

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.id === 'wheel' && phase === 'complete') {
      if (S.has('ch5.wheel')) return { ok: true };
      S.vars.wheelBy = p.id;
      S.set('ch5.wheel');
      game.fx('sfx', { name: 'ventBlast', x: 3, z: 97 });
      game.emitSound({ x: 3, z: 97, r: 30, kind: 'vent', source: 'vent' });
      defineMachine(game, 'vent', { x: 3, z: 97, zone: [-2, 86, 8, 106], always: true, label: 'Lock vent' });
      startMachine(game, 'vent', { always: true, until: 10 });
      game.fx('caption', { text: '[The lock vents with a roar. Somewhere below, something answers on the pipes]', env: true });
      S.setObjective('catwalk', 'Cross the shaft. Move while the machines run.');
      game.after(1.5, 'catwalkStart');
      return { ok: true };
    }
    if (it.id === 't5switch' && phase === 'begin') {
      if (S.has('T5')) return { ok: true };
      S.set('T5');
      game.fx('network', { segment: 'T5' });
      game.fx('sfx', { name: 'relayClick', x: it.x, z: it.z });
      S.play('rookFinal', { force: true });
      S.addClue('rescue.plan', 'Rook: isolate life support, cut identity transmission, open the maintenance gate. In that order. The rescue needs all four proofs: E1 Lena\'s badge, E2 the maintenance key, E3 the private memory, E4 a living pulse.', 'observed');
      S.set('journal.evidenceSlots');
      S.setObjective('freight', 'Take the freight loop to the core.');
      game.requestCheckpoint('relay T5');
      return { ok: true };
    }
    if (it.id === 'freight5' && phase === 'begin') {
      if (!S.has('T5')) return { ok: false, msg: 'No power.' };
      game.beginTransition('lift', 6, { dur: 7 });
      return { ok: true };
    }
    if (it.id === 'returnLift' && phase === 'begin') { game.beginTransition('lift', 6, { entry: 'return', returnTo: 'nexus', dur: 4 }); return { ok: true }; }
    return null;
  },

  describe(game, p, it) {
    if (it.id === 'wheel') return { name: 'Unlock wheel', verb: game.story.has('P10.done') ? 'Turn (loud)' : 'Locked by the control panel', hold: 2.5 };
    return null;
  },

  onPuzzle(game, pz, p) {
    const S = game.story;
    if (pz.id === 'P9') {
      game.fx('sfx', { name: 'machine', x: 1.5, z: 32 });
      S.setObjective('press', 'Cross the bridge into the press corridor.');
      game.requestCheckpoint('platform bridge');
    }
    if (pz.id === 'P10') {
      S.setObjective('wheel', 'Turn the unlock wheel. It will be loud.');
      game.fx('tutorial', { id: 'lockWindow', text: 'Look through the window first: the catwalk has three stops, each with a machine and a crawlway.' });
      game.makeCheckpoint('pressure lock');
    }
    if (pz.id === 'E4') {
      game.collectEvidence('E4', p);
      S.addClue('E4.trace', 'Pulse trace (E4): a response marker at the TEST LIGHT. SOURCE LOCAL. Not the archive pattern.', 'observed');
    }
  },

  onRecord(game, p, id) { if (id === '30') game.story.set('ch5.rook5'); },

  /** The catwalk Caretaker listens from the stop behind the slowest living player, never ahead of them. */
  routeLimit(game) {
    let minZ = Infinity;
    for (const p of game.players.values()) if (p.alive) minZ = Math.min(minZ, p.z);
    let reached = 0;
    for (const [z, ix] of [[103.5, 1], [115.5, 3], [129.5, 5], [138.6, 7]]) if (minZ >= z - 1.5) reached = ix;
    return Math.max(0, reached - 2);
  },
};

function revelation(game, p) {
  const S = game.story;
  S.set('ch5.lenaSeen');
  S.set('LENA_ALIVE');
  game.fx('caption', { text: '[Through the glass: a woman in a chair, a sunflower sticker on her sleeve. Her chest rises and falls]', env: true });
  S.play('lenaSeen', { force: true });
  game.after(14, 'operatorArgues');
  S.addClue('lena.alive', 'Lena is alive in the reference chamber. The emergency display says her life support is routed through the transfer network.', 'observed');
  S.setObjective('lock', 'Open the pressure lock.');
}

function returnTrip(def) {
  const keep = new Set(['5.07']);
  const inRoom = (o) => def.rooms.some((r) => keep.has(r.id) && o.x >= r.x0 && o.x <= r.x0 + r.w && o.z >= r.z0 && o.z <= r.z0 + r.d);
  return {
    ...def,
    rooms: [...def.rooms.filter((r) => keep.has(r.id)), { id: 'R.05', name: 'Freight return landing', x0: 10, z0: 74, w: 4, d: 4, h: 3, surface: 'metal', kit: 'lift' }],
    doors: [{ id: 'ret', a: 'R.05', b: '5.07', type: 'arch', w: 2 }],
    props: def.props.filter(inRoom), pickups: [], records: def.records.filter((r) => r.id === '29'), hidden: [], stations: [],
    puzzles: def.puzzles.filter((p) => p.id === 'E4'),
    interactables: [{ id: 'returnLift', kind: 'lift', name: 'Freight return lift', verb: 'Return to the freight nexus', x: 13.55, y: 1.2, z: 76 }],
    wallDoors: [], director: null,
    start: { x: 12, z: 76, yaw: Math.PI / 2 },
  };
}

export default {
  id: 5,
  title: 'Service Below',
  kit: 'industrial',
  fog: { color: 0x14100c, density: 0.032 },
  hemi: 0.34,
  ambient: 'industrial',
  music: 'lowerPlant',
  start: { x: 3, z: 1.6, yaw: Math.PI },
  replayKit: { flashlight: true, camera: true, pouch: [['battery', 1], ['firstaid', 1], ['decoy', 1]] },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints,
  crawl: STOPS.map(crawlAt),
  blocks: crawlBlocks(),
  wallDoors: [{ room: '5.07', side: 'E', pos: 0, label: 'Freight return lift (out of service)' }, { room: '5.01', side: 'S', pos: 0, label: 'Utility elevator' }],
  director: { ambient: ['pipeKnock', 'distantDoor', 'toolClick'] },
  script,
  returnTrip,
};
