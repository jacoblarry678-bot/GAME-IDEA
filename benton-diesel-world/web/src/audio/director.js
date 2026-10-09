// Park sound director: land music that crossfades as you walk, ambience
// (crowd, birds, crickets, water, steam, campfires), ride and show sounds
// placed in 3D, UI sounds and the park announcer.
import * as THREE from 'three';
import { Engine, setPos } from './engine.js';
import * as I from './instruments.js';
import { Theme, THEMES, SOURCES } from './music.js';

const PREFS_KEY = 'bentonDieselWorld.sound';
const tmp = new THREE.Vector3();

function loadPrefs() {
  const base = { sound: true, music: 0.7, effects: 0.85, voice: true };
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') || {}) };
  } catch (e) {
    return base;
  }
}

// ------------------------------------------------------------- announcer
class Announcer {
  constructor() {
    this.enabled = true;
    this.synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
    this.voice = null;
    this.last = '';
    this.lastAt = 0;
    const pick = () => {
      if (!this.synth) return;
      const voices = this.synth.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
      const prefer = ['Google US English', 'Samantha', 'Daniel', 'Alex', 'Microsoft Guy', 'Microsoft Aria', 'Karen'];
      this.voice = voices.find((v) => prefer.some((p) => v.name.includes(p))) || voices[0] || null;
    };
    try {
      pick();
      if (this.synth) this.synth.onvoiceschanged = pick;
    } catch (e) {
      this.synth = null;
    }
  }

  say(text, { interrupt = false, volume = 1 } = {}) {
    if (!this.enabled || !this.synth || !text) return;
    const now = performance.now();
    if (text === this.last && now - this.lastAt < 8000) return;
    this.last = text;
    this.lastAt = now;
    try {
      if (interrupt) this.synth.cancel();
      else if (this.synth.speaking || this.synth.pending) return;
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = 1.04;
      u.pitch = 0.95;
      u.volume = volume;
      this.synth.speak(u);
    } catch (e) {
      /* speech not available */
    }
  }

  stop() {
    try { this.synth?.cancel(); } catch (e) { /* ignore */ }
  }
}

// ------------------------------------------------------------ ride sounds
class RideSound {
  constructor(A, ride, cfg, vis) {
    this.A = A;
    this.ride = ride;
    this.cfg = cfg;
    this.vis = vis;
    this.kind = ride.kind;
    const p = ride.cars[0]?.pivot || ride.origin;
    this.station = new THREE.Vector3(p[0], p[1] + 3, p[2]);
    this.origin = new THREE.Vector3(ride.origin[0], ride.origin[1], ride.origin[2]);
    this.pos = this.station.clone();
    this.prev = this.station.clone();
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.on = false;
    this.cool = 0;
    this.status = 'Open';
    this.pulse = 0;
    this.extraPrevAngle = null;
  }

  carPos(i, out) {
    const car = this.vis.cars[i] || this.vis.cars[0];
    return out.setFromMatrixPosition(car.matrix);
  }

  ensure() {
    if (this.on) return;
    const A = this.A, E = A.E, ctx = E.ctx;
    this.on = true;
    this.src = E.source3d(this.pos, { ref: 14, rolloff: 1.15, reverb: 0.1 });
    this.stationSrc = E.source3d(this.station, { ref: 12, rolloff: 1.2 });
    // continuous body sound: filtered noise whose level follows the speed
    const buf = this.kind === 'train' || this.kind === 'tram' ? E.brownBuf : E.pinkBuf;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;
    this.lp = E.filter(this.kind === 'flume' ? 'bandpass' : 'lowpass', 300, this.kind === 'flume' ? 0.6 : 0.8);
    this.body = ctx.createGain();
    this.body.gain.value = 0;
    this.noise.connect(this.lp);
    this.lp.connect(this.body);
    this.body.connect(this.src.input);
    this.noise.start();
    // engines for karts, trucks, the tram and the drop tower motor
    if (['karts', 'trucks', 'tram', 'droptower', 'spinner'].includes(this.kind)) {
      this.eng = E.osc(this.kind === 'trucks' ? 'square' : 'sawtooth', 50, E.now);
      this.eng2 = E.osc('sawtooth', 75, E.now);
      this.engLp = E.filter('lowpass', this.kind === 'karts' ? 900 : 380, 1.2);
      this.engGain = ctx.createGain();
      this.engGain.gain.value = 0;
      this.eng.connect(this.engLp);
      this.eng2.connect(this.engLp);
      this.engLp.connect(this.engGain);
      this.engGain.connect(this.src.input);
      this.eng.start();
      this.eng2.start();
      if (this.kind === 'karts') {
        // a second kart engine further back in the pack
        this.src2 = E.source3d(this.pos, { ref: 12, rolloff: 1.2, reverb: 0.05 });
        this.eng3 = E.osc('sawtooth', 70, E.now);
        this.eng3Gain = ctx.createGain();
        this.eng3Gain.gain.value = 0;
        const lp = E.filter('lowpass', 1000, 1.2);
        this.eng3.connect(lp);
        lp.connect(this.eng3Gain);
        this.eng3Gain.connect(this.src2.input);
        this.eng3.start();
      }
    }
    if (this.kind === 'carousel') this.organ = new Theme(E, SOURCES.Carousel, this.src.input, 7);
  }

