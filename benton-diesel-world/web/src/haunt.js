// Benton Haunt, part two: the small backstage behind Benton Family Landing,
// where the sixth house (Lights Out at Lakeside) is open in a big white
// clear-span tent with a rope-and-stanchion queue in front; the six scare
// zones around the park, finished and open, each with its lit sign, fog
// machines, colored lights, props and scare actors; and Graveyard Grub,
// the event's food stand on the backstage avenue with a Halloween menu.

export const FB = { x0: 375, x1: 500, z0: 128, z1: 236 };
const GATE = { z0: 161.4, z1: 197.1 }; // between the east wall pillars at z 159.1 and 199.4
const G = 0.1;
// the sixth house's rope queue in front of its tent
export const FAMILY_QUEUE = { x0: 384, x1: 414, z0: 196, z1: 232, step: 6, rows: 6 };
const BLACK = 0x101012, ORANGE = 0xff7a1a, PUMPKIN = 0xd85400, WHITE = 0xf4f4f0, CANVAS = 0xf2f2ee;

function helpers(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), 0, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, face, font = 'GothamBlack', glow = false, yaw = 0) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({ part: i, face, glow, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const spot = (role, kind, land, x, y, z, yaw) => data.staffSpots.push({ role, kind, land, seed: 0, cf: cf(x, y, z, yaw) });
  return { add, box, sign, cf, spot };
}

// ---------------------------------------------------- Family Landing backstage
export function buildFamilyBackstage(data) {
  const { add, box, sign, spot } = helpers(data);
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const STONE = 0x96928c, CAP = 0xc4beb4;
  // open the east wall between two pillars, clear the way to it and the lot
  data.hidden = data.hidden || [];
  const way = { x0: 350, x1: 374, z0: GATE.z0 - 2, z1: GATE.z1 + 2 };
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 375) < 0.5 && p[3] > 600; // the east wall and its cap
    const scenery = (p[4] > 377 && inRect(p[4], p[6], FB, 4)) || inRect(p[4], p[6], way);
    if (wall || scenery) { p[19] = 0; data.hidden.push(i); }
  });
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], FB, 8) && !inRect(t.pos[0], t.pos[2], way, 4));
  const parkWall = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], STONE, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw });
  };
  parkWall(375, -405, 375, GATE.z0);
  parkWall(375, GATE.z1, 375, 280);
  parkWall(375, FB.z0, FB.x1, FB.z0);
  parkWall(FB.x1, FB.z0, FB.x1, FB.z1);
  parkWall(FB.x1, FB.z1, 375, FB.z1);
  data.flatZones = [...(data.flatZones || []), { ...FB, margin: 26 }];
  add([FB.x1 - FB.x0, 1, FB.z1 - FB.z0], [(FB.x0 + FB.x1) / 2, G - 0.5, (FB.z0 + FB.z1) / 2], 0x2e2f34, 'Asphalt');

  // the gate arch, facing the park
  const gz = (GATE.z0 + GATE.z1) / 2, gw = GATE.z1 - GATE.z0;
  for (const z of [GATE.z0 + 1.5, GATE.z1 - 1.5]) {
    box([2.6, 16, 2.6], [379, G, z], BLACK, 'Metal');
    for (let k = 0; k < 3; k++) add([1.6, 1.4, 1.6], [376.9, G + 0.7, z + (k - 1) * 1.8], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
  }
  add([2, 3, gw], [379, G + 17.5, gz], BLACK, 'Metal', { collide: 0 });
  sign('BENTON HAUNT  ·  BACKSTAGE', [0.2, 2.2, gw - 3], [377.9, G + 17.6, gz], BLACK, ORANGE, 'Left', 'GothamBlack', true);
  sign('HOUSE 6: LIGHTS OUT AT LAKESIDE  ·  NOW OPEN', [0.2, 1, gw - 6], [377.9, G + 15.3, gz], BLACK, WHITE, 'Left', 'GothamBold');

  // the clear-span tent for the sixth house: straight walls under a
  // rounded white roof, ribbed every few studs (hollow, with a way in at
  // the west end and out at the east)
  const tent = (x0, x1, zc, W, wallH, doors = null) => {
    const L = x1 - x0, xc = (x0 + x1) / 2;
    if (!doors) box([L, wallH, W], [xc, G, zc], CANVAS, 'Fabric');
    else {
      const T = 0.6;
      box([L, wallH, T], [xc, G, zc - W / 2 + T / 2], CANVAS, 'Fabric');
      box([L, wallH, T], [xc, G, zc + W / 2 - T / 2], CANVAS, 'Fabric');
      for (const [x, dz] of [[x0, doors.in], [x1, doors.out]]) {
        const z0 = zc - W / 2, z1 = zc + W / 2, d = zc + dz;
        box([T, wallH, d - 3.5 - z0], [x, G, (z0 + d - 3.5) / 2], CANVAS, 'Fabric');
        box([T, wallH, z1 - d - 3.5], [x, G, (z1 + d + 3.5) / 2], CANVAS, 'Fabric');
      }
      add([L, 0.4, W], [xc, G + wallH + 4, zc], 0x101012, 'SmoothPlastic', { collide: 0 }); // blackout ceiling inside
    }
    if (!doors) {
      add([L, W, W], [xc, G + wallH, zc], CANVAS, 'Fabric', { shape: 2, collide: 0 });
      for (let x = x0; x <= x1 + 0.01; x += L / Math.round(L / 6)) add([0.3, W + 0.3, W + 0.3], [x, G + wallH, zc], 0xd2d2ce, 'Metal', { shape: 2, collide: 0 });
      return;
    }
    // a walk-in tent: the rounded roof is built from curved panels, so the
    // inside stays open, with ribs over it every few studs
    const R = W / 2, N = 12, chord = 2 * R * Math.sin(Math.PI / (2 * N)) + 0.15;
    for (let k = 0; k < N; k++) {
      const th = (Math.PI * (k + 0.5)) / N, phi = Math.PI / 2 - th;
      const rot = [1, 0, 0, 0, Math.cos(phi), -Math.sin(phi), 0, Math.sin(phi), Math.cos(phi)];
      const y = G + wallH + R * Math.sin(th) * Math.cos(Math.PI / (2 * N)), z = zc + R * Math.cos(th) * Math.cos(Math.PI / (2 * N));
      add([L, 0.3, chord], [xc, y, z], CANVAS, 'Fabric', { collide: 0, rot });
      for (let x = x0; x <= x1 + 0.01; x += L / Math.round(L / 6)) add([0.35, 0.45, chord], [x, y + 0.2 * Math.sin(th), z + 0.2 * Math.cos(th)], 0xd2d2ce, 'Metal', { collide: 0, rot });
    }
    // and the round ends, closed with canvas above the walls
    for (const x of [x0, x1]) {
      for (let k = 0; k < 6; k++) {
        const y0 = G + wallH + (R * k) / 6, half = Math.sqrt(Math.max(0, R * R - ((R * (k + 0.5)) / 6) ** 2));
        add([0.4, R / 6 + 0.05, half * 2], [x, y0 + R / 12, zc], CANVAS, 'Fabric', { collide: 0 });
      }
    }
  };
  const HX0 = 420, HX1 = 482, HZ = 212, HW = 28;
  tent(HX0, HX1, HZ, HW, 7, { in: 2, out: -6 });
  // the finished facade at the tent's west end: a lakeside lodge with its
  // sign lit, lanterns either side and fog rolling out of the door
  const fx = HX0 - 0.8;
  for (const [za, zb] of [[HZ - 12, HZ - 1.5], [HZ + 5.5, HZ + 12]]) box([1.2, 15, zb - za], [fx, G, (za + zb) / 2], 0x2a1c14, 'WoodPlanks');
  box([1.2, 5.6, 7], [fx, G + 9.4, HZ + 2], 0x2a1c14, 'WoodPlanks');
  for (const sz of [-1, 1]) box([4, 10, 0.6], [fx + 2, G, HZ + 2 + sz * 3.8], 0x101012, 'SmoothPlastic');
  for (let k = 0; k < 7; k++) {
    add([1.2, 1.2, 10.5], [fx - 0.8, G + 0.6 + k * 1.25, HZ - 6.75], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
    add([1.2, 1.2, 6.5], [fx - 0.8, G + 0.6 + k * 1.25, HZ + 8.75], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  }
  add([26, 3, 8], [fx - 2.2, G + 16.4, HZ], 0x3a2418, 'Wood', { shape: 1, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  sign('LIGHTS OUT AT LAKESIDE', [0.3, 2.4, 20], [fx - 0.9, G + 12.6, HZ], BLACK, 0xffb040, 'Left', 'GothamBlack', true);
  for (const dz of [-9, 9]) add([1.2, 2.4, 0.8], [fx - 0.8, G + 7, HZ + 2 + dz * 0.8], 0xffb040, 'Neon', { collide: 0 });
  for (let k = 0; k < 5; k++) add([0.8, 0.5, 0.6], [fx - 1.2, G + 0.25, HZ - 9 + k * 4.5], 0xffb040, 'Neon', { collide: 0 });
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.SteamVent.push([fx - 1.5, G + 0.6, HZ + 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  sign('EXIT', [0.2, 1.2, 4], [HX1 + 0.4, G + 8, HZ - 6], BLACK, 0x5adc6e, 'Right', 'GothamBold', true);

  // a smaller tent for the scare actors and props
  tent(440, 472, 148, 18, 6);
  sign('SCARE ACTORS ONLY', [0.2, 1.4, 8], [439.8, G + 4.4, 148], BLACK, ORANGE, 'Left', 'GothamBold');

  // the queue: posts and white rope on the asphalt, all roped now
  const Q = FAMILY_QUEUE;
  const post = (x, z) => {
    box([0.9, 0.12, 0.9], [x, G, z], 0x8a6a30, 'Metal', { collide: 0 });
    box([0.22, 3.2, 0.22], [x, G, z], 0x9a9ea6, 'Metal');
  };
  const ropeX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 5));
    for (let k = 0; k <= n; k++) post(xa + ((xb - xa) * k) / n, z);
    add([xb - xa, 0.16, 0.16], [(xa + xb) / 2, G + 2.7, z], WHITE, 'Fabric', { collide: 0 });
  };
  const ropeZ = (x, za, zb) => {
    const n = Math.max(1, Math.round((zb - za) / 5));
    for (let k = 0; k <= n; k++) post(x, za + ((zb - za) * k) / n);
    add([0.16, 0.16, zb - za], [x, G + 2.7, (za + zb) / 2], WHITE, 'Fabric', { collide: 0 });
  };
  ropeZ(Q.x0, Q.z0, Q.z1);
  ropeZ(Q.x1, Q.z0, Q.z1 - 6);
  ropeX(Q.x0 + 6, Q.x1, Q.z0); // the way in at the south-west corner
  ropeX(Q.x0, Q.x1, Q.z1);
  for (let k = 1; k < Q.rows; k++) {
    const z = Q.z0 + k * Q.step;
    if (k % 2) ropeX(Q.x0, Q.x1 - 6, z); else ropeX(Q.x0 + 6, Q.x1, z);
  }
  box([0.4, 6, 0.4], [Q.x0 - 3, G, Q.z0 - 2], BLACK, 'Metal');
  sign('LIGHTS OUT AT LAKESIDE', [9, 1.8, 0.2], [Q.x0 - 3, G + 5.6, Q.z0 - 2.2], BLACK, 0xffb040, 'Front', 'GothamBlack', true);
  spot('haunt', 'idle', 'Family', Q.x0 + 3, G, Q.z0 - 4, 0);

  // lodge props by the door, the generator and lighting
  for (let k = 0; k < 3; k++) box([2, 0.9, 10], [452 + k * 2.4, G, 180], [0x8a3a22, 0x3a5a2a, 0x2a4a6a][k], 'Wood');
  for (let k = 0; k < 6; k++) box([3, 2.6, 4], [490 + (k % 2) * 3.4, G + Math.floor(k / 2) * 2.6, 140], 0x1a1a1c, 'Metal');
  box([9, 5.5, 4.5], [400, G, 140], 0x5a5e66, 'Metal');
  sign('GENERATOR', [5, 1, 0.2], [400, G + 4.2, 142.3], 0x5a5e66, 0xf2c818, 'Back', 'GothamBold');
  box([1, 14, 1], [408, G, 170], 0x8a8e96, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([1, 1, 0.4], [406.5 + (k % 2) * 3, G + 14.5 + Math.floor(k / 2) * 1.2, 170.4], 0xfff6d8, 'Neon', { collide: 0 });
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.ParkLamp.push([408, G + 15, 170.4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  spot('haunt', 'idle', 'Family', 384, G, gz + 6, -Math.PI / 2);
  return { tent: { x0: HX0, x1: HX1, z: HZ, door: [fx - 2, HZ + 2], exit: [HX1 + 4, HZ - 6] } };
}

// ------------------------------------------------------------- scare zones
// Find a clear patch of ground near (x, z): no buildings, props or trees,
// away from ride tracks, queues, shops and water.
function makeFinder(data) {
  const CELL = 2;
  const blocked = new Set();
  const key = (i, j) => i * 100003 + j;
  const hidden = new Set(data.hidden || []);
  data.static.forEach((p, idx) => {
    if (hidden.has(idx)) return;
    const top = p[5] + p[2] / 2, bottom = p[5] - p[2] / 2;
    if (top < 0.7 || bottom > 10) return;
    if (p[1] * p[3] > 30000) return;
    const ax = [p[7], p[13]], az = [p[9], p[15]];
    const ex = (Math.abs(ax[0]) * p[1] + Math.abs(az[0]) * p[3]) / 2 + 1, ez = (Math.abs(ax[1]) * p[1] + Math.abs(az[1]) * p[3]) / 2 + 1;
    for (let i = Math.floor((p[4] - ex) / CELL); i <= Math.floor((p[4] + ex) / CELL); i++) {
      for (let j = Math.floor((p[6] - ez) / CELL); j <= Math.floor((p[6] + ez) / CELL); j++) blocked.add(key(i, j));
    }
  });
  // the top of whatever paving is underfoot
  const groundAt = (x, z) => {
    let g = 0;
    data.static.forEach((p, idx) => {
      const top = p[5] + p[2] / 2;
      if (hidden.has(idx) || top > 1.3 || top < g) return;
      const ex = (Math.abs(p[7]) * p[1] + Math.abs(p[9]) * p[3]) / 2, ez = (Math.abs(p[13]) * p[1] + Math.abs(p[15]) * p[3]) / 2;
      if (Math.abs(x - p[4]) < ex && Math.abs(z - p[6]) < ez) g = top;
    });
    return g;
  };
  const avoid = [];
  for (const t of data.trees || []) avoid.push([t.pos[0], t.pos[2], 6]);
  for (const r of data.rides) {
    if (r.track) for (let i = 0; i < r.track.pos.length; i += 9) if (r.track.pos[i + 1] < 16) avoid.push([r.track.pos[i], r.track.pos[i + 2], 9]);
    if (r.queue) for (let i = 0; i < r.queue.points.length; i += 2) avoid.push([r.queue.points[i], r.queue.points[i + 1], 8]);
    avoid.push([r.origin[0], r.origin[2], 18]);
  }
  for (const v of data.config.Venues) avoid.push([v.position[0], v.position[2], 24]);
  for (const t of data.terrain) {
    if (t.kind === 'ball') avoid.push([t.center[0], t.center[2], Math.max(0, Math.sqrt(Math.max(0, t.radius ** 2 - (0.7 - t.center[1]) ** 2))) + 3]);
    if (t.kind === 'cylinder') avoid.push([t.cf[0], t.cf[2], t.radius + 14]);
    if (t.kind === 'block') avoid.push([t.cf[0], t.cf[2], Math.max(t.size[0], t.size[2]) / 2 + 8]);
  }
  const clear = (x, z, r) => {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) if (blocked.has(key(i, j))) return false;
    }
    return !avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar + r);
  };
  const B = data.config.Bounds;
  return (x0, z0, r, region) => {
    for (let d = 0; d < 200; d += 3) {
      const n = Math.max(1, Math.round((d * Math.PI * 2) / 6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
        if (x < B.minX + r + 6 || x > B.maxX - r - 6 || z < B.minZ + r + 6 || z > B.maxZ - r - 6) continue;
        if (region && !region.some(([rx0, rz0, rx1, rz1]) => x > rx0 + r && x < rx1 - r && z > rz0 + r && z < rz1 - r)) continue;
        if (clear(x, z, r)) return [x, z, groundAt(x, z)];
      }
    }
    return null;
  };
}

export const SCARE_ZONES = [
  { name: 'MIDNIGHT AT THE GATE', land: 'Plaza', near: [40, 230], glow: 0x9a6aff },
  { name: 'SMOKESTACK ALLEY', land: 'Diesel', near: [-160, 60], glow: 0xff3a10 },
  { name: 'SCARECROW CROSSING', land: 'Haulers', near: [-200, 200], glow: 0xff8a10 },
  { name: 'THE HOLLOW WOODS', land: 'Backwoods', near: [-230, -250], glow: 0x40ff80 },
  { name: 'BACKLOT BLOODBATH', land: 'Studios', near: [-60, -200], glow: 0xff2030 },
  { name: 'BURNOUT BOULEVARD', land: 'Velocity', near: [230, -150], glow: 0xff5a00 },
];

export function buildScareZones(data) {
  const { add, box, sign, spot } = helpers(data);
  const find = makeFinder(data);
  data.tags.SteamVent = data.tags.SteamVent || [];
  const placed = [];
  for (const zone of SCARE_ZONES) {
    const land = data.config.Lands.find((l) => l.id === zone.land);
    const at = find(zone.near[0], zone.near[1], 9, land?.regions) || find(zone.near[0], zone.near[1], 7, land?.regions) || find(zone.near[0], zone.near[1], 6, land?.regions);
    if (!at) continue;
    const [x, z, G] = at;
    placed.push({ ...zone, x, z });
    // the zone's lit sign on a black frame, facing the land's center
    const c = land ? land.center : [0, 0, 0];
    const yaw = Math.atan2(c[0] - x, c[2] - z); // local +Z faces the center
    const fwd = [Math.sin(yaw), Math.cos(yaw)], side = [Math.cos(yaw), -Math.sin(yaw)];
    const P = (u, v) => [x + side[0] * u + fwd[0] * v, z + side[1] * u + fwd[1] * v];
    const [sx, sz] = P(0, 7);
    for (const u of [-4.2, 4.2]) {
      const [px, pz] = P(u, 7);
      box([0.4, 6, 0.4], [px, G, pz], BLACK, 'Metal', { yaw });
    }
    add([9, 2.6, 0.4], [sx, G + 5.6, sz], BLACK, 'Metal', { yaw, collide: 0 });
    sign(zone.name, [8.4, 1.6, 0.2], [sx + fwd[0] * 0.25, G + 5.8, sz + fwd[1] * 0.25], BLACK, zone.glow, 'Back', 'GothamBlack', true, yaw);
    sign('BENTON HAUNT SCARE ZONE', [8.4, 0.6, 0.2], [sx + fwd[0] * 0.25, G + 4.75, sz + fwd[1] * 0.25], BLACK, WHITE, 'Back', 'GothamBold', false, yaw);
    // fog machines and colored light
    for (const [u, v] of [[-6, 2], [6, -2]]) {
      const [fx, fz] = P(u, v);
      box([1.2, 0.8, 1.6], [fx, G, fz], 0x2a2a2e, 'Metal', { yaw, collide: 0 });
      data.tags.SteamVent.push([fx, G + 0.9, fz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    for (const [u, v] of [[-7, -5], [7, 4], [0, -7]]) {
      const [lx, lz] = P(u, v);
      box([0.25, 3, 0.25], [lx, G, lz], 0x2a2a2e, 'Metal', { collide: 0 });
      add([0.9, 0.9, 0.9], [lx, G + 3.3, lz], zone.glow, 'Neon', { shape: 3, collide: 0 });
    }
    const props = {
      'MIDNIGHT AT THE GATE': () => {
        for (let k = 0; k < 4; k++) {
          const [tx, tz] = P(-4 + k * 2.6, -2);
          box([1.8, 2.6, 0.5], [tx, G, tz], 0x8a8a86, 'Concrete', { yaw });
        }
        const [cx, cz] = P(0, -5);
        box([2.4, 9, 2.4], [cx, G, cz], 0x2a2a2e, 'Wood', { yaw });
        add([2.6, 2.6, 0.3], [cx + fwd[0] * 1.3, G + 7.4, cz + fwd[1] * 1.3], 0xf4f0e0, 'SmoothPlastic', { yaw, collide: 0 });
      },
      'SMOKESTACK ALLEY': () => {
        for (let k = 0; k < 3; k++) {
          const [px, pz] = P(-4 + k * 3.5, -3);
          box([2, 10 + k * 3, 2], [px, G, pz], 0x5a3a2a, 'CorrodedMetal', { shape: 5 });
        }
        for (let k = 0; k < 4; k++) {
          const [dx, dz] = P(-6 + k * 2.4, 3);
          box([2, 2.8, 2], [dx, G, dz], k % 2 ? 0x3a3a3e : 0xc8322d, 'CorrodedMetal', { shape: 5 });
        }
        const [lx, lz] = P(0, 0);
        add([0.8, 0.8, 0.8], [lx, G + 0.4, lz], 0xff2a10, 'Neon', { shape: 3, collide: 0 });
      },
      'SCARECROW CROSSING': () => {
        for (let k = 0; k < 3; k++) {
          const [px, pz] = P(-4 + k * 4, -3);
          box([0.3, 6, 0.3], [px, G, pz], 0x6a4a30, 'Wood', { collide: 0 });
          add([3.6, 0.3, 0.3], [px, G + 4.6, pz], 0x6a4a30, 'Wood', { yaw, collide: 0 });
          add([1.2, 1.2, 1.2], [px, G + 6.2, pz], k === 1 ? PUMPKIN : 0xd8b060, 'Fabric', { shape: 3, collide: 0 });
          box([1.6, 2.4, 0.9], [px, G + 3.4, pz], [0x8a3a22, 0x3a5a8a, 0x5a6a2a][k], 'Fabric', { yaw, collide: 0 });
        }
        for (let k = 0; k < 4; k++) {
          const [hx, hz] = P(-5 + k * 3.8, 3);
          box([3.6, 1.6, 2], [hx, G, hz], 0xd8b850, 'Fabric', { yaw });
        }
        for (let k = 0; k < 5; k++) {
          const [px, pz] = P(-2 + k * 1.2, 5);
          add([1.4, 1.2, 1.4], [px, G + 0.6, pz], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
        }
      },
      'THE HOLLOW WOODS': () => {
        for (let k = 0; k < 4; k++) {
          const [px, pz] = P(-6 + k * 4, -3 + (k % 2) * 2);
          box([0.3, 7, 0.3], [px, G, pz], 0x2a2a2e, 'Metal', { collide: 0 });
          add([0.7, 1, 0.7], [px, G + 7.3, pz], 0xffb040, 'Neon', { collide: 0 });
        }
        for (let k = 0; k < 2; k++) {
          const [tx, tz] = P(-3 + k * 6, 1);
          box([1, 9, 1], [tx, G, tz], 0x2a2018, 'Wood', { collide: 0 });
          add([0.4, 0.4, 5], [tx, G + 7, tz], 0x2a2018, 'Wood', { collide: 0, rot: [1, 0, 0, 0, 0.8, -0.6, 0, 0.6, 0.8] });
          add([5, 0.4, 0.4], [tx, G + 5.5, tz], 0x2a2018, 'Wood', { collide: 0, rot: [0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1] });
        }
      },
      'BACKLOT BLOODBATH': () => {
        for (let k = 0; k < 2; k++) {
          const [lx, lz] = P(-5 + k * 10, -2);
          box([0.2, 6, 0.2], [lx, G, lz], 0x2a2a2e, 'Metal', { collide: 0 });
          add([2, 2, 1.4], [lx, G + 6.4, lz], 0x2a2a2e, 'Metal', { yaw, collide: 0 });
        }
        for (let k = 0; k < 3; k++) {
          const [bx, bz] = P(-2 + k * 2.4, 3);
          box([2, 2.8, 2], [bx, G, bz], 0x8a0a0a, 'SmoothPlastic', { shape: 5 });
        }
        const [tx, tz] = P(0, -4);
        add([12, 0.2, 0.1], [tx, G + 3, tz], 0xf2c818, 'SmoothPlastic', { yaw, collide: 0 });
        sign('CLOSED SET', [3, 1, 0.1], [tx, G + 3.6, tz], 0xf2c818, BLACK, 'Back', 'GothamBlack', false, yaw);
      },
      'BURNOUT BOULEVARD': () => {
        const [cx, cz] = P(-2, -2);
        box([9, 2.6, 4.6], [cx, G + 0.6, cz], 0x2a2420, 'CorrodedMetal', { yaw });
        box([5, 2, 4.2], [cx, G + 3.2, cz], 0x2a2420, 'CorrodedMetal', { yaw });
        for (let k = 0; k < 4; k++) {
          const [tx, tz] = P(6, -3 + k * 0.1);
          add([2.4, 0.8, 2.4], [tx, G + 0.4 + k * 0.8, tz], 0x1a1a1a, 'Rubber', { shape: 5 });
        }
        for (let k = 0; k < 6; k++) {
          const [ox, oz] = P(-7 + k * 2.6, 4);
          box([0.9, 1.6, 0.9], [ox, G, oz], 0xff6a10, 'SmoothPlastic', { collide: 0 });
          if (k % 2) add([0.3, 0.3, 0.3], [ox, G + 1.8, oz], 0xff2020, 'Neon', { shape: 3, collide: 0 });
        }
      },
    };
    props[zone.name]?.();
    // the scare actors who roam the zone
    for (const [u, v] of [[-3, -1], [4, 2], [-1, 4]]) {
      const [ax, az] = P(u, v);
      spot('scare', 'idle', zone.land, ax, G, az, yaw);
    }
  }
  return placed;
}

// ------------------------------------------------------------------ food
// Graveyard Grub: the Benton Haunt food stand on the backstage avenue,
// with a seasonal menu (each treat is modeled on one of the park's own
// and painted for Halloween).
const MENU = [
  { id: 'PumpkinChurro', base: 'DieselDog', name: 'Pumpkin Spice Churro', description: 'A foot of fried dough rolled in pumpkin spice sugar.', price: 14, hunger: 25, bites: 3, colors: [0xd87a20, 0x8a4a1a] },
  { id: 'MonsterBurger', base: 'DepotBurger', name: 'Monster Burger', description: 'Two patties on a green monster bun. Fills you right up.', price: 34, hunger: 65, bites: 4, colors: [0x6aa83a, 0x3a2010] },
  { id: 'WitchsBrew', base: 'TurboShake', name: "Witch's Brew Slushie", description: 'Purple, fizzy and bubbling. Levitation (jump) boost!', price: 16, hunger: 15, bites: 2, colors: [0x7a3ab8, 0x6aff6a], buff: { kind: 'jump', duration: 45, amount: 14 } },
  { id: 'DirtCup', base: 'Popcorn', name: 'Graveyard Dirt Cup', description: 'Chocolate pudding, cookie "dirt" and gummy worms.', price: 12, hunger: 20, bites: 3, colors: [0x1a1a1c, 0x4a2a14] },
  { id: 'FunnelCake', base: 'CinnamonRoll', name: 'Bloody Funnel Cake', description: 'Powdered sugar and a splash of strawberry "blood".', price: 18, hunger: 35, bites: 3, colors: [0xe8d8a0, 0xc01a1a] },
  { id: 'HauntedCocoa', base: 'Coffee', name: 'Haunted Hot Cocoa', description: 'Spooky-strong cocoa with ghost marshmallows. Speed boost!', price: 10, hunger: 10, bites: 2, colors: [0xf4f4f0, 0x5a3420], buff: { kind: 'speed', duration: 45, amount: 5 } },
];

export function buildHauntFood(data) {
  const { add, box, sign, spot } = helpers(data);
  const cfgItems = data.config.Items;
  for (const m of MENU) {
    const base = cfgItems.find((i) => i.id === m.base);
    const model = data.items.find((i) => i.id === m.base);
    if (!base || !model) continue;
    // repaint: the base item's own colors map to the new ones; failing
    // that, its model's distinct colors in order
    const seen = [];
    for (const p of model.preview || []) if (!seen.includes(p[16])) seen.push(p[16]);
    const matched = seen.some((c) => base.colors.includes(c));
    const from = matched ? base.colors : seen;
    const recolor = (parts) => parts.map((p) => {
      const q = p.slice();
      const k = from.indexOf(p[16]);
      if (k >= 0 && m.colors[k] !== undefined) q[16] = m.colors[k];
      return q;
    });
    const { base: _b, ...item } = m;
    cfgItems.push({ ...item, kind: 'food', shape: base.shape });
    data.items.push({ id: m.id, preview: recolor(model.preview || []), wear: recolor(model.wear || model.preview || []) });
  }
  // the stand: open counter facing the avenue, a pumpkin-orange awning,
  // a lit sign, a menu board and tables out front
  const X = -10, Z = -428, W = 36, D = 22, H = 12, front = Z - D / 2;
  const WALL = 0x2a2226;
  box([W, H, 1], [X, G, Z + D / 2 - 0.5], WALL, 'WoodPlanks');
  for (const sx of [-1, 1]) box([1, H, D], [X + sx * (W / 2 - 0.5), G, Z], WALL, 'WoodPlanks');
  for (const sx of [-1, 1]) box([7, H, 1], [X + sx * (W / 2 - 3.5), G, front + 0.5], WALL, 'WoodPlanks');
  box([W - 14, 4, 1], [X, G + H - 4, front + 0.5], WALL, 'WoodPlanks');
  box([W - 14, 3.4, 2], [X, G, front + 1.2], 0x3a2a24, 'Wood'); // the counter
  add([W - 14, 0.3, 2.4], [X, G + 3.55, front + 1.2], 0xd8c8a8, 'Concrete', { collide: 0 });
  add([W + 1, 1, D + 1], [X, G + H + 0.5, Z], 0x1a1a1c, 'Concrete', { collide: 0 });
  for (let k = 0; k < 8; k++) add([(W - 14) / 8, 0.3, 4], [X - (W - 14) / 2 + (k + 0.5) * ((W - 14) / 8), G + H - 4.4, front - 1.8], k % 2 ? 0x1a1a1c : 0xff7a1a, 'Fabric', { collide: 0, rot: [1, 0, 0, 0, 0.96, 0.28, 0, -0.28, 0.96] });
  sign('GRAVEYARD GRUB', [W - 6, 2.8, 0.2], [X, G + H + 2.2, front - 0.2], BLACK, ORANGE, 'Front', 'GothamBlack', true);
  add([W - 6, 3.4, 0.4], [X, G + H + 2.2, front + 0.1], BLACK, 'Metal', { collide: 0 });
  sign('MONSTER BURGERS  ·  WITCH\'S BREW  ·  DIRT CUPS  ·  FUNNEL CAKES', [W - 16, 1.2, 0.2], [X, G + H - 2.2, front - 0.1], BLACK, WHITE, 'Front', 'GothamBold', true);
  // jack-o'-lanterns along the counter and tombstones at the corners
  for (let k = 0; k < 5; k++) {
    add([1.4, 1.2, 1.4], [X - 8 + k * 4, G + 4.3, front + 1.2], PUMPKIN, 'SmoothPlastic', { shape: 3, collide: 0 });
    add([0.5, 0.3, 0.1], [X - 8 + k * 4, G + 4.4, front + 0.48], 0xffd27a, 'Neon', { collide: 0 });
  }
  for (const sx of [-1, 1]) {
    box([2, 3, 0.6], [X + sx * (W / 2 + 2), G, front + 2], 0x8a8a86, 'Concrete');
    add([2, 0.6, 0.6], [X + sx * (W / 2 + 2), G + 3.3, front + 2], 0x8a8a86, 'Concrete', { shape: 2, collide: 0 });
  }
  // picnic tables with orange umbrellas
  for (const [tx, tz] of [[X - 14, front - 12], [X, front - 14], [X + 14, front - 12]]) {
    box([6, 0.3, 3], [tx, G + 2.6, tz], 0x3a2a24, 'Wood');
    box([0.4, 2.6, 0.4], [tx, G, tz], 0x3a2a24, 'Wood', { collide: 0 });
    for (const dz of [-2.4, 2.4]) box([6, 0.3, 1], [tx, G + 1.6, tz + dz], 0x3a2a24, 'Wood', { collide: 0 });
    box([0.2, 6, 0.2], [tx, G + 2.9, tz], 0x2a2a2e, 'Metal', { collide: 0 });
    add([7, 0.4, 7], [tx, G + 8.9, tz], 0xff7a1a, 'Fabric', { shape: 3, collide: 0 });
  }
  data.config.Venues.push({
    id: 'GraveyardGrub', name: 'Graveyard Grub', kind: 'restaurant', land: 'Studios', facing: 'N',
    description: "Benton Haunt eats: monster burgers, witch's brew, dirt cups and bloody funnel cakes.",
    items: MENU.map((m) => m.id), color: 0xff7a1a, position: [X, 0, Z], size: [W, H, D],
  });
  data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: 'GraveyardGrub', land: 'Studios', seed: 0, cf: [X, G, front + 3.4, 1, 0, 0, 0, 1, 0, 0, 0, 1] });
}
