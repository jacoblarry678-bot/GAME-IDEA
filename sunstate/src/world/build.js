/**
 * Builds the static world meshes and colliders from the layout and the
 * district plan: island slab and sidewalks, roads and markings, beach terrain,
 * water, buildings, the causeway, and the unreachable backdrop city.
 */
import * as THREE from 'three';
import { Batcher } from './geo.js';
import * as T from './textures.js';
import {
  AVENUES, STREETS, ROADS, ROAD_GRAPH, BLOCKS, ISLAND, CAUSEWAY, MAINLAND, BACKDROP, CURB, WATER_Y, LANE_W,
  roadHalfWidth, segHalfWidth, roadAt, terrainHeight, causewayDeck, KEYS, TWIN, FLATS, twinDeck,
} from './layout.js';
import { DISTRICT, PLACES, mulberry32 } from './district.js';

const col = (hex) => new THREE.Color(hex);

export function makeMaterials(engine) {
  T.setAnisotropy(engine.maxAniso);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const asphalt = T.asphalt();
  const m = {
    asphalt: std({ map: asphalt, roughness: 0.93 }),
    lot: std({ map: asphalt, color: 0xc9c9c9, roughness: 0.93 }),
    concrete: std({ map: T.concrete(), roughness: 0.9 }),
    curb: std({ color: 0xb8b2a6, roughness: 0.9 }),
    pavers: std({ map: T.pavers(), roughness: 0.9 }),
    grass: std({ map: T.grass(), roughness: 1 }),
    sand: std({ map: T.sand(), roughness: 1 }),
    seabed: std({ color: 0x6f6a55, roughness: 1 }),
    flats: std({ map: T.sand(), color: 0xc9bd96, roughness: 1 }),
    keyrock: std({ color: 0xb9ad94, roughness: 1, flatShading: true }),
    mangrove: std({ color: 0x3f6b3a, roughness: 1, flatShading: true }),
    deepbed: std({ color: 0x2b4a52, roughness: 1 }),
    seawall: std({ map: T.concrete(), color: 0x9b968a }),
    wood: std({ map: T.wood(), roughness: 0.9 }),
    roof: std({ map: T.concrete(), color: 0x8f8b84, roughness: 0.95 }),
    trim: std({ vertexColors: true, roughness: 0.7 }),
    metal: std({ vertexColors: true, roughness: 0.45, metalness: 0.6 }),
    glass: std({ color: 0x6f8fa6, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    rock: std({ color: 0x8a847a, roughness: 1, flatShading: true }),
    marking_w: std({ color: 0xe8e6df, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    marking_y: std({ color: 0xe7b53a, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    tiles: std({ map: T.tiles(), roughness: 0.4 }),
    shelf: std({ map: T.shelfGoods(), roughness: 0.7 }),
    ceiling: std({ color: 0xeeeeea, roughness: 0.9 }),
    lightpanel: new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
    fridge: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x9fd3ff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3 }),
    clubfloor: std({ map: T.tiles(), color: 0x2a1a33, roughness: 0.22, metalness: 0.35 }),
    mirror: std({ color: 0x8a7f99, roughness: 0.04, metalness: 1, envMapIntensity: 1.4 }),
  };
  m.lot.map = asphalt;
  // facades share a texture per style; per-building colour comes from vertex colours
  for (const style of ['deco', 'shop', 'tower', 'motel', 'residential', 'civic', 'store']) {
    const f = T.facade(style === 'store' ? 'shop' : style);
    m['fac:' + style] = std({ map: f.map, vertexColors: true, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: style === 'tower' ? 0.35 : 0.85, metalness: style === 'tower' ? 0.25 : 0 });
  }
  for (const kind of ['shop', 'deco']) {
    const f = T.storefront(kind);
    m['front:' + kind] = std({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.2 });
  }
  return m;
}

/** Build everything static. Returns { group, signs, nightMaterials }. */
export function buildWorld(engine, collision, mats) {
  const group = new THREE.Group();
  group.name = 'world';
  const B = new Batcher();
  const signs = [];
  const rnd = mulberry32(777);

  buildGround(B, collision);
  buildRoads(B);
  buildBeach(group, mats);
  buildCauseway(B, collision);
  buildKeys(B, group, mats, collision);
  buildPark(B);
  buildTwinSpan(B, collision);
  for (const b of DISTRICT.buildings) buildBuilding(B, b, collision, signs, group, rnd);
  buildBackdrop(B, collision, rnd);

  for (const m of B.build(mats)) group.add(m);
  const water = buildWater(engine);
  group.add(water);
  return { group, signs, water };
}

// ---------------------------------------------------------------------------

function buildGround(B, cw) {
  const top = CURB;
  // island land slabs: every block plus the edge strips around the road grid
  const slabs = [];
  for (const b of BLOCKS) slabs.push([b.x0, b.x1, b.z0, b.z1]);
  const a0 = AVENUES[0], a3 = AVENUES[3], s0 = STREETS[0], s6 = STREETS[6];
  const gx0 = a0.x - roadHalfWidth(a0.lanes), gx1 = a3.x + roadHalfWidth(a3.lanes);
  const gz0 = s0.z - roadHalfWidth(s0.lanes), gz1 = s6.z + roadHalfWidth(s6.lanes);
  const cwH = roadHalfWidth(CAUSEWAY.lanes);
  slabs.push([ISLAND.west, gx0, ISLAND.north, CAUSEWAY.z - cwH]);
  slabs.push([ISLAND.west, gx0, CAUSEWAY.z + cwH, ISLAND.south]);
  slabs.push([gx0, gx1, ISLAND.north, gz0]);
  // south strip, cut for the twin-span approach (two carriageways at road level, raised median between)
  const tw = TWIN.median / 2 + TWIN.deckW;
  slabs.push([gx0, TWIN.x - tw, gz1, ISLAND.south]);
  slabs.push([TWIN.x - TWIN.median / 2, TWIN.x + TWIN.median / 2, gz1, ISLAND.south]);
  slabs.push([TWIN.x + tw, gx1, gz1, ISLAND.south]);
  slabs.push([gx1, ISLAND.sandStart, ISLAND.north, ISLAND.south]);

  for (const [x0, x1, z0, z1] of slabs) {
    B.box('curb', x0, x1, 0, top, z0, z1, { sides: { top: false }, tile: [2, 2] });
    // sidewalk ring (concrete) — interiors of blocks are drawn as concrete too
    B.flat('concrete', x0, x1, z0, z1, top, 3);
  }
  // promenade pavers and a grass park strip along Ocean Blvd
  B.flat('pavers', gx1 + 4, gx1 + 6.5, ISLAND.north + 2, ISLAND.south - 2, top + 0.012, 4);
  B.flat('grass', gx1 + 6.5, ISLAND.sandStart - 2.5, ISLAND.north + 2, ISLAND.south - 2, top + 0.012, 6);
  B.flat('pavers', ISLAND.sandStart - 2.5, ISLAND.sandStart, ISLAND.north + 2, ISLAND.south - 2, top + 0.012, 4);
  // low beach wall with gaps for paths onto the sand
  for (let z = ISLAND.north + 6; z < ISLAND.south - 6; z += 34) {
    const z1 = Math.min(ISLAND.south - 6, z + 28);
    B.box('seawall', ISLAND.sandStart - 0.4, ISLAND.sandStart, top, top + 0.55, z, z1, { tile: [2, 2] });
    cw.add({ type: 'box', cx: ISLAND.sandStart - 0.2, cz: (z + z1) / 2, hx: 0.2, hz: (z1 - z) / 2, y0: -1, y1: top + 0.55, material: 'concrete', cameraBlock: false });
  }
  // parking lots
  for (const l of DISTRICT.lots) {
    B.flat('lot', l.x0, l.x1, l.z0, l.z1, top + 0.012, 8);
    const alongZ = (l.z1 - l.z0) > (l.x1 - l.x0);
    if (alongZ) for (let z = l.z0 + 3; z < l.z1 - 2; z += 3.25) for (const x of [l.x0 + 1, l.x1 - 6]) if (l.x1 - l.x0 > 12) B.flat('marking_w', x, x + 5, z, z + 0.12, top + 0.02);
  }
  // seawalls around the island (down to the bay floor)
  B.box('seawall', ISLAND.west - 0.6, ISLAND.west, -4.3, top, ISLAND.north, ISLAND.south, { sides: { top: true, e: false }, tile: [4, 4] });
  B.box('seawall', ISLAND.west, ISLAND.sandStart, -4.3, top, ISLAND.north - 0.6, ISLAND.north, { sides: { top: true, s: false }, tile: [4, 4] });
  for (const [x0, x1] of [[ISLAND.west, TWIN.x - tw], [TWIN.x - TWIN.median / 2, TWIN.x + TWIN.median / 2], [TWIN.x + tw, ISLAND.sandStart]]) B.box('seawall', x0, x1, -4.3, top, ISLAND.south, ISLAND.south + 0.6, { sides: { top: true, n: false }, tile: [4, 4] });
  for (const sx of [-1, 1]) B.box('seawall', TWIN.x + sx * TWIN.median / 2 - 0.3, TWIN.x + sx * TWIN.median / 2 + 0.3, -4.3, 0, ISLAND.south, ISLAND.south + 0.6, { tile: [4, 4] });
  // jetty rocks where the beach meets the canals
  for (const z of [ISLAND.north - 2, ISLAND.south + 2]) {
    for (let x = ISLAND.sandStart; x < ISLAND.shore + 40; x += 2.2) {
      const h = terrainHeight(x, Math.sign(z) * (Math.abs(z) - 4));
      const g = new THREE.DodecahedronGeometry(1.6 + Math.sin(x) * 0.4, 0);
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, Math.max(h, -3) + 0.6, z + Math.sin(x * 3) * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(x, x * 0.7, 0)), new THREE.Vector3(1, 0.8, 1));
      B.geometry('rock', g, mtx);
    }
    // rocks block walking/driving along the jetty line
    cw.add({ type: 'box', cx: (ISLAND.sandStart + ISLAND.shore + 40) / 2, cz: z, hx: (ISLAND.shore + 40 - ISLAND.sandStart) / 2, hz: 1.5, y0: -6, y1: 1.6, material: 'concrete' });
  }
  // bay / canal floor and the deep ocean bed
  B.flat('seabed', -1400, ISLAND.sandStart, -1400, 1400, -4.25, 20);
  B.flat('deepbed', ISLAND.sandStart, 2600, -1400, 1400, -22, 40);

  // mainland stub at the end of the causeway
  const M = MAINLAND;
  B.box('seawall', M.west, M.east, -4.3, 0, M.north, M.south, { sides: { top: false }, tile: [4, 4] });
  B.flat('lot', M.west, M.east, M.north, M.south, 0, 8);
  B.flat('marking_y', M.barrierX - 1, M.barrierX + 0.3, -9, 9, 0.012);
}

/** Thin oriented stripe on the road. (cx, cz) centre, d unit direction. */
function stripe(B, key, cx, cz, dx, dz, len, w, y = 0.014) {
  const hx = (dx * len) / 2, hz = (dz * len) / 2;
  const rx = -dz * (w / 2), rz = dx * (w / 2);
  B.quad(key, [
    [cx - hx - rx, y, cz - hz - rz], [cx - hx + rx, y, cz - hz + rz],
    [cx + hx + rx, y, cz + hz + rz], [cx + hx - rx, y, cz + hz - rz],
  ], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

function buildRoads(B) {
  for (const s of ROADS) {
    const hw = segHalfWidth(s);
    if (s.twin) {
      // the two carriageways on land at each end (the decks themselves are built with the bridge)
      for (const sx of [-1, 1]) {
        const xa = s.c + sx * TWIN.median / 2, xb = s.c + sx * hw;
        B.flat('asphalt', Math.min(xa, xb), Math.max(xa, xb), s.from, TWIN.zStart, 0, 8);
        B.flat('asphalt', Math.min(xa, xb), Math.max(xa, xb), TWIN.zEnd, s.to + roadHalfWidth(1), 0, 8);
      }
      continue;
    }
    if (s.dir === 'ns') B.flat('asphalt', s.c - hw, s.c + hw, s.from - hw, s.to + hw, 0, 8);
    else if (s.bridge) B.flat('asphalt', ISLAND.west, s.to + hw, s.c - hw, s.c + hw, 0, 8);
    else B.flat('asphalt', s.from - hw, s.to + hw, s.c - hw, s.c + hw, 0, 8);
  }
  const { nodes, edges } = ROAD_GRAPH;
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    if (e.road === 'causeway' || e.road === 'twinspan') continue; // markings drawn on the deck
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    const along = dx ? 'x' : 'z';
    const ha = along === 'x' ? a.hx : a.hz, hb = along === 'x' ? b.hx : b.hz;
    const start = (along === 'x' ? a.x : a.z) + (dx + dz) * (ha + 1);
    const end = (along === 'x' ? b.x : b.z) - (dx + dz) * (hb + 1);
    const len = Math.abs(end - start);
    const mid = (start + end) / 2;
    const cx = along === 'x' ? mid : a.x, cz = along === 'x' ? a.z : mid;
    const ux = Math.abs(dx), uz = Math.abs(dz);
    // perpendicular offset helper
    const off = (o) => [cx + -uz * o, cz + ux * o];
    if (e.lanes === 2) {
      for (const o of [-0.16, 0.16]) { const [x, z] = off(o); stripe(B, 'marking_y', x, z, ux, uz, len, 0.12); }
      for (const o of [-LANE_W, LANE_W]) {
        for (let t = -len / 2 + 2; t < len / 2 - 3; t += 9) {
          const [x, z] = off(o); stripe(B, 'marking_w', x + ux * (t + 1.5), z + uz * (t + 1.5), ux, uz, 3, 0.12);
        }
      }
    } else {
      for (let t = -len / 2 + 2; t < len / 2 - 3; t += 7) { const [x, z] = off(0); stripe(B, 'marking_y', x + ux * (t + 1.5), z + uz * (t + 1.5), ux, uz, 3.5, 0.12); }
    }
    for (const o of [-(e.lanes * LANE_W), e.lanes * LANE_W]) { const [x, z] = off(o); stripe(B, 'marking_w', x, z, ux, uz, len, 0.12); }
  }
  // stop lines and zebra crossings at signalised intersections
  for (const n of nodes) {
    if (!n.signal) continue;
    for (const eid of n.edges) {
      const e = edges[eid];
      const o = nodes[e.a === n.id ? e.b : e.a];
      const dx = Math.sign(o.x - n.x), dz = Math.sign(o.z - n.z);
      const h = dx ? n.hx : n.hz;
      const hw = roadHalfWidth(e.lanes);
      // zebra just outside the box
      const zc = h + 2.2;
      for (let k = -hw + 0.6; k < hw - 0.3; k += 1.25) {
        const x = n.x + dx * zc + (dz ? k : 0), z = n.z + dz * zc + (dx ? k : 0);
        stripe(B, 'marking_w', x, z, Math.abs(dx), Math.abs(dz), 3.2, 0.6);
      }
      // stop line across the incoming (right-hand) lanes — traffic arrives heading -d
      const sl = h + 4.4;
      const rx = dz, rz = -dx; // right of the incoming direction (-dx,-dz)
      const lw = e.lanes * LANE_W;
      stripe(B, 'marking_w', n.x + dx * sl + rx * lw / 2, n.z + dz * sl + rz * lw / 2, Math.abs(dz), Math.abs(dx), lw, 0.45);
    }
  }
}

function buildBeach(group, mats) {
  // heightfield from the promenade wall out to deep water
  const x0 = ISLAND.sandStart, x1 = 430, z0 = -330, z1 = 330;
  const nx = Math.round((x1 - x0) / 2), nz = Math.round((z1 - z0) / 3);
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (x0 + x1) / 2, z = pos.getZ(i) + (z0 + z1) / 2;
    pos.setXYZ(i, x, terrainHeight(x, z), z);
    uv.setXY(i, x / 10, -z / 10);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.sand);
  mesh.receiveShadow = true;
  mesh.name = 'beach';
  group.add(mesh);
}

function buildCauseway(B, cw) {
  const c = CAUSEWAY;
  const hw = roadHalfWidth(c.lanes);
  const step = 6;
  for (let x = c.xStart; x > c.xEnd; x -= step) {
    const xa = x, xb = Math.max(c.xEnd, x - step);
    const ya = causewayDeck(xa), yb = causewayDeck(xb);
    // deck top (asphalt), underside and fascia
    B.quad('asphalt', [[xb, yb, c.z + hw], [xa, ya, c.z + hw], [xa, ya, c.z - hw], [xb, yb, c.z - hw]], [[xb / 8, -(c.z + hw) / 8], [xa / 8, -(c.z + hw) / 8], [xa / 8, -(c.z - hw) / 8], [xb / 8, -(c.z - hw) / 8]]);
    B.quad('seawall', [[xa, ya - 1.2, c.z + hw + 0.6], [xb, yb - 1.2, c.z + hw + 0.6], [xb, yb - 1.2, c.z - hw - 0.6], [xa, ya - 1.2, c.z - hw - 0.6]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    for (const s of [-1, 1]) {
      const z = c.z + s * (hw + 0.3);
      // parapet: a sloped box approximated by a quad strip on each face
      const zi = z - s * 0.3, zo = z + s * 0.3;
      const pa = ya + 1.05, pb = yb + 1.05;
      B.quad('seawall', s > 0 ? [[xb, ya - 1.2 + (yb - ya), zo], [xa, ya - 1.2, zo], [xa, pa, zo], [xb, pb, zo]] : [[xa, ya - 1.2, zo], [xb, yb - 1.2, zo], [xb, pb, zo], [xa, pa, zo]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.quad('curb', s > 0 ? [[xa, ya, zi], [xb, yb, zi], [xb, pb, zi], [xa, pa, zi]] : [[xb, yb, zi], [xa, ya, zi], [xa, pa, zi], [xb, pb, zi]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.quad('curb', [[xa, pa, Math.min(zi, zo)], [xb, pb, Math.min(zi, zo)], [xb, pb, Math.max(zi, zo)], [xa, pa, Math.max(zi, zo)]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      cw.add({ type: 'box', cx: (xa + xb) / 2, cz: z, hx: step / 2 + 0.2, hz: 0.3, y0: Math.min(ya, yb) - 1.5, y1: Math.max(ya, yb) + 1.05, tag: 'railing', material: 'concrete' });
    }
    // lane markings on the deck
    const mx = (xa + xb) / 2, my = (ya + yb) / 2 + 0.02;
    const len = Math.hypot(xa - xb, ya - yb);
    for (const o of [-0.16, 0.16]) B.quad('marking_y', [[xb, yb + 0.02, c.z + o - 0.06], [xb, yb + 0.02, c.z + o + 0.06], [xa, ya + 0.02, c.z + o + 0.06], [xa, ya + 0.02, c.z + o - 0.06]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    if (Math.floor(x / step) % 2 === 0) for (const o of [-LANE_W, LANE_W]) B.quad('marking_w', [[mx - 1.5, my, c.z + o - 0.06], [mx - 1.5, my, c.z + o + 0.06], [mx + 1.5, my, c.z + o + 0.06], [mx + 1.5, my, c.z + o - 0.06]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    void len;
  }
  // piers
  for (let x = c.xStart - 24; x > c.xEnd + 10; x -= 24) {
    const y = causewayDeck(x);
    if (y < 1.5) continue;
    for (const s of [-1, 1]) {
      B.box('seawall', x - 0.9, x + 0.9, -4.3, y - 1.2, c.z + s * 4.5 - 0.9, c.z + s * 4.5 + 0.9, { tile: [3, 3] });
      cw.add({ type: 'box', cx: x, cz: c.z + s * 4.5, hx: 0.9, hz: 0.9, y0: -6, y1: y - 1.2, material: 'concrete' });
    }
    B.box('seawall', x - 1.2, x + 1.2, y - 2, y - 1.2, c.z - 7, c.z + 7, { tile: [3, 3] });
  }
  // unfinished extension from the mainland stub toward downtown (visual only)
  for (let x = MAINLAND.west - 18; x > BACKDROP.downtownX + 20; x -= 26) {
    for (const s of [-1, 1]) B.box('seawall', x - 0.9, x + 0.9, -4.3, 5.3, c.z + s * 4.5 - 0.9, c.z + s * 4.5 + 0.9, { tile: [3, 3] });
    if (x > MAINLAND.west - 80) B.box('seawall', x - 13, x + 13, 5.3, 6.5, c.z - hw, c.z + hw, { tile: [4, 4] });
  }
}

/**
 * Cayo Lento: low limestone-edged land with grass, a sandy south shore, the
 * shallow flats around it, and the further keys of the chain (backdrop).
 */
function buildKeys(B, group, mats, cw) {
  const K = KEYS, top = CURB, tw = TWIN.median / 2 + TWIN.deckW;
  // land = the key's rectangle minus its roads: split on every road edge and keep the non-road cells
  const xs = new Set([K.x0, K.x1, TWIN.x - tw, TWIN.x - TWIN.median / 2, TWIN.x + TWIN.median / 2, TWIN.x + tw]);
  const zs = new Set([K.z0, K.z1]);
  for (const sg of ROADS) {
    if (!sg.keys && !sg.twin) continue;
    const hw = sg.twin ? 0 : roadHalfWidth(sg.lanes);
    if (sg.dir === 'ns') { if (!sg.twin) { xs.add(sg.c - hw); xs.add(sg.c + hw); } zs.add(sg.from - hw); zs.add(sg.to + (sg.twin ? roadHalfWidth(1) : hw)); }
    else { zs.add(sg.c - hw); zs.add(sg.c + hw); xs.add(sg.from - hw); xs.add(sg.to + hw); }
  }
  const X = [...xs].filter((x) => x >= K.x0 && x <= K.x1).sort((a, b) => a - b), Z = [...zs].filter((z) => z >= K.z0 && z <= K.z1).sort((a, b) => a - b);
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
    const x0 = X[i], x1 = X[i + 1], z0 = Z[j], z1 = Z[j + 1];
    if (x1 - x0 < 0.01 || z1 - z0 < 0.01 || roadAt((x0 + x1) / 2, (z0 + z1) / 2)) continue;
    B.box('curb', x0, x1, 0, top, z0, z1, { sides: { top: false }, tile: [2, 2] });
    B.flat('grass', x0, x1, z0, z1, top, 6);
  }
  // sandy south shore and a coral-rock edge all round, down to the flats
  B.flat('sand', K.x0 + 1, K.x1 - 1, K.shoreZ + roadHalfWidth(1) + 0.5, K.z1, top + 0.01, 5);
  const fy = FLATS.y;
  B.box('keyrock', K.x0 - 0.8, K.x0, fy, top, K.z0, K.z1, { tile: [3, 3] });
  B.box('keyrock', K.x1, K.x1 + 0.8, fy, top, K.z0, K.z1, { tile: [3, 3] });
  for (const [x0, x1] of [[K.x0 - 0.8, TWIN.x - tw], [TWIN.x - TWIN.median / 2, TWIN.x + TWIN.median / 2], [TWIN.x + tw, K.x1 + 0.8]]) B.box('keyrock', x0, x1, fy, top, K.z0 - 0.8, K.z0, { tile: [3, 3] });
  for (const sx of [-1, 1]) B.box('keyrock', TWIN.x + sx * TWIN.median / 2 - 0.3, TWIN.x + sx * TWIN.median / 2 + 0.3, fy, 0, K.z0 - 0.8, K.z0, { tile: [3, 3] });
  B.box('keyrock', K.x0 - 0.8, K.x1 + 0.8, fy, top, K.z1, K.z1 + 0.8, { tile: [3, 3] });
  // the flats: a shallow sandy bottom (heightfield) that makes the water turquoise
  const nx = 98, nz = 56;
  const geo = new THREE.PlaneGeometry(FLATS.x1 - FLATS.x0, FLATS.z1 - FLATS.z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (FLATS.x0 + FLATS.x1) / 2, z = pos.getZ(i) + (FLATS.z0 + FLATS.z1) / 2;
    const h = terrainHeight(x, z);
    pos.setXYZ(i, x, Math.min(h, FLATS.y + 0.4), z);
    uv.setXY(i, x / 9, -z / 9);
  }
  geo.computeVertexNormals();
  const flats = new THREE.Mesh(geo, mats.flats);
  flats.receiveShadow = true;
  flats.name = 'flats';
  group.add(flats);
  // further keys of the chain (visible, not reachable)
  for (const k of BACKDROP.keys) {
    B.box('keyrock', k.x0, k.x1, fy, top, k.z0, k.z1, { sides: { top: false }, tile: [3, 3] });
    B.flat('grass', k.x0, k.x1, k.z0, k.z1, top, 6);
    cw.add({ type: 'box', cx: (k.x0 + k.x1) / 2, cz: (k.z0 + k.z1) / 2, hx: (k.x1 - k.x0) / 2, hz: (k.z1 - k.z0) / 2, y0: -10, y1: 40, material: 'concrete' });
  }
}

/**
 * The twin-span: two parallel decks (southbound on the west deck, northbound
 * on the east) with an open gap between them, parapets on both edges of each
 * deck, lane markings, and paired piers with hammerhead caps.
 */
function buildTwinSpan(B, cw) {
  const T0 = TWIN, step = 6;
  const nodeSouth = STREETS[STREETS.length - 1].z + roadHalfWidth(STREETS[STREETS.length - 1].lanes);
  medianPlanter(B, cw, nodeSouth + 6, T0.zStart + 0.6);
  medianPlanter(B, cw, T0.zEnd - 0.8, KEYS.hwyZ - roadHalfWidth(1) - 2);
  // guide walls funnel each lane onto its deck (southbound at the Ocean Mile end, northbound at the key)
  const inner = T0.median / 2 + 0.12;
  guideWall(B, cw, T0.x - 1, nodeSouth + 2.5, T0.x - inner, T0.zStart + 0.2);
  guideWall(B, cw, T0.x + 1, KEYS.hwyZ - roadHalfWidth(1) - 2.5, T0.x + inner, T0.zEnd - 0.2);
  for (let z = T0.zStart; z < T0.zEnd; z += step) {
    const za = z, zb = Math.min(T0.zEnd, z + step);
    const ya = twinDeck(za), yb = twinDeck(zb);
    for (const sx of [-1, 1]) {
      const xi = T0.x + sx * T0.median / 2, xo = T0.x + sx * (T0.median / 2 + T0.deckW);
      const xl = Math.min(xi, xo), xr = Math.max(xi, xo);
      B.quad('asphalt', [[xl, ya, za], [xl, yb, zb], [xr, yb, zb], [xr, ya, za]], [[xl / 8, -za / 8], [xl / 8, -zb / 8], [xr / 8, -zb / 8], [xr / 8, -za / 8]]);
      B.quad('seawall', [[xl - 0.5, ya - 1.1, za], [xr + 0.5, ya - 1.1, za], [xr + 0.5, yb - 1.1, zb], [xl - 0.5, yb - 1.1, zb]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      for (const [px, out] of [[xl, -1], [xr, 1]]) {
        // parapet: outer face, inner face, cap
        const xo2 = px + out * 0.35, xi2 = px;
        const pa = ya + 1.0, pb = yb + 1.0;
        B.quad('seawall', out > 0 ? [[xo2, ya - 1.1, za], [xo2, yb - 1.1, zb], [xo2, pb, zb], [xo2, pa, za]] : [[xo2, yb - 1.1, zb], [xo2, ya - 1.1, za], [xo2, pa, za], [xo2, pb, zb]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        B.quad('curb', out > 0 ? [[xi2, yb, zb], [xi2, ya, za], [xi2, pa, za], [xi2, pb, zb]] : [[xi2, ya, za], [xi2, yb, zb], [xi2, pb, zb], [xi2, pa, za]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        B.quad('curb', [[Math.min(xi2, xo2), pa, za], [Math.min(xi2, xo2), pb, zb], [Math.max(xi2, xo2), pb, zb], [Math.max(xi2, xo2), pa, za]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        cw.add({ type: 'box', cx: px + out * 0.17, cz: (za + zb) / 2, hx: 0.22, hz: step / 2 + 0.2, y0: Math.min(ya, yb) - 1.5, y1: Math.max(ya, yb) + 1.0, tag: 'railing', material: 'concrete' });
      }
      // edge lines and the centre dashes of the lane
      const lane = T0.x + sx * (T0.median / 2 + 0.35);
      const edge = T0.x + sx * (T0.median / 2 + LANE_W + 0.05);
      for (const [lx, key] of [[lane, 'marking_y'], [edge, 'marking_w']]) B.quad(key, [[lx - 0.06, ya + 0.02, za], [lx - 0.06, yb + 0.02, zb], [lx + 0.06, yb + 0.02, zb], [lx + 0.06, ya + 0.02, za]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  // piers
  for (let z = T0.zStart + 22; z < T0.zEnd - 8; z += 22) {
    const y = twinDeck(z);
    if (y < 1.2) continue;
    for (const sx of [-1, 1]) {
      const cx = T0.x + sx * (T0.median / 2 + T0.deckW / 2);
      for (const o of [-1.6, 1.6]) {
        B.box('seawall', cx + o - 0.55, cx + o + 0.55, -4.3, y - 1.1, z - 0.55, z + 0.55, { tile: [3, 3] });
        cw.add({ type: 'box', cx: cx + o, cz: z, hx: 0.55, hz: 0.55, y0: -6, y1: y - 1.1, material: 'concrete' });
      }
      B.box('seawall', cx - T0.deckW / 2 - 0.4, cx + T0.deckW / 2 + 0.4, y - 1.9, y - 1.1, z - 0.9, z + 0.9, { tile: [3, 3] });
    }
  }
}

/** A raised planter along the median where the twin-span meets land: cars can't mount it and drop into the gap. */
function medianPlanter(B, cw, z0, z1) {
  // narrower than the median so cars turning in from the junction clear it; the gap that's left
  // beside it is closed off by the ends of the deck railings
  const x0 = TWIN.x - 1, x1 = TWIN.x + 1, h = 0.6;
  B.box('curb', x0, x1, 0, h, z0, z1, { sides: { top: false }, tile: [2, 2] });
  B.flat('grass', x0 + 0.15, x1 - 0.15, z0 + 0.15, z1 - 0.15, h, 4);
  cw.add({ type: 'box', cx: TWIN.x, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: -1, y1: h + 0.5, tag: 'railing', material: 'concrete', cameraBlock: false });
}

/** Bayshore Park: lawns, crossing paths, a basketball court. */
function buildPark(B) {
  const P = PLACES.park, b = P.bounds, y = CURB + 0.012;
  B.flat('grass', b.x0, b.x1, b.z0, b.z1, y, 6);
  B.flat('pavers', P.x - 1.6, P.x + 1.6, b.z0, b.z1, y + 0.004, 4);
  B.flat('pavers', b.x0, b.x1, P.fountain.z - 1.6, P.fountain.z + 1.6, y + 0.004, 4);
  const c = P.court;
  B.flat('trim', c.x0 - 1, c.x1 + 1, c.z0 - 1, c.z1 + 1, y + 0.006, 1, col(0x2f7a54));
  B.flat('trim', c.x0, c.x1, c.z0, c.z1, y + 0.008, 1, col(0x3a6fb5));
  const line = (x0, x1, z0, z1) => B.flat('marking_w', x0, x1, z0, z1, y + 0.012);
  line(c.x0, c.x1, c.z0, c.z0 + 0.1); line(c.x0, c.x1, c.z1 - 0.1, c.z1); line(c.x0, c.x0 + 0.1, c.z0, c.z1); line(c.x1 - 0.1, c.x1, c.z0, c.z1);
  line(c.x0, c.x1, (c.z0 + c.z1) / 2 - 0.05, (c.z0 + c.z1) / 2 + 0.05);
  for (const z of [c.z0, c.z1 - 5.8]) { const cx = (c.x0 + c.x1) / 2; line(cx - 2.4, cx + 2.4, z, z + 0.1); line(cx - 2.4, cx + 2.4, z + 5.7, z + 5.8); line(cx - 2.4, cx - 2.3, z, z + 5.8); line(cx + 2.3, cx + 2.4, z, z + 5.8); }
}

/**
 * Coral Auto Body: a workshop with an open drive-in bay on its frontage
 * (three walls and a roof around the bay), a roller door above it and a sign.
 */
function buildGarage(B, b, cw, signs, group) {
  const y0 = CURB, top = y0 + b.h, color = col(b.color), accent = col(b.accent), t = 0.3;
  const wall = (x0, x1, z0, z1, ya = y0, yb = top) => {
    B.box('fac:shop', x0, x1, ya, yb, z0, z1, { tile: [6, 4], vBase: y0, color });
    cw.add({ type: 'box', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: -1, y1: yb + 0.5, material: 'concrete', tag: 'wall' });
  };
  const { z0: bz0, z1: bz1 } = b.bay, bh = 4.4;
  wall(b.x0, b.x0 + t, b.z0, b.z1); // back
  wall(b.x0, b.x1, b.z0, b.z0 + t); wall(b.x0, b.x1, b.z1 - t, b.z1); // ends
  wall(b.x0, b.x1, bz0 - t, bz0); wall(b.x0, b.x1, bz1, bz1 + t); // bay sides
  wall(b.x1 - t, b.x1, b.z0, bz0 - t); wall(b.x1 - t, b.x1, bz1 + t, b.z1); // front either side of the bay
  B.box('fac:shop', b.x1 - t, b.x1, y0 + bh, top, bz0, bz1, { tile: [6, 4], vBase: y0, color }); // header over the opening
  B.box('roof', b.x0, b.x1, top, top + 0.25, b.z0, b.z1, { tile: [6, 6] });
  B.box('trim', b.x1 - 0.05, b.x1 + 0.35, y0 + bh - 0.1, y0 + bh + 0.5, bz0 - 0.3, bz1 + 0.3, { color: accent }); // rolled-up door
  B.flat('concrete', b.x0 + t, b.x1, bz0, bz1, y0 + 0.01, 3);
  B.box('lightpanel', b.x0 + 1, b.x1 - 1, y0 + bh - 0.06, y0 + bh - 0.02, bz0 + 1, bz1 - 1, { sides: { bottom: true, top: false, n: false, s: false, e: false, w: false } });
  B.box('metal', b.x0 + 0.4, b.x0 + 1.2, y0, y0 + 1.6, bz0 + 1, bz0 + 3.5, { color: col(0xc0392b) }); // tool chests
  cw.add({ type: 'box', cx: b.x0 + 0.8, cz: bz0 + 2.25, hx: 0.4, hz: 1.25, y0: -1, y1: y0 + 1.6, material: 'metal', tag: 'prop', cameraBlock: false });
  const s = makeSign(b.sign, { fg: '#ffffff', bg: '#' + accent.clone().multiplyScalar(0.8).getHexString(), font: '700 60px "Trebuchet MS", Arial' }, (b.z1 - b.z0) * 0.8, 1.0);
  s.position.set(b.x1 + 0.08, top - 1.1, (b.z0 + b.z1) / 2); s.rotation.y = Math.PI / 2;
  group.add(s); signs.push(s);
}

/** A low concrete guide wall between two points: deflects a car that strays toward the gap back into its lane. */
function guideWall(B, cw, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
  const g = new THREE.BoxGeometry(0.4, 0.9, len);
  B.geometry('curb', g, new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, 0.45, (z0 + z1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));
  cw.add({ type: 'box', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: 0.2, hz: len / 2, angle: ang, y0: -1, y1: 1.1, tag: 'railing', material: 'concrete', cameraBlock: false });
}

/** A raised wooden stilt house with a pitched tin roof, stairs and a porch. */
function buildStilt(B, b, cw) {
  const y0 = CURB, lift = 2.6, wallTop = y0 + lift + 3.2, ridge = wallTop + 1.7;
  const color = col(b.color), white = col(0xf6f4ee), post = col(0x8a7458), tin = col(0xb9c1c6);
  for (const [x, z] of [[b.x0 + 0.4, b.z0 + 0.4], [b.x1 - 0.4, b.z0 + 0.4], [b.x1 - 0.4, b.z1 - 0.4], [b.x0 + 0.4, b.z1 - 0.4], [(b.x0 + b.x1) / 2, b.z0 + 0.4], [(b.x0 + b.x1) / 2, b.z1 - 0.4]]) {
    B.box('trim', x - 0.18, x + 0.18, y0, y0 + lift, z - 0.18, z + 0.18, { color: post });
    cw.add({ type: 'circle', cx: x, cz: z, r: 0.2, y0: -1, y1: y0 + lift, material: 'wood', cameraBlock: false });
  }
  B.box('wood', b.x0, b.x1, y0 + lift - 0.25, y0 + lift, b.z0, b.z1, { tile: [3, 3] });
  B.box('fac:residential', b.x0 + 0.6, b.x1 - 0.6, y0 + lift, wallTop, b.z0 + 0.6, b.z1 - 0.6, { tile: T.FACADE_TILE, vBase: y0 + lift, color });
  cw.add({ type: 'box', cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, hx: (b.x1 - b.x0) / 2 - 0.6, hz: (b.z1 - b.z0) / 2 - 0.6, y0: y0 + lift - 0.3, y1: ridge, material: 'wood', data: { building: b } });
  // pitched roof along x (gable ends east and west)
  const zc = (b.z0 + b.z1) / 2, x0 = b.x0 - 0.3, x1 = b.x1 + 0.3, za = b.z0 - 0.3, zb = b.z1 + 0.3;
  B.quad('trim', [[x0, wallTop, za], [x1, wallTop, za], [x1, ridge, zc], [x0, ridge, zc]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]], tin);
  B.quad('trim', [[x0, wallTop, zb], [x0, ridge, zc], [x1, ridge, zc], [x1, wallTop, zb]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]], tin);
  for (const gx of [b.x0 + 0.6, b.x1 - 0.6]) B.quad('trim', gx < zc ? [[gx, wallTop, b.z0 + 0.6], [gx, wallTop, b.z1 - 0.6], [gx, ridge, zc], [gx, ridge, zc]] : [[gx, wallTop, b.z1 - 0.6], [gx, wallTop, b.z0 + 0.6], [gx, ridge, zc], [gx, ridge, zc]], [[0, 0], [1, 0], [0.5, 1], [0.5, 1]], color);
  // porch rail and stairs on the frontage side
  const F = frontage(b);
  const pz = F.nz ? (F.nz > 0 ? b.z1 : b.z0) : zc;
  B.box('trim', b.x0, b.x1, y0 + lift, y0 + lift + 1.0, pz - 0.05, pz + 0.05, { color: white });
  const sx = b.x1 - 2.2, dir = F.nz || 1;
  for (let k = 0; k < 8; k++) { const y = y0 + lift - (k + 1) * (lift / 8); const z = pz + dir * (0.4 + k * 0.32); B.box('wood', sx - 0.6, sx + 0.6, y - 0.08, y, Math.min(z, z + dir * 0.32), Math.max(z, z + dir * 0.32), { tile: [1, 1] }); }
}

/** Neon tube along a line (box with small cross-section). */
function neonLine(B, x0, y0, z0, x1, y1, z1, color, t = 0.12) {
  B.box('neon', Math.min(x0, x1) - t / 2, Math.max(x0, x1) + t / 2, Math.min(y0, y1) - t / 2, Math.max(y0, y1) + t / 2, Math.min(z0, z1) - t / 2, Math.max(z0, z1) + t / 2, { color: col(color), sides: { bottom: true } });
}

/** Text sign mesh on a facade. */
function makeSign(text, opts, w, h) {
  const tex = T.signTexture(text, opts);
  const aspect = tex.userData.aspect;
  const width = Math.min(w, h * aspect);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: !opts.bg, alphaTest: opts.bg ? 0 : 0.1, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: opts.neon ? 0.35 : 0.08, roughness: 0.6, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), mat);
  mesh.userData.neonSign = !!opts.neon;
  return mesh;
}

/** Facing helper: returns the frontage plane coordinate and a function to place things on it. */
function frontage(b) {
  const f = b.frontage;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const width = f === 'e' || f === 'w' ? b.z1 - b.z0 : b.x1 - b.x0;
  const nx = f === 'e' ? 1 : f === 'w' ? -1 : 0, nz = f === 's' ? 1 : f === 'n' ? -1 : 0;
  const px = f === 'e' ? b.x1 : f === 'w' ? b.x0 : cx;
  const pz = f === 's' ? b.z1 : f === 'n' ? b.z0 : cz;
  const rot = Math.atan2(nx, nz);
  // u axis along the facade (to the right when facing it)
  const ux = -nz, uz = nx;
  return { nx, nz, px, pz, cx, cz, width, rot, ux, uz };
}

function buildBuilding(B, b, cw, signs, group, rnd) {
  const y0 = CURB;
  const top = y0 + b.h;
  const color = col(b.color), accent = col(b.accent);
  const F = frontage(b);
  const fk = { e: 'e', w: 'w', n: 'n', s: 's' }[b.frontage];
  const fac = 'fac:' + b.style;
  const tile = T.FACADE_TILE;
  const hasShopfront = ['shop', 'deco', 'civic'].includes(b.style);

  if (b.style === 'store') return buildStore(B, b, cw, signs, group);
  if (b.style === 'stilt') return buildStilt(B, b, cw);
  if (b.style === 'garage') return buildGarage(B, b, cw, signs, group);
  if (b.style === 'club') return buildClub(B, b, cw, signs, group);

  if (hasShopfront) {
    const keys = { [fk]: b.style === 'deco' ? 'front:deco' : 'front:shop' };
    B.box(fac, b.x0, b.x1, y0, y0 + 4, b.z0, b.z1, { keys, tile: [6, 4], vBase: y0, color, sides: { top: false } });
    B.box(fac, b.x0, b.x1, y0 + 4, top, b.z0, b.z1, { keys: { top: 'roof' }, tile, vBase: y0 + 4 - 0.6, color, topTile: 6 });
  } else {
    B.box(fac, b.x0, b.x1, y0, top, b.z0, b.z1, { keys: { top: 'roof' }, tile, vBase: y0, color, topTile: 6 });
  }
  cw.add({ type: 'box', cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, hx: (b.x1 - b.x0) / 2, hz: (b.z1 - b.z0) / 2, y0: -2, y1: top + 1.2, material: 'concrete', data: { building: b } });

  // cornice / parapet band
  const cornice = b.style === 'tower' ? 0.6 : 0.9;
  B.box('trim', b.x0 - 0.18, b.x1 + 0.18, top - 0.3, top + cornice, b.z0 - 0.18, b.z1 + 0.18, { color: b.style === 'deco' ? col(0xffffff) : color.clone().multiplyScalar(0.92), sides: { top: false } });
  B.box('roof', b.x0 + 0.1, b.x1 - 0.1, top + cornice - 0.05, top + cornice - 0.04, b.z0 + 0.1, b.z1 - 0.1, { sides: { n: false, s: false, e: false, w: false } });

  // rooftop clutter
  const nAc = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < nAc; i++) {
    const ax = b.x0 + 2 + rnd() * Math.max(0.5, b.x1 - b.x0 - 5), az = b.z0 + 2 + rnd() * Math.max(0.5, b.z1 - b.z0 - 5);
    B.box('metal', ax, ax + 1.6, top, top + 1.1, az, az + 1.2, { color: col(0xb9bcbf) });
  }
  if (b.style === 'residential' && rnd() < 0.6) {
    const ax = b.x0 + 3, az = b.z0 + 3;
    B.box('trim', ax, ax + 2.2, top + 0.6, top + 3, az, az + 2.2, { color: col(0x8b6a50) });
  }

  // a point on the frontage: along-facade offset u, height y, out offset o
  const at = (u, y, o = 0) => [F.px + F.ux * u + F.nx * o, y, F.pz + F.uz * u + F.nz * o];

  if (b.style === 'deco') {
    // eyebrow ledges over each upper floor, a central fin with neon, a name sign
    const floors = Math.floor((b.h - 4) / 3.4);
    for (let f = 0; f < floors; f++) {
      const y = y0 + 4 + f * 3.4 + 2.75;
      ledge(B, F, -F.width / 2 + 0.6, F.width / 2 - 0.6, y, 0.75, 0.16, col(0xffffff));
    }
    const finH = top + 2;
    const fx = at(0, 0, 0.5);
    const finBox = F.nx ? [fx[0] - 0.5, fx[0] + 0.5, fx[2] - 1.1, fx[2] + 1.1] : [fx[0] - 1.1, fx[0] + 1.1, fx[2] - 0.5, fx[2] + 0.5];
    B.box('trim', finBox[0], finBox[1], y0 + 4, finH, finBox[2], finBox[3], { color: accent });
    const nc = b.neon;
    const o = at(0, 0, 1.15);
    neonLine(B, o[0], y0 + 4.2, o[2], o[0], finH, o[2], nc, 0.14);
    // neon along the roofline of the frontage
    const l = at(-F.width / 2 + 0.3, top + 0.95, 0.22), r = at(F.width / 2 - 0.3, top + 0.95, 0.22);
    neonLine(B, l[0], l[1], l[2], r[0], r[1], r[2], nc, 0.1);
    // canopy over the entrance
    ledge(B, F, -3, 3, y0 + 3.6, 2.4, 0.25, accent);
    if (b.sign) {
      const s = makeSign(b.sign, { fg: '#fffdf6', neon: '#' + col(nc).getHexString(), script: true }, F.width * 0.8, 1.6);
      const p = at(F.width * 0.22, top - 1.4, 0.05);
      s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
      if (F.width < 14) s.position.set(...at(0, top - 1.4, 0.05));
      group.add(s); signs.push(s);
    }
    if (b.club) clubDressing(B, F, at, y0, top, group, signs);
  } else if (b.style === 'shop') {
    // awning + sign band above the storefront
    ledge(B, F, -F.width / 2 + 0.5, F.width / 2 - 0.5, y0 + 3.1, 1.5, 0.22, accent);
    if (b.sign) {
      const s = makeSign(b.sign, { fg: '#ffffff', bg: '#' + accent.clone().multiplyScalar(0.8).getHexString(), font: '700 60px "Trebuchet MS", Arial' }, F.width * 0.7, 0.75);
      const p = at(0, y0 + 3.75, 0.06);
      s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
      group.add(s); signs.push(s);
    }
    if (b.diner) {
      const s = makeSign('Tidewater Diner', { fg: '#fff6f8', neon: '#ff3fa4', script: true }, F.width * 0.9, 1.5);
      const p = at(0, top + 1.6, 0.1);
      s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
      group.add(s); signs.push(s);
      const l = at(-F.width / 2 + 0.3, y0 + 3.0, 1.4), r = at(F.width / 2 - 0.3, y0 + 3.0, 1.4);
      neonLine(B, l[0], l[1], l[2], r[0], r[1], r[2], 0x29e6ff, 0.08);
    }
  } else if (b.style === 'tower') {
    // projecting balconies with glass rails on the ocean side, crown on top
    for (let y = y0 + 6; y < top - 2; y += 3.2) {
      ledge(B, F, -F.width / 2 + 1.5, F.width / 2 - 1.5, y, 1.6, 0.18, col(0xf6f6f2));
      ledge(B, F, -F.width / 2 + 1.5, F.width / 2 - 1.5, y + 0.95, 1.6, 0.06, col(0x9ec4d6));
    }
    B.box('trim', b.x0 + 3, b.x1 - 3, top + 0.6, top + 4, b.z0 + 3, b.z1 - 3, { color: accent });
    // podium glass lobby
    const p0 = at(-F.width / 2 + 2, 0, 0.02), p1 = at(F.width / 2 - 2, 0, 0.02);
    glassPane(B, p0, p1, y0, y0 + 4.5);
  } else if (b.style === 'motel') {
    // upper walkway, rail and posts on the frontage
    ledge(B, F, -F.width / 2, F.width / 2, y0 + 3.4, 1.8, 0.2, col(0xe9dfc6));
    ledge(B, F, -F.width / 2, F.width / 2, y0 + 4.35, 1.75, 0.08, accent);
    for (let u = -F.width / 2 + 0.3; u <= F.width / 2; u += 5) {
      const p = at(u, 0, 1.7);
      B.box('trim', p[0] - 0.12, p[0] + 0.12, y0, y0 + 4.4, p[2] - 0.12, p[2] + 0.12, { color: accent });
      cw.add({ type: 'circle', cx: p[0], cz: p[2], r: 0.14, y0: 0, y1: 4.4, material: 'metal', cameraBlock: false });
    }
    if (b.sign) {
      const s = makeSign(b.sign, { fg: '#e8fbff', neon: '#29e6ff' }, F.width * 0.8, 1.3);
      const p = at(0, top + 1.2, 0.05);
      s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
      group.add(s); signs.push(s);
    }
  } else if (b.style === 'civic') {
    ledge(B, F, -6, 6, y0 + 4.2, 3.5, 0.3, col(0xf4f4f4));
    for (const u of [-5.5, 5.5]) { const p = at(u, 0, 3.2); B.box('trim', p[0] - 0.2, p[0] + 0.2, y0, y0 + 4.2, p[2] - 0.2, p[2] + 0.2, { color: col(0xdddddd) }); cw.add({ type: 'circle', cx: p[0], cz: p[2], r: 0.22, y0: 0, y1: 4.2 }); }
    if (b.sign) {
      const s = makeSign(b.sign, { fg: '#ffffff', bg: '#' + accent.getHexString() }, F.width * 0.7, 1.4);
      const p = at(0, y0 + 5.6, 0.06);
      s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
      group.add(s); signs.push(s);
    }
  } else if (b.style === 'residential') {
    // small balconies
    const floors = Math.floor(b.h / 3.2);
    for (let f = 1; f < floors; f++) for (let u = -F.width / 2 + 3; u < F.width / 2 - 2; u += 6) ledgeAt(B, F, u, u + 2.6, y0 + f * 3.2 + 0.15, 1.1, 0.12, col(0xf2f2ee));
  }
}

/** A slab sticking out of the frontage between along-facade offsets u0..u1. */
function ledge(B, F, u0, u1, y, depth, thick, color) { ledgeAt(B, F, u0, u1, y, depth, thick, color); }
function ledgeAt(B, F, u0, u1, y, depth, thick, color) {
  const a = [F.px + F.ux * u0, F.pz + F.uz * u0], b = [F.px + F.ux * u1 + F.nx * depth, F.pz + F.uz * u1 + F.nz * depth];
  B.box('trim', Math.min(a[0], b[0]), Math.max(a[0], b[0]) + (F.nx ? 0 : 0), y, y + thick, Math.min(a[1], b[1]), Math.max(a[1], b[1]), { color, sides: { bottom: true } });
}

function glassPane(B, p0, p1, ya, yb, key = 'glass') {
  const nx = p1[2] - p0[2], nz = -(p1[0] - p0[0]);
  void nx; void nz;
  B.quad(key, [[p0[0], ya, p0[2]], [p1[0], ya, p1[2]], [p1[0], yb, p1[2]], [p0[0], yb, p0[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  if (key === 'glass') B.quad(key, [[p1[0], ya, p1[2]], [p0[0], ya, p0[2]], [p0[0], yb, p0[2]], [p1[0], yb, p1[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

function clubDressing(B, F, at, y0, top, group, signs) {
  // pink and cyan neon bands up the whole frontage, a velvet rope line
  for (let k = 0; k < 4; k++) {
    const u = -F.width / 2 + 1 + k * 0.35;
    const a = at(u, y0 + 0.5, 0.15), b = at(F.width / 2 - 1 - k * 0.35, y0 + 0.5, 0.15);
    neonLine(B, a[0], y0 + 4.5 + k * 0.3, a[2], b[0], y0 + 4.5 + k * 0.3, b[2], k % 2 ? 0x29e6ff : 0xff3fa4, 0.08);
  }
  for (let u = -3; u <= 3; u += 1.5) { const p = at(u, 0, 3.2); B.box('metal', p[0] - 0.06, p[0] + 0.06, y0, y0 + 1, p[2] - 0.06, p[2] + 0.06, { color: col(0xd4af37) }); }
  const s = makeSign('HALCYON', { fg: '#ffe9f6', neon: '#ff3fa4', font: '800 80px "Trebuchet MS", Arial' }, F.width * 0.6, 2);
  const p = at(0, y0 + 6.5, 0.2);
  s.position.set(p[0], p[1], p[2]); s.rotation.y = F.rot;
  group.add(s); signs.push(s);
  void top;
}

/** The enterable Sunny Stop: real walls with a doorway, shelves, counter, fridges. */
function buildStore(B, b, cw, signs, group) {
  const y0 = CURB, h = b.h, top = y0 + h;
  const wall = 0.3;
  const color = col(b.color), accent = col(b.accent);
  const dx0 = b.door.x - b.door.w / 2, dx1 = b.door.x + b.door.w / 2;
  const fac = 'fac:store';
  const addWall = (x0, x1, z0, z1, ya = -1, yb = top + 0.5) => cw.add({ type: 'box', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: ya, y1: yb, tag: 'wall', material: 'concrete' });
  // outer shell: south, east, west walls full; north wall has windows + door
  B.box(fac, b.x0, b.x1, y0, top, b.z1 - wall, b.z1, { tile: [6, 4], vBase: y0, color, sides: { n: false, top: true } });
  B.box(fac, b.x0, b.x0 + wall, y0, top, b.z0, b.z1, { tile: [6, 4], vBase: y0, color, sides: { e: false } });
  B.box(fac, b.x1 - wall, b.x1, y0, top, b.z0, b.z1, { tile: [6, 4], vBase: y0, color, sides: { w: false } });
  addWall(b.x0, b.x1, b.z1 - wall, b.z1); addWall(b.x0, b.x0 + wall, b.z0, b.z1); addWall(b.x1 - wall, b.x1, b.z0, b.z1);
  // north wall: low wall, glass band, header — split by the doorway
  for (const [a0, a1] of [[b.x0, dx0], [dx1, b.x1]]) {
    B.box('trim', a0, a1, y0, y0 + 0.9, b.z0, b.z0 + wall, { color });
    glassPane(B, [a0, 0, b.z0 + 0.1], [a1, 0, b.z0 + 0.1], y0 + 0.9, y0 + 3, 'window');
    addWall(a0, a1, b.z0, b.z0 + wall);
  }
  B.box('trim', b.x0, b.x1, y0 + 3, top, b.z0, b.z0 + wall, { color });
  // door frame
  for (const x of [dx0, dx1]) B.box('metal', x - 0.08, x + 0.08, y0, y0 + 3, b.z0 - 0.02, b.z0 + wall + 0.02, { color: col(0x909498) });
  // roof (also the ceiling seen from inside) and the interior floor
  B.box('roof', b.x0, b.x1, top - 0.2, top, b.z0, b.z1, { sides: { n: false, s: false, e: false, w: false, top: true } });
  B.quad('ceiling', [[b.x0, top - 0.6, b.z0], [b.x1, top - 0.6, b.z0], [b.x1, top - 0.6, b.z1], [b.x0, top - 0.6, b.z1]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.flat('tiles', b.x0 + wall, b.x1 - wall, b.z0 + wall, b.z1 - wall, y0 + 0.01, 2);
  // inner wall faces (light paint)
  const inner = col(0xf2efe6);
  B.quad('trim', [[b.x0 + wall, y0, b.z1 - wall], [b.x1 - wall, y0, b.z1 - wall], [b.x1 - wall, top - 0.6, b.z1 - wall], [b.x0 + wall, top - 0.6, b.z1 - wall]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]], inner);
  B.quad('trim', [[b.x0 + wall, y0, b.z0 + wall], [b.x0 + wall, y0, b.z1 - wall], [b.x0 + wall, top - 0.6, b.z1 - wall], [b.x0 + wall, top - 0.6, b.z0 + wall]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]], inner);
  B.quad('trim', [[b.x1 - wall, y0, b.z1 - wall], [b.x1 - wall, y0, b.z0 + wall], [b.x1 - wall, top - 0.6, b.z0 + wall], [b.x1 - wall, top - 0.6, b.z1 - wall]].reverse(), [[0, 0], [1, 0], [1, 1], [0, 1]], inner);
  // ceiling light panels
  for (let x = b.x0 + 3; x < b.x1 - 2; x += 5) for (let z = b.z0 + 3; z < b.z1 - 2; z += 5) B.quad('lightpanel', [[x, top - 0.62, z], [x + 1.2, top - 0.62, z], [x + 1.2, top - 0.62, z + 0.6], [x, top - 0.62, z + 0.6]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // counter along the east side (clerk stands behind it)
  const c = { x0: b.x1 - 5.2, x1: b.x1 - 4.4, z0: b.z0 + 2.5, z1: b.z0 + 10 };
  B.box('trim', c.x0, c.x1, y0, y0 + 1.05, c.z0, c.z1, { color: accent });
  B.box('trim', c.x0 - 0.1, c.x1 + 0.1, y0 + 1.05, y0 + 1.12, c.z0 - 0.1, c.z1 + 0.1, { color: col(0x3a3a3a) });
  cw.add({ type: 'box', cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2, hx: (c.x1 - c.x0) / 2, hz: (c.z1 - c.z0) / 2, y0: -1, y1: y0 + 1.1, tag: 'prop', material: 'wood', cameraBlock: false });
  // register and lotto display on the counter, cigarette wall behind the clerk
  B.box('metal', c.x0 + 0.05, c.x1 - 0.05, y0 + 1.12, y0 + 1.4, b.z0 + 5.6, b.z0 + 6.4, { color: col(0x2c2f33) });
  B.box('shelf', b.x1 - 1.0, b.x1 - wall, y0 + 0.8, y0 + 2.8, b.z0 + 2, b.z0 + 10, { tile: [4, 2], sides: { e: false } });
  // three aisles of shelving
  for (const sx of [b.x0 + 3, b.x0 + 7, b.x0 + 11]) {
    if (sx > c.x0 - 3) continue;
    B.box('shelf', sx, sx + 1.1, y0, y0 + 1.8, b.z0 + 6, b.z1 - 4.5, { tile: [3, 1.8], vBase: y0 });
    cw.add({ type: 'box', cx: sx + 0.55, cz: (b.z0 + 6 + b.z1 - 4.5) / 2, hx: 0.55, hz: (b.z1 - 4.5 - b.z0 - 6) / 2, y0: -1, y1: y0 + 1.8, tag: 'prop', material: 'metal', cameraBlock: false });
  }
  // drinks fridges along the back wall
  B.box('fridge', b.x0 + 1, b.x1 - 6, y0, y0 + 2.4, b.z1 - 1.2, b.z1 - wall, { sides: { s: false } });
  cw.add({ type: 'box', cx: (b.x0 + 1 + b.x1 - 6) / 2, cz: b.z1 - 0.75, hx: (b.x1 - 7 - b.x0) / 2, hz: 0.45, y0: -1, y1: y0 + 2.4, tag: 'prop', cameraBlock: false });
  // exterior: awning and sign
  B.box('trim', b.x0 - 0.2, b.x1 + 0.2, top - 1.2, top + 0.6, b.z0 - 0.4, b.z0, { color: accent });
  const s = makeSign('SUNNY STOP', { fg: '#3b2a00', bg: '#ffd23f', font: '800 64px "Trebuchet MS", Arial' }, (b.x1 - b.x0) * 0.6, 1.1);
  s.position.set((b.x0 + b.x1) / 2, top - 0.3, b.z0 - 0.42); s.rotation.y = Math.PI;
  group.add(s); signs.push(s);
  const open = makeSign('OPEN 24 HRS', { fg: '#ffe0f0', neon: '#ff3fa4' }, 2.4, 0.5);
  open.position.set(b.x0 + 3, y0 + 2.4, b.z0 - 0.05); open.rotation.y = Math.PI;
  group.add(open); signs.push(open);
}

/**
 * Velvet Palms, enterable: a windowless deco front with a canopy, rope line and
 * neon palm; inside, a dark lounge — bar with a lit back bar, a stage and
 * runway with brass poles, a DJ booth, booths along the south wall and
 * high-top tables. The layout comes from the district plan (b.layout); the
 * moving parts (mirror ball, light beams, people) are added by game/club.js.
 */
function buildClub(B, b, cw, signs, group) {
  const L = b.layout, I = L.inner, y0 = CURB, top = y0 + b.h, ceil = L.ceiling, w = L.wall;
  const color = col(b.color), accent = col(b.accent);
  const velvet = col(0x2a0f2e), dark = col(0x140a18), gold = col(0xd4af37), chrome = col(0xc8ccd2), red = col(0x7a1030);
  const dz0 = L.door.z - L.door.w / 2, dz1 = L.door.z + L.door.w / 2, dh = y0 + L.door.h, band = y0 + 4.6;
  const solid = (x0, x1, z0, z1, ya = -1, yb = top + 0.5, tag = 'wall') => cw.add({ type: 'box', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: ya, y1: yb, tag, material: 'concrete' });
  const prop = (x0, x1, z0, z1, yb, material = 'wood') => cw.add({ type: 'box', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: -1, y1: yb, tag: 'prop', material, cameraBlock: false });
  const fac = (x0, x1, ya, yb, z0, z1, sides) => B.box('fac:deco', x0, x1, ya, yb, z0, z1, { tile: T.FACADE_TILE, vBase: y0 + 4 - 0.6, color, sides });
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // ---- shell: north, south and east walls full height; the front is dark panels below, facade above
  fac(b.x0, b.x1, y0, top, b.z0, b.z0 + w, { s: false }); solid(b.x0, b.x1, b.z0, b.z0 + w);
  fac(b.x0, b.x1, y0, top, b.z1 - w, b.z1, { n: false }); solid(b.x0, b.x1, b.z1 - w, b.z1);
  fac(b.x1 - w, b.x1, y0, top, b.z0, b.z1, { w: false }); solid(b.x1 - w, b.x1, b.z0, b.z1);
  for (const [a0, a1] of [[b.z0, dz0], [dz1, b.z1]]) { B.box('trim', b.x0, b.x0 + w, y0, band, a0, a1, { color: dark, sides: { e: false } }); solid(b.x0, b.x0 + w, a0, a1); }
  B.box('trim', b.x0, b.x0 + w, dh, band, dz0, dz1, { color: dark, sides: { e: false } }); solid(b.x0, b.x0 + w, dz0, dz1, dh, top + 0.5);
  fac(b.x0, b.x0 + w, band, top, b.z0, b.z1, { e: false });
  B.box('roof', b.x0, b.x1, top - 0.2, top, b.z0, b.z1, { sides: { n: false, s: false, e: false, w: false, top: true } });
  B.box('trim', b.x0 - 0.18, b.x1 + 0.18, top - 0.3, top + 0.9, b.z0 - 0.18, b.z1 + 0.18, { color: col(0xffffff), sides: { top: false } });
  // door frame (brass) and a padded door leaf folded back against the wall
  for (const z of [dz0, dz1]) B.box('metal', b.x0 - 0.1, b.x0 + w + 0.05, y0, dh, z - 0.07, z + 0.07, { color: gold });
  B.box('metal', b.x0 - 0.1, b.x0 + w + 0.05, dh - 0.12, dh, dz0, dz1, { color: gold });
  B.box('trim', b.x0 + w, b.x0 + w + 0.08, y0, dh - 0.1, dz1 + 0.1, dz1 + 1.3, { color: red });

  // ---- front: canopy, neon frame, rope line, neon palm, signs
  B.box('trim', b.x0 - 2.8, b.x0, y0 + 3.3, y0 + 3.55, L.door.z - 3.2, L.door.z + 3.2, { color: accent, sides: { bottom: true } });
  B.box('lightpanel', b.x0 - 2.6, b.x0 - 0.2, y0 + 3.27, y0 + 3.29, L.door.z - 3, L.door.z + 3, { sides: { bottom: true, top: false, n: false, s: false, e: false, w: false } });
  neonLine(B, b.x0 - 2.85, y0 + 3.42, L.door.z - 3.2, b.x0 - 2.85, y0 + 3.42, L.door.z + 3.2, 0xff3fa4, 0.07);
  neonLine(B, b.x0 - 0.06, y0 + 0.3, b.z0 + 0.5, b.x0 - 0.06, y0 + 0.3, b.z1 - 0.5, 0xb455ff, 0.06);
  neonLine(B, b.x0 - 0.06, band - 0.2, b.z0 + 0.5, b.x0 - 0.06, band - 0.2, b.z1 - 0.5, 0xb455ff, 0.06);
  for (const z of [b.z0 + 0.5, b.z1 - 0.5]) neonLine(B, b.x0 - 0.06, y0 + 0.3, z, b.x0 - 0.06, band - 0.2, z, 0xb455ff, 0.06);
  for (let k = 0; k < 4; k++) { const z = L.door.z - 2.4 - k * 1.1; B.box('metal', b.x0 - 2.3, b.x0 - 2.18, y0, y0 + 0.95, z - 0.06, z + 0.06, { color: gold }); }
  B.box('trim', b.x0 - 2.27, b.x0 - 2.21, y0 + 0.78, y0 + 0.84, L.door.z - 5.7, L.door.z - 2.4, { color: red });
  // a neon palm on the dark panel north of the door
  {
    const px = b.x0 - 0.08, pz = L.door.z - 7.5, by = y0 + 0.4;
    const trunk = [[0, 0], [0.25, 1.1], [0.15, 2.2], [-0.15, 3.0]];
    for (let i = 0; i < trunk.length - 1; i++) neonLine(B, px, by + trunk[i][1], pz + trunk[i][0], px, by + trunk[i + 1][1], pz + trunk[i + 1][0], 0x49ff9a, 0.07);
    const cz = pz - 0.15, cy = by + 3.0;
    for (const [dzf, dyf] of [[-1.4, -0.5], [-0.9, 0.35], [0, 0.6], [0.9, 0.3], [1.4, -0.55]]) {
      neonLine(B, px, cy, cz, px, cy + dyf * 0.6, cz + dzf * 0.55, 0x49ff9a, 0.06);
      neonLine(B, px, cy + dyf * 0.6, cz + dzf * 0.55, px, cy + dyf, cz + dzf, 0x49ff9a, 0.06);
    }
  }
  const name = makeSign(b.sign, { fg: '#fff0fa', neon: '#ff3fa4', script: true }, (b.z1 - b.z0) * 0.7, 2.4);
  name.position.set(b.x0 - 0.06, top - 2.4, L.door.z); name.rotation.y = -Math.PI / 2;
  group.add(name); signs.push(name);
  const hours = makeSign('21+  ·  8 PM – 4 AM', { fg: '#e8fbff', neon: '#29e6ff' }, 3.2, 0.42);
  hours.position.set(b.x0 - 0.07, y0 + 2.5, L.door.z + 3.9); hours.rotation.y = -Math.PI / 2;
  group.add(hours); signs.push(hours);

  // ---- inside: floor, velvet walls, ceiling
  B.flat('clubfloor', I.x0, I.x1, I.z0, I.z1, y0 + 0.01, 1.2);
  // an inner wall face from p0 to p1 (the room is on the left walking from p0 to p1)
  const wallQ = (p0, p1, ya, yb, c = velvet) => B.quad('trim', [[p1[0], ya, p1[1]], [p0[0], ya, p0[1]], [p0[0], yb, p0[1]], [p1[0], yb, p1[1]]], UV, c);
  wallQ([I.x1, I.z0], [I.x0, I.z0], y0, ceil); // north face (seen from the south)
  wallQ([I.x0, I.z1], [I.x1, I.z1], y0, ceil); // south face
  wallQ([I.x1, I.z1], [I.x1, I.z0], y0, ceil); // east face
  wallQ([I.x0, I.z0], [I.x0, dz0], y0, ceil); wallQ([I.x0, dz1], [I.x0, I.z1], y0, ceil); wallQ([I.x0, dz0], [I.x0, dz1], dh, ceil);
  B.quad('trim', [[I.x0, ceil, I.z0], [I.x1, ceil, I.z0], [I.x1, ceil, I.z1], [I.x0, ceil, I.z1]], UV, dark);
  // a neon band around the room at 3.4 m, a gold dado rail at 1.1 m
  const ring = (y, c, t) => { neonLine(B, I.x0 + 0.04, y, I.z0 + 0.04, I.x1 - 0.04, y, I.z0 + 0.04, c, t); neonLine(B, I.x0 + 0.04, y, I.z1 - 0.04, I.x1 - 0.04, y, I.z1 - 0.04, c, t); neonLine(B, I.x1 - 0.04, y, I.z0 + 0.04, I.x1 - 0.04, y, I.z1 - 0.04, c, t); };
  ring(y0 + 3.4, 0xff3fa4, 0.06);
  for (const [a, c] of [[[I.x0 + 0.03, I.z0 + 0.03], [I.x1 - 0.03, I.z0 + 0.06]], [[I.x0 + 0.03, I.z1 - 0.06], [I.x1 - 0.03, I.z1 - 0.03]]]) B.box('metal', a[0], c[0], y0 + 1.08, y0 + 1.14, a[1], c[1], { color: gold });
  // ceiling truss over the stage and runway (the beams and the mirror ball hang from it)
  B.box('metal', L.runway.x0 - 0.5, L.stage.x1 - 0.6, ceil - 0.35, ceil - 0.2, L.door.z - 0.15, L.door.z + 0.15, { color: col(0x222226), sides: { bottom: true } });
  B.box('metal', L.stage.x0 + 0.4, L.stage.x0 + 0.7, ceil - 0.35, ceil - 0.2, L.stage.z0, L.stage.z1, { color: col(0x222226), sides: { bottom: true } });

  // ---- stage and runway: black gloss with LED edges, brass poles, a mirror wall and curtains behind
  for (const r of [L.stage, L.runway]) {
    B.box('trim', r.x0, r.x1, y0, r.y, r.z0, r.z1, { color: col(0x0d0a10), sides: { top: false } });
    B.flat('clubfloor', r.x0, r.x1, r.z0, r.z1, r.y, 0.8);
  }
  const st = L.stage, rw = L.runway, ly = st.y + 0.02;
  neonLine(B, st.x0 - 0.02, ly, st.z0, st.x0 - 0.02, ly, rw.z0, 0xff3fa4, 0.05); neonLine(B, st.x0 - 0.02, ly, rw.z1, st.x0 - 0.02, ly, st.z1, 0xff3fa4, 0.05);
  neonLine(B, st.x0, ly, st.z0 - 0.02, st.x1, ly, st.z0 - 0.02, 0xff3fa4, 0.05); neonLine(B, st.x0, ly, st.z1 + 0.02, st.x1, ly, st.z1 + 0.02, 0xff3fa4, 0.05);
  neonLine(B, rw.x0, ly, rw.z0 - 0.02, rw.x1, ly, rw.z0 - 0.02, 0xff3fa4, 0.05); neonLine(B, rw.x0, ly, rw.z1 + 0.02, rw.x1, ly, rw.z1 + 0.02, 0xff3fa4, 0.05);
  neonLine(B, rw.x0 - 0.02, ly, rw.z0, rw.x0 - 0.02, ly, rw.z1, 0xff3fa4, 0.05);
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, ceil - st.y, 10);
  for (const p of L.poles) {
    B.geometry('metal', poleGeo, new THREE.Matrix4().makeTranslation(p.x, (st.y + ceil) / 2, p.z), gold);
    cw.add({ type: 'circle', cx: p.x, cz: p.z, r: 0.07, y0: st.y, y1: ceil, tag: 'prop', material: 'metal', cameraBlock: false });
  }
  B.quad('mirror', [[I.x1 - 0.02, st.y + 0.1, st.z0 + 2.2], [I.x1 - 0.02, st.y + 0.1, st.z1 - 2.2], [I.x1 - 0.02, st.y + 3.4, st.z1 - 2.2], [I.x1 - 0.02, st.y + 3.4, st.z0 + 2.2]], UV);
  for (const [za, zb] of [[st.z0, st.z0 + 2.2], [st.z1 - 2.2, st.z1]]) B.box('trim', I.x1 - 0.35, I.x1, st.y, ceil, za, zb, { color: col(0x5a0f2a), sides: { e: false } });
  const back = makeSign('Velvet Palms', { fg: '#fff0fa', neon: '#ff3fa4', script: true }, 5.5, 1.2);
  back.position.set(I.x1 - 0.05, st.y + 3.9, L.door.z); back.rotation.y = -Math.PI / 2;
  group.add(back); signs.push(back);
  // speaker stacks either side of the stage front
  for (const z of [st.z0 + 0.45, st.z1 - 0.45]) {
    B.box('trim', st.x0 - 0.75, st.x0 - 0.05, y0, y0 + 1.9, z - 0.4, z + 0.4, { color: col(0x101012) });
    B.box('metal', st.x0 - 0.77, st.x0 - 0.74, y0 + 0.4, y0 + 1.6, z - 0.28, z + 0.28, { color: col(0x2a2a30) });
    prop(st.x0 - 0.75, st.x0 - 0.05, z - 0.4, z + 0.4, y0 + 1.9, 'metal');
  }

  // ---- the bar: counter with a gold top and an underglow; back bar with lit bottles and a mirror
  const br = L.bar;
  B.box('trim', br.x0, br.x1, y0, y0 + 1.08, br.z0, br.z1, { color: col(0x2a1630) });
  B.box('metal', br.x0 - 0.12, br.x1 + 0.12, y0 + 1.08, y0 + 1.15, br.z0 - 0.08, br.z1 + 0.15, { color: gold });
  neonLine(B, br.x0, y0 + 0.12, br.z1 + 0.04, br.x1, y0 + 0.12, br.z1 + 0.04, 0x29e6ff, 0.05);
  prop(br.x0, br.x1, br.z0, br.z1, y0 + 1.15);
  B.box('trim', br.x0 - 0.3, br.x1 + 0.3, y0, y0 + 0.95, I.z0, I.z0 + 0.5, { color: col(0x1d1022) });
  prop(br.x0 - 0.3, br.x1 + 0.3, I.z0, I.z0 + 0.5, y0 + 0.95);
  B.quad('mirror', [[br.x0 - 0.3, y0 + 1.0, I.z0 + 0.02], [br.x1 + 0.3, y0 + 1.0, I.z0 + 0.02], [br.x1 + 0.3, y0 + 2.9, I.z0 + 0.02], [br.x0 - 0.3, y0 + 2.9, I.z0 + 0.02]], UV);
  const bottleC = [0xffb84d, 0x7dff9a, 0x6fc8ff, 0xff6fb5, 0xfff0c8, 0xc89cff];
  for (let row = 0; row < 3; row++) {
    const sy = y0 + 1.25 + row * 0.55;
    B.box('metal', br.x0 - 0.2, br.x1 + 0.2, sy - 0.04, sy, I.z0 + 0.02, I.z0 + 0.32, { color: chrome });
    let k = row * 2;
    for (let x = br.x0; x < br.x1; x += 0.19) { const c = bottleC[k++ % bottleC.length], h = 0.24 + ((k * 7) % 5) * 0.025; B.box('neon', x, x + 0.08, sy, sy + h, I.z0 + 0.12, I.z0 + 0.2, { color: col(c).multiplyScalar(0.55) }); }
  }
  const stoolGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.72, 8), seatGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.08, 14);
  for (const s of L.stools) {
    B.geometry('metal', stoolGeo, new THREE.Matrix4().makeTranslation(s.x, y0 + 0.36, s.z), chrome);
    B.geometry('trim', seatGeo, new THREE.Matrix4().makeTranslation(s.x, y0 + 0.76, s.z), red);
  }

  // ---- DJ booth: a raised platform, a desk with decks and a cyan front
  const dj = L.dj;
  B.box('trim', dj.x0, dj.x1, y0, dj.y, dj.z0, dj.z1, { color: col(0x0d0a10) });
  B.box('trim', dj.x0, dj.x0 + 0.6, dj.y, dj.y + 1.0, dj.z0 + 0.3, dj.z1 - 0.3, { color: col(0x18101e) });
  neonLine(B, dj.x0 - 0.02, dj.y + 0.5, dj.z0 + 0.35, dj.x0 - 0.02, dj.y + 0.5, dj.z1 - 0.35, 0x29e6ff, 0.06);
  for (const z of [dj.z0 + 0.9, dj.z1 - 0.9]) B.box('metal', dj.x0 + 0.1, dj.x0 + 0.5, dj.y + 1.0, dj.y + 1.05, z - 0.2, z + 0.2, { color: col(0x3a3a44) });
  prop(dj.x0, dj.x0 + 0.6, dj.z0 + 0.3, dj.z1 - 0.3, dj.y + 1.0);

  // ---- booths along the south wall (the east one is VIP: gold velvet and a rope)
  for (const bt of L.booths) {
    const c = bt.vip ? col(0x8a6a1a) : col(0x6b1030), cx = (bt.x0 + bt.x1) / 2;
    B.box('trim', bt.x0, bt.x1, y0, y0 + 1.2, bt.z1 - 0.5, bt.z1, { color: c });
    B.box('trim', bt.x0, bt.x1, y0, y0 + 0.45, bt.z1 - 1.1, bt.z1 - 0.5, { color: c });
    for (const [a0, a1] of [[bt.x0, bt.x0 + 0.45], [bt.x1 - 0.45, bt.x1]]) { B.box('trim', a0, a1, y0, y0 + 0.75, bt.z0, bt.z1 - 0.5, { color: c }); prop(a0, a1, bt.z0, bt.z1 - 0.5, y0 + 0.75); }
    prop(bt.x0, bt.x1, bt.z1 - 1.1, bt.z1, y0 + 1.2);
    B.box('trim', cx - 0.7, cx + 0.7, y0, y0 + 0.42, bt.z0 + 0.3, bt.z0 + 0.95, { color: dark });
    B.box('metal', cx - 0.75, cx + 0.75, y0 + 0.42, y0 + 0.46, bt.z0 + 0.25, bt.z0 + 1.0, { color: gold });
    prop(cx - 0.75, cx + 0.75, bt.z0 + 0.25, bt.z0 + 1.0, y0 + 0.46);
    if (bt.vip) {
      for (const x of [bt.x0 - 0.1, bt.x0 + 1.6]) B.box('metal', x - 0.05, x + 0.05, y0, y0 + 0.95, bt.z0 - 0.35, bt.z0 - 0.25, { color: gold });
      B.box('trim', bt.x0 - 0.1, bt.x0 + 1.6, y0 + 0.78, y0 + 0.84, bt.z0 - 0.33, bt.z0 - 0.27, { color: red });
      const v = makeSign('VIP', { fg: '#fff6d8', neon: '#ffd23f' }, 1.4, 0.55);
      v.position.set(cx, y0 + 2.3, I.z1 - 0.05); v.rotation.y = Math.PI;
      group.add(v); signs.push(v);
    }
  }
  // high-top tables
  const legGeo = new THREE.CylinderGeometry(0.05, 0.25, 1.05, 10), topGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 18);
  for (const t of L.tables) {
    B.geometry('metal', legGeo, new THREE.Matrix4().makeTranslation(t.x, y0 + 0.52, t.z), chrome);
    B.geometry('metal', topGeo, new THREE.Matrix4().makeTranslation(t.x, y0 + 1.07, t.z), gold);
    cw.add({ type: 'circle', cx: t.x, cz: t.z, r: 0.45, y0: -1, y1: y0 + 1.1, tag: 'prop', material: 'metal', cameraBlock: false });
  }
  // restrooms door (not enterable) by the entrance
  B.box('trim', I.x0 + 0.6, I.x0 + 1.7, y0, y0 + 2.2, I.z0, I.z0 + 0.05, { color: col(0x3a1f40) });
  const rr = makeSign('RESTROOMS', { fg: '#ffe9f6', neon: '#b455ff' }, 1.3, 0.3);
  rr.position.set(I.x0 + 1.15, y0 + 2.5, I.z0 + 0.06);
  group.add(rr); signs.push(rr);
}

function buildBackdrop(B, cw, rnd) {
  const pal = [0xe9eef2, 0xd7dde3, 0xf2efe6, 0xc9d6df, 0xb7c6d2, 0xf3e3d3];
  const tower = (x, z, w, d, h, style = 'tower') => {
    const c = col(pal[Math.floor(rnd() * pal.length)]);
    B.box('fac:' + style, x - w / 2, x + w / 2, CURB, CURB + h, z - d / 2, z + d / 2, { keys: { top: 'roof' }, tile: T.FACADE_TILE, color: c, topTile: 8 });
    if (rnd() < 0.4) B.box('trim', x - w / 4, x + w / 4, CURB + h, CURB + h + 4 + rnd() * 6, z - d / 4, z + d / 4, { color: c });
  };
  // downtown skyline across the bay
  const D = BACKDROP.downtownX;
  B.box('seawall', -1400, D, -4.3, CURB, -1400, 1400, { sides: { top: false, n: false, s: false, w: false }, tile: [4, 4] });
  B.flat('concrete', -1400, D, -1400, 1400, CURB, 6);
  for (let i = 0; i < 70; i++) {
    const z = (rnd() - 0.5) * 900, x = D - 30 - rnd() * 380;
    const close = 1 - Math.min(1, Math.abs(z) / 450);
    tower(x, z, 18 + rnd() * 22, 18 + rnd() * 22, 40 + rnd() * 120 * close + 20, rnd() < 0.6 ? 'tower' : 'civic');
  }
  cw.add({ type: 'box', cx: D - 200, cz: 0, hx: 200, hz: 1400, y0: -10, y1: 60, material: 'concrete' });
  // neighbouring islands north and south
  for (const R of [BACKDROP.north, BACKDROP.south]) {
    B.box('seawall', R.x0, R.x1, -4.3, CURB, R.z0, R.z1, { sides: { top: false }, tile: [4, 4] });
    B.flat('concrete', R.x0, R.x1, R.z0, R.z1, CURB, 6);
    const near = R.z0 > 0 ? R.z0 : R.z1;
    const dir = R.z0 > 0 ? 1 : -1;
    for (let k = 0; k < 26; k++) {
      const z = near + dir * (20 + rnd() * 380);
      const x = R.x1 > 100 ? 160 - rnd() * 40 - (k % 3) * 60 : R.x1 - 16 - rnd() * 40 - (k % 3) * 55;
      tower(x, z, 16 + rnd() * 14, 16 + rnd() * 14, 25 + rnd() * 60 * (R.x1 > 100 && x > 100 ? 1 : 0.45));
    }
    cw.add({ type: 'box', cx: (R.x0 + R.x1) / 2, cz: (R.z0 + R.z1) / 2, hx: (R.x1 - R.x0) / 2 + 1, hz: (R.z1 - R.z0) / 2 + 1, y0: -10, y1: 60, material: 'concrete' });
  }
}

// ---------------------------------------------------------------------------

/** Depth (m below the water line) baked into a texture for the water shader. */
function depthTexture() {
  const N = 512, x0 = -1200, size = 2400;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * (size / N), z = x0 + (j + 0.5) * (size / N);
    const d = WATER_Y - terrainHeight(x, z);
    const k = (j * N + i) * 4;
    data[k] = Math.max(0, Math.min(255, (d / 12) * 255));
    data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return { tex: t, x0, size };
}

function buildWater(engine) {
  const dt = depthTexture();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      normalMap: { value: T.waterNormal() },
      depthMap: { value: dt.tex },
      depthRect: { value: new THREE.Vector2(dt.x0, dt.size) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(1, 1, 1) },
      skyTop: { value: new THREE.Color() },
      skyHor: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 100 },
      fogFar: { value: 800 },
      night: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float time, fogNear, fogFar, night;
      uniform sampler2D normalMap, depthMap;
      uniform vec2 depthRect;
      uniform vec3 sunDir, sunColor, skyTop, skyHor, fogColor;
      varying vec3 vWorld;
      void main() {
        vec2 duv = (vWorld.xz - depthRect.x) / depthRect.y;
        float depth = texture2D(depthMap, duv).r * 12.0;
        vec2 uv = vWorld.xz * 0.035;
        vec3 n1 = texture2D(normalMap, uv + vec2(time * 0.012, time * 0.007)).xzy * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, uv * 2.3 - vec2(time * 0.017, -time * 0.011)).xzy * 2.0 - 1.0;
        vec3 n = normalize(vec3(n1.x + n2.x, 6.0, n1.z + n2.z));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(skyHor, skyTop, clamp(R.y * 1.5, 0.0, 1.0));
        vec3 shallow = vec3(0.30, 0.82, 0.78);
        vec3 mid = vec3(0.07, 0.52, 0.66);
        vec3 deep = vec3(0.02, 0.20, 0.36);
        vec3 body = mix(shallow, mid, smoothstep(0.2, 2.8, depth));
        body = mix(body, deep, smoothstep(3.0, 11.0, depth));
        float dayLight = max(0.12, 1.0 - night * 0.85);
        body *= dayLight * (0.65 + 0.35 * max(sunDir.y, 0.0));
        vec3 colr = mix(body, sky, fres * 0.85);
        float spec = pow(max(dot(R, normalize(sunDir)), 0.0), 220.0) * step(0.0, sunDir.y);
        colr += sunColor * spec * 3.0;
        // shoreline foam: animated bands in the last half metre of depth
        float wave = sin(time * 1.3 - depth * 18.0 + sin(vWorld.z * 0.08) * 2.0) * 0.5 + 0.5;
        float foam = smoothstep(0.55, 0.05, depth) * smoothstep(0.35, 0.9, wave + n1.x * 0.6);
        foam += smoothstep(0.12, 0.0, depth) * 0.7;
        colr = mix(colr, vec3(0.95) * dayLight + 0.05, clamp(foam, 0.0, 1.0) * 0.85);
        float alpha = mix(0.35, 0.94, smoothstep(0.0, 1.6, depth));
        alpha = max(alpha, foam * 0.9);
        float dist = length(cameraPosition - vWorld);
        float f = smoothstep(fogNear, fogFar, dist);
        colr = mix(colr, fogColor, f);
        gl_FragColor = vec4(colr, mix(alpha, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 2;
  mesh.name = 'water';
  mesh.userData.update = (dt) => {
    const u = mat.uniforms;
    u.time.value += dt;
    const sky = engine.sky.material.uniforms;
    u.sunDir.value.copy(sky.sunDir.value); u.sunColor.value.copy(sky.sunColor.value);
    u.skyTop.value.copy(sky.top.value); u.skyHor.value.copy(sky.hor.value);
    u.fogColor.value.copy(engine.scene.fog.color);
    u.fogNear.value = engine.scene.fog.near; u.fogFar.value = engine.scene.fog.far;
    u.night.value = engine.time.night;
  };
  return mesh;
}

export { LANE_W };
