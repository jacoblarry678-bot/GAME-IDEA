/**
 * Equipment and supplies: flashlight charge, camera exposures, flash and
 * development timers, pouch stacks (film packs and chalk keep their own
 * remaining counts), item use with cancellation before the consumption
 * moment, decoys, chalk marks, wedges, composure, callouts, pings, hints.
 */
import { ITEMS, EQUIP, POUCH_SLOTS } from '../data/items.js';
import { evaluatePhoto, aimHint } from './photo.js';
import { applyPhotoClues, findTarget } from './interact.js';
import { CALLOUTS } from '../data/characters.js';

// ---------------------------------------------------------------- pouch
export function addToPouch(p, item, n, sub = null) {
  const I = ITEMS[item];
  if (!I) return n;
  let left = n;
  const unit = (k) => (sub ? sub[k] : item === 'film' ? 4 : item === 'chalk' ? I.marks : undefined);
  let k = 0;
  for (const s of p.pouch) {
    if (left <= 0) break;
    if (!s || s.item !== item || s.n >= I.stack) continue;
    while (s.n < I.stack && left > 0) { s.n++; if (s.sub) s.sub.push(unit(k)); k++; left--; }
  }
  for (let i = 0; i < p.pouch.length && left > 0; i++) {
    if (p.pouch[i]) continue;
    const s = { item, n: 0 };
    if (item === 'film' || item === 'chalk') s.sub = [];
    while (s.n < I.stack && left > 0) { s.n++; if (s.sub) s.sub.push(unit(k)); k++; left--; }
    p.pouch[i] = s;
  }
  return left;
}

function consume(p, slot) {
  const s = p.pouch[slot];
  if (!s) return;
  s.n--;
  if (s.sub) s.sub.shift();
  if (s.n <= 0) p.pouch[slot] = null;
}

function findSlot(p, item) { return p.pouch.findIndex((s) => s && s.item === item); }

// ---------------------------------------------------------------- per tick
export function updatePlayer(game, p, dt) {
  // flashlight drain: one point every nine seconds while on
  if (p.flashOn && p.hasFlashlight && p.charge > 0) {
    p.chargeAcc += dt;
    while (p.chargeAcc >= EQUIP.flashlightDrainEvery) { p.chargeAcc -= EQUIP.flashlightDrainEvery; p.charge = Math.max(0, p.charge - 1); }
  }
  if (p.breathing) {
    p.breathing.t += dt;
    p.composure = Math.min(100, p.composure + 2 * dt);
    if (p.breathing.t >= 5 || p.moving) p.breathing = null;
  }
  if (p.breatheCooldown > 0) p.breatheCooldown -= dt;
  updateComposure(game, p, dt);
}

function updateComposure(game, p, dt) {
  if (!p.alive) return;
  const L = game.level;
  // genuine refuge restores five points per second
  if (game.inRefugeVolume(p)) { p.composure = Math.min(100, p.composure + 5 * dt); p.exposure = 0; p.darkTime = 0; return; }
  // seeing an active creature within twelve metres: 2/s, capped at 20 per uninterrupted exposure
  let seeing = false;
  for (const c of game.enemies) {
    if (c.gone || !c.active || c.invisible) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d > 12) continue;
    if (!game.playerCanSeePoint(p, c.x, c.y + 1.2, c.z)) continue;
    seeing = true; break;
  }
  if (seeing) {
    if (p.exposure < 20) { const take = Math.min(2 * dt, 20 - p.exposure); p.exposure += take; p.composure = Math.max(0, p.composure - take); }
  } else p.exposure = 0;
  // complete darkness outside a refuge for more than thirty seconds
  const room = L.room(p.room);
  const lit = (p.flashOn && p.hasFlashlight && p.charge > 0) || !room || (room.light !== 'dark' && !game.story.has(`dark.${room.id}`));
  if (!lit) {
    p.darkTime += dt;
    if (p.darkTime > 30) { p.darkAcc = (p.darkAcc || 0) + dt; if (p.darkAcc >= 5) { p.darkAcc -= 5; p.composure = Math.max(0, p.composure - 1); } }
  } else { p.darkTime = 0; p.darkAcc = 0; }
}

