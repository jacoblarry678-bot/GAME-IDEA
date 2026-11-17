// Benton Blitz: a multi-launch coaster that goes backward three times, in
// the old quarry canyon west of Ravage (through a gate in Ravage's west
// wall). Benton Storm Chasers HQ has built a coaster that rides the
// lightning: it launches you at the first top hat, doesn't make it, and
// throws you backward through the station and up the rear ramp; launches
// harder, still doesn't make it, backward again; then the third launch
// takes you over the top. Out on the course a second top hat throws you
// back a third time before the last launch.
//
// The line: an open-air field of switchbacks between storm-chaser trucks,
// a Doppler radar and a lightning tower, then indoors through the Storm
// Center to the pre-show, the storm briefing. The briefing room takes
// guests in groups: the doors open between shows and a crew member counts
// each group in on a clicker (the count is on a crew-only display by the
// door), and when the show ends the group goes through to the station
// together.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'BentonBlitz';
const SITE = { x0: -798, x1: -596, z0: -640, z1: -402 };
const HQ = { x0: -690, x1: -640, z0: -500, z1: -452, H: 13 };
const GATE = { z0: -424, z1: -412 }; // in Ravage's west wall (x -594)
const G = 0.1;
const CARS = 4, SPACING = 3.6;
const ZL = -440; // the station, the launch track and the rear ramp run along here
const BLUE = 0x1e5aff, YELLOW = 0xffd21e, DARK = 0x14161c, WHITE = 0xf2f2ee, STEEL = 0x8e949c, NAVY = 0x1a2440, RED = 0xe0302a;
const TRACK_COLOR = 0x1e5aff;

