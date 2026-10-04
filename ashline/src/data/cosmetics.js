/**
 * Cosmetic catalog. Every entry has a stable id (saved in profiles), a type,
 * rarity, description, how it is obtained, and the visual parameters the
 * renderers use. Cosmetics never change damage, recoil, hitboxes, movement
 * or visibility: team identification bands are always drawn on top.
 *
 * unlock: { type: 'default' } | { type: 'level', level } | { type: 'weapon', weapon, level }
 *       | { type: 'pass', tier, track } | { type: 'shop' } | { type: 'operator', operator }
 */

export const RARITY = {
  common: { name: 'Common', color: '#a3acb2', dupe: 50, value: 300 },
  rare: { name: 'Rare', color: '#4aa3ff', dupe: 100, value: 600 },
  epic: { name: 'Epic', color: '#b07cff', dupe: 200, value: 1000 },
  legendary: { name: 'Legendary', color: '#ffb84d', dupe: 400, value: 1800 },
};

export const TYPES = {
  operator: { name: 'Operators', single: 'Operator' },
  outfit: { name: 'Outfits', single: 'Outfit' },
  finish: { name: 'Weapon Finishes', single: 'Weapon Finish' },
  charm: { name: 'Charms', single: 'Charm' },
  card: { name: 'Calling Cards', single: 'Calling Card' },
  emblem: { name: 'Emblems', single: 'Emblem' },
  banner: { name: 'Banners', single: 'Banner' },
};

const items = [];
const add = (o) => { items.push(o); return o; };

// ---------------- operators (skin index, default headgear, default outfit)
add({ id: 'op_voss', type: 'operator', name: 'VOSS', rarity: 'common', desc: 'Warden rifleman. Twenty years on rail security details before the Directorate.', unlock: { type: 'default' }, op: { skin: 0, headgear: 'helmet', outfit: 'of_voss_std' } });
add({ id: 'op_marek', type: 'operator', name: 'MAREK', rarity: 'rare', desc: 'Breacher. Prefers doors that are already open, and makes sure of it.', unlock: { type: 'level', level: 10 }, op: { skin: 4, headgear: 'balaclava', outfit: 'of_marek_std' } });
add({ id: 'op_sol', type: 'operator', name: 'SOL', rarity: 'epic', desc: 'Marksman and spotter. Counts distances in railway sleepers.', unlock: { type: 'pass', tier: 25, track: 'free' }, op: { skin: 2, headgear: 'cap', outfit: 'of_sol_std' } });
add({ id: 'op_kestrel', type: 'operator', name: 'KESTREL', rarity: 'legendary', desc: 'Recon specialist. First in, last seen.', unlock: { type: 'pass', tier: 1, track: 'premium' }, op: { skin: 3, headgear: 'beanie', outfit: 'of_kestrel_std' } });

// ---------------- outfits (3 per operator). palette: camo 4 colors; vest; helmet; glove
const outfit = (id, op, name, rarity, desc, unlock, palette, vest, helmet, glove, extra = {}) =>
  add({ id, type: 'outfit', operator: op, name, rarity, desc, unlock, outfit: { palette, vest, helmet, glove, ...extra } });
