/**
 * Velvet Palms after dark (8 PM – 4 AM). The building and its fixed fittings
 * come from the district plan (world/build.js); this is everything that moves:
 *
 *  - the door: Big Tomas lets you in once you've paid the cover (regulars and
 *    VIPs walk in); an invisible rope closes the doorway otherwise
 *  - people: three dancers working the stage and runway poles in sequined
 *    bodysuits, regulars in the booths, at the bar and along the runway rail,
 *    a few on the dance floor. They cheer when you tip, react to trouble like
 *    anyone else (cower, run, call 911), and are gone when you leave
 *  - the show: a turning mirror ball, sweeping light beams with spots on the
 *    stage, the room light pulsing on the kick, music that's muffled outside
 *  - the counters (menus via places.js): the bar (Jules), the stage rail (tips,
 *    "make it rain"), the DJ booth (DJ Marea takes requests), the VIP host
 *    (Celeste: a booth for an hour or until close)
 *  - drinks make you tipsy (the camera sways); water sobers you up
 *  - start a fight inside and the bouncer throws you out; shoot and the place
 *    empties for the night
 *
 * Adults-only, non-explicit: the dancers are fully costumed and the show is
 * pole work and dancing. Names and the business are invented.
 */
import * as THREE from 'three';
import { Character } from '../entities/character.js';
import { PedController } from '../ai/peds.js';
import { randomLook } from '../entities/humanModel.js';
import { PLACES } from '../world/district.js';

