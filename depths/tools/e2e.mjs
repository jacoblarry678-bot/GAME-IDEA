/**
 * Browser end-to-end check (headless Chromium, software WebGL). Drives the
 * real menus and overlays and the in-page simulation, asserting that the
 * interface reacts and the console stays free of errors.
 * Run: npm run build && node tools/e2e.mjs
 */
import { serve, launch } from './shot.mjs';
import { mkdir } from 'node:fs/promises';

const OUT = new URL('./shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const srv = await serve(4197);
const { browser, page, errors } = await launch();
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('  ok', name); } else { fail++; console.log('  FAIL', name); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const frames = (n = 2) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

await page.goto('http://localhost:4197/?lowgfx');
await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 180000 });
ok(await page.locator('text=New Campaign').count() > 0, 'main menu shows New Campaign');
ok(await page.locator('text=Unlocks after you complete any campaign ending.').count() > 0, 'locked features state their unlock condition');

// settings: toggle and rebind
await page.locator('button:has-text("Settings")').first().click();
await page.locator('.tabs button:has-text("Subtitles")').click();
const t0 = await ev(() => window.__depths.settings.data.accessibility.soundRing);
await page.locator('.setting:has-text("Sound direction ring") .toggle').click();
ok(await ev(() => window.__depths.settings.data.accessibility.soundRing) !== t0, 'settings toggle changes the stored value');
await page.locator('.tabs button:has-text("Controls")').click();
await page.locator('.bind:has-text("Journal") button').first().click();
await page.keyboard.press('KeyJ');
await frames(2);
ok(await ev(() => window.__depths.settings.data.controls.bindings.journal[0]) === 'KeyJ', 'rebinding captures a key');
await page.locator('.tabs button:has-text("Controls")').click();
await page.locator('button:has-text("Reset this tab")').click();
ok(await ev(() => window.__depths.settings.data.controls.bindings.journal[0]) === 'Tab', 'reset tab restores defaults');
await page.locator('button:has-text("Done")').click();

// new campaign through the UI
await page.locator('button:has-text("New Campaign")').click();
await page.locator('.seg button:has-text("Guided")').click();
await page.locator('button:has-text("Continue")').click();
ok(await page.locator('text=drowning imagery').count() > 0, 'content note lists content before a new campaign');
await page.locator('button:has-text("Begin")').click();
await page.waitForFunction(() => window.__depths.state === 'game' && window.__depths.game && window.__depths.levelView, null, { timeout: 120000 });
await frames(2);
ok(await ev(() => window.__depths.game.difficulty) === 'guided', 'difficulty choice reaches the game');
ok(await ev(() => !!localStorage.getItem('depths.slot1.active')), 'chapter start checkpoint saved to slot 1');
await page.screenshot({ path: `${OUT}e2e-start.png` });

// gate → yellow rooms
await ev(() => { const a = window.__depths, g = a.game, p = g.players.get('p1'); p.x = 0.6; p.z = -1.6; p.yaw = Math.PI; p.pitch = -0.1; g.beginInteract('p1', 'gateWheel'); });
await frames(3);
ok(await ev(() => window.__depths.game.story.has('ch1.entered')), 'isolation gate transforms the corridor');
ok(await ev(() => window.__depths.levelView.swaps[0].swap.visible), 'annex corridor geometry swaps to the yellow kit');

// flashlight + reader
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = 1.6; p.z = 21.3; g.beginInteract('p1', 'flashlight'); g.beginInteract('p1', 'rec:01'); });
await frames(3);
ok(await page.locator('.reader:has-text("All personnel accounted for")').count() > 0, 'record reader shows exact record text');
await page.locator('.reader button:has-text("Close")').click();
ok(await ev(() => window.__depths.game.players.get('p1').hasFlashlight), 'flashlight pickup');

// journal and inventory overlays
await ev(() => window.__depths.overlays.journal());
await frames(2);
for (const t of ['Map', 'Photos', 'Evidence', 'Records', 'Objective']) { await page.locator(`.journal .tabs button:has-text("${t}")`).click(); await frames(1); }
ok(await page.locator('.journal').count() > 0, 'journal opens with five tabs');
await page.locator('.journal button:has-text("Close")').click();
await ev(() => window.__depths.overlays.inventory());
await frames(1);
ok(await page.locator('.inv .slot').count() === 4, 'inventory shows four pouch slots');
await page.locator('.inv button:has-text("Close")').click();

