/**
 * Rules and simulation tests that run in Node (no browser, no GPU):
 *   node tools/test.mjs
 * A tiny canvas/localStorage shim lets the texture and save code load.
 */
// ---- shims -----------------------------------------------------------------
const ctx2d = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 100 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) });
    return t[k] ?? (() => {});
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, style: {} }) };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const THREE = await import('three');
const L = await import('../src/world/layout.js');
const { DISTRICT, PLACES, SIDEWALKS, INTERIORS } = await import('../src/world/district.js');
const { CollisionWorld, Collider, rayCollider, obbObb } = await import('../src/world/collision.js');
const { buildWorld, makeMaterials } = await import('../src/world/build.js');
const { buildProps } = await import('../src/world/props.js');
const { Vehicle } = await import('../src/entities/vehicle.js');
const { Character } = await import('../src/entities/character.js');
const { Events } = await import('../src/core/events.js');
const { Wanted, WANTED_CONFIG } = await import('../src/game/wanted.js');
const { sanitizeSave, defaultSave, writeSave, loadSave, SAVE_KEY } = await import('../src/game/save.js');
const { sanitizeSettings, Settings } = await import('../src/core/settings.js');
const { laneLine } = await import('../src/ai/driver.js');

const results = [];
function check(name, ok, info = '') { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); }

// ---- world build (collision only matters here) ------------------------------
const fakeEngine = { maxAniso: 1, sky: { material: { uniforms: {} } }, scene: new THREE.Scene(), time: { night: 0 }, camera: new THREE.PerspectiveCamera() };
const cw = new CollisionWorld();
buildWorld(fakeEngine, cw, makeMaterials(fakeEngine));
buildProps(cw, makeMaterials(fakeEngine));
check('world builds with colliders', cw.all.length > 300, `${cw.all.length} colliders`);

const world = { ground: (x, z, y) => L.groundHeight(x, z, y), isWater: L.isWater, surface: L.surfaceAt, waterY: L.WATER_Y, collision: cw, interiorAt: () => null };
function fakeGame() {
  return { world, engine: { scene: new THREE.Scene(), time: { night: 0 } }, events: new Events(), time: 0, vehicles: [], peds: [], cops: [], extras: [], allCharacters() { return []; } };
}

// ---- layout ---------------------------------------------------------------
{
  const { nodes, edges } = L.ROAD_GRAPH;
  const unreachable = nodes.filter((n) => !L.findRoute(0, n.id)).length;
  check('every intersection is reachable by road', unreachable === 0, `${nodes.length} nodes, ${edges.length} edges`);
  let off = 0;
  for (const e of edges) for (const from of [e.a, e.b]) for (let lane = 0; lane < e.lanes; lane++) {
    const l = laneLine(e, from, lane);
    for (const t of [0, 0.5, 1]) if (!L.roadAt(l.x0 + (l.x1 - l.x0) * t, l.z0 + (l.z1 - l.z0) * t)) off++;
  }
  check('all traffic lanes lie on road surface', off === 0, `${off} lane points off-road`);
  const onRoad = SIDEWALKS.nodes.filter((n) => L.roadAt(n.x, n.z)).length;
  check('sidewalk graph stays off the road', onRoad === 0);
  const blocked = SIDEWALKS.nodes.filter((n) => cw.overlapsCircle(n.x, n.z, 0.3, 0.3, 1.5, (c) => c.tag !== 'prop')).length;
  check('sidewalk nodes are not inside buildings', blocked === 0, `${blocked} blocked`);
  const pts = { safehouseSpawn: PLACES.safehouse.spawn, hospital: PLACES.hospital, police: PLACES.police, storeFront: { x: PLACES.store.door.x, z: PLACES.store.door.z - 3 }, storeInside: { x: PLACES.store.door.x, z: PLACES.store.door.z + 2.5 } };
  for (const [k, p] of Object.entries(pts)) check(`spawn/marker point free: ${k}`, !cw.overlapsCircle(p.x, p.z, 0.35, L.groundHeight(p.x, p.z) + 0.2, 1.6));
  // the store doorway is open; the walls either side are solid
  const d = PLACES.store.door;
  const through = cw.raycast(d.x, 1.2, d.z - 3, 0, 0, 1, 6);
  check('store doorway is walkable (no wall in the opening)', !through || through.t > 5.5);
  const wall = cw.raycast(d.x + 5, 1.2, d.z - 3, 0, 0, 1, 6);
  check('store front wall blocks beside the door', !!wall && wall.t < 3.5);
  // parked cars don't spawn inside anything
  let bad = 0;
  for (const p of DISTRICT.parking) {
    const def = (await import('../src/data/vehicles.js')).VEHICLES[p.model];
    const c = cw.boxContacts(p.x, p.z, def.width / 2, def.length / 2, p.rot, 0.3, 1.2).filter((c) => c.collider.tag !== 'railing');
    if (c.length) bad++;
  }
  check('parked cars spawn clear of walls and props', bad === 0, `${bad}/${DISTRICT.parking.length} overlapping`);
  const poles = cw.all.filter((c) => c.type === 'circle' && c.tag === 'prop' && L.roadAt(c.cx, c.cz) && !(c.cx < L.ISLAND.west - 1));
  check('no street furniture stands on the road', poles.length === 0, poles.slice(0, 3).map((c) => `${c.cx.toFixed(1)},${c.cz.toFixed(1)}`).join(' '));
  check('causeway deck is continuous over the water', [-45, -50, -100, -200, -280, -298].every((x) => L.groundHeight(x, 0, 10) > -0.01) && L.groundHeight(-150, 0, 10) > 6);
  check('a boat can pass under the causeway', L.groundHeight(-150, 0, -1) < -4);
}

