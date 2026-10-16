import { HAUNT_OVER, CHRISTMAS, XMAS_OVER, MARDI_GRAS } from './season.js';

// The Benton resort district outside the gate: the Benton Parkway running
// past the toll plaza, three hotels (the Benton Diesel Grand, the Haulers
// Roadside Inn and the Backwoods Lodge), the Benton Transit Center beside
// security where the free shuttles stop, connector roads around the lot,
// streetlights, and Benton Haunt billboards along every road.
// buildResort() adds the static world; the live buses and traffic are in
// transit.js.

const ROAD = 0.34; // road top
const ASPHALT = 0x3c3e42, WHITE = 0xf2f2ee, YELLOW = 0xf2c818, DARK = 0x1e222c, BLACK = 0x101012, ORANGE = 0xff7a1a, PUMPKIN = 0xd85400;

// the parkway: westbound lane on the north side, eastbound on the south
export const PARKWAY = { z: 655, half: 12, x0: -760, x1: 760, wb: 649, eb: 661 };
// connector roads beside the lot: southbound and northbound lanes
export const EAST_LINK = { x: 340, sb: 334, nb: 346, z0: 288 };
export const WEST_LINK = { x: -340, sb: -346, nb: -334, z0: 452 };
// the Transit Center loop beside security: westbound lane, U-turn,
// eastbound lane with the platform on its south side
export const TRANSIT = { wb: 300, eb: 326, turnX: 182, stopX: 262, platform: { x0: 214, x1: 314, z0: 331, z1: 345 } };

const R = 18; // bus path radius around each hotel's drive circle
export const HOTELS = [
  {
    id: 'GrandHotel', name: 'Benton Diesel Grand Hotel', short: 'Grand Hotel', x: 470, cz: 530, north: true,
    spot: [503, 608], stopAt: [470, 501], color: 0xf0c440,
  },
  {
    id: 'HaulersInn', name: 'Haulers Roadside Inn', short: 'Haulers Inn', x: -470, cz: 530, north: true,
    spot: [-515, 608], stopAt: [-470, 499], color: 0xff6a3a,
  },
  {
    id: 'BackwoodsLodge', name: 'Backwoods Lodge', short: 'Backwoods Lodge', x: -190, cz: 720, north: false,
    spot: [-238, 688], stopAt: [-190, 744], color: 0x8ac060,
  },
];

