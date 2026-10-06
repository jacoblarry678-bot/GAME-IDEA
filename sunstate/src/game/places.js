/**
 * Places with something to do, each with a member of staff who remembers
 * you — Cal and Sol separately (see memory.js):
 *
 *   Bayfront Arms      gun shop: ammo, body armour, the Vela Viper SMG
 *   Threads on 5th     clothes: a new outfit (and a description that no longer fits)
 *   Sunshine Gas       mini-mart: snacks, coffee, scratch tickets
 *   Coral Auto Body    drive into the bay: repair, respray + new plates
 *   Velvet Palms       adults-only club (exterior and door only): an hour or a night inside
 *   Bayshore Park      lawns, a fountain, a basketball court (no shop)
 *
 * Shop menus: walk up and press E (drive into the auto-shop bay and press E),
 * pick with the number keys, E again to leave. Names and businesses are invented.
 */
import { Character } from '../entities/character.js';
import { PedController } from '../ai/peds.js';
import { PLACES } from '../world/district.js';
import { WEAPONS } from '../data/weapons.js';
import { randomPlate } from '../entities/vehicle.js';

export const OUTFITS = {
  cal: [
    { name: 'Cream linen shirt', top: 0xe9e2d0, bottom: 0x2e3b55 },
    { name: 'Black tee and jeans', top: 0x1c1c1c, bottom: 0x2e3b55 },
    { name: 'Teal guayabera', top: 0x2bb8c9, bottom: 0xd9d4c7 },
    { name: 'Red windbreaker', top: 0xb5332e, bottom: 0x3a3a3a },
    { name: 'White tank and shorts', top: 0xf2f2f2, bottom: 0x6c7a52, sleeveless: true, shorts: true },
  ],
  sol: [
    { name: 'Coral tank and denim shorts', top: 0xd94f70, bottom: 0x34405e, sleeveless: true, shorts: true },
    { name: 'Yellow top and white jeans', top: 0xe8b83a, bottom: 0xf2f2f2 },
    { name: 'Black jumpsuit', top: 0x1c1c1c, bottom: 0x1c1c1c },
    { name: 'Purple blouse', top: 0x6f5bd6, bottom: 0xd9d4c7 },
    { name: 'Light blue sundress', top: 0x8fb7c9, bottom: 0x8fb7c9, sleeveless: true },
  ],
};

const look = (o) => ({ female: false, height: 1.78, build: 1.05, skin: 0xc68642, hair: 0x1b1410, top: 0x333333, bottom: 0x2b2b2b, shoes: 0x222222, hairStyle: 'short', shorts: false, sleeveless: false, hat: null, beard: false, ...o });

