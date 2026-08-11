/**
 * Procedural audio engine.
 *
 * Every sound in the game is synthesised at runtime with the Web Audio API —
 * there are no audio files to download or licence. Footsteps are filtered
 * noise bursts, chains are metallic resonator banks, screams are formant
 * synthesis, the chase track is a generative drone with a heartbeat pulse.
 *
 * Positional sounds go through a PannerNode so they are genuinely spatial.
 * To use recorded assets later, keep the same `play(name, opts)` surface and
 * swap the synth functions for AudioBufferSourceNodes.
 */

import { settings } from '../core/settings.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.buses = {};
    this.noiseBuffer = null;
    this.music = null;
    this.heartbeat = null;
    this.breathing = null;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this._lastFootstep = 0;
    this.enabled = true;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    // a gentle limiter so stacked stingers never clip
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 9;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.22;
    this.master.connect(this.limiter).connect(ctx.destination);

    for (const name of ['sfx', 'music', 'voice', 'ambience', 'ui']) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[name] = g;
    }

    // shared white-noise buffer (2s)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    this.applyVolumes();
    settings.onChange(() => this.applyVolumes());
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = settings.data.audio;
    this.master.gain.value = a.master;
    this.buses.sfx.gain.value = a.sfx;
    this.buses.music.gain.value = a.music;
    this.buses.voice.gain.value = a.voice;
    this.buses.ambience.gain.value = a.ambience;
    this.buses.ui.gain.value = a.sfx * 0.8;
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Update the 3D listener from the camera. */
  setListener(pos, forward, up) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    if (l.positionX) {
      const t = this.t;
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(forward.x, t, 0.02);
      l.forwardY.setTargetAtTime(forward.y, t, 0.02);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** Build the output node for a sound: either a panner or a plain gain. */
  out(bus, pos, refDistance = 6, maxDistance = 60) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    if (pos) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = refDistance;
      panner.maxDistance = maxDistance;
      panner.rolloffFactor = 1.15;
      if (panner.positionX) {
        panner.positionX.value = pos.x;
        panner.positionY.value = pos.y;
        panner.positionZ.value = pos.z;
      } else {
        panner.setPosition(pos.x, pos.y, pos.z);
      }
      g.connect(panner).connect(this.buses[bus] || this.buses.sfx);
    } else {
      g.connect(this.buses[bus] || this.buses.sfx);
    }
    return g;
  }

  noise(dur = 0.3) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    return s;
  }

  env(node, t0, attack, decay, peak = 1) {
    node.gain.cancelScheduledValues(t0);
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // ------------------------------------------------------------- synths

  /**
   * @param {string} name
   * @param {{pos?:{x,y,z}, volume?:number, rate?:number}} opts
   */
  play(name, opts = {}) {
    if (!this.ready || !this.enabled) return;
    if (this.ctx.state === 'suspended') this.resume();
    const fn = this.SYNTH[name];
    if (!fn) return;
    try {
      fn.call(this, opts);
    } catch (e) {
      /* audio never breaks the game */
    }
  }

  get SYNTH() {
    if (this._synth) return this._synth;
    const A = this;
    this._synth = {
      // ---------------------------------------------------- movement
      footstep({ pos, volume = 1, surface = 'stone', run = false }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 4, 34);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = surface === 'wood' ? 420 : surface === 'tile' ? 1500 : 780;
        bp.Q.value = 1.1;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = run ? 3600 : 2400;
        src.connect(bp).connect(lp).connect(g);
        A.env(g, t0, 0.004, run ? 0.11 : 0.16, 0.32 * volume * (run ? 1.5 : 1));
        // a low thud for weight
        const osc = ctx.createOscillator();
        const og = A.out('sfx', pos, 4, 30);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, t0);
        osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.1);
        osc.connect(og);
        A.env(og, t0, 0.005, 0.12, 0.22 * volume);
        src.start(t0);
        osc.start(t0);
        src.stop(t0 + 0.35);
        osc.stop(t0 + 0.25);
      },

      vault({ pos, volume = 1 }) {
        A.SYNTH.footstep.call(A, { pos, volume: volume * 1.4, run: true });
        const ctx = A.ctx;
        const t0 = A.t + 0.05;
        const g = A.out('sfx', pos, 5, 40);
        const src = A.noise();
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 900;
        src.connect(hp).connect(g);
        A.env(g, t0, 0.01, 0.3, 0.3 * volume);
        src.start(t0);
        src.stop(t0 + 0.45);
      },

      // ---------------------------------------------------- chains
      chain({ pos, volume = 1, big = false }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 6, 55);
        g.gain.value = 0;
        const src = A.noise();
        // a bank of narrow resonators = metal
        const freqs = big ? [190, 340, 610, 940, 1480] : [420, 780, 1180, 1720, 2600];
        for (const f of freqs) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f * (0.9 + Math.random() * 0.25);
          bp.Q.value = 22 + Math.random() * 20;
          const bg = ctx.createGain();
          bg.gain.value = 0.5 / freqs.length;
          src.connect(bp).connect(bg).connect(g);
        }
        // rattle: several quick amplitude bumps
        const dur = big ? 1.5 : 0.7;
        g.gain.setValueAtTime(0.0001, t0);
        const hits = big ? 9 : 5;
        for (let i = 0; i < hits; i++) {
          const t = t0 + (i / hits) * dur * (0.6 + Math.random() * 0.6);
          g.gain.exponentialRampToValueAtTime(Math.max(0.0001, (0.5 * volume) / (1 + i * 0.5)), t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + Math.random() * 0.09);
        }
        src.start(t0);
        src.stop(t0 + dur + 0.4);
      },

      chain_launch({ pos, volume = 1 }) {
        A.SYNTH.chain.call(A, { pos, volume: volume * 1.2, big: true });
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 8, 70);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(160, t0);
        o.frequency.exponentialRampToValueAtTime(1200, t0 + 0.28);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2600;
        o.connect(lp).connect(g);
        A.env(g, t0, 0.01, 0.34, 0.3 * volume);
        o.start(t0);
        o.stop(t0 + 0.5);
      },

      // ---------------------------------------------------- combat
      hit({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 5, 45);
        const src = A.noise();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2400, t0);
        lp.frequency.exponentialRampToValueAtTime(280, t0 + 0.25);
        src.connect(lp).connect(g);
        A.env(g, t0, 0.003, 0.3, 0.75 * volume);
        const o = ctx.createOscillator();
        const og = A.out('sfx', pos, 5, 45);
        o.type = 'triangle';
        o.frequency.setValueAtTime(160, t0);
        o.frequency.exponentialRampToValueAtTime(42, t0 + 0.22);
        o.connect(og);
        A.env(og, t0, 0.004, 0.26, 0.6 * volume);
        src.start(t0); o.start(t0);
        src.stop(t0 + 0.45); o.stop(t0 + 0.35);
      },

      swing({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 5, 32);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(700, t0);
        bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.16);
        bp.Q.value = 2.4;
        src.connect(bp).connect(g);
        A.env(g, t0, 0.02, 0.2, 0.35 * volume);
        src.start(t0);
        src.stop(t0 + 0.4);
      },

      scream({ pos, volume = 1, distant = false }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('voice', pos, distant ? 20 : 6, distant ? 130 : 60);
        const base = 190 + Math.random() * 120;
        // formant synthesis: a buzzy source through vowel resonators
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(base, t0);
        o.frequency.linearRampToValueAtTime(base * 1.55, t0 + 0.2);
        o.frequency.linearRampToValueAtTime(base * 0.72, t0 + 1.1);
        const vib = ctx.createOscillator();
        const vibG = ctx.createGain();
        vib.frequency.value = 6.5;
        vibG.gain.value = base * 0.07;
        vib.connect(vibG).connect(o.frequency);
        for (const [f, q, a] of [[720, 9, 1], [1180, 12, 0.7], [2650, 14, 0.4]]) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f;
          bp.Q.value = q;
          const bg = ctx.createGain();
          bg.gain.value = a * 0.4;
          o.connect(bp).connect(bg).connect(g);
        }
        if (distant) {
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 900;
          g.disconnect();
          g.connect(lp).connect(A.buses.voice);
        }
        A.env(g, t0, 0.08, 1.25, (distant ? 0.28 : 0.6) * volume);
        o.start(t0); vib.start(t0);
        o.stop(t0 + 1.6); vib.stop(t0 + 1.6);
      },

      grunt({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('voice', pos, 5, 30);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, t0);
        o.frequency.exponentialRampToValueAtTime(88, t0 + 0.3);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 620;
        bp.Q.value = 5;
        o.connect(bp).connect(g);
        A.env(g, t0, 0.02, 0.32, 0.45 * volume);
        o.start(t0);
        o.stop(t0 + 0.5);
      },

      // ---------------------------------------------------- world
      door({ pos, volume = 1, close = false }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 6, 50);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(close ? 260 : 380, t0);
        bp.frequency.linearRampToValueAtTime(close ? 120 : 700, t0 + (close ? 0.14 : 0.85));
        bp.Q.value = 3.5;
        src.connect(bp).connect(g);
        if (close) {
          A.env(g, t0, 0.004, 0.4, 0.7 * volume);
          const o = ctx.createOscillator();
          const og = A.out('sfx', pos, 6, 60);
          o.type = 'sine';
          o.frequency.setValueAtTime(90, t0);
          o.frequency.exponentialRampToValueAtTime(34, t0 + 0.3);
          o.connect(og);
          A.env(og, t0, 0.003, 0.4, 0.55 * volume);
          o.start(t0); o.stop(t0 + 0.5);
        } else {
          A.env(g, t0, 0.1, 0.95, 0.3 * volume);
        }
        src.start(t0);
        src.stop(t0 + 1.3);
      },

      search({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 4, 22);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1900;
        bp.Q.value = 1.6;
        src.connect(bp).connect(g);
        A.env(g, t0, 0.03, 0.34, 0.2 * volume);
        src.start(t0);
        src.stop(t0 + 0.5);
      },

      pickup({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('ui', null);
        for (const [f, d] of [[520, 0], [780, 0.06], [1040, 0.12]]) {
          const o = ctx.createOscillator();
          const og = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          o.connect(og).connect(g);
          A.env(og, t0 + d, 0.01, 0.26, 0.18 * volume);
          o.start(t0 + d);
          o.stop(t0 + d + 0.4);
        }
        g.gain.value = 1;
      },

      // ---------------------------------------------------- occult
      portal({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 10, 90);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2800, t0);
        bp.frequency.exponentialRampToValueAtTime(90, t0 + 1.4);
        bp.Q.value = 4;
        src.connect(bp).connect(g);
        A.env(g, t0, 0.05, 1.5, 0.55 * volume);
        // a detuned pair underneath: the tear
        for (const det of [-7, 5]) {
          const o = ctx.createOscillator();
          const og = A.out('sfx', pos, 10, 90);
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(58 + det, t0);
          o.frequency.exponentialRampToValueAtTime(26 + det, t0 + 1.2);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 400;
          o.connect(lp).connect(og);
          A.env(og, t0, 0.1, 1.4, 0.3 * volume);
          o.start(t0);
          o.stop(t0 + 1.8);
        }
        src.start(t0);
        src.stop(t0 + 2);
      },

      whisper({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('voice', pos, 4, 26);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        bp.Q.value = 3.2;
        // syllabic amplitude modulation reads as speech
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.type = 'square';
        lfo.frequency.value = 5.5 + Math.random() * 3;
        lfoG.gain.value = 0.5;
        const vca = ctx.createGain();
        vca.gain.value = 0.5;
        lfo.connect(lfoG).connect(vca.gain);
        src.connect(bp).connect(vca).connect(g);
        A.env(g, t0, 0.35, 1.9, 0.3 * volume);
        src.start(t0); lfo.start(t0);
        src.stop(t0 + 2.5); lfo.stop(t0 + 2.5);
      },

      box_open({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        // a mechanism turning: clicks over a rising drone
        for (let i = 0; i < 7; i++) {
          const t = t0 + i * 0.11;
          const g = A.out('sfx', pos, 5, 45);
          const src = A.noise();
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 2600 + i * 260;
          bp.Q.value = 18;
          src.connect(bp).connect(g);
          A.env(g, t, 0.002, 0.07, 0.4 * volume);
          src.start(t);
          src.stop(t + 0.14);
        }
        const o = ctx.createOscillator();
        const og = A.out('sfx', pos, 8, 80);
        o.type = 'sine';
        o.frequency.setValueAtTime(44, t0);
        o.frequency.exponentialRampToValueAtTime(132, t0 + 1.1);
        o.connect(og);
        A.env(og, t0, 0.3, 1.1, 0.4 * volume);
        o.start(t0);
        o.stop(t0 + 1.6);
      },

      box_turn({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('ui', null);
        const src = A.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2200, t0);
        bp.frequency.linearRampToValueAtTime(3400, t0 + 0.12);
        bp.Q.value = 14;
        src.connect(bp).connect(g);
        A.env(g, t0, 0.004, 0.16, 0.3 * volume);
        src.start(t0);
        src.stop(t0 + 0.3);
      },

      box_solved({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        for (const [f, d] of [[110, 0], [165, 0.18], [220, 0.36], [330, 0.54]]) {
          const o = ctx.createOscillator();
          const g = A.out('music', null);
          o.type = 'sine';
          o.frequency.value = f;
          o.connect(g);
          A.env(g, t0 + d, 0.05, 2.2, 0.3 * volume);
          o.start(t0 + d);
          o.stop(t0 + d + 2.6);
        }
        A.SYNTH.portal.call(A, { volume });
      },

      seal_break({ pos, volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('sfx', pos, 8, 70);
        const src = A.noise();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(5200, t0);
        lp.frequency.exponentialRampToValueAtTime(220, t0 + 1.1);
        src.connect(lp).connect(g);
        A.env(g, t0, 0.006, 1.2, 0.6 * volume);
        src.start(t0);
        src.stop(t0 + 1.5);
      },

      // ---------------------------------------------------- UI
      ui_click({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('ui', null);
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(220, t0);
        o.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        o.connect(lp).connect(g);
        A.env(g, t0, 0.002, 0.1, 0.18 * volume);
        o.start(t0);
        o.stop(t0 + 0.2);
      },

      ui_hover({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('ui', null);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 880;
        o.connect(g);
        A.env(g, t0, 0.004, 0.05, 0.05 * volume);
        o.start(t0);
        o.stop(t0 + 0.1);
      },

      stinger({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('music', null);
        for (const det of [0, 0.6, -0.4]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(320 + det * 20, t0);
          o.frequency.exponentialRampToValueAtTime(46 + det * 4, t0 + 1.5);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(3200, t0);
          lp.frequency.exponentialRampToValueAtTime(200, t0 + 1.4);
          o.connect(lp).connect(g);
          o.start(t0);
          o.stop(t0 + 1.8);
        }
        A.env(g, t0, 0.006, 1.7, 0.42 * volume);
      },

      thunder({ volume = 1 }) {
        const ctx = A.ctx;
        const t0 = A.t;
        const g = A.out('ambience', null);
        const src = A.noise();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, t0);
        lp.frequency.exponentialRampToValueAtTime(70, t0 + 2.6);
        src.connect(lp).connect(g);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.5 * volume, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.2 * volume, t0 + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
        src.start(t0);
        src.stop(t0 + 3.5);
      },
    };
    return this._synth;
  }

  // ------------------------------------------------------------ loops

  /** Generative ambience + chase layer. `tension` 0..1 drives everything. */
  startMusic() {
    if (!this.ready || this.music) return;
    const ctx = this.ctx;
    const bus = this.buses.music;

    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(bus);

    // drone: three detuned oscillators through a slow filter sweep
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.28;
    const droneLP = ctx.createBiquadFilter();
    droneLP.type = 'lowpass';
    droneLP.frequency.value = 340;
    droneLP.Q.value = 2.4;
    droneGain.connect(droneLP).connect(out);
    const oscs = [];
    for (const f of [41.2, 61.7, 82.4, 123.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.008);
      const g = ctx.createGain();
      g.gain.value = 0.25;
      o.connect(g).connect(droneGain);
      o.start();
      oscs.push(o);
    }

    // a bowed metal shimmer that only appears at high tension
    const shimmer = ctx.createGain();
    shimmer.gain.value = 0;
    const shOsc = ctx.createOscillator();
    shOsc.type = 'sawtooth';
    shOsc.frequency.value = 660;
    const shBP = ctx.createBiquadFilter();
    shBP.type = 'bandpass';
    shBP.frequency.value = 2400;
    shBP.Q.value = 12;
    shOsc.connect(shBP).connect(shimmer).connect(out);
    shOsc.start();

    // wind / room tone
    const windSrc = this.noise();
    const windLP = ctx.createBiquadFilter();
    windLP.type = 'lowpass';
    windLP.frequency.value = 480;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    windSrc.connect(windLP).connect(windGain).connect(this.buses.ambience);
    windSrc.start();

    this.music = { out, droneLP, shimmer, oscs, shOsc, windSrc, windGain, windLP, tension: 0 };
    out.gain.exponentialRampToValueAtTime(0.5, this.t + 3);
  }

  stopMusic() {
    if (!this.music) return;
    const m = this.music;
    const t = this.t;
    m.out.gain.cancelScheduledValues(t);
    m.out.gain.setValueAtTime(Math.max(0.0001, m.out.gain.value), t);
    m.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    setTimeout(() => {
      try {
        for (const o of m.oscs) o.stop();
        m.shOsc.stop();
        m.windSrc.stop();
      } catch {}
    }, 1500);
    this.music = null;
    this.stopHeartbeat();
    this.stopBreathing();
  }

  /** @param {number} tension 0..1 */
  setTension(tension) {
    if (!this.music) return;
    const t = this.t;
    const k = clamp01(tension);
    this.music.tension = k;
    this.music.droneLP.frequency.setTargetAtTime(280 + k * 1500, t, 0.6);
    this.music.shimmer.gain.setTargetAtTime(k > 0.5 ? (k - 0.5) * 0.14 : 0, t, 0.8);
    this.music.shOsc.frequency.setTargetAtTime(620 + k * 260, t, 1.2);
    this.music.windGain.gain.setTargetAtTime(0.1 + k * 0.14, t, 1.0);
    this.music.out.gain.setTargetAtTime(0.42 + k * 0.4, t, 0.8);
  }

  /** Heartbeat that speeds up with fear. */
  setHeartbeat(rate) {
    if (!this.ready) return;
    if (rate <= 0) {
      this.stopHeartbeat();
      return;
    }
    if (!this.heartbeat) {
      this.heartbeat = { timer: null, bpm: 60 };
      const beat = () => {
        if (!this.heartbeat) return;
        const t0 = this.t;
        for (const [d, amp, f] of [[0, 1, 58], [0.16, 0.62, 46]]) {
          const o = this.ctx.createOscillator();
          const g = this.out('sfx', null);
          o.type = 'sine';
          o.frequency.setValueAtTime(f * 1.6, t0 + d);
          o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + d + 0.13);
          o.connect(g);
          this.env(g, t0 + d, 0.012, 0.19, 0.4 * amp * this.heartbeat.amp);
          o.start(t0 + d);
          o.stop(t0 + d + 0.35);
        }
        this.heartbeat.timer = setTimeout(beat, (60 / this.heartbeat.bpm) * 1000);
      };
      this.heartbeat.amp = 0;
      this.heartbeat.bpm = 60;
      beat();
    }
    this.heartbeat.bpm = 52 + rate * 88;
    this.heartbeat.amp = settings.get('accessibility.heartbeatCue', true) ? 0.3 + rate * 0.9 : 0;
  }

  stopHeartbeat() {
    if (this.heartbeat && this.heartbeat.timer) clearTimeout(this.heartbeat.timer);
    this.heartbeat = null;
  }

  /** Continuous breathing whose rate follows exertion + fear. */
  setBreathing(intensity) {
    if (!this.ready) return;
    if (intensity <= 0.02) {
      this.stopBreathing();
      return;
    }
    if (!this.breathing) {
      const ctx = this.ctx;
      const src = this.noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 620;
      bp.Q.value = 0.9;
      const vca = ctx.createGain();
      vca.gain.value = 0;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.35;
      lfoG.gain.value = 0.1;
      lfo.connect(lfoG).connect(vca.gain);
      src.connect(bp).connect(vca).connect(this.buses.voice);
      src.start();
      lfo.start();
      this.breathing = { src, bp, vca, lfo, lfoG };
    }
    const t = this.t;
    this.breathing.lfo.frequency.setTargetAtTime(0.3 + intensity * 1.5, t, 0.5);
    this.breathing.lfoG.gain.setTargetAtTime(0.04 + intensity * 0.24, t, 0.4);
    this.breathing.bp.frequency.setTargetAtTime(560 + intensity * 420, t, 0.5);
  }

  stopBreathing() {
    if (!this.breathing) return;
    try {
      this.breathing.src.stop();
      this.breathing.lfo.stop();
    } catch {}
    this.breathing = null;
  }

  /** Muffle everything (hiding in a locker, lights out). */
  setMuffle(amount) {
    if (!this.ready) return;
    if (!this._muffle) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 22000;
      this.master.disconnect();
      this.master.connect(lp).connect(this.limiter);
      this._muffle = lp;
    }
    this._muffle.frequency.setTargetAtTime(22000 - clamp01(amount) * 21200, this.t, 0.15);
  }
}

export const audio = new AudioEngine();