outfit('of_voss_std', 'op_voss', 'Directorate Standard', 'common', 'Issue fatigues in Warden green.', { type: 'default' }, [[70, 78, 70], [92, 98, 84], [48, 54, 50], [112, 112, 98]], [58, 66, 60], 0x4a5444, 0x232321);
outfit('of_voss_yard', 'op_voss', 'Yard Shift', 'rare', 'Hi-vis trim over rail-yard greys.', { type: 'level', level: 16 }, [[92, 94, 96], [120, 122, 124], [64, 66, 70], [140, 140, 136]], [214, 120, 30], 0x5a5e62, 0x2b2b28);
outfit('of_voss_ash', 'op_voss', 'Ashfall', 'legendary', 'Charcoal kit dusted in cinder grey. Season 1 premium finale.', { type: 'pass', tier: 50, track: 'premium' }, [[46, 46, 48], [70, 68, 66], [30, 30, 32], [96, 92, 88]], [36, 36, 38], 0x2a2a2c, 0x161616, { glow: 0xff6a20 });
outfit('of_marek_std', 'op_marek', 'Breach Kit', 'rare', 'Reinforced plate carrier and urban camo. Comes with Marek.', { type: 'operator', operator: 'op_marek' }, [[84, 86, 92], [108, 110, 116], [56, 58, 64], [130, 132, 136]], [44, 48, 56], 0x3a3e46, 0x1e1e20);
outfit('of_marek_rust', 'op_marek', 'Rust Belt', 'epic', 'Weathered browns from the scrap lines.', { type: 'shop' }, [[110, 72, 48], [138, 96, 62], [74, 50, 36], [160, 120, 84]], [86, 58, 40], 0x5c3e2a, 0x2a1e16);
outfit('of_marek_night', 'op_marek', 'Night Breach', 'epic', 'Blacked-out entry gear.', { type: 'pass', tier: 35, track: 'premium' }, [[30, 32, 38], [44, 46, 54], [20, 22, 26], [58, 60, 70]], [26, 28, 34], 0x1c1e24, 0x101012);
outfit('of_sol_std', 'op_sol', 'Overwatch Ghillie', 'epic', 'Desert tan with burlap wraps. Comes with Sol.', { type: 'operator', operator: 'op_sol' }, [[150, 132, 100], [176, 158, 120], [118, 100, 74], [196, 180, 146]], [120, 104, 78], 0x8a7656, 0x3c3226);
outfit('of_sol_snow', 'op_sol', 'Whiteout', 'rare', 'Arctic overwhites for the northern lines.', { type: 'shop' }, [[210, 214, 218], [182, 188, 194], [150, 156, 164], [236, 238, 240]], [190, 196, 202], 0xd8dce0, 0x5a5e62);
outfit('of_sol_reed', 'op_sol', 'Reedline', 'rare', 'Marsh greens and straw.', { type: 'pass', tier: 12, track: 'premium' }, [[96, 104, 64], [128, 132, 82], [70, 74, 46], [168, 160, 104]], [84, 90, 56], 0x6a6e44, 0x2e301e);
outfit('of_kestrel_std', 'op_kestrel', 'Recon Mesh', 'epic', 'Light mesh rig in dusk blue. Comes with Kestrel.', { type: 'operator', operator: 'op_kestrel' }, [[54, 64, 82], [76, 88, 108], [36, 44, 58], [98, 110, 128]], [40, 48, 62], 0x2c3444, 0x18181c);
outfit('of_kestrel_tiger', 'op_kestrel', 'Tigerstripe', 'epic', 'Classic jungle tigerstripe.', { type: 'shop' }, [[88, 98, 56], [40, 44, 30], [128, 118, 72], [24, 26, 20]], [60, 66, 40], 0x4a5232, 0x1c1c16, { stripes: true });
outfit('of_kestrel_signal', 'op_kestrel', 'Signal Red', 'legendary', 'Crimson accents for those who want to be seen leaving.', { type: 'shop' }, [[60, 30, 30], [96, 40, 36], [36, 20, 20], [130, 56, 48]], [120, 30, 26], 0x3a1c1c, 0x1a0e0e, { glow: 0xff3020 });

