// Synth instruments for the park music and show bands. Each function
// schedules one note on Engine `E` into `dest` at time `t`.
import { mtof } from './engine.js';

function out(E, dest, t, vol, a, hold, rel) {
  const g = E.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setTargetAtTime(0.0001, t + a + hold, rel);
  g.connect(dest);
  return g;
}

function start(o, t, end) {
  o.start(t);
  o.stop(end);
}

// Bright upright piano: a few partials with fast decay and a hammer tick.
export function piano(E, dest, t, m, dur, vel = 0.2) {
  const f = mtof(m);
  const decay = 0.35 + 900 / (f + 300);
  const g = out(E, dest, t, vel, 0.004, 0.02, decay * 0.45);
  g.gain.setTargetAtTime(0.0001, t + Math.max(dur, 0.08), 0.12);
  const partials = [[1, 1, 'triangle'], [1.003, 0.6, 'sine'], [2, 0.35, 'sine'], [3, 0.12, 'sine']];
  for (const [mul, amp, type] of partials) {
    const o = E.osc(type, f * mul, t);
    const pg = E.ctx.createGain();
    pg.gain.value = amp;
    o.connect(pg);
    pg.connect(g);
    start(o, t, t + dur + decay * 2 + 0.3);
  }
}

// Plucked string from the Karplus-Strong cache (banjo, guitar, upright).
export function pluck(E, dest, t, m, vel = 0.3, bright = 0.6, len = 1.4, filterHz = 0) {
  const s = E.ctx.createBufferSource();
  s.buffer = E.pluck(m, bright);
  const g = E.ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.setTargetAtTime(0.0001, t + len * 0.6, len * 0.25);
  if (filterHz) {
    const f = E.filter('lowpass', filterHz, 0.7);
    s.connect(f);
    f.connect(g);
  } else s.connect(g);
  g.connect(dest);
  s.start(t);
  s.stop(t + Math.min(s.buffer.duration, len + 0.5));
}

export function strum(E, dest, t, notes, vel = 0.18, bright = 0.5, gap = 0.014, len = 0.9, filterHz = 0) {
  notes.forEach((n, i) => pluck(E, dest, t + i * gap, n, vel, bright, len, filterHz));
}

export function bass(E, dest, t, m, dur, vel = 0.32, cutoff = 520) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.008, Math.max(0.04, dur * 0.7), 0.06);
  const o = E.osc('sawtooth', f, t);
  const o2 = E.osc('sine', f, t);
  const lp = E.filter('lowpass', cutoff, 1.2);
  lp.frequency.setValueAtTime(cutoff * 2.2, t);
  lp.frequency.setTargetAtTime(cutoff, t, 0.06);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  start(o, t, t + dur + 0.5);
  start(o2, t, t + dur + 0.5);
}

export function tuba(E, dest, t, m, dur, vel = 0.3) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.035, dur * 0.6, 0.08);
  const o = E.osc('sawtooth', f, t);
  const lp = E.filter('lowpass', 420, 1.5);
  o.connect(lp);
  lp.connect(g);
  start(o, t, t + dur + 0.5);
}

export function brass(E, dest, t, m, dur, vel = 0.14, bright = 1) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.035, dur * 0.85, 0.07);
  const lp = E.filter('lowpass', 500, 1.4);
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2600 * bright, t + 0.06);
  lp.frequency.setTargetAtTime(1300 * bright, t + 0.08, 0.15);
  for (const det of [-6, 5]) {
    const o = E.osc('sawtooth', f, t);
    o.detune.value = det;
    o.connect(lp);
    start(o, t, t + dur + 0.5);
  }
  lp.connect(g);
}

// Band organ / calliope: square plus sine with vibrato and a breathy chiff.
export function organ(E, dest, t, m, dur, vel = 0.1) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.012, dur * 0.9, 0.05);
  const lfo = E.osc('sine', 6.2, t);
  const lg = E.ctx.createGain();
  lg.gain.value = 9;
  lfo.connect(lg);
  for (const [type, mul, amp] of [['square', 1, 0.35], ['sine', 2, 0.5], ['sine', 1, 0.6]]) {
    const o = E.osc(type, f * mul, t);
    lg.connect(o.detune);
    const pg = E.ctx.createGain();
    pg.gain.value = amp;
    o.connect(pg);
    pg.connect(g);
    start(o, t, t + dur + 0.4);
  }
  start(lfo, t, t + dur + 0.4);
  const lp = E.filter('lowpass', 3200, 0.5);
  g.disconnect();
  g.connect(lp);
  lp.connect(dest);
}