// ---------------------------------------------------------------- tools
export function equip(game, p, tool) {
  if (p.downed || p.hidden) return false;
  if (tool === 'flashlight' && !p.hasFlashlight) return false;
  if (tool === 'camera' && !p.hasCamera) return false;
  if (tool === 'supply') {
    if (!p.pouch[p.selected]) { const i = p.pouch.findIndex(Boolean); if (i < 0) { game.fx('message', { pid: p.id, text: 'Your pouch is empty.' }); return false; } p.selected = i; }
  }
  if (p.action && p.action.kind === 'item') return false;
  p.tool = tool;
  game.fx('equip', { pid: p.id, tool });
  return true;
}

export function toggleFlashlight(game, p) {
  if (!p.hasFlashlight || p.downed) return false;
  p.flashOn = !p.flashOn;
  game.fx('sfx', { name: 'flashClick', pid: p.id });
  game.fx('flashlight', { pid: p.id, on: p.flashOn });
  return p.flashOn;
}

export function toggleCameraFlash(game, p) {
  if (!p.hasCamera) return false;
  p.cameraFlash = !p.cameraFlash;
  game.fx('cameraFlashMode', { pid: p.id, on: p.cameraFlash });
  return p.cameraFlash;
}

export function useTool(game, p) {
  if (p.downed || p.hidden || p.spectating) return null;
  switch (p.tool) {
    case 'flashlight': return toggleFlashlight(game, p);
    case 'camera': return takePhoto(game, p);
    case 'radio': {
      const S = game.story;
      game.fx('radioReplay', { pid: p.id, objective: S.objective.text, radio: S.radio ? S.radio.text : null, last: S.lastLine });
      return true;
    }
    case 'supply': return pouchAction(game, p, p.selected, 'use');
    default: return null;
  }
}

export function reload(game, p) {
  if (p.downed || p.hidden) return null;
  if (p.tool === 'flashlight') {
    const i = findSlot(p, 'battery');
    if (i < 0) { game.fx('message', { pid: p.id, text: 'No battery cells.' }); return false; }
    return pouchAction(game, p, i, 'use');
  }
  if (p.tool === 'camera') {
    const i = findSlot(p, 'film');
    if (i < 0) { game.fx('message', { pid: p.id, text: 'No film packs.' }); return false; }
    return pouchAction(game, p, i, 'use');
  }
  return null;
}

// ---------------------------------------------------------------- camera
export function cameraAimHint(game, p) {
  if (!p.hasCamera || p.tool !== 'camera') return null;
  const e = p.eye();
  return aimHint(game, { x: e.x, y: e.y, z: e.z, yaw: p.yaw, pitch: p.pitch });
}

