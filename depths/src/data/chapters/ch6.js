/**
 * Chapter six: The Unseen Depth. The core assembles fragments of the five
 * earlier locations around a broadcasting chamber. Familiar spaces sit
 * beside the wrong neighbours, but their rules still hold: the fragments are
 * short mastery checks, each creature forced to withdraw before the next
 * begins. The Unseen enters after two indirect previews. P11 rebuilds the
 * return circuit, R2 states the ending requirements, and P12 chooses what
 * the network is for. Three committed routes lead to three thresholds.
 * Target 65-80 min, excluding optional return trips to the evidence landings.
 */
import { defineCycle, closeCycle, openCycle } from '../../sim/shutters.js';
import { defineMachine } from '../../sim/machines.js';
import { cubicleCluster } from './util.js';
import { missingEvidence, evidenceLine, PURPOSES } from '../../sim/puzzles/core.js';

const H = 0.3; // raised dry decks in the pool fragment

const rooms = [
  { id: '6.01', name: 'Freight nexus', x0: 0, z0: 0, w: 16, d: 18, h: 8, kit: 'industrial', surface: 'metal' },
  { id: '6.02', name: 'Refuge R1', x0: 4, z0: 18, w: 8, d: 8, h: 4, kit: 'relay', surface: 'concrete', refuge: 'R1' },
  { id: '6.03', name: 'Office fragment', x0: 1, z0: 26, w: 14, d: 20, h: 3, kit: 'office', surface: 'carpet', light: 'dim', flicker: true },
  { id: '6.04', name: 'Display fragment', x0: 1, z0: 46, w: 14, d: 18, h: 5, kit: 'mall', surface: 'terrazzo' },
  { id: '6.05', name: 'Pool fragment', x0: 0, z0: 64, w: 16, d: 20, h: 8, kit: 'pool', surface: 'pooltile', light: 'dim',
    floors: [[0.2, 64.2, 15.8, 67, H], [0.2, 81, 15.8, 83.8, H], [7, 67, 9, 72.5, H], [7, 75.5, 9, 81, H], [13, 67, 15.8, 81, H, true]],
    lights: [[4, 70, 6], [12, 70, 6], [4, 78, 6], [12, 78, 6]] },
  { id: '6.06', name: 'Observation gallery', x0: 5, z0: 84, w: 6, d: 24, h: 6, kit: 'relay', surface: 'concrete', light: 'dim', lights: [[8, 88, 5.6], [8, 96, 5.6], [8, 104, 5.6]] },
  { id: '6.07', name: 'Switching room', x0: 2, z0: 108, w: 12, d: 14, h: 6, kit: 'relay', surface: 'concrete' },
  { id: '6.08', name: 'Refuge R2', x0: 4, z0: 122, w: 8, d: 8, h: 4, kit: 'relay', surface: 'concrete', refuge: 'R2' },
  { id: '6.09', name: 'Anchor chamber', x0: -1, z0: 130, w: 18, d: 20, h: 10, kit: 'relay', surface: 'concrete', lights: [[8, 141, 8], [2, 134, 6], [14, 134, 6], [2, 147, 6], [14, 147, 6]] },
  { id: '6.10', name: 'Broadcast control', x0: 0, z0: 150, w: 16, d: 18, h: 8, kit: 'relay', surface: 'concrete', lights: [[4, 154, 7.9], [12, 154, 7.9], [4, 163, 7.9], [12, 163, 7.9], [8, 158.5, 4]] },
  // full transmission: the return gate hall and the garage
  { id: '6.11F', name: 'Return gate hall', x0: 2, z0: 168, w: 12, d: 40, h: 10, kit: 'relay', surface: 'concrete', lights: [[9.5, 172, 6], [9.5, 182, 6], [9.5, 192, 6], [9.5, 202, 6], [3.6, 188, 3]] },
  { id: '6.12F', name: 'Parking garage', x0: 2, z0: 208, w: 12, d: 18, h: 5, kit: 'annex', surface: 'concrete', wall: 'concrete', lights: [[8, 222.4, 4.9], [5, 212, 4.9], [11, 212, 4.9]] },
  // maintenance bypass: three service lanes with Lena's protected lane alongside, then the hatch
  { id: '6.11R1', name: 'Service lane A', x0: 16, z0: 152, w: 13, d: 12, h: 5, kit: 'industrial', surface: 'concrete' },
  { id: '6.11R2', name: 'Service lane B', x0: 29, z0: 152, w: 13, d: 12, h: 5, kit: 'industrial', surface: 'concrete' },
  { id: '6.11R3', name: 'Service lane C', x0: 42, z0: 152, w: 13, d: 12, h: 5, kit: 'industrial', surface: 'concrete' },
  { id: '6.12R', name: 'Maintenance hatch', x0: 55, z0: 150, w: 12, d: 18, h: 6, kit: 'industrial', surface: 'concrete', light: 'bright' },
  // emergency isolation: three evacuation bays, two lit dead ends, the utility shaft
  { id: '6.11X1', name: 'Evacuation bay 1', x0: -13, z0: 152, w: 13, d: 12, h: 6, kit: 'industrial', surface: 'metal' },
  { id: '6.11X2', name: 'Evacuation bay 2', x0: -27, z0: 152, w: 14, d: 12, h: 6, kit: 'industrial', surface: 'metal' },
  { id: '6.11X3', name: 'Evacuation bay 3', x0: -40, z0: 152, w: 13, d: 12, h: 6, kit: 'industrial', surface: 'metal' },
  { id: '6.11D1', name: 'Lit service room', x0: -9, z0: 146, w: 5, d: 6, h: 3, kit: 'industrial', surface: 'metal', light: 'bright' },
  { id: '6.11D2', name: 'Lit delivery room', x0: -23, z0: 164, w: 6, d: 6, h: 3, kit: 'industrial', surface: 'metal', light: 'bright' },
  { id: '6.12X', name: 'Utility shaft', x0: -52, z0: 150, w: 12, d: 18, h: 10, kit: 'industrial', surface: 'concrete', light: 'dim' },
];

