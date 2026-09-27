# Benton Kids: Battle Island

A cartoon 3D battle royale for desktop browsers, starring **Colton**, **Emerson** and **Waylon**.
Built with three.js + Vite, using the same stack as the rest of this repo. Every model, texture and sound
is generated in code, so there are no asset files and nothing to license.

## Play

- **No setup:** open `battle-island/play/battle-island.html` in Chrome, Edge or Firefox. It's a single self-contained file.
- **From source:**
  ```bash
  npm install
  npm run island:dev      # http://localhost:5174
  npm run island:build    # writes battle-island/build/battle-island.html (+ an artifact variant)
  ```

### Online play (up to 4 players, bots fill the rest)

**In the claude.ai link:** open the game link, choose **Play Online**, then **Host game**. Friends open the same link, choose **Play Online**, and either click your game in **Open games** or type its 5-character code.
- Hosting needs contribute or edit access to the link. Anyone the link is shared with can join.
- No server is needed. The game uses the link's built-in real-time room.

**On your own network:** run the relay server from the repo, then open the address it prints on every device:

```bash
npm install
npm run island:build
npm run island:server    # prints http://<your-computer's-ip>:3100 for other devices on the same Wi-Fi
```

The double-clickable file (`play/battle-island.html`) is solo only, since it has no way to reach other players.

### Phones and tablets

Touch controls turn on automatically on touch screens. You can force them on or off in Settings. Play in landscape.

| Touch | Action |
| --- | --- |
| Left thumb (anywhere on the left) | Joystick: walk; push to the rim to sprint; push up while skydiving to dive |
| Right thumb (drag) | Look / aim |
| FIRE | Shoot, swing, place a build piece or use an item. Hold it and drag to aim while firing |
| AIM · JUMP · CROUCH · RELOAD | Aim down sights (toggle) · jump / glider · crouch/slide · reload |
| USE | Open, pick up, or hold to revive/reboot. It lights up when something is in reach and names the action (ENTER, EXIT, ZIP, SHOP, UPGRADE) |
| Driving | The stick drives and steers (push to the rim to boost a kart) · JUMP honks · USE gets out. FIRE and AIM hide while you drive |
| BUILD · ⛏ | Build mode · pickaxe |
| EDIT · FIX · MAT | Edit, repair/upgrade, and material. These show up when you aim at a build or are in build mode |
| Slots / build pieces | Tap to select |
| Minimap or MAP | Full map (tap it to set a drop marker) |
| PING · ♪ · II | Ping · emote · pause (full screen is in the pause menu) |

On a touch screen the game starts with shadows off and a lower resolution, to keep phones smooth.

Click the game once to capture the mouse. If the page is embedded somewhere that blocks mouse capture,
hold a mouse button and drag to look, or turn with the arrow keys.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Left click | Fire, swing, place a piece, or use the held item |
| Right click (hold) | Aim down sights (sniper: scope) |
| Space | Jump · leave the bus · open the glider |
| Shift | Sprint (uses stamina) |
| C / Ctrl | Crouch · slide while sprinting |
| R | Reload · rotate the ramp in build mode |
| E | Open a chest / pick up (swaps with the held slot when full) |
| G | Drop the held item |
| 1–5, mouse wheel | Select a slot · choose a piece in build mode |
| F | Pickaxe |
| B or Q | Toggle build mode (1 wall, 2 floor, 3 ramp, 4 cone) |
| T | Cycle build material (wood / brick / metal) |
| V | Edit the wall/floor you aim at: click or drag tiles to cut, V confirms, R resets, B cancels |
| U | Repair the build you aim at, or upgrade it wood → brick → metal |
| Hold E | Revive a knocked teammate · reboot teammates at a reboot van |
| E (next to a vehicle) | Drive, or ride as a passenger · E again gets out |
| W/S · A/D (driving) | Throttle / brake and reverse · steer |
| Shift · H (driving) | Boost (Pickle Kart) · horn |
| E (zipline tower) | Ride the zipline · Space lets go |
| E (vending bot) | Open the shop · 1–3 buy with Benton Bucks · E closes |
| E (upgrade bench) | Upgrade the held weapon one rarity |
| Z / middle click | Ping (enemy, chest, loot or "going here") |
| M | Full map (click to place a drop marker) |
| N | Emote |
| Esc | Pause |

## Milestone 1: what's in

