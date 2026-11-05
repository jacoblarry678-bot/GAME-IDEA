/**
 * The phone: press the phone key for the home screen, pick an app with the number keys,
 * 0 or Backspace goes back, the phone key puts it away.
 *
 *   1 Messages   texts from Sol and everyone else
 *   2 Contacts   Sol (come to me / wait here), Sunstate Cab (a ride to your waypoint),
 *                the mechanic (bring my car), Ocean Mercy and the police non-emergency line
 *   3 Map        the big map (set a waypoint there)
 *   4 LOOP       the social feed and camera
 *   5 Bank       balance and recent transactions
 *   6 Settings
 *
 * Contacts and businesses are invented.
 */
import { SURF } from '../realmap/tilemesh.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Phone {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.app = 'home';
    this.messages = []; // { from, text, t }
    this.unread = 0;
    this.msg = '';
    this.pending = []; // { t, fn } things that happen a little later (the cab, the mechanic)
    game.events.on('phoneMessage', (m) => {
      this.messages.unshift({ from: m.from, text: m.text, t: game.time, hour: game.engine.time.hour });
      this.messages.length = Math.min(this.messages.length, 30);
      if (!(this.open && this.app === 'messages')) this.unread++;
    });
  }

  get partnerName() { return this.game.partner?.protagonistName || 'Sol'; }

  /** The phone key: open the home screen, or put the phone (and LOOP) away. */
  toggle() {
    const so = this.game.social;
    if (so?.open) { so.toggle(); this.open = false; return; }
    this.open = !this.open;
    this.app = 'home'; this.msg = '';
    this.game.audio?.ui(this.open ? 'select' : 'switch');
  }

  apps() {
    return [
      ['messages', `Messages${this.unread ? ` (${this.unread})` : ''}`],
      ['contacts', 'Contacts'],
      ['map', 'Map'],
      ['loop', `LOOP${this.game.social?.unread ? ` (${this.game.social.unread})` : ''}`],
      ['bank', 'Bank'],
      ['settings', 'Settings'],
    ];
  }

  contacts() {
    const g = this.game, o = g.partner;
    const out = [];
    if (o && !o.dead) {
      const with_ = g.crew?.partnerWithPlayer?.();
      out.push({ name: o.protagonistName, note: with_ ? 'with you' : 'call', act: () => this.callPartner() });
    }
    out.push({ name: 'Sunstate Cab', note: g.hud?.waypoint || g.missions?.currentTarget() ? 'ride to your waypoint' : 'set a waypoint first', act: () => this.callCab() });
    out.push({ name: 'Hector (mechanic)', note: 'bring my car, $50', act: () => this.callMechanic() });
    out.push({ name: 'Ocean Mercy', note: 'patch-up advice', act: () => { this.msg = 'Nurse: "Drink water, stay out of the sun, and stop getting shot."'; } });
    out.push({ name: 'Police (non-emergency)', note: '', act: () => { this.msg = g.wanted.level > 0 ? 'You hang up before they can trace it. Smart.' : 'Hold music. Twelve minutes of hold music.'; } });
    return out;
  }

  step(dt) {
    const g = this.game;
    for (const p of [...this.pending]) { p.t -= dt; if (p.t <= 0) { this.pending.splice(this.pending.indexOf(p), 1); p.fn(); } }
    if (!this.open || g.social?.open || g.places?.openShop || g.paused) return;
    const I = g.input;
    const key = (i) => I.edges.has('Digit' + i) || I.edges.has('Numpad' + i) || I.virtual.edges.has('phone' + i);
    if (key(0) || I.edges.has('Backspace')) { if (this.app === 'home') this.open = false; else { this.app = 'home'; this.msg = ''; } g.audio?.ui('switch'); return; }
    for (let i = 1; i <= 9; i++) {
      if (!key(i)) continue;
      if (this.app === 'home') this.launch(this.apps()[i - 1]?.[0]);
      else if (this.app === 'contacts') { const c = this.contacts()[i - 1]; if (c) { c.act(); g.audio?.ui('select'); } }
      break;
    }
  }

  launch(app) {
    const g = this.game;
    if (!app) return;
    g.audio?.ui('select');
    this.msg = '';
    if (app === 'loop') { this.open = false; if (!g.social.open) g.social.toggle(); return; }
    if (app === 'map' || app === 'settings') { this.open = false; g.hud?.app?.pause(app === 'map' ? 'map' : 'settings'); return; }
    this.app = app;
    if (app === 'messages') this.unread = 0;
  }

  /** The partner comes to you (by cab if they're far away), or waits where they are. */
  callPartner() {
    const g = this.game, o = g.partner, p = g.player;
    if (!o || o.dead) return;
    const d = o.distanceTo(p.pos.x, p.pos.z);
    if (g.crew.partnerWithPlayer()) { o.partnerAI.setMode('wait', { x: o.pos.x, z: o.pos.z, yaw: o.yaw }); this.msg = `${o.protagonistName}: "Fine. I'll wait here."`; return; }
    if (d < 150 || o.vehicle) { o.partnerAI.setMode('follow'); this.msg = `${o.protagonistName}: "On my way."`; return; }
    this.msg = `${o.protagonistName}: "Taking a cab. Give me a minute."`;
    this.pending.push({ t: 20, fn: () => {
      if (o.dead || g.crew.partnerWithPlayer()) return;
      const pp = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
      const s = this.spotNear(pp.x + 4, pp.z + 4);
      if (o.vehicle) g.unseatCharacter(o.vehicle, o, null);
      o.pos.set(s.x, g.world.ground(s.x, s.z, 2), s.z); o.vel.set(0, 0, 0);
      o.partnerAI.reset?.(); o.partnerAI.setMode('follow');
      g.hud?.notify(`${o.protagonistName} is here.`, o.protagonistName, 'phone', 4);
    } });
  }

  /** A cab ride to the waypoint (or mission target): pay the fare, fade, arrive. */
  async callCab() {
    const g = this.game, p = g.player, w = g.world;
    const tgt = g.missions?.currentTarget() || g.hud?.waypoint;
    if (!tgt) { this.msg = 'Dispatcher: "Where to? Set a waypoint on the map first."'; return; }
    if (g.wanted.level > 0) { this.msg = 'Dispatcher: "With the police after you? No."'; return; }
    if (p.vehicle) { this.msg = 'Dispatcher: "You\'re already in a car, honey."'; return; }
    const km = Math.hypot(tgt.x - p.pos.x, tgt.z - p.pos.z) * 1.3 / 1000;
    if (km < 0.3) { this.msg = 'Dispatcher: "That\'s walking distance."'; return; }
    const fare = Math.round(6 + km * 2.2);
    if (g.economy.money < fare) { this.msg = `Dispatcher: "That's $${fare}. You don't have it."`; return; }
    g.economy.take(fare, `Sunstate Cab (${km.toFixed(1)} km)`);
    this.open = false;
    const app = g.hud?.app;
    app?.fade?.(1.6);
    g.hud?.notify(`Sunstate Cab: $${fare} for ${km.toFixed(1)} km.`, 'Sunstate Cab', 'phone', 5);
    p.controller.frozen = true; // (riding)
    if (w.real) await w.ready(tgt.x, tgt.z, 200);
    p.controller.frozen = false;
    const s = this.spotNear(tgt.x, tgt.z);
    const withPartner = g.crew.partnerWithPlayer();
    g.respawnPlayer(s.x, s.z, p.yaw, { health: p.health });
    if (withPartner) g.crew.regroupAt(s.x, s.z, p.yaw, true);
    g.engine.time.hour = (g.engine.time.hour + km / 40) % 24; // ~40 km/h through town
  }

  /** The mechanic brings your nearest car to the kerb next to you. */
  callMechanic() {
    const g = this.game, p = g.player;
    const pp = p.vehicle ? p.vehicle.pos : p.pos;
    const cars = g.vehicles.filter((v) => v.owner === 'player' && !v.sunk && !v.destroyed && !v.seats.some((s) => s && s !== g.partner));
    if (!cars.length) { this.msg = 'Hector: "You don\'t own a car, my friend. There are dealers for that."'; return; }
    const v = cars.sort((a, b) => a.pos.distanceTo(pp) - b.pos.distanceTo(pp))[0];
    if (v.pos.distanceTo(pp) < 60) { this.msg = `Hector: "Your ${v.def.name}? It's right there."`; return; }
    if (g.economy.money < 50) { this.msg = 'Hector: "Fifty bucks. Call me when you have it."'; return; }
    g.economy.take(50, 'Hector: car delivery');
    this.msg = `Hector: "I'll bring the ${v.def.name} round. Fifteen seconds."`;
    this.pending.push({ t: 15, fn: () => {
      const q = this.kerbNear(pp.x, pp.z);
      if (v.seats.some((s) => s)) return;
      v.pos.set(q.x, g.world.ground(q.x, q.z, 3), q.z); v.yaw = q.yaw;
      v.vel?.set?.(0, 0); v.health = Math.max(v.health, 600);
      g.hud?.notify(`Your ${v.def.name} is at the kerb.`, 'Hector', 'phone', 5);
    } });
  }

  /** A clear spot to stand near (x, z): dry, not inside a building or anything solid. */
  spotNear(x, z) {
    const w = this.game.world;
    for (let r = 0; r <= 60; r += 2) {
      const n = Math.max(1, Math.round(r * 3));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rand(0, 0.2);
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (w.isWater(px, pz)) continue;
        if (w.real) { const c = w.rasterAt(px, pz); if (c < 0 || c === SURF.building || c === SURF.road) continue; }
        const y = w.ground(px, pz, 2);
        if (w.collision.overlapsCircle(px, pz, 0.45, y + 0.2, 1.5)) continue;
        return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  /** The kerb lane of the nearest street (real map), else a clear spot. */
  kerbNear(x, z) {
    const w = this.game.world;
    const q = w.real ? w.roads?.nearest(x, z, (e) => e.cls >= 2 && e.cls <= 8 && e.lvl === 0 && !e.tunnel, 80) : null;
    if (!q) { const s = this.spotNear(x + 5, z); return { ...s, yaw: 0 }; }
    const p = q.e.pts, i = q.seg * 2;
    const tx = p[i + 2] - p[i], tz = p[i + 3] - p[i + 1], l = Math.hypot(tx, tz) || 1;
    const side = ((x - q.x) * -tz + (z - q.z) * tx) > 0 ? 1 : -1;
    const off = q.e.w / 2 - 1.3;
    return { x: q.x - (tz / l) * off * side, z: q.z + (tx / l) * off * side, yaw: Math.atan2(tx * side, tz * side) };
  }
}
