/**
 * Milestone 3 mission playthrough, "Low Tide", in headless Chromium:
 *   npm run build && npm run preview &   then   node tools/e2e-lowtide.mjs
 * Sol drives the crew over the twin-span to Cayo Lento (partner AI driving,
 * player as passenger), the pickup on the pier, the Caldera ambush, a chase
 * with the player shooting from the passenger seat, a role switch mid-chase
 * (Tab), the return to the motel, the reward and the autosave; then a failure
 * (partner down) and a retry from the checkpoint.
 *
 * Scripted parts (labelled below): the player's aim during the chase is
 * pointed at the nearest enemy car by the test, and while the player is Sol at
 * the wheel the test autopilot (the traffic AI) drives her car. The partner's
 * driving (there and back) and shooting are the real partner AI.
 */
import { launch, checker } from './harness.mjs';

const { check, summary } = checker();
const t0 = Date.now();
const { browser, page, logs } = await launch();
// a save where "Small Change" is done, so "Low Tide" is unlocked
await page.evaluate(() => {
  localStorage.setItem('sunstate.save', JSON.stringify({ version: 2, savedAt: new Date().toISOString(), money: 2500, hour: 15, active: 'cal', crew: { cal: { health: 100, weapons: ['fists', 'pistol'], current: 'pistol', ammo: { pistol: { mag: 12, reserve: 120 } }, mode: 'player' }, sol: { health: 100, weapons: ['fists', 'pistol'], current: 'pistol', ammo: { pistol: { mag: 12, reserve: 120 } }, mode: 'wait' } }, missions: { completed: ['small_change'] }, vehicles: [], stats: {} }));
});
await page.goto(page.url().split('?')[0], { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'title', null, { timeout: 180000 });
await page.evaluate(() => window.__sun.app.continueGame());
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 60000 });

await page.evaluate(() => {
  const S = window.__sun;
  const G = () => S.game;
  const tick = (sec, r = 0) => S.advance(sec, r);
  window.__t = {
    tick,
    walkTo(x, z, { maxSec = 30, within = 0.8, sprint = false } = {}) {
      const g = G(), p = g.player, vi = S.input.virtual;
      let t = 0;
      while (t < maxSec) {
        const d = Math.hypot(x - p.pos.x, z - p.pos.z);
        if (d < within) break;
        g.cameraRig.yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
        vi.move = p.blockedT > 0.4 ? { x: 1, y: 0.4 } : { x: 0, y: d < 1.5 ? 0.5 : 1 };
        vi.actions.clear(); if (sprint && d > 3) vi.actions.add('sprint');
        tick(0.1); t += 0.1;
      }
      vi.move = null; vi.actions.clear(); tick(0.2);
      return Math.hypot(x - p.pos.x, z - p.pos.z);
    },
    press(a) { S.input.virtual.edges.add(a); tick(1 / 30); },
    skipTalk() { let n = 0; while (G().missions.cutscene && n++ < 20) { S.input.virtual.edges.add('skip'); tick(0.1); } },
    waitFor(src, maxSec, step = 0.25, each = null) {
      const fn = new Function('g', 'S', 'return (' + src + ')');
      let t = 0;
      while (t < maxSec) { if (fn(G(), S)) return t; if (each) each(); tick(step); t += step; }
      return -1;
    },
    stage() { return G().missions.stage?.id || null; },
    /** Scripted self-defence on foot: aim and fire at the nearest visible enemy within 30 m. */
    fightBack() {
      const g = G(), vi = S.input.virtual, p = g.player;
      if (p.vehicle) return false;
      let best = null, bd = 30;
      for (const c of g.extras) { if (!c.enemy || c.dead || c.vehicle) continue; const d = c.distanceTo(p.pos.x, p.pos.z); if (d < bd) { bd = d; best = c; } }
      if (!best) { vi.actions.delete('aim'); vi.actions.delete('fire'); return false; }
      g.player.controller.inventory.current = 'pistol';
      g.cameraRig.yaw = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
      g.cameraRig.pitch = Math.atan2(best.pos.y + 1.1 - (p.pos.y + 1.6), bd);
      vi.actions.add('aim'); vi.actions.add('fire');
      return true;
    },
    /** Scripted aim: point the camera at the nearest live enemy car and hold aim + fire. */
    aimAtEnemies(on) {
      const g = G(), vi = S.input.virtual;
      vi.actions.clear();
      if (!on) return null;
      const p = g.player, pv = p.vehicle, from = pv ? pv.pos : p.pos;
      let best = null, bd = 45;
      for (const v of g.vehicles) { if (!v.enemy || v.destroyed || v.sunk) continue; const d = Math.hypot(v.pos.x - from.x, v.pos.z - from.z); if (d < bd) { bd = d; best = v; } }
      if (!best) return null;
      g.cameraRig.yaw = Math.atan2(best.pos.x - from.x, best.pos.z - from.z);
      g.cameraRig.pitch = Math.atan2(best.pos.y + 0.6 - (from.y + 2.0), bd);
      vi.actions.add('aim'); vi.actions.add('fire');
      return bd;
    },
  };
});
const T = (fn, arg) => page.evaluate(fn, arg);
await T(() => window.__t.tick(1));

