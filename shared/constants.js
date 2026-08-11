/**
 * HELLRAISER: THE GAME — shared constants
 *
 * Imported by BOTH the Node server and the browser client. Keep it free of any
 * DOM / three.js / node-only imports.
 */

export const PROTOCOL_VERSION = 3;

export const NET = {
  TICK_HZ: 20, // authoritative simulation ticks per second
  SNAPSHOT_HZ: 20, // state broadcasts per second
  INPUT_HZ: 30, // client -> server movement reports
  INTERP_DELAY_MS: 100, // remote entity render delay for smooth interpolation
  MAX_SPEED_TOLERANCE: 2.2, // multiplier over max speed before server rubber-bands
};

export const ROLES = {
  SURVIVOR: 'survivor',
  CENOBITE: 'cenobite',
  SPECTATOR: 'spectator',
};

export const MATCH_STATE = {
  LOBBY: 'lobby',
  STARTING: 'starting',
  INTRO: 'intro',
  ACTIVE: 'active',
  ENDED: 'ended',
};

export const HEALTH_STATE = {
  HEALTHY: 'healthy',
  INJURED: 'injured',
  DOWNED: 'downed',
  DEAD: 'dead',
  ESCAPED: 'escaped',
};

/** Movement tuning (metres / second). Shared so bots and validation agree. */
export const MOVE = {
  WALK: 3.1,
  SPRINT: 6.0,
  CROUCH: 1.5,
  INJURED_MULT: 0.72,
  DOWNED_CRAWL: 0.9,
  ACCEL: 22,
  AIR_ACCEL: 4,
  FRICTION: 12,
  GRAVITY: -22,
  JUMP: 0, // survivors vault rather than jump
  PLAYER_RADIUS: 0.38,
  PLAYER_HEIGHT: 1.78,
  CROUCH_HEIGHT: 1.05,
  EYE_OFFSET: 0.12,
  STEP_HEIGHT: 0.45,
};

export const CENOBITE_MOVE = {
  WALK: 3.5,
  SPRINT: 5.35, // slower top speed than a survivor sprint — pressure, not a footrace
  CHASE_BONUS: 0.55, // applied while a survivor is within chase range
  ACCEL: 18,
};

export const STAMINA = {
  MAX: 100,
  DRAIN: 15.5, // per second sprinting
  REGEN: 11.0, // per second while not sprinting
  REGEN_DELAY: 1.1, // seconds after sprint stops
  VAULT_COST: 12,
  EXHAUST_LOCK: 1.6, // seconds locked out at 0
};

export const FEAR = {
  MAX: 100,
  DECAY: 3.2, // per second in safe conditions
  NEAR_CENOBITE: 16, // per second scaled by proximity
  CENOBITE_RADIUS: 22,
  DARKNESS: 3.4,
  ALONE: 1.9,
  ALONE_RADIUS: 14,
  TEAMMATE_NEAR_RELIEF: 5.5,
  LIGHT_RELIEF: 6.5,
  CHASED: 12,
  INJURED: 2.6,
  WITNESS_DEATH: 34, // instant spike
  SUPERNATURAL_EVENT: 12, // instant spike
  PUZZLE_WHISPER: 8,
  // thresholds
  UNEASY: 25,
  AFRAID: 50,
  TERRIFIED: 75,
};

export const HEALTH = {
  MAX: 100,
  INJURED_AT: 50,
  BLEED_RATE: 0.85, // hp/sec while injured and untreated
  DOWNED_BLEEDOUT: 60, // seconds on the ground before death
  SELF_HEAL_TIME: 12,
  TEAM_HEAL_TIME: 6,
  REVIVE_TIME: 8,
  MEDKIT_HEAL: 55,
};

export const DAMAGE = {
  CENOBITE_MELEE: 55,
  CHAIN_HIT: 34,
  CHAIN_TRAP: 26,
  EXECUTION: 9999,
  HAZARD: 18,
  MELEE_RANGE: 2.65,
  MELEE_ARC: Math.PI * 0.42,
  MELEE_COOLDOWN: 1.35,
  HIT_STUN: 0.55,
  IFRAMES: 1.2,
};

/** Cenobite ability definitions — cooldowns in seconds. */
export const ABILITIES = {
  CHAIN_SUMMON: {
    id: 'chain_summon',
    name: 'Chain Summon',
    key: '1',
    cooldown: 11,
    range: 26,
    speed: 34,
    powerCost: 15,
    desc: 'Tear a rift and launch a hooked chain. On hit: damage, brief root, and the survivor is dragged toward you.',
  },
  CHAIN_TRAP: {
    id: 'chain_trap',
    name: 'Chain Trap',
    key: '2',
    cooldown: 9,
    maxActive: 4,
    armTime: 2.0,
    duration: 150,
    radius: 1.5,
    rootTime: 2.6,
    powerCost: 10,
    desc: 'Bury a barbed snare. Survivors who cross it are held and marked.',
  },
  GATEWAY: {
    id: 'gateway',
    name: 'Gateway',
    key: '3',
    cooldown: 24,
    range: 34,
    channel: 1.2,
    powerCost: 25,
    desc: 'Open a corridor through Hell to a point you have seen. Survivors hear the tear.',
  },
  PAIN_SENSE: {
    id: 'pain_sense',
    name: 'Pain Sense',
    key: '4',
    cooldown: 20,
    duration: 6,
    fearThreshold: 45,
    powerCost: 12,
    desc: 'Reveal every survivor who is injured, bleeding, or badly frightened.',
  },
  LAMENT_TELEPORT: {
    id: 'lament_teleport',
    name: 'Lament Teleport',
    key: '5',
    cooldown: 45,
    channel: 2.4,
    powerCost: 40,
    desc: 'Only while the box is being solved. Step out of the puzzle beside whoever dared to open it.',
  },
  EXECUTION: {
    id: 'execution',
    name: 'Execution',
    key: 'F',
    cooldown: 3,
    range: 2.4,
    duration: 4.2,
    desc: 'Finish a downed survivor. You are vulnerable and visible for the whole rite.',
  },
};

