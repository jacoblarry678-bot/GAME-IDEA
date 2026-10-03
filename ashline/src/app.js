/**
 * App: boot sequence, shared systems, screen flow and the main loop.
 * launch → menu → setup/loadout → match → results → play again / menu
 */
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { Settings } from './core/settings.js';
import { Profile } from './core/profile.js';
import { AudioEngine } from './audio/audio.js';
import { MaterialLibrary } from './world/textures.js';
import { MapBuilder } from './world/mapBuilder.js';
import { NavGrid } from './world/navgrid.js';
import { createSky } from './world/sky.js';
import { CINDER_YARD } from './world/maps/cinderYard.js';
import { weaponMaterials, buildWeapon } from './fx/weaponModels.js';
import { Viewmodel } from './fx/viewmodel.js';
import { Effects } from './fx/effects.js';
import { SoldierMaterials } from './entities/soldierModel.js';
import { Screens } from './ui/screens.js';
import { MenuNav } from './ui/nav.js';
import { Game } from './game/game.js';
import { WEAPONS } from './data/weapons.js';
import { PAD } from './core/input.js';
import { BotBrain } from './entities/bot.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.state = 'boot';
    this.game = null;
  }

  async boot(progress) {
    progress(0.05, 'Loading settings');
    this.settings = new Settings();
    this.profile = new Profile();
    this.applyTextScale();
    this.settings.onChange(() => this.applyTextScale());
    progress(0.1, 'Starting renderer');
    await nextFrame();
    this.engine = new Engine(this.canvas, this.settings);
    this.input = new Input(this.canvas, this.settings);
    this.audio = new AudioEngine(this.settings);
    progress(0.18, 'Generating materials');
    await nextFrame();
    const tq = this.settings.data.graphics.textures;
    this.materials = new MaterialLibrary(tq, Math.min(this.engine.maxAniso, tq === 'low' ? 2 : tq === 'medium' ? 4 : 8));
    this.wmats = weaponMaterials(this.materials);
    this.soldierMats = new SoldierMaterials(this.materials);
    progress(0.35, 'Building Cinder Yard');
    await nextFrame();
    await this.buildMap(CINDER_YARD, progress);
    progress(0.86, 'Preparing weapons');
    await nextFrame();
    this.viewmodel = new Viewmodel(this.engine, this.materials, this.wmats, this.settings);
    this.viewmodel.visible = false;
    for (const id of Object.keys(WEAPONS)) this.viewmodel.setWeapon(id); // warm models
    this.effects = new Effects(this.engine, this.settings, this.wmats);
    this.preview = new WeaponPreview(this);
    this.screens = new Screens(this);
    this.nav = new MenuNav(this);
    this.audio.captionCb = (text, who) => this.game?.hud.caption(text, who === 'announcer' ? 'HQ' : '');
    progress(0.94, 'Compiling shaders');
    await nextFrame();
    this.engine.renderer.compile(this.engine.scene, this.engine.camera);
    this.engine.render(false);
    progress(1, 'Ready');
    this.bindGlobal();
    this.toMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  applyTextScale() {
    document.documentElement.style.setProperty('--text-scale', this.settings.data.accessibility.textScale);
  }

  async buildMap(def, progress) {
    const b = new MapBuilder({ headless: false, materials: this.materials });
    def.build(b);
    progress(0.6, 'Merging geometry');
    await nextFrame();
    b.finish({ shadows: true });
    this.engine.scene.add(b.root);
    this.engine.setEnvironment(def);
    this.sky = createSky(def);
    this.engine.scene.add(this.sky);
    this.engine.bakeEnvironment(this.sky);
    for (const L of b.lights) {
      const l = new THREE.PointLight(L.color, L.intensity, L.distance, 2);
      l.position.set(L.x, L.y, L.z);
      this.engine.scene.add(l);
    }
    progress(0.75, 'Baking navigation');
    await nextFrame();
    const nav = new NavGrid(b.world, def.bounds, 1);
    this.mapRuntime = { def, world: b.world, nav, spawns: b.spawns, hotspots: b.hotspots, minimap: makeMinimap(def, b), root: b.root };
  }

  bindGlobal() {
    // audio needs a user gesture
    const unlock = () => {
      this.audio.init().then(() => { if (this.state === 'menu') this.audio.music(true); });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.input.on('lockchange', (locked) => {
      if (!locked && this.state === 'match-live' && !this.game?.ended) this.pauseMatch();
      this.updateLockHint();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'match-live' && !this.input.locked) {
        // pointer lock unavailable (embedded) → Esc pauses directly
        e.preventDefault();
        this.pauseMatch();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'match-live') this.pauseMatch();
    });
    this.input.on('device', () => {
      const h = document.getElementById('device-hint');
      if (h) h.textContent = this.input.device === 'pad' ? 'Controller detected — D-pad to navigate, A to select, B to go back.' : 'Mouse & keyboard. Controllers are supported.';
    });
  }

  // ---------------------------------------------------------------- flow
  toMenu() {
    if (this.game) { this.game.dispose(); this.game = null; }
    this.state = 'menu';
    this.input.enabled = false;
    this.input.lockWanted = false;
    this.input.exitLock();
    this.viewmodel.visible = false;
    this.removeLockHint();
    this.screens.show('main');
    if (this.audio.ready) this.audio.music(true);
    this.setMenuCamera('orbit');
  }

  startMatch() {
    const setup = { ...this.profile.data.matchSetup };
    this.screens.clear();
    if (this.game) { this.game.dispose(); this.game = null; }
    this.audio.init();
    this.audio.music(false);
    this.preview.hide();
    this.game = new Game(this, setup);
    this.game.start();
    this.state = 'match-live';
    this.input.enabled = true;
    this.input.lockWanted = true;
    this.input.requestLock();
    this.updateLockHint();
  }

  pauseMatch() {
    if (!this.game || this.state !== 'match-live') return;
    this.state = 'match-paused';
    this.game.setPaused(true);
    this.input.enabled = false;
    this.input.exitLock();
    this.removeLockHint();
    this.screens.show('pause');
  }

  resumeMatch() {
    if (!this.game) return;
    this.screens.clear();
    this.state = 'match-live';
    this.game.setPaused(false);
    this.input.enabled = true;
    this.input.requestLock();
    this.updateLockHint();
  }

  leaveMatch() { this.toMenu(); }

  /** Test hook: let the AI play the local player. */
  autopilot(on = true) { this.game?.debugAutopilot(on, BotBrain); }

  showResults(result) {
    this.state = 'results';
    this.input.enabled = false;
    this.input.exitLock();
    this.removeLockHint();
    this.screens.show('results', { result });
    this.lastResult = result;
  }

  updateLockHint() {
    this.removeLockHint();
    if (this.state !== 'match-live' || this.input.locked || !this.input.lockSupported()) return;
    if (performance.now() - this.input.lastLockFail < 60000) return; // fallback mode: mouse works unlocked
    const h = document.createElement('div');
    h.className = 'lock-hint';
    h.id = 'lock-hint';
    h.textContent = 'CLICK TO CAPTURE MOUSE';
    h.onclick = () => this.input.requestLock();
    document.getElementById('ui').appendChild(h);
  }

  removeLockHint() { document.getElementById('lock-hint')?.remove(); }

  // ---------------------------------------------------------------- menu camera
  setMenuCamera(kind) { this.menuCam = kind; }

  updateMenuCamera(dt) {
    const cam = this.engine.camera;
    this.menuT = (this.menuT || 0) + dt;
    const t = this.menuT;
    let pos, look;
    if (this.menuCam === 'overview') {
      pos = new THREE.Vector3(Math.sin(t * 0.03) * 20 - 10, 46, 52);
      look = new THREE.Vector3(0, 0, 0);
    } else if (this.menuCam === 'closeup') {
      pos = new THREE.Vector3(-8 + Math.sin(t * 0.08) * 1.5, 2.2, 12.5);
      look = new THREE.Vector3(2, 1.6, 4);
    } else {
      // slow flyover loop through the yard
      const a = t * 0.025;
      pos = new THREE.Vector3(Math.cos(a) * 30, 13 + Math.sin(t * 0.07) * 2, Math.sin(a) * 22);
      look = new THREE.Vector3(Math.cos(a + 1.4) * 8, 2.5, Math.sin(a + 1.4) * 6);
    }
    if (!this._camPos) { this._camPos = pos.clone(); this._camLook = look.clone(); }
    this._camPos.lerp(pos, Math.min(1, dt * 1.5));
    this._camLook.lerp(look, Math.min(1, dt * 1.5));
    cam.position.copy(this._camPos);
    cam.lookAt(this._camLook);
    this.engine.setZoom(1);
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.engine.shouldRender(now)) return;
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    this.engine.stat(now);
    this.input.poll();
    try {
      if (this.game) {
        // controller pause / resume
        if (this.input.pad && this.input.padPressed(PAD.START)) {
          if (this.state === 'match-live') this.pauseMatch(); else if (this.state === 'match-paused' && this.screens.top?.name === 'pause') this.resumeMatch();
        }
        this.game.update(dt);
      } else {
        this.updateMenuCamera(dt);
        this.effects.update(dt, { list: [] });
      }
      if (this.state !== 'match-live') this.nav.update(dt);
      this.preview.update(dt);
      if (this.sky) { this.sky.position.copy(this.engine.camera.position); this.sky.material.uniforms.time.value = now / 1000; }
      this.engine.render(true);
    } catch (err) {
      console.error(err);
      this.fatal = err;
    }
    this.input.endFrame();
  }
}

