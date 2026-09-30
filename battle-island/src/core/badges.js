/**
 * Benton Badges: twelve family keepsakes hidden around the island. Finding
 * one is saved on this device for good; the collection book in the lobby
 * shows which are found (with a hint for the rest), and 6 and 12 badges
 * unlock gliders. Each new badge is worth XP after the match.
 */

import { save } from './save.js';

export const BADGE_XP = 500;

/** `at`: where the world places it (see gameplay/badges.js). */
export const BADGES = [
  { id: 'baseball', name: "Colton's Baseball", color: '#ffffff', mark: '⚾', at: { roof: 'clubhouse' }, hint: 'Up on the roof of the Benton Kids Clubhouse' },
  { id: 'sketchbook', name: "Emerson's Sketchbook", color: '#ff7ac8', mark: '✎', at: { roof: 'park' }, hint: 'The highest spot in Pickles Park' },
  { id: 'dino', name: "Waylon's Toy Dino", color: '#7ed957', mark: '🦖', at: { roof: 'hollow' }, hint: 'Above the spooky roofs of Haunt Hollow' },
  { id: 'mug', name: "Mom's Coffee Mug", color: '#ff8a5c', mark: '☕', at: { roof: 'depot' }, hint: 'On top of Boom Co. Depot' },
  { id: 'wrench', name: "Dad's Wrench", color: '#a9bccc', mark: '🔧', at: { roof: 'garage' }, hint: 'High over Benton Diesel Garage' },
  { id: 'cookies', name: "Grandma's Cookie Tin", color: '#3f9bff', mark: '🍪', at: { roof: 'Farm House' }, hint: 'The Farm House roof' },
  { id: 'lure', name: "Grandpa's Fishing Lure", color: '#ffd23f', mark: '🎣', at: { roof: 'Fishing Shack' }, hint: 'Atop the Fishing Shack' },
  { id: 'photo', name: 'The Family Photo', color: '#b35cff', mark: '📷', at: { roof: 'Lookout Cabin' }, hint: 'The Lookout Cabin roof' },
  { id: 'penny', name: 'Lucky Penny', color: '#e0a76a', mark: '¢', at: { roof: 'Snack Shack' }, hint: 'On top of the Snack Shack' },
  { id: 'key', name: 'Treehouse Key', color: '#39f0ff', mark: '🔑', at: { zipline: true }, hint: 'Floating above the highest zipline tower' },
  { id: 'bone', name: 'Squeaky Dog Bone', color: '#f4efe6', mark: '🦴', at: { peak: true }, hint: 'The very top of the island' },
  { id: 'bottle', name: 'Message in a Bottle', color: '#5ac8ff', mark: '✉', at: { beach: true }, hint: 'The farthest beach from the Clubhouse' },
];

/** Gliders unlocked by badge count (listed in core/season.js GLIDERS). */
export const BADGE_REWARDS = [
  { n: 6, glider: 'treasure' },
  { n: 12, glider: 'medal' },
];

function state() {
  const d = save.data;
  if (!d.badges || typeof d.badges !== 'object' || !d.badges.found) d.badges = { found: {} };
  return d.badges;
}

export const hasBadge = (id) => !!state().found[id];
export const badgeCount = () => BADGES.filter((b) => state().found[b.id]).length;

/** Records a find. Returns the rewards it unlocked (or null if it was already found). */
export function findBadge(id) {
  const s = state();
  if (s.found[id] || !BADGES.some((b) => b.id === id)) return null;
  const before = badgeCount();
  s.found[id] = Date.now();
  save.write();
  const after = badgeCount();
  return BADGE_REWARDS.filter((r) => before < r.n && after >= r.n);
}

/** Admin/testing: find every badge, or forget them all. */
export function setAllBadges(on) {
  const s = state();
  s.found = on ? Object.fromEntries(BADGES.map((b) => [b.id, Date.now()])) : {};
  save.write();
}
