// The match: entities, rules, perks, items, killer powers, scoring and cameras.
import * as THREE from 'three';
import { World, HALF } from '../world/builder.js';
import { buildSurvivor, buildSpecter, buildExe, poseSurvivor, poseKiller, setSpecterOpacity, buildViewmodel, drawExeFace, attachAura } from '../models/characters.js';
import { SURVIVOR_BY_ID, KILLER_BY_ID, ITEM_BY_ID, OFFERING_BY_ID, MAP_BY_ID, MAPS, outfitOf, CATEGORY_CAP } from '../data.js';
import { RNG, clamp, lerp, angleWrap, approachAngle, damp } from '../core/util.js';
import { scratchTexture, bloodTexture, rippleTexture, glowSpriteTexture } from '../world/textures.js';
import { SurvivorAI, KillerAI } from './ai.js';
import { buildWoodsman, buildWoodsmanViewmodel } from '../models/woodsman.js';

const WALK = 2.26, RUN = 4.0, CROUCH = 1.13, CRAWL = 0.7;
const GEN_TIME = 70, GENS_NEEDED = 5;
const HOOK_RATE = 1 / 110, BLEED_TIME = 150, ENDGAME = 120;

export class Survivor {
  constructor(m, idx, def, outfitId, o) {
    this.m = m; this.idx = idx; this.def = def; this.id = 's' + idx; this.isSurvivor = true;
    this.name = def.name;
    this.isPlayer = !!o.isPlayer;
    this.outfit = outfitOf(def, outfitId);
    this.rig = buildSurvivor(def, this.outfit);
    m.world.root.add(this.rig.root);
    this.pos = new THREE.Vector3(o.x, 0, o.z);
    this.yaw = Math.random() * 6.28;
    this.r = 0.36;
    this.state = 'healthy';
    this.hooks = 0; this.hookProg = 0; this.selfTries = 0; this.hook = null;
    this.bleed = 0; this.recover = 0; this.heal = 0; this.wiggle = 0;
    this.action = null; this.vault = null;
    this.crouch = false; this.speed = 0; this.moveDir = { x: 0, z: 0 };
    this.boostUntil = 0; this.boostMult = 1; this.hinderUntil = 0; this.hinderPending = false;
    this.protectUntil = 0; this.lastBreathUsed = false; this.adrenalReady = 0;
    this.revealUntil = 0; this.glitchUntil = 0; this.markedUntil = 0;
    this.perks = o.perks || [];
    this.item = null;
    if (o.item) {
      const it = ITEM_BY_ID[o.item.id];
      let max = it.charges;
      const ad = o.item.addons || [];
      if (ad.includes('heavy_battery')) max += 8;
      if (ad.includes('sterile_gauze') || ad.includes('socket_set')) max += 16;
      if (ad.includes('creased_corner')) max += 20;
      if (this.perks.includes('scavenger')) max *= 1.25;
      this.item = { id: it.id, charges: max, max, addons: ad };
    }
    this.flashOn = false; this.itemUse = false;
    this.score = { grit: 0, nerve: 0, kinship: 0, endurance: 0 };
    this.chased = false; this.chaseT = 0;
    this.intent = { mx: 0, mz: 0, run: false, crouch: false, interact: false, act: false, item: false, target: null, wiggle: 0 };
    this.scratchT = 0; this.bloodT = 0; this.stepT = 0;
    this.outcome = null;
    this.deathAnim = 0;
    this.ai = this.isPlayer ? null : new SurvivorAI(m, this, o.skill || 0.6);
    if (this.item && this.item.id === 'flashlight') {
      this.flash = new THREE.SpotLight(0xfff1d8, 0, 18, 0.32 * (this.item.addons.includes('wide_lens') ? 1.3 : 1), 0.5, 1.5);
      this.flash.position.set(0, 0, 0);
      this.rig.itemSocket.add(this.flash);
      this.flash.target.position.set(0, -1, 0.2);
      this.rig.itemSocket.add(this.flash.target);
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 }));
      this.rig.itemSocket.add(torch);
    }
  }
  has(p) { return this.perks.includes(p); }
  get alive() { return this.state !== 'dead' && this.state !== 'escaped'; }
  get free() { return this.state === 'healthy' || this.state === 'injured'; }
  addScore(cat, v) { this.score[cat] = Math.min(CATEGORY_CAP, this.score[cat] + v); }
}

export class Killer {
  constructor(m, def, outfitId, o) {
    this.m = m; this.def = def; this.id = 'k'; this.isKiller = true;
    this.name = def.name;
    this.isPlayer = !!o.isPlayer;
    this.outfit = outfitOf(def, outfitId);
    this.rig = def.id === 'specter' ? buildSpecter(this.outfit) : def.id === 'woodsman' ? buildWoodsman(this.outfit) : buildExe(this.outfit);
    m.world.root.add(this.rig.root);
    this.pos = new THREE.Vector3(o.x, 0, o.z);
    this.yaw = 0; this.pitch = 0;
    this.r = 0.45;
    this.state = 'normal'; this.stateT = 0; this.stateDur = 0; this.stateData = null;
    this.carrying = null;
    this.perks = o.perks || [];
    this.addons = o.addons || [];
    this.score = { savagery: 0, cunning: 0, pursuit: 0, ritual: 0 };
    this.intent = { mx: 0, mz: 0, attack: false, act: false, power: false, target: null, look: null };
    this.speed = 0;
    this.chaseTarget = null; this.chaseT = 0; this.bloodlust = 0;
    this.lungeBonusUntil = 0;
    this.terror = def.terror * (this.perks.includes('muffled_heart') ? 0.5 : 1);
    this.power = def.id === 'woodsman'
      ? { kind: 'chop', charge: 0, raising: false, chargeTime: 1.5 - (this.has('whetstone') ? 0.3 : 0), minCharge: 0.6 }
      : def.id === 'specter'
      ? { kind: 'veil', charge: 1, active: false, t: 0, dur: 4 + (this.has('ring_fragment') ? 0.5 : 0) + (this.has('waterlogged_diary') ? 1 : 0), recharge: 14 * (this.has('lake_silt') ? 0.9 : 1) * (this.has('torn_hem') ? 0.8 : 1) }
      : { kind: 'exe', cooldown: 0, maxCd: 18 * (this.has('burnt_capacitor') ? 0.85 : 1) * (this.has('infinite_loop') ? 0.65 : 1), channel: 1.5 - (this.has('cracked_glass') ? 0.3 : 0), target: null, selecting: false };
    this.ai = this.isPlayer ? null : new KillerAI(m, this, o.skill || 0.6);
  }
  has(p) { return this.perks.includes(p) || this.addons.includes(p); }
  addScore(cat, v) { this.score[cat] = Math.min(CATEGORY_CAP, this.score[cat] + v); }
  get phasing() { return this.power.kind === 'veil' && this.power.active; }
}

export class Match {
  constructor(ctx, setup) {
    this.ctx = ctx;
    this.setup = setup;
    this.audio = ctx.audio;
    this.time = 0;
    this.rng = new RNG(setup.seed);
    const offering = setup.offering ? OFFERING_BY_ID[setup.offering] : null;
    this.offering = offering;
    const mapDef = (offering && offering.map && MAP_BY_ID[offering.map]) || MAP_BY_ID[setup.mapId] || this.rng.pick(MAPS);
    this.mapDef = mapDef;
    const killerDef = KILLER_BY_ID[setup.killerId];
    const tvCount = killerDef.id === 'exe' ? 6 + (setup.role === 'killer' && setup.killerAddons.includes('corrupt_save') ? 2 : 0) : 0;
    const weather = offering && offering.weather ? offering.weather : mapDef.weather;
    this.scene = new THREE.Scene();
    this.world = new World(this.scene, mapDef, {
      seed: setup.seed, quality: setup.quality, tvCount, weather,
      fogMul: offering && offering.fog ? offering.fog : 1, bloodMoon: offering && offering.moon === 'blood',
      extraChests: offering && offering.chests ? offering.chests : 0, hatchNear: offering && offering.hatchNear,
    });
    this.sacrificeAt = offering && offering.hangman ? 2 : 3;
    this.moriAllowed = setup.role === 'killer' ? !!(offering && offering.mori) : !!setup.killerMori;
    // entities
    this.survivors = [];
    const sp = this.world.spawns.survivors;
    setup.survivors.forEach((s, i) => {
      const def = SURVIVOR_BY_ID[s.id];
      this.survivors.push(new Survivor(this, i, def, s.outfit, { isPlayer: s.isPlayer, perks: s.perks, item: s.item, x: sp[i][0], z: sp[i][1], skill: s.skill }));
    });
    const ks = this.world.spawns.killer;
    this.killer = new Killer(this, killerDef, setup.killerOutfit, { isPlayer: setup.role === 'killer', perks: setup.killerPerks, addons: setup.killerAddons, x: ks[0], z: ks[1], skill: setup.killerSkill });
    this.killer.yaw = Math.atan2(sp[0][0] - ks[0], sp[0][1] - ks[1]);
    this.player = setup.role === 'killer' ? this.killer : this.survivors.find((s) => s.isPlayer);
    this.cam = { yaw: this.player.yaw, pitch: -0.1, dist: 3.2 };
    if (this.player.isSurvivor) this.cam.yaw = Math.atan2(-sp[0][0], -sp[0][1]);
    else this.cam.yaw = this.killer.yaw;
    this.spectate = null;
    this.gensDone = 0;
    this.gatesPowered = false;
    this.endgameT = null;
    this.over = false; this.overT = 0;
    this.noises = [];
    this.events = [];
    this.skillCheck = null;
    this.flashT = 0;
    this.whisperT = 0;
    this.hitFlash = 0;
    this.blindFlash = 0;
    this.finalHourDone = false;
    // camera + viewmodel
    this.camera = new THREE.PerspectiveCamera(ctx.settings.fov || 80, ctx.aspect(), 0.05, 400);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    if (this.player.isKiller) {
      this.viewmodel = killerDef.id === 'woodsman' ? buildWoodsmanViewmodel(this.killer.outfit) : buildViewmodel(killerDef.id, this.killer.outfit);
      this.camera.add(this.viewmodel);
      this.killer.rig.root.visible = false;
    }
    this.decals = this.makeDecals();
    this.propAuras = new Map();
    // ambient light for the player's own visibility (very faint)
    this.playerLight = new THREE.PointLight(0x8a9ac8, this.player.isKiller ? 0.6 : 0.35, 9, 2);
    this.scene.add(this.playerLight);
    this.audio.ambience(mapDef.kit, weather !== 'clear');
    this.announce(`${mapDef.name}`, mapDef.region);
    if (this.moriAllowed && setup.role !== 'killer') this.announce(`${killerDef.name} burned an Ashen Rite`, 'Hooked survivors can be executed', 'bad');
  }

  /* ---------------- helpers ---------------- */

  announce(title, sub = '', kind = 'info') { this.events.push({ title, sub, kind, t: this.time }); }

  noise(x, z, loud = 1, type = 'noise') {
    this.noises.push({ x, z, t: this.time, loud, type });
    if (this.noises.length > 30) this.noises.shift();
  }

