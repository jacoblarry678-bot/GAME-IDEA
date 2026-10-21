/**
 * Expedition: a seeded twenty to thirty minute run through twelve connected
 * rooms assembled from one of the five main environment kits, which also
 * supplies the run's dominant creature. Room roles: entrance, refuge A,
 * seven challenge rooms (three objectives, two threats, one navigation, one
 * supply room), refuge B, relay control and extraction. Extraction unlocks
 * after the three objectives and the relay control. Every active-threat room
 * sits on a loop. Three distinct puzzle families per run, each with its own
 * zero-consumable clue and a guaranteed unique solution.
 *
 * The generator produces a plain-data spec (the "graph"); a suspended run
 * stores the spec itself, so a future generator change cannot corrupt it.
 * Every spec passes level validation (reachability, door clearance,
 * interactable reach) before it is used; a failed attempt advances to the
 * next deterministic attempt for the same seed.
 */
import { Rng, seedToText } from '../core/rng.js';
import { validateLevel } from './validate.js';
import { defineMachine } from './machines.js';
import { defineCycle } from './shutters.js';
import { propSize } from '../data/props.js';

export const CELL = 14;
const COLS = 4, ROWS = 3;
const H = 0.3;

export const X_THEMES = {
  office: { name: 'Office', kit: 'office', surface: 'carpet', h: 3, enemy: 'listener', fog: 0x2a2614, hemi: 0.5, music: 'yellowRooms', doors: 'door' },
  mall: { name: 'Mall', kit: 'mall', surface: 'terrazzo', h: 4.5, enemy: 'cutout', fog: 0x1c1a20, hemi: 0.55, music: 'afterClosing', doors: 'door' },
  pool: { name: 'Pool', kit: 'pool', surface: 'pooltile', h: 5, enemy: 'drowned', fog: 0x0e1a1e, hemi: 0.5, music: 'stillwater', doors: 'door' },
  apartments: { name: 'Residences', kit: 'apartments', surface: 'wood', h: 3, enemy: 'tenant', fog: 0x2a1e14, hemi: 0.45, music: 'upstairsNeighbor', doors: 'apartment' },
  industrial: { name: 'Lower plant', kit: 'industrial', surface: 'concrete', h: 5, enemy: 'caretaker', fog: 0x14100c, hemi: 0.4, music: 'lowerPlant', doors: 'door' },
};
export const X_FAMILIES = ['symbol', 'address', 'path', 'weights', 'valves', 'routing'];
const ROLES = ['entrance', 'challenge', 'refugeA', 'challenge', 'challenge', 'challenge', 'challenge', 'refugeB', 'challenge', 'challenge', 'relay', 'extraction'];

// ------------------------------------------------------------------ graph
function hamiltonian(rng) {
  const N = COLS * ROWS;
  const nb = (i) => { const c = i % COLS, r = (i / COLS) | 0; const o = []; if (c > 0) o.push(i - 1); if (c < COLS - 1) o.push(i + 1); if (r > 0) o.push(i - COLS); if (r < ROWS - 1) o.push(i + COLS); return o; };
  const start = rng.pick([0, COLS - 1, N - COLS, N - 1, 1, 2]);
  const path = [start], used = new Set([start]);
  let steps = 0;
  const dfs = () => {
    if (path.length === N) return true;
    if (++steps > 20000) return false;
    const cur = path[path.length - 1];
    for (const n of rng.shuffle(nb(cur).slice())) {
      if (used.has(n)) continue;
      used.add(n); path.push(n);
      if (dfs()) return true;
      used.delete(n); path.pop();
    }
    return false;
  };
  return dfs() ? path : null;
}
const adjacent = (a, b) => { const ca = a % COLS, ra = (a / COLS) | 0, cb = b % COLS, rb = (b / COLS) | 0; return Math.abs(ca - cb) + Math.abs(ra - rb) === 1; };
const cellRect = (i) => ({ x0: (i % COLS) * CELL, z0: ((i / COLS) | 0) * CELL });

// ------------------------------------------------------------------ puzzle data
const SYMBOLS = [['○', 'circle'], ['△', 'triangle'], ['□', 'square'], ['◇', 'diamond']];
const NAMES = ['Morrow', 'Ash', 'Vale', 'Pike', 'Hollis', 'Reyes', 'Okafor', 'Lund', 'Marsh', 'Quinn', 'Doyle', 'Sato'];
const ATTRS = ['the street door that sticks', 'the courtyard view', 'the leaking skylight', 'the boiler room below', 'the laundry next door', 'the narrow balcony'];
const PLACES = { 'the street door that sticks': 'ground floor, street door', 'the courtyard view': 'courtyard side', 'the leaking skylight': 'top floor, skylight', 'the boiler room below': 'basement level', 'the laundry next door': 'beside the laundry', 'the narrow balcony': 'balcony unit' };
const BOXES = ['1A', '2C', '3B', '4D', '5A', '6C', '7B'];
const ZONES = ['NORTH HALL', 'EAST WING', 'SERVICE EXIT', 'STAIRWELL'];

