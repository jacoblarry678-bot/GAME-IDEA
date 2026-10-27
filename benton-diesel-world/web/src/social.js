// BentonGram, the park's social feed in the Benton App: the park's own
// posts (every announcement and opening so far), fan posts, guests posting
// live about what's happening around them (waits, the haunt after dark,
// food, Express), and your own photos: snap the view, add a caption and
// watch the likes and comments roll in.
import * as Clock from './clock.js';
import { HAUNT_OVER } from './season.js';

const STORE = 'bentonDieselWorld.social';
const nowS = () => performance.now() / 1000;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const PARK = { handle: '@BentonDieselWorld', name: 'Benton Diesel World', color: 0xff6a1a, verified: true };

// the park's own posts, newest first (each with a poster-style card)
const OFFICIAL = [
  { when: 'Today', art: { title: 'FRONT OF THE LINE', sub: 'NEW: EXPRESS LINES · EXTENDED QUEUES', color: 0xe02020, emoji: '🎟️' },
    text: 'NEW! Express now has its own short line, busy rides open extended queues, and Front of the Line tickets take you straight to the next train. Benton Haunt FOTL B$250 · Ride FOTL B$350 at every park shop.', likes: 4812 },
  { when: '2d', art: { title: 'FINAL DESTINATION', sub: "DEATH'S DESIGN · NOW OPEN", color: 0xc81e1e, emoji: '✈️' },
    text: "Flight 180 is delayed... permanently. Final Destination: Death's Design is NOW OPEN on Stage 6. Seven rooms of Death's design. You can't cheat Death. #BentonHaunt", likes: 12904 },
  { when: '1w', art: { title: 'BENTON HAUNT IS BACK', sub: '7 HOUSES · 7 SCARE ZONES', color: 0xff7a1a, emoji: '🎃' },
    text: 'Benton Haunt returns! Every house and scare zone is back, plus a brand-new zone: FORTNITEMARES at Family Landing. The Storm is closing in. 🟪', likes: 15233 },
  { when: '3w', art: { title: 'NOW BUILDING', sub: 'FINAL DESTINATION · STAGE 6', color: 0x3a3c42, emoji: '🏗️' },
    text: "Construction has started on Stage 6! Flight 180's fuselage is already in the yard. Next fall's first house: Final Destination: Death's Design.", likes: 6120 },
  { when: 'Feb', art: { title: 'WOLVERINE', sub: 'THE CLAWS ARE OUT · NOW OPEN', color: 0xf2c818, emoji: '🐺' },
    text: 'WOLVERINE IS OPEN! Launch out of the Weapon X bunker and over an 80-stud top hat. Plus: Mardi Gras at the Grand - king cake and beignets for a limited time. 💜💚💛', likes: 18877 },
  { when: 'Jan', art: { title: 'HAPPY NEW YEAR', sub: 'SOMETHING WITH CLAWS IS COMING', color: 0x1e3a8a, emoji: '🎆' },
    text: "Thanks for an amazing holiday season! The decorations are coming down... and something is going up past Backwoods. Look over the wall. 👀", likes: 7350 },
  { when: 'Dec', art: { title: 'BENTON HOLIDAYS', sub: 'MEET SANTA · THROUGH JAN 1', color: 0x1e7a3a, emoji: '🎄' },
    text: 'Benton Holidays is here! Lights on every ride, Santa roaming the park, and Santa\'s Workshop backstage for a meet & greet. 🎅', likes: 9981 },
  { when: 'Nov', art: { title: 'FAST & FURIOUS', sub: 'BENTON STREET RUN · NOW OPEN', color: 0xff6a1a, emoji: '🏁' },
    text: "It's all about family. Fast & Furious: Benton Street Run is NOW OPEN in Velocity City - nitrous launches, a rooftop jump and the docks. 🚗💨", likes: 21440 },
  { when: 'Oct', art: { title: 'BENTON HAUNT', sub: 'THE HOUSES ARE OPEN', color: 0x6a1a22, emoji: '👻' },
    text: 'The gates are open. Benton Haunt houses and scare zones are live after dark. Do you dare? #BentonHaunt', likes: 11208 },
];

