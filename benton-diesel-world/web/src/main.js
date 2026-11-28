// Benton Diesel World - browser edition. Loads the park exported from the
// Roblox build (park.json) and runs the whole day at the park: rides with
// live queues, shows, shops, restaurants and the Benton Park App.
import * as THREE from 'three';
import * as Clock from './clock.js';
import { World } from './world.js';
import { geomOptions } from './geom.js';
import { Input } from './input.js';
import { Collision, Player } from './player.js';
import { RideVisuals } from './rides.js';
import { Sim } from './sim.js';
import { Effects } from './fx.js';
import { GuestFactory, Crowd } from './guests.js';
import { NavGrid } from './navgrid.js';
import { GuestFlow } from './guestflow.js';
import { ParkDay, buildCastDoor, CAST_DOOR, GATE as MAIN_GATE } from './parkday.js';
import { buildNaturalKingdom, NK_GATE, NK_DOOR, NK_INSIDE, NK_LANDS } from './naturalkingdom.js';
import { buildNKRides } from './nkrides.js';
import { buildUnderTheSeas, UnderTheSeasSite } from './underseas.js';
import { buildMexicoTour, MexicoTourSite, FIESTA_DOOR } from './mexicotour.js';
import { QueueCrowd } from './queue.js';
import { CrowdRenderer } from './people/crowd.js';
import { StaffSystem } from './staff.js';
import { Bubbles } from './bubbles.js';
import { buildEntrance, Entrance } from './entrance.js';
import { buildOverdrive } from './overdrive.js';
import { buildTramTour } from './refurb.js';
import { buildBackstage, Backstage, BS } from './backstage.js';
import { buildFamilyBackstage, buildScareZones, buildHauntFood, FB } from './haunt.js';
import { buildHouses, HouseWalks } from './houses.js';
import { ScareActors, HauntLights } from './scare.js';
import { buildResort } from './resort.js';
import { HAUNT_OVER, RIDE_HOUSES_OPEN } from './season.js';
import { buildFastFurious, FastFuriousSite } from './fastfurious.js';
import { buildChristmas, buildXmasTeardown, Christmas, buildXmasSetup, XmasSetupSite } from './christmas.js';
import { CHRISTMAS, XMAS_OVER, XMAS_SETUP, WOLVERINE_OPEN, MARDI_GRAS, EASTER, SUMMER, FD_BUILDING } from './season.js';
import { buildFinalDestination, FinalDestinationSite } from './finaldest.js';
import { buildMardiGras, AT_BACKSTAGE, AT_BACKSTAGE_EASTER } from './mardigras.js';
import { buildEasterBunny, EasterBunnySite } from './easterbunny.js';
import { EggHunt } from './egghunt.js';
import { buildMardiShow, MardiShowSite } from './mardishow.js';
import { buildLineTickets, buildExtendedQueues } from './lanes.js';
import { Social } from './social.js';
import { buildDieselRun, DieselRunSite } from './dieselrun.js';
import { buildDieselHeist, DieselHeistSite } from './dieselheist.js';
import { buildStrangerThings, StrangerThingsSite } from './strangerthings.js';
import { buildFuelThrottle, FuelThrottleSite } from './fuelthrottle.js';
import { buildBoomCoaster, BoomCoasterSite } from './boomcoaster.js';
import { buildConstructionRunaway, ConstructionRunawaySite } from './constructionrunaway.js';
import { buildRVVanRun, RVVanRunSite } from './rvvanrun.js';
import { buildNeonGetaway, NeonGetawaySite } from './neongetaway.js';
import { buildKingMamba, KingMambaSite } from './kingmamba.js';
import { buildSirensWake, SirensWakeSite } from './sirenswake.js';
import { buildZeroSpace, ZeroSpaceSite } from './zerospace.js';
import { buildJungleRun, JungleRunSite } from './junglerun.js';
import { buildBentonFlash, BentonFlashSite } from './bentonflash.js';
import { buildOverride, OverrideSite } from './override.js';
import { buildBentonRoll, BentonRollSite } from './bentonroll.js';
import { buildRavage, RavageSite } from './ravage.js';
import { buildBentonBlitz, BentonBlitzSite } from './bentonblitz.js';
import { buildFlyingFire, FlyingFireSite } from './flyingfire.js';
import { buildCyclone, CycloneSite } from './cyclone.js';
import { buildHarborRun, HarborRunSite } from './harborrun.js';
import { buildSpeedBreaker, SpeedBreakerSite } from './speedbreaker.js';
import { buildRCRace, RCRaceSite } from './rcrace.js';
import { buildSummer, SunSwingerSite } from './sunswinger.js';
import { buildWinTheCrown, WinTheCrownSite } from './wincrown.js';
import { buildJungleRaid, JungleRaidSite } from './jungleraid.js';
import { buildBlackline, BlacklineSite, RIDE_ID as BL_ID } from './blackline.js';
import { buildSummerOverlays, SummerOverlaySite } from './summeroverlays.js';
import { buildLowerLot, LowerLotSite } from './lowerlot.js';
import { buildSnowball, SnowballSite } from './snowball.js';
import { buildNeonGliders, NeonGlidersSite } from './neongliders.js';
import { buildRoadWork } from './roadwork.js';
import { buildWolverine, WolverineSite, addWolverineWalkway, helpers as partHelpers } from './wolverine.js';
import { Transit } from './transit.js';
import { GameAudio } from './audio/director.js';
import { ShowRunner } from './shows.js';
import { Guide } from './guide.js';
import { Thumbs } from './thumbs.js';
import { UI } from './ui.js';
import { configureMaterials } from './render/materials.js';
import { Post } from './render/post.js';
import { installAtmosphere, atmos } from './render/atmosphere.js';
import { Life } from './render/life.js';
import { buildStreetDetails } from './details.js';
import { waterTime } from './render/water.js';

