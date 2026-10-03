/**
 * Thrown equipment: bouncing grenade physics against the collision world,
 * frag explosions with line-of-sight falloff damage, and smoke clouds that
 * block sight for everyone (bots included).
 */
import { EQUIPMENT } from '../data/weapons.js';

const R = 0.07;

export class Projectiles {
  constructor(match) {
    this.match = match;
    this.list = [];
    this.smokes = [];
    this._id = 1;
  }

  throw(owner, kind) {
    const def = EQUIPMENT[kind];
    const cp = Math.cos(owner.pitch), sp = Math.sin(owner.pitch);
    const fx = -Math.sin(owner.yaw) * cp, fz = -Math.cos(owner.yaw) * cp, fy = sp;
    const speed = def.throwSpeed;
    // start slightly in front of the eye, pulled back if that's inside a wall
    let ox = owner.x, oy = owner.eyeY - 0.1, oz = owner.z;
    const w = this.match.world;
    const hit = w.raycast(ox, oy, oz, fx, fy, fz, 0.6, 'solid');
    const d = hit ? Math.max(0, hit.t - 0.12) : 0.5;
    ox += fx * d; oy += fy * d; oz += fz * d;
    const g = {
      id: this._id++, kind, def, owner,
      x: ox, y: oy, z: oz,
      vx: fx * speed + owner.vx * 0.6, vy: fy * speed + 3.2, vz: fz * speed + owner.vz * 0.6,
      fuse: def.fuse, rest: false, spin: 0, bounces: 0,
    };
    this.list.push(g);
    this.match.emit({ type: 'grenadeThrown', g });
    return g;
  }

  update(dt) {
    const w = this.match.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      g.fuse -= dt;
      if (!g.rest) {
        g.vy -= 19 * dt;
        let remaining = dt;
        for (let iter = 0; iter < 3 && remaining > 0; iter++) {
          const sp = Math.hypot(g.vx, g.vy, g.vz);
          if (sp < 1e-4) break;
          const dist = sp * remaining;
          const dx = g.vx / sp, dy = g.vy / sp, dz = g.vz / sp;
          const hit = w.raycast(g.x, g.y, g.z, dx, dy, dz, dist + R, 'solid');
          if (!hit) { g.x += dx * dist; g.y += dy * dist; g.z += dz * dist; break; }
          const t = Math.max(0, hit.t - R);
          g.x += dx * t; g.y += dy * t; g.z += dz * t;
          remaining -= t / sp;
          // reflect
          const vn = g.vx * hit.nx + g.vy * hit.ny + g.vz * hit.nz;
          g.vx -= 1.6 * vn * hit.nx; g.vy -= 1.6 * vn * hit.ny; g.vz -= 1.6 * vn * hit.nz;
          const fr = hit.ny > 0.5 ? 0.55 : 0.7;
          g.vx *= fr; g.vz *= fr; g.vy *= 0.6;
          g.bounces++;
          if (Math.abs(vn) > 2) this.match.emit({ type: 'grenadeBounce', g, mat: hit.box.mat });
          if (hit.ny > 0.5 && Math.hypot(g.vx, g.vy, g.vz) < 1.2) {
            g.rest = true; g.vx = g.vy = g.vz = 0;
            g.y = hit.box.maxY + R;
            break;
          }
        }
        g.spin += dt * 12;
        if (g.y < -10) { this.list.splice(i, 1); continue; }
      }
      if (g.fuse <= 0) {
        this.list.splice(i, 1);
        if (g.kind === 'frag') this.explode(g);
        else if (g.kind === 'smoke') this.deploySmoke(g);
        else if (g.kind === 'flash') this.flash(g);
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.age += dt;
      s.r = s.maxR * Math.min(1, s.age / 2.2) * (s.age > s.duration - 2.5 ? Math.max(0.05, (s.duration - s.age) / 2.5) : 1);
      if (s.age >= s.duration) this.smokes.splice(i, 1);
    }
  }

  explode(g) { this.explodeAt(g.x, g.y, g.z, g.owner, g.def, 'frag', 'explosive'); }

