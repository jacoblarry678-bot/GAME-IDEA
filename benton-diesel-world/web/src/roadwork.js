// Road work on the Benton Parkway by the Grand Hotel: a new water main going
// in along the north verge, east of the hotel's car park, between the park's
// wall and the road. A trench behind jersey barriers, an excavator digging at
// its end, a dump truck, a road roller and fresh asphalt on the shoulder, a
// light tower, an arrow board, cones and drums down the shoulder, amber
// beacons turning, a crew in hard hats - and ROAD WORK AHEAD signs for the
// traffic both ways. Everything stays off the driving lanes (the westbound
// lane runs at z 649), so the traffic and the shuttles go on by.
import { helpers } from './wolverine.js';
import { PARKWAY } from './resort.js';

const G = 0.02; // the verge (the road's top is 0.34)
const ROAD = 0.34;
const Z = { wall: 629.7, edge: 643, cones: 644.6 }; // the park's wall, the road's edge, the cone line
const X0 = 584, X1 = 716; // the work zone, along the verge
const ORANGE = 0xff6a1a, YELLOW = 0xf2c418, INK = 0x14141a, STEEL = 0x8a8e96, DIRT = 0x6a4a2e, CONCRETE = 0xb8b4ac, WHITE = 0xf4f4f0, AMBERG = 0xffa020;

