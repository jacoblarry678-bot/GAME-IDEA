/**
 * Missions: data-driven stages with objectives, map targets, checkpoints,
 * failure reasons, retry from checkpoint, and cleanup of every actor or
 * marker a mission created (so retrying never duplicates anything).
 *
 * Story and dialogue are original to this prototype.
 */
import * as THREE from 'three';
import { PLACES } from '../world/district.js';
import { Input } from '../core/input.js';
import { Character } from '../entities/character.js';
import { PedController } from '../ai/peds.js';
import { spawnRivalCar } from '../ai/rivals.js';

export const CAST = {
  cal: { name: 'Cal', full: 'Cal Reyes' },
  sol: { name: 'Sol', full: 'Marisol "Sol" Vega' },
  teo: { name: 'Teo', full: 'Teo Marchetti' },
  rudy: { name: 'Rudy', full: 'Rudy Ojeda' },
};

const S = PLACES.safehouse, ST = PLACES.store, MA = PLACES.marina;
const RUDY_LOOK = { female: false, height: 1.74, build: 1.22, skin: 0xe0ac69, hair: 0x9a9a9a, top: 0x6a8caf, bottom: 0xc8b48a, shoes: 0x5a4a3a, hairStyle: 'short', shorts: true, sleeveless: false, hat: 0xe9e2d0, beard: true };

/** The Caldera crew's cars still in the fight (not wrecked, sunk, driverless or emptied). */
function rivalsActive(g, m) {
  return (m.data.rivals || []).filter((r) => g.vehicles.includes(r.vehicle) && !r.vehicle.destroyed && !r.vehicle.sunk && r.crew.some((c) => !c.dead && !c.removed));
}

