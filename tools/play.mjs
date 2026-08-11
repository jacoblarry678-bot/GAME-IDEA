import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:1280,height:720} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:5173/',{waitUntil:'load',timeout:90000});
await p.waitForTimeout(14000);
await p.click('text=HOST GAME'); await p.waitForTimeout(300);
await p.fill('#screen-host input[type=text]','Jacob');
await p.click('text=OPEN THE LOBBY'); await p.waitForTimeout(1200);
for(let i=0;i<4;i++){ await p.click('text=+ SURVIVOR BOT'); await p.waitForTimeout(250); }
await p.click('text=BEGIN THE RITE');
await p.waitForTimeout(20000);
const info = await p.evaluate(()=>{
  const e=window.__engine,g=window.__game;
  e.renderer.info.autoReset=false; e.renderer.info.reset();
  e.renderer.render(e.scene,e.camera);
  const scene={calls:e.renderer.info.render.calls,tris:e.renderer.info.render.triangles};
  e.renderer.info.autoReset=true;
  const h=g.hudState();
  return {scene, fps:Math.round(e.fps), role:h.role, zone:h.zone, obj:h.objective, abilities:h.abilities.map(a=>a.name+(a.ready?'✓':'✗')), mates:h.mates.map(m=>m.name+':'+m.state)};
});
console.log(JSON.stringify(info,null,1));
await p.screenshot({path:`${SP}/play_ceno.png`, timeout:60000});
// switch to first person + debug for a second shot
await p.evaluate(()=>{ window.__ui.toggleDebug(); });
await p.waitForTimeout(1500);
await p.screenshot({path:`${SP}/play_debug.png`, timeout:60000});
console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].slice(0,15).join('\n') : 'no page errors');
await b.close();
