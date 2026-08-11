/**
 * Match runtime.
 *
 * Owns the local player, the remote player representations, and the glue
 * between the network layer, the world, the effects and the audio engine.
 * The local character is simulated locally for responsiveness and reconciled
 * against the server's authoritative state (see shared/protocol.js).
 */

import * as THREE from 'three';
import {
  ROLES, HEALTH_STATE, ABILITIES, FEAR, HEALTH, STAMINA, MOVE, OBJECTIVES, clamp,
} from '../../../shared/constants.js';
import { ACT, EV } from '../../../shared/protocol.js';
import { getSurvivor, getCenobite } from '../../../shared/characters.js';
import { buildMap, zoneAt, FLOOR_Y, groundAt } from '../../../shared/mapdata.js';
import { Labyrinth } from '../world/labyrinth.js';
import { Character, Animator } from '../entities/character.js';
import { CharacterController } from '../entities/controller.js';
import { Effects } from './effects.js';
import { buildBoxMesh } from './lament.js';
import { settings } from '../core/settings.js';

const PHASE_TEXT = {
  seals: { title: 'BREAK THE SEALS', hint: 'Find the ritual seals bound into the walls and break them.' },
  relics: { title: 'THE OFFERING', hint: 'Carry ritual relics to the altar in the Puzzle Chamber.' },
  pieces: { title: 'THE CONFIGURATION', hint: 'Recover the fragments of the box and bring them to the altar.' },
  box: { title: 'SOLVE THE BOX', hint: 'Someone has to open it. Align every segment.' },
  escape: { title: 'THE GATE', hint: 'The Gate is unbound. Charge it and get out.' },
};

export class Game {
  constructor({ engine, textures, input, audio, ui, net }) {
    this.engine = engine;
    this.tex = textures;
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.net = net;

    this.map = null;
    this.world = null;
    this.effects = null;
    this.running = false;
    this.localId = null;
    this.role = ROLES.SURVIVOR;
    this.isCenobite = false;
    this.remotes = new Map();
    this.objectives = null;
    this.clock = OBJECTIVES.MATCH_DURATION;
    this.serverState = null;
    this.myState = null;
    this.hurt = 0;
    this.fearVisual = 0;
    this.interactTarget = null;
    this.channel = null;
    this.boxOpen = false;
    this.firstPerson = false;
    this.noclip = false;
    this.toasts = [];
    this.time = 0;
    this.lastFootstepSurface = 'stone';
    this._fwd = new THREE.Vector3();
    this._camFwd = new THREE.Vector3();
    this._camUp = new THREE.Vector3(0, 1, 0);
  }

  // ------------------------------------------------------------- lifecycle

  /** Build (or rebuild) the world for a match seed. Safe to call repeatedly. */
  buildWorld(seed) {
    if (this.world && this.worldSeed === seed) return;
    if (this.world) this.world.dispose();
    if (this.effects) this.effects.dispose();
    this.map = buildMap(seed);
    this.world = new Labyrinth(this.engine, this.tex, this.map);
    this.effects = new Effects(this.engine, this.tex, this.engine.quality);
    this.worldSeed = seed;

    // the physical box on the altar
    const built = buildBoxMesh(0.55);
    this.altarBox = built.group;
    this.altarBoxParts = built;
    this.altarBox.position.set(this.map.altar.x, this.map.altar.y + 1.75, this.map.altar.z);
    this.altarBox.visible = false;
    this.engine.scene.add(this.altarBox);
  }

  start(payload) {
    this.buildWorld(payload.seed);
    this.localId = this.net.id;
    this.clock = payload.clock;
    this.objectives = payload.objectives;
    this.matchPayload = payload;
    this.time = 0;
    this.toasts = [];
    this.effects.clearBlood();

    const me = payload.players.find((p) => p.id === this.localId);
    this.role = me ? me.role : ROLES.SPECTATOR;
    this.isCenobite = this.role === ROLES.CENOBITE;

    // --- local character ---
    if (this.localCharacter) {
      this.engine.scene.remove(this.localCharacter.group);
      this.localCharacter.dispose();
    }
    const def = this.isCenobite ? getCenobite(me.characterId) : getSurvivor(me ? me.characterId : null);
    this.charDef = def;
    this.localCharacter = new Character({
      build: def.build, role: this.role, name: me ? me.name : '', quality: this.engine.quality,
    });
    this.engine.scene.add(this.localCharacter.group);
    this.animator = new Animator(this.localCharacter);
    this.animator.onFootstep = (state, speed) => this.onFootstep(state, speed);
    if (!this.isCenobite) this.localCharacter.attachFlashlight();

    this.controller = new CharacterController(this.map, this.localCharacter, { isCenobite: this.isCenobite });
    if (me) this.controller.spawn(me.x, me.y, me.z, me.floor, me.yaw);

    // --- remote characters ---
    for (const [, r] of this.remotes) {
      this.engine.scene.remove(r.character.group);
      r.character.dispose();
    }
    this.remotes.clear();
    for (const p of payload.players) {
      if (p.id === this.localId) continue;
      this.addRemote(p);
    }

    this.doorStates = new Map();
    for (const d of this.map.doors) this.doorStates.set(d.id, { open: false, locked: !!d.locked });

    this.world.syncQuestItems(this.objectives);
    this.running = true;
    this.audio.startMusic();
    this.input.enabled = true;
    this.input.requestLock();
    this.ui.showToast(this.isCenobite ? 'You are the Hell Priest.' : 'Explore. Do not be alone.', 'bad', 5);
  }

