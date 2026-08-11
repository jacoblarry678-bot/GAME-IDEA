/**
 * THE LABYRINTH — shared map definition.
 *
 * The map is generated deterministically from a seed by code that runs
 * identically on the Node server and in the browser. That gives us:
 *   - identical collision on client and server (no desync, no cheating drift)
 *   - server-side pathfinding for bots over the exact grid the player walks
 *   - a "procedural-looking" maze that is nonetheless reproducible for a match
 *
 * Representation
 * --------------
 * Two floor grids of GRID_W x GRID_H cells, CELL metres each. A cell is either
 * solid rock (1) or walkable (0). Every walkable cell records a zone id which
 * drives materials, ceiling height, lighting mood and the "current room"
 * readout. Stairs are explicit ramp volumes that are walkable on both floors.
 */

import { Rand } from './rng.js';

export const CELL = 4.0;
export const GRID_W = 72;
export const GRID_H = 72;
export const WALL_H = 5.2;
export const FLOOR_Y = [0, 7.4];
export const NUM_FLOORS = 2;

export const gridToWorldX = (gx) => (gx - GRID_W / 2 + 0.5) * CELL;
export const gridToWorldZ = (gz) => (gz - GRID_H / 2 + 0.5) * CELL;
export const worldToGridX = (x) => Math.floor(x / CELL + GRID_W / 2);
export const worldToGridZ = (z) => Math.floor(z / CELL + GRID_H / 2);

/**
 * Zone catalogue. `mood` feeds the lighting rig, `mat` the material set,
 * `ceil` the ceiling height in metres above the floor plane.
 */
export const ZONES = {
  void: { id: 0, key: 'void', name: 'The Void', mat: 'stone', ceil: 5, mood: 'dark' },
  entrance: {
    id: 1,
    key: 'entrance',
    name: 'The Entrance',
    mat: 'stone',
    ceil: 8.5,
    mood: 'cold',
    desc: 'A dark stone antechamber. The doors behind you are gone.',
  },
  chain_hall: {
    id: 2,
    key: 'chain_hall',
    name: 'The Chain Hall',
    mat: 'stone',
    ceil: 11.5,
    mood: 'cold',
    desc: 'A cathedral of hanging chains.',
  },
  archives: {
    id: 3,
    key: 'archives',
    name: 'The Archives',
    mat: 'wood',
    ceil: 6.4,
    mood: 'candle',
    desc: 'Rotting books, dripping candles, and things written in the margins.',
  },
  torture_gallery: {
    id: 4,
    key: 'torture_gallery',
    name: 'The Torture Gallery',
    mat: 'rust',
    ceil: 8.0,
    mood: 'red',
    desc: 'Machinery built for a purpose you would rather not deduce.',
  },
  blood_corridor: {
    id: 5,
    key: 'blood_corridor',
    name: 'The Blood Corridor',
    mat: 'tile',
    ceil: 4.6,
    mood: 'pulse',
    desc: 'The walls here are wet, and the wet is warm.',
  },
  puzzle_chamber: {
    id: 6,
    key: 'puzzle_chamber',
    name: 'The Puzzle Chamber',
    mat: 'obsidian',
    ceil: 10.0,
    mood: 'occult',
    desc: 'A room shaped like the inside of the box.',
  },
  inner_labyrinth: {
    id: 7,
    key: 'inner_labyrinth',
    name: 'The Inner Labyrinth',
    mat: 'stone',
    ceil: 4.4,
    mood: 'dark',
    desc: 'Corridors that do not agree on where they went.',
  },
  the_gate: {
    id: 8,
    key: 'the_gate',
    name: 'The Gate',
    mat: 'obsidian',
    ceil: 12.0,
    mood: 'gate',
    desc: 'A door that opens outward, if it is paid.',
  },
  corridor: { id: 9, key: 'corridor', name: 'Passage', mat: 'stone', ceil: 4.6, mood: 'dark' },
  boiler: {
    id: 10,
    key: 'boiler',
    name: 'The Boiler Room',
    mat: 'rust',
    ceil: 5.4,
    mood: 'steam',
    desc: 'Something still feeds the pipes.',
  },
  ossuary: {
    id: 11,
    key: 'ossuary',
    name: 'The Ossuary',
    mat: 'bone',
    ceil: 5.0,
    mood: 'candle',
    desc: 'Stacked, sorted, catalogued.',
  },
  cistern: {
    id: 12,
    key: 'cistern',
    name: 'The Cistern',
    mat: 'tile',
    ceil: 6.2,
    mood: 'wet',
    desc: 'Black water, ankle deep, moving against the slope.',
  },
  gallery: {
    id: 13,
    key: 'gallery',
    name: 'The Upper Gallery',
    mat: 'stone',
    ceil: 5.0,
    mood: 'cold',
    desc: 'A balcony over the chains.',
  },
  chapel: {
    id: 14,
    key: 'chapel',
    name: 'The Desecrated Chapel',
    mat: 'wood',
    ceil: 8.0,
    mood: 'candle',
    desc: 'Someone has been very thorough with the iconography.',
  },
  overlook: {
    id: 15,
    key: 'overlook',
    name: 'The Overlook',
    mat: 'rust',
    ceil: 5.2,
    mood: 'red',
    desc: 'Catwalks above the gallery floor.',
  },
  upper_archive: {
    id: 16,
    key: 'upper_archive',
    name: 'The Sealed Stacks',
    mat: 'wood',
    ceil: 5.0,
    mood: 'candle',
    desc: 'Shelves nailed shut from the inside.',
  },
  stair: { id: 17, key: 'stair', name: 'Stairwell', mat: 'stone', ceil: 6.5, mood: 'dark' },
};

