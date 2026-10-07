// Type-checks every Luau file in src/ against the Roblox API using the Luau
// analyzer (WASM build from @luau-rs/luau) and luau-lsp's Roblox definitions.
//
//   npm install
//   npm run check
//
// Roblox-specific "magic" that Studio/luau-lsp normally provide is emulated:
//  * Instance.new("X") and game:GetService("X") get typed overloads for the
//    classes/services this project actually uses (and unknown names error).
//  * require(<instance path>.Name) is resolved to the module file named Name.
import { Analysis } from '@luau-rs/luau/analysis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', '.cache');
const DEFS_URL = 'https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau';

async function loadDefinitions() {
  const file = path.join(CACHE, 'globalTypes.d.luau');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log('Downloading Roblox type definitions...');
    const res = await fetch(DEFS_URL);
    if (!res.ok) throw new Error(`Could not download ${DEFS_URL}: ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
  return fs.readFileSync(file, 'utf8');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.luau') || p.endsWith('.lua')) out.push(p);
  }
  return out;
}

// Find require(...) calls and rewrite them to require("./ModuleName").
function rewriteRequires(src, known) {
  let out = '';
  let i = 0;
  const unresolved = [];
  for (;;) {
    const j = src.indexOf('require(', i);
    if (j < 0) { out += src.slice(i); break; }
    // make sure it's not part of a longer identifier
    if (j > 0 && /[\w.:]/.test(src[j - 1])) { out += src.slice(i, j + 8); i = j + 8; continue; }
    let depth = 1, k = j + 8;
    while (k < src.length && depth > 0) {
      if (src[k] === '(') depth++;
      else if (src[k] === ')') depth--;
      k++;
    }
    const inner = src.slice(j + 8, k - 1).trim();
    let name = null;
    let m = inner.match(/"(\w+)"\s*\)\s*$/) || inner.match(/\.(\w+)\s*$/);
    if (m) name = m[1];
    if (name && known.has(name)) {
      out += src.slice(i, j) + `require("./${name}")`;
    } else {
      unresolved.push(inner);
      out += src.slice(i, k);
    }
    i = k;
  }
  return { out, unresolved };
}

// Emulate Studio's typed Instance.new / GetService without huge overloads.
function typedSource(src) {
  return src
    .replace(/Instance\.new\("(\w+)"\)/g, '(Instance.new("$1") :: $1)')
    .replace(/(game|[\w.]+):GetService\("(\w+)"\)/g, '($1:GetService("$2") :: $2)')
    .replace(/:(FindFirstChildOfClass|FindFirstChildWhichIsA|FindFirstAncestorOfClass|FindFirstAncestorWhichIsA)\("(\w+)"\)(?![:.\w])/g, ':$1("$2") :: $2?')
    // type annotations: Enum.Material -> EnumMaterial (luau-lsp's naming)
    .replace(/(?<=(?::|->|\||<)\s*)Enum\.(\w+)(?![.\w])/g, 'Enum$1');
}

function patchDefinitions(defs, sources) {
  const all = sources.join('\n');
  const meta = JSON.parse(defs.slice('--#METADATA#'.length, defs.indexOf('\n')));
  const creatable = new Set(meta.CREATABLE_INSTANCES);

  // Instance.new("X") / GetService("X") are typed by casting at the call
  // site (see typedSource); here we only validate the class names.
  const used = new Set([...all.matchAll(/Instance\.new\(\s*"(\w+)"/g)].map((m) => m[1]));
  const bad = [...used].filter((c) => !creatable.has(c));

  // The full Enum table is too large for the WASM analyzer; keep what we use.
  const enums = new Set([...all.matchAll(/Enum\.(\w+)/g)].map((m) => m[1]));
  defs = defs.replace(/type ENUM_LIST = \{\n([\s\S]*?)\n\}/, (_, body) => {
    const kept = body.split('\n').filter((l) => enums.has(l.trim().split(':')[0]));
    return 'type ENUM_LIST = {\n' + kept.join('\n') + '\n}';
  });
  return { defs, bad };
}

async function main() {
  const files = walk(path.join(ROOT, 'src'));
  const mods = files.map((f) => {
    const base = path.basename(f).replace(/\.(server|client)?\.?luau?$/, '').replace(/\.lua$/, '');
    const isInit = base === 'init';
    const name = isInit ? path.basename(path.dirname(f)) : base;
    const kind = /\.(server|client)\.luau$/.test(f) ? 'script' : 'module';
    return { file: f, name, kind, src: fs.readFileSync(f, 'utf8') };
  });
  const names = new Map();
  for (const m of mods) {
    if (names.has(m.name)) throw new Error(`Duplicate module name ${m.name}: ${m.file} and ${names.get(m.name)}`);
    names.set(m.name, m.file);
  }
  const known = new Set(mods.filter((m) => m.kind === 'module').map((m) => m.name));

  const { defs, bad } = patchDefinitions(await loadDefinitions(), mods.map((m) => m.src));
  let problems = 0;
  for (const c of bad) { console.log(`error: Instance.new("${c}") is not a creatable class`); problems++; }

  const analysis = await Analysis.create({ mode: 'strict', lint: true });
  analysis.addDefinition('@roblox', defs);
  for (const m of mods) {
    const { out, unresolved } = rewriteRequires(typedSource(m.src), known);
    for (const u of unresolved) { console.log(`${path.relative(ROOT, m.file)}: unresolved require(${u})`); problems++; }
    analysis.setModule(`m/${m.name}`, out, m.kind);
  }
  const ignoreLint = new Set(['ImportUnused']);
  for (const m of mods) {
    const r = analysis.check(`m/${m.name}`);
    for (const d of r.diagnostics) {
      if (d.module !== `m/${m.name}`) continue;
      if (d.kind === 'lint' && ignoreLint.has(String(d.code))) continue;
      // locals only used inside require(...) look unused after the rewrite
      if (d.kind === 'lint' && d.code === 'LocalUnused') {
        const v = (d.message.match(/Variable '(\w+)'/) || [])[1];
        if (v && (m.src.match(new RegExp(`\\b${v}\\b`, 'g')) || []).length > 1) continue;
      }
      const rel = path.relative(ROOT, m.file);
      console.log(`${rel}:${d.location.begin.line + 1}:${d.location.begin.column + 1} ${d.severity} [${d.kind} ${d.code}] ${d.message}`);
      problems++;
    }
    if (r.timeoutModules.length) console.log('timeout:', r.timeoutModules.join(', '));
  }
  console.log(problems === 0 ? `OK - ${mods.length} files, no problems` : `${problems} problem(s) in ${mods.length} files`);
  process.exitCode = problems === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
