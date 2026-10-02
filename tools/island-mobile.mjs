// Mobile / touch test: an emulated phone (landscape, touch, coarse pointer)
// driven with real multi-touch events via the DevTools protocol.
// Usage: node tools/island-mobile.mjs [url] [shotDir]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const shots = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(p);
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const ev = (fn, arg) => p.evaluate(fn, arg);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
const center = (sel) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const tapAt = async ([x, y], id = 9) => { await touch('touchStart', [[x, y, id]]); await p.waitForTimeout(80); await touch('touchEnd', []); await p.waitForTimeout(120); };
const waitFor = async (fn, ms = 20000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await p.waitForTimeout(200); } return false; };

await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(1500);
const mode = await ev(() => ({ touch: document.body.classList.contains('touch'), coarse: matchMedia('(pointer: coarse)').matches, shadows: __bi.save.data.settings.shadows }));
check('phone detected: touch controls on, lighter graphics defaults', mode.touch && mode.coarse && mode.shadows === false, JSON.stringify(mode));
await p.screenshot({ path: `${shots}/mob-01-lobby.png` });
await p.tap('[data-act=play]');
await p.waitForTimeout(800);
const shown = await ev(() => getComputedStyle(document.getElementById('touch')).display !== 'none' && !!document.querySelector('.t-fire'));
check('match shows the on-screen controls', shown);

