// A small refurbishment on the Studio Backlot Tram Tour: the ride is closed
// for a few days while the trams and the station get a fresh coat of
// paint. A painted wall closes off the queue entrance, barriers close the
// tram road either side of the station, one tram is half under a tarp,
// and a crew in hard hats paints the trams and the station sign from a
// scaffold. The posted wait reads "closed for refurbishment".
export const REFURB_ID = 'BacklotTram';

export function buildRefurb(data) {
  const cfg = data.config.Rides.find((r) => r.id === REFURB_ID);
  const ride = data.rides.find((r) => r.id === REFURB_ID);
  if (!cfg || !ride) return;
  cfg.refurb = true;

  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const rec = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], c, 0, s, 0, 1, 0, -s, 0, c, color, mi(mat), 0, collide];
  };
  const add = (...a) => { data.static.push(rec(...a)); return data.static.length - 1; };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, face, yaw = 0, font = 'GothamBlack') => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({ part: i, face, glow: false, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const GROUND = 0.6; // top of the plaza paving
  const PLATFORM = 1.6;

  // a painted wall across the way into the queue, with the art facing out
  const q = ride.queue;
  const [ex, ez] = [q.points[q.points.length - 4], q.points[q.points.length - 3]]; // the entrance sign
  const [ox, oz] = q.outward;
  const cx = ex + ox * 7, cz = ez + oz * 7;
  const yaw = Math.atan2(ox, oz); // the wall runs across the outward direction
  const along = [Math.cos(yaw), -Math.sin(yaw)];
  const LEN = 26, H = 8;
  add([LEN, H, 0.4], [cx, H / 2, cz], 0x2c6a86, 'WoodPlanks', { yaw });
  add([LEN, 0.5, 0.6], [cx, H + 0.25, cz], 0xf0c440, 'SmoothPlastic', { yaw, collide: 0 });
  for (let k = 0; k <= 3; k++) {
    const t = k / 3 - 0.5;
    box([0.6, H + 0.6, 0.6], [cx + along[0] * LEN * t, 0, cz + along[1] * LEN * t], 0x5a5e66, 'Metal', { yaw });
  }
  // the wall's front faces +Z in its own frame; with this yaw that is outward
  const fx = cx + ox * 0.35, fz = cz + oz * 0.35;
  sign('STUDIO BACKLOT TRAM TOUR', [LEN - 2, 1.8, 0.2], [fx, 6.6, fz], 0x966ec8, 0xffffff, 'Back', yaw);
  sign('CLOSED FOR A SMALL REFURBISHMENT', [LEN - 2, 1.6, 0.2], [fx, 4.6, fz], 0x16223a, 0xf0c440, 'Back', yaw);
  sign('Fresh paint, new effects - back very soon!', [LEN - 6, 1.2, 0.2], [fx, 2.9, fz], 0x16223a, 0xfaf3e0, 'Back', yaw, 'GothamBold');

  // the boarding gate is chained
  const [gx, gz] = q.gate;
  for (let k = 0; k < 3; k++) add([1.4, 0.2, 0.2], [gx - 1.4 + k * 1.4, 2.4 - (k % 2) * 0.25, gz - 1], k % 2 ? 0xffffff : 0xc8322d, 'SmoothPlastic', { collide: 0 });
  sign('CLOSED', [3, 1, 0.2], [gx, 3.4, gz - 1], 0xc8322d, 0xffffff, 'Back', 0, 'GothamBold');

  // barriers across the tram road either side of the station
  const roadZ = ride.cars[0].pivot[2];
  const xs = ride.cars.map((c) => c.pivot[0]);
  const west = Math.min(...xs) - 11, east = Math.max(...xs) + 11;
  for (const x of [west, east]) {
    for (let k = 0; k < 3; k++) {
      const z = roadZ - 3.4 + k * 3.4;
      for (const dx of [-0.5, 0.5]) box([0.2, 1.6, 0.2], [x + dx, 0, z - 1.2], 0xd8d8d4, 'Metal');
      for (const dx of [-0.5, 0.5]) box([0.2, 1.6, 0.2], [x + dx, 0, z + 1.2], 0xd8d8d4, 'Metal');
      add([0.3, 0.6, 3], [x, 1.5, z], k % 2 ? 0xffffff : 0xff6a10, 'SmoothPlastic', { collide: 0 });
      add([0.3, 0.5, 3], [x, 0.8, z], k % 2 ? 0xff6a10 : 0xffffff, 'SmoothPlastic', { collide: 0 });
    }
    sign('ROAD CLOSED', [0.2, 1, 5], [x, 2.4, roadZ], 0xff6a10, 0xffffff, x < 0 ? 'Left' : 'Right', 0, 'GothamBold');
  }

  // the last tram half under a blue tarp, paint cans and a wet paint sign
  const last = ride.cars[ride.cars.length - 1].pivot;
  add([6, 5.2, 7.2], [last[0] + 3, last[1] + 2.4, last[2]], 0x2f6fbf, 'Fabric', { collide: 0 });
  add([6.2, 0.3, 7.4], [last[0] + 3, last[1] + 5.1, last[2]], 0x2a62b0, 'Fabric', { collide: 0 });
  const platZ = ride.crew.stops[0][2];
  for (let k = 0; k < 5; k++) add([0.8, 0.9, 0.8], [xs[0] + 3 + k * 1.1, PLATFORM + 0.45, platZ + 0.6], [0x966ec8, 0xffffff, 0x966ec8, 0xf0c440, 0xfaf3e0][k], 'Metal', { shape: 5, collide: 0 });
  box([0.2, 2.2, 0.2], [xs[1] + 5, PLATFORM, platZ + 0.8], 0x5a5e66, 'Metal', { collide: 0 });
  sign('WET PAINT', [2.6, 1, 0.2], [xs[1] + 5, PLATFORM + 2.6, platZ + 0.8], 0xffffff, 0xc8322d, 'Back', 0, 'GothamBold');

  // a scaffold at the west end of the station canopy, for the sign painters
  const sx = xs[0] - 6, sz = platZ + 5.6;
  for (const [dx, dz] of [[-2, -0.8], [2, -0.8], [-2, 0.8], [2, 0.8]]) box([0.25, 11, 0.25], [sx + dx, GROUND, sz + dz], 0xb8b8b4, 'Metal');
  for (const y of [5, 10]) {
    box([4.6, 0.25, 2], [sx, GROUND + y, sz], 0x8a6a44, 'WoodPlanks');
    add([4.4, 0.15, 0.15], [sx, GROUND + y + 1.2, sz + 0.9], 0xb8b8b4, 'Metal', { collide: 0 });
  }

  // the crew, in hard hats
  const spots = [
    ['work', xs[0], PLATFORM, platZ - 0.6, 0],
    ['work', xs[1] + 2, PLATFORM, platZ - 0.6, 0],
    ['work', last[0] - 2, PLATFORM, ride.crew.exit[2] + 0.6, Math.PI],
    ['work', sx, GROUND + 10.25, sz - 0.4, 0],
    ['idle', cx + ox * 2.5 + along[0] * 9, GROUND, cz + oz * 2.5 + along[1] * 9, Math.atan2(-ox, -oz)],
  ];
  for (const [kind, x, y, z, yw] of spots) data.staffSpots.push({ role: 'construction', kind, land: cfg.land, seed: 0, cf: cf(x, y, z, yw) });
  Object.assign(data.staff.lines, {
    construction: ['Sorry folks, the tram is getting a fresh coat of paint!', "We'll be back open very soon!", 'New paint, new effects - you will love it!', 'Mind the wet paint!'],
  });
}
