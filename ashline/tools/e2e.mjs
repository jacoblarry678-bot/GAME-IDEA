/**
 * End-to-end flow test in headless Chromium (SwiftShader).
 *   launch → menu → play setup → match (autopilot player) → pause → settings
 *   → resume → match end → results → career recorded once → play again
 *   → loadouts (switch to sniper) → match → scoped ADS → leave → menu
 * Usage: node tools/e2e.mjs [url] [outDir]
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4180/';
const out = process.argv[3] || 'shots';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
await p.addInitScript(() => {
  if (sessionStorage.getItem('e2e-init')) return;
  sessionStorage.setItem('e2e-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'low', renderScale: 0.5, shadows: 'off', textures: 'low', effects: 'low' } }));
});

const S = (name) => p.screenshot({ path: `${out}/${name}.png` });
const ev = (fn, arg) => p.evaluate(fn, arg);
const waitState = (st, ms = 90000) => p.waitForFunction((s) => window.__ashline?.state === s, st, { timeout: ms });

await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await waitState('menu', 120000);
check('boots to main menu', true);
await p.waitForTimeout(800);
await S('e2e-01-menu');

// ---- setup screen
await p.click('text=Play');
await p.waitForTimeout(500);
const before = await ev(() => window.__ashline.profile.data.matchSetup.timeLimit);
await p.click('[data-k=timeLimit] button[data-d="-1"]');
const after = await ev(() => window.__ashline.profile.data.matchSetup.timeLimit);
check('setup stepper changes time limit', after === before - 1, `${before} → ${after}`);
await ev(() => { const s = window.__ashline.profile.data.matchSetup; s.scoreLimit = 15; s.timeLimit = 4; s.botsAllies = 4; s.botsEnemies = 5; s.difficulty = 'regular'; window.__ashline.profile.save(); });
await p.click('text=Hardened');
check('difficulty selection persists', (await ev(() => window.__ashline.profile.data.matchSetup.difficulty)) === 'hardened');
await S('e2e-02-setup');

// ---- start match
await p.click('text=Start Match');
await p.waitForTimeout(500);
let st = await ev(() => { const g = window.__ashline.game; return { state: window.__ashline.state, n: g.match.combatants.length, teams: [0, 1].map((t) => g.match.combatants.filter((c) => c.team === t).length), bots: g.match.combatants.filter((c) => c.isBot).length, mstate: g.match.state }; });
check('match starts with 5v5', st.n === 10 && st.teams[0] === 5 && st.teams[1] === 5, JSON.stringify(st));
check('all other players are bots', st.bots === 9);
await ev(() => window.__ashline.game.debugAdvance(3.5));
st = await ev(() => window.__ashline.game.match.state);
check('countdown → live', st === 'live', st);

// ---- autopilot the player and let the match run
await ev(() => window.__ashline.autopilot(true));
await ev(() => window.__ashline.game.debugAdvance(20));
await p.waitForTimeout(1200);
await S('e2e-03-match');
let m = await ev(() => { const g = window.__ashline.game, pl = g.player; return { t: g.match.time, scores: g.match.teamScores, shots: pl.stats.shots, hits: pl.stats.hits, kills: pl.stats.kills, deaths: pl.stats.deaths, alive: pl.alive, hp: pl.health, mag: pl.weapon.mag, fatal: String(window.__ashline.fatal || '') }; });
check('match time advances', m.t > 20, `t=${m.t.toFixed(1)}`);
check('kills are being scored', m.scores[0] + m.scores[1] > 0, JSON.stringify(m.scores));
check('player weapon fires & consumes ammo', m.shots > 0, `shots=${m.shots} hits=${m.hits} mag=${m.mag}`);
check('no runtime exception in frame loop', !m.fatal, m.fatal);

// ---- shooting from real input path: fire one shot via the simulated command
await ev(() => window.__ashline.autopilot(false));
const fireRes = await ev(() => {
  const g = window.__ashline.game, pl = g.player;
  if (!pl.alive) g.match.respawn(pl);
  g.clearInput();
  g.debugAdvance(2.2);
  if (!pl.alive) { g.match.respawn(pl); g.debugAdvance(0.1); }
  const w = pl.weapon; w.cancelReload(); w.mag = w.def.mag; w.cool = 0; pl.mantle = null; pl.stance = 'stand';
  const before = w.mag;
  pl.cmd.fire = true; pl.sprinting = false; pl.sprintOutT = 0; pl.swapT = 0; pl.throwT = 0; pl.meleeT = 0;
  g.match.tick(1 / 60); g.afterTick(1 / 60);
  const after1 = w.mag;
  pl.cmd.fire = false; g.match.tick(1 / 60); g.afterTick(1 / 60);
  return { before, after1, reloadAfterEmpty: (() => { w.mag = 0; pl.cmd.reload = true; g.match.tick(1 / 60); pl.cmd.reload = false; return w.reloading; })() };
});
check('one trigger pull consumes one round', fireRes.after1 === fireRes.before - 1, JSON.stringify(fireRes));
check('reload starts when empty', fireRes.reloadAfterEmpty === true);

// ---- pause / settings / resume
await ev(() => window.__ashline.pauseMatch());
await p.waitForTimeout(400);
const tPaused = await ev(() => window.__ashline.game.match.time);
await p.waitForTimeout(1500);
const tPaused2 = await ev(() => window.__ashline.game.match.time);
check('pause freezes the offline match', tPaused === tPaused2 && (await ev(() => window.__ashline.state)) === 'match-paused');
await S('e2e-04-pause');
await p.click('[data-screen=pause] >> text=Settings');
await p.waitForTimeout(400);
const fov0 = await ev(() => window.__ashline.engine.camera.fov);
await ev(() => window.__ashline.settings.set('graphics.fov', 105));
const fov1 = await ev(() => window.__ashline.engine.camera.fov);
check('FOV setting applies immediately', fov1 > fov0, `${fov0.toFixed(1)} → ${fov1.toFixed(1)}`);
const post = await ev(() => {
  const a = window.__ashline, S = a.settings;
  S.set('graphics.ao', true); S.set('graphics.bloom', true);
  a.engine.render(true);
  const on = !!a.engine.composer && a.engine.aoPass.enabled && a.engine.bloomPass.enabled;
  S.set('graphics.ao', false); S.set('graphics.bloom', false);
  a.engine.render(true);
  return { on, off: !a.engine.composer, fatal: String(a.fatal || '') };
});
check('bloom / AO toggle at runtime', post.on && post.off && !post.fatal, JSON.stringify(post));
await p.click('text=Controls');
await p.waitForTimeout(300);
await S('e2e-05-settings-controls');
// rebind reload to F via the UI
await p.click('.bind-grid .bind-btn >> nth=18');
await p.keyboard.press('KeyF');
await p.waitForTimeout(200);
const bind = await ev(() => window.__ashline.settings.data.controls.bindings.reload[0]);
check('key rebinding works', bind === 'KeyF', bind);
const persisted = await ev(() => JSON.parse(localStorage.getItem('ashline.settings')).controls.bindings.reload[0]);
check('settings persist to storage', persisted === 'KeyF');
await p.click('text=Accessibility');
await p.waitForTimeout(200);
await S('e2e-06-settings-accessibility');
await p.click('[data-screen=settings] >> text=Back');
await p.waitForTimeout(300);
await p.click('text=Resume');
await p.waitForTimeout(300);
check('resume returns to live match', (await ev(() => window.__ashline.state)) === 'match-live');

// ---- play to the end
await ev(() => window.__ashline.autopilot(true));
for (let i = 0; i < 30; i++) {
  const s = await ev(() => { const g = window.__ashline.game; g.debugAdvance(10); return g.match.state; });
  if (s === 'ended') break;
}
m = await ev(() => { const g = window.__ashline.game; return { state: g.match.state, scores: g.match.teamScores, winner: g.match.winner, reason: g.match.endReason, t: g.match.time }; });
check('match ends by score or time', m.state === 'ended', JSON.stringify(m));
check('winner reached score limit (or time)', m.reason === 'time' || Math.max(...m.scores) >= 15, JSON.stringify(m.scores));
await p.waitForTimeout(1500);
await S('e2e-07-match-end');
await ev(() => { const g = window.__ashline.game; g.endTimer = 10; });
await waitState('results', 60000);
await p.waitForTimeout(600);
await S('e2e-08-results');
const career1 = await ev(() => ({ ...window.__ashline.profile.data.career }));
check('career records the match', career1.matches === 1, JSON.stringify(career1));
// results should not double-record
await ev(() => window.__ashline.game && window.__ashline.game.buildResult());
const career2 = await ev(() => window.__ashline.profile.data.career.matches);
check('match rewards recorded exactly once', career2 === 1);

// ---- play again
await p.click('text=Play Again');
await p.waitForTimeout(500);
check('play again starts a fresh match', (await ev(() => window.__ashline.state)) === 'match-live' && (await ev(() => window.__ashline.game.match.time)) < 1);
await ev(() => window.__ashline.leaveMatch());
await p.waitForTimeout(400);
check('leave match returns to menu', (await ev(() => window.__ashline.state)) === 'menu');

// ---- loadouts: pick the sniper, verify it is used in-match
await p.click('text=Loadouts');
await p.waitForTimeout(500);
await p.click('.wpn-opt[data-id=sr_longreach]');
await p.waitForTimeout(300);
await S('e2e-09-loadouts');
const lo = await ev(() => window.__ashline.profile.loadout.primary);
check('loadout edit saves', lo === 'sr_longreach', lo);
await p.click('[data-screen=loadouts] >> text=Back');
await p.waitForTimeout(300);
await p.click('text=Play');
await p.waitForTimeout(300);
await p.click('text=Start Match');
await p.waitForTimeout(300);
const w = await ev(() => window.__ashline.game.player.weapon.def.id);
check('selected loadout used in match', w === 'sr_longreach', w);
await ev(() => { const g = window.__ashline.game; g.debugAdvance(3.5); });
// aim down sights through the real input path (right mouse), stepping frames deterministically
await p.mouse.move(640, 360);
await p.mouse.down({ button: 'right' });
const scoped = await ev(() => { const a = window.__ashline; for (let i = 0; i < 30; i++) { a.input.poll(); a.game.update(1 / 30); } return { adsT: a.game.player.adsT, on: document.querySelector('.scope').classList.contains('on'), fov: a.engine.camera.fov }; });
await p.waitForTimeout(800);
await S('e2e-10-scope');
check('sniper scope overlay shows at full ADS (right mouse)', scoped.on && scoped.adsT > 0.95, JSON.stringify(scoped));
await p.mouse.up({ button: 'right' });
await p.keyboard.down('Digit2');
const pistol = await ev(() => { const a = window.__ashline; for (let i = 0; i < 40; i++) { a.input.poll(); a.game.update(1 / 30); if (i === 1) a.input.down.delete('Digit2'); a.input.endFrame(); } return { id: a.game.player.weapon.def.id, scope: document.querySelector('.scope').classList.contains('on') }; });
await p.keyboard.up('Digit2');
check('number key swaps to secondary, scope clears', pistol.id === 'pistol_warden' && !pistol.scope, JSON.stringify(pistol));
await p.waitForTimeout(800);
await S('e2e-11-pistol');
await ev(() => window.__ashline.leaveMatch());

// ---- firing range from the main menu
await p.waitForTimeout(400);
await ev(() => { const pr = window.__ashline.profile; pr.loadout.primary = 'ar_kv7'; pr.save(); });
await p.click('text=Firing Range');
await p.waitForFunction(() => window.__ashline?.game?.isRange, null, { timeout: 60000 });
const rng = await ev(() => { const a = window.__ashline, g = a.game; a.autopilot(true); g.debugAdvance(15); a.autopilot(false); g.update(1 / 60); return { dummies: g.match.combatants.filter((c) => c.dummy).length, kills: g.player.stats.kills, panel: !!document.querySelector('.range-panel')?.innerText.includes('Shots to kill') }; });
check('firing range: targets, eliminations, stats panel', rng.dummies === 13 && rng.kills > 0 && rng.panel, JSON.stringify(rng));
await ev(() => window.__ashline.leaveMatch());
await p.waitForTimeout(300);
check('leaving range restores Cinder Yard', await ev(() => window.__ashline.activeMap.def.id === 'cinder_yard' && window.__ashline.state === 'menu'));

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await b.close();
process.exit(failed.length ? 1 : 0);
