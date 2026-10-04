#!/usr/bin/env node
/**
 * Operation Ashline dedicated server (self-hosted).
 *
 * Serves the built game (dist/) over HTTP and runs one authoritative match
 * room on a WebSocket at /ws on the same port. Players open
 * http://<this-machine>:<port>/ and choose Online in the menu.
 *
 * Usage: node server/server.mjs [--port 4190] [--map id] [--mode id] [--bots 5]
 *        [--difficulty regular] [--time min] [--score n] [--name "My Server"] [--dev]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room, DEFAULT_ROTATION } from './room.mjs';
import { DEFAULT_PORT, TICK_HZ } from '../src/net/protocol.js';
import { MAPS } from '../src/world/maps/index.js';
import { MODES } from '../src/game/modes.js';

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port || process.env.PORT || DEFAULT_PORT);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let rotation = DEFAULT_ROTATION;
if (args.map || args.mode) {
  const map = args.map || 'cinder_yard', mode = args.mode || 'tdm';
  if (!MAPS[map]) fail(`Unknown map "${map}". Maps: ${Object.keys(MAPS).join(', ')}`);
  if (!MODES[mode]?.playable) fail(`Unknown mode "${mode}". Modes: ${Object.values(MODES).filter((m) => m.playable).map((m) => m.id).join(', ')}`);
  rotation = [{ map, mode }];
}

export function startServer(opts = {}) {
  const room = new Room({
    name: opts.name ?? args.name ?? `${os.hostname()} · Ashline`,
    rotation: opts.rotation ?? rotation,
    botsPerTeam: Math.max(1, Math.min(5, Number(opts.bots ?? args.bots ?? 5))),
    ffaSlots: 8,
    difficulty: opts.difficulty ?? args.difficulty ?? 'regular',
    timeLimit: opts.time ?? (args.time ? Number(args.time) : undefined),
    scoreLimit: opts.score ?? (args.score ? Number(args.score) : undefined),
    dev: opts.dev ?? !!args.dev,
    resultsPause: opts.resultsPause,
    lagComp: opts.lagComp ?? !args['no-lag-comp'],
    log: opts.quiet ? () => {} : (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`),
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/status') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(room.status())); return; }
    serveStatic(url.pathname, res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws, req) => {
    ws._socket?.setNoDelay?.(true);
    // --lag <ms> (testing only): delay both directions to simulate distance
    const lag = Number(opts.lagMs ?? args.lag ?? 0);
    const out = (s) => { if (ws.readyState === 1) ws.send(s); };
    const cl = room.connect({ send: lag ? (s) => setTimeout(() => out(s), lag) : out, close: () => ws.close() });
    cl.addr = req.socket.remoteAddress;
    ws.on('message', (data) => { const s = data.toString(); if (lag) setTimeout(() => room.onMessage(cl, s), lag); else room.onMessage(cl, s); });
    ws.on('close', () => room.disconnect(cl));
    ws.on('error', () => room.disconnect(cl));
  });

  // fixed-rate simulation loop (drift-corrected)
  const step = 1 / TICK_HZ;
  let last = performance.now(), acc = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= step) { room.tick(step); acc -= step; }
  }, 1000 / TICK_HZ / 2);

  const p = opts.port ?? port;
  return new Promise((resolve) => {
    server.listen(p, () => {
      const actual = server.address().port;
      resolve({ room, server, port: actual, close: () => { clearInterval(timer); wss.close(); server.close(); } });
    });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(p, res) {
  if (!fs.existsSync(root)) { res.writeHead(503, { 'content-type': 'text/plain' }); res.end('Game files not built. Run "npm run build" first, then restart the server.'); return; }
  let file = path.normalize(path.join(root, decodeURIComponent(p)));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2), v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    o[k] = v;
  }
  return o;
}
function fail(msg) { console.error(msg); process.exit(1); }

// run directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(({ port: p, room }) => {
    const addrs = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log(`Operation Ashline server "${room.opts.name}" — protocol ${room.status().protocol}`);
    console.log(`  Play on this machine:  http://localhost:${p}/`);
    for (const a of addrs) console.log(`  Players on your network: http://${a}:${p}/`);
    console.log(`  Rotation: ${room.opts.rotation.map((r) => `${r.mode}@${r.map}`).join(', ')} · ${room.opts.botsPerTeam} per team (bots fill empty slots)`);
    if (!fs.existsSync(root)) console.log('  Note: dist/ not found — run "npm run build" so the server can serve the game.');
  });
}
