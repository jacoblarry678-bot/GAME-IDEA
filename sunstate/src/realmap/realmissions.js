/**
 * The story missions, moved onto the real map. Same people, same jobs, real streets:
 *   Small Change  hold up a corner store near your Ocean Drive apartment, lose the police, get home
 *   Low Tide      drive across the bay to the Dinner Key marina in Coconut Grove for Rudy's cooler,
 *                 shake off the Calderas, bring it back to South Beach
 * Businesses and people are invented; the streets are real.
 */
import { REAL_SAFEHOUSE } from './spots.js';
import { SURF } from './tilemesh.js';

const S = REAL_SAFEHOUSE.door;
const HOME = { x: S.x + 1.5, z: S.z };
// Dinner Key, Coconut Grove (game metres): the marina lot, where Rudy waits, where the Calderas come from
const DK = { lot: { x: -4024, z: 5030 }, rudy: { x: -3996, z: 5160 }, rivalA: { x: -4105, z: 5070 }, rivalB: { x: -4118, z: 5062 } };
const RUDY_LOOK = { female: false, height: 1.74, build: 1.22, skin: 0xe0ac69, hair: 0x9a9a9a, top: 0x6a8caf, bottom: 0xc8b48a, shoes: 0x5a4a3a, hairStyle: 'short', shorts: true, sleeveless: false, hat: 0xe9e2d0, beard: true };

let G = null; // the game (objectives read the chosen store)
const store = () => G?.missions.active?.data.shop || null;

/** A dry, open spot near (x, z) to stand someone on. */
function dryNear(g, x, z) {
  const w = g.world;
  for (let r = 0; r <= 30; r += 1.5) {
    for (let k = 0; k < Math.max(1, r * 4); k++) {
      const a = (k / Math.max(1, r * 4)) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const c = w.rasterAt(px, pz);
      if (c < 0 || c === SURF.water || c === SURF.building) continue;
      const y = w.ground(px, pz, 2);
      if (w.collision.overlapsCircle(px, pz, 0.4, y + 0.2, 1.5)) continue;
      return { x: px, z: pz };
    }
  }
  return { x, z };
}

/** The corner store for the job: a mart or gas station a short drive from home. */
function pickStore(g) {
  const P = g.places;
  const shops = [...(P?.shops?.values() || [])].filter((s) => s.type === 'mart' || s.type === 'gas');
  const d = (s) => Math.hypot(s.x - S.x, s.z - S.z);
  // a short drive away if there is one (its door is found now: doors are normally worked out on approach)
  const order = [...shops.filter((s) => d(s) > 250 && d(s) < 1400).sort((a, b) => d(a) - d(b)), ...shops.sort((a, b) => d(a) - d(b))];
  for (const s of order) {
    if (!s.door) { const dd = P.doorFor(s); if (dd) { s.door = { x: dd.x, z: dd.z }; s.street = s.street || dd.street; } }
    if (s.door) return s;
  }
  return null;
}

const rivalsActive = (g, m) => (m.data.rivals || []).filter((r) => g.vehicles.includes(r.vehicle) && !r.vehicle.destroyed && !r.vehicle.sunk && r.crew.some((c) => !c.dead && !c.removed));
const nearHome = (g) => g.player.distanceTo(HOME.x, HOME.z) < 3.5 && !g.player.vehicle;

