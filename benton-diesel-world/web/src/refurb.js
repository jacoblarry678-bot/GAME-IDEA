// The Studio Backlot Tram Tour, reopened after its refurbishment: the road
// is repaved (it used to sink under the lawn), a banner over the entrance
// says it's open again, and along the back of the lot the tram now rolls
// under a row of striped tents where it is Hollywood inside: the hills
// and the big white letters, the Walk of Fame, a movie premiere on a red
// carpet (whose flashbulbs pop as the tram goes by), palms, cameras and a
// golden statue, all under strings of lights.
export const REFURB_ID = 'BacklotTram';

export function buildTramTour(data) {
  const cfg = data.config.Rides.find((r) => r.id === REFURB_ID);
  const ride = data.rides.find((r) => r.id === REFURB_ID);
  if (!cfg || !ride) return;
  // the road has been repaved: its surface now sits just above the lawn
  // (it used to sink under the grass)
  ride.trackStyle = { ...ride.trackStyle, drop: 1.4 };

  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const rec = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0, rot = null } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], ...(rot || [c, 0, s, 0, 1, 0, -s, 0, c]), color, mi(mat), 0, collide];
  };
  const add = (...a) => { data.static.push(rec(...a)); return data.static.length - 1; };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const sign = (text, size, center, bg, fg, face, yaw = 0, font = 'GothamBlack') => {
    const i = add(size, center, bg, 'SmoothPlastic', { collide: 0, yaw });
    data.signs.push({ part: i, face, glow: false, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font, align: 'Center', stroke: false, pad: 0.1 }] });
  };

  // a "now open" banner over the way into the queue
  const q = ride.queue;
  const [ex, ez] = [q.points[q.points.length - 4], q.points[q.points.length - 3]]; // the entrance sign
  const [ox, oz] = q.outward;
  const cx = ex + ox * 7, cz = ez + oz * 7;
  const yaw = Math.atan2(ox, oz);
  const along = [Math.cos(yaw), -Math.sin(yaw)];
  for (const t of [-6, 6]) box([0.4, 9, 0.4], [cx + along[0] * t, 0.6, cz + along[1] * t], 0x966ec8, 'Metal', { yaw });
  sign('NOW OPEN  ·  ALL NEW: HOORAY FOR HOLLYWOOD', [12.4, 1.6, 0.2], [cx + ox * 0.15, 8.6, cz + oz * 0.15], 0x16223a, 0xf0c440, 'Back', yaw);
  // a new scene in the tents: the premiere's flashbulbs pop as the tram
  // rolls past the red carpet
  cfg.cues = [...(cfg.cues || []), [0.55, 'sparks', [-7, 0, 0]]];
  buildHollywood(data, ride, { add, box, sign, mi });
}

// rotation (yaw about Y, then pitch about X) as CFrame components
function yawPitch(yaw, pitch) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [c, s * sp, s * cp, 0, cp, -sp, -s, c * sp, c * cp];
}

