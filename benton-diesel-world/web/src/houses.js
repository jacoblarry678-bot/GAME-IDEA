// The Benton Haunt houses, open for the event: walk-through mazes inside
// the five backstage soundstages and the tent at Family Landing. Each one
// joins the park like a ride (posted waits, a line, a passport stamp), but
// guests walk it in groups: the corridors snake back and forth through
// the dark under strings of colored light, past themed scenes where scare
// actors lunge out as you pass.
import { HOUSES, STAGE_Z, QUEUE, STAGE, stageX } from './backstage.js';
import { FAMILY_QUEUE } from './haunt.js';

export const WALK = 6; // how fast a group walks a house (studs/s)
const G = 0.1;
const HALF = 3.2; // half the corridor width
const CORRIDOR_H = 11;

// polyline helpers
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return cum;
}
export function pointAt(path, s) {
  const { pts, cum } = path;
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1;
  while (i < pts.length - 1 && s > cum[i]) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const u = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, fx: (b[0] - a[0]) / seg, fz: (b[1] - a[1]) / seg };
}

// A ride's queue path from the boarding gate (s = 0) back out past the
// entrance sign; `fwd` runs the other way, from outside to the gate.
function queueData(fwd, signIndex, floor) {
  const pts = [...fwd].reverse();
  const cum = cumulative(pts);
  const [gx, gz] = pts[0], [nx, nz] = pts[1];
  const gl = dist(pts[0], pts[1]) || 1;
  return {
    points: pts.flat(), cum, length: cum[cum.length - 1], signAt: cum[pts.length - 1 - signIndex],
    gate: pts[0], gateDir: [(gx - nx) / gl, (gz - nz) / gl], outward: [0, 1], floor,
  };
}