export const REAL_MISSIONS = {
  small_change: {
    id: 'small_change',
    title: 'Small Change',
    giver: 'sol',
    cast: ['cal'],
    partner: 'stay',
    start: { x: S.x + 3, z: S.z - 5 },
    introTitle: 'Ocean Drive',
    summary: 'Sol has a way to cover the debt to Teo by Friday: a corner store that keeps the week\'s takings in the register.',
    intro: [
      ['sol', 'Teo wants his two grand by Friday, Cal. You know what he does when people are late.'],
      ['cal', 'I know what he does.'],
      ['sol', 'There\'s a corner store a few blocks from here. They keep the week\'s take in the register until the Monday pickup.'],
      ['sol', 'In, out. Nobody gets hurt. Then come back here and we lie low.'],
      ['cal', 'Nobody gets hurt.'],
    ],
    onStart: (g) => { G = g; g.missions.active.data.shop = pickStore(g); },
    stages: [
      {
        id: 'drive',
        get objective() { const s = store(); return s ? `Go to ${s.name}${s.street ? ' on ' + s.street : ''}.` : 'Go to the corner store.'; },
        target: () => { const s = store(); return s ? { x: s.door.x, z: s.door.z, label: s.name } : null; },
        checkpoint: true,
        fail: (g, m) => (!m.data.shop ? 'No store close enough. Try again in a moment.' : null),
        done: (g, m) => { const d = m.data.shop.door; return Math.hypot((g.player.vehicle || g.player).pos.x - d.x, (g.player.vehicle || g.player).pos.z - d.z) < 12; },
      },
      {
        id: 'rob', objective: 'Switch to your pistol (Q), walk up to the counter (E) and empty the register.',
        hint: 'Q switches weapons. At the counter, the register option appears while you hold a gun.',
        target: () => { const s = store(); return s ? { x: s.door.x, z: s.door.z, label: 'Counter' } : null; },
        enter: (g, m) => { m.data.t0 = g.time; },
        done: (g, m) => (m.data.shop.robbedAt ?? -1) >= (m.data.t0 ?? 0),
      },
      {
        id: 'escape', objective: 'Lose the police.', target: () => null,
        checkpoint: true,
        hint: 'Break line of sight, get out of the search area and stay hidden until the stars go away.',
        done: (g) => g.wanted.level === 0 && !g.places?.alarm,
      },
      {
        id: 'return', objective: 'Get back to your apartment on Ocean Drive.', target: () => ({ x: HOME.x, z: HOME.z, label: 'Home' }),
        back: (g) => (g.wanted.level > 0 ? 'escape' : null),
        done: nearHome,
      },
    ],
    outro: [
      ['sol', 'Count it twice. Teo will.'],
      ['cal', 'It\'s enough. Barely.'],
      ['sol', 'Barely is still enough. Get some sleep. I\'ve got a line on something bigger.'],
    ],
    reward: { bonus: 1600 },
    onPassMessage: { from: 'sol', text: 'Teo got paid. Stay off the radar for a bit. I\'ll call when the next thing comes up.' },
  },

  low_tide: {
    id: 'low_tide',
    title: 'Low Tide',
    giver: 'sol',
    cast: ['cal', 'sol'],
    partner: 'with',
    allowSwitch: true,
    requires: ['small_change'],
    start: { x: S.x + 3, z: S.z - 5 },
    introTitle: 'Ocean Drive',
    summary: 'Rudy Ojeda wants out, and he\'ll pay to have a cooler carried from the Dinner Key marina back to South Beach.',
    intro: [
      ['sol', 'Remember Rudy Ojeda? Runs fishing charters out of Dinner Key.'],
      ['cal', 'The guy whose boat never catches any fish.'],
      ['sol', 'He\'s been skimming the Caldera brothers\' charter money. He wants out, and he\'ll pay four grand to get a cooler across the bay.'],
      ['cal', 'And the Calderas?'],
      ['sol', 'Won\'t know a thing. Over the causeway, down to the Grove, back here. You drive, or I will.'],
      ['sol', 'And put this vest on. Humour me.'],
    ],
    onStart: (g) => { G = g; for (const ch of g.crew.list) ch.armor = Math.max(ch.armor, 60); },
    stages: [
      {
        id: 'drive', objective: 'Drive to the Dinner Key marina in Coconut Grove with Sol.', target: () => ({ x: DK.lot.x, z: DK.lot.z, label: 'Marina' }),
        hint: 'The GPS line shows the way: MacArthur Causeway, then south on I-95 and US-1. Press G by a car to let your partner drive.',
        checkpoint: true,
        partnerDrive: () => ({ x: DK.lot.x, z: DK.lot.z, arrive: 18, line: 'Marina. Rudy said down by the docks.' }),
        done: (g) => Math.hypot((g.player.vehicle || g.player).pos.x - DK.lot.x, (g.player.vehicle || g.player).pos.z - DK.lot.z) < 30 && g.crew.partnerWithPlayer(),
      },
      {
        id: 'pier', objective: 'Meet Rudy down by the docks.', target: () => (G?.missions.active?.data.rudyAt ? { ...G.missions.active.data.rudyAt, label: 'Rudy' } : { x: DK.rudy.x, z: DK.rudy.z, label: 'Rudy' }),
        hint: 'Get out and walk.',
        enter: (g, m) => {
          if (m.data.rudy && !m.data.rudy.removed) return;
          const at = dryNear(g, DK.rudy.x, DK.rudy.z);
          m.data.rudyAt = at;
          const r = g.missions.spawnActor(RUDY_LOOK, at.x, at.z, Math.PI);
          r.controller.setState('idle', 999);
          r.anim_.phone = true;
          m.data.rudy = r;
        },
        fail: (g, m) => (m.data.rudy?.dead ? 'Rudy is dead. So is the deal.' : null),
        done: (g, m) => !g.player.vehicle && !g.player.swim && g.player.distanceTo(m.data.rudy.pos.x, m.data.rudy.pos.z) < 4.5,
      },
      {
        id: 'ambush', objective: 'The Calderas followed Rudy. Get to a car together.',
        hint: 'One of you drives, the other shoots: press G by a car to let your partner drive. Tab swaps roles any time.',
        target: () => ({ x: DK.lot.x, z: DK.lot.z, label: 'Car' }),
        checkpoint: true,
        enter: (g, m) => {
          m.data.cooler = true;
          g.missions.playDialogue([
            ['rudy', 'You\'re Sol\'s people. Good. Take it. Don\'t open it, don\'t drop it.'],
            ['sol', 'Pleasure doing business, Rudy.'],
            ['rudy', 'Oh, no. That\'s the Calderas\' truck on Pan American Drive. They followed me here.'],
            ['rudy', 'Go! Go!'],
          ], 'Dinner Key');
          const r = m.data.rudy;
          if (r && !r.dead) { r.anim_.phone = false; r.controller.panic({ x: DK.rivalA.x, z: DK.rivalA.z }, 'gunfire'); }
          const dest = { x: DK.lot.x, z: DK.lot.z };
          const yaw = (p) => Math.atan2(DK.lot.x - p.x, DK.lot.z - p.z);
          m.data.rivals = [
            g.missions.spawnRivals('pickup', DK.rivalA.x, DK.rivalA.z, yaw(DK.rivalA), 0x1a1a1a, dest),
            g.missions.spawnRivals('kestrel', DK.rivalB.x, DK.rivalB.z, yaw(DK.rivalB), 0x7a1f24, dest),
          ];
          for (const rv of m.data.rivals) { rv.crew[0].controller.holdT = 8; rv.crew[1].controller.holdT = 8; }
        },
        fail: (g) => (g.partner.dead ? `${g.partner.protagonistName} is down.` : null),
        done: (g) => !!g.player.vehicle && g.partner.vehicle === g.player.vehicle,
      },
      {
        id: 'chase', objective: 'Lose the Calderas.', target: () => null,
        hint: 'Wreck their cars, take out their crews, or put 200 m between you. Tab swaps driver and shooter.',
        partnerDrive: () => ({ x: HOME.x + 30, z: HOME.z, arrive: 25, urgent: true, line: 'Are they gone? Tell me they\'re gone.' }),
        enter: (g, m) => {
          for (const r of m.data.rivals || []) for (const c of r.crew) if (c.controller) c.controller.alerted = true;
          const sol = g.partner.vehicle && g.partner.seat === 0;
          g.hud?.subtitle(g.partner.protagonistName, sol ? 'I\'ve got the wheel. Keep their heads down!' : 'Drive! I\'ll handle them.', 3);
          m.data.farT = 0;
        },
        update: (g, m, dt) => {
          const live = rivalsActive(g, m);
          const ppos = (g.player.vehicle || g.player).pos;
          const far = live.every((r) => Math.hypot(r.vehicle.pos.x - ppos.x, r.vehicle.pos.z - ppos.z) > 200);
          m.data.farT = far ? (m.data.farT || 0) + dt : 0;
        },
        done: (g, m) => rivalsActive(g, m).length === 0 || m.data.farT > 6,
      },
      {
        id: 'escape', objective: 'Lose the police.', target: () => null,
        checkpoint: true,
        hint: 'Break line of sight, get out of the search area and stay hidden until the stars go away.',
        skipIf: (g) => g.wanted.level === 0,
        done: (g) => g.wanted.level === 0,
      },
      {
        id: 'return', objective: 'Bring the cooler back to your apartment on Ocean Drive.', target: () => ({ x: HOME.x, z: HOME.z, label: 'Home' }),
        partnerDrive: () => ({ x: HOME.x + 30, z: HOME.z, arrive: 16, line: 'Home sweet Ocean Drive.' }),
        back: (g) => (g.wanted.level > 0 ? 'escape' : null),
        done: (g) => nearHome(g) && g.crew.partnerWithPlayer(),
      },
    ],
    outro: [
      ['cal', 'Four grand to carry a cooler across a bay.'],
      ['sol', 'And to not get shot. Don\'t forget that part.'],
      ['sol', 'Rudy\'s on a boat to anywhere. The Calderas are going to remember our faces, though.'],
    ],
    reward: { bonus: 4000 },
    onPassMessage: { from: 'sol', text: 'The Calderas are asking around South Beach. Keep your head down for a while.' },
  },
};