function genPath(rng) {
  for (let t = 0; t < 400; t++) {
    let c = rng.int(0, 3), r = 0;
    const cells = [[c, r]];
    const has = (cc, rr) => cells.some(([a, b]) => a === cc && b === rr);
    let ok = true;
    while (cells.length < 7) {
      const opts = [[c + 1, r], [c - 1, r], [c, r + 1]].filter(([a, b]) => a >= 0 && a < 4 && b < 4 && !has(a, b));
      // never touch an earlier cell other than the one we came from (keeps the route unambiguous)
      const clean = opts.filter(([a, b]) => cells.slice(0, -1).every(([x, y]) => Math.abs(x - a) + Math.abs(y - b) > 1));
      if (!clean.length) { ok = false; break; }
      [c, r] = rng.pick(clean);
      cells.push([c, r]);
    }
    if (ok && r === 3) return cells.map(([a, b]) => 'ABCD'[a] + (b + 1));
  }
  return ['B1', 'B2', 'C2', 'C3', 'B3', 'B4', 'C4'];
}

function genWeights(rng) {
  for (let t = 0; t < 400; t++) {
    const pool = []; for (let w = 10; w <= 75; w += 5) pool.push(w);
    const ws = rng.shuffle(pool).slice(0, 4).sort((a, b) => a - b);
    const [i, j] = rng.shuffle([0, 1, 2, 3]).slice(0, 2);
    const S = ws[i] + ws[j];
    let count = 0;
    for (let m = 1; m < 16; m++) { let s = 0; for (let k = 0; k < 4; k++) if (m & (1 << k)) s += ws[k]; if (s === S) count++; }
    if (count === 1) { const payload = rng.int(16, 30) * 5; return { weights: ws, pair: [ws[i], ws[j]].sort((a, b) => a - b), payload, target: payload + S }; }
  }
  return { weights: [15, 25, 40, 65], pair: [25, 65], payload: 110, target: 200 };
}

function puzzleFor(family, rng, id, panel, roomName) {
  if (family === 'symbol') {
    const order = rng.shuffle([0, 1, 2, 3].slice());
    return {
      def: { id, type: 'sequence', title: 'Symbol controls', panel, kind: 'switch', buttons: SYMBOLS.map(([s, n], i) => ({ id: `s${i}`, label: s, sub: n })), solution: order.map((i) => `s${i}`), instructions: 'Four controls marked with symbols. They must be pressed in the service order.', wrongText: 'Wrong order. The controls reset.', wrongSound: 'trip', idleDisplay: 'AWAITING SERVICE ORDER', doneText: 'Service order accepted.' },
      clue: { title: 'Service order card', text: `Taped inside the control housing: SERVICE ORDER ${order.map((i) => `${SYMBOLS[i][0]} ${SYMBOLS[i][1]}`).join(', then ')}.` },
      solution: order.map((i) => `s${i}`),
    };
  }
  if (family === 'address') {
    const names = rng.shuffle(NAMES.slice()).slice(0, 3), attrs = rng.shuffle(ATTRS.slice()).slice(0, 3), boxes = rng.shuffle(BOXES.slice()).slice(0, 3);
    const envelopes = names.map((n, i) => ({ id: n.toLowerCase(), name: n, box: boxes[i] }));
    return {
      def: { id, type: 'mail', title: 'Returned mail', panel, envelopes, boxes: rng.shuffle(boxes.slice()).sort(), instructions: 'Three envelopes with smudged unit numbers. Each letter mentions where its writer lives. The directory lists every unit.' },
      clue: { title: 'Envelopes and directory', text: `${names.map((n, i) => `${n.toUpperCase()}: "…you know, ${attrs[i]}."`).join('  ')}\n\nDIRECTORY: ${boxes.map((b, i) => `${b} · ${PLACES[attrs[i]]}`).sort().join('  ·  ')}` },
      solution: envelopes.map((e) => `place:${e.id}:${e.box}`),
    };
  }
  if (family === 'weights') {
    const w = genWeights(rng);
    return {
      def: { id, type: 'weights', title: 'Platform balance', panel, payload: w.payload, target: w.target, weights: w.weights, instructions: `A service platform carries a fixed payload of ${w.payload}. Four counterweights ride on their own rails. The display reads ${w.payload} + selected weights = ${w.target}. Exactly two weights balance it.` },
      clue: { title: 'Platform placard', text: `Fixed payload ${w.payload}. Balanced load ${w.target}. Personnel walkway excluded from measurement.` },
      solution: [...w.pair.map((x) => `w:${x}`), 'release'],
    };
  }
  if (family === 'valves') {
    const initial = [rng.next() < 0.5, rng.next() < 0.5, rng.next() < 0.5];
    let target = initial.slice(); while (target.every((v, i) => v === initial[i])) target = [rng.next() < 0.5, rng.next() < 0.5, rng.next() < 0.5];
    const labels = ['V1 SUPPLY', 'V2 RETURN', 'V3 BYPASS'];
    return {
      def: { id, type: 'valvestate', title: 'Valve manifold', panel, labels, initial, target, instructions: 'Three valves and a SET PRESSURE control. A printed maintenance diagram shows the service state for each valve.' },
      clue: { title: 'Maintenance diagram', text: `Printed diagram, ${roomName}: ${labels.map((l, i) => `${l} ${target[i] ? 'OPEN' : 'CLOSED'}`).join(' · ')}.` },
      solution: [...[0, 1, 2].filter((i) => initial[i] !== target[i]).map((i) => `v:${i}`), 'set'],
    };
  }
  if (family === 'routing') {
    const target = rng.int(0, 3);
    return {
      def: { id, type: 'zonerouting', title: 'Speaker routing', panel, zones: ZONES, target, instructions: 'Four speaker zones and a test tone. The diagram on the wall marks the one zone that should carry it.' },
      clue: { title: 'Routing diagram', text: `The diagram is circled once: ${ZONES[target]} ONLY. Every other zone muted. (A note underneath: "the marked crossing stays safe either way.")` },
      solution: [...[0, 1, 2, 3].filter((i) => (i === 0) !== (i === target)).map((i) => `z:${i}`), 'play'],
    };
  }
  return null;
}

