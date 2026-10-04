/**
 * Browser connection to an Ashline server: WebSocket, message dispatch,
 * round-trip time and server clock estimation.
 */
import { PROTOCOL_VERSION, DEFAULT_PORT } from './protocol.js';

export class NetClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.listeners = new Map();
    this.rtt = null;
    this.offset = null; // server time − local time (s)
    this.closed = false;
    this.lastMsgAt = 0;
    this.last = {};
  }

  /** Resolve with the next (or the latest already received) message of `type` matching `pred`. */
  waitFor(type, pred = () => true, timeoutMs = 10000) {
    if (this.last[type] && pred(this.last[type])) return Promise.resolve(this.last[type]);
    return new Promise((resolve, reject) => {
      const off = this.on(type, (m) => { if (pred(m)) { off(); offC(); clearTimeout(t); resolve(m); } });
      const offC = this.on('close', () => { off(); offC(); clearTimeout(t); reject(new Error('Disconnected')); });
      const t = setTimeout(() => { off(); offC(); reject(new Error(`Timed out waiting for ${type}`)); }, timeoutMs);
    });
  }

  /** Suggested server address for this page. */
  static defaultUrl() {
    const l = typeof location !== 'undefined' ? location : null;
    if (l && /^https?:$/.test(l.protocol) && l.port && l.port !== '5180' && l.port !== '4180' && !/claude\.ai$/.test(l.hostname)) {
      return `${l.protocol === 'https:' ? 'wss' : 'ws'}://${l.host}/ws`;
    }
    return `ws://${l && l.hostname && !/claude\.ai$/.test(l.hostname) ? l.hostname : 'localhost'}:${DEFAULT_PORT}/ws`;
  }

  /** Normalize what the user typed: host, host:port, http(s)://… or ws(s)://… */
  static normalize(input) {
    let s = String(input || '').trim();
    if (!s) return NetClient.defaultUrl();
    s = s.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    if (!/^wss?:\/\//.test(s)) s = 'ws://' + s;
    const u = new URL(s);
    if (!u.port && u.protocol === 'ws:') u.port = String(DEFAULT_PORT);
    if (u.pathname === '/' || !u.pathname) u.pathname = '/ws';
    return u.toString();
  }

  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); return () => this.listeners.get(type).delete(fn); }
  emit(type, msg) { for (const fn of [...(this.listeners.get(type) || [])]) fn(msg); }

  /** Open the socket and say hello. Resolves with the welcome message; rejects with a readable reason. */
  connect(hello, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (ok, v) => { if (settled) return; settled = true; clearTimeout(timer); ok ? resolve(v) : reject(new Error(v)); };
      const timer = setTimeout(() => { done(false, `No answer from ${this.url} — is the Ashline server running and reachable?`); this.close(); }, timeoutMs);
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { done(false, `Can't open ${this.url}: ${e.message}`); return; }
      this.ws = ws;
      ws.onopen = () => this.send({ t: 'hello', v: PROTOCOL_VERSION, ...hello });
      ws.onerror = () => done(false, `Couldn't connect to ${this.url}. Start the server with "npm run server" and check the address. (Pages hosted on claude.ai can't reach local servers.)`);
      ws.onclose = () => { this.closed = true; done(false, 'Connection closed by the server.'); this.emit('close', {}); };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        this.lastMsgAt = performance.now();
        if (m.t === 'welcome') done(true, m);
        else if (m.t === 'reject') done(false, m.reason);
        if (m.t === 'snap') this.clock(m.time);
        if (m.t === 'pong') {
          this.rtt = (performance.now() - m.ct) / 1000;
          this.clock(m.st + this.rtt / 2, true);
        }
        this.last[m.t] = m;
        this.emit(m.t, m);
      };
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ct: performance.now(), rtt: this.rtt === null ? undefined : Math.round(this.rtt * 1000) }), 1000);
    });
  }

  /** Track the server clock: keep the estimate that implies the least network delay. */
  clock(serverTime, exact = false) {
    const sample = serverTime - performance.now() / 1000;
    if (this.offset === null || exact && Math.abs(sample - this.offset) > 0.25) this.offset = sample;
    else if (sample > this.offset) this.offset += (sample - this.offset) * 0.5;
    else this.offset += (sample - this.offset) * 0.02;
  }

  serverNow() { return performance.now() / 1000 + (this.offset ?? 0); }

  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  close() {
    clearInterval(this.pingTimer);
    if (this.ws && this.ws.readyState <= 1) { try { this.send({ t: 'leave' }); this.ws.close(); } catch { /* ignore */ } }
    this.closed = true;
  }
}
