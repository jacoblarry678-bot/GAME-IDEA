/**
 * Wire protocol. Both sides import these names so a typo is a build error
 * rather than a silent dropped packet.
 *
 * AUTHORITY MODEL
 * ---------------
 * The server is authoritative over everything that decides a match:
 * health, damage, objectives, doors, item ownership, ability legality,
 * cooldowns, the match clock and the win condition.
 *
 * Movement is client-reported and server-validated. Each client simulates its
 * own character (so input feels instant on any LAN), reports position at
 * INPUT_HZ, and the server rejects anything that moved faster than the role's
 * max speed or ended inside solid geometry — snapping the client back with a
 * CORRECTION. This is the same trade-off DbD-likes make: it keeps a chase
 * responsive over consumer WiFi while still making the cheats that matter
 * (infinite health, free objectives, teleporting through walls) impossible.
 */

export const C2S = {
  HELLO: 'c:hello',
  HOST: 'c:host',
  JOIN: 'c:join',
  LEAVE: 'c:leave',
  SET_ROLE: 'c:setRole',
  SET_CHARACTER: 'c:setCharacter',
  SET_READY: 'c:setReady',
  SET_MODE: 'c:setMode',
  ADD_BOT: 'c:addBot',
  REMOVE_BOT: 'c:removeBot',
  KICK: 'c:kick',
  START: 'c:start',
  CHAT: 'c:chat',
  INPUT: 'c:input',
  ACTION: 'c:action',
  PING: 'c:ping',
  DEBUG: 'c:debug',
};

export const S2C = {
  WELCOME: 's:welcome',
  LOBBY: 's:lobby',
  ERROR: 's:error',
  CHAT: 's:chat',
  MATCH_START: 's:matchStart',
  SNAPSHOT: 's:snapshot',
  EVENT: 's:event',
  CORRECTION: 's:correction',
  MATCH_END: 's:matchEnd',
  RETURN_LOBBY: 's:returnLobby',
  PONG: 's:pong',
};

/** One-off gameplay events broadcast to clients for VFX/SFX/HUD reactions. */
export const EV = {
  ABILITY_CAST: 'ability_cast',
  CHAIN_SPAWN: 'chain_spawn',
  CHAIN_HIT: 'chain_hit',
  CHAIN_END: 'chain_end',
  TRAP_PLACED: 'trap_placed',
  TRAP_TRIGGERED: 'trap_triggered',
  TRAP_REMOVED: 'trap_removed',
  GATEWAY_OPEN: 'gateway_open',
  GATEWAY_USED: 'gateway_used',
  PAIN_SENSE: 'pain_sense',
  MELEE_SWING: 'melee_swing',
  DAMAGE: 'damage',
  DOWNED: 'downed',
  DEATH: 'death',
  EXECUTION_START: 'execution_start',
  EXECUTION_END: 'execution_end',
  REVIVED: 'revived',
  HEALED: 'healed',
  ESCAPED: 'escaped',
  DOOR: 'door',
  DOOR_BREAK: 'door_break',
  VAULT: 'vault',
  HIDE_ENTER: 'hide_enter',
  HIDE_EXIT: 'hide_exit',
  ITEM_PICKUP: 'item_pickup',
  ITEM_DROP: 'item_drop',
  CONTAINER_SEARCHED: 'container_searched',
  SEAL_PROGRESS: 'seal_progress',
  SEAL_BROKEN: 'seal_broken',
  RELIC_DELIVERED: 'relic_delivered',
  PIECE_DELIVERED: 'piece_delivered',
  BOX_ASSEMBLED: 'box_assembled',
  BOX_INTERACT: 'box_interact',
  BOX_ROTATE: 'box_rotate',
  BOX_SOLVED: 'box_solved',
  BOX_FAILED: 'box_failed',
  GATE_PROGRESS: 'gate_progress',
  GATE_OPEN: 'gate_open',
  HORROR: 'horror',
  OBJECTIVE_UPDATE: 'objective_update',
  SOUND: 'sound',
  PHASE: 'phase',
  WARD_PLACED: 'ward_placed',
  PERK_ACTIVE: 'perk_active',
  LIGHTS: 'lights',
};

/** Player action verbs sent over C2S.ACTION. */
export const ACT = {
  INTERACT_START: 'interact_start',
  INTERACT_CANCEL: 'interact_cancel',
  ATTACK: 'attack',
  ABILITY: 'ability',
  EXECUTE: 'execute',
  VAULT: 'vault',
  HIDE: 'hide',
  UNHIDE: 'unhide',
  DROP: 'drop',
  USE_ITEM: 'use_item',
  FLASHLIGHT: 'flashlight',
  BOX_ROTATE: 'box_rotate',
  BOX_SUBMIT: 'box_submit',
  ACTIVE_PERK: 'active_perk',
  SELF_HEAL: 'self_heal',
  GATEWAY_ENTER: 'gateway_enter',
  LIFT: 'lift',
};

export const ERR = {
  NO_LOBBY: 'That code does not open anything.',
  LOBBY_FULL: 'The lobby is full.',
  IN_PROGRESS: 'That match has already begun.',
  BAD_VERSION: 'Version mismatch — reload the page.',
  NOT_HOST: 'Only the host can do that.',
  NEED_PLAYERS: 'You need at least one participant on each side.',
  NAME_REQUIRED: 'Enter a name first.',
};
