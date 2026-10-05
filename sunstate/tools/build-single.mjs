/**
 * Bundle the production build into one self-contained HTML page (JS and CSS
 * inlined) for sharing as a single file or hosted preview.
 * Output: build/sunstate.html
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const head = (html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '')
  .replace(/<meta[^>]*>/gi, '')
  .replace(/<script[^>]*src=[^>]*><\/script>/gi, '')
  .replace(/<link[^>]+rel="stylesheet"[^>]+href="\.\/assets[^>]*>/gi, '')
  .replace(/<link[^>]+rel="modulepreload"[^>]*>/gi, '');
// Content only: the host page supplies the doctype/html/head/body skeleton.
const out = `${head.trim()}
<style>
:root { color-scheme: dark; }
${css}
</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script type="module">
${js.replace(/<\/script>/g, '<\\/script>')}
</script>
`;
mkdirSync('build', { recursive: true });
writeFileSync('build/sunstate.html', out);
const mb = Buffer.byteLength(out) / 1024 / 1024;
console.log(`build/sunstate.html  ${mb.toFixed(2)} MB`);
if (mb > 16) console.log('WARNING: over 16 MB');
