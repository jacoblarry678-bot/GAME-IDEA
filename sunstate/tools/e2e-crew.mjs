/**
 * Milestone 3 end-to-end checks in headless Chromium (CPU renderer):
 *   npm run build && npm run preview &   then   node tools/e2e-crew.mjs
 * Two protagonists: partner follow/wait, boarding the player's car, getting
 * out together, switching close and far, separate inventories, the partner
 * driving you to a waypoint, passenger drive-by, switch rules, save/reload.
 */
import { launch, checker } from './harness.mjs';

const { check, summary } = checker();
const t0 = Date.now();
const { browser, page, logs, sun } = await launch();
await page.evaluate(() => { localStorage.removeItem('sunstate.save'); localStorage.removeItem('sunstate.save.backup'); });
await page.goto(page.url().split('?')[0] + '?autostart', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 180000 });

await page.evaluate(() => {
  const S = window.__sun;
  const G = () => S.game;
  const tick = (sec) => S.advance(sec, 0);
  window.__t = {
    tick,
    walkTo(x, z, { maxSec = 25, within = 0.7 } = {}) {
      const g = G(), p = g.player, vi = S.input.virtual;
      let t = 0;
      while (t < maxSec) {
        const d = Math.hypot(x - p.pos.x, z - p.pos.z);
        if (d < within) break;
        g.cameraRig.yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
        vi.move = p.blockedT > 0.4 ? { x: 1, y: 0.4 } : { x: 0, y: d < 1.5 ? 0.5 : 1 };
        tick(0.1); t += 0.1;
      }
      vi.move = null; tick(0.2);
      return Math.hypot(x - p.pos.x, z - p.pos.z);
    },
    press(a) { S.input.virtual.edges.add(a); tick(1 / 30); },
    waitFor(src, maxSec, step = 0.25) {
      const fn = new Function('g', 'S', 'return (' + src + ')');
      let t = 0;
      while (t < maxSec) { if (fn(G(), S)) return t; tick(step); t += step; }
      return -1;
    },
    who() { const g = G(); return { player: g.player.protagonist, partner: g.partner.protagonist, mode: g.partner.partnerAI.mode }; },
    dist() { const g = G(), a = g.player.pos, b = g.partner.pos; return Math.hypot(a.x - b.x, a.z - b.z); },
  };
});
const T = (fn, arg) => page.evaluate(fn, arg);
await sun.advance(2);

// ---- the second protagonist exists and waits at home -------------------------------
let st = await T(() => window.__t.who());
check('Sol exists as the partner and waits at the motel', st.player === 'cal' && st.partner === 'sol' && st.mode === 'wait', JSON.stringify(st));
check('the HUD shows both protagonists', await T(() => document.querySelector('.crew')?.textContent.includes('CAL') && document.querySelector('.crew').textContent.includes('SOL')));

// ---- follow on foot ----------------------------------------------------------------
await T(() => { const g = window.__sun.game, o = g.partner; window.__t.walkTo(o.pos.x - 1.5, o.pos.z, { within: 1 }); });
await T(() => window.__t.press('partner'));
st = await T(() => window.__t.who());
check('the partner key makes Sol follow', st.mode === 'follow');
// walk 25 m away along the lot / street
await T(() => { const g = window.__sun.game, p = g.player; window.__t.walkTo(p.pos.x + 22, p.pos.z + 4, { within: 1.2 }); window.__t.tick(3); });
let d = await T(() => window.__t.dist());
check('Sol keeps up on foot', d < 5, `${d.toFixed(1)} m behind`);

// ---- boarding the player's car --------------------------------------------------------
const car = await T(() => { const v = window.__sun.game.vehicles.find((x) => x.persistentId === 'start-sedan'); return { x: v.pos.x, z: v.pos.z }; });
await T(([x, z]) => { const t = window.__t; t.walkTo(x - 3, z, { within: 1.5 }); t.press('enterVehicle'); t.waitFor('g.player.vehicle', 8); }, [car.x, car.z]);
const boardT = await T(() => window.__t.waitFor('g.partner.vehicle && g.partner.vehicle === g.player.vehicle', 12));
check('Sol gets in your car as a passenger', boardT >= 0, `${boardT}s, seat ${await T(() => window.__sun.game.partner.seat)}`);