  addRemote(p) {
    const isCeno = p.role === ROLES.CENOBITE;
    const def = isCeno ? getCenobite(p.characterId) : getSurvivor(p.characterId);
    const character = new Character({
      build: def.build, role: p.role, name: p.name, quality: this.engine.quality,
    });
    character.group.position.set(p.x, p.y, p.z);
    this.engine.scene.add(character.group);
    if (!isCeno) character.attachFlashlight();
    const animator = new Animator(character);
    animator.onFootstep = (state, speed) => {
      this.audio.play('footstep', {
        pos: character.group.position, volume: 0.85, run: state === 'run',
        surface: this.surfaceUnder(character.group.position, p.floor || 0),
      });
    };
    this.remotes.set(p.id, {
      id: p.id, name: p.name, role: p.role, isCenobite: isCeno,
      character, animator, floor: p.floor, target: new THREE.Vector3(p.x, p.y, p.z),
      lastAnim: 'idle', revealed: false, def,
    });
  }

  stop() {
    this.running = false;
    this.audio.stopMusic();
    this.input.releaseLock();
    this.input.enabled = false;
    if (this.boxOpen) this.closeBox();
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    if (!this.running || !this.world) return;
    this.time += dt;

    const snap = this.net.latest();
    if (snap) {
      this.serverState = snap;
      this.clock = snap.clock;
      this.myState = this.net.indexPlayers(snap).get(this.localId) || null;
      this.syncDoors(snap.doors);
      this.effects.syncTraps(snap.traps, this.controller.floor, this.isCenobite);
      this.effects.syncGateways(snap.gateways, this.controller.floor);
      this.effects.syncWards(snap.wards, this.controller.floor);
      for (const c of snap.chains) this.effects.updateChain(c.e, c.x, c.y, c.z);
      if (snap.lightsOut && this.world.lightsOut <= 0) this.world.triggerLightsOut(4);
    }

    this.updateLocal(dt);
    this.updateRemotes(dt);
    this.effects.update(dt, this.engine.camera);
    this.world.update(dt, this.controller.pos, this.controller.floor);
    this.updateAltarBox(dt);
    this.updateAudio(dt);
    this.updatePost(dt);
    this.updateToasts(dt);
  }

