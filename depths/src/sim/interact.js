/**
 * Interactions: targeting, prompts (plain name, action, hold time) and the
 * timed player actions behind them. Doors open quietly on a 1.4 s hold or
 * fast (and loud) on a 0.45 s press. Every interaction is serialisable as
 * begin/end calls so co-op guests send the same requests the host validates.
 */
import { ITEMS } from '../data/items.js';
import { addToPouch } from './equipment.js';
import { evaluatePhoto } from './photo.js';
import { EQUIP } from '../data/items.js';

const AIM_COS = Math.cos(28 * Math.PI / 180);

export function available(game, it) {
  const S = game.story;
  if (it.requires && ![].concat(it.requires).every((f) => S.has(f))) return false;
  if (it.hideAfter && S.has(it.hideAfter)) return false;
  if (it.chapterReq && game.returnTrip && !it.onReturn) return false;
  if (it.kind === 'pickup') { const st = game.pickups[it.id]; if (!st || st.taken || st.qty <= 0) return false; }
  if (it.kind === 'dropped') return true;
  if (it.once && S.has(`used.${it.id}`)) return false;
  return true;
}

/** Interactables plus dropped items and downed teammates, as one list. */
function candidates(game) {
  const list = game.level.interactables.slice();
  for (const d of game.dropped) list.push({ id: `drop:${d.id}`, kind: 'dropped', x: d.x, y: 0.25, z: d.z, drop: d, reach: 1.8 });
  for (const p of game.players.values()) if (p.downed) list.push({ id: `revive:${p.id}`, kind: 'revive', x: p.x, y: 0.4, z: p.z, target: p.id, reach: 2.0 });
  return list;
}

export function findTarget(game, p) {
  if (p.hidden) { return game.level.interById.get(p.hidden) || null; }
  if (!p.alive && !p.downed) return null;
  const e = p.eye(), f = p.forward();
  let best = null, bestScore = Infinity;
  for (const it of candidates(game)) {
    if (it.kind === 'clock' && !it.pressable) continue;
    if (it.noTarget) continue;
    if (!available(game, it)) continue;
    const dx = it.x - e.x, dy = (it.y ?? 1) - e.y, dz = it.z - e.z;
    const d = Math.hypot(dx, dy, dz);
    const reach = it.reach || 1.8;
    if (d > reach + 0.35) continue;
    const flat = Math.hypot(dx, dz);
    if (flat > reach) continue;
    const cos = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
    if (cos < (d < 0.8 ? 0.4 : AIM_COS)) continue;
    // unobstructed view (ignore whatever the object itself is mounted in)
    const hit = game.level.world.raycast(e.x, e.y, e.z, dx / d, dy / d, dz / d, d, 'sight');
    if (hit && hit.t < d - 0.45 && !(hit.box.door && it.kind === 'door' && hit.box.door.id === it.door)) continue;
    const score = (1 - cos) * 4 + d * 0.15;
    if (score < bestScore) { bestScore = score; best = it; }
  }
  return best;
}

/** Prompt description: { name, verb, hold, locked?, note? } */
export function describe(game, p, it) {
  if (!it) return null;
  const L = game.level;
  switch (it.kind) {
    case 'door': {
      const d = L.door(it.door);
      const open = d.target > 0.5;
      if (game.isDoorLocked(d)) {
        if (d.unlockFrom && p.room === d.unlockFrom) return { name: d.label, verb: 'Unlock', hold: 0 };
        return { name: d.label, verb: 'Locked', hold: 0, locked: d.lockText || 'Locked.' };
      }
      if (d.T.auto) return { name: d.label, verb: d.sealedText ? 'Sealed' : 'Operated elsewhere', hold: 0, locked: d.sealedText || 'Controlled from a panel.' };
      return { name: d.label, verb: open ? 'Close' : 'Open', hold: 1.4, tap: 0.45, note: 'Hold to move it quietly. Press to move it fast and loud.' };
    }
    case 'pickup': {
      if (it.tool) return { name: it.name || it.tool, verb: 'Take', hold: 0 };
      const I = ITEMS[it.item];
      const q = game.pickups[it.id].qty;
      return { name: `${I.name}${q > 1 ? ` ×${q}` : ''}`, verb: 'Take', hold: 0 };
    }
    case 'dropped': { const I = ITEMS[it.drop.item]; return { name: `${it.drop.label || I.name}${it.drop.n > 1 ? ` ×${it.drop.n}` : ''}`, verb: 'Take', hold: 0 }; }
    case 'record': return { name: game.persist.records[it.record] ? `${it.title || 'Record'} (collected copy)` : (it.title || 'Record'), verb: 'Read', hold: 0 };
    case 'station': return { name: 'Survey Station', verb: 'Run diagnostic image', hold: EQUIP.stationHold, note: 'Makes noise. Uses no film.' };
    case 'panel': { const pz = game.puzzles.get(it.puzzle); return { name: (pz && pz.title) || it.name || 'Panel', verb: pz && pz.done ? 'Inspect' : 'Inspect', hold: 0 }; }
    case 'clock': return { name: 'Wall clock', verb: 'Watch the second hand', hold: 0 };
    case 'cabinet': return { name: 'Supply cabinet', verb: 'Check', hold: 0 };
    case 'charger': return { name: 'Service charger', verb: 'Charge flashlights', hold: 0 };
    case 'mapboard': return { name: 'Map board', verb: 'Map and save', hold: 0 };
    case 'deck': return { name: 'Cassette deck', verb: 'Replay recordings', hold: 0 };
    case 'locker': return p.hidden ? { name: 'Locker', verb: 'Exit', hold: 0 } : { name: 'Locker', verb: 'Hide', hold: 0 };
    case 'revive': { const t = game.players.get(it.target); return { name: t ? t.name : 'Teammate', verb: 'Revive', hold: 6 }; }
    case 'offered': return { name: it.name || 'Calming tea', verb: 'Take', hold: 0 };
    default: {
      const custom = game.script.describe ? game.script.describe(game, p, it) : null;
      if (custom) return custom;
      return { name: it.name || it.kind, verb: it.verb || 'Use', hold: it.hold || 0 };
    }
  }
}

