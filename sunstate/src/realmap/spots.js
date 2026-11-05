/** Fixed spots on the real map (game metres: x east, z south). */
/** Where a new game starts on the real map: Ocean Drive at 10th Street, South Beach (game metres). */
export const REAL_SPAWN = { x: 6330.5, z: -700, rot: Math.PI };
/** Where you wake up on the real map: the hospital on Alton Road, the station on Washington Avenue (sidewalk spots). */
export const REAL_PLACES = {
  hospital: { x: 5524.7, z: -4355, rot: 1.46, name: 'Ocean Mercy' },
  police: { x: 6134.2, z: -714.8, rot: -0.19, name: 'Precinct 3' },
};
/** Your apartment on Ocean Drive (west side, between 9th and 10th): the door and where you wake up. */
export const REAL_SAFEHOUSE = { door: { x: 6286.6, z: -700 }, spawn: { x: 6289.5, z: -700, rot: Math.PI / 2 } };