export const ZONE_BY_ID = Object.fromEntries(Object.values(ZONES).map((z) => [z.id, z]));

/** Rectangular room/corridor stamps, per floor. [x0, z0, x1, z1] inclusive. */
const LAYOUT = [
  // ---------- FLOOR 0 ----------
  { f: 0, r: [30, 2, 41, 12], zone: 'entrance' },
  { f: 0, r: [34, 13, 37, 16], zone: 'corridor' },
  { f: 0, r: [22, 17, 49, 29], zone: 'chain_hall' },
  { f: 0, r: [14, 21, 21, 24], zone: 'corridor' },
  { f: 0, r: [3, 6, 17, 20], zone: 'archives' },
  { f: 0, r: [50, 21, 57, 24], zone: 'corridor' },
  { f: 0, r: [52, 5, 68, 20], zone: 'torture_gallery' },
  { f: 0, r: [34, 30, 37, 45], zone: 'blood_corridor' },
  { f: 0, r: [27, 46, 45, 58], zone: 'puzzle_chamber' },
  { f: 0, r: [34, 59, 37, 61], zone: 'corridor' },
  { f: 0, r: [28, 62, 43, 70], zone: 'the_gate' },
  // maze wings (carved below, stamped solid first)
  { f: 0, r: [22, 30, 25, 32], zone: 'corridor' },
  { f: 0, r: [46, 30, 49, 32], zone: 'corridor' },
  { f: 0, r: [26, 50, 26, 52], zone: 'corridor' },
  { f: 0, r: [46, 50, 46, 52], zone: 'corridor' },
  { f: 0, r: [26, 65, 27, 67], zone: 'corridor' },
  { f: 0, r: [44, 65, 45, 67], zone: 'corridor' },
  { f: 0, r: [64, 20, 67, 32], zone: 'corridor' },
  // hidden rooms
  { f: 0, r: [6, 22, 13, 28], zone: 'boiler' },
  { f: 0, r: [3, 40, 10, 47], zone: 'ossuary' },
  { f: 0, r: [56, 60, 63, 67], zone: 'cistern' },
  // ---------- FLOOR 1 ----------
  { f: 1, r: [21, 16, 50, 30], zone: 'gallery' },
  { f: 1, r: [24, 19, 47, 27], zone: 'HOLE' }, // punched back out => balcony ring
  { f: 1, r: [4, 6, 18, 19], zone: 'chapel' },
  { f: 1, r: [18, 20, 21, 24], zone: 'corridor' },
  { f: 1, r: [50, 19, 53, 24], zone: 'corridor' },
  { f: 1, r: [52, 6, 66, 18], zone: 'overlook' },
  { f: 1, r: [34, 30, 37, 34], zone: 'corridor' },
  { f: 1, r: [28, 35, 41, 43], zone: 'upper_archive' },
];

