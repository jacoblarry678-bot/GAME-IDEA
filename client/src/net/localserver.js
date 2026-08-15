/**
 * Offline mode: the authoritative server, running in the browser.
 *
 * The whole point of the architecture is that `server/match.js` is pure
 * JavaScript with no Node dependencies — it only ever touches socket.io through
 * a tiny surface (`io.to(room).emit` and `io.sockets.sockets.get(id).emit`).
 * So we can hand it a fake `io`, tick it on a timer, and run a complete match
 * with real bots entirely client-side.
 *
 * This is what makes a single shareable HTML file possible. Multiplayer still
 * needs the real Node server; this is the solo-versus-bots path.
 */

import { NetClient } from './client.js';
import { Match } from '../../../server/match.js';
import { S2C } from '../../../shared/protocol.js';
import { NET, GAME_MODES, ROLES, MATCH_STATE, LOBBY } from '../../../shared/constants.js';
import { SURVIVORS, CENOBITES } from '../../../shared/characters.js';

const BOT_NAMES = ['Hollis', 'Renn', 'Perch', 'Cobb', 'Marlow', 'Sable', 'Quill', 'Vane'];

export class LocalNet extends NetClient {
  constructor() {
    super();
    this.local = true;
    this.id = 'local_player';
    this.connected = true;
    this.ping = 0;
    this.match = null;
    this.loop = null;
    this.botSeq = 0;

    // the minimum of socket.io that Match actually uses
    const deliver = (ev, data) => this._deliver(ev, data);
    this.io = {
      to: () => ({ emit: deliver }),
      sockets: { sockets: new Map([[this.id, { emit: deliver }]]) },
    };
  }

