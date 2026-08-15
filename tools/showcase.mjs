import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:960,height:540} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5173/',{waitUntil:'load',timeout:90000});
await p.waitForTimeout(14000);
await p.click('text=HOST GAME'); await p.waitForTimeout(400);
await p.fill('#screen-host input[type=text]','Jacob');
await p.click('text=OPEN THE LOBBY'); await p.waitForTimeout(1400);
// play survivor so we can drive the box puzzle; add a cenobite bot for pressure
await p.click('text=PLAY AS SURVIVOR'); await p.waitForTimeout(500);
await p.click('text=+ CENOBITE BOT'); await p.waitForTimeout(400);
for(let i=0;i<3;i++){ await p.click('text=+ SURVIVOR BOT'); await p.waitForTimeout(300); }
await p.click('text=BEGIN THE RITE'); await p.waitForTimeout(11000);
const shot=async(n,note)=>{ try{ await p.screenshot({path:`${SP}/s_${n}.png`,timeout:45000}); console.log('shot',n,'—',note);}catch(e){console.log('shot',n,'TIMEOUT');} };

const dbg=(cmd,args={})=>p.evaluate(([c,a])=>window.__game.net.debug(c,a),[cmd,args]);

// --- jump to the box phase (debug: host tools) ---
await dbg('complete_objective'); await p.waitForTimeout(2500);
await dbg('teleport',{to:'altar'}); await p.waitForTimeout(2500);
await p.evaluate(()=>{ const c=window.__game.controller; c.pitch=-0.1; });
await shot('altar_box','the assembled Lament Configuration on the altar');

// --- open the puzzle: walk into range and interact ---
await p.click('#scene',{position:{x:480,y:270}});
await p.evaluate(()=>{
  const g=window.__game, m=g.map.altar;
  g.controller.warp(m.x, g.controller.pos.y, m.z+3.2, m.floor);
  g.controller.yaw = Math.atan2(-(m.x-g.controller.pos.x), -(m.z-g.controller.pos.z));
});
await p.waitForTimeout(2000);
await p.keyboard.down('KeyE'); await p.waitForTimeout(2500); await p.keyboard.up('KeyE');
await p.waitForTimeout(2500);
await shot('box_puzzle','the interactive box puzzle open');
// turn a couple of rings
for (const seg of [0,2,1]) {
  await p.evaluate((s)=>window.__ui.h.boxRotate(s,1), seg);
  await p.waitForTimeout(900);
}
await shot('box_turning','rings turned — heat rising');

// --- solve it and look at the Gate ---
await dbg('solve_box'); await p.waitForTimeout(3000);
await p.evaluate(()=>window.__game.closeBox());
await p.waitForTimeout(1500);
await dbg('teleport',{to:'gate'}); await p.waitForTimeout(3000);
await p.evaluate(()=>{
  const g=window.__game, m=g.map.gate;
  g.controller.yaw = Math.atan2(-(m.x-g.controller.pos.x), -(m.z-g.controller.pos.z));
  g.controller.pitch = -0.06;
});
await p.waitForTimeout(2500);
await shot('gate','The Gate, unbound');
const st = await p.evaluate(()=>{ const h=window.__game.hudState(); return {phase:h.objective.title, prog:h.objective.progress, zone:h.zone}; });
console.log(JSON.stringify(st));
console.log(errs.length? 'ERRORS '+[...new Set(errs)].slice(0,5).join(' | ') : 'no page errors');
await b.close();