// fan posts from before you arrived
const FANS = [
  { handle: '@coasterkid', color: 0xff6a1a, when: '1d', video: 'Tips and Tricks for Playing Benton Diesel World',
    text: 'NEW VIDEO 🎬 8 tips I wish I knew sooner (tip 8 will save you from Death... maybe)', likes: 2310, comments: ['this helped so much', 'the bludworth ending 💀💀', 'didnt know about guide!!'] },
  { handle: '@hauntfan_', color: 0x8a2a22, when: '2d', text: 'Final Destination got me in the TANNING ROOM. I am never going in a tanning bed again. 10/10', likes: 884, comments: ['the timer broken sign lol', 'flight 180 room is insane'] },
  { handle: '@loopqueen', color: 0xb04aff, when: '4d', text: 'pro tip: one in three llamas in Fortnitemares has red eyes. RUN 🦙🟪', likes: 1532, comments: ['wait WHAT', 'the cube queen chased me'] },
  { handle: '@coasterkid', color: 0xff6a1a, when: '3w', video: 'First time playing BDW', text: 'my first time at Benton Diesel World... i was NOT ready 😭🎢', likes: 5120, comments: ['we jumped a ROOF', 'part 2 when'] },
];

const GUESTS = ['@diesel_dan', '@loopqueen', '@thrillseeker09', '@hauntfan_', '@creditcounter', '@bentonmom3', '@nitrofan', '@trucktrek_tim', '@velocity_vee', '@backwoodsbri', '@sundaycoasters', '@parkhopper22'];
const COLORS = [0x1e6ee6, 0xc42828, 0x2e9e52, 0x7a3fc4, 0xf0a020, 0x2aa8c8, 0xe0508a, 0x5a6e2a];
const COMMENTS = ['😍😍', 'where is this??', 'GOALS', 'take me with you', 'best park ever', 'the lighting!!', 'omg jealous', 'how long was the wait', '🔥🔥🔥', 'need to go back', 'ok this is a great pic', 'wolverine supremacy', 'what land is this'];

export class Social {
  constructor(game) {
    this.g = game;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    this.handle = saved?.handle || `@${pick(['Diesel', 'Coaster', 'Benton', 'Nitro', 'Thrill', 'Loop'])}${pick(['Rider', 'Fan', 'Kid', 'Crew', 'Racer'])}${100 + Math.floor(Math.random() * 900)}`;
    this.liked = new Set(saved?.liked || []);
    this.mine = (saved?.posts || []).map((p) => ({ ...p, t: nowS() - (p.age || 600) }));
    this.live = []; // guest posts made during this visit
    let id = 0;
    this.seeds = [
      ...OFFICIAL.map((p) => ({ ...PARK, ...p, id: `o${id++}`, official: true, comments: [] })),
      ...FANS.map((p) => ({ ...p, id: `f${id++}`, comments: p.comments || [] })),
    ];
    // fan posts sit among the park's by age
    const order = ['Today', '1d', '2d', '4d', '1w', '3w', 'Feb', 'Jan', 'Dec', 'Nov', 'Oct'];
    const rank = (w) => { const i = order.indexOf(w); return i < 0 ? order.length : i; };
    this.seeds.sort((a, b) => rank(a.when) - rank(b.when));
    this.unread = 1; // the newest park post
    this.nextGuest = nowS() + 12;
    this.pending = null;
    this.rewarded = 0;
  }

  save() {
    try {
      const posts = this.mine.slice(0, 8).map((p) => ({ id: p.id, text: p.text, img: p.img, likes: Math.round(p.likes), target: p.target, comments: p.comments, place: p.place, age: Math.round(nowS() - p.t), paid: p.paid }));
      localStorage.setItem(STORE, JSON.stringify({ handle: this.handle, liked: [...this.liked].slice(-200), posts }));
    } catch (e) {
      /* storage full or blocked: posts last this visit only */
    }
  }

  // newest first: your posts and live guest posts, then the older feed
  feed() {
    return [...[...this.mine, ...this.live].sort((a, b) => b.t - a.t), ...this.seeds];
  }

  ago(p) {
    if (p.when) return p.when;
    const s = nowS() - p.t;
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  }

  like(p) {
    if (this.liked.has(p.id)) { this.liked.delete(p.id); p.likes -= 1; } else { this.liked.add(p.id); p.likes += 1; }
    this.save();
  }

  // ---- your photos
  requestPhoto(cb) { this.pending = cb; }

  // called right after the frame is drawn, while the picture is still there
  capture(canvas) {
    if (!this.pending) return;
    const cb = this.pending;
    this.pending = null;
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = Math.round((480 * canvas.height) / canvas.width) || 270;
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    let img = '';
    try { img = c.toDataURL('image/jpeg', 0.72); } catch (e) { img = ''; }
    cb(img);
  }

  // a caption from wherever you are
  autoCaption() {
    const g = this.g, sim = g.sim;
    const minute = Clock.minutes(), night = minute >= 1170 || minute < 420;
    if (sim.ridingRide) {
      const r = sim.rides.get(sim.ridingRide).cfg;
      return r.kind === 'walkthrough' ? `Inside ${r.name}... send help 😱` : `Riding ${r.name}! 🎢`;
    }
    const q = sim.playerQueue();
    if (q) return q.lane === 'fotl' ? `Front of the Line for ${q.ride.name} 😎🎟️` : `In line for ${q.ride.name} · ${q.eta} min to go ⏳`;
    const land = g.ui?.landAt(g.player.pos);
    const where = land ? land.name : 'Benton Diesel World';
    return night ? `${where} at night 🌙✨` : pick([`Perfect day at ${where} ☀️`, `${where} hits different 🎢`, `Just vibing in ${where}`]);
  }

