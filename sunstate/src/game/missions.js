/**
 * Missions: data-driven stages with objectives, map targets, checkpoints,
 * failure reasons, retry from checkpoint, and cleanup of every actor or
 * marker a mission created (so retrying never duplicates anything).
 *
 * Story and dialogue are original to this prototype.
 */
import * as THREE from 'three';
import { PLACES } from '../world/district.js';

export const CAST = {
  cal: { name: 'Cal', full: 'Cal Reyes' },
  sol: { name: 'Sol', full: 'Marisol "Sol" Vega' },
  teo: { name: 'Teo', full: 'Teo Marchetti' },
};

const S = PLACES.safehouse, ST = PLACES.store;

export const MISSIONS = {
  small_change: {
    id: 'small_change',
    title: 'Small Change',
    giver: 'sol',
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
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    this.startMat = new THREE.MeshBasicMaterial({ color: 0x29e6ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
    for (const def of Object.values(MISSIONS)) {
      game.interactables.push({
        id: 'mission:' + def.id, x: def.start.x, z: def.start.z, radius: 2.2,
        label: () => (this.canStart(def.id) ? `Start mission: ${def.title}` : null),
        onInteract: () => this.start(def.id),
      });
    }
  }

  canStart(id) { return !this.active && !this.completed.has(id) && !this.cutscene && this.game.wanted.level === 0; }

  get available() { return Object.values(MISSIONS).filter((m) => !this.completed.has(m.id)); }

  start(id, fromCheckpoint = null) {
    const def = MISSIONS[id];
    const g = this.game;
    this.cleanup();
    this.failed = null;
    this.active = { def, stageIndex: 0, t: 0, stageT: 0, data: { taken: 0 }, actors: [], checkpoint: null };
    if (fromCheckpoint) {
      this.restoreCheckpoint(fromCheckpoint);
    } else {
      g.store.reset();
      this.saveCheckpoint(0);
      if (def.intro) this.playDialogue(def.intro, 'Phone call — Sol');
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
    const reason = a.def.failIf?.(g) || this.stage.fail?.(g);
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
    g.store.reset();
    if (cp.wanted > 0) g.wanted.report('robbery', cp.pos.x, cp.pos.z, 'alarm');
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
    g.stats.robberies++;
    this.active = null;
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
    const show = tgt && !M.cutscene && !(M.stage?.id === 'escape');
    this.obj.visible = !!show;
    if (show) {
      this.obj.position.set(tgt.x, g.world.ground(tgt.x, tgt.z, g.player.pos.y + 1) + 0.02, tgt.z);
      this.obj.scale.set(1, 1 + Math.sin(this.t * 3) * 0.08, 1);
    }
    for (const m of this.starts) m.visible = M.canStart(m.userData.id);
  }
}
