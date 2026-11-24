// Benton Holidays' Christmas trails: walk-through light trails, built and
// run like the Benton Haunt houses (a line, posted waits, groups walking
// through) but all twinkle and no scares. Four are indoors in the
// backstage soundstages, one in the Family Landing show tent, and one
// winds outdoors through the snowy backstage yard.
//
// This file holds the trails' rooms (each a wall finish, a light color and
// its set dressing, drawn with the room helper R from houses.js), which
// stage each one is in, and the trail fronts and queues.
import { STAGE_Z, QUEUE, stageX, BS } from './backstage.js';
import * as THREE from 'three';
import { helpers } from './wolverine.js';
import { LINES } from './guests.js';

const G = 0.1;
const RED = 0xc8102e, GREEN = 0x1e5a2a, GOLD = 0xf0c040, WHITE = 0xf4f4f0, ICE = 0x9ad8ff, WARM = 0xffd890, PINK = 0xff7ab8, BLUE = 0x3a6aff;
const BULBS = [0xff2a2a, 0x2aff4a, 0xffc030, 0x3a6aff, 0xfff4e0];
const W = 2.9; // inside half-width of a corridor (HALF - 0.3)
const B = 0.34; // a bulb

// ------------------------------------------------- light-display pieces
const every = (R, step, fn, from = 3) => { for (let t = from, k = 0; t < R.len - 2; t += step, k++) fn(t, k); };
// an arch of bulbs over the path
const arch = (R, t, colors, h = 8.6, half = W - 0.2, n = 9) => {
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * k) / (n - 1);
    R.put(t, Math.cos(a) * half, [B, B, B], 0.5 + Math.sin(a) * (h - 0.5), colors[k % colors.length], 'Neon', { shape: 3 });
  }
};
const tunnel = (R, step, colors, h, half, from = 3) => every(R, step, (t, k) => arch(R, t, colors.length > 1 && k % 2 ? [...colors].reverse() : colors, h, half), from);
// a cone tree drawn in a spiral of lights, with a star
const lightTree = (R, t, s, h, color, { star = GOLD, solid = false } = {}) => {
  if (solid) R.put(t, s, [h * 0.32, h * 0.8, h * 0.32], h * 0.45, GREEN, 'Grass', { shape: 5 });
  const n = Math.round(h * 3);
  for (let k = 0; k < n; k++) {
    const u = k / n, a = u * Math.PI * 2 * (h / 2.2), r = (1 - u) * h * 0.24 + 0.2;
    R.put(t + Math.sin(a) * r, s + Math.cos(a) * r, [B, B, B], 0.4 + u * h, Array.isArray(color) ? color[k % color.length] : color, 'Neon', { shape: 3 });
  }
  R.put(t, s, [0.7, 0.7, 0.7], h + 0.5, star, 'Neon', { shape: 3 });
};
// a glowing animal made of light: blocks of neon
const deer = (R, t, s, color, turn = 0, antlers = true) => {
  const P = (dt, ds, size, y) => R.put(t + dt, s + ds, size, y, color, 'Neon', { turn });
  P(0, 0, [0.7, 0.8, 2.2], 2.6);
  for (const [dt, ds] of [[-0.8, -0.25], [-0.8, 0.25], [0.8, -0.25], [0.8, 0.25]]) P(dt, ds, [0.18, 2.2, 0.18], 1.1);
  P(-1.1, 0, [0.4, 1.2, 0.4], 3.4);
  P(-1.5, 0, [0.5, 0.5, 0.9], 4.1);
  if (antlers) for (const ds of [-0.3, 0.3]) { P(-1.3, ds, [0.08, 1, 0.08], 4.9); P(-1.1, ds * 1.6, [0.08, 0.08, 0.6], 5.3); }
  P(1.2, 0, [0.15, 0.4, 0.15], 3);
};
const bear = (R, t, s, turn = 0) => {
  const P = (dt, ds, size, y, c = WHITE) => R.put(t + dt, s + ds, size, y, c, 'Neon', { turn });
  P(0, 0, [1.4, 1.4, 2.6], 1.9);
  for (const [dt, ds] of [[-0.9, -0.45], [-0.9, 0.45], [0.9, -0.45], [0.9, 0.45]]) P(dt, ds, [0.45, 1.3, 0.45], 0.65);
  P(-1.6, 0, [0.9, 0.9, 1], 2.4);
  P(-2.1, 0, [0.4, 0.3, 0.5], 2.3, 0x1a1a1a);
};
const penguin = (R, t, s) => {
  R.put(t, s, [0.9, 1.6, 0.8], 0.9, 0x1a2a4a, 'SmoothPlastic', { shape: 5 });
  R.put(t - 0.2, s, [0.5, 1.2, 0.6], 0.9, WHITE, 'Neon');
  R.put(t, s, [0.7, 0.7, 0.7], 1.95, 0x1a2a4a, 'SmoothPlastic', { shape: 3 });
  R.put(t - 0.4, s, [0.3, 0.15, 0.2], 1.9, 0xffa020, 'Neon');
};
// a snowflake of light on a wall (or flat overhead with `flat`)
const snowflake = (R, t, s, y, r, color, flat = false) => {
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    if (flat) R.put(t, s, [0.14, 0.14, r * 2], y, color, 'Neon', { turn: a });
    else R.spin(t, s, [0.1, r * 2, 0.16], y, color, 'Neon', a);
  }
};
const present = (R, t, s, size, color, ribbon = GOLD, y = 0) => {
  R.put(t, s, [size, size * 0.8, size], y + size * 0.4, color, 'SmoothPlastic');
  R.put(t, s, [size + 0.06, size * 0.8 + 0.06, 0.25], y + size * 0.4, ribbon, 'Fabric');
  R.put(t, s, [0.25, size * 0.8 + 0.06, size + 0.06], y + size * 0.4, ribbon, 'Fabric');
  R.put(t, s, [0.5, 0.4, 0.5], y + size * 0.8 + 0.2, ribbon, 'Fabric', { shape: 3 });
};
const candyCane = (R, t, s, h = 6) => {
  const n = Math.round(h);
  for (let k = 0; k < n; k++) R.put(t, s, [0.5, 1, 0.5], 0.5 + k, k % 2 ? WHITE : RED, 'Neon', { shape: 5 });
  R.put(t + 0.5, s, [1.4, 0.5, 0.5], n + 0.25, RED, 'Neon');
  R.put(t + 1.1, s, [0.5, 0.9, 0.5], n - 0.3, WHITE, 'Neon', { shape: 5 });
};
const icicles = (R, step = 1.6, color = ICE) => every(R, step, (t, k) => {
  for (const side of [-1, 1]) R.put(t, side * (W - 0.15), [0.12, 0.6 + ((k * 7) % 5) * 0.3, 0.12], 10.4 - ((k * 7) % 5) * 0.15, color, 'Neon');
}, 1);
// strands of lights hanging down the walls
const curtain = (R, step, colors, top = 10.6, len = 7) => every(R, step, (t, k) => {
  for (const side of [-1, 1]) R.put(t, side * (W - 0.1), [0.08, len, 0.08], top - len / 2, colors[k % colors.length], 'Neon');
}, 1.2);
// a scalloped garland of bulbs along both walls
const garland = (R, y = 8.5, colors = BULBS) => every(R, 0.9, (t, k) => {
  for (const side of [-1, 1]) R.put(t, side * (W - 0.2), [0.28, 0.28, 0.28], y - Math.abs(Math.sin((t / 5) * Math.PI)) * 0.9, colors[k % colors.length], 'Neon', { shape: 3 });
}, 0.5);
const fireflies = (R, n, color = 0xfff0a0) => { for (let k = 0; k < n; k++) R.put(((k * 37) % 100) / 100 * R.len, (((k * 53) % 100) / 100 - 0.5) * 5, [0.15, 0.15, 0.15], 2 + ((k * 71) % 100) / 100 * 7.5, color, 'Neon', { shape: 3 }); };
const ornament = (R, t, s, y, d, color) => {
  R.put(t, s, [d, d, d], y, color, 'Metal', { shape: 3 });
  R.put(t, s, [d * 0.25, d * 0.2, d * 0.25], y + d * 0.55, GOLD, 'Metal', { shape: 5 });
};
const mushroom = (R, t, s, h, cap = RED) => {
  R.put(t, s, [h * 0.22, h * 0.7, h * 0.22], h * 0.35, 0xf4ecd8, 'Neon', { shape: 5 });
  R.put(t, s, [h * 0.75, h * 0.32, h * 0.75], h * 0.78, cap, 'Neon', { shape: 3 });
  for (let k = 0; k < 4; k++) R.put(t + Math.cos(k * 1.6) * h * 0.22, s + Math.sin(k * 1.6) * h * 0.22, [h * 0.09, h * 0.09, h * 0.09], h * 0.9, WHITE, 'Neon', { shape: 3 });
};
const soldier = (R, t, s) => {
  R.put(t, s, [0.9, 1.6, 0.7], 1.6, 0x1a1a3a, 'SmoothPlastic');
  R.put(t, s, [1, 1.8, 0.8], 3.3, RED, 'SmoothPlastic');
  R.put(t, s, [1.05, 0.2, 0.85], 2.6, WHITE, 'SmoothPlastic');
  R.put(t, s, [0.75, 0.75, 0.75], 4.6, 0xf2c8a0, 'SmoothPlastic', { shape: 3 });
  R.put(t, s, [0.8, 1.4, 0.8], 5.6, 0x101010, 'Fabric', { shape: 5 });
  R.put(t, s, [0.3, 0.3, 0.3], 5.1, GOLD, 'Metal', { shape: 3 });
};
const snowman = (R, t, s) => {
  R.put(t, s, [2.2, 2.2, 2.2], 1.1, WHITE, 'SmoothPlastic', { shape: 3 });
  R.put(t, s, [1.6, 1.6, 1.6], 2.8, WHITE, 'SmoothPlastic', { shape: 3 });
  R.put(t, s, [1.1, 1.1, 1.1], 4.0, WHITE, 'SmoothPlastic', { shape: 3 });
  R.put(t, s, [0.8, 0.7, 0.8], 4.8, 0x101012, 'SmoothPlastic', { shape: 5 });
  R.put(t, s, [1.6, 0.3, 1.6], 3.4, RED, 'Fabric', { shape: 5 });
};
const lamp = (R, t, s, color = WARM) => {
  R.put(t, s, [0.2, 4.4, 0.2], 2.2, 0x1a1a1a, 'Metal');
  R.put(t, s, [0.7, 0.9, 0.7], 4.7, color, 'Neon');
};

