/**
 * Audio: pure Web Audio synthesis. Mix channels are Master, Dialogue,
 * Threat cues, Environment and Music (plus UI). Three persistent ambience
 * layers (room tone, mechanical activity, distant uncertain movement); threat
 * cues sit above them and are never ducked by dialogue. Sounds with a
 * position go through PannerNodes for real 3D audio. An optional compressor
 * reduces loud peaks without suppressing quiet clues.
 */

const NOISE_SECONDS = 2;

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.buffers = new Map();
    this.ambience = null;
    this.musicCue = null;
    this.loops = new Map();
    this.listener = { x: 0, y: 1.6, z: 0, yaw: 0 };
    settings.onChange(() => this.applyVolumes());
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -20; this.comp.ratio.value = 4; this.comp.knee.value = 12;
    this.bus = {};
    for (const b of ['dialogue', 'threat', 'environment', 'music', 'ui']) { this.bus[b] = c.createGain(); this.bus[b].connect(this.master); }
    this.envDuck = c.createGain(); this.envDuck.connect(this.bus.environment);
    this.master.connect(c.destination);
    this.noise = this._noiseBuffer();
    this.ready = true;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ready) return;
    const a = this.settings.data.audio;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.05);
    this.bus.dialogue.gain.setTargetAtTime(a.dialogue, t, 0.05);
    this.bus.threat.gain.setTargetAtTime(a.threat, t, 0.05);
    this.bus.environment.gain.setTargetAtTime(a.environment, t, 0.05);
    this.bus.music.gain.setTargetAtTime(a.music * 0.8, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(0.6, t, 0.05);
    try { this.master.disconnect(); } catch { /* */ }
    if (a.compressed) { this.master.connect(this.comp); this.comp.connect(this.ctx.destination); } else this.master.connect(this.ctx.destination);
  }

  _noiseBuffer() {
    const c = this.ctx, n = c.sampleRate * NOISE_SECONDS;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  setListener(x, y, z, yaw) {
    this.listener = { x, y, z, yaw };
    if (!this.ready) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, t, 0.02); L.positionY.setTargetAtTime(y, t, 0.02); L.positionZ.setTargetAtTime(z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(0, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  /** Output node for a voice: panned if a position is given. */
  _out(bus, pos, gain = 1) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = gain;
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.5; p.maxDistance = 60; p.rolloffFactor = 1.2;
      p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y ?? 1, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y ?? 1, pos.z);
      g.connect(p); p.connect(this.bus[bus]);
    } else g.connect(this.bus[bus]);
    return g;
  }

  _noise(out, t0, dur, { type = 'bandpass', f = 1000, q = 1, f2 = null, a = 0.005, gain = 0.5, rate = 1 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = q;
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(flt); flt.connect(g); g.connect(out);
    if (dur > NOISE_SECONDS - 0.2) s.loop = true;
    s.start(t0, Math.random() * Math.max(0, NOISE_SECONDS - dur - 0.1)); s.stop(t0 + dur + 0.05);
  }

  _tone(out, t0, dur, { f = 440, f2 = null, type = 'sine', a = 0.005, gain = 0.3, r = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (r || dur));
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + (r || dur) + 0.05);
  }

  /** Play a named one-shot. opts: { x,y,z } for spatial, gain, surface ... */
  play(name, opts = {}) {
    if (!this.ready) return;
    const fn = SFX[name];
    if (!fn) return;
    const t = this.ctx.currentTime + (opts.delay || 0);
    const pos = opts.x !== undefined ? { x: opts.x, y: opts.y ?? 1.2, z: opts.z } : null;
    const bus = opts.bus || SFX_BUS[name] || 'environment';
    const out = this._out(bus, pos, opts.gain ?? 1);
    fn(this, out, t, opts);
  }

  // ---------------------------------------------------------------- loops
  /** Start/stop a named continuous loop (clock tick, charger hum, decoy...). */
  loop(id, name, on, opts = {}) {
    if (!this.ready) return;
    const cur = this.loops.get(id);
    if (!on) { if (cur) { cur.stop(); this.loops.delete(id); } return; }
    if (cur) { if (opts.x !== undefined && cur.move) cur.move(opts); return; }
    const L = LOOPS[name];
    if (!L) return;
    const pos = opts.x !== undefined ? { x: opts.x, y: opts.y ?? 1.2, z: opts.z } : null;
    const out = this._out(opts.bus || 'environment', pos, opts.gain ?? 1);
    const h = L(this, out, opts);
    this.loops.set(id, h);
  }

  // ---------------------------------------------------------------- ambience
  setAmbience(kit) {
    if (!this.ready || this.ambienceKit === kit) return;
    this.ambienceKit = kit;
    if (this.ambience) this.ambience.stop();
    this.ambience = ambienceFor(this, kit);
  }

  /** Dialogue voice: a murmur shaped like speech. Radio lines go through a band-limited, crackling channel. */
  voice(sp, src, text, dur) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const out = this._out('dialogue', null, 1);
    const radio = src === 'radio' || src === 'speaker' || src === 'replay' || src === 'intercom' || src === 'recording';
    const base = VOICE_PITCH[sp] || 160;
    let chain = out;
    if (radio) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9; bp.connect(out); chain = bp;
      this._noise(out, t0, Math.min(dur, 6), { type: 'highpass', f: 2500, gain: 0.025, a: 0.02 });
    }
    // ducking environment (never threat cues)
    this.envDuck.gain.setTargetAtTime(0.6, c.currentTime, 0.1);
    this.envDuck.gain.setTargetAtTime(1, c.currentTime + dur, 0.3);
    const syll = Math.max(2, Math.round(String(text).length / 4.5));
    const span = Math.min(dur * 0.9, syll * 0.16);
    for (let i = 0; i < syll; i++) {
      const ts = t0 + (i / syll) * span + Math.random() * 0.02;
      const d = 0.08 + Math.random() * 0.06;
      const f = base * (0.9 + Math.random() * 0.25) * (i === syll - 1 ? 0.85 : 1);
      this._tone(chain, ts, d, { f, type: 'sawtooth', gain: 0.04, a: 0.015 });
      this._noise(chain, ts, d * 0.8, { type: 'bandpass', f: f * 6, q: 2, gain: 0.03 });
      if (src === 'replay') this._tone(chain, ts + 0.03, d, { f: f * 1.01, type: 'sawtooth', gain: 0.03, a: 0.015 });
    }
    if (this.settings.data.audio.speech && typeof speechSynthesis !== 'undefined') {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = { lena: 1.25, june: 1.2, mara: 1.15, jo: 1.1, rook: 1.0, operator: 0.85, evan: 0.9, luis: 1.0 }[sp] || 1;
        u.rate = sp === 'operator' ? 0.92 : 1.0;
        u.volume = this.settings.data.audio.dialogue * this.settings.data.audio.master;
        speechSynthesis.speak(u);
      } catch { /* no voices */ }
    }
  }

  // ---------------------------------------------------------------- music
  music(cue) {
    if (!this.ready) return;
    if (this.musicCue && this.musicCue.name === cue) return;
    if (this.musicCue) this.musicCue.stop();
    this.musicCue = cue ? startCue(this, cue) : null;
  }

  heartbeat(level) {
    if (!this.ready) return;
    this.loop('heart', 'heartbeat', level > 0.05, { bus: 'threat', gain: level });
    const h = this.loops.get('heart'); if (h && h.level) h.level(level);
  }

  stopAll() {
    for (const [id] of this.loops) this.loop(id, null, false);
    if (this.ambience) { this.ambience.stop(); this.ambience = null; this.ambienceKit = null; }
    if (this.musicCue) { this.musicCue.stop(); this.musicCue = null; }
  }
}

