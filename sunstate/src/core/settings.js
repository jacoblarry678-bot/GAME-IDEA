/**
 * Player settings: defaults, presets, validation, persistence and change
 * notification. Every option exposed in the settings screen is read by a
 * system somewhere — there are no decorative toggles.
 */
import { storage } from './storage.js';

const KEY = 'sunstate.settings.v1';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  crouch: 'KeyC',
  interact: 'KeyE',
  enterVehicle: 'KeyF',
  reload: 'KeyR',
  nextWeapon: 'KeyQ',
  handbrake: 'Space',
  horn: 'KeyH',
  radio: 'KeyT',
  lookBehind: 'KeyX',
  headlights: 'KeyL',
  map: 'KeyM',
  fire: 'Mouse0',
  aim: 'Mouse2',
  skip: 'Enter',
  switchCharacter: 'Tab',
  partner: 'KeyG',
};

export const BINDING_LABELS = {
  forward: 'Move forward / accelerate',
  back: 'Move back / brake & reverse',
  left: 'Move left / steer left',
  right: 'Move right / steer right',
  sprint: 'Sprint',
  jump: 'Jump',
  crouch: 'Crouch',
  interact: 'Interact',
  enterVehicle: 'Enter / exit vehicle',
  reload: 'Reload',
  nextWeapon: 'Switch weapon',
  handbrake: 'Handbrake (in vehicle)',
  horn: 'Horn',
  radio: 'Next radio station',
  lookBehind: 'Look behind (in vehicle)',
  headlights: 'Headlights',
  map: 'Map',
  fire: 'Fire / punch',
  aim: 'Aim',
  skip: 'Skip dialogue',
  switchCharacter: 'Switch character (Cal / Sol)',
  partner: 'Partner: follow / wait (pull over / drive)',
};

export const PRESETS = {
  low: { renderScale: 0.6, shadows: 'off', bloom: false, drawDistance: 'low', antialias: false },
  medium: { renderScale: 0.8, shadows: 'low', bloom: true, drawDistance: 'medium', antialias: true },
  high: { renderScale: 1, shadows: 'high', bloom: true, drawDistance: 'high', antialias: true },
  ultra: { renderScale: 1, shadows: 'ultra', bloom: true, drawDistance: 'ultra', antialias: true },
};

export function defaultSettings() {
  return {
    graphics: { preset: 'high', ...PRESETS.high, frameCap: 0, fov: 65, showFps: false },
    controls: { sensitivity: 1, aimSensitivity: 0.65, invertY: false, invertX: false, gamepad: true, bindings: { ...DEFAULT_BINDINGS } },
    audio: { master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.7, ui: 0.6 },
    interface: { hudScale: 1, subtitleSize: 'medium', subtitles: true, cameraShake: 1, minimapRotate: true, units: 'mph' },
    gameplay: { traffic: 1, peds: 1, weather: 'dynamic' },
  };
}

const ENUMS = {
  'graphics.preset': ['low', 'medium', 'high', 'ultra', 'custom'],
  'graphics.shadows': ['off', 'low', 'high', 'ultra'],
  'graphics.drawDistance': ['low', 'medium', 'high', 'ultra'],
  'graphics.frameCap': [0, 30, 60, 120],
  'interface.subtitleSize': ['small', 'medium', 'large'],
  'interface.units': ['mph', 'kmh'],
  'gameplay.weather': ['dynamic', 'clear', 'rain'],
};
const RANGES = {
  'graphics.renderScale': [0.4, 1.5],
  'graphics.fov': [50, 90],
  'controls.sensitivity': [0.1, 3],
  'controls.aimSensitivity': [0.1, 2],
  'audio.master': [0, 1], 'audio.music': [0, 1], 'audio.sfx': [0, 1], 'audio.ambient': [0, 1], 'audio.ui': [0, 1],
  'interface.hudScale': [0.7, 1.4],
  'interface.cameraShake': [0, 1],
  'gameplay.traffic': [0, 1.5],
  'gameplay.peds': [0, 1.5],
};

/** Merge stored data onto defaults, dropping anything of the wrong type or range. */
export function sanitizeSettings(raw) {
  const def = defaultSettings();
  if (!raw || typeof raw !== 'object') return def;
  for (const group of Object.keys(def)) {
    const src = raw[group];
    if (!src || typeof src !== 'object') continue;
    for (const k of Object.keys(def[group])) {
      const path = `${group}.${k}`;
      const v = src[k];
      if (v === undefined) continue;
      if (k === 'bindings') {
        if (v && typeof v === 'object') for (const a of Object.keys(DEFAULT_BINDINGS)) if (typeof v[a] === 'string' && v[a]) def.controls.bindings[a] = v[a];
        continue;
      }
      if (ENUMS[path]) { if (ENUMS[path].includes(v)) def[group][k] = v; continue; }
      if (RANGES[path]) { if (typeof v === 'number' && isFinite(v)) def[group][k] = Math.min(RANGES[path][1], Math.max(RANGES[path][0], v)); continue; }
      if (typeof v === typeof def[group][k]) def[group][k] = v;
    }
  }
  return def;
}

export class Settings {
  constructor() {
    this.data = sanitizeSettings(storage.get(KEY));
    this.listeners = new Set();
  }
  get g() { return this.data.graphics; }
  get c() { return this.data.controls; }
  get a() { return this.data.audio; }
  get i() { return this.data.interface; }
  get gp() { return this.data.gameplay; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  set(group, key, value) {
    this.data[group][key] = value;
    if (group === 'graphics' && key in PRESETS.high) this.data.graphics.preset = 'custom';
    this.data = sanitizeSettings(this.data);
    this.commit();
  }

  applyPreset(name) {
    if (!PRESETS[name]) return;
    Object.assign(this.data.graphics, PRESETS[name], { preset: name });
    this.commit();
  }

  bind(action, code) {
    // swapping keeps every action bound: whoever had this key takes the old one
    const b = this.data.controls.bindings;
    const prev = b[action];
    for (const a of Object.keys(b)) {
      // Space is shared by jump (on foot) and handbrake (in vehicle) by design
      const shared = (a === 'jump' && action === 'handbrake') || (a === 'handbrake' && action === 'jump');
      if (a !== action && b[a] === code && !shared) b[a] = prev;
    }
    b[action] = code;
    this.commit();
  }

  resetGroup(group) {
    this.data[group] = defaultSettings()[group];
    this.commit();
  }

  commit() {
    storage.set(KEY, this.data);
    for (const fn of this.listeners) fn(this.data);
  }
}
