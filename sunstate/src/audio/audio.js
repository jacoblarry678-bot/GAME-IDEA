/**
 * Procedural audio (Web Audio API) — no recorded samples, so everything here
 * is original: engine synth tied to RPM and throttle, tyre squeal from slip,
 * sirens, horns, gunshots with a slap-back echo, impacts, footsteps by
 * surface, ocean and city ambience, UI blips, and two generative radio
 * stations. Separate master / music / sfx / ambient / UI volumes.
 */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ok = false;
    this.station = 0; // 0 = off, 1.. = stations
    this.stations = [
      { name: 'Radio off' },
      { name: 'NEON TIDE 99.1', style: 'synth', bpm: 104 },
      { name: 'CALLE OCHO 104.5', style: 'dembow', bpm: 96 },
    ];
    this.stationIndex = 1;
    this.radioOn = true;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    settings.onChange(() => this.applyVolumes());
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.bus = {};
    for (const k of ['music', 'sfx', 'ambient', 'ui']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    this.noiseBuf = this.makeNoise(2, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.applyVolumes();
    this.setupEngine();
    this.setupAmbient();
    this.setupSiren();
    this.ok = true;
    this.musicT = 0;
    this.nextBeat = 0;
    this.step16 = 0;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = this.settings.a;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.05);
    this.bus.music.gain.setTargetAtTime(a.music * 0.55, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(a.sfx, t, 0.05);
    this.bus.ambient.gain.setTargetAtTime(a.ambient * 0.6, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(a.ui * 0.5, t, 0.05);
  }

  makeNoise(seconds, kind) {
    const c = this.ctx, n = c.sampleRate * seconds;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  noiseSrc(buf = this.noiseBuf, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    return s;
  }

  // --- spatial helpers -----------------------------------------------------
  setListener(x, y, z, yaw) { Object.assign(this.listener, { x, y, z, yaw }); }
  spatial(pos, ref = 18) {
    const l = this.listener;
    const dx = pos.x - l.x, dz = pos.z - l.z;
    const d = Math.hypot(dx, dz, (pos.y ?? l.y) - l.y);
    const gain = Math.min(1, ref / Math.max(ref, d)) ** 1.3;
    // camera right = (-cos yaw, sin yaw)
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * -Math.cos(l.yaw) + dz * Math.sin(l.yaw)) / d)) : 0;
    return { gain, pan, d };
  }
  out(bus, pan) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.bus[bus]);
    return p;
  }

  /** Short filtered noise burst. */
  burst({ pos = null, bus = 'sfx', dur = 0.2, freq = 1000, q = 0.7, type = 'lowpass', gain = 1, attack = 0.002, ref = 18 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const sp = pos ? this.spatial(pos, ref) : { gain: 1, pan: 0 };
    if (sp.gain < 0.01) return;
    const src = this.noiseSrc(this.noiseBuf, false);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * sp.gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(bus, sp.pan));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  tone({ pos = null, bus = 'sfx', freq = 440, freq2 = null, dur = 0.2, type = 'sine', gain = 0.5, delay = 0, ref = 18 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const sp = pos ? this.spatial(pos, ref) : { gain: 1, pan: 0 };
    if (sp.gain < 0.01) return;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * sp.gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(bus, sp.pan));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // --- one-shots ------------------------------------------------------------
  gunshot(pos, isPlayer) {
    if (!this.ok) return;
    const g = isPlayer ? 1 : 0.9;
    this.burst({ pos, dur: 0.18, freq: 3200, gain: 0.9 * g, ref: 30 });
    this.burst({ pos, dur: 0.35, freq: 600, gain: 0.8 * g, ref: 30 });
    this.tone({ pos, freq: 140, freq2: 45, dur: 0.18, gain: 0.9 * g, ref: 30 });
    // slap-back off the buildings
    const sp = this.spatial(pos, 30);
    if (sp.gain > 0.05) setTimeout(() => this.burst({ pos, dur: 0.4, freq: 900, gain: 0.25 * g, ref: 30 }), 110 + Math.random() * 60);
  }
  impact(pos, strength = 1) {
    const s = Math.min(1.5, strength / 6);
    this.burst({ pos, dur: 0.3 + s * 0.3, freq: 400, gain: 0.7 * s + 0.2, ref: 25 });
    this.burst({ pos, dur: 0.25, freq: 2600, type: 'bandpass', q: 3, gain: 0.4 * s, ref: 25 });
    if (s > 0.6) this.burst({ pos, dur: 0.6, freq: 5000, type: 'highpass', gain: 0.15 * s, ref: 25 }); // glass
  }
  thud(pos) { this.burst({ pos, dur: 0.2, freq: 250, gain: 0.8 }); }
  punch(pos) { this.burst({ pos, dur: 0.1, freq: 900, gain: 0.7 }); this.tone({ pos, freq: 110, freq2: 60, dur: 0.1, gain: 0.6 }); }
  whoosh(pos) { this.burst({ pos, dur: 0.15, freq: 1200, type: 'bandpass', q: 1.5, gain: 0.2 }); }
  door(pos) { this.burst({ pos, dur: 0.12, freq: 500, gain: 0.5 }); this.tone({ pos, freq: 220, freq2: 160, dur: 0.08, gain: 0.25, delay: 0.05 }); }
  reload(pos) { this.tone({ pos, freq: 1800, dur: 0.03, type: 'square', gain: 0.12 }); this.tone({ pos, freq: 1200, dur: 0.04, type: 'square', gain: 0.15, delay: 0.7 }); }
  splash(pos) { this.burst({ pos, dur: 0.6, freq: 1400, gain: 0.6 }); }
  footstep(pos, surface, run) {
    const f = surface === 'sand' ? 500 : surface === 'water' ? 900 : surface === 'tile' ? 3200 : 1800;
    this.burst({ pos, dur: surface === 'sand' ? 0.12 : 0.06, freq: f, gain: (run ? 0.22 : 0.14) * (surface === 'sand' ? 0.7 : 1), ref: 6 });
  }
  ui(kind) {
    if (!this.ok) return;
    if (kind === 'switch') this.tone({ bus: 'ui', freq: 900, dur: 0.05, type: 'triangle', gain: 0.3 });
    else if (kind === 'empty') this.tone({ bus: 'ui', freq: 300, dur: 0.05, type: 'square', gain: 0.15 });
    else if (kind === 'select') this.tone({ bus: 'ui', freq: 660, freq2: 880, dur: 0.07, type: 'triangle', gain: 0.25 });
    else if (kind === 'back') this.tone({ bus: 'ui', freq: 520, freq2: 380, dur: 0.07, type: 'triangle', gain: 0.25 });
    else if (kind === 'money') { [0, 0.07, 0.14].forEach((d, i) => this.tone({ bus: 'ui', freq: [988, 1319, 1568][i], dur: 0.12, type: 'triangle', gain: 0.25, delay: d })); }
    else if (kind === 'message') { this.tone({ bus: 'ui', freq: 1175, dur: 0.08, type: 'sine', gain: 0.3 }); this.tone({ bus: 'ui', freq: 1568, dur: 0.12, type: 'sine', gain: 0.3, delay: 0.09 }); }
    else if (kind === 'objective') this.tone({ bus: 'ui', freq: 784, freq2: 1046, dur: 0.18, type: 'triangle', gain: 0.25 });
  }
  wantedUp() { if (!this.ok) return; [0, 0.12].forEach((d) => this.tone({ bus: 'ui', freq: 330, dur: 0.1, type: 'square', gain: 0.12, delay: d })); }
  jingle(kind) {
    if (!this.ok) return;
    const seq = kind === 'pass' ? [72, 76, 79, 84, 79, 84] : kind === 'fail' ? [67, 63, 60, 55] : [60, 64, 67];
    seq.forEach((n, i) => this.tone({ bus: 'music', freq: NOTE(n), dur: 0.35, type: 'triangle', gain: 0.35, delay: i * 0.13 }));
  }

  // --- continuous: engine, tyres, siren, ambience ---------------------------
  setupEngine() {
    const c = this.ctx;
    const e = {};
    e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = c.createOscillator(); e.o2.type = 'square';
    e.sub = c.createOscillator(); e.sub.type = 'sine';
    e.filter = c.createBiquadFilter(); e.filter.type = 'lowpass'; e.filter.Q.value = 2;
    e.gain = c.createGain(); e.gain.gain.value = 0;
    e.mix2 = c.createGain(); e.mix2.gain.value = 0.5;
    e.o1.connect(e.filter); e.o2.connect(e.mix2); e.mix2.connect(e.filter); e.sub.connect(e.filter);
    e.filter.connect(e.gain); e.gain.connect(this.bus.sfx);
    e.o1.start(); e.o2.start(); e.sub.start();
    // tyre squeal
    e.tyre = this.noiseSrc();
    e.tyreF = c.createBiquadFilter(); e.tyreF.type = 'bandpass'; e.tyreF.frequency.value = 1700; e.tyreF.Q.value = 6;
    e.tyreG = c.createGain(); e.tyreG.gain.value = 0;
    e.tyre.connect(e.tyreF); e.tyreF.connect(e.tyreG); e.tyreG.connect(this.bus.sfx); e.tyre.start();
    // road/wind noise
    e.road = this.noiseSrc(this.brownBuf);
    e.roadF = c.createBiquadFilter(); e.roadF.type = 'lowpass'; e.roadF.frequency.value = 400;
    e.roadG = c.createGain(); e.roadG.gain.value = 0;
    e.road.connect(e.roadF); e.roadF.connect(e.roadG); e.roadG.connect(this.bus.sfx); e.road.start();
    // horn
    e.h1 = c.createOscillator(); e.h1.type = 'square'; e.h1.frequency.value = 392;
    e.h2 = c.createOscillator(); e.h2.type = 'square'; e.h2.frequency.value = 494;
    e.hf = c.createBiquadFilter(); e.hf.type = 'lowpass'; e.hf.frequency.value = 1800;
    e.hG = c.createGain(); e.hG.gain.value = 0;
    e.h1.connect(e.hf); e.h2.connect(e.hf); e.hf.connect(e.hG); e.hG.connect(this.bus.sfx); e.h1.start(); e.h2.start();
    // nearby traffic hum (one shared voice)
    e.t1 = c.createOscillator(); e.t1.type = 'sawtooth';
    e.tF = c.createBiquadFilter(); e.tF.type = 'lowpass'; e.tF.frequency.value = 300;
    e.tG = c.createGain(); e.tG.gain.value = 0;
    e.tP = c.createStereoPanner();
    e.t1.connect(e.tF); e.tF.connect(e.tG); e.tG.connect(e.tP); e.tP.connect(this.bus.sfx); e.t1.start();
    this.eng = e;
  }

  setupSiren() {
    const c = this.ctx;
    const s = {};
    s.o = c.createOscillator(); s.o.type = 'square';
    s.f = c.createBiquadFilter(); s.f.type = 'lowpass'; s.f.frequency.value = 2500;
    s.g = c.createGain(); s.g.gain.value = 0;
    s.p = c.createStereoPanner();
    s.o.connect(s.f); s.f.connect(s.g); s.g.connect(s.p); s.p.connect(this.bus.sfx); s.o.start();
    this.siren = s;
    this.sirenPhase = 0;
  }

  setupAmbient() {
    const c = this.ctx;
    const a = {};
    a.waves = this.noiseSrc(this.brownBuf);
    a.wF = c.createBiquadFilter(); a.wF.type = 'lowpass'; a.wF.frequency.value = 700;
    a.wG = c.createGain(); a.wG.gain.value = 0;
    a.waves.connect(a.wF); a.wF.connect(a.wG); a.wG.connect(this.bus.ambient); a.waves.start();
    a.city = this.noiseSrc(this.brownBuf);
    a.cF = c.createBiquadFilter(); a.cF.type = 'lowpass'; a.cF.frequency.value = 220;
    a.cG = c.createGain(); a.cG.gain.value = 0;
    a.city.connect(a.cF); a.cF.connect(a.cG); a.cG.connect(this.bus.ambient); a.city.start(0.7);
    // rain: band-passed white noise, plus a softer low layer for rain on roofs and cars
    a.rain = this.noiseSrc(this.noiseBuf);
    a.rH = c.createBiquadFilter(); a.rH.type = 'highpass'; a.rH.frequency.value = 900;
    a.rL = c.createBiquadFilter(); a.rL.type = 'lowpass'; a.rL.frequency.value = 7000;
    a.rG = c.createGain(); a.rG.gain.value = 0;
    a.rain.connect(a.rH); a.rH.connect(a.rL); a.rL.connect(a.rG); a.rG.connect(this.bus.ambient); a.rain.start(0.3);
    this.amb = a;
  }

  /** A roll of thunder `delay` seconds after the flash. */
  thunder(delay = 2) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = this.noiseSrc(this.brownBuf, false);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    src.connect(f); f.connect(g); g.connect(this.bus.ambient);
    src.start(t, Math.random()); src.stop(t + 4.6);
  }

  /** Per-frame update from game state. */
  update(dt, game) {
    if (!this.ok || !game) return;
    const c = this.ctx, t = c.currentTime;
    const cam = game.engine.camera;
    this.setListener(cam.position.x, cam.position.y, cam.position.z, game.cameraRig.yaw);
    const paused = game.paused;
    const e = this.eng;
    const v = game.player.vehicle;
    // player's engine
    if (v && v.engineOn && !paused) {
      const d = v.def;
      const pulses = d.engineVoice === 'v8' ? 4 : 2;
      const f = (v.rpm / 60) * pulses / 2;
      e.o1.frequency.setTargetAtTime(f, t, 0.03);
      e.o2.frequency.setTargetAtTime(f * 1.007, t, 0.03);
      e.sub.frequency.setTargetAtTime(f / 2, t, 0.03);
      const th = v.throttleAmt || 0;
      e.filter.frequency.setTargetAtTime(250 + th * 1400 + (v.rpm / d.redline) * 900, t, 0.05);
      e.gain.gain.setTargetAtTime((0.12 + th * 0.16) * (d.engineVoice === 'v8' ? 1.1 : 0.9), t, 0.05);
      e.tyreG.gain.setTargetAtTime(v.airborne ? 0 : v.slip * 0.22, t, 0.05);
      e.tyreF.frequency.setTargetAtTime(1400 + v.speed * 12, t, 0.1);
      e.roadG.gain.setTargetAtTime(Math.min(0.35, v.speed * 0.008), t, 0.1);
      e.roadF.frequency.setTargetAtTime(200 + v.speed * 20, t, 0.1);
    } else {
      e.gain.gain.setTargetAtTime(0, t, 0.08); e.tyreG.gain.setTargetAtTime(0, t, 0.05); e.roadG.gain.setTargetAtTime(0, t, 0.1);
    }
    // horn: the player's or the nearest honking car
    let hornGain = 0, hornPan = 0;
    for (const o of game.vehicles) if (o.horn) { const sp = this.spatial(o.pos, 20); if (sp.gain > hornGain) { hornGain = sp.gain; hornPan = sp.pan; } }
    e.hG.gain.setTargetAtTime(paused ? 0 : hornGain * 0.18, t, 0.02);
    // nearest other car's engine as a shared hum
    let near = null, nd = 40;
    for (const o of game.vehicles) { if (o === v || !o.engineOn || o.speed < 0.5) continue; const d = Math.hypot(o.pos.x - cam.position.x, o.pos.z - cam.position.z); if (d < nd) { nd = d; near = o; } }
    if (near && !paused) {
      const sp = this.spatial(near.pos, 10);
      e.t1.frequency.setTargetAtTime((near.rpm / 60) * 1.5, t, 0.1);
      e.tG.gain.setTargetAtTime(sp.gain * 0.12, t, 0.1);
      e.tP.pan.setTargetAtTime(sp.pan, t, 0.1);
    } else e.tG.gain.setTargetAtTime(0, t, 0.2);
    // siren: nearest police car with siren on (wail)
    let sirenCar = null, sd = 250;
    for (const o of game.vehicles) if (o.siren) { const d = Math.hypot(o.pos.x - cam.position.x, o.pos.z - cam.position.z); if (d < sd) { sd = d; sirenCar = o; } }
    if (sirenCar && !paused) {
      this.sirenPhase += dt;
      const sp = this.spatial(sirenCar.pos, 25);
      const wail = 0.5 - 0.5 * Math.cos(this.sirenPhase * Math.PI * 2 / 4.2);
      this.siren.o.frequency.setTargetAtTime(620 + wail * 820, t, 0.02);
      this.siren.g.gain.setTargetAtTime(sp.gain * 0.13, t, 0.05);
      this.siren.p.pan.setTargetAtTime(sp.pan, t, 0.05);
    } else this.siren.g.gain.setTargetAtTime(0, t, 0.2);
    // ambience: surf by distance to the shoreline, city rumble elsewhere; muffled indoors
    const shoreD = Math.abs(cam.position.x - 214);
    const indoor = game.world.interiorAt(cam.position.x, cam.position.z, cam.position.y) ? 0.25 : 1;
    const surf = Math.max(0, 1 - shoreD / 140) * (0.75 + 0.25 * Math.sin(t * 0.55));
    this.amb.wG.gain.setTargetAtTime(paused ? 0 : surf * 0.5 * indoor, t, 0.2);
    this.amb.cG.gain.setTargetAtTime(paused ? 0 : (0.12 + Math.min(0.2, game.vehicles.length * 0.006)) * indoor * (1 - surf * 0.5), t, 0.3);
    const rain = game.weather?.rain || 0, inCar = !!v;
    this.amb.rG.gain.setTargetAtTime(paused ? 0 : rain * (inCar ? 0.32 : 0.42) * (indoor < 1 ? 0.4 : 1), t, 0.4);
    this.amb.rL.frequency.setTargetAtTime(inCar || indoor < 1 ? 2600 : 7000, t, 0.3); // muffled under a roof
    // radio in vehicles
    this.updateRadio(dt, !!v && !paused && this.radioOn && this.stationIndex > 0);
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % this.stations.length;
    this.radioOn = this.stationIndex > 0;
    this.onStation?.(this.stations[this.stationIndex].name);
  }

  get stationName() { return this.stations[this.stationIndex].name; }

  /** Generative music: schedules 16th notes slightly ahead of time. */
  updateRadio(dt, playing) {
    const c = this.ctx;
    if (!playing) { this.nextBeat = 0; return; }
    const st = this.stations[this.stationIndex];
    const spb = 60 / st.bpm / 4;
    if (!this.nextBeat || this.nextBeat < c.currentTime) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < c.currentTime + 0.15) {
      this.playStep(st, this.step16, this.nextBeat);
      this.nextBeat += spb;
      this.step16 = (this.step16 + 1) % 256;
    }
  }

  playStep(st, s, when) {
    const c = this.ctx;
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const out = this.bus.music;
    const voice = (freq, dur, type, gain, filter = 0) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      let node = o;
      if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
      node.connect(g); g.connect(out);
      o.start(when); o.stop(when + dur + 0.05);
    };
    const hit = (dur, freq, gain, type = 'highpass') => {
      const src = this.noiseSrc(this.noiseBuf, false);
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(when, Math.random()); src.stop(when + dur + 0.02);
    };
    const kick = (gain = 0.8) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.18);
      const g = c.createGain(); g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.35);
    };
    if (st.style === 'synth') {
      // i–VI–III–VII in A minor; arpeggio, bass on eighths, gated pads
      const roots = [57, 53, 60, 55][bar];
      const chord = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]][bar];
      if (i % 4 === 0) kick(0.7);
      if (i === 4 || i === 12) hit(0.18, 1500, 0.35, 'bandpass');
      if (i % 2 === 0) hit(0.04, 7000, 0.12);
      if (i % 2 === 0) voice(NOTE(roots - 12), 0.22, 'sawtooth', 0.22, 600);
      const arp = chord[(i >> 1) % 3] + (i % 8 >= 6 ? 12 : 0);
      voice(NOTE(roots + 12 + arp), 0.16, 'square', 0.06, 2600);
      if (i === 0) for (const n of chord) voice(NOTE(roots + n), 1.9, 'triangle', 0.05, 1800);
    } else {
      // dembow-style rhythm with a plucked marimba line
      const roots = [62, 62, 58, 60][bar];
      if (i === 0 || i === 8) kick(0.85);
      if (i === 3 || i === 6 || i === 11 || i === 14) hit(0.12, 1800, 0.3, 'bandpass');
      if (i % 2 === 1) hit(0.03, 8000, 0.08);
      if (i === 0 || i === 7 || i === 10) voice(NOTE(roots - 24), 0.35, 'sine', 0.45);
      const scale = [0, 3, 5, 7, 10, 12];
      if ([0, 3, 6, 8, 10, 13].includes(i)) voice(NOTE(roots + 12 + scale[(i * 7 + bar) % scale.length]), 0.22, 'triangle', 0.13);
      if (i === 0) for (const n of [0, 3, 7]) voice(NOTE(roots + n), 1.6, 'sawtooth', 0.025, 1200);
    }
  }
}
