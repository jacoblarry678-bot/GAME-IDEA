/**
 * Chapter four: The Residents. Three residential floors around an internal
 * courtyard with no visible sky. The most narrative-heavy chapter: the
 * Tenant, false refuges, June, and Evan's private memory. Target 65-80 min.
 */
import { addToPouch } from '../../sim/equipment.js';

const rooms = [
  { id: '4.01', name: 'Tile landing', x0: 9, z0: -20, w: 6, d: 8, h: 3, kit: 'apartments', surface: 'tile', wall: 'plaster' },
  { id: '4.02', name: 'Mail lobby', x0: 6, z0: -12, w: 12, d: 12, h: 4, kit: 'apartments', surface: 'wood' },
  { id: '4.03', name: 'Refuge R1', x0: 0, z0: -9, w: 6, d: 5, h: 3, kit: 'apartments', surface: 'wood', refuge: 'R1' },
  { id: '4.04', name: 'Courtyard gallery', x0: 0, z0: 0, w: 24, d: 24, h: 12, kit: 'apartments', surface: 'tile', wall: 'plaster', light: 'dim', lights: [[4, 4, 3], [20, 4, 3], [4, 20, 3], [20, 20, 3], [12, 12, 4]] },
  { id: '4.05', name: 'Apartment 204', x0: 18, z0: 24, w: 10, d: 12, h: 3, kit: 'apartments', surface: 'wood', noCreatures: true },
  { id: '4.06', name: 'Side room', x0: -6, z0: 10, w: 6, d: 5, h: 3, kit: 'apartments', surface: 'wood', refuge: 'imitation', offerItem: 'tea' },
  { id: '4.07', name: 'Memory apartment', x0: -14, z0: 15, w: 14, d: 16, h: 3, kit: 'apartments', surface: 'wood' },
  { id: '4.08', name: 'Laundry and storage', x0: 6, z0: 24, w: 12, d: 14, h: 3, kit: 'apartments', surface: 'concrete', wall: 'plaster' },
  { id: '4.09', name: 'Refuge R2', x0: 0, z0: 24, w: 6, d: 6, h: 3, kit: 'apartments', surface: 'wood', refuge: 'R2' },
  { id: '4.10', name: 'Roof access hall', x0: 1, z0: 30, w: 4, d: 28, h: 4, kit: 'apartments', surface: 'wood', light: 'dim' },
  { id: '4.11', name: 'Relay T4', x0: -2, z0: 58, w: 10, d: 10, h: 4, kit: 'relay', surface: 'concrete' },
  { id: '4.12', name: 'Utility elevator', x0: 8, z0: 60, w: 5, d: 6, h: 4, kit: 'lift', surface: 'metal' },
];

const doors = [
  { id: 'd401', a: '4.01', b: '4.02', type: 'arch', w: 2 },
  { id: 'r1', a: '4.02', b: '4.03', type: 'refuge' },
  { id: 'parcel', a: '4.02', b: '4.04', type: 'gate', w: 2.2, lock: 'P7.done', lockText: 'The parcel gate is controlled by the resident directory.', label: 'Parcel gate' },
  { id: 'june', a: '4.04', b: '4.05', type: 'apartment', lock: 'never', lockText: 'June, through the door: "Not this one. I keep this one shut."', label: '204' },
  { id: 'side', a: '4.04', b: '4.06', type: 'apartment', label: 'Side room' },
  { id: 'mem', a: '4.06', b: '4.07', type: 'apartment', label: 'Apartment' },
  { id: 'stair', a: '4.07', b: '4.09', type: 'hidden', reveal: 'P8.done', label: 'Maintenance stair' },
  { id: 'r2', a: '4.08', b: '4.09', type: 'refuge' },
  { id: 'pass', a: '4.08', b: '4.05', type: 'apartment', unlockFrom: '4.08', label: 'Laundry passage' },
  { id: 'roof', a: '4.09', b: '4.10', type: 'door', label: 'Roof access' },
  { id: 'd411', a: '4.10', b: '4.11', type: 'door' },
  { id: 'lift', a: '4.11', b: '4.12', type: 'lift', w: 1.8, lock: 'T4', lockText: 'The utility elevator needs relay T4.', label: 'Utility elevator' },
];

