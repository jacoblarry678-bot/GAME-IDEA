// Harbor Run: a robot-arm dark ride in the Pier 9 warehouse at the old
// Benton harbor, north of Cyclone (through a gate in Cyclone's north wall).
// You ride PORTBOT 9, Benton Port's new cargo robot - a four-seat bench on
// the end of a giant arm - on its first night shift, when a storm rolls in
// and the robot makes a run for it through the port: the container yard
// (a swinging container rolls you onto your side), a freighter's engine
// room, out on deck in the storm, a giant wave (it tips you onto your
// back), the lighthouse, the sea serpent that lives under the pier, and
// home to the dock.
//
// Outside: the harbor basin with a tugboat and a lighthouse, container
// stacks and a gantry crane over the line, which winds through the
// container yard to the warehouse door, then inside up to the dock.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'HarborRun';
const SITE = { x0: -796, x1: -598, z0: -20, z1: 110 };
const B = { x0: -780, x1: -648, z0: -10, z1: 100, H: 26 }; // Pier 9
const GATE = { x0: -611, x1: -601 }; // in Cyclone's north wall (z -22)
const G = 0.1;
const CARS = 3, SPACING = 12, H = 4.0;
const PLAT = G + H - 1.95;
const NAVY = 0x14243c, ORANGE = 0xff7a1a, AMBER = 0xffb020, DARK = 0x1a1c20, STEEL = 0x5a5e66, WHITE = 0xf2f2ee, SEA = 0x1e5a7a, FOAM = 0xd8eef4, RUST = 0x8a4a2a, RED = 0xd8282a;
const CONTAINER = [0xc8382a, 0x2a6ab8, 0x3a8a4a, 0xe8a020, 0x8a3a8a, 0x5a6a7a];

const P = (x, z, v) => [x, G, z, v * 1.6];
const CIRCUIT = [
  P(-672, 64, 1),
  P(-672, 54, 2), P(-672, 44, 1), P(-672, 34, 0.7), P(-672, 26, 1.5), // 1 the container yard
  P(-672, 16, 3), P(-676, 8, 3), P(-688, 6, 2), P(-700, 6, 0.7), P(-710, 6, 1.5), // 2 the engine room
  P(-724, 6, 3), P(-746, 6, 0.8), P(-756, 6, 1.5), // 3 on deck in the storm
  P(-764, 10, 3), P(-768, 22, 2), P(-768, 40, 0.7), P(-768, 52, 1.5), // 4 the giant wave
  P(-768, 62, 2), P(-768, 72, 0.8), P(-768, 80, 2), // 5 the lighthouse
  P(-762, 88, 3), P(-746, 90, 2), P(-730, 90, 0.7), P(-718, 90, 1.5), // 6 the sea serpent
  P(-706, 90, 2), P(-696, 90, 0.7), P(-686, 90, 1.5), // 7 home to the dock
  P(-676, 86, 2), P(-672, 76, 1.2),
];
// where each scene stops the rig, what it turns to face, and how it moves
const SCENES = [
  { stop: [-672, 34], face: [-650, 34], style: 'sideways', back: 14, fwd: 10 },
  { stop: [-700, 6], face: [-700, -10], style: 'engine', back: 14, fwd: 10 },
  { stop: [-746, 6], face: [-746, -10], style: 'storm', back: 16, fwd: 10 },
  { stop: [-768, 40], face: [-780, 40], style: 'flip', back: 16, fwd: 12 },
  { stop: [-768, 72], face: [-780, 72], style: 'warp', back: 10, fwd: 8 },
  { stop: [-730, 90], face: [-730, 100], style: 'canyon', back: 14, fwd: 10 },
  { stop: [-696, 90], face: [-696, 100], style: 'finish', back: 10, fwd: 8 },
];