// ---- collision maths -----------------------------------------------------------
{
  const box = new Collider({ type: 'box', cx: 10, cz: 0, hx: 1, hz: 1, y0: 0, y1: 3 });
  const r = rayCollider(box, 0, 1, 0, 1, 0, 0, 100);
  check('ray hits box face at the right distance', r && Math.abs(r.t - 9) < 1e-6 && r.nx === -1);
  check('ray passes above a low box', !rayCollider(box, 0, 5, 0, 1, 0, 0, 100));
  const rot = new Collider({ type: 'box', cx: 0, cz: 0, hx: 2, hz: 0.5, angle: Math.PI / 4 });
  const r2 = rayCollider(rot, -10, 1, 0, 1, 0, 0, 100);
  check('ray vs rotated box', r2 && r2.t > 8 && r2.t < 10);
  const w = new CollisionWorld(); w.add({ type: 'box', cx: 0, cz: 0, hx: 1, hz: 1 });
  const p = w.resolveCircle(0.9, 0, 0.3, 0, 1.8);
  check('circle pushed out of a box', Math.abs(p.x - 1.3) < 1e-6);
  const s = obbObb(0, 0, 1, 2, 0, 1.5, 0, 1, 2, 0);
  check('OBB overlap depth and normal', s && Math.abs(s.depth - 0.5) < 1e-6 && s.nx < 0);
}

