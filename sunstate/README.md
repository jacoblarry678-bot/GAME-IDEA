# SUNSTATE: South Beach

A playable browser prototype of a third-person, open-world crime game set in a stylised Miami Beach and the Florida Keys: real streets and landmarks, fictional businesses, people and crews. You play two partners, Cal and Sol, and switch between them. You can:
- explore an art-deco beach district and drive the Seven Mile Bridge out to Marathon in the Keys
- steal and drive cars through living traffic
- hold up a convenience store
- run a two-person job where one of you drives and the other shoots
- get caught in passing rainstorms
- shake off the police and make it back to your motel room to save

> **Fan prototype, original content.** This was built as an homage to the *atmosphere* of Rockstar's Grand Theft Auto VI reveals: a Florida-style coast, a criminal couple, neon nights. It is **not** Rockstar's game. It uses no Rockstar code, assets, characters, music or story, and it is not affiliated with or endorsed by Rockstar Games or Take-Two. Every model, texture, sound and line of dialogue is generated in code or written for this project (see [docs/ASSETS.md](docs/ASSETS.md)). For what was referenced and how reliable each source is, see [docs/REFERENCES.md](docs/REFERENCES.md).

## Real Miami (the default map)

The game now runs on the real city at 1:1, streamed from open map data. The map covers Greater Miami (Miami Beach, Downtown, Brickell, Wynwood, Little Havana, Coconut Grove, Coral Gables, Hialeah, the airport) and the US-1 corridor down the Keys to Marathon. That is about 290,000 road segments and every building footprint in the data. The classic compact South Beach is still on the title screen ("Classic South Beach", or `?map=classic`).

