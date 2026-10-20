/**
 * Headless player bot for scripted playthroughs and tests. It drives the
 * simulation only through the public Game API a real client uses: inputs
 * (move axes, yaw, pitch, sprint, crouch), interactions, tool use, puzzle
 * actions. It never teleports.
 */
export const DT = 1 / 60;

export class Bot {
  constructor(game, pid, opts = {}) {
    this.g = game; this.pid = pid; this.log = opts.log || (() => {});
    this.events = [];
    this.keepEvents = opts.keepEvents !== false;
  }
  get p() { return this.g.players.get(this.pid); }
  /** Door passability for planning: locked doors and closed auto doors (shutters, gates) are walls. */
  doorCost(di) {
    const d = this.g.level.doors[di];
    if (this.g.isDoorLocked(d)) return Infinity;
    if (!d.T.hinged && !d.T.open && d.open < 0.6) return Infinity;
    return 0;
  }

  tick(n = 1) {
    for (let i = 0; i < n; i++) {
      this.g.tick(DT);
      const ev = this.g.drainEvents();
      if (this.keepEvents) this.events.push(...ev);
      if (this.onEvents) this.onEvents(ev);
      if (this.g.over) return false;
    }
    return true;
  }
  wait(sec) { return this.tick(Math.round(sec / DT)); }
  stop() { this.g.setInput(this.pid, { mx: 0, mz: 0, sprint: false }); }

