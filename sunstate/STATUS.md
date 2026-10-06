# Status

Updated at each milestone handoff: what works, what was verified and how, what's still unverified, known issues, and the next task.

## Milestone 1: Runnable foundation (complete)
**Gate:** explore and drive for five minutes without a blocking error. **Met** in simulation (details below).

- Boot → title flyover → New Game / Continue → play → pause.
- Third-person character: run, sprint, jump, crouch, swim, climb out. The camera rig has wall and ceiling collision, an over-the-shoulder aim mode, and a vehicle chase cam with auto-centring.
- Ocean Mile district: roads, signals, buildings, beach, causeway, interiors (see README).
- Two distinct drivable cars at the safehouse (Kestrel LX sedan, Ironhorse 455 muscle car), plus a pickup and a police cruiser.
- Enter and exit with blocked-door handling, carjacking, and no entry through walls.
- Traffic with lanes, signals, obstacle braking and recovery. Pedestrians with activities and reactions.
- Settings (graphics, audio, interface, world, controls with rebinding), all functional and persisted.

## Milestone 2: Complete crime loop (complete)
**Gate:** complete the full loop and reload the earned progress. **Met** (e2e run below).

- Mission *Small Change*:
  - start at the motel marker → drive to the Sunny Stop → enter with the pistol
  - aim at the clerk (hold-up) → keep them covered while the register is bagged → grab the cash
  - the silent alarm reports a robbery (2★) → lose the police → return to the motel → MISSION PASSED + autosave
- Witness/report logic, police dispatch out of view, pursuit, search area, escape, arrest (1★), shooting (2★+).
- Death (WASTED → hospital, bill) and arrest (BUSTED → precinct, fine, ammo confiscated) both respawn safely.
- Mission failure (killed, arrested, clerk dead, alarm before payout) shows the reason and offers a retry from the checkpoint. Actors are cleaned up and never duplicated.
- Versioned save: validation, a backup copy, corrupt-data recovery, owned cars without duplicates.

## Milestone 3: World and partner (complete)
**Gate:** both protagonists playable with switching; a second region reached by a twin-span bridge; a two-person mission with driver/passenger roles; rain. **Met** (e2e runs below).