const aptWin = (x, y, z, rot, lit = true) => ({ k: 'aptWindow', x, y, z, rot, lit });

const props = [
  // 4.02 mail lobby
  { k: 'mailboxes', x: 6.25, z: -3.6, rot: 90, s: [3.2, 0.4, 1.8] },
  { k: 'directory', x: 16.8, z: -6, rot: 270, lines: ['RESIDENT DIRECTORY', '', '105  ·  GROUND FLOOR  ·  STREET DOOR', '204  ·  COURTYARD VIEW', '312  ·  TOP FLOOR  ·  SKYLIGHT'] },
  { k: 'bench', x: 7.2, z: -8, rot: 90 }, { k: 'plant', x: 7.2, z: -11.2 }, { k: 'table', x: 12, z: -6, s: [1.6, 0.8, 0.8] },
  // 4.03 R1
  { k: 'desk', x: 3, z: -8.4 },
  // 4.04 courtyard: windows on three floors, laundry lines, two marked Tenant windows
  ...[3, 9, 15, 21].flatMap((x) => [aptWin(x, 7, 0.2, 0), aptWin(x, 10, 0.2, 0, false), aptWin(x, 7, 23.8, 180, x % 2 === 1), aptWin(x, 10, 23.8, 180, false)]),
  ...[5, 19].flatMap((z) => [aptWin(0.2, 7, z, 270), aptWin(23.8, 7, z, 90, false), aptWin(0.2, 10, z, 270, false), aptWin(23.8, 10, z, 90)]),
  { k: 'aptWindow', x: 5, y: 3.6, z: 0.2, rot: 0, lit: true, marked: true, id: 'win1' },
  { k: 'aptWindow', x: 0.2, y: 3.6, z: 18, rot: 270, lit: true, marked: true, id: 'win2' },
  { k: 'laundryLine', x: 12, z: 8, y: 4.2, s: [23, 0.05, 1.2] }, { k: 'laundryLine', x: 12, z: 16, y: 5.0, s: [23, 0.05, 1.2] },
  { k: 'bench', x: 12, z: 12 }, { k: 'plant', x: 22.8, z: 1.2 }, { k: 'plant', x: 22.8, z: 22.8 },
  { k: 'barrier', x: 1.6, z: 4.2, s: [3.0, 0.1, 2.4] }, { k: 'barrier', x: 3.1, z: 2.2, rot: 90, s: [4.0, 0.1, 2.4] },
  { k: 'aptDoor', x: 8, z: 23.75, rot: 180 }, { k: 'aptDoor', x: 15, z: 23.75, rot: 180 },
  // 4.06 side room (imitation): same furniture as a refuge
  // 4.07 memory apartment
  { k: 'sofa', x: -7, z: 21, rot: 180 }, { k: 'tv', x: -1.2, z: 27, rot: 270, id: 'memTv', dynamic: true, hideIf: 'P8.done', until: 'P8.done' },
  { k: 'table', x: -8, z: 26.5, s: [1.8, 1.0, 0.75] }, { k: 'chair', x: -8, z: 27.6, rot: 180 }, { k: 'chair', x: -8, z: 25.4 },
  { k: 'bed', x: -12.4, z: 17.5 }, { k: 'wardrobe', x: -13.5, z: 22.5, rot: 90 },
  { k: 'frameMount', x: -10, z: 30.75, y: 1.6, rot: 180 }, { k: 'frameMount', x: -8, z: 30.75, y: 1.6, rot: 180 }, { k: 'frameMount', x: -6, z: 30.75, y: 1.6, rot: 180 },
  // 4.08 laundry
  ...[8, 9, 10, 11].map((x) => ({ k: 'washer', x, z: 37.5 })),
  { k: 'shelf', x: 13.5, z: 37.6 }, { k: 'shelf', x: 6.4, z: 33, rot: 90 },
  { k: 'cart', x: 14, z: 32.5, id: 'cart', dynamic: true },
  { k: 'table', x: 12, z: 29, s: [1.4, 0.8, 0.9] },
  // 4.09 R2 boiler
  { k: 'tank', x: 1.2, z: 29, s: [1.2, 1.2, 2.2] },
  // 4.10 roof access hall: two apartment doors and one alcove (a locker)
  { k: 'aptDoor', x: 1.25, z: 39, rot: 90 }, { k: 'aptDoor', x: 4.75, z: 50, rot: 270 },
  { k: 'locker', x: 4.45, z: 44, rot: 270, id: 'roofLocker', face: 'W' },
  // 4.11 T4 radio bank
  { k: 'relay', x: 3, z: 67.4 }, { k: 'radioBank', x: -1.5, z: 63, rot: 90, s: [4, 0.8, 1.8] },
  { k: 'liftPanel', x: 12.7, z: 63, y: 1.2, solid: false, rot: 270 },
];

