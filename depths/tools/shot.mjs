/**
 * Browser harness: serves the built game, drives it with Playwright and
 * saves screenshots. Usage: node tools/shot.mjs [script]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = process.env.SHOTS || new URL('../tools/shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

export async function serve(port = 4199) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    try { const b = await readFile(join(DIST, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => srv.listen(port, r));
  return srv;
}

export async function launch() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return { browser, page, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(OUT, { recursive: true });
  const srv = await serve();
  const { browser, page, errors } = await launch();
  await page.goto('http://localhost:4199/');
  await page.waitForFunction(() => window.__depths && window.__depths.state === 'menu', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}menu.png` });
  // start a campaign through the real UI
  await page.evaluate(() => window.__depths.menus.newCampaign());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}newcampaign.png` });
  await page.evaluate(() => window.__depths.startCampaign({ slot: 1, mode: 'solo', difficulty: 'standard', noDamage: false, timer: false, reducedStartle: false }));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}annex.png` });
  // teleport-free: drive the sim with the bot API in-page for a staged look at reception
  await page.evaluate(() => { const a = window.__depths; const g = a.game; g.story.set('ch1.gate'); g.story.set('ch1.entered'); const p = g.players.get('p1'); p.x = 0; p.z = 18; p.yaw = Math.PI; p.hasFlashlight = true; p.flashOn = true; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}reception.png` });
  await page.evaluate(() => { const g = window.__depths.game; const p = g.players.get('p1'); p.x = 0; p.z = 30; p.yaw = Math.PI + 0.3; p.pitch = -0.05; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}cubicles.png` });
  console.log(errors.slice(0, 30).join('\n'));
  await browser.close();
  srv.close();
}
