/**
 * Per-weapon runtime state: ammo, fire timing, reload (magazine or tube),
 * bolt/pump cycling and spread bloom. Shared by players and bots.
 */
export class WeaponState {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.reserve = def.reserve;
    this.cool = 0; // seconds until next shot allowed
    this.reloading = false;
    this.reloadT = 0; // elapsed in current reload stage
    this.reloadDur = 0;
    this.tubeStage = null; // 'start' | 'shell' | 'end'
    this.bloom = 0; // degrees
    this.cycleT = 0; // bolt/pump animation timer (visual + blocks fire)
    this.lastShot = -10;
    this.burstLeft = 0;
    this.events = [];
  }

  get id() { return this.def.id; }
  get empty() { return this.mag <= 0; }
  get canReload() { return !this.def.melee && !this.reloading && this.mag < this.def.mag && this.reserve > 0; }
  get interval() { return 60 / this.def.rpm; }
  /** Fraction of reload complete (for UI/animation). */
  get reloadProgress() {
    if (!this.reloading) return 0;
    if (this.def.tube) return 0.5;
    return Math.min(1, this.reloadT / this.reloadDur);
  }

  refill() {
    this.mag = this.def.mag;
    this.reserve = this.def.reserve;
    this.cancelReload();
    this.cool = 0; this.bloom = 0; this.cycleT = 0;
  }

  startReload(speedMul = 1) {
    if (!this.canReload) return false;
    this.reloading = true;
    this.reloadT = 0;
    if (this.def.tube) {
      this.tubeStage = 'start';
      this.reloadDur = this.def.tube.start;
    } else {
      this.reloadDur = (this.mag === 0 ? this.def.reloadEmpty : this.def.reload) / speedMul;
    }
    this.events.push('reloadStart');
    return true;
  }

  cancelReload() {
    if (!this.reloading) return;
    this.reloading = false;
    this.tubeStage = null;
    this.reloadT = 0;
  }

  /** Is a shot possible right now (ignores owner state such as sprinting)? */
  ready() {
    if (this.cool > 0 || this.cycleT > 0) return false;
    if (this.mag <= 0) return false;
    if (this.reloading) {
      // a tube-fed weapon can interrupt its reload to fire a loaded shell
      if (this.def.tube && this.mag > 0) return true;
      return false;
    }
    return true;
  }

  /** Consume a round. Returns true when the shot happens. */
  fire(now) {
    if (!this.ready()) return false;
    if (this.reloading) this.cancelReload();
    this.mag -= 1;
    this.cool = this.interval;
    this.lastShot = now;
    const sp = this.def.spread;
    this.bloom = Math.min(sp.bloomMax, this.bloom + sp.bloom);
    if (this.def.bolt || this.def.pump) this.cycleT = 0; // cycling is folded into fire interval
    this.events.push('fire');
    return true;
  }

  update(dt) {
    if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    if (this.cycleT > 0) this.cycleT = Math.max(0, this.cycleT - dt);
    const sp = this.def.spread;
    if (this.cool <= 0 && this.bloom > 0) this.bloom = Math.max(0, this.bloom - sp.recover * dt);
    if (!this.reloading) return;
    this.reloadT += dt;
    if (this.reloadT < this.reloadDur) return;
    if (this.def.tube) {
      const t = this.def.tube;
      if (this.tubeStage === 'start') {
        this.tubeStage = 'shell'; this.reloadT = 0; this.reloadDur = t.perShell;
      } else if (this.tubeStage === 'shell') {
        if (this.reserve > 0 && this.mag < this.def.mag) {
          this.mag++; this.reserve--;
          this.events.push('shellIn');
        }
        this.reloadT = 0;
        if (this.mag >= this.def.mag || this.reserve <= 0) { this.tubeStage = 'end'; this.reloadDur = t.end; }
      } else {
        this.reloading = false; this.tubeStage = null;
        this.events.push('reloadEnd');
      }
    } else {
      const need = this.def.mag - this.mag;
      const n = Math.min(need, this.reserve);
      this.mag += n; this.reserve -= n;
      this.reloading = false;
      this.events.push('reloadEnd');
    }
  }
}
