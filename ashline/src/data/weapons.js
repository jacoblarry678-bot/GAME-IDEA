/**
 * Data-driven weapon definitions. Every gameplay number lives here so weapons
 * can be tuned or added without touching code. Angles are in degrees,
 * distances in meters, times in seconds.
 *
 * damage: { near, far, start, end }  linear falloff between start..end meters
 * mult:   hitzone multipliers (head / torso / limb)
 * spread: hip & ADS cone half-angles, plus additive penalties and bloom
 * recoil: per-shot camera kick (vertical, horizontal random range), ADS multiplier
 * handling: ADS time, zoom factor, movement multipliers, sprint-to-fire delay
 */
export const WEAPONS = {
  ar_kv7: {
    id: 'ar_kv7', name: 'KV-7 RAMPART', class: 'assault', classLabel: 'Assault Rifle', slot: 'primary',
    blurb: 'Balanced full-auto rifle. Dependable at every range the yard offers.',
    damage: { near: 30, far: 22, start: 28, end: 48 },
    mult: { head: 1.4, torso: 1.0, limb: 0.9 },
    rpm: 690, auto: true, pellets: 1,
    mag: 30, reserve: 120, reload: 2.1, reloadEmpty: 2.6,
    spread: { hip: 3.0, ads: 0.1, move: 1.6, air: 5, crouch: 0.8, bloom: 0.35, bloomMax: 2.5, recover: 6 },
    recoil: { v: 0.46, h: 0.2, ads: 0.72, kick: 1.0, recover: 7 },
    handling: { adsTime: 0.24, zoom: 1.35, move: 0.95, adsMove: 0.55, sprintOut: 0.2, swap: 0.45 },
    tracerEvery: 2, range: 300,
    audio: { kind: 'rifle', pitch: 1.0 },
    model: 'ar',
  },
  smg_vesper: {
    id: 'smg_vesper', name: 'VESPER-9', class: 'smg', classLabel: 'Submachine Gun', slot: 'primary',
    blurb: 'Fast-firing and agile. Wins close quarters, fades past 25 m.',
    damage: { near: 26, far: 15, start: 12, end: 28 },
    mult: { head: 1.25, torso: 1.0, limb: 0.9 },
    rpm: 900, auto: true, pellets: 1,
    mag: 32, reserve: 160, reload: 1.8, reloadEmpty: 2.2,
    spread: { hip: 2.1, ads: 0.22, move: 0.8, air: 3.5, crouch: 0.85, bloom: 0.22, bloomMax: 2.0, recover: 8 },
    recoil: { v: 0.3, h: 0.26, ads: 0.75, kick: 0.7, recover: 9 },
    handling: { adsTime: 0.17, zoom: 1.22, move: 1.0, adsMove: 0.7, sprintOut: 0.14, swap: 0.38 },
    tracerEvery: 3, range: 250,
    audio: { kind: 'smg', pitch: 1.15 },
    model: 'smg',
  },
  sg_brakk: {
    id: 'sg_brakk', name: 'BRAKK-12', class: 'shotgun', classLabel: 'Shotgun', slot: 'primary',
    blurb: 'Pump-action 12 gauge. One shot inside a room settles the argument.',
    damage: { near: 17, far: 4, start: 6, end: 16 },
    mult: { head: 1.1, torso: 1.0, limb: 0.9 },
    rpm: 70, auto: false, pellets: 9, pelletSpread: 4.0,
    mag: 6, reserve: 24, reload: 0.5, reloadEmpty: 0.5, tube: { start: 0.35, perShell: 0.5, end: 0.4 },
    spread: { hip: 0.8, ads: 0.0, move: 0.5, air: 2, crouch: 1.0, bloom: 0, bloomMax: 0, recover: 6 },
    recoil: { v: 3.2, h: 0.8, ads: 0.85, kick: 3.0, recover: 6 },
    handling: { adsTime: 0.22, zoom: 1.2, move: 0.94, adsMove: 0.6, sprintOut: 0.2, swap: 0.5 },
    tracerEvery: 1, range: 60,
    audio: { kind: 'shotgun', pitch: 1.0 },
    model: 'shotgun', pump: true,
  },
  sr_longreach: {
    id: 'sr_longreach', name: 'LR-338 LONGREACH', class: 'sniper', classLabel: 'Sniper Rifle', slot: 'primary',
    blurb: 'Bolt-action precision. Upper body or head is a one-shot elimination.',
    damage: { near: 95, far: 88, start: 50, end: 90 },
    mult: { head: 2.0, torso: 1.1, limb: 0.85 },
    rpm: 46, auto: false, pellets: 1,
    mag: 5, reserve: 20, reload: 2.8, reloadEmpty: 3.4,
    spread: { hip: 7.5, ads: 0.0, move: 3, air: 8, crouch: 0.9, bloom: 0, bloomMax: 0, recover: 6 },
    recoil: { v: 2.6, h: 0.6, ads: 0.7, kick: 3.4, recover: 4 },
    handling: { adsTime: 0.38, zoom: 4.2, move: 0.88, adsMove: 0.38, sprintOut: 0.32, swap: 0.6, scope: true, sway: 0.35 },
    tracerEvery: 1, range: 500,
    audio: { kind: 'sniper', pitch: 0.9 },
    model: 'sniper', bolt: true,
  },
  pistol_warden: {
    id: 'pistol_warden', name: 'HX-9 WARDEN', class: 'pistol', classLabel: 'Pistol', slot: 'secondary',
    blurb: 'Semi-automatic sidearm. Quick to draw when the primary runs dry.',
    damage: { near: 34, far: 21, start: 10, end: 24 },
    mult: { head: 1.4, torso: 1.0, limb: 0.9 },
    rpm: 420, auto: false, pellets: 1,
    mag: 12, reserve: 48, reload: 1.4, reloadEmpty: 1.75,
    spread: { hip: 1.7, ads: 0.15, move: 0.7, air: 3, crouch: 0.85, bloom: 0.4, bloomMax: 1.6, recover: 7 },
    recoil: { v: 1.1, h: 0.35, ads: 0.75, kick: 1.3, recover: 9 },
    handling: { adsTime: 0.14, zoom: 1.18, move: 1.05, adsMove: 0.8, sprintOut: 0.1, swap: 0.3 },
    tracerEvery: 1, range: 200,
    audio: { kind: 'pistol', pitch: 1.2 },
    model: 'pistol',
  },
};

