/**
 * Milestone 3 browser flow: Armory, Store purchase → confirm → inventory →
 * equip → visible in match, insufficient funds, Battle Pass premium (test) +
 * claims, Challenges, match rewards applied once.
 * Usage: node tools/m3.mjs [url] [outDir]
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(m.text()); });
await p.addInitScript(() => {
  if (sessionStorage.getItem('m3-init')) return;
  sessionStorage.setItem('m3-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
const S = (n) => p.screenshot({ path: `${out}/m3-${n}.png` });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
await p.waitForTimeout(600);
await S('01-menu');
const start = await ev(() => { const d = window.__ashline.profile.data; return { credits: d.credits, level: d.level, owned: Object.keys(d.owned).length }; });
check('fresh profile: level 1, starting test credits, default items', start.level === 1 && start.credits === 1500 && start.owned === 7, JSON.stringify(start));

// Armory
await p.click('.menu-btn[data-go=armory]');
await p.waitForTimeout(500);
await p.click('.tab[data-t=finish]');
await p.waitForTimeout(500);
await S('02-armory-finishes');
const locked = await ev(() => document.querySelectorAll('.inv.locked').length);
check('armory shows locked items with requirements', locked > 10, `${locked} locked finishes`);
await p.click('[data-screen=armory] >> text=Back');
await p.waitForTimeout(300);

// Store: buy a featured item through the UI
await p.click('.menu-btn[data-go=store]');
await p.waitForTimeout(600);
const target = await ev(() => document.querySelector('.shop-it[data-item]')?.dataset.item);
await p.click(`.shop-it[data-item="${target}"]`);
await p.waitForTimeout(300);
await S('03-store');
const before = await ev(() => window.__ashline.profile.data.credits);
await p.click('[data-a=buy]');
await p.waitForTimeout(200);
await p.click('.modal [data-k=ok]');
await p.waitForTimeout(300);
const bought = await ev((id) => ({ owned: window.__ashline.profile.owns(id), credits: window.__ashline.profile.data.credits, hist: window.__ashline.profile.data.purchases.length }), target);
check('store purchase → item in inventory, credits deducted, history logged', bought.owned && bought.credits < before && bought.hist === 1, `${target} ${before}→${bought.credits}`);
await S('04-store-bought');
await p.click('.modal [data-k=equip]');
await p.waitForTimeout(300);
const eq = await ev((id) => window.__ashline.profile.isEquipped(id, window.__ashline.profile.loadout.primary), target);
check('equip from purchase dialog', eq);
// duplicate purchase prevented
const dup = await ev((id) => window.__ashline.profile.buyItem(id), target);
check('duplicate purchase prevented', !dup.ok && dup.reason === 'owned', JSON.stringify(dup));
// insufficient funds
await ev(() => { window.__ashline.profile.data.credits = 0; window.__ashline.screens.refreshTop(); });
await p.waitForTimeout(300);
const other = await ev(() => [...document.querySelectorAll('.shop-it[data-item]')].map((e) => e.dataset.item).find((id) => !window.__ashline.profile.owns(id)));
await p.click(`.shop-it[data-item="${other}"]`);
await p.waitForTimeout(300);
const funds = await ev(() => ({ disabled: document.querySelector('[data-a=buy]')?.disabled, msg: document.querySelector('.detail .warn')?.textContent || '' }));
check('insufficient funds blocks purchase with a message', funds.disabled && funds.msg.includes('Not enough'), JSON.stringify(funds));
await p.click('[data-a=topup]');
await p.waitForTimeout(200);
check('demo test-credit top-up', (await ev(() => window.__ashline.profile.data.credits)) === 1000);
await p.click('.tab[data-v=history]');
await p.waitForTimeout(200);
await S('05-store-history');
await p.click('[data-screen=store] >> text=Back');
await p.waitForTimeout(300);

// Battle pass: premium (test) + claims
await ev(() => { const pr = window.__ashline.profile; pr.data.credits = 2000; pr.addPassXp(5500); pr.save(); });
await p.click('.menu-btn[data-go=pass]');
await p.waitForTimeout(600);
await S('06-pass');
await p.click('[data-a=premium]');
await p.waitForTimeout(200);
await p.click('.modal [data-k=ok]');
await p.waitForTimeout(300);
await p.click('[data-a=claimAll]');
await p.waitForTimeout(300);
const pass = await ev(() => { const pr = window.__ashline.profile; return { premium: pr.data.pass.premium, kestrel: pr.owns('op_kestrel'), kestrelOutfit: pr.owns('of_kestrel_std'), claimedFree: Object.keys(pr.data.pass.claimed.free).length, claimedPrem: Object.keys(pr.data.pass.claimed.premium).length, again: pr.claimAll().length }; });
check('premium pass via test credits; claim all grants tier 1–5 rewards once', pass.premium && pass.kestrel && pass.kestrelOutfit && pass.claimedPrem === 5 && pass.again === 0, JSON.stringify(pass));
await S('07-pass-claimed');
await p.click('[data-screen=pass] >> text=Back');
await p.waitForTimeout(300);

// Challenges
await p.click('.menu-btn[data-go=challenges]');
await p.waitForTimeout(400);
check('5 daily + 3 weekly challenges listed', (await ev(() => document.querySelectorAll('.chal').length)) === 8);
await S('08-challenges');
await p.click('[data-screen=challenges] >> text=Back');
await p.waitForTimeout(300);

// Operator: equip Kestrel and play; cosmetics visible in the match
await ev(() => { const pr = window.__ashline.profile; pr.equip('op_kestrel'); const s = pr.data.matchSetup; s.scoreLimit = 10; s.timeLimit = 3; pr.save(); });
await p.click('.menu-btn[data-go=play]');
await p.waitForTimeout(300);
await p.click('text=Start Match');
await p.waitForTimeout(500);
const inMatch = await ev((id) => { const g = window.__ashline.game; return { vmKey: g.vm.curKey, outfit: g.vm.outfitId, finish: window.__ashline.profile.data.equipped.weapons[g.player.weapon.def.id].finish }; }, target);
check('equipped finish + outfit used by the first-person view in match', inMatch.vmKey.includes('|' + inMatch.finish + '|') && inMatch.outfit === 'of_kestrel_std', JSON.stringify(inMatch));
await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.4); });
await p.waitForTimeout(1500);
await S('09-match-cosmetics');
// play it out with the autopilot
// make one daily deterministic (the rotation is date-seeded)
await ev(() => { const d = window.__ashline.profile.data; if (!d.challenges.daily.some((c) => c.id === 'd_play2')) d.challenges.daily[0] = { id: 'd_play2', progress: 0, done: false }; });
const lvl0 = await ev(() => ({ xp: window.__ashline.profile.data.totalXp, pass: window.__ashline.profile.data.pass.xp }));
await ev(() => window.__ashline.autopilot(true));
for (let i = 0; i < 25; i++) { const st = await ev(() => { const g = window.__ashline.game; g.debugAdvance(10); return g.match.state; }); if (st === 'ended') break; }
await ev(() => { window.__ashline.game.endTimer = 10; });
await p.waitForFunction(() => window.__ashline.state === 'results', null, { timeout: 60000 });
await p.waitForTimeout(600);
await S('10-results-rewards');
const after = await ev(() => { const d = window.__ashline.profile.data; return { xp: d.totalXp, pass: d.pass.xp, matches: d.career.matches, wpn: d.weaponProgress.ar_kv7, ch: [...d.challenges.daily, ...d.challenges.weekly].map((c) => c.progress) }; });
check('match XP applied to player level and battle pass', after.xp > lvl0.xp && after.pass > lvl0.pass, JSON.stringify({ lvl0, after: { xp: after.xp, pass: after.pass } }));
check('challenge progress tracked', after.ch.some((v) => v > 0), JSON.stringify(after.ch));
const again = await ev(() => { const g = window.__ashline.game; const before = window.__ashline.profile.data.totalXp; g && g.buildResult(); return window.__ashline.profile.data.totalXp === before; });
check('match rewards awarded exactly once', again);
// reload: persistence
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
const persisted = await ev((id) => { const pr = window.__ashline.profile; return { owned: pr.owns(id), premium: pr.data.pass.premium, op: pr.data.equipped.operator, xp: pr.data.totalXp }; }, target);
check('profile, inventory, equip and pass persist across reload', persisted.owned && persisted.premium && persisted.op === 'op_kestrel' && persisted.xp === after.xp, JSON.stringify(persisted));
await p.waitForTimeout(500);
await S('11-menu-after');
check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
