/**
 * Map validation (headless): spawn clearance, nav connectivity from every
 * spawn to every hotspot/objective, and objective zones on walkable ground.
 * Usage: node tools/mapcheck.mjs [mapId]
 */
import { MapBuilder } from '../src/world/mapBuilder.js';
import { NavGrid } from '../src/world/navgrid.js';
import { MAPS } from '../src/world/maps/index.js';

const ids = process.argv[2] ? [process.argv[2]] : Object.keys(MAPS);
let bad = 0;
for (const id of ids) {
  const def = MAPS[id];
  const b = new MapBuilder({ headless: true });
  def.build(b);
  const nav = new NavGrid(b.world, def.bounds, 1);
  const problems = [];
  const clear = (x, y, z) => !b.world.overlaps(x - 0.36, y + 0.05, z - 0.36, x + 0.36, y + 1.8, z + 0.36);
  for (const s of b.spawns) {
    if (!clear(s.x, s.y, s.z)) problems.push(`spawn t${s.team} (${s.x},${s.z}) blocked`);
    const g = b.world.groundHeight(s.x, s.z, s.y + 0.5, 0.3);
    if (Math.abs(g - s.y) > 0.05) problems.push(`spawn t${s.team} (${s.x},${s.z}) ground ${g}`);
  }
  const targets = [...b.hotspots.map((h) => ({ ...h, kind: 'hotspot' })), ...(def.objectives?.dom || []).map((f) => ({ ...f, name: 'flag ' + f.id, kind: 'dom' })), ...(def.objectives?.hp || []).map((z) => ({ ...z, kind: 'hp' }))];
  const near = (x, y, z) => { const i = nav.nearest(x, z, y, 6); if (i < 0) return Infinity; const c = nav.center(i); return Math.hypot(c.x - x, c.z - z); };
  for (const s of b.spawns) if (near(s.x, s.y, s.z) > 1.3) problems.push(`spawn t${s.team} (${s.x},${s.z}) not on the main nav region (${near(s.x, s.y, s.z).toFixed(1)} m)`);
  for (const t of targets) if (t.kind !== 'hp' && near(t.x, 0, t.z) > 2.5) problems.push(`${t.kind} ${t.name} (${t.x},${t.z}) not on the main nav region`);
  const from = b.spawns.filter((s) => s.team >= 0);
  let paths = 0, fails = 0;
  for (const s of from) {
    for (const t of targets) {
      const p = nav.findPath(s.x, s.y, s.z, t.x, 0, t.z);
      paths++;
      if (!p || !p.length) { fails++; if (fails < 15) problems.push(`no path spawn(${s.x},${s.z}) → ${t.kind} ${t.name}`); }
    }
  }
  // walkable share inside each objective zone
  for (const z of def.objectives?.hp || []) {
    let n = 0, w = 0;
    for (let x = z.x - z.w / 2 + 0.5; x < z.x + z.w / 2; x += 1) for (let zz = z.z - z.d / 2 + 0.5; zz < z.z + z.d / 2; zz += 1) { n++; const [cx, cz] = nav.cellOf(x, zz); const i = nav.idx(cx, cz); if (nav.walk[i] && nav.region[i] === nav.mainRegion) w++; }
    if (w / n < 0.5) problems.push(`hardpoint ${z.name} only ${Math.round((w / n) * 100)}% walkable`);
  }
  let walk = 0, main = 0;
  for (let i = 0; i < nav.walk.length; i++) { if (nav.walk[i]) { walk++; if (nav.region[i] === nav.mainRegion) main++; } }
  if (main / walk < 0.9) problems.push(`only ${main}/${walk} walkable cells are connected to the main region`);
  console.log(`${id}: ${b.world.boxes.length} boxes, ${b.spawns.length} spawns, ${b.hotspots.length} hotspots, walkable ${walk}/${nav.walk.length} (main region ${main}), paths ${paths - fails}/${paths}`);
  for (const p of problems) console.log('  PROBLEM', p);
  bad += problems.length;
}
process.exit(bad ? 1 : 0);
