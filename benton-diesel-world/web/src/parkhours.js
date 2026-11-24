// The park day. Cast members come in at 7:00 to get everything ready (shops
// open their shutters, the chains come off the ride entrances, the rides
// run empty test trains); early entry opens a handful of the big rides at
// 8:00; everything opens at 9:00. The park closes at 10:00 PM: the lines
// close (guests already in them still ride), guests head for the gate,
// security walks out anyone still inside at 10:22, and the last of the
// cast leave by 11:00. Times are park minutes after midnight.
import * as Clock from './clock.js';

export const HOURS = { STAFF: 420, EARLY: 480, OPEN: 540, WARN: 1305, CLOSE: 1320, ESCORT: 1342, STAFF_OUT: 1380 };

export function phaseAt(m) {
  if (m >= HOURS.STAFF && m < HOURS.EARLY) return 'setup';
  if (m >= HOURS.EARLY && m < HOURS.OPEN) return 'early';
  if (m >= HOURS.OPEN && m < HOURS.CLOSE) return 'open';
  if (m >= HOURS.CLOSE && m < HOURS.STAFF_OUT) return 'closing';
  return 'night';
}

export const phase = () => phaseAt(Clock.minutes());

// rides that don't run test trains (houses, shows, meet & greets)
export function testable(cfg) {
  return cfg.kind !== 'walkthrough' && !['Live Show', 'Meet & Greet', 'Christmas Trail', 'Easter Walkthrough'].includes(cfg.category);
}

// early entry: the park's most popular rides (the longest posted waits), a
// coaster or two from each corner of the park, ten in all
export function earlyEntryRides(rides) {
  const pool = rides.filter((r) => !r.refurb && !r.shutdown && !r.opensAt && testable(r) && r.kind !== 'tram');
  pool.sort((a, b) => (b.baseWait ?? 0) - (a.baseWait ?? 0) || (b.thrill ?? 0) - (a.thrill ?? 0));
  const out = [], perLand = new Map();
  for (const r of pool) {
    if ((perLand.get(r.land) || 0) >= 2) continue;
    perLand.set(r.land, (perLand.get(r.land) || 0) + 1);
    out.push(r.id);
    if (out.length >= 10) break;
  }
  return out;
}
