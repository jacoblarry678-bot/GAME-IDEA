/**
 * Chapter two: After Closing. A mall hub that introduces observation-based
 * threat control. Target 55-70 minutes. The atrium stays visible from most
 * routes: a dead fountain, a suspended fiberglass moon, a tilted directory.
 */
import { defineCycle, closeCycle, openCycle, cycles } from '../../sim/shutters.js';

const rooms = [
  { id: '2.01', name: 'Lift lobby', x0: 12, z0: -8, w: 6, d: 8, h: 4, surface: 'terrazzo', kit: 'mall' },
  { id: '2.02', name: 'Central atrium', x0: 0, z0: 0, w: 30, d: 30, h: 12, surface: 'terrazzo', kit: 'mall', lights: atriumLights() },
  { id: '2.03', name: 'Refuge R1', x0: 30, z0: 12, w: 6, d: 6, h: 3, refuge: 'R1', kit: 'mall', surface: 'tile' },
  { id: '2.04', name: 'Department store', x0: 4, z0: 30, w: 22, d: 18, h: 5, surface: 'tile', kit: 'mall' },
  { id: '2.05', name: 'Photo kiosk', x0: -10, z0: 22, w: 10, d: 8, h: 4, surface: 'terrazzo', kit: 'mall', wall: 'pastelBlue' },
  { id: '2.06', name: 'Delivery gallery', x0: -9, z0: 48, w: 30, d: 6, h: 4, surface: 'concrete', kit: 'mall', wall: 'pastelMint', light: 'bright' },
  { id: '2.07', name: 'Toy shop', x0: -10, z0: 30, w: 14, d: 16, h: 4, surface: 'tile', kit: 'mall', wall: 'pastelBlue' },
  { id: '2.08', name: 'Employee corridor', x0: -14, z0: 22, w: 4, d: 26, h: 3, surface: 'concrete', kit: 'mall', wall: 'paintBlock' },
  { id: '2.09', name: 'Refuge R2', x0: -15, z0: 48, w: 6, d: 5, h: 3, refuge: 'R2', kit: 'mall', surface: 'tile' },
  { id: '2.10', name: 'Announcement booth', x0: -17, z0: 53, w: 8, d: 8, h: 4, surface: 'carpet', kit: 'mall' },
  { id: '2.11', name: 'Relay T2', x0: -29, z0: 50, w: 12, d: 14, h: 6, surface: 'concrete', kit: 'relay' },
  { id: '2.12', name: 'Service escalator', x0: -26, z0: 64, w: 6, d: 20, h: 8, surface: 'metal', kit: 'mall', open: ['W'] },
  { id: 'FC', name: 'Food court', x0: -40, z0: 64, w: 14, d: 20, h: 8, surface: 'terrazzo', kit: 'mall', open: ['E'], unreachable: true, noCreatures: true, noSpawn: true, light: 'dim' },
];

function atriumLights() {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out.push([4 + i * 7.33, 4 + j * 7.33, 6.5]);
  return out;
}

const doors = [
  { id: 'd201', a: '2.01', b: '2.02', type: 'arch', w: 3 },
  { id: 'r1', a: '2.02', b: '2.03', type: 'refuge' },
  { id: 'd204', a: '2.02', b: '2.04', type: 'arch', w: 4 },
  { id: 'd205', a: '2.02', b: '2.05', type: 'arch', w: 2.4 },
  { id: 'd207', a: '2.02', b: '2.07', type: 'arch', w: 2.4 },
  { id: 'gal', a: '2.04', b: '2.06', type: 'shutter', pos: 18, lock: 'P3.done', lockText: 'The delivery shutter is down. The controls are beside it.', label: 'Delivery shutter' },
  { id: 'd258', a: '2.05', b: '2.08', type: 'door', label: 'Staff only' },
  { id: 'd278', a: '2.07', b: '2.08', type: 'door', label: 'Staff only' },
  { id: 'emp', a: '2.08', b: '2.09', type: 'shutter', w: 2.4, lock: 'P3.done', lockText: 'Locked until the delivery shutters are opened.', label: 'Employee shutter' },
  { id: 'r2', a: '2.06', b: '2.09', type: 'refuge' },
  { id: 'd2910', a: '2.09', b: '2.10', type: 'door' },
  { id: 'booth', a: '2.10', b: '2.11', type: 'door', lock: 'P4.done', lockText: 'Display figures are pressed against the other side. The door will not move.', label: 'Service exit' },
  { id: 'esc', a: '2.11', b: '2.12', type: 'shutter', w: 2.4, lock: 'T2', lockText: 'The exit shutter needs the relay T2 completion switch.', label: 'Exit shutter' },
];