// points around a circle from angle a0 to a1 (x = cx + r cos a, z = cz + r sin a)
function arc(cx, cz, r, a0, a1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

// around a hotel's drive circle with the island on the driver's left: in
// and out on the right-hand lanes, the stop at the apex nearest the hotel
function hotelLoop(h) {
  const { x, cz } = h;
  if (h.north) {
    return [[x + 6, cz + R + 12], [x + 10, cz + 10], ...arc(x, cz, R, 0, -Math.PI, 12), [x - 10, cz + 10], [x - 6, cz + R + 12]];
  }
  return [[x - 6, cz - R - 12], [x - 10, cz - 10], ...arc(x, cz, R, Math.PI, 0, 12), [x + 10, cz - 10], [x + 6, cz - R - 12]];
}

// The shuttle's loop: Transit Center, Grand Hotel, Backwoods Lodge, Haulers
// Inn and back, keeping right the whole way.
export function busLoop() {
  const P = PARKWAY, E = EAST_LINK, T = TRANSIT;
  const [grand, inn, lodge] = HOTELS;
  return [
    // up the connector and into the Transit Center loop
    [E.nb, P.eb - 8], [E.nb, T.wb + 12], [E.nb - 12, T.wb],
    [T.turnX, T.wb], ...arc(T.turnX, (T.wb + T.eb) / 2, (T.eb - T.wb) / 2, -Math.PI / 2, -Math.PI * 1.5, 10).slice(1),
    [E.sb - 12, T.eb], [E.sb, T.eb + 12],
    // down to the parkway and east to the Grand
    [E.sb, P.eb - 8], [E.sb + 10, P.eb], [grand.x + 6 - 10, P.eb], [grand.x + 6, P.eb - 10],
    ...hotelLoop(grand),
    [grand.x - 6, P.wb + 8], [grand.x - 16, P.wb],
    // west to the Lodge, across the eastbound lane
    [lodge.x - 6 + 16, P.wb], [lodge.x - 6, P.eb + 6],
    ...hotelLoop(lodge),
    [lodge.x + 6, P.eb + 4], [lodge.x - 8, P.wb],
    // west to the Inn
    [inn.x + 6 + 12, P.wb], [inn.x + 6, P.wb - 10],
    ...hotelLoop(inn),
    [inn.x - 6, P.eb - 8], [inn.x - 6 + 12, P.eb],
    // and east all the way back
    [E.nb - 12, P.eb],
  ];
}

// the stops on the loop: where the bus halts and where riders stand
export const BUS_STOPS = [
  { id: 'transit', name: 'Benton Transit Center', short: 'Transit Center', at: [TRANSIT.stopX, TRANSIT.eb], wait: [TRANSIT.stopX, 338] },
  ...HOTELS.map((h) => ({ id: h.id, name: h.name, short: h.short, at: [h.x, h.north ? h.cz - R : h.cz + R], wait: h.stopAt })),
];

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
  // a sign with several labels: [text, x, y, w, h, color, font]
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

// local frame helper: u across, n toward the viewer, for a yaw
const frame = (x, z, yaw) => {
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  return (u, n) => [x + ux * u + nx * n, z + uz * u + nz * n];
};

// after the event, the boards thank everyone and sell the park
const ADS_OVER = [
  { title: 'FAST & FURIOUS', sub: 'BENTON STREET RUN  ·  NOW OPEN', foot: 'VELOCITY CITY  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0xff6a1a },
  { title: "IT'S ABOUT FAMILY", sub: 'FAST & FURIOUS IS COMING TO BENTON DIESEL WORLD', foot: 'NOW OPEN IN VELOCITY CITY', art: 'moon', fg: 0x9ad8ff },
  { title: 'THANKS FOR SCREAMING!', sub: 'BENTON HAUNT RETURNS NEXT FALL', foot: 'BENTON DIESEL WORLD', art: 'pumpkin', fg: ORANGE },
  { title: 'RIDE OVERDRIVE', sub: 'THE NEW COASTER AT BENTON DIESEL WORLD', foot: 'NEXT EXIT', art: 'moon', fg: 0xff5a2a },
  { title: 'SEE YOU NEXT FALL', sub: 'THE HOUSES ARE COMING DOWN... FOR NOW', foot: 'BENTON HAUNT', art: 'skull', fg: 0xb08aff },
  { title: 'SPEED FUELS PEOPLE TOGETHER', sub: 'BENTON DIESEL WORLD  ·  OPEN DAILY', foot: 'PARKING · SHUTTLES · HOTELS', art: 'moon', fg: 0xf2c818 },
  { title: 'STAY AT THE GRAND', sub: 'FREE SHUTTLE TO THE PARK', foot: 'BENTON DIESEL GRAND HOTEL', art: 'pumpkin', fg: 0xf0c440 },
  { title: 'WE SURVIVED BENTON HAUNT', sub: 'DID YOU?', foot: 'SEE YOU NEXT HALLOWEEN', art: 'skull', fg: 0xff3a20 },
  { title: 'HOORAY FOR HOLLYWOOD', sub: 'THE BACKLOT TRAM TOUR', foot: 'BENTON DIESEL WORLD  ·  NEXT EXIT', art: 'moon', fg: 0xffd27a },
];

// at Christmas, the holiday ads (and the new ride)
const ADS_XMAS = [
  { title: 'HAPPY HOLIDAYS!', sub: 'BENTON HOLIDAYS  ·  THROUGH JANUARY 1', foot: 'BENTON DIESEL WORLD', art: 'moon', fg: 0xff3a3a },
  { title: 'MEET SANTA', sub: "SANTA'S WORKSHOP IS OPEN", foot: 'BENTON HOLIDAYS  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0xf0c040 },
  { title: 'FAST & FURIOUS', sub: 'BENTON STREET RUN  ·  NOW OPEN', foot: 'VELOCITY CITY  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0xff6a1a },
  { title: 'LIGHTS ON EVERY RIDE', sub: 'SEE THE PARK SPARKLE AFTER DARK', foot: 'BENTON HOLIDAYS  ·  THROUGH JAN 1', art: 'moon', fg: 0x40ff60 },
  { title: 'STAY FOR THE HOLIDAYS', sub: 'FREE SHUTTLE TO THE PARK', foot: 'BENTON DIESEL GRAND HOTEL', art: 'moon', fg: 0xf0c040 },
];

// the new year: Wolverine is coming
const ADS_NEWYEAR = [
  { title: 'WOLVERINE', sub: 'THE CLAWS ARE OUT  ·  COMING SOON', foot: 'BENTON DIESEL WORLD', art: 'skull', fg: 0xf2c818 },
  { title: 'HAPPY NEW YEAR!', sub: 'THANKS FOR A GREAT HOLIDAY SEASON', foot: 'BENTON DIESEL WORLD', art: 'moon', fg: 0xf0c040 },
  { title: 'FAST & FURIOUS', sub: 'BENTON STREET RUN  ·  NOW OPEN', foot: 'VELOCITY CITY  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0xff6a1a },
  { title: 'AN 80-STUD TOP HAT', sub: 'WOLVERINE IS GOING UP NOW', foot: 'COMING SOON TO BENTON DIESEL WORLD', art: 'moon', fg: 0x3a6aff },
  { title: 'SPEED FUELS PEOPLE TOGETHER', sub: 'BENTON DIESEL WORLD  ·  OPEN DAILY', foot: 'PARKING · SHUTTLES · HOTELS', art: 'moon', fg: 0xf2c818 },
];

// Wolverine is open, and Mardi Gras at the Grand
const ADS_MARDI = [
  { title: 'WOLVERINE', sub: 'THE CLAWS ARE OUT  ·  NOW OPEN', foot: 'BACKWOODS  ·  BENTON DIESEL WORLD', art: 'skull', fg: 0xf2c818 },
  { title: 'MARDI GRAS AT THE GRAND', sub: "KING CAKE · BEIGNETS · PO'BOYS", foot: 'LIMITED TIME  ·  BENTON DIESEL GRAND HOTEL', art: 'moon', fg: 0xb070ff },
  { title: 'AN 80-STUD TOP HAT', sub: 'RIDE WOLVERINE TODAY', foot: 'NOW OPEN AT BENTON DIESEL WORLD', art: 'moon', fg: 0x3a6aff },
  { title: 'LAISSEZ LES BONS TEMPS ROULER', sub: 'MARDI GRAS BAR  ·  HURRICANE PUNCH', foot: 'BENTON DIESEL GRAND HOTEL', art: 'moon', fg: 0xf0c030 },
  { title: 'FAST & FURIOUS', sub: 'BENTON STREET RUN  ·  NOW OPEN', foot: 'VELOCITY CITY  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0xff6a1a },
];

// the Benton Haunt ads on the billboards
const ADS = MARDI_GRAS ? ADS_MARDI : CHRISTMAS ? ADS_XMAS : XMAS_OVER ? ADS_NEWYEAR : HAUNT_OVER ? ADS_OVER : [
  { title: 'BENTON HAUNT', sub: '6 HOUSES  ·  6 SCARE ZONES', foot: 'SELECT NIGHTS THROUGH NOV 2', art: 'moon', fg: ORANGE },
  { title: "DEAD MAN'S GARAGE", sub: 'YOUR CAR IS OVERDUE FOR SERVICE...', foot: 'BENTON HAUNT  ·  NOW OPEN', art: 'skull', fg: 0xff3a20 },
  { title: 'LIGHTS OUT AT LAKESIDE', sub: 'THE LAKE REMEMBERS', foot: 'BENTON HAUNT  ·  BENTON DIESEL WORLD', art: 'moon', fg: 0x9ad8ff },
  { title: 'DO YOU DARE?', sub: 'BENTON HAUNT IS OPEN', foot: 'NEXT EXIT  ·  BENTON DIESEL WORLD', art: 'pumpkin', fg: ORANGE },
  { title: 'FINAL CUT', sub: 'A HOLLYWOOD HORROR', foot: 'NOW SHOWING AT BENTON HAUNT', art: 'skull', fg: 0xff2030 },
  { title: 'ENGINE WORKS: MELTDOWN', sub: 'THE NIGHT SHIFT NEVER ENDS', foot: 'BENTON HAUNT  ·  THROUGH NOV 2', art: 'pumpkin', fg: 0xff6a10 },
  { title: 'THE LOST MINERS', sub: 'OF BACKWOODS HOLLOW  ·  NOBODY LEAVES THE MINE', foot: 'BENTON HAUNT', art: 'moon', fg: 0xffd040 },
  { title: 'CRASH TEST', sub: 'BUCKLE UP. IMPACT IN 3... 2...', foot: 'BENTON HAUNT  ·  NOW OPEN', art: 'skull', fg: 0xf2c818 },
  { title: 'STAY & SCREAM', sub: 'HAUNT NIGHTS + A ROOM AT THE GRAND', foot: 'FREE SHUTTLE TO BENTON HAUNT', art: 'pumpkin', fg: 0xf0c440 },
  { title: 'MIDNIGHT AT THE GATE', sub: 'THE REAPERS ARE WAITING', foot: 'BENTON HAUNT SCARE ZONES', art: 'moon', fg: 0xb08aff },
];

export function buildResort(data) {
  const { add, box, sign, cf } = helpers(data);
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.staffSpots = data.staffSpots || [];
  const lamp = (x, z, h = 13, armYaw = null) => {
    box([0.6, h, 0.6], [x, ROAD, z], DARK, 'Metal', { shape: 5 });
    if (armYaw !== null) {
      const [ax, az] = [x + Math.sin(armYaw) * 2.5, z + Math.cos(armYaw) * 2.5];
      add([0.3, 0.3, 5], [ax, ROAD + h - 0.3, az], DARK, 'Metal', { collide: 0, yaw: armYaw });
      add([1.4, 0.5, 1.4], [x + Math.sin(armYaw) * 4.8, ROAD + h - 0.7, z + Math.cos(armYaw) * 4.8], 0xffecbe, 'Neon', { collide: 0 });
      data.tags.ParkLamp.push([x + Math.sin(armYaw) * 4.8, ROAD + h - 0.9, z + Math.cos(armYaw) * 4.8, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    } else {
      add([1.4, 1.4, 1.4], [x, ROAD + h + 0.5, z], 0xffecbe, 'Neon', { collide: 0, shape: 3 });
      data.tags.ParkLamp.push([x, ROAD + h + 0.5, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
  };
  Object.assign(data.staff.lines, {
    hotel: ['Welcome! Enjoy your stay!', 'The shuttle stops right out front!', MARDI_GRAS ? 'Happy Mardi Gras! Have you ridden Wolverine yet?' : CHRISTMAS ? 'Happy holidays! Santa is at his workshop in the park!' : XMAS_OVER ? 'Happy New Year! Have you seen Wolverine going up?' : HAUNT_OVER ? 'Benton Haunt is over - see you next fall!' : 'Have a frightful night at Benton Haunt!', 'Need a hand with your bags?'],
    transit: ['Free shuttles to all three hotels!', 'Next bus is on its way!', 'Watch your step getting off!', 'Security is just this way!'],
  });
  const staff = (role, kind, x, y, z, yaw) => data.staffSpots.push({ role, kind, land: 'Plaza', seed: 0, cf: cf(x, y, z, yaw) });
  const P = PARKWAY;

  // level ground for the hotels and roads (and no forest on them)
  data.flatZones = [...(data.flatZones || []),
    { x0: P.x0, x1: P.x1, z0: P.z - 30, z1: P.z + 30, margin: 40 },
    { x0: 380, x1: 560, z0: 420, z1: 640, margin: 40 },
    { x0: -560, x1: -380, z0: 420, z1: 640, margin: 40 },
    { x0: -280, x1: -100, z0: 660, z1: 820, margin: 40 },
    { x0: 320, x1: 360, z0: 280, z1: 660, margin: 20 },
    { x0: -360, x1: -320, z0: 440, z1: 660, margin: 20 },
  ];

  // ---------------------------------------------------------------- roads
  const road = (x0, z0, x1, z1) => add([x1 - x0, 0.4, z1 - z0], [(x0 + x1) / 2, ROAD - 0.2, (z0 + z1) / 2], ASPHALT, 'Asphalt');
  const stripe = (x0, z0, x1, z1, color, dash = 0) => {
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = along ? x1 - x0 : z1 - z0;
    if (!dash) {
      add(along ? [len, 0.04, 0.35] : [0.35, 0.04, len], [(x0 + x1) / 2, ROAD + 0.02, (z0 + z1) / 2], color, 'SmoothPlastic', { collide: 0 });
      return;
    }
    for (let t = 0; t + 6 <= len; t += dash) {
      const c = t + 3;
      add(along ? [6, 0.04, 0.35] : [0.35, 0.04, 6], along ? [x0 + c, ROAD + 0.02, z0] : [x0, ROAD + 0.02, z0 + c], color, 'SmoothPlastic', { collide: 0 });
    }
  };
  // the parkway, with a double yellow line broken at each junction
  road(P.x0, P.z - P.half, P.x1, P.z + P.half);
  const cuts = [-470, -190, 0, 340, -340, 470].map((x) => [x - (x === 0 ? 28 : 16), x + (x === 0 ? 28 : 16)]).sort((a, b) => a[0] - b[0]);
  let from = P.x0;
  for (const [c0, c1] of [...cuts, [P.x1, P.x1]]) {
    if (c0 > from + 1) {
      stripe(from, P.z - 0.3, c0, P.z - 0.3, YELLOW);
      stripe(from, P.z + 0.3, c0, P.z + 0.3, YELLOW);
      stripe(from, P.z - P.half + 0.8, c0, P.z - P.half + 0.8, WHITE);
      stripe(from, P.z + P.half - 0.8, c0, P.z + P.half - 0.8, WHITE);
    }
    from = c1;
  }
  // connectors beside the lot
  road(EAST_LINK.x - 12, EAST_LINK.z0, EAST_LINK.x + 12, P.z - P.half);
  stripe(EAST_LINK.x, TRANSIT.eb + 14, EAST_LINK.x, P.z - P.half - 2, YELLOW, 12);
  road(WEST_LINK.x - 12, WEST_LINK.z0, WEST_LINK.x + 12, P.z - P.half);
  stripe(WEST_LINK.x, WEST_LINK.z0 + 4, WEST_LINK.x, P.z - P.half - 2, YELLOW, 12);
  // the lot's west aisles reach the west connector
  road(-328, WEST_LINK.z0, -318, 590);
  // the Transit Center loop
  road(TRANSIT.turnX - 18, TRANSIT.wb - 7, EAST_LINK.x + 12, TRANSIT.eb + 6);
  stripe(TRANSIT.turnX, (TRANSIT.wb + TRANSIT.eb) / 2, EAST_LINK.x - 16, (TRANSIT.wb + TRANSIT.eb) / 2, YELLOW, 10);
  // hotel driveways and drive circles
  for (const h of HOTELS) {
    const z0 = h.north ? h.cz + 20 : P.z + P.half, z1 = h.north ? P.z - P.half : h.cz - 20;
    road(h.x - 12, z0, h.x + 12, z1);
    stripe(h.x, z0 + 2, h.x, z1 - 2, YELLOW, 10);
    add([54, 0.4, 54], [h.x, ROAD - 0.2, h.cz], ASPHALT, 'Asphalt', { shape: 5 });
    box([20, 0.8, 20], [h.x, ROAD, h.cz], 0xc8c6c0, 'Concrete', { shape: 5 });
    add([18, 0.1, 18], [h.x, ROAD + 0.85, h.cz], 0x4a8a3a, 'Grass', { shape: 5, collide: 0 });
  }

  // streetlights along the parkway, alternating sides
  for (let x = -720; x <= 720; x += 60) {
    if ([-470, -190, 0, 340, -340, 470].some((c) => Math.abs(x - c) < 24)) continue;
    const north = (x / 60) % 2 === 0;
    lamp(x, north ? P.z - P.half - 2.5 : P.z + P.half + 2.5, 13, north ? 0 : Math.PI);
  }
  for (let z = 380; z < 640; z += 60) {
    lamp(EAST_LINK.x + 15, z, 12, -Math.PI / 2);
    if (z > WEST_LINK.z0) lamp(WEST_LINK.x - 15, z, 12, Math.PI / 2);
  }

  // street signs at the main junction
  for (const [x, z, face, text] of [[30, P.z - P.half - 4, 'Back', 'BENTON PARKWAY'], [-30, P.z + P.half + 4, 'Front', 'BENTON PARKWAY']]) {
    box([0.4, 10, 0.4], [x, ROAD, z], DARK, 'Metal');
    sign([14, 1.8, 0.2], [x, ROAD + 10.4, z], 0x1e6a3a, face, [[text, 0, 0, 1, 1, WHITE, 'GothamBold']]);
    sign([12, 1.6, 0.2], [x, ROAD + 8.4, z], 0x1e3a6a, face, [['◀ HOTELS  ·  PARK ▲  ·  HOTELS ▶', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  }

  // ------------------------------------------------------- transit center
  const T = TRANSIT, pf = T.platform;
  box([pf.x1 - pf.x0, 0.8, pf.z1 - pf.z0], [(pf.x0 + pf.x1) / 2, 0, (pf.z0 + pf.z1) / 2], 0xc8c6c0, 'Concrete');
  add([pf.x1 - pf.x0, 0.05, 0.6], [(pf.x0 + pf.x1) / 2, 0.82, pf.z0 + 0.4], YELLOW, 'SmoothPlastic', { collide: 0 });
  for (let x = pf.x0 + 4; x <= pf.x1 - 4; x += 16) box([0.8, 11.4, 0.8], [x, 0.8, pf.z1 - 1.2], 0x2a3a5a, 'Metal');
  add([pf.x1 - pf.x0 + 4, 0.8, pf.z1 - pf.z0 + 3], [(pf.x0 + pf.x1) / 2, 12.6, (pf.z0 + pf.z1) / 2 - 1.5], 0x2a3a5a, 'Metal', { collide: 0 });
  sign([64, 2.4, 0.4], [(pf.x0 + pf.x1) / 2, 14.2, pf.z0 - 2.9], 0x16223a, 'Front', [['BENTON TRANSIT CENTER', 0, 0, 1, 1, 0xfaf3e0]], { glow: true });
  sign([64, 2.4, 0.4], [(pf.x0 + pf.x1) / 2, 14.2, pf.z1 + 0.1], 0x16223a, 'Back', [['BENTON TRANSIT CENTER', 0, 0, 1, 1, 0xfaf3e0]], { glow: true });
  for (let x = pf.x0 + 12; x < pf.x1 - 8; x += 22) {
    box([8, 0.4, 1.6], [x, 2.4, pf.z1 - 3], 0x6a4a30, 'Wood', { collide: 0 });
    box([8, 1.8, 0.3], [x, 2.6, pf.z1 - 2.1], 0x6a4a30, 'Wood', { collide: 0 });
    for (const dx of [-3.4, 3.4]) box([0.4, 1.6, 1.4], [x + dx, 0.8, pf.z1 - 3], DARK, 'Metal', { collide: 0 });
  }
  // the departures board
  box([0.5, 6, 0.5], [pf.x0 + 4, 0.8, pf.z0 + 3], DARK, 'Metal');
  box([0.5, 6, 0.5], [pf.x0 + 16, 0.8, pf.z0 + 3], DARK, 'Metal');
  sign([14, 6, 0.4], [pf.x0 + 10, 9.8, pf.z0 + 3], BLACK, 'Back', [
    ['BENTON SHUTTLE', 0, 0, 1, 0.3, YELLOW], ['GRAND HOTEL  ·  BACKWOODS LODGE  ·  HAULERS INN', 0, 0.32, 1, 0.3, WHITE, 'GothamBold'],
    ['FREE  ·  EVERY FEW MINUTES', 0, 0.66, 1, 0.3, 0x40ff80, 'GothamBold'],
  ], { glow: true });
  staff('transit', 'stop', pf.x0 + 28, 0.8, pf.z0 + 4, 0);
  staff('transit', 'stop', pf.x1 - 10, 0.8, pf.z0 + 4, 0);

  // ----------------------------------------------------- bus stop shelter
  const shelter = (x, z, yaw, name) => {
    const at = frame(x, z, yaw);
    box([12, 0.5, 5], [x, ROAD, z], 0xc8c6c0, 'Concrete', { yaw });
    for (const u of [-5.6, 5.6]) for (const n of [-2.2, 2]) { const [px, pz] = at(u, n); box([0.3, 8.4, 0.3], [px, ROAD + 0.5, pz], 0x2a3a5a, 'Metal', { collide: 0 }); }
    const [bx, bz] = at(0, -2.2);
    box([11.4, 6.4, 0.2], [bx, ROAD + 1.5, bz], 0xa8cce0, 'Glass', { yaw, trans: 0.5 });
    add([13, 0.5, 6], [x, ROAD + 9.1, z], 0x2a3a5a, 'Metal', { yaw, collide: 0 });
    const [sx, sz] = at(0, -1.2);
    box([8, 0.4, 1.4], [sx, ROAD + 2.2, sz], 0x6a4a30, 'Wood', { yaw, collide: 0 });
    const [px, pz] = at(7.4, 2.4);
    box([0.4, 9, 0.4], [px, ROAD, pz], DARK, 'Metal');
    sign([3.2, 3.2, 0.2], [px, ROAD + 9.4, pz], 0x1e6ee6, 'Back', [['BUS', 0, 0, 1, 0.5, WHITE], [name.toUpperCase(), 0, 0.5, 1, 0.5, WHITE, 'GothamBold']], { yaw });
  };

  // a parked car (static) in a hotel lot
  const COLORS = [0xc42828, 0x1e6ee6, 0xf0f0f0, 0x1e1e22, 0xf0c440, 0x78828c, 0x40a048, 0x8a2a2a, 0xd0d4da];
  let ci = 7;
  const car = (x, z, yaw = 0) => {
    const c = COLORS[(ci = (ci * 7 + 3) % COLORS.length)];
    add([6.5, 2.4, 11], [x, ROAD + 2.1, z], c, 'SmoothPlastic', { yaw });
    add([6, 2.2, 6], [x, ROAD + 4.4, z + 0.5], 0x1e2a36, 'SmoothPlastic', { collide: 0 });
    add([6.1, 1.6, 5.4], [x, ROAD + 4.3, z + 0.5], 0xa0c8e6, 'Glass', { collide: 0 });
    for (const [wx, wz] of [[-3.2, -3.6], [-3.2, 3.6], [3.2, -3.6], [3.2, 3.6]]) add([0.8, 2.6, 2.6], [x + wx, ROAD + 1.3, z + wz], 0x191919, 'Rubber', { shape: 2, collide: 0 });
  };
  const lot = (x0, z0, x1, z1, rows, skip = []) => {
    road(x0, z0, x1, z1);
    for (const z of rows) {
      for (let x = x0 + 6; x <= x1 - 6; x += 9) {
        add([0.3, 0.05, 11], [x - 4.5, ROAD + 0.02, z], WHITE, 'SmoothPlastic', { collide: 0 });
        if (!skip.some(([sx, sz]) => Math.abs(sx - x) < 5 && Math.abs(sz - z) < 7) && ((x * 13 + z * 7) % 10) < 7) car(x, z);
      }
    }
  };

  // ------------------------------------------------- Benton Diesel Grand
  {
    const h = HOTELS[0];
    const X = h.x, F = 490; // facade
    const CREAM = 0xe8dcc4, TRIM = 0xd2c4a6, GLASS = 0x2a4a6a;
    box([100, 75, 42], [X, 0, F - 21], CREAM, 'Concrete');
    for (let f = 0; f < 13; f++) {
      const y = 11 + f * 5;
      add([96, 2.8, 0.4], [X, y + 1.6, F + 0.2], GLASS, 'Glass', { collide: 0 });
      add([96, 2.8, 0.4], [X, y + 1.6, F - 42.2], GLASS, 'Glass', { collide: 0 });
      for (const sx of [-1, 1]) add([0.4, 2.8, 38], [X + sx * 50.2, y + 1.6, F - 21], GLASS, 'Glass', { collide: 0 });
    }
    for (let u = -48; u <= 48; u += 12) add([1.2, 66, 1.4], [X + u, 42, F + 0.5], TRIM, 'Concrete', { collide: 0 });
    add([104, 3, 46], [X, 76.5, F - 21], TRIM, 'Concrete', { collide: 0 });
    box([60, 8, 24], [X, 78, F - 21], CREAM, 'Concrete', { collide: 0 });
    sign([86, 9, 1], [X, 84, F + 0.6], 0x16223a, 'Back', [['BENTON DIESEL GRAND', 0, 0, 1, 1, h.color]], { glow: true });
    // lobby: a glass front, a gold band and the porte-cochère
    add([64, 8, 0.4], [X, 4.3, F + 0.3], 0x9cc0d8, 'Glass', { collide: 0, trans: 0.3 });
    add([100, 1.4, 0.6], [X, 9.6, F + 0.4], h.color, 'Metal', { collide: 0 });
    for (const dx of [-18, 18]) for (const dz of [4, 15]) box([1.4, 13, 1.4], [X + dx, 0, F + dz], TRIM, 'Concrete', { shape: 5 });
    add([44, 1.4, 20], [X, 13.7, F + 9], 0x16223a, 'Metal', { collide: 0 });
    sign([40, 1.2, 0.3], [X, 13.7, F + 19.2], 0x16223a, 'Back', [['BENTON DIESEL GRAND HOTEL', 0, 0, 1, 1, h.color, 'GothamBold']]);
    // low wings with three floors of windows
    for (const sx of [-1, 1]) {
      box([26, 20, 34], [X + sx * 63, 0, F - 20], CREAM, 'Concrete');
      for (let f = 0; f < 3; f++) add([24, 2.6, 0.4], [X + sx * 63, 4 + f * 5.5, F - 2.8], GLASS, 'Glass', { collide: 0 });
      add([28, 1.2, 36], [X + sx * 63, 20.6, F - 20], TRIM, 'Concrete', { collide: 0 });
    }
    // flags on the drive circle island and a fountain
    box([12, 1.2, 12], [X, ROAD + 0.8, h.cz], 0xb8b4ac, 'Concrete', { shape: 5 });
    add([10.6, 0.2, 10.6], [X, ROAD + 1.95, h.cz], 0x38a6d8, 'Glass', { shape: 5, collide: 0, trans: 0.15 });
    box([2.4, 4, 2.4], [X, ROAD + 2, h.cz], 0xb8b4ac, 'Concrete', { shape: 5 });
    add([4, 0.6, 4], [X, ROAD + 6.2, h.cz], 0x38a6d8, 'Glass', { shape: 5, collide: 0, trans: 0.2 });
    data.tags.SteamVent = data.tags.SteamVent || [];
    for (const [dx, col] of [[-6, 0x1e6ee6], [0, h.color], [6, 0xc42828]]) {
      box([0.3, 22, 0.3], [X + dx, ROAD + 0.8, h.cz + 8], 0xd8d8d8, 'Metal', { collide: 0 });
      add([5, 3, 0.1], [X + dx + 2.6, ROAD + 21, h.cz + 8], col, 'Fabric', { collide: 0 });
    }
    // the pool deck
    box([48, 0.5, 40], [416, ROAD, 520], 0xe2dccc, 'Concrete');
    add([28, 0.1, 15], [416, ROAD + 0.55, 520], 0x38b6e8, 'Glass', { collide: 0, trans: 0.1 });
    for (const [w, d, dx, dz] of [[30, 1, 0, -8], [30, 1, 0, 8], [1, 15, -14.5, 0], [1, 15, 14.5, 0]]) box([w, 0.3, d], [416 + dx, ROAD + 0.5, 520 + dz], 0xf4f0e6, 'Concrete', { collide: 0 });
    for (let k = 0; k < 6; k++) {
      const x = 400 + k * 6.4;
      box([2.2, 0.7, 5], [x, ROAD + 0.5, 532], 0xf4f4f0, 'Plastic', { collide: 0 });
      if (k % 2 === 0) {
        box([0.2, 6, 0.2], [x + 3.2, ROAD + 0.5, 534], 0xd8d8d8, 'Metal', { collide: 0 });
        add([7, 0.4, 7], [x + 3.2, ROAD + 6.7, 534], k % 4 ? ORANGE : 0x1e6ee6, 'Fabric', { shape: 5, collide: 0 });
      }
    }
    for (const z of [502, 538]) for (const x of [394, 438]) box([0.4, 3.4, 0.4], [x, ROAD + 0.5, z], 0xd8d8d8, 'Metal', { collide: 0 });
    // hotel lots either side of the driveway
    lot(398, 556, 452, 632, [568, 608]);
    lot(488, 556, 548, 632, [568, 608], [h.spot]);
    staff('hotel', 'door', X - 8, 0.4, F + 3, 0);
    staff('hotel', 'door', X + 8, 0.4, F + 3, 0);
    // a sign at the driveway
    for (const dx of [-16, 16]) {
      box([6, 6, 2], [X + dx, ROAD, 638], 0xc8bca0, 'Concrete');
      sign([5.4, 2.6, 0.2], [X + dx, ROAD + 3.4, 639.1], 0x16223a, 'Back', [['THE GRAND', 0, 0, 1, 1, h.color]]);
    }
  }

  // ------------------------------------------------- Haulers Roadside Inn
  {
    const h = HOTELS[1];
    const X = -475, F = 462, Y2 = 7.3;
    const SAND = 0xe8c890, DOORS = [0xc8322d, 0x2a8a8a, 0xf2c818, 0x2b5a9a];
    box([140, 15, 22], [X, 0, F - 11], SAND, 'Brick');
    for (let f = 0; f < 2; f++) {
      for (let k = 0; k < 14; k++) {
        const x = X - 70 + 5 + k * 10;
        add([3, 6, 0.3], [x - 2.4, f * Y2 + 3.4, F + 0.15], DOORS[(k + f) % 4], 'SmoothPlastic', { collide: 0 });
        add([3.6, 2.6, 0.3], [x + 1.8, f * Y2 + 4, F + 0.15], 0x6a8aa8, 'Glass', { collide: 0 });
        add([1.6, 1, 0.8], [x + 1.8, f * Y2 + 2.2, F + 0.5], 0xd8d8d0, 'Metal', { collide: 0 });
      }
    }
    // upstairs walkway, railing, posts and stairs at both ends
    add([140, 0.6, 6], [X, Y2 - 0.3, F + 3], 0xc8c6c0, 'Concrete', { collide: 0 });
    add([140, 0.3, 0.3], [X, Y2 + 3.4, F + 5.8], 0xf2f2ee, 'Metal', { collide: 0 });
    for (let x = X - 70; x <= X + 70; x += 5) add([0.2, 3.4, 0.2], [x, Y2 + 1.7, F + 5.8], 0xf2f2ee, 'Metal', { collide: 0 });
    for (let x = X - 68; x <= X + 68; x += 17) box([0.8, Y2, 0.8], [x, 0, F + 5.4], 0xf2f2ee, 'Metal');
    for (const sx of [-1, 1]) add([4, Y2, 14], [X + sx * 72, Y2 / 2, F + 7], 0xc8c6c0, 'Concrete', { shape: 1, yaw: Math.PI, collide: 0 });
    // roof with an orange band and a rooftop sign
    add([144, 1.2, 26], [X, 15.6, F - 11], 0x6a4a3a, 'Slate', { collide: 0 });
    add([144, 1.6, 0.4], [X, 14.4, F + 0.4], 0xff6a3a, 'SmoothPlastic', { collide: 0 });
    for (const dx of [-24, 24]) box([0.6, 6, 0.6], [X + dx, 16.2, F - 6], DARK, 'Metal', { collide: 0 });
    sign([66, 6, 0.6], [X, 25, F - 6], 0x1a1612, 'Back', [['HAULERS ROADSIDE INN', 0, 0, 1, 1, 0xff6a3a]], { glow: true });
    // the office
    box([22, 10, 28], [-389, 0, F - 8], SAND, 'Brick');
    add([20, 6, 0.4], [-389, 3.4, F + 6.2], 0x9cc0d8, 'Glass', { collide: 0, trans: 0.3 });
    add([24, 1, 30], [-389, 10.5, F - 8], 0x6a4a3a, 'Slate', { collide: 0 });
    sign([10, 2, 0.3], [-389, 8.2, F + 6.4], BLACK, 'Back', [['OFFICE', 0, 0, 1, 1, 0xff3a20]], { glow: true });
    staff('hotel', 'door', -392, 0.4, F + 9, 0);
    // the roadside sign, with a big rig on top
    const SX = -420, SZ = PARKWAY.z - PARKWAY.half - 18;
    for (const dx of [-8, 8]) box([1.6, 30, 1.6], [SX + dx, ROAD, SZ], DARK, 'Metal', { shape: 5 });
    sign([34, 12, 1.2], [SX, ROAD + 36, SZ], 0x1a1612, 'Back', [
      ['HAULERS', 0, 0.02, 1, 0.42, 0xff6a3a], ['ROADSIDE INN', 0, 0.42, 1, 0.3, 0xf2f2ee], ['COLOR TV  ·  POOL  ·  FREE SHUTTLE', 0, 0.74, 1, 0.22, YELLOW, 'GothamBold'],
    ], { glow: true });
    sign([16, 3, 1], [SX, ROAD + 27.5, SZ], BLACK, 'Back', [['VACANCY', 0, 0, 1, 1, 0xff2a2a]], { glow: true });
    add([22, 6, 6], [SX - 4, ROAD + 45.5, SZ], 0xd8d8d8, 'Metal', { collide: 0 });
    add([7, 6.4, 6], [SX + 11.5, ROAD + 45.7, SZ], 0xc8322d, 'SmoothPlastic', { collide: 0 });
    add([0.2, 2.6, 5.4], [SX + 15.1, ROAD + 46.8, SZ], 0xa0c8e6, 'Glass', { collide: 0 });
    for (const dx of [-12, -8, 4, 11.5]) for (const dz of [-3.1, 3.1]) add([3, 3, 0.8], [SX + dx, ROAD + 42.6, SZ + dz], 0x191919, 'Rubber', { shape: 2, yaw: Math.PI / 2, collide: 0 });
    // the lot in front and to the west
    lot(-548, 470, -404, 500, [482]);
    lot(-548, 556, -488, 632, [568, 608], [h.spot]);
    // ice and soda machines
    box([2.4, 6, 2], [-412, 0.3, F + 3], 0x2a6ae0, 'SmoothPlastic');
    box([2.4, 6, 2], [-546, 0.3, F + 3], 0xc8322d, 'SmoothPlastic');
  }

  // ------------------------------------------------------ Backwoods Lodge
  {
    const h = HOTELS[2];
    const X = h.x, F = 758; // the north (front) face
    const LOG = 0x6a4428, STONE = 0x8a8480, ROOF = 0x3a3028;
    box([100, 3, 45], [X, 0, F + 22.5], STONE, 'Slate');
    box([98, 14, 43], [X, 3, F + 22.5], LOG, 'WoodPlanks');
    for (let y = 4; y < 17; y += 2.2) add([98.6, 0.9, 0.9], [X, y, F - 0.1], 0x5a3a20, 'Wood', { shape: 2, collide: 0 });
    add([104, 12, 25.5], [X, 23, F + 10.25], ROOF, 'Slate', { shape: 1, collide: 0 });
    add([104, 12, 25.5], [X, 23, F + 34.75], ROOF, 'Slate', { shape: 1, yaw: Math.PI, collide: 0 });
    for (const u of [-36, -20, 20, 36]) add([8, 6, 0.3], [X + u, 9, F - 0.6], 0xffd890, 'Glass', { collide: 0, trans: 0.2 });
    add([10, 10, 0.3], [X, 8, F - 0.6], 0x4a2a18, 'WoodPlanks', { collide: 0 });
    box([8, 34, 8], [X - 40, 0, F + 30], STONE, 'Slate');
    // the porch, its log posts and the sign
    box([34, 1, 12], [X, 0, F - 6], 0x5a3a20, 'WoodPlanks');
    for (const dx of [-15, -5, 5, 15]) box([1.4, 11, 1.4], [X + dx, 1, F - 11], 0x6a4428, 'Wood', { shape: 5 });
    add([36, 1.2, 14], [X, 12.6, F - 6], ROOF, 'Slate', { collide: 0 });
    sign([30, 4, 0.8], [X, 15.4, F - 12.6], 0x2a1a10, 'Front', [['BACKWOODS LODGE', 0, 0, 1, 1, 0xf2e2c0]]);
    for (const dx of [-10, 10]) {
      add([1, 1.6, 1], [X + dx, 9, F - 11.8], 0xffc860, 'Neon', { collide: 0 });
      data.tags.ParkLamp.push([X + dx, 9, F - 12.2, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    staff('hotel', 'door', X - 6, 1, F - 9, Math.PI);
    // two guest cabins and a campfire ring
    for (const [cx, cz] of [[-112, 690], [-112, 726]]) {
      box([16, 9, 14], [cx, 0, cz], LOG, 'WoodPlanks');
      add([18, 5, 8], [cx, 11.5, cz - 3.5], ROOF, 'Slate', { shape: 1, yaw: Math.PI, collide: 0 });
      add([18, 5, 8], [cx, 11.5, cz + 3.5], ROOF, 'Slate', { shape: 1, collide: 0 });
      add([3, 6, 0.3], [cx - 8.2, 3, cz], 0x4a2a18, 'WoodPlanks', { collide: 0, yaw: Math.PI / 2 });
    }
    box([7, 0.6, 7], [-132, ROAD, 770], STONE, 'Slate', { shape: 5 });
    data.tags.Campfire.push([-132, ROAD + 1, 770, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      box([4, 1.2, 1.2], [-132 + Math.cos(a) * 7, ROAD, 770 + Math.sin(a) * 7], 0x5a3a20, 'Wood', { yaw: a + Math.PI / 2, collide: 0 });
    }
    // a totem on the drive island
    box([2.4, 12, 2.4], [X, ROAD + 0.8, h.cz], 0x6a4428, 'Wood', { shape: 5 });
    add([6, 0.8, 1], [X, ROAD + 11, h.cz], 0x8a3a22, 'Wood', { collide: 0 });
    // the lot, and pines all around
    lot(-262, 676, -216, 714, [688], [h.spot]);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      const r = 72 + ((k * 37) % 19);
      const x = X + Math.cos(a) * r * 1.2, z = 760 + Math.sin(a) * r * 0.75;
      if (z < PARKWAY.z + 24 || Math.abs(x - X) < 30 && z < 760) continue;
      data.trees.push({ leaf: 0x2f5a2a, kind: 'pine', s: 1 + ((k * 13) % 7) / 10, pos: [x, 0, z] });
    }
  }

  // bus shelters at the Inn and the Lodge (the Grand's stop is under its
  // porte-cochère)
  shelter(HOTELS[1].stopAt[0], HOTELS[1].stopAt[1] - 1, 0, 'Haulers Inn');
  shelter(HOTELS[2].stopAt[0] + 28, HOTELS[2].stopAt[1], Math.PI, 'Backwoods Lodge');
  {
    const [x, z] = HOTELS[0].stopAt;
    box([0.4, 9, 0.4], [x + 24, ROAD, z + 6], DARK, 'Metal');
    sign([3.2, 3.2, 0.2], [x + 24, ROAD + 9.4, z + 6], 0x1e6ee6, 'Back', [['BUS', 0, 0, 1, 0.5, WHITE], ['GRAND HOTEL', 0, 0.5, 1, 0.5, WHITE, 'GothamBold']]);
  }

  // ------------------------------------------------------------ billboards
  // [x, z, facing yaw (0 faces south), ad]
  const N = PARKWAY.z - PARKWAY.half - 22, S = PARKWAY.z + PARKWAY.half + 22;
  const boards = [
    [-600, N, 0], [-250, N, 0], [-120, N, 0], [150, N, 0], [262, N, 0], [620, N, 0],
    [-620, S, Math.PI], [-380, S, Math.PI], [130, S, Math.PI], [240, S, Math.PI], [400, S, Math.PI], [560, S, Math.PI],
    [62, 704, -Math.PI / 2], [-62, 712, Math.PI / 2],
    [EAST_LINK.x + 30, 470, -Math.PI / 2], [WEST_LINK.x - 30, 560, Math.PI / 2],
  ];
  boards.forEach(([x, z, yaw], k) => billboard(x, z, yaw, ADS[k % ADS.length], k));

  function billboard(x, z, yaw, ad, k) {
    const W = 46, H = 16, BY = 18;
    const at = frame(x, z, yaw);
    for (const u of [-W * 0.3, W * 0.3]) { const [px, pz] = at(u, -1.6); box([1.4, BY + H - 2, 1.4], [px, 0, pz], 0x4a4e56, 'Metal', { shape: 5 }); }
    const [bx, bz] = at(0, 0);
    add([W + 1.2, H + 1.2, 0.6], [bx, BY + H / 2, bz], 0x2a2e36, 'Metal', { yaw, collide: 0 });
    const labels = [];
    const right = k % 2 === 0; // which side the art goes
    const tx = right ? 0.02 : 0.34;
    labels.push([ad.title, tx, 0.06, 0.64, 0.42, ad.fg]);
    labels.push([ad.sub, tx, 0.5, 0.64, 0.2, 0xf2f2ee, 'GothamBold']);
    labels.push([ad.foot, tx, 0.74, 0.64, 0.18, 0xb8b8c8, 'GothamBold']);
    const [sx, sz] = at(0, 0.35);
    sign([W, H, 0.4], [sx, BY + H / 2, sz], BLACK, 'Back', labels, { yaw, glow: true });
    // the art on the other side, standing proud of the board
    const ax = (right ? 1 : -1) * W * 0.33;
    const [mx, mz] = at(ax, 0.8);
    if (ad.art === 'moon') {
      add([0.4, H * 0.62, H * 0.62], [mx, BY + H * 0.56, mz], 0xf4ecc8, 'Neon', { shape: 2, yaw: yaw + Math.PI / 2, collide: 0 });
      for (const [du, dy, s] of [[-4.2, 3.2, 1], [3.6, 4.6, 0.8], [-2, -3.4, 0.7]]) {
        const [px, pz] = at(ax + du, 1.2);
        add([2.6 * s, 0.6 * s, 0.3], [px, BY + H * 0.56 + dy, pz], BLACK, 'SmoothPlastic', { yaw, collide: 0 });
        add([1, 1, 0.3], [px, BY + H * 0.56 + dy - 0.2, pz], BLACK, 'SmoothPlastic', { yaw, collide: 0 });
      }
    } else if (ad.art === 'pumpkin') {
      const cy = BY + H * 0.48;
      add([9, 9, 9], [mx, cy, mz], PUMPKIN, 'SmoothPlastic', { shape: 3, yaw, collide: 0 });
      add([0.9, 2, 0.9], [mx, cy + 5, mz], 0x3a5a2a, 'Wood', { yaw, collide: 0 });
      const [fx, fz] = at(ax, 5.05);
      for (const du of [-1.8, 1.8]) { const [px, pz] = at(ax + du, 4.75); add([1.6, 1.4, 0.4], [px, cy + 1.2, pz], 0xffd040, 'Neon', { yaw, collide: 0 }); }
      add([4.6, 1, 0.4], [fx, cy - 1.8, fz], 0xffd040, 'Neon', { yaw, collide: 0 });
    } else {
      const cy = BY + H * 0.52;
      add([8.4, 8.4, 8.4], [mx, cy, mz], 0xe8e4dc, 'SmoothPlastic', { shape: 3, yaw, collide: 0 });
      add([5, 3, 5], [mx, cy - 3.6, mz], 0xe8e4dc, 'SmoothPlastic', { yaw, collide: 0 });
      for (const du of [-1.7, 1.7]) {
        const [px, pz] = at(ax + du, 4.4), [gx, gz] = at(ax + du, 4.65);
        add([2, 2.2, 0.4], [px, cy + 0.6, pz], 0x050505, 'SmoothPlastic', { yaw, collide: 0 });
        add([0.6, 0.6, 0.2], [gx, cy + 0.5, gz], ad.fg, 'Neon', { yaw, collide: 0 });
      }
      const [px, pz] = at(ax, 4.2);
      add([0.8, 1, 0.4], [px, cy - 1.2, pz], 0x050505, 'SmoothPlastic', { yaw, collide: 0 });
      for (const du of [-1.4, -0.5, 0.4, 1.3]) { const [qx, qz] = at(ax + du, 3.4); add([0.5, 0.9, 0.3], [qx, cy - 4.1, qz], 0x050505, 'SmoothPlastic', { yaw, collide: 0 }); }
    }
    // catwalk and lights
    const [cx, cz] = at(0, 1.4);
    add([W, 0.3, 2.4], [cx, BY - 0.6, cz], 0x4a4e56, 'Metal', { yaw, collide: 0 });
    for (const u of [-W / 3, 0, W / 3]) {
      const [lx, lz] = at(u, 3.6), [rx, rz] = at(u, 2.2);
      add([0.3, 0.3, 3], [rx, BY - 0.4, rz], 0x4a4e56, 'Metal', { yaw, collide: 0 });
      add([1.4, 0.6, 1], [lx, BY - 0.1, lz], 0xfff4d8, 'Neon', { yaw, collide: 0 });
      data.tags.ParkLamp.push([lx, BY + 1, lz, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
  }

  return { hotels: HOTELS, stops: BUS_STOPS, loop: busLoop() };
}
