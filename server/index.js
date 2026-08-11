/**
 * HELLRAISER: THE GAME — game server.
 *
 * Serves the built client (in production) and the Socket.IO signalling +
 * authoritative simulation. One process, one port: whoever hosts just tells
 * their friends the URL printed in the console, and everyone else only ever
 * types a six-character lobby code.
 */

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import { PROTOCOL_VERSION, GAME_MODES, ROLES, MATCH_STATE, LOBBY } from '../shared/constants.js';
import { C2S, S2C, ACT, ERR } from '../shared/protocol.js';
import { SURVIVORS, CENOBITES } from '../shared/characters.js';
import { LobbyManager } from './lobby.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 5000,
  pingTimeout: 12000,
  maxHttpBufferSize: 1e6,
});

const lobbies = new LobbyManager(io);

// ---------------------------------------------------------------- http

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    protocol: PROTOCOL_VERSION,
    lobbies: lobbies.lobbies.size,
    uptime: process.uptime(),
  });
});

app.get('/api/lan', (_req, res) => res.json({ urls: lanUrls() }));

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else if (IS_PROD) {
  app.get('*', (_req, res) => res.status(503).send('Run `npm run build` first.'));
}

// ---------------------------------------------------------------- sockets

function safeName(n) {
  return String(n || '').replace(/[<>&"]/g, '').slice(0, 18).trim();
}

io.on('connection', (socket) => {
  socket.data.name = 'Unnamed';

  const fail = (msg) => socket.emit(S2C.ERROR, { message: msg });
  const myLobby = () => lobbies.lobbyFor(socket.id);
  const isHost = (l) => l && l.hostId === socket.id;

  socket.emit(S2C.WELCOME, {
    id: socket.id,
    protocol: PROTOCOL_VERSION,
    survivors: SURVIVORS,
    cenobites: CENOBITES,
    modes: GAME_MODES,
    lan: lanUrls(),
  });

  socket.on(C2S.HELLO, (data = {}) => {
    if (data.protocol && data.protocol !== PROTOCOL_VERSION) return fail(ERR.BAD_VERSION);
    socket.data.name = safeName(data.name) || 'Unnamed';
  });

  socket.on(C2S.HOST, (data = {}) => {
    const name = safeName(data.name) || socket.data.name;
    if (!name) return fail(ERR.NAME_REQUIRED);
    socket.data.name = name;
    if (myLobby()) lobbies.leave(socket);
    const lobby = lobbies.create(socket, name, data.mode);
    console.log(`[lobby] ${name} opened ${lobby.code}`);
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.JOIN, (data = {}) => {
    const name = safeName(data.name) || socket.data.name;
    if (!name) return fail(ERR.NAME_REQUIRED);
    socket.data.name = name;
    if (myLobby()) lobbies.leave(socket);
    const res = lobbies.join(socket, data.code, name);
    if (res.error) return fail(res.error);
    console.log(`[lobby] ${name} joined ${res.lobby.code}`);
    lobbies.broadcast(res.lobby);
  });

  socket.on(C2S.LEAVE, () => {
    const lobby = lobbies.leave(socket);
    if (lobby) lobbies.broadcast(lobby);
  });

  socket.on(C2S.SET_ROLE, (data = {}) => {
    const lobby = myLobby();
    if (!lobby || lobby.state !== MATCH_STATE.LOBBY) return;
    const p = lobby.players.get(socket.id);
    if (!p) return;
    const role = data.role === ROLES.CENOBITE ? ROLES.CENOBITE : ROLES.SURVIVOR;
    const mode = GAME_MODES[lobby.mode];
    if (role === ROLES.CENOBITE && lobbies.countRole(lobby, ROLES.CENOBITE) >= mode.cenobites && p.role !== role) {
      return fail('Every Cenobite seat is taken.');
    }
    p.role = role;
    p.characterId = role === ROLES.CENOBITE ? CENOBITES[0].id : SURVIVORS[0].id;
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.SET_CHARACTER, (data = {}) => {
    const lobby = myLobby();
    if (!lobby || lobby.state !== MATCH_STATE.LOBBY) return;
    const p = lobby.players.get(socket.id);
    if (!p) return;
    if (p.role === ROLES.CENOBITE) {
      const c = CENOBITES.find((x) => x.id === data.characterId);
      if (c && c.available) p.characterId = c.id;
    } else {
      const s = SURVIVORS.find((x) => x.id === data.characterId);
      if (!s) return;
      const taken = [...lobby.players.values()].some((o) => o.id !== p.id && o.characterId === s.id);
      if (taken) return fail(`${s.name} is already chosen.`);
      p.characterId = s.id;
    }
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.SET_READY, (data = {}) => {
    const lobby = myLobby();
    if (!lobby) return;
    const p = lobby.players.get(socket.id);
    if (p) p.ready = !!data.ready;
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.SET_MODE, (data = {}) => {
    const lobby = myLobby();
    if (!isHost(lobby)) return fail(ERR.NOT_HOST);
    if (!GAME_MODES[data.mode]) return;
    lobby.mode = data.mode;
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.ADD_BOT, (data = {}) => {
    const lobby = myLobby();
    if (!isHost(lobby)) return fail(ERR.NOT_HOST);
    if (lobby.state !== MATCH_STATE.LOBBY) return;
    lobbies.addBot(lobby, data.role === ROLES.CENOBITE ? ROLES.CENOBITE : ROLES.SURVIVOR);
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.REMOVE_BOT, (data = {}) => {
    const lobby = myLobby();
    if (!isHost(lobby)) return fail(ERR.NOT_HOST);
    lobbies.removeBot(lobby, data.id);
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.KICK, (data = {}) => {
    const lobby = myLobby();
    if (!isHost(lobby)) return fail(ERR.NOT_HOST);
    const target = io.sockets.sockets.get(data.id);
    if (target) {
      lobbies.leave(target);
      target.emit(S2C.ERROR, { message: 'The host removed you from the lobby.', fatal: true });
    } else {
      lobbies.removeBot(lobby, data.id);
    }
    lobbies.broadcast(lobby);
  });

  socket.on(C2S.START, () => {
    const lobby = myLobby();
    if (!isHost(lobby)) return fail(ERR.NOT_HOST);
    if (lobby.state !== MATCH_STATE.LOBBY) return;
    const problem = lobbies.startMatch(lobby);
    if (problem) return fail(problem);
    console.log(`[match] ${lobby.code} started with ${lobby.players.size} participants`);
  });

  socket.on(C2S.CHAT, (data = {}) => {
    const lobby = myLobby();
    if (!lobby) return;
    const text = String(data.text || '').slice(0, 180).trim();
    if (!text) return;
    io.to(lobby.code).emit(S2C.CHAT, { from: socket.data.name, text, t: Date.now() });
  });

  socket.on(C2S.PING, (t) => socket.emit(S2C.PONG, t));

  // ------------------------------------------------------------- in-match

  socket.on(C2S.INPUT, (data) => {
    const lobby = myLobby();
    if (!lobby || !lobby.match) return;
    lobby.match.applyInput(socket.id, data || {});
  });

  socket.on(C2S.ACTION, (data = {}) => {
    const lobby = myLobby();
    if (!lobby || !lobby.match) return;
    const m = lobby.match;
    switch (data.type) {
      case ACT.INTERACT_START:
        m.startInteraction(socket.id, data.target);
        break;
      case ACT.INTERACT_CANCEL:
        m.cancelInteraction(socket.id);
        break;
      case ACT.ATTACK:
        m.attack(socket.id);
        break;
      case ACT.EXECUTE:
        m.execute(socket.id);
        break;
      case ACT.ABILITY:
        m.useAbility(socket.id, data.ability, data);
        break;
      case ACT.GATEWAY_ENTER:
        m.enterGateway(socket.id);
        break;
      case ACT.VAULT:
        m.vault(socket.id, data.vault);
        break;
      case ACT.UNHIDE:
        m.unhide(socket.id);
        break;
      case ACT.FLASHLIGHT:
        m.toggleFlashlight(socket.id);
        break;
      case ACT.USE_ITEM:
        m.useItem(socket.id, data.item);
        break;
      case ACT.ACTIVE_PERK:
        m.useActivePerk(socket.id);
        break;
      case ACT.BOX_ROTATE:
        m.rotateBox(socket.id, data.segment, data.dir);
        break;
      case ACT.BOX_SUBMIT:
        m.submitBox(socket.id);
        break;
      case ACT.DROP:
        m.dropCarried(m.players.get(socket.id) || {});
        break;
    }
  });

  socket.on(C2S.DEBUG, (data = {}) => {
    const lobby = myLobby();
    if (!lobby || !lobby.match) return;
    // debug commands are host-only so a guest can't end everyone's match
    if (lobby.hostId !== socket.id) return fail(ERR.NOT_HOST);
    lobby.match.debugCommand(socket.id, data.cmd, data);
  });

  socket.on('disconnect', () => {
    const lobby = lobbies.leave(socket);
    if (lobby) lobbies.broadcast(lobby);
  });
});

// ---------------------------------------------------------------- boot

function lanUrls() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      out.push({ iface: name, address: net.address });
    }
  }
  return out;
}

function banner() {
  const urls = lanUrls();
  const clientPort = IS_PROD ? PORT : 5173;
  const line = '═'.repeat(58);
  console.log('\n\x1b[31m╔' + line + '╗\x1b[0m');
  console.log('\x1b[31m║\x1b[0m  \x1b[1mHELLRAISER: THE GAME\x1b[0m — server listening on port ' + PORT + '        \x1b[31m║\x1b[0m');
  console.log('\x1b[31m╠' + line + '╣\x1b[0m');
  console.log('\x1b[31m║\x1b[0m  Open the game at:');
  console.log('\x1b[31m║\x1b[0m    \x1b[36mhttp://localhost:' + clientPort + '\x1b[0m   (this machine)');
  for (const u of urls) {
    console.log('\x1b[31m║\x1b[0m    \x1b[36mhttp://' + u.address + ':' + clientPort + '\x1b[0m   (other devices on the WiFi)');
  }
  if (!urls.length) console.log('\x1b[31m║\x1b[0m    (no LAN interface detected — localhost only)');
  console.log('\x1b[31m║\x1b[0m');
  console.log('\x1b[31m║\x1b[0m  Host clicks HOST GAME, reads out the 6-character code.');
  console.log('\x1b[31m║\x1b[0m  Everyone else opens the same URL, clicks JOIN, types the code.');
  console.log('\x1b[31m╚' + line + '╝\x1b[0m\n');
}

server.listen(PORT, '0.0.0.0', banner);

process.on('SIGINT', () => {
  console.log('\nShutting the Labyrinth.');
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
});

export { app, server, io, lobbies };
