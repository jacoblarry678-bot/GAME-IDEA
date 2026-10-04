/**
 * Player settings: defaults, persistence, validation and change
 * notification. The UI is generated from SETTINGS_SCHEMA so every control
 * shown maps onto a value that some system actually reads.
 */
import { load, save, mergeDefaults } from './storage.js';

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', ''],
  crouch: ['KeyC', 'ControlLeft'],
  sprint: ['ShiftLeft', ''],
  fire: ['Mouse0', ''],
  ads: ['Mouse2', ''],
  reload: ['KeyR', ''],
  swap: ['WheelDown', 'WheelUp'],
  primary: ['Digit1', ''],
  secondary: ['Digit2', ''],
  melee: ['KeyV', 'KeyE'],
  lethal: ['KeyG', ''],
  tactical: ['KeyQ', ''],
  scoreboard: ['Tab', ''],
  support1: ['Digit3', ''],
  support2: ['Digit4', ''],
  support3: ['Digit5', ''],
};

export const ACTION_LABELS = {
  forward: 'Move Forward', back: 'Move Back', left: 'Strafe Left', right: 'Strafe Right',
  jump: 'Jump / Mantle', crouch: 'Crouch / Slide', sprint: 'Sprint', fire: 'Fire', ads: 'Aim Down Sights',
  reload: 'Reload', swap: 'Switch Weapon', primary: 'Primary Weapon', secondary: 'Secondary Weapon',
  melee: 'Melee', lethal: 'Lethal Equipment', tactical: 'Tactical Equipment', scoreboard: 'Scoreboard',
  support1: 'Recon Scan', support2: 'Supply Drop', support3: 'Area Strike',
};

export const DEFAULT_SETTINGS = {
  version: 1,
  graphics: {
    preset: 'high',
    renderScale: 1.0,
    dynamicRes: false,
    shadows: 'high',
    textures: 'high',
    effects: 'high',
    bloom: true,
    ao: false,
    sunFlare: true,
    fov: 90,
    frameCap: 0,
    showFps: false,
    brightness: 1.0,
    cameraShake: 1.0,
    headBob: 1.0,
  },
  controls: {
    sensitivity: 3.0,
    adsSensitivity: 0.85,
    invertY: false,
    sprintMode: 'hold',
    crouchMode: 'toggle',
    adsMode: 'hold',
    bindings: DEFAULT_BINDINGS,
    padLookSens: 4.0,
    padAdsSens: 0.7,
    padDeadzone: 0.12,
    padInvertY: false,
    padVibration: true,
  },
  audio: { master: 0.8, music: 0.5, sfx: 0.9, dialogue: 0.8, ui: 0.7 },
  interface: {
    crosshair: 'cross',
    crosshairColor: '#ffffff',
    crosshairSize: 1.0,
    hudScale: 1.0,
    hitmarkers: true,
    hitSound: true,
    damageNumbers: false,
    minimap: 'rotate',
    killfeed: true,
  },
  accessibility: {
    textScale: 1.0,
    colorblind: 'off',
    reducedFlash: false,
    reducedMotion: false,
    captions: true,
  },
};

export const QUALITY_PRESETS = {
  low: { renderScale: 0.7, shadows: 'off', textures: 'low', effects: 'low', bloom: false, ao: false },
  medium: { renderScale: 0.85, shadows: 'low', textures: 'medium', effects: 'medium', bloom: true, ao: false },
  high: { renderScale: 1.0, shadows: 'high', textures: 'high', effects: 'high', bloom: true, ao: false },
  ultra: { renderScale: 1.0, shadows: 'ultra', textures: 'ultra', effects: 'high', bloom: true, ao: true },
};

/**
 * UI schema. type: slider | select | toggle | bindings | info
 * `restart: true` marks options that take effect after reloading the page.
 */