// ------------------------------------------------------------ the rooms
export const XROOMS = {
  // The North Pole Lights: aurora, ice caves, polar bears and penguins
  northpole: [
    { wall: [0x0c1a2e, 'SmoothPlastic'], floor: 0xdfe8f0, light: 0x5ae8b0, dress: (R) => {
      for (let k = 0; k < 4; k++) every(R, 2, (t, j) => R.put(t, Math.sin(t * 0.25 + k * 1.3) * 2.2, [0.14, 0.5, 2.1], 10.6 - k * 0.35, [0x5ae8b0, 0x8a5aff, 0x3ad8ff, 0x6affc8][k], 'Neon', { turn: Math.cos(t * 0.25 + k) * 0.6 }), 1 + k * 0.5);
      icicles(R);
      R.sign(R.len * 0.5, 1, 'THE NORTHERN LIGHTS', 14, 2, 6, 0x0c1a2e, 0x8affd8, true);
    } },
    { wall: [0x4a7aa8, 'SmoothPlastic'], floor: 0xeef4f8, light: ICE, dress: (R) => {
      icicles(R, 1.1);
      // ice crystals: clusters of translucent prisms, each with a faint glowing core
      every(R, 6, (t, k) => {
        for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
          const h = 1.6 + ((k + j) % 3) * 0.9, s = side * (W - 0.7 - j * 0.3);
          R.spin(t + (j - 1) * 0.7, s, [0.7, h, 0.7], h / 2 + (k % 2) * 0.2, 0xb8e4ff, 'Glass', (j - 1) * 0.35);
          R.spin(t + (j - 1) * 0.7, s, [0.18, h * 0.7, 0.18], h / 2, ICE, 'Neon', (j - 1) * 0.35);
        }
      });
      every(R, 9, (t) => snowflake(R, t, (Math.round(t) % 2 ? 1 : -1) * (W - 0.1), 6.5, 1.3, WHITE), 4);
    } },
    { wall: [0x0e1424, 'SmoothPlastic'], floor: 0xdfe8f0, light: WHITE, dress: (R) => {
      every(R, 16, (t, k) => bear(R, t, (k % 2 ? 1 : -1) * 1.6, k % 2 ? 0 : Math.PI), 6);
      every(R, 5, (t, k) => penguin(R, t, (k % 2 ? -1 : 1) * 2.1), 4);
      every(R, 6, (t) => snowflake(R, t, 0, 10.2, 1, WHITE, true), 3);
      R.sign(R.len * 0.3, -1, 'POLAR BEAR CROSSING', 10, 1.6, 6.2, 0x0e1424, ICE, true);
    } },
    { wall: [0x0a1020, 'SmoothPlastic'], floor: 0xdfe8f0, light: 0x6ab4ff, dress: (R) => {
      tunnel(R, 2.4, [BLUE, WHITE, ICE], 9.2);
    } },
  ],
  // Santa's Toy Factory: conveyors of presents, toy soldiers, candy canes
  toyfactory: [
    { wall: [0x6a1a1a, 'Brick'], floor: 0x3a2a1a, light: WARM, dress: (R) => {
      R.wall(R.len / 2, 1, R.len - 4, 1.2, 1.6, 0x2a2a2a, 'Metal', { y0: 1.4 });
      every(R, 3.4, (t, k) => present(R, t, W - 0.8, 0.9 + (k % 3) * 0.2, [RED, GREEN, BLUE, GOLD][k % 4], [GOLD, RED, WHITE, RED][k % 4], 2.6));
      every(R, 10, (t) => R.wall(t, -1, 3, 4, 0.8, 0x7a5a3a, 'Wood', { y0: 0 }), 5);
      garland(R, 9, [RED, GREEN, GOLD]);
      R.sign(R.len * 0.6, -1, 'TOY ASSEMBLY  ·  LINE 1', 12, 1.6, 7, 0x1a1a1a, GOLD, true);
    } },
    { wall: [0x1e3a2a, 'SmoothPlastic'], floor: 0x2a1e14, light: 0xffc060, dress: (R) => {
      every(R, 5, (t, k) => soldier(R, t, (k % 2 ? 1 : -1) * (W - 0.6)), 3);
      garland(R, 9.4, [GOLD, RED]);
      every(R, 12, (t) => arch(R, t, [GOLD, RED], 9.6), 6);
    } },
    { wall: [0xf4f0e8, 'SmoothPlastic'], floor: 0x2a1e14, light: 0xff6a6a, dress: (R) => {
      tunnel(R, 3, [RED, WHITE], 9);
      every(R, 6, (t, k) => candyCane(R, t, (k % 2 ? 1 : -1) * (W - 0.7), 5 + (k % 2)), 2);
    } },
    { wall: [0x2a4a7a, 'SmoothPlastic'], floor: 0x2a1e14, light: 0xffd8f0, dress: (R) => {
      every(R, 4, (t, k) => { present(R, t, (k % 2 ? 1 : -1) * 1.6, 1.6, [RED, GREEN, GOLD, PINK][k % 4], WHITE); present(R, t + 0.5, (k % 2 ? 1 : -1) * 1.6, 1, [BLUE, RED, GREEN][k % 3], GOLD, 1.3); }, 2);
      every(R, 9, (t) => R.put(t, 0, [0.6, 1.6, 1.6], 9.6, RED, 'Fabric', { shape: 2 }), 5);
      R.sign(R.len * 0.4, 1, 'WRAPPING ROOM  ·  NO PEEKING', 12, 1.6, 7, 0x1a1a1a, PINK, true);
    } },
  ],
  // The Enchanted Forest of Lights: light trees, glowing deer, mushrooms
  forest: [
    { wall: [0x0a140c, 'SmoothPlastic'], floor: 0x1a2a1a, light: WARM, dress: (R) => {
      every(R, 7, (t, k) => lightTree(R, t, (k % 2 ? 1 : -1) * 1.9, 6 + (k % 3), WARM), 3);
      fireflies(R, 40);
    } },
    { wall: [0x0a1218, 'SmoothPlastic'], floor: 0x1a2a1a, light: 0xd8ecff, dress: (R) => {
      every(R, 13, (t, k) => deer(R, t, (k % 2 ? 1 : -1) * 1.7, k % 3 ? WHITE : GOLD, (k % 2) * 0.4), 5);
      every(R, 9, (t, k) => lightTree(R, t, (k % 2 ? -1 : 1) * 2.1, 5, [0xd8ecff, ICE]), 8);
      fireflies(R, 24, ICE);
    } },
    { wall: [0x140a18, 'SmoothPlastic'], floor: 0x1a1a24, light: PINK, dress: (R) => {
      every(R, 6, (t, k) => mushroom(R, t, (k % 2 ? 1 : -1) * 1.9, 3 + (k % 3) * 1.2, [RED, 0x8a5aff, PINK, GOLD][k % 4]), 2);
      fireflies(R, 30, 0x9affb0);
    } },
    { wall: [0x0a0c10, 'SmoothPlastic'], floor: 0x1a2a1a, light: WARM, dress: (R) => {
      tunnel(R, 2, [WARM], 9);
    } },
  ],
  // Winter Wonderland: a snowflake canopy, skaters, snow globes, the sleigh
  snowglobe: [
    { wall: [0x1a2a4a, 'SmoothPlastic'], floor: 0xeef4f8, light: WHITE, dress: (R) => {
      every(R, 3.5, (t, k) => snowflake(R, t, ((k % 3) - 1) * 1.6, 9.6 + (k % 2) * 0.6, 0.9 + (k % 2) * 0.4, k % 4 ? WHITE : ICE, true), 2);
      every(R, 8, (t, k) => snowflake(R, t, (k % 2 ? 1 : -1) * (W - 0.1), 5, 1.6, ICE), 4);
    } },
    { wall: [0x2a3a5a, 'SmoothPlastic'], floor: 0x9ad8ff, light: ICE, dress: (R) => {
      R.put(R.len / 2, 0, [W * 2 - 0.4, 0.06, R.len - 6], 0.05, 0xc8ecff, 'Glass');
      every(R, 9, (t, k) => snowman(R, t, (k % 2 ? 1 : -1) * 1.9), 4);
      garland(R, 8.5, [WHITE, ICE]);
      R.sign(R.len * 0.5, 1, 'THIN ICE  ·  SKATE AT YOUR OWN RISK', 14, 1.6, 6.5, 0x1a2a4a, WHITE, true);
    } },
    { wall: [0x0c1424, 'SmoothPlastic'], floor: 0xeef4f8, light: 0xd8ecff, dress: (R) => {
      every(R, 11, (t, k) => {
        const s = (k % 2 ? 1 : -1) * 1.5;
        R.put(t, s, [2.4, 0.9, 2.4], 0.45, 0x5a3a20, 'Wood', { shape: 5 });
        R.put(t, s, [2.6, 2.6, 2.6], 2.2, 0xd8f0ff, 'Glass', { shape: 3 });
        R.put(t, s, [0.9, 0.8, 0.9], 1.4, RED, 'SmoothPlastic');
        R.put(t, s, [0.18, 0.18, 0.18], 2.6, WHITE, 'Neon', { shape: 3 });
      }, 4);
      curtain(R, 1.4, [WHITE, ICE]);
    } },
    { wall: [0x0a0e1a, 'SmoothPlastic'], floor: 0xeef4f8, light: GOLD, dress: (R) => {
      // Santa's sleigh and team, flying overhead
      const t0 = R.len * 0.5;
      R.put(t0 + 4, 0, [2, 1.4, 4], 6.4, RED, 'SmoothPlastic');
      R.put(t0 + 5.4, 0, [2, 1, 1.4], 7.6, RED, 'SmoothPlastic');
      R.put(t0 + 4, 0, [1.6, 1, 2], 7.4, 0x2a6a2a, 'Fabric');
      for (let k = 0; k < 4; k++) deer(R, t0 - 2.6 - k * 3, (k % 2 ? 0.7 : -0.7), GOLD, 0, true);
      every(R, 2.4, (t) => R.put(t, Math.sin(t * 0.4) * 2, [0.2, 0.2, 0.2], 9.8, GOLD, 'Neon', { shape: 3 }), 1);
      R.sign(R.len * 0.2, -1, 'NEXT STOP: BENTON DIESEL WORLD', 14, 1.6, 6, 0x0a0e1a, GOLD, true);
    } },
  ],
  // Gingerbread Lane (the Family Landing tent): a village of gingerbread
  gingerbread: [
    { wall: [0x8a5a2a, 'SmoothPlastic'], floor: 0x5a3a20, light: WARM, dress: (R) => {
      every(R, 9, (t, k) => {
        const side = k % 2 ? 1 : -1;
        R.wall(t, side, 6, 5, 0.8, 0x9a6a32, 'SmoothPlastic');
        R.wall(t, side, 6.4, 0.4, 0.9, WHITE, 'SmoothPlastic', { y0: 5 });
        R.wall(t, side, 1.4, 2.6, 0.9, RED, 'SmoothPlastic');
        for (const dt of [-2, 2]) R.wall(t + dt, side, 1.2, 1.2, 0.9, 0xffe8a0, 'Neon', { y0: 2.6 });
        for (let j = 0; j < 4; j++) R.put(t - 2.2 + j * 1.5, side * (W - 1.2), [0.6, 0.5, 0.6], 5.7, [RED, GREEN, PINK, GOLD][j], 'Neon', { shape: 3 });
      }, 4);
      garland(R, 9, [WHITE, PINK]);
    } },
    { wall: [0xf4e0e8, 'SmoothPlastic'], floor: 0x5a3a20, light: PINK, dress: (R) => {
      every(R, 6, (t, k) => {
        const s = (k % 2 ? 1 : -1) * (W - 0.8);
        R.put(t, s, [0.25, 4.5, 0.25], 2.25, WHITE, 'SmoothPlastic');
        R.spin(t, s, [0.3, 2.4, 2.4], 5.2, [RED, 0x8a5aff, GREEN, PINK][k % 4], 'Neon', 0, 2);
      }, 3);
      every(R, 4, (t, k) => R.put(t, (k % 2 ? -1 : 1) * 2, [1.2, 0.9, 1.2], 0.45, [RED, GREEN, GOLD, PINK, BLUE][k % 5], 'Neon', { shape: 3 }), 2);
      R.sign(R.len * 0.5, 1, 'CANDY LAND', 10, 2, 6.8, 0xf4e0e8, RED, true);
    } },
    { wall: [0x6a4020, 'WoodPlanks'], floor: 0x3a2414, light: 0xffb060, dress: (R) => {
      every(R, 5, (t, k) => {
        const side = k % 2 ? 1 : -1;
        R.spin(t, side * (W - 0.15), [0.2, 2.6, 2.6], 5.5, 0xb87a3a, 'SmoothPlastic', 0, 2);
        for (let j = 0; j < 3; j++) R.put(t + (j - 1) * 0.6, side * (W - 0.3), [0.1, 0.4, 0.4], 5.5 + ((j * 7) % 3 - 1) * 0.5, [RED, GREEN, WHITE][j], 'Neon', { shape: 3 });
      }, 2);
      R.wall(R.len * 0.6, -1, 5, 4, 1.2, 0x2a2a2a, 'Metal');
      R.wall(R.len * 0.6, -1, 3, 2, 1.3, 0xff8a30, 'Neon', { y0: 1 });
      R.sign(R.len * 0.3, 1, "MRS. CLAUS' COOKIE KITCHEN", 12, 1.6, 8, 0x3a2414, WARM, true);
    } },
  ],
  // The Twinkle Trail (outdoors): arches, reindeer, ornaments, a tunnel
  twinkle: [
    { wall: [0xffffff, 'SmoothPlastic'], floor: 0xe8eef4, light: WARM, dress: (R) => {
      every(R, 6, (t, k) => arch(R, t, [BULBS[k % 5]], 7.5, 3.8, 11), 3);
      every(R, 14, (t, k) => lightTree(R, t, (k % 2 ? 1 : -1) * 6.5, 7 + (k % 3), BULBS, { solid: true }), 6);
    } },
    { wall: [0xffffff, 'SmoothPlastic'], floor: 0xe8eef4, light: 0xd8ecff, dress: (R) => {
      every(R, 9, (t, k) => deer(R, t, (k % 2 ? 1 : -1) * (5.5 + (k % 3)), k % 4 ? WHITE : GOLD, (k % 5) * 0.5, k % 3 !== 1), 4);
      R.put(R.len * 0.5, -7, [3, 2, 6], 1.5, RED, 'SmoothPlastic');
      every(R, 8, (t) => lamp(R, t, (Math.round(t) % 2 ? 1 : -1) * 4.4), 4);
    } },
    { wall: [0xffffff, 'SmoothPlastic'], floor: 0xe8eef4, light: PINK, dress: (R) => {
      every(R, 7, (t, k) => ornament(R, t, (k % 2 ? 1 : -1) * (5.5 + (k % 2) * 2), 1.4 + (k % 3) * 0.5, 2.4 + (k % 3) * 0.6, [RED, GOLD, BLUE, GREEN, PINK, 0x8a5aff][k % 6]), 3);
      every(R, 16, (t, k) => candyCane(R, t, (k % 2 ? -1 : 1) * 5, 7), 8);
    } },
    { wall: [0xffffff, 'SmoothPlastic'], floor: 0xe8eef4, light: ICE, dress: (R) => {
      tunnel(R, 1.8, [ICE, WHITE, BLUE], 7.5, 3.8);
    } },
  ],
};

