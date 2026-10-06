/**
 * The city remembers you.
 *
 *  - Police keep a DESCRIPTION after they've seen you during a crime: what
 *    the person was wearing and the car they drove. While it's fresh, an
 *    officer who gets a good look at a match may recognise you even with no
 *    stars — change clothes (Threads on 5th) or respray the car (Coral Auto
 *    Body) to shake it.
 *  - NOTORIETY per area rises with witnessed and reported crimes and fades
 *    slowly. High notoriety: people recognise you in the street, film you
 *    and post it to LOOP, and at the top end call it in.
 *  - A NICKNAME forms from what you do most and where (LOOP uses it).
 *  - PEOPLE remember Cal and Sol separately: the clerk you robbed, the
 *    gunsmith whose regular you are, the bouncer who's seen you on LOOP.
 *  - GRUDGES: after "Low Tide" the Caldera crew comes looking now and then.
 *
 * All of it is saved. These are this prototype's own rules.
 */
import { roadAt, KEYS, ISLAND } from '../world/layout.js';
import { spawnRivalCar } from '../ai/rivals.js';
import { laneLine } from '../ai/driver.js';
import { ROAD_GRAPH } from '../world/layout.js';

const COLOR_NAMES = [
  ['white', 0xf2f2f2], ['cream', 0xe9e2d0], ['black', 0x1c1c1c], ['grey', 0x8b8f94], ['red', 0xb5332e], ['pink', 0xe86b9a],
  ['coral', 0xd94f70], ['orange', 0xf2a03d], ['yellow', 0xe8b83a], ['green', 0x2f6b3a], ['teal', 0x2bb8c9], ['blue', 0x3a6fd1],
  ['navy', 0x2e3b55], ['purple', 0x6f5bd6], ['brown', 0x7a5a3a], ['light blue', 0x8fb7c9], ['beige', 0xd9d4c7],
];
export function colorName(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  let best = 'dark', bd = Infinity;
  for (const [n, c] of COLOR_NAMES) { const d = (r - ((c >> 16) & 255)) ** 2 + (g - ((c >> 8) & 255)) ** 2 + (b - (c & 255)) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

const NICK_NOUN = { carjack: 'Carjacker', robbery: 'Bandit', shooting: 'Shooter', murder: 'Menace', hitAndRun: 'Road Rager', assault: 'Brawler', vehicleTheft: 'Car Thief', assaultOfficer: 'Cop Fighter', officerDown: 'Cop Killer', brandish: 'Gun Waver' };
export const DESCRIPTION_TIME = 600; // seconds (ten in-game hours)

export function defaultMemory() {
  return { notoriety: { 'Ocean Mile': 0, 'Cayo Lento': 0 }, crimes: {}, description: null, nickname: null, people: {}, grudges: { calderas: false }, sightings: [] };
}

export class Memory {
  constructor(game) {
    this.game = game;
    this.state = defaultMemory();
    this.suspicion = 0;
    this.huntT = 200 + Math.random() * 200;
    this.hunt = null;
    this.spotT = 20;
    this.bind();
  }

  /** Area name for notoriety. */
  area(x, z) { return z > KEYS.z0 - 40 ? 'Cayo Lento' : 'Ocean Mile'; }
  street(x, z) { const r = roadAt(x, z); return r ? r.name : z > KEYS.z0 - 8 ? KEYS.name : x > ISLAND.sandStart ? 'the beach' : 'Ocean Mile'; }
  notoriety(x, z) { return this.state.notoriety[this.area(x, z)] || 0; }
  bump(x, z, amount) { const a = this.area(x, z); this.state.notoriety[a] = Math.min(100, (this.state.notoriety[a] || 0) + amount); }

  /** What the player looks like right now (for descriptions and matching). */
  look() {
    const p = this.game.player, v = p.vehicle;
    return {
      who: p.protagonist, person: p.look.female ? 'woman' : 'man', outfit: colorName(p.look.top),
      vehicle: v ? { id: v.persistentId || v.id, model: v.def.name, color: colorName(v.color), plate: v.plate } : null,
    };
  }

  /** "a man in a cream top driving a red Ironhorse 455 (plate ...)" */
  describe(d = this.state.description) {
    if (!d) return null;
    return `a ${d.person} in a ${d.outfit} top${d.vehicle ? `, driving a ${d.vehicle.color} ${d.vehicle.model}` : ''}`;
  }

  bind() {
    const g = this.game, ev = g.events;
    ev.on('crimeReported', ({ crimeId, x, z, by, level }) => {
      const st = this.state;
      st.crimes[crimeId] = (st.crimes[crimeId] || 0) + 1;
      this.bump(x, z, 4 + level * 4);
      this.sighting(x, z, crimeId);
      // police who saw it (or a robbery alarm with the clerk's account) give out a description
      if (by === 'police' || level >= 2) {
        const now = this.look();
        const prev = st.description;
        st.description = { ...now, vehicle: now.vehicle || (prev && prev.who === now.who ? prev.vehicle : null), until: g.time + DESCRIPTION_TIME, crime: crimeId };
        if (!prev || prev.outfit !== now.outfit) g.events.emit('descriptionIssued', st.description);
      }
      this.updateNickname(x, z);
    });
    ev.on('witnessCall', ({ x, z }) => this.bump(x, z, 3));
    ev.on('missionPassed', ({ def }) => { if (def.id === 'low_tide') { this.state.grudges.calderas = true; this.huntT = 240 + Math.random() * 180; } });
  }

  sighting(x, z, what) {
    const s = this.state.sightings;
    s.unshift({ x: Math.round(x), z: Math.round(z), place: this.street(x, z), what, t: Math.round(this.game.time), who: this.game.player.protagonist });
    s.length = Math.min(s.length, 12);
  }

  updateNickname(x, z) {
    const st = this.state;
    const total = Object.values(st.crimes).reduce((a, b) => a + b, 0);
    if (st.nickname || total < 3) return;
    const top = Object.entries(st.crimes).sort((a, b) => b[1] - a[1])[0][0];
    const place = st.sightings.find((s) => s.what === top)?.place || this.street(x, z);
    st.nickname = `the ${place.replace(/^the /, '')} ${NICK_NOUN[top] || 'Outlaw'}`.replace(/\b\w/g, (c, i) => (i === 0 ? c : c.toUpperCase()));
    this.game.events.emit('nickname', st.nickname);
  }

  /** Does what the police have match the player right now? (0 = no, 1 = clear match) */
  matchScore() {
    const d = this.state.description;
    if (!d || this.game.time > d.until) return 0;
    const now = this.look();
    if (now.vehicle && d.vehicle) return now.vehicle.id === d.vehicle.id && now.vehicle.color === d.vehicle.color ? 1 : 0;
    if (now.vehicle) return 0; // in a car they don't know: they can't see your shirt
    return now.outfit === d.outfit && now.who === d.who ? 1 : 0;
  }

  // ------------------------------------------------------------ people
  person(id) {
    const who = this.game.player.protagonist;
    const p = this.state.people[id] || (this.state.people[id] = {});
    return p[who] || (p[who] = { visits: 0, robbed: 0, trouble: 0, last: null });
  }
  visit(id) { const p = this.person(id); p.visits++; p.last = Math.round(this.game.time); return p; }

  // ------------------------------------------------------------ per step
  step(dt) {
    const g = this.game, st = this.state;
    for (const k of Object.keys(st.notoriety)) st.notoriety[k] = Math.max(0, st.notoriety[k] - dt * 0.012);
    if (st.description && g.time > st.description.until) { st.description = null; g.events.emit('descriptionExpired'); }
    this.stepRecognition(dt);
    this.stepStreetFame(dt);
    this.stepHunt(dt);
  }

  /** An officer gets a good look at someone matching the description. */
  stepRecognition(dt) {
    const g = this.game, p = g.player;
    if (g.wanted.level > 0 || p.dead || !this.state.description) { this.suspicion = 0; return; }
    const m = this.matchScore();
    const pp = p.vehicle ? p.vehicle.pos : p.pos;
    const close = m > 0 && g.cops.some((c) => !c.dead && Math.hypot((c.vehicle || c).pos.x - pp.x, (c.vehicle || c).pos.z - pp.z) < (p.vehicle ? 18 : 14) && g.police.copSees(c, pp.x, pp.y + 1, pp.z, 20));
    this.suspicion = close ? this.suspicion + dt : Math.max(0, this.suspicion - dt * 0.5);
    this.recognising = this.suspicion > 0.3;
    if (this.suspicion > 2.5) {
      this.suspicion = 0;
      g.wanted.report('recognized', pp.x, pp.z, 'police');
      g.hud?.notify(`An officer matched you to the description: ${this.describe()}.`, 'Police', 'warn', 6);
    }
  }

  /** Locals who've seen you on LOOP point you out, film you, and at worst call it in. */
  stepStreetFame(dt) {
    const g = this.game, p = g.player;
    this.spotT -= dt;
    if (this.spotT > 0 || p.vehicle || p.dead || g.missions.cutscene) return;
    this.spotT = 2;
    const fame = this.notoriety(p.pos.x, p.pos.z);
    if (fame < 30 || !this.state.nickname) return;
    const ped = g.peds.find((c) => !c.dead && !c.vehicle && c.role === 'ped' && c.controller?.state && !['flee', 'cower', 'call', 'fight', 'surrender'].includes(c.controller.state) && c.distanceTo(p.pos.x, p.pos.z) < 11 && g.peds_?.canSee(c, p.pos.x, p.pos.z));
    if (!ped || Math.random() > fame / 140) return;
    this.spotT = 35;
    ped.controller.setState('watch', 4); ped.controller.focus = p.pos; ped.anim_.phone = true;
    g.social?.spotted(ped, p, this.state.nickname);
    if (fame > 70 && Math.random() < 0.5) g.wanted.startCall(ped, 'recognized', p.pos.x, p.pos.z);
  }

  /** The Calderas, after "Low Tide": now and then a car of them comes looking. */
  stepHunt(dt) {
    const g = this.game;
    if (this.hunt) {
      const h = this.hunt;
      h.t += dt;
      const alive = h.crew.some((c) => !c.dead && !c.removed);
      const pp = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
      const far = Math.hypot(h.vehicle.pos.x - pp.x, h.vehicle.pos.z - pp.z) > 320;
      // a timed-out hunt only ends once none of them is on screen (no vanishing mid-fight)
      const seen = h.t > 180 && [h.vehicle, ...h.crew].some((o) => !o.removed && g.traffic?.visible(o.pos.x, (o.pos.y || 0) + 1, o.pos.z, 3));
      if (!alive || (h.t > 180 && !seen) || far || g.player.dead) {
        if (!alive) g.social?.post({ handle: 'OceanMileNow', name: 'Ocean Mile Now', color: '#ff4d6d', verified: true, text: 'Two men linked to the Caldera family were found injured after a shootout in Ocean Mile. No arrests.', about: true, likes: 80 });
        this.endHunt();
      }
      return;
    }
    if (!this.state.grudges.calderas || g.missions.active || g.wanted.level > 0) return;
    this.huntT -= dt;
    if (this.huntT > 0) return;
    this.huntT = 300 + Math.random() * 300;
    this.startHunt();
  }

  startHunt() {
    const g = this.game, pp = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const { edges } = ROAD_GRAPH;
    for (let k = 0; k < 30; k++) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      const from = Math.random() < 0.5 ? e.a : e.b, l = laneLine(e, from, 0), t = 0.2 + Math.random() * 0.6;
      const x = l.x0 + (l.x1 - l.x0) * t, z = l.z0 + (l.z1 - l.z0) * t, d = Math.hypot(x - pp.x, z - pp.z);
      if (d < 110 || d > 200 || g.traffic?.visible(x, 1, z, 5) || g.vehicles.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 12)) continue;
      const r = spawnRivalCar(g, 'pickup', x, z, Math.atan2(l.dx, l.dz), 0x1a1a1a, { x: pp.x, z: pp.z });
      for (const c of r.crew) c.controller.alerted = true;
      this.hunt = { ...r, t: 0 };
      const d0 = this.state.description, car = this.look().vehicle || d0?.vehicle;
      g.social?.post({ handle: 'calle_caldera', name: 'calle', color: '#1a1a1a', text: car ? `anybody seen a ${car.color} ${car.model} around ${this.street(pp.x, pp.z)}? asking for my brothers 🙂` : `looking for a couple. he's tall, she talks a lot. Ocean Mile. 🙂`, about: true, likes: 3 });
      g.hud?.notify('A Caldera truck is cruising the area, looking for you.', 'Heads up', 'warn', 6);
      return;
    }
  }

  endHunt() {
    const g = this.game, h = this.hunt;
    this.hunt = null;
    if (!h) return;
    for (const c of h.crew) if (!c.removed) g.removeCharacter(c);
    if (g.vehicles.includes(h.vehicle) && !h.vehicle.seats.includes(g.player) && !h.vehicle.seats.includes(g.partner)) g.removeVehicle(h.vehicle);
  }

  dispose() { this.endHunt(); }

  // ------------------------------------------------------------ save
  snapshot() {
    const st = JSON.parse(JSON.stringify(this.state));
    if (st.description) st.description.left = Math.max(0, Math.round(st.description.until - this.game.time));
    return st;
  }
  apply(s) {
    if (!s) return;
    this.state = { ...defaultMemory(), ...s, notoriety: { ...defaultMemory().notoriety, ...(s.notoriety || {}) } };
    if (this.state.description) this.state.description.until = this.game.time + (this.state.description.left || 0);
  }
}

