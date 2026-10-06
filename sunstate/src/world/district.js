/**
 * District plan for Ocean Mile: which building stands on which lot, the named
 * landmarks the game refers to, interiors, parking and street furniture.
 * Deterministic (seeded) so collision, AI, minimap and meshes always agree.
 */
import { AVENUES, STREETS, BLOCKS, blockAt, roadHalfWidth, SIDEWALK_W, ISLAND, CAUSEWAY, MAINLAND, ROAD_GRAPH, PLATFORMS } from './layout.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PASTELS = [0xf2b5c4, 0x9fd8d0, 0xf7e3a1, 0xc8b6e8, 0xa9d4f0, 0xf5c79a, 0xf4f1e8, 0xb8e0b0, 0xfad0dc];
const DECO_ACCENT = [0x2bb8c9, 0xe0567f, 0x6f5bd6, 0xf2a03d, 0x38a86b];
const NEON = [0xff3fa4, 0x29e6ff, 0xb455ff, 0xffd23f, 0x49ff9a];
const HOTEL_NAMES = ['The Coraline', 'Hotel Seabright', 'Flamingo Arms', 'Starlite', 'Hotel Paloma', 'The Bellmar', 'Aurora', 'Sunrise Court', 'Hotel Marivel', 'The Tradewind'];
const SHOP_NAMES = ['Palmetto Pawn', 'Cafecito Ocho', 'Surf & Sundry', 'Lucky Lotto Liquor', 'Botánica Luz', 'Coral Laundromat', 'Pastelito Bakery', 'Mango Juice Bar', 'Ink & Tide Tattoo', 'Vela Phone Repair', 'Swim Shack', 'Bodega Esperanza', 'Cheque Cashing', 'Shell Gifts'];

/** Named places used by missions, respawns, HUD blips and the save system. */
export const PLACES = {};
/** Enterable interiors (walls are real colliders; camera clamps to the ceiling). */
export const INTERIORS = [];