const storefront = (x, z, rot, name) => ({ k: 'storefront', x, z, rot, name, s: [4, 0.15, 3.0] });

const props = [
  // 2.01 lift lobby: a locked display window with one figure
  { k: 'glass', x: 13.35, z: -4, rot: 90, s: [4, 0.06, 2.6] },
  { k: 'shutterPanel', x: 12.3, z: -4, rot: 90, s: [4, 0.08, 2.6], id: 'lobbyShutter', dynamic: true, showIf: 'cyc.lobby' },
  { k: 'bench', x: 17.2, z: -3.5, rot: 90 },
  { k: 'plant', x: 17.4, z: -0.8 },
  // 2.02 atrium
  { k: 'fountain', x: 15, z: 15 },
  { k: 'moon', x: 15, z: 15, y: 7.5 },
  { k: 'directory', x: 11.5, z: 3.0, rot: 0, tilt: 0.18, lines: ['AFTER CLOSING', 'LEVEL 1', '', 'DEPARTMENT STORE ..... N', 'TOYS & GAMES ......... NW', 'PHOTO ................ W', 'SECURITY ............. E'] },
  { k: 'bench', x: 9.6, z: 15, rot: 90 }, { k: 'bench', x: 20.4, z: 15, rot: 90 }, { k: 'bench', x: 15, z: 9.6 }, { k: 'bench', x: 15, z: 20.4 },
  { k: 'pillar', x: 7, z: 7, s: [0.8, 0.8, 12] }, { k: 'pillar', x: 23, z: 7, s: [0.8, 0.8, 12] }, { k: 'pillar', x: 7, z: 23, s: [0.8, 0.8, 12] }, { k: 'pillar', x: 23, z: 23, s: [0.8, 0.8, 12] },
  { k: 'plant', x: 3, z: 3 }, { k: 'plant', x: 27, z: 3 }, { k: 'plant', x: 27, z: 27 }, { k: 'plant', x: 9, z: 27 },
  storefront(29.85, 5.5, 90, 'BRIGHT EYES OPTICAL'), storefront(29.85, 24.5, 90, 'THE COBBLER'),
  storefront(0.15, 8, 270, 'KITE & CO.'), storefront(0.15, 16, 270, 'SUNNYSIDE'),
  storefront(6, 0.15, 0, 'PAPER MOON'), storefront(24, 0.15, 0, "ODELL'S"),
  storefront(8.5, 29.85, 180, 'MARGOT'), storefront(23.5, 29.85, 180, 'HALCYON'),
  { k: 'kiosk', x: 21, z: 11, s: [1.6, 1.2, 2.4] },
  // 2.03 R1 security
  { k: 'console', x: 34.5, z: 12.7, s: [1.6, 0.7, 1.1] }, { k: 'chair', x: 34.5, z: 13.6, rot: 180 },
  // 2.04 department store
  { k: 'rack', x: 9, z: 35 }, { k: 'rack', x: 9, z: 39 }, { k: 'rack', x: 21, z: 35 }, { k: 'rack', x: 21, z: 39 },
  { k: 'display', x: 15, z: 37 }, { k: 'display', x: 12, z: 43 }, { k: 'display', x: 18, z: 43, s: [1.6, 0.8, 0.9] },
  { k: 'mannequin', x: 6, z: 44 }, { k: 'mannequin', x: 7, z: 45.5 },
  { k: 'mirror', x: 4.25, z: 40, rot: 270 },
  { k: 'counter', x: 22.5, z: 45.6, s: [3, 0.8, 1.05] },
  { k: 'glass', x: 24.7, z: 37.5, rot: 90, s: [4, 0.06, 2.6], id: 'dsGlass' },
  ...[7, 10, 13].map((x, i) => ({ k: 'shutterPanel', x, z: 47.7, s: [2.4, 0.08, 2.4], id: `p3s${i + 1}`, dynamic: true, hideIf: `p3.s${i + 1}` })),
  { k: 'shutterPanel', x: 23.5, z: 47.7, s: [2.4, 0.08, 2.4], id: 'p3s4', dynamic: true, hideIf: 'p3.s4' },
  // 2.05 photo kiosk
  { k: 'kiosk', x: -2.2, z: 27.3, s: [2.2, 1.4, 2.4] },
  { k: 'partition', x: -7, z: 24.75, s: [3.0, 0.08, 1.4] },
  { k: 'bench', x: -8.8, z: 28.6 },
  // 2.06 delivery gallery
  { k: 'glass', x: 4, z: 53.05, s: [3, 0.06, 2.6] },
  { k: 'shutterPanel', x: 4, z: 53.75, s: [3, 0.08, 2.6], id: 'galShutter', dynamic: true, showIf: 'cyc.gallery' },
  { k: 'crate', x: 16, z: 52.8 }, { k: 'boxes', x: 18.5, z: 53.2 }, { k: 'crate', x: -6, z: 48.8 },
  { k: 'cart', x: 12, z: 53.2 },
  // 2.07 toy shop
  { k: 'toyShelf', x: -3, z: 37, id: 'toyShelfA' }, { k: 'toyShelf', x: -3, z: 41 }, { k: 'toyShelf', x: 2.5, z: 39, rot: 90 },
  { k: 'toyShelf', x: -6.5, z: 45.6, toys: [[4, 0.18], [2, 0.32], [7, 0.55]], id: 'sizeShelf' },
  { k: 'labelPlate', x: -6.5, z: 45.33, y: 1.62, text: 'SMALL · MEDIUM · LARGE' },
  { k: 'display', x: -5, z: 33.5 }, { k: 'mannequin', x: 1.5, z: 33 },
  { k: 'locker', x: -9.45, z: 43.6, rot: 90, id: 'lenaLocker', face: 'E' },
  { k: 'partition', x: -8.0, z: 41.6, s: [3.6, 0.08, 1.5] },
  // 2.08 employee corridor
  { k: 'boxes', x: -10.6, z: 31 }, { k: 'drum', x: -13.4, z: 44 },
  // 2.10 booth
  { k: 'console', x: -13, z: 60.45, s: [2.4, 0.7, 1.1] }, { k: 'chair', x: -13, z: 59.5, rot: 180 },
  { k: 'speaker', x: -16.6, z: 58, y: 2.6 }, { k: 'speaker', x: -9.4, z: 55, y: 2.6 },
  // 2.11 relay T2
  { k: 'relay', x: -24, z: 50.6 }, { k: 'relay', x: -28.4, z: 61, rot: 90 },
  ...[53, 56, 59].map((z) => ({ k: 'shutterPanel', x: -28.6, z, rot: 90, s: [2.2, 0.08, 2.4], id: `west${z}`, dynamic: true, showIf: 'cyc.west' })),
  ...[53, 56, 59].map((z) => ({ k: 'glass', x: -27.6, z, rot: 90, s: [2.2, 0.06, 2.4], solid: false })),
  // 2.12 escalator, glass wall onto the food court
  { k: 'escalator', x: -23, z: 76, s: [1.6, 12, 0.4] },
  { k: 'railing', x: -24.2, z: 74, rot: 90, s: [10, 0.08, 1.05] }, { k: 'railing', x: -21.8, z: 74, rot: 90, s: [10, 0.08, 1.05] },
  { k: 'glass', x: -26.03, z: 74, rot: 90, s: [20, 0.06, 4], mask: 3 },
  // food court (seen through glass)
  ...foodCourt(),
];