- [x] **Match flow:** lobby, character select, the flying Benton Bus, a drop marker you pick on the map, skydive, glider, looting, 6 storm phases, eliminations, spectating (Space cycles players), victory and elimination screens, Play again. Solo mode only.
- [x] **Characters:** Colton, Emerson and Waylon each have their own model, hair/hat, backpack, idle, run, skydive, glide, swim and emote animations. Each has 3 outfits that unlock with level, and there are 5 skin tones. All three have identical combat stats.
- [x] **Island:** Benton Diesel Garage (garage bays, mezzanine, office), Pickles Park (giant pickle, slide, jungle gym, swings, pond, trampoline), Haunt Hollow (haunted house, graveyard, hidden crypt), Boom Co. Depot (warehouse catwalk, container yard, explosive barrels), and the Benton Kids Clubhouse (a treehouse on the central hill). There are also 4 cabins, roads, hills, beaches and a pond.
- [x] **Buildings:** walk-in interiors with stairs, upper floors, walkable roofs and destructible walls. Secrets: a legendary chest on top of the pickle statue (reach it with the trampoline) and one inside the Haunt Hollow crypt.
- [x] **Movement:** sprint with stamina, crouch, slide, jump, mantle/hurdle, swimming, fall damage, bounce pads with glider redeploy, and a third-person camera with collision. Mouse sensitivity, ADS sensitivity, FOV and invert-Y are in Settings.
- [x] **Weapons:** Thunder Rifle (AR), Zip SMG, Pump Buster (shotgun), Pop Pistol, Long Shot (scoped sniper with bullet drop), Boom Launcher (rockets) and Boom Ball grenades.
  - Five rarities, magazines, reloads and five ammo types.
  - Recoil, bloom/spread, ADS, damage falloff and headshots.
  - Hit feedback: hitmarkers, damage numbers and a damage-direction indicator.
- [x] **Building:** harvest wood, brick and metal with the pickaxe. Place walls, floors, ramps and cones on a snapping grid with a live preview and hold-to-rapid-place. You can rotate ramps. Pieces cost 10 materials, have health per material, can be destroyed, and track who placed them. Duplicate pieces in the same spot are rejected.
- [x] **Zero Build mode:** a regenerating 50 overshield, and no building or material pickup.
- [x] **Loot and survival:** 5 slots plus the pickaxe, stacking, swapping, dropping, and separate ammo/material storage. Chests, floor loot and 2 supply drops per match. Five healing/shield items with real use times: switching slots or leaving the ground interrupts them. Storm damage bypasses shields.
- [x] **Bots (always labelled [BOT]):** they pick drop spots, glide, loot chests and floor items, and upgrade weapons. They also harvest trees, fight with range-appropriate weapons, wall up under fire, heal, pickaxe through walls when stuck, rotate ahead of the storm, and dance after eliminations.
- [x] **HUD:** health, shield and overshield, stamina, materials, inventory with ammo, minimap, full map, compass, storm timer, players left, eliminations, killfeed and interaction prompts.
- [x] **Progression:** XP and levels, outfit unlocks, win/match/elimination stats, saved settings. Progress is saved in this browser only.

## Milestone 2: what's in

- [x] **Squad modes:** Solo, Duos, Trios and Squads. Your teammates are bots labelled [BOT]. They jump out of the bus with you, glide to your marker, follow you, head to your pings, and use buffs. Enemy squads drop together.
- [x] **Downed and revive:** lethal damage knocks you down instead of eliminating you while a squadmate is still standing. Knocked players crawl and bleed out (1.5/s from 100). Teammates revive with a 4 s hold of E and come back at 30 HP. When nobody on a squad is standing, the squad is wiped. There's no friendly fire.
- [x] **Reboot:** eliminated squadmates drop a reboot card that lasts 90 s. Teammates pick it up by touch, even while swimming. At one of the 4 reboot vans (blue vans next to the cabins), a 5 s hold of E respawns them in the air with a pistol. Each van then needs 60 s to recharge, and all vans go offline from storm phase 5.
- [x] **Team HUD:** squadmate health/shield and status (downed / card dropped / card picked up / out), name markers over teammates that show through walls, and teammates, pings and vans on both maps. The HUD counts squads left instead of players. Squad victory and placement screens. When you're eliminated, you spectate a teammate while you wait for a reboot.
- [x] **Buffs:** temporary-effect items with HUD timers and colored sparkle auras. Bots use them too.
  - Zoom Juice: +30% move speed for 12 s
  - Bouncy Soda: 40% higher jumps and no fall damage for 20 s
  - Spicy Pickle: +20% damage to players and builds for 12 s
  - Shield Snack: regenerate 4 shield per second for 15 s
- [x] **Building 2.0:**
  - Editing: walls on a 3×3 grid, floors on a 2×2 grid. Cut doors, windows and arches, confirm with V or reset with R. Only your squad can edit its builds.
  - Repair and upgrade: repairing costs materials in proportion to the damage; upgrading goes wood → brick → metal.
  - Structural integrity: pieces must connect to the ground or the world, and anything cut off collapses. Floating pieces can't be placed.