export const MISSIONS = {
  small_change: {
    id: 'small_change',
    title: 'Small Change',
    giver: 'sol',
    cast: ['cal'], // who you play; Sol stays at the motel
    partner: 'stay',
    start: { x: S.x + 3.5, z: S.z + 2.5 },
    summary: 'Sol has a way to cover the debt to Teo by Friday: the week\'s takings at the Sunny Stop.',
    intro: [
      ['sol', 'Teo wants his two grand by Friday, Cal. You know what he does when people are late.'],
      ['cal', 'I know what he does.'],
      ['sol', 'Sunny Stop on 14th and Coral keeps the week\'s take in the register until the Monday pickup.'],
      ['sol', 'In, out. Nobody gets hurt. Then come back here and we lie low.'],
      ['cal', 'Nobody gets hurt.'],
    ],
    stages: [
      {
        id: 'drive', objective: 'Go to the Sunny Stop on 14th St & Coral Ave.', target: () => ({ x: ST.door.x, z: ST.door.z - 4, label: 'Sunny Stop' }),
        checkpoint: true,
        done: (g) => g.player.distanceTo(ST.door.x, ST.door.z - 2) < 14,
      },
      {
        id: 'enter', objective: 'Switch to your pistol (Q) and go inside.', target: () => ({ x: ST.door.x, z: ST.door.z + 2, label: 'Entrance' }),
        hint: 'Q switches weapons. Hold right mouse to aim.',
        done: (g) => g.store.inside && !g.player.vehicle,
      },
      {
        id: 'holdup', objective: 'Aim at the clerk to hold up the store.', target: () => ({ x: ST.clerk.x, z: ST.clerk.z, label: 'Clerk' }),
        hint: 'Hold right mouse and point the gun at the clerk behind the counter.',
        done: (g) => !!g.store.holdup || !!g.store.bag,
      },
      {
        id: 'bag', objective: 'Keep the clerk covered while the register is emptied.', target: () => ({ x: ST.clerk.x, z: ST.clerk.z, label: 'Clerk' }),
        progress: (g) => g.store.holdup?.progress ?? 1,
        done: (g) => !g.store.holdup,
        fail: (g) => (!g.store.bag && !g.store.holdup ? 'The clerk hit the alarm before handing anything over.' : null),
      },
      {
        id: 'grab', objective: 'Grab the cash from the counter.', target: () => (g_bag() ? { x: g_bag().x, z: g_bag().z, label: 'Cash' } : null),
        done: (g, m) => m.data.taken > 0,
      },
      {
        id: 'escape', objective: 'Lose the police.', target: () => null,
        checkpoint: true,
        hint: 'Break line of sight, get out of the search area and stay hidden until the stars go away.',
        skipIf: (g) => g.wanted.level === 0 && g.store.alarmT < 0 && !g.store.inside,
        done: (g) => g.wanted.level === 0 && g.store.alarmT < 0 && !g.store.inside,
      },
      {
        id: 'return', objective: 'Get back to the Bayside Motel.', target: () => ({ x: S.door.x + 1.5, z: S.door.z, label: 'Safehouse' }),
        back: (g) => (g.wanted.level > 0 ? 'escape' : null),
        done: (g) => g.player.distanceTo(S.door.x + 1.5, S.door.z) < 3.5 && !g.player.vehicle,
      },
    ],
    outro: [
      ['sol', 'Count it twice. Teo will.'],
      ['cal', 'It\'s enough. Barely.'],
      ['sol', 'Barely is still enough. Get some sleep — I\'ve got a line on something bigger.'],
    ],
    failIf: (g) => (g.store.clerk?.dead && !g.store.bag && !(g.missions.active?.data.taken > 0) ? 'The clerk is dead. The register stays locked.' : null),
    reward: { bonus: 0 },
    onPassMessage: { from: 'sol', text: 'Teo got paid. Stay off the radar for a bit. I\'ll call when the next thing comes up.' },
  },

  // Milestone 3: a two-person job. One of you drives, the other shoots — and Tab swaps who does what.
  low_tide: {
    id: 'low_tide',
    title: 'Low Tide',
    giver: 'sol',
    cast: ['cal', 'sol'],
    partner: 'with',
    allowSwitch: true,
    requires: ['small_change'],
    start: { x: S.x + 3.5, z: S.z + 2.5 },
    summary: 'Rudy Ojeda wants out of Cayo Lento, and he\'ll pay to have a cooler carried back across the twin-span.',
    intro: [
      ['sol', 'Remember Rudy Ojeda? Runs fishing charters out of Cayo Lento.'],
      ['cal', 'The guy whose boat never catches any fish.'],
      ['sol', 'He\'s been skimming the Caldera brothers\' charter money. He wants out, and he\'ll pay four grand to get a cooler off the key.'],
      ['cal', 'And the Calderas?'],
      ['sol', 'Won\'t know a thing. Over the bridge, pick it up, back here. You drive — or I will.'],
    ],
    stages: [
      {
        id: 'drive', objective: 'Drive to the Cayo Lento Marina with Sol.', target: () => ({ x: MA.lot.x, z: MA.lot.z, label: 'Marina' }),
        hint: 'Ocean Blvd runs south over the twin-span. Want your partner to drive? Press G by a car, then get in.',
        checkpoint: true,
        partnerDrive: () => ({ x: MA.lot.x, z: MA.lot.z, arrive: 16, line: 'Marina. Rudy said the end of the pier.' }),
        done: (g) => Math.hypot((g.player.vehicle || g.player).pos.x - MA.lot.x, (g.player.vehicle || g.player).pos.z - MA.lot.z) < 22 && g.crew.partnerWithPlayer(),
      },
      {
        id: 'pier', objective: 'Meet Rudy at the end of the pier.', target: () => ({ x: MA.pierEnd.x, z: MA.pierEnd.z, label: 'Rudy' }),
        hint: 'Get out and walk down the pier.',
        enter: (g, m) => {
          if (m.data.rudy && !m.data.rudy.removed) return;
          const r = g.missions.spawnActor(RUDY_LOOK, MA.pierEnd.x + 0.4, MA.pierEnd.z + 1.5, Math.PI);
          r.controller.setState('idle', 999);
          r.anim_.phone = true;
          m.data.rudy = r;
        },
        fail: (g, m) => (m.data.rudy?.dead ? 'Rudy is dead. So is the deal.' : null),
        done: (g, m) => !g.player.vehicle && !g.player.swim && g.player.distanceTo(m.data.rudy.pos.x, m.data.rudy.pos.z) < 4.5,
      },
      {
        id: 'ambush', objective: 'The Calderas followed Rudy. Get to a car together.',
        hint: 'One of you drives, the other shoots: press G by a car to let your partner drive. Tab swaps roles any time.',
        target: () => ({ x: MA.lot.x, z: MA.lot.z, label: 'Car' }),
        checkpoint: true,
        enter: (g, m) => {
          m.data.cooler = true;
          g.missions.playDialogue([
            ['rudy', 'You\'re Sol\'s people. Good. Take it — don\'t open it, don\'t drop it.'],
            ['sol', 'Pleasure doing business, Rudy.'],
            ['rudy', 'Oh, no. That\'s the Calderas\' truck at the fuel stop. They followed me here.'],
            ['rudy', 'Go! Go!'],
          ], 'Cayo Lento Marina');
          const r = m.data.rudy;
          if (r && !r.dead) { r.anim_.phone = false; r.controller.panic({ x: MA.lot.x, z: MA.lot.z - 30 }, 'gunfire'); }
          // two cars come down from the fuel stop toward the marina
          const dest = { x: MA.lot.x, z: MA.lot.z };
          m.data.rivals = [
            g.missions.spawnRivals('pickup', 108, 632.5, Math.PI / 2, 0x1a1a1a, dest),
            g.missions.spawnRivals('kestrel', 93, 632.5, Math.PI / 2, 0x7a1f24, dest),
          ];
          // they pull out of the fuel stop a few seconds after Rudy spots them
          for (const r of m.data.rivals) { r.crew[0].controller.holdT = 8; r.crew[1].controller.holdT = 8; }
        },
        fail: (g) => (g.partner.dead ? `${g.partner.protagonistName} is down.` : null),
        done: (g) => !!g.player.vehicle && g.partner.vehicle === g.player.vehicle,
      },
      {
        id: 'chase', objective: 'Lose the Calderas.', target: () => null,
        hint: 'Wreck their cars, take out their crews, or put 200 m between you. Tab swaps driver and shooter.',
        partnerDrive: () => ({ x: S.door.x + 8, z: S.door.z, arrive: 20, urgent: true, line: 'Are they gone? Tell me they\'re gone.' }),
        enter: (g, m) => {
          for (const r of m.data.rivals || []) for (const c of r.crew) if (c.controller) c.controller.alerted = true;
          const sol = g.partner.vehicle && g.partner.seat === 0;
          g.hud?.subtitle(g.partner.protagonistName, sol ? 'I\'ve got the wheel. Keep their heads down!' : 'Drive! I\'ll handle them.', 3);
          m.data.farT = 0;
        },
        update: (g, m, dt) => {
          const live = rivalsActive(g, m);
          const ppos = (g.player.vehicle || g.player).pos;
          const far = live.every((r) => Math.hypot(r.vehicle.pos.x - ppos.x, r.vehicle.pos.z - ppos.z) > 200);
          m.data.farT = far ? (m.data.farT || 0) + dt : 0;
        },
        done: (g, m) => rivalsActive(g, m).length === 0 || m.data.farT > 6,
      },
      {
        id: 'escape', objective: 'Lose the police.', target: () => null,
        checkpoint: true,
        hint: 'Break line of sight, get out of the search area and stay hidden until the stars go away.',
        skipIf: (g) => g.wanted.level === 0,
        done: (g) => g.wanted.level === 0,
      },
      {
        id: 'return', objective: 'Bring the cooler back to the Bayside Motel.', target: () => ({ x: S.door.x + 1.5, z: S.door.z, label: 'Safehouse' }),
        partnerDrive: () => ({ x: S.door.x + 9, z: S.door.z, arrive: 14, line: 'Home sweet motel.' }),
        back: (g) => (g.wanted.level > 0 ? 'escape' : null),
        done: (g) => g.player.distanceTo(S.door.x + 1.5, S.door.z) < 3.5 && !g.player.vehicle && g.crew.partnerWithPlayer(),
      },
    ],
    outro: [
      ['cal', 'Four grand to carry a cooler across a bridge.'],
      ['sol', 'And to not get shot. Don\'t forget that part.'],
      ['sol', 'Rudy\'s on a boat to anywhere. The Calderas are going to remember our faces, though.'],
    ],
    reward: { bonus: 4000 },
    onPassMessage: { from: 'sol', text: 'The Calderas are asking around Ocean Mile. Keep your head down for a while. Love you.' },
  },
};