// ------------------------------------------------------------------ spec
function trySpec(seed, attempt) {
  const rng = new Rng((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0);
  const themeId = rng.pick(Object.keys(X_THEMES));
  const T = X_THEMES[themeId];
  const order = hamiltonian(rng);
  if (!order) return null;
  const roleOf = new Map(order.map((cell, i) => [cell, ROLES[i]]));
  const idx = new Map(order.map((cell, i) => [cell, i]));
  const rid = (cell) => `X${String(idx.get(cell) + 1).padStart(2, '0')}`;
  // challenge assignment: two threats (must sit on a loop), three objectives, navigation, supplies
  const challenge = order.filter((c) => roleOf.get(c) === 'challenge');
  const loopCand = (c) => order.filter((n) => adjacent(c, n) && Math.abs(idx.get(n) - idx.get(c)) > 1 && ['challenge', 'relay'].includes(roleOf.get(n)));
  const threats = rng.shuffle(challenge.filter((c) => loopCand(c).length)).slice(0, 2);
  if (threats.length < 2) return null;
  const rest = rng.shuffle(challenge.filter((c) => !threats.includes(c)));
  const objectives = rest.slice(0, 3), navigation = rest[3], supplies = rest[4];
  const kind = new Map();
  for (const c of order) kind.set(c, roleOf.get(c));
  threats.forEach((c) => kind.set(c, 'threat')); objectives.forEach((c) => kind.set(c, 'objective'));
  kind.set(navigation, 'navigation'); kind.set(supplies, 'supplies');
  // doors: the path, plus one loop edge per threat room
  const edges = [];
  for (let i = 0; i < order.length - 1; i++) edges.push([order[i], order[i + 1]]);
  for (const t of threats) { const n = rng.pick(loopCand(t)); if (!edges.some(([a, b]) => (a === t && b === n) || (a === n && b === t))) edges.push([t, n]); }
  const families = rng.shuffle(X_FAMILIES.slice());
  const rooms = [], doors = [], props = [], puzzles = [], interactables = [], pickups = [], water = [], blocks = [], threatsOut = [], machines = [], cycles = [];
  const doorPts = new Map(); // cell -> [{x,z,side}]
  for (const c of order) doorPts.set(c, []);
  edges.forEach(([a, b], k) => {
    const A = cellRect(a), B = cellRect(b);
    const vertical = A.x0 === B.x0;
    const along = (vertical ? A.x0 : A.z0) + CELL / 2 + rng.range(-3.2, 3.2);
    const ra = kind.get(a), rb = kind.get(b);
    const type = ra === 'refugeA' || ra === 'refugeB' || rb === 'refugeA' || rb === 'refugeB' ? 'refuge' : (ra === 'extraction' || rb === 'extraction') ? 'gate' : (rng.next() < 0.25 ? 'arch' : T.doors);
    const d = { id: `xd${k}`, a: rid(a), b: rid(b), type, pos: +along.toFixed(2) };
    if (type === 'gate') Object.assign(d, { w: 2.2, lock: 'x.ready', lockText: 'Extraction opens when the three objectives and the relay control are complete.', label: 'Extraction' });
    doors.push(d);
    const bnd = vertical ? Math.max(A.z0, B.z0) : Math.max(A.x0, B.x0);
    for (const [cell, R] of [[a, A], [b, B]]) {
      const side = vertical ? (R.z0 < bnd ? 'N' : 'S') : (R.x0 < bnd ? 'E' : 'W');
      doorPts.get(cell).push(vertical ? { x: along, z: bnd, side } : { x: bnd, z: along, side });
    }
  });
  // per-room content
  let start = null;
  const objectiveIds = [];
  let fi = 0;
  for (const c of order) {
    const { x0, z0 } = cellRect(c);
    const id = rid(c), k = kind.get(c);
    const dp = doorPts.get(c);
    const sides = new Set(dp.map((d) => d.side));
    const freeSides = ['N', 'S', 'E', 'W'].filter((s) => !sides.has(s));
    const room = { id, name: '', x0, z0, w: CELL, d: CELL, h: T.h, kit: T.kit, surface: T.surface };
    const near = (x, z, r = 2.6) => dp.some((d) => Math.hypot(d.x - x, d.z - z) < r);
    const wallSpot = (side, along = 0, off = 0.55) => side === 'N' ? { x: x0 + 7 + along, z: z0 + CELL - off, rot: 180, face: 'S' } : side === 'S' ? { x: x0 + 7 + along, z: z0 + off, rot: 0, face: 'N' } : side === 'E' ? { x: x0 + CELL - off, z: z0 + 7 + along, rot: 270, face: 'W' } : { x: x0 + off, z: z0 + 7 + along, rot: 90, face: 'E' };
    // footprints keep at least 1.2 m of clear floor between them, so no generated gap is narrower than a body
    const rectOf = (p) => { const [w, d] = propSize(p); return [p.x - w / 2, p.z - d / 2, p.x + w / 2, p.z + d / 2]; };
    const fits = (p, gap = 1.2) => {
      const [a0, b0, a1, b1] = rectOf(p);
      if (a0 < x0 + 0.2 || b0 < z0 + 0.2 || a1 > x0 + CELL - 0.2 || b1 > z0 + CELL - 0.2) return false;
      return !props.some((q) => { if (q.room !== id || q.solid === false) return false; const [c0, d0, c1, d1] = rectOf(q); return a0 < c1 + gap && a1 > c0 - gap && b0 < d1 + gap && b1 > d0 - gap; });
    };
    const scatter = (kinds, n) => {
      for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
        const x = x0 + rng.range(2.5, 11.5), z = z0 + rng.range(2.5, 11.5);
        if (near(x, z, 3.2) || Math.hypot(x - (x0 + 7), z - (z0 + 7)) < 1.6) continue;
        const p = { k: rng.pick(kinds), x: +x.toFixed(2), z: +z.toFixed(2), rot: rng.pick([0, 90, 180, 270]), room: id };
        if (!fits(p)) continue;
        props.push(p);
        i++;
      }
    };
    const DECOR = { office: ['desk', 'cabinet', 'copier', 'plant', 'boxes'], mall: ['bench', 'plant', 'display', 'kiosk', 'rack'], pool: ['bench', 'lifeguardChair', 'pump', 'drum'], apartments: ['sofa', 'table', 'wardrobe', 'washer', 'plant'], industrial: ['drum', 'crate', 'workbench', 'console', 'machine'] }[themeId];
    if (k === 'entrance') {
      room.name = 'Service entrance';
      start = { x: x0 + 7, z: z0 + 7, yaw: Math.PI };
      const s = freeSides[0] || 'S';
      props.push({ k: 'sign', ...wallSpot(s, 0, 0.25), y: 2.0, text: `EXPEDITION|${seedToText(seed)}`, solid: false, room: id });
      scatter(DECOR, 2);
    } else if (k === 'refugeA' || k === 'refugeB') {
      room.name = k === 'refugeA' ? 'Refuge A' : 'Refuge B';
      room.refuge = k === 'refugeA' ? 'R1' : 'R2';
      room.h = Math.min(T.h, 3.2);
    } else if (k === 'objective') {
      const fam = families[fi++];
      const s = freeSides.length ? rng.pick(freeSides) : null;
      if (fam === 'path' && (sides.has('N'))) return null; // the safe-path pocket needs a closed north wall
      const pid = `XP${objectiveIds.length + 1}`;
      objectiveIds.push(pid);
      room.name = { symbol: 'Control room', address: 'Mail room', path: 'Tile hall', weights: 'Platform room', valves: 'Valve room', routing: 'Speaker room' }[fam];
      if (fam === 'path') {
        const safe = genPath(rng);
        puzzles.push({ id: pid, type: 'tiles', title: 'Tile hall', grid: { x0: x0 + 2, z0: z0 + 1.6, size: 2.5, entrance: { x: x0 + 7, z: z0 + 0.9 } }, safe, doneText: 'The safe tiles stay lit. The pocket at the far end is reached.' });
        props.push({ k: 'tileGrid', x: x0 + 7, z: z0 + 6.6, s: [10, 10, 0.05], room: id, solid: false });
        props.push({ k: 'railing', x: x0 + 1.96, z: z0 + 7.8, rot: 90, s: [12.4, 0.08, 1.05], room: id });
        props.push({ k: 'railing', x: x0 + 12.04, z: z0 + 7.8, rot: 90, s: [12.4, 0.08, 1.05], room: id });
        props.push({ k: 'console', x: x0 + 7, z: z0 + 13.2, rot: 180, room: id });
        const cl = { title: 'Inspection photograph', text: `A taped inspection photo of the tile hall, annotated: SAFE ${safe.join(' · ')}. Columns A to D left to right from the entrance side, rows 1 to 4 away from it.` };
        // pinned to the south wall: reading it never needs a step onto the tiles
        const cx = dp.some((d) => d.side === 'S' && Math.abs(d.x - (x0 + 3)) < 1.6) ? x0 + 11 : x0 + 3;
        interactables.push({ id: `${pid}clue`, kind: 'note', title: cl.title, text: cl.text, x: cx, y: 1.45, z: z0 + 0.26, face: 'N', clue: `clue.${pid}`, clueText: cl.text });
        room.pathPuzzle = pid;
        rooms.push(room);
        continue;
      }
      const spot = s ? wallSpot(s, rng.range(-3, 3), 0.55) : { x: x0 + 7, z: z0 + 7.6, rot: 180, face: 'S' };
      if (!s && near(spot.x, spot.z, 2.2)) return null;
      const panel = { x: spot.x + ({ N: 0, S: 0, E: -0.45, W: 0.45 }[s || 'N'] || 0), y: 1.2, z: spot.z + ({ N: -0.45, S: 0.45, E: 0, W: 0 }[s || 'N'] || 0), face: spot.face };
      props.push({ k: 'console', x: spot.x, z: spot.z, rot: spot.rot, room: id });
      const P = puzzleFor(fam, rng, pid, panel, room.name);
      puzzles.push({ ...P.def, solutionHint: P.solution });
      // its clue lives in the same room
      let cx, cz, okSpot = false;
      for (let t = 0; t < 60 && !okSpot; t++) { cx = x0 + rng.range(2.5, 11.5); cz = z0 + rng.range(2.5, 11.5); okSpot = !near(cx, cz, 3) && Math.hypot(cx - spot.x, cz - spot.z) > 3 && fits({ k: 'table', x: cx, z: cz }); }
      if (!okSpot) return null;
      props.push({ k: 'table', x: +cx.toFixed(2), z: +cz.toFixed(2), room: id });
      interactables.push({ id: `${pid}clue`, kind: 'note', title: P.clue.title, text: P.clue.text, x: +cx.toFixed(2), y: 0.85, z: +cz.toFixed(2), clue: `clue.${pid}`, clueText: P.clue.text });
      scatter(DECOR, 2);
    } else if (k === 'threat') {
      room.name = 'Threat area';
      const tid = `XT${threatsOut.filter(Boolean).length + 1}`;
      const anchors = [];
      const corners = [[2.6, 2.6], [11.4, 2.6], [11.4, 11.4], [2.6, 11.4]].map(([a, b]) => ({ x: x0 + a, z: z0 + b }));
      const enemy = T.enemy;
      if (enemy === 'drowned') {
        room.floors = [[x0 + 0.2, z0 + 0.2, x0 + 13.8, z0 + 2.4, H], [x0 + 0.2, z0 + 11.6, x0 + 13.8, z0 + 13.8, H], [x0 + 0.2, z0 + 2.4, x0 + 2.4, z0 + 11.6, H], [x0 + 11.6, z0 + 2.4, x0 + 13.8, z0 + 11.6, H]];
        water.push({ x0: x0 + 2.4, z0: z0 + 2.4, x1: x0 + 11.6, z1: z0 + 11.6, depth: 0.22, body: id });
        anchors.push({ x: x0 + 4, z: z0 + 4 }, { x: x0 + 10, z: z0 + 4 }, { x: x0 + 10, z: z0 + 10 }, { x: x0 + 4, z: z0 + 10 });
        props.push({ k: 'lane', x: x0 + 7, z: z0 + 7, rot: 90, s: [9, 0.12, 0.3], room: id, solid: false });
      } else if (enemy === 'cutout') {
        const cyc = `xc${tid}`;
        cycles.push({ id: cyc, x: x0 + 7, z: z0 + 7, auto: { open: 9, closed: 6 } });
        props.push({ k: 'display', x: x0 + 7, z: z0 + 6.4, s: [1.6, 0.8, 0.3], room: id });
        for (const s of freeSides.slice(0, 2)) props.push({ k: 'storefront', ...wallSpot(s, 0, 0.2), room: id, name: rng.pick(['GIFTS', 'TOYS', 'PHOTO', 'SHOES', 'NEW SEASON']) });
        anchors.push({ x: x0 + 7, z: z0 + 7.2 });
        threatsOut.push({ id: tid, type: 'cutout', room: id, x: x0 + 7, z: z0 + 7.2, group: cyc, anchors, region: [x0 + 0.6, z0 + 0.6, x0 + 13.4, z0 + 13.4] });
        rooms.push({ ...room, name: 'Display court' });
        continue;
      } else {
        anchors.push(...rng.shuffle(corners.slice()).slice(0, 3).filter((a) => !near(a.x, a.z, 2.0)));
        if (anchors.length < 2) anchors.push({ x: x0 + 7, z: z0 + 4 }, { x: x0 + 7, z: z0 + 10 });
        if (enemy === 'listener') { props.push({ k: 'partitionTall', x: x0 + 7, z: z0 + 7, s: [4, 0.08, 2.0], room: id }, { k: 'partitionTall', x: x0 + 7, z: z0 + 7, rot: 90, s: [4, 0.08, 2.0], room: id }); }
        if (enemy === 'caretaker') {
          for (const [i, [a, b]] of [[0, [4.6, 7]], [1, [9.4, 7]]]) {
            const mid = `xm${tid}${i}`;
            props.push({ k: 'machine', x: x0 + a, z: z0 + b, rot: 90, id: mid, dynamic: true, room: id });
            machines.push({ id: mid, x: x0 + a, z: z0 + b, run: 6, rest: 6, offset: i * 6, mask: 6.5 });
          }
        }
        if (enemy === 'tenant') { props.push({ k: 'aptDoor', ...wallSpot(freeSides[0] || 'N', 0, 0.25), room: id, solid: false }); scatter(['sofa', 'wardrobe', 'table'], 2); }
      }
      room.name = { listener: 'Quiet floor', drowned: 'Flooded hall', caretaker: 'Machine room', tenant: 'Occupied hall' }[enemy];
      threatsOut.push({ id: tid, type: enemy, room: id, x: anchors[0].x, z: anchors[0].z, anchors, region: [x0 + 0.6, z0 + 0.6, x0 + 13.4, z0 + 13.4] });
    } else if (k === 'navigation') {
      room.name = 'Storage maze';
      const v = rng.int(0, 1);
      if (v === 0) props.push({ k: 'shelf', x: x0 + 4.6, z: z0 + 4.8, s: [6, 0.45, 2.1], room: id }, { k: 'shelf', x: x0 + 9.4, z: z0 + 9.2, s: [6, 0.45, 2.1], room: id });
      else props.push({ k: 'shelf', x: x0 + 4.8, z: z0 + 9.4, rot: 90, s: [6, 0.45, 2.1], room: id }, { k: 'shelf', x: x0 + 9.2, z: z0 + 4.6, rot: 90, s: [6, 0.45, 2.1], room: id });
      scatter(['boxes', 'crate', 'cabinet'], 3);
    } else if (k === 'supplies') {
      room.name = 'Supply room';
      const s = freeSides[0];
      if (s) props.push({ k: 'shelf', ...wallSpot(s, 0, 0.35), room: id });
      const items = rng.shuffle(['battery', 'film', 'bandage', 'firstaid', 'decoy', 'wedge']).slice(0, 4);
      items.forEach((item, i) => {
        let x, z;
        for (let t = 0; t < 40; t++) { x = x0 + rng.range(2.5, 11.5); z = z0 + rng.range(2.5, 11.5); if (!near(x, z, 2.5) && !pickups.some((p) => Math.hypot(p.x - x, p.z - z) < 1.5)) break; }
        pickups.push({ id: `xs${i}`, item, qty: 1, route: 'optional', x: +x.toFixed(2), y: 0.05, z: +z.toFixed(2) });
      });
      scatter(DECOR, 2);
    } else if (k === 'relay') {
      room.name = 'Relay control';
      const s = freeSides.length ? rng.pick(freeSides) : null;
      const spot = s ? wallSpot(s, 0, 0.7) : { x: x0 + 7, z: z0 + 7, rot: 0, face: 'N' };
      props.push({ k: 'relay', x: spot.x, z: spot.z, rot: spot.rot, room: id });
      const off = { N: [0, -0.65], S: [0, 0.65], E: [-0.65, 0], W: [0.65, 0] }[spot.face === 'S' ? 'N' : spot.face === 'N' ? 'S' : spot.face === 'W' ? 'E' : 'W'] || [0, 0.65];
      interactables.push({ id: 'xrelay', kind: 'switch', name: 'Relay completion switch', verb: 'Engage', x: +(spot.x + off[0]).toFixed(2), y: 1.3, z: +(spot.z + off[1]).toFixed(2), face: spot.face });
    } else if (k === 'extraction') {
      room.name = 'Extraction';
      room.kit = 'lift';
      room.surface = 'metal';
      interactables.push({ id: 'xlift', kind: 'lift', name: 'Extraction lift', verb: 'Leave', x: x0 + 7, y: 1.3, z: z0 + 7, requires: 'x.ready' });
      props.push({ k: 'liftPanel', x: x0 + 7, z: z0 + 7.3, y: 1.0, solid: false, room: id });
    }
    rooms.push(room);
  }
  if (!start) return null;
  // a few supplies elsewhere so the run is not only the supply room
  const extra = rng.shuffle(order.filter((c) => ['objective', 'navigation'].includes(kind.get(c)))).slice(0, 2);
  extra.forEach((c, i) => { const { x0, z0 } = cellRect(c); pickups.push({ id: `xe${i}`, item: rng.pick(['battery', 'film', 'bandage']), qty: 1, route: 'optional', x: x0 + 7 + rng.range(-1.2, 1.2), y: 0.05, z: z0 + 7 + rng.range(-1.2, 1.2) }); });
  return {
    v: 1, seed, attempt, seedText: seedToText(seed), theme: themeId,
    order: order.map((c) => ({ cell: c, id: rid(c), kind: kind.get(c) })),
    rooms, doors, props, puzzles, interactables, pickups, water, blocks, machines, cycles,
    threats: threatsOut.filter(Boolean), objectives: objectiveIds, start,
  };
}

