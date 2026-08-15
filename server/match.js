/**
 * Authoritative match simulation.
 *
 * Runs at NET.TICK_HZ on the host's Node process. Owns health, objectives,
 * doors, items, ability legality, the clock and the win condition. Movement is
 * client-reported and validated here (see shared/protocol.js for the rationale).
 */

import {
  NET,
  MOVE,
  CENOBITE_MOVE,
  STAMINA,
  FEAR,
  HEALTH,
  DAMAGE,
  ABILITIES,
  POWER,
  OBJECTIVES,
  ITEMS,
  MATCH_STATE,
  HEALTH_STATE,
  ROLES,
  clamp,
  dist2,
} from '../shared/constants.js';
import { S2C, EV } from '../shared/protocol.js';
import {
  buildMap,
  zoneAt,
  groundAt,
  isSolidWorld,
  hasLineOfSight,
  worldToGridX,
  worldToGridZ,
  isSolid,
  CELL,
  FLOOR_Y,
} from '../shared/mapdata.js';
import { Rand } from '../shared/rng.js';
import { getSurvivor } from '../shared/characters.js';
import { BotController } from './bots.js';

let nextEntityId = 1;

export class Match {
  /**
   * @param {object} lobby  the owning lobby (players, mode, code)
   * @param {object} io     socket.io server (for room broadcasts)
   */
  constructor(lobby, io) {
    this.lobby = lobby;
    this.io = io;
    this.room = lobby.code;
    this.seed = lobby.code + ':' + Date.now().toString(36);
    this.rand = new Rand(this.seed);
    this.map = buildMap(lobby.code);
    this.state = MATCH_STATE.INTRO;
    this.time = 0;
    this.clock = OBJECTIVES.MATCH_DURATION;
    this.tickCount = 0;
    this.pendingEvents = [];

    this.players = new Map();
    this.chains = [];
    this.traps = [];
    this.gateways = [];
    this.wards = [];
    this.groundItems = [];

    this.doors = new Map();
    for (const d of this.map.doors) {
      this.doors.set(d.id, { id: d.id, open: false, locked: !!d.locked, broken: false, t: 0 });
    }
    this.containers = new Map();
    for (const c of this.map.containers) this.containers.set(c.id, { id: c.id, searched: false });
    this.hides = new Map();
    for (const h of this.map.hidingSpots) this.hides.set(h.id, { id: h.id, occupant: null });

    this.initObjectives();
    this.spawnPlayers();
    this.bots = new BotController(this);

    // horror director
    this.horror = { next: 20 + this.rand.float(0, 15), tension: 0, lightsOutUntil: 0, lastType: null };
    this.stats = { hits: 0, downs: 0, kills: 0, escapes: 0, sealsBroken: 0 };
  }

  // ------------------------------------------------------------------ setup

  initObjectives() {
    const r = this.rand;
    // Pick which of the available sites are live this match.
    const seals = r.shuffle(this.map.seals).slice(0, OBJECTIVES.SEALS_REQUIRED + 2);
    const relics = r.shuffle(this.map.relics).slice(0, OBJECTIVES.RELIC_REQUIRED + 2);
    const pieces = r.shuffle(this.map.boxPieces).slice(0, OBJECTIVES.BOX_PIECES + 1);

    this.obj = {
      phase: 'seals',
      seals: seals.map((s) => ({ id: s.id, x: s.x, z: s.z, floor: s.floor, broken: false, progress: 0 })),
      relics: relics.map((s) => ({
        id: s.id, x: s.x, z: s.z, floor: s.floor, taken: false, carriedBy: null, delivered: false,
      })),
      pieces: pieces.map((s) => ({
        id: s.id, x: s.x, z: s.z, floor: s.floor, taken: false, carriedBy: null, delivered: false,
      })),
      sealsNeeded: OBJECTIVES.SEALS_REQUIRED,
      relicsNeeded: OBJECTIVES.RELIC_REQUIRED,
      piecesNeeded: OBJECTIVES.BOX_PIECES,
      sealsBroken: 0,
      relicsDelivered: 0,
      piecesDelivered: 0,
      box: {
        assembled: false,
        solvedBy: null,
        solved: false,
        solver: null,
        // 4 segments, each rotates through 6 symbol positions
        target: [r.int(0, 5), r.int(0, 5), r.int(0, 5), r.int(0, 5)],
        config: [0, 0, 0, 0],
        attempts: 0,
        heat: 0, // rises while being manipulated: attracts the Cenobite
      },
      gate: { unlocked: false, charge: 0, open: false, channelers: 0 },
    };
  }

  spawnPlayers() {
    const survivorSpawns = this.rand.shuffle(this.map.survivorSpawns);
    const cenobiteSpawns = this.rand.shuffle(this.map.cenobiteSpawns);
    let si = 0;
    let ci = 0;

    for (const lp of this.lobby.players.values()) {
      const isCeno = lp.role === ROLES.CENOBITE;
      const spot = isCeno
        ? cenobiteSpawns[ci++ % cenobiteSpawns.length]
        : survivorSpawns[si++ % survivorSpawns.length];
      this.players.set(lp.id, this.makePlayer(lp, spot, isCeno));
    }
  }

  makePlayer(lp, spot, isCeno) {
    const survivorDef = isCeno ? null : getSurvivor(lp.characterId);
    const p = {
      id: lp.id,
      name: lp.name,
      isBot: !!lp.isBot,
      role: lp.role,
      characterId: lp.characterId,
      x: spot.x,
      y: FLOOR_Y[spot.floor],
      z: spot.z,
      yaw: this.rand.float(-Math.PI, Math.PI),
      pitch: 0,
      floor: spot.floor,
      vx: 0,
      vz: 0,
      anim: 'idle',
      speedFrac: 0,
      crouching: false,
      sprinting: false,
      health: HEALTH.MAX,
      healthState: HEALTH_STATE.HEALTHY,
      stamina: STAMINA.MAX,
      fear: 0,
      bleeding: false,
      downedTimer: 0,
      iframes: 0,
      stun: 0,
      root: 0,
      hiding: null,
      inventory: [],
      carrying: null, // quest item id
      flashlight: { on: false, battery: 100 },
      interaction: null,
      lastInputAt: 0,
      lastSeq: -1,
      escaped: false,
      alive: true,
      chased: 0,
      revealUntil: 0,
      perk: survivorDef ? survivorDef.perk.id : null,
      activePerk: survivorDef ? survivorDef.active : null,
      perkCooldown: 0,
      perkActiveUntil: 0,
      // cenobite
      power: isCeno ? POWER.START : 0,
      cooldowns: {},
      executing: null,
      lastAttack: -99,
      // bot bookkeeping
      bot: null,
    };
    if (!isCeno) {
      p.inventory.push('flashlight');
      if (survivorDef && survivorDef.perk.id === 'triage') p.inventory.push('medkit');
      if (survivorDef && survivorDef.perk.id === 'benediction') p.inventory.push('chalk');
    }
    return p;
  }

  get survivors() {
    return [...this.players.values()].filter((p) => p.role === ROLES.SURVIVOR);
  }
  get cenobites() {
    return [...this.players.values()].filter((p) => p.role === ROLES.CENOBITE);
  }
  get activeSurvivors() {
    return this.survivors.filter((p) => p.alive && !p.escaped);
  }

  // ------------------------------------------------------------------- loop

  tick(dt) {
    this.time += dt;
    this.tickCount++;

    if (this.state === MATCH_STATE.INTRO) {
      if (this.time > 6.0) {
        this.state = MATCH_STATE.ACTIVE;
        this.emit(EV.PHASE, { phase: 'active' });
      }
      return;
    }
    if (this.state !== MATCH_STATE.ACTIVE) return;

    this.clock -= dt;

    for (const p of this.players.values()) this.tickPlayer(p, dt);
    this.bots.tick(dt);
    this.tickChains(dt);
    this.tickTraps(dt);
    this.tickGateways(dt);
    this.tickWards(dt);
    this.tickObjectives(dt);
    this.tickHorror(dt);
    this.checkEndConditions();
  }

