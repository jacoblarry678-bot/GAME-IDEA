/**
 * Lobby / room manager.
 *
 * A lobby is identified by a short code the host reads aloud. Nobody ever
 * types an IP: the host's machine serves the page, so every device on the WiFi
 * already has the address, and the code selects which room on that server you
 * are joining.
 */

import { LOBBY, GAME_MODES, ROLES, MATCH_STATE, NET } from '../shared/constants.js';
import { S2C, ERR } from '../shared/protocol.js';
import { SURVIVORS, CENOBITES } from '../shared/characters.js';
import { Match } from './match.js';

const BOT_FIRST = ['Hollis', 'Renn', 'Perch', 'Cobb', 'Marlow', 'Sable', 'Quill', 'Vane', 'Ashby', 'Doran'];

export class LobbyManager {
  constructor(io) {
    this.io = io;
    this.lobbies = new Map(); // code -> lobby
    this.playerLobby = new Map(); // socketId -> code
    setInterval(() => this.sweep(), 60_000).unref?.();
  }

  makeCode() {
    const A = LOBBY.CODE_ALPHABET;
    for (let attempt = 0; attempt < 500; attempt++) {
      let code = '';
      for (let i = 0; i < LOBBY.CODE_LENGTH; i++) code += A[Math.floor(Math.random() * A.length)];
      if (!this.lobbies.has(code)) return code;
    }
    return 'HELL' + Math.floor(Math.random() * 90 + 10);
  }

  create(socket, name, mode = '1v4') {
    const code = this.makeCode();
    const lobby = {
      code,
      hostId: socket.id,
      mode: GAME_MODES[mode] ? mode : '1v4',
      state: MATCH_STATE.LOBBY,
      players: new Map(),
      match: null,
      loop: null,
      createdAt: Date.now(),
      touchedAt: Date.now(),
      botSeq: 0,
    };
    this.lobbies.set(code, lobby);
    this.addPlayer(lobby, socket, name);
    return lobby;
  }

  join(socket, code, name) {
    const lobby = this.lobbies.get(String(code || '').toUpperCase().trim());
    if (!lobby) return { error: ERR.NO_LOBBY };
    if (lobby.state !== MATCH_STATE.LOBBY) return { error: ERR.IN_PROGRESS };
    if (lobby.players.size >= LOBBY.MAX_PLAYERS) return { error: ERR.LOBBY_FULL };
    this.addPlayer(lobby, socket, name);
    return { lobby };
  }

  addPlayer(lobby, socket, name) {
    const clean = String(name || '').slice(0, 18).trim() || 'Unnamed';
    const taken = new Set([...lobby.players.values()].map((p) => p.characterId));
    const freeSurvivor = SURVIVORS.find((s) => !taken.has(s.id)) || SURVIVORS[0];

    // First player in an empty lobby takes the Cenobite seat by default so a
    // solo host + bots is instantly playable; everyone after is a survivor.
    const wantsCenobite = this.countRole(lobby, ROLES.CENOBITE) < GAME_MODES[lobby.mode].cenobites && lobby.players.size === 0;

    const player = {
      id: socket.id,
      name: clean,
      isBot: false,
      role: wantsCenobite ? ROLES.CENOBITE : ROLES.SURVIVOR,
      characterId: wantsCenobite ? CENOBITES[0].id : freeSurvivor.id,
      ready: false,
      joinedAt: Date.now(),
      ping: 0,
    };
    lobby.players.set(socket.id, player);
    this.playerLobby.set(socket.id, lobby.code);
    socket.join(lobby.code);
    lobby.touchedAt = Date.now();
    return player;
  }

  addBot(lobby, role) {
    if (lobby.players.size >= LOBBY.MAX_PLAYERS) return null;
    const id = `bot_${lobby.code}_${lobby.botSeq++}`;
    const taken = new Set([...lobby.players.values()].map((p) => p.characterId));
    const freeSurvivor = SURVIVORS.find((s) => !taken.has(s.id)) || SURVIVORS[0];
    const isCeno = role === ROLES.CENOBITE;
    const bot = {
      id,
      name: BOT_FIRST[lobby.botSeq % BOT_FIRST.length] + (isCeno ? ' (Cenobite Bot)' : ' (Bot)'),
      isBot: true,
      role: isCeno ? ROLES.CENOBITE : ROLES.SURVIVOR,
      characterId: isCeno ? CENOBITES[0].id : freeSurvivor.id,
      ready: true,
      joinedAt: Date.now(),
      ping: 0,
    };
    lobby.players.set(id, bot);
    return bot;
  }

