// Admin panel checks (owner only): who sees it, progression tools, match
// tools, and that a match where they're used doesn't count.
// Usage: node tools/island-admin.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const waitFor = async (fn, ms = 15000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await p.waitForTimeout(150); } return false; };
const frames = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const tool = async (op, arg = '') => { await p.click(`[data-act=adm][data-op="${op}"]${arg !== '' ? `[data-arg="${arg}"]` : ''}`); await frames(); return ev(() => document.querySelector('.adm-msg')?.textContent || ''); };

await p.goto(url, { waitUntil: 'load' });
await ev(() => localStorage.clear());
await p.reload({ waitUntil: 'load' });
await waitFor(() => __bi.owner.checked, 12000);
await p.waitForTimeout(300);

// ---- who sees it
const ownerView = await ev(() => ({ is: __bi.owner.is, how: __bi.owner.how, btn: !!document.querySelector('.lobby [data-act=admin]') }));
check('the owner (running it on this computer) sees an Admin button in the lobby', ownerView.is && ownerView.btn && /this computer/.test(ownerView.how), JSON.stringify(ownerView));
const guest = await ev(() => {
  __bi.owner.is = false;
  __bi.menus.showMain();
  const btn = !!document.querySelector('.lobby [data-act=admin]');
  __bi.menus.act('admin', {});
  const opened = __bi.menus.current === 'admin';
  __bi.owner.is = true;
  __bi.menus.showMain();
  return { btn, opened };
});
check('anyone else sees no Admin button, and the admin screen refuses to open for them', !guest.btn && !guest.opened, JSON.stringify(guest));

// ---- who counts as the owner in other places the game can run
// (a separate context each, with the same game; no localStorage involved)
async function ownerIn(setup, frameUrl) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
  if (setup) await ctx.addInitScript(setup.fn, setup.arg);
  const q = await ctx.newPage();
  await q.goto(url, { waitUntil: 'load' });
  if (frameUrl) await q.setContent(frameUrl); // the parent page lives on the same server; Chrome won't frame localhost from about:blank
  const f = frameUrl ? q.frames()[1] : q.mainFrame();
  const t0 = Date.now();
  let r = null;
  while (Date.now() - t0 < 15000) {
    r = await f.evaluate(() => (window.__bi && __bi.owner.checked ? { is: __bi.owner.is, how: __bi.owner.how, btn: !!document.querySelector('.lobby [data-act=admin]'), host: location.hostname } : null)).catch(() => null);
    if (r) break;
    await q.waitForTimeout(200);
  }
  await ctx.close();
  return r;
}
const fakeRuntime = { fn: (own) => { window.claude = { use: async (n) => (n === 'user' ? { isOwner: async () => own } : null) }; } };
const rtNo = await ownerIn({ ...fakeRuntime, arg: false });
const rtYes = await ownerIn({ ...fakeRuntime, arg: true });
check('on the game link, the platform decides: a viewer who is not the owner gets no Admin, the owner does', rtNo && !rtNo.is && !rtNo.btn && rtYes && rtYes.is && rtYes.btn && /own this game link/.test(rtYes.how), JSON.stringify({ rtNo, rtYes }));
const embedded = await ownerIn(null, `<iframe src="${url}" style="width:880px;height:520px"></iframe>`);
check('the game embedded in another page (even from this computer) is not the owner', embedded && !embedded.is && !embedded.btn, JSON.stringify(embedded));
let sandboxed = null;
try {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../battle-island/build/battle-island.html', import.meta.url), 'utf8');
  sandboxed = await ownerIn(null, `<iframe sandbox="allow-scripts" style="width:880px;height:520px" srcdoc="${html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`);
} catch (e) {
  sandboxed = { error: e.message };
}
check('a sandboxed copy with a blank hostname (how shared links used to slip through) is not the owner', sandboxed && sandboxed.host === '' && !sandboxed.is && !sandboxed.btn, JSON.stringify(sandboxed));

