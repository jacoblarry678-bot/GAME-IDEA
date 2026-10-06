/**
 * Ocean Mile — the first district of the fictional coastal city of Costa Vela.
 *
 * Pure data and geometry helpers (no rendering), so the simulation, AI and the
 * Node tests share one description of the world.
 *
 * Axes: +x east (towards the ocean), +z south, +y up. Units are metres.
 * The district is a barrier island: ocean and beach to the east, the bay and
 * a marina to the west, canals to the north and south, and a causeway that
 * crosses the bay westward towards the mainland.
 */

export const LANE_W = 3.5;
export const SIDEWALK_W = 4;
export const WATER_Y = -0.45;
export const CURB = 0.14; // sidewalk / lot height above the road surface

/** Avenues run north–south (constant x). Streets run east–west (constant z). */
export const AVENUES = [
  { id: 'bay', name: 'Bayshore Rd', x: -30, lanes: 1 },
  { id: 'palm', name: 'Palmetto Ave', x: 30, lanes: 1 },
  { id: 'coral', name: 'Coral Ave', x: 90, lanes: 2 },
  { id: 'ocean', name: 'Ocean Blvd', x: 150, lanes: 2 },
];
export const STREETS = [
  { id: 's1', name: '1st St', z: -240, lanes: 1 },
  { id: 's2', name: '5th St', z: -160, lanes: 1 },
  { id: 's3', name: '9th St', z: -80, lanes: 1 },
  { id: 's4', name: 'Causeway Blvd', z: 0, lanes: 2 },
  { id: 's5', name: '14th St', z: 80, lanes: 1 },
  { id: 's6', name: 'Flamingo St', z: 160, lanes: 1 },
  { id: 's7', name: 'Pointe St', z: 240, lanes: 1 },
];

export const roadHalfWidth = (lanes) => lanes * LANE_W + 0.5;
/** Half width of a road segment or graph edge (the twin-span is wider: two decks and a gap). */
export const segHalfWidth = (s) => s.hw ?? roadHalfWidth(s.lanes);

export const ISLAND = {
  west: -30 - roadHalfWidth(1) - SIDEWALK_W - 3.5, // bay seawall
  north: -240 - roadHalfWidth(1) - SIDEWALK_W - 8, // north canal seawall
  south: 240 + roadHalfWidth(1) + SIDEWALK_W + 8, // south canal seawall
  promenade: 150 + roadHalfWidth(2) + SIDEWALK_W, // beach park starts
  sandStart: 172,
  shore: 222,
};

/** The causeway: a raised bridge crossing the bay west from Causeway Blvd. */
export const CAUSEWAY = {
  z: 0,
  lanes: 2,
  xStart: ISLAND.west, // leaves the island at the seawall
  xEnd: -300, // lands on the mainland
  rampLen: 70,
  deckY: 6.5,
};
export const MAINLAND = { east: -300, west: -420, north: -70, south: 70, barrierX: -385 };

/**
 * Cayo Lento, the first of the Vela Keys (Milestone 3): a low, flat key south
 * of Ocean Mile, reached by a twin-span bridge (one deck per direction with an
 * open gap between them) that carries Ocean Blvd south over the water. The
 * shallow turquoise flats around it are swimmable, not wadeable.
 */
export const KEYS = { x0: 40, x1: 330, z0: 612, z1: 716, hwyZ: 640, shoreZ: 704, pointX: 60, marinaX: 230, name: 'Cayo Lento' };
export const TWIN = { x: 150, median: 5, deckW: 5, zStart: ISLAND.south, zEnd: KEYS.z0, rampLen: 60, deckY: 7.5 };
export const FLATS = { x0: -20, x1: 470, z0: 540, z1: 820, y: -2.4 }; // shallow water around the keys

// ---------------------------------------------------------------------------
// Terrain

/** Deck height of the causeway at x (null when x is not on the bridge span). */
export function causewayDeck(x) {
  const c = CAUSEWAY;
  if (x > c.xStart + 2 || x < c.xEnd - 2) return null;
  const fromEast = c.xStart - x;
  const fromWest = x - c.xEnd;
  const t = Math.min(1, Math.min(fromEast, fromWest) / c.rampLen);
  const s = t * t * (3 - 2 * t);
  return s * c.deckY;
}

