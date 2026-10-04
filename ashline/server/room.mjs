/**
 * Room: one continuously running, server-authoritative match.
 *
 * - The match is filled with bots; each human who joins takes over a bot's
 *   slot (team modes: the team with fewer humans), and a bot returns when they
 *   leave. Bots are labelled as bots to every client.
 * - Human combatants are simulated from their input commands only. Each
 *   command is applied with its own dt, in order, under a time budget so a
 *   client cannot move faster by sending more commands.
 * - Hits are traced on the server with lag compensation: other combatants are
 *   rewound to where the shooter saw them (up to 250 ms).
 * - Snapshots go out at SNAP_HZ; when a match ends the next one in the
 *   rotation starts after a results pause.
 */
import { MapBuilder } from '../src/world/mapBuilder.js';
import { NavGrid } from '../src/world/navgrid.js';
import { MAPS } from '../src/world/maps/index.js';
import { Match } from '../src/game/match.js';
import { MODES } from '../src/game/modes.js';
import { Combatant } from '../src/entities/combatant.js';
import { BotBrain } from '../src/entities/bot.js';
import { BOT_NAMES } from '../src/data/names.js';
import {
  PROTOCOL_VERSION, TICK_HZ, SNAP_HZ, packEntity, unpackCmd, rosterEntry, serEvent,
  sanitizeName, sanitizeLoadout, sanitizeLook, r2, r3,
} from '../src/net/protocol.js';

const CE_TYPES = new Set(['step', 'jump', 'land', 'slide', 'mantle', 'reloadStart', 'shellIn', 'swapOut', 'dry', 'melee', 'throw', 'spawn']);
const RESULTS_PAUSE = 12; // seconds between matches
const MAX_REWIND = 0.25;

export const DEFAULT_ROTATION = [
  { map: 'cinder_yard', mode: 'tdm' },
  { map: 'old_quarter', mode: 'dom' },
  { map: 'signal_station', mode: 'hp' },
  { map: 'old_quarter', mode: 'tdm' },
  { map: 'signal_station', mode: 'dom' },
  { map: 'cinder_yard', mode: 'hp' },
];

export class Room {
  /**
   * opts: { name, rotation: [{map, mode}], botsPerTeam, ffaSlots, difficulty, timeLimit?, scoreLimit?, dev, log }
   */
  constructor(opts = {}) {
    this.opts = { name: 'Ashline Server', botsPerTeam: 5, ffaSlots: 8, difficulty: 'regular', rotation: DEFAULT_ROTATION, log: () => {}, ...opts };
    this.clients = new Set();
    this.maps = {};
    this.ri = -1;
    this.mid = 0;
    this.tickN = 0;
    this.evBuf = [];
    this.ceBuf = new Map();
    this.history = [];
    this.nextClientId = 1;
    this.nextMatch();
  }

  // ---------------------------------------------------------------- match lifecycle
  loadMap(id) {
    if (!this.maps[id]) {
      const def = MAPS[id];
      const b = new MapBuilder({ headless: true });
      def.build(b);
      const nav = new NavGrid(b.world, def.bounds, 1);
      this.maps[id] = { world: b.world, nav, spawns: b.spawns, hotspots: b.hotspots, def };
    }
    return this.maps[id];
  }

