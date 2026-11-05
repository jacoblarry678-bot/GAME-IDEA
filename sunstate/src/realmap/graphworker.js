/**
 * Holds the real map's road graph off the main thread: answers "roads near here" (for
 * traffic, pedestrians and police) and GPS routes.
 *   init {url, enc}          → ready {edges} | ready {error}
 *   near {id, x, z, r}       → near {id, ...packed edges}
 *   route {id, x0, z0, x1, z1} → route {id, pts, len, eta, names} | route {id, none}
 *   render {id, cx, cz, mpp, w, h} → render {id, bmp}   (the pause-menu map)
 */
import { RoadGraph } from './roadgraph.js';

let G = null;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try { G = await RoadGraph.load(m.url, m.enc); self.postMessage({ type: 'ready', edges: G.E, names: G.names }); }
    catch (err) { self.postMessage({ type: 'ready', error: String(err) }); }
    return;
  }
  if (!G) return;
  if (m.type === 'near') {
    const p = G.pack(G.near(m.x, m.z, m.r));
    self.postMessage({ type: 'near', id: m.id, x: m.x, z: m.z, ...p }, [p.ids.buffer, p.a.buffer, p.b.buffer, p.cls.buffer, p.flags.buffer, p.lvl.buffer, p.speed.buffer, p.name.buffer, p.off.buffer, p.pts.buffer, p.nodes.buffer]);
  } else if (m.type === 'render') {
    // the pause-menu map: the roads of a view drawn into a bitmap
    const c = new OffscreenCanvas(m.w, m.h);
    G.drawTo(c.getContext('2d'), m.cx, m.cz, m.mpp, m.w, m.h);
    const bmp = c.transferToImageBitmap();
    self.postMessage({ type: 'render', id: m.id, bmp }, [bmp]);
  } else if (m.type === 'route') {
    const r = G.route(m.x0, m.z0, m.x1, m.z1);
    if (!r) self.postMessage({ type: 'route', id: m.id, none: true });
    else self.postMessage({ type: 'route', id: m.id, ...r }, [r.pts.buffer]);
  }
};
