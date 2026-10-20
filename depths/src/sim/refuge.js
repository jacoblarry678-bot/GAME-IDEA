/**
 * Refuges. A genuine refuge has a wall clock whose second hand advances
 * normally; an imitation has a stopped clock. Watching the second hand for
 * three consecutive seconds marks a genuine room Verified. Entering, closing
 * the door and verifying clears pursuit after five seconds: creatures
 * withdraw to off-route anchors and the game saves.
 */
export function updateRefuges(game, dt) {
  const L = game.level;
  for (const p of game.players.values()) {
    if (!p.alive) { p.clockGaze = 0; continue; }
    const room = L.room(p.room);
    const ref = room && room.refugeData;
    // clock gaze (consecutive seconds)
    if (ref) {
      const c = ref.clock;
      const e = p.eye();
      const dx = c.x - e.x, dy = c.y - e.y, dz = c.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      const f = p.forward();
      const cos = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      const looking = d < 8 && cos > Math.cos(14 * Math.PI / 180) && L.world.clearLine(e.x, e.y, e.z, c.x - dx / d * 0.15, c.y - dy / d * 0.15, c.z - dz / d * 0.15);
      if (looking) {
        p.clockGaze += dt;
        if (p.clockGaze >= 3 && p.clockTarget !== room.id) {
          p.clockTarget = room.id;
          if (ref.genuine) {
            const first = !game.persist.refuges[room.id];
            game.persist.refuges[room.id] = true;
            game.fx('verified', { pid: p.id, room: room.id, first, label: ref.label });
            if (first) game.fx('profile', { kind: 'refuge', id: `${game.chapterId}:${room.id}` });
            if (game.script.onVerified) game.script.onVerified(game, p, room);
          } else {
            game.fx('clockStopped', { pid: p.id, room: room.id });
            game.story.addClue(`imitation.${room.id}`, `${room.name}: the clock's second hand does not move. This is not a refuge.`, 'observed');
            if (game.script.onClockStopped) game.script.onClockStopped(game, p, room);
          }
        }
      } else { p.clockGaze = 0; if (p.clockTarget === room.id) { /* keep */ } }
    } else { p.clockGaze = 0; p.clockTarget = null; }

    // securing
    if (ref && ref.genuine && game.inRefugeVolume(p) && game.persist.refuges[room.id]) {
      const closed = room.doors.every((d) => d.T.open ? false : d.open < 0.05);
      if (closed) {
        p.refugeT += dt;
        if (p.refugeT >= 5 && !game.refugeSecured[room.id]) secure(game, room, p);
      } else p.refugeT = 0;
    } else p.refugeT = 0;
  }
  // a refuge stays secured only while someone living is inside it
  for (const id of Object.keys(game.refugeSecured)) {
    if (!game.refugeSecured[id]) continue;
    const any = [...game.players.values()].some((p) => p.alive && p.room === id);
    if (!any) game.refugeSecured[id] = false;
  }
}

function secure(game, room, p) {
  game.refugeSecured[room.id] = true;
  const visits = game.refugeVisits[room.id] = (game.refugeVisits[room.id] || 0) + 1;
  for (const c of game.enemies) {
    if (c.gone) continue;
    if (c.state === 'pursue' || c.state === 'warn' || c.state === 'search' || c.state === 'investigate') c.forceWithdraw();
  }
  if (visits === 1) game.director.onRefuge();
  // spectators rejoin at a reached refuge with forty health and their saved tools
  for (const q of game.players.values()) {
    if (q.spectating && q.connected) {
      q.spectating = false; q.downed = false; q.health = 40; q.revivedOnce = false;
      q.x = room.cx; q.z = room.cz; q.y = room.floorY; q.vx = q.vz = 0;
      game.fx('respawn', { pid: q.id, room: room.id });
    }
  }
  for (const q of game.players.values()) if (q.room === room.id) q.revivedOnce = false;
  game.fx('refugeSecured', { room: room.id, pid: p.id });
  if (game.script.onRefugeSecured) game.script.onRefugeSecured(game, room, p);
  game.requestCheckpoint('refuge');
}
