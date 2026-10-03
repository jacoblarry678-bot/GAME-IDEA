/**
 * Game: presentation + local player control for one running match.
 * Reads input into the player's command, ticks the Match, then drives the
 * camera, viewmodel, third-person soldiers, effects, audio and HUD from
 * the simulation state and its events.
 */
import * as THREE from 'three';
import { Match } from './match.js';
import { SoldierModel, outfitMaterials } from '../entities/soldierModel.js';
import { finishMaterials } from '../world/finishes.js';
import { emblemArt } from '../ui/art.js';
import { Hud } from '../ui/hud.js';
import { WEAPONS, PRIMARY_IDS, damageAt } from '../data/weapons.js';
import { MODES, TEAMS } from './modes.js';
import { esc } from '../ui/dom.js';
import { PAD } from '../core/input.js';
import { ObjectiveView } from '../fx/objectives.js';
import { DeployablesView } from '../fx/deployablesView.js';
import { SUPPORT, SUPPORT_IDS, supportThreshold } from '../data/support.js';

const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();

export class Game {
  constructor(app, setup, map = app.mapRuntime) {
    this.app = app;
    this.setup = setup;
    this.map = map;
    const s = app.settings.data;
    this.id = Math.random().toString(36).slice(2);
    this.match = new Match(map, {
      ...setup,
      playerName: app.profile.data.name,
      playerLoadout: app.profile.matchLoadout,
      includePlayer: true,
    });
    const m = this.match;
    m.presenter = true; // combatant events are consumed (and cleared) by this Game
    this.player = m.player;
    this.cosm = app.profile.look; // equipped cosmetics (visual only — never affects gameplay)
    this.summary = { classKills: {}, weaponKills: {}, weaponHeadshots: {}, weaponsUsed: new Set(), grenadeKills: 0, meleeKills: 0, longshots: 0, multikills: 0, difficulty: setup.difficulty };
    for (const c of m.combatants) c.displayName = c.dummy ? c.name : c.isBot ? `[BOT] ${c.name}` : c.name;
    // third-person views
    this.views = new Map();
    let seed = 1;
    this.isRange = !!m.mode.range;
    this.ffa = !m.mode.teams;
    // free-for-all: everyone except you wears enemy colours
    this.visTeam = (c) => (this.ffa ? (c === this.player ? 0 : 1) : c.team);
    for (const c of m.combatants) {
      let v;
      if (c.dummy) v = new SoldierModel(app.dummyMats, app.wmats, 1, seed++, { unarmed: true });
      else if (c === this.player) v = new SoldierModel(outfitMaterials(app.materials, app.soldierMats, this.cosm.outfit, this.cosm.operator), app.wmats, 0, seed++);
      else v = new SoldierModel(app.soldierMats, app.wmats, this.visTeam(c), seed++);
      v.setWeapon(c.weapon.def.id, undefined, c.weapon.def.attachments);
      app.engine.scene.add(v.root);
      this.views.set(c.id, v);
    }
    this.updateTeamColors();
    this.hud = new Hud(document.getElementById('ui'), app);
    this.hud.setTeams(0);
    this.hud.setFfa(this.ffa && !this.isRange);
    this.vm = app.viewmodel;
    this.vm.visible = true;
    this.vm.setOutfit(this.cosm.outfit, app.materials);
    this.vm.setWeapon(this.player.weapon.def.id, this.cosm.weapons[this.player.weapon.def.id], this.player.weapon.def.attachments);
    this.look = { yaw: 0, pitch: 0 };
    this.recoilDebt = 0;
    this.camKick = { p: 0, y: 0, vp: 0, vy: 0 };
    this.shake = 0;
    this.eyeH = 1.62;
    this.bobPhase = 0;
    this.landDip = 0;
    this.sprintToggle = false;
    this.crouchToggle = false;
    this.adsToggle = false;
    this.paused = false;
    this.ended = false;
    this.endTimer = 0;
    this.leader = -1;
    this.medals = new Map();
    this.radar = new Map(); // enemy id -> time last fired
    this.sbT = 0;
    this.npT = 0;
    this.aimTarget = null;
    this.deathInfo = null;
    this.announced = {};
    this.lastLanded = 0;
    m.on((e) => this.onEvent(e));
    this.unsubSettings = () => {};
    const onSet = () => { this.hud.applySettings(); this.updateTeamColors(); this.objView?.setColors(app.settings.teamColors()); this.depView?.setColors(app.settings.teamColors()); };
    app.settings.onChange(onSet);
    this.unsubSettings = () => { const i = app.settings.listeners.indexOf(onSet); if (i >= 0) app.settings.listeners.splice(i, 1); };
  }

  updateTeamColors() {
    const [f, e] = this.app.settings.teamColors();
    this.app.soldierMats.setTeamColors(f, e, 0);
  }

  start() {
    this.match.start();
    this.look.yaw = this.player.yaw;
    this.look.pitch = 0;
    this.eyeH = this.player.eyeHeight;
    const mode = MODES[this.setup.mode];
    this.app.audio.ambience(true);
    this.countdownBeep = 4;
    if (this.isRange) {
      this.hud.center('FIRING RANGE', 'Targets at 10 · 25 · 40 · 60 · 90 m', 2.5);
      this.hud.rangeMode(true);
      this.range = { hits: 0, shots: 0, last: null, tracks: new Map(), lastKill: null, infinite: true, moving: true };
      this.match.infiniteAmmo = true;
      this.match.movingTargets = true;
      return;
    }
    this.objView = new ObjectiveView(this.app.engine.scene, this.match, 0, this.app.settings.teamColors());
    this.depView = new DeployablesView(this.app.engine.scene, this.match, 0, this.app.settings.teamColors());
    const goal = { tdm: `first to ${this.setup.scoreLimit}`, ffa: `first to ${this.setup.scoreLimit} eliminations`, dom: `capture flags A · B · C — ${this.setup.scoreLimit} points`, hp: `hold the zone — ${this.setup.scoreLimit} points`, elim: `no respawns — first to ${this.setup.scoreLimit} rounds`, gun: `${this.match.ladder?.length || 0} weapons to win` }[mode.id];
    this.hud.center(mode.name.toUpperCase(), `${this.map.def.name} · ${goal}`, 3.4);
    this.app.audio.announce({ tdm: 'Team deathmatch. Eliminate the enemy team.', ffa: 'Free for all. Trust no one.', dom: 'Domination. Capture the flags.', hp: 'Hardpoint. Secure the zone.', elim: 'Elimination. Round one. No respawns.', gun: 'Gun game. Every kill upgrades your weapon.' }[mode.id]);
  }