function foodCourt() {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = -37.5 + i * 3, z = 67 + j * 4.5;
    out.push({ k: 'foodTable', x, z, solid: false });
    for (const [dx, dz] of [[0, -0.9], [0.9, 0.2], [-0.8, 0.5]]) out.push({ k: 'silhouette', x: x + dx, z: z + dz, id: `sil${out.length}`, faceX: -23, faceZ: 70 });
  }
  return out;
}

const hidden = [
  { id: 'h2chart', x: -6, y: 1.7, z: 29.78, face: 'S', w: 2.4, h: 1.6, art: 'text:MAINTENANCE|OPENING ORDER|2 · 4 · 1 · 3', clue: 'clue.P3', quest: true, text: 'Behind the "closed for renovation" poster, the original shutter chart reads: MAINTENANCE OPENING ORDER 2 · 4 · 1 · 3.', clueText: 'Photo kiosk chart: shutter opening order 2, 4, 1, 3.' },
  { id: 'h2moon', x: 15, y: 9.15, z: 15, face: 'up', w: 1.2, h: 1.2, art: 'footprint', anyFacing: true, secret: 'S2', text: 'Someone is standing on top of the fiberglass moon, looking down at the fountain.' },
];

const stations = [
  { id: 'S2', panel: { x: -6, y: 1.1, z: 22.55, face: 'N' }, cam: { x: -6, y: 1.65, z: 23.1, yaw: Math.PI, pitch: 0.0 }, alcove: [-8.6, 22.2, -5.6, 24.7], puzzle: 'P3', target: 'h2chart' },
];