// ---- start: Sol is waiting by the marker; the two-person mission starts with her there ----
const startLabel = await T(() => { const t = window.__t, g = window.__sun.game; const it = g.interactables.find((i) => i.id === 'mission:low_tide'); t.walkTo(it.x - 1, it.z, { within: 0.9 }); return g.player.controller.prompt?.text || null; });
check('"Low Tide" is offered at the motel with Sol there', /Low Tide/.test(startLabel || ''), startLabel);
await T(() => { window.__t.press('interact'); window.__t.skipTalk(); });
check('the mission starts and Sol comes along', (await T(() => window.__t.stage())) === 'drive' && (await T(() => window.__sun.game.partner.partnerAI.mode)) === 'follow');
check('switching is allowed during this mission', await T(() => window.__sun.game.crew.switchBlocked() === null));

// ---- "you drive": G by the sedan, Sol takes the wheel, Cal rides ----
const sedan = await T(() => { const v = window.__sun.game.vehicles.find((x) => x.persistentId === 'start-sedan'); return { x: v.pos.x, z: v.pos.z }; });
await T(([x, z]) => { const t = window.__t; t.walkTo(x - 3.2, z + 2, { within: 1.2 }); t.press('partner'); t.waitFor('g.partner.vehicle && g.partner.seat === 0', 15); t.press('enterVehicle'); t.waitFor('g.player.vehicle && g.player.seat > 0', 10); }, [sedan.x, sedan.z]);
check('G by a car: Sol drives and Cal rides as passenger', await T(() => { const g = window.__sun.game; return g.partner.seat === 0 && g.player.seat > 0 && g.player.vehicle === g.partner.vehicle; }));

// ---- Sol drives over the twin-span to the marina ----
let maxY = 0;
const driveT = await T(() => {
  const g = window.__sun.game;
  let my = 0;
  const t = window.__t.waitFor("g.missions.stage?.id === 'pier'", 200, 0.5, () => { my = Math.max(my, g.player.vehicle ? g.player.vehicle.pos.y : 0); });
  window.__maxY = my;
  return t;
});
maxY = await T(() => window.__maxY);
if (driveT < 0) console.log('   drive debug:', await T(() => { const g = window.__sun.game, v = g.player.vehicle || g.partner.vehicle || g.player, ai = g.partner.partnerAI.ai; return JSON.stringify({ pIn: !!g.player.vehicle, sIn: !!g.partner.vehicle, stage: g.missions.stage?.id, failed: g.missions.failed?.reason, v: v && [v.pos.x, v.pos.y, v.pos.z, v.speed || 0, v.yaw].map((n) => +n.toFixed(1)), ai: ai && { mode: ai.mode, edge: ai.edge, off: ai.offroad, wp: ai.wp.slice(0, 3).map((w) => [Math.round(w.x), Math.round(w.z)]), blocked: ai.blockedBy ? (ai.blockedBy.modelId || ai.blockedBy.role) + '@' + Math.round(ai.blockedBy.pos.x) + ',' + Math.round(ai.blockedBy.pos.z) : null }, near: g.vehicles.filter((o) => o !== v && Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z) < 20).map((o) => [o.modelId, Math.round(o.pos.x), Math.round(o.pos.z), +o.speed.toFixed(1)]) }); }));
check('Sol drives the crew across the twin-span to Cayo Lento', driveT >= 0 && maxY > 6, `${driveT}s, max deck height ${maxY.toFixed(1)} m, at ${await T(() => JSON.stringify([Math.round(window.__sun.game.player.pos.x), Math.round(window.__sun.game.player.pos.z)]))}`);

