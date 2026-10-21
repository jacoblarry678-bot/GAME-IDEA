/**
 * Level validation for every chapter (and return trips). The checks live in
 * src/sim/validate.js and are shared with the Expedition generator.
 * Run: node tools/levelcheck.mjs
 */
import { CHAPTERS } from '../src/data/chapters/index.js';
import { validateLevel } from '../src/sim/validate.js';

let problems = 0;
function check(id, def, label) {
  const { level, problems: list } = validateLevel(def);
  for (const p of list) { problems++; console.log(`  [ch${id}] ${label}: ${p}`); }
  return level;
}
for (const [id, def] of Object.entries(CHAPTERS)) {
  const L = check(id, def, 'campaign');
  console.log(`chapter ${id} ${def.title}: ${L.rooms.length} rooms, ${L.doors.length} doors, ${L.props.length} props, ${L.interactables.length} interactables`);
  if (def.returnTrip) check(id, def.returnTrip(def), 'return trip');
}
console.log(problems ? `\n${problems} problem(s)` : '\nall levels valid');
process.exit(problems ? 1 : 0);
