/**
 * Wanted system. Police only know what someone actually reported:
 *  - a crime seen by an officer is reported immediately;
 *  - a civilian witness has to finish a phone call first (interrupted if
 *    they're hurt, killed, or scared off at gunpoint);
 *  - alarms (the store's silent alarm) report after a short delay.
 *
 * States: clear → reported (units responding to the report location)
 *         → pursuit (an officer can see you) ⇄ search (lost sight; leave the
 *         search area and stay unseen until the timer runs out) → clear.
 * The star scale is this prototype's own configurable escalation, not a
 * confirmed detail of any other game.
 */
export const CRIMES = {
  brandish: { label: 'Brandishing a weapon', level: 1, civilians: false },
  vehicleTheft: { label: 'Vehicle theft', level: 1, civilians: false },
  carjack: { label: 'Carjacking', level: 1 },
  assault: { label: 'Assault', level: 1 },
  hitAndRun: { label: 'Hit and run', level: 1 },
  shooting: { label: 'Shots fired', level: 2 },
  recognized: { label: 'Matched a suspect description', level: 1 },
  robbery: { label: 'Armed robbery', level: 2 },
  assaultOfficer: { label: 'Assaulting an officer', level: 2 },
  murder: { label: 'Homicide', level: 3 },
  officerDown: { label: 'Officer down', level: 4 },
};

export const WANTED_CONFIG = {
  maxLevel: 5,
  searchRadius: (lvl) => 55 + lvl * 25,
  searchTime: (lvl) => 9 + lvl * 4,
  callTime: [5, 8], // civilian call duration range (s)
  units: [0, 2, 3, 4, 5, 6], // patrol cars dispatched per level
  shootAtLevel: 2,
};

export class Wanted {
  constructor(game) {
    this.game = game;
    this.level = 0;
    this.state = 'clear';
    this.lastKnown = null;
    this.reportPos = null;
    this.searchLeft = 0;
    this.unseenT = 0;
    this.calls = []; // pending civilian calls
    this.log = []; // [{t, text}]
    this.seenVehicleId = null;
    this.history = { reports: 0, escapes: 0, maxLevel: 0 };
    this.bindEvents();
  }

  get active() { return this.level > 0; }
  note(text) { this.log.unshift({ t: this.game.time, text }); this.log.length = Math.min(this.log.length, 6); this.game.events.emit('wantedNote', text); }

  /** A crime happened at (x, z). Police who see it report at once; civilians may call it in. */
  crime(id, x, z, { perpetrator = this.game.player, victim = null } = {}) {
    if (perpetrator !== this.game.player && perpetrator !== this.game.partner) return; // the crew's crimes only
    const c = CRIMES[id];
    const police = this.game.police;
    if (police && police.canSeePoint(x, z, perpetrator)) {
      this.report(id, x, z, 'police');
      return;
    }
    if (c.civilians === false) return;
    this.game.peds_?.witness(id, x, z, perpetrator, victim);
  }

  /** A civilian starts a 911 call. Returns the call record. */
  startCall(witness, crimeId, x, z) {
    if (this.calls.some((c) => c.witness === witness)) return null;
    const [a, b] = WANTED_CONFIG.callTime;
    const call = { witness, crimeId, x, z, t: 0, duration: a + Math.random() * (b - a) };
    this.calls.push(call);
    this.game.events.emit('witnessCall', call);
    return call;
  }

  cancelCall(witness, reason) {
    const i = this.calls.findIndex((c) => c.witness === witness);
    if (i < 0) return;
    this.calls.splice(i, 1);
    if (reason) this.note(`Witness call interrupted (${reason})`);
  }

  /** Make the crime known to police. by: 'police' | 'witness' | 'alarm'. */
  report(crimeId, x, z, by) {
    const c = CRIMES[crimeId];
    const before = this.level;
    let lvl = Math.max(this.level, c.level);
    // serious crimes in front of officers escalate, at most once every 8 s
    if (this.level > 0 && c.level >= 2 && this.level < WANTED_CONFIG.maxLevel && by === 'police' && this.game.time - (this.lastEscalate ?? -99) > 8) {
      lvl = Math.max(lvl, this.level + 1);
      this.lastEscalate = this.game.time;
    }
    this.level = Math.min(WANTED_CONFIG.maxLevel, lvl);
    this.history.reports++;
    this.history.maxLevel = Math.max(this.history.maxLevel, this.level);
    const who = by === 'police' ? 'Police saw' : by === 'alarm' ? 'Alarm reported' : 'Witness reported';
    this.note(`${who}: ${c.label}`);
    if (by === 'police') {
      this.state = 'pursuit';
      this.lastKnown = { x: this.game.player.pos.x, z: this.game.player.pos.z };
      this.unseenT = 0;
    } else if (this.state === 'clear' || this.state === 'reported') {
      this.state = 'reported';
      this.reportPos = { x, z };
      this.lastKnown = { x, z };
      this.searchLeft = WANTED_CONFIG.searchTime(this.level) + 10;
    } else if (this.state === 'search') {
      // a fresh report re-centres the search on the new location
      this.lastKnown = { x, z };
      this.searchLeft = WANTED_CONFIG.searchTime(this.level);
    }
    this.game.events.emit('crimeReported', { crimeId, x, z, by, level: c.level });
    if (this.level !== before) this.game.events.emit('wantedLevel', { level: this.level, before });
    this.game.audio?.wantedUp?.();
  }