// drive a short way with the test autopilot
const before = await T(() => ({ x: window.__sun.game.player.vehicle.pos.x, z: window.__sun.game.player.vehicle.pos.z }));
await T(() => { const S = window.__sun; S.debug.autopilot(0, 0, { cruise: true }); window.__t.tick(10); S.debug.stop(); const v = S.game.player.vehicle; v.input.throttle = 0; v.input.brake = 1; window.__t.waitFor('g.player.vehicle.speed < 0.3', 8); });
const after = await T(() => { const g = window.__sun.game; return { x: g.player.vehicle.pos.x, z: g.player.vehicle.pos.z, sx: g.partner.pos.x, sz: g.partner.pos.z }; });
check('the passenger rides along', Math.hypot(after.x - before.x, after.z - before.z) > 20 && Math.hypot(after.sx - after.x, after.sz - after.z) < 0.5);

// ---- switching inside the car: Cal (driver) becomes the partner and drives ----------------
await T(() => { const g = window.__sun.game; g.player.pc.inventory.ammo.pistol.reserve = 7; g.partner.pc.inventory.ammo.pistol.reserve = 30; });
await T(() => window.__t.press('switchCharacter'));
st = await T(() => window.__t.who());
check('switching hands control to Sol', st.player === 'sol' && st.partner === 'cal');
check('each protagonist keeps their own ammo', await T(() => { const g = window.__sun.game; return g.player.controller.inventory.ammo.pistol.reserve === 30 && g.partner.pc.inventory.ammo.pistol.reserve === 7; }));
// set a waypoint ~250 m away on the road network; Cal drives there
const wp = { x: 90, z: -160 };
await T((w) => { window.__sun.app.hud.waypoint = { x: w.x, z: w.z, label: 'Waypoint' }; }, wp);
const d0 = await T((w) => { const v = window.__sun.game.player.vehicle; return Math.hypot(v.pos.x - w.x, v.pos.z - w.z); }, wp);
const arriveT = await T((w) => window.__t.waitFor(`Math.hypot(g.player.vehicle.pos.x - ${w.x}, g.player.vehicle.pos.z - ${w.z}) < 24 && g.player.vehicle.speed < 1`, 120, 0.5), wp);
const d1 = await T((w) => { const v = window.__sun.game.player.vehicle; return Math.hypot(v.pos.x - w.x, v.pos.z - w.z); }, wp);
check('the partner drives you to your waypoint and stops', arriveT >= 0, `${d0.toFixed(0)} m → ${d1.toFixed(0)} m in ${arriveT}s`);

// ---- passenger drive-by: aim and fire from the seat ----------------------------------------
const shots = await T(() => {
  const S = window.__sun, g = S.game, vi = S.input.virtual;
  let fired = 0;
  const off = g.events.on ? null : null; void off;
  g.events.on('gunshot', ({ shooter }) => { if (shooter === g.player) fired++; });
  g.player.controller.inventory.current = 'pistol';
  g.cameraRig.yaw = g.player.vehicle.yaw + Math.PI / 2;
  vi.actions.add('aim'); vi.actions.add('fire');
  window.__t.tick(1.5);
  vi.actions.clear();
  window.__t.tick(0.3);
  return { fired, mag: g.player.controller.inventory.ammo.pistol.mag, calMag: g.partner.pc.inventory.ammo.pistol.mag };
});
check('the passenger can shoot from the car', shots.fired >= 2, JSON.stringify(shots));
// (shots in public are a crime: let the police state run out before the switching checks)
await T(() => { const g = window.__sun.game; g.wanted.clear(true); g.police.clearAll(); window.__t.tick(1); });

// ---- getting out together ----------------------------------------------------------------
await T(() => { window.__t.press('enterVehicle'); window.__t.waitFor('!g.player.vehicle', 6); });
const outT = await T(() => window.__t.waitFor('!g.partner.vehicle', 8));
check('the partner gets out when you do, and follows', outT >= 0 && (await T(() => window.__sun.game.partner.partnerAI.mode)) === 'follow', `${outT}s`);

