/**
 * Battlefield systems that outlive a single shot: Bulwark shields (dynamic
 * collision boxes that block bullets until destroyed), Supply Drops, Area
 * Strikes and Recon Scans. Headless: the Game presents them from `events`
 * and the public lists.
 */
import { EQUIPMENT } from '../data/weapons.js';
import { SUPPORT, supportThreshold } from '../data/support.js';

export class Deployables {
  constructor(match) {
    this.m = match;
    this.shields = [];
    this.drops = [];
    this.strikes = [];
    this.recon = []; // per team: time until which enemies are revealed
    this._id = 1;
  }

  // ---------------------------------------------------------------- shields
  /** Where a shield would go for this combatant, or null if there is no room. */
  shieldSpot(c) {
    const def = EQUIPMENT.shield, w = this.m.world;
    // snap facing to the nearest axis: the collision world is axis-aligned
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    const alongX = Math.abs(fx) > Math.abs(fz); // facing ±X → barrier spans Z
    const nx = alongX ? Math.sign(fx) : 0, nz = alongX ? 0 : Math.sign(fz);
    const cx = c.x + nx * def.dist, cz = c.z + nz * def.dist;
    const gy = w.groundHeight(cx, cz, c.y + 0.6, 0.3);
    if (gy === -Infinity || Math.abs(gy - c.y) > 0.6) return null;
    const hw = def.width / 2, hd = def.depth / 2;
    const box = alongX
      ? { minX: cx - hd, maxX: cx + hd, minZ: cz - hw, maxZ: cz + hw }
      : { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
    box.minY = gy; box.maxY = gy + def.height;
    if (w.overlaps(box.minX, box.minY + 0.05, box.minZ, box.maxX, box.maxY, box.maxZ)) return null;
    for (const o of this.m.combatants) {
      if (!o.alive) continue;
      if (o.x + o.radius > box.minX && o.x - o.radius < box.maxX && o.z + o.radius > box.minZ && o.z - o.radius < box.maxZ) return null;
    }
    // line from the owner to the spot must be clear (no placing through walls)
    if (w.raycast(c.x, c.y + 0.6, c.z, nx, 0, nz, def.dist, 'solid')) return null;
    return { box, x: cx, y: gy, z: cz, alongX };
  }

  deployShield(c) {
    const spot = this.shieldSpot(c);
    if (!spot) { c.tactical.count++; return null; } // refund if the spot became blocked
    const def = EQUIPMENT.shield;
    const s = { id: this._id++, owner: c, team: c.team, x: spot.x, y: spot.y, z: spot.z, alongX: spot.alongX, hp: def.hp, maxHp: def.hp, life: def.life, w: def.width, h: def.height, d: def.depth };
    s.box = this.m.world.add({ ...spot.box, mat: 'metal', shield: s }, true);
    this.shields.push(s);
    this.m.emit({ type: 'shield', s });
    return s;
  }

  damageShield(s, amount, attacker) {
    if (s.hp <= 0) return;
    if (attacker && attacker.team === s.team && !this.m.settings.friendlyFire && attacker !== s.owner) return;
    s.hp -= amount;
    s.hitT = this.m.time;
    if (s.hp <= 0) this.removeShield(s, true);
  }

  removeShield(s, broken) {
    const i = this.shields.indexOf(s);
    if (i < 0) return;
    this.shields.splice(i, 1);
    this.m.world.remove(s.box);
    s.hp = 0;
    this.m.emit({ type: 'shieldGone', s, broken });
  }

  // ---------------------------------------------------------------- support
  /** Called on every elimination; grants abilities at their thresholds. */
  onKill(attacker, info) {
    if (!attacker || info.kind === 'strike') return;
    attacker.supportKills++;
    for (const id of ['recon', 'supply', 'strike']) {
      if (attacker.supportEarned[id]) continue;
      if (attacker.supportKills >= supportThreshold(id, attacker.perks)) {
        attacker.supportEarned[id] = true;
        attacker.abilities[id]++;
        this.m.emit({ type: 'supportEarned', c: attacker, id });
      }
    }
  }

  use(c, id) {
    const m = this.m;
    if (!c.alive || m.state !== 'live') return false;
    if (id === 'recon') {
      this.recon[c.team] = Math.max(this.recon[c.team] || 0, m.time) + SUPPORT.recon.duration;
      this.shareRecon(c.team);
    } else if (id === 'supply') {
      const p = this.dropPoint(c);
      if (!p) return false;
      this.drops.push({ id: this._id++, team: c.team, owner: c, x: p.x, y: p.y, z: p.z, fall: SUPPORT.supply.fall, life: SUPPORT.supply.life, used: new Set() });
    } else if (id === 'strike') {
      const t = this.strikePoint(c, c.brain?.strikeTarget);
      if (c.brain) c.brain.strikeTarget = null;
      if (!t) return false;
      this.strikes.push({ id: this._id++, team: c.team, owner: c, x: t.x, y: t.y, z: t.z, t: SUPPORT.strike.delay, shells: SUPPORT.strike.shells, next: 0 });
    } else return false;
    m.emit({ type: 'supportUsed', c, id, s: id === 'supply' ? this.drops[this.drops.length - 1] : id === 'strike' ? this.strikes[this.strikes.length - 1] : null });
    return true;
  }

  /** Is `e` revealed to `team` by an active recon scan? */
  revealed(e, team) {
    return (this.recon[team] || 0) > this.m.time && e.team !== team && e.alive && !e.perks?.has('pk_ghost');
  }

  shareRecon(team) {
    const m = this.m;
    for (const c of m.combatants) {
      if (!c.brain || !c.alive || c.team !== team) continue;
      for (const e of m.combatants) if (this.revealed(e, team)) c.brain.hear(e, e.x, e.z, 0.2);
    }
  }

  dropPoint(c) {
    const w = this.m.world;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    for (const d of [3, 2, 1.2, 0]) {
      const x = c.x + fx * d, z = c.z + fz * d;
      if (d && w.raycast(c.x, c.y + 0.5, c.z, fx, 0, fz, d + 0.5, 'solid')) continue;
      const y = w.groundHeight(x, z, c.y + 0.6, 0.4);
      if (y !== -Infinity && Math.abs(y - c.y) < 0.8) return { x, y, z };
    }
    return null;
  }

  /** Aim point: where the view ray meets geometry, or the ground at range. */
  strikePoint(c, target = null) {
    const w = this.m.world, R = SUPPORT.strike.range;
    if (target) return { x: target.x, y: target.y, z: target.z };
    const cp = Math.cos(c.pitch);
    const dx = -Math.sin(c.yaw) * cp, dy = Math.sin(c.pitch), dz = -Math.cos(c.yaw) * cp;
    const hit = w.raycast(c.x, c.eyeY, c.z, dx, dy, dz, R, 'bullet');
    let t = hit ? hit.t : R;
    if (!hit && dy < -0.02) t = Math.min(R, (c.eyeY - c.y) / -dy);
    if (!hit && dy >= -0.02) t = Math.min(R, 45);
    const x = c.x + dx * t, z = c.z + dz * t;
    const y = w.groundHeight(x, z, (hit ? c.eyeY + dy * t : c.y) + 0.3, 0.2);
    return { x, y: y === -Infinity ? 0 : y, z };
  }

  // ---------------------------------------------------------------- tick
  update(dt) {
    const m = this.m;
    for (let i = this.shields.length - 1; i >= 0; i--) {
      const s = this.shields[i];
      s.life -= dt;
      if (s.life <= 0) this.removeShield(s, false);
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.fall > 0) {
        d.fall -= dt;
        if (d.fall <= 0) m.emit({ type: 'dropLanded', d });
        continue;
      }
      d.life -= dt;
      if (d.life <= 0) { this.drops.splice(i, 1); m.emit({ type: 'dropGone', d }); continue; }
      for (const c of m.combatants) {
        if (!c.alive || c.team !== d.team || d.used.has(c.id) || c.dummy) continue;
        if (Math.hypot(c.x - d.x, c.z - d.z) > SUPPORT.supply.radius || Math.abs(c.y - d.y) > 1.2) continue;
        d.used.add(c.id);
        for (const w of c.weapons) { w.mag = w.def.mag; w.reserve = w.def.reserve; }
        c.lethal.count = EQUIPMENT[c.lethal.id].count;
        c.tactical.count = EQUIPMENT[c.tactical.id].count;
        c.health = 100;
        m.emit({ type: 'supplyPickup', c, d });
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      s.next -= dt;
      if (s.next > 0) continue;
      s.next = SUPPORT.strike.interval;
      const def = SUPPORT.strike;
      const a = m.rng() * Math.PI * 2, r = Math.sqrt(m.rng()) * def.spread;
      const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      const y = m.world.groundHeight(x, z, s.y + 4, 0.1);
      m.projectiles.explodeAt(x, (y === -Infinity ? s.y : y) + 0.1, z, s.owner, def, 'strike', 'strike');
      s.shells--;
      if (s.shells <= 0) { this.strikes.splice(i, 1); m.emit({ type: 'strikeDone', s }); }
    }
    // keep allied bots informed while a scan runs
    this.reconT = (this.reconT || 0) - dt;
    if (this.reconT <= 0) {
      this.reconT = 1.5;
      for (let t = 0; t < this.recon.length; t++) if ((this.recon[t] || 0) > m.time) this.shareRecon(t);
    }
  }
}
