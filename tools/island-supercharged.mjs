// Supercharged XP (daily bonus pool) and Supercharged rank checks: the math and the UI.
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
const winMatch = () => ev(() => { const g = __bi.game; for (const a of g.actors) if (a !== g.player && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1500);

// ---- Supercharged XP
const fresh = await ev(() => ({ pool: __bi.supercharge.superXP().pool, bar: document.querySelector('.super-xp.on')?.textContent.replace(/\s+/g, ' ').trim() }));
check('new players start with a full day of Supercharged XP, shown in the lobby', fresh.pool === 2500 && /2,500/.test(fresh.bar || ''), JSON.stringify(fresh));

const refill = await ev(() => {
  const S = __bi.supercharge, s = S.superXP();
  s.pool = 0; s.day -= 1;
  const one = S.superXP().pool;
  s.day -= 10;
  const many = S.superXP().pool;
  return { one, many };
});
check('pool refills +2,500 per day and banks up to 3 days (7,500)', refill.one === 2500 && refill.many === 7500, JSON.stringify(refill));

await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=play]');
await p.waitForTimeout(600);
await winMatch();
await p.waitForTimeout(700);
const r1 = await ev(() => ({ xp: __bi.game.result.xp, chal: __bi.game.result.chalXP + (__bi.game.result.weeklyXP || 0) + (__bi.game.result.achXP || 0), sup: __bi.game.result.superXP, pool: __bi.supercharge.superXP().pool, topUp: !!(__bi.game.result.pass?.got || []).some((r) => r.kind === 'super'), saved: __bi.save.data.progress.xp, line: [...document.querySelectorAll('.sx-won')].map((e) => e.textContent).find((t) => /Supercharged XP/.test(t)) }));
await p.screenshot({ path: `${shots}/sc-01-result.png` });
check('match XP is doubled from the pool and the result says so', r1.sup > 0 && r1.xp === r1.sup * 2 + r1.chal && r1.pool === (r1.topUp ? 7500 : 7500 - r1.sup) /* a pass tier can top the pool back up */ && r1.saved === r1.xp && /Supercharged XP/.test(r1.line || ''), JSON.stringify(r1));

const partial = await ev(() => { __bi.supercharge.superXP().pool = 100; return [__bi.supercharge.superchargeXP(900), __bi.supercharge.superXP().pool, __bi.supercharge.superchargeXP(900)]; });
check('bonus stops when the pool runs out', partial[0] === 100 && partial[1] === 0 && partial[2] === 0, JSON.stringify(partial));
await p.click('[data-act=quit]');
await p.waitForTimeout(600);
const empty = await ev(() => document.querySelector('.super-xp')?.textContent.replace(/\s+/g, ' ').trim());
check('lobby shows an empty pool with the refill timer', /Used up · refills in \d+(h \d+)?m/.test(empty || '') && !(await ev(() => !!document.querySelector('.super-xp.on'))), empty);

// ---- Supercharged rank
const math = await ev(() => {
  const R = __bi.ranked, s = R.rankState('build');
  const set = (d, lead, rp = 50) => Object.assign(s, { d, rp, mmr: R.divisionMMR(d) + lead, matches: 20 });
  const play = (place, kills) => R.applyRanked('build', { won: place === 1, place, total: 20, kills }, s.mmr);
  set(6, 150); const superOn = R.isSupercharged(s);
  const lastSuper = play(20, 0);
  set(6, 60); const offNear = R.isSupercharged(s);
  const lastNormal = play(20, 0);
  // same lead just under / over the threshold: gains x1.5
  set(6, 89); const gainNormal = play(3, 2).dRP;
  set(6, 90); const gainSuper = play(3, 2);
  set(18, 500); const legend = R.isSupercharged(s);
  Object.assign(s, { d: -1, mmr: 1500, matches: 0 }); const placing = R.isSupercharged(s);
  return { superOn, offNear, lastSuper: [lastSuper.dRP, lastSuper.supercharged], lastNormal: lastNormal.dRP, gainNormal, gainSuper: [gainSuper.dRP, gainSuper.supercharged], hist: s.history.find((h) => h.sup) ? 1 : 0, legend, placing };
});
check('Supercharged rank turns on when MMR leads the rank by 90+ (not at Legend or in placement)', math.superOn && !math.offNear && !math.legend && !math.placing, JSON.stringify(math));
check('Supercharged: a bad match costs no RP (normally it does)', math.lastSuper[0] === 0 && math.lastSuper[1] && math.lastNormal < 0, JSON.stringify({ s: math.lastSuper, n: math.lastNormal }));
check('Supercharged: rank gains are about x1.5', math.gainSuper[1] && math.gainSuper[0] >= Math.round(math.gainNormal * 1.4) && math.gainSuper[0] <= Math.round(math.gainNormal * 1.6) + 1, JSON.stringify({ n: math.gainNormal, s: math.gainSuper }));

// ---- Supercharged rank UI: lobby card, HUD, result, Ranked screen
await ev(() => { const R = __bi.ranked, s = R.rankState('build'); Object.assign(s, { d: 4, rp: 20, mmr: R.divisionMMR(4) + 200, matches: 10 }); __bi.save.write(); });
await p.click('[data-act=queue][data-id=ranked]');
await p.waitForTimeout(300);
const lobby = await ev(() => ({ tag: !!document.querySelector('.rank-card.super .sc-tag'), text: document.querySelector('.rank-card').textContent.replace(/\s+/g, ' ').trim() }));
await p.screenshot({ path: `${shots}/sc-02-lobby.png` });
check('lobby rank card shows the Supercharged tag', lobby.tag && /Supercharged/.test(lobby.text), lobby.text);
await p.click('[data-act=play]');
await p.waitForTimeout(700);
const pill = await ev(() => document.querySelector('.ranked-pill').textContent);
check('ranked HUD shows SUPERCHARGED', /SUPERCHARGED/.test(pill), pill);
await winMatch();
await p.waitForTimeout(700);
const res = await ev(() => ({ k: __bi.game.result.ranked, text: document.querySelector('.rank-result')?.textContent.replace(/\s+/g, ' ').trim() }));
await p.screenshot({ path: `${shots}/sc-03-rank-result.png` });
check('result shows the Supercharged boost', res.k.supercharged && /Supercharged ×1.5/.test(res.text || '') && res.k.dRP > 0, res.text);
await p.click('[data-act=quit]');
await p.waitForTimeout(500);
await p.click('.rank-card');
await p.waitForTimeout(300);
const scr = await ev(() => ({ tag: document.querySelector('.rank-panel .sc-tag')?.textContent, bolt: /⚡/.test(document.querySelector('.rank-panel .hist').textContent), how: /Supercharged rank/.test(document.querySelector('.howto').textContent) }));
await p.screenshot({ path: `${shots}/sc-04-ranked.png` });
check('Ranked screen: tag, ⚡ on boosted matches, and an explanation', scr.bolt && scr.how, JSON.stringify(scr));
await p.click('[data-act=main]');

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} supercharged checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