const puzzles = [
  {
    id: 'P3', type: 'sequence', title: 'Delivery shutter controls', panel: { x: 14.5, y: 1.3, z: 47.65, face: 'S' },
    instructions: 'Four shutter controls numbered 1 to 4. The public directory lists every shutter as closed for renovation.',
    buttons: [1, 2, 3, 4].map((n) => ({ id: `s${n}`, label: String(n), sub: `shutter ${n}` })),
    solution: ['s2', 's4', 's1', 's3'], kind: 'shutter', stepSound: 'switchOn',
    onStep: (pz, act) => { pz.game.story.set(`p3.s${pz.state.seq.length}`); pz.game.fx('sfx', { name: 'shutterWarn', x: 14, z: 47 }); },
    onWrongHook: (pz) => {
      const g = pz.game;
      g.fx('warning', { type: 'cutout', x: 14, z: 46, text: 'Wrong control. Opened shutters close in three seconds.' });
      g.after(3, 'p3reset');
      g.story.vars.p3mistakes = (g.story.vars.p3mistakes || 0) + 1;
    },
    wrongText: 'Wrong control. A three second warning, then the opened shutters close and the sequence returns to its start.',
    idleDisplay: 'SHUTTERS · CLOSED FOR RENOVATION', display: (pz) => (pz.done ? 'DELIVERY GALLERY · OPEN' : `OPENED: ${pz.state.seq.map((s) => s.slice(1)).join(' · ') || 'NONE'}`),
    doneText: 'All four shutters open. The delivery gallery and the employee shutter are unlocked.',
  },
  {
    id: 'P4', type: 'routing', title: 'Closing announcement', panel: { x: -13, y: 1.3, z: 60.0, face: 'S' }, remote: false,
    instructions: 'Four speaker zones. The diagram on the wall: a display follows the last store channel it hears. Keep the service exit silent during closing rotation.',
    onPlay: (pz, zones, success) => {
      const g = pz.game;
      if (success) {
        const targets = [{ x: -27.2, z: 53, yaw: Math.PI / 2 }, { x: -27.2, z: 56, yaw: Math.PI / 2 }, { x: -27.2, z: 59, yaw: Math.PI / 2 }];
        ['Cb1', 'Cb2', 'Cb3'].forEach((id, i) => { const c = g.enemyById(id); if (c) c.blockMove = targets[i]; });
        g.fx('caption', { text: '[The display figures shuffle west toward the shop speakers]', env: true });
      } else {
        g.fx('caption', { text: zones.includes('service') ? '[The figures stay by the service exit. The exit speaker is still on.]' : '[The figures drift toward the speakers, then settle back by the exit.]', env: true });
      }
    },
    doneText: 'The figures stand in the west shop windows. The west shutters close over them.',
  },
  {
    id: 'E1', type: 'sequence', title: 'Staff locker · badge drawer', panel: { x: -8.95, y: 1.15, z: 42.4, face: 'E' },
    instructions: 'A staff locker with "ORTIZ" etched inside its open door. The badge drawer is latched by three display buttons.',
    buttons: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `t${n}`, label: String(n) })),
    solution: ['t4', 't2', 't7'], kind: 'keypad', stepSound: 'tone', onWrong: 'reset', wrongSound: 'click',
    wrongText: 'The latch clicks and resets. No harm done.', idleDisplay: 'LATCHED', display: (pz) => (pz.done ? 'RELEASED' : `LATCHED ${'•'.repeat(pz.state.seq.length)}`),
    doneText: 'The drawer releases. Lena\'s employee badge, with a hand-added sunflower sticker.',
  },
];

