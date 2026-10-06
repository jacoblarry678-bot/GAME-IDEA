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
  - **Velvet Palms can be entered** (`src/game/club.js`). It is an adults-only club, open from 8 PM to 4 AM, and non-explicit: costumed dancers doing pole work and dancing.
    - Pay the cover, or walk in as a regular or VIP; otherwise the rope stays closed.
    - Inside are three dancers, about 20 regulars (seated, at the rail or dancing), a bartender, a DJ and a VIP host.
    - The room has a mirror ball, light beams, a room light that pulses on the kick, and music that's muffled outside.
    - **Bar:** drinks restore a little health and make the camera sway.
    - **Stage rail:** tip the dancers, or "make it rain", which produces a LOOP reel.
    - **DJ:** takes requests.
    - **VIP host:** a booth for an hour or until close.
    - **Trouble:** a fight gets you thrown out and refused for a day. A gunshot empties the room and gets witnesses calling 911.
    - The club's staff remember your usual drink, your requests and VIP status, and this is saved.
  - Each place has a map blip.
  - The Sunny Stop clerk now remembers being robbed.
- **LOOP:** witness and fan reels filmed from their phones (live 90×160 renders) that play in the feed, persona voices and replies, and trending topics.
  - Claude-written posts on Y, through the claude.ai `sample` capability. They need the viewer's consent and use the viewer's own Claude usage. If the runtime isn't there, the key does nothing and the feed stays on built-in text.

## After M3: your own LOOP account (complete)
Asked for: "add where we can post and get likes and follows".

- **Accounts:** @cal.reyes and @sol.vega (`src/game/creator.js`), each with followers, posts, likes and badges. They're saved.
- **Posting:** with LOOP open, **1** selfie, **2** photo, **3** clip, and **4** a selfie with a Claude caption (claude.ai only, on the key press).
  - Shots come from an in-game phone camera at 135×240. Captions match the moment, in Cal's or Sol's voice.
- **Engagement model** (ours):
  - Each post gets a score from the place and the time, who's in it, a fast car, a chase, rain, and how tired your audience is.
  - The score sets the likes your followers give it, plus discovery by everyone else and a chance to go viral. Likes come in over about a minute and become followers.
  - Locals reply, and follow notifications are grouped.
- **Milestones:** brand DMs at 250, better sponsor pay at 1k, the Velvet Palms VIP list at 10k, verified at 50k.
- **Brand deals:** a DM offers money for a specific post from a specific place within 4 minutes, and the GPS points there. The post is tagged #ad.
- **Risk:** posting while wanted moves the police search to where you are.

## Verification

### Latest full run (final build after M3: memory, places, Velvet Palms inside, LOOP accounts)

| Suite | Result | Notes |
|---|---|---|
| `npm test` (Node) | **93/93** | |
| `tools/e2e.mjs` (M1/M2 playthrough) | **49/49** | It failed once earlier today at the walk to the motel door, cause not captured. The check now prints the failure reason. A rerun passed. |
| `tools/e2e-crew.mjs` | **16/17** | "The partner drives you to your waypoint" timed out at 97 m. The cause wasn't captured. Three reproductions arrived in 24–36 s, and the suite passed 17/17 twice earlier today. |
| `tools/e2e-lowtide.mjs` | **16/18** | Everything up to and including the chase passed; Sol's drive home didn't finish in 4 minutes (see below). |
| `tools/e2e-weather.mjs` | **10/10** | |
| `tools/e2e-city.mjs` | **20/20** | Includes the Velvet Palms interior: the door, the bar, the stage, the DJ, the VIP booth, and getting thrown out. |
| `tools/e2e-loop.mjs` | **13/13** | Your LOOP accounts. |

**"Low Tide" is still the flakiest suite.** It's long, and the chase plays out differently every time. Across six full runs today:
- **Passes:** one run passed 18/18, and every run passed up to and including the chase.
- **Failures:**
  - Sol's drive home after the chase got stuck. In one run it ended on dry land off the road on the key's south edge, with the car badly damaged. That cause isn't known.
  - In earlier runs the car was shoved into the sea by a Caldera car. That's now fixed: rivals brake in time.
  - Once, the police arrived during the ambush and the crew didn't get back into the car together.

