# Status

This file is updated at each milestone handoff. It records what works, what is
incomplete or still a known issue, and what comes next.

## Milestone 1: Playable match (complete)

**Works and has been tested**
- Boot → main menu (live 3D flyover) → Play setup → Loadouts → match → results → Play Again / Main Menu.
- Cinder Yard is a finished layout: three lanes, flank routes, elevation (dock, flatcar, crates), and sealed boundaries.
- Team Deathmatch has 1–5 enemy bots and 0–4 allied bots. Score limit, time limit, friendly fire, tie handling (draw) and a 3-second countdown all work.
- Bots navigate with a nav grid and A*, and use line of sight, field of view and reaction delays. They pick targets, strafe, burst-fire, reload, swap to the pistol, take cover when hurt, flee live frags, throw frags and smoke, and avoid shooting teammates. Four difficulty levels change reaction time, turn speed, aim error, tactics and how often they use grenades.
- Weapons: AR, SMG, pump shotgun (tube reload you can interrupt), bolt sniper (scope overlay) and pistol. Each has damage falloff, hit zones, recoil with recovery, spread and bloom, ADS that lines up the sights, swap timing, melee, and frag and smoke grenades.
- Movement: walk, sprint, crouch, slide, jump, mantle and vault, step-up and stairs.
- HUD: health, ammo, equipment, score bar and timer, kill feed, rotating or fixed minimap, hit markers (including kill and headshot), damage direction, grenade warnings, medals and score popups, the scoreboard (Tab), the death screen with respawn, and the spawn-protection notice.
- Settings: graphics, controls with full rebinding, audio buses, interface and accessibility. They apply immediately, persist, and can be reset per tab or all at once. Options that need a reload, or that the platform doesn't support, say so.
- Pause (offline) freezes the simulation. The match pauses if you release the mouse or switch tabs.
- Local profile: 5 loadout presets, match setup, and career stats recorded exactly once per match.

**Verification run**
- `npm test`: 49/49 rules tests pass.
- `tools/sim.mjs`: 5v5 bot matches at every difficulty finish with no stuck bots. The kill rate is ~0.35–0.5 per second across all 10 players.
- `tools/e2e.mjs` in headless Chromium runs the whole flow above with the player under AI control. Checks cover pause, settings, rebinding, persistence, results, play again, loadout changes, the scope and number-key swaps, and the console stays free of errors.

**Known issues / limits**
- Performance on real GPUs hasn't been measured: the container renders on the CPU (SwiftShader, 1–3 FPS). Use the in-game FPS counter.
- The announcer uses browser speech synthesis. Some browsers have no voices, so the line shows only as a caption.
- Embedded previews may block pointer lock. The game falls back to unlocked mouse look, which still works while the cursor stays in the window.
- Third-person animation is procedural and simple: no IK, and only a basic death fall.
- The texture-quality setting applies after a reload.

## Milestone 2: Visual and gameplay polish (complete)

**Added**
- **Firing Range** (from the main menu, or **Test in Firing Range** in Loadouts): 13 training targets at 5–90 m. Some stand, some crouch and some strafe, and there is cover to peek from. A live panel shows damage per shot, shots to kill and TTK at 10/25/50 m, plus your last hit (damage, zone, distance), your last elimination (shots and milliseconds) and accuracy. Hotkeys: T next weapon, Y infinite ammo, H moving targets, U reset.
- **Post-processing**: bloom and GTAO ambient occlusion are real toggles. Bloom is on by default from Medium up; AO is on in Ultra. The composer runs only when one of them is enabled, and keeps 4× MSAA.
- **Dynamic resolution** (optional) holds the frame rate by lowering the render scale to as little as 50%. The FPS overlay now also shows render scale and draw calls.
- **Audio**: convolution reverb crossfades between outdoor and indoor, based on whether there is a roof overhead and walls nearby. Distant gunfire and explosions echo off the yard, and occluded shots are muffled.
- **First-person hands**: capsule sleeves and gloves with fingers wrapped on the grip and foregrip. The reflex sight is now an open frame, and the weapon preview on the loadout screen has moved.
- **Third-person**: rounded capsule limbs. The hips turn toward strafes and the legs run backwards when backpedalling. Soldiers flinch when hit, and at range they drop their shadows and weapon detail (LOD).
- **World**: backdrop buildings now have window facades, and the dock stairs no longer have a support post in the middle.
- **AI**: bots share spotted enemies with teammates within 32 m, pre-aim likely approaches while holding a position, and take flank lanes into the enemy half. Update order now rotates each tick, which removes a measurable West-team advantage (12-match aggregate: 445 vs 462).