const hidden = [
  { id: 'h4labels', x: -8, y: 1.6, z: 30.78, face: 'S', w: 5.2, h: 0.9, art: 'text:AFTER        BEFORE        DURING', clue: 'clue.P8', quest: true, text: 'Behind the three frame mounts the wall is labelled, left to right: AFTER, BEFORE, DURING.', clueText: 'Memory apartment dining wall, mounts left to right: 1 AFTER · 2 BEFORE · 3 DURING.' },
  { id: 'h4seasons', x: 12, y: 8.5, z: 23.78, face: 'S', w: 22, h: 4, art: 'text:SPRING · SUMMER · AUTUMN · WINTER', secret: 'S4', text: 'Every courtyard window shows a different season outside it.' },
];

const stations = [
  { id: 'S4', panel: { x: -8, y: 1.1, z: 15.6, face: 'N' }, cam: { x: -8, y: 1.6, z: 16.2, yaw: Math.PI, pitch: 0 }, alcove: [-10.5, 15.2, -6.8, 17.8], puzzle: 'P8', target: 'h4labels' },
];

const puzzles = [
  {
    id: 'P7', type: 'mail', title: 'Resident mail', panel: { x: 6.7, y: 1.2, z: -3.6, face: 'E' },
    instructions: 'Three envelopes with partly obscured addresses. Their contents: MORROW mentions the courtyard view. ASH mentions the top-floor skylight. VALE mentions the ground-floor street door. The directory beside the mailboxes lists each apartment.',
    envelopes: [{ id: 'morrow', name: 'Morrow', box: '204' }, { id: 'ash', name: 'Ash', box: '312' }, { id: 'vale', name: 'Vale', box: '105' }],
    boxes: ['105', '204', '312'],
    doneText: 'The parcel gate opens. A new envelope drops into the tray, addressed to Evan Ward at an apartment number that did not exist a moment ago.',
  },
  {
    id: 'P8', type: 'frames', title: 'Dining wall', panel: { x: -8, y: 1.3, z: 30.6, face: 'S' },
    instructions: 'Three pictures: a childhood bedroom, Evan\'s first maintenance uniform, the service gate from the night of the accident. Three empty mounts on the dining wall.',
    frames: [{ id: 'bedroom', name: 'Childhood bedroom' }, { id: 'uniform', name: 'First uniform' }, { id: 'gate', name: 'Service gate' }],
    solution: ['gate', 'bedroom', 'uniform'],
    doneText: 'The television slides aside. Behind it, a maintenance stair. Among the pictures, a new one: Evan arriving at a final chamber he has not reached yet.',
  },
];

