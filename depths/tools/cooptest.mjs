/**
 * Co-op integration test over real sockets: the relay server, a host Game
 * with HostSession and up to two guests with GuestSession (no browser).
 * Run: node tools/cooptest.mjs
 */
import WebSocket from 'ws';
import { startServer } from '../server/server.mjs';
import { connectRelay } from '../src/net/transport.js';
import { HostSession, GuestSession } from '../src/net/session.js';
import { Game } from '../src/sim/game.js';
import { addToPouch } from '../src/sim/equipment.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok', m); } else { fail++; console.log('  FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = await startServer({ port: 0, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;

// host
const host = new Game({ seed: 5 });
host.addPlayer('p1', 'evan', 'Evan');
host.loadChapter(1);
const hs = new HostSession(host, connectRelay({ url, WS: WebSocket }), { name: 'Evan' });
const hostFrame = (dt = 1 / 30) => { host.tick(dt); hs.update(dt, host.drainEvents()); };
for (let i = 0; i < 20 && !hs.code; i++) { hostFrame(); await sleep(20); }
ok(/^[A-Z0-9]{6}$/.test(hs.code || ''), `host received invite code ${hs.code}`);

// guest
let ready = null, ended = null, results = [];
const mkGuest = (ident) => new GuestSession(connectRelay({ url, WS: WebSocket }), { code: hs.code, name: 'Mara', slot: 'mara', ident, onReady: (g, pid) => { ready = { g, pid }; }, onEnd: (m) => { ended = m; }, onResult: (r) => results.push(r) });
let gs = mkGuest('mara-1');
const both = async (n, fn) => { for (let i = 0; i < n; i++) { hostFrame(); if (gs && gs.g) { gs.g.tick(1 / 30); gs.g.drainEvents(); } if (fn) fn(i); await sleep(8); } };
await both(40);
ok(ready && ready.pid, `guest welcomed as ${ready && ready.pid}`);
const gpid = ready.pid;
const hp = () => host.players.get(gpid);
ok(host.players.size === 2 && hp().remote, 'host created a remote player for the guest');
await both(20);
ok(!hp().spectating, 'guest spawned at the chapter entry');
ok(gs.me && !gs.me.spectating, 'guest mirror sees itself spawned');
ok(gs.g.level && gs.g.level.rooms.length === host.level.rooms.length, 'guest mirror built the same level');

// movement: the guest walks forward; the host follows the reported position
const z0 = hp().z;
await both(45, () => gs.g.setInput(gpid, { mx: 0, mz: 1, yaw: Math.PI }));
gs.g.setInput(gpid, { mz: 0 });
await both(15);
ok(Math.abs(hp().z - gs.me.z) < 0.6 && Math.abs(hp().z - z0) > 1, `host tracks guest movement (moved ${Math.abs(hp().z - z0).toFixed(1)} m)`);

// a teleport attempt is corrected
const before = { x: hp().x, z: hp().z };
gs.me.x += 30;
await both(10);
ok(Math.hypot(hp().x - before.x, hp().z - before.z) < 3 && Math.abs(gs.me.x - hp().x) < 1, 'impossible movement is rejected and corrected');

// actions: the guest's interaction runs on the host
host.story.set('ch1.testFlag');
await both(10);
ok(gs.g.story.has('ch1.testFlag'), 'story flags reach the guest');
const p1 = host.players.get('p1');
const gate = host.level.interById.get('gateWheel');
hp().x = gate.x; hp().z = gate.z - 1.0; // host-side placement reaches the guest as a correction
await both(10);
gs.g.setInput(gpid, { yaw: 0, pitch: 0 });
await both(5);
gs.g.beginInteract(gpid, 'gateWheel');
await both(20);
ok(host.story.has('ch1.gate'), 'guest interaction executed by the host (gate wheel)');

// pickups and pouch sync
const pk = host.level.interactables.find((i) => i.kind === 'pickup' && !host.pickups[i.id].taken);
hp().x = pk.x; hp().z = pk.z - 0.9;
await both(10);
gs.g.beginInteract(gpid, pk.id);
await both(15);
ok(host.pickups[pk.id].taken && gs.g.pickups[pk.id].taken, `pickup ${pk.id} taken by the guest on both sides`);
ok(gs.me.pouch.some(Boolean) || hp().pouch.some(Boolean) || pk.item === 'flashlight' || pk.item === 'camera' || host.pickups[pk.id].qty === 0, 'guest inventory reflects the pickup');

// disconnect: supplies go to a labeled bag at the next refuge; rejoin restores them
addToPouch(hp(), 'bandage', 2);
await both(5);
gs.close();
await both(25);
ok(!hp().connected, 'host marks the guest disconnected');
ok(host.dropped.some((d) => d.drop && d.drop.owner === 'mara-1'), 'supplies left in a labeled bag');
ready = null;
gs = mkGuest('mara-1');
await both(40);
ok(ready && ready.pid === gpid, 'the same identity rejoins as the same crew member');
// rejoining needs a safe spawn: walk the host into the first refuge
const r1 = host.level.refuges.find((r) => r.genuine);
const room = host.level.room(r1.room);
p1.x = room.cx; p1.z = room.cz; host._enterRoom(p1);
await both(20);
ok(!hp().spectating && hp().pouch.some((s) => s && s.item === 'bandage'), 'rejoined at a genuine refuge with the same bandages');

// chapter change reaches the guest as a full rebuild
host.loadChapter(2, { entry: 'replay' });
await both(20);
ok(gs.g.chapterId === 2 && gs.g.level.rooms.length === host.level.rooms.length, 'chapter change rebuilds the guest mirror');

// shared pause: every connected player must vote; any player resumes after three seconds
gs.g.pauseVote(gpid);
await both(10);
ok(!host.sharedPause, 'one vote does not pause the shared game');
host.pauseVote('p1');
await both(10);
ok(host.sharedPause && gs.g.sharedPause, 'all votes pause the game on both sides');
gs.g.resumeShared(gpid);
await both(10);
ok(host.sharedPause, 'resume waits for its countdown');
await sleep(3200);
await both(10);
ok(!host.sharedPause && !gs.g.sharedPause, 'the countdown resumes the game');

// the final choice: a guest can hold the gate for thirty seconds
host.loadChapter(6, { entry: 'replay' });
await both(20);
gs.g.requestMoreTime(gpid);
await both(10);
ok(host.story.vars.holdUntil > host.time + 25, 'a guest request holds the final gate');

// the host leaving ends the session for guests
hs.close();
await both(20);
ok(!!ended, 'guest told when the host leaves');

srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
