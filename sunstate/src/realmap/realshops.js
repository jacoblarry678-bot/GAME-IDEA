/**
 * Shops on the real map. Every business in the map data (Overture places) of a kind the game
 * knows becomes a walk-up counter at its real location, under an invented name: convenience
 * stores, gas stations, restaurants, cafés, bars, clothes, jewellers, phone shops, pharmacies,
 * gun shops, pawn shops, auto body shops, car dealers, banks, hotels, gyms, barbers, cinemas…
 *
 * Walk up to the door and press E; pick with the number keys (E again to leave). Auto body
 * shops serve you in the car. Holding a gun at a till lets you rob it (the alarm calls it in).
 * The safehouse is an apartment on Ocean Drive: save, sleep, change clothes.
 *
 * Exposes the same interface as game/places.js (openShop, items(), buy(), close(), step()) so
 * the HUD's shop menu works unchanged.
 */
import { SURF } from './tilemesh.js';
import { OUTFITS } from '../game/places.js';
import { VEHICLES } from '../data/vehicles.js';
import { randomPlate } from '../entities/vehicle.js';
import { REAL_SAFEHOUSE } from './spots.js';

const rand = (a, b) => a + Math.random() * (b - a);

/** Map data kind → shop type. Kinds not listed (offices, schools, churches…) have no counter. */
const GROUP = {
  convenience: 'mart', liquor: 'mart', gas: 'gas', grocery: 'grocery',
  restaurant: 'food', fastfood: 'fastfood', cafe: 'cafe',
  bar: 'bar', nightclub: 'bar', strip_club: 'bar', casino: 'casino',
  clothes: 'clothes', sports: 'clothes', mall: 'clothes', jewelry: 'jewelry',
  electronics: 'phone', phone: 'phone', pharmacy: 'pharmacy', hospital: 'clinic',
  guns: 'guns', pawn: 'pawn', autobody: 'autobody', cardealer: 'cardealer',
  bank: 'bank', atm: 'atm', hotel: 'hotel', motel: 'motel',
  gym: 'gym', barber: 'barber', beauty: 'salon', tattoo: 'tattoo', cinema: 'cinema', police: 'police',
};