const VOICE_PITCH = { evan: 115, mara: 190, luis: 135, jo: 205, lena: 210, june: 175, rook: 185, operator: 100 };

const SFX_BUS = {
  extraStep: 'threat', wallTap: 'threat', ventShake: 'threat', listenerHiss: 'threat', doorBang: 'threat', doorRattle: 'threat', lockerRattle: 'threat',
  shutterWarn: 'threat', paperRub: 'threat', wake: 'threat', knock3: 'threat', handleTurn: 'threat', scrape: 'threat', toolClick: 'threat', floorDent: 'threat', stinger: 'threat',
  click: 'ui', uiMove: 'ui', uiOk: 'ui', save: 'ui', verified: 'ui', hint: 'ui',
};

// ------------------------------------------------------------------ one-shots
const SFX = {
  step(A, out, t, o) {
    const s = o.surface || 'carpet';
    const k = o.sprint ? 1.3 : o.crouch ? 0.4 : 0.8;
    if (s === 'carpet') A._noise(out, t, 0.09, { type: 'lowpass', f: 500, gain: 0.25 * k });
    else if (s === 'tile' || s === 'pooltile' || s === 'whitetile' || s === 'terrazzo') { A._noise(out, t, 0.05, { type: 'highpass', f: 2200, gain: 0.25 * k }); A._noise(out, t, 0.08, { type: 'lowpass', f: 700, gain: 0.15 * k }); }
    else if (s === 'metal' || s === 'grate') { A._noise(out, t, 0.07, { type: 'bandpass', f: 1800, q: 4, gain: 0.3 * k }); A._tone(out, t, 0.18, { f: 520 + Math.random() * 80, type: 'triangle', gain: 0.05 * k }); }
    else if (s === 'water') { A._noise(out, t, 0.25, { type: 'bandpass', f: 900, f2: 300, q: 1.2, gain: 0.35 * k, a: 0.02 }); }
    else if (s === 'wood') { A._noise(out, t, 0.08, { type: 'bandpass', f: 600, q: 2, gain: 0.3 * k }); A._tone(out, t, 0.08, { f: 180, gain: 0.06 * k }); }
    else A._noise(out, t, 0.07, { type: 'bandpass', f: 900, q: 1.2, gain: 0.3 * k });
  },
  doorOpen(A, out, t) { A._tone(out, t, 0.9, { f: 180, f2: 240, type: 'sawtooth', gain: 0.02, a: 0.2 }); A._noise(out, t, 0.06, { f: 2500, gain: 0.12 }); },
  doorClose(A, out, t) { A._noise(out, t, 0.12, { type: 'lowpass', f: 300, gain: 0.3 }); A._noise(out, t + 0.05, 0.03, { f: 3000, gain: 0.15 }); },
  doorFast(A, out, t) { A._noise(out, t, 0.25, { type: 'lowpass', f: 600, gain: 0.5 }); A._tone(out, t, 0.3, { f: 90, gain: 0.25 }); },
  doorSlam(A, out, t) { A._noise(out, t, 0.3, { type: 'lowpass', f: 400, gain: 0.7 }); A._tone(out, t, 0.35, { f: 70, gain: 0.35 }); },
  doorBang(A, out, t) { SFX.doorSlam(A, out, t); A._noise(out, t + 0.05, 0.4, { type: 'bandpass', f: 1200, q: 3, gain: 0.2 }); },
  doorRattle(A, out, t) { for (let i = 0; i < 6; i++) A._noise(out, t + i * 0.09, 0.05, { type: 'bandpass', f: 2200, q: 5, gain: 0.25 }); },
  lockerRattle(A, out, t) { for (let i = 0; i < 10; i++) A._noise(out, t + i * 0.12, 0.06, { type: 'bandpass', f: 1600 + (i % 2) * 400, q: 6, gain: 0.3 }); },
  lockedHandle(A, out, t) { A._noise(out, t, 0.05, { type: 'bandpass', f: 1800, q: 6, gain: 0.25 }); A._noise(out, t + 0.12, 0.05, { type: 'bandpass', f: 1700, q: 6, gain: 0.2 }); },
  unlock(A, out, t) { A._noise(out, t, 0.04, { type: 'bandpass', f: 3000, q: 8, gain: 0.3 }); A._noise(out, t + 0.1, 0.06, { type: 'bandpass', f: 1200, q: 4, gain: 0.25 }); },
  shutter(A, out, t) { A._noise(out, t, 0.03, { type: 'highpass', f: 3000, gain: 0.6 }); A._noise(out, t + 0.04, 0.05, { type: 'bandpass', f: 1500, q: 3, gain: 0.35 }); for (let i = 0; i < 8; i++) A._noise(out, t + 0.25 + i * 0.07, 0.03, { type: 'bandpass', f: 2600, q: 8, gain: 0.12 }); A._tone(out, t + 0.3, 0.8, { f: 520, f2: 480, type: 'square', gain: 0.012, a: 0.05 }); },
  flashPop(A, out, t) { A._tone(out, t - 0.3, 0.3, { f: 2000, f2: 7000, type: 'sine', gain: 0.02, a: 0.25 }); A._noise(out, t, 0.08, { type: 'highpass', f: 1500, gain: 0.5 }); },
  eject(A, out, t) { A._tone(out, t, 0.6, { f: 300, f2: 340, type: 'square', gain: 0.015, a: 0.05 }); },
  pickup(A, out, t) { A._noise(out, t, 0.08, { type: 'bandpass', f: 2000, q: 2, gain: 0.2 }); },
  cabinet(A, out, t) { A._noise(out, t, 0.15, { type: 'bandpass', f: 900, q: 3, gain: 0.3 }); },
  charger(A, out, t) { A._tone(out, t, 1.2, { f: 120, type: 'sawtooth', gain: 0.03, a: 0.1 }); A._tone(out, t + 0.6, 0.15, { f: 1200, gain: 0.06 }); },
  battery(A, out, t) { A._noise(out, t, 0.03, { type: 'bandpass', f: 3000, q: 10, gain: 0.3 }); A._noise(out, t + 0.3, 0.04, { type: 'bandpass', f: 2200, q: 10, gain: 0.3 }); },
  filmLoad(A, out, t) { A._noise(out, t, 0.2, { type: 'bandpass', f: 1500, q: 2, gain: 0.2 }); A._noise(out, t + 0.6, 0.04, { type: 'bandpass', f: 3000, q: 6, gain: 0.3 }); },
  flashClick(A, out, t) { A._noise(out, t, 0.02, { type: 'bandpass', f: 4000, q: 6, gain: 0.3 }); },
  click(A, out, t) { A._noise(out, t, 0.02, { type: 'bandpass', f: 3500, q: 4, gain: 0.25 }); },
  trip(A, out, t) { A._noise(out, t, 0.03, { type: 'bandpass', f: 2500, q: 6, gain: 0.25 }); A._tone(out, t + 0.05, 0.4, { f: 90, f2: 40, gain: 0.08 }); },
  leverClunk(A, out, t) { A._noise(out, t, 0.12, { type: 'lowpass', f: 500, gain: 0.5 }); A._noise(out, t, 0.04, { type: 'bandpass', f: 2000, q: 4, gain: 0.2 }); },
  switchOn(A, out, t) { A._noise(out, t, 0.03, { type: 'bandpass', f: 2200, q: 5, gain: 0.35 }); A._tone(out, t + 0.03, 0.5, { f: 60, gain: 0.05 }); },
  tone(A, out, t) { A._tone(out, t, 0.25, { f: 880, gain: 0.08 }); },
  toneBad(A, out, t) { A._tone(out, t, 0.4, { f: 220, type: 'square', gain: 0.04 }); },
  authFail(A, out, t) { A._tone(out, t, 0.6, { f: 160, type: 'square', gain: 0.05 }); A._tone(out, t + 0.1, 0.5, { f: 168, type: 'square', gain: 0.04 }); },
  fault(A, out, t) { A._noise(out, t, 0.03, { type: 'bandpass', f: 1800, q: 6, gain: 0.3 }); },
  success(A, out, t) { A._tone(out, t, 0.4, { f: 660, gain: 0.07 }); A._tone(out, t + 0.15, 0.6, { f: 990, gain: 0.06 }); },
  relayClick(A, out, t) { A._noise(out, t, 0.04, { type: 'bandpass', f: 1200, q: 8, gain: 0.4 }); A._tone(out, t, 0.3, { f: 50, gain: 0.1 }); },
  channelClose(A, out, t) { A._noise(out, t, 0.25, { type: 'highpass', f: 2000, gain: 0.08 }); A._tone(out, t + 0.2, 0.15, { f: 1000, gain: 0.05 }); },
  radioClick(A, out, t) { A._noise(out, t, 0.05, { type: 'highpass', f: 2500, gain: 0.15 }); },
  gateWheel(A, out, t) { for (let i = 0; i < 5; i++) A._noise(out, t + i * 0.35, 0.3, { type: 'bandpass', f: 400 + i * 30, q: 3, gain: 0.3, a: 0.05 }); A._tone(out, t + 1.6, 1.2, { f: 55, gain: 0.2, a: 0.1 }); },
  liftHum(A, out, t) { A._tone(out, t, 7, { f: 70, type: 'sawtooth', gain: 0.04, a: 0.6 }); A._tone(out, t + 7, 0.8, { f: 1046, gain: 0.05 }); },
  extraStep(A, out, t) { SFX.step(A, out, t, { surface: 'carpet' }); },
  wallTap(A, out, t) { for (let i = 0; i < 6; i++) A._noise(out, t + i * 0.33, 0.04, { type: 'bandpass', f: 700, q: 6, gain: 0.45 }); },
  ventShake(A, out, t) { for (let i = 0; i < 14; i++) A._noise(out, t + i * 0.05, 0.04, { type: 'bandpass', f: 2600 + Math.random() * 600, q: 8, gain: 0.2 }); },
  listenerHiss(A, out, t) { A._noise(out, t, 1.2, { type: 'bandpass', f: 3000, f2: 1800, q: 4, gain: 0.08, a: 0.3 }); },
  drawerSqueak(A, out, t) { A._tone(out, t, 0.35, { f: 1400, f2: 1900, type: 'triangle', gain: 0.05, a: 0.05 }); A._noise(out, t, 0.2, { type: 'bandpass', f: 800, q: 2, gain: 0.15 }); },
  paperJam(A, out, t) { for (let i = 0; i < 5; i++) A._noise(out, t + i * 0.08, 0.06, { type: 'bandpass', f: 1200, q: 2, gain: 0.12 }); A._tone(out, t + 0.5, 0.4, { f: 440, type: 'square', gain: 0.02 }); },
  tubeBuzz(A, out, t) { A._tone(out, t, 1.6, { f: 120, type: 'sawtooth', gain: 0.03, a: 0.05 }); A._noise(out, t + 0.6, 0.05, { type: 'highpass', f: 3000, gain: 0.2 }); },
  distantDoor(A, out, t) { A._noise(out, t, 0.4, { type: 'lowpass', f: 250, gain: 0.25 }); },
  pipeKnock(A, out, t) { for (let i = 0; i < 3; i++) A._tone(out, t + i * 0.4, 0.4, { f: 210, type: 'triangle', gain: 0.08 }); },
  stationStart(A, out, t) { A._tone(out, t, 1.5, { f: 300, f2: 900, type: 'square', gain: 0.015, a: 0.2 }); },
  stationDone(A, out, t) { for (let i = 0; i < 12; i++) A._noise(out, t + i * 0.06, 0.04, { type: 'bandpass', f: 2400, q: 6, gain: 0.15 }); },
  hit(A, out, t) { A._noise(out, t, 0.25, { type: 'lowpass', f: 700, gain: 0.7 }); A._tone(out, t, 0.3, { f: 80, f2: 40, gain: 0.3 }); },
  stinger(A, out, t, o) { const g = o.soft ? 0.03 : 0.08; A._tone(out, t, 1.5, { f: 233, type: 'sawtooth', gain: g, a: 0.01 }); A._tone(out, t, 1.5, { f: 247, type: 'sawtooth', gain: g, a: 0.01 }); },
  verified(A, out, t) { A._tone(out, t, 0.5, { f: 587, gain: 0.05 }); A._tone(out, t + 0.12, 0.7, { f: 880, gain: 0.04 }); },
  save(A, out, t) { A._tone(out, t, 0.3, { f: 740, gain: 0.04 }); },
  hint(A, out, t) { A._tone(out, t, 0.3, { f: 520, gain: 0.04 }); },
  uiMove(A, out, t) { A._noise(out, t, 0.015, { type: 'bandpass', f: 4000, q: 4, gain: 0.08 }); },
  uiOk(A, out, t) { A._tone(out, t, 0.12, { f: 660, gain: 0.05 }); },
  decoyWind(A, out, t) { for (let i = 0; i < 8; i++) A._noise(out, t + i * 0.07, 0.03, { type: 'bandpass', f: 3200, q: 8, gain: 0.25 }); },
  breathe(A, out, t) { A._noise(out, t, 1.6, { type: 'bandpass', f: 600, q: 0.8, gain: 0.08, a: 0.6 }); A._noise(out, t + 2.2, 2.0, { type: 'bandpass', f: 500, q: 0.8, gain: 0.06, a: 0.4 }); },
  voicemail(A, out, t) { A._tone(out, t, 0.2, { f: 1000, gain: 0.05 }); },
  knock3(A, out, t) { for (let i = 0; i < 3; i++) A._noise(out, t + i * 0.32, 0.08, { type: 'lowpass', f: 400, gain: 0.6 }); },
  heal(A, out, t) { A._noise(out, t, 0.6, { type: 'bandpass', f: 1200, q: 1, gain: 0.08, a: 0.2 }); },
  shutterWarn(A, out, t) { for (let i = 0; i < 3; i++) A._tone(out, t + i * 1.0, 0.45, { f: 740, type: 'square', gain: 0.045 }); A._noise(out, t + 3, 1.2, { type: 'bandpass', f: 600, q: 1, gain: 0.25, a: 0.1 }); },
  paperRub(A, out, t) { A._noise(out, t, 0.35, { type: 'bandpass', f: 2600, q: 1.5, gain: 0.12, a: 0.05 }); },
  wake(A, out, t) { A._noise(out, t, 1.4, { type: 'bandpass', f: 700, f2: 350, q: 1, gain: 0.35, a: 0.3 }); },
  handleTurn(A, out, t) { A._noise(out, t, 0.6, { type: 'bandpass', f: 1500, q: 6, gain: 0.25, a: 0.2 }); A._noise(out, t + 0.6, 0.05, { type: 'bandpass', f: 2500, q: 8, gain: 0.3 }); },
  scrape(A, out, t) { A._noise(out, t, 2.8, { type: 'bandpass', f: 400, f2: 900, q: 2, gain: 0.35, a: 0.4 }); A._tone(out, t, 2.8, { f: 90, f2: 70, type: 'sawtooth', gain: 0.03, a: 0.4 }); },
  toolClick(A, out, t) { for (let i = 0; i < 3; i++) { A._tone(out, t + i * 0.25, 0.35, { f: 1750 + i * 40, type: 'triangle', gain: 0.07 }); A._noise(out, t + i * 0.25, 0.03, { type: 'bandpass', f: 4000, q: 8, gain: 0.2 }); } },
  floorDent(A, out, t) { for (let i = 0; i < 3; i++) { A._tone(out, t + i, 0.4, { f: 60, f2: 35, gain: 0.3 }); A._noise(out, t + i, 0.12, { type: 'lowpass', f: 300, gain: 0.3 }); } },
  pressHit(A, out, t) { A._noise(out, t, 0.4, { type: 'lowpass', f: 500, gain: 0.8 }); A._tone(out, t, 0.5, { f: 55, gain: 0.4 }); },
  ventBlast(A, out, t) { A._noise(out, t, 3, { type: 'highpass', f: 800, gain: 0.5, a: 0.1 }); },
  splash(A, out, t) { A._noise(out, t, 0.5, { type: 'bandpass', f: 1200, f2: 400, q: 1, gain: 0.4 }); },
  crack(A, out, t) { for (let i = 0; i < 5; i++) A._noise(out, t + i * 0.3 + Math.random() * 0.1, 0.05, { type: 'highpass', f: 3000, gain: 0.4 }); },
  pump(A, out, t) { A._tone(out, t, 8, { f: 50, type: 'sawtooth', gain: 0.06, a: 1 }); A._noise(out, t + 1, 7, { type: 'lowpass', f: 400, gain: 0.15, a: 1 }); },
  death(A, out, t) { A._tone(out, t, 3, { f: 65, f2: 40, type: 'sawtooth', gain: 0.12, a: 0.05 }); A._noise(out, t, 2.5, { type: 'lowpass', f: 300, gain: 0.3, a: 0.05 }); },
};

