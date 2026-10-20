/**
 * The Cutouts: thin retail display figures with printed smiling faces,
 * blank backs and hands folded over impossible creases. They stand in shop
 * windows and become three-dimensional when the mall shutters finish
 * closing. They cannot move while any living player looks at them within
 * twelve metres and a sixty degree central cone. Unobserved during a shutter
 * cycle they move at 3.2 m/s; contact deals 35. Reopening the shutters sends
 * them back to their display anchors over four seconds. A camera flash pins
 * every Cutout in the photograph for four seconds.
 */
import { Creature } from './base.js';
import { cycleClosed } from '../shutters.js';

const CONE = Math.cos(30 * Math.PI / 180);

export class Cutout extends Creature {
  constructor(game, opts) {
    super(game, 'cutout', opts);
    this.anchor = opts.anchor || { x: this.x, z: this.z, yaw: this.yaw };
    this.group = opts.group || null;
    this.mode = opts.mode || 'hunt'; // hunt | blockade | demo
    this.pinnedUntil = 0;
    this.awake = 0; // 0 flat display .. 1 fully three-dimensional
    this.observed = false;
    this.retreatFrom = null;
    if (!opts.state) this.state = 'dormant';
  }

  get active() { return this.state === 'pursue' && this.awake > 0.5; }
  get hostile() { return this.state === 'pursue' && this.mode === 'hunt' && !this.observed && this.game.time >= this.pinnedUntil; }

  /** Is any living player looking straight at this figure? */
  isObserved() {
    const g = this.game;
    const c = { x: this.x, y: this.y + 1.2, z: this.z };
    for (const p of g.players.values()) {
      if (!p.alive || p.hidden) continue;
      const e = p.eye();
      const dx = c.x - e.x, dy = c.y - e.y, dz = c.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 12) continue;
      const f = p.forward();
      if ((dx * f.x + dy * f.y + dz * f.z) / d < CONE) continue;
      if (g.level.world.clearLine(e.x, e.y, e.z, c.x, c.y, c.z)) return true;
    }
    return false;
  }

  hear() {}
  onFlash() { this.pinnedUntil = this.game.time + 4; this.game.fx('cutoutPinned', { id: this.id }); }

  update(dt) {
    if (this.gone) return;
    const g = this.game;
    this.stateT += dt;
    this.observed = this.isObserved();
    const closed = this.group ? cycleClosed(g, this.group) : false;
    if (this.mode === 'blockade') { this.awake = Math.min(1, this.awake + dt); this.moving = false; if (this.blockMove) this._blockMove(dt); return; }
    if (closed && this.state !== 'pursue') { this.setState('pursue'); }
    if (!closed && this.state === 'pursue') { this.setState('withdraw'); this.retreatFrom = { x: this.x, z: this.z, t: g.time }; }
    if (this.state === 'pursue') {
      this.awake = Math.min(1, this.awake + dt * 2);
      if (this.observed || g.time < this.pinnedUntil) { this.moving = false; this.speed = 0; return; }
      // hunt the nearest living player (or drift toward the glass in a demonstration)
      let best = null, bd = Infinity;
      for (const p of g.players.values()) { if (!p.alive || g.inRefugeVolume(p)) continue; const d = Math.hypot(p.x - this.x, p.z - this.z); if (d < bd) { bd = d; best = p; } }
      if (!best) { this.moving = false; return; }
      this.target = best.id;
      if (this.moveTo(best.x, best.z, this.S.pursue * g.D.pursuit, dt)) this.moving = false;
      if (this.mode === 'hunt' && g.time >= this.recoverUntil) this.tryContact();
      if (Math.random() < dt * 0.8 && this.moving) g.fx('sfx', { name: 'paperRub', x: this.x, z: this.z });
      return;
    }
    if (this.state === 'withdraw') {
      // back to the display anchor over four seconds, never crossing an open shutter threshold
      const r = this.retreatFrom || { x: this.x, z: this.z, t: g.time };
      const k = Math.min(1, (g.time - r.t) / 4);
      this.x = r.x + (this.anchor.x - r.x) * k; this.z = r.z + (this.anchor.z - r.z) * k;
      this.yaw = this.anchor.yaw ?? this.yaw;
      this.awake = Math.max(0, 1 - k);
      this.moving = k < 1;
      if (k >= 1) this.setState('dormant');
      return;
    }
    this.awake = Math.max(0, this.awake - dt);
    this.moving = false;
  }

  _blockMove(dt) {
    const t = this.blockMove;
    const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.blockMove = null; this.moving = false; if (t.yaw !== undefined) this.yaw = t.yaw; return; }
    const s = Math.min(d, 1.4 * dt);
    this.x += dx / d * s; this.z += dz / d * s; this.moving = true;
    this.yaw = Math.atan2(-dx, -dz);
  }

  tryContact() {
    const g = this.game;
    for (const p of g.players.values()) {
      if (!p.alive || p.hidden || g.inRefugeVolume(p)) continue;
      if (Math.hypot(p.x - this.x, p.z - this.z) > 0.95) continue;
      if (g.time < p.protectUntil || g.time < p.avoidUntil) continue;
      this.recoverUntil = g.time + 1.5;
      g.damagePlayer(p, this.S.damage, this);
      return;
    }
  }

  photoText() { return null; }
  saveData() { return { anchor: this.anchor, group: this.group, mode: this.mode }; }
  loadData(d) { if (d.anchor) this.anchor = d.anchor; if (d.group) this.group = d.group; if (d.mode) this.mode = d.mode; }
  serialize() { const s = super.serialize(); s.state = this.state === 'pursue' || this.state === 'withdraw' ? 'dormant' : this.state; s.x = this.anchor.x; s.z = this.anchor.z; return s; }
}
