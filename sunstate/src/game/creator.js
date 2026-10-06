/**
 * Your own LOOP accounts: @cal.reyes and @sol.vega (Tab switches who's
 * posting). With the feed open (P):
 *
 *   1  selfie (the phone at arm's length)      2  photo (what your camera sees)
 *   3  clip (a few seconds of what you see)    4  selfie with a Claude-written caption
 *
 * How a post does is decided by what's in it: golden hour on the beach,
 * Velvet Palms at night, the twin span, the two of you together, a fast
 * car, a chase... Posting too often wears your audience out. Likes come in
 * over a minute or two and turn into followers; a strong post can go viral.
 * Locals reply. Follower milestones bring perks (brand DMs, better pay, the
 * Velvet Palms VIP list, a verified tick), and brands pay you to post from
 * their place before a deadline.
 *
 * Posting while the police are after you tells them exactly where you are.
 *
 * Accounts, handles, brands' deals and every number here are this
 * prototype's own invention.
 */
import { roadAt, KEYS, ISLAND, onTwin } from '../world/layout.js';
import { PLACES } from '../world/district.js';

export const ACCOUNTS = {
  cal: { handle: 'cal.reyes', name: 'Cal Reyes', color: '#29e6ff', followers: 37 },
  sol: { handle: 'sol.vega', name: 'Sol Vega', color: '#ff4fa3', followers: 212 },
};
export const MILESTONES = [
  { n: 100, text: '100 followers. Somebody out there likes you.' },
  { n: 250, text: '250 followers: brands have started sliding into your DMs.', deals: true },
  { n: 1000, text: '1,000 followers! Sponsors pay you 50% more now.' },
  { n: 5000, text: '5,000 followers. People point at you on Ocean Blvd.' },
  { n: 10000, text: '10,000 followers: Big Tomas put you on the Velvet Palms VIP list.', vip: true },
  { n: 50000, text: '50,000 followers. LOOP verified you ✔', verified: true },
  { n: 100000, text: '100,000 followers. You are Costa Vela content now.' },
];
const DEAL_FROM = 250; // followers before brands notice
const MIN_GAP = 8; // seconds between posts (you can't post faster than the phone)

/** Brands that pay for a post from their place (checked when you post). */
export const DEALS = [
  { id: 'gas', brand: 'Sunshine Gas', what: 'a post from Sunshine Gas', pay: 150, at: () => PLACES.gas.door, r: 20 },
  { id: 'threads', brand: 'Threads on 5th', what: 'a selfie at Threads on 5th', need: 'selfie', pay: 250, at: () => PLACES.clothes.door, r: 12 },
  { id: 'autobody', brand: 'Coral Auto Body', what: 'a photo of your car in the Coral Auto Body bay', need: 'photo', pay: 300, at: () => PLACES.autoshop.door, check: (g) => !!g.places?.inBay },
  { id: 'palms', brand: 'Velvet Palms', what: 'a clip from inside Velvet Palms', need: 'clip', pay: 400, at: () => PLACES.club.layout.door, check: (g) => !!g.club?.playerInside, when: (g) => !!g.club?.isOpen },
  { id: 'park', brand: 'Bayshore Park Conservancy', what: 'a selfie in Bayshore Park', need: 'selfie', pay: 120, at: () => PLACES.park, r: 30 },
  { id: 'lento', brand: 'Lento Bait & Fuel', what: 'a photo out on Cayo Lento', pay: 350, at: () => ({ x: (KEYS.x0 + KEYS.x1) / 2, z: (KEYS.z0 + KEYS.z1) / 2 }), check: (g, pos) => pos.z > KEYS.z0 - 8 },
];

