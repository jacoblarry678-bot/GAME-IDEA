// Summer overlays: for the summer season six rides get a summer makeover -
// a new summer name, an arch over the entrance, decorations round the
// entrance (beach umbrellas and loungers, giant beach balls, tiki torches,
// misting fans, bunting, food stands, surfboards, sailboats, hay bales,
// fireworks racks), and new effects on the ride itself (water cannons,
// summer confetti, fireworks).
//   Jungle Raid           -> Jungle Raid: Monsoon Run
//   Harbor Run            -> Harbor Run: Regatta Week
//   Cyclone               -> Cyclone: County Fair Twister
//   RC Race               -> RC Race: Beach Grand Prix
//   Benton Blitz          -> Benton Blitz: Heatwave
//   Flying Fire           -> Flying Fire: Firecracker Summer
// The decorations find their own spots: clear of walls, tracks, queue lines
// and paths, and on the guests' side of any wall.
import * as THREE from 'three';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

const G = 0.1;
const WHITE = 0xf4f4f0, SAND = 0xe6d6a6, WOOD = 0x8a6a44, STRAW = 0xd8b860, INK = 0x1a1a1c;

export const OVERLAYS = [
  {
    id: 'JungleRaid', title: 'Monsoon Run', name: 'Jungle Raid: Monsoon Run', colors: [0x2a8a3a, 0xff8a1a], kit: 'monsoon',
    blurb: 'Monsoon season has hit the jungle: water cannons at the ravine and over the ruins, tiki torches, coconut coolers and misting fans at base camp.',
    greet: 'Jungle Raid: Monsoon Run - you WILL get wet!',
    cues: [[0.74, 'splash', [0, 0, 3]], [0.86, 'splash', [0, 0, 3]], [0.95, 'summer', [0, 3, 0]]],
  },
  {
    id: 'HarborRun', title: 'Regatta Week', name: 'Harbor Run: Regatta Week', colors: [0x1a2a6a, 0xd82a2a], kit: 'regatta',
    blurb: 'Regatta Week in the harbor: nautical bunting, sailboats, life rings and snow cones - and a soaking off the breakwater.',
    greet: 'Harbor Run: Regatta Week - set sail, crew!',
    cues: [[0.36, 'splash', [0, 0, -4]], [0.92, 'summer', [0, 4, 0]]],
  },
  {
    id: 'Cyclone', title: 'County Fair Twister', name: 'Cyclone: County Fair Twister', colors: [0xd82a2a, 0xf2c418], kit: 'fair',
    blurb: 'The county fair has come to the farm: bunting, hay bales, a lemonade stand, and the twister brings a cloudburst.',
    greet: 'Cyclone: County Fair Twister - grab a lemonade and hold on to your hat!',
    cues: [[0.4, 'splash', [0, 0, -3]], [0.93, 'summer', [0, 3, 0]]],
  },
  {
    id: 'RCRace', title: 'Beach Grand Prix', name: 'RC Race: Beach Grand Prix', colors: [0xf2c418, 0x2a6ad8], kit: 'beach',
    blurb: 'The Beach Grand Prix, presented by Crinkle Crunch: chequered flags, surfboards, giant beach balls, water cannons on the straights and confetti at the finish.',
    greet: 'RC Race: Beach Grand Prix - surf\'s up, racers!',
    cues: [[0.3, 'splash', [0, 0, 3]], [0.68, 'splash', [0, 0, 3]], [0.94, 'summer', [0, 3, 0]]],
  },
  {
    id: 'BentonBlitz', title: 'Heatwave', name: 'Benton Blitz: Heatwave', colors: [0xff6a1a, 0xf2c418], kit: 'heatwave',
    blurb: 'A heatwave in the canyon: misting fans all along the line, ice pops, and water cannons every time you go backwards.',
    greet: 'Benton Blitz: Heatwave - stay cool in the misters!',
    cues: [[0.3, 'splash', [0, 0, 3]], [0.6, 'splash', [0, 0, -3]], [0.94, 'summer', [0, 3, 0]]],
  },
  {
    id: 'FlyingFire', title: 'Firecracker Summer', name: 'Flying Fire: Firecracker Summer', colors: [0xd82a2a, 0x2a4ad8], kit: 'firecracker',
    blurb: 'Firecracker Summer: red, white and blue bunting, fireworks racks round the station, and fireworks bursting over the train.',
    greet: 'Flying Fire: Firecracker Summer - fireworks on every ride!',
    cues: [[0.22, 'fireworks', [0, 10, 0]], [0.62, 'fireworks', [0, 10, 0]], [0.93, 'summer', [0, 3, 0]]],
  },
];

