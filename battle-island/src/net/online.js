/**
 * Online sessions: finds a transport (the claude.ai artifact `room`
 * capability, or the self-hosted relay server), lists open games in the
 * shared lobby, and runs the pre-match game room (roster, start).
 */

import { connectShim } from './roomShim.js';
import { PROTO, MAX_HUMANS } from './sync.js';

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
// presence strings must be free of control/format characters
export const cleanName = (s) => String(s || '').replace(/[\p{C}]/gu, '').trim().slice(0, 14) || 'Player';
const code5 = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export class Online {
  constructor() {
    this.kind = null; // 'claude' | 'server' | null
    this.hub = null;
    this.lobby = null;
    this.session = null;
    this.onChange = null;
    this._connecting = null;
  }

  async connect() {
    if (this.kind) return true;
    if (!this._connecting) {
      this._connecting = (async () => {
        if (window.claude && typeof window.claude.use === 'function') {
          try {
            const room = await Promise.race([window.claude.use('room'), new Promise((r) => setTimeout(() => r(null), 12000))]);
            if (room) {
              this.kind = 'claude';
              this.hub = room;
              this.lobby = room;
            }
          } catch {
            /* not available in this view */
          }
        }
        if (!this.kind && /^https?:$/.test(location.protocol)) {
          const url = new URLSearchParams(location.search).get('server') || location.origin;
          const hub = await connectShim(url);
          if (hub) {
            this.kind = 'server';
            this.hub = hub;
            this.lobby = await hub.join('lobby');
          }
        }
        if (this.lobby) this.lobby.onPeers(() => this.onChange?.());
        return !!this.kind;
      })();
    }
    const ok = await this._connecting;
    if (!ok) this._connecting = null;
    return ok;
  }

  openGames() {
    if (!this.lobby) return [];
    return this.lobby.peers()
      .filter((p) => !p.sameTab && p.presence && p.presence.g && p.presence.g.v === PROTO)
      .map((p) => ({ ...p.presence.g }));
  }

  async host(profile, cfg) {
    await this.leave();
    const code = code5();
    const room = await this.hub.join('bi-' + code);
    this.session = new Session(this, room, 'host', code, profile, cfg);
    return this.session;
  }

  async join(code, profile) {
    await this.leave();
    const c = String(code || '').trim().toLowerCase();
    if (!/^[a-z0-9]{5}$/.test(c)) throw new Error('Game codes are 5 letters/numbers.');
    const room = await this.hub.join('bi-' + c);
    this.session = new Session(this, room, 'client', c, profile, null);
    return this.session;
  }

  async leave() {
    const s = this.session;
    this.session = null;
    if (s) await s.close();
  }
}

export class Session {
  constructor(online, room, role, code, profile, cfg) {
    this.online = online;
    this.room = room;
    this.role = role;
    this.code = code;
    this.cfg = cfg;
    this.lastMid = null;
    this.onChange = null;
    this.unsub = room.onPeers(() => {
      if (this.role === 'host') this._announce();
      this.onChange?.();
    });
    this.setProfile(profile);
    if (role === 'host') room.presence({ st: 'lobby', cfg });
    this._announce();
  }

  setProfile(pr) {
    this.profile = pr;
    this.room.presence({ r: this.role === 'host' ? 'h' : 'c', v: PROTO, n: cleanName(pr.name), c: pr.charId, o: pr.outfit, s: pr.skin }).catch(() => {});
  }

  get myPeer() {
    const me = this.room.peers().find((p) => p.sameTab);
    return me ? me.peer : null;
  }

  hostPeer() {
    const h = this.room.peers().find((p) => p.presence && p.presence.r === 'h');
    return h ? h.peer : null;
  }

  hostPresence() {
    const h = this.room.peers().find((p) => p.presence && p.presence.r === 'h');
    return h ? h.presence : null;
  }

  /** Everyone in the room, host first, in join order. */
  players() {
    const list = this.room.peers()
      .filter((p) => p.presence && p.presence.v === PROTO)
      .map((p) => ({ peer: p.peer, me: p.sameTab, host: p.presence.r === 'h', name: p.presence.n || 'Player', charId: p.presence.c || 'colton', outfit: p.presence.o | 0, skin: p.presence.s | 0 }));
    list.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0));
    return list;
  }

  _announce() {
    if (this.role !== 'host') return;
    const hp = this.hostPresence();
    const open = !hp || hp.st !== 'play';
    this.online.lobby.presence({ g: open ? { v: PROTO, code: this.code, n: cleanName(this.profile.name), cfg: this.cfg, cnt: this.players().length } : null }).catch(() => {});
  }

  /** Host: pick the humans for this match and announce it (the bus path comes from the started game). */
  announceStart(game, humans, cfg) {
    const start = {
      mid: Math.random().toString(36).slice(2, 10),
      seed: game.seed,
      cfg,
      bus: [...game.busFrom.toArray(), ...game.busTo.toArray()].map((v) => Math.round(v * 10) / 10),
      humans: humans.map((h) => ({ id: h.id, p: h.peer, n: h.name, c: h.charId, o: h.outfit, s: h.skin })),
    };
    this.room.presence({ st: 'play', start }).catch(() => {});
    this.online.lobby.presence({ g: null }).catch(() => {});
    return start;
  }

  /** Host: back to the room's lobby after a match. */
  backToLobby() {
    this.room.presence({ st: 'lobby', start: null, ss: null, pv: null }).catch(() => {});
    this._announce();
  }

  close() {
    this.unsub?.();
    if (this.role === 'host') this.online.lobby.presence({ g: null }).catch(() => {});
    return this.room.leave().catch(() => {});
  }
}

export { MAX_HUMANS };
