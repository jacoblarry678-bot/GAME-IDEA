// Repackage dist/map for the claude.ai artifact host, which serves .txt but not .gz:
// each gzip pack becomes base64 text, and index.json says so (enc: "b64gz").
//   node tools/mapdata/for_artifact.mjs [src=dist/map] [out=dist-art/map]
import fs from 'node:fs';
import path from 'node:path';
const src = process.argv[2] || 'dist/map', out = process.argv[3] || 'dist-art/map';
fs.mkdirSync(out, { recursive: true });
const index = JSON.parse(fs.readFileSync(path.join(src, 'index.json'), 'utf8'));
const conv = (f) => { const t = f.replace(/(\.json)?\.gz$/, (m) => (m === '.gz' ? '.bin.txt' : '.txt')).replace('.bin.bin.', '.bin.'); fs.writeFileSync(path.join(out, t), fs.readFileSync(path.join(src, f)).toString('base64')); return t; };
for (const p of Object.values(index.packs)) p.f = conv(p.f);
index.graph.f = conv(index.graph.f);
if (index.graphBin) index.graphBin.f = conv(index.graphBin.f);
index.enc = 'b64gz';
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
console.log(`${Object.keys(index.packs).length + 2} files → ${out}`);
