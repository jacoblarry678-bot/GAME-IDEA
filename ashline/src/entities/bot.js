/**
 * Bot AI. Produces the same command structure a human produces, so bots obey
 * identical movement, weapon and visibility rules. Perception uses real
 * line-of-sight (geometry + smoke), a field of view and a reaction delay;
 * difficulty scales reaction, turn speed, aim error and tactics.
 */
import { EQUIPMENT } from '../data/weapons.js';
import { inZone } from '../game/modes.js';

const DEG = Math.PI / 180;
const PREF_RANGE = {
  shotgun: [0, 7, 12],
  smg: [0, 11, 22],
  assault: [6, 22, 40],
  sniper: [22, 40, 90],
  pistol: [0, 10, 20],
};

export class BotBrain {
  constructor(c, match) {
    this.c = c;
    this.m = match;
    this.d = match.difficulty;
    this.known = new Map();
    this.target = null;
    this.state = 'roam';
    this.path = null; this.pathIdx = 0;
    this.goal = null;
    this.goalName = '';
    this.thinkT = Math.random() * 0.12;
    this.repathT = 0;
    this.waitT = 0;
    this.stuckT = 0; this.stuckN = 0; this.lastX = 0; this.lastZ = 0;
    this.aimOff = [0, 0, 0]; this.aimOffT = 0;
    this.trackT = 0;
    this.aimHead = false;
    this.strafe = 0; this.strafeT = 0;
    this.burstT = 0; this.pauseT = 0;
    this.semiT = 0;
    this.crouchT = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this.glanceT = 0;
    this.nadeCd = 6 + Math.random() * 8;
    this.throwLock = 0;
    this.flee = null;
    this.coverT = 0;
    this.lastDamagedT = -99;
    this.jumpPulse = false;
  }

  onSpawn() {
    this.known.clear();
    this.target = null;
    this.state = 'roam';
    this.path = null; this.goal = null;
    this.waitT = 0;
    this.trackT = 0;
    this.flee = null;
    this.lookYaw = this.c.yaw; this.lookPitch = 0;
    this.stuckT = 0; this.stuckN = 0;
    this.lastX = this.c.x; this.lastZ = this.c.z;
    this.nadeCd = 4 + Math.random() * 8;
  }

  onDeath() { this.target = null; this.path = null; }

  idleLook(dt) {
    this.c.cmd.yaw = this.c.yaw;
  }

  hear(source, x, z, falloff) {
    if (!source) return;
    const mem = this.known.get(source.id);
    const now = this.m.time;
    if (mem && mem.visible) return;
    this.known.set(source.id, { c: source, x, y: source.y, z, t: now, visible: false, seenSince: null, heard: true });
  }

  onDamaged(attacker, info) {
    if (!attacker || attacker.team === this.c.team) return;
    this.lastDamagedT = this.m.time;
    const mem = this.known.get(attacker.id);
    if (!mem || !mem.visible) {
      this.known.set(attacker.id, { c: attacker, x: attacker.x, y: attacker.y, z: attacker.z, t: this.m.time, visible: false, seenSince: null, heard: true, hurt: true });
    }
    // snap attention toward the attacker (but not perfect aim)
    if (!this.target) {
      this.lookYaw = Math.atan2(-(attacker.x - this.c.x), -(attacker.z - this.c.z)) + (Math.random() - 0.5) * 0.6;
    }
  }

  update(dt) {
    const c = this.c, cmd = c.cmd;
    // reset pulses (think() may set some for this tick)
    cmd.jump = false; cmd.reload = false; cmd.swap = false; cmd.melee = false; cmd.lethal = false; cmd.tactical = false;
    cmd.fire = false; cmd.ads = false; cmd.sprint = false;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.12 + Math.random() * 0.04; this.think(); }
    if (this.jumpPulse) { cmd.jump = true; this.jumpPulse = false; }

    if (this.throwLock > 0) {
      this.throwLock -= dt;
      cmd.moveX = cmd.moveZ = 0;
      cmd.yaw = this.lookYaw; cmd.pitch = this.lookPitch;
      return;
    }