  release() {
    if (!this.on) return;
    this.on = false;
    const stop = (n) => { try { n?.stop(); } catch (e) { /* already stopped */ } };
    stop(this.noise); stop(this.eng); stop(this.eng2); stop(this.eng3);
    for (const s of [this.src, this.src2, this.stationSrc]) { try { s?.panner.disconnect(); } catch (e) { /* ignore */ } }
    this.organ?.stop();
    this.organ = null;
  }

  scream(t, n = 3, base = 77) {
    const E = this.A.E;
    for (let i = 0; i < n; i++) {
      const m = base + Math.floor(Math.random() * 6) - 2;
      I.voice(E, this.src.input, t + i * 0.09 + Math.random() * 0.12, m, 1.1 + Math.random() * 0.6, 0.035, Math.random() < 0.5 ? 'a' : 'e', 0.82);
    }
  }

  // status transitions: boarding bell, dispatch sounds
  onStatus(status) {
    if (!this.on) return;
    const E = this.A.E, t = E.now, st = this.stationSrc.input;
    if (status === 'Boarding') {
      I.bell(E, st, t, 84, 0.07);
      I.bell(E, st, t + 0.35, 84, 0.07);
    } else if (status === 'Running') {
      E.hiss(st, t, 0.7, 0.12, 'highpass', 2500, 0.6);
      if (this.kind === 'train') {
        for (const m of [72, 76, 79]) I.voice(E, st, t + 0.1, m, 1.3, 0.03, 'oo');
        E.hiss(st, t + 0.1, 1.3, 0.06, 'bandpass', 2400, 1.5);
      } else if (this.kind === 'tram') {
        for (const f of [330, 415]) E.blip(st, t + 0.05, f, 0.7, 0.05, 'sawtooth');
      } else if (this.kind === 'trucks') {
        E.blip(st, t, 620, 0.16, 0.06, 'square');
        E.blip(st, t + 0.22, 620, 0.16, 0.06, 'square');
      } else if (this.kind === 'karts') {
        for (let k = 0; k < 3; k++) E.blip(st, t + k * 0.5, k < 2 ? 660 : 990, 0.3, 0.05, 'square');
      }
    }
  }

