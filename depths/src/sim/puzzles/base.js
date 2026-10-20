/**
 * Puzzle framework. A puzzle owns its state, validates actions from any
 * player, and exposes a view model that the generic inspection panel UI
 * renders (labels, symbols and states; colour is always supplemental).
 * Panels are reserved to their current user for up to twenty seconds after
 * their last input; other players can observe.
 */
export class Puzzle {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.title = def.title || def.id;
    this.done = false;
    this.reservedBy = null;
    this.lastInput = -99;
    this.state = this.initial();
    this.message = '';
    this.attempts = 0;
    this.usedStation = false;
  }
  initial() { return {}; }

  canUse(p) {
    const g = this.game;
    if (this.reservedBy && this.reservedBy !== p.id && g.time - this.lastInput < 20 && g.players.get(this.reservedBy)?.connected) return false;
    return true;
  }
  open(p) { if (this.canUse(p)) { this.reservedBy = p.id; this.lastInput = this.game.time; } }
  release(p) { if (this.reservedBy === p.id) this.reservedBy = null; }

  /** Entry point for all inputs. */
  input(p, act) {
    if (this.done) return { ok: false, msg: 'Completed.' };
    if (!this.canUse(p)) return { ok: false, msg: 'Another crew member is using this panel.' };
    this.reservedBy = p.id;
    this.lastInput = this.game.time;
    const r = this.act(p, act) || { ok: true };
    if (r.msg !== undefined) this.message = r.msg;
    this.game.fx('puzzle', { id: this.id, act, ok: r.ok, msg: r.msg, sound: r.sound });
    if (r.sound) this.game.fx('sfx', { name: r.sound, x: this.def.panel?.x, z: this.def.panel?.z, y: this.def.panel?.y });
    if (r.noise) this.game.emitSound({ x: this.def.panel.x, z: this.def.panel.z, r: r.noise, kind: 'puzzle', player: p.id });
    this.game.progress();
    return r;
  }
  act() { return { ok: false }; }

  complete(p) {
    if (this.done) return;
    this.done = true;
    this.message = this.def.doneText || 'Complete.';
    this.game.puzzleCompleted(this, p);
  }

  update() {}

  view() { return { title: this.title, done: this.done, message: this.message, controls: [] }; }

  serialize() { return { done: this.done, state: JSON.parse(JSON.stringify(this.state)), usedStation: this.usedStation }; }
  restore(s) { this.done = !!s.done; this.state = { ...this.initial(), ...JSON.parse(JSON.stringify(s.state || {})) }; this.usedStation = !!s.usedStation; this.reservedBy = null; this.message = this.done ? (this.def.doneText || 'Complete.') : ''; }
}

/**
 * Ordered input puzzle (breakers, tone tests, shutter controls, pressure
 * lock, patch sockets ...). Options in def:
 *   buttons: [{ id, label, sub, sym }]   solution: [ids]
 *   arm: id that must be pressed first (e.g. RESET)
 *   finish: id pressed after the sequence (e.g. LOCAL SERVICE)
 *   onWrong: 'reset' (clear everything) | 'keep' (keep completed steps)
 */
export class SequencePuzzle extends Puzzle {
  initial() { return { armed: !this.def.arm, seq: [] }; }

  act(p, act) {
    const d = this.def, s = this.state;
    if (d.extra && d.extra[act]) return d.extra[act](this, p);
    if (d.arm && act === d.arm) {
      s.armed = true; s.seq = [];
      return { ok: true, msg: d.armText || 'Panel reset.', sound: 'leverClunk' };
    }
    if (!s.armed) return { ok: false, msg: d.notArmedText || 'Reset the panel first.', sound: 'click' };
    if (d.finish && act === d.finish) {
      if (s.seq.length === d.solution.length) { this.complete(p); return { ok: true, msg: this.message, sound: d.doneSound || 'success' }; }
      return this.wrong(p, d.finishEarlyText || 'Sequence incomplete.');
    }
    const btn = d.buttons.find((b) => b.id === act);
    if (!btn) return { ok: false };
    if (s.seq.includes(act) && d.noRepeat !== false) return { ok: false, msg: d.repeatText || 'Already set.', sound: 'click' };
    const expect = d.solution[s.seq.length];
    if (act === expect) {
      s.seq.push(act);
      this.onStep && this.onStep(act);
      if (d.onStep) d.onStep(this, act);
      if (s.seq.length === d.solution.length && !d.finish) { this.complete(p); return { ok: true, msg: this.message, sound: d.doneSound || 'success' }; }
      return { ok: true, msg: d.stepText ? d.stepText(s.seq) : '', sound: d.stepSound || 'switchOn' };
    }
    return this.wrong(p, d.wrongText || 'The panel trips.', act);
  }

  wrong(p, msg) {
    const d = this.def, s = this.state;
    this.attempts++;
    if (d.onWrong === 'keep') {
      return { ok: false, msg: d.wrongText || msg, sound: d.wrongSound || 'fault' };
    }
    s.seq = [];
    if (d.arm) s.armed = false;
    if (d.onWrongHook) d.onWrongHook(this, p);
    return { ok: false, msg, sound: d.wrongSound || 'trip', noise: d.wrongNoise || 0 };
  }

  view() {
    const d = this.def, s = this.state;
    const controls = [];
    if (d.arm) controls.push({ id: d.arm, label: d.armLabel || 'RESET', kind: 'lever', state: s.armed ? 'on' : 'off' });
    for (const b of d.buttons) controls.push({ id: b.id, label: b.label, sub: b.sub, sym: b.sym, kind: d.kind || 'switch', state: this.done || s.seq.includes(b.id) ? 'on' : 'off' });
    if (d.finish) controls.push({ id: d.finish, label: d.finishLabel || d.finish, kind: 'button', state: this.done ? 'on' : 'off', wide: true });
    for (const [k, v] of Object.entries(d.extraButtons || {})) controls.push({ id: k, label: v, kind: 'button', state: 'off', wide: true });
    return {
      title: this.title, done: this.done, message: this.message, instructions: d.instructions, display: d.display ? d.display(this) : (this.done ? (d.doneDisplay || 'COMPLETE') : (s.armed ? (d.armedDisplay || 'READY') : (d.idleDisplay || 'TRIPPED'))),
      controls, layout: d.layout || 'row',
    };
  }
}