export function takePhoto(game, p, opts = {}) {
  if (!p.hasCamera) return { ok: false };
  if (p.tool !== 'camera') equip(game, p, 'camera');
  if (game.time < p.developUntil) { game.fx('message', { pid: p.id, text: 'The last photograph is still developing.' }); return { ok: false, reason: 'developing' }; }
  if (p.film <= 0) { game.fx('message', { pid: p.id, text: 'No exposures left. Reload a film pack, or use a Survey Station.' }); return { ok: false, reason: 'film' }; }
  const flash = p.cameraFlash;
  if (flash && game.time < p.flashReadyAt) { game.fx('message', { pid: p.id, text: 'Flash charging.' }); return { ok: false, reason: 'flash' }; }
  if (p.action && p.action.kind === 'item') return { ok: false };
  const e = p.eye();
  const cam = { x: e.x, y: e.y, z: e.z, yaw: p.yaw, pitch: p.pitch };
  if (!opts.force) {
    const hint = aimHint(game, cam);
    if (hint && !hint.ok && !(p.hintWarnedAt && game.time - p.hintWarnedAt < 3 && p.hintWarnedTarget === hint.target)) {
      p.hintWarnedAt = game.time; p.hintWarnedTarget = hint.target;
      game.fx('aimHint', { pid: p.id, text: hint.text + ' Press again to take it anyway.' });
      return { ok: false, reason: 'aim', hint };
    }
  }
  p.film--;
  game.stats.photos++;
  p.developUntil = game.time + EQUIP.develop;
  if (flash) {
    p.flashReadyAt = game.time + EQUIP.flashCharge + EQUIP.develop;
    game.emitSound({ x: p.x, z: p.z, r: EQUIP.flashSound, kind: 'flash', player: p.id });
    game.director.onFlash();
  }
  const photo = evaluatePhoto(game, cam, { id: `ph${game.photoSeq++}`, flash, by: p.id });
  game.photos.push(photo);
  if (flash) for (const c of game.enemies) if (photo.creatures.some((x) => x.id === c.id) && c.onFlash) c.onFlash(p, photo);
  game.fx('photoTaken', { pid: p.id, photo, develop: EQUIP.develop });
  game.fx('sfx', { name: 'shutter', pid: p.id });
  game.after(EQUIP.develop, 'photoDev', { pid: p.id, id: photo.id });
  applyPhotoClues(game, p, photo);
  return { ok: true, photo };
}

// ---------------------------------------------------------------- supplies
export function pouchAction(game, p, slot, action, arg) {
  const s = p.pouch[slot];
  if (!s) return { ok: false };
  const I = ITEMS[s.item];
  if (p.downed || p.hidden) return { ok: false };
  switch (action) {
    case 'equip': p.selected = slot; return { ok: equip(game, p, 'supply') };
    case 'drop': {
      const d = { id: `d${Math.floor(game.time * 1000)}_${slot}`, item: s.item, n: s.n, sub: s.sub ? s.sub.slice() : null, x: p.x - Math.sin(p.yaw) * 0.6, z: p.z - Math.cos(p.yaw) * 0.6 };
      game.dropped.push(d);
      p.pouch[slot] = null;
      game.fx('drop', { pid: p.id, item: d.item, n: d.n, x: d.x, z: d.z });
      return { ok: true };
    }
    case 'give': {
      const q = game.players.get(arg);
      if (!q || q === p || !q.active || Math.hypot(q.x - p.x, q.z - p.z) > 2) return { ok: false, msg: 'Give needs a teammate within two meters.' };
      const left = addToPouch(q, s.item, s.n, s.sub ? s.sub.slice() : null);
      const moved = s.n - left;
      if (!moved) { game.fx('message', { pid: p.id, text: `${q.name}'s pouch is full.` }); return { ok: false }; }
      s.n = left; if (s.sub) s.sub = s.sub.slice(moved);
      if (s.n <= 0) p.pouch[slot] = null;
      game.fx('give', { from: p.id, to: q.id, item: s.item, n: moved });
      return { ok: true };
    }
    case 'use': return useItem(game, p, slot, s, I);
    default: return { ok: false };
  }
}

function startItem(game, p, slot, dur, apply, extra = {}) {
  if (p.action) return { ok: false };
  const item = p.pouch[slot].item;
  p.action = {
    kind: 'item', item, slot, t: 0, dur, held: true, slows: true, ...extra,
    onDone: () => {
      if (!p.pouch[slot] || p.pouch[slot].item !== item) return;
      apply();
      p.recoverUntil = game.time + 0.3;
    },
  };
  game.fx('itemUse', { pid: p.id, item, dur });
  return { ok: true };
}

