/**
 * Level: turns a chapter (or Expedition) definition into rooms, walls with
 * door openings, floors, door objects, prop colliders, water and surface
 * zones, light anchors, refuge furniture and interactables. The same
 * description feeds the collision world, the nav grid, the sound graph and
 * the renderer, so what you see is exactly what blocks you.
 *
 * Coordinates: metres, Y up, z increases "north". Rooms are axis-aligned
 * boxes { x0, z0, w (x), d (z), h }. Walls sit inside each room's rectangle
 * (WALL_T thick), so two adjacent rooms form a 0.4 m wall.
 */
import { CollisionWorld } from './collision.js';
import { PROP_KINDS, propSize } from '../data/props.js';
import { NavGrid } from './nav.js';
import { SoundGraph } from './sound.js';

export const WALL_T = 0.2;
const EPS = 1e-3;

export const DOOR_TYPES = {
  door: { hinged: true, creatureOpen: 1.0, wedge: true, label: 'Door' },
  fire: { hinged: true, creatureOpen: 3.0, wedge: true, label: 'Fire door' },
  apartment: { hinged: true, creatureOpen: 1.0, tenantOpen: 3.0, wedge: true, label: 'Apartment door' },
  refuge: { hinged: true, creatureOpen: Infinity, label: 'Refuge door' },
  pressure: { hinged: true, creatureOpen: 4.0, isolates: true, wedge: true, label: 'Pressure door' },
  crawl: { open: true, crawl: true, label: 'Inspection crawlway' },
  arch: { open: true },
  shutter: { auto: true, label: 'Shutter' },
  gate: { auto: true, label: 'Gate' },
  lift: { auto: true, label: 'Lift doors' },
  hidden: { auto: true, label: 'Concealed door' },
  sealed: { auto: true, label: 'Sealed door' },
};

const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

export class Level {
  constructor(def) {
    this.def = def;
    this.world = new CollisionWorld(2);
    this.rooms = [];
    this.roomById = new Map();
    this.doors = [];
    this.doorById = new Map();
    this.walls = [];
    this.lintels = [];
    this.floors = [];
    this.flagFloors = [];
    this.props = [];
    this.propById = new Map();
    this.blocks = [];
    this.water = def.water ? def.water.map((w) => ({ depth: 0.45, ...w })) : [];
    this.surfaces = def.surfaces || [];
    this.crawl = def.crawl || [];
    this.lights = [];
    this.interactables = [];
    this.interById = new Map();
    this.hidden = (def.hidden || []).map((h) => ({ ...h, normal: faceNormal(h.face) }));
    this.hiddenById = new Map(this.hidden.map((h) => [h.id, h]));
    this.stations = def.stations || [];
    this.errors = [];
    this._buildRooms();
    this._buildDoors();
    this._buildWalls();
    this._buildProps();
    this._buildBlocks();
    this._buildLights();
    this._buildRefuges();
    this._buildInteractables();
    this.bounds = this._bounds();
    // props that appear later (`after: flag`) and stay are part of the walkable layout; plan around them now
    const later = this.props.filter((p) => p.box && p.after);
    for (const p of later) p.box.active = true;
    this.nav = new NavGrid(this);
    for (const p of later) p.box.active = false;
    this.sound = new SoundGraph(this);
  }

  // ---------------------------------------------------------------- rooms
  _buildRooms() {
    for (const r of this.def.rooms) {
      const room = { kit: this.def.kit, surface: 'carpet', light: 'normal', ...r, x1: r.x0 + r.w, z1: r.z0 + r.d, index: this.rooms.length, doors: [] };
      room.cx = (room.x0 + room.x1) / 2; room.cz = (room.z0 + room.z1) / 2;
      room.floorY = r.floorY || 0;
      if (this.roomById.has(room.id)) this.errors.push(`duplicate room ${room.id}`);
      this.rooms.push(room);
      this.roomById.set(room.id, room);
      if (!r.noFloor) {
        const f = { room: room.id, x0: room.x0, z0: room.z0, x1: room.x1, z1: room.z1, y: room.floorY };
        this.floors.push(f);
        this.world.add({ minX: f.x0, minZ: f.z0, maxX: f.x1, maxZ: f.z1, minY: f.y - 0.3, maxY: f.y, sight: true, tag: 'floor' });
      }
      for (const f of r.floors || []) {
        const opt = f[6] || {};
        const fl = { room: room.id, x0: f[0], z0: f[1], x1: f[2], z1: f[3], y: f[4] || 0, grate: !!f[5], until: opt.until || null, after: opt.after || null };
        this.floors.push(fl);
        // flag-driven floors (a bridge that appears) start active so the nav grid includes them; the game syncs them to flags
        fl.box = this.world.add({ minX: fl.x0, minZ: fl.z0, maxX: fl.x1, maxZ: fl.z1, minY: fl.y - 0.3, maxY: fl.y, sight: false, tag: 'floor' });
        if (fl.until || fl.after) this.flagFloors.push(fl);
      }
    }
    for (let i = 0; i < this.rooms.length; i++) {
      for (let j = i + 1; j < this.rooms.length; j++) {
        const a = this.rooms[i], b = this.rooms[j];
        if (a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS) this.errors.push(`rooms ${a.id} and ${b.id} overlap`);
      }
    }
  }

