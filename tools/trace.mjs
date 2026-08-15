import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:960,height:540} });
p.on('console',m=>console.log('  console:',m.type(),m.text().slice(0,160)));
p.on('pageerror',e=>console.log('  PAGEERROR:',e.message));
await p.goto('http://localhost:8081/hellraiser.html',{waitUntil:'load',timeout:90000});
for (const t of [4000,6000,6000,6000]) {
  await p.waitForTimeout(t);
  const st = await p.evaluate(()=>({
    boot: !!document.getElementById('boot'),
    bootClass: document.getElementById('boot')?.className || '-',
    bootTxt: (document.getElementById('boot')?.textContent||'').trim().slice(0,60),
    frame: window.__engine ? window.__engine.frame : 'no engine',
    game: !!window.__game, ui: !!window.__ui,
  }));
  console.log(JSON.stringify(st));
}
await b.close();