const records = [
  { id: '19', title: 'Returned mail', x: 9.0, y: 0.8, z: -6.2 },
  { id: '20', title: 'Superintendent rule', x: 3.0, y: 0.8, z: -8.4 },
  { id: '21', title: 'June\'s tally', x: 21, y: 0.05, z: 23.35, requires: 'ch4.juneSpoke' },
  { id: '22', title: 'Family picture', x: -7.4, y: 0.8, z: 26.5 },
  { id: '23', title: 'Repair receipt', x: 12.4, y: 0.92, z: 29.0 },
  { id: '24', title: 'Rook recording three', audio: true, x: 3.8, y: 1.3, z: 66.8 },
];

const pickups = [
  { id: 'c4bat', item: 'battery', perPlayer: 1, route: 'critical', x: 12.4, y: 0.8, z: -6.0 },
  { id: 'c4film', item: 'film', perTwo: 1, route: 'critical', x: -8.6, y: 0.8, z: 26.4 },
  { id: 'c4aid', item: 'firstaid', qty: 1, route: 'critical', x: 2.0, y: 0.05, z: 25.4 },
  { id: 'c4tea', item: 'tea', perPlayer: 1, route: 'critical', x: 11.6, y: 0.8, z: -6.2 },
  { id: 'o4tea1', item: 'tea', qty: 1, route: 'optional', x: 9, y: 1.0, z: 37.5 },
  { id: 'o4tea2', item: 'tea', qty: 1, route: 'optional', x: -12.4, y: 0.65, z: 17.0 },
  { id: 'o4bat1', item: 'battery', qty: 1, route: 'optional', x: 13.5, y: 1.0, z: 37.3 },
  { id: 'o4bat2', item: 'battery', qty: 1, route: 'optional', x: 7.2, y: 0.5, z: -8 },
  { id: 'o4film', item: 'film', qty: 1, route: 'optional', x: 6.6, y: 1.0, z: 33 },
  { id: 'o4aid', item: 'firstaid', qty: 1, route: 'optional', x: -13.5, y: 1.0, z: 24 },
  { id: 'o4wedge1', item: 'wedge', qty: 1, route: 'optional', x: 12, y: 0.5, z: 12 },
  { id: 'o4wedge2', item: 'wedge', qty: 1, route: 'optional', x: 2.8, y: 0.05, z: 33 },
  { id: 'o4wedge3', item: 'wedge', qty: 1, route: 'optional', x: -1.0, y: 0.05, z: 60 },
];

const interactables = [
  { id: 'mug', kind: 'inspect', name: 'Yellow mug', verb: 'Examine', x: 13.0, y: 1.25, z: 37.4, mesh: 'mug' },
  { id: 'juneTalk', kind: 'npc', name: 'June Ellis', verb: 'Talk', x: 21, y: 1.4, z: 24.35, reach: 2.2 },
  { id: 'juneTalk2', kind: 'npc', name: 'June Ellis', verb: 'Tell her the route is ready', x: 18.6, y: 1.4, z: 31.2, reach: 2.2, requires: 'door.pass.unlocked' },
  { id: 'cartPush', kind: 'cart', name: 'Laundry cart', verb: 'Push under the passage door', x: 14, y: 0.9, z: 32.5, hold: 2, hideAfter: 'ch4.cartPlaced', requires: 'door.pass.unlocked' },
  { id: 't4switch', kind: 'switch', name: 'Relay T4 completion switch', verb: 'Engage', x: 3, y: 1.3, z: 66.75, face: 'S' },
  { id: 'lift4', kind: 'lift', name: 'Utility elevator controls', verb: 'Descend', x: 12.4, y: 1.3, z: 63, requires: 'T4' },
  { id: 'intercom', kind: 'note', title: 'Envelope', x: 13.0, y: 0.8, z: -6.2, text: 'MORROW, apt. ··4 — "you can see the whole courtyard from my kitchen." ASH, apt. 3·· — "the skylight leaks again, top floor." VALE, apt. ··5 — "the street door downstairs still sticks."', clue: 'clue.P7', clueText: 'Envelopes: Morrow · courtyard view; Ash · top-floor skylight; Vale · ground-floor street door.' },
];

