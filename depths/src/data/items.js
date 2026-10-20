/** Supplies (pouch items) and their exact effects and stack limits. */
export const ITEMS = {
  bandage: { name: 'Bandage', stack: 3, use: 3.0, health: 25, desc: 'Restore 25 health over a 3 second action.' },
  firstaid: { name: 'First aid kit', stack: 1, use: 5.0, health: 65, desc: 'Restore 65 health over a 5 second action.' },
  tea: { name: 'Calming tea', stack: 2, use: 2.0, composure: 30, desc: 'Restore 30 composure over a 2 second action.' },
  battery: { name: 'Battery cell', stack: 3, use: 2.0, charge: 50, desc: 'Add 50 flashlight charge over a 2 second replacement.' },
  film: { name: 'Film pack', stack: 2, use: 2.5, film: 4, desc: 'Add up to 4 camera exposures over a 2.5 second reload. Unused exposures stay in the pack.' },
  decoy: { name: 'Windup decoy', stack: 2, use: 0.6, decoy: { r: 25, dur: 12 }, desc: 'Throw it. Produces a 12 second sound at its landing point; 25 meter radius.' },
  chalk: { name: 'Chalk stick', stack: 1, use: 1.0, marks: 10, desc: 'Place 10 directional marks; one second per mark.' },
  wedge: { name: 'Door wedge', stack: 2, use: 1.0, hold: 8, desc: 'Keep one ordinary hinged door closed for 8 seconds against pursuit.' },
};

export const HEAL_ITEMS = ['bandage', 'firstaid'];
export const POUCH_SLOTS = 4;

/** Permanent tools; they never occupy pouch slots. */
export const TOOLS = ['flashlight', 'camera', 'radio', 'supply'];
export const TOOL_NAMES = { flashlight: 'Flashlight', camera: 'Instant camera', radio: 'Radio', supply: 'Supply' };

export const EQUIP = {
  flashlightMax: 100,
  flashlightDrainEvery: 9, // seconds per point
  flickerBelow: 10,
  filmMax: 8,
  flashCharge: 2.0,
  develop: 4.0,
  photoCone: 65, // degrees horizontal
  photoRange: 20,
  flashSound: 40,
  stationHold: 12,
  stationNoise: 8,
};