const CIRCUIT = [
  [-684, 2, ZL, 3],
  // the launch track, west
  [-690, 2, ZL, 6], [-720, 2, ZL, 20], [-748, 2, ZL, 30],
  // the first top hat: up, over (turning south) and down
  [-756, 3, ZL, 29], [-763, 9, ZL, 26], [-767, 20, ZL, 21], [-769, 32, ZL, 16], [-772, 41, -442.5, 13], [-777, 45.5, -445, 12],
  [-780, 45, -449, 12], [-781.5, 38, -452, 15], [-782, 26, -455, 21], [-782, 13, -460, 26], [-782, 5, -468, 29], [-782, 2.4, -482, 31],
  // the heartline roll, south
  [-782, 10, -505, 28], [-782, 13, -520, 27], [-782, 13, -535, 27], [-782, 10, -550, 28],
  // round to the east and over the camelback
  [-780, 6, -566, 29], [-772, 4, -590, 30], [-756, 5, -608, 30], [-740, 14, -618, 26], [-728, 16, -620, 25], [-716, 10, -621, 27],
  // the second launch track, east
  [-704, 2.5, -622, 25], [-690, 2.5, -622, 20], [-670, 2.5, -622, 25],
  // the second top hat
  [-662, 4, -622, 26], [-656, 12, -622, 23], [-653, 24, -622, 19], [-650, 33, -622, 16], [-645, 37, -622, 15], [-640, 37, -622, 15],
  [-635, 33, -622, 17], [-632, 24, -622, 21], [-629, 13, -622, 25], [-625, 6, -620, 28],
  // a climbing turn north, up the east side, round to the top of the rear ramp
  [-616, 9, -612, 27], [-609, 13, -598, 26], [-608, 17, -570, 24], [-608, 20, -530, 20], [-608, 22, -490, 12], [-609, 22, -466, 6],
  [-612, 22, -452, 5], [-618, 22, -443, 5], [-626, 21.5, -440, 5],
  // down the rear ramp into the station
  [-634, 17, ZL, 5], [-644, 9, ZL, 5], [-652, 3, ZL, 5], [-660, 2, ZL, 4], [-672, 2, ZL, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

// The ride itself: the train's distance along the track over time, from a
// small physics model (gravity, friction) with launch motors that push it
// forward or backward, trim brakes and the station brakes. Zones act on the
// front car's distance; each zone runs its next command each time the train
// comes into it.
function simulate(track, sampler, zones, stopFrom) {
  const L = track.length, dt = 1 / 50;
  const out = [0], events = [];
  const m = new THREE.Matrix4(), T = new THREE.Vector3();
  const tanY = (s) => { sampler.matrixAt(((s % L) + L) % L, m); T.setFromMatrixColumn(m, 2); return -T.y; };
  let s = 0, v = 0, t = 0;
  for (const z of zones) { z.i = 0; z.inside = false; z.cur = null; }
  while (t < 600) {
    const mid = s - ((CARS - 1) * SPACING) / 2;
    let a = -9.8 * tanY(mid) - 0.1 * Math.sign(v) - 0.0005 * v * Math.abs(v);
    for (const z of zones) {
      const inside = s >= z.s0 && s <= z.s1;
      if (inside && !z.inside) {
        z.cur = z.cmds[z.i++] ?? null;
        if (z.cur?.event) events.push([t, z.cur.event, s]);
      }
      if (!inside) z.cur = null;
      z.inside = inside;
      const c = z.cur;
      if (!c) continue;
      if (c.limit) { if (v > c.v) a = -c.a; }
      else if (Math.abs(c.v - v) > 0.05) a = Math.sign(c.v - v) * c.a;
      else { a = 0; v = c.v; }
    }
    v += a * dt;
    // the station brakes: stop exactly at the platform
    if (s > stopFrom) v = Math.min(v, Math.sqrt(2 * 2.5 * Math.max(0, L - s)) + 0.15);
    s += v * dt;
    t += dt;
    if (s >= L - 0.02) { out.push(L); break; }
    out.push(s);
  }
  return { profile: { dt, s: out }, events, duration: t };
}

export function buildBentonBlitz(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Searchlight = data.tags.Searchlight || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const ALONG_Z = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: the quarry canyon, walled along its open sides
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 34 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 10));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2 - 1, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x8a8478, 'Ground');
  const WALL = 0x8a8478, CAP = 0xb8b0a2;
  const wallSeg = (xa, za, xb, zb, h = 14) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, h, len], [(xa + xb) / 2, h / 2, (za + zb) / 2], WALL, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, h + 0.5, (za + zb) / 2], CAP, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-596, -402, SITE.x0, -402);
  wallSeg(SITE.x0, -402, SITE.x0, SITE.z0);
  wallSeg(SITE.x0, SITE.z0, -594, SITE.z0);
  wallSeg(-594, SITE.z0, -594, -608.5);
  // the gate in Ravage's west wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] + 594) < 0.6 && Math.abs(p[6] + 506.5) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  {
    const rw = (xa, za, xb, zb) => {
      const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
      add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x96928c, 'Concrete', { yaw });
      add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xc4beb4, 'Concrete', { yaw, collide: 0 });
    };
    rw(-594, -405, -594, GATE.z1);
    rw(-594, GATE.z0, -594, -608);
  }
  const gz = (GATE.z0 + GATE.z1) / 2;
  for (const z of [GATE.z0 + 0.8, GATE.z1 - 0.8]) {
    box([1.6, 16, 1.6], [-594, G, z], NAVY, 'Metal');
    neon([0.5, 14, 0.3], [-594, G + 8, z + (z < gz ? 0.85 : -0.85)], YELLOW, { rot: RX(z < gz ? 0.12 : -0.12) });
  }
  add([1.4, 2.6, GATE.z1 - GATE.z0 + 1.6], [-594, G + 15, gz], NAVY, 'Metal', { collide: 0 });
  sign([0.2, 2.2, GATE.z1 - GATE.z0 - 1], [-594.8, G + 15, gz], NAVY, 'Left', [['BENTON BLITZ', 0, 0, 1, 1, YELLOW]], { glow: true });
  sign([0.2, 2.2, GATE.z1 - GATE.z0 - 1], [-593.2, G + 15, gz], NAVY, 'Right', [['BENTON BLITZ  ·  THE CANYON', 0, 0, 1, 1, YELLOW]], { glow: true });
  // the walk from Ravage's exit path to the gate, and signs on the way
  for (const [a, b] of [[[-387, -431], [-400, -418]], [[-400, -418], [-594, -418]], [[-594, -418], [-601, -424]], [[-601, -424], [-601, -500]], [[-601, -500], [-616, -500]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.6, 0.2, len + 3.6], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  for (const [x, z, face, text] of [[-282, -462, 'Back', 'BENTON BLITZ  ·  THIS WAY  >'], [-405, -414, 'Back', '<  BENTON BLITZ']]) {
    box([0.3, 4.6, 0.3], [x, G, z], NAVY, 'Metal', { collide: 0 });
    sign([5, 1.3, 0.2], [x, G + 4, z + (face === 'Back' ? 0.2 : -0.2)], NAVY, face, [[text, 0, 0, 1, 1, YELLOW, 'GothamBold']]);
  }

  // ======== the track and the ride
  const track = makeTrack(CIRCUIT, { rolls: [{ from: knot(-782, -505), to: knot(-782, -550), h: 1.3 }] });
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3();
  const L = track.length;
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const LZ1 = [sAt(-690, ZL), sAt(-748, ZL)], LZ2 = [sAt(-704, -622), sAt(-670, -622)];
  const zones = [
    // the station's drive tires roll the train out to the launch track
    { s0: -1, s1: LZ1[0], cmds: [{ v: 3, a: 1.5 }] },
    // launch 1, then (rolling back from the top hat) a push backward up the
    // rear ramp, launch 2, backward again, launch 3 over the top
    { s0: LZ1[0], s1: LZ1[1], cmds: [
      { v: 17, a: 8, event: 'launch' }, { v: -17, a: 6, event: 'back' },
      { v: 24, a: 9, event: 'launch' }, { v: -19, a: 6, event: 'back' },
      { v: 31.5, a: 10, event: 'launch' },
    ] },
    // out on the course: the motors slow you for the second top hat, push
    // you back up the camelback when you roll back, then launch you over
    { s0: LZ2[0], s1: LZ2[1], cmds: [{ v: 16, a: 12 }, { v: -14, a: 8, event: 'back' }, { v: 31, a: 10, event: 'launch' }] },
    // the trim brakes up top, and down the rear ramp
    { s0: sAt(-608, -505), s1: L - 30, cmds: [{ v: 5, a: 7, limit: true }] },
  ];
  const sim = simulate(track, sampler, zones, L - 26);
  // how many times it went backward
  let backs = 0;
  for (let i = 1, wasBack = false; i < sim.profile.s.length; i++) {
    const back = sim.profile.s[i] < sim.profile.s[i - 1] - 1e-4;
    if (back && !wasBack) backs++;
    wasBack = back;
  }
  const dur = sim.duration;

  // samples for clearances
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
  const clearOf = (size, pos, pad = 3.6) => {
    const ex = size[0] / 2, ey = size[1] / 2, ez = size[2] / 2;
    for (const [x, y, z] of near(pos[0], pos[2])) {
      const dx = Math.max(0, Math.abs(x - pos[0]) - ex), dz = Math.max(0, Math.abs(z - pos[2]) - ez);
      if (Math.hypot(dx, dz) < pad && pos[1] + ey > y - 3 && pos[1] - ey < y + 4.8) return false;
    }
    return true;
  };
  const S = (size, pos, color, mat, o = {}) => (clearOf(size, pos) ? add(size, pos, color, mat, o) : -1);
  const SB = (size, base, color, mat, o = {}) => S(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, o);

  // ======== Storm Chasers HQ: the indoor line and the briefing room
  const T = 1.2, cx = (HQ.x0 + HQ.x1) / 2, cz = (HQ.z0 + HQ.z1) / 2;
  const wallX = (x, za, zb, h = HQ.H, color = NAVY, base = G) => { if (zb - za > 0.1) box([T, h, zb - za], [x, base, (za + zb) / 2], color, 'Concrete'); };
  const wallZ = (z, xa, xb, h = HQ.H, color = NAVY, base = G) => { if (xb - xa > 0.1) box([xb - xa, h, T], [(xa + xb) / 2, base, z], color, 'Concrete'); };
  const SDOOR = -686, PSIN = -646, PSOUT = -684, PART = -476;
  // south wall with the way in, the north wall with the way out to the platform
  wallZ(HQ.z0 + T / 2, HQ.x0, SDOOR - 2);
  wallZ(HQ.z0 + T / 2, SDOOR + 2, HQ.x1);
  wallZ(HQ.z0 + T / 2, SDOOR - 2, SDOOR + 2, HQ.H - 5.4, NAVY, G + 5.4);
  wallZ(HQ.z1 - T / 2, HQ.x0, PSOUT - 2);
  wallZ(HQ.z1 - T / 2, PSOUT + 2, HQ.x1);
  wallZ(HQ.z1 - T / 2, PSOUT - 2, PSOUT + 2, HQ.H - 5.4, NAVY, G + 5.4);
  wallX(HQ.x0 + T / 2, HQ.z0, HQ.z1);
  wallX(HQ.x1 - T / 2, HQ.z0, HQ.z1);
  // the briefing room's wall (its door at the east end)
  wallZ(PART, HQ.x0 + T, PSIN - 2, 6, 0x2a3450, G);
  wallZ(PART, PSIN + 2, HQ.x1 - T, 6, 0x2a3450, G);
  wallZ(PART, PSIN - 2, PSIN + 2, 0.6, 0x2a3450, G + 5.4);
  add([HQ.x1 - HQ.x0 + 1.6, 1.2, HQ.z1 - HQ.z0 + 1.6], [cx, G + HQ.H + 0.6, cz], 0x2a3040, 'Metal', { collide: 0 });
  add([HQ.x1 - HQ.x0, 0.5, 0.3], [cx, G + HQ.H - 1.6, HQ.z0 - 0.15], YELLOW, 'SmoothPlastic', { collide: 0 });
  // the facade: the logo with a lightning bolt, a radar dome on the roof
  sign([30, 4.4, 0.3], [cx, G + 8.2, HQ.z0 - 0.3], NAVY, 'Front', [['BENTON BLITZ', 0, 0, 1, 1, YELLOW]], { glow: true });
  for (let k = 0; k < 3; k++) neon([0.6, 3.2, 0.3], [cx - 19 + k * 1.1, G + 8.6 - k * 1.4, HQ.z0 - 0.5], YELLOW, { rot: RZ(k % 2 ? -0.7 : 0.5) });
  sign([22, 1.6, 0.3], [cx, G + 4.8, HQ.z0 - 0.3], 0x2a3450, 'Front', [['STORM CHASERS HQ  ·  BENTON QUARRY', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  add([7, 7, 7], [HQ.x0 + 9, G + HQ.H + 3.6, HQ.z0 + 9], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 });
  box([2, 2, 2], [HQ.x0 + 9, G + HQ.H + 1.2, HQ.z0 + 9], STEEL, 'Metal', { collide: 0 });
  for (const [x, z] of [[HQ.x1 - 6, HQ.z0 + 6], [HQ.x1 - 14, HQ.z0 + 6]]) {
    box([0.3, 6, 0.3], [x, G + HQ.H + 1.2, z], STEEL, 'Metal', { collide: 0 });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; add([0.1, 0.1, 1.4], [x + Math.cos(a) * 0.7, G + HQ.H + 7.2, z + Math.sin(a) * 0.7], STEEL, 'Metal', { collide: 0, rot: RY(a) }); add([0.5, 0.5, 0.5], [x + Math.cos(a) * 1.4, G + HQ.H + 7.2, z + Math.sin(a) * 1.4], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 }); }
  }
  // inside: the Storm Center (three rows of line past the storm screens)
  const IR = [-495, -489, -483];
  for (let k = 0; k < 2; k++) {
    const z = (IR[k] + IR[k + 1]) / 2;
    if (k === 0) wallZ(z, HQ.x0 + T, HQ.x1 - 7, 1.2, 0x3a4458, G); // turn at the east end
    else wallZ(z, HQ.x0 + 7, HQ.x1 - T, 1.2, 0x3a4458, G); // turn at the west end
  }
  [['SUPERCELL WATCH', RED], ['WIND 74 MPH', YELLOW], ['STRIKES: 1,204 / HR', WHITE], ['BLITZ READY', 0x5adc6e]].forEach(([text, c], k) => {
    sign([8, 3, 0.2], [HQ.x0 + 8 + k * 11, G + 6.4, HQ.z0 + T + 0.2], 0x0a1020, 'Back', [['STORM CENTER', 0, 0.04, 1, 0.3, 0x8ab4ff, 'GothamBold'], [text, 0, 0.4, 1, 0.5, c, 'GothamBold']], { glow: true });
  });
  // a storm map on a big table in the middle
  add([12, 0.2, 3], [cx, G + 7.4, -486], 0x0a1830, 'Neon', { collide: 0 });
  for (let k = 0; k < 5; k++) neon([1.6 - k * 0.2, 0.05, 1.6 - k * 0.2], [cx - 3 + k * 0.6, G + 7.55, -486], [0x40ff60, YELLOW, 0xff8020, RED, 0xff30ff][k], { shape: 5 });
  light(cx, 9, -488, 0x6a9aff);
  // the briefing room: the screen on the west wall, storm lights, the crew's
  // counter by the door
  const PR = { x0: HQ.x0 + T + 0.5, x1: HQ.x1 - T - 0.5, z0: PART + 0.8, z1: HQ.z1 - T - 0.5 };
  sign([0.3, 8, 18], [HQ.x0 + T + 0.2, G + 6, (PR.z0 + PR.z1) / 2], 0x05080f, 'Right', [
    ['STORM BRIEFING', 0, 0.03, 1, 0.16, 0x8ab4ff, 'GothamBold'], ['A SUPERCELL IS OVER THE QUARRY', 0, 0.22, 1, 0.14, WHITE, 'GothamBold'],
    ['THE BLITZ RIDES THE LIGHTNING', 0, 0.42, 1, 0.2, YELLOW],
    ['FORWARD.  BACKWARD.  FORWARD.  BACKWARD.  FORWARD!', 0, 0.68, 1, 0.12, WHITE, 'GothamBold'], ['KEEP YOUR HEAD BACK - YOU WILL GO BACKWARD.', 0, 0.84, 1, 0.12, RED, 'GothamBold'],
  ], { glow: true });
  for (const z of [PR.z0 + 3, PR.z1 - 3]) { neon([0.4, 0.4, 0.4], [HQ.x0 + T + 0.5, G + 11, z], YELLOW, { shape: 3 }); }
  for (let k = 0; k < 4; k++) neon([0.3, 0.3, 4], [-676 + k * 9, G + HQ.H - 0.4, (PR.z0 + PR.z1) / 2], 0xbcd4ff);
  light(-670, 9, -464, 0x8ab4ff);
  light(-650, 9, -462, YELLOW);
  // the counter: a little crew-only display beside the door, and the crew
  // member with the clicker
  const countPart = add([0.2, 1.3, 2.1], [PSIN + 3.4, G + 2.6, PART + 0.75], 0x0a0c10, 'SmoothPlastic', { collide: 0, yaw: Math.PI / 2 });
  data.dynamicSigns.push({ part: countPart, kind: 'count', face: 'Front', ride: RIDE_ID });
  box([0.8, 1.1, 0.5], [PSIN + 3.4, G, PART + 0.9], 0x2a2e36, 'Metal', { collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 191, cf: cf(PSIN + 2.6, G, PART + 2.2, Math.PI / 2) });
  sign([3.4, 0.7, 0.15], [PSIN, G + 4.7, PART - 0.7], YELLOW, 'Front', [['STORM BRIEFING  ·  GROUPS ENTER HERE', 0, 0, 1, 1, DARK, 'GothamBold']]);

  // ======== the station shed and the platform
  const PL = { x0: -690, x1: -656, z0: -451.6, z1: -442.6 };
  add([PL.x1 - PL.x0, 0.4, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G + 0.2, (PL.z0 + PL.z1) / 2], 0x3a3e46, 'DiamondPlate', { collide: 0 });
  add([PL.x1 - PL.x0, 0.1, 0.5], [(PL.x0 + PL.x1) / 2, G + 0.42, PL.z1 - 0.3], YELLOW, 'SmoothPlastic', { collide: 0 });
  for (let x = PL.x0 - 2; x <= PL.x1 + 2; x += 9) box([0.6, 9, 0.6], [x, G, ZL + 8], NAVY, 'Metal', { collide: 0 });
  add([PL.x1 - PL.x0 + 6, 0.6, 22], [(PL.x0 + PL.x1) / 2, G + 9.3, ZL - 3], 0x2a3040, 'Metal', { collide: 0 });
  sign([20, 1.8, 0.3], [(PL.x0 + PL.x1) / 2, G + 8, ZL + 8.4], NAVY, 'Back', [['BENTON BLITZ  ·  STATION', 0, 0, 1, 1, YELLOW]], { glow: true });
  for (let x = PL.x0; x <= PL.x1; x += 6) neon([0.4, 0.1, 3], [x, G + 8.9, ZL], 0xbcd4ff);
  const con = [-660, -448.5];
  box([1.4, 1.2, 2.2], [con[0], G + 0.4, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], G + 1.7, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  // the launch track: lightning-blue stripes along the motors
  for (let x = -692; x > -748; x -= 4) add([1.2, 0.1, 2.2], [x, G + 0.06, ZL], x % 8 ? BLUE : YELLOW, 'Neon', { collide: 0 });

  // ======== the outdoor line: a field of switchbacks under storm gear
  const FX = { w: -684, e: -628 }, ROWS = 9, rz = (k) => -512 - 6 * k;
  const RAIL = 0x3a3e46;
  const railX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [xa + ((xb - xa) * k) / n, G, z], RAIL, 'Metal');
    add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1.1, z], YELLOW, 'Metal', { collide: 0 });
  };
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [x, G, za + ((zb - za) * k) / n], RAIL, 'Metal');
    add([0.12, 0.12, zb - za], [x, G + 1.1, (za + zb) / 2], YELLOW, 'Metal', { collide: 0 });
  };
  railX(FX.w - 3, FX.e + 3, rz(0) + 3);
  for (let k = 0; k < ROWS - 1; k++) {
    if (k % 2 === 0) railX(FX.w + 3, FX.e + 3, rz(k) - 3); // heading west: turn at the west end
    else railX(FX.w - 3, FX.e - 3, rz(k) - 3);
  }
  railX(FX.w - 3, FX.e + 3, rz(ROWS - 1) - 3);
  railZ(rz(ROWS - 1) - 3, rz(0) + 3, FX.e + 3);
  railZ(rz(ROWS - 1) - 3, rz(0) + 3, FX.w - 2.5);
  // shades: lightning-yellow sails on masts
  for (const [x, z] of [[-670, -527], [-642, -527], [-670, -551], [-642, -551]]) {
    box([0.35, 5.4, 0.35], [x, G, z], STEEL, 'Metal', { collide: 0 });
    add([16, 0.15, 10], [x, G + 5.4, z], k2(x, z) ? YELLOW : 0xe8eef8, 'Fabric', { collide: 0, rot: RZ(0.08) });
  }
  function k2(x, z) { return ((x + z) / 4) % 2 === 0; }
  // the plaza: the entrance, the wait time, lamps
  add([24, 0.2, 34], [-626, G + 0.1, -488], 0x8a8a84, 'Concrete', { collide: 0 });
  for (const z of [-497, -505]) {
    box([1.4, 7, 1.4], [-622, G, z], NAVY, 'Metal');
    neon([0.4, 6.4, 0.3], [-621.2, G + 3.6, z], YELLOW, { rot: RX(0.15) });
  }
  add([1.6, 1.8, 9.4], [-622, G + 7.6, -501], NAVY, 'Metal', { collide: 0 });
  sign([0.2, 1.5, 8.6], [-621.1, G + 7.6, -501], NAVY, 'Right', [['BENTON BLITZ', 0, 0, 1, 1, YELLOW]], { glow: true });
  const waitPart = add([0.4, 1.6, 6], [-621, G + 4.6, -490], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  box([0.4, 4.4, 0.4], [-621, G, -487.2], NAVY, 'Metal', { collide: 0 });
  for (const [x, z] of [[-616, -476], [-636, -476], [-616, -504]]) {
    box([0.4, 8, 0.4], [x, G, z], NAVY, 'Metal');
    add([1.2, 1.4, 1.2], [x, G + 8.4, z], 0xfff2d0, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 8.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 193, cf: cf(-618, G, -494, -Math.PI / 2) });
  // the storm-chaser trucks, the radar, the lightning tower
  const truck = (x, z, yaw, color) => {
    const parts = [
      pp(0, [3.2, 2.2, 7.6], [0, 1.6, 0], color, 'SmoothPlastic'), pp(0, [3.2, 1.6, 2.6], [0, 1.3, -4.8], color, 'SmoothPlastic'),
      pp(0, [3.0, 0.9, 0.1], [0, 2.4, -6.05], 0x2a3a4a, 'Glass'), pp(0, [3.4, 0.5, 6], [0, 2.95, 0.6], DARK, 'Metal'),
      ...[[-1.5, -4.4], [1.5, -4.4], [-1.5, 2.4], [1.5, 2.4]].map(([dx, dz]) => pp(2, [0.5, 1.4, 1.4], [dx, 0.7, dz], 0x1a1a1a, 'Rubber')),
      pp(5, [1.8, 0.2, 1.8], [0, 4, 1.4], WHITE, 'SmoothPlastic'), pp(0, [0.2, 1, 0.2], [0, 3.5, 1.4], STEEL, 'Metal'),
      pp(0, [2.8, 0.25, 0.4], [0, 3.4, -2.6], YELLOW, 'Neon'),
    ];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const q of parts) {
      const lx = q[4], lz = q[6];
      const R = q.slice(7, 16);
      const r = [c * R[0] + s * R[6], c * R[1] + s * R[7], c * R[2] + s * R[8], R[3], R[4], R[5], -s * R[0] + c * R[6], -s * R[1] + c * R[7], -s * R[2] + c * R[8]];
      data.static.push([q[0], q[1], q[2], q[3], x + c * lx + s * lz, G + q[5], z - s * lx + c * lz, ...r, q[16], q[17], 0, 0]);
    }
  };
  truck(-650, -580, 0.4, 0xe8e8e2);
  truck(-674, -584, -0.3, 0xd84028);
  truck(-720, -500, 1.2, 0xe8e8e2);
  box([2.4, 10, 2.4], [-700, G, -575], STEEL, 'Metal', { collide: 0 });
  add([9, 9, 9], [-700, G + 14, -575], WHITE, 'SmoothPlastic', { shape: 3, collide: 0 });
  sign([5, 1.2, 0.2], [-700, G + 8, -573.7], NAVY, 'Back', [['DOPPLER RADAR', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  // the lightning tower: a tall lattice mast, coils and a crackling top
  const LT = [-735, -530];
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) box([0.4, 30, 0.4], [LT[0] + dx, G, LT[1] + dz], STEEL, 'Metal', { collide: 0 });
  for (let y = 3; y < 30; y += 3) add([3.4, 0.25, 3.4], [LT[0], G + y, LT[1]], STEEL, 'Metal', { collide: 0 });
  for (const y of [8, 16, 24]) add([5, 1.4, 5], [LT[0], G + y, LT[1]], 0xb87333, 'Metal', { shape: 5, collide: 0 });
  add([3, 3, 3], [LT[0], G + 31.5, LT[1]], 0xc8d0dc, 'Metal', { shape: 3, collide: 0 });
  neon([1.6, 1.6, 1.6], [LT[0], G + 31.5, LT[1]], 0xbcd4ff, { shape: 3 });
  for (let k = 0; k < 4; k++) neon([0.25, 6, 0.25], [LT[0] + (k - 1.5) * 2.4, G + 36, LT[1] + (k % 2) * 2 - 1], 0xe0ecff, { rot: RZ((k - 1.5) * 0.4) });
  data.tags.Searchlight.push([LT[0], G + 32, LT[1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // quarry rocks and warning signs around the canyon floor
  for (const [x, z, r] of [[-760, -470, 5], [-720, -560, 4], [-700, -460, 3.5], [-760, -630, 5], [-790, -600, 4], [-730, -410, 4], [-640, -630, 3]]) {
    if (!clearOf([r * 2, r, r * 2], [x, G + r / 2, z], 5)) continue;
    add([r * 2, r * 1.2, r * 1.7], [x, G + r * 0.3, z], 0x8a7a64, 'Slate', { shape: 3 });
  }
  [['LIGHTNING RISK', [-704, -506]], ['BLITZ TEST TRACK  ·  STAND CLEAR', [-740, -452]]].forEach(([text, [x, z]]) => {
    box([0.2, 3, 0.2], [x - 2.5, G, z], RAIL, 'Metal', { collide: 0 });
    box([0.2, 3, 0.2], [x + 2.5, G, z], RAIL, 'Metal', { collide: 0 });
    sign([5.4, 1.3, 0.15], [x, G + 2.4, z], YELLOW, 'Back', [[text, 0, 0, 1, 1, DARK, 'GothamBold']]);
  });

  // ======== the line's path (from the plaza to the station)
  const fwd = [[-616, -500], [-624, -500], [-624, rz(0)]];
  for (let k = 0; k < ROWS; k++) {
    const west = k % 2 === 0;
    fwd.push([west ? FX.w : FX.e, rz(k)]);
    if (k < ROWS - 1) fwd.push([west ? FX.w : FX.e, rz(k + 1)]);
  }
  fwd.push([-688, rz(ROWS - 1)], [-688, HQ.z0 - 3], [SDOOR, HQ.z0 - 3], [SDOOR, IR[0]], [HQ.x1 - 5, IR[0]], [HQ.x1 - 5, IR[1]], [HQ.x0 + 5, IR[1]], [HQ.x0 + 5, IR[2]], [PSIN, IR[2]],
    [PSIN, PART], [PSIN, -470], [PSOUT, -458], [PSOUT, HQ.z1], [PSOUT, -447.6], [-678, -446.6]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the pre-show room on the way: where its doors are along the line
  {
    const cum = qpath.cum, pts = pathPts;
    const sOf = (x, z) => { for (let i = 0; i < pts.length; i++) if (pts[i][0] === x && pts[i][1] === z) return cum[i]; return 0; };
    qpath.preshow = { sIn: sOf(PSIN, PART), sOut: sOf(PSOUT, HQ.z1), rect: PR, yaw: Math.PI / 2, cap: 8, period: 50, swap: 14 };
  }
  // the exit: off the platform's east end, round to the plaza
  for (const [a, b] of [[[-654, -447], [-640, -447]], [[-640, -447], [-636, -470]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3, 0.2, len + 3], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([3.4, 1, 0.2], [-640, G + 4, -449.4], 0x1a8a3a, 'Front', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  box([0.25, 3.5, 0.25], [-641.8, G, -449.4], RAIL, 'Metal', { collide: 0 });

  // ======== supports: steel columns, lattice towers under the top hats
  let supports = 0;
  const keepClear = [{ x0: -612, x1: -596, z0: -504, z1: -496 }, PL, { x0: -630, x1: -596, z0: -470, z1: -404 }];
  for (let s = 4; s < L - 4; s += 6) {
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (keepClear.some((r) => inRect(foot.x, foot.z, r, 1.5))) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([1, foot.y - G, 1], [foot.x, (foot.y + G) / 2, foot.z], 0x3a4458, 'Metal', { shape: 5, collide: 0 });
    add([2, 0.6, 2], [foot.x, G + 0.3, foot.z], 0x9a9a94, 'Concrete', { collide: 0 });
    supports++;
  }
  const tower = (x0, x1, z0, z1, top) => {
    for (const x of [x0, x1]) for (const z of [z0, z1]) box([0.9, top - G, 0.9], [x, G, z], 0x3a4458, 'Metal', { collide: 0 });
    for (let y = 6; y < top; y += 8) {
      add([x1 - x0, 0.4, 0.4], [(x0 + x1) / 2, y, z0], 0x3a4458, 'Metal', { collide: 0 });
      add([x1 - x0, 0.4, 0.4], [(x0 + x1) / 2, y, z1], 0x3a4458, 'Metal', { collide: 0 });
      add([0.4, 0.4, z1 - z0], [x0, y, (z0 + z1) / 2], 0x3a4458, 'Metal', { collide: 0 });
      add([0.4, 0.4, z1 - z0], [x1, y, (z0 + z1) / 2], 0x3a4458, 'Metal', { collide: 0 });
    }
    supports++;
  };
  // (under the crests, clear of the trains going up and down either side)
  tower(-782, -775, -449, -443, 43.4);
  tower(-645, -640, -627, -625.4, 35.4);
  // lightning bolts on the top hats
  for (const [x, y, z, face] of [[-774, 30, -433.5, 'Back'], [-642, 22, -626.5, 'Front']]) sign([6, 6, 0.2], [x, y, z], NAVY, face, [['⚡', 0, 0, 1, 1, YELLOW]], { glow: true });

  // ======== the trains: black with lightning-yellow, electric-blue underglow
  const carParts = (k) => [
    pp(0, [3.4, 0.9, 3.4], [0, 0.65, 0], DARK, 'SmoothPlastic'),
    pp(0, [3.5, 0.2, 3.5], [0, 1.1, 0], YELLOW, 'SmoothPlastic'),
    pp(0, [3.6, 0.15, 3.3], [0, 0.18, 0], BLUE, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x1a1a24, 'Fabric'),
      pp(0, [1.1, 1.2, 0.25], [x, 1.85, z + 0.5], DARK, 'SmoothPlastic'),
    ])),
    pp(0, [0.15, 0.6, 2.6], [-1.76, 0.75, 0], YELLOW, 'Neon', RX(0.5)),
    pp(0, [0.15, 0.6, 2.6], [1.76, 0.75, 0], YELLOW, 'Neon', RX(0.5)),
    ...(k === 0 ? [pp(1, [3.2, 1.2, 1.6], [0, 0.9, -2.4], DARK, 'SmoothPlastic', [-1, 0, 0, 0, 1, 0, 0, 0, -1]), pp(0, [3.3, 0.2, 0.2], [0, 0.4, -3.1], YELLOW, 'Neon')] : []),
    ...(k === CARS - 1 ? [pp(0, [3.2, 0.8, 0.6], [0, 0.8, 2.1], DARK, 'SmoothPlastic'), pp(3, [0.4, 0.3, 0.2], [-1.2, 0.9, 2.42], RED, 'Neon'), pp(3, [0.4, 0.3, 0.2], [1.2, 0.9, 2.42], RED, 'Neon')] : []),
  ];
  const seatList = () => [-0.85, 0.75].flatMap((z) => [-0.75, 0.75].map((x) => [x, 1.45 + 1.3, z - 0.05, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    cars.push({ pivot: [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: carParts(k) });
    seats.push(seatList());
  }

  // ======== the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    P.setFromMatrixPosition(m4);
    stops.push(cf(P.x, G, -443.6, Math.PI));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3, 4]],
    console: cf(con[0] + 1, G, con[1], -Math.PI / 2), operator: cf(con[0] + 2, G, con[1], -Math.PI / 2),
    homes: [cf(-686, G, -449, Math.PI), cf(-664, G, -449, Math.PI)],
    exit: cf(-652, G, -447, -Math.PI / 2),
  };

  // ======== the ride
  const origin = [-700, 0, -530];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: dur, profile: sim.profile,
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR }, extras: {}, extrasNames: [], crew,
    noExtended: true, party: 4,
  };
  data.rides.push(ride);
  // lightning at every launch, and as you're thrown backward
  const cues = sim.events.map(([t, kind]) => [t / dur, kind === 'launch' ? 'sparks' : 'sparks', kind === 'launch' ? [0, 1, 4] : [0, 3, -2]]);
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Benton Blitz', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "A multi-launch coaster that goes backward three times, in the quarry canyon past Ravage. Storm Chasers HQ built a coaster that rides the lightning: the first launch doesn't make it over the top hat and throws you backward through the station and up the rear ramp; the second launch doesn't either; the third takes you over. Out on the course a second top hat throws you back once more before the last launch. Line up outside among the storm-chaser trucks, then inside through the Storm Center to the storm briefing.",
    baseWait: 70, origin, entrance: [-618, 0, -490], exit: [-624, 0, -478], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, DARK, YELLOW], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), "Benton Blitz is open past Ravage - it goes backward three times!", 'Storm briefing groups go in together - next group soon!'];
  return { ride, gate: { x: -594, z: gz }, indoor: { x0: HQ.x0, x1: HQ.x1, z0: HQ.z0, z1: HQ.z1 }, briefing: PR, supports, backs, launches: sim.events.filter((e) => e[1] === 'launch').length };
}

// a toast the first time you come near, and the storm briefing when you
// walk into the room in line
export class BentonBlitzSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
    this.inRoom = false;
  }

  update(dt, pos, started, queueing) {
    if (!started) return;
    const { gate, briefing: r } = this.layout;
    if (!this.told && Math.hypot(pos.x - gate.x, pos.z - gate.z) < 60) {
      this.told = true;
      this.hooks.toast('NEW: Benton Blitz, a multi-launch coaster that goes backward three times! Through the gate in Ravage\'s west wall.', 'reward');
    }
    const inside = queueing && pos.x > r.x0 && pos.x < r.x1 && pos.z > r.z0 && pos.z < r.z1;
    if (inside && !this.inRoom) this.hooks.toast('STORM BRIEFING: a crew member clicks your group in at the door - they count every guest coming in. "A supercell is over the quarry. The Blitz rides the lightning: forward, backward, forward, backward ... and forward. Keep your head back!"', 'info');
    this.inRoom = inside;
  }
}
