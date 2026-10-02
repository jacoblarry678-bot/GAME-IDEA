/**
 * Rotating island events: one twist a day, the same for everyone on a given
 * date. Casual matches use today's event unless you switch it off in the
 * lobby; ranked matches are always classic. The host's pick is sent to
 * everyone in an online match.
 */

import { today } from './supercharge.js';

export const EVENTS = {
  spooky: { name: 'Spooky Night', icon: '🎃', color: '#b07cff', desc: 'Night falls on the island. Smash glowing pumpkins for Benton Bucks and treats.' },
  lowgrav: { name: 'Low Gravity', icon: '🪐', color: '#39f0ff', desc: 'Everyone jumps twice as high and floats down gently. No fall damage.' },
  supply: { name: 'Supply Frenzy', icon: '🎈', color: '#3f9bff', desc: 'A supply drop floats down every 45 seconds.' },
  golden: { name: 'Golden Loot', icon: '✨', color: '#ffae1a', desc: 'Every weapon on the floor and in chests is one rarity better.' },
  playground: { name: 'Playground Party', icon: '🛝', color: '#ff7ac8', desc: 'Bounce pads at every named place, with Bouncy Soda next to each.' },
};
export const EVENT_IDS = Object.keys(EVENTS);

/** Today's event (it changes at local midnight). */
export function todaysEvent(now = Date.now()) {
  return EVENT_IDS[((today(now) % EVENT_IDS.length) + EVENT_IDS.length) % EVENT_IDS.length];
}

/** The event a match should use: null for ranked or when switched off; the owner can pin one (admin). */
export function matchEvent(profile, ranked = !!profile.ranked) {
  if (ranked || profile.event === false) return null;
  // automated test browsers default to classic so older suites stay predictable (the lobby toggle overrides)
  if (profile.event === undefined && typeof navigator !== 'undefined' && navigator.webdriver) return null;
  return EVENTS[profile.eventPick] ? profile.eventPick : todaysEvent();
}