export const POWER = {
  MAX: 100,
  START: 55,
  REGEN: 2.3, // per second
  ON_HIT: 9,
  ON_DOWN: 22,
  ON_OBJECTIVE_LOST: 14, // survivors completed something — Hell compensates
};

/** Objective / ritual configuration. */
export const OBJECTIVES = {
  SEALS_REQUIRED: 4, // ritual seals to break, of SEAL_SITES available
  SEAL_BREAK_TIME: 14,
  SEAL_SITES: 6,
  RELIC_REQUIRED: 3, // ritual relics to carry to the altar
  RELIC_SITES: 6,
  BOX_PIECES: 3, // Lament Configuration fragments
  BOX_PIECE_SITES: 5,
  SEARCH_TIME: 2.6, // seconds to search a container
  GATE_CHARGE_TIME: 22, // final escape channel
  MATCH_DURATION: 20 * 60,
};

export const ITEMS = {
  flashlight: { id: 'flashlight', name: 'Flashlight', slot: 'tool', battery: 100, drain: 1.6 },
  medkit: { id: 'medkit', name: 'Field Medkit', slot: 'tool', charges: 1 },
  key: { id: 'key', name: 'Rusted Key', slot: 'quest' },
  relic: { id: 'relic', name: 'Ritual Relic', slot: 'quest' },
  box_piece: { id: 'box_piece', name: 'Configuration Fragment', slot: 'quest' },
  lament: { id: 'lament', name: 'Lament Configuration', slot: 'quest' },
  chalk: { id: 'chalk', name: 'Warding Chalk', slot: 'tool', charges: 3 },
  lantern: { id: 'lantern', name: 'Oil Lantern', slot: 'tool', battery: 100, drain: 0.7 },
};

export const HORROR_EVENTS = [
  'lights_out',
  'chains_stir',
  'door_slam',
  'distant_scream',
  'silhouette',
  'blood_walls',
  'whispers',
  'apparition',
  'corridor_shift',
];

export const KEYCODE_DEFAULTS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'ControlLeft',
  interact: 'KeyE',
  vault: 'Space',
  flashlight: 'KeyF',
  drop: 'KeyG',
  inventory1: 'Digit1',
  inventory2: 'Digit2',
  ability1: 'Digit1',
  ability2: 'Digit2',
  ability3: 'Digit3',
  ability4: 'Digit4',
  ability5: 'Digit5',
  execute: 'KeyF',
  attack: 'Mouse0',
  scoreboard: 'Tab',
  debug: 'F3',
  pause: 'Escape',
};

export const LOBBY = {
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 8,
  CODE_LENGTH: 6,
  CODE_ALPHABET: '0123456789ABCDEFGHJKLMNPRSTUVWXYZ', // no I, O, Q — misread as 1/0
  IDLE_TIMEOUT_MS: 45 * 60 * 1000,
};

export const GAME_MODES = {
  '1v4': { id: '1v4', name: '1 Cenobite vs 4 Survivors', cenobites: 1, survivors: 4 },
  '1v3': { id: '1v3', name: '1 Cenobite vs 3 Survivors', cenobites: 1, survivors: 3 },
  '2v6': { id: '2v6', name: '2 Cenobites vs 6 Survivors', cenobites: 2, survivors: 6 },
};

export const QUALITY_PRESETS = {
  low: {
    name: 'Low',
    pixelRatio: 0.7,
    shadows: false,
    shadowMapSize: 512,
    maxDynamicLights: 6,
    postProcessing: false,
    bloom: false,
    grain: false,
    particles: 0.25,
    fogQuality: 'low',
    anisotropy: 1,
    textureSize: 256,
    chains: 0.3,
    antialias: false,
  },
  medium: {
    name: 'Medium',
    pixelRatio: 0.85,
    shadows: true,
    shadowMapSize: 1024,
    maxDynamicLights: 10,
    postProcessing: true,
    bloom: true,
    grain: true,
    particles: 0.55,
    fogQuality: 'medium',
    anisotropy: 2,
    textureSize: 512,
    chains: 0.6,
    antialias: false,
  },
  high: {
    name: 'High',
    pixelRatio: 1.0,
    shadows: true,
    shadowMapSize: 2048,
    maxDynamicLights: 16,
    postProcessing: true,
    bloom: true,
    grain: true,
    particles: 1.0,
    fogQuality: 'high',
    anisotropy: 8,
    textureSize: 1024,
    chains: 1.0,
    antialias: true,
  },
  ultra: {
    name: 'Ultra',
    pixelRatio: 1.35,
    shadows: true,
    shadowMapSize: 4096,
    maxDynamicLights: 24,
    postProcessing: true,
    bloom: true,
    grain: true,
    particles: 1.6,
    fogQuality: 'ultra',
    anisotropy: 16,
    textureSize: 1024,
    chains: 1.5,
    antialias: true,
  },
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};
