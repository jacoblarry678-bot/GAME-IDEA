// Construction has started on Fast & Furious: Benton Street Run, beyond
// Velocity City's east wall: a huge warehouse show building going up (the
// north end clad with the ride's banner, the south end still a steel frame
// with roof trusses going in), two tower cranes, an excavator, a mixer,
// steel and cladding stacks, the site office and crews, behind a fenced
// site. In the park, a painted construction wall and a locked site gate in
// the east wall tease the ride.
export const FF_SITE = { x0: 386, x1: 596, z0: -400, z1: -110 };
const GATE = { z0: -241.7, z1: -206.3 }; // between the east wall's pillars at z -244 and -204
const WH = { x0: 412, x1: 572, z0: -372, z1: -172, H: 50, clad: -292 }; // clad north of z -292
const G = 0.1;
const RED = 0x8a3a22, STEEL = 0xb8bcc0, YELLOW = 0xf2c818, BLACK = 0x101012, WHITE = 0xf4f4f0, ORANGE = 0xff6a1a, BLUE = 0x1e6ee6;

function helpers(data) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null, trans = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), trans, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (size, center, bg, face, labels, { glow = false, yaw = 0 } = {}) => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({
      part: i, face, glow,
      labels: labels.map(([text, x, y, w, h, color, font = 'GothamBlack']) => ({ text, x, y, w, h, color, font, align: 'Center', stroke: false, pad: 0.1 })),
    });
    return i;
  };
  const cf = (x, y, z, yaw = 0) => [x, y, z, Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  return { add, box, sign, cf };
}

// a rotation that tilts a part's local Y axis by angle a toward +x
const tiltX = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const tiltZ = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];

