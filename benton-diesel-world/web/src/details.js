// Street details: the small, ordinary things a real park is full of. Along
// every walkway, wherever there's room: litter bins with recycling bins
// beside them, park benches, fire hydrants, flower planters and drinking
// fountains at the path's edge, and manhole covers and drain grates set
// into the paving. Outside the park, along the Benton Parkway: wooden
// utility poles strung with sagging power lines, and big roadside
// billboards facing the traffic.
import { helpers } from './wolverine.js';
import { makeFinder } from './haunt.js';
import { LINES } from './guests.js';
import { PARKWAY } from './resort.js';

export function buildStreetDetails(data) {
  const { add, sign } = helpers(data);
  const find = makeFinder(data);
  const placed = [];
  const lines = LINES.map(([a, b]) => [a.x, a.z, b.x, b.z]);
  const distToLines = (x, z) => {
    let best = Infinity;
    for (const [ax, az, bx, bz] of lines) {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - ax - dx * u, z - az - dz * u));
    }
    return best;
  };
  const roomFor = (x, z, r) => find.clear(x, z, r) && distToLines(x, z) > 3.4 && !placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6);

  const IRON = 0x1e2420, GREEN = 0x234a32, WOOD = 0x7a5232;
  const bin = (x, y, z, yaw, color, lid) => {
    add([1.5, 2.3, 1.5], [x, y + 1.15, z], color, 'Metal', { shape: 5, yaw });
    add([1.62, 0.3, 1.62], [x, y + 2.4, z], lid, 'Metal', { shape: 5, collide: 0 });
    add([1.66, 0.12, 1.66], [x, y + 0.5, z], lid, 'Metal', { shape: 5, collide: 0 });
  };
  const items = [
    // a litter bin and a recycling bin
    (x, y, z, yaw) => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      bin(x - c * 1, y, z + s * 1, yaw, GREEN, IRON);
      bin(x + c * 1, y, z - s * 1, yaw, 0x2a5aa8, 0x1a3a7a);
    },
    // a park bench: wooden slats on cast-iron ends
    (x, y, z, yaw) => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const k of [-0.45, 0, 0.45]) add([5, 0.14, 0.38], [x - s * k, y + 1.45, z - c * k], WOOD, 'Wood', { yaw, collide: 0 });
      for (const k of [0, 0.36]) add([5, 0.38, 0.12], [x - s * (0.68 + k * 0.1), y + 2.0 + k, z - c * (0.68 + k * 0.1)], WOOD, 'Wood', { yaw, collide: 0 });
      for (const e of [-2.2, 2.2]) add([0.2, 1.5, 1.5], [x + c * e, y + 0.75, z - s * e], IRON, 'Metal', { yaw });
    },
    // a fire hydrant
    (x, y, z) => {
      add([0.8, 1.6, 0.8], [x, y + 0.8, z], 0xc8281e, 'Metal', { shape: 5 });
      add([0.75, 0.75, 0.75], [x, y + 1.6, z], 0xc8281e, 'Metal', { shape: 3, collide: 0 });
      add([1.3, 0.38, 0.38], [x, y + 1.05, z], 0xc8281e, 'Metal', { shape: 2, collide: 0 });
      add([0.36, 0.25, 0.36], [x, y + 2.0, z], 0xe8c840, 'Metal', { shape: 5, collide: 0 });
      add([1.1, 0.2, 1.1], [x, y + 0.1, z], 0xc8281e, 'Metal', { shape: 5, collide: 0 });
    },
    // a flower planter
    (x, y, z, yaw) => {
      add([3.4, 1.6, 3.4], [x, y + 0.8, z], 0x9a948a, 'Concrete', { yaw });
      add([3.0, 0.2, 3.0], [x, y + 1.55, z], 0x3a2a1c, 'Slate', { yaw, collide: 0 });
      add([2.2, 1.8, 2.2], [x, y + 2.4, z], 0x2e5a26, 'Grass', { shape: 3, collide: 0 });
      const cols = [0xe8304a, 0xf2c818, 0xffffff, 0xb05aff, 0xff7a30];
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785 + yaw;
        add([0.4, 0.4, 0.4], [x + Math.cos(a) * 1.25, y + 1.95 + (k % 2) * 0.25, z + Math.sin(a) * 1.25], cols[k % cols.length], 'SmoothPlastic', { shape: 3, collide: 0 });
      }
    },
    // a drinking fountain
    (x, y, z, yaw) => {
      add([1.1, 2.6, 1.1], [x, y + 1.3, z], 0x8a8e94, 'Concrete', { yaw });
      add([1.6, 0.3, 1.4], [x, y + 2.75, z], 0xb8bcc4, 'Metal', { yaw, collide: 0 });
      add([0.15, 0.3, 0.15], [x, y + 3.0, z], 0xd8dce2, 'Metal', { collide: 0 });
    },
    // another bench
    null,
  ];
  items[5] = items[1];
  let placedCount = 0, k = 0;
  for (const [ax, az, bx, bz] of lines) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 12) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const yaw = Math.atan2(ux, uz);
    for (let s = 8; s < len - 6; s += 15) {
      const side = (k % 2 ? 1 : -1);
      for (const off of [5.5, 7, 8.5]) {
        const x = ax + ux * s - uz * off * side, z = az + uz * s + ux * off * side;
        if (!roomFor(x, z, 2.2)) continue;
        const y = find.groundAt(x, z);
        if (y < 0.15 || y > 1.3) continue; // on paving only
        // ... and at its edge: just beyond, the paving ends (grass, a wall)
        const ox = x - uz * 3.2 * side, oz = z + ux * 3.2 * side;
        const g2 = find.groundAt(ox, oz);
        if (!(g2 < 0.15 || g2 > y + 0.3 || !find.clear(ox, oz, 0.6))) continue;
        // benches face the path
        items[k % items.length](x, y, z, yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
        placed.push([x, z]);
        placedCount++;
        break;
      }
      k++;
    }
    // manhole covers and drain grates, set into the path itself
    for (let s = 20; s < len - 10; s += 70) {
      const x = ax + ux * s, z = az + uz * s;
      const y = find.groundAt(x, z);
      if (y < 0.15 || y > 1.3 || !find.clear(x, z, 1.5)) continue;
      add([2.4, 0.06, 2.4], [x, y + 0.03, z], 0x2a2826, 'DiamondPlate', { shape: 5, collide: 0 });
      add([1.6, 0.05, 0.9], [x - uz * 3.6, y + 0.03, z + ux * 3.6], 0x1a1a1a, 'Metal', { yaw, collide: 0 });
    }
  }
  // ---- utility poles and power lines along the parkway's south shoulder
  const PZ = PARKWAY.z + PARKWAY.half + 6;
  let run = null;
  const wire = (a, b, sag) => {
    const SEG = 6;
    for (let k = 0; k < SEG; k++) {
      const t0 = k / SEG, t1 = (k + 1) / SEG;
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - sag * 4 * t0 * (1 - t0), a[2] + (b[2] - a[2]) * t0];
      const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - sag * 4 * t1 * (1 - t1), a[2] + (b[2] - a[2]) * t1];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], len = Math.hypot(dx, dy, dz);
      const pitch = Math.asin(dy / len), yaw = Math.atan2(dx, dz);
      const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // yaw then pitch: the wire's local z runs from p0 to p1
      add([0.07, 0.07, len + 0.05], [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], 0x1a1a1a, 'Rubber',
        { collide: 0, rot: [c, -s * sp, s * cp, 0, cp, sp, -s, -c * sp, c * cp] });
    }
  };
  let poles = 0;
  for (let x = PARKWAY.x0 + 16; x <= PARKWAY.x1 - 16; x += 46) {
    if (!find.clear(x, PZ, 1.2)) { run = null; continue; }
    add([0.7, 22, 0.7], [x, 11, PZ], 0x5a4632, 'Wood', { shape: 5 });
    add([6, 0.4, 0.4], [x, 20.6, PZ], 0x4a3a28, 'Wood', { collide: 0 });
    for (const dx of [-2.6, 0, 2.6]) add([0.22, 0.5, 0.22], [x + dx, 21.05, PZ], 0x6a8a6a, 'Glass', { collide: 0 });
    if (poles % 3 === 1) add([1.2, 1.8, 1.2], [x, 17.8, PZ + 0.8], 0x6a6e74, 'Metal', { shape: 5, collide: 0 }); // a transformer
    const tops = [-2.6, 0, 2.6].map((dx) => [x + dx, 21.3, PZ]);
    if (run && x - run[0][0] < 60) tops.forEach((t, k) => wire(run[k], t, 1.4));
    run = tops;
    poles++;
  }
  // ---- billboards facing the parkway traffic
  for (const [x, top, sub] of [[-330, 'BENTON DIESEL WORLD', 'OPEN DAILY  ·  9AM - 10PM  ·  NEXT LEFT'], [330, 'THE BENTON GRAND', 'STAY  ·  PLAY  ·  FREE PARK SHUTTLE']]) {
    const z = PARKWAY.z + PARKWAY.half + 22;
    if (![-10, 0, 10].every((dx) => find.clear(x + dx, z, 2))) continue;
    for (const dx of [-7, 7]) add([1, 14, 1], [x + dx, 7, z], 0x5a5e66, 'Metal');
    add([26, 0.4, 2], [x, 14.2, z - 0.8], 0x5a5e66, 'Metal', { collide: 0 });
    add([25, 9, 0.6], [x, 19, z], 0x2a2a2a, 'Metal', { collide: 0 });
    sign([24, 8, 0.2], [x, 19, z - 0.4], 0x1a2a4a, 'Front', [[top, 0, 0.1, 1, 0.5, 0xf0c440], [sub, 0, 0.64, 1, 0.26, 0xffffff, 'GothamBold']], { glow: false });
    for (const dx of [-8, 0, 8]) add([0.6, 0.6, 1.6], [x + dx, 14.6, z - 1.6], 0x2a2a2a, 'Metal', { collide: 0 });
  }
  return placedCount + poles;
}