// ------------------------------------------------------------------ loops
const LOOPS = {
  clock(A, out) {
    let alive = true, n = 0;
    const tick = () => { if (!alive) return; const t = A.ctx.currentTime; A._noise(out, t, 0.02, { type: 'bandpass', f: n++ % 2 ? 3200 : 2800, q: 8, gain: 0.12 }); setTimeout(tick, 1000); };
    tick();
    return { stop: () => { alive = false; } };
  },
  chargerHum(A, out) {
    const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = A.ctx.createGain(); g.gain.value = 0.012;
    o.connect(f); f.connect(g); g.connect(out); o.start();
    return { stop: () => { g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.1); o.stop(A.ctx.currentTime + 0.5); } };
  },
  decoy(A, out) {
    let alive = true;
    const ring = () => { if (!alive) return; const t = A.ctx.currentTime; for (let i = 0; i < 4; i++) A._tone(out, t + i * 0.09, 0.08, { f: 2093, type: 'square', gain: 0.03 }); setTimeout(ring, 420); };
    ring();
    return { stop: () => { alive = false; } };
  },
  heartbeat(A, out) {
    let alive = true, level = 0.3;
    const beat = () => {
      if (!alive) return;
      const t = A.ctx.currentTime;
      A._tone(out, t, 0.18, { f: 55, f2: 40, gain: 0.25 * level });
      A._tone(out, t + 0.22, 0.15, { f: 50, f2: 38, gain: 0.18 * level });
      setTimeout(beat, 1000 - level * 450);
    };
    beat();
    return { stop: () => { alive = false; }, level: (v) => { level = v; } };
  },
  wake(A, out) {
    const s = A.ctx.createBufferSource(); s.buffer = A.noise; s.loop = true;
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1;
    const g = A.ctx.createGain(); g.gain.value = 0.12;
    s.connect(f); f.connect(g); g.connect(out); s.start();
    return { stop: () => { g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2); s.stop(A.ctx.currentTime + 1); } };
  },
  machine(A, out, opts) {
    const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = opts.f || 45;
    const lfo = A.ctx.createOscillator(); lfo.frequency.value = opts.rate || 3; const lg = A.ctx.createGain(); lg.gain.value = 0.02; lfo.connect(lg);
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = A.ctx.createGain(); g.gain.value = 0.05; lg.connect(g.gain);
    o.connect(f); f.connect(g); g.connect(out); o.start(); lfo.start();
    return { stop: () => { g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.2); o.stop(A.ctx.currentTime + 1); lfo.stop(A.ctx.currentTime + 1); } };
  },
};