  updateLocal(dt) {
    const c = this.controller;
    const st = this.myState;
    const downed = st ? st.hs === HEALTH_STATE.DOWNED : false;
    const dead = st ? st.hs === HEALTH_STATE.DEAD || st.hs === HEALTH_STATE.ESCAPED : false;
    const hiding = st ? !!st.hd : false;
    const rooted = st ? !!st.rt || !!st.sn : false;

    // ------ input ------
    const canPlay = !this.boxOpen && !this.ui.modalOpen && this.input.locked;
    const move = canPlay && !dead ? this.input.move() : { x: 0, y: 0, magnitude: 0 };
    const look = canPlay ? this.input.look() : { x: 0, y: 0 };

    if (canPlay) {
      c.sprintHeld = settings.get('controls.toggleSprint', false)
        ? (this.input.pressed('sprint') ? !(c._sprintToggle = !c._sprintToggle) : c._sprintToggle)
        : this.input.down('sprint') || this.input.pad('sprint');

      if (this.input.pressed('crouch') || this.input.pad('crouch')) {
        if (settings.get('controls.toggleCrouch', true)) c.crouching = !c.crouching;
      }
      if (!settings.get('controls.toggleCrouch', true)) c.crouching = this.input.down('crouch');

      this.handleActions();
    }

    // ------ movement ------
    c.update(dt, move, look, {
      doors: this.noclip ? null : this.doorStates,
      downed,
      injured: st ? st.hs === HEALTH_STATE.INJURED : false,
      canMove: !dead && !hiding && !rooted,
      speedMult: st && st.pa ? 1.2 : 1,
    });
    if (this.noclip) {
      // free-fly for debugging
      const f = this.input.down('sprint') ? 26 : 10;
      const yaw = c.yaw;
      const m = this.input.move();
      c.pos.x += (-Math.sin(yaw) * -m.y + Math.cos(yaw) * m.x) * f * dt;
      c.pos.z += (-Math.cos(yaw) * -m.y - Math.sin(yaw) * m.x) * f * dt;
      if (this.input.rawDown('KeyR')) c.pos.y += f * dt;
      if (this.input.rawDown('KeyQ')) c.pos.y -= f * dt;
      c.character.group.position.copy(c.pos);
    }

    // ------ server reconciliation ------
    if (st) {
      const dx = st.x - c.pos.x;
      const dz = st.z - c.pos.z;
      const err = Math.hypot(dx, dz);
      // hard snap on a big divergence (teleport, chain drag, correction)
      if (err > 6) {
        c.warp(st.x, st.y, st.z, st.f);
      } else if (err > 0.35) {
        // soft pull, invisible to the player
        c.pos.x += dx * Math.min(1, dt * 3.2);
        c.pos.z += dz * Math.min(1, dt * 3.2);
      }
      this.localCharacter.setInjured(st.hs === HEALTH_STATE.INJURED ? 1 : st.hs === HEALTH_STATE.DOWNED ? 1 : 0);
      if (!this.isCenobite) {
        this.localCharacter.setFlashlight(!!st.fl, 60);
        this.localCharacter.setCarrying(st.ca);
      }
      this.localCharacter.setVisible(!st.hd && st.hs !== HEALTH_STATE.ESCAPED);
    }

    // ------ animation ------
    let animState = c.animState;
    if (st) {
      if (st.hs === HEALTH_STATE.DEAD) animState = 'dead';
      else if (st.hs === HEALTH_STATE.DOWNED) animState = c.speedFrac > 0.05 ? 'crawl' : 'downed';
      else if (st.hd) animState = 'hide';
      else if (this.boxOpen) animState = 'box';
      else if (st.it) animState = 'interact';
    }
    this.animator.update(dt, {
      state: animState,
      speedFrac: c.speedFrac,
      crouch: c.crouching,
      injured: st && st.hs === HEALTH_STATE.INJURED ? 1 : 0,
      lookPitch: c.pitch,
      fear: st ? st.fe / FEAR.MAX : 0,
    });

    // ------ camera ------
    c.updateCamera(this.engine.camera, dt, {
      firstPerson: this.firstPerson,
      distanceMult: st && st.hs === HEALTH_STATE.DOWNED ? 1.25 : 1,
    });
    if (this.firstPerson) this.localCharacter.setVisible(false);

    // ------ interaction targeting ------
    this._fwd.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    this.interactTarget = this.world.findInteractable(c.pos, c.floor, this._fwd);
    this.vaultTarget = this.world.findVault(c.pos, c.floor, this._fwd);
    // teammates are interactable too
    if (!this.isCenobite) {
      for (const [, r] of this.remotes) {
        if (r.isCenobite || r.floor !== c.floor) continue;
        const s = this.serverState ? this.net.indexPlayers(this.serverState).get(r.id) : null;
        if (!s) continue;
        if (s.hs !== HEALTH_STATE.DOWNED && s.hs !== HEALTH_STATE.INJURED) continue;
        const d = r.character.group.position.distanceTo(c.pos);
        if (d < 2.4 && (!this.interactTarget || d < 2)) {
          this.interactTarget = {
            id: r.id, kind: s.hs === HEALTH_STATE.DOWNED ? 'revive' : 'heal',
            x: r.character.group.position.x, y: c.pos.y, z: r.character.group.position.z,
            floor: r.floor, radius: 2.4,
          };
        }
      }
    }

    // ------ network report ------
    this.net.sendInput({
      x: c.pos.x, y: c.pos.y, z: c.pos.z, floor: c.floor,
      yaw: c.yaw, pitch: c.pitch, anim: animState,
      speedFrac: c.speedFrac, crouching: c.crouching, sprinting: c.sprinting,
    });
  }

