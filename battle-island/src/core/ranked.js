/**
 * Ranked play: a hidden-but-viewable MMR (matchmaking rating, Elo-style)
 * plus a visible rank earned with rank points (RP).
 *
 * - MMR moves by how you placed against what your rating predicted, and it
 *   sets matchmaking: in Ranked, bot opponents are tuned to the lobby's MMR.
 * - RP fill a division (100 RP each). Placement and eliminations earn RP,
 *   each match has an entry cost that grows with rank, and gains/losses are
 *   scaled by how your MMR compares to your rank (so a rank catches up with
 *   your real skill). You can lose progress but never drop a division.
 * - The first 3 ranked matches are placement matches that set your starting
 *   rank from your MMR (capped at Platinum I).
 * Build and Zero Build are ranked separately. Everything is stored on this
 * device (like the rest of the progression).
 */

import { save } from './save.js';

export const TIERS = [
  { name: 'Bronze', color: '#c98a4b' },
  { name: 'Silver', color: '#c9d3dd' },
  { name: 'Gold', color: '#ffcf3f' },
  { name: 'Platinum', color: '#5fe3d0' },
  { name: 'Diamond', color: '#6fa8ff' },
  { name: 'Champion', color: '#ff5c7a' },
  { name: 'Legend', color: '#b35cff' },
];
export const TOP = 18; // Legend (single division)
export const PLACEMENT_MATCHES = 3;
const START_MMR = 1000;
const ROMAN = ['I', 'II', 'III'];

/** MMR a division is "worth" — used for placement and to scale RP. */
export const divisionMMR = (d) => 600 + d * 60;

export function divisionFromMMR(mmr) {
  return Math.max(0, Math.min(TOP, Math.floor((mmr - 600) / 60)));
}

export function divName(d) {
  if (d < 0) return 'Unranked';
  if (d >= TOP) return 'Legend';
  return `${TIERS[Math.floor(d / 3)].name} ${ROMAN[d % 3]}`;
}

export function divColor(d) {
  if (d < 0) return '#8a82a8';
  return TIERS[Math.min(6, Math.floor(d / 3))].color;
}

export function rankState(mode) {
  const key = mode === 'zerobuild' ? 'zerobuild' : 'build';
  save.data.ranked = save.data.ranked || {};
  if (!save.data.ranked[key]) save.data.ranked[key] = { mmr: START_MMR, d: -1, rp: 0, matches: 0, peak: -1, history: [] };
  return save.data.ranked[key];
}

/** Bot skill range for a lobby rating (casual lobbies use 0.30–0.75). */
export function botSkillRange(rating) {
  const t = Math.max(0, Math.min(1, (rating - 500) / 1300));
  const lo = 0.15 + t * 0.55;
  return [lo, Math.min(0.97, lo + 0.25)];
}

/** Lobby difficulty label shown in ranked matches. */
export function lobbyLabel(rating) {
  return divName(divisionFromMMR(rating));
}

/**
 * Applies one ranked match to the saved state and returns what changed.
 * st: { won, place, total, kills } (placement among teams); lobbyRating: the
 * average MMR the lobby was matched at.
 */
export function applyRanked(mode, st, lobbyRating) {
  const s = rankState(mode);
  const before = { d: s.d, rp: s.rp, mmr: s.mmr };
  const n = Math.max(2, st.total);
  const pct = st.won ? 1 : Math.max(0, (n - st.place) / (n - 1)); // 1 = won, 0 = first out
  const kills = Math.min(10, st.kills | 0);

  // --- MMR (Elo against the lobby rating)
  const expected = 1 / (1 + Math.pow(10, (lobbyRating - s.mmr) / 400));
  const K = s.matches < PLACEMENT_MATCHES ? 80 : s.matches < 15 ? 48 : 32;
  const dMMR = Math.round(K * (pct - expected) + kills * 2 + (st.won ? 6 : 0));
  s.mmr = Math.max(100, Math.min(3000, s.mmr + dMMR));
  s.matches++;

  // --- rank
  let dRP = 0;
  let placed = false;
  if (s.d < 0) {
    if (s.matches >= PLACEMENT_MATCHES) {
      s.d = Math.min(9, divisionFromMMR(s.mmr));
      s.rp = 0;
      placed = true;
    }
  } else {
    const d = s.d;
    const gain = Math.round(Math.pow(pct, 1.5) * 50) + (st.won ? 20 : 0) + kills * 5;
    const cost = Math.round(14 + d * 1.6);
    const raw = gain - cost;
    // rank catches up with skill: boost gains / soften losses when MMR is above the rank
    const diff = s.mmr - divisionMMR(d);
    const up = Math.max(0.5, Math.min(1.8, 1 + diff / 400));
    const down = Math.max(0.5, Math.min(1.8, 1 - diff / 400));
    dRP = Math.round(raw >= 0 ? raw * up : raw * down);
    s.rp += dRP;
    while (s.rp >= 100 && s.d < TOP) {
      s.rp -= 100;
      s.d++;
    }
    if (s.rp < 0) s.rp = 0; // no demotion: progress bottoms out at 0%
  }
  s.peak = Math.max(s.peak, s.d);
  s.history.unshift({ place: st.place, total: n, kills, won: !!st.won, dRP, dMMR, d: s.d, at: Date.now() });
  s.history.length = Math.min(s.history.length, 10);
  save.write();
  return {
    mode, before, after: { d: s.d, rp: s.rp, mmr: s.mmr }, dRP, dMMR, placed,
    placementLeft: s.d < 0 ? PLACEMENT_MATCHES - s.matches : 0,
    promoted: before.d >= 0 && s.d > before.d,
  };
}

/** Small rank badge (hexagon with the division numeral). */
export function badgeHTML(d, size = 40) {
  const c = divColor(d);
  const label = d < 0 ? '?' : d >= TOP ? '★' : ROMAN[d % 3];
  return `<span class="rank-badge" style="--rc:${c};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${label}</span>`;
}
