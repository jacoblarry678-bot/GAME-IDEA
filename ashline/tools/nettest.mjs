/**
 * Online server tests with real WebSocket clients (Node 22 global WebSocket):
 * join/welcome/roster, input-driven movement, server-side hits and kills seen
 * by both players, respawn, input time budget (anti speed-hack), lag
 * compensation, protocol version reject, leave → bot refill.
 * Usage: node tools/nettest.mjs
 */
import { startServer } from '../server/server.mjs';
import { PROTOCOL_VERSION, packCmd } from '../src/net/protocol.js';
import { newCommand } from '../src/entities/combatant.js';

let pass = 0, fail = 0;
const t = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'cinder_yard', mode: 'tdm' }], bots: 3, time: 10 });
const url = `ws://localhost:${srv.port}/ws`;

class Client {
  constructor(name) {
    this.name = name; this.msgs = []; this.snap = null; this.roster = null; this.events = []; this.seq = 0;
    this.ws = new WebSocket(url);
    this.open = new Promise((r) => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      this.msgs.push(m);
      if (m.t === 'snap') { this.snap = m; this.events.push(...m.ev); }
      if (m.t === 'roster') this.roster = m;
      if (m.t === 'welcome') this.welcome = m;
      if (m.t === 'reject') this.rejected = m.reason;
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async join(loadout = { primary: 'ar_kv7', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' }) {
    await this.open;
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, loadout });
    await until(() => this.welcome || this.rejected);
    if (this.rejected) return false;
    this.send({ t: 'ready', mid: this.welcome.match.mid });
    await until(() => this.roster?.you);
    return true;
  }
  get me() { return this.snap?.e.find((e) => e[0] === this.roster.you); }
  entity(id) { return this.snap?.e.find((e) => e[0] === id); }
  /** Send `n` input frames of `dt` with cmd overrides. */
  input(n, dt, over = {}, vt = null) {
    const cmds = [];
    for (let i = 0; i < n; i++) {
      const c = { ...newCommand(), ...over };
      cmds.push(packCmd(++this.seq, dt, c, vt ?? (this.snap?.time ?? 0)));
    }
    for (let i = 0; i < cmds.length; i += 30) this.send({ t: 'cmd', c: cmds.slice(i, i + 30) });
  }
}
async function until(fn, ms = 5000) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await sleep(10); } return true; }

// ---- join
const A = new Client('Alpha'), B = new Client('Bravo');
t('client A joins (welcome + roster with own id)', await A.join(), A.rejected || '');
t('client B joins', await B.join(), B.rejected || '');
await until(() => A.roster?.list.filter((r) => r.human).length === 2);
const humans = A.roster.list.filter((r) => r.human);
t('roster: 2 humans on opposite teams, bots fill the rest and are flagged', humans.length === 2 && humans[0].team !== humans[1].team && A.roster.list.length === 6 && A.roster.list.filter((r) => r.isBot).length === 4, JSON.stringify(A.roster.list.map((r) => `${r.name}:${r.team}:${r.isBot ? 'bot' : 'human'}`)));
const wrong = new Client('Old');
await wrong.open;
wrong.send({ t: 'hello', v: PROTOCOL_VERSION + 99, name: 'Old' });
await until(() => wrong.rejected);
t('mismatched protocol version is rejected with a reason', /Version mismatch/.test(wrong.rejected || ''), wrong.rejected);
wrong.ws.close();

// wait for the countdown to finish
await until(() => A.snap?.m.state === 'live', 9000);
t('match goes live after the countdown', A.snap?.m.state === 'live');
A.send({ t: 'dbg', op: 'freezeBots' });

// ---- movement from inputs
const aid = A.roster.you, bid = B.roster.you;
A.send({ t: 'dbg', op: 'revive' });
A.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 });
await sleep(150);
const x0 = A.me[1];
A.input(60, 1 / 60, { moveZ: 1, yaw: -Math.PI / 2 });
await sleep(1300);
const x1 = A.me[1];
t('server moves the player from its inputs (~5 m/s)', x1 - x0 > 4 && x1 - x0 < 6, `${(x1 - x0).toFixed(2)} m in 1 s of input`);
t('server acknowledges the last processed input', A.snap.ack === A.seq, `ack ${A.snap.ack} / seq ${A.seq}`);

// ---- speed-hack guard: 3 s of inputs sent at once can't be applied faster than real time
A.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 });
await sleep(150);
const sx = A.me[1];
A.input(180, 1 / 60, { moveZ: 1, yaw: -Math.PI / 2 });
await sleep(500);
const moved = A.me[1] - sx;
t('input time budget: a burst of 3 s of input moves at most ~real time', moved < 4.5, `${moved.toFixed(2)} m after 0.5 s`);
await sleep(2800);