/** Generate a validated spec for a seed (deterministic: the same seed always yields the same run). */
export function generateSpec(seed) {
  seed = (seed >>> 0) % (32 ** 6);
  for (let attempt = 0; attempt < 80; attempt++) {
    const spec = trySpec(seed, attempt);
    if (!spec) continue;
    const res = validateSpec(spec);
    if (res.ok) return spec;
  }
  throw new Error(`expedition: no valid layout for seed ${seed}`);
}

/** Reachability, clearance and unique-solution checks for a spec. */
export function validateSpec(spec) {
  const def = buildExpeditionDef(spec);
  const { level, problems } = validateLevel(def);
  const nav = level.nav;
  for (const t of spec.threats) {
    for (const a of t.anchors) {
      const i = nav.indexAt(a.x, a.z);
      if (i < 0 || !nav.walk[i]) problems.push(`threat ${t.id} anchor not walkable`);
      if (t.type === 'drowned' && (i < 0 || !nav.water[i])) problems.push(`threat ${t.id} anchor not in water`);
    }
  }
  for (const p of spec.puzzles) {
    if (p.type === 'weights') {
      let n = 0; const S = p.target - p.payload;
      for (let m = 1; m < 16; m++) { let s = 0; for (let k = 0; k < 4; k++) if (m & (1 << k)) s += p.weights[k]; if (s === S) n++; }
      if (n !== 1) problems.push(`${p.id}: counterweights have ${n} solutions`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// ------------------------------------------------------------------ chapter def
export function buildExpeditionDef(spec) {
  const T = X_THEMES[spec.theme];
  return {
    id: 'X',
    title: `Expedition · ${spec.seedText}`,
    kit: T.kit,
    fog: { color: T.fog, density: 0.03 },
    hemi: T.hemi,
    ambient: T.kit,
    music: T.music,
    expedition: true,
    start: spec.start,
    rooms: spec.rooms, doors: spec.doors, props: spec.props, puzzles: spec.puzzles, interactables: spec.interactables, pickups: spec.pickups,
    water: spec.water, blocks: spec.blocks, records: [], hidden: [], stations: [], drains: [],
    hints: {
      objectives: ['Each objective room holds its own clue: a card, a diagram or a photo on a table nearby. No film is needed.', 'Complete all three objectives and engage the relay control switch. Extraction then opens.'],
      threat: [`This run's creature keeps its campaign rules. Watch for its warning.`, 'Every threat room has a second exit: go around rather than through.'],
    },
    navHints: {},
    director: { ambient: ['distantDoor', 'pipeKnock'] },
    script: expeditionScript,
  };
}

function objectivesDone(game) { return game.chapterDef.puzzles.filter((p) => game.isPuzzleDone(p.id)).length; }

function updateGoal(game) {
  const S = game.story;
  const n = objectivesDone(game), relay = S.has('x.relay');
  if (n >= 3 && relay && !S.has('x.ready')) {
    S.set('x.ready');
    game.fx('caption', { text: '[Somewhere ahead, the extraction gate grinds open]', env: true });
    S.setObjective('extract', 'Reach the extraction lift.');
    return;
  }
  if (!S.has('x.ready')) S.setObjective(`x${n}${relay ? 'r' : ''}`, `Objectives ${n}/3 · relay control ${relay ? 'engaged' : 'not engaged'}. Then reach extraction.`);
}

export const expeditionScript = {
  init(game) {
    const S = game.story;
    for (const m of game.expedition?.machines || []) defineMachine(game, m.id, { x: m.x, z: m.z, run: m.run, rest: m.rest, offset: m.offset, mask: m.mask, label: 'Machine' });
    for (const c of game.expedition?.cycles || []) defineCycle(game, c.id, { x: c.x, z: c.z, auto: c.auto, label: 'Display shutters' });
    for (const t of game.expedition?.threats || []) {
      if (game.enemyById(t.id) || S.has(`gone.${t.id}`)) continue;
      if (t.type === 'cutout') game.spawn('cutout', { id: t.id, x: t.x, z: t.z, yaw: 0, anchor: { x: t.x, z: t.z, yaw: 0 }, group: t.group, mode: 'hunt', region: t.region });
      else {
        const c = game.spawn(t.type, { id: t.id, x: t.x, z: t.z, anchors: t.anchors, withdrawTo: t.anchors[0], region: t.region, encounter: 'expedition', armed: true, state: 'patrol' });
        c.setState('patrol');
      }
    }
    updateGoal(game);
    S.setRadio(null);
  },
  update() {},
  onEnterRoom(game, p, room, prev, first) {
    if (!first) return;
    const t = (game.expedition?.threats || []).find((x) => x.room === room.id);
    if (t) game.fx('tutorial', { id: `xthreat${t.id}`, text: 'Threat area. It keeps its old rules, and this room has a second way around.' });
  },
  onTimer() {},
  onInteract(game, p, it, phase) {
    const S = game.story;
    if (it.id === 'xrelay' && phase === 'begin') {
      if (S.has('x.relay')) return { ok: true };
      S.set('x.relay');
      game.fx('sfx', { name: 'relayClick', x: it.x, z: it.z });
      game.fx('network', { segment: 'relay' });
      updateGoal(game);
      return { ok: true };
    }
    if (it.id === 'xlift' && phase === 'begin') {
      if (!S.has('x.ready')) return { ok: false, msg: 'The extraction lift has no power.' };
      if (S.has('x.done')) return { ok: true };
      S.set('x.done');
      game.over = { kind: 'expedition', success: true };
      game.fx('expeditionDone', { success: true, seed: game.expedition.seed, seedText: game.expedition.seedText, theme: game.expedition.theme, time: game.elapsed, photos: game.stats.photos, downs: game.stats.downs, deaths: game.stats.deaths });
      return { ok: true };
    }
    return null;
  },
  onPuzzle(game) { updateGoal(game); },
};

/** Start a run on an existing game with its players: generate, load, apply the Expedition kit. */
export function startExpedition(game, seed, addToPouch) {
  const spec = generateSpec(seed);
  game.mode = 'expedition';
  game.expedition = spec;
  game.customDefs = { X: buildExpeditionDef(spec) };
  game.loadChapter('X');
  for (const p of game.players.values()) {
    p.health = 100; p.composure = 100; p.charge = 60; p.film = 4; p.hasCamera = true; p.hasFlashlight = true;
    p.pouch = p.pouch.map(() => null);
    if (addToPouch) { addToPouch(p, 'bandage', 1); addToPouch(p, 'decoy', 1); }
  }
  game.makeCheckpoint('expedition start');
  return spec;
}