// Stranger Things: Christmas in Hawkins (the late trail, in a new wing of the
// Stranger Things building): the Byers' living room with the alphabet
// wall, the Hawkins Lab holiday party, the Upside Down at Christmas, and the
// Snow Ball.
const alphabetWall = (R, t0, side) => {
  const rows = ['ABCDEFGH', 'IJKLMNOPQ', 'RSTUVWXYZ'];
  const lit = 'MERYXAS';
  // (the letter signs are the wallpaper: nothing in front of them but the bulbs)
  rows.forEach((row, r) => {
    const y = 8.6 - r * 2.6;
    R.sign(t0, side, row.split('').join('   '), 18, 2.6, y - 1.1, 0xd8cca0, 0x1a1a1a);
    [...row].forEach((ch, i) => {
      const t = t0 - 9 + (i + 0.5) * (18 / row.length);
      const on = lit.includes(ch);
      R.put(t, side * (W - 0.45), [on ? 0.55 : 0.36, on ? 0.55 : 0.36, on ? 0.55 : 0.36], y + 0.2, BULBS[(i + r) % 5], on ? 'Neon' : 'SmoothPlastic', { shape: 3 });
    });
  });
  for (let i = 0; i < 24; i++) R.put(t0 - 10 + i * 0.85, side * (W - 0.4), [0.08, 0.08, 0.9], 9.3 + Math.sin(i) * 0.15, 0x1a1a1a, 'Rubber');
};
const demogorgon = (R, t, s) => {
  const P = (dt, ds, size, y, c, mat = 'SmoothPlastic', o = {}) => R.put(t + dt, s + ds, size, y, c, mat, o);
  P(0, 0, [1.1, 2.4, 0.8], 4.2, 0x6a5a54);
  for (const ds of [-0.35, 0.35]) P(0, ds, [0.35, 3, 0.35], 1.5, 0x5a4a44);
  for (const ds of [-0.9, 0.9]) P(-0.5, ds, [0.3, 2.8, 0.3], 4.4, 0x5a4a44);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; R.spin(t - 0.3, s + Math.cos(a) * 0.5, [0.15, 1.3, 0.7], 6.2 + Math.sin(a) * 0.5, 0x8a6a62, 'SmoothPlastic', a); }
  P(-0.2, 0, [0.7, 0.7, 0.7], 6.2, 0xc81e1e, 'Neon', { shape: 3 });
  P(0, 0, [1.2, 1.6, 1.2], 7.6, RED, 'Fabric', { shape: 5 }); // a Santa hat
  P(0, 0, [1.4, 0.35, 1.4], 6.9, WHITE, 'Fabric', { shape: 5 });
  P(0.3, 0, [0.45, 0.45, 0.45], 8.5, WHITE, 'Fabric', { shape: 3 });
};
XROOMS.hawkins = [
  { wall: [0x6a4a2a, 'WoodPlanks'], floor: 0x5a4a3a, light: WARM, dress: (R) => {
    alphabetWall(R, R.len * 0.3, 1);
    alphabetWall(R, R.len * 0.72, 1);
    R.wall(R.len * 0.5, -1, 8, 2.4, 2.6, 0x7a5a3a, 'Fabric');
    lightTree(R, R.len * 0.2, -1.6, 7, BULBS, { solid: true });
    R.put(R.len * 0.85, -2, [0.3, 5, 0.3], 2.5, 0x2a2a2a, 'Metal');
    R.put(R.len * 0.85, -2, [1.4, 1.2, 1.4], 5.4, 0xffe8a0, 'Neon', { shape: 5 });
    garland(R, 10, BULBS);
    R.sign(R.len * 0.62, -1, 'THE BYERS HOUSE  ·  CHRISTMAS 1983', 12, 1.4, 7, 0x3a2a1a, WARM, true);
  } },
  { wall: [0xc8ccc8, 'Concrete'], floor: 0xb8bcb4, light: 0xd8ecff, dress: (R) => {
    every(R, 1.2, (t, k) => { for (const side of [-1, 1]) R.put(t, side * (W - 0.25), [0.15, 0.15, 1.3], 9.6 - Math.abs(Math.sin(t / 3)) * 0.8, k % 2 ? 0xc8d0dc : 0xd8b040, 'Metal', { shape: 2, turn: Math.PI / 2 }); }, 0.6);
    every(R, 26, (t) => { R.wall(t, 1, 10, 6, 0.3, 0x0a0c10, 'Metal', { y0: 3 }); R.sign(t, 1, "SEASON'S GREETINGS FROM HAWKINS LAB", 9.4, 1.6, 6, 0x1a0404, 0xff4a4a, true); }, 10);
    every(R, 18, (t) => { R.put(t, -2, [3, 1.2, 1.6], 2.4, WHITE, 'SmoothPlastic'); R.put(t, -2, [0.5, 0.6, 0.5], 3.3, 0xc81e1e, 'Glass', { shape: 5 }); }, 6);
    lightTree(R, R.len * 0.55, -1.8, 6, [RED, WHITE], { solid: true, star: RED });
    R.sign(R.len * 0.3, -1, 'HOLIDAY PARTY  ·  LEVEL 4  ·  NO HAZMAT SUITS', 13, 1.4, 7, 0x0a0c10, WHITE, true);
  } },
  { wall: [0x1a0a0e, 'SmoothPlastic'], floor: 0x2a1414, light: 0xff3a3a, dress: (R) => {
    // vines wrapped in Christmas lights, spores drifting like snow
    for (let k = 0; k < 40; k++) {
      const t = ((k * 37) % 100) / 100 * R.len, side = k % 2 ? 1 : -1, a = ((k * 13) % 10) / 10 - 0.5, h = 3 + (k % 4) * 1.5;
      R.spin(t, side * (W - 0.3), [0.3, h, 0.3], 2 + ((k * 7) % 6), 0x3a1414, 'SmoothPlastic', a);
      R.put(t, side * (W - 0.5), [0.3, 0.3, 0.3], 2.4 + ((k * 7) % 6), BULBS[k % 5], 'Neon', { shape: 3 });
    }
    fireflies(R, 50, 0xe8e0d0);
    demogorgon(R, R.len * 0.6, 1.4);
    R.sign(R.len * 0.3, -1, 'IT KNOWS IT IS CHRISTMAS', 12, 1.4, 7, 0x1a0a0e, 0xff4a4a, true);
  } },
  { wall: [0x2a3a6a, 'SmoothPlastic'], floor: 0x8a6a40, light: 0x9ad8ff, dress: (R) => {
    R.sign(R.len * 0.5, 1, 'SNOW BALL 1984', 14, 2.4, 7.6, 0x2a3a6a, WHITE, true);
    every(R, 3, (t, k) => snowflake(R, t, ((k % 3) - 1) * 1.6, 9.4 + (k % 2) * 0.6, 0.7, WHITE, true), 2);
    every(R, 4, (t, k) => { for (const side of [-1, 1]) R.put(t, side * (W - 0.6), [0.9, 1.1, 0.9], 1 + ((k * 7) % 3) * 0.7, k % 2 ? WHITE : 0x6ab4ff, 'SmoothPlastic', { shape: 3 }); }, 2);
    R.put(R.len * 0.5, 0, [1.6, 1.6, 1.6], 9, 0xd8dce2, 'Metal', { shape: 3 }); // the disco ball
    every(R, 1.4, (t, k) => R.put(t, Math.sin(k * 2.3) * 2.5, [0.15, 0.04, 0.15], 0.06, 0xffffff, 'Neon'), 1);
    garland(R, 8.8, [WHITE, 0x9ad8ff]);
  } },
];
export const XDESC = {
  northpole: 'Walk through the Northern Lights: an aurora overhead, glittering ice caves, polar bears and penguins made of light, and a tunnel of blue and white.',
  toyfactory: "Tour Santa's Toy Factory on Stage 22: the assembly line, the toy soldiers, Candy Cane Alley and the wrapping room (no peeking).",
  forest: 'An enchanted forest of lights: twinkling trees, glowing deer, giant glowing mushrooms, fireflies and a warm tunnel of light.',
  snowglobe: 'Winter Wonderland on Stage 6: a snowflake canopy, a frozen skating pond, giant snow globes and Santa and his team flying overhead.',
  gingerbread: "Gingerbread Lane, in the Family Landing tent: a gingerbread village, Candy Land's giant lollipops and gumdrops, and Mrs. Claus' cookie kitchen.",
  hawkins: "LATE TRAIL - opens after dark. A Stranger Things Christmas, in a new wing of the Stranger Things building: the Byers' living room with the alphabet-wall lights, the Hawkins Lab holiday party, the Upside Down at Christmas (yes, the Demogorgon has a Santa hat) and the Snow Ball.",
  twinkle: 'The outdoor trail through the snowy backstage yard: arches of lights, a meadow of glowing reindeer, giant ornaments, candy canes and a sparkling light tunnel.',
};