export function onCauseway(x, z) {
  return Math.abs(z - CAUSEWAY.z) <= roadHalfWidth(CAUSEWAY.lanes) + 1.2 && causewayDeck(x) !== null;
}

/** Neighbouring land that is visible but not reachable (backdrop city). */
export const BACKDROP = {
  downtownX: -620, // everything west of this is downtown Costa Vela
  north: { x0: -200, x1: 215, z0: -1100, z1: -300 },
  south: { x0: -260, x1: -50, z0: 300, z1: 1100 }, // Vela Point; open water and the keys to its east
  // further keys of the chain, low and green, seen from Cayo Lento but not reachable
  keys: [{ x0: 430, x1: 560, z0: 600, z1: 660 }, { x0: 640, x1: 760, z0: 520, z1: 570 }, { x0: 200, x1: 300, z0: 860, z1: 905 }],
};

function beachProfile(x, z) {
  const wobble = Math.sin(z * 0.031) * 2.5 + Math.sin(z * 0.11 + 1.3) * 0.8;
  const d = x - (ISLAND.shore - 14 + wobble);
  if (d <= 0) return Math.max(-0.12, -0.0045 * (x - ISLAND.sandStart));
  return -0.12 - d * 0.055 - Math.max(0, d - 30) * 0.05;
}

export const inKeys = (x, z) => x >= KEYS.x0 && x <= KEYS.x1 && z >= KEYS.z0 && z <= KEYS.z1;

/** Natural ground / seabed height, ignoring bridges. */
export function terrainHeight(x, z) {
  // mainland stub across the bay
  if (x <= MAINLAND.east && x >= MAINLAND.west && z >= MAINLAND.north && z <= MAINLAND.south) return 0;
  if (x < BACKDROP.downtownX) return CURB;
  const n = BACKDROP.north, s = BACKDROP.south;
  if ((x > n.x0 && x < n.x1 && z < n.z1) || (x > s.x0 && x < s.x1 && z > s.z0)) return CURB;
  if (inKeys(x, z)) return roadAt(x, z) ? 0 : CURB;
  for (const k of BACKDROP.keys) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1) return CURB;
  if (x > FLATS.x0 && x < FLATS.x1 && z > FLATS.z0 && z < FLATS.z1) {
    // the flats shelve gently down from the key's shore (always deep enough to swim)
    const dx = Math.max(KEYS.x0 - x, 0, x - KEYS.x1), dz = Math.max(KEYS.z0 - z, 0, z - KEYS.z1);
    return -1.9 - Math.min(0.9, Math.hypot(dx, dz) * 0.008);
  }
  if (x < ISLAND.west || z < ISLAND.north || z > ISLAND.south) {
    if (x >= ISLAND.sandStart) return Math.min(-4.2, beachProfile(x, z));
    return -4.2; // bay and canal floor
  }
  if (x < ISLAND.sandStart) return roadAt(x, z) ? 0 : CURB;
  return beachProfile(x, z);
}

/** Can a swimmer climb out onto this land? (backdrop shores are sea walls) */
export function isClimbable(x, z) {
  for (const p of PLATFORMS) if (x >= p.x0 - 0.5 && x <= p.x1 + 0.5 && z >= p.z0 - 0.5 && z <= p.z1 + 0.5) return true; // docks and piers
  if (x <= MAINLAND.east + 1 && x >= MAINLAND.west - 1 && z >= MAINLAND.north - 1 && z <= MAINLAND.south + 1) return true;
  if (x >= KEYS.x0 - 1 && x <= KEYS.x1 + 1 && z >= KEYS.z0 - 1 && z <= KEYS.z1 + 1) return true;
  return x >= ISLAND.west - 1 && x <= 400 && z >= ISLAND.north - 1 && z <= ISLAND.south + 1;
}

/**
 * Walkable/drivable surface height under (x, z) for something currently at
 * height y: the bridge deck when the entity is at or above it, otherwise terrain.
 */
/** Raised walkable platforms over water (marina docks): {x0,x1,z0,z1,y}. */
export const PLATFORMS = [];

