# SUNSTATE: Ocean Mile

A playable browser prototype of a third-person, open-world crime game set on a fictional sun-belt coast. You play two partners, Cal and Sol, and switch between them. You can:
- explore an art-deco beach district and drive a twin-span bridge out to a sleepy island key
- steal and drive cars through living traffic
- hold up a convenience store
- run a two-person job where one of you drives and the other shoots
- get caught in passing rainstorms
- shake off the police and make it back to your motel room to save

> **Fan prototype, original content.** This was built as an homage to the *atmosphere* of Rockstar's Grand Theft Auto VI reveals: a Florida-style coast, a criminal couple, neon nights. It is **not** Rockstar's game. It uses no Rockstar code, assets, characters, music or story, and it is not affiliated with or endorsed by Rockstar Games or Take-Two. Every model, texture, sound and line of dialogue is generated in code or written for this project (see [docs/ASSETS.md](docs/ASSETS.md)). For what was referenced and how reliable each source is, see [docs/REFERENCES.md](docs/REFERENCES.md).

## Run it

```bash
cd sunstate
npm install
npm run dev          # http://localhost:5190
```

For a production build: `npm run build && npm run preview` (http://localhost:4190).

`npm run build:single` writes everything into one self-contained page, `build/sunstate.html`.

Requirements: Node 18+ and a desktop browser with WebGL2 (Chrome, Edge, Firefox or Safari 16+). Keyboard and mouse are the primary controls. A standard-mapping gamepad works but has not been tested on hardware.

## Controls (defaults, all rebindable in Settings → Controls)

| On foot | | In a vehicle | |
|---|---|---|---|
| W A S D | move (camera-relative) | W / S | accelerate / brake, then reverse |
| Mouse | camera (click the game to lock the pointer) | A / D | steer |
| Shift | sprint | Space | handbrake |
| Space | jump | H | horn |
| C | crouch | L | headlights |
| RMB | aim | T | next radio station |
| LMB | fire / punch | X | look behind |
| R | reload | F | exit (bail out at speed) |
| Q / wheel | switch weapon | | |
| E | interact (prompts show the key) | | |
| F | enter the nearest car (takes it if occupied) | | |
| M | map (click to set a waypoint) | Esc | pause |
| Enter | skip dialogue / retry a failed mission | RMB + LMB (passenger) | aim and shoot out of the window |
| **Tab** | **switch between Cal and Sol** | **G** (partner driving) | **pull over / drive on** |
| **G** | **partner: follow / wait** (by an empty car: **"you drive"**) | **P** | **LOOP, the social feed** |

## What's new in Milestone 3

- **Two protagonists: Cal and Sol.**
  - Press **Tab** to switch. Each keeps their own health, armour, weapons and ammo, position and car; money is shared.
  - Close by, the camera glides across to the other person. Far away it cuts with a fade.
  - Switching is refused while the police are after you, in dialogue, mid-way into or out of a car, or during a one-person mission.
- **Partner AI** (whoever you're not playing):
  - On foot: follows you (**G** toggles follow / wait), dodges cars, waits off the road, and catches up off-screen.
  - Cars: gets in as your passenger, or takes the wheel if you press **G** by an empty car. They drive you to the objective or your map waypoint, and park when you ask (**G**).
  - Combat: shoots back at mission enemies.
  - If they go down, they're patched up at Ocean Mercy.
- **Passenger drive-by:** as a passenger, aim (RMB) and shoot (LMB) out of the side window.
- **Cayo Lento, the first of the Vela Keys:**
  - Reached by a **twin-span bridge**: two decks with an open gap, parapets, piers and lights, carrying Ocean Blvd south over shallow turquoise flats.
  - On the key: Lento Bait & Fuel, stilt houses, The Salt Hook (a dive bar), the Palm Hammock RV park and a marina with a long pier.
  - Also a water tower, mangroves, a loop of roads, and the closed, half-collapsed old bridge onward to the rest of the chain.
- **Mission "Low Tide":** a two-person job, unlocked after *Small Change*. Drive to the marina and meet Rudy on the pier, then get away from the Caldera brothers' two cars. One of you drives while the other shoots, and **Tab** swaps roles mid-chase. Lose them, then bring the cooler home for **$4,000**. It has checkpoints, fails if either partner goes down, and retries without duplicates.
- **Rain:**
  - Passing showers cycle through clear, clouding over, rain and clearing; Settings → World → Weather can pin it to clear or rain.
  - Overcast skies and closer fog, rain streaks, thunder and lightning, and wet roads that are darker and glossy with about 30 % less tyre grip.
  - Cars switch their headlights on, people hurry, and the beach empties.
  - The rain sound is muffled inside cars and buildings.
- **LOOP, an in-game social feed (P):** locals post about their day, the weather and what they see. A bystander who calls 911 about you also posts a clip (naming the street) that racks up likes. A news account reports your robberies and chases, and posts about the crew pop up in the notification feed. Every handle and post is invented.
- **Save v2:** both protagonists are saved. v1 saves migrate: the old player becomes Cal.

## What's in this build (Milestones 1 and 2)

- **Ocean Mile**, a connected island district of Costa Vela:
  - 4 avenues × 7 streets with lane markings, crosswalks and working traffic signals
  - a beach with umbrella clusters and lifeguard towers, a palm promenade and an outdoor gym
  - pastel art-deco hotels with neon fins, ocean-side condo towers, shops, a diner, a nightclub frontage
  - the Bayside Motel safehouse, a hospital, a police precinct and a marina
  - a raised causeway over the bay you can drive under by boat height, ending at a closed mainland construction site
  - an unreachable downtown skyline and neighbouring islands as backdrop
- **Enterable interior:** the Sunny Stop convenience store, with real walls, shelves, a counter, fridges, a clerk and customers.
- **Day/night cycle** (one game day per 24 real minutes): sunset sky, stars, lit windows, neon with bloom, streetlight pools, headlights.
- **Character:** walk, run, sprint, jump, crouch, swim, climb out of the water, curb steps, fall damage. Procedural skinned animation covers aiming, punching, hands-up, cowering, phone calls, sitting and driving poses.
- **Cars:** four original vehicles that handle differently (FWD sedan, RWD muscle car, heavy pickup, police cruiser). Tyre-slip handling includes weight transfer, wheelspin, power oversteer, handbrake turns and speed-sensitive steering. Also:
  - suspension pitch and roll, collisions and damage, smoke when a car is badly damaged, sinking in water
  - entering a car walks you to the door, going around the car if the door is on the far side
  - carjacking, sliding across from the passenger side, and exiting at the first clear spot (the other door, front, back, or the roof)
- **Traffic:** cars follow lanes with turn curves and obey signals. They brake for anything in their path, honk, back out when stuck, and go around stopped cars. They spawn out of view and despawn far away.
- **Pedestrians:** they walk the sidewalk graph (crossing when it's clear), sit on the sand, chat, take calls, and dodge cars. They flee or cower at gunfire, put their hands up at gunpoint, sometimes fight back, and get up after being hit.
- **Wanted system** (explained in Pause → Brief):
  - Police act only on what an officer sees, a civilian finishes reporting by phone, or an alarm reports.
  - Witness calls can be interrupted.
  - Pursuit becomes a last-known-position search, shown as a red circle on the minimap; leave it and stay unseen to escape.
  - Up to five stars on an escalation scale of our own. Officers arrest you at 1★, shoot from 2★, and deploy on foot.
- **Combat:** pistol with aiming, recoil, spread, reloads and ammo; melee; hit reactions; hit markers.
- **Mission "Small Change":** an original story with checkpoints, failure reasons, retry from checkpoint, and cleanup. You hold up the Sunny Stop: keep the clerk covered while the register is bagged, grab the cash, survive the silent alarm, lose the police, and return to the motel.
- **Progression and persistence:** money, a ledger, and a versioned save with validation, a backup and recovery from corrupt data. It stores owned cars without duplicating them on load. WASTED and BUSTED respawn you with a penalty.
- **Ambient director:** roadside arguments, a broken-down car, beach parties and a street performer. Each has cooldowns and a cap on how many can run at once.
- **HUD:** a rotating minimap with GPS routes and blips, health, armour, money, stars with an explanation of the current police state, a witness-call meter, weapon and ammo, objective and progress, prompts, subtitles, a phone-message feed, a speedometer and radio, and big result banners.
- **Menus:** title flyover, pause (map with waypoints, brief, settings, controls), and full settings:
  - graphics preset, render scale, shadows, bloom, draw distance, AA (applies after reload), frame cap, FOV, FPS overlay
  - five volume buses
  - HUD scale, subtitles, camera shake, minimap rotation, units
  - traffic and pedestrian density
  - sensitivity and invert, and key rebinding
- **Audio:** fully synthesised:
  - engine tied to RPM and throttle, tyre squeal, siren, horns, gunshots with echo, impacts, footsteps by surface, surf and city ambience
  - two original generative radio stations

## Why this stack

The environment has no Unreal, Unity or Godot installs and no GPU (the container renders on the CPU through SwiftShader). That rules out building and running an Unreal or Unity project here. A real 3D browser engine, **three.js**, is the most reliable way to deliver something playable that we can actually run and test.

Vehicle and character physics are custom rather than a general physics library. The district is mostly flat, and the cars need hand-tuned arcade handling. A deterministic 60 Hz fixed step also lets the headless tests drive the real simulation faster than real time.

The trade-off is visual fidelity. This is stylised, not photorealistic, and the people and cars are placeholder-grade (see the upgrade list in [docs/ASSETS.md](docs/ASSETS.md)).

## Tests

```bash
npm test                                  # 75 rules/simulation checks in Node (no browser)
npm run build && npm run preview &        # then:
npm run e2e                               # M1/M2 playthrough in headless Chromium (49 checks)
node tools/e2e-crew.mjs                   # M3: two protagonists, partner AI, switching, save v2
node tools/e2e-lowtide.mjs                # M3: the "Low Tide" mission end to end
node tools/e2e-weather.mjs                # M3: rain on/off, wet roads, grip, visuals; the LOOP feed
npm run shots                             # representative screenshots → shots/
```

The browser tools need Playwright (`npm i -D playwright`, or link a global install). See [STATUS.md](STATUS.md) for the latest verification results and known issues.

## Project layout

```
src/
  core/      engine (renderer, sky, time of day), weather, input, settings, storage, events
  world/     layout (roads, terrain), district plan, collision, mesh builders, props, textures
  entities/  humans (model + animation + physics), vehicles (model + physics)
  ai/        traffic drivers, pedestrians, police, partner, mission enemies, ambient director
  game/      game loop, crew (Cal/Sol + switching), player controller, camera, combat, wanted, missions, store, economy, save
  ui/        HUD, minimap/map, menus, styles
  audio/     procedural sound and radio
  data/      vehicles, weapons
docs/        reference ledger, asset provenance
tools/       unit tests, e2e playthrough, screenshots, single-file build
```
