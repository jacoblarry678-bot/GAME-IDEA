// Audio engine: the AudioContext, mix buses, a generated reverb, noise and
// plucked-string buffers, positional sources and small synth helpers. Every
// sound in the park is synthesized here; there are no audio files.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Engine {
  constructor() {
    this.ctx = null;
    this.ready = false;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    // master -> gentle compressor -> speakers
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    comp.connect(this.analyser);
    // buses
    this.music = this.bus(0.55);
    this.ambience = this.bus(0.7);
    this.sfx = this.bus(0.9);
    this.ui = this.bus(0.6);
    // shared reverb send
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);
    this.noiseBuf = this.makeNoise(2, 'white');
    this.pinkBuf = this.makeNoise(4, 'pink');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.plucks = new Map();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  bus(level) {
    const g = this.ctx.createGain();
    g.gain.value = level;
    g.connect(this.master);
    return g;
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(seconds, color) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  // Karplus-Strong plucked string, cached per note and brightness
  pluck(midi, bright = 0.5, seconds = 1.6) {
    const key = `${midi}:${bright}`;
    if (this.plucks.has(key)) return this.plucks.get(key);
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = sr / mtof(midi);
    const n = Math.max(2, Math.round(period));
    const ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    const damp = 0.5 - (1 - bright) * 0.02;
    const decay = 0.996 + bright * 0.003;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % n];
      const v = (a * damp + b * (1 - damp)) * decay;
      d[i] = a;
      ring[idx] = v;
      idx = (idx + 1) % n;
    }
    this.plucks.set(key, buf);
    return buf;
  }

  // A positional sound source: things connect into `input`.
  source3d(pos, opts = {}) {
    const ctx = this.ctx;
    const p = ctx.createPanner();
    p.panningModel = opts.hrtf ? 'HRTF' : 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = opts.ref ?? 12;
    p.rolloffFactor = opts.rolloff ?? 1.1;
    p.maxDistance = opts.max ?? 500;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    g.connect(p);
    p.connect(opts.bus || this.sfx);
    if (opts.reverb !== false) {
      const send = ctx.createGain();
      send.gain.value = opts.reverb ?? 0.15;
      p.connect(send);
      send.connect(this.reverbSend);
    }
    const src = { input: g, panner: p, gain: g };
    if (pos) setPos(p, pos.x, pos.y, pos.z);
    return src;
  }

  setListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = camera.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10];
    const ux = e[4], uy = e[5], uz = e[6];
    const px = e[12], py = e[13], pz = e[14];
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(px, t, 0.02);
      l.positionY.setTargetAtTime(py, t, 0.02);
      l.positionZ.setTargetAtTime(pz, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(ux, t, 0.02);
      l.upY.setTargetAtTime(uy, t, 0.02);
      l.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  // ---------------------------------------------------------------- voices
  osc(type, freq, t) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  env(g, t, a, peak, d, sustain, r, end) {
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(peak * sustain, t + a, d);
    p.setTargetAtTime(0.0001, end, r);
  }

  noise(t, dur, buf = this.noiseBuf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(t, Math.random() * (buf.duration - 0.1));
    s.stop(t + dur);
    return s;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  // one-shot helpers --------------------------------------------------------
  blip(dest, t, freq, dur, vol, type = 'sine', slide = 0) {
    const o = this.osc(type, freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, vol, dur * 0.4, 0.5, dur * 0.25, t + dur * 0.6);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.6);
  }

  hiss(dest, t, dur, vol, type = 'highpass', freq = 2000, q = 0.7, buf) {
    const n = this.noise(t, dur + 0.5, buf);
    const f = this.filter(type, freq, q);
    const g = this.ctx.createGain();
    this.env(g, t, Math.min(0.02, dur * 0.2), vol, dur * 0.5, 0.6, dur * 0.3, t + dur * 0.7);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    return { f, g };
  }

  boom(dest, t, vol, size = 1) {
    const o = this.osc('sine', 110 / size, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9 * size);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, vol, 0.35 * size, 0.3, 0.4 * size, t + 0.5 * size);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 2.5 * size);
    this.hiss(dest, t, 0.9 * size, vol * 0.8, 'lowpass', 900, 0.6, this.brownBuf);
    this.hiss(dest, t, 0.25, vol * 0.5, 'bandpass', 1800, 0.8);
  }
}

export function setPos(panner, x, y, z) {
  if (panner.positionX) {
    const t = panner.context.currentTime;
    panner.positionX.setTargetAtTime(x, t, 0.03);
    panner.positionY.setTargetAtTime(y, t, 0.03);
    panner.positionZ.setTargetAtTime(z, t, 0.03);
  } else panner.setPosition(x, y, z);
}

// small seeded random
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