const HIPS = 0.95; // hip height of a 1.78 m person; scaled by height for seating
const NIGHT_TOPS = [0x111111, 0xf2f2f2, 0x7a1030, 0x6f5bd6, 0x1f3a5f, 0xd94f70, 0x2b2b2b, 0xd4af37];
const NIGHT_BOTTOMS = [0x111111, 0x1f1f1f, 0x2e3b55, 0x3c3c3c, 0xf2f2f2];
const PERFORMERS = [
  { female: true, height: 1.72, build: 0.92, skin: 0xc68642, hair: 0x1b1410, top: 0xffd23f, bottom: 0xffd23f, shoes: 0x111111, hairStyle: 'long', sleeveless: true, shorts: false, hat: null, beard: false },
  { female: true, height: 1.69, build: 0.9, skin: 0x8d5524, hair: 0x2e1f14, top: 0xd9dde3, bottom: 0xd9dde3, shoes: 0x111111, hairStyle: 'bun', sleeveless: true, shorts: false, hat: null, beard: false },
  { female: false, height: 1.84, build: 1.05, skin: 0xe0ac69, hair: 0x111111, top: 0xff3fa4, bottom: 0x1c1c1c, shoes: 0x111111, hairStyle: 'short', sleeveless: true, shorts: false, hat: null, beard: false },
];
export const CLUB_STYLES = { house: { name: 'house', style: 'house', bpm: 122 }, dembow: { name: 'dembow', style: 'dembow', bpm: 98 }, synth: { name: 'synthwave', style: 'synth', bpm: 108 } };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Club {
  constructor(game) {
    this.game = game;
    this.P = PLACES.club;
    this.L = this.P.layout;
    this.people = []; // {ch, role, ...}
    this.admittedUntil = -1;
    this.shutUntil = -1; // emptied by trouble until then
    this.panicUntil = -1; // the door stays open while people run out
    this.style = 'house';
    this.tipsy = 0;
    this.cheerT = 0;
    this.bills = [];
    this.fx = null;
    this.gate = null;
    this.thrownOut = 0;
    this.setGate(true);
    const ev = game.events;
    // trouble inside: a shot empties the place for the night; a punch gets you thrown out
    ev.on('gunshot', ({ shooter, x, z }) => { if (this.near(x, z, 4)) this.trouble(shooter); });
    ev.on('assault', ({ attacker, victim }) => {
      if (attacker !== game.player || !victim || !this.near(victim.pos.x, victim.pos.z, 1)) return;
      this.throwOut('Big Tomas', 'That\'s it. Out. OUT.');
    });
  }

  get hour() { return this.game.engine.time.hour; }
  /** Open for business: 8 PM to 4 AM, unless trouble emptied it tonight. */
  get isOpen() { const h = this.hour; return (h >= 20 || h < 4) && this.game.time > this.shutUntil; }
  near(x, z, m = 0) { const b = this.P.bounds; return x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m; }
  inside(ch) { return !!ch && !ch.vehicle && this.game.world.interiorAt(ch.pos.x, ch.pos.z, ch.pos.y)?.id === 'club'; }
  get playerInside() { return this.inside(this.game.player); }
  get admitted() { return this.game.time < this.admittedUntil; }
  get beat() { return 60 / CLUB_STYLES[this.style].bpm; }

  /** Paid the cover (or waved in): the door's open to you until closing. */
  admit() {
    const h = this.hour, until = ((4 - h) % 24 + 24) % 24;
    this.admittedUntil = this.game.time + until * 60; // one in-game hour per real minute
    this.setGate(false);
  }

  setGate(closed) {
    const cw = this.game.world.collision, d = this.L.door, w = this.L.wall;
    if (closed && !this.gate) this.gate = cw.add({ type: 'box', cx: d.x + w / 2, cz: d.z, hx: w / 2 + 0.25, hz: d.w / 2, y0: -1, y1: 3.2, tag: 'wall', material: 'wood', cameraBlock: false });
    if (!closed && this.gate) { cw.remove(this.gate); this.gate = null; }
    if (this.fx) this.fx.door.visible = closed;
  }

  // ------------------------------------------------------------ per step
  step(dt) {
    const g = this.game, p = g.player;
    const inside = this.playerInside;
    // the door: open to you while you're inside or on the list (and to everyone running out of trouble)
    const open = inside || (this.isOpen && this.admitted) || g.time < this.panicUntil;
    this.setGate(!open);
    // people and the show exist while you're close and it's open; they go home at closing
    const c = this.P.layout.door, d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z), h = this.hour;
    if (this.isOpen && d < 45 && !this.people.length) this.populate();
    else if (this.people.length && !inside && (d > 60 || (h >= 4 && h < 20))) this.clear();
    if (d < 45 || inside) this.ensureFx();
    if (this.fx) this.fx.group.visible = d < 70;
    if (this.people.length) this.stepPeople(dt);
    if (this.fx && this.fx.group.visible) this.stepFx(dt);
    this.stepBills(dt);
    // drinks wear off; water helps
    this.tipsy = Math.max(0, this.tipsy - dt * 0.003);
    if (this.boothT > 0) { this.boothT -= dt; if (this.boothT <= 0) this.standUp(); }
    if (this.cheerT > 0) this.cheerT -= dt;
    // the room light pulses on the kick while the music's playing
    const music = this.musicOn;
    const ph = (g.time / this.beat) % 1;
    g.world.clubPulse = music ? Math.exp(-ph * 6) : 0;
  }

  /** Is the DJ playing? (and nobody's run off) */
  get musicOn() {
    const dj = this.game.places?.staff?.clubdj;
    return this.isOpen && !!dj && !dj.dead && !dj.removed && !!dj.anim_.work;
  }

  /** What the audio plays: full inside, a muffled thump outside. */
  musicFor(cam) {
    if (!this.musicOn) return null;
    const c = this.L.door, insideCam = this.game.world.interiorAt(cam.x, cam.z, cam.y)?.id === 'club';
    if (insideCam) return { gain: 1, cutoff: 16000, ...CLUB_STYLES[this.style] };
    const d = Math.hypot(cam.x - c.x, cam.z - c.z);
    if (d > 55) return null;
    return { gain: 0.55 * (1 - d / 55), cutoff: this.gate ? 260 : 900, ...CLUB_STYLES[this.style] };
  }

  // ------------------------------------------------------------ people
  spawn(look, x, z, yaw, role, extra = {}) {
    const g = this.game;
    const ch = new Character(g, look, { role: 'ped', x, z, yaw });
    ch.controller = new PedController(g, ch, 'club');
    ch.controller.setState('club', 1e9);
    ch.civilian = true; ch.missionActor = true; ch.clubRole = role;
    ch.faceYaw = yaw;
    g.extras.push(ch);
    const person = { ch, role, t: rand(0, 6), ...extra };
    this.people.push(person);
    return person;
  }

  /** Seat someone (booth, stool) at a seat height. */
  seat(person, x, z, seatY, yaw) {
    const ch = person.ch, sc = ch.look.height / 1.78;
    ch.pos.set(x, seatY - HIPS * sc + 0.03, z);
    ch.yaw = yaw; ch.faceYaw = yaw;
    ch.pinned = true; ch.anim_.seated = true;
    person.seated = { x, z, y: ch.pos.y, yaw };
  }

  populate() {
    const L = this.L, y0 = 0.14, h = this.hour;
    // dancers: one on the runway pole, two on the stage
    L.poles.forEach((pole, i) => {
      const yaw = -Math.PI / 2; // facing the room
      const per = this.spawn({ ...PERFORMERS[i] }, pole.x - 0.45, pole.z, yaw, 'performer', { pole, phase: i % 2 ? 'dance' : 'pole', phaseT: rand(4, 10), ang: rand(0, 6) });
      per.ch.pinned = true;
      per.ch.name = ['Lux', 'Nova', 'Rio'][i];
    });
    // a fuller room late; quieter early and near closing
    const busy = h >= 22 || h < 2 ? 1 : 0.6;
    const look = () => ({ ...randomLook(), top: pick(NIGHT_TOPS), bottom: pick(NIGHT_BOTTOMS), shorts: false, hat: null });
    // the runway rail
    const rail = L.stools.filter((s) => !s.bar);
    for (const s of rail) if (Math.random() < 0.65 * busy) { const pp = this.spawn(look(), s.x, s.z, 0, 'rail'); this.seat(pp, s.x, s.z, y0 + 0.8, s.face > 0 ? 0 : Math.PI); }
    // the bar
    for (const s of L.stools.filter((x) => x.bar)) if (Math.random() < 0.4 * busy) { const pp = this.spawn(look(), s.x, s.z, Math.PI, 'bar'); this.seat(pp, s.x, s.z, y0 + 0.8, Math.PI); }
    // the booths (not the VIP one — that's yours if you pay)
    for (const bt of L.booths.filter((x) => !x.vip)) if (Math.random() < 0.8 * busy) {
      const cx = (bt.x0 + bt.x1) / 2, n = Math.random() < 0.6 ? 2 : 3;
      for (let k = 0; k < n; k++) { const x = cx + (k - (n - 1) / 2) * 0.75, pp = this.spawn(look(), x, bt.z1 - 0.8, Math.PI, 'booth'); this.seat(pp, x, bt.z1 - 0.8, y0 + 0.45, Math.PI); }
    }
    // dancing near the tables
    for (let k = 0; k < Math.round(4 * busy); k++) {
      const t = L.tables[k % L.tables.length], a = rand(0, 6);
      const x = t.x + Math.cos(a) * 1.1, z = t.z + Math.sin(a) * 1.1;
      const pp = this.spawn(look(), x, z, rand(-Math.PI, Math.PI), 'floor');
      pp.ch.pinned = true; pp.ch.anim_.dance = 1; pp.spin = rand(-0.4, 0.4);
    }
  }

  clear() {
    const g = this.game;
    for (const pp of this.people) if (!pp.ch.removed) g.removeCharacter(pp.ch);
    this.people = [];
  }

  stepPeople(dt) {
    const g = this.game, beat = this.beat, music = this.musicOn;
    for (const pp of this.people) {
      const ch = pp.ch, a = ch.anim_;
      if (ch.dead || ch.removed || ch.controller.state !== 'club') continue; // reacting to trouble: they're on their own now
      a.beat = beat;
      pp.t += dt;
      if (pp.role === 'performer') this.stepPerformer(pp, dt, music);
      else if (pp.role === 'floor') {
        a.dance = music ? 1 : 0;
        ch.faceYaw = (ch.faceYaw ?? ch.yaw) + dt * pp.spin;
        if (Math.random() < dt * 0.05) pp.spin = rand(-0.5, 0.5);
      } else {
        // seated regulars: watch the stage, cheer now and then (and whenever someone tips)
        const st = this.L.poles[0], look = Math.atan2(st.x - ch.pos.x, st.z - ch.pos.z);
        a.lookYaw = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(look - ch.yaw), Math.cos(look - ch.yaw))));
        if (pp.cheer > 0) pp.cheer -= dt;
        else if ((this.cheerT > 0 && Math.random() < dt * 2.5) || (music && Math.random() < dt * 0.015)) pp.cheer = rand(1.2, 2.4);
        a.cheer = pp.cheer > 0;
      }
    }
  }

  stepPerformer(pp, dt, music) {
    const ch = pp.ch, a = ch.anim_, pole = pp.pole, g = this.game;
    pp.phaseT -= dt;
    if (pp.phaseT <= 0) { pp.phase = pp.phase === 'pole' ? 'dance' : 'pole'; pp.phaseT = pp.phase === 'pole' ? rand(9, 15) : rand(7, 11); }
    if (!music) pp.phase = 'dance';
    let x, z, yaw;
    if (pp.phase === 'pole') {
      // a slow spin around the pole, the right hand holding on overhead (pole on the right)
      pp.ang -= dt * 1.1;
      x = pole.x + Math.sin(pp.ang) * 0.42; z = pole.z + Math.cos(pp.ang) * 0.42;
      yaw = pp.ang - Math.PI / 2;
      a.pole = true; a.dance = 0;
    } else {
      // dancing beside the pole, facing the room (or whoever just tipped)
      x = pole.x - 0.6; z = pole.z + Math.sin(pp.t * 0.4) * 0.5;
      yaw = pp.wave > 0 && this.tipper ? Math.atan2(this.tipper.pos.x - x, this.tipper.pos.z - z) : -Math.PI / 2 + Math.sin(pp.t * 0.3) * 0.5;
      a.pole = false; a.dance = music ? 2 : 0;
    }
    if (pp.wave > 0) { pp.wave -= dt; a.cheer = pp.wave > 0.4; } else a.cheer = false;
    ch.pos.set(x, g.world.ground(x, z, 3), z);
    ch.faceYaw = yaw;
  }

  /** Everyone at the rail and in the booths cheers; the dancers wave at the tipper. */
  cheer(seconds, tipper) {
    this.cheerT = seconds;
    this.tipper = tipper;
    for (const pp of this.people) if (pp.role === 'performer' && Math.random() < 0.8) { pp.wave = 1.8; pp.phase = 'dance'; pp.phaseT = Math.max(pp.phaseT, 3); }
  }

  /** Trouble inside: the music stops, everyone reacts (peds.js), and the place stays empty tonight. */
  trouble(by) {
    if (!this.people.length && !this.game.places?.staff?.clubdj) return;
    this.shutUntil = this.game.time + 9 * 60;
    this.panicUntil = this.game.time + 90;
    this.admittedUntil = -1;
    if (by === this.game.player || by === this.game.partner) this.game.social?.post({ local: true, text: 'SHOTS FIRED inside Velvet Palms. everybody ran. i lost a shoe', about: true, likes: 40, clip: true });
  }

  /** The bouncer walks you out to the sidewalk (a punch-up inside). */
  throwOut(who, line) {
    const g = this.game, p = g.player, d = this.L.door;
    g.hud?.subtitle(who, line, 3);
    g.app?.fade?.(0.8);
    g.places?.close();
    if (p.pinned) this.standUp();
    g.respawnPlayer(d.x - 3.5, d.z + 3.5, -Math.PI / 2, { health: p.health });
    this.admittedUntil = -1;
    this.thrownOut++; // (the bouncer's memory of it is kept by places.js)
    g.social?.post({ local: true, text: 'just watched the Velvet Palms bouncer carry someone out by the collar lmao', about: true, likes: 22 });
  }

  // ------------------------------------------------------------ counters (menus in places.js)
  items(id, mem) {
    const g = this.game, p = g.player, name = p.protagonistName;
    switch (id) {
      case 'club': {
        const regular = mem.visits >= 3 || mem.vip;
        return [{ label: regular ? 'Walk in (you\'re on the list)' : 'Pay the cover and go in', price: regular ? 0 : 20, act: () => { this.admit(); g.places.close(); g.hud?.subtitle('Big Tomas', regular ? `Go ahead, ${name}.` : 'Enjoy your night. Keep your hands to yourself.', 3); } }];
      }
      case 'clubbar': return [
        { label: 'Velvet mojito', price: 12, note: '+10 health', act: () => this.drink(mem, 'Velvet mojito', 10, 0.25) },
        { label: 'Rum and coke', price: 9, note: '+8 health', act: () => this.drink(mem, 'rum and coke', 8, 0.22) },
        { label: 'Sparkling water', price: 3, note: 'sobers you up', act: () => this.drink(mem, 'sparkling water', 5, -0.35) },
        { label: 'A round for the bar', price: 150, act: () => {
          this.drink(mem, 'a round', 5, 0.15); this.cheer(4, p); mem.rounds = (mem.rounds || 0) + 1;
          g.places.openShop.msg = 'The whole bar raises a glass to you.';
          g.social?.post({ local: true, text: g.memory.state.nickname && g.memory.notoriety(p.pos.x, p.pos.z) > 30 ? `${g.memory.state.nickname} just bought the whole bar at Velvet Palms a round??` : 'somebody just bought the entire bar at Velvet Palms a round. who ARE you', about: true, likes: 25 });
        } },
        { label: 'Bottle service (VIP)', price: 400, note: 'and the VIP list', act: () => {
          this.drink(mem, 'bottle service', 0, 0.3); g.memory.person('club').vip = true; g.memory.person('clubvip').vip = true;
          g.places.openShop.msg = 'Sparklers. A bottle. Celeste puts your name on the VIP list.';
          g.social?.post({ local: true, text: 'bottle service with SPARKLERS at Velvet Palms on a weeknight. ok big spender 👀', about: true, likes: 18 });
        } },
      ];
      case 'clubstage': return [
        { label: 'Tip the dancers', price: 20, act: () => this.tip(mem, 10, 2) },
        { label: 'Make it rain', price: 200, act: () => this.tip(mem, 70, 5, true) },
      ];
      case 'clubdj': return Object.values(CLUB_STYLES).map((s) => ({
        label: `Request some ${s.name}`, price: 10, owned: this.style === s.style, act: () => {
          this.style = s.style;
          mem.requests = mem.requests || {}; mem.requests[s.style] = (mem.requests[s.style] || 0) + 1;
          g.places.openShop.msg = `“This one goes out to ${name}!”`;
          g.hud?.subtitle('DJ Marea', `This one goes out to ${name}!`, 2.5);
          this.cheer(2, p);
        },
      }));
      case 'clubvip': {
        const vip = !!mem.vip;
        return [
          { label: 'A booth for an hour', price: vip ? 0 : 60, note: '+health, time passes', act: () => this.boothTime(1) },
          { label: 'VIP booth until close', price: vip ? 0 : 250, act: () => this.boothTime(((4 - this.hour) % 24 + 24) % 24) },
        ];
      }
      default: return [];
    }
  }

  drink(mem, what, hp, tipsy) {
    const p = this.game.player;
    p.health = Math.min(100, p.health + hp);
    const before = this.tipsy;
    this.tipsy = Math.max(0, Math.min(1, this.tipsy + tipsy));
    mem.usual = what === 'sparkling water' || what === 'a round' ? mem.usual : what;
    mem.drinks = (mem.drinks || 0) + 1;
    if (before < 0.6 && this.tipsy >= 0.6) this.game.hud?.notify('You\'re feeling it. Maybe let someone else drive.', 'Velvet Palms', '', 4);
  }

  tip(mem, bills, cheer, rain = false) {
    const g = this.game, p = g.player;
    this.throwBills(bills);
    this.cheer(cheer, p);
    mem.tips = (mem.tips || 0) + 1;
    if (rain) {
      mem.rains = (mem.rains || 0) + 1;
      g.places.openShop.msg = 'Bills everywhere. The whole rail is on its feet.';
      // someone at the rail films it for LOOP
      const fan = this.people.find((x) => x.role === 'rail' && !x.ch.dead) || this.people.find((x) => !x.ch.dead && x.role !== 'performer');
      const nick = g.memory.state.nickname, famous = nick && g.memory.notoriety(p.pos.x, p.pos.z) > 30;
      const reel = fan && g.social ? g.social.film(fan.ch, () => ({ x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z })) : null;
      g.social?.post({ local: true, text: famous ? `${nick} just made it RAIN at Velvet Palms 💸💸 is this where the money goes??` : 'someone just made it rain at Velvet Palms 💸💸 the dancers are never forgetting this', about: true, likes: 60, reel, clip: true });
    } else g.places.openShop.msg = 'The dancers wave you a thank-you.';
  }

  /** Celeste shows you to the VIP booth; time passes in the fade. */
  boothTime(hours) {
    const g = this.game, p = g.player, bt = this.L.booths.find((b) => b.vip);
    g.app?.fade?.(1.2);
    g.engine.time.hour = (g.engine.time.hour + hours) % 24;
    p.health = 100;
    g.places.close();
    const x = (bt.x0 + bt.x1) / 2, z = bt.z1 - 0.8, sc = p.look.height / 1.78;
    this.booth = { x, z: bt.z0 - 0.7 };
    p.pos.set(x, 0.14 + 0.45 - HIPS * sc + 0.03, z); p.yaw = Math.PI; p.faceYaw = Math.PI; p.vel.set(0, 0, 0);
    p.pinned = true; p.anim_.seated = true;
    this.boothT = 2.5;
    g.hud?.notify(hours > 1 ? 'You closed the place down. Big Tomas walks you to the door.' : 'An hour in a booth, a drink, and the bass still in your chest.', 'Velvet Palms', '', 5);
  }

  standUp() {
    const g = this.game, p = g.player;
    p.pinned = false; p.anim_.seated = false; p.faceYaw = null;
    if (this.booth) p.pos.set(this.booth.x, g.world.ground(this.booth.x, this.booth.z, 2), this.booth.z);
    this.boothT = 0;
  }

  // ------------------------------------------------------------ the show
  ensureFx() {
    if (this.fx) return;
    const g = this.game, L = this.L, group = new THREE.Group();
    group.name = 'velvet-palms';
    const ceil = L.ceiling;
    // mirror ball over the runway
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), new THREE.MeshStandardMaterial({ color: 0xdedee8, metalness: 1, roughness: 0.18, flatShading: true, emissive: 0x2a1a33 }));
    ball.position.set((L.runway.x0 + L.runway.x1) / 2, ceil - 0.95, L.door.z);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    wire.position.set(ball.position.x, ceil - 0.47, ball.position.z);
    group.add(ball, wire);
    // light beams from the truss, with spots where they land
    const cone = new THREE.ConeGeometry(0.55, 1, 18, 1, true); cone.translate(0, -0.5, 0);
    const disc = new THREE.CircleGeometry(0.75, 24); disc.rotateX(-Math.PI / 2);
    const st = L.stage, rw = L.runway;
    const rigs = [
      { at: [rw.x0 + 0.5, ceil - 0.3, L.door.z], c: 0xff3fa4, cx: (rw.x0 + rw.x1) / 2, cz: L.door.z, ax: 3, az: 1, w: [0.7, 1.1] },
      { at: [st.x0 + 0.55, ceil - 0.3, st.z0 + 1.5], c: 0x29e6ff, cx: (st.x0 + st.x1) / 2, cz: L.door.z - 3, ax: 2, az: 3, w: [0.9, 0.6] },
      { at: [st.x0 + 0.55, ceil - 0.3, st.z1 - 1.5], c: 0xb455ff, cx: (st.x0 + st.x1) / 2, cz: L.door.z + 3, ax: 2, az: 3, w: [0.5, 0.8] },
      { at: [rw.x1 - 1.5, ceil - 0.3, L.door.z], c: 0xffd23f, cx: L.inner.x0 + 5, cz: L.door.z, ax: 3.5, az: 6, w: [0.35, 0.45] },
    ];
    const beams = rigs.map((r, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(cone, mat); m.position.set(...r.at); m.renderOrder = 5;
      const spot = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color: r.c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      spot.renderOrder = 4;
      group.add(m, spot);
      return { ...r, m, spot, ph: i * 1.7 };
    });
    // the door (shown when you're not let in), and the bills
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, L.door.h - 0.12, L.door.w - 0.1), new THREE.MeshStandardMaterial({ color: 0x5a0f2a, roughness: 0.6 }));
    door.position.set(L.door.x + L.wall / 2, 0.14 + (L.door.h - 0.12) / 2, L.door.z);
    door.visible = !!this.gate;
    const bill = new THREE.PlaneGeometry(0.15, 0.07);
    const bills = new THREE.InstancedMesh(bill, new THREE.MeshStandardMaterial({ color: 0x6fae6a, side: THREE.DoubleSide, roughness: 0.8 }), 120);
    bills.count = 0; bills.frustumCulled = false;
    group.add(door, bills);
    g.engine.scene.add(group);
    this.fx = { group, ball, beams, door, bills, t: 0 };
  }

  stepFx(dt) {
    const fx = this.fx, g = this.game, music = this.musicOn;
    fx.t += dt;
    fx.ball.rotation.y += dt * 0.7;
    const v = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    for (const b of fx.beams) {
      b.m.visible = b.spot.visible = music;
      if (!music) continue;
      const tx = b.cx + Math.sin(fx.t * b.w[0] + b.ph) * b.ax, tz = b.cz + Math.sin(fx.t * b.w[1] + b.ph * 1.3) * b.az;
      const ty = g.world.ground(tx, tz, 3) + 0.02;
      v.set(tx - b.at[0], ty - b.at[1], tz - b.at[2]);
      const len = v.length();
      b.m.quaternion.setFromUnitVectors(down, v.normalize());
      b.m.scale.set(1 + len * 0.12, len, 1 + len * 0.12);
      b.spot.position.set(tx, ty, tz);
    }
  }

  throwBills(n) {
    const p = this.game.player, pole = this.L.poles[0];
    for (let i = 0; i < n && this.bills.length < 120; i++) {
      const d = new THREE.Vector3(pole.x - p.pos.x, 0, pole.z - p.pos.z).normalize();
      this.bills.push({
        p: new THREE.Vector3(p.pos.x + d.x * 0.4, p.pos.y + 1.5, p.pos.z + d.z * 0.4),
        v: new THREE.Vector3(d.x * rand(1.5, 4) + rand(-1, 1), rand(1.5, 3.5), d.z * rand(1.5, 4) + rand(-1, 1)),
        r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), spin: rand(-8, 8), life: 25, landed: false,
      });
    }
  }

  stepBills(dt) {
    if (!this.bills.length) return;
    const g = this.game, m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    for (const b of this.bills) {
      b.life -= dt;
      if (b.landed) continue;
      b.v.y -= 6 * dt; b.v.multiplyScalar(1 - 1.8 * dt); // paper flutters down slowly
      b.p.addScaledVector(b.v, dt);
      b.r.x += b.spin * dt; b.r.z += b.spin * 0.6 * dt;
      const gy = g.world.ground(b.p.x, b.p.z, b.p.y + 0.5) + 0.01;
      if (b.p.y <= gy) { b.p.y = gy; b.landed = true; b.r.set(-Math.PI / 2, 0, b.r.z); }
    }
    this.bills = this.bills.filter((b) => b.life > 0);
    if (!this.fx) return;
    const im = this.fx.bills;
    this.bills.forEach((b, i) => { q.setFromEuler(b.r); m.compose(b.p, q, one); im.setMatrixAt(i, m); });
    im.count = this.bills.length;
    im.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.clear();
    if (this.gate) { this.game.world.collision.remove(this.gate); this.gate = null; }
    if (this.fx) { this.game.engine.scene.remove(this.fx.group); this.fx = null; }
    this.game.world.clubPulse = 0;
  }
}
