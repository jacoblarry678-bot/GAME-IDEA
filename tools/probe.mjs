import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:640,height:360} });
await p.goto('http://localhost:5173/', { waitUntil:'load', timeout:90000 });
await p.waitForTimeout(12000);
await p.evaluate(() => {
  const w = window.__world;
  window.__amb = 3;
  const u = w.update.bind(w);
  w.update = (dt,c,f) => { u(dt,c,f); w.ambient.intensity = window.__amb; w.hemi.intensity = window.__amb*0.7; };
});
for (const amb of [2, 6, 12, 24, 45]) {
  await p.evaluate(a => { window.__amb = a; }, amb);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad/amb${amb}.png` });
  const got = await p.evaluate(() => +window.__world.ambient.intensity.toFixed(1));
  console.log(`set=${amb} live=${got}`);
}
await b.close();