**Verification run**
- `npm test`: 49/49. `npm run e2e`: 31/31. That covers the M1 flow plus the runtime bloom/AO toggle, the firing range (targets, eliminations, stats panel) and returning to Cinder Yard afterwards.
- Ultra-preset screenshots (bloom + GTAO + 4K shadows) render with no errors.

**Known issues**
- GPU performance is still unmeasured, for the reason given under M1. On Ultra, GTAO adds a full extra geometry pass (~400 draw calls in the yard).
- Weapon attachments are not in yet (planned for M4). The range currently tests base weapons.

## Milestone 3: Progression and cosmetics (complete)

**Added**
- **Player level** (1–55) and **weapon levels** (1–20 per weapon), both earned by finishing matches. Level and weapon-level milestones unlock cosmetics.
- **Cosmetic catalog**: 80 items with stable IDs, all generated in code. That's 4 operators (Voss, Marek, Sol, Kestrel), 12 outfits, 25 weapon finishes (5 of them emissive, metallic or iridescent), 9 charms (3D, they swing as the weapon moves), 12 calling cards, 12 emblems and 6 banners. Each item has a rarity, a description and its unlock requirement.
- **Armory** (inventory): owned and locked items, a NEW badge on recent unlocks, a live 3D preview on the operator or weapon, equip per weapon (or on all weapons), and equipping an operator from its outfit.
- **In the match**: your finish and charm show on your first-person weapon, and your outfit on your sleeves and gloves. Your operator model wears its outfit, headgear and weapon finish in the death cam. Your emblem appears on the scoreboard and your calling card on the results screen. Team colour bands always stay on top, and cosmetics never change hitboxes or gameplay.
- **Battle Pass, Season 1 ASHFALL**: 50 tiers with free and premium tracks. Every match XP point counts as pass XP. Rewards are claimed per tile or with Claim all, and can't be claimed twice. A duplicate converts to credits. Premium unlocks with **950 test credits**; you start with 1,500. A season-end notice explains that tiers reset and owned items are kept.
- **Challenges**: 5 daily and 3 weekly, picked deterministically from pools. They reset at 00:00 UTC (daily) and Monday 00:00 UTC (weekly), track progress from real match stats, and pay XP once.
- **Store (demo)**: daily featured items and weekly bundles, generated on the device from the date and labelled that way. The flow is preview → buy → confirm → added to Armory → equip. Owned items are excluded from bundle prices. You can't buy something you already own. Insufficient funds shows a clear message. There's a purchase history and a clearly labelled **+1,000 test credits** demo button.
- **Results**: an XP breakdown (score, completion, win, time, difficulty, challenges), level progress, weapon XP, unlocks and pass tier gains, all awarded exactly once per match.
- **Profile v2** save with migration from v1, plus validation that drops unknown or invalid IDs and recovers from corrupt data.

**Verification run**
- `npm test`: 83/83. The 34 new tests cover levels, unlocks, duplicates, equip rules, pass claims and premium, store purchases and bundles, funds, daily/weekly resets, challenge completion, match rewards paid once, persistence, and corrupt-save or v1 migration.
- `node tools/m3.mjs`: 15/15 browser checks. The full flow is Armory → Store purchase → confirm → equip → premium pass + claim all → challenges → match with the cosmetics visible → rewards applied once → reload persistence.
- `npm run e2e`: 31/31 (no regressions).

