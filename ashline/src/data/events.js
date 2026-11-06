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
  icon: '🎃', currency: 'Candy', currencyIcon: '🍬', atmosphere: 'halloween',
  start: [2026, 9, 16], // 16 Oct 2026 (month is 0-based)
  end: [2026, 10, 6], // ended: last day 5 Nov 2026 (0.10.0)
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

/**
 * Frostfall (Christmas 2026): winter atmosphere (snowfall, snowy ground,
 * Christmas trees and gifts), Snowflakes from every match, a free 8-reward
 * track, event challenges and a Frostfall Store section. (Track thresholds
 * and saved progress use the generic field name `candy` = event points.)
 */
export const FROSTFALL = {
  id: 'frostfall',
  name: 'Frostfall',
  icon: '🎄', currency: 'Snowflakes', currencyIcon: '❄', atmosphere: 'winter',
  start: [2026, 10, 6], // 6 Nov 2026
  end: [2027, 0, 7], // until the end of 6 Jan 2027
  blurb: 'Winter has come to the Ashline. Snow falls on every map, the depots are strung with lights and Christmas trees, every match earns Snowflakes, and the free event track hands out festive cosmetics.',
  candy: { match: 10, win: 10, kill: 2, headshot: 1, top3: 8, confirm: 1 },
  track: [
    { candy: 20, item: 'em_snowflake' },
    { candy: 45, item: 'ch_ornament' },
    { candy: 75, item: 'cd_silentnight' },
    { candy: 110, item: 'fn_candycane' },
    { candy: 150, item: 'ex_snowball' },
    { candy: 200, item: 'bn_northern' },
    { candy: 260, item: 'of_sol_winter' },
    { candy: 330, item: 'fn_frostbite' },
  ],
  challenges: [
    { id: 'ff_play', text: 'Play 3 matches during Frostfall', stat: 'matches', goal: 3, candy: 25 },
    { id: 'ff_kills', text: 'Get 30 eliminations', stat: 'kills', goal: 30, candy: 30 },
    { id: 'ff_conf', text: 'Confirm 10 tags in Confirmed', stat: 'confirms', goal: 10, candy: 30 },
    { id: 'ff_frost', text: 'Win a match on Frosthollow', stat: 'frostWins', goal: 1, candy: 25 },
    { id: 'ff_top3', text: 'Finish top 3 in Battle Royale', stat: 'brTop3', goal: 1, candy: 30 },
  ],
};

/** Harvest Feast (Thanksgiving 2026): a Store-only event, no track. */
export const HARVEST = {
  id: 'harvest',
  name: 'Harvest Feast',
  icon: '🦃', currency: null, currencyIcon: '', atmosphere: null,
  start: [2026, 10, 6], // 6 Nov 2026
  end: [2026, 11, 1], // until the end of 30 Nov 2026
  blurb: 'Thanksgiving cosmetics in warm autumn colours, for test credits.',
  candy: null, track: [], challenges: [],
};

export const EVENTS = { hollow_night: HOLLOW_NIGHT, frostfall: FROSTFALL, harvest: HARVEST };

const localDate = ([y, m, d]) => new Date(y, m, d).getTime();
/** Is the event running at `now` (device clock)? Accepts an event or its id. */
export function eventActive(ev = HOLLOW_NIGHT, now = Date.now()) { ev = typeof ev === 'string' ? EVENTS[ev] : ev; return !!ev && now >= localDate(ev.start) && now < localDate(ev.end); }
/** Milliseconds until the event ends (0 when over). */
export function eventTimeLeft(ev = HOLLOW_NIGHT, now = Date.now()) { ev = typeof ev === 'string' ? EVENTS[ev] : ev; return ev ? Math.max(0, localDate(ev.end) - now) : 0; }
/** Track position: tiers reached for a points total. */
export function trackReached(candy, ev = HOLLOW_NIGHT) { return ev.track.filter((t) => candy >= t.candy); }
/** Events running now. */
export const activeEvents = (now = Date.now()) => Object.values(EVENTS).filter((e) => eventActive(e, now));
/** The running event with a track (the one matches earn points for), if any. */
export const trackEvent = (now = Date.now()) => activeEvents(now).find((e) => e.track.length) || null;