- **Cal and Sol**, with switching on Tab. Each keeps their own health, armour, weapons and ammo, position and car; money is shared.
  - The switch rules are our own design (see docs/REFERENCES.md #15).
  - Save v2 stores both protagonists; v1 saves migrate.
- **Partner AI:**
  - follows you or waits (G), and dodges cars
  - boards your car, or takes the wheel when you press G by an empty car
  - drives to the objective or your waypoint, and parks on request
  - gets out with you and shoots back at mission enemies
  - is taken to hospital when downed
- **Passenger drive-by** shooting.
- **Cayo Lento**, reached by the twin-span bridge.
  - The key has a loop of roads, a marina and pier, shops and houses, and mangroves.
  - Around it are shallow swimmable flats and the further keys as backdrop.
- **Mission "Low Tide":** drive to the marina, meet Rudy on the pier, then the ambush and a chase where one drives and the other shoots (Tab swaps). Then the police if any, the return to the motel, and the $4,000 payout. It has checkpoints, a failure reason and a retry.
- **LOOP social feed (P):**
  - ambient local posts and rain complaints
  - witness clips of your crimes, naming the street
  - news reports when a job is done
  - posts about the crew also appear as notifications
- **Rain:** a weather cycle with overcast skies, rain streaks, thunder, wet glossy roads with 30 % less grip, headlights, hurrying pedestrians and rain audio. A setting pins it to clear or rain.

## After M3: the living city (complete)
Asked for: AI that remembers you, a more advanced LOOP with AI-written posts and reels, and places such as gas stations, parks, an auto shop and a strip club.

- **City memory** (`src/game/memory.js`):
  - police descriptions (outfit and car, lasting ten in-game hours) and recognition by patrol officers
  - notoriety per area, a nickname, and street fame (people film you, and at the top end call it in)
  - staff who remember Cal and Sol separately
  - the Calderas' grudge hunts after *Low Tide*
  - all of it saved
- **Places** (`src/game/places.js`): Bayfront Arms (guns), Threads on 5th (clothes), Sunshine Gas, Coral Auto Body (repair, respray and new plates), Velvet Palms, and Bayshore Park.
  - Velvet Palms is an adults-only club, shown as the exterior and the door only, with nothing explicit. It is open from 8 PM to 4 AM.
  - Each place has a map blip.
  - The Sunny Stop clerk now remembers being robbed.
- **LOOP:** witness and fan reels filmed from their phones (live 90×160 renders) that play in the feed, persona voices and replies, and trending topics.
  - Claude-written posts on Y, through the claude.ai `sample` capability. They need the viewer's consent and use the viewer's own Claude usage. If the runtime isn't there, the key does nothing and the feed stays on built-in text.

## Verification

Container: 4 CPU cores, no GPU. Chromium renders through SwiftShader on the CPU, so **frame rates measured here say nothing about real hardware**. The tests advance the simulation directly (`window.__sun.advance`) and render occasionally.

- `npm test`: **75/75** Node checks. They cover:
  - road connectivity, lanes on asphalt, sidewalks clear of buildings, no street furniture standing on roads, free spawn/marker points, the store doorway open and the walls solid, parked cars clear of walls, causeway continuity and boat clearance
  - ray, OBB and capsule maths
  - car physics: sedan 0–60 mph in 6.8 s, muscle car 5.7 s, pickup 7.3 s; top speed ~93 mph; 60–0 mph in ~40 m; a stable 10 m full-lock circle; pulling away from rest at full lock; a handbrake slide; reversing; parked cars staying put; no driving through a wall at 30 m/s; crash damage; momentum conserved in car–car collisions
  - characters: walls, curbs, falling into water, climbing out
  - wanted: witness call → report, search-area escape, cancelled calls, rate-limited escalation
  - save/settings: validation, version handling, backup, rebinding swaps
  - **M3:**
    - both twin-span decks are continuous, the gap between them is open water behind railings, and boats fit under
    - Cayo Lento is dry land with roads at grade; the flats are swimmable, not wadeable
    - the marina is reachable by road from the motel; twin-span lanes sit one direction per deck
    - save v2 and v1 migration
    - the weather cycle, wet roads drying slowly, and the setting pinning the weather
    - wet braking ~19 % longer (47 m vs 39.5 m from 60 mph)
    - an AI "hold still" never rolls back
    - LOOP: witness clips naming the street, likes growing, news posts, the feed cap and unread count
- `npm run e2e`: **49/49** in headless Chromium on the final M3 build (520 s wall time). The run covers:
  - title → New Game → walk, sprint, jump
  - mission marker prompt → mission start → skip dialogue
  - enter a parked car with F, then a drive through traffic to the store (32 s)
  - exit to a clear spot → switch to the pistol → walk in → aim at the clerk → $1,800 bagged → grab the cash
  - the silent alarm reports a robbery (2★) → police dispatched out of view → wanted level cleared by the search rules (27 s)
  - drive back to the motel → MISSION PASSED → autosave → page reload → Continue, with the same money and progress and no duplicated cars
  - WASTED → hospital (bill charged, controls work); BUSTED at 1★ → released at the precinct
  - killing the clerk fails the mission with a reason → retry from checkpoint without duplicated actors
  - pause freezes the simulation; a blocked driver door makes you exit on the other side; you can't enter a car through a wall
  - **5 minutes of simulated driving through traffic: 1.7 km, populations bounded (≤34 vehicles, ≤53 people), no page errors**

  Two parts of the e2e are scripted rather than "played", and they're labelled in `tools/e2e.mjs`:
  - **Driving.** The test drives the player's car with the traffic AI (same physics), starting from a car on Palmetto Ave. The AI follows lanes; it doesn't do parking-lot manoeuvres.
  - **The getaway.** The test relocates the player out of sight, then checks that the wanted level clears by the real search rules. The AI driver can't evade police, and when it tried, the police (correctly) caught it, and once ran over deployed officers and escalated to 5★. Pursuit → search → escape was also verified with a live chase in a separate run: lost sight, the search began, the player drove out of the circle, and it cleared after 36 s.
- Bugs these runs found and fixed:
  - car occupants kept a stale position, which broke mission triggers
  - cars stalled when pulling away at full lock
  - streetlight poles stood inside intersections
  - the suspension integrated per rendered frame and exploded at low frame rates
  - stale police sight carried over after a respawn
  - a sunk car trapped its occupants (they now swim out)
  - police waited forever beside a suspect in a stopped car (they now get out and move in)
  - AI cars spun out and scraped bridge railings (now traction control and steering smoothing)
  - traffic deadlocked behind parked cars (now goes around)
- `node tools/e2e-crew.mjs` (M3, CREW_RESULT):
  - Sol exists and waits at the motel; G makes her follow and she keeps up
  - she boards your car as a passenger and rides along
  - Tab switches to Sol, and each keeps their own ammo
  - with Sol riding and Cal at the wheel, a switch makes Cal (now the partner) drive Sol to a map waypoint 160 m away and stop
  - the passenger can shoot from the car; the partner gets out with you
  - G makes her wait; a far switch puts you where the other one waited
  - switching is refused while wanted
  - save v2 holds both, and Continue restores each one's health, ammo and position
- `node tools/e2e-lowtide.mjs` (M3, LOWTIDE_RESULT): the mission end to end.
  - The start is offered with Sol at the motel; G by the sedan makes Sol drive.
  - She drives the crew **over the twin-span to Cayo Lento** (deck height 7.5 m, ~95–135 s).
  - Rudy on the pier hands over the cooler, and the Calderas' two cars arrive.
  - G again by the car; both get in, and the chase begins.
  - Cal shoots from the passenger seat while Sol drives; the Calderas closed to 4–21 m in the runs.
  - **Tab mid-chase: Sol at the wheel, Cal shooting on his own as the AI partner.** Tab back, and Sol drives home.
  - The Calderas are shaken off (wrecked, or left 200 m behind); any police are cleared by the test.
  - MISSION PASSED with $4,000; it's saved and nothing is left behind.
  - The partner going down fails the mission ("Cal is down."), and a retry restores the pier checkpoint without duplicates.
- `node tools/e2e-weather.mjs` (M3): **10/10**, including LOOP: P opens the feed, a witness clip shows in it and as a notification, and P closes it (`shots/loop.png`).
  - Weather → Always rain brings rain streaks; the asphalt gets glossy (roughness 0.93 → 0.28).
  - Grip falls 1.0 → 0.7, and fog closes in to under 60 %.
  - Traffic switches its headlights on, and the HUD says "Rain".
  - Always clear stops the rain, while the roads stay damp for a while.
  - Screenshots: `shots/rain-street.png`, `shots/rain-bridge.png`.
- More bugs the M3 runs found and fixed:
  - the partner fell off the 3 m pier (the follow spot now stays on the same level, and swimmers can climb onto docks)
  - AI stops held the brake at a standstill, which selects reverse, so the enemies reversed off the key into the sea (new `Vehicle.holdStill`)
  - running into your own parked car knocked you down and hurt you (an M1 bug: impacts counted the person's speed too)
  - walkers pushing against a car never counted as blocked, so they never sidestepped
  - parking-lot and pursuit feelers ignored water
  - traffic jammed at the dead-end marina spur (the key's roads are now a loop, and cruising traffic avoids dead ends)
  - cars clipped the bridge-mouth railing ends (lane shifts now finish inside the junction; there are guide walls and a raised median planter)
  - every shot through a car window hit the driver
  - the sea stayed tropical turquoise under a storm sky
- `npm run shots`: screenshots of the title, the spawn, Ocean Blvd driving, the store interior, a sunset and night neon. They were reviewed by eye, which is how the stretched-suspension bug, the opaque shop windows and the dull sand were caught.

### Implemented but not verified on real hardware
- **Frame rate on a GPU is unmeasured.** The target is 60 FPS at 1080p on a mid-range 2020+ GPU. Use Settings → *Show FPS / stats*; the overlay reports FPS, draw calls, triangles and population. Expect about 150–250 draw calls in busy streets and ~60 skinned characters at most.
- Real mouse pointer-lock feel, gamepad on physical hardware, and audio mix and levels (Web Audio is synthesised and was never heard in the headless runs).
- Long sessions of real-time play by a human.

## Known issues / limits
- People and cars are placeholder-grade: primitive bodies, no IK, doors that don't open (see docs/ASSETS.md).
- AI drivers still bump into each other and into kerbside poles now and then: 3–8 light impacts per 4 minutes of cruising in tests. They recover by backing up or going around. Street furniture (benches, bins, hydrants) can be knocked over by cars. They don't overtake on the twin-span; they wait behind a stopped car instead.
- AI driving out of parking lots uses feelers and is slow and clumsy. It gets out, but expect three-point-turn shuffles. The test autopilot (the traffic AI driving your car) is a test tool, not a game feature.
- Police and the mission enemies use simple obstacle feelers off-road. They can get stuck on props and recover by reversing.
- The partner's combat is basic: they stand and shoot at mission enemies, without cover. They don't fight the police or brawling civilians.
- The partner drives with the traffic AI: lane-following, so it's no stunt driver. In a getaway it ignores red lights.
- How a chase goes varies run to run. Sometimes the Calderas catch up and trade shots on the twin-span. Sometimes they get boxed in by traffic and fall behind (the "200 m away for 6 s" rule then ends the chase). If you get out near them, they get out and fight.
- Rain has no puddle reflections or splashes, the water surface doesn't react to it, and there are no umbrellas. Wet roads are a darker, glossier material using the sky reflection.
- No phone UI yet (messages appear in the feed). The cooler in "Low Tide" isn't shown as an object.
- Anti-aliasing changes apply after a page reload, and the menu says so.

## Next milestone (M4: depth): first concrete task
1. **Boats** on the Cayo Lento flats and Vela Bay: a drivable skiff at the marina and water physics for it. The flats and the old bridge are already set up for this.
2. **Phone UI:** contacts, messages, a map shortcut and mission replays.
3. **A third mission:** the Calderas come to Ocean Mile. A defend-the-motel job where you switch between Cal on the roof and Sol in the lot.
4. **Shops:** an ammo and armour counter, and a garage to repair cars and change their colour.