// Xylophone (hard) or marimba (soft): fast-decaying sine partials.
export function mallet(E, dest, t, m, vel = 0.2, soft = false) {
  const f = mtof(m);
  const decay = soft ? 0.5 : 0.28;
  const g = out(E, dest, t, vel, 0.002, 0.01, decay * 0.4);
  const parts = soft ? [[1, 1], [4, 0.08], [9.9, 0.02]] : [[1, 1], [3, 0.25], [6.3, 0.1]];
  for (const [mul, amp] of parts) {
    const o = E.osc('sine', f * mul, t);
    const pg = E.ctx.createGain();
    pg.gain.value = amp;
    o.connect(pg);
    pg.connect(g);
    start(o, t, t + decay * 3);
  }
}

export function glock(E, dest, t, m, vel = 0.1) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.002, 0.02, 0.4);
  for (const [mul, amp] of [[1, 1], [2.76, 0.3], [5.4, 0.12]]) {
    const o = E.osc('sine', f * mul, t);
    const pg = E.ctx.createGain();
    pg.gain.value = amp;
    o.connect(pg);
    pg.connect(g);
    start(o, t, t + 2);
  }
}

export function pad(E, dest, t, notes, dur, vel = 0.05, cutoff = 1400) {
  const g = out(E, dest, t, vel, Math.min(0.5, dur * 0.3), dur * 0.7, 0.4);
  const lp = E.filter('lowpass', cutoff, 0.6);
  lp.connect(g);
  for (const m of notes) {
    for (const det of [-8, 0, 7]) {
      const o = E.osc('sawtooth', mtof(m), t);
      o.detune.value = det;
      o.connect(lp);
      start(o, t, t + dur + 2);
    }
  }
}

export function lead(E, dest, t, m, dur, vel = 0.09, type = 'sawtooth', cutoff = 2200) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.01, dur * 0.8, 0.08);
  const lp = E.filter('lowpass', cutoff, 2);
  lp.frequency.setValueAtTime(cutoff * 0.5, t);
  lp.frequency.linearRampToValueAtTime(cutoff, t + 0.05);
  const o = E.osc(type, f, t);
  const o2 = E.osc('square', f * 1.005, t);
  const g2 = E.ctx.createGain();
  g2.gain.value = 0.4;
  o.connect(lp);
  o2.connect(g2);
  g2.connect(lp);
  lp.connect(g);
  start(o, t, t + dur + 0.5);
  start(o2, t, t + dur + 0.5);
}

export function flute(E, dest, t, m, dur, vel = 0.09) {
  const f = mtof(m);
  const g = out(E, dest, t, vel, 0.06, dur * 0.85, 0.1);
  const o = E.osc('sine', f, t);
  const lfo = E.osc('sine', 5, t);
  const lg = E.ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(12, t + 0.35);
  lfo.connect(lg);
  lg.connect(o.detune);
  o.connect(g);
  start(o, t, t + dur + 0.5);
  start(lfo, t, t + dur + 0.5);
  E.hiss(g, t, Math.min(dur, 0.3), 0.15, 'bandpass', f * 2, 2);
}

// Fiddle / harmonica: reedy tones with vibrato through formant filters.
export function reed(E, dest, t, m, dur, vel = 0.08, kind = 'fiddle') {
  const f = mtof(m);
  const g = out(E, dest, t, vel, kind === 'fiddle' ? 0.06 : 0.03, dur * 0.85, 0.08);
  const o = E.osc(kind === 'fiddle' ? 'sawtooth' : 'square', f, t);
  const lfo = E.osc('sine', kind === 'fiddle' ? 5.5 : 4.5, t);
  const lg = E.ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(kind === 'fiddle' ? 15 : 22, t + 0.25);
  lfo.connect(lg);
  lg.connect(o.detune);
  const b1 = E.filter('bandpass', kind === 'fiddle' ? 1100 : 900, 1.4);
  const b2 = E.filter('bandpass', kind === 'fiddle' ? 2600 : 1800, 2);
  const mix = E.ctx.createGain();
  mix.gain.value = 1.6;
  o.connect(b1);
  o.connect(b2);
  b1.connect(mix);
  b2.connect(mix);
  mix.connect(g);
  start(o, t, t + dur + 0.5);
  start(lfo, t, t + dur + 0.5);
}