export const SETTINGS_SCHEMA = [
  { tab: 'Graphics', items: [
    { key: 'graphics.preset', label: 'Quality Preset', type: 'select', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']] },
    { key: 'graphics.renderScale', label: 'Render Resolution', type: 'slider', min: 0.5, max: 1.0, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'graphics.dynamicRes', label: 'Dynamic Resolution', type: 'toggle', note: 'Lowers render resolution automatically (down to 50%) when the frame rate drops below 58 FPS.' },
    { key: 'graphics.shadows', label: 'Shadow Quality', type: 'select', options: [['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']] },
    { key: 'graphics.textures', label: 'Texture Quality', type: 'select', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], restart: true },
    { key: 'graphics.effects', label: 'Effects Quality', type: 'select', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
    { key: 'graphics.ao', label: 'Ambient Occlusion (GTAO)', type: 'toggle', note: 'Contact shadows in corners and under cover. Costly on integrated GPUs.' },
    { key: 'graphics.bloom', label: 'Bloom', type: 'toggle', note: 'Soft glow on lights, muzzle flashes and explosions.' },
    { key: 'graphics.sunFlare', label: 'Sun Glare & Lens Flare', type: 'toggle', note: 'Glare and lens flare when you look toward the sun; hidden when buildings or smoke block it. Reduce Flashing dims it.' },
    { key: 'graphics.fov', label: 'Field of View (horizontal)', type: 'slider', min: 70, max: 115, step: 1, fmt: (v) => `${v}°` },
    { key: 'graphics.frameCap', label: 'Frame Rate Limit', type: 'select', options: [[0, 'Display refresh'], [30, '30'], [60, '60'], [120, '120'], [144, '144']] },
    { key: 'graphics.brightness', label: 'Brightness', type: 'slider', min: 0.6, max: 1.6, step: 0.05, fmt: (v) => v.toFixed(2) },
    { key: 'graphics.showFps', label: 'Show FPS / Frame Time', type: 'toggle' },
    { key: 'graphics.cameraShake', label: 'Camera Shake', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'graphics.headBob', label: 'Weapon & Head Bob', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: '_display', label: 'Display Mode', type: 'display' },
    { key: '_vsync', label: 'V-Sync', type: 'info', text: 'Controlled by the browser (always synced to the display). Use Frame Rate Limit to cap lower.' },
  ] },
  { tab: 'Controls', items: [
    { key: 'controls.sensitivity', label: 'Mouse Sensitivity', type: 'slider', min: 0.2, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.adsSensitivity', label: 'ADS Sensitivity Multiplier', type: 'slider', min: 0.2, max: 1.5, step: 0.05, fmt: (v) => v.toFixed(2) },
    { key: 'controls.invertY', label: 'Invert Vertical Look', type: 'toggle' },
    { key: 'controls.sprintMode', label: 'Sprint', type: 'select', options: [['hold', 'Hold'], ['toggle', 'Toggle']] },
    { key: 'controls.crouchMode', label: 'Crouch', type: 'select', options: [['hold', 'Hold'], ['toggle', 'Toggle']] },
    { key: 'controls.adsMode', label: 'Aim Down Sights', type: 'select', options: [['hold', 'Hold'], ['toggle', 'Toggle']] },
    { key: 'controls.bindings', label: 'Key Bindings', type: 'bindings' },
    { key: '_padhdr', label: 'Controller', type: 'header' },
    { key: 'controls.padLookSens', label: 'Controller Look Sensitivity', type: 'slider', min: 0.5, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'controls.padAdsSens', label: 'Controller ADS Multiplier', type: 'slider', min: 0.2, max: 1.5, step: 0.05, fmt: (v) => v.toFixed(2) },
    { key: 'controls.padDeadzone', label: 'Stick Dead Zone', type: 'slider', min: 0.02, max: 0.4, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'controls.padInvertY', label: 'Controller Invert Y', type: 'toggle' },
    { key: 'controls.padVibration', label: 'Controller Vibration', type: 'toggle', note: 'Requires a browser and controller that support rumble.' },
  ] },
  { tab: 'Audio', items: [
    { key: 'audio.master', label: 'Master Volume', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'audio.music', label: 'Music', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'audio.sfx', label: 'Effects', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'audio.dialogue', label: 'Announcer / Dialogue', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct, note: 'Announcer uses your browser\'s speech voice when available.' },
    { key: 'audio.ui', label: 'Interface', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct },
  ] },
  { tab: 'Interface', items: [
    { key: 'interface.crosshair', label: 'Crosshair Style', type: 'select', options: [['cross', 'Cross'], ['cross_dot', 'Cross + Dot'], ['dot', 'Dot'], ['circle', 'Circle'], ['off', 'Off']] },
    { key: 'interface.crosshairColor', label: 'Crosshair Color', type: 'select', options: [['#ffffff', 'White'], ['#7dff6b', 'Green'], ['#ffe14d', 'Yellow'], ['#4de8ff', 'Cyan'], ['#ff5cf0', 'Magenta']] },
    { key: 'interface.crosshairSize', label: 'Crosshair Size', type: 'slider', min: 0.5, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
    { key: 'interface.hudScale', label: 'HUD Scale', type: 'slider', min: 0.75, max: 1.4, step: 0.05, fmt: pct },
    { key: 'interface.hitmarkers', label: 'Hit Markers', type: 'toggle' },
    { key: 'interface.hitSound', label: 'Hit Marker Sound', type: 'toggle' },
    { key: 'interface.damageNumbers', label: 'Damage Numbers', type: 'toggle' },
    { key: 'interface.minimap', label: 'Minimap', type: 'select', options: [['rotate', 'Rotating'], ['fixed', 'Fixed North'], ['off', 'Off']] },
    { key: 'interface.killfeed', label: 'Kill Feed', type: 'toggle' },
  ] },
  { tab: 'Accessibility', items: [
    { key: 'accessibility.textScale', label: 'Text Size', type: 'slider', min: 0.85, max: 1.4, step: 0.05, fmt: pct },
    { key: 'accessibility.colorblind', label: 'Team Color Mode', type: 'select', options: [['off', 'Default (Blue / Orange)'], ['deuteranopia', 'Deuteranopia'], ['protanopia', 'Protanopia'], ['tritanopia', 'Tritanopia']] },
    { key: 'accessibility.reducedFlash', label: 'Reduce Flashing', type: 'toggle', note: 'Dims muzzle flashes and explosions.' },
    { key: 'accessibility.reducedMotion', label: 'Reduce Motion', type: 'toggle', note: 'Disables head bob, camera shake and weapon sway.' },
    { key: 'accessibility.captions', label: 'Captions', type: 'toggle', note: 'Announcer lines and key sound cues as text.' },
  ] },
];

function pct(v) { return `${Math.round(v * 100)}%`; }

/** Team colors per colorblind mode: [friendly, enemy]. */
export const TEAM_COLORS = {
  off: ['#3d9bff', '#ff7a2f'],
  deuteranopia: ['#3d8bff', '#ffd23f'],
  protanopia: ['#36a2ff', '#f6e05e'],
  tritanopia: ['#2ec4b6', '#ff4f79'],
};

export class Settings {
  constructor() {
    this.data = mergeDefaults(DEFAULT_SETTINGS, load('settings', null));
    // fill bindings for any new actions
    for (const k of Object.keys(DEFAULT_BINDINGS)) {
      if (!Array.isArray(this.data.controls.bindings[k])) this.data.controls.bindings[k] = DEFAULT_BINDINGS[k].slice();
    }
    this.listeners = [];
  }

  get(path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), this.data);
  }

  set(path, value) {
    const keys = path.split('.');
    let o = this.data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    if (path === 'graphics.preset' && QUALITY_PRESETS[value]) {
      Object.assign(this.data.graphics, QUALITY_PRESETS[value]);
    } else if (['graphics.renderScale', 'graphics.shadows', 'graphics.textures', 'graphics.effects', 'graphics.bloom', 'graphics.ao'].includes(path)) {
      this.data.graphics.preset = 'custom';
      for (const [name, p] of Object.entries(QUALITY_PRESETS)) {
        if (Object.entries(p).every(([k, v]) => this.data.graphics[k] === v)) this.data.graphics.preset = name;
      }
    }
    this.persist();
    for (const l of this.listeners) l(path, value);
  }

  resetSection(section) {
    this.data[section] = structuredClone(DEFAULT_SETTINGS[section]);
    this.persist();
    for (const l of this.listeners) l(section, this.data[section]);
  }

  resetAll() {
    this.data = structuredClone(DEFAULT_SETTINGS);
    this.persist();
    for (const l of this.listeners) l('*', null);
  }

  onChange(fn) { this.listeners.push(fn); }
  persist() { save('settings', this.data); }

  teamColors() { return TEAM_COLORS[this.data.accessibility.colorblind] || TEAM_COLORS.off; }
}
