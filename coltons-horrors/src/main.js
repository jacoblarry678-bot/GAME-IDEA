// Boot, render loop, and switching between the lobby and a match.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './ui/styles.css';
import { profile, saveProfile, consume, countOf, ownsPerk } from './core/profile.js';
import { SURVIVORS, KILLERS, SURVIVOR_PERKS, KILLER_PERKS, ITEMS, KILLER_ADDONS } from './data.js';
import { setTextureSize } from './world/textures.js';
import { clearPropMaterials } from './world/props.js';
import { Match } from './game/match.js';
import { SurvivorAI, KillerAI } from './game/ai.js';
import { Input } from './game/input.js';
import { HUD } from './ui/hud.js';
import { Lobby } from './ui/menu.js';
import { audio } from './audio/audio.js';
import { RNG } from './core/util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function quality() {
  const q = profile.settings.quality;
  if (q !== 'auto') return q;
  return isTouch ? 'low' : 'medium';
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality() !== 'low', powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ctx = {
  renderer, audio, settings: profile.settings, autoplay: params.has('autoplay'),
  aspect: () => canvas.clientWidth / Math.max(1, canvas.clientHeight),
  applyQuality,
};

function applyQuality() {
  const q = quality();
  const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  setTextureSize(q === 'low' ? 256 : 512);
  resize();
}

let composer = null;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  if (match) { match.camera.aspect = w / h; match.camera.updateProjectionMatrix(); }
  if (composer) composer.setSize(w, h);
}
window.addEventListener('resize', resize);

const input = new Input(canvas);
const hud = new HUD($('hud'));
const lobby = new Lobby($('lobby'), ctx);
let state = 'boot';
let match = null;
let paused = false;
let last = performance.now();
let fpsT = 0, fpsN = 0;

/* ---------------- overlays ---------------- */

function overlay(html) {
  const o = $('overlay');
  if (!html) { o.hidden = true; o.innerHTML = ''; return o; }
  o.hidden = false;
  o.innerHTML = html;
  return o;
}

function pauseMenu() {
  paused = true;
  if (match) match.paused = true;
  audio.chase(false);
  const o = overlay(`<div class="ov-card"><h2>Paused</h2>
    <p class="meta">${match.player.isKiller ? 'LMB attack · SPACE / E action · RMB / Q power' : 'WASD move · SHIFT run · C crouch · hold LMB / E use · SPACE vault, pallet, skill check · RMB / F item'}</p>
    <div class="ov-row"><button class="btn" id="ov-resume">Resume</button><button class="btn-ghost" id="ov-leave">Leave match</button></div></div>`);
  o.querySelector('#ov-resume').onclick = () => resume();
  o.querySelector('#ov-leave').onclick = () => endMatch();
}

function resume() {
  overlay(null);
  paused = false;
  if (match) match.paused = false;
  if (!isTouch && !ctx.autoplay) input.requestLock();
}

input.onUnlock = () => { if (state === 'match' && !paused && !match.over) pauseMenu(); };

/* ---------------- match setup ---------------- */

function buildSetup(rng) {
  const role = profile.role;
  const skill = { easy: 0.35, normal: 0.6, hard: 0.85 }[profile.settings.difficulty] || 0.6;
  const lo = profile.loadout[role];
  const others = rng.shuffle(SURVIVORS.filter((s) => s.id !== profile.survivor).slice());
  const randomPerks = (pool, n) => rng.shuffle(pool.map((p) => p.id)).slice(0, n);
  const survivors = [];
  if (role === 'survivor') {
    const item = lo.item && countOf(lo.item) ? { id: lo.item, addons: lo.addons.filter((a) => a && countOf(a)) } : null;
    if (item) { consume(item.id); item.addons.forEach((a) => consume(a)); }
    survivors.push({ id: profile.survivor, outfit: profile.equipped[profile.survivor], isPlayer: true, perks: lo.perks.filter((p) => p && ownsPerk(p)), item });
  }
  while (survivors.length < 4) {
    const def = others.shift() || rng.pick(SURVIVORS);
    survivors.push({
      id: def.id, outfit: rng.pick(def.outfits).id, isPlayer: false, skill: Math.min(0.95, skill + rng.range(-0.1, 0.1)),
      perks: randomPerks(SURVIVOR_PERKS, 3), item: rng.chance(0.6) ? { id: rng.pick(ITEMS).id, addons: [] } : null,
    });
  }
  let killerId, killerOutfit, killerPerks, killerAddons;
  if (role === 'killer') {
    killerId = profile.killer;
    killerOutfit = profile.equipped[killerId];
    killerPerks = lo.perks.filter((p) => p && ownsPerk(p));
    killerAddons = (lo.addons[killerId] || []).filter((a) => a && countOf(a));
    killerAddons.forEach((a) => consume(a));
  } else {
    killerId = profile.opponent === 'random' ? rng.pick(KILLERS).id : profile.opponent;
    const def = KILLERS.find((k) => k.id === killerId);
    killerOutfit = rng.pick(def.outfits).id;
    killerPerks = randomPerks(KILLER_PERKS, skill > 0.7 ? 4 : 3);
    killerAddons = rng.shuffle(KILLER_ADDONS.filter((a) => a.killer === killerId).map((a) => a.id)).slice(0, rng.int(0, 2));
  }
  let offering = lo.offering && countOf(lo.offering) ? lo.offering : null;
  if (offering) consume(offering);
  if (params.get('map')) offering = null;
  saveProfile();
  const killerMori = role !== 'killer' && rng.chance(skill > 0.7 ? 0.35 : 0.15);
  return {
    role, survivors, killerId, killerOutfit, killerPerks, killerAddons, killerSkill: skill, offering, killerMori,
    mapId: params.get('map') || null, seed: params.get('seed') ? +params.get('seed') : rng.int(1, 1e9), quality: quality(),
  };
}