const doors = [
  { id: 'r1a', a: '6.01', b: '6.02', type: 'refuge', pos: 8 },
  { id: 'r1b', a: '6.02', b: '6.03', type: 'refuge', pos: 8 },
  { id: 'd604', a: '6.03', b: '6.04', type: 'door', pos: 8, label: 'Display fragment' },
  { id: 'frag', a: '6.04', b: '6.05', type: 'gate', pos: 8, w: 2.0, lock: 'frag.open', lockText: 'The exit gate is tied to the display shutters. Close the shutters to open it.', label: 'Shutter gate' },
  { id: 'd606', a: '6.05', b: '6.06', type: 'door', pos: 8, label: 'Observation gallery' },
  { id: 'd607', a: '6.06', b: '6.07', type: 'door', pos: 8, label: 'Switching room' },
  { id: 'r2a', a: '6.07', b: '6.08', type: 'refuge', pos: 8, lock: 'P11.done', lockText: 'The refuge door is wired to the return circuit.' },
  { id: 'r2b', a: '6.08', b: '6.09', type: 'refuge', pos: 8 },
  { id: 'd610', a: '6.09', b: '6.10', type: 'door', pos: 8, label: 'Broadcast control' },
  { id: 'famDoor', a: '6.10', b: '6.11F', type: 'gate', pos: 8, w: 2.4, lock: 'fam.open', lockAfter: 'fam.crossed', lockText: 'The main return door. Only the Operator opens it.', label: 'Main return door' },
  { id: 'famExit', a: '6.11F', b: '6.12F', type: 'arch', pos: 8, w: 3 },
  { id: 'resDoor', a: '6.10', b: '6.11R1', type: 'gate', pos: 159, w: 2.0, lock: 'res.free', lockText: 'The service lane opens when the anchor is released.', label: 'Service lane' },
  { id: 'laneIn', a: '6.10', b: '6.11R1', type: 'arch', pos: 153.3, w: 1.6, noPlate: true },
  { id: 'bar1', a: '6.11R1', b: '6.11R2', type: 'pressure', pos: 159.5, lock: 'res.lever1', lockText: 'Barrier locked. Pull the release lever.', label: 'Barrier 1' },
  { id: 'laneA', a: '6.11R1', b: '6.11R2', type: 'arch', pos: 153.3, w: 1.6, noPlate: true },
  { id: 'bar2', a: '6.11R2', b: '6.11R3', type: 'pressure', pos: 159.5, lock: 'res.lever2', lockAfter: 'res.lever3', lockText: 'Barrier locked. Pull the release lever.', label: 'Barrier 2' },
  { id: 'laneB', a: '6.11R2', b: '6.11R3', type: 'arch', pos: 153.3, w: 1.6, noPlate: true },
  { id: 'resIso', a: '6.11R3', b: '6.12R', type: 'gate', pos: 159, w: 2.0, lock: 'res.lever3', lockText: 'The isolation door opens with the third release lever.', label: 'Isolation door' },
  { id: 'laneOut', a: '6.11R3', b: '6.12R', type: 'arch', pos: 153.3, w: 1.6, noPlate: true },
  { id: 'cutDoor', a: '6.10', b: '6.11X1', type: 'gate', pos: 159, w: 2.0, lock: 'cut.purge', lockText: 'Evacuation route sealed until PURGE.', label: 'Evacuation route' },
  { id: 'cg1', a: '6.11X1', b: '6.11X2', type: 'gate', pos: 158, w: 2.0, lock: 'cut.w1', lockText: 'Turn the handwheel beside the gate.', label: 'Evacuation gate 1' },
  { id: 'dead1', a: '6.11X1', b: '6.11D1', type: 'arch', pos: -6.5, w: 2 },
  { id: 'cg2', a: '6.11X2', b: '6.11X3', type: 'gate', pos: 158, w: 2.0, lock: 'cut.w2', lockText: 'Turn the handwheel beside the gate.', label: 'Evacuation gate 2' },
  { id: 'dead2', a: '6.11X2', b: '6.11D2', type: 'arch', pos: -20, w: 2 },
  { id: 'cg3', a: '6.11X3', b: '6.12X', type: 'gate', pos: 158, w: 2.0, lock: 'cut.w3', lockText: 'Turn the handwheel beside the gate.', label: 'Evacuation hatch' },
];

const glassRun = (x0, x1, z) => ({ k: 'glass', x: (x0 + x1) / 2, z, s: [x1 - x0, 0.06, 2.6] });

