/**
 * Packages the solo edition for itch.io (or any static host without the
 * game server): build/itch/index.html plus build/battle-island-itch.zip.
 * Run `npm run island:build` first (`npm run island:itch` does both).
 * The solo edition hides Play Online; everything else is the full game.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const src = 'battle-island/build/battle-island.html';
if (!existsSync(src)) throw new Error(`${src} is missing: run npm run island:build first`);
const html = readFileSync(src, 'utf8').replace('<head>', `<head>\n<script>window.BI_EDITION = 'solo';</script>`);
mkdirSync('battle-island/build/itch', { recursive: true });
writeFileSync('battle-island/build/itch/index.html', html);
const zip = 'battle-island/build/battle-island-itch.zip';
rmSync(zip, { force: true });
execFileSync('zip', ['-j', '-9', '-q', zip, 'battle-island/build/itch/index.html']);
const kb = (f) => Math.round(readFileSync(f).length / 1024);
console.log(`${zip} (${kb(zip)} KB, index.html ${kb('battle-island/build/itch/index.html')} KB)`);