let gameRef = null;
const g_bag = () => gameRef?.store.bag;

export class MissionManager {
  constructor(game) {
    this.game = game;
    gameRef = game;
    this.completed = new Set();
    this.active = null;
    this.failed = null; // {id, reason, checkpoint}
    this.markers = [];
    this.startMarkers = new Map();
    this.cutscene = null;
    game.events.on('cashTaken', (amt) => { if (this.active) this.active.data.taken += amt; });
    game.events.on('playerDied', () => this.fail('You were killed.'));
    game.events.on('busted', () => this.fail('You were arrested.'));
    game.events.on('killed', ({ victim }) => {
      const a = this.active;
      if (a && victim === game.partner && (a.def.cast || []).includes(victim.protagonist)) this.fail(`${victim.protagonistName} is down.`);
    });
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    this.startMat = new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
    for (const def of Object.values(MISSIONS)) {
      game.interactables.push({
        id: 'mission:' + def.id, x: def.start.x, z: def.start.z, radius: 2.2,
        label: () => {
          if (this.canStart(def.id)) return `Start mission: ${def.title}`;
          if (this.active || this.completed.has(def.id) || !this.unlocked(def)) return null;
          const why = this.castProblem(def);
          return why ? `${def.title}: ${why}` : null;
        },
        onInteract: () => { if (this.canStart(def.id)) this.start(def.id); },
      });
    }
  }