const KITS = {
  monsoon: [['torch', 6], ['umbrella', 2], ['mister', 2], ['palm', 2], ['stand', 1, 'COCONUT COOLERS'], ['balls', 1]],
  regatta: [['bunting', 2], ['ring', 3], ['boat', 2], ['umbrella', 2], ['stand', 1, 'SNOW CONES']],
  fair: [['bunting', 2], ['hay', 3], ['stand', 1, 'LEMONADE'], ['umbrella', 2], ['bigball', 1]],
  beach: [['chequer', 3], ['surf', 2], ['umbrella', 3], ['balls', 2], ['bigball', 1]],
  heatwave: [['mister', 4], ['thermo', 1], ['umbrella', 3], ['stand', 1, 'ICE POPS']],
  firecracker: [['bunting', 2], ['rockets', 3], ['stand', 1, 'FIRECRACKER POPS'], ['umbrella', 2]],
};
// how much room each kind of decoration needs (radius) and how tall it is
const SIZE = { torch: [0.6, 3.6], umbrella: [2, 3.8], mister: [0.8, 3.6], palm: [2.2, 9], stand: [2.8, 4], balls: [1.4, 1.8], bigball: [1.5, 3], bunting: [4.6, 5], ring: [0.7, 2.4], boat: [2.2, 5], hay: [1.5, 2.2], chequer: [0.8, 5.4], surf: [1.8, 3.2], thermo: [1, 5], rockets: [1, 1.6] };

