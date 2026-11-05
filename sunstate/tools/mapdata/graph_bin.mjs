// Pack the drivable road graph (graph.json.gz from build_packs.py) into a compact binary the
// game can load in a worker without parsing ~30 MB of JSON: graph.bin.gz, recorded in
// index.json as `graphBin`.
//   node tools/mapdata/graph_bin.mjs [dir=public/map]
//
// Layout (little-endian), all coordinates in decimetres:
//   u32[8]   header: 'RG01', nodes, edges, points, nameBytes, 0, 0, 0
//   i32[2n]  node x, z
//   u32[e]   edge from-node, u32[e] to-node, u32[e+1] first point of each edge, u32[e] name index
//   i32[2p]  polyline points, per edge: the first absolute, then deltas
//   u8[e] class, u8[e] flags, i8[e] level, u8[e] speed limit (km/h, 0 unknown)
//   utf-8    JSON array of street names
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2] || 'public/map';
const g = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'graph.json.gz'))).toString());
const N = g.nodes.length / 2, E = g.edges.length;
let P = 0;
for (const e of g.edges) P += e[7].length / 2;
const names = [], nameIx = new Map();
const nm = (s) => { s = s || ''; if (!nameIx.has(s)) { nameIx.set(s, names.length); names.push(s); } return nameIx.get(s); };
nm('');
const nodes = new Int32Array(2 * N);
for (let i = 0; i < 2 * N; i++) nodes[i] = Math.round(g.nodes[i] * 10);
const eA = new Uint32Array(E), eB = new Uint32Array(E), eOff = new Uint32Array(E + 1), eName = new Uint32Array(E);
const pts = new Int32Array(2 * P);
const cls = new Uint8Array(E), flags = new Uint8Array(E), lvl = new Int8Array(E), speed = new Uint8Array(E);
let p = 0;
g.edges.forEach((e, k) => {
  eA[k] = e[0]; eB[k] = e[1]; cls[k] = e[2]; flags[k] = e[3] & 255; lvl[k] = e[4]; speed[k] = Math.min(255, e[5]); eName[k] = nm(e[6]);
  eOff[k] = p;
  const line = e[7];
  let px = 0, pz = 0;
  for (let i = 0; i < line.length; i += 2) {
    const x = Math.round(line[i] * 10), z = Math.round(line[i + 1] * 10);
    pts[p * 2] = i ? x - px : x; pts[p * 2 + 1] = i ? z - pz : z;
    px = x; pz = z; p++;
  }
});
eOff[E] = p;
const nameBytes = Buffer.from(JSON.stringify(names));
const header = new Uint32Array([0x31304752, N, E, P, nameBytes.length, 0, 0, 0]);
const parts = [header, nodes, eA, eB, eOff, eName, pts, cls, flags, lvl, speed].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
parts.push(nameBytes);
const raw = Buffer.concat(parts);
const gz = zlib.gzipSync(raw, { level: 9 });
fs.writeFileSync(path.join(dir, 'graph.bin.gz'), gz);
const ixPath = path.join(dir, 'index.json');
const index = JSON.parse(fs.readFileSync(ixPath, 'utf8'));
index.graphBin = { f: 'graph.bin.gz', bytes: gz.length, nodes: N, edges: E, points: P };
fs.writeFileSync(ixPath, JSON.stringify(index));
console.log(`graph.bin.gz: ${N} nodes, ${E} edges, ${P} points, ${(raw.length / 1e6).toFixed(1)} MB raw → ${(gz.length / 1e6).toFixed(1)} MB`);