// The tents over the tram road on the back of the lot (where it runs
// straight between the flood and explosion scenes), Hollywood inside.
function buildHollywood(data, ride, { add, box, sign }) {
  data.hidden = data.hidden || [];
  // where the road runs: the stretch of track at the back of the lot
  const p = ride.track.pos;
  let roadZ = 0, n = 0;
  for (let i = 0; i < p.length; i += 3) if (p[i] > -26 && p[i] < 70 && p[i + 2] < -380) { roadZ += p[i + 2]; n++; }
  roadZ = n ? roadZ / n : -389.4;
  // (the north side stops short of the soundstages, the south of the park wall)
  const X0 = -26, X1 = 70, Z0 = roadZ - 13.6, Z1 = roadZ + 8.8, H = 10, RIDGE = 7;
  const xm = (X0 + X1) / 2, len = X1 - X0;
  const CANVAS = 0xf4efe4, RED = 0xb8202a, GOLD = 0xe0b040, POLE = 0x6a6e76;
  const rec = (size, pos, color, mat, opts = {}) => add(size, pos, color, mat, opts);

  // canvas walls, with the road running in at the west end and out at the east
  for (const z of [Z0, Z1]) rec([len, H, 0.4], [xm, H / 2, z], CANVAS, 'Fabric');
  const gap = 6.5;
  for (const x of [X0, X1]) {
    rec([0.4, H, roadZ - gap - Z0], [x, H / 2, (Z0 + roadZ - gap) / 2], CANVAS, 'Fabric');
    rec([0.4, H, Z1 - roadZ - gap], [x, H / 2, (Z1 + roadZ + gap) / 2], CANVAS, 'Fabric');
    rec([0.4, 1, gap * 2], [x, H - 0.5, roadZ], CANVAS, 'Fabric');
  }
  // poles and a scalloped red valance round the eaves
  for (let x = X0; x <= X1 + 0.01; x += 8) for (const z of [Z0, Z1]) box([0.5, H + 0.6, 0.5], [x, 0, z + (z < roadZ ? -0.4 : 0.4)], POLE, 'Metal');
  for (const z of [Z0, Z1]) rec([len + 1, 0.9, 0.3], [xm, H - 0.2, z + (z < roadZ ? -0.35 : 0.35)], RED, 'Fabric', { collide: 0 });
  for (const x of [X0, X1]) rec([0.3, 0.9, Z1 - Z0 + 1], [x + (x < xm ? -0.35 : 0.35), H - 0.2, (Z0 + Z1) / 2], RED, 'Fabric', { collide: 0 });
  // three peaked roofs in red and white stripes, gold finials and pennants
  const tents = 3, tl = len / tents, stripes = 4, sw = tl / stripes;
  for (let t = 0; t < tents; t++) {
    const cx = X0 + tl * (t + 0.5);
    for (let k = 0; k < stripes; k++) {
      const x = X0 + tl * t + sw * (k + 0.5);
      const col = k % 2 ? CANVAS : RED;
      // south half rises toward the ridge (+z), north half toward it (-z)
      rec([sw, RIDGE, roadZ - Z0], [x, H + RIDGE / 2, (Z0 + roadZ) / 2], col, 'Fabric', { shape: 1, collide: 0 });
      rec([sw, RIDGE, Z1 - roadZ], [x, H + RIDGE / 2, (roadZ + Z1) / 2], col, 'Fabric', { shape: 1, collide: 0, yaw: Math.PI });
    }
    rec([0.4, 4, 0.4], [cx, H + RIDGE + 2, roadZ], POLE, 'Metal', { collide: 0 });
    rec([1.2, 1.2, 1.2], [cx, H + RIDGE + 4.2, roadZ], GOLD, 'Metal', { shape: 3, collide: 0 });
    rec([2.4, 1.2, 0.1], [cx + 1.4, H + RIDGE + 3.2, roadZ], t % 2 ? GOLD : RED, 'Fabric', { collide: 0 });
  }
  // marquees over the way in and out
  for (const [x, face, text] of [[X0 - 0.8, 'Left', 'HOORAY FOR HOLLYWOOD'], [X1 + 0.8, 'Right', 'HOLLYWOOD BOULEVARD']]) {
    box([0.4, H + 3, 0.4], [x, 0, roadZ - 9.5], POLE, 'Metal');
    box([0.4, H + 3, 0.4], [x, 0, roadZ + 9.5], POLE, 'Metal');
    sign(text, [0.3, 2.6, 19], [x, H + 1.8, roadZ], 0x1a1a1c, GOLD, face, 0, 'GothamBlack');
    for (let k = 0; k < 10; k++) rec([0.4, 0.4, 0.4], [x + (face === 'Left' ? -0.2 : 0.2), H + 3.3, roadZ - 9 + k * 2], 0xfff2c0, 'Neon', { shape: 3, collide: 0 });
  }

  // inside, south: the Hollywood Hills painted on a sky backdrop, and the sign
  rec([len - 1, H - 0.6, 0.3], [xm, (H - 0.6) / 2, Z0 + 0.5], 0x9cc8ec, 'SmoothPlastic', { collide: 0 });
  // the hills are painted flats, like a stage set: two wedges per hill
  const HILL = 0x6e6838, HILL2 = 0x5c5a30;
  [[-16, 30, 6, HILL2], [10, 44, 8.6, HILL], [40, 36, 6.8, HILL2], [62, 26, 5.4, HILL]].forEach(([x, w, h, col], k) => {
    const z = Z0 + 1.4 + (k % 2) * 0.6;
    rec([0.3, h, w / 2], [x - w / 4, h / 2, z], col, 'SmoothPlastic', { shape: 1, collide: 0, yaw: Math.PI / 2 });
    rec([0.3, h, w / 2], [x + w / 4, h / 2, z], col, 'SmoothPlastic', { shape: 1, collide: 0, yaw: -Math.PI / 2 });
  });
  // the big white letters, standing on the hillside (the board behind them
  // is not drawn, only the letters)
  sign('HOLLYWOOD', [20, 2.6, 0.1], [10, 5.2, Z0 + 2.4], HILL, 0xffffff, 'Back', 0, 'GothamBlack');
  data.hidden.push(data.static.length - 1);
  // film gear by the road: a camera on a tripod, a light, director's chairs
  // and a clapperboard
  const edgeS = roadZ - 6;
  const camX = -6;
  for (const a of [0, 2.1, 4.2]) rec([0.15, 4, 0.15], [camX + Math.sin(a) * 0.7, 2, edgeS + Math.cos(a) * 0.7], 0x2a2a2e, 'Metal', { collide: 0, rot: yawPitch(a, 0.18) });
  rec([1.6, 1.4, 2.4], [camX, 4.6, edgeS], 0x1e1e22, 'Metal', { collide: 0 });
  rec([1, 1, 1.2], [camX, 4.7, edgeS + 1.6], 0x2a2a2e, 'Metal', { shape: 2, collide: 0, rot: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
  for (const k of [0, 1]) rec([0.4, 1.6, 1.6], [camX - 0.5 + k, 5.9, edgeS - 0.2], 0x1e1e22, 'Metal', { shape: 2, collide: 0 });
  for (const lx of [18, 44]) {
    rec([0.2, 6, 0.2], [lx, 3, edgeS], 0x2a2a2e, 'Metal', { collide: 0 });
    rec([2, 2, 1.4], [lx, 6.4, edgeS], 0x2a2a2e, 'Metal', { collide: 0 });
    rec([1.8, 1.8, 0.1], [lx, 6.4, edgeS + 0.75], 0xfff6d8, 'Neon', { collide: 0 });
  }
  for (const [x, col] of [[2, RED], [5, 0x2a2a2e]]) {
    box([1.8, 1.6, 1.6], [x, 0, edgeS], 0x6a4a30, 'Wood', { collide: 0 });
    rec([1.8, 1.4, 0.15], [x, 2.4, edgeS - 0.75], col, 'Fabric', { collide: 0 });
  }
  sign('SCENE 1  ·  TAKE 1', [2.6, 1.8, 0.2], [9, 1.4, edgeS], 0x1a1a1c, 0xffffff, 'Back', 0, 'GothamBold');
  // inside, north: the Walk of Fame and a movie premiere
  const edgeN = roadZ + 5;
  rec([len - 2, 0.3, 2.8], [xm, 0.15, edgeN + 1.4], 0x6a6266, 'Slate');
  for (let x = X0 + 4; x < X1 - 2; x += 6) sign('★', [2, 0.06, 2], [x, 0.33, edgeN + 1.4], 0xd88a98, GOLD, 'Top', 0, 'GothamBlack');
  const tx = 20, tz = Z1 - 0.6;
  rec([28, H - 1, 0.6], [tx, (H - 1) / 2, tz], 0x8a1c22, 'SmoothPlastic', { collide: 0 });
  rec([30, 1.2, 1], [tx, H - 1, tz - 0.3], GOLD, 'Metal', { collide: 0 });
  sign('GRAND BENTON THEATRE', [24, 1.6, 0.2], [tx, 7.6, tz - 0.4], 0x1a1a1c, GOLD, 'Front', 0, 'GothamBlack');
  sign('WORLD PREMIERE TONIGHT', [18, 1.4, 0.2], [tx, 5.6, tz - 0.4], 0xfaf3e0, RED, 'Front', 0, 'GothamBold');
  for (let k = 0; k < 14; k++) rec([0.35, 0.35, 0.35], [tx - 9.1 + k * 1.4, 4.6, tz - 0.5], 0xfff2c0, 'Neon', { shape: 3, collide: 0 });
  rec([6, 4, 0.2], [tx, 2, tz - 0.35], 0x1a1414, 'SmoothPlastic', { collide: 0 });
  // red carpet with velvet ropes on gold posts
  rec([6, 0.08, tz - 0.3 - edgeN], [tx, 0.34, (edgeN + tz - 0.3) / 2], RED, 'Fabric', { collide: 0 });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 2; k++) box([0.3, 2.2, 0.3], [tx + side * 3.6, 0.3, edgeN + 0.5 + k * 2.4], GOLD, 'Metal', { collide: 0 });
    rec([0.15, 0.15, 2.4], [tx + side * 3.6, 2.1, edgeN + 1.7], RED, 'Fabric', { collide: 0 });
  }
  // prop palms (short enough for the tent)
  for (const px of [-20, 28, 36, 64]) {
    const pz = roadZ - 7.5;
    rec([0.9, 7, 0.9], [px, 3.5, pz], 0x9a7a54, 'Wood', { shape: 5, collide: 0 });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, r = yawPitch(a, 0.45);
      rec([1.3, 0.15, 4.4], [px + r[2] * 2.2, 7.1 + r[5] * 2.2, pz + r[8] * 2.2], 0x3a7a32, 'Grass', { collide: 0, rot: r });
    }
  }
  // the golden statue on a pedestal
  const sx = 54, sz = roadZ - 7.2;
  box([2.6, 2.4, 2.6], [sx, 0.3, sz], 0x1a1a1c, 'SmoothPlastic', { collide: 0 });
  rec([1.2, 3.6, 1.2], [sx, 4.5, sz], GOLD, 'Metal', { shape: 5, collide: 0 });
  rec([1.1, 1.1, 1.1], [sx, 6.9, sz], GOLD, 'Metal', { shape: 3, collide: 0 });
  sign('BEST RIDE', [2.4, 0.7, 0.1], [sx, 1.6, sz + 1.36], 0x1a1a1c, GOLD, 'Back', 0, 'GothamBold');
  // a street sign and strings of lights under the roof
  rec([0.25, 7, 0.25], [X0 + 6, 3.5, edgeN + 0.6], 0x2a2e36, 'Metal', { collide: 0 });
  sign('HOLLYWOOD BLVD', [6, 0.9, 0.12], [X0 + 6, 6.6, edgeN + 0.6], 0x1e6a3a, 0xffffff, 'Front', 0, 'GothamBold');
  for (const z of [roadZ - 4, roadZ + 4]) {
    rec([len - 2, 0.06, 0.06], [xm, H - 0.6, z], 0x202024, 'Metal', { collide: 0 });
    for (let x = X0 + 2, k = 0; x < X1 - 1; x += 3, k++) rec([0.45, 0.45, 0.45], [x, H - 0.95, z], k % 3 ? 0xfff2c0 : 0xffc860, 'Neon', { shape: 3, collide: 0 });
  }
}