export function buildSummerOverlays(data) {
  const W = helpers(data);
  const { add, box, sign, cf } = W;
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.staffSpots = data.staffSpots || [];
  const hidden = new Set(data.hidden || []);
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3();
  const out = { overlays: [] };

  for (const ov of OVERLAYS) {
    const cfg = data.config.Rides.find((r) => r.id === ov.id), ride = data.rides.find((r) => r.id === ov.id);
    if (!cfg || !ride) continue;
    const E = [cfg.entrance[0], cfg.entrance[2]];
    const R0 = 46;
    const near = (x, z, r = R0) => Math.abs(x - E[0]) < r && Math.abs(z - E[1]) < r;

    // ---- what's around the entrance: solid things, paths, tracks, queues
    const solids = [], paths = [];
    data.static.forEach((p, i) => {
      if (hidden.has(i) || !near(p[4], p[6], R0 + 60)) return;
      const ex = (Math.abs(p[7]) * p[1] + Math.abs(p[8]) * p[2] + Math.abs(p[9]) * p[3]) / 2;
      const ey = (Math.abs(p[10]) * p[1] + Math.abs(p[11]) * p[2] + Math.abs(p[12]) * p[3]) / 2;
      const ez = (Math.abs(p[13]) * p[1] + Math.abs(p[14]) * p[2] + Math.abs(p[15]) * p[3]) / 2;
      const top = p[5] + ey, bottom = p[5] - ey;
      const b = [p[4] - ex, p[4] + ex, bottom, top, p[6] - ez, p[6] + ez, p[19]];
      if (top < 0.5) {
        // a walk: a thin slab on the ground, not too wide (not a plaza or
        // the site's ground)
        if (ey < 0.2 && Math.min(ex, ez) < 2.6 && Math.max(ex, ez) < 200 && top > G + 0.05) paths.push(b);
        return;
      }
      if (ex * ez > 6000 && top < 1.5) return; // a floor
      solids.push(b);
    });
    const tracks = [];
    for (const r of data.rides) {
      if (!r.track) continue;
      const S = new Sampler(r.track);
      for (let s = 0; s < r.track.length; s += 1.5) { S.matrixAt(s, m4); P.setFromMatrixPosition(m4); if (near(P.x, P.z, R0 + 10)) tracks.push([P.x, P.y, P.z]); }
    }
    const queues = [];
    for (const r of data.rides) {
      const q = r.queue?.points;
      if (!q) continue;
      for (let k = 0; k + 3 < q.length; k += 2) if (near(q[k], q[k + 1], R0 + 40) || near(q[k + 2], q[k + 3], R0 + 40)) queues.push([q[k], q[k + 1], q[k + 2], q[k + 3]]);
    }
    const segDist = (x, z, [ax, az, bx, bz]) => {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      return Math.hypot(x - ax - dx * t, z - az - dz * t);
    };
    const boxHit = (b, x0, x1, y0, y1, z0, z1) => b[0] < x1 && b[1] > x0 && b[2] < y1 && b[3] > y0 && b[4] < z1 && b[5] > z0;
    const placed = [];
    // is a circle of radius r at (x, z), h tall, free?
    const free = (x, z, r, h, { queuePad = 1.4 } = {}) => {
      for (const b of solids) if (boxHit(b, x - r, x + r, G + 0.05, G + h, z - r, z + r)) return false;
      for (const b of paths) if (boxHit(b, x - r - 0.4, x + r + 0.4, -1, 1, z - r - 0.4, z + r + 0.4)) return false;
      for (const s of queues) if (segDist(x, z, s) < r + queuePad) return false;
      for (const [tx, ty, tz] of tracks) if (Math.hypot(tx - x, tz - z) < r + 4.2 && ty < G + h + 5) return false;
      for (const [px, pz, pr] of placed) if (Math.hypot(px - x, pz - z) < r + pr + 0.8) return false;
      return true;
    };
    // can you walk from the entrance to (x, z) without going through a wall?
    const reach = (x, z) => {
      const n = Math.ceil(Math.hypot(x - E[0], z - E[1]) / 1);
      for (let k = 1; k < n; k++) {
        const px = E[0] + ((x - E[0]) * k) / n, pz = E[1] + ((z - E[1]) * k) / n;
        for (const b of solids) if (b[6] && b[3] > G + 2.5 && b[2] < G + 1 && px > b[0] && px < b[1] && pz > b[4] && pz < b[5]) return false;
      }
      return true;
    };
    const spot = (kind, k) => {
      const [r, h] = SIZE[kind];
      for (let rad = 5; rad <= 34; rad += 1.5) {
        const n = Math.max(8, Math.round((rad * Math.PI * 2) / 3));
        for (let j = 0; j < n; j++) {
          const a = ((j + k * 0.37 + rad * 0.21) / n) * Math.PI * 2;
          const x = E[0] + Math.cos(a) * rad, z = E[1] + Math.sin(a) * rad;
          if (free(x, z, r, h) && reach(x, z)) { placed.push([x, z, r]); return [x, z, Math.atan2(E[0] - x, E[1] - z)]; }
        }
      }
      return null;
    };

    // ---- the decorations
    const [C1, C2] = ov.colors;
    const made = {};
    const P2 = {
      torch(x, z) {
        box([0.3, 3.2, 0.3], [x, G, z], WOOD, 'Wood', { collide: 0, shape: 5 });
        add([0.7, 0.6, 0.7], [x, G + 3.4, z], 0x6a4a2a, 'Wood', { collide: 0, shape: 5 });
        data.tags.Campfire.push([x, G + 3.8, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      },
      umbrella(x, z, yaw) {
        add([4.4, 0.06, 3.6], [x, G + 0.12, z], SAND, 'Concrete', { collide: 0, yaw });
        box([0.16, 3.4, 0.16], [x, G, z], WHITE, 'Metal', { collide: 0, shape: 5 });
        add([3.8, 0.3, 3.8], [x, G + 3.3, z], C1, 'Fabric', { collide: 0, shape: 5 });
        add([2.4, 0.34, 2.4], [x, G + 3.42, z], WHITE, 'Fabric', { collide: 0, shape: 5 });
        add([1.2, 0.38, 1.2], [x, G + 3.52, z], C2, 'Fabric', { collide: 0, shape: 5 });
        const cx = x + Math.cos(yaw) * 1.2, cz = z - Math.sin(yaw) * 1.2;
        box([0.9, 0.35, 2.2], [cx, G + 0.25, cz], C2, 'Fabric', { yaw });
        add([0.9, 0.9, 0.3], [cx - Math.sin(yaw) * 1.0, G + 0.9, cz - Math.cos(yaw) * 1.0], C2, 'Fabric', { collide: 0, yaw, rot: null });
      },
      mister(x, z) {
        box([0.2, 3.2, 0.2], [x, G, z], 0x9aa0a8, 'Metal', { collide: 0, shape: 5 });
        add([0.9, 0.9, 0.5], [x, G + 3.4, z], 0x3a8ad8, 'Metal', { collide: 0, shape: 2 });
        add([0.5, 0.6, 0.6], [x, G + 1.2, z], WHITE, 'Metal', { collide: 0 });
        data.tags.SteamVent.push([x, G + 3.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      },
      palm(x, z) {
        data.trees.push({ leaf: 0x3a8a3a, kind: 'palm', s: 1, pos: [x, G, z] });
      },
      stand(x, z, yaw, label) {
        box([3.6, 1.3, 2], [x, G, z], WHITE, 'WoodPlanks', { yaw });
        for (const [dx, dz] of [[-1.7, -0.9], [1.7, -0.9], [-1.7, 0.9], [1.7, 0.9]]) {
          const px = x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, pz = z - Math.sin(yaw) * dx + Math.cos(yaw) * dz;
          box([0.16, 2.8, 0.16], [px, G + 1.3, pz], WHITE, 'Metal', { collide: 0 });
        }
        for (let k = 0; k < 6; k++) {
          const dx = -1.75 + k * 0.7, px = x + Math.cos(yaw) * dx, pz = z - Math.sin(yaw) * dx;
          add([0.7, 0.25, 2.6], [px, G + 4.2, pz], k % 2 ? WHITE : C1, 'Fabric', { collide: 0, yaw });
        }
        sign([3.4, 0.7, 0.15], [x + Math.sin(yaw) * 1.08, G + 3.5, z + Math.cos(yaw) * 1.08], C2, 'Back', [[label, 0, 0, 1, 1, WHITE, 'GothamBlack']], { yaw });
        add([0.5, 0.6, 0.5], [x - Math.cos(yaw) * 1.1, G + 1.6, z + Math.sin(yaw) * 1.1], C2, 'SmoothPlastic', { collide: 0, shape: 5 });
      },
      balls(x, z) {
        const cols = [C1, C2, 0xff4a8a, 0x3ad0d0];
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1, r = 0.55 + (k % 2) * 0.25;
          add([r * 2, r * 2, r * 2], [x + Math.cos(a) * 0.8, G + r, z + Math.sin(a) * 0.8], cols[k], 'SmoothPlastic', { shape: 3, collide: k === 0 ? 1 : 0 });
          add([r * 2.04, r * 0.5, r * 2.04], [x + Math.cos(a) * 0.8, G + r, z + Math.sin(a) * 0.8], WHITE, 'SmoothPlastic', { shape: 3, collide: 0, rot: RZ(a) });
        }
      },
      bigball(x, z) {
        add([2.8, 2.8, 2.8], [x, G + 1.4, z], C1, 'SmoothPlastic', { shape: 3 });
        add([2.86, 0.9, 2.86], [x, G + 1.4, z], WHITE, 'SmoothPlastic', { shape: 3, collide: 0, rot: RZ(0.6) });
        add([2.86, 0.9, 2.86], [x, G + 1.4, z], C2, 'SmoothPlastic', { shape: 3, collide: 0, rot: RZ(-0.9) });
      },
      bunting(x, z, yaw) {
        // two posts 8 apart, a string of pennants between them
        const ax = Math.cos(yaw), az = -Math.sin(yaw);
        for (const s of [-4, 4]) box([0.25, 4.6, 0.25], [x + ax * s, G, z + az * s], WHITE, 'Metal', { collide: 0, shape: 5 });
        for (let k = 0; k < 12; k++) {
          const s = -3.6 + k * 0.66, sag = 0.9 * (1 - (s / 4) ** 2);
          add([0.5, 0.7, 0.06], [x + ax * s, G + 4.1 - sag, z + az * s], k % 3 === 0 ? C1 : k % 3 === 1 ? WHITE : C2, 'Fabric', { collide: 0, yaw, rot: null });
        }
        add([8, 0.05, 0.05], [x, G + 4.2, z], INK, 'Fabric', { collide: 0, yaw: yaw + Math.PI / 2 });
      },
      ring(x, z) {
        box([0.2, 2.2, 0.2], [x, G, z], WOOD, 'Wood', { collide: 0 });
        add([0.25, 1.2, 1.2], [x, G + 1.7, z + 0.15], 0xe02a2a, 'SmoothPlastic', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
        add([0.3, 0.7, 0.7], [x, G + 1.7, z + 0.17], WHITE, 'SmoothPlastic', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
      },
      boat(x, z, yaw) {
        box([1.4, 0.8, 3.6], [x, G + 0.3, z], WHITE, 'WoodPlanks', { yaw });
        add([1.44, 0.2, 3.64], [x, G + 1.0, z], C1, 'SmoothPlastic', { collide: 0, yaw });
        box([0.15, 4, 0.15], [x, G + 1.1, z], WOOD, 'Wood', { collide: 0 });
        add([0.06, 3.2, 2], [x, G + 3.2, z - 0.2], WHITE, 'Fabric', { collide: 0, yaw, shape: 1 });
        add([0.6, 0.2, 0.4], [x, G + 5.2, z], C2, 'Fabric', { collide: 0, yaw });
        box([1.6, 0.3, 1], [x, G, z + 1.4], WOOD, 'Wood', { collide: 0, yaw });
      },
      hay(x, z, yaw) {
        box([1.8, 1, 1.1], [x, G, z], STRAW, 'Fabric', { yaw });
        box([1.8, 1, 1.1], [x + Math.sin(yaw) * 1.2, G, z + Math.cos(yaw) * 1.2], STRAW, 'Fabric', { yaw });
        box([1.8, 1, 1.1], [x + Math.sin(yaw) * 0.6, G + 1, z + Math.cos(yaw) * 0.6], STRAW, 'Fabric', { yaw, collide: 0 });
      },
      chequer(x, z, yaw) {
        box([0.2, 5, 0.2], [x, G, z], WHITE, 'Metal', { collide: 0, shape: 5 });
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const dx = 0.3 + i * 0.4;
          add([0.4, 0.4, 0.05], [x + Math.cos(yaw) * dx, G + 4.6 - j * 0.4, z - Math.sin(yaw) * dx], (i + j) % 2 ? WHITE : INK, 'Fabric', { collide: 0, yaw });
        }
      },
      surf(x, z, yaw) {
        box([2.6, 1.2, 0.5], [x, G, z], WOOD, 'Wood', { yaw });
        [C1, C2, 0xff4a8a].forEach((c, k) => {
          const dx = -0.8 + k * 0.8;
          add([0.65, 3.0, 0.18], [x + Math.cos(yaw) * dx, G + 1.6, z - Math.sin(yaw) * dx], c, 'SmoothPlastic', { collide: 0, yaw, shape: 3 });
        });
      },
      thermo(x, z, yaw) {
        box([1.6, 4.6, 0.3], [x, G, z], WHITE, 'SmoothPlastic', { yaw });
        add([0.3, 3, 0.1], [x - Math.sin(yaw) * 0.0, G + 2.6, z], 0xff2a1a, 'Neon', { collide: 0, yaw });
        add([0.7, 0.7, 0.1], [x, G + 0.9, z], 0xff2a1a, 'Neon', { collide: 0, yaw, shape: 3 });
        sign([1.4, 0.7, 0.1], [x + Math.sin(yaw) * 0.2, G + 4.4, z + Math.cos(yaw) * 0.2], C1, 'Back', [['103°', 0, 0, 1, 1, WHITE]], { yaw });
        sign([1.4, 0.7, 0.1], [x - Math.sin(yaw) * 0.2, G + 4.4, z - Math.cos(yaw) * 0.2], C1, 'Front', [['103°', 0, 0, 1, 1, WHITE]], { yaw });
      },
      rockets(x, z, yaw) {
        box([1.6, 0.6, 1.2], [x, G, z], WOOD, 'Wood', { yaw });
        for (let k = 0; k < 6; k++) {
          const dx = -0.6 + (k % 3) * 0.6, dz = -0.3 + Math.floor(k / 3) * 0.6;
          add([0.3, 0.9, 0.3], [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, G + 1.05, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz], k % 2 ? C1 : C2, 'SmoothPlastic', { collide: 0, shape: 5 });
        }
      },
    };
    for (const [kind, count, label] of KITS[ov.kit]) for (let k = 0; k < count; k++) {
      const at = spot(kind, k + Object.keys(made).length);
      if (!at) continue;
      P2[kind](at[0], at[1], at[2], label);
      made[kind] = (made[kind] || 0) + 1;
    }

    // ---- the arch over the way in, with the summer name
    // (just outside where the line starts if it fits there; otherwise a
    // little way down the line)
    const q = ride.queue.points, n = q.length;
    const along = (back) => {
      // the point `back` along the line from its start, and the way out there
      let i = n - 2, left = back;
      while (i >= 2) {
        const sx = q[i - 2], sz = q[i - 1], ex = q[i], ez = q[i + 1], len = Math.hypot(ex - sx, ez - sz) || 1;
        if (left <= len || i === 2) { const u = Math.min(1, left / len); return [ex + (sx - ex) * u, ez + (sz - ez) * u, (ex - sx) / len, (ez - sz) / len]; }
        left -= len;
        i -= 2;
      }
      return [q[n - 2], q[n - 1], 0, 1];
    };
    let dx = 0, dz = 1;
    let arch = null;
    for (const fwd of [1.5, 3, 4.5, 0, -2, -4, -6, -8, -10, -12]) {
      for (const w of [2.6, 3.2, 4, 4.8]) {
        const [px, pz, ux, uz] = fwd >= 0 ? (() => { const [x, z, a, b] = along(0); return [x + a * fwd, z + b * fwd, a, b]; })() : along(-fwd);
        dx = ux; dz = uz;
        const cx = px, cz = pz;
        const posts = [[cx - dz * w, cz + dx * w], [cx + dz * w, cz - dx * w]];
        if (!posts.every(([x, z]) => free(x, z, 0.4, 7.6, { queuePad: 0.6 }) || (solids.every((b) => !boxHit(b, x - 0.4, x + 0.4, G + 0.05, G + 7.6, z - 0.4, z + 0.4)) && tracks.every(([tx, , tz]) => Math.hypot(tx - x, tz - z) > 4.6)))) continue;
        // the banner itself must be clear of everything up there
        const bx0 = Math.min(posts[0][0], posts[1][0]) - 0.3, bx1 = Math.max(posts[0][0], posts[1][0]) + 0.3, bz0 = Math.min(posts[0][1], posts[1][1]) - 0.3, bz1 = Math.max(posts[0][1], posts[1][1]) + 0.3;
        if (solids.some((b) => boxHit(b, bx0, bx1, G + 5.6, G + 8, bz0, bz1))) continue;
        arch = { posts, cx, cz, w };
        break;
      }
      if (arch) break;
    }
    if (arch) {
      const yaw = Math.atan2(dx, dz);
      for (const [x, z] of arch.posts) {
        box([0.6, 7.4, 0.6], [x, G, z], WHITE, 'Metal', { shape: 5 });
        for (let k = 0; k < 6; k++) add([0.66, 0.5, 0.66], [x, G + 0.6 + k * 1.2, z], k % 2 ? C2 : C1, 'SmoothPlastic', { collide: 0, shape: 5 });
        add([1.1, 1.1, 1.1], [x, G + 8, z], 0xffd040, 'Neon', { collide: 0, shape: 3 });
        placed.push([x, z, 0.6]);
      }
      add([arch.w * 2 + 0.8, 2.2, 0.4], [arch.cx, G + 6.6, arch.cz], C1, 'SmoothPlastic', { collide: 0, yaw });
      for (const [face, off] of [['Back', 0.22], ['Front', -0.22]]) {
        sign([arch.w * 2 - 0.2, 1.9, 0.1], [arch.cx + dx * off, G + 6.6, arch.cz + dz * off], C1, face, [['☀ ' + ov.name.toUpperCase() + ' ☀', 0, 0, 1, 0.66, WHITE], ['SUMMER OVERLAY', 0, 0.66, 1, 0.34, C2, 'GothamBold']], { glow: true, yaw });
      }
      // sun rays fanned over the top
      for (let k = -2; k <= 2; k++) add([0.3, 1.4, 0.2], [arch.cx - dz * k * 0.9, G + 8.3 - Math.abs(k) * 0.2, arch.cz + dx * k * 0.9], 0xffc020, 'Neon', { collide: 0, yaw, rot: null });
    }

    // ---- the line: misting fans along a heatwave queue
    if (ov.kit === 'heatwave') {
      const qp = ride.queue.points;
      let acc = 0;
      for (let k = 2; k < qp.length; k += 2) {
        acc += Math.hypot(qp[k] - qp[k - 2], qp[k + 1] - qp[k - 1]);
        if (acc < 22) continue;
        acc = 0;
        data.tags.SteamVent.push([qp[k], G + 3.6, qp[k + 1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      }
    }

    // ---- the new summer name, the ride's new effects, the crew's lines
    cfg.summerOverlay = ov.title;
    cfg.baseName = cfg.name;
    cfg.name = ov.name;
    cfg.description = `☀ SUMMER OVERLAY: ${ov.blurb} ${cfg.description}`;
    cfg.cues = [...(cfg.cues || []), ...ov.cues];
    data.staff.lines.greeter = [...(data.staff.lines.greeter || []), ov.greet];
    out.overlays.push({ id: ov.id, name: ov.name, entrance: E, arch: !!arch, made });
  }
  return out;
}

// a toast the first time you come near each overlay
export class SummerOverlaySite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = new Set();
    this.first = false;
  }

  update(dt, pos, started) {
    if (!started) return;
    if (!this.first) {
      this.first = true;
      this.hooks.toast(`☀ Summer overlays are here! ${this.layout.overlays.length} rides have summer makeovers - look for the ☀ arches.`, 'reward');
    }
    for (const o of this.layout.overlays) {
      if (this.told.has(o.id)) continue;
      if (Math.hypot(pos.x - o.entrance[0], pos.z - o.entrance[1]) < 30) {
        this.told.add(o.id);
        this.hooks.toast(`☀ Summer overlay: ${o.name}!`, 'reward');
      }
    }
  }
}
