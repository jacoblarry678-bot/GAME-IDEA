// Benton Haunt scare actors: costumed characters on the full animated
// human rig, with masks, glowing eyes and props in their hands. In the
// houses they hide behind cover and lunge out as you pass; in the scare
// zones they prowl, stalk you when you come close and then lunge with a
// shriek. Each costume has its own look, props, stance and lines.
import * as THREE from 'three';
import { Figure } from './people/figure.js';
import { poseWalk, blendPose } from './people/human.js';
import { buildModel } from './geom.js';

// a part relative to an attachment point: shape 0 box, 2 cylinder (x),
// 3 ball, 5 cylinder (y); rot as CFrame components
const part = (shape, size, pos, color, mat, mi, rot = [1, 0, 0, 0, 1, 0, 0, 0, 1]) => [shape, ...size, ...pos, ...rot, color, mi(mat), 0, 0];
const rx = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

// head center relative to the head-top attachment, and the face
const HC = [0, -0.47, 0.02];
const eyes = (P, color, z = -0.44, y = -0.42) => [P(3, [0.13, 0.1, 0.1], [-0.15, y, z], color, 'Neon'), P(3, [0.13, 0.1, 0.1], [0.15, y, z], color, 'Neon')];

// costume parts per slot: head (on top of the head), handR, handL, chest
function costumes(P) {
  const wrench = [P(0, [0.16, 1.3, 0.26], [0, -0.55, 0], 0x8a8e96, 'Metal'), P(0, [0.42, 0.2, 0.3], [0, -1.2, 0], 0x8a8e96, 'Metal')];
  const pipe = [P(5, [0.22, 2.4, 0.22], [0, -0.9, 0], 0x6a4a3a, 'CorrodedMetal')];
  const machete = [P(0, [0.14, 0.5, 0.18], [0, -0.1, 0], 0x1a1a1a, 'Rubber'), P(0, [0.06, 1.7, 0.36], [0, -1.15, -0.05], 0xc8ccd4, 'Metal')];
  const pickaxe = [P(5, [0.14, 2.6, 0.14], [0, -0.7, 0], 0x6a4a30, 'Wood'), P(0, [0.14, 0.18, 1.6], [0, -1.95, 0], 0x5a5e66, 'Metal')];
  const scythe = [P(5, [0.14, 5.2, 0.14], [0, -0.6, 0], 0x2a2018, 'Wood'), P(0, [0.06, 0.4, 2.6], [0, 1.85, -1.2], 0xb8bcc4, 'Metal', rx(-0.25))];
  const pitchfork = [P(5, [0.14, 4.6, 0.14], [0, -0.4, 0], 0x6a4a30, 'Wood'), P(0, [0.9, 0.12, 0.12], [0, 1.85, 0], 0x5a5e66, 'Metal'),
    ...[-0.4, 0, 0.4].map((x) => P(0, [0.08, 0.9, 0.08], [x, 2.3, 0], 0x5a5e66, 'Metal'))];
  const chainsaw = [P(0, [0.55, 0.65, 1.1], [0, -0.2, 0.1], 0xe86a10, 'SmoothPlastic'), P(0, [0.1, 0.32, 1.9], [0, -0.25, -1.3], 0xc8ccd4, 'Metal'),
    P(0, [0.12, 0.36, 1.95], [0, -0.25, -1.3], 0x2a2a2e, 'Metal'), P(0, [0.5, 0.12, 0.5], [0, 0.25, 0.3], 0x1a1a1a, 'Rubber')];
  const lantern = [P(0, [0.06, 0.5, 0.06], [0, -0.3, 0], 0x2a2a2e, 'Metal'), P(0, [0.5, 0.6, 0.5], [0, -0.8, 0], 0x2a2a2e, 'Metal'), P(0, [0.38, 0.46, 0.38], [0, -0.8, 0], 0x000000, 'Neon')];
  const claws = [-0.12, 0, 0.12].map((x) => P(0, [0.05, 0.55, 0.05], [x, -0.35, -0.12], 0xd8d0b8, 'SmoothPlastic', rx(0.4)));
  const hook = [P(0, [0.1, 0.9, 0.1], [0, -0.5, 0], 0x5a5e66, 'Metal'), P(2, [0.12, 0.6, 0.6], [0, -1.1, -0.15], 0x5a5e66, 'Metal')];
  const oar = [P(5, [0.12, 4, 0.12], [0, -0.6, 0], 0x6a4a30, 'Wood'), P(0, [0.1, 1.2, 0.5], [0, -2.6, 0], 0x6a4a30, 'Wood')];
  const megaphone = [P(5, [0.5, 0.9, 0.5], [0, -0.3, -0.3], 0xe8e8e4, 'SmoothPlastic', rx(1.4))];
  const skull = (c = 0xe8e4dc) => [P(3, [0.92, 1.0, 0.9], HC, c, 'SmoothPlastic'),
    P(3, [0.22, 0.24, 0.12], [-0.16, -0.43, -0.4], 0x050505, 'SmoothPlastic'), P(3, [0.22, 0.24, 0.12], [0.16, -0.43, -0.4], 0x050505, 'SmoothPlastic'),
    P(0, [0.1, 0.16, 0.1], [0, -0.6, -0.44], 0x050505, 'SmoothPlastic'), P(0, [0.44, 0.12, 0.08], [0, -0.78, -0.4], 0x2a2420, 'SmoothPlastic')];
  // blood on the front of a shirt
  const blood = (seed = 0) => [P(0, [0.34, 0.42, 0.04], [-0.12 + (seed % 3) * 0.1, 0.72, -0.44], 0x6a0808, 'SmoothPlastic', rz(0.3 * seed)),
    P(0, [0.12, 0.5, 0.04], [0.14 - (seed % 2) * 0.2, 0.42, -0.43], 0x7a0a0a, 'SmoothPlastic', rz(-0.2)),
    P(3, [0.18, 0.16, 0.04], [0.2, 0.95, -0.44], 0x6a0808, 'SmoothPlastic')];
  return {
    // Dead Man's Garage
    mechanic: { look: { skin: 0x6e7e5e, shirt: 0x2a3a5a, pants: 0x2a3a5a, hair: 0x14100c, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.06 },
      head: [P(0, [0.5, 0.18, 0.06], [0.1, -0.62, -0.42], 0x1a1612, 'SmoothPlastic'), ...eyes(P, 0xff2010)], handR: wrench, chest: blood(1), pose: 'tool',
      lines: ['Need a tune-up?', "You're overdue for service...", 'Pop the hood!', 'BOO!'] },
    greaseMonster: { look: { skin: 0x16140f, shirt: 0x1a1612, pants: 0x1a1612, hair: 0x0a0a0a, shoes: 0x0a0a0a, sleeves: 1, longPants: 1, height: 1.12 },
      head: [...eyes(P, 0xffa010)], handR: hook, handL: claws, pose: 'claw', lines: ['Get in the pit...', 'RAAAH!', 'Drip... drip...'] },
    // The Lost Miners of Backwoods Hollow
    miner: { look: { skin: 0x8e8e86, shirt: 0x5a4a3a, pants: 0x3a3026, hair: 0x2a2a2a, shoes: 0x2a2018, sleeves: 1, longPants: 1, height: 1.05 },
      head: [P(3, [1.0, 0.6, 1.05], [0, -0.12, 0.02], 0xf2c818, 'SmoothPlastic'), P(0, [1.2, 0.08, 1.25], [0, -0.32, 0.02], 0xf2c818, 'SmoothPlastic'),
        P(5, [0.24, 0.16, 0.24], [0, -0.15, -0.5], 0xfff4c0, 'Neon', rx(1.57)), ...eyes(P, 0xffd040)],
      handR: pickaxe, pose: 'tool', lines: ['Dig... DIG!', 'The mountain wants you!', 'Nobody leaves the mine!', 'BOO!'] },
    // Final Cut: A Hollywood Horror
    slasher: { look: { skin: 0xd8c0a8, shirt: 0x16161a, pants: 0x16161a, hair: 0x2a1a10, shoes: 0x0a0a0a, sleeves: 1, longPants: 1, height: 1.12 },
      head: [P(3, [0.7, 0.86, 0.32], [0, -0.48, -0.32], 0xeeeae0, 'SmoothPlastic'), P(3, [0.14, 0.1, 0.06], [-0.14, -0.4, -0.48], 0x050505, 'SmoothPlastic'),
        P(3, [0.14, 0.1, 0.06], [0.14, -0.4, -0.48], 0x050505, 'SmoothPlastic'), ...[-0.12, 0, 0.12].map((x) => P(3, [0.05, 0.05, 0.04], [x, -0.66, -0.48], 0x050505, 'SmoothPlastic')),
        P(0, [0.6, 0.12, 0.06], [0, -0.22, -0.45], 0xc01a1a, 'SmoothPlastic')],
      handR: machete, chest: blood(2), pose: 'tool', lines: ['Cut! Print it!', "You're in my movie now...", 'Places, everyone!', '...'] },
    zombieExtra: { look: { skin: 0x7e8e6e, shirt: 0x5a1218, pants: 0x101012, hair: 0x2a2a2a, shoes: 0x101010, sleeves: 1, longPants: 1, height: 1.02 },
      head: [P(0, [0.3, 0.12, 0.06], [-0.1, -0.7, -0.42], 0x6a0a0a, 'SmoothPlastic'), ...eyes(P, 0xf0f0e0)], handR: claws, handL: claws, chest: blood(0), pose: 'claw',
      lines: ['Brains... and popcorn...', 'Is this my close-up?', 'RAAAH!'] },
    director: { look: { skin: 0xb8bcae, shirt: 0x3a2a1a, pants: 0xc8b88c, hair: 0x6a6a66, shoes: 0x3a2a1a, sleeves: 1, longPants: 1, height: 1.0 },
      head: [P(5, [0.95, 0.3, 0.95], [0, -0.05, 0.02], 0x1a1a1c, 'Fabric'), ...eyes(P, 0xff2a2a)], handR: megaphone, pose: 'tool',
      lines: ['ACTION!', 'Scream like you mean it!', "That's a wrap... on YOU!"] },
    // Crash Test
    dummy: { look: { skin: 0xe8c018, shirt: 0xe8c018, pants: 0x2a2a2e, hair: 0xe8c018, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, hairStyle: 3, height: 1.04 },
      head: [...[-1, 1].map((s) => P(2, [0.06, 0.4, 0.4], [s * 0.45, -0.45, 0], 0x1a1a1a, 'SmoothPlastic')), ...[-1, 1].map((s) => P(2, [0.07, 0.2, 0.2], [s * 0.46, -0.45, 0], 0xf2c818, 'SmoothPlastic')),
        P(0, [0.04, 0.5, 0.04], [0, -0.45, -0.44], 0x1a1a1a, 'SmoothPlastic')],
      chest: [P(2, [0.06, 0.5, 0.5], [0, 0.85, -0.38], 0x1a1a1a, 'SmoothPlastic', rz(1.5708)), P(2, [0.07, 0.24, 0.24], [0, 0.85, -0.39], 0xf2c818, 'SmoothPlastic', rz(1.5708))],
      pose: 'claw', lines: ['Impact in 3... 2...', 'Buckle up!', '*CRUNCH*', 'Test subject found!'] },
    // Engine Works: Meltdown
    welder: { look: { skin: 0x2a1610, shirt: 0x3a2a20, pants: 0x2a2a2e, hair: 0x0a0a0a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.1 },
      head: [P(0, [0.78, 0.86, 0.24], [0, -0.48, -0.38], 0x2a2c30, 'Metal'), P(0, [0.56, 0.14, 0.06], [0, -0.42, -0.52], 0xff6a10, 'Neon')],
      chest: [P(0, [0.08, 0.6, 0.04], [-0.15, 0.7, -0.42], 0xff6a10, 'Neon', rz(0.4)), P(0, [0.08, 0.4, 0.04], [0.18, 0.9, -0.42], 0xff6a10, 'Neon', rz(-0.5))],
      handR: pipe, pose: 'tool', lines: ['The furnace is hungry...', 'Back to WORK!', 'Night shift never ends!', 'BOO!'] },
    // Lights Out at Lakeside
    lakeGhost: { look: { skin: 0xb8ccd8, shirt: 0xe4e8f0, pants: 0xe4e8f0, hair: 0x0c0c10, shoes: 0xe4e8f0, sleeves: 1, longPants: 1, hairStyle: 1, fem: 1, height: 1.0 },
      head: [...eyes(P, 0xd8f0ff)], handL: lantern, pose: 'lantern', lines: ['Lights out...', 'Come swim with us...', 'The lake remembers...', '*whisper*'] },
    camper: { look: { skin: 0x7a9298, shirt: 0x8a2a22, pants: 0x2b3a55, hair: 0x2a1a10, shoes: 0x3a2a1a, sleeves: 1, longPants: 1, height: 1.04 },
      head: [...eyes(P, 0xff3030)], handR: oar, pose: 'tool', lines: ["Camp's closed for good...", 'Paddle faster!', 'RAAAH!'] },
    // scare zones
    reaper: { look: { skin: 0xe8e4dc, shirt: 0x0c0c0e, pants: 0x0c0c0e, hair: 0x0c0c0e, shoes: 0x0c0c0e, sleeves: 1, longPants: 1, height: 1.2 },
      head: [...skull(), P(3, [1.15, 1.2, 1.1], [0, -0.38, 0.12], 0x0c0c0e, 'Fabric'), ...eyes(P, 0x9a6aff, -0.42, -0.43)],
      handR: scythe, pose: 'pole', lines: ['Your time is up...', 'Midnight has come!', 'Welcome to the other side...'] },
    ghoul: { look: { skin: 0xc8c8c0, shirt: 0x3a3a40, pants: 0x2a2a2e, hair: 0xd8d8d0, shoes: 0x2a2a2e, sleeves: 0, longPants: 1, height: 1.05 },
      // sunken eye sockets, a gaping mouth, a tattered burial shroud
      head: [P(3, [0.22, 0.24, 0.1], [-0.15, -0.43, -0.4], 0x050505, 'SmoothPlastic'), P(3, [0.22, 0.24, 0.1], [0.15, -0.43, -0.4], 0x050505, 'SmoothPlastic'), ...eyes(P, 0x9a6aff, -0.47),
        P(3, [0.3, 0.42, 0.1], [0, -0.74, -0.38], 0x0a0404, 'SmoothPlastic'), ...[-0.08, 0.08].map((x) => P(0, [0.05, 0.1, 0.04], [x, -0.58, -0.42], 0xe8e0c8, 'SmoothPlastic')),
        P(3, [1.12, 1.18, 1.1], [0, -0.36, 0.14], 0x5a5a56, 'Fabric'),
        ...[-0.45, -0.15, 0.15, 0.45].map((x, i) => P(0, [0.22, 0.9 + (i % 2) * 0.4, 0.06], [x, -1.2, 0.5], 0x4a4a46, 'Fabric', rz(x * 0.4)))],
      chest: [...[-0.3, -0.1, 0.1, 0.3].map((x, i) => P(0, [0.16, 0.7 + (i % 2) * 0.3, 0.04], [x, 0.05, -0.43], 0x4a4a46, 'Fabric', rz(x))), ...blood(2)],
      handR: claws, handL: claws, pose: 'claw', lines: ['You came back!', 'Stay... forever...', 'RAAAH!'] },
    gasMask: { look: { skin: 0x5a5a52, shirt: 0x4a3a2a, pants: 0x2a2a2e, hair: 0x1a1a1a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.08 },
      head: [P(3, [0.78, 0.8, 0.4], [0, -0.52, -0.3], 0x1a1a1c, 'Rubber'), P(3, [0.2, 0.2, 0.06], [-0.16, -0.4, -0.5], 0x40ff60, 'Neon'), P(3, [0.2, 0.2, 0.06], [0.16, -0.4, -0.5], 0x40ff60, 'Neon'),
        P(2, [0.3, 0.32, 0.32], [0, -0.75, -0.52], 0x3a3a3e, 'Metal', [0, 0, -1, 0, 1, 0, 1, 0, 0])],
      handR: pipe, pose: 'tool', lines: ['*wheeze*', 'Breathe it in...', 'The smog is coming!'] },
    scarecrow: { look: { skin: 0xc8a868, shirt: 0x8a3a22, pants: 0x3a5a8a, hair: 0xd8b850, shoes: 0x3a2a1a, sleeves: 1, longPants: 1, height: 1.14 },
      head: [P(3, [0.95, 1.05, 0.95], HC, 0xc8a868, 'Fabric'), P(0, [0.5, 0.06, 0.06], [0, -0.68, -0.45], 0x2a1a10, 'Fabric'),
        ...[-0.16, -0.05, 0.06, 0.17].map((x) => P(0, [0.03, 0.14, 0.04], [x, -0.68, -0.46], 0x2a1a10, 'Fabric')), ...eyes(P, 0xff8a10),
        P(5, [1.5, 0.08, 1.5], [0, -0.05, 0.02], 0x3a2a1a, 'Fabric'), P(5, [0.8, 0.5, 0.8], [0, 0.18, 0.02], 0x3a2a1a, 'Fabric'),
        ...[-0.3, 0, 0.3].map((x) => P(0, [0.08, 0.4, 0.08], [x, -1.0, -0.2], 0xd8b850, 'Grass', rz(x)))],
      handR: pitchfork, pose: 'pole', lines: ['Crossing the field?', 'Caw! CAW!', "You're the next scarecrow..."] },
    pumpkinHead: { look: { skin: 0x3a2a1a, shirt: 0x1e1612, pants: 0x1e1612, hair: 0x0a0a0a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.15 },
      head: [P(3, [1.25, 1.1, 1.2], HC, 0xd85400, 'SmoothPlastic'), P(5, [0.16, 0.36, 0.16], [0, 0.15, 0.02], 0x3a5a2a, 'Wood'),
        P(0, [0.2, 0.16, 0.06], [-0.2, -0.38, -0.6], 0xffd040, 'Neon', rz(0.5)), P(0, [0.2, 0.16, 0.06], [0.2, -0.38, -0.6], 0xffd040, 'Neon', rz(-0.5)),
        P(0, [0.6, 0.14, 0.06], [0, -0.7, -0.58], 0xffd040, 'Neon')],
      handR: claws, pose: 'claw', lines: ['Trick... or SCREAM!', 'Happy Haunting!', 'RAAAH!'] },
    wendigo: { look: { skin: 0xd8d4c8, shirt: 0x3a3226, pants: 0x2a2420, hair: 0x3a3226, shoes: 0x1a1612, sleeves: 0, longPants: 1, height: 1.25 },
      head: [...skull(0xd8d0bc), ...eyes(P, 0x40ff80, -0.42, -0.43),
        ...[-1, 1].flatMap((s) => [P(0, [0.08, 1.2, 0.08], [s * 0.35, 0.3, 0], 0x5a4a34, 'Wood', rz(-s * 0.5)), P(0, [0.07, 0.6, 0.07], [s * 0.6, 0.6, -0.1], 0x5a4a34, 'Wood', rz(-s * 1.1)), P(0, [0.07, 0.5, 0.07], [s * 0.45, 0.85, 0.05], 0x5a4a34, 'Wood', rz(s * 0.2))])],
      handR: claws, handL: claws, pose: 'claw', lines: ['Stay on the trail...', '*click click click*', "Don't follow the lanterns!"] },
    lanternWraith: { look: { skin: 0xa8c8b0, shirt: 0x2a3a2a, pants: 0x2a3a2a, hair: 0x0a0a0a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, hairStyle: 1, fem: 1, height: 1.02 },
      head: [P(3, [1.0, 1.1, 1.0], [0, -0.38, 0.1], 0x1a2a1a, 'Fabric'), ...eyes(P, 0x40ff80)], handL: lantern, pose: 'lantern',
      lines: ['Follow the light...', 'Lost in the woods?', '*giggle*'] },
    racer: { look: { skin: 0x2a1a14, shirt: 0xa82a22, pants: 0x2a2a2e, hair: 0x0a0a0a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.1 },
      head: [P(3, [1.05, 1.1, 1.08], HC, 0x1a1a1c, 'SmoothPlastic'), P(0, [0.7, 0.26, 0.1], [0, -0.42, -0.5], 0xff2010, 'Neon'), P(0, [0.08, 0.6, 1.0], [0, -0.1, 0.02], 0xc8322d, 'SmoothPlastic')],
      chest: [P(0, [0.6, 0.1, 0.04], [0, 0.6, -0.42], 0xf2f2f2, 'SmoothPlastic')],
      handR: chainsaw, pose: 'chainsaw', lines: ['*VRRRRRMMM*', 'Burnout time!', 'Last lap!', 'RAAAH!'] },
    // Fortnitemares: the Cube Queen, her cube monsters and the husks
    cubeQueen: { look: { skin: 0x3a1a5a, shirt: 0x1a0a2a, pants: 0x1a0a2a, hair: 0x0a0a0a, shoes: 0x0a0a0a, sleeves: 1, longPants: 1, hairStyle: 1, fem: 1, height: 1.3 },
      head: [...eyes(P, 0xf0d0ff), ...[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => P(0, [0.26, 0.26, 0.26], [x, 0.2 + (i === 2 ? 0.25 : Math.abs(x) < 0.3 ? 0.12 : 0), 0.02], 0xb04aff, 'Neon', rz(0.6 + i)))],
      chest: [P(0, [1.2, 1.7, 0.1], [0, 0.35, 0.45], 0x2a0a3a, 'Fabric'), P(0, [0.08, 0.7, 0.04], [-0.15, 0.7, -0.42], 0xb04aff, 'Neon', rz(0.4)), P(0, [0.08, 0.5, 0.04], [0.18, 0.85, -0.42], 0xb04aff, 'Neon', rz(-0.5))],
      handL: [P(0, [0.6, 0.6, 0.6], [0, -0.8, -0.1], 0xb04aff, 'Neon', rz(0.7))], handR: claws, pose: 'lantern',
      lines: ['Kneel before the Queen!', 'This island is MINE.', 'The Storm answers to me...', 'Where did you drop? HERE.'] },
    cubeMonster: { look: { skin: 0x24102e, shirt: 0x1a0a24, pants: 0x1a0a24, hair: 0x0a0a0a, shoes: 0x0a0a0a, sleeves: 1, longPants: 1, height: 1.16 },
      head: [...eyes(P, 0xd080ff), P(0, [0.42, 0.42, 0.42], [0.22, 0.02, 0.1], 0xb04aff, 'Neon', rz(0.6)), P(0, [0.3, 0.3, 0.3], [-0.26, 0.08, -0.05], 0x8a2ad8, 'Neon', rz(-0.4)),
        P(0, [0.4, 0.1, 0.06], [0, -0.72, -0.44], 0xb04aff, 'Neon')],
      chest: [P(0, [0.08, 0.6, 0.04], [-0.15, 0.7, -0.42], 0xb04aff, 'Neon', rz(0.4)), P(0, [0.08, 0.4, 0.04], [0.18, 0.9, -0.42], 0xb04aff, 'Neon', rz(-0.5))],
      handR: claws, handL: claws, pose: 'claw', lines: ['The cubes are calling...', '*hiss*', "You can't outrun the Storm!", 'RAAAH!'] },
    husk: { look: { skin: 0x6a7a5a, shirt: 0x3a3a46, pants: 0x2a2a30, hair: 0x1a1a1a, shoes: 0x1a1a1a, sleeves: 0, longPants: 1, height: 1.04 },
      head: [...eyes(P, 0xb04aff), P(0, [0.4, 0.1, 0.06], [0, -0.72, -0.44], 0xb04aff, 'Neon')], handR: claws, handL: claws, chest: blood(1), pose: 'claw',
      lines: ['Huuusk...', 'Grrraaah!', 'Join the horde!', 'The Storm is shrinking...'] },
    pitCrew: { look: { skin: 0x221410, shirt: 0x2a2a2e, pants: 0x2a2a2e, hair: 0x0a0a0a, shoes: 0x1a1a1a, sleeves: 1, longPants: 1, height: 1.06 },
      head: [...eyes(P, 0xff6a10), P(0, [0.5, 0.18, 0.06], [-0.05, -0.62, -0.42], 0xff3a10, 'Neon')], handR: wrench, pose: 'tool',
      lines: ['Pit stop!', 'Your tires are smoking...', 'BOO!'] },
  };
}

