/**
 * Tiny procedural sound kit (Web Audio). No audio files: every effect is a
 * filtered noise burst or an oscillator sweep, so nothing needs licensing.
 */

import { save } from './save.js';

class Sfx {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, y: 0, z: 0 };
  }

  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.setVolume(save.data.settings.volume);
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  /** Distance attenuation for a world position (null = UI / self). */
  _gain(pos, base) {
    if (!pos) return base;
    const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y, dz = pos.z - this.listener.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return base / (1 + d * d * 0.004);
  }

  _noise(gain, dur, freq, q = 1, type = 'lowpass') {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  _tone(gain, dur, f0, f1, type = 'square', delay = 0) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const G = (b) => this._gain(pos, b);
    const g = G(1);
    if (g < 0.01) return;
    switch (name) {
      case 'ar': this._noise(0.5 * g, 0.16, 2200, 0.8); this._tone(0.15 * g, 0.08, 180, 60); break;
      case 'smg': this._noise(0.35 * g, 0.1, 3200, 0.7); break;
      case 'pistol': this._noise(0.4 * g, 0.12, 2600, 1); this._tone(0.12 * g, 0.06, 300, 90); break;
      case 'shotgun': this._noise(0.8 * g, 0.35, 1200, 0.6); this._tone(0.3 * g, 0.2, 120, 40, 'sawtooth'); break;
      case 'sniper': this._noise(0.9 * g, 0.5, 1800, 0.5); this._tone(0.3 * g, 0.3, 200, 50, 'sawtooth'); break;
      case 'rocket': this._noise(0.5 * g, 0.5, 700, 0.5); break;
      case 'explosion': this._noise(1.0 * g, 0.9, 500, 0.4); this._tone(0.5 * g, 0.6, 90, 30, 'sine'); break;
      case 'throw': this._noise(0.2 * g, 0.15, 900, 2, 'bandpass'); break;
      case 'hit': this._tone(0.18, 0.06, 1400, 1100); break;
      case 'head': this._tone(0.22, 0.12, 2200, 1800, 'triangle'); break;
      case 'shieldhit': this._tone(0.16, 0.08, 900, 1300, 'triangle'); break;
      case 'hurt': this._tone(0.2, 0.15, 220, 120, 'sawtooth'); break;
      case 'pickaxe': this._noise(0.35 * g, 0.12, 1500, 3, 'bandpass'); this._tone(0.15 * g, 0.1, 520, 300, 'triangle'); break;
      case 'build': this._tone(0.18 * g, 0.08, 300, 500, 'square'); this._noise(0.2 * g, 0.1, 900); break;
      case 'break': this._noise(0.5 * g, 0.4, 800, 0.8); break;
      case 'pickup': this._tone(0.14, 0.08, 700, 1200, 'triangle'); break;
      case 'chest': [660, 880, 990, 1320].forEach((f, i) => this._tone(0.12 * g, 0.2, f, f, 'triangle', i * 0.07)); break;
      case 'reload': this._tone(0.1, 0.05, 500, 400, 'square'); this._tone(0.1, 0.05, 700, 600, 'square', 0.15); break;
      case 'empty': this._tone(0.08, 0.04, 900, 800, 'square'); break;
      case 'heal': this._tone(0.12, 0.3, 500, 900, 'sine'); break;
      case 'shield': this._tone(0.12, 0.35, 700, 1400, 'sine'); break;
      case 'jump': this._tone(0.06 * g, 0.1, 300, 500, 'sine'); break;
      case 'land': this._noise(0.25 * g, 0.12, 400); break;
      case 'glider': this._noise(0.3, 0.4, 600, 1, 'bandpass'); break;
      case 'storm': this._tone(0.08, 0.25, 110, 70, 'sawtooth'); break;
      case 'elim': [520, 780, 1040].forEach((f, i) => this._tone(0.15, 0.15, f, f * 1.2, 'triangle', i * 0.06)); break;
      case 'ui': this._tone(0.08, 0.05, 900, 1100, 'triangle'); break;
      case 'bounce': this._tone(0.2 * g, 0.3, 200, 700, 'sine'); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(0.16, 0.35, f, f, 'triangle', i * 0.12)); break;
      case 'lose': [440, 392, 330, 262].forEach((f, i) => this._tone(0.14, 0.35, f, f, 'triangle', i * 0.15)); break;
      default: break;
    }
  }
}

export const sfx = new Sfx();