/** Clean saved memory (bad data → defaults). */
export function sanitizeMemory(m) {
  const d = defaultMemory();
  if (!m || typeof m !== 'object') return d;
  const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : a);
  for (const k of Object.keys(d.notoriety)) d.notoriety[k] = num(m.notoriety?.[k], 0, 100);
  if (m.crimes && typeof m.crimes === 'object') for (const [k, v] of Object.entries(m.crimes)) if (/^[a-zA-Z]{1,24}$/.test(k)) d.crimes[k] = Math.round(num(v, 0, 1e6));
  if (typeof m.nickname === 'string' && m.nickname.length < 60) d.nickname = m.nickname;
  d.grudges.calderas = m.grudges?.calderas === true;
  if (m.people && typeof m.people === 'object') {
    for (const [id, who] of Object.entries(m.people)) {
      if (!/^[a-z_]{1,24}$/.test(id) || !who || typeof who !== 'object') continue; // (ids: clerk, gunshop, clubbar, ...)
      d.people[id] = {};
      for (const w of ['cal', 'sol']) {
        const r = who[w];
        if (!r || typeof r !== 'object') continue;
        const o = { visits: Math.round(num(r.visits, 0, 1e5)), robbed: Math.round(num(r.robbed, 0, 1e5)), trouble: Math.round(num(r.trouble, 0, 1e5)), last: null };
        // what particular people remember (the auto shop's resprays, the club's regulars)
        for (const k of ['resprays', 'drinks', 'tips', 'rains', 'rounds']) if (r[k] !== undefined) o[k] = Math.round(num(r[k], 0, 1e5));
        if (r.vip === true) o.vip = true;
        if (typeof r.usual === 'string' && /^[a-zA-Z ]{1,24}$/.test(r.usual)) o.usual = r.usual;
        if (r.requests && typeof r.requests === 'object') { o.requests = {}; for (const k of ['house', 'dembow', 'synth']) if (r.requests[k] !== undefined) o.requests[k] = Math.round(num(r.requests[k], 0, 1e5)); }
        d.people[id][w] = o; // (a ban's timestamp isn't kept: it's served by the next session)
      }
    }
  }
  const ds = m.description;
  if (ds && typeof ds === 'object' && typeof ds.outfit === 'string' && ['man', 'woman'].includes(ds.person) && ['cal', 'sol'].includes(ds.who)) {
    d.description = { who: ds.who, person: ds.person, outfit: ds.outfit.slice(0, 20), crime: String(ds.crime || '').slice(0, 24), left: num(ds.left, 0, DESCRIPTION_TIME), vehicle: null };
    const v = ds.vehicle;
    if (v && typeof v === 'object') d.description.vehicle = { id: String(v.id).slice(0, 40), model: String(v.model).slice(0, 40), color: String(v.color).slice(0, 20), plate: String(v.plate || '').slice(0, 12) };
  }
  if (Array.isArray(m.sightings)) d.sightings = m.sightings.slice(0, 12).filter((s) => s && typeof s.place === 'string').map((s) => ({ x: num(s.x, -2000, 2000), z: num(s.z, -2000, 2000), place: s.place.slice(0, 40), what: String(s.what).slice(0, 24), t: 0, who: s.who === 'sol' ? 'sol' : 'cal' }));
  return d;
}