// what the two of them write (Cal: dry, few words; Sol: warm, emoji)
const CAPTIONS = {
  club: { cal: ['velvet kind of night', 'don\'t wait up'], sol: ['Velvet Palms with my favorite person 🪩💜', 'the DJ is on another level tonight 🔥'] },
  goldenBeach: { cal: ['not bad, Costa Vela', 'sunset. that\'s the post.'], sol: ['golden hour hits different here 🌅', 'no filter needed ☀️ #beachlife'] },
  beach: { cal: ['sand everywhere', 'beach.'], sol: ['ocean therapy 🌊', 'salt in my hair ☀️'] },
  twin: { cal: ['halfway to nowhere', 'the long bridge'], sol: ['twin span therapy 🌊🛣️', 'windows down on the twin span 🎶'] },
  keys: { cal: ['island time', 'Cayo Lento. quiet. for now.'], sol: ['island time 🐚🌴', 'Cayo Lento, population: us'] },
  park: { cal: ['park.', 'someone challenge me to a game'], sol: ['park day 🌴', 'touching grass as requested 🌿'] },
  store: { cal: ['snack run', 'the usual'], sol: ['the clerk loves us (she does not) 😅', 'snack run 🍫'] },
  neon: { cal: ['{street}. late.', 'night shift'], sol: ['neon nights on {street} 💜', 'this city at night ✨'] },
  street: { cal: ['{street}.', 'out and about'], sol: ['{street} vibes ✨', 'city girl summer on {street}'] },
  wanted: { cal: ['catch me if you can', 'they\'re still looking 😎'], sol: ['being chased is my cardio 😂', 'hi officers 👋'] },
  fast: { cal: ['{speed} on {street}', 'late for nothing'], sol: ['{speed} and the windows down 🏎️', 'speed limit? never heard of her 💨'] },
  couple: { cal: ['with Sol. obviously.', 'her idea'], sol: ['me and Cal 💕', 'partner in crime (literally) 😇'] },
  tipsy: { cal: ['one more', 'it\'s fine'], sol: ['one more?? 🍹', 'who keeps buying shots 😵‍💫'] },
  rain: { cal: ['rain.', 'storm day'], sol: ['rain day ☔', 'Costa Vela storms are unreal ⛈️'] },
};
const REPLIES_GOOD = ['this is everything 😍', 'ok but where is this', 'obsessed', 'the lighting 🔥', 'iconic', 'you two are goals', 'need this energy', 'saving this', 'Costa Vela never looked better'];
const REPLIES_RISKY = ['bro posting DURING a chase 💀', 'the police are literally behind you', 'delete this 😭', 'evidence #1', 'this app is undefeated'];
const REPLIES_FAST = ['posting while driving 😬', 'eyes on the road!!', 'that\'s Ocean Blvd right? slow down lol'];
const REPLIES_MEH = ['ok', 'cool', 'nice', 'who?', 'mid tbh', 'why is this on my feed'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

export function defaultAccounts() {
  const o = {};
  for (const [id, a] of Object.entries(ACCOUNTS)) o[id] = { followers: a.followers, posts: 0, likes: 0, best: 0, milestones: [], verified: false };
  return o;
}

/** Clean saved account data. */
export function sanitizeAccounts(raw) {
  const d = defaultAccounts();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : a);
  for (const id of Object.keys(d)) {
    const r = raw[id];
    if (!r || typeof r !== 'object') continue;
    d[id].followers = num(r.followers, d[id].followers, 1e7);
    d[id].posts = num(r.posts, 0, 1e6);
    d[id].likes = num(r.likes, 0, 1e9);
    d[id].best = num(r.best, 0, 1e8);
    d[id].milestones = Array.isArray(r.milestones) ? [...new Set(r.milestones.filter((n) => MILESTONES.some((m) => m.n === n)))] : [];
    d[id].verified = r.verified === true;
  }
  return d;
}

export class Creator {
  constructor(game, social) {
    this.game = game;
    this.social = social;
    this.accounts = defaultAccounts();
    this.mine = []; // live posts of yours being liked
    this.lastPostT = -1e9;
    this.recent = []; // {t, place} of recent posts (audience fatigue)
    this.status = '';
    this.statusT = 0;
    this.deal = null; // {def, pay, until}
    this.dealT = 90 + Math.random() * 90;
    this.followBuf = { n: 0, who: null, t: 0 };
    this.busy = false;
  }

  get id() { return this.game.player?.protagonist || 'cal'; }
  get me() { return this.accounts[this.id]; }
  get profile() { return ACCOUNTS[this.id]; }

  say(text, t = 3) { this.status = text; this.statusT = t; }