// ---------------------------------------------------------------- poses
function base(t) {
  return {
    hips: { pos: [0, 0, 0], rot: [0, 0, 0] },
    spine: [0, 0, 0], neck: [0, 0, 0],
    shoulderL: [0.05, 0, -0.08], elbowL: [0.2, 0, 0], shoulderR: [0.05, 0, 0.08], elbowR: [0.2, 0, 0],
    hipL: [0, 0, -0.04], kneeL: [-0.05, 0, 0], hipR: [0, 0, 0.04], kneeR: [-0.05, 0, 0],
    ground: true, t,
  };
}
// hunched, swaying, ready to spring
function poseLurk(kind, t) {
  const sw = Math.sin(t * 1.3) * 0.08, tw = Math.sin(t * 7.3) * 0.04;
  const p = base(t);
  Object.assign(p, {
    hips: { pos: [0, -0.25, 0], rot: [-0.12, sw, 0] },
    spine: [-0.32 + tw, -sw, sw * 0.5], neck: [0.35, sw * 2, -sw],
    hipL: [0.35, 0, -0.08], kneeL: [-0.55, 0, 0], hipR: [0.2, 0, 0.08], kneeR: [-0.4, 0, 0],
    shoulderL: [0.55, 0, -0.18], elbowL: [0.7 + tw * 3, 0, 0], shoulderR: [0.55, 0, 0.18], elbowR: [0.7 - tw * 3, 0, 0],
  });
  if (kind === 'tool' || kind === 'chainsaw') Object.assign(p, { shoulderR: [0.8, 0, 0.15], elbowR: [1.0, 0, 0] });
  if (kind === 'chainsaw') Object.assign(p, { shoulderL: [0.95, 0, -0.05], elbowL: [1.1, 0.6, 0] });
  if (kind === 'pole') Object.assign(p, { shoulderR: [0.35, 0, 0.2], elbowR: [1.2, 0, 0], shoulderL: [0.7, 0, -0.2], elbowL: [1.1, 0, 0] });
  if (kind === 'lantern') Object.assign(p, { shoulderL: [1.0, 0, -0.1], elbowL: [0.25, 0, 0] });
  return p;
}
// the lunge: lean in, arms or weapon up, a violent shake
function poseLunge(kind, t) {
  const sh = Math.sin(t * 28) * 0.12;
  const p = base(t);
  Object.assign(p, {
    hips: { pos: [0, -0.1, -0.2], rot: [-0.2, 0, 0] },
    spine: [-0.22 + sh * 0.3, sh, 0], neck: [0.45, -sh, 0],
    hipL: [0.75, 0, -0.1], kneeL: [-0.6, 0, 0], hipR: [-0.35, 0, 0.1], kneeR: [-0.25, 0, 0],
    shoulderL: [1.9 + sh, 0, -0.55], elbowL: [0.35, 0, 0], shoulderR: [1.9 - sh, 0, 0.55], elbowR: [0.35, 0, 0],
  });
  if (kind === 'tool') Object.assign(p, { shoulderR: [2.7 + sh, 0, 0.3], elbowR: [0.6, 0, 0] });
  if (kind === 'chainsaw') Object.assign(p, { shoulderR: [1.6 + sh, 0, 0.1], elbowR: [0.5, 0, 0], shoulderL: [1.65 - sh, 0, -0.1], elbowL: [0.9, 0.7, 0], spine: [-0.1, sh * 2, 0] });
  if (kind === 'pole') Object.assign(p, { shoulderR: [2.9, 0, 0.25 + sh], elbowR: [0.4, 0, 0], shoulderL: [1.8, 0, -0.4], elbowL: [0.6, 0, 0] });
  if (kind === 'lantern') Object.assign(p, { shoulderL: [2.2, 0, -0.3], elbowL: [0.2, 0, 0], shoulderR: [1.6 + sh, 0, 0.5] });
  return p;
}
// prowling walk: a shamble with arms and props held forward
function poseStalk(kind, phase, t) {
  const w = poseWalk(phase, 0);
  const l = poseLurk(kind, t);
  const p = blendPose(w, l, 0.35);
  p.ground = true;
  return p;
}

