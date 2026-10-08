// HUD and the Benton Park App: top bar, toasts, land banners, ride and
// venue prompts, the queue pill, food hotbar, show captions, the tabbed
// app panel (waits, map, shows, dining, shops, passport, bag), shop
// windows and the settings sheet.
import * as Clock from './clock.js';
import { waitColor } from './world.js';

const $ = (sel, root = document) => root.querySelector(sel);
const css = (n) => `#${n.toString(16).padStart(6, '0')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const TABS = [
  { id: 'Waits', icon: '⏱', label: 'Wait Times' },
  { id: 'Map', icon: '🗺', label: 'Park Map' },
  { id: 'Shows', icon: '🎭', label: 'Shows' },
  { id: 'Dining', icon: '🍔', label: 'Dining' },
  { id: 'Shops', icon: '🛍', label: 'Shops' },
  { id: 'Passport', icon: '📘', label: 'Passport' },
  { id: 'Bag', icon: '🎒', label: 'My Bag' },
];

const SHIRTS = [0x1e6ee6, 0xc42828, 0xff8c1a, 0x2e9e52, 0x7a3fc4, 0xf0c040, 0x222831, 0xf5f5f0];
const PANTS = [0x283c6e, 0x2b2b30, 0x5a4632, 0x3a6ea5, 0x6e6e74, 0x8a2a2a];
const SKINS = [0xffcc99, 0xe8b07c, 0xc68a5a, 0x8d5a3b, 0x5c3a24, 0xf2d0b8];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export class UI {
  constructor(game) {
    this.g = game;
    this.cfg = game.data.config;
    this.items = new Map(this.cfg.Items.map((i) => [i.id, i]));
    this.lands = new Map(this.cfg.Lands.map((l) => [l.id, l]));
    this.tab = null;
    this.live = [];
    this.sortWaits = false;
    this.currentLand = null;
    this.prompt = null;
    this.venueOpen = null;
    this.toastQueue = [];
    this.root = $('#hud');
    this.buildDock();
    this.buildFood();
    $('#panel .close').addEventListener('click', () => this.open(null));
    $('#pill button').addEventListener('click', () => this.g.sim.leave());
    $('#guide-chip button').addEventListener('click', () => this.g.guide.clear());
    $('#menu-btn').addEventListener('click', () => this.openSettings());
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    const jump = $('#jump-btn');
    jump.addEventListener('touchstart', (e) => { this.g.input.jumpPressed = true; e.preventDefault(); }, { passive: false });
    jump.addEventListener('mousedown', () => { this.g.input.jumpPressed = true; });
    this.clockEl = $('#clock');
    this.bucksEl = $('#bucks');
    this.passesEl = $('#passes');
    this.hungerEl = $('#hunger-fill');
    this.hungerChip = $('#hunger');
    this.boostEl = $('#boost');
    this.lastTick = 0;
  }

  // -------------------------------------------------------------- toasts
  toast(text, kind = 'info', amount) {
    const box = $('#toasts');
    const el = h('div', { class: `toast ${kind}` },
      kind === 'reward' && amount ? h('b', {}, `+${this.cfg.CurrencyShort}${amount}`) : null,
      h('span', {}, text));
    box.append(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4700);
  }

  banner(title, sub, color) {
    const b = $('#banner');
    $('.title', b).textContent = title;
    $('.sub', b).textContent = sub;
    b.style.setProperty('--land', css(color));
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  // ---------------------------------------------------------------- dock
  buildDock() {
    const dock = $('#dock');
    for (const t of TABS) {
      dock.append(h('button', { class: 'tab', 'data-tab': t.id, title: t.label, onclick: () => this.open(this.tab === t.id ? null : t.id) },
        h('span', { class: 'ico' }, t.icon), h('span', { class: 'lbl' }, t.label)));
    }
  }

  open(tab) {
    this.tab = tab;
    this.live = [];
    for (const b of document.querySelectorAll('#dock .tab')) b.classList.toggle('on', b.dataset.tab === tab);
    const panel = $('#panel');
    document.body.classList.toggle('panel-open', !!tab);
    if (!tab) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const def = TABS.find((t) => t.id === tab);
    $('#panel h2').textContent = `${def.icon} ${def.label}`;
    const content = $('#panel .content');
    content.replaceChildren();
    content.scrollTop = 0;
    this[`render${tab}`](content);
    this.updateLive();
  }

  refresh() {
    if (this.tab) {
      const content = $('#panel .content');
      const top = content.scrollTop;
      this.open(this.tab);
      content.scrollTop = top;
    }
    if (this.venueOpen) this.renderVenueModal();
    this.renderFood();
  }

  updateLive() {
    for (const fn of this.live) fn();
  }

  guideButton(pos, name) {
    return h('button', { class: 'btn small guide', onclick: () => this.guideTo(pos, name) }, '📍 Guide');
  }

  guideTo(pos, name) {
    this.g.guide.set(pos, name);
    this.toast(`Directions to ${name} - follow the glowing arrows!`, 'info');
    if (window.innerWidth < 760) this.open(null);
  }

  card(title, subtitle, color, ...right) {
    return h('div', { class: 'card', style: `--accent:${css(color)}` },
      h('div', { class: 'card-main' }, h('div', { class: 'card-title' }, title), subtitle ? h('div', { class: 'card-sub' }, subtitle) : null),
      h('div', { class: 'card-right' }, ...right));
  }

  // ---------------------------------------------------------- wait times
  renderWaits(c) {
    const sim = this.g.sim;
    c.append(h('p', { class: 'note' }, 'Posted waits update live. One park minute is one real second, so a 20 min wait is about 20 seconds. Use an Express Pass to skip the line!'));
    c.append(h('div', { class: 'row' }, h('button', { class: 'btn ghost small', onclick: () => { this.sortWaits = !this.sortWaits; this.refresh(); } }, this.sortWaits ? 'Sort: shortest wait' : 'Sort: by land')));
    let rides = [...this.cfg.Rides];
    if (this.sortWaits) {
      const w = (r) => { const s = sim.rideState(r.id); return s.status === 'Closed' ? 999 : s.wait; };
      rides.sort((a, b) => w(a) - w(b));
    }
    let lastLand = '';
    for (const ride of rides) {
      const land = this.lands.get(ride.land);
      if (!this.sortWaits && ride.land !== lastLand) {
        lastLand = ride.land;
        c.append(h('h3', { style: `color:${css(land.color)}` }, land.name));
      }
      const wait = h('div', { class: 'wait' }, '--');
      c.append(this.card(ride.name, `${ride.category}  ${stars(ride.thrill)}  |  ${this.sortWaits ? land.name : ride.kind}`, land.color, wait, this.guideButton(ride.entrance, ride.name)));
      this.live.push(() => {
        const s = sim.rideState(ride.id);
        if (s.status === 'Closed') { wait.textContent = 'CLOSED'; wait.style.color = '#f04636'; }
        else { wait.textContent = `${s.wait} min`; wait.style.color = waitColor(s.wait); }
      });
    }
  }

  // ----------------------------------------------------------------- map
  renderMap(c) {
    const B = this.cfg.Bounds;
    const W = B.maxX - B.minX, H = B.maxZ - B.minZ;
    const px = (x) => `${((x - B.minX) / W) * 100}%`;
    const pz = (z) => `${((z - B.minZ) / H) * 100}%`;
    c.append(h('p', { class: 'note' }, 'Tap a ride, show, shop or restaurant to get directions.'));
    const map = h('div', { class: 'map', style: `aspect-ratio:${W}/${H}` });
    for (const land of this.cfg.Lands) {
      for (const r of land.regions) {
        map.append(h('div', { class: 'land', style: `left:${px(r[0])};top:${pz(r[1])};width:${((r[2] - r[0]) / W) * 100}%;height:${((r[3] - r[1]) / H) * 100}%;background:${css(land.color)}` }));
      }
    }
    map.append(h('div', { class: 'street', style: `left:${px(-26)};top:${pz(-4)};width:${(52 / W) * 100}%;height:${(230 / H) * 100}%` }));
    map.append(h('div', { class: 'hub', style: `left:${px(0)};top:${pz(-60)};width:${(124 / W) * 100}%;height:${(124 / H) * 100}%` }));
    map.append(h('div', { class: 'lake', style: `left:${px(235)};top:${pz(125)};width:${(100 / W) * 100}%;height:${(100 / H) * 100}%` }));
    for (const land of this.cfg.Lands) {
      map.append(h('div', { class: 'land-label', style: `left:${px(land.center[0])};top:${pz(land.center[2])}` }, land.name.toUpperCase()));
    }
    const pin = (pos, color, name, kind) => {
      map.append(h('button', { class: `pin ${kind}`, title: name, style: `left:${px(pos[0])};top:${pz(pos[2])};background:${color}`, onclick: () => this.guideTo(pos, name) }, h('span', {}, name)));
    };
    for (const ride of this.cfg.Rides) pin(ride.entrance, '#ff8c1a', ride.name, 'ride');
    for (const v of this.cfg.Venues) pin(v.position, v.kind === 'restaurant' ? '#e04040' : '#2e7de6', v.name, 'venue');
    for (const s of this.cfg.Shows) if (s.id === 'BigDreams' || s.id === 'StuntSpectacular') pin(s.viewing, '#be82ff', s.venue, 'show');
    const me = h('div', { class: 'me' });
    map.append(me);
    c.append(map);
    c.append(h('div', { class: 'legend' },
      ...[['Rides', '#ff8c1a'], ['Food', '#e04040'], ['Shops', '#2e7de6'], ['Shows', '#be82ff'], ['You', '#ffffff']].map(([n, col]) => h('span', {}, h('i', { style: `background:${col}` }), n))));
    this.live.push(() => {
      const p = this.g.player.pos;
      me.style.left = px(Math.min(B.maxX, Math.max(B.minX, p.x)));
      me.style.top = pz(Math.min(B.maxZ, Math.max(B.minZ, p.z)));
      me.style.transform = `translate(-50%,-50%) rotate(${-this.g.player.yaw}rad)`;
    });
  }

  // --------------------------------------------------------------- shows
  renderShows(c) {
    const sim = this.g.sim;
    c.append(h('p', { class: 'note' }, `Watch a show from the audience area to earn ${this.cfg.Economy.ShowReward} ${this.cfg.Currency}.`));
    for (const show of sim.shows) {
      const land = this.lands.get(show.land);
      const status = h('div', { class: 'status' });
      const skip = h('button', { class: 'btn small ghost', onclick: () => this.g.skipTo(show) }, '⏩ Skip to showtime');
      c.append(this.card(show.name, show.venue, land.color, status, this.guideButton(show.viewing, show.name)));
      c.append(h('p', { class: 'show-desc' }, show.description));
      c.append(h('div', { class: 'times' }, h('span', {}, `Showtimes: ${show.times.map((t) => Clock.format(t)).join(', ')}`), skip));
      this.live.push(() => {
        const s = sim.showStatus(show);
        status.textContent = s.text;
        status.style.color = s.now ? '#5adc6e' : '#f0c040';
        skip.hidden = s.now || s.seconds < 8 || !!sim.ridingRide;
      });
    }
  }

  // ------------------------------------------------------ dining & shops
  itemLine(item) {
    let extra = '';
    if (item.kind === 'food') {
      extra = `+${item.hunger ?? 0} hunger`;
      if (item.buff) extra += item.buff.kind === 'speed' ? ' · SPEED BOOST' : ' · JUMP BOOST';
    } else if (this.g.sim.owns(item.id)) extra = 'OWNED';
    return h('div', { class: 'item-line' }, h('span', {}, item.name), h('span', { class: 'muted' }, extra), h('b', {}, `${this.cfg.CurrencyShort}${item.price}`));
  }

  venueFront(v) {
    const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[v.facing];
    const d = v.size[2] / 2;
    return {
      counter: [v.position[0] + f[0] * (d - 3), 0, v.position[2] + f[1] * (d - 3)],
      front: [v.position[0] + f[0] * (d + 6), 0, v.position[2] + f[1] * (d + 6)],
    };
  }

  renderVenues(c, kind) {
    c.append(h('p', { class: 'note' }, kind === 'restaurant'
      ? 'Hungry guests walk slower. Eat at any restaurant to fill up - some treats give speed or jump boosts!'
      : 'Souvenirs are saved to your Bag. Wear hats, shades and balloons, and carry toys around the park.'));
    for (const v of this.cfg.Venues) {
      if (v.kind !== kind) continue;
      const land = this.lands.get(v.land);
      c.append(this.card(v.name, `${land.name}  |  ${v.description}`, land.color, this.guideButton(this.venueFront(v).front, v.name)));
      const list = h('div', { class: 'item-list' });
      for (const id of v.items) list.append(this.itemLine(this.items.get(id)));
      c.append(list);
    }
  }

  renderDining(c) { this.renderVenues(c, 'restaurant'); }
  renderShops(c) { this.renderVenues(c, 'shop'); }

  // ------------------------------------------------------------ passport
  renderPassport(c) {
    const p = this.g.sim.profile;
    const stamped = this.cfg.Rides.filter((r) => p.stamps.includes(r.id)).length;
    c.append(h('h3', {}, `Park Passport  ${stamped} / ${this.cfg.Rides.length}`));
    c.append(h('p', { class: 'note' }, `Ride every attraction to collect its stamp (+${this.cfg.Economy.FirstRideBonus} bonus). Finish a whole land for +${this.cfg.Economy.LandCompleteBonus}!`));
    const grid = h('div', { class: 'stamps' });
    for (const ride of this.cfg.Rides) {
      const land = this.lands.get(ride.land);
      const has = p.stamps.includes(ride.id);
      grid.append(h('div', { class: `stamp ${has ? 'has' : ''}`, style: `--accent:${css(land.color)}` },
        h('b', {}, `${has ? '✔ ' : ''}${ride.name}`), h('small', {}, land.name)));
    }
    c.append(grid);
    c.append(h('h3', {}, 'Your day so far'));
    c.append(h('p', { class: 'note' }, `Rides taken: ${p.stats.rides}   |   Shows watched: ${p.stats.shows}   |   Meals eaten: ${p.stats.meals}`));
  }

  // ----------------------------------------------------------------- bag
  renderBag(c) {
    const sim = this.g.sim;
    const p = sim.profile;
    c.append(h('h3', {}, `${this.cfg.CurrencyShort}${p.bucks}   |   Express Passes: ${p.passes}`));
    c.append(h('p', { class: 'note' }, 'Earn Benton Bucks by riding rides, watching shows and spending time in the park.'));
    const slots = [['hat', 'Hats'], ['face', 'Shades'], ['balloon', 'Balloons'], ['held', 'Toys & tools']];
    for (const [slot, title] of slots) {
      c.append(h('h4', {}, title));
      const owned = p.owned.map((id) => this.items.get(id)).filter((i) => i && i.kind === slot);
      if (!owned.length) c.append(h('p', { class: 'note' }, 'None yet - check the shops!'));
      for (const item of owned) {
        const on = p.equipped[slot] === item.id;
        c.append(this.card(item.name, item.description, item.colors[0],
          h('button', { class: `btn small ${on ? 'ghost' : ''}`, onclick: () => { sim.equip(slot, on ? '' : item.id); this.g.applyWear(); this.refresh(); } }, on ? (slot === 'held' ? 'Put away' : 'Take off') : (slot === 'held' ? 'Hold' : 'Wear'))));
      }
    }
    c.append(h('h4', {}, 'Food in hand'));
    if (!sim.food.length) c.append(h('p', { class: 'note' }, 'Nothing - grab a bite at a restaurant.'));
    sim.food.forEach((f, i) => {
      const item = this.items.get(f.id);
      c.append(this.card(item.name, `${f.bites} bite${f.bites === 1 ? '' : 's'} left`, item.colors[0], h('button', { class: 'btn small', onclick: () => { sim.eat(i); this.refresh(); } }, 'Take a bite')));
    });
    c.append(h('h4', {}, 'Outfit'));
    c.append(this.outfitPicker(() => this.g.applyLook()));
  }

  outfitPicker(onChange) {
    const look = this.g.sim.profile.look;
    const row = (label, key, colors) => h('div', { class: 'swatches' }, h('span', {}, label),
      ...colors.map((col) => h('button', {
        class: `swatch ${look[key] === col || (key === 'skin' && look.skin === 0 && col === colors[0]) ? 'on' : ''}`,
        style: `background:${css(col)}`,
        'aria-label': `${label} ${css(col)}`,
        onclick: (e) => {
          look[key] = col;
          for (const b of e.currentTarget.parentNode.querySelectorAll('.swatch')) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.g.sim.save();
          onChange();
        },
      })));
    return h('div', { class: 'outfit' }, row('Shirt', 'shirt', SHIRTS), row('Pants', 'pants', PANTS), row('Skin', 'skin', SKINS));
  }

  // -------------------------------------------------------- venue window
  openVenue(id) {
    this.venueOpen = id;
    this.renderVenueModal();
    $('#modal').hidden = false;
  }

  closeModal() {
    this.venueOpen = null;
    $('#modal').hidden = true;
  }

  renderVenueModal() {
    const box = $('#modal .sheet');
    box.replaceChildren();
    if (this.venueOpen === 'settings') return this.renderSettings(box);
    const v = this.cfg.Venues.find((x) => x.id === this.venueOpen);
    const sim = this.g.sim;
    const land = this.lands.get(v.land);
    box.style.setProperty('--accent', css(land.color));
    box.append(h('header', {},
      h('div', {}, h('h2', {}, v.name), h('p', {}, v.description)),
      h('div', { class: 'wallet' }, `${this.cfg.CurrencyShort}${sim.profile.bucks}`),
      h('button', { class: 'close', 'aria-label': 'Close', onclick: () => this.closeModal() }, '✕')));
    const grid = h('div', { class: 'goods' });
    for (const id of v.items) {
      const item = this.items.get(id);
      const wearable = ['hat', 'face', 'balloon', 'held'].includes(item.kind);
      const owned = wearable && sim.owns(id);
      const equipped = owned && sim.profile.equipped[item.kind] === id;
      let tag = '';
      if (item.kind === 'food') tag = `+${item.hunger} hunger${item.buff ? (item.buff.kind === 'speed' ? ' · ⚡ speed' : ' · 🦘 jump') : ''}`;
      else if (item.kind === 'pass') tag = `You have ${sim.profile.passes}`;
      const img = h('img', { alt: '', src: this.g.thumbs.get(id) || '' });
      const btn = owned
        ? h('button', { class: `btn small ${equipped ? 'ghost' : ''}`, onclick: () => { sim.equip(item.kind, equipped ? '' : id); this.g.applyWear(); this.renderVenueModal(); } }, equipped ? 'Take off' : 'Wear')
        : h('button', { class: 'btn small', disabled: sim.profile.bucks < item.price ? true : undefined, onclick: () => { if (sim.buy(v.id, id)) { this.g.applyWear(); this.refresh(); } } }, `Buy ${this.cfg.CurrencyShort}${item.price}`);
      grid.append(h('div', { class: 'good' }, h('div', { class: 'thumb', style: `background:${css(item.colors[0])}22` }, img),
        h('b', {}, item.name), h('small', {}, item.description), tag ? h('em', {}, tag) : null, owned ? h('em', { class: 'owned' }, equipped ? 'Wearing' : 'Owned') : null, btn));
    }
    box.append(grid);
  }

  // ------------------------------------------------------------ settings
  openSettings() {
    this.venueOpen = 'settings';
    this.renderVenueModal();
    $('#modal').hidden = false;
  }

  renderSettings(box) {
    const g = this.g;
    box.style.setProperty('--accent', '#ff8c1a');
    box.append(h('header', {}, h('div', {}, h('h2', {}, 'Settings'), h('p', {}, 'Benton Diesel World - browser edition')),
      h('button', { class: 'close', 'aria-label': 'Close', onclick: () => this.closeModal() }, '✕')));
    const body = h('div', { class: 'settings' });
    body.append(h('h4', {}, 'Graphics'));
    body.append(h('div', { class: 'row' }, ...['low', 'high'].map((q) => h('button', { class: `btn small ${g.qualityName === q ? '' : 'ghost'}`, onclick: () => { g.setQuality(q); this.renderVenueModal(); } }, q === 'high' ? 'High (shadows)' : 'Fast'))));
    body.append(h('h4', {}, 'Getting around'));
    body.append(h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { g.teleportHome(); this.closeModal(); } }, '🚪 Back to the Main Gate')));
    body.append(h('h4', {}, 'Controls'));
    body.append(h('div', { class: 'help', html: HELP }));
    let armed = false;
    const reset = h('button', { class: 'btn small ghost danger', onclick: () => {
      if (!armed) { armed = true; reset.textContent = 'Tap again to erase your progress'; return; }
      g.resetProgress();
      this.closeModal();
    } }, 'Reset saved progress');
    body.append(h('h4', {}, 'Saved progress'), h('p', { class: 'note' }, 'Your Bucks, souvenirs and passport stamps are saved in this browser.'), reset);
    box.append(body);
  }

  // ---------------------------------------------------------------- food
  buildFood() {
    this.renderFood();
  }

  renderFood() {
    const bar = $('#food');
    bar.replaceChildren();
    this.g.sim.food.forEach((f, i) => {
      const item = this.items.get(f.id);
      bar.append(h('button', { class: 'food', title: `${item.name} - tap to take a bite`, onclick: () => { this.g.sim.eat(i); this.renderFood(); } },
        h('img', { alt: '', src: this.g.thumbs.get(f.id) || '' }), h('span', { class: 'key' }, String(i + 1)), h('span', { class: 'bites' }, '●'.repeat(f.bites))));
    });
  }

  // -------------------------------------------------------------- prompts
  findPrompt(pos) {
    let best = null, bestD = 14;
    for (const ride of this.cfg.Rides) {
      const d = Math.hypot(pos.x - ride.entrance[0], pos.z - ride.entrance[2]);
      if (d < bestD) { bestD = d; best = { kind: 'ride', ride }; }
    }
    for (const v of this.cfg.Venues) {
      const c = this.venueFront(v).counter;
      const d = Math.hypot(pos.x - c[0], pos.z - c[2]);
      if (d < bestD) { bestD = d; best = { kind: 'venue', venue: v }; }
    }
    return best;
  }

  updatePrompt(pos, riding) {
    const el = $('#prompt');
    const p = riding || this.venueOpen ? null : this.findPrompt(pos);
    const key = p ? (p.kind === 'ride' ? `r:${p.ride.id}` : `v:${p.venue.id}`) : '';
    this.prompt = p;
    if (!p) { el.hidden = true; this.promptKey = ''; return; }
    el.hidden = false;
    const sim = this.g.sim;
    if (key !== this.promptKey) {
      this.promptKey = key;
      el.replaceChildren();
      if (p.kind === 'ride') {
        const land = this.lands.get(p.ride.land);
        el.style.setProperty('--accent', css(land.color));
        this.promptSub = h('div', { class: 'psub' });
        this.promptJoin = h('button', { class: 'btn', onclick: () => this.primary() }, '');
        this.promptExpress = h('button', { class: 'btn ghost', onclick: () => this.secondary() }, '');
        el.append(h('div', { class: 'ptitle' }, p.ride.name), this.promptSub, h('div', { class: 'pbtns' }, this.promptJoin, this.promptExpress));
      } else {
        const land = this.lands.get(p.venue.land);
        el.style.setProperty('--accent', css(land.color));
        el.append(h('div', { class: 'ptitle' }, p.venue.name), h('div', { class: 'psub' }, p.venue.description),
          h('div', { class: 'pbtns' }, h('button', { class: 'btn', onclick: () => this.primary() }, h('kbd', {}, 'E'), p.venue.kind === 'restaurant' ? ' Order Food' : ' Browse Shop')));
      }
    }
    if (p.kind === 'ride') {
      const s = sim.rideState(p.ride.id);
      const inLine = sim.queueRide === p.ride.id;
      this.promptSub.textContent = s.status === 'Closed' ? 'Temporarily closed - you can still wait in line' : `${p.ride.category}  ${stars(p.ride.thrill)}  ·  Wait ${s.wait} min`;
      this.promptJoin.replaceChildren(h('kbd', {}, 'E'), inLine ? ' In line ✓' : ' Join Line');
      this.promptJoin.disabled = inLine;
      this.promptExpress.replaceChildren(h('kbd', {}, 'F'), ` Express Pass (${sim.profile.passes})`);
      this.promptExpress.disabled = sim.profile.passes <= 0;
    }
  }

  primary() {
    const p = this.prompt;
    if (!p) return;
    if (p.kind === 'ride') this.g.sim.join(p.ride.id, false);
    else this.openVenue(p.venue.id);
  }

  secondary() {
    const p = this.prompt;
    if (p && p.kind === 'ride') this.g.sim.join(p.ride.id, true);
  }

  // ----------------------------------------------------------- per frame
  update(dt, state) {
    const sim = this.g.sim;
    const p = sim.profile;
    const minute = Clock.minutes();
    this.clockEl.textContent = `🕒 ${Clock.format(minute)}`;
    this.bucksEl.textContent = `${this.cfg.CurrencyShort}${p.bucks}`;
    this.passesEl.textContent = `🎫 ${p.passes}`;
    const hunger = sim.hunger / this.cfg.Hunger.Max;
    this.hungerEl.style.width = `${hunger * 100}%`;
    this.hungerChip.classList.toggle('low', sim.hunger <= this.cfg.Hunger.HungryAt);
    const mv = state.movement;
    this.boostEl.hidden = !mv.boost;
    if (mv.boost) this.boostEl.textContent = mv.boost === 'speed' ? '⚡ Speed boost' : '🦘 Jump boost';

    // queue / riding pill
    const pill = $('#pill');
    const q = sim.playerQueue();
    if (sim.ridingRide) {
      pill.hidden = false;
      pill.classList.add('riding');
      $('span', pill).textContent = `🎢 Enjoy ${sim.rides.get(sim.ridingRide).cfg.name}! Keep your hands inside.`;
    } else if (q) {
      pill.hidden = false;
      pill.classList.remove('riding');
      const st = sim.rides.get(sim.queueRide);
      $('span', pill).textContent = st.status === 'Closed'
        ? `⏳ ${q.ride.name}: temporarily closed (#${q.pos} in line)`
        : `⏳ In line for ${q.ride.name}  ·  #${q.pos} in line  ·  about ${Math.max(1, q.eta)} min`;
    } else pill.hidden = true;

    // land banner
    const land = this.landAt(state.pos);
    if (land && land.id !== this.currentLand) {
      this.currentLand = land.id;
      if (this.started) this.banner(land.name, land.tagline, land.color);
    }

    // show caption
    const cap = $('#caption');
    if (state.caption) {
      cap.hidden = false;
      $('b', cap).textContent = state.caption.show;
      $('span', cap).textContent = state.caption.text;
    } else cap.hidden = true;

    // guide chip
    const gc = $('#guide-chip');
    if (state.guideDist >= 0) {
      gc.hidden = false;
      $('span', gc).textContent = `📍 ${this.g.guide.name}  ·  ${Math.round(state.guideDist)} m`;
    } else gc.hidden = true;

    this.updatePrompt(state.pos, sim.ridingRide);
    this.lastTick += dt;
    if (this.lastTick > 0.25) {
      this.lastTick = 0;
      this.updateLive();
      if (this.foodKey !== JSON.stringify(sim.food)) {
        this.foodKey = JSON.stringify(sim.food);
        this.renderFood();
      }
    }
  }

  landAt(pos) {
    for (const land of this.cfg.Lands) {
      for (const r of land.regions) {
        if (pos.x >= r[0] && pos.x <= r[2] && pos.z >= r[1] && pos.z <= r[3]) return land;
      }
    }
    return null;
  }

  // keyboard shortcuts
  handleKeys(input) {
    if (input.consume('e')) this.primary();
    if (input.consume('f')) this.secondary();
    for (const k of ['1', '2', '3']) {
      if (input.consume(k)) { this.g.sim.eat(Number(k) - 1); this.renderFood(); }
    }
    if (input.consume('m')) this.open(this.tab === 'Map' ? null : 'Map');
    if (input.consume('tab')) this.open(this.tab === 'Waits' ? null : 'Waits');
    if (input.consume('escape')) {
      if (this.venueOpen) this.closeModal();
      else this.open(null);
    }
  }

  // ---------------------------------------------------------- start screen
  showStart(onEnter) {
    const start = $('#start');
    const picker = $('#start .outfit-slot');
    picker.replaceChildren(this.outfitPicker(() => this.g.applyLook()));
    $('#start .help').innerHTML = HELP;
    $('#start .enter').onclick = () => {
      start.classList.add('gone');
      setTimeout(() => { start.hidden = true; }, 450);
      this.started = true;
      onEnter();
    };
    start.hidden = false;
  }
}

const HELP = `
<div class="keys"><b>Computer</b>
<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows: walk</span>
<span>Drag the mouse: look around · wheel: zoom</span>
<span><kbd>Space</kbd> jump · <kbd>E</kbd> join a line / open a shop · <kbd>F</kbd> Express Pass</span>
<span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> eat food · <kbd>M</kbd> park map · <kbd>Tab</kbd> wait times</span></div>
<div class="keys"><b>Phone &amp; tablet</b>
<span>Left thumb: walk · drag anywhere else: look</span>
<span>Pinch: zoom · tap ⤒ to jump · tap the buttons that pop up at rides and shops</span></div>`;