export function buildFastFurious(data) {
  const { add, box, sign, cf } = helpers(data);
  const S = FF_SITE;
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  const crew = (kind, x, y, z, yaw) => data.staffSpots.push({ role: 'construction', kind, land: 'Velocity', seed: 0, cf: cf(x, y, z, yaw) });

  // level the site, clear its trees, and lay gravel
  data.flatZones = [...(data.flatZones || []), { ...S, margin: 34 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], S, 10));
  add([S.x1 - S.x0, 1, S.z1 - S.z0], [(S.x0 + S.x1) / 2, G - 0.5, (S.z0 + S.z1) / 2], 0x7a7064, 'Ground');

  // ---- a site gate in the east wall: open the wall between two pillars
  data.hidden = data.hidden || [];
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] - 375) < 0.5 && p[3] > 400 && p[6] - p[3] / 2 < GATE.z0 && p[6] + p[3] / 2 > GATE.z1;
    if (wall) { p[19] = 0; data.hidden.push(i); }
  });
  const STONE = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (za, zb) => {
    const len = zb - za;
    add([2.5, 14, len], [375, 7, (za + zb) / 2], STONE, 'Concrete');
    add([3.4, 1, len + 1], [375, 14.5, (za + zb) / 2], CAP, 'Concrete');
  };
  // (the walls the Family Landing backstage rebuilt run from -405 to its gate)
  wallSeg(-405, GATE.z0);
  wallSeg(GATE.z1, 161.4);
  // the locked gate: chain-link with a green privacy screen
  const gz = (GATE.z0 + GATE.z1) / 2, gw = GATE.z1 - GATE.z0;
  for (const z of [GATE.z0 + 0.8, gz, GATE.z1 - 0.8]) box([1, 14, 1], [378, G, z], STEEL, 'Metal', { shape: 5 });
  box([0.3, 13.4, gw], [378, G, gz], 0x8a9096, 'Metal', { trans: 0.55 });
  add([0.2, 8, gw - 2], [377.6, G + 4.4, gz], 0x1e4a2a, 'Fabric', { collide: 0 });
  sign([0.2, 2.6, 22], [377.4, G + 10.4, gz], 0xc8322d, 'Left', [['CONSTRUCTION ENTRANCE', 0, 0, 1, 1, WHITE]]);
  sign([0.2, 4.6, 26], [377.4, G + 5.4, gz], BLACK, 'Left', [['FAST & FURIOUS', 0, 0.02, 1, 0.58, ORANGE], ['BENTON STREET RUN  ·  COMING SOON', 0, 0.62, 1, 0.34, 0x9ad8ff, 'GothamBold']], { glow: true });

  // ---- the teaser construction wall inside Velocity City
  const tw = { x: 368, z0: GATE.z0 - 24, z1: GATE.z1 + 24 };
  for (let z = tw.z0; z <= tw.z1 + 0.01; z += 8.6) box([0.6, 11, 0.6], [tw.x + 0.6, G, z], 0x6a4a30, 'Wood', { collide: 0 });
  box([0.8, 10, tw.z1 - tw.z0], [tw.x, G, (tw.z0 + tw.z1) / 2], 0x16223a, 'WoodPlanks');
  const panels = [
    [['FAST & FURIOUS', 0, 0.1, 1, 0.5, ORANGE], ['BENTON STREET RUN', 0, 0.6, 1, 0.3, WHITE, 'GothamBold']],
    [['COMING SOON', 0, 0.15, 1, 0.45, YELLOW], ['TO VELOCITY CITY', 0, 0.6, 1, 0.28, WHITE, 'GothamBold']],
    [['IT\'S NEVER JUST', 0, 0.1, 1, 0.35, WHITE], ['ABOUT THE CARS', 0, 0.45, 1, 0.35, WHITE], ['IT\'S ABOUT FAMILY', 0, 0.8, 1, 0.18, ORANGE, 'GothamBold']],
    [['NITROUS LAUNCHES', 0, 0.12, 1, 0.3, 0x9ad8ff], ['DRIFTS  ·  CHASES  ·  JUMPS', 0, 0.48, 1, 0.24, WHITE, 'GothamBold'], ['FULL THROTTLE', 0, 0.74, 1, 0.2, ORANGE, 'GothamBold']],
    [['PARDON OUR DUST', 0, 0.15, 1, 0.35, YELLOW], ['SOMETHING FAST IS COMING', 0, 0.58, 1, 0.26, WHITE, 'GothamBold']],
  ];
  const pw = (tw.z1 - tw.z0) / panels.length;
  panels.forEach((labels, k) => sign([0.2, 8, pw - 1.4], [tw.x - 0.5, G + 5.4, tw.z0 + pw * (k + 0.5)], k % 2 ? 0x101826 : 0x1a0e0a, 'Left', labels, { glow: k === 0 }));
  // orange stripes and a peek hole frame near the middle
  add([0.3, 0.5, tw.z1 - tw.z0], [tw.x - 0.5, G + 0.9, (tw.z0 + tw.z1) / 2], ORANGE, 'SmoothPlastic', { collide: 0 });
  add([0.3, 0.5, tw.z1 - tw.z0], [tw.x - 0.5, G + 9.8, (tw.z0 + tw.z1) / 2], ORANGE, 'SmoothPlastic', { collide: 0 });
  crew('idle', tw.x - 6, G, gz + 12, Math.PI / 2);

  // ---- the warehouse: steel frame, the north end clad
  const W = WH;
  const cols = [];
  for (let x = W.x0; x <= W.x1 + 0.01; x += 40) for (let z = W.z0; z <= W.z1 + 0.01; z += 25) cols.push([x, z]);
  add([W.x1 - W.x0 + 4, 0.8, W.z1 - W.z0 + 4], [(W.x0 + W.x1) / 2, G + 0.4, (W.z0 + W.z1) / 2], 0xa8a49c, 'Concrete');
  for (const [x, z] of cols) {
    const edge = x === W.x0 || x === W.x1 || Math.abs(z - W.z0) < 0.1 || Math.abs(z - W.z1) < 0.1;
    if (!edge && z < W.clad) continue; // inside the clad end you can't see them anyway
    // a few columns at the open end are still going up
    const short = z > W.z1 - 30 && x > W.x0 + 70 && x < W.x1 - 10;
    box([1.6, short ? W.H * 0.55 : W.H, 1.6], [x, G + 0.8, z], RED, 'Metal');
  }
  // eave and roof beams over the frame end, trusses part way down it
  for (const x of [W.x0, W.x1]) add([1.2, 1.8, W.z1 - W.clad], [x, G + W.H, (W.clad + W.z1) / 2], RED, 'Metal', { collide: 0 });
  for (let z = W.clad; z <= W.z1 - 40; z += 25) {
    add([W.x1 - W.x0, 1.8, 1.2], [(W.x0 + W.x1) / 2, G + W.H, z], RED, 'Metal', { collide: 0 });
    // a truss: top chord, bottom chord and diagonals
    add([W.x1 - W.x0, 1, 1], [(W.x0 + W.x1) / 2, G + W.H - 6, z], RED, 'Metal', { collide: 0 });
    for (let x = W.x0 + 10; x < W.x1; x += 20) add([0.6, 8, 0.6], [x, G + W.H - 3, z], RED, 'Metal', { collide: 0, rot: tiltX((x / 20) % 2 ? 0.6 : -0.6) });
  }
  // purlins over the trussed part
  for (let x = W.x0 + 10; x < W.x1; x += 20) add([0.6, 0.8, W.z1 - 40 - W.clad], [x, G + W.H + 1.2, (W.clad + W.z1 - 40) / 2], 0x9a9ea6, 'Metal', { collide: 0 });
  // cladding: dark ribbed walls and the roof on the north end
  const CLAD = 0x3a3e46;
  box([1, W.H, W.clad - W.z0], [W.x0, G, (W.z0 + W.clad) / 2], CLAD, 'CorrodedMetal');
  box([1, W.H, W.clad - W.z0], [W.x1, G, (W.z0 + W.clad) / 2], CLAD, 'CorrodedMetal');
  box([W.x1 - W.x0, W.H, 1], [(W.x0 + W.x1) / 2, G, W.z0], CLAD, 'CorrodedMetal');
  add([W.x1 - W.x0 + 2, 1.2, W.clad - W.z0 + 1], [(W.x0 + W.x1) / 2, G + W.H + 0.6, (W.z0 + W.clad) / 2], 0x4a4e56, 'Metal', { collide: 0 });
  for (let z = W.z0 + 4; z < W.clad; z += 4) add([0.4, W.H, 0.5], [W.x0 - 0.6, G + W.H / 2, z], 0x464a52, 'Metal', { collide: 0 });
  // a panel half way up the frame end's west wall, more on the ground
  box([1, 20, 30], [W.x0, G, W.clad + 15], CLAD, 'CorrodedMetal');
  for (let k = 0; k < 8; k++) box([12, 0.5, 4], [W.x0 - 18, G + k * 0.5, W.z1 + 18], CLAD, 'CorrodedMetal', { collide: 0 });
  // the banner on the clad end, facing the park
  sign([0.3, 22, 100], [W.x0 - 0.9, G + 30, (W.z0 + W.clad) / 2], BLACK, 'Left', [
    ['FAST & FURIOUS', 0, 0.04, 1, 0.5, ORANGE], ['BENTON STREET RUN', 0, 0.54, 1, 0.24, WHITE], ['COMING SOON TO VELOCITY CITY', 0, 0.8, 1, 0.16, 0x9ad8ff, 'GothamBold'],
  ], { glow: true });
  sign([0.3, 3, 40], [W.x0 - 0.9, G + 14, (W.z0 + W.clad) / 2], YELLOW, 'Left', [['BENTON CONSTRUCTION  ·  SHOW BUILDING', 0, 0, 1, 1, BLACK, 'GothamBold']]);
  // ride footings and track supports starting inside the frame end
  for (let k = 0; k < 10; k++) {
    const x = W.x0 + 20 + (k % 5) * 28, z = W.clad + 16 + Math.floor(k / 5) * 40;
    box([4, 1.4, 4], [x, G + 0.8, z], 0xc8c6c0, 'Concrete');
    if (k % 3 !== 2) box([1.4, 6 + (k % 4) * 3, 1.4], [x, G + 2.2, z], 0x5a5e66, 'Metal');
  }
  // workers up on the frame and below
  crew('work', W.x0 + 40, G + W.H + 0.9, W.clad + 25, 0);
  crew('work', W.x0 + 100, G + W.H + 0.9, W.clad + 50, Math.PI);
  crew('work', W.x0 + 30, G + 0.8, W.clad + 30, Math.PI / 2);
  crew('work', W.x0 + 90, G + 0.8, W.clad + 60, 0);
  crew('idle', W.x0 - 10, G, W.z1 + 10, Math.PI / 2);

  // ---- two tower cranes
  const tower = (x, z, h, yaw, hookAt, load) => {
    box([10, 2, 10], [x, G, z], 0xa8a49c, 'Concrete');
    box([3, h, 3], [x, G + 2, z], YELLOW, 'Metal');
    for (let y = G + 6; y < h; y += 6) for (const s of [-1, 1]) add([0.25, 6.5, 0.25], [x + s * 1.6, y, z], 0xd8a810, 'Metal', { collide: 0, rot: tiltZ(0.45 * s) });
    const top = G + 2 + h;
    box([3.6, 3, 3.6], [x, top, z], WHITE, 'SmoothPlastic', { collide: 0 });
    box([1.2, 9, 1.2], [x, top + 3, z], YELLOW, 'Metal', { collide: 0 });
    const ux = Math.sin(yaw), uz = Math.cos(yaw);
    add([2.2, 2.2, 74], [x + ux * 25, top + 4, z + uz * 25], YELLOW, 'Metal', { yaw, collide: 0 });
    add([3, 3.4, 5], [x - ux * 9, top + 3.2, z - uz * 9], 0x8a8a86, 'Concrete', { yaw, collide: 0 });
    for (const d of [-12, 30]) {
      const len = Math.hypot(d, 8), a = Math.atan2(d, 8);
      add([0.2, len, 0.2], [x + ux * d / 2, top + 8, z + uz * d / 2], 0x9a9ea6, 'Metal', { collide: 0, rot: yawTilt(yaw, a) });
    }
    add([1, 1, 1], [x, top + 12.6, z], 0xff2020, 'Neon', { collide: 0, shape: 3 });
    // the hook and what it is lifting
    const hx = x + ux * hookAt, hz = z + uz * hookAt;
    add([0.15, top + 3 - load - 3, 0.15], [hx, (top + 3 + load + 3) / 2, hz], 0x2a2a2e, 'Metal', { collide: 0 });
    add([1.2, 1.6, 1.2], [hx, load + 2.4, hz], YELLOW, 'Metal', { collide: 0 });
    add([22, 1.6, 1.2], [hx, load, hz], RED, 'Metal', { collide: 0, yaw: yaw + 0.5 });
  };
  // a tilt in the plane of the jib (for the tie bars)
  function yawTilt(yaw, a) {
    const c = Math.cos(yaw), s = Math.sin(yaw), ca = Math.cos(a), sa = Math.sin(a);
    // R = Ry(yaw) * Rx(a)
    return [c, s * sa, s * ca, 0, ca, -sa, -s, c * sa, c * ca];
  }
  tower(W.x0 + 60, W.z1 + 16, 78, Math.PI, 52, 58);
  tower(W.x1 + 14, W.z0 + 40, 70, -Math.PI / 2 + 0.4, 46, 40);

  // ---- machines, materials and the site office
  // excavator digging the pit for the launch track
  const ex = W.x1 - 10, ez = W.z1 + 34;
  add([18, 1.6, 22], [ex - 10, G - 0.6, ez], 0x5a4a3a, 'Ground', { collide: 0 });
  box([6, 2, 9], [ex, G, ez], 0x2a2a2e, 'Metal');
  box([6.4, 3, 6.4], [ex, G + 2, ez], YELLOW, 'Metal');
  box([2.6, 3.2, 3], [ex - 1.6, G + 5, ez - 1.6], YELLOW, 'Metal');
  add([1, 1, 10], [ex - 4, G + 8, ez - 5], YELLOW, 'Metal', { collide: 0, rot: [1, 0, 0, 0, 0.8, -0.6, 0, 0.6, 0.8] });
  add([1, 9, 1], [ex - 4, G + 6, ez - 11], YELLOW, 'Metal', { collide: 0, rot: tiltZ(-0.3) });
  box([3, 2.2, 2.4], [ex - 4, G + 0.2, ez - 13], 0x3a3a3e, 'Metal', { collide: 0 });
  crew('work', ex + 6, G, ez + 2, -Math.PI / 2);
  // dirt piles
  for (const [x, z, r] of [[W.x1 + 12, W.z1 + 52, 7], [W.x1 - 4, W.z1 + 60, 5], [W.x1 + 4, W.z1 + 64, 4]]) add([r * 2, r * 1.2, r * 2], [x, G + r * 0.3, z], 0x6a5a40, 'Ground', { shape: 3, collide: 0 });
  // a dump truck and a cement mixer
  const truck = (x, z, yaw, mixer) => {
    const ux = Math.sin(yaw), uz = Math.cos(yaw);
    box([7, 4.4, 6], [x + ux * 8, G + 1.2, z + uz * 8], mixer ? 0xf4f4f0 : 0xc8322d, 'SmoothPlastic', { yaw });
    if (mixer) add([5.4, 5.4, 11], [x - ux * 2, G + 5.2, z - uz * 2], 0xd8d8d0, 'Metal', { yaw, collide: 0, shape: 3 });
    else box([7.4, 4.4, 13], [x - ux * 3, G + 2.2, z - uz * 3], 0xf2c818, 'Metal', { yaw });
    for (const [dx, dz] of [[-3.3, 9], [3.3, 9], [-3.3, -2], [3.3, -2], [-3.3, -6], [3.3, -6]]) add([1, 3, 3], [x + Math.cos(yaw) * dx + ux * dz, G + 1.5, z - Math.sin(yaw) * dx + uz * dz], 0x191919, 'Rubber', { shape: 2, yaw, collide: 0 });
  };
  truck(W.x0 + 30, W.z1 + 40, Math.PI / 2, false);
  truck(W.x0 + 60, W.z1 + 52, -Math.PI / 2, true);
  // steel beam and cladding stacks
  for (let k = 0; k < 9; k++) box([30, 1, 1.2], [W.x0 - 16, G + Math.floor(k / 3) * 1.05, W.z1 - 30 + (k % 3) * 1.6], RED, 'Metal', { yaw: Math.PI / 2, collide: k < 3 ? 1 : 0 });
  for (let k = 0; k < 6; k++) box([12, 0.6, 4], [W.x0 - 18, G + k * 0.6, W.z1 - 60], 0x9a9ea6, 'Metal', { collide: k === 0 ? 1 : 0 });
  // the site office, a container and portable toilets
  box([24, 9, 9], [S.x0 + 22, G + 1, S.z0 + 14], WHITE, 'SmoothPlastic');
  sign([20, 1.8, 0.2], [S.x0 + 22, G + 8.2, S.z0 + 18.6], WHITE, 'Back', [['BENTON CONSTRUCTION  ·  SITE OFFICE', 0, 0, 1, 1, 0x16223a, 'GothamBold']]);
  sign([10, 1.2, 0.2], [S.x0 + 22, G + 6.2, S.z0 + 18.6], WHITE, 'Back', [['FAST & FURIOUS PROJECT', 0, 0, 1, 1, ORANGE, 'GothamBold']]);
  box([20, 8.6, 8], [S.x0 + 22, G, S.z0 + 32], 0x2a5a9a, 'CorrodedMetal');
  for (let k = 0; k < 3; k++) box([3.6, 7.4, 3.6], [S.x0 + 50 + k * 4.2, G, S.z0 + 10], 0x2a6ae0, 'SmoothPlastic');
  // the teaser on a trailer: a covered car, waiting for its reveal
  box([16, 1.2, 7], [S.x0 + 20, G + 1.4, W.z1 + 40], 0x2a2a2e, 'Metal');
  box([7, 3, 14], [S.x0 + 20, G + 2.6, W.z1 + 40], 0x6a6e76, 'Fabric', { yaw: Math.PI / 2 });
  box([5.6, 2, 7], [S.x0 + 20.6, G + 5.6, W.z1 + 40], 0x6a6e76, 'Fabric', { yaw: Math.PI / 2, collide: 0 });
  sign([8, 2, 0.2], [S.x0 + 20, G + 3.4, W.z1 + 43.6], BLACK, 'Back', [['DO NOT UNCOVER', 0, 0, 1, 1, YELLOW, 'GothamBold']]);

  // ---- the site fence (with privacy screen) and lights
  const fence = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    const n = Math.round(len / 10);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      box([0.5, 9, 0.5], [xa + (xb - xa) * t, G, za + (zb - za) * t], STEEL, 'Metal', { shape: 5 });
    }
    add([0.2, 8.6, len], [(xa + xb) / 2, G + 4.4, (za + zb) / 2], 0x8a9096, 'Metal', { yaw, trans: 0.6 });
    add([0.25, 5, len], [(xa + xb) / 2, G + 3, (za + zb) / 2], 0x1e4a2a, 'Fabric', { yaw, collide: 0 });
  };
  fence(S.x1, S.z0, S.x1, S.z1);
  fence(379, S.z0, S.x1, S.z0);
  fence(379, S.z1, S.x1, S.z1);
  for (const z of [S.z0 + 60, S.z1 - 60]) sign([0.2, 3, 16], [S.x1 + 0.4, G + 4.4, z], YELLOW, 'Right', [['HARD HAT AREA', 0, 0, 1, 0.55, BLACK], ['FAST & FURIOUS  ·  COMING SOON', 0, 0.55, 1, 0.4, BLACK, 'GothamBold']]);
  for (const [x, z] of [[W.x0 - 26, W.z1 + 30], [W.x1 + 18, W.z1 + 20], [S.x0 + 40, S.z0 + 40], [W.x1 + 18, W.z0 + 10]]) {
    box([0.6, 16, 0.6], [x, G, z], 0x5a5e66, 'Metal');
    for (const dx of [-1.2, 1.2]) add([2, 1.4, 0.8], [x + dx, G + 16.4, z], 0xfff6d8, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x, G + 16, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  data.staff.lines.construction = [
    ...(data.staff.lines.construction || []),
    'Fast & Furious is coming!', 'Biggest building in the park!', 'That warehouse is for the cars...', 'Hard hats only past the gate!', "Can't tell you what's under that cover!",
  ];
  return { gate: { x: 370, z: gz }, site: S };
}

// a toast and some construction noise when you walk up to the site
export class FastFuriousSite {
  constructor(hooks, layout) {
    this.hooks = hooks; // { toast, sound }
    this.layout = layout;
    this.told = false;
    this.next = 2;
  }

  update(dt, pos, started) {
    if (!started) return;
    const { gate } = this.layout;
    const near = Math.hypot(pos.x - gate.x, pos.z - gate.z) < 60 || (pos.x > FF_SITE.x0 - 20 && pos.z > FF_SITE.z0 && pos.z < FF_SITE.z1);
    if (near && !this.told) {
      this.told = true;
      this.hooks.toast(`Construction has started on Fast & Furious: Benton Street Run! The huge warehouse going up behind this wall will be its show building.`, 'info');
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 1 + Math.random() * 3;
      if (near) this.hooks.sound('clank');
    }
  }
}
