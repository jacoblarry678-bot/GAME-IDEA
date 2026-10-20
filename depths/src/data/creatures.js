/**
 * Creature sheets. Every value comes from the design document's entity
 * specifications; difficulty multipliers are applied at runtime.
 */
export const CREATURES = {
  listener: {
    name: 'The Listener', patrol: 1.2, pursue: 3.6, hearing: 1.25, sightRange: 4, sightPursuitOnly: true, fov: 120,
    damage: 30, search: 18, cooldown: 60, warn: 2.0,
    warning: 'One extra footstep, then a tapping inside the wall.',
    hint: 'The Listener hunts noise. Crouch away from where you made a sound, throw a decoy into a side room, or close a door and break its line of sight twice.',
  },
  cutout: {
    name: 'The Cutouts', patrol: 0, pursue: 3.2, observeRange: 12, observeCone: 60, damage: 35, search: 10, cooldown: 30, warn: 3.0,
    warning: 'A shutter warning tone. Paper rubbing against metal.',
    hint: 'Cutouts cannot move while anyone looks straight at them within twelve meters. A camera flash pins every Cutout in the picture for four seconds. Reopening a shutter sends them back to their displays.',
  },
  drowned: {
    name: 'The Drowned Shape', patrol: 1.4, pursue: 3.4, hearing: 1.0, damage: 40, search: 15, cooldown: 40, warn: 3.0,
    warning: 'A wake moving through the water.',
    hint: 'The Drowned Shape cannot leave the water or cross dry grating. Wade crouched, use the overflow levers or a decoy to pull it away, and get to dry ground.',
  },
  tenant: {
    name: 'The Tenant', patrol: 1.2, pursue: 3.5, sightRange: 12, fov: 70, damage: 30, search: 20, cooldown: 45, warn: 3.0,
    gazeTrigger: 6, gazeWarn: 3, gazeWindow: 10, gazeReset: 4,
    warning: 'Curtains moving. Three knocks. A slow handle turn.',
    hint: 'The Tenant comes when you keep looking at its window. Look away for four seconds to reset it. Closing an apartment door holds it for three seconds, and a verified refuge forces it back.',
  },
  caretaker: {
    name: 'The Caretaker', patrol: 1.0, pursue: 3.8, hearing: 1.5, damage: 40, search: 25, cooldown: 45, warn: 2.5,
    habituate: 3, maskRange: 6,
    warning: 'A tool clicking against the pipes.',
    hint: 'The Caretaker is blind and ignores noise that does not change. Move while a machine runs, wait behind cover while it rests, and use the narrow crawlways it cannot enter.',
  },
  unseen: {
    name: 'The Unseen', patrol: 1.6, pursue: 3.7, sightRange: 10, damage: 35, search: 15, cooldown: 40, warn: 3.0,
    warning: 'Three floor dents advancing toward you.',
    hint: 'The Unseen sees movement within ten meters. It ignores a person who stays crouched and still behind solid cover. A photograph shows which way it was facing.',
  },
};

export const SHARED_STATES = ['patrol', 'investigate', 'warn', 'pursue', 'search', 'withdraw'];
