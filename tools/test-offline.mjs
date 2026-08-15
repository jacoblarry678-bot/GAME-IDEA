import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:960,height:540} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
// block ALL network after load to prove it needs nothing external
await p.goto('http://localhost:8081/hellraiser.html',{waitUntil:'load',timeout:90000});
await p.route('**', r => r.request().url().startsWith('http://localhost:8081') ? r.continue() : r.abort());
await p.waitForTimeout(16000);
await p.screenshot({path:`${SP}/off_menu.png`,timeout:45000});
const menuBtns = await p.$$eval('#screen-menu .menu-btn', ns=>ns.map(n=>({t:n.textContent.trim(),hidden:n.style.display==='none'})));
console.log('menu:', JSON.stringify(menuBtns));
await p.click('#screen-menu .menu-btn >> nth=0'); await p.waitForTimeout(500);
await p.fill('#screen-host input[type=text]','You');
await p.click('text=OPEN THE LOBBY'); await p.waitForTimeout(2500);
const roster = await p.$$eval('.slot .who', ns=>ns.map(n=>n.textContent.trim()).filter(Boolean));
console.log('roster:', roster.join(' | '));
await p.screenshot({path:`${SP}/off_lobby.png`,timeout:45000});
await p.click('text=BEGIN THE RITE'); await p.waitForTimeout(20000);
const st = await p.evaluate(()=>{ const g=window.__game; if(!g||!g.running) return {running:false};
  const h=g.hudState(); return {running:true, role:h.role, zone:h.zone, obj:h.objective.title, prog:h.objective.progress,
  mates:h.mates.length, clock:h.clock, fps:Math.round(window.__engine.fps), snaps:g.net.snapshots.length}; });
console.log('in-match:', JSON.stringify(st));
await p.screenshot({path:`${SP}/off_game.png`,timeout:45000});
// let bots play a while, confirm the simulation progresses offline
await p.waitForTimeout(45000);
const st2 = await p.evaluate(()=>{ const h=window.__game.hudState(); return {prog:h.objective.progress, clock:h.clock, mates:h.mates.map(m=>m.state)}; });
console.log('after 45s:', JSON.stringify(st2));
await p.screenshot({path:`${SP}/off_game2.png`,timeout:45000});
console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].slice(0,8).join('\n') : 'no errors');
await b.close();
