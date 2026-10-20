/**
 * Chapter three puzzles: P5 valve state with an eight second pump start,
 * E2 Rook's powered cabinet latch, and P6 the reflection tile crossing (a
 * physical puzzle: players walk the grid; there is no panel).
 */
import { Puzzle } from './base.js';

/** P5 Drain the service basin. */
export class ValvePuzzle extends Puzzle {
  initial() { return { A: 'open', B: 'closed', C: 'closed', pump: 0, pumping: false }; }
  firstUnmet() {
    const s = this.state, R = this.def.required;
    for (const v of Object.keys(R)) if (s[v] !== R[v]) return `${this.def.labels[v]} is ${s[v].toUpperCase()}. ${this.def.unmetText[v]}`;
    return null;
  }
  act(p, act) {
    const s = this.state;
    if (act.startsWith('valve:')) {
      if (s.pumping) return { ok: false, msg: 'The pump is running. Wait for it to stop.' };
      const v = act.slice(6);
      s[v] = s[v] === 'open' ? 'closed' : 'open';
      return { ok: true, msg: `${this.def.labels[v]} ${s[v].toUpperCase()}`, sound: 'leverClunk' };
    }
    if (act === 'pump') {
      const unmet = this.firstUnmet();
      if (unmet) return { ok: false, msg: `PUMP REFUSED. ${unmet}`, sound: 'fault' };
      if (!s.pumping) { s.pumping = true; s.pump = 0; this.pumpBy = p.id; if (this.def.onPumpStart) this.def.onPumpStart(this, p); }
      return { ok: true, msg: 'Pump starting. Stay at the panel for eight seconds.', sound: 'pump' };
    }
    return { ok: false };
  }
  update(dt) {
    const s = this.state;
    if (!s.pumping || this.done) return;
    const p = this.game.players.get(this.pumpBy);
    if (!p || Math.hypot(p.x - this.def.panel.x, p.z - this.def.panel.z) > 3.2) { s.pumping = false; s.pump = 0; this.message = 'Pump stopped: nobody at the panel.'; return; }
    s.pump += dt;
    if (s.pump >= 8) { s.pumping = false; this.complete(p); }
  }
  view() {
    const s = this.state, d = this.def;
    const controls = Object.keys(d.labels).map((v) => ({ id: `valve:${v}`, label: d.labels[v], sub: s[v].toUpperCase(), state: s[v] === 'open' ? 'on' : 'off', kind: 'valve' }));
    controls.push({ id: 'pump', label: 'PUMP', sub: s.pumping ? `running ${Math.ceil(8 - s.pump)} s` : 'start (8 s)', state: s.pumping || this.done ? 'on' : 'off', wide: true });
    const display = this.done ? 'BASIN DRAINED · ACCESS GATE OPEN' : s.pumping ? `PUMPING ${'▮'.repeat(Math.floor(s.pump))}${'▯'.repeat(8 - Math.floor(s.pump))}` : (this.firstUnmet() || 'CONFIGURATION SAFE · READY');
    return { title: this.title, done: this.done, message: this.message, instructions: d.instructions, display, controls };
  }
  serialize() { const o = super.serialize(); o.state.pumping = false; o.state.pump = 0; return o; }
}

/** E2 Rook's maintenance key: isolate the breaker, wait for the indicator to go dark, pull the release. */
export class LatchPuzzle extends Puzzle {
  initial() { return { breaker: 'on', offAt: -1 }; }
  powered() { const s = this.state; return s.breaker === 'on' || this.game.time - s.offAt < 3; }
  act(p, act) {
    const s = this.state;
    if (act === 'breaker') {
      s.breaker = s.breaker === 'on' ? 'off' : 'on';
      s.offAt = s.breaker === 'off' ? this.game.time : -1;
      return { ok: true, msg: s.breaker === 'off' ? 'Cabinet breaker isolated. The indicator is fading.' : 'Cabinet breaker on.', sound: 'switchOn' };
    }
    if (act === 'release') {
      if (this.powered()) return { ok: false, msg: 'LOCK ENERGIZED', sound: 'authFail' };
      this.complete(p);
      return { ok: true, msg: this.message, sound: 'success' };
    }
    return { ok: false };
  }
  view() {
    const s = this.state;
    const ind = this.done ? 'OPEN' : s.breaker === 'on' ? 'LOCK ENERGIZED' : this.powered() ? `POWERING DOWN ${Math.max(0, 3 - (this.game.time - s.offAt)).toFixed(1)} s` : 'INDICATOR DARK';
    return {
      title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: ind,
      controls: [
        { id: 'breaker', label: 'CABINET BREAKER', sub: s.breaker.toUpperCase(), state: s.breaker === 'on' ? 'on' : 'off', kind: 'switch' },
        { id: 'release', label: 'MECHANICAL RELEASE', sub: 'pull', state: this.done ? 'on' : 'off', wide: true },
      ],
    };
  }
}

/**
 * P6 Cross the reflection tiles. Columns A-D left to right, rows 1-4 from
 * the entrance. A wrong tile sinks, cracks for two seconds, then returns the
 * player to the entrance ledge with ten damage if they are still on it.
 */
export class TilePuzzle extends Puzzle {
  initial() { return { lit: [] }; }
  cellAt(x, z) {
    const G = this.def.grid;
    if (x < G.x0 || x >= G.x0 + 4 * G.size || z < G.z0 || z >= G.z0 + 4 * G.size) return null;
    const c = Math.floor((x - G.x0) / G.size), r = Math.floor((z - G.z0) / G.size);
    return 'ABCD'[c] + (r + 1);
  }
  update(dt) {
    const g = this.game, G = this.def.grid, safe = this.def.safe;
    this.cracking = this.cracking || {};
    for (const p of g.players.values()) {
      if (!p.alive) continue;
      const cell = this.cellAt(p.x, p.z);
      const cr = this.cracking[p.id];
      if (cell && !safe.includes(cell) && !this.done) {
        if (!cr || cr.cell !== cell) {
          this.cracking[p.id] = { cell, t: 0 };
          g.fx('tileCrack', { pid: p.id, cell, x: p.x, z: p.z });
          g.fx('warning', { type: 'tile', x: p.x, z: p.z, text: 'The tile sinks and cracks. Step back.', target: p.id });
        } else {
          cr.t += dt;
          if (cr.t >= 2) {
            this.cracking[p.id] = null;
            const e = G.entrance;
            p.x = e.x + (Math.random() - 0.5) * 2; p.z = e.z; p.vx = p.vz = 0;
            g.damagePlayer(p, 10, null, { kind: 'tile', name: 'The reflection tiles', hint: 'Only the tiles on the maintenance line are safe. Step back during the cracking sound to avoid damage.', capture: true });
            g.fx('tileReset', { pid: p.id });
          }
        }
      } else {
        if (cr) this.cracking[p.id] = null;
        if (cell && safe.includes(cell) && !this.state.lit.includes(cell)) { this.state.lit.push(cell); g.fx('tileLit', { cell }); g.story.set(`tile.${cell}`); }
      }
      if (!this.done && p.z >= G.z0 + 4 * G.size + 0.3 && p.x > G.x0 && p.x < G.x0 + 4 * G.size) this.complete(p);
    }
  }
  view() { return { title: this.title, done: this.done, message: this.message, controls: [], display: this.done ? 'BRIDGE EXTENDED' : `LIT ${this.state.lit.join(' ')}` }; }
}
