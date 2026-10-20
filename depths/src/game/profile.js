/**
 * Profile: everything that persists across campaigns. Merged monotonically:
 * collecting a record can add completion but never remove it.
 */
import { load, save } from '../core/storage.js';
import { ACHIEVEMENTS, FINISHES, ENDINGS } from '../data/achievements.js';
import { RECORD_IDS } from '../data/records.js';

const DEFAULT = {
  v: 1, records: {}, secrets: {}, evidence: {}, achievements: {}, endings: {}, refuges: {}, finishes: { default: true }, finish: 'default',
  chapters: {}, expedition: { runs: [], completed: 0 }, stats: { photos: 0, deaths: 0 }, seenContentNote: false, introDone: false,
};

export class Profile {
  constructor() {
    const s = load('profile', null);
    this.data = { ...structuredClone(DEFAULT), ...(s && typeof s === 'object' ? s : {}) };
    for (const k of Object.keys(DEFAULT)) if (typeof DEFAULT[k] === 'object' && typeof this.data[k] !== 'object') this.data[k] = structuredClone(DEFAULT[k]);
    this.listeners = [];
  }
  persist() { return save('profile', this.data); }
  on(fn) { this.listeners.push(fn); }
  _emit(kind, data) { for (const f of this.listeners) f(kind, data); }

  unlock(id) {
    if (this.data.achievements[id]) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    this.data.achievements[id] = Date.now();
    this._emit('achievement', a);
    if (id === 'A12') this.grantFinish('poolBlue');
    if (id === 'A11') this.grantFinish('courierRed');
    if (id === 'A17') this.grantFinish('maintenanceOrange');
    this.persist();
    return true;
  }
  grantFinish(id) { if (!this.data.finishes[id]) { this.data.finishes[id] = true; const f = FINISHES.find((x) => x.id === id); this._emit('finish', f); this.persist(); } }

  /** Apply a 'profile' event from the simulation. */
  apply(ev) {
    const d = this.data;
    switch (ev.kind) {
      case 'record': if (!d.records[ev.id]) { d.records[ev.id] = { ch: ev.ch, room: ev.room, t: Date.now() }; if (RECORD_IDS.every((r) => d.records[r])) this.unlock('A11'); } break;
      case 'secret': d.secrets[ev.id] = true; if (['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].every((s) => d.secrets[s])) this.unlock('A12'); break;
      case 'evidence': d.evidence[ev.id] = true; if (['E1', 'E2', 'E3', 'E4'].every((e) => d.evidence[e])) this.unlock('A09'); break;
      case 'refuge': d.refuges[ev.id] = true; if (Object.keys(d.refuges).filter((k) => !k.startsWith('x')).length >= 12) this.unlock('A10'); break;
      case 'chapter': d.chapters[ev.id] = true; this.unlock(['A01', 'A02', 'A03', 'A04', 'A05'][ev.id - 1]); break;
      case 'ending': {
        d.endings[ev.id] = true;
        const E = ENDINGS[ev.id];
        if (E) { this.unlock(E.ach); this.grantFinish(E.finish); }
        if (d.endings.familiar && d.endings.door && d.endings.cut) this.unlock('A18');
        break;
      }
      case 'achievement': this.unlock(ev.id); break;
      default: break;
    }
    this.persist();
  }

  get expeditionUnlocked() { return Object.keys(this.data.endings).length > 0; }
  get chapterSelectUnlocked() { return Object.keys(this.data.chapters).length > 0; }
}