function plan() {
  const rnd = mulberry32(20261119);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const buildings = [];
  const props = [];
  const parking = []; // {x, z, rot, model?, owned?}
  const lots = []; // paved parking lot rects
  let hotelI = 0, shopI = 0;

  const add = (b) => { buildings.push({ color: pick(PASTELS), accent: pick(DECO_ACCENT), neon: pick(NEON), ...b }); return b; };

  // --- special blocks -------------------------------------------------------
  const special = new Set();

  // Safehouse: the Bayside Motel (Bayshore/Palmetto, 9th St to Causeway Blvd)
  {
    const b = blockAt(0, 2); special.add(b.id);
    // L-shaped two-storey motel along the west and north edges, lot opening east
    add({ x0: b.lx0, x1: b.lx0 + 12, z0: b.lz0, z1: b.lz1, h: 7.5, style: 'motel', color: 0xf3e6c8, accent: 0x2bb8c9, frontage: 'e', sign: 'BAYSIDE MOTEL', neon: 0x29e6ff });
    add({ x0: b.lx0 + 12, x1: b.lx1 - 8, z0: b.lz0, z1: b.lz0 + 11, h: 7.5, style: 'motel', color: 0xf3e6c8, accent: 0x2bb8c9, frontage: 's', neon: 0x29e6ff });
    lots.push({ x0: b.lx0 + 12, x1: b.lx1, z0: b.lz0 + 11, z1: b.lz1 });
    const doorX = b.lx0 + 12, doorZ = -30;
    PLACES.safehouse = { name: 'Bayside Motel, Room 12', x: doorX + 1.6, z: doorZ, door: { x: doorX, z: doorZ }, facing: Math.PI / 2, spawn: { x: doorX + 2.2, z: doorZ, rot: Math.PI / 2 } };
    // the two starting cars, parked nose-in facing the motel
    parking.push({ x: doorX + 8, z: doorZ - 6, rot: -Math.PI / 2, model: 'kestrel', color: 0x8fb7c9, owned: true, id: 'start-sedan' });
    parking.push({ x: doorX + 8, z: doorZ + 6, rot: -Math.PI / 2, model: 'ironhorse', color: 0xb5332e, owned: true, id: 'start-muscle' });
    parking.push({ x: doorX + 8, z: doorZ + 18, rot: -Math.PI / 2, model: 'kestrel', color: 0xd9d4c7 });
    parking.push({ x: doorX + 20, z: doorZ - 6, rot: Math.PI / 2, model: 'pickup', color: 0x3d5a73 });
    parking.push({ x: doorX + 20, z: doorZ + 18, rot: Math.PI / 2, model: 'kestrel', color: 0x2f2f33 });
    props.push({ type: 'pylonSign', x: b.lx1 - 2, z: b.lz1 - 3, text: 'BAYSIDE MOTEL', color: 0x29e6ff });
  }

  // Convenience store: Sunny Stop, corner of 14th St and Coral Ave (enterable)
  {
    const b = blockAt(1, 4); special.add(b.id);
    const sx0 = b.lx1 - 22, sx1 = b.lx1, sz0 = b.lz0 + 8, sz1 = b.lz0 + 28;
    add({ x0: sx0, x1: sx1, z0: sz0, z1: sz1, h: 5, style: 'store', color: 0xf6f1e4, accent: 0xe8a228, frontage: 'n', sign: 'SUNNY STOP', neon: 0xffd23f, interior: true, door: { x: (sx0 + sx1) / 2 - 3, w: 3.2 } });
    lots.push({ x0: sx0 - 2, x1: sx1, z0: b.lz0, z1: sz0 });
    INTERIORS.push({ id: 'store', name: 'Sunny Stop', x0: sx0, x1: sx1, z0: sz0, z1: sz1, ceiling: 4.2, door: { x: (sx0 + sx1) / 2 - 3, z: sz0, w: 3.2, side: 'n' } });
    const cx = (sx0 + sx1) / 2;
    PLACES.store = {
      name: 'Sunny Stop', x: cx - 3, z: sz0 - 3, door: { x: cx - 3, z: sz0 },
      clerk: { x: sx1 - 3.2, z: sz0 + 6, rot: -Math.PI / 2 }, // behind the counter, facing west
      counter: { x0: sx1 - 5.2, x1: sx1 - 4.4, z0: sz0 + 2.5, z1: sz0 + 10 },
      register: { x: sx1 - 4.8, z: sz0 + 6 },
      bounds: { x0: sx0, x1: sx1, z0: sz0, z1: sz1 },
    };
    parking.push({ x: sx0 + 2, z: b.lz0 + 3.5, rot: 0, model: 'kestrel', color: 0x6c7a52 });
    // rest of the block: shops along Palmetto
    fillStrip(b.lx0, b.lx0 + 17, b.lz0, b.lz1, 'w');
    fillStrip(sx0, b.lx1, sz1 + 6, b.lz1, 'e');
  }

  // Hospital (wasted respawn)
  {
    const b = blockAt(0, 0); special.add(b.id);
    add({ x0: b.lx0 + 2, x1: b.lx1 - 2, z0: b.lz0 + 14, z1: b.lz1 - 2, h: 22, style: 'civic', color: 0xeef0ee, accent: 0x2b7fd1, frontage: 'e', sign: 'OCEAN MERCY MEDICAL', neon: 0xff4455 });
    lots.push({ x0: b.lx0, x1: b.lx1, z0: b.lz0, z1: b.lz0 + 14 });
    PLACES.hospital = { name: 'Ocean Mercy Medical', x: 0, z: b.lz0 + 8, rot: Math.PI };
  }

  // Police precinct (busted respawn)
  {
    const b = blockAt(0, 5); special.add(b.id);
    add({ x0: b.lx0 + 2, x1: b.lx1 - 2, z0: b.lz0 + 2, z1: b.lz1 - 16, h: 11, style: 'civic', color: 0xdcd6c8, accent: 0x1f3c78, frontage: 'e', sign: 'OMPD PRECINCT 3', neon: 0x3a7bff });
    lots.push({ x0: b.lx0, x1: b.lx1, z0: b.lz1 - 16, z1: b.lz1 });
    PLACES.police = { name: 'OMPD Precinct 3', x: 0, z: b.lz1 - 8, rot: 0 };
    for (let i = 0; i < 4; i++) parking.push({ x: b.lx0 + 6 + i * 6, z: b.lz1 - 8, rot: 0, model: 'police', color: 0xffffff, police: true });
  }

  // Tidewater Diner + nightclub + garage frontages are placed in generic strips
  // with fixed names so they read as landmarks.
  const named = {
    'b11': { e: 'Coral Auto Body' },
    'b12': { w: 'Tidewater Diner' },
    'b23': { e: 'Club Halcyon' },
  };

  // --- generic blocks ------------------------------------------------------
  for (const b of BLOCKS) {
    if (special.has(b.id)) continue;
    const mid = (b.lx0 + b.lx1) / 2;
    if (b.col === 2) {
      // ocean side: towers in the north, art deco hotels further south
      if (b.row <= 1) {
        add({ x0: mid + 2, x1: b.lx1, z0: b.lz0 + 6, z1: b.lz0 + 30, h: 46 + rnd() * 24, style: 'tower', color: b.row ? 0xf5f2ea : 0xe6eef3, accent: 0x2f6f8f, frontage: 'e' });
        add({ x0: mid + 2, x1: b.lx1, z0: b.lz0 + 36, z1: b.lz1 - 2, h: 30 + rnd() * 20, style: 'tower', color: 0xf3efe2, accent: 0x9fd8d0, frontage: 'e' });
        fillStrip(b.lx0, mid - 4, b.lz0, b.lz1, 'w', named[b.id]?.w);
      } else {
        fillStrip(mid + 1, b.lx1, b.lz0, b.lz1, 'e', named[b.id]?.e, 'deco');
        fillStrip(b.lx0, mid - 5, b.lz0, b.lz1, 'w', named[b.id]?.w);
      }
    } else if (b.col === 1) {
      fillStrip(mid + 2, b.lx1, b.lz0, b.lz1, 'e', named[b.id]?.e);
      fillStrip(b.lx0, mid - 4, b.lz0, b.lz1, 'w', named[b.id]?.w);
    } else {
      // residential: low apartments with a parking court
      fillStrip(b.lx0, b.lx0 + 14, b.lz0, b.lz1, 'w', null, 'residential');
      fillStrip(b.lx1 - 14, b.lx1, b.lz0, b.lz1, 'e', null, 'residential');
      lots.push({ x0: b.lx0 + 14, x1: b.lx1 - 14, z0: b.lz0 + 4, z1: b.lz1 - 4 });
      const n = Math.floor((b.lz1 - b.lz0 - 12) / 6.5);
      for (let i = 0; i < n; i++) if (rnd() < 0.45) parking.push({ x: b.lx0 + 18, z: b.lz0 + 9 + i * 6.5, rot: Math.PI / 2, model: rnd() < 0.3 ? 'pickup' : 'kestrel', color: pick([0x2f2f33, 0xd9d4c7, 0x7a1f24, 0x3d5a73, 0x8b8f94, 0xe8e2d0, 0x1f4b3a]) });
    }
  }

  /** Divide a strip of land into frontage buildings facing `face`. */
  function fillStrip(x0, x1, z0, z1, face, landmark, styleOverride) {
    let z = z0;
    let first = true;
    while (z1 - z > 8) {
      let w = 12 + Math.floor(rnd() * 10);
      if (z1 - z - w < 10) w = z1 - z;
      const style = styleOverride || (rnd() < 0.15 ? 'gap' : 'shop');
      const zz0 = z, zz1 = z + w - (rnd() < 0.3 ? 2.5 : 0);
      if (style === 'gap' && !first) {
        // small surface lot / courtyard between buildings
        lots.push({ x0, x1, z0: zz0, z1: zz1 });
      } else if (style === 'deco') {
        const name = landmark && first ? landmark : HOTEL_NAMES[hotelI++ % HOTEL_NAMES.length];
        add({ x0, x1, z0: zz0, z1: zz1, h: 12 + Math.floor(rnd() * 4) * 3.4, style: 'deco', frontage: face, sign: name, club: name === 'Club Halcyon' });
      } else if (style === 'residential') {
        add({ x0, x1, z0: zz0, z1: zz1, h: 7 + Math.floor(rnd() * 3) * 3.2, style: 'residential', frontage: face });
      } else {
        const name = landmark && first ? landmark : (rnd() < 0.75 ? SHOP_NAMES[shopI++ % SHOP_NAMES.length] : null);
        add({ x0, x1, z0: zz0, z1: zz1, h: 7 + Math.floor(rnd() * 4) * 3.2, style: 'shop', frontage: face, sign: name, diner: name === 'Tidewater Diner', garage: name === 'Coral Auto Body' });
      }
      first = false;
      z += w;
    }
  }

  // --- street furniture ------------------------------------------------------
  const { nodes } = ROAD_GRAPH;
  // street lights along every road, both sides on avenues
  for (const a of AVENUES) {
    const off = roadHalfWidth(a.lanes) + 0.8;
    for (let z = STREETS[0].z + 14; z < STREETS[STREETS.length - 1].z; z += 26) {
      if (!nearAnyStreet(z, 9)) props.push({ type: 'streetlight', x: a.x - off, z, rot: Math.PI / 2 });
      if (!nearAnyStreet(z + 13, 9)) props.push({ type: 'streetlight', x: a.x + off, z: z + 13, rot: -Math.PI / 2 });
    }
  }
  for (const s of STREETS) {
    const off = roadHalfWidth(s.lanes) + 0.8;
    for (let x = AVENUES[0].x + 14; x < AVENUES[AVENUES.length - 1].x; x += 28) {
      if (nearAnyAvenue(x, 9)) continue;
      props.push({ type: 'streetlight', x, z: s.z + off, rot: Math.PI });
    }
  }
  // causeway lights on both railings
  for (let x = CAUSEWAY.xStart - 10; x > CAUSEWAY.xEnd + 6; x -= 30) {
    props.push({ type: 'streetlight', x, z: CAUSEWAY.z - roadHalfWidth(2) - 0.6, rot: 0, bridge: true });
    props.push({ type: 'streetlight', x: x - 15, z: CAUSEWAY.z + roadHalfWidth(2) + 0.6, rot: Math.PI, bridge: true });
  }
  // traffic signals at every signalised corner
  for (const n of nodes) {
    if (!n.signal) continue;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      props.push({ type: 'signal', x: n.x + sx * (n.hx + 2.6), z: n.z + sz * (n.hz + 2.6), node: n.id, corner: `${sx},${sz}` }); // set back from the kerb so turning cars clear it
    }
  }
  // palms: Ocean Blvd promenade and beach park, plus avenue sidewalks
  for (let z = ISLAND.north + 12; z < ISLAND.south - 10; z += 9 + rnd() * 4) {
    props.push({ type: 'palm', x: ISLAND.promenade + 2.5 + rnd() * 1.5, z, h: 8 + rnd() * 5, lean: rnd() });
    if (rnd() < 0.8) props.push({ type: 'palm', x: ISLAND.promenade + 9 + rnd() * 9, z: z + rnd() * 5, h: 7 + rnd() * 6, lean: rnd() });
    if (rnd() < 0.35) props.push({ type: 'palm', x: ISLAND.sandStart + 2 + rnd() * 6, z: z + 2, h: 9 + rnd() * 5, lean: rnd() });
  }
  for (const a of [AVENUES[2], AVENUES[3]]) {
    const off = roadHalfWidth(a.lanes) + 2.6;
    for (let z = STREETS[0].z + 20; z < STREETS[STREETS.length - 1].z; z += 17) {
      if (nearAnyStreet(z, 10)) continue;
      if (a.id === 'coral') props.push({ type: 'palm', x: a.x + (rnd() < 0.5 ? -off : off), z, h: 7 + rnd() * 4, lean: rnd() * 0.5 });
      else props.push({ type: 'palm', x: a.x - off, z: z + 6, h: 8 + rnd() * 4, lean: rnd() * 0.4 });
    }
  }
  for (let z = STREETS[0].z + 10; z < STREETS[6].z; z += 22) if (!nearAnyStreet(z, 10)) props.push({ type: 'palm', x: ISLAND.west + 1.6, z, h: 7 + rnd() * 4, lean: rnd() * 0.5 });

  // sidewalk clutter
  for (const b of BLOCKS) {
    for (let i = 0; i < 6; i++) {
      const side = Math.floor(rnd() * 4);
      const t = 0.15 + rnd() * 0.7;
      let x, z, rot;
      if (side === 0) { x = b.x0 + 1.2; z = b.z0 + (b.z1 - b.z0) * t; rot = Math.PI / 2; }
      else if (side === 1) { x = b.x1 - 1.2; z = b.z0 + (b.z1 - b.z0) * t; rot = -Math.PI / 2; }
      else if (side === 2) { z = b.z0 + 1.2; x = b.x0 + (b.x1 - b.x0) * t; rot = 0; }
      else { z = b.z1 - 1.2; x = b.x0 + (b.x1 - b.x0) * t; rot = Math.PI; }
      props.push({ type: pick(['bench', 'bin', 'hydrant', 'newsbox', 'bin', 'bench', 'planter']), x, z, rot });
    }
  }

  // beach: umbrella clusters (blue north, yellow centre, pink south), loungers, lifeguard towers
  const beachX0 = ISLAND.sandStart + 10, beachX1 = ISLAND.shore - 10;
  const clusters = [
    { z0: ISLAND.north + 30, z1: -150, color: 0x3d7fd9 },
    { z0: -110, z1: 10, color: 0xf2bf2f },
    { z0: 40, z1: 150, color: 0xf2bf2f },
    { z0: 175, z1: ISLAND.south - 25, color: 0xf06fa8 },
  ];
  for (const c of clusters) {
    for (let z = c.z0; z < c.z1; z += 5.5) {
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.45) continue;
        const x = beachX0 + 6 + k * 6 + rnd() * 2;
        props.push({ type: 'umbrella', x, z: z + rnd() * 1.5, color: c.color });
        if (rnd() < 0.8) props.push({ type: 'lounger', x: x + 1.2, z: z + 0.6, rot: Math.PI / 2 + (rnd() - 0.5) * 0.3 });
      }
    }
  }
  const towerColors = [0x7ad3c9, 0xf6a6c1, 0xf7d36b, 0xa98fe0, 0xff9b6a, 0x8fd6f5];
  let tc = 0;
  for (let z = ISLAND.north + 50; z < ISLAND.south - 20; z += 85) props.push({ type: 'lifeguard', x: beachX1 - 6, z, rot: -Math.PI / 2, color: towerColors[tc++ % towerColors.length] });
  // a beach volleyball net and an outdoor workout area for later activities
  props.push({ type: 'volley', x: beachX0 + 26, z: 60, rot: 0 });
  props.push({ type: 'gym', x: ISLAND.promenade + 12, z: -40 });
  PLACES.beachGym = { name: 'Ocean Mile Outdoor Gym', x: ISLAND.promenade + 12, z: -40 };

  // marina docks on the bay side (decorative boats moored)
  for (const z of [-200, -130, -60, 60, 130]) {
    props.push({ type: 'dock', x: ISLAND.west - 11, z, len: 22 });
    PLATFORMS.push({ x0: ISLAND.west - 22, x1: ISLAND.west + 0.2, z0: z - 1.5, z1: z + 1.5, y: 0.1 });
    props.push({ type: 'boat', x: ISLAND.west - 14, z: z + 5, rot: Math.PI / 2 + (rnd() - 0.5) * 0.2, color: pick([0xffffff, 0xf1efe8, 0x1d3557]) });
    if (rnd() < 0.7) props.push({ type: 'boat', x: ISLAND.west - 22, z: z - 5, rot: Math.PI / 2, color: 0xffffff });
  }
  // mainland construction barrier at the end of the causeway
  for (let z = -14; z <= 14; z += 2.4) props.push({ type: 'barrier', x: MAINLAND.barrierX, z, rot: Math.PI / 2 });
  props.push({ type: 'roadSign', x: MAINLAND.barrierX + 3, z: -12, text: 'ROAD CLOSED — MAINLAND EXPRESSWAY UNDER CONSTRUCTION' });

  return { buildings, props, parking, lots };
}

