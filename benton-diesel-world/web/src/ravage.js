// Ravage: a tilt coaster, half out in the open and half in the dark, on the
// field past the back lot (through a gate in the backstage lot's west wall).
// Benton BioDynamics keeps something in Sector R: Specimen R, the Ravager.
// Tonight the containment is failing, and the only way out is the
// facility's own transport pods.
//
// Outside: the facility - a concrete block with the Ravager bursting out of
// its east wall - and a very long line: a security checkpoint, then two big
// fields of switchbacks past quarantine tents, floodlight towers, a wrecked
// specimen truck and sirens. Inside: the lab corridors (with windows into the
// specimen hold), the decontamination room, and the pre-show in the
// containment briefing room, then the pod dock. The pods leave through the
// specimen hold, out of the building and up the lift onto the tilting track,
// stop, tip forward until they're hanging face down over the ground ... and
// drop. Then a zero-g roll, an airtime hill, and back inside, where the
// Ravager is waiting.
import * as THREE from 'three';
import { makeTrack, queuePath } from './fastfurious.js';
import { helpers } from './wolverine.js';
import { Sampler } from './rides.js';

export const RIDE_ID = 'Ravage';
const SITE = { x0: -592, x1: -252, z0: -606, z1: -428 };
const B = { x0: -446, x1: -344, z0: -602, z1: -464, H: 16 }; // the facility
const GATE = { z0: -486, z1: -474 }; // in the backstage lot's west wall (x -250)
const G = 0.1;
const CARS = 3, SPACING = 3.6;
const ZL = -549; // the lift and the tilting track run west along here
const HINGE = [-502, 34, ZL]; // the tilting piece's front end (it tips about here)
const PIECE = 12; // its length
const TILT = (80 * Math.PI) / 180; // how far it tips
const DROP = [-Math.cos(TILT), -Math.sin(TILT), 0]; // the drop's direction
const A = [HINGE[0] + PIECE, HINGE[1], ZL];
const D1 = [HINGE[0] + DROP[0] * 4, HINGE[1] + DROP[1] * 4, ZL];
const D2 = [HINGE[0] + DROP[0] * 12, HINGE[1] + DROP[1] * 12, ZL];
const STOP = 1.8; // the front pod stops this far short of the hinge
const HOLD = [2.2, 4.2, 2.6]; // stopped, tipping, hanging face down
const RED = 0xc81a1a, DARK = 0x16181a, CONC = 0x8a8c86, HAZ = 0xf2c418, GREEN = 0x5aff7a, WHITE = 0xf2f2ee, STEEL = 0x8e949c, AMBER = 0xffa020;
const TRACK_COLOR = 0xa8141c;
const SKIN = 0x2c3428, PLATE = 0x1c201c, BONE = 0xe4dcc4;

const CIRCUIT = [
  [-396, 2, -500, 2],
  // out of the dock, south through the specimen hold
  [-396, 2, -512, 5], [-396.5, 2, -526, 7], [-400, 2, -538, 7], [-410, 2, -546, 7], [-424, 2, ZL, 7],
  // out through the west wall and up the lift
  [-446, 2, ZL, 6], [-456, 2.4, ZL, 4], [-461, 5, ZL, 3.5], [-476, 24, ZL, 3.5], [-483, 32, ZL, 3], [-487, 33.85, ZL, 2.2],
  // the tilting track
  [A[0], A[1], ZL, 2.2], [HINGE[0] + 6, HINGE[1], ZL, 1.6], [HINGE[0], HINGE[1], ZL, 1.2],
  // the drop
  [D1[0], D1[1], ZL, 8.8], [D2[0], D2[1], ZL, 15], [-507.5, 10, ZL, 22], [-513, 3.4, ZL, 24.5], [-522, 1.9, ZL, 25], [-534, 2.2, ZL, 25],
  // round to the north and up into the zero-g roll
  [-556, 3, -546, 25], [-572, 5, -535, 24], [-579, 8, -518, 23], [-580, 12, -502, 21], [-580, 15, -488, 20], [-580, 15, -474, 20], [-579, 12, -460, 21],
  // round to the east and over the airtime hill
  [-574, 8, -446, 22], [-562, 7, -436, 23], [-546, 8, -432, 23], [-528, 16, -433, 19], [-512, 19, -436, 17], [-496, 14, -440, 19], [-482, 6, -446, 22],
  // south, and east back into the building
  [-470, 4, -458, 22], [-466, 5, -474, 21], [-466, 6, -488, 19], [-458, 4.5, -501, 17], [-446, 3.5, -504, 15],
  // the Ravager's lair, and the brakes home
  [-434, 3, -504, 14], [-422, 3, -500, 12], [-416, 3, -488, 10], [-412, 2.5, -477, 8], [-404, 2.2, -473, 6], [-397.5, 2, -479, 4], [-396, 2, -488, 3],
];
const knot = (x, z) => CIRCUIT.findIndex((p) => p[0] === x && p[2] === z);