    if (this.state === 'engage' && this.target) this.engage(dt);
    else this.navigate(dt);

    this.turn(dt);
    this.checkStuck(dt);
  }

  // ---------------- perception & decisions ----------------
  think() {
    const c = this.c, m = this.m, now = m.time;
    const eyeY = c.eyeY;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    const cosFov = Math.cos(this.d.fovDeg * 0.5 * DEG);
    let best = null, bestScore = Infinity;
    for (const e of m.combatants) {
      if (e.team === c.team || !e.alive) { if (!e.alive) this.known.delete(e.id); continue; }
      const dx = e.x - c.x, dz = e.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 95) continue;
      const inFov = d < 4 || (dx * fx + dz * fz) / (d || 1) > cosFov;
      let vis = false;
      if (inFov) {
        const pts = e.sightPoints();
        // distant crouched targets are harder to pick out
        const maxCheck = e.stance !== 'stand' && d > 45 ? 1 : 2;
        for (let i = 0; i < maxCheck; i++) {
          const p = pts[i];
          if (m.canSee(c.x, eyeY, c.z, p[0], p[1], p[2])) { vis = true; break; }
        }
      }
      let mem = this.known.get(e.id);
      if (vis) {
        if (!mem) { mem = { c: e }; this.known.set(e.id, mem); }
        if (!mem.visible || !mem.seenSince) mem.seenSince = now;
        mem.visible = true; mem.heard = false;
        mem.x = e.x; mem.y = e.y; mem.z = e.z; mem.t = now;
        // reaction: shorter if we were already aware of this enemy, longer at range
        const aware = mem.prevT && now - mem.prevT < 3;
        const facing = (dx * fx + dz * fz) / (d || 1);
        const peripheral = facing < 0.87 ? 1.6 : 1; // outside ~30° of view center takes longer to notice
        const moving = Math.hypot(e.vx, e.vz) > 0.5 ? 1 : 1.35; // still targets are harder to spot
        const react = this.d.reaction * (aware ? 0.5 : peripheral * moving) * (1 + d / 90);
        if (now - mem.seenSince >= react) {
          let score = d - (this.target === e ? 12 : 0);
          // facing threats first
          const ef = [-Math.sin(e.yaw), -Math.cos(e.yaw)];
          if ((-dx * ef[0] - dz * ef[1]) / (d || 1) > 0.9) score -= 6;
          if (score < bestScore) { bestScore = score; best = e; }
        }
      } else if (mem) {
        if (mem.visible) { mem.prevT = now; }
        mem.visible = false; mem.seenSince = null;
        if (now - mem.t > 10) this.known.delete(e.id);
      }
    }
    // callouts: share freshly spotted enemies with teammates nearby
    this.calloutT = (this.calloutT || 0) - 0.13;
    if (best && this.calloutT <= 0) {
      this.calloutT = 1.5;
      for (const o of m.combatants) {
        if (o === c || !o.brain || !o.alive || o.team !== c.team) continue;
        if (Math.hypot(o.x - c.x, o.z - c.z) > 32) continue;
        const mem = o.brain.known.get(best.id);
        if (!mem || (!mem.visible && now - mem.t > 1)) o.brain.known.set(best.id, { c: best, x: best.x, y: best.y, z: best.z, t: now, visible: false, seenSince: null, heard: true });
      }
    }
    if (best !== this.target) {
      this.target = best;
      this.trackT = 0;
      this.aimHead = Math.random() < this.d.hs;
      this.resampleAim(true);
    }

    // grenade awareness: flee from live frags nearby
    this.flee = null;
    for (const g of m.projectiles.list) {
      if (g.kind !== 'frag' || g.fuse > 2.2) continue;
      const d = Math.hypot(g.x - c.x, g.z - c.z);
      if (d < 5.5 && m.canSee(c.x, eyeY, c.z, g.x, g.y + 0.1, g.z)) {
        this.flee = g;
        break;
      }
    }

    // state machine
    const w = c.weapon;
    const lowHealth = c.health < 45 && now - this.lastDamagedT < 4;
    if (this.flee) {
      if (this.state !== 'flee') { this.state = 'flee'; this.planFlee(); }
    } else if (lowHealth && this.state !== 'cover' && this.d.strafe > 0.5 && Math.random() < 0.7) {
      if (this.planCover()) {
        this.state = 'cover';
        // pop smoke to cover the retreat sometimes
        if (c.tactical.count > 0 && !c.busy && Math.random() < this.d.nade * 1.5 && this.target) {
          const t = this.target;
          const mx = (c.x + t.x) / 2, mz = (c.z + t.z) / 2;
          const sol = solveThrow(c, mx, c.y, mz, EQUIPMENT.smoke.throwSpeed);
          if (sol) { this.lookYaw = sol.yaw; this.lookPitch = sol.pitch; c.cmd.yaw = sol.yaw; c.cmd.pitch = sol.pitch; c.yaw = sol.yaw; c.pitch = sol.pitch; c.cmd.tactical = true; this.throwLock = 0.55; }
        }
      }
    } else if (this.state === 'cover') {
      this.coverT += 0.12;
      if (c.health > 85 || this.coverT > 7 || (this.target && Math.hypot(this.target.x - c.x, this.target.z - c.z) < 8)) {
        this.state = this.target ? 'engage' : 'hunt';
      }
    } else if (this.target) {
      this.state = 'engage';
    } else {
      // most recent knowledge
      let recent = null;
      for (const [, mem] of this.known) {
        if (!mem.c.alive) continue;
        const age = now - mem.t;
        if (age < (mem.heard ? 5 : 8) && (!recent || mem.t > recent.t)) recent = mem;
      }
      const holding = m.mode.holding?.(m, c);
      // inside a contested objective: everyone else in it is known (you can hear them on the point)
      const zone = m.mode.zoneOf?.(m, c);
      if (zone) {
        for (const e of m.combatants) {
          if (e.team === c.team || !e.alive || !inZone(e, zone)) continue;
          const mem = this.known.get(e.id);
          if (!mem || !mem.visible) this.known.set(e.id, { c: e, x: e.x, y: e.y, z: e.z, t: now, visible: false, seenSince: null, heard: true });
        }
      }
      // objective went stale (hardpoint moved / flag captured): re-pick
      if (this.state === 'roam' && this.objGoal && m.mode.botGoal && now > (this.objCheckT || 0)) {
        this.objCheckT = now + 2.5;
        const g = this.goalName || '';
        if ((g.startsWith('hp ') && m.hp && g !== 'hp ' + m.hp.idx) || (g.startsWith('flag ') && !holding && m.flags?.find((f) => 'flag ' + f.id === g)?.owner === c.team && this.waitT <= 0)) this.pickRoamGoal();
      }
      if (recent && holding && now - recent.t > 1 && !(zone && inZone(recent.c, zone))) recent = null; // stay on the objective unless the threat is fresh or on it
      // objective players only chase unseen threats that are close; slayers hunt everything
      if (this.role === undefined) this.role = m.mode.botGoal ? (Math.random() < 0.72 ? 'objective' : 'slayer') : 'slayer';
      if (recent && this.role === 'objective' && Math.hypot(recent.x - c.x, recent.z - c.z) > 16 && !(zone && inZone(recent.c, zone))) recent = null;
      if (recent) {
        if (this.state !== 'hunt' || !this.goal || Math.hypot(this.goal.x - recent.x, this.goal.z - recent.z) > 4) {
          this.state = 'hunt';
          this.setGoal(recent.x, recent.y, recent.z, 'hunt');
        }
        // grenade a target that just ducked out of sight
        this.considerGrenade(recent);
      } else if (this.state !== 'roam' || !this.goal) {
        this.state = 'roam';
        this.pickRoamGoal();
      }
    }
    // reload when idle
    if (!this.target && w.mag < w.def.mag * 0.5 && w.canReload && !w.reloading) c.cmd._wantReload = true;
    // swap back to primary when calm
    if (!this.target && c.cur === 1 && c.weapons[0].mag + c.weapons[0].reserve > 0) c.cmd._wantSwap = true;
  }

  resampleAim(fresh) {
    const t = this.target;
    if (!t) return;
    const d = Math.hypot(t.x - this.c.x, t.z - this.c.z);
    const tSpeed = Math.hypot(t.vx, t.vz);
    const motion = 1 + Math.min(1, tSpeed / 6) * 0.6 + (this.c.speed > 1 ? 0.35 : 0);
    const errDeg = Math.max(this.d.aimErrMin, this.d.aimErr * Math.exp(-this.trackT / this.d.settle)) * motion;
    const mag = Math.tan(errDeg * DEG) * d;
    const a = Math.random() * Math.PI * 2;
    const r = mag * (0.4 + Math.random() * 0.6);
    // offset mostly horizontal + vertical in view plane
    const rx = Math.cos(this.c.yaw), rz = -Math.sin(this.c.yaw);
    this.aimOff = [rx * Math.cos(a) * r, Math.sin(a) * r * 0.8, rz * Math.cos(a) * r];
    this.aimOffT = fresh ? 0.35 : 0.25 + Math.random() * 0.35;
  }

  // ---------------- engagement ----------------
  engage(dt) {
    const c = this.c, cmd = c.cmd, t = this.target, m = this.m;
    if (!t.alive) { this.target = null; return; }
    this.trackT += dt;
    this.aimOffT -= dt;
    if (this.aimOffT <= 0) this.resampleAim(false);
    const w = c.weapon, def = w.def;
    const dx = t.x - c.x, dz = t.z - c.z;
    const dist = Math.hypot(dx, dz);
    const cls = def.class;
    const pref = PREF_RANGE[cls] || PREF_RANGE.assault;

    // aim point
    const aimY = t.y + (this.aimHead ? (t.stance === 'stand' ? 1.58 : 1.05) : (t.stance === 'stand' ? 1.25 : 0.8));
    const ax = t.x + this.aimOff[0] + t.vx * 0.05, ay = aimY + this.aimOff[1], az = t.z + this.aimOff[2] + t.vz * 0.05;
    const ex = ax - c.x, ey = ay - c.eyeY, ez = az - c.z;
    this.lookYaw = Math.atan2(-ex, -ez);
    this.lookPitch = Math.atan2(ey, Math.hypot(ex, ez));

    // ADS decision
    const wantAds = cls === 'sniper' || (cls !== 'shotgun' && dist > 9) || (cls === 'shotgun' && dist > 5 && dist < 11);
    cmd.ads = wantAds;

    // fire decision: aim close enough to the true target and clear line
    const tyaw = Math.atan2(-dx, -dz);
    const tpitch = Math.atan2((t.y + 1.2) - c.eyeY, dist);
    const yawErr = Math.abs(angleDiff(c.yaw, tyaw)), pitchErr = Math.abs(c.pitch - tpitch);
    const tol = Math.max(this.d.fireAngle * DEG, Math.atan2(0.45, dist));
    let fire = yawErr < tol * 1.5 && pitchErr < tol * 2;
    if (cls === 'sniper' && (c.adsT < 0.95 || this.trackT < this.d.settle * 0.8)) fire = false;
    if (cls === 'shotgun' && dist > 18) fire = false;
    if (dist > 60 && cls !== 'sniper' && cls !== 'assault') fire = false;
    // burst discipline at range
    if (fire && def.auto && dist > 18) {
      if (this.pauseT > 0) { this.pauseT -= dt; fire = false; }
      else {
        this.burstT += dt;
        if (this.burstT > 0.25 + this.d.burst * 0.35) { this.burstT = 0; this.pauseT = 0.18 + (1 - this.d.burst) * 0.4; }
      }
    }
    // semi-auto cadence
    if (fire && !def.auto) {
      this.semiT -= dt;
      if (this.semiT > 0) fire = false;
      else this.semiT = Math.max(60 / def.rpm, cls === 'pistol' ? 0.16 + (1 - this.d.burst) * 0.25 : 0.05);
      // release between shots
      if (fire && c.prevCmd.fire) fire = false;
    }
    // don't shoot teammates
    if (fire && this.allyInLine(tyaw, tpitch, dist)) fire = false;
    cmd.fire = fire;

    // ammo management
    if (w.mag === 0) {
      if (c.cur === 0 && dist < 14 && c.weapons[1].mag > 0 && this.d.burst > 0.6) cmd.swap = true;
      else cmd.reload = true;
    }
    if (c.cur === 1 && w.mag === 0 && c.weapons[0].mag > 0) cmd.swap = true;

    // melee when very close
    if (dist < 1.6 && Math.random() < 0.08 * this.d.burst) cmd.melee = true;

    // movement: strafe + range keeping
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 0.45 + Math.random() * 1.0;
      const r = Math.random();
      this.strafe = r < 0.15 * (1 - this.d.strafe) + 0.1 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      this.crouchT = (cls === 'sniper' || (dist > 25 && Math.random() < 0.35 * this.d.strafe)) ? 1.5 + Math.random() * 2 : 0;
    }
    if (this.crouchT > 0) this.crouchT -= dt;
    let mz = 0;
    if (dist > pref[2]) mz = 1;
    else if (dist > pref[1] + 4 && cls !== 'sniper') mz = 0.6;
    else if (dist < pref[0]) mz = -0.8;
    let mx = this.strafe * this.d.strafe;
    // obstacle check on strafe direction
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    if (mx !== 0 && m.world.raycast(c.x, c.y + 0.6, c.z, rx * Math.sign(mx), 0, rz * Math.sign(mx), 1.0, 'solid')) { this.strafe = -this.strafe; mx = -mx; }
    if (mz > 0 && dist > pref[1]) {
      // advance using the nav path toward the target if direct line is blocked
      if (!this.path || this.repathT <= 0) { this.setGoal(t.x, t.y, t.z, 'chase'); this.repathT = 1.0; }
      this.repathT -= dt;
      const dir = this.pathDir();
      if (dir) {
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        mz = dir[0] * fx + dir[1] * fz;
        mx = mx * 0.5 + (dir[0] * rx + dir[1] * rz);
      }
    }
    if (this.crouchT > 0 && dist > 15) { cmd.crouch = true; mx *= 0.4; mz = 0; } else cmd.crouch = false;
    cmd.moveX = clamp(mx, -1, 1); cmd.moveZ = clamp(mz, -1, 1);
    this.separate();
  }

  allyInLine(yaw, pitch, dist) {
    const c = this.c;
    const cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    for (const o of this.m.combatants) {
      if (o === c || !o.alive || o.team !== c.team) continue;
      const h = o.rayHit(c.x, c.eyeY, c.z, dx, dy, dz, dist);
      if (h) return true;
    }
    return false;
  }

  // ---------------- navigation ----------------
  navigate(dt) {
    const c = this.c, cmd = c.cmd, m = this.m;
    cmd.crouch = false;
    if (cmd._wantReload) { cmd.reload = true; cmd._wantReload = false; }
    if (cmd._wantSwap) { cmd.swap = true; cmd._wantSwap = false; }
    if (this.state === 'cover' && this.path && this.pathIdx >= this.path.length) {
      // hold the cover spot, crouched, facing the threat
      cmd.moveX = cmd.moveZ = 0;
      cmd.crouch = true;
      const w = c.weapon;
      if (w.canReload && w.mag < w.def.mag) cmd.reload = true;
      this.lookAtThreat(dt);
      return;
    }
    if (!this.path || this.pathIdx >= (this.path?.length || 0)) {
      if (this.state === 'roam') {
        this.waitT -= dt;
        cmd.moveX = cmd.moveZ = 0;
        this.glance(dt);
        if (this.waitT <= 0) {
          if (this.m.mode.holding?.(this.m, c)) this.waitT = 1.5; // keep capturing / holding the zone
          else this.pickRoamGoal();
        }
        return;
      }
      if (this.state === 'hunt') { this.state = 'roam'; this.waitT = 1 + Math.random() * 1.5; this.path = null; return; }
      if (this.state === 'flee') { this.state = 'roam'; this.path = null; return; }
    }
    const dir = this.pathDir();
    if (!dir) { cmd.moveX = cmd.moveZ = 0; return; }
    // look: along path, toward threats when hunting
    const pathYaw = Math.atan2(-dir[0], -dir[1]);
    if (this.state === 'hunt' && this.goal) {
      const gx = this.goal.x - c.x, gz = this.goal.z - c.z;
      const gd = Math.hypot(gx, gz);
      if (gd < 20) {
        this.lookYaw = Math.atan2(-gx, -gz);
        this.lookPitch = Math.atan2((this.goal.y + 1.3) - c.eyeY, gd);
        cmd.ads = gd < 14 && c.weapon.def.class !== 'shotgun' && Math.random() < 0.97;
      } else { this.lookYaw = pathYaw; this.lookPitch = 0; }
    } else {
      this.lookYaw = pathYaw;
      this.lookPitch *= 0.9;
      this.glance(dt);
    }
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    cmd.moveZ = dir[0] * fx + dir[1] * fz;
    cmd.moveX = dir[0] * rx + dir[1] * rz;
    const remaining = this.goal ? Math.hypot(this.goal.x - c.x, this.goal.z - c.z) : 0;
    // sprint through our own half; walk (alert) in contested space
    const enemySide = c.team === 0 ? c.x > -12 : c.x < 12;
    cmd.sprint = (this.state === 'roam' && (!enemySide || remaining > 22)) && remaining > 6 && c.health > 50 && cmd.moveZ > 0.7;
    if (this.state === 'flee') cmd.sprint = cmd.moveZ > 0.5;
    this.separate();
  }

  glance(dt) {
    this.glanceT -= dt;
    const c = this.c;
    if (this.state === 'roam' && this.waitT > 0 && (!this.path || this.pathIdx >= this.path.length)) {
      // holding a spot: check the most likely approach — toward enemy territory, sweeping a little
      if (this.glanceT <= 0) {
        this.glanceT = 1.2 + Math.random() * 2.0;
        const ex = c.team === 0 ? 40 : -40;
        const base = Math.atan2(-(ex - c.x), -(0 - c.z));
        const pick = Math.random();
        this._holdYaw = pick < 0.6 ? base + (Math.random() - 0.5) * 1.2 : base + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.2);
        // prefer a direction with a long open sightline
        const hit = this.m.world.raycast(c.x, c.eyeY, c.z, -Math.sin(this._holdYaw), 0, -Math.cos(this._holdYaw), 30, 'sight');
        if (hit && hit.t < 3) this._holdYaw += Math.PI * 0.6;
      }
      if (this._holdYaw !== undefined) { this.lookYaw = this._holdYaw; this.lookPitch = 0; }
      return;
    }
    if (this.glanceT <= 0) {
      this.glanceT = 0.8 + Math.random() * 2.2;
      this._glanceOff = (Math.random() - 0.5) * 1.4;
    }
  }

  lookAtThreat(dt) {
    let best = null;
    for (const [, mem] of this.known) if (!best || mem.t > best.t) best = mem;
    if (best) {
      const dx = best.x - this.c.x, dz = best.z - this.c.z;
      this.lookYaw = Math.atan2(-dx, -dz);
      this.lookPitch = 0;
    }
  }

  separate() {
    const c = this.c, cmd = c.cmd;
    for (const o of this.m.combatants) {
      if (o === c || !o.alive) continue;
      const dx = c.x - o.x, dz = c.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.3 && d > 1e-3) {
        const push = (1.3 - d) / 1.3;
        const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        cmd.moveX += ((dx / d) * rx + (dz / d) * rz) * push * 1.5;
        cmd.moveZ += ((dx / d) * fx + (dz / d) * fz) * push * 1.5;
      }
    }
  }

  /** Normalized world-space direction toward the next waypoint, advancing as we arrive. */
  pathDir() {
    const c = this.c;
    if (!this.path) return null;
    while (this.pathIdx < this.path.length) {
      const wp = this.path[this.pathIdx];
      const dx = wp.x - c.x, dz = wp.z - c.z;
      const d = Math.hypot(dx, dz);
      const last = this.pathIdx === this.path.length - 1;
      if (d < (last ? 0.8 : 0.65)) { this.pathIdx++; continue; }
      return [dx / d, dz / d];
    }
    return null;
  }

  setGoal(x, y, z, name) {
    const c = this.c;
    const p = this.m.nav.findPath(c.x, c.y, c.z, x, y, z);
    this.goal = { x, y, z };
    this.goalName = name;
    this.path = p; this.pathIdx = 0;
    if (!p) this.path = null;
    return !!p;
  }

  pickRoamGoal() {
    const m = this.m, c = this.c;
    // objective modes: most of the time head for the objective
    if (m.mode.botGoal && Math.random() < 0.8) {
      const g = m.mode.botGoal(m, this);
      if (g && this.setGoal(g.x, 0, g.z, g.name)) { this.waitT = g.hold ?? 4; this.objGoal = true; return; }
    }
    this.objGoal = false;
    const hs = m.map.hotspots;
    // avoid sending the whole team to the same place
    const taken = new Map();
    for (const o of m.combatants) {
      if (o.brain && o !== c && o.team === c.team && o.brain.goalName) taken.set(o.brain.goalName, (taken.get(o.brain.goalName) || 0) + 1);
    }
    let total = 0;
    const weights = hs.map((h) => {
      const d = Math.hypot(h.x - c.x, h.z - c.z);
      let w = h.weight / (1 + (taken.get(h.name) || 0) * 1.5);
      if (d < 6) w *= 0.1;
      // bias toward the enemy half of the map over time
      const enemySideX = c.team === 0 ? 1 : -1;
      w *= 1 + Math.max(0, h.x * enemySideX) / 60;
      total += w;
      return w;
    });
    // sometimes take a flank lane deep into the enemy half instead
    if (Math.random() < 0.22 * this.d.strafe) {
      const flank = hs.filter((h) => /Alley|Road|Yard/.test(h.name) && (c.team === 0 ? h.x > -5 : h.x < 5));
      if (flank.length) {
        const f = flank[(Math.random() * flank.length) | 0];
        if (this.setGoal(f.x + (Math.random() - 0.5) * 3, 0, f.z, f.name)) { this.waitT = this.d.hold[0] + Math.random() * 2; return; }
      }
    }
    let r = Math.random() * total;
    let pick = hs[0];
    for (let i = 0; i < hs.length; i++) { r -= weights[i]; if (r <= 0) { pick = hs[i]; break; } }
    const jx = pick.x + (Math.random() - 0.5) * 4, jz = pick.z + (Math.random() - 0.5) * 4;
    if (!this.setGoal(jx, 0, jz, pick.name)) this.setGoal(pick.x, 0, pick.z, pick.name);
    this.waitT = this.d.hold[0] + Math.random() * (this.d.hold[1] - this.d.hold[0]);
  }

  planFlee() {
    const c = this.c, g = this.flee;
    let dx = c.x - g.x, dz = c.z - g.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    for (const ang of [0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0]) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const vx = dx * ca - dz * sa, vz = dx * sa + dz * ca;
      if (this.setGoal(c.x + vx * 8, c.y, c.z + vz * 8, 'flee')) return;
    }
  }

  planCover() {
    const c = this.c, m = this.m, nav = m.nav;
    let threat = this.target;
    if (!threat) for (const [, mem] of this.known) if (mem.c.alive && (!threat || mem.t > (threat.t || 0))) threat = mem.c;
    if (!threat) return false;
    const [cx, cz] = nav.cellOf(c.x, c.z);
    let best = null, bd = Infinity;
    for (let dz = -9; dz <= 9; dz += 1) {
      for (let dx = -9; dx <= 9; dx += 1) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= nav.w || z >= nav.h) continue;
        const i = nav.idx(x, z);
        if (!nav.walk[i] || nav.region[i] !== nav.mainRegion || nav.cover[i] === 0) continue;
        const p = nav.center(i);
        const dd = Math.hypot(p.x - c.x, p.z - c.z);
        if (dd > 10 || dd > bd) continue;
        // hidden from the threat at crouch height?
        if (m.canSee(threat.x, threat.eyeY ?? threat.y + 1.6, threat.z, p.x, p.y + 1.0, p.z)) continue;
        // farther from the threat than we are now, or at least not much closer
        const tdNow = Math.hypot(threat.x - c.x, threat.z - c.z), td = Math.hypot(threat.x - p.x, threat.z - p.z);
        if (td < tdNow - 4) continue;
        bd = dd; best = p;
      }
    }
    if (!best) return false;
    this.coverT = 0;
    return this.setGoal(best.x, best.y, best.z, 'cover');
  }

  considerGrenade(mem) {
    const c = this.c, m = this.m;
    if (this.nadeCd > 0) { this.nadeCd -= 0.12; return; }
    if (c.lethal.count <= 0 || c.busy) return;
    const age = m.time - mem.t;
    if (age > 3.5) return;
    const dx = mem.x - c.x, dz = mem.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 9 || d > 26) return;
    if (Math.random() > this.d.nade * 3.5) { this.nadeCd = 2; return; }
    // teammates near the landing spot?
    for (const o of m.combatants) if (o.team === c.team && o.alive && Math.hypot(o.x - mem.x, o.z - mem.z) < 7) return;
    const sol = solveThrow(c, mem.x, mem.y + 0.3, mem.z, EQUIPMENT.frag.throwSpeed);
    if (!sol) return;
    this.lookYaw = sol.yaw; this.lookPitch = sol.pitch;
    c.cmd.yaw = sol.yaw; c.cmd.pitch = sol.pitch;
    c.yaw = sol.yaw; c.pitch = sol.pitch;
    c.cmd.lethal = true;
    this.throwLock = 0.55;
    this.nadeCd = 12 + Math.random() * 10;
  }

  // ---------------- motor ----------------
  turn(dt) {
    const c = this.c, cmd = c.cmd;
    const rate = this.d.turn * (this.state === 'engage' ? 1 : 0.7);
    const dy = angleDiff(cmd.yaw, this.lookYaw);
    const stepY = Math.sign(dy) * Math.min(Math.abs(dy), Math.max(rate * dt * Math.min(1, Math.abs(dy) * 3 + 0.25), 0));
    let yaw = cmd.yaw + stepY;
    let pitch = cmd.pitch;
    // recoil kicks the bot's aim like anyone else's
    if (c.recoilImpulse) { pitch += c.recoilImpulse.v; yaw += c.recoilImpulse.h; c.recoilImpulse = null; }
    const dp = this.lookPitch - pitch;
    pitch += Math.sign(dp) * Math.min(Math.abs(dp), rate * 0.7 * dt * Math.min(1, Math.abs(dp) * 3 + 0.25));
    cmd.yaw = yaw; cmd.pitch = clamp(pitch, -1.3, 1.3);
  }

  checkStuck(dt) {
    const c = this.c, cmd = c.cmd;
    this.stuckT += dt;
    if (this.stuckT < 1.0) return;
    const moved = Math.hypot(c.x - this.lastX, c.z - this.lastZ);
    const wanted = Math.abs(cmd.moveX) + Math.abs(cmd.moveZ) > 0.5;
    this.stuckT = 0; this.lastX = c.x; this.lastZ = c.z;
    if (wanted && moved < 0.35 && c.stance !== 'crouch') {
      this.stuckN++;
      this.jumpPulse = true;
      if (this.stuckN >= 2 && this.goal) this.setGoal(this.goal.x, this.goal.y, this.goal.z, this.goalName);
      if (this.stuckN >= 4) { this.stuckN = 0; this.state = 'roam'; this.pickRoamGoal(); this.strafe = -this.strafe; }
    } else this.stuckN = 0;
  }
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/** Find a throw pitch that lands a grenade near the target (no-bounce ballistic). */
export function solveThrow(c, tx, ty, tz, speed) {
  const dx = tx - c.x, dz = tz - c.z;
  const D = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz);
  let best = null, be = Infinity;
  for (let p = -0.3; p <= 1.1; p += 0.02) {
    const vh = Math.cos(p) * speed, vy = Math.sin(p) * speed + 3.2;
    const t = D / vh;
    const y = c.eyeY + vy * t - 0.5 * 19 * t * t;
    const err = Math.abs(y - ty);
    if (err < be) { be = err; best = p; }
  }
  if (be > 1.5) return null;
  return { yaw, pitch: best };
}
