// Generative music: one theme per land, plus the carousel's band organ, the
// parade's marching band and the Big Dreams Live! show song. Each theme is
// a chord progression and a step sequencer; melodies are re-written every
// time the progression loops so the music never repeats exactly.
import { rng } from './engine.js';
import * as I from './instruments.js';

const Q = {
  maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9], dim: [0, 3, 6, 9],
};
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], blues: [0, 3, 5, 6, 7, 10], pent: [0, 2, 4, 7, 9], minpent: [0, 3, 5, 7, 10],
};

function pitchSet(key, intervals, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (intervals.includes(((m - key) % 12 + 12) % 12)) out.push(m);
  return out;
}

const RHYTHMS = {
  4: [[0, 4, 8, 12], [0, 6, 8, 12], [0, 3, 6, 8, 12], [0, 8, 10, 12], [0, 2, 4, 8, 12, 14], [0, 4, 6, 10], [0, 8, 12], [0, 4, 8, 10, 12, 14]],
  3: [[0, 4, 8], [0, 6, 8], [0, 8], [0, 4, 6, 8], [0, 2, 4, 8]],
};

export class Theme {
  constructor(E, def, dest, seed = 1) {
    this.E = E;
    this.def = def;
    this.dest = dest;
    this.r = rng(seed);
    this.running = false;
    this.loop = 0;
    this.prevNote = def.melodyLo + 7;
  }

  start(at) {
    this.running = true;
    this.nextTime = Math.max(at, this.E.now) + 0.06;
    this.bar = 0;
    this.step = 0;
    this.phrase = this.makePhrase();
  }

  stop() {
    this.running = false;
  }

  chord(bar) {
    const [off, q] = this.def.prog[bar % this.def.prog.length];
    const root = this.def.key + off;
    return { root, iv: Q[q], notes: Q[q].map((i) => root + i) };
  }

  // tones of the current chord within [lo, hi]
  chordTones(bar, lo, hi) {
    const c = this.chord(bar);
    return pitchSet(c.root, c.iv, lo, hi);
  }

  makePhrase() {
    const d = this.def;
    const beats = d.steps === 12 ? 3 : 4;
    const scale = pitchSet(d.key, SCALES[d.scale], d.melodyLo, d.melodyHi);
    const out = [];
    let prev = this.prevNote;
    const rhythms = [];
    for (let b = 0; b < d.prog.length; b++) {
      // bars 4-7 echo the rhythm of bars 0-3
      const rh = b >= 4 && this.r() < 0.75 ? rhythms[b - 4] : RHYTHMS[beats][Math.floor(this.r() * RHYTHMS[beats].length)];
      rhythms.push(rh);
      const tones = this.chordTones(b, d.melodyLo, d.melodyHi);
      const notes = [];
      rh.forEach((s, i) => {
        const strong = s % (d.steps / beats * 2) === 0;
        let m;
        if (strong || this.r() < 0.35) {
          m = tones.reduce((best, x) => (Math.abs(x - prev) < Math.abs(best - prev) ? x : best), tones[0]);
          if (this.r() < 0.3) m = tones[Math.min(tones.length - 1, Math.max(0, tones.indexOf(m) + (this.r() < 0.5 ? -1 : 1)))];
        } else {
          const idx = scale.reduce((bi, x, k) => (Math.abs(x - prev) < Math.abs(scale[bi] - prev) ? k : bi), 0);
          const step = [-2, -1, -1, 1, 1, 2][Math.floor(this.r() * 6)];
          m = scale[Math.min(scale.length - 1, Math.max(0, idx + step))];
        }
        const next = i + 1 < rh.length ? rh[i + 1] : d.steps;
        notes.push({ step: s, m, len: next - s });
        prev = m;
      });
      out.push(notes);
    }
    // land on the root at the end of the phrase
    const last = out[out.length - 1];
    if (last.length) {
      const root = pitchSet(d.key, [0], d.melodyLo, d.melodyHi);
      last[last.length - 1].m = root.reduce((b, x) => (Math.abs(x - prev) < Math.abs(b - prev) ? x : b), root[0]);
    }
    this.prevNote = prev;
    return out;
  }