  tickPlayer(p, dt) {
    // timers
    p.iframes = Math.max(0, p.iframes - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.root = Math.max(0, p.root - dt);
    p.chased = Math.max(0, p.chased - dt);
    p.perkCooldown = Math.max(0, p.perkCooldown - dt);
    for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);

    if (p.role === ROLES.CENOBITE) {
      p.power = clamp(p.power + POWER.REGEN * dt, 0, POWER.MAX);
      if (p.executing) {
        p.executing.t += dt;
        const victim = this.players.get(p.executing.victimId);
        if (!victim || victim.healthState !== HEALTH_STATE.DOWNED) {
          this.emit(EV.EXECUTION_END, { by: p.id, completed: false });
          p.executing = null;
        } else if (p.executing.t >= ABILITIES.EXECUTION.duration) {
          this.killPlayer(victim, p, 'execution');
          this.emit(EV.EXECUTION_END, { by: p.id, victim: victim.id, completed: true });
          p.executing = null;
          p.power = clamp(p.power + 20, 0, POWER.MAX);
        }
      }
      return;
    }

    if (!p.alive || p.escaped) return;

    // --- health ---
    if (p.healthState === HEALTH_STATE.DOWNED) {
      p.downedTimer += dt;
      if (p.downedTimer >= HEALTH.DOWNED_BLEEDOUT) this.killPlayer(p, null, 'bleedout');
      p.fear = clamp(p.fear + 10 * dt, 0, FEAR.MAX);
      return;
    }
    if (p.bleeding) {
      p.health = clamp(p.health - HEALTH.BLEED_RATE * dt, 1, HEALTH.MAX);
    }

    // --- stamina ---
    if (p.sprinting && p.speedFrac > 0.4 && !p.crouching) {
      p.stamina = clamp(p.stamina - STAMINA.DRAIN * dt, 0, STAMINA.MAX);
      p.staminaDelay = STAMINA.REGEN_DELAY;
    } else {
      p.staminaDelay = Math.max(0, (p.staminaDelay || 0) - dt);
      if (p.staminaDelay <= 0) p.stamina = clamp(p.stamina + STAMINA.REGEN * dt, 0, STAMINA.MAX);
    }

    // --- flashlight ---
    if (p.flashlight.on) {
      p.flashlight.battery = clamp(p.flashlight.battery - ITEMS.flashlight.drain * dt, 0, 100);
      if (p.flashlight.battery <= 0) p.flashlight.on = false;
    }

    // --- fear ---
    this.tickFear(p, dt);

    // --- interaction channel ---
    if (p.interaction) this.tickInteraction(p, dt);

    // --- hazards ---
    if (this.tickCount % 10 === 0) this.checkHazards(p);
  }

  tickFear(p, dt) {
    let delta = -FEAR.DECAY;
    const zone = zoneAt(this.map, p.floor, p.x, p.z);

    // proximity to a Cenobite
    let nearestCeno = Infinity;
    for (const c of this.cenobites) {
      if (c.floor !== p.floor) continue;
      const d = Math.sqrt(dist2(p.x, p.z, c.x, c.z));
      nearestCeno = Math.min(nearestCeno, d);
    }
    if (nearestCeno < FEAR.CENOBITE_RADIUS) {
      const t = 1 - nearestCeno / FEAR.CENOBITE_RADIUS;
      delta += FEAR.NEAR_CENOBITE * t * t;
    }
    if (p.chased > 0) delta += FEAR.CHASED;

    // darkness / light
    const lit = this.isLit(p);
    if (!lit) delta += FEAR.DARKNESS;
    else delta -= FEAR.LIGHT_RELIEF;
    if (p.flashlight.on) delta -= 2.0;
    if (zone.mood === 'candle' || zone.mood === 'gate') delta -= 1.5;

    // isolation vs company
    let mates = 0;
    let hasPriest = false;
    for (const o of this.survivors) {
      if (o === p || !o.alive || o.escaped) continue;
      if (o.floor !== p.floor) continue;
      if (dist2(p.x, p.z, o.x, o.z) < FEAR.ALONE_RADIUS * FEAR.ALONE_RADIUS) {
        mates++;
        if (o.perk === 'benediction' && dist2(p.x, p.z, o.x, o.z) < 100) hasPriest = true;
      }
    }
    if (mates === 0) delta += FEAR.ALONE;
    else delta -= FEAR.TEAMMATE_NEAR_RELIEF * Math.min(2, mates);
    if (hasPriest) delta -= FEAR.TEAMMATE_NEAR_RELIEF;

    if (p.healthState === HEALTH_STATE.INJURED) delta += FEAR.INJURED;
    if (this.obj.box.solver === p.id) delta += FEAR.PUZZLE_WHISPER;
    if (this.horror.lightsOutUntil > this.time) delta += 5;

    // Tobias' Steady Hand
    if (p.perk === 'steady' && delta > 0) delta *= 0.65;
    // hiding is calming, but only briefly
    if (p.hiding) delta -= 3;

    p.fear = clamp(p.fear + delta * dt, 0, FEAR.MAX);
  }

  /** Is this player standing in meaningful light? */
  isLit(p) {
    if (this.horror.lightsOutUntil > this.time) return false;
    if (p.flashlight.on && p.flashlight.battery > 0) return true;
    for (const l of this.map.lights) {
      if (l.floor !== p.floor) continue;
      if (dist2(p.x, p.z, l.x, l.z) < 81) return true;
    }
    return false;
  }

  checkHazards(p) {
    if (p.iframes > 0 || p.healthState === HEALTH_STATE.DOWNED) return;
    for (const h of this.map.hazards) {
      if (h.floor !== p.floor) continue;
      if (dist2(p.x, p.z, h.x, h.z) < 2.0) {
        this.damage(p, DAMAGE.HAZARD, null, 'hazard');
        p.iframes = 2.5;
        this.emit(EV.DAMAGE, { id: p.id, kind: h.kind, x: p.x, y: p.y, z: p.z, amount: DAMAGE.HAZARD });
        return;
      }
    }
  }

  // ------------------------------------------------------- movement + input

  /**
   * Client-reported movement. Validated for speed and geometry; anything
   * illegal is rejected and the client is snapped back.
   */
  applyInput(id, input) {
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    if (typeof input.seq === 'number') {
      if (input.seq <= p.lastSeq) return; // out of order / replayed
      p.lastSeq = input.seq;
    }
    if (this.state !== MATCH_STATE.ACTIVE && this.state !== MATCH_STATE.INTRO) return;

    // After the server forcibly moves a player (gateway, Lament Teleport, chain
    // drag, debug teleport) there are still position packets in flight that were
    // sent from the OLD location. Because teleportGrace relaxes the speed check,
    // those stale packets used to be accepted and would yank the player straight
    // back. Ignore client movement briefly after any forced move and let the
    // correction land first.
    if (p.forcedUntil && this.time < p.forcedUntil) return;

    const now = this.time;
    const dt = clamp(now - (p.lastInputAt || now - 0.05), 0.001, 0.5);
    p.lastInputAt = now;

    const nx = +input.x;
    const nz = +input.z;
    const nf = input.floor | 0;
    if (!Number.isFinite(nx) || !Number.isFinite(nz)) return;

    // -- geometry check: never accept a position inside solid rock
    if (isSolidWorld(this.map, nf, nx, nz)) {
      this.correct(p, 'geometry');
      return;
    }

    // -- speed check
    const maxSpeed = this.maxSpeedFor(p) * NET.MAX_SPEED_TOLERANCE;
    const moved = Math.hypot(nx - p.x, nz - p.z);
    const allowed = maxSpeed * dt + 0.6; // slack for jitter and stair snapping
    const teleported = p.teleportGrace && this.time < p.teleportGrace;
    if (moved > allowed && !teleported) {
      p.speedStrikes = (p.speedStrikes || 0) + 1;
      if (p.speedStrikes > 3) {
        this.correct(p, 'speed');
        p.speedStrikes = 0;
        return;
      }
    } else {
      p.speedStrikes = 0;
    }

    p.x = nx;
    p.z = nz;
    p.floor = nf;
    const g = groundAt(this.map, nf, nx, nz);
    p.y = g.y;
    if (g.onStair) p.floor = g.floor;
    p.yaw = +input.yaw || 0;
    p.pitch = clamp(+input.pitch || 0, -1.4, 1.4);
    p.anim = typeof input.anim === 'string' ? input.anim.slice(0, 16) : 'idle';
    p.speedFrac = clamp(+input.speedFrac || 0, 0, 1);
    p.crouching = !!input.crouching;
    p.sprinting = !!input.sprinting;
  }

