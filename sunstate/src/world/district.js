/**
 * District plan for Ocean Mile: which building stands on which lot, the named
 * landmarks the game refers to, interiors, parking and street furniture.
 * Deterministic (seeded) so collision, AI, minimap and meshes always agree.
 */
import { AVENUES, STREETS, BLOCKS, blockAt, roadHalfWidth, SIDEWALK_W, ISLAND, CAUSEWAY, MAINLAND, ROAD_GRAPH, PLATFORMS, KEYS, TWIN, BACKDROP } from './layout.js';

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

  // --- Milestone 3: more places to go --------------------------------------------
  // Bayshore Park: lawns, paths, a fountain, a basketball court, shade trees
  {
    const b = blockAt(0, 3); special.add(b.id);
    const cx = (b.lx0 + b.lx1) / 2, cz = (b.lz0 + b.lz1) / 2;
    PLACES.park = { name: 'Bayshore Park', x: cx, z: cz, fountain: { x: cx, z: cz + 4 }, court: { x0: b.lx0 + 2.5, x1: b.lx0 + 17.5, z0: b.lz0 + 3, z1: b.lz0 + 27 }, bounds: { x0: b.lx0, x1: b.lx1, z0: b.lz0, z1: b.lz1 } };
    props.push({ type: 'fountain', x: cx, z: cz + 4 });
    for (const z of [PLACES.park.court.z0 + 1.2, PLACES.park.court.z1 - 1.2]) props.push({ type: 'hoop', x: (PLACES.park.court.x0 + PLACES.park.court.x1) / 2, z, rot: z < cz ? 0 : Math.PI });
    for (let i = 0; i < 16; i++) {
      const x = b.lx0 + 3 + rnd() * (b.lx1 - b.lx0 - 6), z = b.lz0 + 3 + rnd() * (b.lz1 - b.lz0 - 6);
      if (Math.abs(x - cx) < 3.5 || Math.abs(z - (cz + 4)) < 3.5 || Math.hypot(x - cx, z - cz - 4) < 7) continue; // paths and fountain
      if (x < PLACES.park.court.x1 + 2 && z < PLACES.park.court.z1 + 2) continue; // the court
      props.push(rnd() < 0.55 ? { type: 'tree', x, z, s: 0.8 + rnd() * 0.6 } : { type: 'palm', x, z, h: 7 + rnd() * 4, lean: rnd() * 0.4 });
    }
    for (const [x, z, rot] of [[cx - 3, cz - 12, Math.PI / 2], [cx + 3, cz - 12, -Math.PI / 2], [cx - 3, cz + 20, Math.PI / 2], [cx + 3, cz + 20, -Math.PI / 2], [cx + 10, cz + 2, 0], [cx - 10, cz + 6, Math.PI]]) props.push({ type: 'bench', x, z, rot });
  }

  // Bayfront Arms (gun shop), Palmetto Ave between 1st and 5th
  const shopFront = (b, face, x0, x1, z0, z1, extra) => add({ x0, x1, z0, z1, h: 7.4, style: 'shop', frontage: face, ...extra });
  {
    const b = blockAt(1, 0); special.add(b.id);
    const mid = (b.lx0 + b.lx1) / 2;
    shopFront(b, 'w', b.lx0, mid - 4, b.lz0, b.lz0 + 20, { sign: 'BAYFRONT ARMS', color: 0x5a6470, accent: 0x7a1f24 });
    PLACES.gunshop = { name: 'Bayfront Arms', door: { x: b.lx0 - 1.6, z: b.lz0 + 10 }, staff: { x: b.lx0 - 0.9, z: b.lz0 + 13.5, rot: -Math.PI / 2 } };
    fillStrip(b.lx0, mid - 4, b.lz0 + 22, b.lz1, 'w');
    fillStrip(mid + 2, b.lx1, b.lz0, b.lz1, 'e');
  }

  // Block (1,1): Coral Auto Body (drive-in garage), Threads on 5th (clothes), Sunshine Gas
  {
    const b = blockAt(1, 1); special.add(b.id);
    const mid = (b.lx0 + b.lx1) / 2;
    const gz0 = b.lz0, gz1 = b.lz0 + 18, bay = { z0: gz0 + 5, z1: gz0 + 13 };
    add({ x0: mid + 2, x1: b.lx1, z0: gz0, z1: gz1, h: 7, style: 'garage', frontage: 'e', sign: 'CORAL AUTO BODY', color: 0xdedad0, accent: 0x2b7fd1, bay });
    PLACES.autoshop = { name: 'Coral Auto Body', door: { x: b.lx1 + 2, z: (bay.z0 + bay.z1) / 2 }, bay: { x0: mid + 3, x1: b.lx1 + 1, z0: bay.z0 + 0.3, z1: bay.z1 - 0.3 }, staff: { x: b.lx1 + 0.8, z: bay.z1 + 1.6, rot: Math.PI / 2 } };
    fillStrip(mid + 2, b.lx1, gz1 + 2, b.lz1 - 26, 'e');
    shopFront(b, 'w', b.lx0, mid - 4, b.lz0, b.lz0 + 18, { sign: 'THREADS ON 5TH', color: 0xf6d6c2, accent: 0x6f5bd6 });
    PLACES.clothes = { name: 'Threads on 5th', door: { x: b.lx0 - 1.6, z: b.lz0 + 9 }, staff: { x: b.lx0 - 0.9, z: b.lz0 + 12.5, rot: -Math.PI / 2 } };
    fillStrip(b.lx0, mid - 4, b.lz0 + 20, b.lz1 - 26, 'w');
    // Sunshine Gas across the south end of the block, open to Coral Ave and 9th St
    const sz0 = b.lz1 - 24, sz1 = b.lz1;
    lots.push({ x0: b.lx0 + 12, x1: b.lx1, z0: sz0, z1: sz1 });
    add({ x0: b.lx0, x1: b.lx0 + 12, z0: sz0 + 2, z1: sz1 - 4, h: 4.6, style: 'shop', frontage: 'e', sign: 'SUNSHINE GAS', color: 0xf7e3a1, accent: 0xe86b2a });
    props.push({ type: 'canopy', x: b.lx1 - 11, z: (sz0 + sz1) / 2, w: 14, d: 9, color: 0xf2a03d });
    for (const x of [b.lx1 - 15, b.lx1 - 7]) props.push({ type: 'pump', x, z: (sz0 + sz1) / 2 });
    PLACES.gas = { name: 'Sunshine Gas', door: { x: b.lx0 + 13.6, z: (sz0 + sz1) / 2 - 1 }, staff: { x: b.lx0 + 12.9, z: (sz0 + sz1) / 2 + 2.5, rot: Math.PI / 2 } };
  }

  // Velvet Palms (adults-only club, enterable), Coral Ave side of the Club Halcyon block.
  // Entrance on Coral Ave looks straight down the runway to the stage; the bar runs
  // along the north wall, the DJ booth sits in the north-east corner, booths line
  // the south wall. Everything here is shared by the mesh builder and the club runtime.
  {
    const b = blockAt(2, 3); special.add(b.id);
    const mid = (b.lx0 + b.lx1) / 2;
    const x0 = b.lx0, x1 = mid - 1, z0 = b.lz0, z1 = b.lz0 + 26, w = 0.3, y = 0.14, doorZ = z0 + 13;
    const I = { x0: x0 + w, x1: x1 - w, z0: z0 + w, z1: z1 - w }; // inside faces of the walls
    const L = {
      inner: I, ceiling: y + 5.2, wall: w,
      door: { x: x0, z: doorZ, w: 2.4, h: 3 },
      stage: { x0: I.x1 - 5.6, x1: I.x1, z0: doorZ - 6.5, z1: doorZ + 6.5, y: y + 0.7 },
      runway: { x0: I.x1 - 12, x1: I.x1 - 5.6, z0: doorZ - 1.2, z1: doorZ + 1.2, y: y + 0.7 },
      poles: [{ x: I.x1 - 11.1, z: doorZ }, { x: I.x1 - 2.8, z: doorZ - 3.8 }, { x: I.x1 - 2.8, z: doorZ + 3.8 }],
      bar: { x0: x0 + 3, x1: x0 + 11.5, z0: I.z0 + 1.6, z1: I.z0 + 2.4 },
      dj: { x0: I.x1 - 3.4, x1: I.x1, z0: I.z0, z1: I.z0 + 3.4, y: y + 0.45 },
      booths: [],
      tables: [{ x: x0 + 3.4, z: doorZ - 5.2 }, { x: x0 + 3.4, z: doorZ + 5.2 }, { x: x0 + 8.2, z: doorZ + 6 }, { x: x0 + 8.2, z: doorZ - 6 }],
      stools: [],
    };
    for (let k = 0; k < 4; k++) {
      const bw = (I.x1 - I.x0) / 4;
      L.booths.push({ x0: I.x0 + k * bw + 0.25, x1: I.x0 + (k + 1) * bw - 0.25, z0: I.z1 - 2.7, z1: I.z1, vip: k === 3 });
    }
    for (let x = L.bar.x0 + 0.7; x < L.bar.x1 - 0.4; x += 1.25) L.stools.push({ x, z: L.bar.z1 + 0.65, bar: true });
    for (let x = L.runway.x0 + 1.4; x < L.runway.x1 - 0.2; x += 1.5) for (const side of [-1, 1]) L.stools.push({ x, z: doorZ + side * 1.95, face: -side });
    add({ x0, x1, z0, z1, h: 9.8, style: 'club', frontage: 'w', sign: 'Velvet Palms', color: 0x3a2347, accent: 0xb455ff, neon: 0xff3fa4, layout: L });
    INTERIORS.push({ id: 'club', name: 'Velvet Palms', x0, x1, z0, z1, ceiling: L.ceiling, door: { x: x0, z: doorZ, w: L.door.w, side: 'w' } });
    for (const r of [L.stage, L.runway]) PLATFORMS.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y: r.y, indoor: true });
    PLATFORMS.push({ x0: L.dj.x0, x1: L.dj.x1, z0: L.dj.z0, z1: L.dj.z1, y: L.dj.y, indoor: true });
    const vip = L.booths[3];
    PLACES.club = { name: 'Velvet Palms', door: { x: x0 - 1.6, z: doorZ - 2.2 }, staff: { x: x0 - 0.9, z: doorZ + 2.0, rot: -Math.PI / 2 }, layout: L, bounds: { x0, x1, z0, z1 } };
    // the counters inside (the Places menus): the bar, the DJ booth, the VIP host, the stage rail
    PLACES.clubbar = { name: 'The bar', door: { x: (L.bar.x0 + L.bar.x1) / 2, z: L.bar.z1 + 0.9 }, staff: { x: (L.bar.x0 + L.bar.x1) / 2, z: I.z0 + 0.85, rot: 0 } };
    PLACES.clubdj = { name: 'DJ booth', door: { x: L.dj.x0 - 0.9, z: L.dj.z0 + 1.9 }, staff: { x: L.dj.x0 + 1.9, z: L.dj.z0 + 1.5, rot: -Math.PI / 2 } };
    PLACES.clubvip = { name: 'VIP booth', door: { x: (vip.x0 + vip.x1) / 2 - 1.2, z: vip.z0 - 1.0 }, staff: { x: vip.x0 - 0.2, z: vip.z0 - 0.7, rot: Math.PI / 4 } };
    PLACES.clubstage = { name: 'The stage', door: { x: L.runway.x0 - 0.8, z: doorZ }, staff: null };
    fillStrip(b.lx0, x1, z1 + 2, b.lz1, 'w');
    fillStrip(mid + 1, b.lx1, b.lz0, b.lz1, 'e', 'Club Halcyon', 'deco');
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
  planKeys({ add, props, parking, lots, rnd, pick });

  // mainland construction barrier at the end of the causeway
  for (let z = -14; z <= 14; z += 2.4) props.push({ type: 'barrier', x: MAINLAND.barrierX, z, rot: Math.PI / 2 });
  props.push({ type: 'roadSign', x: MAINLAND.barrierX + 3, z: -12, text: 'ROAD CLOSED — MAINLAND EXPRESSWAY UNDER CONSTRUCTION' });

  // keep shop doors, the garage bay mouth and the gas station entrances clear of street furniture
  const clear = [];
  for (const k of ['gunshop', 'clothes', 'gas', 'club', 'autoshop']) {
    const P = PLACES[k];
    clear.push({ x0: P.door.x - 3, x1: P.door.x + 3, z0: P.door.z - 3.5, z1: P.door.z + 3.5 });
    clear.push({ x0: P.staff.x - 1.5, x1: P.staff.x + 1.5, z0: P.staff.z - 1.5, z1: P.staff.z + 1.5 });
  }
  const A = PLACES.autoshop.bay; clear.push({ x0: A.x1 - 2, x1: A.x1 + 6, z0: A.z0 - 2, z1: A.z1 + 2 });
  const gb = blockAt(1, 1); clear.push({ x0: gb.lx1 - 2, x1: gb.x1 + 1, z0: gb.lz1 - 24, z1: gb.lz1 }, { x0: gb.lx0 + 12, x1: gb.lx1, z0: gb.lz1 - 1, z1: gb.z1 + 1 });
  const kept = props.filter((p) => p.bridge || !['streetlight', 'bench', 'bin', 'hydrant', 'newsbox', 'planter', 'palm', 'tree'].includes(p.type) || !clear.some((c) => p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1));
  return { buildings, props: kept, parking, lots };
}