const records = [
  { id: '07', title: 'Security handover', x: 34.0, y: 1.12, z: 12.7 },
  { id: '08', title: 'Closing display', x: -10.2, y: 1.5, z: 34, face: 'W' },
  { id: '09', title: 'Photo complaint', x: -2.2, y: 1.45, z: 26.5 },
  { id: '10', title: 'Lena\'s note', x: -9.0, y: 1.0, z: 44.6 },
  { id: '11', title: 'Announcement policy', x: -12.2, y: 1.15, z: 60.2 },
  { id: '12', title: 'Rook recording one', audio: true, x: -24.5, y: 1.4, z: 51.2 },
];

const pickups = [
  { id: 'c2bat', item: 'battery', perPlayer: 1, route: 'critical', x: 15, y: 0.5, z: 9.6 },
  { id: 'c2film', item: 'film', perTwo: 1, route: 'critical', x: 22.0, y: 1.1, z: 45.6 },
  { id: 'c2band', item: 'bandage', perPlayer: 1, route: 'critical', x: 21, y: 1.25, z: 11.6 },
  { id: 'o2aid', item: 'firstaid', qty: 1, route: 'optional', x: 33.2, y: 1.12, z: 12.6 },
  { id: 'o2bat1', item: 'battery', qty: 1, route: 'optional', x: -1.0, y: 1.0, z: 39.0 },
  { id: 'o2bat2', item: 'battery', qty: 1, route: 'optional', x: -13.4, y: 1.05, z: 44 },
  { id: 'o2film1', item: 'film', qty: 1, route: 'optional', x: -1.4, y: 1.45, z: 27.6 },
  { id: 'o2film2', item: 'film', qty: 1, route: 'optional', x: -14.0, y: 1.15, z: 60.2 },
  { id: 'o2decoy1', item: 'decoy', qty: 1, route: 'optional', x: -3, y: 1.2, z: 36.6 },
  { id: 'o2decoy2', item: 'decoy', qty: 1, route: 'optional', x: -3, y: 0.7, z: 41.4 },
  { id: 'o2chalk', item: 'chalk', qty: 1, route: 'optional', x: 16, y: 0.8, z: 52.8 },
];