export function buildRoadWork(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  data.spinners = data.spinners || [];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const AXLE_Z = [0, 0, 1, 0, 1, 0, -1, 0, 0]; // a cylinder (along x) turned to run along z
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // an amber beacon that turns: a dark base, a glass dome, a bright reflector going round
  const beacon = (x, y, z) => {
    add([0.7, 0.25, 0.7], [x, y + 0.12, z], INK, 'Metal', { collide: 0, shape: 5 });
    add([0.62, 0.55, 0.62], [x, y + 0.52, z], AMBERG, 'Glass', { collide: 0, shape: 5, trans: 0.45 });
    data.spinners.push({ name: 'Beacon', pivot: cf(x, y + 0.52, z), axis: 'Y', speed: 7, parts: [pp(0, [0.26, 0.4, 0.12], [0.16, 0, 0], 0xffb030, 'Neon')] });
  };
  const cone = (x, z) => {
    add([0.9, 0.12, 0.9], [x, ROAD + 0.06, z], INK, 'Rubber', { collide: 0 });
    add([0.62, 1.2, 0.62], [x, ROAD + 0.72, z], ORANGE, 'SmoothPlastic', { collide: 0, shape: 5 });
    add([0.66, 0.2, 0.66], [x, ROAD + 0.86, z], WHITE, 'SmoothPlastic', { collide: 0, shape: 5 });
  };
  const drum = (x, z, y = G) => {
    box([1, 1.7, 1], [x, y, z], ORANGE, 'SmoothPlastic', { shape: 5 });
    for (const h of [0.5, 1.1]) add([1.04, 0.22, 1.04], [x, y + h, z], WHITE, 'SmoothPlastic', { collide: 0, shape: 5 });
  };
  // a diamond road sign on legs: an orange diamond, black words
  const roadSign = (x, z, face, yaw, lines) => {
    for (const d of [-0.9, 0.9]) box([0.12, 3, 0.12], [x + Math.cos(yaw) * d, G, z - Math.sin(yaw) * d], STEEL, 'Metal', { collide: 0 });
    const n = face === 'Back' || face === 'Front' ? 0 : 1;
    add([3.2, 3.2, 0.1], [x, G + 4.2, z], ORANGE, 'SmoothPlastic', { collide: 0, rot: n ? mulRot(RY(Math.PI / 2), RZ(Math.PI / 4)) : RZ(Math.PI / 4) });
    sign(n ? [0.12, 2.1, 2.1] : [2.1, 2.1, 0.12], [x, G + 4.2, z], ORANGE, face, lines.map((t, i) => [t, 0, i / lines.length, 1, 1 / lines.length, INK]));
  };

  // ======== the shoulder: fresh asphalt, steel plates, cones down the edge
  add([X1 - 600, 0.04, Z.cones - 0.6 - Z.edge], [(600 + X1) / 2, ROAD + 0.02, (Z.edge + Z.cones - 0.6) / 2], 0x1c1c20, 'Asphalt', { collide: 0 });
  for (const x of [640, 646]) add([5.4, 0.08, 1.2], [x, ROAD + 0.04, Z.edge + 0.6], 0x4a4c52, 'DiamondPlate', { collide: 0 });
  for (let x = X0 + 4; x <= X1 + 2; x += 5) cone(x, Z.cones);
  // (the taper, for the westbound traffic coming up to it)
  for (let k = 1; k <= 4; k++) cone(X1 + 2 + k * 5, Z.cones - k * 0.35);

  // ======== the trench: dug along the verge behind jersey barriers, the
  // spoil heaped against the wall, shoring in the trench, a new pipe
  const T = { x0: 616, x1: 668, z0: 632.6, z1: 637.4 };
  add([T.x1 - T.x0 + 2, 0.06, T.z1 - T.z0 + 2], [(T.x0 + T.x1) / 2, G + 0.03, (T.z0 + T.z1) / 2], DIRT, 'Ground', { collide: 0 });
  add([T.x1 - T.x0, 0.08, T.z1 - T.z0], [(T.x0 + T.x1) / 2, G + 0.05, (T.z0 + T.z1) / 2], 0x120c08, 'SmoothPlastic', { collide: 0 });
  for (let x = T.x0 + 3; x < T.x1; x += 7) {
    for (const z of [T.z0 + 0.1, T.z1 - 0.1]) add([2.4, 0.9, 0.12], [x, G + 0.35, z], 0x2a6ad8, 'Metal', { collide: 0 });
    add([0.14, 0.14, T.z1 - T.z0], [x, G + 0.5, (T.z0 + T.z1) / 2], YELLOW, 'Metal', { collide: 0 });
  }
  for (let x = T.x0 + 2; x < T.x1 - 6; x += 8) add([7, 2.2 + (x % 3) * 0.4, 2.6], [x + 3, G + 0.4, 631.2], DIRT, 'Ground', { collide: 0, shape: 3 });
  add([30, 1.2, 1.2], [638, G + 0.6, (T.z0 + T.z1) / 2], 0x2a5ac8, 'SmoothPlastic', { collide: 0, shape: 2 });
  // barriers between the trench and the road, and fencing round it
  for (let x = T.x0 - 2; x < T.x1 + 2; x += 4) {
    box([3.8, 0.4, 1.2], [x + 1.9, G, 639.8], CONCRETE, 'Concrete');
    box([3.8, 1.2, 0.7], [x + 1.9, G + 0.4, 639.8], CONCRETE, 'Concrete');
    add([0.3, 0.2, 0.06], [x + 1.9, G + 1.3, 640.16], ORANGE, 'Neon', { collide: 0 });
  }
  for (const [xa, za, xb, zb] of [[T.x0 - 2, 631, T.x0 - 2, 638.6], [T.x1 + 2, 631, T.x1 + 2, 638.6]]) {
    const len = Math.hypot(xb - xa, zb - za);
    add([0.1, 1.3, len], [(xa + xb) / 2, G + 0.75, (za + zb) / 2], ORANGE, 'Fabric', { trans: 0.3 });
    for (const t of [0, 0.5, 1]) box([0.14, 1.5, 0.14], [xa + (xb - xa) * t, G, za + (zb - za) * t], STEEL, 'Metal', { collide: 0 });
  }
  for (const [x, z] of [[T.x0 - 3.4, 639.8], [T.x1 + 3.4, 639.8]]) drum(x, z);
  // pipe sections waiting to go in, stacked on timbers
  for (const [dx, dy] of [[0, 0], [1.3, 0], [0.65, 1.1]]) add([9, 1.2, 1.2], [604, G + 0.9 + dy, 632.2 + dx], 0x2a5ac8, 'SmoothPlastic', { shape: 2, collide: 0 });
  for (const x of [600.5, 607.5]) add([0.5, 0.3, 3], [x, G + 0.15, 632.8], 0x6a4a2a, 'Wood', { collide: 0 });
  data.hidden = data.hidden || [];
  data.hidden.push(box([9, 2.4, 2.6], [604, G, 632.8], INK, 'SmoothPlastic')); // (the stack's footprint, solid but unseen)

  // ======== the excavator, at the trench's east end, bucket down in it
  const EX = [676, 635.6];
  for (const dz of [-1.6, 1.6]) box([6, 1.1, 1.1], [EX[0], G, EX[1] + dz], INK, 'Rubber');
  box([3.2, 0.6, 3.2], [EX[0], G + 1.1, EX[1]], 0x2a2a2e, 'Metal', { shape: 5 });
  box([5, 2, 3.6], [EX[0] + 0.6, G + 1.7, EX[1]], YELLOW, 'Metal');
  box([2, 2.4, 1.8], [EX[0] - 1.2, G + 3.7, EX[1] - 0.8], YELLOW, 'Metal');
  add([1.9, 1.6, 0.06], [EX[0] - 1.2, G + 5, EX[1] - 1.72], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  add([0.06, 1.6, 1.6], [EX[0] - 2.22, G + 5, EX[1] - 0.8], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  add([2.4, 1.4, 3.8], [EX[0] + 2.6, G + 4.4, EX[1]], 0x2a2a2e, 'Metal', { collide: 0 }); // the counterweight
  beacon(EX[0] - 1.2, G + 6.1, EX[1] - 0.8);
  // boom up and out over the trench, the stick down into it, the bucket
  const limb = (ax, ay, bx, by, w, h, color) => {
    const len = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax);
    add([len, h, w], [(ax + bx) / 2, (ay + by) / 2, EX[1] + 0.6], color, 'Metal', { collide: 0, rot: RZ(a) });
  };
  limb(EX[0] - 0.6, G + 3.4, EX[0] - 6, G + 8, 0.9, 1, YELLOW);
  limb(EX[0] - 6, G + 8, EX[0] - 9.2, G + 1.6, 0.7, 0.8, YELLOW);
  limb(EX[0] - 2.6, G + 4.6, EX[0] - 5, G + 7, 0.3, 0.3, STEEL); // (the ram)
  add([1.4, 1.2, 1.4], [EX[0] - 9.6, G + 1, EX[1] + 0.6], 0x3a3a3e, 'Metal', { collide: 0, shape: 1, rot: RY(Math.PI / 2) });

  // ======== the dump truck, west of the trench, loaded with spoil
  const TR = [606, 637.6];
  for (const x of [TR[0] - 3.6, TR[0] + 1.6, TR[0] + 3.4]) for (const dz of [-1.5, 1.5]) add([0.8, 1.8, 1.8], [x, G + 0.9, TR[1] + dz], INK, 'Rubber', { shape: 2, rot: AXLE_Z, collide: 0 });
  box([10.4, 0.6, 2.6], [TR[0], G + 1, TR[1]], 0x2a2a2e, 'Metal');
  box([2.6, 2.8, 3], [TR[0] - 4, G + 1.6, TR[1]], 0xe8a020, 'Metal');
  add([0.06, 1.2, 2.6], [TR[0] - 5.32, G + 3.4, TR[1]], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  box([7, 2.4, 3.2], [TR[0] + 1.6, G + 1.6, TR[1]], YELLOW, 'Metal');
  add([6.2, 1.6, 2.6], [TR[0] + 1.6, G + 4.1, TR[1]], DIRT, 'Ground', { collide: 0, shape: 3 });
  beacon(TR[0] - 4, G + 4.4, TR[1]);

  // ======== the road roller, east of the excavator, by the fresh asphalt
  const RO = [694, 637.8];
  add([1.6, 1.6, 3.4], [RO[0] - 2.6, G + 0.8, RO[1]], 0x4a4c52, 'Metal', { shape: 2, rot: AXLE_Z });
  add([1.6, 1.6, 3.4], [RO[0] + 2.6, G + 0.8, RO[1]], 0x4a4c52, 'Metal', { shape: 2, rot: AXLE_Z });
  box([4, 1.2, 3], [RO[0], G + 0.9, RO[1]], YELLOW, 'Metal');
  add([1, 0.8, 1], [RO[0] + 0.4, G + 2.5, RO[1]], INK, 'Fabric', { collide: 0 });
  for (const [dx, dz] of [[-1, -1.2], [1.4, -1.2], [-1, 1.2], [1.4, 1.2]]) add([0.12, 2.2, 0.12], [RO[0] + dx, G + 3.2, RO[1] + dz], INK, 'Metal', { collide: 0 });
  add([3, 0.15, 2.8], [RO[0] + 0.2, G + 4.35, RO[1]], YELLOW, 'Metal', { collide: 0 });
  beacon(RO[0] + 0.2, G + 4.4, RO[1]);

  // ======== a light tower and a generator, a site box, a portable toilet
  const LT = [706, 633];
  box([3.2, 1, 1.8], [LT[0], G + 0.6, LT[1]], YELLOW, 'Metal');
  for (const dz of [-1, 1]) add([0.9, 0.9, 0.3], [LT[0], G + 0.45, LT[1] + dz], INK, 'Rubber', { shape: 2, rot: AXLE_Z, collide: 0 });
  add([0.3, 10, 0.3], [LT[0], G + 6.6, LT[1]], STEEL, 'Metal', { collide: 0 });
  add([3.6, 0.2, 0.3], [LT[0], G + 11.6, LT[1]], STEEL, 'Metal', { collide: 0 });
  for (const dx of [-1.3, -0.45, 0.45, 1.3]) {
    add([0.8, 0.6, 0.4], [LT[0] + dx, G + 11.9, LT[1] + 0.2], INK, 'Metal', { collide: 0 });
    add([0.66, 0.46, 0.06], [LT[0] + dx, G + 11.9, LT[1] + 0.42], 0xfff2d0, 'Neon', { collide: 0 });
  }
  data.tags.ParkLamp.push([LT[0], G + 11.9, LT[1] + 0.6, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  box([2.6, 1.6, 1.6], [588, G, 632.2], 0x3a8a3a, 'Metal');
  add([1, 0.4, 0.3], [588, G + 1.8, 632.2], STEEL, 'Metal', { collide: 0, shape: 5 });
  box([8, 3, 3.4], [596, G + 0.4, 632], 0xf0ece0, 'Metal');
  for (const x of [593, 599]) add([1.6, 1, 0.06], [x, G + 2.2, 633.72], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  sign([5, 0.8, 0.1], [596, G + 3.9, 633.74], 0x1e4ab0, 'Back', [['SITE OFFICE', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  box([1.6, 3, 1.6], [712, G, 631.6], 0x2a6ad8, 'SmoothPlastic');
  add([1.8, 0.3, 1.8], [712, G + 3.15, 631.6], WHITE, 'SmoothPlastic', { collide: 0 });

  // ======== the arrow board, at the head of the taper, for the westbound traffic
  const AB = [X1 + 1, 641.2];
  box([3.4, 0.8, 1.6], [AB[0], G + 0.5, AB[1]], ORANGE, 'Metal');
  for (const dz of [-0.8, 0.8]) add([0.8, 0.8, 0.3], [AB[0], G + 0.4, AB[1] + dz], INK, 'Rubber', { shape: 2, rot: AXLE_Z, collide: 0 });
  add([0.2, 3, 0.2], [AB[0], G + 2.8, AB[1]], STEEL, 'Metal', { collide: 0 });
  add([0.3, 2.2, 4], [AB[0], G + 5, AB[1]], INK, 'Metal', { collide: 0 });
  for (const dz of [-1.6, -0.8, 0, 0.8, 1.6]) add([0.1, 0.36, 0.36], [AB[0] + 0.2, G + 5 + (Math.abs(dz) > 1 ? 0.6 : 0), AB[1] + dz], 0xffd040, 'Neon', { collide: 0, shape: 3 });
  for (const dz of [-1.6, 1.6]) add([0.1, 0.36, 0.36], [AB[0] + 0.2, G + 4.4, AB[1] + dz], 0xffd040, 'Neon', { collide: 0, shape: 3 });
  beacon(AB[0], G + 6.1, AB[1]);

  // ======== the signs: the project board, ROAD WORK AHEAD both ways, the
  // end of it, the hotel still open
  for (const x of [585, 593]) box([0.3, 5, 0.3], [x, G, 640.6], STEEL, 'Metal', { collide: 0 });
  sign([9, 3.6, 0.2], [589, G + 5.4, 640.6], 0x1e4ab0, 'Back', [
    ['BENTON PARKWAY IMPROVEMENTS', 0, 0.02, 1, 0.3, WHITE],
    ['NEW WATER MAIN  ·  SHOULDER RESURFACING', 0, 0.36, 1, 0.22, YELLOW, 'GothamBold'],
    ['THANK YOU FOR YOUR PATIENCE  ·  BENTON DIESEL WORLD', 0, 0.66, 1, 0.2, WHITE, 'GothamBold'],
  ]);
  // westbound traffic (driving -x) reads signs facing +x; eastbound (+x) reads signs facing -x
  roadSign(748, 640, 'Right', Math.PI / 2, ['ROAD', 'WORK', 'AHEAD']);
  roadSign(574, 640, 'Right', Math.PI / 2, ['END', 'ROAD', 'WORK']);
  roadSign(548, 671, 'Left', Math.PI / 2, ['ROAD', 'WORK', 'AHEAD']);
  roadSign(740, 671, 'Left', Math.PI / 2, ['END', 'ROAD', 'WORK']);
  for (const x of [732, 742]) box([0.3, 4, 0.3], [x, G, 640.8], STEEL, 'Metal', { collide: 0 });
  sign([0.2, 2, 8], [737, G + 4.4, 640.8], WHITE, 'Right', [['SHOULDER CLOSED', 0, 0, 1, 0.5, INK], ['SLOW  ·  WORKERS AHEAD', 0, 0.5, 1, 0.5, 0xd01818, 'GothamBold']]);
  for (const x of [577, 581]) box([0.3, 3.4, 0.3], [x, G, 640.8], STEEL, 'Metal', { collide: 0 });
  sign([0.2, 1.6, 5], [579, G + 3.6, 640.8], 0x1e6a3a, 'Left', [['GRAND HOTEL', 0, 0, 1, 0.55, WHITE], ['ACCESS OPEN  <', 0, 0.55, 1, 0.45, WHITE, 'GothamBold']]);

  // ======== the crew, in hard hats
  const crew = (kind, x, z, yaw, seed) => data.staffSpots.push({ role: 'construction', kind, land: 'Plaza', seed, cf: cf(x, G, z, yaw) });
  crew('work', 630, 638.4, Math.PI, 3);
  crew('work', 648, 631.6, 0, 7);
  crew('idle', 664, 638.6, -Math.PI / 2, 11);
  crew('work', 601, 640.4, Math.PI / 2, 5);
  crew('idle', 712, 639.6, -Math.PI / 2, 9);
  return { zone: { x0: X0, x1: X1 + 22, z0: Z.wall, z1: Z.cones + 0.5 }, lanes: { wb: PARKWAY.wb, eb: PARKWAY.eb } };
}

function mulRot(a, b) {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return o;
}