## Milestone 3: what's in

- [x] **Online multiplayer:** up to 4 human players per match. Bots fill the rest and are always labelled.
  - Works in Solo, Duos, Trios and Squads, and humans fill squads in join order.
  - Host a game or join from the **Open games** list or a code.
  - After a match, **Play again** brings everyone back to the same room.
  - If a player disconnects, a bot takes over their character. If the host leaves, everyone goes back to the room.
- [x] **Two ways to connect, one protocol:** the claude.ai link's built-in `room` capability, or the included Socket.IO relay (`server/index.js`), which offers the same interface (`src/net/roomShim.js`).
- [x] **Host-authoritative:** the host's browser runs the simulation (bots, storm, loot, damage, builds).
  - Each player moves their own character on their own device (responsive controls) and sends their actions to the host.
  - The host streams snapshots (about 12 per second), effect batches and periodic full resyncs, all within the room's 4 KiB limit. A 30-player match is about 2.2 KB.
- [x] **Mobile:** touch joystick, drag-to-look, on-screen buttons (drag FIRE to aim) and tappable HUD. There are phone layouts for the lobby and HUD, a prompt to turn the device sideways, and lighter graphics defaults.

## Update: Ranked (MMR)

- [x] **Casual / Ranked queue** in the lobby. Build and Zero Build are ranked separately.
- [x] **Ranks:**
  - Bronze, Silver, Gold, Platinum, Diamond and Champion, each with divisions I–III, then Legend.
  - Each division takes 100 rank points (RP).
  - You can lose progress inside a division, but you never drop a division.
- [x] **MMR (matchmaking rating):** an Elo-style skill rating. It moves by how your placement compared with what your rating predicted, plus a little for eliminations and wins. It is shown on the **Ranked** screen.
- [x] **Placement:** the first 3 ranked matches set your starting rank from your MMR, capped at Platinum I.
- [x] **Rank points each match:**
  - Earned from placement, eliminations and wins.
  - Minus an entry cost that grows with rank.
  - Scaled by how your MMR compares with your rank, so a rank that is too low climbs faster.
- [x] **Matchmaking:**
  - Ranked bots are tuned to the lobby's MMR, and the HUD shows the lobby's level.
  - Online, the lobby rating is the average of the humans' MMR, and rank badges appear in the room roster.
- [x] **Screens:**
  - The **Ranked** screen shows both ranks, MMR, progress, peak, the last 10 matches, the full ladder and how it works.
  - The result screen shows RP and MMR changes, promotions and placements.
- Everything is saved on this device, like the rest of the progression. There is no shared online leaderboard yet.
- Fixes in this update:
  - Ramps built on the ground can always be walked onto.
  - Reboot vans on slopes work for players and bots.
  - A stale-grid double-placement bug is fixed.

## Mini update: Supercharged XP and Supercharged rank

- [x] **Supercharged XP:**
  - A bonus pool of 2,500 XP refills every day at your local midnight. Unused days bank up to 7,500.
  - While the pool lasts, the XP you earn in any match (casual or ranked) is doubled.
  - The lobby shows what's left, or when it refills. The results screen shows the bonus.
- [x] **Supercharged rank:**
  - While your MMR is at least 90 ahead of your rank (about 1.5 divisions), your rank is ⚡ Supercharged.
  - Rank-point gains are ×1.5 and matches never cost RP, until your rank catches up.
  - It's off during placement matches and at Legend.
  - The tag shows on the lobby rank card, the ranked HUD, the results screen and the Ranked screen (boosted matches get a ⚡ in the history).

## Milestone 4: Wheels & Deals

- [x] **Vehicles:**
  - Four **Diesel Trucks** (a driver and 3 passengers) and four **Pickle Karts** (one seat, Shift to boost). They're parked at the Diesel Garage, the Farm House, the Lookout Cabin, Boom Co. Depot, Pickles Park, the Clubhouse and the Snack Shack.
  - Arcade handling over the real terrain: they climb build ramps and hop crests.
  - **Collisions:** hitting a wall stops the vehicle and damages it. At speed they smash weaker things, like build pieces and props.
  - **Fuel and pumps:** driving burns fuel. Stop at a pump (Diesel Garage or Snack Shack) to refuel.
  - **Damage:** vehicles have health. Bullets, pickaxes and explosions damage them, and at 0 they explode and throw everyone out.
  - **Run-overs:** hitting an opponent at speed hurts them. Teammates are safe.
  - **Shooting:** passengers can shoot, and their shots pass out of their own vehicle. Drivers can't shoot. A driver in a truck's cab is shielded by the truck.
  - Bot teammates hop into free seats when you drive, and hop out when you do.
  - The HUD shows speed, health and fuel, and the map shows every vehicle.