  clear(silent = false) {
    const was = this.level;
    this.level = 0;
    this.state = 'clear';
    this.lastKnown = null;
    this.reportPos = null;
    this.calls.length = 0;
    this.seenVehicleId = null;
    if (was > 0 && !silent) { this.history.escapes++; this.note('You lost the police'); this.game.events.emit('wantedCleared', { level: was }); }
    this.game.events.emit('wantedLevel', { level: 0, before: was });
  }

  get searchRadius() { return WANTED_CONFIG.searchRadius(this.level); }

  step(dt) {
    const g = this.game;
    const p = g.player;
    // civilian calls in progress
    for (const call of [...this.calls]) {
      const w = call.witness;
      if (w.dead || w.removed || w.knockT > 0) { this.cancelCall(w, w.dead ? 'witness down' : 'witness hurt'); continue; }
      call.t += dt;
      if (call.t >= call.duration) {
        this.calls.splice(this.calls.indexOf(call), 1);
        this.report(call.crimeId, call.x, call.z, 'witness');
        w.controller?.callDone?.();
      }
    }
    if (this.level === 0) return;
    const police = g.police;
    const seen = police ? police.canSeePlayer() : false;
    const ppos = p.vehicle ? p.vehicle.pos : p.pos;
    if (seen) {
      if (this.state !== 'pursuit') this.note('Police have eyes on you');
      this.state = 'pursuit';
      this.lastKnown = { x: ppos.x, z: ppos.z };
      this.unseenT = 0;
      this.seenVehicleId = p.vehicle ? p.vehicle.id : null;
    } else if (this.state === 'pursuit') {
      this.unseenT += dt;
      if (this.unseenT > 2.5) {
        this.state = 'search';
        this.searchLeft = WANTED_CONFIG.searchTime(this.level);
        this.note('Lost sight of you — get out of the search area');
      }
    }
    if (this.state === 'search' || this.state === 'reported') {
      const lk = this.lastKnown;
      const d = Math.hypot(ppos.x - lk.x, ppos.z - lk.z);
      const outside = d > this.searchRadius;
      // switching to a vehicle the police never saw makes them lose the trail faster
      const swapped = p.vehicle && this.seenVehicleId && p.vehicle.id !== this.seenVehicleId ? 1.6 : 1;
      if (outside) this.searchLeft -= dt * swapped;
      else if (this.state === 'reported') this.searchLeft -= dt * 0.35;
      if (this.searchLeft <= 0) this.clear();
    }
  }

  /** Crime detection from game events (only the crew's actions count as crimes here). */
  bindEvents() {
    const g = this.game;
    const ev = g.events;
    const isPlayer = (c) => !!c && (c === g.player || c === g.partner); // either of the crew
    ev.on('gunshot', ({ shooter, x, z }) => { if (isPlayer(shooter)) this.crime('shooting', x, z); });
    ev.on('carjack', ({ thief, vehicle }) => { if (isPlayer(thief)) this.crime(vehicle.police ? 'assaultOfficer' : 'carjack', vehicle.pos.x, vehicle.pos.z); });
    ev.on('assault', ({ attacker, victim }) => { if (isPlayer(attacker)) this.crime(victim.role === 'cop' ? 'assaultOfficer' : 'assault', victim.pos.x, victim.pos.z, { victim }); });
    ev.on('killed', ({ victim, source }) => {
      if (!isPlayer(source)) return;
      this.crime(victim.role === 'cop' ? 'officerDown' : 'murder', victim.pos.x, victim.pos.z, { victim });
    });
    ev.on('pedHit', ({ victim, vehicle, speed }) => { if (isPlayer(vehicle.driver) && speed > 7 && !victim.protagonist) this.crime(victim.role === 'cop' ? 'assaultOfficer' : 'hitAndRun', victim.pos.x, victim.pos.z, { victim }); });
    ev.on('damaged', ({ victim, source, kind }) => { if (isPlayer(source) && victim.role === 'cop' && kind !== 'melee' && !victim.dead) this.crime('assaultOfficer', victim.pos.x, victim.pos.z, { victim }); });
    ev.on('playerEnteredVehicle', (v) => {
      // taking a parked car that isn't yours: only a crime if an officer sees it
      if (v.police || (v.owner !== 'player' && !v.mission && v.prevDriverRole !== 'player' && v.prevDriverRole !== 'partner')) this.crime('vehicleTheft', v.pos.x, v.pos.z);
    });
  }
}
