/**
 * Audio engine (WebAudio). Every sound is synthesized into buffers at load:
 * layered gunshots per weapon class, mechanical reload foley, footsteps per
 * surface, impacts, explosions, UI, plus generated menu music and yard
 * ambience. Spatial playback with distance filtering and occlusion.
 * Buses: master → music / sfx / dialogue / ui.
 */

const SR = 44100;

function rng(seed) {
  let s = seed >>> 0 || 7;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}

function buf(ctx, seconds, fn, channels = 1) {
  const n = Math.max(1, Math.floor(seconds * SR));
  const b = ctx.createBuffer(channels, n, SR);
  for (let ch = 0; ch < channels; ch++) {
    const d = b.getChannelData(ch);
    fn(d, n, ch);
  }
  // normalize to avoid clipping
  let peak = 0;
  for (let ch = 0; ch < channels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i])); }
  if (peak > 0.98) for (let ch = 0; ch < channels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] *= 0.98 / peak; }
  return b;
}

/** One-pole lowpass applied in place. */
function lowpass(d, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < d.length; i++) { y = (1 - a) * d[i] + a * y; d[i] = y; }
}
function highpass(d, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0, xp = 0;
  for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - xp); xp = x; d[i] = y; }
}

const GUN = {
  rifle: { crack: 0.65, crackK: 90, body: 0.95, bodyK: 32, bodyLP: 2200, f0: 120, f1: 48, thumpK: 26, thump: 0.9, tail: 0.55, tailLvl: 0.3, mech: 0.25 },
  smg: { crack: 0.55, crackK: 110, body: 0.75, bodyK: 42, bodyLP: 2600, f0: 170, f1: 70, thumpK: 34, thump: 0.6, tail: 0.38, tailLvl: 0.22, mech: 0.3 },
  shotgun: { crack: 0.5, crackK: 60, body: 1.0, bodyK: 15, bodyLP: 1500, f0: 85, f1: 38, thumpK: 12, thump: 1.0, tail: 0.9, tailLvl: 0.38, mech: 0.2 },
  sniper: { crack: 1.0, crackK: 70, body: 1.0, bodyK: 13, bodyLP: 1800, f0: 75, f1: 32, thumpK: 10, thump: 1.0, tail: 1.3, tailLvl: 0.42, mech: 0.15 },
  pistol: { crack: 0.65, crackK: 120, body: 0.7, bodyK: 48, bodyLP: 2800, f0: 210, f1: 90, thumpK: 40, thump: 0.55, tail: 0.32, tailLvl: 0.2, mech: 0.35 },
  suppressed: { crack: 0.12, crackK: 160, body: 0.4, bodyK: 70, bodyLP: 1100, f0: 140, f1: 80, thumpK: 60, thump: 0.3, tail: 0.12, tailLvl: 0.06, mech: 0.55 },
  dmr: { crack: 0.85, crackK: 80, body: 1.0, bodyK: 20, bodyLP: 2000, f0: 95, f1: 40, thumpK: 16, thump: 0.95, tail: 0.95, tailLvl: 0.36, mech: 0.22 },
  lmg: { crack: 0.6, crackK: 85, body: 1.0, bodyK: 28, bodyLP: 1900, f0: 105, f1: 42, thumpK: 22, thump: 1.0, tail: 0.6, tailLvl: 0.32, mech: 0.2 },
  magnum: { crack: 0.85, crackK: 75, body: 1.0, bodyK: 22, bodyLP: 2100, f0: 110, f1: 45, thumpK: 18, thump: 0.9, tail: 0.75, tailLvl: 0.34, mech: 0.25 },
};

