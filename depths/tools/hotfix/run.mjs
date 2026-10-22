/**
 * Runs every hotfix check in this folder (browser checks named *-e2e.mjs are
 * left for their own commands). Run: node tools/hotfix/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'run.mjs' && !f.endsWith('-e2e.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').filter((l) => !l.startsWith('  FAIL')).pop() || '';
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${f.padEnd(18)} ${last}`);
  if (r.status !== 0) { failed++; process.stdout.write(r.stdout.split('\n').filter((l) => l.startsWith('  FAIL')).join('\n') + '\n' + (r.stderr || '')); }
}
process.exit(failed ? 1 : 0);