/** Rotating 3D weapon preview for the loadout screen (drawn in the viewmodel scene). */
class WeaponPreview {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.visible = false;
    app.engine.vmScene.add(this.group);
    this.models = new Map();
    this.cur = null;
    this.t = 0;
  }
  show(id) {
    if (!WEAPONS[id]) return;
    this.group.visible = true;
    if (this.cur === id) return;
    this.cur = id;
    for (const m of this.models.values()) m.visible = false;
    let m = this.models.get(id);
    if (!m) {
      m = buildWeapon(WEAPONS[id].model, this.app.wmats).group;
      this.models.set(id, m);
      this.group.add(m);
    }
    m.visible = true;
  }
  hide() { this.group.visible = false; this.cur = null; }
  update(dt) {
    if (!this.group.visible) return;
    this.t += dt;
    // place the weapon in the free area above the stats panel (right column)
    const aspect = this.app.engine.aspect;
    const halfW = Math.tan((26 * Math.PI) / 180) * 1.25 * aspect;
    const x = aspect > 1.2 ? halfW * 0.63 : 0;
    this.group.position.set(x, aspect > 1.2 ? 0.3 : 0.32, -1.25);
    this.group.rotation.set(0.1 + Math.sin(this.t * 0.6) * 0.04, Math.PI / 2 + Math.sin(this.t * 0.35) * 0.5, 0);
    this.group.scale.setScalar(Math.min(0.75, halfW * 0.55));
  }
}

