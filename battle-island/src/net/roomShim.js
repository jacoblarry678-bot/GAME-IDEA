/**
 * A stand-in for the claude.ai artifact `room` capability, backed by the
 * self-hosted relay server (battle-island/server). It mirrors the same
 * surface — join(name) → { emit, on, presence, peers, onPeers, connected,
 * onConnection, leave } — so the game's network code is written once.
 */
import { io } from 'socket.io-client';

const MAX = 4096;
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v ?? null)).length;

class ShimRoom {
  constructor(hub, name) {
    this.hub = hub;
    this.name = name;
    this.map = new Map(); // peer -> {presence, updatedAt}
    this.topicFns = new Map();
    this.peerFns = new Set();
    this.pending = { joined: new Map(), left: new Map(), updated: new Map() };
    this.snapshot = Object.freeze([]);
    this.mine = {};
    this._sendT = null;
  }

  _peerObj(peer, presence, updatedAt) {
    const me = peer === this.hub.sock.id;
    return Object.freeze({ peer, by: null, isMe: me, sameTab: me, kind: 'viewer', guest: false, presence: Object.freeze({ ...presence }), updatedAt });
  }

  _set(peer, presence, kind) {
    const p = this._peerObj(peer, presence, Date.now());
    const existed = this.map.has(peer);
    this.map.set(peer, p);
    this.pending[existed && kind !== 'joined' ? 'updated' : 'joined'].set(peer, p);
    this._flush();
  }

  _remove(peer) {
    const p = this.map.get(peer);
    if (!p) return;
    this.map.delete(peer);
    this.pending.left.set(peer, p);
    this._flush();
  }

  _flush() {
    if (this._flushQ) return;
    this._flushQ = true;
    queueMicrotask(() => {
      this._flushQ = false;
      this.snapshot = Object.freeze([...this.map.values()]);
      const ch = { peers: this.snapshot, joined: [...this.pending.joined.values()], left: [...this.pending.left.values()], updated: [...this.pending.updated.values()] };
      this.pending = { joined: new Map(), left: new Map(), updated: new Map() };
      for (const fn of this.peerFns) fn(ch);
    });
  }

  emit(topic, data) {
    if (bytes(data) > MAX) return Promise.reject({ code: 'invalid_argument', message: 'data over 4 KiB' });
    if (this.hub.sock.connected) this.hub.sock.emit('emit', { room: this.name, topic, data });
    return Promise.resolve();
  }

  on(topic, fn) {
    if (!this.topicFns.has(topic)) this.topicFns.set(topic, new Set());
    this.topicFns.get(topic).add(fn);
    return () => this.topicFns.get(topic)?.delete(fn);
  }

  presence(patch) {
    const next = { ...this.mine };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    if (bytes(next) > MAX) return Promise.reject({ code: 'invalid_argument', message: 'presence over 4 KiB' });
    this.mine = next;
    this._set(this.hub.sock.id, next, 'updated');
    // coalesced like the platform (~30/s)
    this._dirty = { ...(this._dirty || {}), ...patch };
    if (!this._sendT) {
      this._sendT = setTimeout(() => {
        this._sendT = null;
        const p = this._dirty;
        this._dirty = null;
        if (p && this.hub.sock.connected) this.hub.sock.emit('presence', { room: this.name, patch: p });
      }, 33);
    }
    return Promise.resolve();
  }

  peers() {
    return this.snapshot;
  }

  onPeers(fn) {
    this.peerFns.add(fn);
    queueMicrotask(() => fn({ peers: this.snapshot, joined: this.snapshot, left: [], updated: [] }));
    return () => this.peerFns.delete(fn);
  }

  connected() {
    return this.hub.sock.connected;
  }

  onConnection(fn) {
    return this.hub.onConnection(fn);
  }

  leave() {
    this.hub.sock.emit('leave', this.name);
    this.hub.rooms.delete(this.name);
    this.peerFns.clear();
    this.topicFns.clear();
    return Promise.resolve();
  }
}

class ShimHub {
  constructor(sock) {
    this.sock = sock;
    this.rooms = new Map();
    this.connFns = new Set();
    sock.on('peer', ({ room, peer, presence, left }) => {
      const r = this.rooms.get(room);
      if (!r || peer === sock.id) return;
      if (left) r._remove(peer);
      else r._set(peer, presence || {});
    });
    sock.on('msg', ({ room, peer, topic, data }) => {
      const r = this.rooms.get(room);
      const fns = r && r.topicFns.get(topic);
      if (!fns) return;
      const me = peer === sock.id;
      const m = Object.freeze({ peer, by: null, isMe: me, sameTab: me, kind: 'viewer', guest: false, topic, data });
      for (const fn of fns) fn(m);
    });
    const conn = (v) => { for (const fn of this.connFns) fn(v); };
    sock.on('connect', () => {
      conn(true);
      // re-join after reconnects
      for (const r of this.rooms.values()) this._join(r);
    });
    sock.on('disconnect', () => conn(false));
  }

  onConnection(fn) {
    this.connFns.add(fn);
    queueMicrotask(() => fn(this.sock.connected));
    return () => this.connFns.delete(fn);
  }

  _join(r) {
    return new Promise((res, rej) => {
      this.sock.timeout(10000).emit('join', r.name, (err, ack) => {
        if (err || !ack || ack.error) return rej({ code: ack?.error || 'upstream_error', message: 'join failed' });
        for (const { peer, presence } of ack.peers) r._set(peer, peer === this.sock.id ? r.mine : presence, 'joined');
        if (Object.keys(r.mine).length) this.sock.emit('presence', { room: r.name, patch: r.mine });
        res(r);
      });
    });
  }

  join(name) {
    if (this.rooms.has(name)) return Promise.resolve(this.rooms.get(name));
    const r = new ShimRoom(this, name);
    this.rooms.set(name, r);
    return this._join(r);
  }
}

/** Connects to the relay server; resolves a hub or null if unreachable. */
export function connectShim(url, timeout = 3500) {
  return new Promise((resolve) => {
    let done = false;
    const sock = io(url, { transports: ['websocket', 'polling'], reconnectionDelay: 800, timeout });
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      sock.close();
      resolve(null);
    }, timeout);
    sock.once('connect', () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(new ShimHub(sock));
    });
  });
}