export function groundHeight(x, z, y = 100) {
  let t = terrainHeight(x, z);
  for (const p of PLATFORMS) {
    if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && y >= p.y - 1.2) t = Math.max(t, p.y);
  }
  if (onCauseway(x, z)) {
    const d = causewayDeck(x);
    if (y >= d - 1.2) return Math.max(d, t);
  }
  if (onTwin(x, z)) {
    const d = twinDeck(z);
    if (y >= d - 1.2) return Math.max(d, t);
  }
  return t;
}

/** Deck height of the twin-span at z (null off the span). Both decks share the profile. */
export function twinDeck(z) {
  const t = TWIN;
  if (z < t.zStart - 2 || z > t.zEnd + 2) return null;
  const k = Math.max(0, Math.min(1, Math.min(z - t.zStart, t.zEnd - z) / t.rampLen));
  return k * k * (3 - 2 * k) * t.deckY;
}

/** On one of the two decks (not in the open gap between them, not past the railings). */
export function onTwin(x, z) {
  const d = Math.abs(x - TWIN.x);
  return d >= TWIN.median / 2 - 0.4 && d <= TWIN.median / 2 + TWIN.deckW + 0.4 && twinDeck(z) !== null; // incl. the parapets
}

export function isWater(x, z) {
  return terrainHeight(x, z) < WATER_Y - 0.05 && !onCauseway(x, z) && !onTwin(x, z);
}

/** Surface type for footsteps and tyre audio. */
export function surfaceAt(x, z, y = 100) {
  if ((onCauseway(x, z) || onTwin(x, z)) && y > 0.5) return 'asphalt';
  const t = terrainHeight(x, z);
  if (t < WATER_Y) return 'water';
  if (inKeys(x, z)) return roadAt(x, z) ? 'asphalt' : z > KEYS.z1 - 10 ? 'sand' : 'grass';
  if (x >= ISLAND.sandStart && x < 400) return 'sand';
  if (roadAt(x, z)) return 'asphalt';
  return 'concrete';
}

// ---------------------------------------------------------------------------
// Road network

/** All road segments as axis-aligned strips: {axis:'x'|'z', c, from, to, lanes}. */
export function roadSegments() {
  const segs = [];
  const zMin = STREETS[0].z, zMax = STREETS[STREETS.length - 1].z;
  const xMin = AVENUES[0].x, xMax = AVENUES[AVENUES.length - 1].x;
  for (const a of AVENUES) segs.push({ id: a.id, name: a.name, dir: 'ns', c: a.x, from: zMin, to: zMax, lanes: a.lanes });
  for (const s of STREETS) segs.push({ id: s.id, name: s.name, dir: 'ew', c: s.z, from: xMin, to: xMax, lanes: s.lanes });
  // causeway continues Causeway Blvd west across the bay to the mainland
  segs.push({ id: 'causeway', name: 'Vela Causeway', dir: 'ew', c: CAUSEWAY.z, from: MAINLAND.barrierX + 12, to: xMin, lanes: 2, bridge: true });
  // Milestone 3: the twin-span south to Cayo Lento, and the key's own roads
  segs.push({ id: 'twinspan', name: 'Vela Keys Twin Span', dir: 'ns', c: TWIN.x, from: zMax, to: KEYS.hwyZ, lanes: 1, twin: true, hw: TWIN.median / 2 + TWIN.deckW });
  segs.push({ id: 'keyhwy', name: 'Overseas Rd', dir: 'ew', c: KEYS.hwyZ, from: KEYS.pointX, to: KEYS.x1 - 10, lanes: 1, keys: true });
  segs.push({ id: 'marina', name: 'Marina Rd', dir: 'ns', c: KEYS.marinaX, from: KEYS.hwyZ, to: KEYS.shoreZ, lanes: 1, keys: true });
  segs.push({ id: 'shore', name: 'Shore Rd', dir: 'ew', c: KEYS.shoreZ, from: KEYS.pointX, to: KEYS.marinaX, lanes: 1, keys: true });
  segs.push({ id: 'point', name: 'Lento Point Rd', dir: 'ns', c: KEYS.pointX, from: KEYS.hwyZ, to: KEYS.shoreZ, lanes: 1, keys: true });
  return segs;
}

