// Park simulation for the browser edition: ride queues shared with
// simulated guests, posted waits, dispatching, shows, shops, food, hunger
// and the saved profile. Mirrors the Roblox server's rules.
import * as Clock from './clock.js';

const SAVE_KEY = 'bentonDieselWorld.v1';

function roundUp5(m) {
  return Math.max(5, Math.ceil(m / 5) * 5);
}

function loadProfile(economy) {
  let p = null;
  try {
    p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch (e) {
    p = null;
  }
  const base = {
    bucks: economy.StartingBucks,
    passes: economy.StartingPasses,
    owned: [],
    equipped: { hat: '', face: '', balloon: '', held: '' },
    stamps: [],
    stats: { rides: 0, shows: 0, meals: 0 },
    lastDaily: 0,
    look: { shirt: 0x1e6ee6, pants: 0x283c6e, skin: 0xffcc99 },
    seenHelp: false,
  };
  if (!p || typeof p !== 'object') return base;
  return { ...base, ...p, equipped: { ...base.equipped, ...(p.equipped || {}) }, stats: { ...base.stats, ...(p.stats || {}) }, look: { ...base.look, ...(p.look || {}) } };
}

export class Sim {
  constructor(data, hooks) {
    this.cfg = data.config;
    this.hooks = hooks; // { toast, startRide, endRide, onProfile, showStarted }
    this.profile = loadProfile(this.cfg.Economy);
    this.hunger = this.cfg.Hunger.Max;
    this.buffs = [];
    this.food = []; // { id, bites }
    this.rides = new Map();
    this.order = [];
    for (const r of data.rides) {
      const cfg = this.cfg.Rides.find((c) => c.id === r.id);
      const capacity = r.seats.reduce((n, list) => n + list.length, 0);
      const seatList = [];
      r.seats.forEach((list, ci) => list.forEach((_, si) => seatList.push([ci + 1, si + 1])));
      const duration = r.kind === 'karts' ? (cfg.duration ?? 34) : r.duration;
      const st = {
        id: r.id, cfg, capacity, seatList, duration,
        queue: [], status: 'Open', cycleStart: 0, cycleEnds: 0, riders: [], downUntil: 0, player: null, cycleId: 0,
      };
      this.rides.set(r.id, st);
      this.order.push(st);
    }
    this.shows = this.cfg.Shows.map((s) => ({ ...s, start: 0, running: false, watched: false, checks: 0 }));
    this.played = new Set();
    this.queueRide = null;
    this.ridingRide = null;
    this.nextCrowd = 0;
    this.nextHunger = Clock.now() + this.cfg.Hunger.DrainInterval;
    this.nextPlaytime = Clock.now() + this.cfg.Economy.PlaytimeInterval;
    for (let i = 0; i < 6; i++) this.simulateCrowd(true);
  }

  // ---------------------------------------------------------------- save
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      /* storage blocked: progress lasts this visit only */
    }
    this.hooks.onProfile?.();
  }

  dailyBonus() {
    const today = Math.floor(Date.now() / 86400000);
    if (this.profile.lastDaily !== today) {
      this.profile.lastDaily = today;
      this.addBucks(this.cfg.Economy.DailyBonus, 'Welcome to Benton Diesel World! Daily visit bonus');
    }
  }

  addBucks(n, reason) {
    this.profile.bucks += n;
    this.save();
    if (reason) this.hooks.toast(reason, 'reward', n);
  }

  owns(id) {
    return this.profile.owned.includes(id);
  }

  // --------------------------------------------------------------- rides
  cycleTotal(st) {
    return this.cfg.BoardingTime + st.duration + this.cfg.UnloadTime;
  }

  eta(st, pos) {
    const cap = Math.max(1, st.capacity);
    const ahead = Math.floor((pos - 1) / cap);
    const now = Clock.now();
    const current = st.status === 'Boarding' || st.status === 'Running' || st.status === 'Unloading' ? Math.max(0, st.cycleEnds - now) : 0;
    return current + ahead * this.cycleTotal(st);
  }

  postedWait(st) {
    return roundUp5(this.eta(st, st.queue.length + 1));
  }

  rideState(id) {
    const st = this.rides.get(id);
    return { status: st.status, wait: this.postedWait(st), queue: st.queue.length };
  }

  playerQueue() {
    if (!this.queueRide) return null;
    const st = this.rides.get(this.queueRide);
    const pos = st.queue.findIndex((e) => e.player) + 1;
    if (pos <= 0) return null;
    return { ride: st.cfg, pos, eta: Math.ceil(this.eta(st, pos)) };
  }

  join(id, express) {
    const st = this.rides.get(id);
    if (!st) return;
    if (this.ridingRide) {
      this.hooks.toast('Finish your current ride first!', 'warn');
      return;
    }
    if (this.queueRide === id && !express) {
      this.hooks.toast(`You're already in line for ${st.cfg.name}.`, 'info');
      return;
    }
    if (this.queueRide) this.leave(true);
    if (express) {
      if (this.profile.passes <= 0) {
        this.hooks.toast("You don't have any Express Passes. Buy them at the shops!", 'warn');
        return;
      }
      this.profile.passes -= 1;
      this.save();
      let at = 0;
      st.queue.forEach((e, i) => { if (e.express) at = i + 1; });
      st.queue.splice(at, 0, { player: true, express: true });
      this.hooks.toast(`Express Pass used! You're near the front for ${st.cfg.name}.`, 'reward');
    } else {
      st.queue.push({ player: true });
      const wait = Math.max(1, Math.ceil(this.eta(st, st.queue.length)));
      this.hooks.toast(`You joined the line for ${st.cfg.name}. Estimated wait: ${wait} min.`, 'info');
    }
    this.queueRide = id;
    if (st.status === 'Closed') this.hooks.toast(`${st.cfg.name} is temporarily closed. Hang tight - you'll keep your place!`, 'warn');
  }

  leave(quiet) {
    if (!this.queueRide) return;
    const st = this.rides.get(this.queueRide);
    st.queue = st.queue.filter((e) => !e.player);
    if (!quiet) this.hooks.toast(`You left the line for ${st.cfg.name}.`, 'info');
    this.queueRide = null;
  }

  dispatch(st, now) {
    const riders = [];
    while (riders.length < st.capacity && st.queue.length) {
      const e = st.queue.shift();
      riders.push(e.player ? { player: true } : { npc: e.seed });
    }
    if (!riders.length) return;
    let next = 0;
    const used = new Set();
    for (const r of riders) {
      if (r.player) {
        const [c, s] = st.seatList[next++];
        r.car = c; r.seat = s;
        used.add(`${c}:${s}`);
      }
    }
    const free = st.seatList.filter(([c, s]) => !used.has(`${c}:${s}`));
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    let fi = 0;
    for (const r of riders) {
      if (!r.player) {
        const seat = free[fi++];
        if (seat) { r.car = seat[0]; r.seat = seat[1]; }
      }
    }
    st.riders = riders;
    st.cycleId += 1;
    st.status = 'Boarding';
    st.cycleStart = now + this.cfg.BoardingTime;
    st.cycleEnds = st.cycleStart + st.duration + this.cfg.UnloadTime;
    const me = riders.find((r) => r.player);
    if (me) {
      this.queueRide = null;
      this.ridingRide = st.id;
      st.player = me;
      this.hooks.startRide(st.id, me.car, me.seat);
      this.hooks.toast(`Now boarding ${st.cfg.name}! Keep your arms and legs inside the vehicle.`, 'info');
    }
  }

  finishRide(st) {
    if (!st.player) return;
    st.player = null;
    this.ridingRide = null;
    this.hooks.endRide(st.id);
    const p = this.profile;
    p.stats.rides += 1;
    const first = !p.stamps.includes(st.id);
    const E = this.cfg.Economy;
    if (first) {
      p.stamps.push(st.id);
      this.addBucks(E.RideReward + E.FirstRideBonus, `New passport stamp: ${st.cfg.name}!`);
      const land = this.cfg.Lands.find((l) => l.id === st.cfg.land);
      const all = this.cfg.Rides.filter((r) => r.land === st.cfg.land).every((r) => p.stamps.includes(r.id));
      if (all) this.addBucks(E.LandCompleteBonus, `You rode everything in ${land ? land.name : 'this land'}!`);
    } else {
      this.addBucks(E.RideReward, `Thanks for riding ${st.cfg.name}!`);
    }
  }

  simulateCrowd(warmup) {
    const minute = Clock.minutes();
    const crowd = Clock.crowd(minute);
    const t = Clock.now();
    this.order.forEach((st, i) => {
      const wobble = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t / 90 + i * 7.31) * Math.cos(t / 57 + i));
      const target = st.cfg.baseWait * crowd * wobble;
      const desired = Math.floor(target / this.cycleTotal(st) * st.capacity);
      const npcs = st.queue.filter((e) => !e.player).length;
      if (npcs < desired) {
        const add = Math.min(desired - npcs, Math.max(1, Math.ceil(st.capacity / 4)));
        for (let k = 0; k < add; k++) st.queue.push({ seed: 1 + Math.floor(Math.random() * 1e6) });
      } else if (npcs > desired + st.capacity) {
        for (let k = st.queue.length - 1; k >= 0; k--) {
          if (!st.queue[k].player) { st.queue.splice(k, 1); break; }
        }
      }
      if (!warmup && st.status === 'Open' && !st.player && Math.random() < 0.004) {
        st.status = 'Closed';
        st.downUntil = t + 40 + Math.random() * 40;
        if (this.queueRide === st.id) this.hooks.toast(`${st.cfg.name} is temporarily closed. Our mechanics are on it!`, 'warn');
      }
    });
  }

  updateRides(now) {
    for (const st of this.order) {
      if (st.status === 'Closed') {
        if (now >= st.downUntil) {
          st.status = 'Open';
          if (this.queueRide === st.id) this.hooks.toast(`${st.cfg.name} has reopened!`, 'info');
        }
        continue;
      }
      if (st.status === 'Open' && st.queue.length) this.dispatch(st, now);
      else if (st.status === 'Boarding' && now >= st.cycleStart) st.status = 'Running';
      else if (st.status === 'Running' && now >= st.cycleStart + st.duration) {
        st.status = 'Unloading';
        this.finishRide(st);
      } else if (st.status === 'Unloading' && now >= st.cycleEnds) {
        st.status = 'Open';
        st.riders = [];
      }
    }
  }

  // time since dispatch for animation (0 = resting)
  rideTime(id, now) {
    const st = this.rides.get(id);
    if (st.status === 'Running' && now >= st.cycleStart) return Math.min(now - st.cycleStart, st.duration);
    return 0;
  }

  // --------------------------------------------------------------- shows
  showStatus(show) {
    if (show.running) return { now: true, text: 'NOW PLAYING!' };
    let best = Infinity, bestTime = 0;
    for (const t of show.times) {
      const s = Clock.secondsUntil(t);
      if (s < best) { best = s; bestTime = t; }
    }
    return { now: false, text: `Next show ${Clock.format(bestTime)} (in ${Math.ceil(best)} min)`, seconds: best };
  }

  startShow(show) {
    if (show.running) return;
    show.running = true;
    show.start = Clock.now();
    show.watched = false;
    show.checks = 0;
    this.hooks.toast(`${show.name} is starting now at ${show.venue}!`, 'show');
    this.hooks.showStarted?.(show);
  }

  updateShows(now, playerPos) {
    const minute = Clock.minutes();
    const cycle = Clock.cycleIndex();
    for (const show of this.shows) {
      for (const t of show.times) {
        const key = `${show.id}:${cycle}:${t}`;
        if (!this.played.has(key) && minute >= t && minute < t + 2) {
          this.played.add(key);
          this.startShow(show);
        }
      }
      if (show.running) {
        const t = now - show.start;
        const marks = [0.35, 0.7, 1.0];
        while (show.checks < marks.length && t >= show.duration * marks[show.checks]) {
          const dx = playerPos.x - show.viewing[0], dz = playerPos.z - show.viewing[2];
          if (Math.hypot(dx, dz) <= show.viewRadius) show.watched = true;
          show.checks += 1;
        }
        if (t >= show.duration) {
          show.running = false;
          if (show.watched) {
            this.profile.stats.shows += 1;
            this.addBucks(this.cfg.Economy.ShowReward, `Bravo! Thanks for watching ${show.name}.`);
          }
        }
      }
    }
  }

  // ------------------------------------------------------- shops and food
  buy(venueId, itemId) {
    const venue = this.cfg.Venues.find((v) => v.id === venueId);
    const item = this.cfg.Items.find((i) => i.id === itemId);
    if (!venue || !item || !venue.items.includes(itemId)) return false;
    const wearable = ['hat', 'face', 'balloon', 'held'].includes(item.kind);
    if (wearable && this.owns(item.id)) {
      this.hooks.toast(`You already own the ${item.name}. Equip it from your Bag!`, 'info');
      return false;
    }
    if (item.kind === 'food' && this.food.length >= 3) {
      this.hooks.toast('Your hands are full! Finish some food first.', 'warn');
      return false;
    }
    if (this.profile.bucks < item.price) {
      this.hooks.toast(`Not enough ${this.cfg.Currency}. Ride rides and watch shows to earn more!`, 'warn');
      return false;
    }
    this.profile.bucks -= item.price;
    if (item.kind === 'pass') {
      this.profile.passes += 1;
      this.hooks.toast('Express Pass added! Press F (or tap Express) at any ride entrance.', 'reward');
    } else if (item.kind === 'food') {
      this.food.push({ id: item.id, bites: item.bites ?? 3 });
      this.hooks.toast(`Order up! ${item.name} is in your backpack.`, 'info');
    } else {
      this.profile.owned.push(item.id);
      this.profile.equipped[item.kind] = item.id;
      this.hooks.toast(`You bought the ${item.name}${item.kind === 'held' ? ' - it is in your hand!' : ' and put it on!'}`, 'reward');
    }
    this.save();
    return true;
  }

  equip(slot, itemId) {
    if (itemId && !this.owns(itemId)) return;
    this.profile.equipped[slot] = itemId || '';
    this.save();
  }

  eat(index) {
    const f = this.food[index];
    if (!f) return;
    const item = this.cfg.Items.find((i) => i.id === f.id);
    const total = item.bites ?? 3;
    if (item.buff && f.bites === total) {
      this.buffs.push({ kind: item.buff.kind, amount: item.buff.amount, until: Clock.now() + item.buff.duration });
      this.hooks.toast(`${item.buff.kind === 'speed' ? 'Speed' : 'Jump'} boost for ${item.buff.duration} seconds!`, 'reward');
    }
    this.hunger = Math.min(this.cfg.Hunger.Max, this.hunger + Math.ceil((item.hunger ?? 20) / total));
    f.bites -= 1;
    if (f.bites <= 0) {
      this.food.splice(index, 1);
      this.profile.stats.meals += 1;
      this.save();
      this.hooks.toast(`Yum! You finished your ${item.name}.`, 'info');
    }
  }

  movement() {
    const H = this.cfg.Hunger;
    let speed = this.hunger <= 0 ? H.HungrySpeed : H.NormalSpeed;
    let jump = 0;
    const now = Clock.now();
    this.buffs = this.buffs.filter((b) => b.until > now);
    for (const b of this.buffs) {
      if (b.kind === 'speed') speed += b.amount;
      if (b.kind === 'jump') jump += b.amount;
    }
    return { speed, jump, boost: this.buffs.length ? this.buffs[this.buffs.length - 1].kind : '' };
  }

  // ---------------------------------------------------------------- tick
  update(playerPos) {
    const now = Clock.now();
    if (now >= this.nextCrowd) {
      this.nextCrowd = now + 2;
      this.simulateCrowd(false);
    }
    this.updateRides(now);
    this.updateShows(now, playerPos);
    if (now >= this.nextHunger) {
      this.nextHunger = now + this.cfg.Hunger.DrainInterval;
      const before = this.hunger;
      this.hunger = Math.max(0, this.hunger - 1);
      if (this.hunger === this.cfg.Hunger.HungryAt && before > this.hunger) this.hooks.toast("Your tummy is rumbling! Grab a bite at one of the park's restaurants.", 'warn');
      else if (this.hunger === 0 && before > 0) this.hooks.toast("You're too hungry to hurry. Eat something to get your speed back!", 'warn');
    }
    if (now >= this.nextPlaytime) {
      this.nextPlaytime = now + this.cfg.Economy.PlaytimeInterval;
      this.addBucks(this.cfg.Economy.PlaytimeReward, 'Thanks for spending time at the park!');
    }
  }
}
