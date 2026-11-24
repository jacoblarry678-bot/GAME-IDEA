// Physical queue lines (built by the Roblox park builder, see
// src/shared/QueueLine.luau): the path through each ride's switchback maze,
// the guests standing in line, and helpers for walking the player along it.
import * as THREE from 'three';

const FLOOR = 0.55; // top of the queue floor
// the Express line stands beside standby; Front of the Line waits at the
// gate on the other side
export const EXPRESS_SIDE = 1.3;
export const FOTL_SIDE = -1.3;
export const FOTL = { ride: 'RideFOTL', haunt: 'HauntFOTL' };
const WALK = 4.5; // how fast guests shuffle forward (studs/s)

export class QueuePath {
  constructor(q) {
    this.pts = [];
    for (let i = 0; i < q.points.length; i += 2) this.pts.push({ x: q.points[i], z: q.points[i + 1] });
    this.cum = q.cum;
    this.length = q.length;
    this.signAt = q.signAt;
    this.gate = { x: q.gate[0], z: q.gate[1] };
    this.floor = q.floor ?? FLOOR;
    this.extendedAt = q.extendedAt ?? 0; // where the extended queue starts (0: none)
    // a pre-show room on the way (see QueueCrowd): { sIn, sOut, rect, yaw, cap, period, swap }
    this.preshow = q.preshow || null;
  }

  // position `s` studs back from the gate and the direction toward the front
  // (`side` steps off to one side of the line: the Express lane)
  pointAt(s, out = { x: 0, z: 0, fx: 0, fz: 1 }, side = 0) {
    const { pts, cum } = this;
    s = Math.min(Math.max(s, 0), this.length);
    let i = 1;
    while (i < pts.length - 1 && s > cum[i]) i++;
    const a = pts[i - 1], b = pts[i];
    const seg = cum[i] - cum[i - 1];
    const u = seg > 0 ? Math.min(1, Math.max(0, (s - cum[i - 1]) / seg)) : 0;
    out.x = a.x + (b.x - a.x) * u;
    out.z = a.z + (b.z - a.z) * u;
    const len = Math.hypot(a.x - b.x, a.z - b.z) || 1;
    out.fx = (a.x - b.x) / len;
    out.fz = (a.z - b.z) / len;
    if (side) { out.x += out.fz * side; out.z -= out.fx * side; }
    return out;
  }

  // closest point on the path: distance along it and distance away
  project(x, z) {
    const { pts, cum } = this;
    let bestS = 0, bestD = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const vx = b.x - a.x, vz = b.z - a.z;
      const l2 = vx * vx + vz * vz;
      const u = l2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / l2)) : 0;
      const d = Math.hypot(x - (a.x + vx * u), z - (a.z + vz * u));
      if (d < bestD) {
        bestD = d;
        bestS = cum[i - 1] + (cum[i] - cum[i - 1]) * u;
      }
    }
    return { s: bestS, d: bestD };
  }

  // Next point to walk to when going from distance s0 to s1 along the path
  // (the next bend in between, or the destination itself).
  nextWaypoint(s0, s1) {
    const { cum } = this;
    if (s1 < s0) {
      for (let i = cum.length - 1; i >= 0; i--) if (cum[i] < s0 - 0.05 && cum[i] > s1) return { ...this.pointAt(cum[i]), final: false };
    } else {
      for (let i = 0; i < cum.length; i++) if (cum[i] > s0 + 0.05 && cum[i] < s1) return { ...this.pointAt(cum[i]), final: false };
    }
    return { ...this.pointAt(s1), final: true };
  }
}

export function slotAt(index, spacing) {
  return index * spacing; // index 0 = next to board
}

// Guests standing in every line (drawn by the shared crowd renderer):
// they shuffle forward when the line moves and fidget while they wait.
export class QueueCrowd {
  constructor(people, data, paths) {
    this.people = people;
    this.paths = paths;
    this.spacing = data.queue.spacing;
    this.visual = new Map(); // entry id -> { s, walking, cycle }
    this.pt = { x: 0, z: 0, fx: 0, fz: 1 };
    this.rooms = new Map(); // ride id -> pre-show room: { n, count, group }
  }

  // A pre-show room: guests wait at its entry door until the doors open
  // between shows, then a crew member counts the next group in (up to the
  // room's capacity). When the show ends the group leaves together through
  // the far door. Returns the target to use, or null while in the room.
  preshow(st, path, e, v, tn, time, first, held) {
    const P = path.preshow;
    let room = this.rooms.get(st.id);
    if (!room) { room = { n: 0, count: 0, group: 0, shows: -1 }; this.rooms.set(st.id, room); }
    const u = ((time % P.period) + P.period) % P.period;
    const open = u > P.period - P.swap;
    const show = Math.floor(time / P.period);
    if (open && room.shows !== show) { room.shows = show; room.group = 0; }
    st.preshow = { count: room.count, group: room.group, inRoom: room.n, next: open ? 0 : Math.ceil(P.period - P.swap - u), open };
    const party = st.party || 1;
    if (v.room === 1) {
      // the show's over: out through the far door (once their spot in line is past it)
      if ((open || first) && tn < P.sOut) { v.room = 2; room.n--; }
      return null;
    }
    if (v.room === 2) return null;
    const gap = st.gap || this.spacing;
    if (held.next === undefined) held.next = P.sIn;
    const atDoor = tn < P.sIn && v.s >= P.sIn - 0.6;
    if (atDoor || (first && tn < P.sIn && tn >= P.sOut)) {
      if ((open || first) && room.n < P.cap && held.n === 0 && (first || v.s <= P.sIn + 0.6)) {
        v.room = 1; v.k = first ? 1 : 0; room.n++; room.count += party; room.group += party;
        return null;
      }
      // wait at the door (one behind another)
      const t = held.next;
      held.n++;
      held.next = t + gap;
      return t;
    }
    if (tn >= P.sIn && held.n > 0) {
      const t = Math.max(tn, held.next);
      held.next = t + gap;
      return t;
    }
    return tn;
  }

