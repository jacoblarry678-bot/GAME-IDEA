// THE MEXICO TOUR: an indoor boat ride in Fiesta Plaza, Natural Kingdom's
// sixth land. The plaza sits west of the valley, beyond the Backwoods Lodge,
// walled off from the parkway: guests come in through the park's gate and
// out along the Fiesta Trail, a path cut through the hills from Rainforest
// Hollow. Its building is a great stepped pyramid; walk in through
// the tunnel at its foot and it's always twilight inside: stars, a moon, a
// smoking volcano over a market plaza where painted boats wait on the
// river. The boats drift out past a market town strung with papel picado
// and pinatas, a mariachi band in the square, a Day of the Dead night of
// marigolds and candles and dancing skeletons, the cliff divers, an
// ancient temple and its feathered serpent, and home under a sky of
// fireworks.
import { helpers } from './wolverine.js';
import { addItems } from './lowerlot.js';
import { trackRide } from './nkrides.js';

export const RIDE_ID = 'MexicoTour';
export const FIESTA = { x0: -560, x1: -360, z0: 690, z1: 870 }; // the plaza's site
export const FIESTA_LANDS = ['FiestaPlaza'];
export const FIESTA_DOOR = [-546, 0.42, 745]; // the cast members' door, in a shed west of the pyramid
const TRAIL = { z: 880, x0: -372, x1: 8 }; // the Fiesta Trail, from Rainforest Hollow's plaza west and down into Fiesta Plaza
const B = { x0: -545, x1: -385, z0: 760, z1: 860, H: 20 }; // the ride hall, behind the pyramid
const T = 1.6;
const G = 0.02;
const STONE = 0xc8b08a, STONE2 = 0xb09870, DUSK = 0x1a1440, ORANGE = 0xff8a1a, MAGENTA = 0xe0287a, TEAL = 0x1ab8a8, GOLD = 0xf0c040, LIME = 0x8ad83a, WHITE = 0xf4f0e8, INK = 0x14101a, RED = 0xd8283a, SKY = 0x2a7ad8;
const PICADO = [MAGENTA, ORANGE, TEAL, GOLD, LIME, SKY, RED];

const NEW_ITEMS = [
  { id: 'FiestaSombrero', base: 'CowboyHat', name: 'Fiesta Sombrero', description: 'A wide, bright sombrero from Mercado Benton.', price: 120, colors: [0xe0a030, 0xd8283a] },
  { id: 'PinataBalloon', base: 'DuckBalloon', name: 'Pinata Balloon', description: 'A rainbow donkey pinata balloon. No sticks, please.', price: 85, colors: [0xe0287a, 0xf0c040] },
  { id: 'Churros', base: 'Pretzel', name: 'Churros', description: 'Hot cinnamon-sugar churros with chocolate to dip.', price: 10, hunger: 25, bites: 3, colors: [0xc88a3a, 0x6a3a1a], food: true },
  { id: 'Horchata', base: 'Lemonade', name: 'Horchata', description: 'Cold, sweet rice-and-cinnamon horchata. Speed boost!', price: 9, hunger: 10, bites: 2, colors: [0xf4ecd8, 0xc8a070], buff: { kind: 'speed', duration: 50, amount: 5 }, food: true },
  { id: 'TacosPastor', base: 'StuntTaco', name: 'Tacos al Pastor', description: 'Three tacos al pastor with pineapple and lime.', price: 18, hunger: 45, bites: 3, colors: [0xd8783a, 0x3aa83a], food: true },
];

const C = (x, z, v) => [x, 1.0, z, v];
const CIRCUIT = [
  // the dock in the twilight plaza, heading west
  C(-512, 800, 2), C(-528, 800, 2.5),
  // round to the south, and east past the market town, the mariachis, the Day of the Dead
  C(-537, 809, 3.5), C(-538, 823, 4.5), C(-534, 838, 4.5), C(-524, 849, 4.5), C(-505, 850, 4.5), C(-485, 846, 4.5), C(-460, 850, 4.5), C(-440, 846, 4.5),
  // the cliff divers in the corner, north past the temple
  C(-418, 850, 4.5), C(-400, 840, 4.5), C(-396, 820, 4.5), C(-400, 800, 4.5), C(-396, 782, 4.5),
  // the fireworks, and west home to the dock
  C(-408, 770, 4.5), C(-430, 772, 4.5), C(-446, 782, 4), C(-454, 795, 3), C(-466, 800, 2.5), C(-484, 800, 2.2), C(-498, 800, 2),
];