const props = [
  // 6.01 freight nexus
  { k: 'console', x: 1.0, z: 9, rot: 90 }, { k: 'crate', x: 13, z: 3.5 }, { k: 'crate', x: 14.1, z: 4.6 }, { k: 'drum', x: 1.2, z: 15.8 }, { k: 'drum', x: 2.0, z: 16.4 },
  { k: 'sign', x: 0.25, z: 13, y: 2.6, rot: 90, text: 'RETURN LOADS|HAVE PRIORITY' },
  { k: 'cableTray', x: 8, z: 9, y: 7.4, s: [0.5, 17, 0.3] },
  // 6.02 R1
  { k: 'table', x: 5.2, z: 24.8 }, { k: 'chair', x: 10.6, z: 19.0, rot: 180 },
  // 6.03 office fragment: three clusters on the west half, open aisle east
  ...cubicleCluster(5.5, 30, { tint: 'green' }), ...cubicleCluster(5.5, 36, { tint: 'green' }), ...cubicleCluster(5.5, 42, { tint: 'green' }),
  { k: 'copier', x: 14.2, z: 33, rot: 270 }, { k: 'cabinet', x: 14.4, z: 38.5, rot: 270 }, { k: 'desk', x: 12.6, z: 41.5, rot: 90 }, { k: 'chair', x: 11.8, z: 41.5, rot: 90, id: 'dentChair' },
  // 6.04 display fragment: storefronts, the display plinth, the shutter lever
  { k: 'storefront', x: 1.3, z: 50, rot: 90, name: 'NEW SEASON' }, { k: 'storefront', x: 14.7, z: 50, rot: 270, name: 'GIFTS' }, { k: 'storefront', x: 1.3, z: 58, rot: 90, name: 'TOYS' }, { k: 'storefront', x: 14.7, z: 58, rot: 270, name: 'PHOTO' },
  ...[[1.45, 50, 90], [14.55, 50, 270], [1.45, 58, 90], [14.55, 58, 270]].map(([x, z, rot]) => ({ k: 'shutterPanel', x, z, rot, s: [4, 0.08, 2.8], dynamic: true, showIf: 'cyc.frag' })),
  { k: 'display', x: 8, z: 53.0, s: [1.6, 0.8, 0.3] },
  { k: 'bench', x: 4, z: 61 }, { k: 'plant', x: 2.2, z: 62.8 }, { k: 'plant', x: 13.8, z: 62.8 }, { k: 'kiosk', x: 3.5, z: 54.5 },
  { k: 'lever', x: 11, z: 61.3, y: 1.2, rot: 180 }, { k: 'post', x: 11, z: 61.45, s: [0.18, 0.18, 1.05] },
  // 6.05 pool fragment
  ...[2.5, 5, 10.5].map((x) => ({ k: 'lane', x, z: 74, rot: 90, s: [13, 0.12, 0.3] })),
  { k: 'lifeguardChair', x: 1.2, z: 82.6 }, { k: 'pipeRun', x: 14.4, z: 74, y: 6.5, rot: 90, s: [14, 0.3, 0.3] },
  // 6.06 observation gallery: three cover niches on the west side, glass on the east
  ...[90, 96, 102].map((z) => ({ k: 'partitionTall', x: 6.6, z, rot: 90, s: [2, 0.08, 2.0] })),
  ...[88, 94, 100, 106].map((z) => ({ k: 'glass', x: 10.75, z, rot: 90, s: [5.6, 0.06, 2.6] })),
  // 6.07 switching room
  { k: 'patchBoard', x: 13.72, z: 115, y: 0.6, rot: 270 },
  { k: 'table', x: 4, z: 120 }, { k: 'relay', x: 3.0, z: 116, rot: 90 },
  // 6.09 anchor chamber
  { k: 'anchorRig', x: 8, z: 141 }, { k: 'sign', x: 8, z: 130.25, y: 6, rot: 0, text: 'REFERENCE ANCHOR|LIVE', emissive: true }, { k: 'chair', x: 8, z: 141.2, rot: 180, id: 'anchorChair' },
  { k: 'table', x: 13, z: 134 }, { k: 'console', x: 2.0, z: 141, rot: 90 },
  // 6.10 broadcast control: the console, commit lever, voice gates, bypass station, emergency panel
  { k: 'console', x: 8, z: 158.6, s: [5, 1.0, 1.1] },
  { k: 'lever', x: 11.6, z: 158.2, y: 1.1, rot: 0 }, { k: 'post', x: 11.6, z: 158.35, s: [0.18, 0.18, 1.0] },
  ...[[4, 'A'], [5.6, 'B'], [11.2, 'C']].map(([x, l]) => ({ k: 'voiceGate', x, z: 167.7, y: 0, rot: 180, label: l })),
  { k: 'console', x: 15.2, z: 155.5, rot: 270, s: [2, 0.8, 1.1] },
  { k: 'console', x: 0.8, z: 155.5, rot: 90, s: [2, 0.8, 1.1] },
  { k: 'sign', x: 15.75, z: 157.1, y: 2.3, rot: 270, text: 'MAINTENANCE|BYPASS' }, { k: 'sign', x: 0.25, z: 157.1, y: 2.3, rot: 90, text: 'EMERGENCY|ISOLATION' },
  { k: 'speaker', x: 4, z: 151, y: 6, rot: 0 }, { k: 'speaker', x: 12, z: 151, y: 6, rot: 0 },
  // familiar hall: the observation glass the Unseen walks behind
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ k: 'glass', x: 5.2, z: 170.2 + i * 4, rot: 90, s: [4, 0.06, 2.6] })),
  { k: 'glass', x: 5.2, z: 168.6, rot: 90, s: [0.8, 0.06, 2.6] }, { k: 'block', x: 5.2, z: 207.6, s: [0.06, 0.4, 2.6] },
  // garage
  { k: 'car', x: 4.6, z: 213 }, { k: 'car', x: 11.4, z: 216, rot: 180 }, { k: 'pillar', x: 3.4, z: 219 }, { k: 'pillar', x: 12.6, z: 210.5 },
  ...['E', 'V', 'A', 'N'].map((ch, i) => ({ k: 'sign', x: 4.5 + i * 2.3, z: 225.75, y: 3.2, rot: 180, text: `EXIT|${ch}`, emissive: true })),
  // rescue lanes: Lena's protected lane behind glass, cover turns, release levers
  glassRun(16.2, 28.8, 154.5), glassRun(29.2, 41.8, 154.5), glassRun(42.2, 54.8, 154.5),
  { k: 'block', x: 16.5, z: 153.3, s: [0.6, 1.8, 3] },
  { k: 'partitionTall', x: 22.5, z: 157.3, rot: 90, s: [5.4, 0.08, 2.0] },
  { k: 'partitionTall', x: 35.5, z: 161.1, rot: 90, s: [5.4, 0.08, 2.0] },
  { k: 'partitionTall', x: 48.5, z: 157.3, rot: 90, s: [5.4, 0.08, 2.0] },
  { k: 'lever', x: 28.75, z: 162.5, y: 1.2, rot: 270 }, { k: 'lever', x: 41.75, z: 156, y: 1.2, rot: 270 }, { k: 'lever', x: 54.75, z: 162.5, y: 1.2, rot: 270 },
  { k: 'hatch', x: 63, z: 159 }, { k: 'ladder', x: 63, z: 167.6, rot: 180 },
  // evacuation bays: handwheels, evacuation arrows, the press, the lit dead ends
  { k: 'wheelValve', x: -12.75, z: 161.5, y: 1.2, rot: 90 }, { k: 'wheelValve', x: -26.75, z: 155, y: 1.2, rot: 90 }, { k: 'wheelValve', x: -39.75, z: 161.5, y: 1.2, rot: 90 },
  ...[-4, -19, -33].map((x) => ({ k: 'sign', x, z: 163.75, y: 2.4, rot: 180, text: '◄ EVACUATION', emissive: true })),
  { k: 'sign', x: -6.5, z: 151.8, y: 2.6, rot: 0, text: 'SAFE ROOM ▼' }, { k: 'sign', x: -20, z: 164.2, y: 2.6, rot: 180, text: 'DELIVERY ACCESS ▲' },
  { k: 'press', x: -23.5, z: 161.8, id: 'pressX', dynamic: true },
  { k: 'hatch', x: -14.6, z: 163 },
  { k: 'drum', x: -8, z: 150 }, { k: 'drum', x: -20, z: 168.5 },
  ...[[-2, 163.75, 180], [-11, 152.25, 0], [-16, 163.75, 180], [-25, 152.25, 0], [-30, 163.75, 180], [-38, 152.25, 0]].map(([x, z, rot]) => ({ k: 'beacon', x, z, y: 3.6, rot, id: `bcn${x}`, dynamic: true, showIf: 'cut.purge' })),
  ...[[2, 150.25, 0], [14, 150.25, 0], [0.25, 162, 90], [15.75, 162, 270]].map(([x, z, rot]) => ({ k: 'beacon', x, z, y: 6.2, rot })),
  { k: 'sign', x: 8, z: 167.75, y: 5.2, rot: 180, text: 'ON AIR', emissive: true },
  { k: 'ladder', x: -51.6, z: 159, rot: 90 },
];