  update(dt, listener, status, rideT) {
    const dist = this.station.distanceTo(listener);
    const near = Math.min(dist, this.pos.distanceTo(listener));
    if (near > 300) {
      this.release();
      this.status = status;
      return;
    }
    this.ensure();
    if (status !== this.status) {
      this.onStatus(status);
      this.status = status;
    }
    const E = this.A.E, t = E.now;
    // where is the vehicle and how fast is it going?
    this.prev.copy(this.pos);
    this.carPos(0, this.pos);
    if (this.kind === 'droptower' || this.kind === 'carousel' || this.kind === 'spinner' || this.kind === 'pendulum') {
      // flat rides: the gondola / platform
    }
    // real elapsed time, so speeds stay right when frames are slow
    const nowMs = performance.now();
    const realDt = this.lastMs ? Math.max(0.001, (nowMs - this.lastMs) / 1000) : dt;
    this.lastMs = nowMs;
    const d = realDt > 0 ? tmp.copy(this.pos).sub(this.prev).divideScalar(realDt) : tmp.set(0, 0, 0);
    if (d.length() > 400) d.set(0, 0, 0); // the train jumped back to the station
    this.vel.lerp(d, Math.min(1, dt * 8));
    this.speed = this.vel.length();
    setPos(this.src.panner, this.pos.x, this.pos.y, this.pos.z);
    this.cool -= dt;
    const running = status === 'Running';
    const sp = this.speed;
    const k = this.kind;
    let body = 0, cutoff = 300;
    if (k === 'coaster') {
      body = Math.min(0.5, sp / 90);
      cutoff = 180 + sp * 22;
      // chain lift clatter
      if (running && sp > 2 && sp < 16 && this.vel.y > 1) {
        this.pulse += dt * 9;
        while (this.pulse > 1) {
          this.pulse -= 1;
          E.hiss(this.src.input, t, 0.03, 0.1, 'bandpass', 1800, 2);
        }
      }
      if (running && sp > 40 && this.vel.y < -14 && this.cool <= 0) {
        this.scream(t, 4);
        this.cool = 5.5;
      }
    } else if (k === 'flume') {
      body = Math.min(0.3, 0.05 + sp / 120);
      cutoff = 700 + sp * 20;
      if (running && this.lastSpeed > 30 && sp < this.lastSpeed - 8 && this.pos.y < 8 && this.cool <= 0) {
        E.hiss(this.src.input, t, 1.4, 0.4, 'lowpass', 2400, 0.5);
        E.boom(this.src.input, t, 0.15, 0.6);
        this.scream(t, 2, 79);
        this.cool = 4;
      }
    } else if (k === 'train') {
      body = Math.min(0.2, sp / 80);
      cutoff = 220;
      if (running && sp > 1) {
        this.pulse += dt * (sp / 5);
        while (this.pulse > 1) {
          this.pulse -= 1;
          E.hiss(this.src.input, t, 0.18, 0.14, 'bandpass', 700, 0.8);
        }
      }
    } else if (k === 'tram' || k === 'trucks') {
      body = Math.min(0.12, sp / 120);
      cutoff = 250;
    } else if (k === 'droptower') {
      const vy = this.vel.y;
      body = Math.min(0.5, Math.abs(vy) / 70);
      cutoff = 300 + Math.abs(vy) * 30;
      if (running && vy < -25 && this.cool <= 0) {
        this.scream(t, 5, 80);
        this.cool = 6;
      }
      if (running && this.lastVy < -20 && vy > -8 && this.pos.y < 30) E.hiss(this.src.input, t, 1, 0.25, 'highpass', 1800, 0.7);
      this.lastVy = vy;
    } else if (k === 'pendulum') {
      body = Math.min(0.5, sp / 70);
      cutoff = 400 + sp * 25;
      if (running && sp > 45 && this.cool <= 0 && this.pos.y > 30) {
        this.scream(t, 5, 79);
        this.cool = 6.4;
      }
    } else if (k === 'spinner') {
      body = Math.min(0.1, sp / 120);
      cutoff = 600;
      if (running && sp > 12 && this.cool <= 0) {
        I.voice(E, this.src.input, t, 76, 0.9, 0.03, 'e', 1.25);
        this.cool = 6 + Math.random() * 4;
      }
    } else if (k === 'karts') {
      body = 0.02;
    } else if (k === 'carousel') {
      body = 0;
      if (running && !this.organ.running) this.organ.start(t);
      if (!running && this.organ.running) this.organ.stop();
      this.organ.pump(0.2);
    }
    this.lastSpeed = sp;
    this.body.gain.setTargetAtTime(running || sp > 1 ? body : 0, t, 0.08);
    this.lp.frequency.setTargetAtTime(Math.min(8000, cutoff), t, 0.08);
    if (this.eng) {
      const idle = status === 'Boarding' ? 0.04 : 0;
      const g = k === 'karts' ? (running ? 0.07 : idle) : k === 'droptower' ? (running && this.vel.y > 3 ? 0.06 : 0) : k === 'spinner' ? (running ? 0.03 : 0) : (running ? 0.05 : idle);
      const f = k === 'karts' ? 55 + sp * 2.6 : k === 'trucks' ? 28 + sp * 1.4 : k === 'droptower' ? 90 + this.vel.y * 6 : k === 'spinner' ? 38 + sp : 42 + sp * 0.8;
      this.engGain.gain.setTargetAtTime(g, t, 0.1);
      this.eng.frequency.setTargetAtTime(f, t, 0.08);
      this.eng2.frequency.setTargetAtTime(f * 1.5, t, 0.08);
      if (this.eng3) {
        this.carPos(Math.min(4, this.vis.cars.length - 1), tmp);
        setPos(this.src2.panner, tmp.x, tmp.y, tmp.z);
        this.eng3.frequency.setTargetAtTime(f * 0.93, t, 0.1);
        this.eng3Gain.gain.setTargetAtTime(g * 0.8, t, 0.1);
      }
    }
  }
}