function gunshot(ctx, p, seed) {
  const r = rng(seed);
  return buf(ctx, 0.2 + p.tail, (d, n) => {
    const crack = new Float32Array(n), body = new Float32Array(n), tail = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const w = r();
      crack[i] = w * Math.exp(-t * p.crackK);
      body[i] = w * Math.exp(-t * p.bodyK);
      tail[i] = r() * Math.exp(-t * (4 / p.tail)) * Math.min(1, t * 60);
    }
    highpass(crack, 1800);
    lowpass(body, p.bodyLP);
    lowpass(tail, 900);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = p.f1 + (p.f0 - p.f1) * Math.exp(-t * 30);
      ph += (2 * Math.PI * f) / SR;
      const thump = Math.sin(ph) * Math.exp(-t * p.thumpK) * p.thump;
      const mech = i < SR * 0.012 ? r() * p.mech * (1 - i / (SR * 0.012)) : 0;
      const atk = Math.min(1, i / 30);
      d[i] = atk * (crack[i] * p.crack * 1.6 + body[i] * p.body * 1.4 + thump) + tail[i] * p.tailLvl + mech;
      d[i] = Math.tanh(d[i] * 1.6);
    }
  });
}

function click(ctx, freq, len, seed, noise = 0.5) {
  const r = rng(seed);
  return buf(ctx, len, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += 2 * Math.PI * freq / SR;
      d[i] = (Math.sin(ph) * (1 - noise) + r() * noise) * Math.exp(-t * (6 / len));
    }
    highpass(d, 400);
  });
}

function compose(ctx, len, parts) {
  // parts: [{at, buf, gain}]
  return buf(ctx, len, (d, n) => {
    for (const p of parts) {
      const src = p.buf.getChannelData(0);
      const off = Math.floor(p.at * SR);
      for (let i = 0; i < src.length && off + i < n; i++) d[off + i] += src[i] * (p.gain ?? 1);
    }
  });
}

function step(ctx, surface, seed) {
  const r = rng(seed);
  return buf(ctx, 0.22, (d, n) => {
    const thud = new Float32Array(n), grit = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      thud[i] = r() * Math.exp(-t * 45);
      grit[i] = r() * Math.exp(-t * 28) * (0.5 + 0.5 * Math.abs(Math.sin(t * 700 + seed)));
    }
    lowpass(thud, surface === 'metal' ? 900 : 380);
    highpass(grit, surface === 'gravel' ? 2200 : 3000);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let ring = 0;
      if (surface === 'metal') { ph += 2 * Math.PI * (420 + seed * 13) / SR; ring = Math.sin(ph) * Math.exp(-t * 18) * 0.35; }
      d[i] = thud[i] * 2.2 + grit[i] * (surface === 'gravel' ? 0.9 : surface === 'metal' ? 0.15 : 0.3) + ring;
    }
  });
}

function explosion(ctx, seed) {
  const r = rng(seed);
  return buf(ctx, 2.6, (d, n) => {
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      a[i] = r() * Math.exp(-t * 3.2);
      b[i] = r() * Math.exp(-t * 18);
    }
    lowpass(a, 420); lowpass(a, 600);
    lowpass(b, 3500);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += 2 * Math.PI * (38 + 30 * Math.exp(-t * 6)) / SR;
      d[i] = Math.tanh((a[i] * 6 + b[i] * 1.6 + Math.sin(ph) * Math.exp(-t * 4) * 0.9) * Math.min(1, i / 40) * 1.3);
    }
  });
}

function tone(ctx, freqs, len, type = 'sine', decay = 8) {
  return buf(ctx, len, (d, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      for (const f of freqs) {
        const ph = 2 * Math.PI * f * t;
        v += type === 'square' ? Math.sign(Math.sin(ph)) * 0.4 : type === 'tri' ? Math.asin(Math.sin(ph)) * 0.6 : Math.sin(ph);
      }
      d[i] = (v / freqs.length) * Math.exp(-t * decay) * Math.min(1, i / 60);
    }
  });
}

function whiz(ctx, seed) {
  const r = rng(seed);
  return buf(ctx, 0.25, (d, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = Math.exp(-Math.pow((t - 0.08) / 0.05, 2));
      d[i] = r() * env;
    }
    highpass(d, 2500); lowpass(d, 7000);
  });
}

