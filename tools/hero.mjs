import { chromium } from 'playwright';
const shots = [
  { name:'chainhall', x:-6, z:-46, yaw:2.3, pitch:0.04 },
  { name:'archives',  x:-96, z:-90, yaw:-0.9, pitch:0.0 },
  { name:'torture',   x:96, z:-96, yaw:1.2, pitch:0.02 },
  { name:'gate',      x:-2, z:118, yaw:3.14, pitch:-0.12 },
];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:1280,height:720} });
await p.goto('http://localhost:5173/', { waitUntil:'load', timeout:90000 });
await p.waitForTimeout(13000);
for (const s of shots) {
  await p.evaluate(v => {
    const g = window.__game;
    g.controller.warp(v.x, 0, v.z, 0);
    g.controller.yaw = v.yaw; g.controller.pitch = v.pitch; g.controller.bodyYaw = v.yaw;
  }, s);
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad/hero_${s.name}.png` });
  const z = await p.evaluate(() => window.__world.currentZone.name + ' | fps ' + Math.round(window.__engine.fps));
  console.log(s.name, '->', z);
}
await b.close();