export const MELEE = { damage: 55, range: 1.9, cooldown: 0.75, arcDeg: 40 };

export const EQUIPMENT = {
  frag: {
    id: 'frag', name: 'M-7 FRAG', slot: 'lethal', count: 1,
    blurb: 'Fragmentation grenade. 2.6 s fuse from the throw.',
    fuse: 2.6, throwSpeed: 17, damage: 150, innerRadius: 2.4, radius: 7.0, minDamage: 15,
  },
  smoke: {
    id: 'smoke', name: 'SMK-4 SMOKE', slot: 'tactical', count: 1,
    blurb: 'Screening smoke. Deploys a cloud that blocks sight for 14 s.',
    fuse: 1.2, throwSpeed: 15, radius: 4.8, duration: 14,
  },
};

export const PRIMARY_IDS = ['ar_kv7', 'smg_vesper', 'sg_brakk', 'sr_longreach'];
export const SECONDARY_IDS = ['pistol_warden'];
export const LETHAL_IDS = ['frag'];
export const TACTICAL_IDS = ['smoke'];

/** Damage at distance d with falloff. */
export function damageAt(def, d) {
  const { near, far, start, end } = def.damage;
  if (d <= start) return near;
  if (d >= end) return far;
  return near + (far - near) * ((d - start) / (end - start));
}

/** Summarise a weapon for UI bars (0..1). */
export function weaponStats(def) {
  const pellets = def.pellets || 1;
  const dmg = Math.min(1, (def.damage.near * pellets * 0.6) / 100);
  const range = Math.min(1, (def.damage.end * (def.damage.far / def.damage.near)) / 80);
  const rate = Math.min(1, def.rpm / 950);
  const acc = Math.max(0, 1 - (def.recoil.v * 0.12 + def.spread.hip * 0.04 + def.spread.ads * 1.2));
  const mob = Math.min(1, (def.handling.move - 0.8) / 0.28);
  const handling = Math.max(0, 1 - (def.handling.adsTime - 0.12) / 0.3);
  return { damage: dmg, range, fireRate: rate, accuracy: acc, mobility: mob, handling };
}
