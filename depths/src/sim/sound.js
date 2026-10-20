/**
 * Sound propagation over the room graph. A sound of radius r reaches a point
 * if a path through door portals (and explicitly linked ducts) is shorter
 * than r. Walls otherwise block hearing. A closed solid door halves the
 * remaining range through its portal; a closed pressure door isolates.
 */
export class SoundGraph {
  constructor(level) {
    this.level = level;
    this.portals = [];
    for (const d of level.doors) {
      if (!d.b) continue;
      this.portals.push({ kind: 'door', door: d, a: level.room(d.a).index, b: level.room(d.b).index, x: d.x, z: d.z });
    }
    for (const duct of level.def.ducts || []) {
      const ra = level.room(duct.a), rb = level.room(duct.b);
      if (!ra || !rb) continue;
      this.portals.push({ kind: 'duct', a: ra.index, b: rb.index, x: duct.ax, z: duct.az, x2: duct.bx, z2: duct.bz, len: Math.hypot(duct.bx - duct.ax, duct.bz - duct.az) });
    }
    this.byRoom = level.rooms.map(() => []);
    this.portals.forEach((p, i) => { this.byRoom[p.a].push(i); this.byRoom[p.b].push(i); });
  }

  /**
   * Remaining range (metres) of a sound with radius r from (sx,sz) at (tx,tz);
   * <= 0 means inaudible. Also returns the apparent source position (the last
   * portal the sound came through), which is what a listener would locate.
   */
  reach(sx, sz, r, tx, tz) {
    const L = this.level;
    const rs = L.roomAt(sx, sz), rt = L.roomAt(tx, tz);
    if (!rs || !rt) return { remain: -1, x: sx, z: sz };
    if (rs === rt) return { remain: r - Math.hypot(tx - sx, tz - sz), x: sx, z: sz };
    // best remaining range at each portal side
    const best = new Map();
    const queue = [];
    const push = (pi, side, remain, px, pz) => {
      const k = pi * 2 + side;
      if (remain <= 0 || (best.has(k) && best.get(k).remain >= remain)) return;
      best.set(k, { remain, x: px, z: pz });
      queue.push([pi, side, remain, px, pz]);
    };
    const enterFrom = (roomIx, x, z, remain) => {
      for (const pi of this.byRoom[roomIx]) {
        const p = this.portals[pi];
        const near = p.kind === 'duct' && p.b === roomIx ? [p.x2, p.z2] : [p.x, p.z];
        const rem = remain - Math.hypot(near[0] - x, near[1] - z);
        if (rem <= 0) continue;
        // crossing
        let after = rem;
        let ox = near[0], oz = near[1];
        if (p.kind === 'door') {
          const d = p.door;
          if (d.open < 0.5) {
            if (d.T.isolates) continue;
            if (d.type === 'shutter' || d.type === 'gate') after = rem * 0.8; else after = rem * 0.5;
          }
        } else {
          after = rem - p.len;
          if (p.b === roomIx) { ox = p.x; oz = p.z; } else { ox = p.x2; oz = p.z2; }
        }
        const other = p.a === roomIx ? p.b : p.a;
        push(pi, other === p.a ? 0 : 1, after, ox, oz);
      }
    };
    enterFrom(rs.index, sx, sz, r);
    let out = { remain: -1, x: sx, z: sz };
    let guard = 0;
    while (queue.length && guard++ < 400) {
      queue.sort((a, b) => b[2] - a[2]);
      const [pi, side, remain, px, pz] = queue.shift();
      const p = this.portals[pi];
      const roomIx = side === 0 ? p.a : p.b;
      if (roomIx === rt.index) {
        const rem = remain - Math.hypot(tx - px, tz - pz);
        if (rem > out.remain) out = { remain: rem, x: px, z: pz };
      }
      enterFrom(roomIx, px, pz, remain);
    }
    return out;
  }
}
