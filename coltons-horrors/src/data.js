// All game content definitions for Colton's Horrors.
// Every character, perk, add-on, offering and map here is original to this project.

export const VERSION = '1.1.0';
export const PTB_NOTE = 'Public Test Build: The Woodsman is new and his numbers may change in the next update.';

export const RARITIES = {
  common: { name: 'Common', color: '#a49c8c' },
  uncommon: { name: 'Uncommon', color: '#6fae62' },
  rare: { name: 'Rare', color: '#4f8fd6' },
  epic: { name: 'Epic', color: '#a466d9' },
  legendary: { name: 'Legendary', color: '#e3aa3c' },
};

/* ------------------------------------------------------------------ */
/* Survivors                                                           */
/* ------------------------------------------------------------------ */

// Outfit fields: hair (style), hairColor, top (hoodie|jacket|shirt|vest|coat), topColor, accent,
// legs (pants|slim|shorts), legsColor, shoes, hat (null|beanie|cap|hood|headband), hatColor, extras[]
export const SURVIVORS = [
  {
    id: 'colton', name: 'Colton Hale', age: 17, role: 'Amateur filmmaker',
    signature: 'adrenal_surge', skin: '#d7a888', height: 1.8,
    bio: 'Colton found a reel of film in his grandfather\'s attic with no label and one frame that moved when nobody was looking. He played it once. Now the night keeps rewinding to the same field.',
    outfits: [
      { id: 'colton_default', name: 'Late Shift', rarity: 'common', price: 0, hair: 'swept', hairColor: '#5a3b22', top: 'hoodie', topColor: '#3b4a5a', accent: '#c9c2b0', legs: 'pants', legsColor: '#2f3d55', shoes: '#d8d8d0', hat: null, extras: ['backpack'], extraColor: '#6b3a2a' },
      { id: 'colton_film', name: 'Film Club', rarity: 'uncommon', price: 3000, hair: 'swept', hairColor: '#5a3b22', top: 'jacket', topColor: '#6a2b2b', accent: '#e0d6c0', legs: 'pants', legsColor: '#1f2633', shoes: '#2a2a2a', hat: 'beanie', hatColor: '#1d1d1f', extras: [] },
      { id: 'colton_varsity', name: 'Varsity Night', rarity: 'rare', price: 6000, hair: 'swept', hairColor: '#3a2614', top: 'jacket', topColor: '#1f3f2a', accent: '#d8c48a', legs: 'pants', legsColor: '#4a4a3c', shoes: '#e8e8e0', hat: 'cap', hatColor: '#a33a2a', extras: [] },
      { id: 'colton_reel', name: 'Bloodied Reel', rarity: 'legendary', price: 12000, hair: 'swept', hairColor: '#1a1210', top: 'hoodie', topColor: '#151515', accent: '#7a0e0e', legs: 'pants', legsColor: '#2b1b1b', shoes: '#111111', hat: 'hood', hatColor: '#151515', extras: ['scarf'], extraColor: '#7a0e0e' },
    ],
  },
  {
    id: 'maya', name: 'Maya Okafor', age: 31, role: 'Paramedic',
    signature: 'field_medic', skin: '#7a4e34', height: 1.68,
    bio: 'Maya answered a call to a farmhouse at 3:12 a.m. The ambulance was found the next morning with the engine running and the radio playing static.',
    outfits: [
      { id: 'maya_default', name: 'On Call', rarity: 'common', price: 0, hair: 'bun', hairColor: '#1a1210', top: 'vest', topColor: '#2c4a7a', accent: '#d8d8d8', legs: 'pants', legsColor: '#1f2a3a', shoes: '#111111', hat: null, extras: [] },
      { id: 'maya_offduty', name: 'Off Duty', rarity: 'uncommon', price: 3000, hair: 'bun', hairColor: '#1a1210', top: 'hoodie', topColor: '#7a5a8a', accent: '#e8e0f0', legs: 'slim', legsColor: '#3b4a6a', shoes: '#e8e8e8', hat: null, extras: [] },
      { id: 'maya_trauma', name: 'Trauma Bay', rarity: 'rare', price: 6000, hair: 'bun', hairColor: '#2a1a12', top: 'shirt', topColor: '#4a7a6a', accent: '#4a7a6a', legs: 'pants', legsColor: '#4a7a6a', shoes: '#f0f0f0', hat: 'headband', hatColor: '#d8d8d8', extras: [] },
      { id: 'maya_night', name: 'Night Nurse', rarity: 'epic', price: 9000, hair: 'bun', hairColor: '#0e0a08', top: 'coat', topColor: '#d8d4cc', accent: '#8a1a1a', legs: 'slim', legsColor: '#2a2a2a', shoes: '#1a1a1a', hat: null, extras: ['glasses'] },
    ],
  },
  {
    id: 'ruth', name: 'Ruth Lindqvist', age: 64, role: 'Retired park ranger',
    signature: 'sixth_sense', skin: '#e3c1a8', height: 1.66,
    bio: 'Forty years walking the same trails taught Ruth which sounds belong to the woods. The ones she hears now do not.',
    outfits: [
      { id: 'ruth_default', name: 'Ranger Station', rarity: 'common', price: 0, hair: 'short', hairColor: '#c9c6c0', top: 'shirt', topColor: '#6a6a3a', accent: '#3a2a1a', legs: 'pants', legsColor: '#4a4030', shoes: '#3a2a1a', hat: 'cap', hatColor: '#3a3a22', extras: [] },
      { id: 'ruth_hunting', name: 'Hunting Season', rarity: 'uncommon', price: 3000, hair: 'short', hairColor: '#c9c6c0', top: 'vest', topColor: '#c8661a', accent: '#3a3a3a', legs: 'pants', legsColor: '#3b3b3b', shoes: '#2a2018', hat: 'beanie', hatColor: '#c8661a', extras: [] },
      { id: 'ruth_sunday', name: 'Sunday Best', rarity: 'rare', price: 6000, hair: 'short', hairColor: '#e0ddd8', top: 'coat', topColor: '#5a2a3a', accent: '#c9b98a', legs: 'slim', legsColor: '#3a2a2a', shoes: '#1a1210', hat: null, extras: ['scarf', 'glasses'], extraColor: '#c9b98a' },
      { id: 'ruth_oldgrowth', name: 'Old Growth', rarity: 'epic', price: 9000, hair: 'short', hairColor: '#a8a49c', top: 'jacket', topColor: '#2a3a2a', accent: '#8a7a4a', legs: 'pants', legsColor: '#3a3022', shoes: '#2a2018', hat: 'hood', hatColor: '#2a3a2a', extras: [] },
    ],
  },
  {
    id: 'dev', name: 'Dev Malhotra', age: 26, role: 'Mechanic',
    signature: 'tinkerer', skin: '#9a6a48', height: 1.77,
    bio: 'Dev can make any engine turn over. The generators out here are older than anything he has seen, and they hum back at him in a language he almost understands.',
    outfits: [
      { id: 'dev_default', name: 'Grease Monkey', rarity: 'common', price: 0, hair: 'curly', hairColor: '#141010', top: 'shirt', topColor: '#3a4a5a', accent: '#c9a23a', legs: 'pants', legsColor: '#3a4a5a', shoes: '#2a1a10', hat: null, extras: [] },
      { id: 'dev_drag', name: 'Weekend Drag', rarity: 'uncommon', price: 3000, hair: 'curly', hairColor: '#141010', top: 'jacket', topColor: '#1a1a1a', accent: '#8a8a8a', legs: 'pants', legsColor: '#2a3a5a', shoes: '#1a1a1a', hat: null, extras: [] },
      { id: 'dev_pit', name: 'Pit Crew', rarity: 'rare', price: 6000, hair: 'curly', hairColor: '#141010', top: 'shirt', topColor: '#b02020', accent: '#f0f0f0', legs: 'pants', legsColor: '#1a1a1a', shoes: '#f0f0f0', hat: 'cap', hatColor: '#b02020', extras: [] },
      { id: 'dev_rust', name: 'Rust Bucket', rarity: 'epic', price: 9000, hair: 'curly', hairColor: '#141010', top: 'coat', topColor: '#7a4a2a', accent: '#3a2a1a', legs: 'pants', legsColor: '#4a3a2a', shoes: '#2a1a10', hat: 'beanie', hatColor: '#3a3a3a', extras: ['glasses'] },
    ],
  },
  {
    id: 'jess', name: 'Jess Navarro', age: 19, role: 'Track athlete',
    signature: 'featherweight', skin: '#c08a62', height: 1.7,
    bio: 'Jess holds the county record in the 400 metres. Out here the finish line keeps moving, and something is always one stride behind her.',
    outfits: [
      { id: 'jess_default', name: 'Morning Run', rarity: 'common', price: 0, hair: 'ponytail', hairColor: '#2a1608', top: 'shirt', topColor: '#d8d8e0', accent: '#e04a6a', legs: 'slim', legsColor: '#1a1a24', shoes: '#e04a6a', hat: null, extras: [] },
      { id: 'jess_track', name: 'Track Meet', rarity: 'uncommon', price: 3000, hair: 'ponytail', hairColor: '#2a1608', top: 'hoodie', topColor: '#2a5ad8', accent: '#ffffff', legs: 'shorts', legsColor: '#2a2a2a', shoes: '#ffffff', hat: null, extras: [] },
      { id: 'jess_homecoming', name: 'Homecoming', rarity: 'rare', price: 6000, hair: 'ponytail', hairColor: '#4a2a10', top: 'jacket', topColor: '#e0e0e0', accent: '#a01a3a', legs: 'slim', legsColor: '#3a2a4a', shoes: '#1a1a1a', hat: 'headband', hatColor: '#a01a3a', extras: [] },
      { id: 'jess_neon', name: 'Neon Nights', rarity: 'legendary', price: 12000, hair: 'ponytail', hairColor: '#1a0a04', top: 'hoodie', topColor: '#e01a8a', accent: '#1ae0d8', legs: 'slim', legsColor: '#101018', shoes: '#1ae0d8', hat: 'cap', hatColor: '#1ae0d8', extras: [] },
    ],
  },
  {
    id: 'theo', name: 'Theo Brandt', age: 44, role: 'Late-night radio host',
    signature: 'soft_step', skin: '#e8c8b0', height: 1.83,
    bio: 'Theo\'s call-in show "After Midnight" took a call from a girl who said she was drowning in a lake that froze over in 1912. He tried to trace the number.',
    outfits: [
      { id: 'theo_default', name: 'Graveyard Shift', rarity: 'common', price: 0, hair: 'long', hairColor: '#3a2a1a', top: 'coat', topColor: '#3a3226', accent: '#8a7a5a', legs: 'pants', legsColor: '#2a2a2a', shoes: '#1a1210', hat: null, extras: ['glasses', 'beard'] },
      { id: 'theo_callin', name: 'Call-In Hour', rarity: 'uncommon', price: 3000, hair: 'long', hairColor: '#3a2a1a', top: 'shirt', topColor: '#6a3a6a', accent: '#d8c8a0', legs: 'pants', legsColor: '#3a3a3a', shoes: '#1a1a1a', hat: null, extras: ['headphones', 'beard'] },
      { id: 'theo_static', name: 'Dead Air', rarity: 'rare', price: 6000, hair: 'long', hairColor: '#2a1a10', top: 'hoodie', topColor: '#2a2a2a', accent: '#d8d8d8', legs: 'pants', legsColor: '#1a1a1a', shoes: '#2a2a2a', hat: 'beanie', hatColor: '#5a5a5a', extras: ['beard'] },
      { id: 'theo_broadcast', name: 'Last Broadcast', rarity: 'legendary', price: 12000, hair: 'long', hairColor: '#5a4a3a', top: 'coat', topColor: '#1a1a2a', accent: '#c0a050', legs: 'pants', legsColor: '#1a1a1a', shoes: '#0a0a0a', hat: null, extras: ['scarf', 'glasses', 'beard'], extraColor: '#c0a050' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Killers                                                             */
/* ------------------------------------------------------------------ */

export const KILLERS = [
  {
    id: 'specter', name: 'The Specter', realName: 'Evelyn Marsh', height: 1.98,
    speed: 4.6, terror: 32, weapon: 'Rusted Boat Hook',
    signature: ['whispers', 'hook_rot'],
    bio: 'In the winter of 1912 Evelyn Marsh walked onto Hollow Lake in her wedding dress to meet a groom who never came. The ice gave way at midnight. She has been looking for him ever since, and everyone she finds is the wrong face.',
    power: {
      id: 'veil_walk', name: 'Veil Walk', glyph: 'ghost',
      desc: 'Hold the Power button to slip behind the veil. You move 65% faster and survivors cannot see you, but you cannot see them either: only their footstep ripples, scratch marks and blood. Release or run out of veil to return. Cannot attack while in the veil.',
    },
    outfits: [
      { id: 'specter_default', name: 'Drowned Bride', rarity: 'common', price: 0, dress: '#cfcabd', dress2: '#7a7466', hair: '#0a0a0b', skin: '#b9c2bf', eyes: '#a8d8ff', veil: true, metal: '#6a4a32' },
      { id: 'specter_mourning', name: 'Mourning Black', rarity: 'rare', price: 6000, dress: '#17151a', dress2: '#3a2f3a', hair: '#0a0a0b', skin: '#c8cccc', eyes: '#ff4a4a', veil: true, metal: '#3a3a3a' },
      { id: 'specter_lakerot', name: 'Lake Rot', rarity: 'epic', price: 9000, dress: '#4a5a3a', dress2: '#2a3320', hair: '#1a2010', skin: '#8a9a80', eyes: '#d8ff6a', veil: false, metal: '#4a3a1a' },
      { id: 'specter_frost', name: 'Frostbound', rarity: 'legendary', price: 14000, dress: '#bcd8ea', dress2: '#6a8aa8', hair: '#e8f4ff', skin: '#d0e4f0', eyes: '#4ae0ff', veil: true, metal: '#9ab8d0' },
    ],
  },
  {
    id: 'exe', name: 'The EXE', realName: 'NULL.EXE', height: 2.18,
    speed: 4.6, terror: 32, weapon: 'Screen Shard',
    signature: ['static_shriek', 'bloodlust'],
    bio: 'A program nobody wrote, found running on a dead arcade board in the basement of a closed motel. It learned to walk by watching the security cameras. It learned to hunt by watching the people who tried to switch it off.',
    power: {
      id: 'signal_jump', name: 'Signal Jump', glyph: 'tv',
      desc: 'Corrupted CRT screens are scattered around the map. Hold the Power button to pick the screen you are facing, release to channel and jump to it. Survivors within 12 m of your arrival become Glitched: their skill checks jump around and their aura flickers for you. Survivors can unplug screens to switch them off for a while.',
    },
    outfits: [
      { id: 'exe_default', name: 'Static', rarity: 'common', price: 0, body: '#08090b', glow: '#2ff3ff', glow2: '#ff2f6a', face: '#ff2f3a' },
      { id: 'exe_overclock', name: 'Overclock', rarity: 'rare', price: 6000, body: '#120606', glow: '#ff3a1a', glow2: '#ffb21a', face: '#ffde3a' },
      { id: 'exe_gold', name: 'Corrupted Gold', rarity: 'epic', price: 9000, body: '#2a2008', glow: '#ffd84a', glow2: '#fff4c0', face: '#ffffff' },
      { id: 'exe_vapor', name: 'Vaporwave', rarity: 'epic', price: 9000, body: '#1a0a2a', glow: '#ff6ad8', glow2: '#6ad8ff', face: '#ff9af0' },
      { id: 'exe_bsod', name: 'Blue Screen', rarity: 'legendary', price: 14000, body: '#0a1a6a', glow: '#ffffff', glow2: '#6aa0ff', face: '#ffffff' },
    ],
  },
  {
    id: 'woodsman', name: 'The Woodsman', realName: 'Abel Crane', height: 2.06, ptb: true,
    speed: 4.6, terror: 32, weapon: 'Felling Axe',
    signature: ['timber', 'splinter'],
    bio: 'Abel Crane felled timber on Crane Ridge for thirty winters. When the mill closed and the company men came to take his land, he walked into the pines with his felling axe and a mask carved from the first birch he ever cut. The ridge has been quiet since. The trees have not.',
    power: {
      id: 'heavy_chop', name: 'Heavy Chop', glyph: 'axe',
      desc: 'Hold the Power button to raise the axe (you move 15% slower while it is up). Release after at least 0.6 seconds to bring it down in a long lunging chop that covers far more ground than a normal attack and smashes any dropped pallet in its path. The longer the charge, up to 1.5 seconds, the farther the chop. A miss leaves you prying the axe out of the ground for 2.5 seconds.',
    },
    outfits: [
      { id: 'woodsman_default', name: 'Ridge Logger', rarity: 'common', price: 0, plaid: '#8a1e1a', plaid2: '#151515', pants: '#3a3a2a', mask: '#d8d0b8', cap: '#3a2a1a', metal: '#8a8a88', haft: '#5a3a20' },
      { id: 'woodsman_widow', name: 'Widow Maker', rarity: 'rare', price: 6000, plaid: '#2a4a2a', plaid2: '#101010', pants: '#2a2a2a', mask: '#c8b890', cap: '#1a1a1a', metal: '#6a6a66', haft: '#3a2614' },
      { id: 'woodsman_burnt', name: 'Burnt Stand', rarity: 'epic', price: 9000, plaid: '#3a2a20', plaid2: '#0a0a0a', pants: '#1a1410', mask: '#2a2420', cap: '#0a0a0a', metal: '#4a3a30', haft: '#1a120c' },
      { id: 'woodsman_frost', name: 'Frost Line', rarity: 'legendary', price: 14000, plaid: '#3a5a7a', plaid2: '#d8e0e8', pants: '#2a3040', mask: '#e8eef4', cap: '#d8e0e8', metal: '#c0d8e8', haft: '#6a7a8a' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Perks                                                               */
/* ------------------------------------------------------------------ */

export const SURVIVOR_PERKS = [
  { id: 'adrenal_surge', name: 'Adrenal Surge', icon: 'bolt', price: 3000, desc: 'When you are hit and stay on your feet, run 50% faster for 3 seconds. Cooldown 60 seconds.' },
  { id: 'steady_hands', name: 'Steady Hands', icon: 'target', price: 3000, desc: 'Skill check success zones are 50% larger. Great skill checks give 2% extra progress.' },
  { id: 'sixth_sense', name: 'Sixth Sense', icon: 'eye', price: 4000, desc: 'While the killer is within 24 m and out of your sight, you see their aura.' },
  { id: 'field_medic', name: 'Field Medic', icon: 'cross', price: 3000, desc: 'Heal other survivors 50% faster. You can heal yourself without a med kit at half speed.' },
  { id: 'soft_step', name: 'Soft Step', icon: 'foot', price: 3500, desc: 'Your footsteps and pained breathing are 80% quieter. The killer has to be 30% closer to notice you.' },
  { id: 'last_breath', name: 'Last Breath', icon: 'heart', price: 6000, desc: 'Once per match, a hit that would put you down leaves you injured instead and gives you 2 seconds of speed.' },
  { id: 'tinkerer', name: 'Tinkerer', icon: 'wrench', price: 3000, desc: 'Repair generators 15% faster. Great skill checks while repairing give 1% extra progress.' },
  { id: 'lockbreaker', name: 'Lockbreaker', icon: 'key', price: 3500, desc: 'Open exit gates 50% faster. Once the gates are powered, you see both of them through walls.' },
  { id: 'shadow_walk', name: 'Shadow Walk', icon: 'moon', price: 4000, desc: 'Crouch-walk 30% faster. You leave 50% fewer scratch marks and they fade twice as fast.' },
  { id: 'kinship', name: 'Kinship', icon: 'link', price: 3500, desc: 'See every other survivor\'s aura at all times. When anyone is hooked, see the killer for 4 seconds.' },
  { id: 'borrowed_breath', name: 'Borrowed Breath', icon: 'shield', price: 5000, desc: 'Unhook survivors 50% faster. Anyone you unhook can take one extra hit without going down for 12 seconds.' },
  { id: 'escape_artist', name: 'Escape Artist', icon: 'hook', price: 4500, desc: 'On your first hook, each attempt to free yourself has a 25% chance (up from 4%) and takes half as long.' },
  { id: 'featherweight', name: 'Featherweight', icon: 'feather', price: 3000, desc: 'Vault windows and pallets 30% faster.' },
  { id: 'scavenger', name: 'Scavenger', icon: 'box', price: 3000, desc: 'Search chests 60% faster. Items you carry start with 25% more charge.' },
];

export const KILLER_PERKS = [
  { id: 'bloodhound', name: 'Bloodhound', icon: 'drop', price: 3000, desc: 'Scratch marks and blood last twice as long and glow brighter.' },
  { id: 'sundering_grip', name: 'Sundering Grip', icon: 'claw', price: 3500, desc: 'Damaging a generator knocks off 15% progress at once, and it then regresses 25% faster.' },
  { id: 'whispers', name: 'Graveside Whispers', icon: 'ear', price: 3000, desc: 'You hear whispers while any survivor is within 32 m of you.' },
  { id: 'relentless', name: 'Relentless', icon: 'flame', price: 4000, desc: 'Recover 40% faster after a successful attack.' },
  { id: 'bloodlust', name: 'Bloodlust', icon: 'skull', price: 4000, desc: 'While chasing, gain 3% speed every 8 seconds, up to 12%. Resets when you hit someone or lose the chase.' },
  { id: 'alarm_bells', name: 'Alarm Bells', icon: 'bell', price: 3500, desc: 'When a generator is completed, every survivor repairing a generator is revealed to you for 5 seconds.' },
  { id: 'static_shriek', name: 'Static Shriek', icon: 'glitch', price: 3000, desc: 'A survivor who fails a skill check is revealed to you for 6 seconds.' },
  { id: 'hamstring', name: 'Hamstring', icon: 'claw', price: 4500, desc: 'After a basic attack lands, the survivor is slowed by 15% for 6 seconds once their burst of speed ends.' },
  { id: 'long_reach', name: 'Long Reach', icon: 'target', price: 3500, desc: 'Your lunge reaches 25% farther.' },
  { id: 'wrecker', name: 'Wrecker', icon: 'gear', price: 3000, desc: 'Break pallets and damage generators 50% faster.' },
  { id: 'muffled_heart', name: 'Muffled Heart', icon: 'heart', price: 4500, desc: 'Your terror radius is 50% smaller.' },
  { id: 'hook_rot', name: 'Hook Rot', icon: 'hook', price: 3500, desc: 'Hooked survivors weaken 25% faster. When someone is unhooked, the rescuer is revealed to you for 5 seconds.' },
  { id: 'final_hour', name: 'Final Hour', icon: 'hourglass', price: 6000, desc: 'When the exit gates are powered, every survivor is Marked for 60 seconds: any hit puts them down.' },
  { id: 'timber', name: 'Timber!', icon: 'axe', price: 3500, desc: 'When you break a pallet, every survivor within 16 m is revealed to you for 4 seconds.' },
  { id: 'splinter', name: 'Splinter', icon: 'drop', price: 3500, desc: 'Downed survivors bleed out 25% faster and leave twice as much blood.' },
  { id: 'patient_hunter', name: 'Patient Hunter', icon: 'moon', price: 3000, desc: 'Move 5% faster while you are not chasing or carrying anyone.' },
];

/* ------------------------------------------------------------------ */
/* Survivor items and their add-ons                                    */
/* ------------------------------------------------------------------ */

export const ITEMS = [
  { id: 'flashlight', name: 'Flashlight', icon: 'flashlight', rarity: 'uncommon', price: 1500, charges: 14, desc: 'Hold the Item button to shine it. Hold the beam on the killer\'s face to blind them. A blinded killer drops whoever they are carrying.' },
  { id: 'medkit', name: 'Med Kit', icon: 'medkit', rarity: 'common', price: 1000, charges: 32, desc: 'Hold the Item button to heal yourself.' },
  { id: 'toolbox', name: 'Toolbox', icon: 'toolbox', rarity: 'common', price: 1000, charges: 32, desc: 'Repair generators 50% faster while it has charge. Used automatically while repairing.' },
  { id: 'map', name: 'Survey Map', icon: 'map', rarity: 'rare', price: 2000, charges: 40, desc: 'Hold the Item button to see generator auras through walls.' },
];

export const ITEM_ADDONS = [
  { id: 'wide_lens', item: 'flashlight', name: 'Wide Lens', rarity: 'common', price: 600, desc: 'The beam is 30% wider.' },
  { id: 'heavy_battery', item: 'flashlight', name: 'Heavy Battery', rarity: 'uncommon', price: 900, desc: '+8 seconds of charge.' },
  { id: 'focus_lens', item: 'flashlight', name: 'Focus Lens', rarity: 'rare', price: 1500, desc: 'Blind the killer 30% faster.' },
  { id: 'sterile_gauze', item: 'medkit', name: 'Sterile Gauze', rarity: 'common', price: 600, desc: '+16 seconds of charge.' },
  { id: 'styptic', item: 'medkit', name: 'Styptic Powder', rarity: 'uncommon', price: 900, desc: 'Heal 25% faster with the kit.' },
  { id: 'morphine', item: 'medkit', name: 'Morphine Vial', rarity: 'rare', price: 1500, desc: 'Heal 50% faster with the kit and missed skill checks cost nothing.' },
  { id: 'socket_set', item: 'toolbox', name: 'Socket Set', rarity: 'common', price: 600, desc: '+16 seconds of charge.' },
  { id: 'duct_tape', item: 'toolbox', name: 'Duct Tape', rarity: 'uncommon', price: 900, desc: 'The repair bonus rises to 75%.' },
  { id: 'spark_plug', item: 'toolbox', name: 'Spark Plug', rarity: 'rare', price: 1500, desc: 'Great skill checks while repairing give 3% extra progress.' },
  { id: 'red_marker', item: 'map', name: 'Red Marker', rarity: 'common', price: 600, desc: 'The map also shows hooks.' },
  { id: 'compass', item: 'map', name: 'Brass Compass', rarity: 'uncommon', price: 900, desc: 'The map also shows exit gates and chests.' },
  { id: 'creased_corner', item: 'map', name: 'Creased Corner', rarity: 'common', price: 600, desc: '+20 seconds of charge.' },
];

/* ------------------------------------------------------------------ */
/* Killer power add-ons                                                */
/* ------------------------------------------------------------------ */

export const KILLER_ADDONS = [
  // The Specter
  { id: 'ring_fragment', killer: 'specter', name: 'Ring Fragment', rarity: 'common', price: 600, desc: 'Veil Walk lasts 0.5 seconds longer.' },
  { id: 'lake_silt', killer: 'specter', name: 'Lake Silt', rarity: 'common', price: 600, desc: 'Veil Walk recharges 10% faster.' },
  { id: 'dried_lily', killer: 'specter', name: 'Dried Lily', rarity: 'uncommon', price: 900, desc: 'Move 10% faster in the veil.' },
  { id: 'torn_hem', killer: 'specter', name: 'Torn Hem', rarity: 'uncommon', price: 900, desc: 'Veil Walk recharges 20% faster.' },
  { id: 'mourning_locket', killer: 'specter', name: 'Mourning Locket', rarity: 'rare', price: 1600, desc: 'In the veil, see survivor auras within 10 m.' },
  { id: 'waterlogged_diary', killer: 'specter', name: 'Waterlogged Diary', rarity: 'rare', price: 1600, desc: 'Veil Walk lasts 1 second longer.' },
  { id: 'wedding_veil', killer: 'specter', name: 'Wedding Veil', rarity: 'epic', price: 2800, desc: 'Your first attack within 2.5 seconds of leaving the veil reaches 60% farther.' },
  { id: 'drowned_bell', killer: 'specter', name: 'Drowned Bell', rarity: 'legendary', price: 4000, desc: 'Leaving the veil reveals every survivor within 16 m for 4 seconds.' },
  // The EXE
  { id: 'cracked_glass', killer: 'exe', name: 'Cracked Glass', rarity: 'common', price: 600, desc: 'Signal Jump channels 0.3 seconds faster.' },
  { id: 'dusty_cartridge', killer: 'exe', name: 'Dusty Cartridge', rarity: 'common', price: 600, desc: 'Glitched lasts 4 seconds longer.' },
  { id: 'corrupt_save', killer: 'exe', name: 'Corrupt Save', rarity: 'uncommon', price: 900, desc: 'Two more screens spawn on the map.' },
  { id: 'burnt_capacitor', killer: 'exe', name: 'Burnt Capacitor', rarity: 'uncommon', price: 900, desc: 'Signal Jump cooldown is 15% shorter.' },
  { id: 'dead_pixel', killer: 'exe', name: 'Dead Pixel Eye', rarity: 'rare', price: 1600, desc: 'Glitched survivors are revealed to you for the whole duration.' },
  { id: 'unplugged_cord', killer: 'exe', name: 'Frayed Cord', rarity: 'rare', price: 1600, desc: 'Unplugged screens come back 50% sooner.' },
  { id: 'infinite_loop', killer: 'exe', name: 'Infinite Loop', rarity: 'epic', price: 2800, desc: 'Signal Jump cooldown is 35% shorter.' },
  // The Woodsman (PTB)
  { id: 'whetstone', killer: 'woodsman', name: 'Whetstone', rarity: 'common', price: 600, desc: 'Heavy Chop reaches full charge 0.3 seconds sooner.' },
  { id: 'pine_tar', killer: 'woodsman', name: 'Pine Tar', rarity: 'common', price: 600, desc: 'Pry the axe free 0.8 seconds faster after a missed chop.' },
  { id: 'iron_wedge', killer: 'woodsman', name: 'Iron Wedge', rarity: 'uncommon', price: 900, desc: 'Heavy Chop travels 15% farther.' },
  { id: 'birch_mask', killer: 'woodsman', name: 'Birch Mask Shard', rarity: 'uncommon', price: 900, desc: 'Move only 7% slower while the axe is raised.' },
  { id: 'saw_tooth', killer: 'woodsman', name: 'Rusted Saw Tooth', rarity: 'rare', price: 1600, desc: 'Survivors hit by a Heavy Chop are slowed by 20% for 4 seconds after their burst of speed.' },
  { id: 'heartwood', killer: 'woodsman', name: 'Heartwood', rarity: 'legendary', price: 4000, desc: 'A fully charged Heavy Chop puts a healthy survivor straight down.' },
  { id: 'blue_screen', killer: 'exe', name: 'Blue Screen', rarity: 'legendary', price: 4000, desc: 'Arriving knocks 15% off generators within 16 m and reveals survivors within 24 m for 6 seconds.' },
];

/* ------------------------------------------------------------------ */
/* Offerings                                                           */
/* ------------------------------------------------------------------ */

export const OFFERINGS = [
  { id: 'off_ashgrove', side: 'any', name: 'Rusted Weathervane', icon: 'candle', rarity: 'uncommon', price: 800, map: 'ashgrove', desc: 'Sends the match to Ashgrove Farmstead.' },
  { id: 'off_hollowpines', side: 'any', name: 'Faded Trail Marker', icon: 'candle', rarity: 'uncommon', price: 800, map: 'hollowpines', desc: 'Sends the match to Hollow Pines Campground.' },
  { id: 'off_stivo', side: 'any', name: 'Patient Wristband', icon: 'candle', rarity: 'uncommon', price: 800, map: 'stivo', desc: 'Sends the match to St. Ivo\'s Sanatorium.' },
  { id: 'off_gravelpit', side: 'any', name: 'Bent Hubcap', icon: 'candle', rarity: 'uncommon', price: 800, map: 'gravelpit', desc: 'Sends the match to Gravelpit Salvage.' },
  { id: 'off_lantern', side: 'any', name: 'Lantern Oil', icon: 'lantern', rarity: 'common', price: 500, fog: 0.6, desc: 'The fog is 40% thinner.' },
  { id: 'off_bog', side: 'any', name: 'Bog Incense', icon: 'mist', rarity: 'common', price: 500, fog: 1.6, desc: 'The fog is 60% thicker.' },
  { id: 'off_storm', side: 'any', name: 'Storm in a Bottle', icon: 'mist', rarity: 'rare', price: 1200, weather: 'storm', desc: 'Rain and lightning for the whole match.' },
  { id: 'off_bloodmoon', side: 'any', name: 'Blood Moon Charm', icon: 'moon', rarity: 'rare', price: 1500, marrowAll: 0.5, moon: 'blood', desc: 'A red moon rises. +50% Marrow in every category.' },
  { id: 'off_bonecharm', side: 'any', name: 'Bone Charm', icon: 'skull', rarity: 'uncommon', price: 900, marrowMain: 1.0, desc: '+100% Marrow in your main category (Grit or Savagery).' },
  { id: 'off_wishbone', side: 'survivor', name: 'Wishbone', icon: 'box', rarity: 'common', price: 600, chests: 2, desc: 'Two extra chests appear in the match.' },
  { id: 'off_penny', side: 'survivor', name: 'Lucky Penny', icon: 'coin', rarity: 'rare', price: 1200, hatchNear: true, desc: 'The hatch spawns close to where you start.' },
  { id: 'off_rite', side: 'killer', name: 'Ashen Rite', icon: 'skull', rarity: 'epic', price: 2500, mori: true, desc: 'Lets you perform a Mori: execute any downed survivor who has already been hooked once (press R next to them).' },
  { id: 'off_hangman', side: 'killer', name: 'Hangman\'s Rope', icon: 'rope', rarity: 'legendary', price: 3500, hangman: true, desc: 'Survivors are sacrificed on their second hook instead of their third.' },
];

/* ------------------------------------------------------------------ */
/* Maps                                                                */
/* ------------------------------------------------------------------ */

export const MAPS = [
  {
    id: 'ashgrove', name: 'Ashgrove Farmstead', region: 'Ashgrove County, 1987',
    desc: 'A foreclosed dairy farm gone to seed. Endless rows of dead corn, a leaning barn, a silo that rings when the wind changes.',
    kit: 'farm', weather: 'clear', fogColor: 0x1c2230, fogDensity: 0.030, sky: [0x05070d, 0x1d2431],
    moonColor: 0xb8c6e8, moonIntensity: 1.25, hemi: [0x5a6a88, 0x1a140c, 0.55], groundTex: 'farm',
  },
  {
    id: 'hollowpines', name: 'Hollow Pines Campground', region: 'Hollow Lake, Oregon',
    desc: 'A summer camp closed since the drowning. Cabins with the doors still open, a cold fire pit, and a lake that does not reflect the moon.',
    kit: 'camp', weather: 'clear', fogColor: 0x17211f, fogDensity: 0.034, sky: [0x03060a, 0x18231f],
    moonColor: 0xaac4d8, moonIntensity: 1.15, hemi: [0x4a6a6a, 0x10140c, 0.5], groundTex: 'forest',
  },
  {
    id: 'stivo', name: 'St. Ivo\'s Sanatorium', region: 'Marrow Hill, est. 1906',
    desc: 'A tuberculosis hospital left to the weeds. Cracked courtyards, broken wards and rain that never quite stops.',
    kit: 'asylum', weather: 'rain', fogColor: 0x1d2024, fogDensity: 0.036, sky: [0x06070a, 0x23262b],
    moonColor: 0xa8b0c0, moonIntensity: 0.95, hemi: [0x5a606a, 0x14120f, 0.55], groundTex: 'asylum',
  },
  {
    id: 'gravelpit', name: 'Gravelpit Salvage', region: 'Route 9, mile 41',
    desc: 'A scrapyard of stacked wrecks and shipping containers. Oil drums still burn. Something keeps rearranging the cars.',
    kit: 'junk', weather: 'clear', fogColor: 0x231d1a, fogDensity: 0.028, sky: [0x07060a, 0x2a221d],
    moonColor: 0xd8c0a0, moonIntensity: 1.05, hemi: [0x6a5a4a, 0x16100a, 0.5], groundTex: 'junk',
  },
];

/* ------------------------------------------------------------------ */
/* Scoring categories                                                  */
/* ------------------------------------------------------------------ */

export const SURVIVOR_CATEGORIES = [
  { id: 'grit', name: 'Grit', desc: 'Repairs, gates, chests' },
  { id: 'nerve', name: 'Nerve', desc: 'Chases, stuns, saves' },
  { id: 'kinship', name: 'Kinship', desc: 'Heals, unhooks, rescues' },
  { id: 'endurance', name: 'Endurance', desc: 'Surviving and escaping' },
];

export const KILLER_CATEGORIES = [
  { id: 'savagery', name: 'Savagery', desc: 'Hits and downs' },
  { id: 'cunning', name: 'Cunning', desc: 'Power use, generator damage' },
  { id: 'pursuit', name: 'Pursuit', desc: 'Finding and chasing' },
  { id: 'ritual', name: 'Ritual', desc: 'Hooks and sacrifices' },
];

export const CATEGORY_CAP = 8000;

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const index = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const SURVIVOR_BY_ID = index(SURVIVORS);
export const KILLER_BY_ID = index(KILLERS);
export const PERK_BY_ID = { ...index(SURVIVOR_PERKS), ...index(KILLER_PERKS) };
export const ITEM_BY_ID = index(ITEMS);
export const ADDON_BY_ID = { ...index(ITEM_ADDONS), ...index(KILLER_ADDONS) };
export const OFFERING_BY_ID = index(OFFERINGS);
export const MAP_BY_ID = index(MAPS);

export function outfitOf(charDef, outfitId) {
  return charDef.outfits.find((o) => o.id === outfitId) || charDef.outfits[0];
}
