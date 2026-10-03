/**
 * Perks: three slots, one perk each. Unlocked by player level, never sold.
 * Effects are applied in Combatant / Match / BotBrain by id.
 */
export const PERKS = {
  // slot 1
  pk_quickdraw: { id: 'pk_quickdraw', slot: 1, name: 'Quickdraw', unlockLevel: 1, desc: 'Aim down sights 20% faster.' },
  pk_scavenger: { id: 'pk_scavenger', slot: 1, name: 'Scavenger', unlockLevel: 4, desc: 'Eliminations restock one magazine of reserve ammo for both weapons.' },
  pk_flak: { id: 'pk_flak', slot: 1, name: 'Flak Lining', unlockLevel: 9, desc: 'Take 45% less damage from explosives and area strikes; flashes last half as long.' },
  // slot 2
  pk_hardline: { id: 'pk_hardline', slot: 2, name: 'Hardline', unlockLevel: 1, desc: 'Support abilities need one fewer elimination.' },
  pk_ghost: { id: 'pk_ghost', slot: 2, name: 'Ghost', unlockLevel: 7, desc: 'Hidden from enemy Recon Scans.' },
  pk_sleight: { id: 'pk_sleight', slot: 2, name: 'Fast Hands', unlockLevel: 11, desc: 'Reload 20% faster and throw equipment faster.' },
  // slot 3
  pk_resolve: { id: 'pk_resolve', slot: 3, name: 'Resolve', unlockLevel: 1, desc: 'Health starts regenerating after 2.5 s instead of 4 s.' },
  pk_dexterity: { id: 'pk_dexterity', slot: 3, name: 'Dexterity', unlockLevel: 5, desc: 'Swap weapons and recover from sprinting 35% faster.' },
  pk_silence: { id: 'pk_silence', slot: 3, name: 'Dead Silence', unlockLevel: 13, desc: 'Your footsteps make no sound; bots cannot hear you approach.' },
};
export const PERK_SLOTS = [1, 2, 3];
export const DEFAULT_PERKS = ['pk_quickdraw', 'pk_hardline', 'pk_resolve'];
export const perksForSlot = (slot) => Object.values(PERKS).filter((p) => p.slot === slot);
