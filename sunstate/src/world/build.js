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
  roadHalfWidth, terrainHeight, causewayDeck,
} from './layout.js';
import { DISTRICT, mulberry32 } from './district.js';

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
  slabs.push([gx0, gx1, gz1, ISLAND.south]);
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
  B.box('seawall', ISLAND.west, ISLAND.sandStart, -4.3, top, ISLAND.south, ISLAND.south + 0.6, { sides: { top: true, n: false }, tile: [4, 4] });
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
    const hw = roadHalfWidth(s.lanes);
    if (s.dir === 'ns') B.flat('asphalt', s.c - hw, s.c + hw, s.from - hw, s.to + hw, 0, 8);
    else if (s.bridge) B.flat('asphalt', ISLAND.west, s.to + hw, s.c - hw, s.c + hw, 0, 8);
    else B.flat('asphalt', s.from - hw, s.to + hw, s.c - hw, s.c + hw, 0, 8);
  }
  const { nodes, edges } = ROAD_GRAPH;
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    if (e.road === 'causeway') continue; // markings drawn on the deck
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
      const z = near + dir * (20 + rnd() * 380), x = 160 - rnd() * 40 - (k % 3) * 60;
      tower(x, z, 16 + rnd() * 14, 16 + rnd() * 14, 25 + rnd() * 60 * (x > 100 ? 1 : 0.5));
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