/** Who works where, what they say, and what they sell. */
export const SHOPS = {
  gunshop: {
    title: 'Bayfront Arms', staff: 'Dee', verb: 'Browse the counter',
    look: look({ female: true, height: 1.7, skin: 0x8d5524, hair: 0x111111, top: 0x4a4f55, hairStyle: 'bun' }),
    greet: (p, name, ctx) => (p.visits === 0 ? 'Bayfront Arms. Licence? ...Yeah, nobody has one. What do you need?'
      : p.visits < 3 ? `${name}, right? Back already.` : `${name}! My best customer. Regulars get ten percent.`) + (ctx.fame > 50 ? ' And maybe stay off LOOP for a while.' : ''),
    refuse: (g) => (g.wanted.level > 0 ? 'Not with cops on your tail. Come back clean.' : null),
  },
  clothes: {
    title: 'Threads on 5th', staff: 'Ines', verb: 'Try something on',
    look: look({ female: true, height: 1.65, skin: 0xe0ac69, hair: 0x4a3020, top: 0x6f5bd6, bottom: 0x1c1c1c, hairStyle: 'long' }),
    greet: (p, name, ctx) => (ctx.described ? 'Mm. You look like the person on the news. Let\'s fix that.'
      : p.visits === 0 ? 'Welcome to Threads! Everything\'s on sale. Everything is always on sale.' : `Back again, ${name}? I set something aside for you.`),
    refuse: () => null,
  },
  gas: {
    title: 'Sunshine Gas', staff: 'Raj', verb: 'Go to the counter',
    look: look({ skin: 0xa66a3f, hair: 0x111111, top: 0xe86b2a, bottom: 0x2e3b55, beard: true }),
    greet: (p, name, ctx) => (ctx.fame > 60 ? 'I know who you are. Pay and go, please. No trouble.'
      : p.visits === 0 ? 'Sunshine Gas, how you doing.' : p.visits < 4 ? 'Hey, you again. Coffee?' : `${name}! The usual?`),
    refuse: (g) => (g.wanted.level > 1 ? 'Doors are locked. Police are everywhere, man.' : null),
  },
  autoshop: {
    title: 'Coral Auto Body', staff: 'Hector', verb: 'Pull into the bay', inCar: true,
    look: look({ skin: 0xc68642, hair: 0x2e1f14, top: 0x2b7fd1, bottom: 0x2b2b2b, hat: 0x2b7fd1, beard: true, build: 1.15 }),
    greet: (p, name, ctx) => (p.resprays >= 2 ? `Again, ${name}? I don't ask questions. I just mix paint.`
      : ctx.wanted ? 'Get it inside, quick. Door\'s coming down.' : p.visits === 0 ? 'Coral Auto Body. What happened to it?' : `${name}. What did you do to it this time?`),
    refuse: (g) => (g.player.vehicle?.police ? 'A police car? Absolutely not. Get that out of my shop.' : !g.player.vehicle || g.player.seat !== 0 ? 'Bring the car in, then we talk.' : null),
  },
  club: {
    title: 'Velvet Palms', staff: 'Big Tomas', verb: 'Talk to the bouncer',
    look: look({ height: 1.93, build: 1.32, skin: 0x5c3a21, hair: 0x111111, top: 0x111111, bottom: 0x111111, hairStyle: 'bald', beard: true }),
    greet: (p, name, ctx) => (p.visits >= 3 ? `${name}. Your booth's waiting.` : p.visits > 0 ? 'Back again. Behave this time.' : 'Velvet Palms. Adults only, no cameras, no trouble.'),
    refuse: (g, p, ctx) => {
      const h = g.engine.time.hour;
      if (h > 4 && h < 20) return 'Doors open at 8 PM.';
      if (g.wanted.level > 0) return 'Not tonight. You\'ve got company.';
      if (p.trouble > 0) return 'You know what you did. Not tonight.';
      if (ctx.fame > 75) return `You're ${ctx.nickname || 'all over LOOP'}. Not in here, friend.`;
      return null;
    },
  },
};

export class Places {
  constructor(game) {
    this.game = game;
    this.staff = {};
    this.openShop = null; // {id, greeting, msg}
    this.lastVisit = {};
    this.PLACES = PLACES;
    for (const [id, def] of Object.entries(SHOPS)) {
      const P = PLACES[id];
      if (def.inCar) continue;
      game.interactables.push({
        id: 'shop:' + id, x: P.door.x, z: P.door.z, radius: 2.4,
        label: () => (this.openShop ? null : `${def.title}: ${def.verb}`),
        onInteract: () => this.open(id),
      });
    }
    // trouble near the club is remembered by the bouncer
    const trouble = ({ x, z }) => { const c = PLACES.club.door; if (Math.hypot(x - c.x, z - c.z) < 40) game.memory.person('club').trouble++; };
    game.events.on('gunshot', ({ shooter, x, z }) => { if (shooter === game.player) trouble({ x, z }); });
    game.events.on('assault', ({ attacker, victim }) => { if (attacker === game.player) trouble(victim.pos); });
  }

  ctx() {
    const g = this.game, p = g.player;
    return { fame: g.memory.notoriety(p.pos.x, p.pos.z), nickname: g.memory.state.nickname, described: g.memory.matchScore() > 0, wanted: g.wanted.level > 0 };
  }