  nextMatch() {
    // clean up dynamic collision boxes left by the previous match (shields)
    if (this.match) for (const s of [...this.match.deployables.shields]) this.match.deployables.removeShield(s, false);
    this.ri = (this.ri + 1) % this.opts.rotation.length;
    const { map, mode } = this.opts.rotation[this.ri];
    const M = MODES[mode];
    const teams = M.teams;
    const setup = {
      map, mode,
      scoreLimit: this.opts.scoreLimit ?? M.defaults.scoreLimit,
      timeLimit: this.opts.timeLimit ?? M.defaults.timeLimit,
      botsAllies: teams ? this.opts.botsPerTeam : 0,
      botsEnemies: teams ? this.opts.botsPerTeam : this.opts.ffaSlots,
      difficulty: this.opts.difficulty, friendlyFire: false, countdown: 5,
    };
    this.setup = setup;
    this.mid++;
    const m = new Match(this.loadMap(map), { ...setup, includePlayer: false });
    m.presenter = true; // the room collects and clears combatant events
    m.on((e) => { if (e.type !== 'noise') this.evBuf.push(serEvent(e)); });
    this.installLagCompensation(m);
    this.match = m;
    this.history = [];
    this.endedFor = 0;
    // existing players take over bot slots in the new match
    for (const cl of this.clients) { cl.c = null; cl.lastSeq = cl.lastSeq || 0; cl.queue = []; }
    m.start();
    for (const cl of this.clients) if (cl.joined) this.assignSlot(cl);
    this.broadcast({ t: 'newMatch', match: this.matchInfo() });
    this.sendRoster();
    this.opts.log(`match ${this.mid}: ${mode} on ${map}`);
  }

  matchInfo() {
    return { mid: this.mid, map: this.setup.map, mode: this.setup.mode, setup: this.setup, roster: this.match.combatants.map(rosterEntry), time: r3(this.match.time) };
  }

  // ---------------------------------------------------------------- slots
  assignSlot(cl) {
    const m = this.match;
    const humans = (t) => m.combatants.filter((c) => c.net && c.team === t).length;
    let bot;
    if (m.mode.teams) {
      const team = humans(0) <= humans(1) ? 0 : 1;
      bot = m.combatants.find((c) => c.isBot && c.team === team) || m.combatants.find((c) => c.isBot);
    } else bot = m.combatants.find((c) => c.isBot);
    if (!bot) return false;
    const c = new Combatant({ name: cl.name, team: bot.team, isBot: false, loadout: cl.loadout });
    c.net = cl;
    c.look = cl.look;
    if (bot.gunLevel !== undefined) c.gunLevel = 0;
    this.removeCombatant(bot);
    m.add(c);
    cl.c = c;
    if (m.mode.loadoutFor) c.applyLoadout(m.mode.loadoutFor(m, c));
    if (m.state === 'countdown' || (m.state === 'live' && m.canRespawn(c))) m.respawn(c, m.state === 'countdown');
    else { c.alive = false; c.respawnT = 1; } // e.g. mid-round in Elimination: spectate until the next round
    return true;
  }

  removeCombatant(c) {
    const m = this.match;
    c.alive = false;
    c.removed = true;
    const i = m.combatants.indexOf(c);
    if (i >= 0) m.combatants.splice(i, 1);
    for (const o of m.combatants) if (o.brain) { o.brain.known.delete(c.id); if (o.brain.target === c) o.brain.target = null; }
  }

