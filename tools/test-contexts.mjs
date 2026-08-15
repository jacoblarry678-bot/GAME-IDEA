import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:1100,height:700} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{ const t=m.text(); if(m.type()==='error'&&!t.includes('404')) errs.push(t); });
// count every WebGL context the page creates, and watch for context loss
await p.addInitScript(() => {
  window.__ctx = 0; window.__lost = 0;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = orig.call(this, type, ...rest);
    if (c && /webgl/i.test(type)) {
      window.__ctx++;
      this.addEventListener('webglcontextlost', () => { window.__lost++; });
    }
    return c;
  };
});
await p.goto('http://localhost:8081/hellraiser.html',{waitUntil:'load',timeout:90000});
await p.waitForTimeout(16000);
const boot = await p.evaluate(()=>{const b=document.getElementById('boot');return b?b.textContent.trim().slice(0,120):'(gone)';});
console.log('boot:', boot);
console.log('contexts after load:', await p.evaluate(()=>window.__ctx), 'lost:', await p.evaluate(()=>window.__lost));

await p.click('text=CHARACTERS'); await p.waitForTimeout(8000);
console.log('contexts after CHARACTERS:', await p.evaluate(()=>window.__ctx), 'lost:', await p.evaluate(()=>window.__lost));
// are the portrait canvases actually painted?
const painted = await p.evaluate(()=>{
  const cs=[...document.querySelectorAll('.char-portrait canvas')];
  return cs.map(c=>{ const d=c.getContext('2d'); if(!d) return 'nodata';
    const px=d.getImageData(0,0,c.width,c.height).data; let s=0;
    for(let i=0;i<px.length;i+=40) s+=px[i]+px[i+1]+px[i+2];
    return s>0?'painted':'blank'; });
});
console.log('portraits:', painted.join(','));
await p.screenshot({path:`${SP}/ctx_chars.png`,timeout:45000});

await p.click('#screen-characters .menu-btn:text-is("BACK")'); await p.waitForTimeout(3000);
const alive = await p.evaluate(()=>({frame:window.__engine.frame, lost:window.__lost, ctx:window.__ctx}));
console.log('after BACK — engine frames:', alive.frame, 'contexts:', alive.ctx, 'lost:', alive.lost);
await p.waitForTimeout(2500);
const alive2 = await p.evaluate(()=>window.__engine.frame);
console.log('main scene still advancing:', alive2 > alive.frame, `(${alive.frame} -> ${alive2})`);
await p.screenshot({path:`${SP}/ctx_menu.png`,timeout:45000});
console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].slice(0,6).join('\n') : 'no errors');
await b.close();
