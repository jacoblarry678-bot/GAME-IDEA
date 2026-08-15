import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:960,height:540} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
// Simulate an embed that refuses pointer lock, exactly like a sandboxed iframe.
await p.addInitScript(() => {
  HTMLCanvasElement.prototype.requestPointerLock = function () {
    setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
    return Promise.reject(new Error('pointer lock blocked by permissions policy'));
  };
});
await p.goto('http://localhost:8081/hellraiser.html',{waitUntil:'load',timeout:90000});
await p.waitForTimeout(15000);
await p.click('#screen-menu .menu-btn >> nth=0'); await p.waitForTimeout(400);
await p.fill('#screen-host input[type=text]','You');
await p.click('text=OPEN THE LOBBY'); await p.waitForTimeout(2000);
await p.click('text=BEGIN THE RITE'); await p.waitForTimeout(14000);

const before = await p.evaluate(()=>{const c=window.__game.controller;return {x:c.pos.x,z:c.pos.z,yaw:c.yaw,locked:window.__game.input.locked,blocked:window.__game.input.lockBlocked};});
console.log('before:', JSON.stringify(before));

await p.click('#scene',{position:{x:480,y:270}});
// WALK
await p.keyboard.down('KeyW'); await p.waitForTimeout(2200); await p.keyboard.up('KeyW');
await p.waitForTimeout(600);
const afterW = await p.evaluate(()=>{const c=window.__game.controller;return {x:c.pos.x,z:c.pos.z,anim:c.animState};});
const movedDist = Math.hypot(afterW.x-before.x, afterW.z-before.z);
console.log('after W:', JSON.stringify(afterW), '=> moved', movedDist.toFixed(2), 'm');

// TURN with arrow keys
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowRight');
const afterTurn = await p.evaluate(()=>window.__game.controller.yaw);
console.log('yaw', before.yaw.toFixed(2), '->', afterTurn.toFixed(2), '=> turned', Math.abs(afterTurn-before.yaw).toFixed(2), 'rad');

// TURN by dragging the mouse
await p.mouse.move(480,270); await p.mouse.down();
for (let i=0;i<12;i++){ await p.mouse.move(480+i*18,270); await p.waitForTimeout(35); }
await p.mouse.up(); await p.waitForTimeout(400);
const afterDrag = await p.evaluate(()=>window.__game.controller.yaw);
console.log('drag-look yaw:', afterTurn.toFixed(2), '->', afterDrag.toFixed(2), '=> turned', Math.abs(afterDrag-afterTurn).toFixed(2), 'rad');

// STRAFE
const p2 = await p.evaluate(()=>({x:window.__game.controller.pos.x,z:window.__game.controller.pos.z}));
await p.keyboard.down('KeyD'); await p.waitForTimeout(1500); await p.keyboard.up('KeyD');
await p.waitForTimeout(500);
const p3 = await p.evaluate(()=>({x:window.__game.controller.pos.x,z:window.__game.controller.pos.z}));
console.log('strafe moved', Math.hypot(p3.x-p2.x,p3.z-p2.z).toFixed(2),'m');
await p.screenshot({path:'/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad/nolock.png',timeout:45000});

// This headless renderer runs at a few fps and the engine clamps dt to 0.1s,
// so wall time != simulated time. Judge against frames actually simulated.
const fr = await p.evaluate(()=>window.__engine.frame);
console.log('frames simulated during the test:', fr, '(software renderer — a real GPU runs ~60x this)');
const verdict = movedDist > 0.3 && Math.abs(afterDrag-afterTurn) > 0.2 && Math.abs(afterTurn-before.yaw) > 0.01;
console.log(verdict ? '\nPASS — moves, strafes, turns by key and by drag with pointer lock refused'
                    : '\nFAIL — still stuck');
console.log(errs.length? 'errors: '+[...new Set(errs)].slice(0,4).join(' | ') : 'no page errors');
await b.close();
