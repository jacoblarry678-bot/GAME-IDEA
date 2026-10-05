/** Weapon definitions (data-driven). Damage is per hit on a 100-health character. */
export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', melee: true, damage: 14, range: 1.5, cooldown: 0.45, icon: '✊' },
  pistol: {
    id: 'pistol', name: 'Pistol', melee: false, damage: 34, mag: 12, startReserve: 48, maxReserve: 180,
    cooldown: 0.2, reload: 1.35, range: 110, spread: 0.010, moveSpread: 0.03, hipSpread: 0.045,
    recoil: 0.028, loudness: 70, icon: '🔫',
  },
};