// ------------------------------------------------------------------ director
export class GameAudio {
  constructor(data) {
    this.data = data;
    this.E = new Engine();
    this.prefs = loadPrefs();
    this.voice = new Announcer();
    this.voice.enabled = this.prefs.voice;
    this.started = false;
    this.land = null;
    this.themes = new Map();
    this.rides = [];
    this.loops = [];
    this.birdTimer = 2;
    this.chatterTimer = 1;
    this.steamTimers = [];
    this.stepPhase = 0;
    this.showState = new Map();
    this.listener = new THREE.Vector3();
  }

  savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch (e) { /* ignore */ }
  }

  // must be called from a click / tap
  start(rideVis) {
    this.rideVis = rideVis;
    if (!this.prefs.sound) return false;
    if (!this.E.start()) return false;
    if (!this.started) this.build();
    this.applyPrefs();
    return true;
  }

  build() {
    const E = this.E, ctx = E.ctx;
    this.started = true;
    // land music: one gain per theme -> night filter -> music bus
    this.musicFilter = E.filter('lowpass', 18000, 0.5);
    this.musicDuck = ctx.createGain();
    this.musicFilter.connect(this.musicDuck);
    this.musicDuck.connect(E.music);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.25;
    this.musicDuck.connect(musicSend);
    musicSend.connect(E.reverbSend);
    let seed = 11;
    for (const [id, def] of Object.entries(THEMES)) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicFilter);
      this.themes.set(id, { theme: new Theme(E, def, g, seed++), gain: g, stopAt: 0 });
    }
    // crowd murmur
    const crowd = ctx.createBufferSource();
    crowd.buffer = E.pinkBuf;
    crowd.loop = true;
    const cf = E.filter('bandpass', 700, 0.6);
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    crowd.connect(cf);
    cf.connect(this.crowdGain);
    this.crowdGain.connect(E.ambience);
    crowd.start();
    // crickets at night
    this.crickets = ctx.createGain();
    this.crickets.gain.value = 0;
    this.crickets.connect(E.ambience);
    for (const [f, rate] of [[4400, 24], [4900, 29]]) {
      const o = E.osc('sine', f, E.now);
      const am = ctx.createGain();
      am.gain.value = 0;
      const lfo = E.osc('square', rate, E.now);
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(am.gain);
      const slow = E.osc('square', 0.7 + Math.random() * 0.4, E.now);
      const sg = ctx.createGain();
      sg.gain.value = 0.5;
      slow.connect(sg);
      const gate = ctx.createGain();
      gate.gain.value = 0.5;
      sg.connect(gate.gain);
      o.connect(am);
      am.connect(gate);
      gate.connect(this.crickets);
      o.start(); lfo.start(); slow.start();
    }
    // water and fire loops placed in the world
    const loop = (pos, buf, type, freq, q, gain, ref, mod = 0) => {
      const src = E.source3d(pos, { ref, rolloff: 1.3, bus: E.ambience, reverb: 0.05 });
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = E.filter(type, freq, q);
      const g = ctx.createGain();
      g.gain.value = gain;
      s.connect(f);
      f.connect(g);
      g.connect(src.input);
      if (mod) {
        const lfo = E.osc('sine', mod, E.now);
        const lg = ctx.createGain();
        lg.gain.value = gain * 0.6;
        lfo.connect(lg);
        lg.connect(g.gain);
        lfo.start();
      }
      s.start(E.now, Math.random());
      this.loops.push(src);
      return src;
    };
    loop(new THREE.Vector3(0, 6, -60), E.noiseBuf, 'highpass', 1400, 0.5, 0.18, 14);
    const lake = this.data.terrain.find((t) => t.kind === 'cylinder' && t.material === 'Water');
    if (lake) loop(new THREE.Vector3(lake.cf[0], 0, lake.cf[2]), E.brownBuf, 'lowpass', 500, 0.7, 0.35, 45, 0.18);
    for (const p of [[-300, 18, -394], [-252, 14, -396]]) loop(new THREE.Vector3(...p), E.noiseBuf, 'lowpass', 2600, 0.5, 0.22, 16);
    for (const c of this.data.tags.Campfire || []) {
      loop(new THREE.Vector3(c[0], c[1], c[2]), E.brownBuf, 'lowpass', 320, 0.7, 0.25, 8);
      this.steamTimers.push({ kind: 'crackle', pos: new THREE.Vector3(c[0], c[1], c[2]), t: 0 });
    }
    for (const c of this.data.tags.SteamVent || []) this.steamTimers.push({ kind: 'steam', pos: new THREE.Vector3(c[0], c[1], c[2]), t: Math.random() * 5 });
    this.fxSrc = E.source3d(new THREE.Vector3(), { ref: 30, rolloff: 0.8, reverb: 0.3 });
    // rides
    for (const r of this.data.rides) {
      const cfg = this.data.config.Rides.find((c) => c.id === r.id);
      this.rides.push(new RideSound(this, r, cfg, this.rideVis.get(r.id)));
    }
    this.pumpTimer = setInterval(() => this.pump(), 40);
  }

  applyPrefs() {
    const E = this.E;
    this.voice.enabled = this.prefs.voice && this.prefs.sound;
    if (!E.ctx) return;
    const t = E.now;
    E.master.gain.setTargetAtTime(this.prefs.sound ? 0.9 : 0, t, 0.05);
    E.music.gain.setTargetAtTime(0.55 * this.prefs.music, t, 0.05);
    for (const b of [E.sfx, E.ambience, E.ui]) b.gain.setTargetAtTime((b === E.ui ? 0.6 : b === E.sfx ? 0.9 : 0.7) * this.prefs.effects, t, 0.05);
    if (this.prefs.sound && E.ctx.state === 'suspended') E.ctx.resume();
    if (!this.prefs.sound) this.voice.stop();
  }

  setPref(key, value) {
    this.prefs[key] = value;
    this.savePrefs();
    if (key === 'sound' && value && !this.started) this.start(this.rideVis);
    this.applyPrefs();
  }

  // scheduler tick (also runs when the tab's frame rate drops)
  pump() {
    if (!this.started || this.E.ctx.state !== 'running') return;
    for (const { theme } of this.themes.values()) theme.pump(0.25);
    for (const s of this.showState.values()) s.theme?.pump(0.25);
    for (const r of this.rides) r.organ?.pump(0.25);
  }

  setLand(id) {
    if (!this.started || id === this.land || !this.themes.has(id)) return;
    const t = this.E.now;
    const old = this.themes.get(this.land);
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, 0.8);
      old.stopAt = t + 3.5;
    }
    const next = this.themes.get(id);
    if (!next.theme.running) next.theme.start(t);
    next.stopAt = 0;
    next.gain.gain.setTargetAtTime(1, t, 0.9);
    this.land = id;
  }

  // ---------------------------------------------------------------- frame
  update(s) {
    if (!this.started || !this.E.ctx || this.E.ctx.state !== 'running') return;
    const E = this.E, t = E.now, dt = s.dt;
    E.setListener(s.camera);
    this.listener.setFromMatrixPosition(s.camera.matrixWorld);
    if (s.land) this.setLand(s.land);
    for (const [id, th] of this.themes) if (th.stopAt && t > th.stopAt && id !== this.land) { th.theme.stop(); th.stopAt = 0; }
    // music: softer and darker at night, ducked on rides and near shows
    const night = 1 - s.daylight;
    this.musicFilter.frequency.setTargetAtTime(18000 - night * 15000, t, 0.5);
    let duck = s.riding ? 0.35 : 1;
    for (const st of this.showState.values()) duck = Math.min(duck, st.duck ?? 1);
    this.musicDuck.gain.setTargetAtTime(duck * (1 - night * 0.35), t, 0.4);
    // crowd and night ambience
    this.crowdGain.gain.setTargetAtTime(0.05 * Math.min(1.2, s.crowd) * (s.inPark ? 1 : 0.4), t, 0.5);
    this.crickets.gain.setTargetAtTime(night > 0.6 ? 0.008 : 0, t, 1);
    this.chatterTimer -= dt;
    if (this.chatterTimer <= 0) {
      this.chatterTimer = 0.25 + Math.random() * (1.4 - Math.min(1, s.crowd));
      const f = [600, 900, 1200, 1700][Math.floor(Math.random() * 4)];
      const p = E.ctx.createStereoPanner ? E.ctx.createStereoPanner() : null;
      const dest = p ? p : E.ambience;
      if (p) { p.pan.value = Math.random() * 2 - 1; p.connect(E.ambience); }
      E.hiss(dest, t, 0.12 + Math.random() * 0.2, 0.012 * Math.min(1, s.crowd), 'bandpass', f, 5);
    }
    // birds by day in the green lands
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 1.5 + Math.random() * 4;
      if (s.daylight > 0.6 && ['Backwoods', 'Family', 'Haulers', 'Plaza'].includes(s.land)) this.bird();
    }
    // steam hisses and campfire crackles
    for (const v of this.steamTimers) {
      if (v.pos.distanceToSquared(this.listener) > 120 * 120) continue;
      v.t -= dt;
      if (v.t > 0) continue;
      setPos(this.fxSrc.panner, v.pos.x, v.pos.y, v.pos.z);
      if (v.kind === 'steam') {
        v.t = 3 + Math.random() * 5;
        this.oneShotAt(v.pos, (dest) => E.hiss(dest, t, 1.4, 0.16, 'highpass', 3000, 0.6));
      } else {
        v.t = 0.05 + Math.random() * 0.25;
        this.oneShotAt(v.pos, (dest) => E.hiss(dest, t, 0.015, 0.25, 'bandpass', 2500 + Math.random() * 2000, 3));
      }
    }
    // rides
    for (const r of this.rides) {
      const st = s.sim.rides.get(r.ride.id);
      r.update(dt, this.listener, st.status, s.sim.rideTime(r.ride.id, s.now));
    }
    this.updateShows(s);
    this.footsteps(s);
  }

  // short one-shot at a world position (uses a pooled panner)
  oneShotAt(pos, fn, ref = 12) {
    this.pool = this.pool || [];
    let src = this.pool.find((p) => this.E.now > p.busyUntil);
    if (!src) {
      if (this.pool.length >= 10) src = this.pool[0];
      else {
        src = this.E.source3d(pos, { ref, rolloff: 1.2 });
        this.pool.push(src);
      }
    }
    src.busyUntil = this.E.now + 2;
    src.panner.refDistance = ref;
    setPos(src.panner, pos.x, pos.y, pos.z);
    if (src.panner.positionX) {
      src.panner.positionX.value = pos.x;
      src.panner.positionY.value = pos.y;
      src.panner.positionZ.value = pos.z;
    }
    fn(src.input);
  }

  bird() {
    const E = this.E, t = E.now;
    const p = E.ctx.createStereoPanner ? E.ctx.createStereoPanner() : null;
    const dest = p || E.ambience;
    if (p) { p.pan.value = Math.random() * 1.6 - 0.8; p.connect(E.ambience); }
    const base = 2400 + Math.random() * 2200;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) E.blip(dest, t + i * (0.09 + Math.random() * 0.05), base * (0.9 + Math.random() * 0.25), 0.07, 0.02, 'sine', 1.3 + Math.random() * 0.4);
  }

  footsteps(s) {
    if (!s.walking) return;
    this.stepPhase += s.dt * s.stepRate;
    if (this.stepPhase < 1) return;
    this.stepPhase -= 1;
    const E = this.E, t = E.now;
    const soft = s.land === 'Backwoods' || s.land === 'Family';
    E.hiss(E.sfx, t, 0.05, soft ? 0.035 : 0.045, 'bandpass', soft ? 700 : 1600 + Math.random() * 500, 1.2);
  }

  // ----------------------------------------------------------------- shows
  updateShows(s) {
    const E = this.E, t = E.now;
    for (const show of s.sim.shows) {
      let st = this.showState.get(show.id);
      const showT = s.now - show.start;
      if (show.running && showT >= 0) {
        if (!st) {
          st = { theme: null, src: null, duck: 1, said: new Set(), applause: false };
          this.showState.set(show.id, st);
          const center = new THREE.Vector3(show.center[0], 8, show.center[2]);
          if (show.id === 'BigDreams') {
            st.src = E.source3d(center, { ref: 30, rolloff: 1, reverb: 0.25 });
            st.theme = new Theme(E, SOURCES.ShowSong, st.src.input, 23);
            st.theme.start(t);
          } else if (show.id === 'BigRigParade') {
            st.src = E.source3d(center, { ref: 24, rolloff: 1, reverb: 0.2 });
            st.theme = new Theme(E, SOURCES.Parade, st.src.input, 31);
            st.theme.start(t);
          }
          const d = Math.hypot(this.listener.x - show.viewing[0], this.listener.z - show.viewing[2]);
          if (show.id === 'BentonNights' || show.id === 'BigRigParade' || d < show.viewRadius * 2.5) {
            this.voice.say(`Ladies and gentlemen, ${show.name} is starting now at ${show.venue}!`, { interrupt: true });
          }
        }
        const d = Math.hypot(this.listener.x - show.viewing[0], this.listener.z - show.viewing[2]);
        st.duck = show.id === 'BentonNights' ? 0.6 : Math.min(1, Math.max(0.15, (d - show.viewRadius * 0.5) / (show.viewRadius * 1.5)));
        if (st.src && s.showPos?.[show.id]) {
          const p = s.showPos[show.id];
          setPos(st.src.panner, p.x, p.y + 4, p.z);
        }
        if (show.id === 'BigDreams' && showT > show.duration - 4 && !st.applause) {
          st.applause = true;
          st.theme?.stop();
          this.applause(new THREE.Vector3(show.viewing[0], 3, show.viewing[2]), 3.5);
        }
        // the stunt show and parade announcer reads the captions out loud
        if (s.caption && s.caption.show === show.name && !st.said.has(s.caption.text) && show.id !== 'BigDreams') {
          st.said.add(s.caption.text);
          if (d < show.viewRadius * 1.6) this.voice.say(s.caption.text.replace(/\.\.\./g, ', '), { interrupt: true });
        }
      } else if (st) {
        st.theme?.stop();
        if (st.src) setTimeout(() => { try { st.src.panner.disconnect(); } catch (e) { /* ignore */ } }, 4000);
        this.showState.delete(show.id);
      }
    }
  }

  applause(pos, seconds) {
    const E = this.E, t = E.now;
    this.oneShotAt(pos, (dest) => {
      for (let i = 0; i < seconds * 24; i++) {
        const at = t + Math.random() * seconds;
        E.hiss(dest, at, 0.03, 0.08 * (1 - (at - t) / seconds * 0.6), 'bandpass', 1200 + Math.random() * 1500, 1.4);
      }
      E.hiss(dest, t, seconds, 0.06, 'bandpass', 1500, 0.4);
    }, 30);
  }

  cheer(pos) {
    const E = this.E, t = E.now;
    this.oneShotAt(pos, (dest) => {
      E.hiss(dest, t, 1.8, 0.14, 'bandpass', 900, 0.7);
      for (let i = 0; i < 6; i++) I.voice(E, dest, t + Math.random() * 0.4, 70 + Math.floor(Math.random() * 10), 1, 0.02, 'e', 1.1);
    }, 30);
  }

  // ------------------------------------------------------- effects hooks
  explosion(pos, size = 1) {
    if (!this.started) return;
    const d = pos.distanceTo(this.listener);
    const delay = d * 0.0009; // sound arrives a little later than the flash
    this.oneShotAt(pos, (dest) => this.E.boom(dest, this.E.now + delay, 0.5 * size, 1.1), 40);
    if (this.showState.has('StuntSpectacular')) setTimeout(() => this.cheer(new THREE.Vector3(70, 5, -205)), 900);
  }

  launch(pos) {
    if (!this.started) return;
    this.oneShotAt(pos, (dest) => this.E.blip(dest, this.E.now, 900, 1.1, 0.04, 'sine', 2.4), 40);
  }

  firework(pos, size = 1) {
    if (!this.started) return;
    const E = this.E;
    const d = pos.distanceTo(this.listener);
    const t = E.now + d * 0.0009;
    this.oneShotAt(pos, (dest) => {
      E.boom(dest, t, 0.4 * size, 1.4);
      for (let i = 0; i < 9; i++) E.hiss(dest, t + 0.3 + Math.random() * 1.2, 0.02, 0.1, 'highpass', 4000, 1);
    }, 80);
  }

  // -------------------------------------------------------------- UI cues
  // toasts make a sound unless a more specific cue just played
  toastSound(kind) {
    if (!this.started || this.E.now - (this.lastCue || 0) < 0.3) return;
    this.ui(kind === 'reward' ? 'reward' : kind === 'warn' ? 'warn' : kind === 'show' ? 'show' : 'info');
  }

  ui(kind, extra) {
    if (!this.started) return;
    const E = this.E, t = E.now, out = E.ui;
    if (kind !== 'click' && kind !== 'latch') this.lastCue = t;
    switch (kind) {
      case 'click': E.blip(out, t, 1300, 0.05, 0.05, 'sine', 0.8); break;
      case 'open': E.blip(out, t, 660, 0.08, 0.05, 'triangle'); E.blip(out, t + 0.06, 990, 0.1, 0.04, 'triangle'); break;
      case 'close': E.blip(out, t, 880, 0.08, 0.04, 'triangle'); E.blip(out, t + 0.06, 600, 0.1, 0.035, 'triangle'); break;
      case 'info': E.blip(out, t, 880, 0.12, 0.04, 'sine'); break;
      case 'warn': E.blip(out, t, 220, 0.14, 0.06, 'square'); E.blip(out, t + 0.16, 196, 0.18, 0.05, 'square'); break;
      case 'reward':
        I.bell(E, out, t, 95, 0.06);
        I.bell(E, out, t + 0.09, 100, 0.07);
        for (let i = 0; i < 5; i++) E.blip(out, t + 0.12 + i * 0.03, 3000 + i * 400, 0.05, 0.012, 'sine');
        break;
      case 'buy':
        I.bell(E, out, t, 96, 0.08);
        E.hiss(out, t + 0.05, 0.18, 0.06, 'highpass', 4000, 0.7);
        I.bell(E, out, t + 0.12, 103, 0.05);
        break;
      case 'show': [67, 72, 76, 79].forEach((m, i) => I.brass(E, out, t + i * 0.11, m, 0.18, 0.05)); break;
      case 'join': I.glock(E, out, t, 84, 0.07); I.glock(E, out, t + 0.12, 88, 0.06); break;
      case 'express': [79, 83, 86, 91, 95].forEach((m, i) => I.glock(E, out, t + i * 0.06, m, 0.05)); break;
      case 'stamp': E.boom(out, t, 0.12, 0.25); I.bell(E, out, t + 0.05, 91, 0.06); break;
      case 'eat':
        for (let i = 0; i < 3; i++) E.hiss(out, t + i * 0.09, 0.05, 0.08, 'lowpass', 1800, 0.8);
        break;
      case 'drink': {
        const h = E.hiss(out, t, 0.5, 0.06, 'bandpass', 500, 4);
        h.f.frequency.exponentialRampToValueAtTime(1800, t + 0.45);
        break;
      }
      case 'jump': {
        const h = E.hiss(out, t, 0.22, 0.05, 'bandpass', 600, 2);
        h.f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
        break;
      }
      case 'land': E.blip(out, t, 120, 0.12, 0.08, 'sine', 0.6); break;
      case 'latch': E.blip(out, t, 190, 0.04, 0.07, 'square', 0.5); E.blip(out, t + 0.045, 130, 0.07, 0.06, 'square', 0.5); break;
      case 'fanfare': [72, 76, 79, 84].forEach((m, i) => I.brass(E, out, t + i * 0.13, m, i === 3 ? 0.6 : 0.16, 0.06)); break;
      default: break;
    }
    void extra;
  }
}