export function buildHouses(data, familyLayout) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], c, 0, s, 0, 1, 0, -s, 0, c, color, mi(mat), 0, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const houses = [];

  // Corridor walls both sides of a right-angled polyline (mitred corners),
  // a blackout ceiling over it, a dim floor light every few studs.
  const corridor = (pts, color, mat) => {
    const n = pts.length;
    const normal = (a, b) => {
      const l = dist(a, b) || 1;
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    };
    for (const side of [-1, 1]) {
      const off = pts.map((p, i) => {
        const n1 = i > 0 ? normal(pts[i - 1], p) : normal(p, pts[i + 1]);
        const n2 = i < n - 1 ? normal(p, pts[i + 1]) : n1;
        const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
        return [p[0] + (side * HALF * (n1[0] + n2[0])) / d, p[1] + (side * HALF * (n1[1] + n2[1])) / d];
      });
      for (let i = 0; i < n - 1; i++) {
        const a = off[i], b = off[i + 1];
        const len = dist(a, b) + 0.6;
        add([0.6, CORRIDOR_H, len], [(a[0] + b[0]) / 2, G + CORRIDOR_H / 2, (a[1] + b[1]) / 2], color, mat, { yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
      }
    }
    // ceiling strips over each segment, guide lights along the floor
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = dist(a, b) + HALF * 2;
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([HALF * 2 + 0.6, 0.3, len], [(a[0] + b[0]) / 2, G + CORRIDOR_H + 0.15, (a[1] + b[1]) / 2], 0x0a0a0c, 'SmoothPlastic', { yaw, collide: 0 });
      add([HALF * 2, 0.04, len], [(a[0] + b[0]) / 2, G + 0.03, (a[1] + b[1]) / 2], 0x141216, 'SmoothPlastic', { yaw, collide: 0 });
    }
  };

  // a scene beside the corridor at (x, z): props against one wall, a light
  // overhead and a scare actor waiting on the other side
  const scene = (theme, glow, x, z, fx, fz, land, k) => {
    const sx = -fz, sz = fx; // to the corridor's left
    const side = k % 2 ? 1 : -1;
    const px = x + sx * side * 2.3, pz = z + sz * side * 2.3;
    const ax = x - sx * side * 2.3, az = z - sz * side * 2.3;
    const yaw = Math.atan2(fx, fz);
    add([0.9, 0.9, 0.9], [x, G + CORRIDOR_H - 0.6, z], glow, 'Neon', { shape: 3, collide: 0 });
    const t = theme;
    if (t === 'garage') {
      box([1.4, 2.4, 3.6], [px, G, pz], 0x5a2a20, 'CorrodedMetal', { yaw, collide: 0 });
      add([1.2, 1.2, 0.6], [px, G + 3, pz], 0x1a1a1a, 'Rubber', { shape: 5, collide: 0 });
    } else if (t === 'mine') {
      add([2.2, 2.2, 2.2], [px, G + 0.8, pz], 0x5a524a, 'Slate', { shape: 3, collide: 0 });
      box([0.4, 6, 0.4], [px, G, pz], 0x3a2a1c, 'Wood', { collide: 0 });
      add([0.5, 0.7, 0.5], [px, G + 5, pz], 0xffb040, 'Neon', { collide: 0 });
    } else if (t === 'film') {
      box([1.2, 7, 3.6], [px, G, pz], 0x8a1c22, 'Fabric', { yaw, collide: 0 });
      add([1, 1, 1], [px, G + 7.6, pz], 0xfff6d8, 'Neon', { collide: 0 });
    } else if (t === 'crash') {
      box([1.2, 1.6, 3], [px, G, pz], 0xf2c818, 'SmoothPlastic', { yaw, collide: 0 });
      box([0.8, 2.4, 0.6], [px, G + 1.6, pz], 0xf2c818, 'SmoothPlastic', { collide: 0 });
      add([0.7, 0.7, 0.7], [px, G + 4.4, pz], 0xf2c818, 'SmoothPlastic', { shape: 3, collide: 0 });
    } else if (t === 'engine') {
      for (const d of [-1, 1]) box([0.9, CORRIDOR_H, 0.9], [px + fx * d * 1.2, G, pz + fz * d * 1.2], 0x5a5e66, 'Metal', { shape: 5, collide: 0 });
      add([0.4, 2, 1.6], [px, G + 2, pz], 0xff6a10, 'Neon', { yaw, collide: 0 });
    } else {
      for (let j = 0; j < 3; j++) add([0.9, 0.9, 3.4], [px, G + 0.45 + j * 0.9, pz], 0x6a4428, 'Wood', { shape: 2, yaw: yaw + Math.PI / 2, collide: 0 });
      add([0.5, 0.7, 0.5], [px, G + 4, pz], 0xffb040, 'Neon', { collide: 0 });
    }
    data.staffSpots.push({ role: 'scare', kind: 'idle', land, seed: 0, cf: cf(ax, G, az, yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2)) });
  };

  const addHouse = ({ id, name, land, theme, glow, wall, wallMat, interior, outsideIn, outsideOut, queueFwd, signIndex, entrance, origin, baseWait, description, speed = WALK }) => {
    corridor(interior, wall, wallMat);
    // scenes along the long corridors
    const path = { pts: [...outsideIn, ...interior, ...outsideOut] };
    path.cum = cumulative(path.pts);
    let k = 0;
    for (let i = 0; i < interior.length - 1; i++) {
      const a = interior[i], b = interior[i + 1];
      const len = dist(a, b);
      if (len < 30) continue;
      for (const u of [0.3, 0.75]) {
        const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
        scene(theme, glow, x, z, (b[0] - a[0]) / len, (b[1] - a[1]) / len, land, k++);
      }
    }
    const length = path.cum[path.cum.length - 1];
    const duration = Math.round(length / speed);
    const end = path.pts[path.pts.length - 1];
    const seats = [Array.from({ length: 12 }, () => [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])];
    data.rides.push({
      id, kind: 'walkthrough', duration, origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: 0, carSpacing: 0,
      cars: [], seats, capacity: 12, queue: queueData(queueFwd, signIndex, G + 0.2), extras: {}, extrasNames: [], crew: null,
    });
    data.config.Rides.push({
      id, name, land, category: 'Haunted House', thrill: 4, kind: 'walkthrough', carStyle: 'none', description,
      baseWait, origin, entrance: [entrance[0], 0, entrance[1]], exit: [end[0], 0, end[1]], yaw: 0, layout: id, cars: 0, carSpacing: 0, colors: [glow],
    });
    houses.push({ id, name, path, length, glow, speed });
  };

  const DESCRIPTIONS = {
    garage: "Bring your car in for a checkup and you won't be driving it out.",
    mine: 'Deep in the mountain, the miners who never came home are still digging.',
    film: 'The premiere is tonight. The cast is dying to meet you.',
    crash: 'Buckle up. The dummies have stopped taking the hits.',
    engine: 'The old Benton Engine Works never really shut down. Something is still working the night shift.',
    lodge: 'When the fountain lights go dark, the lake gives something back.',
  };
  const WALLS = { garage: [0x2a2c30, 'CorrodedMetal'], mine: [0x3a342e, 'Slate'], film: [0x2a0e12, 'Fabric'], crash: [0x26262a, 'SmoothPlastic'], engine: [0x222428, 'DiamondPlate'], lodge: [0x2a1c14, 'WoodPlanks'] };

  // the five soundstage houses
  HOUSES.forEach((h, i) => {
    const x = stageX(i), F = STAGE_Z;
    const L = (dx, dz) => [x + dx, F + dz];
    const interior = [L(0, -1.3), L(0, -12), L(-30, -12), L(-30, -84), L(-18, -84), L(-18, -24), L(-6, -24), L(-6, -84),
      L(6, -84), L(6, -24), L(18, -24), L(18, -84), L(30, -84), L(30, -6), L(STAGE.W / 2 - 1.3, -6)];
    // the line: in at the west end of the front barricade, back and forth
    // down the turf, then up to the house's door
    const qx0 = x - 35, qx1 = x + 35;
    const rowZ = (k) => (k < 12 ? QUEUE.z1 - 7 * k - 3.5 : QUEUE.z0 + 4);
    const fwd = [[qx0 + 4, QUEUE.z1 + 30], [qx0 + 4, QUEUE.z1 + 2.5], [qx0 + 4, rowZ(0)]];
    for (let k = 0; k < 12; k++) {
      const ex = k % 2 ? qx0 + 3.5 : qx1 - 3.5;
      fwd.push([ex, rowZ(k)], [ex, rowZ(k + 1)]);
    }
    fwd.push([x, rowZ(12)], [x, F + 6.5]);
    const id = `Haunt${h.theme[0].toUpperCase()}${h.theme.slice(1)}`;
    const [wall, wallMat] = WALLS[h.theme];
    addHouse({
      id, name: h.title,
      land: 'Studios', theme: h.theme, glow: h.glow, wall, wallMat, interior,
      outsideIn: [L(0, 6.5), L(0, 2)], outsideOut: [L(STAGE.W / 2 + 4, -6)],
      queueFwd: fwd, signIndex: 1, entrance: [qx0 + 4, QUEUE.z1 + 2.5], origin: [x, 0, F - STAGE.D / 2],
      baseWait: [80, 65, 95, 70, 85][i], description: DESCRIPTIONS[h.theme], speed: WALK * [1, 0.92, 0.85, 0.96, 0.88][i],
    });
  });

  // the sixth house in the Family Landing tent
  if (familyLayout) {
    const T = familyLayout.tent, Q = FAMILY_QUEUE;
    const interior = [[T.x0 + 0.6, 214], [424, 214], [424, 221], [477, 221], [477, 213.5], [434, 213.5], [434, 206], [T.x1 - 0.6, 206]];
    const strip = (k) => Q.z0 + Q.step * k + Q.step / 2;
    const fwd = [[Q.x0 + 3, Q.z0 - 26], [Q.x0 + 3, Q.z0 - 2], [Q.x0 + 3, strip(0)]];
    for (let k = 0; k < Q.rows - 1; k++) {
      const ex = k % 2 ? Q.x0 + 3 : Q.x1 - 3;
      fwd.push([ex, strip(k)], [ex, strip(k + 1)]);
    }
    fwd.push([Q.x1 + 3, strip(Q.rows - 1)], [Q.x1 + 3, 214], [T.door[0], T.door[1]]);
    addHouse({
      id: 'HauntLodge', name: 'Lights Out at Lakeside', land: 'Family', theme: 'lodge', glow: 0xffb040,
      wall: WALLS.lodge[0], wallMat: WALLS.lodge[1], interior,
      outsideIn: [[T.door[0], T.door[1]]], outsideOut: [[T.x1 + 5, 206]],
      queueFwd: fwd, signIndex: 1, entrance: [Q.x0 + 3, Q.z0 - 2], origin: [(T.x0 + T.x1) / 2, 0, T.z],
      baseWait: 60, description: DESCRIPTIONS.lodge,
    });
  }
  Object.assign(data.staff.lines, {
    scare: ['BOO!', 'RAAAAH!', 'Get OUT!', "You shouldn't be here...", 'Join us...', 'Who let YOU in?', '*hisssss*', 'Run!'],
  });
  return houses;
}

