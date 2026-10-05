/**
 * Static map image (drawn once from the layout) used by the minimap and the
 * full-screen map. 2 pixels per metre; north is up (−z).
 */
import { ROADS, roadHalfWidth, ISLAND, MAINLAND, BACKDROP, CAUSEWAY, BLOCKS, AVENUES, STREETS, ROAD_GRAPH, nearestRoadPoint, findRoute } from '../world/layout.js';
import { DISTRICT, PLACES } from '../world/district.js';

export const MAP = { x0: -470, z0: -380, x1: 480, z1: 380, ppm: 2 };
export const MAP_COLORS = { water: '#1a5a72', deep: '#123f55', land: '#d9d2c3', block: '#c9c0ad', building: '#9e9483', road: '#3a3d44', roadEdge: '#f2efe8', sand: '#efdcae', grass: '#8fb36a', lot: '#b5aea0' };

let cached = null;
export function staticMap() {
  if (cached) return cached;
  const W = (MAP.x1 - MAP.x0) * MAP.ppm, H = (MAP.z1 - MAP.z0) * MAP.ppm;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const X = (wx) => (wx - MAP.x0) * MAP.ppm, Z = (wz) => (wz - MAP.z0) * MAP.ppm;
  const rect = (x0, z0, x1, z1, col) => { x.fillStyle = col; x.fillRect(X(x0), Z(z0), (x1 - x0) * MAP.ppm, (z1 - z0) * MAP.ppm); };
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, MAP_COLORS.water);
  rect(ISLAND.sandStart + 70, MAP.z0, MAP.x1, MAP.z1, MAP_COLORS.deep);
  // backdrop lands
  rect(MAP.x0, MAP.z0, BACKDROP.downtownX, MAP.z1, '#b9b2a4');
  for (const R of [BACKDROP.north, BACKDROP.south]) rect(R.x0, R.z0, R.x1, R.z1, '#b9b2a4');
  // island and beach
  rect(ISLAND.west, ISLAND.north, ISLAND.sandStart, ISLAND.south, MAP_COLORS.land);
  rect(ISLAND.sandStart, ISLAND.north, ISLAND.shore - 10, ISLAND.south, MAP_COLORS.sand);
  rect(ISLAND.promenade + 2.5, ISLAND.north, ISLAND.sandStart - 2.5, ISLAND.south, MAP_COLORS.grass);
  rect(MAINLAND.west, MAINLAND.north, MAINLAND.east, MAINLAND.south, MAP_COLORS.lot);
  for (const b of BLOCKS) rect(b.x0, b.z0, b.x1, b.z1, MAP_COLORS.block);
  for (const l of DISTRICT.lots) rect(l.x0, l.z0, l.x1, l.z1, MAP_COLORS.lot);
  for (const b of DISTRICT.buildings) rect(b.x0, b.z0, b.x1, b.z1, MAP_COLORS.building);
  // roads: white edge then dark fill
  for (const pass of [0, 1]) {
    for (const s of ROADS) {
      const hw = roadHalfWidth(s.lanes) + (pass ? 0 : 0.8);
      const col = pass ? MAP_COLORS.road : MAP_COLORS.roadEdge;
      if (s.dir === 'ns') rect(s.c - hw, s.from - hw, s.c + hw, s.to + hw, col);
      else rect(s.from - hw, s.c - hw, s.to + hw, s.c + hw, col);
    }
  }
  // unfinished bridge to downtown
  x.setLineDash([6, 6]); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 8;
  x.beginPath(); x.moveTo(X(MAINLAND.west), Z(CAUSEWAY.z)); x.lineTo(X(BACKDROP.downtownX), Z(CAUSEWAY.z)); x.stroke(); x.setLineDash([]);
  // labels
  x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '700 22px Inter, Arial'; x.textAlign = 'center';
  x.fillText('DOWNTOWN COSTA VELA', X(BACKDROP.downtownX - 150), Z(-200));
  x.fillText('VELA BAY', X(-200), Z(-180));
  x.fillText('ATLANTIC', X(380), Z(0));
  x.save(); x.fillStyle = 'rgba(60,50,40,0.55)'; x.font = '800 26px Inter, Arial';
  x.fillText('OCEAN MILE', X(60), Z(-262));
  x.restore();
  x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = '600 13px Inter, Arial';
  for (const a of AVENUES) { x.save(); x.translate(X(a.x) + 4, Z(-120)); x.rotate(-Math.PI / 2); x.fillText(a.name, 0, 0); x.restore(); }
  for (const s of STREETS) x.fillText(s.name, X(120), Z(s.z) + 4);
  cached = c;
  return c;
}

export const toMap = (wx, wz) => [(wx - MAP.x0) * MAP.ppm, (wz - MAP.z0) * MAP.ppm];

/** Road-following route between two world points as a polyline. */
export function routeBetween(ax, az, bx, bz) {
  const ra = nearestRoadPoint(ax, az), rb = nearestRoadPoint(bx, bz);
  if (!ra || !rb) return [[ax, az], [bx, bz]];
  const { nodes } = ROAD_GRAPH;
  // pick the edge end of each that gives the shortest total route
  let best = null;
  for (const na of [ra.edge.a, ra.edge.b]) for (const nb of [rb.edge.a, rb.edge.b]) {
    const path = findRoute(na, nb);
    if (!path) continue;
    let len = Math.hypot(nodes[na].x - ra.x, nodes[na].z - ra.z) + Math.hypot(nodes[nb].x - rb.x, nodes[nb].z - rb.z);
    for (let i = 1; i < path.length; i++) len += Math.hypot(nodes[path[i]].x - nodes[path[i - 1]].x, nodes[path[i]].z - nodes[path[i - 1]].z);
    if (!best || len < best.len) best = { len, path };
  }
  if (!best) return [[ax, az], [bx, bz]];
  const pts = [[ax, az], [ra.x, ra.z]];
  // skip the first node if we're already heading past it along the same edge
  for (const id of best.path) pts.push([nodes[id].x, nodes[id].z]);
  pts.push([rb.x, rb.z], [bx, bz]);
  return pts;
}

export const ICONS = { safehouse: '⌂', store: '$', mission: '★', hospital: '+', police: '⛨' };
export const STATIC_BLIPS = [
  { ...PLACES.safehouse, icon: 'safehouse', color: '#29e6ff', label: 'Safehouse' },
  { ...PLACES.store, icon: 'store', color: '#ffd23f', label: 'Sunny Stop' },
  { ...PLACES.hospital, icon: 'hospital', color: '#ff5566', label: 'Hospital' },
  { ...PLACES.police, icon: 'police', color: '#6ea0ff', label: 'Police' },
];