const hidden = [
  { id: 'h6diagram', x: 13.78, y: 2.35, z: 115, face: 'W', w: 2.6, h: 0.8, art: 'text:SERVICE ROUTE|T1 → T3 → T2 → T5 → T4 → RETURN', clue: 'clue.P11', quest: true, text: 'Behind the patch board, a service route: T1, T3, T2, T5, T4, then RETURN.', clueText: 'Return circuit service route: live input → T1 → T3 → T2 → T5 → T4 → RETURN.' },
  { id: 'h6dry', x: 14.4, y: H + 0.02, z: 74, face: 'up', w: 1.2, h: 12, art: 'dryPrints', clue: 'clue.dry', text: 'A line of dry footprints along the east grating, all the way across.', clueText: 'Pool fragment: dry footprints run along the east grating. The grating does not disturb the water.' },
  { id: 'h6door', x: -0.78, y: 2.2, z: 140, face: 'E', w: 2.2, h: 3.4, art: 'exteriorDoorway', secret: 'S6', until: 'P12.committed', text: 'An exterior doorway seen from outside, at dawn. Nobody is standing in it.' },
];

const stations = [
  { id: 'S6', panel: { x: 2.5, y: 1.1, z: 110.4, face: 'E' }, cam: { x: 8.5, y: 1.8, z: 115, yaw: -Math.PI / 2, pitch: 0.12 }, alcove: [2.3, 108.4, 5.6, 112.2], puzzle: 'P11', target: 'h6diagram' },
];

const puzzles = [
  {
    id: 'NEXUS', type: 'nexus', title: 'Freight nexus lift', panel: { x: 1.45, y: 1.2, z: 9, face: 'E' },
    instructions: 'The freight lift reaches the cleared service landings while local power holds. Each landing keeps only what was left there: unread records and the proof you did not collect.',
    destinations: [
      { ch: 2, label: 'MALL · SERVICE LANDING', evidence: 'E1' },
      { ch: 3, label: 'POOL · ENGINEER BAY', evidence: 'E2' },
      { ch: 4, label: 'RESIDENTS · LAUNDRY', evidence: 'E3' },
      { ch: 5, label: 'LOWER PLANT · TELEMETRY', evidence: 'E4' },
    ],
  },
  {
    id: 'P11', type: 'patch', title: 'Return circuit patch board', panel: { x: 13.55, y: 1.3, z: 115, face: 'W' },
    sockets: ['T1', 'T2', 'T3', 'T4', 'T5'], solution: ['T1', 'T3', 'T2', 'T5', 'T4'],
    instructions: 'Five patch sockets, T1 to T5, and a RETURN socket. Starting from the live input, each cable snaps into the next socket. A diagram is mounted behind the board; to the eye it is blank.',
    doneText: 'Five labeled indicators light: T1, T2, T3, T4, T5. RETURN LIVE. The refuge door unlocks.',
  },
  {
    id: 'P12', type: 'purpose', title: 'Broadcast control · network purpose', panel: { x: 8, y: 1.25, z: 157.95, face: 'S' },
    instructions: 'Three procedures. Each names its consequence. The commit lever beside the console confirms the selected purpose with a three second hold. The host has final campaign control.',
  },
  {
    id: 'BYPASS', type: 'bypass', title: 'Maintenance bypass', panel: { x: 14.75, y: 1.2, z: 155.5, face: 'W' },
    labels: { key: 'INSERT E2 · MAINTENANCE KEY', badge: 'SCAN E1 · BADGE', pulse: 'COMPARE E4 · LOCAL DISPLAY', handset: 'LIFT ISOLATED HANDSET', life: 'LIFE SUPPORT · LOCAL', identity: 'IDENTITY TRANSFER · DISCONNECTED', release: 'RELEASE ANCHOR' },
    instructions: 'Rook\'s order: isolate life support, cut identity transmission, open the maintenance gate. The lock takes the key, the badge reader takes the badge, the display compares the pulse.',
    doneText: 'ANCHOR RELEASED. In the chamber, the cables fall away from Lena\'s chair.',
  },
  {
    id: 'PURGE', type: 'emergency', title: 'Emergency isolation', panel: { x: 1.25, y: 1.2, z: 155.5, face: 'E' },
    instructions: 'A guarded emergency panel. Three outgoing network switches and PURGE. The guard is stenciled: PURGE ENDS LIFE SUPPORT FOR THE REFERENCE OCCUPANT. The evacuation hatch opens mechanically, independent of any key.',
    doneText: 'PURGE. Alarms. EVACUATE: the hatch is ninety seconds west.',
  },
];

const records = [
  { id: '31', title: 'Return freight', x: 13, y: 0.78, z: 3.5 },
  { id: '32', title: 'June\'s second note', x: 5.2, y: 0.78, z: 24.8 },
  { id: '33', title: 'Copy report', x: 5.8, y: 0.05, z: 101.2 },
  { id: '34', title: 'Bypass warning', x: 4, y: 0.78, z: 120 },
  { id: '35', title: 'Lena\'s marks', x: 13, y: 0.78, z: 134 },
  { id: '36', title: 'Final dispatch', x: 6.2, y: 1.02, z: 158.3 },
];

const pickups = [
  { id: 'c6bat', item: 'battery', perPlayer: 1, route: 'critical', x: 5.8, y: 0.78, z: 24.5 },
  { id: 'c6tea', item: 'tea', perPlayer: 1, route: 'critical', x: 4.6, y: 0.78, z: 24.9 },
  { id: 'c6film', item: 'film', perTwo: 1, route: 'critical', x: 12.4, y: 0.78, z: 3.4 },
  { id: 'o6aid1', item: 'firstaid', qty: 1, route: 'optional', x: 13.6, y: 0.78, z: 3.6 },
  { id: 'o6aid2', item: 'firstaid', qty: 1, route: 'optional', x: 12.4, y: 0.78, z: 134 },
  { id: 'o6film1', item: 'film', qty: 1, route: 'optional', x: 4.6, y: 0.78, z: 120 },
  { id: 'o6film2', item: 'film', qty: 1, route: 'optional', x: 3.5, y: 1.0, z: 54.5 },
  { id: 'o6wedge1', item: 'wedge', qty: 1, route: 'optional', x: 2.0, y: 0.05, z: 165 },
  { id: 'o6wedge2', item: 'wedge', qty: 1, route: 'optional', x: 12.8, y: 0.05, z: 109.6 },
];