// ---------------- weapon finishes. kind drives the procedural texture generator.
const finish = (id, name, rarity, desc, unlock, f) => add({ id, type: 'finish', name, rarity, desc, unlock, finish: f });
finish('fn_factory', 'Factory', 'common', 'Standard polymer and phosphate.', { type: 'default' }, { kind: 'factory' });
finish('fn_graphite', 'Graphite', 'common', 'Flat graphite cerakote.', { type: 'level', level: 3 }, { kind: 'solid', base: [58, 60, 64] });
finish('fn_sand', 'Sand', 'common', 'Flat dark earth.', { type: 'level', level: 5 }, { kind: 'solid', base: [160, 138, 104] });
finish('fn_olive', 'Olive Drab', 'common', 'Service olive.', { type: 'level', level: 8 }, { kind: 'solid', base: [92, 98, 64] });
finish('fn_arctic', 'Arctic', 'common', 'Matte white.', { type: 'level', level: 15 }, { kind: 'solid', base: [206, 210, 212] });
finish('fn_slate', 'Slate', 'common', 'Blue-grey slate.', { type: 'level', level: 25 }, { kind: 'solid', base: [84, 96, 110] });
finish('fn_rust', 'Rust', 'common', 'Weathered oxide.', { type: 'pass', tier: 3, track: 'free' }, { kind: 'camo', colors: [[120, 66, 40], [150, 86, 50], [90, 50, 32], [70, 44, 30]], scale: 3 });
finish('fn_woodland', 'Woodland', 'rare', 'Four-color woodland. Reach KV-7 level 8.', { type: 'weapon', weapon: 'ar_kv7', level: 8 }, { kind: 'camo', colors: [[72, 84, 52], [44, 52, 34], [110, 92, 62], [30, 30, 26]], scale: 2.4 });
finish('fn_tiger', 'Desert Tiger', 'rare', 'Tigerstripe in sand. Reach Vesper-9 level 8.', { type: 'weapon', weapon: 'smg_vesper', level: 8 }, { kind: 'stripes', colors: [[176, 150, 108], [110, 88, 60], [70, 56, 40]] });
finish('fn_digital', 'Urban Digital', 'rare', 'Pixel urban camo.', { type: 'pass', tier: 6, track: 'free' }, { kind: 'digital', colors: [[150, 152, 156], [100, 104, 110], [60, 62, 68], [190, 192, 196]] });
finish('fn_splinter', 'Splinter', 'rare', 'Angular splinter pattern. Reach Brakk-12 level 6.', { type: 'weapon', weapon: 'sg_brakk', level: 6 }, { kind: 'splinter', colors: [[140, 132, 104], [92, 102, 70], [70, 60, 44]] });
finish('fn_hex', 'Hex Grid', 'rare', 'Hexagonal tactical grid.', { type: 'pass', tier: 9, track: 'premium' }, { kind: 'hex', base: [40, 44, 50], line: [90, 100, 110] });
finish('fn_cobalt', 'Cobalt', 'rare', 'Anodized deep blue.', { type: 'shop' }, { kind: 'metallic', base: [36, 66, 140], metal: 0.6 });
finish('fn_brick', 'Brick Red', 'rare', 'Oxblood red. Reach HX-9 level 6.', { type: 'weapon', weapon: 'pistol_warden', level: 6 }, { kind: 'solid', base: [120, 40, 36] });
finish('fn_nightops', 'Night Ops', 'rare', 'Black on charcoal. Reach LR-338 level 6.', { type: 'weapon', weapon: 'sr_longreach', level: 6 }, { kind: 'camo', colors: [[30, 30, 32], [52, 52, 56], [20, 20, 22], [64, 66, 70]], scale: 2.6 });
finish('fn_carbon', 'Carbon Weave', 'epic', 'Woven carbon fiber.', { type: 'pass', tier: 15, track: 'premium' }, { kind: 'carbon' });
finish('fn_copper', 'Copper Patina', 'epic', 'Polished copper going green at the edges.', { type: 'shop' }, { kind: 'patina' });
finish('fn_ember', 'Molten Ember', 'epic', 'Cooling lava cracks that glow.', { type: 'pass', tier: 30, track: 'premium' }, { kind: 'ember' });
finish('fn_circuit', 'Circuit', 'epic', 'Traced copper circuitry with live pulses.', { type: 'shop' }, { kind: 'circuit' });
finish('fn_damascus', 'Damascus', 'epic', 'Folded-steel ripples.', { type: 'pass', tier: 40, track: 'premium' }, { kind: 'damascus' });
finish('fn_marble', 'Marble', 'epic', 'White marble with grey veins.', { type: 'pass', tier: 20, track: 'free' }, { kind: 'marble' });
finish('fn_gold', 'Gold Leaf', 'legendary', 'Gold leaf over black. Reach level 40.', { type: 'level', level: 40 }, { kind: 'gold' });
finish('fn_obsidian', 'Obsidian Fire', 'legendary', 'Volcanic glass with a burning edge.', { type: 'pass', tier: 45, track: 'premium' }, { kind: 'obsidian' });
finish('fn_aurora', 'Aurora', 'legendary', 'Shifting northern lights.', { type: 'shop' }, { kind: 'aurora' });
finish('fn_prism', 'Prismatic', 'legendary', 'Iridescent oil-slick sheen.', { type: 'shop' }, { kind: 'prism' });

