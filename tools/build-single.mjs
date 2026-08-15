/**
 * Builds a single self-contained HTML file for the offline (solo vs bots)
 * build: every script and stylesheet inlined, no external requests at all.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js'));
const css = assets.filter((f) => f.endsWith('.css'));

let scripts = '';
for (const f of js) scripts += readFileSync(join(dist, 'assets', f), 'utf8') + '\n';
let styles = '';
for (const f of css) styles += readFileSync(join(dist, 'assets', f), 'utf8') + '\n';

// The artifact host wraps our content in its own <!doctype>/<html>/<head>/<body>,
// so emit page content only.
const body = html
  .replace(/^[\s\S]*?<body[^>]*>/i, '')
  .replace(/<\/body>[\s\S]*$/i, '')
  .replace(/<script[^>]*src=[^>]*><\/script>/gi, '')
  .trim();

const out = `<title>Hellraiser: The Labyrinth</title>
<style>
${styles}
html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#040305;}
</style>
${body}
<script>window.__HELLRAISER_OFFLINE__ = true;</script>
<script type="module">
${scripts}
</script>
`;

mkdirSync('build', { recursive: true });
writeFileSync('build/hellraiser.html', out);
const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
console.log(`build/hellraiser.html  ${mb} MB  (${js.length} js, ${css.length} css inlined)`);
if (Buffer.byteLength(out) > 16 * 1024 * 1024) console.log('WARNING: over the 16MB artifact limit');
