// Line upgrades. Every ride and house now has three ways in:
//  - the standby line, which on a busy day spills into an EXTENDED QUEUE:
//    an extra rope-and-stanchion switchback beyond the entrance, built
//    here wherever there is room, and chained onto the end of the line;
//  - the Express line, a short line of its own that runs beside the
//    standby line and merges at the front (one Express party boards with
//    every train);
//  - Front of the Line, straight to the boarding gate for the very next
//    train. Two new tickets: Benton Haunt Front of the Line (the houses)
//    and Ride Front of the Line (every ride). Both are unlimited all day.
import { helpers } from './wolverine.js';
import { makeFinder } from './haunt.js';

import { FOTL } from './queue.js';

// the two Front of the Line tickets, sold beside the Express Pass
export function buildLineTickets(data) {
  const items = data.config.Items;
  const ep = items.find((i) => i.id === 'ExpressPass');
  if (ep) ep.description = 'Use the short Express line at any ride or haunted house.';
  const model = data.items.find((i) => i.id === 'ExpressPass');
  const tickets = [
    { id: FOTL.ride, scope: 'ride', name: 'Ride Front of the Line', price: 350, color: 0xf2c818,
      description: 'Walk straight to the boarding gate on any ride and take the next train. Faster than Express. Unlimited, all day.' },
    { id: FOTL.haunt, scope: 'haunt', name: 'Benton Haunt Front of the Line', price: 250, color: 0xe02020,
      description: 'Walk straight into any Benton Haunt house with the next group. Faster than Express. Unlimited, all day.' },
  ];
  for (const t of tickets) {
    items.push({ id: t.id, kind: 'fotl', scope: t.scope, shape: 'pass', name: t.name, price: t.price, description: t.description, colors: [t.color] });
    const recolor = (parts) => (parts || []).map((p) => { const q = p.slice(); q[16] = t.color; return q; });
    data.items.push({ id: t.id, preview: recolor(model?.preview), wear: recolor(model?.wear || model?.preview) });
  }
  for (const v of data.config.Venues) if (v.items.includes('ExpressPass')) v.items.splice(v.items.indexOf('ExpressPass') + 1, 0, FOTL.ride, FOTL.haunt);
}