// ------------------------------------------------------------------ ambience
function ambienceFor(A, kit) {
  const c = A.ctx;
  const out = A.envDuck;
  const nodes = [];
  const cfg = {
    office: { hum: 120, humGain: 0.012, noise: 300, ng: 0.02, mech: 0.6 },
    annex: { hum: 60, humGain: 0.01, noise: 200, ng: 0.02, mech: 0.4 },
    mall: { hum: 100, humGain: 0.006, noise: 500, ng: 0.015, mech: 0.3 },
    pool: { hum: 80, humGain: 0.004, noise: 1200, ng: 0.02, mech: 0.2, drips: true },
    apartments: { hum: 60, humGain: 0.006, noise: 250, ng: 0.015, mech: 0.3 },
    industrial: { hum: 45, humGain: 0.02, noise: 180, ng: 0.03, mech: 1.0 },
    core: { hum: 55, humGain: 0.015, noise: 220, ng: 0.025, mech: 0.6 },
    menu: { hum: 120, humGain: 0.008, noise: 300, ng: 0.012, mech: 0.1 },
  }[kit] || { hum: 120, humGain: 0.01, noise: 300, ng: 0.02, mech: 0.5 };
  // layer 1: room tone (fluorescent hum + air)
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = cfg.hum;
  const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = cfg.hum * 3;
  const og = c.createGain(); og.gain.value = cfg.humGain;
  o.connect(of); of.connect(og); og.connect(out); o.start();
  const n = c.createBufferSource(); n.buffer = A.noise; n.loop = true;
  const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = cfg.noise;
  const ng = c.createGain(); ng.gain.value = cfg.ng;
  n.connect(nf); nf.connect(ng); ng.connect(out); n.start();
  nodes.push(o, n);
  // layers 2 and 3: mechanical activity and distant uncertain movement, scheduled sparsely
  let alive = true;
  const sched = () => {
    if (!alive) return;
    const t = c.currentTime + 0.1;
    const r = Math.random();
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(out);
    if (r < cfg.mech * 0.5) A._tone(pan, t, 2.5, { f: 40 + Math.random() * 20, type: 'sawtooth', gain: 0.02, a: 0.8 });
    else if (r < 0.7) A._noise(pan, t, 0.15, { type: 'lowpass', f: 300, gain: 0.05 });
    else if (cfg.drips) A._tone(pan, t, 0.15, { f: 1200 + Math.random() * 800, f2: 600, gain: 0.03 });
    else A._noise(pan, t, 0.06, { type: 'bandpass', f: 900, q: 2, gain: 0.03 });
    setTimeout(sched, 3000 + Math.random() * 9000);
  };
  setTimeout(sched, 2000);
  return { stop: () => { alive = false; const t = c.currentTime; og.gain.setTargetAtTime(0, t, 0.3); ng.gain.setTargetAtTime(0, t, 0.3); o.stop(t + 1.5); n.stop(t + 1.5); } };
}

