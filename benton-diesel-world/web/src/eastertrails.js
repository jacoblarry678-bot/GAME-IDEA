// Easter's walkthrough: Inside the Egg: The Easter Egg Experience, on
// Stage 22 backstage. Built and run like the Christmas trails (a line,
// posted waits, groups walking through), with six rooms drawn with the room
// helper R from houses.js: the Egg Gallery, the Hatchery, the Chocolate Egg
// Factory, the Springtime Meadow, the Tunnel of Eggs and, at the end, the
// Golden Egg. Also here: the stage's front and line.
import { STAGE_Z, QUEUE, stageX } from './backstage.js';
import { helpers } from './wolverine.js';

const G = 0.1;
const PINK = 0xff9ac8, MINT = 0x7ad8a8, BUTTER = 0xf8e070, LILAC = 0xb08aff, SKY = 0x8ad0ff, WHITE = 0xf8f8f4, GOLD = 0xf0c040, CHOC = 0x5a3a22;
const PASTELS = [PINK, MINT, BUTTER, LILAC, SKY];
const W = 2.9; // inside half-width of a corridor
const every = (R, step, fn, from = 3) => { for (let t = from, k = 0; t < R.len - 2; t += step, k++) fn(t, k); };

// a decorated egg standing at (t, s), h tall, with three painted bands
const egg = (R, t, s, h, y, colors) => {
  R.put(t, s, [h * 0.74, h, h * 0.74], y + h / 2, WHITE, 'SmoothPlastic', { shape: 3 });
  colors.forEach((c, k) => R.put(t, s, [h * 0.76 - Math.abs(k - 1) * h * 0.12, h * 0.1, h * 0.76 - Math.abs(k - 1) * h * 0.12], y + h / 2 + (k - 1) * h * 0.24, c, 'SmoothPlastic', { shape: 5 }));
};
// a chick: a fluffy yellow body, a head and an orange beak
const chick = (R, t, s, y = 0, k = 0) => {
  R.put(t, s, [0.9, 0.8, 0.9], y + 0.4, 0xffe060, 'Fabric', { shape: 3 });
  R.put(t, s, [0.6, 0.6, 0.6], y + 1.05, 0xffe060, 'Fabric', { shape: 3 });
  R.put(t, s - Math.sign(s || 1) * 0.35, [0.25, 0.15, 0.25], y + 1.05, 0xff9a3a, 'SmoothPlastic', { turn: k });
};
// a bunny (the park's own): a round white body, a head, tall ears
const bunny = (R, t, s, color = WHITE) => {
  R.put(t, s, [1.2, 1.1, 1.6], 0.6, color, 'Fabric', { shape: 3 });
  R.put(t + 0.7, s, [0.8, 0.8, 0.8], 1.3, color, 'Fabric', { shape: 3 });
  for (const e of [-0.18, 0.18]) R.put(t + 0.7, s + e, [0.2, 1.2, 0.3], 2.2, color, 'Fabric', { shape: 3 });
  R.put(t - 0.8, s, [0.4, 0.4, 0.4], 0.7, WHITE, 'Fabric', { shape: 3 });
  R.put(t + 1.1, s, [0.12, 0.1, 0.12], 1.35, PINK, 'SmoothPlastic', { shape: 3 });
};
const flower = (R, t, s, h, color) => {
  R.put(t, s, [0.12, h, 0.12], h / 2, 0x3a8a3a, 'Grass');
  for (let k = 0; k < 5; k++) { const a = k * 1.26; R.put(t + Math.cos(a) * 0.35, s + Math.sin(a) * 0.35, [0.4, 0.15, 0.4], h, color, 'SmoothPlastic', { shape: 3 }); }
  R.put(t, s, [0.3, 0.2, 0.3], h + 0.05, BUTTER, 'Neon', { shape: 3 });
};
// an arch of egg-shaped lights over the path
const eggArch = (R, t, colors, h = 8.8, n = 9) => {
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * k) / (n - 1);
    R.put(t, Math.cos(a) * (W - 0.2), [0.4, 0.55, 0.4], 0.5 + Math.sin(a) * (h - 0.5), colors[k % colors.length], 'Neon', { shape: 3 });
  }
};