const hints = {
  mail: ['Read the envelopes on the lobby table and the resident directory on the east wall.', 'Each envelope mentions where its writer lives: courtyard view, top-floor skylight, ground-floor street door.', 'Morrow to 204, Ash to 312, Vale to 105.'],
  courtyard: ['Do not stare at the marked windows. Look away for four seconds to reset what you started.', 'The side room on the west side leads deeper into the apartments.'],
  frames: ['Photograph the dining wall in the memory apartment, or use the Survey Station facing it.', 'The labels behind the mounts read AFTER, BEFORE, DURING. Childhood comes before; the uniform is during his working life; the gate is after.', 'Mount 1 gate, mount 2 bedroom, mount 3 uniform.'],
  laundry: ['The laundry room is east of Refuge R2.'],
  roof: ['The roof access hall is north of Refuge R2. Something crosses it; the locker halfway along is a hiding place.'],
  relayT4: ['The T4 completion switch is beside the radio bank.'],
  lift: ['The utility elevator is east of relay T4.'],
};
const navHints = { mail: 'parcel', courtyard: 'side', frames: 'mem', laundry: 'r2', roof: 'roof', relayT4: 'd411', lift: 'lift' };

const WINDOWS = [
  { id: 'win1', x: 5, y: 3.6, z: 0.2, emerge: { x: 1.5, z: 2.0 }, region: [0.3, 0.3, 2.9, 3.9], demo: true },
  { id: 'win2', x: 0.2, y: 3.6, z: 18, emerge: { x: 8, z: 22.6 }, demo: false },
];

// ------------------------------------------------------------------ script
const JUNE_HOME = { x: 21, z: 25.2 };

function ensure(game, entry) {
  const S = game.story;
  if (entry === 'return') return;
  if (!game.npcs.some((n) => n.id === 'june')) {
    const safe = S.has('JUNE_SAFE');
    game.npcs.push({ id: 'june', name: 'June Ellis', model: 'june', x: safe ? 3 : JUNE_HOME.x, z: safe ? 27 : JUNE_HOME.z, yaw: Math.PI, speed: 1.2, path: null });
  }
}

function gaze(game, dt) {
  const S = game.story, v = S.vars;
  v.gaze = v.gaze || {};
  for (const w of WINDOWS) {
    const st = v.gaze[w.id] = v.gaze[w.id] || { t: 0, off: 0, warned: false, fired: false };
    if (st.fired) continue;
    let looking = null;
    for (const p of game.players.values()) {
      if (!p.alive || p.room !== '4.04') continue;
      const e = p.eye(), f = p.forward();
      const dx = w.x - e.x, dy = w.y - e.y, dz = w.z - e.z, d = Math.hypot(dx, dy, dz);
      if (d > 26) continue;
      if ((dx * f.x + dy * f.y + dz * f.z) / d < Math.cos(11 * Math.PI / 180)) continue;
      if (!game.level.world.clearLine(e.x, e.y, e.z, w.x + (e.x - w.x) / d * 0.3, w.y + (e.y - w.y) / d * 0.3, w.z + (e.z - w.z) / d * 0.3)) continue;
      looking = p; break;
    }
    if (looking) { st.t += dt; st.off = 0; } else { st.off += dt; if (st.off >= 4) { st.t = 0; st.warned = false; } }
    if (st.t >= 3 && !st.warned) {
      st.warned = true;
      game.fx('curtains', { window: w.id });
      game.fx('warning', { type: 'tenant', x: w.x, z: w.z, text: 'The curtains in the marked window move.', target: looking && looking.id });
    }
    if (st.t >= 6 && looking) {
      st.fired = true;
      game.fx('sfx', { name: 'knock3', x: w.emerge.x, z: w.emerge.z });
      const T = game.spawn('tenant', { id: `T${w.id}`, x: w.emerge.x, z: w.emerge.z, region: w.region || null, encounter: w.demo ? 'demo' : 'window', anchors: [w.emerge], withdrawTo: w.emerge, despawnOnWithdraw: true });
      if (w.demo) { T.setState('scripted'); game.after(12, 'tenantDemoGone', { id: T.id }); game.fx('caption', { text: '[Beyond the locked gate, a figure steps out of the apartment door]', env: true }); }
      else { T.target = looking.id; T.lastKnown = { x: looking.x, z: looking.z, t: game.time }; T.lastSeenT = game.time; T.setState('pursue'); }
    }
  }
}

