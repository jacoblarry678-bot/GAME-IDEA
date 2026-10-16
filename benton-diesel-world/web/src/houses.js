// The Benton Haunt houses, open for the event: walk-through mazes inside
// the five backstage soundstages and the tent at Family Landing. Each one
// joins the park like a ride (posted waits, a line, a passport stamp), but
// guests walk it in groups: the corridors snake back and forth through
// the dark under strings of colored light, past themed scenes where scare
// actors lunge out as you pass.
import { HOUSES, STAGE_Z, QUEUE, STAGE, stageX } from './backstage.js';
import { FAMILY_QUEUE } from './haunt.js';

export const WALK = 6; // how fast a group walks a house (studs/s)
const G = 0.1;
const HALF = 3.2; // half the corridor width
const CORRIDOR_H = 11;

// polyline helpers
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return cum;
}
export function pointAt(path, s) {
  const { pts, cum } = path;
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1;
  while (i < pts.length - 1 && s > cum[i]) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const u = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, fx: (b[0] - a[0]) / seg, fz: (b[1] - a[1]) / seg };
}

// A ride's queue path from the boarding gate (s = 0) back out past the
// entrance sign; `fwd` runs the other way, from outside to the gate.
function queueData(fwd, signIndex, floor) {
  const pts = [...fwd].reverse();
  const cum = cumulative(pts);
  const [gx, gz] = pts[0], [nx, nz] = pts[1];
  const gl = dist(pts[0], pts[1]) || 1;
  return {
    points: pts.flat(), cum, length: cum[cum.length - 1], signAt: cum[pts.length - 1 - signIndex],
    gate: pts[0], gateDir: [(gx - nx) / gl, (gz - nz) / gl], outward: [0, 1], floor,
  };
}

// ------------------------------------------------------------ the rooms
// Each house is a run of rooms, one per long corridor; every room has its
// wall finish, light color and set dressing, and two scare actors hiding
// behind cover. R is the room helper from buildHouses.
const every = (R, step, fn, from = 3) => { for (let t = from, k = 0; t < R.len - 2; t += step, k++) fn(t, k); };
const twoActors = (R, costumes, cover, mat) => {
  R.actor(R.len * 0.38, 1, costumes[0], cover, mat);
  R.actor(R.len * 0.8, -1, costumes[1] || costumes[0], cover, mat);
};
const hangChains = (R, step, color = 0x4a4c52) => every(R, step, (t, k) => {
  const s = (k % 3) - 1;
  R.put(t, s * 1.4, [0.12, 3 + (k % 2) * 2, 0.12], CORRIDOR_H - 1.5 - (k % 2), color, 'Metal');
  R.put(t, s * 1.4, [0.5, 0.5, 0.12], CORRIDOR_H - 3.4 - (k % 2) * 2, color, 'Metal');
});
const cobwebs = (R) => every(R, 11, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.2, [0.04, 2.2, 2.2], CORRIDOR_H - 1.6, 0xd8d8d0, 'Fabric', { turn: 0.4 }));
const crates = (R, t, side, n = 3) => { for (let k = 0; k < n; k++) R.wall(t + (k % 2) * 1.6, side, 1.5, 1.5, 1.5, 0x8a6a44, 'WoodPlanks', { y0: Math.floor(k / 2) * 1.5 }); };
const barrels = (R, t, side, colors = [0xc8322d, 0x3a3a3e, 0x2f6fbf]) => colors.forEach((c, k) => R.wall(t + k * 1.6, side, 1.4, 2.2, 1.4, c, 'CorrodedMetal', { shape: 5 }));
const tires = (R, t, side, n = 4) => { for (let k = 0; k < n; k++) R.wall(t, side, 2, 0.75, 2, 0x1a1a1a, 'Rubber', { shape: 5, y0: k * 0.75 }); };

