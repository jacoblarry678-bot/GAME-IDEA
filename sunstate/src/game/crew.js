/**
 * The crew: two playable protagonists, Cal and Sol. Each keeps their own
 * health, armour, position, weapons/ammo and car; money is shared (they're a
 * couple pooling everything — a design choice of this prototype).
 *
 * The one you control is `game.player` (role 'player', PlayerController);
 * the other is `game.partner` (role 'partner', PartnerController).
 *
 * Switching (default Tab) is refused while the police are after you, during
 * dialogue, mid-way into or out of a car, or when a mission locks it. Close
 * by, the camera simply moves over to the other person; far away it cuts
 * with a short fade.
 */
import { Character } from '../entities/character.js';
import { PlayerController } from './player.js';
import { PartnerController } from '../ai/partner.js';
import { PLACES } from '../world/district.js';

export const PROTAGONISTS = {
  cal: {
    id: 'cal', name: 'Cal', full: 'Cal Reyes', color: '#4fd1c5', car: 'start-sedan',
    look: { female: false, height: 1.83, build: 1.08, skin: 0xc68642, hair: 0x1b1410, top: 0xe9e2d0, bottom: 0x2e3b55, shoes: 0xf0f0f0, hairStyle: 'long', shorts: false, sleeveless: false, hat: null, beard: true },
    home: () => PLACES.safehouse.spawn,
  },
  sol: {
    id: 'sol', name: 'Sol', full: 'Marisol "Sol" Vega', color: '#ff6fa8', car: 'start-muscle',
    look: { female: true, height: 1.69, build: 0.94, skin: 0xa86b4a, hair: 0x241510, top: 0xd94f70, bottom: 0x34405e, shoes: 0x1c1c1c, hairStyle: 'long', shorts: true, sleeveless: true, hat: null, beard: false },
    // leaning on the rail by the motel lot, next to the blue mission marker
    home: () => ({ x: PLACES.safehouse.door.x + 5.6, z: PLACES.safehouse.door.z + 3.4, rot: -Math.PI / 2 }),
  },
};

export class Crew {
  /** A protagonist's home spot (where they wait when not with you). */
  static home(id) { const h = PROTAGONISTS[id].home(); return { x: h.x, z: h.z, yaw: h.rot }; }

  constructor(game) {
    this.game = game;
    this.members = {};
    for (const def of Object.values(PROTAGONISTS)) {
      const h = def.home();
      const ch = new Character(game, def.look, { role: 'partner', x: h.x, z: h.z, yaw: h.rot });
      ch.protagonist = def.id;
      ch.protagonistName = def.name;
      ch.pc = new PlayerController(game, ch);
      ch.partnerAI = new PartnerController(game, ch);
      ch.controller = ch.partnerAI;
      this.members[def.id] = ch;
    }
    this.activeId = 'cal';
    this.lockReason = null; // set by missions
    this.cooldown = 0;
    this.downT = 0; // partner down → taken to hospital
    this.setActive('cal');
    this.members.sol.partnerAI.setMode('wait', { ...PROTAGONISTS.sol.home(), yaw: PROTAGONISTS.sol.home().rot });
    game.events.on('killed', ({ victim }) => { if (victim === game.partner) this.onPartnerDown(); });
  }

  get list() { return Object.values(this.members); }
  get active() { return this.members[this.activeId]; }
  other(id = this.activeId) { return this.members[id === 'cal' ? 'sol' : 'cal']; }

  setActive(id) {
    const g = this.game;
    const to = this.members[id], from = this.other(id);
    this.activeId = id;
    g.player = to; g.partner = from;
    to.role = 'player'; from.role = 'partner';
    to.partnerAI.reset();
    from.partnerAI.reset();
    to.controller = to.pc; from.controller = from.partnerAI;
    from.pc.aiming = false; from.pc.enter = null; from.pc.exit = null; from.pc.prompt = null; from.pc.frozen = false;
    from.anim_.aim = false;
  }

  /** Why switching is not possible right now (null = allowed). */
  switchBlocked() {
    const g = this.game, p = g.player, o = g.partner;
    if (this.lockReason) return this.lockReason;
    if (o.dead || this.downT > 0) return `${o.protagonistName} is at Ocean Mercy`;
    if (g.wanted.level > 0) return 'Lose the police first';
    if (p.dead || p.controller.frozen) return 'Not now';
    if (p.controller.enter || p.controller.exit) return 'Not now';
    if (g.missions.cutscene) return 'Not during a conversation';
    if (p.knockT > 0 || p.swim) return 'Not now';
    if (this.cooldown > 0) return 'Not now';
    return null;
  }

  /** Swap control to the other protagonist. Returns true on success. */
  switchCharacter() {
    const g = this.game;
    const why = this.switchBlocked();
    if (why) { g.hud?.notify(why + '.', 'Switch', 'warn', 3); g.audio?.ui('empty'); return false; }
    const from = g.player, to = g.partner;
    const fp = from.vehicle ? from.vehicle.pos : from.pos, tp = to.vehicle ? to.vehicle.pos : to.pos;
    const dist = Math.hypot(fp.x - tp.x, fp.z - tp.z);
    const together = from.vehicle && from.vehicle === to.vehicle;
    // the one you leave keeps doing something sensible: follows if close, otherwise waits there
    const followAfter = together || dist < 25;
    const fromCar = from.vehicle;
    if (fromCar && from.seat === 0) { fromCar.input.throttle = 0; fromCar.input.steer = 0; }
    this.setActive(to.protagonist);
    from.partnerAI.setMode(followAfter ? 'follow' : 'wait');
    this.cooldown = 1.2;
    const rig = g.cameraRig;
    const yaw = to.vehicle ? to.vehicle.yaw : to.yaw;
    if (dist > 30) { rig.snapBehind(yaw); g.hud?.app.fade(0.7); }
    else rig.blend = 0; // glide the pivot across to the other character
    g.events.emit('switched', { from, to, far: dist > 30 });
    g.audio?.ui('switch');
    return true;
  }