  pump(ahead) {
    if (!this.running) return;
    const d = this.def;
    const sd = 60 / d.bpm / 4;
    while (this.nextTime < this.E.now + ahead) {
      let t = this.nextTime;
      if (d.swing && this.step % 2 === 1) t += sd * d.swing;
      try {
        d.play(this, this.bar, this.step, t, sd);
      } catch (e) {
        /* keep the music going */
      }
      this.nextTime += sd;
      this.step++;
      if (this.step >= d.steps) {
        this.step = 0;
        this.bar++;
        if (this.bar >= d.prog.length) {
          this.bar = 0;
          this.loop++;
          this.phrase = this.makePhrase();
        }
      }
    }
  }

  // play the generated melody with `fn(t, midi, seconds)`
  melody(bar, step, t, sd, fn, chance = 1) {
    for (const n of this.phrase[bar]) {
      if (n.step === step && (chance >= 1 || this.r() < chance)) fn(t, n.m, n.len * sd * 0.92);
    }
  }
}

// ------------------------------------------------------------- land themes
export const THEMES = {
  // Benton Plaza: a sunny Main Street rag
  Plaza: {
    bpm: 112, steps: 16, key: 53, scale: 'major', melodyLo: 65, melodyHi: 84,
    prog: [[0, 'maj'], [0, '6'], [9, '7'], [9, '7'], [2, '7'], [7, '7'], [0, 'maj'], [7, '7']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s === 0 || s === 8) I.piano(E, out, t, c.root - 12 + (s === 8 ? 7 : 0), sd * 3, 0.2);
      if (s === 4 || s === 12) c.notes.slice(0, 3).forEach((n) => I.piano(E, out, t, n + 12, sd * 2, 0.07));
      th.melody(bar, s, t, sd, (tt, m, len) => I.piano(E, out, tt, m, len, 0.11));
      if (th.loop % 2 === 1) th.melody(bar, s, t, sd, (tt, m) => I.glock(E, out, tt, m + 12, 0.035), 0.5);
      if (s === 4 || s === 12) I.brush(E, out, t, 0.05);
      if (s === 0) I.kick(E, out, t, 0.18);
    },
  },
  // Diesel District: a garage blues shuffle with a little industrial clank
  Diesel: {
    bpm: 96, steps: 16, swing: 0.32, key: 40, scale: 'blues', melodyLo: 64, melodyHi: 81,
    prog: [[0, '7'], [0, '7'], [5, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s % 2 === 0) {
        const riff = [0, 0, 7, 7, 9, 9, 7, 7][s / 2];
        I.bass(E, out, t, c.root + riff, sd * 1.6, 0.17, 380);
        I.strum(E, out, t, [c.root + 12 + riff, c.root + 19 + riff], 0.05, 0.15, 0.006, 0.18, 1200);
      }
      if (s === 0 || s === 8 || (s === 10 && bar % 2)) I.kick(E, out, t, 0.24);
      if (s === 4 || s === 12) I.snare(E, out, t, 0.11);
      if (s % 2 === 0) I.hat(E, out, t, 0.04);
      if (bar === 3 && s === 14) I.anvil(E, out, t, 0.05);
      if (bar % 4 >= 2) th.melody(bar, s, t, sd, (tt, m, len) => I.reed(E, out, tt, m, len, 0.06, 'harmonica'), 0.85);
    },
  },
  // Little Haulers: a bouncy toy-box tune
  Haulers: {
    bpm: 126, steps: 16, key: 60, scale: 'major', melodyLo: 72, melodyHi: 91,
    prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, '7'], [0, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s === 0 || s === 8) I.tuba(E, out, t, c.root - 24 + (s === 8 ? 7 : 0), sd * 2.5, 0.3);
      if (s % 4 === 2) I.woodblock(E, out, t, 0.09, s % 8 === 2 ? 900 : 1150);
      th.melody(bar, s, t, sd, (tt, m) => I.mallet(E, out, tt, m, 0.26, false));
      if (s === 4 || s === 12) c.notes.forEach((n) => I.mallet(E, out, t, n + 12, 0.035, true));
      if (s === 0 && bar % 2 === 0) I.glock(E, out, t, c.root + 36, 0.04);
    },
  },
  // Backwoods Junction: bluegrass banjo rolls and a fiddle
  Backwoods: {
    bpm: 132, steps: 16, key: 55, scale: 'pent', melodyLo: 67, melodyHi: 86,
    prog: [[0, 'maj'], [0, 'maj'], [5, 'maj'], [0, 'maj'], [0, 'maj'], [7, 'maj'], [0, 'maj'], [0, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s % 2 === 0) {
        // forward roll: thumb, index, middle over the chord with the high G drone
        const roll = [c.root + 12, c.root + 16 + (c.iv[1] - 4), 67, c.root + 19, c.root + 24, 67, c.root + 16 + (c.iv[1] - 4), 67][s / 2];
        I.pluck(E, out, t, roll, 0.26, 0.92, 0.5);
      }
      if (s === 0 || s === 8) I.pluck(E, out, t, c.root - 12 + (s === 8 ? 7 : 0), 0.42, 0.25, 1.0);
      if (s === 4 || s === 12) I.strum(E, out, t, c.notes.map((n) => n + 12), 0.09, 0.45, 0.012, 0.25);
      if (th.loop % 2 === 1 || bar >= 4) th.melody(bar, s, t, sd, (tt, m, len) => I.reed(E, out, tt, m, len, 0.07, 'fiddle'));
    },
  },
  // Benton Movie Studios: a big-band swing number
  Studios: {
    bpm: 120, steps: 16, swing: 0.33, key: 58, scale: 'major', melodyLo: 65, melodyHi: 84,
    prog: [[0, '6'], [9, '7'], [2, 'm7'], [7, '7'], [4, 'm7'], [9, '7'], [2, 'm7'], [7, '7']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s % 4 === 0) {
        const walk = [0, c.iv[1], 7, s === 12 ? 11 : c.iv[2] + (c.iv[3] ? 3 : 0)][s / 4];
        I.bass(E, out, t, c.root - 12 + (walk % 12) - (walk > 7 ? 12 : 0), sd * 3.4, 0.18, 600);
      }
      if (s === 0 || s === 4 || s === 6 || s === 8 || s === 12 || s === 14) I.ride(E, out, t, 0.035);
      if (s === 4 || s === 12) I.hat(E, out, t, 0.03);
      if ((s === 6 && bar % 2 === 1) || (s === 14 && bar % 4 === 2)) c.notes.forEach((n) => I.brass(E, out, t, n + 12, sd * 1.5, 0.034));
      if (s === 0 && bar % 4 === 0) I.timpani(E, out, t, c.root - 12, 0.1);
      if (s === 2 || s === 10) c.notes.forEach((n) => I.piano(E, out, t, n, sd, 0.035));
      if (th.loop % 2 === 1 || bar < 4) th.melody(bar, s, t, sd, (tt, m, len) => I.brass(E, out, tt, m, len, 0.04, 0.9));
    },
  },
  // Velocity City: driving synthwave
  Velocity: {
    bpm: 124, steps: 16, key: 57, scale: 'minor', melodyLo: 69, melodyHi: 88,
    prog: [[0, 'min'], [0, 'min'], [-4, 'maj'], [-4, 'maj'], [3, 'maj'], [3, 'maj'], [-2, 'maj'], [-2, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      const arp = [0, 1, 2, 1, 0, 2, 1, 2];
      const n = c.notes[arp[s % 8] % c.notes.length] + 12 + (s >= 8 ? 12 : 0);
      I.lead(E, out, t, n, sd * 0.8, 0.028, 'sawtooth', 1800 + 900 * Math.sin(bar));
      if (s % 2 === 0) I.bass(E, out, t, c.root - 12 + (s % 4 === 2 ? 12 : 0), sd * 1.4, 0.2, 700);
      if (s % 4 === 0) I.kick(E, out, t, 0.28);
      if (s === 4 || s === 12) I.clap(E, out, t, 0.09);
      if (s % 4 === 2) I.hat(E, out, t, 0.05, s === 14);
      if (s === 0 && bar % 2 === 0) I.pad(E, out, t, c.notes.map((x) => x + 12), sd * 32, 0.022, 1600);
      if (th.loop % 2 === 1) th.melody(bar, s, t, sd, (tt, m, len) => I.lead(E, out, tt, m, len, 0.05, 'square', 2600));
    },
  },
  // Benton Family Landing: a gentle lakeside waltz
  Family: {
    bpm: 98, steps: 12, key: 62, scale: 'major', melodyLo: 69, melodyHi: 88,
    prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj'], [5, 'maj'], [7, '7']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s === 0) {
        I.bass(E, out, t, c.root - 12, sd * 5, 0.16, 420);
        I.pad(E, out, t, c.notes, sd * 12, 0.022, 1100);
      }
      if (s % 2 === 0) {
        const arp = [0, 1, 2, 1, 2, 1][s / 2];
        I.mallet(E, out, t, c.notes[arp % c.notes.length] + 12, 0.08, true);
      }
      if (s === 4 || s === 8) I.shaker(E, out, t, 0.025);
      th.melody(bar, s, t, sd, (tt, m, len) => I.flute(E, out, tt, m, len, 0.06));
    },
  },
};