/** Is (x, z) on a road surface? Returns the segment or null. */
export function roadAt(x, z) {
  for (const s of ROADS) {
    const hw = segHalfWidth(s);
    if (s.dir === 'ns') {
      if (s.twin) { const d = Math.abs(x - s.c); if (d <= hw && d >= TWIN.median / 2 && z >= s.from && z <= s.to + roadHalfWidth(1)) return s; continue; }
      if (Math.abs(x - s.c) <= hw && z >= s.from - hw && z <= s.to + hw) return s;
    } else if (Math.abs(z - s.c) <= hw && x >= s.from - hw && x <= s.to + hw) return s;
  }
  return null;
}

export const ROADS = roadSegments();

/**
 * Road graph. Nodes sit at intersections; edges join neighbouring nodes along
 * one road. Edges are undirected here; lanes are derived per travel direction.
 */
export function buildRoadGraph() {
  const nodes = [];
  const byKey = new Map();
  const addNode = (x, z, extra = {}) => {
    const k = `${x},${z}`;
    if (byKey.has(k)) return byKey.get(k);
    const n = { id: nodes.length, x, z, edges: [], signal: false, ...extra };
    nodes.push(n);
    byKey.set(k, n);
    return n;
  };
  for (const s of STREETS) for (const a of AVENUES) addNode(a.x, s.z);
  const west = addNode(MAINLAND.barrierX + 12, CAUSEWAY.z, { deadEnd: true });

  const edges = [];
  const link = (a, b, lanes, road) => {
    const e = { id: edges.length, a: a.id, b: b.id, lanes, road, len: Math.hypot(b.x - a.x, b.z - a.z) };
    edges.push(e);
    a.edges.push(e.id);
    b.edges.push(e.id);
  };
  for (const a of AVENUES) {
    for (let i = 0; i < STREETS.length - 1; i++) link(byKey.get(`${a.x},${STREETS[i].z}`), byKey.get(`${a.x},${STREETS[i + 1].z}`), a.lanes, a.id);
  }
  for (const s of STREETS) {
    for (let i = 0; i < AVENUES.length - 1; i++) link(byKey.get(`${AVENUES[i].x},${s.z}`), byKey.get(`${AVENUES[i + 1].x},${s.z}`), s.lanes, s.id);
  }
  link(byKey.get(`${AVENUES[0].x},${CAUSEWAY.z}`), west, 2, 'causeway');
  // the twin-span and Cayo Lento
  const K = KEYS;
  const kw = addNode(K.pointX, K.hwyZ, { keys: true });
  const kj = addNode(TWIN.x, K.hwyZ, { keys: true });
  const km = addNode(K.marinaX, K.hwyZ, { keys: true });
  const ke = addNode(K.x1 - 10, K.hwyZ, { deadEnd: true, keys: true });
  const kd = addNode(K.marinaX, K.shoreZ, { keys: true });
  const ks = addNode(K.pointX, K.shoreZ, { keys: true });
  link(byKey.get(`${TWIN.x},${STREETS[STREETS.length - 1].z}`), kj, 1, 'twinspan');
  Object.assign(edges[edges.length - 1], { median: TWIN.median, hw: TWIN.median / 2 + TWIN.deckW, limit: 21 });
  link(kw, kj, 1, 'keyhwy');
  link(kj, km, 1, 'keyhwy');
  link(km, ke, 1, 'keyhwy');
  link(km, kd, 1, 'marina');
  link(kd, ks, 1, 'shore');
  link(ks, kw, 1, 'point');

  for (const n of nodes) {
    n.signal = n.edges.length >= 3;
    // half-size of the intersection box: widest crossing road
    let hx = 0, hz = 0;
    for (const eid of n.edges) {
      const e = edges[eid];
      const o = nodes[e.a === n.id ? e.b : e.a];
      const hw = e.hw ?? roadHalfWidth(e.lanes);
      if (o.x !== n.x) hz = Math.max(hz, hw); else hx = Math.max(hx, hw);
    }
    n.hx = hx || 4;
    n.hz = hz || 4;
    // signal phase offset gives a loose green wave along the avenues
    n.phaseOffset = ((n.x * 0.37 + n.z * 0.11) % 30 + 30) % 30;
  }
  return { nodes, edges, byKey };
}

export const ROAD_GRAPH = buildRoadGraph();

