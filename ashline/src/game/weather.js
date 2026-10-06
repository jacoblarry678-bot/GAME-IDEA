/**
 * Dynamic weather (simulation side). Runs inside the Match so it is the same
 * offline, on a dedicated server (synced to clients) and in headless tests.
 *
 * State is a set of 0..1 channels that blend toward the current weather
 * kind's preset. Gameplay effect: fog and rain shorten how far bots can see.
 */
export const WEATHER_KINDS = ['clear', 'overcast', 'rain', 'storm', 'fog'];
export const WEATHER_NAMES = { dynamic: 'Dynamic', clear: 'Clear', overcast: 'Overcast', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog' };

const PRESETS = {
  clear: { cloud: 0, rain: 0, fog: 0, storm: 0, wind: 0.15 },
  overcast: { cloud: 0.75, rain: 0, fog: 0.15, storm: 0, wind: 0.35 },
  rain: { cloud: 0.88, rain: 0.65, fog: 0.3, storm: 0, wind: 0.55 },
  storm: { cloud: 1, rain: 1, fog: 0.42, storm: 1, wind: 1 },
  fog: { cloud: 0.55, rain: 0, fog: 1, storm: 0, wind: 0.08 },
};

// dynamic transitions: where the weather can go next (weighted)
const NEXT = {
  clear: [['overcast', 3], ['fog', 1]],
  overcast: [['rain', 3], ['clear', 2], ['fog', 1]],
  rain: [['storm', 2], ['overcast', 2]],
  storm: [['rain', 3]],
  fog: [['overcast', 2], ['clear', 1]],
};

export const BASE_SIGHT = 95;
/** Choices offered in match setup ('dynamic' cycles; the rest stay fixed). */
export const WEATHER_OPTIONS = ['dynamic', 'clear', 'overcast', 'rain', 'storm', 'fog'];

export class Weather {
  /** mode: 'dynamic' or a fixed kind. */
  constructor(mode = 'dynamic', rng = Math.random) {
    this.mode = PRESETS[mode] || mode === 'dynamic' ? mode : 'dynamic';
    this.rng = rng;
    this.kind = this.mode === 'dynamic' ? (rng() < 0.55 ? 'clear' : rng() < 0.5 ? 'overcast' : 'fog') : this.mode;
    this.cur = { ...PRESETS[this.kind] };
    this.next = 50 + rng() * 50; // seconds until the next change
    this.t = 0;
  }

  /** Advance; returns the new kind when the weather starts changing, else null. */
  update(dt) {
    let changed = null;
    if (this.mode === 'dynamic') {
      this.t += dt;
      if (this.t >= this.next) {
        this.t = 0;
        this.next = 55 + this.rng() * 65;
        const opts = NEXT[this.kind];
        let r = this.rng() * opts.reduce((a, [, w]) => a + w, 0);
        for (const [k, w] of opts) { r -= w; if (r <= 0) { this.kind = k; break; } }
        changed = this.kind;
      }
    }
    // blend channels toward the preset over ~20 s
    const p = PRESETS[this.kind], k = Math.min(1, dt / 20 * 3);
    for (const ch of Object.keys(p)) this.cur[ch] += (p[ch] - this.cur[ch]) * k;
    return changed;
  }

  /** How far bots can pick out a target (m). */
  sightRange() {
    const c = this.cur;
    return BASE_SIGHT * Math.max(0.35, 1 - c.fog * 0.55 - c.rain * 0.18 - c.storm * 0.07);
  }

  /** Network form: [kindIndex, cloud, rain, fog, storm, wind]. */
  pack() { const c = this.cur; return [WEATHER_KINDS.indexOf(this.kind), r2(c.cloud), r2(c.rain), r2(c.fog), r2(c.storm), r2(c.wind)]; }
  unpack(a) {
    if (!Array.isArray(a)) return;
    const k = WEATHER_KINDS[a[0]];
    if (k && k !== this.kind) this.kind = k;
    Object.assign(this.cur, { cloud: a[1], rain: a[2], fog: a[3], storm: a[4], wind: a[5] });
  }
}

function r2(v) { return Math.round(v * 100) / 100; }