function startMatch() {
  audio.start();
  audio.setVolume(profile.settings.volume, profile.settings.music);
  lobby.hide();
  state = 'loading';
  overlay('<div class="ov-card ov-load"><h2>Entering the night</h2><p class="meta">Building the map</p><div class="ov-spin"></div></div>');
  setTimeout(() => {
    try {
      clearPropMaterials();
      const setup = buildSetup(new RNG());
      match = new Match(ctx, setup);
      window.__match = match;
      if (ctx.autoplay) {
        if (match.player.isSurvivor) match.player.ai = new SurvivorAI(match, match.player, 0.7);
        else match.player.ai = new KillerAI(match, match.player, 0.7);
      }
      if (quality() === 'high') {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(match.scene, match.camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.55, 0.6, 0.82));
        composer.addPass(new OutputPass());
      } else composer = null;
      hud.mount(match);
      hud.onLeave = () => endMatch();
      $('hud').hidden = false;
      input.enabled = true;
      if (isTouch) input.buildTouch($('touch'), setup.role);
      resize();
      state = 'match';
      paused = false;
      if (isTouch || ctx.autoplay) overlay(null);
      else {
        paused = true;
        match.paused = true;
        const o = overlay(`<div class="ov-card"><h2>${match.mapDef.name}</h2><p class="meta">${match.mapDef.region}</p><p>${match.player.isKiller ? 'Hunt them down. Hook every survivor before they power the gates.' : `Repair 5 generators, open a gate, escape ${match.killer.def.name}.`}</p><button class="btn" id="ov-start">Click to begin</button></div>`);
        o.querySelector('#ov-start').onclick = () => resume();
      }
    } catch (e) {
      console.error(e);
      overlay(`<div class="ov-card"><h2>Something went wrong</h2><p class="meta">${String(e.message || e)}</p><button class="btn" id="ov-back">Back</button></div>`).querySelector('#ov-back').onclick = () => { overlay(null); toLobby(); };
    }
  }, 60);
}

function endMatch() {
  if (!match) return;
  const r = match.results();
  profile.marrow += r.total;
  const st = profile.stats;
  st.matches++;
  if (r.role === 'survivor') {
    if (r.playerOutcome && r.playerOutcome.startsWith('escaped')) st.escapes++;
    if (r.playerOutcome === 'sacrificed') st.sacrifices++;
    st.gens += r.gens;
  } else { st.kills += r.kills; st.hooks += match.survivors.reduce((a, s) => a + s.hooks, 0); }
  saveProfile();
  input.enabled = false;
  input.exitLock();
  $('touch').hidden = true;
  hud.unmount();
  $('hud').hidden = true;
  overlay(null);
  match.dispose();
  match = null;
  window.__match = null;
  composer = null;
  paused = false;
  lobby.results = r;
  toLobby();
}

function toLobby() {
  state = 'lobby';
  lobby.show();
}

/* ---------------- loop ---------------- */

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const speed = ctx.autoplay && params.get('speed') ? +params.get('speed') : 1;
  if (state === 'lobby') lobby.render(renderer, dt);
  else if (state === 'match' && match) {
    const inp = input.read();
    if (inp.escape && !paused) { pauseMenu(); input.exitLock(); }
    if (!paused) {
      for (let i = 0; i < speed; i++) match.update(dt, ctx.autoplay ? null : inp);
      if (ctx.autoplay && match.player.isKiller) { match.cam.yaw = match.killer.yaw; }
    }
    if (composer) composer.render(); else renderer.render(match.scene, match.camera);
    hud.update(dt);
    if (match.over && match.overT > 4) endMatch();
    else if (match.player.isKiller === false && !match.player.alive && !match.spectate && match.overT === 0) match.onPlayerOut();
  }
  if (profile.settings.showFps) {
    fpsT += dt; fpsN++;
    if (fpsT > 0.5) { $('fps').hidden = false; $('fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
  } else $('fps').hidden = true;
}

/* ---------------- boot ---------------- */

if (params.get('role')) profile.role = params.get('role');
if (params.get('killer')) { if (profile.role === 'killer') profile.killer = params.get('killer'); else profile.opponent = params.get('killer'); }
if (params.get('q')) profile.settings.quality = params.get('q');
applyQuality();
lobby.onPlay = () => startMatch();
window.__ch = { lobby, startMatch, endMatch, get state() { return state; }, profile, get lobbyResults() { return lobby.results; } };
setTimeout(() => {
  $('boot').classList.add('done');
  setTimeout(() => $('boot').remove(), 900);
  toLobby();
  if (params.has('autostart') || ctx.autoplay) startMatch();
}, 300);
requestAnimationFrame(frame);