  // ------------------------------------------------------------ what's in the shot
  /** Where you are and what you're doing, for the caption and the score. */
  context() {
    const g = this.game, p = g.player, v = p.vehicle, pos = v ? v.pos : p.pos;
    const h = g.engine?.time?.hour ?? 12;
    const inside = !v && g.world?.interiorAt?.(pos.x, pos.z, pos.y);
    const road = roadAt(pos.x, pos.z);
    const night = h >= 20 || h < 5, golden = h >= 17 && h < 19.6;
    let place = 'street';
    if (inside?.id === 'club') place = 'club';
    else if (inside?.id === 'store') place = 'store';
    else if (onTwin(pos.x, pos.z)) place = 'twin';
    else if (pos.z > KEYS.z0 - 8) place = 'keys';
    else if (pos.x > ISLAND.sandStart) place = golden ? 'goldenBeach' : 'beach';
    else if (this.inPark(pos)) place = 'park';
    else if (night) place = 'neon';
    const partner = g.partner;
    const together = !!partner && !partner.dead && Math.hypot(partner.pos.x - pos.x, partner.pos.z - pos.z) < 7;
    const speed = v ? v.speed : 0;
    return {
      pos, place, street: road ? road.name : this.social.where?.(pos.x, pos.z) || 'Ocean Mile',
      wanted: (g.wanted?.level || 0) > 0, fast: speed > 22, speed, together, rain: (g.weather?.rain || 0) > 0.5, tipsy: (g.club?.tipsy || 0) > 0.4,
      clubOpen: !!g.club?.isOpen, night, golden,
    };
  }

  inPark(pos) { const b = PLACES.park?.bounds; return !!b && pos.x > b.x0 && pos.x < b.x1 && pos.z > b.z0 && pos.z < b.z1; }

  /** How interesting a post is (0..1): the place, the moment, who's in it, and how tired your audience is. */
  score(ctx, kind) {
    const placeScore = { club: ctx.clubOpen ? 0.32 : 0.1, goldenBeach: 0.28, beach: 0.12, twin: 0.22, keys: 0.18, park: 0.08, store: 0.04, neon: 0.12, street: 0.05 }[ctx.place] ?? 0.05;
    let s = 0.08 + placeScore + { selfie: 0.1, photo: 0, clip: 0.15 }[kind];
    if (ctx.together && kind !== 'photo') s += 0.15;
    if (ctx.fast) s += 0.18;
    if (ctx.wanted) s += 0.35;
    if (ctx.rain) s += 0.05;
    if (ctx.tipsy) s += 0.05;
    // the same thing again, or too often: people scroll past
    const t = this.game.time;
    const recent = this.recent.filter((r) => t - r.t < 150);
    s *= Math.pow(0.75, recent.length);
    if (this.recent.length && this.recent[this.recent.length - 1].place === ctx.place) s -= 0.08;
    return Math.max(0.03, Math.min(0.95, s));
  }

  caption(ctx) {
    const who = this.id;
    const key = ctx.wanted ? 'wanted' : ctx.fast ? 'fast' : ctx.together && Math.random() < 0.6 ? 'couple' : ctx.tipsy ? 'tipsy' : ctx.rain && Math.random() < 0.5 ? 'rain' : ctx.place;
    const units = this.game.settings?.i?.units === 'metric';
    const speed = units ? `${Math.round(ctx.speed * 3.6)} km/h` : `${Math.round(ctx.speed * 2.237)} mph`;
    return pick(CAPTIONS[key][who]).replace('{street}', ctx.street).replace('{speed}', speed);
  }

  // ------------------------------------------------------------ posting
  /** kind: 'selfie' | 'photo' | 'clip'. claude: write the caption with Claude (an explicit key). */
  compose(kind, { claude = false } = {}) {
    const g = this.game, so = this.social;
    if (this.busy) { this.say('Still posting…'); return null; }
    if (g.time - this.lastPostT < MIN_GAP) { this.say('Give it a minute.'); return null; }
    if (g.player.dead) return null;
    const ctx = this.context();
    const reel = this.capture(kind);
    const post = { kind, ctx, reel, caption: this.caption(ctx) };
    this.lastPostT = g.time;
    if (claude && so.ai.available) {
      this.busy = true;
      this.say('✨ Claude is writing your caption…', 60);
      this.claudeCaption(ctx, kind).then((text) => { this.busy = false; if (text) { post.caption = text; post.ai = true; } this.publish(post); }).catch(() => { this.busy = false; this.publish(post); });
      return post;
    }
    return this.publish(post);
  }