// R1: verify the clock and photograph the chair
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = -7.5; p.z = 22.3; p.room = null; });
await frames(2);
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); g.beginInteract('p1', 'camera'); const c = g.level.room('1.03').refugeData.clock; const e = p.eye(); p.yaw = Math.atan2(-(c.x - e.x), -(c.z - e.z)); p.pitch = Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)); for (let i = 0; i < 220; i++) g.tick(1 / 60); });
await frames(2);
ok(await ev(() => !!window.__depths.game.persist.refuges['1.03']), 'refuge R1 verified by watching the clock');
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = -8.6; p.z = 22.6; const e = p.eye(); p.yaw = Math.atan2(-(-10.3 - e.x), -(24.0 - e.z)); p.pitch = Math.atan2(0.47 - e.y, Math.hypot(-10.3 - e.x, 24 - e.z)); g.equip('p1', 'camera'); window.__r = g.takePhoto('p1', { force: true }); });
await frames(3);
ok(await ev(() => window.__r && window.__r.ok && window.__r.photo.targets.includes('h1chair')), 'tutorial photo reveals the hidden footprint');
ok(await page.locator('.polaroid img').count() > 0, 'polaroid develops on screen');
ok(await ev(() => { const g = window.__depths.game; return !!window.__depths.photos.thumb(g.photos[g.photos.length - 1].id); }), 'photo image rendered and stored');
await page.screenshot({ path: `${OUT}e2e-photo.png` });

// breaker panel through the panel UI
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); p.x = -3; p.z = 62.6; p.yaw = 0; g.beginInteract('p1', 'panel:P1'); });
await frames(2);
ok(await page.locator('.panelui:has-text("Breaker panel")').count() > 0, 'puzzle panel opens');
await page.locator('.panelui button:has-text("RESET")').click();
await page.locator('.panelui button:has-text("CIRCUIT 3")').click();
await page.locator('.panelui button:has-text("CIRCUIT 1")').click();
await page.locator('.panelui button:has-text("CIRCUIT 2")').click();
await frames(2);
ok(await ev(() => window.__depths.game.story.has('P1.done')), 'P1 solved through the panel UI');
await page.locator('.panelui button:has-text("Back")').click();

// death and retry
await ev(() => { const g = window.__depths.game, p = g.players.get('p1'); g.damagePlayer(p, 200, null, { kind: 'test' }); });
await frames(3);
ok(await page.locator('.death').count() > 0, 'death screen appears');
await page.locator('button:has-text("Retry from checkpoint")').click();
await frames(3);
ok(await ev(() => window.__depths.game.players.get('p1').health === 100 && !window.__depths.game.over), 'retry restores the checkpoint');
ok(await ev(() => window.__depths.game.story.has('P1.done')), 'checkpoint after P1 keeps the puzzle solved');

// pause, quit, continue
await ev(() => window.__depths.overlays.pause());
await frames(1);
ok(await page.locator('.sheet:has-text("Paused")').count() > 0, 'pause menu');
ok(await ev(() => window.__depths.game.paused) === true, 'solo pause freezes the world');
await ev(() => window.__depths.quitToMenu());
await frames(2);
ok(await page.locator('button:has-text("Continue")').count() > 0, 'Continue offered on the main menu');
await page.locator('button:has-text("Continue")').first().click();
await page.waitForFunction(() => window.__depths.state === 'game' && window.__depths.levelView, null, { timeout: 60000 });
ok(await ev(() => window.__depths.game.story.has('P1.done') && window.__depths.game.chapterId === 1), 'continue restores the campaign');

const bad = errors.filter((e) => !/favicon/.test(e));
ok(bad.length === 0, `console free of errors (${bad.length})`);
if (bad.length) console.log(bad.slice(0, 20).join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.close();
process.exit(fail ? 1 : 0);
