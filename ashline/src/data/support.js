/**
 * Support abilities: earned by consecutive eliminations without dying (the
 * count resets on death). An earned ability stays available until used.
 * Eliminations from support abilities do not count toward the next one.
 */
export const SUPPORT = {
  recon: { id: 'recon', name: 'Recon Scan', kills: 4, desc: 'Reveals every enemy on your team\'s minimap for 10 s.', duration: 10 },
  supply: { id: 'supply', name: 'Supply Drop', kills: 6, desc: 'Calls in a crate that restocks ammo, equipment and health for your team.', fall: 3, life: 45, radius: 1.8 },
  strike: { id: 'strike', name: 'Area Strike', kills: 8, desc: 'Marks the point you aim at; after a warning, artillery saturates a 7 m radius.', delay: 3, shells: 7, spread: 6.5, interval: 0.32, damage: 140, innerRadius: 2.6, radius: 6, minDamage: 20, range: 90 },
};
export const SUPPORT_IDS = ['recon', 'supply', 'strike'];
export const supportThreshold = (id, perks) => SUPPORT[id].kills - (perks?.has?.('pk_hardline') ? 1 : 0);
