#!/usr/bin/env node
/**
 * Depths of the Unseen self-hosted server: serves the built game (dist/)
 * and runs the co-op relay on a WebSocket at /ws on the same port. The host
 * player's browser runs the authoritative simulation; this process only
 * routes messages between the host and up to three guests per invite code.
 *
 * Usage: node server/server.mjs [--port 4194] [--quiet]
 * Then open http://<this-machine>:<port>/ — New Campaign → Host, or Join Game.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Relay } from './relay.mjs';
import { DEFAULT_PORT } from '../src/net/protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function startServer(opts = {}) {
  const log = opts.quiet ? () => {} : (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  const relay = new Relay({ log });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/status') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(relay.status())); return; }
    serveStatic(url.pathname, res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4 * 1024 * 1024 });
  wss.on('connection', (ws) => {
    ws._socket?.setNoDelay?.(true);
    const cl = relay.connect({ send: (s) => { if (ws.readyState === 1) ws.send(s); }, close: () => ws.close() });
    ws.on('message', (data) => relay.onMessage(cl, data.toString()));
    ws.on('close', () => relay.disconnect(cl));
    ws.on('error', () => relay.disconnect(cl));
  });
  return new Promise((resolve) => {
    server.listen(opts.port ?? DEFAULT_PORT, () => resolve({ relay, server, port: server.address().port, close: () => { wss.close(); server.close(); } }));
  });
}

function serveStatic(p, res) {
  if (!fs.existsSync(root)) { res.writeHead(503, { 'content-type': 'text/plain' }); res.end('Game files not built. Run "npm run build" first, then restart the server.'); return; }
  let file = path.normalize(path.join(root, decodeURIComponent(p)));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  if (path.basename(file) === 'index.html') {
    // tell the client a relay is available on this origin
    const html = fs.readFileSync(file, 'utf8').replace('<head>', '<head><script>window.__DEPTHS_SERVER__ = true;</script>');
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(html); return;
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer({ port: Number(arg('port', process.env.PORT || DEFAULT_PORT)), quiet: !!arg('quiet', false) }).then(({ port }) => {
    const addrs = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log('Depths of the Unseen server');
    console.log(`  Play on this machine:    http://localhost:${port}/`);
    for (const a of addrs) console.log(`  Players on your network: http://${a}:${port}/`);
    if (!fs.existsSync(root)) console.log('  Note: dist/ not found — run "npm run build" so the server can serve the game.');
  });
}