// ---- the pier ----
await T(() => { const t = window.__t; t.press('enterVehicle'); t.waitFor('!g.player.vehicle', 6); });
const pierD = await T(() => { const t = window.__t, g = window.__sun.game, r = g.missions.active.data.rudy; t.walkTo(262, 713, { maxSec: 30, within: 1.5 }); t.walkTo(262, 735, { maxSec: 30, within: 1.2 }); return t.walkTo(r.pos.x, r.pos.z - 2, { maxSec: 40, within: 1 }); });
const atAmbush = await T(() => window.__t.waitFor("g.missions.stage?.id === 'ambush'", 4));
check('meeting Rudy at the end of the pier hands over the cooler', atAmbush >= 0 && (await T(() => !!window.__sun.game.missions.active?.data.cooler)), `${pierD.toFixed(1)} m from the spot by Rudy; player ${await T(() => { const g = window.__sun.game; return [g.player.pos.x, g.player.pos.y, g.player.pos.z].map((n) => n.toFixed(1)) + (g.player.swim ? ' swimming' : ''); })}`);
check('the Calderas arrive: two enemy cars with crews', await T(() => window.__sun.game.vehicles.filter((v) => v.enemy).length === 2 && window.__sun.game.extras.filter((c) => c.enemy).length === 4));
await T(() => window.__t.skipTalk());

// ---- back to the car; G → Sol drives, Cal shoots ----
const car = await T(() => { const v = window.__sun.game.vehicles.find((x) => x.persistentId === 'start-sedan'); return { x: v.pos.x, z: v.pos.z }; });
const toCar = await T(([x, z]) => {
  const t = window.__t, g = window.__sun.game, vi = window.__sun.input.virtual;
  t.walkTo(262, 713, { maxSec: 30, within: 1.5, sprint: true });
  // head for wherever the car is now (the Calderas may have shunted it)
  const car = g.vehicles.find((v) => v.persistentId === 'start-sedan');
  for (let k = 0; k < 6 && g.player.controller.findVehicle()?.vehicle !== car; k++) {
    const [dx, dz] = car.doorPoint(0);
    t.walkTo(dx + (dx - car.pos.x) * 0.6, dz + (dz - car.pos.z) * 0.6, { maxSec: 12, within: 1.2, sprint: true });
  }
  void x; void z;
  const cand = !!g.crew.wheelCandidate(), solD = Math.round(g.partner.distanceTo(g.player.pos.x, g.player.pos.z));
  t.press('partner');
  // (if the Calderas get here first: shoot back while Sol gets behind the wheel)
  t.waitFor('g.partner.vehicle && g.partner.seat === 0', 28, 0.25, () => { if (g.player.health < 60) t.fightBack(); });
  vi.actions.clear();
  let tries = 0;
  while (!g.player.vehicle && tries++ < 6) { t.press('enterVehicle'); t.waitFor('g.player.vehicle || !g.player.controller.enter', 6, 0.25, () => { if (!g.player.controller.enter && g.player.health < 60) t.fightBack(); }); vi.actions.clear(); }
  return { cand, solD, hp: Math.round(g.player.health), sol: g.partner.seat, seat: g.player.seat, enemiesDown: g.extras.filter((c) => c.enemy && c.dead).length };
}, [car.x, car.z]);
console.log('   back to the car:', JSON.stringify(toCar));
const inChase = await T(() => window.__t.waitFor("g.missions.stage?.id === 'chase'", 5));
check('both in the car: the chase begins', inChase >= 0, await T(() => window.__t.stage()));