/** Shop types: invented name parts, the counter verb, the map icon and colour. */
const TYPES = {
  mart: { a: ['Sunray', 'Corner', 'Bayside', 'Palm', 'Tropic', 'Quick', 'Coral', 'Flamingo', 'Lucky', 'Ocean'], b: ['Mart', 'Market', 'Stop', 'Minimart', 'Food Store', 'Bodega'], verb: 'Go to the counter', icon: '$', color: '#ffd23f', rob: [150, 450] },
  gas: { a: ['Sunray', 'Gulfstream', 'Seabreeze', 'Coastal', 'Keys', 'Bayline'], b: ['Gas', 'Fuel', 'Gas & Go', 'Petro'], verb: 'Go to the counter', icon: '⛽', color: '#ffd23f', rob: [200, 500] },
  grocery: { a: ['Fresh', 'Bay', 'Island', 'Palm', 'Sabor'], b: ['Market', 'Grocery', 'Foods', 'Supermercado'], verb: 'Shop', icon: '$', color: '#9be564', rob: [300, 700] },
  food: { a: ['Casa', 'Little', 'Blue', 'Sea Salt', 'Palm', 'Coral', 'Mango'], b: ['Kitchen', 'Grill', 'Cocina', 'Bistro', 'Fish House', 'Trattoria'], verb: 'Get a table', icon: '♨', color: '#ff9f43' },
  fastfood: { a: ['Burger', 'Chicken', 'Taco', 'Pizza', 'Croqueta', 'Empanada'], b: ['Shack', 'Barn', 'Express', 'Spot', 'Stand', 'Window'], verb: 'Order', icon: '♨', color: '#ff9f43' },
  cafe: { a: ['Cafecito', 'Colada', 'Sunrise', 'Bay', 'Cortadito'], b: ['Corner', 'House', 'Window', 'Bar', '& Co.'], verb: 'Order', icon: '♨', color: '#c8a27a' },
  bar: { a: ['Neon', 'Salt', 'Rum', 'Tide', 'Lime', 'Night', 'Palm'], b: ['Lounge', 'Bar', 'Room', 'Tavern', 'Club'], verb: 'Order a drink', icon: '♪', color: '#ff3fa4' },
  casino: { a: ['Lucky', 'Gold Coast', 'Palm'], b: ['Casino', 'Card Room'], verb: 'Play', icon: '♠', color: '#ff3fa4' },
  clothes: { a: ['Threads', 'Moda', 'Coast', 'Sol', 'Linen', 'Tide'], b: ['Boutique', 'Outfitters', 'Wear', '& Co.', 'Closet'], verb: 'Try something on', icon: 'T', color: '#c77dff' },
  jewelry: { a: ['Gold', 'Diamond', 'Pearl', 'Bijou'], b: ['Exchange', 'Jewelers', 'Vault'], verb: 'Look at the cases', icon: '◆', color: '#ffe066', rob: [800, 2500] },
  phone: { a: ['Cell', 'Signal', 'Pocket', 'Bay'], b: ['Hub', 'Shop', 'Mobile', 'Wireless'], verb: 'Browse phones', icon: '☎', color: '#4cc9f0' },
  pharmacy: { a: ['Bay', 'Sun', 'Care', 'Coral'], b: ['Pharmacy', 'Drugs', 'Rx'], verb: 'Go to the counter', icon: '✚', color: '#80ed99', rob: [150, 400] },
  clinic: { a: ['Ocean', 'Bay', 'Mercy', 'Coral'], b: ['Medical Center', 'Clinic', 'Urgent Care'], verb: 'See a nurse', icon: '+', color: '#ff5566' },
  guns: { a: ['Bayfront', 'Gulf', 'Everglades', 'Coastal'], b: ['Arms', 'Firearms', 'Gun & Pawn', 'Outfitters'], verb: 'Browse the counter', icon: '⌖', color: '#ff8a5c' },
  pawn: { a: ['Cash', 'Gold', 'Quick'], b: ['Pawn', 'Exchange', '& Pawn'], verb: 'Go to the counter', icon: '⌖', color: '#ff8a5c', rob: [300, 900] },
  autobody: { a: ['Deco', 'Speed', 'Bay', 'Coral', 'Chrome'], b: ['Auto Body', 'Collision', 'Paint & Body', 'Garage'], verb: 'Pull in', icon: '⚙', color: '#4cc9f0', inCar: true },
  cardealer: { a: ['Sunstate', 'Palm', 'Gulf', 'Biscayne'], b: ['Motors', 'Auto Sales', 'Cars', 'Autos'], verb: 'Talk to a salesman', icon: 'C', color: '#4cc9f0' },
  bank: { a: ['Bay', 'Sun', 'Coral', 'First Coast'], b: ['Bank', 'Savings', 'Credit Union'], verb: 'Go to a teller', icon: '¤', color: '#80ed99', rob: [2500, 6000], heat: 3 },
  atm: { a: ['ATM'], b: [''], verb: 'Use the ATM', icon: '¤', color: '#80ed99' },
  hotel: { a: ['The Coral', 'Palmetto', 'Sea Glass', 'Sandpiper', 'Mangrove', 'Seagrape'], b: ['Hotel', 'Inn', 'Suites', 'Resort'], verb: 'Go to the front desk', icon: 'H', color: '#29e6ff' },
  motel: { a: ['Starlite', 'Sea Breeze', 'Tropic', 'Bay'], b: ['Motel', 'Motor Inn', 'Motor Lodge'], verb: 'Go to the office', icon: 'H', color: '#29e6ff' },
  gym: { a: ['Iron', 'Beach', 'Muscle', 'Pulse'], b: ['Gym', 'Fitness', 'Box'], verb: 'Work out', icon: 'G', color: '#9be564' },
  barber: { a: ['Fade', 'Clean Cut', 'Sharp', 'Royal'], b: ['Barbers', 'Cuts', 'Barbershop'], verb: 'Get a haircut', icon: '✂', color: '#c77dff' },
  salon: { a: ['Glow', 'Luxe', 'Bella', 'Coral'], b: ['Salon', 'Beauty', 'Studio'], verb: 'Get your hair done', icon: '✂', color: '#c77dff' },
  tattoo: { a: ['Ink', 'Needle', 'Black Pearl', 'Anchor'], b: ['Tattoo', 'Studio', 'Ink'], verb: 'Get tattooed', icon: '✎', color: '#c77dff' },
  cinema: { a: ['Bay', 'Sun', 'Coral', 'Deco'], b: ['Cinema', 'Theater', 'Movies'], verb: 'Buy a ticket', icon: '▶', color: '#c8a27a' },
  police: { a: ['Police'], b: ['Substation'], verb: 'Go to the front desk', icon: '⛨', color: '#6ea0ff' },
  safehouse: { a: ['Your apartment'], b: [''], verb: 'Go home', icon: '⌂', color: '#29e6ff' },
};

