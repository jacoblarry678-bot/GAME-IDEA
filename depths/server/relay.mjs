/**
 * Session relay: invite codes, one host and up to three guests per session.
 * Routes envelopes; never inspects game state. Pure logic, transport-agnostic
 * so it can be unit-tested without sockets.
 */
import { makeCode, normCode, normVersion, versionMismatch, MAX_GUESTS, PROTOCOL } from '../src/net/protocol.js';
import { VERSION } from '../src/version.js';

export class Relay {
  constructor(opts = {}) {
    this.sessions = new Map(); // code -> { code, host, guests: Map(id -> client), created }
    this.nextId = 1;
    this.log = opts.log || (() => {});
  }

  connect(sink) { return { id: `c${this.nextId++}`, send: (o) => sink.send(JSON.stringify(o)), close: sink.close, session: null, role: null, name: '' }; }

  onMessage(cl, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'host') {
      if (cl.session) return;
      let code; do code = makeCode(); while (this.sessions.has(code));
      const s = { code, host: cl, guests: new Map(), created: Date.now(), version: normVersion(m.version) };
      this.sessions.set(code, s);
      cl.session = s; cl.role = 'host'; cl.name = String(m.name || 'Host').slice(0, 24);
      cl.send({ t: 'hosted', code, protocol: PROTOCOL });
      this.log(`session ${code} hosted by ${cl.name}`);
      return;
    }
    if (m.t === 'join') {
      const s = this.sessions.get(normCode(m.code));
      if (!s) { cl.send({ t: 'error', msg: 'No session with that invite code.' }); return; }
      if (s.guests.size >= MAX_GUESTS) { cl.send({ t: 'error', msg: 'That session is full (four players).' }); return; }
      if (normVersion(m.version) !== s.version) { cl.send({ t: 'error', msg: versionMismatch(s.version, m.version) }); return; }
      cl.session = s; cl.role = 'guest'; cl.name = String(m.name || 'Guest').slice(0, 24);
      s.guests.set(cl.id, cl);
      cl.send({ t: 'joined', id: cl.id, code: s.code, host: s.host.name });
      s.host.send({ t: 'peer', id: cl.id, name: cl.name, slot: String(m.slot || ''), ident: String(m.ident || cl.id).slice(0, 40), version: normVersion(m.version) });
      this.log(`${cl.name} joined ${s.code}`);
      return;
    }
    const s = cl.session;
    if (!s) return;
    if (m.t === 'to') {
      if (cl.role === 'host') { const g = s.guests.get(m.id); if (g) g.send({ t: 'from', id: 'host', d: m.d }); }
      else s.host.send({ t: 'from', id: cl.id, d: m.d });
      return;
    }
    if (m.t === 'all' && cl.role === 'host') { for (const g of s.guests.values()) g.send({ t: 'from', id: 'host', d: m.d }); }
  }

  disconnect(cl) {
    const s = cl.session;
    if (!s) return;
    cl.session = null;
    if (cl.role === 'host') {
      for (const g of s.guests.values()) { g.session = null; g.send({ t: 'hostLeft' }); }
      this.sessions.delete(s.code);
      this.log(`session ${s.code} ended (host left)`);
    } else {
      s.guests.delete(cl.id);
      s.host.send({ t: 'left', id: cl.id });
      this.log(`${cl.name} left ${s.code}`);
    }
  }

  status() { return { relay: true, protocol: PROTOCOL, version: VERSION, sessions: this.sessions.size, players: [...this.sessions.values()].reduce((n, s) => n + 1 + s.guests.size, 0) }; }
}
