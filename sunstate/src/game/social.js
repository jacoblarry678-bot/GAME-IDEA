/**
 * LOOP — the fictional social app of Costa Vela (P opens it on the phone).
 *
 * Posts come from three places:
 *  1. The feed engine here: a cast of locals with their own voices, a news
 *     account and a police-scanner account. They write from what the city
 *     REMEMBERS (memory.js): your nickname, the description the police
 *     have, where you were last seen, how notorious each area is, the
 *     weather, the time of day. Others reply in the threads.
 *  2. REELS: when someone films you (a witness calling 911, a local who
 *     recognises you), a small camera at their eye height records a few
 *     frames of what they actually saw. The reel plays in the feed.
 *  3. CLAUDE (only when the game runs as a claude.ai artifact, and only when
 *     you press Y in the open feed): the same memory goes to Claude, which
 *     writes a batch of new posts. It spends the viewer's own Claude usage,
 *     so it never runs by itself.
 *  4. YOU: Cal and Sol have accounts of their own (creator.js): selfies,
 *     photos and clips, likes, followers, milestones and brand deals.
 *
 * All handles, posts and the app itself are invented for this prototype.
 */
import * as THREE from 'three';
import { roadAt, KEYS, ISLAND } from '../world/layout.js';
import { Creator } from './creator.js';

const NEWS = { handle: 'OceanMileNow', name: 'Ocean Mile Now', color: '#ff4d6d', verified: true };
const SCANNER = { handle: 'VelaScanner', name: 'Vela Scanner (unofficial)', color: '#6ea0ff', verified: false };