const ROOMS = {
  garage: [
    { wall: [0x5a4a3a, 'WoodPlanks'], floor: 0x2a2420, light: 0xffd8a0, dress: (R) => { // the front office
      R.sign(4, 1, "DEAD MAN'S GARAGE  ·  OFFICE", 6, 1.2, 7.5, 0x1a1a1c, 0xff3030, true);
      R.wall(7, 1, 4, 2.6, 2, 0x5a3a24, 'Wood'); R.wall(7, 1, 0.8, 0.6, 0.6, 0x1a1a1a, 'Metal', { y0: 2.6 });
      for (let k = 0; k < 3; k++) R.wall(12 + k * 1.7, -1, 1.6, 4.4, 1.6, 0x6a6e76, 'Metal');
      R.sign(10, -1, 'OCTOBER 1987', 2.2, 1.6, 6, 0xf4f0e0, 0x1a1a1a);
      R.sign(16, 1, 'EMPLOYEE OF THE MONTH: ???', 3, 1.2, 6.2, 0xf4f0e0, 0x8a1c22);
      R.wall(18, 1, 1, 3.4, 1, 0x2f6fbf, 'SmoothPlastic', { shape: 5 });
      for (let k = 0; k < 8; k++) R.put(5 + k * 2.6, (k % 2 ? 1.2 : -1.6), [0.8, 0.04, 1.1], 0.06, 0xf4f0e0, 'SmoothPlastic', { turn: k });
      cobwebs(R); twoActors(R, ['mechanic', 'greaseMonster'], 0x6a6e76, 'Metal');
    } },
    { wall: [0x3a3e46, 'CorrodedMetal'], floor: 0x1a1a1c, light: 0xff3a20, dress: (R) => { // the service bay
      R.sign(3, -1, 'SERVICE BAY 3', 4, 1, 8, 0x1a1a1c, 0xf2c818, true);
      every(R, 22, (t) => { // a car up on the lift, overhead
        for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 7.5, 0.8, 0xc8322d, 'Metal');
        R.over(t, 7, 1.6, 8.4, 0x5a2a20, 'CorrodedMetal'); R.over(t, 4, 1.2, 9.6, 0x4a2420, 'CorrodedMetal');
        for (const dt of [-2.6, 2.6]) R.put(t + dt, 0, [5.4, 1.2, 1.2], 7.5, 0x1a1a1a, 'Rubber', { shape: 2 });
      }, 8);
      every(R, 14, (t, k) => { R.wall(t, k % 2 ? 1 : -1, 3, 3.6, 1.4, 0xc8322d, 'Metal'); R.wall(t, k % 2 ? 1 : -1, 3, 0.2, 1.5, 0x8a8e96, 'Metal', { y0: 3.6 }); }, 4);
      every(R, 17, (t, k) => tires(R, t, k % 2 ? -1 : 1), 6);
      every(R, 19, (t, k) => barrels(R, t, k % 2 ? 1 : -1), 12);
      every(R, 15, (t, k) => R.fog(t, k % 2 ? 1 : -1), 5);
      twoActors(R, ['greaseMonster', 'mechanic'], 0x5a2a20, 'CorrodedMetal');
    } },
    { wall: [0xd8d4c8, 'Fabric'], floor: 0x2a1a1a, light: 0xff1a1a, dress: (R) => { // the paint booth
      R.sign(4, 1, 'PAINT BOOTH  ·  KEEP DOOR CLOSED', 6, 1, 8, 0xf4f0e0, 0x8a1c22);
      every(R, 3.5, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.4 + (k % 3), 1 + (k % 4) * 0.8, 0.12, 0x9a0a0a, 'SmoothPlastic', { y0: 1 + (k % 5) * 1.3 }));
      every(R, 6, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.8, [0.06, 7, 2.6], 5.5, 0xe8e8e0, 'Glass'), 5);
      every(R, 13, (t, k) => R.wall(t, k % 2 ? -1 : 1, 1, 1.4, 1, 0x8a8e96, 'Metal', { shape: 5, y0: 0 }), 8);
      every(R, 12, (t, k) => R.fog(t, k % 2 ? 1 : -1), 6);
      twoActors(R, ['mechanic', 'mechanic'], 0xe8e8e0, 'Fabric');
    } },
    { wall: [0x7a7e86, 'DiamondPlate'], floor: 0x2a2620, light: 0xffa030, dress: (R) => { // the junkyard
      R.sign(3, -1, 'NO REFUNDS', 3, 1, 7, 0xf2c818, 0x1a1a1a);
      every(R, 7, (t, k) => { // crushed cars stacked against both walls
        for (let j = 0; j < 3; j++) R.wall(t, k % 2 ? 1 : -1, 5.6, 1.4, 2.2, [0x5a2a20, 0x2a4a6a, 0x6a6a2a, 0x3a3a3e][(k + j) % 4], 'CorrodedMetal', { y0: j * 1.45 });
      }, 4);
      every(R, 11, (t, k) => tires(R, t + 3, k % 2 ? -1 : 1, 3), 6);
      hangChains(R, 5);
      twoActors(R, ['greaseMonster', 'greaseMonster'], 0x3a3a3e, 'CorrodedMetal');
    } },
    { wall: [0x1a1612, 'CorrodedMetal'], floor: 0x0a0a0a, light: 0xc01010, dress: (R) => { // the pit
      R.sign(4, 1, 'THE PIT', 3, 1.2, 8, 0x1a1a1c, 0xc01010, true);
      hangChains(R, 2.2, 0x3a3a3e);
      every(R, 9, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.2, [2.4, 0.04, 3], 0.07, 0x050505, 'Glass'), 5);
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      every(R, 16, (t, k) => R.fire(t, k % 2 ? 1 : -1), 9);
      twoActors(R, ['greaseMonster', 'mechanic'], 0x1a1612, 'CorrodedMetal');
    } },
    { wall: [0x4a4e56, 'CorrodedMetal'], floor: 0x1a1a1c, light: 0xff8a20, dress: (R) => { // the body shop
      R.sign(4, -1, 'BODY SHOP  ·  ALL WORK GUARANTEED', 6, 1, 8, 0x1a1a1c, 0xf2c818, true);
      every(R, 5, (t, k) => R.wall(t, k % 2 ? 1 : -1, 2.4, 2.2, 0.3, [0x2a4a6a, 0xc8322d, 0xd8d8d0, 0x3a5a2a][k % 4], 'Metal', { y0: 2 + (k % 3) }));
      every(R, 13, (t) => { R.wall(t, 1, 0.6, 7, 0.6, 0xf2c818, 'Metal'); R.put(t, 0.8, [3.6, 0.5, 0.5], 7, 0xf2c818, 'Metal'); R.put(t, 0, [0.1, 3, 0.1], 5.5, 0x3a3a3e, 'Metal'); R.put(t, 0, [1.6, 1.4, 1.6], 3.4, 0x3a3a3e, 'CorrodedMetal'); }, 6);
      every(R, 9, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.4, [0.3, 0.3, 0.3], 3, 0xffa020, 'Neon', { shape: 3 }), 4);
      twoActors(R, ['mechanic', 'greaseMonster'], 0x4a4e56, 'Metal');
    } },
    { wall: [0x2a2a2e, 'Brick'], floor: 0x16161a, light: 0xff3030, dress: (R) => { // the tow lot, out
      R.sign(R.len - 6, 1, 'OPEN 24 HRS', 4, 1.4, 7.5, 0x1a1a1c, 0xff3030, true);
      R.sign(10, -1, 'TOWED VEHICLES WILL BE CRUSHED', 5, 1, 7, 0xf2c818, 0x1a1a1a);
      every(R, 16, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 6, 2.6, 2.4, 0x6a2a20, 'CorrodedMetal', { y0: 0.6 }); R.wall(t + 0.5, sd, 3.4, 2, 2.2, 0x5a2420, 'CorrodedMetal', { y0: 3.2 }); }, 5);
      every(R, 8, (t, k) => R.fog(t, k % 2 ? -1 : 1), 6);
      twoActors(R, ['mechanic', 'greaseMonster'], 0x6a2a20, 'CorrodedMetal');
    } },
  ],
  mine: [
    { wall: [0x5a524a, 'Slate'], floor: 0x2a2420, light: 0xffb040, dress: (R) => {
      R.sign(4, 1, 'SHAFT 9  ·  CLOSED 1949', 5, 1.2, 7.5, 0x3a2a1c, 0xffb040);
      every(R, 4, (t) => { for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9, 0.8, 0x3a2a1c, 'Wood'); R.over(t, 0.9, 0.9, 9.4, 0x3a2a1c, 'Wood'); });
      every(R, 8, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.5, [0.5, 0.7, 0.5], 7.5, 0xffb040, 'Neon'), 6);
      every(R, 5, (t, k) => R.wall(t + 2, k % 2 ? 1 : -1, 2.4, 1.8 + (k % 3), 1.6, 0x4a4440, 'Slate', { shape: 3 }));
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 0.8, [0.2, 0.15, R.len - 4], 0.08, 0x5a5e66, 'Metal');
      twoActors(R, ['miner', 'miner'], 0x3a2a1c, 'Wood');
    } },
    { wall: [0x4a4440, 'Slate'], floor: 0x2a2420, light: 0xffa030, dress: (R) => {
      every(R, 4, (t) => { for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9, 0.8, 0x3a2a1c, 'Wood'); R.over(t, 0.9, 0.9, 9.4, 0x3a2a1c, 'Wood'); });
      every(R, 14, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.2, 2, 2.2, 0x5a5e66, 'CorrodedMetal', { y0: 0.4 }); for (let j = 0; j < 4; j++) R.wall(t - 1 + j * 0.7, sd, 0.8, 0.8, 1.6, 0x2a2420, 'Slate', { shape: 3, y0: 2.2 }); }, 6);
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 0.8, [0.2, 0.15, R.len - 4], 0.08, 0x5a5e66, 'Metal');
      every(R, 9, (t, k) => R.fog(t, k % 2 ? 1 : -1), 5);
      R.sign(R.len / 2, -1, 'DIG', 2, 1.2, 4, 0x2a2420, 0xc01010);
      twoActors(R, ['miner', 'miner'], 0x5a5e66, 'CorrodedMetal');
    } },
    { wall: [0x3a342e, 'Slate'], floor: 0x1a1612, light: 0x80a0ff, dress: (R) => { // the collapse and the underground river
      every(R, 3, (t, k) => R.wall(t, k % 2 ? 1 : -1, 2.4 + (k % 3), 2 + (k % 4), 1.8, 0x4a4440, 'Slate', { shape: 3 }));
      R.put(R.len / 2, -1.6, [1.6, 0.1, R.len - 4], 0.1, 0x2a4a7a, 'Glass');
      every(R, 6, (t) => R.over(t, 1.2, 1.2, 8.6 + Math.sin(t) * 0.6, 0x3a342e, 'Slate'));
      every(R, 7, (t, k) => R.fog(t, k % 2 ? 1 : -1), 3);
      R.sign(6, 1, 'DANGER: CAVE-IN', 4, 1, 6, 0xf2c818, 0x1a1a1a);
      twoActors(R, ['miner', 'miner'], 0x4a4440, 'Slate');
    } },
    { wall: [0x5a524a, 'Slate'], floor: 0x2a2420, light: 0xff6a20, dress: (R) => { // the dynamite store
      every(R, 4, (t) => { for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9, 0.8, 0x3a2a1c, 'Wood'); R.over(t, 0.9, 0.9, 9.4, 0x3a2a1c, 'Wood'); });
      every(R, 9, (t, k) => crates(R, t, k % 2 ? 1 : -1, 4), 5);
      every(R, 9, (t, k) => R.sign(t + 0.8, k % 2 ? 1 : -1, 'TNT', 1.4, 0.8, 1.6, 0xc8322d, 0xf4f0e0), 5);
      every(R, 13, (t, k) => R.fire(t, k % 2 ? -1 : 1), 8);
      twoActors(R, ['miner', 'miner'], 0x8a6a44, 'WoodPlanks');
    } },
    { wall: [0x3a342e, 'Slate'], floor: 0x1a1612, light: 0xffd040, dress: (R) => { // the helmet shrine
      R.sign(5, 1, 'THEY NEVER CAME HOME', 5, 1.2, 7, 0x1a1612, 0xffd040, true);
      every(R, 3, (t, k) => { const sd = k % 2 ? 1 : -1; for (let j = 0; j < 3; j++) R.wall(t, sd, 0.9, 0.5, 0.9, 0xf2c818, 'SmoothPlastic', { shape: 3, y0: 1.2 + j * 1.4 }); }, 4);
      every(R, 5, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.4, [0.3, 0.5, 0.3], 0.3, 0xffd040, 'Neon'), 3);
      cobwebs(R);
      twoActors(R, ['miner', 'miner'], 0x3a342e, 'Slate');
    } },
    { wall: [0x4a4440, 'Slate'], floor: 0x2a2420, light: 0xffb040, dress: (R) => {
      every(R, 4, (t) => { for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9, 0.8, 0x3a2a1c, 'Wood'); R.over(t, 0.9, 0.9, 9.4, 0x3a2a1c, 'Wood'); });
      every(R, 16, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 2.6, 2.2, 1.8, 0x5a5e66, 'Metal'); R.wall(t, sd, 2, 0.4, 2, 0x2a2a2e, 'Metal', { y0: 2.2 }); R.put(t, sd * 1.4, [0.4, 0.4, 0.4], 3, 0xff6a10, 'Neon', { shape: 3 }); }, 5);
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 5);
      twoActors(R, ['miner', 'miner'], 0x5a5e66, 'Metal');
    } },
    { wall: [0x5a524a, 'Slate'], floor: 0x2a2420, light: 0xffe0a0, dress: (R) => { // the way out: daylight at the end
      every(R, 4, (t) => { for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9, 0.8, 0x3a2a1c, 'Wood'); R.over(t, 0.9, 0.9, 9.4, 0x3a2a1c, 'Wood'); });
      R.sign(R.len - 5, 1, 'EXIT  ·  SURFACE', 4, 1, 7, 0x3a2a1c, 0xfff4c0, true);
      every(R, 6, (t, k) => R.wall(t + 2, k % 2 ? 1 : -1, 2, 1.6, 1.4, 0x4a4440, 'Slate', { shape: 3 }));
      twoActors(R, ['miner', 'miner'], 0x3a2a1c, 'Wood');
    } },
  ],
  film: [
    { wall: [0x6a1a22, 'Fabric'], floor: 0x4a0a10, light: 0xffd27a, dress: (R) => { // the lobby
      R.sign(4, 1, 'TONIGHT: FINAL CUT', 5, 1.4, 7.5, 0x1a1a1c, 0xffd27a, true);
      R.put(R.len / 2, 0, [2.4, 0.06, R.len - 2], 0.06, 0x8a0a14, 'Fabric');
      every(R, 4, (t, k) => { R.wall(t, 1, 0.3, 2.6, 0.3, 0xd8b060, 'Metal'); R.wall(t, -1, 0.3, 2.6, 0.3, 0xd8b060, 'Metal'); });
      every(R, 7, (t, k) => { R.sign(t, k % 2 ? 1 : -1, ['SCREAM QUEEN', 'THE CUT', 'NO RETAKES', 'LAST REEL'][k % 4], 2.4, 3.4, 5, 0x1a0a0c, 0xe03030); R.wall(t, k % 2 ? 1 : -1, 2.8, 3.8, 0.12, 0xd8b060, 'Metal', { y0: 3.1 }); }, 5);
      every(R, 6, (t) => R.put(t, 0, [0.6, 0.6, 0.6], 9.4, 0xfff2c0, 'Neon', { shape: 3 }));
      twoActors(R, ['slasher', 'zombieExtra'], 0x8a1c22, 'Fabric');
    } },
    { wall: [0x2a2a2e, 'WoodPlanks'], floor: 0x1a1a1c, light: 0x80a0ff, dress: (R) => { // backstage: flats, rigging, sandbags
      every(R, 5, (t, k) => R.wall(t, k % 2 ? 1 : -1, 3.6, 8, 0.3, [0x8a8a7a, 0x6a7a8a, 0x8a7a6a][k % 3], 'WoodPlanks', { y0: 0 }));
      every(R, 3, (t, k) => R.put(t, (k % 3 - 1) * 1.6, [0.06, CORRIDOR_H - 1, 0.06], CORRIDOR_H / 2 + 0.3, 0xc8b890, 'Fabric'));
      every(R, 8, (t, k) => { for (let j = 0; j < 3; j++) R.wall(t + j * 0.9, k % 2 ? -1 : 1, 0.8, 0.6, 1, 0xa89870, 'Fabric', { y0: j * 0.2 }); });
      R.sign(6, -1, 'QUIET ON SET', 4, 1, 7, 0xc01010, 0xf4f0e0, true);
      twoActors(R, ['slasher', 'director'], 0x6a7a8a, 'WoodPlanks');
    } },
    { wall: [0x5a3a24, 'WoodPlanks'], floor: 0x2a1a10, light: 0xff4a2a, dress: (R) => { // the cabin set from the movie
      R.sign(4, 1, 'SET B  ·  THE CABIN', 4, 1, 8, 0x1a1a1c, 0xf4f0e0);
      every(R, 9, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 2.4, 2.6, 1.6, 0x6a4428, 'Wood'); R.wall(t, sd, 2.4, 0.4, 2, 0x8a6a44, 'Wood', { y0: 2.6 }); }, 4);
      every(R, 12, (t, k) => R.fire(t, k % 2 ? -1 : 1), 7);
      every(R, 6, (t, k) => R.wall(t, k % 2 ? -1 : 1, 1.6, 2, 0.1, 0x9a0a0a, 'SmoothPlastic', { y0: 2 + (k % 3) }), 3);
      R.sign(R.len / 2, -1, 'GET OUT', 3, 1.2, 4.5, 0x5a3a24, 0xc01010);
      cobwebs(R); twoActors(R, ['slasher', 'slasher'], 0x6a4428, 'Wood');
    } },
    { wall: [0x1a1a1c, 'SmoothPlastic'], floor: 0x0a0a0c, light: 0x40c0ff, dress: (R) => { // the editing room
      every(R, 5, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3, 2.6, 1.4, 0x2a2a2e, 'Metal'); R.wall(t, sd, 2.4, 1.6, 0.1, 0x40c0ff, 'Neon', { y0: 3.6 }); });
      every(R, 4, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.2, [0.2, 1.4, 1.4], 8.5 - (k % 3), 0x1a1a1a, 'Metal', { shape: 2 }));
      every(R, 3, (t, k) => R.put(t, (k % 3 - 1) * 1.5, [0.04, 3, 0.3], 9, 0x4a3a2a, 'SmoothPlastic'));
      twoActors(R, ['zombieExtra', 'slasher'], 0x2a2a2e, 'Metal');
    } },
    { wall: [0x6a4a5a, 'Fabric'], floor: 0x2a1a20, light: 0xfff0c0, dress: (R) => { // the dressing rooms
      every(R, 6, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 2.4, 2.6, 0.12, 0xb8c8d8, 'Glass', { y0: 3 }); for (let j = 0; j < 5; j++) R.wall(t - 1.2 + j * 0.6, sd, 0.25, 0.25, 0.25, 0xfff0c0, 'Neon', { shape: 3, y0: 5.8 }); R.wall(t, sd, 2.6, 2.6, 1.2, 0x3a2a24, 'Wood'); });
      every(R, 11, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2, [0.6, 3.6, 0.6], 1.8, 0xd8c0a8, 'SmoothPlastic', { shape: 5 }));
      twoActors(R, ['zombieExtra', 'zombieExtra'], 0x3a2a24, 'Wood');
    } },
    { wall: [0x2a0e12, 'Fabric'], floor: 0x1a0a0c, light: 0xff2030, dress: (R) => { // the cutting room floor
      every(R, 3, (t, k) => R.put(t, (k % 3 - 1) * 1.5, [0.04, 4 + (k % 3), 0.35], 9 - (k % 3), 0x2a2018, 'SmoothPlastic'));
      every(R, 8, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.2, 1.2, 1.2, 0x3a3a3e, 'Metal', { shape: 5 }));
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      R.sign(R.len / 2, 1, "THAT'S A WRAP", 4, 1, 6, 0x1a0a0c, 0xff2030, true);
      twoActors(R, ['slasher', 'director'], 0x2a0e12, 'Fabric');
    } },
    { wall: [0x1a1a1c, 'Fabric'], floor: 0x0a0a0c, light: 0xfff6d8, dress: (R) => { // the premiere screen
      R.wall(R.len / 2, 1, R.len - 8, 6, 0.12, 0xfff6d8, 'Neon', { y0: 2.5 });
      R.sign(R.len / 2, 1, 'FINAL CUT', 10, 3, 5.5, 0xfff6d8, 0x1a1a1c);
      every(R, 2.5, (t, k) => R.wall(t, -1, 2, 1.4, 1.6, 0x8a1c22, 'Fabric', { y0: 0.4 }));
      twoActors(R, ['zombieExtra', 'slasher'], 0x8a1c22, 'Fabric');
    } },
  ],
  crash: [
    { wall: [0xe8e8e4, 'SmoothPlastic'], floor: 0x2a2a2e, light: 0xf2f2ff, dress: (R) => { // the test lab
      R.sign(4, 1, 'BENTON SAFETY LAB  ·  TEST 413', 6, 1, 8, 0x1a1a1c, 0xf2c818, true);
      every(R, 2.4, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.2, 0.5, 0.1, k % 4 < 2 ? 0xf2c818 : 0x1a1a1a, 'SmoothPlastic', { y0: 1 }));
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 1.2, [0.3, 0.2, R.len - 4], 0.1, 0x8a8e96, 'Metal');
      every(R, 9, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3, 2.4, 1.4, 0x3a3a3e, 'Metal'); R.wall(t, sd, 2.4, 1.4, 0.1, 0x40ff60, 'Neon', { y0: 3.2 }); }, 5);
      twoActors(R, ['dummy', 'dummy'], 0x3a3a3e, 'Metal');
    } },
    { wall: [0xd8d8d4, 'SmoothPlastic'], floor: 0x2a2a2e, light: 0xf2c818, dress: (R) => { // dummy storage: rows of hanging dummies
      every(R, 3, (t, k) => {
        const sd = (k % 2 ? 1 : -1) * 2.2;
        R.put(t, sd, [0.9, 2.2, 0.6], 6, 0xf2c818, 'SmoothPlastic'); R.put(t, sd, [0.7, 0.7, 0.7], 7.7, 0xf2c818, 'SmoothPlastic', { shape: 3 });
        R.put(t, sd, [0.06, 3, 0.06], 9.6, 0x3a3a3e, 'Metal');
        for (const l of [-0.25, 0.25]) R.put(t, sd + l, [0.3, 2, 0.3], 4, 0x2a2a2e, 'SmoothPlastic');
      });
      twoActors(R, ['dummy', 'dummy'], 0xf2c818, 'SmoothPlastic');
    } },
    { wall: [0x2a2a2e, 'SmoothPlastic'], floor: 0x1a1a1c, light: 0xff2020, dress: (R) => { // the impact wall
      every(R, 1.8, (t, k) => R.wall(t, 1, 1.8, CORRIDOR_H - 1, 0.6, k % 2 ? 0xf2c818 : 0x1a1a1a, 'SmoothPlastic'));
      every(R, 14, (t) => { R.wall(t, -1, 5, 2.6, 2.2, 0x3a5a8a, 'Metal', { y0: 0.4 }); R.wall(t - 1, -1, 2.6, 1.6, 2, 0x2a4a6a, 'Metal', { y0: 3 }); R.put(t + 2.6, -1, [2, 0.2, 2], 0.1, 0xc8ccd4, 'Glass'); }, 5);
      every(R, 6, (t) => R.put(t, 0, [0.5, 0.5, 0.5], 9.6, 0xff2020, 'Neon', { shape: 3 }));
      every(R, 12, (t, k) => R.fog(t, k % 2 ? 1 : -1), 6);
      twoActors(R, ['dummy', 'dummy'], 0x3a5a8a, 'Metal');
    } },
    { wall: [0x3a3e46, 'Metal'], floor: 0x1a1a1c, light: 0x40ff60, dress: (R) => { // the control room
      every(R, 4, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.4, 2.4, 1.6, 0x2a2a2e, 'Metal'); for (let j = 0; j < 3; j++) R.wall(t - 1 + j, sd, 0.8, 0.6, 0.1, [0x40ff60, 0xff2020, 0x40c0ff][(k + j) % 3], 'Neon', { y0: 3.2 + (j % 2) * 0.8 }); });
      R.sign(R.len / 2, 1, 'IMPACT IN 00:03', 4, 1.2, 7.5, 0x1a1a1c, 0xff2020, true);
      twoActors(R, ['dummy', 'dummy'], 0x2a2a2e, 'Metal');
    } },
    { wall: [0xe8e8e4, 'SmoothPlastic'], floor: 0x2a2a2e, light: 0xffffff, dress: (R) => { // the sled track
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 1.1, [0.4, 0.3, R.len - 4], 0.15, 0x5a5e66, 'Metal');
      every(R, 3, (t, k) => R.wall(t, k % 2 ? 1 : -1, 0.4, 0.4, 0.4, 0xfff6d8, 'Neon', { y0: 8 }));
      every(R, 20, (t) => { R.put(t, 0, [3, 1.4, 4], 0.9, 0x3a3a3e, 'Metal'); R.put(t, 0, [1, 2, 0.8], 2.6, 0xf2c818, 'SmoothPlastic'); R.put(t, 0, [0.7, 0.7, 0.7], 4.1, 0xf2c818, 'SmoothPlastic', { shape: 3 }); }, 8);
      twoActors(R, ['dummy', 'dummy'], 0x3a3a3e, 'Metal');
    } },
    { wall: [0x2a2a2e, 'DiamondPlate'], floor: 0x1a1a1c, light: 0xff8a20, dress: (R) => { // the scrap pile
      every(R, 4, (t, k) => { for (let j = 0; j < 2; j++) R.wall(t, k % 2 ? 1 : -1, 3, 1.4, 2, [0x3a5a8a, 0xf2c818, 0x8a8e96][(k + j) % 3], 'Metal', { y0: j * 1.4 }); });
      every(R, 7, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 0.8, [0.7, 0.7, 0.7], 0.35, 0xf2c818, 'SmoothPlastic', { shape: 3 }));
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      twoActors(R, ['dummy', 'dummy'], 0x3a5a8a, 'Metal');
    } },
    { wall: [0x1a1a1c, 'SmoothPlastic'], floor: 0x0a0a0c, light: 0xff2020, dress: (R) => { // the final crash
      R.sign(R.len - 6, -1, 'TEST COMPLETE', 4, 1, 7, 0x1a1a1c, 0x40ff60, true);
      every(R, 5, (t, k) => R.put(t, 0, [0.4, 0.4, 0.4], 9.6, k % 2 ? 0xff2020 : 0xf2c818, 'Neon', { shape: 3 }));
      every(R, 12, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 5, 2.4, 2.4, 0xc8322d, 'Metal', { y0: 0.4 }); R.wall(t, sd, 1.2, 1.2, 1.2, 0x1a1a1a, 'Rubber', { shape: 5, y0: 0 }); }, 6);
      twoActors(R, ['dummy', 'dummy'], 0xc8322d, 'Metal');
    } },
  ],
  engine: [
    { wall: [0x2a2c30, 'DiamondPlate'], floor: 0x1a1a1c, light: 0xff6a10, dress: (R) => { // the factory floor
      R.sign(4, 1, 'BENTON ENGINE WORKS  ·  NIGHT SHIFT', 6, 1, 8, 0x1a1a1c, 0xff6a10, true);
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 2.4, [0.6, 0.6, R.len], 9.6, 0x5a5e66, 'Metal', { shape: 0 });
      every(R, 5, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1, 1, 0.2, 0xf4f0e0, 'SmoothPlastic', { shape: 2, y0: 5 }));
      every(R, 8, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 2.4, 2.6, 1.8, 0x3a3e46, 'Metal'); R.wall(t, sd, 1.6, 1.4, 1.2, 0x5a3a2a, 'CorrodedMetal', { y0: 2.6 }); });
      every(R, 11, (t, k) => R.fog(t, k % 2 ? -1 : 1), 5);
      twoActors(R, ['welder', 'welder'], 0x3a3e46, 'Metal');
    } },
    { wall: [0x3a1a10, 'Brick'], floor: 0x1a0a06, light: 0xff4a10, dress: (R) => { // the furnace
      R.sign(4, -1, 'FURNACE 2  ·  DO NOT OPEN', 5, 1, 8, 0x1a1a1c, 0xff4a10, true);
      every(R, 7, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.4, 5, 2.2, 0x2a1a14, 'Brick'); R.wall(t, sd, 2, 1.6, 0.1, 0xff6a10, 'Neon', { y0: 1.4 }); }, 4);
      every(R, 12, (t, k) => R.fire(t, k % 2 ? 1 : -1), 8);
      every(R, 9, (t, k) => R.fog(t, k % 2 ? -1 : 1), 6);
      twoActors(R, ['welder', 'welder'], 0x2a1a14, 'Brick');
    } },
    { wall: [0x3a3e46, 'Metal'], floor: 0x1a1a1c, light: 0xffa030, dress: (R) => { // the assembly line
      R.put(R.len / 2, -1.9, [1.6, 1.4, R.len - 4], 0.7, 0x2a2a2e, 'Metal');
      every(R, 4, (t) => R.put(t, -1.9, [1.2, 1.2, 1.6], 2, 0x4a4e56, 'CorrodedMetal'));
      every(R, 6, (t) => R.over(t, 0.5, 0.5, 9, 0x5a5e66, 'Metal'));
      every(R, 6, (t, k) => R.put(t, -1.9, [0.1, 2.4, 0.1], 7.5, 0x3a3a3e, 'Metal'), 3);
      twoActors(R, ['welder', 'welder'], 0x4a4e56, 'Metal');
    } },
    { wall: [0x2a2c30, 'CorrodedMetal'], floor: 0x161616, light: 0xc0e0ff, dress: (R) => { // the boiler room
      every(R, 9, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.6, 6, 2.4, 0x5a3a2a, 'CorrodedMetal', { shape: 5 }); R.wall(t, sd, 1, 1, 0.2, 0xf4f0e0, 'SmoothPlastic', { shape: 2, y0: 6.4 }); });
      every(R, 5, (t, k) => R.fog(t, k % 2 ? 1 : -1));
      for (const sd of [-1, 1]) R.put(R.len / 2, sd * 2.6, [0.5, 0.5, R.len], 8.5, 0x6a4a3a, 'CorrodedMetal');
      twoActors(R, ['welder', 'welder'], 0x5a3a2a, 'CorrodedMetal');
    } },
    { wall: [0x1a1a1c, 'DiamondPlate'], floor: 0x0a0a0c, light: 0xff1010, dress: (R) => { // alarms in the control room
      R.sign(R.len / 2, 1, 'MELTDOWN IMMINENT', 5, 1.2, 7.5, 0x1a1a1c, 0xff1010, true);
      every(R, 4, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3, 2.4, 1.6, 0x2a2a2e, 'Metal'); R.wall(t, sd, 2.4, 0.6, 0.1, 0xff1010, 'Neon', { y0: 3 }); });
      every(R, 6, (t) => R.put(t, 0, [0.6, 0.6, 0.6], 9.6, 0xff1010, 'Neon', { shape: 3 }));
      twoActors(R, ['welder', 'welder'], 0x2a2a2e, 'Metal');
    } },
    { wall: [0x2a1a14, 'Brick'], floor: 0x1a0a06, light: 0xff6a10, dress: (R) => { // the molten floor
      every(R, 5, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.4, [1.6, 0.06, 2.6], 0.08, 0xff4a10, 'Neon'));
      every(R, 10, (t, k) => R.fire(t, k % 2 ? 1 : -1), 4);
      every(R, 7, (t, k) => R.fog(t, k % 2 ? -1 : 1), 3);
      twoActors(R, ['welder', 'welder'], 0x2a1a14, 'Brick');
    } },
    { wall: [0x2a2c30, 'DiamondPlate'], floor: 0x1a1a1c, light: 0xffa030, dress: (R) => { // shift change, out
      R.sign(R.len - 6, 1, 'CLOCK OUT', 3, 1, 7, 0x1a1a1c, 0xffa030, true);
      every(R, 3, (t, k) => R.wall(t, k % 2 ? 1 : -1, 1.4, 6, 0.8, 0x5a6a5a, 'Metal'));
      twoActors(R, ['welder', 'welder'], 0x5a6a5a, 'Metal');
    } },
  ],
  destination: [
    { wall: [0x5a6a7a, 'SmoothPlastic'], floor: 0x2a2e3a, light: 0xfff0d0, dress: (R) => { // Gate 47: the premonition starts here
      R.sign(4, 1, 'GATE 47  ·  FLIGHT 180  ·  PARIS', 6, 1.2, 8, 0x0a0a0c, 0xffc040, true);
      every(R, 4.5, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.4, 1, 1.4, 0x2a3a6a, 'Plastic', { y0: 1 }); R.wall(t, sd, 3.4, 1.6, 0.3, 0x2a3a6a, 'Plastic', { y0: 2 }); R.wall(t, sd, 0.3, 1, 1.2, 0x8a8e96, 'Metal'); }, 3);
      every(R, 9, (t, k) => R.sign(t, k % 2 ? -1 : 1, k % 3 === 2 ? '180  PARIS  DEATH' : '180  PARIS  DELAYED', 4, 1, 7, 0x0a0a0c, 0xe02020, true), 6);
      every(R, 10, (t) => R.wall(t, 1, 6, 5, 0.2, 0x1a2a3a, 'Glass', { y0: 3.5 }), 8);
      R.sign(R.len - 6, -1, 'BREAKING NEWS: NO SURVIVORS', 4.6, 1.2, 6, 0x101418, 0xffffff, true);
      twoActors(R, ['flightAttendant', 'passenger'], 0x2a3a6a, 'Plastic');
    } },
    { wall: [0xd8d8d0, 'SmoothPlastic'], floor: 0x2a3a5a, light: 0xff4020, dress: (R) => { // Flight 180: the cabin tears open
      every(R, 2.4, (t, k) => { for (const sd of [-1, 1]) { R.wall(t, sd, 1.4, 2.2, 1.9, 0x2a3a6a, 'Fabric', { y0: 0.4 }); R.wall(t - 0.6, sd, 0.3, 3.4, 1.9, 0x2a3a6a, 'Fabric'); } });
      for (const sd of [-1, 1]) R.wall(R.len / 2, sd, R.len - 2, 1.4, 1.6, 0xe8e8e0, 'SmoothPlastic', { y0: 7.4 });
      every(R, 3, (t, k) => { const sd = k % 2 ? 1 : -1; R.put(t, sd * 1.7, [0.05, 1.4, 0.05], 6.6, 0xf2f2f2, 'Plastic'); R.put(t, sd * 1.7, [0.4, 0.3, 0.4], 5.8, 0xf2c818, 'SmoothPlastic'); });
      R.sign(3, 1, 'FASTEN SEATBELT', 2.4, 0.7, 8.6, 0x101012, 0xffd27a, true);
      every(R, 16, (t, k) => { R.fire(t, k % 2 ? 1 : -1); R.over(t + 1, 2, 0.5, 9.8, 0x1a1a1a, 'CorrodedMetal'); }, 10);
      every(R, 7, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      R.wall(R.len - 3, 1, 3, 6, 0.2, 0x050505, 'SmoothPlastic', { y0: 2 }); // the tear in the fuselage
      twoActors(R, ['passenger', 'flightAttendant'], 0x2a3a6a, 'Fabric');
    } },
    { wall: [0x2a2c30, 'Concrete'], floor: 0x18181a, light: 0xff2a1a, dress: (R) => { // Route 23: the logs come loose
      every(R, 4, (t) => R.put(t, 0, [0.3, 0.04, 2], 0.06, 0xf2c818, 'SmoothPlastic'), 2);
      every(R, 9, (t, k) => R.put(t, 0, [W2, 1.7, 1.7], 6.5 + (k % 3) * 1.1, 0x7a5434, 'Wood', { shape: 2, turn: (k % 2 ? 0.25 : -0.2) }), 6);
      every(R, 11, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 5.4, 2.6, 2, [0x8a2a22, 0x2a4a8a, 0x6a6a6e][k % 3], 'Metal'); R.wall(t - 2.8, sd, 0.2, 0.6, 1.4, 0xff2020, 'Neon', { y0: 1.4 }); }, 4);
      R.sign(4, -1, 'ROUTE 23  ·  NORTH', 4.4, 1.6, 7.5, 0x1e6a3a, 0xffffff);
      every(R, 6, (t, k) => R.fog(t, k % 2 ? 1 : -1), 3);
      hangChains(R, 7, 0x5a5e66);
      twoActors(R, ['trucker', 'passenger'], 0x6a6a6e, 'Metal');
    } },
    { wall: [0x2a0a0a, 'WoodPlanks'], floor: 0x140a0a, light: 0xffb030, dress: (R) => { // Devil's Flight: the restraints give way
      every(R, 1.6, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 2.7, [0.3, 0.3, 0.3], 9.6, [0xffd040, 0xff3030, 0xffffff][k % 3], 'Neon', { shape: 3 }));
      for (const sd of [-1.1, 1.1]) R.put(R.len / 2, sd, [0.3, 0.3, R.len - 2], 10.2, 0xb8bcc0, 'Metal');
      every(R, 14, (t, k) => { R.put(t, 0, [3.6, 2.2, 4.6], 7.6, 0xc81e1e, 'SmoothPlastic', { turn: k % 2 ? 0.3 : -0.3 }); R.put(t, 0, [3.8, 0.3, 0.3], 9, 0x1a1a1a, 'Metal'); }, 7);
      R.sign(4, 1, "DEVIL'S FLIGHT", 5, 1.6, 7, 0x1a0a0a, 0xff3030, true);
      R.sign(R.len / 2, -1, 'YOU MUST BE THIS TALL TO DIE', 4, 1, 5, 0xf2c818, 0x1a0a0a);
      every(R, 13, (t, k) => R.wall(t, k % 2 ? -1 : 1, 0.6, 0.6, 0.3, 0xff2020, 'Neon', { y0: 3 }), 5);
      twoActors(R, ['coasterOp', 'passenger'], 0x5a1a1a, 'WoodPlanks');
    } },
    { wall: [0xe8e0d0, 'SmoothPlastic'], floor: 0x7a7a76, light: 0x6ab8ff, dress: (R) => { // the tanning salon: thirteen minutes
      every(R, 8, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 5, 1.8, 2.2, 0xf4f4f0, 'SmoothPlastic'); R.wall(t, sd, 4.8, 0.2, 2, 0x6ab8ff, 'Neon', { y0: 1.8 }); R.wall(t, sd, 5, 0.6, 2.2, 0xf4f4f0, 'SmoothPlastic', { y0: 3.6 }); }, 4);
      every(R, 10, (t, k) => { R.put(t, 0, [0.1, 0.3, 3.4], 9.4, 0xd8d8d8, 'Metal'); R.put(t, 0, [0.4, 1, 0.4], 9.9, 0x8a8e96, 'Metal'); }, 7);
      every(R, 12, (t, k) => { const sd = k % 2 ? -1 : 1; R.wall(t, sd, 3, 0.2, 0.9, 0x8a6a4a, 'Wood', { y0: 5.4 }); for (let j = 0; j < 3; j++) R.wall(t - 1 + j, sd, 0.4, 0.9, 0.4, [0xf2c818, 0x2a6ae0, 0xe02020][j], 'Glass', { y0: 5.6 }); }, 10);
      R.sign(4, -1, 'SUN SHOP TANNING  ·  MAX 13 MIN', 5, 1.2, 7.5, 0x101418, 0x6ab8ff, true);
      R.sign(R.len - 5, 1, 'TIMER BROKEN', 3, 1, 6.5, 0xf4f0e0, 0xc81e1e);
      every(R, 9, (t, k) => R.fog(t, k % 2 ? 1 : -1), 5);
      twoActors(R, ['tanner', 'shadow'], 0xf4f4f0, 'SmoothPlastic');
    } },
    { wall: [0xc85a1a, 'Metal'], floor: 0x4a4a4e, light: 0xc0d8ff, dress: (R) => { // North Bay Bridge: it gives way
      every(R, 6, (t) => { R.over(t, 0.8, 0.8, 9.6, 0xc85a1a, 'Metal'); for (const sd of [-1, 1]) R.wall(t, sd, 0.8, 9.6, 0.8, 0xc85a1a, 'Metal'); });
      every(R, 3, (t, k) => R.put(t, (k % 3 - 1) * 1.5, [1.2 + (k % 2), 0.05, 0.2], 0.07, 0x050505, 'SmoothPlastic', { turn: k }), 3);
      for (const sd of [-1, 1]) R.wall(R.len / 2, sd, R.len - 2, 0.3, 0.6, 0x2a4a7a, 'Glass', { y0: 0.05 });
      R.sign(4, 1, 'NORTH BAY BRIDGE  ·  LANE CLOSED', 5, 1.2, 7, 0xf2c818, 0x1a1a1a);
      every(R, 5, (t, k) => R.fog(t, k % 2 ? 1 : -1));
      every(R, 15, (t, k) => R.put(t, (k % 2 ? 1 : -1) * 1.5, [0.1, 6, 0.1], 7, 0x8a8e96, 'Metal', { turn: 0.5 }), 8);
      twoActors(R, ['passenger', 'shadow'], 0xc85a1a, 'Metal');
    } },
    { wall: [0x3a4a48, 'Concrete'], floor: 0x1a2422, light: 0x9affd8, dress: (R) => { // the morgue: Bludworth and the List
      every(R, 3.2, (t, k) => { for (const y of [1, 3.2, 5.4]) R.wall(t, k % 2 ? 1 : -1, 2.8, 2, 0.3, 0x8a9096, 'Metal', { y0: y }); }, 3);
      every(R, 12, (t, k) => { R.put(t, 0, [1.8, 0.8, 4.4], 2.6, 0x8a9096, 'Metal'); R.put(t, 0, [1.4, 0.6, 4], 3.2, 0x1a1a1c, 'Plastic'); }, 8);
      every(R, 2, (t, k) => R.wall(t, -1, 0.9, 0.7, 0.05, 0xf4f0e0, 'SmoothPlastic', { y0: 5 + (k % 3) * 1.1 }), R.len - 14);
      R.put(R.len - 8, -(HALF - 0.4), [0.05, 0.08, 10], 6.3, 0xc81e1e, 'Neon');
      R.sign(R.len - 8, -1, 'THE LIST', 3, 0.9, 8.6, 0x101012, 0xc81e1e, true);
      R.sign(5, 1, "YOU CAN'T CHEAT DEATH", 5, 1.2, 8, 0x101012, 0xe02020, true);
      every(R, 10, (t, k) => R.fog(t, k % 2 ? 1 : -1), 5);
      twoActors(R, ['bludworth', 'shadow'], 0x8a9096, 'Metal');
    } },
  ],
  lodge: [
    { wall: [0x5a3a24, 'WoodPlanks'], floor: 0x2a1a10, light: 0xffb040, dress: (R) => { // the lodge hall
      R.sign(4, 1, 'WELCOME TO CAMP LAKESIDE', 5, 1.2, 7.5, 0x3a2418, 0xffb040);
      every(R, 4, (t, k) => R.wall(t, k % 2 ? 1 : -1, 3, 0.2, 0.12, 0x3a2418, 'Wood', { y0: 3 + (k % 3) }));
      every(R, 14, (t, k) => { const sd = k % 2 ? 1 : -1; R.wall(t, sd, 3.4, 3.4, 1.4, 0x6a6a66, 'Cobblestone'); R.fire(t, sd); }, 7);
      every(R, 10, (t, k) => { const sd = k % 2 ? -1 : 1; R.wall(t, sd, 1, 1, 0.6, 0x5a3a24, 'Wood', { y0: 6 }); for (const a of [-1, 1]) R.wall(t + a * 0.6, sd, 0.12, 1.4, 0.12, 0xd8c8a0, 'Wood', { y0: 6.8 }); }, 4);
      cobwebs(R); twoActors(R, ['lakeGhost', 'camper'], 0x5a3a24, 'Wood');
    } },
    { wall: [0x4a3020, 'WoodPlanks'], floor: 0x1a120c, light: 0x80c0ff, dress: (R) => { // the cabins: bunk beds
      every(R, 6, (t, k) => { const sd = k % 2 ? 1 : -1; for (const y of [0.8, 3.6]) { R.wall(t, sd, 4, 0.5, 2, 0x5a3a24, 'Wood', { y0: y }); R.wall(t, sd, 3.8, 0.4, 1.8, 0x3a5a8a, 'Fabric', { y0: y + 0.5 }); } R.wall(t + 2, sd, 0.4, 5, 0.4, 0x5a3a24, 'Wood'); });
      R.sign(R.len / 2, 1, 'CABIN 6', 2.4, 1, 7, 0x3a2418, 0xd8f0ff);
      every(R, 9, (t, k) => R.fog(t, k % 2 ? 1 : -1), 4);
      twoActors(R, ['lakeGhost', 'lakeGhost'], 0x5a3a24, 'Wood');
    } },
    { wall: [0x2a3a4a, 'WoodPlanks'], floor: 0x1a2a3a, light: 0x80b0ff, dress: (R) => { // the dock and the lake
      every(R, 1.2, (t) => R.put(t, 0, [W2, 0.12, 1], 0.06, 0x6a5038, 'WoodPlanks'));
      R.put(R.len / 2, -2.4, [1, 0.1, R.len - 2], 0.04, 0x2a4a7a, 'Glass');
      every(R, 12, (t, k) => { R.wall(t, k % 2 ? 1 : -1, 0.6, 7, 3, 0x8a3a22, 'Wood', { y0: 2 }); }, 4);
      every(R, 4, (t, k) => R.wall(t, -1, 0.2, 2.4 + (k % 3), 0.2, 0x5a7a3a, 'Grass'));
      every(R, 5, (t, k) => R.fog(t, k % 2 ? 1 : -1));
      R.sign(R.len - 5, 1, 'NO SWIMMING AFTER DARK', 5, 1, 6, 0xf4f0e0, 0x8a1c22);
      twoActors(R, ['camper', 'lakeGhost'], 0x5a3a24, 'Wood');
    } },
  ],
};
const W2 = HALF * 2 - 0.8;

