/**
 * Inlines the Battle Island Vite build into self-contained HTML:
 *  - build/battle-island.html           full document (double-click / any static host)
 *  - build/battle-island.artifact.html  page content only (artifact hosts add the skeleton)
 * No external requests except the optional Google Font.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'battle-island/dist';
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const body = html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '').replace(/<script[^>]*src=[^>]*><\/script>/gi, '').trim();
// `</script` inside the bundle would end the inline tag early
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const head = `<title>Benton Kids: Battle Island</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap" rel="stylesheet" />
<style>
${css}
</style>`;
const content = `${body}
<script type="module">
${safeJs}
</script>
`;
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
</head>
<body>
${content}</body>
</html>
`;
mkdirSync('battle-island/build', { recursive: true });
writeFileSync('battle-island/build/battle-island.html', full);
writeFileSync('battle-island/build/battle-island.artifact.html', `${head}\n${content}`);
console.log(`battle-island/build/battle-island.html ${(Buffer.byteLength(full) / 1048576).toFixed(2)} MB (+ .artifact.html)`);