const QUALITY_KEY = 'bentonDieselWorld.quality';
const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// graphics presets: shadows, post-processing (bloom, ambient occlusion),
// resolution and texture detail
const PRESETS = {
  low: { name: 'low', shadows: false, shadowSize: 1024, shadowRange: 90, post: false, ao: false, samples: 0, pixelRatio: 1.25, crowd: 30, guests: 80, grass: 0 },
  high: { name: 'high', shadows: true, shadowSize: 2048, shadowRange: 110, post: true, ao: false, samples: 4, pixelRatio: 1.5, crowd: 54, guests: 140, grass: 60000 },
  ultra: { name: 'ultra', shadows: true, shadowSize: 4096, shadowRange: 140, post: true, ao: true, samples: 4, pixelRatio: 2, crowd: 72, guests: 190, grass: 120000 },
};

function loadQuality() {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (PRESETS[q]) return q;
  } catch (e) { /* ignore */ }
  return touch ? 'low' : 'high';
}

function setLoading(text) {
  const el = document.querySelector('#loading .msg');
  if (el) el.textContent = text;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function main() {
  setLoading('Loading the park...');
  const res = await fetch('park.json');
  if (!res.ok) throw new Error(`park.json: ${res.status}`);
  const data = await res.json();
  const cfg = data.config;
  setLoading('Building Benton Diesel World...');
  // sign text is drawn into textures, so wait (briefly) for the sign font
  try {
    await Promise.race([
      Promise.all([700, 800].map((w) => document.fonts.load(`${w} 40px "Barlow Semi Condensed"`))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to Arial Narrow */ }
  await nextFrame();

  // parking, traffic lanes and the security checkpoint join the park
  const entranceLayout = buildEntrance(data);
  // Overdrive, the new coaster beyond the west wall
  buildOverdrive(data);
  // the Backlot Tram Tour, reopened with its new Hollywood tents
  buildTramTour(data);
  // backstage, where the crews are setting up Benton Haunt
  buildBackstage(data);
  const familyLayout = buildFamilyBackstage(data);
  // Benton Haunt: six walk-through houses, a food stand and seven scare zones
  // (Benton Haunt is over: the houses, the food stand and the scare zones
  // are gone, and the backstages are being torn down)
  if (WOLVERINE_OPEN) addWolverineWalkway();
  // (at Christmas the same builder lays out the Christmas trails)
  // (at Easter: the walkthrough Inside the Egg on Stage 22)
  const houses = HAUNT_OVER ? (CHRISTMAS ? buildHouses(data, familyLayout, 'xmas') : EASTER ? buildHouses(data, null, 'easter') : []) : buildHouses(data, familyLayout);
  if (!HAUNT_OVER) buildHauntFood(data);
  const scareZones = HAUNT_OVER ? [] : buildScareZones(data);
  // the hotels, the Benton Parkway and the shuttle Transit Center
  const resort = buildResort(data);
  // Fast & Furious: Benton Street Run, past Velocity City (reopened with a zero-g roll)
  const ffLayout = buildFastFurious(data);
  if (XMAS_OVER && !WOLVERINE_OPEN) buildXmasTeardown(data);
  // Benton Holidays going up
  const xmasSetup = XMAS_SETUP && !CHRISTMAS ? buildXmasSetup(data) : null;
  // Wolverine, open past Backwoods
  const wvLayout = WOLVERINE_OPEN ? buildWolverine(data) : null;
  // Mardi Gras: the bar is back (in the backstage yard), and a new live show
  // in Stage 23 with its own line
  if (MARDI_GRAS) buildMardiGras(data, AT_BACKSTAGE);
  const msLayout = MARDI_GRAS ? buildMardiShow(data) : null;
  // Easter: the bar is the Easter Bar, and Meet the Easter Bunny is in Stage 23
  if (EASTER) buildMardiGras(data, AT_BACKSTAGE_EASTER);
  const ebLayout = EASTER ? buildEasterBunny(data) : null;
  // the New Year: Benton Nights becomes the New Year's Eve fireworks
  if (XMAS_OVER) {
    const bn = data.config.Shows.find((s) => s.id === 'BentonNights');
    if (bn) Object.assign(bn, { name: "New Year's Eve Fireworks", newYear: true, duration: 120, description: 'A countdown from ten, then a huge volley of gold and silver over the Benton Globe, twice the shells and a long finale. Happy New Year!' });
  }
  // Final Destination, going up on Stage 6 for next fall's Benton Haunt
  const fdLayout = FD_BUILDING ? buildFinalDestination(data) : null;
  // Diesel Run: the motion-simulator dark ride past Diesel District
  const drLayout = buildDieselRun(data);
  // The Diesel Heist: Diesel Run's replacement, in its building
  const dhLayout = drLayout.heist ? buildDieselHeist(data, drLayout) : null;
  // Stranger Things: Escape the Upside Down, east of Velocity City
  const stLayout = buildStrangerThings(data);
  // Escape Fuel Throttle: the robot-arm dark ride, north of Stranger Things
  const ftLayout = buildFuelThrottle(data);
  // Benton Boom Coaster: the boom coaster and dark ride, east of Throttle Works
  const bbLayout = buildBoomCoaster(data);
  // Construction Runaway: the robot-arm ride with the elevator, north of Throttle Works
  const crLayout = buildConstructionRunaway(data);
  // RV Van Run: an indoor motion-simulator road trip, past Construction Runaway
  const rvLayout = buildRVVanRun(data);
  // Neon Getaway: the indoor spinning coaster, south of RV Van Run
  const ngLayout = buildNeonGetaway(data);
  // King Mamba: the inverted coaster, north of RV Van Run
  const kmLayout = buildKingMamba(data);
  // Siren's Wake: the indoor inverted water coaster, south of Neon Getaway
  const swLayout = buildSirensWake(data);
  // Zero Space: the 4th-dimension coaster, south of Fast & Furious
  const zsLayout = buildZeroSpace(data);
  // Jungle Run: river rapids, south of Siren's Wake
  const jrLayout = buildJungleRun(data);
  // Benton Flash: the single-rail coaster, west of Construction Runaway
  const bfLayout = buildBentonFlash(data);
  // Override: the multi-launch coaster, south of Jungle Run
  const ovLayout = buildOverride(data);
  // Benton Roll: the indoor launched coaster, north of Benton Flash
  const brLayout = buildBentonRoll(data);
  // Ravage: the tilt coaster, out past the back lot
  const rvgLayout = buildRavage(data);
  // Benton Blitz: the multi-launch coaster in the canyon past Ravage
  const bzLayout = buildBentonBlitz(data);
  // Flying Fire: the wooden coaster that goes upside down, north of the canyon
  const ffLayout2 = buildFlyingFire(data);
  // Cyclone: the compact beyond-vertical coaster, north of Flying Fire
  const cyLayout = buildCyclone(data);
  // Harbor Run: the robot-arm dark ride at Pier 9, north of Cyclone
  const hrLayout = buildHarborRun(data);
  // Speed Breaker: the strata coaster, north of Harbor Run
  const sbLayout = buildSpeedBreaker(data);
  // RC Race: the stand-up coaster, north of Speed Breaker
  const rcLayout = buildRCRace(data);
  // summer: the summer parades, and Sun Swinger on the speed-trials ground
  const summerLayout = buildSummer(data, { parades: SUMMER });
  // Operation: Win the Crown: the indoor RMC coaster, north of RC Race
  const wcLayout = buildWinTheCrown(data);
  // Jungle Raid: the Mack-style coaster with the hold over the edge, north of Win the Crown
  const jraLayout = buildJungleRaid(data);
  // BLACKLINE: The Last Train, the haunted subway dark ride south of Ravage
  const blLayout = buildBlackline(data);
  // the Lower Lot: dug out south of Zero Space, escalators down, three new lands
  const llLayout = buildLowerLot(data);
  // Snowball: the mine train in Frostbite Base
  const sbwLayout = buildSnowball(data);
  // Neon Gliders: the indoor suspended coaster in Neon District
  const glLayout = buildNeonGliders(data);
  // road work on the parkway by the Grand Hotel
  buildRoadWork(data);
  // the cast members' door, in the front wall beside the gate
  buildCastDoor(data, partHelpers);
  // NATURAL KINGDOM: the second park, over the parkway (its ground, lands, gate and bridge, then its rides)
  const nkSite = buildNaturalKingdom(data);
  nkSite.addItems();
  buildNKRides(data, nkSite);
  // Under the Seas: the indoor launched coaster in Natural Kingdom's Coral Coast
  const utsLayout = buildUnderTheSeas(data);
  const mxLayout = buildMexicoTour(data);
  // Benton Haunt's houses inside ride buildings (once the rides are in)
  if (!HAUNT_OVER && RIDE_HOUSES_OPEN) houses.push(...buildHouses(data, null, 'rides'));
  // summer overlays: six rides get summer makeovers (after every ride is in)
  const soLayout = SUMMER ? buildSummerOverlays(data) : null;
  if (soLayout) console.log('summer overlays:', soLayout.overlays.map((o) => `${o.name} ${JSON.stringify(o.made)}${o.arch ? ' +arch' : ''}`).join(' | '));
  // Benton Holidays: decorations, ride lights and Santa's Workshop (after
  // every ride is in, so they all get lights and the decorations miss them)
  const xmasLayout = CHRISTMAS ? buildChristmas(data) : null;
  // Express lines, Front of the Line tickets and extended queues
  buildLineTickets(data);
  const extended = buildExtendedQueues(data);
  console.log(`extended queues: ${extended}`);
  // bins, benches, hydrants, planters, fountains and manholes along the paths
  console.log(`street details: ${buildStreetDetails(data)}`);
  // (a longer day: a park minute is 4 real seconds from 7:00 AM to 11:00 PM -
  // the cast's setup and early entry get 4 minutes each, the park's open for
  // 52 - and the night goes by 12 times faster; the day starts at 7:45 AM,
  // as the cast finish getting ready)
  Clock.configure({ ...cfg.Clock, DAY_START: 420, MINUTE: 4, NIGHT_SPEED: 12 });
  Clock.start(465);

  const canvas = document.getElementById('view');
  installAtmosphere(); // height fog and sunlit haze, before anything compiles
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 3200);

  let qualityName = loadQuality();
  // (whether you've picked a graphics setting yourself: if not, and your
  // machine can't keep up on High, the game drops to Low for you once)
  const qualityChosen = (() => { try { return !!PRESETS[localStorage.getItem(QUALITY_KEY)]; } catch (e) { return true; } })();
  configureMaterials({ size: qualityName === 'low' ? 256 : 512, aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  geomOptions.bevel = qualityName !== 'low';
  geomOptions.maxLod = qualityName === 'low' ? 1 : 2;
  const world = new World(scene, data, PRESETS[qualityName], renderer);
  const post = new Post(renderer, scene, camera);
  const life = new Life(scene, PRESETS[qualityName]); // the horizon, birds, planes, flags
  const collision = new Collision(data.static, world.terrain);
  // the walking map guests and cast members find their way with
  let nav = null;
  try {
    nav = new NavGrid(data, world.terrain, { extra: HAUNT_OVER ? [] : [[BS.x0, BS.z0, BS.x1, BS.z1]] });
    nav.gateGroup = nav.comp[nav.nearest(0, 0.42, 279, 15)];
  } catch (e) {
    console.warn('walking map failed, guests stroll the old walkways', e);
    nav = null;
  }
  const guests = new GuestFactory();
  const rideVis = new RideVisuals(scene, data, (seed, pose) => guests.make(seed, pose));
  rideVis.frame = 0;
  const fx = new Effects(scene, data);
  const audio = new GameAudio(data);
  // explosions and fireworks are heard as well as seen
  const explode = fx.explosion.bind(fx);
  fx.explosion = (at, scale) => { explode(at, scale); audio.explosion(at, scale); };
  const burst = fx.firework.bind(fx);
  fx.firework = (at, color, size) => { burst(at, color, size); audio.firework(at, size); };
  const shows = new ShowRunner({ scene, materials: data.materials, guests, fx, tags: data.tags, audio });
  const guide = new Guide(scene);
  const thumbs = new Thumbs(data);
  const input = new Input(canvas, document.getElementById('hud'));
  input.enabled = false;

  const rideCfg = new Map(cfg.Rides.map((r) => [r.id, r]));
  const signRides = cfg.Rides.map((r) => {
    const land = cfg.Lands.find((l) => l.id === r.land);
    return { ...r, landInfo: { name: land.name, colorCss: `#${land.color.toString(16).padStart(6, '0')}` } };
  });

  const game = { data, input, guide, thumbs, qualityName, audio, camera };
  const sim = new Sim(data, {
    toast: (text, kind, amount) => game.ui?.toast(text, kind, amount),
    sound: (kind) => audio.ui(kind),
    startRide: (id, car, seat) => {
      if (rideCfg.get(id).kind === 'walkthrough') {
        // a haunted house (or a Christmas trail): the group walks it
        game.walk = id;
        audio.voice.say(rideCfg.get(id).category === 'Christmas Trail'
          ? `Welcome to ${rideCfg.get(id).name}. Stay with your group, take your time, and enjoy the lights. Merry Christmas!`
          : `Welcome to ${rideCfg.get(id).name}. Stay with your group, keep moving, and do not touch the scare actors. Good luck...`, { interrupt: true });
        return;
      }
      player.riding = { id, car, seat, matrix: rideVis.seatMatrix(id, car, seat) || new THREE.Matrix4(), standing: !!data.rides.find((r) => r.id === id)?.standing };
      const name = rideCfg.get(id).name;
      const kind = data.rides.find((r) => r.id === id)?.crew?.restraint;
      // the station spiel: restraints down, a team member will check them
      const lines = kind === 'lapbar'
        ? [`Welcome aboard ${name}! Please pull down on your lap bar until it locks. A ride attendant will be by to check it.`]
        : kind === 'harness'
          ? [`Welcome aboard ${name}! Pull your shoulder harness all the way down. Our team will check every harness before we go.`]
          : kind === 'belt'
            ? [`Welcome to ${name}! Please fasten your seatbelt. A team member will check it before you roll out.`]
            : [`Welcome aboard ${name}! Please keep your hands, arms, feet and legs inside the vehicle, and enjoy the ride!`];
      audio.voice.say(lines[0], { interrupt: true });
    },
    endRide: (id) => {
      if (game.walk === id) game.walk = null;
      const r = rideCfg.get(id);
      // step off a few studs past the exit sign, facing away from the ride
      let dx = r.exit[0] - r.origin[0], dz = r.exit[2] - r.origin[2];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      player.stopRiding({ pos: new THREE.Vector3(r.exit[0] + dx * 6, (r.exit[1] || 0) + 3, r.exit[2] + dz * 6), yaw: Math.atan2(-dx, -dz) }); // (exits down in the Lower Lot are far below)
      player.snapCamera();
    },
    onProfile: () => {
      if (!game.ui) return;
      if (game.ui.tab === 'Bag' || game.ui.tab === 'Passport') game.ui.refresh();
      else if (game.ui.venueOpen && game.ui.venueOpen !== 'settings') game.ui.renderVenueModal();
    },
  });
  game.sim = sim;
  const player = new Player(scene, data, collision, sim.profile.look);
  game.player = player;
  const people = new CrowdRenderer(scene, { shadows: PRESETS[qualityName].shadows });
  const bubbles = new Bubbles(scene);
  // Benton Haunt's scare actors, in the houses and the scare zones
  const scares = new ScareActors(scene, data, { sound: (k) => audio.ui(k), bubbles });
  game.scares = scares;
  const queueCrowd = new QueueCrowd(people, data, sim.paths);
  const houseWalks = new HouseWalks(houses, people);
  let queueSnap = true; // place guests already in line without walking them in
  // guests with somewhere to be (or, without a walking map, the old strollers)
  let crowd = nav ? new GuestFlow(people, nav, data, sim, PRESETS[qualityName].guests, { exclude: NK_LANDS }) : new Crowd(people, PRESETS[qualityName].crowd);
  // (and Natural Kingdom's own, in through its gate)
  const nkCrowd = nav ? new GuestFlow(people, nav, data, sim, Math.round(PRESETS[qualityName].guests * 0.6), { gate: { x: NK_INSIDE[0], y: NK_INSIDE[1], z: NK_INSIDE[2] }, lands: NK_LANDS }) : null;
  game.guests = crowd;
  game.nkGuests = nkCrowd;
  const staff = new StaffSystem({
    data, people, rideVis, sim, bubbles,
    hooks: { toast: (text, kind) => game.ui?.toast(text, kind), sound: (k) => audio.ui(k), latch: () => audio.ui('latch') },
  });
  game.staff = staff;
  const entrance = new Entrance({
    scene, data, layout: entranceLayout, people, staff,
    hooks: { sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) },
  });
  const transit = new Transit({
    scene, data, layout: resort, people, entrance, player,
    hooks: { sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind), voice: (text) => audio.voice.say(text, { interrupt: true }) },
  });
  game.transit = transit;
  const christmas = xmasLayout ? new Christmas({ scene, data, layout: xmasLayout, people, bubbles, player, sim, hooks: { sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) } }) : null;
  game.christmas = christmas;
  game.entrance = entrance;
  // the park day: hours, announcements, the gate, chains and shutters, closing time
  const parkDay = new ParkDay({
    scene, data, sim, nav, player, gates: [MAIN_GATE, NK_GATE],
    hooks: {
      toast: (text, kind) => game.ui?.toast(text, kind), say: (text) => audio.voice.say(text, { interrupt: true }), entrance,
      fireworks: () => { for (let k = 0; k < 3; k++) setTimeout(() => fx.tramCue('fireworks', new THREE.Vector3(-30 + k * 30, 40, 240)), k * 700); },
    },
  });
  game.parkDay = parkDay;
  game.clock = Clock; // (handy for debugging from the console)
  if (nav) staff.day = { nav, doors: [new THREE.Vector3(CAST_DOOR.x, CAST_DOOR.y, CAST_DOOR.z), new THREE.Vector3(NK_DOOR.x, NK_DOOR.y, NK_DOOR.z), new THREE.Vector3(...FIESTA_DOOR)] };
  game.scareZones = scareZones;
  game.houses = houses;
  const xsSite = xmasSetup ? new XmasSetupSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, xmasSetup) : null;
  const crSite = new ConstructionRunawaySite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, crLayout);
  const brSite = new BentonRollSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, brLayout);
  const rvgSite = new RavageSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, rvgLayout);
  const bzSite = new BentonBlitzSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, bzLayout);
  const ffSite2 = new FlyingFireSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ffLayout2);
  const cySite = new CycloneSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, cyLayout);
  const hrSite = new HarborRunSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, hrLayout);
  const sbSite = new SpeedBreakerSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, sbLayout);
  const rcSite = new RCRaceSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, rcLayout);
  const wcSite = new WinTheCrownSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, wcLayout);
  const jraSite = new JungleRaidSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, jraLayout);
  const sbwSite = new SnowballSite({ toast: (text, kind) => game.ui?.toast(text, kind) }, sbwLayout);
  const glSite = new NeonGlidersSite({ toast: (text, kind) => game.ui?.toast(text, kind) }, glLayout);
  const utsSite = new UnderTheSeasSite({ toast: (text, kind) => game.ui?.toast(text, kind) }, utsLayout);
  const mxSite = new MexicoTourSite({ toast: (text, kind) => game.ui?.toast(text, kind) }, mxLayout);
  const llSite = new LowerLotSite({ toast: (text, kind) => game.ui?.toast(text, kind) }, llLayout);
  const soSite = soLayout ? new SummerOverlaySite({ toast: (text, kind) => game.ui?.toast(text, kind) }, soLayout) : null;
  const blSite = new BlacklineSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind), voice: (text) => audio.voice.say(text, { interrupt: true }), crackle: () => audio.crackle(), rumble: () => audio.rumble(player.pos) }, blLayout);
  const ssSite = SUMMER ? new SunSwingerSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, summerLayout) : null;
  const ovSite = new OverrideSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ovLayout);
  const bfSite = new BentonFlashSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, bfLayout);
  const jrSite = new JungleRunSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, jrLayout);
  const zsSite = new ZeroSpaceSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, zsLayout);
  const swSite = new SirensWakeSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, swLayout);
  const kmSite = new KingMambaSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, kmLayout);
  const ngSite = new NeonGetawaySite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ngLayout);
  const rvSite = new RVVanRunSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, rvLayout);
  const bbSite = new BoomCoasterSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, bbLayout);
  const ftSite = new FuelThrottleSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ftLayout);
  const stSite = new StrangerThingsSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, stLayout);
  const drSite = new DieselRunSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, drLayout);
  const dhSite = dhLayout ? new DieselHeistSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, dhLayout) : null;
  const fdSite = fdLayout ? new FinalDestinationSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, fdLayout) : null;
  const ebSite = ebLayout ? new EasterBunnySite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ebLayout) : null;
  const eggHunt = EASTER ? new EggHunt({ scene, fx, sim, hooks: { sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) } }) : null;
  const msSite = msLayout ? new MardiShowSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, msLayout) : null;
  const wvSite = wvLayout ? new WolverineSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, wvLayout) : null;
  const ffSite = new FastFuriousSite({ sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) }, ffLayout);
  const backstage = new Backstage({ family: FB, sound: (k) => audio.ui(k), toast: (text, kind) => game.ui?.toast(text, kind) });

  game.applyWear = () => {
    const eq = sim.profile.equipped;
    player.setWear('hat', eq.hat, data.items);
    player.setWear('face', eq.face, data.items);
    player.setWear('held', eq.held, data.items);
    player.setBalloon(eq.balloon, data.items);
  };
  game.applyLook = () => {
    player.setLook(sim.profile.look);
    game.applyWear();
  };
  // teleport straight to a ride's entrance (or a show, or a restaurant),
  // facing it; you step out of any line you're in, but not off a ride
  // free cam: fly the camera anywhere (C, or the 🎥 button)
  game.toggleFreeCam = (on = !player.freeCam) => {
    if (!started && on) return false;
    if (!!player.freeCam === on) return on;
    player.setFreeCam(on, camera);
    document.body.classList.toggle('freecam', on);
    if (!on) document.body.classList.remove('cleanshot');
    $freecamHud.hidden = !on;
    input.fly.up = input.fly.down = false;
    if (on) { game.ui?.open?.(null); game.ui?.toast(document.body.classList.contains('touch') ? '🎥 Free cam on - fly with the stick, drag to look, ▲▼ to rise and fall.' : '🎥 Free cam on - WASD to fly, Space/E up, Q down, Shift for speed, drag to look. C or Esc to come back.', 'info'); }
    audio.ui(on ? 'open' : 'close');
    return on;
  };
  const $freecamHud = document.querySelector('#freecam-hud');
  game.teleportTo = (pos, name, face) => {
    if (player.freeCam) game.toggleFreeCam(false);
    if (player.riding || game.walk) { game.ui?.toast("You can't teleport while you're on a ride!", 'warn'); return false; }
    if (sim.queueRide) sim.leave(true);
    player.pos.set(pos[0], (pos[1] || 0) + 3, pos[2]);
    player.vel.set(0, 0, 0);
    const dx = (face?.[0] ?? pos[0]) - pos[0], dz = (face?.[2] ?? pos[2] - 1) - pos[2];
    player.yaw = Math.atan2(-dx, -dz);
    player.camYaw = player.yaw;
    player.snapCamera();
    game.guide?.clear?.();
    audio.ui('open');
    game.ui?.toast(`Teleported to ${name}!`, 'info');
    return true;
  };
  game.teleportHome = () => {
    if (player.riding) return;
    player.pos.set(cfg.Spawn[0], 3, cfg.Spawn[2]);
    player.vel.set(0, 0, 0);
    player.yaw = 0;
    player.camYaw = 0;
    player.snapCamera();
  };
  game.resetProgress = () => {
    try { localStorage.removeItem('bentonDieselWorld.v1'); } catch (e) { /* ignore */ }
    location.reload();
  };
  game.clockNow = Clock.now;
  game.clock = Clock; // (for testing: skip to a time of day)
  game.xmasSetup = xmasSetup;
  game.skipClock = (seconds) => Clock.skip(seconds); // handy for debugging
  game.skipTo = (show) => {
    const s = sim.showStatus(show);
    if (s.now || sim.ridingRide) return;
    Clock.skip(Math.max(0, s.seconds - 3));
    game.ui.toast(`Time flies! ${show.name} starts in a few minutes.`, 'show');
  };

  const applyQuality = () => {
    const preset = PRESETS[qualityName];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
    renderer.shadowMap.enabled = preset.shadows;
    world.sky.setShadowQuality(preset);
    world.setQuality(preset);
    scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
    resize();
    post.configure(preset);
    resize();
  };
  game.setQuality = (q) => {
    qualityName = q;
    game.qualityName = q;
    try { localStorage.setItem(QUALITY_KEY, q); } catch (e) { /* ignore */ }
    if (crowd instanceof GuestFlow) { crowd.setMax(PRESETS[q].guests); nkCrowd?.setMax(Math.round(PRESETS[q].guests * 0.6)); } else crowd = new Crowd(people, PRESETS[q].crowd);
    people.setShadows(PRESETS[q].shadows);
    applyQuality();
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 65;
    camera.updateProjectionMatrix();
    fx.setViewport(h * renderer.getPixelRatio(), camera.fov);
    post.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  applyQuality();

  game.social = new Social(game);
  const ui = new UI(game);
  game.ui = ui;
  game.rideVis = rideVis;
  game.world = world;
  window.bentonDieselWorld = game; // handy for debugging from the console
  game.applyWear();

  // ---------------------------------------------------------------- loop
  let started = false;
  let indoor = 0;
  const hauntLights = new HauntLights(scene, data.hauntLights || []);
  let wasOnGround = true;
  let fallSpeed = 0;
  let last = performance.now();
  let signTimer = 0;
  let time = 0;
  const firedCues = new Set();
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  // a slow machine on High (under 24 frames a second for two 6-second
  // stretches in a row) drops to Low once, unless you chose a setting
  const autoQuality = { off: qualityChosen || qualityName === 'low', ms: 0, n: 0, slow: 0 };
  function frame() {
    const nowMs = performance.now();
    const rawMs = nowMs - last;
    const dt = Math.min(0.05, rawMs / 1000);
    last = nowMs;
    if (started && !autoQuality.off && rawMs < 1000) { // (a tab left in the background is a pause, not a slow frame)
      autoQuality.ms += rawMs;
      autoQuality.n++;
      if (autoQuality.ms > 6000) {
        autoQuality.slow = autoQuality.n / (autoQuality.ms / 1000) < 24 ? autoQuality.slow + 1 : 0;
        autoQuality.ms = 0;
        autoQuality.n = 0;
        if (autoQuality.slow >= 2) {
          autoQuality.off = true;
          game.setQuality('low');
          game.ui.toast('Graphics switched to Low to keep things smooth. You can change it in ⚙ Settings.', 'info');
        }
      }
    }
    time += dt;
    const now = Clock.now();

    if (started) {
      sim.update(player.pos);
      const mv = sim.movement();
      player.speed = mv.speed;
      player.jumpBoost = mv.jump;
      ui.handleKeys(input);
    }

    // rides
    rideVis.frame++;
    camPos.copy(camera.position);
    for (const st of sim.order) {
      const r = st.cfg;
      const t = sim.rideTime(st.id, now);
      const busy = st.status === 'Boarding' || st.status === 'Running' || st.status === 'Unloading';
      rideVis.setRiders(st.id, busy ? st.riders : []);
      const mine = sim.ridingRide === st.id;
      const far = !mine && Math.hypot(r.origin[0] - camPos.x, r.origin[2] - camPos.z) > 500;
      const pose = rideVis.pose(st.id, t, far);
      if (r.cues && t > 0 && pose) {
        r.cues.forEach((cue, i) => {
          const at = cue[0] * st.duration;
          const key = `${st.id}:${st.cycleId}:${i}`;
          if (t >= at && t < at + 1 && !firedCues.has(key)) {
            firedCues.add(key);
            tmp.set(cue[2][0], cue[2][1], cue[2][2]).applyMatrix4(pose.cars[0]);
            fx.tramCue(cue[1], tmp);
          }
        });
      }
    }
    if (rideVis.frame % 4 === 0) rideVis.cullRiders(camPos);
    if (player.riding && !player.riding.transit) {
      const m = rideVis.seatMatrix(player.riding.id, player.riding.car, player.riding.seat);
      if (m) player.riding.matrix = m;
    }

    people.begin(camera.position);
    // shuttles, parkway traffic and your car
    transit.update(dt, camera.position);
    christmas?.update(dt, camera.position, indoor);
    if (player.riding?.transit) {
      const m = transit.seatMatrix();
      if (m) player.riding.matrix = m;
    }
    queueCrowd.update(dt, time, sim.order, camera.position, queueSnap);
    houseWalks.update(sim, now, camera.position);
    queueSnap = false;

    if (started) {
      // in a queue line: shuffle forward with the line when not steering
      const slot = player.riding ? null : sim.playerSlot();
      player.autopilot = slot ? sim.lineTarget(player.pos) : null;
      player.faceDir = slot ? slot.path.pointAt(slot.s) : null;
      // walking a haunted house with your group
      const walk = game.walk && houseWalks.playerTarget(sim, game.walk, now, player.pos);
      if (walk) {
        if (walk.lost) player.pos.set(walk.here.x, player.pos.y, walk.here.z);
        player.autopilot = walk.target;
      }
      player.update(dt, input, camera);
    } else {
      // attract mode: slow orbit over the park
      const a = time * 0.05;
      camera.position.set(Math.sin(a) * 330, 170, -40 + Math.cos(a) * 330);
      camera.lookAt(0, 20, -40);
      player.holder.position.copy(player.pos);
    }

    world.spinGlobe(time);
    world.spinSpinners(time, camera.position);
    const lamp = world.spinners.find((sp) => sp.name === 'LighthouseLamp');
    if (lamp) fx.lighthouseAngle = lamp.angle;
    waterTime.value = time;
    world.updateGrass(time, camera.position);
    const daylight = world.updateLighting(started ? player.pos : new THREE.Vector3(0, 0, -40), time);
    life.update(dt, time, daylight);
    atmos.x = time; // drifting cloud shadows
    // inside a haunted house the daylight is shut out, and the rooms' own
    // colored lights take over
    const inBox = (r) => player.pos.x > r.x0 && player.pos.x < r.x1 && player.pos.z > r.z0 && player.pos.z < r.z1;
    // (and inside the Fast & Furious warehouse, where it is always night)
    const inHouse = started && (houses.some((h) => inBox(h.rect)) || inBox(ffLayout.indoor) || inBox(drLayout.indoor) || inBox(stLayout.indoor) || inBox(ftLayout.indoor) || inBox(bbLayout.indoor) || inBox(crLayout.indoor) || inBox(rvLayout.indoor) || inBox(ngLayout.indoor) || inBox(swLayout.indoor) || inBox(brLayout.indoor) || inBox(rvgLayout.indoor) || inBox(bzLayout.indoor) || inBox(hrLayout.indoor) || inBox(wcLayout.indoor) || inBox(blLayout.indoor) || inBox(glLayout.indoor) || inBox(utsLayout.indoor) || inBox(mxLayout.indoor) || (msLayout && inBox(msLayout.indoor)) || (ebLayout && inBox(ebLayout.indoor)));
    indoor += ((inHouse ? 1 : 0) - indoor) * Math.min(1, dt * 3);
    world.sky.sun.intensity *= 1 - 0.95 * indoor;
    world.sky.fill.intensity *= 1 - 0.85 * indoor;
    scene.environmentIntensity = 1 - 0.9 * indoor;
    // BLACKLINE's blackout: the lights in the tent die
    {
      const blT = sim.rideTime(BL_ID, now), st = sim.rides.get(BL_ID);
      blSite.update(dt, player.pos, started, { riding: sim.ridingRide === BL_ID, queue: sim.queueRide === BL_ID, t: blT, cycle: st?.cycleId });
      hauntLights.groups = blSite.lampGroups(blT);
      if (blSite.dark > 0.01) {
        world.sky.sun.intensity *= 1 - blSite.dark;
        world.sky.fill.intensity *= 1 - 0.9 * blSite.dark;
        scene.environmentIntensity *= 1 - 0.8 * blSite.dark;
      }
    }
    hauntLights.update(dt, player.pos, indoor, 1 - daylight);
    signTimer -= dt;
    if (signTimer <= 0) {
      signTimer = 1;
      world.updateSigns(signRides, (id) => sim.rideState(id));
    }
    if (crowd instanceof GuestFlow) { crowd.update(dt, camera.position); nkCrowd?.update(dt, camera.position); } else crowd.update(dt, time);
    parkDay.update(dt, started);
    staff.update(dt, now, time, camera.position, player.pos);
    if (started) scares.update(dt, camera.position, player.pos);
    entrance.update(dt, camera.position, player.pos);
    backstage.update(dt, player.pos, started);
    ffSite.update(dt, player.pos, started);
    wvSite?.update(dt, player.pos, started);
    msSite?.update(dt, player.pos, started);
    ebSite?.update(dt, player.pos, started);
    eggHunt?.update(dt, player.pos, started);
    fdSite?.update(dt, player.pos, started);
    drSite.update(dt, player.pos, started);
    dhSite?.update(dt, player.pos, started);
    stSite.update(dt, player.pos, started);
    ftSite.update(dt, player.pos, started);
    bbSite.update(dt, player.pos, started);
    crSite.update(dt, player.pos, started);
    rvSite.update(dt, player.pos, started);
    ngSite.update(dt, player.pos, started);
    kmSite.update(dt, player.pos, started);
    swSite.update(dt, player.pos, started);
    zsSite.update(dt, player.pos, started);
    jrSite.update(dt, player.pos, started);
    bfSite.update(dt, player.pos, started);
    ovSite.update(dt, player.pos, started);
    brSite.update(dt, player.pos, started);
    rvgSite.update(dt, player.pos, started);
    bzSite.update(dt, player.pos, started, sim.queueRide === 'BentonBlitz');
    ffSite2.update(dt, player.pos, started);
    cySite.update(dt, player.pos, started);
    hrSite.update(dt, player.pos, started);
    sbSite.update(dt, player.pos, started);
    rcSite.update(dt, player.pos, started);
    ssSite?.update(dt, player.pos, started);
    wcSite.update(dt, player.pos, started);
    jraSite.update(dt, player.pos, started);
    soSite?.update(dt, player.pos, started);
    llSite.update(dt, player.pos, started);
    sbwSite.update(dt, player.pos, started);
    glSite.update(dt, player.pos, started);
    utsSite.update(dt, player.pos, started);
    mxSite.update(dt, player.pos, started);
    xsSite?.update(dt, player.pos, started);
    people.end();
    rideVis.animateRestraints(dt);
    bubbles.update(dt, camera.position);
    const caption = shows.update(sim.shows, now, player.pos);
    fx.update(dt, daylight);
    if (started) {
      camera.updateMatrixWorld();
      const flat = Math.hypot(player.vel.x, player.vel.z);
      if (!player.riding && player.onGround && !wasOnGround && fallSpeed < -40) audio.ui('land');
      if (!player.riding && !player.onGround && wasOnGround && player.vel.y > 20) audio.ui('jump');
      fallSpeed = player.vel.y;
      wasOnGround = player.onGround;
      const land = ui.landAt(player.pos);
      audio.update({
        dt, camera, now, daylight, caption, sim,
        land: land ? land.id : (audio.land || 'Plaza'),
        crowd: Clock.crowd(Clock.minutes()),
        inPark: true,
        riding: sim.ridingRide,
        showPos: shows.audioPos,
        walking: !player.riding && player.onGround && flat > 3,
        stepRate: player.figure.stepRate,
      });
    }
    const guideDist = guide.update(player.pos, time, (name) => ui.toast(`You've arrived at ${name}!`, 'info'));

    game.social?.update(started);
    if (started) ui.update(dt, { pos: player.pos, caption, guideDist, movement: sim.movement() });
    input.endFrame();
    post.render(1 - daylight);
    game.social?.capture(canvas); // a photo, if one was asked for
    requestAnimationFrame(frame);
  }

  document.getElementById('loading').hidden = true;
  requestAnimationFrame(frame);
  ui.showStart(() => {
    started = true;
    input.enabled = true;
    // sound has to start from this click
    audio.start(rideVis);
    setTimeout(() => audio.voice.say('Welcome to Benton Diesel World, where speed fuels people together!'), 900);
    // start the day beside your car in the lot you picked
    entrance.arrive(game.parkingTier || 'Regular', player, sim, sim.profile.look.shirt);
    player.snapCamera();
    document.getElementById('hud').hidden = false;
    document.body.classList.toggle('touch', touch);
    sim.dailyBonus();
    const land = ui.landAt(player.pos);
    if (land) {
      ui.currentLand = land.id;
      ui.banner(cfg.ParkName, 'Speed fuels people together', land.color);
    }
    setTimeout(() => ui.toast('Welcome to Benton Diesel World! Open Wait Times to plan your day.', 'info'), 600);
  });
}

main().catch((err) => {
  console.error(err);
  setLoading(`Sorry - the park failed to load (${err.message}). Try reloading the page.`);
});
