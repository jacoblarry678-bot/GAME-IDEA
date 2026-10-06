/**
 * Update check (0.6.0): Battle Royale end to end in the browser, plus the
 * Supercharged XP claim → badge → doubled rewards flow.
 *   claim gift on the main menu → BR setup → drop-in (pistol + axe, spread
 *   out, weapons cold) → loot weapon with the interact key → ammo auto-pickup
 *   → zone damage + HUD warning → elimination → spectate → skip to results
 *   (placement, ×2 XP line) → a win (last one standing).
 * Usage: node tools/br.mjs [url] [outDir]
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
  if (sessionStorage.getItem('br-init')) return;
  sessionStorage.setItem('br-init', '1');
  localStorage.clear();
  localStorage.setItem('ashline.settings', JSON.stringify({ graphics: { preset: 'medium', renderScale: 0.6, shadows: 'medium', textures: 'medium', effects: 'medium', bloom: true, ao: false } }));
});
const ev = (fn, a) => p.evaluate(fn, a);
const waitState = (st, ms = 120000) => p.waitForFunction((s) => window.__ashline?.state === s, st, { timeout: ms });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await waitState('menu');
await p.waitForTimeout(600);

// ---- Supercharged XP: claim from the main menu
check('main menu shows the Supercharged XP gift', await p.isVisible('[data-a=claim-xp]'));
await p.screenshot({ path: `${out}/br-01-menu-gift.png` });
await p.click('[data-a=claim-xp]');
await p.waitForTimeout(300);
const claimed = await ev(() => ({ left: window.__ashline.profile.xpBoostLeft, card: document.querySelector('.xp-event')?.textContent || '' }));
check('claiming starts a 60:00 boost and the card shows it', claimed.left === 3600 && /60:00/.test(claimed.card) && /counts down only in matches/i.test(claimed.card), JSON.stringify(claimed));
check('the gift button is gone after claiming', !(await p.isVisible('[data-a=claim-xp]')));

// ---- setup: Battle Royale is offered and configurable
await p.click('text=Play');
await p.waitForTimeout(400);
await p.click('.choice[data-k=mode] button[data-v=br]');
await p.waitForTimeout(300);
const setup = await ev(() => ({ s: { ...window.__ashline.profile.data.matchSetup }, blurb: document.querySelector('.setup-grid')?.textContent || '' }));
check('Battle Royale selectable in Play setup with an 8-minute default', setup.s.mode === 'br' && setup.s.timeLimit === 8 && /last one standing/i.test(setup.blurb), JSON.stringify(setup.s));
await ev(() => { const s = window.__ashline.profile.data.matchSetup; s.botsEnemies = 9; s.map = 'cinder_yard'; s.weather = 'clear'; s.difficulty = 'regular'; window.__ashline.profile.save(); });
await p.screenshot({ path: `${out}/br-02-setup.png` });
await p.click('text=Start Match');
await waitState('match-live');
await ev(() => window.__ashline.game.debugAdvance(3.3));
const drop = await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player, cs = m.combatants;
  let minD = Infinity;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) minD = Math.min(minD, Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z));
  for (let i = 0; i < 10; i++) g.update(1 / 30);
  return {
    n: cs.length, bots: cs.filter((c) => c.isBot).length, teams: new Set(cs.map((c) => c.team)).size, minD,
    weapons: [pl.weapons[0].def.id, pl.weapons[1].def.id], nades: pl.lethal.count + pl.tactical.count,
    loot: m.loot.length, views: g.brView.items.size, wall: !!window.__ashline.engine.scene.getObjectByName('br-view'),
    strip: document.querySelector('#hud .obj-strip')?.textContent, lim: document.querySelector('#hud .lim')?.textContent, xp: document.querySelector('#hud .xpchip')?.textContent,
  };
});
check('10 players: you + 9 bots, everyone on their own', drop.n === 10 && drop.bots === 9 && drop.teams === 10, JSON.stringify(drop));
check('drop-in spawns are spread out', drop.minD > 8, drop.minD.toFixed(1) + ' m');
check('everyone starts with a pistol and an axe, no grenades', drop.weapons.join() === 'pistol_warden,melee_axe' && drop.nades === 0, drop.weapons.join());
check('loot is on the ground and rendered', drop.loot >= 30 && drop.views === drop.loot && drop.wall, `${drop.loot} items, ${drop.views} models`);
check('HUD: weapons-cold timer, zone clock, players alive', /WEAPONS COLD/.test(drop.strip) && /ZONE CLOSES IN/.test(drop.strip) && /10 ALIVE/.test(drop.lim), `${drop.strip} | ${drop.lim}`);
check('HUD: Supercharged XP badge in match', /2× XP · 59:|2× XP · 60:/.test(drop.xp || ''), drop.xp);
const cold = await ev(() => { const g = window.__ashline.game, m = g.match, pl = g.player, bot = m.combatants.find((c) => c !== pl); const h = pl.health; m.applyDamage(pl, bot, 50, { kind: 'bullet', weapon: 'ar_kv7', zone: 'torso' }); return { before: h, after: pl.health }; });
check('no damage while weapons are cold', cold.after === cold.before, JSON.stringify(cold));

// ---- loot: stand on a weapon and press the interact key
const target = await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player;
  // the weapon farthest from every bot (bots keep looting during the cold phase)
  const far = (l) => Math.min(...m.combatants.filter((c) => c !== pl).map((c) => Math.hypot(c.x - l.x, c.z - l.z)));
  const it = m.loot.filter((l) => l.kind === 'weapon' && l.wid !== 'pistol_grizzly').sort((a, b) => far(b) - far(a))[0];
  pl.x = it.x; pl.y = it.y; pl.z = it.z; pl.vx = pl.vz = 0;
  g.look.pitch = -0.6;
  for (let i = 0; i < 6; i++) g.update(1 / 30);
  return { wid: it.wid, prompt: document.querySelector('#hud .prompt')?.textContent || '' };
});
check('standing on a weapon shows the pick-up prompt', /PICK UP/.test(target.prompt) && /drops .*WARDEN/i.test(target.prompt), target.prompt);
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/br-03-loot.png` });
await p.keyboard.down('KeyF');
await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 4; i++) g.update(1 / 30); });
await p.keyboard.up('KeyF');
await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 4; i++) g.update(1 / 30); });
const swapped = await ev(() => { const g = window.__ashline.game, m = g.match, pl = g.player; return { pops: [...document.querySelectorAll('#hud .popups .popup')].filter((e) => /PICKED UP/.test(e.textContent)).length, prim: pl.weapons[0].def.id, mag: pl.weapons[0].mag, dropped: m.loot.some((l) => l.kind === 'weapon' && l.wid === 'pistol_warden' && Math.hypot(l.x - pl.x, l.z - pl.z) < 2), vm: g.vm.weaponId ?? null }; });
check('interact key swaps in the weapon (with its ammo) and drops the pistol', swapped.prim === target.wid && swapped.mag > 0 && swapped.dropped, JSON.stringify(swapped));
check('one key press = exactly one swap (held key does not ping-pong)', swapped.pops === 1, `${swapped.pops} pickups`);
const ammo = await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player;
  const far = (l) => Math.min(...m.combatants.filter((c) => c !== pl).map((c) => Math.hypot(c.x - l.x, c.z - l.z)));
  const it = m.loot.filter((l) => l.kind === 'ammo').sort((a, b) => far(b) - far(a))[0];
  pl.weapons[0].reserve = 0;
  pl.x = it.x; pl.y = it.y; pl.z = it.z;
  for (let i = 0; i < 4; i++) g.update(1 / 30);
  return { reserve: pl.weapons[0].reserve, gone: !m.loot.includes(it) };
});
check('ammo boxes are picked up automatically', ammo.reserve > 0 && ammo.gone, JSON.stringify(ammo));

// ---- zone: outside the circle hurts and the HUD says so
const zone = await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player;
  m.ceasefireT = 0;
  const z = m.br.zone; z.state = 'final'; z.t = Infinity; z.x0 = z.x1 = pl.x + 40; z.z0 = z.z1 = pl.z; z.r0 = z.r1 = 6; m.br.next = { x: z.x0, z: z.z0, r: 0 };
  pl.health = 100;
  for (let i = 0; i < 75; i++) g.update(1 / 30);
  return { hp: pl.health, tint: document.querySelector('#hud .zonetint')?.classList.contains('on'), strip: document.querySelector('#hud .obj-strip')?.textContent };
});
check('outside the zone: health drains, screen tints, warning shows', zone.hp < 100 && zone.tint && /OUTSIDE THE ZONE/.test(zone.strip), JSON.stringify(zone));
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/br-04-zone.png` });

// ---- elimination, spectate, skip to results
await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player;
  const z = m.br.zone; z.x0 = z.x1 = 0; z.z0 = z.z1 = 0; z.r0 = z.r1 = 400; // everyone safe again
  // two bots go down first, then a bot kills you
  const bots = m.combatants.filter((c) => c !== pl);
  m.applyDamage(bots[0], bots[1], 500, { kind: 'bullet', weapon: 'ar_kv7', zone: 'torso' });
  m.applyDamage(bots[2], bots[1], 500, { kind: 'bullet', weapon: 'ar_kv7', zone: 'torso' });
  m.applyDamage(pl, bots[1], 500, { kind: 'bullet', weapon: 'ar_kv7', zone: 'head', dist: 20 });
  g.onPlayerDeath(); // (in play this fires inside game.update; here the kill is scripted)
  for (let i = 0; i < 130; i++) g.update(1 / 30);
});
const dead = await ev(() => { const g = window.__ashline.game, m = g.match; return { place: m.br.place.get(g.player.team), death: document.querySelector('#hud .death')?.textContent || '', spect: g.spectating?.displayName || null }; });
check('eliminated 3rd of 10 alive → placed #8', dead.place === 8 && /#8 of 10/.test(dead.death), JSON.stringify(dead));
check('after elimination you spectate your killer', !!dead.spect, dead.spect);
await p.screenshot({ path: `${out}/br-05-eliminated.png` });
await p.keyboard.down('Space');
await ev(() => { const g = window.__ashline.game; for (let i = 0; i < 3; i++) g.update(1 / 30); });
await p.keyboard.up('Space');
const fin = await ev(() => { const m = window.__ashline.game.match; return { state: m.state, reason: m.endReason, places: [...m.br.place.values()].sort((a, b) => a - b).join(',') }; });
check('skip: the rest of the match is simulated to a real winner', fin.state === 'ended' && fin.places === '1,2,3,4,5,6,7,8,9,10', JSON.stringify(fin));
await waitState('results', 60000);
await p.waitForTimeout(600);
const res = await ev(() => ({ banner: document.querySelector('.results-banner, .banner, h1')?.textContent || '', text: document.body.textContent }));
check('results show your placement', /#8 PLACE/.test(res.text) && /You placed #8 of 10/.test(res.text));
check('results show the Supercharged XP ×2 line', /SUPERCHARGED XP ×2/i.test(res.text) && /Supercharged XP ×2/.test(res.text));
await p.screenshot({ path: `${out}/br-06-results.png` });
const left = await ev(() => window.__ashline.profile.xpBoostLeft);
check('boost time was used by time played', left < 3600 && left > 3400, String(left));

// ---- a win: last one standing
await ev(async () => { await window.__ashline.startMatch(); });
await waitState('match-live');
const win = await ev(() => {
  const g = window.__ashline.game, m = g.match, pl = g.player;
  g.debugAdvance(3.3);
  m.ceasefireT = 0;
  for (const c of m.combatants) if (c !== pl) m.applyDamage(c, pl, 500, { kind: 'bullet', weapon: 'pistol_warden', zone: 'torso', dist: 10 });
  return { state: m.state, winner: m.winner, me: pl.team, place: m.br.place.get(pl.team), kills: pl.stats.kills };
});
check('killing everyone ends the match: last one standing', win.state === 'ended' && win.winner === win.me && win.place === 1 && win.kills === 9, JSON.stringify(win));
await ev(() => { window.__ashline.game.endTimer = 10; });
await waitState('results', 60000);
await p.waitForTimeout(500);
check('win banner reads LAST ONE STANDING', /LAST ONE STANDING/.test(await ev(() => document.body.textContent)));
await p.screenshot({ path: `${out}/br-07-win.png` });

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
