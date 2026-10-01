/**
 * Pickaxes, back blings and wraps (the models and wrap textures are made in
 * Blender: battle-island/blender/cosmetics.py). Each unlocks by level, an
 * achievement or Benton Badges; the first entry of each list is the free
 * default. Pure data so the menus and save code can use it without three.js.
 */

export const PICKAXES = {
  default: { name: 'Trusty Pick', desc: 'The classic' },
  pickle: { name: 'Pickle Pick', desc: 'A big bumpy pickle on a stick', unlock: { level: 2 } },
  wrench: { name: 'Wrench Whacker', desc: "Borrowed from Dad's garage", unlock: { level: 4 } },
  lollipop: { name: 'Lollipop Smasher', desc: 'A swirly candy wheel', unlock: { level: 6 } },
  dino: { name: 'Raptor Claws', desc: 'Bone handle, twin dino claws', unlock: { level: 9 } },
  star: { name: 'Star Scepter', desc: 'A golden star with a pink gem', unlock: { level: 12 } },
  crankbolt: { name: 'Bolt Breaker', desc: "Crankbolt's own claw arm", unlock: { ach: 'boss1' } },
};

export const BACKBLINGS = {
  outfit: { name: 'Outfit Backpack', desc: 'The pack that comes with your outfit' },
  picklejar: { name: 'Pickle Jar', desc: 'Snacks for the road', unlock: { level: 3 } },
  dino: { name: 'Dino Buddy', desc: 'A plush pal along for the ride', unlock: { level: 5 } },
  shield: { name: 'Clubhouse Shield', desc: 'Blue, gold and starry', unlock: { level: 8 } },
  rocket: { name: 'Toy Rocket', desc: 'With a glowing booster', unlock: { level: 11 } },
  chest: { name: 'Treasure Chest', desc: 'For your Benton Badges', unlock: { badges: 4 } },
  minibolt: { name: 'Mini Crankbolt', desc: 'A tiny robot friend', unlock: { ach: 'vault1' } },
};

export const WRAPS = {
  none: { name: 'No Wrap', desc: 'Factory finish', swatch: ['#2c3440', '#555c69'] },
  camo: { name: 'Camo Crew', desc: 'Woodland camo', unlock: { level: 2 }, swatch: ['#2f4a2a', '#5f7a3a', '#8a7a4a'] },
  candy: { name: 'Candy Stripe', desc: 'Pink and white swirls', unlock: { level: 4 }, swatch: ['#ff4f7a', '#ffffff'] },
  pickle: { name: 'Pickle Skin', desc: 'Bumpy and green', unlock: { level: 6 }, swatch: ['#3f9a2a', '#6fd04a'] },
  galaxy: { name: 'Galaxy', desc: 'Stars and nebula', unlock: { level: 10 }, swatch: ['#0b0b2a', '#3a1d6a', '#ff5ca8'] },
  lava: { name: 'Lava Rock', desc: 'Glowing cracks', unlock: { level: 14 }, swatch: ['#1d1414', '#ff5a1a', '#ffe45c'] },
  gold: { name: 'Gold Rush', desc: 'Win a match to earn it', unlock: { ach: 'first_win' }, swatch: ['#ffae1a', '#ffe45c'] },
};

/** kind → its list (kinds match the save keys and the Locker sections). */
export const LOCKER = { pickaxe: PICKAXES, backbling: BACKBLINGS, wrap: WRAPS };
export const DEFAULTS = { pickaxe: 'default', backbling: 'outfit', wrap: 'none' };

/** A short "how to unlock" label. */
export function unlockText(u, achName = (id) => id) {
  if (!u) return 'Free';
  if (u.level) return `Reach level ${u.level}`;
  if (u.badges) return `Find ${u.badges} Benton Badges`;
  if (u.ach) return `Achievement: ${achName(u.ach)}`;
  return 'Locked';
}
