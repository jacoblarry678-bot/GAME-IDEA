/**
 * Weapon attachments. Every attachment trades one thing for another (no
 * straight upgrades). They are earned by levelling the weapon in matches —
 * never sold. `applyAttachments` derives a weapon definition with the
 * modifiers folded in; the derived def keeps the base weapon's stable id.
 *
 * Modifier keys (multipliers unless noted):
 *   adsTime, move, adsMove, sprintOut, swap, recoilV, recoilH, hip, ads,
 *   bloom, range (falloff distances), reload, mag (round count mult),
 *   zoom (absolute override), suppressed (flag), muzzleVel (tracer cosmetic only)
 */

export const ATTACH_SLOTS = ['optic', 'muzzle', 'barrel', 'magazine', 'stock', 'underbarrel'];
export const SLOT_LABELS = { optic: 'Optic', muzzle: 'Muzzle', barrel: 'Barrel', magazine: 'Magazine', stock: 'Stock', underbarrel: 'Underbarrel' };
export const MAX_ATTACHMENTS = 5;

const GUNS = ['assault', 'smg', 'lmg', 'shotgun', 'sniper', 'pistol'];
const LONG = ['assault', 'smg', 'lmg'];

export const ATTACHMENTS = {
  // ---- optics (visual sight swap; ADS alignment follows the new sight)
  opt_reflex: { id: 'opt_reflex', slot: 'optic', name: 'Pinpoint Reflex', classes: [...LONG, 'shotgun', 'dmr'], optic: 'reflex', mods: { adsTime: 1.03 }, pros: ['Clear red-dot sight picture'], cons: ['ADS time +3%'] },
  opt_holo: { id: 'opt_holo', slot: 'optic', name: 'Wideframe Holographic', classes: [...LONG, 'shotgun', 'dmr'], optic: 'holo', mods: { adsTime: 1.05, zoomMul: 1.08 }, pros: ['Large window, slight magnification'], cons: ['ADS time +5%'] },
  opt_3x: { id: 'opt_3x', slot: 'optic', name: 'Talon 3x Scope', classes: [...LONG], optic: 'scope3x', mods: { adsTime: 1.18, zoom: 2.4, adsMove: 0.9 }, pros: ['3x magnification for long sightlines'], cons: ['ADS time +18%', 'ADS move speed −10%'] },
  // ---- muzzles
  mz_comp: { id: 'mz_comp', slot: 'muzzle', name: 'Ridge Compensator', classes: [...LONG, 'pistol', 'dmr'], muzzle: 'comp', mods: { recoilV: 0.85, hip: 1.08 }, pros: ['Vertical recoil −15%'], cons: ['Hip-fire spread +8%'] },
  mz_brake: { id: 'mz_brake', slot: 'muzzle', name: 'Talus Muzzle Brake', classes: [...LONG, 'dmr', 'sniper'], muzzle: 'brake', mods: { recoilH: 0.72, recoilV: 0.95, adsTime: 1.04 }, pros: ['Horizontal recoil −28%'], cons: ['ADS time +4%'] },
  mz_supp: { id: 'mz_supp', slot: 'muzzle', name: 'Hush Suppressor', classes: [...GUNS, 'dmr'], muzzle: 'supp', mods: { suppressed: true, range: 0.88, adsTime: 1.05 }, pros: ['Hidden from radar when firing', 'Quieter: bots hear you from shorter range'], cons: ['Damage range −12%', 'ADS time +5%'] },
  mz_choke: { id: 'mz_choke', slot: 'muzzle', name: 'Full Choke', classes: ['shotgun'], muzzle: 'comp', mods: { pellet: 0.75, adsTime: 1.04 }, pros: ['Pellet spread −25%'], cons: ['ADS time +4%'] },
  // ---- barrels
  br_long: { id: 'br_long', slot: 'barrel', name: 'Extended Barrel', classes: [...GUNS, 'dmr'], mods: { range: 1.22, adsTime: 1.08, move: 0.98 }, pros: ['Damage range +22%'], cons: ['ADS time +8%', 'Move speed −2%'] },
  br_short: { id: 'br_short', slot: 'barrel', name: 'Short Barrel', classes: [...GUNS, 'dmr'], mods: { range: 0.85, adsTime: 0.9, hip: 0.9, move: 1.02 }, pros: ['ADS time −10%', 'Hip-fire spread −10%', 'Move speed +2%'], cons: ['Damage range −15%'] },
  // ---- magazines
  mg_ext: { id: 'mg_ext', slot: 'magazine', name: 'Extended Mag', classes: [...LONG, 'pistol', 'dmr', 'shotgun'], mag: 'ext', mods: { mag: 1.5, reload: 1.12, adsTime: 1.05 }, pros: ['Magazine +50%'], cons: ['Reload +12%', 'ADS time +5%'] },
  mg_fast: { id: 'mg_fast', slot: 'magazine', name: 'Quick-Pull Mag', classes: [...LONG, 'pistol', 'dmr', 'sniper'], mag: 'fast', mods: { reload: 0.78, mag: 0.85 }, pros: ['Reload −22%'], cons: ['Magazine −15%'] },
  // ---- stocks
  st_light: { id: 'st_light', slot: 'stock', name: 'Skeleton Stock', classes: [...LONG, 'shotgun', 'sniper', 'dmr'], mods: { move: 1.04, adsMove: 1.12, sprintOut: 0.85, recoilV: 1.1, recoilH: 1.1 }, pros: ['Move speed +4%', 'ADS move speed +12%', 'Sprint-to-fire −15%'], cons: ['Recoil +10%'] },
  st_heavy: { id: 'st_heavy', slot: 'stock', name: 'Padded Heavy Stock', classes: [...LONG, 'shotgun', 'sniper', 'dmr'], mods: { recoilV: 0.88, recoilH: 0.88, move: 0.97, adsTime: 1.06 }, pros: ['Recoil −12%'], cons: ['Move speed −3%', 'ADS time +6%'] },
  // ---- underbarrel
  ub_vgrip: { id: 'ub_vgrip', slot: 'underbarrel', name: 'Vertical Grip', classes: [...LONG, 'shotgun'], under: 'vgrip', mods: { recoilV: 0.88, adsTime: 1.04 }, pros: ['Vertical recoil −12%'], cons: ['ADS time +4%'] },
  ub_angled: { id: 'ub_angled', slot: 'underbarrel', name: 'Angled Grip', classes: [...LONG, 'shotgun'], under: 'angled', mods: { adsTime: 0.9, recoilH: 1.08 }, pros: ['ADS time −10%'], cons: ['Horizontal recoil +8%'] },
  ub_laser: { id: 'ub_laser', slot: 'underbarrel', name: 'Tac Laser', classes: [...LONG, 'shotgun', 'pistol'], under: 'laser', mods: { hip: 0.75, sprintOut: 0.9 }, pros: ['Hip-fire spread −25%', 'Sprint-to-fire −10%'], cons: ['Visible laser dot gives away your aim'], laser: true },
};

