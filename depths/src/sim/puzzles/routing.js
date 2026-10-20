/**
 * P4 Route the closing announcement: four speaker zones and a PLAY button.
 * Displays return to the last active store speaker they hear. Toggling a
 * zone gives a test tone and zone light. The twelve second announcement can
 * be replayed after a fifteen second cooldown; a wrong choice never springs
 * an untelegraphed chase.
 */
import { Puzzle } from './base.js';

const ZONES = [
  { id: 'atrium', label: 'ATRIUM' },
  { id: 'west', label: 'WEST SHOPS' },
  { id: 'delivery', label: 'DELIVERY GALLERY' },
  { id: 'service', label: 'SERVICE EXIT' },
];

export class RoutingPuzzle extends Puzzle {
  initial() { return { atrium: true, west: false, delivery: false, service: true, playing: 0, cooldown: 0, plays: 0 }; }

  act(p, act) {
    const s = this.state;
    if (act.startsWith('zone:')) {
      const z = act.slice(5);
      if (s.playing > 0) return { ok: false, msg: 'Wait for the announcement to finish.' };
      s[z] = !s[z];
      this.game.fx('zoneTest', { zone: z, on: s[z] });
      return { ok: true, msg: `${ZONES.find((x) => x.id === z).label}: test tone · ${s[z] ? 'enabled' : 'disabled'}`, sound: 'tone' };
    }
    if (act === 'play') {
      if (s.playing > 0) return { ok: false, msg: 'Announcement in progress.' };
      if (s.cooldown > 0) return { ok: false, msg: `Amplifier cooling down: ${Math.ceil(s.cooldown)} s.` };
      s.playing = 12; s.plays++;
      const on = ZONES.filter((z) => s[z.id]).map((z) => z.id);
      this.game.fx('announcement', { zones: on });
      const success = s.west && !s.atrium && !s.delivery && !s.service;
      this.pendingSuccess = success;
      if (this.def.onPlay) this.def.onPlay(this, on, success, p);
      return { ok: true, msg: 'Playing the closing announcement…', sound: 'success' };
    }
    return { ok: false };
  }

  update(dt) {
    const s = this.state;
    if (s.playing > 0) {
      s.playing -= dt;
      if (s.playing <= 0) {
        s.playing = 0; s.cooldown = 15;
        if (this.pendingSuccess && !this.done) this.complete(this.game.players.get(this.reservedBy) || null);
        else if (this.def.onEnd) this.def.onEnd(this);
      }
    } else if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
  }

  view() {
    const s = this.state;
    const controls = ZONES.map((z) => ({ id: `zone:${z.id}`, label: z.label, sub: s[z.id] ? 'enabled' : 'disabled', state: s[z.id] ? 'on' : 'off', kind: 'toggle' }));
    controls.push({ id: 'play', label: 'PLAY', sub: '12 s closing announcement', kind: 'button', state: s.playing > 0 ? 'on' : 'off', wide: true, disabled: s.playing > 0 || s.cooldown > 0 });
    const display = this.done ? 'SERVICE EXIT CLEAR' : s.playing > 0 ? `ANNOUNCING · ${Math.ceil(s.playing)} s` : s.cooldown > 0 ? `COOLDOWN · ${Math.ceil(s.cooldown)} s` : `ZONES: ${ZONES.filter((z) => s[z.id]).map((z) => z.label).join(' · ') || 'NONE'}`;
    return { title: this.title, done: this.done, message: this.message, instructions: this.def.instructions, display, controls };
  }
  serialize() { const o = super.serialize(); o.state.playing = 0; return o; }
}
