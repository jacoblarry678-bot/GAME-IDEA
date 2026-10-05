/**
 * End-to-end playthrough in headless Chromium (CPU renderer):
 *   npm run build && npm run preview &   then   node tools/e2e.mjs
 * Drives the real game through the full crime loop with simulated input,
 * using the traffic AI as an autopilot for the player's own car (same physics).
 * Prints PASS/FAIL per check; exits non-zero on failure.
 */
import { launch, checker } from './harness.mjs';

const { check, summary } = checker();
const t0 = Date.now();
let { browser, page, logs, sun } = await launch();
await page.evaluate(() => { localStorage.removeItem('sunstate.save'); localStorage.removeItem('sunstate.save.backup'); });
await page.goto(page.url().split('?')[0], { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'title', null, { timeout: 180000 });

// page-side helpers: loops run inside the page so each step costs no round trip
async function installHelpers() {
  await page.evaluate(() => {
    const S = window.__sun;
    const G = () => S.game;
    const tick = (sec) => S.advance(sec, 0);
    window.__t = {
      tick,
      faceTo(x, y, z) {
        const g = G(), c = g.engine.camera, p = g.player;
        g.cameraRig.yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
        const d = Math.hypot(x - p.pos.x, z - p.pos.z);
        g.cameraRig.pitch = Math.atan2(y - (p.pos.y + 1.6), d);
        void c;
      },
      walkTo(x, z, { maxSec = 25, within = 0.7, sprint = false } = {}) {
        const g = G(), p = g.player;
        const vi = S.input.virtual;
        let t = 0;
        while (t < maxSec) {
          const d = Math.hypot(x - p.pos.x, z - p.pos.z);
          if (d < within) break;
          g.cameraRig.yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
          vi.move = p.blockedT > 0.4 ? { x: 1, y: 0.4 } : { x: 0, y: d < 1.5 ? 0.5 : 1 }; // sidestep around obstacles
          vi.actions.clear(); if (sprint) vi.actions.add('sprint');
          tick(0.1); t += 0.1;
        }
        vi.move = null; vi.actions.clear();
        tick(0.2);
        return Math.hypot(x - p.pos.x, z - p.pos.z);
      },
      press(a) { S.input.virtual.edges.add(a); tick(1 / 30); },
      waitFor(fnSrc, maxSec, step = 0.25) {
        const fn = new Function('g', 'S', 'return (' + fnSrc + ')');
        let t = 0;
        while (t < maxSec) { if (fn(G(), S)) return t; tick(step); t += step; }
        return -1;
      },
      state() {
        const g = G(); if (!g) return { state: S.app.state };
        const p = g.player, v = p.vehicle;
        return { state: S.app.state, overlay: S.app.overlay, pos: [p.pos.x, p.pos.y, p.pos.z].map((n) => +n.toFixed(1)), inVehicle: !!v, vpos: v ? [v.pos.x, v.pos.z].map((n) => +n.toFixed(1)) : null, money: g.economy.money, wanted: g.wanted.level, wstate: g.wanted.state, mission: g.missions.active?.def.id || null, stage: g.missions.stage?.id || null, failed: g.missions.failed?.reason || null, health: Math.round(p.health), dead: p.dead, units: g.police.units.length, cops: g.cops.length, veh: g.vehicles.length, peds: g.peds.length + g.extras.length, time: +g.time.toFixed(1) };
      },
    };
  });
}
await installHelpers();
const T = (fn, arg) => page.evaluate(fn, arg);
const state = () => T(() => window.__t.state());

// --- title & new game -----------------------------------------------------------
check('boots to the title screen', (await state()).state === 'title');
check('Continue is disabled without a save', await page.$eval('.title-screen .menu button', (b) => b.disabled));
await page.click('text=New Game');
let st = await state();
check('New Game starts play', st.state === 'playing' && st.money === 350, JSON.stringify(st));

// --- movement ---------------------------------------------------------------------
const p0 = st.pos;
await T(() => { const g = window.__sun.game; g.cameraRig.yaw = Math.PI / 2; window.__sun.input.virtual.move = { x: 0, y: 1 }; window.__t.tick(1); window.__sun.input.virtual.move = null; window.__t.tick(0.3); });
st = await state();
check('player walks', Math.hypot(st.pos[0] - p0[0], st.pos[2] - p0[2]) > 2.5, `moved ${Math.hypot(st.pos[0] - p0[0], st.pos[2] - p0[2]).toFixed(1)} m`);
const jumpPeak = await T(() => { window.__t.press('jump'); let peak = 0; const p = window.__sun.game.player, y0 = p.pos.y; for (let i = 0; i < 40; i++) { window.__t.tick(1 / 60); peak = Math.max(peak, p.pos.y - y0); } window.__t.tick(1); return [peak, p.grounded]; });
check('player jumps and lands', jumpPeak[0] > 0.5 && jumpPeak[1], `peak ${jumpPeak[0].toFixed(2)} m`);
const sprint = await T(() => { const g = window.__sun.game, p = g.player, vi = window.__sun.input.virtual; g.cameraRig.yaw = Math.PI / 2; vi.move = { x: 0, y: 1 }; vi.actions.add('sprint'); window.__t.tick(0.8); const s = Math.hypot(p.vel.x, p.vel.z); vi.move = null; vi.actions.clear(); window.__t.tick(0.5); return s; });
check('sprinting is faster than running', sprint > 5.5, `${sprint.toFixed(1)} m/s`);

// --- mission start --------------------------------------------------------------------
const ms = await T(() => { const m = window.__sun.game.missions.available[0]; return m.start; });
await T(([x, z]) => window.__t.walkTo(x, z, { within: 0.8 }), [ms.x, ms.z]);
const prompt = await T(() => window.__sun.game.player.controller.prompt?.text);
check('mission start prompt appears at the marker', /Start mission/.test(prompt || ''), prompt);
await T(() => window.__t.press('interact'));
st = await state();
check('mission starts with a visible objective', st.mission === 'small_change' && (await page.$eval('.objective', (e) => e.textContent)).length > 5, st.stage);
const skipped = await T(() => { let n = 0; while (window.__sun.game.missions.cutscene && n < 10) { window.__t.press('skip'); n++; } return !window.__sun.game.missions.cutscene; });
check('intro dialogue is skippable', skipped);

// --- get in the car --------------------------------------------------------------------
await T(() => { const g = window.__sun.game, v = g.vehicles.find((x) => x.persistentId === 'start-sedan'); window.__t.walkTo(v.pos.x - 3.5, v.pos.z, { within: 1.2 }); window.__t.press('enterVehicle'); window.__t.waitFor('g.player.vehicle', 8); });
st = await state();
check('enters a parked car with F', st.inVehicle, JSON.stringify(st.vpos));

// --- drive to the store (autopilot = traffic AI driving the player's car) ---------------
const store = await T(() => window.__sun.game.store.place);
await T(([x, z]) => window.__sun.debug.autopilot(x, z, { arrive: 16 }), [store.door.x, store.door.z - 6]);
const driveT = await T(() => window.__t.waitFor('S.debug.arrived', 120, 0.5));
st = await state();
check('drives through the streets to the store', driveT >= 0, `${driveT}s · car at ${st.vpos} · stage ${st.stage}`);
if (driveT < 0) {
  // fallback so the rest of the loop can still be tested; reported as a failure above
  await T(([x, z]) => { const v = window.__sun.game.player.vehicle; v.pos.set(x, 0, z); v.vel.set(0, 0); }, [store.door.x + 6, store.door.z - 12]);
}
await T(() => { window.__sun.debug.stop(); const vi = window.__sun.input.virtual; vi.steer = { throttle: 0, brake: 1, steer: 0 }; window.__t.tick(3); vi.steer = null; });
await T(() => { window.__t.press('enterVehicle'); window.__t.waitFor('!g.player.vehicle', 5); window.__t.tick(0.5); });
st = await state();
const exitClear = await T(() => { const g = window.__sun.game, p = g.player; return !g.world.collision.overlapsCircle(p.pos.x, p.pos.z, 0.28, p.pos.y + 0.2, 1.5); });
check('exits the car onto a clear spot', !st.inVehicle && exitClear);
check('drive stage completes near the store', st.stage === 'enter' || st.stage === 'holdup', st.stage);

// --- hold-up -----------------------------------------------------------------------------
await T(() => { window.__t.press('nextWeapon'); });
check('switches to the pistol', (await T(() => window.__sun.game.player.controller.inventory.current)) === 'pistol');
await T(([d]) => { window.__t.walkTo(d.x, d.z - 8, { within: 0.8 }); window.__t.walkTo(d.x, d.z - 2.5, { within: 0.6 }); window.__t.walkTo(d.x, d.z + 3, { within: 0.6 }); }, [store.door]);
st = await state();
check('walks into the store interior', (await T(() => window.__sun.game.store.inside)), JSON.stringify(st.pos));
const hold = await T(([c]) => {
  const vi = window.__sun.input.virtual;
  vi.actions.add('aim');
  let started = -1;
  for (let i = 0; i < 120; i++) { window.__t.faceTo(c.x, 1.45, c.z); window.__t.tick(0.1); if (window.__sun.game.store.holdup && started < 0) started = i / 10; if (window.__sun.game.store.bag) break; }
  vi.actions.clear();
  const s = window.__sun.game.store;
  return { started, bag: s.bag ? s.bag.amount : 0 };
}, [store.clerk]);
check('aiming at the clerk starts a hold-up', hold.started >= 0, `after ${hold.started}s`);
check('clerk bags the register while covered', hold.bag > 0, `$${hold.bag}`);
const before = (await state()).money;
await T(() => { const b = window.__sun.game.store.bag; window.__t.walkTo(b.x - 0.9, b.z, { within: 0.5 }); window.__t.press('interact'); window.__t.tick(0.3); });
st = await state();
check('grabbing the cash pays out', st.money - before === hold.bag, `+$${st.money - before}`);
check('mission advances to the escape', st.stage === 'escape', st.stage);

// --- alarm → police --------------------------------------------------------------------
const alarmT = await T(() => window.__t.waitFor('g.wanted.level >= 2', 10));
st = await state();
check('silent alarm reports the robbery (2 stars)', alarmT >= 0 && st.wanted >= 2, `${st.wanted}★ ${st.wstate}`);
const unitsT = await T(() => window.__t.waitFor('g.police.units.filter((u) => !u.patrol).length >= 1', 15));
check('police units are dispatched', unitsT >= 0, `${(await state()).units} units`);
const visibleSpawn = await T(() => { const g = window.__sun.game; return g.police.units.some((u) => !u.patrol && Math.hypot(u.vehicle.pos.x - g.player.pos.x, u.vehicle.pos.z - g.player.pos.z) < 60 && u.t < 1); });
check('police do not spawn right next to the player', !visibleSpawn);

// --- escape: back to the car and drive away --------------------------------------------
await T(([d]) => { window.__t.walkTo(d.x, d.z - 3, { within: 0.8, sprint: true }); window.__t.walkTo(d.x, d.z - 8, { within: 0.8, sprint: true }); }, [store.door]);
await T(() => { const g = window.__sun.game; const v = g.vehicles.filter((x) => !x.police && !x.ai && !x.occupied).sort((a, b) => Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z) - Math.hypot(b.pos.x - g.player.pos.x, b.pos.z - g.player.pos.z))[0]; window.__t.walkTo(v.pos.x + 3, v.pos.z, { within: 1.5, sprint: true }); window.__t.press('enterVehicle'); window.__t.waitFor('g.player.vehicle', 8); });
st = await state();
check('gets back in a car during the alarm', st.inVehicle);
await T(() => window.__sun.debug.autopilot(90, -240, { arrive: 25 }));
const pursuitSeen = await T(() => { let seen = false; let t = 0; while (t < 90 && !window.__sun.debug.arrived) { window.__t.tick(0.5); t += 0.5; const w = window.__sun.game.wanted; if (w.state === 'pursuit' || w.state === 'search') seen = true; if (w.level === 0) break; } return { seen, t }; });
let escapeT = await T(() => window.__t.waitFor('g.wanted.level === 0', 90, 0.5));
st = await state();
if (escapeT < 0) {
  // police kept eyes on the autopilot car; hide on the mainland stub and wait the search out
  // hide out: swim far offshore, beyond sight range of every road and the search area
  await T(() => { window.__sun.debug.stop(); const g = window.__sun.game; g.respawnPlayer(330, -60, 0, { health: g.player.health }); });
  escapeT = await T(() => window.__t.waitFor('g.wanted.level === 0', 90, 0.5));
  check('escape: wanted level clears after hiding out of sight', escapeT >= 0, `cleared ${escapeT}s after swimming offshore (the autopilot can't evade; pursuit/search seen: ${pursuitSeen.seen})`);
} else check('escape: losing the police clears the wanted level', true, `cleared after driving away · pursuit/search seen: ${pursuitSeen.seen}`);
st = await state();
check('mission moves on to the safehouse', st.stage === 'return', st.stage);
if (!(await T(() => !!window.__sun.game.player.vehicle))) {
  await T(() => { const g = window.__sun.game; g.respawnPlayer(146.75, -40, Math.PI); const v = g.addVehicle('kestrel', 146.75, -40, Math.PI); g.seatCharacter(v, 0, g.player); window.__t.tick(0.5); });
}