  step(dt) {
    const g = this.game, p = g.player;
    // staff appear when you're near, and stay at their post
    for (const id of Object.keys(SHOPS)) {
      const P = PLACES[id], d = p.distanceTo(P.staff.x, P.staff.z);
      let s = this.staff[id];
      if (!s && d < 100) s = this.spawnStaff(id);
      else if (s && d > 150 && this.openShop?.id !== id) { if (!s.removed) g.removeCharacter(s); delete this.staff[id]; continue; }
      if (s && !s.dead && s.controller.state === 'idle') { s.pos.x = P.staff.x; s.pos.z = P.staff.z; s.faceYaw = P.staff.rot; }
    }
    // driving into the auto-shop bay
    const A = PLACES.autoshop.bay, v = p.vehicle;
    this.inBay = !!v && p.seat === 0 && v.pos.x > A.x0 && v.pos.x < A.x1 && v.pos.z > A.z0 && v.pos.z < A.z1;
    if (this.inBay && !this.openShop && v.speed < 1.5) {
      p.controller.prompt = { key: 'interact', text: 'Coral Auto Body: repair / respray' };
      if (g.input.pressed('interact')) this.open('autoshop');
    }
    if (!this.openShop) return;
    const o = this.openShop;
    // pick with the number keys; E (or walking off) closes
    for (let i = 1; i <= 6; i++) if (g.input.edges.has('Digit' + i) || g.input.edges.has('Numpad' + i) || g.input.virtual.edges.has('shop' + i)) this.buy(i - 1);
    if (g.input.pressed('interact') && o.t > 0) this.close(); // (not the same press that opened it)
    o.t += dt;
    if (p.dead || (g.wanted.level > 0 && ['gunshop', 'gas', 'club'].includes(o.id))) this.close();
  }

  spawnStaff(id) {
    const g = this.game, P = PLACES[id], def = SHOPS[id];
    const s = new Character(g, def.look, { role: 'ped', x: P.staff.x, z: P.staff.z, yaw: P.staff.rot });
    s.controller = new PedController(g, s, 'clerk');
    s.controller.setState('idle', 1e9);
    s.missionActor = true; s.name = def.staff; s.staffOf = id;
    g.extras.push(s);
    this.staff[id] = s;
    return s;
  }

  open(id) {
    const g = this.game, def = SHOPS[id], p = g.player;
    const st = this.staff[id];
    if (st?.dead) { g.hud?.notify(`${def.title} is closed. There's police tape across the door.`, def.title, 'warn', 4); return; }
    const mem = g.memory.person(id), ctx = this.ctx();
    const no = def.refuse(g, mem, ctx);
    const name = p.protagonistName;
    if (no) { g.hud?.subtitle(def.staff, no, 3); return; }
    const greeting = def.greet(mem, name, ctx);
    // a visit counts once per trip (they remember how often each of you comes by)
    const key = id + p.protagonist;
    if (!(g.time - (this.lastVisit[key] ?? -1e9) < 120)) { this.lastVisit[key] = g.time; g.memory.visit(id); }
    this.openShop = { id, greeting, msg: '', t: 0 };
    p.controller.frozen = true;
    g.hud?.subtitle(def.staff, greeting, 3.5);
    g.audio?.ui('select');
  }

  close() {
    if (!this.openShop) return;
    this.openShop = null;
    this.game.player.controller.frozen = false;
    this.game.audio?.ui('switch');
  }