**Not a real economy**: all currency is TEST credits. Purchases are simulated and stored in this browser's local storage, which a user can edit. A release would need server-side validation of balances, purchases and entitlements, and no real payment processing exists in this build.

## Milestone 4: More content (complete; optional co-op survival not built)

**Added**
- **Modes**: Free-for-All, Domination (3 flags with capture/contest/neutralize), Hardpoint (6 rotating zones per map), Elimination (rounds, no respawns, spectator camera) and Gun Game (16-step ladder ending on the axe, melee sets the victim back). Bots play the objectives with objective and slayer roles.
- **Private match controls**: map, mode, time limit or round time, score limit or rounds to win, bots per team (or opponents in FFA), difficulty and friendly fire.
- **16 weapons**: KV-7, Tarn-556 (bullpup), Meridian-B (3-round burst), Bastion .30 (battle rifle); Vesper-9, Wasp MP, Hollow-X (integrally suppressed); Brakk-12 (pump), Rook Auto-12; LR-338 Longreach (bolt), Sentinel DMR (3x optic); Drover LSW (drum), Anvil-60 (belt); HX-9 Warden, Grizzly .50 (revolver); and a breaching axe (one-hit melee weapon, can't aim). Each has its own model, sight picture, sound and unlock level, and bots use all of them.
- **Gunsmith**: 16 attachments in 6 slots (optic, muzzle, barrel, magazine, stock, underbarrel), up to 5 per weapon. Every attachment states its upside and its drawback, and stat bars show the change against the base weapon. Optics, muzzles, barrels, magazines and underbarrels change the model and the sight picture. Attachments unlock by weapon level (2–19) and are never sold. Bots get random builds.
- **Perks**: 9 in 3 slots, unlocked by player level: Quickdraw, Scavenger, Flak Lining; Hardline, Ghost, Fast Hands; Resolve, Dexterity, Dead Silence. Bots now hear footsteps, which Dead Silence counters.
- **Equipment**: the FL-2 flash grenade blinds by distance and facing; the reduced-flash setting caps the white-out, and blinded bots lose track of you. The Bulwark deployable cover is an axis-aligned barrier that blocks bullets and blasts until it has taken 450 damage or 30 s have passed. Both unlock by level.
- **Support abilities** come from consecutive eliminations and reset on death: Recon Scan (4) reveals enemies on the minimap and to allied bots, Supply Drop (6) restocks ammo, equipment and health, and Area Strike (8) hits the aimed point after a visible warning. Ghost hides from Recon, and strike kills don't chain into more abilities. There is a HUD strip, announcer lines, kill-feed notices and world visuals, and bots use all three.
- **Maps**: Old Quarter (town streets, a walled clock courtyard, an enterable chapel, bakery, gendarmerie, hotel, bookshop, pharmacy and café, and a canal road) and Signal Station (a fenced compound with an operations building, generator shed and relay hut, a 42 m lattice mast, a dish field and survey bunker, a ridge road, a motor pool and a helipad). Each has team and neutral spawns, bot hotspots, 3 flags and 6 hardpoints. Pick them in Play setup; each map builds the first time it's used.
- **Profile v3** stores attachment builds and perks. Loading an older save validates it: locked or unknown weapons, attachments, perks and equipment fall back to defaults. Results list new weapons and new attachments.

**Verification run**
- `npm test`: **172/172**. New tests cover burst fire, the axe, unlock gating, attachment math and sanitizing, Quickdraw, Hardline, Recon and Ghost, Supply Drop, Area Strike, flash, Bulwark (blocks, breaks and frees space), Flak, and every mode for 45 s on each of the 3 maps.
- `npm run maps`: 0 problems. All spawns are clear, every hotspot and objective is on the main nav region, and 552 of 552 spawn→objective paths resolve on each map.
- `tools/sim.mjs`, 8-minute 5v5 runs on the new maps in TDM, DOM and HP: 0–2 stuck reports per run, and those that remain are marksmen holding long sightlines. Winners alternate across repeated runs. An early Signal Station Hardpoint layout favoured the east team, so its zone list was rebalanced.
- Browser (headless Chromium, SwiftShader): `e2e` 31/31; `modes` 27/27; `m3` 15/15; `m4` 16/16 (unlock gating, gunsmith, perks, keys 3/4/5, HUD strip, Bulwark, flash overlay); `maps` 4/4 (map picker, both new maps start, screenshots reviewed).
- One run of `modes.mjs` exited early with a harness exception. It did not reproduce in two reruns (27/27 both times), so it is noted rather than explained.

**Known issues / limits**
- GPU performance is still unmeasured; see M1. On SwiftShader the first build of a new map takes about 5–6 s.
- The optional **co-op survival** mode was not built. It is listed as planned in Play setup and never offered as playable.
- The axe uses the generic melee animation. The Tac Laser has no visible beam; its gameplay effect is that bots notice you more easily.
- The DMR's 3x sight picture is a small eyepiece view, not a full-screen scope.
- The Bulwark snaps to the nearest axis because the collision world is axis-aligned.
- Bot balance was checked by simulation samples, not by human playtesting.

## Milestone 5: Online play, self-hosted (complete within the environment's limits)

**What the environment allows**: a Node WebSocket server can run, and the match simulation already
runs headless, so a real server-authoritative multiplayer server was buildable and testable here.
What it can't provide is a public, always-on host: this container is temporary and not reachable
from the internet, and there is no account or payment backend. So online play is **self-hosted**:
someone runs the server, and others connect to it.

**Added**
- **Dedicated server** (`npm run server`): it serves the built game over HTTP and runs one match room on a WebSocket (`/ws`) on the same port (4190 by default). The room loops through a map/mode rotation with a results pause between matches, or runs a fixed map and mode from the CLI. There are also bot count, difficulty, time, score and name options, and `/status` returns JSON.
- **Server authority**: clients send only inputs. The server simulates movement, firing, hits, damage, scoring, objectives, equipment, deployables and support abilities with the same code as offline play. Inputs are applied one frame at a time under a real-time budget, which blocks speed hacks, and are validated and clamped. Names, loadouts and attachment builds are sanitized, and mismatched protocol versions are rejected with a reason.
- **Lag compensation**: the server keeps 0.6 s of position history and rewinds the other players to the time the shooter's client was drawing them (capped at 250 ms) for each shot and melee.
- **Bots and players**: joining players take over bot slots, and team modes balance humans across teams. A bot returns when a player leaves. Bots are always tagged `[BOT]`; players are not. In Elimination, someone joining mid-round spectates until the next round.
- **Client**: there is an Online screen with the server address (pre-filled when the page is served by the server), name, loadout and connect status, plus clear notes on what isn't provided. Your own movement is predicted locally and blended toward the server's position, snapping if it's off by more than 2.5 m. Other players are interpolated 100 ms behind, and grenades are smoothed between snapshots. Server events drive the same HUD, kill feed, audio and effects as offline play. Remote players' cosmetics (operator, outfit, emblem) are shown. The scoreboard has a ping column. The pause menu doesn't stop an online match. The next match starts automatically after the results, and losing the connection returns you to the menu with a notice.
- **Protocol**: JSON over WebSocket at 60 Hz simulation and 20 Hz snapshots. A snapshot is about 1 KB with 6 combatants, roughly 20 KB/s per player.
- **Gameplay fix found while testing**: the Bulwark is now 1.3 m tall. At 1.15 m it left a crouched player's head exposed, which caused an intermittent test failure.

**Verification run**
- `npm run nettest`: 20/20 with real WebSocket clients against the server. It covers join, welcome and roster (2 humans on opposite teams, bots flagged), the version reject, the countdown, movement from inputs (~5 m/s), input acks, the input time budget, a server-side kill seen by both clients, damage and shot broadcasts, scoreboard stats, the death state, respawn on request, lag compensation (and its 250 ms cap), leaving with a bot refill, the /status endpoint and bandwidth (20 snapshots/s, ~19 KB/s).
- `npm run online`: 22/22 with two headless Chromium players. Both connect through the Online screen. A sees Bravo as a human and the bots tagged. Prediction matches the server, and B sees A in the same place. A server-side elimination shows on both screens (death screen, kill feed, scoreboard), then B respawns. When B leaves a bot takes the slot, and losing the server returns to the menu. A server-ended match shows online results, and the client follows the rotation to the next map and mode.
- **At a simulated 150 ms round trip** (75 ms each way): movement responds immediately, prediction and server agree after stopping, and tapped shots at a strafing player land 4 of 4 and eliminate them. **Control run with lag compensation off**: about 1 hit in 12–13 shots. The test was run repeatedly and passed every time after the fixes listed below.
- Regression (after restarting the preview server): `npm test` 172/172, `e2e` 31/31, `modes` 27/27, `m3` 15/15, `maps` 4/4. `m4` scored 15/16 once and 16/16 on four reruns; the check that failed that once wasn't captured (likely a bot standing where the Bulwark deploys).
- Test fixes during this milestone: the online and net tests first failed intermittently because bots could kill a test player before being frozen, and because hits on an already-dead target were counted. A debug-only "revive" hook and a corrected metric fixed both.

**Known issues / limits**
- No public servers, matchmaking, server browser, accounts, friends, chat or voice. You connect by address.
- Anti-cheat stops at server authority. Aim and view direction come from the client, so aim assistance can't be detected.
- Progression and unlocks live on each device, so the server can't verify that a loadout was earned.
- Online results award XP and challenges to your local profile like offline matches do. They are just as editable by the user and are not a secure economy.
- The claude.ai artifact copy can't reach a local server; use the address the server prints.
- Only one room per server process. Joining at full capacity is refused, and capacity equals the bot slots (10 in team modes, 8 in FFA).
- The netcode has been tested on localhost and with simulated latency, not over real internet links with packet loss. WebSocket (TCP) means a lost packet causes a brief stall, not a gap.
- GPU performance is still unmeasured (see M1).

## Update 0.5.1: sun, reflections, pistol buff, Waspinator collab

**Added**
- **Sun glare and lens flare**: a screen-space glare, core, anamorphic streak and ghosts follow the sun, plus a soft veil when you look toward it. Visibility comes from a ray through the collision world and smoke, so buildings, containers, pitched roofs, tree crowns and smoke hide it. There's a Settings → Graphics toggle, and *Reduce Flashing* dims it.
- **Reflections on buildings**: each map bakes a reflection probe the first time it loads (a cube snapshot of the map from its centre, prefiltered). Windows are now tinted mirror glass, and windows, white tanks and satellite dishes reflect that map's own buildings and sky, with sun glints that bloom catches.
- **Sight-only occluders**: tree crowns and pitched-roof volumes block sight (bots, the flare) but not movement or bullets. Distant backdrop buildings block the flare (client only).
- **Scope glint**: enemies aiming a sniper rifle, DMR or 3x optic at you show a bright glint at their scope, scaled with distance.
- **HX-9 Warden buff**: damage 34→38 near and 21→26 far, falloff range 10–24 m → 14–32 m, head multiplier 1.4→1.5 (two headshots kill), 420→460 rpm, magazine 12→15 (reserve 60), lower recoil and spread, faster reload, ADS and swap.
- **Waspinator collab** (licensed per the project owner; see ASSETS.md): the *Waspinator Keychain* (legendary 3D charm: green armour, glowing blue visor, translucent wings, striped abdomen) and the *Waspinator* banner (epic). Both are original procedural art; the uploaded reference image is not included in the game. They sell in a permanent **Collab** section of the Store, individually or as a 20%-off bundle (2,240 test credits), and stay out of the daily and weekly rotation. They are cosmetic only.

**Verification run**
- `npm test`: 178/178. New tests cover the Warden shots-to-kill (3 body shots to 14 m, 4 to 32 m, 2 headshots), the collab catalog entries, rotation exclusion, bundle price and purchase, the no-duplicate rule and equipping.
- `node tools/sun.mjs`: 17/17. On each map the flare shows facing the sun in the open, hides when a building blocks it, and is absent facing away, and windows use that map's probe. It also covers enemy scope glint, the Store collab section, the bundle purchase and the keychain on the first-person weapon. Screenshots were reviewed. On the first pass the flare showed through a tree canopy and the windows looked black; both were fixed.
- Regression: `nettest` 20/20, `e2e` 31/31, `modes` 27/27, `m3` 15/15, `m4` 16/16, `maps` 4/4, `online` 22/22, map validation 0 problems. Bot sims on Old Quarter and Cinder Yard ran with 0–1 stuck reports.
- `m3` needed one test fix: it bought "the first Store item", which is now the collab keychain and costs more than a new profile's credits.

**Known issues**
- The flare is a screen overlay. Thin visual-only parts (lamp posts, the lattice mast, fences) don't block it.
- The reflection probe is one snapshot per map, taken from the map centre. It's an approximation: reflections don't move with the viewer and don't include players.
- Scope glint shows regardless of where the sun is, as is common in shooters.

## Hotfix 0.5.2: sealed Waspinator skin (ready to release at any moment)

**Added**
- **Content vault**: drops ship as AES-256-GCM ciphertext, with keys derived from a ~100-bit release code by PBKDF2-SHA256 at 210,000 iterations. GCM rejects tampered data, and decrypted content is validated before it touches the catalog. Opened content registers at runtime, before the profile is validated, so owned vault items survive reloads.
- **Release paths**: *Store → Redeem code*, a self-hosted server with `--release` (sent in the welcome message, so joining players unlock it automatically), or a code baked into a public build (`tools/vault.mjs release`). Unlocks are remembered per device.
- **Drop `drop_001`**: the **WASPINATOR** legendary operator skin, with its outfit *Hive Armour*. It has green armour plating, a visor helmet with a glowing blue band, antennae and gold mandibles, chest lenses, gold shoulder trim, yellow/black banded legs and four translucent wings, and green first-person sleeves. Team colour bands and hitbox are unchanged. Once released it appears in the Store's Waspinator Collab section for 1,800 test credits.
- **Generic armour kit** in the soldier renderer (visor helmet, plated shell, banded limbs, chest lenses, back wings), driven entirely by outfit data. The renderer code names no item.
- `tools/vault.mjs` (keygen, seal, open, release, list) and `.gitignore` rules for vault sources and codes.

**Verification run**
- The built bundle contains no plaintext item ids or names for the drop: 0 hits for `op_waspinator`, `of_waspinator`, `Hive Armour` and the description.
- `npm test`: 182/182 without the code (release tests skipped) and **188/188 with `VAULT_TEST_CODE`**. Those cover a wrong code, tamper rejection, unlocking with different case and spacing, Store registration, redeeming twice, purchase and equip, the remembered unlock and persistence across a reload.
- `node tools/vaultui.mjs`: 8/8 in the browser. The drop is invisible before release, a wrong code is refused, and the right code unlocks it with an announcement. Then: buy and equip, persistence after a page reload, a new player auto-unlocking it from a server started with `--release`, and the other player seeing Alpha wearing the skin online. Screenshots were reviewed.
- Regression: `nettest` 20/20, `m3` 15/15, `e2e` 31/31, `online` 22/22, `sun` 17/17, `m4` 16/16.

**Limits**: this hides content until release; it is not DRM. After a code is published, the drop can be read by anyone with the build. Unlocks and purchases are local like all progression.

## Update 0.6.0: Battle Royale, dynamic weather, Supercharged XP

**Added**
- **Battle Royale (mini)** (`br`): up to 10 players (you + 9 bots offline; 8 slots online), everyone for themselves, no respawns.
  - **Start**: dispersed drop-in spawns, a pistol + axe start, and a 30-second *weapons-cold* phase (no player damage, bots loot instead of fighting).
  - **Loot**: about 38 items at match start (weapons with their own ammo, ammo boxes, medkits, grenade packs). Weapons swap with **F / D-pad ↓**, edge-triggered with a short cooldown; ammo, medkits and gear are picked up automatically when useful. Eliminated players drop their gun.
  - **Zone**: five phases, each a wait and then a shrink toward a new circle inside the old one, centred on walkable ground. Damage outside rises from 2 to 15 HP/s and ignores spawn protection. Natural regen stops at 60; medkits heal to 100.
  - **Winning**: unique placements; last one standing wins, and on time-up the survivor with the most eliminations wins.
  - **Bots** loot what improves them, hold spread-out spots inside the next circle, and run for the zone when outside or about to be.
  - **HUD**: players alive, zone clock, weapons-cold timer, an outside-zone warning with a blue screen tint, minimap circles (current + next) and a pick-up prompt.
  - **World**: an animated zone wall, a next-circle ring and loot shown with the game's own weapon models plus ammo/medkit/grenade-pack models and tier-coloured beams.
  - **After elimination**: you spectate your killer (or a survivor). Offline, Space simulates the rest of the match to a real winner; results show your placement, or *LAST ONE STANDING* for a win.
  - **Online**: the server runs zone, loot and placements. Snapshots carry the zone (`m.br`); the loot list is sent only when it changes; the protocol is now **v2** with an interact input bit. BR is the last stop of the default server rotation, or use `--mode br`.
- **Dynamic weather**: clear, overcast, rain, thunderstorm and fog, changing every 1–2 minutes along a transition table, or fixed per match (Play setup → Weather).
  - **Visuals**: the sky shader greys out and hides the sun; sun light dims and fog tints and thickens. Rain streaks stop at roofs (a per-map height grid built from the collision world). Lightning flashes the sky and lights, with thunder delayed by distance.
  - **Ground and audio**: wet ground darkens and gets glossier over ~25 s and dries over ~60 s. A rain audio bed is muffled indoors. Sun glare fades under cloud.
  - **Gameplay**: fog and rain cut bot sight range (95 m → about 43 m in fog).
  - **Online and settings**: online, the server owns the weather. *Settings → Graphics → Weather Effects* turns off rain, flashes and wet sheen; fog and light always follow, for fairness.
- **Supercharged XP** (event `supercharged_060`): a free main-menu gift, claimable once per profile, worth one hour of 2× player, weapon and battle-pass XP. It counts down only during matches (played seconds), so it doesn't rely on the device clock and isn't wasted while you're away. A match started with boost time left is doubled; results show the bonus line and the time left. There's a HUD badge with a countdown; saves are clamped to at most one hour. It never touches gameplay and is never sold.
- Also: the main-menu status line no longer says online play is unavailable (stale since M5); the version label reads *Update 0.6.0*; kill feed and death screen name **the zone** as the killer when it is.

**Verification run**
- RESULTS_PLACEHOLDER

**Known issues / limits**
- Battle Royale uses the existing three maps, which are compact for 10 players: bot-only matches run about 2–4 minutes. A purpose-built large map is a natural follow-up.
- Rain streaks are 1-pixel lines and there are no puddle reflections or splashes. The wet look is a material change, not screen-space reflections. Rain isn't drawn on the first-person weapon.
- Bots don't use cover from the zone wall or plan rotations around other players' positions; they head for a spread-out spot in the next circle.
- Supercharged XP and all progression are stored locally and remain editable by the user (as before).
- Weather and BR performance are still unmeasured on a real GPU; the container renders with SwiftShader.

## Possible next steps
- Co-op survival, multiple rooms per server or a simple server list, an axe swing animation, a laser beam visual, and GPU profiling on real hardware.
- A production online service would need hosted servers, accounts, server-side progression and entitlements, and anti-cheat. That isn't in scope without real infrastructure.
