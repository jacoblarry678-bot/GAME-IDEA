/**
 * Safe localStorage access. Reads never throw; corrupt or missing data falls
 * back to defaults. Writes report success so callers can show "Could not
 * save" instead of pretending. In Node (tests) an in-memory map is used.
 */
const PREFIX = 'depths.';
const memory = new Map();

function backend() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* blocked */ }
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => { memory.set(k, String(v)); },
    removeItem: (k) => { memory.delete(k); },
  };
}

/** Test hook: make the next N writes fail (simulates a full or blocked disk). */
let failWrites = 0;
export function _failNextWrites(n) { failWrites = n; }

export function loadRaw(key) {
  try { return backend().getItem(PREFIX + key); } catch { return null; }
}

export function saveRaw(key, str) {
  if (failWrites > 0) { failWrites--; return false; }
  try { backend().setItem(PREFIX + key, str); return true; } catch { return false; }
}

export function load(key, fallback) {
  const raw = loadRaw(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function save(key, value) {
  try { return saveRaw(key, JSON.stringify(value)); } catch { return false; }
}

export function remove(key) {
  try { backend().removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Deep-merge saved data over defaults, keeping only known keys and matching types. */
export function mergeDefaults(defaults, saved) {
  if (saved === null || typeof saved !== 'object' || Array.isArray(saved)) return structuredClone(defaults);
  const out = {};
  for (const k of Object.keys(defaults)) {
    const d = defaults[k], s = saved[k];
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) out[k] = mergeDefaults(d, s);
    else if (Array.isArray(d)) out[k] = Array.isArray(s) ? s.slice() : d.slice();
    else if (s !== undefined && typeof s === typeof d) out[k] = s;
    else out[k] = d;
  }
  return out;
}

/** FNV-1a checksum of a string, hex. */
export function checksum(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