function useItem(game, p, slot, s, I) {
  const msg = (text) => { game.fx('message', { pid: p.id, text }); return { ok: false, msg: text }; };
  switch (s.item) {
    case 'bandage': case 'firstaid':
      if (p.health >= 100) return msg('Health is full.');
      return startItem(game, p, slot, I.use, () => { p.health = Math.min(100, p.health + I.health); consume(p, slot); game.fx('healed', { pid: p.id }); });
    case 'tea':
      if (p.composure >= 100) return msg('You are calm.');
      return startItem(game, p, slot, I.use, () => { p.composure = Math.min(100, p.composure + I.composure); consume(p, slot); });
    case 'battery':
      if (!p.hasFlashlight) return msg('You have no flashlight.');
      if (p.charge >= 100) return msg('The flashlight is fully charged.');
      return startItem(game, p, slot, I.use, () => { p.charge = Math.min(100, p.charge + I.charge); consume(p, slot); game.fx('sfx', { name: 'battery', pid: p.id }); });
    case 'film': {
      if (!p.hasCamera) return msg('You have no camera.');
      if (p.film >= EQUIP.filmMax) return msg('The camera is full.');
      return startItem(game, p, slot, I.use, () => {
        const st = p.pouch[slot];
        const inPack = st.sub[0];
        const move = Math.min(inPack, EQUIP.filmMax - p.film);
        p.film += move;
        st.sub[0] = inPack - move;
        if (st.sub[0] <= 0) consume(p, slot);
        game.fx('sfx', { name: 'filmLoad', pid: p.id });
        if (inPack - move > 0) game.fx('message', { pid: p.id, text: `${inPack - move} exposures left in the pack.` });
      });
    }
    case 'decoy': {
      return startItem(game, p, slot, I.use, () => {
        const e = p.eye(), f = p.forward();
        const dir = { x: f.x, y: Math.max(f.y, -0.2) + 0.25, z: f.z };
        const l = Math.hypot(dir.x, dir.y, dir.z);
        const hit = game.level.world.raycast(e.x, e.y, e.z, dir.x / l, dir.y / l, dir.z / l, 9, 'solid', 1);
        const dist = hit ? Math.max(0.5, hit.t - 0.4) : 8;
        let x = e.x + dir.x / l * dist, z = e.z + dir.z / l * dist;
        if (!game.level.roomAt(x, z)) { x = p.x; z = p.z; }
        const d = { id: `decoy${Math.floor(game.time * 100)}`, x, z, until: game.time + I.decoy.dur, acc: 1 };
        game.decoys.push(d);
        consume(p, slot);
        game.fx('decoy', { pid: p.id, x, z, dur: I.decoy.dur, id: d.id });
      });
    }
    case 'chalk': {
      const e = p.eye(), f = p.forward();
      const hit = game.level.world.raycast(e.x, e.y, e.z, f.x, f.y, f.z, 2.5, 'sight');
      if (!hit) return msg('Aim at a nearby wall or the floor to mark it.');
      return startItem(game, p, slot, I.use, () => {
        const st = p.pouch[slot];
        const m = { id: `m${game.marks.length + 1}`, x: e.x + f.x * (hit.t - 0.02), y: e.y + f.y * (hit.t - 0.02), z: e.z + f.z * (hit.t - 0.02), yaw: p.yaw, n: normalOf(hit, f), by: p.id };
        game.marks.push(m);
        st.sub[0]--;
        if (st.sub[0] <= 0) consume(p, slot);
        game.fx('chalk', { pid: p.id, mark: m });
      });
    }
    case 'wedge': {
      const t = findTarget(game, p);
      const d = t && t.kind === 'door' ? game.level.door(t.door) : null;
      if (!d || !d.T.wedge) return msg('Look at an ordinary hinged door to wedge it.');
      if (d.target > 0.5) return msg('Close the door first.');
      if (d.wedge) return msg('That door is already wedged.');
      return startItem(game, p, slot, I.use, () => { d.wedge = true; consume(p, slot); game.fx('wedge', { pid: p.id, door: d.id }); }, { x: d.x, z: d.z });
    }
    default: return { ok: false };
  }
}

