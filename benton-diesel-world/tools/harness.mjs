// Headless Roblox-like runtime for testing Benton Diesel World without
// Roblox Studio. Runs the real game scripts in the Luau VM (WASM) against a
// mock engine that validates every API use against Roblox's API dump.
import { Lua } from '@luau-rs/luau';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', '.cache');
const DUMP_URL = 'https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/API-Dump.json';

async function loadDump() {
  const file = path.join(CACHE, 'API-Dump.json');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(CACHE, { recursive: true });
    console.log('Downloading Roblox API dump...');
    const res = await fetch(DUMP_URL);
    if (!res.ok) throw new Error(`Could not download API dump: ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function indexDump(dump) {
  const classes = new Map(dump.Classes.map((c) => [c.Name, c]));
  const memberCache = new Map();
  function member(cls, name) {
    const key = cls + '.' + name;
    if (memberCache.has(key)) return memberCache.get(key);
    let c = classes.get(cls);
    let found = null;
    while (c && !found) {
      for (const m of c.Members) {
        if (m.Name === name) { found = { m, owner: c.Name }; break; }
      }
      c = classes.get(c.Superclass);
    }
    let info = null;
    if (found) {
      const { m, owner } = found;
      const tags = m.Tags || [];
      const sec = m.Security || {};
      const readSec = typeof sec === 'string' ? sec : sec.Read;
      const writeSec = typeof sec === 'string' ? sec : sec.Write;
      const scriptable = !tags.includes('NotScriptable') && (readSec === 'None' || readSec === undefined);
      if (scriptable) {
        info = {
          MemberType: m.MemberType,
          Owner: owner,
          ValueType: m.ValueType ? m.ValueType.Name : null,
          Category: m.ValueType ? m.ValueType.Category : null,
          ReadOnly: tags.includes('ReadOnly'),
          CanWrite: writeSec === 'None' || writeSec === undefined,
          Deprecated: tags.includes('Deprecated'),
        };
      }
    }
    memberCache.set(key, info);
    return info;
  }
  const enums = {};
  for (const e of dump.Enums) {
    enums[e.Name] = Object.fromEntries(e.Items.map((i) => [i.Name, i.Value]));
  }
  return { classes, member, enums };
}

function toLua(lua, v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return lua.createTable(v.map((x) => toLua(lua, x)));
  if (typeof v === 'object') {
    const rec = {};
    for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) rec[k] = toLua(lua, x);
    return lua.createTable(rec);
  }
  return v;
}

export async function createRuntime({ quiet = false, log } = {}) {
  const api = indexDump(await loadDump());
  const lua = await Lua.create({ sandbox: false });
  const logs = [];
  const g = lua.globals;
  g.set('__hostlog', lua.createFunction((kind, msg) => {
    const line = `[${kind}] ${msg}`;
    logs.push({ kind, msg: String(msg) });
    if (log) log(kind, String(msg));
    else if (!quiet || kind === 'error') console.log(line);
  }));
  g.set('__api_class', lua.createFunction((name) => {
    const c = api.classes.get(String(name));
    if (!c) return null;
    const tags = c.Tags || [];
    return toLua(lua, {
      Superclass: c.Superclass,
      Creatable: !tags.includes('NotCreatable') && !tags.includes('Service'),
      Service: tags.includes('Service'),
    });
  }));
  g.set('__api_member', lua.createFunction((cls, name) => toLua(lua, api.member(String(cls), String(name)))));
  g.set('__api_enums', lua.createFunction(() => toLua(lua, api.enums)));
  g.set('__load', lua.createFunction((source, name) => lua.load(String(source), { name: String(name) })));

  for (const f of ['Datatypes', 'Scheduler', 'Instances', 'Services']) {
    const src = fs.readFileSync(path.join(ROOT, 'tools', 'mock', f + '.luau'), 'utf8');
    lua.execute(src, { name: '=' + f });
  }

  // Build the game tree from the Rojo project.
  const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'default.project.json'), 'utf8'));
  const scripts = [];
  function mount(dir, parentExpr, name) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const init = entries.find((e) => /^init\.(server|client)?\.?luau$/.test(e.name));
    let cls = 'Folder';
    let source = null;
    if (init) {
      source = fs.readFileSync(path.join(dir, init.name), 'utf8');
      cls = init.name.includes('.server.') ? 'Script' : init.name.includes('.client.') ? 'LocalScript' : 'ModuleScript';
    }
    const id = `__node${scripts.length}`;
    scripts.push({ id, cls, name, parentExpr, source });
    for (const e of entries) {
      if (init && e.name === init.name) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) mount(p, id, e.name);
      else if (e.name.endsWith('.luau')) {
        const base = e.name.replace(/\.(server|client)\.luau$/, '').replace(/\.luau$/, '');
        const c = e.name.endsWith('.server.luau') ? 'Script' : e.name.endsWith('.client.luau') ? 'LocalScript' : 'ModuleScript';
        scripts.push({ id: `__node${scripts.length}`, cls: c, name: base, parentExpr: id, source: fs.readFileSync(p, 'utf8') });
      }
    }
  }
  function walkTree(node, selfExpr, name, parentExpr) {
    if (node.$path) {
      mount(path.join(ROOT, node.$path), parentExpr, name);
      return;
    }
    for (const [k, child] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      const childExpr = selfExpr === 'game' ? `game:GetService("${k}")` : `${selfExpr}:FindFirstChild("${k}")`;
      walkTree(child, childExpr, k, selfExpr);
    }
  }
  walkTree(project.tree, 'game', 'game', null);
  const nodes = {};
  const make = lua.execute(`
    local M = _G.__mock
    local nodes = {}
    return function(id, cls, name, parentExpr, source)
      local parent
      if string.sub(parentExpr, 1, 6) == "__node" then
        parent = nodes[parentExpr]
      else
        parent = loadstring_host(parentExpr)
      end
      local inst
      if cls == "Folder" then
        inst = M.makeFolder(name, parent)
      else
        inst = M.makeScript(cls, name, source, parent)
      end
      nodes[id] = inst
      return inst
    end
  `)[0];
  g.set('loadstring_host', lua.createFunction((expr) => lua.load('return ' + expr, { name: '=tree' }).call()[0]));
  for (const s of scripts) nodes[s.id] = make.call(s.id, s.cls, s.name, s.parentExpr, s.source)[0];
  g.set('__scripts', toLua(lua, scripts.map((s) => ({ id: s.id, cls: s.cls, name: s.name }))));

  return {
    lua,
    logs,
    nodes,
    scripts,
    exec(code, name = '=test') {
      return lua.execute(code, { name });
    },
    errors() {
      return lua.execute('return _G.__mock.errors')[0];
    },
  };
}