- **Streets and buildings** come from Overture Maps (which includes OpenStreetMap). Real footprints and heights are extruded with facades styled by neighbourhood: deco in South Beach, Mediterranean in Coral Gables, glass towers downtown. Bridges and overpasses are raised decks. Tiles stream around you in a worker.
- **Traffic** drives in lanes along the real road polylines. It gives way at bigger roads, keeps off alleys and parking aisles, and slows for bends.
- **People** walk the sidewalks of real streets. Crowds gather on the beach and in the parks.
- **Police** respond along real routes, then chase you with the usual pursuit AI.
- **GPS.** Set a waypoint on the map (M) and the minimap draws the fastest route over the real network, with distance, ETA and the streets to follow. A* runs in a worker over the whole graph.
- **Shops at real locations, under invented names.** Every business in the data of a kind the game knows is a walk-up counter (E):
  - food and drink: corner stores, gas stations, groceries, restaurants, fast food, cafés, bars, casinos
  - shopping: clothes, jewellers, phone shops, pharmacies, gun and pawn shops, car dealers (buy a car; it's parked out front)
  - services: clinics, auto body (drive in: repair or respray), banks and ATMs, hotels and motels (sleep and save), gyms, barbers, salons, tattoo studios, cinemas, a police desk (pay your fines)

  Hold a gun at a till to rob it. A silent alarm calls it in a few seconds later.
- **Your apartment** is on Ocean Drive (⌂): save, sleep, wardrobe. Saves remember which map they belong to.
- **Missions on real streets:**
  - *Small Change*: a corner store a few blocks from home.
  - *Low Tide*: the Dinner Key marina in Coconut Grove, then the Calderas chase you back across the bay.
- **The phone** (P):
  - Messages and Contacts. Call your partner, a cab (Sunstate Cab: a paid ride to your waypoint), or the mechanic, who brings your car to the kerb.
  - Map, LOOP, Bank (balance and recent transactions) and Settings.

Map data © OpenStreetMap contributors (ODbL) and the Overture Maps Foundation. Businesses, people, brands and the police are fictional; street and place names are real public geography. Rebuilding the map data is covered in `tools/mapdata/` (`extract.py` → `build_packs.py` → `graph_bin.mjs`).

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
| **1–6** | **pick from a shop or counter menu** (E again to leave) | **Y** (LOOP open) | **ask Claude for new posts** (in the claude.ai page only) |
| | | **1 / 2 / 3** (LOOP open) | **post a selfie / photo / clip** from your own account |
| | | **4** (LOOP open) | **selfie with a Claude-written caption** (in the claude.ai page only) |

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
- **Marathon, in the Florida Keys:**
  - Reached by the **Seven Mile Bridge**: two decks with an open gap, parapets, piers and lights, carrying Ocean Dr south over shallow turquoise flats.
  - On the key: Slow Tide Bait & Fuel, stilt houses, The Salt Hook (a dive bar), the Palm Hammock RV park and a marina with a long pier.
  - Also a water tower, mangroves, a loop of roads, and the closed, half-collapsed old bridge onward to the rest of the chain.
- **Mission "Low Tide":** a two-person job, unlocked after *Small Change*. Drive to the marina and meet Rudy on the pier, then get away from the Caldera brothers' two cars. One of you drives while the other shoots, and **Tab** swaps roles mid-chase. Lose them, then bring the cooler home for **$4,000**. It has checkpoints, fails if either partner goes down, and retries without duplicates.
- **Rain:**
  - Passing showers cycle through clear, clouding over, rain and clearing; Settings → World → Weather can pin it to clear or rain.
  - Overcast skies and closer fog, rain streaks, thunder and lightning, and wet roads that are darker and glossy with about 30 % less tyre grip.
  - Cars switch their headlights on, people hurry, and the beach empties.
  - The rain sound is muffled inside cars and buildings.
- **LOOP, an in-game social feed (P):** locals post about their day, the weather and what they see. A bystander who calls 911 about you also posts a clip (naming the street) that racks up likes. A news account reports your robberies and chases, and posts about the crew pop up in the notification feed. Every handle and post is invented.
- **Save v2:** both protagonists are saved. v1 saves migrate: the old player becomes Cal.

## The living city (added after Milestone 3)

- **The city remembers you.** These are this prototype's own rules:
  - **Police descriptions.** When officers see a crime, they note what the person wore and the car they drove. The description lasts ten in-game hours. While it's fresh, a patrol officer who gets a good look at someone matching it can recognise you, even with no stars. To shake it, change clothes, or respray the car and swap the plates.
  - **Notoriety per area** (South Beach and Marathon) rises with reported crimes and slowly fades. When it's high, people recognise you in the street, film you and post it. At the top end they call it in.
  - **A nickname** forms from what you do most and where you do it (for example "the Collins Ave Carjacker"). LOOP uses it.
  - **People remember Cal and Sol separately:**
    - the store clerk you robbed
    - the gunsmith whose regular you are
    - the bouncer who's seen you on LOOP
  - **Grudges.** After "Low Tide", the Caldera brothers sometimes come looking for you in a car.
  - All of this is saved with the game.
- **New places** (all names and businesses are invented). Walk up and press **E**, pick with **1–6**, and press **E** again to leave:
  - **Bayfront Arms** (gun shop): pistol ammo, body armour, and the *Vela Viper* SMG.
  - **Threads on Lincoln** (clothes): five outfits for each protagonist. A new outfit no longer matches the police description.
  - **Sunray Gas** (mini-mart and pumps): snacks and coffee (restore health), and scratch tickets.
  - **Deco Auto Body:** drive into the bay. It offers repairs, and a respray with new plates. The respray makes the police lose the car if they can't see you (3★ or less).
  - **Velvet Palms:** an adults-only club you can walk into (open 8 PM – 4 AM). It's non-explicit: the dancers wear full sequined costumes, and the show is pole work and dancing.
    - **The door:** pay Big Tomas the $20 cover. Regulars and VIPs walk in. Without paying, the rope stays closed.
    - **Inside:** a dark lounge with:
      - a stage and runway with three dancers, a mirror ball and sweeping light beams
      - booths, a bar with a lit back bar, a DJ booth and a room full of regulars who cheer
      - a house / dembow / synthwave set, muffled through the walls outside
    - **Counters (E, then 1–5):**
      - **Bar (Jules):** drinks restore a little health and make the camera sway; water sobers you up. You can also buy a round for the bar, or bottle service, which puts you on the VIP list.
      - **Stage rail:** tip the dancers, or "make it rain". Someone films it for LOOP.
      - **DJ Marea:** takes requests and remembers your favourite style.
      - **Celeste:** a booth for an hour, or VIP until close. Time passes and your health is restored.
    - **Trouble:**
      - Start a fight and Big Tomas throws you out and won't let you back for a day.
      - Fire a gun and the room empties: people run, cower and call 911, and the club is closed for the night.
  - **Flamingo Park:** lawns, a fountain, a basketball court, and people out for a walk.
- **LOOP, now with reels:**
  - When a witness calls you in, or someone recognises you, they film a short clip from their own point of view. The clip plays in the feed.
  - Locals now have distinct voices and reply to each other.
  - There is a trending line and a nickname, plus the news account.
  - **Y** asks Claude to write a few new posts from what the city currently remembers (your nickname, recent crimes, the weather, the time). This works only in the claude.ai page, where you approve it first and it uses your own Claude usage. Anywhere else, LOOP uses its built-in posts.

## Your own LOOP account (added after Milestone 3)

- **Cal and Sol each have an account:** @cal.reyes (37 followers to start) and @sol.vega (212). Tab switches who's posting.
- **Posting:** open LOOP with **P**, then:
  - **1** takes a selfie (the phone at arm's length, so you're in it).
  - **2** takes a photo of what your camera sees.
  - **3** films a 2.5-second clip.
  - **4** takes a selfie and lets Claude write the caption (only in the claude.ai page).
  - Otherwise the caption comes from the moment, in Cal's or Sol's voice.
- **What gets likes:**
  - **Places:**
    - golden hour on the beach
    - Velvet Palms at night
    - the Seven Mile Bridge and Marathon
    - neon streets after dark
  - **Who's in it:** the two of you together.
  - **The moment:** a fast car, or posting in the middle of a chase.
  - **What hurts:** posting the same thing again, or posting too often (your audience gets tired), and a #ad tag.
  - **Virality:** strong posts can go viral, getting 6–15× the likes.
- **Likes and followers:**
  - Likes roll in over a minute or two and turn into followers.
  - Locals reply, and you get "@keys.kat and 23 others followed you" notifications.
- **Milestones:**
  - 250 followers: brands start DMing you.
  - 1,000: sponsorships pay 50% more.
  - 10,000: Big Tomas puts you on the Velvet Palms VIP list.
  - 50,000: you get a verified ✔.
- **Brand deals:** a DM offers money for a specific post before a 4-minute deadline, and the GPS points there. Examples:
  - a selfie at Threads on Lincoln
  - your car in the Deco Auto Body bay
  - a clip from inside Velvet Palms
  - a photo out on Marathon
- **Risk:** posting while the police are after you tells them exactly where you are.
- Followers, posts, likes and badges are saved.

## Real places and the graphics revamp

- **Real geography, fictional people:**
  - The map is South Beach: Alton Rd, Washington Ave, Collins Ave and Ocean Dr, crossed by 17th St, Lincoln Rd, Española Way, 5th St, 3rd St, 1st St and South Pointe Dr.
  - Also included: Lummus Park beach with Muscle Beach, Flamingo Park, and Biscayne Bay with the MacArthur Causeway to the downtown Miami skyline.
  - Down the Seven Mile Bridge (the old bridge alongside, closed) is Marathon, with Boot Key Harbor and Sombrero Beach Rd.
  - The layout is compressed; distances are not to scale.
  - Every business, character, crew, brand and police unit is invented. Police are just "Police / Precinct 3", not a real agency.
- **Lighting:** a physically based (Preetham) sky drives the sun colour, sky light, fog and an image-based environment, so reflections match the time of day. Post-processing adds ground-truth ambient occlusion (GTAO), HDR bloom and a filmic colour grade (ACES, warmth, vignette, grain).
- **Materials:**
  - Every ground surface is a tileable PBR material (colour, normal, roughness, AO) baked on the GPU at startup: asphalt with cracks and patches, sidewalk slabs, sand ripples, St. Augustine grass, pavers, boardwalk, terrazzo.
  - Facades have relief, and their windows reflect the sky.
- **Palms:** coconut palms with curved, ring-scarred trunks, drooping fronds, dead fronds and coconuts; royal palms with smooth trunks and crownshafts along the avenues. The fronds cast dappled shadows and sway.
- **Cars:**
  - Bodies are lofted from cross-sections, with curved sides, rounded corners, real wheel arches, door seams, handles and mirrors.
  - Paint has a clearcoat; the tinted glass shows the interior and occupants.
  - Wheels are alloys with brake discs.
  - Two new everyday models join traffic: the Sprite GT hatchback and the Tarpon XL SUV.
- **Water:**
  - The water reflects the real sky, clouds and sunsets.
  - Layered waves with an Atlantic swell calm with distance; there is a sun-glitter path and shoreline foam.
- **Ambient life:**
  - Speedboats and a yacht leave foam wakes across the bay; a jet ski runs behind the surf.
  - Sailboats and a cruise ship sit out on the Atlantic; the ship's cabins light up at night.
  - A banner plane tows ads for local (fictional) businesses along the beach, and gulls wheel over the sand.
- **Automatic quality:** if the frame rate stays under 40 fps, the game lowers render scale, then AO, then shadows. You can turn this off in Settings.

## What's in this build (Milestones 1 and 2)

- **South Beach, Miami Beach** (a compact take on the real street grid):
  - 4 avenues × 7 streets with lane markings, crosswalks and working traffic signals
  - a beach with umbrella clusters and lifeguard towers, a palm promenade and an outdoor gym
  - pastel art-deco hotels with neon fins, ocean-side condo towers, shops, a diner, a nightclub frontage
  - the Bayside Motel safehouse, a hospital, a police precinct and a marina
  - a raised causeway over the bay you can drive under by boat height, ending at a closed mainland construction site
  - an unreachable downtown skyline and neighbouring islands as backdrop
- **Enterable interior:** the Sunny Stop convenience store, with real walls, shelves, a counter, fridges, a clerk and customers.
- **Day/night cycle** (one game day per 24 real minutes): sunset sky, stars, lit windows, neon with bloom, streetlight pools, headlights.
- **Character:** walk, run, sprint, jump, crouch, swim, climb out of the water, curb steps, fall damage. Procedural skinned animation covers aiming, punching, hands-up, cowering, phone calls, sitting and driving poses.
- **Cars:** six original vehicles that handle differently (FWD sedan, FWD hatchback, RWD muscle car, SUV, heavy pickup, police cruiser). Tyre-slip handling includes weight transfer, wheelspin, power oversteer, handbrake turns and speed-sensitive steering. Also:
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

The trade-off is visual fidelity. The revamp pushes three.js a long way: physically based sky and materials, AO, procedural palms and lofted car bodies. It is still not photoreal, though. Everything is generated in code (no scanned or licensed assets), the people are the weakest part, and the container has no GPU to profile on. See the upgrade list in [docs/ASSETS.md](docs/ASSETS.md).

## Tests

```bash
npm test                                  # 94 rules/simulation checks in Node (no browser)
npm run build && npm run preview &        # then:
npm run e2e                               # M1/M2 playthrough in headless Chromium (49 checks)
node tools/e2e-crew.mjs                   # M3: two protagonists, partner AI, switching, save v2
node tools/e2e-lowtide.mjs                # M3: the "Low Tide" mission end to end
node tools/e2e-weather.mjs                # M3: rain on/off, wet roads, grip, visuals; the LOOP feed
node tools/e2e-city.mjs                   # places, staff memory, Velvet Palms inside, police descriptions, respray, reels, Claude posts (stubbed)
node tools/e2e-loop.mjs                   # your LOOP account: posting, likes → followers, deals, wanted posts, milestones
npm run shots                             # representative screenshots → shots/
```

The browser tools need Playwright (`npm i -D playwright`, or link a global install). See [STATUS.md](STATUS.md) for the latest verification results and known issues.

## Project layout

```
src/
  core/      engine (renderer, sky, time of day), weather, input, settings, storage, events
  world/     layout (roads, terrain), district plan, collision, mesh builders, props, palms, PBR surfaces,
             textures, ambient life (boats, banner plane, gulls)
  entities/  humans (model + animation + physics), vehicles (model + physics)
  ai/        traffic drivers, pedestrians, police, partner, mission enemies, ambient director
  game/      game loop, crew (Cal/Sol + switching), player controller, camera, combat, wanted, missions,
             memory (what the city remembers), places (shops and staff), club (Velvet Palms inside),
             social (LOOP) and creator (your LOOP accounts), store, economy, save
  ui/        HUD, minimap/map, menus, styles
  audio/     procedural sound and radio
  data/      vehicles, weapons
docs/        reference ledger, asset provenance
tools/       unit tests, e2e playthrough, screenshots, single-file build
```