function juneReady(game) {
  const S = game.story;
  const pass = game.level.door('pass');
  if (!S.has('door.pass.unlocked') || pass.target < 0.5) return 'The laundry door keeps swinging shut. It needs something under it.';
  if (!S.has('ch4.cartPlaced')) return 'That door will close on me halfway. Put something under it.';
  if (!game.persist.refuges['4.09']) return 'Is the room by the boiler a real one? Watch its clock before you bring me there.';
  return null;
}

export const script = {
  init(game, entry) {
    const S = game.story;
    ensure(game, entry);
    if (entry === 'start') { S.setObjective('mail', 'Get past the mail lobby.'); S.setRadio('The parcel gate is on the resident directory. Proceed to relay four.'); game.after(3, 'scene:residentsArrival'); }
    if (entry === 'return') S.setObjective('return4', 'Examine the mug and the repair receipt in the laundry, then take the freight lift back.');
  },

  update(game, dt) {
    if (game.returnTrip) return;
    gaze(game, dt);
    const S = game.story;
    // the failing laundry door swings shut unless the cart holds it
    const pass = game.level.door('pass');
    if (pass && pass.target > 0.5 && !S.has('ch4.cartPlaced')) {
      S.vars.passOpen = (S.vars.passOpen || 0) + dt;
      if (S.vars.passOpen > 4) { game.setDoor('pass', false); S.vars.passOpen = 0; game.fx('caption', { text: '[The laundry passage door swings shut on its own]', env: true }); }
    } else S.vars.passOpen = 0;
    // roof hall crossing
    if (!S.has('ch4.roofCross')) {
      for (const p of game.players.values()) if (p.alive && p.room === '4.10' && p.z > 35) {
        S.set('ch4.roofCross');
        game.fx('sfx', { name: 'knock3', x: 1.25, z: 39 });
        game.fx('warning', { type: 'tenant', x: 1.25, z: 39, text: 'Three knocks from the apartment door ahead.', target: p.id });
        game.after(3 + (game.assists.reducedStartle ? 1 : 0), 'roofTenant');
      }
    }
  },

  onEnterRoom(game, p, room, prev, first) {
    const S = game.story;
    if (game.returnTrip) return;
    if (room.id === '4.04' && first) { S.setObjective('courtyard', 'Find a way into the apartments.'); game.after(5, 'scene:juneCall'); game.fx('tutorial', { id: 'tenant', text: 'Watching a marked window draws whatever is behind it. Look away for four seconds and it settles.' }); }
    if (room.id === '4.07' && first && !S.has('P8.done')) S.setObjective('frames', 'Find the way out of the memory apartment.');
    if (room.id === '4.08' && first) S.setObjective('roof', 'Reach relay T4 by the roof access hall.');
  },

  onTimer(game, key, data) {
    if (key === 'tenantDemoGone') { const T = game.enemyById(data.id); if (T) T.beginWithdraw(); }
    if (key === 'roofTenant') {
      const T = game.spawn('tenant', { id: 'Troof', x: 1.9, z: 39, anchors: [{ x: 4.0, z: 50 }], withdrawTo: { x: 4.0, z: 50 }, despawnOnWithdraw: true, encounter: 'roof' });
      T.setState('patrol');
      T.data.leaveAt = game.time + 22;
    }
    if (key === 'imitationTrap') {
      const S = game.story;
      const inside = [...game.players.values()].filter((p) => p.alive && p.room === '4.06');
      if (inside.length) {
        const p = inside[0];
        const T = game.spawn('tenant', { id: 'Timit', x: -3, z: 14.2, anchors: [{ x: -3, z: 12.5 }], withdrawTo: { x: -3, z: 14.4 }, despawnOnWithdraw: true, encounter: 'imitation' });
        T.target = p.id; T.lastKnown = { x: p.x, z: p.z, t: game.time }; T.lastSeenT = game.time; T.setState('pursue');
      } else game.fx('caption', { text: '[Behind the side room door, something knocks three times and goes quiet]', env: true });
      S.set('ch4.imitationSprung');
    }
  },

  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.kind === 'offered' && phase === 'begin') {
      if (S.has('ch4.teaTaken')) return { ok: false, msg: 'Nothing else here.' };
      if (addToPouch(p, 'tea', 1)) return { ok: false, msg: 'Your pouch is full.' };
      S.set('ch4.teaTaken');
      game.fx('pickup', { pid: p.id, item: 'tea', n: 1 });
      game.setDoor('side', false); game.setDoor('mem', false);
      game.fx('sfx', { name: 'scrape', x: -3, z: 12.5 });
      game.fx('warning', { type: 'tenant', x: -3, z: 12.5, text: 'Both doors begin to scrape shut. Get out.', target: p.id });
      game.after(3 + (game.assists.reducedStartle ? 1 : 0), 'imitationTrap');
      return { ok: true };
    }
    if (it.id === 'mug' && phase === 'begin') { S.set('ch4.mugSeen'); game.fx('note', { pid: p.id, title: 'Yellow mug', text: 'A yellow ceramic mug. The handle is already broken off; the break is old and smooth.' }); checkMemory(game, p); return { ok: true }; }
    if (it.kind === 'npc' && phase === 'begin') {
      if (S.has('JUNE_SAFE')) return { ok: true, msg: 'June is safe in the boiler room.' };
      if (!S.has('ch4.juneSpoke')) { S.set('ch4.juneSpoke'); S.play('juneDoor'); game.fx('caption', { text: '[A folded page slides out under the door of 204]', env: true }); return { ok: true }; }
      const why = juneReady(game);
      if (why) { S.say('june', 'local', why); return { ok: true }; }
      if (S.has('ch4.juneWalking')) return { ok: true };
      S.set('ch4.juneWalking');
      S.play('juneReady');
      const n = game.npcs.find((x) => x.id === 'june');
      n.path = [{ x: 21, z: 30 }, { x: 18.9, z: 30 }, { x: 16.5, z: 30 }, { x: 12, z: 27 }, { x: 6.9, z: 27 }, { x: 5.1, z: 27 }, { x: 3, z: 27 }];
      return { ok: true };
    }
    if (it.id === 'cartPush' && phase === 'complete') {
      S.set('ch4.cartPlaced');
      game.propState = game.propState || {};
      game.propState.cart = { x: 17.5, z: 30.6, rot: 90 };
      game.setDoor('pass', true);
      game.fx('sfx', { name: 'doorOpen', x: 18, z: 30 });
      return { ok: true };
    }
    if (it.id === 't4switch' && phase === 'begin') {
      if (S.has('T4')) return { ok: true };
      S.set('T4');
      game.fx('network', { segment: 'T4' });
      game.fx('sfx', { name: 'relayClick', x: it.x, z: it.z });
      game.fx('caption', { text: '[Every intercom in the building goes silent]', env: true });
      S.play('t4Done');
      S.setObjective('lift', 'Take the utility elevator down.');
      game.requestCheckpoint('relay T4');
      return { ok: true };
    }
    if (it.id === 'lift4' && phase === 'begin') {
      if (!S.has('T4')) return { ok: false, msg: 'No power.' };
      game.beginTransition('lift', 5, { dur: 7 });
      return { ok: true };
    }
    if (it.id === 'returnLift' && phase === 'begin') { game.beginTransition('lift', 6, { entry: 'nexus', dur: 4 }); return { ok: true }; }
    return null;
  },

  onPickup() {},

  describe(game, p, it) {
    if (it.id === 'cartPush') return { name: 'Laundry cart', verb: 'Push it under the passage door', hold: 2 };
    if (it.kind === 'npc') return { name: 'June Ellis', verb: game.story.has('ch4.juneSpoke') ? 'Tell her the route is ready' : 'Knock and talk', hold: 0 };
    return null;
  },

  onNpcArrived(game, n) {
    if (n.id === 'june' && n.x < 6) {
      game.story.set('JUNE_SAFE');
      game.story.play('juneSafe');
      game.fx('profile', { kind: 'achievement', id: 'A13' });
    }
  },

  onPuzzle(game, pz) {
    const S = game.story;
    if (pz.id === 'P7') { S.addClue('P7.evan', 'A new envelope in the tray, addressed to Evan Ward, at an apartment number that did not exist.', 'observed'); S.setObjective('courtyard', 'Find a way into the apartments.'); game.makeCheckpoint('parcel gate open'); }
    if (pz.id === 'P8') { S.setObjective('laundry', 'Take the maintenance stair to the refuge.'); S.addClue('P8.photo', 'A picture appeared among Evan\'s: Evan arriving at a final chamber he has not reached yet.', 'observed'); game.requestCheckpoint('maintenance stair'); }
  },

  onRecord(game, p, id) { if (id === '23') { game.story.set('ch4.receiptSeen'); checkMemory(game, p); } },
};