  /** Blast with line-of-sight falloff damage (frags and area-strike shells). */
  explodeAt(x, y, z, owner, def, weapon, kind) {
    const m = this.match;
    m.emit({ type: 'explosion', x, y, z, kind: weapon, radius: def.radius });
    m.noise(x, z, 70, owner);
    const cx = x, cy = y + 0.15, cz = z;
    const falloff = (d) => (d <= def.innerRadius ? def.damage : def.minDamage + (def.damage - def.minDamage) * (1 - (d - def.innerRadius) / (def.radius - def.innerRadius)) * 0.75);
    for (const c of m.combatants) {
      if (!c.alive) continue;
      const tx = c.x, ty = c.y + 1.0, tz = c.z;
      const d = Math.hypot(tx - cx, ty - cy, tz - cz);
      if (d > def.radius) continue;
      // need line of sight from blast to some part of the body
      let exposed = false;
      for (const h of [0.3, 1.0, 1.5]) {
        const py = c.y + h;
        const dx = tx - cx, dy = py - cy, dz = tz - cz;
        const l = Math.hypot(dx, dy, dz) || 1;
        const hit = m.world.raycast(cx, cy, cz, dx / l, dy / l, dz / l, l, 'bullet');
        if (!hit) { exposed = true; break; }
      }
      if (!exposed) continue;
      m.applyDamage(c, owner, falloff(d), { weapon, zone: 'torso', kind, fromX: cx, fromZ: cz });
    }
    // deployed shields soak blast damage
    for (const s of [...(m.deployables?.shields || [])]) {
      const d = Math.hypot(s.x - cx, s.y + 0.5 - cy, s.z - cz);
      if (d < def.radius) m.deployables.damageShield(s, falloff(d) * 1.5, owner);
    }
  }

  /** Stun flash: blinds anyone with line of sight, scaled by distance and facing. */
  flash(g) {
    const m = this.match, def = g.def;
    const cx = g.x, cy = g.y + 0.2, cz = g.z;
    m.emit({ type: 'flash', x: cx, y: cy, z: cz, radius: def.radius });
    m.noise(cx, cz, 40, g.owner);
    for (const c of m.combatants) {
      if (!c.alive || c.dummy) continue;
      if (c.team === g.owner.team && c !== g.owner && !m.settings.friendlyFire) continue;
      const ex = c.x, ey = c.eyeY, ez = c.z;
      const dx = cx - ex, dy = cy - ey, dz = cz - ez;
      const d = Math.hypot(dx, dy, dz);
      if (d > def.radius) continue;
      const hit = m.world.raycast(ex, ey, ez, dx / (d || 1), dy / (d || 1), dz / (d || 1), d, 'sight');
      if (hit) continue;
      const cp = Math.cos(c.pitch);
      const facing = (dx * -Math.sin(c.yaw) * cp + dy * Math.sin(c.pitch) + dz * -Math.cos(c.yaw) * cp) / (d || 1);
      const k = (1 - d / def.radius) * (0.3 + 0.7 * Math.max(0, facing));
      let t = 0.5 + def.maxBlind * k;
      if (c.perks?.has('pk_flak')) t *= 0.5;
      if (t > c.blindT) { c.blindT = t; c.blindMax = t; }
      m.emit({ type: 'flashed', c, t, owner: g.owner });
      if (c.brain) c.brain.onFlashed?.(t);
    }
  }

  deploySmoke(g) {
    const def = g.def;
    this.smokes.push({ x: g.x, y: g.y + 1.4, z: g.z, r: 0, maxR: def.radius, age: 0, duration: def.duration });
    this.match.emit({ type: 'smoke', x: g.x, y: g.y, z: g.z, radius: def.radius, duration: def.duration });
  }

  /** True when a sight line passes through enough smoke to be obscured. */
  smokeBlocks(ax, ay, az, bx, by, bz) {
    if (!this.smokes.length) return false;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / L, uy = dy / L, uz = dz / L;
    for (const s of this.smokes) {
      if (s.r < 0.8) continue;
      const lx = s.x - ax, ly = s.y - ay, lz = s.z - az;
      const tc = lx * ux + ly * uy + lz * uz;
      const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
      const r2 = s.r * s.r;
      if (d2 >= r2) continue;
      const half = Math.sqrt(r2 - d2);
      const t0 = Math.max(0, tc - half), t1 = Math.min(L, tc + half);
      // inside the cloud you can still see ~1.5 m
      if (t1 - t0 > 1.5) return true;
    }
    return false;
  }
}
