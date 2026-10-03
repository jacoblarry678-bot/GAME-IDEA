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

## Next: Milestone 4 (more content)
- Expand the arsenal to 16 weapons, adding attachments, perks and support abilities.
- New maps: Old Quarter and Signal Station.
- New modes: Free-for-All, Domination, Hardpoint, Elimination and Gun Game.

## Later milestones
- M5: real online play needs a server-authoritative game server, accounts and a backend. Until then, online features stay labelled unavailable.