// ---------------- charms
const charm = (id, name, rarity, desc, unlock, shape, color) => add({ id, type: 'charm', name, rarity, desc, unlock, charm: { shape, color } });
charm('ch_none', 'No Charm', 'common', 'Nothing hanging off your weapon.', { type: 'default' }, 'none', 0);
charm('ch_dogtag', 'Dog Tag', 'common', 'Stamped steel tag on a bead chain.', { type: 'level', level: 6 }, 'tag', 0xb8bcc0);
charm('ch_die', 'Lucky Die', 'rare', 'Always rolls a six. Allegedly.', { type: 'pass', tier: 11, track: 'free' }, 'die', 0xe8e4da);
charm('ch_frag', 'Mini Frag', 'rare', 'Inert. Very inert.', { type: 'pass', tier: 18, track: 'premium' }, 'frag', 0x4a5a3c);
charm('ch_star', 'Brass Star', 'rare', 'Five points of polished brass.', { type: 'shop' }, 'star', 0xd2a548);
charm('ch_spike', 'Rail Spike', 'epic', 'Pulled from Line 2 at Cinder Yard.', { type: 'pass', tier: 28, track: 'premium' }, 'spike', 0x6a4a36);
charm('ch_duck', 'Rubber Duck', 'epic', 'Morale equipment.', { type: 'shop' }, 'duck', 0xffd23a);
charm('ch_cog', 'Gear Cog', 'rare', 'A cog from the turntable gearbox.', { type: 'pass', tier: 33, track: 'free' }, 'cog', 0x8a8e92);
// ---- collaboration: Waspinator (licensed collab per the project owner; original procedural art)
add({ id: 'ch_waspinator', type: 'charm', name: 'Waspinator Keychain', rarity: 'legendary', collab: 'waspinator', desc: 'Collab keychain: a tiny robot wasp with buzzing wings and a glowing visor. Cosmetic only.', unlock: { type: 'shop', collab: 'waspinator' }, charm: { shape: 'waspinator', color: 0x3fa63a } });
charm('ch_compass', 'Field Compass', 'legendary', 'Points toward the nearest objective. Probably.', { type: 'pass', tier: 48, track: 'premium' }, 'compass', 0xc89a40);

// ---------------- calling cards (2D art params)
const card = (id, name, rarity, desc, unlock, art) => add({ id, type: 'card', name, rarity, desc, unlock, art });
card('cd_recruit', 'Recruit', 'common', 'Everyone starts somewhere.', { type: 'default' }, { kind: 'stripes', a: '#2a3440', b: '#3d4a58', fg: '#e8e6e1' });
card('cd_cinder', 'Cinder Dawn', 'common', 'Sunrise over the rail yard.', { type: 'level', level: 2 }, { kind: 'sunrise', a: '#2b1d2e', b: '#ff8a3d', fg: '#fff1e0' });
card('cd_railbaron', 'Rail Baron', 'rare', 'Twin lines to the horizon.', { type: 'pass', tier: 2, track: 'free' }, { kind: 'rails', a: '#1c2228', b: '#c9a227', fg: '#e8e6e1' });
card('cd_nightshift', 'Night Shift', 'rare', 'Floodlights and long hours.', { type: 'level', level: 12 }, { kind: 'lights', a: '#0b1020', b: '#3a5a9a', fg: '#dfe8ff' });
card('cd_overwatch', 'Overwatch', 'epic', 'A scope reticle over the yard.', { type: 'pass', tier: 22, track: 'premium' }, { kind: 'reticle', a: '#0e1a14', b: '#4adf8a', fg: '#d8ffe8' });
card('cd_ironclad', 'Ironclad', 'rare', 'Riveted steel plate.', { type: 'pass', tier: 14, track: 'free' }, { kind: 'plate', a: '#3a3f44', b: '#6a7076', fg: '#f0f0f0' });
card('cd_firstblood', 'First Blood', 'rare', 'Earned in the opening seconds.', { type: 'pass', tier: 8, track: 'premium' }, { kind: 'slash', a: '#1a0c0c', b: '#c8302a', fg: '#ffe8e4' });
card('cd_longhaul', 'Long Haul', 'common', 'Kilometres of track behind you.', { type: 'pass', tier: 16, track: 'free' }, { kind: 'rails', a: '#2a2420', b: '#8a6a48', fg: '#f4ece2' });
card('cd_ashfall', 'Ashfall', 'legendary', 'Season 1. The yard burns quietly.', { type: 'pass', tier: 50, track: 'free' }, { kind: 'embers', a: '#120c0a', b: '#ff6a20', fg: '#ffe2c8' });
card('cd_signal', 'Signal Lost', 'epic', 'Static on every channel.', { type: 'shop' }, { kind: 'static', a: '#101418', b: '#7ad0ff', fg: '#e8f6ff' });
card('cd_tactician', 'Tactician', 'epic', 'Plans drawn in chalk.', { type: 'pass', tier: 38, track: 'premium' }, { kind: 'grid', a: '#16221c', b: '#d8e0d0', fg: '#f0f4ec' });
card('cd_veteran', 'Veteran', 'legendary', 'Reach level 50.', { type: 'level', level: 50 }, { kind: 'chevrons', a: '#141414', b: '#ffb84d', fg: '#fff4e0' });