// ---- vehicle physics --------------------------------------------------------------
function runCar(model, seconds, input, setup) {
  const g = fakeGame();
  const v = new Vehicle(g, model, { x: 0, z: 0, yaw: 0 });
  g.vehicles.push(v);
  v.seats[0] = { role: 'test' }; // a driver
  setup?.(v);
  const hist = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) { Object.assign(v.input, typeof input === 'function' ? input(t, v) : input); v.step(dt); hist.push({ t, v: v.vLong, speed: v.speed, x: v.pos.x, z: v.pos.z, yaw: v.yaw, w: v.w }); }
  return { v, hist };
}
// open test track: no colliders near the origin? use a fresh collision world
const flatWorld = { ...world, ground: () => 0, collision: new CollisionWorld() };
const realWorld = world;
Object.assign(world, flatWorld);
{
  const t60 = (m) => runCar(m, 20, { throttle: 1, brake: 0, steer: 0 }).hist.find((h) => h.speed >= 26.8)?.t ?? Infinity;
  const k = t60('kestrel'), i = t60('ironhorse'), p = t60('pickup');
  check('sedan 0–60 mph in a plausible time', k > 5 && k < 12, `${k.toFixed(1)} s`);
  check('muscle car accelerates harder than the sedan', i < k, `${i.toFixed(1)} s vs ${k.toFixed(1)} s`);
  check('pickup is slower off the line than the muscle car', p > i, `${p.toFixed(1)} s`);
  const top = runCar('kestrel', 60, { throttle: 1 }).v.speed;
  check('top speed stays near the definition', top > 38 && top < 47, `${(top * 2.237).toFixed(0)} mph`);
  const brake = runCar('kestrel', 12, (t, v) => (t < 0.05 ? {} : { throttle: 0, brake: 1 }), (v) => { v.vel.set(0, 26.8); });
  const stopAt = brake.hist.find((h) => h.speed < 0.3);
  check('60–0 mph braking distance is plausible', stopAt && stopAt.z > 25 && stopAt.z < 60, `${stopAt?.z.toFixed(1)} m`);
  check('brakes never push the car backwards', brake.hist.every((h) => h.v > -0.5) || brake.hist.findIndex((h) => h.v < -0.5) > brake.hist.indexOf(stopAt) + 10);
  const turn = runCar('kestrel', 6, (t, v) => (t < 2 ? { throttle: 1, steer: 0 } : { throttle: 0.4, steer: 1 }));
  const last = turn.hist[turn.hist.length - 1];
  check('steering right turns right (yaw decreases)', last.yaw < -0.5, `yaw ${last.yaw.toFixed(2)}`);
  const radius = last.speed / Math.abs(last.w);
  check('full-lock turning radius is car-like (no spin-out)', radius > 4.5 && radius < 40, `${radius.toFixed(1)} m at ${last.speed.toFixed(1)} m/s`);
  const spin = runCar('kestrel', 8, (t) => (t < 3 ? { throttle: 1 } : { throttle: 0.5, steer: 1 }));
  const yawRates = spin.hist.slice(-120).map((h) => Math.abs(h.w));
  check('sedan holds a steady full-lock circle', Math.max(...yawRates) - Math.min(...yawRates) < 0.25, `yaw rate ${Math.min(...yawRates).toFixed(2)}–${Math.max(...yawRates).toFixed(2)} rad/s`);
  // peak sideways speed (body frame) during a 1.5 s turn-in from 20 m/s
  const lat = (hb) => { let peak = 0; runCar('ironhorse', 1.5, (t, v) => { const [fx, fz] = v.forward; peak = Math.max(peak, Math.abs(-fz * v.vel.x + fx * v.vel.y)); return { throttle: 0, steer: 1, handbrake: hb }; }, (v) => v.vel.set(0, 20)); return peak; };
  const slideHb = lat(true), slideNo = lat(false);
  check('handbrake makes the rear slide', slideHb > slideNo, `lateral ${slideHb.toFixed(1)} vs ${slideNo.toFixed(1)} m/s`);
  const pull = runCar('kestrel', 3, { throttle: 0.45, steer: -1 });
  check('pulls away from rest at full steering lock', pull.v.speed > 2 && Math.abs(pull.v.yaw) > 0.5, `${pull.v.speed.toFixed(1)} m/s, turned ${pull.v.yaw.toFixed(2)} rad`);
  const rev = runCar('kestrel', 6, { throttle: 0, brake: 1 });
  check('holding brake from rest reverses, capped', rev.v.vLong < -5 && rev.v.vLong > -11.5, `${rev.v.vLong.toFixed(1)} m/s`);
  const parked = runCar('kestrel', 3, {}, (v) => { v.seats[0] = null; v.vel.set(0, 3); });
  check('a parked car comes to rest', parked.v.speed < 0.05);
  // wall: a building-sized box ahead; drive into it at speed
  flatWorld.collision.add({ type: 'box', cx: 0, cz: 60, hx: 10, hz: 5, y0: -2, y1: 10 });
  const crash = runCar('ironhorse', 6, { throttle: 1 }, (v) => v.vel.set(0, 30));
  check('car cannot drive through a wall at 30 m/s', crash.v.pos.z < 55 - crash.v.hz + 0.6, `stopped at z=${crash.v.pos.z.toFixed(1)}`);
  check('crash damages the car', crash.v.health < 1000, `health ${crash.v.health.toFixed(0)}`);
  // momentum in a two-car collision
  const g = fakeGame();
  const a = new Vehicle(g, 'kestrel', { x: 0, z: 0, yaw: 0 }), b = new Vehicle(g, 'pickup', { x: 0, z: 4.9, yaw: 0 });
  a.vel.set(0, 15);
  const before = a.mass * a.vel.y + b.mass * b.vel.y;
  Vehicle.collidePair(a, b);
  const after = a.mass * a.vel.y + b.mass * b.vel.y;
  check('vehicle collision conserves momentum', Math.abs(before - after) / before < 0.05 && b.vel.y > 0);
}
Object.assign(world, realWorld, { ground: (x, z, y) => L.groundHeight(x, z, y), collision: cw });

// ---- characters --------------------------------------------------------------------
{
  const g = fakeGame();
  const sp = PLACES.safehouse.spawn;
  const c = new Character(g, { female: false, height: 1.8, build: 1, skin: 0, hair: 0, top: 0, bottom: 0, shoes: 0, hairStyle: 'short' }, { x: sp.x, z: sp.z });
  // walk west into the motel wall
  for (let i = 0; i < 240; i++) { c.wish.set(-1, 0); c.wishSpeed = 4; c.step(1 / 60); }
  check('character stops at a building wall', c.pos.x > -21.5 + 0.25 && c.pos.x < sp.x, `x=${c.pos.x.toFixed(2)}`);
  // curb: walk from the road onto the sidewalk
  const c2 = new Character(g, c.look, { x: 30, z: 40 });
  for (let i = 0; i < 120; i++) { c2.wish.set(1, 0); c2.wishSpeed = 3; c2.step(1 / 60); }
  check('character steps up a curb', Math.abs(c2.pos.y - L.CURB) < 0.01 && c2.pos.x > 34, `y=${c2.pos.y.toFixed(2)} x=${c2.pos.x.toFixed(1)}`);
  // off the seawall into the bay: swims, then climbs back out
  const c3 = new Character(g, c.look, { x: L.ISLAND.west + 1, z: 30 });
  for (let i = 0; i < 180; i++) { c3.wish.set(-1, 0); c3.wishSpeed = 4; c3.step(1 / 60); }
  check('falling into the bay starts swimming', c3.swim && c3.pos.y < L.WATER_Y);
  for (let i = 0; i < 600 && c3.swim; i++) { c3.wish.set(1, 0); c3.wishSpeed = 4; c3.step(1 / 60); }
  check('swimmer climbs out onto the island', !c3.swim && c3.pos.y > 0 && c3.pos.x > L.ISLAND.west - 0.5);
}

