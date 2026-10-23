/**
 * Limited-time events (stable ids). Gifts are free: claimed once per profile,
 * never sold, and only ever affect XP — never weapons, damage or matchmaking.
 */
export const XP_EVENT = {
  id: 'supercharged_060',
  name: 'Supercharged XP',
  mult: 2,
  seconds: 3600, // one hour of match time
  blurb: 'Double player, weapon and battle-pass XP for one hour of play. The hour counts down only while you are in a match.',
};

/**
 * Hollow Night (Halloween 2026). Runs between `start` and `end` on the
 * device's own clock (local dates). While it runs:
 *  - matches can use the Hollow Night atmosphere (night sky, jack-o'-lanterns);
 *  - finished matches earn Candy (event points, never sold) that unlocks the
 *    free event track automatically;
 *  - event challenges pay extra Candy;
 *  - the Store has a Hollow Night section (test credits).
 * Everything here is cosmetic. Items you earn or buy stay yours after it ends.
 */
export const HOLLOW_NIGHT = {
  id: 'hollow_night',
  name: 'Hollow Night',
  start: [2026, 9, 16], // 16 Oct 2026 (month is 0-based)
  end: [2026, 10, 7], // until the end of 6 Nov 2026
  blurb: 'Halloween has reached the Ashline. Matches play out under a violet night sky with jack-o\'-lanterns, every match earns Candy, and the free event track pays out spooky cosmetics.',
  candy: { match: 10, win: 10, kill: 2, headshot: 1, top3: 8 },
  track: [
    { candy: 20, item: 'em_pumpkin' },
    { candy: 45, item: 'ch_pumpkin' },
    { candy: 75, item: 'cd_hollow' },
    { candy: 110, item: 'fn_ectoplasm' },
    { candy: 150, item: 'bn_hollow' },
    { candy: 200, item: 'em_skull' },
    { candy: 260, item: 'of_voss_grave' },
    { candy: 330, item: 'fn_pumpkin' },
  ],
  challenges: [
    { id: 'hn_play', text: 'Play 3 matches during Hollow Night', stat: 'matches', goal: 3, candy: 25 },
    { id: 'hn_kills', text: 'Get 25 eliminations', stat: 'kills', goal: 25, candy: 30 },
    { id: 'hn_heads', text: 'Land 8 headshot eliminations', stat: 'headshots', goal: 8, candy: 20 },
    { id: 'hn_melee', text: 'Get 2 melee eliminations', stat: 'meleeKills', goal: 2, candy: 20 },
    { id: 'hn_top3', text: 'Finish top 3 in Battle Royale', stat: 'brTop3', goal: 1, candy: 30 },
  ],
};

const localDate = ([y, m, d]) => new Date(y, m, d).getTime();
/** Is the event running at `now` (device clock)? */
export function eventActive(ev = HOLLOW_NIGHT, now = Date.now()) { return now >= localDate(ev.start) && now < localDate(ev.end); }
/** Milliseconds until the event ends (0 when over). */
export function eventTimeLeft(ev = HOLLOW_NIGHT, now = Date.now()) { return Math.max(0, localDate(ev.end) - now); }
/** Track position: tiers reached for a Candy total. */
export function trackReached(candy, ev = HOLLOW_NIGHT) { return ev.track.filter((t) => candy >= t.candy); }