  handleActions() {
    const inp = this.input;
    const st = this.myState;

    // --- interact (hold) ---
    const wantInteract = inp.down('interact') || inp.pad('interact');
    if (wantInteract && !this._interacting) {
      if (this.interactTarget) {
        this._interacting = true;
        this.net.action(ACT.INTERACT_START, { target: this.interactTarget.id });
        if (this.interactTarget.kind === 'container') this.audio.play('search', { pos: this.controller.pos });
      } else if (st && st.hd) {
        this.net.action(ACT.UNHIDE);
      }
    } else if (!wantInteract && this._interacting) {
      this._interacting = false;
      this.net.action(ACT.INTERACT_CANCEL);
    }

    // --- vault ---
    if ((inp.pressed('vault') || inp.pad('vault')) && this.vaultTarget) {
      this.net.action(ACT.VAULT, { vault: this.vaultTarget.id });
      this.animator.play('vault', 0.62);
      this.controller.locked = 0.45;
      // carry the player over the obstacle locally so it feels instant
      const v = this.vaultTarget;
      const dir = new THREE.Vector3(v.x - this.controller.pos.x, 0, v.z - this.controller.pos.z).normalize();
      this.controller.pos.x = v.x + dir.x * 1.9;
      this.controller.pos.z = v.z + dir.z * 1.9;
      this.audio.play('vault', { pos: this.controller.pos });
    }

    // --- flashlight ---
    if ((inp.pressed('flashlight') || inp.pad('flashlight')) && !this.isCenobite) {
      this.net.action(ACT.FLASHLIGHT);
    }

    if (this.isCenobite) {
      // --- attack ---
      if (inp.pressed('attack') || inp.pad('attack')) {
        this.net.action(ACT.ATTACK);
        this.animator.play('attack', 0.75);
        this.audio.play('swing', { pos: this.controller.pos });
      }
      // --- abilities ---
      const list = [
        ABILITIES.CHAIN_SUMMON, ABILITIES.CHAIN_TRAP, ABILITIES.GATEWAY,
        ABILITIES.PAIN_SENSE, ABILITIES.LAMENT_TELEPORT,
      ];
      for (let i = 0; i < list.length; i++) {
        if (!inp.rawPressed('Digit' + (i + 1))) continue;
        const a = list[i];
        const payload = { ability: a.id, yaw: this.controller.yaw, pitch: this.controller.pitch };
        if (a.id === ABILITIES.GATEWAY.id) {
          const t = this.aimPoint(ABILITIES.GATEWAY.range);
          payload.x = t.x;
          payload.z = t.z;
          payload.floor = this.controller.floor;
        }
        this.net.action(ACT.ABILITY, payload);
        this.animator.play('cast', 0.8);
      }
      // --- execute ---
      if (inp.rawPressed('KeyF')) this.net.action(ACT.EXECUTE);
      // --- step through your own gateway ---
      if (inp.rawPressed('KeyR')) this.net.action(ACT.GATEWAY_ENTER);
    } else {
      // --- survivor active perk ---
      if (inp.rawPressed('KeyQ')) this.net.action(ACT.ACTIVE_PERK);
      // --- items ---
      if (inp.rawPressed('Digit1')) this.net.action(ACT.USE_ITEM, { item: 'medkit' });
      if (inp.pressed('drop')) this.net.action(ACT.DROP);
    }
  }

  /** Where the player is looking, clamped to walkable ground. */
  aimPoint(maxDist) {
    const c = this.controller;
    const dirX = -Math.sin(c.yaw);
    const dirZ = -Math.cos(c.yaw);
    let best = { x: c.pos.x, z: c.pos.z };
    for (let d = 2; d <= maxDist; d += 1.5) {
      const x = c.pos.x + dirX * d;
      const z = c.pos.z + dirZ * d;
      const g = groundAt(this.map, c.floor, x, z);
      if (zoneAt(this.map, c.floor, x, z).id === 0) break;
      best = { x, z, y: g.y };
    }
    return best;
  }

  updateRemotes(dt) {
    const interp = this.net.interpolated();
    if (!interp) return;
    const myFloor = this.controller.floor;

    for (const [id, r] of this.remotes) {
      const s = interp.players.get(id);
      if (!s) {
        r.character.setVisible(false);
        continue;
      }
      r.floor = s.f;
      const g = r.character.group;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.r;

      const hidden = !!s.hd || s.hs === HEALTH_STATE.ESCAPED;
      r.character.setVisible(!hidden);

      let animState = s.a || 'idle';
      if (s.hs === HEALTH_STATE.DEAD) animState = 'dead';
      else if (s.hs === HEALTH_STATE.DOWNED) animState = s.sf > 0.05 ? 'crawl' : 'downed';

      r.animator.update(dt, {
        state: animState,
        speedFrac: s.sf || 0,
        crouch: !!s.c,
        injured: s.hs === HEALTH_STATE.INJURED ? 1 : 0,
        lookPitch: s.p || 0,
        fear: (s.fe || 0) / FEAR.MAX,
      });

      if (!r.isCenobite) {
        r.character.setFlashlight(!!s.fl, 55);
        r.character.setCarrying(s.ca);
        r.character.setInjured(s.hs === HEALTH_STATE.INJURED || s.hs === HEALTH_STATE.DOWNED ? 1 : 0);
      }

      // Pain Sense / Presence outlines: revealed survivors glow for the Cenobite
      const shouldGlow = this.isCenobite && !r.isCenobite && s.rv;
      if (shouldGlow !== r.revealed) {
        r.revealed = shouldGlow;
        r.character.group.traverse((o) => {
          if (o.isMesh && o.material && o.material.emissive) {
            o.material.emissive.setHex(shouldGlow ? 0x8a1010 : 0x000000);
            o.material.emissiveIntensity = shouldGlow ? 1.4 : 1;
          }
        });
      }
    }
  }

  updateAltarBox(dt) {
    if (!this.altarBox || !this.objectives) return;
    const o = this.objectives;
    this.altarBox.visible = !!o.box.assembled;
    if (!o.box.assembled) return;
    this.altarBox.rotation.y += dt * 0.35;
    this.altarBox.position.y = this.map.altar.y + 1.75 + Math.sin(this.time * 1.4) * 0.07;
    const heat = o.box.solved ? 1 : o.box.heat || 0;
    this.altarBoxParts.glowMat.opacity = heat * 0.55;
    this.altarBoxParts.light.intensity = heat * 30;
    this.world.setAltarHeat(heat);
    for (let i = 0; i < this.altarBoxParts.segments.length; i++) {
      const target = ((o.box.config[i] || 0) / 6) * Math.PI * 2;
      const s = this.altarBoxParts.segments[i];
      let diff = target - s.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.rotation.y += diff * Math.min(1, dt * 8);
    }
  }

