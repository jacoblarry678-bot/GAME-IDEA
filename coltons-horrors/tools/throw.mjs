// Woodsman axe throw: hits a survivor at range, lands, can be picked up, and a spare returns after 15 s.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = spawn('npx', ['vite', 'preview', '--port', '4200', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + ' ' + e.stack));
await page.goto('http://localhost:4200/?autoplay&role=killer&killer=woodsman&map=craneridge&q=medium');
await page.waitForFunction(() => window.__match, null, { timeout: 60000 });
const out = await page.evaluate(() => {
  const m = window.__match, k = m.killer, p = k.power;
  k.ai = null;
  m.survivors.forEach((s) => { s.ai = null; Object.assign(s.intent, { mx: 0, mz: 0, run: false, interact: false, act: false, item: false }); s.action = null; });
  // find an open straight line of 12 m
  let spot = null;
  for (let i = 0; i < 400 && !spot; i++) {
    const x = (Math.random() - 0.5) * 70, z = (Math.random() - 0.5) * 70;
    if (m.world.nav.areaFree(x, z, 1) && m.world.nav.areaFree(x + 12, z, 1) && m.world.nav.walkableLine(x, z, x + 12, z)) spot = [x, z];
  }
  k.pos.set(spot[0], 0, spot[1]);
  const s = m.survivors[0];
  s.pos.set(spot[0] + 12, 0, spot[1]);
  s.state = 'healthy';
  k.yaw = Math.PI / 2;
  const it = k.intent;
  const step = (n) => { for (let i = 0; i < n; i++) { it.look = null; it.mx = 0; it.mz = 0; m.update(1 / 60, null); } };
  step(2); // let collisions settle, then aim at where the survivor actually is
  k.yaw = Math.atan2(s.pos.x - k.pos.x, s.pos.z - k.pos.z);
  it.power = true; step(40);
  const charged = p.charge.toFixed(2);
  k.intent.aimPitch = 0.04;
  it.throwAxe = true; step(1);
  const thrownNow = !p.axe && !!p.thrown;
  step(60);
  const hit = s.state;
  const landed = p.thrown && !p.thrown.flying ? p.thrown.landed : 'still flying';
  // walk to the axe and pick it up
  const th = p.thrown;
  k.pos.set(th.pos.x + 1.0, 0, th.pos.z);
  it.power = false; step(5);
  const pickedUp = p.axe;
  // throw again into a wall-less void and wait for the spare
  it.power = true; step(40); it.throwAxe = true; step(1); it.power = false;
  k.pos.set(k.pos.x - 30, 0, k.pos.z); // walk away so it cannot be picked up
  step(60 * 16);
  return { charged, thrownNow, hit, landed, pickedUp, spareBack: p.axe };
});
console.log(JSON.stringify(out), errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok');
await browser.close(); server.kill();
process.exit(errors.length || !out.thrownNow || out.hit !== 'injured' || !out.pickedUp || !out.spareBack ? 1 : 0);
