/**
 * Saved settings and progression. localStorage can throw (private windows,
 * sandboxed frames), so every access is guarded and the game runs without it.
 */

const KEY = 'bentonkids.battleisland.v1';

const DEFAULTS = {
  settings: {
    sensitivity: 1.0,
    adsSensitivity: 0.7,
    invertY: false,
    fov: 80,
    volume: 0.7,
    shadows: true,
    botCount: 19,
    showFps: false,
  },
  profile: {
    character: 'colton',
    mode: 'build', // build | zerobuild
    outfits: { colton: 0, emerson: 0, waylon: 0 },
    skin: 0,
  },
  progress: {
    xp: 0,
    wins: 0,
    matches: 0,
    kills: 0,
    bestPlace: 0,
  },
};

function merge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = merge(base[k], over[k]);
    else if (over[k] !== undefined) out[k] = over[k];
  }
  return out;
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const save = {
  data: merge(DEFAULTS, load()),
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable — progress lasts for this visit only */
    }
  },
  reset() {
    this.data = merge(DEFAULTS, {});
    this.write();
  },
};

/** XP needed to go from `level` to `level + 1`. */
export const xpForLevel = (level) => 400 + level * 200;

export function levelInfo(xp) {
  let level = 1;
  let rest = xp;
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}