const STAFF = ['Raj', 'Dee', 'Ines', 'Hector', 'Marisol', 'Tony', 'Yesenia', 'Andre', 'Lupe', 'Malik', 'Carla', 'Javi', 'Nadia', 'Omar', 'Rosa', 'Kev'];
const GREET = {
  any: ['Hey, how you doing.', 'What can I get you?', 'Welcome in.', 'Hi! Let me know if you need anything.', 'Yeah?'],
  wanted: ['You\'re making me nervous. Make it quick.', 'I heard the sirens. Whatever it is, not in here.'],
  robbed: ['You again?! I already called the cops once!', 'Please. Not again.'],
  night: ['Long night, huh?', 'We\'re closing soon.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const CAR_PRICES = { kestrel: 9000, sprite: 14000, tarpon: 22000, pickup: 16000, ironhorse: 28000 };
const HAIR = [['Short and neat', 'short'], ['Grown out', 'long'], ['Tied up', 'bun'], ['Shaved', 'bald']];
const HAIR_COLORS = [['Black', 0x111111], ['Dark brown', 0x2e1f14], ['Bleached', 0xe6d3a3], ['Copper', 0x9a4a1e], ['Pink', 0xe85d9b], ['Teal', 0x2bb8c9]];

export class RealShops {
  constructor(game) {
    this.game = game;
    this.shops = new Map(); // key → shop
    this.openShop = null;
    this.staff = {}; // (other code looks for staff by id: nobody stands behind these counters)
    this.inBay = false;
    this.scanT = 0;
    this.near = [];
    const S = REAL_SAFEHOUSE;
    this.add({ key: 'safehouse', type: 'safehouse', x: S.door.x, z: S.door.z, door: { ...S.door }, name: 'Your apartment', street: 'Ocean Drive' });
  }

  get world() { return this.game.world; }

  add(s) {
    const T = TYPES[s.type];
    s.def = { title: s.name, staff: s.type === 'safehouse' || s.type === 'atm' ? '' : STAFF[hash(s.key + 'staff') % STAFF.length] };
    s.icon = T.icon; s.color = T.color;
    this.shops.set(s.key, s);
    return s;
  }

  /** Find the businesses in the streamed tiles around you. */
  scan(px, pz) {
    const w = this.world, kinds = w.index.stores;
    for (const rec of w.tiles.values()) {
      if (Math.abs(rec.cx - px) > 700 || Math.abs(rec.cz - pz) > 700) continue;
      for (const p of rec.places) {
        const type = GROUP[kinds[p.kind]];
        if (!type) continue;
        const key = 'p' + p.key;
        if (this.shops.has(key)) continue;
        // the data often lists the same business twice a few metres apart
        let dup = false;
        for (const s of this.shops.values()) if (s.type === type && Math.abs(s.x - p.x) < 8 && Math.abs(s.z - p.z) < 8) { dup = true; break; }
        if (dup) continue;
        const h = hash(key), T = TYPES[type];
        const name = type === 'atm' || type === 'police' ? `${T.a[0]} ${T.b[0]}`.trim() : `${T.a[h % T.a.length]} ${T.b[(h >>> 8) % T.b.length]}`;
        this.add({ key, type, x: p.x, z: p.z, door: null, name, street: null });
      }
    }
    // forget the far ones
    for (const [k, s] of this.shops) if (k !== 'safehouse' && Math.hypot(s.x - px, s.z - pz) > 1500) this.shops.delete(k);
  }

  /** Where to stand: the business point is usually inside its building; walk out toward the street. */
  doorFor(s) {
    const w = this.world;
    if (w.rasterAt(s.x, s.z) < 0) return null; // tile not built yet
    if (w.rasterAt(s.x, s.z) !== SURF.building) return { x: s.x, z: s.z };
    const dirs = [];
    const q = w.roads?.nearest(s.x, s.z, null, 90);
    if (q && q.d > 0.5) dirs.push([(q.x - s.x) / q.d, (q.z - s.z) / q.d, 0.7]);
    for (let a = 0; a < 8; a++) dirs.push([Math.cos(a * Math.PI / 4), Math.sin(a * Math.PI / 4), 1]);
    let best = null;
    for (const [dx, dz, k] of dirs) {
      for (let t = 1; t < 45; t += 1) {
        const x = s.x + dx * t, z = s.z + dz * t;
        const c = w.rasterAt(x, z);
        if (c === SURF.building || c < 0) continue;
        if (c === SURF.water) break;
        const ox = x + dx * 1.2, oz = z + dz * 1.2;
        const score = t * k;
        if (!best || score < best.score) best = { x: ox, z: oz, score, street: q?.e?.name || null };
        break;
      }
    }
    return best;
  }

  step(dt) {
    const g = this.game, p = g.player, pp = p.vehicle ? p.vehicle.pos : p.pos;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      if ((this.scanN = (this.scanN || 0) + 1) % 4 === 1) this.scan(pp.x, pp.z);
      // doors for the shops close by, the interactables for the closest, the map blips
      const near = [];
      for (const s of this.shops.values()) {
        const d = Math.hypot(s.x - pp.x, s.z - pp.z);
        if (d > 450) continue;
        if (!s.door && d < 180) { const dd = this.doorFor(s); if (dd) { s.door = { x: dd.x, z: dd.z }; s.street = s.street || dd.street; } }
        near.push([d, s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      this.near = near.map(([, s]) => s);
      g.interactables = g.interactables.filter((it) => !it.shop);
      for (const s of this.near.slice(0, 40)) {
        if (!s.door || TYPES[s.type].inCar) continue;
        g.interactables.push({ shop: s, id: 'shop:' + s.key, x: s.door.x, z: s.door.z, radius: 2.6, label: () => (this.openShop ? null : `${s.name}: ${TYPES[s.type].verb}`), onInteract: () => this.open(s) });
      }
      const fixed = (g.blips || []).filter((b) => !b.shop);
      const shown = this.near.filter((s) => s.door && s.type !== 'atm').slice(0, 28);
      g.blips = [...fixed, ...shown.map((s) => ({ shop: s, x: s.door.x, z: s.door.z, glyph: s.icon, color: s.color, size: s.type === 'safehouse' ? 24 : 18, edge: s.type === 'safehouse', label: s.name }))];
    }
    // drinks wear off
    if (g.club && g.club.tipsy > 0) g.club.tipsy = Math.max(0, g.club.tipsy - dt * 0.008);
    // driving into an auto body shop's lot
    const v = p.vehicle;
    this.inBay = false;
    if (v && p.seat === 0 && !this.openShop && v.speed < 1.5) {
      for (const s of this.near) {
        if (s.type !== 'autobody' || !s.door) continue;
        if (Math.hypot(s.door.x - v.pos.x, s.door.z - v.pos.z) > 12) break;
        this.inBay = true;
        p.controller.prompt = { key: 'interact', text: `${s.name}: repair / respray` };
        if (g.input.pressed('interact')) this.open(s);
        break;
      }
    }
    // the alarm after a robbery
    if (this.alarm) {
      this.alarm.t -= dt;
      if (this.alarm.t <= 0) {
        const a = this.alarm; this.alarm = null;
        g.wanted.report('robbery', a.x, a.z, 'alarm');
        if (a.heat && g.wanted.level < a.heat) { g.wanted.level = a.heat; g.events.emit('wantedLevel', { level: a.heat, before: a.heat - 1 }); }
      }
    }
    if (!this.openShop) return;
    const o = this.openShop;
    for (let i = 1; i <= 8; i++) if (g.input.edges.has('Digit' + i) || g.input.edges.has('Numpad' + i) || g.input.virtual.edges.has('shop' + i)) this.buy(i - 1);
    if (g.input.pressed('interact') && o.t > 0) this.close();
    o.t += dt;
    const s = o.shop;
    if (p.dead || (s.door && Math.hypot(s.door.x - pp.x, s.door.z - pp.z) > 14)) this.close();
  }

  open(s) {
    const g = this.game, p = g.player;
    const T = TYPES[s.type];
    if (s.closedUntil && g.time < s.closedUntil) { g.hud?.notify(`${s.name} is closed. There's police tape across the door.`, s.name, 'warn', 4); return; }
    if (g.wanted.level >= 2 && !['safehouse', 'autobody', 'atm', 'police'].includes(s.type) && p.controller.weapon?.melee !== false) { g.hud?.subtitle(s.def.staff || s.name, 'Doors are locked. Police are everywhere out there.', 3); return; }
    const h = g.engine.time.hour;
    const greeting = s.type === 'safehouse' ? 'Home. The AC rattles, the view is worth it.' : s.type === 'atm' ? 'The screen glows: INSERT CARD.'
      : s.robbedAt ? pick(GREET.robbed) : g.wanted.level > 0 ? pick(GREET.wanted) : (h > 22 || h < 5) && Math.random() < 0.5 ? pick(GREET.night) : pick(GREET.any);
    this.openShop = { id: s.key, shop: s, def: s.def, greeting, msg: '', t: 0 };
    p.controller.frozen = !T.inCar;
    if (s.def.staff) g.hud?.subtitle(s.def.staff, greeting, 3);
    g.audio?.ui('select');
  }

  close() {
    if (!this.openShop) return;
    this.openShop = null;
    this.game.player.controller.frozen = false;
    this.game.audio?.ui('switch');
  }

  /** The menu for the open shop: [{label, price, note?, owned?, disabled?, act()}] */
  items() {
    const o = this.openShop;
    if (!o) return [];
    const g = this.game, p = g.player, inv = p.controller.inventory, s = o.shop;
    const heal = (n) => () => { p.health = Math.min(100, p.health + n); };
    const pass = (hours) => { g.engine.time.hour = (g.engine.time.hour + hours) % 24; };
    const drink = (n) => () => { if (g.club) g.club.tipsy = Math.min(1, (g.club.tipsy || 0) + n); p.health = Math.min(100, p.health + 3); };
    const out = [];
    switch (s.type) {
      case 'mart':
      case 'gas':
        out.push(
          { label: 'Snacks', price: 8, note: '+25 health', act: heal(25) },
          { label: 'Café con leche', price: 4, note: '+10 health', act: heal(10) },
          { label: 'Energy drink', price: 5, note: '+15 health', act: heal(15) },
          { label: 'Scratch ticket', price: 10, act: () => this.scratch() },
        );
        break;
      case 'grocery':
        out.push({ label: 'Groceries', price: 25, note: '+50 health', act: heal(50) }, { label: 'Fruit and water', price: 6, note: '+15 health', act: heal(15) }, { label: 'Scratch ticket', price: 10, act: () => this.scratch() });
        break;
      case 'food':
        out.push({ label: 'Dinner for one', price: 38, note: 'full health', act: heal(100) }, { label: 'Ceviche', price: 18, note: '+45 health', act: heal(45) }, { label: 'Mojito', price: 14, note: 'goes straight to your head', act: drink(0.2) });
        break;
      case 'fastfood':
        out.push({ label: 'Combo meal', price: 11, note: '+45 health', act: heal(45) }, { label: 'Croquetas', price: 6, note: '+20 health', act: heal(20) }, { label: 'Soda', price: 3, note: '+5 health', act: heal(5) });
        break;
      case 'cafe':
        out.push({ label: 'Café cubano', price: 3, note: '+10 health', act: heal(10) }, { label: 'Cuban sandwich', price: 12, note: '+40 health', act: heal(40) }, { label: 'Pastelito', price: 3, note: '+10 health', act: heal(10) });
        break;
      case 'bar':
        out.push({ label: 'Beer', price: 7, act: drink(0.12) }, { label: 'Mojito', price: 14, act: drink(0.2) }, { label: 'Shot of rum', price: 9, act: drink(0.25) }, { label: 'Round for the bar', price: 120, act: () => { drink(0.2)(); o.msg = 'The whole bar raises a glass to you.'; } });
        break;
      case 'casino':
        out.push({ label: 'Blackjack hand', price: 100, act: () => { if (Math.random() < 0.46) { g.economy.add(200, 'Blackjack'); o.msg = 'Twenty-one. You win $200.'; } else o.msg = 'Dealer has nineteen. House wins.'; } },
          { label: 'Slots', price: 20, act: () => { const r = Math.random(); const win = r < 0.01 ? 2000 : r < 0.12 ? 60 : 0; if (win) { g.economy.add(win, 'Slots'); o.msg = win >= 2000 ? 'JACKPOT! $2,000!' : 'Three cherries: $60.'; } else o.msg = 'Nothing.'; } });
        break;
      case 'clothes':
        for (const f of OUTFITS[p.protagonist]) {
          out.push({ label: f.name, price: 80, owned: p.look.top === f.top && p.look.bottom === f.bottom, act: () => this.wear(f) });
        }
        break;
      case 'jewelry':
        out.push({ label: 'Gold chain', price: 900, note: 'turns heads on LOOP', act: () => { g.social?.post({ local: true, text: `just saw someone drop $900 on a gold chain at ${s.name} like it was nothing`, likes: 12, about: true }); } },
          { label: 'Watch', price: 2400, act: () => { o.msg = 'It ticks louder than it should.'; } });
        break;
      case 'phone':
        out.push({ label: 'New flagship phone', price: 700, note: 'better LOOP camera', owned: g.memory.state.phone === 'flagship', act: () => { g.memory.state.phone = 'flagship'; o.msg = 'Shiny. Your LOOP clips look better already.'; } },
          { label: 'Prepaid burner', price: 40, owned: !!g.memory.state.burner, act: () => { g.memory.state.burner = true; o.msg = 'A number nobody knows.'; } },
          { label: 'Phone case', price: 25, act: () => { o.msg = 'Palm-leaf print. Very Miami.'; } });
        break;
      case 'pharmacy':
        out.push({ label: 'First aid kit', price: 30, note: '+60 health', act: heal(60) }, { label: 'Painkillers', price: 10, note: '+25 health', act: heal(25) }, { label: 'Sunscreen', price: 9, act: () => { o.msg = 'SPF 50. Smart.'; } });
        break;
      case 'clinic':
        out.push({ label: 'Get patched up', price: 120, note: 'full health', disabled: p.health >= 100, act: heal(100) });
        break;
      case 'guns':
      case 'pawn': {
        if (g.wanted.level > 0) { o.msg = 'Not with cops on your tail. Come back clean.'; break; }
        out.push({ label: 'Pistol ammo ×48', price: 60, act: () => p.controller.giveWeapon('pistol', 48) },
          { label: 'Body armour', price: 200, note: `armour ${Math.round(p.armor)}%`, disabled: p.armor >= 100, act: () => { p.armor = 100; } });
        if (s.type === 'guns') out.push(inv.weapons.includes('smg') ? { label: 'Vela Viper ammo ×90', price: 90, act: () => p.controller.giveWeapon('smg', 90) } : { label: 'Vela Viper SMG (+90 rounds)', price: 1500, act: () => p.controller.giveWeapon('smg', 90) });
        break;
      }
      case 'autobody': {
        const v = p.vehicle;
        if (!v) { o.msg = 'Bring the car in, then we talk.'; break; }
        if (v.police || v.modelId === 'police' || v.policeUnit) { o.msg = 'A police car? Absolutely not.'; break; }
        const repair = Math.max(40, Math.round((1000 - v.health) * 0.6));
        out.push({ label: 'Repair', price: v.health >= 999 ? 0 : repair, note: `${Math.round(v.health / 10)}% condition`, disabled: v.health >= 999, act: () => { v.health = 1000; v.smoking = false; } },
          { label: 'Respray + new plates', price: 300, note: g.wanted.level > 0 ? 'loses the police if they can\'t see you' : 'the police won\'t know the car', act: () => this.respray(v) });
        break;
      }
      case 'cardealer':
        for (const [id, price] of Object.entries(CAR_PRICES)) if (VEHICLES[id]) out.push({ label: `${VEHICLES[id].name} (${VEHICLES[id].class})`, price, act: () => this.buyCar(s, id) });
        break;
      case 'bank':
      case 'atm':
        out.push({ label: 'Check your balance', price: 0, act: () => { o.msg = `Balance: $${g.economy.money.toLocaleString()}.`; } });
        break;
      case 'hotel':
      case 'motel': {
        const price = s.type === 'hotel' ? 160 : 55;
        out.push({ label: 'Rent a room for the night', price, note: 'sleep 8 h, save', act: () => { pass(8); p.health = 100; g.saveGame('hotel'); o.msg = 'You sleep like a stone. Game saved.'; } });
        break;
      }
      case 'gym':
        out.push({ label: 'Work out', price: 15, note: '+20 health, 1 h', act: () => { pass(1); p.health = Math.min(100, p.health + 20); } });
        break;
      case 'barber':
      case 'salon':
        for (const [n, st] of HAIR) out.push({ label: n, price: s.type === 'salon' ? 60 : 25, owned: p.look.hairStyle === st, act: () => this.restyle({ hairStyle: st }) });
        if (s.type === 'salon') for (const [n, c] of HAIR_COLORS.slice(0, 4)) out.push({ label: `Colour: ${n}`, price: 90, owned: p.look.hair === c, act: () => this.restyle({ hair: c }) });
        break;
      case 'tattoo':
        out.push({ label: 'Small tattoo', price: 150, act: () => { o.msg = 'A palm tree on your ankle. Hurts like hell.'; } }, { label: 'Full sleeve', price: 1200, act: () => { pass(4); o.msg = 'Four hours later: a whole reef down your arm.'; } });
        break;
      case 'cinema':
        out.push({ label: 'Watch a movie', price: 14, note: '2 h pass', act: () => { pass(2); o.msg = 'Car chases and explosions. Very realistic.'; } });
        break;
      case 'police':
        if (g.wanted.level > 0 && g.wanted.level <= 2) out.push({ label: 'Pay your fines', price: 400 * g.wanted.level, note: 'clears your wanted level', act: () => { g.wanted.clear(); o.msg = 'The officer takes the money and looks the other way.'; } });
        else out.push({ label: 'Report a crime', price: 0, act: () => { o.msg = 'They give you a form. It\'s nine pages long.'; } });
        break;
      case 'safehouse':
        out.push({ label: 'Save the game', price: 0, act: () => { g.saveGame('safehouse'); o.msg = 'Game saved.'; } },
          { label: 'Sleep 8 hours', price: 0, note: 'full health, save', act: () => { pass(8); p.health = 100; if (g.club) g.club.tipsy = 0; g.saveGame('safehouse'); o.msg = 'You wake up rested. Game saved.'; } });
        for (const f of OUTFITS[p.protagonist].slice(0, 3)) out.push({ label: `Wardrobe: ${f.name}`, price: 0, owned: p.look.top === f.top && p.look.bottom === f.bottom, act: () => this.wear(f) });
        break;
      default: break;
    }
    // holding a gun at a till
    const T = TYPES[s.type];
    if (T.rob && !p.controller.weapon?.melee && !p.vehicle) {
      const ok = !s.robbedAt || g.time - s.robbedAt > 600;
      out.push({ label: ok ? 'Point the gun: empty the register' : 'The register is still empty', price: 0, note: 'a crime: the alarm will call it in', disabled: !ok, act: () => this.rob(s) });
    }
    return out.slice(0, 8);
  }

  buy(i) {
    const g = this.game, o = this.openShop, it = this.items()[i];
    if (!o || !it || it.disabled || it.owned) return false;
    if (g.economy.money < it.price) { o.msg = 'You can\'t afford that.'; g.audio?.ui('empty'); return false; }
    if (it.price > 0) g.economy.take(it.price, `${o.shop.name}: ${it.label}`);
    o.msg = '';
    it.act();
    if (!o.msg) o.msg = `${it.label}: done.`;
    g.audio?.ui('select');
    g.events.emit('purchase', { shop: o.shop.type, item: it.label, price: it.price });
    return true;
  }

  scratch() {
    const g = this.game, o = this.openShop;
    const r = Math.random();
    const win = r < 0.05 ? 500 : r < 0.3 ? 20 + Math.floor(Math.random() * 5) * 10 : 0;
    if (win) { g.economy.add(win, 'Scratch ticket'); o.msg = `Winner! $${win}.`; } else o.msg = 'Nothing.';
  }

  wear(f) {
    const g = this.game, p = g.player;
    const before = g.memory.matchScore();
    p.setLook({ ...p.look, top: f.top, bottom: f.bottom, sleeveless: !!f.sleeveless, shorts: !!f.shorts });
    if (before > 0 && g.memory.matchScore() === 0) g.hud?.notify('You no longer match the description the police have.', this.openShop?.shop.name || '', '', 5);
  }

  restyle(change) {
    const g = this.game, p = g.player;
    const before = g.memory.matchScore();
    p.setLook({ ...p.look, ...change });
    if (before > 0 && g.memory.matchScore() === 0) g.hud?.notify('You no longer match the description the police have.', this.openShop?.shop.name || '', '', 5);
  }

  rob(s) {
    const g = this.game, o = this.openShop, T = TYPES[s.type];
    const take = Math.round(rand(T.rob[0], T.rob[1]) / 10) * 10;
    g.economy.add(take, `Robbery: ${s.name}`);
    s.robbedAt = g.time;
    o.msg = `${s.def.staff || 'The clerk'} empties the register with shaking hands: $${take.toLocaleString()}. Run.`;
    g.stats.robberies = (g.stats.robberies || 0) + 1;
    g.events.emit('storeRobbed', { shop: s, take });
    // the silent alarm calls it in a few seconds later
    this.alarm = { t: rand(3, 6), x: s.door?.x ?? s.x, z: s.door?.z ?? s.z, heat: T.heat || 0 };
    g.peds_?.witness?.('robbery', s.x, s.z, g.player, null);
    setTimeout(() => { if (this.openShop?.shop === s) this.close(); }, 1200);
  }

  respray(v) {
    const g = this.game;
    const choices = v.def.colors.filter((c) => c !== v.color);
    v.color = choices.length ? choices[Math.floor(Math.random() * choices.length)] : 0x2f2f33;
    v.mesh.parts.paint.color.setHex(v.color);
    v.setPlate(randomPlate());
    v.health = Math.max(v.health, 700);
    const desc = g.memory.state.description;
    if (desc?.vehicle && desc.vehicle.id === (v.persistentId || v.id)) desc.vehicle = null;
    if (g.wanted.level > 0 && g.wanted.level <= 3 && !g.police.canSeePlayer()) { g.wanted.clear(); g.hud?.notify('New paint, new plates. The police lost track of the car.', this.openShop?.shop.name || '', '', 5); }
  }

  /** A new car, parked at the kerb out front. */
  buyCar(s, model) {
    const g = this.game, w = this.world, o = this.openShop;
    const d = s.door || s;
    const q = w.roads?.nearest(d.x, d.z, (e) => e.cls >= 2 && e.cls <= 8 && e.lvl === 0, 120);
    let x = d.x + 3, z = d.z, yaw = 0;
    if (q) {
      const p = q.e.pts, i = q.seg * 2;
      const tx = p[i + 2] - p[i], tz = p[i + 3] - p[i + 1], l = Math.hypot(tx, tz) || 1;
      // the kerb on the shop's side of the street
      const side = ((d.x - q.x) * -tz + (d.z - q.z) * tx) > 0 ? 1 : -1;
      const off = q.e.w / 2 - 1.3;
      x = q.x - (tz / l) * off * side; z = q.z + (tx / l) * off * side;
      yaw = Math.atan2(tx * side, tz * side);
    }
    const v = g.addVehicle(model, x, z, yaw);
    v.owner = 'player'; v.persistentId = 'bought-' + model + '-' + Math.round(g.time);
    g.hud?.notify(`Your new ${v.def.name} is parked out front.`, s.name, '', 5);
    if (o) o.msg = 'Keys are in it. Pleasure doing business.';
  }
}

export { TYPES as SHOP_TYPES };