  removeBot(lobby, id) {
    const p = lobby.players.get(id);
    if (p && p.isBot) lobby.players.delete(id);
  }

  countRole(lobby, role) {
    let n = 0;
    for (const p of lobby.players.values()) if (p.role === role) n++;
    return n;
  }

  leave(socket) {
    const code = this.playerLobby.get(socket.id);
    if (!code) return null;
    const lobby = this.lobbies.get(code);
    this.playerLobby.delete(socket.id);
    if (!lobby) return null;
    lobby.players.delete(socket.id);
    socket.leave(code);

    if (lobby.match) lobby.match.players.delete(socket.id);

    const humans = [...lobby.players.values()].filter((p) => !p.isBot);
    if (!humans.length) {
      this.destroy(code);
      return null;
    }
    if (lobby.hostId === socket.id) {
      lobby.hostId = humans[0].id;
    }
    return lobby;
  }

  destroy(code) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;
    if (lobby.loop) clearInterval(lobby.loop);
    for (const id of lobby.players.keys()) this.playerLobby.delete(id);
    this.lobbies.delete(code);
  }

  sweep() {
    const now = Date.now();
    for (const [code, lobby] of this.lobbies) {
      const humans = [...lobby.players.values()].filter((p) => !p.isBot);
      if (!humans.length || now - lobby.touchedAt > LOBBY.IDLE_TIMEOUT_MS) this.destroy(code);
    }
  }

  lobbyFor(socketId) {
    const code = this.playerLobby.get(socketId);
    return code ? this.lobbies.get(code) : null;
  }

  serialize(lobby) {
    const mode = GAME_MODES[lobby.mode];
    return {
      code: lobby.code,
      hostId: lobby.hostId,
      mode: lobby.mode,
      modeName: mode.name,
      maxPlayers: Math.min(LOBBY.MAX_PLAYERS, mode.cenobites + mode.survivors),
      state: lobby.state,
      slots: {
        cenobites: mode.cenobites,
        survivors: mode.survivors,
        filledCenobites: this.countRole(lobby, ROLES.CENOBITE),
        filledSurvivors: this.countRole(lobby, ROLES.SURVIVOR),
      },
      players: [...lobby.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        characterId: p.characterId,
        ready: p.ready,
        isBot: p.isBot,
        isHost: p.id === lobby.hostId,
        ping: p.ping,
      })),
    };
  }

  broadcast(lobby) {
    if (!lobby) return;
    lobby.touchedAt = Date.now();
    this.io.to(lobby.code).emit(S2C.LOBBY, this.serialize(lobby));
  }

  canStart(lobby) {
    const survivors = this.countRole(lobby, ROLES.SURVIVOR);
    const cenobites = this.countRole(lobby, ROLES.CENOBITE);
    if (survivors < 1 || cenobites < 1) return ERR.NEED_PLAYERS;
    return null;
  }

  startMatch(lobby) {
    const problem = this.canStart(lobby);
    if (problem) return problem;

    lobby.state = MATCH_STATE.STARTING;
    lobby.match = new Match(lobby, this.io);
    lobby.state = MATCH_STATE.ACTIVE;

    this.io.to(lobby.code).emit(S2C.MATCH_START, lobby.match.startPayload());

    const dt = 1 / NET.TICK_HZ;
    let last = Date.now();
    lobby.loop = setInterval(() => {
      const now = Date.now();
      const real = Math.min(0.25, (now - last) / 1000);
      last = now;
      const m = lobby.match;
      if (!m) return;
      try {
        m.tick(real || dt);
        m.flushEvents();
        this.io.to(lobby.code).emit(S2C.SNAPSHOT, m.snapshot());
        if (m.state === MATCH_STATE.ENDED) this.endMatch(lobby);
      } catch (err) {
        console.error('[match] tick error', err);
      }
    }, 1000 / NET.TICK_HZ);
    return null;
  }

  endMatch(lobby) {
    if (lobby.loop) clearInterval(lobby.loop);
    lobby.loop = null;
    setTimeout(() => {
      if (!this.lobbies.has(lobby.code)) return;
      lobby.match = null;
      lobby.state = MATCH_STATE.LOBBY;
      // clear ready flags, keep roles
      for (const p of lobby.players.values()) if (!p.isBot) p.ready = false;
      this.io.to(lobby.code).emit(S2C.RETURN_LOBBY, this.serialize(lobby));
    }, 12_000);
  }
}