  updateAudio(dt) {
    const cam = this.engine.camera;
    cam.getWorldDirection(this._camFwd);
    this.audio.setListener(cam.position, this._camFwd, this._camUp);

    const st = this.myState;
    const fear = st ? st.fe / FEAR.MAX : 0;
    const nearCeno = this.nearestCenobiteDistance();
    const chase = nearCeno < 26 ? 1 - nearCeno / 26 : 0;
    const tension = Math.max(fear * 0.75, chase);
    this.audio.setTension(tension);
    this.audio.setHeartbeat(this.isCenobite ? 0 : Math.max(fear, chase * 0.8));
    const exertion = this.controller.sprinting ? 0.7 : 0;
    this.audio.setBreathing(this.isCenobite ? 0 : Math.max(fear * 0.8, exertion, st && st.hs === HEALTH_STATE.INJURED ? 0.5 : 0));
    this.audio.setMuffle(st && st.hd ? 0.75 : this.world.lightsOut > 0 ? 0.25 : 0);
  }

  nearestCenobiteDistance() {
    let best = Infinity;
    for (const [, r] of this.remotes) {
      if (!r.isCenobite) continue;
      if (r.floor !== this.controller.floor) continue;
      best = Math.min(best, r.character.group.position.distanceTo(this.controller.pos));
    }
    return best;
  }

  updatePost(dt) {
    const st = this.myState;
    const fearRaw = st ? st.fe / FEAR.MAX : 0;
    const scale = settings.get('accessibility.fearVisuals', 1);
    const reduce = settings.get('accessibility.reduceShake', false);
    this.fearVisual += (fearRaw * scale - this.fearVisual) * Math.min(1, dt * 1.2);
    this.engine.setFear(this.isCenobite ? 0 : this.fearVisual);
    this.hurt = Math.max(0, this.hurt - dt * 1.4);
    const lowHealth = st && st.h < HEALTH.INJURED_AT ? (1 - st.h / HEALTH.INJURED_AT) * 0.35 : 0;
    this.engine.setHurt(Math.max(this.hurt, lowHealth));
    if (!reduce && !this.isCenobite && this.fearVisual > 0.55) {
      this.controller.addShake(dt * (this.fearVisual - 0.55) * 0.55);
    }
    this.engine.setTint(this.isCenobite ? 0x9a6a62 : 0x8e7f74);
  }

  onFootstep(state, speed) {
    const st = this.myState;
    if (st && (st.hd || st.hs === HEALTH_STATE.DEAD)) return;
    this.audio.play('footstep', {
      pos: null,
      volume: this.controller.crouching ? 0.28 : state === 'run' ? 1 : 0.6,
      run: state === 'run',
      surface: this.surfaceUnder(this.controller.pos, this.controller.floor),
    });
  }

  surfaceUnder(pos, floor) {
    const z = zoneAt(this.map, floor, pos.x, pos.z);
    if (z.mat === 'wood') return 'wood';
    if (z.mat === 'tile') return 'tile';
    return 'stone';
  }

  syncDoors(list) {
    if (!list) return;
    for (const d of list) {
      const st = this.doorStates.get(d.i);
      if (!st) continue;
      const open = !!d.o;
      if (st.open !== open) {
        st.open = open;
        this.world.setDoor(d.i, open);
      }
      st.locked = !!d.l;
    }
  }

  // ---------------------------------------------------------------- events

