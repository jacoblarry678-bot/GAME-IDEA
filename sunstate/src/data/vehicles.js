/**
 * Vehicle definitions (data-driven). Physics units: kg, m, N, m/s.
 * `look` shapes the lofted body (see entities/vehicleModel.js): `top` and `bot` are the
 * body's upper and lower lines in side view (x forward from the rear bumper, y up),
 * `cabin.x` the greenhouse stations [rear glass base, roof rear, roof front, windshield
 * base] with the roof height, `doors` the door edges, rear to front.
 */
export const VEHICLES = {
  kestrel: {
    name: 'Kestrel LX', class: 'Sedan',
    mass: 1450, length: 4.8, width: 1.86, height: 1.46, wheelbase: 2.8, cgToFront: 1.3, cgHeight: 0.55, wheelR: 0.33, track: 1.58,
    drive: 'fwd', engineForce: 6800, topSpeed: 46, reverseSpeed: 11, brakeForce: 13500, grip: 1.05, rearGripScale: 1.14,
    cornerStiffF: 92000, cornerStiffR: 98000, steerMax: 0.58, steerSpeedRef: 18, handbrakeGrip: 0.42, drag: 0.42, rollRes: 14,
    suspension: 0.55, fragility: 1, idleRpm: 800, redline: 6200, gears: [3.4, 2.1, 1.45, 1.1, 0.88], engineVoice: 'four',
    seats: [[0.38, 0.38, 0.1], [-0.38, 0.38, 0.1], [0.38, 0.38, -0.85], [-0.38, 0.38, -0.85]],
    look: {
      top: [[0, 0.64], [0.06, 0.84], [0.3, 0.96], [0.9, 1.0], [3.55, 0.97], [4.1, 0.9], [4.55, 0.8], [4.8, 0.6]],
      bot: [[0, 0.38], [0.35, 0.3], [4.4, 0.28], [4.8, 0.32]],
      cabin: { x: [1.0, 1.6, 2.8, 3.6], roof: 1.44, b: 2.3 }, doors: [1.35, 2.3, 3.45],
    },
    colors: [0x8fb7c9, 0xd9d4c7, 0x2f2f33, 0x7a1f24, 0x3d5a73, 0x8b8f94, 0xe8e2d0, 0x1f4b3a, 0x6c7a52],
  },
  ironhorse: {
    name: 'Ironhorse 455', class: 'Muscle',
    mass: 1620, length: 5.0, width: 1.92, height: 1.32, wheelbase: 2.92, cgToFront: 1.38, cgHeight: 0.5, wheelR: 0.35, track: 1.62,
    drive: 'rwd', engineForce: 10400, topSpeed: 58, reverseSpeed: 12, brakeForce: 13000, grip: 1.0, rearGripScale: 0.98,
    cornerStiffF: 98000, cornerStiffR: 86000, steerMax: 0.55, steerSpeedRef: 20, handbrakeGrip: 0.33, drag: 0.4, rollRes: 15,
    suspension: 0.7, fragility: 0.85, idleRpm: 700, redline: 5600, gears: [3.0, 1.9, 1.3, 1.0], engineVoice: 'v8',
    seats: [[0.4, 0.34, 0.0], [-0.4, 0.34, 0.0], [0.4, 0.34, -0.9], [-0.4, 0.34, -0.9]],
    look: {
      top: [[0, 0.7], [0.05, 0.88], [0.3, 0.94], [1.1, 0.96], [3.45, 0.95], [4.7, 0.9], [5.0, 0.72]],
      bot: [[0, 0.38], [0.3, 0.31], [4.7, 0.3], [5.0, 0.36]],
      cabin: { x: [1.05, 1.95, 2.85, 3.5], roof: 1.3, b: 2.6 }, doors: [1.8, 3.4], grille: 0.72, plan: { rear: 0.3, front: 0.35, k: 0.86 },
      lamps: { head: 0.06 },
    },
    colors: [0xb5332e, 0x1a1a1a, 0xe8b83a, 0x2a5aa8, 0xf2f2f2, 0x2f6b3a],
    stripes: true,
  },
  pickup: {
    name: 'Mule 2500', class: 'Pickup',
    mass: 2250, length: 5.6, width: 2.0, height: 1.85, wheelbase: 3.5, cgToFront: 1.55, cgHeight: 0.8, wheelR: 0.4, track: 1.7,
    drive: 'rwd', engineForce: 9800, topSpeed: 44, reverseSpeed: 10, brakeForce: 16000, grip: 1.0, rearGripScale: 1.1,
    cornerStiffF: 120000, cornerStiffR: 125000, steerMax: 0.55, steerSpeedRef: 16, handbrakeGrip: 0.4, drag: 0.55, rollRes: 18,
    suspension: 1.0, fragility: 0.7, idleRpm: 650, redline: 5000, gears: [3.6, 2.2, 1.5, 1.1, 0.85], engineVoice: 'v8',
    seats: [[0.42, 0.62, 0.55], [-0.42, 0.62, 0.55]],
    look: {
      top: [[0, 0.92], [0.04, 1.06], [2.25, 1.07], [2.4, 1.1], [4.2, 1.13], [5.3, 1.06], [5.6, 0.84]],
      bot: [[0, 0.52], [0.3, 0.46], [5.2, 0.46], [5.6, 0.52]],
      cabin: { x: [2.32, 2.4, 3.55, 4.15], roof: 1.84, tumble: 0.86 }, doors: [2.5, 4.05], bed: [0.05, 2.3], grille: 0.62,
      plan: { rear: 0.12, front: 0.35, k: 0.86 },
    },
    bed: [0.1, 2.25],
    colors: [0x3d5a73, 0xf2f2f2, 0x8a1d1d, 0x2b2b2b, 0x9a8a6a],
  },
  police: {
    name: 'Police Cruiser', class: 'Police',
    mass: 1700, length: 5.05, width: 1.92, height: 1.5, wheelbase: 2.95, cgToFront: 1.4, cgHeight: 0.56, wheelR: 0.34, track: 1.64,
    drive: 'rwd', engineForce: 10200, topSpeed: 55, reverseSpeed: 12, brakeForce: 15000, grip: 1.1, rearGripScale: 1.12,
    cornerStiffF: 105000, cornerStiffR: 112000, steerMax: 0.56, steerSpeedRef: 20, handbrakeGrip: 0.4, drag: 0.42, rollRes: 14,
    suspension: 0.6, fragility: 0.7, idleRpm: 750, redline: 6000, gears: [3.2, 2.0, 1.4, 1.05, 0.85], engineVoice: 'v8',
    seats: [[0.4, 0.38, 0.1], [-0.4, 0.38, 0.1], [0.4, 0.38, -0.9], [-0.4, 0.38, -0.9]],
    look: {
      top: [[0, 0.66], [0.06, 0.86], [0.32, 0.98], [0.95, 1.02], [3.7, 0.99], [4.3, 0.92], [4.78, 0.82], [5.05, 0.62]],
      bot: [[0, 0.38], [0.35, 0.3], [4.6, 0.28], [5.05, 0.32]],
      cabin: { x: [1.05, 1.68, 2.95, 3.78], roof: 1.47, b: 2.4 }, doors: [1.4, 2.4, 3.65],
    },
    colors: [0x101318],
    police: true,
  },
  sprite: {
    name: 'Sprite GT', class: 'Compact',
    mass: 1180, length: 4.1, width: 1.76, height: 1.48, wheelbase: 2.55, cgToFront: 1.12, cgHeight: 0.52, wheelR: 0.31, track: 1.5,
    drive: 'fwd', engineForce: 5600, topSpeed: 43, reverseSpeed: 11, brakeForce: 11800, grip: 1.08, rearGripScale: 1.12,
    cornerStiffF: 80000, cornerStiffR: 84000, steerMax: 0.62, steerSpeedRef: 17, handbrakeGrip: 0.42, drag: 0.4, rollRes: 12,
    suspension: 0.5, fragility: 1.1, idleRpm: 850, redline: 6800, gears: [3.6, 2.2, 1.5, 1.12, 0.9], engineVoice: 'four',
    seats: [[0.36, 0.38, 0.15], [-0.36, 0.38, 0.15], [0.36, 0.38, -0.7], [-0.36, 0.38, -0.7]],
    look: {
      top: [[0, 0.84], [0.04, 0.98], [0.15, 1.02], [2.95, 0.99], [3.5, 0.9], [3.9, 0.8], [4.1, 0.62]],
      bot: [[0, 0.38], [0.3, 0.3], [3.8, 0.28], [4.1, 0.32]],
      cabin: { x: [0.12, 0.42, 2.25, 3.05], roof: 1.46, b: 1.75 }, doors: [0.95, 1.75, 2.9], plan: { rear: 0.35, front: 0.55 },
      lamps: { tail: 0.03 },
    },
    colors: [0xe9e4d6, 0xc8102e, 0x2c6fb5, 0x1f1f22, 0xf2c14e, 0x8fd1c9, 0x9aa1a8],
  },
  tarpon: {
    name: 'Tarpon XL', class: 'SUV',
    mass: 2050, length: 4.9, width: 1.95, height: 1.78, wheelbase: 2.9, cgToFront: 1.35, cgHeight: 0.72, wheelR: 0.38, track: 1.66,
    drive: 'rwd', engineForce: 8800, topSpeed: 47, reverseSpeed: 11, brakeForce: 15500, grip: 1.0, rearGripScale: 1.12,
    cornerStiffF: 108000, cornerStiffR: 114000, steerMax: 0.56, steerSpeedRef: 17, handbrakeGrip: 0.42, drag: 0.52, rollRes: 16,
    suspension: 0.9, fragility: 0.8, idleRpm: 700, redline: 5600, gears: [3.4, 2.1, 1.45, 1.1, 0.86], engineVoice: 'v8',
    seats: [[0.4, 0.5, 0.1], [-0.4, 0.5, 0.1], [0.4, 0.5, -0.85], [-0.4, 0.5, -0.85]],
    look: {
      top: [[0, 0.9], [0.04, 1.08], [0.2, 1.13], [3.45, 1.11], [4.15, 1.03], [4.65, 0.95], [4.9, 0.74]],
      bot: [[0, 0.48], [0.35, 0.42], [4.5, 0.4], [4.9, 0.46]],
      cabin: { x: [0.1, 0.32, 2.95, 3.6], roof: 1.76, b: 2.1, tumble: 0.84 }, doors: [1.1, 2.1, 3.45], rails: true,
      plan: { rear: 0.3, front: 0.55, k: 0.78 }, grille: 0.55, lamps: { tail: 0.03 },
    },
    colors: [0xf2f2f0, 0x1c1c1e, 0x6d7378, 0x23395b, 0x4a5a3c, 0x8c1c24],
  },
};

export const MODEL_IDS = Object.keys(VEHICLES);
