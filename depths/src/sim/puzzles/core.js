/**
 * Chapter six panels: the freight nexus destinations, P11 (rebuild the
 * return circuit), P12 (choose the network's purpose) and the two
 * procedures that follow a commitment (maintenance bypass, emergency
 * isolation). The full-transmission voice gates are world interactables.
 */
import { Puzzle } from './base.js';

const EVIDENCE = {
  E1: { name: 'Lena\'s employee badge', where: 'the mall staff locker (chapter two)' },
  E2: { name: 'Rook\'s maintenance key', where: 'the pool engineer bay (chapter three)' },
  E3: { name: 'the private memory', where: 'the laundry room (chapter four)' },
  E4: { name: 'a living pulse trace', where: 'the telemetry booth (chapter five)' },
};
export function missingEvidence(game) { return Object.keys(EVIDENCE).filter((e) => !game.story.has(e)); }
export function evidenceLine(game, e) { return `${e} ${EVIDENCE[e].name}: ${game.story.has(e) ? 'held' : `missing · ${EVIDENCE[e].where}`}`; }

/** Freight nexus: send the lift to a cleared service landing. Never "completes". */
export class NexusPanel extends Puzzle {
  act(p, act) {
    const g = this.game;
    if (!act.startsWith('go:')) return { ok: false };
    if (g.story.has('P12.committed')) return { ok: false, msg: 'RETURN LOADS SUSPENDED · FINAL ROUTE COMMITTED', sound: 'fault' };
    const ch = +act.slice(3);
    if (g.script.goSide) g.script.goSide(g, p, ch);
    return { ok: true, msg: 'Freight lift dispatched.', sound: 'leverClunk' };
  }
  view() {
    const g = this.game;
    const dest = this.def.destinations.map((d) => ({ id: `go:${d.ch}`, label: d.label, sub: `${d.evidence} · ${g.story.has(d.evidence) ? 'collected' : 'missing'}`, state: g.story.has(d.evidence) ? 'on' : 'off', wide: true }));
    return { title: this.title, done: false, message: this.message, instructions: this.def.instructions, display: g.story.has('P12.committed') ? 'RETURN LOADS SUSPENDED' : 'CLEARED SERVICE LANDINGS · RETURN LOADS HAVE PRIORITY', controls: dest };
  }
}

/** P11: patch the live input through T1..T5 in service order, then into RETURN. */
export class PatchPuzzle extends Puzzle {
  initial() { return { chain: [] }; }
  act(p, act) {
    const s = this.state, d = this.def;
    if (act === 'release') { const c = s.chain.pop(); return { ok: true, msg: c ? `Cable released from ${c}.` : 'No cables connected.', sound: 'click' }; }
    if (act === 'clear') { s.chain = []; return { ok: true, msg: 'All cables released.', sound: 'click' }; }
    if (!act.startsWith('plug:')) return { ok: false };
    const sock = act.slice(5);
    if (sock !== 'RETURN' && s.chain.includes(sock)) return { ok: false, msg: `INVALID ROUTE · ${sock} is already patched. The last cable is released.`, sound: 'fault' };
    if (sock === 'RETURN') {
      if (s.chain.join(',') === d.solution.join(',')) { s.chain.push('RETURN'); this.complete(p); return { ok: true, msg: this.message, sound: 'success' }; }
      if (s.chain.length < d.solution.length) return { ok: false, msg: 'INVALID ROUTE · RETURN needs all five sockets in the chain. The last cable is released.', sound: 'fault' };
      return { ok: false, msg: 'INVALID ROUTE · the chain is closed but carries no return signal. The last cable is released.', sound: 'fault' };
    }
    s.chain.push(sock);
    return { ok: true, msg: `${s.chain.length === 1 ? 'LIVE INPUT' : s.chain[s.chain.length - 2]} → ${sock}`, sound: 'switchOn' };
  }
  view() {
    const s = this.state;
    const controls = this.def.sockets.map((k) => ({ id: `plug:${k}`, label: k, sub: s.chain.includes(k) ? `patched #${s.chain.indexOf(k) + 1}` : 'open', state: this.done || s.chain.includes(k) ? 'on' : 'off' }));
    controls.push({ id: 'plug:RETURN', label: 'RETURN', sub: 'close the circuit', state: this.done ? 'on' : 'off', wide: true });
    controls.push({ id: 'release', label: 'RELEASE LAST', sub: 'pull the last cable', state: 'off' });
    controls.push({ id: 'clear', label: 'CLEAR', sub: 'pull every cable', state: 'off' });
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: this.done ? 'T1 · T2 · T3 · T4 · T5 · RETURN LIVE' : `LIVE INPUT → ${s.chain.join(' → ') || '…'}`, controls };
  }
}

