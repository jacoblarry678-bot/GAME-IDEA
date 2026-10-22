/**
 * Campaign save slots. Each slot keeps an active snapshot and the previous
 * valid snapshot as a backup, both with a checksum. A write goes to a
 * temporary key first, is read back and verified, and only then replaces the
 * active snapshot, so an interrupted save leaves either the new valid
 * snapshot or the previous one. Refuges add three rotating manual saves.
 */
import { loadRaw, saveRaw, remove, checksum } from '../core/storage.js';
import { SAVE_VERSION } from '../sim/game.js';

export const SLOTS = 3;

function pack(snap) { const data = JSON.stringify(snap); return JSON.stringify({ v: SAVE_VERSION, sum: checksum(data), data }); }
function unpack(raw) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.data !== 'string' || checksum(o.data) !== o.sum) return null;
    return JSON.parse(o.data);
  } catch { return null; }
}

export class Saves {
  key(n, part) { return `slot${n}.${part}`; }

  /** Atomic write of a checkpoint snapshot. Returns true when committed. */
  write(n, snap, photos = null) {
    const packed = pack(snap);
    if (!saveRaw(this.key(n, 'tmp'), packed)) return false;
    if (!unpack(loadRaw(this.key(n, 'tmp')))) return false;
    const prev = loadRaw(this.key(n, 'active'));
    if (prev && unpack(prev)) { if (!saveRaw(this.key(n, 'backup'), prev)) return false; }
    if (!saveRaw(this.key(n, 'active'), packed)) return false;
    remove(this.key(n, 'tmp'));
    if (photos) saveRaw(this.key(n, 'photos'), JSON.stringify(photos));
    saveRaw(this.key(n, 'meta'), JSON.stringify(this.metaFrom(snap)));
    return true;
  }

  metaFrom(snap) {
    return { chapter: snap.chapter, difficulty: snap.difficulty, elapsed: snap.elapsed, updated: Date.now(), room: (snap.players[0] || {}).room || null, mode: snap.mode, game: snap.game || '1.0.0' };
  }

  /** Read the newest valid snapshot: active, else backup. */
  read(n) {
    const a = unpack(loadRaw(this.key(n, 'active')));
    if (a) return { snap: a, from: 'active' };
    const b = unpack(loadRaw(this.key(n, 'backup')));
    if (b) return { snap: b, from: 'backup' };
    return null;
  }

  photos(n) { try { return JSON.parse(loadRaw(this.key(n, 'photos')) || '{}'); } catch { return {}; } }

  meta(n) {
    let m = null;
    try { m = JSON.parse(loadRaw(this.key(n, 'meta')) || 'null'); } catch { m = null; }
    if (m) return m;
    const r = this.read(n);
    return r ? this.metaFrom(r.snap) : null;
  }

  manualSave(n, snap) {
    let idx = 0;
    try { idx = (JSON.parse(loadRaw(this.key(n, 'manualIdx')) || '0') + 1) % 3; } catch { idx = 0; }
    const ok = saveRaw(this.key(n, `manual${idx}`), pack(snap));
    if (ok) saveRaw(this.key(n, 'manualIdx'), JSON.stringify(idx));
    return ok ? idx : -1;
  }
  manual(n, i) { return unpack(loadRaw(this.key(n, `manual${i}`))); }
  manualMeta(n) { return [0, 1, 2].map((i) => { const s = this.manual(n, i); return s ? this.metaFrom(s) : null; }); }

  /** Pre-finale snapshot used by Continue after an ending. */
  writeFinale(n, snap) { return saveRaw(this.key(n, 'finale'), pack(snap)); }
  finale(n) { return unpack(loadRaw(this.key(n, 'finale'))); }

  /** Expedition suspend snapshot: written on quit (and at refuges), consumed when resumed. */
  writeSuspend(snap) { return saveRaw('expedition.suspend', pack(snap)); }
  suspend() { return unpack(loadRaw('expedition.suspend')); }
  clearSuspend() { remove('expedition.suspend'); }

  erase(n) { for (const p of ['active', 'backup', 'tmp', 'meta', 'photos', 'manual0', 'manual1', 'manual2', 'manualIdx', 'finale']) remove(this.key(n, p)); }

  lastSlot() { const v = loadRaw('lastSlot'); return v ? +v : null; }
  setLastSlot(n) { saveRaw('lastSlot', String(n)); }
}
