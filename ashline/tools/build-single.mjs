/**
 * Bundle the production build into one self-contained HTML page (all JS and
 * CSS inlined) for sharing as a single file / hosted preview.
 * Output: build/ashline.html
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');

const fonts = (html.match(/<link[^>]+fonts\.googleapis[^>]*>/g) || []).join('\n');
const body = html
  .replace(/^[\s\S]*?<body[^>]*>/i, '')
  .replace(/<\/body>[\s\S]*$/i, '')
  .replace(/<script[^>]*src=[^>]*><\/script>/gi, '')
  .trim();

// The host supplies the document skeleton; emit page content only.
const out = `<title>Operation Ashline</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fonts}
<style>
${css}
</style>
${body}
<script type="module">
${js.replace(/<\/script>/g, '<\\/script>')}
</script>
`;
mkdirSync('build', { recursive: true });
writeFileSync('build/ashline.html', out);
const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
console.log(`build/ashline.html  ${mb} MB`);
if (Buffer.byteLength(out) > 16 * 1024 * 1024) console.log('WARNING: over 16 MB');