const PURPOSES = {
  familiar: { label: 'FULL TRANSMISSION', consequence: 'Completes the transfer the Operator asked for. The main return door opens. Lena stays attached to the network. Always available.' },
  door: { label: 'MAINTENANCE BYPASS', consequence: 'Separates Lena\'s life support from identity transmission, then releases the anchor. Requires E1, E2, E3 and E4.' },
  cut: { label: 'EMERGENCY ISOLATION', consequence: 'Isolates and purges the transfer network. THIS ENDS LENA\'S LIFE SUPPORT. The evacuation hatch opens independently of any key. Always available.' },
};

/** P12: select a purpose; the commit lever beside the console confirms it with a three second hold. */
export class PurposePuzzle extends Puzzle {
  initial() { return { sel: null }; }
  available(k) { return k !== 'door' || missingEvidence(this.game).length === 0; }
  act(p, act) {
    const g = this.game;
    if (g.story.has('P12.committed')) return { ok: false, msg: 'The route is committed.' };
    if (!act.startsWith('sel:')) return { ok: false };
    const k = act.slice(4);
    if (!PURPOSES[k]) return { ok: false };
    if (!this.available(k)) {
      const miss = missingEvidence(g).map((e) => evidenceLine(g, e)).join(' · ');
      return { ok: false, msg: `MAINTENANCE BYPASS unavailable. Missing: ${miss}. The freight nexus lift still reaches each landing.`, sound: 'fault' };
    }
    this.state.sel = k;
    return { ok: true, msg: `${PURPOSES[k].label}: ${PURPOSES[k].consequence} Hold the commit lever for three seconds to confirm.`, sound: 'click' };
  }
  view() {
    const g = this.game, s = this.state;
    const controls = Object.entries(PURPOSES).map(([k, v]) => ({ id: `sel:${k}`, label: v.label, sub: this.available(k) ? v.consequence : `Requires E1–E4 · missing ${missingEvidence(g).join(', ')}`, state: s.sel === k ? 'on' : 'off', wide: true }));
    return { title: this.title, done: g.story.has('P12.committed'), message: this.message, instructions: this.def.instructions, display: s.sel ? `SELECTED · ${PURPOSES[s.sel].label} · HOLD COMMIT LEVER 3 s` : 'SELECT THE NETWORK\'S PURPOSE', controls };
  }
}
export { PURPOSES };

