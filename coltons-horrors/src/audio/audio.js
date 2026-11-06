// Synthesized audio: ambience, heartbeat terror radius, chase music and effects. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.8; this.musicVol = 0.7; this.loops = {}; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let last = 0;
    this.brownBuf = c.createBuffer(1, len, c.sampleRate);
    const b = this.brownBuf.getChannelData(0);
    for (let i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; last = (last + 0.02 * d[i]) / 1.02; b[i] = last * 3.5; }
  }

  setVolume(v, m) { this.vol = v; this.musicVol = m; if (this.master) { this.master.gain.value = v; this.music.gain.value = m; } }

  noise(brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brownBuf : this.noiseBuf;
    s.loop = true;
    return s;
  }

  // Positional volume helper: returns gain 0..1 from distance.
  falloff(d, range) { return Math.max(0, 1 - d / range) ** 1.5; }

  env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  tone(freq, dur, type = 'sine', vol = 0.3, dest = null, slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = c.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  burst(dur, freq, q = 1, vol = 0.3, type = 'bandpass', brown = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noise(brown);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }

  /* ---------- ambience ---------- */

  ambience(kind, rain) {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx;
    const wind = this.noise(true);
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    const wg = c.createGain(); wg.gain.value = 0.22;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(wg.gain);
    wind.connect(wf); wf.connect(wg); wg.connect(this.master);
    wind.start(); lfo.start();
    this.loops.amb = [wind, lfo];
    if (rain) {
      const r = this.noise();
      const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 900;
      const rg = c.createGain(); rg.gain.value = 0.12;
      r.connect(rf); rf.connect(rg); rg.connect(this.master);
      r.start();
      this.loops.amb.push(r);
    }
    this.ambKind = kind;
    this.critterT = 2;
  }

  stopAmbience() { for (const k of Object.keys(this.loops)) { for (const n of this.loops[k]) { try { n.stop(); } catch (e) { /* stopped */ } } } this.loops = {}; this.stopHum(); this.stopChase(); }

  tickAmbience(dt) {
    if (!this.ctx || !this.ambKind) return;
    this.critterT -= dt;
    if (this.critterT > 0) return;
    this.critterT = 1.5 + Math.random() * 5;
    if (this.ambKind === 'farm' || this.ambKind === 'camp') {
      for (let i = 0; i < 3; i++) setTimeout(() => this.tone(4200 + Math.random() * 300, 0.04, 'sine', 0.02), i * 70);
    }
    if (Math.random() < 0.15) this.crow();
    if (this.ambKind === 'camp' && Math.random() < 0.2) { this.tone(420, 0.35, 'sine', 0.05, null, 0.85); setTimeout(() => this.tone(400, 0.5, 'sine', 0.05, null, 0.8), 450); }
    if (this.ambKind === 'junk' && Math.random() < 0.3) this.tone(80 + Math.random() * 60, 1.2, 'triangle', 0.04, null, 1.1);
  }

  crow() {
    const f = 700 + Math.random() * 200;
    for (let i = 0; i < 2; i++) setTimeout(() => { this.tone(f, 0.22, 'sawtooth', 0.04, null, 0.6); this.burst(0.2, 1400, 3, 0.03); }, i * 280);
  }

  thunder() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noise(true);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.2, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t); s.stop(t + 3.6);
  }

  /* ---------- terror radius heartbeat ---------- */

  heartbeat(intensity, dt) {
    if (!this.ctx) return;
    this.hbT = (this.hbT || 0) - dt;
    if (intensity <= 0.01) return;
    if (this.hbT > 0) return;
    const rate = 0.95 - intensity * 0.5;
    this.hbT = rate;
    const v = 0.15 + intensity * 0.55;
    this.tone(52, 0.16, 'sine', v, this.music, 0.6);
    setTimeout(() => this.tone(46, 0.2, 'sine', v * 0.75, this.music, 0.6), 160);
  }

  chase(on, intensity = 1) {
    if (!this.ctx) return;
    if (on && !this.loops.chase) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.value = 0.0001; g.connect(this.music);
      const nodes = [];
      for (const [f, type] of [[55, 'sawtooth'], [58.3, 'sawtooth'], [110, 'square'], [164.8, 'triangle']]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f;
        const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500;
        o.connect(filt); filt.connect(g); o.start();
        nodes.push(o);
      }
      const pulse = c.createOscillator(); pulse.frequency.value = 3.2;
      const pg = c.createGain(); pg.gain.value = 0.06;
      pulse.connect(pg); pg.connect(g.gain); pulse.start();
      nodes.push(pulse);
      g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 1.2);
      this.loops.chase = nodes;
      this.chaseGain = g;
      this.stingT = 0;
    } else if (!on && this.loops.chase) this.stopChase();
    if (on && this.chaseGain) {
      this.chaseGain.gain.setTargetAtTime(0.08 + intensity * 0.1, this.ctx.currentTime, 0.4);
      this.stingT -= 1 / 60;
      if (this.stingT < 0) { this.stingT = 3 + Math.random() * 3; this.tone(880 + Math.random() * 200, 0.6, 'sawtooth', 0.03, this.music, 0.94); }
    }
  }

  stopChase() {
    if (!this.loops.chase) return;
    const g = this.chaseGain, nodes = this.loops.chase;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* done */ } }), 1500);
    delete this.loops.chase;
    this.chaseGain = null;
  }

  /* ---------- generator hum ---------- */

  hum(level) {
    if (!this.ctx) return;
    if (!this.humNodes) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.value = 0; g.connect(this.sfx);
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const trem = c.createOscillator(); trem.frequency.value = 9;
      const tg = c.createGain(); tg.gain.value = 0.3;
      trem.connect(tg); tg.connect(o.frequency);
      o.connect(f); f.connect(g); o.start(); trem.start();
      this.humNodes = { g, o, trem };
    }
    this.humNodes.g.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.2);
  }

  stopHum() { if (this.humNodes) { try { this.humNodes.o.stop(); this.humNodes.trem.stop(); } catch (e) { /* done */ } this.humNodes = null; } }

  /* ---------- one-shots ---------- */

  play(name, v = 1) {
    if (!this.ctx || v <= 0.01) return;
    switch (name) {
      case 'skillWarn': this.tone(1320, 0.12, 'sine', 0.2 * v); break;
      case 'skillGood': this.tone(990, 0.08, 'triangle', 0.15 * v); break;
      case 'skillGreat': this.tone(1480, 0.1, 'triangle', 0.18 * v); this.tone(1980, 0.14, 'sine', 0.1 * v); break;
      case 'genFail': this.burst(0.5, 600, 0.7, 0.6 * v, 'lowpass', true); this.tone(140, 0.4, 'square', 0.12 * v, null, 0.5); this.burst(0.2, 4000, 2, 0.2 * v); break;
      case 'genDone': this.tone(110, 1.4, 'sawtooth', 0.12 * v, null, 1.02); this.tone(220, 1.4, 'triangle', 0.1 * v); this.burst(0.6, 300, 0.7, 0.3 * v, 'lowpass', true); break;
      case 'gatesPowered': for (let i = 0; i < 4; i++) setTimeout(() => this.tone(620, 0.5, 'square', 0.08 * v, null, 0.98), i * 650); break;
      case 'hit': this.burst(0.18, 1800, 1, 0.5 * v); this.tone(90, 0.2, 'sine', 0.4 * v, null, 0.5); break;
      case 'scream': { const f = 520 + Math.random() * 160; this.tone(f, 0.7, 'sawtooth', 0.09 * v, null, 0.7); this.burst(0.5, f * 2.2, 4, 0.15 * v); break; }
      case 'swing': this.burst(0.22, 900, 0.8, 0.25 * v, 'bandpass'); break;
      case 'pallet': this.burst(0.25, 220, 0.8, 0.7 * v, 'lowpass', true); this.tone(70, 0.3, 'sine', 0.4 * v, null, 0.6); break;
      case 'stun': this.tone(160, 0.5, 'sawtooth', 0.15 * v, null, 0.5); this.burst(0.3, 500, 1, 0.4 * v); break;
      case 'break': for (let i = 0; i < 4; i++) setTimeout(() => this.burst(0.12, 700 + i * 200, 1.5, 0.5 * v), i * 60); break;
      case 'vault': this.burst(0.15, 400, 1, 0.35 * v, 'lowpass', true); break;
      case 'hook': this.tone(880, 1.2, 'triangle', 0.08 * v, null, 0.97); this.tone(1243, 1.0, 'sine', 0.05 * v); this.burst(0.3, 2500, 3, 0.2 * v); break;
      case 'sacrifice': this.tone(60, 3, 'sawtooth', 0.15 * v, null, 0.5); this.burst(2.5, 200, 0.5, 0.4 * v, 'lowpass', true); break;
      case 'step': this.burst(0.05, 300 + Math.random() * 200, 1, 0.05 * v, 'lowpass', true); break;
      case 'unhook': this.tone(330, 0.3, 'triangle', 0.1 * v, null, 1.5); break;
      case 'heal': this.tone(660, 0.3, 'sine', 0.08 * v, null, 1.3); this.tone(990, 0.4, 'sine', 0.06 * v); break;
      case 'chest': this.burst(0.3, 500, 1, 0.3 * v, 'lowpass', true); this.tone(240, 0.2, 'square', 0.05 * v, null, 1.4); break;
      case 'gateOpen': this.tone(80, 2.5, 'sawtooth', 0.12 * v, null, 1.3); this.burst(2.5, 300, 0.6, 0.3 * v, 'lowpass', true); break;
      case 'veilIn': this.burst(0.9, 3000, 6, 0.15 * v); this.tone(220, 0.9, 'sine', 0.08 * v, null, 0.5); break;
      case 'veilOut': this.burst(0.6, 1800, 5, 0.2 * v); this.tone(110, 0.6, 'sine', 0.1 * v, null, 2); break;
      case 'whisper': this.burst(0.6, 2500 + Math.random() * 1500, 8, 0.05 * v); break;
      case 'glitch': for (let i = 0; i < 6; i++) setTimeout(() => this.tone(200 + Math.random() * 1800, 0.04, 'square', 0.06 * v), i * 35); this.burst(0.3, 5000, 1, 0.15 * v, 'highpass'); break;
      case 'staticBurst': this.burst(1.0, 4000, 0.5, 0.35 * v, 'highpass'); this.tone(60, 0.8, 'square', 0.1 * v, null, 0.5); break;
      case 'blind': this.tone(2400, 0.4, 'sine', 0.08 * v, null, 0.5); break;
      case 'hatch': this.tone(180, 1.5, 'sine', 0.1 * v, null, 0.8); this.burst(1.5, 400, 0.6, 0.15 * v, 'lowpass', true); break;
      case 'click': this.tone(1600, 0.03, 'square', 0.05 * v); break;
      case 'buy': this.tone(880, 0.1, 'triangle', 0.1 * v); setTimeout(() => this.tone(1320, 0.18, 'triangle', 0.1 * v), 90); break;
      case 'kick': this.burst(0.18, 300, 0.8, 0.5 * v, 'lowpass', true); this.tone(120, 0.2, 'square', 0.1 * v, null, 0.6); break;
      default: break;
    }
  }
}

export const audio = new Audio();
