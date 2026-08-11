/**
 * Character roster.
 *
 * All survivors are original characters written for this prototype. The
 * Cenobite entry is an original interpretation intended as a clearly-labelled
 * placeholder for a licensed asset — the systems it drives are what matter.
 *
 * `build` drives the procedural character mesh generator on the client.
 * `perk` is a passive; `active` is a manually triggered ability with a cooldown.
 */

export const SURVIVORS = [
  {
    id: 'mara',
    name: 'Mara Vance',
    role: 'Occult Researcher',
    bio: 'Catalogued the box for a museum that no longer has a record of it. She reads the symbols faster than she should be able to.',
    build: {
      height: 1.7,
      frame: 0.94,
      skin: 0x9b7a68,
      hair: 0x241a16,
      hairStyle: 'bun',
      shirt: 0x3b4551,
      pants: 0x2a2b30,
      coat: 0x54483f,
      accent: 0xa4915f,
    },
    perk: {
      id: 'scholar',
      name: 'Scholar',
      desc: 'Symbol decoding and seal-breaking are 30% faster, and puzzle rings glow faintly when correct.',
    },
    active: {
      id: 'recall',
      name: 'Total Recall',
      cooldown: 90,
      duration: 12,
      desc: 'Reveal the aura of every unfinished objective through walls for 12 seconds.',
    },
  },
  {
    id: 'tobias',
    name: 'Tobias Kerr',
    role: 'Night Watchman',
    bio: 'Twenty years of walking dark buildings alone. He does not startle. That turns out to be worth something here.',
    build: {
      height: 1.86,
      frame: 1.14,
      skin: 0x6b4a37,
      hair: 0x141110,
      hairStyle: 'short',
      shirt: 0x27343c,
      pants: 0x22242a,
      coat: 0x1b2a33,
      accent: 0xc0a24a,
    },
    perk: {
      id: 'steady',
      name: 'Steady Hand',
      desc: 'Fear rises 35% slower and your flashlight never flickers below 40% battery.',
    },
    active: {
      id: 'brace',
      name: 'Brace',
      cooldown: 70,
      duration: 6,
      desc: 'Plant your feet: the next hit does not stagger you and costs the Cenobite its momentum.',
    },
  },
  {
    id: 'ines',
    name: 'Inés Fuentes',
    role: 'Urban Explorer',
    bio: 'Has climbed into places with worse ventilation than this. Knows that the fastest way out is rarely the door.',
    build: {
      height: 1.64,
      frame: 0.88,
      skin: 0xb08a6e,
      hair: 0x3a2418,
      hairStyle: 'ponytail',
      shirt: 0x6a4a3a,
      pants: 0x33362f,
      coat: 0x7d5a33,
      accent: 0xd2673a,
    },
    perk: {
      id: 'freerunner',
      name: 'Freerunner',
      desc: 'Vaults are 45% faster, cost no stamina, and leave no scratch marks for the Cenobite to read.',
    },
    active: {
      id: 'sprint_burst',
      name: 'Adrenaline Burst',
      cooldown: 60,
      duration: 4,
      desc: 'Break into a dead sprint that ignores stamina and injury for 4 seconds.',
    },
  },
  {
    id: 'gideon',
    name: 'Gideon Roarke',
    role: 'Defrocked Priest',
    bio: 'He knew what the box was before he touched it. He touched it anyway. He is still arguing about whose fault that is.',
    build: {
      height: 1.78,
      frame: 1.05,
      skin: 0xc39a80,
      hair: 0x8d8a86,
      hairStyle: 'short',
      shirt: 0x1e1e21,
      pants: 0x1a1a1d,
      coat: 0x131316,
      accent: 0x9d2f2f,
    },
    perk: {
      id: 'benediction',
      name: 'Benediction',
      desc: 'Teammates within 10m lose fear twice as fast. You heal and revive others 40% faster.',
    },
    active: {
      id: 'ward',
      name: 'Ward',
      cooldown: 100,
      duration: 14,
      desc: 'Chalk a ward on the floor. Cenobite abilities cannot be cast inside it.',
    },
  },
  {
    id: 'nadia',
    name: 'Nadia Sorel',
    role: 'Field Medic',
    bio: 'Triage does not care where you are. She has decided the rules still apply, and enforces them loudly.',
    build: {
      height: 1.72,
      frame: 0.97,
      skin: 0x8a6350,
      hair: 0x1c1512,
      hairStyle: 'ponytail',
      shirt: 0x2f4a44,
      pants: 0x25292b,
      coat: 0xd8d4cc,
      accent: 0xc23b3b,
    },
    perk: {
      id: 'triage',
      name: 'Triage',
      desc: 'Start with a medkit. Healing others is 50% faster and stops their bleed permanently.',
    },
    active: {
      id: 'stimulant',
      name: 'Stimulant',
      cooldown: 80,
      duration: 10,
      desc: 'Inject the nearest injured survivor (or yourself): no bleed, no limp, +25% speed.',
    },
  },
  {
    id: 'wren',
    name: 'Wren Adeyemi',
    role: 'Locksmith',
    bio: 'Every mechanism has a logic. She keeps saying this, quietly, like it is a prayer that might still work.',
    build: {
      height: 1.68,
      frame: 0.92,
      skin: 0x5c3f2e,
      hair: 0x120e0d,
      hairStyle: 'bun',
      shirt: 0x474a52,
      pants: 0x2e3036,
      coat: 0x3d3a35,
      accent: 0x6fa3b5,
    },
    perk: {
      id: 'tumblers',
      name: 'Tumblers',
      desc: 'Open locked doors without a key (slowly), and searching containers is twice as fast.',
    },
    active: {
      id: 'jam',
      name: 'Jam the Works',
      cooldown: 75,
      duration: 20,
      desc: 'Seal the nearest door shut. The Cenobite must break it, and breaking it is loud.',
    },
  },
];