  _deliver(ev, data) {
    switch (ev) {
      case S2C.SNAPSHOT: {
        data.clientTime = performance.now();
        this.snapshots.push(data);
        if (this.snapshots.length > 40) this.snapshots.shift();
        this.emitLocal('snapshot', data);
        break;
      }
      case S2C.EVENT:
        for (const e of data) this.emitLocal('event', e);
        break;
      case S2C.MATCH_START:
        this.snapshots = [];
        this.emitLocal('matchStart', data);
        break;
      case S2C.MATCH_END:
        this.stopLoop();
        this.emitLocal('matchEnd', data);
        // drop back to the lobby the way the real server does
        setTimeout(() => {
          if (!this.lobbyState) return;
          this.lobbyState.state = MATCH_STATE.LOBBY;
          this.match = null;
          this.emitLocal('returnLobby', this.serializeLobby());
        }, 9000);
        break;
      case S2C.CORRECTION:
        this.emitLocal('correction', data);
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------- lifecycle

  async connect() {
    const welcome = {
      id: this.id,
      protocol: 0,
      survivors: SURVIVORS,
      cenobites: CENOBITES,
      modes: GAME_MODES,
      lan: [],
      offline: true,
    };
    this.welcome = welcome;
    // let listeners attach first
    setTimeout(() => this.emitLocal('welcome', welcome), 0);
    return welcome;
  }

  hello() {}
  chat(text) {
    this.emitLocal('chat', { from: this.playerName || 'You', text, t: Date.now() });
  }

  host(name, mode = '1v4') {
    this.playerName = name || 'You';
    this.lobbyState = {
      code: 'OFFLINE',
      hostId: this.id,
      mode: GAME_MODES[mode] ? mode : '1v4',
      state: MATCH_STATE.LOBBY,
      players: new Map(),
    };
    this.lobbyState.players.set(this.id, {
      id: this.id,
      name: this.playerName,
      isBot: false,
      role: ROLES.CENOBITE,
      characterId: CENOBITES[0].id,
      ready: true,
    });
    this.pushLobby();
  }

  join() {
    this.emitLocal('error', {
      message: 'Offline mode is solo versus bots. Run the game locally to play with other people.',
    });
  }

  leave() {
    this.stopLoop();
    this.match = null;
    this.lobbyState = null;
    this.lobby = null;
  }

  setRole(role) {
    const p = this.lobbyState && this.lobbyState.players.get(this.id);
    if (!p) return;
    p.role = role === ROLES.CENOBITE ? ROLES.CENOBITE : ROLES.SURVIVOR;
    p.characterId = p.role === ROLES.CENOBITE ? CENOBITES[0].id : this.freeSurvivor();
    this.pushLobby();
  }

  setCharacter(characterId) {
    const p = this.lobbyState && this.lobbyState.players.get(this.id);
    if (!p) return;
    if (p.role === ROLES.CENOBITE) {
      const c = CENOBITES.find((x) => x.id === characterId);
      if (c && c.available) p.characterId = c.id;
    } else {
      const s = SURVIVORS.find((x) => x.id === characterId);
      if (!s) return;
      const taken = [...this.lobbyState.players.values()].some((o) => o.id !== this.id && o.characterId === s.id);
      if (taken) return this.emitLocal('error', { message: `${s.name} is already chosen.` });
      p.characterId = s.id;
    }
    this.pushLobby();
  }

  setMode(mode) {
    if (!this.lobbyState || !GAME_MODES[mode]) return;
    this.lobbyState.mode = mode;
    this.pushLobby();
  }

  setReady() {}

  freeSurvivor() {
    const taken = new Set([...this.lobbyState.players.values()].map((p) => p.characterId));
    const s = SURVIVORS.find((x) => !taken.has(x.id));
    return (s || SURVIVORS[0]).id;
  }

  addBot(role) {
    if (!this.lobbyState) return;
    if (this.lobbyState.players.size >= LOBBY.MAX_PLAYERS) return;
    const isCeno = role === ROLES.CENOBITE;
    const id = `bot_${this.botSeq++}`;
    this.lobbyState.players.set(id, {
      id,
      name: BOT_NAMES[this.botSeq % BOT_NAMES.length] + (isCeno ? ' (Cenobite Bot)' : ' (Bot)'),
      isBot: true,
      role: isCeno ? ROLES.CENOBITE : ROLES.SURVIVOR,
      characterId: isCeno ? CENOBITES[0].id : this.freeSurvivor(),
      ready: true,
    });
    this.pushLobby();
  }

  removeBot(id) {
    if (!this.lobbyState) return;
    const p = this.lobbyState.players.get(id);
    if (p && p.isBot) this.lobbyState.players.delete(id);
    this.pushLobby();
  }

  kick(id) {
    this.removeBot(id);
  }

  serializeLobby() {
    const l = this.lobbyState;
    const mode = GAME_MODES[l.mode];
    return {
      code: 'OFFLINE',
      hostId: this.id,
      mode: l.mode,
      modeName: mode.name,
      maxPlayers: Math.min(LOBBY.MAX_PLAYERS, mode.cenobites + mode.survivors),
      state: l.state,
      offline: true,
      slots: {
        cenobites: mode.cenobites,
        survivors: mode.survivors,
        filledCenobites: [...l.players.values()].filter((p) => p.role === ROLES.CENOBITE).length,
        filledSurvivors: [...l.players.values()].filter((p) => p.role === ROLES.SURVIVOR).length,
      },
      players: [...l.players.values()].map((p) => ({
        id: p.id, name: p.name, role: p.role, characterId: p.characterId,
        ready: p.ready, isBot: p.isBot, isHost: p.id === this.id, ping: 0,
      })),
    };
  }

  pushLobby() {
    if (!this.lobbyState) return;
    this.lobby = this.serializeLobby();
    this.emitLocal('lobby', this.lobby);
  }

  start() {
    if (!this.lobbyState) return;
    const players = [...this.lobbyState.players.values()];
    if (!players.some((p) => p.role === ROLES.SURVIVOR) || !players.some((p) => p.role === ROLES.CENOBITE)) {
      return this.emitLocal('error', { message: 'You need at least one participant on each side.' });
    }

    // Match wants a lobby-shaped object; give it exactly that.
    this.match = new Match({ code: 'OFFLINE', mode: this.lobbyState.mode, players: this.lobbyState.players }, this.io);
    this.lobbyState.state = MATCH_STATE.ACTIVE;
    this._deliver(S2C.MATCH_START, this.match.startPayload());

    let last = performance.now();
    this.loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const m = this.match;
      if (!m) return;
      try {
        m.tick(dt);
        m.flushEvents();
        this._deliver(S2C.SNAPSHOT, m.snapshot());
      } catch (err) {
        console.error('[offline] tick error', err);
      }
    }, 1000 / NET.TICK_HZ);
  }

  stopLoop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  // --------------------------------------------------------------- in-match

  sendInput(state) {
    if (!this.match) return;
    const now = performance.now();
    if (now - this.lastInputSent < 1000 / NET.INPUT_HZ) return;
    this.lastInputSent = now;
    this.match.applyInput(this.id, { seq: ++this.inputSeq, ...state });
  }

  action(type, data = {}) {
    const m = this.match;
    if (!m) return;
    switch (type) {
      case 'interact_start': m.startInteraction(this.id, data.target); break;
      case 'interact_cancel': m.cancelInteraction(this.id); break;
      case 'attack': m.attack(this.id); break;
      case 'execute': m.execute(this.id); break;
      case 'ability': m.useAbility(this.id, data.ability, data); break;
      case 'gateway_enter': m.enterGateway(this.id); break;
      case 'vault': m.vault(this.id, data.vault); break;
      case 'unhide': m.unhide(this.id); break;
      case 'flashlight': m.toggleFlashlight(this.id); break;
      case 'use_item': m.useItem(this.id, data.item); break;
      case 'active_perk': m.useActivePerk(this.id); break;
      case 'box_rotate': m.rotateBox(this.id, data.segment, data.dir); break;
      case 'box_submit': m.submitBox(this.id); break;
      case 'drop': m.dropCarried(m.players.get(this.id) || {}); break;
      default: break;
    }
  }

  debug(cmd, args = {}) {
    if (this.match) this.match.debugCommand(this.id, cmd, args);
  }

  disconnect() {
    this.stopLoop();
  }
}
