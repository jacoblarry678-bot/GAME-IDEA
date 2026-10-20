/** The four established crew characters. Selection changes appearance and incidental dialogue, not statistics. */
export const CHARACTERS = {
  evan: { name: 'Evan Ward', short: 'Evan', age: 34, role: 'Maintenance lead', desc: 'Practical and carrying unresolved guilt.', color: 0x4a6b8a, accent: 0xd8b04a, slot: 1 },
  mara: { name: 'Mara Chen', short: 'Mara', age: 31, role: 'Electrical technician', desc: 'Observant and blunt.', color: 0x6b4a4a, accent: 0x9ac0d8, slot: 2 },
  luis: { name: 'Luis Vega', short: 'Luis', age: 29, role: 'Building surveyor', desc: 'Nervous humor that fades under pressure.', color: 0x4a6b52, accent: 0xe0a060, slot: 3 },
  jo: { name: 'Jo Mercer', short: 'Jo', age: 26, role: 'Safety inspector', desc: 'Patient and methodical.', color: 0x5a5a72, accent: 0xf0e070, slot: 4 },
};
export const SLOT_ORDER = ['evan', 'mara', 'luis', 'jo'];

export const CALLOUTS = [
  { id: 'follow', text: 'Follow me.' },
  { id: 'wait', text: 'Wait here.' },
  { id: 'help', text: 'Need help.' },
  { id: 'clue', text: 'Found a clue.' },
  { id: 'creature', text: 'Creature nearby.' },
  { id: 'refuge', text: 'Refuge here.' },
];