  maxSpeedFor(p) {
    if (p.role === ROLES.CENOBITE) return CENOBITE_MOVE.SPRINT + CENOBITE_MOVE.CHASE_BONUS;
    if (p.healthState === HEALTH_STATE.DOWNED) return MOVE.DOWNED_CRAWL;
    let s = MOVE.SPRINT;
    if (p.healthState === HEALTH_STATE.INJURED) s *= MOVE.INJURED_MULT;
    if (p.perkActiveUntil > this.time && p.activePerk && p.activePerk.id === 'sprint_burst') s = MOVE.SPRINT * 1.15;
    if (p.perkActiveUntil > this.time && p.activePerk && p.activePerk.id === 'stimulant') s *= 1.25;
    return s;
  }

  correct(p, reason) {
    const sock = this.io.sockets.sockets.get(p.id);
    if (sock) sock.emit(S2C.CORRECTION, { x: p.x, y: p.y, z: p.z, floor: p.floor, reason });
  }

  // ------------------------------------------------------------- interaction

  /** Everything a player could be standing next to, with its channel time. */
  findInteractable(p, targetId) {
    const near = (o, r = 3.0) => o.floor === p.floor && dist2(p.x, p.z, o.x, o.z) < r * r;

    // seals
    for (const s of this.obj.seals) {
      if (s.id !== targetId || s.broken) continue;
      if (!near(s, 3.2)) return null;
      let dur = OBJECTIVES.SEAL_BREAK_TIME;
      if (p.perk === 'scholar') dur *= 0.7;
      return { type: 'seal', targetId: s.id, duration: dur, resumable: true };
    }
    // relics / pieces on the ground
    for (const list of [this.obj.relics, this.obj.pieces]) {
      for (const s of list) {
        if (s.id !== targetId || s.taken) continue;
        if (!near(s, 2.6)) return null;
        return { type: list === this.obj.relics ? 'relic' : 'piece', targetId: s.id, duration: 1.4 };
      }
    }
    // containers
    for (const c of this.map.containers) {
      if (c.id !== targetId) continue;
      const st = this.containers.get(c.id);
      if (!st || st.searched) return null;
      if (!near(c, 2.6)) return null;
      let dur = OBJECTIVES.SEARCH_TIME;
      if (p.perk === 'tumblers') dur *= 0.5;
      return { type: 'container', targetId: c.id, duration: dur };
    }
    // altar
    if (targetId === 'altar' && near(this.map.altar, 4.0)) {
      if (p.carrying === 'relic' || p.carrying === 'box_piece') {
        return { type: 'deliver', targetId: 'altar', duration: 1.6 };
      }
      if (this.obj.box.assembled && !this.obj.box.solved) {
        return { type: 'box', targetId: 'altar', duration: 0.6 };
      }
      return null;
    }
    // gate
    if (targetId === 'gate' && near(this.map.gate, 5.0)) {
      if (!this.obj.gate.unlocked) return null;
      if (this.obj.gate.open) return null;
      return { type: 'gate', targetId: 'gate', duration: OBJECTIVES.GATE_CHARGE_TIME, resumable: true, shared: true };
    }
    // doors
    for (const d of this.map.doors) {
      if (d.id !== targetId) continue;
      if (!near(d, 3.0)) return null;
      const st = this.doors.get(d.id);
      if (st.locked && !this.canUnlock(p, d)) return null;
      return { type: 'door', targetId: d.id, duration: st.locked ? (p.perk === 'tumblers' ? 4 : 8) : 0.35 };
    }
    // teammates: revive / heal
    const other = this.players.get(targetId);
    if (other && other.role === ROLES.SURVIVOR && other !== p && near(other, 2.4)) {
      if (other.healthState === HEALTH_STATE.DOWNED) {
        let dur = HEALTH.REVIVE_TIME;
        if (p.perk === 'benediction') dur *= 0.6;
        return { type: 'revive', targetId: other.id, duration: dur, resumable: true };
      }
      if (other.healthState === HEALTH_STATE.INJURED && p.inventory.includes('medkit')) {
        let dur = HEALTH.TEAM_HEAL_TIME;
        if (p.perk === 'triage') dur *= 0.5;
        if (p.perk === 'benediction') dur *= 0.6;
        return { type: 'heal', targetId: other.id, duration: dur, resumable: true };
      }
    }
    // hiding spots
    for (const h of this.map.hidingSpots) {
      if (h.id !== targetId) continue;
      if (!near(h, 2.4)) return null;
      const st = this.hides.get(h.id);
      if (st.occupant && st.occupant !== p.id) return null;
      return { type: 'hide', targetId: h.id, duration: 0.5 };
    }
    return null;
  }

  canUnlock(p, door) {
    if (door.unlockBy === 'ritual') return this.obj.gate.unlocked;
    if (door.unlockBy === 'key') return p.inventory.includes('key') || p.perk === 'tumblers';
    return true;
  }

