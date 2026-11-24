// The park day, as you see it: the PA announcements as the day goes (early
// entry, opening, the 15-minute warning, closing), the status by the clock
// (with a skip to the morning while the park's shut), the front gate rolled
// shut overnight, red CLOSED chains across the ride entrances when a ride
// isn't open, roll-down shutters on the shops and restaurants (up as the
// cast open them in the morning, down after closing), cars arriving only
// while the park's open - and security walking anyone still inside out to
// the gate after closing (or anyone who slips in overnight).
import * as THREE from 'three';
import * as Clock from './clock.js';
import { HOURS, phaseAt } from './parkhours.js';

export const GATE = { x0: -26, x1: 26, z: 281.5 }; // the front gate, between the ticket towers
export const CAST_DOOR = { x: -62, y: 0.42, z: 275 }; // the cast members' door, in the front wall west of the gate
const OUTSIDE = new THREE.Vector3(0, 3, 300); // where security leaves you
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

function labelTexture(lines, bg, fg, w = 256, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([t, size], i) => { g.font = `900 ${size}px system-ui, sans-serif`; g.fillText(t, w / 2, (h * (i + 0.5)) / lines.length); });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stripesTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 64; y += 8) { g.fillStyle = '#8a8e96'; g.fillRect(0, y, 8, 5); g.fillStyle = '#5a5e66'; g.fillRect(0, y + 5, 8, 3); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the cast members' door (static parts, built with the park)
export function buildCastDoor(data, helpers) {
  const { add, sign } = helpers(data);
  for (const z of [278.9, 281.1]) {
    add([4, 7.4, 0.15], [CAST_DOOR.x, 3.7, z], 0x3a4048, 'Metal', { collide: 0 });
    add([0.3, 7.8, 0.3], [CAST_DOOR.x - 2.15, 3.9, z], 0x1c1c20, 'Metal', { collide: 0 });
    add([0.3, 7.8, 0.3], [CAST_DOOR.x + 2.15, 3.9, z], 0x1c1c20, 'Metal', { collide: 0 });
    add([4.6, 0.3, 0.3], [CAST_DOOR.x, 7.85, z], 0x1c1c20, 'Metal', { collide: 0 });
    sign([4.4, 1.1, 0.1], [CAST_DOOR.x, 8.8, z + (z < 280 ? -0.1 : 0.1)], 0x16223a, z < 280 ? 'Front' : 'Back', [['CAST MEMBERS ONLY', 0, 0, 1, 1, 0xf0c440, 'GothamBold']]);
  }
}

export class ParkDay {
  constructor({ scene, data, sim, nav, player, hooks }) {
    this.scene = scene;
    this.data = data;
    this.sim = sim;
    this.nav = nav;
    this.player = player;
    this.hooks = hooks; // { toast, say, fireworks, entrance }
    this.phase = null;
    this.said = new Set();
    this.escortAt = 0;
    this.buildProps();
    this.buildHud();
  }

  // ------------------------------------------------------------- props
  buildProps() {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    // red CLOSED chains across the ride entrances
    const rides = this.data.config.Rides;
    this.chains = [];
    for (const cfg of rides) {
      const r = this.data.rides.find((x) => x.id === cfg.id);
      const q = r?.queue;
      const gate = q?.gate ? { x: q.gate[0], z: q.gate[1], y: q.floor ?? cfg.entrance[1] ?? 0, dx: q.gateDir[0], dz: q.gateDir[1] } : cfg.entrance ? { x: cfg.entrance[0], z: cfg.entrance[2], y: cfg.entrance[1] || 0, dx: 0, dz: 1 } : null;
      if (!gate) continue;
      const y = Math.max(gate.y, this.nav ? this.nav.floorAt(gate.x, gate.z) : gate.y);
      this.chains.push({ id: cfg.id, ...gate, y });
    }
    const n = this.chains.length;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 });
    const chainMat = new THREE.MeshStandardMaterial({ color: 0xd01818, roughness: 0.5 });
    const signMat = new THREE.MeshStandardMaterial({ map: labelTexture([['CLOSED', 64]], '#c81818', '#ffffff'), roughness: 0.6 });
    this.posts = new THREE.InstancedMesh(unit, postMat, n * 2);
    this.chainBars = new THREE.InstancedMesh(unit, chainMat, n);
    this.signs = new THREE.InstancedMesh(unit, signMat, n);
    for (const m of [this.posts, this.chainBars, this.signs]) { m.frustumCulled = false; m.castShadow = false; this.scene.add(m); }
    this.chainOn = new Array(n).fill(null);
    // roll-down shutters over the shop and restaurant fronts
    const venues = this.data.config.Venues;
    this.shutterMat = new THREE.MeshStandardMaterial({ map: stripesTexture(), metalness: 0.5, roughness: 0.5 });
    this.shutters = new THREE.InstancedMesh(unit, this.shutterMat, venues.length);
    this.shutters.frustumCulled = false;
    this.scene.add(this.shutters);
    this.venueState = venues.map((v) => {
      const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[v.facing] || [0, 1];
      const [w, h, d] = v.size;
      const across = Math.abs(f[0]) > 0 ? d : w; // (the front's width)
      const sw = Math.max(4, Math.min(across - 4, 16)), sh = Math.max(3, Math.min(h - 3, 8));
      return {
        v, f, sw, sh, open: 1, key: hash(v.id),
        x: v.position[0] + f[0] * ((Math.abs(f[0]) ? w : d) / 2 + 0.35), z: v.position[2] + f[1] * ((Math.abs(f[0]) ? w : d) / 2 + 0.35), y: (v.position[1] || 0) + 0.3,
      };
    });
    // the front gate, rolled shut: four panels between the ticket towers, a sign
    this.gate = new THREE.Group();
    const panelMat = new THREE.MeshStandardMaterial({ map: stripesTexture(), metalness: 0.5, roughness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(12.8, 9, 0.3), panelMat);
      p.position.set(GATE.x0 + 6.5 + k * 13, 4.9, GATE.z + 1.2);
      p.material.map.repeat.set(1, 6);
      this.gate.add(p);
    }
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: labelTexture([['PARK CLOSED', 58], ['EARLY ENTRY 8:00 AM  ·  OPEN 9 AM - 10 PM', 24]], '#16223a', '#f0c440', 512, 128) }));
    gs.position.set(0, 7.5, GATE.z + 1.5);
    this.gate.add(gs);
    this.scene.add(this.gate);
  }

  setChain(i, on) {
    if (this.chainOn[i] === on) return;
    this.chainOn[i] = on;
    const c = this.chains[i];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const yaw = Math.atan2(c.dx, c.dz); // the chain runs across the way in
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const k of [0, 1]) {
      p.set(c.x + side.x * (k ? 2.3 : -2.3), c.y + 1.6, c.z + side.z * (k ? 2.3 : -2.3));
      this.posts.setMatrixAt(i * 2 + k, on ? m.compose(p, q, s.set(0.3, 3.2, 0.3)).clone() : zero);
    }
    this.chainBars.setMatrixAt(i, on ? m.compose(p.set(c.x, c.y + 2.7, c.z), q, s.set(4.6, 0.14, 0.14)).clone() : zero);
    this.signs.setMatrixAt(i, on ? m.compose(p.set(c.x, c.y + 2.05, c.z), q, s.set(1.8, 0.9, 0.08)).clone() : zero);
    this.posts.instanceMatrix.needsUpdate = this.chainBars.instanceMatrix.needsUpdate = this.signs.instanceMatrix.needsUpdate = true;
  }

  // a shop's shutters go up in the morning (each at its own minute) and down after closing
  shutterOpen(vs, m) {
    const up = HOURS.STAFF + 30 + vs.key * 25; // 7:30 - 7:55
    const down = HOURS.CLOSE + 4 + vs.key * 16; // 10:04 - 10:20 PM
    return m >= up && m < down;
  }

  venueOpen(id) {
    const vs = this.venueState.find((s) => s.v.id === id);
    const ph = phaseAt(Clock.minutes());
    return !!vs && vs.open > 0.6 && (ph === 'open' || (ph === 'early' && vs.v.kind === 'restaurant'));
  }

  venueMessage(id) {
    const vs = this.venueState.find((s) => s.v.id === id);
    const ph = phaseAt(Clock.minutes());
    if (ph === 'early') return `${vs.v.name} opens at ${Clock.format(HOURS.OPEN)} - restaurants are open for early entry.`;
    if (ph === 'closing' || ph === 'night') return `${vs.v.name} is closed for the night. See you tomorrow!`;
    return `${vs.v.name} is getting ready to open. Back at ${Clock.format(HOURS.OPEN)}!`;
  }

  // ------------------------------------------------------------- HUD
  buildHud() {
    const bar = document.getElementById('topbar');
    if (!bar) return;
    this.chip = document.createElement('div');
    this.chip.className = 'chip';
    this.chip.id = 'parkstatus';
    this.chipText = document.createElement('span');
    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'btn small';
    this.skipBtn.style.marginLeft = '6px';
    this.skipBtn.textContent = '⏩ Skip to morning';
    this.skipBtn.onclick = () => this.skipToMorning();
    this.chip.append(this.chipText, this.skipBtn);
    const clock = document.getElementById('clock');
    if (clock?.nextSibling) bar.insertBefore(this.chip, clock.nextSibling); else bar.append(this.chip);
    this.fade = document.createElement('div');
    Object.assign(this.fade.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none', transition: 'opacity 0.6s', zIndex: '40' });
    document.body.append(this.fade);
  }

  skipToMorning() {
    const m = Clock.minutes(), ph = phaseAt(m);
    const to = ph === 'setup' ? HOURS.EARLY : HOURS.EARLY - 10; // (7:50, as the cast finish up)
    Clock.skip(Math.max(0, Clock.secondsUntil(to) - 0.5));
    this.hooks.toast(`Time flies... it's ${Clock.format(to)}. ${to === HOURS.EARLY ? 'Early entry is open!' : 'The cast are almost ready - early entry opens at 8:00 AM.'}`, 'info');
  }

  status(m, ph) {
    if (ph === 'setup') return '🛠️ Cast setting up · early entry 8 AM';
    if (ph === 'early') return `🌅 Early entry · ${this.sim.early.size} rides · all open 9 AM`;
    if (ph === 'open') return m >= HOURS.WARN ? '🔔 Closing at 10 PM' : '🎢 Open until 10 PM';
    if (ph === 'closing') return '🌙 Closed · head to the gate';
    return '🌙 Closed · early entry 8 AM';
  }

  // ------------------------------------------------------------- the player
  // inside the park: past the front gate, or anywhere in its lands
  inPark(p) {
    if (Math.abs(p.x) < 160 && p.z > GATE.z - 0.5 && p.z < 380) return false; // (the forecourt, security and the lot)
    const k = this.nav?.idx(p.x, p.z) ?? -1;
    return k >= 0 && this.nav.inside[k] === 1;
  }

  escort() {
    this.fade.style.opacity = '1';
    setTimeout(() => {
      this.sim.leave(true);
      this.player.pos.copy(OUTSIDE);
      this.player.vel?.set(0, 0, 0);
      this.player.camYaw = 0;
      this.player.snapCamera();
      this.fade.style.opacity = '0';
      this.hooks.toast('Security walked you out to the front gate. The park is closed - early entry opens at 8:00 AM. See you then!', 'info');
    }, 650);
  }

  // ------------------------------------------------------------- per frame
  update(dt, started) {
    const m = Clock.minutes(), ph = phaseAt(m), now = Clock.now();
    const day = Clock.cycleIndex();
    const once = (key, fn) => { const k = `${day}:${key}`; if (this.said.has(k)) return; this.said.add(k); if (this.phase !== null) fn(); };
    // the announcements (only as the day passes them, not on the first frame)
    if (ph === 'setup') once('setup', () => this.hooks.toast('7:00 AM: cast members are arriving to get the park ready. Early entry opens at 8:00 AM.', 'info'));
    if (ph === 'early') once('early', () => {
      this.hooks.toast(`Good morning! Early entry is open - ${this.sim.early.size} rides are running for early guests. The whole park opens at 9:00 AM.`, 'reward');
      this.hooks.say('Good morning, and welcome to Benton Diesel World! Early entry is now open. The rest of the park opens at nine.');
    });
    if (ph === 'open') once('open', () => {
      this.hooks.toast('Benton Diesel World is open! Every ride, shop and restaurant is open until 10:00 PM. Have a great day!', 'reward');
      this.hooks.say('Ladies and gentlemen, boys and girls: Benton Diesel World is now open! Have a great day!');
      this.hooks.fireworks?.();
    });
    if (ph === 'open' && m >= HOURS.WARN) once('warn', () => {
      this.hooks.toast('The park closes in 15 minutes - time for one last ride! Lines close at 10:00 PM.', 'warn');
      this.hooks.say('Attention guests: Benton Diesel World will close in fifteen minutes.');
    });
    if (ph === 'closing') once('close', () => {
      this.hooks.toast("Benton Diesel World is now closed. Thank you for spending the day with us! Please make your way to the front gate. (If you're in a line, you'll still ride.)", 'warn');
      this.hooks.say('Benton Diesel World is now closed. Thank you for visiting, and please make your way to the front gate. Good night!');
    });
    this.phase = ph;
    // the status by the clock
    if (this.chip) {
      const txt = this.status(m, ph);
      if (txt !== this.lastStatus) { this.chipText.textContent = txt; this.lastStatus = txt; }
      const showSkip = ph === 'night' || ph === 'setup' || (ph === 'closing' && m >= HOURS.ESCORT);
      if (showSkip !== this.lastSkip) { this.skipBtn.hidden = !showSkip; this.lastSkip = showSkip; }
    }
    // the gate: shut overnight (and before early entry), open from 8:00 until security clears the park
    const gateShut = ph === 'night' || ph === 'setup' || (ph === 'closing' && m >= HOURS.ESCORT);
    this.gate.visible = gateShut;
    this.player.gateClosed = gateShut;
    // (walk up to it while it's shut and you're told when it opens)
    const pp = this.player.pos;
    if (started && gateShut && Math.abs(pp.x) < 27 && pp.z > GATE.z - 0.5 && pp.z < GATE.z + 5 && now >= (this.gateToast ?? 0)) {
      this.gateToast = now + 30;
      this.hooks.toast(ph === 'setup' ? 'The front gate opens for early entry at 8:00 AM - the cast are getting the park ready.' : ph === 'closing' ? 'The park is closed for the night. See you tomorrow - early entry opens at 8:00 AM!' : 'The park is closed. Early entry opens at 8:00 AM (or use ⏩ Skip to morning by the clock).', 'info');
    }
    // cars arrive from 7:45 until early evening
    if (this.hooks.entrance) this.hooks.entrance.arriving = (ph === 'setup' && m >= HOURS.STAFF + 45) || ph === 'early' || (ph === 'open' && m < 1260);
    // chains across the ride entrances
    for (let i = 0; i < this.chains.length; i++) {
      const s = this.sim.rideState(this.chains[i].id);
      this.setChain(i, !!s.hours && !s.refurb);
    }
    // shutters
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let moved = false;
    this.venueState.forEach((vs, i) => {
      const want = this.shutterOpen(vs, m) ? 1 : 0;
      if (vs.open === want && vs.drawn) return;
      vs.open += Math.sign(want - vs.open) * Math.min(Math.abs(want - vs.open), dt * 0.4);
      vs.drawn = true;
      const shut = 1 - vs.open;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(vs.f[0], vs.f[1]));
      // (rolls up into the top: the panel shortens from the bottom)
      const h = Math.max(0.001, vs.sh * shut);
      this.shutters.setMatrixAt(i, mm.compose(p.set(vs.x, vs.y + vs.sh - h / 2, vs.z), q, sc.set(vs.sw, h, 0.2)));
      moved = true;
    });
    if (moved) this.shutters.instanceMatrix.needsUpdate = true;
    // security clears the park after closing, and anyone who gets in overnight
    if (!started) return;
    const clearing = (ph === 'closing' && m >= HOURS.ESCORT) || ph === 'night' || ph === 'setup';
    const busy = this.sim.ridingRide || this.sim.queueRide || this.player.riding;
    if (clearing && !busy && this.inPark(this.player.pos)) {
      if (!this.escortAt) {
        this.escortAt = now + 6;
        this.hooks.toast(ph === 'closing' ? 'The park is closed - security is coming to walk you to the front gate.' : 'The park is closed right now - early entry opens at 8:00 AM. Security is on the way to walk you out.', 'warn');
      } else if (now >= this.escortAt) {
        this.escortAt = 0;
        this.escort();
      }
    } else this.escortAt = 0;
  }
}
