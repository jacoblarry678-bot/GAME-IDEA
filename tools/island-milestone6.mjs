// Milestone 6 checks: seasons, the Benton Pass, cosmetics (emotes, gliders,
// pass outfits), weekly challenges, achievements, season rollover, and
// cosmetics reaching other players online (needs `npm run island:server`).
// Usage: node tools/island-milestone6.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
async function open(label, w = 1100, h = 700) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message} ${(e.stack || '').split('\n')[1]}`));
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1300);
  await p.evaluate(() => (__bi.input.lockBlocked = true));
  return p;
}
const waitFor = async (p, fn, ms = 15000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); } return false; };

const p = await open('solo');
const ev = (fn, arg) => p.evaluate(fn, arg);

// ---- season and pass basics
const s0 = await ev(() => { const S = __bi.season; const s = S.seasonAt(); return { n: s.n, name: s.name, days: S.daysLeft(), tier: S.passTier(), btn: document.querySelector('[data-act=pass]')?.textContent, ach: !!document.querySelector('[data-act=achievements]') }; });
check('Season 1 (Crankbolt Rising) is running, the pass starts at tier 0, and the lobby has Pass and Achievements buttons', s0.n === 1 && s0.name === 'Crankbolt Rising' && s0.days > 0 && s0.days <= 56 && s0.tier === 0 && /Tier 0/.test(s0.btn) && s0.ach, JSON.stringify(s0));
await p.click('[data-act=pass]');
await p.waitForTimeout(200);
const passUi = await ev(() => ({ tiers: document.querySelectorAll('.tier').length, weekly: document.querySelectorAll('.pass .chal').length, head: document.querySelector('.pass h2').textContent }));
await p.screenshot({ path: `${shots}/m6-01-pass.png` });
check('Pass screen: 20 reward tiers, 5 weekly challenges, the season countdown', passUi.tiers === 20 && passUi.weekly === 5 && /ends in \d+ day/.test(passUi.head), JSON.stringify(passUi));
await p.click('[data-act=main]');

// ---- earning tiers unlocks cosmetics
const up = await ev(() => {
  const S = __bi.season;
  const pool0 = __bi.supercharge.superXP().pool = 0;
  const r = S.addPassXP(3 * S.TIER_XP);
  return { after: r.after, got: r.got.map((g) => g.kind + ':' + (g.id || '')), glider: S.owns('glider', 'pickle'), emote: S.owns('emote', 'wave'), pool: __bi.supercharge.superXP().pool, pool0, locked: S.owns('emote', 'robo') };
});
check('3 tiers of XP unlock the Pickle Parachute glider, the Big Wave emote and a Supercharged XP top-up (later rewards stay locked)', up.after === 3 && up.glider && up.emote && up.pool === 2500 && !up.locked, JSON.stringify(up));

// ---- locker: equip / refuse locked
await p.click('[data-act=locker]');
await p.waitForTimeout(200);
const lk = await ev(() => ({ emotes: document.querySelectorAll('.cos[data-kind=emote]').length, gliders: document.querySelectorAll('.cos[data-kind=glider]').length, lockedRobo: document.querySelector('.cos[data-kind=emote][data-id=robo]').classList.contains('locked'), passOutfit: [...document.querySelectorAll('.outfit')].pop().textContent }));
await p.click('.cos[data-kind=emote][data-id=wave]');
await p.waitForTimeout(150);
await p.click('.cos[data-kind=glider][data-id=pickle]');
await p.waitForTimeout(150);
await p.screenshot({ path: `${shots}/m6-02-locker.png` });
const eq = await ev(() => __bi.season.equipped('colton'));
const refused = await ev(() => __bi.season.equip('emote', 'robo'));
await p.click('.cos[data-kind=emote][data-id=robo]'); // a locked one opens the pass
await p.waitForTimeout(150);
const toPass = await ev(() => __bi.menus.current === 'pass');
check('Locker lists 6 emotes and 7 gliders; equipping owned ones works, locked ones are refused and link to the pass; pass outfits show their tier', lk.emotes === 6 && lk.gliders === 7 && lk.lockedRobo && /Pass tier 10/.test(lk.passOutfit) && eq.emote === 'wave' && eq.glider === 'pickle' && !refused && toPass, JSON.stringify({ lk, eq, refused, toPass }));

// ---- pass outfits
const outfit = await ev(() => {
  const S = __bi.season;
  const r = S.addPassXP(10 * S.TIER_XP - S.pass().xp);
  const got = r.got.map((g) => g.kind + ':' + g.id);
  __bi.menus.showLocker();
  const btn = [...document.querySelectorAll('.outfit')][3];
  btn.click();
  return { tier: r.after, got, name: btn.querySelector('b').textContent, equipped: __bi.save.data.profile.outfits.colton };
});
check('Tier 10 unlocks the Crankbolt Rider outfit for Colton, and it can be worn', outfit.tier === 10 && outfit.got.includes('outfit:colton:3') && outfit.name === 'Crankbolt Rider' && outfit.equipped === 3, JSON.stringify(outfit));
await ev(() => __bi.menus.showMain());

// ---- a match: cosmetics in game, results feed the pass, weekly challenges and achievements
await p.click('[data-act=team][data-id="2"]'); // duos, for the squad-win achievement
await p.click('[data-act=play]');
await p.waitForTimeout(700);
const inGame = await ev(() => { const P = __bi.game.player; return { emote: P.model.emoteId, glider: P.model.glider.children[0].material.map?.image?.width }; });
const anim = await ev(() => {
  const g = __bi.game, P = g.player;
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(P);
  for (let i = 0; i < 60 * 40 && !['ground', 'swim'].includes(P.state); i++) __bi.engine.step(1 / 60);
  const seen = {};
  for (const e of ['sig', 'wave', 'hop', 'robo', 'guitar', 'lap']) {
    P.model.emoteId = e;
    P.emote = true;
    let moved = 0;
    const a0 = P.model.arms[0].rotation.x;
    for (let i = 0; i < 20; i++) { __bi.engine.step(1 / 60); moved = Math.max(moved, Math.abs(P.model.arms[0].rotation.x - a0) + Math.abs(P.model.hips.position.y - 0.8)); }
    seen[e] = moved > 0.01 || P.model.arms[0].rotation.x < -1;
  }
  P.model.emoteId = 'wave';
  return seen;
});
check('in a match the player wears the equipped emote and glider; all 6 emotes animate', inGame.emote === 'wave' && inGame.glider === 256 && Object.values(anim).every(Boolean), JSON.stringify({ inGame, anim }));
await ev(() => {
  const s = __bi.save.data;
  const w = __bi.season.weeklyChallenges();
  w.list = [{ id: 'play', prog: 9, done: false }, { id: 'elims', prog: 0, done: false }, { id: 'chests', prog: 0, done: false }, { id: 'doors', prog: 0, done: false }, { id: 'zip', prog: 0, done: false }];
  __bi.save.write();
  window.pass0 = __bi.season.pass().xp;
  window.xp0 = s.progress.xp;
});
await ev(() => { const g = __bi.game; for (const a of g.actors) if (a.team !== g.player.team && a.alive) { a.state = 'ground'; g.eliminate(a, g.player, {}); } });
await p.waitForTimeout(900);
const res = await ev(() => {
  const r = __bi.game.result;
  return {
    xp: r.xp, gained: __bi.save.data.progress.xp - xp0, pass: __bi.season.pass().xp - pass0, weeklyXP: r.weeklyXP, weekly: r.weekly.map((w) => w.id),
    ach: r.achievements.map((a) => a.id), achXP: r.achXP, text: document.querySelector('.result').textContent.replace(/\s+/g, ' '),
  };
});
await p.screenshot({ path: `${shots}/m6-03-result.png` });
check('winning a Duos match: weekly challenge done (+3,000), achievements unlocked (first win, squad win, +1,000 each), and all XP also fills the pass', res.weekly.includes('play') && res.weeklyXP === 3000 * res.weekly.length && res.ach.includes('first_win') && res.ach.includes('squad_win') && res.achXP >= 2000 && res.gained === res.xp && res.pass === res.xp && /Achievement/.test(res.text) && /Weekly challenge/.test(res.text), JSON.stringify({ ...res, text: res.text.slice(0, 200) }));
await p.click('[data-act=quit]');
await p.waitForTimeout(500);
await p.click('[data-act=achievements]');
await p.waitForTimeout(200);
const achUi = await ev(() => ({ n: document.querySelectorAll('.ach').length, done: document.querySelectorAll('.ach.done').length, head: document.querySelector('.sheet h2').textContent }));
await p.screenshot({ path: `${shots}/m6-04-achievements.png` });
check('Achievements screen: 16 medals, the unlocked ones lit', achUi.n === 16 && achUi.done >= 2, JSON.stringify(achUi));
await p.click('[data-act=main]');

// ---- season rollover
const roll = await ev(() => {
  const S = __bi.season, R = __bi.ranked;
  const r = R.rankState('build');
  Object.assign(r, { d: 10, rp: 40, mmr: 1300, matches: 20, peak: 11 });
  const owned = S.pass().owned.length;
  S.pass().season = 0; // pretend the last visit was in an older season
  const rec = S.seasonCheck();
  return { rec, d: r.d, rp: r.rp, peak: r.peak, mmr: r.mmr, passXP: S.pass().xp, owned: S.pass().owned.length === owned, again: S.seasonCheck() };
});
check('a new season records last season (pass tier, peak rank), drops ranks two tiers, restarts the pass and keeps unlocked cosmetics', roll.rec && roll.rec.ranks.build === 11 && roll.d === 4 && roll.rp === 0 && roll.peak === 4 && roll.mmr < 1300 && roll.passXP === 0 && roll.owned && roll.again === null, JSON.stringify(roll));
await ev(() => __bi.menus.showPass());
const pastUi = await ev(() => document.querySelector('.pass').textContent);
check('the Pass screen lists past seasons', /Past seasons/.test(pastUi) && /Season 0: pass tier/.test(pastUi));
await ev(() => __bi.menus.showMain());

// ---- online: other players see your emote and glider
const H = await open('host', 960, 540);
const C = await open('client', 960, 540);
await C.evaluate(() => { const S = __bi.season; S.addPassXP(6 * S.TIER_XP); S.equip('emote', 'hop'); S.equip('glider', 'storm'); });
await H.click('[data-act=online]');
await waitFor(H, () => !!document.querySelector('[data-act=host]'));
await H.click('[data-act=host]');
await waitFor(H, () => !!document.querySelector('.code'));
const code = (await H.textContent('.code')).trim().toLowerCase();
await C.click('[data-act=online]');
await waitFor(C, (c) => !!document.querySelector(`[data-act=join][data-code="${c}"]`), 15000, code);
await C.click(`[data-act=join][data-code="${code}"]`);
await waitFor(H, () => document.querySelectorAll('.player-row').length === 2, 15000);
await H.click('[data-act=start-online]');
await waitFor(C, () => __bi.game.role === 'client' && !!__bi.game.world, 15000);
const onl = await H.evaluate(() => { const a = __bi.game.actors[1]; return { emote: a.model.emoteId, glider: !!a.model.glider.children[0].material.map }; });
const onlC = await C.evaluate(() => __bi.game.player.model.emoteId);
check("online: the host's copy of the client wears the client's equipped emote (Pickle Hop) and glider", onl.emote === 'hop' && onl.glider && onlC === 'hop', JSON.stringify({ onl, onlC }));

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} milestone-6 checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
