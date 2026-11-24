// BLACKLINE: The Last Train - a haunted subway dark ride on the field south
// of Ravage (through a gate in Ravage's south wall). The Blackline closed
// years ago. Tonight one last train is running.
//
// The front is one whole subway station: the station house with BLACKLINE
// across the top, the street entrance (railings, globe lamps, turnstiles)
// and the exit side by side. The line goes down past the turnstiles into a
// chain-link yard beside the tent (flickering station signs, route maps,
// crackling announcements), then under cover onto a deserted platform.
//
// The ride, in subway cars on rails, slowly (the effects make the speed):
// out of the station past the maintenance yard and into a dark tunnel in
// the side of a huge black tent; round the train graveyard; past Graymoor,
// an abandoned platform with silhouettes behind its frosted windows; into
// the junction, where the train stops, the lights die and the announcer
// says there are no more scheduled stops - and in the red emergency light
// something that used to be the line's last conductor is standing beside
// the track. Then the escape: fans, chasing lights, the roar of a train
// behind you, the tunnel falling in, and out through a ruined tunnel mouth
// into the fenced rail yard, round a wrecked subway car and back along the
// tent to the station. "Your stop disappeared years ago."
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'Blackline';
const SITE = { x0: -592, x1: -252, z0: -716, z1: -610 };
const TENT = { x0: -500, x1: -384, z0: -706, z1: -630, H: 12, RIDGE: 21 };
const GATE = { x0: -266, x1: -254 }; // in Ravage's south wall (z -608)
const G = 0.1;
const TY = 1.8; // the cars ride this high over the rails' line
const CARS = 3, SPACING = 8;
const HOLD = 10; // stopped in the junction, in the dark
const BLACK = 0x111113, INK = 0x0a0a0c, RED = 0xc81a1a, WHITE = 0xf2f2ee, TILE = 0xd8d2c0, STEEL = 0x8a9096, SILVER = 0xb8bcc4, AMBER = 0xffb040, CONC = 0x6a6a68, RUST = 0x7a4a2a, YELLOW = 0xf2c418;
const MESH = 0x8a9096; // chain-link

// the circuit (x, y, z of the cars' running line, and the speed there)
const CIRCUIT = [
  [-352, TY, -662, 1.5],
  // out of the station past the maintenance yard, into the tunnel
  [-352, TY, -672, 2.5], [-352.6, TY, -682, 3], [-355.5, TY, -690.5, 3], [-362, TY, -696.2, 3], [-372, TY, -698, 3], [-384, TY, -698, 3],
  // the tunnel, west
  [-404, TY, -698, 3.5], [-426, TY, -698, 3.5], [-448, TY, -698, 3.5], [-466, TY, -698, 3],
  // round the train graveyard
  [-475.9, TY, -693.9, 2.8], [-480, TY, -684, 2.8], [-475.9, TY, -674.1, 2.8], [-466, TY, -670, 2.5],
  // Graymoor, the abandoned platform, east
  [-452, TY, -670, 2.2], [-438, TY, -670, 2], [-424, TY, -670, 2.2], [-410, TY, -670, 2.6],
  // round into the junction
  [-399.9, TY, -665.9, 2.8], [-396, TY, -656, 2.8], [-399.9, TY, -646.1, 2.8], [-410, TY, -642, 2.4],
  // the junction (the train stops at -428 - see below), then the escape, west
  [-420, TY, -642, 1.6], [-428, TY, -642, 0.8], [-440, TY, -642, 5], [-456, TY, -642, 8], [-474, TY, -642, 10], [-500, TY, -642, 10],
  // out through the ruined tunnel mouth into the rail yard, round the wreck
  [-518, TY, -644, 9.5], [-536, TY, -654, 9], [-548, TY, -670, 8.5], [-556, TY, -690, 8], [-566, TY, -702, 7.5], [-578, TY, -704, 7], [-585, TY, -694, 7], [-586, TY, -676, 7], [-584, TY, -656, 7], [-578, TY, -636, 7], [-566, TY, -623, 6.5], [-550, TY, -619, 6],
  // back along the north side of the tent, and into the station
  [-520, TY, -619, 6], [-480, TY, -619, 5.5], [-440, TY, -619, 5], [-400, TY, -619, 4.5], [-376, TY, -619, 4], [-363, TY, -621.5, 3.5], [-354.5, TY, -628, 3], [-352, TY, -638, 2.5], [-352, TY, -650, 2],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

// the station house, the platform, the queue
const SH = { x0: -343, x1: -322, z0: -676, z1: -630 };
const PL = { x0: -349.5, x1: -343, z0: -668, z1: -636 };
const KIOSK = [-306, -656];
const YARD = { x0: -337, x1: -258, z0: -716, z1: -680.5 };
const LANES = [-684, -690, -696, -702, -708, -713.5];
const EXIT_DOOR = -640;

// the creature, drawn about its feet, facing -z
function conductor(pp) {
  const SKIN = 0x5c5e58, RAG = 0x1a1e2a, CAP = 0x101420, BRASS = 0x9a7a3a, EYE = 0xff2a1a;
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push(pp(0, [0.45, 2.8, 0.45], [sx * 0.5, 1.4, 0.1], RAG, 'Fabric'));
    parts.push(pp(0, [0.6, 0.3, 0.9], [sx * 0.5, 0.15, -0.15], INK, 'Rubber'));
  }
  // a long hunched body in the rags of a transit coat
  parts.push(pp(0, [1.7, 2.6, 0.9], [0, 3.9, -0.2], RAG, 'Fabric', RX(0.3)));
  parts.push(pp(0, [1.9, 1.4, 1.0], [0, 2.8, 0.1], RAG, 'Fabric'));
  for (let k = 0; k < 5; k++) parts.push(pp(0, [0.3, 1.2 + (k % 3) * 0.4, 0.1], [-0.8 + k * 0.4, 2.0, 0.55], RAG, 'Fabric'));
  parts.push(pp(0, [0.2, 0.2, 0.05], [-0.45, 4.4, -0.75], BRASS, 'Metal'));
  // the head, too long, pushed forward; the old conductor's cap
  parts.push(pp(3, [1.0, 1.4, 1.1], [0, 5.6, -0.9], SKIN, 'SmoothPlastic'));
  parts.push(pp(5, [1.1, 0.35, 1.1], [0, 6.35, -0.9], CAP, 'Fabric'));
  parts.push(pp(0, [1.1, 0.08, 0.5], [0, 6.2, -1.45], CAP, 'Fabric'));
  parts.push(pp(0, [0.3, 0.18, 0.05], [0, 6.38, -1.47], BRASS, 'Metal'));
  for (const sx of [-1, 1]) parts.push(pp(3, [0.24, 0.2, 0.2], [sx * 0.22, 5.75, -1.42], EYE, 'Neon'));
  parts.push(pp(0, [0.5, 0.14, 0.1], [0, 5.25, -1.44], INK, 'SmoothPlastic'));
  // cables hanging off it like hair
  for (let k = 0; k < 6; k++) parts.push(pp(0, [0.07, 1.4 + (k % 3) * 0.5, 0.07], [-0.4 + k * 0.16, 5.0, -0.4], INK, 'Rubber'));
  // long arms reaching for the train, long fingers
  for (const sx of [-1, 1]) {
    parts.push(pp(0, [0.35, 2.0, 0.35], [sx * 1.05, 4.0, -0.6], RAG, 'Fabric', RX(0.6)));
    parts.push(pp(0, [0.3, 0.3, 2.4], [sx * 1.15, 3.2, -2.1], SKIN, 'SmoothPlastic'));
    for (let f = -1; f <= 1; f++) parts.push(pp(0, [0.08, 0.08, 0.9], [sx * 1.15 + f * 0.13, 3.1, -3.6], SKIN, 'SmoothPlastic'));
  }
  // a lantern in one hand, gone dark
  parts.push(pp(0, [0.4, 0.6, 0.4], [1.15, 2.6, -3.3], 0x2a2a2a, 'Metal'));
  return parts;
}

