/**
 * Supercharged XP: a bonus pool that refills every day. While it has XP left,
 * the XP you earn in a match is doubled (the extra comes out of the pool).
 * Unused days bank up to 3 days' worth. Stored on this device.
 */

import { save } from './save.js';

export const DAILY_XP = 2500;
export const CAP_XP = DAILY_XP * 3;

/** Local calendar day number (so the refill happens at the player's midnight). */
export const today = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

/** Current pool, refilled for any days that passed since it was last seen. */
export function superXP(now = Date.now()) {
  const d = today(now);
  let s = save.data.superXP;
  if (!s || typeof s.pool !== 'number') s = save.data.superXP = { pool: DAILY_XP, day: d };
  if (d > s.day) {
    s.pool = Math.min(CAP_XP, s.pool + (d - s.day) * DAILY_XP);
    s.day = d;
    save.write();
  }
  return s;
}

/** Spends the pool on a match's XP; returns the bonus to add. */
export function superchargeXP(xp) {
  const s = superXP();
  const bonus = Math.max(0, Math.min(xp, s.pool));
  s.pool -= bonus;
  return bonus;
}

/** Time until the next refill, e.g. "5h 12m". */
export function refillIn(now = Date.now()) {
  const next = (today(now) + 1) * 86400000 + new Date(now).getTimezoneOffset() * 60000;
  const m = Math.max(1, Math.round((next - now) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
