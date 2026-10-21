/**
 * Expedition puzzle families that have no campaign twin: valve state and
 * sound routing. (Symbol sequence, address matching, safe path and
 * counterweights reuse the campaign puzzle classes with generated data.)
 */
import { Puzzle } from './base.js';

/** Three valves, each OPEN or CLOSED; SET checks them against the printed maintenance diagram. */
export class ValveStatePuzzle extends Puzzle {
  initial() { return { open: this.def.initial.slice() }; }
  act(p, act) {
    const s = this.state, d = this.def;
    if (act.startsWith('v:')) { const i = +act.slice(2); s.open[i] = !s.open[i]; return { ok: true, msg: `${d.labels[i]}: ${s.open[i] ? 'OPEN' : 'CLOSED'}`, sound: 'leverClunk' }; }
    if (act === 'set') {
      if (s.open.every((v, i) => v === d.target[i])) { this.complete(p); return { ok: true, msg: this.message, sound: 'success' }; }
      return { ok: false, msg: 'PRESSURE OUT OF RANGE. The valve states do not match the service diagram.', sound: 'fault' };
    }
    return { ok: false };
  }
  view() {
    const s = this.state, d = this.def;
    const controls = d.labels.map((l, i) => ({ id: `v:${i}`, label: l, sub: s.open[i] ? 'OPEN' : 'CLOSED', state: s.open[i] ? 'on' : 'off', kind: 'toggle' }));
    controls.push({ id: 'set', label: 'SET PRESSURE', wide: true, state: this.done ? 'on' : 'off' });
    return { title: this.title, done: this.done, message: this.message, instructions: d.instructions, display: this.done ? 'PRESSURE STABLE' : d.labels.map((l, i) => `${l} ${s.open[i] ? 'OPEN' : 'CLOSED'}`).join(' · '), controls };
  }
}

/** Four speaker zones and PLAY: exactly the zone the diagram marks must be live. */
export class ZoneRoutingPuzzle extends Puzzle {
  initial() { return { on: [true, false, false, false], playing: 0 }; }
  act(p, act) {
    const s = this.state, d = this.def;
    if (act.startsWith('z:')) {
      if (s.playing > 0) return { ok: false, msg: 'Wait for the tone to finish.' };
      const i = +act.slice(2); s.on[i] = !s.on[i];
      this.game.fx('zoneTest', { zone: d.zones[i], on: s.on[i] });
      return { ok: true, msg: `${d.zones[i]}: ${s.on[i] ? 'live' : 'muted'}`, sound: 'tone' };
    }
    if (act === 'play') {
      if (s.playing > 0) return { ok: false, msg: 'Playing.' };
      s.playing = 4;
      this.pending = s.on.every((v, i) => v === (i === d.target));
      return { ok: true, msg: 'Routing test tone…', sound: 'tone' };
    }
    return { ok: false };
  }
  update(dt) {
    const s = this.state;
    if (s.playing > 0) {
      s.playing -= dt;
      if (s.playing <= 0) {
        s.playing = 0;
        if (this.pending && !this.done) this.complete(this.game.players.get(this.reservedBy) || null);
        else if (!this.done) { this.message = 'The tone reaches the wrong zones. Nothing moves.'; this.game.fx('puzzle', { id: this.id, ok: false, msg: this.message }); }
      }
    }
  }
  view() {
    const s = this.state, d = this.def;
    const controls = d.zones.map((z, i) => ({ id: `z:${i}`, label: z, sub: s.on[i] ? 'live' : 'muted', state: s.on[i] ? 'on' : 'off', kind: 'toggle' }));
    controls.push({ id: 'play', label: 'PLAY TEST TONE', wide: true, state: s.playing > 0 ? 'on' : 'off' });
    return { title: this.title, done: this.done, message: this.message, instructions: d.instructions, display: this.done ? 'ROUTE CLEAR' : s.playing > 0 ? 'PLAYING' : `LIVE: ${d.zones.filter((z, i) => s.on[i]).join(' · ') || 'NONE'}`, controls };
  }
}
