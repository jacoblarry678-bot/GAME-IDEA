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
  // ---------------- Milestone 4 additions ----------------
  ar_tarn: {
    id: 'ar_tarn', name: 'TARN-556', class: 'assault', classLabel: 'Assault Rifle', slot: 'primary', unlockLevel: 2,
    blurb: 'Bullpup rifle with a quick cyclic rate and very little kick. Lower damage per round.',
    damage: { near: 25, far: 19, start: 26, end: 46 },
    mult: { head: 1.45, torso: 1.0, limb: 0.9 },
    rpm: 800, auto: true, pellets: 1,
    mag: 30, reserve: 120, reload: 2.3, reloadEmpty: 2.8,
    spread: { hip: 3.2, ads: 0.1, move: 1.6, air: 5, crouch: 0.8, bloom: 0.3, bloomMax: 2.4, recover: 6 },
    recoil: { v: 0.34, h: 0.16, ads: 0.7, kick: 0.85, recover: 8 },
    handling: { adsTime: 0.26, zoom: 1.35, move: 0.95, adsMove: 0.55, sprintOut: 0.22, swap: 0.45 },
    tracerEvery: 2, range: 300, audio: { kind: 'rifle', pitch: 1.12 }, model: 'bullpup',
  },
  ar_bastion: {
    id: 'ar_bastion', name: 'BASTION .30', class: 'assault', classLabel: 'Assault Rifle', slot: 'primary', unlockLevel: 16,
    blurb: 'Heavy-calibre rifle. Three-shot kill up close, punishing recoil if you hold the trigger.',
    damage: { near: 36, far: 28, start: 30, end: 55 },
    mult: { head: 1.35, torso: 1.0, limb: 0.9 },
    rpm: 560, auto: true, pellets: 1,
    mag: 25, reserve: 100, reload: 2.4, reloadEmpty: 2.9,
    spread: { hip: 3.4, ads: 0.12, move: 1.8, air: 5, crouch: 0.8, bloom: 0.45, bloomMax: 3.0, recover: 5 },
    recoil: { v: 0.7, h: 0.32, ads: 0.75, kick: 1.3, recover: 6 },
    handling: { adsTime: 0.28, zoom: 1.35, move: 0.93, adsMove: 0.5, sprintOut: 0.24, swap: 0.5 },
    tracerEvery: 2, range: 320, audio: { kind: 'rifle', pitch: 0.86 }, model: 'battle',
  },
  ar_meridian: {
    id: 'ar_meridian', name: 'MERIDIAN-B', class: 'assault', classLabel: 'Assault Rifle (burst)', slot: 'primary', unlockLevel: 10,
    blurb: 'Three-round burst carbine. Land a full burst to the upper body and it is over.',
    damage: { near: 36, far: 29, start: 32, end: 55 },
    mult: { head: 1.4, torso: 1.0, limb: 0.9 },
    rpm: 900, auto: false, pellets: 1, burst: { count: 3, delay: 0.26 },
    mag: 30, reserve: 120, reload: 2.2, reloadEmpty: 2.6,
    spread: { hip: 3.0, ads: 0.08, move: 1.6, air: 5, crouch: 0.8, bloom: 0.25, bloomMax: 2.0, recover: 7 },
    recoil: { v: 0.42, h: 0.14, ads: 0.68, kick: 0.9, recover: 8 },
    handling: { adsTime: 0.24, zoom: 1.4, move: 0.95, adsMove: 0.55, sprintOut: 0.2, swap: 0.45 },
    tracerEvery: 1, range: 320, audio: { kind: 'rifle', pitch: 1.04 }, model: 'carbine',
  },
  smg_wasp: {
    id: 'smg_wasp', name: 'WASP MP', class: 'smg', classLabel: 'Submachine Gun', slot: 'primary', unlockLevel: 3,
    blurb: 'Machine pistol with a blistering rate of fire. Wins corners, loses hallways.',
    damage: { near: 22, far: 12, start: 9, end: 22 },
    mult: { head: 1.25, torso: 1.0, limb: 0.9 },
    rpm: 1050, auto: true, pellets: 1,
    mag: 40, reserve: 200, reload: 1.9, reloadEmpty: 2.3,
    spread: { hip: 1.9, ads: 0.3, move: 0.6, air: 3, crouch: 0.85, bloom: 0.2, bloomMax: 2.2, recover: 9 },
    recoil: { v: 0.28, h: 0.32, ads: 0.8, kick: 0.6, recover: 10 },
    handling: { adsTime: 0.15, zoom: 1.2, move: 1.03, adsMove: 0.75, sprintOut: 0.12, swap: 0.35 },
    tracerEvery: 3, range: 200, audio: { kind: 'smg', pitch: 1.3 }, model: 'mp',
  },
  smg_hollow: {
    id: 'smg_hollow', name: 'HOLLOW-X', class: 'smg', classLabel: 'Submachine Gun (suppressed)', slot: 'primary', unlockLevel: 8,
    blurb: 'Integrally suppressed SMG. Firing does not reveal you on the enemy minimap.',
    damage: { near: 28, far: 18, start: 14, end: 30 },
    mult: { head: 1.3, torso: 1.0, limb: 0.9 },
    rpm: 760, auto: true, pellets: 1, suppressed: true,
    mag: 30, reserve: 150, reload: 2.0, reloadEmpty: 2.4,
    spread: { hip: 2.2, ads: 0.2, move: 0.8, air: 3.5, crouch: 0.85, bloom: 0.22, bloomMax: 2.0, recover: 8 },
    recoil: { v: 0.32, h: 0.2, ads: 0.75, kick: 0.7, recover: 9 },
    handling: { adsTime: 0.19, zoom: 1.25, move: 0.99, adsMove: 0.68, sprintOut: 0.15, swap: 0.4 },
    tracerEvery: 99, range: 250, audio: { kind: 'suppressed', pitch: 1.0 }, model: 'suppressed',
  },
  sg_rook: {
    id: 'sg_rook', name: 'ROOK AUTO-12', class: 'shotgun', classLabel: 'Shotgun (semi-auto)', slot: 'primary', unlockLevel: 4,
    blurb: 'Magazine-fed semi-auto shotgun. Less per shot than the Brakk, but no pump to wait on.',
    damage: { near: 13, far: 3, start: 5, end: 13 },
    mult: { head: 1.1, torso: 1.0, limb: 0.9 },
    rpm: 220, auto: false, pellets: 8, pelletSpread: 4.6,
    mag: 8, reserve: 32, reload: 2.6, reloadEmpty: 3.1,
    spread: { hip: 0.8, ads: 0.0, move: 0.5, air: 2, crouch: 1.0, bloom: 0, bloomMax: 0, recover: 6 },
    recoil: { v: 2.2, h: 0.7, ads: 0.85, kick: 2.2, recover: 7 },
    handling: { adsTime: 0.24, zoom: 1.2, move: 0.93, adsMove: 0.6, sprintOut: 0.22, swap: 0.5 },
    tracerEvery: 1, range: 55, audio: { kind: 'shotgun', pitch: 1.12 }, model: 'autoshotgun',
  },
  dmr_sentinel: {
    id: 'dmr_sentinel', name: 'SENTINEL DMR', class: 'sniper', classLabel: 'Marksman Rifle', slot: 'primary', unlockLevel: 6,
    blurb: 'Semi-automatic marksman rifle with a 3x optic. Two to the chest at any range on the map.',
    damage: { near: 52, far: 50, start: 40, end: 80 },
    mult: { head: 1.6, torso: 1.0, limb: 0.9 },
    rpm: 300, auto: false, pellets: 1,
    mag: 15, reserve: 60, reload: 2.5, reloadEmpty: 3.0,
    spread: { hip: 5, ads: 0.0, move: 2.2, air: 6, crouch: 0.85, bloom: 0.5, bloomMax: 2, recover: 6 },
    recoil: { v: 1.4, h: 0.35, ads: 0.7, kick: 1.6, recover: 7 },
    handling: { adsTime: 0.3, zoom: 2.6, move: 0.9, adsMove: 0.45, sprintOut: 0.26, swap: 0.55 },
    tracerEvery: 1, range: 400, audio: { kind: 'dmr', pitch: 1.0 }, model: 'dmr',
  },
  lmg_anvil: {
    id: 'lmg_anvil', name: 'ANVIL-60', class: 'lmg', classLabel: 'Light Machine Gun', slot: 'primary', unlockLevel: 14,
    blurb: 'Belt-fed machine gun. A hundred rounds of suppressing fire; slow to aim and slower to reload.',
    damage: { near: 32, far: 26, start: 30, end: 60 },
    mult: { head: 1.3, torso: 1.0, limb: 0.9 },
    rpm: 600, auto: true, pellets: 1,
    mag: 100, reserve: 200, reload: 5.4, reloadEmpty: 5.9,
    spread: { hip: 4.0, ads: 0.14, move: 2.4, air: 6, crouch: 0.75, bloom: 0.25, bloomMax: 3.2, recover: 5 },
    recoil: { v: 0.42, h: 0.3, ads: 0.62, kick: 1.1, recover: 6 },
    handling: { adsTime: 0.42, zoom: 1.4, move: 0.86, adsMove: 0.38, sprintOut: 0.35, swap: 0.65 },
    tracerEvery: 2, range: 350, audio: { kind: 'lmg', pitch: 0.92 }, model: 'lmg',
  },
  lmg_drover: {
    id: 'lmg_drover', name: 'DROVER LSW', class: 'lmg', classLabel: 'Light Machine Gun', slot: 'primary', unlockLevel: 12,
    blurb: 'Drum-fed squad weapon. Lighter and faster-firing than the Anvil, with 75 rounds.',
    damage: { near: 27, far: 22, start: 28, end: 52 },
    mult: { head: 1.35, torso: 1.0, limb: 0.9 },
    rpm: 760, auto: true, pellets: 1,
    mag: 75, reserve: 150, reload: 4.6, reloadEmpty: 5.1,
    spread: { hip: 3.6, ads: 0.14, move: 2.0, air: 6, crouch: 0.78, bloom: 0.25, bloomMax: 3.0, recover: 5 },
    recoil: { v: 0.38, h: 0.28, ads: 0.66, kick: 1.0, recover: 6 },
    handling: { adsTime: 0.36, zoom: 1.4, move: 0.89, adsMove: 0.42, sprintOut: 0.3, swap: 0.6 },
    tracerEvery: 2, range: 320, audio: { kind: 'lmg', pitch: 1.05 }, model: 'lmgdrum',
  },
  pistol_grizzly: {
    id: 'pistol_grizzly', name: 'GRIZZLY .50', class: 'pistol', classLabel: 'Revolver', slot: 'secondary', unlockLevel: 5,
    blurb: 'Six-shot hand cannon. Two hits up close; make them count.',
    damage: { near: 55, far: 34, start: 12, end: 28 },
    mult: { head: 1.5, torso: 1.0, limb: 0.9 },
    rpm: 170, auto: false, pellets: 1,
    mag: 6, reserve: 30, reload: 2.4, reloadEmpty: 2.4,
    spread: { hip: 2.2, ads: 0.1, move: 0.9, air: 3.5, crouch: 0.85, bloom: 0.8, bloomMax: 2.0, recover: 5 },
    recoil: { v: 3.0, h: 0.8, ads: 0.8, kick: 2.6, recover: 6 },
    handling: { adsTime: 0.18, zoom: 1.2, move: 1.03, adsMove: 0.75, sprintOut: 0.12, swap: 0.35 },
    tracerEvery: 1, range: 200, audio: { kind: 'magnum', pitch: 1.0 }, model: 'revolver',
  },
  melee_axe: {
    id: 'melee_axe', name: 'BREACHING AXE', class: 'melee', classLabel: 'Melee Weapon', slot: 'secondary', unlockLevel: 18,
    blurb: 'A fire axe with a pick spike. One swing takes down anyone in arm\'s reach. Fast to carry.',
    damage: { near: 100, far: 100, start: 0, end: 10 },
    mult: { head: 1, torso: 1, limb: 1 },
    rpm: 90, auto: true, pellets: 0, melee: { damage: 110, range: 2.4, arcDeg: 50, swing: 0.55 },
    mag: 1, reserve: 0, reload: 1, reloadEmpty: 1,
    spread: { hip: 0, ads: 0, move: 0, air: 0, crouch: 1, bloom: 0, bloomMax: 0, recover: 1 },
    recoil: { v: 0, h: 0, ads: 1, kick: 0, recover: 1 },
    handling: { adsTime: 0.2, zoom: 1.0, move: 1.1, adsMove: 1.1, sprintOut: 0.05, swap: 0.35 },
    tracerEvery: 99, range: 3, audio: { kind: 'pistol', pitch: 1 }, model: 'axe',
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
  flash: {
    id: 'flash', name: 'FL-2 FLASH', slot: 'tactical', count: 2, unlockLevel: 3,
    blurb: 'Stun flash. Blinds anyone facing it within 14 m; looking away shortens the effect.',
    fuse: 1.3, throwSpeed: 16, radius: 14, maxBlind: 3.6,
  },
  shield: {
    id: 'shield', name: 'BULWARK COVER', slot: 'tactical', count: 1, deploy: true, unlockLevel: 8,
    blurb: 'Deployable ballistic barrier. Blocks bullets until it takes 450 damage or 30 s pass.',
    hp: 450, life: 30, width: 1.5, height: 1.3, depth: 0.16, dist: 1.4,
  },
};

export const PRIMARY_IDS = ['ar_kv7', 'ar_tarn', 'ar_meridian', 'ar_bastion', 'smg_vesper', 'smg_wasp', 'smg_hollow', 'sg_brakk', 'sg_rook', 'sr_longreach', 'dmr_sentinel', 'lmg_drover', 'lmg_anvil'];
export const SECONDARY_IDS = ['pistol_warden', 'pistol_grizzly', 'melee_axe'];
export const GUN_LADDER = ['smg_wasp', 'smg_vesper', 'ar_tarn', 'ar_kv7', 'ar_meridian', 'smg_hollow', 'sg_brakk', 'sg_rook', 'lmg_drover', 'lmg_anvil', 'ar_bastion', 'dmr_sentinel', 'sr_longreach', 'pistol_grizzly', 'pistol_warden', 'melee'];
export const LETHAL_IDS = ['frag'];
export const TACTICAL_IDS = ['smoke', 'flash', 'shield'];

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