/**
 * Cayo Lento (Milestone 3): a bait-and-fuel stop, stilt houses, a dive bar,
 * an RV park, a marina with a long pier, mangroves, and the closed old bridge
 * east toward the rest of the chain. Names and businesses are invented.
 */
function planKeys({ add, props, parking, lots, rnd, pick }) {
  const K = KEYS, hz = K.hwyZ, rw = roadHalfWidth(1);
  const north0 = K.z0 + 3, north1 = hz - rw - 2; // strip between the north shore and the highway
  const south0 = hz + rw + 2; // south side starts here
  const STILT = [0xf3e6c8, 0xbfe3e0, 0xf6d6c2, 0xe8eef0, 0xd8e6c4, 0xf2d7e0];
  // Lento Bait & Fuel, west of the bridge landing
  add({ x0: 112, x1: 128, z0: north0 + 1, z1: north0 + 13, h: 5, style: 'shop', color: 0xf4efe2, accent: 0x2b7fd1, frontage: 's', sign: 'LENTO BAIT & FUEL', neon: 0x49ff9a, keys: true });
  lots.push({ x0: 86, x1: 132, z0: north0 - 1, z1: north1 + 1.5 });
  props.push({ type: 'canopy', x: 99, z: north0 + 9, w: 14, d: 8, color: 0xd8443c });
  for (const x of [95, 103]) props.push({ type: 'pump', x, z: north0 + 9 });
  parking.push({ x: 99, z: north0 + 9, rot: Math.PI / 2, model: 'pickup', color: 0x9a8a6a });
  parking.push({ x: 120, z: north1 - 1.5, rot: Math.PI / 2, model: 'kestrel', color: 0xe8e2d0 });
  // stilt houses along the north shore, east of the bridge
  for (const x of [172, 200, 252, 280, 306]) add({ x0: x, x1: x + 14, z0: north0 + 1, z1: north0 + 11, h: 7.2, style: 'stilt', color: pick(STILT), accent: 0xffffff, frontage: 's', keys: true });
  // south side, west: The Salt Hook (bar) and the Palm Hammock RV park
  add({ x0: 64, x1: 90, z0: south0 + 6, z1: south0 + 20, h: 5.5, style: 'shop', color: 0x6d8f9c, accent: 0xf2a03d, frontage: 'n', sign: 'THE SALT HOOK', neon: 0xff3fa4, keys: true, bar: true });
  lots.push({ x0: K.pointX + rw + 0.5, x1: 96, z0: south0 - 1.5, z1: south0 + 6 });
  parking.push({ x: 70, z: south0 + 2, rot: 0, model: 'ironhorse', color: 0x2a5aa8 });
  parking.push({ x: 84, z: south0 + 2, rot: 0, model: 'pickup', color: 0x2b2b2b });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) props.push({ type: 'trailer', x: 104 + j * 18, z: south0 + 8 + i * 13, rot: Math.PI / 2, color: pick([0xf4f1ea, 0xe9e2d0, 0xdfe8ee, 0xf2e3c6]) });
  props.push({ type: 'roadSignKeys', x: 100, z: south0 - 0.5, text: 'PALM HAMMOCK RV PARK' });
  // south side, east of the bridge: more stilt houses, then the marina
  for (const x of [166, 190]) add({ x0: x, x1: x + 14, z0: south0 + 8, z1: south0 + 19, h: 7.2, style: 'stilt', color: pick(STILT), accent: 0xffffff, frontage: 'n', keys: true });
  add({ x0: 238, x1: 262, z0: south0 + 8, z1: south0 + 22, h: 6, style: 'shop', color: 0xf3efe2, accent: 0x1d6fa8, frontage: 'w', sign: 'CAYO LENTO MARINA', neon: 0x29e6ff, keys: true });
  lots.push({ x0: K.marinaX + rw, x1: 304, z0: K.z1 - 30, z1: K.z1 - 3 });
  parking.push({ x: 292, z: K.z1 - 18, rot: Math.PI / 2, model: 'pickup', color: 0xf2f2f2 });
  parking.push({ x: 275, z: K.z1 - 10, rot: -Math.PI / 2, model: 'kestrel', color: 0x1f4b3a });
  // the long pier south off the marina, with boats alongside
  const pierX = 262, pierLen = 46;
  props.push({ type: 'dock', axis: 'z', x: pierX, z: K.z1 + pierLen / 2 - 1, len: pierLen });
  PLATFORMS.push({ x0: pierX - 1.5, x1: pierX + 1.5, z0: K.z1 - 1, z1: K.z1 + pierLen - 1, y: 0.1 });
  for (const [dx, dz, c] of [[-6, 12, 0xffffff], [6, 22, 0x1d3557], [-6, 34, 0xf1efe8], [6, 40, 0xffffff]]) props.push({ type: 'boat', x: pierX + dx, z: K.z1 + dz, rot: (rnd() - 0.5) * 0.2, color: c });
  PLACES.marina = { name: 'Cayo Lento Marina', x: pierX, z: K.z1 + 4, pierEnd: { x: pierX, z: K.z1 + pierLen - 4 }, lot: { x: 246, z: K.shoreZ - 4 } };
  PLACES.baitShop = { name: 'Lento Bait & Fuel', x: 99, z: north0 + 4 };
  PLACES.saltHook = { name: 'The Salt Hook', x: 77, z: south0 + 3 };
  PLACES.keys = { name: K.name, x: TWIN.x, z: hz };
  // water tower at the west point, the old bridge east (closed), shoreline mangroves and palms
  props.push({ type: 'watertower', x: 50, z: 690 });
  for (let z = hz - 8; z <= hz + 8; z += 2.4) props.push({ type: 'barrier', x: K.x1 - 4, z, rot: Math.PI / 2 });
  props.push({ type: 'roadSignKeys', x: K.x1 - 6, z: hz - 9, text: 'OLD LENTO BRIDGE — CLOSED TO TRAFFIC' });
  props.push({ type: 'oldBridge', x0: K.x1, x1: BACKDROP.keys[0].x0, z: hz });
  for (let x = K.x0 + 4; x < K.x1 - 4; x += 5 + rnd() * 6) {
    if (Math.abs(x - TWIN.x) < 14) continue;
    if (rnd() < 0.8) props.push({ type: 'mangrove', x, z: K.z0 + 1.2 + rnd() * 1.5, s: 0.8 + rnd() * 0.8 });
    if (rnd() < 0.5 && !(x > K.marinaX - 22 && x < 306)) props.push({ type: 'mangrove', x, z: K.z1 - 1.2 - rnd() * 1.5, s: 0.8 + rnd() * 0.8 });
  }
  for (let z = K.z0 + 6; z < K.z1 - 4; z += 6 + rnd() * 5) { props.push({ type: 'mangrove', x: K.x0 + 1.5, z, s: 1 + rnd() * 0.6 }); }
  for (let x = K.x0 + 10; x < K.x1 - 10; x += 9 + rnd() * 9) {
    if (Math.abs(x - TWIN.x) < 12 || Math.abs(x - K.marinaX) < 6) continue;
    const south = rnd() < 0.5;
    if ((south && x > 56 && x < 140) || (!south && x > 80 && x < 138)) continue; // keep the lots and their exits clear
    const zz = south ? hz + rw + 1.6 : hz - rw - 1.6;
    if (rnd() < 0.7) props.push({ type: 'palm', x, z: zz, h: 7 + rnd() * 5, lean: rnd() * 0.8 });
  }
  for (let x = 70; x < 200; x += 7 + rnd() * 6) props.push({ type: 'palm', x, z: K.z1 - 3 - rnd() * 2, h: 8 + rnd() * 4, lean: 0.4 + rnd() * 0.6 });
  // highway lights, set well back on the verge and away from the junctions (cars swing wide out here)
  for (const x of [168, 200, 254, 286]) props.push({ type: 'streetlight', x, z: hz + rw + 2.6, rot: Math.PI, keys: true });
  // lights along the outer parapets of the twin-span
  const tw = TWIN.median / 2 + TWIN.deckW + 0.25; // standing on the outer parapet
  for (let z = TWIN.zStart + 18; z < TWIN.zEnd - 10; z += 36) {
    props.push({ type: 'streetlight', x: TWIN.x - tw, z, rot: Math.PI / 2, bridge: true });
    props.push({ type: 'streetlight', x: TWIN.x + tw, z: z + 18, rot: -Math.PI / 2, bridge: true });
  }
  // palms on the further keys (backdrop)
  for (const k of BACKDROP.keys) for (let i = 0; i < 9; i++) props.push({ type: 'palm', x: k.x0 + 6 + rnd() * (k.x1 - k.x0 - 12), z: k.z0 + 4 + rnd() * (k.z1 - k.z0 - 8), h: 7 + rnd() * 6, lean: rnd() });
}

/** Where people wander on Cayo Lento (no sidewalk grid out here). */
export const KEYS_ZONES = [
  { x0: KEYS.x0 + 30, x1: KEYS.x1 - 30, z0: KEYS.hwyZ + 7, z1: KEYS.z1 - 6 },
  { x0: 86, x1: 132, z0: KEYS.z0 + 3, z1: KEYS.hwyZ - 7 },
];

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
export const PARK_ZONE = PLACES.park.bounds;
export const PROMENADE_ZONE = { x0: ISLAND.promenade + 1, x1: ISLAND.sandStart - 1, z0: ISLAND.north + 10, z1: ISLAND.south - 10 };

export { SIDEWALK_W };