  /** Film it with the phone (the same small camera the locals use, a bit sharper). */
  capture(kind) {
    const cam = this.social.myCam;
    const reel = { frames: [], views: 0, mine: true };
    if (!cam) return reel;
    const g = this.game, p = g.player;
    if (kind === 'selfie') {
      const head = () => {
        const b = p.model?.bones?.head;
        if (b?.getWorldPosition) { const v = b.getWorldPosition(new (g.engine.camera.position.constructor)()); return { x: v.x, y: v.y + 0.08, z: v.z }; }
        return { x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z };
      };
      const yaw = p.vehicle ? p.vehicle.yaw : p.yaw;
      const from = () => { const h = head(); return { x: h.x + Math.sin(yaw) * 0.85 - Math.cos(yaw) * 0.15, y: h.y + 0.12, z: h.z + Math.cos(yaw) * 0.85 + Math.sin(yaw) * 0.15 }; };
      cam.film(reel, from, head, 1, 0);
    } else {
      const c = g.engine.camera;
      const from = () => ({ x: c.position.x, y: c.position.y, z: c.position.z });
      const to = () => { const d = c.getWorldDirection(new c.position.constructor()); return { x: c.position.x + d.x * 10, y: c.position.y + d.y * 10, z: c.position.z + d.z * 10 }; };
      cam.film(reel, from, to, kind === 'clip' ? 10 : 1, kind === 'clip' ? 0.25 : 0);
    }
    return reel;
  }