export function cancelAction(game, p) {
  if (!p.action) return;
  const a = p.action;
  p.action = null;
  if (a.onCancel) a.onCancel();
  game.fx('actionCancel', { pid: p.id, kind: a.kind });
}

export function endInteract(game, p) {
  if (p.action) p.action.held = false;
}

/** Start an interaction with interactable `id` (or the current target when id is null). */
export function beginInteract(game, p, id, opts = {}) {
  if (p.action) {
    if (opts.toggle) cancelAction(game, p);
    return null;
  }
  if (p.spectating) return null;
  let it = id ? (game.level.interById.get(id) || candidates(game).find((c) => c.id === id)) : findTarget(game, p);
  if (!it) return null;
  if (!available(game, it)) return null;
  // range validation (host-side check for guests)
  const reach = (it.reach || 1.8) + 0.8;
  if (Math.hypot(it.x - p.x, it.z - p.z) > reach && !p.hidden) return { ok: false, msg: 'Too far.' };
  if (p.downed && it.kind !== 'revive') return { ok: false, msg: 'You cannot do that while down.' };
  const S = game.script;
  if (S.onInteract) {
    const r = S.onInteract(game, p, it, 'begin', opts);
    if (r) return r;
  }
  switch (it.kind) {
    case 'door': return doorBegin(game, p, it, opts);
    case 'pickup': return takePickup(game, p, it);
    case 'dropped': return takeDropped(game, p, it);
    case 'record': {
      const first = game.collectRecord(p, it.record);
      return { ok: true, record: it.record, first };
    }
    case 'station': return stationBegin(game, p, it);
    case 'panel': {
      const pz = game.puzzles.get(it.puzzle);
      if (!pz) return null;
      if (!pz.canUse(p)) return { ok: false, msg: 'Another crew member is using this panel. You can watch it.' , observe: it.puzzle };
      pz.open(p);
      game.fx('panel', { pid: p.id, puzzle: it.puzzle });
      if (pz.onOpen) pz.onOpen(p);
      return { ok: true, panel: it.puzzle };
    }
    case 'clock': return { ok: true, msg: 'Watch the second hand for three seconds.' };
    case 'cabinet': {
      if (game.partyHasHealing()) return msg(game, p, 'The cabinet restocks only when the crew carries no healing supplies.');
      const left = addToPouch(p, 'bandage', 1);
      if (left) return msg(game, p, 'Your pouch is full.');
      game.fx('sfx', { name: 'cabinet', x: it.x, z: it.z });
      return msg(game, p, 'Bandage taken from the supply cabinet.');
    }
    case 'charger': {
      let n = 0;
      for (const q of game.players.values()) if (q.room === it.room && q.hasFlashlight && q.charge < 30) { q.charge = 30; n++; }
      game.fx('sfx', { name: 'charger', x: it.x, z: it.z });
      return msg(game, p, n ? 'Flashlights charged to at least thirty.' : 'Every flashlight here is already above thirty.');
    }
    case 'mapboard': game.fx('mapboard', { pid: p.id, room: it.room }); return { ok: true };
    case 'deck': game.fx('deck', { pid: p.id }); return { ok: true };
    case 'locker': return p.hidden ? exitLocker(game, p) : enterLocker(game, p, it);
    case 'revive': {
      const t = game.players.get(it.target);
      if (!t || !t.downed) return null;
      p.action = { kind: 'revive', t: 0, dur: 6, held: true, needHold: true, x: it.x, z: it.z, onDone: () => game.revive(p, t), slows: true };
      return { ok: true };
    }
    case 'note': {
      game.story.notes[it.id] = true;
      if (it.clue) game.story.addClue(it.clue, it.clueText || it.text, 'note');
      game.fx('note', { pid: p.id, id: it.id, title: it.title, text: it.text });
      return { ok: true };
    }
    default:
      if (it.hold) {
        p.action = { kind: 'hold', t: 0, dur: it.hold, held: true, needHold: true, x: it.x, z: it.z, it, onDone: () => { if (S.onInteract) S.onInteract(game, p, it, 'complete'); } };
        return { ok: true };
      }
      return null;
  }
}