// ---------------- emblems (2D icon params)
const emblem = (id, name, rarity, desc, unlock, shape, color) => add({ id, type: 'emblem', name, rarity, desc, unlock, emblem: { shape, color } });
emblem('em_chevron', 'Chevron', 'common', 'Single rank chevron.', { type: 'default' }, 'chevron', '#e8e6e1');
emblem('em_star', 'Field Star', 'common', 'Five-point star.', { type: 'level', level: 4 }, 'star', '#ffd060');
emblem('em_shield', 'Shield', 'rare', 'Directorate shield.', { type: 'level', level: 18 }, 'shield', '#3d9bff');
emblem('em_crosshair', 'Crosshair', 'common', 'On target.', { type: 'pass', tier: 4, track: 'free' }, 'crosshair', '#ff5a4f');
emblem('em_flame', 'Flame', 'rare', 'Keep the fire lit.', { type: 'pass', tier: 13, track: 'premium' }, 'flame', '#ff8a3d');
emblem('em_hex', 'Hex Nut', 'common', 'Tightened to spec.', { type: 'pass', tier: 10, track: 'free' }, 'hex', '#a3acb2');
emblem('em_bolt', 'Lightning', 'rare', 'Fast hands.', { type: 'pass', tier: 24, track: 'premium' }, 'bolt', '#ffe14d');
emblem('em_wing', 'Wings', 'epic', 'Recon wings.', { type: 'pass', tier: 31, track: 'premium' }, 'wings', '#d8e0ea');
emblem('em_rails', 'Crossed Rails', 'rare', 'Cinder Yard veteran.', { type: 'pass', tier: 19, track: 'free' }, 'rails', '#c9a227');
emblem('em_skullcap', 'Iron Helm', 'epic', 'A helm forged from scrap.', { type: 'shop' }, 'helm', '#8a939b');
emblem('em_crown', 'Crown', 'legendary', 'Top of the scoreboard.', { type: 'pass', tier: 42, track: 'premium' }, 'crown', '#ffb84d');
emblem('em_eye', 'Watcher', 'epic', 'Always watching the long lane.', { type: 'shop' }, 'eye', '#4adf8a');

// ---------------- banners
const banner = (id, name, rarity, desc, unlock, art) => add({ id, type: 'banner', name, rarity, desc, unlock, art });
banner('bn_steel', 'Steel', 'common', 'Brushed steel.', { type: 'default' }, { kind: 'brushed', a: '#2c3238', b: '#4a525a' });
banner('bn_hazard', 'Hazard', 'rare', 'Mind the gap.', { type: 'level', level: 20 }, { kind: 'hazard', a: '#1a1a1a', b: '#d2a52a' });
banner('bn_dusk', 'Dusk', 'rare', 'Last light over the depot.', { type: 'pass', tier: 27, track: 'free' }, { kind: 'gradient', a: '#1b2140', b: '#e0743a' });
banner('bn_camo', 'Field', 'common', 'Woodland pattern.', { type: 'pass', tier: 36, track: 'free' }, { kind: 'camo', a: '#2c3424', b: '#5a6640' });
banner('bn_ember', 'Ember', 'epic', 'Glowing coals.', { type: 'pass', tier: 44, track: 'premium' }, { kind: 'embers', a: '#120a08', b: '#ff5a1a' });
add({ id: 'bn_waspinator', type: 'banner', name: 'Waspinator', rarity: 'epic', collab: 'waspinator', desc: 'Collab banner: green armour, wasp stripes and translucent wings on a sunset haze.', unlock: { type: 'shop', collab: 'waspinator' }, art: { kind: 'waspinator', a: '#3a1830', b: '#e0743a' } });
banner('bn_royal', 'Royal', 'legendary', 'Deep violet and gold.', { type: 'shop' }, { kind: 'gradient', a: '#1e0f30', b: '#c49a3a' });

export const COSMETICS = Object.fromEntries(items.map((i) => [i.id, i]));
export const COSMETIC_LIST = items;
export const DEFAULT_ITEMS = items.filter((i) => i.unlock.type === 'default').map((i) => i.id);
export const byType = (t) => items.filter((i) => i.type === t);