function whoosh(ctx, seed) {
  const r = rng(seed);
  return buf(ctx, 0.3, (d, n) => {
    for (let i = 0; i < n; i++) { const t = i / SR; d[i] = r() * Math.sin(Math.PI * Math.min(1, t / 0.3)) * 0.8; }
    lowpass(d, 1400); highpass(d, 300);
  });
}

/** Generated menu music: slow minor chord pad with pulse and sub, loops seamlessly. */
function menuMusic(ctx) {
  const bpm = 84, beat = 60 / bpm, bars = 8, len = bars * 4 * beat;
  const chords = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  return buf(ctx, len, (d, n, ch) => {
    const r = rng(11 + ch);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const bar = Math.floor(t / (4 * beat)) % bars;
      const chord = chords[Math.floor(bar / 2) % chords.length];
      const inBar = (t % (8 * beat)) / (8 * beat);
      const fade = Math.min(1, inBar * 8, (1 - inBar) * 8);
      let v = 0;
      for (let k = 0; k < chord.length; k++) {
        const f = mtof(chord[k]) * (1 + (ch ? 0.003 : -0.003) * (k + 1));
        const ph = (t * f) % 1;
        v += (ph * 2 - 1) * 0.12 + Math.sin(2 * Math.PI * f * t) * 0.18;
      }
      const sub = Math.sin(2 * Math.PI * mtof(chord[0] - 12) * t) * 0.35;
      const beatPh = (t % beat) / beat;
      const pulse = Math.sin(2 * Math.PI * mtof(chord[0] + 12) * t) * Math.exp(-beatPh * 10) * 0.18 * ((Math.floor(t / beat) % 2) ? 0.6 : 1);
      const air = r() * 0.015;
      d[i] = (v * 0.55 * (0.6 + 0.4 * fade) + sub * (0.7 + 0.3 * Math.exp(-beatPh * 3)) + pulse + air) * 0.5;
    }
    // soften
    lowpass(d, 1800);
  }, 2);
}

function ambience(ctx) {
  return buf(ctx, 12, (d, n, ch) => {
    const r = rng(77 + ch);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.7 + ch) * Math.sin(t * 0.23);
      d[i] = r() * (0.2 + gust * 0.4);
    }
    lowpass(d, 500); lowpass(d, 700);
    let ph = 0;
    for (let i = 0; i < n; i++) { ph += 2 * Math.PI * 60 / SR; d[i] = d[i] * 1.5 + Math.sin(ph) * 0.02; }
    // crossfade edges for seamless loop
    const f = Math.floor(SR * 0.5);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
  }, 2);
}

