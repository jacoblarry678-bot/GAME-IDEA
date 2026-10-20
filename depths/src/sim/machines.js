/**
 * Machines (chapter five, the destruction route): presses, turbines and
 * compressors that run and rest on a fixed rhythm. A running machine masks
 * player movement inside its zone (six metres around it, or an authored
 * box). The steady loop is not a stimulus the Caretaker reacts to; a
 * machine that only starts when a player reaches it ("armed") begins its
 * first active cycle at that moment. State lives in story.vars.machines so
 * checkpoints and co-op snapshots carry it.
 */
export function machines(game) {
  const v = game.story.vars;
  if (!v.machines) v.machines = {};
  return v.machines;
}

/** opts: { x, z, run, rest, mask, zone:[x0,z0,x1,z1], always, enabled, armAt:{x,z,r}, label, offset } */
export function defineMachine(game, id, opts) {
  const M = machines(game);
  if (!M[id]) {
    M[id] = {
      id, x: opts.x, z: opts.z, run: opts.run ?? 6, rest: opts.rest ?? 6, mask: opts.mask ?? 6, zone: opts.zone || null,
      always: !!opts.always, enabled: opts.enabled !== false && !opts.armAt, armAt: opts.armAt || null, label: opts.label || 'Machine',
      running: false, t: opts.offset || 0, loopT: 0, until: opts.until ?? null,
    };
    if (M[id].enabled && (M[id].always || opts.startRunning !== false)) { M[id].running = true; M[id].t = opts.offset || 0; }
  }
  return M[id];
}

export function machine(game, id) { return machines(game)[id] || null; }
export function machineRunning(game, id) { const m = machine(game, id); return !!(m && m.enabled && m.running); }

export function startMachine(game, id, { always = null, until = null } = {}) {
  const m = machine(game, id);
  if (!m) return;
  m.enabled = true; m.running = true; m.t = 0; m.armAt = null;
  if (always !== null) m.always = always;
  if (until !== null) m.until = game.time + until;
  game.fx('machine', { id, running: true, x: m.x, z: m.z, label: m.label });
}

export function stopMachine(game, id, disable = true) {
  const m = machine(game, id);
  if (!m) return;
  if (m.running) game.fx('machine', { id, running: false, x: m.x, z: m.z, label: m.label });
  m.running = false; m.t = 0;
  if (disable) m.enabled = false;
}

/** Is a sound at (x,z) covered by a running machine? */
export function maskedAt(game, x, z) {
  const M = game.story.vars.machines;
  if (!M) return false;
  for (const m of Object.values(M)) {
    if (!m.enabled || !m.running) continue;
    if (m.zone) { const [x0, z0, x1, z1] = m.zone; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true; }
    if (Math.hypot(x - m.x, z - m.z) <= m.mask) return true;
  }
  return false;
}

export function updateMachines(game, dt) {
  const M = machines(game);
  for (const m of Object.values(M)) {
    if (!m.enabled) {
      if (m.armAt) {
        for (const p of game.players.values()) {
          if (p.alive && Math.hypot(p.x - m.armAt.x, p.z - m.armAt.z) <= (m.armAt.r || 2.5)) { startMachine(game, m.id); break; }
        }
      }
      continue;
    }
    if (m.until !== null && game.time >= m.until) { stopMachine(game, m.id); m.until = null; continue; }
    m.t += dt;
    if (m.always) { m.running = true; }
    else if (m.running && m.t >= m.run) { m.running = false; m.t -= m.run; game.fx('machine', { id: m.id, running: false, x: m.x, z: m.z, label: m.label }); }
    else if (!m.running && m.t >= m.rest) { m.running = true; m.t -= m.rest; game.fx('machine', { id: m.id, running: true, x: m.x, z: m.z, label: m.label }); }
    if (m.running) {
      m.loopT -= dt;
      if (m.loopT <= 0) { m.loopT = 1; game.emitSound({ x: m.x, z: m.z, r: 14, kind: 'machineLoop', source: `machine:${m.id}`, machine: m.id }); }
    }
  }
}