// ---- shooting: A kills B, both see it
if (!(B.entity(bid)[9] & 1)) { await until(() => B.snap.you.rt <= 0, 6000); B.send({ t: 'respawn' }); await until(() => B.entity(bid)[9] & 1, 3000); }
B.send({ t: 'dbg', op: 'health', v: 100 });
A.send({ t: 'dbg', op: 'revive' });
A.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 });
B.send({ t: 'dbg', op: 'place', x: 22, z: -1.5, yaw: Math.PI / 2 });
await sleep(300);
A.events.length = 0; B.events.length = 0;
for (let i = 0; i < 60 && (B.entity(bid)?.[9] & 1); i++) { A.input(6, 1 / 60, { fire: true, yaw: -Math.PI / 2, pitch: 0 }); await sleep(100); if (process.env.DBG && i % 5 === 0) console.log('A', A.me.slice(1, 6), 'B', B.entity(bid).slice(1, 4), 'hp', B.entity(bid)[11], 'mag', A.snap.you.mag, 'ack', A.snap.ack, A.seq); }
await sleep(300);
const killA = A.events.find((e) => e.type === 'kill' && e.victim?.$c === bid);
const killB = B.events.find((e) => e.type === 'kill' && e.victim?.$c === bid);
t('server-side hits: A eliminates B', !!killA && killA.killer?.$c === aid, killA ? JSON.stringify({ w: killA.weapon, hs: killA.headshot }) : 'no kill event');
t('both clients receive the kill event', !!killB);
t('damage events reach the victim', B.events.some((e) => e.type === 'damage' && e.victim?.$c === bid));
t('shots are broadcast for remote tracers/sound', B.events.some((e) => e.type === 'shot' && e.c?.$c === aid));
t('scoreboard rows carry the kill', A.snap.sb.find((r) => r[0] === aid)?.[1] >= 1);
t('victim snapshot shows dead with a respawn timer', !(B.entity(bid)[9] & 1) && B.snap.you.rt > 0);

// ---- respawn on request
await sleep(3500);
B.send({ t: 'respawn' });
await until(() => B.entity(bid)?.[9] & 1, 3000);
t('respawn request brings B back (server picks the spawn)', !!(B.entity(bid)?.[9] & 1) && B.snap.you.hp === 100);

// ---- lag compensation: B moves away; A fires using an older view time where B was in the crosshair
A.send({ t: 'dbg', op: 'revive' }); B.send({ t: 'dbg', op: 'revive' });
B.send({ t: 'dbg', op: 'place', x: 22, z: -1.5, yaw: Math.PI / 2 });
A.send({ t: 'dbg', op: 'place', x: 12, z: -1.5, yaw: -Math.PI / 2 });
await sleep(200);
A.input(30, 1 / 60, { ads: true, yaw: -Math.PI / 2, pitch: 0 }); // aim down sights first
await sleep(600);
const viewT = A.snap.time; // A "sees" B at z -1.5
B.send({ t: 'dbg', op: 'place', x: 22, z: 2.5, yaw: Math.PI / 2 }); // B is now 4 m to the side
await sleep(120);
A.events.length = 0;
A.input(1, 1 / 60, { ads: true, fire: true, yaw: -Math.PI / 2, pitch: 0 }, viewT);
await sleep(300);
const hitLag = A.events.some((e) => e.type === 'damage' && e.victim?.$c === bid && e.attacker?.$c === aid);
t('lag compensation: a shot aimed where the shooter saw B (≤250 ms ago) hits', hitLag);
A.input(10, 1 / 60, { fire: false, yaw: -Math.PI / 2 });
await sleep(400);
A.events.length = 0;
A.input(1, 1 / 60, { fire: true, yaw: -Math.PI / 2, pitch: 0 }, A.snap.time - 2);
await sleep(300);
t('rewind is capped: a view time 2 s old does not hit the old position', !A.events.some((e) => e.type === 'damage' && e.victim?.$c === bid));

// ---- leave → bot returns
B.send({ t: 'leave' });
await until(() => A.roster.list.filter((r) => r.human).length === 1, 3000);
t('leaving returns the slot to a bot', A.roster.list.filter((r) => r.human).length === 1 && A.roster.list.length === 6);

// ---- bandwidth (6 combatants, 20 snapshots/s)
{
  let bytes = 0, n = 0;
  const h = (e) => { if (e.data.includes('"t":"snap"')) { bytes += e.data.length; n++; } };
  A.ws.addEventListener('message', h);
  const t0 = Date.now();
  A.input(60, 1 / 60, { moveZ: 1, yaw: 0 });
  await sleep(2000);
  A.ws.removeEventListener('message', h);
  const secs = (Date.now() - t0) / 1000;
  const kbps = (bytes / secs) / 1024;
  t('downstream bandwidth per player is modest', kbps < 40 && n / secs > 15, `${(n / secs).toFixed(1)} snapshots/s, ${kbps.toFixed(1)} KB/s, ${Math.round(bytes / n)} B avg`);
}

