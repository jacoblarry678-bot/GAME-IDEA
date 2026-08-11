import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:1280,height:720} });
await p.goto('http://localhost:5173/', { waitUntil:'load', timeout:90000 });
await p.waitForTimeout(15000);
const r = await p.evaluate(() => {
  const e = window.__engine;
  e.renderer.info.autoReset = false; e.renderer.info.reset();
  e.renderer.render(e.scene, e.camera);
  const menu = { calls: e.renderer.info.render.calls, tris: e.renderer.info.render.triangles };
  e.renderer.info.autoReset = true;
  return { menu, fps: Math.round(e.fps), ctxLimit: 'n/a' };
});
console.log('MENU', JSON.stringify(r));
await b.close();