/** Maze wings: [x0, z0, x1, z1] carved with a seeded recursive backtracker. */
const MAZE_REGIONS = [
  { f: 0, r: [2, 32, 25, 68], zone: 'inner_labyrinth' },
  { f: 0, r: [47, 32, 69, 68], zone: 'inner_labyrinth' },
];

/** Stair volumes — walkable on both connected floors, height ramps along `axis`. */
const STAIRS = [
  { id: 'stair_a', from: 0, to: 1, r: [22, 17, 24, 22], axis: 'z', dir: 1 },
  { id: 'stair_b', from: 0, to: 1, r: [53, 6, 55, 11], axis: 'z', dir: 1 },
  { id: 'stair_c', from: 0, to: 1, r: [3, 7, 5, 12], axis: 'z', dir: 1 },
  { id: 'stair_d', from: 0, to: 1, r: [38, 30, 40, 35], axis: 'z', dir: 1 },
];

/** Elevator shafts (animated platform, connects two floors). */
const ELEVATORS = [{ id: 'lift_a', r: [45, 25, 47, 27], from: 0, to: 1, speed: 2.4 }];

/**
 * Doors. `dir` is the axis the door blocks movement along.
 * `locked` doors need a key or an objective completion to open.
 */
const DOORS = [
  { id: 'd_entrance', f: 0, gx: 35, gz: 13, dir: 'z', kind: 'iron' },
  { id: 'd_entrance2', f: 0, gx: 36, gz: 13, dir: 'z', kind: 'iron' },
  { id: 'd_arch_w', f: 0, gx: 14, gz: 22, dir: 'x', kind: 'wood' },
  { id: 'd_arch_w2', f: 0, gx: 14, gz: 23, dir: 'x', kind: 'wood' },
  { id: 'd_tort_e', f: 0, gx: 50, gz: 22, dir: 'x', kind: 'iron' },
  { id: 'd_tort_e2', f: 0, gx: 50, gz: 23, dir: 'x', kind: 'iron' },
  { id: 'd_blood', f: 0, gx: 35, gz: 30, dir: 'z', kind: 'iron' },
  { id: 'd_blood2', f: 0, gx: 36, gz: 30, dir: 'z', kind: 'iron' },
  { id: 'd_boiler', f: 0, gx: 13, gz: 23, dir: 'x', kind: 'hidden' },
  { id: 'd_puzzle_w', f: 0, gx: 26, gz: 51, dir: 'x', kind: 'stone' },
  { id: 'd_puzzle_e', f: 0, gx: 46, gz: 51, dir: 'x', kind: 'stone' },
  { id: 'd_gate', f: 0, gx: 35, gz: 61, dir: 'z', kind: 'gate', locked: true, unlockBy: 'ritual' },
  { id: 'd_gate2', f: 0, gx: 36, gz: 61, dir: 'z', kind: 'gate', locked: true, unlockBy: 'ritual' },
  { id: 'd_chapel', f: 1, gx: 18, gz: 22, dir: 'x', kind: 'wood' },
  { id: 'd_stacks', f: 1, gx: 35, gz: 34, dir: 'z', kind: 'wood', locked: true, unlockBy: 'key' },
];

/** Vaultable low obstacles: pallets, broken walls, window frames. */
const VAULTS = [
  { f: 0, gx: 28, gz: 20, dir: 'x' },
  { f: 0, gx: 43, gz: 20, dir: 'x' },
  { f: 0, gx: 30, gz: 26, dir: 'z' },
  { f: 0, gx: 41, gz: 26, dir: 'z' },
  { f: 0, gx: 35, gz: 38, dir: 'z' },
  { f: 0, gx: 8, gz: 14, dir: 'x' },
  { f: 0, gx: 58, gz: 12, dir: 'x' },
  { f: 0, gx: 62, gz: 16, dir: 'z' },
  { f: 0, gx: 31, gz: 52, dir: 'x' },
  { f: 0, gx: 41, gz: 52, dir: 'x' },
  { f: 0, gx: 33, gz: 66, dir: 'z' },
  { f: 1, gx: 30, gz: 39, dir: 'z' },
  { f: 1, gx: 10, gz: 12, dir: 'x' },
];

function inRect(gx, gz, r) {
  return gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3];
}