  onEvent(e) {
    const world = this.world;
    if (!world) return;
    const at = { x: e.x, y: e.y || 0, z: e.z };
    const mine = e.id === this.localId || e.by === this.localId;

    switch (e.type) {
      case EV.CHAIN_SPAWN:
        this.effects.spawnChain(e);
        this.audio.play('chain_launch', { pos: at });
        break;
      case EV.CHAIN_END:
        this.effects.endChain(e.eid);
        break;
      case EV.CHAIN_HIT:
        this.effects.endChain(e.eid);
        this.effects.spawnBlood(e.x, e.y + 1.1, e.z, 20);
        this.audio.play('hit', { pos: at });
        break;
      case EV.TRAP_PLACED:
        this.audio.play('chain', { pos: at, volume: 0.6 });
        break;
      case EV.TRAP_TRIGGERED:
        this.effects.spawnBlood(e.x, e.y + 0.8, e.z, 16);
        this.audio.play('chain', { pos: at, big: true });
        if (e.target === this.localId) this.onHurt(0.8, 'A trap.');
        break;
      case EV.MELEE_SWING:
        if (!mine) this.audio.play('swing', { pos: at });
        break;
      case EV.DAMAGE: {
        this.effects.spawnBlood(e.x, e.y + 1.2, e.z, 22);
        this.audio.play('hit', { pos: at });
        if (e.id === this.localId) {
          this.onHurt(1, null);
          this.audio.play('grunt', { pos: null });
          this.animator.play('hit', 0.5);
        } else {
          const r = this.remotes.get(e.id);
          if (r) r.animator.play('hit', 0.5);
        }
        break;
      }
      case EV.DOWNED:
        this.effects.spawnBlood(e.x, e.y + 0.8, e.z, 34);
        this.audio.play('scream', { pos: at });
        this.ui.showToast(`${this.nameOf(e.id)} is down.`, 'bad');
        if (e.id === this.localId) this.onHurt(1.4, 'You are down.');
        break;
      case EV.DEATH:
        this.audio.play('scream', { pos: at, volume: 1.2 });
        this.audio.play('stinger', {});
        this.effects.spawnBlood(e.x, e.y + 0.9, e.z, 40);
        this.ui.showToast(`${this.nameOf(e.id)} is gone.`, 'bad', 4);
        break;
      case EV.EXECUTION_START: {
        this.audio.play('chain', { pos: at, big: true });
        const r = this.remotes.get(e.by);
        if (r) r.animator.play('execute', e.duration);
        else if (e.by === this.localId) this.animator.play('execute', e.duration);
        if (e.victim === this.localId || e.by === this.localId) this.controller.addShake(0.5);
        break;
      }
      case EV.EXECUTION_END:
        if (e.completed) this.effects.spawnBlood(this.controller.pos.x, this.controller.pos.y + 1, this.controller.pos.z, 10);
        break;
      case EV.REVIVED:
        this.ui.showToast(`${this.nameOf(e.id)} is back up.`, 'good');
        this.audio.play('pickup', {});
        break;
      case EV.HEALED:
        if (e.id === this.localId) this.ui.showToast('Patched up.', 'good');
        this.audio.play('pickup', {});
        break;
      case EV.ESCAPED:
        this.ui.showToast(`${this.nameOf(e.id)} escaped.`, 'good', 4);
        this.audio.play('box_solved', { volume: 0.6 });
        break;
      case EV.DOOR: {
        const st = this.doorStates.get(e.id);
        const door = this.map.doors.find((d) => d.id === e.id);
        if (st) st.open = e.open;
        world.setDoor(e.id, e.open);
        if (door) this.audio.play('door', { pos: { x: door.x, y: door.y + 1.5, z: door.z }, close: !e.open });
        break;
      }
      case EV.VAULT:
        if (!mine) this.audio.play('vault', { pos: at, volume: 0.7 });
        break;
      case EV.CONTAINER_SEARCHED:
        world.setContainerSearched(e.id);
        if (e.by === this.localId) {
          this.audio.play(e.item ? 'pickup' : 'search', {});
          this.ui.showToast(e.item ? `Found: ${e.item}` : 'Nothing useful.', e.item ? 'good' : '');
        }
        break;
      case EV.SEAL_BROKEN:
        world.setSealBroken(e.id);
        this.audio.play('seal_break', { pos: at });
        this.effects.spawnPuff(e.x, e.y + 1.5, e.z, 2.5, 0xff3a1a);
        this.ui.showToast(`A seal breaks. (${e.total}/${OBJECTIVES.SEALS_REQUIRED})`, 'good');
        break;
      case EV.ITEM_PICKUP:
        if (e.id === this.localId) {
          this.audio.play('pickup', {});
          this.ui.showToast(e.item === 'relic' ? 'Ritual relic taken. Get it to the altar.' : 'Configuration fragment taken.', 'good');
        }
        break;
      case EV.RELIC_DELIVERED:
        this.ui.showToast(`Relic offered. (${e.total}/${OBJECTIVES.RELIC_REQUIRED})`, 'good');
        this.audio.play('box_turn', {});
        break;
      case EV.PIECE_DELIVERED:
        this.ui.showToast(`Fragment set. (${e.total}/${OBJECTIVES.BOX_PIECES})`, 'good');
        this.audio.play('box_turn', {});
        break;
      case EV.BOX_ASSEMBLED:
        this.ui.showToast('The Lament Configuration is whole.', 'bad', 5);
        this.audio.play('box_open', { pos: at });
        break;
      case EV.BOX_INTERACT:
        if (e.by === this.localId) this.openBox();
        break;
      case EV.BOX_ROTATE:
        if (this.objectives) {
          this.objectives.box.config[e.segment] = e.value;
          this.objectives.box.heat = e.heat;
        }
        if (this.boxOpen) this.ui.updateBoxPuzzle(this.objectives.box, this.charDef);
        break;
      case EV.BOX_FAILED:
        if (e.by === this.localId) {
          this.onHurt(1.2, 'The box takes its due.');
          this.closeBox();
        }
        this.audio.play('stinger', {});
        break;
      case EV.BOX_SOLVED:
        this.audio.play('box_solved', {});
        this.ui.showToast('The box is open. The Gate is unbound.', 'good', 6);
        this.closeBox();
        world.setGateOpen(false);
        break;
      case EV.GATE_OPEN:
        world.setGateOpen(true);
        this.audio.play('portal', { pos: { x: this.map.gate.x, y: this.map.gate.y + 3, z: this.map.gate.z } });
        this.ui.showToast('THE GATE IS OPEN. RUN.', 'good', 6);
        break;
      case EV.GATEWAY_OPEN:
        this.audio.play('portal', { pos: { x: e.bx, y: e.by + 1.5, z: e.bz } });
        break;
      case EV.ABILITY_CAST:
        if (e.teleport) this.audio.play('portal', { pos: at });
        if (e.by === this.localId && e.blocked) this.ui.showToast('Warded. Not here.', 'bad');
        break;
      case EV.PAIN_SENSE:
        if (e.by === this.localId) this.ui.showToast(`${e.revealed.length} in pain.`, '');
        break;
      case EV.WARD_PLACED:
        this.audio.play('box_turn', { pos: at });
        if (e.by === this.localId) this.ui.showToast('Ward laid.', 'good');
        break;
      case EV.PERK_ACTIVE:
        if (e.id === this.localId) this.ui.showToast('Perk active.', 'good');
        break;
      case EV.HORROR:
        this.onHorror(e);
        break;
      case EV.LIGHTS:
        if (!e.on) {
          world.triggerLightsOut(e.duration || 9);
          this.audio.play('stinger', { volume: 0.6 });
          this.ui.showToast('The lights go out.', 'bad');
        }
        break;
      case EV.SOUND:
        this.audio.play(e.kind === 'box_open' ? 'box_open' : e.kind === 'portal' ? 'portal' : 'chain', { pos: at });
        break;
      case EV.PHASE:
        if (e.phase !== 'active') {
          const p = PHASE_TEXT[e.phase];
          if (p) this.ui.showToast(p.title + ' — ' + p.hint, '', 6);
        }
        break;
      case EV.OBJECTIVE_UPDATE:
        this.objectives = e;
        world.syncQuestItems(e);
        world.setGateOpen(!!e.gate.open);
        if (this.boxOpen) this.ui.updateBoxPuzzle(e.box, this.charDef);
        // the box view closes if we stop being the solver
        if (this.boxOpen && e.box.solver !== this.localId) this.closeBox();
        break;
    }
  }