export function buildHouses(data, familyLayout) {
  const mats = data.materials;
  const mi = (name) => {
    let i = mats.indexOf(name);
    if (i < 0) { mats.push(name); i = mats.length - 1; }
    return i;
  };
  const add = (size, pos, color, mat, { yaw = 0, collide = 1, shape = 0 } = {}) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    data.static.push([shape, size[0], size[1], size[2], pos[0], pos[1], pos[2], c, 0, s, 0, 1, 0, -s, 0, c, color, mi(mat), 0, collide]);
    return data.static.length - 1;
  };
  const box = (size, base, color, mat, opts) => add(size, [base[0], base[1] + size[1] / 2, base[2]], color, mat, opts);
  const houses = [];
  data.tags.SteamVent = data.tags.SteamVent || [];

  // Corridor walls both sides of a right-angled polyline (mitred corners),
  // each segment in its room's wall finish, a blackout ceiling over it and
  // a dark floor.
  const corridor = (pts, styleOf) => {
    const n = pts.length;
    const normal = (a, b) => {
      const l = dist(a, b) || 1;
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    };
    for (const side of [-1, 1]) {
      const off = pts.map((p, i) => {
        const n1 = i > 0 ? normal(pts[i - 1], p) : normal(p, pts[i + 1]);
        const n2 = i < n - 1 ? normal(p, pts[i + 1]) : n1;
        const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
        return [p[0] + (side * HALF * (n1[0] + n2[0])) / d, p[1] + (side * HALF * (n1[1] + n2[1])) / d];
      });
      for (let i = 0; i < n - 1; i++) {
        const a = off[i], b = off[i + 1];
        const len = dist(a, b) + 0.6;
        const [color, mat] = styleOf(i).wall;
        add([0.6, CORRIDOR_H, len], [(a[0] + b[0]) / 2, G + CORRIDOR_H / 2, (a[1] + b[1]) / 2], color, mat, { yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = dist(a, b) + HALF * 2;
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      add([HALF * 2 + 0.6, 0.3, len], [(a[0] + b[0]) / 2, G + CORRIDOR_H + 0.15, (a[1] + b[1]) / 2], 0x0a0a0c, 'SmoothPlastic', { yaw, collide: 0 });
      add([HALF * 2, 0.04, len], [(a[0] + b[0]) / 2, G + 0.03, (a[1] + b[1]) / 2], styleOf(i).floor || 0x141216, 'SmoothPlastic', { yaw, collide: 0 });
    }
  };

  // Set dressing along one corridor segment, a -> b: t runs along it, s
  // across it (+ is to the left as you walk).
  const room = (a, b, land) => {
    const len = dist(a, b), d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], nrm = [-d[1], d[0]];
    const yaw = Math.atan2(d[0], d[1]);
    const at = (t, s) => [a[0] + d[0] * t + nrm[0] * s, a[1] + d[1] * t + nrm[1] * s];
    const W = HALF - 0.3; // the inside face of the walls
    const R = {
      len,
      // a box against a wall: `along` x `h` x `depth` out from the wall
      wall: (t, side, along, h, depth, color, mat, { y0 = 0, shape = 0 } = {}) => {
        const [x, z] = at(t, side * (W - depth / 2));
        return add([depth, h, along], [x, G + y0 + h / 2, z], color, mat, { yaw, shape, collide: 0 });
      },
      // a box anywhere: s across, y up
      put: (t, s, size, y, color, mat, { shape = 0, turn = 0 } = {}) => {
        const [x, z] = at(t, s);
        return add(size, [x, G + y, z], color, mat, { yaw: yaw + turn, shape, collide: 0 });
      },
      // across the corridor overhead
      over: (t, along, h, y, color, mat) => R.put(t, 0, [W * 2, h, along], y, color, mat),
      light: (t, color, y = CORRIDOR_H - 0.7) => {
        const [x, z] = at(t, 0);
        (data.hauntLights = data.hauntLights || []).push([x, G + y - 1.5, z, color]);
        return R.put(t, 0, [0.8, 0.8, 0.8], y, color, 'Neon', { shape: 3 });
      },
      glowStrip: (t0, t1, side, color) => R.put((t0 + t1) / 2, side * (W - 0.05), [0.1, 0.25, t1 - t0], 0.3, color, 'Neon'),
      fog: (t, side) => {
        const [x, z] = at(t, side * (W - 0.8));
        data.tags.SteamVent.push([x, G + 0.4, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      },
      fire: (t, side) => {
        const [x, z] = at(t, side * (W - 1));
        box([1.6, 1.8, 1.6], [x, G, z], 0x3a2a20, 'CorrodedMetal', { shape: 5, collide: 0 });
        data.tags.Campfire = data.tags.Campfire || [];
        data.tags.Campfire.push([x, G + 2.2, z, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
      },
      sign: (t, side, text, w, h, y, bg, fg, glow = false) => {
        const [x, z] = at(t, side * (W - 0.06));
        const i = add([0.08, h, w], [x, G + y, z], bg, 'SmoothPlastic', { yaw, collide: 0 });
        data.signs.push({ part: i, face: side > 0 ? 'Right' : 'Left', glow, labels: [{ text, x: 0, y: 0, w: 1, h: 1, color: fg, font: 'GothamBlack', align: 'Center', stroke: false, pad: 0.12 }] });
      },
      // a scare actor hiding behind cover, ready to lunge across the path
      actor: (t, side, costume, coverColor, coverMat) => {
        const [hx, hz] = at(t, side * (W - 1));
        const [lx, lz] = at(t + 0.6, side * 0.4);
        R.put(t - 1.7, side * (W - 1), [1.6, 8, 1.1], 4, coverColor, coverMat);
        (data.scareActors = data.scareActors || []).push({ costume, x: hx, z: hz, yaw: yaw + Math.PI, lunge: [lx, lz], land });
      },
    };
    return R;
  };

  const addHouse = ({ id, name, land, theme, glow, interior, outsideIn, outsideOut, queueFwd, signIndex, entrance, origin, baseWait, description, speed = WALK }) => {
    // long segments become rooms in turn; the short joins between them
    // borrow the next room's finish
    const rooms = ROOMS[theme];
    const segRoom = [];
    let r = 0;
    for (let i = 0; i < interior.length - 1; i++) {
      const long = dist(interior[i], interior[i + 1]) >= 25;
      segRoom.push(long ? { k: r++ % rooms.length, long: true } : { k: r % rooms.length, long: false });
    }
    corridor(interior, (i) => rooms[segRoom[i].k]);
    for (let i = 0; i < interior.length - 1; i++) {
      if (!segRoom[i].long) continue;
      const def = rooms[segRoom[i].k];
      const R = room(interior[i], interior[i + 1], land);
      for (let t = 4; t < R.len - 2; t += 9) R.light(t, def.light);
      R.glowStrip(1, R.len - 1, 1, def.light);
      R.glowStrip(1, R.len - 1, -1, def.light);
      def.dress(R);
    }
    const path = { pts: [...outsideIn, ...interior, ...outsideOut] };
    path.cum = cumulative(path.pts);
    const length = path.cum[path.cum.length - 1];
    const duration = Math.round(length / speed);
    const end = path.pts[path.pts.length - 1];
    const seats = [Array.from({ length: 12 }, () => [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])];
    data.rides.push({
      id, kind: 'walkthrough', duration, origin: [...origin, 1, 0, 0, 0, 1, 0, 0, 0, 1], carCount: 0, carSpacing: 0,
      cars: [], seats, capacity: 12, queue: queueData(queueFwd, signIndex, G + 0.2), extras: {}, extrasNames: [], crew: null,
    });
    data.config.Rides.push({
      id, name, land, category: 'Haunted House', thrill: 4, kind: 'walkthrough', carStyle: 'none', description,
      baseWait, origin, entrance: [entrance[0], 0, entrance[1]], exit: [end[0], 0, end[1]], yaw: 0, layout: id, cars: 0, carSpacing: 0, colors: [glow],
    });
    const xs = interior.map((p) => p[0]), zs = interior.map((p) => p[1]);
    const rect = { x0: Math.min(...xs) - HALF - 1, x1: Math.max(...xs) + HALF + 1, z0: Math.min(...zs) - HALF - 1, z1: Math.max(...zs) + HALF + 1 };
    houses.push({ id, name, path, length, glow, speed, rect });
  };

  const DESCRIPTIONS = {
    garage: "Bring your car in for a checkup and you won't be driving it out.",
    mine: 'Deep in the mountain, the miners who never came home are still digging.',
    film: 'The premiere is tonight. The cast is dying to meet you.',
    crash: 'Buckle up. The dummies have stopped taking the hits.',
    engine: 'The old Benton Engine Works never really shut down. Something is still working the night shift.',
    lodge: 'When the fountain lights go dark, the lake gives something back.',
    destination: "Your flight is delayed... permanently. Walk through Death's design: Flight 180, Route 23, Devil's Flight, the tanning salon, North Bay Bridge and the List. You can't cheat Death.",
  };

  // the five soundstage houses
  HOUSES.forEach((h, i) => {
    const x = stageX(i), F = STAGE_Z;
    const L = (dx, dz) => [x + dx, F + dz];
    const interior = [L(0, -1.3), L(0, -12), L(-30, -12), L(-30, -84), L(-18, -84), L(-18, -24), L(-6, -24), L(-6, -84),
      L(6, -84), L(6, -24), L(18, -24), L(18, -84), L(30, -84), L(30, -6), L(STAGE.W / 2 - 1.3, -6)];
    // the line: in at the west end of the front barricade, back and forth
    // down the turf, then up to the house's door
    const qx0 = x - 35, qx1 = x + 35;
    const rowZ = (k) => (k < 12 ? QUEUE.z1 - 7 * k - 3.5 : QUEUE.z0 + 4);
    const fwd = [[qx0 + 4, QUEUE.z1 + 30], [qx0 + 4, QUEUE.z1 + 2.5], [qx0 + 4, rowZ(0)]];
    for (let k = 0; k < 12; k++) {
      const ex = k % 2 ? qx0 + 3.5 : qx1 - 3.5;
      fwd.push([ex, rowZ(k)], [ex, rowZ(k + 1)]);
    }
    fwd.push([x, rowZ(12)], [x, F + 6.5]);
    const id = `Haunt${h.theme[0].toUpperCase()}${h.theme.slice(1)}`;
    addHouse({
      id, name: h.title,
      land: 'Studios', theme: h.theme, glow: h.glow, interior,
      outsideIn: [L(0, 6.5), L(0, 2)], outsideOut: [L(STAGE.W / 2 + 4, -6)],
      queueFwd: fwd, signIndex: 1, entrance: [qx0 + 4, QUEUE.z1 + 2.5], origin: [x, 0, F - STAGE.D / 2],
      baseWait: [80, 65, 95, 70, 85, 110][i], description: DESCRIPTIONS[h.theme], speed: WALK * [1, 0.92, 0.85, 0.96, 0.88, 0.84][i],
    });
  });

  // the sixth house in the Family Landing tent
  if (familyLayout) {
    const T = familyLayout.tent, Q = FAMILY_QUEUE;
    const interior = [[T.x0 + 0.6, 214], [424, 214], [424, 221], [477, 221], [477, 213.5], [434, 213.5], [434, 206], [T.x1 - 0.6, 206]];
    const strip = (k) => Q.z0 + Q.step * k + Q.step / 2;
    const fwd = [[Q.x0 + 3, Q.z0 - 26], [Q.x0 + 3, Q.z0 - 2], [Q.x0 + 3, strip(0)]];
    for (let k = 0; k < Q.rows - 1; k++) {
      const ex = k % 2 ? Q.x0 + 3 : Q.x1 - 3;
      fwd.push([ex, strip(k)], [ex, strip(k + 1)]);
    }
    fwd.push([Q.x1 + 3, strip(Q.rows - 1)], [Q.x1 + 3, 214], [T.door[0], T.door[1]]);
    addHouse({
      id: 'HauntLodge', name: 'Lights Out at Lakeside', land: 'Family', theme: 'lodge', glow: 0xffb040,
      interior,
      outsideIn: [[T.door[0], T.door[1]]], outsideOut: [[T.x1 + 5, 206]],
      queueFwd: fwd, signIndex: 1, entrance: [Q.x0 + 3, Q.z0 - 2], origin: [(T.x0 + T.x1) / 2, 0, T.z],
      baseWait: 60, description: DESCRIPTIONS.lodge,
    });
  }
  return houses;
}

// Groups of guests walking the houses, and the player's own walk through.
export class HouseWalks {
  constructor(houses, people) {
    this.houses = new Map(houses.map((h) => [h.id, h]));
    this.people = people;
  }

  // the point the player should be heading for, or null when not in a house
  playerTarget(sim, id, now, pos) {
    const h = this.houses.get(id);
    if (!h) return null;
    const st = sim.rides.get(id);
    const t = sim.rideTime(id, now);
    const s = st.status === 'Running' ? t * h.speed : 0;
    const here = pointAt(h.path, s);
    const ahead = pointAt(h.path, s + 2.5);
    return { here, target: { x: ahead.x, z: ahead.z, final: st.status !== 'Running' }, lost: Math.hypot(pos.x - here.x, pos.z - here.z) > 9 };
  }

  // draw the groups walking through (only near the camera)
  update(sim, now, cam) {
    for (const h of this.houses.values()) {
      const st = sim.rides.get(h.id);
      if (st.status !== 'Running') continue;
      const p0 = h.path.pts[0];
      if (Math.hypot(p0[0] - cam.x, p0[1] - cam.z) > 160) continue;
      const s0 = sim.rideTime(h.id, now) * h.speed;
      st.riders.forEach((r, k) => {
        if (r.player) return;
        const s = s0 - 1.5 - k * 1.6;
        if (s < 0) return;
        const p = pointAt(h.path, s);
        const lat = (k % 3) - 1;
        const x = p.x - p.fz * lat * 1.1, z = p.z + p.fx * lat * 1.1;
        this.people.add('walk', s / 5, x, G, z, Math.atan2(-p.fx, -p.fz), r.npc);
      });
    }
  }
}