export function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const n of ROAD_GRAPH.nodes) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/**
 * Closest point on any road edge's centreline to (x, z): {edge, t, x, z, dist}.
 */
export function nearestRoadPoint(x, z) {
  const { nodes, edges } = ROAD_GRAPH;
  let best = null;
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L2 = dx * dx + dz * dz;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t, pz = a.z + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (!best || d < best.dist) best = { edge: e, t, x: px, z: pz, dist: d };
  }
  return best;
}

/** A* over intersections. Returns a list of node ids from start to goal. */
export function findRoute(fromNodeId, toNodeId) {
  const { nodes, edges } = ROAD_GRAPH;
  const open = new Map([[fromNodeId, 0]]);
  const g = new Map([[fromNodeId, 0]]);
  const came = new Map();
  const goal = nodes[toNodeId];
  const h = (id) => Math.hypot(nodes[id].x - goal.x, nodes[id].z - goal.z);
  const closed = new Set();
  while (open.size) {
    let cur = null, cf = Infinity;
    for (const [id, f] of open) if (f < cf) { cf = f; cur = id; }
    if (cur === toNodeId) {
      const path = [cur];
      while (came.has(cur)) { cur = came.get(cur); path.unshift(cur); }
      return path;
    }
    open.delete(cur);
    closed.add(cur);
    for (const eid of nodes[cur].edges) {
      const e = edges[eid];
      const nb = e.a === cur ? e.b : e.a;
      if (closed.has(nb)) continue;
      const ng = g.get(cur) + e.len;
      if (ng < (g.get(nb) ?? Infinity)) {
        g.set(nb, ng);
        came.set(nb, cur);
        open.set(nb, ng + h(nb));
      }
    }
  }
  return null;
}

/** Traffic signal state for travel along axis ('ns' or 'ew') at time t (s). */
export const SIGNAL_CYCLE = { nsGreen: 14, yellow: 3, allRed: 1.5, ewGreen: 11 };
export function signalState(node, axis, t) {
  if (!node.signal) return 'none';
  const c = SIGNAL_CYCLE;
  const total = c.nsGreen + c.yellow + c.allRed + c.ewGreen + c.yellow + c.allRed;
  const p = ((t + node.phaseOffset) % total + total) % total;
  let ns, ew;
  if (p < c.nsGreen) { ns = 'green'; ew = 'red'; }
  else if (p < c.nsGreen + c.yellow) { ns = 'yellow'; ew = 'red'; }
  else if (p < c.nsGreen + c.yellow + c.allRed) { ns = 'red'; ew = 'red'; }
  else if (p < c.nsGreen + c.yellow + c.allRed + c.ewGreen) { ns = 'red'; ew = 'green'; }
  else if (p < total - c.allRed) { ns = 'red'; ew = 'yellow'; }
  else { ns = 'red'; ew = 'red'; }
  return axis === 'ns' ? ns : ew;
}

// ---------------------------------------------------------------------------
// Blocks between roads (buildable land)

export function blocks() {
  const out = [];
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const a0 = AVENUES[i], a1 = AVENUES[i + 1], s0 = STREETS[j], s1 = STREETS[j + 1];
      out.push({
        id: `b${i}${j}`, col: i, row: j,
        // outer edge of the sidewalk ring
        x0: a0.x + roadHalfWidth(a0.lanes), x1: a1.x - roadHalfWidth(a1.lanes),
        z0: s0.z + roadHalfWidth(s0.lanes), z1: s1.z - roadHalfWidth(s1.lanes),
      });
    }
  }
  for (const b of out) {
    // lot = inside the sidewalk
    b.lx0 = b.x0 + SIDEWALK_W; b.lx1 = b.x1 - SIDEWALK_W;
    b.lz0 = b.z0 + SIDEWALK_W; b.lz1 = b.z1 - SIDEWALK_W;
  }
  return out;
}
export const BLOCKS = blocks();
export const blockAt = (col, row) => BLOCKS.find((b) => b.col === col && b.row === row);

// ---------------------------------------------------------------------------
// Named places. Positions are filled in by the district plan (district.js).

export const DISTRICT_NAME = 'Ocean Mile';
export const CITY_NAME = 'Costa Vela';
