// Ranked + MMR checks: the rating math, matchmaking (bot difficulty), and the UI.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(1500);

const math = await ev(() => {
  const R = __bi.ranked;
  const s = R.rankState('build');
  const out = { start: { d: s.d, mmr: s.mmr } };
  const game = (place, kills, rating = s.mmr) => R.applyRanked('build', { won: place === 1, place, total: 20, kills }, rating);
  const p1 = game(1, 5), p2 = game(4, 3), p3 = game(9, 1);
  out.placement = [p1.placementLeft, p2.placementLeft, p3.placed, R.divName(s.d), s.mmr];
  // strong run: wins should promote
  const d0 = s.d;
  let promos = 0;
  for (let i = 0; i < 6; i++) if (game(1, 6).promoted) promos++;
  out.climb = { from: d0, to: s.d, promos, mmr: s.mmr };
  // bad run: lose RP and MMR, but never a division
  const dBefore = s.d, mmrBefore = s.mmr;
  const bad = [];
  for (let i = 0; i < 8; i++) bad.push(game(20, 0).dRP);
  out.slump = { dBefore, dAfter: s.d, rp: s.rp, mmrDrop: mmrBefore - s.mmr, allLosses: bad.every((x) => x <= 0) };
  // expectation matters: a mid placement against a much tougher lobby gains MMR, against a weaker one loses
  out.expect = { vsHard: game(10, 0, s.mmr + 400).dMMR, vsEasy: game(10, 0, s.mmr - 400).dMMR };
  // Zero Build rank is separate
  out.zb = R.rankState('zerobuild').matches;
  // matchmaking: bots scale with MMR
  out.bots = [R.botSkillRange(700), R.botSkillRange(1000), R.botSkillRange(1500)].map((r) => r.map((v) => +v.toFixed(2)));
  out.history = s.history.length;
  return out;
});
check('3 placement matches, then a starting rank from MMR (capped at Platinum I)', math.placement[0] === 2 && math.placement[1] === 1 && math.placement[2] === true && math.start.d === -1, JSON.stringify(math.placement));
check('winning streak promotes and raises MMR', math.climb.to > math.climb.from && math.climb.promos >= 1 && math.climb.mmr > 1000, JSON.stringify(math.climb));
check('losing streak costs RP and MMR but never a division', math.slump.dAfter === math.slump.dBefore && math.slump.allLosses && math.slump.mmrDrop > 0 && math.slump.rp >= 0, JSON.stringify(math.slump));
check('MMR change depends on the lobby rating (expected result)', math.expect.vsHard > 0 && math.expect.vsEasy < 0, JSON.stringify(math.expect));
check('Build and Zero Build ranks are separate; history kept (last 10)', math.zb === 0 && math.history === 10);
check('matchmaking: higher MMR means tougher bots', math.bots[0][0] < math.bots[1][0] && math.bots[1][0] < math.bots[2][0], JSON.stringify(math.bots));

// ---- UI: reset to a fresh profile and play one ranked match
await ev(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);
const card0 = await p.textContent('.rank-card');
await p.click('[data-act=queue][data-id=ranked]');
await ev(() => (__bi.input.lockBlocked = true));
await p.screenshot({ path: `${shots}/rk-01-lobby.png` });
await p.click('[data-act=play]');
await p.waitForTimeout(800);
const inMatch = await ev(() => {
  const g = __bi.game;
  const [lo, hi] = __bi.ranked.botSkillRange(g.lobbyRating);
  const skills = g.actors.filter((a) => a.brain).map((a) => a.brain.skill);
  return { ranked: g.ranked, rating: g.lobbyRating, inRange: skills.every((k) => k >= lo - 1e-9 && k <= hi + 1e-9), pill: document.querySelector('.ranked-pill').textContent };
});
check('Ranked queue: match is ranked, bots tuned to your MMR, HUD shows it', inMatch.ranked && inMatch.rating === 1000 && inMatch.inRange && /RANKED/.test(inMatch.pill), JSON.stringify(inMatch));
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(800);
const res = await ev(() => ({ r: __bi.game.result.ranked, card: !!document.querySelector('.rank-result'), text: document.querySelector('.rank-result')?.textContent.replace(/\s+/g, ' ').trim() }));
await p.screenshot({ path: `${shots}/rk-02-result.png` });
check('results show the rank change (placement 1 of 3, MMR up)', res.card && res.r.placementLeft === 2 && res.r.dMMR > 0, res.text);
await p.click('[data-act=quit]');
await p.waitForTimeout(800);
const card1 = await p.textContent('.rank-card');
check('lobby rank card updates', /2 placement matches left/.test(card1) && /1 placement|3 placement/.test(card0) === true, `${card0.replace(/\s+/g, ' ')} → ${card1.replace(/\s+/g, ' ')}`);
await p.click('.rank-card');
await p.waitForTimeout(300);
const screen = await ev(() => ({ panels: document.querySelectorAll('.rank-panel').length, rows: document.querySelectorAll('.rank-panel .hist tr').length, ladder: document.querySelectorAll('.ladder-step').length }));
await p.screenshot({ path: `${shots}/rk-03-screen.png` });
check('Ranked screen: Build + Zero Build panels, match history, full ladder', screen.panels === 2 && screen.rows >= 3 && screen.ladder === 19, JSON.stringify(screen));
await p.click('[data-act=main]');

// casual matches don't touch rank
await p.click('[data-act=queue][data-id=casual]');
const before = await ev(() => JSON.stringify(__bi.ranked.rankState('build')));
await p.click('[data-act=play]');
await p.waitForTimeout(600);
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(500);
const after = await ev(() => JSON.stringify(__bi.ranked.rankState('build')));
check('casual matches leave rank and MMR untouched', before === after && (await ev(() => !__bi.game.ranked && !__bi.game.result.ranked)));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} ranked checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
