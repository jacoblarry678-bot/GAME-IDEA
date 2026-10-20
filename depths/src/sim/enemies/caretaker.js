/**
 * The Caretaker: a tall maintenance shape wrapped in old insulation with a
 * tool carrier where its face should be. Blind. It strikes the pipes with a
 * small spanner and listens to the return. Hearing x1.5. A sound source
 * that keeps going steadily stops being interesting after three seconds
 * (habituation): machine loops, a decoy left running. Player movement,
 * doors and bangs stay audible, except inside the cover of a running
 * machine. Contact deals 40, search lasts 25 s, patrol 1.0 m/s, pursuit 3.8.
 * It cannot enter inspection crawlways and does not hear footsteps through
 * a closed pressure door (the sound graph isolates those).
 *
 * Encounters: 'demo' (behind the tool bay mesh, never hunts), 'lane' (the
 * press corridor service lane), 'catwalk' (the shaft chase: after losing a
 * target it keeps advancing along the authored route instead of searching,
 * and must stop at negotiation points such as the turbine housing).
 */
import { Creature } from './base.js';
import { maskedAt } from '../machines.js';

const UNMASKED = new Set(['flash', 'callout']);

export class Caretaker extends Creature {
  constructor(game, opts) {
    super(game, 'caretaker', opts);
    this.clickT = 2;
    this.negotiate = opts.negotiate || []; // [{ id, x, z, r, t, what }]
    this.negotiated = new Set();
    this.habit = {};
    this.routeSpeed = opts.routeSpeed || 1.35;
  }
  canCrawl() { return false; }
  okCell(i) { if (this.game.level.nav.crawl[i]) return false; return super.okCell(i); }
  sightAllowed() { return false; }
  canSee() { return false; }
  canTrack() { return false; }
  reach() { return 1.1; }

  /** Steady non-player sources become background after `habituate` seconds. */
  habituated(ev) {
    if (ev.player || !ev.source) return false;
    if (ev.kind === 'machineLoop') return true;
    const t = this.game.time;
    const h = this.habit[ev.source];
    if (!h || t - h.last > 2.5) { this.habit[ev.source] = { first: t, last: t }; return false; }
    h.last = t;
    return t - h.first >= (this.S.habituate || 3);
  }

  hear(ev, reach) {
    if (this.gone || this.state === 'dormant' || this.state === 'scripted') return;
    if (ev.source === this.id) return;
    if (this.habituated(ev)) return;
    if (ev.player && !UNMASKED.has(ev.kind) && maskedAt(this.game, ev.x, ev.z)) return;
    this.onHeard(ev, reach);
  }

  onHeard(ev, reach) {
    const g = this.game;
    if (this.state === 'pursue') {
      if (ev.player) { this.target = ev.player; this.lastKnown = { x: reach.x, z: reach.z, t: g.time }; this.lastSeenT = g.time; }
      return;
    }
    if (this.state === 'withdraw' || this.state === 'warn') return;
    // a located player sound starts a hunt, after its tool-click warning
    if (ev.player && this.encounter !== 'demo' && g.time >= this.cooldownUntil && !g.director.blocksNewAttacker(this)) {
      const p = g.players.get(ev.player);
      if (p && p.alive && !g.inSafeRefuge(p) && Math.hypot(reach.x - this.x, reach.z - this.z) < 18) {
        this.beginWarn(p);
        this.lastKnown = { x: reach.x, z: reach.z, t: g.time };
        return;
      }
    }
    super.onHeard(ev, reach);
  }

  st_pursue(dt) {
    const g = this.game;
    const p = this.target ? g.players.get(this.target) : null;
    if (!p || !p.alive || p.downed || g.inSafeRefuge(p)) { this.beginSearch(this.lastKnown || { x: this.x, z: this.z }, false); return; }
    const lk = this.lastKnown || { x: p.x, z: p.z };
    const arrived = this.moveTo(lk.x, lk.z, this.pursueSpeed(), dt);
    if (this.stuckT > 5) { this.stuckT = 0; this.beginSearch(lk, true); return; }
    if ((arrived && g.time - this.lastSeenT > 2) || g.time - this.lastSeenT > 9) this.beginSearch(lk, true);
  }