const interactables = [
  { id: 'fragLever', kind: 'lever', name: 'Display shutter lever', verb: 'Pull', x: 11, y: 1.2, z: 61.15, face: 'S' },
  { id: 'r2Lift', kind: 'lift', name: 'Service lift to the freight nexus', verb: 'Ride down', x: 11.5, y: 1.2, z: 123.0, hideAfter: 'P12.committed' },
  { id: 'planBoard', kind: 'note', title: 'Ending requirements', x: 4.6, y: 1.5, z: 122.6 },
  { id: 'lenaTalk', kind: 'npc', name: 'Lena Ortiz', verb: 'Talk', x: 8, y: 1.2, z: 139.4, reach: 2.4 },
  { id: 'commit', kind: 'commit', name: 'Commit lever', verb: 'Hold to commit', x: 11.6, y: 1.1, z: 157.95, hold: 3, face: 'S', hideAfter: 'P12.committed' },
  { id: 'vgA', kind: 'voiceGate', name: 'Voice gate A', verb: 'Activate', x: 4, y: 1.4, z: 167.45, hold: 2, requires: 'route.familiar', hideAfter: 'fam.A' },
  { id: 'vgB', kind: 'voiceGate', name: 'Voice gate B', verb: 'Activate', x: 5.6, y: 1.4, z: 167.45, hold: 2, requires: 'route.familiar', hideAfter: 'fam.B' },
  { id: 'vgC', kind: 'voiceGate', name: 'Voice gate C', verb: 'Activate', x: 11.2, y: 1.4, z: 167.45, hold: 2, requires: 'route.familiar', hideAfter: 'fam.C' },
  { id: 'lever1', kind: 'lever', name: 'Release lever 1', verb: 'Pull', x: 28.6, y: 1.2, z: 162.5, hold: 1.0, requires: 'res.free', hideAfter: 'res.lever1' },
  { id: 'lever2', kind: 'lever', name: 'Release lever 2', verb: 'Pull', x: 41.6, y: 1.2, z: 156, hold: 1.0, requires: 'res.lever1', hideAfter: 'res.lever2' },
  { id: 'lever3', kind: 'lever', name: 'Release lever 3', verb: 'Pull', x: 54.6, y: 1.2, z: 162.5, hold: 1.0, requires: 'res.lever2', hideAfter: 'res.lever3' },
  { id: 'hw1', kind: 'handwheel', name: 'Gate handwheel', verb: 'Turn', x: -12.6, y: 1.2, z: 161.5, hold: 3, requires: 'cut.purge', hideAfter: 'cut.w1' },
  { id: 'hw2', kind: 'handwheel', name: 'Gate handwheel', verb: 'Turn', x: -26.6, y: 1.2, z: 155, hold: 3, requires: 'cut.w1', hideAfter: 'cut.w2' },
  { id: 'hw3', kind: 'handwheel', name: 'Hatch handwheel', verb: 'Turn', x: -39.6, y: 1.2, z: 161.5, hold: 3, requires: 'cut.w2', hideAfter: 'cut.w3' },
];

const hints = {
  core: ['Refuge R1 is north of the freight nexus. The nexus lift returns to any landing whose proof you are missing.'],
  office: ['The office fragment keeps its old rule: the Listener hunts noise. Crouch along the open east aisle.'],
  display: ['The exit gate opens only while the display shutters are closed, and closing them wakes the figure.', 'Pull the lever, then keep the figure in view while you back out through the gate. A flash pins it for four seconds.'],
  pool: ['It follows disturbance in the water. Grating does not disturb the water.', 'Photograph the hall from the entrance, or take the grating along the east side all the way across.'],
  gallery: ['Three floor dents walking toward you: the Unseen. It sees movement within ten metres.', 'Crouch inside a niche beside the partition and do not move until it has gone.'],
  switching: ['The diagram behind the patch board only shows on film. The Survey Station in the corner photographs it for you.', 'Live input → T1 → T3 → T2 → T5 → T4, then RETURN.'],
  prepare: ['The board in R2 lists what each plan needs. The service lift in R2 returns to the freight nexus.'],
  choose: ['Select a purpose at the console, then hold the commit lever for three seconds.'],
  familiar: ['Activate the voice gates in order: A, B, C.', 'Walk the return hall to the end.'],
  door: ['At the bypass station: key, badge, pulse, handset, then the three switches in order.', 'Lena\'s answer: "Yellow. The handle was already missing."', 'Pull each release lever; close each barrier behind you.'],
  cut: ['Guard, three lines, PURGE. Then follow the evacuation arrows west, not the Operator.', 'Each gate has one handwheel nearby. Three seconds each.'],
};
const navHints = { core: 'r1a', office: 'd604', display: 'frag', pool: 'd606', gallery: 'd607', switching: 'r2a', prepare: 'r2b', choose: 'd610', familiar: 'famDoor', door: 'resDoor', cut: 'cutDoor' };

// ------------------------------------------------------------------ script
const LANE_Z = 153.3;

function ensureNpcs(game) {
  const S = game.story;
  if (S.has('JUNE_SAFE') && !game.npcs.some((n) => n.id === 'june')) game.npcs.push({ id: 'june', name: 'June Ellis', model: 'june', x: 10.6, z: 19.0, yaw: 0, seated: true, speed: 0, path: null });
  if (!game.npcs.some((n) => n.id === 'lena')) game.npcs.push({ id: 'lena', name: 'Lena Ortiz', model: 'lena', x: 8, z: 141.2, yaw: 0, seated: true, speed: 1.6, path: null });
  if (!game.npcs.some((n) => n.id === 'copy')) game.npcs.push({ id: 'copy', name: '', model: 'copy', x: 8, z: 222.5, yaw: 0, speed: 0, path: null, hidden: !S.has('ending.familiar') });
}

function spawnOnce(game, id, type, opts) { if (game.enemyById(id) || game.story.has(`gone.${id}`)) return null; return game.spawn(type, { id, ...opts }); }
function retire(game, id) { const c = game.enemyById(id); if (c && !c.gone) game.removeEnemy(id); game.story.set(`gone.${id}`); }

function planText(game) {
  const S = game.story;
  const miss = missingEvidence(game);
  const lines = [
    'Three procedures are available at the broadcast console.',
    `FULL TRANSMISSION · ${PURPOSES.familiar.consequence}`,
    `MAINTENANCE BYPASS · ${PURPOSES.door.consequence} ${miss.length ? 'Not yet possible.' : 'All four proofs held.'}`,
    `EMERGENCY ISOLATION · ${PURPOSES.cut.consequence}`,
    '',
    ...['E1', 'E2', 'E3', 'E4'].map((e) => evidenceLine(game, e)),
  ];
  if (miss.length && !S.has('P12.committed')) lines.push('', 'The service lift beside this board returns to the freight nexus; its freight lift reaches each landing.');
  return lines.join('\n');
}