// ------------------------------------------------------------------ music cues
/** Twelve cues; sparse generative arrangements built from a root, scale and texture. */
export const CUES = {
  titleDesk: { root: 57, scale: [0, 3, 7, 10, 14], tempo: 0.18, pad: true, piano: 0.35 },
  wrongCorridor: { root: 50, scale: [0, 1, 5, 7], tempo: 0.1, pad: true, piano: 0.12, drone: 38 },
  testTones: { root: 62, scale: [0, 5, 7, 12], tempo: 0.25, piano: 0.4, tones: true },
  closingRotation: { root: 55, scale: [0, 4, 7, 11], tempo: 0.2, pad: true, piano: 0.25 },
  beneathTheTiles: { root: 52, scale: [0, 2, 3, 7, 9], tempo: 0.14, pad: true, piano: 0.2, drone: 40 },
  upstairsNeighbor: { root: 53, scale: [0, 3, 5, 8], tempo: 0.16, pad: true, piano: 0.3 },
  missingHandle: { root: 60, scale: [0, 4, 7, 9], tempo: 0.18, piano: 0.45, pad: true },
  machineCover: { root: 45, scale: [0, 1, 6, 7], tempo: 0.3, drone: 33, pulse: true },
  livingReference: { root: 58, scale: [0, 2, 7, 9, 14], tempo: 0.14, pad: true, piano: 0.3 },
  returnCircuit: { root: 48, scale: [0, 3, 7, 10], tempo: 0.28, pad: true, pulse: true, drone: 36 },
  theDoorWeOpen: { root: 60, scale: [0, 4, 7, 11, 14], tempo: 0.22, pad: true, piano: 0.5 },
  cutTheLine: { root: 47, scale: [0, 3, 6, 10], tempo: 0.12, pad: true, drone: 35 },
  pursuit: { root: 45, scale: [0, 1, 3, 6], tempo: 0.5, drone: 33, pulse: true },
};

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

