/**
 * Chapter four puzzles: P7 sort the resident mail (envelope to mailbox) and
 * P8 arrange the remembered rooms (picture to labelled mount).
 */
import { Puzzle } from './base.js';

/** P7: three envelopes, named mailboxes. A wrong box returns the letter with ADDRESS MISMATCH and no chase. */
export class MailPuzzle extends Puzzle {
  initial() { const o = { placed: {} }; for (const e of this.def.envelopes) o.placed[e.id] = null; return o; }
  act(p, act) {
    const [, env, box] = act.split(':');
    const E = this.def.envelopes.find((e) => e.id === env);
    if (!E || this.state.placed[env]) return { ok: false };
    if (box !== E.box) return { ok: false, msg: `ADDRESS MISMATCH. The ${E.name} envelope is returned.`, sound: 'click' };
    this.state.placed[env] = box;
    if (Object.values(this.state.placed).every(Boolean)) { this.complete(p); return { ok: true, msg: this.message, sound: 'success' }; }
    return { ok: true, msg: `${E.name} placed in ${box}.`, sound: 'pickup' };
  }
  view() {
    const controls = [];
    for (const e of this.def.envelopes) {
      const placed = this.state.placed[e.id];
      for (const b of this.def.boxes) controls.push({ id: `place:${e.id}:${b}`, label: `${e.name.toUpperCase()} → ${b}`, sub: placed === b ? 'placed' : '', state: placed === b ? 'on' : 'off', disabled: !!placed });
    }
    const display = this.done ? 'PARCEL GATE OPEN' : this.def.envelopes.map((e) => `${e.name}: ${this.state.placed[e.id] || '—'}`).join('   ');
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display, controls };
  }
}

/** P8: three picture frames on three mounts. The correct arrangement exposes the maintenance stair. */
export class FramesPuzzle extends Puzzle {
  initial() { return { mounts: [null, null, null] }; }
  act(p, act) {
    const s = this.state, F = this.def.frames;
    if (act.startsWith('mount:')) {
      const i = +act.slice(6);
      const order = [null, ...F.map((f) => f.id)];
      let k = order.indexOf(s.mounts[i]);
      // cycle to the next picture not already hung elsewhere
      for (let n = 0; n < order.length; n++) { k = (k + 1) % order.length; const id = order[k]; if (!id || !s.mounts.includes(id)) break; }
      s.mounts[i] = order[k];
      const filled = s.mounts.every(Boolean);
      if (filled) {
        if (s.mounts.every((id, j) => id === this.def.solution[j])) { this.complete(p); return { ok: true, msg: this.message, sound: 'success' }; }
        return { ok: false, msg: 'A short domestic sound somewhere in the flat: a cupboard closing. The hidden door stays shut.', sound: 'doorClose' };
      }
      return { ok: true, msg: s.mounts[i] ? `${F.find((f) => f.id === s.mounts[i]).name} hung on mount ${i + 1}.` : `Mount ${i + 1} cleared.`, sound: 'pickup' };
    }
    return { ok: false };
  }
  view() {
    const F = this.def.frames;
    const controls = this.state.mounts.map((m, i) => ({ id: `mount:${i}`, label: `MOUNT ${i + 1}`, sub: m ? F.find((f) => f.id === m).name : 'empty · press to hang', state: m ? 'on' : 'off', wide: true }));
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: this.done ? 'MAINTENANCE STAIR EXPOSED' : this.state.mounts.map((m, i) => `${i + 1}: ${m ? F.find((f) => f.id === m).name : '—'}`).join('   '), controls };
  }
}
