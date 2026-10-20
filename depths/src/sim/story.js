/**
 * Story state: flags, script variables, mandatory scenes (once per campaign
 * state), the dialogue queue, the journal objective (observed facts) kept
 * separate from the Operator's radio claims, clues and notes.
 */
import { SCENES, lineDuration } from '../data/dialogue.js';

export class Story {
  constructor(game) {
    this.game = game;
    this.flags = {};
    this.vars = {};
    this.scenes = {};
    this.objective = { id: '', text: '' };
    this.objectiveAt = 0;
    this.radio = null;
    this.clues = {};
    this.notes = {};
    this.queue = [];
    this.current = null;
    this.gap = 0;
    this.lastLine = null;
  }

  has(f) { return !!this.flags[f]; }
  set(f, v = true) {
    if (this.flags[f] === v) return;
    this.flags[f] = v;
    this.game._onFlag(f, v);
  }

  /** Play a scene once per campaign state. Returns false if already played. */
  play(id, { force = false, front = false } = {}) {
    if (!force && this.scenes[id]) return false;
    const beats = SCENES[id];
    if (!beats) return false;
    this.scenes[id] = true;
    const list = beats.filter((b) => this._cond(b.if)).map((b) => ({ ...b, scene: id }));
    if (front) this.queue.unshift(...list); else this.queue.push(...list);
    return true;
  }

  /** One-off line not tied to a scene (e.g. June's breathing count). */
  say(sp, src, text, opts = {}) { this.queue.push({ sp, src, text, ...opts }); }

  _cond(c) {
    if (!c) return true;
    const g = this.game;
    const party = g.activeCount();
    let m = /^party>=(\d)$/.exec(c);
    if (m) return party >= +m[1];
    m = /^party==(\d)$/.exec(c);
    if (m) return party === +m[1];
    if (c.startsWith('flag:')) return this.has(c.slice(5));
    if (c.startsWith('!flag:')) return !this.has(c.slice(6));
    // character present in the party
    return [...g.players.values()].some((p) => p.slot === c && p.active);
  }

  get busy() { return !!this.current || this.queue.length > 0; }

  update(dt) {
    if (this.current) {
      this.current.t += dt;
      if (this.current.t >= this.current.dur) { this.current = null; this.gap = 0.3; }
      return;
    }
    if (this.gap > 0) { this.gap -= dt; return; }
    const b = this.queue.shift();
    if (!b) return;
    if (b.wait) { this.current = { t: 0, dur: b.wait, wait: true }; return; }
    if (b.sfx) { this.game.fx('sfx', { name: b.sfx }); this.current = { t: 0, dur: 0.6, wait: true }; return; }
    let text = b.text;
    if (text === '{breathing}') {
      const n = this.game.activeCount();
      text = n <= 1 ? 'I can hear one person breathing.' : `I can hear ${['', 'one', 'two', 'three', 'four'][n]} people breathing.`;
    }
    const dur = b.dur || lineDuration(text);
    this.current = { t: 0, dur, sp: b.sp, src: b.src, text, scene: b.scene };
    this.lastLine = { sp: b.sp, src: b.src, text };
    this.game.fx('line', { sp: b.sp, src: b.src, text, dur, scene: b.scene });
  }

  setObjective(id, text) {
    if (this.objective.id === id) return;
    this.objective = { id, text };
    this.objectiveAt = this.game.time;
    this.game.progress();
    this.game.fx('objective', { id, text });
  }

  /** What the Operator claims over the radio. Never replaces the journal objective. */
  setRadio(text) {
    this.radio = text ? { text } : null;
    this.game.fx('radioClaim', { text });
  }

  addClue(id, text, source = 'observed') {
    if (this.clues[id]) return false;
    this.clues[id] = { text, source, t: this.game.time, ch: this.game.chapterId };
    this.game.progress();
    this.game.fx('clue', { id, text, source });
    return true;
  }

  serialize() {
    return { flags: { ...this.flags }, vars: JSON.parse(JSON.stringify(this.vars)), scenes: { ...this.scenes }, objective: { ...this.objective }, radio: this.radio, clues: JSON.parse(JSON.stringify(this.clues)), notes: { ...this.notes } };
  }
  restore(s) {
    this.flags = { ...s.flags };
    this.vars = JSON.parse(JSON.stringify(s.vars || {}));
    this.scenes = { ...s.scenes };
    this.objective = { ...s.objective };
    this.radio = s.radio || null;
    this.clues = JSON.parse(JSON.stringify(s.clues || {}));
    this.notes = { ...(s.notes || {}) };
    this.queue = []; this.current = null; this.gap = 0;
  }
}