- [x] **Ziplines:** three cables between high points: the Clubhouse to Pickles Park, the Clubhouse to Haunt Hollow, and the Diesel Garage to the Lookout Cabin. Press E at a tower to ride; you can shoot while riding, and Space lets go.
- [x] **Benton Bucks:** a match currency.
  - Found in every chest, in some floor loot and in supply drops. Eliminations drop the victim's Bucks plus 25.
  - Picked up automatically, like ammo.
- [x] **Vending bots:** three shops, each selling three items for Bucks (E, then 1–3, or tap on a phone).
  - **Snack-O-Bot** (Clubhouse): healing.
  - **Pickle-O-Bot** (Pickles Park): buffs.
  - **Boom-O-Bot** (Boom Co. Depot): Boom Balls, an Epic Long Shot and a Rare Boom Launcher.
- [x] **Upgrade benches** (Diesel Garage and Haunt Hollow): raise the held weapon one rarity for 50 / 100 / 175 / 250 Bucks.
- [x] **Daily challenges:**
  - Three a day, rolled from the date so every device gets the same three. They reset at local midnight.
  - Each is worth 1,000 bonus XP. Examples: drive 500 m, ride ziplines, open chests, spend Bucks, upgrade a weapon, run someone over, eliminations, damage, top 10, or play matches.
  - They're shown in the lobby and on the result screen. In online matches, the host counts what you did.
- [x] **Online:** everything works for up to 4 players.
  - A player's own vehicle is simulated on their device, like their movement. Other vehicles follow the host.
  - Entering, leaving, buying and upgrading are checked by the host.
  - A 30-player snapshot with every vehicle moving is about 2.5 KB, under the 4 KiB limit.
- Also in this update:
  - The lobby's side panels scroll on short windows, so nothing gets pushed off screen.
  - Interaction prompts show the right key.
  - Builds can't use a vehicle as support.

## Roadmap: not built yet

- [ ] Ranked: seasons with resets and rewards, and a shared online leaderboard
- [ ] Building: editing ramps and cones
- [ ] Match flow: pre-match warm-up area, match replays
- [ ] Teams: carrying knocked teammates
- [ ] Weapon attachments and scopes as separate items
- [ ] World: doors, story NPCs and quests, bosses, keycards and vaults; bots that drive
- [ ] Progression: weekly challenges, achievements, more emotes and cosmetics
- [ ] Online: more than 4 players, host migration, joining a match in progress, and anti-cheat (the host is trusted)
- [ ] Benton Kids extras: 3-sibling co-op adventure mode with combo abilities and cooldowns, a customizable clubhouse, garage vehicle customization, hidden family collectibles, and rotating spooky/playground events

## Testing

Automated suites drive the real game in headless Chromium:

```bash
npm run island:dev &                        # serve on :5174
node tools/island-playtest.mjs              # 33 checks
node tools/island-features.mjs              # 10 checks
node tools/island-milestone2.mjs            # 19 checks
node tools/island-ranked.mjs                # 12 checks
node tools/island-supercharged.mjs          # 13 checks
node tools/island-milestone4.mjs            # 22 checks
npm run island:server &                     # relay on :3100 (the dev server proxies to it)
node tools/island-online.mjs                # 22 checks: two browsers, host + client
node tools/island-online-squad.mjs          # 6 checks: desktop host + phone client in Duos
node tools/island-online-m4.mjs             # 11 checks: a client drives, rides and shops through the host
node tools/island-mobile.mjs                # 18 checks: emulated phone with real multi-touch
```

- **`island-playtest.mjs`:** a full solo match. Bus jump, landing, chest opening, pickup/drop/stacking/slot limit, heal interruption, rifle damage and reload, all four build pieces, running up a ramp, destroying a structure, harvesting, storm damage, pause/resume, and a full bot-vs-bot match to the final two. It then covers victory, Play again, player elimination with spectating, returning to the lobby, and every lobby button.
- **`island-features.mjs`:** Zero Build overshield, bounce pad and glider, fall damage, explosive barrels, mantling, swimming, supply drops and the sniper scope.