  face(x, z) {
    const p = this.p;
    const yaw = Math.atan2(-(x - p.x), -(z - p.z));
    this.g.setInput(this.pid, { yaw });
  }
  look(x, y, z) {
    const p = this.p, e = p.eye();
    const yaw = Math.atan2(-(x - e.x), -(z - e.z));
    const pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z));
    this.g.setInput(this.pid, { yaw, pitch });
  }

  /** Walk along the nav grid to (x,z), opening closed hinged doors on the way. */
  walkTo(x, z, opts = {}) {
    const g = this.g, nav = g.level.nav, p = this.p;
    const tol = opts.tol ?? 0.45;
    const timeout = opts.timeout ?? 90;
    let t = 0, path = null, ix = 0, repath = 0;
    while (t < timeout) {
      if (Math.hypot(x - p.x, z - p.z) < tol) { this.stop(); return true; }
      if (!path || repath <= 0) {
        path = nav.path(p.x, p.z, x, z, null, (di) => this.doorCost(di));
        ix = 0; repath = 2;
        if (!path) { this.stop(); throw new Error(`bot: no path to ${x},${z} from ${p.x.toFixed(1)},${p.z.toFixed(1)}`); }
        path.push({ x, z });
      }
      let wp = path[ix];
      while (wp && Math.hypot(wp.x - p.x, wp.z - p.z) < 0.3 && ix < path.length - 1) { ix++; wp = path[ix]; }
      // closed door on the way?
      for (let k = ix; k < Math.min(path.length, ix + 3); k++) {
        const c = nav.indexAt(path[k].x, path[k].z);
        const di = c >= 0 ? nav.door[c] : -1;
        if (di < 0) continue;
        const d = g.level.doors[di];
        if (!d.T.open && d.open < 0.6 && d.T.hinged && Math.hypot(d.x - p.x, d.z - p.z) < 1.6) {
          this.stop();
          this.look(d.x, 1.1, d.z);
          this.tick(2);
          g.beginInteract(this.pid, `door:${d.id}`, { fast: !opts.quietDoors });
          if (opts.quietDoors) { this.wait(1.5); g.endInteract(this.pid); } else { g.endInteract(this.pid); this.wait(0.5); }
          this.wait(0.7);
        }
        break;
      }
      this.face(wp.x, wp.z);
      this.g.setInput(this.pid, { mz: 1, mx: 0, sprint: !!opts.sprint, crouch: !!opts.crouch });
      if (!this.tick(1)) return false;
      t += DT; repath -= DT;
      if (opts.until && opts.until()) { this.stop(); return true; }
    }
    this.stop();
    throw new Error(`bot: walkTo ${x},${z} timed out at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  }

  /** Walk in a straight line (no path finding) — for physical puzzles where the route matters. */
  walkStraight(x, z, opts = {}) {
    const p = this.p;
    let t = 0;
    while (Math.hypot(x - p.x, z - p.z) > (opts.tol ?? 0.25) && t < (opts.timeout ?? 20)) {
      this.face(x, z);
      this.g.setInput(this.pid, { mz: Math.hypot(x - p.x, z - p.z) < 0.6 ? 0.5 : 1, mx: 0, sprint: false, crouch: !!opts.crouch });
      if (!this.tick(1)) return false;
      t += 1 / 60;
    }
    this.stop();
    return t < (opts.timeout ?? 20);
  }

  /** Interact with interactable `id`, holding for `hold` seconds when needed. */
  use(id, hold = 0) {
    const g = this.g;
    const it = g.level.interById.get(id);
    if (it) {
      const reach = (it.reach || 1.8) - 0.3;
      if (Math.hypot(it.x - this.p.x, it.z - this.p.z) > Math.min(1.4, reach)) {
        const nav = g.level.nav, W = g.level.world;
        const seen = nav.reachable(this.p.x, this.p.z, null, (di) => this.doorCost(di));
        const i = nav.nearest(it.x, it.z, (k) => { if (!seen[k]) return false; const c = nav.center(k); const d = Math.hypot(c.x - it.x, c.z - it.z); return d > 0.55 && d <= reach && !W.overlaps(c.x - 0.37, nav.floorY[k] + 0.1, c.z - 0.37, c.x + 0.37, nav.floorY[k] + 1.7, c.z + 0.37, 1); }, 8);
        if (i < 0) throw new Error(`bot: cannot reach ${id}`);
        const c = nav.center(i);
        this.walkTo(c.x, c.z, { tol: 0.3 });
      }
      this.look(it.x, it.y ?? 1, it.z);
      this.tick(2);
    }
    const r = g.beginInteract(this.pid, id);
    if (hold > 0) { this.wait(hold + 0.2); }
    g.endInteract(this.pid);
    this.tick(2);
    return r;
  }

  puzzle(id, actions) {
    const out = [];
    for (const a of actions) { out.push(this.g.puzzleAction(this.pid, id, a)); this.tick(3); }
    return out;
  }

  photo(x, y, z, opts = {}) {
    this.g.equip(this.pid, 'camera');
    this.look(x, y, z); this.tick(2);
    const r = this.g.takePhoto(this.pid, { force: !!opts.force });
    this.wait(4.2);
    return r;
  }

  /** Stand still looking at a refuge clock for `sec` seconds. */
  watchClock(roomId, sec = 3.4) {
    const r = this.g.level.room(roomId);
    const c = r.refugeData.clock;
    this.look(c.x, c.y, c.z);
    return this.wait(sec);
  }

  closeDoor(id, fast = true) {
    const d = this.g.level.door(id);
    if (d.target < 0.5) return;
    const p = this.p;
    const side = d.axis === 'x' ? Math.sign(p.x - d.bnd) || 1 : Math.sign(p.z - d.bnd) || 1;
    const tx = d.axis === 'x' ? d.bnd + side * 1.0 : d.c, tz = d.axis === 'x' ? d.c : d.bnd + side * 1.0;
    if (Math.hypot(tx - p.x, tz - p.z) > 0.4) this.walkTo(tx, tz, { tol: 0.3 });
    this.look(d.x, 1.1, d.z); this.tick(2);
    this.g.beginInteract(this.pid, `door:${id}`, { fast });
    this.g.endInteract(this.pid);
    this.wait(fast ? 0.8 : 1.8);
  }

  count(type) { return this.events.filter((e) => e.e === type).length; }
  has(type, pred = () => true) { return this.events.some((e) => e.e === type && pred(e)); }
}