/** Order in which attachments unlock by weapon level (filtered per weapon). */
const UNLOCK_ORDER = ['mz_comp', 'opt_reflex', 'ub_vgrip', 'mg_ext', 'mz_choke', 'st_light', 'br_short', 'opt_holo', 'mz_supp', 'ub_angled', 'mg_fast', 'st_heavy', 'br_long', 'mz_brake', 'opt_3x', 'ub_laser'];

/** Attachment category key for a weapon (DMRs differ from bolt-action snipers). */
export function attachClass(def) {
  if (def.class === 'sniper' && def.model === 'dmr') return 'dmr';
  return def.class;
}

/** Attachments available for a weapon, with the weapon level that unlocks each. */
export function attachmentsFor(def) {
  if (!def || def.melee) return [];
  const cls = attachClass(def);
  const ok = UNLOCK_ORDER.filter((id) => ATTACHMENTS[id].classes.includes(cls) && !(def.suppressed && id === 'mz_supp'));
  // spread unlocks across weapon levels 2..19
  const step = ok.length > 1 ? 17 / (ok.length - 1) : 0;
  return ok.map((id, i) => ({ ...ATTACHMENTS[id], level: Math.round(2 + i * step) }));
}

export function attachmentUnlockLevel(def, attId) {
  return attachmentsFor(def).find((a) => a.id === attId)?.level ?? Infinity;
}