/** Top-down minimap image from the map's collision footprint. */
function makeMinimap(def, b) {
  const B = def.bounds, pad = 4, scale = 5;
  const w = Math.round((B.maxX - B.minX + pad * 2) * scale), h = Math.round((B.maxZ - B.minZ + pad * 2) * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a3036';
  ctx.fillRect(0, 0, w, h);
  const X = (x) => (x - B.minX + pad) * scale, Y = (z) => (z - B.minZ + pad) * scale;
  // rail beds
  ctx.fillStyle = '#3a3a36';
  for (const tz of [-7, 7]) ctx.fillRect(X(-37), Y(tz - 1.7), 74 * scale, 3.4 * scale);
  // buildings / props sorted by height
  const rects = [...b.minimapRects].sort((p, q) => p.h - q.h);
  for (const r of rects) {
    const col = r.kind === 'wall' ? '#7d858c' : r.kind === 'container' ? '#59626a' : r.kind === 'low' ? '#4a535b' : r.h > 4 ? '#8a939b' : '#69737b';
    ctx.fillStyle = col;
    ctx.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * scale, (r.z1 - r.z0) * scale);
  }
  // spawn zones
  ctx.fillStyle = 'rgba(61,155,255,0.14)'; ctx.fillRect(X(-48), Y(-36), 13 * scale, 72 * scale);
  ctx.fillStyle = 'rgba(255,122,47,0.14)'; ctx.fillRect(X(35), Y(-36), 13 * scale, 72 * scale);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `bold ${Math.round(scale * 2.2)}px Arial`;
  ctx.textAlign = 'center';
  for (const l of b.labels) ctx.fillText(l.text, X(l.x), Y(l.z));
  return { img: c, scale, minX: B.minX, minZ: B.minZ, pad };
}