// Groups of guests walking the houses, and the player's own walk through.
export class HouseWalks {
  constructor(houses, people) {
    this.houses = new Map(houses.map((h) => [h.id, h]));
    this.people = people;
  }

  // the point the player should be heading for, or null when not in a house
  playerTarget(sim, id, now, pos) {
    const h = this.houses.get(id);
    if (!h) return null;
    const st = sim.rides.get(id);
    const t = sim.rideTime(id, now);
    const s = st.status === 'Running' ? t * h.speed : 0;
    const here = pointAt(h.path, s);
    const ahead = pointAt(h.path, s + 2.5);
    return { here, target: { x: ahead.x, z: ahead.z, final: st.status !== 'Running' }, lost: Math.hypot(pos.x - here.x, pos.z - here.z) > 9 };
  }

  // draw the groups walking through (only near the camera)
  update(sim, now, cam) {
    for (const h of this.houses.values()) {
      const st = sim.rides.get(h.id);
      if (st.status !== 'Running') continue;
      const p0 = h.path.pts[0];
      if (Math.hypot(p0[0] - cam.x, p0[1] - cam.z) > 160) continue;
      const s0 = sim.rideTime(h.id, now) * h.speed;
      st.riders.forEach((r, k) => {
        if (r.player) return;
        const s = s0 - 1.5 - k * 1.6;
        if (s < 0) return;
        const p = pointAt(h.path, s);
        const lat = (k % 3) - 1;
        const x = p.x - p.fz * lat * 1.1, z = p.z + p.fx * lat * 1.1;
        this.people.add('walk', s / 5, x, G, z, Math.atan2(-p.fx, -p.fz), r.npc);
      });
    }
  }
}
