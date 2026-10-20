/**
 * Small seeded RNG (mulberry32). The state is a single 32-bit integer so it
 * can be stored in a save snapshot and resumed exactly.
 */
export class Rng {
  constructor(seed = 1) { this.state = (seed >>> 0) || 1; }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Hash a string to a 32-bit seed. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Human-shareable seed text (six characters, no ambiguous letters). */
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function seedToText(seed) {
  let s = '', v = seed >>> 0;
  for (let i = 0; i < 6; i++) { s += SEED_CHARS[v % SEED_CHARS.length]; v = Math.floor(v / SEED_CHARS.length); }
  return s;
}
export function textToSeed(text) {
  const t = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.length !== 6 || [...t].some((c) => !SEED_CHARS.includes(c))) return null;
  let v = 0;
  for (let i = 5; i >= 0; i--) v = v * SEED_CHARS.length + SEED_CHARS.indexOf(t[i]);
  return v >>> 0;
}