// ---- far switch: leave Cal waiting, walk away, switch back --------------------------------
await T(() => window.__t.press('partner'));
check('the partner key makes them wait', (await T(() => window.__t.who())).mode === 'wait');
const calSpot = await T(() => ({ x: window.__sun.game.partner.pos.x, z: window.__sun.game.partner.pos.z }));
// walk along Coral Ave, 50 m south of the waypoint junction
const walked = await T(() => { const t = window.__t, p = window.__sun.game.player; t.walkTo(84, -160, { within: 2, maxSec: 25 }); t.walkTo(84, -100, { within: 2, maxSec: 40 }); return [p.pos.x, p.pos.z].map(Math.round); });
d = await T(() => window.__t.dist());
// witnesses of the drive-by may still have called it in; that's covered by the wanted tests, so wipe it here
const why = await T(() => { const g = window.__sun.game; g.wanted.clear(true); g.police.clearAll(); return g.crew.switchBlocked(); });
await T(() => window.__t.press('switchCharacter'));
st = await T(() => window.__t.who());
const calPos = await T(() => ({ x: window.__sun.game.player.pos.x, z: window.__sun.game.player.pos.z }));
check('a far switch puts you in Cal\'s shoes where he waited; Sol stays put', st.player === 'cal' && st.mode === 'wait' && Math.hypot(calPos.x - calSpot.x, calPos.z - calSpot.z) < 3, `${d.toFixed(0)} m apart (Sol walked to ${walked})${why ? ', blocked: ' + why : ''}`);

// ---- switching is refused while wanted ---------------------------------------------------------
await T(() => { const g = window.__sun.game; g.wanted.report('assault', g.player.pos.x, g.player.pos.z, 'witness'); window.__t.press('switchCharacter'); });
check('switching is refused while the police are after you', (await T(() => window.__t.who())).player === 'cal');
await T(() => { window.__sun.game.wanted.clear(true); window.__sun.game.police.clearAll(); });

// ---- save and reload: both protagonists come back as they were ------------------------------
await T(() => { const g = window.__sun.game; g.player.health = 77; g.partner.health = 64; g.saveGame('test'); });
const saved = await T(() => JSON.parse(localStorage.getItem('sunstate.save')));
check('the save holds both protagonists (v2)', saved.version === 2 && saved.active === 'cal' && saved.crew.cal.health === 77 && saved.crew.sol.health === 64 && saved.crew.sol.ammo.pistol.reserve === 30, `sol at ${saved.crew.sol.x?.toFixed(0)},${saved.crew.sol.z?.toFixed(0)}`);
await page.goto(page.url().split('?')[0], { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'title', null, { timeout: 180000 });
await page.evaluate(() => window.__sun.app.continueGame());
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 60000 });
const loaded = await T(() => { const g = window.__sun.game; return { active: g.player.protagonist, cal: Math.round(g.player.health), sol: Math.round(g.partner.health), solAmmo: g.partner.pc.inventory.ammo.pistol.reserve, solPos: [g.partner.pos.x, g.partner.pos.z], mode: g.partner.partnerAI.mode }; });
// a partner who was following is placed beside you; one who was waiting is back where they waited
const placeOk = saved.crew.sol.mode === 'follow' ? loaded.mode === 'follow' : Math.hypot(loaded.solPos[0] - saved.crew.sol.x, loaded.solPos[1] - saved.crew.sol.z) < 2;
check('continue restores each protagonist\'s health, ammo and position', loaded.active === 'cal' && loaded.cal === 77 && loaded.sol === 64 && loaded.solAmmo === 30 && placeOk, JSON.stringify(loaded) + ' saved mode ' + saved.crew.sol.mode);

const errs = logs.filter((l) => l.includes('PAGEERROR'));
check('no page errors', errs.length === 0, errs.slice(0, 3).join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
await browser.close();
process.exit(summary() ? 0 : 1);