Container: 4 CPU cores, no GPU. Chromium renders through SwiftShader on the CPU, so **frame rates measured here say nothing about real hardware**. The tests advance the simulation directly (`window.__sun.advance`) and render occasionally.

- `npm test`: **93/93** Node checks. They cover:
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
  - **After M3:**
    - memory: police descriptions and matching, notoriety and nicknames, people remembering Cal and Sol separately, and saving with bad data cleaned
    - Velvet Palms:
      - it's an interior with a ceiling; the doorway is walkable and the front wall is solid
      - the stage and runway are raised; every counter has a free spot to stand at
      - seats are inside the room, and there's a clear walk from the door to the rail
      - the club's memories survive a save
    - LOOP accounts: starting followers, the 250 milestone announced once, 10k → VIP list, and saved accounts cleaned
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
- Bugs found after M3 and fixed:
  - **A crashed AI car could wedge itself nose-first into the gap between two towers and rock between "back up" and "go" indefinitely.** The 5-minute drive in `tools/e2e.mjs` caught it: 0.8 km instead of 1.7 km.
    - A progress watchdog now switches a car that has wanted to move for 12 s without getting 5 m to the off-road mode.
    - The off-road mode backs out toward a way out that's behind it.
    - Verified from three wedged starts: all three got out, in 13–29 s.
  - **Traffic gridlocked the marina road on Cayo Lento** in 2 of 4 traced "Low Tide" drives. With the player out there, all 16 traffic cars spawned onto the key's few short roads.
    - Traffic is now capped at 7 cars on the twin span and the key; 2 of 2 drives after the change were clear.
  - **Head-on standoffs:** a car cutting a corner into the oncoming lane left both cars waiting on each other. The lower-ranked one now backs off once, and the usual go-around finishes it.
    - Staged on six edges: 14–15 s to pass with no crash damage. Before, it took 9–12 s, with crash damage in 3 of 6.
  - The partner's drive home in "Low Tide" stalled on the bridge. The driver AI treated the bridge railing as hiding the road.
  - Destinations off the road (a lot, a door) now count as reached from the nearest road point.
  - Caldera hunters no longer vanish while on screen when a hunt times out.
- `npm run shots`: now also covers Bayshore Park, Sunshine Gas, Coral Auto Body, and Velvet Palms outside at night and inside. The garage reads more like an office block from the street (it uses the shop-window facade); that's a known cosmetic limit.
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
- **City memory and places:**
  - "AI" here means scripted rules that remember things, not a learning model.
  - Recognition needs an officer close by with a clear view. Fame sightings need a nickname and high notoriety, so they take a while to show up in normal play.
  - The Caldera hunts are a single truck that drives at you.
- **Velvet Palms:**
  - The people inside are placed and animated by script: they sit, stand at the rail or dance on the spot, and don't mingle or walk around.
  - After a shooting, people run with the generic flee logic, so some bump along the walls before they find the door.
  - The light beams are additive cones, not real lights. One shared point light colours the room.
  - Being tipsy only affects the camera, not the controls.
  - There's no back room, and no upstairs.
- **LOOP:**
  - The real Claude calls (Y for posts, 4 for a caption) were only tested against a stub, never against the live claude.ai runtime.
  - Your own posts aren't kept in the save (only the account numbers), and the engagement numbers are tuned by feel, not balanced over long play.
  - Reels are 10 low-resolution frames (90×160) rendered from the witness's eye position.
- Fades run on the wall clock, so the fast sim-time tests can catch a black frame in a screenshot; play isn't affected.
- Anti-aliasing changes apply after a page reload, and the menu says so.

## Next milestone (M4: depth): first concrete task
1. **Boats** on the Cayo Lento flats and Vela Bay: a drivable skiff at the marina and water physics for it. The flats and the old bridge are already set up for this.
2. **Phone UI:** contacts, messages, a map shortcut and mission replays.
3. **A third mission:** the Calderas come to Ocean Mile. A defend-the-motel job where you switch between Cal on the roof and Sol in the lot.
4. **The city's memory in missions:** jobs that react to your nickname, banned places and grudges, and a phone call when the Calderas are coming.
(Shops, a garage with respray, and an enterable club were built after M3: see above.)
