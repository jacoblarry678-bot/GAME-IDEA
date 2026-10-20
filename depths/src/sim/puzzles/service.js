/**
 * Chapter five puzzles: P9 balance the service platform (two of four
 * counterweights) and E4 the medical telemetry pulse trace.
 */
import { Puzzle } from './base.js';

/** P9: fixed payload 110, balanced load 200, weights 15/25/40/65. Incorrect totals leave the brake engaged. */
export class WeightsPuzzle extends Puzzle {
  initial() { return { on: [] }; }
  total() { return this.def.payload + this.state.on.reduce((a, w) => a + w, 0); }
  act(p, act) {
    const s = this.state;
    if (act.startsWith('w:')) {
      const w = +act.slice(2);
      if (s.on.includes(w)) s.on = s.on.filter((x) => x !== w); else s.on.push(w);
      return { ok: true, msg: `${this.def.payload} + ${s.on.join(' + ') || '0'} = ${this.total()}`, sound: 'leverClunk' };
    }
    if (act === 'release') {
      if (this.total() === this.def.target) { this.complete(p); return { ok: true, msg: this.message, sound: 'success' }; }
      return { ok: false, msg: `BRAKE ENGAGED · indicated ${this.total()} ≠ ${this.def.target}`, sound: 'fault' };
    }
    return { ok: false };
  }
  view() {
    const s = this.state;
    const controls = this.def.weights.map((w) => ({ id: `w:${w}`, label: `${w}`, sub: s.on.includes(w) ? 'on the platform' : 'on the rail', state: s.on.includes(w) ? 'on' : 'off' }));
    controls.push({ id: 'release', label: 'BRAKE RELEASE', sub: 'requires a stable indication', wide: true, state: this.done ? 'on' : 'off' });
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: this.done ? 'PLATFORM RAISED · BRIDGE LOCKED' : `${this.def.payload} + ${s.on.join(' + ') || '0'} = ${this.total()}   (balanced load ${this.def.target})`, controls };
  }
}

/** E4: two channels. The direct sensor answers the TEST LIGHT in Lena's chamber; PRINT on it yields the pulse trace. */
export class TelemetryPuzzle extends Puzzle {
  initial() { return { channel: 'playback', lightAt: -99, printed: false }; }
  act(p, act) {
    const s = this.state, g = this.game;
    if (act === 'channel') { s.channel = s.channel === 'playback' ? 'direct' : 'playback'; return { ok: true, msg: s.channel === 'direct' ? 'DIRECT SENSOR selected.' : 'REFERENCE PLAYBACK selected.', sound: 'click' }; }
    if (act === 'test') { s.lightAt = g.time; g.fx('testLight', {}); return { ok: true, msg: s.channel === 'direct' ? 'TEST LIGHT. The trace jumps once, then settles.' : 'TEST LIGHT. The playback trace does not change: the same pattern every four beats.', sound: 'tone' }; }
    if (act === 'print') {
      if (s.channel !== 'direct') return { ok: false, msg: 'Printed: a repeating archive pattern. The machine\'s comparison reads: ARCHIVE. This is not a living signal.', sound: 'stationDone' };
      if (g.time - s.lightAt > 30) return { ok: false, msg: 'Printed: small natural variations, but no response marker. Press TEST LIGHT, then print.', sound: 'stationDone' };
      this.complete(p);
      return { ok: true, msg: this.message, sound: 'stationDone' };
    }
    return { ok: false };
  }
  view() {
    const s = this.state, g = this.game;
    const resp = s.channel === 'direct' && g.time - s.lightAt < 30 && s.lightAt > 0;
    const trace = s.channel === 'playback' ? '▁▃▁▇▁▃▁▇▁▃▁▇  (repeats every four beats)' : resp ? '▁▃▂▇▁▄▂█▇▁▃▂  ← TEST LIGHT response' : '▁▃▂▇▁▄▂▆▁▃▁▇  (small variations)';
    return {
      title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: `${s.channel === 'direct' ? 'DIRECT SENSOR' : 'REFERENCE PLAYBACK'} · ${trace}`,
      controls: [
        { id: 'channel', label: 'CHANNEL', sub: s.channel === 'direct' ? 'direct sensor' : 'reference playback', state: s.channel === 'direct' ? 'on' : 'off' },
        { id: 'test', label: 'TEST LIGHT', sub: 'Lena\'s chamber', state: 'off' },
        { id: 'print', label: 'PRINT', sub: 'pulse trace', state: this.done ? 'on' : 'off', wide: true },
      ],
    };
  }
}