  postPhoto(img, text) {
    const sim = this.g.sim;
    const hype = sim.ridingRide ? 1.6 : sim.playerQueue() ? 1.1 : 1;
    const land = this.g.ui?.landAt(this.g.player.pos);
    const p = { id: `m${Date.now()}`, mine: true, img, text: text || this.autoCaption(), t: nowS(), likes: 0, target: Math.round((50 + Math.random() * 150) * hype), comments: [], place: land ? land.name : '' };
    this.mine.unshift(p);
    this.mine = this.mine.slice(0, 12);
    // a little something for sharing (the first few posts each visit)
    if (this.rewarded < 5) {
      this.rewarded += 1;
      sim.addBucks(5, 'Posted to BentonGram!');
    } else this.g.ui?.toast('Posted to BentonGram!', 'info');
    this.save();
    return p;
  }

  // ---- the live feed: guests posting about what's around them
  guestPost() {
    const sim = this.g.sim;
    const minute = Clock.minutes(), night = minute >= 1170 || minute < 420;
    const rides = [...sim.rides.values()].filter((st) => !st.refurb && st.cfg.kind !== 'walkthrough');
    const houses = [...sim.rides.values()].filter((st) => st.cfg.kind === 'walkthrough');
    const st = pick(rides);
    const s = sim.rideState(st.id);
    const ideas = [
      () => (s.wait >= 40 ? `${st.cfg.name} is at ${s.wait} min right now 😩` : s.wait <= 5 ? `${st.cfg.name} is a walk-on right now?? running back 🏃` : `${s.wait} min for ${st.cfg.name}, worth it`),
      () => `Express line for ${st.cfg.name} is ${s.express <= 1 ? 'basically empty' : `${s.express} min`} ⚡`,
      () => (s.extended ? `the extended queue for ${st.cfg.name} is OPEN. it's that kind of day 😭` : `just rode ${st.cfg.name} ${pick(['twice', 'back to back', 'in the front row', 'in the back row'])} 🎢`),
      () => pick(['Wolverine top hat at golden hour 🔥', 'Fast & Furious second launch >>>', 'Diesel Dogs are elite, no notes 🌭', 'Turbo Shake speed boost had me FLYING ⚡', 'the shuttle bus from the Grand is so easy 🚌']),
    ];
    if (!HAUNT_OVER && night && houses.length) {
      const hs = pick(houses);
      const hw = sim.rideState(hs.id);
      ideas.push(
        () => `${hs.cfg.name} is ${hw.wait} min. worth it?? 👻`,
        () => pick(["Bludworth looked RIGHT at me 💀", 'Fortnitemares cube queen chased me across Family Landing 🟪', 'scare zones tonight are unreal 🎃', "Front of the Line for the haunt = no regrets", 'Flight 180 room... I screamed'])
      );
    }
    if (minute < 600) ideas.push(() => 'rope drop crew where you at 🌅');
    const text = pick(ideas)();
    const p = { id: `g${Date.now()}`, handle: pick(GUESTS), color: pick(COLORS), text, t: nowS(), likes: 0, target: 5 + Math.floor(Math.random() * 120), comments: [] };
    this.live.unshift(p);
    this.live = this.live.slice(0, 20);
    this.unread += 1;
  }

  update(started) {
    const t = nowS();
    if (started && t >= this.nextGuest) {
      this.nextGuest = t + 25 + Math.random() * 35;
      this.guestPost();
    }
    // likes come in fast at first, then slow down
    const dt = Math.min(1, t - (this.lastT ?? t));
    this.lastT = t;
    for (const p of [...this.mine, ...this.live]) {
      const age = t - p.t;
      const want = p.target * (1 - Math.exp(-age / 90)) + (this.liked.has(p.id) ? 1 : 0);
      if (want > p.likes + 0.5) p.likes += Math.min(want - p.likes, (want - p.likes) * dt * 2 + dt * 0.5);
      if (p.mine) {
        const n = Math.min(4, Math.floor(p.likes / 30));
        while (p.comments.length < n) p.comments.push(`${pick(GUESTS)} ${pick(COMMENTS)}`);
        if (!p.paid && p.likes >= 100) {
          p.paid = true;
          this.g.sim.addBucks(20, 'Your BentonGram post hit 100 likes! 🔥');
          this.save();
        }
      }
    }
  }
}
