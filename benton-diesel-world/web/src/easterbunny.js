// Meet the Easter Bunny, in Stage 23 (the middle soundstage backstage) for
// Easter, in place of the Mardi Gras show. Guests line up on the turf in
// front of the stage under pastel bunting and go in through a giant egg
// over the door to a spring garden: a picket fence, a flower meadow, a
// painted sky, and the Easter Bunny (the park's own: white fur, a lavender
// waistcoat and bow tie, pink ears and a basket of eggs) on a throne of
// giant eggs. Each group takes the photo bench in front of him: he hops,
// waves, the chicks bob in their nest, the eggs bounce on the lawn, the
// butterflies circle the flowers, and pastel confetti pops for the photo.
//
// Like the Mardi Gras show it is built as a ride (so the line, waits,
// Express and the crew work): the "vehicle" is the photo bench, which
// holds still while the garden moves.
import * as THREE from 'three';
import { queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { stageX, STAGE_Z, STAGE } from './backstage.js';

export const MEET_ID = 'MeetEasterBunny';
const G = 0.1;
const PINK = 0xff9ac8, MINT = 0x7ad8a8, BUTTER = 0xf8e070, LILAC = 0xb08aff, SKY = 0x8ad0ff, WHITE = 0xf8f8f4, FUR = 0xf4f2ee, GRASS = 0x5ab85a;
const PASTELS = [PINK, MINT, BUTTER, LILAC, SKY];
const SX = stageX(2); // Stage 23
const IN = { x0: SX - STAGE.W / 2 + 1.2, x1: SX + STAGE.W / 2 - 1.2, z0: STAGE_Z - STAGE.D + 1.2, z1: STAGE_Z - 1.2 };
const BENCH_Z = -640; // the photo bench's front row
const DUR = 50;

export function buildEasterBunny(data) {
  const { add, box, sign, cf, mi } = helpers(data);
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  // a decorated egg: white, with three painted bands
  const egg = (x, y, z, h, colors, o = {}) => {
    add([h * 0.74, h, h * 0.74], [x, y, z], WHITE, 'SmoothPlastic', { shape: 3, collide: 0, ...o });
    colors.forEach((c, k) => add([h * 0.76 - Math.abs(k - 1) * h * 0.12, h * 0.1, h * 0.76 - Math.abs(k - 1) * h * 0.12], [x, y + (k - 1) * h * 0.24, z], c, 'SmoothPlastic', { shape: 5, collide: 0 }));
  };
  const bunting = (a, b, sag) => {
    const n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.4));
    const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      add([0.1, 1.2, 1.2], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.5, a[2] + (b[2] - a[2]) * t], PASTELS[k % 5], 'Fabric', { shape: 1, collide: 0, rot: [Math.cos(yaw), 0, Math.sin(yaw), 0, -1, 0, -Math.sin(yaw), 0, Math.cos(yaw)] });
    }
  };

  // ---- outside: the stage dressed for Easter, a giant egg over the door
  const F = STAGE_Z + 1.4;
  sign([42, 6, 0.3], [SX, G + 28, F], 0x3a2a4a, 'Back', [['MEET THE EASTER BUNNY', 0, 0.04, 1, 0.58, BUTTER], ['HAPPY EASTER  ·  STAGE 23  ·  SAY CHEESE!', 0, 0.64, 1, 0.32, WHITE, 'GothamBold']], { glow: true });
  for (const [y, c] of [[24.4, PINK], [25, MINT], [31.6, LILAC]]) neon([42, 0.5, 0.2], [SX, G + y, F + 0.1], c);
  egg(SX, G + 15, F + 1.2, 9, [PINK, BUTTER, MINT], {});
  for (let k = 0; k < 4; k++) bunting([SX - 36 + k * 18, G + 20, F + 1], [SX - 18 + k * 18, G + 20, F + 1], 2);
  // giant eggs either side of the door
  for (const [dx, cs] of [[-12, [LILAC, PINK, SKY]], [12, [MINT, BUTTER, PINK]]]) egg(SX + dx, G + 3.4, F + 3, 6.6, cs);

  // ---- the line: switchbacks on pastel carpet in front of the stage
  const ROWZ = [-516, -522, -528, -534, -540, -546, -552];
  const XL = SX - 30, XR = SX + 30;
  add([XR - XL + 8, 0.12, ROWZ[ROWZ.length - 1] - ROWZ[0] - 8], [SX, G + 0.06, (ROWZ[0] + ROWZ[ROWZ.length - 1]) / 2], 0x9ad89a, 'Fabric', { collide: 0 });
  const entrance = [XL - 4, -506];
  const fwd = [entrance, [XL - 4, ROWZ[0]]];
  ROWZ.forEach((z, k) => {
    const [xa, xb] = k % 2 === 0 ? [XL, XR] : [XR, XL];
    if (k > 0) fwd.push([xa, z]);
    fwd.push([xb, z]);
  });
  const lastX = fwd[fwd.length - 1][0];
  fwd.push([lastX, -562], [SX, -570], [SX, STAGE_Z - 2], [SX, -616], [SX + 12, -626], [SX + 12, BENCH_Z + 2]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 1, [0, 1], G);
  const picket = (xa, xb, z) => {
    add([xb - xa, 0.3, 0.2], [(xa + xb) / 2, G + 2.4, z], WHITE, 'Wood', { collide: 0 });
    add([xb - xa, 0.3, 0.2], [(xa + xb) / 2, G + 1.2, z], WHITE, 'Wood', { collide: 0 });
    for (let x = xa; x <= xb + 0.01; x += 1.2) box([0.4, x % 6 < 1.2 ? 3.2 : 2.9, 0.15], [x, G, z], WHITE, 'Wood', { collide: Math.abs((x - xa) % 6) < 1.2 ? 1 : 0 });
  };
  for (let k = 0; k < ROWZ.length - 1; k++) {
    const z = (ROWZ[k] + ROWZ[k + 1]) / 2;
    if (k % 2 === 0) picket(XL - 5, XR - 4, z); else picket(XL + 4, XR + 5, z);
  }
  picket(XL - 1, XR + 5, ROWZ[0] + 3);
  picket(XL - 5, XR - 4, ROWZ[ROWZ.length - 1] - 3.4);
  for (let k = 0; k < ROWZ.length; k += 2) bunting([XL - 6, G + 8, ROWZ[k]], [XR + 6, G + 8, ROWZ[k]], 1.4);
  for (const x of [XL - 6, XR + 6]) for (let k = 0; k < ROWZ.length; k += 2) {
    box([0.4, 8, 0.4], [x, G, ROWZ[k]], WHITE, 'Wood', { collide: 0 });
    egg(x, G + 8.8, ROWZ[k], 1.6, [PASTELS[k % 5], PASTELS[(k + 2) % 5], PASTELS[(k + 4) % 5]]);
  }
  box([0.4, 8, 0.4], [entrance[0] - 3, G, entrance[1]], WHITE, 'Wood');
  sign([9, 3, 0.3], [entrance[0] - 3, G + 9, entrance[1]], 0x3a2a4a, 'Back', [['MEET THE EASTER BUNNY', 0, 0.05, 1, 0.5, BUTTER], ['MEET & GREET  ·  ENTRANCE', 0, 0.6, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [entrance[0] + 6, G, entrance[1] + 1], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [entrance[0] + 6, G + 9, entrance[1] + 1], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: MEET_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Studios', seed: 33, cf: cf(entrance[0] + 2, G, entrance[1] - 2, Math.PI) });

  // ---- inside: the spring garden
  add([IN.x1 - IN.x0, 0.2, IN.z1 - IN.z0], [SX, G + 0.1, (IN.z0 + IN.z1) / 2], GRASS, 'Grass', { collide: 0 });
  // a painted sky round the back and sides, with clouds and a rainbow
  add([IN.x1 - IN.x0, 30, 0.4], [SX, G + 15, IN.z0 + 0.4], SKY, 'SmoothPlastic', { collide: 0 });
  for (const sx of [-1, 1]) add([0.4, 30, 50], [SX + sx * (STAGE.W / 2 - 1.6), G + 15, IN.z0 + 25], SKY, 'SmoothPlastic', { collide: 0 });
  for (const [x, y] of [[-24, 22], [-6, 26], [16, 21], [28, 27]]) for (let k = 0; k < 3; k++) add([5 - k, 3 - k * 0.6, 0.3], [SX + x + k * 3, y + (k === 1 ? 1 : 0), IN.z0 + 0.8], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 });
  [0xff6a6a, 0xffb05a, 0xffe06a, 0x7ad87a, 0x6ab0ff, 0xb08aff].forEach((c, k) => {
    for (let j = 0; j <= 16; j++) {
      const a = Math.PI * (j / 16), r = 22 - k * 1.1;
      add([1.6, 1.1, 0.2], [SX + Math.cos(a) * r, G + 4 + Math.sin(a) * r * 0.9, IN.z0 + 1 + k * 0.02], c, 'Neon', { collide: 0, rot: RZ(a - Math.PI / 2) });
    }
  });
  // flowers, a picket fence and an egg tree
  for (let k = 0; k < 70; k++) {
    const x = IN.x0 + 3 + ((k * 37) % 100) / 100 * (IN.x1 - IN.x0 - 6), z = IN.z0 + 4 + ((k * 61) % 100) / 100 * 24;
    add([0.15, 1.2, 0.15], [x, G + 0.7, z], 0x3a8a3a, 'Grass', { collide: 0 });
    add([0.8, 0.5, 0.8], [x, G + 1.5, z], PASTELS[k % 5], 'SmoothPlastic', { shape: 3, collide: 0 });
    add([0.3, 0.3, 0.3], [x, G + 1.6, z], BUTTER, 'Neon', { shape: 3, collide: 0 });
  }
  for (let x = IN.x0 + 2; x < IN.x1 - 1; x += 1.2) add([0.4, 2.4, 0.15], [x, G + 1.2, -658], WHITE, 'Wood', { collide: 0 });
  add([IN.x1 - IN.x0 - 4, 0.3, 0.2], [SX, G + 1.8, -658], WHITE, 'Wood', { collide: 0 });
  const tree = [SX - 22, -676];
  box([1.4, 10, 1.4], [tree[0], G, tree[1]], 0x8a5a3a, 'Wood', { shape: 5, collide: 0 });
  add([12, 8, 12], [tree[0], G + 13, tree[1]], 0xffc8e0, 'Grass', { shape: 3, collide: 0 });
  for (let k = 0; k < 12; k++) { const a = k * 0.52; egg(tree[0] + Math.cos(a) * 5.4, G + 10 + (k % 3) * 1.6, tree[1] + Math.sin(a) * 5.4, 1.2, [PASTELS[k % 5], WHITE, PASTELS[(k + 2) % 5]]); }
  // the throne of giant eggs
  for (const [dx, h, cs] of [[-5, 8, [PINK, BUTTER, LILAC]], [0, 11, [LILAC, MINT, PINK]], [5, 8, [SKY, PINK, MINT]]]) egg(SX + dx, G + h / 2, -680, h, cs);
  box([10, 1.6, 6], [SX, G, -674], LILAC, 'SmoothPlastic', { collide: 0 });
  add([10.4, 0.3, 6.4], [SX, G + 1.75, -674], BUTTER, 'Neon', { collide: 0 });
  sign([16, 2.4, 0.3], [SX, G + 13.4, -678], 0x3a2a4a, 'Back', [['HAPPY EASTER!', 0, 0, 1, 1, BUTTER]], { glow: true });
  // lights: soft spring sun on the garden
  for (let x = IN.x0 + 8; x < IN.x1 - 4; x += 14) light(x, 14, -672, [0xfff0c8, 0xffd8f0, 0xd8ffe8][Math.round(x / 14 + 20) % 3]);
  for (const [x, z] of [[SX - 14, -648], [SX + 14, -648], [SX, -630]]) light(x, 12, z, 0xfff4d8);
  // the photographer's spot at the back, and an usher
  box([1.4, 3, 1.4], [SX - 16, G, -626], 0x2a2a2e, 'Metal', { collide: 0 });
  add([1.6, 1.2, 1.4], [SX - 16, G + 3.6, -626], 0x1a1a1c, 'Metal', { collide: 0 });
  add([0.6, 0.6, 0.6], [SX - 16, G + 3.6, -626.8], 0xfff4c0, 'Neon', { shape: 2, collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Studios', seed: 34, cf: cf(SX - 18, G, -624, Math.PI) });

  // ---- the photo bench (the "vehicle"): two rows of six
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const bench = [], seats = [];
  for (let k = 0; k < 2; k++) {
    const y = 0.9 * k, z = k * 2.6;
    bench.push(pp(0, [14, y + 0.5, 2.6], [0, (y + 0.5) / 2, z], 0xf4f0e8, 'WoodPlanks'));
    bench.push(pp(0, [12.4, 0.4, 1], [0, y + 1.3, z + 0.3], [PINK, MINT][k], 'Fabric'));
    bench.push(pp(0, [12.4, 1.4, 0.3], [0, y + 2.1, z + 1.0], WHITE, 'Wood'));
    for (let s = 0; s < 6; s++) seats.push([-5 + s * 2, y + 1.5 + 1.3, z + 0.3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  bench.push(pp(0, [14.4, 0.3, 0.3], [0, 0.6, -1.3], BUTTER, 'Neon'));
  const N = 41, LEN = 0.4;
  const pos = [], tan = [], up = [], cum = [], times = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    pos.push(SX, G, BENCH_Z - LEN * u);
    tan.push(0, 0, -1);
    up.push(0, 1, 0);
    cum.push(LEN * u);
    times.push(DUR * u);
  }
  const track = { length: LEN, cum, pos, tan, up, times };
  const cars = [{ pivot: [SX, G, BENCH_Z, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: bench }];

  // ---- the Easter Bunny and his garden, moving
  const props = [], extras = {};
  const addProp = (name, parts, at, prop) => {
    extras[name] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at, ...prop });
  };
  // the bunny (facing +z, the bench): fur, waistcoat, bow tie, ears, a basket
  const bunny = [
    pp(3, [3.6, 4.6, 3], [0, 3.2, 0], FUR, 'Fabric'),
    pp(0, [3.4, 2.6, 0.4], [0, 3.4, 1.35], LILAC, 'Fabric'),
    pp(0, [1.2, 0.6, 0.3], [0, 4.8, 1.6], PINK, 'SmoothPlastic'),
    pp(3, [2.8, 2.6, 2.6], [0, 6.6, 0.2], FUR, 'Fabric'),
    pp(3, [1.2, 0.9, 0.6], [0, 6.2, 1.4], WHITE, 'Fabric'),
    pp(3, [0.45, 0.35, 0.3], [0, 6.5, 1.6], PINK, 'SmoothPlastic'),
    pp(3, [0.4, 0.5, 0.2], [-0.6, 7.1, 1.35], 0x2a2a3a, 'SmoothPlastic'), pp(3, [0.4, 0.5, 0.2], [0.6, 7.1, 1.35], 0x2a2a3a, 'SmoothPlastic'),
    pp(3, [0.12, 0.12, 0.1], [-0.5, 7.25, 1.46], WHITE, 'Neon'), pp(3, [0.12, 0.12, 0.1], [0.7, 7.25, 1.46], WHITE, 'Neon'),
    pp(3, [0.5, 0.3, 0.2], [-1, 6.4, 1.1], 0xffb8d0, 'SmoothPlastic'), pp(3, [0.5, 0.3, 0.2], [1, 6.4, 1.1], 0xffb8d0, 'SmoothPlastic'),
    ...[-1, 1].flatMap((sx) => [
      pp(3, [0.8, 4.2, 0.5], [sx * 0.7, 9.4, -0.1], FUR, 'Fabric', RZ(-sx * 0.12)),
      pp(3, [0.4, 3.2, 0.2], [sx * 0.7, 9.4, 0.12], PINK, 'Fabric', RZ(-sx * 0.12)),
      pp(3, [1.4, 0.8, 2.4], [sx * 0.9, 0.4, 0.6], FUR, 'Fabric'),
    ]),
    pp(0, [0.7, 2.6, 0.7], [-1.9, 3.6, 0.6], FUR, 'Fabric', RZ(0.3)),
    pp(5, [1.8, 1.2, 1.8], [-2.1, 2.2, 1.0], 0xc8a060, 'Wood'),
    ...[0, 1, 2, 3].map((k) => pp(3, [0.5, 0.7, 0.5], [-2.5 + (k % 2) * 0.7, 2.9, 0.7 + Math.floor(k / 2) * 0.6], PASTELS[k], 'SmoothPlastic')),
    pp(3, [1.1, 1.1, 1.1], [0, 2.2, -1.7], WHITE, 'Fabric'),
  ];
  addProp('Bunny', bunny, [SX, G + 1.8, -674], { kind: 'piston', amp: 0.45, freq: 3.2, phase: 0 });
  // his waving arm (a paw at the end), from the shoulder
  addProp('BunnyWave', [pp(0, [0.7, 2.8, 0.7], [0, 1.3, 0], FUR, 'Fabric'), pp(3, [0.9, 0.9, 0.9], [0, 2.8, 0], WHITE, 'Fabric')], [SX + 1.8, G + 1.8 + 4.6, -673.6], { kind: 'swing', amp: 0.5, freq: 4 });
  // chicks bobbing in a nest
  box([4, 0.8, 3], [SX + 12, G, -668], 0xc8a060, 'Wood', { collide: 0 });
  for (let k = 0; k < 3; k++) {
    addProp(`Chick${k + 1}`, [pp(3, [1, 1, 1], [0, 0, 0], 0xffe060, 'Fabric'), pp(3, [0.7, 0.7, 0.7], [0, 0.8, 0.2], 0xffe060, 'Fabric'), pp(0, [0.3, 0.2, 0.4], [0, 0.8, 0.6], 0xff9a3a, 'SmoothPlastic'), pp(3, [0.15, 0.15, 0.1], [-0.2, 0.95, 0.5], 0x1a1a1a, 'SmoothPlastic'), pp(3, [0.15, 0.15, 0.1], [0.2, 0.95, 0.5], 0x1a1a1a, 'SmoothPlastic')],
      [SX + 11 + k, G + 1.4, -668], { kind: 'piston', amp: 0.25, freq: 5 + k, phase: k * 1.3 });
  }
  // eggs bouncing on the lawn, a golden egg turning behind the throne
  for (let k = 0; k < 6; k++) {
    const c = [PASTELS[k % 5], WHITE, PASTELS[(k + 3) % 5]];
    addProp(`Egg${k + 1}`, [pp(3, [1.2, 1.6, 1.2], [0, 0, 0], WHITE, 'SmoothPlastic'), ...c.map((col, j) => pp(5, [1.24 - Math.abs(j - 1) * 0.2, 0.16, 1.24 - Math.abs(j - 1) * 0.2], [0, (j - 1) * 0.38, 0], col, 'SmoothPlastic'))],
      [SX - 18 + k * 7 + (k > 2 ? 8 : 0), G + 1.2, -664 - (k % 2) * 3], { kind: 'piston', amp: 0.6, freq: 4 + (k % 3), phase: k });
  }
  addProp('GoldenEgg', [pp(3, [3.6, 4.8, 3.6], [0, 0, 0], 0xf0c040, 'Neon'), pp(5, [3.7, 0.3, 3.7], [0, 0, 0], WHITE, 'SmoothPlastic')], [SX, G + 16.5, -684], { kind: 'turn', speed: 0.8 });
  // butterflies circling the flowers
  for (let k = 0; k < 4; k++) addProp(`Butterfly${k + 1}`, [pp(0, [1, 0.1, 0.8], [3.4, 0, 0], PASTELS[k], 'Neon', RZ(0.4)), pp(0, [1, 0.1, 0.8], [2.4, 0, 0], PASTELS[(k + 2) % 5], 'Neon', RZ(-0.4))], [SX - 24 + k * 16, G + 4 + (k % 2) * 2, -682 + (k % 2) * 6], { kind: 'turn', speed: 1.2 * (k % 2 ? 1 : -1), phase: k });
  const extrasNames = props.map((p) => p.name);

  // ---- the crew
  const crew = {
    stopCars: [1], stops: [cf(SX + 9, G, BENCH_Z + 2, Math.PI / 2)], restraint: 'none', attendants: 1, routes: [[1]],
    console: cf(SX - 16, G, -623.4, Math.PI), operator: cf(SX - 16, G, -621, Math.PI),
    homes: [cf(SX + 10, G, BENCH_Z - 2, Math.PI / 2)],
    exit: cf(SX + 30, G, -612, -Math.PI / 2),
  };

  // ---- the meet & greet, as a ride
  const origin = [SX, 0, -660];
  const ride = {
    id: MEET_ID, kind: 'motionsim', track, duration: DUR,
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: 1, carSpacing: 0, cars, seats: [seats],
    capacity: seats.length, party: seats.length, noExtended: true, queue: qpath, trackStyle: null, extras, extrasNames, crew,
    motionsim: { H: 0, scenes: [], props },
  };
  data.rides.push(ride);
  // the photo: pastel confetti over the bench, and again as you leave
  const cues = [[0.55, 'easter', [0, 9, -16]], [0.6, 'easter', [-8, 9, -18]], [0.62, 'easter', [8, 9, -18]], [0.92, 'easter', [0, 10, -22]]];
  data.config.Rides.push({
    id: MEET_ID, name: 'Meet the Easter Bunny', land: 'Studios', category: 'Meet & Greet', thrill: 1, kind: 'darkride', carStyle: 'coaster',
    description: "Happy Easter! In Stage 23 backstage: line up through the giant egg, step into the spring garden and take the photo bench right in front of the Easter Bunny on his throne of giant eggs. He'll hop, he'll wave, the chicks will bob - and smile for the confetti photo!",
    baseWait: 15, origin, entrance: [entrance[0], 0, entrance[1]], exit: [SX + 42, 0, STAGE_Z - 6], yaw: 0, layout: MEET_ID,
    cars: 1, carSpacing: 0, colors: [PINK, MINT, BUTTER], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'The Easter Bunny is in Stage 23 - go say hi!', 'Happy Easter!'];
  return { ride, gate: { x: entrance[0], z: entrance[1] }, indoor: IN };
}

// a toast the first time you come near
export class EasterBunnySite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 45) {
      this.told = true;
      this.hooks.toast('The Easter Bunny is in Stage 23! Join the line, take a seat on the photo bench and say hello.', 'reward');
    }
  }
}