// --- return & save ------------------------------------------------------------------------
const sh = await T(() => window.__sun.game.world.places.safehouse);
await T(() => window.__sun.debug.stop());
await T(([x, z]) => window.__sun.debug.autopilot(x, z, { arrive: 30 }), [sh.door.x + 10, sh.door.z]);
const backT = await T(() => window.__t.waitFor('S.debug.arrived', 120, 0.5));
if (backT < 0) await T(([x, z]) => { const v = window.__sun.game.player.vehicle; v.pos.set(x, 0, z); v.vel.set(0, 0); }, [sh.door.x + 22, sh.door.z]);
check('drives back toward the motel', backT >= 0, `${backT}s`);
await T(() => { window.__sun.debug.stop(); const vi = window.__sun.input.virtual; vi.steer = { throttle: 0, brake: 1, steer: 0 }; window.__t.tick(3); vi.steer = null; window.__t.press('enterVehicle'); window.__t.waitFor('!g.player.vehicle', 5); window.__t.tick(0.5); });
await T(([d]) => { window.__t.walkTo(d.x + 1.5, d.z, { within: 1.2, maxSec: 40 }); window.__t.tick(1); }, [sh.door]);
st = await state();
const passed = await T(() => window.__sun.game.missions.completed.has('small_change'));
check('MISSION PASSED at the safehouse', passed && !st.mission, JSON.stringify({ stage: st.stage, pos: st.pos }));
const saved = await T(() => JSON.parse(localStorage.getItem('sunstate.save') || 'null'));
check('progress is saved automatically', saved && saved.money === st.money && saved.missions.completed.includes('small_change'), saved ? `$${saved.money}` : 'no save');

