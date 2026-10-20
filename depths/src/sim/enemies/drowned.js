/**
 * The Drowned Shape: no visible surface body, only a human-sized wake that
 * displaces water. Patrols water channels at 1.4 m/s and pursues at 3.4. It
 * hears footsteps in water; crouch-wading is quiet but leaves a ripple it
 * investigates within five metres. It cannot cross dry grating, a drained
 * basin or a station alcove. Its channels connect offscreen through drains;
 * it never teleports between disconnected visible pools. The wake is visible
 * at least three seconds before contact. Contact deals 40 and pushes the
 * player toward the nearest ledge. A drain release or decoy draws it for six
 * seconds unless someone runs within five metres. On dry ground it searches
 * the adjacent pool for fifteen seconds, then withdraws.
 */
import { Creature } from './base.js';

export class Drowned extends Creature {
  constructor(game, opts) {
    super(game, 'drowned', opts);
    this.invisible = true;
    this.drains = opts.drains || game.chapterDef.drains || [];
    this.lure = null;
    this.inDrain = null;
    this.armed = opts.armed !== false;
    this.wake = 0;
  }

  okCell(i) {
    const nav = this.game.level.nav;
    if (!nav.water[i]) return false;
    if (!this.game.level.waterAtIdx(i)) return false;
    return super.okCell(i);
  }

  sightAllowed() { return false; }
  canSee() { return false; }

  hear(ev, reach) {
    if (this.gone || this.inDrain || this.state === 'dormant' || this.state === 'scripted') return;
    const g = this.game, L = g.level;
    if (ev.kind === 'decoy' || ev.kind === 'stream' || ev.kind === 'drain' || ev.kind === 'splash') {
      if (this.state === 'pursue') {
        // a lure works unless the target is running in the water within five metres
        const p = g.players.get(this.target);
        if (p && p.sprinting && Math.hypot(p.x - this.x, p.z - this.z) < 5 && L.waterAt(p.x, p.z)) return;
      }
      this.lure = { x: ev.x, z: ev.z, until: g.time + 6 };
      this.suspect = { x: ev.x, z: ev.z, t: g.time };
      if (this.state !== 'investigate') this.setState('investigate');
      return;
    }
    if (!ev.player) return;
    const p = g.players.get(ev.player);
    if (!p || !L.waterAt(ev.x, ev.z)) return; // the grating and dry tiles do not disturb the water
    const d = Math.hypot(ev.x - this.x, ev.z - this.z);
    if (ev.crouch) {
      if (d <= 5 && this.state !== 'pursue' && this.state !== 'warn') { this.suspect = { x: ev.x, z: ev.z, t: g.time }; this.setState('investigate'); }
      return;
    }
    if (this.state === 'pursue') { if (ev.player === this.target) { this.lastKnown = { x: ev.x, z: ev.z, t: g.time }; this.lastSeenT = g.time; } return; }
    if (!this.armed || g.time < this.cooldownUntil || this.state === 'withdraw') { this.suspect = { x: ev.x, z: ev.z, t: g.time }; if (this.state === 'patrol') this.setState('investigate'); return; }
    if (this.state === 'warn') return;
    if (g.director.blocksNewAttacker(this)) { this.suspect = { x: ev.x, z: ev.z, t: g.time }; this.setState('investigate'); return; }
    this.beginWarn(p);
  }

  /** The wake approaches during the warning (at least three seconds before contact). */
  st_warn(dt) {
    const g = this.game;
    const p = g.players.get(this.target);
    if (p && g.level.waterAt(p.x, p.z)) this.moveTo(p.x, p.z, this.S.patrol * 0.6, dt);
    if (this.stateT >= this.data.warnDur) {
      if (!p || !p.alive || !g.level.waterAt(p.x, p.z)) { this.beginSearch(this.lastKnown || { x: this.x, z: this.z }, false); this.searchUntil = g.time + 15; return; }
      this.setState('pursue');
    }
  }

