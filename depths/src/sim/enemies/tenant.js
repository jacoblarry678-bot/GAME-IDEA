/**
 * The Tenant: a person seen through layered curtains whose face, up close,
 * is a warmly lit apartment window pasted flat. It knocks in sets of three
 * and speaks with resident recordings. Pursues at 3.5 m/s, sees within 12 m
 * in a 70 degree cone, contact deals 30. Closing an apartment door blocks it
 * for three seconds. It searches for twenty seconds. A verified refuge forces
 * it back; it never emerges from a real refuge and never attacks while the
 * player is reading a protected Survey Station image.
 */
import { Creature } from './base.js';

export class Tenant extends Creature {
  constructor(game, opts) {
    super(game, 'tenant', opts);
    this.knockT = 2 + Math.random() * 4;
  }
  doorOpenTime(d) { return d.type === 'apartment' ? 3 : d.T.creatureOpen; }
  update(dt) {
    super.update(dt);
    if (this.gone) return;
    this.knockT -= dt;
    if (this.knockT <= 0 && (this.state === 'search' || this.state === 'patrol' || this.state === 'investigate')) {
      this.knockT = 9 + Math.random() * 6;
      this.game.fx('sfx', { name: 'knock3', x: this.x, z: this.z });
      this.game.fx('creatureKnock', { id: this.id, x: this.x, z: this.z });
    }
  }
  tryContact() {
    const g = this.game;
    for (const p of g.players.values()) {
      if (!p.alive || p.hidden) continue;
      if (p.action && p.action.kind === 'station') continue; // reading a protected survey image
      if (Math.abs(p.y - this.y) > 1.2 || Math.hypot(p.x - this.x, p.z - this.z) > this.reach()) continue;
      if (g.inRefugeVolume(p) || g.time < p.protectUntil || g.time < p.avoidUntil) continue;
      if (this.state === 'warn') continue;
      this.attack(p);
      return;
    }
  }
  photoText() { return 'Through the curtains: a figure whose face is a flat, warmly lit apartment window.'; }
}