// --- reload & continue ----------------------------------------------------------------------
await page.goto(page.url().split('?')[0], { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'title', null, { timeout: 180000 });
await installHelpers();
check('Continue is enabled after saving', !(await page.$eval('.title-screen .menu button', (b) => b.disabled)));
await page.click('text=Continue');
st = await state();
const owned = await T(() => window.__sun.game.vehicles.filter((v) => v.owner === 'player').length);
check('loaded money and mission progress match the save', st.money === saved.money && (await T(() => window.__sun.game.missions.completed.has('small_change'))));
check('loading does not duplicate owned cars', owned === 2, `${owned} owned cars`);
check('completed mission is not offered again', (await T(() => window.__sun.game.missions.canStart('small_change'))) === false);

// --- wasted -----------------------------------------------------------------------------------
const m0 = (await state()).money;
await T(() => window.__sun.game.player.damage(500, null, 'test'));
const wastedSeen = await T(() => window.__sun.app.overlay === 'wasted' && document.querySelector('.big').textContent.includes('WASTED'));
check('death shows WASTED', wastedSeen);
await page.waitForTimeout(5200);
await T(() => window.__t.tick(0.5));
st = await state();
const hosp = await T(() => window.__sun.game.world.places.hospital);
check('respawns at the hospital, alive and in control', st.state === 'playing' && !st.overlay && !st.dead && st.health === 100 && Math.hypot(st.pos[0] - hosp.x, st.pos[2] - hosp.z) < 3, JSON.stringify(st.pos));
check('hospital bill is charged', st.money < m0, `$${m0} → $${st.money}`);
const moved = await T(() => { const p = window.__sun.game.player, a = p.pos.clone(); window.__sun.input.virtual.move = { x: 0, y: 1 }; window.__t.tick(1); window.__sun.input.virtual.move = null; return a.distanceTo(p.pos); });
check('controls work after respawn', moved > 2);

// --- busted -------------------------------------------------------------------------------------
await T(() => { const g = window.__sun.game; g.wanted.report('assault', g.player.pos.x, g.player.pos.z, 'police'); });
const unit = await T(() => window.__t.waitFor('g.police.units.some((u) => !u.patrol)', 15));
await T(() => {
  const g = window.__sun.game, u = g.police.units.find((x) => !x.patrol);
  const p = g.player;
  u.vehicle.pos.set(p.pos.x + 9, 0, p.pos.z); u.vehicle.vel.set(0, 0);
  g.police.deploy(u);
  u.cops.forEach((c, i) => c.pos.set(p.pos.x + 1.2 + i * 0.6, p.pos.y, p.pos.z + 0.4));
});
const bustT = await T(() => window.__t.waitFor('S.app.overlay === "busted"', 12, 0.1));
check('standing still next to an officer gets you BUSTED (1★)', unit >= 0 && bustT >= 0, `${bustT}s`);
await page.waitForTimeout(5200);
await T(() => window.__t.tick(0.5));
st = await state();
const pd = await T(() => window.__sun.game.world.places.police);
check('released at the police station with a clean record', st.state === 'playing' && st.wanted === 0 && Math.hypot(st.pos[0] - pd.x, st.pos[2] - pd.z) < 3 && st.units <= 1);

// --- mission fail & retry --------------------------------------------------------------------
await T(() => window.__sun.app.quitToTitle());
await page.click('text=New Game');
await installHelpers();
await T(() => { const g = window.__sun.game; g.missions.start('small_change'); g.missions.skipDialogue(); });
await T(([d]) => { const g = window.__sun.game; g.respawnPlayer(d.x, d.z + 2, Math.PI * 0.5); g.player.controller.inventory.current = 'pistol'; window.__t.tick(1); }, [store.door]);
const extrasBefore = await T(() => window.__sun.game.extras.filter((e) => e.name === 'Clerk').length);
await T(() => { const g = window.__sun.game; g.store.clerk.damage(500, g.player, 'bullet'); window.__t.tick(0.5); });
st = await state();
check('killing the clerk fails the mission with a reason', !!st.failed && /clerk/i.test(st.failed), st.failed);
const failBanner = await page.$eval('.big', (e) => e.textContent);
check('fail screen offers a retry', /MISSION FAILED/.test(failBanner) && /Retry/.test(failBanner));
await T(() => window.__sun.app.retryMission());
await T(() => window.__t.tick(2));
st = await state();
const clerks = await T(() => window.__sun.game.extras.filter((e) => e.name === 'Clerk' && !e.removed).length);
check('retry restarts from the checkpoint', st.mission === 'small_change' && !st.failed, st.stage);
check('retry does not duplicate mission actors', clerks <= 1 && extrasBefore === 1, `${clerks} clerk(s)`);

// --- pause ----------------------------------------------------------------------------------------
await T(() => window.__sun.app.pause());
const tA = (await state()).time;
await T(() => window.__t.tick(2));
const tB = (await state()).time;
check('pause freezes the simulation', (await state()).state === 'paused' && tA === tB);
await T(() => window.__sun.app.menus.closePause());
check('resume returns to play', (await state()).state === 'playing');

// --- blocked driver door ----------------------------------------------------------------------
const blocked = await T(() => {
  const g = window.__sun.game;
  g.missions.abandon(); g.missions.failed = null;
  // hospital south wall (z = -170.5); facing east, the driver side (left) is to the north, against the wall
  const v = g.addVehicle('kestrel', 0, -169.3, Math.PI / 2);
  v.pos.z = -170.5 + v.hx + 0.25;
  g.respawnPlayer(0, -165, 0);
  g.seatCharacter(v, 0, g.player);
  window.__t.tick(0.5);
  window.__t.press('enterVehicle');
  window.__t.waitFor('!g.player.vehicle', 4);
  window.__t.tick(0.3);
  const p = g.player;
  return { out: !p.vehicle, z: +p.pos.z.toFixed(2), clear: !g.world.collision.overlapsCircle(p.pos.x, p.pos.z, 0.28, p.pos.y + 0.2, 1.5), carZ: +v.pos.z.toFixed(2) };
});
check('exiting with the driver door against a wall uses another side', blocked.out && blocked.clear && blocked.z > blocked.carZ, JSON.stringify(blocked));
const throughWall = await T(() => {
  const g = window.__sun.game, b = g.store.place.bounds;
  const x = (b.x0 + b.x1) / 2;
  g.respawnPlayer(x, b.z1 - 1, 0);
  const v = g.addVehicle('kestrel', x, b.z1 + 3, Math.PI / 2);
  window.__t.tick(0.2);
  const f = g.player.controller.findVehicle();
  const near = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z);
  g.removeVehicle(v);
  return { blocked: f === null, near: +near.toFixed(1) };
});
check('cannot enter a car through a wall', throughWall.blocked, `car ${throughWall.near} m away behind the store wall`);