export const script = {
  init(game, entry) {
    const S = game.story;
    ensureNpcs(game);
    defineCycle(game, 'frag', { x: 8, z: 54, label: 'Display shutters' });
    if (!game.enemyById('Cfrag') && !S.has('ch6.fragDone')) game.spawn('cutout', { id: 'Cfrag', x: 8, z: 54, yaw: Math.PI, anchor: { x: 8, z: 54, yaw: Math.PI }, group: 'frag', mode: 'hunt' });
    defineMachine(game, 'pressX', { x: -23.5, z: 161.8, always: true, mask: 8, label: 'Press', enabled: S.has('cut.purge') });
    // the Unseen never steps into Lena's protected lane
    game.creatureBlocks = [(i) => { const c = game.level.nav.center(i); return c.x > 16 && c.x < 67 && c.z < 154.6 && c.z > 150; }];
    if (entry === 'start') {
      S.setObjective('core', 'Find the way through the core.');
      S.setRadio('Come to the broadcast room. Everything you need is there.');
      game.after(3, 'scene:coreArrival');
      game.after(6, 'nexusTip');
    }
    if (entry === 'nexus') S.setObjective(S.has('P11.done') ? 'prepare' : 'core', S.has('P11.done') ? 'Recover the missing proof, then return to the final refuge.' : 'Find the way through the core.');
  },

  goSide(game, p, ch) {
    game.parkChapter();
    game.beginTransition('lift', ch, { entry: 'return', dur: 4 });
  },

  update(game, dt) {
    const S = game.story;
    const living = [...game.players.values()].filter((p) => p.alive);
    // the familiar route: the Unseen keeps pace behind the glass
    const U = game.enemyById('Uwatch');
    if (U && !U.gone && living.length) {
      const lead = living.reduce((a, b) => (b.z > a.z ? b : a));
      U.x = 3.6; U.z = Math.max(169, Math.min(207, lead.z));
      U.yaw = Math.atan2(-(lead.x - U.x), -(lead.z - U.z));
    }
    // Lena stays level with the slowest player in the service lanes and waits when they stop
    const L = game.npcs.find((n) => n.id === 'lena');
    if (L && L.lane) {
      const inLanes = living.filter((p) => p.x > 15.5);
      const lead = inLanes.length ? Math.min(...inLanes.map((p) => p.x)) + 0.8 : 17;
      const tx = Math.max(16.8, Math.min(S.has('res.lever3') ? 60 : 54.2, lead));
      const dx = tx - L.x;
      const step = Math.min(Math.abs(dx), 3.0 * dt);
      L.moving = step > 1e-3; if (L.moving) { L.x += Math.sign(dx) * step; L.yaw = dx > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    // the destruction countdown (paused with the game; removed by the timer assist)
    if (S.has('cut.purge') && !S.has('cut.out') && !game.over) {
      if (!game.assists.timer) {
        const before = Math.ceil(S.vars.purgeLeft);
        S.vars.purgeLeft -= dt;
        const now = Math.ceil(S.vars.purgeLeft);
        if (now !== before) game.fx('countdown', { left: now });
        if (S.vars.purgeLeft <= 0) {
          game.over = { kind: 'death', creature: 'The purge', hint: 'Follow the evacuation arrows, not the Operator. Each gate needs only its own handwheel.' };
          game.fx('death', { pid: game.hostId, creature: 'The purge', hint: game.over.hint });
        }
      } else if (!S.vars.alarmT || game.time > S.vars.alarmT) { S.vars.alarmT = game.time + 10; game.fx('sfx', { name: 'shutterWarn' }); }
    }
    // the first live Unseen: it walks the observation gallery and leaves
    if (!S.has('ch6.unseenLive') && living.some((p) => p.room === '6.06' && p.z > 87.5)) {
      S.set('ch6.unseenLive');
      const U = game.spawn('unseen', { id: 'Ugal', x: 8.5, z: 106.6, yaw: 0, anchors: [{ x: 8.5, z: 106.6 }, { x: 8.5, z: 86.6 }], anchorIx: 1, withdrawTo: { x: 8.5, z: 107.4 }, encounter: 'gallery', despawnOnWithdraw: true });
      U.anchorIx = 1;
      U.data.leaveAt = game.time + 26;
      game.fx('caption', { text: '[At the far end of the gallery, three dents press into the floor, one after another, walking toward you]', env: true });
      game.fx('sfx', { name: 'floorDent', x: 8.5, z: 105 });
      game.fx('tutorial', { id: 'unseen', text: 'The Unseen sees movement within ten metres. Crouch beside solid cover and keep still until it has gone.' });
    }
    // one Caretaker investigation in the middle evacuation bay, under the running press
    if (S.has('cut.purge') && !S.has('cut.caretaker') && living.some((p) => p.room === '6.11X2' && p.x < -17.5)) {
      S.set('cut.caretaker');
      const C = game.spawn('caretaker', { id: 'Cmid', x: -14.6, z: 163, anchors: [{ x: -15.5, z: 157 }], withdrawTo: { x: -14.6, z: 163 }, encounter: 'bay', despawnOnWithdraw: true });
      C.suspect = { x: -15.5, z: 157.5, t: game.time, strong: 1, player: null, kind: 'bang' };
      C.setState('investigate');
      game.fx('caption', { text: '[Behind you, a floor hatch lifts. Tools tap the pipes. The press keeps running]', env: true });
    }
    // presentation: running presses shudder
    const ps = game.propState = game.propState || {};
    const m = S.vars.machines && S.vars.machines.pressX;
    if (m) ps.pressX = { y: m.enabled && m.running ? Math.abs(Math.sin(game.time * 31)) * 0.02 : 0 };
  },

  onFlag(game, f, v) {
    const S = game.story;
    if (f === 'cyc.frag') S.set('frag.open', !!v || S.has('ch6.fragDone'));
    if (f === 'ending.familiar') { const c = game.npcs.find((n) => n.id === 'copy'); if (c) c.hidden = false; }
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    const id = room.id;
    if (id === '6.03' && first) {
      S.setObjective('office', 'Cross the office fragment.');
      spawnOnce(game, 'Lfrag', 'listener', { x: 2.2, z: 44, encounter: 'fragment', anchors: [{ x: 2.2, z: 44 }, { x: 2.2, z: 28.4 }], withdrawTo: { x: 2.2, z: 44.5 }, despawnOnWithdraw: true });
      if (!S.has('ch6.preview1')) game.after(5, 'preview1');
    }
    if (id === '6.04') {
      retire(game, 'Lfrag');
      if (first) { S.setObjective('display', 'Get through the display fragment.'); game.fx('tutorial', { id: 'fragRules', text: 'Each fragment keeps its old rules. What worked there works here.' }); }
    }
    if (id === '6.05' && !S.has('ch6.fragDone')) {
      S.set('ch6.fragDone');
      S.set('frag.open');
      openCycle(game, 'frag');
      retire(game, 'Cfrag');
      S.setObjective('pool', 'Cross the pool fragment without disturbing the water.');
      spawnOnce(game, 'Dfrag', 'drowned', { x: 4, z: 74, anchors: [{ x: 4, z: 69 }, { x: 4, z: 79 }, { x: 11, z: 79 }, { x: 11, z: 69 }], withdrawTo: { x: 4, z: 74 }, armed: true, state: 'patrol' });
      if (!S.has('ch6.preview2')) game.after(4, 'preview2');
    }
    if (id === '6.06') {
      retire(game, 'Dfrag');
      if (first) S.setObjective('gallery', 'Follow the observation gallery north.');
    }
    if (id === '6.07' && first) { S.setObjective('switching', 'Rebuild the return circuit.'); retire(game, 'Ugal'); }
    if (id === '6.08' && first) S.setObjective('prepare', 'Read the board. Decide what you can do.');
    if (id === '6.10' && first) {
      S.setObjective('choose', 'Choose the network\'s purpose.');
      game.requestCheckpoint('finale');
    }
    if (id === '6.11F' && S.has('route.familiar') && !game.enemyById('Uwatch') && !S.has('gone.Uwatch')) {
      game.spawn('unseen', { id: 'Uwatch', x: 3.6, z: 170, encounter: 'watch', state: 'scripted' });
      game.fx('caption', { text: '[Behind the glass, something keeps pace with you. It does not try the glass]', env: true });
    }
    if (id === '6.12F' && !S.has('fam.crossed')) {
      S.set('fam.crossed');
      game.setDoor('famDoor', false);
      S.play('obedientThreshold', { force: true });
      game.after(7, 'endFamiliar');
    }
    if (id === '6.12R' && !S.has('res.out')) { S.set('res.out'); game.after(2.5, 'endDoor'); }
    if (id === '6.12X' && !S.has('cut.out')) { S.set('cut.out'); game.fx('caption', { text: '[Behind you, the lower lights of the Annex shut off one floor at a time]', env: true }); game.after(2, 'endCut'); }
    if (id === '6.11X1' && first && S.has('cut.purge')) S.play('purgeReplay', { force: true });
    if (id === '6.11X2' && first && S.has('cut.purge')) {
      S.play('purgeReplay2', { force: true });
    }
  },

  onTimer(game, key) {
    const S = game.story;
    if (key === 'nexusTip') game.fx('tutorial', { id: 'nexus', text: 'The freight nexus lift returns to earlier landings. Use it to recover any proof you missed.' });
    if (key === 'preview1') {
      S.set('ch6.preview1');
      for (let i = 0; i < 6; i++) game.fx('footprint', { id: 'preview', x: 12.4 - (i % 2) * 0.35, z: 44.6 - i * 0.75, yaw: 0, delay: i * 0.45 });
      game.fx('caption', { text: '[A chair cushion dents as if someone just sat down. Nobody is there]', env: true });
    }
    if (key === 'preview2') {
      S.set('ch6.preview2');
      for (let i = 0; i < 8; i++) game.fx('footprint', { id: 'preview', wet: true, x: 3 + i * 0.8, z: 82.4 - (i % 2) * 0.3, yaw: -Math.PI / 2, delay: i * 0.4 });
      game.fx('caption', { text: '[A shadow crosses the far deck. There is no one to cast it]', env: true });
      S.play('unseenFirst');
    }
    if (key === 'endFamiliar') game.beginEnding('familiar');
    if (key === 'endDoor') game.beginEnding('door');
    if (key === 'endCut') game.beginEnding('cut');
  },

  onSound() {},

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.id === 'fragLever' && phase === 'begin') {
      closeCycle(game, 'frag', 12);
      game.fx('sfx', { name: 'leverClunk', x: it.x, z: it.z });
      return { ok: true, msg: 'The display shutters begin to close. The exit gate is tied to them.' };
    }
    if (it.id === 'r2Lift' && phase === 'begin') {
      if (S.has('P12.committed')) return { ok: false, msg: 'The service lift is locked out.' };
      game.parkChapter();
      game.beginTransition('lift', 6, { entry: 'nexus', dur: 3 });
      return { ok: true };
    }
    if (it.id === 'planBoard' && phase === 'begin') { game.fx('note', { pid: p.id, title: 'Ending requirements', text: planText(game) }); return { ok: true }; }
    if (it.id === 'lenaTalk' && phase === 'begin') {
      if (S.has('res.free')) return { ok: true };
      if (!S.has('ch6.lenaMet')) { S.set('ch6.lenaMet'); S.say('lena', 'local', 'Evan. You look older. That\'s the first thing in here that\'s made sense.'); S.say('evan', 'local', 'I\'m getting you out.'); S.say('lena', 'local', 'Then don\'t trust the nice voice. Trust the board.'); }
      else S.say('lena', 'local', missingEvidence(game).length ? 'Whatever you\'re missing, the freight lift can still reach it. I\'ll wait. I\'m good at it now.' : 'You have everything. Do it in Rook\'s order.');
      return { ok: true };
    }
    if (it.id === 'commit' && phase === 'complete') return commit(game, p);
    if (it.kind === 'voiceGate' && phase === 'complete') {
      const k = it.id.slice(2);
      const need = { A: null, B: 'fam.A', C: 'fam.B' }[k];
      if (need && !S.has(need)) { S.say('operator', 'speaker', `Gate ${k} waits for gate ${String.fromCharCode(k.charCodeAt(0) - 1)}.`); return { ok: false, msg: 'Out of order.' }; }
      S.set(`fam.${k}`);
      S.play(`voiceGate${k}`, { force: true });
      game.fx('sfx', { name: 'tone', x: it.x, z: it.z });
      if (k === 'C') { S.set('fam.open'); S.say('operator', 'speaker', 'Thank you. The return door is open. Walk straight out.'); S.setObjective('familiar', 'Walk out through the return hall.'); }
      return { ok: true };
    }
    if (it.id.startsWith('lever') && phase === 'complete') {
      const k = +it.id.slice(5);
      S.set(`res.lever${k}`);
      game.fx('sfx', { name: 'leverClunk', x: it.x, z: it.z });
      const H = game.enemyById('Uhunt');
      if (k < 3 && H && !H.gone) { H.target = p.id; H.lastKnown = { x: it.x, z: it.z, t: game.time }; H.lastSeenT = game.time; if (H.state !== 'pursue' && H.state !== 'warn') H.setState('pursue'); game.fx('caption', { text: '[The lever clanks. Behind you, the dents turn toward the sound]', env: true }); }
      if (k === 3) {
        game.setDoor('bar2', false, { fast: true });
        if (H) { H.forceWithdraw(); retire(game, 'Uhunt'); }
        game.fx('caption', { text: '[The barrier slams and locks behind you. The isolation door ahead rolls open]', env: true });
        S.setObjective('door', 'Get Lena out through the maintenance hatch.');
      }
      return { ok: true };
    }
    if (it.kind === 'handwheel' && phase === 'complete') {
      const k = +it.id.slice(2);
      S.set(`cut.w${k}`);
      game.emitSound({ x: it.x, z: it.z, r: 10, kind: 'wheel', player: p.id });
      game.fx('sfx', { name: 'gateWheel', x: it.x, z: it.z });
      return { ok: true };
    }
    return null;
  },

  describe(game, p, it) {
    const S = game.story;
    if (it.id === 'commit') { const sel = game.puzzles.get('P12')?.state.sel; return { name: 'Commit lever', verb: sel ? `Hold to commit: ${PURPOSES[sel].label}` : 'Select a purpose at the console first', hold: 3 }; }
    if (it.kind === 'voiceGate') return { name: it.name, verb: 'Activate (2 s)', hold: 2 };
    if (it.id === 'lenaTalk') return { name: 'Lena Ortiz', verb: S.has('ch6.lenaMet') ? 'Talk' : 'Speak to her', hold: 0 };
    return null;
  },

  onPuzzle(game, pz, p) {
    const S = game.story;
    if (pz.id === 'P11') { S.play('p11Done'); S.setObjective('prepare', 'Go through to Refuge R2.'); game.requestCheckpoint('return circuit'); }
    if (pz.id === 'BYPASS') {
      S.set('res.free');
      S.play('lenaFree', { force: true });
      const L = game.npcs.find((n) => n.id === 'lena');
      if (L) { L.seated = false; L.path = [{ x: 8, z: 145 }, { x: 8, z: 149.4 }, { x: 8, z: 151 }, { x: 14.5, z: LANE_Z }, { x: 16.8, z: LANE_Z }]; }
      S.setObjective('door', 'Get Lena through the service lanes. Pull each release lever.');
      game.after(6, 'huntStart');
      game.requestCheckpoint('anchor released');
    }
    if (pz.id === 'PURGE') {
      S.vars.purgeLeft = 90;
      defineMachine(game, 'pressX', { x: -23.5, z: 161.8, always: true, mask: 8, label: 'Press' });
      S.vars.machines.pressX.enabled = true; S.vars.machines.pressX.running = true;
      S.set('cut.purge');
      game.fx('caption', { text: '[Alarms. Every light in the core turns red. The evacuation arrows stay lit]', env: true });
      S.setObjective('cut', 'Evacuate west. Ninety seconds.');
      game.makeCheckpoint('purge');
    }
  },

  onNpcArrived(game, n) { if (n.id === 'lena' && n.x > 16) n.lane = true; },
};