  onHorror(e) {
    const dist = Math.hypot(e.x - this.controller.pos.x, e.z - this.controller.pos.z);
    if (e.floor !== this.controller.floor || dist > 46) {
      // still audible from far away
      if (e.type === 'distant_scream') this.audio.play('scream', { pos: { x: e.x, y: e.y, z: e.z }, distant: true });
      return;
    }
    this.effects.horror(e.type, e.x, e.y, e.z, this.engine.camera);
    switch (e.type) {
      case 'chains_stir':
        this.audio.play('chain', { pos: e, big: true });
        break;
      case 'door_slam':
        this.audio.play('door', { pos: e, close: true, volume: 1.2 });
        break;
      case 'distant_scream':
        this.audio.play('scream', { pos: e, distant: true });
        break;
      case 'whispers':
        this.audio.play('whisper', { pos: e });
        break;
      case 'apparition':
      case 'silhouette':
        this.audio.play('whisper', { pos: e, volume: 0.6 });
        if (!settings.get('accessibility.reduceShake', false)) this.controller.addShake(0.18);
        break;
      case 'blood_walls':
        this.audio.play('stinger', { volume: 0.5 });
        break;
      case 'corridor_shift':
        this.audio.play('thunder', { volume: 0.7 });
        this.controller.addShake(0.3);
        break;
      default:
        this.audio.play('whisper', { pos: e, volume: 0.5 });
    }
  }

  onHurt(strength, message) {
    this.hurt = Math.min(1.4, this.hurt + strength);
    if (!settings.get('accessibility.reduceShake', false)) this.controller.addShake(0.4 * strength);
    if (!settings.get('accessibility.reduceFlashing', false)) this.engine.flash(0.35 * strength);
    if (message) this.ui.showToast(message, 'bad');
  }

  nameOf(id) {
    if (id === this.localId) return 'You';
    const r = this.remotes.get(id);
    return r ? r.name : 'Someone';
  }

  // ------------------------------------------------------------- box view

  openBox() {
    if (this.boxOpen) return;
    this.boxOpen = true;
    this.input.releaseLock();
    this.ui.openBoxPuzzle(this.objectives ? this.objectives.box : null, this.charDef);
  }

  closeBox() {
    if (!this.boxOpen) return;
    this.boxOpen = false;
    this.ui.closeBoxPuzzle();
    setTimeout(() => {
      if (this.running && !this.ui.modalOpen) this.input.requestLock();
    }, 260);
  }

  // -------------------------------------------------------------- HUD data