export const EROOMS = {
  eggs: [
    // the Egg Gallery: painted eggs on plinths, in frames of light
    { wall: [0xfff0f6, 'SmoothPlastic'], floor: 0xe8e0f0, light: PINK, dress: (R) => {
      every(R, 4.2, (t, k) => {
        const side = k % 2 ? 1 : -1;
        R.wall(t, side, 1.6, 1.2, 1.6, LILAC, 'SmoothPlastic');
        egg(R, t, side * (W - 0.8), 2.2, 1.2, [PASTELS[k % 5], PASTELS[(k + 2) % 5], PASTELS[(k + 4) % 5]]);
        R.put(t, side * (W - 0.05), [0.1, 3.4, 2.6], 2.9, PASTELS[(k + 1) % 5], 'Neon');
      }, 2);
      R.sign(R.len * 0.5, 1, 'THE EGG GALLERY', 12, 1.8, 7, 0x3a2a4a, BUTTER, true);
      R.sign(R.len * 0.2, -1, 'PLEASE DO NOT EAT THE ART', 9, 1.2, 6.4, WHITE, LILAC);
    } },
    // the Hatchery: nests of eggs, chicks, a giant egg cracking open
    { wall: [0xfff4c8, 'SmoothPlastic'], floor: 0xc8a060, light: 0xffe8a0, dress: (R) => {
      every(R, 6, (t, k) => {
        const side = k % 2 ? 1 : -1;
        R.put(t, side * (W - 1), [2.4, 0.6, 2.4], 0.3, 0xc8a060, 'Wood', { shape: 5 });
        for (let j = 0; j < 3; j++) egg(R, t + (j - 1) * 0.6, side * (W - 1), 0.7, 0.5, [WHITE, PASTELS[(k + j) % 5], WHITE]);
        chick(R, t + 1.6, side * (W - 1.6), 0, k);
        chick(R, t - 1.4, side * (W - 0.9), 0.6, k + 1);
      }, 3);
      // the giant egg, its top half lifting off, a chick peeking out
      const t = R.len * 0.6;
      R.put(t, -(W - 1.4), [2.2, 2, 2.2], 1, WHITE, 'SmoothPlastic', { shape: 3 });
      R.put(t + 0.4, -(W - 1.4), [2, 1.6, 2], 3, WHITE, 'SmoothPlastic', { shape: 3, turn: 0.6 });
      chick(R, t, -(W - 1.4), 1.4, 0);
      R.sign(R.len * 0.35, 1, "THE HATCHERY  ·  SHHH, THEY'RE HATCHING", 14, 1.6, 7, 0x3a2a4a, BUTTER, true);
    } },
    // the Chocolate Egg Factory: a conveyor of eggs, foil eggs, a chocolate fountain
    { wall: [0x6a4a32, 'Brick'], floor: 0x3a2a1c, light: 0xffc890, dress: (R) => {
      R.wall(R.len / 2, 1, R.len - 4, 1.2, 1.6, 0x2a2a2e, 'Metal', { y0: 1.4 });
      every(R, 2.2, (t, k) => R.put(t, W - 0.8, [0.9, 1.2, 0.9], 3.2, k % 3 ? CHOC : [GOLD, LILAC, PINK][k % 3], k % 3 ? 'SmoothPlastic' : 'Metal', { shape: 3 }), 2);
      every(R, 9, (t, k) => {
        R.put(t, -(W - 1.2), [2.2, 2.6, 2.2], 1.3, 0x8a8e96, 'Metal', { shape: 5 });
        R.put(t, -(W - 1.2), [2, 0.3, 2], 2.65, CHOC, 'SmoothPlastic', { shape: 5 });
        R.put(t, -(W - 1.2), [0.3, 4, 0.3], 4.6, 0x8a8e96, 'Metal');
      }, 4);
      const f = R.len * 0.55;
      for (let k = 0; k < 3; k++) R.put(f, -(W - 1.3), [2.2 - k * 0.6, 0.3, 2.2 - k * 0.6], 1 + k * 1.3, CHOC, 'SmoothPlastic', { shape: 5 });
      R.put(f, -(W - 1.3), [0.4, 3.6, 0.4], 2.4, 0x7a4a2a, 'SmoothPlastic', { shape: 5 });
      R.sign(R.len * 0.3, -1, 'CHOCOLATE EGG FACTORY', 12, 1.6, 7.4, 0x2a1a10, GOLD, true);
    } },
    // the Springtime Meadow: flowers, bunnies, butterflies
    { wall: [0x9ad8a0, 'SmoothPlastic'], floor: 0x5ab85a, light: 0xd8ffd8, dress: (R) => {
      every(R, 1.4, (t, k) => flower(R, t, (k % 2 ? 1 : -1) * (W - 0.4 - (k % 3) * 0.3), 1 + (k % 3) * 0.3, PASTELS[k % 5]), 1);
      every(R, 7, (t, k) => bunny(R, t, (k % 2 ? -1 : 1) * (W - 1.4), [WHITE, 0xd8c0a8, 0xe8e8e8][k % 3]), 3);
      every(R, 3, (t, k) => {
        const s = Math.sin(t * 0.7) * 1.8, y = 6 + Math.sin(t * 1.3) * 1.2;
        R.put(t, s - 0.25, [0.5, 0.06, 0.4], y, PASTELS[k % 5], 'Neon', { turn: 0.5 });
        R.put(t, s + 0.25, [0.5, 0.06, 0.4], y, PASTELS[(k + 2) % 5], 'Neon', { turn: -0.5 });
      }, 2);
      R.sign(R.len * 0.5, 1, 'SPRINGTIME MEADOW', 12, 1.6, 7.6, 0x2a5a3a, WHITE, true);
    } },
    // the Tunnel of Eggs: arches of egg-shaped lights
    { wall: [0x2a2040, 'SmoothPlastic'], floor: 0x2a2440, light: LILAC, dress: (R) => {
      every(R, 2.4, (t, k) => eggArch(R, t, k % 2 ? [PINK, MINT, BUTTER] : [LILAC, SKY, PINK]), 2);
    } },
    // the Golden Egg: sparkles, spotlights, and the egg on its pedestal
    { wall: [0x3a2a5a, 'SmoothPlastic'], floor: 0x2a2040, light: GOLD, dress: (R) => {
      for (let k = 0; k < 60; k++) R.put(((k * 37) % 100) / 100 * R.len, (((k * 53) % 100) / 100 - 0.5) * 5.4, [0.14, 0.14, 0.14], 2 + ((k * 71) % 100) / 100 * 7.5, k % 3 ? GOLD : WHITE, 'Neon', { shape: 3 });
      const t = R.len * 0.55;
      R.put(t, W - 1.3, [2.4, 1.4, 2.4], 0.7, WHITE, 'SmoothPlastic', { shape: 5 });
      R.put(t, W - 1.3, [2, 2.8, 2], 2.8, GOLD, 'Neon', { shape: 3 });
      R.put(t, W - 1.3, [2.1, 0.2, 2.1], 2.8, WHITE, 'SmoothPlastic', { shape: 5 });
      R.sign(t - 3, -1, 'THE GOLDEN EGG  ·  MAKE A WISH', 12, 1.6, 7.2, 0x3a2a5a, GOLD, true);
    } },
  ],
};

