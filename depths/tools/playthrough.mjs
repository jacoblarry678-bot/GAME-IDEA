/**
 * Scripted campaign playthrough. A bot plays the campaign through the
 * public Game API (inputs, interactions, puzzle actions, photos) without
 * teleporting, chapter by chapter, and asserts the story flags each step
 * should produce. Options:
 *   --chapters 1-6     which chapters to play (consecutive)
 *   --ending familiar|door|cut   which P12 procedure to choose
 *   --june / --no-june           rescue June in chapter four or not
 *   --evidence all|none|late     collect proof on the first visit, never, or via return trips
 *   --players N                  extra co-op bots following the host (sim only)
 */
import { Game } from '../src/sim/game.js';
import { Bot } from './bot.mjs';
import { RUNS } from './runs.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [c0, c1] = opt('--chapters', '1-6').split('-').map(Number);
const cfg = {
  ending: opt('--ending', 'door'),
  june: !args.includes('--no-june'),
  evidence: opt('--evidence', 'all'),
  verbose: args.includes('-v'),
  seed: +opt('--seed', 7),
  difficulty: opt('--difficulty', 'standard'),
};

const g = new Game({ seed: cfg.seed, difficulty: cfg.difficulty });
g.addPlayer('p1', 'evan', 'Evan');
const b = new Bot(g, 'p1');
let fails = 0;
b.log = (...a) => { if (cfg.verbose) console.log(`[ch${g.chapterId} ${g.time.toFixed(1)}]`, ...a); };
b.expect = (cond, msg) => { if (!cond) { fails++; console.log(`  FAIL ch${g.chapterId}: ${msg}`); } else if (cfg.verbose) console.log(`  ok ${msg}`); };
b.cfg = cfg;

const t0 = Date.now();
if (c0 === 1) g.loadChapter(1);
else { g.loadChapter(c0, { entry: 'replay' }); RUNS.prep && RUNS.prep(b, c0); }
for (let ch = c0; ch <= c1; ch++) {
  const run = RUNS[ch];
  if (!run) { console.log(`no run for chapter ${ch}`); break; }
  const before = g.time;
  try { run(b); } catch (e) { fails++; console.log(`  ERROR ch${ch}: ${e.message}`); if (cfg.verbose) console.log(e.stack); break; }
  if (g.over && g.over.kind === 'death') { fails++; console.log(`  died in chapter ${ch}: ${g.over.creature}`); break; }
  console.log(`chapter ${ch} done in ${(g.time - before).toFixed(0)} s of game time · health ${Math.round(b.p.health)} · hits ${b.count('hit')}`);
  if (ch < c1) {
    // ride the transition into the next chapter
    let guard = 0;
    while (g.chapterId === ch && guard++ < 60 * 20) b.tick(1);
    b.expect(g.chapterId === ch + 1, `transition into chapter ${ch + 1}`);
  }
}
console.log(`\n${fails ? fails + ' failure(s)' : 'playthrough ok'} · ${((Date.now() - t0) / 1000).toFixed(1)} s real time`);
process.exit(fails ? 1 : 0);