  hudState() {
    const st = this.myState;
    const o = this.objectives;
    const phase = o ? PHASE_TEXT[o.phase] || PHASE_TEXT.seals : PHASE_TEXT.seals;
    let progress = '';
    if (o) {
      if (o.phase === 'seals') progress = `SEALS ${o.seals.done} / ${o.seals.need}`;
      else if (o.phase === 'relics') progress = `RELICS ${o.relics.done} / ${o.relics.need}`;
      else if (o.phase === 'pieces') progress = `FRAGMENTS ${o.pieces.done} / ${o.pieces.need}`;
      else if (o.phase === 'box') progress = o.box.solver ? 'SOMEONE IS TURNING IT' : 'THE BOX WAITS';
      else if (o.phase === 'escape') progress = o.gate.open ? 'THE GATE IS OPEN' : `GATE ${Math.round(o.gate.charge * 100)}%`;
    }

    const mates = [];
    for (const [id, r] of this.remotes) {
      if (r.isCenobite && !this.isCenobite) continue;
      const s = this.serverState ? this.net.indexPlayers(this.serverState).get(id) : null;
      mates.push({
        id, name: r.name, role: r.role,
        state: s ? s.hs : 'healthy',
        carrying: s ? s.ca : null,
        revealed: s ? !!s.rv : false,
      });
    }

    const abilities = this.isCenobite
      ? [ABILITIES.CHAIN_SUMMON, ABILITIES.CHAIN_TRAP, ABILITIES.GATEWAY, ABILITIES.PAIN_SENSE, ABILITIES.LAMENT_TELEPORT].map((a) => ({
          id: a.id, name: a.name, key: a.key,
          cd: st && st.cd ? st.cd[a.id] || 0 : 0,
          max: a.cooldown,
          ready: (!st || !st.cd || !(st.cd[a.id] > 0)) && (!a.powerCost || (st ? st.pw : 0) >= a.powerCost),
          locked: a.id === ABILITIES.LAMENT_TELEPORT.id && !(o && o.box.assembled && !o.box.solved),
        }))
      : [];

    return {
      role: this.role,
      isCenobite: this.isCenobite,
      health: st ? st.h : 100,
      healthState: st ? st.hs : 'healthy',
      stamina: st ? st.st : 100,
      fear: st ? st.fe : 0,
      power: st ? st.pw : 0,
      bleeding: st ? !!st.bl : false,
      hiding: st ? !!st.hd : false,
      downedTimer: st ? st.dt : 0,
      inventory: st ? st.inv || [] : [],
      carrying: st ? st.ca : null,
      flashlight: st ? { on: !!st.fl, battery: st.fb } : { on: false, battery: 0 },
      perkCooldown: st ? st.pc : 0,
      perk: this.charDef && this.charDef.perk ? this.charDef.perk : null,
      activePerk: this.charDef && this.charDef.active ? this.charDef.active : null,
      abilities,
      objective: { title: phase.title, hint: phase.hint, progress },
      clock: this.clock,
      zone: this.world && this.world.currentZone ? this.world.currentZone.name : '',
      mates,
      channel: st && st.it ? { type: st.it.t, progress: st.it.p } : null,
      prompt: this.buildPrompt(),
      ping: this.net.ping,
    };
  }

  buildPrompt() {
    const st = this.myState;
    if (st && st.hd) return { key: 'E', text: 'Leave cover' };
    if (st && st.hs === HEALTH_STATE.DOWNED) return null;
    if (this.vaultTarget) return { key: 'SPACE', text: 'Vault' };
    if (!this.interactTarget) return null;
    const t = this.interactTarget;
    const labels = {
      seal: 'Break the seal',
      container: 'Search',
      relic: 'Take the relic',
      piece: 'Take the fragment',
      altar: this.objectives && this.objectives.box.assembled && !this.objectives.box.solved
        ? 'Open the Lament Configuration'
        : 'Offer at the altar',
      gate: 'Charge the Gate',
      hide: 'Hide',
      revive: 'Pick them up',
      heal: 'Patch them up',
    };
    if (this.isCenobite && (t.kind === 'hide' || t.kind === 'container')) return null;
    return { key: 'E', text: labels[t.kind] || 'Interact' };
  }

  updateToasts(dt) {}

  // ---------------------------------------------------------------- debug

  debugInfo() {
    const c = this.controller;
    const st = this.myState;
    return {
      fps: Math.round(this.engine.fps),
      ping: this.net.ping,
      pos: `${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(1)}, ${c.pos.z.toFixed(1)}`,
      floor: c.floor,
      zone: this.world && this.world.currentZone ? this.world.currentZone.name : '?',
      role: this.role,
      health: st ? Math.round(st.h) : '-',
      healthState: st ? st.hs : '-',
      fear: st ? Math.round(st.fe) : '-',
      stamina: st ? Math.round(st.st) : '-',
      power: st ? Math.round(st.pw) : '-',
      players: this.remotes.size + 1,
      snapshots: this.net.snapshots.length,
      draws: this.engine.info.calls,
      tris: this.engine.info.triangles,
      phase: this.objectives ? this.objectives.phase : '-',
      noclip: this.noclip,
      connected: this.net.connected,
    };
  }
}
