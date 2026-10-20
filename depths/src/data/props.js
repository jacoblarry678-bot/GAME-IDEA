/**
 * Prop kinds: default footprint (w along x, d along z, h), collision and
 * gameplay flags. Rotations are multiples of 90 degrees so every collider
 * stays axis-aligned. The view has a mesh builder for each kind.
 *
 *   solid  blocks movement         sight  blocks sight/photos
 *   mantle can be mantled (<=0.8m) cover  counts as solid cover for hiding
 *   hide   a locker you can enter   low    knee-high (does not block sight)
 */
export const PROP_KINDS = {
  // office
  desk: { w: 1.6, d: 0.8, h: 0.75, cover: true },
  chair: { w: 0.55, d: 0.55, h: 0.9, solid: false, sight: false },
  partition: { w: 2.0, d: 0.08, h: 1.5, cover: true },
  partitionTall: { w: 2.0, d: 0.08, h: 2.0, cover: true },
  cabinet: { w: 0.5, d: 0.65, h: 1.35, cover: true },
  cabinetTall: { w: 0.9, d: 0.5, h: 2.0, cover: true },
  cabinetFallen: { w: 1.9, d: 0.6, h: 0.55, mantle: true, low: true },
  shelf: { w: 2.0, d: 0.45, h: 2.1, cover: true },
  copier: { w: 1.1, d: 0.7, h: 1.2, cover: true },
  counter: { w: 3.0, d: 0.8, h: 1.05, cover: true },
  table: { w: 1.4, d: 0.9, h: 0.75, sight: false, cover: true },
  plant: { w: 0.45, d: 0.45, h: 1.3, sight: false },
  crate: { w: 1.0, d: 1.0, h: 0.75, mantle: true, low: true },
  boxes: { w: 0.8, d: 0.6, h: 0.6, low: true, mantle: true },
  locker: { w: 0.6, d: 0.55, h: 2.0, hide: true },
  lockerBank: { w: 2.4, d: 0.5, h: 2.0 },
  sofa: { w: 2.0, d: 0.85, h: 0.85, cover: true, low: true },
  bed: { w: 1.4, d: 2.0, h: 0.6, low: true },
  wardrobe: { w: 1.2, d: 0.6, h: 2.0, cover: true },
  tv: { w: 1.2, d: 0.4, h: 1.2, cover: true },
  mesh: { w: 2.0, d: 0.06, h: 2.6, sight: false },
  glass: { w: 2.0, d: 0.06, h: 2.4, sight: false },
  pillar: { w: 0.8, d: 0.8, h: 4, cover: true },
  railing: { w: 2.0, d: 0.08, h: 1.05, sight: false, mask: 3 },
  barrier: { w: 2.0, d: 0.1, h: 1.1, sight: false },
  // mall
  storefront: { w: 4.0, d: 0.15, h: 3.0, sight: false },
  display: { w: 1.6, d: 0.8, h: 0.9, low: true, cover: true },
  rack: { w: 1.6, d: 0.6, h: 1.4, cover: true },
  fountain: { w: 6.0, d: 6.0, h: 0.6, low: true },
  bench: { w: 1.8, d: 0.5, h: 0.45, low: true, mantle: true },
  kiosk: { w: 2.2, d: 1.6, h: 2.4, cover: true },
  directory: { w: 1.4, d: 0.4, h: 2.2, cover: true },
  // pool
  lane: { w: 2.0, d: 0.12, h: 0.3, solid: false, sight: false },
  grating: { w: 2.0, d: 2.0, h: 0.06, solid: false, sight: false },
  pump: { w: 1.6, d: 1.2, h: 1.6, cover: true },
  pipeRun: { w: 4.0, d: 0.4, h: 0.4, solid: false, sight: false },
  tank: { w: 2.0, d: 2.0, h: 2.6, cover: true },
  // apartments
  mailboxes: { w: 2.4, d: 0.4, h: 1.8, cover: true },
  washer: { w: 0.7, d: 0.7, h: 0.95, cover: true, low: true },
  cart: { w: 1.0, d: 0.6, h: 0.9, low: true },
  // industrial
  machine: { w: 2.4, d: 2.0, h: 2.4, cover: true },
  press: { w: 3.0, d: 2.4, h: 3.2, cover: true },
  turbine: { w: 3.0, d: 3.0, h: 2.8, cover: true },
  workbench: { w: 2.0, d: 0.8, h: 0.95, cover: true },
  drum: { w: 0.7, d: 0.7, h: 1.0, low: true, cover: true },
  console: { w: 1.6, d: 0.7, h: 1.1, cover: true },
  relay: { w: 2.4, d: 1.0, h: 2.4, cover: true },
  // decoration (no collision)
  sign: { w: 1.2, d: 0.05, h: 1.2, solid: false, sight: false },
  seam: { w: 1.0, d: 0.1, h: 0.01, solid: false, sight: false },
  cableTray: { w: 0.5, d: 3.0, h: 0.3, solid: false, sight: false },
  vent: { w: 0.8, d: 0.08, h: 0.5, solid: false, sight: false },
  liftPanel: { w: 0.5, d: 0.1, h: 0.7, solid: false, sight: false },
  decal: { w: 1, d: 0.02, h: 1, solid: false, sight: false },
  // generic invisible collider
  block: { w: 1, d: 1, h: 3 },
};

/** Size after rotation (rot in degrees, multiples of 90). */
export function propSize(p) {
  const k = PROP_KINDS[p.k] || PROP_KINDS.block;
  const s = p.s || [k.w, k.d, k.h];
  const rot = ((p.rot || 0) % 360 + 360) % 360;
  return rot === 90 || rot === 270 ? [s[1], s[0], s[2]] : [s[0], s[1], s[2]];
}