/** Stereo impulse response: early reflections + exponentially decaying diffuse tail. */
function impulse(ctx, seconds, decay, early, seed) {
  return buf(ctx, seconds, (d, n, ch) => {
    const r = rng(seed + ch * 31);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      d[i] = r() * Math.pow(1 - t / seconds, decay) * 0.6;
    }
    for (const [at, g] of early) {
      const k = Math.floor((at + (ch ? 0.004 : 0)) * SR);
      if (k < n) d[k] += g * (ch ? 0.85 : 1);
    }
    lowpass(d, ch ? 5200 : 4800);
  }, 2);
}

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.b = {};
    this.voices = 0;
    this.captionCb = null;
    settings.onChange(() => this.applyVolumes());
  }

  /** Must be called from a user gesture. */
  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ sampleRate: SR, latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master.connect(this.comp).connect(c.destination);
    this.bus = {};
    for (const k of ['music', 'sfx', 'dialogue', 'ui']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    // environmental reverb: outdoor yard slap vs. indoor room, crossfaded by listener position
    this.send = c.createGain();
    this.send.gain.value = 1;
    this.revOut = c.createConvolver();
    this.revOut.buffer = impulse(c, 0.9, 3.2, [[0.045, 0.5], [0.11, 0.35], [0.19, 0.22]], 3);
    this.revIn = c.createConvolver();
    this.revIn.buffer = impulse(c, 1.5, 2.2, [[0.012, 0.6], [0.025, 0.45], [0.04, 0.35], [0.07, 0.25]], 9);
    this.wetOut = c.createGain(); this.wetOut.gain.value = 0.22;
    this.wetIn = c.createGain(); this.wetIn.gain.value = 0;
    this.send.connect(this.revOut).connect(this.wetOut).connect(this.bus.sfx);
    this.send.connect(this.revIn).connect(this.wetIn).connect(this.bus.sfx);
    this.indoor = 0;
    this.applyVolumes();
    this._build();
    this.ready = true;
  }

  _build() {
    const c = this.ctx, b = this.b;
    for (const [k, p] of Object.entries(GUN)) b['shot_' + k] = [gunshot(c, p, 3), gunshot(c, p, 9), gunshot(c, p, 17)];
    b.dry = click(c, 1800, 0.05, 1, 0.7);
    b.magOut = compose(c, 0.25, [{ at: 0, buf: click(c, 900, 0.06, 2, 0.6) }, { at: 0.05, buf: click(c, 400, 0.12, 3, 0.8), gain: 0.6 }]);
    b.magIn = compose(c, 0.25, [{ at: 0, buf: click(c, 700, 0.05, 4, 0.5) }, { at: 0.04, buf: click(c, 1300, 0.07, 5, 0.6), gain: 1.2 }]);
    b.charge = compose(c, 0.35, [{ at: 0, buf: click(c, 1100, 0.07, 6, 0.6) }, { at: 0.13, buf: click(c, 1500, 0.08, 7, 0.5), gain: 1.1 }]);
    b.shell = compose(c, 0.18, [{ at: 0, buf: click(c, 600, 0.05, 8, 0.7) }, { at: 0.05, buf: click(c, 1000, 0.06, 9, 0.5), gain: 0.8 }]);
    b.pump = compose(c, 0.4, [{ at: 0, buf: click(c, 500, 0.1, 10, 0.8) }, { at: 0.16, buf: click(c, 800, 0.1, 11, 0.7), gain: 1.2 }]);
    b.bolt = compose(c, 0.6, [{ at: 0, buf: click(c, 1300, 0.06, 12, 0.5) }, { at: 0.12, buf: click(c, 700, 0.1, 13, 0.7) }, { at: 0.3, buf: click(c, 900, 0.1, 14, 0.7) }, { at: 0.42, buf: click(c, 1500, 0.06, 15, 0.5) }]);
    b.swap = compose(c, 0.3, [{ at: 0, buf: whoosh(c, 16), gain: 0.4 }, { at: 0.15, buf: click(c, 1200, 0.05, 17, 0.6), gain: 0.7 }]);
    b.steps = {};
    for (const s of ['concrete', 'metal', 'gravel', 'wood', 'brick']) b.steps[s] = [0, 1, 2, 3].map((i) => step(c, s === 'wood' || s === 'brick' ? 'concrete' : s, i * 7 + 3));
    b.land = step(c, 'concrete', 99);
    b.hit = tone(c, [2600], 0.06, 'tri', 60);
    b.hitHead = compose(c, 0.25, [{ at: 0, buf: tone(c, [3400, 5100], 0.2, 'sine', 18) }, { at: 0, buf: click(c, 3000, 0.04, 21, 0.4), gain: 0.5 }]);
    b.kill = compose(c, 0.3, [{ at: 0, buf: tone(c, [1400], 0.12, 'tri', 25) }, { at: 0.07, buf: tone(c, [2100], 0.2, 'tri', 18) }]);
    b.hurt = buf(c, 0.25, (d, n) => { const r = rng(31); for (let i = 0; i < n; i++) d[i] = r() * Math.exp(-i / SR * 18); lowpass(d, 500); });
    b.whiz = [whiz(c, 1), whiz(c, 2), whiz(c, 3)];
    b.impact = { concrete: [click(c, 900, 0.08, 41, 0.9), click(c, 700, 0.08, 42, 0.9)], metal: [tone(c, [1900, 3100], 0.25, 'sine', 14), tone(c, [2400, 3700], 0.25, 'sine', 16)] };
    b.explosion = [explosion(c, 5), explosion(c, 8)];
    b.bounce = click(c, 1600, 0.06, 51, 0.4);
    b.pin = compose(c, 0.3, [{ at: 0, buf: click(c, 2200, 0.05, 52, 0.5) }, { at: 0.08, buf: click(c, 1800, 0.06, 53, 0.4), gain: 0.7 }]);
    b.smokePop = buf(c, 1.5, (d, n) => { const r = rng(61); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = r() * Math.exp(-t * 2) * Math.min(1, t * 30) * 0.6; } lowpass(d, 1800); highpass(d, 300); });
    b.whoosh = whoosh(c, 71);
    b.meleeHit = buf(c, 0.2, (d, n) => { const r = rng(72); for (let i = 0; i < n; i++) d[i] = r() * Math.exp(-i / SR * 30); lowpass(d, 700); });
    b.uiHover = tone(c, [1800], 0.04, 'sine', 80);
    b.uiClick = compose(c, 0.1, [{ at: 0, buf: tone(c, [900], 0.05, 'tri', 60) }, { at: 0.02, buf: tone(c, [1350], 0.06, 'tri', 50) }]);
    b.uiBack = tone(c, [600, 450], 0.1, 'tri', 30);
    b.beep = tone(c, [880], 0.18, 'sine', 12);
    b.beepHi = tone(c, [1320], 0.4, 'sine', 6);
    b.horn = buf(c, 1.6, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const env = Math.min(1, t * 8) * Math.min(1, (1.6 - t) * 3); d[i] = (Math.sign(Math.sin(2 * Math.PI * 220 * t)) * 0.3 + Math.sin(2 * Math.PI * 330 * t) * 0.4) * env; } lowpass(d, 1600); });
    b.sting = buf(c, 2.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 164.8 * t) * 0.7 + Math.sin(2 * Math.PI * 220 * t) * 0.5) * Math.exp(-t * 1.2) * Math.min(1, t * 20) * 0.4; } });
    b.music = menuMusic(c);
    b.ambience = ambience(c);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = this.settings.data.audio;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.05);
    this.bus.music.gain.setTargetAtTime(a.music * 0.6, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(a.sfx, t, 0.05);
    this.bus.dialogue.gain.setTargetAtTime(a.dialogue, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(a.ui * 0.8, t, 0.05);
  }

  /** 0 = open air, 1 = enclosed room. Smoothly crossfades the reverb. */
  setEnvironment(indoor) {
    if (!this.ctx) return;
    this.indoor += (indoor - this.indoor) * 0.08;
    const t = this.ctx.currentTime;
    this.wetOut.gain.setTargetAtTime(0.22 * (1 - this.indoor), t, 0.1);
    this.wetIn.gain.setTargetAtTime(0.42 * this.indoor, t, 0.1);
  }

  setListener(pos, fwd, up) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    this.listenerPos = pos;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.01); L.positionY.setTargetAtTime(pos.y, t, 0.01); L.positionZ.setTargetAtTime(pos.z, t, 0.01);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.01); L.forwardY.setTargetAtTime(fwd.y, t, 0.01); L.forwardZ.setTargetAtTime(fwd.z, t, 0.01);
      L.upX.setTargetAtTime(up.x, t, 0.01); L.upY.setTargetAtTime(up.y, t, 0.01); L.upZ.setTargetAtTime(up.z, t, 0.01);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  _pick(x) { return Array.isArray(x) ? x[(Math.random() * x.length) | 0] : x; }

  /** Non-positional sound. */
  play(name, { vol = 1, rate = 1, bus = 'sfx', delay = 0, send = 0 } = {}) {
    if (!this.ready) return null;
    const b = this._pick(typeof name === 'string' ? this.b[name] : name);
    if (!b || this.voices > 64) return null;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.bus[bus]);
    if (bus === 'sfx' && send > 0) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg).connect(this.send); }
    this.voices++;
    s.onended = () => { this.voices--; };
    s.start(c.currentTime + delay);
    return s;
  }

  /** Positional sound. occluded → muffled. */
  play3D(name, x, y, z, { vol = 1, rate = 1, occluded = false, ref = 4, bus = 'sfx', send = 0.35, echo = false } = {}) {
    if (!this.ready) return null;
    const b = this._pick(typeof name === 'string' ? this.b[name] : name);
    if (!b || this.voices > 64) return null;
    const c = this.ctx;
    const lp = this.listenerPos;
    const dist = lp ? Math.hypot(x - lp.x, y - lp.y, z - lp.z) : 10;
    if (dist > 220) return null;
    const s = c.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.max(500, 18000 / (1 + dist / 25)) * (occluded ? 0.18 : 1);
    const p = c.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 400; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    const g = c.createGain();
    g.gain.value = vol * (occluded ? 0.55 : 1);
    s.connect(f).connect(p).connect(g).connect(this.bus[bus]);
    if (send > 0) { const sg = c.createGain(); sg.gain.value = send * (occluded ? 1.4 : 1) * Math.min(1.5, 0.6 + dist / 40); g.connect(sg).connect(this.send); }
    this.voices++;
    s.onended = () => { this.voices--; };
    // speed of sound delay for distant sounds
    const at = c.currentTime + Math.min(0.5, dist / 343);
    s.start(at);
    // distant shots get a slapback echo off the yard's buildings
    if (echo && dist > 25 && this.voices < 56) {
      const e = c.createBufferSource();
      e.buffer = b;
      e.playbackRate.value = s.playbackRate.value * 0.96;
      const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
      const eg = c.createGain(); eg.gain.value = vol * 0.22 * Math.min(1, dist / 60);
      const ep = c.createStereoPanner(); ep.pan.value = (Math.random() - 0.5) * 1.2;
      e.connect(ef).connect(eg).connect(ep).connect(this.bus[bus]);
      this.voices++;
      e.onended = () => { this.voices--; };
      e.start(at + 0.18 + Math.random() * 0.25);
    }
    return s;
  }

  startLoop(name, bus, vol = 1) {
    if (!this.ready) return null;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.b[name];
    s.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, c.currentTime, 0.8);
    s.connect(g).connect(this.bus[bus]);
    s.start();
    return { s, g };
  }

  stopLoop(h, fade = 0.6) {
    if (!h || !this.ctx) return;
    const t = this.ctx.currentTime;
    h.g.gain.setTargetAtTime(0, t, fade / 3);
    h.s.stop(t + fade + 0.1);
  }

  music(on) {
    if (on && !this.musicH) this.musicH = this.startLoop('music', 'music', 0.9);
    else if (!on && this.musicH) { this.stopLoop(this.musicH, 1.2); this.musicH = null; }
  }

  ambience(on) {
    if (on && !this.ambH) this.ambH = this.startLoop('ambience', 'sfx', 0.35);
    else if (!on && this.ambH) { this.stopLoop(this.ambH); this.ambH = null; }
  }

  /** Announcer line: speech synthesis (if available) + caption callback. */
  announce(text, caption = text) {
    if (this.settings.data.accessibility.captions && this.captionCb) this.captionCb(caption, 'announcer');
    const a = this.settings.data.audio;
    const vol = a.master * a.dialogue;
    if (vol <= 0.01 || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.min(1, vol);
      u.rate = 1.05; u.pitch = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* speech unavailable */ }
  }

  ui(kind) { this.play(kind === 'hover' ? 'uiHover' : kind === 'back' ? 'uiBack' : 'uiClick', { bus: 'ui', vol: kind === 'hover' ? 0.35 : 0.7 }); }
}
