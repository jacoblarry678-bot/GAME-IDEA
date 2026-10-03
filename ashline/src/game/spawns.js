/**
 * Spawn selection. Scores every spawn point for the combatant using:
 * distance to living enemies, enemy line of sight, recent deaths, teammate
 * proximity, recent use, and team side preference. Never picks an occupied
 * point.
 */
export function chooseSpawn(match, c, initial) {
  const spawns = match.map.spawns;
  const enemies = match.combatants.filter((o) => o.alive && o.team !== c.team);
  const allies = match.combatants.filter((o) => o.alive && o.team === c.team && o !== c);
  let best = null, bestScore = -Infinity;
  match._spawnUse = match._spawnUse || new Map();
  for (let i = 0; i < spawns.length; i++) {
    const sp = spawns[i];
    let score = match.rng() * 15;
    const teams = match.mode.teams;
    // side preference (team modes only)
    if (!teams) score += 0;
    else if (sp.team === c.team) score += initial ? 1000 : 60;
    else if (sp.team === -1) score += initial ? -2000 : 20;
    else score += initial ? -5000 : -120;
    if (match.mode.spawnScore && !initial) score += match.mode.spawnScore(match, c, sp);
    if (!teams && initial) {
      // spread everyone out at the start of a free-for-all
      let minD = Infinity;
      for (const o of match.combatants) if (o !== c && o.alive) minD = Math.min(minD, Math.hypot(o.x - sp.x, o.z - sp.z));
      score += Math.min(minD, 40) * 10;
    }
    // occupied?
    let blocked = false;
    for (const o of match.combatants) {
      if (o === c || !o.alive) continue;
      if (Math.hypot(o.x - sp.x, o.z - sp.z) < 1.2 && Math.abs(o.y - sp.y) < 1.5) { blocked = true; break; }
    }
    if (blocked) continue;
    if (!initial) {
      let minD = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - sp.x, e.z - sp.z);
        minD = Math.min(minD, d);
        if (d < 60 && match.canSee(e.x, e.eyeY, e.z, sp.x, sp.y + 1.5, sp.z)) score -= 350;
      }
      if (minD < 10) score -= 1500;
      else score += Math.min(minD, 45) * 4;
      for (const a of allies) {
        const d = Math.hypot(a.x - sp.x, a.z - sp.z);
        if (d < 18) score += 12;
      }
      for (const d of match.recentDeaths) {
        if (Math.hypot(d.x - sp.x, d.z - sp.z) < 9) score -= d.team === c.team ? 120 : 40;
      }
      const used = match._spawnUse.get(i);
      if (used !== undefined && match.time - used < 4) score -= 250;
    } else {
      const used = match._spawnUse.get(i);
      if (used !== undefined && used === -1) score -= 500;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best === null) best = (match.rng() * spawns.length) | 0;
  match._spawnUse.set(best, initial ? -1 : match.time);
  return spawns[best];
}
