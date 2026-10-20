/**
 * Photograph evaluation. An exposure records hidden information at the
 * instant it is taken: a 65 degree cone out to twenty metres. It cannot see
 * through opaque walls; transparent glass is fine. A capture always yields
 * either useful information or a faithful normal photograph; it never
 * invents an answer unrelated to the photographed surface.
 */
import { EQUIP } from '../data/items.js';
import { angDiff } from './enemies/base.js';

const HALF_H = (EQUIP.photoCone / 2) * Math.PI / 180;
const ASPECT = 4 / 3;
const HALF_V = Math.atan(Math.tan(HALF_H) / ASPECT);

/** Angular test of a world point against a camera pose; returns {inFrame, h, v, dist}. */
export function project(cam, pt) {
  const dx = pt.x - cam.x, dy = pt.y - cam.y, dz = pt.z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  const yawTo = Math.atan2(-dx, -dz);
  const h = angDiff(yawTo, cam.yaw);
  const flat = Math.hypot(dx, dz);
  const pitchTo = Math.atan2(dy, flat);
  const v = pitchTo - cam.pitch;
  return { h, v, dist };
}

/**
 * Check one hidden target against a camera pose. Returns null when valid,
 * otherwise a reason: 'far' | 'frame' | 'blocked' | 'facing' | 'position'.
 */
export function checkTarget(game, cam, t) {
  const pt = { x: t.x + t.normal[0] * 0.06, y: t.y + t.normal[1] * 0.06, z: t.z + t.normal[2] * 0.06 };
  const pr = project(cam, pt);
  if (pr.dist > EQUIP.photoRange) return 'far';
  if (t.from) {
    const [fx, fz, fr] = t.from;
    if (Math.hypot(cam.x - fx, cam.z - fz) > fr) return 'position';
  }
  const size = Math.max(t.w || 1, t.h || 1);
  const ang = Math.atan2(size * 0.35, Math.max(0.5, pr.dist));
  if (Math.abs(pr.h) > HALF_H - ang * 0.6 || Math.abs(pr.v) > HALF_V - ang * 0.4) return 'frame';
  // facing: the photographed surface must face the camera
  if (!t.anyFacing) {
    const tx = cam.x - pt.x, ty = cam.y - pt.y, tz = cam.z - pt.z;
    const l = Math.hypot(tx, ty, tz) || 1;
    const dot = (tx * t.normal[0] + ty * t.normal[1] + tz * t.normal[2]) / l;
    if (dot < 0.12) return 'facing';
  }
  if (!game.level.world.clearLine(cam.x, cam.y, cam.z, pt.x, pt.y, pt.z)) return 'blocked';
  return null;
}

/** Evaluate an exposure. Returns the photo record (without image). */
export function evaluatePhoto(game, cam, opts = {}) {
  const L = game.level;
  const room = L.roomAt(cam.x, cam.z);
  const photo = {
    id: opts.id, t: game.time, ch: game.chapterId, room: room ? room.id : null, roomName: room ? room.name : '',
    cam: { x: cam.x, y: cam.y, z: cam.z, yaw: cam.yaw, pitch: cam.pitch }, flash: !!opts.flash, source: opts.source || 'camera',
    targets: [], creatures: [], text: [], secret: null, imitation: false, story: false, by: opts.by || null,
  };
  for (const t of L.hidden) {
    if (t.flag && !game.story.has(t.flag)) continue;
    if (t.until && game.story.has(t.until)) continue;
    if (checkTarget(game, cam, t)) continue;
    photo.targets.push(t.id);
    if (t.text) photo.text.push(t.text);
    if (t.secret) photo.secret = t.secret;
    if (t.imitation) photo.imitation = true;
    if (t.clue) photo.story = true;
  }
  // creatures at the instant of exposure
  for (const c of game.enemies) {
    if (c.gone || c.state === 'dormant') continue;
    const reveal = c.photoPoint ? c.photoPoint() : { x: c.x, y: c.y + 1.2, z: c.z };
    if (!reveal) continue;
    const pr = project(cam, reveal);
    if (pr.dist > EQUIP.photoRange || Math.abs(pr.h) > HALF_H || Math.abs(pr.v) > HALF_V) continue;
    if (!c.photoThroughWalls && !L.world.clearLine(cam.x, cam.y, cam.z, reveal.x, reveal.y, reveal.z)) continue;
    photo.creatures.push({ id: c.id, type: c.type, x: c.x, z: c.z, yaw: c.yaw, text: c.photoText ? c.photoText() : null });
    if (c.photoText) { const tx = c.photoText(); if (tx) photo.text.push(tx); }
  }
  if (!photo.text.length) photo.text.push(room ? `A faithful photograph of ${room.name.toLowerCase()}.` : 'A faithful photograph.');
  return photo;
}

/** Nearest unsatisfied quest target the camera is roughly aimed at, with the reason it is not yet valid. */
export function aimHint(game, cam) {
  let best = null, bestScore = Infinity;
  for (const t of game.level.hidden) {
    if (!t.quest || !t.clue) continue;
    if (game.story.clues[t.clue]) continue;
    if (t.flag && !game.story.has(t.flag)) continue;
    const pr = project(cam, t);
    if (pr.dist > 30) continue;
    if (Math.abs(pr.h) > 0.9 || Math.abs(pr.v) > 0.8) continue;
    const score = Math.abs(pr.h) + Math.abs(pr.v) * 0.5 + pr.dist * 0.02;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  if (!best) return null;
  const reason = checkTarget(game, cam, best);
  if (!reason) return { target: best.id, ok: true };
  const text = {
    far: 'Too far to record detail. Move within twenty meters.',
    frame: 'The marked area is not fully in frame.',
    blocked: 'Something is in the way.',
    facing: 'Face the marked surface.',
    position: 'This needs to be taken from the marked spot.',
  }[reason];
  return { target: best.id, ok: false, reason, text };
}