export function buildBlackline(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.Campfire = data.tags.Campfire || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color, group) => data.hauntLights.push(group ? [x, y, z, color, group] : [x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  const walk = (pts, w, color = 0x5a5a5c, mat = 'Concrete') => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([w, 0.2, len + w], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], color, mat, { yaw, collide: 0 });
    }
  };
  // a chain-link fence from (xa, za) to (xb, zb), posts every 4
  const fence = (xa, za, xb, zb, h = 2.4, solid = 0) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    const n = Math.max(1, Math.round(len / 4));
    for (let k = 0; k <= n; k++) box([0.2, h + 0.2, 0.2], [xa + ((xb - xa) * k) / n, G, za + ((zb - za) * k) / n], STEEL, 'Metal', { shape: 5, collide: solid });
    add([0.08, h, len], [(xa + xb) / 2, G + h / 2 + 0.1, (za + zb) / 2], MESH, 'Metal', { yaw, trans: 0.6, collide: solid });
    add([0.12, 0.12, len], [(xa + xb) / 2, G + h + 0.15, (za + zb) / 2], STEEL, 'Metal', { yaw, collide: 0 });
  };

  // ======== the site: the field south of Ravage, walled, paved
  data.flatZones = [...(data.flatZones || []), { x0: SITE.x0 - 2, x1: SITE.x1, z0: SITE.z0 - 2, z1: SITE.z1 + 2, margin: 24 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 10));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 4, 1, SITE.z1 - SITE.z0 + 4], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x3e3e40, 'Asphalt');
  const wallSeg = (xa, za, xb, zb, color = 0x96928c) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], color, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xc4beb4, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-594, -608, -594, -718);
  wallSeg(-594, -718, -250, -718);
  wallSeg(-250, -718, -250, -700);
  // the gate in Ravage's south wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 608) < 0.6 && Math.abs(p[4] + 422.6) < 0.6 && p[3] > 300;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-594, -608, GATE.x0, -608);
  wallSeg(GATE.x1, -608, -251.2, -608);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.6, 15, 1.6], [x, G, -608], BLACK, 'Metal');
    for (let k = 0; k < 7; k++) add([1.7, 0.4, 1.7], [x, G + 1.5 + k * 2, -608], k % 2 ? RED : WHITE, 'SmoothPlastic', { collide: 0 });
    add([1.6, 1.6, 1.6], [x, G + 15.8, -608], 0xff4a3a, 'Neon', { collide: 0, shape: 3 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.6, 1.2], [gx, G + 13.6, -608], BLACK, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.6, 2.2, 0.2], [gx, G + 13.6, -607.3], BLACK, 'Back', [['BLACKLINE', 0, 0, 1, 0.62, WHITE], ['THE LAST TRAIN', 0, 0.62, 1, 0.38, 0xff4a3a, 'GothamBold']], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.6, 2.2, 0.2], [gx, G + 13.6, -608.7], BLACK, 'Front', [['BLACKLINE', 0, 0, 1, 0.62, WHITE], ['THE LAST TRAIN', 0, 0.62, 1, 0.38, 0xff4a3a, 'GothamBold']], { glow: true });
  // the walk down the east side of Ravage's field from its gate
  walk([[-252, -480], [-258, -488], [-259, -604], [gx, -612]], 3.2, 0x6a6a68);
  box([0.3, 5, 0.3], [-256.4, G, -496], BLACK, 'Metal', { collide: 0 });
  sign([0.2, 1.4, 5.4], [-256.2, G + 4.4, -496], BLACK, 'Right', [['BLACKLINE  >', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  sign([0.2, 1.4, 5.4], [-256.6, G + 4.4, -496], BLACK, 'Left', [['<  BLACKLINE', 0, 0, 1, 1, WHITE, 'GothamBold']]);

  // ======== the track, with the stop in the junction
  const track = makeTrack(CIRCUIT);
  const sk = (x, z) => { const p = CIRCUIT[knot(x, z)]; let best = 0, bd = Infinity; for (let i = 0; i < track.cum.length; i++) { const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } return track.cum[best]; };
  let tStop;
  {
    const sStop = sk(-428, -642);
    const iS = track.cum.findIndex((c) => c >= sStop);
    const a = (sStop - track.cum[iS - 1]) / (track.cum[iS] - track.cum[iS - 1]);
    const lerp3 = (arr) => [0, 1, 2].map((k) => arr[(iS - 1) * 3 + k] + (arr[iS * 3 + k] - arr[(iS - 1) * 3 + k]) * a);
    tStop = track.times[iS - 1] + (track.times[iS] - track.times[iS - 1]) * a;
    const p = lerp3(track.pos), tn = lerp3(track.tan), u = lerp3(track.up);
    for (let i = iS; i < track.times.length; i++) track.times[i] += HOLD;
    track.pos.splice(iS * 3, 0, ...p, ...p);
    track.tan.splice(iS * 3, 0, ...tn, ...tn);
    track.up.splice(iS * 3, 0, ...u, ...u);
    track.cum.splice(iS, 0, sStop, sStop);
    track.times.splice(iS, 0, tStop, tStop + HOLD);
  }
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), Tn = new THREE.Vector3(), R = new THREE.Vector3();
  const L = track.length;
  const samples = [];
  for (let s = 0; s < L; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  const grid = new Map();
  for (const f of samples) {
    const key = `${Math.floor(f[0] / 10)},${Math.floor(f[2] / 10)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(f);
  }
  const near = (x, z) => {
    const out = [], i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(`${i + a},${j + b}`); if (l) out.push(...l); }
    return out;
  };
  // clear of the cars (they're 3.5 wide and ride 3.3 over the line)
  const clearOf = (size, pos, pad = 2.6) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 1.8 && pos[1] - ey < y + 3.6) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);
  const frameAt = (s) => {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    Tn.setFromMatrixColumn(m4, 2).negate();
    Tn.y = 0; Tn.normalize();
    R.set(-Tn.z, 0, Tn.x); // to the right of the way the train is going
    return { x: P.x, z: P.z, tx: Tn.x, tz: Tn.z, rx: R.x, rz: R.z, yaw: Math.atan2(Tn.x, Tn.z) };
  };
  const timeAt = (s) => {
    let i = track.cum.findIndex((c) => c >= s);
    if (i <= 0) return 0;
    const a = (s - track.cum[i - 1]) / Math.max(1e-6, track.cum[i] - track.cum[i - 1]);
    return track.times[i - 1] + (track.times[i] - track.times[i - 1]) * a;
  };
  // a tunnel round the track from s0 to s1: walls 5 to either side, a roof
  const tunnel = (s0, s1, { left = true, right = true, roof = true, color = 0x2c2c2e, h = 7.4 } = {}) => {
    for (let s = s0; s < s1; s += 3) {
      const f = frameAt(Math.min(s + 1.5, s1));
      const len = Math.min(3.3, s1 - s + 0.3);
      for (const [on, side] of [[left, -1], [right, 1]]) if (on) add([0.6, h, len], [f.x + f.rx * 5.3 * side, G + h / 2, f.z + f.rz * 5.3 * side], color, 'Concrete', { yaw: f.yaw });
      if (roof) add([11.2, 0.5, len], [f.x, G + h + 0.25, f.z], color, 'Concrete', { yaw: f.yaw, collide: 0 });
      // ribs every 9
      if (Math.round(s) % 9 < 3) {
        for (const side of [-1, 1]) add([0.3, h, 0.5], [f.x + f.rx * 4.85 * side, G + h / 2, f.z + f.rz * 4.85 * side], 0x3a3a3c, 'Concrete', { yaw: f.yaw, collide: 0 });
        if (roof) add([10, 0.4, 0.5], [f.x, G + h - 0.2, f.z], 0x3a3a3c, 'Concrete', { yaw: f.yaw, collide: 0 });
      }
    }
  };
  // a lamp on a tunnel wall at distance s (side -1 left, 1 right)
  const wallPoint = (s, side, off = 4.7, y = 4.4) => { const f = frameAt(s); return [f.x + f.rx * off * side, G + y, f.z + f.rz * off * side, f.yaw]; };

  // the extras and their animation
  const extras = {}, extrasNames = [], props = [];
  const extra = (name, at, parts, prop) => {
    extras[name] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    extrasNames.push(name);
    if (prop) props.push({ name, at, ...prop });
  };

  // ======== the black tent
  const TC = { x: (TENT.x0 + TENT.x1) / 2, z: (TENT.z0 + TENT.z1) / 2 };
  const PORT_E = { z0: -704, z1: -692 }, PORT_W = { z0: -648, z1: -636 }, PH = 8.6;
  const tentX = (x, za, zb, port) => {
    if (port) {
      box([1, TENT.H, port.z0 - za], [x, G, (za + port.z0) / 2], BLACK, 'Fabric');
      box([1, TENT.H, zb - port.z1], [x, G, (port.z1 + zb) / 2], BLACK, 'Fabric');
      box([1, TENT.H - PH, port.z1 - port.z0], [x, G + PH, (port.z0 + port.z1) / 2], BLACK, 'Fabric');
    } else box([1, TENT.H, zb - za], [x, G, (za + zb) / 2], BLACK, 'Fabric');
  };
  tentX(TENT.x0, TENT.z0, TENT.z1, PORT_W);
  tentX(TENT.x1, TENT.z0, TENT.z1, PORT_E);
  for (const z of [TENT.z0, TENT.z1]) box([TENT.x1 - TENT.x0 + 1, TENT.H, 1], [TC.x, G, z], BLACK, 'Fabric');
  {
    const half = (TENT.z1 - TENT.z0) / 2, rise = TENT.RIDGE - TENT.H, len = Math.hypot(half, rise) + 1.4;
    const c = half / Math.hypot(half, rise), s = rise / Math.hypot(half, rise);
    add([TENT.x1 - TENT.x0 + 3, 0.5, len], [TC.x, G + TENT.H + rise / 2 + 0.2, TC.z - half / 2], 0x161618, 'Fabric', { rot: [1, 0, 0, 0, c, s, 0, -s, c] });
    add([TENT.x1 - TENT.x0 + 3, 0.5, len], [TC.x, G + TENT.H + rise / 2 + 0.2, TC.z + half / 2], 0x161618, 'Fabric', { rot: [1, 0, 0, 0, c, -s, 0, s, c] });
    for (const x of [TENT.x0, TENT.x1]) {
      add([1, rise, half], [x, G + TENT.H + rise / 2, TC.z - half / 2], BLACK, 'Fabric', { shape: 1, collide: 0 });
      add([1, rise, half], [x, G + TENT.H + rise / 2, TC.z + half / 2], BLACK, 'Fabric', { shape: 1, collide: 0, rot: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
    }
    // the ridge, the masts, the guy ropes and the red stripe round the eaves
    add([TENT.x1 - TENT.x0 + 4, 0.6, 0.6], [TC.x, G + TENT.RIDGE + 0.5, TC.z], 0x2a2a2c, 'Metal', { collide: 0 });
    for (const x of [TENT.x0 - 1, TENT.x1 + 1]) { box([0.8, TENT.RIDGE + 3, 0.8], [x, G, TC.z], 0x2a2a2c, 'Metal', { shape: 5 }); neon([0.6, 0.6, 0.6], [x, G + TENT.RIDGE + 3.3, TC.z], 0xff3020, { shape: 3 }); }
    for (const z of [TENT.z0 - 0.6, TENT.z1 + 0.6]) add([TENT.x1 - TENT.x0 + 1.4, 0.8, 0.2], [TC.x, G + TENT.H - 0.6, z], RED, 'SmoothPlastic', { collide: 0 });
    for (const x of [TENT.x0 - 0.6, TENT.x1 + 0.6]) add([0.2, 0.8, TENT.z1 - TENT.z0 + 1.4], [x, G + TENT.H - 0.6, TC.z], RED, 'SmoothPlastic', { collide: 0 });
  }
  // BLACKLINE on the tent's long sides
  sign([60, 5, 0.2], [TC.x, G + 7, TENT.z1 + 0.62], BLACK, 'Back', [['BLACKLINE', 0, 0, 1, 0.7, WHITE], ['THE LAST TRAIN', 0, 0.7, 1, 0.3, 0xff3a2a, 'GothamBold']], { glow: true });
  sign([60, 5, 0.2], [TC.x, G + 7, TENT.z0 - 0.62], BLACK, 'Front', [['BLACKLINE', 0, 0, 1, 0.7, WHITE], ['THE LAST TRAIN', 0, 0.7, 1, 0.3, 0xff3a2a, 'GothamBold']], { glow: true });
  // the floor inside
  add([TENT.x1 - TENT.x0 - 1, 0.2, TENT.z1 - TENT.z0 - 1], [TC.x, G + 0.02, TC.z], 0x1c1c1e, 'Asphalt', { collide: 0 });

  // the tunnel mouth in the tent's east side: concrete, a dead signal
  {
    const x = TENT.x1 + 0.9, zc = (PORT_E.z0 + PORT_E.z1) / 2;
    for (const z of [PORT_E.z0 - 1, PORT_E.z1 + 1]) box([1.2, PH + 2, 2], [x, G, z], CONC, 'Concrete');
    add([1.2, 2.4, PORT_E.z1 - PORT_E.z0 + 4], [x, G + PH + 1.2, zc], CONC, 'Concrete', { collide: 0 });
    sign([0.2, 1.4, 9], [x + 0.7, G + PH + 1.2, zc], CONC, 'Right', [['BLACKLINE  ·  TUNNEL 4', 0, 0, 1, 1, INK, 'GothamBold']]);
    box([0.5, 4, 0.5], [x + 1.4, G, PORT_E.z1 + 3], INK, 'Metal', { collide: 0 });
    add([0.8, 2, 0.8], [x + 1.4, G + 4.8, PORT_E.z1 + 3], INK, 'Metal', { collide: 0 });
    neon([0.5, 0.5, 0.5], [x + 1.85, G + 5.3, PORT_E.z1 + 3], 0xff2010, { shape: 3 });
    add([0.5, 0.5, 0.5], [x + 1.85, G + 4.4, PORT_E.z1 + 3], 0x1a3a1a, 'SmoothPlastic', { collide: 0, shape: 3 });
    data.tags.SteamVent.push([x + 2, G + 0.4, zc + 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the ruined tunnel mouth in the west side: broken concrete, a fallen sign,
  // rubble, bent rebar
  {
    const x = TENT.x0 - 0.9, zc = (PORT_W.z0 + PORT_W.z1) / 2;
    box([1.4, 6, 2.2], [x, G, PORT_W.z0 - 1.2], CONC, 'Concrete');
    box([1.4, 9.5, 2.2], [x, G, PORT_W.z1 + 1.2], CONC, 'Concrete');
    add([1.4, 2.2, 6], [x, G + PH + 1.4, PORT_W.z1 - 1.6], CONC, 'Concrete', { collide: 0, rot: RX(-0.18) });
    add([1.4, 1.6, 4], [x, G + PH + 2.6, PORT_W.z0 + 0.8], CONC, 'Concrete', { collide: 0, rot: RX(0.35) });
    for (let k = 0; k < 5; k++) add([0.12, 2 + k * 0.4, 0.12], [x - 0.2, G + PH + 1.2, PORT_W.z0 + 2 + k * 1.6], RUST, 'Metal', { collide: 0, rot: RX(-0.5 + k * 0.25) });
    const fallen = add([0.3, 1.6, 9], [x - 1.2, G + 3.4, zc + 7.5], INK, 'SmoothPlastic', { collide: 0, rot: RX(0.55) });
    data.signs.push({ part: fallen, face: 'Left', glow: false, labels: [{ text: 'BLACKLINE', x: 0, y: 0, w: 1, h: 1, color: 0x9a9a9a, font: 'GothamBlack', align: 'Center', stroke: false, pad: 0.1 }] });
    for (const [dx, dz, s] of [[-4, -8.5, 2.4], [-6, 8, 2], [-3, 10, 1.4], [-8, -11, 1.6], [-2.5, -11.5, 1.2]]) if (clearOf([s * 1.6, s, s * 1.6], [x + dx, G + s / 2, zc + dz])) add([s * 1.6, s, s * 1.4], [x + dx, G + s / 2 - 0.2, zc + dz], CONC, 'Concrete', { collide: 0, rot: RY(dx + dz) });
    light(x - 6, G + 4, zc - 10, 0xff7a30);
    data.tags.Campfire.push([x - 5, G + 0.4, zc - 13, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    data.tags.SteamVent.push([x - 3, G + 0.4, zc + 9, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ======== inside: the tunnel, west
  const sPortE = sk(-384, -698), sU1 = sk(-466, -698), sGr0 = sk(-466, -670), sGr1 = sk(-410, -670), sJ0 = sk(-410, -642), sStop = sk(-428, -642), sEsc = sk(-440, -642), sPortW = sk(-500, -642);
  tunnel(sPortE + 1.5, sU1);
  for (let s = sPortE + 8; s < sU1 - 4; s += 11) {
    const side = Math.round(s / 11) % 2 ? 1 : -1;
    const [x, y, z, yaw] = wallPoint(s, side);
    add([0.5, 0.5, 0.9], [x, y, z], 0x2a2a2a, 'Metal', { collide: 0, yaw });
    neon([0.3, 0.3, 0.6], [x - side * 0.2 * Math.cos(yaw), y - 0.3, z], AMBER, { yaw });
    light(x, y - 1, z, 0xffa040);
  }
  // cable runs along both walls, a dead signal, stencilled warnings
  for (const side of [-1, 1]) for (let s = sPortE + 3; s < sU1 - 3; s += 3) {
    const [x, , z, yaw] = wallPoint(s, side, 4.85);
    add([0.2, 0.2, 3.1], [x, G + 5.6, z], INK, 'Rubber', { collide: 0, yaw });
    add([0.15, 0.15, 3.1], [x, G + 5.3, z], 0x3a2a1a, 'Rubber', { collide: 0, yaw });
  }
  {
    const [x, y, z, yaw] = wallPoint((sPortE + sU1) / 2, 1, 4.5, 3);
    add([0.7, 1.8, 0.7], [x, y, z], INK, 'Metal', { collide: 0, yaw });
    neon([0.36, 0.36, 0.36], [x, y + 0.45, z], 0xff2010, { shape: 3 });
    sign([6, 1.2, 0.15], [-404, G + 3.2, -693.3], 0x2c2c2e, 'Front', [['STAND CLEAR  ·  NO ENTRY', 0, 0, 1, 1, YELLOW, 'GothamBold']]);
    sign([6, 1.2, 0.15], [-440, G + 3.2, -702.7], 0x2c2c2e, 'Back', [['THE LAST TRAIN  ·  DO NOT BOARD', 0, 0, 1, 1, 0xd8d0b8, 'GothamBold']]);
  }
  // a lamp in a maintenance niche that won't stop flickering
  {
    const [x, y, z, yaw] = wallPoint(sU1 - 12, -1, 4.6, 5);
    extra('TunnelFlicker', [x, y, z], [pp(0, [0.3, 0.3, 1.6], [0, 0, 0], 0xfff0c0, 'Neon', RY(yaw))], { kind: 'blink', period: 1.7, phase: 0, duty: 0.55 });
    light(x, y - 1, z, 0xfff0c0);
  }

  // ======== round the train graveyard: an old car left on a siding, mist
  {
    const C = [-492, -684];
    if (clearOf([4, 5, 14], [C[0], 3, C[1]], 1)) {
      box([3.6, 3.6, 13], [C[0], G + 0.8, C[1]], 0x4a4c50, 'CorrodedMetal', { collide: 0 });
      add([3.7, 0.3, 13.1], [C[0], G + 4.5, C[1]], 0x3a3c40, 'CorrodedMetal', { collide: 0 });
      for (let k = 0; k < 4; k++) add([0.1, 1.2, 1.8], [C[0] + 1.86, G + 3.2, C[1] - 4.5 + k * 3], 0x1a2a2a, 'Glass', { collide: 0, trans: 0.3 });
      add([0.1, 0.4, 13], [C[0] + 1.86, G + 2.2, C[1]], 0x3a1010, 'SmoothPlastic', { collide: 0 });
      for (const z of [C[1] - 4.5, C[1] + 4.5]) for (const dx of [-1.6, 1.6]) add([0.3, 1.2, 1.2], [C[0] + dx, G + 0.6, z], INK, 'Metal', { collide: 0, shape: 2 });
    }
    data.tags.SteamVent.push([-488, G + 0.3, -676, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    data.tags.SteamVent.push([-490, G + 0.3, -694, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    light(-490, 5, -684, 0x6080c0);
    neon([0.4, 0.4, 0.4], [-491, G + 5.6, -680], 0x6080c0, { shape: 3 });
  }

  // ======== Graymoor: the abandoned platform
  {
    const PZ0 = -665.4, PZ1 = -657, BACK = -656.6;
    const x0 = -466, x1 = -410, xc = (x0 + x1) / 2;
    // the wall across the track and the roof over the hall
    box([x1 - x0, 8.6, 0.8], [xc, G, -675.6], 0x2c2c2e, 'Concrete');
    add([x1 - x0, 0.5, 22], [xc, G + 9.2, -665], 0x1a1a1c, 'Concrete', { collide: 0 });
    // the platform, its yellow edge, tiles
    box([x1 - x0, 0.9, PZ1 - PZ0], [xc, G, (PZ0 + PZ1) / 2], 0x8a8478, 'Concrete');
    add([x1 - x0, 0.06, 0.5], [xc, G + 0.93, PZ0 + 0.3], YELLOW, 'SmoothPlastic', { collide: 0 });
    // the back wall: tiles up to the windows, then the frosted glass
    const WIN = { x0: -464, x1: -444 };
    box([WIN.x0 - x0, 8.6, 0.6], [(x0 + WIN.x0) / 2, G, BACK], TILE, 'Concrete');
    box([x1 - WIN.x1, 8.6, 0.6], [(WIN.x1 + x1) / 2, G, BACK], TILE, 'Concrete');
    box([WIN.x1 - WIN.x0, 2.6, 0.6], [(WIN.x0 + WIN.x1) / 2, G, BACK], TILE, 'Concrete');
    box([WIN.x1 - WIN.x0, 2.0, 0.6], [(WIN.x0 + WIN.x1) / 2, G + 6.6, BACK], TILE, 'Concrete');
    for (let x = WIN.x0; x < WIN.x1 - 0.1; x += 5) {
      add([4.6, 4, 0.2], [x + 2.5, G + 4.6, BACK], 0xc8d4dc, 'Glass', { trans: 0.42 });
      add([0.4, 4, 0.7], [x, G + 4.6, BACK], 0x2a2a2c, 'Metal', { collide: 0 });
    }
    add([0.4, 4, 0.7], [WIN.x1, G + 4.6, BACK], 0x2a2a2c, 'Metal', { collide: 0 });
    // the waiting room behind, lit from the back, the people in it
    box([WIN.x1 - WIN.x0 + 4, 8.6, 0.4], [(WIN.x0 + WIN.x1) / 2, G, -648.6], 0x2c2c2e, 'Concrete');
    for (const x of [WIN.x0 - 2, WIN.x1 + 2]) box([0.4, 8.6, 7.6], [x, G, -652.6], 0x2c2c2e, 'Concrete');
    add([WIN.x1 - WIN.x0, 5, 0.2], [(WIN.x0 + WIN.x1) / 2, G + 4.6, -649.1], 0xeaf0ff, 'Neon', { collide: 0 });
    add([WIN.x1 - WIN.x0 + 4, 0.4, 8], [(WIN.x0 + WIN.x1) / 2, G + 8.8, -652.6], 0x2c2c2e, 'Concrete', { collide: 0 });
    const figure = (dx, h = 1, arm = 0) => [
      pp(3, [0.9 * h, 1.0 * h, 0.9 * h], [dx, 4.6 * h, 0], INK, 'SmoothPlastic'),
      pp(0, [1.5 * h, 2.2 * h, 0.6 * h], [dx, 2.95 * h, 0], INK, 'SmoothPlastic'),
      pp(0, [1.2 * h, 1.9 * h, 0.5 * h], [dx, 0.95 * h, 0], INK, 'SmoothPlastic'),
      ...(arm ? [pp(0, [0.4, 2.0, 0.4], [dx + 0.9 * arm, 3.8, 0], INK, 'SmoothPlastic', RZ(-0.5 * arm))] : []),
    ];
    // some stand still; some drift along the glass; one keeps tapping on it
    for (const [x, h] of [[-461, 1], [-447, 1.08]]) for (const p of figure(0, h)) { p[4] += x; p[5] += G + 0.9; p[6] += -652.6; data.static.push([...p.slice(0, 19), 0]); }
    extra('Silhouette1', [-458, G + 0.9, -653], figure(0, 1.05), { kind: 'lunge', dir: [1, 0], reach: 5, period: 9 });
    extra('Silhouette2', [-450, G + 0.9, -652], figure(0, 0.98, 1), { kind: 'lunge', dir: [-1, 0], reach: 4, period: 11 });
    extra('Silhouette3', [-454, G + 0.9, -655.6], [...figure(0, 1, -1), pp(0, [0.5, 0.5, 0.3], [-1.3, 5.2, -0.4], INK, 'SmoothPlastic')], { kind: 'piston', amp: 0.18, freq: 6, phase: 0 });
    light(-454, 6, -652, 0xdde6ff);
    // the station name, a stopped clock, a dead board, benches, papers
    for (const x of [-461, -414]) sign([4.6, 1.3, 0.2], [x, G + 5, BACK - 0.45], 0x1a1a1c, 'Front', [['GRAYMOOR', 0, 0, 1, 1, WHITE]]);
    add([WIN.x1 - WIN.x0 + 12, 0.6, 0.1], [(WIN.x0 + WIN.x1) / 2, G + 2.2, BACK - 0.36], 0x1a1a1c, 'SmoothPlastic', { collide: 0 });
    add([1.6, 1.6, 0.3], [-438, G + 7.6, BACK - 0.5], 0x2a2a2c, 'Metal', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
    neon([1.3, 1.3, 0.1], [-438, G + 7.6, BACK - 0.68], 0xf0ecd8, { shape: 2, rot: RY(Math.PI / 2) });
    for (const a of [0.6, 2.4]) add([0.08, 0.55, 0.05], [-438 + Math.sin(a) * 0.25, G + 7.6 + Math.cos(a) * 0.25, BACK - 0.76], INK, 'SmoothPlastic', { collide: 0, rot: RZ(-a) });
    sign([7, 1.6, 0.2], [-424, G + 8, BACK - 0.6], INK, 'Front', [['NO SERVICE', 0, 0, 1, 1, 0xff8a20, 'Code']], { glow: true });
    for (const x of [-460, -446, -432, -418]) {
      box([3.2, 0.25, 1], [x, G + 1.5, BACK - 1.2], 0x4a3a2a, 'WoodPlanks', { collide: 0 });
      for (const dx of [-1.3, 1.3]) box([0.2, 0.6, 0.8], [x + dx, G + 0.9, BACK - 1.2], INK, 'Metal', { collide: 0 });
    }
    for (const [x, z] of [[-452, -661], [-444, -660], [-428, -662.4], [-421, -659.4]]) add([0.9, 0.04, 0.7], [x, G + 0.92, z], 0xd8d0b8, 'SmoothPlastic', { collide: 0, rot: RY(x) });
    // the lights: one tube has given up, one can't decide
    for (const x of [-460, -448, -436, -412]) neon([4, 0.15, 0.3], [x, G + 8.8, -661], 0xdde8ff);
    extra('PlatformFlicker', [-424, G + 8.8, -661], [pp(0, [4, 0.15, 0.3], [0, 0, 0], 0xdde8ff, 'Neon')], { kind: 'blink', period: 0.9, phase: 0.3, duty: 0.45 });
    light(-456, 7, -662, 0xc8d8ff);
    light(-420, 7, -662, 0xc8d8ff);
  }

  // ======== round into the junction
  tunnel(sGr1 + 1, sJ0, { color: 0x262628 });
  for (const s of [sGr1 + 12, sGr1 + 28]) { const [x, y, z, yaw] = wallPoint(s, -1); neon([0.3, 0.3, 0.6], [x, y, z], 0xff3020, { yaw }); }

  // ======== the junction: where the train stops and the lights die
  const J = { x0: -440, x1: -406, z0: -653, z1: -630.5 };
  const tB0 = tStop + 0.6, tR0 = tStop + 3.6, tGo = tStop + HOLD, tB1 = tGo + 2.5;
  {
    box([J.x1 - J.x0, 9, 0.6], [(J.x0 + J.x1) / 2, G, J.z0], 0x2a2a2c, 'Concrete');
    add([J.x1 - J.x0 + 2, 0.5, J.z1 - J.z0 + 1], [(J.x0 + J.x1) / 2, G + 9.4, (J.z0 + J.z1) / 2], 0x1c1c1e, 'Concrete', { collide: 0 });
    // switches and points in the floor, a junction box, cables
    for (const z of [-648, -636]) add([30, 0.2, 0.4], [(J.x0 + J.x1) / 2, G + 0.3, z], 0x5a5a5c, 'Metal', { collide: 0, rot: RY(z === -648 ? 0.08 : -0.08) });
    box([2.4, 3.2, 1], [-413, G, J.z0 + 1], 0x3a3c40, 'Metal', { collide: 0 });
    sign([2, 0.8, 0.1], [-413, G + 2.6, J.z0 + 1.55], YELLOW, 'Back', [['DANGER  ·  750V', 0, 0, 1, 1, INK, 'GothamBold']]);
    // the work lights - on until the blackout, back on once the train's gone
    const work = [];
    for (const x of [-436, -426, -416]) for (const z of [J.z0 + 0.7, J.z1 - 0.8]) work.push(pp(0, [1.6, 0.3, 0.3], [x + 438, 6.4, z + 642], 0xfff0c8, 'Neon'));
    extra('JunctionWork', [-438, G, -642], work, { kind: 'show', windows: [[tB0, tB1]], invert: true });
    for (const [x, z] of [[-434, -650], [-418, -650], [-426, -634]]) light(x, 6, z, 0xffe0b0, 'BLwork');
    // the red emergency lights, caged, and the red lamps they throw
    const reds = [];
    for (const x of [-436, -426, -414]) for (const z of [J.z0 + 0.9, J.z1 - 1]) {
      reds.push(pp(3, [0.7, 0.7, 0.7], [x + 438, 7.2, z + 642], 0xff1a10, 'Neon'));
      reds.push(pp(0, [0.9, 0.12, 0.9], [x + 438, 7.6, z + 642], INK, 'Metal'));
    }
    extra('JunctionRed', [-438, G, -642], reds, { kind: 'show', windows: [[tR0, tB1]] });
    for (const [x, z] of [[-428, -650], [-414, -636], [-436, -636]]) light(x, 7, z, 0xff1a10, 'BLred');
    // and beside the train, in the red light: what's left of the last conductor
    extra('Conductor', [-426, G, -650.2], conductor(pp), { kind: 'show', windows: [[tR0 + 0.4, tGo + 1.5]], dir: [0, 1], reach: 1.6, rush: 0.5 });
    extra('Conductor2', [-437, G, -634.5], conductor(pp), { kind: 'show', windows: [[tGo - 2.6, tGo + 1]], dir: [0, -1], reach: 1.2, rush: 0.3 });
    data.tags.SteamVent.push([-424, G + 0.3, -652, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  // ======== the escape: fans, chasing lights, the tunnel falling in
  const tEsc0 = tGo - 0.5, tEsc1 = timeAt(sPortW) + 1.5;
  {
    tunnel(sEsc, sPortW - 0.6, { color: 0x232325 });
    // chasing lights down both walls (each group lights in turn, so the
    // light runs back past you)
    const NG = 6, groups = Array.from({ length: NG }, () => []);
    let k = 0;
    const base = [-470, G, -642];
    for (let s = sEsc + 1; s < sPortW - 2; s += 2.2, k++) for (const side of [-1, 1]) {
      const [x, y, z] = wallPoint(s, side, 4.75, 3.2);
      groups[k % NG].push(pp(0, [1.4, 0.25, 0.25], [x - base[0], y - G, z - base[2]], 0xfff2c0, 'Neon'));
      groups[k % NG].push(pp(0, [1.4, 0.25, 0.25], [x - base[0], y - G + 3.2, z - base[2]], 0xff6a20, 'Neon'));
    }
    groups.forEach((g, i) => extra(`Chase${i}`, base, g, { kind: 'blink', period: 0.42, phase: i / NG, duty: 0.3, only: [[tEsc0, tEsc1]] }));
    // big fans in the walls, turning hard
    // (the escape runs straight along x, so the walls face +-z and the fans
    // turn about z)
    const blades = [pp(0, [0.6, 0.6, 0.3], [0, 0, 0], 0x5a5a5c, 'Metal'), ...[0, 1, 2].map((b) => pp(0, [0.7, 2.8, 0.12], [0, 0, 0], 0x7a7c80, 'Metal', RZ((b * Math.PI) / 3)))];
    for (const [s, side] of [[sEsc + 8, 1], [sEsc + 22, -1], [sEsc + 36, 1], [sEsc + 50, -1]]) {
      const [x, y, z] = wallPoint(s, side, 4.5, 4.4);
      const back = z + Math.sign(z + 642) * 0.35;
      add([3.6, 3.6, 0.3], [x, y, back], 0x2a2a2c, 'Metal', { collide: 0 });
      for (const dy of [-1.7, 1.7]) add([3.6, 0.3, 0.6], [x, y + dy, back], 0x3a3a3c, 'Metal', { collide: 0 });
      extra(`Fan${Math.round(s)}`, [x, y, z], blades, { kind: 'spin', speed: 14, axis: 'z' });
    }
    // stones dropping from the roof beside the track, again and again
    for (const [s, side, ph] of [[sEsc + 14, -1, 0], [sEsc + 30, 1, 0.4], [sEsc + 44, -1, 0.7]]) {
      const [x, , z] = wallPoint(s, side, 3.6);
      extra(`Debris${Math.round(s)}`, [x, G + 6.6, z], [pp(0, [1, 0.8, 1.1], [0, 0, 0], CONC, 'Concrete'), pp(0, [0.6, 0.5, 0.5], [0.6, 0.3, 0.4], 0x5a5a58, 'Concrete')], { kind: 'fall', period: 1.6, phase: ph, drop: 6 });
      add([2, 0.5, 2], [x, G + 0.35, z], CONC, 'Concrete', { collide: 0, rot: RY(s) });
    }
    // the light at the end of the tunnel
    light(-496, 5, -642, 0xffd8a0);
  }

  // ======== outside: the departure past the maintenance yard
  {
    // a yellow track machine on a short spur, a ballast hopper, rails and
    // sleepers, a light tower, a generator, cones
    const spur = [-370, -709.5];
    add([22, 0.3, 4], [spur[0], G + 0.15, spur[1]], 0x6a6258, 'Slate', { collide: 0 });
    for (const dz of [-1.4, 1.4]) add([22, 0.25, 0.25], [spur[0], G + 0.45, spur[1] + dz], 0x8a8c92, 'Metal', { collide: 0 });
    if (clearOf([10, 4, 3.4], [-366, 2.5, spur[1]])) {
      box([10, 2.4, 3.2], [-366, G + 0.8, spur[1]], YELLOW, 'Metal');
      box([3.2, 2.2, 3.2], [-362.4, G + 3.2, spur[1]], YELLOW, 'Metal', { collide: 0 });
      add([0.2, 1.2, 2.6], [-360.7, G + 4.4, spur[1]], 0x1a2a3a, 'Glass', { collide: 0, trans: 0.2 });
      neon([0.4, 0.4, 0.4], [-362.4, G + 5.6, spur[1]], 0xff9a10, { shape: 3 });
      for (const x of [-369, -363]) for (const dz of [-1.4, 1.4]) add([0.3, 1, 1], [x, G + 0.6, spur[1] + dz], INK, 'Metal', { collide: 0, shape: 2 });
      add([2, 0.5, 2.6], [-371.5, G + 3.4, spur[1]], 0x3a3a3c, 'Metal', { collide: 0 });
    }
    if (clearOf([5, 4, 4], [-380, 2.5, spur[1]])) {
      box([5, 3, 3.4], [-380, G + 0.6, spur[1]], RUST, 'CorrodedMetal', { collide: 0 });
      add([5.2, 0.6, 3.6], [-380, G + 3.8, spur[1]], 0x5a3a20, 'Slate', { collide: 0 });
    }
    for (let k = 0; k < 5; k++) add([7, 0.3, 0.4], [-364, G + 0.25 + k * 0.32, -686 + (k % 2) * 0.5], 0x4a3a2a, 'Wood', { collide: 0 });
    for (let k = 0; k < 4; k++) add([9, 0.25, 0.3], [-366, G + 1.9 + k * 0.28, -687], 0x8a8c92, 'Metal', { collide: 0 });
    box([1.4, 1.2, 1.4], [-370, G, -683], 0x2a2a2c, 'Metal', { collide: 0 });
    box([0.3, 8, 0.3], [-372, G, -686], 0x3a3a3c, 'Metal', { collide: 0 });
    for (const dx of [-0.8, 0.8]) neon([1.2, 0.8, 0.3], [-372 + dx, G + 8, -686], 0xfff4d8);
    light(-372, 7, -686, 0xfff0d0);
    box([3, 1.6, 2], [-376, G, -680], 0x2a5a2a, 'Metal', { collide: 0 });
    for (const [x, z] of [[-357, -702], [-361, -704], [-366, -705]]) if (clearOf([0.6, 0.8, 0.6], [x, 0.5, z])) add([0.6, 0.9, 0.6], [x, G + 0.45, z], 0xff6a10, 'SmoothPlastic', { collide: 0, shape: 5 });
    sign([3.4, 1.2, 0.2], [-376, G + 2.4, -678.9], YELLOW, 'Back', [['DANGER  ·  THIRD RAIL', 0, 0, 1, 1, INK, 'GothamBold']]);
  }

  // ======== the rail yard: fenced, the wreck, signals, stacks
  {
    fence(-590.5, -712, -504, -712, 3, 1);
    fence(-590.5, -712, -590.5, -612, 3, 1);
    fence(-590.5, -612, -504, -612, 3, 1);
    sign([10, 1.6, 0.2], [-560, G + 2.2, -612.2], 0xf2f2ee, 'Front', [['BLACKLINE YARD  ·  KEEP OUT', 0, 0, 1, 1, RED, 'GothamBold']]);
    // the wreck: a subway car off the rails, on its side, burnt out
    const WR = [-566, -664];
    const tilt = RZ(1.25), yawM = RY(0.45);
    const mul = (A, B) => { const o = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 3; l++) o[i * 3 + j] += A[i * 3 + l] * B[l * 3 + j]; return o; };
    const RM = mul(yawM, tilt);
    const at = (dx, dy, dz) => [WR[0] + RM[0] * dx + RM[1] * dy + RM[2] * dz, G + 1.9 + RM[3] * dx + RM[4] * dy + RM[5] * dz, WR[1] + RM[6] * dx + RM[7] * dy + RM[8] * dz];
    add([3.5, 3.6, 13], at(0, 0, 0), 0x6a6c70, 'CorrodedMetal', { rot: RM });
    add([3.6, 0.5, 13.1], at(0, 0.6, 0), 0x141416, 'SmoothPlastic', { collide: 0, rot: RM });
    add([3.6, 0.15, 13.1], at(0, 0.2, 0), RED, 'SmoothPlastic', { collide: 0, rot: RM });
    for (let k = 0; k < 4; k++) add([3.62, 1.3, 1.8], at(0, 1.1, -4.5 + k * 3), 0x0a0a0a, 'SmoothPlastic', { collide: 0, rot: RM });
    for (const dz of [-4.5, 4.5]) add([0.6, 1.1, 1.1], at(-2.2, -1.6, dz), INK, 'Metal', { collide: 0, shape: 2, rot: RM });
    add([4, 0.3, 3], [WR[0] + 6, G + 0.2, WR[1] - 5], 0x2a2a2a, 'Asphalt', { collide: 0 });
    data.tags.Campfire.push([WR[0] + 2, G + 1, WR[1] + 4, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    data.tags.SteamVent.push([WR[0] - 1, G + 2, WR[1] - 3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    light(WR[0] + 2, 4, WR[1] + 4, 0xff6a20);
    // the yard: signal masts, sleeper stacks, spare wheels, a light tower
    for (const [x, z] of [[-520, -630], [-560, -706], [-588, -640]]) if (clearOf([1, 7, 1], [x, 3.5, z], 3)) {
      box([0.4, 6, 0.4], [x, G, z], INK, 'Metal', { collide: 0 });
      add([0.8, 2.2, 0.8], [x, G + 6.6, z], INK, 'Metal', { collide: 0 });
      neon([0.5, 0.5, 0.5], [x, G + 7.2, z + 0.4], 0xff2010, { shape: 3 });
    }
    for (const [x, z] of [[-540, -708], [-575, -616], [-530, -616]]) if (clearOf([8, 2, 3], [x, 1, z], 3)) for (let k = 0; k < 4; k++) add([7, 0.35, 0.5], [x, G + 0.2 + k * 0.36, z + (k % 2) * 0.6], 0x4a3a2a, 'Wood', { collide: 0 });
    for (const [x, z] of [[-520, -706], [-524, -706]]) add([0.4, 1.6, 1.6], [x, G + 0.8, z], 0x5a4a3a, 'CorrodedMetal', { collide: 0, shape: 2 });
    if (clearOf([2, 12, 2], [-532, 6, -668], 3)) {
      box([0.4, 11, 0.4], [-532, G, -668], 0x3a3a3c, 'Metal', { collide: 0 });
      for (const dx of [-0.8, 0.8]) neon([1.2, 0.8, 0.3], [-532 + dx, G + 11, -668], 0xfff0d0);
      light(-532, 9, -668, 0xfff0d0);
    }
  }

  // ======== the north side: the run home beside the tent
  for (let x = -500; x <= -390; x += 22) {
    if (!clearOf([0.6, 6, 0.6], [x, 3, -611.5], 2)) continue;
    box([0.3, 5.4, 0.3], [x, G, -611.5], 0x2a2a2c, 'Metal', { collide: 0 });
    neon([0.6, 0.3, 0.6], [x, G + 5.4, -611.8], 0xfff0c8);
  }

  // ======== the station: platform, canopy, the station house
  {
    // the platform, the yellow line, the canopy over track and platform
    box([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G, (PL.z0 + PL.z1) / 2], 0x8a8478, 'Concrete');
    add([0.5, 0.06, PL.z1 - PL.z0], [PL.x0 + 0.3, G + 0.43, (PL.z0 + PL.z1) / 2], YELLOW, 'SmoothPlastic', { collide: 0 });
    add([36, 0.5, 46], [-340, G + 8.2, -653], 0x1a1a1c, 'Metal', { collide: 0 });
    for (const z of [-674, -652, -632]) for (const x of [-358.6]) box([0.6, 8, 0.6], [x, G, z], 0x2a2a2c, 'Metal');
    for (let z = -670; z <= -634; z += 6) neon([0.3, 0.15, 3], [-348, G + 7.8, z], 0xe8f0ff);
    light(-347, 6, -660, 0xe0ecff);
    light(-347, 6, -642, 0xe0ecff);
    sign([0.2, 1.3, 10], [-358.3, G + 6, -652], INK, 'Right', [['BLACKLINE TERMINAL', 0, 0, 1, 1, WHITE]]);
    // the station house: a long box, tiles inside, its front to the east
    const H = 11;
    // the front (east) wall: the exit door near its north end
    const D = { z0: EXIT_DOOR - 4, z1: EXIT_DOOR + 4 };
    box([1, H, D.z0 - SH.z0], [SH.x1, G, (SH.z0 + D.z0) / 2], 0x1a1a1c, 'Brick');
    box([1, H, SH.z1 - D.z1], [SH.x1, G, (D.z1 + SH.z1) / 2], 0x1a1a1c, 'Brick');
    box([1, H - 5.6, D.z1 - D.z0], [SH.x1, G + 5.6, EXIT_DOOR], 0x1a1a1c, 'Brick');
    // cream tiles along the bottom, a red band and a cornice
    add([0.3, 3.6, SH.z1 - SH.z0], [SH.x1 + 0.62, G + 1.8, (SH.z0 + SH.z1) / 2], TILE, 'Concrete', { collide: 0 });
    add([0.4, 0.5, SH.z1 - SH.z0 + 1], [SH.x1 + 0.7, G + 3.8, (SH.z0 + SH.z1) / 2], RED, 'SmoothPlastic', { collide: 0 });
    add([1.6, 0.8, SH.z1 - SH.z0 + 2], [SH.x1 + 0.3, G + H + 0.4, (SH.z0 + SH.z1) / 2], 0x2a2a2c, 'Concrete', { collide: 0 });
    sign([0.3, 3.4, 28], [SH.x1 + 0.7, G + 7.6, -658.5], INK, 'Right', [['BLACKLINE', 0, 0, 1, 1, WHITE]], { glow: true });
    sign([0.3, 1.0, 26], [SH.x1 + 0.7, G + 5.1, -658.5], INK, 'Right', [['THE LAST TRAIN  ·  ALL STATIONS CLOSED', 0, 0, 1, 1, 0xff3a2a, 'GothamBold']], { glow: true });
    // the roundel: a red ring, a black bar
    add([0.3, 5, 5], [SH.x1 + 0.7, G + 8.2, -632.8], RED, 'SmoothPlastic', { collide: 0, shape: 2 });
    add([0.36, 3.8, 3.8], [SH.x1 + 0.74, G + 8.2, -632.8], WHITE, 'SmoothPlastic', { collide: 0, shape: 2 });
    sign([0.4, 1.3, 6], [SH.x1 + 0.8, G + 8.2, -632.8], INK, 'Right', [['BL', 0, 0, 1, 1, WHITE]]);
    sign([0.3, 1.2, 6], [SH.x1 + 0.7, G + 6.3, EXIT_DOOR], 0x1a5a3a, 'Right', [['EXIT', 0, 0, 1, 1, WHITE]], { glow: true });
    for (const z of [D.z0 - 1, D.z1 + 1]) { box([0.3, 3.6, 0.3], [SH.x1 + 1, G, z], 0x2a2a2c, 'Metal', { collide: 0 }); neon([0.7, 0.7, 0.7], [SH.x1 + 1, G + 3.9, z], 0xf0f0e0, { shape: 3 }); }
    // the other walls, the roof
    box([SH.x1 - SH.x0, H, 0.8], [(SH.x0 + SH.x1) / 2, G, SH.z1], 0x1a1a1c, 'Brick');
    box([SH.x1 - SH.x0 - 6.6, H, 0.8], [(SH.x0 + 6.6 + SH.x1) / 2, G, SH.z0], 0x1a1a1c, 'Brick');
    box([6.6, H - 5.6, 0.8], [SH.x0 + 3.3, G + 5.6, SH.z0], 0x1a1a1c, 'Brick');
    add([SH.x1 - SH.x0 + 1, 0.5, SH.z1 - SH.z0 + 1], [(SH.x0 + SH.x1) / 2, G + H, (SH.z0 + SH.z1) / 2], 0x222224, 'Concrete', { collide: 0 });
    // inside: tile floor, tiled columns, the wall between the queue hall
    // and the way out, benches, posters, a dead departure board, lights
    add([SH.x1 - SH.x0, 0.2, SH.z1 - SH.z0], [(SH.x0 + SH.x1) / 2, G + 0.1, (SH.z0 + SH.z1) / 2], 0x8a8a84, 'Slate', { collide: 0 });
    add([0.2, 3.4, SH.z1 - SH.z0 - 1], [SH.x1 - 0.6, G + 1.8, (SH.z0 + SH.z1) / 2], TILE, 'Concrete', { collide: 0 });
    box([SH.x1 - SH.x0 - 5, 4, 0.4], [(SH.x0 + 5 + SH.x1) / 2, G, -651], TILE, 'Concrete');
    for (const [x, z] of [[-332.5, -675.4], [-332.5, -651]]) box([0.9, H - 0.2, 0.9], [x, G, z], TILE, 'Concrete', { collide: 0 });
    for (const z of [-672, -664, -656]) for (const x of [-322.9]) {
      const p = sign([0.15, 2.6, 1.8], [x - 0.1, G + 5, z], 0x2a2a2c, 'Left', [['BLACKLINE', 0, 0, 1, 0.3, WHITE, 'GothamBold'], ['SERVING ALL STATIONS', 0, 0.35, 1, 0.3, 0xb0b0a0, 'GothamBold'], ['SINCE 1931', 0, 0.7, 1, 0.3, RED, 'GothamBold']]);
      void p;
    }
    sign([8, 1.4, 0.2], [-332.5, G + 6.2, -651.4], INK, 'Front', [['LAST TRAIN  ·  ALL STOPS  ·  DELAYED', 0, 0, 1, 1, 0xff8a20, 'Code']], { glow: true });
    for (let z = -672; z <= -654; z += 6) neon([3, 0.15, 0.3], [-332, G + H - 0.6, z], 0xe8f0ff);
    extra('HallFlicker', [-332, G + H - 0.6, -637], [pp(0, [3, 0.15, 0.3], [0, 0, 0], 0xe8f0ff, 'Neon')], { kind: 'blink', period: 2.3, phase: 0.6, duty: 0.8 });
    light(-332, 8, -664, 0xe0ecff);
    light(-332, 8, -640, 0xe0ecff);
    // a bench and a broken clock in the way out
    box([4, 0.3, 1], [-330, G + 1.4, -632.2], 0x4a3a2a, 'WoodPlanks', { collide: 0 });
  }

  // ======== the front: the plaza, the subway entrance
  {
    add([66, 0.2, 66], [-287, G + 0.1, -644], 0x6a6a6c, 'Pavement', { collide: 0 });
    // the street entrance: iron railings round three sides, two globe lamps,
    // the sign arch, turnstiles
    const [kx, kz] = KIOSK;
    for (const x of [kx - 3.4, kx + 3.4]) {
      box([0.2, 1.4, 8], [x, G, kz], 0x1a3a2a, 'Metal');
      add([0.3, 0.2, 8.2], [x, G + 1.5, kz], 0x1a3a2a, 'Metal', { collide: 0 });
      box([0.3, 4, 0.3], [x, G, kz + 4.3], 0x1a3a2a, 'Metal', { collide: 0, shape: 5 });
      neon([0.9, 0.9, 0.9], [x, G + 4.4, kz + 4.3], 0xff4a3a, { shape: 3 });
      add([1, 0.2, 1], [x, G + 4.9, kz + 4.3], 0x1a3a2a, 'Metal', { collide: 0 });
    }
    add([7.4, 1.6, 0.4], [kx, G + 5.4, kz + 4.3], INK, 'Metal', { collide: 0 });
    sign([7, 1.3, 0.2], [kx, G + 5.4, kz + 4.55], INK, 'Back', [['BLACKLINE  ·  ENTRANCE', 0, 0, 1, 0.62, WHITE], ['ALL TRAINS', 0, 0.62, 1, 0.38, 0xff4a3a, 'GothamBold']], { glow: true });
    add([7, 2.2, 0.3], [kx, G + 4.2, kz - 4.2], 0x1a3a2a, 'Metal', { collide: 0 });
    for (const x of [kx - 2.2, kx + 2.2]) {
      box([0.8, 1.1, 1.4], [x, G, kz - 3.2], 0x8a8c92, 'Metal', { collide: 0 });
      for (let a = 0; a < 3; a++) add([0.06, 0.06, 1.1], [x + (x < kx ? 0.7 : -0.7), G + 0.9, kz - 3.2], 0xc0c4c8, 'Metal', { collide: 0, rot: RX((a * 2 * Math.PI) / 3) });
    }
    box([1, 2.4, 1.6], [kx + 2.6, G, kz + 2], 0x3a3a3c, 'Metal', { collide: 0 });
    sign([0.1, 0.6, 1.2], [kx + 2.06, G + 1.9, kz + 2], INK, 'Left', [['OUT OF ORDER', 0, 0, 1, 1, 0xff8a20, 'GothamBold']]);
    // the passage down to the yard, chain-link both sides
    fence(kx - 3, kz - 4.6, kx - 3, YARD.z1, 2.6, 1);
    fence(kx + 3, kz - 4.6, kx + 3, YARD.z1, 2.6, 1);
    // street things: lamps, a closed newsstand, a route map, the wait board
    for (const [x, z] of [[-298, -626], [-270, -626], [-270, -664], [-318, -628]]) data.tags.ParkLamp.push([x, G, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    box([4, 3, 2.4], [-280, G, -652], 0x2a3a2a, 'Metal');
    add([4.6, 0.3, 3.2], [-280, G + 3.15, -651.6], 0x1a2a1a, 'Metal', { collide: 0 });
    add([3.6, 1.6, 0.1], [-280, G + 1.5, -650.75], 0x6a6a68, 'CorrodedMetal', { collide: 0 });
    sign([3.6, 0.6, 0.15], [-280, G + 2.75, -650.7], 0x1a2a1a, 'Back', [['NEWS  ·  CLOSED', 0, 0, 1, 1, 0xd8d0b8, 'GothamBold']]);
    const map = add([9, 4, 0.3], [-292, G + 3.2, -662], 0x1a1a1c, 'SmoothPlastic', { collide: 0 });
    data.signs.push({ part: map, face: 'Back', glow: true, labels: [
      { text: 'BLACKLINE', x: 0, y: 0, w: 1, h: 0.2, color: WHITE, font: 'GothamBlack', align: 'Center', stroke: false, pad: 0.1 },
      { text: 'TERMINAL  ·  TUNNEL 4  ·  GRAYMOOR  ·  THE JUNCTION  ·  ???', x: 0, y: 0.26, w: 1, h: 0.18, color: 0xd8d0b8, font: 'GothamBold', align: 'Center', stroke: false, pad: 0.1 },
      { text: 'SERVICE SUSPENDED', x: 0, y: 0.56, w: 1, h: 0.2, color: 0xff3a2a, font: 'GothamBlack', align: 'Center', stroke: false, pad: 0.1 },
    ] });
    add([8, 0.15, 0.32], [-292, G + 4.2, -661.95], RED, 'Neon', { collide: 0 });
    for (const dx of [-3.2, -1.2, 0.8, 2.8]) neon([0.4, 0.4, 0.2], [-292 + dx, G + 4.2, -661.75], WHITE, { shape: 3 });
    for (const x of [-296.2, -287.8]) box([0.3, 5.2, 0.3], [x, G, -662], 0x2a2a2c, 'Metal', { collide: 0 });
    const waitPart = add([4, 1.2, 0.3], [kx, G + 3.1, kz + 4.48], 0x101624, 'SmoothPlastic', { collide: 0 });
    data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Back', ride: RIDE_ID });
    data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 377, cf: cf(kx + 5, G, kz + 6, Math.PI) });
  }

  // ======== the line: the yard of chain-link switchbacks, the covered
  // walkway, the queue hall, onto the platform
  {
    // the yard's fences: round the outside, then between the lanes
    fence(YARD.x0, YARD.z1, KIOSK[0] - 3, YARD.z1, 2.6, 1);
    fence(KIOSK[0] + 3, YARD.z1, YARD.x1, YARD.z1, 2.6, 1);
    fence(YARD.x1, YARD.z1, YARD.x1, YARD.z0, 2.6, 1);
    fence(YARD.x0, YARD.z1, YARD.x0, -710, 2.6, 1);
    fence(YARD.x0 + 3, -687, YARD.x1 - 7, -687, 2.2);
    fence(YARD.x0 + 6, -693, YARD.x1, -693, 2.2);
    fence(YARD.x0, -699, YARD.x1 - 7, -699, 2.2);
    fence(YARD.x0 + 6, -705, YARD.x1, -705, 2.2);
    fence(YARD.x0, -711, YARD.x1 - 7, -711, 2.2);
    // flickering station signs on poles, route maps on the fences, a dead
    // ticket machine, a crackling speaker
    const flick = [];
    for (const [x, z, name] of [[-318, -683.6, 'GRAYMOOR'], [-282, -683.6, 'TUNNEL 4'], [-300, -695.8, 'THE JUNCTION'], [-276, -707.8, 'TERMINAL']]) {
      box([0.25, 3.6, 0.25], [x - 1.9, G, z], 0x2a2a2c, 'Metal', { collide: 0 });
      box([0.25, 3.6, 0.25], [x + 1.9, G, z], 0x2a2a2c, 'Metal', { collide: 0 });
      sign([4.2, 0.9, 0.2], [x, G + 3.4, z], INK, 'Back', [[name, 0, 0, 1, 1, WHITE]]);
      flick.push(pp(0, [4.2, 0.12, 0.3], [x + 300, 3.95, z + 696], 0xffe8c0, 'Neon'));
    }
    extra('QueueFlicker', [-300, G, -696], flick, { kind: 'blink', period: 1.3, phase: 0.2, duty: 0.7 });
    for (const [x, z, face] of [[-330, -692.9, 'Back'], [-268, -704.9, 'Back'], [-300, -710.9, 'Back']]) {
      const mp = add([3.6, 2.2, 0.15], [x, G + 1.6, z], 0x1a1a1c, 'SmoothPlastic', { collide: 0 });
      data.signs.push({ part: mp, face, glow: false, labels: [
        { text: 'BLACKLINE ROUTE', x: 0, y: 0, w: 1, h: 0.3, color: WHITE, font: 'GothamBlack', align: 'Center', stroke: false, pad: 0.1 },
        { text: 'TERMINAL — GRAYMOOR — JUNCTION — ✕', x: 0, y: 0.38, w: 1, h: 0.24, color: 0xff3a2a, font: 'GothamBold', align: 'Center', stroke: false, pad: 0.1 },
        { text: 'stations beyond the junction are no longer served', x: 0, y: 0.7, w: 1, h: 0.2, color: 0xa0a0a0, font: 'Gotham', align: 'Center', stroke: false, pad: 0.1 },
      ] });
    }
    for (const [x, z] of [[-318, -680], [-276, -680], [-336, -700]]) {
      add([0.8, 0.6, 0.5], [x, G + 3.2, z], 0x3a3a3c, 'Metal', { collide: 0 });
      add([0.6, 0.6, 0.1], [x, G + 3.2, z - 0.3], INK, 'Metal', { collide: 0, shape: 2, rot: RY(Math.PI / 2) });
    }
    box([1.2, 2, 0.8], [-334, G, -682.6], 0x5a2a2a, 'Metal', { collide: 0 });
    sign([0.9, 0.5, 0.1], [-334, G + 1.5, -682.15], INK, 'Back', [['TICKETS', 0, 0, 1, 1, 0xd8d0b8, 'GothamBold']]);
    for (const [x, z] of [[-320, -690], [-290, -702], [-266, -690], [-306, -713]]) light(x, 5, z, 0xffe0b0);
    // the covered walkway: tiled posts, a roof, benches - the platform no
    // train stops at any more
    const WX = -340.5;
    for (let z = -714; z <= -678; z += 6) for (const x of [WX - 3.6, WX + 3.6]) box([0.7, 4.4, 0.7], [x, G, z], TILE, 'Concrete', { collide: 0 });
    add([8.4, 0.4, 40], [WX, G + 4.6, -696], 0x222224, 'Metal', { collide: 0 });
    for (let z = -712; z <= -680; z += 8) neon([0.3, 0.12, 2.4], [WX, G + 4.35, z], 0xe8f0ff);
    add([0.4, 0.06, 38], [WX - 3.2, G + 0.18, -696], YELLOW, 'SmoothPlastic', { collide: 0 });
    for (const z of [-708, -692]) box([0.8, 0.5, 2.6], [WX + 3.2, G + 0.6, z], 0x4a3a2a, 'WoodPlanks', { collide: 0 });
    box([0.2, 1.2, 38], [WX - 3.9, G, -696], 0x2a2a2c, 'Metal');
    sign([0.2, 1.0, 5], [WX + 3.75, G + 3.4, -700], 0x1a1a1c, 'Left', [['PLATFORM  ·  ALL TRAINS', 0, 0, 1, 1, WHITE, 'GothamBold']]);
    light(WX, 3.6, -704, 0xe0ecff);
    light(WX, 3.6, -686, 0xe0ecff);
    // inside the hall: chrome stanchions between the lanes
    const stanchions = (z, xa, xb) => {
      for (let x = xa; x <= xb + 0.01; x += 2.5) box([0.15, 1.1, 0.15], [x, G, z], 0xc0c4c8, 'Metal', { collide: 0, shape: 5 });
      add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1, z], RED, 'Fabric', { collide: 0 });
    };
    stanchions(-670.5, -342.5, -328);
    stanchions(-665.5, -337.5, -323);
    stanchions(-660.5, -342.5, -328);
    stanchions(-655.4, -337.5, -323);
    // the boarding gates along the platform edge
    for (let z = -667; z <= -652; z += 3) if (Math.abs(z + 658) > 2) box([0.15, 1.1, 0.15], [-343.2, G + 0.4, z], 0xc0c4c8, 'Metal', { collide: 0, shape: 5 });
  }
  // the path through the line, from the platform back to the street
  const fwd = [
    [KIOSK[0], KIOSK[1] + 8], [KIOSK[0], KIOSK[1] - 4], [KIOSK[0], LANES[0]],
    [-262, LANES[0]], [-262, LANES[1]], [-334, LANES[1]], [-334, LANES[2]], [-262, LANES[2]], [-262, LANES[3]], [-334, LANES[3]], [-334, LANES[4]], [-262, LANES[4]], [-262, LANES[5]], [-340.5, LANES[5]],
    [-340.5, -673], [-325, -673], [-325, -668], [-340, -668], [-340, -663], [-325, -663], [-325, -658], [-342, -658],
  ];
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [0, 1], G);

  // ======== the cars: subway cars, silver, a black stripe and a red line,
  // open window bays, yellow grab poles
  const carParts = (k) => {
    const out = [
      pp(0, [3.5, 0.3, 7], [0, -1.35, 0], 0x2a2c30, 'Metal'),
      pp(0, [3.3, 0.1, 6.9], [0, -1.15, 0], 0x3a3a3c, 'DiamondPlate'),
      pp(0, [3.5, 0.25, 7], [0, 3.1, 0], SILVER, 'Metal'),
      pp(0, [2, 0.3, 3], [0, 3.35, 0], 0x6a6c70, 'Metal'),
    ];
    for (const sx of [-1, 1]) {
      out.push(pp(0, [0.2, 2.2, 7], [sx * 1.65, -0.1, 0], SILVER, 'Metal'));
      out.push(pp(0, [0.24, 0.4, 7.02], [sx * 1.66, 0.75, 0], 0x141416, 'SmoothPlastic'));
      out.push(pp(0, [0.25, 0.08, 7.02], [sx * 1.66, 0.45, 0], RED, 'SmoothPlastic'));
      for (const z of [-3.4, -1.15, 1.15, 3.4]) out.push(pp(0, [0.2, 2.0, 0.25], [sx * 1.65, 2.0, z], SILVER, 'Metal'));
      // the bogies on the rails, outside the body
      for (const z of [-2.6, 2.6]) {
        out.push(pp(2, [0.25, 0.8, 0.8], [sx * 2, -0.72, z - 0.6], INK, 'Metal'));
        out.push(pp(2, [0.25, 0.8, 0.8], [sx * 2, -0.72, z + 0.6], INK, 'Metal'));
        out.push(pp(0, [0.2, 0.3, 2.0], [sx * 2, -0.72, z], 0x2a2c30, 'Metal'));
        out.push(pp(0, [0.5, 0.2, 0.4], [sx * 1.85, -1.1, z], 0x2a2c30, 'Metal'));
      }
    }
    for (const z of [-1.6, 1.6]) out.push(pp(5, [0.09, 4.1, 0.09], [0, 1.0, z], YELLOW, 'Metal'));
    for (const z of [-2.4, -0.8, 0.8, 2.4]) for (const x of [-0.75, 0.75]) {
      out.push(pp(0, [1.25, 0.25, 0.9], [x, -0.075, z], 0x5a1a1a, 'Fabric'));
      out.push(pp(0, [1.25, 1.2, 0.2], [x, 0.6, z + 0.5], 0x5a1a1a, 'Fabric'));
      out.push(pp(0, [0.3, 1.0, 0.8], [x, -0.65, z], 0x2a2a2c, 'Metal'));
    }
    if (k === 0) {
      out.push(pp(0, [3.5, 2.2, 0.2], [0, -0.1, -3.5], SILVER, 'Metal'));
      out.push(pp(0, [3.5, 0.7, 0.2], [0, 2.65, -3.5], 0x141416, 'Metal'));
      out.push(pp(0, [2.2, 0.3, 0.05], [0, 2.65, -3.62], 0xff9a20, 'Neon'));
      for (const sx of [-1, 1]) {
        out.push(pp(0, [0.3, 2.0, 0.2], [sx * 1.6, 2.0, -3.5], SILVER, 'Metal'));
        out.push(pp(0, [0.45, 0.3, 0.1], [sx * 1.1, -0.4, -3.62], 0xfff4d0, 'Neon'));
      }
      out.push(pp(0, [3.52, 0.4, 0.22], [0, 0.75, -3.5], 0x141416, 'SmoothPlastic'));
      out.push(pp(0, [0.5, 0.5, 0.6], [0, -1.0, -3.8], INK, 'Metal'));
    }
    if (k === CARS - 1) {
      out.push(pp(0, [3.5, 2.2, 0.2], [0, -0.1, 3.5], SILVER, 'Metal'));
      out.push(pp(0, [3.52, 0.4, 0.22], [0, 0.75, 3.5], 0x141416, 'SmoothPlastic'));
      for (const sx of [-1, 1]) out.push(pp(0, [0.4, 0.3, 0.1], [sx * 1.2, -0.4, 3.62], 0xff2020, 'Neon'));
    } else out.push(pp(0, [2.2, 2.6, 0.5], [0, 1.0, 3.75], 0x1a1a1a, 'Rubber'));
    return out;
  };
  const seatList = () => [-2.4, -0.8, 0.8, 2.4].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.35, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [], stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
    P.setFromMatrixPosition(m4);
    stops.push(cf(PL.x0 + 0.9, G, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const con = [-345.2, -666.6];
  box([1.2, 1.2, 1.2], [con[0], G + 0.4, con[1]], 0x2a2a2c, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) neon([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] + 0.4 - k * 0.4], [0x40d060, 0xf0c040, 0xe03030][k], { shape: 3 });
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3]],
    console: cf(con[0], G, con[1] + 1, Math.PI / 2), operator: cf(con[0] + 0.4, G, con[1] + 2, Math.PI / 2),
    homes: [cf(-345, G, -660, Math.PI / 2), cf(-345, G, -646, Math.PI / 2)],
    exit: cf(-346, G, -637, Math.PI),
  };
  // the way out: off the platform's north end and out through the station
  // house to the street
  walk([[-346, -637], [-334, -640], [-318, EXIT_DOOR]], 2.4, 0x7a7a74, 'Slate');

  // ======== the ride
  const origin = [-442, 0, -668];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 8, queue: qpath, trackStyle: { style: 'rails' }, extras, extrasNames, crew, props,
    noExtended: true,
  };
  data.rides.push(ride);
  const at = (s) => timeAt(s) / ride.duration;
  // sparks when the train bursts out of the ruined tunnel mouth
  const cues = [[at(sPortW + 2), 'sparks', [0, 0, -2]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'BLACKLINE: The Last Train', land: 'Backwoods', category: 'Thrill', thrill: 3, kind: 'coaster', carStyle: 'coaster',
    description: "A haunted subway dark ride south of Ravage. \"Your stop disappeared years ago.\" Board the Blackline's last train: out past the maintenance yard into a tunnel in a huge black tent, past Graymoor, an abandoned platform with silhouettes behind its frosted windows, and into the junction - where the train stops, the lights die and there are no more scheduled stops. Then the escape through a collapsing tunnel, out through a ruined tunnel mouth into the rail yard, past a wrecked subway car and home.",
    baseWait: 75, origin, entrance: [KIOSK[0], 0, KIOSK[1] + 9], exit: [SH.x1 + 4, 0, EXIT_DOOR], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [0x141416, RED, SILVER], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'The Blackline is running again... one last train. Mind the gap.'];
  const sGr = (sGr0 + sGr1) / 2;
  return {
    ride, gate: { x: gx, z: -608 },
    indoor: { x0: TENT.x0, x1: TENT.x1, z0: TENT.z0, z1: TENT.z1 },
    // ride times of the story beats
    beats: { tunnel: timeAt(sPortE), graymoor: timeAt(sGr), stop: tStop, out: tB0, red: tR0, go: tGo, back: tB1, burst: timeAt(sPortW), home: ride.duration - 26, end: ride.duration },
  };
}

// The rider's story (the announcements), the blackout, the lights in the
// junction, the crackling speakers in the line, and a toast the first time
// you come near.
export class BlacklineSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
    this.said = new Set();
    this.cycle = -1;
    this.queueT = 12;
    this.queueLine = 0;
    this.dark = 0;
  }

  // how dark the tent is at ride time t (0..1)
  blackout(t) {
    const b = this.layout.beats;
    if (t < b.out || t > b.back + 1) return 0;
    return Math.min(1, (t - b.out) / 0.4, (b.back + 1 - t) / 1);
  }

  // the junction's work lights and red lights, by ride time
  lampGroups(t) {
    const b = this.layout.beats;
    const out = t >= b.out && t < b.back;
    return { BLwork: !out, BLred: t >= b.red && t < b.back };
  }

  update(dt, pos, started, ride) {
    if (!started) return;
    const { gate, beats: b, indoor } = this.layout;
    if (!this.told && Math.hypot(pos.x - gate.x, pos.z - gate.z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: BLACKLINE: The Last Train - a haunted subway dark ride! Through the gate in Ravage\'s south wall. Your stop disappeared years ago...', 'reward');
    }
    const inTent = pos.x > indoor.x0 && pos.x < indoor.x1 && pos.z > indoor.z0 && pos.z < indoor.z1;
    const want = (ride.riding || inTent) ? this.blackout(ride.t) : 0;
    this.dark += (want - this.dark) * Math.min(1, dt * 8);
    // the rider's announcements
    if (ride.riding && ride.t > 0) {
      if (ride.cycle !== this.cycle) { this.cycle = ride.cycle; this.said.clear(); }
      const say = (key, at, text, toast, kind = 'info') => {
        if (ride.t < at || ride.t > at + 6 || this.said.has(key)) return;
        this.said.add(key);
        this.hooks.crackle?.();
        this.hooks.voice?.(text);
        if (toast) this.hooks.toast(toast, kind);
      };
      say('depart', 3, 'This is the Blackline. Last train. Stand clear of the closing doors.', '🚇 "This is the Blackline. Last train. Stand clear of the closing doors."');
      say('next', b.tunnel + 3, 'Next stop... Graymoor.');
      say('graymoor', b.graymoor - 4, 'Graymoor. This station is closed. Please... remain... on the train.', '🚇 "Graymoor. This station is closed. Please remain on the train."');
      say('stops', b.stop + 1.6, 'There are no more scheduled stops.', '🚇 "There are no more scheduled stops."', 'warn');
      if (ride.t >= b.go - 0.6 && !this.said.has('rumble')) { this.said.add('rumble'); this.hooks.rumble?.(); this.hooks.toast('💨 The tunnel is coming down - hold on!', 'warn'); }
      say('home', b.home, 'Thank you for riding the Blackline. Your stop disappeared years ago.', '🚇 "Thank you for riding the Blackline. Your stop disappeared years ago."');
    }
    // the speakers in the line
    if (ride.queue) {
      this.queueT -= dt;
      if (this.queueT <= 0) {
        this.queueT = 38 + Math.random() * 20;
        const lines = [
          'Attention passengers. Blackline service is... delayed. Please stand behind the yellow line.',
          'The last train is now approaching. Do not... enter... the tunnels.',
          'Passengers for Graymoor. Graymoor station is closed. Graymoor station... is closed.',
          'Will the conductor of the last train... please report to... the junction.',
        ];
        this.hooks.crackle?.();
        this.hooks.voice?.(lines[this.queueLine++ % lines.length]);
      }
    } else this.queueT = 12;
  }
}
