/**
 * Hotfix check for sealed vault content (browser): the drop is invisible until
 * released; a wrong code is refused; the right code (Store → Redeem) unlocks
 * it; it can be bought with test credits, equipped, survives a reload; and a
 * self-hosted server started with --release unlocks it for joining players,
 * who also see each other wearing it.
 * Usage: VAULT_TEST_CODE=<code> node tools/vaultui.mjs [outDir]   (needs npm run build)
 */
import { chromium } from 'playwright';
import { startServer } from '../server/server.mjs';
const out = process.argv[2] || 'shots';
const CODE = process.env.VAULT_TEST_CODE;
if (!CODE) { console.log('set VAULT_TEST_CODE'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const srv = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'tdm' }], bots: 2, time: 10 });
const base = `http://localhost:${srv.port}/`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const page = async (name, fresh = true) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`); });
  if (fresh) await p.addInitScript(([n]) => { if (sessionStorage.getItem('i')) return; sessionStorage.setItem('i', '1'); localStorage.clear(); localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.6, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false } })); localStorage.setItem('ashline.profile', JSON.stringify({ version: 3, name: n })); }, [name]);
  await p.goto(base, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
  return p;
};

const A = await page('Alpha');
await A.click('.menu-btn[data-go=store]');
await A.waitForTimeout(600);
const before = await A.evaluate(() => [...document.querySelectorAll('.collab-box [data-item]')].map((e) => e.dataset.item));
check('before release the drop is invisible (collab shows only keychain + banner)', before.join() === 'ch_waspinator,bn_waspinator', before.join());
await A.fill('.code-in', 'WRONG-CODE0-00000-00000');
await A.click('[data-a=redeem]');
await A.waitForTimeout(1500);
const t1 = await A.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'));
check('a wrong code is refused', /not recognised/i.test(t1), t1);
await A.fill('.code-in', CODE.toLowerCase());
await A.click('[data-a=redeem]');
await A.waitForFunction(() => document.querySelectorAll('.collab-box [data-item]').length === 3, null, { timeout: 20000 }).catch(() => {});
const after = await A.evaluate(() => ({ items: [...document.querySelectorAll('.collab-box [data-item]')].map((e) => e.dataset.item), toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|') }));
check('the release code unlocks the skin in the Store collab section with an announcement', after.items.includes('op_waspinator') && /WASPINATOR/.test(after.toast), JSON.stringify(after));
await A.waitForTimeout(1200);
await A.screenshot({ path: `${out}/vault-01-store.png` });
await A.click('[data-a=topup]');
await A.waitForTimeout(200);
await A.click('.collab-box [data-item=op_waspinator]');
await A.waitForTimeout(400);
await A.click('[data-a=buy]');
await A.waitForTimeout(300);
await A.click('.modal .btn.primary');
await A.waitForTimeout(600);
await A.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
const own = await A.evaluate(() => { const pr = window.__ashline.profile; pr.equip('op_waspinator'); pr.save(); return { op: pr.owns('op_waspinator'), outfit: pr.owns('of_waspinator'), eq: pr.data.equipped.operator }; });
check('bought with test credits (outfit included) and equipped', own.op && own.outfit && own.eq === 'op_waspinator', JSON.stringify(own));
await A.evaluate(() => { const a = window.__ashline; a.screens.clear(); a.screens.show('main'); a.screens.push('armory', { tab: 'operator', item: 'op_waspinator' }); });
await A.waitForTimeout(2000);
await A.screenshot({ path: `${out}/vault-02-armory.png` });
await A.reload({ waitUntil: 'load' });
await A.waitForFunction(() => window.__ashline?.state === 'menu', null, { timeout: 120000 });
const persisted = await A.evaluate(() => ({ own: window.__ashline.profile.owns('op_waspinator'), eq: window.__ashline.profile.data.equipped.operator }));
check('after a reload the skin is still owned and equipped', persisted.own && persisted.eq === 'op_waspinator', JSON.stringify(persisted));

// server release path: a brand-new player joins a server started with --release
srv.room.opts.release = [CODE];
const B = await page('Bravo');
const bOwnsBefore = await B.evaluate(() => !!window.__ashline.profile.data && Object.keys(window.__ashline.profile.data.owned).includes('op_waspinator'));
for (const p of [A, B]) { await p.click('.menu-btn[data-go=online]'); await p.waitForTimeout(300); await p.click('[data-a=connect]'); await p.waitForFunction(() => window.__ashline.state === 'match-live', null, { timeout: 90000 }); }
const bView = await B.evaluate(() => { const a = window.__ashline; return { look: a.game.match.combatants.find((c) => c.name === 'Alpha')?.look?.operator }; });
check('server --release: the joining player gets the drop without typing a code', !bOwnsBefore && await B.evaluate(() => JSON.parse(localStorage.getItem('ashline.vault') || '[]').length === 1));
check('the other player sees Alpha wearing the skin', bView.look === 'op_waspinator', JSON.stringify(bView));
// screenshot: B looks at A
await A.evaluate(() => { const a = window.__ashline; a.online.client.send({ t: 'dbg', op: 'freezeBots' }); a.online.client.send({ t: 'dbg', op: 'revive' }); a.online.client.send({ t: 'dbg', op: 'place', x: 16, z: -1.5, yaw: Math.PI / 2 + 0.6 }); });
await B.evaluate(() => { const a = window.__ashline; a.online.client.send({ t: 'dbg', op: 'revive' }); a.online.client.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 }); });
for (const p of [A, B]) await p.evaluate(() => { window.__ashline.engine.shouldRender = () => false; });
await Promise.all([A, B].map((p) => p.evaluate(async () => { const a = window.__ashline; for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 16)); if (a.game.player === a.game.match.player && a.game.player.name === 'Bravo') { a.game.look.yaw = -Math.PI / 2; a.game.look.pitch = -0.08; } a.input.poll(); a.game.update(1 / 60); } })));
await B.evaluate(() => { const a = window.__ashline; a.game.hud.root.style.display = 'none'; a.engine.render(true); });
await B.screenshot({ path: `${out}/vault-03-seen-online.png` });
for (const p of [A, B]) await p.evaluate(() => window.__ashline.toMenu());
srv.close();
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