/** Clean a build: drop unknown, inapplicable, locked (if level given) or over-limit attachments. */
export function sanitizeBuild(def, build, weaponLevel = Infinity) {
  const out = {};
  if (!build || typeof build !== 'object') return out;
  const avail = new Map(attachmentsFor(def).map((a) => [a.id, a]));
  let n = 0;
  for (const slot of ATTACH_SLOTS) {
    const id = build[slot];
    const a = avail.get(id);
    if (!a || a.slot !== slot || a.level > weaponLevel || n >= MAX_ATTACHMENTS) continue;
    out[slot] = id; n++;
  }
  return out;
}

const cache = new Map();

/** Derived weapon definition with attachment modifiers applied (cached per build). */
export function applyAttachments(base, build) {
  const ids = ATTACH_SLOTS.map((s) => build?.[s]).filter((id) => id && ATTACHMENTS[id]);
  if (!ids.length) return base;
  const key = base.id + '|' + ids.join(',');
  if (cache.has(key)) return cache.get(key);
  const m = { adsTime: 1, move: 1, adsMove: 1, sprintOut: 1, recoilV: 1, recoilH: 1, hip: 1, range: 1, reload: 1, mag: 1, zoomMul: 1, pellet: 1 };
  let zoom = null, suppressed = !!base.suppressed, laser = false;
  for (const id of ids) {
    const a = ATTACHMENTS[id];
    for (const [k, v] of Object.entries(a.mods)) {
      if (k === 'zoom') zoom = v;
      else if (k === 'suppressed') suppressed = true;
      else m[k] *= v;
    }
    if (a.laser) laser = true;
  }
  const d = {
    ...base,
    attachments: Object.fromEntries(ATTACH_SLOTS.filter((s) => build[s] && ATTACHMENTS[build[s]]).map((s) => [s, build[s]])),
    suppressed,
    laser,
    damage: { ...base.damage, start: base.damage.start * m.range, end: base.damage.end * m.range },
    spread: { ...base.spread, hip: base.spread.hip * m.hip },
    recoil: { ...base.recoil, v: base.recoil.v * m.recoilV, h: base.recoil.h * m.recoilH },
    handling: {
      ...base.handling,
      adsTime: base.handling.adsTime * m.adsTime,
      move: base.handling.move * m.move,
      adsMove: Math.min(1, base.handling.adsMove * m.adsMove),
      sprintOut: base.handling.sprintOut * m.sprintOut,
      zoom: zoom ?? base.handling.zoom * m.zoomMul,
    },
    reload: base.reload * m.reload,
    reloadEmpty: base.reloadEmpty * m.reload,
    mag: Math.max(1, Math.round(base.mag * m.mag)),
    reserve: Math.max(1, Math.round(base.reserve * m.mag)),
  };
  if (base.tube) d.tube = { ...base.tube, perShell: base.tube.perShell * m.reload };
  if (base.pelletSpread) d.pelletSpread = base.pelletSpread * m.pellet;
  if (suppressed && !base.suppressed) d.audio = { kind: 'suppressed', pitch: base.audio.pitch };
  // a non-scope optic replaces a sniper-style full-screen scope
  if (base.handling.scope && ids.some((id) => ATTACHMENTS[id].optic)) d.handling.scope = false;
  if (base.burst) d.burst = { ...base.burst };
  cache.set(key, d);
  return d;
}

/** Short tag for model caches. */
export function buildKey(build) {
  return build ? ATTACH_SLOTS.map((s) => build[s] || '').join('.') : '';
}