// the soundstage trails (stage index; the middle stage keeps its banner)
export const XSTAGES = [
  { stage: 0, theme: 'northpole', title: 'The Northern Lights', glow: 0x5ae8b0, baseWait: 45, speed: 0.8 },
  { stage: 1, theme: 'toyfactory', title: "Santa's Toy Factory", glow: GOLD, baseWait: 50, speed: 0.8 },
  { stage: 3, theme: 'forest', title: 'The Enchanted Forest of Lights', glow: WARM, baseWait: 40, speed: 0.78 },
  { stage: 5, theme: 'snowglobe', title: 'Winter Wonderland', glow: ICE, baseWait: 55, speed: 0.8 },
];
export const TRAIL_STAGES = XSTAGES.map((t) => t.stage);

// the outdoor trail, back and forth across the east end of the yard
const OX0 = 158, OX1 = 330;
export const XOUTDOOR = {
  id: 'TrailTwinkle', title: 'The Twinkle Trail', theme: 'twinkle', glow: WARM, baseWait: 30,
  interior: [[OX0, -422], [OX1, -422], [OX1, -442], [OX0 + 6, -442], [OX0 + 6, -462], [OX1, -462], [OX1, -482], [OX0, -482], [OX0, -496]],
  outsideIn: [[150, -422]], outsideOut: [[150, -496]],
  queueFwd: [[114, -446], [118, -446], [118, -440], [146, -440], [146, -434], [118, -434], [118, -428], [146, -428], [146, -422], [150, -422]],
  entrance: [114, -446], origin: [244, 0, -458],
};