/** Maintenance bypass: key, badge, pulse comparison, handset memory check, then the three switches in order. */
export class BypassPuzzle extends Puzzle {
  initial() { return { step: 0, handset: false, wrong: 0 }; }
  act(p, act) {
    const g = this.game, s = this.state, S = g.story;
    if (!S.has('route.door')) return { ok: false, msg: 'The maintenance lock is inert. Choose MAINTENANCE BYPASS at the broadcast console first.' };
    const order = ['key', 'badge', 'pulse', 'handset', 'life', 'identity', 'release'];
    if (act.startsWith('answer:')) {
      if (!s.handset) return { ok: false };
      if (act === 'answer:yellow') { s.handset = false; s.step = 4; S.play('bypassCorrect', { force: true }); return { ok: true, msg: 'Local display: TWO LIVING REFERENCES.', sound: 'success' }; }
      s.wrong++; S.play('bypassWrong', { force: true });
      return { ok: false, msg: 'Lena waits. "Try again. You know this one."', sound: 'click' };
    }
    const ix = order.indexOf(act);
    if (ix < 0) return { ok: false };
    if (s.handset) return { ok: false, msg: 'Answer Lena on the handset first.' };
    if (ix < s.step) return { ok: false, msg: 'Already done.' };
    if (ix > s.step) return { ok: false, msg: `Out of order. Next: ${this.def.labels[order[s.step]]}.`, sound: 'fault' };
    if (act === 'handset') { s.handset = true; S.play('bypassHandset', { force: true }); g.after(4.5, 'scene:bypassAnswer'); return { ok: true, msg: 'The isolated handset. Lena\'s voice, close and clear. She asks: "Blue mug?"', sound: 'click' }; }
    s.step = ix + 1;
    const msgs = { key: 'E2 maintenance key turned. The lock is live.', badge: 'E1 badge scanned: ORTIZ, L. REFERENCE OCCUPANT.', pulse: 'E4 compared with the chamber sensor: MATCH · SOURCE LOCAL.', life: 'LIFE SUPPORT · LOCAL.', identity: 'IDENTITY TRANSFER · DISCONNECTED.', release: 'ANCHOR RELEASED.' };
    if (act === 'release') { this.complete(p); return { ok: true, msg: msgs.release, sound: 'success' }; }
    return { ok: true, msg: msgs[act], sound: 'switchOn' };
  }
  view() {
    const s = this.state;
    const order = ['key', 'badge', 'pulse', 'handset', 'life', 'identity', 'release'];
    const controls = s.handset
      ? [{ id: 'answer:blue', label: '"Blue. You always took the blue one."', wide: true, state: 'off' }, { id: 'answer:yellow', label: '"Yellow. The handle was already missing."', wide: true, state: 'off' }, { id: 'answer:none', label: '"I don\'t remember a mug."', wide: true, state: 'off' }]
      : order.map((k, i) => ({ id: k, label: this.def.labels[k], sub: i < s.step ? 'done' : i === s.step ? 'next' : '', state: this.done || i < s.step ? 'on' : 'off', wide: true }));
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: this.done ? 'ANCHOR RELEASED · TWO LIVING REFERENCES' : s.step >= 4 ? 'TWO LIVING REFERENCES' : 'MAINTENANCE BYPASS', controls };
  }
}

/** Emergency isolation: open the guard, isolate three outgoing switches, pull PURGE. */
export class EmergencyPuzzle extends Puzzle {
  initial() { return { cover: false, sw: [false, false, false] }; }
  act(p, act) {
    const g = this.game, s = this.state;
    if (!g.story.has('route.cut')) return { ok: false, msg: 'The guarded panel is sealed. Choose EMERGENCY ISOLATION at the broadcast console first.' };
    if (act === 'cover') { s.cover = true; return { ok: true, msg: 'Guard open. WARNING: PURGE ENDS LIFE SUPPORT FOR THE REFERENCE OCCUPANT.', sound: 'leverClunk' }; }
    if (!s.cover) return { ok: false, msg: 'Open the guard first.' };
    if (act.startsWith('sw')) { const i = +act.slice(2) - 1; s.sw[i] = true; return { ok: true, msg: `Outgoing line ${i + 1}: ISOLATED.`, sound: 'switchOn' }; }
    if (act === 'purge') {
      if (!s.sw.every(Boolean)) return { ok: false, msg: 'PURGE interlocked: isolate all three outgoing lines first.', sound: 'fault' };
      this.complete(p);
      return { ok: true, msg: this.message, sound: 'success' };
    }
    return { ok: false };
  }
  view() {
    const s = this.state;
    const controls = [{ id: 'cover', label: 'GUARD', sub: s.cover ? 'open' : 'closed', state: s.cover ? 'on' : 'off' }];
    [1, 2, 3].forEach((i) => controls.push({ id: `sw${i}`, label: `LINE ${i}`, sub: s.sw[i - 1] ? 'ISOLATED' : 'CONNECTED', state: s.sw[i - 1] ? 'on' : 'off' }));
    controls.push({ id: 'purge', label: 'PURGE', sub: 'ends Lena\'s life support', state: this.done ? 'on' : 'off', wide: true });
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display: this.done ? 'PURGE IN PROGRESS · EVACUATE' : 'EMERGENCY ISOLATION · THIS ENDS LIFE SUPPORT FOR THE REFERENCE OCCUPANT', controls };
  }
}