// ---- progression tools
await p.click('.lobby [data-act=admin]');
await p.waitForTimeout(200);
await p.screenshot({ path: `${shots}/adm-01-lobby-admin.png` });
const lv0 = await ev(() => __bi.game && __bi.save.data.progress.xp);
const m1 = await tool('level', '1');
const m10 = await tool('level', '10');
const lvl = await ev(() => { const x = __bi.save.data.progress.xp; let l = 1, r = x; while (r >= 400 + l * 200) { r -= 400 + l * 200; l++; } return l; });
check('+1 and +10 levels', /level 2/.test(m1) && lvl === 12 && lv0 === 0, JSON.stringify({ m1, m10, lvl }));
await ev(() => { __bi.supercharge.superXP().pool = 0; __bi.save.write(); });
const sm = await tool('super');
const pool = await ev(() => __bi.supercharge.superXP().pool);
check('refill Supercharged XP', pool === 7500 && /7,500/.test(sm), sm);
await p.selectOption('#adm-rank', '7');
const rm = await tool('rank', '');
const rk = await ev(() => { const s = __bi.ranked.rankState('build'); return { d: s.d, name: __bi.ranked.divName(s.d), mmr: s.mmr, placed: s.matches >= 3 }; });
const pm = await tool('rp', '95');
const rp = await ev(() => __bi.ranked.rankState('build').rp);
await tool('rank', '-1');
const reset = await ev(() => __bi.ranked.rankState('build').d);
check('set the rank from the ladder (Gold II), set its progress, and reset it to Unranked', rk.name === 'Gold II' && rk.mmr === 1020 && rk.placed && rp === 95 && reset === -1 && /Rank set/.test(rm), JSON.stringify({ rm, rk, pm, rp, reset }));
await tool('chal-done');
const done = await ev(() => __bi.challenges.dailyChallenges().list.every((c) => c.done));
await tool('chal-reset');
const undone = await ev(() => __bi.challenges.dailyChallenges().list.every((c) => !c.done && c.prog === 0));
check("mark today's challenges done, and reset them", done && undone);
await p.click('[data-act=main]');

// ---- match tools
await ev(() => (__bi.input.lockBlocked = true));
await p.click('[data-act=queue][data-id=ranked]'); // a ranked match, to prove admin matches don't count
await p.click('[data-act=play]');
await p.waitForTimeout(700);
await ev(() => {
  const g = __bi.game;
  while (g.busT < 1.8) __bi.engine.step(1 / 60);
  g.jumpFromBus(g.player);
  for (let i = 0; i < 60 * 40 && !['ground', 'swim'].includes(g.player.state); i++) __bi.engine.step(1 / 60);
  window.rank0 = JSON.stringify(__bi.ranked.rankState('build'));
  window.xp0 = __bi.save.data.progress.xp;
  window.chal0 = JSON.stringify(__bi.challenges.dailyChallenges().list);
});
await p.keyboard.press('Backquote');
const hot = await waitFor(() => __bi.menus.current === 'admin-match', 3000);
check('` opens the admin tools mid-match (and pauses a solo match)', hot && (await ev(() => __bi.game.paused)));
await p.click('[data-act=pause-back]');
await p.waitForTimeout(200);
const pauseBtn = await ev(() => !!document.querySelector('[data-act=admin-match]'));
await p.click('[data-act=admin-match]');
await p.waitForTimeout(200);
await p.screenshot({ path: `${shots}/adm-02-match-admin.png` });
check('the pause menu has an Admin button for the owner', pauseBtn && (await ev(() => __bi.menus.current === 'admin-match')));

const god = await tool('god');
const godHit = await ev(() => { const g = __bi.game, P = g.player; P.hp = 100; P.shield = 0; g.applyDamage(P, 80, g.actors[3], {}); return P.hp; });
check('God mode: damage does nothing to you (and the match is now flagged)', /God mode ON/.test(god) && godHit === 100 && (await ev(() => __bi.game.adminUsed)), JSON.stringify({ god, godHit }));
await tool('god');
await ev(() => { const P = __bi.game.player; P.hp = 20; P.shield = 0; });
await tool('heal');
const lo = await tool('loadout');
const my = await tool('mythic');
await tool('mats');
await tool('bucks');
await tool('keycard');
const inv = await ev(() => { const P = __bi.game.player; return { hp: P.hp, sh: P.shield, slots: P.slots.map((s) => s && (s.kind === 'weapon' ? `${s.id}:${s.rarity}` : s.kind)), mythics: [...P.slots, ...__bi.game.loot.pickups.map((k) => k.it)].filter((s) => s && s.kind === 'weapon' && s.rarity === 5).length, wood: P.mats.wood, bucks: P.bucks, key: [...P.slots, ...__bi.game.loot.pickups.map((k) => k.it)].some((s) => s && s.kind === 'key') }; });
check('heal, starter loadout, Mythic weapons, max materials, +500 Bucks and a Vault Keycard', inv.hp === 100 && inv.sh === 100 && inv.mythics === 2 && inv.wood === 999 && inv.bucks === 500 && inv.key, JSON.stringify(inv));

const tp = await tool('tp', 'park');
const at = await ev(() => { const P = __bi.game.player; return Math.hypot(P.pos.x - 72, P.pos.z - 68); });
await ev(() => __bi.game.setMarker(-40, 40));
const tpm = await tool('tp', 'marker');
const atm = await ev(() => { const P = __bi.game.player; return Math.hypot(P.pos.x + 40, P.pos.z - 40); });
check('teleport to a named place (Pickles Park) and to your map marker', at < 1 && atm < 1 && /Pickles Park/.test(tp), JSON.stringify({ tp, at, tpm, atm }));

