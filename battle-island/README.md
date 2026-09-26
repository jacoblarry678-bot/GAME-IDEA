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

## Roadmap: not built yet

- [ ] Building: edit mode (window/door/arch) with confirm/reset, repair, upgrade and structural integrity (currently a destroyed support does not collapse the pieces above it)
- [ ] Match flow: pre-match warm-up area, duo/trio/squad rules, match replays
- [ ] Teams: squadmate bots, pings, downed state and reviving, carrying, reboot cards and stations
- [ ] Movement: ziplines
- [ ] Weapon attachments and scopes as separate items
- [ ] World: drivable vehicles (fuel, damage, passengers), doors, NPCs, quests, vendors, currency, weapon upgrades, bosses, keycards and vaults
- [ ] Progression: challenges, achievements, more emotes and cosmetics
- [ ] Online multiplayer. Not started, and it needs a real networking backend that has been tested before it ships.
- [ ] Benton Kids extras: 3-sibling co-op adventure mode with combo abilities and cooldowns, a customizable clubhouse, garage vehicle customization, hidden family collectibles, and rotating spooky/playground events

## Testing

Two automated suites drive the real game in headless Chromium:

```bash
npm run island:dev &                        # serve on :5174
node tools/island-playtest.mjs              # 33 checks
node tools/island-features.mjs              # 10 checks
```

- **`island-playtest.mjs`:** a full solo match. Bus jump, landing, chest opening, pickup/drop/stacking/slot limit, heal interruption, rifle damage and reload, all four build pieces, running up a ramp, destroying a structure, harvesting, storm damage, pause/resume, and a full bot-vs-bot match to the final two. It then covers victory, Play again, player elimination with spectating, returning to the lobby, and every lobby button.
- **`island-features.mjs`:** Zero Build overshield, bounce pad and glider, fall damage, explosive barrels, mantling, swimming, supply drops and the sniper scope.

Known limits: the tests use software rendering, so they check behaviour, not frame rate. The simulation costs about 0.2 ms per frame. Near the ground a frame is about 600–900 draw calls, which is fine for desktop GPUs, but it hasn't been profiled on low-end laptops. If frame rate drops, turn off Shadows in Settings.

## Code map

| Path | What it does |
| --- | --- |
| `src/world/physics.js` | Heightmap, box/ramp/cone colliders, spatial hash, raycasts |
| `src/world/island.js` | Terrain, POIs, buildings, props, chests, map image |
| `src/entities/characters.js` | Kid models, outfits, procedural animation |
| `src/entities/actor.js` | Movement, health/shields, inventory, item timers |
| `src/gameplay/game.js` | Match flow, bus, damage routing, eliminations, XP |
| `src/gameplay/player.js` | Input → actions, camera |
| `src/gameplay/bots.js` | Bot AI |
| `src/gameplay/{combat,building,loot,storm,effects,items}.js` | Systems and data |
| `src/ui/{hud,menus}.js` | HUD and menu screens |