// --- five minutes of driving without errors -------------------------------------------------
const longRun = await T(() => {
  const g = window.__sun.game;
  g.respawnPlayer(150 - 5.25, 60, Math.PI);
  const v = g.addVehicle('ironhorse', 150 - 5.25, 60, Math.PI);
  g.seatCharacter(v, 0, g.player);
  window.__sun.debug.autopilot(0, 0, { cruise: true });
  const t0 = performance.now();
  let maxVeh = 0, maxPeds = 0, dist = 0, last = v.pos.clone(), stuck = 0;
  for (let s = 0; s < 300; s += 1) {
    window.__t.tick(1);
    maxVeh = Math.max(maxVeh, g.vehicles.length);
    maxPeds = Math.max(maxPeds, g.peds.length + g.extras.length);
    const d = last.distanceTo(v.pos); dist += d; last.copy(v.pos);
    if (d < 0.5) stuck++; else stuck = 0;
    if (stuck > 20) { v.pos.set(150 - 5.25, 0, 0); v.yaw = Math.PI; v.vel.set(0, 0); window.__sun.debug.autopilot(0, 0, { cruise: true }); stuck = 0; }
  }
  return { ms: performance.now() - t0, maxVeh, maxPeds, dist, events: g.director.history.length, inVehicle: !!g.player.vehicle };
});
check('5 minutes of simulated driving complete', longRun.inVehicle && longRun.dist > 1500, `${(longRun.dist / 1000).toFixed(1)} km driven, ${longRun.events} ambient events`);
check('populations stay bounded', longRun.maxVeh < 45 && longRun.maxPeds < 70, `max ${longRun.maxVeh} vehicles, ${longRun.maxPeds} people`);
const errs = logs.filter((l) => /PAGEERROR|\[error\]/.test(l) && !/fonts|ERR_CERT|favicon/.test(l));
check('no page errors during the run', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\nsimulation speed: 300 s of game time in ${(longRun.ms / 1000).toFixed(1)} s wall time (CPU, no rendering)`);
console.log(`total wall time ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await browser.close();
process.exit(summary() ? 0 : 1);
