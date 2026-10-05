/**
 * Vehicle definitions (data-driven). Physics units: kg, m, N, m/s.
 * `profile` is the side silhouette (x forward from the rear bumper, y up),
 * `cabin` the greenhouse silhouette; both are extruded across the width.
 */
export const VEHICLES = {
  kestrel: {
    name: 'Kestrel LX', class: 'Sedan',
    mass: 1450, length: 4.8, width: 1.86, height: 1.46, wheelbase: 2.8, cgToFront: 1.3, cgHeight: 0.55, wheelR: 0.33, track: 1.58,
    drive: 'fwd', engineForce: 6800, topSpeed: 46, reverseSpeed: 11, brakeForce: 13500, grip: 1.05, rearGripScale: 1.14,
    cornerStiffF: 92000, cornerStiffR: 98000, steerMax: 0.58, steerSpeedRef: 18, handbrakeGrip: 0.42, drag: 0.42, rollRes: 14,
    suspension: 0.55, fragility: 1, idleRpm: 800, redline: 6200, gears: [3.4, 2.1, 1.45, 1.1, 0.88], engineVoice: 'four',
    seats: [[0.38, 0.38, 0.1], [-0.38, 0.38, 0.1], [0.38, 0.38, -0.85], [-0.38, 0.38, -0.85]],
    profile: [[0, 0.32], [0.05, 0.62], [0.9, 0.78], [3.05, 0.86], [4.6, 0.8], [4.8, 0.62], [4.78, 0.32]],
    cabin: [[1.05, 0.84], [1.7, 1.36], [3.0, 1.38], [3.55, 0.88]],
    colors: [0x8fb7c9, 0xd9d4c7, 0x2f2f33, 0x7a1f24, 0x3d5a73, 0x8b8f94, 0xe8e2d0, 0x1f4b3a, 0x6c7a52],
  },
  ironhorse: {
    name: 'Ironhorse 455', class: 'Muscle',
    mass: 1620, length: 5.0, width: 1.92, height: 1.32, wheelbase: 2.92, cgToFront: 1.38, cgHeight: 0.5, wheelR: 0.35, track: 1.62,
    drive: 'rwd', engineForce: 10400, topSpeed: 58, reverseSpeed: 12, brakeForce: 13000, grip: 1.0, rearGripScale: 0.98,
    cornerStiffF: 98000, cornerStiffR: 86000, steerMax: 0.55, steerSpeedRef: 20, handbrakeGrip: 0.33, drag: 0.4, rollRes: 15,
    suspension: 0.7, fragility: 0.85, idleRpm: 700, redline: 5600, gears: [3.0, 1.9, 1.3, 1.0], engineVoice: 'v8',
    seats: [[0.4, 0.34, 0.0], [-0.4, 0.34, 0.0], [0.4, 0.34, -0.9], [-0.4, 0.34, -0.9]],
    profile: [[0, 0.36], [0.02, 0.7], [0.4, 0.78], [3.25, 0.82], [4.85, 0.76], [5.0, 0.6], [4.98, 0.34]],
    cabin: [[1.15, 0.8], [1.95, 1.3], [3.05, 1.31], [3.6, 0.82]],
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
    profile: [[0, 0.5], [0.02, 1.02], [2.2, 1.04], [2.25, 1.0], [4.35, 1.08], [5.45, 1.0], [5.6, 0.8], [5.58, 0.48]],
    cabin: [[2.3, 1.06], [2.45, 1.8], [3.6, 1.82], [4.15, 1.1]],
    bed: [0.1, 2.25],
    colors: [0x3d5a73, 0xf2f2f2, 0x8a1d1d, 0x2b2b2b, 0x9a8a6a],
  },
  police: {
    name: 'Ocean Mile Police Cruiser', class: 'Police',
    mass: 1700, length: 5.05, width: 1.92, height: 1.5, wheelbase: 2.95, cgToFront: 1.4, cgHeight: 0.56, wheelR: 0.34, track: 1.64,
    drive: 'rwd', engineForce: 10200, topSpeed: 55, reverseSpeed: 12, brakeForce: 15000, grip: 1.1, rearGripScale: 1.12,
    cornerStiffF: 105000, cornerStiffR: 112000, steerMax: 0.56, steerSpeedRef: 20, handbrakeGrip: 0.4, drag: 0.42, rollRes: 14,
    suspension: 0.6, fragility: 0.7, idleRpm: 750, redline: 6000, gears: [3.2, 2.0, 1.4, 1.05, 0.85], engineVoice: 'v8',
    seats: [[0.4, 0.38, 0.1], [-0.4, 0.38, 0.1], [0.4, 0.38, -0.9], [-0.4, 0.38, -0.9]],
    profile: [[0, 0.32], [0.05, 0.64], [0.9, 0.8], [3.2, 0.88], [4.85, 0.82], [5.05, 0.62], [5.03, 0.32]],
    cabin: [[1.1, 0.86], [1.8, 1.4], [3.15, 1.42], [3.7, 0.9]],
    colors: [0x101318],
    police: true,
  },
};

export const MODEL_IDS = Object.keys(VEHICLES);
