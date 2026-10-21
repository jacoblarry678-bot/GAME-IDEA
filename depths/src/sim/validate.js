/**
 * Level validation shared by tools/levelcheck.mjs and the Expedition
 * generator (generated runs must pass before the player loads in):
 *  - rooms do not overlap; every door fits a shared wall
 *  - every room is reachable from the start with all locks open
 *  - both sides of every door have player-sized standing room
 *  - every interactable can be reached within interaction distance
 *  - refuges have at least 24 m² of floor; survey alcoves are >= 2.4 x 2.9 m
 *  - door openings are >= 1.1 m wide and 2.1 m high (crawlways excepted)
 */
import { Level } from './level.js';

function clearFor(L, x, z, y = 0, r = 0.36) {
  return !L.world.overlaps(x - r, y + 0.05, z - r, x + r, y + 1.75, z + r, 1);
}

/** Returns { level, problems: [string] }. */
export function validateLevel(def) {
  const problems = [];
  const L = new Level(def);
  for (const e of L.errors) problems.push(e);
  // with every story flag set: props and blocks that vanish later are gone
  for (const p of L.props) if (p.box && p.until) p.box.active = false;
  for (const b of L.blocks) if (b.until) b.box.active = false;
  const nav = L.nav;
  const start = def.start;
  const seen = nav.reachable(start.x, start.z, null, () => 0);
  for (const r of L.rooms) {
    if (r.unreachable) continue;
    let any = false;
    for (let i = 0; i < nav.walk.length && !any; i++) if (seen[i] && nav.room[i] === r.index) any = true;
    if (!any) problems.push(`room ${r.id} not reachable from start`);
  }
  for (const d of L.doors) {
    if (!d.T.crawl && (d.w < 1.1 || d.h < 2.1)) problems.push(`door ${d.id} smaller than 1.1 x 2.1 m`);
    if (!d.b) continue;
    for (const s of [-1, 1]) {
      const x = d.axis === 'x' ? d.bnd + s * 0.75 : d.c, z = d.axis === 'x' ? d.c : d.bnd + s * 0.75;
      const gy = L.world.groundHeight(x, z, 5, 0.1);
      const y = gy > -Infinity ? gy : 0;
      if (!clearFor(L, x, z, y, 0.3)) problems.push(`door ${d.id} blocked on side ${s > 0 ? '+' : '-'} (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  for (const it of L.interactables) {
    if (it.noTarget || it.kind === 'clock') continue;
    const reach = (it.reach || 1.8) - 0.1;
    let best = Infinity;
    for (let i = 0; i < nav.walk.length; i++) {
      if (!seen[i]) continue;
      const c = nav.center(i);
      const d = Math.hypot(c.x - it.x, c.z - it.z);
      if (d < best && clearFor(L, c.x, c.z, nav.floorY[i])) best = d;
    }
    if (best > reach) problems.push(`interactable ${it.id} (${it.kind}) not reachable (nearest standing spot ${best.toFixed(2)} m)`);
  }
  for (const ref of L.refuges) {
    const r = L.room(ref.room);
    if (r.w * r.d < 24) problems.push(`refuge ${r.id} floor area ${r.w * r.d} m² < 24`);
  }
  for (const s of L.stations) {
    if (!s.alcove) continue;
    const [x0, z0, x1, z1] = s.alcove;
    const a = Math.min(x1 - x0, z1 - z0), b = Math.max(x1 - x0, z1 - z0);
    if (a < 2.4 || b < 2.9) problems.push(`survey alcove ${s.id} is ${(x1 - x0).toFixed(1)} x ${(z1 - z0).toFixed(1)} m`);
  }
  return { level: L, problems };
}