const interactables = [
  { id: 'galLever1', kind: 'lever', name: 'Shutter switch', verb: 'Reopen the shutters', x: 10, y: 1.2, z: 48.25, face: 'N', mesh: 'lever' },
  { id: 'galLever2', kind: 'lever', name: 'Shutter switch', verb: 'Reopen the shutters', x: -4, y: 1.2, z: 48.25, face: 'N', mesh: 'lever' },
  { id: 'p4diagram', kind: 'note', title: 'Announcement diagram', x: -9.25, y: 1.5, z: 58, face: 'W', clue: 'clue.P4', text: 'CLOSING ROTATION. Display figures return to the LAST ACTIVE STORE SPEAKER they hear. Zones: Atrium, West shops, Delivery gallery, Service exit. Keep the service exit SILENT during closing rotation.', clueText: 'Announcement diagram: figures go to the last active store speaker; the service exit must stay silent.' },
  { id: 'sizeLabel', kind: 'note', title: 'Shelf label', x: -6.5, y: 1.55, z: 45.3, face: 'S', text: 'SMALL · MEDIUM · LARGE. Beneath it stand three numbered toys: a small bear tagged 4, a medium robot tagged 2 and a large rocket tagged 7.', clue: 'clue.E1', clueText: 'Toy shop shelf: small 4, medium 2, large 7.' },
  { id: 't2switch', kind: 'switch', name: 'T2 completion switch', verb: 'Engage', x: -24, y: 1.25, z: 51.3, face: 'N', requires: 'P4.done', mesh: 'lever' },
  { id: 'escalator', kind: 'lift', name: 'Service escalator', verb: 'Ride down', x: -23, y: 1.1, z: 69.5, requires: 'T2' },
];

const hints = {
  mall: ['The department store is north of the atrium. Its delivery shutter controls are by the back wall.'],
  shutters: [
    'The directory says every shutter is closed for renovation. The photo kiosk on the west side has an older chart behind its poster. Photograph it, or use the Survey Station facing it.',
    'The chart lists a maintenance opening order for controls 1 to 4.',
    'Press 2, 4, 1, 3.',
  ],
  gallery: ['Cutouts cannot move while you look straight at them. The shutter switches on the gallery\'s south wall reopen the shutters, and a camera flash pins them for four seconds.', 'Walk backward while watching the figure, or cross while the shutters are open.', 'Refuge R2 is at the west end of the gallery.'],
  announce: [
    'The diagram in the booth explains where the display figures go during the closing announcement.',
    'They follow the last active store speaker. The service exit must be silent.',
    'Enable WEST SHOPS only, disable the other three zones, then press PLAY.',
  ],
  relayT2: ['The completion switch is on relay T2\'s south wall.'],
  escalator: ['The service escalator is north of relay T2.'],
};
const navHints = { mall: 'd204', shutters: 'd205', gallery: 'r2', announce: 'd2910', relayT2: 'booth', escalator: 'esc' };

// ------------------------------------------------------------------ script
function ensure(game, entry) {
  const S = game.story;
  defineCycle(game, 'lobby', { x: 13, z: -4, label: 'Window shutter' });
  defineCycle(game, 'dsDemo', { x: 24, z: 37.5, label: 'Display shutters' });
  defineCycle(game, 'gallery', { x: 4, z: 53, label: 'Gallery shutters', auto: S.has('P3.done') ? { open: 14, closed: 10 } : null });
  defineCycle(game, 'west', { x: -28, z: 56, label: 'West shop shutters' });
  if (entry === 'return') return;
  if (!game.enemyById('Clobby')) game.spawn('cutout', { id: 'Clobby', x: 12.7, z: -4, yaw: -Math.PI / 2, anchor: { x: 12.7, z: -4, yaw: -Math.PI / 2 }, group: 'lobby', mode: 'demo', region: [12.3, -5.7, 13.15, -2.3] });
  if (!game.enemyById('Cds')) game.spawn('cutout', { id: 'Cds', x: 25.3, z: 37.5, yaw: -Math.PI / 2, anchor: { x: 25.3, z: 37.5, yaw: -Math.PI / 2 }, group: 'dsDemo', mode: 'demo', region: [24.8, 34.5, 25.8, 40.5] });
  if (!game.enemyById('Cgal')) game.spawn('cutout', { id: 'Cgal', x: 4, z: 53.45, yaw: 0, anchor: { x: 4, z: 53.45, yaw: 0 }, group: 'gallery', mode: 'hunt' });
  const blk = S.has('P4.done');
  const pts = blk ? [[-27.2, 53], [-27.2, 56], [-27.2, 59]] : [[-18.6, 55.6], [-19.3, 57.2], [-18.7, 58.6]];
  ['Cb1', 'Cb2', 'Cb3'].forEach((id, i) => { if (!game.enemyById(id)) { const c = game.spawn('cutout', { id, x: pts[i][0], z: pts[i][1], yaw: blk ? Math.PI / 2 : -Math.PI / 2, mode: 'blockade', anchor: { x: pts[i][0], z: pts[i][1] } }); c.state = 'dormant'; } });
}