// ---- status endpoint
const st = await (await fetch(`http://localhost:${srv.port}/status`)).json();
t('/status reports room, mode and players', st.mode === 'tdm' && st.players.length === 1, JSON.stringify(st));

t('snapshots carry the weather state', Array.isArray(A.snap?.m.wx) && A.snap.m.wx.length === 6, JSON.stringify(A.snap?.m.wx));
A.ws.close();
srv.close();

// ---- 0.6.0: Battle Royale on the server
{
  const srv2 = await startServer({ port: 0, dev: true, quiet: true, rotation: [{ map: 'old_quarter', mode: 'br' }], time: 8 });
  const url2 = `ws://localhost:${srv2.port}/ws`;
  class C2 extends Client { constructor(n) { super(n); } }
  // point a client at the BR server
  const mk = (n) => { const c = Object.create(Client.prototype); Object.assign(c, { name: n, msgs: [], snap: null, roster: null, events: [], seq: 0, los: 0, lastLo: null }); c.ws = new WebSocket(url2); c.open = new Promise((r) => c.ws.addEventListener('open', r)); c.ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.t === 'snap') { c.snap = m; c.events.push(...m.ev); if (m.lo) { c.los++; c.lastLo = m.lo; } } if (m.t === 'roster') c.roster = m; if (m.t === 'welcome') c.welcome = m; if (m.t === 'reject') c.rejected = m.reason; }); return c; };
  const P = mk('Pilot'), Q = mk('Quill');
  t('BR server: two players join', (await P.join()) && (await Q.join()));
  await until(() => P.snap?.m.state === 'live', 9000);
  const br = P.snap.m.br;
  t('BR server: snapshot carries zone, next circle, phase and the cold-phase timer', Array.isArray(br) && br.length === 12 && br[3] > 20 && br[11] > 20, JSON.stringify(br));
  t('BR server: humans take bot slots, everyone on their own team, bots flagged', P.roster.list.length === 8 && new Set(P.roster.list.map((r) => r.team)).size === 8 && P.roster.list.filter((r) => r.isBot).length === 6);
  t('BR server: loot list arrives once and only again when it changes', P.los >= 1 && P.lastLo.length >= 30 && P.los < 10, `${P.los} loot updates, ${P.lastLo.length} items`);
  const me = P.me;
  t('BR server: players start with pistol + axe', me && P.snap.you.mag.length === 2, JSON.stringify(P.snap.you.mag));
  // stand on a weapon and send one interact press
  P.send({ t: 'dbg', op: 'freezeBots' });
  const wpn = P.lastLo.find((l) => l[1] === 0);
  P.send({ t: 'dbg', op: 'place', x: wpn[3], y: wpn[4], z: wpn[5] });
  await sleep(150);
  const losBefore = P.los;
  P.input(1, 1 / 60, { interact: true }); P.input(3, 1 / 60, {});
  await until(() => P.los > losBefore, 3000);
  await sleep(200);
  const meNow = P.me;
  const prim = P.roster && P.snap.e.find((e) => e[0] === P.roster.you);
  const { unpackEntity } = await import('../src/net/protocol.js');
  const u = unpackEntity(prim);
  t('BR server: interact over a weapon swaps it in (server-authoritative) and the loot list updates', u.primary === wpn[2] && P.los > losBefore && !P.lastLo.some((l) => l[0] === wpn[0]), `${u.primary} vs ${wpn[2]}`);
  // zone damage reaches a client: move far outside a tiny forced zone
  srv2.room.match.ceasefireT = 0;
  const z = srv2.room.match.br.zone; z.state = 'final'; z.t = Infinity; z.x0 = z.x1 = 0; z.z0 = z.z1 = 0; z.r0 = z.r1 = 3;
  Q.send({ t: 'dbg', op: 'place', x: 40, z: 0 });
  const hp0 = 100; await sleep(2300);
  t('BR server: outside the zone the server drains your health', Q.snap.you.hp < hp0, String(Q.snap.you.hp));
  // a kill on the server shows up as a placement for everyone
  Q.send({ t: 'dbg', op: 'health', v: 1 });
  await until(() => (P.snap?.m.br?.[10] || []).length >= 1, 4000);
  const places = new Map(P.snap.m.br[10]);
  const qTeam = Q.roster.list.find((r) => r.id === Q.roster.you)?.team;
  t('BR server: the eliminated player gets a placement everyone can see', places.get(qTeam) === 8, JSON.stringify([...places]));
  P.ws.close(); Q.ws.close();
  srv2.close();
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
