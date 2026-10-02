/**
 * Halloween: a limited-time event (1 October – 2 November). While it runs,
 * matches drop Candy Corn, a temporary currency that buys the Halloween items
 * in the lobby's Fright Shop. Candy disappears when the event ends; anything
 * bought is kept for good. Saved on this device.
 */

import { save } from './save.js';

export const CANDY_PER_KILL = 5;
export const CANDY_PER_PUMPKIN = 10;

/** The Fright Shop. kind/id match the Locker (outfit ids are 'slimer'). */
export const FRIGHT_SHOP = [
  { kind: 'outfit', id: 'slimer', name: 'Blood Slimer', desc: 'A tall slimy shadow with a creepy grin (any kid)', price: 1500, color: '#c8102e' },
  { kind: 'pickaxe', id: 'bloodsmasher', name: 'Blood Smasher', desc: 'A dripping hammer with a goofy face', price: 700, color: '#c8102e' },
  { kind: 'backbling', id: 'bloodshield', name: 'Blood Shield', desc: 'A dark shield with a slime splat', price: 600, color: '#c8102e' },
  { kind: 'wrap', id: 'blood', name: 'Blood Wrap', desc: 'Red slime blobs on black', price: 500, color: '#c8102e' },
  { kind: 'backbling', id: 'jackolantern', name: "Jack-o'-Lantern", desc: 'A grinning pumpkin that glows', price: 400, color: '#ff8a1a' },
  { kind: 'glider', id: 'bats', name: 'Bat Swarm', desc: 'Orange bats on a midnight sail', price: 400, color: '#ff8a1a' },
  // skin drop
  { kind: 'outfit', id: 'wolf', name: 'Howl Punk', desc: 'A punk werewolf: muzzle cage, glowing red stripes, studs and a bushy tail (any kid)', price: 1200, color: '#ff2a2a', drop: true },
  { kind: 'outfit', id: 'pig', name: 'Hog Wild', desc: 'A grumpy pig butcher with a ketchup-splattered apron and a sausage chain (any kid)', price: 1200, color: '#f0a3ad', drop: true },
];
export const SKIN_DROP = FRIGHT_SHOP.filter((it) => it.drop);

/** The event window for a given time (local dates): 1 Oct .. 2 Nov inclusive. */
export function eventWindow(now = Date.now()) {
  const y = new Date(now).getFullYear();
  return { year: y, start: new Date(y, 9, 1).getTime(), end: new Date(y, 10, 3).getTime() };
}

function state(now = Date.now()) {
  const d = save.data;
  if (!d.halloween || typeof d.halloween !== 'object') d.halloween = { year: 0, candy: 0, owned: [], force: null };
  const h = d.halloween;
  if (!Array.isArray(h.owned)) h.owned = [];
  // the currency is temporary: it's gone once the event is over (or from last year)
  const w = eventWindow(now);
  if (h.year !== w.year || (!inWindow(now) && h.force !== 'on')) {
    if (h.candy) h.candy = 0;
    h.year = w.year;
  }
  return h;
}

const inWindow = (now) => {
  const w = eventWindow(now);
  return now >= w.start && now < w.end;
};

/** Is Halloween on? (the owner can force it on or off; test browsers default to off) */
export function halloweenOn(now = Date.now()) {
  const f = save.data.halloween?.force;
  if (f === 'on') return true;
  if (f === 'off') return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  return inWindow(now);
}

/** Whole days left in the event (0 on the last day). */
export function daysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((eventWindow(now).end - now) / 86400000) - 1);
}

export const candy = () => (halloweenOn() ? state().candy : 0);

export function addCandy(n) {
  if (!halloweenOn() || !(n > 0)) return 0;
  const h = state();
  h.candy += Math.round(n);
  save.write();
  return Math.round(n);
}

export const ownsHalloween = (kind, id) => state().owned.includes(`${kind}:${id}`);
export const halloweenOwned = () => state().owned.slice();

/** Buys a Fright Shop item. Returns { ok, text }. */
export function buyHalloween(kind, id) {
  const it = FRIGHT_SHOP.find((x) => x.kind === kind && x.id === id);
  if (!it) return { ok: false, text: 'Not in the shop' };
  if (!halloweenOn()) return { ok: false, text: 'The Fright Shop is closed until next Halloween' };
  const h = state();
  if (h.owned.includes(`${kind}:${id}`)) return { ok: false, text: `You already own ${it.name}` };
  if (h.candy < it.price) return { ok: false, text: `Not enough Candy Corn (${it.price.toLocaleString()} needed)` };
  h.candy -= it.price;
  h.owned.push(`${kind}:${id}`);
  save.write();
  return { ok: true, text: `${it.name} is yours! Find it in the Locker.` };
}

/** Admin: force the event on/off (null = follow the calendar), add candy, own everything. */
export function setHalloweenForce(v) {
  state().force = v === 'on' || v === 'off' ? v : null;
  save.write();
}
export function adminCandy(n) {
  const h = state();
  h.candy = Math.max(0, h.candy + n);
  save.write();
}
export function ownAllHalloween() {
  const h = state();
  for (const it of FRIGHT_SHOP) if (!h.owned.includes(`${it.kind}:${it.id}`)) h.owned.push(`${it.kind}:${it.id}`);
  save.write();
}

/** Candy earned from one match: pickups and pumpkins (ms.candy), eliminations, and how you placed. */
export function matchCandy(ms, r) {
  return Math.max(0, (ms?.candy || 0) + r.kills * CANDY_PER_KILL + (r.won ? 25 : r.place <= 10 ? 10 : 0));
}