  /** Partner key: follow ⇄ wait on foot; pull over ⇄ drive on when they're driving you. */
  partnerCommand() {
    const g = this.game, p = g.player, o = g.partner;
    if (o.dead || this.downT > 0) return;
    const ai = o.partnerAI;
    if (o.vehicle && o.seat === 0 && p.vehicle === o.vehicle) {
      ai.hold = !ai.hold;
      g.hud?.subtitle(o.protagonistName, ai.hold ? 'Pulling over.' : 'Okay, rolling.', 2);
      return;
    }
    const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
    if (d > 40 && ai.mode !== 'follow') { g.hud?.notify(`${o.protagonistName} is too far away to hear you. Go and get them, or switch.`, o.protagonistName, '', 4); return; }
    if (ai.mode === 'follow') { ai.setMode('wait'); g.hud?.subtitle(o.protagonistName, 'I\'ll wait here.', 2); }
    else { ai.setMode('follow'); g.hud?.subtitle(o.protagonistName, 'Right behind you.', 2); }
  }

  onPartnerDown() {
    const g = this.game;
    if (this.downT > 0) return;
    this.downT = 8;
    g.hud?.notify(`${g.partner.protagonistName} is down. Ambulance is on the way to Ocean Mercy.`, g.partner.protagonistName, 'warn', 6);
  }

  /** The downed partner is patched up and waits at the hospital. */
  reviveAtHospital() {
    const g = this.game, o = g.partner, h = PLACES.hospital;
    if (o.vehicle) g.unseatCharacter(o.vehicle, o, null);
    o.dead = false; o.deadT = 0; o.knockT = 0; o.health = 100; o.swim = false;
    const x = h.x + 2.5, z = h.z + 1.5;
    o.pos.set(x, g.world.ground(x, z, 2), z); o.vel.set(0, 0, 0); o.yaw = h.rot;
    o.partnerAI.reset();
    o.partnerAI.setMode('wait', { x, z, yaw: h.rot });
    const fee = Math.min(500, Math.round(g.economy.money * 0.1));
    if (fee > 0) g.economy.take(fee, `${o.protagonistName}'s hospital bill`);
    g.hud?.notify(`${o.protagonistName} was patched up and is waiting at Ocean Mercy.${fee ? ` Bill: $${fee}.` : ''}`, o.protagonistName, 'phone', 7);
  }

  /** After WASTED/BUSTED: a partner who was with you ends up there too. */
  regroupAt(x, z, yaw, wasWith) {
    const g = this.game, o = g.partner;
    if (!wasWith || o.dead) return;
    if (o.vehicle) g.unseatCharacter(o.vehicle, o, null);
    const px = x + Math.cos(yaw) * 1.4, pz = z - Math.sin(yaw) * 1.4;
    o.pos.set(px, g.world.ground(px, pz, 2), pz); o.vel.set(0, 0, 0); o.yaw = yaw;
    o.knockT = 0; o.swim = false;
    o.partnerAI.reset();
    o.partnerAI.setMode('follow');
  }

  /** Is the partner with the player (in their car, or following close by)? */
  partnerWithPlayer() {
    const g = this.game, p = g.player, o = g.partner;
    if (o.dead) return false;
    if (o.vehicle && o.vehicle === p.vehicle) return true;
    return o.partnerAI.mode === 'follow' && Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 40;
  }

  step(dt) {
    const g = this.game, input = g.input;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.downT > 0) { this.downT -= dt; if (this.downT <= 0) this.reviveAtHospital(); }
    if (!g.player.dead) {
      if (input.pressed('switchCharacter')) this.switchCharacter();
      else if (input.pressed('partner')) this.partnerCommand();
    }
    g.partner.controller.step(dt);
  }

  // ------------------------------------------------------------ save / load
  snapshotMember(ch) {
    const inv = ch.pc.inventory;
    const pos = ch.vehicle ? ch.vehicle.pos : ch.pos;
    return {
      health: Math.max(50, ch.dead ? 100 : ch.health), armor: ch.armor,
      weapons: [...inv.weapons], current: inv.current, ammo: JSON.parse(JSON.stringify(inv.ammo)),
      x: pos.x, z: pos.z, yaw: ch.vehicle ? ch.vehicle.yaw : ch.yaw,
      mode: ch === this.game.player ? 'player' : ch.partnerAI.mode,
    };
  }

  applyMember(ch, s, place) {
    ch.health = s.health; ch.armor = s.armor;
    const inv = ch.pc.inventory;
    inv.weapons = [...s.weapons]; inv.current = s.current; inv.ammo = JSON.parse(JSON.stringify(s.ammo));
    if (place) {
      const g = this.game;
      ch.pos.set(place.x, g.world.ground(place.x, place.z, 2), place.z);
      ch.yaw = place.yaw; ch.vel.set(0, 0, 0);
    }
  }
}
