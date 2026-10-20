/**
 * The Listener: a thin jointed silhouette that lives in wall cavities and
 * hunts noise. Hearing x1.25; it can see only within four metres and only
 * while pursuing. Warning: one extra footstep, then a two-second wall tap.
 */
import { Creature } from './base.js';

export class Listener extends Creature {
  constructor(game, opts) {
    super(game, 'listener', opts);
    this.inWall = !!opts.inWall;
  }
  sightAllowed() { return false; }
  canSee(p) {
    if (this.state !== 'pursue' && this.state !== 'warn') return false;
    return super.canSee(p);
  }
  sightRange() { return 4; }
  canTrack(p) { return this.canSee(p); }

  onHeard(ev, reach) {
    const g = this.game;
    // Pursuit: any sound made by the target updates the hunt.
    if (this.state === 'pursue') {
      if (ev.player) {
        this.target = ev.player;
        this.lastKnown = { x: reach.x, z: reach.z, t: g.time };
        if (reach.x === ev.x && reach.z === ev.z) this.lastSeenT = g.time;
        else this.lastSeenT = Math.max(this.lastSeenT, g.time - 1);
      } else if (ev.kind === 'decoy') {
        // a decoy is louder than footsteps: it drags the hunt toward itself
        this.lastKnown = { x: reach.x, z: reach.z, t: g.time };
        this.target = null;
        this.beginSearch({ x: reach.x, z: reach.z }, false);
        this.suspect = null;
      }
      return;
    }
    if (this.state === 'search' || this.state === 'patrol' || this.state === 'investigate') {
      if (g.time < this.cooldownUntil || g.time < this.noPursueUntil || this.encounter === 'demo') {
        super.onHeard(ev, reach);
        return;
      }
      // a clearly located player sound close by starts a hunt (with the warning)
      if (ev.player && reach.remain > 2 && Math.hypot(reach.x - ev.x, reach.z - ev.z) < 0.01 && Math.hypot(ev.x - this.x, ev.z - this.z) < 9) {
        const p = g.players.get(ev.player);
        if (p && p.alive && !g.inSafeRefuge(p) && !g.director.blocksNewAttacker(this)) { this.beginWarn(p); return; }
      }
      super.onHeard(ev, reach);
    }
  }

  st_pursue(dt) {
    const g = this.game;
    const p = this.target ? g.players.get(this.target) : null;
    if (!p || !p.alive || p.downed || g.inSafeRefuge(p)) { this.beginSearch(this.lastKnown || { x: this.x, z: this.z }, false); return; }
    if (this.canSee(p)) { this.lastKnown = { x: p.x, z: p.z, t: g.time }; this.lastSeenT = g.time; }
    const lk = this.lastKnown;
    const arrived = this.moveTo(lk.x, lk.z, this.pursueSpeed(), dt);
    if (this.stuckT > 5) { this.stuckT = 0; this.beginWithdraw(); return; }
    if ((arrived && g.time - this.lastSeenT > 1.2) || g.time - this.lastSeenT > 6) {
      g.fx('creatureLost', { id: this.id, type: this.type });
      // investigates the last footstep location, then searches
      this.beginSearch(lk, false);
    }
  }
}