export const script = {
  init(game, entry) {
    const S = game.story;
    ensure(game, entry);
    if (entry === 'start') {
      S.setObjective('mall', 'Find a way through the mall.');
      S.setRadio('Proceed to the department store.');
      game.after(3, 'scene:mallArrival');
    }
    if (entry === 'return') S.setObjective('return2', 'Recover Lena\'s badge from the toy shop staff locker, then take the freight lift back.');
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    if (game.returnTrip) return;
    if (room.id === '2.01' && first) game.after(4, 'lobbyDemo');
    if (room.id === '2.04' && !S.has('ch2.dsDemo')) {
      S.set('ch2.dsDemo');
      if (!S.has('P3.done')) S.setObjective('shutters', 'Open the delivery shutters.');
      game.after(2.5, 'dsDemo');
    }
    if (room.id === '2.07' && first) game.fx('tutorial', { id: 'toyshop', text: 'A staff locker in the back corner has a name etched inside the door.' });
    if (room.id === '2.10' && first && !S.has('P4.done')) { S.setObjective('announce', 'Clear the service exit.'); S.setRadio('Route the closing announcement. The exit is through relay T2.'); }
  },

  onTimer(game, key) {
    const S = game.story;
    if (key === 'lobbyDemo') { closeCycle(game, 'lobby', 4); game.after(8, 'scene:shutterDemo'); }
    if (key === 'dsDemo') { closeCycle(game, 'dsDemo', 8); game.fx('tutorial', { id: 'cutout', text: 'Cutouts cannot move while you look straight at them within twelve meters. Turning away lets them move while the shutters are closed.' }); }
    if (key === 'p3reset') {
      for (let i = 1; i <= 4; i++) S.set(`p3.s${i}`, false);
      const n = S.vars.p3mistakes || 0;
      if (n === 1) game.fx('caption', { text: '[Behind the store glass, a display figure has turned to face you]', env: true });
      else if (n >= 2) game.after(4, 'p3investigate');
    }
    if (key === 'p3investigate') closeCycle(game, 'dsDemo', 6);
  },

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.kind === 'lever' && phase === 'begin') {
      const c = cycles(game).gallery;
      openCycle(game, 'gallery');
      if (c) c.t = -20; // hold open for twenty extra seconds
      game.fx('sfx', { name: 'leverClunk', x: it.x, z: it.z });
      return { ok: true };
    }
    if (it.id === 't2switch' && phase === 'begin') {
      if (!S.has('P4.done')) return { ok: false, msg: 'The switch is dead.' };
      S.set('T2');
      game.fx('network', { segment: 'T2' });
      game.fx('sfx', { name: 'relayClick', x: it.x, z: it.z });
      S.play('t2Done');
      S.setRadio('The escalator is open.');
      S.setObjective('escalator', 'Take the service escalator down.');
      game.requestCheckpoint('relay T2');
      return { ok: true };
    }
    if (it.id === 'escalator' && phase === 'begin') {
      if (!S.has('T2')) return { ok: false, msg: 'The escalator is behind the exit shutter.' };
      game.fx('silhouettesTurn', {});
      game.fx('sfx', { name: 'radioClick' });
      game.beginTransition('escalator', 3, { scene: 'foodCourt', dur: 7 });
      return { ok: true };
    }
    if (it.id === 'returnLift' && phase === 'begin') { game.beginTransition('lift', 6, { entry: 'return', returnTo: 'nexus', dur: 4 }); return { ok: true }; }
    return null;
  },

  onPuzzle(game, pz) {
    const S = game.story;
    if (pz.id === 'P3') {
      S.play('p3Done');
      S.setRadio('The announcement booth controls the service exit.');
      S.setObjective('gallery', 'Cross the delivery gallery to the refuge at its far end.');
      const c = cycles(game).gallery;
      if (c) { c.auto = { open: 14, closed: 10 }; c.t = 4; }
      game.makeCheckpoint('delivery shutters open');
    }
    if (pz.id === 'P4') {
      closeCycle(game, 'west', null);
      S.setObjective('relayT2', 'Restore relay T2.');
      game.requestCheckpoint('service exit clear');
    }
    if (pz.id === 'E1') {
      game.collectEvidence('E1', null);
      S.play('badgeFound');
      S.addClue('E1.number', 'Lena Ortiz, personnel number 4127-0918 (from her badge).', 'observed');
    }
  },

  onRefugeSecured(game, room) {
    const S = game.story;
    if (room.id === '2.09' && S.has('P3.done') && !S.has('P4.done') && S.objective.id === 'gallery') S.setObjective('announce', 'Clear the service exit.');
  },
};