  beginSearch(at, fromPursuit) {
    if (this.encounter === 'catwalk') {
      if (fromPursuit) this.game.fx('creatureLost', { id: this.id, type: this.type });
      this.target = null;
      // continue along the route from the first anchor still ahead
      let ix = this.anchors.length - 1;
      for (let i = 0; i < this.anchors.length; i++) if (this.anchors[i].z > this.z + 0.5) { ix = i; break; }
      this.anchorIx = ix;
      this.setState('patrol');
      return;
    }
    super.beginSearch(at, fromPursuit);
  }

  st_patrol(dt) {
    if (this.encounter !== 'catwalk') { super.st_patrol(dt); return; }
    // it trails the party along the route: the script caps how far ahead it may listen from
    const g = this.game;
    const lim = g.script.routeLimit ? g.script.routeLimit(g, this) : this.anchors.length - 1;
    const ix = Math.max(0, Math.min(this.anchorIx, lim));
    const a = this.anchors[ix];
    if (!a) { this.moving = false; return; }
    if (this.moveTo(a.x, a.z, this.routeSpeed, dt) || this.stuckT > 5) {
      this.stuckT = 0;
      if (this.anchorIx < Math.min(lim, this.anchors.length - 1)) { this.anchorIx++; this.path = null; } else { this.moving = false; this.speed = 0; this.yaw += dt * 0.6; }
    }
  }

  /** Blind, but not numb: walking into someone is as good as hearing them. */
  touch() {
    if (this.encounter === 'demo' || this.hostile || this.state === 'withdraw' || this.state === 'dormant' || this.state === 'scripted') return;
    const g = this.game;
    for (const p of g.players.values()) {
      if (!p.alive || p.hidden || g.inRefugeVolume(p) || Math.abs(p.y - this.y) > 1.2) continue;
      if (Math.hypot(p.x - this.x, p.z - this.z) > 0.85) continue;
      if (g.director.blocksNewAttacker(this)) return;
      this.target = p.id; this.lastKnown = { x: p.x, z: p.z, t: g.time }; this.lastSeenT = g.time;
      this.setState('pursue');
      this.attack(p);
      return;
    }
  }

  update(dt) {
    if (this.gone) return;
    const g = this.game;
    this.clickT -= dt;
    if (this.clickT <= 0 && this.state !== 'dormant') {
      this.clickT = this.state === 'pursue' || this.state === 'warn' ? 1.2 : 3.5;
      g.fx('sfx', { name: 'toolClick', x: this.x, z: this.z });
    }
    if (this.data.pauseUntil && g.time < this.data.pauseUntil) { this.moving = false; this.speed = 0; this.stateT += dt; return; }
    for (const n of this.negotiate) {
      if (this.negotiated.has(n.id) || Math.hypot(n.x - this.x, n.z - this.z) > (n.r || 1.2)) continue;
      this.negotiated.add(n.id);
      this.data.pauseUntil = g.time + n.t;
      g.fx('caretakerNegotiates', { id: this.id, what: n.what, x: n.x, z: n.z, t: n.t });
      g.fx('sfx', { name: 'scrape', x: n.x, z: n.z });
      return;
    }
    super.update(dt);
    if (!this.gone) this.touch();
  }

  saveData() { return { negotiate: this.negotiate, negotiated: [...this.negotiated], anchorIx: this.anchorIx, routeSpeed: this.routeSpeed }; }
  loadData(d) {
    if (d.negotiate) this.negotiate = d.negotiate;
    this.negotiated = new Set(d.negotiated || []);
    if (d.anchorIx !== undefined) this.anchorIx = d.anchorIx;
    if (d.routeSpeed) this.routeSpeed = d.routeSpeed;
  }
  photoText() { return 'A tall figure wrapped in yellowed insulation; where its face should be, a carrier of hanging tools.'; }
}