/** The locals: handle, colour, and how they write. */
export const PERSONAS = [
  { handle: 'sandbar.sofi', color: '#29e6ff', lower: true, emoji: ['🌊', '☀️', '😭'], tags: ['#beachlife'] },
  { handle: 'TidewaterTony', color: '#ffd23f', lower: false, emoji: ['🍳', '☕'], tags: ['#OceanMile'] },
  { handle: 'coralave_kid', color: '#9b5de5', lower: true, emoji: ['💀', '😂', '🔥'], tags: [] },
  { handle: 'lifeguard_dre', color: '#f15bb5', lower: true, emoji: ['🏊', '🚩'], tags: ['#staysafe'] },
  { handle: 'mango_and_mo', color: '#00bbf9', lower: true, emoji: ['🥭', '✨'], tags: ['#CostaVela'] },
  { handle: 'velabaydad', color: '#fee440', lower: false, emoji: ['👍'], tags: [] },
  { handle: 'keys.kat', color: '#00f5d4', lower: true, emoji: ['🐚', '🌴'], tags: ['#CayoLento'] },
  { handle: 'pastelito_pat', color: '#ff924c', lower: true, emoji: ['🥐', '😳'], tags: [] },
  { handle: 'NoParkingNina', color: '#4cc9f0', lower: false, emoji: ['😤'], tags: ['#CoralAve'] },
  { handle: 'gymrat_gus', color: '#80ed99', lower: true, emoji: ['💪', '🏀'], tags: ['#BayshorePark'] },
  { handle: 'halcyon.nights', color: '#c77dff', lower: true, emoji: ['🪩', '🌙'], tags: ['#nightlife'] },
  { handle: 'grandma.lourdes', color: '#ffadad', lower: false, emoji: ['🙏', '❤️'], tags: [] },
];
const AMBIENT = {
  any: [
    'rent went up AGAIN. moving into my car, it has AC at least',
    'pelican stole a whole empanada out of my hand on the promenade',
    'Tidewater Diner key lime pie is a personality trait',
    'traffic on Coral Ave is a hate crime',
    'anybody else hear sirens all night or just me',
    'the twin span at golden hour >>> everything',
    'Cayo Lento is the only place left that feels like the 90s',
    'bait shop on the key has better coffee than downtown. fight me',
    'pickup game at Bayshore Park, need two more, no ball hogs',
    'Raj at Sunshine Gas remembered my coffee order. that\'s love',
    'Threads on 5th sale again. it\'s always a sale. I keep buying things',
    'Hector at Coral Auto Body fixed my bumper and roasted my driving for free',
  ],
  morning: ['café con leche on the promenade, 10/10 morning', 'beach at 7am is the only quiet hour in Ocean Mile'],
  evening: ['the sunset off Ocean Blvd tonight 🌅 no filter', 'golden hour on the twin span, I pulled over (safely)'],
  night: ['Club Halcyon line is already around the block', 'Velvet Palms neon is so loud you can see it from the bay', 'can\'t sleep, sirens again'],
  rain: ['rain. again. my hair 🙃', 'just got soaked crossing 9th St', 'storm rolling in over the bay, it looks unreal', 'Coral Ave is a river rn'],
};
const CRIME = {
  carjack: ['someone just got PULLED out of their car on {street} 😳', 'carjacking on {street} in broad daylight. this city'],
  assault: ['fight breaking out on {street}', 'some guy just swung on someone on {street}'],
  shooting: ['GUNSHOTS on {street}?? everyone get inside', 'heard shots near {street}, stay safe'],
  murder: ['someone got shot on {street}. police everywhere', 'please avoid {street}, something really bad just happened'],
  hitAndRun: ['hit and run on {street}!! got the car on video', 'driver just plowed into someone on {street} and kept going'],
  robbery: ['the Sunny Stop on 14th just got ROBBED', 'masked guy with a gun at the Sunny Stop?? y\'all ok?'],
  vehicleTheft: ['somebody just drove off in a car that wasn\'t theirs on {street} lol'],
  brandish: ['dude just pulled a gun on {street}'],
  assaultOfficer: ['someone just went after a cop on {street}. it\'s about to be a movie'],
  officerDown: ['officer down on {street}. please stay inside'],
  recognized: ['cops just stopped someone on {street} who looked JUST like the guy from the news'],
};
const FAME = [
  '{nick} sighting on {street}?? 👀', 'my cousin swears {nick} buys coffee at Sunshine Gas', 'is {nick} single or', '{nick} is the most Costa Vela thing that has ever happened',
  'every time I hear sirens now I think it\'s {nick}', 'not me checking LOOP every 5 min for {nick} updates', 'they should make a movie about {nick} honestly',
];
const REPLIES = ['no way 😳', 'this city 💀', 'stay safe out there', 'that\'s literally my street', 'send the full video', 'police doing nothing as usual', 'I was RIGHT there', 'this is why I moved to Cayo Lento', 'ok but who\'s filming 😂', 'my mom just sent me this', 'not again', 'praying for the clerk 🙏'];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const camel = (s) => s.replace(/^the /i, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/** A small phone camera that films a few frames of what a bystander sees. */
export class ReelCam {
  constructor(engine, w = 90, h = 160) {
    this.engine = engine; this.w = w; this.h = h;
    this.rt = new THREE.WebGLRenderTarget(w, h);
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.cam = new THREE.PerspectiveCamera(64, w / h, 0.3, 500);
    this.buf = new Uint8Array(w * h * 4);
    this.jobs = [];
  }
  /** from/to: functions returning {x, y, z}. */
  film(reel, from, to, frames = 10, every = 0.25) { this.jobs.push({ reel, from, to, n: frames, every, t: 0 }); }
  update(dt) {
    for (const j of [...this.jobs]) {
      j.t -= dt;
      if (j.t > 0) continue;
      j.t = j.every;
      try { this.capture(j); } catch { this.jobs.splice(this.jobs.indexOf(j), 1); continue; }
      if (j.reel.frames.length >= j.n) this.jobs.splice(this.jobs.indexOf(j), 1);
    }
  }
  capture(j) {
    const r = this.engine.renderer, f = j.from(), t = j.to();
    if (!f || !t) { j.reel.frames.length = j.n; return; }
    this.cam.position.set(f.x + (Math.random() - 0.5) * 0.05, f.y + (Math.random() - 0.5) * 0.05, f.z); // handheld
    this.cam.lookAt(t.x, t.y, t.z);
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(this.engine.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.w, this.h, this.buf);
    r.setRenderTarget(prev);
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const x = c.getContext('2d'), img = x.createImageData(this.w, this.h);
    for (let y = 0; y < this.h; y++) img.data.set(this.buf.subarray((this.h - 1 - y) * this.w * 4, (this.h - y) * this.w * 4), y * this.w * 4); // flip
    x.putImageData(img, 0, 0);
    j.reel.frames.push(c);
  }
}

export class Social {
  constructor(game) {
    this.game = game;
    this.posts = [];
    this.pending = []; // replies and follow-ups due later {at, post}
    this.unread = 0;
    this.open = false;
    this.ambientT = 8 + Math.random() * 10;
    this.fameT = 60;
    this.rainPosted = false;
    this.reels = game.engine?.renderer ? new ReelCam(game.engine) : null;
    this.myCam = game.engine?.renderer ? new ReelCam(game.engine, 135, 240) : null; // your own phone (sharper)
    this.personas = PERSONAS;
    this.me = new Creator(game, this); // your LOOP accounts: posting, likes, followers, brand deals
    this.ai = { available: false, busy: false, status: '', sample: null };
    // Claude writes posts only inside a claude.ai artifact viewer (see the header comment)
    try { window.claude?.use?.('sample')?.then((s) => { if (s) { this.ai.sample = s; this.ai.available = true; } }).catch(() => {}); } catch { /* not in a viewer */ }
    this.seed();
    this.bind();
  }

  seed() {
    for (let i = 0; i < 4; i++) this.post({ persona: PERSONAS[(i * 5) % PERSONAS.length], text: AMBIENT.any[(i * 5) % AMBIENT.any.length], age: 600 + i * 900, likes: 20 + i * 37 }, false);
    this.post({ ...NEWS, text: 'Weekend forecast: hot, humid, chance of afternoon storms. So, Costa Vela.', age: 3000, likes: 214 }, false);
    this.unread = 0;
  }

  get memory() { return this.game.memory; }

  where(x, z) {
    const r = roadAt(x, z);
    if (r) return r.name;
    if (z > KEYS.z0 - 8) return KEYS.name;
    if (x > ISLAND.sandStart) return 'the beach';
    return 'Ocean Mile';
  }

  /** Write in a persona's voice. */
  voice(persona, text) {
    let t = text;
    if (persona?.lower) t = t.toLowerCase();
    if (persona?.emoji && Math.random() < 0.45 && !/\p{Extended_Pictographic}/u.test(t)) t += ' ' + pick(persona.emoji);
    if (persona?.tags?.length && Math.random() < 0.25) t += ' ' + pick(persona.tags);
    return t;
  }

  /**
   * Add a post. about = it's about the crew (it also pops up as a notification).
   * Returns the post. Locals get a persona and its voice unless `raw`.
   */
  post({ handle, color, name, verified = false, text, clip = false, reel = null, about = false, age = 0, likes = 0, local = false, persona = null, replyTo = null, ai = false, raw = false }, notify = true) {
    if (!handle) {
      persona = persona || pick(PERSONAS);
      handle = persona.handle; color = persona.color;
      if (!raw && !ai) text = this.voice(persona, text);
    }
    void local;
    const p = { id: (this._id = (this._id || 0) + 1), handle, name: name || handle, color, verified, text, clip: clip || !!reel, reel, about, t: (this.game.time || 0) - age, likes, replies: [], ai, rate: clip || reel ? 6 + Math.random() * 10 : 0.3 + Math.random() * 1.5 };
    if (replyTo) { replyTo.replies.push(p); replyTo.replies.length = Math.min(replyTo.replies.length, 4); }
    else { this.posts.unshift(p); if (this.posts.length > 40) this.posts.length = 40; }
    if (!this.open) this.unread++;
    if (notify && about) { this.game.hud?.notify(text, `LOOP · @${handle}`, 'loop', 7); this.game.audio?.ui('message'); }
    this.game.events?.emit('socialPost', p);
    if (about && !replyTo) this.scheduleReplies(p);
    return p;
  }

  scheduleReplies(p) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.pending.push({ at: (this.game.time || 0) + 4 + Math.random() * 25, fn: () => this.post({ text: pick(REPLIES), replyTo: p, likes: Math.floor(Math.random() * 6) }, false) });
  }

  /** Start a reel filmed from a character's eyes toward a point. */
  film(ch, target) {
    const reel = { frames: [], views: 0 };
    if (!this.reels) return reel;
    const from = () => (ch.removed ? null : { x: ch.pos.x, y: ch.pos.y + 1.55, z: ch.pos.z });
    const to = typeof target === 'function' ? target : () => target;
    this.reels.film(reel, from, to, 10, 0.25);
    return reel;
  }

  bind() {
    const g = this.game, ev = g.events;
    // a witness who calls 911 also films it
    ev.on('witnessCall', (call) => {
      const t = CRIME[call.crimeId];
      if (!t) return;
      const reel = call.witness ? this.film(call.witness, () => { const p = g.player; const q = p.vehicle ? p.vehicle.pos : p.pos; return { x: q.x, y: q.y + 1, z: q.z }; }) : null;
      this.post({ text: pick(t).replace('{street}', this.where(call.x, call.z)) + ' 📹', clip: true, reel, about: true, likes: 3 });
    });
    ev.on('wantedLevel', ({ level, before }) => {
      if (level >= 3 && before < 3) this.post({ ...NEWS, text: `Heavy police presence near ${this.where(g.player.pos.x, g.player.pos.z)}. Avoid the area.`, about: true, likes: 40 });
    });
    ev.on('descriptionIssued', (d) => this.post({ ...SCANNER, text: `BOLO: ${this.memory.describe(d)}. Last seen near ${this.where(g.player.pos.x, g.player.pos.z)}.`, about: true, likes: 15 }));
    ev.on('nickname', (nick) => this.post({ text: `ok everyone is calling them ${nick} now and I can't stop laughing`, about: true, likes: 22 }));
    ev.on('wantedCleared', ({ level }) => { if (level >= 2) this.post({ text: 'cops just gave up on whoever they were chasing lmao', about: true, likes: 12 }); });
    ev.on('busted', () => this.post({ text: 'watched someone get BUSTED outside my window. live entertainment', about: true, likes: 25 }));
    ev.on('missionPassed', ({ def }) => {
      const text = def.id === 'small_change' ? 'Sunny Stop convenience store on 14th St robbed at gunpoint. Clerk unharmed. Police seek a masked suspect.'
        : def.id === 'low_tide' ? 'Shots fired on the Vela Keys Twin Span as two vehicles chased a sedan toward Ocean Mile. Cayo Lento charter captain reported missing.'
          : `${def.title}: police are investigating.`;
      this.post({ ...NEWS, text, about: true, likes: 120 });
    });
  }

  /** A local recognises you (memory.js): they film you and post about it. */
  spotted(ped, player, nick) {
    const reel = this.film(ped, () => ({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }));
    this.post({ text: `omg it's literally ${nick} on ${this.where(player.pos.x, player.pos.z)} right now`, reel, about: true, likes: 8 });
  }

  /** What's trending: from the nickname and recent posts about the crew. */
  get trending() {
    const nick = this.memory?.state.nickname;
    if (nick) return '#' + camel(nick);
    const g = this.game;
    if ((g.weather?.rain || 0) > 0.5) return '#StormDay';
    if (this.posts.some((p) => p.about && /Twin Span/i.test(p.text))) return '#TwinSpanChase';
    if (this.posts.some((p) => p.about && /Sunny Stop/i.test(p.text))) return '#SunnyStop';
    return '#CostaVela';
  }

  step(dt) {
    const g = this.game;
    this.reels?.update(dt);
    this.myCam?.update(dt);
    this.me.step(dt);
    for (const p of this.posts) {
      if (g.time - p.t < 600) p.likes += p.rate * dt * (p.clip ? 1 + p.likes / 200 : 1);
      if (p.reel) p.reel.views = Math.round(p.likes * 9);
    }
    for (const q of [...this.pending]) if (g.time >= q.at) { this.pending.splice(this.pending.indexOf(q), 1); q.fn(); }
    this.ambientT -= dt;
    if (this.ambientT <= 0) { this.ambientT = 35 + Math.random() * 45; this.post(this.ambientPost()); }
    // when you're famous, people talk about you even when nothing just happened
    this.fameT -= dt;
    const nick = this.memory?.state.nickname, fame = this.memory ? Math.max(...Object.values(this.memory.state.notoriety)) : 0;
    if (this.fameT <= 0) {
      this.fameT = 70 + Math.random() * 60;
      if (nick && fame > 25) {
        const s = this.memory.state.sightings[0];
        this.post({ text: pick(FAME).replace('{nick}', nick).replace('{street}', s?.place || 'Ocean Mile'), likes: Math.floor(fame / 3) });
      }
    }
    const rain = g.weather?.rain || 0;
    if (rain > 0.6 && !this.rainPosted) { this.rainPosted = true; this.post({ text: pick(AMBIENT.rain), likes: 2 }); }
    if (rain < 0.1) this.rainPosted = false;
    if (this.open && g.input?.pressed?.('loopAI')) this.askClaude();
  }

  ambientPost() {
    const h = this.game.engine?.time?.hour ?? 12;
    const pool = h >= 6 && h < 11 ? AMBIENT.morning : h >= 17 && h < 20 ? AMBIENT.evening : h >= 20 || h < 4 ? AMBIENT.night : null;
    return { text: pool && Math.random() < 0.4 ? pick(pool) : pick(AMBIENT.any), likes: Math.floor(Math.random() * 8) };
  }

  toggle() { this.open = !this.open; if (this.open) this.unread = 0; return this.open; }

  /** "5m", "2h" — the game clock runs one in-game minute per real second. */
  age(p) {
    const min = Math.max(0, (this.game.time || 0) - p.t);
    return min < 1 ? 'now' : min < 60 ? `${Math.floor(min)}m` : `${Math.floor(min / 60)}h`;
  }

  // ------------------------------------------------------------ Claude
  /** What the city knows right now, as plain text for the prompt. */
  context() {
    const g = this.game, m = this.memory?.state;
    const lines = [];
    const h = g.engine?.time?.hour ?? 12;
    lines.push(`Time: ${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}. Weather: ${g.weather?.label || 'clear'}.`);
    if (m) {
      lines.push(`Notoriety (0-100): ${Object.entries(m.notoriety).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}.`);
      if (m.nickname) lines.push(`Locals call the people behind it all "${m.nickname}".`);
      if (m.description) lines.push(`Police are looking for ${this.memory.describe(m.description)}.`);
      if (m.sightings.length) lines.push('Recent incidents, newest first: ' + m.sightings.slice(0, 6).map((s) => `${s.what} near ${s.place}`).join('; ') + '.');
      if (m.grudges.calderas) lines.push('A local crime family, the Calderas, is looking for a couple who crossed them on Cayo Lento.');
    }
    const recent = this.posts.slice(0, 6).map((p) => `@${p.handle}: ${p.text}`).join('\n');
    return lines.join('\n') + '\nLatest posts:\n' + recent;
  }

  /** Ask Claude for a batch of new posts (an explicit key press in the open feed). */
  async askClaude() {
    const ai = this.ai;
    if (!ai.available || ai.busy) return;
    ai.busy = true; ai.status = 'Claude is writing…';
    const handles = PERSONAS.map((p) => '@' + p.handle).join(', ');
    const prompt = [
      'You write posts for LOOP, a social app inside a fan-made video game prototype set in the fictional coastal city of Costa Vela',
      '(districts: Ocean Mile, an art-deco beach strip with Coral Ave, Ocean Blvd, the Sunny Stop store, Bayshore Park, Velvet Palms club, Sunshine Gas, Coral Auto Body;',
      'and Cayo Lento, a sleepy key reached by a twin-span bridge). Write 5 short posts by different locals reacting to what is happening.',
      'Rules: under 180 characters each; varied voices (gossip, worry, jokes, a reply or two); PG-13, no slurs, nothing explicit;',
      'no real people, brands or places; locals do not know the criminals\' real names.',
      `Use these handles or invent similar ones: ${handles}.`,
      'What the city knows right now:', this.context(),
      'Reply with only a JSON array like [{"handle":"sandbar.sofi","text":"...","replyTo":null}], where replyTo is a handle from "Latest posts" or null.',
    ].join('\n');
    try {
      const out = await ai.sample.json(prompt, { modelTier: 'quick', cache: false });
      let n = 0;
      for (const item of Array.isArray(out) ? out.slice(0, 6) : []) {
        const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 240) : '';
        const handle = typeof item?.handle === 'string' ? item.handle.replace(/^@/, '').trim() : '';
        if (!text || !/^[A-Za-z0-9_.]{2,24}$/.test(handle)) continue;
        const persona = PERSONAS.find((p) => p.handle === handle);
        const parent = item.replyTo ? this.posts.find((p) => p.handle === String(item.replyTo).replace(/^@/, '')) : null;
        this.post({ handle, color: persona?.color || '#c0c4cc', text, ai: true, replyTo: parent || null, likes: Math.floor(Math.random() * 10) }, false);
        n++;
      }
      ai.status = n ? `✨ ${n} new posts written by Claude` : 'Claude had nothing to add.';
    } catch (e) {
      const code = e?.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { ai.available = false; ai.status = ''; }
      else ai.status = code === 'rate_limited' ? 'Claude is busy — try again in a bit.' : code === 'cancelled' ? '' : 'Couldn\'t get new posts. Try again later.';
    } finally { ai.busy = false; }
  }
}
