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

- `npm test`: **52/52** Node checks. They cover:
  - road connectivity, lanes on asphalt, sidewalks clear of buildings, free spawn/marker points, the store doorway open and the walls solid, parked cars clear of walls, causeway continuity and boat clearance
  - ray, OBB and capsule maths
  - car physics: sedan 0–60 mph in 6.8 s, muscle car 5.7 s, pickup 7.3 s; top speed ~93 mph; 60–0 mph in ~40 m; a stable 10 m full-lock circle; a handbrake slide; reversing; parked cars staying put; no driving through a wall at 30 m/s; crash damage; momentum conserved in car–car collisions
  - characters: walls, curbs, falling into water, climbing out
  - wanted: witness call → report, search-area escape, cancelled calls, rate-limited escalation
  - save/settings: validation, version handling, backup, rebinding swaps
- `npm run e2e`: see **E2E_RESULT** below.
- `npm run shots`: screenshots of the title, the spawn, Ocean Blvd driving, the store interior, a sunset and night neon. They were reviewed by eye, which is how the stretched-suspension bug, the opaque shop windows and the dull sand were caught.

### Implemented but not verified on real hardware
- **Frame rate on a GPU is unmeasured.** The target is 60 FPS at 1080p on a mid-range 2020+ GPU. Use Settings → *Show FPS / stats*; the overlay reports FPS, draw calls, triangles and population. Expect about 150–250 draw calls in busy streets and ~60 skinned characters at most.
- Real mouse pointer-lock feel, gamepad on physical hardware, and audio mix and levels (Web Audio is synthesised and was never heard in the headless runs).
- Long sessions of real-time play by a human.

## Known issues / limits
- People and cars are placeholder-grade: primitive bodies, no IK, doors that don't open (see docs/ASSETS.md).
- Traffic can still crash into each other at intersections when a left-turner and oncoming traffic meet; they recover by backing up.
- The autopilot used by the e2e test (the traffic AI driving your car) is a test tool, not a game feature.
- Police drive the road graph and use simple obstacle feelers off-road. They can get stuck on props and recover by reversing.
- No rain yet; day/night only. No phone UI yet (messages appear in the feed).
- Anti-aliasing changes apply after a page reload, and the menu says so.

## Next milestone (M3: world and partner): first concrete task
Make **Sol** playable with character switching:
1. Separate health, position, inventory and vehicle for each protagonist, stored in the save (v2 migration).
2. The inactive partner follows, waits, or rides as a passenger.
3. Add a second district (a Keys-style island chain via a twin-span bridge) and a second mission with driver/passenger roles.
4. Add rain and wet roads.