  // ------------------------------------------------------------------ input
  readInput(dt) {
    const inp = this.app.input, set = this.app.settings.data, p = this.player, cmd = p.cmd;
    const ctl = set.controls;
    const def = p.weapon.def;
    // look
    const zoomEff = 1 + (def.handling.zoom - 1) * p.adsT;
    const adsMul = 1 + (ctl.adsSensitivity / Math.pow(zoomEff, 0.9) - 1) * p.adsT;
    const k = ctl.sensitivity * 0.00042 * adsMul;
    const dx = inp.mouseDX, dy = inp.mouseDY;
    this.look.yaw -= dx * k;
    const dPitch = dy * k * (ctl.invertY ? 1 : -1);
    this.look.pitch += dPitch;
    if (dPitch < 0 && this.recoilDebt > 0) this.recoilDebt = Math.max(0, this.recoilDebt + dPitch);
    // controller look
    if (inp.pad) {
      const rx = inp.padAxes[2], ry = inp.padAxes[3];
      const padK = ctl.padLookSens * 0.75 * (1 + (ctl.padAdsSens / Math.pow(zoomEff, 0.9) - 1) * p.adsT);
      this.look.yaw -= rx * Math.abs(rx) * padK * dt * 2.2;
      this.look.pitch += ry * Math.abs(ry) * padK * dt * 1.6 * (ctl.padInvertY ? 1 : -1);
    }
    this.look.pitch = Math.max(-1.48, Math.min(1.48, this.look.pitch));
    this.mouseDX = dx; this.mouseDY = dy;

    // movement
    let mx = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);
    let mz = (inp.isDown('forward') ? 1 : 0) - (inp.isDown('back') ? 1 : 0);
    if (inp.pad) { mx += inp.padAxes[0]; mz -= inp.padAxes[1]; }
    cmd.moveX = Math.max(-1, Math.min(1, mx));
    cmd.moveZ = Math.max(-1, Math.min(1, mz));
    // sprint: keyboard follows the hold/toggle setting; controller L3 click always latches
    const kbSprintPressed = inp.bindPressed('sprint');
    if (inp.pad && inp.padPressed(PAD.L3)) this.sprintToggle = true;
    if (ctl.sprintMode === 'toggle' && kbSprintPressed) this.sprintToggle = !this.sprintToggle;
    if (cmd.moveZ < 0.3) this.sprintToggle = false;
    const sprint = this.sprintToggle || (ctl.sprintMode === 'hold' && inp.bindDown('sprint'));
    // crouch: keyboard hold/toggle; controller B toggles
    const kbCrouchPressed = inp.bindPressed('crouch');
    if ((ctl.crouchMode === 'toggle' && kbCrouchPressed) || (inp.pad && inp.padPressed(PAD.B))) this.crouchToggle = !this.crouchToggle;
    if ((kbSprintPressed || (inp.pad && inp.padPressed(PAD.L3))) && this.crouchToggle && p.stance !== 'slide') this.crouchToggle = false;
    if (inp.pressed('jump')) this.crouchToggle = false;
    // after a slide ends, a toggled crouch releases so you pop back up
    if (this._wasSlide && p.stance !== 'slide') this.crouchToggle = false;
    this._wasSlide = p.stance === 'slide';
    const crouch = this.crouchToggle || (ctl.crouchMode === 'hold' && inp.bindDown('crouch'));
    cmd.sprint = sprint;
    cmd.crouch = crouch;
    cmd.jump = inp.isDown('jump');
    cmd.fire = inp.isDown('fire');
    if (ctl.adsMode === 'toggle') { if (inp.pressed('ads')) this.adsToggle = !this.adsToggle; if (p.sprinting) this.adsToggle = false; cmd.ads = this.adsToggle; }
    else cmd.ads = inp.isDown('ads');
    cmd.reload = inp.isDown('reload');
    cmd.swap = inp.pressed('swap');
    if (inp.pressed('primary')) cmd.swapTo = 0;
    if (inp.pressed('secondary')) cmd.swapTo = 1;
    cmd.melee = inp.isDown('melee');
    cmd.lethal = inp.isDown('lethal');
    cmd.tactical = inp.isDown('tactical');
    if (!this.isRange) SUPPORT_IDS.forEach((id, i) => { if (inp.pressed('support' + (i + 1))) { if (p.abilities[id] > 0) cmd.support = id; else this.hud.popup(`${SUPPORT[id].name.toUpperCase()} NOT READY`, 0, 'medal'); } });
    cmd.yaw = this.look.yaw;
    cmd.pitch = this.look.pitch;
    if (this.isRange) this.rangeInput();
  }

  /** Firing range hotkeys: T next primary, Y infinite ammo, U reset targets, H moving targets. */
  rangeInput() {
    const inp = this.app.input, r = this.range, m = this.match, p = this.player;
    if (inp.keyPressed('KeyT') || (inp.pad && inp.padPressed(PAD.UP))) {
      const ids = PRIMARY_IDS;
      const next = ids[(ids.indexOf(p.loadout.primary) + 1) % ids.length];
      p.applyLoadout({ ...p.loadout, primary: next });
      p.cur = 0; p.adsT = 0; p.swapT = 0;
      for (const w of p.weapons) w.refill();
      this.vm.setWeapon(next, this.cosm.weapons[next], p.weapon.def.attachments);
      this.hud.popup(WEAPONS[next].name, 0, 'medal');
    }
    if (inp.keyPressed('KeyY')) { r.infinite = !r.infinite; m.infiniteAmmo = r.infinite; this.hud.popup(`INFINITE AMMO ${r.infinite ? 'ON' : 'OFF'}`, 0, 'medal'); }
    if (inp.keyPressed('KeyH')) { r.moving = !r.moving; m.movingTargets = r.moving; this.hud.popup(`MOVING TARGETS ${r.moving ? 'ON' : 'OFF'}`, 0, 'medal'); }
    if (inp.keyPressed('KeyU')) {
      for (const c of m.combatants) if (c.dummy) { m.respawn(c); c.spawnProtectT = 0; }
      r.tracks.clear(); r.hits = 0; r.shots = 0; r.last = null; r.lastKill = null;
      this.hud.popup('TARGETS RESET', 0, 'medal');
    }
  }

  clearInput() {
    const cmd = this.player.cmd;
    cmd.moveX = cmd.moveZ = 0;
    cmd.fire = cmd.ads = cmd.jump = cmd.sprint = cmd.reload = cmd.swap = cmd.melee = cmd.lethal = cmd.tactical = false;
    cmd.yaw = this.look.yaw; cmd.pitch = this.look.pitch;
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    const app = this.app, m = this.match, p = this.player;
    const inp = app.input;
    this.mouseDX = 0; this.mouseDY = 0;
    if (!this.paused) {
      if (p.brain) { this.look.yaw = p.cmd.yaw; this.look.pitch = p.cmd.pitch; }
      else if (!this.ended && p.alive && m.state !== 'ended') this.readInput(dt);
      else this.clearInput();
      // respawn request
      if (!p.alive && m.state === 'live' && m.canRespawn(p)) {
        if (p.respawnT <= 0 && (inp.pressed('jump') || inp.pressed('fire') || p.respawnT < -2.5)) m.respawn(p);
      }
      const wasAlive = p.alive;
      m.tick(dt);
      if (wasAlive && !p.alive) this.onPlayerDeath();
      this.afterTick(dt);
      if (m.state === 'countdown') {
        const n = Math.ceil(m.countdown);
        if (n !== this.countdownBeep && n > 0) { this.countdownBeep = n; app.audio.play('beep', { bus: 'ui', vol: 0.6 }); }
      }
      if (m.state === 'ended') {
        this.endTimer += dt;
        if (this.endTimer > 4 && !this.resultsShown) { this.resultsShown = true; app.showResults(this.buildResult()); }
      }
      this.checkAnnouncements();
    }
    this.updateCamera(dt);
    this.updateViews(dt);
    this.updateViewmodel(dt);
    app.effects.update(this.paused ? 0 : dt, m.projectiles);
    this.objView?.update(this.paused ? 0 : dt);
    this.depView?.update(this.paused ? 0 : dt);
    this.updateHud(dt);
    // audio listener
    const cam = app.engine.camera;
    const fwd = v3.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = v3b.set(0, 1, 0).applyQuaternion(cam.quaternion);
    app.audio.setListener(cam.position, fwd, up);
    // reverb environment: enclosed if there is a roof overhead and walls close by
    this.envT = (this.envT || 0) - dt;
    if (this.envT <= 0) {
      this.envT = 0.25;
      const w = this.match.world;
      const roof = w.raycast(cam.position.x, cam.position.y, cam.position.z, 0, 1, 0, 12, 'solid');
      let walls = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.raycast(cam.position.x, cam.position.y, cam.position.z, dx, 0, dz, 14, 'solid')) walls++;
      this.indoor = roof ? Math.min(1, 0.4 + walls * 0.15) : walls >= 3 ? 0.25 : 0;
    }
    app.audio.setEnvironment(this.indoor || 0);
  }

  afterTick(dt) {
    const p = this.player;
    const def = p.weapon.def;
    // recoil feeds the aim
    if (p.recoilImpulse) {
      this.look.pitch += p.recoilImpulse.v;
      this.look.yaw += p.recoilImpulse.h;
      this.recoilDebt += p.recoilImpulse.v;
      this.camKick.vp += p.recoilImpulse.v * 18;
      p.recoilImpulse = null;
    } else if (this.recoilDebt > 0 && this.match.time - p.weapon.lastShot > 0.1) {
      const rec = Math.min(this.recoilDebt, dt * (0.01 + this.recoilDebt * def.recoil.recover * 0.9));
      this.look.pitch -= rec * 0.65;
      this.recoilDebt -= rec;
    }
    // presentation events from the simulation
    for (const c of this.match.combatants) {
      for (const e of c.events) this.onCombatantEvent(c, e);
      c.events.length = 0;
    }
  }

  onCombatantEvent(c, e) {
    const a = this.app.audio;
    const me = c === this.player;
    const def = c.weapon.def;
    const pos = (vol, name, opts = {}) => (me ? a.play(name, { vol: vol * 0.8, ...opts }) : a.play3D(name, c.x, c.y + 1, c.z, { vol, ...opts }));
    switch (e.type) {
      case 'step': {
        if (!me && c.perks?.has('pk_silence')) break;
        const mat = this.surfaceAt(c);
        const vol = e.sprint ? 0.6 : e.crouch ? 0.15 : 0.35;
        if (me) a.play(a.b.steps?.[mat] || 'land', { vol: vol * 0.45 });
        else a.play3D(a.b.steps?.[mat] || 'land', c.x, c.y + 0.1, c.z, { vol: vol * 1.6, ref: 3 });
        break;
      }
      case 'jump': pos(0.25, 'whoosh'); break;
      case 'land':
        pos(Math.min(0.8, 0.2 + e.v * 0.06), 'land');
        if (me) { this.landed = e.v; this.landDip = Math.min(0.12, e.v * 0.012); }
        break;
      case 'slide': pos(0.5, 'whoosh', { rate: 0.7 }); break;
      case 'mantle': pos(0.4, 'whoosh', { rate: 1.2 }); break;
      case 'reloadStart': {
        if (!e.active) break;
        if (def.tube) break;
        const dur = c.weapon.reloadDur;
        pos(0.6, 'magOut', { delay: dur * 0.18 });
        pos(0.7, 'magIn', { delay: dur * 0.55 });
        if (c.weapon.mag === 0) pos(0.6, 'charge', { delay: dur * 0.76 });
        break;
      }
      case 'shellIn': pos(0.55, 'shell'); break;
      case 'swapOut': pos(0.5, 'swap'); break;
      case 'dry': pos(0.6, 'dry'); break;
      case 'melee': pos(0.5, 'whoosh', { rate: 1.4 }); break;
      case 'throw': pos(0.5, 'pin'); break;
      case 'spawn': if (me) this.onPlayerSpawn(); break;
      default: break;
    }
  }

  surfaceAt(c) {
    const list = this.match.world.query(c.x - 0.2, c.z - 0.2, c.x + 0.2, c.z + 0.2, []);
    let best = null;
    for (const b of list) if (b.maxY <= c.y + 0.05 && (!best || b.maxY > best.maxY)) best = b;
    if (!best) return 'concrete';
    // rail bed ballast is visual-only; detect by position
    if (this.map.def.id === 'cinder_yard' && best.maxY <= 0.001 && (Math.abs(Math.abs(c.z) - 7) < 1.7) && Math.abs(c.x) < 37) return 'gravel';
    return best.mat;
  }

  onEvent(e) {
    const app = this.app, a = app.audio, hud = this.hud, p = this.player, fx = app.effects;
    switch (e.type) {
      case 'shot': {
        const c = e.c, def = WEAPONS[e.weapon];
        const me = c === p;
        if (me) this.summary.weaponsUsed.add(e.weapon);
        const view = this.views.get(c.id);
        let mx, my, mz;
        if (me) {
          this.vm.onFire(def);
          a.play('shot_' + def.audio.kind, { vol: 0.85, rate: def.audio.pitch * (0.97 + Math.random() * 0.06), send: 0.5 });
          if (def.bolt) a.play('bolt', { vol: 0.5, delay: 0.25 });
          if (def.pump) a.play('pump', { vol: 0.6, delay: 0.16 });
          this.app.input.rumble(def.class === 'sniper' || def.class === 'shotgun' ? 0.8 : 0.35, 0.3, 70);
          // tracer origin: viewmodel muzzle mapped into world space
          const mw = this.vmMuzzleWorld(v3);
          mx = mw.x; my = mw.y; mz = mw.z;
          const fwd = v3b.set(0, 0, -1).applyQuaternion(app.engine.camera.quaternion);
          fx.muzzleFlash(mx + fwd.x * 0.3, my + fwd.y * 0.3, mz + fwd.z * 0.3, fwd.x, fwd.y, fwd.z, 0.8);
        } else {
          view?.fired();
          const mw = view ? view.muzzleWorld(v3) : v3.set(c.x, c.eyeY, c.z);
          mx = mw.x; my = mw.y; mz = mw.z;
          const dx = -Math.sin(c.yaw), dz = -Math.cos(c.yaw);
          fx.muzzleFlash(mx, my, mz, dx, Math.sin(c.pitch), dz, def.class === 'shotgun' ? 1.4 : 1);
          const cam = app.engine.camera.position;
          const occluded = !this.match.canSee(cam.x, cam.y, cam.z, c.x, c.eyeY, c.z);
          a.play3D('shot_' + def.audio.kind, c.x, c.eyeY, c.z, { vol: 1.0, rate: def.audio.pitch, occluded, ref: 6, echo: true });
          if (c.team !== p.team && !def.suppressed) this.radar.set(c.id, this.match.time);
        }
        for (const end of e.ends) {
          if (e.tracer || (!me && Math.random() < 0.5)) fx.tracer(mx, my, mz, end.x, end.y, end.z);
          if (end.world) {
            fx.impact(end.x, end.y, end.z, end.world.nx, end.world.ny, end.world.nz, end.world.mat);
            const cam = app.engine.camera.position;
            const d = Math.hypot(end.x - cam.x, end.y - cam.y, end.z - cam.z);
            if (d < 18 && (me || Math.random() < 0.6)) a.play3D(a.b.impact?.[end.world.mat === 'metal' ? 'metal' : 'concrete'], end.x, end.y, end.z, { vol: me ? 0.35 : 0.5, ref: 2 });
          } else if (end.victim) {
            const dl = Math.hypot(end.x - e.ox, end.z - e.oz) || 1;
            fx.bodyHit(end.x, end.y, end.z, (end.x - e.ox) / dl, (end.z - e.oz) / dl, end.zone === 'head');
          }
          // near miss whiz
          if (!me && p.alive && end.victim !== p) {
            const ex = p.x, ey = p.eyeY, ez = p.z;
            const dx = end.x - e.ox, dy = end.y - e.oy, dz = end.z - e.oz;
            const L = Math.hypot(dx, dy, dz) || 1;
            const t = ((ex - e.ox) * dx + (ey - e.oy) * dy + (ez - e.oz) * dz) / L;
            if (t > 2 && t < L) {
              const px = e.ox + dx / L * t, py = e.oy + dy / L * t, pz = e.oz + dz / L * t;
              const md = Math.hypot(px - ex, py - ey, pz - ez);
              if (md < 1.6 && Math.random() < 0.7) { a.play3D('whiz', px, py, pz, { vol: 0.7, ref: 1.5 }); this.shake = Math.max(this.shake, 0.08); }
            }
          }
        }
        break;
      }
      case 'damage': {
        if (e.victim !== p && e.fromX !== undefined) {
          const v = this.views.get(e.victim.id);
          if (v) { const ry = Math.cos(e.victim.yaw) * (e.fromX - e.victim.x) - Math.sin(e.victim.yaw) * (e.fromZ - e.victim.z); v.hit(Math.sign(ry) || 1); }
        }
        if (this.isRange && e.attacker === p) {
          const r = this.range;
          const dist = Math.hypot(e.victim.x - p.x, e.victim.z - p.z);
          r.last = { dmg: e.amount, zone: e.zone, dist, weapon: WEAPONS[e.weapon]?.name || e.weapon };
          let tr = r.tracks.get(e.victim.id);
          if (!tr) { tr = { t0: this.match.time, shots0: p.stats.shots - 1 }; r.tracks.set(e.victim.id, tr); }
          if (e.kill) {
            r.lastKill = { ms: Math.round((this.match.time - tr.t0) * 1000), shots: p.stats.shots - tr.shots0, dist, weapon: WEAPONS[e.weapon]?.name || e.weapon };
            r.tracks.delete(e.victim.id);
          }
        }
        if (e.attacker === p && e.victim !== p) {
          hud.hitmarker(e.kill, e.zone === 'head');
          if (app.settings.data.interface.hitSound) a.play(e.zone === 'head' ? 'hitHead' : 'hit', { bus: 'sfx', vol: e.zone === 'head' ? 0.5 : 0.45 });
          const sp = this.project(e.victim.x, e.victim.y + 1.5, e.victim.z);
          if (sp) hud.damageNumber(sp.x + (Math.random() - 0.5) * 30, sp.y, e.amount, e.zone === 'head');
        }
        if (e.victim === p) {
          if (e.fromX !== undefined && e.attacker !== p) hud.damageFrom(e.fromX, e.fromZ);
          a.play('hurt', { vol: 0.6 });
          this.shake = Math.max(this.shake, Math.min(0.35, e.amount / 140));
          this.camKick.vp += (Math.random() - 0.3) * e.amount * 0.004;
          this.camKick.vy += (Math.random() - 0.5) * e.amount * 0.004;
          app.input.rumble(0.6, 0.6, 140);
        }
        break;
      }
      case 'kill': {
        const kname = WEAPONS[e.weapon]?.name;
        if (e.killer === p && e.victim !== p && e.victim.team !== p.team && !this.isRange) {
          const S = this.summary, wd = WEAPONS[e.weapon];
          if (wd) { S.weaponKills[e.weapon] = (S.weaponKills[e.weapon] || 0) + 1; S.classKills[wd.class] = (S.classKills[wd.class] || 0) + 1; if (e.headshot) S.weaponHeadshots[e.weapon] = (S.weaponHeadshots[e.weapon] || 0) + 1; }
          if (e.kind === 'explosive') S.grenadeKills++;
          if (e.kind === 'melee') S.meleeKills++;
          for (const md of e.medals) { if (md.id === 'longshot') S.longshots++; if (['double', 'triple', 'fury'].includes(md.id)) S.multikills++; }
        }
        hud.killfeed({ ...e, killer: e.killer && { ...e.killer, name: e.killer.displayName, team: e.killer.team, isBot: e.killer.isBot, id: e.killer.id }, victim: { ...e.victim, name: e.victim.displayName, team: e.victim.team, isBot: e.victim.isBot, id: e.victim.id }, weaponName: kname }, p.id);
        if (e.killer === p && e.victim !== p) {
          hud.popup(e.headshot ? 'HEADSHOT' : 'ELIMINATED', this.isRange ? 0 : 100);
          if (!this.isRange) for (const md of e.medals) {
            if (md.id === 'headshot') continue;
            hud.popup(md.name.toUpperCase(), md.xp, 'medal');
          }
          for (const md of e.medals) this.medals.set(md.id, { name: md.name, count: (this.medals.get(md.id)?.count || 0) + 1 });
          a.play('kill', { bus: 'sfx', vol: 0.45 });
          app.input.rumble(0.4, 0.8, 120);
        }
        if (e.assisters.includes(p)) hud.popup('ASSIST', 25);
        if (e.victim === p) {
          const k = e.killer;
          this.deathInfo = {
            by: k && k !== p ? 'ELIMINATED BY' : 'YOU DIED',
            who: k && k !== p ? k.displayName : (e.weapon === 'frag' ? 'Your own grenade' : 'Environment'),
            how: k && k !== p ? `${e.weapon === 'frag' ? 'M-7 FRAG' : e.weapon === 'strike' ? 'AREA STRIKE' : e.weapon === 'melee' ? 'MELEE' : (kname || '')}${e.headshot ? ' · HEADSHOT' : ''}${e.dist ? ` · ${Math.round(e.dist)} m` : ''}` : '',
            color: k && k.team !== p.team ? 'var(--enemy)' : 'var(--friendly)',
            killer: k,
          };
        }
        break;
      }
      case 'grenadeBounce': a.play3D('bounce', e.g.x, e.g.y, e.g.z, { vol: 0.5, ref: 2 }); break;
      case 'explosion': {
        fx.explosion(e.x, e.y, e.z, e.radius);
        const cam = app.engine.camera.position;
        const occluded = !this.match.canSee(cam.x, cam.y, cam.z, e.x, e.y + 0.5, e.z);
        a.play3D('explosion', e.x, e.y + 0.5, e.z, { vol: 1.4, ref: 8, occluded, echo: true, send: 0.6 });
        const d = Math.hypot(e.x - cam.x, e.z - cam.z);
        this.shake = Math.max(this.shake, Math.max(0, 0.9 - d / 25));
        if (d < 12) app.input.rumble(1, 1, 300);
        if (d < 9 && !occluded) hud.flash(Math.max(0.15, 0.5 - d / 20));
        break;
      }
      case 'flash': {
        fx.muzzleFlash?.(e.x, e.y, e.z, 0, 1, 0, 3);
        const cp = this.app.engine.camera.position;
        const occluded = !this.match.canSee(cp.x, cp.y, cp.z, e.x, e.y, e.z);
        a.play3D('explosion', e.x, e.y + 0.3, e.z, { vol: 0.9, rate: 1.8, ref: 6, occluded, echo: true });
        break;
      }
      case 'flashed':
        if (e.c === p) { a.play('beepHi', { vol: 0.35 * Math.min(1, e.t / 3), rate: 2.4 }); app.input.rumble(0.6, 0.6, 400); }
        else if (e.owner === p && e.c.team !== p.team) hud.popup('FLASHED', 0, 'medal');
        break;
      case 'shield': a.play3D('bolt', e.s.x, e.s.y + 0.6, e.s.z, { vol: 0.9, rate: 0.6, ref: 4 }); break;
      case 'shieldGone': if (e.broken) { a.play3D('impact', e.s.x, e.s.y + 0.6, e.s.z, { vol: 1.2, rate: 0.5, ref: 5 }); fx.explosion?.(e.s.x, e.s.y + 0.5, e.s.z, 0.6); } break;
      case 'supportEarned':
        if (e.c === p) {
          const k = app.input.label('support' + (SUPPORT_IDS.indexOf(e.id) + 1));
          hud.center(`${SUPPORT[e.id].name.toUpperCase()} READY`, `Press ${k} · ${SUPPORT[e.id].desc}`, 2.4, 'var(--accent)');
          a.play('beepHi', { bus: 'ui', vol: 0.6 });
          a.announce(`${SUPPORT[e.id].name} ready.`);
        }
        break;
      case 'supportUsed': {
        const ally = e.c.team === p.team && !this.ffa;
        const mine = e.c === p;
        const name = SUPPORT[e.id].name;
        if (e.id === 'recon') { hud.popup(mine || ally ? 'RECON SCAN ACTIVE' : 'ENEMY RECON SCAN', 0, 'medal'); a.announce(mine || ally ? 'Recon scan online. Enemies marked.' : 'Enemy recon scan detected.'); }
        else if (e.id === 'supply') { if (mine || ally) a.announce('Supply drop inbound.'); }
        else if (e.id === 'strike') { a.announce(mine ? 'Area strike called in.' : ally ? 'Friendly area strike inbound.' : 'Enemy area strike incoming!'); if (!mine && !ally) hud.center('INCOMING AREA STRIKE', 'Watch for the marked zone', 2, 'var(--bad)'); }
        if (!mine && (ally || e.id !== 'recon')) hud.killfeed?.({ system: true, text: `${e.c.displayName} · ${name}` }, p.id);
        break;
      }
      case 'dropLanded': a.play3D('land', e.d.x, e.d.y + 0.3, e.d.z, { vol: 1.4, rate: 0.6, ref: 5 }); break;
      case 'supplyPickup': if (e.c === p) { hud.popup('RESUPPLIED', 0, 'medal'); a.play('magIn', { vol: 0.8 }); } break;
      case 'smoke': fx.smokeCloud(e.x, e.y, e.z, e.radius, e.duration); a.play3D('smokePop', e.x, e.y, e.z, { vol: 0.8, ref: 4 }); break;
      case 'melee': if (e.hit) a.play3D('meleeHit', e.c.x, e.c.y + 1.2, e.c.z, { vol: 0.8, ref: 3 }); break;
      case 'live':
        if (this.isRange) break;
        hud.center('ENGAGE', '', 1.2, 'var(--accent)');
        a.play('horn', { bus: 'sfx', vol: 0.5 });
        break;
      case 'objective': this.onObjective(e); break;
      case 'roundEnd': {
        const me = e.winner === p.team;
        hud.center(e.winner < 0 ? 'ROUND DRAW' : me ? 'ROUND WON' : 'ROUND LOST', `${TEAMS[0].name} ${e.scores[0]} — ${e.scores[1]} ${TEAMS[1].name}${e.reason === 'time' ? ' · time' : ''}`, 4, e.winner < 0 ? 'var(--accent-2)' : me ? 'var(--good)' : 'var(--bad)');
        a.announce(e.winner < 0 ? 'Round draw.' : me ? 'Round won.' : 'Round lost.');
        break;
      }
      case 'roundStart':
        hud.center(`ROUND ${e.n}`, 'No respawns', 2.5);
        a.play('horn', { bus: 'sfx', vol: 0.4 });
        this.deathCam = null; this.deathInfo = null; hud.death(null);
        break;
      case 'matchEnd': {
        this.ended = true;
        const w = e.winner;
        const outcome = w === -1 ? 'draw' : w === p.team ? 'win' : 'loss';
        hud.center(outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW', e.reason === 'score' ? 'SCORE LIMIT REACHED' : 'TIME LIMIT REACHED', 5, outcome === 'win' ? 'var(--good)' : outcome === 'loss' ? 'var(--bad)' : 'var(--accent-2)');
        a.play('sting', { bus: 'music', vol: 0.8 });
        a.announce(outcome === 'win' ? 'Victory. Mission accomplished.' : outcome === 'loss' ? 'Defeat. Mission failed.' : 'Draw.');
        app.input.exitLock();
        break;
      }
      default: break;
    }
  }

  checkAnnouncements() {
    const m = this.match, a = this.app.audio;
    if (m.state !== 'live' || this.isRange) return;
    let lead = -1, total = 0;
    if (this.ffa) {
      const me = m.teamScores[0], top = Math.max(...m.teamScores.slice(1));
      lead = me > top ? 0 : top > me ? 1 : -1; total = me + top;
    } else {
      const [s0, s1] = m.teamScores;
      lead = s0 > s1 ? 0 : s1 > s0 ? 1 : -1; total = s0 + s1;
    }
    if (!m.mode.rounds && m.mode.id !== 'gun' && lead !== this.leader && lead !== -1 && total > 2) {
      a.announce(this.ffa ? (lead === 0 ? 'You are in the lead.' : 'You have lost the lead.') : lead === this.player.team ? 'We have taken the lead.' : 'We have lost the lead.');
    }
    if (lead !== -1) this.leader = lead;
    if (!m.mode.rounds) {
      if (m.timeLeft < 60 && !this.announced.min) { this.announced.min = 1; a.announce('One minute remaining.'); }
      if (m.timeLeft < 30 && !this.announced.s30) { this.announced.s30 = 1; a.announce('Thirty seconds.'); }
    }
    const lim = m.settings.scoreLimit;
    const near = { tdm: 5, ffa: 3, dom: 25, hp: 25 }[m.mode.id];
    if (near && !this.ffa) {
      for (const t of [0, 1]) {
        if (m.teamScores[t] >= lim - near && !this.announced['near' + t]) {
          this.announced['near' + t] = 1;
          a.announce(t === this.player.team ? 'We are close to victory.' : 'The enemy is close to victory.');
        }
      }
    }
  }

  onObjective(e) {
    const hud = this.hud, a = this.app.audio, p = this.player;
    const ours = (t) => t === p.team;
    switch (e.kind) {
      case 'capture': if (e.c === p) hud.popup(`FLAG ${e.flag} CAPTURED`, 150); break;
      case 'defend': if (e.c === p) hud.popup('FLAG DEFENDED', 50); break;
      case 'flagCaptured': a.announce(ours(e.team) ? `We have captured ${e.flag}.` : `The enemy has captured ${e.flag}.`); break;
      case 'flagLost': if (ours(e.team)) a.announce(`We are losing ${e.flag}.`); break;
      case 'zoneMoved': hud.center('HARDPOINT MOVED', this.match.zones[e.idx]?.name || '', 2.2, 'var(--accent)'); a.announce(e.idx === 0 && this.match.time < 1 ? 'Hardpoint online.' : 'The hardpoint has moved.'); break;
      case 'zoneHeld': a.announce(ours(e.team) ? 'We control the hardpoint.' : 'The enemy controls the hardpoint.'); break;
      case 'gunUp': if (e.c === p) { hud.popup(`LEVEL ${e.level + 1} · ${(WEAPONS[e.weapon]?.name || 'MELEE').toUpperCase()}`, 0, 'medal'); a.play('kill', { vol: 0.5, rate: 1.3 }); } break;
      case 'setBack': if (e.c === p) { hud.center('SET BACK', `by ${e.by.displayName}`, 2, 'var(--bad)'); a.announce('Set back.'); } else if (e.by === p) hud.popup('SET BACK AN ENEMY', 0, 'medal'); break;
      default: break;
    }
  }

  onPlayerDeath() {
    this.app.audio.play('hurt', { vol: 0.9, rate: 0.7 });
    this.recoilDebt = 0;
    this.deathCam = { t: 0, x: this.player.x, y: this.player.eyeY, z: this.player.z, yaw: this.look.yaw, pitch: this.look.pitch };
  }

  onPlayerSpawn() {
    const p = this.player;
    this.look.yaw = p.yaw; this.look.pitch = 0;
    this.recoilDebt = 0;
    this.eyeH = p.eyeHeight;
    this.deathInfo = null;
    this.deathCam = null;
    this.crouchToggle = false; this.sprintToggle = false; this.adsToggle = false;
    this.hud.death(null);
  }

  // ------------------------------------------------------------------ camera
  updateCamera(dt) {
    const cam = this.app.engine.camera, p = this.player, set = this.app.settings.data;
    const motion = set.accessibility.reducedMotion ? 0 : 1;
    // kick spring
    const k = this.camKick;
    k.vp += (-k.p * 200 - k.vp * 22) * dt; k.p += k.vp * dt;
    k.vy += (-k.y * 200 - k.vy * 22) * dt; k.y += k.vy * dt;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * set.graphics.cameraShake * motion;
    const t = performance.now() / 1000;
    const shx = (Math.sin(t * 61) + Math.sin(t * 37)) * 0.5 * sh * 0.04, shy = (Math.sin(t * 53) + Math.cos(t * 29)) * 0.5 * sh * 0.04;
    if (p.alive || !this.deathCam) {
      this.eyeH += (p.eyeHeight - this.eyeH) * Math.min(1, dt * 12);
      // head bob
      const moving = p.grounded && p.speed > 0.5 && p.stance !== 'slide';
      if (moving) this.bobPhase += dt * p.speed * 1.9;
      const bobAmt = (moving ? Math.min(1, p.speed / 6) : 0) * set.graphics.headBob * motion * (1 - p.adsT * 0.9);
      const bob = Math.abs(Math.sin(this.bobPhase)) * 0.035 * bobAmt;
      this.landDip = Math.max(0, this.landDip - dt * 0.6);
      cam.position.set(p.x, p.y + this.eyeH - bob - this.landDip * motion, p.z);
      const tilt = p.stance === 'slide' ? 0.06 * motion : 0;
      cam.rotation.set(this.look.pitch + k.p * motion + shy, this.look.yaw + k.y * motion + shx, Math.sin(this.bobPhase * 0.5) * 0.004 * bobAmt + tilt);
    } else {
      // death cam: rise behind the body and look toward the killer
      const dc = this.deathCam;
      dc.t += dt;
      this.spectating = null;
      if (this.match.mode.rounds && dc.t > 3) {
        const mate = this.match.combatants.find((c) => c.alive && c.team === p.team && c !== p);
        if (mate) {
          this.spectating = mate;
          // over-the-shoulder, pulled in if a wall is behind them
          const hx = mate.x, hy = mate.y + 1.7, hz = mate.z;
          let dx = Math.sin(mate.yaw) * 3.2, dy = 0.6, dz = Math.cos(mate.yaw) * 3.2;
          const L = Math.hypot(dx, dy, dz);
          const hit = this.match.world.raycast(hx, hy, hz, dx / L, dy / L, dz / L, L, 'solid');
          const d = hit ? Math.max(0.4, hit.t - 0.3) : L;
          cam.position.lerp(v3.set(hx + dx / L * d, hy + dy / L * d, hz + dz / L * d), Math.min(1, dt * 6));
          cam.rotation.set(-0.25, mate.yaw, 0);
          this.app.engine.setZoom(1);
          cam.updateMatrixWorld();
          return;
        }
      }
      const kk = Math.min(1, dc.t / 1.2);
      const killer = this.deathInfo?.killer;
      let tyaw = dc.yaw, tpitch = -0.5;
      if (killer && killer.alive && killer !== p) {
        const dx = killer.x - p.x, dz = killer.z - p.z;
        tyaw = Math.atan2(-dx, -dz);
        tpitch = Math.atan2(killer.eyeY - (p.y + 2.6), Math.hypot(dx, dz));
      }
      dc.yaw += angleDiff(dc.yaw, tyaw) * Math.min(1, dt * 3);
      dc.pitch += (tpitch - dc.pitch) * Math.min(1, dt * 3);
      const back = 2.8 * kk;
      const want = v3.set(p.x + Math.sin(dc.yaw) * back, p.y + 0.6 + 2.0 * kk, p.z + Math.cos(dc.yaw) * back);
      // keep the camera out of walls
      const dirx = want.x - p.x, diry = want.y - (p.y + 0.6), dirz = want.z - p.z;
      const L = Math.hypot(dirx, diry, dirz) || 1;
      const hit = this.match.world.raycast(p.x, p.y + 0.6, p.z, dirx / L, diry / L, dirz / L, L, 'solid');
      const d = hit ? Math.max(0.3, hit.t - 0.3) : L;
      cam.position.set(p.x + dirx / L * d, p.y + 0.6 + diry / L * d, p.z + dirz / L * d);
      cam.rotation.set(dc.pitch, dc.yaw, 0);
    }
    // zoom
    const def = p.weapon.def;
    let zoom = 1 + (def.handling.zoom - 1) * smooth(p.adsT);
    if (def.handling.scope) zoom = p.adsT > 0.92 ? def.handling.zoom : 1 + 0.25 * p.adsT;
    if (p.sprinting && motion) zoom *= 0.96;
    if (!p.alive) zoom = 1;
    this.app.engine.setZoom(zoom);
    cam.updateMatrixWorld();
  }

  vmMuzzleWorld(out) {
    const mk = this.vm.cur?.markers.muzzle;
    if (!mk) return out.copy(this.app.engine.camera.position);
    mk.getWorldPosition(out);
    return out.applyMatrix4(this.app.engine.camera.matrixWorld);
  }

  updateViewmodel(dt) {
    const p = this.player;
    this.vm.setWeapon(p.weapon.def.id, this.cosm.weapons[p.weapon.def.id], p.weapon.def.attachments);
    const scoped = !!(p.weapon.def.handling.scope && p.adsT > 0.92 && p.alive);
    this.vm.visible = p.alive && !scoped && !this.ended;
    this.scoped = scoped;
    this.vm.update(this.paused ? 0 : dt, {
      adsT: p.adsT, sprinting: p.sprinting, stance: p.stance, speed: p.speed, grounded: p.grounded,
      weapon: p.weapon, swapT: p.swapT, swapDur: p.swapDur, meleeT: p.meleeT, throwT: p.throwT, throwKind: p.throwKind,
      mantle: !!p.mantle, mouseDX: this.mouseDX || 0, mouseDY: this.mouseDY || 0, landed: this.landed || 0,
    });
    this.landed = 0;
  }

  updateViews(dt) {
    const cam = this.app.engine.camera.position;
    for (const c of this.match.combatants) {
      const v = this.views.get(c.id);
      const isMe = c === this.player;
      const deadLong = !c.alive && this.match.time - c.deathT > 5;
      const far = Math.hypot(c.x - cam.x, c.z - cam.z) > 160;
      v.root.visible = (isMe ? !c.alive : true) && !deadLong && !far;
      if (!v.root.visible) continue;
      v.root.position.set(c.x, c.y, c.z);
      v.root.rotation.y = c.yaw;
      if (isMe) v.setWeapon(c.weapon.def.id, finishMaterials(this.app.wmats, this.cosm.weapons[c.weapon.def.id]?.finish), c.weapon.def.attachments);
      else v.setWeapon(c.weapon.def.id, undefined, c.weapon.def.attachments);
      v.setLod(Math.hypot(c.x - cam.x, c.z - cam.z) > 55);
      v.update({ speed: c.speed, sprinting: c.sprinting, stance: c.stance, grounded: c.grounded || !!c.mantle, pitch: c.pitch, adsT: c.adsT, reloading: c.weapon.reloading || c.swapT > 0, alive: c.alive, vx: c.vx, vz: c.vz, yaw: c.yaw }, this.paused ? 0 : dt);
    }
  }

  project(x, y, z) {
    const cam = this.app.engine.camera;
    v3b.set(x, y, z).project(cam);
    if (v3b.z > 1 || v3b.z < -1) return null;
    return { x: (v3b.x * 0.5 + 0.5) * window.innerWidth, y: (-v3b.y * 0.5 + 0.5) * window.innerHeight };
  }

  updateHud(dt) {
    const p = this.player, m = this.match, hud = this.hud, app = this.app, inp = app.input;
    const w = p.weapon;
    const nades = [];
    for (const g of m.projectiles.list) if (g.kind === 'frag' && p.alive && Math.hypot(g.x - p.x, g.z - p.z) < 8) nades.push(g);
    hud.update(dt, {
      alive: p.alive, health: p.health, weaponName: w.def.name, mag: w.def.melee ? '—' : w.mag, magSize: w.def.melee ? 0 : w.def.mag, reserve: w.def.melee ? '' : w.reserve,
      lethal: p.lethal.count, tactical: p.tactical.count, scores: this.hudScores(), timeLeft: m.timeLeft, scoreLimit: m.settings.scoreLimit, limitText: this.limitText(),
      sprinting: p.sprinting, adsT: p.adsT, busy: p.swapT > 0 || p.throwT > 0 || p.meleeT > 0, scoped: this.scoped,
      spreadDeg: p.spreadDeg(), vfov: app.engine.camera.fov * Math.PI / 180, reloading: w.reloading, protect: p.spawnProtectT,
      x: p.x, z: p.z, yaw: this.look.yaw, nades,
      keys: { lethal: inp.label('lethal'), tactical: inp.label('tactical'), reload: inp.label('reload') },
    });
    hud.blind(p.alive && p.blindT > 0 ? Math.min(1, p.blindT / Math.min(1.6, p.blindMax || 1)) : 0);
    hud.support(SUPPORT_IDS.map((id, i) => ({ id, name: SUPPORT[id].name, key: inp.label('support' + (i + 1)), have: Math.min(p.supportKills, supportThreshold(id, p.perks)), need: supportThreshold(id, p.perks), ready: p.abilities[id] })), this.isRange || !p.alive);
    if (!this.isRange) for (const c of m.combatants) if (m.deployables.revealed(c, p.team)) this.radar.set(c.id, m.time);
    if (this.isRange) hud.rangePanel(this.rangeHtml());
    else { hud.objStrip(this.objStripHtml()); hud.objMarkers(this.objMarkerList()); }
    // death overlay
    if (!p.alive && this.deathInfo && m.state === 'live') {
      const rt = Math.max(0, p.respawnT);
      if (!m.canRespawn(p)) this.deathInfo.respawn = this.spectating ? `Spectating ${esc(this.spectating.displayName)} · respawn next round` : 'Eliminated · respawn next round';
      else this.deathInfo.respawn = rt > 0 ? `Respawning in ${rt.toFixed(1)}` : `Press <span class="key">${esc(inp.label('jump'))}</span> to respawn`;
      hud.death(this.deathInfo);
    } else if (p.alive || m.state !== 'live') hud.death(null);
    // scoreboard
    const showSb = (inp.isDown('scoreboard') && !this.paused) || (!p.alive && m.state === 'live' && p.respawnT > 1.5 && false);
    this.sbT -= dt;
    if (showSb && this.sbT <= 0) { this.sbT = 0.25; hud.scoreboard(true, this.scoreboardHtml()); } else if (!showSb) hud.scoreboard(false);
    // nameplates (every other frame)
    this.npT -= dt;
    if (this.npT <= 0) {
      this.npT = 1 / 30;
      hud.nameplates(this.nameplates());
    }
    // minimap
    const [fc, ec] = app.settings.teamColors();
    const dots = [];
    for (const c of m.combatants) {
      if (!c.alive || c === p) continue;
      if (c.team === p.team) dots.push({ x: c.x, z: c.z, color: fc, kind: 'ally', yaw: c.yaw });
      else {
        const t = this.radar.get(c.id);
        if (t !== undefined && m.time - t < 2) dots.push({ x: c.x, z: c.z, color: '#ff3b30', kind: 'enemy' });
      }
    }
    hud.minimap(this.map.minimap, { x: p.alive ? p.x : p.x, z: p.z, yaw: this.look.yaw }, dots);
  }

  hudScores() {
    const m = this.match;
    if (!this.ffa) return m.teamScores;
    return [m.teamScores[0], Math.max(0, ...m.teamScores.slice(1))];
  }

  limitText() {
    const m = this.match, id = m.mode.id, lim = m.settings.scoreLimit;
    if (id === 'gun') return `LEVEL ${Math.min((this.player.gunLevel || 0) + 1, m.ladder.length)} / ${m.ladder.length}`;
    if (id === 'elim') return `ROUND ${m.round?.n || 1} · FIRST TO ${lim}`;
    return `FIRST TO ${lim}`;
  }

  objStripHtml() {
    const m = this.match, p = this.player;
    const [fc, ec] = this.app.settings.teamColors();
    const col = (t) => (t < 0 ? '#d8d8d0' : t === p.team ? fc : ec);
    if (m.flags) {
      return m.flags.map((f) => {
        const lead = f.progress > 0 ? 0 : 1, pct = Math.round(Math.abs(f.progress) * 100);
        return `<div class="fl" style="border-color:${f.contested ? '#ff3b30' : col(f.owner)};color:${col(f.owner)}"><i style="height:${pct}%;background:${col(pct ? lead : -1)}"></i><span style="position:relative">${f.id}</span></div>`;
      }).join('');
    }
    if (m.hp && m.zones?.length) {
      const h = m.hp, z = m.zones[h.idx];
      const st = h.contested ? '<span style="color:#ff3b30">CONTESTED</span>' : h.owner < 0 ? 'NEUTRAL' : h.owner === p.team ? `<span style="color:${fc}">SECURED</span>` : `<span style="color:${ec}">ENEMY HELD</span>`;
      return `<div class="tag">${esc((z.name || 'ZONE').toUpperCase())} · ${st} · MOVES IN ${Math.ceil(h.t)}s</div>`;
    }
    if (m.round) {
      const pips = (t) => m.combatants.filter((c) => c.team === t).map((c) => `<span class="pip ${c.alive ? 'on' : ''}"></span>`).join('');
      return `<div class="pips" style="color:${fc}">${pips(p.team)}</div><div class="tag">ROUND ${m.round.n}${m.round.phase === 'post' ? ' · OVER' : ''}</div><div class="pips" style="color:${ec}">${pips(1 - p.team)}</div>`;
    }
    if (m.ladder) {
      const lv = p.gunLevel || 0, next = m.ladder[lv + 1];
      const name = (id) => (id === 'melee' ? 'MELEE' : WEAPONS[id]?.name || id);
      return `<div class="tag">NEXT: ${next ? esc(name(next)) : 'WIN'}</div>`;
    }
    return '';
  }

  objMarkerList() {
    const m = this.match, p = this.player, out = [];
    const [fc, ec] = this.app.settings.teamColors();
    const col = (t) => (t < 0 ? '#d8d8d0' : t === p.team ? fc : ec);
    const cam = this.app.engine.camera.position;
    const add = (x, y, z, label, color, pulse) => {
      const sp = this.projectEdge(x, y, z);
      out.push({ x: sp.x, y: sp.y, label, color, pulse, sub: `${Math.round(Math.hypot(x - cam.x, z - cam.z))}m` });
    };
    if (m.flags) for (const f of m.flags) add(f.x, 3.4, f.z, f.id, f.contested ? '#ff3b30' : col(f.owner), f.contested);
    if (m.hp && m.zones?.length && m.state !== 'ended') { const z = m.zones[m.hp.idx]; add(z.x, 2.6, z.z, 'HP', m.hp.contested ? '#ff3b30' : col(m.hp.owner), m.hp.contested); }
    return out;
  }

  /** Project a world point to the screen, clamped to the edges when off-screen or behind. */
  projectEdge(x, y, z) {
    const cam = this.app.engine.camera;
    v3b.set(x, y, z).project(cam);
    const W = window.innerWidth, H = window.innerHeight;
    let sx = v3b.x, sy = v3b.y;
    const behind = v3b.z > 1;
    if (behind) { sx = -sx; sy = -sy; }
    const off = behind || Math.abs(sx) > 0.95 || Math.abs(sy) > 0.9;
    if (off) { const k = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86, 1e-3); sx /= k; sy /= k; if (behind && Math.abs(sy) < 0.86) sy = -0.86; }
    return { x: (sx * 0.5 + 0.5) * W, y: (-sy * 0.5 + 0.5) * H };
  }

  nameplates() {
    const p = this.player, m = this.match, out = [];
    const [fc, ec] = this.app.settings.teamColors();
    const cam = this.app.engine.camera;
    // enemy under crosshair (visible only)
    let aimed = null;
    if (p.alive) {
      const cp = Math.cos(this.look.pitch);
      const dx = -Math.sin(this.look.yaw) * cp, dy = Math.sin(this.look.pitch), dz = -Math.cos(this.look.yaw) * cp;
      const r = m.trace(p, cam.position.x, cam.position.y, cam.position.z, dx, dy, dz, 120);
      if (r.victim && r.victim.team !== p.team) aimed = r.victim;
    }
    if (aimed) this.aimTarget = { c: aimed, t: m.time };
    for (const c of m.combatants) {
      if (c === p || !c.alive) continue;
      const friendly = c.team === p.team;
      const showEnemy = this.aimTarget && this.aimTarget.c === c && m.time - this.aimTarget.t < 0.4;
      if (!friendly && !showEnemy) continue;
      const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z);
      if (friendly && d > 90) continue;
      const sp = this.project(c.x, c.y + (c.stance === 'stand' ? 2.05 : 1.5), c.z);
      if (!sp) continue;
      out.push({ x: sp.x, y: sp.y, text: d < 30 || !friendly ? c.displayName : '', color: friendly ? fc : ec, chev: friendly, alpha: friendly ? Math.max(0.5, 1 - d / 120) : 1 });
    }
    return out;
  }

  rangeHtml() {
    const p = this.player, r = this.range, d = p.weapon.def;
    const pel = d.pellets || 1;
    const stk = (dist, zone) => Math.ceil(100 / (damageAt(d, dist) * d.mult[zone] * pel));
    const ttk = (n) => Math.round((n - 1) * (60 / d.rpm) * 1000);
    const cols = [10, 25, 50];
    const row = (label, f) => `<tr><td>${label}</td>${cols.map((c) => `<td class="num">${f(c)}</td>`).join('')}</tr>`;
    const acc = p.stats.shots ? Math.round(p.stats.hits / p.stats.shots * 100) : 0;
    const key = (k) => `<span class="key">${k}</span>`;
    return `<div class="kicker">Firing range</div>
      <div class="rp-w">${esc(d.name)} <span class="muted">${esc(d.classLabel)}</span></div>
      <table class="sb rp-t"><thead><tr><th></th>${cols.map((c) => `<th class="num">${c} m</th>`).join('')}</tr></thead><tbody>
        ${row('Damage / shot', (c) => Math.round(damageAt(d, c) * pel))}
        ${row('Shots to kill', (c) => stk(c, 'torso'))}
        ${row('Headshots', (c) => stk(c, 'head'))}
        ${row('TTK (ms)', (c) => ttk(stk(c, 'torso')))}
      </tbody></table>
      <div class="rp-line">Last hit <b>${r.last ? `${Math.round(r.last.dmg)} · ${r.last.zone.toUpperCase()} · ${r.last.dist.toFixed(1)} m` : '—'}</b></div>
      <div class="rp-line">Last elimination <b>${r.lastKill ? `${r.lastKill.shots} shots · ${r.lastKill.ms} ms · ${r.lastKill.dist.toFixed(0)} m` : '—'}</b></div>
      <div class="rp-line">Accuracy <b>${p.stats.hits}/${p.stats.shots} (${acc}%)</b></div>
      <div class="rp-keys">${key('T')} next weapon · ${key('1')}/${key('2')} swap · ${key('Y')} infinite ammo: <b>${r.infinite ? 'on' : 'off'}</b> · ${key('H')} moving targets: <b>${r.moving ? 'on' : 'off'}</b> · ${key('U')} reset · ${key('Esc')} menu</div>`;
  }

  scoreboardHtml() {
    const m = this.match;
    const groups = m.scoreboard();
    const [fc, ec] = this.app.settings.teamColors();
    const gun = m.mode.id === 'gun';
    const name = (r) => `${r.c.isBot ? '<span class="bot-tag">BOT</span>' : `<img class="sb-emblem" src="${emblemArt(this.cosm.emblem.id, 32)}" alt="">`}${esc(r.c.name)}`;
    const tbl = (rows, head) => `${head}
      <table class="sb"><thead><tr><th>Player</th>${gun ? '<th class="num">Level</th>' : ''}<th class="num">Score</th><th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">Streak</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.c === this.player ? 'me' : ''}" style="${r.c.alive ? '' : 'opacity:0.55'}"><td>${name(r)}</td>${gun ? `<td class="num">${Math.min(r.level + 1, m.ladder.length)}/${m.ladder.length}</td>` : ''}<td class="num">${r.score}</td><td class="num">${r.kills}</td><td class="num">${r.deaths}</td><td class="num">${r.assists}</td><td class="num">${r.streak}</td></tr>`).join('')}
      </tbody></table>`;
    const t = Math.max(0, Math.ceil(m.timeLeft));
    const header = `<div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="kicker">${esc(MODES[m.settings.mode].name)} · ${esc(this.map.def.name)}</span><span class="muted small">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} ${m.mode.rounds ? 'left in round' : 'remaining'} · ${esc(this.limitText().toLowerCase())}</span></div>`;
    if (groups.length === 1) return header + tbl(groups[0], '');
    const th = (team, col) => `<div class="team-head" style="color:${col}"><span>${esc(TEAMS[team].name)}</span><span class="score">${m.teamScores[team]}</span></div>`;
    return `${header}${tbl(groups[0], th(0, fc))}<div style="height:10px"></div>${tbl(groups[1], th(1, ec))}`;
  }

  buildResult() {
    const m = this.match, p = this.player;
    const outcome = m.winner === -1 ? 'draw' : m.winner === p.team ? 'win' : 'loss';
    const groups = m.scoreboard();
    const row = (r) => ({ name: r.c.name, bot: r.c.isBot, me: r.c === p, score: r.score, kills: r.kills, deaths: r.deaths, assists: r.assists, level: r.level, acc: r.shots ? Math.round(r.hits / r.shots * 100) + '%' : '—' });
    const summary = { ...this.summary, weaponsUsed: [...this.summary.weaponsUsed] };
    const rewards = this.app.profile.recordMatch(this.id, outcome, p.stats, m.time, summary);
    return {
      outcome, reason: m.endReason, scores: this.hudScores(), mode: m.settings.mode,
      rows: groups.map((g) => g.map(row)), ffa: this.ffa, placing: this.ffa ? groups[0].findIndex((r) => r.c === p) + 1 : 0, ladder: m.ladder?.length || 0, me: { ...p.stats }, medals: [...this.medals.values()], recorded: !!rewards, rewards,
    };
  }

  // ---- test hooks (used by the headless browser harness) ----
  /** Run the simulation forward without rendering. */
  debugAdvance(seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n && this.match.state !== 'ended'; i++) {
      const p = this.player;
      if (!p.alive && this.match.state === 'live' && p.respawnT < -1 && this.match.canRespawn(p)) this.match.respawn(p);
      const wasAlive = p.alive;
      this.match.tick(1 / 60);
      if (wasAlive && !p.alive) this.onPlayerDeath();
      this.afterTick(1 / 60);
    }
  }

  /** Let a bot brain drive the local player (exercise player code paths in tests). */
  debugAutopilot(on, BotBrain) {
    const p = this.player;
    if (on) { p.brain = new BotBrain(p, this.match); p.brain.onSpawn(); } else p.brain = null;
  }

  setPaused(on) {
    this.paused = on;
    this.app.audio.ambience(!on);
  }

  dispose() {
    for (const v of this.views.values()) this.app.engine.scene.remove(v.root);
    this.views.clear();
    this.hud.destroy();
    this.objView?.dispose();
    this.depView?.dispose();
    this.unsubSettings();
    this.app.audio.ambience(false);
    this.vm.visible = false;
    this.app.engine.setZoom(1);
  }
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