export const CENOBITES = [
  {
    id: 'hell_priest',
    name: 'The Hell Priest',
    subtitle: 'Placeholder model — "Pinhead" archetype',
    role: 'Lead Cenobite',
    available: true,
    bio: 'It does not chase. It arrives. The chains are not a weapon so much as a filing system.',
    build: {
      height: 1.92,
      frame: 1.16,
      skin: 0xd8d2c8,
      cassock: 0x0d0c0f,
      leather: 0x161418,
      accent: 0x8d8578,
      pins: 0xbfc3c7,
      pinGrid: 6,
      wounds: true,
    },
    passive: {
      id: 'presence',
      name: 'Presence',
      desc: 'Survivors within 22m gain fear continuously. Terrified survivors are outlined for you.',
    },
    abilities: ['chain_summon', 'chain_trap', 'gateway', 'pain_sense', 'lament_teleport'],
  },
  {
    id: 'chatterer',
    name: 'The Chatterer',
    subtitle: 'Coming soon',
    role: 'Pursuit Cenobite',
    available: false,
    bio: 'Fast, blind, and very good at listening. Planned kit: sound-based tracking and a lunge.',
    build: { height: 1.78, frame: 1.0, skin: 0xcfc6b6, cassock: 0x111014, leather: 0x191519, accent: 0x7a736a, pins: 0, wounds: true },
    abilities: [],
  },
  {
    id: 'butterball',
    name: 'Butterball',
    subtitle: 'Coming soon',
    role: 'Zoner Cenobite',
    available: false,
    bio: 'Slow. Unstoppable. Planned kit: area denial and a wall of hooks.',
    build: { height: 1.84, frame: 1.5, skin: 0xd4c9b4, cassock: 0x14120f, leather: 0x1a1712, accent: 0x6d6558, pins: 0, wounds: true },
    abilities: [],
  },
  {
    id: 'female_cenobite',
    name: 'The Deep Throat',
    subtitle: 'Coming soon',
    role: 'Ambush Cenobite',
    available: false,
    bio: 'Patient in a way that is genuinely worse. Planned kit: stealth and a throat-hook drag.',
    build: { height: 1.74, frame: 0.95, skin: 0xd9d1c4, cassock: 0x0f0e11, leather: 0x171418, accent: 0x847c70, pins: 0, wounds: true },
    abilities: [],
  },
];

export const getSurvivor = (id) => SURVIVORS.find((s) => s.id === id) || SURVIVORS[0];
export const getCenobite = (id) => CENOBITES.find((c) => c.id === id) || CENOBITES[0];
