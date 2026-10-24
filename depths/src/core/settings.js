/**
 * Player settings: defaults, presets, persistence, validation and change
 * notification. Settings are stored independently of any campaign. The
 * settings screen is generated from SETTINGS_SCHEMA so every control shown
 * maps onto a value that some system actually reads.
 */
import { load, save, mergeDefaults } from './storage.js';

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', ''],
  crouch: ['ControlLeft', ''],
  interact: ['KeyE', ''],
  use: ['Mouse0', ''],
  inspect: ['Mouse2', ''],
  radial: ['KeyQ', ''],
  reload: ['KeyR', ''],
  flashlight: ['KeyF', ''],
  inventory: ['KeyI', ''],
  journal: ['Tab', ''],
  ping: ['Mouse1', ''],
  mantle: ['Space', ''],
  leanLeft: ['KeyZ', ''],
  leanRight: ['KeyC', ''],
  callout: ['KeyT', ''],
  tool1: ['Digit1', ''],
  tool2: ['Digit2', ''],
  tool3: ['Digit3', ''],
  tool4: ['Digit4', ''],
  cameraFlash: ['KeyX', ''],
  breathe: ['KeyB', ''],
  hint: ['KeyH', ''],
  chat: ['Enter', ''],
};

export const ACTION_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  sprint: 'Sprint', crouch: 'Crouch', interact: 'Interact', use: 'Use equipped tool', inspect: 'Inspect or aim',
  radial: 'Tool radial', reload: 'Reload equipped tool', flashlight: 'Flashlight toggle', inventory: 'Inventory',
  journal: 'Journal', ping: 'Ping', mantle: 'Mantle or climb', leanLeft: 'Lean left', leanRight: 'Lean right',
  callout: 'Radio callout radial', tool1: 'Equip flashlight', tool2: 'Equip camera', tool3: 'Equip radio',
  tool4: 'Equip selected supply', cameraFlash: 'Camera flash on or off', breathe: 'Steady breathing (in cover)',
  hint: 'Request hint', chat: 'Text chat (co-op)',
};

export const DEFAULT_SETTINGS = {
  version: 1,
  preset: 'standard',
  accessibility: {
    subtitles: true,
    subtitleSize: 1.0,
    subtitleBg: 0.65,
    speakerNames: true,
    directionTags: true,
    envCaptions: true,
    soundRing: false,
    replayTag: true,
    clockIndicator: true,
    flashIntensity: 1.0,
    steadyLights: false,
    grain: true,
    aberration: true,
    cameraBob: 1.0,
    headShake: 1.0,
    damageVignette: true,
    handTremor: true,
    startlePeaks: true,
    reducedStartle: false,
    stressEffects: true,
    holdToToggle: false,
    navAssist: true,
    textScale: 1.0,
    highContrast: false,
  },
  controls: {
    sensitivity: 2.6,
    invertY: false,
    sprintMode: 'hold',
    crouchMode: 'hold',
    bindings: DEFAULT_BINDINGS,
    padLookX: 3.2,
    padLookY: 2.6,
    padInvertY: false,
    padDeadzone: 0.14,
    oneHand: false,
    padVibration: true,
    touch: 'auto',
    touchLook: 1.0,
  },
  audio: { master: 0.85, dialogue: 0.9, threat: 0.9, environment: 0.75, music: 0.6, compressed: false, speech: false },
  graphics: { quality: 'high', renderScale: 1.0, shadows: true, fov: 90, brightness: 1.0, showFps: false },
  interface: { hudAlways: false, composureBeside: false, hudScale: 1.0 },
};

/** Accessibility presets are starting combinations of individual settings, not separate content modes. */
export const ACCESS_PRESETS = {
  standard: { label: 'Standard', apply: {} },
  reducedMotion: {
    label: 'Reduced Motion',
    apply: { 'accessibility.cameraBob': 0, 'accessibility.headShake': 0, 'accessibility.handTremor': false, 'accessibility.grain': false, 'accessibility.aberration': false, 'accessibility.steadyLights': true, 'accessibility.flashIntensity': 0.3 },
  },
  lowVision: {
    label: 'Low Vision',
    apply: { 'accessibility.textScale': 1.35, 'accessibility.subtitleSize': 1.4, 'accessibility.subtitleBg': 0.9, 'accessibility.highContrast': true, 'graphics.brightness': 1.25, 'accessibility.clockIndicator': true, 'accessibility.navAssist': true, 'interface.hudAlways': true, 'accessibility.grain': false },
  },
  deafHoh: {
    label: 'Deaf and Hard of Hearing',
    apply: { 'accessibility.subtitles': true, 'accessibility.speakerNames': true, 'accessibility.directionTags': true, 'accessibility.envCaptions': true, 'accessibility.soundRing': true, 'accessibility.replayTag': true },
  },
  simplified: {
    label: 'Simplified Interaction',
    apply: { 'accessibility.holdToToggle': true, 'controls.sprintMode': 'toggle', 'controls.crouchMode': 'toggle', 'accessibility.navAssist': true },
  },
};

