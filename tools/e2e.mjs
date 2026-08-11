import { chromium } from 'playwright';
const SP = '/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const args = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required'];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args });
const errs = [];
const mk = async (tag) => {
  const c = await b.newContext({ viewport:{width:1280,height:720} });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(`[${tag}] PAGEERROR ${e.message}`));
  p.on('console', m => { if (m.type()==='error') errs.push(`[${tag}] ${m.text()}`); });
  await p.goto('http://localhost:5173/', { waitUntil:'load', timeout:90000 });
  return p;
};
const A = await mk('HOST');
const B = await mk('GUEST');
await A.waitForTimeout(14000); await B.waitForTimeout(2000);
await A.screenshot({ path: `${SP}/e2e_menu.png` });
console.log('menu rendered');

// --- HOST ---
await A.click('text=HOST GAME');
await A.waitForTimeout(400);
await A.fill('#screen-host input[type=text]', 'Jacob');
await A.screenshot({ path: `${SP}/e2e_host.png` });
await A.click('text=OPEN THE LOBBY');
await A.waitForTimeout(1500);
const code = (await A.textContent('.lobby-code')).trim();
console.log('lobby code =', code);
await A.screenshot({ path: `${SP}/e2e_lobby.png` });

// --- GUEST joins with the code only ---
await B.click('text=JOIN GAME');
await B.waitForTimeout(400);
await B.fill('#screen-join input[type=text]', 'Friend');
await B.fill('.code-input', code);
await B.screenshot({ path: `${SP}/e2e_join.png` });
await B.click('text=JOIN GAME >> nth=-1');
await B.waitForTimeout(1800);
const guestCode = await B.textContent('.lobby-code').catch(()=>null);
console.log('guest sees lobby code =', guestCode, guestCode===code ? 'MATCH' : 'MISMATCH');
const roster = await A.$$eval('.slot .who', ns => ns.map(n=>n.textContent.trim()));
console.log('host roster:', roster.filter(Boolean).join(' | '));

// --- add bots, start ---
for (let i=0;i<3;i++){ await A.click('text=+ SURVIVOR BOT'); await A.waitForTimeout(300); }
await A.waitForTimeout(600);
await A.screenshot({ path: `${SP}/e2e_lobby_full.png` });
await A.click('text=BEGIN THE RITE');
await A.waitForTimeout(16000);

for (const [tag,p] of [['HOST',A],['GUEST',B]]) {
  const st = await p.evaluate(() => {
    const g = window.__game;
    if (!g || !g.running) return { running:false };
    const h = g.hudState();
    return { running:true, role:h.role, zone:h.zone, hp:h.health, fear:Math.round(h.fear),
      obj:h.objective.title, prog:h.objective.progress, mates:h.mates.length,
      fps:Math.round(window.__engine.fps), pos:[g.controller.pos.x|0, g.controller.pos.z|0] };
  });
  console.log(tag, JSON.stringify(st));
}
await A.screenshot({ path: `${SP}/e2e_game_host.png` });
await B.screenshot({ path: `${SP}/e2e_game_guest.png` });

// --- move the host around to prove input + collision + netcode ---
await A.evaluate(()=>document.getElementById('scene').click());
for (const k of ['KeyW','KeyW','KeyW','KeyD']) { await A.keyboard.down(k); await A.waitForTimeout(900); await A.keyboard.up(k); }
await A.waitForTimeout(2500);
const moved = await A.evaluate(()=>({ pos:[window.__game.controller.pos.x|0, window.__game.controller.pos.z|0], anim: window.__game.controller.animState }));
console.log('after movement:', JSON.stringify(moved));
await A.keyboard.press('F3');
await A.waitForTimeout(1200);
await A.screenshot({ path: `${SP}/e2e_debug.png` });
console.log(errs.length ? '\nERRORS:\n' + [...new Set(errs)].slice(0,20).join('\n') : '\nno page errors');
await b.close();