  canStart(id) {
    const def = MISSIONS[id];
    return !this.active && !this.completed.has(id) && !this.cutscene && this.game.wanted.level === 0 && this.unlocked(def) && !this.castProblem(def);
  }

  unlocked(def) { return (def.requires || []).every((r) => this.completed.has(r)); }

  /** Who has to be here: a one-person mission needs that protagonist; a two-person one needs both together. */
  castProblem(def) {
    const g = this.game, cast = def.cast || ['cal'];
    const name = (id) => CAST[id].name;
    if (!cast.includes(g.player.protagonist)) return `switch to ${name(cast[0])} to start`;
    if (cast.length > 1 && !g.crew.partnerWithPlayer() && g.player.distanceTo(g.partner.pos.x, g.partner.pos.z) > 8) return `bring ${g.partner.protagonistName} (${Input.label(g.settings.c.bindings.partner)}: follow)`;
    return null;
  }

  /** Where the partner should drive when they're at the wheel with you aboard. */
  partnerDriveTarget() {
    const st = this.stage;
    return st?.partnerDrive ? st.partnerDrive(this.game) : null;
  }

  get available() { return Object.values(MISSIONS).filter((m) => !this.completed.has(m.id)); }

  start(id, fromCheckpoint = null) {
    const def = MISSIONS[id];
    const g = this.game;
    this.cleanup();
    this.failed = null;
    this.active = { def, stageIndex: 0, t: 0, stageT: 0, data: { taken: 0 }, actors: [], checkpoint: null };
    if (!def.allowSwitch) g.crew.lockReason = 'You can\'t switch during this mission';
    if (def.partner === 'with' && !g.partner.dead && !(g.partner.vehicle && g.partner.vehicle === g.player.vehicle)) g.partner.partnerAI.setMode('follow');
    if (def.partner === 'stay' && !g.partner.dead) {
      // they head home and wait there
      if (g.partner.vehicle && g.partner.vehicle === g.player.vehicle) g.partner.partnerAI.getOut(g.partner.vehicle);
      g.partner.partnerAI.setMode('wait', g.crew.constructor.home(g.partner.protagonist));
    }
    if (fromCheckpoint) {
      this.restoreCheckpoint(fromCheckpoint);
    } else {
      g.store.reset();
      this.saveCheckpoint(0);
      if (def.intro) this.playDialogue(def.intro, def.introTitle || 'Bayside Motel');
    }
    g.events.emit('missionStarted', def);
    this.enterStage();
  }

  get stage() { return this.active ? this.active.def.stages[this.active.stageIndex] : null; }

  enterStage() {
    const st = this.stage;
    if (!st) return;
    this.active.stageT = 0;
    if (st.skipIf && st.skipIf(this.game)) { this.next(); return; }
    if (st.checkpoint && this.active.stageIndex > 0) this.saveCheckpoint(this.active.stageIndex);
    st.enter?.(this.game, this.active);
    this.game.events.emit('objective', { text: st.objective, hint: st.hint });
    this.game.audio?.ui('objective');
  }