await waitFor(() => __bi.game.busT > 1.8);
await tapAt(await center('.t-jump'));
check('JUMP button leaves the bus', await waitFor(() => __bi.game.player.state !== 'bus', 4000));
await ev(() => (__bi.engine.timeScale = 4));
await waitFor(() => ['ground', 'swim'].includes(__bi.game.player.state), 60000);
await ev(() => {
  __bi.engine.timeScale = 1;
  const g = __bi.game;
  for (const a of g.actors) if (a.brain) { a.brain.update = function () { const i = this.inp; i.mx = i.mz = 0; i.jump = i.glide = false; return i; }; a.pos.set(-150 + a.id, 0, 150); a.state = 'swim'; }
  let fx = 0, fz = 0;
  search: for (let x = -110; x <= 110; x += 2) for (let z = -110; z <= 110; z += 2) {
    const h = g.world.height(x, z);
    if (h < 2 || g.world.physics.query(x - 12, z - 12, x + 12, z + 12).length) continue;
    let ok = true;
    for (const [dx, dz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) if (Math.abs(g.world.height(x + dx, z + dz) - h) > 1) ok = false;
    if (ok) { fx = x; fz = z; break search; }
  }
  const P = g.player;
  P.pos.set(fx, g.world.height(fx, fz), fz); P.vel.set(0, 0, 0); P.state = 'ground';
  g.controller.yaw = 0; g.controller.pitch = -0.1;
  g.debugLoadout();
  g.player.select(0);
});
await p.waitForTimeout(500);

// joystick: thumb down on the left, push up (forward) and hold
const start = await ev(() => __bi.game.player.pos.toArray());
await touch('touchStart', [[140, 260, 1]]);
await touch('touchMove', [[140, 200, 1]]);
await p.waitForTimeout(1500);
const mid = await ev(() => ({ analog: __bi.input.analog, stick: getComputedStyle(document.querySelector('.t-stick')).display }));
await touch('touchEnd', []);
await p.waitForTimeout(300);
const end = await ev(() => __bi.game.player.pos.toArray());
const moved = Math.hypot(end[0] - start[0], end[2] - start[2]);
const forward = start[2] - end[2]; // yaw 0 faces -z
check('left-thumb joystick walks the character forward', moved > 1.5 && forward > 1 && mid.stick === 'block', JSON.stringify({ moved: +moved.toFixed(2), forward: +forward.toFixed(2), mid }));
check('releasing the stick stops input', await ev(() => __bi.input.analog === null));

// jump on the ground while the other thumb holds the stick (multi-touch)
const jb = await center('.t-jump');
const y0 = await ev(() => __bi.game.player.pos.y);
await touch('touchStart', [[140, 260, 1]]);
await touch('touchMove', [[140, 230, 1]]);
await p.waitForTimeout(200);
await touch('touchStart', [[140, 230, 1], [jb[0], jb[1], 4]]);
let peak = y0;
for (let i = 0; i < 12; i++) { peak = Math.max(peak, await ev(() => __bi.game.player.pos.y)); await p.waitForTimeout(60); }
await touch('touchEnd', []);
await p.waitForTimeout(600);
check('JUMP button jumps on the ground, even while steering with the stick', peak - y0 > 0.6, `rose ${(peak - y0).toFixed(2)}m`);
// a quick tap (finger up before the next frame) still jumps
await ev(() => { const P = __bi.game.player; P.vel.set(0, 0, 0); });
await p.waitForTimeout(300);
const y1 = await ev(() => __bi.game.player.pos.y);
await touch('touchStart', [[jb[0], jb[1], 5]]);
await touch('touchEnd', []);
let peak2 = y1;
for (let i = 0; i < 12; i++) { peak2 = Math.max(peak2, await ev(() => __bi.game.player.pos.y)); await p.waitForTimeout(60); }
check('a very quick JUMP tap still jumps', peak2 - y1 > 0.6, `rose ${(peak2 - y1).toFixed(2)}m`);

// look: drag on the right half
const yaw0 = await ev(() => __bi.game.controller.yaw);
await touch('touchStart', [[560, 150, 2]]);
for (let x = 570; x <= 660; x += 15) { await touch('touchMove', [[x, 150, 2]]); await p.waitForTimeout(40); }
await touch('touchEnd', []);
await p.waitForTimeout(200);
const yaw1 = await ev(() => __bi.game.controller.yaw);
check('right-thumb drag turns the camera', yaw1 < yaw0 - 0.1, `${yaw0.toFixed(2)} → ${yaw1.toFixed(2)}`);

// fire: hold FIRE while also moving the stick (multi-touch)
const mag0 = await ev(() => __bi.game.player.slots[0].mag);
const fire = await center('.t-fire');
await touch('touchStart', [[140, 260, 1], [fire[0], fire[1], 3]]);
await touch('touchMove', [[180, 260, 1], [fire[0] + 10, fire[1], 3]]);
await p.waitForTimeout(1800);
const both = await ev(() => ({ firing: __bi.input.mouse.buttons.has(0), analog: !!__bi.input.analog }));
await touch('touchEnd', []);
await p.waitForTimeout(300);
const mag1 = await ev(() => __bi.game.player.slots[0].mag);
check('FIRE shoots (held) while the other thumb steers — multi-touch', mag1 < mag0 && both.firing && both.analog, JSON.stringify({ mag0, mag1, both }));
check('lifting fingers releases fire', await ev(() => !__bi.input.mouse.buttons.has(0)));

// inventory slot tap
await tapAt(await center('.slots .slot:nth-child(3)'));
check('tapping an inventory slot selects it', await waitFor(() => __bi.game.player.sel === 1, 3000), await ev(() => __bi.game.player.sel));

// build: BUILD then PLACE
await ev(() => { __bi.game.player.mats.wood = 50; __bi.game.controller.pitch = -0.1; });
await tapAt(await center('.t-build'));
const label = await ev(() => document.querySelector('.t-fire').textContent);
await tapAt(await center('.t-fire'));
let built = await waitFor(() => [...__bi.game.building.pieces].some((q) => q.owner === __bi.game.player), 3000);
if (!built) {
  // slow headless frames can miss one very short tap: tap once more
  await tapAt(await center('.t-fire'));
  built = await waitFor(() => [...__bi.game.building.pieces].some((q) => q.owner === __bi.game.player), 3000);
}
await p.screenshot({ path: `${shots}/mob-02-build.png` });
check('BUILD toggles build mode (fire becomes PLACE) and places a piece', label === 'PLACE' && built, label);
await tapAt(await center('.t-build'));

// minimap tap opens the full map; pause button pauses
await tapAt(await center('.minimap'));
check('tapping the minimap opens the full map', await ev(() => __bi.hud.mapOpen));
await p.tap('.bigmap', { position: { x: 5, y: 5 } });
await p.waitForTimeout(200);
await tapAt(await center('.t-pause'));
const paused = await waitFor(() => !!document.querySelector('[data-act=resume]'), 3000);
await p.tap('[data-act=resume]');
await p.waitForTimeout(300);
check('pause button opens the pause menu; Resume returns', paused && (await ev(() => !__bi.game.paused && !document.querySelector('[data-act=resume]'))));
await p.screenshot({ path: `${shots}/mob-03-hud.png` });

// layout: buttons clear of the bottom/right gesture edges and not overlapping anything
const layout = async () => ev(() => {
  const W = innerWidth, H = innerHeight;
  const rects = [...document.querySelectorAll('.t-btn')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => ({ id: b.dataset.id, r: b.getBoundingClientRect() }));
  const slots = document.querySelector('.slots').getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const bad = [];
  for (const { id, r } of rects) {
    if (H - r.bottom < 24 || W - r.right < 10 || r.top < 0) bad.push(`${id} too close to the edge`);
    if (hit(r, slots)) bad.push(`${id} covers the inventory`);
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i].r, rects[j].r)) bad.push(`${rects[i].id} overlaps ${rects[j].id}`);
  if (H - slots.bottom < 16) bad.push('inventory too close to the bottom edge');
  return bad;
});
await ev(() => { __bi.game.controller.building = true; });
await p.waitForTimeout(300);
const bad1 = await layout();
await p.setViewportSize({ width: 740, height: 360 });
await p.waitForTimeout(400);
const bad2 = await layout();
await ev(() => { __bi.game.controller.building = false; });
await p.screenshot({ path: `${shots}/mob-05-small.png` });
await p.setViewportSize({ width: 844, height: 390 });
check('buttons stay clear of screen edges and never overlap (844x390 and 740x360)', !bad1.length && !bad2.length, JSON.stringify({ bad1, bad2 }));

