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
const { Weather, WEATHER_CONFIG } = await import('../src/core/weather.js');
const { Social } = await import('../src/game/social.js');
const { sanitizeAccounts } = await import('../src/game/creator.js');
const { Memory, sanitizeMemory, defaultMemory } = await import('../src/game/memory.js');

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
  // Velvet Palms: the doorway is open (the rope is added at runtime), the front wall is solid, the
  // stage and runway are raised, every counter is reachable on the floor, and people sit inside the room
  {
    const C = PLACES.club, Lc = C.layout, I = Lc.inner;
    const inClub = INTERIORS.find((i) => i.id === 'club');
    check('Velvet Palms is an interior with a ceiling', !!inClub && inClub.ceiling > 4.5 && inClub.ceiling < 6);
    const thru = cw.raycast(Lc.door.x - 3, 1.2, Lc.door.z, 1, 0, 0, 7);
    const front = cw.raycast(Lc.door.x - 3, 1.2, Lc.door.z + 4, 1, 0, 0, 7);
    check('Velvet Palms doorway is walkable and the front wall is solid', (!thru || thru.t > 6.5) && !!front && front.t < 3.5, `${thru?.t} ${front?.t}`);
    check('the stage and runway are raised 0.7 m; the dance floor is not', Math.abs(L.groundHeight((Lc.stage.x0 + Lc.stage.x1) / 2, Lc.door.z + 4) - Lc.stage.y) < 1e-6 && Math.abs(L.groundHeight((Lc.runway.x0 + Lc.runway.x1) / 2, Lc.door.z) - Lc.runway.y) < 1e-6 && L.groundHeight(I.x0 + 3, Lc.door.z) < 0.2);
    const counters = ['club', 'clubbar', 'clubdj', 'clubvip', 'clubstage'].map((id) => [id, PLACES[id].door]);
    const blocked = counters.filter(([, d]) => cw.overlapsCircle(d.x, d.z, 0.35, L.groundHeight(d.x, d.z) + 0.2, 1.6)).map(([id]) => id);
    check('every club counter has a free spot to stand at', blocked.length === 0, blocked.join());
    const seats = [...Lc.stools, ...Lc.booths.map((b) => ({ x: (b.x0 + b.x1) / 2, z: b.z1 - 0.8 }))];
    check('stools and booth seats are inside the room', seats.every((q) => q.x > I.x0 && q.x < I.x1 && q.z > I.z0 && q.z < I.z1), String(seats.length));
    const path = cw.raycast(Lc.door.x + 1, 1.2, Lc.door.z, 1, 0, 0, Lc.runway.x0 - Lc.door.x - 1.6);
    check('a clear walk from the door to the stage rail', !path, path ? `${path.t.toFixed(2)} ${path.collider?.tag}` : '');
  }
  // parked cars don't spawn inside anything
  let bad = 0;
  for (const p of DISTRICT.parking) {
    const def = (await import('../src/data/vehicles.js')).VEHICLES[p.model];
    const c = cw.boxContacts(p.x, p.z, def.width / 2, def.length / 2, p.rot, 0.3, 1.2).filter((c) => c.collider.tag !== 'railing');
    if (c.length) { bad++; console.log('   overlapping:', p.model, p.x.toFixed(1), p.z.toFixed(1), c.map((k) => k.collider.tag || k.collider.type).join()); }
  }
  check('parked cars spawn clear of walls and props', bad === 0, `${bad}/${DISTRICT.parking.length} overlapping`);
  const poles = cw.all.filter((c) => c.type === 'circle' && c.tag === 'prop' && L.roadAt(c.cx, c.cz) && !(c.cx < L.ISLAND.west - 1));
  check('no street furniture stands on the road', poles.length === 0, poles.slice(0, 3).map((c) => `${c.cx.toFixed(1)},${c.cz.toFixed(1)}`).join(' '));
  check('causeway deck is continuous over the water', [-45, -50, -100, -200, -280, -298].every((x) => L.groundHeight(x, 0, 10) > -0.01) && L.groundHeight(-150, 0, 10) > 6);
  check('a boat can pass under the causeway', L.groundHeight(-150, 0, -1) < -4);
  // Milestone 3: the twin-span and Cayo Lento
  const T = L.TWIN, laneX = (s) => T.x + s * (T.median / 2 + L.LANE_W / 2);
  const deckOk = [-1, 1].every((s) => [250, 258, 300, 434, 560, 605, 615].every((z) => L.groundHeight(laneX(s), z, 12) > -0.01 && !L.isWater(laneX(s), z)));
  check('both twin-span decks are continuous from Ocean Mile to the key', deckOk && L.groundHeight(laneX(1), 434, 12) > 7);
  check('the gap between the decks is open water (railings keep cars out)', L.isWater(T.x, 434) && cw.all.some((c) => c.tag === 'railing' && Math.abs(c.cx - (T.x + T.median / 2)) < 0.5 && Math.abs(c.cz - 434) < 4));
  check('a boat can pass under the twin-span', L.groundHeight(laneX(-1), 434, -1) < -4);
  check('Cayo Lento is dry land with roads at grade', !L.isWater(150, 660) && L.groundHeight(200, 640) === 0 && L.groundHeight(200, 625) > 0.1 && L.isClimbable(100, 615));
  check('the flats around the key are deep enough to swim, not wade', [[150, 590], [100, 730], [350, 650]].every(([x, z]) => L.isWater(x, z) && L.WATER_Y - L.terrainHeight(x, z) > 1.25));
  const kn = L.ROAD_GRAPH.nodes.find((n) => n.x === L.KEYS.marinaX && n.z === L.KEYS.shoreZ);
  const route = L.findRoute(L.nearestNode(PLACES.safehouse.x, PLACES.safehouse.z).id, kn.id);
  check('the marina is reachable by road from the motel (over the twin-span)', !!route && route.some((id) => L.ROAD_GRAPH.nodes[id].z === L.KEYS.hwyZ), route ? `${route.length} nodes` : 'no route');
  const twinEdge = L.ROAD_GRAPH.edges.find((e) => e.road === 'twinspan');
  const ll = laneLine(twinEdge, twinEdge.a, 0), lr = laneLine(twinEdge, twinEdge.b, 0);
  check('twin-span lanes run on the decks, one direction per deck', Math.abs(Math.abs(ll.x0 - T.x) - (T.median / 2 + L.LANE_W / 2)) < 0.01 && Math.sign(ll.x0 - T.x) === -Math.sign(lr.x0 - T.x));
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
function runCar(model, seconds, input, setup, weather = null) {
  const g = fakeGame();
  g.weather = weather;
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
  // AI stops must not select reverse (holding the brake at a standstill reverses, by design)
  const held = runCar('kestrel', 6, (t, v) => { v.holdStill(); return {}; }, (v) => { v.vel.set(0, 8); });
  check('an AI "hold still" stops the car and keeps it stopped (no rolling back)', held.v.speed < 0.2 && held.hist[held.hist.length - 1].z >= held.hist.reduce((m, h) => Math.max(m, h.z), 0) - 0.3, `stopped at z=${held.v.pos.z.toFixed(1)}`);
  // Milestone 3: rain. Wet roads cut tyre grip, so braking takes longer
  const wetW = new Weather({ gp: { weather: 'rain' } }, () => 0.5);
  wetW.set('rain', true);
  const wet = runCar('kestrel', 12, (t, v) => (t < 0.05 ? {} : { throttle: 0, brake: 1 }), (v) => { v.vel.set(0, 26.8); }, wetW);
  const wetStop = wet.hist.find((h) => h.speed < 0.3);
  check('braking takes longer on wet roads', wetStop && wetStop.z > stopAt.z * 1.1, `${wetStop?.z.toFixed(1)} m wet vs ${stopAt?.z.toFixed(1)} m dry (grip ×${wetW.grip.toFixed(2)})`);
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
  const cal = s.crew.cal;
  check('save validation clamps and filters', s.money === 0 && s.hour === 23.99 && cal.weapons.join() === 'fists,pistol' && cal.current === 'fists' && cal.ammo.pistol.mag === 12 && cal.ammo.pistol.reserve === 0);
  check('a v1 save migrates: its player becomes Cal, Sol starts fresh', s.active === 'cal' && JSON.stringify(s.crew.sol) === JSON.stringify(defaultSave().crew.sol) && !('player' in s));
  const s2 = sanitizeSave({ version: 2, savedAt: 'x', active: 'sol', crew: { cal: { health: 40, x: 12, z: 'no', mode: 'dance' }, sol: { health: 500, weapons: ['pistol'], current: 'pistol', ammo: { pistol: { mag: 3, reserve: 10 } }, x: 5, z: 6, yaw: 1, mode: 'follow' } } });
  check('v2 keeps each protagonist separately and validates them', s2.active === 'sol' && s2.crew.cal.health === 40 && s2.crew.cal.x === null && s2.crew.cal.mode === 'wait' && s2.crew.sol.health === 100 && s2.crew.sol.current === 'pistol' && s2.crew.sol.ammo.pistol.mag === 3 && s2.crew.sol.x === 5 && s2.crew.sol.mode === 'follow');
  check('an unknown active protagonist falls back to Cal', sanitizeSave({ version: 2, active: 'teo' }).active === 'cal');
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

// ---- weather (Milestone 3) ------------------------------------------------------
{
  const settings = { gp: { weather: 'dynamic' } };
  const w = new Weather(settings, () => 0.5);
  const seen = [];
  for (let t = 0; t < 1400; t += 0.5) { w.step(0.5); if (seen[seen.length - 1] !== w.state) seen.push(w.state); }
  check('dynamic weather cycles clear → cloudy → rain → clearing → clear', seen.join() .startsWith('clear,cloudy,rain,clearing,clear'), seen.join(' → '));
  const w2 = new Weather(settings, () => 0.5);
  w2.set('rain'); for (let t = 0; t < 60; t += 0.5) w2.step(0.5);
  const soaked = w2.wet;
  w2.set('clear'); for (let t = 0; t < 30; t += 0.5) w2.step(0.5);
  check('roads get wet in rain and dry slowly afterwards', soaked > 0.9 && w2.rain < 0.05 && w2.wet > 0.4, `wet ${soaked.toFixed(2)} → ${w2.wet.toFixed(2)} 30 s after the rain stopped`);
  settings.gp.weather = 'clear';
  w2.set('rain', true); w2.step(0.5);
  check('the weather setting pins the sky (always clear / always rain)', w2.state === 'clear');
  check('wet grip loss is configurable and bounded', WEATHER_CONFIG.gripLoss > 0 && WEATHER_CONFIG.gripLoss < 0.4);
}

// ---- LOOP social feed (Milestone 3) ---------------------------------------------
{
  const notes = [];
  const g = { time: 0, events: new Events(), hud: { notify: (t, from) => notes.push(from + ': ' + t) }, player: { pos: { x: 0, z: 0 } }, weather: { rain: 0 } };
  const so = new Social(g);
  check('LOOP starts with a few posts and nothing unread', so.posts.length >= 4 && so.unread === 0);
  g.events.emit('witnessCall', { crimeId: 'carjack', x: 90, z: -100 });
  const clip = so.posts[0];
  check('a witness films the crime: a clip naming the street, flagged in the notifications', clip.clip && clip.about && /coral ave/i.test(clip.text) && notes.length === 1 && so.unread === 1, clip.text);
  for (let i = 0; i < 600; i++) { g.time += 0.1; so.step(0.1); }
  check('clips gather likes faster than ordinary posts', clip.likes > 100, `${Math.round(clip.likes)} likes after 60 s`);
  g.events.emit('missionPassed', { def: { id: 'small_change', title: 'Small Change' } });
  check('the news account reports a finished job', so.posts[0].verified && /Sunny Stop/.test(so.posts[0].text));
  for (let i = 0; i < 60; i++) so.post({ local: true, text: 'x' }, false);
  so.toggle();
  check('the feed is capped and opening it clears the unread count', so.posts.length === 40 && so.unread === 0);
}

// ---- your LOOP accounts (after M3) -------------------------------------------------
{
  const notes = [];
  const g = { time: 0, events: new Events(), hud: { notify: (t, from) => notes.push(from + ': ' + t) }, player: { pos: { x: 0, z: 0 }, protagonist: 'sol' }, memory: { state: { people: {} } }, weather: { rain: 0 } };
  const so = new Social(g);
  const me = so.me;
  check('Cal and Sol start with their own LOOP accounts', me.accounts.cal.followers === 37 && me.accounts.sol.followers === 212 && me.profile.handle === 'sol.vega');
  me.follow('sol', 40);
  check('crossing 250 followers unlocks brand DMs (a milestone, announced once)', me.me.milestones.includes(250) && notes.filter((n) => /250 followers/.test(n)).length === 1);
  me.me.followers = 9999; me.follow('sol', 5);
  check('10,000 followers: on the Velvet Palms VIP list', g.memory.state.people.club.sol.vip === true && g.memory.state.people.clubvip.sol.vip === true);
  const clean = sanitizeAccounts({ cal: { followers: 'lots', posts: 3, milestones: [100, 7, 100], verified: 'yes' }, sol: { followers: 1e12 } });
  check('saved accounts are cleaned (bad numbers, unknown milestones)', clean.cal.followers === 37 && clean.cal.posts === 3 && clean.cal.milestones.join() === '100' && clean.cal.verified === false && clean.sol.followers === 1e7);
}

// ---- city memory (Milestone 3) -----------------------------------------------------
{
  const ev = new Events();
  const car = { persistentId: 'start-muscle', id: 7, def: { name: 'Ironhorse 455' }, color: 0xb5332e, plate: 'ABC 123', pos: { x: 90, z: -100 } };
  const player = { protagonist: 'cal', protagonistName: 'Cal', look: { female: false, top: 0xe9e2d0 }, vehicle: car, pos: { x: 90, y: 0, z: -100 } };
  const g = { time: 0, events: ev, player, wanted: { level: 0 }, cops: [], peds: [], missions: { cutscene: null, active: null } };
  const m = new Memory(g);
  ev.emit('crimeReported', { crimeId: 'carjack', x: 90, z: -100, by: 'police', level: 1 });
  check('police who saw a crime keep a description: clothes and car', /man in a cream top, driving a red Ironhorse 455/.test(m.describe()) && m.matchScore() === 1, m.describe());
  player.vehicle = null; player.look = { ...player.look, top: 0x1c1c1c };
  check('changing clothes (out of the car) breaks the match', m.matchScore() === 0);
  player.look = { ...player.look, top: 0xe9e2d0 };
  check('...the old clothes still match', m.matchScore() === 1);
  ev.emit('crimeReported', { crimeId: 'carjack', x: 90, z: -120, by: 'witness', level: 1 });
  ev.emit('crimeReported', { crimeId: 'shooting', x: 90, z: -90, by: 'witness', level: 2 });
  check('a nickname forms from what you do most and where', m.state.nickname === 'the Coral Ave Carjacker', m.state.nickname);
  const fame = m.notoriety(90, -100);
  for (let i = 0; i < 620; i++) { g.time += 1; m.step(1); }
  check('notoriety rises with crimes and fades over time; old descriptions expire', fame > 15 && m.notoriety(90, -100) < fame && m.state.description === null, `${fame.toFixed(0)} → ${m.notoriety(90, -100).toFixed(0)}`);
  m.visit('gunshop'); m.visit('gunshop');
  player.protagonist = 'sol';
  check('people remember Cal and Sol separately', m.person('gunshop').visits === 0 && m.state.people.gunshop.cal.visits === 2);
  const saved = sanitizeMemory(JSON.parse(JSON.stringify(m.snapshot())));
  check('memory survives a save (and bad data is cleaned)', saved.nickname === m.state.nickname && saved.people.gunshop.cal.visits === 2 && JSON.stringify(sanitizeMemory({ notoriety: { 'Ocean Mile': 'lots' }, people: { '<script>': {} } })) === JSON.stringify(defaultMemory()));
  const club = sanitizeMemory({ people: { clubbar: { cal: { visits: 3, usual: 'Velvet mojito', drinks: 7, vip: true, requests: { house: 2, evil: 9 }, troubleAt: 50 } }, clubdj: { sol: { usual: '<img onerror=x>' } } } });
  check('the club remembers your usual, VIP status and requests across saves', club.people.clubbar.cal.usual === 'Velvet mojito' && club.people.clubbar.cal.vip === true && club.people.clubbar.cal.requests.house === 2 && club.people.clubbar.cal.requests.evil === undefined && club.people.clubbar.cal.troubleAt === undefined && club.people.clubdj.sol.usual === undefined);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