function checkMemory(game, p) {
  const S = game.story;
  if (S.has('ch4.mugSeen') && S.has('ch4.receiptSeen') && !S.has('E3')) {
    S.play('memoryScene', { force: true });
    game.after(9, 'scene:memoryAfter');
    game.collectEvidence('E3', p);
    S.addClue('E3.answer', 'Private memory (E3): "Blue mug?" — "Yellow. The handle was already missing." — "You kept trying to glue it back on."', 'observed');
  }
}

function returnTrip(def) {
  const keep = new Set(['4.08']);
  const inRoom = (o) => def.rooms.some((r) => keep.has(r.id) && o.x >= r.x0 && o.x <= r.x0 + r.w && o.z >= r.z0 && o.z <= r.z0 + r.d);
  return {
    ...def,
    rooms: [...def.rooms.filter((r) => keep.has(r.id)), { id: 'R.04', name: 'Freight return landing', x0: 10, z0: 38, w: 4, d: 4, h: 3, surface: 'metal', kit: 'lift' }],
    doors: [{ id: 'ret', a: 'R.04', b: '4.08', type: 'arch', w: 2 }],
    props: def.props.filter(inRoom).filter((p) => p.id !== 'cart'), pickups: [], records: def.records.filter((r) => r.id === '23'), hidden: [], stations: [],
    puzzles: [], interactables: [def.interactables.find((i) => i.id === 'mug'), { id: 'returnLift', kind: 'lift', name: 'Freight return lift', verb: 'Return to the freight nexus', x: 12, y: 1.2, z: 41.4 }],
    wallDoors: [], director: null,
    start: { x: 12, z: 40, yaw: 0 },
  };
}

export default {
  id: 4,
  title: 'The Residents',
  kit: 'apartments',
  fog: { color: 0x2a1e14, density: 0.03 },
  hemi: 0.42,
  ambient: 'apartments',
  music: 'upstairsNeighbor',
  start: { x: 12, z: -18.5, yaw: Math.PI },
  replayKit: { flashlight: true, camera: true, pouch: [['battery', 1], ['firstaid', 1]] },
  rooms, doors, props, hidden, stations, puzzles, records, pickups, interactables, hints, navHints,
  wallDoors: [{ room: '4.08', side: 'N', pos: 0, label: 'Freight return lift (out of service)' }],
  director: { ambient: ['knock3', 'distantDoor', 'pipeKnock'] },
  script,
  returnTrip,
};