  // where a guest stands in the pre-show room (or walks in / out)
  roomPose(path, e, v, j, dt, out) {
    const P = path.preshow, r = P.rect;
    const h = (n) => { const x = Math.sin((e.id * 12.9898 + j * 78.233 + n * 37.719)) * 43758.5453; return x - Math.floor(x); };
    const sx = r.x0 + 1.2 + h(1) * (r.x1 - r.x0 - 2.4), sz = r.z0 + 1.2 + h(2) * (r.z1 - r.z0 - 2.4);
    const door = path.pointAt(v.room === 1 ? P.sIn : P.sOut, this.pt);
    const dx = sx - door.x, dz = sz - door.z, len = Math.hypot(dx, dz) || 1;
    if (j === 0) {
      const step = (4.5 * dt) / len;
      v.k = v.room === 1 ? Math.min(1, (v.k ?? 0) + step) : Math.max(0, (v.k ?? 1) - step);
    }
    const k = v.k;
    out.x = door.x + dx * k; out.z = door.z + dz * k;
    out.walking = v.room === 1 ? k < 1 : k > 0;
    out.yaw = out.walking ? (v.room === 1 ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz)) : P.yaw + Math.sin(e.id + j) * 0.3;
    return out;
  }

  // rides: sim ride states; cam: camera position; first: snap everyone in place
  update(dt, time, rides, cam, first) {
    const seen = new Set();
    for (const st of rides) {
      const path = this.paths.get(st.id);
      if (!path) continue;
      const near = Math.hypot(path.gate.x - cam.x, path.gate.z - cam.z) < 420;
      const party = st.party || 1;
      const lanes = [[st.queue, 0], [st.express || [], EXPRESS_SIDE]];
      const held = { n: 0 };
      if (path.preshow) {
        // who is in the pre-show room right now (guests can leave the line)
        const room = this.rooms.get(st.id);
        if (room) room.n = st.queue.reduce((n, e) => n + (this.visual.get(e.id)?.room === 1 ? 1 : 0), 0);
      }
      for (const [lane, side] of lanes) lane.forEach((e, index) => {
        if (e.player) return;
        seen.add(e.id);
        let target = slotAt(index, st.gap || this.spacing);
        let v = this.visual.get(e.id);
        if (!v) {
          // newcomers walk in from outside the entrance sign
          const start = first ? target : Math.max(target, Math.min(path.length, path.signAt + 4));
          v = { s: start, walking: false, cycle: (e.seed % 100) / 100 };
          this.visual.set(e.id, v);
        }
        if (path.preshow && !side) {
          const t = this.preshow(st, path, e, v, target, time, first, held);
          if (t === null) {
            // in the pre-show room (or walking in or out of it)
            if (v.room === 2 && v.k <= 0) { v.room = 0; v.s = path.preshow.sOut; }
            else {
              if (!near) { this.roomPose(path, e, v, 0, dt, this.rp || (this.rp = {})); return; }
              for (let j = 0; j < party; j++) {
                const p = this.roomPose(path, e, v, j, dt, this.rp || (this.rp = {}));
                const seed = j ? e.seed + j * 7919 : e.seed;
                if (p.walking) this.people.add('walk', time * 1.6 + j * 0.37, p.x, path.floor, p.z, p.yaw, seed);
                else this.people.add('idle', (seed >> 3) % 7 < 4 ? 0 : (seed >> 3) % 3 + 1, p.x, path.floor, p.z, p.yaw, seed);
              }
              return;
            }
          } else target = t;
        }
        const gap = target - v.s;
        const stepMax = WALK * dt;
        const step = Math.max(-stepMax, Math.min(stepMax, gap));
        v.walking = Math.abs(gap) > 0.05;
        v.s += step;
        v.cycle += Math.abs(step) / 5;
        if (!near) return;
        // a party stands one behind another
        for (let j = 0; j < party; j++) {
          const seed = j ? e.seed + j * 7919 : e.seed;
          path.pointAt(Math.min(path.length, v.s + j * this.spacing), this.pt, side);
          // idle guests glance around now and then
          const look = v.walking ? 0 : Math.sin(time * 0.6 + (seed % 97)) * 0.5;
          const yaw = Math.atan2(-this.pt.fx, -this.pt.fz) + look;
          if (v.walking) this.people.add('walk', v.cycle + j * 0.37, this.pt.x, path.floor, this.pt.z, yaw, seed);
          else this.people.add('idle', (seed >> 3) % 7 < 4 ? 0 : (seed >> 3) % 3 + 1, this.pt.x, path.floor, this.pt.z, yaw, seed);
        }
      });
    }
    for (const id of this.visual.keys()) if (!seen.has(id)) this.visual.delete(id);
  }
}