function rectCells(r) {
  const out = [];
  for (let z = r[1]; z <= r[3]; z++) for (let x = r[0]; x <= r[2]; x++) out.push([x, z]);
  return out;
}

/**
 * Carve a maze into `region` using a recursive backtracker on the odd lattice.
 * Then knock out a fraction of extra walls so the maze has loops and shortcuts
 * rather than a single frustrating solution path.
 */
function carveMaze(solid, zone, region, zoneId, rand, loopiness = 0.16) {
  const [x0, z0, x1, z1] = region;
  const w = x1 - x0 + 1;
  const h = z1 - z0 + 1;
  const visited = new Set();
  const key = (x, z) => x * 1000 + z;

  // start on an odd lattice point
  const sx = x0 + 1;
  const sz = z0 + 1;
  const stack = [[sx, sz]];
  visited.add(key(sx, sz));
  const open = (x, z) => {
    if (x < x0 || x > x1 || z < z0 || z > z1) return;
    solid[z * GRID_W + x] = 0;
    zone[z * GRID_W + x] = zoneId;
  };
  open(sx, sz);

  const dirs = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ];

  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const options = [];
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx <= x0 || nx >= x1 || nz <= z0 || nz >= z1) continue;
      if (visited.has(key(nx, nz))) continue;
      options.push([nx, nz, cx + dx / 2, cz + dz / 2]);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, nz, mx, mz] = options[Math.floor(rand.next() * options.length)];
    visited.add(key(nx, nz));
    open(mx, mz);
    open(nx, nz);
    stack.push([nx, nz]);
  }

  // braid: remove dead ends / add loops
  for (let z = z0 + 1; z < z1; z += 2) {
    for (let x = x0 + 1; x < x1; x += 2) {
      if (rand.next() > loopiness) continue;
      const d = dirs[Math.floor(rand.next() * 4)];
      const mx = x + d[0] / 2;
      const mz = z + d[1] / 2;
      if (mx <= x0 || mx >= x1 || mz <= z0 || mz >= z1) continue;
      open(mx, mz);
    }
  }

  // widen a few cells into small alcoves so the maze isn't uniform 1-wide
  for (let i = 0; i < Math.floor(w * h * 0.012); i++) {
    const ax = rand.int(x0 + 2, x1 - 3);
    const az = rand.int(z0 + 2, z1 - 3);
    for (let z = az; z < az + 2; z++) for (let x = ax; x < ax + 2; x++) open(x, z);
  }
}