// the hunt starts once Lena is moving
const _onTimer = script.onTimer;
script.onTimer = (game, key, data) => {
  if (key === 'huntStart') {
    const p = game.anyLivingPlayer();
    const U = game.spawn('unseen', { id: 'Uhunt', x: 8, z: 146.5, anchors: [{ x: 8, z: 146.5 }], withdrawTo: { x: 8, z: 146 }, encounter: 'hunt', despawnOnWithdraw: true });
    if (p) { U.beginWarn(p); }
    game.fx('caption', { text: '[In the anchor chamber, three dents press into the floor where Lena\'s chair stood, walking after you]', env: true });
    return;
  }
  _onTimer(game, key, data);
};

function commit(game, p) {
  const S = game.story;
  if (S.has('P12.committed')) return { ok: true };
  if (p.id !== game.hostId) return { ok: false, msg: 'The host has final campaign control.' };
  const pz = game.puzzles.get('P12');
  const sel = pz && pz.state.sel;
  if (!sel) return { ok: false, msg: 'Select a purpose at the console first.' };
  const away = [...game.players.values()].filter((q) => q.alive && q.room !== '6.10');
  if (away.length) return { ok: false, msg: `Everyone must be in broadcast control first (${away.map((q) => q.name).join(', ')}).` };
  if (sel === 'door' && missingEvidence(game).length) return { ok: false, msg: 'MAINTENANCE BYPASS needs E1, E2, E3 and E4.' };
  if (S.vars.holdUntil && game.time < S.vars.holdUntil) return { ok: false, msg: `A crew member asked for more time. The gate is held for ${Math.ceil(S.vars.holdUntil - game.time)} more seconds.` };
  S.set('P12.committed');
  S.set(`route.${sel}`);
  game.fx('committed', { route: sel });
  game.fx('sfx', { name: 'relayClick', x: 11.6, z: 158 });
  if (sel === 'familiar') { S.play('obedientCommit', { force: true }); S.setObjective('familiar', 'Activate the voice gates: A, B, C.'); }
  if (sel === 'door') { S.play('rescueCommit', { force: true }); S.setObjective('door', 'Run the maintenance bypass at the east station.'); }
  if (sel === 'cut') { S.play('destructionCommit', { force: true }); S.setObjective('cut', 'Open the guarded emergency panel on the west wall.'); }
  game.requestCheckpoint('route committed');
  return { ok: true };
}