function nearAnyStreet(z, d) { return STREETS.some((s) => Math.abs(s.z - z) < d + roadHalfWidth(s.lanes)); }
function nearAnyAvenue(x, d) { return AVENUES.some((a) => Math.abs(a.x - x) < d + roadHalfWidth(a.lanes)); }

export const DISTRICT = plan();

/** Pedestrian sidewalk graph: a loop around each block plus crosswalks. */
export function buildSidewalkGraph() {
  const nodes = [];
  const key = new Map();
  const addNode = (x, z) => {
    const k = `${Math.round(x * 10)},${Math.round(z * 10)}`;
    if (key.has(k)) return key.get(k);
    const n = { id: nodes.length, x, z, links: [] };
    nodes.push(n); key.set(k, n);
    return n;
  };
  const link = (a, b, crossing = false) => {
    if (a === b) return;
    a.links.push({ to: b.id, crossing });
    b.links.push({ to: a.id, crossing });
  };
  const corners = new Map();
  for (const b of BLOCKS) {
    const inset = 1.6;
    const c = [addNode(b.x0 + inset, b.z0 + inset), addNode(b.x1 - inset, b.z0 + inset), addNode(b.x1 - inset, b.z1 - inset), addNode(b.x0 + inset, b.z1 - inset)];
    for (let i = 0; i < 4; i++) link(c[i], c[(i + 1) % 4]);
    corners.set(b.id, c);
  }
  // crosswalks between neighbouring blocks
  for (const b of BLOCKS) {
    const c = corners.get(b.id);
    const east = blockAt(b.col + 1, b.row), south = blockAt(b.col, b.row + 1);
    if (east) { const e = corners.get(east.id); link(c[1], e[0], true); link(c[2], e[3], true); }
    if (south) { const s = corners.get(south.id); link(c[3], s[0], true); link(c[2], s[1], true); }
  }
  return { nodes };
}
export const SIDEWALKS = buildSidewalkGraph();

/** Rectangles where beach-goers wander and lounge. */
export const BEACH_ZONE = { x0: ISLAND.sandStart + 6, x1: ISLAND.shore - 8, z0: ISLAND.north + 20, z1: ISLAND.south - 20 };
export const PROMENADE_ZONE = { x0: ISLAND.promenade + 1, x1: ISLAND.sandStart - 1, z0: ISLAND.north + 10, z1: ISLAND.south - 10 };

export { SIDEWALK_W };