  addBot(team) {
    const m = this.match;
    const used = new Set(m.combatants.map((c) => c.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
    const lo = { primary: 'ar_kv7', secondary: 'pistol_warden', lethal: 'frag', tactical: 'smoke' };
    const c = new Combatant({ name, team, isBot: true, loadout: lo });
    c.brain = new BotBrain(c, m);
    m.add(c);
    if (m.mode.loadoutFor) c.applyLoadout(m.mode.loadoutFor(m, c));
    if (m.canRespawn(c) && m.state !== 'ended') m.respawn(c);
    else { c.alive = false; c.respawnT = 3; }
  }

  // ---------------------------------------------------------------- clients
  /** A transport adapter: { send(str), close() }. Returns the client record. */
  connect(transport) {
    const cl = { id: this.nextClientId++, transport, name: 'Player', joined: false, c: null, queue: [], lastSeq: 0, lastQueued: 0, budget: 0, ping: null, cmdCount: 0, cmdWindow: 0 };
    this.clients.add(cl);
    return cl;
  }

  disconnect(cl) {
    if (!this.clients.has(cl)) return;
    this.clients.delete(cl);
    if (cl.c) {
      const team = cl.c.team;
      this.removeCombatant(cl.c);
      this.addBot(team);
      this.opts.log(`${cl.name} left`);
      this.sendRoster();
    }
  }

  onMessage(cl, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'hello': {
        if (msg.v !== PROTOCOL_VERSION) { this.send(cl, { t: 'reject', reason: `Version mismatch: server protocol ${PROTOCOL_VERSION}, client ${msg.v}. Update both to the same build.` }); return; }
        const free = this.match.combatants.filter((c) => c.isBot).length - [...this.clients].filter((x) => x.pending).length;
        if (free <= 0) { this.send(cl, { t: 'reject', reason: 'Server is full.' }); return; }
        cl.name = this.uniqueName(sanitizeName(msg.name));
        cl.loadout = sanitizeLoadout(msg.loadout);
        cl.look = sanitizeLook(msg.look);
        cl.pending = true;
        this.send(cl, { t: 'welcome', server: { name: this.opts.name, protocol: PROTOCOL_VERSION, tick: TICK_HZ, snap: SNAP_HZ }, you: cl.id, name: cl.name, match: this.matchInfo() });
        break;
      }
      case 'ready': {
        if (!cl.pending && !cl.joined) return;
        if (msg.mid !== this.mid) return; // a new match started meanwhile; the client will re-ready
        if (!cl.joined) {
          cl.pending = false;
          cl.joined = true;
          if (!this.assignSlot(cl)) { this.send(cl, { t: 'reject', reason: 'Server is full.' }); cl.joined = false; return; }
          this.opts.log(`${cl.name} joined (${this.match.mode.teams ? 'team ' + cl.c.team : 'ffa'})`);
          this.sendRoster();
        }
        break;
      }
      case 'cmd': {
        if (!cl.c || !Array.isArray(msg.c)) return;
        // flood guard: at most ~3 s of input queued
        for (const a of msg.c.slice(0, 32)) {
          const u = unpackCmd(a);
          if (!u || u.seq <= cl.lastQueued) continue;
          cl.lastQueued = u.seq;
          cl.queue.push(u);
        }
        if (cl.queue.length > 180) cl.queue.splice(0, cl.queue.length - 180);
        break;
      }
      case 'respawn': {
        const c = cl.c, m = this.match;
        if (c && !c.alive && m.state === 'live' && m.canRespawn(c) && c.respawnT <= 0) m.respawn(c);
        break;
      }
      case 'ping':
        if (Number.isFinite(msg.rtt)) cl.ping = Math.round(Math.max(0, Math.min(5000, msg.rtt)));
        this.send(cl, { t: 'pong', ct: msg.ct, st: r3(this.match.time) });
        break;
      case 'dbg':
        if (this.opts.dev) this.debug(cl, msg);
        break;
      case 'leave':
        this.disconnect(cl);
        cl.transport.close();
        break;
      default: break;
    }
  }

  uniqueName(n) {
    const taken = new Set([...this.clients].map((c) => c.name).concat(this.match.combatants.map((c) => c.name)));
    if (!taken.has(n)) return n;
    for (let i = 2; i < 99; i++) if (!taken.has(`${n.slice(0, 13)} ${i}`)) return `${n.slice(0, 13)} ${i}`;
    return n;
  }

  /** Test hooks (only with --dev): place a player, set health. */
  debug(cl, msg) {
    const c = msg.id ? this.match.combatants.find((x) => x.id === msg.id) : cl.c;
    if (!c) return;
    if (msg.op === 'revive' && !c.alive) this.match.respawn(c);
    if (msg.op === 'place') { c.x = msg.x; c.y = msg.y ?? 0; c.z = msg.z; c.vx = c.vz = c.vy = 0; if (Number.isFinite(msg.yaw)) { c.yaw = c.cmd.yaw = msg.yaw; } c.spawnProtectT = 0; }
    if (msg.op === 'freezeBots') for (const o of this.match.combatants) if (o.brain) { o.brain.update = () => { o.cmd.moveX = o.cmd.moveZ = 0; o.cmd.fire = false; }; }
    if (msg.op === 'health') c.health = msg.v;
  }

  // ---------------------------------------------------------------- simulation
  installLagCompensation(m) {
    const fire = m.fireWeapon.bind(m), melee = m.doMelee.bind(m);
    m.fireWeapon = (c, wpn) => { const restore = this.rewind(c); try { fire(c, wpn); } finally { restore(); } };
    m.doMelee = (c, def) => { const restore = this.rewind(c); try { melee(c, def); } finally { restore(); } };
  }

  /** Move everyone except `shooter` to where the shooter's client was drawing them. */
  rewind(shooter) {
    if (this.opts.lagComp === false || !shooter.net || !Number.isFinite(shooter.netViewT) || this.history.length < 2) return () => {};
    const now = this.match.time;
    const t = Math.max(now - MAX_REWIND, Math.min(now, shooter.netViewT));
    if (now - t < 0.005) return () => {};
    let a = null, b = null;
    for (let i = this.history.length - 1; i >= 0; i--) { if (this.history[i].t <= t) { a = this.history[i]; b = this.history[i + 1] || a; break; } }
    if (!a) return () => {};
    const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const saved = [];
    for (const o of this.match.combatants) {
      if (o === shooter) continue;
      const pa = a.pos.get(o.id), pb = b.pos.get(o.id);
      if (!pa || !pb || !pa[3] || !o.alive) continue;
      saved.push([o, o.x, o.y, o.z, o.stance]);
      o.x = pa[0] + (pb[0] - pa[0]) * k; o.y = pa[1] + (pb[1] - pa[1]) * k; o.z = pa[2] + (pb[2] - pa[2]) * k;
      o.stance = k < 0.5 ? pa[4] : pb[4];
    }
    return () => { for (const [o, x, y, z, st] of saved) { o.x = x; o.y = y; o.z = z; o.stance = st; } };
  }

  /** Advance the room by one server tick. */
  tick(dt) {
    const m = this.match;
    const anyone = [...this.clients].some((c) => c.joined);
    if (!anyone) return; // idle while empty
    this.tickN++;
    // human input
    for (const cl of this.clients) {
      const c = cl.c;
      if (!c) { cl.queue.length = 0; continue; }
      cl.budget = Math.min(cl.budget + dt, 0.25);
      while (cl.queue.length && cl.queue[0].dt <= cl.budget + 1e-6) {
        const u = cl.queue.shift();
        cl.budget -= u.dt;
        cl.lastSeq = u.seq;
        if (m.state === 'ended' || !c.alive) continue;
        Object.assign(c.cmd, u.cmd);
        if (m.state === 'countdown') { c.cmd.moveX = c.cmd.moveZ = 0; c.cmd.fire = c.cmd.jump = c.cmd.melee = c.cmd.lethal = c.cmd.tactical = false; c.cmd.support = null; }
        c.netViewT = u.vt;
        m.tickCombatant(c, u.dt);
      }
    }
    m.tick(dt);
    // gun game etc. change loadouts → roster update
    let rosterDirty = false;
    for (const c of m.combatants) {
      const lk = c.loadout.primary + '|' + c.loadout.secondary;
      if (c._lk !== undefined && c._lk !== lk) rosterDirty = true;
      c._lk = lk;
      if (c.events.length) {
        const list = c.events.filter((e) => CE_TYPES.has(e.type)).map((e) => serEvent(e));
        if (list.length) { const arr = this.ceBuf.get(c.id) || []; arr.push(...list); this.ceBuf.set(c.id, arr); }
        c.events.length = 0;
      }
    }
    if (rosterDirty) this.sendRoster();
    // lag-compensation history
    const pos = new Map();
    for (const c of m.combatants) pos.set(c.id, [c.x, c.y, c.z, c.alive, c.stance]);
    this.history.push({ t: m.time, pos });
    while (this.history.length && m.time - this.history[0].t > 0.6) this.history.shift();
    // snapshots
    if (this.tickN % Math.round(TICK_HZ / SNAP_HZ) === 0) this.sendSnapshots();
    // next match after the results pause
    if (m.state === 'ended') {
      this.endedFor += dt;
      if (this.endedFor > (this.opts.resultsPause ?? RESULTS_PAUSE)) this.nextMatch();
    }
  }

  sendSnapshots() {
    const m = this.match;
    const common = {
      t: 'snap', mid: this.mid, time: r3(m.time),
      m: {
        state: m.state, cd: r2(m.countdown), tl: r2(m.timeLeft), ts: m.teamScores.map(Math.round), w: m.winner, er: m.endReason,
        fl: m.flags ? m.flags.map((f) => [f.owner, r3(f.progress), f.contested ? 1 : 0, f.capturing]) : undefined,
        hp: m.hp ? [m.hp.idx, m.hp.owner, m.hp.contested ? 1 : 0, r2(m.hp.t)] : undefined,
        rd: m.round ? [m.round.n, m.round.phase] : undefined,
      },
      e: m.combatants.map(packEntity),
      sb: m.combatants.map((c) => [c.id, c.stats.kills, c.stats.deaths, c.stats.assists, c.stats.score, c.stats.streak, c.stats.captures || 0, c.net?.ping ?? -1]),
      ev: this.evBuf,
      ce: Object.fromEntries(this.ceBuf),
      p: m.projectiles.list.map((g) => [g.id, g.kind, r3(g.x), r3(g.y), r3(g.z), g.rest ? 1 : 0, r2(g.spin)]),
      d: {
        sh: m.deployables.shields.map((s) => [s.id, s.owner.id, s.team, r3(s.x), r3(s.y), r3(s.z), s.alongX ? 1 : 0, Math.round(s.hp), s.hitT ? r3(s.hitT) : 0]),
        dr: m.deployables.drops.map((d) => [d.id, d.team, r3(d.x), r3(d.y), r3(d.z), r2(d.fall), r2(d.life)]),
        st: m.deployables.strikes.map((s) => [s.id, s.team, r3(s.x), r3(s.y), r3(s.z), r2(s.t)]),
        rc: m.deployables.recon.map((v) => r3(v || 0)),
      },
    };
    this.evBuf = [];
    this.ceBuf = new Map();
    for (const cl of this.clients) {
      if (!cl.joined && !cl.pending) continue;
      const c = cl.c;
      const you = c ? {
        id: c.id, mag: c.weapons.map((w) => w.mag), res: c.weapons.map((w) => w.reserve), le: c.lethal.count, ta: c.tactical.count,
        ab: c.abilities, sk: c.supportKills, bl: r2(c.blindT), bm: r2(c.blindMax), rt: r2(c.respawnT), sp: r2(c.spawnProtectT), hp: Math.ceil(c.health),
      } : null;
      this.send(cl, { ...common, ack: cl.lastSeq, you });
    }
  }

  sendRoster() {
    const list = this.match.combatants.map(rosterEntry);
    for (const cl of this.clients) if (cl.joined || cl.pending) this.send(cl, { t: 'roster', mid: this.mid, list, you: cl.c?.id ?? null });
  }

  send(cl, msg) { try { cl.transport.send(JSON.stringify(msg)); } catch { /* closed */ } }
  broadcast(msg) { const s = JSON.stringify(msg); for (const cl of this.clients) if (cl.joined || cl.pending) { try { cl.transport.send(s); } catch { /* closed */ } } }

  status() {
    return {
      name: this.opts.name, protocol: PROTOCOL_VERSION, mid: this.mid, map: this.setup.map, mode: this.setup.mode, state: this.match.state,
      players: [...this.clients].filter((c) => c.joined).map((c) => ({ name: c.name, ping: c.ping })),
      bots: this.match.combatants.filter((c) => c.isBot).length,
    };
  }
}

