import { chromium } from 'playwright';
const wait = Number(process.argv[2] || 15000);
const out = process.argv[3] || '/tmp/shot.png';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
p.on('pageerror', e => logs.push('[PAGEERROR] ' + e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(wait);
const diag = await p.evaluate(() => {
  const e = window.__engine, w = window.__world, g = window.__game;
  if (!e) return { error: 'no engine' };
  return {
    fps: +e.fps.toFixed(1), info: e.info,
    ambient: w ? { i: +w.ambient.intensity.toFixed(2), c: '#' + w.ambient.color.getHexString() } : null,
    hemi: w ? +w.hemi.intensity.toFixed(2) : null,
    fog: e.scene.fog ? { c: '#' + e.scene.fog.color.getHexString(), d: +e.scene.fog.density.toFixed(4) } : null,
    zone: w && w.currentZone ? w.currentZone.key : null,
    litLights: w ? w.lightPool.filter(s => s.light.intensity > 0.5).length : 0,
    maxLight: w ? Math.round(Math.max(...w.lightPool.map(s => s.light.intensity))) : 0,
    pos: g ? [Math.round(g.controller.pos.x), Math.round(g.controller.pos.y), Math.round(g.controller.pos.z), g.controller.floor] : null,
  };
});
console.log(JSON.stringify(diag, null, 1));
await p.screenshot({ path: out });
console.log(logs.slice(-12).join('\n'));
await b.close();