// put the samples from index i0 to i1 exactly on the line p0 -> p1 (tangent
// and up straight along it), then measure the track again
function straighten(track, i0, i1, p0, p1) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const dir = b.clone().sub(a).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  const c0 = track.cum[i0], c1 = track.cum[i1];
  for (let i = i0; i <= i1; i++) {
    const u = (track.cum[i] - c0) / (c1 - c0);
    const p = a.clone().lerp(b, u);
    track.pos.splice(i * 3, 3, p.x, p.y, p.z);
    track.tan.splice(i * 3, 3, dir.x, dir.y, dir.z);
    track.up.splice(i * 3, 3, up.x, up.y, up.z);
  }
}
function remeasure(track) {
  const { pos, cum, times } = track;
  const n = cum.length;
  const old = cum.slice(), oldT = times.slice();
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(pos[i * 3] - pos[i * 3 - 3], pos[i * 3 + 1] - pos[i * 3 - 2], pos[i * 3 + 2] - pos[i * 3 - 1]);
    const d0 = old[i] - old[i - 1];
    times[i] = times[i - 1] + (d0 > 1e-6 ? (oldT[i] - oldT[i - 1]) * ((cum[i] - cum[i - 1]) / d0) : oldT[i] - oldT[i - 1]);
  }
  track.length = cum[n - 1];
}
const nearestSample = (track, p) => {
  let best = 0, bd = Infinity;
  for (let i = 0; i < track.cum.length; i++) {
    const d = (track.pos[i * 3] - p[0]) ** 2 + (track.pos[i * 3 + 1] - p[1]) ** 2 + (track.pos[i * 3 + 2] - p[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};

// the Ravager: an armored, six-limbed hunter with a split jaw and a back of
// glowing spines (the park's own creature). Local parts, facing -z, feet on
// y = 0, scaled by s. `pp` builds one part.
function ravager(pp, s = 1, { open = 0.45, tail = true } = {}) {
  const P = (shape, size, pos, color, mat, rot) => pp(shape, size.map((v) => v * s), pos.map((v) => v * s), color, mat, rot);
  const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const parts = [
    // body, chest and armor
    P(3, [6, 4.4, 9], [0, 4.2, 0.6], SKIN, 'SmoothPlastic'),
    P(3, [5.2, 4.2, 4.6], [0, 4.6, -3.4], SKIN, 'SmoothPlastic'),
    P(0, [5, 0.8, 7], [0, 6.3, 0.2], PLATE, 'Slate', RX(-0.08)),
    P(0, [4.2, 0.8, 3.4], [0, 6.4, -3.6], PLATE, 'Slate', RX(0.2)),
    // neck and head
    P(0, [2.6, 2.6, 3.4], [0, 5.8, -6], SKIN, 'SmoothPlastic', RX(-0.35)),
    P(0, [3, 2.2, 3.6], [0, 6.7, -8.6], SKIN, 'SmoothPlastic'),
    P(0, [3.2, 0.6, 3.8], [0, 7.9, -8.4], PLATE, 'Slate', RX(0.12)),
    // the split jaw: upper and lower, open, full of teeth
    P(1, [2.8, 1.3, 3.4], [0, 7.1, -11.6], SKIN, 'SmoothPlastic', RX(Math.PI)),
    P(0, [2.4, 0.6, 3.4], [0, 5.5 - open * 1.6, -11], SKIN, 'SmoothPlastic', RX(open)),
    P(0, [2.2, 0.5, 3], [0, 6.1, -11.2], 0x7a1418, 'SmoothPlastic'),
    ...[-1, 1].flatMap((x) => [0, 1, 2, 3].flatMap((k) => [
      P(1, [0.22, 0.6, 0.3], [x * 1.05, 6.25, -10.2 - k * 0.8], BONE, 'SmoothPlastic', RX(Math.PI)),
      P(1, [0.22, 0.5, 0.3], [x * 0.95, 5.55 - open * 1.6 + k * 0.35, -10 - k * 0.8], BONE, 'SmoothPlastic'),
    ])),
    // eyes and tusks
    ...[-1, 1].flatMap((x) => [
      P(3, [0.55, 0.45, 0.45], [x * 1.25, 7.5, -9.9], 0xff2a1a, 'Neon'),
      P(3, [0.4, 0.35, 0.35], [x * 1.2, 7.1, -9.3], 0xff2a1a, 'Neon'),
      P(1, [0.35, 2.2, 0.5], [x * 1.5, 5.4, -12.4], BONE, 'SmoothPlastic', RZ(x * 0.25)),
    ]),
    // spines down the back, glowing at the tips
    ...[0, 1, 2, 3, 4, 5].flatMap((k) => [
      P(1, [0.5, 1.8 - k * 0.15, 1.4], [0, 7.4 - k * 0.2, -4 + k * 1.7], PLATE, 'Slate'),
      P(3, [0.3, 0.3, 0.3], [0, 8.2 - k * 0.3, -3.6 + k * 1.7], 0xff3a20, 'Neon'),
    ]),
  ];
  // four legs and a pair of grasping arms
  for (const x of [-1, 1]) {
    parts.push(
      P(0, [1.3, 3.4, 1.4], [x * 2.9, 3.2, -4.6], SKIN, 'SmoothPlastic', RX(0.45)),
      P(0, [1, 3, 1.1], [x * 3.1, 1.3, -6], SKIN, 'SmoothPlastic', RX(-0.3)),
      P(0, [1.6, 3.6, 1.8], [x * 2.9, 2.8, 3.4], SKIN, 'SmoothPlastic', RX(-0.4)),
      P(0, [1.1, 2.4, 1.2], [x * 3, 1.1, 4.6], SKIN, 'SmoothPlastic', RX(0.3)),
      // arms reaching forward from the chest
      P(0, [0.7, 0.7, 3.4], [x * 2.2, 4.6, -6.6], SKIN, 'SmoothPlastic', RX(0.35)),
      P(0, [0.6, 0.6, 2.4], [x * 2.3, 3.6, -8.8], SKIN, 'SmoothPlastic', RX(-0.2)),
    );
    for (const k of [-1, 0, 1]) {
      parts.push(P(1, [0.35, 0.5, 1.6], [x * 3.1 + k * 0.42, 0.25, -7.6], BONE, 'SmoothPlastic'));
      parts.push(P(1, [0.3, 0.45, 1.3], [x * 3 + k * 0.4, 0.22, 3.4], BONE, 'SmoothPlastic'));
      parts.push(P(1, [0.2, 0.3, 1.1], [x * 2.3 + k * 0.25, 3.4, -10.3], BONE, 'SmoothPlastic', RX(0.5)));
    }
  }
  // the tail, tapering and curling up, with a barbed tip
  if (tail) {
    for (let k = 0; k < 5; k++) parts.push(P(0, [1.8 - k * 0.3, 1.6 - k * 0.25, 2.8], [0, 3.8 - k * 0.3 + (k > 3 ? 0.6 : 0), 5.8 + k * 2.4], SKIN, 'SmoothPlastic', RX(-0.12 * k)));
    parts.push(P(1, [0.3, 1.6, 1.2], [0, 3.6, 17.6], BONE, 'SmoothPlastic', RX(-1.2)));
  }
  return parts;
}

export function buildRavage(data) {
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
  const ALONG_Z = [0, 0, 1, 0, 1, 0, -1, 0, 0]; // a shape-2 cylinder turned to run along z
  const pp = (shape, size, pos, color, mat, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
  // set local parts (facing -z) into the world at `at`, turned by yaw
  const place = (parts, at, yaw, o = {}) => {
    const R = new THREE.Matrix4().makeRotationY(yaw);
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const q of parts) {
      const L = new THREE.Matrix4().set(q[7], q[8], q[9], 0, q[10], q[11], q[12], 0, q[13], q[14], q[15], 0, 0, 0, 0, 1);
      m.multiplyMatrices(R, L);
      const e = m.elements;
      v.set(q[4], q[5], q[6]).applyMatrix4(R);
      data.static.push([q[0], q[1], q[2], q[3], at[0] + v.x, at[1] + v.y, at[2] + v.z, e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10], q[16], q[17], o.trans ?? 0, o.collide ?? 0]);
    }
  };

  // ======== the site: the field past the back lot, walled in
  data.flatZones = [...(data.flatZones || []), { ...SITE, margin: 20 }];
  data.trees = (data.trees || []).filter((t) => !inRect(t.pos[0], t.pos[2], SITE, 8));
  const bw = data.config.Lands.find((l) => l.id === 'Backwoods');
  if (bw) bw.regions = [...bw.regions, [SITE.x0, SITE.z0, SITE.x1, SITE.z1]];
  add([SITE.x1 - SITE.x0, 1, SITE.z1 - SITE.z0], [(SITE.x0 + SITE.x1) / 2, G - 0.5, (SITE.z0 + SITE.z1) / 2], 0x6a6a64, 'Asphalt');
  const WALL = 0x96928c, CAP = 0xc4beb4;
  const wallSeg = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), yaw = Math.atan2(xb - xa, zb - za);
    add([2.5, 14, len], [(xa + xb) / 2, 7, (za + zb) / 2], WALL, 'Concrete', { yaw });
    add([3.4, 1, len + 1], [(xa + xb) / 2, 14.5, (za + zb) / 2], CAP, 'Concrete', { yaw, collide: 0 });
  };
  wallSeg(-594, -405, -594, -608);
  wallSeg(-594, -608, -251.2, -608);
  // the gate in the backstage lot's west wall
  data.static.forEach((p, i) => {
    const wall = Math.abs(p[4] + 250) < 0.6 && Math.abs(p[6] + 552.5) < 0.6 && p[3] > 200;
    if (wall && !data.hidden.includes(i)) { p[19] = 0; data.hidden.push(i); }
  });
  wallSeg(-250, -700, -250, GATE.z0);
  wallSeg(-250, GATE.z1, -250, -405);
  const gz = (GATE.z0 + GATE.z1) / 2;
  for (const z of [GATE.z0 + 0.8, GATE.z1 - 0.8]) {
    box([1.6, 16, 1.6], [-250, G, z], DARK, 'Metal');
    for (let k = 0; k < 8; k++) add([1.7, 0.5, 1.7], [-250, G + 1 + k * 2, z], k % 2 ? HAZ : DARK, 'SmoothPlastic', { collide: 0 });
    neon([0.8, 0.8, 0.8], [-250, G + 16.5, z], RED, { shape: 3 });
  }
  add([1.4, 2.6, GATE.z1 - GATE.z0 + 1.6], [-250, G + 15, gz], DARK, 'Metal', { collide: 0 });
  sign([0.2, 2.2, GATE.z1 - GATE.z0 - 1], [-249.2, G + 15, gz], DARK, 'Right', [['SECTOR R  ·  RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  sign([0.2, 2.2, GATE.z1 - GATE.z0 - 1], [-250.8, G + 15, gz], DARK, 'Left', [['RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  // a sign on the back lot pointing the way
  box([0.3, 5, 0.3], [-232, G, -470], DARK, 'Metal', { collide: 0 });
  sign([5.4, 1.4, 0.2], [-232, G + 4.4, -470.2], RED, 'Front', [['<  RAVAGE  ·  SECTOR R', 0, 0, 1, 1, WHITE, 'GothamBold']]);
  sign([5.4, 1.4, 0.2], [-232, G + 4.4, -469.8], RED, 'Back', [['RAVAGE  ·  SECTOR R  >', 0, 0, 1, 1, WHITE, 'GothamBold']]);

  // ======== the track, made exact at the tilting piece
  const track = makeTrack(CIRCUIT, { rolls: [{ from: knot(-580, -502), to: knot(-579, -460), h: 1.3 }] });
  const iA = nearestSample(track, A), iH = nearestSample(track, HINGE), iD1 = nearestSample(track, D1);
  straighten(track, iA, iH, A, HINGE);
  straighten(track, iH, iD1, HINGE, D1);
  // the corner at the hinge is sharp: the sample there twice, flat (the end
  // of the piece) then pitched down (the top of the drop)
  track.pos.splice(iH * 3, 0, ...HINGE);
  track.tan.splice(iH * 3, 0, -1, 0, 0);
  track.up.splice(iH * 3, 0, 0, 1, 0);
  track.cum.splice(iH, 0, track.cum[iH]);
  track.times.splice(iH, 0, track.times[iH]);
  remeasure(track);
  const s0 = track.cum[iA], sH = track.cum[iH];
  // the pods stop on the piece: hold the train there while it tips
  const sStop = sH - STOP;
  let iS = track.cum.findIndex((c) => c >= sStop);
  {
    // a sample exactly at the stop, then the same again, later
    const a = (sStop - track.cum[iS - 1]) / (track.cum[iS] - track.cum[iS - 1]);
    const lerp3 = (arr) => [0, 1, 2].map((k) => arr[(iS - 1) * 3 + k] + (arr[iS * 3 + k] - arr[(iS - 1) * 3 + k]) * a);
    const t = track.times[iS - 1] + (track.times[iS] - track.times[iS - 1]) * a;
    const p = lerp3(track.pos), tn = lerp3(track.tan), u = lerp3(track.up);
    const hold = HOLD[0] + HOLD[1] + HOLD[2];
    for (let i = iS; i < track.times.length; i++) track.times[i] += hold;
    track.pos.splice(iS * 3, 0, ...p, ...p);
    track.tan.splice(iS * 3, 0, ...tn, ...tn);
    track.up.splice(iS * 3, 0, ...u, ...u);
    track.cum.splice(iS, 0, sStop, sStop);
    track.times.splice(iS, 0, t, t + hold);
    // let go, the train falls: from the stop to the bottom of the drop the
    // speed comes from the height it has fallen (the piece tipped)
    const yStop = HINGE[1] + STOP * Math.sin(TILT), sHi = track.cum[iS] + STOP;
    const oldT = track.times.slice();
    let vPrev = 1;
    for (let i = iS + 2; i < track.times.length; i++) {
      const c = track.cum[i], y = c <= sHi ? HINGE[1] + (sHi - c) * Math.sin(TILT) : track.pos[i * 3 + 1];
      if (c > sHi && (y < 2.2 || track.pos[i * 3] < -522)) {
        for (let j = i; j < track.times.length; j++) track.times[j] = track.times[j - 1] + (oldT[j] - oldT[j - 1]);
        break;
      }
      const v = Math.sqrt(1 + 2 * 9.8 * Math.max(0, yStop - y));
      track.times[i] = track.times[i - 1] + (c - track.cum[i - 1]) / ((v + vPrev) / 2);
      vPrev = v;
    }
  }
  const tArrive = track.times[iS];
  const sampler = new Sampler(track);
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3();
  // when the last pod is off the piece
  const tAt = (s) => {
    for (let i = 1; i < track.cum.length; i++) if (track.cum[i] >= s) return track.times[i - 1] + (track.times[i] - track.times[i - 1]) * ((s - track.cum[i - 1]) / Math.max(1e-6, track.cum[i] - track.cum[i - 1]));
    return track.times[track.times.length - 1];
  };
  const tClear = tAt(sH + (CARS - 1) * SPACING + 3);
  const axis = new THREE.Vector3(-1, 0, 0).cross(new THREE.Vector3(...DROP)).normalize();
  const tilt = {
    name: 'TiltPiece', s0, s1: sH, pivot: HINGE.slice(), axis: [axis.x, axis.y, axis.z], angle: TILT,
    t0: tArrive + HOLD[0], t1: tArrive + HOLD[0] + HOLD[1], t2: Math.max(tClear + 1.5, tArrive + HOLD[0] + HOLD[1] + HOLD[2] + 2), t3: 0,
  };
  tilt.t3 = tilt.t2 + 5;

  // samples for clearances: the track, and the piece tipped all the way
  const samples = [];
  for (let s = 0; s < track.length; s += 0.75) { sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4); samples.push([P.x, P.y, P.z, s]); }
  for (let u = 0; u <= PIECE; u += 0.75) samples.push([HINGE[0] - DROP[0] * u, HINGE[1] - DROP[1] * u, ZL, sH - u]);
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
  const SN = (size, pos, color, o = {}) => S(size, pos, color, 'Neon', { collide: 0, ...o });

  // ======== the facility: a concrete block, hazard stripes, the Ravager
  // bursting out of its east wall
  const T = 1.2, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const wallX = (x, za, zb, h = B.H, color = CONC, base = G) => { if (zb - za > 0.1) box([T, h, zb - za], [x, base, (za + zb) / 2], color, 'Concrete'); };
  const wallZ = (z, xa, xb, h = B.H, color = CONC, base = G) => { if (xb - xa > 0.1) box([xb - xa, h, T], [(xa + xb) / 2, base, z], color, 'Concrete'); };
  const EDOOR = -592, NDOOR = -387; // the line's door (east wall) and the exit (north wall)
  const PORTALS = [ZL, -504]; // where the track goes out and comes back in (west wall)
  // east wall, the line's door in it
  wallX(B.x1 - T / 2, B.z0, EDOOR - 3);
  wallX(B.x1 - T / 2, EDOOR + 3, B.z1);
  wallX(B.x1 - T / 2, EDOOR - 3, EDOOR + 3, B.H - 6, CONC, G + 6);
  // north wall, the exit door in it
  wallZ(B.z1 - T / 2, B.x0, NDOOR - 3);
  wallZ(B.z1 - T / 2, NDOOR + 3, B.x1);
  wallZ(B.z1 - T / 2, NDOOR - 3, NDOOR + 3, B.H - 6, CONC, G + 6);
  wallZ(B.z0 + T / 2, B.x0, B.x1);
  // west wall: two portals for the track
  {
    let z = B.z0;
    for (const pz of PORTALS.slice().sort((a, b) => a - b)) {
      wallX(B.x0 + T / 2, z, pz - 4.8);
      wallX(B.x0 + T / 2, pz - 4.8, pz + 4.8, B.H - 9.5, CONC, G + 9.5);
      z = pz + 4.8;
    }
    wallX(B.x0 + T / 2, z, B.z1);
  }
  add([B.x1 - B.x0 + 1.6, 1.2, B.z1 - B.z0 + 1.6], [cx, G + B.H + 0.6, cz], 0x6e706c, 'Concrete', { collide: 0 });
  // hazard stripes round the base, a band of red at the top
  for (const [w, d, x, z] of [[B.x1 - B.x0, 0.2, cx, B.z0 - 0.1], [B.x1 - B.x0, 0.2, cx, B.z1 + 0.1], [0.2, B.z1 - B.z0, B.x0 - 0.1, cz], [0.2, B.z1 - B.z0, B.x1 + 0.1, cz]]) {
    add([w, 0.5, d], [x, G + B.H - 1.2, z], RED, 'SmoothPlastic', { collide: 0 });
  }
  for (let z = B.z0 + 2; z < B.z1 - 1; z += 4) {
    if (Math.abs(z - EDOOR) < 4) continue;
    add([0.24, 1.2, 2], [B.x1 + 0.12, G + 0.6, z], HAZ, 'SmoothPlastic', { collide: 0 });
    add([0.24, 1.2, 2], [B.x1 + 0.12, G + 0.6, z + 2], DARK, 'SmoothPlastic', { collide: 0 });
  }
  sign([0.3, 2.4, 44], [B.x1 + 0.3, G + 12.6, -580], DARK, 'Right', [['BENTON BIODYNAMICS  ·  SECTOR R', 0, 0.05, 1, 0.55, WHITE, 'GothamBold'], ['CONTAINMENT FACILITY  ·  AUTHORIZED PERSONNEL ONLY', 0, 0.62, 1, 0.33, HAZ, 'GothamBold']]);
  // the big logo: RAVAGE torn through by three claw slashes
  sign([0.4, 6, 30], [B.x1 + 0.4, G + 8.6, -520], DARK, 'Right', [['RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  for (let k = 0; k < 3; k++) neon([0.3, 0.5, 13], [B.x1 + 0.7, G + 8.6 + (k - 1) * 1.6, -520], 0xff3020, { rot: [1, 0, 0, 0, Math.cos(0.45), -Math.sin(0.45), 0, Math.sin(0.45), Math.cos(0.45)] });
  // warning beacons on the corners of the roof
  for (const [x, z] of [[B.x0, B.z0], [B.x0, B.z1], [B.x1, B.z0], [B.x1, B.z1]]) {
    box([0.8, 1.2, 0.8], [x + Math.sign(cx - x) * 1.2, G + B.H + 1.2, z + Math.sign(cz - z) * 1.2], DARK, 'Metal', { collide: 0 });
    neon([1.1, 0.9, 1.1], [x + Math.sign(cx - x) * 1.2, G + B.H + 2.8, z + Math.sign(cz - z) * 1.2], RED, { shape: 3 });
  }
  // the breach: the Ravager's head and claws bursting out of the east wall
  // over the line, with the broken concrete falling away
  const breach = [B.x1 + 1, G + 9, -556];
  place(ravager(pp, 1.25, { open: 0.6, tail: false }).filter((q) => q[6] < 2.5 * 1.25), [breach[0] - 6, breach[1] - 3, breach[2]], -Math.PI / 2);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    add([1.2 + (k % 3) * 0.6, 1 + (k % 2) * 0.8, 1.4], [B.x1 + 0.4, breach[1] + 4 + Math.sin(a) * 6, breach[2] + Math.cos(a) * 8], 0x6a6c66, 'Concrete', { collide: 0, shape: 1, rot: RX(a) });
  }
  for (const [dx, dz] of [[3, -4], [5, 2], [2.4, 6], [6, -1], [4, 9]]) add([1.6, 1, 1.8], [B.x1 + dx, G + 0.5, breach[2] + dz], 0x6a6c66, 'Concrete', { shape: 1, collide: 0, rot: [Math.cos(dz), 0, Math.sin(dz), 0, 1, 0, -Math.sin(dz), 0, Math.cos(dz)] });
  for (let k = 0; k < 3; k++) neon([0.3, 7, 0.5], [B.x1 + 0.3, G + 6, -565 + k * 1.6], 0xff3020, { rot: RX(0.35) });

  // ======== the walk in, the plaza and the checkpoint
  const PLAZA = { x0: -282, x1: -251.2, z0: -494, z1: -466 };
  add([PLAZA.x1 - PLAZA.x0, 0.2, PLAZA.z1 - PLAZA.z0], [(PLAZA.x0 + PLAZA.x1) / 2, G + 0.1, (PLAZA.z0 + PLAZA.z1) / 2], 0x8a8a84, 'Concrete', { collide: 0 });
  for (let x = PLAZA.x0 + 2; x < PLAZA.x1; x += 4) add([2, 0.04, 0.6], [x, G + 0.22, gz], HAZ, 'SmoothPlastic', { collide: 0 });
  // the checkpoint: concrete pylons, a raised boom, the guard booth
  const CPX = -272;
  for (const z of [-486, -474]) {
    box([2, 9, 2], [CPX, G, z], CONC, 'Concrete');
    for (let k = 0; k < 4; k++) add([2.1, 0.6, 2.1], [CPX, G + 1 + k * 1.2, z], k % 2 ? DARK : HAZ, 'SmoothPlastic', { collide: 0 });
    neon([0.7, 0.7, 0.7], [CPX, G + 9.5, z], RED, { shape: 3 });
  }
  add([2.4, 2.4, 14], [CPX, G + 10, -480], DARK, 'Metal', { collide: 0 });
  sign([0.2, 2, 12], [CPX + 1.3, G + 10, -480], DARK, 'Right', [['RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  sign([0.2, 1, 10], [CPX + 1.3, G + 8.3, -480], HAZ, 'Right', [['CHECKPOINT  ·  STAND-BY LINE', 0, 0, 1, 1, DARK, 'GothamBold']]);
  add([0.3, 0.3, 9], [CPX + 1.6, G + 4.6, -481.4], WHITE, 'SmoothPlastic', { collide: 0, rot: RX(-1.3) });
  box([3, 3.2, 3], [-262, G, -490], 0xd8d8d0, 'Concrete');
  add([3.2, 0.3, 3.2], [-262, G + 3.35, -490], DARK, 'Metal', { collide: 0 });
  add([3.05, 1, 0.1], [-262, G + 2.2, -488.48], 0x2a4a6a, 'Glass', { trans: 0.4, collide: 0 });
  const waitPart = add([7, 1.6, 0.4], [CPX + 1.5, G + 6.2, -480], 0x101624, 'SmoothPlastic', { collide: 0, yaw: Math.PI / 2 });
  data.dynamicSigns.push({ part: waitPart, kind: 'wait', face: 'Front', ride: RIDE_ID });
  // floodlights on the plaza
  for (const [x, z] of [[-256, -470], [-256, -492], [-278, -468]]) {
    box([0.5, 10, 0.5], [x, G, z], DARK, 'Metal');
    add([1.6, 1, 1.2], [x, G + 10.2, z], 0xfff2d0, 'Neon', { collide: 0 });
    data.tags.ParkLamp.push([x, G + 10.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 171, cf: cf(-262, G, -485, -Math.PI / 2) });

  // ======== the outdoor line: two fields of switchbacks
  const RAIL = 0x3a3c40;
  const railX = (xa, xb, z) => {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [xa + ((xb - xa) * k) / n, G, z], RAIL, 'Metal');
    add([xb - xa, 0.12, 0.12], [(xa + xb) / 2, G + 1.1, z], HAZ, 'Metal', { collide: 0 });
    add([xb - xa, 0.08, 0.08], [(xa + xb) / 2, G + 0.6, z], RAIL, 'Metal', { collide: 0 });
  };
  const railZ = (za, zb, x) => {
    const n = Math.max(1, Math.round((zb - za) / 4));
    for (let k = 0; k <= n; k++) box([0.22, 1.2, 0.22], [x, G, za + ((zb - za) * k) / n], RAIL, 'Metal');
    add([0.12, 0.12, zb - za], [x, G + 1.1, (za + zb) / 2], HAZ, 'Metal', { collide: 0 });
    add([0.08, 0.08, zb - za], [x, G + 0.6, (za + zb) / 2], RAIL, 'Metal', { collide: 0 });
  };
  // the north field: 11 rows
  const NW = -334, NE = -290, NROWS = 11, nz = (k) => -438 - 5 * k;
  const LANE = -339; // down the side of the facility to the south field
  railX(NW - 3, NE + 3, nz(0) + 2.5);
  for (let k = 0; k < NROWS - 1; k++) {
    if (k % 2 === 0) railX(NW + 3, NE + 3, nz(k) - 2.5); // turn at the west end
    else railX(NW - 3, NE - 3, nz(k) - 2.5);
  }
  railX(NW + 3, NE + 3, nz(NROWS - 1) - 2.5);
  railZ(nz(NROWS - 1) - 2.5, nz(0) - 2.5, NE + 3);
  railZ(nz(NROWS - 1) + 2.5, nz(0) + 2.5, NW - 3);
  railZ(-476, nz(0) + 2.5, NE + 9); // the way in, up the east side
  // the south field: 8 rows
  const SW = -334, SE = -270, SROWS = 8, sz = (k) => -546 - 5 * k;
  railX(SW - 3, SE + 3, sz(0) + 2.5);
  for (let k = 0; k < SROWS - 1; k++) {
    if (k % 2 === 0) railX(SW - 3, SE - 3, sz(k) - 2.5); // turn at the east end
    else railX(SW + 3, SE + 3, sz(k) - 2.5);
  }
  railX(SW - 3 + 0.5, SE + 3, sz(SROWS - 1) - 2.5);
  railZ(sz(SROWS - 1) - 2.5, sz(0) + 2.5, SE + 3);
  railZ(sz(SROWS - 2) - 2.5, sz(0) - 2.5, SW - 3);
  railZ(sz(0) + 2.5, nz(NROWS - 1) - 2.5, LANE + 2.6); // along the lane between the fields
  // camouflage shades over parts of the line, misting fans
  for (const [x0, x1, z0, z1] of [[-330, -296, -470, -440], [-330, -280, -584, -556]]) {
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box([0.4, 5, 0.4], [x, G, z], RAIL, 'Metal', { collide: 0 });
    add([x1 - x0 + 1, 0.2, z1 - z0 + 1], [(x0 + x1) / 2, G + 5.1, (z0 + z1) / 2], 0x4a5a3a, 'Fabric', { collide: 0 });
    for (let x = x0 + 4; x < x1; x += 8) add([0.6, 0.6, 0.6], [x, G + 4.6, (z0 + z1) / 2], STEEL, 'Metal', { collide: 0, shape: 3 });
  }
  // floodlight towers and sirens
  for (const [x, z] of [[-337, -436], [-268, -436], [-337, -540], [-268, -540], [-268, -588]]) {
    box([0.7, 14, 0.7], [x, G, z], DARK, 'Metal', { collide: 0 });
    add([3, 1.6, 0.6], [x, G + 14, z], DARK, 'Metal', { collide: 0 });
    for (const dx of [-0.9, 0.9]) add([1, 1, 0.3], [x + dx, G + 14, z + 0.4], 0xfff4dc, 'Neon', { collide: 0 });
    neon([0.6, 0.8, 0.6], [x, G + 15.4, z], RED, { shape: 3 });
    data.tags.Searchlight.push([x, G + 15, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  // the middle: quarantine tents, the wrecked specimen truck, barrels, signs
  for (const [x, z] of [[-322, -500], [-306, -500]]) {
    add([10, 4, 7], [x, G + 2, z - 4], 0xe8e8e2, 'Fabric', { collide: 0, shape: 1, rot: RZ(0) });
    add([10, 4, 7], [x, G + 2, z - 4 - 7], 0xe8e8e2, 'Fabric', { collide: 0, shape: 1, rot: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
    add([0.2, 1.2, 3], [x - 5.1, G + 1.4, z - 7.5], RED, 'SmoothPlastic', { collide: 0 });
  }
  sign([10, 1.6, 0.2], [-314, G + 5.6, -496.9], WHITE, 'Back', [['QUARANTINE', 0, 0, 1, 1, RED, 'GothamBold']]);
  // the truck: a cab and a container torn open from the inside
  const TR = [-290, -520];
  box([5, 3.6, 4], [TR[0] + 9, G + 0.8, TR[1]], 0xd8d8d0, 'SmoothPlastic', { collide: 0 });
  add([0.1, 1.4, 3.6], [TR[0] + 11.55, G + 3.4, TR[1]], 0x2a3a4a, 'Glass', { collide: 0, trans: 0.3 });
  box([14, 4.4, 4.2], [TR[0] - 1, G + 1, TR[1]], 0xe8e8e2, 'Metal', { collide: 0, rot: RZ(0.06) });
  for (const x of [TR[0] - 6, TR[0] - 3, TR[0] + 4, TR[0] + 9]) for (const dz of [-2, 2]) add([1.8, 1.8, 0.8], [x, G + 0.9, TR[1] + dz], 0x1a1a1a, 'Rubber', { collide: 0, shape: 2, rot: ALONG_Z });
  sign([12, 1.6, 0.2], [TR[0] - 1, G + 4.2, TR[1] + 2.15], 0xe8e8e2, 'Back', [['BENTON BIODYNAMICS  ·  SPECIMEN TRANSPORT', 0, 0, 1, 1, RED, 'GothamBold']]);
  for (let k = 0; k < 3; k++) neon([0.3, 3.6, 0.6], [TR[0] - 2 + k * 1.4, G + 3.4, TR[1] + 2.2], 0xff3020, { rot: RZ(0.4) });
  add([0.3, 3, 2], [TR[0] - 8.2, G + 3, TR[1] - 2.6], 0xe8e8e2, 'Metal', { collide: 0, rot: [Math.cos(0.9), 0, Math.sin(0.9), 0, 1, 0, -Math.sin(0.9), 0, Math.cos(0.9)] });
  for (const [x, z, tip] of [[-300, -528, 0], [-298, -530, 1.4], [-276, -512, 0], [-274, -514, 1.5], [-312, -536, 0]]) {
    add([1.2, 1.6, 1.2], [x, G + (tip ? 0.6 : 0.8), z], 0x3a6a2a, 'Metal', { shape: 5, collide: 0, rot: tip ? RZ(tip) : undefined });
    neon([1.0, 0.1, 1.0], [x, G + (tip ? 0.4 : 1.62), z], GREEN, { shape: 5 });
  }
  data.tags.SteamVent.push([-298, G + 0.6, -530, 1, 0, 0, 0, 1, 0, 0, 0, 1], [-274, G + 0.6, -514, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  [['DANGER  ·  BIOHAZARD', HAZ, DARK, [-300, -437]], ['DO NOT APPROACH THE SPECIMEN', RED, WHITE, [-320, -437]], ['SECTOR R  ·  LOCKDOWN', DARK, RED, [-300, -543.5]], ['CONTAINMENT STATUS: FAILING', DARK, HAZ, [-320, -543.5]]].forEach(([text, bg, fg, [x, z]]) => {
    box([0.2, 3.2, 0.2], [x - 2.6, G, z], RAIL, 'Metal', { collide: 0 });
    box([0.2, 3.2, 0.2], [x + 2.6, G, z], RAIL, 'Metal', { collide: 0 });
    sign([5.6, 1.4, 0.15], [x, G + 2.6, z], bg, z > -500 ? 'Front' : 'Back', [[text, 0, 0, 1, 1, fg, 'GothamBold']]);
  });
  // ======== inside: the lab corridors, decontamination, the briefing room
  const Q = { x0: -380, x1: B.x1 - T }; // the line's half of the building
  const LAB = 0xd8dcd8, LABD = 0x9aa09c;
  // its west wall: a door to the dock, windows into the specimen hold
  const PSDOOR = -490;
  wallX(Q.x0 - 0.3, B.z0 + T, PSDOOR - 2);
  wallX(Q.x0 - 0.3, PSDOOR + 2, B.z1 - T);
  wallX(Q.x0 - 0.3, PSDOOR - 2, PSDOOR + 2, B.H - 5.4, CONC, G + 5.4);
  for (const z of [-594, -578, -562, -546]) add([0.3, 3, 7], [Q.x0 - 1, G + 3.5, z], 0x2a4a3a, 'Glass', { trans: 0.55, collide: 0 });
  // the corridors: lab walls between the rows, with gaps at alternate ends
  const IQ = { xW: -376, xE: -350, rows: 9, z: (k) => -592 + 7 * k };
  for (let k = 0; k < IQ.rows - 1; k++) {
    const z = IQ.z(k) + 3.5;
    if (k % 2 === 0) wallZ(z, Q.x0 + 7, Q.x1, 6, LAB, G); // heading west: the gap at the west end
    else wallZ(z, Q.x0, Q.x1 - 7, 6, LAB, G);
  }
  wallZ(-532.5 + 9, Q.x0, Q.x1 - 7, 6, LAB, G); // decon: in at the west, out at the east ...
  wallZ(-506, Q.x0, -372, B.H - 4, LABD, G); // ... and the briefing room's south wall, its door at the west
  wallZ(-506, -368, Q.x1, B.H - 4, LABD, G);
  // lab ceiling lights, red emergency lights, monitors, claw marks
  for (let k = 0; k < IQ.rows; k++) {
    const z = IQ.z(k);
    add([20, 0.2, 0.6], [-363, G + 5.8, z], 0xe8f4ff, 'Neon', { collide: 0 });
    if (k % 3 === 1) { neon([0.5, 0.5, 0.5], [Q.x1 - 0.4, G + 4.6, z], RED, { shape: 3 }); light(-363, 5, z, 0xff2020); }
    if (k % 2 === 0) sign([0.15, 1.6, 2.6], [Q.x1 - 0.2, G + 2.8, z], 0x0a1a10, 'Left', [[['SPECIMEN R', 'HEART RATE 214', 'CONTAINMENT 31%', 'MOTION DETECTED', 'LOCKDOWN'][k / 2], 0, 0, 1, 1, GREEN, 'GothamBold']], { glow: true });
  }
  for (let k = 0; k < 3; k++) neon([0.2, 4, 0.4], [Q.x1 - 0.25, G + 3, -562 + k * 1.2], 0xff3020, { rot: RX(0.4) });
  light(-363, 5, -578, 0xff3020);
  // decontamination: steam, amber lights, a shower arch
  for (const z of [-528, -516]) {
    box([0.6, 4.6, 0.6], [-362, G, z - 2.6], LABD, 'Metal', { collide: 0 });
    box([0.6, 4.6, 0.6], [-362, G, z + 2.6], LABD, 'Metal', { collide: 0 });
    add([0.8, 0.6, 5.8], [-362, G + 4.9, z], LABD, 'Metal', { collide: 0 });
    neon([0.9, 0.2, 5], [-362, G + 4.5, z], AMBER);
    data.tags.SteamVent.push([-362, G + 4.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  sign([0.15, 1.6, 8], [Q.x1 - 0.2, G + 4, -522], AMBER, 'Left', [['DECONTAMINATION', 0, 0, 1, 1, DARK, 'GothamBold']]);
  light(-362, 5, -522, AMBER);
  // the briefing room: a screen on the east wall, the specimen tank, beacons
  const PS = { z0: -506, z1: B.z1 - T };
  sign([0.3, 7, 18], [Q.x1 - 0.2, G + 6.5, -486], 0x0a0c10, 'Left', [['CONTAINMENT BRIEFING', 0, 0.04, 1, 0.2, WHITE, 'GothamBold'], ['SPECIMEN R  ·  "THE RAVAGER"', 0, 0.28, 1, 0.24, RED], ['CONTAINMENT FAILING  ·  EVACUATE BY TRANSPORT POD', 0, 0.58, 1, 0.16, HAZ, 'GothamBold'], ['HOLD ON.  DO NOT LOOK DOWN.', 0, 0.8, 1, 0.14, WHITE, 'GothamBold']], { glow: true });
  box([2, 1.2, 1.4], [-352, G, -486], DARK, 'Metal', { collide: 0 });
  data.staffSpots.push({ role: 'greeter', kind: 'idle', land: 'Backwoods', seed: 173, cf: cf(-350, G, -486, Math.PI / 2) });
  // the tank: a juvenile Ravager floating in green
  const tank = [-372, -474];
  box([7, 1, 7], [tank[0], G, tank[1]], DARK, 'Metal');
  add([6, 10, 6], [tank[0], G + 6, tank[1]], 0x2aff6a, 'Glass', { shape: 5, trans: 0.6, collide: 1 });
  add([7, 1, 7], [tank[0], G + 11.5, tank[1]], DARK, 'Metal', { collide: 0 });
  place(ravager(pp, 0.3), [tank[0], G + 3, tank[1]], 0.6);
  neon([5.6, 0.2, 5.6], [tank[0], G + 1.2, tank[1]], GREEN, { shape: 5 });
  light(tank[0], 6, tank[1], 0x40ff60);
  for (const [x, z] of [[-347, -468], [-378, -504], [-347, -504]]) neon([0.7, 0.7, 0.7], [x, G + 9, z], RED, { shape: 3 });
  light(-360, 9, -490, 0xff2020);

  // ======== the line's path (from the checkpoint to the pod dock)
  const fwd = [[-262, -480], [CPX, -480], [NE + 6, -480], [NE + 6, nz(0)]];
  for (let k = 0; k < NROWS; k++) {
    const west = k % 2 === 0;
    fwd.push([west ? NW : NE, nz(k)]);
    if (k < NROWS - 1) fwd.push([west ? NW : NE, nz(k + 1)]);
  }
  fwd.push([LANE, nz(NROWS - 1)], [LANE, sz(0)]);
  for (let k = 0; k < SROWS; k++) {
    const east = k % 2 === 0;
    fwd.push([east ? SE : SW, sz(k)]);
    if (k < SROWS - 1) fwd.push([east ? SE : SW, sz(k + 1)]);
  }
  fwd.push([LANE, sz(SROWS - 1)], [LANE, EDOOR], [Q.x1 - 2, EDOOR]);
  // the corridors
  for (let k = 0; k < IQ.rows; k++) {
    const west = k % 2 === 0;
    if (k > 0) fwd.push([west ? IQ.xE : IQ.xW, IQ.z(k)]);
    fwd.push([west ? IQ.xW : IQ.xE, IQ.z(k)]);
  }
  fwd.push([IQ.xW, -528], [IQ.xE, -528], [IQ.xE, -516], [IQ.xW + 6, -516], [-370, -506], [-370, -500], [-352, -500], [-352, -494], [-376, -494], [-376, PSDOOR], [-384, PSDOOR], [-390.2, -494]);
  const pathPts = [...fwd].reverse();
  const qpath = queuePath(pathPts, pathPts.length - 2, [1, 0], G);
  // the exit: out of the north wall and round the north field to the plaza
  const exitPath = [[NDOOR, -486], [NDOOR, B.z1 - 4], [NDOOR, -431], [-279, -431], [-279, PLAZA.z0 + 6]];
  for (let i = 0; i + 1 < exitPath.length; i++) {
    const [a, b] = [exitPath[i], exitPath[i + 1]];
    if (i === 0) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    add([3.6, 0.2, len + 3.6], [(a[0] + b[0]) / 2, G + 0.1, (a[1] + b[1]) / 2], 0x7a7a74, 'Concrete', { yaw, collide: 0 });
  }
  sign([5, 1.4, 0.2], [NDOOR, G + 7.2, B.z1 + 0.15], 0x1a8a3a, 'Back', [['EXIT', 0, 0, 1, 1, WHITE, 'GothamBold']], { glow: true });

  // ======== the dock and its exit corridor
  add([12.8, 0.3, 20], [-387, G + 0.15, -496], 0x3a3c40, 'DiamondPlate', { collide: 0 });
  add([0.5, 0.1, 20], [-393.1, G + 0.32, -496], HAZ, 'SmoothPlastic', { collide: 0 });
  wallX(-391.4, -486, B.z1 - T, 6, LABD, G);
  sign([0.3, 2.6, 14], [Q.x0 - 0.65, G + 9, -496], DARK, 'Left', [['POD DOCK', 0, 0.02, 1, 0.6, RED], ['SECTOR R  ·  EMERGENCY TRANSPORT', 0, 0.62, 1, 0.36, HAZ, 'GothamBold']], { glow: true });
  const con = [-386, -505];
  box([2.4, 1.2, 1.4], [con[0], G + 0.3, con[1]], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) add([0.3, 0.2, 0.3], [con[0] - 0.6 + k * 0.6, G + 1.6, con[1]], [0x40d060, 0xf0c040, 0xe03030][k], 'Neon', { collide: 0, shape: 3 });
  light(-388, 8, -496, 0xffe0d0);
  // brake fins on the way into the dock
  for (let s = -26; s < -10; s += 1.5) {
    sampler.matrixAt(s, m4); P.setFromMatrixPosition(m4);
    add([0.12, 0.6, 1.2], [P.x, P.y - 0.9, P.z], 0xc8c8c8, 'Metal', { collide: 0 });
  }

  // ======== the specimen hold (going out) and the lair (coming home)
  wallZ(-510, B.x0 + T, -400, B.H, CONC, G);
  // tanks: glass cylinders lit green, one smashed open
  const tanks = [[-388, -520], [-388, -532], [-410, -530], [-422, -530], [-434, -530], [-408, -566], [-420, -566], [-432, -566], [-410, -590], [-430, -590]];
  tanks.forEach(([x, z], k) => {
    if (!clearOf([5, 9, 5], [x, G + 4.5, z])) return;
    box([5, 0.8, 5], [x, G, z], DARK, 'Metal', { collide: 0 });
    add([4.4, 0.8, 4.4], [x, G + 8.8, z], DARK, 'Metal', { collide: 0, shape: 5 });
    if (k === 6) {
      // smashed: jagged glass, the fluid on the floor, claw marks
      for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2; add([0.2, 1.4 + (j % 3), 1.4], [x + Math.cos(a) * 2, G + 1.6, z + Math.sin(a) * 2], 0x2aff6a, 'Glass', { trans: 0.5, collide: 0, shape: 1, rot: RZ(a) }); }
      neon([9, 0.06, 7], [x, G + 0.05, z], 0x2a8a3a, { shape: 5 });
    } else {
      add([4, 8, 4], [x, G + 4.8, z], 0x2aff6a, 'Glass', { shape: 5, trans: 0.65, collide: 0 });
      add([1.6, 3.2, 1.6], [x, G + 4.2, z], 0x1a2a1a, 'SmoothPlastic', { shape: 3, collide: 0 });
    }
    neon([3.6, 0.15, 3.6], [x, G + 0.85, z], GREEN, { shape: 5 });
  });
  light(-420, 7, -530, 0x30ff60);
  light(-420, 7, -580, 0x30ff60);
  light(-396, 8, -540, 0xff2020);
  // claw marks across the walls, sparking power panels, warnings
  for (const [x, z, face] of [[B.x0 + T + 0.2, -575, 'x'], [-430, B.z0 + T + 0.2, 'z'], [-420, -510.8, 'z']]) {
    for (let k = 0; k < 3; k++) {
      if (face === 'x') neon([0.3, 7, 0.6], [x, G + 6, z + k * 2], 0xff3020, { rot: RX(0.4) });
      else neon([0.6, 7, 0.3], [x + k * 2, G + 6, z], 0xff3020, { rot: RZ(0.4) });
    }
  }
  box([1.4, 3, 0.8], [-389, G, -538], 0x2e3238, 'Metal', { collide: 0 });
  for (let k = 0; k < 3; k++) neon([0.2, 0.2, 0.2], [-389, G + 2.4 - k * 0.6, -537.5], [0xffe060, 0xff6020, 0xffe060][k], { shape: 3 });
  sign([0.2, 2, 12], [B.x0 + T + 0.2, G + 10, -530], DARK, 'Right', [['CONTAINMENT BREACH', 0, 0, 1, 1, RED]], { glow: true });
  sign([16, 2, 0.2], [-424, G + 11, B.z0 + T + 0.2], DARK, 'Back', [['SPECIMEN HOLD  ·  SECTOR R', 0, 0, 1, 1, HAZ, 'GothamBold']], { glow: true });
  data.tags.SteamVent.push([-404, G + 0.5, -560, 1, 0, 0, 0, 1, 0, 0, 0, 1], [-440, G + 0.5, -540, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  // the lair: bones, a wrecked cage, the nest, and the Ravager itself
  for (const [x, z, a] of [[-440, -472, 0.3], [-426, -470, 1.2], [-404, -500, 2], [-438, -492, 2.6], [-430, -496, 0.8]]) {
    if (!clearOf([3, 1, 3], [x, G + 0.5, z])) continue;
    add([2.4, 0.4, 0.4], [x, G + 0.3, z], BONE, 'SmoothPlastic', { collide: 0, rot: [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)] });
    add([0.8, 0.7, 0.8], [x + 0.9, G + 0.4, z + 0.6], BONE, 'SmoothPlastic', { collide: 0, shape: 3 });
  }
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; if (clearOf([4, 1, 4], [-404 + Math.cos(a) * 4, G + 0.5, -496 + Math.sin(a) * 4])) add([4, 0.8, 1.2], [-404 + Math.cos(a) * 4, G + 0.5, -496 + Math.sin(a) * 4], 0x4a3a2a, 'Wood', { collide: 0, rot: [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)] }); }
  light(-428, 6, -484, 0xff1a10);
  light(-440, 8, -470, 0xff1a10);
  data.tags.SteamVent.push([-438, G + 0.5, -482, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const extras = {}, extrasNames = [], props = [];
  const LAIR = [-436, G, -478], LUNGE = [0.707, -0.707];
  extras.Ravager = { pivot: [...LAIR, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: ravager(pp, 1) };
  props.push({ name: 'Ravager', at: LAIR, kind: 'lunge', dir: LUNGE, reach: 4, period: 4.2 });
  extrasNames.push('Ravager');

  // ======== outside: the tilt tower, the lift, the field
  const TW = 0x3a3c42; // tower steel
  const hx = HINGE[0], hy = HINGE[1];
  // four legs, braced, the top kept clear of the piece as it tips
  const TOP = 30.4;
  for (const x of [hx + 2.4, hx + 7.4]) for (const z of [ZL - 4.4, ZL + 4.4]) box([0.9, TOP - G, 0.9], [x, G, z], TW, 'Metal');
  for (const x of [hx + 2.4, hx + 7.4]) add([0.7, 0.9, 9.7], [x, TOP - 0.45, ZL], TW, 'Metal', { collide: 0 });
  for (const z of [ZL - 4.4, ZL + 4.4]) {
    add([5.9, 0.6, 0.6], [hx + 4.9, TOP - 0.45, z], TW, 'Metal', { collide: 0 });
    for (let y = 2; y < TOP - 4; y += 7) {
      const len = Math.hypot(5, 7), a = Math.atan2(7, 5);
      add([len, 0.35, 0.35], [hx + 4.9, y + 3.5, z], TW, 'Metal', { collide: 0, rot: RZ(a) });
      add([len, 0.35, 0.35], [hx + 4.9, y + 3.5, z], TW, 'Metal', { collide: 0, rot: RZ(-a) });
      add([5.9, 0.35, 0.35], [hx + 4.9, y, z], TW, 'Metal', { collide: 0 });
    }
  }
  // the hinge bearings, out past the pods' sides
  for (const z of [ZL - 2.6, ZL + 2.6]) {
    add([2.6, 0.7, 0.7], [hx + 1.1, TOP - 0.1, z], TW, 'Metal', { collide: 0 });
    add([0.7, hy - 0.2 - TOP, 0.7], [hx + 0.1, (TOP + hy - 0.2) / 2, z], TW, 'Metal', { collide: 0 });
  }
  // the rest the piece's back end sits on, and a stair up the tower
  add([1.2, A[1] - 3.3 - G, 1.2], [hx + 10, (A[1] - 3.3 + G) / 2, ZL], TW, 'Metal', { collide: 0 });
  add([2.2, 0.4, 2.2], [hx + 10, A[1] - 3.1, ZL], HAZ, 'Metal', { collide: 0 });
  for (let k = 0; k < 14; k++) add([1.6, 0.15, 1], [hx + 6 - (k % 2) * 3, 2 + k * 2, ZL + 6.2], STEEL, 'DiamondPlate', { collide: 0 });
  // red beacons on the top, the logo on its side
  for (const z of [ZL - 4.4, ZL + 4.4]) neon([0.8, 0.8, 0.8], [hx + 7.4, TOP + 0.6, z], RED, { shape: 3 });
  sign([10, 3, 0.3], [hx + 4.9, 20, ZL - 4.9], DARK, 'Front', [['RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  sign([10, 3, 0.3], [hx + 4.9, 20, ZL + 4.9], DARK, 'Back', [['RAVAGE', 0, 0, 1, 1, RED]], { glow: true });
  // the tilting piece: rails, spine, ties and its frame, pivoted at the hinge
  const piece = [];
  const L = PIECE;
  for (const z of [-1.6, 1.6]) piece.push(pp(2, [L, 0.72, 0.72], [L / 2, -0.25, z], TRACK_COLOR, 'Metal'));
  piece.push(pp(2, [L, 1.24, 1.24], [L / 2, -1.4, 0], TRACK_COLOR, 'Metal'));
  for (let x = 0.4; x < L; x += 2) {
    piece.push(pp(0, [0.42, 0.28, 3.5], [x, -0.55, 0], TRACK_COLOR, 'Metal'));
    for (const z of [-0.8, 0.8]) piece.push(pp(0, [0.3, 1.2, 0.28], [x, -0.95, z], STEEL, 'Metal'));
  }
  piece.push(pp(0, [L - 0.6, 1.0, 1.2], [L / 2 + 0.3, -2.4, 0], DARK, 'Metal'));
  for (let x = 1; x < L; x += 2.2) piece.push(pp(0, [0.2, 0.8, 1.3], [x, -2.4, 0], HAZ, 'SmoothPlastic'));
  piece.push(pp(0, [0.4, 0.4, 3.8], [0.1, -0.55, 0], HAZ, 'SmoothPlastic'));
  for (const z of [-2.6, 2.6]) piece.push(pp(2, [1.2, 0.9, 0.9], [0, -0.3, z], 0x9a9ea6, 'Metal', ALONG_Z));
  for (const z of [-2, 2]) piece.push(pp(0, [0.5, 0.5, 0.3], [L - 0.4, -0.2, z], RED, 'Neon'));
  extras[tilt.name] = { pivot: [...HINGE, 1, 0, 0, 0, 1, 0, 0, 0, 1], parts: piece };
  extrasNames.push(tilt.name);
  // lights on the tower for the drop
  for (const z of [ZL - 4.4, ZL + 4.4]) for (let y = 6; y < TOP; y += 8) neon([0.4, 0.4, 0.4], [hx + 2.4 - 0.5, y, z], RED, { shape: 3 });
  data.tags.Searchlight.push([hx + 4.9, TOP + 1, ZL, 1, 0, 0, 0, 1, 0, 0, 0, 1]);

  // supports: from the ground up under the spine (never in the building or
  // under the tilting piece and the drop)
  let supports = 0;
  const sD2 = track.cum[nearestSample(track, D2)];
  for (let s = 4; s < track.length - 4; s += 6) {
    if (s > s0 - 3 && s < sD2 + 4) continue;
    sampler.matrixAt(s, m4);
    P.setFromMatrixPosition(m4);
    U.setFromMatrixColumn(m4, 1);
    if (U.y < 0.55) continue;
    const foot = P.clone().addScaledVector(U, -1.7);
    if (foot.y < 2.4) continue;
    if (inRect(foot.x, foot.z, B, 1)) continue;
    if (near(foot.x, foot.z).some(([x, y, z, c]) => Math.abs(c - s) > 10 && y < foot.y + 3 && Math.hypot(x - foot.x, z - foot.z) < 4.4)) continue;
    add([1, foot.y - G, 1], [foot.x, (foot.y + G) / 2, foot.z], 0x3a3c42, 'Metal', { shape: 5, collide: 0 });
    add([2, 0.6, 2], [foot.x, G + 0.3, foot.z], CONC, 'Concrete', { collide: 0 });
    supports++;
  }
  // the field: rocks, dead trees, broken fences, a crater where the drop lands
  for (const [x, z, r] of [[-560, -590, 5], [-588, -470, 4], [-540, -470, 6], [-520, -500, 4.5], [-488, -590, 5], [-545, -505, 3.5], [-500, -470, 3]]) {
    if (!clearOf([r * 2, r, r * 2], [x, G + r / 2, z], 5)) continue;
    add([r * 2, r * 1.3, r * 1.8], [x, G + r * 0.3, z], 0x6a665e, 'Slate', { shape: 3, collide: 1 });
  }
  for (const [x, z] of [[-586, -584], [-566, -456], [-530, -520], [-492, -478], [-470, -594], [-556, -486]]) {
    if (!clearOf([3, 12, 3], [x, G + 6, z], 4)) continue;
    box([0.6, 9, 0.6], [x, G, z], 0x3a3028, 'Wood', { collide: 0, rot: RZ(0.08) });
    add([4, 0.35, 0.35], [x + 1.2, G + 7, z], 0x3a3028, 'Wood', { collide: 0, rot: RZ(0.6) });
    add([3, 0.3, 0.3], [x - 1, G + 5.4, z], 0x3a3028, 'Wood', { collide: 0, rot: RZ(-0.7) });
  }
  for (let k = 0; k < 10; k++) {
    const x = -575 + k * 9, z = -600;
    if (!clearOf([8, 3, 0.4], [x, G + 1.5, z])) continue;
    box([0.2, 3, 0.2], [x - 4, G, z], STEEL, 'Metal', { collide: 0 });
    add([8, 2.6, 0.1], [x, G + 1.6, z], 0x9aa0a4, 'Metal', { trans: 0.7, collide: 0, rot: k % 4 === 1 ? RX(0.5) : undefined });
  }
  neon([18, 0.06, 10], [-522, G + 0.04, ZL], 0x3a1a14, { shape: 5 });
  // sirens round the field
  for (const [x, z] of [[-590, -530], [-590, -440], [-470, -432], [-452, -600]]) {
    box([0.5, 9, 0.5], [x, G, z], DARK, 'Metal', { collide: 0 });
    neon([0.9, 1.1, 0.9], [x, G + 9.5, z], RED, { shape: 3 });
  }

  // ======== the pods: armored containment pods, red underglow
  const carParts = (k) => [
    pp(0, [3.4, 0.9, 3.4], [0, 0.65, 0], 0x2a2c30, 'Metal'),
    pp(0, [3.5, 0.2, 3.5], [0, 1.1, 0], HAZ, 'SmoothPlastic'),
    pp(0, [3.6, 0.15, 3.3], [0, 0.18, 0], RED, 'Neon'),
    ...[-0.85, 0.75].flatMap((z) => [-0.75, 0.75].flatMap((x) => [
      pp(0, [1.1, 0.3, 0.9], [x, 1.3, z], 0x1a1a1c, 'Fabric'),
      pp(0, [1.1, 1.5, 0.25], [x, 2.0, z + 0.5], 0x2a2c30, 'Metal'),
    ])),
    ...(k === 0 ? [
      pp(1, [3.2, 1.3, 1.4], [0, 1.0, -2.3], 0x2a2c30, 'Metal', [-1, 0, 0, 0, 1, 0, 0, 0, -1]),
      pp(0, [3.3, 0.25, 0.25], [0, 0.5, -2.9], HAZ, 'SmoothPlastic'),
      pp(3, [0.5, 0.35, 0.2], [-1, 1.1, -2.95], 0xff2a1a, 'Neon'),
      pp(3, [0.5, 0.35, 0.2], [1, 1.1, -2.95], 0xff2a1a, 'Neon'),
    ] : []),
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
    stops.push(cf(-392.4, G, P.z, Math.PI / 2));
    stopCars.push(k + 1);
  }
  const crew = {
    stopCars, stops, restraint: 'harness', attendants: 2, routes: [[1, 2], [3]],
    console: cf(con[0], G, con[1] - 0.6, 0), operator: cf(con[0], G, con[1] - 1.6, 0),
    homes: [cf(-389, G, -503, Math.PI / 2), cf(-389, G, -489, Math.PI / 2)],
    exit: cf(NDOOR, G, -484, Math.PI),
  };

  // ======== the ride
  const origin = [-470, 0, -520];
  const ride = {
    id: RIDE_ID, kind: 'coaster', track, duration: track.times[track.times.length - 1],
    origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: CARS, carSpacing: SPACING, cars, seats,
    capacity: CARS * 4, queue: qpath, trackStyle: { style: 'steel', color: TRACK_COLOR, skip: [[s0, sH]] }, extras, extrasNames, crew,
    tilt, props, noExtended: true,
  };
  data.rides.push(ride);
  const at = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.cum.length; i++) {
      const d = (track.pos[i * 3] - x) ** 2 + (track.pos[i * 3 + 2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return track.times[best] / ride.duration;
  };
  // sparks from the power panel; the blast at the bottom of the drop; fire
  // in the lair as the Ravager lunges
  const cues = [[at(-398, -534), 'sparks', [-3, 2, 0]], [at(-526, ZL), 'explosion', [0, 0, 8]], [at(-430, -503), 'fire', [-4, 0, 0]]];
  const rides = data.config.Rides;
  let insertAt = rides.length;
  rides.forEach((r, i) => { if (r.land === 'Backwoods') insertAt = i + 1; });
  rides.splice(insertAt, 0, {
    id: RIDE_ID, name: 'Ravage', land: 'Backwoods', category: 'Thrill', thrill: 5, kind: 'coaster', carStyle: 'coaster',
    description: "A tilt coaster, half out in the open and half in the dark. Benton BioDynamics keeps Specimen R - the Ravager - in Sector R, and tonight its containment is failing. Wind through a very long line past the wrecked transport truck and the lab corridors, get the containment briefing, then ride a transport pod up the lift onto the tilting track ... which stops, tips forward until you're hanging face down, and drops. Then a zero-g roll, an airtime hill, and back inside, where the Ravager is waiting.",
    baseWait: 75, origin, entrance: [-266, 0, -480], exit: [-268, 0, -470], yaw: 0, layout: RIDE_ID,
    cars: CARS, carSpacing: SPACING, colors: [TRACK_COLOR, 0x2a2c30, HAZ], cues,
  });
  data.staff.lines.greeter = [...(data.staff.lines.greeter || []), 'Ravage is open out past the back lot - the line starts at the checkpoint!', "Don't look down on the tilt!"];
  return { ride, gate: { x: -250, z: gz }, indoor: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, supports, tilt };
}

// a toast the first time you come near the new ride
export class RavageSite {
  constructor(hooks, layout) {
    this.hooks = hooks;
    this.layout = layout;
    this.told = false;
  }

  update(dt, pos, started) {
    if (!started || this.told) return;
    const { gate } = this.layout;
    if (Math.hypot(pos.x - gate.x, pos.z - gate.z) < 60) {
      this.told = true;
      this.hooks.toast('NEW: Ravage, a tilt coaster! The track tips you face down before the drop. Through the gate in the back lot\'s west wall.', 'reward');
    }
  }
}
