/**
 * Real-map data: the index, the streamed packs and the road graph built by
 * tools/mapdata/build_packs.py from Overture Maps (OpenStreetMap and other open data).
 *
 * Coordinates are the game's metres: x east, z south, origin at Bayfront Park in downtown
 * Miami. Each 2 km pack holds 4×4 sub-tiles of 500 m; a sub-tile's records are quantized to
 * 0.1 m relative to its corner and delta-encoded (see the builder for the record layouts).
 */

const BASE = new URL('map/', document.baseURI).href;

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = fetch(BASE + 'index.json').then((r) => { if (!r.ok) throw new Error('map index ' + r.status); return r.json(); }).then((ix) => { encoding = ix.enc || null; return ix; });
  return indexPromise;
}

let encoding = null; // 'b64gz' when the packs are base64 text (the artifact host serves .txt, not .gz)
async function gunzipJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  let buf;
  if (encoding === 'b64gz') {
    const bin = atob((await r.text()).trim());
    buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  } else buf = new Uint8Array(await r.arrayBuffer());
  // the server may already have decoded it (Content-Encoding); otherwise inflate here
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(ds).text());
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

const packCache = new Map();
/** Load one pack (i, j) → { tiles: Map("u_v" → decoded sub-tile), names } or null if empty. */
export function loadPack(index, i, j) {
  const key = `${i}_${j}`;
  if (packCache.has(key)) return packCache.get(key);
  const meta = index.packs[key];
  const p = meta ? gunzipJSON(BASE + meta.f).then((raw) => decodePack(index, i, j, raw)) : Promise.resolve(null);
  packCache.set(key, p);
  return p;
}
export function dropPack(i, j) { packCache.delete(`${i}_${j}`); }

/** Undo the delta encoding of n points starting at arr[k]; returns [Float32Array xz, next k]. */
function readPts(arr, k, n, ox, oz, q) {
  const out = new Float32Array(n * 2);
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) {
    x += arr[k++]; z += arr[k++];
    out[i * 2] = ox + x / q; out[i * 2 + 1] = oz + z / q;
  }
  return [out, k];
}

function decodePack(index, i, j, raw) {
  const q = index.q, P = index.pack, S = index.sub;
  const tiles = new Map();
  for (const [key, t] of Object.entries(raw.t)) {
    const [u, v] = key.split('_').map(Number);
    const ox = i * P + u * S, oz = j * P + v * S;
    const tile = { key: `${i}_${j}_${u}_${v}`, x0: ox, z0: oz, size: S, buildings: [], roads: [], ground: [], places: [], infra: [] };
    for (const r of t.b || []) {
      const [h, mh, cls, roof, colour, n] = r;
      const [pts] = readPts(r, 6, n, ox, oz, q);
      tile.buildings.push({ h: h / 10, minh: mh / 10, cls, roof, colour, pts });
    }
    for (const r of t.r || []) {
      const [cls, name, flags, w, lvl, n] = r;
      const [pts, k] = readPts(r, 6, n, ox, oz, q);
      let hts = null;
      if (flags & 128) { hts = new Float32Array(n); for (let a = 0; a < n; a++) hts[a] = r[k + a] / 10; }
      tile.roads.push({ cls, name: raw.names[name] || '', flags, width: w / 10, lvl, pts, hts });
    }
    for (const r of t.g || []) {
      const kind = r[0], nr = r[1];
      let k = 2 + nr;
      const rings = [];
      for (let a = 0; a < nr; a++) { const [pts, k2] = readPts(r, k, r[2 + a], ox, oz, q); rings.push(pts); k = k2; }
      tile.ground.push({ kind, rings });
    }
    for (const r of t.p || []) tile.places.push({ kind: r[0], x: ox + r[1] / q, z: oz + r[2] / q, key: r[3] });
    for (const r of t.i || []) {
      const kind = r[0], n = r[1];
      const [pts] = readPts(r, 2, n, ox, oz, q);
      tile.infra.push({ kind: kind % 100, line: kind >= 100, pts });
    }
    tiles.set(`${u}_${v}`, tile);
  }
  return { i, j, tiles };
}

let graphPromise = null;
/** The drivable road graph: nodes [x, z, ...], edges [a, b, cls, flags, lvl, speed, name, polyline]. */
export function loadGraph(index) {
  if (!graphPromise) graphPromise = gunzipJSON(BASE + index.graph.f);
  return graphPromise;
}

/** lon/lat → game metres, for tools and debugging. */
export function project(index, lon, lat) {
  const o = index.origin;
  return { x: (lon - o.lon) * o.kx, z: -(lat - o.lat) * o.kz };
}
export function unproject(index, x, z) {
  const o = index.origin;
  return { lon: o.lon + x / o.kx, lat: o.lat - z / o.kz };
}
