/** The eighteen cosmetic achievements and the six unlockable camera finishes. */
export const ACHIEVEMENTS = [
  { id: 'A01', name: 'Out of Office', cond: 'Complete chapter one' },
  { id: 'A02', name: 'Closed for Good', cond: 'Complete chapter two' },
  { id: 'A03', name: 'Dry Feet', cond: 'Complete chapter three' },
  { id: 'A04', name: 'Someone Home', cond: 'Complete chapter four' },
  { id: 'A05', name: 'Clocking Out', cond: 'Complete chapter five' },
  { id: 'A06', name: 'A Familiar Voice', cond: 'Complete Full Transmission' },
  { id: 'A07', name: 'The Door We Open', cond: 'Complete Maintenance Bypass' },
  { id: 'A08', name: 'Cut the Line', cond: 'Complete Emergency Isolation' },
  { id: 'A09', name: 'Personnel File', cond: 'Collect E1, E2, E3, and E4 in the profile' },
  { id: 'A10', name: 'Second Hand', cond: 'Verify all twelve campaign refuges' },
  { id: 'A11', name: 'All Accounted For', cond: 'Collect all thirty six records' },
  { id: 'A12', name: 'What the Camera Saw', cond: 'Capture all six chapter secret photographs' },
  { id: 'A13', name: 'Good Neighbor', cond: 'Escort June into chapter four R2' },
  { id: 'A14', name: 'Quiet Shift', cond: 'End one Listener pursuit without taking damage during that pursuit' },
  { id: 'A15', name: 'No Film Required', cond: 'Solve a mandatory image clue using its Survey Station' },
  { id: 'A16', name: 'Shared Shift', cond: 'Complete any chapter with at least two active players from entry to exit' },
  { id: 'A17', name: 'Different Route', cond: 'Complete an Expedition run' },
  { id: 'A18', name: 'Every Way Home', cond: 'Complete all three campaign endings' },
];

export const FINISHES = [
  { id: 'default', name: 'Hazelbank Grey', color: 0xd8d2c0, cond: 'Default finish' },
  { id: 'wornYellow', name: 'Worn Yellow', color: 0xd8b84a, cond: 'Complete A Familiar Voice' },
  { id: 'serviceWhite', name: 'Service White', color: 0xf0f0ea, cond: 'Complete The Door We Open' },
  { id: 'bareMetal', name: 'Bare Metal', color: 0xa0a4a8, cond: 'Complete Cut the Line' },
  { id: 'poolBlue', name: 'Pool Blue', color: 0x7ab8d0, cond: 'Earn What the Camera Saw' },
  { id: 'courierRed', name: 'Courier Red', color: 0xb84a3a, cond: 'Earn All Accounted For' },
  { id: 'maintenanceOrange', name: 'Maintenance Orange', color: 0xe08a30, cond: 'Earn Different Route' },
];

export const ENDINGS = {
  familiar: { name: 'A Familiar Voice', ach: 'A06', finish: 'wornYellow' },
  door: { name: 'The Door We Open', ach: 'A07', finish: 'serviceWhite' },
  cut: { name: 'Cut the Line', ach: 'A08', finish: 'bareMetal' },
};