  room(id) { return this.roomById.get(id); }

  /** Room containing the point (inclusive of its walls). Prefers the room whose interior holds it. */
  roomAt(x, z) {
    let best = null;
    for (const r of this.rooms) {
      if (x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS) {
        if (x > r.x0 + WALL_T && x < r.x1 - WALL_T && z > r.z0 + WALL_T && z < r.z1 - WALL_T) return r;
        best = best || r;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- doors
  _buildDoors() {
    for (const d of this.def.doors) {
      const a = this.roomById.get(d.a);
      const b = d.b ? this.roomById.get(d.b) : null;
      if (!a || (d.b && !b)) { this.errors.push(`door ${d.id}: unknown room`); continue; }
      const type = d.type || 'door';
      const T = DOOR_TYPES[type];
      if (!T) { this.errors.push(`door ${d.id}: unknown type ${type}`); continue; }
      let side, lo, hi;
      if (b) {
        if (Math.abs(a.x1 - b.x0) < EPS) side = 'E';
        else if (Math.abs(a.x0 - b.x1) < EPS) side = 'W';
        else if (Math.abs(a.z1 - b.z0) < EPS) side = 'N';
        else if (Math.abs(a.z0 - b.z1) < EPS) side = 'S';
        if (!side) { this.errors.push(`door ${d.id}: rooms ${a.id} and ${b.id} do not share a wall`); continue; }
        if (side === 'E' || side === 'W') { lo = Math.max(a.z0, b.z0); hi = Math.min(a.z1, b.z1); } else { lo = Math.max(a.x0, b.x0); hi = Math.min(a.x1, b.x1); }
      } else {
        side = d.side;
        if (side === 'E' || side === 'W') { lo = a.z0; hi = a.z1; } else { lo = a.x0; hi = a.x1; }
      }
      const w = d.w || (T.open ? (T.crawl ? 0.9 : 1.6) : type === 'shutter' ? 2.4 : 1.2);
      const h = d.h || (T.crawl ? 1.2 : type === 'shutter' ? 2.8 : 2.2);
      const c = d.pos !== undefined ? d.pos : (lo + hi) / 2 + (d.at || 0);
      if (c - w / 2 < lo + WALL_T + 0.05 - EPS || c + w / 2 > hi - WALL_T - 0.05 + EPS) this.errors.push(`door ${d.id}: opening ${c - w / 2}..${c + w / 2} does not fit shared wall ${lo}..${hi}`);
      const axis = side === 'E' || side === 'W' ? 'x' : 'z';
      const bnd = side === 'E' ? a.x1 : side === 'W' ? a.x0 : side === 'N' ? a.z1 : a.z0;
      const x = axis === 'x' ? bnd : c, z = axis === 'x' ? c : bnd;
      const door = {
        id: d.id, a: a.id, b: b ? b.id : null, type, T, side, axis, bnd, c, w, h, x, z,
        open: T.open ? 1 : (d.open ? 1 : 0), target: T.open ? 1 : (d.open ? 1 : 0),
        lock: d.lock || null, lockText: d.lockText || null, unlockFrom: d.unlockFrom || null,
        reveal: d.reveal || null, label: d.label || T.label || 'Door',
        index: this.doors.length, wedgeUntil: 0, transition: d.transition || null, noInteract: !!d.noInteract,
        sealedText: d.sealedText || null,
      };
      // closed door collider spans both rooms' wall thickness
      const t0 = b ? WALL_T : WALL_T;
      const minN = side === 'E' || side === 'N' ? bnd - WALL_T : bnd - (b ? WALL_T : 0);
      const maxN = side === 'E' || side === 'N' ? bnd + (b ? WALL_T : 0) : bnd + WALL_T;
      void t0;
      if (!T.open) {
        door.box = axis === 'x'
          ? this.world.add({ minX: minN, maxX: maxN, minZ: c - w / 2, maxZ: c + w / 2, minY: 0, maxY: h, tag: 'door' })
          : this.world.add({ minZ: minN, maxZ: maxN, minX: c - w / 2, maxX: c + w / 2, minY: 0, maxY: h, tag: 'door' });
        door.box.door = door;
        door.box.active = door.open < 0.5;
        // mesh doors and shutters let sound and some light through but block movement
        if (type === 'shutter' || type === 'gate') door.box.sight = !!d.opaque;
      }
      a.doors.push(door);
      if (b) b.doors.push(door);
      this.doors.push(door);
      this.doorById.set(door.id, door);
    }
  }

  /** Opening intervals cut into room `r`'s wall on `side`. */
  _openings(r, side) {
    const out = [];
    for (const d of r.doors) {
      const s = d.a === r.id ? d.side : OPPOSITE[d.side];
      if (s !== side) continue;
      const widen = d.b === r.id ? 0.004 : 0; // avoid coplanar jamb faces between the two rooms
      out.push([d.c - d.w / 2 - widen, d.c + d.w / 2 + widen, d]);
    }
    return out.sort((p, q) => p[0] - q[0]);
  }

  // ---------------------------------------------------------------- walls
  _buildWalls() {
    const t = WALL_T;
    for (const r of this.rooms) {
      const y0 = r.floorY - 0.3, y1 = r.floorY + r.h;
      for (const side of ['N', 'S', 'E', 'W']) {
        if (r.open && r.open.includes(side)) continue;
        const along = side === 'E' || side === 'W' ? [r.z0, r.z1] : [r.x0, r.x1];
        const ops = this._openings(r, side);
        let cur = along[0];
        const segs = [];
        for (const [o0, o1, d] of ops) {
          if (o0 > cur) segs.push([cur, o0]);
          cur = Math.max(cur, o1);
          if (d.h < r.h) this.lintels.push({ room: r.id, side, a0: o0, a1: o1, y0: r.floorY + d.h, y1, door: d.id });
        }
        if (cur < along[1]) segs.push([cur, along[1]]);
        for (const [s0, s1] of segs) {
          let box;
          if (side === 'W') box = { minX: r.x0, maxX: r.x0 + t, minZ: s0, maxZ: s1 };
          else if (side === 'E') box = { minX: r.x1 - t, maxX: r.x1, minZ: s0, maxZ: s1 };
          else if (side === 'S') box = { minZ: r.z0, maxZ: r.z0 + t, minX: s0, maxX: s1 };
          else box = { minZ: r.z1 - t, maxZ: r.z1, minX: s0, maxX: s1 };
          box.minY = y0; box.maxY = y1; box.tag = 'wall';
          const b = this.world.add(box);
          this.walls.push({ room: r.id, side, a0: s0, a1: s1, y0, y1, box: b });
        }
      }
      for (const l of this.lintels) if (l.room === r.id) {
        const box = l.side === 'W' ? { minX: r.x0, maxX: r.x0 + t, minZ: l.a0, maxZ: l.a1 }
          : l.side === 'E' ? { minX: r.x1 - t, maxX: r.x1, minZ: l.a0, maxZ: l.a1 }
            : l.side === 'S' ? { minZ: r.z0, maxZ: r.z0 + t, minX: l.a0, maxX: l.a1 } : { minZ: r.z1 - t, maxZ: r.z1, minX: l.a0, maxX: l.a1 };
        box.minY = l.y0; box.maxY = l.y1; box.tag = 'wall';
        if (!l.box) l.box = this.world.add(box);
      }
    }
  }

  // ---------------------------------------------------------------- props
  _buildProps() {
    for (const p of this.def.props || []) {
      const K = PROP_KINDS[p.k];
      if (!K) { this.errors.push(`unknown prop kind ${p.k}`); continue; }
      const [w, d, h] = propSize(p);
      const prop = { ...p, w, d, h, y: p.y || 0, room: p.room || (this.roomAt(p.x, p.z) || {}).id };
      prop.minX = p.x - w / 2; prop.maxX = p.x + w / 2; prop.minZ = p.z - d / 2; prop.maxZ = p.z + d / 2;
      const solid = p.solid !== undefined ? p.solid : K.solid !== false;
      if (solid) {
        prop.box = this.world.add({
          minX: prop.minX, maxX: prop.maxX, minZ: prop.minZ, maxZ: prop.maxZ, minY: prop.y, maxY: prop.y + h,
          sight: p.sight !== undefined ? p.sight : K.sight !== false && !K.low, mask: p.mask || K.mask || 3, mantle: !!K.mantle || !!p.mantle, tag: 'prop',
        });
        prop.box.prop = prop;
        if (p.until || p.after) prop.box.active = !!p.after === false;
      }
      this.props.push(prop);
      if (p.id) this.propById.set(p.id, prop);
    }
  }

  _buildBlocks() {
    for (const b of this.def.blocks || []) {
      const box = this.world.add({ minX: b.x0, maxX: b.x1, minZ: b.z0, maxZ: b.z1, minY: b.y0 ?? 0, maxY: b.y1 ?? 3, sight: !!b.sight, mask: b.mask ?? 3, tag: 'block' });
      const blk = { ...b, box };
      box.active = !b.after; // `after: flag` blocks appear later; `until: flag` blocks vanish when the flag is set
      this.blocks.push(blk);
    }
  }

  // ---------------------------------------------------------------- lights
  _buildLights() {
    for (const r of this.rooms) {
      if (r.lights === false) continue;
      const pts = r.lights || autoLights(r);
      for (const p of pts) {
        this.lights.push({ room: r.id, x: p[0], z: p[1], y: r.floorY + (p[2] !== undefined ? p[2] : r.h - 0.04), level: r.light, flicker: !!(r.flicker && p === pts[0]), index: this.lights.length });
      }
    }
  }

  // ---------------------------------------------------------------- refuges
  _buildRefuges() {
    this.refuges = [];
    for (const r of this.rooms) {
      if (!r.refuge) continue;
      const genuine = r.refuge !== 'imitation';
      const side = pickFurnitureWall(r);
      const ref = { room: r.id, label: r.refuge, genuine, side, items: [], verified: false };
      // clock high on the furniture wall, map board left, cabinet + charger right, deck on a low table
      const pos = (along, off = 0.12, y = 1.2) => wallPoint(r, side, along, off, y);
      const L = side === 'N' || side === 'S' ? r.w : r.d;
      const mid = L / 2;
      ref.clock = { id: `clock_${r.id}`, kind: 'clock', ...pos(mid, 0.1, 2.15), room: r.id, face: inward(side), genuine };
      ref.items.push({ id: `map_${r.id}`, kind: 'mapboard', ...pos(Math.max(1.0, mid - 1.8), 0.1, 1.45), room: r.id, face: inward(side) });
      ref.items.push({ id: `cab_${r.id}`, kind: 'cabinet', ...pos(Math.min(L - 1.0, mid + 1.7), 0.35, 0.9), room: r.id, face: inward(side), housing: 0.9 });
      ref.items.push({ id: `chg_${r.id}`, kind: 'charger', ...pos(Math.min(L - 1.0, mid + 0.9), 0.2, 1.1), room: r.id, face: inward(side) });
      ref.items.push({ id: `deck_${r.id}`, kind: 'deck', ...pos(mid, 0.9, 0.8), room: r.id, face: inward(side) });
      if (!genuine) {
        ref.offered = { id: `offer_${r.id}`, kind: 'offered', ...pos(mid, 1.6, 0.8), room: r.id, item: r.offerItem || 'tea' };
      }
      this.refuges.push(ref);
      r.refugeData = ref;
      // furniture colliders: a cabinet and a table so the room reads as furnished
      const cab = ref.items[1];
      this.world.add({ minX: cab.x - 0.45, maxX: cab.x + 0.45, minZ: cab.z - 0.45, maxZ: cab.z + 0.45, minY: 0, maxY: 1.5, tag: 'prop' });
      const deck = ref.items[3];
      this.world.add({ minX: deck.x - 0.45, maxX: deck.x + 0.45, minZ: deck.z - 0.35, maxZ: deck.z + 0.35, minY: 0, maxY: 0.75, sight: false, tag: 'prop' });
    }
  }

  // ---------------------------------------------------------------- interactables
  _addInter(it) {
    const room = it.room || (this.roomAt(it.x, it.z) || {}).id;
    const obj = { y: 1.0, ...it, room };
    if (this.interById.has(obj.id)) this.errors.push(`duplicate interactable ${obj.id}`);
    this.interactables.push(obj);
    this.interById.set(obj.id, obj);
    return obj;
  }

  _buildInteractables() {
    for (const d of this.doors) {
      if (d.T.open || d.noInteract) continue;
      // one handle per side so the prompt points at the near face
      this._addInter({ id: `door:${d.id}`, kind: 'door', door: d.id, x: d.x, y: 1.1, z: d.z, room: d.a, reach: 1.9 });
    }
    for (const ref of this.refuges) {
      this._addInter({ ...ref.clock });
      for (const it of ref.items) this._addInter(it);
      if (ref.offered) this._addInter(ref.offered);
    }
    for (const p of this.def.pickups || []) this._addInter({ kind: 'pickup', y: 0.9, ...p, id: p.id });
    for (const r of this.def.records || []) this._addInter({ kind: 'record', y: 1.0, ...r, id: `rec:${r.id}`, record: r.id });
    for (const s of this.stations) this._addInter({ kind: 'station', y: 1.2, ...s.panel, id: `station:${s.id}`, station: s.id });
    for (const p of this.def.puzzles || []) if (p.panel) this._addInter({ kind: 'panel', y: 1.3, ...p.panel, id: `panel:${p.id}`, puzzle: p.id });
    for (const it of this.def.interactables || []) this._addInter(it);
    for (const p of this.props) if (PROP_KINDS[p.k].hide) this._addInter({ id: `locker:${p.id || `${p.x},${p.z}`}`, kind: 'locker', x: p.x, y: 1.2, z: p.z, prop: p, face: p.face || 'S' });
  }

  _bounds() {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const r of this.rooms) { minX = Math.min(minX, r.x0); minZ = Math.min(minZ, r.z0); maxX = Math.max(maxX, r.x1); maxZ = Math.max(maxZ, r.z1); }
    return { minX, minZ, maxX, maxZ };
  }

  // ---------------------------------------------------------------- queries
  waterAt(x, z) {
    for (const w of this.water) {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      if (this.flagFn && ((w.until && this.flagFn(w.until)) || (w.after && !this.flagFn(w.after)))) continue;
      return w;
    }
    return null;
  }
  waterAtIdx(i) { const c = this.nav.center(i); return this.waterAt(c.x, c.z); }
  surfaceAt(x, z) {
    if (this.waterAt(x, z)) return 'water';
    for (const s of this.surfaces) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.s;
    const r = this.roomAt(x, z);
    return r ? r.surface : 'concrete';
  }
  inCrawl(x, z) {
    for (const c of this.crawl) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
    return false;
  }
  door(id) { return this.doorById.get(id); }
  setDoorOpen(door, open) {
    door.target = open ? 1 : 0;
  }
  /** Apply door animation; colliders follow (passable once mostly open). */
  updateDoors(dt) {
    for (const d of this.doors) {
      if (d.open === d.target) continue;
      const speed = d.type === 'shutter' ? 0.45 : d.type === 'gate' || d.type === 'lift' ? 0.8 : d.fast ? 4.5 : 1.6;
      d.open = d.target > d.open ? Math.min(d.target, d.open + speed * dt) : Math.max(d.target, d.open - speed * dt);
      if (d.box) d.box.active = d.open < 0.6;
    }
  }
  clearLine(a, b) { return this.world.clearLine(a.x, a.y, a.z, b.x, b.y, b.z); }
}

function autoLights(r) {
  const nx = Math.max(1, Math.round(r.w / 6)), nz = Math.max(1, Math.round(r.d / 6));
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push([r.x0 + (i + 0.5) * r.w / nx, r.z0 + (j + 0.5) * r.d / nz]);
  return out;
}

export function faceNormal(face) {
  switch (face) {
    case 'N': return [0, 0, 1];
    case 'S': return [0, 0, -1];
    case 'E': return [1, 0, 0];
    case 'W': return [-1, 0, 0];
    case 'up': return [0, 1, 0];
    case 'down': return [0, -1, 0];
    default: return [0, 0, 1];
  }
}

/** Direction a furniture item on wall `side` faces (into the room). */
function inward(side) { return OPPOSITE[side]; }

function pickFurnitureWall(r) {
  if (r.furnitureWall) return r.furnitureWall;
  const busy = { N: 0, S: 0, E: 0, W: 0 };
  for (const d of r.doors) busy[d.a === r.id ? d.side : OPPOSITE[d.side]]++;
  const order = r.w >= r.d ? ['N', 'S', 'E', 'W'] : ['E', 'W', 'N', 'S'];
  for (const s of order) if (!busy[s]) return s;
  return order[0];
}

/** Point on the inner face of wall `side`, `along` metres from the wall start, `off` metres into the room. */
function wallPoint(r, side, along, off, y) {
  const t = WALL_T;
  switch (side) {
    case 'N': return { x: r.x0 + along, z: r.z1 - t - off, y };
    case 'S': return { x: r.x0 + along, z: r.z0 + t + off, y };
    case 'E': return { x: r.x1 - t - off, z: r.z0 + along, y };
    default: return { x: r.x0 + t + off, z: r.z0 + along, y };
  }
}