  publish({ kind, ctx, reel, caption, ai = false }) {
    const g = this.game, so = this.social, acc = this.me, prof = this.profile;
    // a brand deal this post fulfils?
    let deal = null;
    const d = this.deal;
    if (d && g.time < d.until && (!d.def.need || d.def.need === kind)) {
      const at = d.def.at();
      const ok = d.def.check ? d.def.check(g, ctx.pos) : Math.hypot(ctx.pos.x - at.x, ctx.pos.z - at.z) < (d.def.r || 20);
      if (ok) deal = d;
    }
    let score = this.score(ctx, kind);
    if (deal) score *= 0.85; // #ad
    const text = caption + (deal ? ` #ad @${deal.def.brand.replace(/[^A-Za-z0-9]/g, '')}` : '');
    const viral = score > 0.35 && Math.random() < 0.05 + score * 0.12;
    const reach = acc.followers * score * rand(0.6, 1.4) + score * score * 600 * rand(0.5, 1.5);
    const target = Math.max(1, Math.round(reach * (viral ? rand(6, 15) : 1)));
    const p = so.post({ handle: prof.handle, name: prof.name, color: prof.color, verified: acc.verified, text, reel: reel.frames ? reel : null, clip: kind === 'clip', raw: true, ai, likes: 0 }, false);
    p.mine = true; p.rate = 0; p.kind = kind;
    this.mine.push({ p, target, score, viral, conv: 0.06 + score * 0.12 + (viral ? 0.12 : 0), who: this.id, t: g.time, gained: 0, flags: { wanted: ctx.wanted, fast: ctx.fast } });
    acc.posts++;
    this.recent.push({ t: g.time, place: ctx.place });
    if (this.recent.length > 8) this.recent.shift();
    // locals reply
    const n = viral ? 4 : score > 0.3 ? 2 + Math.floor(Math.random() * 2) : Math.random() < 0.6 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const pool = ctx.wanted && i === 0 ? REPLIES_RISKY : ctx.fast && i === 0 ? REPLIES_FAST : score < 0.12 ? REPLIES_MEH : REPLIES_GOOD;
      so.pending.push({ at: g.time + 4 + Math.random() * 30, fn: () => so.post({ text: pick(pool), replyTo: p, likes: Math.floor(Math.random() * 8) }, false) });
    }
    // posting while wanted: the police read LOOP too
    if (ctx.wanted && g.wanted && g.wanted.state !== 'pursuit') {
      g.wanted.lastKnown = { x: ctx.pos.x, z: ctx.pos.z };
      g.wanted.searchLeft = Math.max(g.wanted.searchLeft || 0, 30);
      g.wanted.note?.('Police saw your LOOP post');
      g.hud?.notify('The police saw your post. They know where you are.', 'LOOP', 'warn', 5);
    }
    if (deal) {
      this.deal = null;
      g.economy?.add(deal.pay, `LOOP sponsorship: ${deal.def.brand}`);
      g.hud?.notify(`${deal.def.brand} paid you $${deal.pay.toLocaleString()} for the post.`, 'LOOP · DM', 'loop', 5);
      if (this.dealWaypoint && g.hud?.waypoint === this.dealWaypoint) g.hud.waypoint = null;
    }
    this.say(viral ? 'Posted. Something\'s happening… 👀' : 'Posted!', 3);
    g.audio?.ui('message');
    g.events?.emit('playerPosted', { kind, score, viral, deal: !!deal, post: p });
    return p;
  }

  async claudeCaption(ctx, kind) {
    const ai = this.social.ai;
    const who = this.id === 'sol' ? 'Sol Vega (warm, playful, uses emoji)' : 'Cal Reyes (dry, few words, no emoji)';
    const prompt = [
      `Write one caption for a ${kind} that ${who} is posting on LOOP, a social app in a fan-made video game prototype set in the fictional coastal city of Costa Vela.`,
      `Where: ${ctx.place === 'goldenBeach' ? 'the beach at golden hour' : ctx.place === 'club' ? 'inside Velvet Palms, a nightclub' : ctx.place === 'twin' ? 'the Vela Keys twin-span bridge' : ctx.place === 'keys' ? 'Cayo Lento, a sleepy island key' : ctx.street}.`,
      `Moment: ${[ctx.wanted && 'the police are looking for them', ctx.fast && 'driving fast', ctx.together && 'with their partner', ctx.rain && 'it is raining', ctx.night && 'night'].filter(Boolean).join(', ') || 'an ordinary day'}.`,
      'Under 110 characters, PG-13, no real people, brands or places, no hashtags about crimes.',
      'Reply with only JSON like {"caption":"..."}',
    ].join('\n');
    try {
      const out = await ai.sample.json(prompt, { modelTier: 'quick', cache: false });
      const c = typeof out?.caption === 'string' ? out.caption.trim().slice(0, 140) : '';
      this.say(c ? '✨ Caption by Claude' : 'Claude had nothing. Posted with yours.', 3);
      return c || null;
    } catch (e) {
      const code = e?.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) ai.available = false;
      this.say(code === 'rate_limited' ? 'Claude is busy. Posted with your caption.' : 'Posted with your caption.', 3);
      return null;
    }
  }

  // ------------------------------------------------------------ per step
  step(dt) {
    const g = this.game, so = this.social;
    if (this.statusT > 0) { this.statusT -= dt; if (this.statusT <= 0) this.status = ''; }
    // the keys, while the feed is open (a shop's menu has the number keys otherwise)
    if (so.open && !g.places?.openShop && !g.paused) {
      const pressed = (i) => g.input?.edges?.has('Digit' + i) || g.input?.edges?.has('Numpad' + i) || g.input?.virtual?.edges?.has('loop' + i);
      if (pressed(1)) this.compose('selfie');
      else if (pressed(2)) this.compose('photo');
      else if (pressed(3)) this.compose('clip');
      else if (pressed(4) && so.ai.available) this.compose('selfie', { claude: true });
    }
    // likes roll in over a minute or two and turn into followers
    for (const m of this.mine) {
      const p = m.p, acc = this.accounts[m.who];
      const before = p.likes;
      p.likes += (m.target - p.likes) * (1 - Math.exp(-dt / 28));
      if (m.target - p.likes < 0.5) p.likes = m.target;
      const dl = p.likes - before;
      if (dl <= 0) continue;
      acc.likes += dl;
      m.gained += dl * m.conv;
      const whole = Math.floor(m.gained);
      if (whole > 0) { m.gained -= whole; this.follow(m.who, whole); }
      acc.best = Math.max(acc.best, Math.round(p.likes));
      if (p.reel) p.reel.views = Math.round(p.likes * 7);
      for (const k of [100, 1000, 10000, 100000]) if (before < k && p.likes >= k && m.who === this.id) g.hud?.notify(`Your ${p.kind} just passed ${k.toLocaleString()} likes${m.viral ? ' 🔥' : ''}`, 'LOOP', 'loop', 4);
    }
    this.mine = this.mine.filter((m) => g.time - m.t < 900 || m.p.likes < m.target);
    if (this.followBuf.n > 0 && g.time - this.followBuf.t > 6) {
      const f = this.followBuf;
      if (f.who === this.id) g.hud?.notify(f.n === 1 ? `@${f.handle} followed you` : `@${f.handle} and ${f.n - 1} others followed you`, 'LOOP', 'loop', 3);
      this.followBuf = { n: 0, who: null, t: g.time };
    }
    this.stepDeals(dt);
  }

  follow(who, n) {
    const acc = this.accounts[who];
    const before = acc.followers;
    acc.followers += n;
    const b = this.followBuf;
    if (!b.n) { b.handle = pick(this.social.personas || [{ handle: 'mango_and_mo' }]).handle; b.t = this.game.time; }
    b.n += n; b.who = who;
    for (const m of MILESTONES) if (before < m.n && acc.followers >= m.n && !acc.milestones.includes(m.n)) this.milestone(who, m);
  }

  milestone(who, m) {
    const g = this.game, acc = this.accounts[who];
    acc.milestones.push(m.n);
    if (m.verified) acc.verified = true;
    if (m.vip && g.memory) {
      // Big Tomas and Celeste keep the list (the memory is per protagonist)
      for (const id of ['club', 'clubvip']) { const p = g.memory.state.people[id] || (g.memory.state.people[id] = {}); const r = p[who] || (p[who] = { visits: 0, robbed: 0, trouble: 0, last: null }); r.vip = true; }
    }
    if (who === this.id) { g.hud?.notify(m.text, `LOOP · @${ACCOUNTS[who].handle}`, 'loop', 6); g.audio?.ui('message'); }
  }

  stepDeals(dt) {
    const g = this.game, acc = this.me;
    const d = this.deal;
    if (d && g.time > d.until) {
      g.hud?.notify(`${d.def.brand} went with someone else.`, 'LOOP · DM', '', 4);
      if (this.dealWaypoint && g.hud?.waypoint === this.dealWaypoint) g.hud.waypoint = null;
      this.deal = null;
    }
    if (this.deal || acc.followers < DEAL_FROM || g.missions?.active) return;
    this.dealT -= dt;
    if (this.dealT > 0) return;
    this.dealT = 150 + Math.random() * 150;
    this.offer();
  }

  /** A brand DMs you: post from their place before the deadline. */
  offer(id = null) {
    const g = this.game, acc = this.me;
    const options = DEALS.filter((x) => (!id || x.id === id) && (!x.when || x.when(g)));
    if (!options.length) return null;
    const def = pick(options);
    const mult = (acc.followers >= 1000 ? 1.5 : 1) * (1 + Math.min(3, acc.followers / 20000));
    const pay = Math.round((def.pay * mult) / 10) * 10;
    this.deal = { def, pay, until: g.time + 240, who: this.id };
    g.hud?.notify(`DM from ${def.brand}: $${pay.toLocaleString()} for ${def.what}. You have 4 minutes.`, 'LOOP · DM', 'loop', 7);
    g.audio?.ui('message');
    // point the GPS at it if you're not already going somewhere
    const at = def.at();
    if (g.hud && !g.hud.waypoint && at) { this.dealWaypoint = { x: at.x, z: at.z, label: def.brand }; g.hud.waypoint = this.dealWaypoint; }
    return this.deal;
  }

  snapshot() { return JSON.parse(JSON.stringify(this.accounts)); }
  apply(s) { this.accounts = sanitizeAccounts(s); }
}