export default {
  id: 6,
  title: 'The Unseen Depth',
  kit: 'relay',
  fog: { color: 0x0c0d12, density: 0.028 },
  hemi: 0.5,
  ambient: 'relay',
  music: 'core',
  start: { x: 8, z: 2.5, yaw: Math.PI },
  entries: { nexus: { x: 3.4, z: 9, yaw: -Math.PI / 2 }, r2: { x: 8, z: 125, yaw: Math.PI } },
  replayKit: { flashlight: true, camera: true, pouch: [['battery', 1], ['firstaid', 1], ['film', 1]] },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints,
  water: [
    { x0: 0.2, z0: 67, x1: 7, z1: 81, depth: 0.22, body: 'frag' },
    { x0: 9, z0: 67, x1: 13, z1: 81, depth: 0.22, body: 'frag' },
    { x0: 7, z0: 72.5, x1: 9, z1: 75.5, depth: 0.22, body: 'frag' },
  ],
  drains: [],
  surfaces: [{ x0: 13, z0: 67, x1: 15.8, z1: 81, s: 'grate' }],
  wallDoors: [
    { room: '6.01', side: 'S', pos: 0, label: 'Freight lift' },
    { room: '6.01', side: 'W', pos: -5, label: 'Mall landing' }, { room: '6.01', side: 'W', pos: 4, label: 'Pool landing' },
    { room: '6.01', side: 'E', pos: -4, label: 'Residents landing' }, { room: '6.01', side: 'E', pos: 4, label: 'Lower plant landing' },
  ],
  director: { ambient: ['floorDent', 'distantDoor', 'pipeKnock', 'radioClick'] },
  script,
};
