// Park clock (the Roblox version's Clock.luau rules, with a longer day in
// the browser): a park minute lasts MINUTE real seconds through the day
// (DAY_START to DAY_END), and the night runs NIGHT_SPEED times faster.
let C = { DAY_START: 480, DAY_END: 1380, NIGHT_SPEED: 4, OPEN: 540, CLOSE: 1320, MINUTE: 1 };
const MIN = () => C.MINUTE || 1;
let epoch = 0;
let speed = 1;
let offset = 0; // seconds added by "skip ahead"

export function configure(cfg) {
  C = cfg;
}

const DAY_SECONDS = () => (C.DAY_END - C.DAY_START) * MIN();
const NIGHT_SECONDS = () => ((1440 - (C.DAY_END - C.DAY_START)) * MIN()) / C.NIGHT_SPEED;
export const cycleSeconds = () => DAY_SECONDS() + NIGHT_SECONDS();

// "Server time" in seconds.
export function now() {
  return performance.now() / 1000 * speed + offset;
}

export function start(startMinute = 540) {
  epoch = now() - (startMinute - C.DAY_START) * MIN();
}

export function skip(seconds) {
  offset += seconds;
}

export function minutesAt(t) {
  const u = ((t - epoch) % cycleSeconds() + cycleSeconds()) % cycleSeconds();
  if (u < DAY_SECONDS()) return C.DAY_START + u / MIN();
  return (C.DAY_END + ((u - DAY_SECONDS()) * C.NIGHT_SPEED) / MIN()) % 1440;
}

export function minutes() {
  return minutesAt(now());
}

export function secondsUntil(minute) {
  const u = ((now() - epoch) % cycleSeconds() + cycleSeconds()) % cycleSeconds();
  let target;
  if (minute >= C.DAY_START && minute < C.DAY_END) target = (minute - C.DAY_START) * MIN();
  else {
    let m = minute;
    if (m < C.DAY_START) m += 1440;
    target = DAY_SECONDS() + ((m - C.DAY_END) * MIN()) / C.NIGHT_SPEED;
  }
  let d = target - u;
  if (d < 0) d += cycleSeconds();
  return d;
}

// park minutes until a time of day
export function minutesUntil(minute) {
  return (((minute - minutes()) % 1440) + 1440) % 1440;
}

export function cycleIndex() {
  return Math.floor((now() - epoch) / cycleSeconds());
}

export function format(minute) {
  const m = Math.floor(minute) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

export function crowd(minute) {
  const h = minute / 60;
  if (h < 8 || h >= 23) return 0.08;
  if (h < 9) return 0.15 + (h - 8) * 0.25;
  if (h < 12) return 0.4 + (h - 9) / 3 * 0.55;
  if (h < 17) return 0.95 + Math.sin((h - 12) / 5 * Math.PI) * 0.2;
  if (h < 21) return 0.95 - (h - 17) / 4 * 0.35;
  return 0.6 - (h - 21) / 2 * 0.45;
}
