// Scans every mesh in a match for zero-length or NaN normals (they render black and flicker with bloom).
// Usage: node tools/normals.mjs [map]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const maps = process.argv[2] ? [process.argv[2]] : ['ashgrove', 'hollowpines', 'stivo', 'gravelpit', 'craneridge'];
const server = spawn('npx', ['vite', 'preview', '--port', '4199', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const map of maps) {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.goto(`http://localhost:4199/?autoplay&role=survivor&map=${map}&q=low`);
  const ok = await page.waitForFunction(() => window.__match, null, { timeout: 60000 }).then(() => true, () => false);
  if (!ok) { console.log(map, 'did not start'); bad++; await page.close(); continue; }
  const r = await page.evaluate(() => {
    const out = [];
    window.__match.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.normal) return;
      const n = o.geometry.attributes.normal;
      let zero = 0;
      for (let i = 0; i < n.count; i++) {
        const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        if (!(l > 0.01)) zero++;
      }
      if (zero) out.push(`${o.name || o.material.type} (${zero} bad of ${n.count})`);
    });
    return out;
  });
  console.log(map, r.length ? 'BAD NORMALS: ' + r.slice(0, 6).join(', ') : 'clean');
  if (r.length) bad++;
  await page.close();
}
await browser.close(); server.kill();
process.exit(bad ? 1 : 0);
