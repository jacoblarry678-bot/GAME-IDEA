/**
 * Expedition check: generate runs for several seeds and let the bot play
 * each one from the entrance to extraction through the public Game API.
 * Usage: node tools/xrun.mjs [count=6] [firstSeed=1] [--damage]
 *   --damage   play with damage on (default uses the no-damage assist so the
 *              check covers generation, objectives and extraction logic)
 */
import { Game } from '../src/sim/game.js';
import { Bot } from './bot.mjs';
import { startExpedition } from '../src/sim/expedition.js';
import { addToPouch } from '../src/sim/equipment.js';

const args = process.argv.slice(2);
const count = +(args.find((a) => /^\d+$/.test(a)) || 6);
const first = +(args.filter((a) => /^\d+$/.test(a))[1] || 1);
const damage = args.includes('--damage');
let fails = 0;

export function playExpedition(seed, opts = {}) {
  const g = new Game({ seed: 3, assists: { noDamage: !opts.damage } });
  g.addPlayer('p1', 'evan', 'Evan');
  const spec = startExpedition(g, seed, addToPouch);
  const b = new Bot(g, 'p1');
  const L = g.level, nav = L.nav;
  const tiles = spec.puzzles.filter((p) => p.type === 'tiles');
  const cellOf = (pz, x, z) => { const G = pz.grid; if (x < G.x0 || x >= G.x0 + 10 || z < G.z0 || z >= G.z0 + 10) return null; return 'ABCD'[Math.floor((x - G.x0) / 2.5)] + (Math.floor((z - G.z0) / 2.5) + 1); };
  // plan around unsafe tiles and flooded water, like a careful player
  b.okCell = (i) => { const c = nav.center(i); if (nav.water[i]) return false; for (const pz of tiles) { const cell = cellOf(pz, c.x, c.z); if (cell && !pz.safe.includes(cell)) return false; } return true; };
  const errors = [];
  const expect = (c, m) => { if (!c) errors.push(m); };
  try {
    for (const o of spec.order) {
      const r = L.room(o.id);
      if (o.kind === 'extraction') break;
      if (o.kind === 'objective') {
        const pz = spec.puzzles.find((p) => L.roomAt(p.panel ? p.panel.x : p.grid.x0 + 5, p.panel ? p.panel.z : p.grid.z0 + 5)?.id === o.id);
        b.use(`${pz.id}clue`);
        if (pz.type === 'tiles') {
          const G = pz.grid;
          const ctr = (cell) => ({ x: G.x0 + ('ABCD'.indexOf(cell[0]) + 0.5) * 2.5, z: G.z0 + (+cell[1] - 0.5) * 2.5 });
          const c0 = ctr(pz.safe[0]);
          b.walkTo(c0.x, G.z0 - 0.6);
          for (const cell of pz.safe) { const c = ctr(cell); b.walkStraight(c.x, c.z); }
          const last = ctr(pz.safe[pz.safe.length - 1]);
          b.walkStraight(last.x, G.z0 + 10.9);
          b.wait(0.5);
          // come back the same way
          for (const cell of pz.safe.slice().reverse()) { const c = ctr(cell); b.walkStraight(c.x, c.z); }
          b.walkStraight(c0.x, G.z0 - 0.6);
        } else {
          b.use(`panel:${pz.id}`);
          b.puzzle(pz.id, pz.solutionHint);
          if (pz.type === 'zonerouting') b.wait(4.5);
        }
        expect(g.isPuzzleDone(pz.id), `${pz.id} (${pz.type}) solved`);
      } else if (o.kind === 'relay') {
        b.use('xrelay');
        expect(g.story.has('x.relay'), 'relay engaged');
      } else {
        const i = nav.nearest(r.cx, r.cz, (k) => b.okCell(k) && nav.room[k] === r.index, 14);
        const c = i >= 0 ? nav.center(i) : { x: r.cx, z: r.cz };
        b.walkTo(c.x, c.z, { tol: 1.2 });
      }
    }
    expect(g.story.has('x.ready'), 'extraction unlocked');
    b.wait(2);
    b.use('xlift');
    expect(g.over && g.over.kind === 'expedition' && g.over.success, 'extracted');
  } catch (e) { errors.push(e.message); }
  if (g.over && g.over.kind === 'death') errors.push(`died: ${g.over.creature}`);
  return { spec, errors, time: g.elapsed, hits: b.count('hit') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (let s = first; s < first + count; s++) {
    const r = playExpedition(s * 104729, { damage });
    const label = `seed ${r.spec.seedText} · ${r.spec.theme} · ${r.spec.puzzles.map((p) => p.type).join('/')}`;
    if (r.errors.length) { fails++; console.log(`FAIL ${label}: ${r.errors.join('; ')}`); } else console.log(`ok   ${label} · ${Math.round(r.time)} s · hits ${r.hits}`);
  }
  console.log(fails ? `\n${fails} failing run(s)` : '\nall expedition runs completed');
  process.exit(fails ? 1 : 0);
}