export function buildMexicoTour(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.hauntLights = data.hauntLights || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.staffSpots = data.staffSpots || [];
  const light = (x, y, z, c) => data.hauntLights.push([x, y, z, c]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the ground and the land
  data.flatZones = [...(data.flatZones || []), { ...FIESTA, margin: 30 }, { x0: -392, x1: -90, z0: TRAIL.z - 12, z1: TRAIL.z + 12, margin: 20 }];
  data.trees = (data.trees || []).filter((t) => !(t.pos[0] > FIESTA.x0 - 10 && t.pos[0] < FIESTA.x1 + 10 && t.pos[2] > FIESTA.z0 - 10 && t.pos[2] < FIESTA.z1 + 10) && !(t.pos[0] > -392 && t.pos[0] < -80 && Math.abs(t.pos[2] - TRAIL.z) < 14));
  data.config.Lands.push({ id: 'FiestaPlaza', name: 'Fiesta Plaza', center: [-465, 0, 720], color: 0xe04a2a, tagline: 'Music, marigolds and the river at twilight - down the Fiesta Trail.', regions: [[FIESTA.x0, FIESTA.z0, FIESTA.x1, FIESTA.z1], [-386, FIESTA.z1, -90, TRAIL.z + 12]] });

  // ======== Fiesta Plaza: tiles, a fountain, papel picado, the cantina and the market
  add([FIESTA.x1 - FIESTA.x0 - 20, 0.2, B.z0 - FIESTA.z0 - 4], [(FIESTA.x0 + FIESTA.x1) / 2, G + 0.1, (FIESTA.z0 + B.z0) / 2 - 2], 0xd8a878, 'Pavement', { collide: 0 });
  for (let x = FIESTA.x0 + 16; x < FIESTA.x1 - 12; x += 8) for (let z = FIESTA.z0 + 12; z < B.z0 - 26; z += 8) if (((x + z) / 8) % 2 === 0) add([7.6, 0.06, 7.6], [x, G + 0.22, z], 0xc87850, 'Pavement', { collide: 0 });
  // the fountain
  add([16, 1.4, 16], [-465, G + 0.7, 705], 0x2a8ab8, 'Slate', { shape: 5 });
  add([14, 0.2, 14], [-465, G + 1.45, 705], 0x6ad0f0, 'Glass', { shape: 5, collide: 0, trans: 0.3 });
  add([2, 5, 2], [-465, G + 2.5, 705], 0xe8d8b8, 'Slate', { shape: 5 });
  add([5, 0.8, 5], [-465, G + 5.2, 705], 0xe8d8b8, 'Slate', { shape: 5, collide: 0 });
  add([4, 2.4, 4], [-465, G + 6.4, 705], 0x9ae8ff, 'Glass', { shape: 5, collide: 0, trans: 0.45 });
  light(-465, 6, 705, 0x9ae8ff);
  // papel picado: strings of little cut-paper flags across the plaza
  const picado = (x0, z0, x1, z1, y) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.2);
    add([0.06, 0.06, Math.hypot(x1 - x0, z1 - z0)], [(x0 + x1) / 2, y + 0.4, (z0 + z1) / 2], 0x3a3a3a, 'Fabric', { collide: 0, rot: RY(Math.atan2(x1 - x0, z1 - z0)) });
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, sag = Math.sin(t * Math.PI) * 1.2;
      add([1.6, 1.4, 0.05], [x0 + (x1 - x0) * t, y - sag, z0 + (z1 - z0) * t], PICADO[k % PICADO.length], 'Fabric', { collide: 0, rot: RY(Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2) });
    }
  };
  for (const [x, z] of [[-540, 700], [-390, 700], [-540, 735], [-390, 735]]) { box([0.4, 12, 0.4], [x, G, z], 0x5a3a2a, 'Wood', { collide: 0 }); add([1.2, 1, 1.2], [x, G + 12.3, z], 0xffd890, 'Neon', { collide: 0, shape: 3 }); data.tags.ParkLamp.push([x, G + 12.3, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
  picado(-540, 700, -390, 735, 11); picado(-390, 700, -540, 735, 11.4); picado(-540, 718, -390, 718, 10.6);
  // the cantina and the market, either side of the plaza
  const venue = (id, name, kind, x, z, w, d, h, facing, color, items, description) => {
    box([w, h, d], [x, G, z], color, 'Slate');
    const f = { E: [1, 0], W: [-1, 0] }[facing];
    const fx = x + f[0] * (w / 2 + 0.2);
    add([0.4, h - 4, d - 6], [fx, G + (h - 4) / 2 + 0.3, z], 0x1a1008, 'SmoothPlastic', { collide: 0 });
    for (let k = 0; k < 6; k++) add([5, 0.4, (d + 2) / 6], [fx + f[0] * 2.4, G + h - 2.6, z - (d + 2) / 2 + (k + 0.5) * (d + 2) / 6], k % 2 ? WHITE : PICADO[k % PICADO.length], 'Fabric', { collide: 0 });
    sign([0.3, 2.4, d - 4], [fx + f[0] * 0.2, G + h + 0.8, z], INK, facing === 'E' ? 'Right' : 'Left', [[name.toUpperCase(), 0, 0, 1, 1, GOLD]], { glow: true });
    data.config.Venues.push({ id, name, kind, land: 'FiestaPlaza', facing, description, items, color, position: [x, 0, z], size: [w, h, d] });
    if (kind === 'restaurant') data.staffSpots.push({ role: 'cashier', kind: 'restaurant', venue: id, land: 'FiestaPlaza', seed: id.length * 5, cf: cf(fx - f[0] * 3, G, z, f[0] > 0 ? -Math.PI / 2 : Math.PI / 2) });
  };
  venue('CantinaDelSol', 'Cantina del Sol', 'restaurant', -527, 718, 22, 30, 12, 'E', 0xe07a4a, ['TacosPastor', 'Churros', 'Horchata'], 'Tacos al pastor, hot churros and cold horchata on the plaza.');
  venue('MercadoBenton', 'Mercado Benton', 'shop', -403, 718, 22, 30, 12, 'W', 0x3aa8a0, ['FiestaSombrero', 'PinataBalloon', 'ExpressPass'], 'Sombreros, pinata balloons and bright woven blankets.');
  addItems(data, NEW_ITEMS);
  for (const [x, z] of [[-505, 704], [-425, 704], [-505, 734], [-425, 734]]) {
    add([3, 1.2, 3], [x, G + 0.6, z], 0xc86a3a, 'Slate', { shape: 5, collide: 0 });
    for (const [dx, h] of [[0, 4], [0.9, 2.6], [-0.8, 2]]) add([0.8, h, 0.8], [x + dx, G + 1.2 + h / 2, z], 0x3a8a3a, 'Grass', { collide: 0, shape: 5 });
  }
  sign([0.3, 2.2, 16], [-556, G + 8, 715], INK, 'Right', [['FIESTA PLAZA', 0, 0, 1, 1, ORANGE]], { glow: true });
  box([0.5, 7, 0.5], [-556.3, G, 707], 0x5a3a2a, 'Wood', { collide: 0 }); box([0.5, 7, 0.5], [-556.3, G, 723], 0x5a3a2a, 'Wood', { collide: 0 });
  // the cast members' shed, west of the pyramid
  box([8, 9, 12], [-552, G, 745], 0xb08a60, 'Slate');
  add([0.15, 7, 4], [-547.9, 3.5, 745], 0x3a4048, 'Metal', { collide: 0 });
  sign([0.1, 1.1, 4.4], [-547.8, 8.2, 745], 0x16223a, 'Right', [['CAST MEMBERS ONLY', 0, 0, 1, 1, 0xf0c440, 'GothamBold']]);
  // ======== an adobe wall round the plaza, closing it off from the parkway (in through the park's gate only)
  const ADOBE = 0xd8805a;
  const adobe = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    box([1.4, 6, len], [(x0 + x1) / 2, G, (z0 + z1) / 2], ADOBE, 'Slate', { yaw });
    add([2, 0.5, len + 0.6], [(x0 + x1) / 2, G + 6.25, (z0 + z1) / 2], 0xb8482a, 'Slate', { collide: 0, yaw });
    for (let t = 6; t < len - 3; t += 12) for (const sd of [-1, 1]) {
      const u = t / len, x = x0 + (x1 - x0) * u + Math.cos(yaw) * sd * 0.72, z = z0 + (z1 - z0) * u - Math.sin(yaw) * sd * 0.72;
      add([0.06, 1.6, 1.6], [x, G + 3.6, z], PICADO[Math.round(t / 12) % 7], 'SmoothPlastic', { collide: 0, yaw });
    }
  };
  adobe(FIESTA.x0, FIESTA.z0 - 1, FIESTA.x1, FIESTA.z0 - 1);
  adobe(FIESTA.x0, FIESTA.z0 - 1, FIESTA.x0, B.z0);
  adobe(FIESTA.x0, B.z0 + 0.8, B.x0, B.z0 + 0.8);
  adobe(FIESTA.x1, FIESTA.z0 - 1, FIESTA.x1, FIESTA.z1 - 12);

  // ======== the Fiesta Trail: from Rainforest Hollow west through a cut in the hills, and down into the plaza
  const trail = (pts, w) => { for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); add([w, 0.2, len + w], [(a[0] + b[0]) / 2, G + 0.1, (a[1] + b[1]) / 2], 0xd8a878, 'Pavement', { collide: 0, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }); } };
  trail([[TRAIL.x1, TRAIL.z], [TRAIL.x0, TRAIL.z], [TRAIL.x0, 752]], 10);
  // lamps, cacti and agaves along it, boulders at the foot of the cut
  for (let x = TRAIL.x1 - 30; x > TRAIL.x0 + 10; x -= 32) for (const sd of [-1, 1]) {
    const z = TRAIL.z + sd * 7.5;
    if (sd < 0) { box([0.35, 8, 0.35], [x, G, z], 0x3a2a1a, 'Wood', { collide: 0 }); add([1.2, 1, 1.2], [x, G + 8.4, z], 0xffb060, 'Neon', { collide: 0, shape: 3 }); data.tags.ParkLamp.push([x, G + 8.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
    else { add([1.4, 6, 1.4], [x + 6, G + 3, z + 1], 0x3a8a4a, 'Grass', { shape: 5 }); add([3, 0.9, 0.9], [x + 6, G + 4, z + 1], 0x3a8a4a, 'Grass', { collide: 0, shape: 2 }); add([0.9, 2.4, 0.9], [x + 7.1, G + 5, z + 1], 0x3a8a4a, 'Grass', { collide: 0, shape: 5 }); }
    for (let j = 0; j < 5; j++) add([0.5, 2.6, 0.2], [x - 12 + sd * 0.4, G + 1.2, z + sd * 2 + (j - 2) * 0.4], 0x6a9a6a, 'Grass', { collide: 0, rot: RX((j - 2) * 0.35) });
    add([4 + (x % 3), 3, 3.6], [x + 14, G + 1.2, TRAIL.z + sd * 12], 0x9a7a5a, 'Slate', { collide: 0, rot: RY(x * 0.7) });
  }
  for (let z = 860; z > 770; z -= 18) for (let j = 0; j < 9; j++) add([1.4, 1.2, 0.05], [-382.5 + j * 2.6, G + 9.5 - Math.sin((j + 0.5) / 9 * Math.PI) * 0.8, z], PICADO[(j + z) % 7], 'Fabric', { collide: 0 });
  for (const z of [860, 812]) for (const x of [-383.5, -361.5]) box([0.4, 10, 0.4], [x, G, z], 0x5a3a2a, 'Wood', { collide: 0 });
  // the welcome arch where it leaves Rainforest Hollow
  for (const sd of [-1, 1]) { box([3, 13, 3], [-96, G, TRAIL.z + sd * 7], ADOBE, 'Slate'); add([3.6, 0.6, 3.6], [-96, G + 13.3, TRAIL.z + sd * 7], 0xb8482a, 'Slate', { collide: 0 }); }
  add([3, 3, 17], [-96, G + 14.5, TRAIL.z], ADOBE, 'Slate', { collide: 0 });
  sign([0.3, 2.4, 15], [-94.3, G + 14.5, TRAIL.z], INK, 'Right', [['FIESTA PLAZA', 0, 0, 1, 0.64, ORANGE], ['THE MEXICO TOUR', 0, 0.64, 1, 0.36, TEAL, 'GothamBold']], { glow: true });
  sign([0.3, 2.4, 15], [-97.7, G + 14.5, TRAIL.z], INK, 'Left', [['RAINFOREST HOLLOW', 0, 0, 1, 1, LIME]], { glow: true });
  for (let j = 0; j < 7; j++) add([1.6, 1.4, 0.05], [-96, G + 12 - Math.sin((j + 0.5) / 7 * Math.PI), TRAIL.z - 6 + j * 2], PICADO[j], 'Fabric', { collide: 0, rot: RY(Math.PI / 2) });

  // ======== the pyramid: five stepped tiers over the hall's front, a stair, a temple on top
  const PY = { x0: -525, x1: -405, z0: 728, z1: 762 }; // its footprint at the bottom
  const tunnel = [-471, -459]; // the way in, at the foot of the stair
  const TH = 8; // the tunnel's headroom: cut through the bottom two tiers, a lintel over it
  for (let k = 0; k < 5; k++) {
    const inset = k * 7, y0 = k * 5;
    const x0 = PY.x0 + inset, x1 = PY.x1 - inset, z0 = PY.z0 + inset * 0.7;
    const c = k % 2 ? STONE2 : STONE;
    if (k < 2) {
      box([tunnel[0] - x0, 5, PY.z1 - z0], [(x0 + tunnel[0]) / 2, G + y0, (z0 + PY.z1) / 2], c, 'Slate');
      box([x1 - tunnel[1], 5, PY.z1 - z0], [(x1 + tunnel[1]) / 2, G + y0, (z0 + PY.z1) / 2], c, 'Slate');
    } else box([x1 - x0, 5, PY.z1 - z0], [(x0 + x1) / 2, G + y0, (z0 + PY.z1) / 2], c, 'Slate');
    add([x1 - x0 + 0.4, 0.6, 0.4], [(x0 + x1) / 2, G + y0 + 4.6, z0 - 0.1], 0x8a6a40, 'Slate', { collide: 0 });
  }
  box([tunnel[1] - tunnel[0], 10 - TH, PY.z1 - PY.z0 - 4.9], [-465, G + TH, (PY.z0 + 4.9 + PY.z1) / 2], 0x9a7a50, 'Slate'); // (the lintel)
  add([tunnel[1] - tunnel[0] + 3, 10 - TH, 1.2], [-465, G + TH + 1, PY.z0 + 4.3], 0x8a6a40, 'Slate', { collide: 0 });
  for (const x of tunnel) add([1.6, TH, 1.6], [x + (x < -465 ? -0.8 : 0.8), G + TH / 2, PY.z0 - 0.4], 0x8a6a40, 'Slate', { collide: 0 });
  // the grand stair up the front, over the tunnel to the temple (looks only); serpent heads at the tunnel's mouth
  for (let k = 0; k < 17; k++) add([14, 1.05, 1.6], [-465, G + 10.5 + k * 0.9, PY.z0 + 5.4 + k * 0.88], 0xd8c098, 'Slate', { collide: 0 });
  for (const sx of [-1, 1]) add([1.4, 2, 16], [-465 + sx * 7.7, G + 17.5, PY.z0 + 12.4], 0xb09870, 'Slate', { collide: 0, rot: RX(-Math.atan2(15, 14.6)) });
  for (const sx of [-1, 1]) {
    add([3, 3, 4], [-465 + sx * 8.5, G + 1.5, PY.z0 - 1], 0x3a8a5a, 'Slate', { collide: 0 });
    add([2.4, 0.8, 1.6], [-465 + sx * 8.5, G + 0.9, PY.z0 - 3.6], 0x2a6a3a, 'Slate', { collide: 0 });
    neon([0.6, 0.6, 0.3], [-465 + sx * 8.5 + 0.8, G + 2.4, PY.z0 - 3.2], GOLD, { shape: 3 });
  }
  // the temple on top
  box([24, 8, 12], [-465, G + 25, PY.z0 + 26], STONE, 'Slate');
  add([26, 1.2, 14], [-465, G + 33.6, PY.z0 + 26], 0x8a6a40, 'Slate', { collide: 0 });
  add([6, 6, 0.3], [-465, G + 28.2, PY.z0 + 19.85], 0xff8a3a, 'Neon', { collide: 0 });
  light(-465, 30, PY.z0 + 17, ORANGE);
  // the name, on a marquee in the plaza in front of the tunnel
  for (const x of [-482, -448]) box([0.8, 15, 0.8], [x, G, 721], 0x5a3a2a, 'Wood');
  sign([36, 4.4, 0.5], [-465, G + 12.6, 721], INK, 'Front', [['THE MEXICO TOUR', 0, 0, 1, 0.66, ORANGE], ['A BOAT RIDE THROUGH A NIGHT OF FIESTA', 0, 0.66, 1, 0.34, TEAL, 'GothamBold']], { glow: true });
  for (let j = 0; j < 12; j++) add([1.6, 1.4, 0.05], [-482 + 1.5 + j * 2.8, G + 9.6 - Math.sin((j + 0.5) / 12 * Math.PI) * 0.8, 720.6], PICADO[j % 7], 'Fabric', { collide: 0 });

  // ======== the hall behind it
  const wall = (x0, x1, z0, z1, h0 = 0, h1 = B.H) => box([x1 - x0, h1 - h0, z1 - z0], [(x0 + x1) / 2, G + h0, (z0 + z1) / 2], 0xa88a60, 'Slate');
  wall(B.x0, B.x0 + T, B.z0, B.z1);
  wall(B.x1 - T, B.x1, B.z0, B.z1);
  wall(B.x0, B.x1, B.z1 - T, B.z1);
  wall(B.x0, tunnel[0], B.z0, B.z0 + T);
  wall(tunnel[1], B.x1, B.z0, B.z0 + T);
  wall(tunnel[0], tunnel[1], B.z0, B.z0 + T, TH, B.H);
  add([B.x1 - B.x0, 1, B.z1 - B.z0], [(B.x0 + B.x1) / 2, G + B.H + 0.5, (B.z0 + B.z1) / 2], DUSK, 'Concrete');
  add([B.x1 - B.x0 + 0.6, 0.2, B.z1 - B.z0 + 0.6], [(B.x0 + B.x1) / 2, G + B.H + 1.1, (B.z0 + B.z1) / 2], STONE2, 'Slate', { collide: 0 }); // (stone on top, the twilight sky under it)
  // the tunnel's floor and walls, lit
  add([12, 0.2, PY.z1 - PY.z0 + 4], [-465, G + 0.1, (PY.z0 + PY.z1) / 2 + 2], 0xb89a70, 'Pavement', { collide: 0 });
  for (let z = PY.z0 + 3; z < B.z0; z += 8) for (const x of tunnel) neon([0.3, 0.6, 0.6], [x + (x < -465 ? 0.4 : -0.4), G + 4, z], ORANGE);

  // ======== the ride: painted boats on the river
  const BOATS = 4, SPACING = 12;
  const boat = (k, pp2) => {
    const hull = [0x2a8ad8, 0xe0287a, 0x3aa84a, 0xf0a020][k % 4];
    const parts = [
      pp2(0, [4.6, 1.3, 10], [0, 0.9, 0], hull, 'WoodPlanks'),
      pp2(0, [4.8, 0.25, 10.4], [0, 1.65, 0], 0xf4e8c8, 'WoodPlanks'),
      // the arch at the bow with the boat's name, flowers round it
      pp2(0, [0.4, 4, 0.4], [-2.1, 3.6, -4.6], hull, 'Wood'), pp2(0, [0.4, 4, 0.4], [2.1, 3.6, -4.6], hull, 'Wood'),
      pp2(0, [4.8, 1.4, 0.3], [0, 6.1, -4.6], hull, 'Wood'),
      pp2(0, [5.6, 0.2, 10.6], [0, 5.6, 0], [ORANGE, MAGENTA, TEAL, GOLD][k % 4], 'Fabric'),
      pp2(0, [0.25, 3.8, 0.25], [-2.1, 3.7, 4.6], 0x5a3a2a, 'Wood'), pp2(0, [0.25, 3.8, 0.25], [2.1, 3.7, 4.6], 0x5a3a2a, 'Wood'),
    ];
    for (let j = 0; j < 9; j++) parts.push(pp2(3, [0.6, 0.6, 0.6], [-2.2 + j * 0.55, 6.9, -4.6], PICADO[(j + k) % PICADO.length], 'SmoothPlastic'));
    for (const z of [-2.6, -0.4, 1.8, 3.8]) { parts.push(pp2(0, [3.8, 0.3, 0.9], [0, 2.05, z], 0x6a4a2a, 'WoodPlanks')); parts.push(pp2(0, [3.8, 0.9, 0.2], [0, 2.5, z + 0.5], 0x6a4a2a, 'WoodPlanks')); }
    return parts;
  };
  const extras = {}, extrasNames = [], props = [];
  const r = trackRide(data, {
    id: RIDE_ID, name: 'The Mexico Tour', land: 'FiestaPlaza', category: 'Family', thrill: 1, kind: 'flume', carStyle: 'boat',
    description: 'A boat ride through a night of fiesta, inside the great pyramid. Board a painted boat in the twilight plaza under the volcano and drift past a market town strung with papel picado, a mariachi band in the square, a Day of the Dead night of marigolds, candles and dancing skeletons, the cliff divers, an ancient temple and its feathered serpent - and home under a sky of fireworks.',
    baseWait: 25, circuit: CIRCUIT, style: { style: 'flume' }, cars: BOATS, spacing: SPACING, carParts: boat,
    seatList: () => [-2.6, -0.4, 1.8, 3.8].flatMap((z) => [-1, 1].map((x) => [x, 2.2 + 1.3, z - 0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1])),
    env: { half: 3.4, below: 1.6, above: 6.6 }, restraint: 'none', rideExtra: { bob: 0.1 },
    station: { side: 1, carHalf: 3.7, width: 4, y: 0.6, roof: 9 }, origin: [-465, 0, 815], extras, extrasNames, props, roofColor: 0xc85a2a,
    queue: [[-465, 726], [-465, 764], [-480, 766], [-536, 766], [-536, 770], [-480, 770], [-480, 774], [-536, 774], [-536, 778], [-480, 778], [-480, 782], [-536, 782], [-536, 786], [-506, 786], [-503, 794]],
    exit: [-398, 0, 742], colors: [0x2a8ad8, ORANGE, MAGENTA], signColor: ORANGE, line: 'The Mexico Tour is boarding - fiesta inside the pyramid!',
    cues: (at) => [[at(-430, 772), 'fireworks', [0, 8, 0]]],
  });
  const { clearOf } = r;
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos, 1.4) ? add(size, pos, color, mat, o) : -1);
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);

  // ======== inside: always twilight - stars, the moon, the volcano, the market plaza
  add([B.x1 - B.x0 - 2 * T, 0.1, B.z1 - B.z0 - 2 * T], [(B.x0 + B.x1) / 2, G + 0.05, (B.z0 + B.z1) / 2], 0x6a5a48, 'Pavement', { collide: 0 });
  for (let k = 0; k < 120; k++) {
    const x = B.x0 + 3 + ((k * 37.3) % (B.x1 - B.x0 - 6)), z = B.z0 + 3 + ((k * 53.7) % (B.z1 - B.z0 - 6));
    add([0.3, 0.3, 0.3], [x, G + B.H - 0.3, z], k % 5 ? WHITE : 0xfff0b0, 'Neon', { collide: 0, shape: 3 });
  }
  neon([7, 7, 0.4], [-430, G + B.H - 3, B.z1 - T - 0.3], 0xfff4d8, { shape: 2, rot: RY(Math.PI / 2) });
  // the volcano on the plaza's west wall, glowing and smoking
  for (const [w, h, c] of [[30, 12, 0x4a3a32], [20, 18, 0x3a2e28], [11, 19.4, 0x2a2420]]) add([5, h, w], [B.x0 + T + 2.5, G + h / 2, 784], c, 'Slate', { collide: 0, rot: RZ(-0.08) });
  neon([1, 1.6, 8], [B.x0 + T + 4.5, G + 19, 784], 0xff5a10);
  data.tags.SteamVent.push([B.x0 + T + 5, G + 19.6, 784, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(B.x0 + 8, 16, 784, 0xff6a20);
  // market stalls along the plaza's north wall, pinatas hanging, lanterns
  for (let k = 0; k < 5; k++) {
    const x = B.x0 + 10 + k * 11, z = B.z0 + 3.2;
    if (SB([8, 3.6, 3], [x, G, z], 0x8a5a3a, 'WoodPlanks', { collide: 0 }) < 0) continue;
    S([9, 0.3, 4.4], [x, G + 5.4, z + 0.6], PICADO[k % PICADO.length], 'Fabric', { collide: 0, rot: RX(0.25) });
    for (let j = 0; j < 4; j++) S([0.9, 0.9, 0.9], [x - 3 + j * 2, G + 4, z], [ORANGE, RED, LIME, GOLD][(j + k) % 4], 'SmoothPlastic', { collide: 0, shape: 3 });
  }
  const pinata = (x, y, z, c) => { if (S([2.6, 3, 1.4], [x, y, z], c, 'SmoothPlastic', { collide: 0 }) < 0) return; S([1, 1.6, 1], [x + 1.6, y + 1.2, z], c, 'SmoothPlastic', { collide: 0 }); S([0.08, B.H - y - 1.5, 0.08], [x, (y + B.H) / 2 + 0.8, z], 0x3a3a3a, 'Fabric', { collide: 0 }); for (let j = 0; j < 3; j++) S([2.7, 0.3, 1.5], [x, y - 1 + j * 0.9, z], PICADO[(j + 2) % 7], 'Fabric', { collide: 0 }); };
  pinata(-500, 13, 776, MAGENTA); pinata(-516, 14, 784, LIME); pinata(-486, 12.5, 790, GOLD);
  for (let x = B.x0 + 6; x < -470; x += 9) SN([1, 1.3, 1], [x, G + 10 + ((x * 3) % 3), 792], [ORANGE, MAGENTA, GOLD][Math.abs(Math.round(x)) % 3], { shape: 3 });
  light(-505, 9, 780, 0xffb060); light(-480, 9, 798, MAGENTA);

  // ======== scene 1, the market town: house fronts along the south wall, papel picado over the river
  const house = (x, w, h, c) => { if (SB([w, h, 4], [x, G, B.z1 - T - 2], c, 'Slate', { collide: 0 }) < 0) return; for (let j = 0; j < Math.floor(w / 4); j++) S([1.6, 2.2, 0.2], [x - w / 2 + 2.2 + j * 4, G + h - 4, B.z1 - T - 4.1], 0xffd890, 'Neon', { collide: 0 }); S([2.4, 4, 0.2], [x, G + 2, B.z1 - T - 4.1], 0x3a2418, 'WoodPlanks', { collide: 0 }); };
  house(-530, 12, 12, 0xe07a4a); house(-516, 12, 14, 0x3ab8a8); house(-502, 12, 11, 0xe8c040);
  for (let k = 0; k < 4; k++) {
    const x = -536 + k * 11;
    for (let j = 0; j < 7; j++) SN([1.4, 1.2, 0.05], [x + j * 1.5, G + 12 - Math.sin(j / 6 * Math.PI), 850], PICADO[(j + k) % 7]);
  }
  light(-520, 9, 842, ORANGE);

  // ======== scene 2, the mariachi band in the square
  const mariachi = (x, z, yaw, inst, k) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, ly, lz) => [x + lx * c + lz * s, G + ly, z - lx * s + lz * c];
    const suit = k % 2 ? 0x8a1a2a : WHITE;
    S([1.2, 2.6, 0.8], at(0, 1.3, 0), suit, 'Fabric', { collide: 0, rot: RY(yaw) });
    S([1.4, 1.8, 0.9], at(0, 3.5, 0), suit, 'Fabric', { collide: 0, rot: RY(yaw) });
    S([0.8, 0.35, 0.2], at(0, 4.3, -0.5), [RED, TEAL, MAGENTA][k % 3], 'Neon', { collide: 0, rot: RY(yaw) });
    for (let j = 0; j < 4; j++) S([0.14, 0.14, 0.14], at(0.66, 0.6 + j * 0.55, -0.42), 0xe8e8f0, 'Metal', { collide: 0, shape: 3 });
    S([0.8, 0.8, 0.8], at(0, 4.9, 0), 0xc89060, 'SmoothPlastic', { collide: 0, shape: 3 });
    S([3.4, 0.25, 3.4], at(0, 5.5, 0), GOLD, 'Fabric', { collide: 0, shape: 5 });
    S([1, 0.8, 1], at(0, 5.9, 0), GOLD, 'Fabric', { collide: 0, shape: 5 });
    for (let j = -2; j <= 2; j++) S([0.14, 0.14, 0.14], at(0.72, 3.3 + j * 0.35, -0.46), 0xf0d060, 'Metal', { collide: 0, shape: 3 });
    if (inst === 'guitar') { S([1.4, 1.6, 0.4], at(0.2, 3.2, -0.7), 0xc87a3a, 'WoodPlanks', { collide: 0, rot: RY(yaw) }); S([0.3, 0.3, 2.4], at(-0.4, 3.9, -1.2), 0x6a3a1a, 'Wood', { collide: 0, rot: RY(yaw + 0.9) }); }
    else if (inst === 'trumpet') S([0.3, 0.3, 1.8], at(0, 4.7, -1.1), GOLD, 'Metal', { collide: 0, rot: RY(yaw) });
    else S([0.4, 2.2, 0.4], at(0.6, 3.6, -0.5), 0x6a3a1a, 'Wood', { collide: 0, rot: RZ(0.5) });
  };
  [[-494, 834, 'guitar'], [-489, 836, 'trumpet'], [-484, 834, 'violin'], [-479, 836, 'guitar'], [-474, 834, 'trumpet']].forEach(([x, z, inst], k) => mariachi(x, z, Math.PI, inst, k));
  for (let j = 0; j < 9; j++) SN([0.9, 0.9, 0.9], [-496 + j * 3, G + 8.6, 829.4], [GOLD, ORANGE, 0xfff0c0][j % 3], { shape: 3 });
  light(-484, 7, 832, 0xffe0a0);
  SB([30, 0.6, 12], [-484, G, 834], 0x9a6a40, 'WoodPlanks', { collide: 0 });
  for (const x of [-497, -471]) { SB([0.4, 9, 0.4], [x, G, 829], 0x5a3a2a, 'Wood', { collide: 0 }); }
  S([27, 1.6, 0.3], [-484, G + 9.4, 829], INK, 'SmoothPlastic', { collide: 0 });
  sign([25, 1.4, 0.3], [-484, G + 9.4, 828.8], INK, 'Front', [['¡MARIACHI!', 0, 0, 1, 1, GOLD]], { glow: true });
  light(-484, 9, 838, GOLD);

  // ======== scene 3, the Day of the Dead: marigold arches, an altar of candles, skeletons dancing
  for (const x of [-462, -446]) {
    if (S([1, 10, 1], [x, G + 5, 856], ORANGE, 'SmoothPlastic', { collide: 0 }) < 0) continue;
    for (let j = 0; j < 14; j++) { const a = (j / 13) * Math.PI; S([1, 1, 1], [x + Math.cos(a) * 5 - 5 + (x < -455 ? 5 : -5) * 0, G + 10 + Math.sin(a) * 4, 856], j % 2 ? ORANGE : 0xffc020, 'SmoothPlastic', { collide: 0, shape: 3 }); }
  }
  if (SB([16, 3, 4], [-454, G, 856], 0x8a3a6a, 'WoodPlanks', { collide: 0 }) >= 0) {
    SB([12, 2.4, 3], [-454, G + 3, 856.4], 0x6a2a5a, 'WoodPlanks', { collide: 0 });
    for (let j = 0; j < 12; j++) SN([0.3, 0.8, 0.3], [-460 + j, G + 3.4 + (j % 3) * 2.6, 854.2 - (j % 2)], 0xffc060);
    for (let j = 0; j < 3; j++) { S([1.4, 1.4, 1.2], [-458 + j * 4, G + 7, 856], WHITE, 'SmoothPlastic', { collide: 0, shape: 3 }); for (const ex of [-0.3, 0.3]) S([0.35, 0.35, 0.2], [-458 + j * 4 + ex, G + 7.2, 855.4], [MAGENTA, TEAL, ORANGE][j], 'Neon', { collide: 0, shape: 3 }); }
    light(-454, 6, 852, 0xff9a30);
  }
  const skeleton = (x, z, phase) => {
    S([0.5, 2.4, 0.3], [x, G + 4, z], WHITE, 'SmoothPlastic', { collide: 0 });
    S([1, 1, 0.8], [x, G + 5.8, z], WHITE, 'SmoothPlastic', { collide: 0, shape: 3 });
    for (const sx of [-1, 1]) { S([0.2, 2, 0.2], [x + sx * 0.4, G + 1.4, z], WHITE, 'SmoothPlastic', { collide: 0, rot: RZ(sx * 0.25) }); S([0.2, 1.8, 0.2], [x + sx * 0.8, G + 5, z], WHITE, 'SmoothPlastic', { collide: 0, rot: RZ(sx * (1.2 + phase * 0.3)) }); }
    S([2.4, 0.2, 1.6], [x, G + 6.4, z], [MAGENTA, ORANGE, TEAL][phase % 3], 'Fabric', { collide: 0, shape: 5 });
  };
  for (const [x, z, k] of [[-468, 836, 0], [-440, 836, 1], [-454, 838, 2]]) skeleton(x, z, k);
  for (let k = 0; k < 20; k++) SN([0.4, 0.4, 0.4], [-468 + (k * 1.7) % 30, G + 0.4, 840 + (k % 4)], 0xffb040, { shape: 3 });

  // ======== scene 4, the cliff divers: a cliff in the south-east corner, a waterfall, a diver falling
  if (S([12, 18, 12], [-389, G + 9, 852], 0x6a5a4a, 'Slate', { collide: 0 }) >= 0) {
    S([6, 3, 5], [-391, G + 18.6, 848], 0x7a6a58, 'Slate', { collide: 0 });
    S([0.3, 16, 4], [-394.6, G + 9, 852], 0x9ad0e8, 'Glass', { collide: 0, trans: 0.4 });
    light(-392, 14, 846, 0x9ad0f0);
  }
  {
    const at = [-392, G + 18, 846];
    const parts = [pp(0, [0.5, 1.8, 0.4], [0, 0, 0], 0xc89060, 'SmoothPlastic'), pp(3, [0.6, 0.6, 0.6], [0, 1.2, 0], 0xc89060, 'SmoothPlastic'), pp(0, [0.2, 1.4, 0.2], [0, 2.2, 0], 0xc89060, 'SmoothPlastic'), pp(0, [0.55, 0.5, 0.45], [0, -0.5, 0], 0x2a2a8a, 'Fabric')];
    if (clearOf([2, 20, 2], [at[0], G + 10, at[2]], 0.8)) { extras.Diver = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts }; props.push({ name: 'Diver', at, kind: 'fall', period: 4, phase: 0, drop: 16 }); extrasNames.push('Diver'); }
  }

  // ======== scene 5, the ancient temple: a stepped temple, its feathered serpent, torches
  if (SB([18, 3, 14], [-414, G, 812], STONE2, 'Slate', { collide: 0 }) >= 0) {
    SB([13, 3, 10], [-414, G + 3, 812], STONE, 'Slate', { collide: 0 });
    SB([8, 4, 6], [-414, G + 6, 812], STONE2, 'Slate', { collide: 0 });
    S([0.3, 3, 3], [-409.9, G + 8, 812], 0xff8a2a, 'Neon', { collide: 0 });
    for (const [w, d, y] of [[18, 14, 2.6], [13, 10, 5.6], [8, 6, 9.6]]) { S([0.2, 0.4, d + 0.2], [-414 + w / 2 + 0.05, G + y, 812], 0x3ad8c0, 'Neon', { collide: 0 }); S([w + 0.2, 0.4, 0.2], [-414, G + y, 812 - d / 2 - 0.05], 0x3ad8c0, 'Neon', { collide: 0 }); S([w + 0.2, 0.4, 0.2], [-414, G + y, 812 + d / 2 + 0.05], 0x3ad8c0, 'Neon', { collide: 0 }); }
    light(-404, 5, 799, 0x3ad8a8);
    for (let j = 0; j < 10; j++) S([1.4, 1.4, 1.4], [-404.6, G + 1 + j * 0.2, 800 + j * 2.4], j === 0 ? 0x3aa86a : (j % 2 ? 0x2a8a5a : 0x3aa86a), 'Slate', { collide: 0, shape: 3 });
    S([2.4, 2, 2.6], [-404.6, G + 1.6, 797.6], 0x3aa86a, 'Slate', { collide: 0 });
    for (const dz of [-0.6, 0.6]) SN([0.4, 0.4, 0.3], [-403.4, G + 2.2, 797.6 + dz], GOLD, { shape: 3 });
    for (let j = 0; j < 6; j++) SN([0.3, 1.2, 1.4], [-404.6, G + 3.4, 798.6 + j * 0.3], [0x3ad8a8, GOLD, MAGENTA][j % 3], { rot: RX(0.3 * j) });
    for (const z of [804, 820]) { S([0.5, 5, 0.5], [-405, G + 2.5, z], 0x5a3a2a, 'Wood', { collide: 0 }); data.tags.Campfire.push([-405, G + 5.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]); }
    light(-408, 8, 812, 0xffa040);
  }

  // ======== the finale: a sky of fireworks over the north-east, lanterns, FIESTA
  for (const [x, y, z, c] of [[-420, 16, 768, MAGENTA], [-440, 17, 766, GOLD], [-404, 15, 790, TEAL], [-425, 18, 790, ORANGE]]) {
    for (let j = 0; j < 10; j++) { const a = (j / 10) * Math.PI * 2; SN([0.3, 2.6, 0.3], [x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, z], c, { rot: RZ(a - Math.PI / 2) }); }
    SN([0.8, 0.8, 0.8], [x, y, z], WHITE, { shape: 3 });
  }
  sign([18, 3, 0.3], [-430, G + 12, B.z0 + T + 0.3], INK, 'Back', [['¡FIESTA!', 0, 0, 1, 1, MAGENTA]], { glow: true });
  light(-425, 12, 775, MAGENTA); light(-410, 12, 790, GOLD);
  return { ride: r.ride, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, entrance: [-465, 726], supports: r.supports };
}

// a toast the first time you come near
export class MexicoTourSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const [x, z] = this.layout.entrance;
    if (Math.hypot(pos.x - x, pos.z - z) < 60) {
      this.told = true;
      this.hooks.toast('NEW in Natural Kingdom: The Mexico Tour - a boat ride through a night of fiesta, inside the pyramid in Fiesta Plaza!', 'reward');
    }
  }
}
