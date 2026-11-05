/**
 * Builds real-map sub-tiles off the main thread: fetches and decodes packs, then turns a
 * sub-tile into geometry arrays, colliders, a surface raster and a minimap image, and
 * sends them back (typed arrays transferred, not copied).
 */
import { setMapBase, loadIndex, loadPack } from './data.js';
import { buildTileData } from './tilemesh.js';

const MINI = [[26, 90, 114], [217, 210, 195], [143, 179, 106], [239, 220, 174], [58, 61, 68], [232, 228, 220], [158, 148, 131], [130, 172, 96], [176, 138, 90]];
let index = null, deco = null, facadeTile = [12, 13.6];

async function miniBitmap(r) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  const c = new OffscreenCanvas(r.N, r.N), x = c.getContext('2d'), img = x.createImageData(r.N, r.N), d = img.data;
  for (let i = 0; i < r.codes.length; i++) { const k = MINI[r.codes[i]] || MINI[1]; d[i * 4] = k[0]; d[i * 4 + 1] = k[1]; d[i * 4 + 2] = k[2]; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return createImageBitmap(c);
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    setMapBase(m.base);
    facadeTile = m.facadeTile || facadeTile;
    const D = m.deco;
    deco = (x, z) => x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1;
    try { index = await loadIndex(); self.postMessage({ type: 'ready', index }); }
    catch (err) { self.postMessage({ type: 'ready', error: String(err) }); }
    return;
  }
  if (m.type === 'build') {
    try {
      const pack = await loadPack(index, m.i, m.j);
      const tile = pack?.tiles.get(`${m.u}_${m.v}`);
      if (!tile) { self.postMessage({ type: 'tile', key: m.key, empty: true }); return; }
      const r = buildTileData(tile, index, { deco, FACADE_TILE: facadeTile });
      const transfer = [];
      for (const b of r.bins) { transfer.push(b.pos.buffer, b.nrm.buffer, b.uv.buffer); if (b.col) transfer.push(b.col.buffer); }
      const mini = await miniBitmap(r.raster).catch(() => null);
      if (mini) transfer.push(mini);
      transfer.push(r.raster.codes.buffer);
      self.postMessage({ type: 'tile', key: m.key, bins: r.bins, colliders: r.colliders, raster: r.raster, decks: r.decks, places: r.places, roads: r.roads, mini }, transfer);
    } catch (err) {
      self.postMessage({ type: 'tile', key: m.key, error: String(err && err.stack || err) });
    }
  }
};
