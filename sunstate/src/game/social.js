/**
 * LOOP — the fictional social feed of Costa Vela (opened with P).
 *
 * Locals post about their day and about what they see: a witness who calls
 * 911 also posts a clip, a news account reports robberies and chases, people
 * complain about the rain. Posts about the crew pop up in the notification
 * feed. Likes grow over time, faster for clips. All handles, posts and the
 * app itself are invented for this prototype.
 */
import { roadAt, KEYS, ISLAND } from '../world/layout.js';

const NEWS = { handle: 'OceanMileNow', name: 'Ocean Mile Now', color: '#ff4d6d', verified: true };
const LOCALS = [
  ['sandbar.sofi', '#29e6ff'], ['TidewaterTony', '#ffd23f'], ['coralave_kid', '#9b5de5'], ['lifeguard_dre', '#f15bb5'],
  ['mango_and_mo', '#00bbf9'], ['velabaydad', '#fee440'], ['keys.kat', '#00f5d4'], ['pastelito_pat', '#ff924c'],
  ['NoParkingNina', '#4cc9f0'], ['gymrat_gus', '#80ed99'], ['halcyon.nights', '#c77dff'], ['grandma.lourdes', '#ffadad'],
];
const AMBIENT = [
  'the sunset off Ocean Blvd tonight 🌅 no filter',
  'who keeps parking a pickup across two spots at the Sunny Stop',
  'rent went up AGAIN. moving into my car, it has AC at least',
  'pelican stole a whole empanada out of my hand on the promenade',
  'Club Halcyon line is already around the block and it\'s 9pm',
  'Tidewater Diner key lime pie is a personality trait',
  'saw a guy doing pull-ups at the beach gym in jeans. respect',
  'traffic on Coral Ave is a hate crime',
  'anybody else hear sirens all night or just me',
  'the twin span at golden hour >>> everything',
  'Cayo Lento is the only place left that feels like the 90s',
  'bait shop on the key has better coffee than downtown. fight me',
  'motel pool just got a new floatie. it\'s a flamingo. it\'s perfect',
  'lost my sandals at the beach again. third pair this month',
];
const RAIN = ['rain. again. my hair 🙃', 'just got soaked crossing 9th St', 'storm rolling in over the bay, it looks unreal', 'Coral Ave is a river rn'];
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
  officerDown: ['officer down on {street}. helicopters incoming probably'],
};

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export class Social {
  constructor(game) {
    this.game = game;
    this.posts = [];
    this.unread = 0;
    this.open = false;
    this.ambientT = 8 + Math.random() * 10;
    this.rainPosted = false;
    this.seed();
    this.bind();
  }

  /** A few posts so the feed isn't empty on a new game. */
  seed() {
    for (let i = 0; i < 4; i++) this.post({ local: true, text: AMBIENT[(i * 5) % AMBIENT.length], age: 600 + i * 900, likes: 20 + i * 37 }, false);
    this.post({ ...NEWS, text: 'Weekend forecast: hot, humid, chance of afternoon storms. So, Costa Vela.', age: 3000, likes: 214 }, false);
    this.unread = 0;
  }

  where(x, z) {
    const r = roadAt(x, z);
    if (r) return r.name;
    if (z > KEYS.z0 - 8) return KEYS.name;
    if (x > ISLAND.sandStart) return 'the beach';
    return 'Ocean Mile';
  }

  /** Add a post. about = it's about the crew (it also pops up in the notification feed). */
  post({ handle, color, name, verified = false, text, clip = false, about = false, age = 0, likes = 0, local = false }, notify = true) {
    if (local || !handle) { const [h, c] = pick(LOCALS); handle = h; color = c; }
    const p = { id: (this._id = (this._id || 0) + 1), handle, name: name || handle, color, verified, text, clip, about, t: this.game.time - age, likes, rate: clip ? 6 + Math.random() * 10 : 0.3 + Math.random() * 1.5 };
    this.posts.unshift(p);
    if (this.posts.length > 40) this.posts.length = 40;
    if (!this.open) this.unread++;
    if (notify && about) { this.game.hud?.notify(text, `LOOP · @${handle}`, 'loop', 7); this.game.audio?.ui('message'); }
    this.game.events.emit('socialPost', p);
    return p;
  }

  bind() {
    const g = this.game, ev = g.events;
    // a witness who calls 911 also films it
    ev.on('witnessCall', (call) => {
      const t = CRIME[call.crimeId];
      if (!t) return;
      this.post({ local: true, text: pick(t).replace('{street}', this.where(call.x, call.z)) + ' 📹', clip: true, about: true, likes: 3 });
    });
    ev.on('wantedLevel', ({ level, before }) => {
      if (level >= 3 && before < 3) this.post({ ...NEWS, text: `Heavy police presence near ${this.where(g.player.pos.x, g.player.pos.z)}. Avoid the area.`, about: true, likes: 40 });
    });
    ev.on('wantedCleared', ({ level }) => { if (level >= 2) this.post({ local: true, text: 'cops just gave up on whoever they were chasing lmao', about: true, likes: 12 }); });
    ev.on('busted', () => this.post({ local: true, text: 'watched someone get BUSTED outside my window. live entertainment', about: true, likes: 25 }));
    ev.on('missionPassed', ({ def }) => {
      const text = def.id === 'small_change' ? 'Sunny Stop convenience store on 14th St robbed at gunpoint. Clerk unharmed. Police seek a masked suspect.'
        : def.id === 'low_tide' ? 'Shots fired on the Vela Keys Twin Span as two vehicles chased a sedan toward Ocean Mile. Cayo Lento charter captain reported missing.'
          : `${def.title}: police are investigating.`;
      this.post({ ...NEWS, text, about: true, likes: 120 });
    });
  }

  step(dt) {
    const g = this.game;
    for (const p of this.posts) if (g.time - p.t < 600) p.likes += p.rate * dt * (p.clip ? 1 + p.likes / 200 : 1);
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 40 + Math.random() * 50;
      this.post({ local: true, text: pick(AMBIENT), likes: Math.floor(Math.random() * 8) });
    }
    const rain = g.weather?.rain || 0;
    if (rain > 0.6 && !this.rainPosted) { this.rainPosted = true; this.post({ local: true, text: pick(RAIN), likes: 2 }); }
    if (rain < 0.1) this.rainPosted = false;
  }

  toggle() { this.open = !this.open; if (this.open) this.unread = 0; return this.open; }

  /** "5m", "2h" from game time (the game clock runs 60× real time). */
  age(p) {
    const min = Math.max(0, (this.game.time - p.t) * 60 / 60); // game minutes
    return min < 1 ? 'now' : min < 60 ? `${Math.floor(min)}m` : `${Math.floor(min / 60)}h`;
  }
}