export function buildHarborRun(data) {
  const W = helpers(data);
  const { add, box, sign, cf, mi } = W;
  data.tags.ParkLamp = data.tags.ParkLamp || [];
  data.tags.SteamVent = data.tags.SteamVent || [];
  data.tags.Lighthouse = data.tags.Lighthouse || [];
  data.hauntLights = data.hauntLights || [];
  data.staffSpots = data.staffSpots || [];
  data.hidden = data.hidden || [];
  data.dynamicSigns = data.dynamicSigns || [];
  data.terrain = data.terrain || [];
  const light = (x, y, z, color) => data.hauntLights.push([x, y, z, color]);
  const neon = (size, pos, color, o = {}) => add(size, pos, color, 'Neon', { collide: 0, ...o });
  const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];

  // ======== the site: the old harbor, walled
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 30 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0 + 2, 1, SITE.z1 - SITE.z0 + 2], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x6a6a66, 'Concrete');
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], 0x8a8478, 'Slate', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], 0xb8b0a2, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-798, -22, -798, 112);
  wallSeg(-798, 112, -596, 112);
  wallSeg(-596, 112, -596, -22);
  // the gate in Cyclone's north wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[6] + 22) < 0.6 && Math.abs(p[4] + 697) < 0.6 && p[3] > 150;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-596, -22, GATE.x1, -22);
  wallSeg(GATE.x0, -22, -798, -22);
  const gx = (GATE.x0 + GATE.x1) / 2;
  for (const x of [GATE.x0 + 0.8, GATE.x1 - 0.8]) {
    box([1.4, 15, 1.4], [x, G, -22], NAVY, 'Metal');
    for (let k = 0; k < 4; k++) add([1.5, 0.6, 1.5], [x, G + 2 + k * 3.4, -22], k % 2 ? ORANGE : WHITE, 'SmoothPlastic', { collide: 0 });
  }
  add([GATE.x1 - GATE.x0 + 1.4, 2.4, 1.2], [gx, G + 14, -22], NAVY, 'Metal', { collide: 0 });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, -21.3], NAVY, 'Back', [['HARBOR RUN', 0, 0, 1, 1, ORANGE]], { glow: true });
  sign([GATE.x1 - GATE.x0 - 0.4, 2, 0.2], [gx, G + 14, -22.7], NAVY, 'Front', [['HARBOR RUN', 0, 0, 1, 1, ORANGE]], { glow: true });
  // the walk up the east side of Cyclone's farm to the gate, and on to the plaza
  for (const [a, b] of [[[-599, -84], [-601, -30]], [[-601, -30], [gx, -18]], [[gx, -18], [-601, -10]], [[-601, -10], [-601, 56]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.4, 0.2, len + 3.4], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }

  // ======== Pier 9: a big corrugated warehouse
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const SHED = 0x4a6a7a;
  const wallX = (x, za, zb, h = B.H, color = SHED, base = G) => { if (zb - za > 0.1) box([T, h, zb - za], [x, base, (za + zb) / 2], color, 'CorrodedMetal'); };
  const wallZ = (z, xa, xb, h = B.H, color = SHED, base = G) => { if (xb - xa > 0.1) box([xb - xa, h, T], [(xa + xb) / 2, base, z], color, 'CorrodedMetal'); };
  const DOOR_IN = 58, DOOR_OUT = 97.6;
  wallX(B.x1 - T / 2, B.z0, DOOR_IN - 2.5);
  wallX(B.x1 - T / 2, DOOR_IN + 2.5, DOOR_OUT - 1.8);
  wallX(B.x1 - T / 2, DOOR_IN - 2.5, DOOR_IN + 2.5, B.H - 5, SHED, G + 5);
  wallX(B.x1 - T / 2, DOOR_OUT - 1.8, B.z1, B.H - 5, SHED, G + 5);
  wallX(B.x0 + T / 2, B.z0, B.z1);
  wallZ(B.z0 + T / 2, B.x0, B.x1);
  wallZ(B.z1 - T / 2, B.x0, B.x1);
  add([B.x1 - B.x0 + 2, 1.2, B.z1 - B.z0 + 2], [cx, G + B.H + 0.6, cz], 0x3a4a54, 'CorrodedMetal', { collide: 0 });
  for (let x = B.x0 + 6; x < B.x1; x += 12) add([0.4, B.H, 0.4], [x, G + B.H / 2, B.z0 - 0.2], 0x3a5a6a, 'Metal', { collide: 0 });
  sign([0.4, 7, 40], [B.x1 + 0.4, G + 17, 30], NAVY, 'Right', [['PIER 9', 0, 0.02, 1, 0.5, WHITE], ['BENTON PORT AUTHORITY', 0, 0.58, 1, 0.36, ORANGE, 'GothamBold']], { glow: true });
  sign([0.4, 4.4, 26], [B.x1 + 0.4, G + 9, 30], DARK, 'Right', [['HARBOR RUN', 0, 0, 1, 1, ORANGE]], { glow: true });
  for (const z of [DOOR_IN, DOOR_OUT]) neon([0.3, 0.6, 5], [B.x1 + 0.4, G + 5.4, z], z === DOOR_IN ? ORANGE : 0x40d060);

  // ======== the track: a guide rail in the floor
  const track = makeTrack(CIRCUIT);
  for (let i = 1; i < track.pos.length; i += 3) track.pos[i] = G;
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), Pv = new THREE.Vector3();
  for (let s = 0; s < track.length; s += 2) {
    sampler.matrixAt(s, m4);
    Pv.setFromMatrixPosition(m4);
    const e = m4.elements;
    const ry = Math.atan2(e[8], e[10]) + Math.PI;
    add([2.4, 0.05, 2.2], [Pv.x, G + 0.03, Pv.z], 0x1a1a1c, 'Metal', { collide: 0, yaw: ry });
    if (Math.round(s) % 6 === 0) add([0.3, 0.06, 2.2], [Pv.x, G + 0.05, Pv.z], ORANGE, 'SmoothPlastic', { collide: 0, yaw: ry });
  }
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.cum[best];
  };
  const scenes = SCENES.map((sc) => { const s = sAt(...sc.stop); return { s0: s - sc.back, s1: s + sc.fwd, target: sc.face, style: sc.style }; });
  const trackPts = [];
  for (let s = 0; s < track.length; s += 1.5) { sampler.matrixAt(s, m4); Pv.setFromMatrixPosition(m4); trackPts.push([Pv.x, Pv.z]); }
  const clear = (x, z, r) => !trackPts.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < r * r);

  // ======== inside: the dark core between the scenes, the dock
  const CORE = { x0: -756, x1: -684, z0: 18, z1: 78 };
  box([CORE.x1 - CORE.x0, 20, CORE.z1 - CORE.z0], [(CORE.x0 + CORE.x1) / 2, G, (CORE.z0 + CORE.z1) / 2], 0x16181c, 'Metal');
  // the dock: a raised platform east of the guide rail
  const PL = { x0: -667.4, x1: -660, z0: 56, z1: 96 };
  box([PL.x1 - PL.x0, PLAT - G, PL.z1 - PL.z0], [(PL.x0 + PL.x1) / 2, G, (PL.z0 + PL.z1) / 2], 0x4a4844, 'Concrete');
  for (let z = PL.z0 + 1; z < PL.z1; z += 2) add([0.4, 0.06, 1], [PL.x0 + 0.4, PLAT + 0.03, z], (z % 4) < 2 ? DARK : AMBER, 'SmoothPlastic', { collide: 0 });
  for (let k = 0; k < 4; k++) add([2, 0.5, 1.2], [PL.x1 + 0.9, G + 0.25 + k * 0.5, 74 - k * 0], 0x5a5854, 'Concrete', { collide: 0, rot: RY(0) });
  wallZ(52, -666, B.x1 - T, 8, 0x2a3440, G);
  sign([0.3, 3, 14], [B.x1 - T - 0.3, G + 9.5, 76], NAVY, 'Left', [['PORTBOT 9  ·  DOCK', 0, 0.05, 1, 0.55, ORANGE], ['FIRST NIGHT SHIFT  ·  STORM WARNING', 0, 0.62, 1, 0.33, WHITE, 'GothamBold']], { glow: true });
  const con = [-662, 92];
  box([1.4, 1.2, 2.2], [con[0], PLAT, con[1]], DARK, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0], PLAT + 1.45, con[1] - 0.6 + k * 0.6], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(-664, 12, 76, 0xffe8c0);
  // the indoor line: three short lanes beside the dock
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.2, 1.2, 0.2], [x, G, za + ((zb - za) * k) / n], STEEL, 'Metal');
    add([0.12, 0.12, zb - za], [x, G + 1.1, (za + zb) / 2], ORANGE, 'Metal', { collide: 0 });
  };
  railZ(60, 92, -653.6);
  railZ(56, 88, -657.2);

  // ======== the scenes
  const props = [], extras = {}, extrasNames = [];
  const addProp = (name, parts, at, prop) => {
    extras[name] = { pivot: [...at, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts };
    props.push({ name, at, ...prop });
  };
  const container = (x, y, z, yaw, c) => {
    add([12, 2.6, 2.4], [x, y + 1.3, z], c, 'CorrodedMetal', { collide: 0, yaw });
    for (let k = -5; k <= 5; k += 1) add([0.12, 2.5, 2.5], [x + Math.cos(yaw) * k, y + 1.3, z - Math.sin(yaw) * k], c, 'Metal', { collide: 0, yaw });
  };
  // 1 the container yard: stacks, floodlights, a container swinging at you
  for (const [z, n] of [[18, 3], [30, 2], [44, 3]]) for (let k = 0; k < n; k++) if (clear(-655, z, 7)) container(-655, G + k * 2.6, z, Math.PI / 2, CONTAINER[(z + k) % 6]);
  addProp('YardBox', [pp(0, [0.15, 8, 0.15], [0, -4, 0], 0x2a2a2a, 'Metal'), pp(0, [2.4, 2.6, 8], [0, -9.3, 0], CONTAINER[0], 'CorrodedMetal'), pp(0, [2.5, 0.4, 0.4], [0, -8, 0], AMBER, 'Neon')], [-660, G + 22, 34], { kind: 'swing', axis: 'x', amp: 0.4, freq: 1.1 });
  for (const z of [14, 48]) { neon([1.2, 0.8, 0.4], [-650.5, G + 14, z], 0xfff2d0); light(-652, 14, z, 0xfff0d0); }
  sign([0.3, 2.4, 14], [B.x1 - T - 0.3, G + 18, 32], DARK, 'Left', [['CONTAINER YARD  ·  STORM WARNING', 0, 0, 1, 1, AMBER, 'GothamBold']], { glow: true });
  // 2 the engine room: giant pistons pounding, pipes, steam, red light
  for (let k = 0; k < 4; k++) addProp(`Piston${k + 1}`, [pp(5, [2.4, 6, 2.4], [0, 0, 0], 0x8a8e96, 'Metal'), pp(5, [3.2, 1, 3.2], [0, 3, 0], RUST, 'Metal')], [-712 + k * 8, G + 6, -5], { kind: 'piston', amp: 1.6, freq: 6, phase: k * 1.6 });
  for (let k = 0; k < 3; k++) add([40, 1, 1], [-700, G + 12 + k * 2.4, -7], [RUST, STEEL, RUST][k], 'Metal', { shape: 2, collide: 0 });
  for (const x of [-716, -700, -684]) data.tags.SteamVent.push([x, G + 1, -3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-700, 10, -4, 0xff3a20);
  sign([20, 2.4, 0.3], [-700, G + 20, B.z0 + T + 0.3], DARK, 'Back', [['ENGINE ROOM  ·  MV BENTON STAR', 0, 0, 1, 1, 0xff6a30, 'GothamBold']], { glow: true });
  // 3 on deck in the storm: a ship's rail, waves, lightning, rain and wind
  add([30, 1.2, 0.3], [-746, G + 1.6, -4], WHITE, 'Metal', { collide: 0 });
  for (let x = -760; x <= -732; x += 3) add([0.2, 1.6, 0.2], [x, G + 0.8, -4], WHITE, 'Metal', { collide: 0 });
  for (let k = 0; k < 6; k++) add([8, 3 + (k % 3), 1], [-760 + k * 5.6, G + 4 + (k % 2) * 2, -8], k % 2 ? SEA : 0x2a7a9a, 'SmoothPlastic', { collide: 0, shape: 1, rot: RX(-0.3) });
  for (let k = 0; k < 3; k++) neon([0.4, 8, 0.4], [-756 + k * 9, G + 18, -8.5], 0xe0ecff, { rot: RZ((k - 1) * 0.5) });
  for (const x of [-756, -736]) data.tags.SteamVent.push([x, G + 12, -6, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  light(-746, 16, -4, 0x8ab4ff);
  // 4 the giant wave: a curling wall of water
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    add([2.4, 16, 3], [-778.6 + Math.sin(a) * 0.8, G + 8 + k * 1.6, 40 + (k - 4) * 3], k % 2 ? SEA : 0x2a7a9a, 'Glass', { collide: 0, trans: 0.3, rot: RZ(-0.08 - a * 0.12) });
  }
  for (let k = 0; k < 10; k++) add([3, 1.2, 2], [-775 + (k % 3), G + 20 + (k % 4), 28 + k * 2.6], FOAM, 'SmoothPlastic', { collide: 0, shape: 3 });
  light(-772, 14, 40, 0x40a0ff);
  // 5 the lighthouse: its lamp turning, the beam sweeping over you
  box([6, 22, 6], [-776, G, 72], WHITE, 'Concrete', { collide: 0, shape: 5 });
  for (const y of [5, 12]) add([6.2, 2.4, 6.2], [-776, G + y, 72], RED, 'SmoothPlastic', { collide: 0, shape: 5 });
  addProp('Beam', [pp(5, [3, 2, 3], [0, 0, 0], 0xfff4c0, 'Neon'), pp(0, [18, 1.6, 1.6], [9, 0, 0], 0xfff8d8, 'Glass')], [-776, G + 23.4, 72], { kind: 'turn', speed: 1.4 });
  light(-772, 20, 72, 0xfff0c0);
  // 6 the sea serpent: rising out of the harbor at you (the park's own creature)
  const serpent = [];
  for (let k = 0; k < 7; k++) serpent.push(pp(3, [2.6 - k * 0.15, 2.6 - k * 0.15, 3], [0, 6 - k * 0.6 + Math.sin(k) * 1.4, 4 + k * 2.4], 0x1e6a5a, 'SmoothPlastic'));
  for (let k = 0; k < 6; k++) serpent.push(pp(1, [0.3, 1.6, 1.6], [0, 7.6 - k * 0.6 + Math.sin(k) * 1.4, 4 + k * 2.4], 0xffa020, 'SmoothPlastic'));
  serpent.push(pp(0, [3, 2.2, 4], [0, 7.6, 0.4], 0x1e6a5a, 'SmoothPlastic'), pp(1, [2.6, 0.8, 2.4], [0, 6.4, -2.2], 0x1e6a5a, 'SmoothPlastic', RX(Math.PI)),
    pp(0, [2.4, 0.5, 2.6], [0, 5.6, -1.8], 0x6a1418, 'SmoothPlastic', RX(0.4)), pp(3, [0.6, 0.6, 0.6], [-1.1, 8.4, -1], 0xffd040, 'Neon'), pp(3, [0.6, 0.6, 0.6], [1.1, 8.4, -1], 0xffd040, 'Neon'));
  for (const s of [-1, 1]) serpent.push(pp(1, [0.2, 2.4, 3], [s * 1.6, 8.8, 1], 0xffa020, 'SmoothPlastic', RZ(s * 0.6)));
  addProp('Serpent', serpent, [-730, G, 98], { kind: 'lunge', dir: [0, -1], reach: 3, period: 4.6 });
  for (let k = 0; k < 6; k++) add([5, 1.6, 2], [-744 + k * 5.6, G + 0.8, 98], k % 2 ? SEA : 0x2a7a9a, 'SmoothPlastic', { collide: 0, shape: 1, rot: RY(Math.PI) });
  light(-730, 10, 94, 0x30e0a0);
  // 7 home: the harbor lights and the dock master waving you in
  sign([22, 3.6, 0.3], [-696, G + 14, B.z1 - T - 0.3], NAVY, 'Front', [['WELCOME HOME, PORTBOT 9', 0, 0.06, 1, 0.5, ORANGE], ['SHIFT COMPLETE  ·  ALL CARGO ACCOUNTED FOR (MOSTLY)', 0, 0.6, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  for (let k = 0; k < 8; k++) neon([0.6, 0.6, 0.6], [-708 + k * 3.4, G + 9 + (k % 2), B.z1 - T - 0.5], [AMBER, WHITE][k % 2], { shape: 3 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 251, cf: cf(-686, G, 97, Math.PI) });
  light(-696, 12, 94, 0xffd8a0);
  extrasNames.push(...props.map((p) => p.name));

  // ======== the vehicles: PORTBOT 9, a four-seat bench on a robot arm
  const cabinParts = () => {
    const p = [];
    p.push(pp(0, [8.4, 0.5, 2.2], [0, 0, 0], NAVY, 'Metal'));
    p.push(pp(0, [8.6, 0.25, 2.3], [0, -0.3, 0], ORANGE, 'Metal'));
    for (const x of [-2.4, -0.8, 0.8, 2.4]) {
      p.push(pp(0, [1.45, 0.5, 1.6], [x, 0.35, -0.05], 0x2a2a2e, 'Fabric'));
      p.push(pp(0, [1.45, 2.6, 0.45], [x, 1.7, 0.8], 0x2a2a2e, 'Fabric'));
    }
    p.push(pp(0, [8.8, 3.4, 0.4], [0, 1.6, 1.2], NAVY, 'Metal'));
    p.push(pp(0, [8.8, 0.3, 0.42], [0, 2.4, 1.2], ORANGE, 'Neon'));
    for (const sd of [-1, 1]) p.push(pp(0, [0.4, 3.8, 2.6], [sd * 4.3, 1.4, 0.2], ORANGE, 'Metal'));
    p.push(pp(0, [9, 0.4, 2.8], [0, 3.6, 0.2], NAVY, 'Metal'));
    p.push(pp(0, [9, 0.15, 0.2], [0, 3.38, -1.1], AMBER, 'Neon'));
    p.push(pp(0, [8, 0.3, 1.1], [0, -1.6, -1.1], STEEL, 'Metal'));
    p.push(pp(0, [2.4, 2.4, 1.4], [0, 1.0, 2.0], DARK, 'Metal'));
    p.push(pp(2, [1, 1.8, 1.8], [0, 1.0, 2.7], ORANGE, 'Metal'));
    return p;
  };
  const seatList = () => [-2.4, -0.8, 0.8, 2.4].map((x) => [x, 0.6 + 1.3, -0.1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const baseParts = () => [
    pp(0, [5.6, 0.7, 9.4], [0, 1.0, 0.4], DARK, 'Metal'), pp(0, [5.8, 0.25, 9.6], [0, 1.4, 0.4], ORANGE, 'SmoothPlastic'),
    ...[[-2.6, -3.6], [2.6, -3.6], [-2.6, 4.4], [2.6, 4.4]].map(([x, z]) => pp(2, [0.4, 0.8, 0.8], [x, 0.4, z], 0x111111, 'Rubber')),
    pp(5, [3, 0.8, 3], [0, 1.8, 3.0], ORANGE, 'Metal'), pp(0, [2, 1.6, 2.4], [0, 2.2, 3.4], DARK, 'Metal'),
    pp(0, [2.6, 1.4, 3], [0, 1.9, -2.6], NAVY, 'Metal'), pp(3, [0.5, 0.5, 0.5], [1.2, 2.7, -2.6], AMBER, 'Neon'),
  ];
  const L1 = 4.2, L2 = 4.2;
  const armA = () => [pp(2, [1.9, 1.9, 1.9], [0, 0, 0], DARK, 'Metal'), pp(0, [1.4, L1, 1.4], [0, L1 / 2, 0], ORANGE, 'Metal'), pp(0, [1.45, 0.3, 1.45], [0, L1 * 0.75, 0], NAVY, 'Metal')];
  const armB = () => [pp(2, [1.7, 1.6, 1.6], [0, 0, 0], DARK, 'Metal'), pp(0, [1.1, L2, 1.1], [0, L2 / 2, 0], ORANGE, 'Metal'), pp(3, [1.3, 1.3, 1.3], [0, L2, 0], DARK, 'Metal')];
  const cars = [], seats = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    const e = m4.elements;
    const piv = [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
    cars.push({ pivot: [e[12], e[13] + H, e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]], parts: cabinParts() });
    seats.push(seatList());
    extras[`Base${k + 1}`] = { pivot: piv, parts: baseParts() };
    extras[`ArmA${k + 1}`] = { pivot: piv, parts: armA() };
    extras[`ArmB${k + 1}`] = { pivot: piv, parts: armB() };
    extrasNames.push(`Base${k + 1}`, `ArmA${k + 1}`, `ArmB${k + 1}`);
  }

  // ======== outside: the harbor basin, the tugboat, the lighthouse
  const BASIN = { x0: -638, x1: -606, z0: 66, z1: 94 };
  const level = G + 0.6;
  data.terrain.push({ kind: 'block', material: 'Water', cf: [(BASIN.x0 + BASIN.x1) / 2, level + 0.2, (BASIN.z0 + BASIN.z1) / 2, 1, 0, 0, 0, 1, 0, 0, 0, 1], size: [BASIN.x1 - BASIN.x0, 1, BASIN.z1 - BASIN.z0] });
  for (const [w, d, x, z] of [[BASIN.x1 - BASIN.x0 + 2, 1, (BASIN.x0 + BASIN.x1) / 2, BASIN.z0 - 0.5], [BASIN.x1 - BASIN.x0 + 2, 1, (BASIN.x0 + BASIN.x1) / 2, BASIN.z1 + 0.5], [1, BASIN.z1 - BASIN.z0, BASIN.x0 - 0.5, (BASIN.z0 + BASIN.z1) / 2], [1, BASIN.z1 - BASIN.z0, BASIN.x1 + 0.5, (BASIN.z0 + BASIN.z1) / 2]]) {
    add([w, 1.1, d], [x, G + 0.55, z], 0x8a8680, 'Concrete');
  }
  add([BASIN.x1 - BASIN.x0, 0.3, BASIN.z1 - BASIN.z0], [(BASIN.x0 + BASIN.x1) / 2, G + 0.05, (BASIN.z0 + BASIN.z1) / 2], 0x1e4a5a, 'SmoothPlastic', { collide: 0 });
  // the tugboat
  const TB = [-624, 80];
  add([5, 2, 12], [TB[0], level + 0.4, TB[1]], RED, 'SmoothPlastic', { collide: 0 });
  add([5.2, 0.4, 12.2], [TB[0], level + 1.5, TB[1]], DARK, 'Metal', { collide: 0 });
  add([3.6, 3, 4], [TB[0], level + 3.2, TB[1] - 1], WHITE, 'SmoothPlastic', { collide: 0 });
  add([3.7, 0.8, 0.1], [TB[0], level + 3.8, TB[1] - 3.05], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  add([1.2, 3, 1.2], [TB[0], level + 6, TB[1] + 0.6], DARK, 'Metal', { collide: 0, shape: 5 });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add([0.6, 1, 1], [TB[0] + s * 2.7, level + 0.9, TB[1] - 3 + k * 3], 0x1a1a1a, 'Rubber', { collide: 0, shape: 2 });
  // the lighthouse at the end of the quay
  const LH = [-610, 106.5];
  box([5, 22, 5], [LH[0], G, LH[1]], WHITE, 'Concrete', { shape: 5 });
  for (const y of [4, 11, 18]) add([5.2, 2.4, 5.2], [LH[0], G + y, LH[1]], RED, 'SmoothPlastic', { collide: 0, shape: 5 });
  add([3.4, 3, 3.4], [LH[0], G + 23.5, LH[1]], 0xfff4c0, 'Neon', { collide: 0, shape: 5 });
  add([4.4, 1.4, 4.4], [LH[0], G + 25.7, LH[1]], DARK, 'Metal', { collide: 0, shape: 5 });
  data.tags.Lighthouse.push([LH[0], G + 23.5, LH[1], 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // bollards and a pier
  for (let z = BASIN.z0 + 3; z < BASIN.z1; z += 7) { add([0.8, 1.2, 0.8], [BASIN.x0 - 1.6, G + 0.6, z], DARK, 'Metal', { shape: 5, collide: 0 }); }
  add([3, 0.4, 16], [-614, level + 0.6, 76], 0x6a4a30, 'WoodPlanks', { collide: 0 });

  // ======== the outdoor line: the container yard under a gantry crane
  const QX = { w: -642, e: -608 }, ROWS = 7, qz = (k) => 6 + 6 * k;
  const railX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.2, 1.2, 0.2], [xa + ((xb - xa) * k) / n, G, z], STEEL, 'Metal');
    add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1.1, z], ORANGE, 'Metal', { collide: 0 });
  };
  railX(QX.w - 3, QX.e + 3, qz(0) - 3);
  for (let k = 0; k < ROWS - 1; k++) {
    if (k % 2 === 0) railX(QX.w + 3, QX.e + 3, qz(k) + 3); // heading west: turn at the west end
    else railX(QX.w - 3, QX.e - 3, qz(k) + 3);
  }
  railX(QX.w - 1, QX.e + 3, qz(ROWS - 1) + 3);
  railZ(qz(0) + 3, qz(ROWS - 1) + 3, QX.e + 3);
  railZ(qz(0) - 3, qz(ROWS - 2) + 3, QX.w - 3);
  // the gantry crane over the line
  for (const x of [-640, -610]) for (const z of [-2, 52]) box([1.6, 24, 1.6], [x, G, z], ORANGE, 'Metal', { collide: 0 });
  for (const z of [-2, 52]) add([32, 2, 2], [-625, G + 24, z], ORANGE, 'Metal', { collide: 0 });
  for (const x of [-640, -610]) add([2, 2, 56], [x, G + 26, 25], ORANGE, 'Metal', { collide: 0 });
  add([5, 3, 5], [-625, G + 24, 25], NAVY, 'Metal', { collide: 0 });
  add([12, 2.6, 2.4], [-625, G + 15, 25], CONTAINER[1], 'CorrodedMetal', { collide: 0 });
  add([0.15, 6, 0.15], [-625, G + 19.5, 25], DARK, 'Metal', { collide: 0 });
  // container stacks around the yard
  for (const [x, z, n, yaw] of [[-620, -12, 2, 0], [-636, -12, 3, 0], [-628, 104, 2, 0]]) for (let k = 0; k < n; k++) container(x, G + k * 2.6, z, yaw, CONTAINER[(k + Math.round(x)) % 6]);
  // the plaza: the entrance, the wait time, lamps
  add([16, 0.2, 10], [-612, G + 0.1, 58], 0x8a8680, 'Concrete', { collide: 0 });
  for (const z of [53.5, 62.5]) { box([1, 6.4, 1], [-606, G, z], NAVY, 'Metal'); neon([0.3, 5.6, 0.3], [-605.4, G + 3.2, z], ORANGE); }
  add([1.2, 1.6, 10], [-606, G + 7, 58], NAVY, 'Metal', { collide: 0 });
  sign([0.2, 1.4, 9], [-605.3, G + 7, 58], NAVY, 'Right', [['HARBOR RUN', 0, 0, 1, 1, ORANGE]], { glow: true });
  const waitPart = add([0.4, 1.6, 6], [-605, G + 4, 64.4], 0x101624, 'SmoothPlastic', { collide: 0 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Right', ride: RIDE_ID });
  for (const [x, z] of [[-599, 40], [-599, 72], [-640, 104]]) {
    box([0.4, 8, 0.4], [x, G, z], NAVY, 'Metal');
    add([1.2, 1.4, 1.2], [x, G + 8.4, z], 0xfff2d0, 'Neon', { shape: 3, collide: 0 });
    data.tags.ParkLamp.push([x, G + 8.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 253, cf: cf(-608, G, 52, -Math.PI / 2) });

  // the line's path: the yard, into the warehouse, the lanes, up to the dock
  const fwd = [[-604, 58], [-603, 52], [-603, qz(0)]];
  for (let k = 0; k < ROWS; k++) {
    const west = k % 2 === 0;
    fwd.push([west ? QX.w : QX.e, qz(k)]);
    if (k < ROWS - 1) fwd.push([west ? QX.w : QX.e, qz(k + 1)]);
  }
  fwd.push([-646.5, qz(ROWS - 1)], [-646.5, DOOR_IN], [-651.8, DOOR_IN], [-651.8, 94], [-655.4, 94], [-655.4, 58], [-659, 58], [-659, 74], [-659.4, 75]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the exit: out the north door, round the basin to the plaza
  for (const [a, b] of [[[-648, DOOR_OUT], [-640, 100]], [[-640, 100], [-601, 100]], [[-601, 100], [-601, 64]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3, 0.2, len + 3], [(a[0] + b[0]) / 2, G + 0.12, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([0.2, 1, 3], [B.x1 + 0.3, G + 6.6, DOOR_OUT], 0x1a8a3a, 'Right', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });
  // inside, from the dock to the exit door
  add([12, 0.2, 2.4], [-660, G + 0.12, 98], 0x3a3a3c, 'Concrete', { collide: 0 });

  // ======== the crew
  const stops = [], stopCars = [];
  for (let k = 0; k < CARS; k++) {
    sampler.matrixAt(-k * SPACING, m4);
    Pv.setFromMatrixPosition(m4);
    stops.push(cf(PL.x0 + 1, PLAT, Pv.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'lapbar', attendants: 2, routes: [[1, 2], [3]],
    console: cf(con[0] + 1, PLAT, con[1], -Math.PI / 2), operator: cf(con[0] + 1, PLAT, con[1] + 1.4, -Math.PI / 2),
    homes: [cf(PL.x0 + 2, PLAT, 70, Math.PI / 2), cf(PL.x0 + 2, PLAT, 84, Math.PI / 2)],
    exit: cf(-662, PLAT, 95, 0),
  };

  // ======== the ride
  const origin = [-712, 0, 48];
  const ride = {
    id: RIDE_ID, kind: 'motionsim', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, party: 8, noExtended: true, queue: qpath, trackStyle: null, extras, extrasNames, crew,
    motionsim: { H, scenes, props, level: true, arm: { shoulder: [0, 2.2, 3.0], wrist: [0, 1.0, 2.7], l1: L1, l2: L2, lift: 2.6, reach: 2.2, gain: 1.7 } },
  };
  data.rides.push(ride);
  const at = (x, z) => track.times[track.cum.indexOf(sAt(x, z))] / ride.duration;
  // spray from the wave, sparks in the engine room, the serpent's splash
  const cues = [[at(-700, 6), 'sparks', [0, 6, -4]], [at(-768, 40), 'splash', [0, 0, -6]], [at(-746, 6), 'flood', [0, 4, -6]], [at(-730, 90), 'splash', [0, 0, -6]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Harbor Run', land: 'Backwoods', category: 'Thrill', thrill: 4, kind: 'motionsim', carStyle: 'coaster',
    description: "A robot-arm dark ride in the Pier 9 warehouse at the old Benton harbor. It's PORTBOT 9's first night shift - a four-seat bench on a giant robot arm - when a storm rolls in and it makes a run for it through the port: the container yard (a swinging container rolls you onto your side), a freighter's engine room, out on deck in the storm, a giant wave (it tips you onto your back), the lighthouse, the sea serpent that lives under the pier, and home to the dock.",
    baseWait: 50, origin, entrance: [-604, 0, 58], exit: [-606, 0, 66], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [ORANGE, NAVY, SEA], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Harbor Run is open at Pier 9 - PORTBOT 9 is waiting!'];
  return { ride, gate: { x: gx, z: -22 }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 } };
}

// a toast the first time you come near
export class HarborRunSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 50) {
      this.told = true;
      this.hooks.toast('NEW: Harbor Run, a robot-arm dark ride at Pier 9! Through the gate in Cyclone\'s north wall.', 'reward');
    }
  }
}