function msg(game, p, text) { game.fx('message', { pid: p.id, text }); return { ok: true, msg: text }; }

function doorBegin(game, p, it, opts) {
  const d = game.level.door(it.door);
  if (game.isDoorLocked(d)) {
    if (d.unlockFrom && p.room === d.unlockFrom) {
      game.story.set(`door.${d.id}.unlocked`);
      game.fx('sfx', { name: 'unlock', x: d.x, z: d.z });
    } else {
      game.fx('sfx', { name: 'lockedHandle', x: d.x, z: d.z });
      return msg(game, p, d.lockText || 'Locked.');
    }
  }
  if (d.T.auto) return msg(game, p, d.sealedText || 'This is controlled from a panel.');
  const opening = d.target < 0.5;
  if (!opening && d.type === 'refuge') {
    // never close a refuge door on an occupied threshold
    for (const q of game.players.values()) {
      if (q === p || !q.active) continue;
      const along = d.axis === 'x' ? Math.abs(q.x - d.bnd) : Math.abs(q.z - d.bnd);
      const lat = d.axis === 'x' ? Math.abs(q.z - d.c) : Math.abs(q.x - d.c);
      if (along < 0.7 && lat < d.w / 2 + 0.3) return msg(game, p, 'Someone is standing in the doorway.');
    }
  }
  p.action = {
    kind: 'door', t: 0, held: true, mode: opts.fast || p.sprinting ? 'fast' : 'pending', door: d, opening, x: d.x, z: d.z,
  };
  return { ok: true };
}

function finishDoor(game, p, a) {
  const d = a.door;
  const fast = a.mode === 'fast';
  game.setDoor(d.id, a.opening, { fast });
  if (!a.opening && d.wedge) d.wedge = null;
  game.emitSound({ x: d.x, z: d.z, r: fast ? (a.opening ? 9 : 11) : 2, kind: fast ? 'doorFast' : 'doorQuiet', player: p.id });
  game.fx('sfx', { name: fast ? (a.opening ? 'doorFast' : 'doorSlam') : (a.opening ? 'doorOpen' : 'doorClose'), x: d.x, z: d.z });
  if (game.script.onDoor) game.script.onDoor(game, p, d, a.opening);
}

function takePickup(game, p, it) {
  const st = game.pickups[it.id];
  if (it.tool) {
    for (const q of game.players.values()) {
      if (it.tool === 'flashlight') { q.hasFlashlight = true; if (!q.flashOn) q.flashOn = true; q.tool = 'flashlight'; }
      if (it.tool === 'camera') { q.hasCamera = true; }
    }
    st.taken = true; st.qty = 0;
    game.fx('toolGained', { tool: it.tool, pid: p.id });
    game.fx('sfx', { name: 'pickup', x: it.x, z: it.z });
    if (game.script.onPickup) game.script.onPickup(game, p, it);
    game.progress();
    return { ok: true };
  }
  const left = addToPouch(p, it.item, st.qty);
  const took = st.qty - left;
  if (!took) return msg(game, p, 'Your pouch is full.');
  st.qty = left;
  if (st.qty <= 0) st.taken = true;
  game.fx('pickup', { pid: p.id, item: it.item, n: took, left });
  game.fx('sfx', { name: 'pickup', x: it.x, z: it.z });
  if (game.script.onPickup) game.script.onPickup(game, p, it);
  return { ok: true, took };
}

function takeDropped(game, p, it) {
  const d = it.drop;
  const left = addToPouch(p, d.item, d.n, d.sub);
  const took = d.n - left;
  if (!took) return msg(game, p, 'Your pouch is full.');
  if (left <= 0) game.dropped = game.dropped.filter((x) => x !== d);
  else { d.n = left; if (d.sub) d.sub = d.sub.slice(took); }
  game.fx('pickup', { pid: p.id, item: d.item, n: took, left });
  return { ok: true };
}