// Extended queues: for each ride, a switchback of stanchions and ropes on
// a patch of paving beyond the end of its line, wherever it fits.
export function buildExtendedQueues(data) {
  const { add, box, sign } = helpers(data);
  const ROPE = 0x1e2a5a, POST = 0x1a1a1c, CHROME = 0xc8ccd4, PAVE = 0x5a5c62;
  const S = 4.5; // row spacing
  // the full size first, then a smaller one for tighter spots
  const SIZES = [{ HALF: 10, ROWS: 4 }, { HALF: 7, ROWS: 3 }];
  const built = [];
  for (const r of data.rides) {
    const q = r.queue;
    if (!q || r.kind === 'walkthrough') continue;
    const cfg = data.config.Rides.find((c) => c.id === r.id);
    if (!cfg || cfg.refurb) continue;
    const n = q.points.length / 2;
    const E = [q.points[(n - 1) * 2], q.points[(n - 1) * 2 + 1]], P = [q.points[(n - 2) * 2], q.points[(n - 2) * 2 + 1]];
    const ul = Math.hypot(E[0] - P[0], E[1] - P[1]) || 1;
    const out = [(E[0] - P[0]) / ul, (E[1] - P[1]) / ul];
    // a finder that ignores this ride's own line, the stations' wide
    // clearances and the trees (any in the way come down)
    const find = makeFinder({ ...data, trees: [], rides: data.rides.filter((o) => o !== r).map((o) => ({ ...o, origin: [1e6, 0, 1e6] })) });
    let u = out, v = [-out[1], out[0]], HALF = 10, ROWS = 4, A0 = 9, sh;
    const at = (a, b, k = sh) => [E[0] + u[0] * a + v[0] * (b + k), E[1] + u[1] * a + v[1] * (b + k)];
    const fits = (k) => {
      for (let a = A0 - S / 2 - 1; a <= A0 + (ROWS - 0.5) * S + 1; a += 2.5) {
        for (let b = -HALF - 3; b <= HALF + 3; b += 2.5) {
          const [x, z] = at(a, b, k);
          if (!find.clear(x, z, 0.8)) return false;
          if (built.some((o) => Math.hypot(o[0] - x, o[1] - z) < 18)) return false;
        }
      }
      return true;
    };
    // straight on out, else off to either side; full size, else smaller
    search: for (const size of SIZES) {
      for (const a0 of [9, 14, 20]) {
        for (const dir of [out, [-out[1], out[0]], [out[1], -out[0]]]) {
          u = dir; v = [-dir[1], dir[0]]; HALF = size.HALF; ROWS = size.ROWS; A0 = a0;
          sh = [0, 8, -8, 14, -14, 20, -20, 26, -26].find(fits);
          if (sh !== undefined) break search;
        }
      }
    }
    if (sh === undefined) continue;
    const lo = A0 - S / 2, hi = A0 + (ROWS - 0.5) * S, W = HALF + 2.25;
    // clear any trees off the new paving
    data.trees = (data.trees || []).filter((t) => {
      const dx = t.pos[0] - E[0], dz = t.pos[2] - E[1];
      const a = dx * u[0] + dz * u[1], b = dx * v[0] + dz * v[1] - sh;
      return !(a > lo - 3 && a < hi + 3 && Math.abs(b) < HALF + 5);
    });
    const floor = q.floor ?? 0.55;
    const yaw = Math.atan2(u[0], u[1]);
    // the paving, and a strip joining it to the end of the old line
    const [cx, cz] = at((lo + hi) / 2, 0);
    box([2 * W + 2.5, 0.4, hi - lo + 2], [cx, floor - 0.4, cz], PAVE, 'Pavement', { yaw });
    const [jx, jz] = at(lo / 2, 0, sh / 2);
    add([3.4, 0.4, Math.hypot(lo, sh) + 2], [jx, floor - 0.2, jz], PAVE, 'Pavement', { yaw: Math.atan2(u[0] * lo + v[0] * sh, u[1] * lo + v[1] * sh), collide: 0 });
    // ropes on stanchions (low, and you can step over them)
    const rope = (a0, b0, a1, b1) => {
      const [x0, z0] = at(a0, b0), [x1, z1] = at(a1, b1);
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.5) return;
      add([0.07, 0.07, len], [(x0 + x1) / 2, floor + 0.95, (z0 + z1) / 2], ROPE, 'Fabric', { yaw: Math.atan2(x1 - x0, z1 - z0), collide: 0 });
      const k = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= k; i++) {
        const x = x0 + ((x1 - x0) * i) / k, z = z0 + ((z1 - z0) * i) / k;
        add([0.2, 1.05, 0.2], [x, floor + 0.52, z], POST, 'Metal', { shape: 5, collide: 0 });
        add([0.26, 0.26, 0.26], [x, floor + 1.1, z], CHROME, 'Metal', { shape: 3, collide: 0 });
      }
    };
    // the rows snake away from the old line: row k ends on the +HALF side
    // when k is even, the -HALF side when odd
    const endSide = (k) => (k % 2 ? -HALF : HALF);
    const exitSide = endSide(ROWS - 1);
    rope(lo, -W, lo, -2); rope(lo, 2, lo, W); // the front, open where the line comes in
    rope(lo, W, hi, W); rope(lo, -W, hi, -W); // the sides
    if (exitSide < 0) rope(hi, -W + 3.5, hi, W); else rope(hi, -W, hi, W - 3.5); // the back, open at the way in
    for (let k = 0; k < ROWS - 1; k++) {
      const a = A0 + (k + 0.5) * S;
      if (endSide(k) > 0) rope(a, -W, a, HALF - 2.5); else rope(a, -HALF + 2.5, a, W);
    }
    // the sign at the way in
    const [sx, sz] = at(hi + 2.5, exitSide < 0 ? -W : W);
    box([0.3, 6, 0.3], [sx, floor, sz], POST, 'Metal');
    sign([7, 2.4, 0.2], [sx, floor + 6.6, sz], 0x16223a, 'Back', [['EXTENDED QUEUE', 0, 0.02, 1, 0.58, 0xffd040], [cfg.name.toUpperCase(), 0, 0.6, 1, 0.38, 0xffffff, 'GothamBold']], { glow: true, yaw });
    sign([7, 2.4, 0.2], [sx, floor + 6.6, sz], 0x16223a, 'Front', [['EXTENDED QUEUE', 0, 0.02, 1, 0.58, 0xffd040], ['OPENS WHEN BUSY', 0, 0.6, 1, 0.38, 0xffffff, 'GothamBold']], { glow: true, yaw });
    // and the line goes on through it
    const pts = [[A0, 0], [A0, HALF]];
    for (let k = 1; k < ROWS; k++) pts.push([A0 + k * S, endSide(k - 1)], [A0 + k * S, endSide(k)]);
    pts.push([hi + 2, exitSide]);
    let last = E, cum = q.cum[q.cum.length - 1];
    for (const [a, b] of pts) {
      const p = at(a, b);
      cum += Math.hypot(p[0] - last[0], p[1] - last[1]);
      q.points.push(p[0], p[1]);
      q.cum.push(cum);
      last = p;
    }
    q.length = cum;
    q.extendedAt = q.cum[n - 1];
    built.push(at((lo + hi) / 2, 0));
  }
  return built.length;
}