  dist(a, b) { return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); }

  aliveSurvivors() { return this.survivors.filter((s) => s.alive); }

  hearVol(x, z, range = 40) {
    const p = this.listener();
    return this.audio.falloff(Math.hypot(p.x - x, p.z - z), range);
  }

  listener() { return (this.spectate || this.player).pos; }

  sfx(name, x, z, range = 40) { this.audio.play(name, x === undefined ? 1 : this.hearVol(x, z, range)); }

  canSee(ax, az, bx, bz) { return this.world.nav.los(ax, az, bx, bz); }

  /* ---------------- decals: scratch marks, blood, ripples ---------------- */

  makeDecals() {
    const mk = (tex, color, n, size, blending = THREE.NormalBlending) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
      const geo = new THREE.PlaneGeometry(size[0], size[1]);
      geo.rotateX(-Math.PI / 2);
      const inst = new THREE.InstancedMesh(geo, mat, n);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const col = new Float32Array(n * 3);
      inst.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
      inst.count = 0;
      inst.frustumCulled = false;
      this.scene.add(inst);
      return { inst, items: [], n, color: new THREE.Color(color) };
    };
    const killerView = this.player.isKiller;
    return {
      scratch: mk(scratchTexture(), 0xb8381a, 260, [0.55, 0.24], THREE.AdditiveBlending),
      blood: mk(bloodTexture(), 0xffffff, 120, [0.5, 0.5]),
      ripple: mk(rippleTexture(), 0xa8d8ff, 60, [1.2, 1.2], THREE.AdditiveBlending),
      killerView,
    };
  }

  addDecal(kind, x, z, life) {
    const d = this.decals[kind];
    if (d.items.length >= d.n) d.items.shift();
    d.items.push({ x, z, t: this.time, life, rot: Math.random() * 6.28, s: 0.7 + Math.random() * 0.6 });
  }

  updateDecals() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const kv = this.player.isKiller;
    for (const key of ['scratch', 'blood', 'ripple']) {
      const d = this.decals[key];
      d.items = d.items.filter((it) => this.time - it.t < it.life);
      const show = key === 'blood' ? true : kv;
      d.inst.visible = show;
      if (!show) continue;
      let i = 0;
      for (const it of d.items) {
        const age = (this.time - it.t) / it.life;
        const sc = key === 'ripple' ? 0.3 + age * 1.6 : it.s;
        q.setFromAxisAngle(up, it.rot);
        m4.compose(p.set(it.x, 0.03 + i * 0.0002, it.z), q, s.set(sc, 1, sc));
        d.inst.setMatrixAt(i, m4);
        const a = key === 'blood' ? 1 - age * age : (1 - age) * (key === 'scratch' && this.killer.has('bloodhound') ? 1.6 : 1);
        d.inst.instanceColor.setXYZ(i, d.color.r * a, d.color.g * a, d.color.b * a);
        i++;
      }
      d.inst.count = i;
      d.inst.instanceMatrix.needsUpdate = true;
      d.inst.instanceColor.needsUpdate = true;
    }
  }

  /* ---------------- main update ---------------- */

  update(dt, input) {
    if (this.paused) return;
    this.time += dt;
    const k = this.killer;
    if (input) this.applyPlayerInput(dt, input);
    for (const s of this.survivors) if (s.ai && s.alive) s.ai.update(dt);
    if (k.ai) k.ai.update(dt);
    for (const s of this.survivors) this.updateSurvivor(s, dt);
    this.updateKiller(k, dt);
    this.separate();
    this.updateObjectives(dt);
    this.updateSkillCheck(dt);
    this.updateChase(dt);
    this.updateDecals();
    this.world.update(dt, this.camera.position, { thunder: () => this.audio.thunder() });
    this.updateVisuals(dt);
    this.updateCamera(dt, input);
    this.updateAudio(dt);
    if (!this.over && this.survivors.every((s) => !s.alive)) { this.over = true; this.overT = 0; }
    if (this.over) this.overT += dt;
  }

  /* ---------------- player input -> intent ---------------- */

  applyPlayerInput(dt, inp) {
    const c = this.cam;
    const sens = 0.0024 * (this.ctx.settings.sensitivity || 1);
    if (!this.spectate || this.player.isKiller) {
      c.yaw -= inp.lookX * sens;
      c.pitch = clamp(c.pitch - inp.lookY * sens * (this.ctx.settings.invertY ? -1 : 1), -1.25, 1.1);
    } else {
      c.yaw -= inp.lookX * sens;
      c.pitch = clamp(c.pitch - inp.lookY * sens, -1.0, 0.8);
    }
    const p = this.player;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    let mx = fx * inp.moveF + rx * inp.moveR, mz = fz * inp.moveF + rz * inp.moveR;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const it = p.intent;
    it.mx = mx; it.mz = mz;
    if (p.isSurvivor) {
      it.run = inp.run;
      if (inp.crouchPressed) p.crouch = !p.crouch;
      if (inp.run && ml > 0.1) p.crouch = false;
      it.interact = inp.interact;
      it.act = inp.actPressed;
      it.actHeld = inp.actHeld;
      it.item = inp.item;
      it.wiggle = inp.wiggle;
      if (this.skillCheck && inp.actPressed) { this.resolveSkillCheck(); it.act = false; }
      if (p.state === 'hooked' && inp.actPressed) p.struggleT = this.time;
      if (this.spectate && inp.attackPressed) this.cycleSpectate();
    } else {
      it.attack = inp.attack;
      it.attackPressed = inp.attackPressed;
      it.act = inp.actPressed || inp.interactPressed;
      it.power = inp.item;
      it.mori = inp.moriPressed;
      it.look = { yaw: c.yaw, pitch: c.pitch };
    }
  }

  cycleSpectate() {
    const list = this.survivors.filter((s) => s.alive);
    if (!list.length) return;
    const i = list.indexOf(this.spectate);
    this.spectate = list[(i + 1) % list.length];
  }

  /* ---------------- survivors ---------------- */

  survivorSpeed(s) {
    if (s.state === 'dying') return CRAWL;
    let v = s.crouch ? CROUCH * (s.has('shadow_walk') ? 1.3 : 1) : s.intent.run ? RUN : WALK;
    if (s.boostUntil > this.time) v *= s.boostMult;
    else if (s.hinderPending) { s.hinderPending = false; s.hinderUntil = this.time + 6; }
    if (s.hinderUntil > this.time) v *= 0.85;
    if ((s.flashOn || s.itemUse) && s.item && (s.item.id === 'flashlight' || s.item.id === 'map')) v = Math.min(v, WALK);
    return v;
  }

  updateSurvivor(s, dt) {
    const it = s.intent;
    if (!s.alive) {
      if (s.state === 'dead' && s.deathAnim < 1) {
        s.deathAnim += dt / 2.5;
        s.rig.root.position.y += dt * (s.diedOnHook ? 1.4 : -0.4);
        s.rig.root.scale.setScalar(Math.max(0.01, 1 - s.deathAnim));
        if (s.deathAnim >= 1) s.rig.root.visible = false;
      }
      return;
    }
    // status timers
    if (s.state === 'mori') { s.speed = 0; return; }
    if (s.state === 'dying') {
      s.bleed += (dt / BLEED_TIME) * (this.killer.has('splinter') ? 1.25 : 1);
      if (s.bleed >= 1) this.kill(s, 'bled out');
    }
    if (s.state === 'hooked') return this.updateHooked(s, dt);
    if (s.state === 'carried') return this.updateCarried(s, dt);
    // item use
    s.flashOn = false; s.itemUse = false;
    if (s.item && it.item && s.item.charges > 0 && s.free && !s.vault) {
      if (s.item.id === 'flashlight') { s.flashOn = true; s.item.charges -= dt; this.flashlightTick(s, dt); }
      else if (s.item.id === 'map') { s.itemUse = true; s.item.charges -= dt; }
      else if (s.item.id === 'medkit' && s.state === 'injured' && !s.action) { s.itemUse = true; }
    }
    if (s.flash) s.flash.intensity = s.flashOn ? 14 : 0;
    // vaulting
    if (s.vault) {
      const v = s.vault;
      v.t += dt / v.dur;
      const e = Math.min(1, v.t);
      s.pos.x = lerp(v.from.x, v.to.x, e);
      s.pos.z = lerp(v.from.z, v.to.z, e);
      if (v.t >= 1) { s.vault = null; }
      s.speed = 0;
      return;
    }
    // ongoing interaction
    if (s.action) {
      this.continueAction(s, dt);
      if (s.action) { s.speed = 0; return; }
    }
    // press actions: vault, pallet, hatch
    if (it.act && s.free) {
      const v = this.vaultable(s);
      if (v) this.startVault(s, v);
      else {
        const p = this.droppablePallet(s);
        if (p) this.dropPallet(s, p);
        else if (this.world.hatch.open && !this.world.hatch.closed && Math.hypot(s.pos.x - this.world.hatch.x, s.pos.z - this.world.hatch.z) < 1.8) this.escape(s, 'hatch');
      }
      it.act = false;
      if (s.vault) return;
    }
    // hold interactions
    if (it.interact && (s.free || s.state === 'dying')) {
      const a = this.findSurvivorInteraction(s, it.target);
      if (a && (s.free || a.type === 'none')) { this.beginAction(s, a); if (s.action) { s.speed = 0; return; } }
    }
    if (s.itemUse && s.item.id === 'medkit') { this.beginAction(s, { type: 'selfheal', target: s }); if (s.action) return; }
    if (s.has('field_medic') && it.item && !s.item && s.state === 'injured') { this.beginAction(s, { type: 'selfheal', target: s }); if (s.action) return; }
    // movement
    let mx = it.mx, mz = it.mz;
    const ml = Math.hypot(mx, mz);
    const v = this.survivorSpeed(s) * Math.min(1, ml);
    if (ml > 0.05) {
      const step = v * dt;
      s.pos.x += (mx / ml) * step;
      s.pos.z += (mz / ml) * step;
      const want = Math.atan2(mx, mz);
      if (s.flashOn && s.isPlayer) s.yaw = approachAngle(s.yaw, this.cam.yaw, dt * 12);
      else s.yaw = approachAngle(s.yaw, want, dt * (s.state === 'dying' ? 3 : 10));
    } else if (s.flashOn && s.isPlayer) s.yaw = approachAngle(s.yaw, this.cam.yaw, dt * 12);
    s.moveDir.x = ml > 0.05 ? mx / ml : 0; s.moveDir.z = ml > 0.05 ? mz / ml : 0;
    const before = s.pos.clone();
    this.world.resolve(s.pos, s.r, (c) => c.kind === 'killerOnly');
    s.speed = Math.hypot(s.pos.x - before.x, s.pos.z - before.z) / dt * 0 + (ml > 0.05 ? v : 0);
    // scratch marks, blood, footsteps
    if (s.speed > 3 && s.state !== 'dying') {
      s.scratchT -= dt * (s.has('shadow_walk') ? 0.5 : 1);
      if (s.scratchT <= 0) {
        s.scratchT = 0.16;
        const life = (this.killer.has('bloodhound') ? 18 : 9) * (s.has('shadow_walk') ? 0.5 : 1);
        this.addDecal('scratch', s.pos.x + (Math.random() - 0.5) * 1.2, s.pos.z + (Math.random() - 0.5) * 1.2, life);
        this.lastScratch = s;
      }
    }
    if (s.state !== 'healthy') {
      s.bloodT -= dt;
      if (s.bloodT <= 0) { s.bloodT = (s.state === 'dying' ? 1.5 : 1.0) * (this.killer.has('splinter') ? 0.5 : 1); this.addDecal('blood', s.pos.x + (Math.random() - 0.5) * 0.4, s.pos.z + (Math.random() - 0.5) * 0.4, this.killer.has('bloodhound') ? 24 : 12); }
    }
    if (s.speed > 1.5) {
      s.stepT -= dt * s.speed;
      if (s.stepT <= 0) {
        s.stepT = 1.4;
        if (!s.isPlayer) this.sfx('step', s.pos.x, s.pos.z, s.has('soft_step') ? 6 : 16);
        else this.audio.play('step', 0.6);
        if (this.killer.phasing && this.player.isKiller) this.addDecal('ripple', s.pos.x, s.pos.z, 1.4);
      }
    }
  }

  updateHooked(s, dt) {
    const rate = HOOK_RATE * (this.killer.has('hook_rot') ? 1.25 : 1) * (this.endgameT !== null ? 2 : 1);
    if (!s.action) s.hookProg += dt * rate;
    if (s.hookProg >= 0.5 && s.isPlayer && !s.ai) {
      // struggle: the player has to keep pressing
      if (this.time - (s.struggleT || 0) > 1.3) { s.hookProg += dt * 0.03; }
    }
    if (s.hookProg >= 1) { this.kill(s, 'sacrificed', true); return; }
    // self unhook attempts
    if (s.intent.interact && s.hooks === 1 && s.hookProg < 0.5 && s.selfTries < 3 && !s.action) {
      s.action = { type: 'selfunhook', t: 0, dur: s.has('escape_artist') ? 0.75 : 1.5 };
    }
    if (s.action && s.action.type === 'selfunhook') {
      s.action.t += dt;
      if (s.action.t >= s.action.dur) {
        s.action = null;
        s.selfTries++;
        if (Math.random() < (s.has('escape_artist') ? 0.25 : 0.04)) { this.unhook(s, s); this.announce(`${s.name} broke free`, 'Self unhook'); }
        else { s.hookProg += 0.06; }
      }
    }
    s.speed = 0;
  }

  updateCarried(s, dt) {
    const k = this.killer;
    if (s.isPlayer) s.wiggle += (s.intent.wiggle || 0) * 0.04;
    else s.wiggle += dt / 22;
    s.intent.wiggle = 0;
    if (s.wiggle >= 1) {
      this.dropCarried(true);
      this.announce(`${s.name} wiggled free`, '', 'good');
      s.addScore('nerve', 800);
      return;
    }
    const kx = Math.sin(k.yaw), kz = Math.cos(k.yaw);
    const rx = -Math.cos(k.yaw), rz = Math.sin(k.yaw);
    const side = 0.3;
    s.pos.set(k.pos.x - rx * side + kx * 0.05, 0, k.pos.z - rz * side + kz * 0.05);
  }

  dropCarried(stun) {
    const k = this.killer;
    const s = k.carrying;
    if (!s) return;
    k.carrying = null;
    s.state = 'injured';
    s.wiggle = 0;
    s.boostUntil = this.time + 1.5; s.boostMult = 1.5;
    const p = this.world.nav.nearestWalkable(k.pos.x - Math.cos(k.yaw) * 1.0, k.pos.z + Math.sin(k.yaw) * 1.0, 3) || [k.pos.x, k.pos.z];
    s.pos.set(p[0], 0, p[1]);
    if (stun) this.setKillerState('stun', 3);
  }

  flashlightTick(s, dt) {
    const k = this.killer;
    const d = this.dist(s, k);
    if (d > 8 || k.state === 'blind') return;
    const dir = s.isPlayer ? { x: Math.sin(this.cam.yaw), z: Math.cos(this.cam.yaw) } : { x: Math.sin(s.yaw), z: Math.cos(s.yaw) };
    const tx = (k.pos.x - s.pos.x) / d, tz = (k.pos.z - s.pos.z) / d;
    const beam = dir.x * tx + dir.z * tz;
    const width = s.item.addons.includes('wide_lens') ? 0.88 : 0.93;
    const facing = Math.sin(k.yaw) * -tx + Math.cos(k.yaw) * -tz;
    if (beam > width && facing > 0.55 && this.canSee(s.pos.x, s.pos.z, k.pos.x, k.pos.z)) {
      k.blindAcc = (k.blindAcc || 0) + dt * (s.item.addons.includes('focus_lens') ? 1.3 : 1);
      if (k.blindAcc > 1.0) {
        k.blindAcc = 0;
        const had = k.carrying;
        this.setKillerState('blind', 2.5);
        if (had) { this.dropCarried(false); this.announce(`${s.name} blinded the killer`, `${had.name} is free`, 'good'); s.addScore('nerve', 1200); }
        else s.addScore('nerve', 500);
        this.sfx('blind');
        if (k.isPlayer) this.blindFlash = 1;
      }
    } else k.blindAcc = Math.max(0, (k.blindAcc || 0) - dt * 0.5);
  }

  /* ---------------- vaults and pallets ---------------- */

  sideOf(v, x, z) { return Math.sign((x - v.x) * v.nx + (z - v.z) * v.nz) || 1; }

  vaultable(e) {
    let best = null, bd = 1.5;
    for (const v of this.world.vaults) {
      if (v.type === 'pallet' && !(v.state === 'down' || v.state === 'falling')) continue;
      if (v.type === 'pallet' && e.isKiller) continue;
      const lat = Math.abs((e.pos.x - v.x) * v.nz - (e.pos.z - v.z) * v.nx * -1) ;
      const lateral = v.nx ? Math.abs(e.pos.z - v.z) : Math.abs(e.pos.x - v.x);
      const cross = Math.abs((e.pos.x - v.x) * v.nx + (e.pos.z - v.z) * v.nz);
      void lat;
      if (lateral > v.halfW + 0.2 || cross > 1.4) continue;
      const d = Math.hypot(e.pos.x - v.x, e.pos.z - v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  startVault(e, v, forceDur) {
    const side = this.sideOf(v, e.pos.x, e.pos.z);
    const lateral = v.nx ? clamp(e.pos.z - v.z, -v.halfW * 0.5, v.halfW * 0.5) : clamp(e.pos.x - v.x, -v.halfW * 0.5, v.halfW * 0.5);
    const bx = v.nx ? v.x : v.x + lateral, bz = v.nx ? v.z + lateral : v.z;
    const to = { x: bx - v.nx * side * 0.95, z: bz - v.nz * side * 0.95 };
    const from = { x: e.pos.x, z: e.pos.z };
    let dur;
    let fast = false;
    if (e.isKiller) dur = 1.7;
    else {
      const toward = (e.moveDir.x * -v.nx * side + e.moveDir.z * -v.nz * side);
      fast = e.intent.run && toward > 0.6 && !e.crouch;
      dur = v.type === 'window' ? (fast ? 0.6 : e.crouch ? 1.4 : 1.1) : (fast ? 0.65 : 1.05);
      if (e.has('featherweight')) dur *= 0.7;
    }
    if (forceDur) dur = forceDur;
    e.vault = { v, from, to, t: 0, dur, fast };
    e.yaw = Math.atan2(-v.nx * side, -v.nz * side);
    if (e.isKiller) this.setKillerState('vault', dur);
    if (fast) { this.noise(v.x, v.z, 0.7, 'vault'); this.sfx('vault', v.x, v.z, 30); if (e.chased) e.addScore('nerve', 100); }
    else this.sfx('vault', v.x, v.z, 14);
  }

  droppablePallet(s) {
    for (const p of this.world.pallets) {
      if (p.state !== 'up') continue;
      if (Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 1.7) return p;
    }
    return null;
  }

  dropPallet(s, p) {
    this.world.dropPallet(p);
    this.sfx('pallet', p.x, p.z, 45);
    this.noise(p.x, p.z, 0.8, 'pallet');
    s.action = { type: 'drop', t: 0, dur: 0.35 };
    // push the survivor clear of the pallet if standing in its footprint
    const side = this.sideOf(p, s.pos.x, s.pos.z);
    const cross = Math.abs((s.pos.x - p.x) * p.nx + (s.pos.z - p.z) * p.nz);
    if (cross < 0.85) { s.pos.x = p.x + p.nx * side * 0.9 + (p.nx ? 0 : s.pos.x - p.x); s.pos.z = p.z + p.nz * side * 0.9 + (p.nz ? 0 : s.pos.z - p.z); }
    const k = this.killer;
    const kc = (k.pos.x - p.x) * p.nx + (k.pos.z - p.z) * p.nz;
    const kl = p.nx ? Math.abs(k.pos.z - p.z) : Math.abs(k.pos.x - p.x);
    if (Math.abs(kc) < 1.0 && kl < 1.3 && k.state !== 'stun') {
      const ks = kc === 0 ? -side : Math.sign(kc);
      k.pos.x += p.nx * ks * (1.0 - Math.abs(kc) + 0.1);
      k.pos.z += p.nz * ks * (1.0 - Math.abs(kc) + 0.1);
      if (k.carrying) this.dropCarried(false);
      this.setKillerState('stun', 2.0);
      this.sfx('stun', k.pos.x, k.pos.z);
      s.addScore('nerve', 600);
      this.announce(`${s.name} stunned the killer`, 'Pallet', 'good');
    }
  }

  /* ---------------- survivor interactions ---------------- */

  findSurvivorInteraction(s, target) {
    const w = this.world;
    const list = [];
    const near = (x, z, r) => Math.hypot(s.pos.x - x, s.pos.z - z) < r;
    if (s.state === 'dying') return null;
    for (const o of this.survivors) {
      if (o === s) continue;
      if (o.state === 'hooked' && o.hook && near(o.hook.hangX, o.hook.hangZ, 1.9)) list.push({ type: 'unhook', target: o, pri: 5 });
      if (o.state === 'dying' && near(o.pos.x, o.pos.z, 1.5)) list.push({ type: 'recover', target: o, pri: 4 });
      if (o.state === 'injured' && !o.vault && near(o.pos.x, o.pos.z, 1.5)) list.push({ type: 'heal', target: o, pri: 3 });
    }
    for (const g of w.gates) if (g.powered && !g.open && near(g.switchX, g.switchZ, 1.5)) list.push({ type: 'gate', target: g, pri: 4 });
    for (const g of w.gens) if (!g.done && !g.blocked && near(g.x, g.z, 1.7)) list.push({ type: 'repair', target: g, pri: 2 });
    for (const c of w.chests) if (!c.opened && near(c.x, c.z, 1.4)) list.push({ type: 'chest', target: c, pri: 1 });
    for (const t of w.tvs) if (t.disabledUntil < this.time && near(t.x, t.z, 1.4)) list.push({ type: 'unplug', target: t, pri: 1 });
    if (target) return list.find((a) => a.target === target.target && a.type === target.type) || null;
    list.sort((a, b) => b.pri - a.pri);
    return list[0] || null;
  }

  beginAction(s, a) {
    if (s.action && s.action.type === a.type && s.action.target === a.target) return;
    s.action = { type: a.type, target: a.target, t: 0 };
  }

  continueAction(s, dt) {
    const a = s.action;
    const it = s.intent;
    a.t += dt;
    if (a.type === 'drop') { if (a.t >= a.dur) s.action = null; return; }
    if (a.type === 'flinch') { if (a.t >= 0.35) s.action = null; return; }
    const holding = a.type === 'selfheal' ? (it.item || (s.has('field_medic') && it.item)) : it.interact;
    if (!holding || !s.free || Math.hypot(it.mx, it.mz) > 0.3) { s.action = null; return; }
    const tg = a.target;
    const face = (x, z) => { s.yaw = approachAngle(s.yaw, Math.atan2(x - s.pos.x, z - s.pos.z), dt * 8); };
    switch (a.type) {
      case 'repair': {
        if (tg.done || tg.blocked || Math.hypot(s.pos.x - tg.x, s.pos.z - tg.z) > 1.9) { s.action = null; return; }
        face(tg.x, tg.z);
        tg.regressing = false;
        tg.workers = (tg.workers || 0) + 1;
        let rate = 1 / GEN_TIME;
        if (s.has('tinkerer')) rate *= 1.15;
        if (s.item && s.item.id === 'toolbox' && s.item.charges > 0) {
          rate *= s.item.addons.includes('duct_tape') ? 1.75 : 1.5;
          s.item.charges -= dt;
        }
        tg.pending = (tg.pending || 0) + rate * dt;
        s.addScore('grit', dt * 16);
        this.maybeSkillCheck(s, 'repair', tg, dt);
        break;
      }
      case 'heal': case 'recover': {
        const o = tg;
        if ((a.type === 'heal' && o.state !== 'injured') || (a.type === 'recover' && o.state !== 'dying') || this.dist(s, o) > 1.9) { s.action = null; return; }
        face(o.pos.x, o.pos.z);
        const rate = (a.type === 'heal' ? 1 / 16 : 1 / 12) * (s.has('field_medic') ? 1.5 : 1);
        o.heal += rate * dt;
        o.beingHealed = this.time;
        s.addScore('kinship', dt * 30);
        this.maybeSkillCheck(s, 'heal', o, dt);
        if (o.heal >= 1) {
          o.heal = 0;
          if (o.state === 'dying') { o.state = 'injured'; o.bleed = Math.max(0, o.bleed); s.addScore('kinship', 600); this.announce(`${s.name} picked up ${o.name}`, '', 'good'); }
          else { o.state = 'healthy'; s.addScore('kinship', 400); }
          this.sfx('heal', o.pos.x, o.pos.z, 12);
          s.action = null;
        }
        break;
      }
      case 'selfheal': {
        if (s.state !== 'injured') { s.action = null; return; }
        let rate = 1 / 16;
        if (s.item && s.item.id === 'medkit' && s.item.charges > 0) {
          if (s.item.addons.includes('styptic')) rate *= 1.25;
          if (s.item.addons.includes('morphine')) rate *= 1.5;
          s.item.charges -= dt;
        } else if (s.has('field_medic')) rate *= 0.5;
        else { s.action = null; return; }
        s.heal += rate * dt;
        this.maybeSkillCheck(s, 'heal', s, dt);
        if (s.heal >= 1) { s.heal = 0; s.state = 'healthy'; this.sfx('heal', s.pos.x, s.pos.z, 10); s.action = null; }
        break;
      }
      case 'unhook': {
        const o = tg;
        if (o.state !== 'hooked') { s.action = null; return; }
        face(o.pos.x, o.pos.z);
        const dur = s.has('borrowed_breath') ? 0.6 : 1.2;
        if (a.t >= dur) { this.unhook(o, s); s.action = null; }
        break;
      }
      case 'gate': {
        if (tg.open) { s.action = null; return; }
        face(tg.switchX, tg.switchZ);
        tg.progress += dt / (s.has('lockbreaker') ? 10 : 20);
        s.addScore('grit', dt * 25);
        if (tg.progress >= 1) this.openGate(tg, s);
        break;
      }
      case 'chest': {
        if (tg.opened) { s.action = null; return; }
        face(tg.x, tg.z);
        tg.progress += dt / (s.has('scavenger') ? 5 : 8);
        if (tg.progress >= 1) {
          tg.opened = true;
          const pick = this.rng.pick(['flashlight', 'medkit', 'toolbox', 'map']);
          const def = ITEM_BY_ID[pick];
          const max = def.charges * (s.has('scavenger') ? 1.25 : 1);
          s.item = { id: pick, charges: max, max, addons: [] };
          if (pick === 'flashlight' && !s.flash) {
            s.flash = new THREE.SpotLight(0xfff1d8, 0, 18, 0.32, 0.5, 1.5);
            s.rig.itemSocket.add(s.flash); s.flash.target.position.set(0, -1, 0.2); s.rig.itemSocket.add(s.flash.target);
          }
          s.addScore('grit', 300);
          this.sfx('chest', tg.x, tg.z, 20);
          this.noise(tg.x, tg.z, 0.3, 'chest');
          if (s.isPlayer) this.announce(`Found: ${def.name}`, def.desc);
          s.action = null;
        }
        break;
      }
      case 'unplug': {
        if (tg.disabledUntil > this.time) { s.action = null; return; }
        face(tg.x, tg.z);
        tg.unplug += dt / 6;
        if (tg.unplug >= 1) {
          tg.unplug = 0;
          tg.disabledUntil = this.time + (this.killer.has('unplugged_cord') ? 30 : 60);
          s.addScore('grit', 300);
          this.sfx('click', tg.x, tg.z, 10);
          s.action = null;
        }
        break;
      }
      default: s.action = null;
    }
  }

  /* ---------------- skill checks ---------------- */

  maybeSkillCheck(s, kind, target, dt) {
    if (s.isPlayer) {
      if (this.skillCheck || this.pendingCheck) return;
      if (Math.random() < dt * (kind === 'repair' ? 0.1 : 0.08)) {
        this.pendingCheck = { t: 0.55, kind, target, s };
        this.audio.play('skillWarn');
      }
    } else if (Math.random() < dt * 0.09) {
      const r = Math.random();
      const glitched = s.glitchUntil > this.time;
      const fail = 0.12 + (glitched ? 0.15 : 0) - s.ai.skill * 0.08;
      if (r < fail) this.skillFail(s, kind, target);
      else if (r > 0.8) this.skillGreat(s, kind, target);
    }
  }

  updateSkillCheck(dt) {
    if (this.pendingCheck) {
      this.pendingCheck.t -= dt;
      const pc = this.pendingCheck;
      if (!pc.s.action || pc.s.action.target !== pc.target) { this.pendingCheck = null; return; }
      if (pc.t <= 0) {
        const steady = pc.s.has('steady_hands');
        const glitched = pc.s.glitchUntil > this.time;
        const zone = (steady ? 1.5 : 1) * 0.13 * Math.PI * 2 * 0.62;
        const start = Math.PI * 2 * (0.35 + Math.random() * 0.45);
        this.skillCheck = {
          ...pc, needle: 0, zoneStart: start, zone, great: zone * 0.24, speed: Math.PI * 2 / 1.1, reversed: glitched,
          ox: glitched ? (Math.random() - 0.5) * 0.5 : 0, oy: glitched ? (Math.random() - 0.5) * 0.4 : 0,
        };
        this.pendingCheck = null;
      }
    }
    const sc = this.skillCheck;
    if (!sc) return;
    if (!sc.s.action || sc.s.action.target !== sc.target) { this.skillCheck = null; return; }
    sc.needle += sc.speed * dt;
    if (sc.needle > Math.PI * 2 || sc.needle > sc.zoneStart + sc.zone + 0.25) { this.skillFail(sc.s, sc.kind, sc.target); this.skillCheck = null; this.lastCheck = { r: 'miss', t: this.time }; }
  }

  resolveSkillCheck() {
    const sc = this.skillCheck;
    if (!sc) return;
    const n = sc.needle;
    if (n >= sc.zoneStart && n <= sc.zoneStart + sc.great) { this.skillGreat(sc.s, sc.kind, sc.target); this.lastCheck = { r: 'great', t: this.time }; }
    else if (n >= sc.zoneStart && n <= sc.zoneStart + sc.zone) { this.audio.play('skillGood'); this.lastCheck = { r: 'good', t: this.time }; }
    else { this.skillFail(sc.s, sc.kind, sc.target); this.lastCheck = { r: 'miss', t: this.time }; }
    this.skillCheck = null;
  }

  skillGreat(s, kind, target) {
    let bonus = 0.01;
    if (s.has('steady_hands')) bonus += 0.02;
    if (kind === 'repair' && s.has('tinkerer')) bonus += 0.01;
    if (kind === 'repair' && s.item && s.item.id === 'toolbox' && s.item.addons.includes('spark_plug')) bonus += 0.03;
    if (kind === 'repair') target.progress = Math.min(0.999, target.progress + bonus);
    else target.heal = Math.min(0.99, target.heal + bonus);
    s.addScore('grit', 50);
    if (s.isPlayer) this.audio.play('skillGreat');
  }

  skillFail(s, kind, target) {
    if (kind === 'repair') {
      target.progress = Math.max(0, target.progress - 0.08);
      this.sfx('genFail', target.x, target.z, 60);
      this.noise(target.x, target.z, 1, 'gen');
      if (this.player.isKiller) this.announce('Loud noise', 'A generator backfired', 'noise');
    } else {
      if (!(s.item && s.item.id === 'medkit' && s.item.addons.includes('morphine'))) target.heal = Math.max(0, target.heal - 0.08);
      this.noise(s.pos.x, s.pos.z, 0.6, 'heal');
      this.sfx('scream', s.pos.x, s.pos.z, 25);
    }
    if (this.killer.has('static_shriek')) s.revealUntil = this.time + 6;
    s.action = null;
  }

  /* ---------------- hooks, deaths, escapes ---------------- */

  hookSurvivor(s, hook) {
    const k = this.killer;
    k.carrying = null;
    s.hooks++;
    s.wiggle = 0;
    s.hook = hook;
    hook.occupant = s;
    k.addScore('ritual', 700);
    this.sfx('hook', hook.x, hook.z, 50);
    if (s.hooks >= this.sacrificeAt) { s.state = 'hooked'; s.pos.set(hook.hangX, 0, hook.hangZ); this.kill(s, 'sacrificed', true); return; }
    s.state = 'hooked';
    s.hookProg = s.hooks >= 2 ? Math.max(s.hookProg, 0.5) : 0;
    s.selfTries = 0;
    s.pos.set(hook.hangX, 0, hook.hangZ);
    s.yaw = hook.ry + Math.PI;
    s.struggleT = this.time;
    this.announce(`${s.name} was hooked`, s.hooks >= 2 ? 'Second hook: they will not survive another' : 'First hook', 'bad');
    for (const o of this.survivors) if (o.has('kinship')) this.killer.revealUntil = this.time + 4;
    this.sfx('scream', hook.x, hook.z, 50);
  }

  unhook(s, rescuer) {
    const hook = s.hook;
    hook.occupant = null;
    s.hook = null;
    s.state = 'injured';
    s.heal = 0;
    const p = this.world.nav.nearestWalkable(hook.hangX + Math.sin(hook.ry) * 1.0, hook.hangZ + Math.cos(hook.ry) * 1.0, 3) || [hook.x + 1, hook.z];
    s.pos.set(p[0], 0, p[1]);
    s.boostUntil = this.time + 1.5; s.boostMult = 1.3;
    s.addScore('endurance', 300);
    if (rescuer !== s) {
      rescuer.addScore('kinship', 1000);
      if (rescuer.has('borrowed_breath')) s.protectUntil = this.time + 12;
      if (this.killer.has('hook_rot')) rescuer.revealUntil = this.time + 5;
      this.announce(`${rescuer.name} unhooked ${s.name}`, '', 'good');
    }
    this.sfx('unhook', hook.x, hook.z, 20);
  }

  kill(s, reason, onHook = false) {
    if (!s.alive) return;
    if (s.hook) { s.hook.occupant = null; }
    if (this.killer.carrying === s) this.killer.carrying = null;
    s.state = 'dead';
    s.outcome = reason;
    s.diedOnHook = onHook;
    s.action = null;
    s.deathAnim = 0;
    if (onHook) { this.killer.addScore('ritual', 1500); this.sfx('sacrifice', s.pos.x, s.pos.z, 80); }
    else if (reason === 'executed') this.killer.addScore('ritual', 1800);
    else if (reason === 'finished off') this.killer.addScore('ritual', 1200);
    else this.killer.addScore('ritual', 800);
    if (s.flash) s.flash.intensity = 0;
    const what = { sacrificed: 'was sacrificed', 'bled out': 'bled out', executed: `was executed by ${this.killer.def.name}`, 'finished off': `was finished off by ${this.killer.def.name}` }[reason] || 'was taken by the dark';
    this.announce(`${s.name} ${what}`, reason === 'executed' ? 'Mori' : reason === 'finished off' ? 'Mini mori' : '', 'bad');
    if (s === this.player) this.onPlayerOut();
    this.checkHatch();
  }

  escape(s, how) {
    if (!s.alive) return;
    s.state = 'escaped';
    s.outcome = how === 'hatch' ? 'escaped through the hatch' : 'escaped';
    s.action = null;
    s.addScore('endurance', how === 'hatch' ? 7000 : 5000);
    s.rig.root.visible = false;
    if (s.flash) s.flash.intensity = 0;
    if (how === 'hatch') { this.sfx('hatch', s.pos.x, s.pos.z, 30); this.world.hatch.closed = true; }
    this.announce(`${s.name} escaped`, how === 'hatch' ? 'Through the hatch' : 'Through the exit gate', 'good');
    if (s === this.player) this.onPlayerOut();
    this.checkHatch();
  }

  onPlayerOut() {
    const next = this.survivors.find((o) => o.alive);
    if (next) this.spectate = next;
  }

  checkHatch() {
    const alive = this.survivors.filter((s) => s.alive);
    const h = this.world.hatch;
    if (alive.length === 1 && !h.open && !h.closed) {
      h.open = true;
      h.mesh.group.visible = true;
      this.sfx('hatch', h.x, h.z, 40);
      this.announce('The hatch has opened', alive[0].isPlayer ? 'Listen for the wind' : '', 'info');
    }
  }

  openGate(g, s) {
    g.open = true;
    g.door.active = false;
    s.addScore('grit', 1000);
    this.sfx('gateOpen', g.x, g.z, 70);
    this.noise(g.x, g.z, 1, 'gate');
    this.announce('An exit gate is open', 'Get out', 'good');
    if (this.endgameT === null) this.endgameT = ENDGAME;
  }

  powerGates() {
    this.gatesPowered = true;
    for (const g of this.world.gates) g.powered = true;
    for (const gen of this.world.gens) if (!gen.done) gen.blocked = true;
    this.audio.play('gatesPowered');
    this.announce('The exit gates are powered', 'Find a switch', 'good');
    if (this.killer.has('final_hour') && !this.finalHourDone) {
      this.finalHourDone = true;
      for (const s of this.survivors) s.markedUntil = this.time + 60;
      this.announce('Final Hour', 'Every survivor is Marked', 'bad');
    }
    if (this.world.hatch.open && !this.world.hatch.closed) { /* hatch stays */ }
  }

  /* ---------------- objectives tick ---------------- */

  updateObjectives(dt) {
    const w = this.world;
    for (const g of w.gens) {
      if (g.done) continue;
      const n = g.workers || 0;
      if (n > 0) {
        g.progress += (g.pending || 0) * (n > 1 ? 0.9 : 1);
        g.lastWorked = this.time;
      } else if (g.regressing) {
        g.progress -= dt * 0.0035 * (this.killer.has('sundering_grip') ? 1.25 : 1);
        if (g.progress <= 0) { g.progress = 0; g.regressing = false; }
      }
      g.activeLevel = n;
      g.workers = 0; g.pending = 0;
      if (g.progress >= 1) this.completeGen(g);
    }
    // gens being repaired make pistons pump
    for (const g of w.gens) {
      const pump = g.activeLevel ? Math.sin(this.time * 18) : 0;
      g.mesh.pistons.forEach((p, i) => { p.position.y = 0.85 + (i ? -pump : pump) * 0.04; });
      g.flywheel += dt * (g.done ? 6 : g.activeLevel ? 10 : 0);
      g.mesh.flywheel.rotation.y = g.flywheel;
    }
    // escapes through open gates
    for (const s of this.survivors) {
      if (!s.alive || !s.free) continue;
      for (const g of w.gates) {
        if (!g.open) continue;
        const out = -((s.pos.x - g.x) * g.nx + (s.pos.z - g.z) * g.nz);
        const lat = g.alongX ? Math.abs(s.pos.x - g.x) : Math.abs(s.pos.z - g.z);
        if (out > 2.5 && lat < g.width / 2 + 0.5) this.escape(s, 'gate');
      }
    }
    // endgame
    if (this.endgameT !== null && !this.over) {
      this.endgameT -= dt;
      if (this.endgameT <= 0) {
        this.endgameT = 0;
        for (const s of this.survivors) if (s.alive) this.kill(s, 'taken');
      }
    }
    for (const t of w.tvs) {
      const off = t.disabledUntil > this.time;
      t.mesh.screen.material.map = off ? null : t.target ? this.killer.rig.screenCanvas.tex : w.tvStatic.tex;
      t.mesh.screen.material.color.set(off ? 0x050505 : 0xffffff);
      t.mesh.screen.material.needsUpdate = true;
      t.mesh.glow.material.opacity = off ? 0 : t.target ? 0.9 : 0.3;
    }
  }

  completeGen(g) {
    g.done = true;
    g.progress = 1;
    g.regressing = false;
    this.gensDone++;
    g.mesh.bulbs.forEach((b) => { b.material = b.material.clone(); b.material.emissive = new THREE.Color('#ffd890'); b.material.emissiveIntensity = 4; });
    g.mesh.glow.material.opacity = 0.75;
    this.audio.play('genDone', 0.5 + 0.5 * this.hearVol(g.x, g.z, 80));
    this.noise(g.x, g.z, 1, 'genDone');
    const left = Math.max(0, GENS_NEEDED - this.gensDone);
    this.announce(left ? `Generator repaired` : 'All generators repaired', left ? `${left} to go` : '', 'good');
    if (this.killer.has('alarm_bells')) {
      for (const s of this.survivors) if (s.action && s.action.type === 'repair') s.revealUntil = this.time + 5;
    }
    for (const s of this.survivors) if (s.alive) s.addScore('grit', 250);
    if (this.gensDone >= GENS_NEEDED && !this.gatesPowered) this.powerGates();
  }

  /* ---------------- killer ---------------- */

  setKillerState(st, dur, data = null) {
    const k = this.killer;
    if (k.state === 'vault' && st !== 'stun' && st !== 'blind') { k.vault = null; }
    if (st === 'stun' || st === 'blind') { k.vault = null; if (k.power.kind === 'veil' && k.power.active) this.endVeil(); if (k.power.kind === 'exe') { k.power.selecting = false; } }
    k.state = st; k.stateT = 0; k.stateDur = dur; k.stateData = data;
  }

  killerSpeed(k) {
    let v = k.def.speed;
    if (k.carrying) v = 4.0;
    if (k.has('patient_hunter') && !k.carrying && !k.chaseTarget) v *= 1.05;
    if (k.chaseTarget && k.has('bloodlust')) v *= 1 + k.bloodlust;
    if (k.phasing) v = k.def.speed * 1.65 * (k.has('dried_lily') ? 1.1 : 1);
    if (k.ai && !k.isPlayer) v *= 0.92 + k.ai.skill * 0.1;
    if (k.power.kind === 'chop' && k.power.raising) v *= k.has('birch_mask') ? 0.93 : 0.85;
    switch (k.state) {
      case 'lunge': return v * 1.5;
      case 'chop': return v * (2.0 + (k.stateData ? k.stateData.charge : 0) * 0.9) * (k.has('iron_wedge') ? 1.15 : 1);
      case 'recover': return v * (k.stateData === 'hit' ? 0.35 : 0.55);
      case 'normal': return v;
      default: return 0;
    }
  }

  updateKiller(k, dt) {
    const it = k.intent;
    k.stateT += dt;
    this.updatePower(k, dt);
    // timed states
    if (k.state !== 'normal' && k.state !== 'lunge' && k.state !== 'chop' && k.stateT >= k.stateDur) {
      const st = k.state, data = k.stateData;
      k.state = 'normal';
      if (st === 'pickup' && data && data.state === 'dying') {
        k.carrying = data; data.state = 'carried'; data.wiggle = 0; data.action = null;
        k.addScore('savagery', 300);
      }
      if (st === 'hook' && data && k.carrying === data.s) this.hookSurvivor(data.s, data.hook);
      if (st === 'break' && data) { this.world.breakPallet(data); k.addScore('savagery', 150); this.sfx('break', data.x, data.z, 40); this.timber(data); }
      if (st === 'mori' && data) this.kill(data.s, data.kind === 'full' ? 'executed' : 'finished off');
      if (st === 'kick' && data && !data.done) {
        data.progress = Math.max(0, data.progress - (k.has('sundering_grip') ? 0.15 : 0.05));
        data.regressing = true;
        k.addScore('cunning', 250);
        this.sfx('kick', data.x, data.z, 30);
      }
      if (st === 'closeHatch') { this.world.hatch.closed = true; this.world.hatch.open = false; k.addScore('cunning', 600); if (!this.gatesPowered) this.powerGates(); if (this.endgameT === null) this.endgameT = ENDGAME; this.announce('The hatch was closed', 'The gates are powered', 'bad'); }
      if (st === 'channel' && data && data.kind === 'exe') this.exeArrive(k, data.tv);
      if (st === 'channel' && data && data.kind === 'veil') this.beginVeil(k);
    }
    if (k.vault) {
      const v = k.vault;
      v.t += dt / v.dur;
      const e = Math.min(1, v.t);
      k.pos.x = lerp(v.from.x, v.to.x, e); k.pos.z = lerp(v.from.z, v.to.z, e);
      if (v.t >= 1) k.vault = null;
    }
    // facing
    if (it.look) k.yaw = it.look.yaw, k.pitch = it.look.pitch;
    // attack
    if (it.mori && k.state === 'normal' && !k.carrying && !k.phasing) { const t = this.moriTarget(); if (t) this.startMori(t.s, t.kind); }
    it.mori = false;
    if (k.state === 'normal' && it.attack && !k.carrying && !k.phasing && !k.power.selecting && !k.power.raising) {
      k.state = 'lunge'; k.stateT = 0; k.stateDur = 0.55;
      this.sfx('swing', k.pos.x, k.pos.z, 15);
    }
    if (k.state === 'lunge') {
      const reach = (k.has('long_reach') ? 1.25 : 1) * (k.lungeBonusUntil > this.time ? 1.6 : 1);
      const hit = this.findHit(k, 1.9 * reach);
      if (hit) { this.hitSurvivor(k, hit); }
      else if (k.stateT >= k.stateDur || (!it.attack && k.stateT > 0.18)) this.setKillerState('recover', 1.5, 'miss');
    }
    if (k.state === 'chop') {
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
      for (const p of this.world.pallets) {
        if (p.state !== 'down' && p.state !== 'falling') continue;
        const dx = p.x - k.pos.x, dz = p.z - k.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.7 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2) { this.world.breakPallet(p); this.sfx('break', p.x, p.z, 45); k.addScore('cunning', 200); this.timber(p); }
      }
      const hit = this.findHit(k, 2.0);
      if (hit) this.hitSurvivor(k, hit, { chop: k.stateData.charge });
      else if (k.stateT >= k.stateDur) { this.setKillerState('recover', 2.5 - (k.has('pine_tar') ? 0.8 : 0), 'miss'); this.sfx('kick', k.pos.x, k.pos.z, 20); }
    }
    // contextual action
    if (it.act && k.state === 'normal' && !k.phasing) this.killerAct(k, it.target);
    it.act = false;
    // movement
    const v = this.killerSpeed(k);
    let mx = it.mx, mz = it.mz;
    if (k.state === 'lunge' && Math.hypot(mx, mz) < 0.2) { mx = Math.sin(k.yaw); mz = Math.cos(k.yaw); }
    if (k.state === 'chop') { mx = Math.sin(k.yaw); mz = Math.cos(k.yaw); }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.05 && v > 0 && !k.vault) {
      const step = v * Math.min(1, ml) * dt;
      k.pos.x += (mx / ml) * step; k.pos.z += (mz / ml) * step;
      if (!it.look && k.state !== 'chop') k.yaw = approachAngle(k.yaw, Math.atan2(mx, mz), dt * (k.state === 'lunge' ? 4 : 8));
      k.speed = v * Math.min(1, ml);
    } else k.speed = 0;
    if (!k.vault) this.world.resolve(k.pos, k.r, (c) => c.kind === 'gate' && c.ref.open);
    // bloodlust
    if (k.chaseTarget && k.has('bloodlust')) k.bloodlust = Math.min(0.12, Math.floor(k.chaseT / 8) * 0.03);
    else k.bloodlust = 0;
  }

  findHit(k, reach) {
    let best = null, bd = reach;
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    for (const s of this.survivors) {
      if (!s.free) continue;
      const dx = s.pos.x - k.pos.x, dz = s.pos.z - k.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + s.r || d < 0.01) continue;
      if ((dx * fx + dz * fz) / d < 0.55) continue;
      if (!this.canSee(k.pos.x, k.pos.z, s.pos.x, s.pos.z)) continue;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  hitSurvivor(k, s, opts = {}) {
    const t = this.time;
    let downed = false;
    if (opts.chop >= 0.999 && k.has('heartwood') && s.state === 'healthy' && s.protectUntil <= t) s.state = 'injured';
    s.action = null;
    s.vault = null;
    if (s.protectUntil > t) { s.protectUntil = 0; this.announce(`${s.name} shrugged off the hit`, 'Borrowed Breath', 'good'); }
    else if (s.state === 'injured' || s.markedUntil > t) {
      if (s.has('last_breath') && !s.lastBreathUsed) { s.lastBreathUsed = true; s.state = 'injured'; s.boostUntil = t + 2; s.boostMult = 1.5; this.announce(`${s.name} held on`, 'Last Breath', 'good'); }
      else { s.state = 'dying'; s.bleed = 0; s.heal = 0; downed = true; s.crouch = false; }
    } else { s.state = 'injured'; s.heal = 0; }
    if (!downed) {
      s.boostUntil = t + 1.8; s.boostMult = 1.5;
      if (s.has('adrenal_surge') && s.adrenalReady <= t) { s.boostUntil = t + 3; s.adrenalReady = t + 60; }
      if (k.has('hamstring') || (opts.chop !== undefined && k.has('saw_tooth'))) s.hinderPending = true;
    }
    k.addScore('savagery', downed ? 600 : 350);
    k.bloodlust = 0; k.chaseT = 0;
    this.setKillerState('recover', 2.7 * (k.has('relentless') ? 0.6 : 1), 'hit');
    this.sfx('hit', s.pos.x, s.pos.z, 30);
    this.sfx('scream', s.pos.x, s.pos.z, 40);
    for (let i = 0; i < 3; i++) this.addDecal('blood', s.pos.x + (Math.random() - 0.5), s.pos.z + (Math.random() - 0.5), 14);
    if (s === this.player) this.hitFlash = 1;
    if (downed) this.announce(`${s.name} is down`, '', 'bad');
    if (opts.chop !== undefined) { this.sfx('kick', s.pos.x, s.pos.z, 30); this.shake = 0.35; }
  }

  /* ---------------- moris ---------------- */

  // Full mori: needs the Ashen Rite and a survivor hooked at least once. Mini mori: the last survivor standing.
  moriKind(s) {
    if (s.state !== 'dying') return null;
    if (this.moriAllowed && s.hooks >= 1) return 'full';
    if (this.survivors.filter((o) => o.alive).length === 1) return 'mini';
    return null;
  }

  moriTarget() {
    const k = this.killer;
    for (const s of this.survivors) {
      if (Math.hypot(s.pos.x - k.pos.x, s.pos.z - k.pos.z) > 2.0) continue;
      const kind = this.moriKind(s);
      if (kind) return { s, kind };
    }
    return null;
  }

  startMori(s, kind) {
    const k = this.killer;
    k.yaw = Math.atan2(s.pos.x - k.pos.x, s.pos.z - k.pos.z);
    const p = this.world.nav.nearestWalkable(k.pos.x + Math.sin(k.yaw) * 1.05, k.pos.z + Math.cos(k.yaw) * 1.05, 2) || [s.pos.x, s.pos.z];
    s.pos.set(p[0], 0, p[1]);
    s.yaw = k.yaw + Math.PI;
    s.state = 'mori';
    s.action = null;
    s.moriKind = kind;
    this.setKillerState('mori', kind === 'full' ? 5.2 : 2.4, { s, kind });
    this.moriCam = Math.atan2(k.pos.x - s.pos.x, k.pos.z - s.pos.z) + Math.PI / 2;
    this.sfx('scream', s.pos.x, s.pos.z, 50);
    if (k.def.id === 'exe') this.sfx('glitch', k.pos.x, k.pos.z, 40);
    if (k.def.id === 'specter') this.sfx('veilIn', k.pos.x, k.pos.z, 40);
  }

  // Pose the victim and the killer through each killer's mori.
  moriFrame() {
    const k = this.killer, d = k.stateData;
    const p = clamp(k.stateT / k.stateDur, 0, 1);
    const kind = k.def.id;
    const out = { victim: 'crawl', y: 0, scale: 1, visible: true, killer: 'move', kp: 0, impact: false };
    if (d.kind === 'full') {
      if (kind === 'woodsman') {
        out.victim = p < 0.62 ? 'kneel' : 'crawl';
        out.killer = p < 0.55 ? 'raise' : p < 0.72 ? 'chop' : 'move';
        out.kp = clamp((p - 0.55) / 0.08, 0, 1);
        out.impact = p > 0.62;
      } else if (kind === 'specter') {
        out.killer = 'grab';
        out.victim = p < 0.12 ? 'kneel' : 'lifted';
        out.y = p < 0.8 ? clamp((p - 0.12) / 0.3, 0, 1) * 0.75 : 0.75 - ((p - 0.8) / 0.2) * 2.8;
        out.impact = p > 0.8;
      } else {
        out.killer = p < 0.85 ? 'grab' : 'move';
        out.victim = p < 0.12 ? 'kneel' : 'lifted';
        out.y = clamp((p - 0.12) / 0.3, 0, 1) * 0.55;
        out.visible = p < 0.45 || Math.random() > (p - 0.45) * 1.9;
        out.scale = p < 0.7 ? 1 : Math.max(0.02, 1 - (p - 0.7) / 0.3);
        out.impact = p > 0.6;
      }
    } else {
      out.killer = kind === 'woodsman' ? (p < 0.4 ? 'raise' : p < 0.6 ? 'chop' : 'move') : p < 0.35 ? 'lunge' : p < 0.65 ? 'attack' : 'move';
      out.kp = kind === 'woodsman' ? clamp((p - 0.4) / 0.08, 0, 1) : clamp((p - 0.35) / 0.3, 0, 1);
      out.impact = p > 0.45;
      if (kind === 'exe' && p > 0.5) { out.visible = Math.random() > (p - 0.5) * 2; out.scale = Math.max(0.02, 1 - (p - 0.5) * 2); }
      if (kind === 'specter' && p > 0.55) out.y = -((p - 0.55) / 0.45) * 2.2;
    }
    if (out.impact && !d.impactDone) {
      d.impactDone = true;
      this.shake = 0.45;
      this.sfx('hit', d.s.pos.x, d.s.pos.z, 40);
      if (kind === 'exe') this.sfx('staticBurst', d.s.pos.x, d.s.pos.z, 40);
      else for (let i = 0; i < 6; i++) this.addDecal('blood', d.s.pos.x + (Math.random() - 0.5) * 1.4, d.s.pos.z + (Math.random() - 0.5) * 1.4, 30);
      if (kind === 'specter') for (let i = 0; i < 3; i++) this.addDecal('ripple', d.s.pos.x, d.s.pos.z, 2 + i * 0.5);
    }
    return out;
  }

  timber(p) {
    if (!this.killer.has('timber')) return;
    for (const s of this.survivors) if (s.alive && Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < 16) s.revealUntil = this.time + 4;
  }

  killerAct(k, target) {
    const w = this.world;
    const near = (x, z, r) => Math.hypot(k.pos.x - x, k.pos.z - z) < r;
    const want = (type) => !target || target.type === type;
    if (k.carrying) {
      let best = null, bd = 2.4;
      for (const h of w.hooks) { if (h.occupant || h.broken) continue; const d = Math.hypot(k.pos.x - h.x, k.pos.z - h.z); if (d < bd) { bd = d; best = h; } }
      if (best) { k.yaw = Math.atan2(best.x - k.pos.x, best.z - k.pos.z); this.setKillerState('hook', 1.0, { s: k.carrying, hook: best }); }
      return;
    }
    if (want('pickup')) for (const s of this.survivors) if (s.state === 'dying' && near(s.pos.x, s.pos.z, 1.9)) { this.setKillerState('pickup', 1.2, s); this.sfx('scream', s.pos.x, s.pos.z, 20); return; }
    if (want('hatch') && w.hatch.open && !w.hatch.closed && near(w.hatch.x, w.hatch.z, 2)) { this.setKillerState('closeHatch', 1.5); return; }
    if (want('break')) for (const p of w.pallets) if ((p.state === 'down' || p.state === 'falling') && near(p.x, p.z, 1.9)) { this.setKillerState('break', 2.3 * (k.has('wrecker') ? 0.5 : 1), p); return; }
    if (want('vault')) { const v = this.vaultable(k); if (v) { this.startVault(k, v); return; } }
    if (want('kick')) for (const g of w.gens) if (!g.done && !g.regressing && g.progress > 0.02 && near(g.x, g.z, 1.9)) { this.setKillerState('kick', 1.8 * (k.has('wrecker') ? 0.5 : 1), g); return; }
  }

  killerPrompt() {
    const k = this.killer, w = this.world;
    if (k.state !== 'normal' || k.phasing) return null;
    const near = (x, z, r) => Math.hypot(k.pos.x - x, k.pos.z - z) < r;
    if (k.carrying) { for (const h of w.hooks) if (!h.occupant && near(h.x, h.z, 2.4)) return 'Hook survivor'; return null; }
    for (const s of this.survivors) if (s.state === 'dying' && near(s.pos.x, s.pos.z, 1.9)) { const mk = this.moriKind(s); return mk ? `Pick up · R: ${mk === 'full' ? 'Mori' : 'Mini mori'}` : 'Pick up'; }
    if (w.hatch.open && !w.hatch.closed && near(w.hatch.x, w.hatch.z, 2)) return 'Close hatch';
    for (const p of w.pallets) if ((p.state === 'down') && near(p.x, p.z, 1.9)) return 'Break pallet';
    if (this.vaultable(k)) return 'Vault';
    for (const g of w.gens) if (!g.done && !g.regressing && g.progress > 0.02 && near(g.x, g.z, 1.9)) return 'Damage generator';
    return null;
  }

  /* ---------------- killer powers ---------------- */

  updatePower(k, dt) {
    const p = k.power;
    const it = k.intent;
    if (p.kind === 'chop') {
      if (k.state !== 'normal' || k.carrying) { p.raising = false; p.charge = 0; return; }
      if (it.power) {
        if (!p.raising) { p.raising = true; p.charge = 0; this.sfx('swing', k.pos.x, k.pos.z, 12); }
        p.charge = Math.min(1, p.charge + dt / p.chargeTime);
      } else if (p.raising) {
        p.raising = false;
        if (p.charge * p.chargeTime >= p.minCharge) {
          k.state = 'chop'; k.stateT = 0; k.stateDur = 0.32 + p.charge * 0.28; k.stateData = { charge: p.charge };
          this.sfx('swing', k.pos.x, k.pos.z, 25);
          k.addScore('cunning', 40);
        }
        p.charge = 0;
      }
      return;
    }
    if (p.kind === 'veil') {
      if (p.active) {
        p.t += dt;
        if (p.t >= p.dur || (!it.power && p.t > 0.3) || k.state !== 'normal') this.endVeil();
      } else {
        p.charge = Math.min(1, p.charge + dt / p.recharge);
        if (it.power && p.charge >= 1 && k.state === 'normal' && !k.carrying) {
          this.setKillerState('channel', 0.4, { kind: 'veil' });
          p.charge = 0.999;
          this.sfx('veilIn', k.pos.x, k.pos.z, 30);
        }
      }
    } else {
      p.cooldown = Math.max(0, p.cooldown - dt);
      const tvs = this.world.tvs.filter((t) => t.disabledUntil < this.time);
      if (it.power && p.cooldown <= 0 && k.state === 'normal' && !k.carrying && tvs.length) {
        p.selecting = true;
        // pick the screen closest to where the killer is looking (or the AI's chosen screen)
        if (it.tv && tvs.includes(it.tv)) p.target = it.tv;
        else {
          let best = null, bs = -2;
          const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
          for (const t of tvs) {
            const dx = t.x - k.pos.x, dz = t.z - k.pos.z, d = Math.hypot(dx, dz);
            if (d < 4) continue;
            const s = (dx * fx + dz * fz) / d;
            if (s > bs) { bs = s; best = t; }
          }
          p.target = best;
        }
      } else if (p.selecting && !it.power) {
        p.selecting = false;
        if (p.target && k.state === 'normal') {
          p.target.target = true;
          this.setKillerState('channel', p.channel, { kind: 'exe', tv: p.target });
          this.sfx('glitch', k.pos.x, k.pos.z, 25);
          this.sfx('staticBurst', p.target.x, p.target.z, 25);
          this.noise(p.target.x, p.target.z, 0.5, 'tv');
        }
      } else if (!it.power) p.selecting = false;
      if (k.rig.kind === 'exe') {
        const glitch = k.state === 'channel' ? 1 : p.selecting ? 0.5 : Math.random() < 0.01 ? 1 : 0.1;
        k.rig.glitch = damp(k.rig.glitch, glitch, 10, dt);
      }
    }
  }

  beginVeil(k) {
    const p = k.power;
    p.active = true; p.t = 0; p.charge = 0;
    k.addScore('cunning', 80);
  }

  endVeil() {
    const k = this.killer;
    const p = k.power;
    if (!p.active) return;
    p.active = false; p.charge = 0;
    this.sfx('veilOut', k.pos.x, k.pos.z, 30);
    if (k.has('wedding_veil')) k.lungeBonusUntil = this.time + 2.5;
    if (k.has('drowned_bell')) for (const s of this.survivors) if (s.alive && this.dist(s, k) < 16) { s.revealUntil = this.time + 4; this.sfx('scream', s.pos.x, s.pos.z, 30); }
  }

  exeArrive(k, tv) {
    tv.target = false;
    if (tv.disabledUntil > this.time) return;
    const a = tv.ry;
    const p = this.world.nav.nearestWalkable(tv.x + Math.sin(a) * 1.2, tv.z + Math.cos(a) * 1.2, 4) || [tv.x + 1.2, tv.z];
    k.pos.set(p[0], 0, p[1]);
    k.power.cooldown = k.power.maxCd;
    k.addScore('cunning', 200);
    this.sfx('staticBurst', p[0], p[1], 50);
    const dur = 12 + (k.has('dusty_cartridge') ? 4 : 0);
    for (const s of this.survivors) {
      if (!s.alive) continue;
      const d = this.dist(s, k);
      if (d < 12) { s.glitchUntil = this.time + dur; if (k.has('dead_pixel')) s.revealUntil = this.time + dur; }
      if (k.has('blue_screen') && d < 24) s.revealUntil = Math.max(s.revealUntil, this.time + 6);
    }
    if (k.has('blue_screen')) for (const g of this.world.gens) if (!g.done && Math.hypot(g.x - k.pos.x, g.z - k.pos.z) < 16) { g.progress = Math.max(0, g.progress - 0.15); g.regressing = true; }
    if (k.isPlayer) this.blindFlash = 0.5;
  }

  /* ---------------- chase tracking ---------------- */

  updateChase(dt) {
    const k = this.killer;
    let target = null;
    if (k.ai) target = k.ai.chaseTarget && k.ai.chaseTarget.free ? k.ai.chaseTarget : null;
    else {
      let best = 18;
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
      for (const s of this.survivors) {
        if (!s.free) continue;
        const d = this.dist(s, k);
        if (d > best) continue;
        const dot = ((s.pos.x - k.pos.x) * fx + (s.pos.z - k.pos.z) * fz) / Math.max(d, 0.01);
        if (dot < 0.5 || !this.canSee(k.pos.x, k.pos.z, s.pos.x, s.pos.z)) continue;
        best = d; target = s;
      }
    }
    if (target !== k.chaseTarget) {
      if (target && !k.chaseTarget) k.addScore('pursuit', 150);
      k.chaseTarget = target; k.chaseT = 0;
    }
    if (target) { k.chaseT += dt; k.addScore('pursuit', dt * 10); }
    for (const s of this.survivors) {
      const was = s.chased;
      s.chased = s === target;
      if (s.chased) { s.chaseT += dt; s.addScore('nerve', dt * 12); }
      else if (was) s.chaseT = 0;
    }
  }

  /* ---------------- separation between bodies ---------------- */

  separate() {
    const bodies = [this.killer, ...this.survivors.filter((s) => s.free && !s.vault)];
    if (this.killer.vault) bodies.shift();
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz), min = a.r + b.r;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2;
        a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
      }
    }
  }

  /* ---------------- visuals ---------------- */

  auraFor(obj) {
    if (!this.propAuras.has(obj)) this.propAuras.set(obj, attachAura(obj.mesh.group));
    return this.propAuras.get(obj);
  }

  updateVisuals(dt) {
    const k = this.killer;
    const P = this.player;
    const view = this.spectate || P;
    const t = this.time;
    const mf = k.state === 'mori' && k.stateData ? this.moriFrame() : null;
    // survivors
    for (const s of this.survivors) {
      const rig = s.rig;
      if (!s.alive) { if (s.state === 'escaped') rig.root.visible = false; rig.aura.set(null); continue; }
      let mode = 'stand';
      if (s.state === 'dying') mode = 'crawl';
      else if (s.state === 'mori') mode = mf ? mf.victim : 'crawl';
      else if (s.state === 'carried') mode = 'carried';
      else if (s.state === 'hooked') mode = 'hooked';
      else if (s.vault) mode = 'vault';
      else if (s.action) mode = { repair: 'repair', heal: 'heal', recover: 'heal', selfheal: 'heal', unhook: 'unhook', gate: 'gate', chest: 'search', unplug: 'search', drop: 'drop', flinch: 'flinch' }[s.action.type] || 'stand';
      else if (s.flashOn || s.itemUse) mode = 'item';
      else if (s.crouch) mode = 'crouch';
      poseSurvivor(rig, {
        mode, speed: s.speed, injured: s.state === 'injured', dt, struggle: (s.state === 'hooked' && s.hookProg >= 0.5) || s.state === 'carried',
        progress: s.vault ? Math.min(1, s.vault.t) : s.action ? Math.min(1, s.action.t / (s.action.dur || 1)) : 0,
      });
      if (s.state === 'carried') {
        const ky = k.yaw;
        const sx = k.pos.x - Math.cos(ky) * 0.32, sz = k.pos.z + Math.sin(ky) * 0.32;
        const ry = ky + Math.PI / 2;
        rig.root.position.set(sx - Math.sin(ry) * 0.95, 1.35 * (k.def.height / 2), sz - Math.cos(ry) * 0.95);
        rig.root.rotation.y = ry;
      } else {
        rig.root.position.set(s.pos.x, s.vault ? Math.sin(Math.min(1, s.vault.t) * Math.PI) * 0.45 : 0, s.pos.z);
        rig.root.rotation.y = s.yaw;
        if (s.state === 'mori' && mf) { rig.root.position.y = mf.y; rig.root.scale.setScalar(mf.scale); }
      }
      // visibility for a Specter player in the veil
      const hidden = P.isKiller && k.phasing && !(k.has('mourning_locket') && this.dist(s, k) < 10);
      rig.root.visible = (!hidden || s.state === 'carried') && !(s.state === 'mori' && mf && !mf.visible);
      // auras
      let aura = null;
      if (P.isKiller) {
        if (s.revealUntil > t || (k.phasing && k.has('mourning_locket') && this.dist(s, k) < 10)) aura = 0xff3a2a;
        if (s.glitchUntil > t && (k.has('dead_pixel') || Math.sin(t * 2.2) > 0.85)) aura = 0x5ae0ff;
      } else if (s !== view) {
        if (s.state === 'hooked') aura = 0xff5a3a;
        else if (s.state === 'dying') aura = 0xffc23a;
        else if (P.isSurvivor && P.has('kinship')) aura = 0xffd84a;
      }
      rig.aura.set(aura);
    }
    // killer
    const kr = k.rig;
    let mode = 'move';
    let kp = k.stateDur ? k.stateT / k.stateDur : 0;
    if (mf) { mode = mf.killer; kp = mf.kp; }
    else if (k.state === 'chop') mode = 'chop';
    else if (k.power.kind === 'chop' && k.power.raising) mode = 'raise';
    else if (k.state === 'lunge') mode = 'lunge';
    else if (k.state === 'recover' && k.stateData === 'hit' && k.stateT < 0.6) mode = 'attack';
    else if (k.state === 'recover' && k.stateT < 0.5) mode = 'attack';
    else if (k.state === 'stun' || k.state === 'blind') mode = 'stun';
    else if (k.state === 'pickup') mode = 'pickup';
    else if (k.state === 'hook') mode = 'hook';
    else if (k.state === 'kick' || k.state === 'break') mode = 'kick';
    else if (k.state === 'channel') mode = 'channel';
    else if (k.state === 'vault') mode = 'vault';
    else if (k.carrying) mode = 'carry';
    else if (k.phasing) mode = 'phase';
    poseKiller(kr, { mode, speed: k.speed, dt, progress: kp });
    kr.root.position.set(k.pos.x, k.vault ? Math.sin(Math.min(1, k.vault.t) * Math.PI) * 0.4 : 0, k.pos.z);
    kr.root.rotation.y = k.yaw;
    if (P.isKiller) kr.root.visible = k.state === 'mori';
    if (kr.kind === 'specter') {
      const phaseVis = k.phasing ? 0.035 + Math.random() * 0.04 : k.state === 'channel' ? 0.5 : 1;
      if (kr.curOpacity !== phaseVis) { setSpecterOpacity(kr, phaseVis); kr.curOpacity = phaseVis; }
    } else if (kr.kind === 'exe') {
      if (mf) kr.glitch = 1;
      kr.mat.userData.uniforms.uTime.value = t;
      kr.mat.userData.uniforms.uGlitch.value = kr.glitch;
      kr.ghosts.forEach((g, i) => { g.visible = kr.glitch > 0.4 && Math.random() < 0.6; g.position.x = (i ? -1 : 1) * 0.08 * kr.glitch; });
      kr.screenLight.intensity = 0.6 + kr.glitch;
      if (Math.floor(t * 12) !== kr.faceFrame) { kr.faceFrame = Math.floor(t * 12); drawExeFace(kr, t, kr.glitch > 0.8 && Math.random() < 0.3 ? 'static' : 'face'); }
    }
    let kAura = null;
    if (P.isSurvivor) {
      const d = this.dist(P, k);
      if (k.revealUntil > t) kAura = 0xff3a2a;
      if (P.alive && P.has('sixth_sense') && d < 24 && !this.canSee(P.pos.x, P.pos.z, k.pos.x, k.pos.z)) kAura = 0xff3a2a;
    }
    kr.aura.set(kAura);
    // prop auras
    const props = [];
    if (P.isKiller && k.carrying) for (const h of this.world.hooks) if (!h.occupant) props.push([h, 0xe8e8ff]);
    if (P.isKiller && k.power.kind === 'exe' && k.power.selecting) for (const tv of this.world.tvs) props.push([tv, tv === k.power.target ? 0xff4a8a : 0x8ad8ff]);
    if (P.isSurvivor && P.alive) {
      if (P.itemUse && P.item && P.item.id === 'map') {
        for (const g of this.world.gens) if (!g.done) props.push([g, 0xffffff]);
        if (P.item.addons.includes('red_marker')) for (const h of this.world.hooks) props.push([h, 0xff6a5a]);
        if (P.item.addons.includes('compass')) { for (const g of this.world.gates) props.push([g, 0x9aff9a]); for (const c of this.world.chests) if (!c.opened) props.push([c, 0xffe08a]); }
      }
      if (P.has('lockbreaker') && this.gatesPowered) for (const g of this.world.gates) props.push([g, 0x9aff9a]);
    }
    const want = new Map(props);
    for (const [obj, au] of this.propAuras) if (!want.has(obj)) au.set(null);
    for (const [obj, col] of want) this.auraFor(obj).set(col, 0.8);
    // hooks glow red when occupied
    for (const h of this.world.hooks) h.mesh.glow.material.opacity = h.occupant ? 0.5 + Math.sin(t * 4) * 0.2 : 0;
    // the player's faint light
    this.playerLight.position.set(view.pos.x, 2.2, view.pos.z);
    // viewmodel
    if (this.viewmodel) this.updateViewmodel(dt);
  }

  updateViewmodel(dt) {
    const k = this.killer, vm = this.viewmodel, arm = vm.userData.arm, base = vm.userData.base, br = vm.userData.baseRot;
    const t = this.time;
    const bob = k.speed > 0.5 ? Math.sin(t * 9) * 0.012 : Math.sin(t * 2) * 0.004;
    let px = base.x, py = base.y + bob, pz = base.z, rx = br.x, ry = br.y, rz = br.z;
    const pr = k.stateDur ? clamp(k.stateT / k.stateDur, 0, 1) : 0;
    if (k.state === 'lunge') { py += 0.12; rx += 0.5; rz -= 0.3; px += 0.05; }
    else if (k.state === 'recover' && k.stateT < 0.45) { const e = k.stateT / 0.45; px = lerp(base.x + 0.05, -0.2, e); py = base.y + 0.1 - e * 0.15; rx = br.x - 0.6 * e; rz = br.z + 0.9 * e; ry = br.y + 0.5 * e; }
    else if (k.state === 'kick' || k.state === 'break') { py -= 0.1 + Math.abs(Math.sin(pr * Math.PI * 6)) * 0.08; rx -= 0.6; }
    else if (k.state === 'stun' || k.state === 'blind') { py -= 0.2; rz += 0.4; }
    else if (k.carrying) { py -= 0.12; }
    else if (k.state === 'channel') { py += 0.05; rx += 0.3; }
    else if (k.state === 'chop') { py = base.y + 0.22 - pr * 0.4; rx = br.x + 1.2 - pr * 2.1; px = base.x - 0.05; }
    else if (k.power.kind === 'chop' && k.power.raising) { const c = k.power.charge; py += 0.22 * c + (c >= 1 ? Math.sin(t * 40) * 0.004 : 0); rx += 1.2 * c; px -= 0.05 * c; }
    arm.position.set(damp(arm.position.x, px, 18, dt), damp(arm.position.y, py, 18, dt), damp(arm.position.z, pz, 18, dt));
    arm.rotation.set(damp(arm.rotation.x, rx, 18, dt), damp(arm.rotation.y, ry, 18, dt), damp(arm.rotation.z, rz, 18, dt));
    vm.visible = k.state !== 'mori' && (!(k.phasing) || Math.random() < 0.3);
    if (vm.userData.exeMat) { vm.userData.exeMat.userData.uniforms.uTime.value = t; vm.userData.exeMat.userData.uniforms.uGlitch.value = k.rig.glitch; }
  }

  /* ---------------- camera ---------------- */

  updateCamera(dt) {
    const cam = this.camera;
    const c = this.cam;
    const P = this.player;
    const kk = this.killer;
    this.shake = Math.max(0, (this.shake || 0) - dt);
    if (kk.state === 'mori' && kk.stateData && (P.isKiller || P === kk.stateData.s || this.spectate === kk.stateData.s)) {
      // cinematic orbit around the killer and the victim
      const v = kk.stateData.s;
      const mx = (kk.pos.x + v.pos.x) / 2, mz = (kk.pos.z + v.pos.z) / 2;
      const p = kk.stateT / kk.stateDur;
      const ang = this.moriCam + p * 0.9;
      let r = 3.6 - p * 0.8;
      const f = this.world.rayBlock(mx, 1.6, mz, mx + Math.sin(ang) * r, 2.0, mz + Math.cos(ang) * r);
      r *= Math.max(0.35, f);
      const sh = this.shake * 0.25;
      cam.position.set(mx + Math.sin(ang) * r + (Math.random() - 0.5) * sh, 1.75 + (Math.random() - 0.5) * sh, mz + Math.cos(ang) * r);
      cam.lookAt(mx, 1.15, mz);
      return;
    }
    if (P.isKiller) {
      const k = this.killer;
      let eye = k.def.height * 0.93;
      if (k.state === 'pickup') eye -= 0.4 * Math.sin((k.stateT / k.stateDur) * Math.PI);
      if (k.state === 'kick' || k.state === 'break') eye -= 0.25;
      const shake = k.state === 'stun' ? (Math.random() - 0.5) * 0.05 : (Math.random() - 0.5) * (this.shake || 0) * 0.08;
      cam.position.set(k.pos.x + Math.sin(k.yaw) * 0.15, eye + (k.vault ? Math.sin(Math.min(1, k.vault.t) * Math.PI) * 0.4 : 0), k.pos.z + Math.cos(k.yaw) * 0.15);
      cam.rotation.set(c.pitch + shake, c.yaw + Math.PI, 0);
      const fovT = (this.ctx.settings.fov || 80) + (k.phasing ? 12 : 0) + (k.state === 'lunge' ? 6 : 0);
      if (Math.abs(cam.fov - fovT) > 0.1) { cam.fov = damp(cam.fov, fovT, 8, dt); cam.updateProjectionMatrix(); }
      return;
    }
    const s = this.spectate || P;
    let h = 1.55;
    if (s.crouch || (s.action && ['repair', 'heal', 'recover', 'selfheal', 'chest', 'unplug'].includes(s.action.type))) h = 1.1;
    if (s.state === 'dying') h = 0.7;
    if (s.state === 'hooked') h = 2.0;
    if (s.state === 'carried') h = 1.9;
    const pivot = new THREE.Vector3(s.state === 'carried' ? this.killer.pos.x : s.pos.x, h, s.state === 'carried' ? this.killer.pos.z : s.pos.z);
    c.smoothY = c.smoothY === undefined ? h : damp(c.smoothY, h, 6, dt);
    pivot.y = c.smoothY;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const fx = Math.sin(c.yaw) * cp, fy = sp, fz = Math.cos(c.yaw) * cp;
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    const shoulder = 0.55;
    const ax = pivot.x + rx * shoulder, az = pivot.z + rz * shoulder;
    const want = { x: ax - fx * c.dist, y: pivot.y - fy * c.dist + 0.25, z: az - fz * c.dist };
    const f = this.world.rayBlock(pivot.x, pivot.y, pivot.z, want.x, want.y, want.z);
    const ff = Math.max(0.15, f - 0.04);
    cam.position.set(pivot.x + (want.x - pivot.x) * ff, Math.max(0.3, pivot.y + (want.y - pivot.y) * ff), pivot.z + (want.z - pivot.z) * ff);
    cam.rotation.set(c.pitch, c.yaw + Math.PI, 0);
    if (Math.abs(cam.fov - (this.ctx.settings.fov || 80)) > 0.1) { cam.fov = this.ctx.settings.fov || 80; cam.updateProjectionMatrix(); }
  }

  /* ---------------- audio ---------------- */

  updateAudio(dt) {
    const a = this.audio;
    const P = this.player;
    const view = this.spectate || P;
    const k = this.killer;
    a.tickAmbience(dt);
    if (P.isSurvivor) {
      const d = this.dist(view, k);
      const tr = k.terror;
      const inten = view.alive ? clamp(1 - d / tr, 0, 1) : 0;
      a.heartbeat(inten, dt);
      a.chase(view.chased && view.alive, inten);
      this.terror = inten;
    } else {
      a.chase(!!k.chaseTarget, 1);
      this.terror = 0;
      if (k.has('whispers')) {
        this.whisperT -= dt;
        if (this.whisperT <= 0) {
          this.whisperT = 2.5 + Math.random() * 2;
          if (this.survivors.some((s) => s.alive && this.dist(s, k) < 32)) a.play('whisper', 1);
        }
      }
    }
    let hum = 0;
    for (const g of this.world.gens) {
      const d = Math.hypot(g.x - view.pos.x, g.z - view.pos.z);
      if (g.done) hum = Math.max(hum, a.falloff(d, 18) * 0.6);
      else if (g.progress > 0) hum = Math.max(hum, a.falloff(d, 16) * (0.3 + g.progress * 0.7) * (g.activeLevel ? 1 : 0.4));
    }
    a.hum(hum);
  }

  /* ---------------- results ---------------- */

  results() {
    const P = this.player;
    const off = this.offering;
    const mult = 1 + (off && off.marrowAll ? off.marrowAll : 0);
    const score = { ...P.score };
    if (off && off.marrowMain) {
      const main = P.isKiller ? 'savagery' : 'grit';
      score[main] = Math.min(CATEGORY_CAP, score[main] * (1 + off.marrowMain));
    }
    let total = 0;
    for (const k of Object.keys(score)) { score[k] = Math.round(score[k] * mult); total += score[k]; }
    return {
      role: P.isKiller ? 'killer' : 'survivor',
      map: this.mapDef.name,
      killer: this.killer.def.name,
      survivors: this.survivors.map((s) => ({ name: s.name, outcome: s.outcome || (s.alive ? 'left behind' : s.state), isPlayer: s.isPlayer })),
      score, total,
      kills: this.survivors.filter((s) => s.state === 'dead').length,
      escapes: this.survivors.filter((s) => s.state === 'escaped').length,
      gens: this.gensDone,
      playerOutcome: P.isKiller ? null : P.outcome || 'left early',
    };
  }

  dispose() {
    this.audio.stopAmbience();
    this.world.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export { HALF, GENS_NEEDED };
export const glowTex = glowSpriteTexture;
