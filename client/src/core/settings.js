/**
 * Persisted player settings — graphics, audio, controls, accessibility.
 * Stored in localStorage so a browser refresh keeps your bindings.
 */

import { KEYCODE_DEFAULTS } from '../../../shared/constants.js';

const KEY = 'hellraiser.settings.v1';

export const DEFAULTS = {
  graphics: {
    preset: 'high',
    resolutionScale: 1.0,
    shadows: true,
    antialiasing: true,
    textureQuality: 'high', // low | medium | high
    fogQuality: 'high',
    postProcessing: true,
    bloom: true,
    filmGrain: true,
    motionBlur: false,
    fov: 72,
  },
  audio: {
    master: 0.8,
    music: 0.55,
    sfx: 0.9,
    voice: 0.9,
    ambience: 0.7,
    subtitles: true,
  },
  controls: {
    sensitivity: 1.0,
    invertY: false,
    controllerSensitivity: 1.0,
    toggleSprint: false,
    toggleCrouch: true,
    holdInteract: true,
    bindings: { ...KEYCODE_DEFAULTS },
  },
  accessibility: {
    reduceShake: false,
    reduceFlashing: false,
    highContrastPrompts: false,
    largeText: false,
    colorblind: 'none', // none | protan | deutan | tritan
    fearVisuals: 1.0,
    heartbeatCue: true,
  },
  player: {
    name: '',
  },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else if (over[k] !== undefined) {
      out[k] = over[k];
    }
  }
  return out;
}

export class Settings {
  constructor() {
    this.data = deepMerge(DEFAULTS, this.load());
    this.listeners = new Set();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private browsing — settings just won't persist */
    }
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get(path, fallback) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data) ?? fallback;
  }

  set(path, value) {
    const keys = path.split('.');
    let o = this.data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    this.save();
  }

  reset() {
    this.data = structuredClone(DEFAULTS);
    this.save();
  }

  resetBindings() {
    this.data.controls.bindings = { ...KEYCODE_DEFAULTS };
    this.save();
  }
}

export const settings = new Settings();
