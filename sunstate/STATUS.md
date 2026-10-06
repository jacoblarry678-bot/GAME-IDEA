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

## Verification

Container: 4 CPU cores, no GPU. Chromium renders through SwiftShader on the CPU, so **frame rates measured here say nothing about real hardware**. The tests advance the simulation directly (`window.__sun.advance`) and render occasionally.

- `npm test`: **54/54** Node checks. They cover:
  - road connectivity, lanes on asphalt, sidewalks clear of buildings, no street furniture standing on roads, free spawn/marker points, the store doorway open and the walls solid, parked cars clear of walls, causeway continuity and boat clearance
  - ray, OBB and capsule maths
  - car physics: sedan 0–60 mph in 6.8 s, muscle car 5.7 s, pickup 7.3 s; top speed ~93 mph; 60–0 mph in ~40 m; a stable 10 m full-lock circle; pulling away from rest at full lock; a handbrake slide; reversing; parked cars staying put; no driving through a wall at 30 m/s; crash damage; momentum conserved in car–car collisions
  - characters: walls, curbs, falling into water, climbing out
  - wanted: witness call → report, search-area escape, cancelled calls, rate-limited escalation
  - save/settings: validation, version handling, backup, rebinding swaps
- `npm run e2e`: **49/49** in headless Chromium (latest run: 501 s wall time). The run covers:
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
- `npm run shots`: screenshots of the title, the spawn, Ocean Blvd driving, the store interior, a sunset and night neon. They were reviewed by eye, which is how the stretched-suspension bug, the opaque shop windows and the dull sand were caught.

### Implemented but not verified on real hardware
- **Frame rate on a GPU is unmeasured.** The target is 60 FPS at 1080p on a mid-range 2020+ GPU. Use Settings → *Show FPS / stats*; the overlay reports FPS, draw calls, triangles and population. Expect about 150–250 draw calls in busy streets and ~60 skinned characters at most.
- Real mouse pointer-lock feel, gamepad on physical hardware, and audio mix and levels (Web Audio is synthesised and was never heard in the headless runs).
- Long sessions of real-time play by a human.

## Known issues / limits
- People and cars are placeholder-grade: primitive bodies, no IK, doors that don't open (see docs/ASSETS.md).
- AI drivers still bump into each other and into kerbside poles now and then: 3–8 light impacts per 4 minutes of cruising in tests. They recover by backing up or going around. Street furniture (benches, bins, hydrants) can be knocked over by cars.
- The autopilot used by the e2e test (the traffic AI driving your car) is a test tool, not a game feature. It can't manoeuvre out of tight parking lots.
- Police drive the road graph and use simple obstacle feelers off-road. They can get stuck on props and recover by reversing.
- No rain yet; day/night only. No phone UI yet (messages appear in the feed).
- Anti-aliasing changes apply after a page reload, and the menu says so.

## Next milestone (M3: world and partner): first concrete task
Make **Sol** playable with character switching:
1. Separate health, position, inventory and vehicle for each protagonist, stored in the save (v2 migration).
2. The inactive partner follows, waits, or rides as a passenger.
3. Add a second district (a Keys-style island chain via a twin-span bridge) and a second mission with driver/passenger roles.
4. Add rain and wet roads.