function normalOf(hit, f) {
  const b = hit.box;
  // pick the face most opposed to the view direction
  const opts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let best = opts[0], bd = 2;
  for (const o of opts) { const d = o[0] * f.x + o[1] * f.y + o[2] * f.z; if (d < bd) { bd = d; best = o; } }
  void b;
  return best;
}

// ---------------------------------------------------------------- composure / comms
export function breathe(game, p) {
  if (p.breatheCooldown > 0) { game.fx('message', { pid: p.id, text: `Steady breathing available in ${Math.ceil(p.breatheCooldown)} s.` }); return false; }
  if (!p.hidden && !(p.crouched && nearCover(game, p))) { game.fx('message', { pid: p.id, text: 'Crouch in cover or hide to steady your breathing.' }); return false; }
  p.breathing = { t: 0 };
  p.breatheCooldown = 30;
  game.fx('breathe', { pid: p.id });
  return true;
}

export function nearCover(game, p) {
  const e = { x: p.x, y: p.y + 0.8, z: p.z };
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    const h = game.level.world.raycast(e.x, e.y, e.z, dx, 0, dz, 1.3, 'sight');
    if (h && h.box.tag === 'prop') return true;
  }
  return false;
}

export function callout(game, p, kind) {
  const c = CALLOUTS.find((x) => x.id === kind);
  if (!c || p.downed && kind !== 'help') { if (!c) return false; }
  game.emitSound({ x: p.x, z: p.z, r: 12, kind: 'callout', player: p.id });
  game.fx('callout', { pid: p.id, slot: p.slot, kind, text: c.text, x: p.x, z: p.z });
  p.callouts = p.callouts || {};
  p.callouts[kind] = true;
  return true;
}

export function ping(game, p, pos, label) {
  game.fx('ping', { pid: p.id, x: pos.x, y: pos.y, z: pos.z, label: label || 'Here', until: game.time + 8 });
  return true;
}

export function requestHint(game, p) {
  const H = game.chapterDef.hints || {};
  const obj = game.story.objective.id;
  const stages = H[obj];
  const stalled = game.time - game.lastProgressAt;
  const need = game.D.hintAfter;
  if (game.D.hint !== 'auto' && stalled < need) {
    game.fx('message', { pid: p.id, text: `A hint becomes available after ${Math.ceil(need - stalled)} more seconds without progress.` });
    return { ok: false, wait: Math.ceil(need - stalled) };
  }
  const v = game.story.vars;
  v.hintStage = v.hintStage || {};
  const stage = Math.min((v.hintStage[obj] || 0) + 1, stages ? stages.length : 1);
  v.hintStage[obj] = stage;
  const text = stages ? stages[stage - 1] : 'Follow the current objective in your journal. Rooms you have not entered are marked as open doorways on the map.';
  const nav = game.chapterDef.navHints ? game.chapterDef.navHints[obj] : null;
  game.fx('hint', { pid: p.id, text, stage, of: stages ? stages.length : 1, nav });
  return { ok: true, text, stage };
}

export function returnToSafe(game, p) {
  if (game.time - p.lastHitAt < 5) { game.fx('message', { pid: p.id, text: 'Not available within five seconds of taking damage.' }); return false; }
  const nav = game.level.nav;
  const i = nav.indexAt(p.x, p.z);
  if (i >= 0 && nav.walk[i]) { game.fx('message', { pid: p.id, text: 'You are on a valid floor.' }); return false; }
  const room = game.level.roomAt(p.x, p.z);
  const j = nav.nearest(p.x, p.z, (k) => !room || nav.room[k] === room.index, 10);
  if (j < 0) return false;
  const c = nav.center(j);
  p.x = c.x; p.z = c.z; p.y = nav.floorY[j]; p.vx = p.vz = p.vy = 0;
  game.fx('message', { pid: p.id, text: 'Returned to the last safe position.' });
  return true;
}

export { POUCH_SLOTS };