export const EDESC = {
  eggs: 'NEW for Easter on Stage 22: walk Inside the Egg - the Egg Gallery, the Hatchery (shhh, they\'re hatching), the Chocolate Egg Factory, the Springtime Meadow, the Tunnel of Eggs and, at the very end, the Golden Egg. Make a wish!',
};

// the stage the walkthrough is in
export const ESTAGES = [
  { stage: 1, theme: 'eggs', title: 'Inside the Egg: The Easter Egg Experience', glow: PINK, baseWait: 30, speed: 0.8 },
];

// the walkthrough's front: a name board, an egg-shaped portal of pastel
// lights round the door, and its line on the lawn behind white rope
export function buildEasterFronts(data) {
  const { add, box, sign } = helpers(data);
  const rope = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 5));
    for (let k = 0; k <= n; k++) box([0.26, 3, 0.26], [xa + ((xb - xa) * k) / n, G, za + ((zb - za) * k) / n], WHITE, 'Metal', { collide: 0 });
    add([0.16, 0.16, len], [(xa + xb) / 2, G + 2.5, (za + zb) / 2], PINK, 'Fabric', { collide: 0, yaw: Math.atan2(xb - xa, zb - za) });
  };
  for (const t of ESTAGES) {
    const x = stageX(t.stage), F = STAGE_Z;
    sign([40, 3.6, 0.3], [x, G + 17.6, F + 0.5], 0x3a2a4a, 'Back', [['INSIDE THE EGG', 0, 0, 1, 0.66, PINK], ['THE EASTER EGG EXPERIENCE  ·  NEW FOR EASTER', 0, 0.66, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
    for (let k = 0; k < 28; k++) {
      const a = (2 * Math.PI * k) / 28, y = 7 + Math.sin(a) * 7;
      if (y < 0.5) continue;
      add([0.55, 0.55, 0.55], [x + Math.cos(a) * 5.4, G + y, F + 1], PASTELS[k % 5], 'Neon', { shape: 3, collide: 0 });
    }
    const qx0 = x - 35, qx1 = x + 35;
    add([qx1 - qx0 + 2, 0.12, QUEUE.z1 - QUEUE.z0], [x, G + 0.06, (QUEUE.z0 + QUEUE.z1) / 2], 0x9ad89a, 'SmoothPlastic', { collide: 0 });
    rope(qx0 + 8, QUEUE.z1, qx1, QUEUE.z1);
    rope(qx0, QUEUE.z0, qx0, QUEUE.z1);
    rope(qx1, QUEUE.z0, qx1, QUEUE.z1);
    for (let k = 1; k < 12; k++) {
      const z = QUEUE.z1 - k * 7;
      if (k % 2) rope(qx0, z, qx1 - 7, z); else rope(qx0 + 7, z, qx1, z);
    }
    box([0.4, 7, 0.4], [qx0 - 2, G, QUEUE.z1 + 2], WHITE, 'Metal');
    sign([12, 2.4, 0.2], [qx0 - 2, G + 6.4, QUEUE.z1 + 2.2], 0x3a2a4a, 'Back', [['INSIDE THE EGG', 0, 0, 1, 1, PINK]], { glow: true });
  }
}