// Sung "ahh" (show singer) and screams: sawtooth through vowel formants.
export function voice(E, dest, t, m, dur, vel = 0.08, vowel = 'a', glide = 0) {
  const f = mtof(m);
  const F = { a: [800, 1150, 2900], o: [500, 900, 2600], e: [400, 2000, 2600], oo: [350, 800, 2400] }[vowel];
  const g = out(E, dest, t, vel, 0.05, dur * 0.8, 0.12);
  const o = E.osc('sawtooth', f, t);
  if (glide) o.frequency.linearRampToValueAtTime(f * glide, t + dur);
  const lfo = E.osc('sine', 5.4, t);
  const lg = E.ctx.createGain();
  lg.gain.value = 18;
  lfo.connect(lg);
  lg.connect(o.detune);
  const mix = E.ctx.createGain();
  mix.gain.value = 2.2;
  F.forEach((fr, i) => {
    const b = E.filter('bandpass', fr, 6 + i * 2);
    o.connect(b);
    b.connect(mix);
  });
  mix.connect(g);
  start(o, t, t + dur + 0.6);
  start(lfo, t, t + dur + 0.6);
}

// ------------------------------------------------------------------- drums
export function kick(E, dest, t, vel = 0.5) {
  const o = E.osc('sine', 150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  const g = out(E, dest, t, vel, 0.002, 0.03, 0.08);
  o.connect(g);
  start(o, t, t + 0.6);
}

export function snare(E, dest, t, vel = 0.25) {
  E.hiss(dest, t, 0.16, vel, 'highpass', 1600, 0.8);
  const o = E.osc('triangle', 190, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const g = out(E, dest, t, vel * 0.7, 0.002, 0.02, 0.04);
  o.connect(g);
  start(o, t, t + 0.4);
}

export function brush(E, dest, t, vel = 0.08) {
  E.hiss(dest, t, 0.22, vel, 'bandpass', 4200, 0.6);
}

export function hat(E, dest, t, vel = 0.07, open = false) {
  E.hiss(dest, t, open ? 0.28 : 0.045, vel, 'highpass', 7500, 0.7);
}

export function ride(E, dest, t, vel = 0.05) {
  E.hiss(dest, t, 0.5, vel, 'bandpass', 7200, 1.4);
}

export function clap(E, dest, t, vel = 0.18) {
  for (let i = 0; i < 3; i++) E.hiss(dest, t + i * 0.011, 0.06 + i * 0.03, vel, 'bandpass', 1300, 0.9);
}

export function woodblock(E, dest, t, vel = 0.12, pitch = 900) {
  E.blip(dest, t, pitch, 0.07, vel, 'sine');
  E.hiss(dest, t, 0.02, vel * 0.5, 'bandpass', pitch * 2, 3);
}

export function shaker(E, dest, t, vel = 0.04) {
  E.hiss(dest, t, 0.07, vel, 'highpass', 5500, 0.5);
}

export function anvil(E, dest, t, vel = 0.06) {
  for (const [f, a] of [[1180, 1], [2650, 0.5], [4300, 0.25]]) E.blip(dest, t, f, 0.9, vel * a, 'sine');
}

export function timpani(E, dest, t, m, vel = 0.3) {
  const o = E.osc('sine', mtof(m), t);
  o.frequency.exponentialRampToValueAtTime(mtof(m) * 0.96, t + 0.8);
  const g = out(E, dest, t, vel, 0.004, 0.05, 0.35);
  o.connect(g);
  start(o, t, t + 2);
  E.hiss(dest, t, 0.12, vel * 0.3, 'lowpass', 500, 0.7);
}

export function bell(E, dest, t, m, vel = 0.12) {
  const f = mtof(m);
  for (const [mul, amp, dec] of [[1, 1, 1.4], [2.4, 0.5, 0.8], [3.0, 0.3, 0.6], [4.5, 0.2, 0.4]]) {
    const o = E.osc('sine', f * mul, t);
    const g = out(E, dest, t, vel * amp, 0.002, 0.01, dec * 0.5);
    o.connect(g);
    start(o, t, t + dec * 3);
  }
}