- **`island-milestone2.mjs`:**
  - Squads: squad setup, teammates dropping with you, no friendly fire, knock-down, the player reviving a teammate (held E), and bots reviving the player.
  - Buffs: all four, measured.
  - Pings: in the world and followed by the bots.
  - Reboot: picking up a card, holding E at a van, and bots rebooting the player.
  - Building 2.0: supported placement, editing a door and resetting it, repair and upgrade, and collapse.
  - Match end: squad wipe and placement, and squad victory.

- **`island-ranked.mjs`:** placement matches and the Platinum cap, promotion on a winning streak, losses without demotion, MMR following the lobby rating, separate Build/Zero Build ranks and history, bot skill following MMR, a real ranked match (queue, HUD, result screen, lobby card, Ranked screen), and casual matches leaving the rank alone.
- **`island-supercharged.mjs`:**
  - Supercharged XP: the starting pool, daily refill and 3-day cap, XP doubling in a real match (saved and shown), running out, and the empty-pool refill timer.
  - Supercharged rank: when it turns on and off, no RP loss, ×1.5 gains, and the lobby card, HUD, results and Ranked screen.
- **`island-milestone4.mjs`:**
  - The world's vehicles, shops, benches, ziplines and pumps.
  - Driving with real keys: entering with E, W/A driving, the vehicle panel and getting out.
  - Fuel burn, running dry and refuelling at a pump.
  - A bot teammate riding along.
  - Run-overs (opponents only), crashing into a wall, shooting a truck, and the explosion that throws occupants out.
  - Drivers can't shoot; passengers can.
  - Climbing build ramps.
  - Zipline rides: E, SPACE to let go, a full ride with ground clearance.
  - Bucks from chests and eliminations.
  - Buying at a vending bot (and being refused when short).
  - Upgrading at a bench.
  - Daily challenges paying out on the result screen and in the lobby.
- **`island-online-m4.mjs`:** the same vehicles on both machines, a client driving (the host sees the movement, fuel and distance), getting out, the client seeing the host drive, a client purchase checked by the host, snapshot size with every vehicle moving, and challenge stats reaching the client's result.
- **`island-online.mjs`:**
  - Joining: open-games list, roster, and matching rosters and bots on both machines.
  - Movement: bus jump, landing position agreement, host teleports, and client movement.
  - Actions: shooting, building, picking up loot and taking damage.
  - Ranked: the host's queue choice and lobby rating reach the client, and rank badges show in the roster.
  - End of match: elimination with the player's own result, match end, Play again, and a bot taking over when someone disconnects.
  - Presence stays under the 4 KiB limit with 30 players.
  - It also passes against the production build served by the relay server.
- **`island-online-squad.mjs`:** a phone client and a desktop host on the same Duos squad revive each other over the network.
- **`island-mobile.mjs`:** phone detection, the joystick, drag-look, firing while steering (multi-touch), tapping slots, build mode, the map, pause, driving with the stick (USE to get in and out), and the portrait prompt.

Online-play limits:
- The claude.ai room path couldn't be tested from here, because it needs signed-in claude.ai viewers. It uses the same protocol, message sizes and rates as the relay path, which is fully tested.
- Only the host checks the rules, so a modified host could cheat. That's fine for friends and family.
- Joining a match that has already started isn't supported; you join the next one.

Known limits: the tests use software rendering, so they check behaviour, not frame rate. The simulation costs about 0.2 ms per frame. Near the ground a frame is about 600–900 draw calls, which is fine for desktop GPUs, but it hasn't been profiled on low-end laptops. If frame rate drops, turn off Shadows in Settings.

## Code map

| Path | What it does |
| --- | --- |
| `src/world/physics.js` | Heightmap, box/ramp/cone colliders, spatial hash, raycasts |
| `src/world/island.js` | Terrain, POIs, buildings, props, chests, vehicle spots, pumps, vending bots, benches, ziplines, map image |
| `src/entities/characters.js` | Kid models, outfits, procedural animation |
| `src/entities/actor.js` | Movement, health/shields, inventory, item timers |
| `src/gameplay/game.js` | Match flow, bus, damage routing, eliminations, XP |
| `src/gameplay/player.js` | Input → actions, camera |
| `src/gameplay/bots.js` | Bot AI |
| `src/gameplay/vehicles.js` | Trucks and karts: handling, fuel, damage, run-overs, seats, network rows |
| `src/gameplay/economy.js` | Benton Bucks, vending bot stock, upgrade benches |
| `src/core/challenges.js` | Daily challenges |
| `src/core/ranked.js` | Ranks, MMR, rank points, Supercharged rank, lobby bot skill |
| `src/core/supercharge.js` | Daily Supercharged XP pool |
| `src/gameplay/{combat,building,loot,storm,effects,items}.js` | Systems and data |
| `src/ui/{hud,menus}.js` | HUD and menu screens |
