// Benton Haunt, part two: the small backstage behind Benton Family Landing,
// where the crews are putting up the sixth house in a big white clear-span
// tent (Lights Out at Lakeside) with a rope-and-stanchion queue in front,
// and the six scare zones starting to go up around the park: props being
// placed, fog machines in, the rest still in crates, a setup sign and a
// crew member or two at each.

export const FB = { x0: 375, x1: 500, z0: 128, z1: 236 };
const GATE = { z0: 161.4, z1: 197.1 }; // between the east wall pillars at z 159.1 and 199.4
const G = 0.1;
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
  sign('HOUSE 6 GOING UP  ·  CREWS AT WORK', [0.2, 1, gw - 6], [377.9, G + 15.3, gz], BLACK, WHITE, 'Left', 'GothamBold');

  // the clear-span tent for the sixth house: straight walls under a
  // rounded white roof, ribbed every few studs
  const tent = (x0, x1, zc, W, wallH) => {
    const L = x1 - x0, xc = (x0 + x1) / 2;
    box([L, wallH, W], [xc, G, zc], CANVAS, 'Fabric');
    add([L, W, W], [xc, G + wallH, zc], CANVAS, 'Fabric', { shape: 2, collide: 0 });
    for (let x = x0; x <= x1 + 0.01; x += L / Math.round(L / 6)) add([0.3, W + 0.3, W + 0.3], [x, G + wallH, zc], 0xd2d2ce, 'Metal', { shape: 2, collide: 0 });
  };
  const HX0 = 420, HX1 = 482, HZ = 212, HW = 28;
  tent(HX0, HX1, HZ, HW, 7);
  // the facade going up at the tent's west end: a lakeside lodge, half
  // built, the sign still waiting to be hung
  const fx = HX0 - 0.8;
  box([1.2, 15, 24], [fx, G, HZ], 0x2a1c14, 'WoodPlanks');
  for (let k = 0; k < 7; k++) add([1.2, 1.2, 12], [fx - 0.8, G + 0.6 + k * 1.25, HZ - 6], 0x6a4428, 'Wood', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  add([0.3, 9, 6], [fx - 0.7, G + 4.5, HZ + 2], 0x050506, 'SmoothPlastic', { collide: 0 });
  add([26, 3, 8], [fx - 2.2, G + 16.4, HZ], 0x3a2418, 'Wood', { shape: 1, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  add([1.2, 2.4, 0.8], [fx - 0.8, G + 7, HZ - 9], 0xffb040, 'Neon', { collide: 0 });
  // the sign leans on a crate, waiting for the lift
  box([3, 2, 3], [fx - 9, G, HZ - 8], 0x8a6a44, 'WoodPlanks');
  sign('LIGHTS OUT AT LAKESIDE', [0.3, 2.4, 18], [fx - 9.6, G + 2.6, HZ - 8], BLACK, ORANGE, 'Left', 'GothamBlack');
  // scaffold over the unfinished half, with a painter
  for (const [dx, dz] of [[-1.6, 3], [-1.6, 11], [-4, 3], [-4, 11]]) box([0.25, 14, 0.25], [fx + dx, G, HZ + dz], 0xb8b8b4, 'Metal', { collide: 0 });
  for (const y of [7, 13.5]) box([3, 0.25, 8.6], [fx - 2.8, G + y, HZ + 7], 0x8a6a44, 'WoodPlanks', { collide: 0 });
  spot('haunt', 'work', 'Family', fx - 2.6, G + 13.75, HZ + 7, -Math.PI / 2);
  spot('haunt', 'work', 'Family', fx - 3, G, HZ - 3, -Math.PI / 2);
  // a scissor lift standing by for the sign
  box([4, 1.2, 6.5], [fx - 16, G, HZ - 1], 0xf2c818, 'SmoothPlastic');
  box([3.4, 3, 4.6], [fx - 16, G + 1.2, HZ - 1], 0x3a3f46, 'Metal', { collide: 0 });
  box([4.4, 0.4, 7], [fx - 16, G + 4.2, HZ - 1], 0xf2c818, 'SmoothPlastic', { collide: 0 });

  // a smaller tent for the scare actors and props
  tent(440, 472, 148, 18, 6);
  sign('SCARE ACTORS ONLY', [0.2, 1.4, 8], [439.8, G + 4.4, 148], BLACK, ORANGE, 'Left', 'GothamBold');

  // the queue: posts and white rope on the asphalt, like the big events
  // use; the first rows are roped, the rest still just posts
  const QX0 = 384, QX1 = 414, QZ0 = 200, QZ1 = 232;
  const post = (x, z) => {
    box([0.9, 0.12, 0.9], [x, G, z], 0x8a6a30, 'Metal', { collide: 0 });
    box([0.22, 3.2, 0.22], [x, G, z], 0x9a9ea6, 'Metal');
  };
  const ropeX = (xa, xb, z, roped) => {
    const n = Math.max(1, Math.round((xb - xa) / 5));
    for (let k = 0; k <= n; k++) post(xa + ((xb - xa) * k) / n, z);
    if (roped) add([xb - xa, 0.16, 0.16], [(xa + xb) / 2, G + 2.7, z], WHITE, 'Fabric', { collide: 0 });
  };
  const ropeZ = (x, za, zb, roped) => {
    const n = Math.max(1, Math.round((zb - za) / 5));
    for (let k = 0; k <= n; k++) post(x, za + ((zb - za) * k) / n);
    if (roped) add([0.16, 0.16, zb - za], [x, G + 2.7, (za + zb) / 2], WHITE, 'Fabric', { collide: 0 });
  };
  ropeZ(QX0, QZ0, QZ1, true);
  ropeZ(QX1, QZ0, HZ - 3, true);
  ropeX(QX0 + 6, QX1, QZ0, true); // the way in at the south-west corner
  ropeX(QX0, QX1 - 6, QZ1, true);
  let row = 0;
  for (let z = QZ0 + 5; z < QZ1 - 1; z += 5, row++) {
    const roped = row < 3;
    if (row % 2) ropeX(QX0 + 6, QX1, z, roped); else ropeX(QX0, QX1 - 6, z, roped);
  }
  // coils of rope and a cart of posts
  for (let k = 0; k < 3; k++) add([1.6, 0.5, 1.6], [QX1 - 3 + k * 0.4, G + 0.25 + k * 0.5, QZ1 - 3], WHITE, 'Fabric', { shape: 5, collide: 0 });
  box([5, 0.6, 2], [QX0 + 10, G + 0.3, QZ1 - 8], 0x3a3a3e, 'Metal');
  for (let k = 0; k < 10; k++) add([0.22, 3.2, 0.22], [QX0 + 8 + (k % 5) * 1, G + 2.5, QZ1 - 8.5 + Math.floor(k / 5)], 0x9a9ea6, 'Metal', { collide: 0 });
  spot('haunt', 'work', 'Family', QX0 + 12, G, QZ1 - 10, 0);
  spot('haunt', 'work', 'Family', QX0 + 20, G, QZ0 + 12, Math.PI);

  // props for the lodge waiting to go in: canoes, logs, lanterns, a dock
  for (let k = 0; k < 3; k++) box([2, 0.9, 10], [452 + k * 2.4, G + k * 0.9 * 0, 180], [0x8a3a22, 0x3a5a2a, 0x2a4a6a][k], 'Wood');
  for (let k = 0; k < 6; k++) add([12, 1.2, 1.2], [470, G + 0.6 + Math.floor(k / 3) * 1.1, 172 + (k % 3) * 1.3], 0x6a4428, 'Wood', { shape: 2, collide: 0 });
  for (let k = 0; k < 6; k++) add([0.7, 1, 0.7], [486 + (k % 3) * 1.2, G + 2.2, 186 + Math.floor(k / 3) * 1.2], 0xffb040, 'Neon', { collide: 0 });
  box([4, 1.6, 3], [487, G, 186.6], 0x8a6a44, 'WoodPlanks');
  for (let k = 0; k < 6; k++) box([3, 2.6, 4], [490 + (k % 2) * 3.4, G + Math.floor(k / 2) * 2.6, 140], 0x1a1a1c, 'Metal');
  box([9, 5.5, 4.5], [400, G, 140], 0x5a5e66, 'Metal');
  sign('GENERATOR', [5, 1, 0.2], [400, G + 4.2, 142.3], 0x5a5e66, 0xf2c818, 'Back', 'GothamBold');
  // a light tower and a truck delivering the house's lighting
  box([1, 14, 1], [410, G, 170], 0x8a8e96, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([1, 1, 0.4], [408.5 + (k % 2) * 3, G + 14.5 + Math.floor(k / 2) * 1.2, 170.4], 0xfff6d8, 'Neon', { collide: 0 });
  box([24, 9, 8], [455, G + 1.6, 166], WHITE, 'SmoothPlastic');
  sign('LIGHTING & SOUND', [18, 1.8, 0.2], [455, G + 7.8, 170.1], WHITE, 0x16223a, 'Back', 'GothamBlack');
  box([6, 7, 7.6], [470, G + 1, 166], 0x2a3a5a, 'SmoothPlastic');
  spot('haunt', 'idle', 'Family', 452, G, 172, Math.PI);
  spot('haunt', 'idle', 'Family', 384, G, gz + 6, -Math.PI / 2);
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
  { name: 'MIDNIGHT AT THE GATE', land: 'Plaza', near: [40, 230] },
  { name: 'SMOKESTACK ALLEY', land: 'Diesel', near: [-160, 60] },
  { name: 'SCARECROW CROSSING', land: 'Haulers', near: [-200, 200] },
  { name: 'THE HOLLOW WOODS', land: 'Backwoods', near: [-230, -250] },
  { name: 'BACKLOT BLOODBATH', land: 'Studios', near: [-60, -200] },
  { name: 'BURNOUT BOULEVARD', land: 'Velocity', near: [230, -150] },
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
    // the setup sign on an A-frame, facing the land's center
    const c = land ? land.center : [0, 0, 0];
    const yaw = Math.atan2(c[0] - x, c[2] - z); // local +Z faces the center
    const fwd = [Math.sin(yaw), Math.cos(yaw)], side = [Math.cos(yaw), -Math.sin(yaw)];
    const P = (u, v) => [x + side[0] * u + fwd[0] * v, z + side[1] * u + fwd[1] * v];
    const [sx, sz] = P(0, 7);
    for (const u of [-3.8, 3.8]) {
      const [px, pz] = P(u, 7);
      box([0.25, 4.6, 0.25], [px, G, pz], BLACK, 'Metal', { yaw });
    }
    sign(`SCARE ZONE: ${zone.name}`, [8, 1.4, 0.2], [sx, G + 4, sz], BLACK, ORANGE, 'Back', 'GothamBlack', true, yaw);
    sign('SETUP IN PROGRESS  ·  BENTON HAUNT', [8, 0.8, 0.2], [sx, G + 2.9, sz], BLACK, WHITE, 'Back', 'GothamBold', false, yaw);
    // fog machine, a cart of road cases and the theme's first props
    const [fx, fz] = P(-5, 2);
    box([1.2, 0.8, 1.6], [fx, G, fz], 0x2a2a2e, 'Metal', { yaw });
    data.tags.SteamVent.push([fx, G + 0.9, fz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (let k = 0; k < 4; k++) {
      const [cx, cz] = P(5 + (k % 2) * 3.2, -4 + Math.floor(k / 2) * 0.1);
      box([3, 2.4, 2.6], [cx, G + Math.floor(k / 2) * 2.4, cz], 0x1a1a1c, 'Metal', { yaw });
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
    // a crew member setting it up, and another unpacking the cases
    const [wx, wz] = P(-2, 1), [ux, uz] = P(5, -1.8);
    spot('haunt', 'work', zone.land, wx, G, wz, yaw);
    spot('haunt', 'work', zone.land, ux, G, uz, yaw);
  }
  return placed;
}