// --------------------------------------------------------------- actors
const SHOUT = 10; // how close the player must be for a lunge's shout bubble
export class ScareActors {
  constructor(scene, data, hooks) {
    this.hooks = hooks; // { sound, bubbles }
    const mi = (name) => {
      let i = data.materials.indexOf(name);
      if (i < 0) { data.materials.push(name); i = data.materials.length - 1; }
      return i;
    };
    const P = (shape, size, pos, color, mat, rot) => part(shape, size, pos, color, mat, mi, rot);
    this.costumes = costumes(P);
    this.actors = [];
    for (const spec of data.scareActors || []) {
      const c = this.costumes[spec.costume];
      if (!c) continue;
      const look = { skin: 0xd8c0a8, shirt: 0x222, pants: 0x222, hair: 0x111, shoes: 0x111, hat: 0x111, sleeves: 0, longPants: 1, hairStyle: 0, hatOn: 0, fem: 0, height: 1.05, width: 1, ...c.look };
      const fig = new Figure(look);
      for (const [slot, anchor] of [['head', fig.headTop], ['handR', fig.handR], ['handL', fig.handL], ['chest', fig.joints.spine]]) {
        if (c[slot]?.length) anchor.add(buildModel(c[slot], data.materials, { detail: false, shadows: true }));
      }
      fig.root.visible = false;
      scene.add(fig.root);
      const home = new THREE.Vector3(spec.x, spec.y ?? 0.1, spec.z);
      this.actors.push({
        spec, c, fig, home, pos: home.clone(), yaw: spec.yaw ?? 0, state: spec.mode === 'roam' ? 'roam' : 'hide', t: Math.random() * 10,
        cool: Math.random() * 3, target: home.clone(), wait: Math.random() * 3, phase: Math.random() * 6, id: `scare${this.actors.length}`,
        lunge: spec.lunge ? new THREE.Vector3(spec.lunge[0], home.y, spec.lunge[1]) : null,
      });
    }
    this.tmp = new THREE.Vector3();
  }