// ---- wanted ---------------------------------------------------------------------
{
  const g = fakeGame();
  g.player = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), vehicle: null };
  g.police = { canSeePoint: () => false, canSeePlayer: () => false };
  g.peds_ = { witness() {} };
  const W = new Wanted(g);
  const witness = { dead: false, removed: false, knockT: 0, pos: { x: 5, z: 5 }, controller: { callDone() {} } };
  W.startCall(witness, 'carjack', 0, 0);
  for (let i = 0; i < 9 * 60; i++) { g.time += 1 / 60; W.step(1 / 60); }
  check('a completed witness call raises the wanted level', W.level === 1 && W.state === 'reported', `level ${W.level} ${W.state}`);
  // stay inside the area: the timer runs slowly; leave it: clears
  g.player.pos.set(500, 0, 0);
  let t = 0;
  while (W.level > 0 && t < 120) { W.step(1 / 60); t += 1 / 60; }
  check('leaving the search area clears the wanted level', W.level === 0, `${t.toFixed(1)} s`);
  const W2 = new Wanted(g);
  const w2 = { ...witness, controller: { callDone() {} } };
  W2.startCall(w2, 'murder', 0, 0);
  w2.dead = true;
  W2.step(1 / 60);
  check('a call is cancelled if the witness is killed', W2.calls.length === 0 && W2.level === 0);
  const W3 = new Wanted(g);
  g.time = 100;
  W3.report('shooting', 0, 0, 'police');
  W3.report('shooting', 0, 0, 'police');
  W3.report('shooting', 0, 0, 'police');
  check('police-witnessed escalation is rate limited', W3.level === 3, `level ${W3.level}`);
  check('max level is configurable', WANTED_CONFIG.maxLevel === 5);
}

// ---- save / settings ----------------------------------------------------------
{
  check('corrupt save data falls back to defaults', JSON.stringify(sanitizeSave('garbage')) === JSON.stringify(defaultSave()));
  const s = sanitizeSave({ version: 1, savedAt: 'x', money: -50, hour: 99, player: { weapons: ['pistol', 'rocket', 'pistol'], current: 'rocket', ammo: { pistol: { mag: 99, reserve: -3 } } }, missions: { completed: ['small_change', 'nope', 'small_change'] }, vehicles: [{ id: 'a', model: 'kestrel', x: 1, z: 2 }, { id: 'a', model: 'kestrel' }, { id: 'b', model: 'tank' }] });
  check('save validation clamps and filters', s.money === 0 && s.hour === 23.99 && s.player.weapons.join() === 'fists,pistol' && s.player.current === 'fists' && s.player.ammo.pistol.mag === 12 && s.player.ammo.pistol.reserve === 0);
  check('save validation dedupes missions and vehicles', s.missions.completed.length === 1 && s.vehicles.length === 1);
  check('saves from a newer version are ignored safely', sanitizeSave({ version: 99, money: 5 }).money === defaultSave().money);
  writeSave({ ...defaultSave(), money: 1234 });
  writeSave({ ...defaultSave(), money: 4321 });
  check('save round-trips and keeps a backup', loadSave().money === 4321 && JSON.parse(localStorage.getItem(SAVE_KEY + '.backup')).money === 1234);
  localStorage.setItem(SAVE_KEY, '{not json');
  check('unreadable save does not crash loading', loadSave() === null);
  const st = sanitizeSettings({ graphics: { fov: 500, shadows: 'insane', renderScale: 'x' }, controls: { bindings: { jump: 'KeyJ', bogus: 'KeyB' } } });
  check('settings validation clamps and rejects bad values', st.graphics.fov === 90 && st.graphics.shadows === 'high' && st.graphics.renderScale === 1 && st.controls.bindings.jump === 'KeyJ' && !st.controls.bindings.bogus);
  const S = new Settings();
  S.bind('jump', 'KeyE');
  check('rebinding swaps keys so no action is left unbound', S.c.bindings.jump === 'KeyE' && S.c.bindings.interact === 'Space');
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