  next() {
    this.active.stageIndex++;
    if (this.active.stageIndex >= this.active.def.stages.length) { this.pass(); return; }
    this.enterStage();
  }

  step(dt) {
    if (this.cutscene) this.stepCutscene(dt);
    const a = this.active;
    if (!a) return;
    a.t += dt; a.stageT += dt;
    const g = this.game;
    this.stage.update?.(g, a, dt);
    const reason = a.def.failIf?.(g) || this.stage.fail?.(g, a);
    if (reason) { this.fail(reason); return; }
    const back = this.stage.back?.(g);
    if (back) {
      const i = a.def.stages.findIndex((s) => s.id === back);
      if (i >= 0) { a.stageIndex = i; this.enterStage(); return; }
    }
    if (this.stage.done(g, a)) this.next();
  }

  /** Where the objective is (for the marker, blip and GPS). */
  currentTarget() {
    if (!this.active) return null;
    return this.stage.target?.() || null;
  }

  saveCheckpoint(stageIndex) {
    const g = this.game, p = g.player;
    const v = p.vehicle;
    this.active.checkpoint = {
      stageIndex,
      money: g.economy.money,
      taken: this.active.data.taken,
      pos: { x: (v || p).pos.x, z: (v || p).pos.z, yaw: (v || p).yaw },
      vehicle: v ? { model: v.modelId, color: v.color } : null,
      partnerInCar: !!v && g.partner.vehicle === v,
      cooler: !!this.active.data.cooler,
      wanted: g.wanted.level,
      health: p.health,
      hour: g.engine.time.hour,
    };
  }

  restoreCheckpoint(cp) {
    const g = this.game;
    const a = this.active;
    a.stageIndex = cp.stageIndex;
    a.data.taken = cp.taken;
    g.respawnPlayer(cp.pos.x, cp.pos.z, cp.pos.yaw, { health: Math.max(cp.health, 80) });
    g.economy.money = cp.money;
    if (cp.vehicle) {
      const v = g.addVehicle(cp.vehicle.model, cp.pos.x, cp.pos.z, cp.pos.yaw, cp.vehicle.color);
      v.mission = true;
      a.actors.push(v);
      g.seatCharacter(v, 0, g.player);
    }
    // a partner on this job comes back with you: in the car, or at your side
    const o = g.partner, def = a.def;
    if ((def.cast || []).includes(o.protagonist)) {
      if (o.vehicle) g.unseatCharacter(o.vehicle, o, null);
      o.dead = false; o.deadT = 0; o.knockT = 0; o.health = Math.max(o.health, 80);
      o.partnerAI.reset();
      o.partnerAI.setMode('follow');
      g.crew.downT = 0;
      const pv = g.player.vehicle;
      if (cp.partnerInCar && pv) g.seatCharacter(pv, 1, o);
      else g.crew.regroupAt(cp.pos.x, cp.pos.z, cp.pos.yaw, true);
    }
    a.data.cooler = cp.cooler;
    g.store.reset();
    if (cp.wanted > 0) g.wanted.report('robbery', cp.pos.x, cp.pos.z, 'alarm');
  }

  /** A mission character (cleaned up with the mission). */
  spawnActor(look, x, z, yaw) {
    const g = this.game;
    const ch = new Character(g, look, { role: 'ped', x, z, yaw });
    ch.controller = new PedController(g, ch, 'keys');
    ch.controller.zone = { x0: x - 4, x1: x + 4, z0: z - 4, z1: z + 4 };
    ch.missionActor = true;
    ch.missionId = this.active.def.id;
    g.extras.push(ch);
    this.active.actors.push(ch);
    return ch;
  }

  /** An enemy car with its crew (cleaned up with the mission). */
  spawnRivals(model, x, z, yaw, color, dest) {
    const r = spawnRivalCar(this.game, model, x, z, yaw, color, dest);
    this.active.actors.push(r.vehicle, ...r.crew);
    return r;
  }

