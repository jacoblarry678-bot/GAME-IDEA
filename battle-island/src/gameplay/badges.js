/**
 * The Benton Badges in a match: spinning medallions at hard-to-reach spots
 * (rooftops, the highest zipline tower, the island's peak, a far beach).
 * Collecting is personal and cosmetic, so every device checks its own
 * player; badges you already own show as faint ghosts.
 */

import * as THREE from 'three';
import { WATER_Y } from '../world/physics.js';
import { BADGES, BADGE_XP, hasBadge, findBadge, badgeCount } from '../core/badges.js';
import { GLIDERS } from '../core/season.js';
import { sfx } from '../core/audio.js';

const REACH = 1.9;

export class BadgeHunt {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.foundNow = []; // badges found during this match (for the result XP)
    this.list = BADGES.map((def, i) => {
      const pos = this._place(def.at);
      const mesh = medallion(def);
      mesh.position.copy(pos);
      this.root.add(mesh);
      return { def, i, pos, mesh, owned: hasBadge(def.id) };
    });
    this._look();
    game.scene.add(this.root);
  }

  // ------------------------------------------------------------ placement
  _place(at) {
    const W = this.game.world;
    if (at.roof) {
      const p = W.pois.find((q) => q.id === at.roof) || W.minor.find((q) => q.name === at.roof);
      return this._highest(p.x, p.z, p.r ? Math.min(18, p.r * 0.6) : 9);
    }
    if (at.zipline) {
      let best = null;
      for (const L of W.ziplines) for (const e of [L.a, L.b]) if (!best || e.y > best.y) best = e;
      return new THREE.Vector3(best.x, best.y + 1.6, best.z);
    }
    if (at.peak) {
      let best = null;
      for (let x = -150; x <= 150; x += 3) for (let z = -150; z <= 150; z += 3) {
        const h = W.height(x, z);
        if (!best || h > best.y) best = new THREE.Vector3(x, h, z);
      }
      best.y = W.physics.groundAt(best.x, best.z, best.y + 30).y + 1.1;
      return best;
    }
    // beach: the dry spot farthest from the middle of the island
    let best = null, bd = 0;
    for (let a = 0; a < 72; a++) {
      const ang = (a / 72) * Math.PI * 2;
      for (let r = 200; r > 40; r -= 2) {
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (W.height(x, z) > WATER_Y + 0.4) {
          if (r > bd) { bd = r; best = new THREE.Vector3(x * 0.985, 0, z * 0.985); }
          break;
        }
      }
    }
    best.y = W.physics.groundAt(best.x, best.z, 40).y + 1.1;
    return best;
  }

  /** The highest standing surface (roof, tower top) within r of (x, z). */
  _highest(x, z, r) {
    const phys = this.game.world.physics;
    let best = null;
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        const px = x + dx, pz = z + dz;
        const g = phys.groundAt(px, pz, 120, 0.3);
        // needs a little flat room to stand on
        if (Math.abs(phys.groundAt(px + 0.6, pz, 120, 0.3).y - g.y) > 0.4 || Math.abs(phys.groundAt(px, pz + 0.6, 120, 0.3).y - g.y) > 0.4) continue;
        if (!best || g.y > best.y) best = new THREE.Vector3(px, g.y, pz);
      }
    }
    best.y += 1.1;
    return best;
  }

  // ------------------------------------------------------------ per frame
  update(dt, t) {
    const g = this.game;
    const p = g.player;
    const canGrab = p && p.alive && !p.downed && p.state !== 'bus' && !g.controller.spectating;
    for (const b of this.list) {
      b.mesh.rotation.y = t * 1.6 + b.i;
      b.mesh.position.y = b.pos.y + Math.sin(t * 2.2 + b.i) * 0.15;
      if (b.owned || !canGrab) continue;
      if (p.pos.distanceTo(b.pos) > REACH && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) + Math.abs(p.pos.y + 1 - b.pos.y) > REACH * 1.4) continue;
      this.collect(b);
    }
  }

  collect(b) {
    const g = this.game;
    const got = findBadge(b.def.id);
    b.owned = true;
    this._look();
    if (!got) return;
    this.foundNow.push(b.def.id);
    g.effects.burst(b.pos, b.def.color, 26, 5, 0.14, 1);
    sfx.play('coin', b.pos);
    g.hud.toast(`Benton Badge found: ${b.def.name}! (${badgeCount()}/${BADGES.length}) · +${BADGE_XP} XP`, '#ffd23f', 4);
    for (const r of got) g.hud.toast(`${r.n} badges: the ${GLIDERS[r.glider].name} glider is yours!`, '#7ed957', 5);
  }

  /** Owned badges fade to ghosts; new ones shine. */
  _look() {
    for (const b of this.list) {
      b.mesh.traverse((o) => {
        for (const mt of mats(o)) {
          mt.transparent = b.owned || mt.userData.glow;
          mt.opacity = b.owned ? 0.28 : mt.userData.glow ? 0.6 : 1;
        }
      });
    }
  }

  dispose() {
    this.game.scene.remove(this.root);
    const seen = new Set();
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const mt of mats(o)) {
        if (seen.has(mt)) continue;
        seen.add(mt);
        mt.map?.dispose();
        mt.dispose();
      }
    });
  }
}

/** A mesh's materials as a list (the coin uses one per face group). */
const mats = (o) => (!o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]);

function medallion(def) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffcf3f';
  x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
  x.fillStyle = def.color;
  x.beginPath(); x.arc(64, 64, 46, 0, 7); x.fill();
  x.strokeStyle = '#1d2a3a';
  x.lineWidth = 4;
  x.stroke();
  x.font = '56px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#1d2a3a';
  x.fillText(def.mark, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshBasicMaterial({ map: tex });
  const rim = new THREE.MeshLambertMaterial({ color: '#ffcf3f', emissive: '#5a4200' });
  // a coin: faces on both sides, gold rim
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24), [rim, face, face]);
  coin.rotation.x = Math.PI / 2;
  g.add(coin);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 24), new THREE.MeshBasicMaterial({ color: '#fff3b0', side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
  glow.material.userData.glow = true;
  g.add(glow);
  return g;
}