  /** The menu for the open shop: [{label, price, note?, owned?, act()}] */
  items() {
    const o = this.openShop;
    if (!o) return [];
    const g = this.game, p = g.player, inv = p.controller.inventory, mem = g.memory.person(o.id);
    const off = o.id === 'gunshop' && mem.visits >= 3 ? 0.9 : 1;
    const price = (n) => Math.round(n * off);
    switch (o.id) {
      case 'gunshop': return [
        { label: 'Pistol ammo ×48', price: price(60), act: () => { inv.ammo.pistol = inv.ammo.pistol || { mag: 0, reserve: 0 }; p.controller.giveWeapon('pistol', 48); } },
        { label: 'Body armour', price: price(200), note: `armour ${Math.round(p.armor)}%`, act: () => { p.armor = 100; } },
        inv.weapons.includes('smg')
          ? { label: 'Vela Viper ammo ×90', price: price(90), act: () => p.controller.giveWeapon('smg', 90) }
          : { label: 'Vela Viper SMG (+90 rounds)', price: price(1500), act: () => { p.controller.giveWeapon('smg', 90); g.social?.post({ local: true, text: 'whoever just walked out of Bayfront Arms with a whole bag of guns: please don\'t', likes: 4 }, false); } },
      ];
      case 'clothes': return OUTFITS[p.protagonist].map((o2) => ({
        label: o2.name, price: 80, owned: p.look.top === o2.top && p.look.bottom === o2.bottom,
        act: () => {
          const before = g.memory.matchScore();
          p.setLook({ ...p.look, top: o2.top, bottom: o2.bottom, sleeveless: !!o2.sleeveless, shorts: !!o2.shorts });
          if (before > 0 && g.memory.matchScore() === 0) g.hud?.notify('You no longer match the description the police have.', 'Threads on 5th', '', 5);
        },
      }));
      case 'gas': return [
        { label: 'Snacks', price: 8, note: '+25 health', act: () => { p.health = Math.min(100, p.health + 25); } },
        { label: 'Café con leche', price: 4, note: '+10 health', act: () => { p.health = Math.min(100, p.health + 10); } },
        { label: 'Scratch ticket', price: 10, act: () => {
          const r = Math.random();
          const win = r < 0.05 ? 500 : r < 0.3 ? 20 + Math.floor(Math.random() * 5) * 10 : 0;
          if (win) { g.economy.add(win, 'Scratch ticket'); o.msg = `Winner! $${win}.`; if (win >= 500) g.social?.post({ local: true, text: 'somebody just won $500 on a scratcher at Sunshine Gas and Raj did a little dance 😭', likes: 30, about: true }); }
          else o.msg = 'Nothing. Raj shrugs.';
        } },
      ];
      case 'autoshop': {
        const v = p.vehicle;
        if (!v) return [];
        const repair = Math.max(40, Math.round((1000 - v.health) * 0.6));
        return [
          { label: 'Repair', price: v.health >= 999 ? 0 : repair, note: `${Math.round(v.health / 10)}% condition`, disabled: v.health >= 999, act: () => { v.health = 1000; v.smoking = false; } },
          { label: 'Respray + new plates', price: 300, note: g.wanted.level > 0 ? 'loses the police if they can\'t see you' : 'the police won\'t know the car', act: () => this.respray(v) },
        ];
      }
      case 'club': return [
        { label: 'Cover and a drink (an hour inside)', price: 60, act: () => this.clubTime(1) },
        { label: 'VIP booth (until close)', price: 250, act: () => { const h = g.engine.time.hour; this.clubTime(((4 - h) % 24 + 24) % 24); } },
      ];
      default: return [];
    }
  }

  buy(i) {
    const g = this.game, o = this.openShop, it = this.items()[i];
    if (!o || !it || it.disabled || it.owned) return false;
    if (g.economy.money < it.price) { o.msg = 'You can\'t afford that.'; g.audio?.ui('empty'); return false; }
    if (it.price > 0) g.economy.take(it.price, `${SHOPS[o.id].title}: ${it.label}`);
    it.act();
    if (!o.msg || !/Winner|Nothing/.test(o.msg)) o.msg = `${it.label} — done.`;
    g.audio?.ui('select');
    g.events.emit('purchase', { shop: o.id, item: it.label, price: it.price });
    return true;
  }

  respray(v) {
    const g = this.game, d = v.def, mem = g.memory.person('autoshop');
    const choices = d.colors.filter((c) => c !== v.color);
    v.color = choices.length ? choices[Math.floor(Math.random() * choices.length)] : 0x2f2f33;
    v.mesh.parts.paint.color.setHex(v.color);
    v.setPlate(randomPlate());
    v.health = Math.max(v.health, 700);
    mem.resprays = (mem.resprays || 0) + 1;
    const desc = g.memory.state.description;
    if (desc?.vehicle && desc.vehicle.id === (v.persistentId || v.id)) desc.vehicle = null;
    // the respray loses the police if none of them can see the car right now
    if (g.wanted.level > 0 && g.wanted.level <= 3 && !g.police.canSeePlayer()) { g.wanted.clear(); g.hud?.notify('New paint, new plates. The police lost track of the car.', 'Coral Auto Body', '', 5); }
  }

  clubTime(hours) {
    const g = this.game, p = g.player;
    g.engine.time.hour = (g.engine.time.hour + hours) % 24;
    p.health = 100;
    g.app?.fade(1.2);
    this.close();
    g.hud?.notify(hours > 1 ? 'You closed the place down. Big Tomas walks you to the door.' : 'An hour, a drink, and the bass still in your chest.', 'Velvet Palms', '', 5);
    if (Math.random() < 0.5) g.social?.post({ local: true, text: 'Velvet Palms is PACKED tonight. line around the corner', likes: 9 }, false);
  }
}

export { WEAPONS };