// ---- the chase: Sol drives (partner AI), Cal shoots (aim scripted at the nearest enemy car);
//      a few seconds in, Tab swaps the roles; later Tab swaps them back and Sol drives home ----
const chase = await T(() => {
  const g = window.__sun.game, t = window.__t, S = window.__sun;
  let calShots = 0, calShotsAsPartner = 0, closest = 1e9;
  g.events.on('gunshot', ({ shooter }) => { if (shooter?.protagonist === 'cal') { if (shooter === g.player) calShots++; else calShotsAsPartner++; } });
  let tt = 0;
  while (tt < 40 && g.missions.stage?.id === 'chase' && !(calShots >= 5 && tt >= 3)) { const d = t.aimAtEnemies(true); if (d) closest = Math.min(closest, d); t.tick(0.25); tt += 0.25; }
  t.aimAtEnemies(false);
  const phase1 = { calShots, closest: Math.round(closest), t: tt, stage: g.missions.stage?.id, enemyHp: g.vehicles.filter((v) => v.enemy).map((v) => Math.round(v.health)) };
  t.press('switchCharacter');
  const swapped = { player: g.player.protagonist, seat: g.player.seat, partnerSeat: g.partner.seat };
  // Sol at the wheel (the test autopilot drives her car) while Cal shoots on his own
  if (g.player.seat === 0) {
    S.debug.autopilot(14, -30, { arrive: 22 });
    let t2 = 0; while (t2 < 20 && g.missions.stage?.id === 'chase') { t.tick(0.5); t2 += 0.5; }
    S.debug.stop();
  }
  t.press('switchCharacter'); // back: Cal rides, Sol (partner AI) drives
  const back = { player: g.player.protagonist, seat: g.player.seat };
  let t3 = 0; while (t3 < 150 && g.missions.stage?.id === 'chase') { t.aimAtEnemies(true); t.tick(0.5); t3 += 0.5; }
  t.aimAtEnemies(false);
  return { phase1, swapped, calShotsAsPartner, back, after: g.missions.stage?.id || g.missions.failed?.reason || 'none' };
});
check('the Calderas give chase and Cal shoots from the passenger seat while Sol drives', chase.phase1.calShots >= 5 && chase.phase1.closest < 45, JSON.stringify(chase.phase1));
check('Tab mid-chase swaps roles: Sol at the wheel, Cal shooting on his own', chase.phase1.stage === 'chase' && chase.swapped.player === 'sol' && chase.swapped.seat === 0 && chase.swapped.partnerSeat > 0 && chase.calShotsAsPartner >= 1, JSON.stringify({ ...chase.swapped, calShotsAsPartner: chase.calShotsAsPartner }));
check('...and swaps back (Cal rides, Sol drives)', chase.back.player === 'cal' && chase.back.seat > 0, JSON.stringify(chase.back));
const afterChase = await T(() => ({ stage: window.__t.stage(), failed: window.__sun.game.missions.failed?.reason || null, enemies: window.__sun.game.vehicles.filter((v) => v.enemy && !v.destroyed).length }));
check('the Calderas are shaken off', ['escape', 'return'].includes(afterChase.stage), JSON.stringify(afterChase));

// ---- police (if the gunfight drew them): cleared by the test, as in the M2 e2e ----
if (await T(() => window.__sun.game.wanted.level > 0)) await T(() => { const g = window.__sun.game; g.wanted.clear(); g.police.clearAll(); window.__t.tick(1); });