// Christmas in Hawkins: a new wing on the north side of the Stranger Things
// building, with an indoor line and four rooms; open after dark only
const HW = { x0: 612, x1: 798, z0: -153, z1: -64, H: 24, door: -108, exitX: 656 };
const hq = [[600, HW.door], [616, HW.door], [616, -72]];
for (const [k, x] of [622, 628, 634, 640, 646].entries()) hq.push([x, k % 2 ? -148 : -72], [x, k % 2 ? -72 : -148]);
hq[hq.length - 1] = [646, -142];
hq.push([652, -142]);
export const XHAWKINS = {
  id: 'TrailHawkins', title: 'Stranger Things: Christmas in Hawkins', theme: 'hawkins', glow: 0xff3a3a, baseWait: 60, opensAt: 1050,
  interior: [[652, -142], [792, -142], [792, -122], [656, -122], [656, -102], [792, -102], [792, -82], [HW.exitX, -82], [HW.exitX, -66]],
  outsideIn: [[652, -142]], outsideOut: [[HW.exitX, -58], [606, -58], [606, -100]],
  queueFwd: hq, entrance: [604, HW.door], origin: [705, 0, -110], wing: HW,
};

// The trails' fronts and queues: a name board and a portal of lights at
// each soundstage door, red velvet ropes on gold posts through the
// stages' queue lawns, and the Twinkle Trail's line in the yard.
export function buildTrailFronts(data) {
  const { add, box, sign } = helpers(data);
  const rope = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 5));
    for (let k = 0; k <= n; k++) box([0.26, 3, 0.26], [xa + ((xb - xa) * k) / n, G, za + ((zb - za) * k) / n], GOLD, 'Metal', { collide: 0 });
    add([0.16, 0.16, len], [(xa + xb) / 2, G + 2.5, (za + zb) / 2], RED, 'Fabric', { collide: 0, yaw: Math.atan2(xb - xa, zb - za) });
  };
  for (const t of XSTAGES) {
    const x = stageX(t.stage), F = STAGE_Z;
    // the name board over the door, and a portal of lights round it
    sign([40, 3.6, 0.3], [x, G + 17.6, F + 0.5], 0x0a1a2a, 'Back', [[t.title.toUpperCase(), 0, 0, 1, 0.66, t.glow], ['A BENTON HOLIDAYS CHRISTMAS TRAIL', 0, 0.66, 1, 0.34, WHITE, 'GothamBold']], { glow: true });
    for (let k = 0; k < 15; k++) {
      const a = (Math.PI * k) / 14;
      add([0.5, 0.5, 0.5], [x + Math.cos(a) * 6, G + 1 + Math.sin(a) * 12, F + 1], BULBS[k % 5], 'Neon', { shape: 3, collide: 0 });
    }
    // the line: back and forth across the lawn (snow at Stage 6, too)
    const qx0 = x - 35, qx1 = x + 35;
    if (t.stage === 5) add([qx1 - qx0 + 2, 0.12, QUEUE.z1 - QUEUE.z0], [x, G + 0.06, (QUEUE.z0 + QUEUE.z1) / 2], 0xf2f6fa, 'SmoothPlastic', { collide: 0 });
    rope(qx0 + 8, QUEUE.z1, qx1, QUEUE.z1);
    rope(qx0, QUEUE.z0, qx0, QUEUE.z1);
    rope(qx1, QUEUE.z0, qx1, QUEUE.z1);
    for (let k = 1; k < 12; k++) {
      const z = QUEUE.z1 - k * 7;
      if (k % 2) rope(qx0, z, qx1 - 7, z); else rope(qx0 + 7, z, qx1, z);
    }
    box([0.4, 7, 0.4], [qx0 - 2, G, QUEUE.z1 + 2], 0x2a2a2e, 'Metal');
    sign([12, 2.4, 0.2], [qx0 - 2, G + 6.4, QUEUE.z1 + 2.2], 0x0a1a2a, 'Back', [[t.title.toUpperCase(), 0, 0, 1, 1, t.glow]], { glow: true });
  }
  // the Twinkle Trail: snow under it, its line and sign
  const O = XOUTDOOR;
  add([BS.x1 - 150, 0.12, 92], [(150 + BS.x1) / 2, G + 0.07, -459], 0xf2f6fa, 'SmoothPlastic', { collide: 0 }); // (the yard's own snow ends at x 150)
  const q = O.queueFwd;
  for (let k = 1; k < q.length - 2; k++) {
    const [xa, za] = q[k], [xb, zb] = q[k + 1];
    if (Math.abs(za - zb) > 0.1) continue;
    for (const dz of [-3, 3]) rope(Math.min(xa, xb) + 2.5, za + dz, Math.max(xa, xb) - 2.5, za + dz);
  }
  box([0.4, 7, 0.4], [O.entrance[0] - 3, G, O.entrance[1]], 0x2a2a2e, 'Metal');
  sign([12, 2.4, 0.2], [O.entrance[0] - 3, G + 6.4, O.entrance[1] - 0.2], 0x0a1a2a, 'Front', [['THE TWINKLE TRAIL', 0, 0, 1, 1, WARM]], { glow: true });
  // ---- Christmas in Hawkins: the wing (lab white, a red stripe, Joyce's
  // lights along the roof), its indoor line and its doors
  const H = XHAWKINS.wing, LAB = 0xc8ccc8, LABDARK = 0x3a3e44;
  // (the strip between the Stranger Things and Throttle Works sites was
  // countryside, with a hill on it: level it for the wing and its walks)
  data.flatZones = [...(data.flatZones || []), { x0: 598, x1: 808, z0: -112, z1: -38, margin: 24 }];
  const hx = (H.x0 + H.x1) / 2, hz = (H.z0 + H.z1) / 2;
  add([H.x1 - H.x0, 0.4, H.z1 - H.z0], [hx, G + 0.2, hz], 0x2a2c30, 'Concrete');
  const wallZ = (x, za, zb) => box([1.4, H.H, zb - za], [x, G, (za + zb) / 2], LAB, 'Concrete');
  const wallX = (z, xa, xb) => box([xb - xa, H.H, 1.4], [(xa + xb) / 2, G, z], LAB, 'Concrete');
  wallZ(H.x0, H.z0, H.door - 3.5); wallZ(H.x0, H.door + 3.5, H.z1);
  box([1.4, H.H - 9, 7], [H.x0, G + 9, H.door], LAB, 'Concrete');
  wallX(H.z1, H.x0, H.exitX - 3.5); wallX(H.z1, H.exitX + 3.5, H.x1);
  box([7, H.H - 9, 1.4], [H.exitX, G + 9, H.z1], LAB, 'Concrete');
  wallZ(H.x1, H.z0, H.z1);
  add([H.x1 - H.x0 + 2, 1.2, H.z1 - H.z0 + 2], [hx, G + H.H + 0.6, hz], 0x8a8e94, 'Concrete', { collide: 0 });
  for (const [w, d, x, z] of [[0.3, H.z1 - H.z0, H.x0 - 0.8, hz], [H.x1 - H.x0, 0.3, hx, H.z1 + 0.8], [0.3, H.z1 - H.z0, H.x1 + 0.8, hz]]) {
    add([w, 3.6, d], [x, G + 1.8, z], LABDARK, 'Concrete', { collide: 0 });
    add([w, 0.6, d], [x, G + 19, z], RED, 'Neon', { collide: 0 });
  }
  // Joyce's Christmas lights, strung all along the roofline
  for (let x = H.x0 + 1; x < H.x1; x += 1.6) add([0.45, 0.45, 0.45], [x, G + H.H - 1 - Math.abs(Math.sin(x * 0.2)) * 0.8, H.z1 + 1.1], BULBS[Math.round(x) % 5], 'Neon', { shape: 3, collide: 0 });
  for (let z = H.z0 + 1; z < H.z1; z += 1.6) add([0.45, 0.45, 0.45], [H.x0 - 1.1, G + H.H - 1 - Math.abs(Math.sin(z * 0.2)) * 0.8, z], BULBS[Math.round(-z) % 5], 'Neon', { shape: 3, collide: 0 });
  sign([0.4, 6, 40], [H.x0 - 1.2, G + 15, H.door], 0x050506, 'Left', [['CHRISTMAS IN HAWKINS', 0, 0.05, 1, 0.55, RED], ['A STRANGER THINGS CHRISTMAS TRAIL  ·  OPENS AFTER DARK', 0, 0.66, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  sign([0.2, 1.4, 8], [H.x0 - 0.9, G + 10.4, H.door], 0x050506, 'Left', [['LATE TRAIL  ·  5:30 PM', 0, 0, 1, 1, 0x8a5aff, 'GothamBold']], { glow: true });
  sign([7, 1.4, 0.2], [H.exitX, G + 10.4, H.z1 + 0.9], 0x050506, 'Back', [['EXIT', 0, 0, 1, 1, 0x5adc6e, 'GothamBold']], { glow: true });
  // inside the line: velvet ropes, lab posters, a tree and lights overhead
  const hqp = XHAWKINS.queueFwd;
  for (const [k, x] of [619, 625, 631, 637, 643].entries()) {
    const north = k % 2 === 0; // the turn is at the north end: leave it open
    rope(x, north ? -150 : -69, x, north ? -75 : -145);
  }
  for (let x = H.x0 + 3; x < 650; x += 3) for (let z = H.z0 + 4; z < H.z1 - 2; z += 8) add([0.3, 0.3, 0.3], [x, G + 12 - ((x + z) % 3) * 0.4, z], BULBS[Math.round(x + z) % 5], 'Neon', { shape: 3, collide: 0 });
  [['HAWKINS POWER & LIGHT', 'HAPPY HOLIDAYS  ·  SORRY ABOUT THE OUTAGES'], ['HAWKINS MIDDLE SCHOOL', 'SNOW BALL  ·  SATURDAY'], ['MISSING: WILL BYERS', 'FOUND SAFE  ·  MERRY CHRISTMAS']].forEach(([a, b], k) => {
    sign([0.2, 3, 8], [H.x0 + 0.9, G + 6, -140 + k * 14], 0x101114, 'Right', [[a, 0, 0.1, 1, 0.45, RED], [b, 0, 0.6, 1, 0.3, WHITE, 'GothamBold']], { glow: true });
  });
  box([1.2, 1.4, 1.2], [648, G, -70], 0x5a3a20, 'Wood', { collide: 0 });
  add([3, 6, 3], [648, G + 4.2, -70], GREEN, 'Grass', { shape: 5, collide: 0 });
  add([0.8, 0.8, 0.8], [648, G + 7.6, -70], GOLD, 'Neon', { shape: 3, collide: 0 });
  void hqp;
  // the walks: from the Mirkwood path to the door, and from the exit back
  for (const r of [[[603, -112], [600, H.door]], [[H.exitX, H.z1 - 1], [H.exitX, -58], [606, -58], [606, -104], [603, -112]]]) {
    for (let i = 0; i < r.length - 1; i++) {
      const [xa, za] = r[i], [xb, zb] = r[i + 1];
      add([7, 0.4, Math.hypot(xb - xa, zb - za) + 7], [(xa + xb) / 2, 0.23, (za + zb) / 2], 0x6a5a48, 'Pavement', { yaw: Math.atan2(xb - xa, zb - za), collide: 0 });
      LINES.push([new THREE.Vector3(xa, 0, za), new THREE.Vector3(xb, 0, zb)]);
    }
  }

  // a directory at the backstage gate
  box([0.5, 9, 0.5], [-34, G, -414], 0x2a2a2e, 'Metal');
  sign([14, 6, 0.3], [-34, G + 8.5, -413.8], 0x0a1a2a, 'Back', [
    ['CHRISTMAS TRAILS', 0, 0.02, 1, 0.24, GOLD],
    ['THE NORTHERN LIGHTS  ·  STAGE 21', 0, 0.3, 1, 0.12, 0x5ae8b0, 'GothamBold'],
    ["SANTA'S TOY FACTORY  ·  STAGE 22", 0, 0.43, 1, 0.12, GOLD, 'GothamBold'],
    ['ENCHANTED FOREST OF LIGHTS  ·  STAGE 24', 0, 0.56, 1, 0.12, WARM, 'GothamBold'],
    ['WINTER WONDERLAND  ·  STAGE 6', 0, 0.69, 1, 0.12, ICE, 'GothamBold'],
    ['THE TWINKLE TRAIL  ·  THIS WAY →', 0, 0.84, 1, 0.12, WHITE, 'GothamBold'],
  ], { glow: true });
}