const st0 = await ev(() => ({ stage: __bi.game.storm.stage, phase: __bi.game.storm.phase }));
await tool('storm-skip');
// the solo match is paused while the panel is open: run it briefly for each check
const run = (sec) => ev((s) => { const g = __bi.game; g.paused = false; for (let i = 0; i < s * 60; i++) __bi.engine.step(1 / 60); g.paused = true; }, sec);
await run(1 / 60);
const st1 = await ev(() => ({ stage: __bi.game.storm.stage, phase: __bi.game.storm.phase }));
await tool('storm-pause');
const frozenStorm = await ev(() => { const g = __bi.game, s = g.storm; const t = s.timer; g.paused = false; for (let i = 0; i < 60; i++) __bi.engine.step(1 / 60); g.paused = true; return Math.abs(s.timer - t) < 0.001; });
await tool('storm-pause');
check('storm: skip to the next step, pause and resume', st0.stage === 'wait' && st1.stage === 'shrink' && frozenStorm, JSON.stringify({ st0, st1, frozenStorm }));

const fz = await ev(() => {
  // wait for a bot that has landed (frozen bots still fall if they're in the air)
  const g = __bi.game;
  g.paused = false;
  let b = null;
  for (let i = 0; i < 60 * 40 && !b; i++) { __bi.engine.step(1 / 60); b = g.actors.find((a) => a.brain && a.alive && a.state === 'ground'); }
  g.paused = true;
  return b ? b.id : -1;
});
await tool('freeze');
const still = await ev((id) => {
  const g = __bi.game, a = g.actors[id];
  if (!a) return 'no bot';
  g.paused = false;
  for (let i = 0; i < 30; i++) __bi.engine.step(1 / 60); // a running bot skids to a stop
  const p0 = a.pos.clone();
  for (let i = 0; i < 120; i++) __bi.engine.step(1 / 60);
  g.paused = true;
  return a.pos.distanceTo(p0) < 0.05 || `moved ${a.pos.distanceTo(p0).toFixed(2)} (${a.state})`;
}, fz);
await tool('freeze');
check('freeze bots in place (and let them go)', still === true, String(still));

const kart = await tool('vehicle', 'kart');
const kd = await ev(() => { const g = __bi.game; return Math.min(...g.vehicles.list.filter((v) => v.type === 'kart').map((v) => v.pos.distanceTo(g.player.pos))); });
await tool('supply');
const drop = await ev(() => __bi.game.loot.drops.length);
check('bring a kart in front of you; call a supply drop', kd < 7 && drop >= 1 && /Pickle Kart/.test(kart), JSON.stringify({ kart, kd, drop }));

const bk = await tool('boss-kill');
const bossDown = await ev(() => !__bi.game.boss.alive && __bi.game.loot.pickups.some((k) => k.it.kind === 'weapon' && k.it.rarity === 5 && k.pos.distanceTo(__bi.game.boss.home) < 20));
await tool('boss-reset');
const bossBack = await ev(() => __bi.game.boss.alive && __bi.game.boss.hp === 2000 && __bi.game.boss.pos.distanceTo(__bi.game.boss.home) < 0.1);
await tool('vault');
const vaultOpen = await ev(() => __bi.game.world.vault.open);
check('defeat Crankbolt (its loot drops), reset it, and open the vault', bossDown && bossBack && vaultOpen, bk);

const sp = await tool('speed', '2');
const ts = await ev(() => __bi.engine.timeScale);
await tool('speed', '1');
check('solo game speed ×2 and back', ts === 2 && /×2/.test(sp), sp);

const guestMsg = await ev(() => {
  const g = __bi.game;
  const role = g.role;
  g.role = 'client';
  __bi.menus.showAdminMatch();
  const text = document.querySelector('.admin').textContent;
  g.role = role;
  return text;
});
check("in someone else's match the tools are refused (guest message, no buttons)", /guest in someone else's match/.test(guestMsg) && !/God mode/.test(guestMsg), guestMsg.slice(0, 120));

// finish the match: it must not count
await ev(() => __bi.menus.showAdminMatch());
await tool('clear-bots');
await p.waitForTimeout(800);
const res = await ev(() => ({
  r: __bi.game.result, note: document.querySelector('.adm-note')?.textContent,
  rank: JSON.stringify(__bi.ranked.rankState('build')) === rank0, xp: __bi.save.data.progress.xp === xp0, chal: JSON.stringify(__bi.challenges.dailyChallenges().list) === chal0,
}));
await p.screenshot({ path: `${shots}/adm-03-result.png` });
check("remove the bots to win: the match gives no XP, rank or challenge progress, and the result says why", res.r && res.r.admin && res.r.won && res.r.xp === 0 && !res.r.ranked && res.rank && res.xp && res.chal && /doesn't count/.test(res.note || ''), JSON.stringify({ ...res, r: res.r && { admin: res.r.admin, won: res.r.won, xp: res.r.xp } }));
const next = await ev(() => { __bi.play(); return __bi.game.adminUsed === false && !__bi.game.admin.god; });
check('the next match starts clean (no admin flags carried over)', next);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} admin checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