function stationBegin(game, p, it) {
  const st = game.level.stations.find((s) => s.id === it.station);
  game.emitSound({ x: it.x, z: it.z, r: EQUIP.stationNoise, kind: 'station', player: p.id });
  game.fx('sfx', { name: 'stationStart', x: it.x, z: it.z });
  p.action = {
    kind: 'station', t: 0, dur: EQUIP.stationHold, held: true, needHold: true, x: it.x, z: it.z, slows: true,
    onDone: () => {
      game.emitSound({ x: it.x, z: it.z, r: EQUIP.stationNoise, kind: 'station', player: p.id });
      const photo = evaluatePhoto(game, st.cam, { id: `ph${game.photoSeq++}`, source: 'station', by: p.id });
      photo.station = st.id;
      game.photos.push(photo);
      game.fx('photoTaken', { pid: p.id, photo, station: st.id, develop: 0 });
      game.fx('photoDeveloped', { pid: p.id, id: photo.id });
      applyPhotoClues(game, p, photo);
      if (st.puzzle) { const pz = game.puzzles.get(st.puzzle); if (pz && !pz.done) pz.usedStation = true; }
    },
  };
  return { ok: true };
}

/** Turn a photo's captured targets into journal clues and story flags. */
export function applyPhotoClues(game, p, photo) {
  for (const id of photo.targets) {
    const t = game.level.hiddenById.get(id);
    if (!t) continue;
    if (t.clue) {
      const added = game.story.addClue(t.clue, t.clueText || t.text, photo.source === 'station' ? 'station' : 'photo');
      if (added && photo.source === 'station') game.story.set(`${t.clue}.viaStation`);
      game.story.set(t.clue);
    }
    if (t.secret && !game.persist.secrets[t.secret]) {
      game.persist.secrets[t.secret] = true;
      game.fx('profile', { kind: 'secret', id: t.secret });
      game.fx('message', { pid: p ? p.id : null, text: 'Secret photograph captured.' });
    }
    if (t.onPhoto) game.story.set(t.onPhoto);
  }
  if (game.script.onPhoto) game.script.onPhoto(game, p, photo);
}

export function enterLocker(game, p, it) {
  // was the entry witnessed by a creature that is hunting?
  let witnessed = false;
  for (const c of game.enemies) {
    if (c.gone || !c.active) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < 14 && c.lineTo(p)) { witnessed = true; break; }
  }
  p.hidden = it.id;
  p.hiddenWitnessed = witnessed;
  p.preHide = { x: p.x, z: p.z };
  const o = faceOffset(it.face);
  p.x = it.x; p.z = it.z; p.vx = p.vz = 0;
  p.yaw = Math.atan2(-o.x, -o.z);
  p.lockerFace = it.face;
  game.emitSound({ x: p.x, z: p.z, r: 2, kind: 'locker', player: p.id });
  game.fx('locker', { pid: p.id, enter: true, witnessed });
  return { ok: true };
}

export function exitLocker(game, p, forced = false) {
  if (!p.hidden) return null;
  const it = game.level.interById.get(p.hidden);
  const o = faceOffset(it ? it.face : 'S');
  p.x = (it ? it.x : p.x) + o.x * 0.75; p.z = (it ? it.z : p.z) + o.z * 0.75;
  p.hidden = null; p.hiddenWitnessed = false;
  game.fx('locker', { pid: p.id, enter: false, forced });
  return { ok: true };
}

function faceOffset(face) {
  switch (face) { case 'N': return { x: 0, z: 1 }; case 'S': return { x: 0, z: -1 }; case 'E': return { x: 1, z: 0 }; case 'W': return { x: -1, z: 0 }; default: return { x: 0, z: -1 }; }
}

/** Advance the player's current timed action. */
export function updateAction(game, p, dt) {
  const a = p.action;
  if (!a) return;
  a.t += dt;
  // walking away cancels anything tied to a place
  if (a.x !== undefined && Math.hypot(a.x - p.x, a.z - p.z) > (a.range || 2.6)) { cancelAction(game, p); return; }
  if (a.kind === 'door') {
    if (a.mode === 'pending') {
      if (!a.held && a.t < 0.25) a.mode = 'fast';
      else if (a.t >= 0.25) a.mode = 'quiet';
    }
    if (a.mode === 'fast' && a.t >= 0.45) { p.action = null; finishDoor(game, p, a); return; }
    if (a.mode === 'quiet') {
      if (!a.held) { cancelAction(game, p); return; }
      if (a.t >= 1.4) { p.action = null; finishDoor(game, p, a); }
    }
    return;
  }
  if (a.needHold && !a.held) { cancelAction(game, p); return; }
  if (a.tick) a.tick(dt);
  if (a.dur !== undefined && a.t >= a.dur) {
    p.action = null;
    if (a.onDone) a.onDone();
    game.fx('actionDone', { pid: p.id, kind: a.kind });
  }
}