/** Return trip: the employee corridor and toy shop, reached by the freight return lift. */
function returnTrip(def) {
  const keep = new Set(['R.02', '2.08', '2.07']);
  const inKeep = (o) => { const x = o.x, z = o.z; return def.rooms.some((r) => keep.has(r.id) && x >= r.x0 && x <= r.x0 + r.w && z >= r.z0 && z <= r.z0 + r.d); };
  return {
    ...def,
    rooms: [...def.rooms.filter((r) => keep.has(r.id)), { id: 'R.02', name: 'Freight return landing', x0: -14, z0: 18, w: 4, d: 4, h: 3, surface: 'metal', kit: 'lift' }],
    doors: [...def.doors.filter((d) => keep.has(d.a) && keep.has(d.b)), { id: 'ret', a: 'R.02', b: '2.08', type: 'arch', w: 2 }],
    props: def.props.filter(inKeep), pickups: [], records: def.records.filter(inKeep), hidden: [], stations: [],
    puzzles: def.puzzles.filter((p) => p.id === 'E1'),
    interactables: [...def.interactables.filter((i) => inKeep(i)), { id: 'returnLift', kind: 'lift', name: 'Freight return lift', verb: 'Return to the freight nexus', x: -12, y: 1.2, z: 18.6 }],
    wallDoors: [], director: null,
    start: { x: -12, z: 19.6, yaw: Math.PI },
  };
}

export default {
  id: 2,
  title: 'After Closing',
  kit: 'mall',
  fog: { color: 0x3a3238, density: 0.022 },
  hemi: 0.55,
  ambient: 'mall',
  music: 'closingRotation',
  start: { x: 15, z: -6.6, yaw: Math.PI },
  replayKit: { flashlight: true, camera: true, pouch: [['battery', 1], ['bandage', 1]] },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints,
  wallDoors: [{ room: '2.01', side: 'S', pos: 0, label: 'Lift doors', lift: true }, { room: '2.08', side: 'S', pos: 0, label: 'Freight return lift (out of service)' }],
  director: { ambient: ['distantDoor', 'tubeBuzz', 'paperRub'] },
  script,
  returnTrip,
};
