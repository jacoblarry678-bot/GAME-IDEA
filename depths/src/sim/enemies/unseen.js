/**
 * The Unseen: an unfinished human copy. Footprints, dents in upholstery and
 * a shadow that does not meet a body. It patrols at 1.6 m/s and pursues at
 * 3.7. Warning: three floor dents advancing toward the target over three
 * seconds. It sees movement within ten metres and ignores a stationary
 * crouched person beside solid cover. Contact deals 35; search lasts 15 s.
 * A photograph does not stop it but records which way it was facing.
 * Only one may be active. It never copies a player's collision, equipment,
 * name or team marker.
 *
 * Encounters: 'gallery' (first live warning: walks the observation gallery
 * and leaves), 'roam' (switching room), 'watch' (the obedient route: it
 * keeps pace on the far side of the glass and never attacks), 'hunt'
 * (the rescue route).
 */
import { Creature } from './base.js';

const COMPASS = ['north', 'north-west', 'west', 'south-west', 'south', 'south-east', 'east', 'north-east'];

export class Unseen extends Creature {
  constructor(game, opts) {
    super(game, 'unseen', opts);
    this.printT = 0;
  }
  sightRange() { return 10; }
  hear() {}

  isMoving(p) { return Math.hypot(p.vx || 0, p.vz || 0) > 0.25; }

  /** A tall solid object right beside the player counts as cover. */
  coverNear(p) {
    const W = this.game.level.world;
    const list = W.query(p.x - 0.85, p.z - 0.85, p.x + 0.85, p.z + 0.85, []);
    for (const b of list) {
      if (!b.solid || b.tag === 'floor' || b.tag === 'door') continue;
      if (b.maxY < p.y + 0.9 || b.minY > p.y + 0.5) continue;
      return true;
    }
    return false;
  }

  canSee(p) {
    if (!p.alive || p.hidden || p.spectating) return false;
    if (this.encounter === 'watch') return false;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (d > this.sightRange()) return false;
    if (d > 1.2 && !this.inFov(p, 150)) return false;
    if (!this.isMoving(p) && p.crouched) {
      if (this.coverNear(p)) return false;
      const e = this.eye();
      if (!this.game.level.world.clearLine(e.x, e.y, e.z, p.x, p.y + 0.55, p.z)) return false;
    }
    return this.lineTo(p);
  }
  canTrack(p) { return this.canSee(p) || (Math.hypot(p.x - this.x, p.z - this.z) < 3 && this.isMoving(p)); }

  st_warn(dt) {
    super.st_warn(dt);
    const p = this.game.players.get(this.target);
    const k = this.data.dents || 0;
    if (p && k < 3 && this.stateT >= k) {
      this.data.dents = k + 1;
      const f = (k + 1) / 4;
      const x = this.x + (p.x - this.x) * f, z = this.z + (p.z - this.z) * f;
      this.game.fx('floorDent', { id: this.id, x, z, n: k + 1 });
      this.game.fx('sfx', { name: 'floorDent', x, z });
    }
  }
  beginWarn(p) { this.data.dents = 0; super.beginWarn(p); }

  update(dt) {
    if (this.gone) return;
    if (this.encounter === 'watch') { this.moving = false; this.stateT += dt; return; } // the script moves it along the glass
    const ox = this.x, oz = this.z;
    super.update(dt);
    this.printT += Math.hypot(this.x - ox, this.z - oz);
    if (this.printT > 0.8) { this.printT = 0; this.game.fx('footprint', { id: this.id, x: this.x, z: this.z, yaw: this.yaw }); }
  }

  photoText() {
    const a = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const dir = COMPASS[Math.round(a / (Math.PI / 4)) % 8];
    return `An almost correct Evan, without eyes, facing ${dir} at the moment of exposure.`;
  }
}