  st_pursue(dt) {
    const g = this.game, L = g.level;
    const p = g.players.get(this.target);
    if (!p || !p.alive || p.downed) { this.beginWithdraw(); return; }
    if (!L.waterAt(p.x, p.z)) {
      // reached dry ground: search the adjacent pool for fifteen seconds
      this.beginSearch({ x: this.x, z: this.z }, true);
      this.searchUntil = g.time + 15;
      return;
    }
    // it follows the disturbance
    if (p.moving) { this.lastKnown = { x: p.x, z: p.z, t: g.time }; this.lastSeenT = g.time; }
    const lk = this.lastKnown;
    this.moveTo(lk.x, lk.z, this.pursueSpeed(), dt);
    if (g.time - this.lastSeenT > 6) { this.beginSearch(lk, true); this.searchUntil = g.time + 15; }
    if (this.stuckT > 5) { this.stuckT = 0; this.beginWithdraw(); }
  }

  st_investigate(dt) {
    const g = this.game;
    if (this.lure && g.time > this.lure.until) this.lure = null;
    super.st_investigate(dt);
  }

  attack(p) {
    const g = this.game;
    this.recoverUntil = g.time + 1.6;
    g.damagePlayer(p, this.S.damage, this);
    // push toward the nearest accessible ledge rather than trapping them
    const nav = g.level.nav;
    const i = nav.nearest(p.x, p.z, (k) => !nav.water[k] || !g.level.waterAtIdx(k), 12);
    if (i >= 0) { const c = nav.center(i); const dx = c.x - p.x, dz = c.z - p.z, l = Math.hypot(dx, dz) || 1; p.vx = dx / l * 6; p.vz = dz / l * 6; }
    this.beginSearch({ x: this.x, z: this.z }, false);
    this.searchUntil = g.time + 15;
  }

  tryContact() {
    const g = this.game;
    if (this.state !== 'pursue') return;
    for (const p of g.players.values()) {
      if (!p.alive || !g.level.waterAt(p.x, p.z)) continue;
      if (Math.hypot(p.x - this.x, p.z - this.z) > 1.0) continue;
      if (g.time < p.protectUntil || g.time < p.avoidUntil) continue;
      this.attack(p);
      return;
    }
  }

  /** Travel through a drain when the goal lies in another water body. */
  moveTo(tx, tz, speed, dt) {
    const g = this.game;
    if (this.inDrain) {
      this.inDrain.t -= dt;
      this.moving = false;
      if (this.inDrain.t <= 0) { this.x = this.inDrain.to.x; this.z = this.inDrain.to.z; this.inDrain = null; this.path = null; g.fx('drainExit', { id: this.id, x: this.x, z: this.z }); }
      return false;
    }
    const r = super.moveTo(tx, tz, speed, dt);
    if (!this.path && this.drains.length) {
      const nav = g.level.nav;
      const ok = (i) => this.okCell(i);
      const here = nav.reachable(this.x, this.z, ok, null);
      const goal = nav.nearest(tx, tz, ok, 14);
      if (goal >= 0 && !here[goal]) {
        for (const dr of this.drains) {
          for (const [a, b] of [[dr.a, dr.b], [dr.b, dr.a]]) {
            const ia = nav.nearest(a.x, a.z, ok, 4);
            if (ia < 0 || !here[ia]) continue;
            if (Math.hypot(a.x - this.x, a.z - this.z) < 0.8) { this.inDrain = { t: (dr.len || 20) / speed, to: b }; g.fx('drainEnter', { id: this.id, x: this.x, z: this.z }); return false; }
            return super.moveTo(a.x, a.z, speed, dt);
          }
        }
      }
    }
    return r;
  }

  photoPoint() { return this.inDrain ? null : { x: this.x, y: 0.15, z: this.z }; }
  photoText() { return 'Beneath the surface, a pale human body is folded into the knee-deep water, facing the camera.'; }
  get active() { return ['warn', 'pursue', 'investigate', 'search'].includes(this.state) && !this.inDrain; }
  serialize() { const s = super.serialize(); if (this.inDrain) { s.x = this.inDrain.to.x; s.z = this.inDrain.to.z; } return s; }
}