function startCue(A, name) {
  const C = CUES[name] || CUES.wrongCorridor;
  const c = A.ctx, out = c.createGain();
  out.gain.value = 0; out.connect(A.bus.music);
  out.gain.setTargetAtTime(1, c.currentTime, 2);
  let alive = true;
  const nodes = [];
  if (C.drone) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = midi(C.drone);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = midi(C.drone) * 1.005;
    const g = c.createGain(); g.gain.value = 0.05; o.connect(g); o2.connect(g); g.connect(out); o.start(); o2.start(); nodes.push(o, o2);
  }
  const step = () => {
    if (!alive) return;
    const t = c.currentTime + 0.05;
    if (C.pad && Math.random() < 0.5) {
      const notes = [0, 2, 4].map((i) => C.root + C.scale[(i + Math.floor(Math.random() * 2)) % C.scale.length]);
      for (const n of notes) A._tone(out, t, 6, { f: midi(n), type: 'triangle', gain: 0.012, a: 2.2, r: 6 });
    }
    if (C.piano && Math.random() < C.piano) {
      const n = C.root + 12 + C.scale[Math.floor(Math.random() * C.scale.length)];
      A._tone(out, t, 2.5, { f: midi(n), type: 'sine', gain: 0.04, a: 0.005, r: 2.5 });
      A._tone(out, t, 1.2, { f: midi(n) * 2, type: 'sine', gain: 0.01, a: 0.005, r: 1.2 });
    }
    if (C.tones && Math.random() < 0.5) A._tone(out, t, 0.3, { f: midi(C.root + 24 + C.scale[Math.floor(Math.random() * C.scale.length)]), gain: 0.02 });
    if (C.pulse) A._tone(out, t, 0.25, { f: midi(C.root - 12), type: 'sine', gain: 0.05 });
    setTimeout(step, (1 / C.tempo) * 1000 * (0.7 + Math.random() * 0.6));
  };
  step();
  return {
    name,
    stop: () => { alive = false; const t = c.currentTime; out.gain.setTargetAtTime(0, t, 1.2); setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* */ } } out.disconnect(); }, 5000); },
  };
}
