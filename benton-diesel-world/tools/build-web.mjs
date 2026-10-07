// Bundles the browser edition into web/dist: index.html, game.js and
// park.json (exported from the Roblox build by tools/export-web.mjs).
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web');
const dist = join(web, 'dist');
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(web, 'src', 'main.js')],
  bundle: true,
  minify: !process.argv.includes('--dev'),
  sourcemap: process.argv.includes('--dev') ? 'inline' : false,
  format: 'iife',
  target: ['es2020'],
  outfile: join(dist, 'game.js'),
  legalComments: 'none',
  logLevel: 'warning',
});
copyFileSync(join(web, 'index.html'), join(dist, 'index.html'));
copyFileSync(join(web, 'public', 'park.json'), join(dist, 'park.json'));

for (const f of ['index.html', 'game.js', 'park.json']) {
  console.log(`${f.padEnd(11)} ${(statSync(join(dist, f)).size / 1024).toFixed(0)} KB`);
}
