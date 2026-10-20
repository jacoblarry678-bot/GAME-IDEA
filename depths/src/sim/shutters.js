/**
 * Shutter cycles (chapter two and the display fragment): a group of mall
 * shutters that warn for three seconds, close, stay closed for a while and
 * reopen. Cutouts belonging to the group can move only while it is closed
 * and nobody is looking at them; reopening sends them back to their displays.
 * State lives in story.vars so checkpoints and co-op snapshots carry it.
 */
export const WARN = 3;

export function cycles(game) {
  const v = game.story.vars;
  if (!v.cycles) v.cycles = {};
  return v.cycles;
}

/** Define (or redefine) a group. opts: { doors: [doorIds], auto: { open, closed } | null, x, z } */
export function defineCycle(game, id, opts) {
  const C = cycles(game);
  if (!C[id]) C[id] = { state: 'open', t: 0, doors: opts.doors || [], auto: opts.auto || null, x: opts.x || 0, z: opts.z || 0, enabled: opts.enabled !== false, label: opts.label || 'Shutters' };
  else Object.assign(C[id], { doors: opts.doors || C[id].doors, auto: opts.auto !== undefined ? opts.auto : C[id].auto });
  return C[id];
}

export function cycleState(game, id) { const c = cycles(game)[id]; return c ? c.state : 'open'; }
export function cycleClosed(game, id) { return cycleState(game, id) === 'closed'; }

/** Start closing now (with the three second warning). */
export function closeCycle(game, id, holdFor = null) {
  const c = cycles(game)[id];
  if (!c || c.state !== 'open') return;
  c.state = 'warn'; c.t = 0; c.hold = holdFor;
  game.fx('warning', { type: 'cutout', x: c.x, z: c.z, text: `${c.label}: warning tone. Shutters closing in three seconds.` });
  game.fx('sfx', { name: 'shutterWarn', x: c.x, z: c.z });
}

export function openCycle(game, id) {
  const c = cycles(game)[id];
  if (!c || c.state === 'open') return;
  c.state = 'open'; c.t = 0;
  game.story.set(`cyc.${id}`, false);
  for (const d of c.doors) game.setDoor(d, true);
  game.fx('sfx', { name: 'shutterWarn', x: c.x, z: c.z });
  game.fx('cycleOpen', { id });
}

export function updateCycles(game, dt) {
  const C = cycles(game);
  for (const [id, c] of Object.entries(C)) {
    if (!c.enabled) continue;
    c.t += dt;
    if (c.state === 'warn' && c.t >= WARN) {
      // shutters never crush: anyone standing in a closing threshold is moved to the nearest clear side
      for (const did of c.doors) {
        const d = game.level.door(did);
        if (!d) continue;
        for (const p of game.players.values()) {
          const along = d.axis === 'x' ? p.x - d.bnd : p.z - d.bnd;
          const lat = d.axis === 'x' ? Math.abs(p.z - d.c) : Math.abs(p.x - d.c);
          if (Math.abs(along) < 0.55 && lat < d.w / 2 + 0.2) {
            const push = (along >= 0 ? 1 : -1) * 0.8;
            if (d.axis === 'x') p.x = d.bnd + push; else p.z = d.bnd + push;
          }
        }
        game.setDoor(did, false);
      }
      c.state = 'closed'; c.t = 0;
      game.story.set(`cyc.${id}`, true);
      game.fx('cycleClosed', { id });
    } else if (c.state === 'closed') {
      const dur = c.hold != null ? c.hold : c.auto ? c.auto.closed : Infinity;
      if (c.t >= dur) openCycle(game, id);
    } else if (c.state === 'open' && c.auto && c.t >= c.auto.open) {
      closeCycle(game, id);
    }
  }
}