  startInteraction(id, targetId) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.escaped) return;
    if (p.healthState === HEALTH_STATE.DOWNED || p.stun > 0 || p.root > 0) return;
    if (p.role === ROLES.CENOBITE) {
      this.cenobiteInteract(p, targetId);
      return;
    }
    const spec = this.findInteractable(p, targetId);
    if (!spec) return;
    p.interaction = { ...spec, progress: p.interaction && p.interaction.targetId === targetId ? p.interaction.progress : 0 };
    if (spec.duration <= 0.001) this.completeInteraction(p);
  }

  cancelInteraction(id) {
    const p = this.players.get(id);
    if (!p || !p.interaction) return;
    if (!p.interaction.resumable) p.interaction.progress = 0;
    p.interactionPaused = p.interaction.resumable ? p.interaction : null;
    p.interaction = null;
  }

  tickInteraction(p, dt) {
    const it = p.interaction;
    // still in range?
    const spec = this.findInteractable(p, it.targetId);
    if (!spec) {
      p.interaction = null;
      return;
    }
    let rate = 1;
    // fear makes delicate work harder
    if (p.fear > FEAR.TERRIFIED) rate *= 0.72;
    else if (p.fear > FEAR.AFRAID) rate *= 0.87;
    // co-op on the gate
    if (it.shared) {
      const helpers = this.survivors.filter(
        (o) => o !== p && o.interaction && o.interaction.type === it.type && o.interaction.targetId === it.targetId
      ).length;
      rate *= 1 + helpers * 0.6;
    }
    it.progress += dt * rate;
    if (it.type === 'seal') {
      const s = this.obj.seals.find((x) => x.id === it.targetId);
      if (s) s.progress = clamp(it.progress / it.duration, 0, 1);
    }
    if (it.type === 'gate') {
      this.obj.gate.charge = clamp(it.progress / it.duration, 0, 1);
    }
    if (it.progress >= it.duration) this.completeInteraction(p);
  }

  completeInteraction(p) {
    const it = p.interaction;
    if (!it) return;
    p.interaction = null;

    switch (it.type) {
      case 'seal': {
        const s = this.obj.seals.find((x) => x.id === it.targetId);
        if (!s || s.broken) break;
        s.broken = true;
        s.progress = 1;
        this.obj.sealsBroken++;
        this.stats.sealsBroken++;
        this.emit(EV.SEAL_BROKEN, { id: s.id, x: s.x, y: s.y, z: s.z, by: p.id, total: this.obj.sealsBroken });
        for (const c of this.cenobites) c.power = clamp(c.power + POWER.ON_OBJECTIVE_LOST, 0, POWER.MAX);
        this.advancePhase();
        break;
      }
      case 'relic':
      case 'piece': {
        const list = it.type === 'relic' ? this.obj.relics : this.obj.pieces;
        const s = list.find((x) => x.id === it.targetId);
        if (!s || s.taken) break;
        if (p.carrying) break; // one quest item at a time — real decisions
        s.taken = true;
        s.carriedBy = p.id;
        p.carrying = it.type === 'relic' ? 'relic' : 'box_piece';
        p.carryingId = s.id;
        this.emit(EV.ITEM_PICKUP, { id: p.id, item: p.carrying, objId: s.id });
        break;
      }
      case 'container': {
        const st = this.containers.get(it.targetId);
        if (!st || st.searched) break;
        st.searched = true;
        const roll = this.rand.next();
        let item = null;
        if (roll < 0.24) item = 'medkit';
        else if (roll < 0.42) item = 'key';
        else if (roll < 0.58) item = 'chalk';
        else if (roll < 0.72) item = 'lantern';
        else if (roll < 0.86) item = 'battery';
        if (item === 'battery') {
          p.flashlight.battery = 100;
          item = null;
        } else if (item && p.inventory.length < 3) {
          p.inventory.push(item);
        }
        this.emit(EV.CONTAINER_SEARCHED, { id: it.targetId, by: p.id, item });
        break;
      }
      case 'deliver': {
        if (p.carrying === 'relic') {
          const s = this.obj.relics.find((x) => x.id === p.carryingId);
          if (s) {
            s.delivered = true;
            this.obj.relicsDelivered++;
          }
          this.emit(EV.RELIC_DELIVERED, { by: p.id, total: this.obj.relicsDelivered });
        } else if (p.carrying === 'box_piece') {
          const s = this.obj.pieces.find((x) => x.id === p.carryingId);
          if (s) {
            s.delivered = true;
            this.obj.piecesDelivered++;
          }
          this.emit(EV.PIECE_DELIVERED, { by: p.id, total: this.obj.piecesDelivered });
        }
        p.carrying = null;
        p.carryingId = null;
        for (const c of this.cenobites) c.power = clamp(c.power + POWER.ON_OBJECTIVE_LOST * 0.5, 0, POWER.MAX);
        this.advancePhase();
        break;
      }
      case 'box': {
        if (this.obj.box.solved) break;
        this.obj.box.solver = p.id;
        this.obj.box.heat = Math.max(this.obj.box.heat, 0.35);
        this.emit(EV.BOX_INTERACT, { by: p.id, target: this.obj.box.target.length, config: this.obj.box.config });
        // Opening the box is loud. Everyone hears it; the Cenobite is told where.
        this.emit(EV.SOUND, { kind: 'box_open', x: this.map.altar.x, y: this.map.altar.y, z: this.map.altar.z, global: true });
        break;
      }
      case 'gate': {
        this.obj.gate.open = true;
        this.obj.gate.charge = 1;
        this.emit(EV.GATE_OPEN, { by: p.id });
        for (const d of this.map.doors) {
          if (d.unlockBy === 'ritual') {
            const st = this.doors.get(d.id);
            st.locked = false;
            st.open = true;
            this.emit(EV.DOOR, { id: d.id, open: true });
          }
        }
        break;
      }
      case 'door': {
        const st = this.doors.get(it.targetId);
        if (!st) break;
        st.locked = false;
        st.open = !st.open;
        this.emit(EV.DOOR, { id: it.targetId, open: st.open, by: p.id });
        break;
      }
      case 'revive': {
        const o = this.players.get(it.targetId);
        if (!o || o.healthState !== HEALTH_STATE.DOWNED) break;
        o.healthState = HEALTH_STATE.INJURED;
        o.health = HEALTH.INJURED_AT - 10;
        o.bleeding = true;
        o.downedTimer = 0;
        this.emit(EV.REVIVED, { id: o.id, by: p.id });
        break;
      }
      case 'heal': {
        const o = this.players.get(it.targetId);
        if (!o) break;
        o.health = HEALTH.MAX;
        o.healthState = HEALTH_STATE.HEALTHY;
        o.bleeding = false;
        const i = p.inventory.indexOf('medkit');
        if (i >= 0) p.inventory.splice(i, 1);
        this.emit(EV.HEALED, { id: o.id, by: p.id });
        break;
      }
      case 'hide': {
        const st = this.hides.get(it.targetId);
        if (!st || (st.occupant && st.occupant !== p.id)) break;
        st.occupant = p.id;
        p.hiding = it.targetId;
        const spot = this.map.hidingSpots.find((h) => h.id === it.targetId);
        if (spot) {
          p.x = spot.x;
          p.z = spot.z;
          p.teleportGrace = this.time + 0.6;
          p.forcedUntil = this.time + 0.3;
        }
        this.emit(EV.HIDE_ENTER, { id: p.id, spot: it.targetId });
        break;
      }
      case 'selfheal': {
        p.health = HEALTH.MAX;
        p.healthState = HEALTH_STATE.HEALTHY;
        p.bleeding = false;
        const i = p.inventory.indexOf('medkit');
        if (i >= 0) p.inventory.splice(i, 1);
        this.emit(EV.HEALED, { id: p.id, by: p.id });
        break;
      }
    }
    this.broadcastObjectives();
  }

  advancePhase() {
    const o = this.obj;
    const prev = o.phase;
    if (o.sealsBroken < o.sealsNeeded) o.phase = 'seals';
    else if (o.relicsDelivered < o.relicsNeeded) o.phase = 'relics';
    else if (o.piecesDelivered < o.piecesNeeded) o.phase = 'pieces';
    else if (!o.box.assembled) {
      o.box.assembled = true;
      o.phase = 'box';
      this.emit(EV.BOX_ASSEMBLED, { x: this.map.altar.x, y: this.map.altar.y, z: this.map.altar.z });
    } else if (!o.box.solved) o.phase = 'box';
    else o.phase = 'escape';
    if (o.phase !== prev) this.emit(EV.PHASE, { phase: o.phase });
  }

  // -------------------------------------------------------- Lament box logic

  rotateBox(id, segment, dir) {
    const p = this.players.get(id);
    const box = this.obj.box;
    if (!p || !box.assembled || box.solved) return;
    if (box.solver !== p.id) return;
    if (dist2(p.x, p.z, this.map.altar.x, this.map.altar.z) > 25) return;
    const seg = segment | 0;
    if (seg < 0 || seg >= box.config.length) return;
    box.config[seg] = (box.config[seg] + (dir > 0 ? 1 : 5)) % 6;
    box.heat = clamp(box.heat + 0.09, 0, 1);
    p.fear = clamp(p.fear + 3, 0, FEAR.MAX);
    this.emit(EV.BOX_ROTATE, { by: p.id, segment: seg, value: box.config[seg], heat: box.heat });

    // The box always answers. Heat is what the Cenobite feels.
    if (box.heat > 0.5 && this.rand.chance(0.16)) {
      this.spawnHorror('whispers', this.map.altar);
    }
    if (box.config.every((v, i) => v === box.target[i])) this.solveBox(p);
  }

  submitBox(id) {
    const p = this.players.get(id);
    const box = this.obj.box;
    if (!p || !box.assembled || box.solved || box.solver !== p.id) return;
    if (box.config.every((v, i) => v === box.target[i])) {
      this.solveBox(p);
    } else {
      // wrong: the box takes something for the trouble
      box.attempts++;
      box.heat = clamp(box.heat + 0.25, 0, 1);
      this.damage(p, 12 + box.attempts * 4, null, 'box');
      p.fear = clamp(p.fear + 22, 0, FEAR.MAX);
      this.emit(EV.BOX_FAILED, { by: p.id, attempts: box.attempts, heat: box.heat });
      // and it opens something
      this.spawnChainAt(this.map.altar.x, this.map.altar.z, this.map.altar.floor, null);
      if (box.attempts >= 2) this.spawnHorror('corridor_shift', this.map.altar);
    }
  }

  solveBox(p) {
    const box = this.obj.box;
    box.solved = true;
    box.solvedBy = p.id;
    this.obj.gate.unlocked = true;
    this.emit(EV.BOX_SOLVED, { by: p.id, x: this.map.altar.x, y: this.map.altar.y, z: this.map.altar.z });
    this.emit(EV.GATE_PROGRESS, { unlocked: true });
    // consequences, good and bad
    for (const c of this.cenobites) {
      c.power = clamp(c.power + 30, 0, POWER.MAX);
      c.cooldowns[ABILITIES.LAMENT_TELEPORT.id] = 0;
    }
    // the solver is marked
    p.revealUntil = this.time + 15;
    p.fear = FEAR.MAX;
    for (const s of this.activeSurvivors) s.fear = clamp(s.fear + 25, 0, FEAR.MAX);
    this.spawnHorror('lights_out', this.map.altar);
    this.advancePhase();
    this.broadcastObjectives();
  }

  // ------------------------------------------------------------- combat

  damage(p, amount, source, kind) {
    if (!p.alive || p.escaped) return false;
    if (p.iframes > 0 && kind !== 'execution') return false;
    if (p.role === ROLES.CENOBITE) return false;
    if (p.healthState === HEALTH_STATE.DOWNED) return false;

    p.health = clamp(p.health - amount, 0, HEALTH.MAX);
    p.iframes = DAMAGE.IFRAMES;
    p.stun = DAMAGE.HIT_STUN;
    p.fear = clamp(p.fear + 18, 0, FEAR.MAX);
    if (p.hiding) this.exitHide(p);
    if (p.interaction) p.interaction = null;
    this.stats.hits++;

    this.emit(EV.DAMAGE, {
      id: p.id, amount, kind, by: source ? source.id : null, x: p.x, y: p.y, z: p.z,
    });

    if (p.health <= 0) {
      this.downPlayer(p, source);
    } else if (p.health < HEALTH.INJURED_AT) {
      if (p.healthState !== HEALTH_STATE.INJURED) {
        p.healthState = HEALTH_STATE.INJURED;
        p.bleeding = true;
      }
    }
    if (source && source.role === ROLES.CENOBITE) {
      source.power = clamp(source.power + POWER.ON_HIT, 0, POWER.MAX);
    }
    return true;
  }

  downPlayer(p, source) {
    p.healthState = HEALTH_STATE.DOWNED;
    p.health = 0;
    p.downedTimer = 0;
    p.bleeding = false;
    p.sprinting = false;
    p.anim = 'downed';
    this.stats.downs++;
    if (source) source.power = clamp(source.power + POWER.ON_DOWN, 0, POWER.MAX);
    this.emit(EV.DOWNED, { id: p.id, by: source ? source.id : null, x: p.x, y: p.y, z: p.z });
    for (const s of this.activeSurvivors) {
      if (s === p) continue;
      if (dist2(s.x, s.z, p.x, p.z) < 900) s.fear = clamp(s.fear + FEAR.WITNESS_DEATH * 0.5, 0, FEAR.MAX);
    }
  }

  killPlayer(p, source, kind) {
    p.alive = false;
    p.healthState = HEALTH_STATE.DEAD;
    p.anim = 'dead';
    if (p.hiding) this.exitHide(p);
    this.dropCarried(p);
    this.stats.kills++;
    this.emit(EV.DEATH, { id: p.id, by: source ? source.id : null, kind, x: p.x, y: p.y, z: p.z });
    for (const s of this.activeSurvivors) s.fear = clamp(s.fear + FEAR.WITNESS_DEATH, 0, FEAR.MAX);
    this.broadcastObjectives();
  }

  dropCarried(p) {
    if (!p.carrying) return;
    const list = p.carrying === 'relic' ? this.obj.relics : this.obj.pieces;
    const s = list.find((x) => x.id === p.carryingId);
    if (s) {
      s.taken = false;
      s.carriedBy = null;
      s.x = p.x;
      s.z = p.z;
      s.floor = p.floor;
    }
    this.emit(EV.ITEM_DROP, { id: p.id, item: p.carrying, objId: p.carryingId, x: p.x, y: p.y, z: p.z });
    p.carrying = null;
    p.carryingId = null;
  }

  exitHide(p) {
    if (!p.hiding) return;
    const st = this.hides.get(p.hiding);
    if (st) st.occupant = null;
    this.emit(EV.HIDE_EXIT, { id: p.id, spot: p.hiding });
    p.hiding = null;
  }

  attack(id) {
    const p = this.players.get(id);
    if (!p || p.role !== ROLES.CENOBITE || p.executing) return;
    if (this.time - p.lastAttack < DAMAGE.MELEE_COOLDOWN) return;
    p.lastAttack = this.time;
    this.emit(EV.MELEE_SWING, { id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw });

    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    let best = null;
    let bestD = Infinity;
    for (const s of this.activeSurvivors) {
      if (s.floor !== p.floor) continue;
      if (s.hiding) continue;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > DAMAGE.MELEE_RANGE) continue;
      const dot = (dx / (d || 1)) * fx + (dz / (d || 1)) * fz;
      if (Math.acos(clamp(dot, -1, 1)) > DAMAGE.MELEE_ARC) continue;
      if (!hasLineOfSight(this.map, p.floor, p.x, p.z, s.x, s.z)) continue;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) {
      const braced = best.perkActiveUntil > this.time && best.activePerk && best.activePerk.id === 'brace';
      this.damage(best, braced ? DAMAGE.CENOBITE_MELEE * 0.6 : DAMAGE.CENOBITE_MELEE, p, 'melee');
      if (braced) best.stun = 0;
      best.chased = 6;
    }
  }

  execute(id) {
    const p = this.players.get(id);
    if (!p || p.role !== ROLES.CENOBITE || p.executing) return;
    if ((p.cooldowns[ABILITIES.EXECUTION.id] || 0) > 0) return;
    const victim = this.activeSurvivors.find(
      (s) =>
        s.healthState === HEALTH_STATE.DOWNED &&
        s.floor === p.floor &&
        dist2(p.x, p.z, s.x, s.z) < ABILITIES.EXECUTION.range ** 2
    );
    if (!victim) return;
    p.executing = { victimId: victim.id, t: 0 };
    p.cooldowns[ABILITIES.EXECUTION.id] = ABILITIES.EXECUTION.cooldown + ABILITIES.EXECUTION.duration;
    this.emit(EV.EXECUTION_START, {
      by: p.id, victim: victim.id, x: victim.x, y: victim.y, z: victim.z, yaw: p.yaw,
      duration: ABILITIES.EXECUTION.duration,
    });
    for (const s of this.activeSurvivors) s.fear = clamp(s.fear + 12, 0, FEAR.MAX);
  }

  // ---------------------------------------------------------- abilities

  wardBlocks(x, z, floor) {
    return this.wards.some((w) => w.floor === floor && dist2(x, z, w.x, w.z) < w.radius * w.radius);
  }

  useAbility(id, abilityId, payload = {}) {
    const p = this.players.get(id);
    if (!p || p.role !== ROLES.CENOBITE || p.executing) return;
    const def = Object.values(ABILITIES).find((a) => a.id === abilityId);
    if (!def) return;
    if ((p.cooldowns[abilityId] || 0) > 0) return;
    if (def.powerCost && p.power < def.powerCost) return;
    if (this.wardBlocks(p.x, p.z, p.floor)) {
      this.emit(EV.ABILITY_CAST, { by: p.id, ability: abilityId, blocked: true });
      return;
    }

    switch (abilityId) {
      case ABILITIES.CHAIN_SUMMON.id: {
        const yaw = typeof payload.yaw === 'number' ? payload.yaw : p.yaw;
        const pitch = clamp(payload.pitch || 0, -0.6, 0.6);
        this.spawnChain(p, yaw, pitch);
        break;
      }
      case ABILITIES.CHAIN_TRAP.id: {
        const active = this.traps.filter((t) => t.owner === p.id).length;
        if (active >= ABILITIES.CHAIN_TRAP.maxActive) {
          const oldest = this.traps.find((t) => t.owner === p.id);
          if (oldest) this.removeTrap(oldest);
        }
        const t = {
          eid: nextEntityId++,
          owner: p.id,
          x: p.x,
          z: p.z,
          y: p.y,
          floor: p.floor,
          arm: ABILITIES.CHAIN_TRAP.armTime,
          life: ABILITIES.CHAIN_TRAP.duration,
          triggered: false,
        };
        this.traps.push(t);
        this.emit(EV.TRAP_PLACED, { eid: t.eid, x: t.x, y: t.y, z: t.z, floor: t.floor, by: p.id });
        break;
      }
      case ABILITIES.GATEWAY.id: {
        const tx = +payload.x;
        const tz = +payload.z;
        const tf = payload.floor | 0;
        if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
        if (dist2(p.x, p.z, tx, tz) > def.range * def.range) return;
        if (isSolidWorld(this.map, tf, tx, tz)) return;
        const g = {
          eid: nextEntityId++,
          owner: p.id,
          ax: p.x, az: p.z, af: p.floor, ay: p.y,
          bx: tx, bz: tz, bf: tf, by: groundAt(this.map, tf, tx, tz).y,
          life: 14,
        };
        this.gateways.push(g);
        this.emit(EV.GATEWAY_OPEN, { ...g });
        this.emit(EV.SOUND, { kind: 'portal', x: tx, y: g.by, z: tz, radius: 40 });
        break;
      }
      case ABILITIES.PAIN_SENSE.id: {
        const revealed = [];
        for (const s of this.activeSurvivors) {
          if (
            s.healthState === HEALTH_STATE.INJURED ||
            s.healthState === HEALTH_STATE.DOWNED ||
            s.bleeding ||
            s.fear >= def.fearThreshold
          ) {
            s.revealUntil = this.time + def.duration;
            revealed.push(s.id);
          }
        }
        this.emit(EV.PAIN_SENSE, { by: p.id, revealed, duration: def.duration });
        break;
      }
      case ABILITIES.LAMENT_TELEPORT.id: {
        const box = this.obj.box;
        if (!box.assembled || box.solved || !box.solver) return;
        const target = this.players.get(box.solver);
        if (!target) return;
        const spot = this.findSpotNear(target.x, target.z, target.floor, 3.5);
        if (!spot) return;
        p.x = spot.x;
        p.z = spot.z;
        p.floor = target.floor;
        p.y = groundAt(this.map, p.floor, p.x, p.z).y;
        p.teleportGrace = this.time + 1.5;
      p.forcedUntil = this.time + 0.35;
        this.emit(EV.ABILITY_CAST, {
          by: p.id, ability: abilityId, x: p.x, y: p.y, z: p.z, floor: p.floor, teleport: true,
        });
        target.fear = FEAR.MAX;
        break;
      }
    }

    p.cooldowns[abilityId] = def.cooldown;
    if (def.powerCost) p.power = clamp(p.power - def.powerCost, 0, POWER.MAX);
    this.emit(EV.ABILITY_CAST, { by: p.id, ability: abilityId, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
  }

  findSpotNear(x, z, floor, radius) {
    for (let i = 0; i < 24; i++) {
      const a = this.rand.float(0, Math.PI * 2);
      const r = this.rand.float(1.5, radius);
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      if (!isSolidWorld(this.map, floor, nx, nz)) return { x: nx, z: nz };
    }
    return isSolidWorld(this.map, floor, x, z) ? null : { x, z };
  }

  enterGateway(id) {
    const p = this.players.get(id);
    if (!p) return;
    for (const g of this.gateways) {
      if (g.owner !== p.id) continue;
      const nearA = g.af === p.floor && dist2(p.x, p.z, g.ax, g.az) < 4;
      const nearB = g.bf === p.floor && dist2(p.x, p.z, g.bx, g.bz) < 4;
      if (!nearA && !nearB) continue;
      if (nearA) {
        p.x = g.bx;
        p.z = g.bz;
        p.floor = g.bf;
      } else {
        p.x = g.ax;
        p.z = g.az;
        p.floor = g.af;
      }
      p.y = groundAt(this.map, p.floor, p.x, p.z).y;
      p.teleportGrace = this.time + 1.5;
      p.forcedUntil = this.time + 0.35;
      this.emit(EV.GATEWAY_USED, { eid: g.eid, by: p.id, x: p.x, y: p.y, z: p.z, floor: p.floor });
      return;
    }
  }

  spawnChain(owner, yaw, pitch) {
    const c = {
      eid: nextEntityId++,
      owner: owner.id,
      x: owner.x,
      y: owner.y + 1.3,
      z: owner.z,
      floor: owner.floor,
      dx: -Math.sin(yaw) * Math.cos(pitch),
      dy: Math.sin(pitch),
      dz: -Math.cos(yaw) * Math.cos(pitch),
      travelled: 0,
      speed: ABILITIES.CHAIN_SUMMON.speed,
      range: ABILITIES.CHAIN_SUMMON.range,
      dead: false,
      ox: owner.x,
      oy: owner.y + 1.3,
      oz: owner.z,
    };
    this.chains.push(c);
    this.emit(EV.CHAIN_SPAWN, { ...c });
  }

  /** Chain that erupts from the world rather than from a Cenobite (box failure). */
  spawnChainAt(x, z, floor, ownerId) {
    const a = this.rand.float(0, Math.PI * 2);
    const c = {
      eid: nextEntityId++,
      owner: ownerId,
      x, y: FLOOR_Y[floor] + 0.4, z, floor,
      dx: Math.cos(a), dy: 0.25, dz: Math.sin(a),
      travelled: 0,
      speed: 22,
      range: 14,
      dead: false,
      ox: x, oy: FLOOR_Y[floor] + 0.4, oz: z,
    };
    this.chains.push(c);
    this.emit(EV.CHAIN_SPAWN, { ...c });
  }

  tickChains(dt) {
    for (const c of this.chains) {
      if (c.dead) continue;
      const step = c.speed * dt;
      const nx = c.x + c.dx * step;
      const ny = c.y + c.dy * step;
      const nz = c.z + c.dz * step;
      c.travelled += step;

      if (isSolidWorld(this.map, c.floor, nx, nz) || c.travelled > c.range) {
        c.dead = true;
        this.emit(EV.CHAIN_END, { eid: c.eid, x: c.x, y: c.y, z: c.z, hit: false });
        continue;
      }
      c.x = nx;
      c.y = ny;
      c.z = nz;

      for (const s of this.activeSurvivors) {
        if (s.floor !== c.floor || s.hiding) continue;
        if (s.healthState === HEALTH_STATE.DOWNED) continue;
        if (dist2(c.x, c.z, s.x, s.z) > 1.1) continue;
        c.dead = true;
        const owner = c.owner ? this.players.get(c.owner) : null;
        this.damage(s, DAMAGE.CHAIN_HIT, owner, 'chain');
        s.root = 1.7;
        s.chased = 8;
        s.revealUntil = this.time + 5;
        // drag the survivor a little toward the source
        if (owner) {
          const dx = owner.x - s.x;
          const dz = owner.z - s.z;
          const d = Math.hypot(dx, dz) || 1;
          const drag = Math.min(3.5, d * 0.45);
          const tx = s.x + (dx / d) * drag;
          const tz = s.z + (dz / d) * drag;
          if (!isSolidWorld(this.map, s.floor, tx, tz)) {
            s.x = tx;
            s.z = tz;
            s.teleportGrace = this.time + 0.8;
            s.forcedUntil = this.time + 0.3;
          }
        }
        this.emit(EV.CHAIN_HIT, { eid: c.eid, target: s.id, x: s.x, y: s.y, z: s.z });
        break;
      }
    }
    this.chains = this.chains.filter((c) => !c.dead);
  }

  tickTraps(dt) {
    for (const t of this.traps) {
      t.arm = Math.max(0, t.arm - dt);
      t.life -= dt;
      if (t.life <= 0) {
        t.remove = true;
        continue;
      }
      if (t.arm > 0 || t.triggered) continue;
      for (const s of this.activeSurvivors) {
        if (s.floor !== t.floor || s.hiding) continue;
        if (s.healthState === HEALTH_STATE.DOWNED) continue;
        if (dist2(s.x, s.z, t.x, t.z) > ABILITIES.CHAIN_TRAP.radius ** 2) continue;
        t.triggered = true;
        t.remove = true;
        const owner = this.players.get(t.owner);
        this.damage(s, DAMAGE.CHAIN_TRAP, owner, 'trap');
        s.root = ABILITIES.CHAIN_TRAP.rootTime;
        s.revealUntil = this.time + 8;
        this.emit(EV.TRAP_TRIGGERED, { eid: t.eid, target: s.id, x: t.x, y: t.y, z: t.z });
        this.emit(EV.SOUND, { kind: 'trap', x: t.x, y: t.y, z: t.z, radius: 45 });
        break;
      }
    }
    for (const t of this.traps) if (t.remove) this.emit(EV.TRAP_REMOVED, { eid: t.eid });
    this.traps = this.traps.filter((t) => !t.remove);
  }

  removeTrap(t) {
    t.remove = true;
  }

  tickGateways(dt) {
    for (const g of this.gateways) g.life -= dt;
    const expired = this.gateways.filter((g) => g.life <= 0);
    for (const g of expired) this.emit(EV.GATEWAY_USED, { eid: g.eid, expired: true });
    this.gateways = this.gateways.filter((g) => g.life > 0);
  }

  tickWards(dt) {
    for (const w of this.wards) w.life -= dt;
    this.wards = this.wards.filter((w) => w.life > 0);
  }

  useActivePerk(id) {
    const p = this.players.get(id);
    if (!p || p.role !== ROLES.SURVIVOR || !p.activePerk) return;
    if (p.perkCooldown > 0 || !p.alive || p.healthState === HEALTH_STATE.DOWNED) return;
    const a = p.activePerk;
    p.perkCooldown = a.cooldown;
    p.perkActiveUntil = this.time + (a.duration || 0);

    if (a.id === 'ward') {
      this.wards.push({ eid: nextEntityId++, x: p.x, z: p.z, y: p.y, floor: p.floor, radius: 7, life: a.duration });
      this.emit(EV.WARD_PLACED, { x: p.x, y: p.y, z: p.z, floor: p.floor, radius: 7, duration: a.duration, by: p.id });
    } else if (a.id === 'stimulant') {
      const target =
        this.activeSurvivors
          .filter((o) => o.healthState === HEALTH_STATE.INJURED && dist2(o.x, o.z, p.x, p.z) < 100)
          .sort((x, y) => dist2(x.x, x.z, p.x, p.z) - dist2(y.x, y.z, p.x, p.z))[0] || p;
      target.bleeding = false;
      target.perkActiveUntil = this.time + a.duration;
      target.activePerk = target.activePerk || a;
      this.emit(EV.HEALED, { id: target.id, by: p.id, partial: true });
    } else if (a.id === 'jam') {
      let best = null;
      let bd = 64;
      for (const d of this.map.doors) {
        if (d.f !== p.floor) continue;
        const dd = dist2(d.x, d.z, p.x, p.z);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (best) {
        const st = this.doors.get(best.id);
        st.open = false;
        st.jammedUntil = this.time + a.duration;
        this.emit(EV.DOOR, { id: best.id, open: false, jammed: true, by: p.id });
      }
    }
    this.emit(EV.PERK_ACTIVE, { id: p.id, perk: a.id, duration: a.duration || 0 });
  }

  useItem(id, item) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (item === 'medkit' && p.inventory.includes('medkit')) {
      if (p.healthState !== HEALTH_STATE.INJURED) return;
      p.interaction = { type: 'selfheal', targetId: p.id, duration: HEALTH.SELF_HEAL_TIME * (p.perk === 'triage' ? 0.6 : 1), progress: 0, resumable: true };
    }
  }

  toggleFlashlight(id) {
    const p = this.players.get(id);
    if (!p || !p.inventory.includes('flashlight')) return;
    if (p.flashlight.battery <= 0) return;
    p.flashlight.on = !p.flashlight.on;
  }

  vault(id, vaultId) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const v = this.map.vaults.find((x) => x.id === vaultId);
    if (!v || v.f !== p.floor) return;
    if (dist2(p.x, p.z, v.x, v.z) > 9) return;
    if (p.role === ROLES.SURVIVOR && p.perk !== 'freerunner') {
      p.stamina = clamp(p.stamina - STAMINA.VAULT_COST, 0, STAMINA.MAX);
    }
    p.teleportGrace = this.time + 1.0;
    this.emit(EV.VAULT, { id: p.id, vault: vaultId, x: v.x, y: v.y, z: v.z });
    if (p.role === ROLES.SURVIVOR && p.perk !== 'freerunner') {
      this.emit(EV.SOUND, { kind: 'vault', x: v.x, y: v.y, z: v.z, radius: 26 });
    }
  }

  unhide(id) {
    const p = this.players.get(id);
    if (p) this.exitHide(p);
  }

  // -------------------------------------------------------- objectives tick

  tickObjectives(dt) {
    const box = this.obj.box;
    if (box.assembled && !box.solved) {
      box.heat = clamp(box.heat - 0.03 * dt, 0, 1);
      // solver walked away?
      if (box.solver) {
        const s = this.players.get(box.solver);
        if (!s || !s.alive || s.healthState === HEALTH_STATE.DOWNED || dist2(s.x, s.z, this.map.altar.x, this.map.altar.z) > 36) {
          box.solver = null;
        }
      }
    }
    // gate charge decays if nobody is channelling
    if (this.obj.gate.unlocked && !this.obj.gate.open) {
      const channelling = this.survivors.some((s) => s.interaction && s.interaction.type === 'gate');
      if (!channelling) this.obj.gate.charge = clamp(this.obj.gate.charge - 0.02 * dt, 0, 1);
    }
    // escape check
    if (this.obj.gate.open) {
      for (const s of this.activeSurvivors) {
        if (s.floor !== this.map.gate.floor) continue;
        if (s.healthState === HEALTH_STATE.DOWNED) continue;
        if (dist2(s.x, s.z, this.map.gate.x, this.map.gate.z) < 9) {
          s.escaped = true;
          s.healthState = HEALTH_STATE.ESCAPED;
          this.stats.escapes++;
          this.dropCarried(s);
          this.emit(EV.ESCAPED, { id: s.id });
        }
      }
    }
    // door jam expiry
    for (const [, st] of this.doors) {
      if (st.jammedUntil && st.jammedUntil < this.time) st.jammedUntil = 0;
    }
    if (this.tickCount % 20 === 0) this.broadcastObjectives();
  }

  broadcastObjectives() {
    this.emit(EV.OBJECTIVE_UPDATE, this.objectiveSummary());
  }

  objectiveSummary() {
    const o = this.obj;
    return {
      phase: o.phase,
      seals: { done: o.sealsBroken, need: o.sealsNeeded, sites: o.seals.map((s) => ({ id: s.id, x: s.x, z: s.z, floor: s.floor, broken: s.broken, progress: s.progress })) },
      relics: { done: o.relicsDelivered, need: o.relicsNeeded, sites: o.relics.map((s) => ({ id: s.id, x: s.x, z: s.z, floor: s.floor, taken: s.taken, delivered: s.delivered })) },
      pieces: { done: o.piecesDelivered, need: o.piecesNeeded, sites: o.pieces.map((s) => ({ id: s.id, x: s.x, z: s.z, floor: s.floor, taken: s.taken, delivered: s.delivered })) },
      box: { assembled: o.box.assembled, solved: o.box.solved, solver: o.box.solver, config: o.box.config, heat: o.box.heat, attempts: o.box.attempts },
      gate: { ...o.gate },
    };
  }

  // ---------------------------------------------------------- horror director

  tickHorror(dt) {
    const survivors = this.activeSurvivors;
    if (!survivors.length) return;
    const avgFear = survivors.reduce((a, s) => a + s.fear, 0) / survivors.length;
    this.horror.tension = avgFear / FEAR.MAX;

    this.horror.next -= dt;
    if (this.horror.next > 0) return;

    // Pace events against tension: quiet when they're already terrified.
    const gap = 18 + this.horror.tension * 28 + this.rand.float(0, 14);
    this.horror.next = gap;

    const pool = ['chains_stir', 'door_slam', 'distant_scream', 'whispers', 'blood_walls', 'silhouette', 'apparition'];
    if (this.horror.tension < 0.5) pool.push('lights_out', 'corridor_shift');
    let type = this.rand.pick(pool);
    if (type === this.horror.lastType) type = this.rand.pick(pool);
    this.horror.lastType = type;

    const target = this.rand.pick(survivors);
    const spot = this.findSpotNear(target.x, target.z, target.floor, 16) || { x: target.x, z: target.z };
    this.spawnHorror(type, { x: spot.x, z: spot.z, y: target.y, floor: target.floor });
  }

  spawnHorror(type, at) {
    const payload = { type, x: at.x, y: at.y || 0, z: at.z, floor: at.floor ?? 0 };
    if (type === 'lights_out') {
      this.horror.lightsOutUntil = this.time + 9;
      payload.duration = 9;
      this.emit(EV.LIGHTS, { on: false, duration: 9 });
    }
    this.emit(EV.HORROR, payload);
    for (const s of this.activeSurvivors) {
      if (s.floor !== payload.floor) continue;
      if (dist2(s.x, s.z, payload.x, payload.z) < 400) {
        s.fear = clamp(s.fear + FEAR.SUPERNATURAL_EVENT, 0, FEAR.MAX);
      }
    }
  }

  // ---------------------------------------------------------------- end

  checkEndConditions() {
    const alive = this.activeSurvivors;
    const totalSurvivors = this.survivors.length;
    if (totalSurvivors === 0) return;
    if (alive.length === 0) {
      this.end('cenobite', 'Every soul accounted for.');
      return;
    }
    if (this.clock <= 0) {
      this.end('cenobite', 'The Labyrinth keeps what it holds.');
      return;
    }
    const escaped = this.survivors.filter((s) => s.escaped).length;
    const dead = this.survivors.filter((s) => !s.alive).length;
    if (escaped + dead >= totalSurvivors) {
      this.end(escaped > 0 ? 'survivors' : 'cenobite', escaped > 0 ? 'The Gate closed behind them.' : 'None returned.');
    }
  }

  end(winner, message) {
    if (this.state === MATCH_STATE.ENDED) return;
    this.state = MATCH_STATE.ENDED;
    this.io.to(this.room).emit(S2C.MATCH_END, {
      winner,
      message,
      stats: this.stats,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, role: p.role, characterId: p.characterId,
        escaped: p.escaped, alive: p.alive, healthState: p.healthState, isBot: p.isBot,
      })),
    });
  }

  // ------------------------------------------------------------- networking

  emit(type, data) {
    this.pendingEvents.push({ type, ...data });
  }

  flushEvents() {
    if (!this.pendingEvents.length) return;
    this.io.to(this.room).emit(S2C.EVENT, this.pendingEvents);
    this.pendingEvents = [];
  }

  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      players.push({
        i: p.id,
        x: +p.x.toFixed(2),
        y: +p.y.toFixed(2),
        z: +p.z.toFixed(2),
        r: +p.yaw.toFixed(3),
        p: +p.pitch.toFixed(2),
        f: p.floor,
        a: p.anim,
        sf: +p.speedFrac.toFixed(2),
        c: p.crouching ? 1 : 0,
        h: Math.round(p.health),
        hs: p.healthState,
        st: Math.round(p.stamina),
        fe: Math.round(p.fear),
        bl: p.bleeding ? 1 : 0,
        hd: p.hiding ? 1 : 0,
        fl: p.flashlight.on ? 1 : 0,
        fb: Math.round(p.flashlight.battery),
        ca: p.carrying || null,
        inv: p.inventory,
        rt: p.root > 0 ? 1 : 0,
        sn: p.stun > 0 ? 1 : 0,
        rv: p.revealUntil > this.time ? 1 : 0,
        dt: p.healthState === 'downed' ? +p.downedTimer.toFixed(1) : 0,
        pw: p.role === 'cenobite' ? Math.round(p.power) : 0,
        cd: p.role === 'cenobite' ? p.cooldowns : undefined,
        pc: p.role === 'survivor' ? +p.perkCooldown.toFixed(1) : 0,
        pa: p.perkActiveUntil > this.time ? 1 : 0,
        ex: p.executing ? { v: p.executing.victimId, t: +p.executing.t.toFixed(2) } : null,
        it: p.interaction
          ? { t: p.interaction.type, g: p.interaction.targetId, p: +(p.interaction.progress / p.interaction.duration).toFixed(3) }
          : null,
      });
    }
    return {
      t: +this.time.toFixed(2),
      clock: Math.max(0, Math.round(this.clock)),
      state: this.state,
      players,
      chains: this.chains.map((c) => ({ e: c.eid, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), ox: c.ox, oy: c.oy, oz: c.oz, f: c.floor })),
      traps: this.traps.map((t) => ({ e: t.eid, x: t.x, y: t.y, z: t.z, f: t.floor, a: t.arm > 0 ? 1 : 0, o: t.owner })),
      gateways: this.gateways.map((g) => ({ e: g.eid, ax: g.ax, ay: g.ay, az: g.az, af: g.af, bx: g.bx, by: g.by, bz: g.bz, bf: g.bf, o: g.owner })),
      wards: this.wards.map((w) => ({ e: w.eid, x: w.x, y: w.y, z: w.z, f: w.floor, r: w.radius })),
      doors: [...this.doors.entries()].map(([id, s]) => ({ i: id, o: s.open ? 1 : 0, l: s.locked ? 1 : 0, j: s.jammedUntil > this.time ? 1 : 0 })),
      lightsOut: this.horror.lightsOutUntil > this.time ? 1 : 0,
    };
  }

  /** Full snapshot of static match data sent once at match start. */
  startPayload() {
    return {
      seed: this.lobby.code,
      mode: this.lobby.mode,
      clock: this.clock,
      objectives: this.objectiveSummary(),
      containers: [...this.containers.values()],
      hides: [...this.hides.values()],
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        characterId: p.characterId,
        isBot: p.isBot,
        x: p.x,
        y: p.y,
        z: p.z,
        floor: p.floor,
        yaw: p.yaw,
      })),
    };
  }

  /** Developer-menu commands. Gated to the host in server/index.js. */
  debugCommand(id, cmd, args = {}) {
    const p = this.players.get(id);
    switch (cmd) {
      case 'teleport': {
        if (!p) return;
        if (args.to === 'gate') {
          p.x = this.map.gate.x;
          p.z = this.map.gate.z;
          p.floor = this.map.gate.floor;
        } else if (args.to === 'altar') {
          p.x = this.map.altar.x;
          p.z = this.map.altar.z;
          p.floor = this.map.altar.floor;
        } else if (Number.isFinite(args.x)) {
          p.x = args.x;
          p.z = args.z;
          p.floor = args.floor | 0;
        }
        p.y = groundAt(this.map, p.floor, p.x, p.z).y;
        p.teleportGrace = this.time + 2;
        p.forcedUntil = this.time + 0.4;
        this.correct(p, 'debug_teleport');
        break;
      }
      case 'spawn_item':
        if (p && args.item && p.inventory.length < 3) p.inventory.push(args.item);
        break;
      case 'heal':
        if (p) {
          p.health = HEALTH.MAX;
          p.healthState = HEALTH_STATE.HEALTHY;
          p.bleeding = false;
          p.alive = true;
          p.downedTimer = 0;
        }
        break;
      case 'set_fear':
        if (p) p.fear = clamp(+args.value || 0, 0, FEAR.MAX);
        break;
      case 'complete_objective':
        for (const s of this.obj.seals) { s.broken = true; s.progress = 1; }
        this.obj.sealsBroken = this.obj.sealsNeeded;
        this.obj.relicsDelivered = this.obj.relicsNeeded;
        this.obj.piecesDelivered = this.obj.piecesNeeded;
        this.advancePhase();
        this.broadcastObjectives();
        break;
      case 'solve_box':
        if (this.obj.box.assembled && !this.obj.box.solved) {
          this.obj.box.config = [...this.obj.box.target];
          this.solveBox(p || this.activeSurvivors[0] || { id: null, fear: 0 });
        }
        break;
      case 'toggle_ai':
        this.bots.enabled = !this.bots.enabled;
        break;
      case 'horror':
        if (p) this.spawnHorror(args.event || 'chains_stir', p);
        break;
      case 'end_match':
        this.end(args.winner || 'survivors', 'Match ended by the host.');
        break;
      case 'noclip':
        if (p) p.noclip = !p.noclip;
        break;
    }
  }
}

export { nextEntityId };