export const QUALITY = {
  low: { renderScale: 0.7, shadows: false, lights: 4 },
  medium: { renderScale: 0.85, shadows: false, lights: 6 },
  high: { renderScale: 1.0, shadows: true, lights: 8 },
};

/** type: slider | select | toggle | bindings | presets */
export const SETTINGS_SCHEMA = [
  { tab: 'Presets', items: [
    { key: 'preset', label: 'Comfort preset', type: 'presets', note: 'Each preset is a starting combination of the individual settings in the other tabs. You can change anything afterwards.' },
  ] },
  { tab: 'Subtitles', items: [
    { key: 'accessibility.subtitles', label: 'Subtitles', type: 'toggle' },
    { key: 'accessibility.subtitleSize', label: 'Subtitle size', type: 'slider', min: 0.8, max: 2.0, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'accessibility.subtitleBg', label: 'Subtitle background opacity', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'accessibility.speakerNames', label: 'Speaker names and source', type: 'toggle' },
    { key: 'accessibility.directionTags', label: 'Direction tags', type: 'toggle', note: 'Adds where a sound came from, e.g. "Water moving toward you from the left".' },
    { key: 'accessibility.envCaptions', label: 'Important environmental sounds', type: 'toggle', note: 'Captions for every creature warning and other sounds you need to hear.' },
    { key: 'accessibility.soundRing', label: 'Sound direction ring', type: 'toggle' },
    { key: 'accessibility.replayTag', label: 'Replay distortion tag', type: 'toggle', note: 'Marks lines the Operator replays in a copied voice. Gives the same cue as the dual-speaker phasing.' },
  ] },
  { tab: 'Visual comfort', items: [
    { key: 'accessibility.flashIntensity', label: 'Camera flash intensity', type: 'slider', min: 0.1, max: 1, step: 0.1, fmt: (v) => (v <= 0.3 ? 'Gentle fade' : `${Math.round(v * 100)}%`) },
    { key: 'accessibility.steadyLights', label: 'Steady lights', type: 'toggle', note: 'Replaces flickering fluorescent tubes and a low flashlight\'s flicker with a steady dim state.' },
    { key: 'accessibility.grain', label: 'Film grain', type: 'toggle' },
    { key: 'accessibility.aberration', label: 'Chromatic aberration', type: 'toggle' },
    { key: 'accessibility.cameraBob', label: 'Camera bob', type: 'slider', min: 0, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'accessibility.headShake', label: 'Head shake', type: 'slider', min: 0, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'accessibility.damageVignette', label: 'Damage vignette', type: 'toggle' },
    { key: 'accessibility.handTremor', label: 'Hand tremor', type: 'toggle' },
    { key: 'accessibility.stressEffects', label: 'Stress audiovisual effects', type: 'toggle', note: 'The composure meter still works when this is off.' },
    { key: 'accessibility.clockIndicator', label: 'Clock indicator', type: 'toggle', note: 'After you watch a refuge clock for three seconds, a label says whether the second hand is moving.' },
    { key: 'accessibility.textScale', label: 'Interface text size', type: 'slider', min: 0.9, max: 1.6, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'accessibility.highContrast', label: 'High contrast prompts', type: 'toggle' },
  ] },
  { tab: 'Startle and assists', items: [
    { key: 'accessibility.reducedStartle', label: 'Reduced startle', type: 'toggle', note: 'Lengthens first warning windows by one second and lowers abrupt non-essential stingers. Attack warnings stay.' },
    { key: 'accessibility.startlePeaks', label: 'Jump-scare audio peaks', type: 'toggle' },
    { key: 'accessibility.holdToToggle', label: 'Holds become single presses', type: 'toggle', note: 'Every hold shows a progress timer and can be cancelled with another press.' },
    { key: 'accessibility.navAssist', label: 'Navigation assistance', type: 'toggle', note: 'When you request a hint, highlights the next known doorway. Never reveals undiscovered secrets.' },
  ] },
  { tab: 'Audio', items: [
    { key: 'audio.master', label: 'Master', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'audio.dialogue', label: 'Dialogue', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'audio.threat', label: 'Threat cues', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'audio.environment', label: 'Environment', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'audio.music', label: 'Music', type: 'slider', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'audio.compressed', label: 'Compressed dynamic range', type: 'toggle', note: 'Reduces loud peaks without suppressing quiet clues.' },
    { key: 'audio.speech', label: 'Spoken dialogue (browser voice)', type: 'toggle', note: 'Reads lines aloud with your browser\'s speech voices. Subtitles stay available. Some browsers have no voices.' },
  ] },
  { tab: 'Controls', items: [
    { key: 'controls.sensitivity', label: 'Mouse sensitivity', type: 'slider', min: 0.3, max: 8, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.invertY', label: 'Invert mouse Y', type: 'toggle' },
    { key: 'controls.sprintMode', label: 'Sprint', type: 'select', options: [['hold', 'Hold'], ['toggle', 'Toggle']] },
    { key: 'controls.crouchMode', label: 'Crouch', type: 'select', options: [['hold', 'Hold'], ['toggle', 'Toggle']] },
    { key: 'controls.padLookX', label: 'Controller look sensitivity (horizontal)', type: 'slider', min: 0.5, max: 8, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.padLookY', label: 'Controller look sensitivity (vertical)', type: 'slider', min: 0.5, max: 8, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.padInvertY', label: 'Invert controller Y', type: 'toggle' },
    { key: 'controls.oneHand', label: 'One-hand controller layout', type: 'toggle', note: 'Left stick moves and turns; LB interacts, LT uses the tool, D-pad up flashlight, down crouch, left and right change tools, L3 sprints.' },
    { key: 'controls.padDeadzone', label: 'Stick dead zone', type: 'slider', min: 0.04, max: 0.4, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'controls.padVibration', label: 'Controller vibration', type: 'toggle' },
    { key: 'controls.touch', label: 'Touch controls', type: 'select', options: [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Off']], note: 'On-screen stick and buttons for phones and tablets. Automatic shows them once you touch the screen.' },
    { key: 'controls.touchLook', label: 'Touch look sensitivity', type: 'slider', min: 0.3, max: 3, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.bindings', label: 'Key bindings', type: 'bindings' },
  ] },
  { tab: 'Graphics', items: [
    { key: 'graphics.quality', label: 'Quality', type: 'select', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
    { key: 'graphics.renderScale', label: 'Render resolution', type: 'slider', min: 0.5, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'graphics.shadows', label: 'Flashlight shadows', type: 'toggle' },
    { key: 'graphics.fov', label: 'Field of view (horizontal)', type: 'slider', min: 70, max: 110, step: 1, fmt: (v) => `${v}°` },
    { key: 'graphics.brightness', label: 'Brightness', type: 'slider', min: 0.6, max: 1.6, step: 0.05, fmt: (v) => v.toFixed(2) },
    { key: 'graphics.showFps', label: 'Show frame rate', type: 'toggle' },
  ] },
  { tab: 'Interface', items: [
    { key: 'interface.hudAlways', label: 'Always show health and stamina', type: 'toggle' },
    { key: 'interface.composureBeside', label: 'Show composure beside health', type: 'toggle' },
    { key: 'interface.hudScale', label: 'HUD scale', type: 'slider', min: 0.8, max: 1.5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  ] },
];

export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
export function setPath(obj, path, v) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}

export class Settings {
  constructor() {
    this.data = this._load();
    this.listeners = [];
  }
  _load() {
    const saved = load('settings', null);
    this.fresh = !saved; // first launch: no stored settings yet
    const d = mergeDefaults(DEFAULT_SETTINGS, saved);
    // bindings: keep known actions only, fill missing
    const b = {};
    for (const a of Object.keys(DEFAULT_BINDINGS)) {
      const s = saved && saved.controls && saved.controls.bindings && saved.controls.bindings[a];
      b[a] = Array.isArray(s) && s.length === 2 && s.every((x) => typeof x === 'string') ? s.slice() : DEFAULT_BINDINGS[a].slice();
    }
    d.controls.bindings = b;
    return d;
  }
  get(path) { return getPath(this.data, path); }
  set(path, v) {
    setPath(this.data, path, v);
    if (path !== 'preset' && path.startsWith('accessibility')) this.data.preset = 'custom';
    this.persist();
    this._emit(path);
  }
  applyPreset(name) {
    const p = ACCESS_PRESETS[name];
    if (!p) return;
    // a preset starts from the defaults of the comfort-related values, then applies its changes
    const base = structuredClone(DEFAULT_SETTINGS);
    this.data.accessibility = base.accessibility;
    for (const [k, v] of Object.entries(p.apply)) setPath(this.data, k, v);
    this.data.preset = name;
    this.persist();
    this._emit('preset');
  }
  resetTab(tab) {
    const t = SETTINGS_SCHEMA.find((s) => s.tab === tab);
    if (!t) return;
    for (const it of t.items) {
      if (it.type === 'bindings') this.data.controls.bindings = structuredClone(DEFAULT_BINDINGS);
      else if (it.type !== 'presets') setPath(this.data, it.key, structuredClone(getPath(DEFAULT_SETTINGS, it.key)));
    }
    this.persist();
    this._emit('*');
  }
  /** Bind `code` to action slot. Returns the list of other actions already using it (duplicates), without changing them. */
  conflicts(action, code) {
    if (!code) return [];
    const out = [];
    for (const [a, codes] of Object.entries(this.data.controls.bindings)) if (a !== action && codes.includes(code)) out.push(a);
    return out;
  }
  bind(action, slot, code, { clearConflicts = false } = {}) {
    if (clearConflicts && code) {
      for (const [a, codes] of Object.entries(this.data.controls.bindings)) {
        if (a === action) continue;
        for (let i = 0; i < 2; i++) if (codes[i] === code) codes[i] = '';
      }
    }
    this.data.controls.bindings[action][slot] = code || '';
    this.persist();
    this._emit('controls.bindings');
  }
  persist() { this.saveOk = save('settings', this.data); return this.saveOk; }
  onChange(fn) { this.listeners.push(fn); }
  _emit(path) { for (const f of this.listeners) f(path); }
}
