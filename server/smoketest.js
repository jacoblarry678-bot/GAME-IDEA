/**
 * Headless integration test.
 *
 *   node server/smoketest.js [seconds]
 *
 * Boots two socket clients against a running server, hosts a lobby, joins with
 * the code, fills the rest with bots, starts a match and simulates it for a
 * while. Verifies that the ritual actually progresses and that nothing throws.
 * This is how the gameplay loop was validated before there was a renderer.
 */

import { io as ioc } from 'socket.io-client';
import { C2S, S2C, EV, ACT } from '../shared/protocol.js';
import { ROLES } from '../shared/constants.js';

const URL = process.env.TEST_URL || 'http://localhost:3000';
const DURATION = Number(process.argv[2] || 45) * 1000;

const seen = { events: new Map(), snapshots: 0, errors: [] };
const note = (t) => seen.events.set(t, (seen.events.get(t) || 0) + 1);

function connect(name) {
  return new Promise((resolve, reject) => {
    const s = ioc(URL, { transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => reject(new Error(`${name}: connect timeout`)), 8000);
    s.on('connect', () => {
      clearTimeout(timer);
      s.emit(C2S.HELLO, { name, protocol: 3 });
      resolve(s);
    });
    s.on('connect_error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    s.on(S2C.ERROR, (e) => {
      if (s.expectError) return; // deliberate negative test
      seen.errors.push(`${name}: ${e.message}`);
    });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function once(sock, ev, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ev}`)), timeout);
    sock.once(ev, (d) => {
      clearTimeout(t);
      resolve(d);
    });
  });
}

async function main() {
  console.log(`→ connecting to ${URL}`);
  const host = await connect('HostPlayer');
  const guest = await connect('GuestPlayer');

  // ---- host a lobby, read the code ----
  host.emit(C2S.HOST, { name: 'HostPlayer', mode: '1v4' });
  const lobby1 = await once(host, S2C.LOBBY);
  const code = lobby1.code;
  console.log(`✓ lobby created, code = ${code}`);
  if (!/^[0-9A-Z]{6}$/.test(code)) throw new Error('bad lobby code format: ' + code);

  // ---- guest joins with just the code ----
  guest.emit(C2S.JOIN, { code: code.toLowerCase(), name: 'GuestPlayer' });
  const lobby2 = await once(guest, S2C.LOBBY);
  console.log(`✓ guest joined via code (case-insensitive), ${lobby2.players.length} players`);
  if (lobby2.players.length !== 2) throw new Error('guest did not appear in lobby');

  // ---- wrong code must fail ----
  const bad = await connect('BadJoiner');
  bad.expectError = true;
  bad.emit(C2S.JOIN, { code: 'ZZZZZZ', name: 'BadJoiner' });
  const err = await once(bad, S2C.ERROR);
  console.log(`✓ invalid code rejected: "${err.message}"`);
  bad.close();

  // ---- both humans play survivors; the Cenobite is a bot so the AI hunts ----
  host.emit(C2S.SET_ROLE, { role: ROLES.SURVIVOR });
  await wait(200);
  host.emit(C2S.ADD_BOT, { role: ROLES.CENOBITE });
  for (let i = 0; i < 2; i++) {
    await wait(150);
    host.emit(C2S.ADD_BOT, { role: ROLES.SURVIVOR });
  }
  await wait(400);
  const lobby3 = await new Promise((r) => {
    host.once(S2C.LOBBY, r);
    host.emit(C2S.SET_READY, { ready: true });
  });
  console.log(`✓ roster: ${lobby3.players.map((p) => `${p.name}[${p.role}]`).join(', ')}`);

  // ---- instrument (host socket only — both sockets see the same broadcast) ----
  let snap = null;
  let started = null;
  let objectives = null;
  let ended = null;
  host.on(S2C.SNAPSHOT, (d) => {
    seen.snapshots++;
    snap = d;
  });
  host.on(S2C.EVENT, (list) => {
    for (const e of list) {
      note(e.type);
      if (e.type === EV.OBJECTIVE_UPDATE) objectives = e;
    }
  });
  host.on(S2C.MATCH_END, (d) => (ended = d));
  host.on(S2C.MATCH_START, (d) => (started = d));

  // ---- start ----
  host.emit(C2S.START);
  await wait(1200);
  if (!started) throw new Error('match never started');
  console.log(`✓ match started — ${started.players.length} participants, seed ${started.seed}`);
  const me = started.players.find((p) => p.name === 'HostPlayer');
  const guestMe = started.players.find((p) => p.name === 'GuestPlayer');
  console.log(`  host is ${me.role}, guest is ${guestMe.role}`);

  // ---- drive the two human players so movement validation is exercised ----
  let seq = 0;
  let hx = me.x;
  let hz = me.z;
  const mover = setInterval(() => {
    seq++;
    hx += Math.cos(seq * 0.11) * 0.14;
    hz += Math.sin(seq * 0.09) * 0.14;
    host.emit(C2S.INPUT, {
      seq, x: hx, y: me.y, z: hz, floor: me.floor,
      yaw: seq * 0.02, pitch: 0, anim: 'walk', speedFrac: 0.5,
    });
    guest.emit(C2S.INPUT, {
      seq, x: guestMe.x, y: guestMe.y, z: guestMe.z, floor: guestMe.floor,
      yaw: 0, pitch: 0, anim: 'idle', speedFrac: 0,
    });
  }, 33);

  // ---- speed-hack attempt should be corrected ----
  let corrected = false;
  host.on(S2C.CORRECTION, () => (corrected = true));
  await wait(2000);
  for (let i = 0; i < 8; i++) {
    seq++;
    host.emit(C2S.INPUT, { seq, x: hx + 400, y: 0, z: hz + 400, floor: 0, yaw: 0, pitch: 0 });
    await wait(60);
  }
  console.log(corrected ? '✓ anti-cheat: teleport rejected and client corrected' : '✗ anti-cheat did NOT correct a 560m jump');
  if (!corrected) throw new Error('movement validation failed');
  hx = me.x;
  hz = me.z;

  // ---- let bots play ----
  console.log(`→ simulating for ${DURATION / 1000}s (bots playing)…`);
  const deadline = Date.now() + DURATION;
  let lastPhase = '';
  while (Date.now() < deadline && !ended) {
    await wait(2000);
    if (objectives && objectives.phase !== lastPhase) {
      lastPhase = objectives.phase;
      console.log(`  [${((DURATION - (deadline - Date.now())) / 1000) | 0}s] phase → ${lastPhase}`);
    }
    if (objectives) {
      process.stdout.write(
        `\r  seals ${objectives.seals.done}/${objectives.seals.need}  ` +
          `relics ${objectives.relics.done}/${objectives.relics.need}  ` +
          `pieces ${objectives.pieces.done}/${objectives.pieces.need}  ` +
          `box ${objectives.box.assembled ? (objectives.box.solved ? 'SOLVED' : 'open') : '—'}  ` +
          `gate ${(objectives.gate.charge * 100) | 0}%   `
      );
    }
  }
  clearInterval(mover);
  console.log('');

  // ---- report ----
  console.log('\n── results ──────────────────────────────────');
  console.log(`snapshots received : ${seen.snapshots}`);
  console.log(`alive players      : ${snap ? snap.players.filter((p) => p.hs !== 'dead').length : '?'} / ${snap ? snap.players.length : '?'}`);
  if (snap) {
    for (const p of snap.players) {
      const who = started.players.find((x) => x.id === p.i);
      console.log(
        `  ${(who ? who.name : p.i).padEnd(22)} ${(who ? who.role : '?').padEnd(9)} hp=${String(p.h).padStart(3)} ${p.hs.padEnd(8)} fear=${String(p.fe).padStart(3)} pos=(${p.x.toFixed(0)},${p.z.toFixed(0)}) f${p.f} anim=${p.a}`
      );
    }
  }
  console.log(`\nevents observed:`);
  const wanted = [
    EV.SEAL_BROKEN, EV.CONTAINER_SEARCHED, EV.DAMAGE, EV.DOWNED, EV.CHAIN_SPAWN,
    EV.MELEE_SWING, EV.HORROR, EV.DOOR, EV.ITEM_PICKUP, EV.RELIC_DELIVERED,
    EV.ABILITY_CAST, EV.PHASE, EV.OBJECTIVE_UPDATE,
  ];
  for (const [k, v] of [...seen.events].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
  const missing = wanted.filter((w) => !seen.events.has(w));
  if (ended) console.log(`\nmatch ended: ${ended.winner} — ${ended.message}`);
  if (seen.errors.length) console.log(`\nerrors: ${seen.errors.join('; ')}`);

  const ok = seen.snapshots > 100 && seen.events.has(EV.OBJECTIVE_UPDATE) && !seen.errors.length;
  console.log(`\n${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  (unseen event types this run: ${missing.length ? missing.join(', ') : 'none'})`);

  host.close();
  guest.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('\n\x1b[31mSMOKE TEST FAILED\x1b[0m:', e.message);
  process.exit(1);
});
