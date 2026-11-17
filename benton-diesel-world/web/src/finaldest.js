// Construction has started on Final Destination: Death's Design, the first
// house of next fall's Benton Haunt. It gets a brand-new soundstage (Stage
// 6) on the empty land east of the backstage lot. The steel frame is up and
// the back half is clad and roofed, with a tower crane lifting the next roof
// panel; out in the yard the sets are being built: a Flight 180 fuselage on
// cradles with its tail fin on the ground, a log truck from Route 23, a
// derailed Devil's Flight coaster car, a tanning bed, North Bay Bridge
// girders and an airport departures board. A banner on the stage and a
// board by the Velocity City wall tease it from inside the park.
import { helpers } from './wolverine.js';
import { makeFinder } from './haunt.js';

export const FD_SITE = { x0: 254, x1: 372, z0: -700, z1: -410 };
const STAGE6 = { x0: 270, x1: 350, z0: -692, z1: -598, H: 44 };
const G = 0.1;
const RED = 0xc81e1e, BLOOD = 0x8a0a0a, WHITE = 0xf4f4f0, BLACK = 0x0c0c0e, STEEL = 0x8a3a22, NAVY = 0x1a2a5a, YELLOW = 0xf2c818;
const CLAD = 0x3a3c42;

export function buildFinalDestination(data) {
  const { add, box, sign, cf } = helpers(data);
  const S = FD_SITE, T = STAGE6;
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const crew = (kind, x, y, z, yaw, seed = 0) => data.staffSpots.push({ role: 'construction', kind, land: 'Studios', seed, cf: cf(x, y, z, yaw) });
  const HALF_PI = Math.PI / 2;

  data.flatZones = [...(data.flatZones || []), { ...S, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], S, 10));
  add([S.x1 - S.x0, 1, S.z1 - S.z0], [(S.x0 + S.x1) / 2, G - 0.5, (S.z0 + S.z1) / 2], 0x4e4c48, 'Asphalt');

  // ---- Stage 6: the slab, the steel frame, the back half clad and roofed
  const cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, W = T.x1 - T.x0, D = T.z1 - T.z0;
  box([W + 4, 0.8, D + 4], [cx, G, cz], 0xa8a49c, 'Concrete');
  const top = G + 0.8;
  const zs = [];
  for (let k = 0; k <= 9; k++) zs.push(T.z0 + (D * k) / 9);
  for (let x = T.x0; x <= T.x1 + 0.1; x += 10) for (const z of [T.z0, T.z1]) box([1.4, T.H, 1.4], [x, top, z], STEEL, 'Metal');
  for (const z of zs) for (const x of [T.x0, T.x1]) box([1.4, T.H, 1.4], [x, top, z], STEEL, 'Metal');
  const roofed = T.z0 + D * 0.45; // roof and walls are on up to here
  for (const z of zs) {
    add([W, 2.4, 1], [cx, top + T.H - 1.2, z], STEEL, 'Metal', { collide: 0 });
    if (z < roofed + 1) for (let x = T.x0 + 10; x < T.x1; x += 10) add([0.6, 3, 0.6], [x, top + T.H - 3.6, z], STEEL, 'Metal', { collide: 0 });
  }
  for (const x of [T.x0, T.x1]) add([1, 2.4, D], [x, top + T.H - 1.2, cz], STEEL, 'Metal', { collide: 0 });
  add([W + 2, 1, roofed - T.z0 + 1], [cx, top + T.H + 0.5, (T.z0 + roofed) / 2], 0x5a5c62, 'CorrodedMetal', { collide: 0 });
  // cladding: the back wall, and the sides as far as the roof goes
  box([W, T.H, 0.8], [cx, top, T.z0 - 0.6], CLAD, 'CorrodedMetal');
  for (const sx of [-1, 1]) {
    box([0.8, T.H, roofed - T.z0], [cx + sx * (W / 2 + 0.6), top, (T.z0 + roofed) / 2], CLAD, 'CorrodedMetal');
    // and the lower panels a little further, waiting for the rest
    box([0.8, 14, 20], [cx + sx * (W / 2 + 0.6), top, roofed + 10], CLAD, 'CorrodedMetal');
  }
  sign([0.4, 10, 26], [T.x1 + 1.2, top + T.H - 9, (T.z0 + roofed) / 2], CLAD, 'Right', [['STAGE 6', 0, 0, 1, 1, WHITE]]);
  sign([0.4, 10, 26], [T.x0 - 1.2, top + T.H - 9, (T.z0 + roofed) / 2], CLAD, 'Left', [['STAGE 6', 0, 0, 1, 1, WHITE]]);
  // scaffold across the open front, a header beam, and the big banner that
  // shows over the park wall
  for (let x = T.x0 + 4; x < T.x1 - 2; x += 8) box([0.3, 30, 0.3], [x, top, T.z1 + 3], 0x9aa0a8, 'Metal', { collide: 0 });
  for (let y = 6; y <= 30; y += 8) add([W - 4, 0.3, 0.3], [cx, top + y, T.z1 + 3], 0x9aa0a8, 'Metal', { collide: 0 });
  for (let y = 6; y <= 30; y += 8) add([W - 4, 0.25, 2.2], [cx, top + y - 0.3, T.z1 + 2], 0x6a4a30, 'WoodPlanks', { collide: 0 });
  add([W, 3, 1.4], [cx, top + T.H - 1.5, T.z1 + 0.8], STEEL, 'Metal', { collide: 0 });
  sign([64, 13, 0.4], [cx, top + T.H - 9, T.z1 + 1.8], BLACK, 'Back', [
    ['FINAL DESTINATION', 0, 0.04, 1, 0.42, RED], ["DEATH'S DESIGN", 0, 0.47, 1, 0.24, WHITE],
    ['COMING TO BENTON HAUNT  ·  NEXT FALL', 0, 0.75, 1, 0.18, 0xb0b0b0, 'GothamBold'],
  ], { glow: true });
  light(cx, top + T.H - 8, T.z1 + 6, RED);
  // inside: the first set walls going up (an airport gate) and a scissor lift
  for (let k = 0; k < 4; k++) box([12, 14, 0.6], [T.x0 + 12 + k * 14, top, T.z0 + 20], [0x5a6a7a, 0x8a96a4][k % 2], 'SmoothPlastic', { collide: 0 });
  sign([20, 2.2, 0.3], [T.x0 + 33, top + 12, T.z0 + 20.4], 0x10141c, 'Back', [['GATE 47  ·  FLIGHT 180  ·  PARIS', 0, 0, 1, 1, 0xffc040, 'GothamBold']], { glow: true });
  box([5, 1, 9], [T.x1 - 14, top, cz + 6], 0x2a2a2e, 'Metal', { collide: 0 });
  for (let k = 0; k < 4; k++) add([0.3, 4.6, 0.3], [T.x1 - 14, top + 3.3 + k * 4, cz + 6], 0x5a5e66, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.9 * (k % 2 ? 1 : -1)), -Math.sin(0.9 * (k % 2 ? 1 : -1)), 0, Math.sin(0.9 * (k % 2 ? 1 : -1)), Math.cos(0.9 * (k % 2 ? 1 : -1))] });
  box([5, 0.6, 9], [T.x1 - 14, top + 17, cz + 6], YELLOW, 'Metal', { collide: 0 });
  crew('work', T.x1 - 14, top + 17.6, cz + 6, HALF_PI, 1);
  crew('work', T.x0 + 20, top, T.z0 + 24, 0, 2);
  light(cx, 20, cz - 20, 0xfff0d0);

  // the tower crane, lifting the next roof panel into place
  const ccx = 362, ccz = -640, mast = 70;
  box([10, 2, 10], [ccx, G, ccz], 0xa8a49c, 'Concrete');
  box([3, mast, 3], [ccx, G + 2, ccz], YELLOW, 'Metal');
  const ctop = G + 2 + mast, yaw = -HALF_PI - 0.25;
  const ux = Math.sin(yaw), uz = Math.cos(yaw);
  box([3.6, 3, 3.6], [ccx, ctop, ccz], WHITE, 'SmoothPlastic', { collide: 0 });
  add([2.2, 2.2, 74], [ccx + ux * 25, ctop + 4, ccz + uz * 25], YELLOW, 'Metal', { yaw, collide: 0 });
  add([3, 3.4, 5], [ccx - ux * 9, ctop + 3.2, ccz - uz * 9], 0x8a8a86, 'Concrete', { yaw, collide: 0 });
  add([1, 1, 1], [ccx, ctop + 6, ccz], 0xff2020, 'Neon', { collide: 0, shape: 3 });
  const hx = ccx + ux * 44, hz = ccz + uz * 44, hy = top + T.H + 9;
  add([0.15, ctop + 3 - hy, 0.15], [hx, (ctop + 3 + hy) / 2, hz], 0x2a2a2e, 'Metal', { collide: 0 });
  add([20, 0.8, 9], [hx, hy - 0.4, hz], 0x5a5c62, 'CorrodedMetal', { collide: 0, yaw: 0.3 });

  // ---- the yard: Flight 180, on cradles, being put back together
  const FX = 300, FZ = -540, FL = 40, FR = 6, FY = G + 9.4;
  for (const dz of [-14, 0, 14]) {
    box([11, 3.2, 2], [FX, G, FZ + dz], 0x4a4e56, 'Metal');
    box([3, 0.8, 2], [FX, G + 3.2, FZ + dz], 0x2a2a2e, 'Rubber');
  }
  add([FL, FR * 2, FR * 2], [FX, FY, FZ], WHITE, 'SmoothPlastic', { shape: 2, yaw: HALF_PI });
  for (const sx of [-1, 1]) {
    add([0.3, 1.1, FL - 2], [FX + sx * 5.92, FY - 1.2, FZ], NAVY, 'SmoothPlastic', { collide: 0 });
    add([0.3, 0.5, FL - 2], [FX + sx * 5.98, FY - 0.3, FZ], RED, 'SmoothPlastic', { collide: 0 });
    for (let k = 0; k < 16; k++) add([0.25, 0.9, 0.7], [FX + sx * 5.85, FY + 1.5, FZ - 17 + k * 2.1], 0x10141c, 'Glass', { collide: 0 });
  }
  sign([0.3, 1.8, 14], [FX + 6.1, FY + 3.2, FZ + 4], WHITE, 'Right', [['VOLÉE AIRLINES', 0, 0, 1, 1, NAVY]]);
  sign([0.3, 1.8, 14], [FX - 6.1, FY + 3.2, FZ + 4], WHITE, 'Left', [['FLIGHT 180', 0, 0, 1, 1, NAVY]]);
  // the nose and the cockpit windows at the front end
  add([FR * 2, FR * 2, FR * 2], [FX, FY, FZ + FL / 2], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 });
  for (const dx of [-2.2, -0.75, 0.75, 2.2]) add([1.3, 0.8, 0.3], [FX + dx, FY + 2.6, FZ + FL / 2 + 4.7], 0x10141c, 'Glass', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.7), -Math.sin(0.7), 0, Math.sin(0.7), Math.cos(0.7)] });
  // the torn end: dark ribs and a tangle of wiring
  add([0.8, FR * 2 + 0.3, FR * 2 + 0.3], [FX, FY, FZ - FL / 2], 0x2a2a2e, 'Metal', { shape: 2, yaw: HALF_PI, collide: 0 });
  add([0.6, FR * 2 - 1, FR * 2 - 1], [FX, FY, FZ - FL / 2 - 0.1], 0x08080a, 'SmoothPlastic', { shape: 2, yaw: HALF_PI, collide: 0 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    add([0.3, 2.6, 0.3], [FX + Math.cos(a) * 5.4, FY + Math.sin(a) * 5.4, FZ - FL / 2 - 1.2], [RED, YELLOW, 0x2a6ae0][k % 3], 'Plastic', { collide: 0, rot: [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1] });
  }
  add([3, 3, 3], [FX + 2, FY - 2, FZ - FL / 2 - 0.8], 0xff7a1a, 'Neon', { shape: 3, collide: 0 }); // a work light in the wreck
  light(FX, FY, FZ - FL / 2 - 4, 0xff7a1a);
  sign([6, 3, 0.3], [FX - 9, G + 3, FZ - FL / 2 - 4], 0xf2c818, 'Front', [['DANGER', 0, 0, 1, 0.55, BLACK], ['WRECKAGE  ·  KEEP OUT', 0, 0.55, 1, 0.45, BLACK, 'GothamBold']]);
  box([0.3, 3, 0.3], [FX - 9, G, FZ - FL / 2 - 4.2], 0x2a2a2e, 'Metal', { collide: 0 });
  // the tail fin and a wing waiting on the ground
  add([1.2, 10, 12], [FX + 20, G + 5, FZ + 6], WHITE, 'SmoothPlastic', { shape: 1, yaw: Math.PI });
  sign([0.3, 3, 5], [FX + 20.7, G + 4, FZ + 7.5], WHITE, 'Right', [['180', 0, 0, 1, 1, RED]]);
  add([24, 1, 7], [FX - 22, G + 0.6, FZ + 2], 0xb8bcc4, 'Metal', { yaw: 0.25 });
  // a scaffold tower and a crew working on the fuselage
  for (const [dx, dz] of [[-9, -6], [-9, 6], [-13, -6], [-13, 6]]) box([0.3, 16, 0.3], [FX + dx, G, FZ + dz], 0x9aa0a8, 'Metal', { collide: 0 });
  for (const y of [8, 16]) box([4.6, 0.4, 12.6], [FX - 11, G + y - 0.4, FZ], 0x6a4a30, 'WoodPlanks');
  crew('work', FX - 10, G + 16, FZ, -HALF_PI, 3);
  crew('work', FX + 9, G, FZ - 10, HALF_PI, 4);

  // ---- a log truck from Route 23, the logs chained on (for now)
  const LX = 346, LZ = -532;
  box([8, 7.5, 8], [LX, G + 1, LZ + 16], 0x7a1a14, 'Metal');
  add([7.6, 3, 0.2], [LX, G + 5.4, LZ + 20.05], 0x14181e, 'Glass', { collide: 0 });
  box([8, 1.4, 26], [LX, G + 2, LZ], 0x2a2a2e, 'Metal');
  for (const [dz, dx] of [[-9, -3.4], [-9, 3.4], [-1, -3.4], [-1, 3.4], [7, -3.4], [7, 3.4], [16, -3.4], [16, 3.4]]) add([1, 3, 3], [LX + dx, G + 1.5, LZ + dz], 0x111111, 'Rubber', { shape: 2 });
  const LOGS = [[-2.4, 0], [0, 0], [2.4, 0], [-1.2, 1], [1.2, 1], [0, 2]];
  for (const [dx, row] of LOGS) add([24, 2.5, 2.5], [LX + dx, G + 4.7 + row * 2.2, LZ - 1], 0x7a5434, 'Wood', { shape: 2, yaw: HALF_PI });
  for (const dz of [-8, 0, 8]) add([7.6, 0.25, 0.25], [LX, G + 9.4, LZ - 1 + dz], 0x5a5e66, 'Metal', { collide: 0 });
  add([22, 2.5, 2.5], [LX - 10, G + 1.3, LZ - 4], 0x7a5434, 'Wood', { shape: 2, yaw: HALF_PI + 0.4 }); // one already rolled off
  box([0.4, 8, 0.4], [LX - 12, G, LZ + 22], 0x5a5e66, 'Metal');
  sign([9, 4, 0.3], [LX - 12, G + 9.6, LZ + 22], 0x1e6a3a, 'Back', [['ROUTE 23', 0, 0.05, 1, 0.55, WHITE], ['NORTH', 0, 0.6, 1, 0.35, WHITE, 'GothamBold']]);

  // ---- Devil's Flight: a coaster car hanging off a twisted piece of track
  const DX = 276, DZ = -470;
  for (const sx of [-1.1, 1.1]) add([0.4, 0.4, 20], [DX + sx, G + 2.2, DZ], 0xb8bcc0, 'Metal', { collide: 0, rot: [1, 0, 0, 0, Math.cos(0.12), -Math.sin(0.12), 0, Math.sin(0.12), Math.cos(0.12)] });
  for (let k = 0; k < 6; k++) box([3, 0.4, 0.6], [DX, G + 1.2 + k * 0.42, DZ - 8 + k * 3.2], 0x5a3a22, 'Wood', { collide: 0 });
  box([1, 3, 1], [DX, G, DZ + 8], 0x5a5e66, 'Metal');
  const tilt = 0.5;
  add([5.6, 3, 7], [DX + 2.6, G + 3.2, DZ + 4], RED, 'SmoothPlastic', { rot: [Math.cos(tilt), -Math.sin(tilt), 0, Math.sin(tilt), Math.cos(tilt), 0, 0, 0, 1] });
  for (const dz of [-1.6, 1.6]) add([0.3, 0.3, 4.6], [DX + 2.6, G + 5.2, DZ + 4 + dz], 0x2a2a2e, 'Metal', { collide: 0, yaw: HALF_PI });
  box([7, 4, 4], [DX - 6, G, DZ - 10], 0x6a4a30, 'WoodPlanks');
  sign([0.3, 2.6, 6.6], [DX - 2.4, G + 2.2, DZ - 10], 0x6a4a30, 'Right', [["DEVIL'S FLIGHT", 0, 0, 1, 1, 0xffb030]]);

  // ---- the tanning bed, a shelf and a fan
  const BX = 318, BZ = -466;
  box([4.4, 2.2, 9], [BX, G, BZ], WHITE, 'SmoothPlastic');
  add([4.2, 0.2, 8.6], [BX, G + 2.3, BZ], 0x6ab8ff, 'Neon', { collide: 0 });
  const lid = 0.6;
  add([4.4, 0.8, 9], [BX - 1.4, G + 4.4, BZ], WHITE, 'SmoothPlastic', { collide: 0, rot: [Math.cos(lid), -Math.sin(lid), 0, Math.sin(lid), Math.cos(lid), 0, 0, 0, 1] });
  box([0.3, 6, 0.3], [BX + 4, G, BZ - 3], 0x2a2a2e, 'Metal', { collide: 0 });
  add([0.2, 3, 3], [BX + 4, G + 6.6, BZ - 3], 0xd8d8d8, 'Metal', { shape: 2, collide: 0 });
  box([4, 0.3, 1.4], [BX - 4, G + 5, BZ + 5], 0x8a6a4a, 'Wood', { collide: 0 });
  sign([5, 1.4, 0.3], [BX, G + 6, BZ - 4.8], 0x10141c, 'Front', [['TANNING  ·  13 MIN', 0, 0, 1, 1, 0x6ab8ff, 'GothamBold']], { glow: true });
  light(BX, 4, BZ, 0x6ab8ff);

  // ---- North Bay Bridge girders and crates of props
  for (let k = 0; k < 6; k++) box([20, 1.6, 1.6], [334, G + Math.floor(k / 3) * 1.6, -480 + (k % 3) * 2], 0xc85a1a, 'Metal', { collide: k < 3 ? 1 : 0 });
  sign([0.3, 2, 8], [344.2, G + 1.6, -478], 0xc85a1a, 'Right', [['NORTH BAY BRIDGE  ·  SEC 4', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  [['FRAGILE', 268, -580], ["DEATH'S DESIGN", 268, -560], ['13', 268, -540], ['MCKINLEY', 360, -580], ['HANDLE WITH CARE', 360, -560]].forEach(([text, x, z], k) => {
    box([5, 4, 5], [x, G, z], 0x7a5a38, 'WoodPlanks');
    if (k < 2) box([4, 3, 4], [x, G + 4, z], 0x6a4a30, 'WoodPlanks', { collide: 0 });
    sign([0.3, 1.6, 4.2], [x + (x < 300 ? 2.7 : -2.7), G + 2, z], 0x7a5a38, x < 300 ? 'Right' : 'Left', [[text, 0, 0, 1, 1, BLOOD, 'GothamBold']]);
  });

  // ---- the departures board everyone gets one look at
  const DBX = 350, DBZ = -452;
  for (const dx of [-6, 6]) box([0.5, 6, 0.5], [DBX + dx, G, DBZ], 0x2a2a2e, 'Metal');
  sign([14, 7, 0.4], [DBX, G + 9.5, DBZ], BLACK, 'Back', [
    ['DEPARTURES', 0, 0.02, 1, 0.2, 0xffc040],
    ['180   PARIS   DELAYED', 0, 0.26, 1, 0.22, RED, 'GothamBold'],
    ['23   ROUTE 23   CANCELLED', 0, 0.5, 1, 0.22, RED, 'GothamBold'],
    ['13   YOUR NAME   ON TIME', 0, 0.74, 1, 0.22, WHITE, 'GothamBold'],
  ], { glow: true });

  // ---- the site office: zero days without an accident
  box([24, 9, 9], [300, G + 1, -428], WHITE, 'SmoothPlastic');
  sign([20, 1.8, 0.2], [300, G + 8, -432.6], WHITE, 'Front', [['BENTON HAUNT  ·  FINAL DESTINATION  ·  SITE OFFICE', 0, 0, 1, 1, 0x16223a, 'GothamBold']]);
  sign([9, 2.6, 0.2], [292, G + 4.4, -432.6], 0xf4f0e0, 'Front', [['DAYS WITHOUT AN ACCIDENT', 0, 0.02, 1, 0.44, BLACK, 'GothamBold'], ['0', 0, 0.48, 1, 0.5, RED]]);
  for (let k = 0; k < 2; k++) box([3.6, 7.4, 3.6], [318 + k * 4.2, G, -428], 0x2a6ae0, 'SmoothPlastic');
  crew('idle', 296, G, -436, Math.PI, 5);
  crew('idle', 330, G, -500, 0, 6);

  // ---- fence round the site, floodlights, a dim red work glow
  const fence = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), fyaw = Math.atan2(xb - xa, zb - za);
    const n = Math.round(len / 10);
    for (let k = 0; k <= n; k++) box([0.5, 9, 0.5], [xa + ((xb - xa) * k) / n, G, za + ((zb - za) * k) / n], 0xb8bcc0, 'Metal', { shape: 5 });
    add([0.2, 8.6, len], [(xa + xb) / 2, G + 4.4, (za + zb) / 2], 0x8a9096, 'Metal', { yaw: fyaw, trans: 0.6 });
    add([0.25, 5, len], [(xa + xb) / 2, G + 3, (za + zb) / 2], 0x1a1a1c, 'Fabric', { yaw: fyaw, collide: 0 });
  };
  fence(S.x1, S.z0, S.x1, -406);
  fence(250, S.z0, S.x1, S.z0);
  for (const [x, z] of [[262, -600], [366, -560], [262, -450], [340, -420]]) {
    box([0.6, 16, 0.6], [x, G, z], 0x5a5e66, 'Metal');
    for (const dx of [-1.2, 1.2]) add([2, 1.4, 0.8], [x + dx, G + 16.4, z], 0xfff6d8, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x, G + 16, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  light(300, 6, -500, BLOOD);

  // ---- the teaser board inside the park, by the Velocity City wall
  const spot = makeFinder(data)(310, -388, 9, [[115, -404, 375, -340]]);
  if (spot) {
    const [bx, bz] = spot;
    for (const dx of [-9, 9]) box([0.8, 15, 0.8], [bx + dx, G, bz], 0x2a2e36, 'Metal', { shape: 5 });
    add([26, 11, 1], [bx, G + 13.5, bz], 0x2a2e36, 'Metal', { collide: 0 });
    const labels = [
      ['FINAL DESTINATION', 0, 0.06, 1, 0.36, RED], ["DEATH'S DESIGN  ·  NOW UNDER CONSTRUCTION", 0, 0.46, 1, 0.18, WHITE, 'GothamBold'],
      ['BENTON HAUNT  ·  NEXT FALL  ·  NOW BUILDING ON STAGE 6', 0, 0.7, 1, 0.14, 0xb0b0b0, 'GothamBold'],
    ];
    sign([25, 10, 0.3], [bx, G + 13.5, bz + 0.7], BLACK, 'Back', labels, { glow: true });
    sign([25, 10, 0.3], [bx, G + 13.5, bz - 0.7], BLACK, 'Front', labels, { glow: true });
    sign([10, 1.8, 0.3], [bx, G + 6.4, bz + 0.5], BLACK, 'Back', [['FLIGHT 180  ·  DELAYED', 0, 0, 1, 1, RED, 'GothamBold']], { glow: true });
  }

  data.staff.lines.construction = [
    ...(data.staff.lines.construction || []),
    'Careful with that fuselage!', "Who left this tanning bed plugged in?", 'Check those chains on the logs. Twice.', "Watch out for the 13th step..." , "Death's Design is going up!",
  ];
  return { site: S, gate: spot ? { x: spot[0], z: spot[1] } : { x: 310, z: -390 } };
}

// a toast the first time you walk up to the wall, and construction noise
export class FinalDestinationSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
    this.next = 2;
  }

  update(dt, pos, started) {
    if (!started) return;
    const near = Math.hypot(pos.x - this.layout.gate.x, pos.z - this.layout.gate.z) < 60;
    if (near && !this.told) {
      this.told = true;
      this.hooks.toast("Construction has started on FINAL DESTINATION: DEATH'S DESIGN, the first house of next fall's Benton Haunt! Look over the wall: Flight 180 is being put back together.", 'info');
    }
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 1 + Math.random() * 3;
      if (near) this.hooks.sound('clank');
    }
  }
}