  face(a, x, z, dt, rate = 8) {
    const want = Math.atan2(-(x - a.pos.x), -(z - a.pos.z));
    const d = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
    a.yaw += d * Math.min(1, rate * dt);
  }

  shout(a, player) {
    this.hooks.sound('scare');
    if (a.pos.distanceTo(player) < SHOUT) {
      const lines = a.c.lines;
      this.hooks.bubbles.say(a.id, lines[Math.floor(Math.random() * lines.length)], this.head(a), 1.6);
    }
  }

  head(a) {
    return this.tmp.set(a.pos.x, a.pos.y + 6.4 * (a.c.look.height || 1), a.pos.z).clone();
  }

  update(dt, cam, player) {
    dt = Math.min(dt, 0.1);
    for (const a of this.actors) {
      const far = a.home.distanceToSquared(cam) > 120 * 120;
      a.fig.root.visible = !far;
      if (far) continue;
      a.t += dt;
      a.cool -= dt;
      const kind = a.c.pose;
      const dp = Math.hypot(player.x - a.pos.x, player.z - a.pos.z);
      let pose;
      if (a.spec.mode !== 'roam') {
        // hiding in the house, behind cover: out, hold, back
        if (a.state === 'hide') {
          a.pos.lerp(a.home, Math.min(1, dt * 6));
          this.face(a, a.lunge.x, a.lunge.z, dt, 3);
          pose = poseLurk(kind, a.t);
          if (dp < 7.5 && a.cool <= 0) { a.state = 'out'; a.st = 0; this.shout(a, player); }
        } else {
          a.st += dt;
          if (a.state === 'out') {
            a.pos.lerp(a.lunge, Math.min(1, dt * 14));
            this.face(a, player.x, player.z, dt, 14);
            pose = poseLunge(kind, a.t);
            if (a.st > 1.5) { a.state = 'back'; a.st = 0; }
          } else {
            a.pos.lerp(a.home, Math.min(1, dt * 5));
            pose = poseLurk(kind, a.t);
            if (a.st > 0.8) { a.state = 'hide'; a.cool = 4 + Math.random() * 3; }
          }
        }
      } else {
        // prowling a scare zone: wander, stalk the player, lunge, back off
        const R = a.spec.radius || 10;
        if (a.state === 'roam') {
          if (dp < 14 && a.cool <= 0 && Math.hypot(player.x - a.home.x, player.z - a.home.z) < R + 10) a.state = 'stalk';
          a.wait -= dt;
          if (a.wait <= 0) {
            const ang = Math.random() * Math.PI * 2, r = Math.random() * R;
            a.target.set(a.home.x + Math.cos(ang) * r, a.home.y, a.home.z + Math.sin(ang) * r);
            a.wait = 3 + Math.random() * 4;
          }
          const d = Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z);
          if (d > 0.5 && a.wait < 2.5) {
            const sp = 2.2;
            a.pos.x += ((a.target.x - a.pos.x) / d) * sp * dt;
            a.pos.z += ((a.target.z - a.pos.z) / d) * sp * dt;
            this.face(a, a.target.x, a.target.z, dt, 4);
            a.phase += (dt * sp / 5.5) * Math.PI * 2;
            pose = poseStalk(kind, a.phase, a.t);
          } else pose = poseLurk(kind, a.t);
        } else if (a.state === 'stalk') {
          this.face(a, player.x, player.z, dt, 6);
          if (dp > 3.4) {
            const sp = 4.5;
            a.pos.x += ((player.x - a.pos.x) / dp) * sp * dt;
            a.pos.z += ((player.z - a.pos.z) / dp) * sp * dt;
            a.phase += (dt * sp / 5.5) * Math.PI * 2;
            pose = poseStalk(kind, a.phase, a.t);
          }
          if (dp <= 3.4) { a.state = 'out'; a.st = 0; this.shout(a, player); pose = poseLunge(kind, a.t); }
          if (dp > 22 || Math.hypot(a.pos.x - a.home.x, a.pos.z - a.home.z) > R + 12) { a.state = 'roam'; a.cool = 3; }
        } else if (a.state === 'out') {
          a.st += dt;
          this.face(a, player.x, player.z, dt, 14);
          pose = poseLunge(kind, a.t);
          if (a.st > 1.4) { a.state = 'roam'; a.cool = 6 + Math.random() * 4; a.target.copy(a.home); a.wait = 1; }
        }
        if (!pose) pose = poseLurk(kind, a.t);
      }
      a.fig.root.position.copy(a.pos);
      a.fig.root.rotation.set(0, a.yaw, 0);
      a.fig.apply(pose, a.c.look.fem || 0);
      this.hooks.bubbles.follow(a.id, this.head(a));
    }
  }
}

// A few real colored lights that follow you through the haunt: each moment
// they move to the house or zone lamps nearest you, so the rooms are lit
// in their own colors (strongest indoors and after dark).
export class HauntLights {
  constructor(scene, lamps, count = 4) {
    this.lamps = lamps.map(([x, y, z, color]) => ({ pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color) }));
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 26, 2);
      scene.add(l);
      this.lights.push(l);
    }
    this.next = 0;
  }

  update(dt, focus, indoor, night) {
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 0.2;
      const near = this.lamps.filter((l) => l.pos.distanceToSquared(focus) < 34 * 34)
        .sort((a, b) => a.pos.distanceToSquared(focus) - b.pos.distanceToSquared(focus)).slice(0, this.lights.length);
      this.lights.forEach((l, i) => {
        const lamp = near[i];
        l.userData.target = lamp ? 1 : 0;
        if (lamp) { l.position.copy(lamp.pos); l.color.copy(lamp.color); }
      });
    }
    const strength = 30 + 70 * Math.max(indoor, night);
    for (const l of this.lights) l.intensity += ((l.userData.target || 0) * strength - l.intensity) * Math.min(1, dt * 6);
  }
}