// ------------------------------------------------- positional music sources
export const SOURCES = {
  // the Gearwheel Carousel's band organ
  Carousel: {
    bpm: 150, steps: 12, key: 60, scale: 'major', melodyLo: 72, melodyHi: 91,
    prog: [[0, 'maj'], [0, 'maj'], [7, '7'], [7, '7'], [7, '7'], [7, '7'], [0, 'maj'], [0, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s === 0) I.organ(E, out, t, c.root - 12, sd * 3.5, 0.12);
      if (s === 4 || s === 8) c.notes.forEach((n) => I.organ(E, out, t, n, sd * 2.5, 0.04));
      th.melody(bar, s, t, sd, (tt, m, len) => I.organ(E, out, tt, m, len, 0.08));
      if (s === 0) I.bell(E, out, t, c.root + 24, 0.02);
    },
  },
  // the Big Rig Parade's marching band
  Parade: {
    bpm: 116, steps: 16, key: 58, scale: 'major', melodyLo: 65, melodyHi: 84,
    prog: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, '7'], [0, 'maj'], [5, 'maj'], [7, '7'], [0, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s % 8 === 0) I.tuba(E, out, t, c.root - 24 + (s === 8 ? 7 : 0), sd * 3, 0.3);
      if (s % 2 === 0) I.snare(E, out, t, s % 4 === 0 ? 0.12 : 0.06);
      if (s === 0 || s === 8) I.kick(E, out, t, 0.25);
      th.melody(bar, s, t, sd, (tt, m, len) => I.brass(E, out, tt, m, len, 0.07, 1.1));
      th.melody(bar, s, t, sd, (tt, m) => I.glock(E, out, tt, m + 12, 0.03));
    },
  },
  // Big Dreams Live! at the Lakeside Stage
  ShowSong: {
    bpm: 118, steps: 16, key: 60, scale: 'major', melodyLo: 64, melodyHi: 79,
    prog: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj'], [5, 'maj'], [7, 'maj']],
    play(th, bar, s, t, sd) {
      const E = th.E, out = th.dest, c = th.chord(bar);
      if (s % 4 === 0) I.kick(E, out, t, 0.32);
      if (s === 4 || s === 12) I.snare(E, out, t, 0.14);
      if (s % 2 === 1) I.hat(E, out, t, 0.04);
      if (s % 2 === 0) I.bass(E, out, t, c.root - 24 + (s % 8 === 6 ? 7 : 0), sd * 1.6, 0.22, 600);
      if (s === 0 || s === 6 || s === 10) c.notes.forEach((n) => I.piano(E, out, t, n + 12, sd * 3, 0.05));
      th.melody(bar, s, t, sd, (tt, m, len) => I.voice(E, out, tt, m, len, 0.06, ['a', 'o', 'e', 'oo'][bar % 4]));
      if (s === 0 && bar === 0) I.glock(E, out, t, c.root + 24, 0.06);
    },
  },
};