  fail(reason) {
    const a = this.active;
    if (!a) return;
    this.failed = { id: a.def.id, reason, checkpoint: a.checkpoint };
    this.game.events.emit('missionFailed', { def: a.def, reason });
    this.game.audio?.jingle('fail');
    this.cleanup();
  }

  retry() {
    if (!this.failed) return false;
    const f = this.failed;
    this.game.wanted.clear(true);
    this.game.police?.clearAll();
    this.start(f.id, f.checkpoint);
    return true;
  }

  abandon() {
    if (!this.active) return;
    this.fail('Mission abandoned.');
  }

  pass() {
    const a = this.active;
    const def = a.def;
    const g = this.game;
    if (def.reward.bonus) g.economy.add(def.reward.bonus, def.title);
    this.completed.add(def.id);
    if (def.id === 'small_change') g.stats.robberies++;
    this.active = null;
    g.crew.lockReason = null;
    g.events.emit('missionPassed', { def, earned: a.data.taken + (def.reward.bonus || 0) });
    g.audio?.jingle('pass');
    if (def.outro) this.playDialogue(def.outro, null);
    if (def.onPassMessage) setTimeout(() => g.events.emit('phoneMessage', def.onPassMessage), 6000);
    this.cleanupActors(a);
    g.saveGame?.('mission');
  }

  cleanupActors(a) {
    for (const o of a.actors) {
      if (o.seats) { if (!o.seats.includes(this.game.player) && this.game.vehicles.includes(o)) this.game.removeVehicle(o); }
      else if (!o.removed) this.game.removeCharacter(o);
    }
    a.actors.length = 0;
  }

  cleanup() {
    if (this.active) this.cleanupActors(this.active);
    this.active = null;
    this.game.crew.lockReason = null;
  }

  /** Dialogue lines as subtitles; skippable with Enter/Space. */
  playDialogue(lines, title) {
    this.cutscene = { lines, i: 0, t: 0, title };
    this.showLine();
  }
  showLine() {
    const c = this.cutscene;
    const [who, text] = c.lines[c.i];
    c.dur = 1.6 + text.length * 0.045;
    c.t = 0;
    this.game.hud?.subtitle(CAST[who]?.name || who, text, c.dur, c.title);
  }
  stepCutscene(dt) {
    const c = this.cutscene;
    c.t += dt;
    if (c.t >= c.dur || this.game.input.pressed('skip')) {
      c.i++;
      if (c.i >= c.lines.length) { this.cutscene = null; this.game.hud?.subtitle(null); return; }
      this.showLine();
    }
  }
  skipDialogue() { if (this.cutscene) { this.cutscene = null; this.game.hud?.subtitle(null); } }
}

/** Animated cylinder markers for the current objective and mission starts. */
export class Markers {
  constructor(game) {
    this.game = game;
    const geo = new THREE.CylinderGeometry(1.1, 1.1, 1.6, 24, 1, true);
    geo.translate(0, 0.8, 0);
    this.obj = new THREE.Mesh(geo, game.missions.markerMat);
    this.obj.visible = false;
    this.obj.renderOrder = 5;
    game.engine.scene.add(this.obj);
    this.starts = [];
    for (const def of Object.values(MISSIONS)) {
      const m = new THREE.Mesh(geo, game.missions.startMat);
      m.position.set(def.start.x, game.world.ground(def.start.x, def.start.z, 2), def.start.z);
      m.renderOrder = 5;
      m.userData.id = def.id;
      game.engine.scene.add(m);
      this.starts.push(m);
    }
    this.t = 0;
  }
  dispose() {
    for (const m of [this.obj, ...this.starts]) this.game.engine.scene.remove(m);
  }
  update(dt) {
    const g = this.game, M = g.missions;
    this.t += dt;
    const tgt = M.currentTarget();
    const show = tgt && !M.cutscene && !(M.stage?.id === 'escape' || M.stage?.id === 'chase');
    this.obj.visible = !!show;
    if (show) {
      this.obj.position.set(tgt.x, g.world.ground(tgt.x, tgt.z, g.player.pos.y + 1) + 0.02, tgt.z);
      this.obj.scale.set(1, 1 + Math.sin(this.t * 3) * 0.08, 1);
    }
    for (const m of this.starts) m.visible = M.canStart(m.userData.id);
  }
}
