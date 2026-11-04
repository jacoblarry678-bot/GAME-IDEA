// Krewe of Benton: Mardi Gras Spectacular, a new live show inside Stage 23
// (the middle soundstage backstage). Guests line up on the turf in front of
// the stage under purple, green and gold bunting, go in through the big
// door and take a seat in a tiered grandstand facing a French Quarter
// street built across the back of the stage. Then the krewe parades in:
// the King's float turning on its turntable, the jester's float rolling
// out to the footlights, a gator float snapping its jaws, the big-head
// brass band bouncing along the front, dancers spinning on the wings,
// beads raining down from the fly loft, and confetti cannons for the
// finale.
//
// It is built as a ride, so the line, the wait times, Express, the crew
// and the app all work as usual: the "vehicle" is the grandstand, which
// holds still (it creeps less than a meter over the whole show) while the
// floats and performers move round it.
import * as THREE from 'three';
import { queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { stageX, STAGE_Z, STAGE } from './backstage.js';

export const SHOW_ID = 'MardiGrasShow';
const G = 0.1;
const PURPLE = 0x6a2a9a, GREEN = 0x1e8a3a, GOLD = 0xf0c030, WHITE = 0xf4f4f0, BLACK = 0x101012;
const BEADS = [PURPLE, GREEN, GOLD];
const SKIN = [0xf0c8a0, 0xc08a60, 0x8a5a3a, 0xe0b090];
const SX = stageX(2); // Stage 23, the middle stage
const IN = { x0: SX - STAGE.W / 2 + 1.2, x1: SX + STAGE.W / 2 - 1.2, z0: STAGE_Z - STAGE.D + 1.2, z1: STAGE_Z - 1.2 };
const DECK = { z0: IN.z0 + 2, z1: -664, top: G + 2.4 }; // the show stage at the back
const SEATS_Z = -640; // the grandstand's front row
const DUR = 110; // the show, in seconds

export function buildMardiShow(data) {
  const { add, box, sign, cf, mi } = helpers(data);
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const strand = (a, b, sag, color, size = 0.45) => {
    const n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      neon([size, size, size], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t], Array.isArray(color) ? color[k % color.length] : color, { shape: 3 });
    }
  };

  // ---- outside: the stage dressed for Mardi Gras
  const F = STAGE_Z + 1.4; // (just in front of the pilasters)
  sign([42, 6, 0.3], [SX, G + 28, F], 0x1a0a24, 'Back', [['KREWE OF BENTON', 0, 0.02, 1, 0.6, GOLD], ['MARDI GRAS SPECTACULAR  ·  NOW SHOWING', 0, 0.64, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  for (const [y, c] of [[24.4, PURPLE], [25, GREEN], [31.6, GOLD]]) neon([42, 0.5, 0.2], [SX, G + y, F + 0.1], c);
  // a giant mask over the door
  add([12, 4, 0.5], [SX, G + 14, F + 0.4], PURPLE, 'SmoothPlastic', { collide: 0 });
  for (const dx of [-2.8, 2.8]) add([2.8, 1.4, 0.3], [SX + dx, G + 14.3, F + 0.7], BLACK, 'SmoothPlastic', { collide: 0 });
  neon([12.4, 0.4, 0.3], [SX, G + 16.1, F + 0.6], GOLD);
  neon([12.4, 0.4, 0.3], [SX, G + 11.9, F + 0.6], GOLD);
  for (let k = -3; k <= 3; k++) add([1, 7, 0.3], [SX + k * 0.9, G + 19.5, F + 0.3], BEADS[(k + 3) % 3], 'Fabric', { collide: 0, rot: RZ(k * 0.16) });
  // bunting along the stage front
  for (let k = 0; k < 4; k++) strand([SX - 36 + k * 18, G + 20, F + 1], [SX - 18 + k * 18, G + 20, F + 1], 2.2, BEADS);

  // ---- the line: switchbacks on purple carpet in front of the stage
  const ROWZ = [-516, -522, -528, -534, -540, -546, -552];
  const XL = SX - 30, XR = SX + 30;
  add([XR - XL + 8, 0.12, ROWZ[ROWZ.length - 1] - ROWZ[0] - 8], [SX, G + 0.06, (ROWZ[0] + ROWZ[ROWZ.length - 1]) / 2], 0x3a1a4a, 'Fabric', { collide: 0 });
  const entrance = [XL - 4, -506];
  const fwd = [entrance, [XL - 4, ROWZ[0]]];
  ROWZ.forEach((z, k) => {
    const [xa, xb] = k % 2 === 0 ? [XL, XR] : [XR, XL];
    if (k > 0) fwd.push([xa, z]);
    fwd.push([xb, z]);
  });
  const lastX = fwd[fwd.length - 1][0];
  fwd.push([lastX, -562], [SX, -570], [SX, STAGE_Z - 2], [SX, -616], [SX + 14, -626], [SX + 14, SEATS_Z + 2]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 1, [0, 1], G);
  const railX = (xa, xb, z) => {
    add([xb - xa, 0.25, 0.25], [(xa + xb) / 2, G + 3.2, z], GOLD, 'Metal', { collide: 0 });
    add([xb - xa, 0.18, 0.18], [(xa + xb) / 2, G + 1.9, z], PURPLE, 'Metal', { collide: 0 });
    const n = Math.max(1, Math.round((xb - xa) / 6));
    for (let k = 0; k <= n; k++) box([0.3, 3.1, 0.3], [xa + ((xb - xa) * k) / n, G, z], 0x2a2a2e, 'Metal');
  };
  for (let k = 0; k < ROWZ.length - 1; k++) {
    const z = (ROWZ[k] + ROWZ[k + 1]) / 2;
    // the gap is at the end where the line turns
    if (k % 2 === 0) railX(XL - 5, XR - 4, z); else railX(XL + 4, XR + 5, z);
  }
  railX(XL - 1, XR + 5, ROWZ[0] + 3);
  railX(XL - 5, XR - 4, ROWZ[ROWZ.length - 1] - 3.4); // (open at the end, where the line heads for the door)
  // bead strands and lanterns over the rows
  for (let k = 0; k < ROWZ.length; k += 2) strand([XL - 6, G + 9, ROWZ[k]], [XR + 6, G + 9, ROWZ[k]], 1.6, BEADS, 0.35);
  for (const x of [XL - 6, XR + 6]) for (let k = 0; k < ROWZ.length; k += 2) {
    box([0.4, 9, 0.4], [x, G, ROWZ[k]], 0x2a2a2e, 'Metal', { collide: 0 });
    neon([1, 1, 1], [x, G + 9.4, ROWZ[k]], BEADS[k % 3], { shape: 3 });
  }
  // the entrance sign and the wait time
  box([0.4, 8, 0.4], [entrance[0] - 3, G, entrance[1]], 0x2a2a2e, 'Metal');
  sign([9, 3, 0.3], [entrance[0] - 3, G + 9, entrance[1]], 0x1a0a24, 'Back', [['MARDI GRAS SPECTACULAR', 0, 0.05, 1, 0.5, GOLD], ['LIVE SHOW  ·  ENTRANCE', 0, 0.6, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
  box([0.6, 6, 0.6], [entrance[0] + 6, G, entrance[1] + 1], 0x2e3238, 'Metal');
  const waitPart = add([9.6, 6, 0.8], [entrance[0] + 6, G + 9, entrance[1] + 1], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: SHOW_ID });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Studios', seed: 33, cf: cf(entrance[0] + 2, G, entrance[1] - 2, Math.PI) });

  // ---- inside: a French Quarter street across the back of the stage
  add([IN.x1 - IN.x0, 0.2, IN.z1 - IN.z0], [SX, G + 0.1, (IN.z0 + IN.z1) / 2], 0x1a1220, 'SmoothPlastic', { collide: 0 });
  box([IN.x1 - IN.x0 - 8, DECK.top - G, DECK.z1 - DECK.z0], [SX, G, (DECK.z0 + DECK.z1) / 2], 0x2a1a12, 'WoodPlanks');
  neon([IN.x1 - IN.x0 - 8, 0.2, 0.3], [SX, DECK.top - 0.3, DECK.z1 + 0.1], GOLD);
  // footlights
  for (let x = IN.x0 + 6; x < IN.x1 - 5; x += 3) neon([0.8, 0.4, 0.5], [x, DECK.top + 0.2, DECK.z1 - 0.6], 0xfff0c8);
  const facades = [[0x4a7a8a, 'BOURBON ST'], [0xc87a5a, 'ROYAL ST'], [0xe8c860, 'CAFE DU BENTON'], [0x6a9a6a, 'JAZZ HALL'], [0xd86a8a, 'PRALINES'], [0x8a6ab8, 'ROYAL ST']];
  facades.forEach(([color, name], k) => {
    const x = IN.x0 + 1 + k * 12 + 6, z = IN.z0 + 1.2;
    box([12, 26, 1.2], [x, DECK.top, z], color, 'Brick', { collide: 0 });
    for (const y of [3, 11, 19]) for (const dx of [-3.4, 0, 3.4]) {
      add([2, 4.6, 0.2], [x + dx, DECK.top + y + 2.4, z + 0.7], (k + dx + y) % 3 ? 0xffd890 : 0x2a1a12, (k + dx + y) % 3 ? 'Neon' : 'Wood', { collide: 0 });
      add([2.4, 0.3, 0.3], [x + dx, DECK.top + y + 5, z + 0.75], WHITE, 'SmoothPlastic', { collide: 0 });
    }
    // wrought-iron balconies with railings
    for (const y of [9.6, 17.6]) {
      add([11.4, 0.4, 2.4], [x, DECK.top + y, z + 1.8], 0x1a1a1c, 'Metal', { collide: 0 });
      add([11.4, 0.2, 0.2], [x, DECK.top + y + 1.6, z + 2.9], 0x1a1a1c, 'Metal', { collide: 0 });
      for (let b = -5.4; b <= 5.4; b += 0.6) add([0.08, 1.6, 0.08], [x + b, DECK.top + y + 0.8, z + 2.9], 0x1a1a1c, 'Metal', { collide: 0 });
      strand([x - 5.6, DECK.top + y + 1.8, z + 3], [x + 5.6, DECK.top + y + 1.8, z + 3], 0.4, BEADS, 0.3);
    }
    sign([6, 1.2, 0.2], [x, DECK.top + 8.6, z + 0.8], 0x1a1a1c, 'Back', [[name, 0, 0, 1, 1, WHITE, 'GothamBold']]);
  });
  // gas lamps along the street
  for (let x = IN.x0 + 8; x < IN.x1 - 6; x += 12) {
    box([0.3, 7, 0.3], [x, DECK.top, IN.z0 + 5], 0x1a1a1c, 'Metal', { collide: 0 });
    neon([0.9, 1.3, 0.9], [x, DECK.top + 7.4, IN.z0 + 5], 0xffd890);
  }
  // the proscenium: purple and gold, LAISSEZ LES BONS TEMPS ROULER
  for (const sx of [-1, 1]) {
    box([3, 26, 2], [SX + sx * 32, G, DECK.z1 - 1], PURPLE, 'SmoothPlastic', { collide: 0 });
    neon([0.3, 26, 0.3], [SX + sx * 30.4, G + 13, DECK.z1 + 0.05], GOLD);
  }
  add([67, 4, 2], [SX, G + 27, DECK.z1 - 1], PURPLE, 'SmoothPlastic', { collide: 0 });
  sign([60, 3, 0.3], [SX, G + 27, DECK.z1 + 0.1], PURPLE, 'Back', [['LAISSEZ LES BONS TEMPS ROULER!', 0, 0, 1, 1, GOLD]], { glow: true });
  for (let k = 0; k < 3; k++) strand([SX - 30 + k * 20, G + 24.6, DECK.z1 + 0.6], [SX - 10 + k * 20, G + 24.6, DECK.z1 + 0.6], 1.6, BEADS, 0.4);
  // string lights over the audience, from the stage to the back wall
  for (const x of [SX - 24, SX - 8, SX + 8, SX + 24]) strand([x, G + 26, DECK.z1 + 1], [x, G + 22, IN.z1 - 2], 3, [0xffd890, 0xffb060, 0xfff0c8], 0.35);
  // show lights: purple, green and gold washes on the stage, warm house lights
  for (let x = IN.x0 + 8; x < IN.x1 - 4; x += 14) {
    light(x, 14, -676, BEADS[Math.round(x / 14 + 20) % 3]);
    light(x, 8, -660, 0xffd890);
  }
  for (const [x, z] of [[SX - 18, -640], [SX + 18, -640], [SX, -625]]) light(x, 14, z, 0xffb070);
  // the back of the house: the sound and light desk, an exit sign
  box([8, 3.2, 3], [SX - 22, G, -620], 0x1a1a1c, 'Metal');
  for (let k = 0; k < 6; k++) neon([0.6, 0.2, 0.4], [SX - 25 + k * 1.2, G + 3.3, -620.8], [0x40d060, 0xf0c040, 0xe03030][k % 3]);
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Studios', seed: 34, cf: cf(SX - 22, G, -617, Math.PI) });

  // ---- the grandstand (the "vehicle"): four tiers of benches, 32 seats
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const grand = [], seats = [];
  for (let k = 0; k < 4; k++) {
    const y = 0.9 * k, z = k * 2.6;
    grand.push(pp(0, [20, y + 0.5, 2.6], [0, (y + 0.5) / 2, z], 0x2a1a24, 'WoodPlanks'));
    grand.push(pp(0, [17, 0.4, 1], [0, y + 1.3, z + 0.3], BEADS[k % 3], 'Fabric'));
    for (const x of [-7.5, -2.5, 2.5, 7.5]) grand.push(pp(0, [0.3, 0.8, 0.3], [x, y + 0.9, z + 0.3], 0x2a2a2e, 'Metal'));
    for (let s = 0; s < 8; s++) seats.push([-7 + s * 2, y + 1.5 + 1.3, z + 0.3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  grand.push(pp(0, [20.4, 0.6, 0.3], [0, 0.6, -1.3], GOLD, 'Neon'));
  for (const sx of [-1, 1]) {
    grand.push(pp(0, [0.4, 4.8, 10.4], [sx * 10.2, 2.4, 3.9], PURPLE, 'SmoothPlastic'));
    grand.push(pp(0, [0.5, 0.3, 10.4], [sx * 10.2, 4.95, 3.9], GOLD, 'Metal'));
  }
  grand.push(pp(0, [20.8, 6, 0.4], [0, 3, 9.2], PURPLE, 'SmoothPlastic'));
  grand.push(pp(0, [20.8, 0.4, 0.5], [0, 6.1, 9.2], GOLD, 'Metal'));

  // a "track" that barely moves: the grandstand faces the stage (-z) and
  // creeps 0.6 m over the whole show
  const N = 41, LEN = 0.6;
  const pos = [], tan = [], up = [], cum = [], times = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    pos.push(SX, G, SEATS_Z - LEN * u);
    tan.push(0, 0, -1);
    up.push(0, 1, 0);
    cum.push(LEN * u);
    times.push(DUR * u);
  }
  const track = { length: LEN, cum, pos, tan, up, times };
  const e = [SX, G, SEATS_Z, 1, 0, 0, 0, 1, 0, 0, 0, 1]; // the track's frame: the seats face -z, the stage
  const cars = [{ pivot: e, parts: grand }];

  // ---- the parade: floats, the big-head band, dancers, beads
  const props = [], extras = {};
  const addProp = (name, parts, at, prop) => {
    extras[name] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at, ...prop });
  };
  // a big papier-mache head on a little body, with a hat (and an instrument)
  // (facing +z, the audience; f = -1 faces the other way)
  const bigHead = (skin, hat, body, extra = [], f = 1) => [
    pp(0, [1.6, 3, 1], [0, 1.5, 0], body, 'Fabric'),
    pp(3, [3, 3.2, 3], [0, 4.6, 0], skin, 'SmoothPlastic'),
    pp(0, [0.5, 0.5, 0.2], [-0.6, 4.9, f * 1.45], BLACK, 'SmoothPlastic'), pp(0, [0.5, 0.5, 0.2], [0.6, 4.9, f * 1.45], BLACK, 'SmoothPlastic'),
    pp(0, [1.2, 0.3, 0.2], [0, 3.9, f * 1.45], 0xc8322d, 'SmoothPlastic'),
    pp(5, [2.2, 1.6, 2.2], [0, 6.6, 0], hat, 'Fabric'), pp(5, [3.4, 0.2, 3.4], [0, 5.9, 0], hat, 'Fabric'),
    ...extra,
  ];
  // the King's float, turning slowly on its turntable
  const kingParts = [
    pp(5, [16, 1.4, 16], [0, 0.7, 0], PURPLE, 'SmoothPlastic'), pp(5, [16.4, 0.4, 16.4], [0, 1.5, 0], GOLD, 'Metal'),
    pp(0, [6, 3, 5], [0, 3, 2], GOLD, 'Metal'), pp(0, [4, 5, 1], [0, 5.5, 4.3], PURPLE, 'Fabric'),
    ...bigHead(SKIN[0], GOLD, PURPLE).map((p) => { const q = p.slice(); q[5] += 3.6; q[6] += 2; return q; }),
    // the crown, and a giant crown on the front of the float
    ...[0, 1, 2, 3, 4].map((k) => pp(0, [0.5, 1.2, 0.5], [-1.2 + k * 0.6, 11.2, 2 - 1.2], GOLD, 'Neon')),
    pp(0, [6, 2.4, 1], [0, 3.2, -6.4], GOLD, 'Metal'),
    ...[0, 1, 2, 3, 4].map((k) => pp(3, [0.9, 0.9, 0.9], [-2.4 + k * 1.2, 5, -6.4], [0xe83a3a, GREEN, PURPLE, GREEN, 0xe83a3a][k], 'Neon')),
    ...Array.from({ length: 16 }, (_, k) => pp(3, [0.5, 0.5, 0.5], [Math.cos(k * 0.39) * 7.6, 2, Math.sin(k * 0.39) * 7.6], BEADS[k % 3], 'Neon')),
  ];
  addProp('KingFloat', kingParts, [SX, DECK.top, -678], { kind: 'turn', speed: 0.3 });
  // the jester's float rolls out to the footlights and back
  const jester = [
    pp(0, [9, 1.4, 10], [0, 0.9, 0], GREEN, 'SmoothPlastic'), pp(0, [9.4, 0.4, 10.4], [0, 1.7, 0], GOLD, 'Metal'),
    ...[[-3.6, -4], [3.6, -4], [-3.6, 4], [3.6, 4]].map(([x, z]) => pp(2, [0.8, 1.6, 1.6], [x + Math.sign(x) * 1, 0.8, z], 0x1a1a1a, 'Rubber')),
    ...bigHead(SKIN[1], PURPLE, GOLD, [], -1).map((p) => { const q = p.slice(); q[5] += 1.9; return q; }), // (the lunge turns it round)
    ...[-1, 0, 1].map((k) => pp(3, [0.7, 0.7, 0.7], [k * 1.8, 9.6 - Math.abs(k) * 0.8, 0], BEADS[k + 1], 'Neon')),
  ];
  addProp('JesterFloat', jester, [SX - 20, DECK.top, -676], { kind: 'lunge', dir: [0, 1], reach: 5, period: 11 });
  // the gator float, and its snapping head
  const gator = [
    pp(0, [9, 1.4, 12], [0, 0.9, 0], 0x2a6a3a, 'SmoothPlastic'), pp(0, [9.4, 0.4, 12.4], [0, 1.7, 0], PURPLE, 'Metal'),
    pp(0, [5, 3, 9], [0, 3.4, -1], 0x3a8a3a, 'SmoothPlastic'),
    ...[-1.6, 0, 1.6].map((x) => pp(1, [0.8, 1, 1.4], [x, 5.4, -1 + x], 0x2a5a2a, 'SmoothPlastic')),
    pp(0, [2.4, 1.2, 4], [0, 1.8, -7], 0x3a8a3a, 'SmoothPlastic'), // the tail
  ];
  addProp('GatorFloat', gator, [SX + 20, DECK.top, -678], { kind: 'swing', amp: 0.05, freq: 1.2 });
  const gatorHead = [
    pp(0, [3.4, 1.2, 6], [0, 0, 3], 0x3a8a3a, 'SmoothPlastic'),
    ...[-1, 1].map((sx) => pp(3, [0.9, 0.9, 0.9], [sx * 1.1, 0.9, 0.8], 0xf2e020, 'Neon')),
    ...[-1.2, -0.4, 0.4, 1.2].map((x) => pp(1, [0.3, 0.5, 0.3], [x, -0.7, 5.4], WHITE, 'SmoothPlastic')),
  ];
  addProp('GatorHead', gatorHead, [SX + 20, DECK.top + 4.4, -673.5], { kind: 'swing', amp: 0.28, freq: 2.2, axis: 'x' });
  // the big-head brass band, bouncing along the front of the stage
  const horn = (x) => [pp(5, [0.6, 2.4, 0.6], [x, 2.8, 1.2], GOLD, 'Metal', RX(-1.2)), pp(5, [1.4, 0.4, 1.4], [x, 3.4, 2.6], GOLD, 'Metal', RX(-1.2))];
  [[-12, 0], [-4, 1], [4, 2], [12, 3]].forEach(([dx, k]) => {
    const tuba = k === 3 ? [pp(3, [2.6, 2.6, 2.6], [0.6, 3.6, 0.6], GOLD, 'Metal'), pp(5, [2.4, 0.4, 2.4], [0.6, 5.3, 0.6], GOLD, 'Metal')] : horn(0.6);
    addProp(`Band${k + 1}`, bigHead(SKIN[k], [PURPLE, GREEN, GOLD, 0xc8322d][k], [WHITE, PURPLE, GREEN, PURPLE][k], tuba), [SX + dx, DECK.top + 0.4, -667], { kind: 'piston', amp: 0.35, freq: 6 + k * 0.4, phase: k });
  });
  // dancers spinning on the wings
  for (const [sx, k] of [[-1, 0], [1, 1]]) addProp(`Dancer${k + 1}`, bigHead(SKIN[2 + k], GOLD, [GREEN, PURPLE][k], [pp(5, [3.4, 0.3, 3.4], [0, 1.2, 0], BEADS[k], 'Fabric')]), [SX + sx * 26, DECK.top, -670], { kind: 'turn', speed: 1.6 * sx });
  // beads tossed down from the fly loft, in front of the audience
  for (let k = 0; k < 8; k++) {
    const strandParts = Array.from({ length: 10 }, (_, j) => pp(3, [0.45, 0.45, 0.45], [Math.cos(j * 0.63) * 0.9, Math.sin(j * 0.63) * 1.6, 0], BEADS[(k + j) % 3], 'Neon'));
    addProp(`Beads${k + 1}`, strandParts, [SX - 21 + k * 6, 24, -652 - (k % 3) * 3], { kind: 'fall', drop: 21, period: 3.2 + (k % 4) * 0.5, phase: k * 0.29 });
  }
  // a giant mask swaying over the stage
  const mask = [
    pp(0, [14, 5, 0.6], [0, 0, 0], PURPLE, 'SmoothPlastic'), pp(0, [3.4, 1.8, 0.3], [-3.4, 0.4, -0.4], BLACK, 'SmoothPlastic'), pp(0, [3.4, 1.8, 0.3], [3.4, 0.4, -0.4], BLACK, 'SmoothPlastic'),
    pp(0, [14.4, 0.4, 0.4], [0, 2.4, -0.3], GOLD, 'Neon'), pp(0, [14.4, 0.4, 0.4], [0, -2.4, -0.3], GOLD, 'Neon'),
    ...[-2, -1, 0, 1, 2].map((k) => pp(0, [1, 7, 0.3], [k * 1.2, 5.4, 0.2], BEADS[(k + 2) % 3], 'Fabric', RZ(k * 0.18))),
  ];
  addProp('Mask', mask, [SX, 20, -688], { kind: 'swing', amp: 0.08, freq: 0.7 });
  const extrasNames = props.map((p) => p.name);

  // ---- the crew: an usher on each side
  const crew = {
    stopCars: [1], stops: [cf(SX + 12, G, SEATS_Z + 2, Math.PI / 2)], restraint: 'none', attendants: 1, routes: [[1]],
    console: cf(SX - 22, G, -621.6, Math.PI), operator: cf(SX - 22, G, -618.8, Math.PI),
    homes: [cf(SX + 13, G, SEATS_Z - 2, Math.PI / 2)],
    exit: cf(SX + 30, G, -612, -Math.PI / 2),
  };

  // ---- the show, as a ride
  const origin = [SX, 0, -660];
  const ride = {
    id: SHOW_ID, kind: 'motionsim', track, duration: DUR,
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: 1, carSpacing: 0, cars, seats: [seats],
    capacity: seats.length, party: seats.length, noExtended: true, queue: qpath, trackStyle: null, extras, extrasNames, crew,
    motionsim: { H: 0, scenes: [], props },
  };
  data.rides.push(ride);
  // confetti cannons over the stage (in the grandstand's frame: the stage
  // is ahead, at -z)
  const cues = [
    [0.2, 'mardi', [0, 14, -30]], [0.5, 'mardi', [-14, 14, -32]], [0.55, 'mardi', [14, 14, -32]],
    [0.86, 'mardi', [0, 16, -26]], [0.9, 'mardi', [-16, 16, -30]], [0.92, 'mardi', [16, 16, -30]],
  ];
  const rides = data.config.Rides;
  rides.push({
    id: SHOW_ID, name: 'Krewe of Benton: Mardi Gras Spectacular', land: 'Studios', category: 'Live Show', thrill: 1, kind: 'darkride', carStyle: 'coaster',
    description: 'NEW for Mardi Gras, inside Stage 23 backstage: take a seat in the grandstand as the Krewe of Benton parades down a French Quarter street - the King\'s float, the jester, a snapping gator, the big-head brass band, beads raining down and a confetti finale. Laissez les bons temps rouler!',
    baseWait: 20, origin, entrance: [entrance[0], 0, entrance[1]], exit: [SX + 42, 0, STAGE_Z - 6], yaw: 0, layout: SHOW_ID,
    cars: 1, carSpacing: 0, colors: [PURPLE, GREEN, GOLD], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'The Mardi Gras show is in Stage 23 - grab a seat!', 'Laissez les bons temps rouler!'];
  return { ride, gate: { x: entrance[0], z: entrance[1] }, indoor: IN };
}

// a toast the first time you come near the show
export class MardiShowSite {
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
      this.hooks.toast('NEW: Krewe of Benton: Mardi Gras Spectacular is showing in Stage 23! Join the line, grab a seat in the grandstand and catch some beads.', 'reward');
    }
  }
}
