/**
 * Battle Island relay server (self-hosted online play).
 *
 * It does NOT simulate the game: the hosting player's browser is
 * authoritative. This server only provides "rooms" with the same semantics
 * the claude.ai artifact `room` capability offers — per-peer presence
 * objects (merged, shared with everyone in the room) and broadcast
 * messages on topics — so one client protocol works in both places.
 * It also serves the built game from battle-island/dist.
 *
 *   npm run island:build && npm run island:server   →  http://<your-ip>:3100
 */
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT || 3100);
const MAX_BYTES = 4096; // same budget as the artifact room capability
const here = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(join(here, '..', 'dist')));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' }, maxHttpBufferSize: 64 * 1024 });

/** room name -> Map(peer -> presence object) */
const rooms = new Map();
const size = (v) => Buffer.byteLength(JSON.stringify(v ?? null));
const NAME = /^[a-z0-9_][a-z0-9_.-]{0,47}$/;

function roomOf(name) {
  let r = rooms.get(name);
  if (!r) rooms.set(name, (r = new Map()));
  return r;
}

function leave(sock, name) {
  const r = rooms.get(name);
  if (!r || !r.has(sock.id)) return;
  r.delete(sock.id);
  sock.leave('r:' + name);
  io.to('r:' + name).emit('peer', { room: name, peer: sock.id, left: true });
  if (!r.size) rooms.delete(name);
}

io.on('connection', (sock) => {
  const joined = new Set();
  sock.on('join', (name, ack) => {
    if (typeof name !== 'string' || !NAME.test(name) || joined.size >= 16) return ack?.({ error: 'invalid_argument' });
    const r = roomOf(name);
    joined.add(name);
    sock.join('r:' + name);
    if (!r.has(sock.id)) r.set(sock.id, {});
    sock.to('r:' + name).emit('peer', { room: name, peer: sock.id, presence: {} });
    ack?.({ peer: sock.id, peers: [...r].map(([peer, presence]) => ({ peer, presence })) });
  });
  sock.on('leave', (name) => {
    joined.delete(name);
    leave(sock, name);
  });
  sock.on('presence', ({ room, patch } = {}) => {
    const r = rooms.get(room);
    if (!r || !r.has(sock.id) || !patch || typeof patch !== 'object') return;
    const cur = { ...r.get(sock.id) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete cur[k];
      else cur[k] = v;
    }
    if (size(cur) > MAX_BYTES) return;
    r.set(sock.id, cur);
    sock.to('r:' + room).volatile.emit('peer', { room, peer: sock.id, presence: cur });
  });
  sock.on('emit', ({ room, topic, data } = {}) => {
    const r = rooms.get(room);
    if (!r || !r.has(sock.id) || typeof topic !== 'string' || size(data) > MAX_BYTES) return;
    io.to('r:' + room).emit('msg', { room, peer: sock.id, topic, data });
  });
  sock.on('disconnect', () => {
    for (const name of joined) leave(sock, name);
  });
});

http.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Battle Island server on http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  same Wi-Fi: http://${ip}:${PORT}`);
});
