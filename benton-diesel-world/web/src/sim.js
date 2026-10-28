// Park simulation for the browser edition: ride queues shared with
// simulated guests, posted waits, dispatching, shows, shops, food, hunger
// and the saved profile. Mirrors the Roblox server's rules.
import * as Clock from './clock.js';
import { QueuePath, slotAt, EXPRESS_SIDE, FOTL_SIDE, FOTL } from './queue.js';

const SAVE_KEY = 'bentonDieselWorld.v1';
// You have unlimited Express Passes: they never run out.
export const UNLIMITED_EXPRESS = true;

// Waits are posted in real minutes: a 45 minute wait is 45 minutes of
// standing in line.
const realMinutes = (seconds) => Math.max(0, seconds) / 60;

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
    look: { shirt: 0x1e6ee6, pants: 0x283c6e, skin: 0xe8b996, hair: 0x4a3020, hairStyle: 0, build: 0 },
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
    this.paths = new Map(); // ride id -> QueuePath through its queue maze
    this.spacing = data.queue?.spacing ?? 2.5;
    this.entryId = 0;
    for (const r of data.rides) {
      if (r.queue) this.paths.set(r.id, new QueuePath(r.queue));
      const cfg = this.cfg.Rides.find((c) => c.id === r.id);
      const capacity = r.seats.reduce((n, list) => n + list.length, 0);
      const seatList = [];
      r.seats.forEach((list, ci) => list.forEach((_, si) => seatList.push([ci + 1, si + 1])));
      const duration = r.kind === 'karts' ? (cfg.duration ?? 34) : r.duration;
      // each spot in line is one party, and every train takes the party at
      // the front plus enough other guests to fill it, so the line moves
      // up one spot per dispatch; haunted houses send groups of four through
      // their long mazes. The maze holds this many parties.
      const party = r.party ?? (r.kind === 'walkthrough' ? 4 : 1);
      const gap = this.spacing * party;
      const path = this.paths.get(r.id);
      const slots = path ? Math.max(4, Math.floor((path.length - 8) / gap)) : 40;
      const st = {
        id: r.id, cfg, capacity, seatList, duration, slots, party, gap,
        queue: [], express: [], fotl: null, status: 'Open', cycleStart: 0, cycleEnds: 0, riders: [], downUntil: 0, player: null, cycleId: 0,
      };
      // closed for a refurbishment: no line, no running
      if (cfg.refurb) Object.assign(st, { refurb: true, status: 'Closed', downUntil: Infinity });
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
    for (let i = 0; i < 20; i++) this.simulateCrowd(true);
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

  // Seconds until the party at position `pos` in line boards: what is left
  // of the train out now (or of a breakdown), then one full cycle for every
  // party ahead of them (each fills a train).
  eta(st, pos) {
    const ahead = Math.max(0, pos - 1);
    const now = Clock.now();
    let current = st.status === 'Boarding' || st.status === 'Running' || st.status === 'Unloading' ? Math.max(0, st.cycleEnds - now) : 0;
    if (st.status === 'Closed' && Number.isFinite(st.downUntil)) current = Math.max(0, st.downUntil - now);
    return current + ahead * this.cycleTotal(st);
  }

  // The posted wait in real minutes for a guest joining now, exact to the
  // minute (no rounding up).
  postedWait(st) {
    return Math.round(realMinutes(this.eta(st, st.queue.length + 1)));
  }

  // the Express line: one Express party boards with every train
  expressWait(st) {
    return Math.round(realMinutes(this.eta(st, st.express.length + 1)));
  }

  // Front of the Line: the very next train
  fotlWait(st) {
    return Math.round(realMinutes(this.eta(st, 1)));
  }

  rideState(id) {
    const st = this.rides.get(id);
    return {
      status: st.status, wait: this.postedWait(st), queue: st.queue.length, refurb: !!st.refurb, lastWait: st.lastWait ?? null,
      express: this.expressWait(st), fotl: this.fotlWait(st), extended: this.extendedOpen(st),
    };
  }

  // is the line long enough to have spilled into the extended queue?
  extendedOpen(st) {
    const path = this.paths.get(st.id);
    return !!(path?.extendedAt && slotAt(st.queue.length, st.gap) > path.extendedAt);
  }

  // which Front of the Line ticket a ride takes, and whether you have it
  fotlTicket(st) {
    return st.cfg.kind === 'walkthrough' ? FOTL.haunt : FOTL.ride;
  }

  hasFotl(id) {
    const st = this.rides.get(id);
    return !!st && this.owns(this.fotlTicket(st));
  }

  // where the player is: which lane, and how far from the front
  playerEntry() {
    if (!this.queueRide) return null;
    const st = this.rides.get(this.queueRide);
    if (st.fotl?.player) return { st, lane: 'fotl', index: 0 };
    let index = st.express.findIndex((e) => e.player);
    if (index >= 0) return { st, lane: 'express', index };
    index = st.queue.findIndex((e) => e.player);
    if (index >= 0) return { st, lane: 'standby', index };
    return null;
  }

  playerQueue() {
    const e = this.playerEntry();
    if (!e) return null;
    return { ride: e.st.cfg, pos: e.index + 1, lane: e.lane, eta: Math.round(realMinutes(this.eta(e.st, e.index + 1))) };
  }

  // mode: false (standby), true or 'express', or 'fotl'
  join(id, mode) {
    const express = mode === true || mode === 'express';
    const fotl = mode === 'fotl';
    const st = this.rides.get(id);
    if (!st) return;
    if (st.refurb) {
      this.hooks.toast(`${st.cfg.name} is closed for a small refurbishment. It'll be back very soon!`, 'warn');
      return;
    }
    if (this.ridingRide) {
      this.hooks.toast('Finish your current ride first!', 'warn');
      return;
    }
    const here = this.playerEntry();
    if (this.queueRide === id && ((!express && !fotl) || (express && here?.lane === 'express') || (fotl && here?.lane === 'fotl'))) {
      this.hooks.toast(`You're already in line for ${st.cfg.name}.`, 'info');
      return;
    }
    if (fotl && !this.owns(this.fotlTicket(st))) {
      const item = this.cfg.Items.find((i) => i.id === this.fotlTicket(st));
      this.hooks.toast(`You need a ${item ? item.name : 'Front of the Line'} ticket for this. Get one at the shops!`, 'warn');
      return;
    }
    if (this.queueRide) this.leave(true);
    if (fotl) {
      this.hooks.sound?.('express');
      st.fotl = { id: 'player', player: true, fotl: true, at: Clock.now() };
      this.hooks.toast(`Front of the Line! Walk straight to the ${st.cfg.kind === 'walkthrough' ? 'door' : 'boarding gate'} - you're on the next ${st.cfg.kind === 'walkthrough' ? 'group' : 'train'} for ${st.cfg.name}.`, 'reward');
    } else if (express) {
      if (!UNLIMITED_EXPRESS && this.profile.passes <= 0) {
        this.hooks.toast("You don't have any Express Passes. Buy them at the shops!", 'warn');
        return;
      }
      if (!UNLIMITED_EXPRESS) this.profile.passes -= 1;
      this.save();
      this.hooks.sound?.('express');
      st.express.push({ id: 'player', player: true, express: true, at: Clock.now() });
      this.hooks.toast(`Express Pass used! Take the Express line beside standby for ${st.cfg.name} - ${st.express.length <= 1 ? "you're at the front" : `about ${Math.round(realMinutes(this.eta(st, st.express.length)))} min`}.`, 'reward');
    } else {
      st.queue.push({ id: 'player', player: true, at: Clock.now() });
      this.hooks.sound?.('join');
      const wait = Math.round(realMinutes(this.eta(st, st.queue.length)));
      this.hooks.toast(`You joined the line for ${st.cfg.name} - ${wait <= 0 ? 'no wait' : `about ${wait} min`}. Stand still and you'll move up with the line.`, 'info');
    }
    this.queueRide = id;
    this.joinedAt = Clock.now();
    if (st.status === 'Closed') this.hooks.toast(`${st.cfg.name} is temporarily closed. Hang tight - you'll keep your place!`, 'warn');
  }

  // Where the player should be standing in line (distance from the gate).
  playerSlot() {
    if (!this.queueRide || this.ridingRide) return null;
    const e = this.playerEntry();
    const path = this.paths.get(this.queueRide);
    if (!e || !path) return null;
    if (e.lane === 'fotl') return { path, s: 0, side: FOTL_SIDE, lane: e.lane };
    return { path, s: slotAt(e.index, e.st.gap), side: e.lane === 'express' ? EXPRESS_SIDE : 0, lane: e.lane };
  }

  // Point the player should walk to next to keep their place in line, or
  // null when they're already standing in their spot.
  lineTarget(pos) {
    const slot = this.playerSlot();
    if (!slot) return null;
    const { s, d } = slot.path.project(pos.x, pos.z);
    if (d > 1.5 + Math.abs(slot.side)) return { ...slot.path.pointAt(s), final: false }; // step back onto the path first
    const spot = slot.path.pointAt(slot.s, undefined, slot.side);
    if (Math.abs(s - slot.s) < 0.6 && Math.hypot(spot.x - pos.x, spot.z - pos.z) < 0.7) return null;
    const next = slot.path.nextWaypoint(s, slot.s);
    return next.final ? { ...spot, final: true } : next;
  }

  // Walking out of the queue maze (or back out past the sign) leaves the line.
  checkLine(pos) {
    const slot = this.playerSlot();
    if (!slot || Clock.now() - (this.joinedAt ?? 0) < 5) return;
    const { s, d } = slot.path.project(pos.x, pos.z);
    if (d > 5 || s > Math.max(slot.path.signAt, slot.s) + 10) {
      const name = this.rides.get(this.queueRide).cfg.name;
      this.leave(true);
      this.hooks.toast(`You stepped out of the line for ${name}.`, 'warn');
    }
  }

  leave(quiet) {
    if (!this.queueRide) return;
    const st = this.rides.get(this.queueRide);
    st.queue = st.queue.filter((e) => !e.player);
    st.express = st.express.filter((e) => !e.player);
    if (st.fotl?.player) st.fotl = null;
    if (!quiet) this.hooks.toast(`You left the line for ${st.cfg.name}.`, 'info');
    this.queueRide = null;
  }

  dispatch(st, now) {
    if (!st.queue.length && !st.express.length && !st.fotl) return;
    const boardedAt = Clock.now();
    // every train takes Front of the Line first, then the party at the
    // front of the Express line and the party at the front of standby,
    // and the rest of the train fills up
    const parties = [];
    if (st.fotl) { parties.push(st.fotl); st.fotl = null; }
    if (st.express.length) parties.push(st.express.shift());
    if (st.queue.length) {
      const e = st.queue.shift();
      // how long they really waited, in real minutes
      if (e.at !== undefined) st.lastWait = Math.round(realMinutes(boardedAt - e.at));
      parties.push(e);
    }
    const riders = parties.map((e) => (e.player ? { player: true } : { npc: e.seed }));
    const base = parties.find((e) => e.seed)?.seed ?? 7;
    while (riders.length < st.capacity) riders.push({ npc: 1 + ((base * 7919 + riders.length * 104729) % 999983) });
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
      this.hooks.toast(st.cfg.kind === 'walkthrough' ? `Your group is up for ${st.cfg.name}! Step inside... if you dare.` : `Now boarding ${st.cfg.name}! Keep your arms and legs inside the vehicle.`, 'info');
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
      this.hooks.sound?.('stamp');
      this.addBucks(E.RideReward + E.FirstRideBonus, `New passport stamp: ${st.cfg.name}!`);
      const land = this.cfg.Lands.find((l) => l.id === st.cfg.land);
      const all = this.cfg.Rides.filter((r) => r.land === st.cfg.land).every((r) => p.stamps.includes(r.id));
      if (all) this.hooks.sound?.('fanfare');
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
      if (st.refurb) return;
      const wobble = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(t / 90 + i * 7.31) * Math.cos(t / 57 + i));
      // the line it takes for the wait to be about baseWait real minutes
      // (scaled by the crowd), as long as the maze can hold it
      const target = st.cfg.baseWait * 60 * crowd * wobble;
      const desired = Math.min(st.slots - 2, Math.floor(target / this.cycleTotal(st)));
      const npcs = st.queue.filter((e) => !e.player).length;
      if (npcs < desired) {
        const add = warmup ? desired - npcs : Math.min(desired - npcs, 2);
        for (let k = 0; k < add; k++) st.queue.push({ id: ++this.entryId, seed: 1 + Math.floor(Math.random() * 1e6), at: warmup ? undefined : t });
      } else if (npcs > desired + 2 && !st.queue[st.queue.length - 1].player) {
        // a guest at the back gives up (never one ahead of you, so your
        // posted wait stays true)
        st.queue.pop();
      }
      // the Express line stays short: a few parties at most
      const expDesired = Math.max(0, Math.min(4, Math.round(crowd * wobble * 3 - 0.6)));
      const expNpcs = st.express.filter((e) => !e.player).length;
      if (expNpcs < expDesired && (warmup || Math.random() < 0.35)) st.express.push({ id: ++this.entryId, seed: 1 + Math.floor(Math.random() * 1e6), express: true, at: warmup ? undefined : t });
      else if (expNpcs > expDesired && st.express.length && !st.express[st.express.length - 1].player) st.express.pop();
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
      if (st.status === 'Open' && (st.queue.length || st.express.length || st.fotl)) this.dispatch(st, now);
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
    if (item.kind === 'fotl' && this.owns(item.id)) {
      this.hooks.toast(`You already have ${item.name} - it's good all day!`, 'info');
      return false;
    }
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
    this.hooks.sound?.('buy');
    if (item.kind === 'fotl') {
      this.profile.owned.push(item.id);
      this.hooks.toast(`${item.name} is yours! Press G (or tap Front of the Line) at any ${item.scope === 'haunt' ? 'haunted house' : 'ride'} entrance.`, 'reward');
    } else if (item.kind === 'pass') {
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
    this.hooks.sound?.(['cup', 'shake'].includes(item.shape) ? 'drink' : 'eat');
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
    this.checkLine(playerPos);
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