// ---- home: Sol (partner AI) drives back over the twin-span to the motel; then walk to the door together ----
const ret = await T(() => {
  const g = window.__sun.game, t = window.__t, S = window.__sun;
  if (!g.player.vehicle) return 'on foot';
  if (g.player.seat === 0) { S.debug.autopilot(14, -30, { arrive: 22 }); t.waitFor('S.debug.arrived && g.player.vehicle.speed < 0.5', 200, 0.5); S.debug.stop(); return 'autopilot ' + [Math.round(g.player.pos.x), Math.round(g.player.pos.z)]; }
  const w = t.waitFor('g.partner.partnerAI.arrived && g.player.vehicle.speed < 0.5', 240, 0.5);
  return `Sol drove (${w}s) to ` + [Math.round(g.player.pos.x), Math.round(g.player.pos.z)];
});
const door = await T(() => { const d = window.__sun.game.interactables.find((i) => i.id === 'safehouse'); return { x: d.x, z: d.z }; });
const passT = await T(([x, z]) => {
  const t = window.__t, g = window.__sun.game;
  if (g.player.vehicle) { t.press('enterVehicle'); t.waitFor('!g.player.vehicle', 6); }
  t.walkTo(x + 3, z, { maxSec: 40, within: 1 }); t.walkTo(x - 0.3, z, { maxSec: 10, within: 0.8 });
  return t.waitFor('!g.missions.active', 20);
}, [door.x, door.z]);
const money = await T(() => window.__sun.game.economy.money);
check('back at the motel together: MISSION PASSED with the $4,000 payout', passT >= 0 && (await T(() => window.__sun.game.missions.completed.has('low_tide'))) && money >= 6500, `drove to ${ret}, $${money}`);
check('the mission is saved', await T(() => JSON.parse(localStorage.getItem('sunstate.save')).missions.completed.includes('low_tide')));
check('no enemies or mission characters left behind', await T(() => window.__sun.game.vehicles.filter((v) => v.enemy).length === 0 && window.__sun.game.extras.filter((c) => c.enemy || c.missionId).length === 0));

// ---- failure and retry: the partner goes down on the pier → retry from the checkpoint ----
const fail = await T(() => {
  const g = window.__sun.game, t = window.__t;
  g.missions.completed.delete('low_tide');
  g.missions.start('low_tide');
  t.skipTalk();
  // jump to the pier stage with a checkpoint, as if driven there
  g.respawnPlayer(250, 698, 0);
  g.crew.regroupAt(250, 698, 0, true);
  t.waitFor("g.missions.stage?.id === 'pier'", 5);
  const r = g.missions.active.data.rudy;
  t.walkTo(262, 713, { within: 1.5 }); t.walkTo(262, 735, { within: 1.2 }); t.walkTo(r.pos.x, r.pos.z - 2, { maxSec: 40, within: 1 });
  t.waitFor("g.missions.stage?.id === 'ambush'", 4); t.skipTalk();
  g.partner.damage(500, null, 'bullet');
  t.tick(0.5);
  return g.missions.failed?.reason || null;
});
check('the partner going down fails the mission with a reason', /down/.test(fail || ''), fail);
await T(() => { window.__sun.app.retryMission(); window.__t.tick(1); }); // Enter on the real keyboard
const retry = await T(() => { const g = window.__sun.game; return { stage: g.missions.stage?.id, partnerOk: !g.partner.dead && g.crew.downT <= 0, rivals: g.vehicles.filter((v) => v.enemy).length, rudy: g.extras.filter((c) => !c.enemy).length }; });
check('retry restarts at the pier checkpoint with Sol back and no duplicates', retry.stage === 'ambush' && retry.partnerOk && retry.rivals === 2 && retry.rudy <= 1, JSON.stringify(retry));

const errs = logs.filter((l) => l.includes('PAGEERROR'));
check('no page errors', errs.length === 0, errs.slice(0, 3).join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
await browser.close();
process.exit(summary() ? 0 : 1);
