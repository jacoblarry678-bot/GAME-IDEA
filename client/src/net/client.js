/**
 * Socket.IO client wrapper.
 *
 * Owns the connection, the lobby handshake and the snapshot buffer. Remote
 * entities are rendered INTERP_DELAY_MS in the past and interpolated between
 * the two snapshots that bracket that time, which is what makes other players
 * move smoothly over a noisy home WiFi link.
 */

import { io } from 'socket.io-client';
import { C2S, S2C } from '../../../shared/protocol.js';
import { NET, PROTOCOL_VERSION } from '../../../shared/constants.js';

export class NetClient {
  constructor() {
    this.socket = null;
    this.id = null;
    this.connected = false;
    this.lobby = null;
    this.handlers = new Map();
    this.snapshots = [];
    this.serverTimeOffset = 0;
    this.ping = 0;
    this.lastPingAt = 0;
    this.welcome = null;
    this.inputSeq = 0;
    this.lastInputSent = 0;
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event).delete(fn);
  }

  emitLocal(event, data) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (e) {
        console.error(`[net] handler for ${event} threw`, e);
      }
    }
  }

  connect() {
    if (this.socket) return Promise.resolve();
    return new Promise((resolve, reject) => {
      // same-origin: in dev Vite proxies /socket.io to the game server, in
      // production the game server serves the page itself. Either way nobody
      // ever types an IP.
      this.socket = io({ transports: ['websocket', 'polling'], reconnectionAttempts: 6 });
      const t = setTimeout(() => reject(new Error('Could not reach the game server.')), 12000);

      this.socket.on('connect', () => {
        this.connected = true;
        this.id = this.socket.id;
      });
      this.socket.on(S2C.WELCOME, (data) => {
        clearTimeout(t);
        this.welcome = data;
        this.id = data.id;
        if (data.protocol !== PROTOCOL_VERSION) {
          this.emitLocal('error', { message: 'Version mismatch — reload the page.' });
        }
        this.emitLocal('welcome', data);
        resolve(data);
      });
      this.socket.on('connect_error', (e) => {
        clearTimeout(t);
        this.emitLocal('error', { message: 'Could not reach the game server. Is it running?' });
        reject(e);
      });
      this.socket.on('disconnect', () => {
        this.connected = false;
        this.emitLocal('disconnect', {});
      });

      this.socket.on(S2C.LOBBY, (d) => {
        this.lobby = d;
        this.emitLocal('lobby', d);
      });
      this.socket.on(S2C.ERROR, (d) => this.emitLocal('error', d));
      this.socket.on(S2C.CHAT, (d) => this.emitLocal('chat', d));
      this.socket.on(S2C.MATCH_START, (d) => {
        this.snapshots = [];
        this.emitLocal('matchStart', d);
      });
      this.socket.on(S2C.SNAPSHOT, (d) => {
        d.clientTime = performance.now();
        this.snapshots.push(d);
        if (this.snapshots.length > 40) this.snapshots.shift();
        this.emitLocal('snapshot', d);
      });
      this.socket.on(S2C.EVENT, (list) => {
        for (const e of list) this.emitLocal('event', e);
      });
      this.socket.on(S2C.CORRECTION, (d) => this.emitLocal('correction', d));
      this.socket.on(S2C.MATCH_END, (d) => this.emitLocal('matchEnd', d));
      this.socket.on(S2C.RETURN_LOBBY, (d) => {
        this.lobby = d;
        this.emitLocal('returnLobby', d);
      });
      this.socket.on(S2C.PONG, (t0) => {
        this.ping = Math.round(performance.now() - t0);
      });

      this._pingTimer = setInterval(() => {
        if (this.connected) this.socket.emit(C2S.PING, performance.now());
      }, 2000);
    });
  }

  // ------------------------------------------------------------ lobby API

  hello(name) {
    this.socket.emit(C2S.HELLO, { name, protocol: PROTOCOL_VERSION });
  }
  host(name, mode) {
    this.socket.emit(C2S.HOST, { name, mode });
  }
  join(code, name) {
    this.socket.emit(C2S.JOIN, { code, name });
  }
  leave() {
    this.socket.emit(C2S.LEAVE);
    this.lobby = null;
  }
  setRole(role) {
    this.socket.emit(C2S.SET_ROLE, { role });
  }
  setCharacter(characterId) {
    this.socket.emit(C2S.SET_CHARACTER, { characterId });
  }
  setReady(ready) {
    this.socket.emit(C2S.SET_READY, { ready });
  }
  setMode(mode) {
    this.socket.emit(C2S.SET_MODE, { mode });
  }
  addBot(role) {
    this.socket.emit(C2S.ADD_BOT, { role });
  }
  removeBot(id) {
    this.socket.emit(C2S.REMOVE_BOT, { id });
  }
  kick(id) {
    this.socket.emit(C2S.KICK, { id });
  }
  start() {
    this.socket.emit(C2S.START);
  }
  chat(text) {
    this.socket.emit(C2S.CHAT, { text });
  }
  debug(cmd, args = {}) {
    this.socket.emit(C2S.DEBUG, { cmd, ...args });
  }

  // ------------------------------------------------------------ in-match

  sendInput(state) {
    const now = performance.now();
    if (now - this.lastInputSent < 1000 / NET.INPUT_HZ) return;
    this.lastInputSent = now;
    this.socket.emit(C2S.INPUT, { seq: ++this.inputSeq, ...state });
  }

  action(type, data = {}) {
    this.socket.emit(C2S.ACTION, { type, ...data });
  }

  /**
   * Interpolated view of the world INTERP_DELAY_MS in the past.
   * @returns {{players: Map<string,object>, raw: object}|null}
   */
  interpolated() {
    const n = this.snapshots.length;
    if (n === 0) return null;
    if (n === 1) return { players: this.indexPlayers(this.snapshots[0]), raw: this.snapshots[0], alpha: 0 };

    const target = performance.now() - NET.INTERP_DELAY_MS;
    let a = this.snapshots[0];
    let b = this.snapshots[n - 1];
    for (let i = n - 1; i > 0; i--) {
      if (this.snapshots[i - 1].clientTime <= target) {
        a = this.snapshots[i - 1];
        b = this.snapshots[i];
        break;
      }
    }
    const span = b.clientTime - a.clientTime;
    const alpha = span > 0 ? Math.max(0, Math.min(1, (target - a.clientTime) / span)) : 1;

    const pa = this.indexPlayers(a);
    const pb = this.indexPlayers(b);
    const out = new Map();
    for (const [id, p2] of pb) {
      const p1 = pa.get(id);
      if (!p1) {
        out.set(id, p2);
        continue;
      }
      out.set(id, {
        ...p2,
        x: p1.x + (p2.x - p1.x) * alpha,
        y: p1.y + (p2.y - p1.y) * alpha,
        z: p1.z + (p2.z - p1.z) * alpha,
        r: lerpAngle(p1.r, p2.r, alpha),
        p: p1.p + (p2.p - p1.p) * alpha,
        sf: p1.sf + (p2.sf - p1.sf) * alpha,
      });
    }
    return { players: out, raw: b, prev: a, alpha };
  }

  indexPlayers(snap) {
    if (snap.__index) return snap.__index;
    const m = new Map();
    for (const p of snap.players) m.set(p.i, p);
    snap.__index = m;
    return m;
  }

  /** Most recent authoritative snapshot (used for own state and objectives). */
  latest() {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  disconnect() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this.socket) this.socket.disconnect();
    this.socket = null;
    this.connected = false;
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const net = new NetClient();
