/**
 * WebSocket transport to the relay. In the browser it uses the page's own
 * origin (/ws); tools and tests can pass a URL and a WebSocket class.
 */
export function connectRelay({ url = null, WS = null, onClose = null } = {}) {
  const Impl = WS || globalThis.WebSocket;
  const u = url || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const ws = new Impl(u);
  const queue = [];
  const tr = {
    onMessage: () => {},
    send(o) { const s = JSON.stringify(o); if (ws.readyState === 1) ws.send(s); else queue.push(s); },
    close() { try { ws.close(); } catch { /* already closed */ } },
    get open() { return ws.readyState === 1; },
  };
  const onOpen = () => { while (queue.length) ws.send(queue.shift()); };
  const onMsg = (ev) => { let m; try { m = JSON.parse(typeof ev === 'string' ? ev : ev.data !== undefined ? ev.data : String(ev)); } catch { return; } tr.onMessage(m); };
  if (ws.on) { ws.on('open', onOpen); ws.on('message', (d) => onMsg(d.toString())); ws.on('close', () => onClose && onClose()); ws.on('error', () => onClose && onClose()); }
  else { ws.onopen = onOpen; ws.onmessage = onMsg; ws.onclose = () => onClose && onClose(); ws.onerror = () => {}; }
  return tr;
}