// driving on touch: USE gets in, the stick drives, USE gets out
await ev(() => {
  const g = __bi.game, P = g.player, v = g.vehicles.list[4];
  const x = P.pos.x + 3, z = P.pos.z + 4;
  for (const c of [...g.world.physics.query(x - 6, z - 24, x + 6, z + 6)]) if (c.kind === 'tree' || c.kind === 'rock') g.world.destroyCollider(c);
  v.pos.set(x, g.world.height(x, z), z); v.yaw = 0; v.speed = 0; g.vehicles._sync(v, true);
  P.pos.set(x - 2.3, g.world.height(x - 2.3, z) + 0.05, z); P.vel.set(0, 0, 0); P.state = 'ground';
  g.controller.yaw = 0;
});
await p.waitForTimeout(400);
const useLabel = await ev(() => document.querySelector('.t-use').textContent);
await tapAt(await center('.t-use'));
const inKart = await waitFor(() => __bi.game.player.vehicle === __bi.game.vehicles.list[4], 3000);
await p.waitForTimeout(300);
const kz0 = await ev(() => __bi.game.vehicles.list[4].pos.z);
await touch('touchStart', [[140, 260, 1]]);
await touch('touchMove', [[140, 200, 1]]);
await p.waitForTimeout(1800);
const drivingUi = await ev(() => ({ fire: getComputedStyle(document.querySelector('.t-fire')).display, jump: document.querySelector('.t-jump').textContent, use: document.querySelector('.t-use').textContent }));
const bad3 = await layout();
await touch('touchEnd', []);
await p.screenshot({ path: `${shots}/mob-06-driving.png` });
const kdz = await ev((z) => z - __bi.game.vehicles.list[4].pos.z, kz0);
await ev(() => (__bi.game.vehicles.list[4].speed = 0));
await tapAt(await center('.t-use'));
const outKart = await waitFor(() => !__bi.game.player.vehicle, 3000);
check('touch driving: USE (ENTER) gets in, the stick drives, FIRE hides, JUMP honks, USE (EXIT) gets out; buttons stay tidy', useLabel === 'ENTER' && inKart && kdz > 2 && drivingUi.fire === 'none' && drivingUi.jump === 'HORN' && drivingUi.use === 'EXIT' && outKart && !bad3.length, JSON.stringify({ useLabel, kdz: +kdz.toFixed(2), drivingUi, bad3 }));

// portrait asks to rotate
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(400);
check('portrait orientation shows a "turn your device" message', await ev(() => getComputedStyle(document.querySelector('.t-rotate')).display === 'flex'));
await p.setViewportSize({ width: 844, height: 390 });

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} mobile checks passed`);
await b.close();
process.exit(results.every(Boolean) ? 0 : 1);
