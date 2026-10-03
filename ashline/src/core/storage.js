/**
 * Safe, versioned localStorage access. Reads never throw; corrupt or missing
 * data falls back to defaults. Writes are best-effort (private windows and
 * sandboxed previews may block storage — the game still runs).
 */
const PREFIX = 'ashline.';

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { window.localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Deep-merge saved data over defaults, keeping only known keys and matching types. */
export function mergeDefaults(defaults, saved) {
  if (saved === null || typeof saved !== 'object' || Array.isArray(saved)) return structuredClone(defaults);
  const out = Array.isArray(defaults) ? [] : {};
  for (const k of Object.keys(defaults)) {
    const d = defaults[k], s = saved[k];
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
      // open maps (e.g. bindings) keep extra keys from defaults only
      out[k] = mergeDefaults(d, s);
    } else if (Array.isArray(d)) {
      out[k] = Array.isArray(s) ? s.slice(0, Math.max(d.length, s.length)) : d.slice();
    } else if (s !== undefined && typeof s === typeof d) {
      out[k] = s;
    } else {
      out[k] = d;
    }
  }
  return out;
}