/** Flood fill from a seed cell; returns the set of reachable cell indices. */
function floodReachable(solid, startX, startZ) {
  const seen = new Uint8Array(GRID_W * GRID_H);
  const idx = startZ * GRID_W + startX;
  if (solid[idx]) return seen;
  const queue = [idx];
  seen[idx] = 1;
  while (queue.length) {
    const c = queue.pop();
    const cx = c % GRID_W;
    const cz = (c / GRID_W) | 0;
    const nb = [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ];
    for (const [nx, nz] of nb) {
      if (nx < 0 || nz < 0 || nx >= GRID_W || nz >= GRID_H) continue;
      const ni = nz * GRID_W + nx;
      if (seen[ni] || solid[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

/**
 * Build the complete map. Same seed => byte-identical result everywhere.
 * @param {string|number} seed
 */
export function buildMap(seed = 'labyrinth') {
  const rand = new Rand(typeof seed === 'string' ? seed : seed >>> 0);

  const floors = [];
  for (let f = 0; f < NUM_FLOORS; f++) {
    floors.push({
      solid: new Uint8Array(GRID_W * GRID_H).fill(1),
      zone: new Uint8Array(GRID_W * GRID_H),
    });
  }

  // 1. stamp rectangular rooms
  for (const item of LAYOUT) {
    const fl = floors[item.f];
    const punch = item.zone === 'HOLE';
    const zid = punch ? 0 : ZONES[item.zone].id;
    for (const [x, z] of rectCells(item.r)) {
      if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) continue;
      const i = z * GRID_W + x;
      fl.solid[i] = punch ? 1 : 0;
      fl.zone[i] = zid;
    }
  }

  // 2. carve maze wings
  for (const m of MAZE_REGIONS) {
    carveMaze(floors[m.f].solid, floors[m.f].zone, m.r, ZONES[m.zone].id, rand);
  }

  // 3. replay the layout so the maze can never eat a hand-authored space.
  //    HOLE stamps are replayed too, or the gallery balcony gets floored over.
  for (const item of LAYOUT) {
    const fl = floors[item.f];
    const punch = item.zone === 'HOLE';
    const zid = punch ? 0 : ZONES[item.zone].id;
    for (const [x, z] of rectCells(item.r)) {
      if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) continue;
      const i = z * GRID_W + x;
      fl.solid[i] = punch ? 1 : 0;
      fl.zone[i] = zid;
    }
  }

  // 4. stairs are walkable on both floors
  const stairs = STAIRS.map((s) => {
    const [x0, z0, x1, z1] = s.r;
    for (const fi of [s.from, s.to]) {
      for (const [x, z] of rectCells(s.r)) {
        const i = z * GRID_W + x;
        floors[fi].solid[i] = 0;
        if (!floors[fi].zone[i]) floors[fi].zone[i] = ZONES.stair.id;
      }
    }
    return {
      ...s,
      world: {
        x0: gridToWorldX(x0) - CELL / 2,
        z0: gridToWorldZ(z0) - CELL / 2,
        x1: gridToWorldX(x1) + CELL / 2,
        z1: gridToWorldZ(z1) + CELL / 2,
        y0: FLOOR_Y[s.from],
        y1: FLOOR_Y[s.to],
      },
    };
  });

  const elevators = ELEVATORS.map((e) => {
    for (const fi of [e.from, e.to]) {
      for (const [x, z] of rectCells(e.r)) {
        const i = z * GRID_W + x;
        floors[fi].solid[i] = 0;
        if (!floors[fi].zone[i]) floors[fi].zone[i] = ZONES.corridor.id;
      }
    }
    return {
      ...e,
      world: {
        x0: gridToWorldX(e.r[0]) - CELL / 2,
        z0: gridToWorldZ(e.r[1]) - CELL / 2,
        x1: gridToWorldX(e.r[2]) + CELL / 2,
        z1: gridToWorldZ(e.r[3]) + CELL / 2,
      },
    };
  });

  // 5. connectivity guarantee: anything on floor 0 that cannot reach the
  //    entrance is filled back in. Prevents unreachable objective spawns.
  const reach0 = floodReachable(floors[0].solid, 35, 7);
  for (let i = 0; i < floors[0].solid.length; i++) {
    if (!floors[0].solid[i] && !reach0[i]) {
      floors[0].solid[i] = 1;
      floors[0].zone[i] = 0;
    }
  }

  const doors = DOORS.map((d) => ({
    ...d,
    locked: !!d.locked,
    open: false,
    x: gridToWorldX(d.gx),
    z: gridToWorldZ(d.gz),
    y: FLOOR_Y[d.f],
  }));

  const vaults = VAULTS.filter((v) => !floors[v.f].solid[v.gz * GRID_W + v.gx]).map((v, i) => ({
    id: `vault_${i}`,
    ...v,
    x: gridToWorldX(v.gx),
    z: gridToWorldZ(v.gz),
    y: FLOOR_Y[v.f],
  }));

  const map = {
    seed: String(seed),
    floors,
    stairs,
    elevators,
    doors,
    vaults,
    zones: ZONES,
  };

  // 6. points of interest, placed on real walkable cells
  placePOIs(map, rand);

  return map;
}

/** Collect every walkable cell of a zone on a floor. */
function cellsOfZone(map, floor, zoneKey) {
  const zid = ZONES[zoneKey].id;
  const fl = map.floors[floor];
  const out = [];
  for (let z = 1; z < GRID_H - 1; z++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      const i = z * GRID_W + x;
      if (!fl.solid[i] && fl.zone[i] === zid) out.push([x, z, floor]);
    }
  }
  return out;
}

/** True if the cell is a decent spot for a prop: walkable and against a wall. */
function isWallAdjacent(map, floor, gx, gz) {
  const s = map.floors[floor].solid;
  return (
    s[gz * GRID_W + gx + 1] ||
    s[gz * GRID_W + gx - 1] ||
    s[(gz + 1) * GRID_W + gx] ||
    s[(gz - 1) * GRID_W + gx]
  );
}

function poi(id, type, cell, extra = {}) {
  return {
    id,
    type,
    gx: cell[0],
    gz: cell[1],
    floor: cell[2],
    x: gridToWorldX(cell[0]),
    z: gridToWorldZ(cell[1]),
    y: FLOOR_Y[cell[2]],
    ...extra,
  };
}

function placePOIs(map, rand) {
  const pools = {
    entrance: cellsOfZone(map, 0, 'entrance'),
    chain_hall: cellsOfZone(map, 0, 'chain_hall'),
    archives: cellsOfZone(map, 0, 'archives'),
    torture: cellsOfZone(map, 0, 'torture_gallery'),
    blood: cellsOfZone(map, 0, 'blood_corridor'),
    puzzle: cellsOfZone(map, 0, 'puzzle_chamber'),
    maze: cellsOfZone(map, 0, 'inner_labyrinth'),
    gate: cellsOfZone(map, 0, 'the_gate'),
    boiler: cellsOfZone(map, 0, 'boiler'),
    ossuary: cellsOfZone(map, 0, 'ossuary'),
    cistern: cellsOfZone(map, 0, 'cistern'),
    gallery: cellsOfZone(map, 1, 'gallery'),
    chapel: cellsOfZone(map, 1, 'chapel'),
    overlook: cellsOfZone(map, 1, 'overlook'),
    stacks: cellsOfZone(map, 1, 'upper_archive'),
  };

  const used = new Set();
  const takeFrom = (pool, opts = {}) => {
    const cand = rand.shuffle(pool.filter((c) => !used.has(c[2] + ':' + c[0] + ':' + c[1])));
    for (const c of cand) {
      if (opts.wall && !isWallAdjacent(map, c[2], c[0], c[1])) continue;
      if (opts.open && isWallAdjacent(map, c[2], c[0], c[1])) continue;
      used.add(c[2] + ':' + c[0] + ':' + c[1]);
      return c;
    }
    return cand[0] || pool[0];
  };

  // --- ritual seals: scattered across the big set-piece rooms ---
  const sealPools = [
    pools.chain_hall,
    pools.archives,
    pools.torture,
    pools.chapel,
    pools.overlook,
    pools.ossuary,
  ];
  map.seals = sealPools.map((p, i) =>
    poi(`seal_${i}`, 'seal', takeFrom(p, { wall: true }), { index: i, broken: false })
  );

  // --- ritual relics: hidden in the awkward places ---
  const relicPools = [
    pools.boiler,
    pools.cistern,
    pools.ossuary,
    pools.maze,
    pools.stacks,
    pools.torture,
  ];
  map.relics = relicPools.map((p, i) =>
    poi(`relic_${i}`, 'relic', takeFrom(p, { wall: true }), { index: i, taken: false })
  );

  // --- Lament Configuration fragments ---
  const piecePools = [pools.archives, pools.chapel, pools.torture, pools.maze, pools.cistern];
  map.boxPieces = piecePools.map((p, i) =>
    poi(`piece_${i}`, 'box_piece', takeFrom(p, { wall: true }), { index: i, taken: false })
  );

  // --- the altar (relic delivery + box assembly) ---
  const puzzleCenter = [36, 52, 0];
  map.altar = poi('altar', 'altar', puzzleCenter);

  // --- the escape gate ---
  map.gate = poi('gate', 'gate', [35, 66, 0], { charge: 0 });

  // --- searchable containers ---
  const containerSpread = [
    ...pools.archives,
    ...pools.torture,
    ...pools.chapel,
    ...pools.stacks,
    ...pools.boiler,
    ...pools.ossuary,
    ...pools.entrance,
    ...pools.overlook,
    ...pools.cistern,
  ];
  map.containers = [];
  for (let i = 0; i < 26; i++) {
    const c = takeFrom(containerSpread, { wall: true });
    if (!c) break;
    map.containers.push(
      poi(`cont_${i}`, 'container', c, {
        kind: rand.pick(['chest', 'cabinet', 'crate', 'desk']),
        searched: false,
        yaw: rand.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      })
    );
  }

  // --- hiding spots ---
  map.hidingSpots = [];
  const hidePools = [
    ...pools.archives,
    ...pools.chain_hall,
    ...pools.torture,
    ...pools.chapel,
    ...pools.stacks,
    ...pools.entrance,
    ...pools.gallery,
    ...pools.boiler,
    ...pools.cistern,
    ...pools.overlook,
  ];
  for (let i = 0; i < 22; i++) {
    const c = takeFrom(hidePools, { wall: true });
    if (!c) break;
    map.hidingSpots.push(
      poi(`hide_${i}`, 'hide', c, {
        kind: rand.pick(['locker', 'wardrobe', 'iron_maiden']),
        occupant: null,
      })
    );
  }

  // --- survivor spawns: spread far apart across floor 0 ---
  const spawnZones = [pools.entrance, pools.archives, pools.torture, pools.maze, pools.chain_hall, pools.cistern];
  map.survivorSpawns = spawnZones.map((p, i) => poi(`spawn_s_${i}`, 'spawn', takeFrom(p, { open: true })));

  // --- cenobite spawn: the puzzle chamber, of course ---
  map.cenobiteSpawns = [
    poi('spawn_c_0', 'spawn', takeFrom(pools.puzzle, { open: true })),
    poi('spawn_c_1', 'spawn', takeFrom(pools.chain_hall, { open: true })),
  ];

  // --- ambient light anchors (candles, braziers, emergency lamps) ---
  map.lights = [];
  const lightPlan = [
    { pool: pools.entrance, n: 4, kind: 'brazier' },
    { pool: pools.chain_hall, n: 9, kind: 'brazier' },
    { pool: pools.archives, n: 7, kind: 'candle' },
    { pool: pools.torture, n: 7, kind: 'emergency' },
    { pool: pools.blood, n: 5, kind: 'emergency' },
    { pool: pools.puzzle, n: 6, kind: 'occult' },
    { pool: pools.maze, n: 24, kind: 'candle' },
    { pool: pools.gate, n: 5, kind: 'occult' },
    { pool: pools.boiler, n: 3, kind: 'emergency' },
    { pool: pools.ossuary, n: 4, kind: 'candle' },
    { pool: pools.cistern, n: 3, kind: 'candle' },
    { pool: pools.gallery, n: 6, kind: 'brazier' },
    { pool: pools.chapel, n: 8, kind: 'candle' },
    { pool: pools.overlook, n: 5, kind: 'emergency' },
    { pool: pools.stacks, n: 4, kind: 'candle' },
  ];
  let lightId = 0;
  for (const plan of lightPlan) {
    if (!plan.pool.length) continue;
    for (let i = 0; i < plan.n; i++) {
      const c = takeFrom(plan.pool, { wall: plan.kind !== 'brazier' });
      if (!c) break;
      map.lights.push(poi(`light_${lightId++}`, 'light', c, { kind: plan.kind }));
    }
  }

  // --- environmental hazards ---
  map.hazards = [];
  const hazPlan = [
    { pool: pools.torture, n: 5, kind: 'blades' },
    { pool: pools.boiler, n: 3, kind: 'steam' },
    { pool: pools.blood, n: 3, kind: 'spikes' },
    { pool: pools.maze, n: 6, kind: 'spikes' },
  ];
  let hazId = 0;
  for (const plan of hazPlan) {
    if (!plan.pool.length) continue;
    for (let i = 0; i < plan.n; i++) {
      const c = takeFrom(plan.pool, {});
      if (!c) break;
      map.hazards.push(poi(`haz_${hazId++}`, 'hazard', c, { kind: plan.kind }));
    }
  }

  // --- decorative prop anchors (client-side only, but seeded here so the
  //     server can reason about line-of-sight blockers later) ---
  map.props = [];
  let propId = 0;
  const propPlan = [
    { pool: pools.chain_hall, n: 34, kinds: ['chain_cluster', 'hook', 'pillar_chain'] },
    { pool: pools.archives, n: 26, kinds: ['bookshelf', 'reading_desk', 'book_pile', 'ladder'] },
    { pool: pools.torture, n: 22, kinds: ['rack', 'gurney', 'wheel', 'chain_cluster', 'tool_table'] },
    { pool: pools.blood, n: 12, kinds: ['pipe', 'drain', 'chain_cluster'] },
    { pool: pools.puzzle, n: 14, kinds: ['obelisk', 'statue', 'chain_cluster'] },
    { pool: pools.maze, n: 46, kinds: ['chain_cluster', 'skull_pile', 'pipe', 'hook'] },
    { pool: pools.gate, n: 10, kinds: ['obelisk', 'statue'] },
    { pool: pools.boiler, n: 12, kinds: ['boiler_tank', 'pipe', 'valve'] },
    { pool: pools.ossuary, n: 16, kinds: ['bone_rack', 'skull_pile'] },
    { pool: pools.cistern, n: 10, kinds: ['pipe', 'drain', 'chain_cluster'] },
    { pool: pools.chapel, n: 18, kinds: ['pew', 'statue', 'candelabra'] },
    { pool: pools.gallery, n: 14, kinds: ['chain_cluster', 'railing_prop', 'brazier_stand'] },
    { pool: pools.overlook, n: 12, kinds: ['gurney', 'tool_table', 'pipe'] },
    { pool: pools.stacks, n: 16, kinds: ['bookshelf', 'book_pile', 'crate'] },
    { pool: pools.entrance, n: 10, kinds: ['statue', 'brazier_stand', 'rubble'] },
  ];
  for (const plan of propPlan) {
    if (!plan.pool.length) continue;
    for (let i = 0; i < plan.n; i++) {
      const c = takeFrom(plan.pool, { wall: rand.chance(0.7) });
      if (!c) break;
      map.props.push(
        poi(`prop_${propId++}`, 'prop', c, {
          kind: rand.pick(plan.kinds),
          yaw: rand.float(0, Math.PI * 2),
          scale: rand.float(0.85, 1.2),
        })
      );
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Runtime queries — used by the character controller, bots and the server.
// ---------------------------------------------------------------------------

export function isSolid(map, floor, gx, gz) {
  if (gx < 0 || gz < 0 || gx >= GRID_W || gz >= GRID_H) return true;
  const f = map.floors[floor];
  if (!f) return true;
  return f.solid[gz * GRID_W + gx] === 1;
}

export function isSolidWorld(map, floor, x, z) {
  return isSolid(map, floor, worldToGridX(x), worldToGridZ(z));
}

export function zoneAt(map, floor, x, z) {
  const gx = worldToGridX(x);
  const gz = worldToGridZ(z);
  if (gx < 0 || gz < 0 || gx >= GRID_W || gz >= GRID_H) return ZONES.void;
  const f = map.floors[floor];
  if (!f) return ZONES.void;
  return ZONE_BY_ID[f.zone[gz * GRID_W + gx]] || ZONES.void;
}

/** Stair volume containing a world point, or null. */
export function stairAt(map, x, z) {
  for (const s of map.stairs) {
    const w = s.world;
    if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return s;
  }
  return null;
}

/**
 * Ground height under a world point for an entity currently on `floor`.
 * Returns { y, floor } — floor may change when crossing a stair.
 */
export function groundAt(map, floor, x, z) {
  const s = stairAt(map, x, z);
  if (s) {
    const w = s.world;
    const t =
      s.axis === 'z'
        ? (z - w.z0) / Math.max(0.001, w.z1 - w.z0)
        : (x - w.x0) / Math.max(0.001, w.x1 - w.x0);
    const tt = s.dir > 0 ? t : 1 - t;
    const y = w.y0 + (w.y1 - w.y0) * Math.max(0, Math.min(1, tt));
    // hand the entity to the upper floor once it is most of the way up
    const nf = tt > 0.55 ? s.to : s.from;
    return { y, floor: nf, onStair: true };
  }
  return { y: FLOOR_Y[floor] || 0, floor, onStair: false };
}

/** Bresenham-ish line of sight over the grid. */
export function hasLineOfSight(map, floor, ax, az, bx, bz) {
  let x0 = worldToGridX(ax);
  let z0 = worldToGridZ(az);
  const x1 = worldToGridX(bx);
  const z1 = worldToGridZ(bz);
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let guard = 0;
  while (guard++ < 400) {
    if (x0 === x1 && z0 === z1) return true;
    if (isSolid(map, floor, x0, z0)) return false;
    const e2 = 2 * err;
    if (e2 > -dz) {
      err -= dz;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      z0 += sz;
    }
  }
  return false;
}

export { LAYOUT, MAZE_REGIONS, STAIRS, ELEVATORS, DOORS, VAULTS };
